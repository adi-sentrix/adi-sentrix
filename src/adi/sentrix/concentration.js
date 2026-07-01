/* === adi/sentrix/concentration.js · Etapa 5 · Sentrix · el PARETO (concentración 80/20) ===
 * El principio de concentración: pocos elementos explican la mayor parte del resultado. DATA-DRIVEN (owner):
 * muestra el % REAL del dato (62 / 73 / 81 / 90 — el que sea), NUNCA fuerza 80. El 80% es la línea de referencia
 * clásica; el "bloque" son los primeros elementos hasta cruzarla. Honesto sin bloqueos: son sumas acumuladas de
 * dato real punto-en-tiempo (no depende de histórico). Scenario-aware (lección GAP 2): cliente/marca/familia se
 * ajustan por escenario; SKU usa base (no hay ajustador · skusMargen no es scenario-adjusted). Puro · client-side. */
import { applyScenarioToClientesVentas, applyScenarioToMarcasVentas, applyScenarioToSfamiliasVentas, applyScenarioToSkuInventario } from "../../engine/scenarios.js";
import { skusMargen } from "../../data/skusMargen.js";

export const CONCENTRATION_DIMS = [
  { key: "cliente", label: "Cliente", plural: "clientes" },
  { key: "marca",   label: "Marca",   plural: "marcas"   },
  { key: "familia", label: "Familia", plural: "familias" },
  { key: "sku",     label: "SKU",     plural: "SKUs"     },
];

// dims del Pareto de INVENTARIO (capital inmovilizado) — el dato (skuInventario) tiene sku/bodega/marca/sfamilia.
export const INV_DIMS = [
  { key: "sku",     label: "SKU",     plural: "SKUs"     },
  { key: "bodega",  label: "Bodega",  plural: "bodegas"  },
  { key: "marca",   label: "Marca",   plural: "marcas"   },
  { key: "familia", label: "Familia", plural: "familias" },
];

// inmovilizado = stock que no rota (alerta ≠ ok o rotación < 2) · def canónica (= la de la tira de datos)
const _inmovilizado = (x) => (x.alerta && x.alerta !== "ok") || x.rotacion < 2;

function _rows(dimension, scenario) {
  const s = scenario || "bonanza";
  if (dimension === "cliente") return applyScenarioToClientesVentas(s).map((x) => ({ name: x.nombre, value: Number(x.actual) || 0 }));
  if (dimension === "marca")   return applyScenarioToMarcasVentas(s).map((x) => ({ name: x.nombre, value: Number(x.actual) || 0 }));
  if (dimension === "familia") return applyScenarioToSfamiliasVentas(s).map((x) => ({ name: x.nombre, value: Number(x.actual) || 0 }));
  if (dimension === "sku")     return skusMargen.map((x) => ({ name: x.nombre, value: Number(x.venta) || 0 }));   // base · sin ajustador de escenario
  return [];
}

// Filas del Pareto de INVENTARIO: capital inmovilizado ($ atrapado) agregado por dimensión. Scenario-aware
// (applyScenarioToSkuInventario mueve estado/alerta → más inmovilizado en tensión/crisis). Data-driven: la
// dimensión es un campo del propio dato (sku/bodega/marca/sfamilia), no se hardcodea.
function _invRows(dimension, scenario) {
  const inv = (applyScenarioToSkuInventario(scenario || "bonanza") || []).filter(_inmovilizado);
  const keyOf = dimension === "bodega" ? (x) => x.bodega
    : dimension === "marca"   ? (x) => x.marca
    : dimension === "familia" ? (x) => x.sfamilia
    : (x) => x.sku;   // default SKU
  const agg = {};
  inv.forEach((x) => { const k = keyOf(x) || "—"; agg[k] = (agg[k] || 0) + (Number(x.stockUSD) || 0); });
  return Object.entries(agg).map(([name, value]) => ({ name, value }));
}

// Concentración de una dimensión. metric "ventas" (comercial · default) o "inmovilizado" (inventario). Devuelve
// barras (desc) + acumulado + el bloque que llega al 80%. El MOTOR elige metric/dims según el foco (ver surface.js).
export function buildConcentration(dimension = "cliente", scenario = "bonanza", metric = "ventas") {
  const raw = metric === "inmovilizado" ? _invRows(dimension, scenario) : _rows(dimension, scenario);
  const rows = raw.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  let cum = 0;
  const bars = rows.map((r) => {
    cum += r.value;
    return { name: r.name, value: r.value, pct: (r.value / total) * 100, cumPct: (cum / total) * 100 };
  });
  // bloque que EXPLICA el 80%: los primeros hasta cruzar 80% acumulado (al menos 1 · fallback honesto).
  let blockCount = bars.findIndex((b) => b.cumPct >= 80) + 1;
  if (blockCount <= 0) blockCount = bars.length;
  bars.forEach((b, i) => { b.inBlock = i < blockCount; });
  const blockPct = bars[blockCount - 1] ? Math.round(bars[blockCount - 1].cumPct) : 0;   // % REAL en el corte (data-driven)
  const dimList = metric === "inmovilizado" ? INV_DIMS : CONCENTRATION_DIMS;
  const meta = dimList.find((d) => d.key === dimension) || dimList[0];
  return { dimension, metric, label: meta.label, plural: meta.plural, scenario: scenario || "bonanza", bars, total, n: bars.length, blockCount, blockPct };
}
