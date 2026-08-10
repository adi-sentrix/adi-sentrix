/* === _pct_negativo_gate.mjs · GATE · parseFigures(boleta.js) captura el signo "-" en cifras "%" ===
 * owner 2026-07-31, auditoría (defecto "Simulaciones" — canon pct sin signo):
 *
 * boleta.js parseFigures() usaba `/(\d[\d.,]*\d|\d)\s?%/g` — SIN grupo de signo — para canonicalizar cifras "%"
 * citadas por el narrador. toolRegistry.js (simulateGeneral) SÍ incluye el signo en el canon de sus figs para
 * deltas negativos (fig(`${entity} · Volumen propuesto`, "-10%", {unit:"pct", raw:-10, ...}) → canon "pct:-10%").
 * Sin el signo, la narración citando "-10%" (correcto, real, autorizado) canonizaba a "pct:10%" — NUNCA calzaba
 * contra "pct:-10%" de la boleta → guardC rechazaba como "no autorizada" una cifra perfectamente autorizada.
 *
 * Reproducido 1/1 en la corrida principal (out=null) + 3/3 en diagnóstico aislado — 100% determinístico, sin LLM.
 * FIX: rePct ahora captura el signo opcional "-" (mismo patrón que reMoney/rePP, que ya lo hacían bien). */
import { fig, parseFigures, guardAgainstBoleta } from "./src/adi/boleta.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
import { guardC } from "./src/adi/oracle/guardC.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · parseFigures captura el signo en cifras pct ──");
{
  const figsNeg = parseFigures("bajando el volumen -10% se recompone la venta.");
  ok(figsNeg.some((f) => f.unit === "pct" && f.raw === -10 && f.canon === "pct:-10%"), `parseFigures("-10%") → raw=-10, canon="pct:-10%" (encontrado: ${JSON.stringify(figsNeg.filter((f) => f.unit === "pct"))})`);

  const figsPos = parseFigures("subiendo el precio 8% mejora el margen.");
  ok(figsPos.some((f) => f.unit === "pct" && f.raw === 8 && f.canon === "pct:8%"), `REGRESIÓN: parseFigures("8%") sigue dando raw=8, canon="pct:8%" (no se rompe el caso positivo)`);
}

console.log("\n── 2 · canon de parseFigures(narración) == canon de fig() del composer, para pct negativo ──");
{
  const f = fig("Falabella · Volumen propuesto", "-10%", { unit: "pct", raw: -10, source: "actual", context: "supuesto" });
  const parsed = parseFigures("El volumen propuesto de Falabella es -10%.");
  const match = parsed.find((x) => x.unit === "pct" && x.raw === -10);
  ok(!!match && match.canon === f.canon, `canon de la fig() del motor ("${f.canon}") == canon de parseFigures de la narración ("${match && match.canon}")`);
}

console.log('\n── 3 · guardAgainstBoleta AUTORIZA una narración que cita el "-10%" real (antes: BLOQUEABA falso) ──');
{
  const bol = [fig("Falabella · Volumen propuesto", "-10%", { unit: "pct", raw: -10, source: "actual", context: "supuesto" })];
  const g = guardAgainstBoleta("Bajando el volumen -10% en Falabella.", bol);
  ok(g.ok === true, `guardAgainstBoleta ya NO rechaza "-10%" contra boleta con fig raw=-10 (antes: unauthorized, ahora ok=${g.ok}, unauthorized=${JSON.stringify(g.unauthorized)})`);
}

console.log("\n── 4 · pipeline real: simulateGeneral con volumen negativo produce boleta con signo, guardC la autoriza ──");
{
  const plan = { intent: "answer", calls: [{ tool: "simulateGeneral", args: { dimension: "cliente", entity: "Falabella", variableA: { campo: "precioLista", delta_pct: 5 }, variableB: { campo: "unidades", delta_pct: -10 } } }] };
  const { ledger, results, trace } = runPlan(plan, { scenario: "actual" });
  const r = results[0];
  ok(r && r.coverage && r.coverage.supported === true, `simulateGeneral(precio +5%, volumen -10%) sobre Falabella responde soportado`);
  const volFig = ledger.figs.find((f) => /Volumen propuesto/.test(f.label));
  ok(!!volFig && volFig.value === "-10%", `boleta trae "Falabella · Volumen propuesto" = "-10%" (encontrado: ${volFig && volFig.value})`);
  const figs = ledgerBoleta(ledger);
  const narracion = `Si a Falabella le subís el precio 5% y el volumen cae -10%, la venta se recompone en línea con ese supuesto.`;
  const g = guardC(narracion, { ledger, results, trace, question: "" });
  ok(g.ok === true, `guardC AUTORIZA la narración citando "-10%" (el valor real de la boleta) — antes rechazaba los 3 intentos y el turno se perdía (ok=${g.ok}, reason=${g.reason || JSON.stringify(g.violations || [])})`);
}

console.log(`\n── _pct_negativo_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
