/* === _orden_sellado_gate.mjs · REQUISITO 4 · "pase quirúrgico de confiabilidad" (owner 2026-07-29) ===
 * "Orden, dirección y ranking deben venir sellados por la tool." Lockea: (1) DETERMINÍSTICO — gridTable/
 * tensionRead sellan `orden`/`ordenA`/`ordenB` con dirección + campo real; (2) DETERMINÍSTICO — guardC bloquea
 * una tabla cuya secuencia de valores CONTRADICE el orden sellado; (3) DETERMINÍSTICO — si la columna sellada NO
 * aparece literal en la tabla (el narrador mostró otra métrica), el guard NO se pronuncia — no adivina una columna
 * y produce un falso positivo (hallazgo real de este mismo pase, documentado en el comentario de guardC.js);
 * (4) SMOKE LLM REAL — compliance run contra gridTable/tensionRead reales (múltiples corridas, sin fallback
 * elevado por falsos positivos).
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { fig } from "./src/adi/boleta.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

// ledger sintético con las CIFRAS AUTORIZADAS que van a aparecer en las narraciones de prueba (A/B/C · $5.0M/$9.0M/$2.0M)
// — así el chequeo 1 (cifra-no-autorizada) no interfiere y se aísla EXCLUSIVAMENTE el chequeo de orden sellado.
const _figs = [
  fig("A · Ventas", "$5.0M", { unit: "money", raw: 5000000 }), fig("B · Ventas", "$9.0M", { unit: "money", raw: 9000000 }), fig("C · Ventas", "$2.0M", { unit: "money", raw: 2000000 }),
  fig("X · Ventas", "$5.0M", { unit: "money", raw: 5000000 }), fig("Y · Ventas", "$9.0M", { unit: "money", raw: 9000000 }), fig("Z · Ventas", "$2.0M", { unit: "money", raw: 2000000 }),
];
const _fakeResults = [{ facts: { entidad: "A" }, boleta: [] }, { facts: { entidad: "B" }, boleta: [] }, { facts: { entidad: "C" }, boleta: [] }, { facts: { entidad: "X" }, boleta: [] }, { facts: { entidad: "Y" }, boleta: [] }, { facts: { entidad: "Z" }, boleta: [] }];

console.log("── 1 · DETERMINÍSTICO — gridTable/tensionRead sellan el orden real ──");
{
  const gDesc = runPlan({ intent: "grid", calls: [{ tool: "gridTable", args: { dimension: "cliente", sortBy: "venta", dir: "desc", limit: 5 } }] }, { scenario: "actual" });
  ok(gDesc.results[0].facts.orden === "descendente por Ventas", `orden="descendente por Ventas" (obtuvo "${gDesc.results[0].facts.orden}")`);
  const gAsc = runPlan({ intent: "grid", calls: [{ tool: "gridTable", args: { dimension: "cliente", sortBy: "margen", dir: "asc", limit: 5 } }] }, { scenario: "actual" });
  ok(gAsc.results[0].facts.orden === "ascendente por Margen", `orden="ascendente por Margen" (obtuvo "${gAsc.results[0].facts.orden}")`);
  const t = runPlan({ intent: "tension", calls: [{ tool: "tensionRead", args: { dimension: "sku" } }] }, { scenario: "actual" });
  ok(!!t.results[0].facts.ordenA && !!t.results[0].facts.ordenB, "tensionRead sella ordenA y ordenB (dos rankings, uno por métrica)");
}

console.log("\n── 2 · DETERMINÍSTICO — guardC bloquea una tabla que CONTRADICE el orden sellado ──");
{
  const ledger = { figs: _figs };
  const narracionRota = "| Cliente | Ventas |\n|---------|--------|\n| A | $5.0M |\n| B | $9.0M |\n| C | $2.0M |";
  const g = guardC(narracionRota, { ledger, results: _fakeResults, trace: null, question: "top clientes por ventas", mechanismMemory: {}, sealedOrders: ["descendente por Ventas"] });
  ok(!g.ok && g.violations.some((v) => v.kind === "orden-sellado-incumplido"), `bloquea la tabla rota (B=$9M > A=$5M, prometido descendente) — verdict="${g.verdict}"`);

  const narracionOk = "| Cliente | Ventas |\n|---------|--------|\n| A | $9.0M |\n| B | $5.0M |\n| C | $2.0M |";
  const g2 = guardC(narracionOk, { ledger, results: _fakeResults, trace: null, question: "top clientes por ventas", mechanismMemory: {}, sealedOrders: ["descendente por Ventas"] });
  ok(g2.ok, `la MISMA tabla, en el orden correcto, pasa limpia — verdict="${g2.verdict}"`);
}

console.log("\n── 3 · DETERMINÍSTICO — columna sellada AUSENTE de la tabla → el guard NO se pronuncia (no adivina, no falso positivo) ──");
{
  const ledger = { figs: _figs };
  // el narrador mostró Ventas en vez de Contribución (la sellada) — las filas de VENTAS no siguen ningún orden
  // particular, pero como la columna sellada (Contribución) no aparece, no hay nada verificable → no debe bloquear.
  const narracionOtraColumna = "| SKU | Ventas |\n|-----|--------|\n| X | $5.0M |\n| Y | $9.0M |\n| Z | $2.0M |";
  const g = guardC(narracionOtraColumna, { ledger, results: _fakeResults, trace: null, question: "top SKU por contribución", mechanismMemory: {}, sealedOrders: ["descendente por Contribución"] });
  ok(g.ok, `NO bloquea cuando la columna sellada ("Contribución") no aparece literal en la tabla — verdict="${g.verdict}"`);
}

console.log("\n── 4 · SMOKE LLM REAL — compliance run contra gridTable/tensionRead reales (8 corridas) ──");
{
  const callPlan = async ({ text, history, mem, scenario }) => { const pr = await handlePlan({ text, history, mem, scenario }); return pr.ok ? pr.plan : null; };
  const callNarrate = async (args) => { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };
  const QS = ["los 5 clientes con más ventas, en una tabla con ventas y margen", "top 5 SKU por contribución, con su costo medio y margen", "los 8 clientes bajo el benchmark de margen, ordenados de peor a mejor margen", "¿quién sostiene la contribución y quién consume más capital?"];
  let responded = 0;
  for (const q of QS) for (let i = 0; i < 2; i++) {
    const r = await answerViaOracle({ text: q, history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    if (r) responded++;
  }
  console.log(`  ${responded}/${QS.length * 2} corridas respondieron`);
  ok(responded >= QS.length, `≥${QS.length}/${QS.length * 2} respondieron (sin fallback elevado por falsos positivos del guard) — obtuvo ${responded}`);
}

console.log(`\n── _orden_sellado_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
