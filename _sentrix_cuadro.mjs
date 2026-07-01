// === HARNESS · CUADRO DE MANDO (4ª lente · buildCuadroMando) · grilla operable + totales ===
import { buildCuadroMando, CUADRO_DIMS } from "./src/adi/sentrix/cuadro.js";
import { applyScenarioToClientesMargen, applyScenarioToClientesVentas } from "./src/engine/scenarios.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("✅", m); } else { fail++; console.log("🚨", m); } };
const _sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const _near = (a, b) => Math.abs(a - b) < 1;

console.log("── CLIENTES · columnas en el orden pedido (ventas·unidades·acciones·contribución·margen) ──");
const q = buildCuadroMando("cliente", "bonanza");
ok(q.columns.map((c) => c.key).slice(0, 5).join(",") === "ventas,unidades,acciones,contribucion,margen", "orden de columnas correcto");
ok(q.n === 13 && q.rows.length === 13, `${q.n} clientes`);

console.log("\n── TOTALES · la fila cierra (sumas · margen ponderado) ──");
ok(q.total && q.total._total, "hay fila total");
ok(_near(q.total.ventas, _sum(q.rows, (r) => r.ventas)), `ventas total ${q.total.ventas} == Σ filas`);
ok(_near(q.total.unidades, _sum(q.rows, (r) => r.unidades)), `unidades total ${q.total.unidades} == Σ`);
ok(_near(q.total.acciones, _sum(q.rows, (r) => r.acciones)), `acciones total ${q.total.acciones} == Σ`);
ok(_near(q.total.contribucion, _sum(q.rows, (r) => r.contribucion)), `contribución total ${q.total.contribucion} == Σ`);
const wM = Math.round(_sum(q.rows, (r) => r.contribucion) / _sum(q.rows, (r) => r.ventas) * 100 * 10) / 10;
ok(q.total.margen === wM, `margen total ${q.total.margen}% == ponderado (Σcontrib/Σventas) ${wM}%`);

console.log("\n── TRAZABILIDAD · una fila == dato crudo ──");
const cm = applyScenarioToClientesMargen("bonanza").find((c) => c.nombre === "Lider");
const cv = applyScenarioToClientesVentas("bonanza").find((c) => c.nombre === "Lider");
const lider = q.rows.find((r) => r.name === "Lider");
ok(lider.ventas === cv.actual, `ventas Lider ${lider.ventas} == dato ${cv.actual}`);
ok(lider.unidades === cm.unidades && lider.acciones === cm.rebates, `unidades/acciones Lider == dato (${cm.unidades}/${cm.rebates})`);
ok(lider.margen === cm.margen, `margen Lider ${lider.margen} == dato ${cm.margen}`);
ok(lider.alert === true, "Lider en alerta (bajo benchmark)");

console.log("\n── GENERICIDAD · las 4 dimensiones construyen + tienen total ──");
for (const d of CUADRO_DIMS) {
  const g = buildCuadroMando(d.key, "bonanza");
  ok(g.rows.length > 0 && g.total && g.columns.length >= 4, `${d.label}: ${g.rows.length} filas · ${g.columns.length} columnas · total ✓`);
}
const bod = buildCuadroMando("bodega", "bonanza");
ok(bod.columns.some((c) => c.key === "capital") && bod.columns.some((c) => c.key === "inmovilizado"), "bodega: columnas de inventario (capital/inmovilizado)");
ok(_near(bod.total.capital, _sum(bod.rows, (r) => r.capital)), "bodega total capital cierra");

console.log("\n── ACCIÓN + ALERTA derivadas + SCENARIO-AWARE ──");
ok(q.rows.every((r) => typeof r.accion === "string" && r.accion.length > 0), "toda fila tiene acción derivada");
ok(buildCuadroMando("cliente", "crisis").total.margen !== q.total.margen, "el margen total cambia por escenario (crisis ≠ bonanza)");

console.log("\n════════════════════════════════════════════════════");
console.log(`GATES: ${pass}/${pass + fail} · ${fail === 0 ? "TODOS VERDES" : "HAY ROJOS"}`);
process.exit(fail === 0 ? 0 : 1);
