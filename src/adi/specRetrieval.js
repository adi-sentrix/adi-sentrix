/* === src/adi/specRetrieval.js · ADI Core · Paso 5 · PRODUCTOR SPEC-DRIVEN (retrieval/ranking genérico) ===
 * Ejecuta métrica × dimensión × filtros desde el SPEC, sin sintetizar texto ni reusar el parser NL (los productores
 * text-based del motor siguen intactos para el camino determinístico). Es DATA-DRIVEN del CONTRATO: lee
 * METRICS[metric].sourceByAxis[dimension] {source, field, agg} → carga la fuente vía el sourceManifest (scenario-aware
 * si lo declara) → agrupa (eje group-by) o lista (por-fila) → agrega (sum/avg) → formatea. Sirve para INVENTARIO
 * (capital/rotación/DOH por bodega/sku) Y para AGREGADOS comerciales (rank margen/contribución/ventas por marca/familia).
 * SOLO importa el CONTRATO · NO toca el motor sellado. Combinación no declarada → null → el seam degrada honesto.
 */
import { METRICS } from "../config/contract/metricRegistry.js";
import { ENTITIES } from "../config/contract/entityRegistry.js";
import { SOURCES } from "../config/contract/sourceManifest.js";

// carga la fuente vía el CONTRATO: scenarioLoad (scenario-aware) si el manifest lo declara, si no el load base.
function _load(source, scenario) {
  const s = SOURCES[source];
  if (!s) return [];
  if (typeof s.scenarioLoad === "function") return s.scenarioLoad(scenario) || [];
  return (typeof s.load === "function" && s.load()) || [];
}

const _money = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
};
const _fmt = (v, unit) => (unit === "money" ? _money(v) : unit === "pct" ? `${v}%` : unit === "ratio" ? `${v.toFixed(1)}x` : unit === "days" ? `${Math.round(v)}d` : String(v));

// composeSpecRetrieval({metric, dimension, filters, scenario, limit, sort}) → {opener, evidence} | null (no soportado)
export function composeSpecRetrieval({ metric, dimension, filters = {}, scenario, limit = null, sort = null }) {
  const m = METRICS[metric];
  const sba = m && m.sourceByAxis && m.sourceByAxis[dimension];
  if (!sba) return null;                                    // métrica@eje no declarada → no soportada (seam degrada)
  const ent = ENTITIES[dimension];
  if (!ent) return null;

  let rows = _load(sba.source, scenario);
  if (!Array.isArray(rows) || !rows.length) return null;
  if (filters.marca)   rows = rows.filter((r) => r.marca === filters.marca);
  if (filters.familia) rows = rows.filter((r) => r.sfamilia === filters.familia);
  if (filters.bodega)  rows = rows.filter((r) => r.bodega === filters.bodega);
  if (!rows.length) return null;

  const field = sba.field;
  let result;
  if (ent.isGroupBy) {
    // eje de agrupación (bodega): agrupar por el keyField y agregar (sum · avg según el contrato)
    const groups = {};
    for (const r of rows) { const k = r[ent.keyField]; if (k == null) continue; (groups[k] = groups[k] || []).push(r); }
    const agg = sba.agg || "sum";
    result = Object.entries(groups).map(([name, grp]) => {
      const vals = grp.map((r) => r[field]).filter((v) => typeof v === "number");
      const sum = vals.reduce((a, b) => a + b, 0);
      return { name, value: agg === "avg" ? (vals.length ? sum / vals.length : 0) : sum };
    });
  } else {
    // eje por-fila (sku): el nombre viene del keyField de la fuente (skuInventario → "sku")
    const nameField = (SOURCES[sba.source] && SOURCES[sba.source].keyField) || "sku";
    result = rows.map((r) => ({ name: r[nameField], value: r[field] })).filter((x) => typeof x.value === "number");
  }
  if (!result.length) return null;

  const dir = sort && sort.dir === "asc" ? "asc" : "desc";
  result.sort((a, b) => (dir === "asc" ? a.value - b.value : b.value - a.value));
  if (limit && limit > 0) result = result.slice(0, limit);

  const lines = result.map((x) => `${x.name}: ${_fmt(x.value, m.unit)}`).join(" · ");
  const filt = [filters.marca, filters.familia, filters.bodega].filter(Boolean).join("/");
  const opener = `${m.label} por ${ent.label.sing}${filt ? ` (${filt})` : ""} · escenario ${scenario}.\n\n${lines}`;
  return {
    opener,
    suggestions: null,
    sentrixAction: null,
    // evidence SIN ranking_values crudos: el texto muestra formateado ("$64K"), así el number-guard toma las cifras del
    // texto (fuente única de la narración) y no un crudo (64200) que no aparece → evita falsos "falta obligatoria".
    evidence: { entityType: dimension, dimension, metrica: metric, lens: "cuadro" },
  };
}
