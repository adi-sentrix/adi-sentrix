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
import { verifyAccessCode, makeAccessCode, makeMintGrant, verifyMintGrant, constantTimeEqual as verifyEq } from "./accessToken.js";
// ARQUITECTURA C (Fase 3 · detrás del flag ADI_ORACLE_ENABLED) · las DOS pasadas del oráculo verificado.
import { ADI_PERSONA, renderInteractionMemory } from "../oracle/persona.js";
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
export async function handlePlan({ text, history, mem, scenario, access, tenantId } = {}, env) {
  const acc = await _access(access, env);
  if (!acc.ok) return { ok: false, access: "denied", reason: acc.reason, error: "acceso requerido" };
  if (!text || typeof text !== "string") return { ok: false, error: "sin texto" };
  if (!_checkRateLimit(tenantId, env)) return { ok: false, error: "rate_limited", reason: "demasiadas solicitudes, esperá un momento" };
  const { provider, model } = _config(env);
  const system = buildPlanSystem(ADI_PERSONA, renderInteractionMemory(mem), scenario || "actual");
  const user = buildPlanUserMessage(history, text);
  const { spec: plan, usage } = await getAdapter(provider).parse(user, { system, tool: PLAN_TOOL, model });
  return { ok: true, plan, usage };
}

// NARRAR-C (Pasada 2): el CLIENTE ya corrió el batch y arma el payload (pregunta + datos + cifras_autorizadas +
// memoria); acá solo inyectamos la persona + memoria como system y narramos. El guard endurecido corre en el cliente.
export async function handleNarrateC({ payload, mem, access, tenantId } = {}, env) {
  const acc = await _access(access, env);
  if (!acc.ok) return { ok: false, access: "denied", reason: acc.reason, error: "acceso requerido" };
  if (!payload || typeof payload !== "object") return { ok: false, error: "sin payload" };
  if (!_checkRateLimit(tenantId, env)) return { ok: false, error: "rate_limited", reason: "demasiadas solicitudes, esperá un momento" };
  const { provider, narrateModel } = _config(env);
  const system = buildNarrateSystemC(ADI_PERSONA, renderInteractionMemory(mem));
  const { text: narration, usage } = await getAdapter(provider).narrate(payload, { model: narrateModel, system });
  return { ok: true, narration, usage };
}

// path → handler (para los wrappers que enrutan por URL)
export const GATEWAY_ROUTES = {
  "/api/adi-spec": handleSpec,
  "/api/adi-narrate": handleNarrate,
  "/api/adi-access": handleAccess,   // demo privada · status/check/mint (owner 2026-07-08)
  "/api/adi-plan": handlePlan,       // Arquitectura C · Pasada 1 (detrás del flag · fallback intacto)
  "/api/adi-narrate-c": handleNarrateC, // Arquitectura C · Pasada 2
};
