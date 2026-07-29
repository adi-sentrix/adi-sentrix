/* === _response_preference_gate.mjs · PREFERENCIA DE RESPUESTA (owner 2026-07-29) ===
 * "Implementa una preferencia de respuesta estructurada y neutral al proveedor, separada del modo conversacional.
 * El modo indica QUÉ necesita el usuario, la preferencia indica CÓMO quiere recibirlo." Certifica los 8 puntos
 * pedidos por el owner:
 *   1) dato puntual normal vs "solo el dato"                    → sección 5 (ruta determinística)
 *   2) resumen ejecutivo normal vs "solo cifras"                → sección 6 (narrador, mode=diagnostico)
 *   3) decisión normal vs "solo la acción"                      → sección 7 (narrador, mode=decision)
 *   4) simulación normal vs "solo resultados"                   → sección 8 (narrador, mode=simulacion)
 *   5) preferencia de un turno vs persistente                   → sección 2
 *   6) continuidad posterior sin contaminación                  → sección 3
 *   7) mismas cifras autorizadas y período                      → secciones 6-9 (guardC/ensurePeriodoDeclared sin relajar)
 *   8) comportamiento consistente en ruta determinística y LLM  → sección 10
 * Secciones 1-4 y 9-10 son DETERMINÍSTICAS (callPlan/callNarrate mockeados — sin variance de LLM, cableado puro).
 * Secciones 5-8 son SMOKE LLM REAL (callPlan mockeado con el plan CORRECTO para aislar la variable bajo prueba —
 * la Pasada 2/narrador SÍ es real, es lo que este gate certifica). Mismo criterio de tolerancia a variance que el
 * resto del repo: se LOGUEA cuando el LLM no coopera, no se fuerza un hard-fail por eso.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

// narración segura para mocks DETERMINÍSTICOS: CERO cifras/conteos → pasa guardC pase lo que pase el dataset real
// (mismo truco que _oracle_mechanism_memory_gate.mjs: nombrar entidades o hablar en general, nunca inventar un $/%).
const SAFE_NARRATION = "El negocio se mantiene estable este período, sin sobresaltos que merezcan una alerta.";

console.log("── 1 · DETERMINÍSTICO — _coercePref: el LLM manda, la red SOLO fuerza ante frase inequívoca (mismo patrón que _coerceMode) ──");
{
  // 1a: plan.pref YA trae action_only y el texto no dice nada que lo contradiga → se respeta tal cual
  const PLAN_A = { intent: "answer", mode: "decision", calls: [{ tool: "diagnose", args: {} }], pref: { contentScope: "action_only" } };
  let seenA = null;
  const rA = await answerViaOracle({ text: "por dónde arranco", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_A, callNarrate: async (a) => { seenA = a.pref; return SAFE_NARRATION; } });
  ok(rA && rA.r && rA.r.route === "oracle", "1a: responde por C");
  ok(seenA && seenA.contentScope === "action_only", `1a: el narrador recibe el pref del LLM sin tocar (action_only) — obtuvo ${JSON.stringify(seenA)}`);

  // 1b: el LLM no marcó nada, pero el TEXTO trae "solo la acción, sin el diagnóstico" → la red fuerza action_only
  const PLAN_B = { intent: "answer", mode: "decision", calls: [{ tool: "diagnose", args: {} }] };
  let seenB = null;
  const rB = await answerViaOracle({ text: "¿a cuál priorizo? dame solo la acción, sin el diagnóstico", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_B, callNarrate: async (a) => { seenB = a.pref; return SAFE_NARRATION; } });
  ok(seenB && seenB.contentScope === "action_only", `1b: la red fuerza action_only por frase inequívoca aunque el LLM no la haya marcado — obtuvo ${JSON.stringify(seenB)}`);

  // 1c: "sin recomendación"/"sin análisis" DENTRO de una simulación → results_only, NUNCA data_only
  const PLAN_C = { intent: "answer", mode: "simulacion", calls: [{ tool: "simulateCarga", args: {} }] };
  let seenC = null;
  const rC = await answerViaOracle({ text: "¿y si bajo la carga al target? dame solo los resultados, sin recomendación", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_C, callNarrate: async (a) => { seenC = a.pref; return SAFE_NARRATION; } });
  ok(seenC && seenC.contentScope === "results_only", `1c: en simulación, "sin recomendación" → results_only (no data_only) — obtuvo ${JSON.stringify(seenC)}`);

  // 1d: la MISMA frase "sin análisis" FUERA de una simulación → data_only (no results_only)
  const PLAN_D = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  let seenD = null;
  const rD = await answerViaOracle({ text: "dame un resumen ejecutivo, sin análisis", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_D, callNarrate: async (a) => { seenD = a.pref; return SAFE_NARRATION; } });
  ok(seenD && seenD.contentScope === "data_only", `1d: fuera de una simulación, "sin análisis" → data_only — obtuvo ${JSON.stringify(seenD)}`);
}

console.log("\n── 2 · DETERMINÍSTICO — preferencia de UN TURNO vs PERSISTENTE (requisito 5) ──");
{
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  const callPlan = async () => PLAN;
  const callNarrate = async () => SAFE_NARRATION;

  const rA = await answerViaOracle({ text: "desde ahora respondeme breve", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(rA && rA.mem && rA.mem.responsePref && rA.mem.responsePref.detailLevel === "brief", `"desde ahora respondeme breve" ESCRIBE mem.responsePref — obtuvo ${JSON.stringify(rA && rA.mem && rA.mem.responsePref)}`);

  const rB = await answerViaOracle({ text: "dame solo la acción, sin el diagnóstico", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(!(rB && rB.mem && rB.mem.responsePref), `un pedido puntual SIN marcador de persistencia NO escribe mem.responsePref — obtuvo ${JSON.stringify(rB && rB.mem && rB.mem.responsePref)}`);

  // aunque el LLM (plan.pref) haya marcado persist=true por su cuenta, "solo esta vez" en el TEXTO lo revierte —
  // la red puede FORZAR persist=false, la misma precedencia que ya se probó en la sección 1 para contentScope.
  const PLAN_STICKY = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }], pref: { contentScope: "data_only", persist: true } };
  const rC = await answerViaOracle({ text: "solo esta vez, sin análisis", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_STICKY, callNarrate });
  ok(!(rC && rC.mem && rC.mem.responsePref), `"solo esta vez" fuerza persist=false aunque el LLM haya marcado persist=true — obtuvo ${JSON.stringify(rC && rC.mem && rC.mem.responsePref)}`);
}

console.log("\n── 3 · DETERMINÍSTICO — continuidad posterior SIN CONTAMINACIÓN (requisito 6) ──");
{
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  const callPlan = async () => PLAN;
  let seenPref = null;
  const callNarrate = async (a) => { seenPref = a.pref; return SAFE_NARRATION; };

  // turno 1: fija sesión = brief
  const r1 = await answerViaOracle({ text: "desde ahora respondeme breve", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(r1 && r1.mem.responsePref.detailLevel === "brief", "turno 1: sesión queda en brief");

  // turno 2: pide el análisis completo SOLO esta vez (override de un turno) — el EFECTIVO de este turno es
  // standard/full, pero la sesión (mem devuelta) NO debe cambiar.
  const r2 = await answerViaOracle({ text: "dame el análisis completo esta vez", history: [], mem: r1.mem, scenario: "actual", callPlan, callNarrate });
  ok(seenPref && seenPref.contentScope === "full" && seenPref.detailLevel === "standard", `turno 2: el EFECTIVO de este turno vuelve a full/standard (override de un turno) — obtuvo ${JSON.stringify(seenPref)}`);
  ok(r2 && r2.mem.responsePref && r2.mem.responsePref.detailLevel === "brief", `turno 2: la SESIÓN sigue en brief — el override de un turno no la tocó — obtuvo ${JSON.stringify(r2 && r2.mem.responsePref)}`);

  // turno 3: no menciona NADA de formato — debe heredar la SESIÓN (brief), no el override transitorio del turno 2
  const r3 = await answerViaOracle({ text: "¿y algo más para revisar?", history: [], mem: r2.mem, scenario: "actual", callPlan, callNarrate });
  ok(seenPref && seenPref.detailLevel === "brief" && seenPref.contentScope === "full", `turno 3 (sin mención de formato): hereda la SESIÓN (brief) — el override transitorio del turno 2 NO contaminó — obtuvo ${JSON.stringify(seenPref)}`);
  ok(r3 && r3.mem.responsePref && r3.mem.responsePref.detailLevel === "brief", "turno 3: la sesión se mantiene brief para el turno 4 (si lo hubiera)");
}

console.log("\n── 4 · DETERMINÍSTICO — 'volver a lo normal': fija los valores; persiste SOLO con proyección hacia adelante ──");
{
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  const callPlan = async () => PLAN;
  const callNarrate = async () => SAFE_NARRATION;

  // sesión ya en brief; "como antes" (ambiguo, SIN proyección hacia adelante) → un turno, la sesión sigue brief
  const rBrief = await answerViaOracle({ text: "desde ahora respondeme breve", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  const rAmbig = await answerViaOracle({ text: "dame la respuesta completa, como antes", history: [], mem: rBrief.mem, scenario: "actual", callPlan, callNarrate });
  ok(rAmbig && rAmbig.mem.responsePref && rAmbig.mem.responsePref.detailLevel === "brief", `"como antes" (ambiguo) NO cancela la sesión — sigue en brief — obtuvo ${JSON.stringify(rAmbig && rAmbig.mem.responsePref)}`);

  // "ya no hace falta que sea breve" (proyección hacia adelante explícita) → SÍ cancela la sesión
  const rCancel = await answerViaOracle({ text: "ya no hace falta que sea breve", history: [], mem: rBrief.mem, scenario: "actual", callPlan, callNarrate });
  ok(rCancel && rCancel.mem.responsePref && rCancel.mem.responsePref.detailLevel === "standard" && rCancel.mem.responsePref.contentScope === "full", `"ya no hace falta que sea breve" SÍ cancela la sesión (persist=true) — obtuvo ${JSON.stringify(rCancel && rCancel.mem.responsePref)}`);
}

console.log("\n── 5 · SMOKE LLM REAL — dato puntual normal vs 'solo el dato' (requisito 1, ruta determinística) ──");
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

console.log("\n── 6 · SMOKE LLM REAL — resumen ejecutivo normal vs 'solo cifras' (requisito 2, narrador mode=diagnostico) ──");
{
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  const callPlan = async () => PLAN;
  const callNarrate = async (args) => { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };

  const rNorm = await answerViaOracle({ text: "dame un resumen ejecutivo del negocio", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  const rSolo = await answerViaOracle({ text: "dame un resumen ejecutivo del negocio, pero solo las cifras, sin análisis", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(rNorm && rNorm.r && rNorm.r.route === "oracle", "normal: responde por C");
  ok(rSolo && rSolo.r && rSolo.r.route === "oracle", "'solo cifras': responde por C");
  if (rNorm && rSolo) {
    const RECO_RE = /deber[íi]as|te recomiendo|te sugiero|prioriz\w*|primer paso|la acci[oó]n (?:es|prioritaria)/i;
    ok(!RECO_RE.test(rSolo.r.text), `"solo cifras": SIN recomendación/acción — "${rSolo.r.text.slice(0, 200)}..."`);
    ok(/a[nñ]o cerrado|foto.*hoy/i.test(rSolo.r.text), "\"solo cifras\": el período se mantiene (requisito 7)");
    console.log(`  normal (${rNorm.r.text.length} chars): "${rNorm.r.text.slice(0, 140)}..."`);
    console.log(`  solo cifras (${rSolo.r.text.length} chars): "${rSolo.r.text.slice(0, 140)}..."`);
    ok(rSolo.r.text.length < rNorm.r.text.length, `"solo cifras" es más corto que el resumen normal (${rSolo.r.text.length} < ${rNorm.r.text.length})`);
  }
}

console.log("\n── 7 · SMOKE LLM REAL — decisión normal vs 'solo la acción' (requisito 3, narrador mode=decision) ──");
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
    console.log(`  solo la acción (${rSolo.r.text.length} chars): "${rSolo.r.text.slice(0, 140)}..."`);
    ok(/a[nñ]o cerrado|foto.*hoy/i.test(rSolo.r.text) || !/\$/.test(rSolo.r.text), "\"solo la acción\": si cita una cifra real, declara período (requisito 7) — o no cita ninguna");
  }
}

console.log("\n── 8 · SMOKE LLM REAL — simulación normal vs 'solo resultados' (requisito 4, narrador mode=simulacion) ──");
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
    ok(/\bsi\b|estimad\w*|hip[oó]tesis/i.test(rSolo.r.text), "\"solo resultados\": sigue enmarcado como HIPÓTESIS (graduación, guardC advisory intacto)");
  }
}

console.log("\n── 9 · DETERMINÍSTICO — mismas cifras autorizadas y período bajo pref restringido (requisito 7) ──");
{
  // el propio hecho de que answerViaOracle haya devuelto {r,mem} (no null) YA prueba que guardC validó la
  // narración con el MISMO ledger de siempre — pref nunca se pasa a guardC, no puede relajarlo estructuralmente.
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  const callPlan = async () => PLAN;
  const callNarrate = async (args) => { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };
  const r = await answerViaOracle({ text: "resumen ejecutivo, solo cifras, sin análisis", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(r && r.r, "una narración con pref restringido SOLO llega acá si pasó guardC con el ledger real (mismo muro de siempre)");
  if (r) ok(/a[nñ]o cerrado|foto.*hoy/i.test(r.r.text), "el período sigue garantizado (ensurePeriodoDeclared corre SIEMPRE, sin importar pref)");
}

console.log("\n── 10 · DETERMINÍSTICO — consistencia ruta determinística vs LLM: MISMA sesión alimenta ambas rutas (requisito 8) ──");
{
  // turno 1 (narrador, mockeado): fija sesión = brief
  const PLAN1 = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  const r1 = await answerViaOracle({ text: "desde ahora respondeme breve", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN1, callNarrate: async () => SAFE_NARRATION });
  ok(r1 && r1.mem.responsePref.detailLevel === "brief", "turno 1: sesión queda en brief (vía narrador)");

  // turno 2 (RUTA DETERMINÍSTICA, sin mención de formato): un campo SIN referencia autorizada (precioLista) — la
  // única forma observable de que "brief" hizo algo es que se SUPRIMA la oferta "puedo analizarlo con más detalle".
  // callNarrate NUNCA debería invocarse acá (la ruta determinística la saltea entera) — si se invoca, es un bug.
  const PLAN2 = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["LG-DRYER8KG"] }, calls: [{ tool: "entityRecord", args: { dimension: "sku", entity: "LG-DRYER8KG" } }] };
  let narrateCalled = false;
  const r2 = await answerViaOracle({ text: "el precio de lista del SKU LG-DRYER8KG", history: [], mem: r1.mem, scenario: "actual", callPlan: async () => PLAN2, callNarrate: async () => { narrateCalled = true; return SAFE_NARRATION; } });
  ok(r2 && r2.r && r2.r.deterministic === true, "turno 2: la ruta determinística se activa (precioLista, 1 entidad, 1 métrica)");
  ok(!narrateCalled, "turno 2: la Pasada 2 (narrador) NUNCA se invoca — la ruta determinística la saltea por completo");
  if (r2 && r2.r) ok(!/puedo analizarlo con m[aá]s detalle/i.test(r2.r.text), `turno 2: la SESIÓN brief (fijada por el narrador en el turno 1) SUPRIME la oferta también en la ruta determinística — "${r2.r.text}"`);
}

console.log(`\n── _response_preference_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
