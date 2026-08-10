/* === _llm_rate_limit_backoff_gate.mjs · GATE PERMANENTE · 429 etiquetado + backoff real ante rate-limit ===
 * owner 2026-08-03 — cierre de la investigación cruzada de los 5 gates de Arquitectura C: en TODAS las
 * investigaciones (clarify_mode/multimodo/provider_certification/plan/tension), la causa DOMINANTE de las fallas
 * observadas fue HTTP 429 real del proveedor (TPM compartido) — y ni los adapters ni answerViaOracle.js distinguían
 * un 429 de cualquier otro error de red, así que NINGÚN reintento esperaba nada antes del siguiente intento: 3
 * reintentos casi instantáneos garantizaban pegarle al MISMO minuto de cupo agotado. Este gate blinda:
 *   1. los adapters (openai.js/anthropic.js) etiquetan un 429 con `err.code="rate_limited"` (+ `err.retryAfterMs`
 *      si el proveedor lo informó vía header `retry-after`) — un error NO-429 sigue siendo un Error genérico normal.
 *   2. answerViaOracle.js (loops de PLAN y de NARRAR) espera un backoff acotado SOLO ante `rate_limited` — nunca
 *      ante cualquier otro error (eso sería enlentecer TODO el sistema en cualquier hiccup, no solo cupo agotado).
 *   3. el backoff respeta `retryAfterMs` del proveedor cuando viene, con un tope duro (2s) para no exceder
 *      presupuestos de función serverless.
 * 100% DETERMINÍSTICO — mockea `global.fetch` (adapters) y callPlan/callNarrate (answerViaOracle), sin llamar al
 * proveedor real ni depender de rate-limit real para poder probarse a sí mismo.
 */
import { openaiAdapter } from "./src/adi/llm/adapters/openai.js";
import { anthropicAdapter } from "./src/adi/llm/adapters/anthropic.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

const _origFetch = global.fetch;
function _mockFetch(status, bodyObj, headers = {}) {
  global.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    text: async () => JSON.stringify(bodyObj || { error: { message: "mock" } }),
    json: async () => bodyObj,
  });
}
function _restoreFetch() { global.fetch = _origFetch; }

console.log("── 1 · openai.js adapter — 429 etiqueta err.code=\"rate_limited\" (otros status NO) ──");
{
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-fixture-de-gate";
  _mockFetch(429, { error: { message: "Rate limit reached for gpt-4o-mini ... TPM: Limit 200000, Used 200000" } }, { "retry-after": "3" });
  try {
    await openaiAdapter.parse("hola", { system: "s", tool: { name: "t", description: "d", schema: {} }, model: "gpt-4o-mini" });
    ok(false, "debería haber lanzado (mock devuelve 429)");
  } catch (e) {
    ok(e.code === "rate_limited", `429 → err.code="rate_limited" (obtuvo "${e.code}")`);
    ok(e.retryAfterMs === 3000, `retry-after:"3" (segundos) → err.retryAfterMs=3000ms (obtuvo ${e.retryAfterMs})`);
  }

  _mockFetch(500, { error: { message: "internal error" } });
  try {
    await openaiAdapter.parse("hola", { system: "s", tool: { name: "t", description: "d", schema: {} }, model: "gpt-4o-mini" });
    ok(false, "debería haber lanzado (mock devuelve 500)");
  } catch (e) {
    ok(e.code !== "rate_limited", `500 (no rate-limit) → err.code NO es "rate_limited" (obtuvo "${e.code}")`);
  }

  _mockFetch(429, { error: { message: "rate limited, sin header" } });   // sin retry-after
  try { await openaiAdapter.parse("hola", { system: "s", tool: { name: "t", description: "d", schema: {} }, model: "gpt-4o-mini" }); ok(false, "debería lanzar"); }
  catch (e) { ok(e.code === "rate_limited" && e.retryAfterMs == null, "429 SIN header retry-after → code igual se marca, retryAfterMs queda undefined (el caller usa su default)"); }
  _restoreFetch();
}

console.log("\n── 2 · anthropic.js adapter — MISMA convención (provider-neutral, cambia el adapter, no el contrato) ──");
{
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "sk-ant-fixture-de-gate";
  _mockFetch(429, { error: { message: "rate limited" } }, { "retry-after": "2" });
  try { await anthropicAdapter.parse("hola", { system: "s", tool: { name: "t", description: "d", schema: {} }, model: "claude-haiku-4-5-20251001" }); ok(false, "debería lanzar"); }
  catch (e) { ok(e.code === "rate_limited" && e.retryAfterMs === 2000, `429 → code="rate_limited", retryAfterMs=2000 (obtuvo code="${e.code}", retryAfterMs=${e.retryAfterMs})`); }
  _restoreFetch();
}

console.log("\n── 3 · answerViaOracle.js — el backoff SOLO espera ante rate_limited, nunca ante un error genérico ──");
{
  const _rateLimitedErr = (retryAfterMs) => { const e = new Error("HTTP 429: mock"); e.code = "rate_limited"; if (retryAfterMs != null) e.retryAfterMs = retryAfterMs; return e; };
  // NOTA (owner 2026-08-03, Fase 3 ítem 11 — separación del contador de backoff vs el contador de tier de modelo):
  // estos mocks disparaban su falla mirando `attempt === 0` — válido cuando un solo contador servía para las DOS
  // cosas (backoff Y tier). Ahora el valor que answerViaOracle.js pasa como `attempt` a callPlan/callNarrate es
  // `modelAttempt`, un contador INDEPENDIENTE que NO avanza ante un 429/error de infraestructura (ver
  // answerViaOracle.js, "CONTADOR DE MODELO ≠ CONTADOR DE BACKOFF") — así que en estos casos (429 puro o error
  // genérico) `attempt` LEGÍTIMAMENTE sigue en 0 en el segundo intento también. El mock ahora dispara por CONTEO DE
  // LLAMADAS (`calls === 1`, la invocación N°1) en vez de por el valor de `attempt` — mismo comportamiento probado
  // ("la 1ª falla, la 2ª sirve"), agnóstico de qué valor de `attempt` decida enviar el motor. Las ASERCIONES en sí
  // (recuperación, backoff real, cantidad de llamadas) no cambian ni se relajan.
  console.log("\n  ▸ 3a · PLAN: error rate_limited en la 1ª llamada → espera de verdad antes de la 2ª");
  {
    let calls = 0;
    const callPlan = async () => { calls++; if (calls === 1) throw _rateLimitedErr(); return { intent: "ack", calls: [] }; };
    const callNarrate = async () => "Respuesta de prueba sin cifras ni entidades reales.";
    const t0 = Date.now();
    const r = await answerViaOracle({ text: "hola", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    const elapsed = Date.now() - t0;
    ok(!!r, "el turno SÍ se recupera (reintenta y la 2ª llamada funciona)");
    ok(calls === 2, `callPlan se invocó 2 veces (1ª falló, 2ª sirvió) — obtuvo ${calls}`);
    ok(elapsed >= 1300, `hubo una espera real de backoff (≥1.3s, default 1.5s con margen) antes del 2do intento — transcurrido ${elapsed}ms`);
  }

  console.log("\n  ▸ 3b · PLAN: error GENÉRICO (no rate-limit) en la 1ª llamada → reintenta SIN esperar (no penaliza errores ajenos a cupo)");
  {
    let calls = 0;
    const callPlan = async () => { calls++; if (calls === 1) throw new Error("timeout genérico, no es 429"); return { intent: "ack", calls: [] }; };
    const callNarrate = async () => "Respuesta de prueba sin cifras ni entidades reales.";
    const t0 = Date.now();
    const r = await answerViaOracle({ text: "hola", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    const elapsed = Date.now() - t0;
    ok(!!r, "el turno se recupera igual (reintento normal, sin relación a rate-limit)");
    ok(elapsed < 800, `SIN backoff cuando el error NO es rate_limited (transcurrido ${elapsed}ms, debe ser rápido) — nunca enlentece un error ajeno a cupo`);
  }

  console.log("\n  ▸ 3c · NARRAR: error rate_limited en la 1ª llamada → espera antes de la 2ª");
  {
    let calls = 0;
    const callPlan = async () => ({ intent: "ack", calls: [] });
    const callNarrate = async () => { calls++; if (calls === 1) throw _rateLimitedErr(); return "Respuesta de prueba sin cifras ni entidades reales."; };
    const t0 = Date.now();
    const r = await answerViaOracle({ text: "hola", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    const elapsed = Date.now() - t0;
    ok(!!r && r.r && r.r.text, "el turno se recupera (NARRAR reintenta tras el 429)");
    ok(calls === 2, `callNarrate se invocó 2 veces — obtuvo ${calls}`);
    ok(elapsed >= 1300, `backoff real antes del reintento de NARRAR (transcurrido ${elapsed}ms)`);
  }

  console.log("\n  ▸ 3d · retryAfterMs del proveedor se respeta (acotado a un tope de 2s) en vez del default fijo");
  {
    let calls = 0;
    const callPlan = async () => { calls++; if (calls === 1) throw _rateLimitedErr(200); return { intent: "ack", calls: [] }; };
    const callNarrate = async () => "Respuesta de prueba sin cifras ni entidades reales.";
    const t0 = Date.now();
    await answerViaOracle({ text: "hola", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    const elapsed = Date.now() - t0;
    ok(elapsed < 900, `retryAfterMs=200 del proveedor se honra (espera corta, NO el default de 1.5s) — transcurrido ${elapsed}ms`);
  }
  {
    let calls = 0;
    const callPlan = async () => { calls++; if (calls === 1) throw _rateLimitedErr(60000); return { intent: "ack", calls: [] }; };
    const callNarrate = async () => "Respuesta de prueba sin cifras ni entidades reales.";
    const t0 = Date.now();
    await answerViaOracle({ text: "hola", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    const elapsed = Date.now() - t0;
    ok(elapsed < 2500, `retryAfterMs=60000 (1 minuto) del proveedor se ACOTA a un tope duro de 2s, nunca bloquea el turno 1 minuto — transcurrido ${elapsed}ms`);
  }
}

console.log("\n── 4 · answerViaOracle.js — el TIER (attempt enviado a callPlan/callNarrate) NUNCA escala ante un 429 puro, SOLO ante rechazo real de contenido ──");
{
  const _rateLimitedErr = (retryAfterMs) => { const e = new Error("HTTP 429: mock"); e.code = "rate_limited"; if (retryAfterMs != null) e.retryAfterMs = retryAfterMs; return e; };

  console.log("\n  ▸ 4a · PLAN: 2 fallas rate_limited seguidas → el 3er intento SIGUE en attempt=0 (nunca escaló)");
  {
    const seenAttempts = [];
    const callPlan = async ({ attempt }) => { seenAttempts.push(attempt); if (seenAttempts.length < 3) throw _rateLimitedErr(50); return { intent: "ack", calls: [] }; };
    const callNarrate = async () => "Respuesta de prueba sin cifras ni entidades reales.";
    const r = await answerViaOracle({ text: "hola", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    ok(!!r, "el turno se recupera (3er intento, mismo tier, sirvió)");
    ok(seenAttempts.every((a) => a === 0), `TODOS los intentos vieron attempt=0 — el 429 puro NUNCA escala el tier (obtuvo ${JSON.stringify(seenAttempts)})`);
  }

  console.log("\n  ▸ 4b · PLAN: error GENÉRICO (no 429, no JSON inválido) → tampoco escala el tier (es infraestructura, no calidad)");
  {
    const seenAttempts = [];
    const callPlan = async ({ attempt }) => { seenAttempts.push(attempt); if (seenAttempts.length < 2) throw new Error("gateway no disponible"); return { intent: "ack", calls: [] }; };
    const callNarrate = async () => "Respuesta de prueba sin cifras ni entidades reales.";
    const r = await answerViaOracle({ text: "hola", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    ok(!!r, "el turno se recupera");
    ok(seenAttempts.every((a) => a === 0), `error de infraestructura genérico tampoco escala el tier (obtuvo ${JSON.stringify(seenAttempts)})`);
  }

  console.log("\n  ▸ 4c · PLAN: 'JSON inválido del tool_call' (rechazo REAL de contenido) → el 2do intento SÍ escala a attempt=1");
  {
    const seenAttempts = [];
    const callPlan = async ({ attempt }) => { seenAttempts.push(attempt); if (seenAttempts.length === 1) throw new Error("JSON inválido del tool_call: unexpected token"); return { intent: "ack", calls: [] }; };
    const callNarrate = async () => "Respuesta de prueba sin cifras ni entidades reales.";
    const r = await answerViaOracle({ text: "hola", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    ok(!!r, "el turno se recupera");
    ok(seenAttempts[0] === 0 && seenAttempts[1] === 1, `escala de 0 a 1 tras un rechazo REAL de contenido (obtuvo ${JSON.stringify(seenAttempts)})`);
  }

  console.log("\n  ▸ 4d · PLAN: plan sin 'intent' (contenido inválido, aunque no tiró excepción) → SÍ escala");
  {
    const seenAttempts = [];
    const callPlan = async ({ attempt }) => { seenAttempts.push(attempt); if (seenAttempts.length === 1) return { calls: [] }; return { intent: "ack", calls: [] }; };
    const callNarrate = async () => "Respuesta de prueba sin cifras ni entidades reales.";
    const r = await answerViaOracle({ text: "hola", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    ok(!!r, "el turno se recupera");
    ok(seenAttempts[0] === 0 && seenAttempts[1] === 1, `un plan sin 'intent' escala el tier (obtuvo ${JSON.stringify(seenAttempts)})`);
  }

  console.log("\n  ▸ 4e · NARRAR: rechazo real de guardC (cifra no autorizada) → SÍ escala el tier en el siguiente intento");
  {
    const seenAttempts = [];
    const callPlan = async () => ({ intent: "ack", calls: [] });
    const callNarrate = async ({ attempt }) => { seenAttempts.push(attempt); if (seenAttempts.length === 1) return "Esto inventa una cifra no autorizada: $9,999,999."; return "Respuesta de prueba sin cifras ni entidades reales."; };
    const r = await answerViaOracle({ text: "hola", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    ok(!!r && r.r && r.r.text, "el turno se recupera");
    ok(seenAttempts[0] === 0 && seenAttempts[1] === 1, `un rechazo real de guardC escala el tier (obtuvo ${JSON.stringify(seenAttempts)})`);
  }

  console.log("\n  ▸ 4f · NARRAR: 429 puro en el intento 1 (tras ya haber escalado por un rechazo real en el intento 0) → el tier NO retrocede ni se congela por el 429, simplemente no avanza ESE turno");
  {
    const seenAttempts = [];
    const callPlan = async () => ({ intent: "ack", calls: [] });
    const callNarrate = async ({ attempt }) => {
      seenAttempts.push(attempt);
      if (seenAttempts.length === 1) return "Esto inventa una cifra no autorizada: $9,999,999.";   // rechazo real → escala a 1
      if (seenAttempts.length === 2) throw _rateLimitedErr(50);                                     // 429 puro → NO escala
      return "Respuesta de prueba sin cifras ni entidades reales.";
    };
    const r = await answerViaOracle({ text: "hola", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    ok(!!r && r.r && r.r.text, "el turno se recupera (3 intentos: rechazo real, luego 429, luego éxito)");
    ok(seenAttempts[0] === 0 && seenAttempts[1] === 1 && seenAttempts[2] === 1, `tras escalar a 1 por el rechazo real, el 429 del 2do intento NO vuelve a escalar (queda en 1) — obtuvo ${JSON.stringify(seenAttempts)}`);
  }
}

console.log(`\n── _llm_rate_limit_backoff_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
