// === HARNESS · brick 7 · CONTROL · la TABLA-RING (buildControlRing) ===
import { buildControlRing } from "./src/adi/sentrix/control.js";
import { buildMarginDecomposition } from "./src/adi/sentrix/kpis.js";
import { applyScenarioToClientesMargen, applyScenarioToSkuInventario } from "./src/engine/scenarios.js";
import { METRIC_DEFS } from "./src/adi/sentrix/glossary.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("✅", m); } else { fail++; console.log("🚨", m); } };
const _inmov = (x) => (x.alerta && x.alerta !== "ok") || x.rotacion < 2;

console.log("── CLIENTE · el ring · Lider anclado contra promedio + mejor + par (bonanza) ──");
const ring = buildControlRing("client", "Lider", "bonanza");
ok(ring != null, "ring existe para Lider");
const byRole = (r) => ring.rows.find((x) => x.role === r);
const focus = byRole("focus"), avg = byRole("avg"), best = byRole("best"), peer = byRole("peer");
ok(focus && focus.name === "Lider", "fila FOCO = Lider");
ok(avg && avg.gap === 0 && /promedio/i.test(avg.name), "fila PROMEDIO (gap 0)");
ok(best && best.gap > 0, "fila MEJOR-EN-CLASE (gap positivo)");
ok(ring.rows.length >= 3, `el ring nunca es una fila sola (${ring.rows.length} filas)`);

console.log("\n── LA PLATA · contribución ($) reemplaza costo% (owner · la gente reacciona a la plata) ──");
ok(ring.columns.some((c) => c.key === "contribucion"), "el ring tiene columna Contribución ($)");
ok(!ring.columns.some((c) => c.key === "costo"), "el costo% ya NO es columna (vive en Diagnóstico/Evidencia)");
[focus, peer, best].forEach((r) => ok(r.contribucion > 0, `${r.name}: contribución $${r.contribucion}K (el stake)`));

console.log("\n── TRAZABILIDAD · el foco == el dato crudo ──");
const cm = applyScenarioToClientesMargen("bonanza").find((c) => c.nombre === "Lider");
ok(focus.margen === cm.margen, `margen foco ${focus.margen} == dato ${cm.margen}`);
ok(focus.carga === Math.round(cm.pctRebate * 10) / 10, `carga foco ${focus.carga} == dato ${cm.pctRebate}`);
ok(focus.contribucion === Math.round(cm.contribucion), `contribución foco ${focus.contribucion} == dato ${Math.round(cm.contribucion)}`);

console.log("\n── LA PALANCA · dominante = la de la brecha · par instructivo la aísla ──");
const d = buildMarginDecomposition("Lider", "bonanza");
ok(ring.lever === d.dominant, `palanca ${ring.lever} == dominante de la brecha ${d.dominant}`);
ok(peer != null && peer.margen > focus.margen, "el par instructivo tiene MEJOR margen que el foco");
// eje NO-palanca (si palanca=costo → carga fija): el par está más cerca en carga que el promedio del set
if (ring.lever === "costo") ok(Math.abs(peer.carga - focus.carga) <= Math.abs(avg.carga - focus.carga) + 1.0, `par ≈ misma carga que el foco (aísla el costo)`);
else ok(Math.abs(peer.costo - focus.costo) <= Math.abs(avg.costo - focus.costo) + 1.0, `par ≈ mismo costo que el foco (aísla la carga)`);

console.log("\n── ELEGÍ UN CAMINO · techo estructural de costo ($ honesto) ──");
ok(ring.costoTechoK > 0, `techo de costo = $${ring.costoTechoK}K (si el costo llegara al promedio)`);

console.log("\n── COLUMNAS del catálogo + GENERICIDAD ──");
ok(ring.columns.length === 4 && ring.columns[0].key === "margen", "4 columnas (margen/carga/contribución/gap)");
ok(ring.columns.every((c) => c.defKey && METRIC_DEFS[c.defKey]), "cada columna resuelve su ayuda en el glosario (el 'i' muestra definición)");
ok(buildControlRing("client", "NoExiste", "bonanza") === null, "cliente inexistente → null (honesto · placeholder)");
// B4 · SKU y marca AHORA arman ring (antes null · placeholder) · el par instructivo dentro de la familia/marcas
const _skuRing = buildControlRing("sku", "MAK-COMP-AIR", "bonanza");
ok(_skuRing && _skuRing.entityType === "sku" && _skuRing.rows.some((r) => r.role === "focus") && _skuRing.rows.some((r) => r.role === "best"), "SKU → ring (foco + mejor-en-clase · B4)");
const _marcaRing = buildControlRing("marca", "Samsung", "bonanza");
ok(_marcaRing && _marcaRing.entityType === "marca" && _marcaRing.rows.some((r) => r.role === "focus"), "marca → ring (agregación ponderada · B4)");
ok(buildControlRing("familia", "Línea Blanca", "bonanza") === null, "tipo aún no soportado (familia) → null");

console.log("\n── SCENARIO-AWARE ──");
const rC = buildControlRing("client", "Lider", "crisis");
ok(rC != null && rC.rows.find((x) => x.role === "focus"), "el ring se arma en crisis también");

console.log("\n── BODEGA · GENERICIDAD (mismo esqueleto · la plata = capital/inmovilizado) ──");
const rb = buildControlRing("bodega", "Valparaíso", "bonanza");
ok(rb != null && rb.entityType === "bodega", "ring de bodega existe (Valparaíso)");
const bF = rb.rows.find((x) => x.role === "focus"), bA = rb.rows.find((x) => x.role === "avg"), bB = rb.rows.find((x) => x.role === "best");
ok(bF && bF.name === "Valparaíso", "fila FOCO = Valparaíso");
ok(rb.columns.map((c) => c.key).join(",") === "capital,inmovilizado,rotacion,gap", "columnas de inventario: capital/inmovilizado/rotación/gap");
ok(rb.columns.every((c) => c.defKey && METRIC_DEFS[c.defKey]), "cada columna de bodega resuelve su ayuda (el 'i')");
// trazabilidad vs recálculo crudo
const invV = applyScenarioToSkuInventario("bonanza").filter((x) => x.bodega === "Valparaíso");
const capV = invV.reduce((a, x) => a + x.stockUSD, 0);
const inmovV = invV.filter(_inmov).reduce((a, x) => a + x.stockUSD, 0);
ok(bF.capital === Math.round(capV), `capital foco ${bF.capital} == recálculo ${Math.round(capV)}`);
ok(bF.inmovilizado === Math.round(inmovV), `inmovilizado foco ${bF.inmovilizado} == recálculo ${Math.round(inmovV)}`);
ok(bB && bB.name !== "Valparaíso", `mejor-en-clase = otra bodega (${bB.name}) · nunca una fila sola`);
ok(rb.estructuralK === Math.round(inmovV), `camino estructural = todo el inmovilizado ($${rb.estructuralK}K)`);
ok(rb.quickWinK >= 0 && rb.quickWinK <= rb.estructuralK, `quick-win (crítico $${rb.quickWinK}K) ≤ estructural (inmov $${rb.estructuralK}K)`);
ok(buildControlRing("bodega", "NoExiste", "bonanza") === null, "bodega inexistente → null (honesto)");

console.log("\n════════════════════════════════════════════════════");
console.log(`GATES: ${pass}/${pass + fail} · ${fail === 0 ? "TODOS VERDES" : "HAY ROJOS"}`);
process.exit(fail === 0 ? 0 : 1);
