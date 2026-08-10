/* === _trend_vs_puntual_gate.mjs · GATE · "cómo viene X de Y" SIN calificador temporal NO es trend ===
 * owner 2026-07-31, auditoría (defecto "Ventas, margen, contribución y costos"):
 *
 * "Cómo viene [métrica] de [entidad]" sin ningún calificador temporal explícito ("mes a mes", "por mes") disparaba
 * la tool `trend` (serie mensual de 12 meses) de forma mayoritaria e inconsistente, pese a que el catálogo YA liga
 * `trend` a la presencia de un calificador temporal. Medido: 4 corridas de la misma frase exacta → 3/4 trend,
 * 1/4 marginRead+filtro, 0/4 al tool esperado (entityProfile/entityRecord, lectura de estado puntual).
 *
 * FIX: planPrompt.js (TOOL_CATALOG, trend) agrega un contraste EXPLÍCITO: la MISMA frase con y sin el calificador
 * temporal exige tools distintas — sin calificador, es entityProfile/entityRecord (estado puntual), nunca trend.
 *
 * Este gate es SMOKE LLM REAL (mide la tasa, documenta la mejora contra el baseline 0/4).
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { handlePlan } from "./src/adi/llm/gatewayCore.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('── SMOKE LLM REAL — "Cómo viene el margen de Falabella" (SIN calificador temporal), 5 corridas ──');
{
  const N = 5;
  let puntualCount = 0, trendCount = 0, otherCount = 0, responded = 0;
  for (let run = 0; run < N; run++) {
    if (run > 0) await sleep(6000);
    let plan;
    try { const pr = await handlePlan({ text: "¿Cómo viene el margen de Falabella?", history: [], mem: {}, scenario: "actual" }); if (!pr.ok) throw new Error(pr.error || "plan no-ok"); plan = pr.plan; }
    catch (e) { console.log(`  run${run}: PLAN-FAIL ${e.message}`); continue; }
    responded++;
    const calls = Array.isArray(plan.calls) ? plan.calls : [];
    const isPuntual = calls.some((c) => c && (c.tool === "entityProfile" || c.tool === "entityRecord"));
    const isTrend = calls.some((c) => c && c.tool === "trend");
    console.log(`  run${run}: calls=${JSON.stringify(calls.map((c) => c.tool))} → ${isPuntual ? "puntual (OK)" : isTrend ? "trend (inconsistente)" : "otro"}`);
    if (isPuntual) puntualCount++; else if (isTrend) trendCount++; else otherCount++;
  }
  console.log(`  medición: ${puntualCount}/${N} tool puntual (entityProfile/entityRecord) · ${trendCount}/${N} trend · ${otherCount}/${N} otro (baseline pre-fix documentado: 0/4 puntual, 3/4 trend)`);
  ok(responded === N, `las ${N} corridas respondieron con un plan válido — obtuvo ${responded}/${N}`);
  ok(puntualCount >= 1, `al menos 1/${N} corrida ahora usa la tool puntual correcta (antes: 0/4) — obtuvo ${puntualCount}/${N}`);
}

console.log('\n── REGRESIÓN — CON calificador temporal explícito, trend sigue siendo la tool correcta ──');
{
  let plan;
  try { const pr = await handlePlan({ text: "¿Cómo viene el margen de Falabella mes a mes?", history: [], mem: {}, scenario: "actual" }); plan = pr.ok ? pr.plan : null; }
  catch { plan = null; }
  const calls = (plan && Array.isArray(plan.calls)) ? plan.calls : [];
  const isTrend = calls.some((c) => c && c.tool === "trend");
  console.log(`  calls=${JSON.stringify(calls.map((c) => c && c.tool))}`);
  ok(isTrend, `"...mes a mes" (CON calificador) sigue yendo a trend — el fix no rompió el caso correcto — obtuvo ${JSON.stringify(calls.map((c) => c && c.tool))}`);
}

console.log(`\n── _trend_vs_puntual_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
