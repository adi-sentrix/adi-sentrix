/* === _response_preference_gate.mjs · PREFERENCIA DE RESPUESTA (owner 2026-07-29, 2 residuales cerrados) ===
 * v1: doctrina de prosa libre — el narrador ignoraba las marcas. v2: bloques + renderer — cerró ESA fuga, pero el
 * owner probó una más profunda con un ejemplo concreto: "[[DATOS]] Ventas: $100M. Te recomiendo renegociar con
 * Falabella." — la ETIQUETA es correcta, el CONTENIDO no. Un renderer que solo mira qué bloque sobrevive no ve eso.
 *
 * v3 (este gate): "que 'no puede pasar' sea LITERALMENTE cierta."
 *   - data_only / results_only: GARANTÍA POR CONSTRUCCIÓN. answerViaOracle.js YA NO INVOCA al narrador libre para
 *     estos dos alcances — cero superficie lingüística. Compone SIEMPRE desde la boleta. No hay contenido de LLM
 *     que validar porque no hay contenido de LLM en absoluto. Las secciones 5-6 lo prueban con espías: el mock de
 *     callNarrate está armado para devolver EXACTAMENTE el ejemplo adversarial del owner, listo para fallar — y
 *     nunca se invoca.
 *   - action_only: el ÚNICO alcance que sigue narrando libre (la recomendación es juicio, no solo datos). Doble
 *     candado: el renderer descarta cualquier bloque que no sea [[ACCION]] (v2), Y hasForbiddenContent() valida el
 *     CONTENIDO del bloque permitido — si coló lenguaje de causa o de siguiente-paso, el intento se DESCARTA
 *     ENTERO y reintenta (sección 7). "Repite el patrón" del owner, aplicado al único lugar donde aplica.
 *
 * Mapeo a los puntos originales + los 2 residuales:
 *   1) dato puntual normal vs "solo el dato"                    → sección 11 (ruta determinística, sin bloques)
 *   2) resumen ejecutivo normal vs "solo cifras"                → secciones 5/6 (determinístico) + 12 (full, smoke)
 *   3) decisión normal vs "solo la acción"                      → sección 13 (narrador SIGUE siendo real acá)
 *   4) simulación normal vs "solo resultados"                   → secciones 5/6 (determinístico) + 14 (full, smoke)
 *   5) preferencia de un turno vs persistente                   → sección 2
 *   6) continuidad posterior sin contaminación                  → sección 3
 *   7) mismas cifras autorizadas y período                      → sección 15
 *   8) comportamiento consistente en ruta determinística y LLM  → sección 16
 *   + "volver a lo normal" cancela SIEMPRE la sesión            → sección 4
 *   + CONTENIDO PROHIBIDO nunca llega, aun bien etiquetado       → secciones 5, 6, 7, 8, 9 — el corazón del v3
 * Secciones 1-10 y 15-16 son 100% DETERMINÍSTICAS (callPlan/callNarrate mockeados, cero LLM real, cero variance).
 * Secciones 11-14 son SMOKE LLM REAL — señal complementaria sobre calidad/formato, NUNCA la garantía en sí.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { parseBlocks, renderFromBlocks, composeFromLedger, hasForbiddenContent } from "./src/adi/oracle/narrationBlocks.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

const SAFE_NARRATION = "El negocio se mantiene estable este período, sin sobresaltos que merezcan una alerta.";
// el EJEMPLO EXACTO del owner: recomendación DENTRO de un bloque [[DATOS]] bien etiquetado — si esto alguna vez
// llegara al narrador y el narrador lo devolviera, tendría que aparecer en el texto final. La prueba de las
// secciones 5-6 es que NUNCA se invoca callNarrate para data_only/results_only — este mock queda listo para
// fallar y nunca se ejecuta.
const OWNER_ADVERSARIAL = "[[DATOS]]\nVentas: $100M. Te recomiendo renegociar con Falabella.\n[[INTERPRETACION]]\n...";

console.log("── 1 · DETERMINÍSTICO — _coercePref: el LLM manda, la red SOLO fuerza ante frase inequívoca (mismo patrón que _coerceMode) ──");
{
  const PLAN_A = { intent: "answer", mode: "decision", calls: [{ tool: "diagnose", args: {} }], pref: { contentScope: "action_only" } };
  let seenA = null;
  const rA = await answerViaOracle({ text: "por dónde arranco", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_A, callNarrate: async (a) => { seenA = a.pref; return "[[ACCION]]" + SAFE_NARRATION; } });
  ok(rA && rA.r && rA.r.route === "oracle", "1a: responde por C");
  ok(seenA && seenA.contentScope === "action_only", `1a: action_only SÍ invoca al narrador (es el único alcance que narra libre) y recibe el pref del LLM sin tocar — obtuvo ${JSON.stringify(seenA)}`);

  const PLAN_B = { intent: "answer", mode: "decision", calls: [{ tool: "diagnose", args: {} }] };
  let seenB = null;
  const rB = await answerViaOracle({ text: "¿a cuál priorizo? dame solo la acción, sin el diagnóstico", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_B, callNarrate: async (a) => { seenB = a.pref; return "[[ACCION]]" + SAFE_NARRATION; } });
  ok(seenB && seenB.contentScope === "action_only", `1b: la red fuerza action_only por frase inequívoca aunque el LLM no la haya marcado — obtuvo ${JSON.stringify(seenB)}`);

  // 1c/1d: results_only/data_only NUNCA invocan al narrador — no hay "pref que reciba", así que la prueba correcta
  // es la AUSENCIA de la llamada, no lo que hubiera recibido. Detalle completo en la sección 5.
  const PLAN_C = { intent: "answer", mode: "simulacion", calls: [{ tool: "simulateCarga", args: {} }] };
  let calledC = false;
  const rC = await answerViaOracle({ text: "¿y si bajo la carga al target? dame solo los resultados, sin recomendación", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_C, callNarrate: async () => { calledC = true; return SAFE_NARRATION; } });
  ok(!calledC, "1c: en simulación, 'sin recomendación' → results_only resuelve SIN invocar al narrador");
  ok(rC && rC.r && rC.r.narrationRepaired === true, `1c: la respuesta salió de composeFromLedger — "${rC && rC.r && rC.r.text.slice(0, 80)}..."`);

  const PLAN_D = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  let calledD = false;
  const rD = await answerViaOracle({ text: "dame un resumen ejecutivo, sin análisis", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_D, callNarrate: async () => { calledD = true; return SAFE_NARRATION; } });
  ok(!calledD, "1d: fuera de una simulación, 'sin análisis' → data_only resuelve SIN invocar al narrador");
  ok(rD && rD.r && rD.r.narrationRepaired === true, `1d: la respuesta salió de composeFromLedger — "${rD && rD.r && rD.r.text.slice(0, 80)}..."`);
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

  // "solo esta vez" + data_only: el narrador NUNCA se invoca (garantía por construcción) — el mock queda listo
  // para fallar (lanza si se llama) y la persistencia se prueba igual, sin depender de él.
  const PLAN_STICKY = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }], pref: { contentScope: "data_only", persist: true } };
  let calledSticky = false;
  const rC = await answerViaOracle({ text: "solo esta vez, sin análisis", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_STICKY, callNarrate: async () => { calledSticky = true; return SAFE_NARRATION; } });
  ok(!calledSticky, "el narrador NUNCA se invoca para data_only (ni siquiera para este caso de persist=true)");
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

console.log("\n── 4 · DETERMINÍSTICO — 'volver a lo normal' SIEMPRE cancela la sesión ──");
{
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  const callPlan = async () => PLAN;
  const callNarrate = async () => SAFE_NARRATION;

  const rBrief = await answerViaOracle({ text: "desde ahora respondeme breve", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(rBrief.mem.responsePref.detailLevel === "brief", "sesión inicial en brief");

  const rReset = await answerViaOracle({ text: "dame la respuesta completa, como antes", history: [], mem: rBrief.mem, scenario: "actual", callPlan, callNarrate });
  ok(rReset && rReset.mem.responsePref && rReset.mem.responsePref.detailLevel === "standard" && rReset.mem.responsePref.contentScope === "full", `"como antes" CANCELA la sesión SIN condición — obtuvo ${JSON.stringify(rReset && rReset.mem.responsePref)}`);

  const rNext = await answerViaOracle({ text: "¿y algo más?", history: [], mem: rReset.mem, scenario: "actual", callPlan, callNarrate });
  ok(rNext && rNext.mem.responsePref && rNext.mem.responsePref.detailLevel === "standard", `el turno SIGUIENTE NO vuelve a breve — obtuvo ${JSON.stringify(rNext && rNext.mem.responsePref)}`);

  const rCancel = await answerViaOracle({ text: "ya no hace falta que sea breve", history: [], mem: rBrief.mem, scenario: "actual", callPlan, callNarrate });
  ok(rCancel && rCancel.mem.responsePref && rCancel.mem.responsePref.detailLevel === "standard", `"ya no hace falta que sea breve" cancela la sesión — obtuvo ${JSON.stringify(rCancel && rCancel.mem.responsePref)}`);

  const rOneTurnReset = await answerViaOracle({ text: "dame el análisis completo, pero solo por esta vez", history: [], mem: rBrief.mem, scenario: "actual", callPlan, callNarrate });
  ok(rOneTurnReset && rOneTurnReset.mem.responsePref && rOneTurnReset.mem.responsePref.detailLevel === "brief", `"solo por esta vez" sigue ganando incluso sobre un reset — la sesión NO se cancela — obtuvo ${JSON.stringify(rOneTurnReset && rOneTurnReset.mem.responsePref)}`);
}

console.log("\n── 5 · GARANTÍA POR CONSTRUCCIÓN — data_only/results_only NUNCA invocan al narrador, ni con el ejemplo EXACTO del owner listo para fallar ──");
{
  const PLAN_DATA = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }], pref: { contentScope: "data_only" } };
  let calledData = false;
  const rData = await answerViaOracle({ text: "resumen ejecutivo, solo cifras", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_DATA, callNarrate: async () => { calledData = true; return OWNER_ADVERSARIAL; } });
  ok(!calledData, "data_only: callNarrate JAMÁS se invoca — no importa que el mock esté armado con el ejemplo exacto del owner");
  ok(rData && rData.r, "responde por C igual (compuesto desde la boleta)");
  if (rData) {
    ok(!/te recomiendo|renegoci/i.test(rData.r.text), `el texto final NO contiene la recomendación — estructuralmente IMPOSIBLE, no solo improbable — "${rData.r.text.slice(0, 100)}..."`);
    ok(rData.r.narrationRepaired === true, "telemetría honesta: la respuesta es 100% composeFromLedger");
  }

  const PLAN_RES = { intent: "answer", mode: "simulacion", calls: [{ tool: "simulateCarga", args: {} }], pref: { contentScope: "results_only" } };
  let calledRes = false;
  const rRes = await answerViaOracle({ text: "¿y si bajo la carga al target? solo resultados", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_RES, callNarrate: async () => { calledRes = true; return OWNER_ADVERSARIAL; } });
  ok(!calledRes, "results_only: callNarrate JAMÁS se invoca — mismo candado que data_only");
  if (rRes) ok(!/te recomiendo|renegoci/i.test(rRes.r.text), `results_only: texto final tampoco puede tener la recomendación — "${rRes.r.text.slice(0, 100)}..."`);
}

console.log("\n── 6 · GARANTÍA POR CONSTRUCCIÓN — sin figs (turno degenerado), cede al narrador como última red (caso límite, no el camino común) ──");
{
  // única vía por la que data_only/results_only PODRÍAN llegar a invocar al narrador: composeFromLedger no tuvo
  // NADA con qué componer (boleta vacía). Ahí sí se intenta narrar (no hay nada que una recomendación pudiera
  // "colarse en" — tampoco hay datos que mostrar), y el guard normal sigue corriendo sobre lo que sea que devuelva.
  const PLAN_EMPTY = { intent: "ack", mode: "diagnostico", calls: [], pref: { contentScope: "data_only" } };
  let calledEmpty = false;
  const rEmpty = await answerViaOracle({ text: "solo cifras", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_EMPTY, callNarrate: async () => { calledEmpty = true; return SAFE_NARRATION; } });
  ok(calledEmpty || rEmpty === null, "sin boleta (calls vacío) → cede al narrador como red final, o se abstiene honesto — nunca inventa una tabla de la nada");
}

console.log("\n── 7 · action_only — contaminación INTERNA del bloque permitido: 'repite el patrón' pedido por el owner ──");
{
  const PLAN = { intent: "answer", mode: "decision", calls: [{ tool: "diagnose", args: {} }], pref: { contentScope: "action_only" } };
  let attempts = 0;
  // el ANÁLOGO exacto del ejemplo del owner, pero para action_only: la etiqueta [[ACCION]] es correcta, el
  // contenido reconstruye la CAUSA (eso es INTERPRETACION, prohibido acá).
  const contaminated = async () => { attempts++; return "[[ACCION]]\nRenegociá con Falabella. Esto se debe a que tiene mucho poder de negociación y presiona precios."; };
  const r = await answerViaOracle({ text: "¿a cuál priorizo? solo la acción", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: contaminated });
  ok(attempts === 3, `los 3 intentos se agotan (contenido contaminado descartado ENTERO cada vez, nunca se edita a mano) — obtuvo ${attempts}`);
  ok(r && r.r, "NUNCA se abstiene — repara componiendo desde la boleta");
  if (r) {
    ok(!/esto se debe a|poder de negociaci[oó]n/i.test(r.r.text), `el texto final NO tiene la causa colada — "${r.r.text}"`);
    ok(r.r.narrationRepaired === true, "telemetría honesta: los 3 intentos del narrador fallaron, se reparó");
  }

  // control: lenguaje de SIGUIENTE_PASO colado (pregunta de cierre) TAMBIÉN se detecta y descarta
  let attempts2 = 0;
  const contaminated2 = async () => { attempts2++; return "[[ACCION]]\nRenegociá con Falabella. ¿Querés que profundice en el mecanismo?"; };
  const r2 = await answerViaOracle({ text: "solo la acción", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: contaminated2 });
  ok(attempts2 === 3, `pregunta de cierre colada en [[ACCION]] TAMBIÉN se detecta y descarta los 3 intentos — obtuvo ${attempts2}`);
  if (r2) ok(!/quer[eé]s que profundice/i.test(r2.r.text), `"${r2.r.text}"`);
}

console.log("\n── 8 · action_only — contenido LIMPIO pasa en el primer intento (control: el detector no genera falsos positivos) ──");
{
  const PLAN = { intent: "answer", mode: "decision", calls: [{ tool: "diagnose", args: {} }], pref: { contentScope: "action_only" } };
  let attempts = 0;
  const clean = async () => { attempts++; return "[[ACCION]]\nRenegociá la carga comercial con Falabella, hoy en $194K."; };
  const r = await answerViaOracle({ text: "solo la acción", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: clean });
  ok(attempts === 1, `contenido limpio pasa en el PRIMER intento, sin reintentos innecesarios — obtuvo ${attempts}`);
  ok(r && r.r && !r.r.narrationRepaired, "NO quedó marcado como reparado — es la narración libre real, no la de emergencia");
  if (r) ok(/renegoci[aá]/i.test(r.r.text), `"${r.r.text}"`);
}

console.log("\n── 9 · DETERMINÍSTICO (unit) — hasForbiddenContent + composeFromLedger(action_only) nunca elige un subtotal ──");
{
  ok(hasForbiddenContent("Renegociá con Falabella. Esto se debe a que tiene mucho poder de negociación.", "action_only"), "detecta causa colada ('esto se debe a')");
  ok(hasForbiddenContent("Renegociá con Falabella. ¿Querés que profundice?", "action_only"), "detecta pregunta de siguiente-paso colada");
  ok(!hasForbiddenContent("Renegociá la carga comercial con Falabella, hoy en $194K.", "action_only"), "contenido limpio NO dispara falsos positivos");
  ok(!hasForbiddenContent("Cualquier cosa", "data_only"), "data_only siempre false (nunca narra libre, no hay nada que validar)");

  const figs = [
    { label: "Contribución no capturada · subtotal", value: "$4.9M", raw: 4900000 },
    { label: "Contribución no capturada · Falabella", value: "$1.6M", raw: 1600000 },
    { label: "Ventas del período", value: "$100.0M", raw: 100000000 },
  ];
  const composed = composeFromLedger(figs, "action_only");
  ok(/Falabella/.test(composed) && !/subtotal/i.test(composed), `elige la entidad real de mayor magnitud, NUNCA el subtotal ni un KPI sin entidad — "${composed}"`);
}

console.log("\n── 10 · DETERMINÍSTICO (unit) — parseBlocks/renderFromBlocks siguen siendo la garantía para action_only y para full ──");
{
  const adversarial = "[[DATOS]]El rebate de Falabella es 4.5%, en el año cerrado.[[ACCION]]Deberías renegociar el rebate YA, es urgente.[[INTERPRETACION]]Esto pasa porque el cliente tiene mucho poder de negociación.[[SIGUIENTE_PASO]]¿Querés que profundice?";
  const parsed = parseBlocks(adversarial);
  ok(parsed && parsed.datos && parsed.accion && parsed.interpretacion && parsed.siguiente_paso, "parseBlocks separa los 4 bloques correctamente");

  const actionOnly = renderFromBlocks(parsed, "action_only");
  ok(!/rebate de Falabella es 4\.5%|poder de negociaci[oó]n|profundice/i.test(actionOnly), `action_only: [[DATOS]]/[[INTERPRETACION]]/[[SIGUIENTE_PASO]] se descartan por el RENDERER — "${actionOnly}"`);
  ok(/deber[íi]as renegociar/i.test(actionOnly), "action_only: el bloque [[ACCION]] permitido sobrevive (y luego pasaría por hasForbiddenContent, sección 7)");

  const full = renderFromBlocks(parsed, "full");
  ok(/rebate de Falabella|deber[íi]as renegociar|poder de negociaci[oó]n|profundice/.test(full), "full: los 4 bloques sobreviven, en orden (full nunca restringe)");

  ok(parseBlocks("texto plano sin ninguna marca") === null, "sin marcas [[...]] → parseBlocks devuelve null (falla estructural detectable)");
}

console.log("\n── 11 · SMOKE LLM REAL — dato puntual normal vs 'solo el dato' (requisito 1, ruta determinística — sin bloques, no aplica acá) ──");
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

console.log("\n── 12 · SMOKE LLM REAL — resumen ejecutivo normal (full, narrador real) — el lado 'solo cifras' ya es determinístico (sección 5) ──");
{
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  const callPlan = async () => PLAN;
  const callNarrate = async (args) => { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };
  const rNorm = await answerViaOracle({ text: "dame un resumen ejecutivo del negocio", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(rNorm && rNorm.r && rNorm.r.route === "oracle", "normal: responde por C");
  if (rNorm) console.log(`  normal (${rNorm.r.text.length} chars): "${rNorm.r.text.slice(0, 140)}..."`);
}

console.log("\n── 13 · SMOKE LLM REAL — decisión normal vs 'solo la acción' (requisito 3 — action_only SIGUE narrando libre, esto es real) ──");
{
  const PLAN = { intent: "answer", mode: "decision", calls: [{ tool: "diagnose", args: {} }] };
  const callPlan = async () => PLAN;
  const callNarrate = async (args) => { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };

  const rNorm = await answerViaOracle({ text: "¿a cuál cliente le priorizo primero?", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  const rSolo = await answerViaOracle({ text: "¿a cuál cliente le priorizo primero? dame solo la acción, sin el diagnóstico", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(rNorm && rNorm.r && rNorm.r.route === "oracle", "normal: responde por C");
  ok(rSolo && rSolo.r && rSolo.r.route === "oracle", "'solo la acción': responde por C (narrador real O reparación — ambos válidos, ver secciones 7-8)");
  if (rNorm && rSolo) {
    console.log(`  normal (${rNorm.r.text.length} chars): "${rNorm.r.text.slice(0, 140)}..."`);
    console.log(`  solo la acción (${rSolo.r.text.length} chars, repaired:${!!rSolo.r.narrationRepaired}): "${rSolo.r.text.slice(0, 140)}..."`);
    ok(/a[nñ]o cerrado|foto.*hoy/i.test(rSolo.r.text) || !/\$/.test(rSolo.r.text), "\"solo la acción\": si cita una cifra real, declara período (requisito 7) — o no cita ninguna");
  }
}

console.log("\n── 14 · SMOKE LLM REAL — simulación normal (full, narrador real) — el lado 'solo resultados' ya es determinístico (sección 5) ──");
{
  const PLAN = { intent: "answer", mode: "simulacion", calls: [{ tool: "simulateCarga", args: {} }] };
  const callPlan = async () => PLAN;
  const callNarrate = async (args) => { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };
  const rNorm = await answerViaOracle({ text: "¿y si bajo la carga comercial al target?", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(rNorm && rNorm.r && rNorm.r.route === "oracle", "normal: responde por C");
  if (rNorm) ok(/\bsi\b|estimad\w*|hip[oó]tesis/i.test(rNorm.r.text), "sigue enmarcado como hipótesis (graduación intacta)");
}

console.log("\n── 15 · DETERMINÍSTICO — mismas cifras autorizadas y período bajo pref restringido (requisito 7) ──");
{
  // el hecho de que answerViaOracle haya devuelto {r,mem} (no null) YA prueba que guardC validó con el ledger real
  // — pref nunca se pasa a guardC, ni la ruta "compone siempre" ni la ruta "narra con doble candado" pueden relajarlo.
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }], pref: { contentScope: "data_only" } };
  const r = await answerViaOracle({ text: "resumen ejecutivo, solo cifras, sin análisis", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async () => { throw new Error("no debería invocarse"); } });
  ok(r && r.r, "una narración con pref restringido SOLO llega acá si pasó guardC con el ledger real (mismo muro de siempre) — y ni siquiera necesitó al narrador");
  if (r) ok(/a[nñ]o cerrado|foto.*hoy/i.test(r.r.text), "el período sigue garantizado (ensurePeriodoDeclared corre SIEMPRE, sin importar pref)");
}

console.log("\n── 16 · DETERMINÍSTICO — consistencia ruta determinística vs LLM: MISMA sesión alimenta ambas rutas (requisito 8) ──");
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
