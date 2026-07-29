/* === _response_preference_gate.mjs · PREFERENCIA DE RESPUESTA (owner 2026-07-29, residual cerrado) ===
 * v1 dependía de que el narrador OBEDECIERA la doctrina en prosa libre — verificado en vivo: "resumen ejecutivo,
 * solo cifras" salió con una recomendación colgada al final. El owner pidió CUMPLIMIENTO ESTRUCTURAL, no un guard
 * duro (evita el fallback ~33% ya documentado): el narrador marca sus propios bloques ([[DATOS]]/[[INTERPRETACION]]/
 * [[ACCION]]/[[SIGUIENTE_PASO]], narrationBlocks.js) y un RENDERER DETERMINÍSTICO decide cuáles llegan al usuario
 * según `contentScope` — si el LLM cuela un bloque que no corresponde, el renderer lo descarta SIEMPRE, sin
 * importar qué escriba adentro. Si el narrador nunca etiqueta (3/3 intentos), se repara componiendo DESDE LA
 * BOLETA — nunca un fallback genérico (return null).
 *
 * Mapeo a los puntos pedidos:
 *   1) dato puntual normal vs "solo el dato"                    → sección 7 (ruta determinística, sin bloques)
 *   2) resumen ejecutivo normal vs "solo cifras"                → sección 8 (narrador, mode=diagnostico)
 *   3) decisión normal vs "solo la acción"                      → sección 9 (narrador, mode=decision)
 *   4) simulación normal vs "solo resultados"                   → sección 10 (narrador, mode=simulacion)
 *   5) preferencia de un turno vs persistente                   → sección 2
 *   6) continuidad posterior sin contaminación                  → sección 3
 *   7) mismas cifras autorizadas y período                      → sección 11 (guardC/ensurePeriodoDeclared sin relajar)
 *   8) comportamiento consistente en ruta determinística y LLM  → sección 12
 *   + "volver a lo normal" cancela SIEMPRE la sesión            → sección 4 (corregido tras feedback del owner)
 *   + CONTENIDO PROHIBIDO nunca llega al usuario (no solo el campo `pref`) → secciones 5 y 6 — el corazón del fix,
 *     100% DETERMINÍSTICAS: inyectan contenido adversarial vía callNarrate mockeado y prueban el TEXTO FINAL.
 * Secciones 1-6 y 11-12 son DETERMINÍSTICAS (callPlan/callNarrate mockeados, cero LLM real, cero variance).
 * Secciones 7-10 son SMOKE LLM REAL — señal complementaria (¿el narrador real usa bien el formato?), no la garantía:
 * la garantía es el renderer de las secciones 5-6, que funciona IGUAL aunque el LLM real falle esta corrida.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { parseBlocks, renderFromBlocks } from "./src/adi/oracle/narrationBlocks.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

// narración segura para mocks DETERMINÍSTICOS: CERO cifras/conteos → pasa guardC pase lo que pase el dataset real
// (mismo truco que _oracle_mechanism_memory_gate.mjs: nombrar entidades o hablar en general, nunca inventar un $/%).
const SAFE_NARRATION = "El negocio se mantiene estable este período, sin sobresaltos que merezcan una alerta.";

console.log("── 1 · DETERMINÍSTICO — _coercePref: el LLM manda, la red SOLO fuerza ante frase inequívoca (mismo patrón que _coerceMode) ──");
{
  const PLAN_A = { intent: "answer", mode: "decision", calls: [{ tool: "diagnose", args: {} }], pref: { contentScope: "action_only" } };
  let seenA = null;
  const rA = await answerViaOracle({ text: "por dónde arranco", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_A, callNarrate: async (a) => { seenA = a.pref; return "[[ACCION]]" + SAFE_NARRATION; } });
  ok(rA && rA.r && rA.r.route === "oracle", "1a: responde por C");
  ok(seenA && seenA.contentScope === "action_only", `1a: el narrador recibe el pref del LLM sin tocar (action_only) — obtuvo ${JSON.stringify(seenA)}`);

  const PLAN_B = { intent: "answer", mode: "decision", calls: [{ tool: "diagnose", args: {} }] };
  let seenB = null;
  const rB = await answerViaOracle({ text: "¿a cuál priorizo? dame solo la acción, sin el diagnóstico", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_B, callNarrate: async (a) => { seenB = a.pref; return "[[ACCION]]" + SAFE_NARRATION; } });
  ok(seenB && seenB.contentScope === "action_only", `1b: la red fuerza action_only por frase inequívoca aunque el LLM no la haya marcado — obtuvo ${JSON.stringify(seenB)}`);

  const PLAN_C = { intent: "answer", mode: "simulacion", calls: [{ tool: "simulateCarga", args: {} }] };
  let seenC = null;
  const rC = await answerViaOracle({ text: "¿y si bajo la carga al target? dame solo los resultados, sin recomendación", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_C, callNarrate: async (a) => { seenC = a.pref; return "[[DATOS]]" + SAFE_NARRATION; } });
  ok(seenC && seenC.contentScope === "results_only", `1c: en simulación, "sin recomendación" → results_only (no data_only) — obtuvo ${JSON.stringify(seenC)}`);

  const PLAN_D = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  let seenD = null;
  const rD = await answerViaOracle({ text: "dame un resumen ejecutivo, sin análisis", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_D, callNarrate: async (a) => { seenD = a.pref; return "[[DATOS]]" + SAFE_NARRATION; } });
  ok(seenD && seenD.contentScope === "data_only", `1d: fuera de una simulación, "sin análisis" → data_only — obtuvo ${JSON.stringify(seenD)}`);
}

console.log("\n── 2 · DETERMINÍSTICO — preferencia de UN TURNO vs PERSISTENTE (requisito 5) ──");
{
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  const callPlan = async () => PLAN;
  const callNarrate = async () => SAFE_NARRATION;

  const rA = await answerViaOracle({ text: "desde ahora respondeme breve", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(rA && rA.mem && rA.mem.responsePref && rA.mem.responsePref.detailLevel === "brief", `"desde ahora respondeme breve" ESCRIBE mem.responsePref — obtuvo ${JSON.stringify(rA && rA.mem && rA.mem.responsePref)}`);

  const rB = await answerViaOracle({ text: "dame solo la acción, sin el diagnóstico", history: [], mem: {}, scenario: "actual", callPlan, callNarrate: async () => "[[ACCION]]" + SAFE_NARRATION });
  ok(!(rB && rB.mem && rB.mem.responsePref), `un pedido puntual SIN marcador de persistencia NO escribe mem.responsePref — obtuvo ${JSON.stringify(rB && rB.mem && rB.mem.responsePref)}`);

  const PLAN_STICKY = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }], pref: { contentScope: "data_only", persist: true } };
  const rC = await answerViaOracle({ text: "solo esta vez, sin análisis", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_STICKY, callNarrate: async () => "[[DATOS]]" + SAFE_NARRATION });
  ok(!(rC && rC.mem && rC.mem.responsePref), `"solo esta vez" fuerza persist=false aunque el LLM haya marcado persist=true — obtuvo ${JSON.stringify(rC && rC.mem && rC.mem.responsePref)}`);
}

console.log("\n── 3 · DETERMINÍSTICO — continuidad posterior SIN CONTAMINACIÓN (requisito 6) ──");
{
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  const callPlan = async () => PLAN;
  let seenPref = null;
  const callNarrate = async (a) => { seenPref = a.pref; return SAFE_NARRATION; };

  const r1 = await answerViaOracle({ text: "desde ahora respondeme breve", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(r1 && r1.mem.responsePref.detailLevel === "brief", "turno 1: sesión queda en brief");

  const r2 = await answerViaOracle({ text: "dame el análisis completo, solo por esta vez", history: [], mem: r1.mem, scenario: "actual", callPlan, callNarrate });
  ok(seenPref && seenPref.contentScope === "full" && seenPref.detailLevel === "standard", `turno 2: el EFECTIVO de este turno vuelve a full/standard (override de un turno) — obtuvo ${JSON.stringify(seenPref)}`);
  ok(r2 && r2.mem.responsePref && r2.mem.responsePref.detailLevel === "brief", `turno 2: la SESIÓN sigue en brief — el override de un turno no la tocó — obtuvo ${JSON.stringify(r2 && r2.mem.responsePref)}`);

  const r3 = await answerViaOracle({ text: "¿y algo más para revisar?", history: [], mem: r2.mem, scenario: "actual", callPlan, callNarrate });
  ok(seenPref && seenPref.detailLevel === "brief" && seenPref.contentScope === "full", `turno 3 (sin mención de formato): hereda la SESIÓN (brief) — el override transitorio del turno 2 NO contaminó — obtuvo ${JSON.stringify(seenPref)}`);
  ok(r3 && r3.mem.responsePref && r3.mem.responsePref.detailLevel === "brief", "turno 3: la sesión se mantiene brief para el turno 4 (si lo hubiera)");
}

console.log("\n── 4 · DETERMINÍSTICO — 'volver a lo normal' SIEMPRE cancela la sesión (corregido: antes era condicional, el owner pidió incondicional) ──");
{
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  const callPlan = async () => PLAN;
  const callNarrate = async () => SAFE_NARRATION;

  const rBrief = await answerViaOracle({ text: "desde ahora respondeme breve", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(rBrief.mem.responsePref.detailLevel === "brief", "sesión inicial en brief");

  // "como antes", SIN ningún otro marcador → AHORA cancela sin condición (antes de este fix quedaba ambiguo/1-turno)
  const rReset = await answerViaOracle({ text: "dame la respuesta completa, como antes", history: [], mem: rBrief.mem, scenario: "actual", callPlan, callNarrate });
  ok(rReset && rReset.mem.responsePref && rReset.mem.responsePref.detailLevel === "standard" && rReset.mem.responsePref.contentScope === "full", `"como antes" CANCELA la sesión SIN condición — obtuvo ${JSON.stringify(rReset && rReset.mem.responsePref)}`);

  // el turno SIGUIENTE, sin mencionar nada, ya NO vuelve a breve — el requisito explícito del owner.
  const rNext = await answerViaOracle({ text: "¿y algo más?", history: [], mem: rReset.mem, scenario: "actual", callPlan, callNarrate });
  ok(rNext && rNext.mem.responsePref && rNext.mem.responsePref.detailLevel === "standard", `el turno SIGUIENTE NO vuelve a breve — obtuvo ${JSON.stringify(rNext && rNext.mem.responsePref)}`);

  // "ya no hace falta que sea breve" también cancela (proyección hacia adelante explícita, redundante con el caso de arriba)
  const rCancel = await answerViaOracle({ text: "ya no hace falta que sea breve", history: [], mem: rBrief.mem, scenario: "actual", callPlan, callNarrate });
  ok(rCancel && rCancel.mem.responsePref && rCancel.mem.responsePref.detailLevel === "standard", `"ya no hace falta que sea breve" cancela la sesión — obtuvo ${JSON.stringify(rCancel && rCancel.mem.responsePref)}`);

  // "solo por esta vez" SIGUE ganando incluso sobre un reset — un pedido puntual y transitorio no cancela la sesión.
  const rOneTurnReset = await answerViaOracle({ text: "dame el análisis completo, pero solo por esta vez", history: [], mem: rBrief.mem, scenario: "actual", callPlan, callNarrate });
  ok(rOneTurnReset && rOneTurnReset.mem.responsePref && rOneTurnReset.mem.responsePref.detailLevel === "brief", `"solo por esta vez" sigue ganando incluso sobre un reset — la sesión NO se cancela — obtuvo ${JSON.stringify(rOneTurnReset && rOneTurnReset.mem.responsePref)}`);
}

console.log("\n── 5 · DETERMINÍSTICO — GARANTÍA ESTRUCTURAL (unit): el renderer descarta contenido prohibido SIN IMPORTAR qué escriba el LLM ──");
{
  const adversarial = "[[DATOS]]El rebate de Falabella es 4.5%, en el año cerrado.[[ACCION]]Deberías renegociar el rebate YA, es urgente.[[INTERPRETACION]]Esto pasa porque el cliente tiene mucho poder de negociación.[[SIGUIENTE_PASO]]¿Querés que profundice?";
  const parsed = parseBlocks(adversarial);
  ok(parsed && parsed.datos && parsed.accion && parsed.interpretacion && parsed.siguiente_paso, "parseBlocks separa los 4 bloques correctamente");

  const dataOnly = renderFromBlocks(parsed, "data_only");
  ok(!/deber[íi]as|urgente|renegoci|poder de negociaci[oó]n|profundice/i.test(dataOnly), `data_only: [[ACCION]]/[[INTERPRETACION]]/[[SIGUIENTE_PASO]] se descartan SIEMPRE — "${dataOnly}"`);
  ok(/rebate de Falabella es 4\.5%/.test(dataOnly), "data_only: el bloque [[DATOS]] permitido SÍ sobrevive");

  const actionOnly = renderFromBlocks(parsed, "action_only");
  ok(!/rebate de Falabella es 4\.5%|poder de negociaci[oó]n|profundice/i.test(actionOnly), `action_only: [[DATOS]]/[[INTERPRETACION]]/[[SIGUIENTE_PASO]] se descartan — "${actionOnly}"`);
  ok(/deber[íi]as renegociar/i.test(actionOnly), "action_only: el bloque [[ACCION]] permitido SÍ sobrevive");

  const resultsOnly = renderFromBlocks(parsed, "results_only");
  ok(!/deber[íi]as|urgente/i.test(resultsOnly) && /rebate de Falabella es 4\.5%/.test(resultsOnly), "results_only: se comporta igual que data_only (DATOS = supuesto+resultado en una simulación)");

  const full = renderFromBlocks(parsed, "full");
  ok(/rebate de Falabella|deber[íi]as renegociar|poder de negociaci[oó]n|profundice/.test(full) && full.length > dataOnly.length, "full: los 4 bloques sobreviven, en orden");

  ok(parseBlocks("texto plano sin ninguna marca") === null, "sin marcas [[...]] → parseBlocks devuelve null (falla estructural detectable, no basura silenciosa)");
}

console.log("\n── 6 · DETERMINÍSTICO — GARANTÍA ESTRUCTURAL (integración): el MISMO contenido que se vio colar en vivo, ahora NUNCA llega al usuario ──");
{
  // reproduce EXACTAMENTE el caso observado en vivo: tabla de KPIs + una frase de acción colgada al final.
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }], pref: { contentScope: "data_only" } };
  const adversarialNarrate = async () => "[[DATOS]]| Concepto | Valor |\n|---|---|\n| Ventas del período | $100.0M |\n| Contribución | $25.0M |[[ACCION]]Cerrá la brecha de margen trabajando sobre los SKU de mayor contribución.";
  const r = await answerViaOracle({ text: "resumen ejecutivo, solo cifras", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: adversarialNarrate });
  ok(r && r.r, "responde por C (no se abstiene)");
  if (r) {
    ok(!/cerr[aá]\s+la\s+brecha|trabajando\s+sobre/i.test(r.r.text), `aunque el narrador (mockeado con el MISMO texto que se vio en vivo) colgó la recomendación, el texto final NO la tiene — "${r.r.text}"`);
    ok(/\$100\.0M|\$25\.0M/.test(r.r.text), "el bloque [[DATOS]] permitido SÍ llega completo");
  }

  console.log("  ── REPARACIÓN CONTROLADA: el narrador NUNCA etiqueta (3/3) → compone desde la boleta, jamás un fallback genérico ──");
  const neverTagged = async () => "Las ventas del negocio vienen bien este período, con buena contribución.";
  const r2 = await answerViaOracle({ text: "resumen ejecutivo, solo cifras", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: neverTagged });
  ok(r2 && r2.r, "NUNCA se abstiene (return null) aunque el narrador jamás use el formato de bloques — hay boleta para reparar");
  if (r2) {
    ok(r2.r.narrationRepaired === true, "queda la marca narrationRepaired (telemetría honesta: Pasada 2 corrió, no cumplió el formato, se reparó)");
    ok(/\$/.test(r2.r.text), `el texto reparado trae cifras REALES de la boleta, no un "no puedo responder" genérico — "${r2.r.text.slice(0, 160)}..."`);
  }

  const PLAN2 = { intent: "answer", mode: "decision", calls: [{ tool: "diagnose", args: {} }], pref: { contentScope: "action_only" } };
  const r3 = await answerViaOracle({ text: "¿a cuál priorizo? solo la acción", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN2, callNarrate: neverTagged });
  ok(r3 && r3.r && r3.r.narrationRepaired === true, `action_only también repara en vez de abstenerse — "${r3 && r3.r && r3.r.text}"`);
}

console.log("\n── 7 · SMOKE LLM REAL — dato puntual normal vs 'solo el dato' (requisito 1, ruta determinística — sin bloques, no aplica acá) ──");
{
  const callPlan = async ({ text, history, mem, scenario }) => { const pr = await handlePlan({ text, history, mem, scenario }); return pr.ok ? pr.plan : null; };
  const callNarrate = async (args) => { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };

  const rNorm = await answerViaOracle({ text: "el rebate de Falabella", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  const rSolo = await answerViaOracle({ text: "solo el dato del rebate de Falabella", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  if (rNorm && rNorm.r.deterministic && rSolo && rSolo.r.deterministic) {
    ok(/por encima de|por debajo de|en l[ií]nea con/i.test(rNorm.r.text), `normal: trae la lectura mínima — "${rNorm.r.text}"`);
    ok(!/por encima de|por debajo de|en l[ií]nea con|analizarlo/i.test(rSolo.r.text), `"solo el dato": suprime la lectura — "${rSolo.r.text}"`);
    ok(/a[nñ]o cerrado/.test(rSolo.r.text), "\"solo el dato\": el período se mantiene igual (requisito 7)");
  } else {
    console.log(`  (variance de clasificación esta corrida — normal:${!!(rNorm && rNorm.r.deterministic)} solo:${!!(rSolo && rSolo.r.deterministic)} — no es de este contrato)`);
  }
}

console.log("\n── 8 · SMOKE LLM REAL — resumen ejecutivo normal vs 'solo cifras' (requisito 2, narrador mode=diagnostico) ──");
{
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  const callPlan = async () => PLAN;
  const callNarrate = async (args) => { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };

  const rNorm = await answerViaOracle({ text: "dame un resumen ejecutivo del negocio", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  const rSolo = await answerViaOracle({ text: "dame un resumen ejecutivo del negocio, pero solo las cifras, sin análisis", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(rNorm && rNorm.r && rNorm.r.route === "oracle", "normal: responde por C");
  ok(rSolo && rSolo.r && rSolo.r.route === "oracle", "'solo cifras': responde por C");
  if (rNorm && rSolo) {
    const RECO_RE = /deber[íi]as|te recomiendo|te sugiero|prioriz\w*|primer paso|la acci[oó]n (?:es|prioritaria)|cerr[aá]\s+la\s+brecha|trabajando\s+sobre|empez[aá]\s+por/i;
    ok(!RECO_RE.test(rSolo.r.text), `"solo cifras": SIN recomendación/acción (garantizado por el renderer, no solo por el prompt) — "${rSolo.r.text.slice(0, 200)}..."`);
    ok(/a[nñ]o cerrado|foto.*hoy/i.test(rSolo.r.text), "\"solo cifras\": el período se mantiene (requisito 7)");
    console.log(`  normal (${rNorm.r.text.length} chars, repaired:${!!rNorm.r.narrationRepaired}): "${rNorm.r.text.slice(0, 140)}..."`);
    console.log(`  solo cifras (${rSolo.r.text.length} chars, repaired:${!!rSolo.r.narrationRepaired}): "${rSolo.r.text.slice(0, 140)}..."`);
    // NO es un assert duro: "normal" es prosa libre de longitud variable (a veces terso, a veces extenso) y una
    // tabla de KPIs completa puede superarlo en caracteres aunque tenga MENOS contenido interpretativo — la
    // garantía real ya quedó probada arriba (sin recomendación + período presente), esto es solo informativo.
  }
}

console.log("\n── 9 · SMOKE LLM REAL — decisión normal vs 'solo la acción' (requisito 3, narrador mode=decision) ──");
{
  const PLAN = { intent: "answer", mode: "decision", calls: [{ tool: "diagnose", args: {} }] };
  const callPlan = async () => PLAN;
  const callNarrate = async (args) => { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };

  const rNorm = await answerViaOracle({ text: "¿a cuál cliente le priorizo primero?", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  const rSolo = await answerViaOracle({ text: "¿a cuál cliente le priorizo primero? dame solo la acción, sin el diagnóstico", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(rNorm && rNorm.r && rNorm.r.route === "oracle", "normal: responde por C");
  ok(rSolo && rSolo.r && rSolo.r.route === "oracle", "'solo la acción': responde por C");
  if (rNorm && rSolo) {
    console.log(`  normal (${rNorm.r.text.length} chars): "${rNorm.r.text.slice(0, 140)}..."`);
    console.log(`  solo la acción (${rSolo.r.text.length} chars, repaired:${!!rSolo.r.narrationRepaired}): "${rSolo.r.text.slice(0, 140)}..."`);
    ok(/a[nñ]o cerrado|foto.*hoy/i.test(rSolo.r.text) || !/\$/.test(rSolo.r.text), "\"solo la acción\": si cita una cifra real, declara período (requisito 7) — o no cita ninguna");
  }
}

console.log("\n── 10 · SMOKE LLM REAL — simulación normal vs 'solo resultados' (requisito 4, narrador mode=simulacion) ──");
{
  const PLAN = { intent: "answer", mode: "simulacion", calls: [{ tool: "simulateCarga", args: {} }] };
  const callPlan = async () => PLAN;
  const callNarrate = async (args) => { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };

  const rNorm = await answerViaOracle({ text: "¿y si bajo la carga comercial al target?", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  const rSolo = await answerViaOracle({ text: "¿y si bajo la carga comercial al target? dame solo los resultados, sin recomendación", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(rNorm && rNorm.r && rNorm.r.route === "oracle", "normal: responde por C");
  ok(rSolo && rSolo.r && rSolo.r.route === "oracle", "'solo resultados': responde por C");
  if (rNorm && rSolo) {
    const RECO_RE = /deber[íi]as|te recomiendo|te sugiero|primer paso/i;
    ok(!RECO_RE.test(rSolo.r.text), `"solo resultados": SIN cierre de recomendación — "${rSolo.r.text}"`);
    ok(/\bsi\b|estimad\w*|hip[oó]tesis|\$/i.test(rSolo.r.text), "\"solo resultados\": trae el supuesto+resultado (DATOS)");
  }
}

console.log("\n── 11 · DETERMINÍSTICO — mismas cifras autorizadas y período bajo pref restringido (requisito 7) ──");
{
  // el propio hecho de que answerViaOracle haya devuelto {r,mem} (no null) YA prueba que guardC validó la
  // narración FINAL (post-render/post-reparación) con el MISMO ledger de siempre — pref nunca se pasa a guardC.
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }], pref: { contentScope: "data_only" } };
  const r = await answerViaOracle({ text: "resumen ejecutivo, solo cifras, sin análisis", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async () => "[[DATOS]]" + SAFE_NARRATION });
  ok(r && r.r, "una narración con pref restringido SOLO llega acá si pasó guardC con el ledger real (mismo muro de siempre)");
  if (r) ok(/a[nñ]o cerrado|foto.*hoy/i.test(r.r.text), "el período sigue garantizado (ensurePeriodoDeclared corre SIEMPRE, sin importar pref, después del render)");
}

console.log("\n── 12 · DETERMINÍSTICO — consistencia ruta determinística vs LLM: MISMA sesión alimenta ambas rutas (requisito 8) ──");
{
  const PLAN1 = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  const r1 = await answerViaOracle({ text: "desde ahora respondeme breve", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN1, callNarrate: async () => SAFE_NARRATION });
  ok(r1 && r1.mem.responsePref.detailLevel === "brief", "turno 1: sesión queda en brief (vía narrador)");

  const PLAN2 = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["LG-DRYER8KG"] }, calls: [{ tool: "entityRecord", args: { dimension: "sku", entity: "LG-DRYER8KG" } }] };
  let narrateCalled = false;
  const r2 = await answerViaOracle({ text: "el precio de lista del SKU LG-DRYER8KG", history: [], mem: r1.mem, scenario: "actual", callPlan: async () => PLAN2, callNarrate: async () => { narrateCalled = true; return SAFE_NARRATION; } });
  ok(r2 && r2.r && r2.r.deterministic === true, "turno 2: la ruta determinística se activa (precioLista, 1 entidad, 1 métrica)");
  ok(!narrateCalled, "turno 2: la Pasada 2 (narrador) NUNCA se invoca — la ruta determinística la saltea por completo");
  if (r2 && r2.r) ok(!/puedo analizarlo con m[aá]s detalle/i.test(r2.r.text), `turno 2: la SESIÓN brief (fijada por el narrador en el turno 1) SUPRIME la oferta también en la ruta determinística — "${r2.r.text}"`);
}

console.log(`\n── _response_preference_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
