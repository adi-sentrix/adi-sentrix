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
import { createLedger, recordCall, tiparBoleta } from "./ledger.js";
import { TOOLS } from "./toolRegistry.js";
import { periodoDeFiguras, PERIODO_TXT } from "../../config/contract/figureType.js";
import { setToolsDeclaradas } from "../llm/telemetry.js";

// EL REGISTRO DE TOOLS SE DECLARA UNA VEZ, ACÁ (owner 2026-08-10, cierre de la certificación live). La telemetría
// necesita saber qué nombres de tool son legítimos para poder emitirlos SIN riesgo de que se le cuele un dato del
// cliente — y ese registro es `TOOLS`, que vive en toolRegistry.js. Copiarlo dentro de telemetry.js sería una
// segunda fuente que se desincroniza con la primera tool nueva; se registra desde donde está el ejecutor real.
// Efecto cero si el sink de telemetría está apagado, que es el default.
setToolsDeclaradas(Object.keys(TOOLS));

// PERÍODO/FECHA DE CORTE (owner "pase quirúrgico de confiabilidad" 2026-07-29, requisito 3: "toda respuesta
// numérica debe declarar período o fecha de corte"): UN solo punto de inyección para TODAS las tools — evita tocar
// cada composer/tool individual (eso sería el refactor amplio que el owner pidió NO hacer). `trend` ya trae su
// propio `marco_temporal` más específico (mes a mes) → no se pisa. `defineConcept` no es numérico → sin boleta,
// sin período.
//
// EL MARCO ES DE LA CIFRA, NO DE LA TOOL (owner 2026-08-09, decisión 5 · hallazgo D). Acá vivía un
// `_PERIODO_HOY = new Set(["inventoryStatus"])`: una lista de TOOLS. Fallaba en las dos direcciones, las dos
// medidas sobre el dato real:
//   · la cara Capital entera salía "año cerrado" — `queryMetric{capital}` (13/13 figs de inventario),
//     `queryMetric{rotacion}` (13/13) y `simulateCapital` (6/6) no estaban en el Set;
//   · y al revés, `inventoryStatus{top_sellers}` estampaba "foto de inventario a hoy" sobre 5 figs de VENTA ANUAL.
// Mover tools de una lista a la otra no arregla ninguno de los dos: la fila completa de un SKU (`entityRecord`)
// es genuinamente MIXTA. El marco sale ahora del TIPO de cada cifra (`figureType.UNIVERSOS[x].periodo`, el mismo
// que ya declara moneda y escala), leyendo las figs YA TIPADAS que el ledger va a grabar — no una segunda pasada.
// `facts.periodos` viaja estructurado al lado del texto para que ningún consumidor tenga que leer la frase con un
// regex; `facts.periodo` sigue siendo la frase canónica, y para un resultado mixto NOMBRA LOS DOS marcos.
function _stampPeriodo(res, figsTipadas) {
  if (!res || !res.facts || res.facts.periodo || res.facts.marco_temporal) return;
  if (!Array.isArray(res.boleta) || !res.boleta.length) return;   // sin cifras reales → no aplica
  const { familias, texto } = periodoDeFiguras(figsTipadas);
  // ninguna cifra declara marco (un resultado de puros conteos: un conteo hereda el marco de lo que cuenta y por
  // eso su universo no declara período) → queda el marco del negocio, que es el que este punto ya estampaba.
  res.facts.periodo = texto || PERIODO_TXT.anual;
  res.facts.periodos = familias.length ? familias : ["anual"];
}

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
    // el tipado corre UNA vez: lo necesita el período (la naturaleza de cada cifra) y es lo mismo que el ledger graba.
    const meta = { tool: name, callId, scope, args };
    const figsTipadas = tiparBoleta(meta, res);
    _stampPeriodo(res, figsTipadas);
    recordCall(ledger, meta, res, figsTipadas);
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
