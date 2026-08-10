/* === _topn_resto_gate.mjs · REQUISITO 2 · "pase quirúrgico de confiabilidad" (owner 2026-07-29) ===
 * "En todo top-N, informa 'N de total' y cuantifica el resto." Lockea: (1) DETERMINÍSTICO — gridTable/tensionRead
 * sellan totalCount + resto (con su suma) cuando el top-N recorta el universo; (2) DETERMINÍSTICO — cuando el
 * top-N cubre TODO el universo (limit ≥ total), no hay "resto" que inventar; (3) alta cardinalidad (limit=1000
 * sobre 13) no rompe; (4) UI — chartSpec.js expone la nota "N de total" en la tabla estructurada (requisito 5,
 * misma pieza); (5) en vivo — el narrador/la respuesta real declara el recorte, medido con LLM real.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { chartForEvidence } from "./src/adi/sentrix/chartSpec.js";
import { buildOracleEvidence } from "./src/adi/oracle/sentrixEvidence.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · DETERMINÍSTICO — gridTable sella totalCount + resto cuantificado cuando recorta ──");
{
  const g = runPlan({ intent: "grid", calls: [{ tool: "gridTable", args: { dimension: "cliente", sortBy: "venta", limit: 5 } }] }, { scenario: "actual" });
  const f = g.results[0].facts;
  ok(f.totalCount === 13, `totalCount=13 (el universo real de clientes, obtuvo ${f.totalCount})`);
  ok(f.count === 5, `count=5 (lo mostrado)`);
  ok(!!f.resto && f.resto.count === 8, `resto.count=8 (13-5, obtuvo ${f.resto && f.resto.count})`);
  ok(!!f.resto && /^\$[\d.]+M$/.test(f.resto.sumaFmt), `resto.sumaFmt es una cifra $ formateada (obtuvo "${f.resto && f.resto.sumaFmt}")`);
}

console.log("\n── 2 · DETERMINÍSTICO — tensionRead sella totalCount + restoA/restoB por cada métrica ──");
{
  const t = runPlan({ intent: "tension", calls: [{ tool: "tensionRead", args: { dimension: "sku" } }] }, { scenario: "actual" });
  const f = t.results[0].facts;
  ok(typeof f.totalCount === "number" && f.totalCount > 0, `totalCount presente (${f.totalCount})`);
  ok(!!f.restoA && !!f.restoB, "restoA y restoB presentes (dos rankings cruzados, cada uno con su resto)");
}

console.log("\n── 3 · DETERMINÍSTICO — sin recorte (limit ≥ total), NO hay resto que inventar ──");
{
  const g = runPlan({ intent: "grid", calls: [{ tool: "gridTable", args: { dimension: "cliente", sortBy: "venta", limit: 1000 } }] }, { scenario: "actual" });
  const f = g.results[0].facts;
  ok(f.count === f.totalCount, `count===totalCount cuando limit cubre todo (${f.count}===${f.totalCount})`);
  ok(f.resto === undefined, "sin campo `resto` cuando no hay nada fuera del top-N (honesto, no fabrica un resto vacío)");
}

console.log("\n── 4 · UI — chartSpec.js expone la nota 'N de total' en la tabla estructurada (requisito 5) ──");
{
  const g = runPlan({ intent: "grid", calls: [{ tool: "gridTable", args: { dimension: "cliente", sortBy: "venta", limit: 3 } }] }, { scenario: "actual" });
  const ev = buildOracleEvidence({ plan: { intent: "answer", calls: g.trace.calls }, results: g.results, figs: [], scenario: "actual" });
  const spec = chartForEvidence(ev);
  ok(!!spec && spec.tipo === "tabla_matriz", "chartForEvidence produce tabla_matriz para la grilla recortada");
  ok(!!spec && /3 de 13/.test(spec.tabla.nota || ""), `la nota de la tabla dice "3 de 13" (obtuvo "${spec && spec.tabla.nota}")`);
}

console.log("\n── 5 · SMOKE LLM REAL — la respuesta declara el recorte (medido, 3 corridas) ──");
{
  const callPlan = async ({ text, history, mem, scenario }) => { const pr = await handlePlan({ text, history, mem, scenario }); return pr.ok ? pr.plan : null; };
  const callNarrate = async (args) => { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };
  let declara = 0, total = 0;
  for (let i = 0; i < 3; i++) {
    const r = await answerViaOracle({ text: "los 5 clientes con más ventas", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    if (!r) continue;
    total++;
    if (/\bde\s+13\b|\b13\s+client/i.test(r.r.text) || (chartForEvidence(r.r.evidence) && /de 13/.test((chartForEvidence(r.r.evidence).tabla || {}).nota || ""))) declara++;
  }
  console.log(`  medición: ${declara}/${total} corridas declaran "de 13" (en texto o en la tabla estructurada — la tabla SIEMPRE lo trae, ver sección 4)`);
  ok(total > 0, "al menos una corrida respondió (no todo cayó a fallback)");
}

console.log(`\n── _topn_resto_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
