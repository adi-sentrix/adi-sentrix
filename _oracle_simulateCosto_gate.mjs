/* === _oracle_simulateCosto_gate.mjs · ARQUITECTURA C · GATE DE simulateCosto === turno 10 del veredicto de 18
 * turnos (owner 2026-07-29): "¿y si bajo el costo medio de mis peores SKU un 3%?" — capacidad AUSENTE (el
 * `simulate` genérico no cubre "costo", y el planner ni siquiera intentaba construirlo). Nuevo composer DEDICADO
 * `composeSpecSimulateCosto` (mismo patrón que Carga/Capital) + tool `simulateCosto` + catálogo en planPrompt.js.
 * 3 capas: (1) identidad numérica por 2 caminos independientes, determinística sin LLM · (2) cobertura de boleta
 * sin huecos por fila (lección D9) · (3) smoke con el pipeline real (LLM), 3 corridas, verifica que el PLAN elija
 * simulateCosto (no un sustituto) y que la narración cite una cifra de ESTA call.
 */
import fs from "fs";
import { composeSpecSimulateCosto } from "./src/adi/specRetrieval.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const SC = "actual";
let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · IDENTIDAD NUMÉRICA (2 caminos independientes, sin LLM) ──");
{
  const r = composeSpecSimulateCosto({ dimension: "sku", pct: -3, scope: "bajo_benchmark", scenario: SC });
  ok(!!r, "composeSpecSimulateCosto(sku,-3%,bajo_benchmark) devuelve resultado");
  const t = r.evidence.total;
  const proj = r.evidence.projection;
  const filaOk = proj.every((it) => it.margenNuevo == null || (it.costoSupuesto < it.costoActual && it.margenNuevo > it.margenActual));
  ok(filaOk, "cada fila: costo baja (pct<0) → costoSupuesto < costoActual Y margenNuevo > margenActual (coherencia direccional fila-por-fila)");
  // identidad: la ΔcontribuciónTOTAL (contribS−contribA, camino A) debe ser EXACTAMENTE el ΔcostoTOTAL invertido
  // (costoA−costoS, camino B, un cálculo independiente sobre las MISMAS filas) — dos caminos, mismo resultado.
  ok(Math.abs((t.contribSupuesto - t.contribActual) - (t.costoActual - t.costoSupuesto)) < 1, "identidad: Δcontribución total == Δcosto total invertido (dos caminos, mismo resultado)");
  // camino B independiente por fila: Σ(costoActual_i − costoSupuesto_i) sobre projection == Δcosto total del resumen
  const sumFilaDelta = proj.reduce((s, it) => s + (it.costoActual - it.costoSupuesto), 0);
  ok(Math.abs(sumFilaDelta - (t.costoActual - t.costoSupuesto)) < 1, "identidad: Σ(Δcosto por fila) == Δcosto del total (sin filas perdidas/duplicadas)");

  const rUp = composeSpecSimulateCosto({ dimension: "cliente", pct: 5, scope: "all", scenario: SC });
  ok(rUp && /Subir el costo/.test(rUp.opener) && /cediendo/.test(rUp.opener), "pct POSITIVO (subir costo): el texto dice 'Subir'/'cediendo', NO 'Bajar'/'recuperando' (bug de dirección, ya arreglado)");
  const rDown = composeSpecSimulateCosto({ dimension: "sku", pct: -3, scenario: SC });
  ok(rDown && /Bajar el costo/.test(rDown.opener) && /recuperando/.test(rDown.opener), "pct NEGATIVO (bajar costo): el texto dice 'Bajar'/'recuperando'");

  // GUARD DE ABSURDOS (hallazgo del re-barrido adversarial: sin esto, pct:-150 dejaba costoSupuesto negativo y un
  // margen de 132% narrado como recomendación real, con guardC en verde). Mismo criterio que el simulate genérico
  // (answerADIFromSpec.js: 0% y >±50% no son supuestos operables).
  const rAbsurdoNeg = composeSpecSimulateCosto({ dimension: "sku", pct: -150, scenario: SC });
  ok(rAbsurdoNeg && typeof rAbsurdoNeg.unsupported === "string", "pct=-150 (costo se vuelve negativo) → degrada honesto con `unsupported`, NO calcula un margen absurdo");
  const rAbsurdoPos = composeSpecSimulateCosto({ dimension: "sku", pct: 200, scenario: SC });
  ok(rAbsurdoPos && typeof rAbsurdoPos.unsupported === "string", "pct=+200 → degrada honesto con `unsupported`");
  const rCero = composeSpecSimulateCosto({ dimension: "sku", pct: 0, scenario: SC });
  ok(rCero && typeof rCero.unsupported === "string", "pct=0 → degrada honesto con `unsupported` (no null genérico — mensaje específico)");
  const rLimite = composeSpecSimulateCosto({ dimension: "sku", pct: -50, scenario: SC });
  ok(rLimite && !rLimite.unsupported && Array.isArray(rLimite.evidence && rLimite.evidence.boleta), "pct=-50 (el límite exacto) SIGUE siendo operable — el guard es >50, no >=50");
  // el wrapper de toolRegistry debe propagar `unsupported` como coverage.supported=false con la razón exacta (no el
  // mensaje genérico "no hay SKU bajo benchmark", que sería una razón de abstención FALSA para este caso)
  const { TOOLS } = await import("./src/adi/oracle/toolRegistry.js");
  const wrapped = TOOLS.simulateCosto({ dimension: "sku", pct: -150, scope: "bajo_benchmark", scenario: SC });
  ok(wrapped.coverage.supported === false && /ya no es un supuesto operable/.test(wrapped.coverage.reason), "el wrapper simulateCosto() propaga la razón ESPECÍFICA de absurdo, no el genérico 'no hay SKU bajo benchmark'");
  ok(typeof composeSpecSimulateCosto({ dimension: "sku", pct: 0, scenario: SC }).unsupported === "string", "pct=0 → `unsupported` honesto (antes null genérico, ahora razón específica — ver sección de guard de absurdos)");
}

console.log("\n── 2 · COBERTURA DE BOLETA SIN HUECOS (lección D9 — sin tope por fila) ──");
{
  const r = composeSpecSimulateCosto({ dimension: "sku", pct: -3, scope: "bajo_benchmark", scenario: SC });
  const proj = r.evidence.projection;
  const labels = new Set(r.evidence.boleta.map((f) => f.label));
  const completa = proj.every((it) => labels.has(`${it.name} · Costo actual`) && labels.has(`${it.name} · Costo supuesto`) && labels.has(`${it.name} · Δ contribución`));
  ok(completa, `las ${proj.length} filas de la proyección tienen SUS 3 figs mínimas en la boleta (sin tope — ninguna fila queda muda)`);
  ok(proj.length >= 6, `hay suficientes filas bajo benchmark en sku (${proj.length}) para que este chequeo sea significativo`);
}

console.log("\n── 3 · SMOKE LLM REAL (3 corridas, pipeline completo) ──");
{
  let planEligeCorrect = 0, guardOk = 0;
  for (let run = 0; run < 3; run++) {
    const q = "¿qué pasa si bajo el costo medio de mis peores SKU un 3%?";
    let plan;
    try { const pr = await handlePlan({ text: q, history: [], mem: {}, scenario: SC }); if (!pr.ok) throw new Error(pr.error); plan = pr.plan; }
    catch (e) { console.log(`  run${run}: PLAN-FAIL ${e.message}`); continue; }
    const calls = Array.isArray(plan.calls) ? plan.calls : [];
    const usedSimulateCosto = calls.some((c) => c.tool === "simulateCosto");
    if (usedSimulateCosto) planEligeCorrect++;
    console.log(`  run${run}: calls=${JSON.stringify(calls.map((c) => c.tool))}`);
    if (!usedSimulateCosto) continue;
    const { ledger, results, trace } = runPlan({ intent: plan.intent, calls }, { scenario: SC });
    const figs = ledgerBoleta(ledger);
    let narration = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      let n;
      try { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC({ text: q, plan, results, ledgerFigs: figs, mem: {} }), mem: {} }); n = nr.ok ? nr.narration : null; }
      catch { n = null; }
      if (!n) continue;
      if (guardC(n, { ledger, results, trace, question: q }).ok) { narration = n; break; }
    }
    if (narration) { guardOk++; console.log(`     GUARD_OK: ${narration.slice(0, 160).replace(/\n/g, " ⏎ ")}`); }
    else console.log("     guard rechazó los 3 intentos");
  }
  ok(planEligeCorrect >= 2, `el plan elige simulateCosto (no un sustituto) en ≥2/3 corridas (obtuvo ${planEligeCorrect}/3)`);
  ok(guardOk >= 1, `al menos 1/3 corridas guardOk=true citando la evidencia de ESTA call (obtuvo ${guardOk}/3)`);
}

console.log(`\n── _oracle_simulateCosto_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
