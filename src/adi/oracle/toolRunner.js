/* === src/adi/oracle/toolRunner.js · ARQUITECTURA C · EJECUTOR DEL PLAN (batch determinístico) ===
 * Fase 0 (andamio en sombra). El PLAN lo produce el LLM libre en la Pasada 1 (Fase 3); acá ejecutamos su BATCH:
 *   plan = { intent, rationale?, calls: [ { tool, args } ] }
 * Corre cada call contra el catálogo (TOOLS), acumula sus fig() en un LEDGER con procedencia, y devuelve el trace.
 *
 * PURO y CACHEABLE: mismo plan + mismo scenario → mismo ledger (byte-igual). Una call que falla NO tumba el turno:
 * degrada a coverage.supported=false y el LLM lo lee. Esta es la mitad DETERMINÍSTICA de C (la testeable byte-a-byte).
 *
 * NO importado por el pipeline vivo en Fase 0: se ejercita solo desde el arnés de sombra (_oracle_shadow.mjs).
 */
import { createLedger, recordCall } from "./ledger.js";
import { TOOLS } from "./toolRegistry.js";

// runPlan(plan, opts) → { ledger, results, trace, unsupported }
//   opts.scenario   escenario base de las tools (default "actual")
//   opts.maxCalls   cap DURO de tool-calls por plan (costo/latencia · plan patológico) · default 8
export function runPlan(plan, { scenario = "actual", maxCalls = 8 } = {}) {
  const ledger = createLedger();
  const results = [];
  const unsupported = [];
  const all = (plan && Array.isArray(plan.calls)) ? plan.calls : [];
  const calls = all.slice(0, Math.max(0, maxCalls));   // cap duro (el resto se reporta como recortado)
  const dropped = all.length - calls.length;

  calls.forEach((call, i) => {
    const callId = `c${i}`;
    const name = call && call.tool;
    const tool = name && TOOLS[name];
    // ARGS TOLERANTE: el modelo a veces emite los args APLANADOS ({tool:"trend", metric:"ventas", entity:"Falabella"})
    // en vez de anidados en `args`. Antes se descartaban en silencio y la tool corría con sus DEFAULTS → respondía
    // OTRA pregunta con cifras reales (el modo de falla más peligroso: "Falabella mes a mes" narraba el negocio).
    // Acá recuperamos las keys sueltas (todo lo que no sea `tool`/`args`), sin pisar lo que venga en `args`.
    const _flat = call && typeof call === "object"
      ? Object.fromEntries(Object.entries(call).filter(([k]) => k !== "tool" && k !== "args"))
      : {};
    const callArgs = { ..._flat, ...((call && call.args) || {}) };
    const scope = callArgs.scope || callArgs.dimension || callArgs.entity || null;
    if (typeof tool !== "function") {
      const res = { facts: null, boleta: [], coverage: { supported: false, reason: `tool desconocida: '${name}'` } };
      recordCall(ledger, { tool: name || "?", callId, scope, args: callArgs }, res);
      results.push({ callId, tool: name || null, ...res });
      unsupported.push({ callId, tool: name || null, reason: res.coverage.reason });
      return;
    }
    const args = { scenario, ...callArgs };
    let res;
    try {
      res = tool(args);
    } catch (e) {
      res = { facts: null, boleta: [], coverage: { supported: false, reason: `error en tool '${name}': ${String((e && e.message) || e)}` } };
    }
    if (!res || typeof res !== "object") res = { facts: null, boleta: [], coverage: { supported: false, reason: "tool sin resultado" } };
    recordCall(ledger, { tool: name, callId, scope, args }, res);
    results.push({ callId, tool: name, ...res });
    if (!res.coverage || res.coverage.supported === false) unsupported.push({ callId, tool: name, reason: res.coverage && res.coverage.reason });
  });

  return {
    ledger,
    results,
    unsupported,
    trace: {
      intent: (plan && plan.intent) || null,
      calls: results.map((r) => ({ callId: r.callId, tool: r.tool, figCount: (r.boleta || []).length, supported: !!(r.coverage && r.coverage.supported) })),
      droppedByCap: dropped > 0 ? dropped : 0,
    },
  };
}
