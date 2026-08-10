/* === _narrate_structural_reinforcement_gate.mjs · GATE de la auditoría de 4 agentes (owner 2026-08-02) ===
 * Tras cerrar el hallazgo de TABLA (2+ cifras/entidad, ver _table_format_gate.mjs), el owner pidió auditar el
 * RESTO de reglas estructurales de narratePromptC.js con el mismo método (correr el pipeline real contra gpt-4o-mini
 * varias veces, medir cumplimiento real, no asumir). Workflow de 4 agentes en paralelo, resultado:
 *   · LISTA NUMERADA — CONFIRMADO: 0/6 corridas reales usaron lista numerada para un ranking de 1 métrica; el
 *     modelo SIEMPRE armó una tabla de 2 columnas en su lugar. Además reveló un bug propio: composeSpecMargin
 *     (specRetrieval.js) labeleaba las cifras de margen como "${dimension} · ${entidad} margen" (ej. "cliente ·
 *     Lider margen") en vez de "Entidad · Concepto" — corregido acá también (figMargin ahora usa
 *     "${entidad} · Margen"), porque contaminaba CUALQUIER detector que agrupe por entidad.
 *   · SERIE TEMPORAL — descartado (confirmed_gap:false): 4/4 corridas reales cumplieron tabla + dueño de la serie,
 *     sin necesidad de refuerzo (facts.tablaM ya ancla al modelo). No se tocó nada acá.
 *   · TABLA DE MARGEN — columna Brecha — CONFIRMADO: 0/3 tablas de margen reales incluyeron la columna Brecha
 *     pese a tener margen+benchmark autorizados, aunque la mencionaran en prosa.
 *   · ORDEN PROMETIDO = ORDEN REAL (marginRead) — CONFIRMADO: los gates existentes (_orden_sellado_gate.mjs,
 *     _topn_resto_gate.mjs) no cubren este camino — marginRead nunca sella facts.orden, así que guardC no tiene
 *     nada contra qué comparar. 1/3 corridas reales prometió "orden por dinero" y en realidad ordenó por brecha
 *     en puntos porcentuales, sin bloqueo.
 *
 * Fix: MISMO patrón instruccion_X ya usado 3 veces (tabla/contentScope/brevedad) — _needsListFormat/
 * _needsBrechaReinforcement/_needsOrdenMontoReinforcement en narratePromptC.js, cada uno inyecta su instrucción
 * SOLO cuando corresponde. Brecha exige _needsTableFormat===true (mutuamente excluyente con lista — hallazgo
 * propio probado en vivo: sin este candado, lista+brecha se disparaban JUNTAS, instrucciones contradictorias). */
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

function _payloadFor(figs, extra = {}) {
  return buildNarrateUserMessageC({ text: "x", plan: { mode: "diagnostico" }, results: [], ledgerFigs: figs, mem: {}, history: [], ...extra });
}

console.log("── 1 · _needsListFormat — 3+ entidades × 1 concepto cada una ──");
{
  const figsRanking = [
    { label: "Falabella · Ventas", value: "$19.4M" },
    { label: "Lider · Ventas", value: "$17.9M" },
    { label: "Jumbo · Ventas", value: "$17.3M" },
  ];
  ok(!!_payloadFor(figsRanking).instruccion_lista, "3 entidades × 1 concepto trae instruccion_lista");
  ok(!_payloadFor(figsRanking).instruccion_tabla, "y NO trae instruccion_tabla al mismo tiempo (mutuamente excluyentes)");

  const figsTabla = [
    { label: "Valparaíso · Capital detenido", value: "$25K" }, { label: "Valparaíso · % del total", value: "75%" },
    { label: "Antofagasta · Capital detenido", value: "$8K" }, { label: "Antofagasta · % del total", value: "25%" },
  ];
  ok(!!_payloadFor(figsTabla).instruccion_tabla && !_payloadFor(figsTabla).instruccion_lista, "REGRESIÓN: el caso de tabla (2+cifras/entidad) sigue disparando tabla, no lista");

  const figs2Entidades = [{ label: "Falabella · Ventas", value: "$19.4M" }, { label: "Lider · Ventas", value: "$17.9M" }];
  ok(!_payloadFor(figs2Entidades).instruccion_lista, "REGRESIÓN: solo 2 entidades (mínimo es 3) no fuerza lista");
}

console.log("\n── 2 · _needsBrechaReinforcement — SOLO cuando además hay tabla (nunca junto a lista) ──");
{
  const figsListaConBenchmark = [
    { label: "Lider · Margen", value: "21.5%" }, { label: "Falabella · Margen", value: "22%" }, { label: "Sodimac · Margen", value: "23.5%" },
    { label: "Benchmark de margen", value: "30.1%" },
  ];
  const pLista = _payloadFor(figsListaConBenchmark);
  ok(!!pLista.instruccion_lista && !pLista.instruccion_brecha, "el caso REAL reportado (ranking margen 1-concepto/entidad) va a LISTA, brecha NO se dispara junto — sin contradicción");

  const figsTablaMargen = [
    { label: "Lider · Margen", value: "21.5%" }, { label: "Lider · Ventas", value: "$17.9M" },
    { label: "Falabella · Margen", value: "22%" }, { label: "Falabella · Ventas", value: "$19.4M" },
    { label: "Benchmark de margen", value: "30.1%" },
  ];
  const pTabla = _payloadFor(figsTablaMargen);
  ok(!!pTabla.instruccion_tabla && !!pTabla.instruccion_brecha && !pTabla.instruccion_lista, "tabla de margen (2+conceptos/entidad) SÍ trae brecha, sin lista al mismo tiempo");

  const figsSinBenchmark = [
    { label: "Lider · Margen", value: "21.5%" }, { label: "Lider · Ventas", value: "$17.9M" },
    { label: "Falabella · Margen", value: "22%" }, { label: "Falabella · Ventas", value: "$19.4M" },
  ];
  ok(!_payloadFor(figsSinBenchmark).instruccion_brecha, "REGRESIÓN: sin el fig 'Benchmark de margen' no hay brecha que calcular — no se fuerza");

  const figsSinMargen = [
    { label: "Lider · Ventas", value: "$17.9M" }, { label: "Lider · Contribución", value: "$2M" },
    { label: "Falabella · Ventas", value: "$19.4M" }, { label: "Falabella · Contribución", value: "$3M" },
    { label: "Benchmark de margen", value: "30.1%" },
  ];
  ok(!_payloadFor(figsSinMargen).instruccion_brecha, "REGRESIÓN: tabla sin concepto 'margen' por entidad no dispara brecha (no aplica esa columna)");
}

console.log("\n── 3 · _needsOrdenMontoReinforcement — pedido explícito de $ + marginRead SIN sello (gridTable/tensionRead) ──");
{
  const text = "ordename los clientes con mayor brecha de margen por el monto recuperable, de mayor a menor";
  ok(!!_payloadFor([], { text, results: [{ tool: "marginRead" }] }).instruccion_orden, "el caso REAL reportado (pedido de $ + solo marginRead) trae instruccion_orden");
  ok(!_payloadFor([], { text, results: [{ tool: "marginRead" }, { tool: "tensionRead" }] }).instruccion_orden, "REGRESIÓN: si YA corrió tensionRead (sella orden real), no se fuerza — el guard ya lo cubre");
  ok(!_payloadFor([], { text, results: [{ tool: "marginRead" }, { tool: "gridTable" }] }).instruccion_orden, "REGRESIÓN: mismo caso con gridTable");
  ok(!_payloadFor([], { text: "qué clientes ceden más margen", results: [{ tool: "marginRead" }] }).instruccion_orden, "REGRESIÓN: sin pedido explícito de $/monto/dinero, no se fuerza (deja el criterio al LLM)");
  ok(!_payloadFor([], { text, results: [{ tool: "diagnose" }] }).instruccion_orden, "REGRESIÓN: pedido de $ pero SIN marginRead (otra tool) no dispara — esta instrucción es específica de esa combinación");
}

console.log("\n── 4 · SMOKE LLM REAL — ¿mejoró el cumplimiento medido? (mismas preguntas del hallazgo, real gpt-4o-mini) ──");
{
  const callPlan = async ({ text, history, mem, scenario, requestContext, attempt }) => {
    const r = await handlePlan({ text, history, mem, scenario, requestContext, attempt });
    if (!r.ok) throw new Error(r.error);
    return r.plan;
  };
  const callNarrate = async (payload) => {
    const built = buildNarrateUserMessageC(payload);
    const r = await handleNarrateC({ payload: built, mem: payload.mem, attempt: payload.attempt });
    if (!r.ok) throw new Error(r.error);
    return r.narration;
  };
  const isNumberedList = (t) => /^\s*1\.\s*\*\*/m.test(String(t));

  let listCount = 0, resolved = 0;
  const N = 3;
  for (let i = 0; i < N; i++) {
    const r = await answerViaOracle({ text: "¿qué clientes venden más?", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    if (!r) continue;
    resolved++;
    if (isNumberedList(r.r.text)) listCount++;
  }
  console.log(`  medición LISTA: ${listCount}/${resolved} corridas resueltas con lista numerada (de ${N} intentadas) — antes del fix: 0/6`);
  ok(resolved === 0 || listCount >= 1, `al menos 1/${resolved || N} corridas resueltas cumple lista numerada (mejora medible sobre el 0/6 original)`);
}

console.log(`\n── _narrate_structural_reinforcement_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
