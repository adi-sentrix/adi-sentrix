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
// escala del contrato: money(K) = valor en MILES de $ → a dólares reales antes de formatear (money(raw) = $ crudo)
const _fmt = (v, unit, scale) => (unit === "money" ? _money(scale === "K" ? v * 1000 : v) : unit === "pct" ? `${v}%` : unit === "ratio" ? `${v.toFixed(1)}x` : unit === "days" ? `${Math.round(v)}d` : String(v));

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

  const _sc = m.scale && m.scale[dimension];
  const lines = result.map((x) => `${x.name}: ${_fmt(x.value, m.unit, _sc)}`).join(" · ");
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

// métricas que aplican a un eje (con sourceByAxis declarado) · base de dive/compare
function _metricsFor(dimension) {
  return Object.entries(METRICS).filter(([, m]) => (m.axes || []).includes(dimension) && m.sourceByAxis && m.sourceByAxis[dimension]);
}
// valor de una entidad para una métrica en un eje (busca la fila por el keyField de la fuente) · null si no está
function _entityValue(name, m, dimension, scenario) {
  const sba = m.sourceByAxis[dimension];
  const src = SOURCES[sba.source];
  if (!src) return null;
  const row = _load(sba.source, scenario).find((r) => String(r[src.keyField]) === String(name));
  return row && typeof row[sba.field] === "number" ? row[sba.field] : null;
}

// composeSpecDive({dimension, entity, scenario}) → perfil de UNA entidad (todas sus métricas del contrato) | null (no está)
export function composeSpecDive({ dimension, entity, scenario }) {
  const ent = ENTITIES[dimension];
  if (!ent || !entity) return null;
  const lines = [];
  for (const [, m] of _metricsFor(dimension)) {
    const v = _entityValue(entity, m, dimension, scenario);
    if (v != null) lines.push(`${m.label}: ${_fmt(v, m.unit, m.scale && m.scale[dimension])}`);
  }
  if (!lines.length) return null;                          // entidad no encontrada en ningún source → el seam degrada honesto
  const opener = `${entity} (${ent.label.sing}) · escenario ${scenario}.\n\n${lines.join(" · ")}`;
  return { opener, suggestions: null, sentrixAction: null, evidence: { entidad: entity, entityType: dimension, dimension, lens: "cuadro" } };
}

// composeSpecCompare({dimension, entities:[a,b], scenario}) → dos entidades lado a lado, métrica por métrica | null
export function composeSpecCompare({ dimension, entities, scenario }) {
  const ent = ENTITIES[dimension];
  if (!ent || !Array.isArray(entities) || entities.length !== 2) return null;
  const [a, b] = entities;
  const lines = [];
  for (const [, m] of _metricsFor(dimension)) {
    const va = _entityValue(a, m, dimension, scenario), vb = _entityValue(b, m, dimension, scenario);
    if (va == null && vb == null) continue;
    const _sc = m.scale && m.scale[dimension];
    lines.push(`${m.label}: ${a} ${va == null ? "—" : _fmt(va, m.unit, _sc)} vs ${b} ${vb == null ? "—" : _fmt(vb, m.unit, _sc)}`);
  }
  if (!lines.length) return null;                          // ninguna de las dos entidades encontrada → el seam degrada honesto
  const opener = `${a} vs ${b} (${ent.label.sing}) · escenario ${scenario}.\n\n${lines.join("\n")}`;
  return { opener, suggestions: null, sentrixAction: null, evidence: { entidad: a, entityType: dimension, dimension, lens: "cuadro" } };
}
