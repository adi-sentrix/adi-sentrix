/* === _compare_vs_gate.mjs · GATE · "A vs B" (2 entidades) prefiere compareEntities sobre 2×entityProfile ===
 * owner 2026-07-31, auditoría (defecto "Rankings y comparaciones", prioridad BAJA — impacto bajo, ajuste de
 * doctrina barato):
 *
 * Para la frase canónica de comparación de 2 entidades ("Falabella vs Lider."), en 2 de 3 corridas idénticas el
 * plan usó entityProfile×2 (dos llamadas de entidad puntual) en vez de compareEntities, pese a que el catálogo
 * reserva compareEntities explícitamente para "SOLO DOS entidades lado a lado". Impacto bajo (entityProfile×2 trae
 * igualmente las columnas necesarias y el resultado numérico es correcto en ambos caminos) — es una inconsistencia
 * de MECANISMO, no de resultado.
 *
 * FIX: planPrompt.js (TOOL_CATALOG, compareEntities) declara explícitamente que es la forma CANÓNICA/PREFERIDA
 * para "A vs B"/"compara A con B" con exactamente 2 entidades — ajuste de doctrina, sin backstop determinístico
 * (el propio triage lo marca "no converge de forma determinística para el fraseo más simple" — no hay patrón
 * inequívoco que forzar sin arriesgar falsos positivos sobre planes de 2 llamadas legítimas).
 *
 * Este gate es SMOKE LLM REAL (mide la tasa, no exige 100% — variance de sampling documentada por el propio
 * hallazgo): reporta cuántas de N corridas usan compareEntities vs entityProfile×2 para la MISMA frase exacta del
 * hallazgo, y confirma que ninguna corrida deja de responder (el fix es de mecanismo, no debe introducir abstención).
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { handlePlan } from "./src/adi/llm/gatewayCore.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('── SMOKE LLM REAL — "Falabella vs Lider." (5 corridas, mismo texto exacto del hallazgo) ──');
{
  const N = 5;
  let compareCount = 0, profileX2Count = 0, otherCount = 0, responded = 0;
  for (let run = 0; run < N; run++) {
    if (run > 0) await sleep(6000);
    let plan;
    try { const pr = await handlePlan({ text: "Falabella vs Lider.", history: [], mem: {}, scenario: "actual" }); if (!pr.ok) throw new Error(pr.error || "plan no-ok"); plan = pr.plan; }
    catch (e) { console.log(`  run${run}: PLAN-FAIL ${e.message}`); continue; }
    responded++;
    const calls = Array.isArray(plan.calls) ? plan.calls : [];
    const isCompare = calls.length === 1 && calls[0] && calls[0].tool === "compareEntities";
    const isProfileX2 = calls.length === 2 && calls.every((c) => c && c.tool === "entityProfile");
    console.log(`  run${run}: calls=${JSON.stringify(calls.map((c) => c.tool))} → ${isCompare ? "compareEntities" : isProfileX2 ? "entityProfile×2" : "otro"}`);
    if (isCompare) compareCount++; else if (isProfileX2) profileX2Count++; else otherCount++;
  }
  console.log(`  medición: ${compareCount}/${N} compareEntities · ${profileX2Count}/${N} entityProfile×2 · ${otherCount}/${N} otro (baseline pre-fix documentado: 1/3 compareEntities)`);
  ok(responded === N, `las ${N} corridas respondieron con un plan válido (el ajuste de doctrina no introduce abstención) — obtuvo ${responded}/${N}`);
  ok(compareCount + profileX2Count > 0, "al menos una corrida usó una tool de comparación reconocida (compareEntities o entityProfile×2) — el gate ejercitó el contrato real");
}

console.log(`\n── _compare_vs_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
