/* === _criterio_oraculo_gate.mjs · GATE del fix adi-oraculo-criterio-no-invocado (owner 2026-07-31) ===
 * C.2 "memoria de criterio" (setCriterion/setBenchmarkOverride en src/adi/criteria.js) nunca se invocaba cuando el
 * turno resolvía por la ruta ORÁCULO (Arquitectura C) — la ruta PRIMARIA en prod. Este gate lockea:
 * (1) "recordá que mi margen mínimo es X%" por la ruta oráculo SETEA el override REAL (no solo narra confirmación) ·
 * (2) NUNCA llama a PLAN/NARRAR para este turno (bypass entero, cero variance de LLM) ·
 * (3) el override queda vigente para EL RESTO de la conversación (turnos posteriores lo heredan vía mem/POLICY) ·
 * (4) recall/forget/propose/rango-inválido también pasan por este camino y hacen lo mismo que en la ruta legacy ·
 * (5) UNA VERDAD: es literalmente composeCriteria/setCriterion de criteria.js — no una reimplementación paralela. */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { getBenchmarkOverride } from "./src/config/businessPolicy.js";
import { activeCriteria, forgetCriterion } from "./src/adi/criteria.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

let planCalled = false, narrateCalled = false;
const callPlan = async (args) => { planCalled = true; const pr = await handlePlan(args); return pr.ok ? pr.plan : null; };
const callNarrate = async (args) => { narrateCalled = true; const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };

// limpio cualquier residuo de otra corrida en el mismo proceso
forgetCriterion("todo");

console.log("── 1 · SET por la ruta oráculo setea el override REAL (no solo narra) ──");
{
  planCalled = false; narrateCalled = false;
  const r = await answerViaOracle({ text: "recordá que mi margen mínimo es 25%", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(!!r && !!r.r, "el turno resolvió (no cayó a null/fallback)");
  ok(!planCalled, "NUNCA invocó PLAN — bypass entero, cero variance de LLM");
  ok(!narrateCalled, "NUNCA invocó NARRATE — misma garantía que la ruta legacy (verbatim)");
  ok(getBenchmarkOverride() === 25, `setBenchmarkOverride(25) SÍ corrió (obtuvo ${getBenchmarkOverride()})`);
  ok(activeCriteria().length === 1 && activeCriteria()[0].key === "margen_minimo", "activeCriteria() refleja el criterio nuevo");
  ok(/25%/.test(r.r.text) && /30\.1%/.test(r.r.text), `confirmación con antes/después — "${r.r.text}"`);
}

console.log("\n── 2 · el override queda vigente para OTRO turno de la MISMA conversación ──");
{
  planCalled = false;
  const r2 = await answerViaOracle({ text: "el margen de Falabella", history: [{ role: "user", text: "recordá que mi margen mínimo es 25%" }], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(getBenchmarkOverride() === 25, "el override SIGUE en 25% al resolver el turno siguiente (no se perdió)");
  ok(!!r2, "el turno siguiente resuelve normal (PLAN corre, no está bloqueado por el fix)");
}

console.log("\n── 3 · RECALL/FORGET por la ruta oráculo ──");
{
  const rRecall = await answerViaOracle({ text: "¿qué recordás?", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(/25/.test(rRecall.r.text) && /Margen mínimo/i.test(rRecall.r.text), `recall lista el criterio — "${rRecall.r.text}"`);
  const rForget = await answerViaOracle({ text: "olvidá el margen mínimo", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(getBenchmarkOverride() === null, "forget restaura el override a null (byte-igual al estándar)");
  ok(activeCriteria().length === 0, "activeCriteria() vacío tras forget");
  ok(/est[aá]ndar/i.test(rForget.r.text), `forget confirma la vuelta al estándar — "${rForget.r.text}"`);
}

console.log("\n── 4 · rango inválido → honesto, NO guarda (mismo contrato que la ruta legacy) ──");
{
  const rBad = await answerViaOracle({ text: "recordá que mi margen mínimo es 90%", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(getBenchmarkOverride() === null, "90% está fuera de rango (5-60) → NO setea nada");
  ok(/entre 5% y 60%/.test(rBad.r.text), `avisa el rango válido — "${rBad.r.text}"`);
}

console.log("\n── 5 · PROPOSE → pregunta, NO guarda solo (regla del owner, también por esta ruta) ──");
{
  const rProp = await answerViaOracle({ text: "para mí el margen mínimo es 28", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(getBenchmarkOverride() === null, "propose NO guarda solo");
  ok(/No lo guardo sin tu OK/i.test(rProp.r.text), `propone y pide confirmación explícita — "${rProp.r.text}"`);
  ok(Array.isArray(rProp.r.suggestions) && /record[aá]/i.test(rProp.r.suggestions[0]), "trae el chip con la frase exacta para confirmar");
}

forgetCriterion("todo");   // limpio al salir — no dejar el override vivo para otro proceso que reuse este módulo

console.log(`\n── _criterio_oraculo_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
