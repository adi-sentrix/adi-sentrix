/* === _dale_seguimiento_gate.mjs · GATE · "Dale, cuéntame un poco más de eso" clasifica seguimiento (no diagnostico) ===
 * owner 2026-07-31, auditoría (defecto "Orientación, aclaración y continuidad"):
 *
 * Ante continuaciones coloquiales parafraseadas ("Dale, cuéntame un poco más de eso"), la clasificación de modo era
 * inestable: pese a que conversationalContract.js cita literalmente "dale" como disparador de seguimiento, 2 de 3
 * corridas idénticas clasificaron mode=diagnostico (repitiendo el arco completo en vez de profundizar), y 1 de esas
 * 2 además abortó el turno entero tras agotar los 3 reintentos de NARRATE (answerViaOracle → null).
 *
 * FIX: conversationalContract.js refuerza whenToUse de "seguimiento" con ejemplos de paráfrasis coloquiales
 * COMPLETAS ("dale, contame más de eso", "bueno, profundiza en eso") — no solo la palabra suelta "dale" — y
 * "diagnostico" declara explícitamente que un "contame más" sobre un tema YA establecido NO es un panorama nuevo.
 *
 * Este gate es SMOKE LLM REAL: T1 establece un tema (resumen ejecutivo), T2 es la frase EXACTA del hallazgo.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runTurn2(mem, history) {
  let lastPlan = null;
  const callPlan = async ({ text, history, mem, scenario }) => { const pr = await handlePlan({ text, history, mem, scenario }); return pr.ok ? pr.plan : null; };
  const callNarrate = async ({ text, plan, results, ledgerFigs, mem, history }) => {
    lastPlan = plan;
    const nr = await handleNarrateC({ payload: buildNarrateUserMessageC({ text, plan, results, ledgerFigs, mem, history }), mem });
    return nr.ok ? nr.narration : null;
  };
  const r = await answerViaOracle({ text: "Dale, cuéntame un poco más de eso.", history, mem, scenario: "actual", callPlan, callNarrate });
  return { r, mode: lastPlan && lastPlan.mode };
}

console.log('── SMOKE LLM REAL — T1 establece tema (resumen ejecutivo), T2 = "Dale, cuéntame un poco más de eso." (3 corridas) ──');
{
  const N = 3;
  let seguimientoCount = 0, abortCount = 0, responded = 0;
  for (let run = 0; run < N; run++) {
    if (run > 0) await sleep(6000);
    let lastPlanT1 = null;
    const callPlan = async ({ text, history, mem, scenario }) => { const pr = await handlePlan({ text, history, mem, scenario }); return pr.ok ? pr.plan : null; };
    const callNarrate = async ({ text, plan, results, ledgerFigs, mem, history }) => {
      lastPlanT1 = plan;
      const nr = await handleNarrateC({ payload: buildNarrateUserMessageC({ text, plan, results, ledgerFigs, mem, history }), mem });
      return nr.ok ? nr.narration : null;
    };
    const r1 = await answerViaOracle({ text: "Hazme un resumen ejecutivo", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    if (!r1) { console.log(`  run${run}: T1 abortó — no se pudo establecer el tema, se descarta esta corrida`); continue; }
    const history = [{ role: "user", text: "Hazme un resumen ejecutivo" }, { role: "adi", gist: (r1.r.text || "").slice(0, 200) }];
    const { r: r2, mode } = await runTurn2(r1.mem, history);
    responded++;
    console.log(`  run${run}: T2 mode="${mode}" · route=${r2 ? r2.r.route : "ABORTO (null)"}`);
    if (!r2) abortCount++;
    if (mode === "seguimiento") seguimientoCount++;
  }
  console.log(`  medición: ${seguimientoCount}/${responded} clasificaron seguimiento · ${abortCount}/${responded} abortaron (baseline pre-fix documentado: 1/3 seguimiento, 1/3 aborto total)`);
  ok(responded > 0, "al menos una corrida completó T1 (el gate ejercitó el contrato real)");
  ok(abortCount === 0, `NINGUNA corrida abortó el turno entero (antes: 1/3 caía a null) — obtuvo ${abortCount}/${responded}`);
  ok(seguimientoCount === responded, `TODAS las corridas completadas clasifican mode="seguimiento" (antes: 1/3) — obtuvo ${seguimientoCount}/${responded}`);
}

console.log(`\n── _dale_seguimiento_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
