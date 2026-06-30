/* === adi/sentrix/concentration.js · Etapa 5 · Sentrix · el PARETO (concentración 80/20) ===
 * El principio de concentración: pocos elementos explican la mayor parte del resultado. DATA-DRIVEN (owner):
 * muestra el % REAL del dato (62 / 73 / 81 / 90 — el que sea), NUNCA fuerza 80. El 80% es la línea de referencia
 * clásica; el "bloque" son los primeros elementos hasta cruzarla. Honesto sin bloqueos: son sumas acumuladas de
 * dato real punto-en-tiempo (no depende de histórico). Scenario-aware (lección GAP 2): cliente/marca/familia se
 * ajustan por escenario; SKU usa base (no hay ajustador · skusMargen no es scenario-adjusted). Puro · client-side. */
import { applyScenarioToClientesVentas, applyScenarioToMarcasVentas, applyScenarioToSfamiliasVentas } from "../../engine/scenarios.js";
import { skusMargen } from "../../data/skusMargen.js";

export const CONCENTRATION_DIMS = [
  { key: "cliente", label: "Cliente", plural: "clientes" },
  { key: "marca",   label: "Marca",   plural: "marcas"   },
  { key: "familia", label: "Familia", plural: "familias" },
  { key: "sku",     label: "SKU",     plural: "SKUs"     },
];

function _rows(dimension, scenario) {
  const s = scenario || "bonanza";
  if (dimension === "cliente") return applyScenarioToClientesVentas(s).map((x) => ({ name: x.nombre, value: Number(x.actual) || 0 }));
  if (dimension === "marca")   return applyScenarioToMarcasVentas(s).map((x) => ({ name: x.nombre, value: Number(x.actual) || 0 }));
  if (dimension === "familia") return applyScenarioToSfamiliasVentas(s).map((x) => ({ name: x.nombre, value: Number(x.actual) || 0 }));
  if (dimension === "sku")     return skusMargen.map((x) => ({ name: x.nombre, value: Number(x.venta) || 0 }));   // base · sin ajustador de escenario
  return [];
}

// Concentración por VENTAS ($) de una dimensión. Devuelve barras (desc) + acumulado + el bloque que llega al 80%.
export function buildConcentration(dimension = "cliente", scenario = "bonanza") {
  const rows = _rows(dimension, scenario).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
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
  const meta = CONCENTRATION_DIMS.find((d) => d.key === dimension) || CONCENTRATION_DIMS[0];
  return { dimension, label: meta.label, plural: meta.plural, scenario: scenario || "bonanza", bars, total, n: bars.length, blockCount, blockPct };
}
