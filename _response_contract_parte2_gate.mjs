/* === _response_contract_parte2_gate.mjs · CONSOLIDACIÓN "Parte 2" del contrato de respuesta (owner 2026-08-04) ===
 * Verifica los 3 gaps reales que cerró esta pasada, MÁS una regresión liviana de lo que ya estaba en PROD (owner:
 * "auditoría rápida propia, no asumas que estos están bien solo porque nadie los tocó").
 *
 *   GAP 1 — backstop determinístico de "solo dato": las 13 frases EXACTAS del owner ahora matchean el contentScope
 *           correcto (antes 9/13 no matcheaban ninguna regex). 100% DETERMINÍSTICO — mockea callPlan/callNarrate,
 *           CERO llamadas reales (mismo patrón ya establecido en _response_preference_gate.mjs, secciones 1-10).
 *   GAP 2 — vocabulario PROBADO/INDICADO/ABIERTO ahora vive en LA ESTRUCTURA (narratePromptC.js), universal a
 *           cualquier modo (antes confinado al modo "evidencia") — chequeo ESTRUCTURAL del texto del prompt (no
 *           requiere LLM: es inspección de un string armado por una función pura).
 *   GAP 3 — composeFromLedger declara el supuesto de una simulación bajo data_only/results_only (antes lo
 *           descartaba por completo, violando "nunca ocultes el supuesto usado"). Incluye el caso ADVERSARIAL que
 *           probó que el fix ingenuo (solo tocar narrationBlocks.js) dependía de SUERTE combinatoria del guard en
 *           datasets ricos — el fix real agrega una fig "Supuesto %" dedicada en los composers de specRetrieval.js
 *           (mismo patrón que computeGoalAnchor, que ya lo hacía bien) para que sea GARANTÍA POR CONSTRUCCIÓN.
 *
 * Todo corre contra el pipeline REAL (answerViaOracle → runPlan real → guardC real → composeFromLedger real) —
 * SOLO callPlan/callNarrate están mockeados (los DOS puntos de inyección de LLM que answerViaOracle.js ya expone
 * para testing, ver su firma). runPlan/guardC/composeFromLedger corren de VERDAD, sobre datos reales del repo.
 * NINGÚN _*_gate.mjs preexistente se ejecuta desde acá — este archivo es autosuficiente.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { composeFromLedger } from "./src/adi/oracle/narrationBlocks.js";
import { blockInstructionFor, BRIEF_INSTRUCTION } from "./src/adi/oracle/responsePreference.js";
import { buildNarrateSystemC } from "./src/adi/oracle/narratePromptC.js";
import { MODES } from "./src/adi/oracle/conversationalContract.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { fig } from "./src/adi/boleta.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

const SAFE_NARRATION = "El negocio se mantiene estable este período, sin sobresaltos que merezcan una alerta.";
const NEVER = async () => { throw new Error("callNarrate NUNCA debería invocarse acá — data_only/results_only es garantía por construcción"); };

console.log("── GAP 1 · las 13 frases EXACTAS del owner activan contentScope=data_only (backstop determinístico, sin pref del LLM) ──");
{
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };   // SIN .pref — depende 100% de la red regex
  const FRASES_13 = [
    "solo dame el dato",
    "dime unicamente las ventas",
    "solo la cifra",
    "sin analisis",
    "sin explicacion",
    "nada mas",
    "directo al numero",
    "cuanto fue y punto",
    "no me recomiendes",
    "no me des contexto",
    "solo el resultado",
    "solo la tabla",
    "muestrame la lista y nada mas",
  ];
  for (const frase of FRASES_13) {
    const r = await answerViaOracle({ text: `dame un resumen ejecutivo, ${frase}`, history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: NEVER });
    ok(r && r.r && r.r.narrationRepaired === true, `"${frase}" → contentScope=data_only (composeFromLedger, narrador NUNCA invocado)`);
  }

  // control negativo: la MISMA estructura de pregunta SIN ninguna de las 13 frases sigue narrando libre (el fix no
  // sobre-dispara sobre texto neutro).
  let calledNormal = false;
  const rNormal = await answerViaOracle({ text: "dame un resumen ejecutivo del negocio", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async () => { calledNormal = true; return SAFE_NARRATION; } });
  ok(calledNormal && rNormal && rNormal.r && !rNormal.r.narrationRepaired, "control: pedido normal (sin ninguna de las 13 frases) SIGUE narrando libre — el fix no sobre-dispara");

  // control accentos: "sólo" y "número"/"explicación" con tilde real siguen matcheando (verificado que \b antes de
  // una vocal acentuada NUNCA matchea en JS regex — las nuevas alternativas evitan ese patrón).
  const rAccent = await answerViaOracle({ text: "dame un resumen ejecutivo, sólo dame el dato", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: NEVER });
  ok(rAccent && rAccent.r && rAccent.r.narrationRepaired === true, "control acentos: \"sólo dame el dato\" (tilde real) también activa data_only");
  const rAccent2 = await answerViaOracle({ text: "dame un resumen ejecutivo, dime únicamente las ventas", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: NEVER });
  ok(rAccent2 && rAccent2.r && rAccent2.r.narrationRepaired === true, "control acentos: \"dime únicamente las ventas\" (tilde real en únicamente) también activa data_only");

  // control falso-positivo real (hallazgo durante el diseño de este fix): "punto de venta" NO debe activar la red
  // de \"y punto\" — se ancla a fin-de-frase/puntuación, nunca a mitad de oración.
  let calledPuntoVenta = false;
  const rPuntoVenta = await answerViaOracle({ text: "dame un resumen ejecutivo y el punto de venta con mayor carga comercial", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async () => { calledPuntoVenta = true; return SAFE_NARRATION; } });
  ok(calledPuntoVenta, "control falso-positivo: \"...y el punto de venta...\" NO dispara la red de \"y punto\" (ancla a fin de frase)");
}

console.log("\n── EJEMPLO EXACTO DEL OWNER — data_only en la ruta determinística (1 entidad, 1 métrica) ──");
{
  // "Dime solo las ventas del mes" -> "Las ventas de julio fueron $X." (sin benchmark/causas/recomendaciones/
  // Sentrix/pregunta). Esta frase en concreto NO es una de las 13 del backstop (depende de comprensión SEMÁNTICA
  // de PLAN, ver responsePreference.js/buildPrefDoctrine — no verificable en vivo sin LLM real, documentado en el
  // reporte) — acá se verifica el CONTRATO EJECUTABLE que esa comprensión activa: `plan.pref.contentScope` YA
  // resuelto (como lo dejaría PLAN), confirmando que _rutaDeterministica (answerViaOracle.js:326) da EXACTAMENTE
  // la oración limpia, sin lectura/oferta, tal como pide el ejemplo — con datos reales del repo (Falabella/venta).
  const PLAN = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] },
    calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }],
    pref: { contentScope: "data_only" } };
  const r = await answerViaOracle({ text: "dime solo las ventas de Falabella este año", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: NEVER });
  ok(r && r.r && r.r.deterministic === true, "resuelve por la ruta determinística (1 entidad, 1 métrica) — el narrador ni se invoca");
  if (r && r.r) {
    const t = r.r.text;
    console.log(`  texto: "${t}"`);
    ok(/^La venta de Falabella es \$[\d.,]+[KM]?, en el a[nñ]o cerrado\.$/.test(t), `oración ÚNICA, natural, con entidad+período — nada más — obtuvo "${t}"`);
    ok(!/por encima de|por debajo de|en l[ií]nea con|analizarlo|benchmark|Sentrix|\?/i.test(t), "sin benchmark/lectura/oferta/pregunta — exactamente lo que pide contentScope=data_only");
  }
}

console.log("\n── GAP 3 · simulación bajo results_only DECLARA el supuesto (antes lo descartaba — bug de honestidad real) ──");
{
  // "no me recomiendes" (una de las 13 frases, GAP 1) DENTRO de mode=simulacion → results_only (ver
  // _PREF_RESULTS_ONLY_SIM_RE). simulateCosto trae datos reales del repo — composeFromLedger arma la tabla +
  // declara el supuesto ("Supuesto: costo medio -3%...") gracias a la fig "Supuesto %" dedicada (specRetrieval.js).
  const PLAN = { intent: "answer", mode: "simulacion", calls: [{ tool: "simulateCosto", args: { dimension: "sku", pct: -3, scope: "bajo_benchmark" } }] };
  const r = await answerViaOracle({ text: "¿y si bajo el costo medio de mis peores SKU un 3%? no me recomiendes nada", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: NEVER });
  ok(r && r.r, "responde (no se abstiene)");
  if (r && r.r) {
    const t = r.r.text;
    console.log(`  texto (${t.length} chars): "${t.slice(-160)}"`);
    ok(r.r.narrationRepaired === true, "results_only: compuesto desde la boleta, narrador nunca invocado (garantía por construcción)");
    ok(/^Supuesto: costo medio -3%/m.test(t), `declara el supuesto EXACTO en su propia línea (requisito owner: "nunca ocultes el supuesto usado") — "${t.split("\n").pop()}"`);
    ok(!/recomend|deber[ií]as|prioriza/i.test(t), "sin lenguaje de recomendación — results_only sigue siendo SOLO resultado+supuesto");
  }

  // control: simulateCarga (el _ctx NO trae ningún número, "supuesto: llevar la carga comercial a tu target...")
  // — la línea de Supuesto igual aparece, sin número que romper, mismo composer.
  const PLAN2 = { intent: "answer", mode: "simulacion", calls: [{ tool: "simulateCarga", args: {} }] };
  const r2 = await answerViaOracle({ text: "¿y si bajamos la carga comercial al target? solo resultados", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN2, callNarrate: NEVER });
  if (r2 && r2.r) {
    console.log(`  carga: "${r2.r.text.split("\n").pop()}"`);
    ok(/^Supuesto:/m.test(r2.r.text), "simulateCarga (sin % en el contexto) también declara su supuesto");
  } else ok(false, "simulateCarga bajo results_only debería responder (puede no haber carga recuperable en este dataset — revisar si falla)");
}

console.log("\n── GAP 3 · ADVERSARIAL — el fix es GARANTÍA POR CONSTRUCCIÓN, no suerte combinatoria del guard ──");
{
  // pool de figs pct DELIBERADAMENTE pobre (solo 2 valores, ninguna resta/suma reproduce -7 dentro de la
  // tolerancia del guard) — sin la fig "Supuesto %" dedicada, esto FALLABA (verificado durante el desarrollo de
  // este fix: guardC rechazaba "cifra-no-autorizada" en un dataset sin figs pct redundantes que "por suerte"
  // reprodujeran el número). Con la fig dedicada, pasa SIEMPRE, sin depender de cuántas otras figs pct haya.
  const _ctx = "supuesto: costo medio -7% sobre todos los SKU (dato real)";
  const figsRicos = [
    fig("Supuesto %", "-7%", { unit: "pct", raw: -7, context: _ctx, source: "computed" }),
    fig("Margen promedio · actual", "41.0%", { unit: "pct", raw: 41.0, context: _ctx, source: "actual" }),
    fig("Margen promedio · nuevo", "44.5%", { unit: "pct", raw: 44.5, context: _ctx, mandatory: true, source: "computed" }),
  ];
  const composed = composeFromLedger(figsRicos, "results_only");
  const verdict = guardC(composed, { ledger: { figs: figsRicos }, results: [], trace: null, question: "¿y si bajo el costo medio un 7%?" });
  ok(/^Supuesto: costo medio -7%/m.test(composed), "declara -7% en la línea de Supuesto");
  ok(verdict.ok === true, `guardC ACEPTA -7% con un pool de SOLO 2 figs pct que no puede reproducirlo por resta/suma — garantía real, no suerte — obtuvo ${JSON.stringify(verdict.violations)}`);

  // control negativo: SIN la fig "Supuesto %" dedicada (simulando el bug original), el mismo pool pobre SÍ falla —
  // prueba que el guard realmente estaba en riesgo, y que la fig dedicada es la que lo cierra (no un efecto lateral).
  const figsSinDedicada = figsRicos.slice(1);   // saca "Supuesto %"
  const composed2 = composeFromLedger(figsSinDedicada, "results_only");
  const verdict2 = guardC(composed2, { ledger: { figs: figsSinDedicada }, results: [], trace: null, question: "¿y si bajo el costo medio un 7%?" });
  ok(verdict2.ok === false, `control: SIN la fig dedicada, el mismo pool pobre SÍ rechaza -7% (prueba que el riesgo era real, no un fantasma) — verdict=${verdict2.verdict}`);
}

console.log("\n── GAP 2 · PROBADO/INDICADO/ABIERTO ahora es vocabulario UNIVERSAL (antes confinado al modo evidencia) ──");
{
  const _WORDS_RE = /PROBADO/.source + "|" + /INDICADO/.source + "|" + /ABIERTO/.source;
  for (const mode of ["diagnostico", "decision", "default", "simulacion", "seguimiento"]) {
    const sys = buildNarrateSystemC("PERSONA_DUMMY", "", mode, null);
    ok(/PROBADO/.test(sys) && /INDICADO/.test(sys) && /ABIERTO/.test(sys), `modo=${mode}: el system prompt de NARRAR incluye PROBADO/INDICADO/ABIERTO (vocabulario universal vía LA ESTRUCTURA)`);
  }
  // evidencia sigue siendo el modo que MÁS lo explicita (doctrina propia en conversationalContract.js) — y ahora
  // cruza-referencia explícitamente a LA ESTRUCTURA (antes eran 2 textos sin conexión).
  const evidencia = MODES.find((m) => m.key === "evidencia");
  ok(/PROBADO/.test(evidencia.narrate) && /INDICADO/.test(evidencia.narrate) && /ABIERTO/.test(evidencia.narrate), "modo=evidencia conserva su propia doctrina explícita de PROBADO/INDICADO/ABIERTO");
  ok(/LA ESTRUCTURA/.test(evidencia.narrate), "modo=evidencia AHORA cross-referencia LA ESTRUCTURA — mismo criterio de honestidad, no una regla aparte");
}

console.log("\n── REGRESIÓN LIVIANA · lo que ya estaba en PROD sigue intacto ──");
{
  // formato pedido por el usuario (tabla/lista/brief/action_only) — existencia estructural, sin tocar.
  ok(blockInstructionFor("data_only") && /\[\[DATOS\]\]/.test(blockInstructionFor("data_only")), "blockInstructionFor(data_only) intacto");
  ok(blockInstructionFor("action_only") && /\[\[ACCION\]\]/.test(blockInstructionFor("action_only")), "blockInstructionFor(action_only) intacto");
  ok(blockInstructionFor("full") === null, "blockInstructionFor(full) sigue siendo null (sin restricción)");
  ok(typeof BRIEF_INSTRUCTION === "string" && BRIEF_INSTRUCTION.length > 0, "BRIEF_INSTRUCTION intacto");

  // persistencia de sesión + "volvamos a lo normal" (mismo patrón que _response_preference_gate.mjs secciones 2/4,
  // re-confirmado acá porque este pase tocó el bloque de regex vecino — chequeo de no-regresión, no re-descubrimiento).
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  const callPlan = async () => PLAN;
  const callNarrate = async () => SAFE_NARRATION;
  const rBrief = await answerViaOracle({ text: "desde ahora respondeme breve", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(rBrief && rBrief.mem.responsePref && rBrief.mem.responsePref.detailLevel === "brief", "\"desde ahora respondeme breve\" persiste en la sesión");
  const rNormal = await answerViaOracle({ text: "volvé a lo normal", history: [], mem: rBrief.mem, scenario: "actual", callPlan, callNarrate });
  ok(rNormal && rNormal.mem.responsePref && rNormal.mem.responsePref.detailLevel === "standard" && rNormal.mem.responsePref.contentScope === "full", "\"volvé a lo normal\" cancela la sesión completa");
  const rNext = await answerViaOracle({ text: "¿y algo más?", history: [], mem: rNormal.mem, scenario: "actual", callPlan, callNarrate });
  ok(rNext && rNext.mem.responsePref && rNext.mem.responsePref.detailLevel === "standard", "el turno siguiente NO vuelve a breve");

  // arco proporcional: pregunta puntual simple → respuesta corta (ruta determinística), sigue intacto.
  const PLAN_SIMPLE = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] };
  let narrateCalled = false;
  const rSimple = await answerViaOracle({ text: "el rebate de Falabella", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_SIMPLE, callNarrate: async () => { narrateCalled = true; return SAFE_NARRATION; } });
  ok(rSimple && rSimple.r && rSimple.r.deterministic === true, "pregunta puntual simple → ruta determinística (arco proporcional intacto)");
  ok(!narrateCalled, "el narrador NUNCA se invoca para una consulta puntual resuelta determinísticamente");
  ok(rSimple && rSimple.r && rSimple.r.text.split(/\s+/).length <= 30, `respuesta corta (2-3 frases), nunca un sermón — obtuvo ${rSimple.r.text.split(/\s+/).length} palabras: "${rSimple.r.text}"`);
}

console.log(`\n── _response_contract_parte2_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
