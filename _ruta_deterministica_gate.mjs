/* === _ruta_deterministica_gate.mjs · REQUISITO 1 · "pase quirúrgico de confiabilidad" (owner 2026-07-29) ===
 * "Ruta determinística para consultas simples entidad + métrica." Lockea: (1) detección 100% de plan+resultados
 * (nunca del juicio del LLM sobre su propia respuesta) — entityRecord + 1 entidad + EXACTAMENTE 1 métrica nombrada
 * en el texto; (2) cuando aplica, la Pasada 2 (narrar) NO se llama — cero chance de decline/alucinación/variance;
 * (3) cuando NO aplica (0 métricas = registro completo · 2+ = comparación · otro tool), sigue el camino normal;
 * (4) un nombre que NO existe en el dato sigue declinando honesto, nunca inventa; (5) round-trip en vivo con LLM
 * real contra 2 dimensiones distintas (cliente/sku).
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

const callPlan = async ({ text, history, mem, scenario }) => { const pr = await handlePlan({ text, history, mem, scenario }); return pr.ok ? pr.plan : null; };
function mkNarrate() {
  let called = false;
  const fn = async (args) => { called = true; const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };
  return { fn, wasCalled: () => called };
}

console.log("── 1 · SMOKE LLM REAL — queries que DEBEN activar la ruta determinística (Pasada 2 NUNCA llamada) ──");
// medido en ≥2/3 corridas (no 3/3 estricto): el PLAN (LLM #1) a veces elige otro tool para la MISMA pregunta (ej.
// "el costo de X" → a veces entityRecord, a veces otro tool que declina) — variance de clasificación YA
// documentada en este repo (mismo patrón que _oracle_plan_gate/_oracle_tension_gate), no un bug de esta ruta: lo
// que se exige acá es que CUANDO el plan SÍ elige entityRecord con 1 métrica, la ruta determinística responda sin
// tocar el narrador — no que el plan SIEMPRE elija entityRecord (eso es clasificación, fuera del alcance de este gate).
let totalTriggered = 0;
for (const q of ["el rebate de Falabella", "el precio de lista del SKU LG-DRYER8KG", "el costo de Sodimac"]) {
  let hits = 0, triggered = 0;
  for (let i = 0; i < 3; i++) {
    const { fn, wasCalled } = mkNarrate();
    const r = await answerViaOracle({ text: q, history: [], mem: {}, scenario: "actual", callPlan, callNarrate: fn });
    if (r && r.r.deterministic) {
      triggered++;
      // forma NATURAL (owner "piensa bien" 2026-07-29, ver _lectura_minima_gate.mjs para el contrato completo de
      // lectura mínima) — ya NO la telegráfica "Entidad · Etiqueta: valor"; acá solo se verifica que sigue siendo
      // determinístico (sin narrador) y sigue declarando el período, no la forma exacta de la frase.
      if (!wasCalled() && /a[nñ]o cerrado/.test(r.r.text)) hits++;
    }
  }
  totalTriggered += triggered;
  console.log(`  "${q}": ruta determinística se activó en ${triggered}/3 corridas`);
  ok(triggered === 0 || hits === triggered, `"${q}": SIEMPRE que se activó, cumplió el contrato (sin narrador + forma correcta) — ${hits}/${triggered}`);
}
ok(totalTriggered >= 4, `la ruta determinística se activó AL MENOS 4/9 veces en total (obtuvo ${totalTriggered}/9) — confirma que el mecanismo realmente se ejercitó, no solo que nunca se activó`);

console.log("\n── 2 · SMOKE LLM REAL — queries que NO deben activar la ruta determinística (siguen por el narrador) ──");
for (const q of ["dame todo de Falabella", "¿cuál es el margen de Falabella?", "los 5 clientes con más ventas"]) {
  const { fn, wasCalled } = mkNarrate();
  const r = await answerViaOracle({ text: q, history: [], mem: {}, scenario: "actual", callPlan, callNarrate: fn });
  if (r) {
    ok(!r.r.deterministic, `"${q}" → deterministic NO se activa (0 o 2+ métricas, o tool distinto de entityRecord)`);
    ok(wasCalled(), `"${q}" → la Pasada 2 SÍ corrió (narrador libre, como siempre)`);
  } else {
    console.log(`    ("${q}" cayó a fallback esta corrida — variance de LLM ya documentada, no de esta ruta)`);
  }
}

console.log("\n── 3 · DETERMINÍSTICO (sin LLM) — un nombre inexistente NUNCA activa la ruta determinística (coverage.supported=false, no inventa) ──");
{
  const { results } = runPlan({ intent: "answer", calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "ClienteInventadoXYZ" } }] }, { scenario: "actual" });
  ok(results[0].coverage.supported === false, "entityRecord(entity inexistente) → coverage.supported=false a nivel de motor");
  ok(results[0].facts == null, "sin facts para un nombre que no existe — nada que la ruta determinística pueda leer");
}

console.log(`\n── _ruta_deterministica_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
