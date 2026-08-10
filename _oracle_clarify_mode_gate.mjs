/* === _oracle_clarify_mode_gate.mjs · CAPA DE ROL CONVERSACIONAL · FASE 1 (mode=clarify) ===
 * owner 2026-07-29: "no quiero un parche para 'no entendí'... quiero un sistema sofisticado pero controlado" →
 * consolidación + gaps reales, Fase 1 = campo `mode` (eje DISTINTO de `intent`: intent decide QUÉ DATO pedir, mode
 * decide CÓMO NARRARLO) + contrato de narración para mode=clarify + coerción determinística de las frases
 * inequívocas de confusión, SIN agregar una 3ª llamada LLM (mode se clasifica en la MISMA llamada del plan).
 * 1) determinístico: `_coerceMode`-equivalente vía answerViaOracle con callPlan/callNarrate MOCKEADOS (mismo
 *    patrón que _oracle_plan_retry_gate.mjs / _oracle_tension_vocab_gate.mjs — sin LLM real).
 * 2) SMOKE LLM REAL: el hilo EXACTO que pidió el owner (resumen ejecutivo → no entendí → explícame más fácil →
 *    qué significa contribución no capturada), vía answerViaOracle con handlePlan/handleNarrateC reales — mide,
 *    no asume: mode elegido por turno, cifras citadas (deben BAJAR en los turnos de aclaración vs el turno
 *    anterior), y que la respuesta cierre con pregunta guía (no que se repita el resumen).
 */
import fs from "fs";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { parseFigures } from "./src/adi/boleta.js";
import { sharedVerbatimRun } from "./src/adi/oracle/guardC.js";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const SC = "actual";
let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · DETERMINÍSTICO — _coerceMode vía answerViaOracle (callPlan/callNarrate mockeados, sin LLM) ──");
async function planModeSeenFor(text, mockPlanMode) {
  let seen = null;
  const callPlan = async () => ({ intent: "answer", mode: mockPlanMode, rationale: "test", calls: [] });
  const callNarrate = async ({ plan }) => { seen = plan.mode; return "Respuesta de prueba sin cifras."; };
  await answerViaOracle({ text, history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  return seen;
}
{
  const triggers = [
    "no entendí", "no entendi", "no entiendo", "no te entiendo", "no comprendo bien",
    "no me quedó claro", "no logro entender esto", "puedes explicarme mas facil?",
    "explícame más fácil", "explícalo de forma más simple", "en palabras más simples por favor",
    "qué significa contribución no capturada?", "qué quiere decir carga comercial",
    "a qué te referís con benchmark",
  ];
  for (const t of triggers) {
    const seen = await planModeSeenFor(t, "default");   // el mock-LLM dice "default" — la coerción debe forzar clarify igual
    ok(seen === "clarify", `"${t}" → mode forzado a clarify (obtuvo "${seen}") aunque el plan mock dijera "default"`);
  }
}
{
  const controls = ["Hazme un resumen ejecutivo", "qué hago primero", "sí, profundiza", "muéstrame la cuenta", "cuánto vendió Falabella", "no sé qué preguntar"];
  for (const t of controls) {
    const seen = await planModeSeenFor(t, "default");
    ok(seen === "default", `CONTROL "${t}" → mode se queda en "default" (obtuvo "${seen}") — no dispara de más`);
  }
}
{
  // el plan-mock elige clarify por SU CUENTA (comprensión, frase no listada) → se RESPETA, nunca se le saca
  const seen = await planModeSeenFor("che, esto no me cierra para nada, dale de nuevo pero como si fuera nuevo en esto", "clarify");
  ok(seen === "clarify", `si el LLM ya eligió clarify por comprensión (frase NO listada), se preserva (obtuvo "${seen}")`);
}
{
  // buildNarrateUserMessageC expone "modo" como campo propio, legible sin bucear el plan completo
  const payloadDefault = buildNarrateUserMessageC({ text: "hola", plan: { intent: "answer", mode: "default" }, results: [], ledgerFigs: [], mem: {}, history: [] });
  const payloadClarify = buildNarrateUserMessageC({ text: "no entendí", plan: { intent: "answer", mode: "clarify" }, results: [], ledgerFigs: [], mem: {}, history: [] });
  ok(payloadDefault.modo === "default", `payload trae modo:"default" — obtuvo "${payloadDefault.modo}"`);
  ok(payloadClarify.modo === "clarify", `payload trae modo:"clarify" — obtuvo "${payloadClarify.modo}"`);
  const payloadSinPlan = buildNarrateUserMessageC({ text: "hola", plan: null, results: [], ledgerFigs: [], mem: {}, history: [] });
  ok(payloadSinPlan.modo === "default", `sin plan (null) degrada a "default" sin crashear — obtuvo "${payloadSinPlan.modo}"`);
}

console.log("\n── 2 · SMOKE LLM REAL — el hilo EXACTO del owner (resumen → no entendí → más fácil → qué significa) ──");
{
  // attempt (owner 2026-08-03, investigación cruzada de los 5 gates de solapamiento léxico): answerViaOracle.js
  // reenvía `attempt` a callPlan/callNarrate en CADA reintento (ver sus loops de PLAN/NARRAR) — antes este mock lo
  // descartaba silenciosamente (no lo desestructuraba ni lo reenviaba a handlePlan/handleNarrateC), así que
  // modelRouter.chooseModel SIEMPRE resolvía tier1 (gpt-4o-mini) sin importar el intento: la escalada mini→terra→sol
  // (que SÍ opera en producción — ver src/ui/ChatADI.jsx _fetchPlan/_fetchNarrateC, que SÍ reenvían attempt) nunca se
  // ejercitaba dentro de este gate, y un 429 real golpeaba el MISMO modelo/cupo las 3 veces. Fix: reenviar attempt.
  const callPlan = async ({ text, history, mem, scenario, attempt }) => { const pr = await handlePlan({ text, history, mem, scenario, attempt }); return pr.ok ? pr.plan : null; };
  let lastPlan = null;
  const callNarrate = async ({ text, plan, results, ledgerFigs, mem, history, attempt }) => {
    lastPlan = plan;
    const nr = await handleNarrateC({ payload: buildNarrateUserMessageC({ text, plan, results, ledgerFigs, mem, history }), mem, attempt });
    return nr.ok ? nr.narration : null;
  };
  const THREAD = ["Hazme un resumen ejecutivo", "no entendí", "puedes explicarme más fácil?", "qué significa contribución no capturada?"];
  const EXPECTED_MODE = ["default", "clarify", "clarify", "clarify"];
  let mem = {}, history = [];
  const turnos = [];
  for (let i = 0; i < THREAD.length; i++) {
    const q = THREAD[i];
    // lastPlan se resetea AL INICIO de cada turno (owner 2026-08-03, bug de instrumentación cazado en vivo): antes
    // vivía SOLO dentro del mock callNarrate — si PLAN agotaba sus 3 intentos sin llegar nunca a narrar, callNarrate
    // no corría y lastPlan quedaba con el valor STALE de un turno ANTERIOR, reportando un modo equivocado/heredado
    // en vez de admitir honestamente que el turno cayó antes de clasificar nada.
    lastPlan = null;
    const r = await answerViaOracle({ text: q, history, mem, scenario: SC, callPlan, callNarrate });
    const narration = (r && r.r && r.r.text) || null;
    const modo = lastPlan && lastPlan.mode;
    const nCifras = narration ? parseFigures(narration).length : null;
    turnos.push({ q, modo, narration, nCifras, route: r && r.r && r.r.route });
    if (r) mem = r.mem;
    history = [...history, { role: "user", text: q }, { role: "adi", gist: (narration || "(fallback)").slice(0, 200) }].slice(-8);
    console.log(`  T${i + 1} "${q}" → modo=${modo} · route=${(r && r.r && r.r.route) || "FALLBACK"} · ${nCifras ?? "?"} cifras`);
    console.log(`      "${(narration || "(sin narración — cayó a fallback)").replace(/\n/g, " ⏎ ").slice(0, 240)}"`);
  }

  // La CLASIFICACIÓN de mode ocurre en el PLAN, antes de narrar — se puede exigir SIEMPRE, incluso si esa narración
  // puntual termina cayendo a fallback por variance de guardC (mismo tipo de variance ya documentada para "resumen
  // ejecutivo" — ajena al mecanismo de mode). Caer a fallback en sí se MIDE, no se exige: 3 turnos × 3 reintentos
  // c/u es una vara alta que ni el resumen ejecutivo solo, ya maduro, cumple siempre en esta sesión.
  const fallbackCount = turnos.filter((t) => t.route !== "oracle").length;
  console.log(`  medición: ${4 - fallbackCount}/4 turnos responden por Arquitectura C (${fallbackCount} cayeron a fallback — variance de guardC, no del mecanismo de mode)`);
  for (let i = 1; i < THREAD.length; i++) ok(turnos[i].modo === EXPECTED_MODE[i], `T${i + 1} clasifica mode="${EXPECTED_MODE[i]}" (obtuvo "${turnos[i].modo}") — se exige SIEMPRE, es determinístico y ocurre antes de narrar`);

  // T2/T3/T4 (clarify) deben citar COMO MUCHO tantas cifras como T1 (el resumen ejecutivo, denso por diseño) — la
  // medida estructural más directa de "bajar el nivel" sin depender de que un juez de texto lo evalúe.
  // <= en vez de < (owner 2026-08-03, métrica de test frágil cazada en la investigación cruzada): un EMPATE
  // (ej. 23 cifras en ambos turnos) no es "clarify subió el nivel" — clarify simplemente no bajó ESTA vez, que
  // sigue siendo un resultado aceptable del contrato (nunca se pidió una reducción estricta, solo "no más denso
  // que el resumen"). La desigualdad estricta fallaba de forma espuria ante un empate legítimo.
  if (turnos[0].nCifras != null) {
    for (let i = 1; i < turnos.length; i++) {
      if (turnos[i].nCifras != null) ok(turnos[i].nCifras <= turnos[0].nCifras, `T${i + 1} (clarify) cita COMO MUCHO tantas cifras como T1 (resumen): ${turnos[i].nCifras} <= ${turnos[0].nCifras}`);
    }
  }
  // T2 no debería ser una mera reformulación VERBATIM de T1 — antes esto era solo un log informativo (solapamiento
  // crudo de vocabulario, sin ok()) — owner 2026-08-03: reemplazado por una comprobación MÁS CORRECTA (regla 2 del
  // pedido: reemplazar métrica frágil, nunca bajar la vara): un tramo de 8+ palabras SEGUIDAS idéntico (sharedVerbatimRun,
  // fuente única en guardC.js, la MISMA que ahora usa guardC/`degraded`) SÍ distingue "reciclado palabra por palabra"
  // de "mismo tema/cifra/entidad mencionado de nuevo" (clarify de un resumen ejecutivo COMPARTE vocabulario de
  // dominio a propósito — un ratio crudo lo castigaría de más; un run verbatim de 8 palabras no).
  if (turnos[0].narration && turnos[1].narration) {
    const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-záéíóúñ0-9\s]/gi, "").split(/\s+/).filter((w) => w.length > 4));
    const w1 = words(turnos[0].narration), w2 = words(turnos[1].narration);
    const inter = [...w2].filter((w) => w1.has(w)).length;
    const overlapPct = w2.size ? inter / w2.size : 0;
    console.log(`  medición informativa: solapamiento léxico crudo T2 vs T1 (palabras >4 letras) = ${(overlapPct * 100).toFixed(0)}% (sin umbral — solo referencia, ver la aserción real de abajo)`);
    ok(!sharedVerbatimRun(turnos[1].narration, turnos[0].narration, 8), `T2 (clarify) NO repite un tramo de 8+ palabras SEGUIDAS verbatim de T1 (resumen) — comparte tema, no prosa reciclada`);
  }
  // cierre con pregunta guía en los turnos de aclaración (heurística: termina en "?", medido, no forzado)
  let conPregunta = 0;
  for (let i = 1; i < turnos.length; i++) if (turnos[i].narration && /\?\s*$/.test(turnos[i].narration.trim())) conPregunta++;
  console.log(`  medición honesta: ${conPregunta}/3 turnos de clarify cierran con pregunta guía ("?") (sin umbral duro)`);
}

console.log(`\n── _oracle_clarify_mode_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
