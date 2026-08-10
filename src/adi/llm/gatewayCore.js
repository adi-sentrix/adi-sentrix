/* === src/adi/llm/gatewayCore.js · GATEWAY LLM · handlers PLATFORM-NEUTRAL (una sola fuente de verdad) ===
 * La lógica de los DOS pasos del LLM, SIN acoplarse a Vite ni a ninguna plataforma:
 *   · handleSpec    · LLM #1 · texto → spec canónico (adapter.parse)
 *   · handleNarrate · LLM #2 · output validado → narración (adapter.narrate)
 * Cada entorno (dev Vite · server Node · función serverless) es un WRAPPER delgado que llama a estos handlers.
 *
 * REGLA: la key vive en el env del SERVER (process.env) · JAMÁS en el cliente ni en el bundle. El motor ADI y el
 * number-guard corren en el CLIENTE (answerADIFromSpec + pickNarratedText local) → este gateway sólo habla con el
 * proveedor. NO toca el motor sellado. Si algo falla → {ok:false} y el cliente degrada al piso determinístico.
 */
import { buildContractMenu, buildParseUserMessage } from "./contractMenu.js";
import { buildSpecTool } from "./specTool.js";
import { buildNarrateSystem } from "./narratePrompt.js";
import { getAdapter } from "./providerAdapter.js";
import { chooseModel } from "./modelRouter.js";
import { emit as emitTelemetria, desdeRespuesta, nuevoTraceId } from "./telemetry.js";   // observación pura (owner 2026-08-10)
import { verifyAccessCode, makeAccessCode, makeMintGrant, verifyMintGrant, constantTimeEqual as verifyEq } from "./accessToken.js";
// ARQUITECTURA C (Fase 3 · detrás del flag ADI_ORACLE_ENABLED) · las DOS pasadas del oráculo verificado.
import { ADI_PERSONA, ADI_PERSONA_PLAN, renderInteractionMemory } from "../oracle/persona.js";
import { buildPlanSystem, buildPlanUserMessage, PLAN_TOOL } from "../oracle/planPrompt.js";
import { buildNarrateSystemC } from "../oracle/narratePromptC.js";

// config del proveedor desde el env (en dev el .env se carga a process.env · en prod lo setea la plataforma).
// `env` inyectable para runtimes que no exponen process.env global (ej. Cloudflare Workers) · default process.env.
function _env(env) {
  return env || (typeof process !== "undefined" ? process.env : {}) || {};
}
function _config(env) {
  const e = _env(env);
  const provider = e.LLM_PROVIDER || "anthropic";
  const model = e.LLM_MODEL_PARSE || e.OPENAI_MODEL || e.ANTHROPIC_MODEL || "gpt-4o-mini";
  const narrateModel = e.LLM_MODEL_NARRATE || model;
  return { provider, model, narrateModel };
}

// ── RATE LIMIT básico por tenant (owner 2026-07-29, multiempresa/rendimiento) ───────────────────────────────────
// In-memory, best-effort: correcto en un proceso PERSISTENTE (server.js/devGateway) — en funciones serverless
// efímeras cada cold start resetea el contador, así que ahí es una red PARCIAL, no una garantía dura. Una garantía
// dura entre instancias exige un store distribuido (Redis/Upstash) — decisión de infra que no se puede tomar acá
// sin elegir un proveedor real; se documenta como el siguiente paso, no se finge tenerlo.
const _rateBuckets = new Map();   // tenantId → { count, windowStart }
function _checkRateLimit(tenantId, env) {
  const e = _env(env);
  const windowMs = Number(e.LLM_RATE_WINDOW_MS) || 60000;
  const maxPerWindow = Number(e.LLM_RATE_MAX_PER_WINDOW) || 30;
  const key = tenantId || "_sin_tenant";
  const now = Date.now();
  let b = _rateBuckets.get(key);
  if (!b || now - b.windowStart > windowMs) { b = { count: 0, windowStart: now }; _rateBuckets.set(key, b); }
  b.count++;
  return b.count <= maxPerWindow;
}

// ── PRESUPUESTO DE ESCALAMIENTO por tenant (owner 2026-08-02, hallazgo de auditoría del router de modelo) ─────────
// `attempt` viaja en el body de la request — es SEÑAL del cliente, no un hecho verificado por el server (el motor
// que reintenta corre client-side, ver answerViaOracle.js). Sin este freno, cualquier caller con acceso podría
// mandar attempt≥1 en TODAS sus llamadas y forzar tier2/tier3 (hasta 50x el costo de tier1) en cada turno, sin que
// haya habido un rechazo real de guardC — exactamente lo que el router NO debía permitir. Mismo patrón/limitación
// que _checkRateLimit (in-memory, best-effort, reseteable por cold start — un store distribuido es el siguiente
// paso si esto se vuelve una garantía dura, no se finge tenerlo acá). Al excederse, NO se rechaza la request
// (nunca abstención): se DEGRADA a tier1 — sigue siendo una respuesta útil, solo que al piso barato/rápido.
const _tierBuckets = new Map();   // tenantId → { count, windowStart }
function _tierBudgetOk(tenantId, env) {
  const e = _env(env);
  const windowMs = Number(e.LLM_TIER_BUDGET_WINDOW_MS) || 60000;
  const maxPerWindow = Number(e.LLM_TIER_BUDGET_MAX_PER_WINDOW) || 10;
  const key = tenantId || "_sin_tenant";
  const now = Date.now();
  let b = _tierBuckets.get(key);
  if (!b || now - b.windowStart > windowMs) { b = { count: 0, windowStart: now }; _tierBuckets.set(key, b); }
  b.count++;
  return b.count <= maxPerWindow;
}
// resolveModel: envuelve chooseModel + el freno de presupuesto — ÚNICO punto que handlePlan/handleNarrateC llaman,
// así el freno no se puede olvidar en un caller nuevo.
function _resolveModel({ provider, tier1, attempt, step, mode, env, tenantId }) {
  const routed = chooseModel({ provider, tier1, attempt, step, mode, env });
  if (!routed || routed.tier <= 1) return routed;
  if (_tierBudgetOk(tenantId, env)) return routed;
  return { model: tier1, tier: 1, reason: `tier1:presupuesto de escalamiento excedido para este tenant, degradado desde ${routed.reason}` };
}

// ── ACCESO DEMO PRIVADA (owner 2026-07-08) ──────────────────────────────────────────────────────────────────────
// Con ADI_TOKEN_SECRET seteado, TODA llamada al LLM exige un código firmado vigente (body.access) — es lo que
// protege la key del proveedor cuando el link circula. Sin secret → gateway abierto (dev/backcompat intactos).
// La denegación viaja como {ok:false, access:"denied"} → el cliente muestra la pantalla de acceso (no rompe el piso).
async function _access(accessCode, env) {
  const secret = _env(env).ADI_TOKEN_SECRET;
  if (!secret) return { ok: true, open: true };
  const r = await verifyAccessCode(accessCode, secret);
  return r.ok ? { ok: true } : { ok: false, reason: r.reason, expiresAt: r.expiresAt || null };
}

// /api/adi-access · status (¿la demo exige código?) · check (validar un código) · mint (emitir uno · solo admin)
export async function handleAccess(body = {}, env) {
  const e = _env(env);
  const secret = e.ADI_TOKEN_SECRET || "";
  const op = body.op || "status";
  if (op === "status") return { ok: true, required: !!secret };
  if (op === "check") {
    if (!secret) return { ok: true, required: false };
    const r = await verifyAccessCode(body.access, secret);
    return r.ok
      ? { ok: true, required: true, name: r.name, expiresAt: r.expiresAt }
      : { ok: false, required: true, reason: r.reason, expiresAt: r.expiresAt || null };
  }
  // HABILITAR EMISIÓN por 10 min (owner 2026-07-20): valida la clave admin y devuelve un grant temporal firmado.
  // ADI_MINT_ENABLED es el KILL-SWITCH MAESTRO de emergencia (normalmente "true"; ausente/false → nadie puede habilitar).
  if (op === "mint_enable") {
    if (String(e.ADI_MINT_ENABLED) !== "true") return { ok: false, error: "emisión bloqueada" };
    const adminKey = e.ADI_ADMIN_KEY;
    if (!secret || !adminKey || !verifyEq(String(body.adminKey || ""), adminKey)) return { ok: false, error: "sin autorización" };
    const { grant, expiresAt } = await makeMintGrant(secret, 10 * 60 * 1000);
    return { ok: true, grant, expiresAt };
  }
  if (op === "mint") {
    // Exige TRES capas: maestro armado + grant temporal vigente + clave admin. El grant (10 min, solo en memoria del
    // cliente) reemplaza el toggle de Vercel como interruptor operativo cotidiano. check/status/validación/LLM no se tocan.
    if (String(e.ADI_MINT_ENABLED) !== "true") return { ok: false, error: "emisión bloqueada" };
    const g = await verifyMintGrant(body.grant, secret);
    if (!g.ok) return { ok: false, error: "emisión no habilitada" };
    const adminKey = e.ADI_ADMIN_KEY;
    if (!adminKey || !body.adminKey || !verifyEq(String(body.adminKey), adminKey)) return { ok: false, error: "sin autorización" };
    const name = String(body.name || "").trim().slice(0, 40) || "invitado";
    // invitados: 1h a 30 días (default 3 · subido de 14 a 30 el 2026-07-27 para el ciclo de review de 500 LATAM —
    // un link estable todo el proceso; sigue revocable rotando ADI_TOKEN_SECRET) · OWNER (owner:true — intención
    // explícita con la MISMA clave admin): hasta 1 año, para no re-emitir su propio acceso cada 3 días (owner 2026-07-10).
    const cap = body.owner === true ? 24 * 366 : 24 * 30;
    const hours = Math.min(Math.max(Number(body.hours) || 72, 1), cap);
    const { code, expiresAt } = await makeAccessCode(name, hours, secret);
    return { ok: true, code, expiresAt, name };
  }
  return { ok: false, error: "op desconocida" };
}

// LLM #1 · texto (+ contexto de conversación) → spec · devuelve {ok, spec, usage} | {ok:false, error}
// El `context` (conversationContext · turnos + última evidencia) viaja al LLM #1 vía buildParseUserMessage → clasifica
// turn_type y resuelve referencias. El motor/seam sigue validando; el contexto NO habilita saltar guards.
export async function handleSpec({ text, context, access } = {}, env) {
  const acc = await _access(access, env);
  if (!acc.ok) return { ok: false, access: "denied", reason: acc.reason, error: "acceso requerido" };
  if (!text || typeof text !== "string") return { ok: false, error: "sin texto" };
  const { provider, model } = _config(env);
  const userMessage = buildParseUserMessage(context, text);
  const { spec, usage } = await getAdapter(provider).parse(userMessage, { system: buildContractMenu(), tool: buildSpecTool(), model });
  return { ok: true, spec, usage };
}

// LLM #2 · output validado → narración · el number-guard corre en el CLIENTE (si falla → texto determinístico)
export async function handleNarrate({ text, evidence, access } = {}, env) {
  const acc = await _access(access, env);
  if (!acc.ok) return { ok: false, access: "denied", reason: acc.reason, error: "acceso requerido" };
  if (!text || typeof text !== "string") return { ok: false, error: "sin texto" };
  const { provider, narrateModel } = _config(env);
  const system = buildNarrateSystem(evidence);   // general vs simulación (evidence.transform) · provider-neutral
  const { text: narration, usage } = await getAdapter(provider).narrate({ text, evidence }, { model: narrateModel, system });
  return { ok: true, narration, usage };
}

// ── ARQUITECTURA C · Fase 3 · las dos pasadas del oráculo (detrás del flag · fallback intacto) ──────────────────
// PLAN (Pasada 1): texto (+ hilo + memoria de interacción) → PLAN estructurado (qué tools llamar, con qué alcance).
// El BATCH determinístico corre en el CLIENTE (runPlan · puro); solo las 2 llamadas al LLM pasan por acá.
// `vistaLinea` (owner 2026-08-09, Contrato de Concordancia ADI ↔ Sentrix): UNA línea de ≤240 caracteres, sin
// cifras, que declara qué está mirando el usuario en Sentrix (ver viewContext.js:projectViewContextForPlan). El
// gateway no la interpreta ni la construye — la pasa tal cual a buildPlanUserMessage, que decide dónde va. Opcional:
// un turno sin panel abierto manda undefined y el mensaje de PLAN queda byte-idéntico al de siempre.
export async function handlePlan({ text, history, mem, scenario, access, tenantId, attempt, vistaLinea } = {}, env) {
  const acc = await _access(access, env);
  if (!acc.ok) return { ok: false, access: "denied", reason: acc.reason, error: "acceso requerido" };
  if (!text || typeof text !== "string") return { ok: false, error: "sin texto" };
  if (!_checkRateLimit(tenantId, env)) return { ok: false, error: "rate_limited", reason: "demasiadas solicitudes, esperá un momento" };
  const { provider, model: tier1 } = _config(env);
  // ROUTER (owner 2026-08-02, ver modelRouter.js): intento 0 = tier1 (idéntico a la config estática de siempre);
  // reintentos posteriores (el turno cayó acá de nuevo porque el intento anterior no dio JSON válido) escalan de
  // modelo. `routed` es null si el router no aplica (proveedor≠openai o apagado) → se usa tier1 tal cual, sin cambios.
  const routed = _resolveModel({ provider, tier1, attempt, step: "plan", env, tenantId });
  const model = routed ? routed.model : tier1;
  // ADI_PERSONA_PLAN (owner 2026-08-03, Fase 1 eficiencia de Mini — ver persona.js): SOLO acá, PLAN tiene tool_choice
  // forzado a JSON (nunca redacta prosa) — la doctrina de narración de ADI_PERSONA completa es costo sin efecto.
  // NARRAR (handleNarrateC más abajo) sigue recibiendo ADI_PERSONA completa, sin cambios.
  // el 4º argumento decide si la doctrina de CONTEXTO DE PANTALLA entra al system: SOLO cuando este turno trae de
  // verdad la línea (mismo criterio que handleNarrateC con `payload.contexto_vista`). Lo lee del body, no lo adivina.
  const system = buildPlanSystem(ADI_PERSONA_PLAN, renderInteractionMemory(mem), scenario || "actual",
    !!(typeof vistaLinea === "string" && vistaLinea.trim()));
  const user = buildPlanUserMessage(history, text, typeof vistaLinea === "string" ? vistaLinea : null);
  // TELEMETRÍA (owner 2026-08-10) · observación pura: mide, no decide. Con el sink apagado —el default— no
  // hace nada. Nunca lanza, así que no puede tumbar un turno. Ver telemetry.js para los 9 campos y el candado.
  const _t0 = Date.now();
  const { spec: plan, usage, model: modeloEfectivo } = await getAdapter(provider).parse(user, { system, tool: PLAN_TOOL, model });
  // `modelo` = el que RESPONDIÓ (owner 2026-08-10) · `modelUsed` = el que se PIDIÓ, intacto para los consumidores
  // que ya lo leen. Los dos viajan: no son lo mismo y confundirlos es lo que dejó el modelo en "?" en la corrida
  // de certificación —el arnés buscaba `model`/`modelo` y acá sólo existía `modelUsed`—.
  const r = { ok: true, plan, usage, modelUsed: model, modelo: modeloEfectivo || model, modelReason: routed ? routed.reason : "static:sin router" };
  emitTelemetria(desdeRespuesta({ traceId: nuevoTraceId(), proveedor: provider, modelo: model, etapa: "plan",
    intento: Number(attempt) || 0, latencia_ms: Date.now() - _t0, respuesta: r, ruta_deterministica: false }));
  return r;
}

// NARRAR-C (Pasada 2): el CLIENTE ya corrió el batch y arma el payload (pregunta + datos + cifras_autorizadas +
// memoria); acá solo inyectamos la persona + memoria como system y narramos. El guard endurecido corre en el cliente.
export async function handleNarrateC({ payload, mem, access, tenantId, attempt } = {}, env) {
  const acc = await _access(access, env);
  if (!acc.ok) return { ok: false, access: "denied", reason: acc.reason, error: "acceso requerido" };
  if (!payload || typeof payload !== "object") return { ok: false, error: "sin payload" };
  if (!_checkRateLimit(tenantId, env)) return { ok: false, error: "rate_limited", reason: "demasiadas solicitudes, esperá un momento" };
  const { provider, narrateModel: tier1 } = _config(env);
  // ROUTER: intento 0 = tier1 (idéntico a hoy). El turno vuelve a pasar por acá SOLO cuando answerViaOracle.js
  // reintentó tras un rechazo de guardC (ver el loop de 3 intentos ahí) — cada reintento escala de modelo antes de
  // repetir con el mismo que ya falló. `payload.modo` viaja solo para el texto de razón/telemetría, nunca decide.
  const routed = _resolveModel({ provider, tier1, attempt, step: "narrate", mode: payload.modo, env, tenantId });
  const model = routed ? routed.model : tier1;
  // mode (owner 2026-08-03, Fase 2 eficiencia de Mini — ver conversationalContract.js/buildModeDispatch): payload.modo
  // YA viaja acá (buildNarrateUserMessageC lo pone en el payload, ver narratePromptC.js) — se lo pasamos al system
  // para que la doctrina de "MODO DE CONVERSACIÓN" mande SOLO el modo de ESTE turno, no los 7 completos.
  // mem.responsePref (owner 2026-08-03, Fase 2 eficiencia de Mini — ver responsePreference.js): el bloque de
  // doctrina de preferencia de FORMATO ahora solo se manda si la SESIÓN tiene una preferencia persistida no-default.
  // contexto_vista (owner 2026-08-09, Contrato de Concordancia ADI↔Sentrix): si el payload trae la línea de pantalla,
  // el system suma el bloque que explica QUÉ es y —sobre todo— qué NO es (no trae cifras, y nada se deriva de ahí).
  // Condicional por la MISMA razón que las dos doctrinas de arriba: el 100% de los turnos que no vienen de Sentrix
  // no paga ni un token por una regla que no van a usar.
  const system = buildNarrateSystemC(ADI_PERSONA, renderInteractionMemory(mem), payload.modo, mem && mem.responsePref, !!payload.contexto_vista);
  const _tNarr = Date.now();   // telemetría: latencia de NARRAR (observación pura, owner 2026-08-10)
  const { text: narration, usage, model: modeloEfectivo } = await getAdapter(provider).narrate(payload, { model, system });
  const _t0n = _tNarr; const _rn = { ok: true, narration, usage, modelUsed: model, modelo: modeloEfectivo || model, modelReason: routed ? routed.reason : "static:sin router" };
  emitTelemetria(desdeRespuesta({ traceId: nuevoTraceId(), proveedor: provider, modelo: model, etapa: "narrar",
    intento: Number(attempt) || 0, latencia_ms: Date.now() - _t0n, respuesta: _rn, ruta_deterministica: false }));
  return _rn;
}

// path → handler (para los wrappers que enrutan por URL)
export const GATEWAY_ROUTES = {
  "/api/adi-spec": handleSpec,
  "/api/adi-narrate": handleNarrate,
  "/api/adi-access": handleAccess,   // demo privada · status/check/mint (owner 2026-07-08)
  "/api/adi-plan": handlePlan,       // Arquitectura C · Pasada 1 (detrás del flag · fallback intacto)
  "/api/adi-narrate-c": handleNarrateC, // Arquitectura C · Pasada 2
};
