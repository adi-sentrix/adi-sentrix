// === HARNESS · brick 2a · TIRA DE DATOS (buildEntityKPIs) · trazabilidad + scenario-aware ===
import { buildEntityKPIs } from "./src/adi/sentrix/kpis.js";
import { applyScenarioToClientesMargen, applyScenarioToSkuInventario } from "./src/engine/scenarios.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("✅", m); } else { fail++; console.log("🚨", m); } };
const get = (arr, label) => (arr.find((k) => k.label === label) || {}).value;

console.log("── CLIENTE · Lider (bonanza) ──");
const lid = buildEntityKPIs("client", "Lider", "bonanza");
const cm = applyScenarioToClientesMargen("bonanza").find((c) => c.nombre === "Lider");
ok(lid.length === 8, `8 KPIs (${lid.length})`);
ok(get(lid, "Margen") === cm.margen + "%", `Margen ${get(lid, "Margen")} == ${cm.margen}%`);
ok(get(lid, "Carga comercial") === cm.pctRebate + "%", `Carga ${get(lid, "Carga comercial")} == ${cm.pctRebate}%`);
ok(get(lid, "Unidades") === "" + cm.unidades, `Unidades ${get(lid, "Unidades")} == ${cm.unidades}`);
ok(get(lid, "Contribución") === "$" + (cm.contribucion / 1000).toFixed(1) + "M", `Contribución ${get(lid, "Contribución")} (de ${cm.contribucion})`);
ok(get(lid, "Costo unitario") === "$" + cm.costoMedio.toFixed(1) + "K", `Costo unit ${get(lid, "Costo unitario")} == costoMedio ${cm.costoMedio}`);
console.log("  KPIs:", lid.map((k) => `${k.label}=${k.value}`).join(" · "));

console.log("\n── BODEGA · Valparaíso (bonanza) ──");
const val = buildEntityKPIs("bodega", "Valparaíso", "bonanza");
const inv = applyScenarioToSkuInventario("bonanza").filter((x) => x.bodega === "Valparaíso");
const inmov = (x) => (x.alerta && x.alerta !== "ok") || x.rotacion < 2;
const cap = inv.reduce((a, x) => a + x.stockUSD, 0), inmovCap = inv.filter(inmov).reduce((a, x) => a + x.stockUSD, 0);
ok(val.length === 7, `7 KPIs (${val.length})`);
ok(get(val, "Capital") === "$" + (cap / 1000).toFixed(1) + "K", `Capital ${get(val, "Capital")} == ${cap}`);
ok(get(val, "Inmovilizado") === "$" + (inmovCap / 1000).toFixed(1) + "K", `Inmovilizado ${get(val, "Inmovilizado")} == ${inmovCap}`);
console.log("  KPIs:", val.map((k) => `${k.label}=${k.value}`).join(" · "));

console.log("\n── SCENARIO-AWARE · margen de Lider cambia por escenario ──");
const mB = buildEntityKPIs("client", "Lider", "bonanza").find((k) => k.label === "Margen").value;
const mC = buildEntityKPIs("client", "Lider", "crisis").find((k) => k.label === "Margen").value;
ok(mB !== mC, `margen bonanza ${mB} != crisis ${mC} (scenario-aware)`);

console.log("\n── GENERICIDAD · tipo no soportado → vacío (no rompe) ──");
ok(buildEntityKPIs("marca", "Bosch", "bonanza").length === 0, `marca → [] (el resto del Diagnóstico igual se muestra)`);

console.log("\n" + "═".repeat(50));
console.log(`GATES: ${pass}/${pass + fail}` + (fail ? " · 🚨 HAY ROJOS" : " · TODOS VERDES"));
process.exit(fail ? 1 : 0);
