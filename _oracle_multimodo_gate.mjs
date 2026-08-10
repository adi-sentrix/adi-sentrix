/* === _oracle_multimodo_gate.mjs · CAPA DE ROL CONVERSACIONAL · FASE 2 · CONVERSACIÓN MULTI-MODO ===
 * owner 2026-07-29: "prueba una conversación donde ADI cambie de modo varias veces sin perder el contexto ni
 * repetir la respuesta." Hilo de 6 turnos, diseñado para recorrer 6 de los 7 modos (default/clarify ya probados a
 * fondo en la Fase 1) anclados en la MISMA entidad/mecanismo (Falabella · carga comercial $194K, establecida en el
 * resumen ejecutivo del turno 1) — así "no perder el contexto" es medible (¿sigue hablando de Falabella/carga?),
 * no solo una impresión de lectura:
 *   T1 diagnóstico  · "Hazme un resumen ejecutivo"
 *   T2 decisión     · "¿Qué hago primero?"
 *   T3 seguimiento  · "Sí, profundiza en eso"
 *   T4 evidencia    · "¿De dónde sale ese número de $194K?"
 *   T5 simulación   · "¿Y si negocio esa carga hasta el target?"
 *   T6 clarify      · "No entendí, explícamelo más fácil"
 * mode NO se fuerza determinísticamente para diagnostico/decision/simulacion/seguimiento/evidencia (a diferencia de
 * clarify) — el plan los elige por COMPRENSIÓN, mismo criterio que intent/alcance. Este gate MIDE qué eligió en
 * cada turno (siempre debe ser un valor válido del contrato) y verifica lo que SÍ es exigible determinísticamente:
 * el contexto (Falabella/carga comercial) no se pierde y ningún turno es una repetición de otro.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { MODE_KEYS } from "./src/adi/oracle/conversationalContract.js";
import { parseFigures } from "./src/adi/boleta.js";
import { sharedVerbatimRun } from "./src/adi/oracle/guardC.js";

const SC = "actual";
let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

const _words = (s) => new Set(String(s).toLowerCase().replace(/[^a-záéíóúñ0-9\s]/gi, "").split(/\s+/).filter((w) => w.length > 4));
const _overlap = (a, b) => { const wa = _words(a), wb = _words(b); if (!wb.size) return 0; let inter = 0; for (const w of wb) if (wa.has(w)) inter++; return inter / wb.size; };

async function runThread(THREAD) {
  // attempt (owner 2026-08-03, investigación cruzada de los 5 gates de solapamiento léxico): reenviarlo a
  // handlePlan/handleNarrateC — antes este mock lo descartaba silenciosamente, así que modelRouter.chooseModel
  // SIEMPRE resolvía tier1 (gpt-4o-mini) en los 3 reintentos, sin importar cuántas veces guardC rechazara — la
  // escalada mini→terra→sol (real en producción, ver src/ui/ChatADI.jsx) nunca se ejercitaba dentro de este gate.
  const callPlan = async ({ text, history, mem, scenario, attempt }) => { const pr = await handlePlan({ text, history, mem, scenario, attempt }); return pr.ok ? pr.plan : null; };
  let lastPlan = null;
  const callNarrate = async ({ text, plan, results, ledgerFigs, mem, history, attempt }) => {
    lastPlan = plan;
    const nr = await handleNarrateC({ payload: buildNarrateUserMessageC({ text, plan, results, ledgerFigs, mem, history }), mem, attempt });
    return nr.ok ? nr.narration : null;
  };
  let mem = {}, history = [];
  const turnos = [];
  for (const { q, expectedMode } of THREAD) {
    // lastPlan se resetea AL INICIO de cada turno (owner 2026-08-03, bug de instrumentación cazado en vivo): antes
    // vivía SOLO dentro del mock callNarrate — un turno cuyo PLAN agota sus 3 intentos sin llegar a narrar heredaba
    // silenciosamente el modo de un turno ANTERIOR en vez de reportar honestamente que no clasificó nada.
    lastPlan = null;
    const r = await answerViaOracle({ text: q, history, mem, scenario: SC, callPlan, callNarrate });
    const narration = (r && r.r && r.r.text) || null;
    const modo = lastPlan && lastPlan.mode;
    // bypassStructural (owner 2026-08-03, causa raíz REAL cazada en vivo, distinta de la instrumentación stale-
    // lastPlan ya arreglada arriba): ciertos turnos (ej. una simulación con una variable faltante — "supuestos_
    // faltantes") resuelven vía `_composedBypassResult` en answerViaOracle.js, que SALTEA PLAN→NARRAR ENTERO y
    // devuelve `deterministic:true` con una pregunta de aclaración compuesta — nunca invoca callNarrate, así que
    // `lastPlan` legítimamente queda null: no es que el turno "no clasificó nada" (bug), es que esta clase de turno
    // NUNCA tuvo un `mode` narrativo que observar por este mecanismo de espionaje — confirmado en vivo con un probe
    // aislado (T5 "¿Y si negocio esa carga hasta el target?" → route=oracle, deterministic=true, callNarrate
    // invocado 0 veces, narración="¿hasta qué target...?"). Se distingue de la abstención real (route!=="oracle")
    // usando la MISMA señal `deterministic` que ya expone answerViaOracle.js.
    const bypassStructural = modo == null && !!(r && r.r && r.r.deterministic);
    turnos.push({ q, expectedMode, modo, narration, route: r && r.r && r.r.route, bypassStructural, nCifras: narration ? parseFigures(narration).length : null });
    if (r) mem = r.mem;
    history = [...history, { role: "user", text: q }, { role: "adi", gist: (narration || "(fallback)").slice(0, 200) }].slice(-8);
  }
  return turnos;
}

console.log("── SMOKE LLM REAL — hilo de 6 turnos cambiando de modo, anclado en Falabella/carga comercial ──");
const THREAD = [
  { q: "Hazme un resumen ejecutivo", expectedMode: "diagnostico" },
  { q: "¿Qué hago primero?", expectedMode: "decision" },
  { q: "Sí, profundiza en eso", expectedMode: "seguimiento" },
  { q: "¿De dónde sale ese número de $194K?", expectedMode: "evidencia" },
  { q: "¿Y si negocio esa carga hasta el target?", expectedMode: "simulacion" },
  { q: "No entendí, explícamelo más fácil", expectedMode: "clarify" },
];
const turnos = await runThread(THREAD);

for (let i = 0; i < turnos.length; i++) {
  const t = turnos[i];
  console.log(`  T${i + 1} "${t.q}" → modo=${t.modo} (esperado ~${t.expectedMode}) · route=${t.route || "FALLBACK"} · ${t.nCifras ?? "?"} cifras`);
  console.log(`      "${(t.narration || "(sin narración)").replace(/\n/g, " ⏎ ").slice(0, 220)}"`);
}

console.log("\n── 1 · TODO turno que narra clasifica un mode VÁLIDO del contrato (determinístico — el plan SIEMPRE debe elegir uno de los 7) ──");
for (let i = 0; i < turnos.length; i++) {
  if (turnos[i].bypassStructural) { console.log(`  ⊘ T${i + 1}: resolvió por un bypass ESTRUCTURAL (deterministic:true, nunca invoca callNarrate — ej. simulación con variable faltante) — sin mode narrativo que observar, no se exige acá: "${(turnos[i].narration || "").slice(0, 80)}"`); continue; }
  ok(MODE_KEYS.includes(turnos[i].modo), `T${i + 1}: mode="${turnos[i].modo}" es un valor válido del contrato`);
}

console.log("\n── 2 · T6 (clarify) SÍ se exige determinístico — es la frase gatillo de la Fase 1, no depende del juicio del LLM ──");
ok(turnos[5].modo === "clarify", `T6 clasifica clarify (obtuvo "${turnos[5].modo}") — forzado por _coerceMode, no por juicio del LLM`);

console.log("\n── 3 · MEDICIÓN honesta — qué modo eligió el LLM por comprensión en los 5 turnos NO gateados determinísticamente ──");
{
  let aciertos = 0;
  for (let i = 0; i < 5; i++) { if (turnos[i].modo === turnos[i].expectedMode) aciertos++; }
  console.log(`  medición: ${aciertos}/5 turnos clasificaron el modo esperado por comprensión (sin forzar — el resto puede ser un modo distinto pero igual VÁLIDO)`);
}

console.log("\n── 4 · CONTEXTO NO PERDIDO — Falabella/carga comercial siguen presentes en los turnos que continúan ese hilo ──");
{
  const routeOk = turnos.filter((t) => t.route === "oracle").length;
  console.log(`  medición: ${routeOk}/6 turnos respondieron por Arquitectura C (el resto cayó a fallback — variance ya documentada, no de este mecanismo)`);
  // T2 y T3 son la continuación MÁS directa de T1 (decisión inmediata + "profundiza en eso") — se exige que sigan
  // hablando de la MISMA entidad que T1 estableció como prioridad (Falabella), no que salten a otro tema.
  for (const i of [1, 2]) {
    if (turnos[i].narration) ok(/falabella/i.test(turnos[i].narration), `T${i + 1}: menciona "Falabella" (mantiene el foco de T1, no reinicia el diagnóstico) — "${turnos[i].narration.slice(0, 80)}..."`);
    else console.log(`  T${i + 1}: sin narración (fallback) — no se puede medir contexto acá`);
  }
  // T4/T5/T6 se MIDEN (no se exigen) — pueden legítimamente virar el foco (evidencia puede hablar del cálculo sin
  // repetir el nombre; clarify puede usar un ejemplo genérico a propósito) sin que sea una pérdida de contexto real.
  for (const i of [3, 4, 5]) {
    if (turnos[i].narration) console.log(`  T${i + 1}: ${/falabella|carga comercial/i.test(turnos[i].narration) ? "mantiene" : "no repite explícitamente"} la referencia a Falabella/carga comercial (medido, no exigido)`);
  }
}

console.log("\n── 5 · NINGÚN turno es una repetición de otro (medido: solapamiento léxico informativo + run verbatim real) ──");
{
  // owner 2026-08-03 (investigación cruzada, causa raíz confirmada): el ratio crudo de vocabulario compartido
  // (>4 letras) castigaba T2(decisión)→T3(seguimiento) — DISEÑADOS a propósito para compartir vocabulario (misma
  // entidad Falabella/carga comercial, seguimiento profundiza el MISMO tema) — 89%/72% medidos en corridas reales
  // de esta investigación, verificados con un chequeo de n-grama: CERO tramo de 8 palabras seguidas compartido en
  // ninguno de esos casos. Se reemplaza el umbral de ratio (métrica frágil) por sharedVerbatimRun (fuente única en
  // guardC.js, la MISMA que ahora usa guardC/`degraded`) — detecta reciclaje palabra-por-palabra real sin castigar
  // la continuidad legítima de tema/tabla/entidad entre modos que SÍ deben compartir vocabulario por diseño.
  let maxOverlap = 0, maxPair = null;
  let verbatimHit = null;
  for (let i = 0; i < turnos.length; i++) {
    for (let j = i + 1; j < turnos.length; j++) {
      if (!turnos[i].narration || !turnos[j].narration) continue;
      const o = _overlap(turnos[i].narration, turnos[j].narration);
      if (o > maxOverlap) { maxOverlap = o; maxPair = [i + 1, j + 1]; }
      if (!verbatimHit && sharedVerbatimRun(turnos[i].narration, turnos[j].narration, 8)) verbatimHit = [i + 1, j + 1];
    }
  }
  console.log(`  medición informativa: mayor solapamiento léxico crudo par-a-par = ${(maxOverlap * 100).toFixed(0)}% (T${maxPair && maxPair[0]} vs T${maxPair && maxPair[1]}) — sin umbral, solo referencia`);
  ok(!verbatimHit, `ningún par de turnos comparte un tramo de 8+ palabras SEGUIDAS verbatim — no hay una respuesta reciclada palabra por palabra${verbatimHit ? ` (obtenido: T${verbatimHit[0]} vs T${verbatimHit[1]})` : ""}`);
}

console.log(`\n── _oracle_multimodo_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
