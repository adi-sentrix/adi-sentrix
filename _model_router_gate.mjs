/* === _model_router_gate.mjs · GATE del ROUTER DETERMINÍSTICO de modelo por turno (owner 2026-08-02) ===
 * Bloquea en disco la corrección de src/adi/llm/modelRouter.js (chooseModel) + su cableado real en
 * src/adi/llm/gatewayCore.js (handlePlan/handleNarrateC) + el threading de `attempt` en los DOS loops de
 * reintentos de src/adi/oracle/answerViaOracle.js (PLAN y NARRAR) — ver el comentario de cabecera de
 * modelRouter.js para el porqué del diseño (rutea por REINTENTO, no por modo/contrato: mini es el piso barato,
 * terra/sol son escalamiento SOLO cuando guardC/el schema ya rechazó el intento anterior).
 *
 * TODO determinístico, TODO mockeado, CERO llamadas de red real:
 *   1-4 · chooseModel se importa y se prueba DIRECTO (función pura, sin mock necesario).
 *   5   · gatewayCore.handlePlan/handleNarrateC se ejecutan DE VERDAD extremo a extremo (builders/guards reales)
 *       pero con ADAPTERS.openai.parse/narrate MONKEY-PATCHEADOS a nivel de módulo — providerAdapter.js exporta
 *       `ADAPTERS` como objeto mutable y ES modules cachea una ÚNICA instancia por proceso, así que el mismo
 *       objeto que gatewayCore.js referencia internamente (vía getAdapter) es el que este archivo importa y
 *       parcha acá: interceptar .parse/.narrate intercepta EXACTAMENTE lo que vería la llamada real, sin tocar
 *       fetch ni la key, y sin necesitar ningún framework de mocking. Se restauran los originales al final.
 *   6-9 · answerViaOracle.js — callPlan/callNarrate son INYECTADOS (mismo mecanismo que ya usa
 *       _oracle_plan_retry_gate.mjs, léelo primero si esto no es obvio): se mockean para forzar rechazos
 *       controlados y verificar que `attempt` viaja 0,1,2 EN ORDEN, y que retryTrace refleja el veredicto REAL
 *       de guardC (la narración con cifra inventada corre por el guardC de PRODUCCIÓN, no uno simulado).
 *   10  · modelPricing.js (bonus, no pedido explícitamente pero directamente ligado: el router elige un tier,
 *       modelPricing le pone precio — un tier sin precio conocido deja el costo mudo en prod).
 *
 * Uso: node _model_router_gate.mjs   (exit 1 si algún test falla)
 */
import { chooseModel } from "./src/adi/llm/modelRouter.js";
import { MODEL_PRICING, estimateCostUSD } from "./src/adi/llm/modelPricing.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { ADAPTERS } from "./src/adi/llm/providerAdapter.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

const OK_PLAN = { intent: "ack", calls: [] };

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · chooseModel — tiers puros (sin mock, función pura) ──");
{
  const tier1 = "gpt-4o-mini";
  const base = { provider: "openai", tier1, step: "plan", env: {} };

  let r = chooseModel({ ...base, attempt: 0 });
  ok(r && r.model === tier1 && r.tier === 1, `attempt 0 → tier1 (${tier1}) — obtuvo ${JSON.stringify(r)}`);

  r = chooseModel({ ...base });   // attempt OMITIDO del todo (ni siquiera la clave)
  ok(r && r.model === tier1 && r.tier === 1, `attempt omitido (falsy) → tier1, igual que attempt 0 — obtuvo ${JSON.stringify(r)}`);

  r = chooseModel({ ...base, attempt: 1 });
  ok(r && r.model === "gpt-5.6-terra" && r.tier === 2, `attempt 1 → tier2 default (gpt-5.6-terra) — obtuvo ${JSON.stringify(r)}`);
  ok(r.reason.startsWith("tier2:"), `reason del tier2 empieza con "tier2:" — obtuvo "${r.reason}"`);

  r = chooseModel({ ...base, attempt: 2 });
  ok(r && r.model === "gpt-5.6-sol" && r.tier === 3, `attempt 2 → tier3 default (gpt-5.6-sol) — obtuvo ${JSON.stringify(r)}`);
  ok(r.reason.startsWith("tier3:"), `reason del tier3 empieza con "tier3:" — obtuvo "${r.reason}"`);

  r = chooseModel({ ...base, attempt: 10 });
  ok(r && r.model === "gpt-5.6-sol" && r.tier === 3, `attempt MUY fuera de rango (10) → sigue en tier3, nunca undefined/throw — obtuvo ${JSON.stringify(r)}`);

  r = chooseModel({ ...base, attempt: 0 });
  ok(typeof r.reason === "string" && r.reason.startsWith("tier1:"), `reason del tier1 es string y empieza con "tier1:" — obtuvo "${r.reason}"`);
}

console.log("\n── 2 · chooseModel — provider ≠ \"openai\" → null SIEMPRE, sin importar attempt ──");
{
  for (const attempt of [0, 1, 2, 10]) {
    const r = chooseModel({ provider: "anthropic", tier1: "claude-x", attempt, step: "plan", env: {} });
    ok(r === null, `provider=anthropic, attempt=${attempt} → null — obtuvo ${JSON.stringify(r)}`);
  }
  const rStub = chooseModel({ provider: "local", tier1: "local-x", attempt: 1, step: "narrate", env: {} });
  ok(rStub === null, `provider=local (stub), attempt=1 → null también — obtuvo ${JSON.stringify(rStub)}`);
}

console.log("\n── 3 · chooseModel — kill-switch LLM_ROUTER_ENABLED=\"false\" → null SIEMPRE ──");
{
  for (const attempt of [0, 1, 2]) {
    const r = chooseModel({ provider: "openai", tier1: "gpt-4o-mini", attempt, step: "narrate", env: { LLM_ROUTER_ENABLED: "false" } });
    ok(r === null, `router apagado, attempt=${attempt} → null — obtuvo ${JSON.stringify(r)}`);
  }
  // control: mismo provider openai, pero SIN el kill-switch (o en "true") — el router sigue activo. Confirma que
  // el null de arriba es POR el kill-switch, no por otra razón incidental (ej. un typo en "openai").
  const rOn = chooseModel({ provider: "openai", tier1: "gpt-4o-mini", attempt: 1, step: "narrate", env: { LLM_ROUTER_ENABLED: "true" } });
  ok(rOn && rOn.model === "gpt-5.6-terra", `control — LLM_ROUTER_ENABLED="true" deja el router activo — obtuvo ${JSON.stringify(rOn)}`);
  const rDefault = chooseModel({ provider: "openai", tier1: "gpt-4o-mini", attempt: 1, step: "narrate", env: {} });
  ok(rDefault && rDefault.model === "gpt-5.6-terra", `control — sin la variable seteada, el router sigue activo (default ON) — obtuvo ${JSON.stringify(rDefault)}`);
}

console.log("\n── 4 · chooseModel — LLM_MODEL_TIER2 / LLM_MODEL_TIER3 overridean el default ──");
{
  const env = { LLM_MODEL_TIER2: "gpt-5.6-terra-custom", LLM_MODEL_TIER3: "gpt-5.6-sol-custom" };
  let r = chooseModel({ provider: "openai", tier1: "gpt-4o-mini", attempt: 1, step: "plan", env });
  ok(r && r.model === "gpt-5.6-terra-custom" && r.tier === 2, `LLM_MODEL_TIER2 override aplica en attempt 1 — obtuvo ${JSON.stringify(r)}`);
  r = chooseModel({ provider: "openai", tier1: "gpt-4o-mini", attempt: 2, step: "plan", env });
  ok(r && r.model === "gpt-5.6-sol-custom" && r.tier === 3, `LLM_MODEL_TIER3 override aplica en attempt 2 — obtuvo ${JSON.stringify(r)}`);
  r = chooseModel({ provider: "openai", tier1: "gpt-4o-mini", attempt: 0, step: "plan", env });
  ok(r && r.model === "gpt-4o-mini" && r.tier === 1, `attempt 0 ignora los overrides de TIER2/TIER3 (sigue en tier1 tal cual) — obtuvo ${JSON.stringify(r)}`);
}

console.log("\n── 5 · gatewayCore.js — handlePlan/handleNarrateC INVOCAN chooseModel de verdad y su resultado llega al adapter (ADAPTERS.openai mockeado a nivel de módulo, CERO red) ──");
{
  const origParse = ADAPTERS.openai.parse;
  const origNarrate = ADAPTERS.openai.narrate;
  const capturedPlanModels = [];
  const capturedNarrateModels = [];
  ADAPTERS.openai.parse = async (_user, opts) => { capturedPlanModels.push(opts.model); return { spec: { intent: "ack", calls: [] }, usage: { input_tokens: 10, output_tokens: 5 } }; };
  ADAPTERS.openai.narrate = async (_payload, opts) => { capturedNarrateModels.push(opts.model); return { text: "narración mockeada", usage: { input_tokens: 10, output_tokens: 5 } }; };

  const envBase = { LLM_PROVIDER: "openai", LLM_MODEL_PARSE: "gpt-4o-mini", LLM_MODEL_NARRATE: "gpt-4o-mini" };

  try {
    let r = await handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 0 }, envBase);
    ok(r.ok && r.modelUsed === "gpt-4o-mini" && capturedPlanModels.at(-1) === "gpt-4o-mini", `handlePlan attempt=0 → adapter.parse recibió tier1 (gpt-4o-mini) — modelUsed=${r.modelUsed}, adapter vio=${capturedPlanModels.at(-1)}`);
    ok(r.modelReason && r.modelReason.startsWith("tier1:"), `handlePlan attempt=0 → modelReason empieza con "tier1:" — obtuvo "${r.modelReason}"`);

    r = await handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 1 }, envBase);
    ok(r.ok && r.modelUsed === "gpt-5.6-terra" && capturedPlanModels.at(-1) === "gpt-5.6-terra", `handlePlan attempt=1 → adapter.parse recibió tier2 (gpt-5.6-terra) — modelUsed=${r.modelUsed}, adapter vio=${capturedPlanModels.at(-1)}`);

    r = await handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 2 }, envBase);
    ok(r.ok && r.modelUsed === "gpt-5.6-sol" && capturedPlanModels.at(-1) === "gpt-5.6-sol", `handlePlan attempt=2 → adapter.parse recibió tier3 (gpt-5.6-sol) — modelUsed=${r.modelUsed}, adapter vio=${capturedPlanModels.at(-1)}`);

    r = await handleNarrateC({ payload: { text: "hola", modo: "default" }, mem: {}, attempt: 0 }, envBase);
    ok(r.ok && r.modelUsed === "gpt-4o-mini" && capturedNarrateModels.at(-1) === "gpt-4o-mini", `handleNarrateC attempt=0 → adapter.narrate recibió tier1 — modelUsed=${r.modelUsed}, adapter vio=${capturedNarrateModels.at(-1)}`);

    r = await handleNarrateC({ payload: { text: "hola", modo: "default" }, mem: {}, attempt: 1 }, envBase);
    ok(r.ok && r.modelUsed === "gpt-5.6-terra" && capturedNarrateModels.at(-1) === "gpt-5.6-terra", `handleNarrateC attempt=1 → adapter.narrate recibió tier2 — modelUsed=${r.modelUsed}, adapter vio=${capturedNarrateModels.at(-1)}`);

    r = await handleNarrateC({ payload: { text: "hola", modo: "default" }, mem: {}, attempt: 2 }, envBase);
    ok(r.ok && r.modelUsed === "gpt-5.6-sol" && capturedNarrateModels.at(-1) === "gpt-5.6-sol", `handleNarrateC attempt=2 → adapter.narrate recibió tier3 — modelUsed=${r.modelUsed}, adapter vio=${capturedNarrateModels.at(-1)}`);

    // kill-switch de PRODUCCIÓN de punta a punta: LLM_ROUTER_ENABLED=false → chooseModel null dentro de
    // handlePlan/handleNarrateC → caen a tier1 SIEMPRE (ignoran attempt), modelReason="static:sin router".
    const envKilled = { ...envBase, LLM_ROUTER_ENABLED: "false" };
    r = await handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 1 }, envKilled);
    ok(r.ok && r.modelUsed === "gpt-4o-mini" && r.modelReason === "static:sin router" && capturedPlanModels.at(-1) === "gpt-4o-mini", `handlePlan con router apagado ignora attempt=1 (sigue en tier1) — modelUsed=${r.modelUsed}, modelReason="${r.modelReason}"`);

    r = await handleNarrateC({ payload: { text: "hola", modo: "default" }, mem: {}, attempt: 2 }, envKilled);
    ok(r.ok && r.modelUsed === "gpt-4o-mini" && r.modelReason === "static:sin router" && capturedNarrateModels.at(-1) === "gpt-4o-mini", `handleNarrateC con router apagado ignora attempt=2 (sigue en tier1) — modelUsed=${r.modelUsed}, modelReason="${r.modelReason}"`);

    // override de env viaja de punta a punta hasta el adapter real (no solo dentro de chooseModel aislado)
    const envCustomTier2 = { ...envBase, LLM_MODEL_TIER2: "custom-terra-e2e" };
    r = await handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 1 }, envCustomTier2);
    ok(r.ok && r.modelUsed === "custom-terra-e2e" && capturedPlanModels.at(-1) === "custom-terra-e2e", `handlePlan respeta LLM_MODEL_TIER2 override de punta a punta — modelUsed=${r.modelUsed}`);
  } finally {
    ADAPTERS.openai.parse = origParse;
    ADAPTERS.openai.narrate = origNarrate;
  }
}

console.log("\n── 6 · answerViaOracle.js — el loop de PLAN pasa `attempt` 0,1,2 a callPlan EN ORDEN (2 fallas forzadas + éxito) ──");
{
  const seenAttempts = [];
  const callPlan = async ({ attempt }) => {
    seenAttempts.push(attempt);
    if (seenAttempts.length <= 2) throw new Error("JSON inválido del tool_call: fallo forzado por el gate");
    return OK_PLAN;
  };
  const callNarrate = async () => "Listo, quedó anotado.";
  const r = await answerViaOracle({ text: "hola", callPlan, callNarrate, scenario: "actual" });
  ok(JSON.stringify(seenAttempts) === JSON.stringify([0, 1, 2]), `callPlan recibió attempt en el orden 0,1,2 — obtuvo ${JSON.stringify(seenAttempts)}`);
  ok(r && r.r && r.r.route === "oracle", `recupera en el intento 3 y responde route=oracle`);
  const planTrace = r && r.r && r.r.retryTrace && r.r.retryTrace.plan;
  ok(Array.isArray(planTrace) && planTrace.length === 3, `retryTrace.plan trae exactamente 3 entradas — obtuvo ${JSON.stringify(planTrace)}`);
  ok(!!planTrace && planTrace[0].attempt === 0 && planTrace[0].ok === false, `retryTrace.plan[0] = intento 0, ok=false — obtuvo ${JSON.stringify(planTrace && planTrace[0])}`);
  ok(!!planTrace && planTrace[1].attempt === 1 && planTrace[1].ok === false, `retryTrace.plan[1] = intento 1, ok=false — obtuvo ${JSON.stringify(planTrace && planTrace[1])}`);
  ok(!!planTrace && planTrace[2].attempt === 2 && planTrace[2].ok === true, `retryTrace.plan[2] = intento 2, ok=true — obtuvo ${JSON.stringify(planTrace && planTrace[2])}`);
}

console.log("\n── 7 · answerViaOracle.js — el loop de NARRAR pasa `attempt` 0,1,2 a callNarrate Y guardC REAL rechaza la cifra inventada en los 2 primeros, acepta el 3º ──");
{
  const BAD1 = "Además hay un extra oculto de $999M que conviene mirar.";
  const BAD2 = "También aparece un excedente de $888M que no está en la boleta.";
  const GOOD = "Listo, quedó anotado.";
  const seenAttempts = [];
  const callNarrate = async ({ attempt }) => {
    seenAttempts.push(attempt);
    if (attempt === 0) return BAD1;
    if (attempt === 1) return BAD2;
    return GOOD;
  };
  const r = await answerViaOracle({ text: "hola", callPlan: async () => OK_PLAN, callNarrate, scenario: "actual" });
  ok(JSON.stringify(seenAttempts) === JSON.stringify([0, 1, 2]), `callNarrate recibió attempt en el orden 0,1,2 — obtuvo ${JSON.stringify(seenAttempts)}`);
  ok(r && r.r && r.r.text === GOOD, `r.text es la narración del intento 2 (la única que pasó guardC) — obtuvo "${r && r.r && r.r.text}"`);
  const trace = r && r.r && r.r.retryTrace && r.r.retryTrace.narrate;
  ok(Array.isArray(trace) && trace.length === 3, `retryTrace.narrate trae exactamente 3 entradas — obtuvo ${JSON.stringify(trace)}`);
  ok(!!trace && trace[0].attempt === 0 && trace[0].guardOk === false, `intento 0 rechazado por guardC — obtuvo ${JSON.stringify(trace && trace[0])}`);
  ok(!!trace && trace[1].attempt === 1 && trace[1].guardOk === false, `intento 1 rechazado por guardC — obtuvo ${JSON.stringify(trace && trace[1])}`);
  ok(!!trace && trace[2].attempt === 2 && trace[2].guardOk === true && trace[2].reason === null, `intento 2 aceptado por guardC, reason=null — obtuvo ${JSON.stringify(trace && trace[2])}`);
  ok(!!trace && trace[0].reason === "cifra-no-autorizada" && trace[1].reason === "cifra-no-autorizada", `el motivo de rechazo es del guardC REAL (no simulado): "cifra-no-autorizada" en ambos intentos fallidos — obtuvo [${trace && trace[0] && trace[0].reason}, ${trace && trace[1] && trace[1].reason}]`);
}

console.log("\n── 8 · answerViaOracle.js — camino feliz: intento 0 YA pasa guardC → retryTrace.narrate con UNA sola entrada (cero reintentos fantasma) ──");
{
  let calls = 0;
  const callNarrate = async () => { calls++; return "Listo, quedó anotado."; };
  const r = await answerViaOracle({ text: "hola", callPlan: async () => OK_PLAN, callNarrate, scenario: "actual" });
  ok(calls === 1, `callNarrate se llamó UNA sola vez (no reintentó sin necesidad) — obtuvo ${calls}`);
  const trace = r && r.r && r.r.retryTrace && r.r.retryTrace.narrate;
  ok(Array.isArray(trace) && trace.length === 1, `retryTrace.narrate trae EXACTAMENTE 1 entrada — obtuvo ${JSON.stringify(trace)}`);
  ok(!!trace && trace[0].attempt === 0 && trace[0].guardOk === true && trace[0].reason === null, `retryTrace.narrate[0] = {attempt:0, guardOk:true, reason:null} — obtuvo ${JSON.stringify(trace && trace[0])}`);
}

console.log("\n── 9 · compatibilidad retro — un mock VIEJO que NO desestructura `attempt` (patrón pre-router) sigue funcionando sin romperse ──");
{
  // mismo patrón "CONTROL" que el caso 5 de _oracle_plan_retry_gate.mjs: callPlan/callNarrate que ignoran
  // CUALQUIER argumento — así lucía el mock ANTES de que answerViaOracle.js empezara a pasar `attempt`. Si el
  // código nuevo exigiera de alguna forma que el caller lea `attempt`, este escenario rompería.
  const callPlan = async () => ({ intent: "ack", calls: [] });
  const callNarrate = async () => "Listo, quedó anotado.";
  const r = await answerViaOracle({ text: "hola", callPlan, callNarrate, scenario: "actual" });
  ok(r && r.r && r.r.route === "oracle", `mock que ignora attempt del todo NO rompe — responde route=oracle`);
  ok(r && r.r && r.r.text === "Listo, quedó anotado.", `r.text es exactamente lo que devolvió el mock viejo — obtuvo "${r && r.r && r.r.text}"`);
}

console.log("\n── 10 · modelPricing.js (bonus) — MODEL_PRICING / estimateCostUSD, ligado directo al router (un tier sin precio queda mudo en prod) ──");
{
  ok(!!MODEL_PRICING["gpt-4o-mini"] && typeof MODEL_PRICING["gpt-4o-mini"].in === "number" && typeof MODEL_PRICING["gpt-4o-mini"].out === "number", `MODEL_PRICING trae "gpt-4o-mini" (tier1 default) con in/out numéricos`);
  ok(!!MODEL_PRICING["gpt-5.6-terra"] && typeof MODEL_PRICING["gpt-5.6-terra"].in === "number", `MODEL_PRICING trae "gpt-5.6-terra" (DEFAULT_TIER2 del router)`);
  ok(!!MODEL_PRICING["gpt-5.6-sol"] && typeof MODEL_PRICING["gpt-5.6-sol"].in === "number", `MODEL_PRICING trae "gpt-5.6-sol" (DEFAULT_TIER3 del router)`);

  // cruce real contra el router: los modelos que chooseModel() REALMENTE elige hoy para tier2/tier3 tienen precio.
  const t2 = chooseModel({ provider: "openai", tier1: "gpt-4o-mini", attempt: 1, step: "plan", env: {} });
  const t3 = chooseModel({ provider: "openai", tier1: "gpt-4o-mini", attempt: 2, step: "plan", env: {} });
  ok(!!MODEL_PRICING[t2.model], `el modelo tier2 que el router elige HOY ("${t2.model}") tiene precio conocido`);
  ok(!!MODEL_PRICING[t3.model], `el modelo tier3 que el router elige HOY ("${t3.model}") tiene precio conocido`);

  const cost = estimateCostUSD("gpt-4o-mini", { input_tokens: 1000000, output_tokens: 1000000 });
  const expected = MODEL_PRICING["gpt-4o-mini"].in + MODEL_PRICING["gpt-4o-mini"].out;
  ok(Math.abs(cost - expected) < 1e-9, `estimateCostUSD exacto (1M in + 1M out de gpt-4o-mini = $${expected}) — obtuvo ${cost}`);

  const cost2 = estimateCostUSD("gpt-4o-mini", { input_tokens: 500000, output_tokens: 200000 });
  const expected2 = (500000 / 1e6) * MODEL_PRICING["gpt-4o-mini"].in + (200000 / 1e6) * MODEL_PRICING["gpt-4o-mini"].out;
  ok(Math.abs(cost2 - expected2) < 1e-9, `estimateCostUSD con tokens parciales — obtuvo ${cost2}, esperado ${expected2}`);

  ok(estimateCostUSD("modelo-inexistente-xyz", { input_tokens: 100, output_tokens: 100 }) === null, `modelo sin precio conocido → null (nunca inventa un precio)`);
  ok(estimateCostUSD("gpt-4o-mini", null) === null, `usage null (falsy) → null`);
  ok(estimateCostUSD("gpt-4o-mini", undefined) === null, `usage undefined (falsy) → null`);
  ok(estimateCostUSD("gpt-4o-mini", { input_tokens: 0, output_tokens: 0 }) === 0, `usage con ceros (objeto TRUTHY, valores en 0) → 0 exacto, NO null`);
}

console.log("\n── 11 · gatewayCore.js — presupuesto de escalamiento por tenant (hallazgo de auditoría 2026-08-02): un caller que manda attempt≥1 en CADA llamada se degrada a tier1 tras el tope, nunca revienta ──");
{
  const origParse = ADAPTERS.openai.parse;
  ADAPTERS.openai.parse = async (_user, opts) => ({ spec: { intent: "ack", calls: [] }, usage: { input_tokens: 10, output_tokens: 5 }, _seenModel: opts.model });
  try {
    const env = { LLM_PROVIDER: "openai", LLM_MODEL_PARSE: "gpt-4o-mini", LLM_TIER_BUDGET_MAX_PER_WINDOW: "3" };
    const tenantId = "tenant_gate_presupuesto";
    const seen = [];
    for (let i = 0; i < 5; i++) {
      const r = await handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 2, tenantId }, env);
      seen.push(r.modelUsed);
    }
    ok(seen.slice(0, 3).every((m) => m === "gpt-5.6-sol"), `las primeras 3 llamadas (dentro del presupuesto) SÍ escalan a tier3 — obtuvo ${JSON.stringify(seen.slice(0, 3))}`);
    ok(seen.slice(3).every((m) => m === "gpt-4o-mini"), `la 4ª y 5ª llamada (presupuesto excedido) se DEGRADAN a tier1, nunca fallan — obtuvo ${JSON.stringify(seen.slice(3))}`);

    // control: OTRO tenant en la MISMA ventana no está afectado por el consumo del primero (el freno es POR TENANT)
    const rOtro = await handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 2, tenantId: "tenant_gate_otro" }, env);
    ok(rOtro.modelUsed === "gpt-5.6-sol", `un tenant DISTINTO no hereda el presupuesto agotado del primero — obtuvo ${rOtro.modelUsed}`);

    // control: attempt=0 (tier1) NUNCA consume presupuesto ni se ve afectado por él, sin importar cuántas veces se llame
    const envChico = { ...env, LLM_TIER_BUDGET_MAX_PER_WINDOW: "1" };
    let tier1SigueOk = true;
    for (let i = 0; i < 4; i++) {
      const r = await handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 0, tenantId: "tenant_gate_tier1" }, envChico);
      if (r.modelUsed !== "gpt-4o-mini") tier1SigueOk = false;
    }
    ok(tier1SigueOk, `attempt=0 (tier1) nunca se ve afectado por el presupuesto de escalamiento, ni con un tope de 1`);
  } finally { ADAPTERS.openai.parse = origParse; }
}

console.log("\n── 12 · answerViaOracle.js — hallazgo de auditoría 2026-08-02: si callNarrate TIRA (ej. tier2 sin cupo/con hiccup de red) el turno se RECUPERA en el siguiente intento, ya no aborta con return null ──");
{
  // NOTA (owner 2026-08-03, Fase 3 ítem 11 — separación del contador de backoff vs el contador de tier de modelo,
  // ver _llm_rate_limit_backoff_gate.mjs): el mock antes disparaba mirando `attempt === 0` — válido cuando un solo
  // contador servía para reintento Y tier. Un error de red/gateway GENÉRICO (no un 429, no un rechazo real de
  // contenido) ahora NUNCA escala el `modelAttempt` que answerViaOracle.js le pasa a callNarrate (es infraestructura,
  // no calidad del modelo) — así que `attempt` LEGÍTIMAMENTE sigue en 0 en el reintento. Dispara por CONTEO DE
  // LLAMADAS en su lugar (mismo comportamiento probado: "la 1ª falla, la 2ª sirve").
  let calls = 0;
  const callNarrate = async () => {
    calls++;
    if (calls === 1) throw new Error("simulado: falla de red/gateway en el intento escalado");
    return "Listo, quedó anotado.";
  };
  const r = await answerViaOracle({ text: "hola", callPlan: async () => OK_PLAN, callNarrate, scenario: "actual" });
  ok(calls === 2, `callNarrate se reintentó tras el error (no se abortó en el primer throw) — obtuvo ${calls} llamadas`);
  ok(r !== null, `el turno se RECUPERA (no vuelve null) — obtuvo ${r === null ? "null" : "objeto válido"}`);
  ok(!!r && r.r && r.r.text === "Listo, quedó anotado.", `r.text es la narración del intento que sí funcionó — obtuvo "${r && r.r && r.r.text}"`);
  const trace = r && r.r && r.r.retryTrace && r.r.retryTrace.narrate;
  ok(!!trace && trace[0].attempt === 0 && trace[0].guardOk === null && /error de red/.test(trace[0].reason || ""), `retryTrace.narrate[0] registra el error (guardOk=null, reason menciona la falla) — obtuvo ${JSON.stringify(trace && trace[0])}`);

  // control REGRESIÓN — corregido tras correrlo (mi primera suposición de "null" era incorrecta, el comportamiento
  // REAL es mejor: NUNCA abstención silenciosa, ver la REPARACIÓN CONTROLADA en answerViaOracle.js): si LOS 3
  // intentos de NARRAR tiran, el loop se agota sin `narration`, y el turno cae a composeNoDataMessage — un mensaje
  // honesto compuesto DETERMINÍSTICAMENTE (nunca del LLM que ya falló 3 veces), NO un null que perdería el turno.
  const callNarrateSiempreFalla = async () => { throw new Error("simulado: falla persistente en los 3 intentos"); };
  const r2 = await answerViaOracle({ text: "hola", callPlan: async () => OK_PLAN, callNarrate: callNarrateSiempreFalla, scenario: "actual" });
  ok(r2 !== null, `si LOS 3 intentos tiran, el turno NO se pierde (nunca null) — cae a la reparación controlada — obtuvo ${r2 === null ? "null" : "objeto válido"}`);
  ok(!!r2 && r2.r && r2.r.narrationRepaired === true, `queda marcado narrationRepaired=true (telemetría: el narrador libre NUNCA corrió con éxito este turno) — obtuvo ${JSON.stringify(r2 && r2.r && r2.r.narrationRepaired)}`);
  ok(!!r2 && r2.r && typeof r2.r.text === "string" && r2.r.text.length > 0, `r.text es un mensaje honesto no vacío (composeNoDataMessage), no un texto inventado — obtuvo "${r2 && r2.r && r2.r.text}"`);
  const trace2 = r2 && r2.r && r2.r.retryTrace && r2.r.retryTrace.narrate;
  ok(Array.isArray(trace2) && trace2.length === 3 && trace2.every((t) => t.guardOk === null), `retryTrace.narrate registra los 3 intentos fallidos (guardOk=null en los 3, ninguno llegó a evaluarse por guardC) — obtuvo ${JSON.stringify(trace2)}`);
}

console.log(`\n── _model_router_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
