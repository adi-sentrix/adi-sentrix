// === HARNESS · paso 4b · EL PARETO (concentración 80/20) · trazabilidad + data-driven + scenario-aware ===
import { buildConcentration, CONCENTRATION_DIMS } from "./src/adi/sentrix/concentration.js";
import { applyScenarioToClientesVentas } from "./src/engine/scenarios.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("✅", m); } else { fail++; console.log("🚨", m); } };

console.log("── TRAZABILIDAD · concentración cliente (bonanza) vs recálculo crudo ──");
const con = buildConcentration("cliente", "bonanza");
// recálculo independiente
const raw = applyScenarioToClientesVentas("bonanza").map((x) => ({ name: x.nombre, value: x.actual })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
const total = raw.reduce((s, r) => s + r.value, 0);
let cum = 0; const exp = raw.map((r) => { cum += r.value; return { name: r.name, cumPct: (cum / total) * 100 }; });
let bc = exp.findIndex((b) => b.cumPct >= 80) + 1; if (bc <= 0) bc = exp.length;
const bp = Math.round(exp[bc - 1].cumPct);

ok(con.total === total, `total ${con.total} == recálculo ${total}`);
ok(con.bars[0].name === exp[0].name && con.bars[0].value === raw[0].value, `top-1 ${con.bars[0].name} (${con.bars[0].value}) == recálculo ${exp[0].name}`);
ok(con.blockCount === bc, `blockCount ${con.blockCount} == ${bc}`);
ok(con.blockPct === bp, `blockPct ${con.blockPct}% == recálculo ${bp}% (REAL, no forzado)`);
ok(con.bars.every((b, i) => i === 0 || b.cumPct >= con.bars[i - 1].cumPct), `acumulado monótono creciente`);
ok(Math.abs(con.bars[con.bars.length - 1].cumPct - 100) < 0.001, `acumulado final == 100%`);
ok(con.bars.filter((b) => b.inBlock).length === con.blockCount, `${con.blockCount} barras marcadas en el bloque 80%`);
ok(con.blockPct >= 80, `el bloque cruza el 80% (${con.blockPct}%)`);

console.log("\n── DATA-DRIVEN · el % es el del dato, NO forzado a 80 ──");
ok(con.blockPct !== 80 || exp[bc - 1].cumPct === 80, `blockPct=${con.blockPct}% es el acumulado REAL del corte (no un 80 hardcodeado)`);

console.log("\n── GENERICIDAD · las 4 dimensiones producen Pareto válido ──");
for (const d of CONCENTRATION_DIMS) {
  const c = buildConcentration(d.key, "bonanza");
  ok(c.bars.length > 0 && c.blockCount >= 1 && c.blockCount <= c.n && c.blockPct >= 80, `${d.label}: ${c.n} ítems · primeros ${c.blockCount} explican ${c.blockPct}%`);
}

console.log("\n── SCENARIO-AWARE · cliente cambia con el escenario (lección GAP 2) ──");
const tB = buildConcentration("cliente", "bonanza").total;
const tT = buildConcentration("cliente", "tension").total;
const tC = buildConcentration("cliente", "crisis").total;
ok(tB !== tT || tT !== tC, `totales por escenario distintos (bonanza ${tB} · tensión ${tT} · crisis ${tC})`);
ok([tB, tT, tC].every((t) => t > 0), `los 3 escenarios producen total > 0 (sin crash)`);

console.log("\n" + "═".repeat(52));
console.log(`GATES: ${pass}/${pass + fail}` + (fail ? " · 🚨 HAY ROJOS" : " · TODOS VERDES"));
process.exit(fail ? 1 : 0);
