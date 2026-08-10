/* === _elliptic_entity_inheritance_gate.mjs · GATE PERMANENTE · herencia de mode/intent en "¿Y <Entidad>?" ===
 * owner 2026-08-03 — defecto CONFIRMADO en vivo (~9 corridas de investigación, reproducido de nuevo acá): un turno
 * CORTO tipo "¿Y Lider?"/"¿Y Sodimac?"/"¿Y Jumbo?" tras un turno YA resuelto sobre otra entidad — la resolución de
 * ENTIDAD/SCOPE nunca falla (el LLM lee el nombre propio directo del texto corto), pero `mode` quedaba 100% a
 * criterio del LLM de PLAN de ESE turno, sin ningún piso determinístico — medido inconsistente (ej. "¿Qué
 * recomendás para Falabella?" mode=decision → "¿Y Sodimac?" cayendo a mode=default, perdiendo profundidad).
 *
 * FIX: dialogueState.js `matchEllipticEntity` (red angosta, mismo principio que _CLARIFY_RE/_SEGUIMIENTO_MARKER_RE)
 * + `updateRecentSubjects` ahora threadea mode/intent/tool por entidad + `_coerceMode` (answerViaOracle.js) hereda
 * el `mode` del turno anterior con la entidad nueva cuando el patrón matchea Y hay hilo previo. Deliberadamente NO
 * toca scope/calls/tool — la entidad ya se resuelve bien por comprensión, sin necesitar memoria.
 *
 * Este gate corre EN VIVO (LLM real, gateway real, sin mocks de contenido) 2 hilos de 2 turnos, 3 corridas cada uno
 * (N=6 total): uno ancla mode=decision, el otro mode=diagnostico — dos clases de pregunta distintas, para no medir
 * un solo tipo de mode. Verifica que el turno B (i) SIEMPRE resuelve la entidad nueva nombrada y (ii) hereda
 * EXACTAMENTE el mode del turno A — con el backstop determinístico aplicado, esto NO es una medición de
 * comportamiento del modelo (como el ratio de _decision_table_order_gate.mjs) sino la garantía DURA del regex + el
 * threading de memoria: se exige el 100% en los casos donde matchEllipticEntity matchea Y recentSubjectsPrev[0].mode
 * existe. También documenta (sin bloquear el gate por eso) si `calls` del turno B queda más angosto que el de A —
 * residual conocido, fuera del alcance de este fix (ver dialogueState.js/matchEllipticEntity, comentario grande).
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { matchEllipticEntity } from "./src/adi/oracle/dialogueState.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

async function runThread(THREAD) {
  const callPlan = async ({ text, history, mem, scenario, attempt }) => { const pr = await handlePlan({ text, history, mem, scenario, attempt }); return pr.ok ? pr.plan : null; };
  let lastPlan = null, lastCalls = null;
  const callNarrate = async ({ text, plan, results, ledgerFigs, mem, history, attempt }) => {
    lastPlan = plan;
    lastCalls = plan && plan.calls;
    const nr = await handleNarrateC({ payload: buildNarrateUserMessageC({ text, plan, results, ledgerFigs, mem, history }), mem, attempt });
    return nr.ok ? nr.narration : null;
  };
  let mem = {}, history = [];
  const turnos = [];
  for (const q of THREAD) {
    lastPlan = null; lastCalls = null;
    const r = await answerViaOracle({ text: q, history, mem, scenario: "actual", callPlan, callNarrate });
    const narration = (r && r.r && r.r.text) || null;
    turnos.push({
      q, mode: lastPlan && lastPlan.mode, intent: lastPlan && lastPlan.intent,
      entities: (lastPlan && lastPlan.scope && lastPlan.scope.entities) || null,
      calls: lastCalls, narration, route: r && r.r && r.r.route,
    });
    if (r) mem = r.mem;
    history = [...history, { role: "user", text: q }, { role: "adi", gist: (narration || "(fallback)").slice(0, 200) }].slice(-8);
  }
  return turnos;
}

console.log("── 0 · matchEllipticEntity (puro, sin LLM) — red angosta, mismo criterio que _CLARIFY_RE/_SEGUIMIENTO_MARKER_RE ──");
{
  ok(matchEllipticEntity("¿Y Lider?") === "Lider", `"¿Y Lider?" → matchea "Lider"`);
  ok(matchEllipticEntity("Y Sodimac?") === "Sodimac", `"Y Sodimac?" (sin ¿) → matchea "Sodimac"`);
  ok(matchEllipticEntity("¿Y en Jumbo?") === "Jumbo", `"¿Y en Jumbo?" (con preposición) → matchea "Jumbo"`);
  ok(matchEllipticEntity("y qué hago con Lider") === null, `"y qué hago con Lider" (verbo en minúscula tras "y") → NO matchea — no es el patrón nítido`);
  ok(matchEllipticEntity("¿Y cómo viene el negocio en general?") === null, `frase larga/genérica con verbo → NO matchea`);
  ok(matchEllipticEntity("Y Falabella y Lider y Sodimac y Jumbo y Ripley?") === null, `demasiadas palabras (>6) → NO matchea (red angosta, nunca adivina un caso largo)`);
}

const THREADS = [
  { label: "decisión → decisión (redacción imperativa/consejo)", turns: ["¿Qué recomendás para Falabella?", "¿Y Sodimac?"] },
  { label: "diagnóstico → diagnóstico (panorama completo)", turns: ["Hazme un diagnóstico de Falabella", "¿Y Lider?"] },
];
const RUNS_PER_THREAD = 3;

console.log(`\n── SMOKE LLM REAL — ${THREADS.length} hilos × ${RUNS_PER_THREAD} corridas cada uno (N=${THREADS.length * RUNS_PER_THREAD}) ──`);
const allResults = [];
for (const { label, turns } of THREADS) {
  for (let i = 0; i < RUNS_PER_THREAD; i++) {
    const t = await runThread(turns);
    console.log(`  [${label} · corrida ${i}] A: "${t[0].q}" → mode=${t[0].mode} entities=${JSON.stringify(t[0].entities)}`);
    console.log(`  [${label} · corrida ${i}] B: "${t[1].q}" → mode=${t[1].mode} entities=${JSON.stringify(t[1].entities)} calls=${JSON.stringify((t[1].calls || []).map((c) => c && c.tool))}`);
    allResults.push({ label, turnA: t[0], turnB: t[1] });
  }
}

console.log("\n── 1 · ENTIDAD — el turno B SIEMPRE resuelve exactamente la entidad nueva nombrada en el texto corto (regresión permanente — nunca fue el defecto real, pero se blinda) ──");
{
  const esperado = { "¿Y Sodimac?": "Sodimac", "¿Y Lider?": "Lider" };
  for (const { label, turnB } of allResults) {
    const esperadaEntidad = esperado[turnB.q];
    const entidades = (turnB.entities || []).map((e) => String(e).toLowerCase());
    ok(esperadaEntidad && entidades.includes(esperadaEntidad.toLowerCase()), `[${label}] turno B ("${turnB.q}") resuelve scope.entities incluyendo "${esperadaEntidad}" — obtuvo ${JSON.stringify(turnB.entities)}`);
  }
}

console.log("\n── 2 · MODE — el turno B hereda EXACTAMENTE el mode del turno A (garantía DURA del backstop determinístico, se exige el 100% de las corridas donde el patrón matcheó y hubo mode previo) ──");
{
  let aplicables = 0, heredados = 0;
  for (const { label, turnA, turnB } of allResults) {
    const matched = !!matchEllipticEntity(turnB.q);
    ok(matched, `[${label}] "${turnB.q}" matchea matchEllipticEntity (precondición del backstop)`);
    if (matched && turnA.mode) {
      aplicables++;
      const heredado = turnB.mode === turnA.mode;
      if (heredado) heredados++;
      ok(heredado, `[${label}] turno B hereda mode="${turnA.mode}" del turno A — obtuvo mode="${turnB.mode}"`);
    }
  }
  console.log(`  RATIO MEDIDO (garantía dura, no comportamiento del modelo): ${heredados}/${aplicables} corridas heredaron el mode exacto — ${aplicables ? Math.round((heredados / aplicables) * 100) : 0}%`);
  ok(aplicables > 0 && heredados === aplicables, `100% de herencia de mode en los casos aplicables — obtuvo ${heredados}/${aplicables}`);
}

console.log("\n── 3 · RESIDUAL (medido, NO bloquea el gate) — ¿el turno B queda con `calls` más angosto que el turno A para la misma clase de pregunta? — fuera de alcance de este fix, documentado para una iteración futura ──");
{
  let masAngosto = 0;
  for (const { label, turnA, turnB } of allResults) {
    const na = Array.isArray(turnA.calls) ? turnA.calls.length : 0;
    const nb = Array.isArray(turnB.calls) ? turnB.calls.length : 0;
    const angosto = nb < na;
    if (angosto) masAngosto++;
    console.log(`  [${label}] calls turno A=${na} · calls turno B=${nb} · ${angosto ? "MÁS ANGOSTO en B (residual conocido, no bloquea)" : "igual o más ancho"}`);
  }
  console.log(`  medición informativa: ${masAngosto}/${allResults.length} corridas con calls más angosto en el turno B — no es el foco de este fix (ver dialogueState.js/matchEllipticEntity), solo se documenta`);
}

console.log(`\n── _elliptic_entity_inheritance_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
