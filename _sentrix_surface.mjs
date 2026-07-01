// === HARNESS · brick 5 · GENERICIDAD DE GRÁFICOS · el motor arma la superficie (surface.js) + Pareto de inmovilizado ===
import { buildConcentration, INV_DIMS } from "./src/adi/sentrix/concentration.js";
import { diagnosisCharts } from "./src/adi/sentrix/surface.js";
import { applyScenarioToSkuInventario } from "./src/engine/scenarios.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("✅", m); } else { fail++; console.log("🚨", m); } };
const inmov = (x) => (x.alerta && x.alerta !== "ok") || x.rotacion < 2;

console.log("── EL MOTOR DECIDE LA SUPERFICIE · comercial (client) ──");
const dc = diagnosisCharts("client");
ok(dc.inventory === false, `client → inventory=false`);
ok(dc.evolution === true, `client → evolutivo SÍ (histórico comercial real)`);
ok(dc.concentration.metric === "ventas", `client → Pareto de ventas`);
ok(dc.concentration.defaultDim === "cliente", `client → dim default = cliente`);

console.log("\n── EL MOTOR DECIDE LA SUPERFICIE · inventario (bodega) ──");
const di = diagnosisCharts("bodega");
ok(di.inventory === true, `bodega → inventory=true`);
ok(di.evolution === false, `bodega → evolutivo OCULTO (no hay histórico de inventario · honesto)`);
ok(di.concentration.metric === "inmovilizado", `bodega → Pareto de capital inmovilizado`);
ok(di.concentration.defaultDim === "sku", `bodega → dim default = sku`);
ok(di.concentration.dims === INV_DIMS && INV_DIMS.length === 4, `bodega → dims de inventario (SKU/Bodega/Marca/Familia)`);

console.log("\n── TRAZABILIDAD · Pareto de inmovilizado por SKU vs recálculo crudo (bonanza) ──");
const inv = applyScenarioToSkuInventario("bonanza").filter(inmov);
const totExp = inv.reduce((s, x) => s + x.stockUSD, 0);
const conSku = buildConcentration("sku", "bonanza", "inmovilizado");
ok(conSku.metric === "inmovilizado", `metric propagada = inmovilizado`);
ok(conSku.total === totExp, `total inmovilizado ${conSku.total} == recálculo ${totExp}`);
ok(conSku.total === 55800, `total == $55.8K (dato de la memoria)`);
ok(conSku.n === inv.length && conSku.n === 5, `${conSku.n} SKUs inmovilizados (los 5 con alerta/rotación<2)`);
ok(conSku.bars[0].name === "LG-DRYER8KG" && conSku.bars[0].value === 13600, `top-1 = LG-DRYER8KG ($13.6K)`);
ok(conSku.bars.every((b, i) => i === 0 || b.cumPct >= b.cumPct - 0.001) && Math.abs(conSku.bars[conSku.n - 1].cumPct - 100) < 0.001, `acumulado cierra en 100%`);
ok(conSku.blockCount === 4 && conSku.blockPct === 85, `bloque 80% = 4 SKUs (85% real del corte)`);

console.log("\n── TRAZABILIDAD · Pareto de inmovilizado por BODEGA (Valparaíso 44%) ──");
const conBod = buildConcentration("bodega", "bonanza", "inmovilizado");
const aggBod = {};
inv.forEach((x) => { aggBod[x.bodega] = (aggBod[x.bodega] || 0) + x.stockUSD; });
const topBod = Object.entries(aggBod).sort((a, b) => b[1] - a[1])[0];
ok(conBod.total === totExp, `total por bodega ${conBod.total} == mismo inmovilizado ${totExp}`);
ok(conBod.bars[0].name === topBod[0] && conBod.bars[0].name === "Valparaíso", `bodega top = Valparaíso`);
ok(Math.round(conBod.bars[0].pct) === 44, `Valparaíso concentra 44% del inmovilizado`);

console.log("\n── GENERICIDAD · las 4 dims de inventario producen Pareto válido ──");
for (const d of INV_DIMS) {
  const c = buildConcentration(d.key, "bonanza", "inmovilizado");
  ok(c.bars.length > 0 && c.blockCount >= 1 && c.blockCount <= c.n && c.blockPct >= 80, `${d.label}: ${c.n} ítems · primeros ${c.blockCount} concentran ${c.blockPct}%`);
}

console.log("\n── SCENARIO-AWARE · crisis mueve el inmovilizado (más alertas) ──");
const tB = buildConcentration("sku", "bonanza", "inmovilizado").total;
const tC = buildConcentration("sku", "crisis", "inmovilizado").total;
ok(tC >= tB, `crisis inmoviliza ≥ bonanza (bonanza ${tB} · crisis ${tC})`);

console.log("\n════════════════════════════════════════════════════");
console.log(`GATES: ${pass}/${pass + fail} · ${fail === 0 ? "TODOS VERDES" : "HAY ROJOS"}`);
process.exit(fail === 0 ? 0 : 1);
