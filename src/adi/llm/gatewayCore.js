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
import { resolverProveedor, mensajeFaltaProveedor } from "./providerConfig.js";   // el proveedor se declara, no se adivina (owner 2026-08-13)
import { resolverModelos } from "./modelDefaults.js";   // el default de modelo conoce a su proveedor (owner 2026-08-13)
import { chooseModel } from "./modelRouter.js";
import { estimateCostUSD, resolvePricingKey } from "./modelPricing.js";   // el precio se resuelve por FAMILIA (owner 2026-08-11)
import { emit as emitTelemetria, desdeRespuesta, nuevoTraceId, aReasonCode } from "./telemetry.js";   // observación pura (owner 2026-08-10)
import { verifyAccessCode, makeAccessCode, makeMintGrant, verifyMintGrant, constantTimeEqual as verifyEq } from "./accessToken.js";
// ARQUITECTURA C (Fase 3 · detrás del flag ADI_ORACLE_ENABLED) · las DOS pasadas del oráculo verificado.
import { ADI_PERSONA, ADI_PERSONA_PLAN, renderInteractionMemory } from "../oracle/persona.js";
import { buildPlanSystem, buildPlanSystemSegments, buildPlanUserMessage, PLAN_TOOL } from "../oracle/planPrompt.js";
import { buildNarrateSystemSegments } from "../oracle/narratePromptC.js";

// config del proveedor desde el env (en dev el .env se carga a process.env · en prod lo setea la plataforma).
// `env` inyectable para runtimes que no exponen process.env global (ej. Cloudflare Workers) · default process.env.
function _env(env) {
  return env || (typeof process !== "undefined" ? process.env : {}) || {};
}
// EL PROVEEDOR SE DECLARA, NO SE ADIVINA (owner 2026-08-13). Acá decía `e.LLM_PROVIDER || "anthropic"`: sin la
// variable, el gateway se iba CALLADO a otro proveedor con la clave equivocada y el usuario leía "gateway no
// disponible" con la causa real invisible (verificado en vivo: 401 del proveedor equivocado). Ahora la ausencia
// no elige nada — viaja como `falta` y CADA handler la frena con un error que NOMBRA la variable, antes de tocar
// a ningún proveedor y dejando su evento de telemetría. Ver providerConfig.js para el porqué del módulo aparte.
// `model`/`narrateModel` (owner 2026-08-13, preparación Anthropic): el default también dejó de ignorar al
// proveedor. Acá decía `LLM_MODEL_PARSE || OPENAI_MODEL || ANTHROPIC_MODEL || "gpt-4o-mini"` — con
// LLM_PROVIDER=anthropic y las variables de modelo sin setear, "gpt-4o-mini" viajaba a la API de Anthropic y
// reventaba en runtime, en producción. La decisión vive en modelDefaults.js (módulo puro, la suite offline la
// ejerce de verdad — ver ahí el porqué de cada rama); esto NO debilita el freno de arriba: el default consciente
// aplica solo DESPUÉS de que el proveedor está declarado, y sin LLM_PROVIDER se sigue fallando nombrándola.
function _config(env) {
  const e = _env(env);
  const { proveedor, falta } = resolverProveedor(e);
  const { model, narrateModel } = resolverModelos(e, proveedor);
  return { provider: proveedor, model, narrateModel, falta };
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
// TELEMETRÍA TAMBIÉN ACÁ (owner 2026-08-11, segunda pasada): estos DOS handlers están montados en endpoints
// DESPLEGADOS (/api/adi-spec y /api/adi-narrate, ver GATEWAY_ROUTES abajo) y llaman al proveedor PAGO igual que
// la pareja del oráculo — y hasta hoy no emitían UN solo evento. La regla del gateway no admite excepciones por
// antigüedad: si una ruta puede gastar, tiene que poder contarse. El contrato de retorno de los dos queda BYTE
// IDÉNTICO ({ok, spec, usage} / {ok, narration, usage}): la telemetría observa, no cambia lo que devuelven ni
// lo que lanzan. Sin `attempt` ni `motivoReintento` porque su body no los tiene: intento 0, sin causa heredada.
export async function handleSpec({ text, context, access } = {}, env) {
  const { provider, model, falta } = _config(env);
  const _t0 = Date.now();
  let _emitidos = 0;
  // ── EL CRUCE (owner 2026-08-13) · a partir de la línea que lo prende, la llamada PUDO FACTURARSE ────────────
  // Arranca en false y se prende UNA vez, pegado a la llamada al proveedor. No es un argumento por sitio de
  // emisión —eso se olvida en el sitio nuevo— sino el estado del handler: cualquier evento que salga después del
  // cruce declara que la llamada salió, incluido el que emite la excepción. Ver el bloque CONSUMO en telemetry.js.
  let _salioAlProveedor = false;
  const _emitir = (respuesta, causa) => {
    _emitidos++;
    const ev = desdeRespuesta({ traceId: nuevoTraceId(), proveedor: provider, modelo: model, etapa: "plan",
      intento: 0, latencia_ms: Date.now() - _t0, respuesta, ruta_deterministica: false, salioAlProveedor: _salioAlProveedor });
    ev.reasonCode = causa || ev.reasonCode || null;
    emitTelemetria(ev);
  };
  const _frenado = (r, causa) => { _emitir(r, causa); return r; };
  try {
    const acc = await _access(access, env);
    if (!acc.ok) return _frenado({ ok: false, access: "denied", reason: acc.reason, error: "acceso requerido" });
    if (!text || typeof text !== "string") return _frenado({ ok: false, error: "sin texto" });
    // ── SIN PROVEEDOR DECLARADO NO SE LLAMA A NADIE (owner 2026-08-13) · el freno vive en LOS CUATRO handlers ──
    // Va DENTRO del try y por el freno emisor, como todos: un fallo de configuración que no deja evento es
    // exactamente el silencio que este gateway dejó de permitir. Va DESPUÉS de la puerta de acceso a propósito —
    // un caller sin autorización no tiene por qué enterarse de cómo está configurado el servidor— y ANTES de
    // armar prompts o rutear modelo: no se gasta un milisegundo en un turno que no puede salir.
    // El error NOMBRA la variable, y la telemetría lo separa de un fallo del proveedor con su propio código:
    // "nadie configuró el proveedor" y "el proveedor falló" son dos problemas distintos y se arreglan distinto.
    if (falta) return _frenado({ ok: false, error: mensajeFaltaProveedor(falta), configFaltante: falta }, "config_missing");
    const userMessage = buildParseUserMessage(context, text);
    let spec, usage;
    try {
      // ANTES del await, no después: si se prendiera después, la llamada que revienta por timeout —justo la que
      // el proveedor ya generó y facturó— se registraría como un turno que nunca salió. Ese es EL caso.
      _salioAlProveedor = true;
      const salida = await getAdapter(provider).parse(userMessage, { system: buildContractMenu(), tool: buildSpecTool(), model });
      if (!salida || typeof salida !== "object") throw new TypeError("el proveedor devolvió una respuesta vacía");
      ({ spec, usage } = salida);
    } catch (e) {
      _emitir({ ok: false, error: "el proveedor no respondió" }, aReasonCode((e && e.message) || "provider"));
      throw e;
    }
    const r = { ok: true, spec, usage };
    _emitir(r);
    return r;
  } catch (e) {
    // LA RED DE SEGURIDAD, NO UN ATAJO: si el handler se va por una excepción que ninguna de las ramas de arriba
    // ya contó, deja su evento y RELANZA intacta. Nunca emite dos veces la misma llamada (_emitidos lo impide).
    if (!_emitidos) _emitir({ ok: false, error: "el turno no llegó al proveedor" }, aReasonCode((e && e.message) || "unknown"));
    throw e;
  }
}

// LLM #2 · output validado → narración · el number-guard corre en el CLIENTE (si falla → texto determinístico)
export async function handleNarrate({ text, evidence, access } = {}, env) {
  const { provider, narrateModel, falta } = _config(env);
  const _t0 = Date.now();
  let _emitidos = 0;
  let _salioAlProveedor = false;   // el cruce · ver el bloque en handleSpec
  const _emitir = (respuesta, causa) => {
    _emitidos++;
    const ev = desdeRespuesta({ traceId: nuevoTraceId(), proveedor: provider, modelo: narrateModel, etapa: "narrar",
      intento: 0, latencia_ms: Date.now() - _t0, respuesta, ruta_deterministica: false, salioAlProveedor: _salioAlProveedor });
    ev.reasonCode = causa || ev.reasonCode || null;
    emitTelemetria(ev);
  };
  const _frenado = (r, causa) => { _emitir(r, causa); return r; };
  try {
    const acc = await _access(access, env);
    if (!acc.ok) return _frenado({ ok: false, access: "denied", reason: acc.reason, error: "acceso requerido" });
    if (!text || typeof text !== "string") return _frenado({ ok: false, error: "sin texto" });
    if (falta) return _frenado({ ok: false, error: mensajeFaltaProveedor(falta), configFaltante: falta }, "config_missing");   // ver el bloque en handleSpec
    const system = buildNarrateSystem(evidence);   // general vs simulación (evidence.transform) · provider-neutral
    let narration, usage;
    try {
      _salioAlProveedor = true;   // el cruce, antes del await · ver handleSpec
      const salida = await getAdapter(provider).narrate({ text, evidence }, { model: narrateModel, system });
      if (!salida || typeof salida !== "object") throw new TypeError("el proveedor devolvió una respuesta vacía");
      ({ text: narration, usage } = salida);
    } catch (e) {
      _emitir({ ok: false, error: "el proveedor no respondió" }, aReasonCode((e && e.message) || "provider"));
      throw e;
    }
    const r = { ok: true, narration, usage };
    _emitir(r);
    return r;
  } catch (e) {
    if (!_emitidos) _emitir({ ok: false, error: "el turno no llegó al proveedor" }, aReasonCode((e && e.message) || "unknown"));
    throw e;
  }
}

// ── LA CAUSA VIAJA COMO CÓDIGO DE LISTA CERRADA (owner 2026-08-11, hallazgo de la corrida pagada) ───────────────
// EL AGUJERO QUE CIERRA: la telemetría de la corrida registró 10 eventos "rechazado" con la causa en null, y 27
// reintentos contados como llamadas felices. La causa EXISTE en el turno —el veredicto con que guardC rechazó el
// intento anterior— pero NO existe en este proceso: guardC corre en el CLIENTE, después de que el gateway ya
// respondió. La única forma de que llegue al sitio de emisión es que el cliente la declare en el body, igual que ya
// declara `attempt`. Si no la declara, el gateway igual sabe que hubo una: un intento ≥1 sólo existe porque el
// anterior no sirvió.
// EL BORDE ES ACÁ, NO EN LA TELEMETRÍA: sólo se mira un token corto de vocabulario cerrado (minúsculas, guiones y
// guiones bajos —la forma que tienen tanto los veredictos del guard como los propios REASON_CODES—, sin espacios,
// sin dígitos, sin mayúsculas) y lo que sale es SIEMPRE uno de los siete códigos. Una frase, un nombre de entidad o
// una cifra («$13,9M») no atraviesan esta función: se descartan enteras, no se guardan y no se loguean. Así este
// campo no puede volverse la fuga de datos del cliente que telemetry.js cerró a propósito.
function _causaDeclarada(motivo) {
  if (typeof motivo !== "string" || !/^[a-z][a-z_-]{2,39}$/.test(motivo)) return null;
  return aReasonCode(motivo);   // el valor que sobrevive es un CÓDIGO, jamás el texto que entró
}
// Un intento ≥1 nunca puede salir sin causa: sin ella, un reintento es indistinguible de un turno nuevo, que es
// exactamente lo que hizo ilegible la corrida. Lo no declarado queda en "unknown" ("hubo una causa y no se
// informó"), nunca en null (el silencio que no se puede contar).
function _causaDelIntento(motivo, attempt) {
  if ((Number(attempt) || 0) <= 0) return null;
  return _causaDeclarada(motivo) || "unknown";
}

// ── ARQUITECTURA C · Fase 3 · las dos pasadas del oráculo (detrás del flag · fallback intacto) ──────────────────
// PLAN (Pasada 1): texto (+ hilo + memoria de interacción) → PLAN estructurado (qué tools llamar, con qué alcance).
// El BATCH determinístico corre en el CLIENTE (runPlan · puro); solo las 2 llamadas al LLM pasan por acá.
// `vistaLinea` (owner 2026-08-09, Contrato de Concordancia ADI ↔ Sentrix): UNA línea de ≤240 caracteres, sin
// cifras, que declara qué está mirando el usuario en Sentrix (ver viewContext.js:projectViewContextForPlan). El
// gateway no la interpreta ni la construye — la pasa tal cual a buildPlanUserMessage, que decide dónde va. Opcional:
// un turno sin panel abierto manda undefined y el mensaje de PLAN queda byte-idéntico al de siempre.
// `datoNegocio` (owner 2026-08-14, «el dato al PLAN»): la MISMA proyección curada que ya recibe NARRAR y el MISMO
// modelo de confianza — la arma el CLIENTE (datoProyectado.js, donde vive el tenant activo) y viaja como campo
// propio del body, hermano de `text`/`history`. El gateway no la interpreta ni la valida: la coloca al final del
// segmento FIJO del system (buildPlanSystemSegments, 5º argumento), que sigue siendo cache:true. Sin el campo
// (callers viejos, gates, wrappers no actualizados): undefined → null → system byte-idéntico al de siempre.
export async function handlePlan({ text, history, mem, scenario, access, tenantId, attempt, vistaLinea, motivoReintento, datoNegocio } = {}, env) {
  const { provider, model: tier1, falta } = _config(env);
  // TELEMETRÍA (owner 2026-08-10) · observación pura: mide, no decide. Con el sink apagado —el default— no
  // hace nada. Nunca lanza, así que no puede tumbar un turno. Ver telemetry.js para los 9 campos y el candado.
  // UNA SOLA SALIDA PARA TODAS LAS RUTAS DEL HANDLER (owner 2026-08-11): antes el único emit vivía DEBAJO del
  // `await` al proveedor, así que sólo el camino feliz dejaba rastro — los frenos propios del gateway (`return`
  // temprano) y las llamadas que reventaban no emitían NADA. En la corrida eso fue: 6 llamadas pagadas que
  // fallaron sin dejar un solo evento. Ahora emite el handler entero, no su final feliz.
  const _t0 = Date.now();
  const _causa = _causaDelIntento(motivoReintento, attempt);
  let _modelo = tier1;   // el que se reportaría si el turno se frena antes de rutear; se fija al rutear
  let _emitidos = 0;     // ver la red de seguridad al pie: NINGUNA excepción se va sin evento, y NUNCA dos por llamada
  let _salioAlProveedor = false;   // el cruce · ver el bloque en handleSpec
  const _emitir = (respuesta, causa) => {
    _emitidos++;
    const ev = desdeRespuesta({ traceId: nuevoTraceId(), proveedor: provider, modelo: _modelo, etapa: "plan",
      intento: Number(attempt) || 0, latencia_ms: Date.now() - _t0, respuesta, ruta_deterministica: false, salioAlProveedor: _salioAlProveedor });
    // LA CAUSA SE LLENA ACÁ Y NO VÍA `motivo`: `desdeRespuesta` tipa como "rechazado" TODO evento que traiga
    // motivo, y una llamada que salió bien no se puede contar como rechazo sólo porque existe por un rechazo
    // anterior — invertiría la métrica (27 llamadas buenas pasarían a rechazos). El `resultado` lo decide la
    // respuesta; la causa sólo llena el campo que hoy sale nulo. Prioridad: la de ESTE evento antes que la heredada.
    ev.reasonCode = causa || ev.reasonCode || _causa;
    emitTelemetria(ev);
  };
  const _frenado = (r, causa) => { _emitir(r, causa); return r; };

  // EL HANDLER ENTERO, NO SUS RAMAS CONOCIDAS (owner 2026-08-11, segunda pasada). Enumerar salidas es una lista
  // que se desactualiza: bastaba que el cliente mandara `history: [null]` para que buildPlanUserMessage lanzara
  // ENTRE los frenos y el try del proveedor, y el handler se iba sin dejar un solo evento. Acá se invierte la
  // carga: cualquier excepción que no haya sido contada por una rama de adentro deja su evento en el `catch` del
  // pie y se RELANZA intacta. No se traga nada, no decide nada, y `_emitidos` garantiza un evento por llamada.
  try {
    const acc = await _access(access, env);
    if (!acc.ok) return _frenado({ ok: false, access: "denied", reason: acc.reason, error: "acceso requerido" });
    if (!text || typeof text !== "string") return _frenado({ ok: false, error: "sin texto" });
    if (!_checkRateLimit(tenantId, env)) return _frenado({ ok: false, error: "rate_limited", reason: "demasiadas solicitudes, esperá un momento" });
    if (falta) return _frenado({ ok: false, error: mensajeFaltaProveedor(falta), configFaltante: falta }, "config_missing");   // ver el bloque en handleSpec
    // ROUTER (owner 2026-08-02, ver modelRouter.js): intento 0 = tier1 (idéntico a la config estática de siempre);
    // reintentos posteriores (el turno cayó acá de nuevo porque el intento anterior no dio JSON válido) escalan de
    // modelo. `routed` es null si el router no aplica (proveedor≠openai o apagado) → se usa tier1 tal cual, sin cambios.
    const routed = _resolveModel({ provider, tier1, attempt, step: "plan", env, tenantId });
    const model = routed ? routed.model : tier1;
    _modelo = model;
    // ADI_PERSONA_PLAN (owner 2026-08-03, Fase 1 eficiencia de Mini — ver persona.js): SOLO acá, PLAN tiene tool_choice
    // forzado a JSON (nunca redacta prosa) — la doctrina de narración de ADI_PERSONA completa es costo sin efecto.
    // NARRAR (más abajo) sigue recibiendo ADI_PERSONA completa, sin cambios.
    // el 4º argumento decide si la doctrina de CONTEXTO DE PANTALLA entra al system: SOLO cuando este turno trae de
    // verdad la línea (mismo criterio que la pasada de narración con `payload.contexto_vista`). Lo lee del body.
    // SEGMENTADO PARA QUE EL CACHÉ PEGUE (owner 2026-08-10, cierre de la certificación live — ver el bloque grande
    // en planPrompt.js). El contenido NO cambia: `fijo + variable` es byte por byte el mismo string que devolvía
    // `buildPlanSystem`, y un gate lo verifica. Lo que cambia es DÓNDE queda el corte del caché: antes iba después
    // de la memoria de sesión y del escenario, así que cualquier sesión con un nombre guardado —o cualquier turno
    // que llegara desde Sentrix— perdía los 7.617 tokens fijos enteros, el 96% de la llamada. Ni una regla de
    // negocio se recorta: sólo viajan declarados por separado el 99,8% estable y el resto.
    // datoNegocio (owner 2026-08-14) — 5º argumento: entra AL FINAL del fijo, así el prefijo de siempre no se parte
    // y el bloque (estable por tenant+escenario) queda bajo cache:true. String no vacío o nada — mismo trato que
    // el 7º argumento de la pasada de NARRAR, más abajo.
    const _seg = buildPlanSystemSegments(ADI_PERSONA_PLAN, renderInteractionMemory(mem), scenario || "actual",
      !!(typeof vistaLinea === "string" && vistaLinea.trim()), (typeof datoNegocio === "string" && datoNegocio) || null);
    const system = [{ text: _seg.fijo, cache: true }, { text: _seg.variable, cache: false }];
    const user = buildPlanUserMessage(history, text, typeof vistaLinea === "string" ? vistaLinea : null);
    let plan, usage, modeloEfectivo;
    try {
      _salioAlProveedor = true;   // el cruce, antes del await · ver handleSpec
      const salida = await getAdapter(provider).parse(user, { system, tool: PLAN_TOOL, model });
      // EL DESARMADO VIVE DENTRO DEL TRY (owner 2026-08-11, segunda pasada): afuera, un adapter que resolvía a
      // undefined/null lanzaba un TypeError DESPUÉS de que la llamada ya se había pagado, y no dejaba ni un evento
      // — la misma clase que este bloque existe para cerrar. Una respuesta que no se puede usar es un fallo DEL
      // PROVEEDOR y se cuenta como tal; el error se relanza igual, así el loop de reintentos no cambia.
      if (!salida || typeof salida !== "object") throw new TypeError("el proveedor devolvió una respuesta vacía");
      ({ spec: plan, usage, model: modeloEfectivo } = salida);
    } catch (e) {
      // LA LLAMADA QUE REVIENTA TAMBIÉN SE PAGÓ: el proveedor la generó y el cliente nunca recibió el conteo. Antes
      // moría acá sin dejar rastro. Se emite y se RELANZA sin tocar: answerViaOracle.js necesita la excepción para
      // reintentar y para el backoff de 429 — la telemetría observa, jamás decide ni se traga un error.
      _emitir({ ok: false, error: "el proveedor no respondió" }, aReasonCode((e && e.message) || "provider"));
      throw e;
    }
    // `modelo` = el que RESPONDIÓ (owner 2026-08-10) · `modelUsed` = el que se PIDIÓ, intacto para los consumidores
    // que ya lo leen. Los dos viajan: no son lo mismo y confundirlos es lo que dejó el modelo en "?" en la corrida
    // de certificación —el arnés buscaba `model`/`modelo` y acá sólo existía `modelUsed`—.
    // `modelFamilia`/`costUSD` (owner 2026-08-11): el costo se calcula UNA vez, acá, sobre el modelo EFECTIVO. Los
    // llamadores tarifaban por su cuenta y con campos distintos (la UI el pedido, el arnés el que respondió) — con
    // el precio resuelto por familia los dos dan el MISMO número, y el que quiera el costo ya no tiene que deducirlo.
    const modeloReal = modeloEfectivo || model;
    const r = { ok: true, plan, usage, modelUsed: model, modelo: modeloReal, modelFamilia: resolvePricingKey(modeloReal),
      costUSD: estimateCostUSD(modeloReal, usage), modelReason: routed ? routed.reason : "static:sin router" };
    _emitir(r);
    return r;
  } catch (e) {
    // LA RED DE SEGURIDAD (ver el comentario del `try`): sólo emite si NINGUNA rama de adentro contó ya esta
    // llamada, y relanza intacta. Un `history` con nulos, un `mem` hostil o cualquier throw futuro entre los
    // frenos y el proveedor dejan de ser rutas ciegas sin tener que acordarse de enumerarlas.
    if (!_emitidos) _emitir({ ok: false, error: "el turno no llegó al proveedor" }, aReasonCode((e && e.message) || "unknown"));
    throw e;
  }
}

// NARRAR-C (Pasada 2): el CLIENTE ya corrió el batch y arma el payload (pregunta + datos + cifras_autorizadas +
// memoria); acá solo inyectamos la persona + memoria como system y narramos. El guard endurecido corre en el cliente.
// `datoNegocio` (AMPLITUD F1, owner 2026-08-13): la proyección curada del dato del tenant (texto, la arma
// datoProyectado.js en el CLIENTE — donde vive el tenant activo — y viaja en el body como campo propio, NUNCA
// dentro de `payload`: el payload por turno no crece). El gateway NO la interpreta ni la valida: la coloca al
// final del segmento FIJO del system (buildNarrateSystemSegments, 7º argumento), que sigue siendo cache:true —
// es estable por tenant+escenario, así que el caché de prefijo del proveedor la descuenta en cada llamada.
// Sin el campo (callers viejos, gates): undefined → null → system byte-idéntico al de siempre.
export async function handleNarrateC({ payload, mem, access, tenantId, attempt, motivoReintento, datoNegocio } = {}, env) {
  const { provider, narrateModel: tier1, falta } = _config(env);
  // MISMO TRATO QUE PLAN, o la mitad del gasto queda ciega: el emisor cubre las tres rutas (freno propio,
  // excepción del proveedor y éxito) y la causa del intento anterior viaja como código de lista cerrada.
  // Acá muerde más fuerte que en PLAN: los 27 reintentos de NARRAR de la corrida existían SÓLO porque guardC
  // había rechazado el intento previo, y los 27 quedaron registrados como llamadas felices sin causa.
  const _tNarr = Date.now();   // telemetría: latencia de NARRAR (observación pura, owner 2026-08-10)
  const _causa = _causaDelIntento(motivoReintento, attempt);
  let _modelo = tier1;
  let _emitidos = 0;     // ver la red de seguridad al pie: NINGUNA excepción se va sin evento, y NUNCA dos por llamada
  let _salioAlProveedor = false;   // el cruce · ver el bloque en handleSpec
  const _emitir = (respuesta, causa) => {
    _emitidos++;
    const ev = desdeRespuesta({ traceId: nuevoTraceId(), proveedor: provider, modelo: _modelo, etapa: "narrar",
      intento: Number(attempt) || 0, latencia_ms: Date.now() - _tNarr, respuesta, ruta_deterministica: false, salioAlProveedor: _salioAlProveedor });
    ev.reasonCode = causa || ev.reasonCode || _causa;   // ver el porqué en la pasada de PLAN: el resultado lo decide la respuesta
    emitTelemetria(ev);
  };
  const _frenado = (r, causa) => { _emitir(r, causa); return r; };

  // EL HANDLER ENTERO, NO SUS RAMAS CONOCIDAS (ver el mismo bloque en la pasada de PLAN). Acá el agujero medido
  // era un `payload` cuyo getter de `modo` lanzaba: el handler moría entre los frenos y el try, sin dejar evento.
  try {
    const acc = await _access(access, env);
    if (!acc.ok) return _frenado({ ok: false, access: "denied", reason: acc.reason, error: "acceso requerido" });
    if (!payload || typeof payload !== "object") return _frenado({ ok: false, error: "sin payload" });
    if (!_checkRateLimit(tenantId, env)) return _frenado({ ok: false, error: "rate_limited", reason: "demasiadas solicitudes, esperá un momento" });
    if (falta) return _frenado({ ok: false, error: mensajeFaltaProveedor(falta), configFaltante: falta }, "config_missing");   // ver el bloque en handleSpec
    // ROUTER: intento 0 = tier1 (idéntico a hoy). El turno vuelve a pasar por acá SOLO cuando answerViaOracle.js
    // reintentó tras un rechazo de guardC (ver el loop de 3 intentos ahí) — cada reintento escala de modelo antes de
    // repetir con el mismo que ya falló. `payload.modo` viaja solo para el texto de razón/telemetría, nunca decide.
    const routed = _resolveModel({ provider, tier1, attempt, step: "narrate", mode: payload.modo, env, tenantId });
    const model = routed ? routed.model : tier1;
    _modelo = model;
    // SEGMENTADO PARA QUE EL CACHÉ PEGUE (owner 2026-08-13, Paso 0 "ADI pierde el hilo" — ver PREFIJO ESTABLE en
    // narratePromptC.js): el MISMO mecanismo que PLAN usa más arriba (buildPlanSystemSegments). `fijo + variable`
    // es byte por byte el string que devolvía buildNarrateSystemC; lo que cambia es DÓNDE queda el corte del caché.
    // Antes el dispatch de modo iba al FRENTE del system → el prefijo común entre dos modos era el 21,3% y cada
    // cambio de modo pagaba el 79% del system entero. Ahora el segmento fijo (persona + doctrina + los 7 modos —
    // el payload trae `modo` y decide) es idéntico entre turnos, y todo lo por-turno viaja en la cola variable.
    // mem.responsePref (owner 2026-08-03, Fase 2 eficiencia de Mini — ver responsePreference.js): el bloque de
    // doctrina de preferencia de FORMATO solo se manda si la SESIÓN tiene una preferencia persistida no-default.
    // contexto_vista (owner 2026-08-09, Contrato de Concordancia ADI↔Sentrix): si el payload trae la línea de pantalla,
    // el system suma el bloque que explica QUÉ es y —sobre todo— qué NO es (no trae cifras, y nada se deriva de ahí).
    // Condicional por la MISMA razón que la doctrina de arriba: el 100% de los turnos que no vienen de Sentrix
    // no paga ni un token por una regla que no van a usar.
    // reparacion (owner 2026-08-10, Contrato Conversacional v1.2): si el payload declara que este turno es una
    // corrección, un desacuerdo o trae una cifra del usuario viva, el system suma la doctrina de reparación. Misma
    // condicionalidad —y la misma razón— que las de arriba: se lee del payload, no se adivina, y un turno que
    // no repara nada no paga ni un token. El objeto viene SELLADO del contrato de narración, no del plan crudo.
    // datoNegocio (AMPLITUD F1) — 7º argumento: entra AL FINAL del fijo, así el prefijo de siempre no se parte
    // y el bloque (estable por tenant+escenario) queda bajo cache:true. String no vacío o nada.
    const _segN = buildNarrateSystemSegments(ADI_PERSONA, renderInteractionMemory(mem), payload.modo, mem && mem.responsePref, !!payload.contexto_vista, payload.reparacion || null, (typeof datoNegocio === "string" && datoNegocio) || null);
    const system = [{ text: _segN.fijo, cache: true }, { text: _segN.variable, cache: false }];
    let narration, usage, modeloEfectivo;
    try {
      _salioAlProveedor = true;   // el cruce, antes del await · ver handleSpec
      const salida = await getAdapter(provider).narrate(payload, { model, system });
      // el desarmado DENTRO del try, por la misma razón que en la pasada de PLAN: una respuesta inutilizable llega
      // después de que la llamada ya se pagó, y tiene que contarse como fallo del proveedor, no evaporarse.
      if (!salida || typeof salida !== "object") throw new TypeError("el proveedor devolvió una respuesta vacía");
      ({ text: narration, usage, model: modeloEfectivo } = salida);
    } catch (e) {
      // se emite y se RELANZA intacta — el loop de reintentos del oráculo vive de esta excepción.
      _emitir({ ok: false, error: "el proveedor no respondió" }, aReasonCode((e && e.message) || "provider"));
      throw e;
    }
    const modeloReal = modeloEfectivo || model;
    const _rn = { ok: true, narration, usage, modelUsed: model, modelo: modeloReal, modelFamilia: resolvePricingKey(modeloReal),
      costUSD: estimateCostUSD(modeloReal, usage), modelReason: routed ? routed.reason : "static:sin router" };
    _emitir(_rn);
    return _rn;
  } catch (e) {
    // LA RED DE SEGURIDAD (ver el `try`): sólo emite si ninguna rama de adentro contó ya esta llamada, y relanza.
    if (!_emitidos) _emitir({ ok: false, error: "el turno no llegó al proveedor" }, aReasonCode((e && e.message) || "unknown"));
    throw e;
  }
}

// path → handler (para los wrappers que enrutan por URL)
export const GATEWAY_ROUTES = {
  "/api/adi-spec": handleSpec,
  "/api/adi-narrate": handleNarrate,
  "/api/adi-access": handleAccess,   // demo privada · status/check/mint (owner 2026-07-08)
  "/api/adi-plan": handlePlan,       // Arquitectura C · Pasada 1 (detrás del flag · fallback intacto)
  "/api/adi-narrate-c": handleNarrateC, // Arquitectura C · Pasada 2
};
