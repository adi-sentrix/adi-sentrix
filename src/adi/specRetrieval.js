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
import { POLICY, benchmarkOf } from "../config/businessPolicy.js";   // umbrales de política (UNA verdad) para el diagnose
import { fig } from "./boleta.js";   // BOLETA de cifras autorizadas (primera clase · emitida por el composer · la valida el guard)
import { diagnoseInventario, diagnoseClientes, diagnoseSkus, concentracion } from "./diagnosis/economicDiagnosis.js";   // motor: 4 puntas inventario + patrón económico cliente/SKU + concentración 80/20 · UNA verdad
import { clientesVentas as _cVentas, marcasVentas as _mVentas, sfamiliasVentas as _fVentas, historialMargen as _histM } from "../data/demoData.js";   // ventas con YoY+ppto (marca/familia NO están en el contrato → carga directa) + historial mensual (el año de cada cuenta)
import { buildCompareEvolution as _cmpEvolution } from "./sentrix/temporal.js";   // las dos curvas del año (tendencia × estacionalidad real) para el causal temporal del compare
import { skusMargen as _skusM } from "../data/skusMargen.js";   // SKU: venta+unidades (sin anterior/ppto)
import { ventasKPI as _vKPI } from "../data/baseKpis.js";       // totales de cartera (100K vs 92.9K vs 97K)

// carga la fuente vía el CONTRATO: scenarioLoad (scenario-aware) si el manifest lo declara, si no el load base.
function _load(source, scenario) {
  const s = SOURCES[source];
  if (!s) return [];
  if (typeof s.scenarioLoad === "function") return s.scenarioLoad(scenario) || [];
  return (typeof s.load === "function" && s.load()) || [];
}
// carga la BASE REAL de una fuente (SIEMPRE .load() · el dato "actual" que ve el usuario · SIN motor de escenarios).
// Las simulaciones (supuestos) se aplican SOBRE esto; nunca se invoca scenarioLoad ni bonanza/tensión/crisis.
function _loadReal(source) {
  const s = SOURCES[source];
  return (s && typeof s.load === "function" && s.load()) || [];
}

const _money = (v) => {
  const a = Math.abs(v), s = v < 0 ? "-" : "";   // signo ANTES del $ ("-$6K", no "$-6K")
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`;
  return `${s}$${Math.round(a)}`;
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
  if (filters.marca)   rows = rows.filter((r) => r && r.marca === filters.marca);
  if (filters.familia) rows = rows.filter((r) => r && r.sfamilia === filters.familia);
  if (filters.bodega)  rows = rows.filter((r) => r && r.bodega === filters.bodega);
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
  const outRows = result.map((x) => ({ name: x.name, value: x.value, fmt: _fmt(x.value, m.unit, _sc) }));
  const lines = outRows.map((x) => `${x.name}: ${x.fmt}`).join(" · ");
  const filt = [filters.marca, filters.familia, filters.bodega].filter(Boolean).join("/");
  const opener = `${m.label} por ${ent.label.sing}${filt ? ` (${filt})` : ""} · escenario ${scenario}.\n\n${lines}`;
  // BOLETA (primera clase): cada fila del ranking es una cifra autorizada · value == x.fmt del texto (una sola verdad)
  const _bctx = `${m.label} por ${ent.label.sing}${filt ? ` (${filt})` : ""}`;
  const bol = outRows.map((x) => fig(`${x.name} · ${m.label}`, x.fmt, { unit: m.unit, raw: x.value, context: _bctx }));
  return {
    opener,
    suggestions: null,
    sentrixAction: null,
    // evidence enriquecida (Fase 2 · contratos): `rows` estructuradas (nombre + valor + formato) para que el CLOSER lea
    // el PATRÓN (líder/cola/polaridad) sin recomputar ni introducir cifras. El texto sigue mostrando formateado ("$64K").
    evidence: { entityType: dimension, dimension, metrica: metric, lens: "cuadro", boleta: bol,
      rows: outRows, metricLabel: m.label, unit: m.unit, polarity: m.polarity, dimLabel: ent.label.sing, sortDir: dir },
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

// sampleEntities(dimension, n, scenario) → hasta n nombres reales del eje (data-driven · para repreguntas de comparación
// con opciones concretas · nada hardcodeado). Excluye duplicados; primeros del source. Vacío si el eje no existe.
export function sampleEntities(dimension, n = 3, scenario = "actual") {
  const ent = ENTITIES[dimension]; if (!ent) return [];
  const src = SOURCES[ent.source]; if (!src) return [];
  const seen = [];
  for (const r of _load(ent.source, scenario)) {
    const name = r[src.keyField];
    if (name && !seen.includes(name)) seen.push(name);
    if (seen.length >= n) break;
  }
  return seen;
}

// composeSpecDive({dimension, entity, scenario}) → perfil de UNA entidad (todas sus métricas del contrato) | null (no está)
export function composeSpecDive({ dimension, entity, scenario }) {
  const ent = ENTITIES[dimension];
  if (!ent || !entity) return null;
  const lines = [], metrics = [];
  for (const [, m] of _metricsFor(dimension)) {
    const v = _entityValue(entity, m, dimension, scenario);
    if (v != null) {
      const fmt = _fmt(v, m.unit, m.scale && m.scale[dimension]);
      lines.push(`${m.label}: ${fmt}`);
      metrics.push({ label: m.label, value: v, fmt, unit: m.unit, polarity: m.polarity });   // Fase 2b · para que el closer lea la TENSIÓN
    }
  }
  if (!lines.length) return null;                          // entidad no encontrada en ningún source → el seam degrada honesto
  const opener = `${entity} (${ent.label.sing}) · escenario ${scenario}.\n\n${lines.join(" · ")}`;
  // BOLETA (primera clase): cada métrica del perfil es una cifra autorizada · value == fmt del texto (una sola verdad)
  const bol = metrics.map((mm) => fig(`${entity} · ${mm.label}`, mm.fmt, { unit: mm.unit, raw: mm.value, context: `${entity} (${ent.label.sing})` }));
  return { opener, suggestions: null, sentrixAction: null, evidence: { entidad: entity, entityType: dimension, dimension, lens: "cuadro", metrics, boleta: bol } };
}

// comparePairs(dimension, entities, scenario) → pairs A vs B (métrica por métrica) + participación (share de ventas) para
// el PANEL COMPARATIVO de Sentrix. null si falta una entidad (→ el texto del motor degrada honesto, sin panel roto).
export function comparePairs(dimension, entities, scenario = "actual") {
  const ent = ENTITIES[dimension];
  if (!ent || !Array.isArray(entities) || entities.length !== 2) return null;
  const [a, b] = entities; const pairs = []; let aAny = false, bAny = false;
  for (const [, m] of _metricsFor(dimension)) {
    const va = _entityValue(a, m, dimension, scenario), vb = _entityValue(b, m, dimension, scenario);
    if (va != null) aAny = true; if (vb != null) bAny = true;
    if (va == null && vb == null) continue;
    const _sc = m.scale && m.scale[dimension];
    pairs.push({ label: m.label, aFmt: va == null ? "—" : _fmt(va, m.unit, _sc), bFmt: vb == null ? "—" : _fmt(vb, m.unit, _sc), aVal: va, bVal: vb, unit: m.unit, polarity: m.polarity });
  }
  if (!aAny || !bAny || !pairs.length) return null;   // una entidad ausente → sin panel comparativo
  // participación (share de ventas) = señal de ESCALA · se computa contra el total del eje
  const vm = METRICS.ventas, vsba = vm && vm.sourceByAxis && vm.sourceByAxis[dimension];
  if (vsba) {
    const rows = _load(vsba.source, scenario);
    const total = rows.reduce((s, r) => s + (typeof r[vsba.field] === "number" ? r[vsba.field] : 0), 0);
    const av = _entityValue(a, vm, dimension, scenario), bv = _entityValue(b, vm, dimension, scenario);
    if (total > 0 && av != null && bv != null)
      pairs.unshift({ label: "Participación", aFmt: (av / total * 100).toFixed(1) + "%", bFmt: (bv / total * 100).toFixed(1) + "%", aVal: +(av / total * 100).toFixed(1), bVal: +(bv / total * 100).toFixed(1), unit: "pct", polarity: "higher" });
  }
  return { a, b, pairs };
}

// composeSpecCompare({dimension, entities:[a,b], scenario}) → dos entidades lado a lado, métrica por métrica | null
export function composeSpecCompare({ dimension, entities, scenario }) {
  const ent = ENTITIES[dimension];
  if (!ent || !Array.isArray(entities) || entities.length !== 2) return null;
  const [a, b] = entities;
  const lines = [], pairs = [];
  for (const [, m] of _metricsFor(dimension)) {
    const va = _entityValue(a, m, dimension, scenario), vb = _entityValue(b, m, dimension, scenario);
    if (va == null && vb == null) continue;
    const _sc = m.scale && m.scale[dimension];
    const aFmt = va == null ? "—" : _fmt(va, m.unit, _sc), bFmt = vb == null ? "—" : _fmt(vb, m.unit, _sc);
    lines.push(`${m.label}: ${a} ${aFmt} vs ${b} ${bFmt}`);
    pairs.push({ label: m.label, aFmt, bFmt, aVal: va, bVal: vb, unit: m.unit, polarity: m.polarity });   // Fase 2b · para leer la DIFERENCIA PRINCIPAL
  }
  if (!lines.length) return null;                          // ninguna de las dos entidades encontrada → el seam degrada honesto
  const opener = `${a} vs ${b} (${ent.label.sing}) · escenario ${scenario}.\n\n${lines.join("\n")}`;
  // BOLETA (primera clase): cada lado de cada métrica es una cifra autorizada · value == el fmt del texto (una sola verdad)
  const _ctx = `${a} vs ${b}`;
  const bol = [];
  for (const p of pairs) {
    if (p.aFmt !== "—") bol.push(fig(`${a} · ${p.label}`, p.aFmt, { unit: p.unit, raw: p.aVal, mandatory: true, context: _ctx }));
    if (p.bFmt !== "—") bol.push(fig(`${b} · ${p.label}`, p.bFmt, { unit: p.unit, raw: p.bVal, mandatory: true, context: _ctx }));
  }
  return { opener, suggestions: null, sentrixAction: null, evidence: { entidad: a, entityB: b, entityType: dimension, dimension, lens: "cuadro", pairs, boleta: bol } };
}

/* ── composeSpecDiagnose · ADI Core · motor DIAGNOSE (¿dónde se pierde/inmoviliza plata?) ──────────────
 * Lo que separa a ADI del BI clásico: un barrido DATA-DRIVEN de detectores sobre el dato del contrato —
 * cambia cuando cambia el dato, NADA hardcodeado (sobrevive el swap a un ERP real).
 * Reglas cerradas (owner 2026-07-03):
 *   · margen  → "contribución no capturada" = venta×benchmark/100 − contribución  (= brecha de margen en $)
 *   · carga   → carga comercial sobre el target FIJO 3.5% (POLICY.targetCarga) · recuperable = (carga−target)/100 × venta
 *   · capital → dormido por umbral NUMÉRICO: rotación < POLICY.rotacionMin  ó  doh > POLICY.dohMax
 * Multiplicador de ventas = clientesVentas.actual (canónico del contrato · byte-consistente con mechanisms/thesis) vía join.
 * Guardrail scenario-aware: los detectores comerciales corren SOLO sobre CLIENTE (scenario-aware) · capital sobre SKU
 * (margen/carga @sku/@marca son base-only → NO se tocan acá). Umbrales SIEMPRE desde POLICY (nunca literales) → el
 * diagnose no puede citar un target distinto al resto de ADI. Sin focos materiales → null (el seam degrada honesto). */
const _DIAG_FLOOR_USD = 50000;   // piso de materialidad de focos comerciales ($ · evita el ruido de clientes chicos)
const _DIAG_MARGIN_GAP = 4;      // gate del detector de margen (pp bajo benchmark · = gate quality-growth del motor)
const _DIAG_TOPN = 5;

// fuente+campo declarados por el CONTRATO para una métrica@eje (si el ERP remapea la fuente, el diagnose la sigue)
function _sf(metric, dim) { const m = METRICS[metric]; return (m && m.sourceByAxis && m.sourceByAxis[dim]) || null; }

// acota el barrido a una marca/familia/bodega/cliente (los `filters` del spec) y, si viene, al ENTITYSCOPE heredado de un
// follow-up deíctico ("de esos…"): un set de nombres/SKU de la última evidencia. Si el set NO intersecta (cruce de dimensión),
// se ignora y devuelve las filas del filtro (nunca vacía por un alcance incompatible → la respuesta general en vez de mentir).
function _scopeRows(rows, filters, entityScope) {
  if (filters.marca)   rows = rows.filter((r) => r && r.marca === filters.marca);
  if (filters.familia) rows = rows.filter((r) => r && r.sfamilia === filters.familia);
  if (filters.bodega)  rows = rows.filter((r) => r && r.bodega === filters.bodega);
  if (filters.cliente) rows = rows.filter((r) => r && r.nombre === filters.cliente);
  if (entityScope && Array.isArray(entityScope.entities) && entityScope.entities.length) {
    const set = new Set(entityScope.entities.map((s) => String(s)));
    const scoped = rows.filter((r) => r && set.has(String(r.nombre != null ? r.nombre : r.sku)));
    if (scoped.length) rows = scoped;
  }
  return rows;
}

// detectores comerciales (CLIENTE · scenario-aware): contribución no capturada + carga comercial alta
function _diagComercial(filters, scenario) {
  const vSF = _sf("ventas", "cliente"), mSF = _sf("margen", "cliente"), cSF = _sf("contribucion", "cliente"), gSF = _sf("carga", "cliente");
  if (!vSF || !mSF || !cSF || !gSF) return [];
  const ventas = _load(vSF.source, scenario), margen = _scopeRows(_load(mSF.source, scenario), filters);
  if (!ventas.length || !margen.length) return [];
  const vKey = (SOURCES[vSF.source] && SOURCES[vSF.source].keyField) || "nombre";
  const mKey = (SOURCES[mSF.source] && SOURCES[mSF.source].keyField) || "nombre";
  const vBy = {}; for (const r of ventas) vBy[r[vKey]] = r;                    // join por keyField (nombre)
  const contrib = [], carga = [];
  for (const r of margen) {
    const v = vBy[r[mKey]]; if (!v) continue;
    const actual = v[vSF.field]; if (typeof actual !== "number") continue;    // ventas canónicas (K)
    const bmk = benchmarkOf(r), mg = r[mSF.field], cb = r[cSF.field], cg = r[gSF.field];
    // contribución no capturada = venta×benchmark/100 − contribución (K→$) · gate: ≥4pp bajo benchmark y ≥ piso
    if (typeof mg === "number" && typeof cb === "number" && (bmk - mg) >= _DIAG_MARGIN_GAP) {
      const usd = Math.round(((actual * bmk / 100) - cb) * 1000);
      if (usd >= _DIAG_FLOOR_USD) contrib.push({ entidad: r[mKey], usd, gap: +(bmk - mg).toFixed(1) });
    }
    // carga comercial alta = (carga − target)/100 × venta (K→$) · gate: sobre target y ≥ piso
    if (typeof cg === "number" && cg > POLICY.targetCarga) {
      const usd = Math.round(((cg - POLICY.targetCarga) / 100) * actual * 1000);
      if (usd >= _DIAG_FLOOR_USD) carga.push({ entidad: r[mKey], usd, gap: +(cg - POLICY.targetCarga).toFixed(1) });
    }
  }
  const out = [];
  if (carga.length)   out.push(_diagFoco("carga", "Carga comercial alta", carga));
  if (contrib.length) out.push(_diagFoco("margen", "Contribución no capturada", contrib));
  return out;
}

// detector de inventario (SKU · scenario-aware): capital dormido (umbral numérico · portable a ERP real)
function _diagCapital(filters, scenario) {
  const kSF = _sf("capital", "sku"), rSF = _sf("rotacion", "sku"), dSF = _sf("doh", "sku");
  if (!kSF || !rSF || !dSF) return [];
  const rows = _scopeRows(_load(kSF.source, scenario), filters);
  if (!rows.length) return [];
  const key = (SOURCES[kSF.source] && SOURCES[kSF.source].keyField) || "sku";
  const items = [];
  for (const r of rows) {
    const cap = r[kSF.field], rot = r[rSF.field], doh = r[dSF.field]; if (typeof cap !== "number") continue;
    const dormido = (typeof rot === "number" && rot < POLICY.rotacionMin) || (typeof doh === "number" && doh > POLICY.dohMax);
    if (!dormido) continue;
    items.push({ entidad: r[key], usd: cap, critico: r.alerta === "crit", bodega: r.bodega });   // stockUSD = $ crudo
  }
  return items.length ? [_diagFoco("capital", "Capital dormido", items)] : [];
}

// arma un foco: ordena sus items por $, subtotal, top-N (para el texto) e items completos (para Sentrix)
function _diagFoco(detector, titulo, items) {
  items.sort((a, b) => b.usd - a.usd);
  return { detector, titulo, subtotal: items.reduce((s, it) => s + it.usd, 0), count: items.length, top: items.slice(0, _DIAG_TOPN), items };
}

// composeSpecDiagnose({filters, scenario}) → focos rankeados por $ (contribución/carga/capital) | null (nada material)
export function composeSpecDiagnose({ filters = {}, scenario } = {}) {
  const focos = [..._diagComercial(filters, scenario), ..._diagCapital(filters, scenario)];
  if (!focos.length) return null;                                             // sin focos materiales → el seam degrada honesto
  focos.sort((a, b) => b.subtotal - a.subtotal);
  const scope = [filters.marca, filters.familia, filters.bodega, filters.cliente].filter(Boolean).join("/");
  const header = `Diagnóstico${scope ? ` · ${scope}` : ""} · escenario ${scenario}. Miré tus datos y encontré ${focos.length} ${focos.length === 1 ? "foco" : "focos"} donde se te va o se te inmoviliza plata:`;
  // opener: una línea por foco · TODAS las cifras formateadas (el number-guard toma las cifras del texto, no de un crudo)
  const blocks = focos.map((f) => {
    if (f.detector === "capital") {
      const crit = f.top.filter((i) => i.critico).length;
      const top = f.top.slice(0, 3).map((it) => `${it.entidad} ${_money(it.usd)}`).join(", ");
      return `• ${f.titulo}: ${_money(f.subtotal)} en ${f.count} SKU sin rotar${crit ? ` (${crit} crítico${crit > 1 ? "s" : ""})` : ""} · ${top}`;
    }
    const top = f.top.slice(0, 3).map((it) => `${it.entidad} ${_money(it.usd)}`).join(", ");
    return `• ${f.titulo}: ${_money(f.subtotal)} · top: ${top}`;
  }).join("\n");
  // GUÍA conversacional: el próximo paso sale del foco (top entidad detectada) · NADA fijo
  const suggestions = focos.map((f) => {
    const e = f.top[0] && f.top[0].entidad;
    if (f.detector === "carga")   return e ? `Cómo recupero la carga de ${e}` : null;
    if (f.detector === "margen")  return e ? `Por qué ${e} cede margen` : null;
    if (f.detector === "capital") return "El capital dormido en detalle";
    return null;
  }).filter(Boolean);
  // BOLETA (primera clase): subtotales (obligatorios) + top-3 por foco · value == el _money del texto (una sola verdad)
  const _ctx = `diagnóstico${scope ? ` · ${scope}` : ""}`;
  const bol = [];
  for (const f of focos) {
    bol.push(fig(`${f.titulo} · subtotal`, _money(f.subtotal), { unit: "money", raw: f.subtotal, mandatory: true, context: _ctx }));
    for (const it of f.top.slice(0, 3)) bol.push(fig(`${f.titulo} · ${it.entidad}`, _money(it.usd), { unit: "money", raw: it.usd, mandatory: false, context: _ctx }));
  }
  return {
    opener: `${header}\n\n${blocks}`,
    suggestions: suggestions.length ? suggestions : null,
    sentrixAction: null,
    // findings per-item para Sentrix (la boleta/panel los consume · lens diagnostico) · $ ya calculado del dato · + boleta (LLM #2)
    evidence: { lens: "diagnostico", metrica: "diagnose", dimension: "cliente", boleta: bol,
      findings: focos.map((f) => ({ detector: f.detector, titulo: f.titulo, subtotal_usd: f.subtotal,
        items: f.items.map((it) => ({ entidad: it.entidad, usd: it.usd, ...(it.bodega ? { bodega: it.bodega } : {}), ...(it.critico ? { critico: true } : {}) })) })) },
  };
}

/* ── composeSpecInventory · FOCO INVENTARIO (owner 2026-07-06: "la pregunta manda el foco") ──────────────────
 * La pregunta elige LA PUNTA que lidera la respuesta (mismo motor sellado diagnoseInventario · UNA verdad):
 *   · frenado    → capital inmovilizado ("¿dónde está mi capital dormido?")   · plata atrapada
 *   · quiebre    → reposición urgente   ("¿qué reponer?, ¿qué se corta?")     · venta que se pierde por falta de stock
 *   · sobrestock → exceso               ("¿dónde sobra inventario?")           · cobertura excesiva
 *   · stale      → sin rotación N días  ("¿qué SKU llevan +90 días parados?")  · filtro por díasSinVenta
 * Cada foco: lectura → por bodega/familia → por SKU → por qué (umbrales POLICY) → qué hacer → CONTRApunta honesta (la otra
 * punta material, "no es lo único"). Boleta rica: las 4 puntas siempre autorizadas. Data-driven de skuInventario; el
 * `focus`/`staleDays` los infiere el cliente del texto (safety-net) o el LLM. null → el seam degrada honesto. */
const _ESTADO_LABEL = { capital_frenado: "capital frenado", riesgo_quiebre: "riesgo de quiebre", sobrestock: "sobrestock", capital_sano: "capital sano" };
const _ESTADO_ORDEN = ["capital_frenado", "riesgo_quiebre", "sobrestock", "capital_sano"];
const _FOCUS_ESTADO = { frenado: "capital_frenado", quiebre: "riesgo_quiebre", sobrestock: "sobrestock" };
const _ESTADO_COLOR = { capital_frenado: "amber", riesgo_quiebre: "red", sobrestock: "cyan", capital_sano: "green" };
// SKU de un estado (map a la forma del panel) · agrupaciones por bodega/familia (share del total del FOCO)
const _skusOf = (D, est, critById) => D.perSku.filter((s) => s.estado === est)
  .map((s) => ({ sku: s.sku, usd: s.capital, doh: s.doh, rotacion: s.rotacion, bodega: s.bodega || "—", familia: s.familia, diasSinVenta: s.diasSinVenta, critico: !!critById[s.sku] }))
  .sort((a, b) => b.usd - a.usd);
const _groupBy = (skus, field, total) => { const m = {}; for (const s of skus) m[s[field]] = (m[s[field]] || 0) + s.usd; return Object.entries(m).map(([nombre, usd]) => ({ nombre, usd, pct: total ? Math.round(usd / total * 100) : 0 })).sort((a, b) => b.usd - a.usd); };
// la punta más material DISTINTA del foco → el cierre honesto ("no es lo único")
function _contrapunta(D, focusEst) {
  if (focusEst !== "riesgo_quiebre" && D.quiebreMaterial && D.dist.riesgo_quiebre && D.dist.riesgo_quiebre.usd > 0) {
    const dd = D.dist.riesgo_quiebre;
    return { estado: "riesgo_quiebre", label: "riesgo de quiebre", usd: dd.usd, pct: dd.pct, count: dd.count, color: "red", familias: _groupBy(D.perSku.filter((s) => s.estado === "riesgo_quiebre").map((s) => ({ usd: s.capital, familia: s.sfamilia || s.familia })), "familia", dd.usd) };
  }
  if (focusEst !== "capital_frenado" && D.dist.capital_frenado && D.dist.capital_frenado.usd > 0) {
    const dd = D.dist.capital_frenado;
    return { estado: "capital_frenado", label: "capital frenado", usd: dd.usd, pct: dd.pct, count: dd.count, color: "amber", familias: _groupBy(D.perSku.filter((s) => s.estado === "capital_frenado").map((s) => ({ usd: s.capital, familia: s.sfamilia || s.familia })), "familia", dd.usd) };
  }
  return null;
}

export function composeSpecInventory({ filters = {}, scenario, focus = "frenado", staleDays = null, entityScope = null } = {}) {
  const kSF = _sf("capital", "sku"), rSF = _sf("rotacion", "sku"), dSF = _sf("doh", "sku");
  if (!kSF || !rSF || !dSF) return null;
  const rows = _scopeRows(_load(kSF.source, scenario), filters, entityScope);   // "de esos SKU, ¿cuáles frenados?" respeta el alcance heredado
  if (!rows.length) return null;
  const key = (SOURCES[kSF.source] && SOURCES[kSF.source].keyField) || "sku";
  // DIAGNÓSTICO COMPLETO por el motor sellado (las 4 puntas + por bodega + por familia + materialidad) · UNA verdad.
  const D = diagnoseInventario(rows, { capitalField: kSF.field });
  const critById = {}; for (const r of rows) critById[r[key]] = r.alerta === "crit";
  const P = POLICY;
  // ── despacho por FOCO → arma el bloque narrativo (lede + partes + contrapunta) ──
  let B;
  if (focus === "stale") {
    const th = typeof staleDays === "number" && staleDays > 0 ? staleDays : 90;
    const skus = D.perSku.filter((s) => typeof s.diasSinVenta === "number" && s.diasSinVenta > th)
      .map((s) => ({ sku: s.sku, usd: s.capital, doh: s.doh, rotacion: s.rotacion, bodega: s.bodega || "—", familia: s.familia, diasSinVenta: s.diasSinVenta, critico: !!critById[s.sku] }))
      .sort((a, b) => b.diasSinVenta - a.diasSinVenta);
    if (!skus.length) return null;
    const total = skus.reduce((a, s) => a + s.usd, 0), byBod = _groupBy(skus, "bodega", total);
    B = {
      focusEst: "capital_frenado", color: "amber", title: `Sin rotación · SKU parados +${th}d`, ctx: `SKU sin venta ${th}+ días`, total, skus, byBod, dim: "sku",
      lines: [
        `Hay ${skus.length} SKU sin una sola venta en más de ${th} días — ${_money(total)} de capital parado: ${skus.slice(0, 4).map((s) => `${s.sku} (${s.diasSinVenta}d)`).join(" · ")}.`,
        byBod.length > 1 ? `Por bodega: ${byBod.map((b) => `${b.nombre} ${_money(b.usd)}`).join(" · ")}.` : "",
        `**Por qué:** ${th}+ días sin salida — cambió el precio, la ubicación o la demanda. Es el capital más frío del inventario: no rota y no da señales de que vaya a rotar.`,
        `**Qué hacer:** revisá precio o reasignación de ${skus.slice(0, 2).map((s) => s.sku).join(" y ")}; si no se mueven, liquidá para recuperar la plata antes de que envejezca más.`,
      ],
      suggestions: ["Qué SKU libero primero", "Ver todo el inventario"],
    };
  } else {
    const est = _FOCUS_ESTADO[focus] || "capital_frenado";
    const skus = _skusOf(D, est, critById);
    if (!skus.length) return null;
    const dd = D.dist[est] || { usd: 0, pct: 0, count: 0 };
    const total = dd.usd, byBod = _groupBy(skus, "bodega", total), byFam = _groupBy(skus, "familia", total);
    const topB = byBod[0], crit = skus.filter((s) => s.critico);
    const skuList = skus.slice(0, 4).map((r) => `${r.sku} ${_money(r.usd)} (${r.doh}d DOH, rotación ${r.rotacion}x)`).join(" · ");
    if (est === "riesgo_quiebre") {   // reposición urgente — la venta que se pierde por falta de stock
      B = {
        focusEst: est, color: "red", title: "Riesgo de quiebre · qué reponer ya", ctx: "riesgo de quiebre", total, skus, byBod, byFam, dim: "familia",
        lines: [
          `Necesitan reposición ${_money(total)} en ${skus.length} SKU que se van a cortar${byFam.length ? ` — sobre todo en ${byFam[0].nombre} (${_money(byFam[0].usd)})${byFam[1] ? ` y ${byFam[1].nombre} (${_money(byFam[1].usd)})` : ""}` : ""}.`,
          byBod.length > 1 ? `Por bodega: ${byBod.map((b) => `${b.nombre} ${_money(b.usd)}`).join(" · ")}.` : "",
          `Los SKU al límite: ${skuList}.`,
          `**Por qué:** rotación alta (≥${P.quiebreRotMin}x) con cobertura corta (DOH ≤ ${P.quiebreDohMax}d) — venden bien pero el stock no alcanza hasta la próxima compra.`,
          `**Qué hacer:** reponé ${skus.slice(0, 2).map((s) => s.sku).join(" y ")} ya. Es venta que estás por perder por falta de producto, no plata atrapada — el costo de no hacerlo es la venta que no ocurre.`,
        ],
        suggestions: ["Qué SKU frenados libero", "Ver todo el inventario"],
      };
    } else if (est === "sobrestock") {   // exceso — cobertura excesiva, plata inmovilizada de más
      B = {
        focusEst: est, color: "cyan", title: "Sobrestock · dónde sobra inventario", ctx: "sobrestock", total, skus, byBod, byFam, dim: "bodega",
        lines: [
          `Tenés ${_money(total)} en ${skus.length} SKU con sobrestock — venden, pero la cobertura es excesiva (DOH entre ${P.sobrestockDohMin} y ${P.dohMax}d)${topB ? `. Se concentra en ${topB.nombre} (${_money(topB.usd)})` : ""}.`,
          byBod.length > 1 ? `Por bodega: ${byBod.map((b) => `${b.nombre} ${_money(b.usd)}`).join(" · ")}.` : "",
          `Los SKU con más cobertura: ${skuList}.`,
          `**Por qué:** rotan dentro de rango, pero tenés más meses de stock de los necesarios. Es plata inmovilizada de más — no está muerta como el capital frenado, pero podría estar trabajando.`,
          `**Qué hacer:** frená la próxima compra de ${skus.slice(0, 2).map((s) => s.sku).join(" y ")} y dejá que la venta drene el exceso. No hace falta liquidar; sí ajustar la reposición.`,
        ],
        suggestions: ["Qué SKU están frenados", "Qué reponer por quiebre"],
      };
    } else {   // frenado (default) — capital inmovilizado, plata atrapada
      B = {
        focusEst: est, color: "amber", title: "Capital inmovilizado · dónde está frenada tu plata", ctx: "capital inmovilizado", total, skus, byBod, byFam, dim: "bodega",
        lines: [
          `Tenés ${_money(total)} de capital inmovilizado en ${skus.length} SKU sin rotar. Se concentra en ${topB.nombre} (${_money(topB.usd)}, ${topB.pct}%).`,
          `Por bodega: ${byBod.map((b) => `${b.nombre} ${_money(b.usd)}`).join(" · ")}.`,
          byFam.length ? `Por familia lo carga ${byFam[0].nombre} (${_money(byFam[0].usd)})${byFam[1] ? ` y ${byFam[1].nombre} (${_money(byFam[1].usd)})` : ""}.` : "",
          `Los SKU que lo explican: ${skuList}.`,
          `**Por qué:** dejaron de rotar — rotación bajo ${P.rotacionMin}x o DOH sobre ${P.dohMax}d. Es stock que no sale y te atrapa la plata.`,
          `**Qué hacer:** arrancá por ${crit.length ? crit.slice(0, 2).map((r) => r.sku).join(" y ") : skus[0].sku} (los más frenados) — liquidación o reasignación libera esa plata para SKU que sí rotan; después revisá la reposición para no repetirlo.`,
        ],
        suggestions: ["Por qué el capital está dormido", "Qué SKU libero primero"],
      };
    }
  }
  // ── CUÁNTO VALE (asesor): liberar los 2 más frenados = $ que vuelve a caja (suma directa de su capital) ──
  let lever2 = null;
  if (B.focusEst === "capital_frenado" && B.skus.length >= 1) {
    const t2 = B.skus.slice(0, 2);
    lever2 = { skus: t2.map((s) => s.sku), usd: t2.reduce((a, s) => a + s.usd, 0) };
    B.lines.push(`**Cuánto vale:** liberar ${lever2.skus.join(" y ")} devuelve ${_money(lever2.usd)} a caja — plata que hoy no trabaja.`);
  }
  // ── CONTRApunta honesta: la otra punta material (sin esto la respuesta es media historia) ──
  const cp = _contrapunta(D, B.focusEst);
  if (cp) B.lines.push(`**No es lo único — hay otra punta:** ${_money(cp.usd)} (${cp.pct}% del inventario) en ${cp.label}${cp.familias && cp.familias.length ? `, sobre todo en ${cp.familias[0].nombre}` : ""} — ${cp.estado === "riesgo_quiebre" ? "SKU que rotan rápido con poca cobertura y se van a cortar" : "SKU que no rotan y te atrapan la plata"}. Es plata mal repartida: sobra donde no vende y falta donde sí.`);
  // ── boleta rica: total del foco + grupos + SKU + LAS 4 PUNTAS autorizadas (narración selectiva · el guard no deja inventar otra) ──
  const estados = _ESTADO_ORDEN.filter((e) => D.dist[e]).map((e) => ({ estado: e, label: _ESTADO_LABEL[e], usd: D.dist[e].usd, pct: D.dist[e].pct, count: D.dist[e].count }));
  const bol = [fig(`${B.title.split(" ·")[0]} · total`, _money(B.total), { unit: "money", raw: B.total, mandatory: true, context: B.ctx })];
  for (const b of (B.byBod || [])) bol.push(fig(`Bodega · ${b.nombre}`, _money(b.usd), { unit: "money", raw: b.usd, mandatory: false, context: B.ctx }));
  for (const f of (B.byFam || []).slice(0, 3)) bol.push(fig(`Familia · ${f.nombre}`, _money(f.usd), { unit: "money", raw: f.usd, mandatory: false, context: B.ctx }));
  for (const s of B.skus.slice(0, 4)) bol.push(fig(`SKU · ${s.sku}`, _money(s.usd), { unit: "money", raw: s.usd, mandatory: false, context: B.ctx }));
  for (const e of estados) bol.push(fig(`Inventario · ${e.label}`, _money(e.usd), { unit: "money", raw: e.usd, mandatory: false, context: "distribución de inventario" }));
  if (lever2) bol.push(fig(`Palanca · liberar ${lever2.skus.join(" y ")}`, _money(lever2.usd), { unit: "money", raw: lever2.usd, mandatory: true, source: "computed", formula: "Σ capital top 2", context: "cuánto vale la palanca" }));
  return {
    opener: B.lines.filter(Boolean).join("\n\n"),
    suggestions: B.suggestions,
    sentrixAction: null,
    evidence: { lens: "inventory", metrica: "capital", dimension: B.dim, boleta: bol,
      inventory: { title: B.title, focus, focusColor: B.color, total: B.total,
        byBodega: (B.byBod || []).map((b) => ({ bodega: b.nombre, usd: b.usd, pct: b.pct })),
        bySku: B.skus.map((r) => ({ sku: r.sku, usd: r.usd, doh: r.doh, rotacion: r.rotacion, bodega: r.bodega, diasSinVenta: r.diasSinVenta, critico: r.critico })),
        totalInventario: D.total, estados, contrapunta: cp } },
  };
}

/* ── composeSpecMargin · FOCO MARGEN (owner 2026-07-06 · "la pregunta manda el foco") ────────────────────────
 * Rompe la trampa que el smoke en vivo encontró: el LLM colapsaba TODA pregunta de margen a diagnose → el "genérico de 3
 * focos" (23/25 · respondía otra pregunta). Acá la PREGUNTA elige el foco y el motor responde LO ESPECÍFICO con el dato
 * disponible; si el dato no existe (gap), avisa honesto y ofrece la lente más cercana (nunca el genérico). Reusa
 * diagnoseClientes/diagnoseSkus (patrón económico, gate-probado) + benchmark (POLICY 30.1) + descomposición precio/costo
 * (precioLista/costoMedio) + carga/rebates. Boleta rica (cifras autorizadas). Data-driven vía el contrato (_sf+_load). */
const _p1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const _benchOf = benchmarkOf;   // C.2 · UNA verdad: respeta el CRITERIO del owner (override) → fila → POLICY (antes duplicaba la lógica sin el override)
const _markup = (r) => (r && r.precioLista > 0 ? (r.precioLista - r.costoMedio) / r.precioLista * 100 : null);   // markup sobre lista (%)
const _costShare = (r) => (r && r.precioLista > 0 ? r.costoMedio / r.precioLista * 100 : null);                  // costo como % de la lista
const _mVenta = (v) => _money(v * 1000);   // venta/contribucion en MILES -> $ real (escala del contrato · consistente con ventas y el resumen ejecutivo · NO para stockUSD, que es crudo)
// panel de Sentrix para margen: cada entidad vs la línea de benchmark (la "calidad de la venta" de un vistazo) + descomposición precio/costo
const _MFOCUS_TITLE = { bajo_benchmark: "Margen vs benchmark", alto_volumen_bajo_margen: "Volumen vs margen", causa_precio: "Margen · el precio no da", causa_costo: "Margen · el costo aprieta", subir_precio: "Candidatos a subir precio", alto_margen_subpenetrado: "Alto margen subpenetrado", palancas: "Palancas de margen" };
function _marginPanel(rows, bench, focus) {
  const rr = (rows || []).filter((r) => typeof r.margen === "number")
    .map((r) => ({ nombre: r.nombre || r.sku, margen: r.margen, venta: typeof r.venta === "number" ? r.venta : null, markup: _markup(r), costShare: _costShare(r), below: r.margen < _benchOf(r) }))
    .sort((a, b) => a.margen - b.margen);
  return { title: _MFOCUS_TITLE[focus] || "Margen", bench, focus, showDecomp: focus === "causa_precio" || focus === "causa_costo" || focus === "subir_precio", rows: rr, belowCount: rr.filter((x) => x.below).length, total: rr.length };
}
const _MLBL = { cliente: { s: "cliente", p: "clientes", art: "Los" }, sku: { s: "SKU", p: "SKU", art: "Los" }, familia: { s: "familia", p: "familias", art: "Las" }, marca: { s: "marca", p: "marcas", art: "Las" }, canal: { s: "canal", p: "canales", art: "Los" } };
const _mNombre = (r) => r.nombre || r.sku;
// margen por CANAL (no hay eje contractual · join clientesMargen × clientesVentas.canal · promedio ponderado por venta)
function _marginByCanal(scenario) {
  const mSf = _sf("margen", "cliente"), vSf = _sf("ventas", "cliente");
  if (!mSf || !vSf) return [];
  const mRows = (_load(mSf.source, scenario) || []).filter(Boolean), vRows = (_load(vSf.source, scenario) || []).filter(Boolean);
  const canalBy = {}; for (const v of vRows) canalBy[v.nombre] = v.canal || "—";
  const g = {};
  for (const r of mRows) { const k = canalBy[r.nombre] || "—"; const gg = (g[k] = g[k] || { nombre: k, venta: 0, contribucion: 0, _mw: 0 }); gg.venta += r.venta || 0; gg.contribucion += r.contribucion || 0; gg._mw += (r.margen || 0) * (r.venta || 0); }
  return Object.values(g).map((x) => ({ nombre: x.nombre, venta: x.venta, contribucion: x.contribucion, margen: x.venta ? +(x._mw / x.venta).toFixed(1) : 0, benchmark: POLICY.benchmark }));
}
function _marginRows(dim, scenario) {
  if (dim === "canal") return _marginByCanal(scenario);
  const sf = _sf("margen", dim);
  if (!sf) return [];
  return (_load(sf.source, scenario) || []).filter(Boolean);
}

/* ── PALANCA CUANTIFICADA (asesor · owner 2026-07-06 · Frente A): ponerle $ a cada consejo ────────────────────
 * UNA VERDAD: el "cuánto vale" reusa los DETECTORES del diagnóstico (_diagComercial · mismas cuentas y mismos gates de
 * materialidad ≥4pp / ≥piso $) — el mismo número del resumen ejecutivo y del diagnose, no una segunda fórmula.
 * Para ejes sin detector (sku/marca/familia) el valor es el de 1pp de margen sobre la venta (venta K × 1% × 1000). */
function _leverFoco(scenario, detector, entityScope) {
  const focos = _diagComercial({}, scenario);
  let f = focos.find((x) => x.detector === detector);
  if (!f || !f.items.length) return null;
  if (entityScope && Array.isArray(entityScope.entities) && entityScope.entities.length) {   // "de esos…" → la palanca del subconjunto
    const set = new Set(entityScope.entities.map(String));
    const items = f.items.filter((it) => set.has(String(it.entidad)));
    if (!items.length) return null;
    f = { ...f, items, count: items.length, top: items.slice(0, _DIAG_TOPN), subtotal: items.reduce((s, it) => s + it.usd, 0) };
  }
  return f;
}
const _pp1 = (r) => (r && typeof r.venta === "number" && r.venta > 0 ? Math.round(r.venta * 10) : null);   // 1pp de margen en $ (venta K × 1000 × 1%)
const _figLever = (label, usd, formula, mandatory = false) => fig(label, _money(usd), { unit: "money", raw: usd, mandatory, source: "computed", formula, context: "cuánto vale la palanca" });

export function composeSpecMargin({ filters = {}, scenario, focus = "bajo_benchmark", dimension = "cliente", negativo = false, pct = false, gap = null, entityScope = null } = {}) {
  const dim = _MLBL[dimension] ? dimension : "cliente";
  const L = _MLBL[dim];
  let rows = _scopeRows(_marginRows(dim, scenario), filters, entityScope);
  if (!rows.length) return null;
  const bench = _benchOf(rows[0]);
  const totVenta = rows.reduce((a, r) => a + (r.venta || 0), 0);
  const below = rows.filter((r) => typeof r.margen === "number" && r.margen < _benchOf(r)).sort((a, b) => (_benchOf(b) - b.margen) - (_benchOf(a) - a.margen));
  const _gap = (r) => +(_benchOf(r) - r.margen).toFixed(1);
  const _lo = (n) => rows.slice().sort((a, b) => a.margen - b.margen).slice(0, n);
  const _ctx = "margen";
  let lines = [], suggestions = [], bol = [];
  const figMargin = (label, r) => fig(`${L.s} · ${_mNombre(r)} margen`, `${_p1(r.margen)}%`, { unit: "pct", raw: r.margen, mandatory: false, context: _ctx });
  const pushMarginFigs = (list) => { for (const r of list.slice(0, 5)) bol.push(figMargin("", r)); };

  // ── HUECOS honestos (el dato no existe → avisar + pivot a la lente más cercana · NUNCA el genérico) ──
  if (gap) {
    const lo = _lo(3), pivotList = (below.length ? below : lo).slice(0, 3);
    const pivotTxt = pivotList.map((r) => `${_mNombre(r)} ${_p1(r.margen)}%`).join(" · ");
    const GAP = {
      caida: { falta: `margen del período anterior por ${L.s}`, no: `medir la CAÍDA de margen (necesito dos períodos y sólo tengo el actual)`, ofrece: `el NIVEL de margen vs el benchmark ${_p1(bench)}% HOY` },
      sin_serie: { falta: `serie temporal de costo y precio por SKU`, no: `ver "costo creciente / precio estancado" (necesito al menos dos períodos)`, ofrece: `qué SKU tienen el margen más presionado HOY (precio pegado al costo)` },
      proveedor: { falta: `el eje "proveedor" (tengo marca, no proveedor upstream)`, no: `atribuir la presión de margen a un proveedor`, ofrece: `qué MARCAS presionan más el margen (aprox. línea de suministro)` },
      mix_cliente_sku: { falta: `la matriz transaccional cliente×SKU (qué SKU compra cada cliente)`, no: `cruzar cliente×SKU para el peor mix`, ofrece: `los SKU de peor margen por separado (el cruce por cliente no existe en los datos)` },
      vendedor: { falta: `la dimensión "vendedor" (no está en los datos)`, no: `atribuir margen a un vendedor`, ofrece: `qué clientes venden mucho y comprimen el margen (alto volumen, bajo margen)` },
    }[gap];
    lines = [
      `No te puedo ${GAP.no}: falta ${GAP.falta}. No lo invento.`,
      `Lo más cercano que SÍ tengo es ${GAP.ofrece}: ${pivotTxt}${below.length ? ` — ${below.length} de ${rows.length} ${L.p} bajo el benchmark ${_p1(bench)}%` : ""}.`,
      `¿Querés que arranque por ahí?`,
    ];
    pushMarginFigs(pivotList);
    suggestions = [gap === "proveedor" ? "Margen por marca" : gap === "mix_cliente_sku" ? "Peor SKU por margen" : `${L.p} bajo el benchmark`, "Palancas para recuperar margen"];
    return { opener: lines.filter(Boolean).join("\n\n"), suggestions, sentrixAction: null, evidence: { lens: "margin", metrica: "margen", dimension: dim, boleta: bol, margin: { focus: "gap:" + gap, bench, panel: _marginPanel(rows, bench, "bajo_benchmark"), below: below.map((r) => ({ nombre: _mNombre(r), margen: r.margen })) } } };
  }

  // ── FOCOS reales ──
  if (focus === "alto_volumen_bajo_margen") {
    const ranked = rows.slice().sort((a, b) => (b.venta || 0) - (a.venta || 0));
    const hits = ranked.filter((r) => r.margen < _benchOf(r)).slice(0, 4);
    const lead = hits.length ? hits : ranked.slice(0, 3);
    lines = [
      `${L.art} ${L.p} que más venden y peor margen dejan: ${lead.map((r) => `${_mNombre(r)} (${_mVenta(r.venta)} a ${_p1(r.margen)}%)`).join(" · ")}.`,
      `${_mNombre(lead[0])} es el caso más caro: factura ${_mVenta(lead[0].venta)} pero a ${_p1(lead[0].margen)}% — ${_p1(_gap(lead[0]))}pp bajo el benchmark ${_p1(bench)}%. Cada punto de margen ahí vale mucho por el volumen.`,
      `**Por qué importa:** el volumen amplifica el margen bajo — es donde una corrección chica de precio o rebate rinde más en $.`,
      `**Qué hacer:** priorizá ${lead.slice(0, 2).map(_mNombre).join(" y ")} para revisar lista/rebate; ahí está la mayor recuperación por punto.`,
    ];
    if (_pp1(lead[0])) {
      lines.push(`**Cuánto vale:** 1pp de margen en ${_mNombre(lead[0])} son +${_money(_pp1(lead[0]))} al año — por eso va primero.`);
      bol.push(_figLever(`Palanca · 1pp en ${_mNombre(lead[0])}`, _pp1(lead[0]), "venta × 1%", true));
    }
    pushMarginFigs(lead);
    suggestions = ["Es por precio o por costo", "Palancas para recuperar margen"];
  } else if (focus === "bajo_benchmark") {
    const negatives = rows.filter((r) => r.margen < 0);
    if (pct) {
      const vBelow = below.reduce((a, r) => a + (r.venta || 0), 0), share = totVenta ? vBelow / totVenta * 100 : 0;
      lines = [
        `El ${_p1(share)}% de la venta (${_mVenta(vBelow)} de ${_mVenta(totVenta)}) está bajo el margen mínimo de ${_p1(bench)}%.`,
        `Lo cargan ${below.slice(0, 3).map((r) => `${_mNombre(r)} (${_p1(r.margen)}%)`).join(" · ")} — ${below.length} de ${rows.length} ${L.p} por debajo.`,
        `**Qué hacer:** ese tramo es el que más mueve el margen de cartera; arrancá por los de mayor venta bajo el piso.`,
      ];
      pushMarginFigs(below);
    } else if (negativo) {
      if (!negatives.length) {
        const piso = _lo(1)[0];
        lines = [
          `Ninguno tiene margen negativo — el piso es ${_mNombre(piso)} con ${_p1(piso.margen)}%. No te invento una alarma que no existe.`,
          `Lo que SÍ está bajo el mínimo de ${_p1(bench)}% son ${below.length} de ${rows.length} ${L.p}: ${below.slice(0, 4).map((r) => `${_mNombre(r)} (${_p1(r.margen)}%, ${_p1(_gap(r))}pp)`).join(" · ")}.`,
          `**Qué hacer:** el problema no es pérdida directa, es margen delgado — el foco son esos ${L.p} bajo el piso.`,
        ];
        pushMarginFigs(below);
      } else {
        lines = [`${negatives.length} ${L.p} con margen negativo: ${negatives.map((r) => `${_mNombre(r)} (${_p1(r.margen)}%)`).join(" · ")}. Es plata que se pierde en cada venta — máxima prioridad.`];
        pushMarginFigs(negatives);
      }
    } else {
      lines = [
        `${below.length} de ${rows.length} ${L.p} están bajo el margen mínimo de ${_p1(bench)}%: ${below.slice(0, 5).map((r) => `${_mNombre(r)} ${_p1(r.margen)}% (${_p1(_gap(r))}pp)`).join(" · ")}.`,
        `El más lejos del piso es ${_mNombre(below[0])} a ${_p1(below[0].margen)}% (${_p1(_gap(below[0]))}pp bajo el benchmark).`,
        `**Qué hacer:** rankeados por brecha, esos son los que más margen recuperan si corregís precio o costo.`,
      ];
      pushMarginFigs(below);
    }
    // CUÁNTO VALE (asesor): cliente → la cuenta gated del diagnóstico (una verdad) · otros ejes → 1pp sobre la venta del peor.
    // El scope de la palanca respeta TAMBIÉN filters.cliente (una lectura de UN cliente no muestra la palanca de cartera).
    const _lvScope = entityScope || (filters.cliente ? { entities: [filters.cliente] } : null);
    const lever = dim === "cliente" ? _leverFoco(scenario, "margen", _lvScope) : null;
    if (lever && lever.top.length) {
      lines.push(`**Cuánto vale:** si los ${lever.count} que están materialmente bajo el piso llegan al benchmark, son +${_money(lever.subtotal)} de contribución al año — el que más paga es ${lever.top[0].entidad} (+${_money(lever.top[0].usd)}).`);
      bol.push(_figLever("Palanca · cerrar brecha al piso", lever.subtotal, "Σ venta × benchmark − contribución (≥4pp · ≥ piso)", true));
      bol.push(_figLever(`Palanca · ${lever.top[0].entidad}`, lever.top[0].usd, "venta × benchmark − contribución"));
    } else if (below.length && _pp1(below[0])) {
      lines.push(`**Cuánto vale:** un solo punto de margen en ${_mNombre(below[0])} son +${_money(_pp1(below[0]))} al año.`);
      bol.push(_figLever(`Palanca · 1pp en ${_mNombre(below[0])}`, _pp1(below[0]), "venta × 1%", true));
    }
    suggestions = ["Es por precio o por costo", "Cuánta venta está bajo el mínimo"];
  } else if (focus === "causa_precio" || focus === "causa_costo") {
    const cand = below.filter((r) => _markup(r) != null);
    const src = cand.length ? cand : rows.filter((r) => _markup(r) != null);
    if (!src.length) return null;
    if (focus === "causa_precio") {
      const byThin = src.slice().sort((a, b) => _markup(a) - _markup(b)).slice(0, 4);   // markup más fino = precio no da
      lines = [
        `Estos ${L.p} ceden margen por el PRECIO: la lista está pegada al costo. ${byThin.map((r) => `${_mNombre(r)} (markup ${_p1(_markup(r))}%)`).join(" · ")}.`,
        `${_mNombre(byThin[0])} deja apenas ${_p1(_markup(byThin[0]))}% de markup sobre lista vs el ${_p1(bench)}% de referencia — el precio no alcanza a cubrir el margen objetivo.`,
        `**Qué hacer:** la palanca es la lista de precios, no el costo. Subir lista en ${byThin.slice(0, 2).map(_mNombre).join(" y ")} recupera margen directo (si la demanda aguanta).`,
      ];
      if (_pp1(byThin[0])) {
        lines.push(`**Cuánto vale:** recuperar 1pp vía precio en ${_mNombre(byThin[0])} son +${_money(_pp1(byThin[0]))} al año.`);
        bol.push(_figLever(`Palanca · 1pp en ${_mNombre(byThin[0])}`, _pp1(byThin[0]), "venta × 1%", true));
      }
      pushMarginFigs(byThin);
      suggestions = ["Cuáles ceden por costo", "Candidatos a subir precio"];
    } else {
      const byCost = src.slice().sort((a, b) => _costShare(b) - _costShare(a)).slice(0, 4);   // costo se lleva más del precio
      lines = [
        `Estos ${L.p} ceden margen por el COSTO: se lleva la mayor parte del precio de lista. ${byCost.map((r) => `${_mNombre(r)} (costo ${Math.round(_costShare(r))}% de la lista)`).join(" · ")}.`,
        `En ${_mNombre(byCost[0])} el costo es el ${Math.round(_costShare(byCost[0]))}% de la lista — queda poco para el margen aunque el precio esté en regla.`,
        `**Qué hacer:** la palanca acá es la compra/costo, no el precio. Negociar costo en ${byCost.slice(0, 2).map(_mNombre).join(" y ")} es lo que mueve el margen.`,
      ];
      if (_pp1(byCost[0])) {
        lines.push(`**Cuánto vale:** recuperar 1pp vía costo en ${_mNombre(byCost[0])} son +${_money(_pp1(byCost[0]))} al año.`);
        bol.push(_figLever(`Palanca · 1pp en ${_mNombre(byCost[0])}`, _pp1(byCost[0]), "venta × 1%", true));
      }
      pushMarginFigs(byCost);
      suggestions = ["Cuáles ceden por precio", "Palancas para recuperar margen"];
    }
  } else if (focus === "subir_precio") {
    const src = rows.filter((r) => _markup(r) != null);
    const uMed = src.map((r) => r.unidades || 0).sort((a, b) => a - b)[Math.floor(src.length / 2)] || 0;
    const cand = src.filter((r) => r.margen < _benchOf(r) && (r.unidades || 0) >= uMed).sort((a, b) => _markup(a) - _markup(b)).slice(0, 4);
    const lead = cand.length ? cand : src.filter((r) => r.margen < _benchOf(r)).slice(0, 3);
    if (!lead.length) return null;
    lines = [
      `Candidatos a subir precio (margen bajo + demanda que aguanta): ${lead.map((r) => `${_mNombre(r)} (${r.unidades || "—"}u a ${_p1(r.margen)}%, markup ${_p1(_markup(r))}%)`).join(" · ")}.`,
      `${_mNombre(lead[0])} vende ${lead[0].unidades || "—"}u con markup de sólo ${_p1(_markup(lead[0]))}% — hay espacio de lista sin que el volumen sea frágil.`,
      `**Ojo:** son candidatos por SEÑAL (margen bajo + volumen sano), no una prueba de elasticidad. Conviene testear una corrección chica antes de mover todo.`,
    ];
    if (_pp1(lead[0])) {
      lines.push(`**Cuánto vale:** cada punto de precio en ${_mNombre(lead[0])} vale +${_money(_pp1(lead[0]))} al año${lead[1] && _pp1(lead[1]) ? `; en ${_mNombre(lead[1])}, +${_money(_pp1(lead[1]))}` : ""} — corrección chica, plata directa.`);
      bol.push(_figLever(`Palanca · 1pp en ${_mNombre(lead[0])}`, _pp1(lead[0]), "venta × 1%", true));
      if (lead[1] && _pp1(lead[1])) bol.push(_figLever(`Palanca · 1pp en ${_mNombre(lead[1])}`, _pp1(lead[1]), "venta × 1%"));
    }
    pushMarginFigs(lead);
    suggestions = ["Es por precio o por costo", "Productos de alto margen subpenetrados"];
  } else if (focus === "alto_margen_subpenetrado") {
    const ds = diagnoseSkus(rows, { salesField: "venta", marginField: "margen" });
    let sub = rows.filter((r) => ds[_mNombre(r)] && ds[_mNombre(r)].patron === "alto_margen_subpenetrado");
    if (!sub.length) sub = rows.filter((r) => r.margen >= bench).sort((a, b) => (a.venta || 0) - (b.venta || 0)).slice(0, 4);
    sub = sub.sort((a, b) => b.margen - a.margen).slice(0, 4);
    lines = [
      `Productos de alto margen y baja penetración (upside si ganan distribución): ${sub.map((r) => `${_mNombre(r)} (${_p1(r.margen)}% margen, sólo ${_mVenta(r.venta)})`).join(" · ")}.`,
      `${_mNombre(sub[0])} rinde ${_p1(sub[0].margen)}% pero factura poco — cada peso extra de venta acá entra a margen alto.`,
      `**Qué hacer:** empujar volumen/distribución en estos rinde más que defender los de bajo margen. Es crecer donde ya ganás bien.`,
    ];
    pushMarginFigs(sub);
    suggestions = ["Candidatos a subir precio", "Los que más venden y peor margen"];
  } else if (focus === "stock_bajo_margen") {
    const kSf = _sf("capital", "sku");
    const skus = kSf ? (_load(kSf.source, scenario) || []).filter(Boolean) : [];
    const lowM = skus.filter((s) => typeof s.margenPct === "number" && s.margenPct < POLICY.benchmark);
    if (!lowM.length) return null;
    const bMap = {};
    for (const s of lowM) { const k = s.bodega || "—"; (bMap[k] = bMap[k] || { bodega: k, usd: 0, skus: [] }); bMap[k].usd += s.stockUSD || 0; bMap[k].skus.push(s); }
    const byBod = Object.values(bMap).sort((a, b) => b.usd - a.usd);
    const topB = byBod[0], topSk = lowM.slice().sort((a, b) => (b.stockUSD || 0) - (a.stockUSD || 0)).slice(0, 3);
    lines = [
      `Las bodegas con más stock parado en productos de bajo margen: ${byBod.slice(0, 3).map((b) => `${b.bodega} (${_money(b.usd)})`).join(" · ")}.`,
      `${topB.bodega} concentra ${_money(topB.usd)} en SKU de margen bajo — ${topSk.map((s) => `${s.sku} (${_p1(s.margenPct)}%, ${_money(s.stockUSD)})`).join(" · ")}.`,
      `**Por qué duele doble:** es capital inmovilizado Y de baja rentabilidad — si rota, deja poco; si no rota, ata caja sin premio.`,
      `**Qué hacer:** son los primeros candidatos a liquidar o dejar de reponer — bajo margen no justifica ocupar capital.`,
    ];
    for (const s of topSk) bol.push(fig(`SKU · ${s.sku} capital`, _money(s.stockUSD), { unit: "money", raw: s.stockUSD, mandatory: false, context: "stock en bajo margen" }));
    suggestions = ["Qué SKU libero primero", "Los de bajo margen por costo o precio"];
    return { opener: lines.filter(Boolean).join("\n\n"), suggestions, sentrixAction: null, evidence: { lens: "margin", metrica: "margen", dimension: "bodega", boleta: bol, margin: { focus, panel: _marginPanel(lowM.map((s) => ({ nombre: s.sku, margen: s.margenPct })), POLICY.benchmark, "bajo_benchmark"), byBodega: byBod.map((b) => ({ bodega: b.bodega, usd: b.usd })) } } };
  } else if (focus === "palancas") {
    const target = POLICY.targetCarga;
    const cargaHigh = rows.filter((r) => typeof r.pctRebate === "number" && r.pctRebate > target).sort((a, b) => b.pctRebate - a.pctRebate).slice(0, 4);
    const thinPrice = rows.filter((r) => _markup(r) != null && r.margen < _benchOf(r)).sort((a, b) => _markup(a) - _markup(b)).slice(0, 3);
    lines = [
      `Las palancas que más comen margen, en orden:`,
      `**1 · Carga/rebates** — ${cargaHigh.length ? `${cargaHigh.map((r) => `${_mNombre(r)} (${_p1(r.pctRebate)}%)`).join(" · ")} están sobre el target de ${_p1(target)}%` : `todos dentro del target de ${_p1(target)}%`}. Es margen que se entrega en descuento; recortable donde el poder de negociación lo permite.`,
      thinPrice.length ? `**2 · Precio de lista** — ${thinPrice.map((r) => `${_mNombre(r)} (markup ${_p1(_markup(r))}%)`).join(" · ")}: la lista está pegada al costo, subir precio recupera margen directo.` : "",
      `**Qué hacer (volumen-safe):** arrancá por la carga de los ${L.p} con más poder de compra tuyo y por la lista donde la demanda aguanta — así recuperás margen sin resignar volumen.`,
    ];
    for (const r of cargaHigh) bol.push(fig(`${L.s} · ${_mNombre(r)} carga`, `${_p1(r.pctRebate)}%`, { unit: "pct", raw: r.pctRebate, mandatory: false, context: "carga comercial" }));
    // CUÁNTO VALE: la MISMA cuenta del detector de carga del diagnóstico ((carga − target) × venta · gated) — una verdad
    const cargaLever = dim === "cliente" ? _leverFoco(scenario, "carga", entityScope || (filters.cliente ? { entities: [filters.cliente] } : null)) : null;
    if (cargaLever && cargaLever.top.length) {
      lines.push(`**Cuánto vale:** llevar la carga al target de ${_p1(target)}% libera +${_money(cargaLever.subtotal)} al año — solo ${cargaLever.top[0].entidad} devuelve +${_money(cargaLever.top[0].usd)}.`);
      bol.push(_figLever("Palanca · carga al target", cargaLever.subtotal, "Σ (carga − target) × venta (≥ piso)", true));
      bol.push(_figLever(`Palanca · ${cargaLever.top[0].entidad}`, cargaLever.top[0].usd, "(carga − target) × venta"));
    }
    suggestions = ["Los que más venden y peor margen", "Es por precio o por costo"];
  } else {
    return null;
  }

  // ── boleta: contexto de cartera + benchmark (cifras autorizadas) ──
  // mandatory SOLO si la propia lectura cita el benchmark (si no, el guard mataría narraciones que — correctamente — no
  // lo nombran: el bug del foco palancas que caía al piso por "omitir" el 30.1% que su texto nunca dijo).
  bol.push(fig("Benchmark de margen", `${_p1(bench)}%`, { unit: "pct", raw: bench, mandatory: lines.join(" ").includes(`${_p1(bench)}%`), context: _ctx }));
  bol.push(fig(`${L.p} bajo el benchmark`, String(below.length), { unit: "count", raw: below.length, mandatory: false, context: _ctx }));
  return {
    opener: lines.filter(Boolean).join("\n\n"),
    suggestions,
    sentrixAction: null,
    evidence: { lens: "margin", metrica: "margen", dimension: dim, boleta: bol,
      margin: { focus, bench, dimension: dim, panel: _marginPanel(rows, bench, focus), below: below.map((r) => ({ nombre: _mNombre(r), margen: r.margen, venta: r.venta, gap: _gap(r) })) } },
  };
}

/* ── composeSpecVentas · FOCO VENTAS (owner 2026-07-06 · "la pregunta manda el foco") ────────────────────────
 * Tercer composer focus-aware. El set de ventas es el más HUECO-pesado (no hay sucursal, transacciones, serie mensual, flag
 * de nuevo). Cada foco responde lo específico con el dato disponible; los huecos avisan honesto + pivotan a la lente más
 * cercana (nunca el genérico). Fuentes: clientesVentas (YoY+ppto), marcas/sfamiliasVentas (YoY), skusMargen (venta),
 * baseKpis (totales). Escalas ambiguas (precio realizado, descomposición) se dan en % (invariante); los $ vía _money. */
const _pctChg = (a, b) => (b ? (a - b) / b * 100 : 0);
const _sgnp = (v) => (v >= 0 ? "+" : "");
const _VLBL = { cliente: { s: "cliente", p: "clientes", art: "Los" }, sku: { s: "SKU", p: "SKU", art: "Los" }, familia: { s: "familia", p: "familias", art: "Las" }, marca: { s: "marca", p: "marcas", art: "Las" }, canal: { s: "canal", p: "canales", art: "Los" } };
function _ventasByCanal() {
  const g = {};
  for (const r of _cVentas) { const k = r.canal || "—"; const gg = (g[k] = g[k] || { nombre: k, actual: 0, anterior: 0, unidades: 0, unidadesAnt: 0, presupuesto: 0 }); gg.actual += r.actual || 0; gg.anterior += r.anterior || 0; gg.unidades += r.unidades || 0; gg.unidadesAnt += r.unidadesAnt || 0; gg.presupuesto += r.presupuesto || 0; }
  return Object.values(g);
}
function _ventasRows(dim) {
  if (dim === "marca") return _mVentas;
  if (dim === "familia") return _fVentas;
  if (dim === "canal") return _ventasByCanal();
  if (dim === "sku") return _skusM.map((s) => ({ nombre: s.nombre, actual: s.venta, unidades: s.unidades, marca: s.marca, sfamilia: s.sfamilia }));   // sin anterior/ppto
  return _cVentas;
}
// presupuesto sólo existe por CLIENTE → para marca/familia/canal se hace ROLL-UP de clientesVentas por ese eje (agregado honesto)
function _pptoByDim(dim) {
  if (dim === "cliente") return _cVentas.map((r) => ({ nombre: r.nombre, actual: r.actual, presupuesto: r.presupuesto }));
  const key = dim === "familia" ? "sfamilia" : dim === "marca" ? "marca" : dim === "canal" ? "canal" : null;
  if (!key) return [];   // sku → sin ppto
  const g = {};
  for (const r of _cVentas) { const k = r[key] || "—"; const gg = (g[k] = g[k] || { nombre: k, actual: 0, presupuesto: 0 }); gg.actual += r.actual || 0; gg.presupuesto += r.presupuesto || 0; }
  return Object.values(g);
}
// bloque de un foco REAL → { lines, suggestions, bol } · reusable como pivot de un hueco
function _ventasFocusBlock(focus, dim, filters, entityScope) {
  const L = _VLBL[dim] || _VLBL.cliente;
  let rows = _scopeRows(_ventasRows(dim), filters, entityScope);
  if (!rows.length) return null;
  const _m = (v) => _money(v * 1000);   // ventas en MILES → $ real (escala del contrato · el total de cartera es ~$100M · consistente con el resumen ejecutivo)
  const bol = [];

  if (focus === "vs_presupuesto") {
    // el TOTAL viene de la KPI autoritativa (100K vs 97K = +3.1%); el desglose por eje = roll-up de clientesVentas.
    // Con ENTITYSCOPE ("de esos, ¿cómo van contra el plan?") el total honesto es el del SUBCONJUNTO (roll-up), no la KPI.
    const allP = _pptoByDim(dim);
    const rowsP = _scopeRows(allP, {}, entityScope);
    const scoped = rowsP.length > 0 && rowsP.length < allP.length;
    const totA = scoped ? rowsP.reduce((a, r) => a + (r.actual || 0), 0) : _vKPI.totalActual;
    const totP = scoped ? rowsP.reduce((a, r) => a + (r.presupuesto || 0), 0) : _vKPI.totalPresupuesto;
    const tp = _pctChg(totA, totP);
    const totLine = `La venta va ${_sgnp(tp)}${_p1(tp)}% ${tp >= 0 ? "sobre" : "bajo"} presupuesto (${_m(totA)} vs ${_m(totP)}).`;
    if (!rowsP.length) {   // sku → sin ppto propio
      return { lines: [`${totLine} Por ${L.s} no tengo presupuesto propio — sólo por cliente (y al total). El desglose de cumplimiento por ${L.s} no es posible.`, `Por cliente sí puedo mostrarte quién se despega del plan.`], suggestions: ["Desviación vs presupuesto por cliente", "Cómo vamos vs el año anterior"], bol: [fig("Venta total", _m(_vKPI.totalActual), { unit: "money", raw: _vKPI.totalActual * 1000, mandatory: true, context: "vs presupuesto" }), fig("Presupuesto total", _m(_vKPI.totalPresupuesto), { unit: "money", raw: _vKPI.totalPresupuesto * 1000, mandatory: false, context: "vs presupuesto" })] };
    }
    const withDev = rowsP.map((r) => ({ ...r, dev: (r.actual || 0) - r.presupuesto, devp: _pctChg(r.actual || 0, r.presupuesto) })).sort((a, b) => b.dev - a.dev);
    const over = withDev.filter((r) => r.dev > 0), under = withDev.filter((r) => r.dev < 0).sort((a, b) => a.dev - b.dev);
    const short = Math.abs(under.reduce((a, r) => a + r.dev, 0));   // lo que falta al plan (K) — la palanca del período
    const lines = [
      `${totLine}${dim !== "cliente" ? ` Por ${L.s} el presupuesto es un agregado de los clientes.` : ""}`,
      over.length ? `Los que más se despegan sobre plan: ${over.slice(0, 3).map((r) => `${r.nombre} (${_sgnp(r.dev)}${_m(r.dev)}, ${_sgnp(r.devp)}${_p1(r.devp)}%)`).join(" · ")}.` : "",
      under.length ? `Los que quedan cortos: ${under.slice(0, 3).map((r) => `${r.nombre} (${_m(r.dev)}, ${_p1(r.devp)}%)`).join(" · ")}.` : `Ningún ${L.s} quedó bajo presupuesto.`,
      under.length ? `**Cuánto vale:** cerrar lo que falta al plan vale +${_m(short)} este período — el que más pesa es ${under[0].nombre} (${_m(under[0].dev)}).` : "",
      `**Qué hacer:** el foco de recuperación son los que quedan cortos; los de arriba marcan qué está funcionando.`,
    ];
    if (under.length) bol.push(fig("Palanca · cerrar el plan", _m(short), { unit: "money", raw: short * 1000, mandatory: true, source: "computed", formula: "Σ déficit vs presupuesto", context: "cuánto vale la palanca" }));
    for (const r of [...over.slice(0, 3), ...under.slice(0, 2)]) bol.push(fig(`${L.s} · ${r.nombre} vs ppto`, `${_sgnp(r.dev)}${_m(r.dev)}`, { unit: "money", raw: r.dev * 1000, mandatory: false, context: "vs presupuesto" }));
    bol.push(fig(scoped ? "Venta del grupo" : "Venta total", _m(totA), { unit: "money", raw: totA * 1000, mandatory: true, context: "vs presupuesto" }));
    bol.push(fig(scoped ? "Presupuesto del grupo" : "Presupuesto total", _m(totP), { unit: "money", raw: totP * 1000, mandatory: false, context: "vs presupuesto" }));
    const panel = { kind: "movers", title: "Vs presupuesto", headline: `${_sgnp(tp)}${_p1(tp)}%`, headlineSub: `${_m(totA)} vs ${_m(totP)}`, rows: withDev.map((r) => ({ nombre: r.nombre, val: r.dev, valFmt: `${_sgnp(r.dev)}${_m(r.dev)}`, pct: +r.devp.toFixed(1), pos: r.dev >= 0 })) };
    return { lines, suggestions: ["Cómo vamos vs el año anterior", "Es por volumen o por precio"], bol, panel };
  }

  if (focus === "vs_anterior" || focus === "explica_yoy") {
    let useRows = rows, note = "", LL = L;
    if (!rows.some((r) => typeof r.anterior === "number")) { useRows = _cVentas; LL = _VLBL.cliente; note = `Por ${L.s} no tengo el año anterior (sólo venta actual) — te lo doy por cliente, que es el eje con YoY.`; }   // sku → pivot a cliente
    const conA = useRows.filter((r) => typeof r.anterior === "number");
    const mov = conA.map((r) => ({ nombre: r.nombre, d: (r.actual || 0) - (r.anterior || 0), p: _pctChg(r.actual || 0, r.anterior || 0) }));
    const up = mov.filter((r) => r.d > 0).sort((a, b) => b.d - a.d), down = mov.filter((r) => r.d < 0).sort((a, b) => a.d - b.d);
    const tot = conA.reduce((a, r) => a + (r.actual || 0), 0), totAnt = conA.reduce((a, r) => a + (r.anterior || 0), 0), tp = _pctChg(tot, totAnt);
    const lines = [
      note,
      `La venta va ${_sgnp(tp)}${_p1(tp)}% vs el año anterior (${_m(tot)} vs ${_m(totAnt)}, ${_sgnp(tot - totAnt)}${_m(tot - totAnt)}).`,
      up.length ? `Traccionan el crecimiento: ${up.slice(0, 4).map((r) => `${r.nombre} (${_sgnp(r.d)}${_m(r.d)})`).join(" · ")}.` : "",
      down.length ? `Restan: ${down.slice(0, 4).map((r) => `${r.nombre} (${_m(r.d)})`).join(" · ")}.` : `Ningún ${LL.s} cae vs el año anterior.`,
      `**Qué hacer:** el neto es positivo, pero los que restan son la fuga a mirar — recuperarlos suma directo.`,
    ];
    for (const r of [...up.slice(0, 3), ...down.slice(0, 2)]) bol.push(fig(`${LL.s} · ${r.nombre} YoY`, `${_sgnp(r.d)}${_m(r.d)}`, { unit: "money", raw: r.d * 1000, mandatory: false, context: "vs año anterior" }));
    const panel = { kind: "movers", title: "Vs año anterior", headline: `${_sgnp(tp)}${_p1(tp)}%`, headlineSub: `${_m(tot)} vs ${_m(totAnt)}`, rows: mov.map((r) => ({ nombre: r.nombre, val: r.d, valFmt: `${_sgnp(r.d)}${_m(r.d)}`, pct: +r.p.toFixed(1), pos: r.d >= 0 })).sort((a, b) => b.val - a.val) };
    return { lines, suggestions: ["Es por volumen o por precio", "Quiénes redujeron su compra"], bol, panel };
  }

  if (focus === "descomposicion_vol_precio") {
    const conA = rows.filter((r) => typeof r.anterior === "number" && typeof r.unidadesAnt === "number");
    if (!conA.length) return { lines: [`Por ${L.s} no tengo unidades del año anterior — la descomposición volumen/precio la puedo dar por cliente, marca o familia.`], suggestions: ["Descomposición por cliente", "Crecimiento YoY"], bol: [] };
    const sV = conA.reduce((a, r) => a + (r.actual || 0), 0), sVA = conA.reduce((a, r) => a + (r.anterior || 0), 0);
    const sU = conA.reduce((a, r) => a + (r.unidades || 0), 0), sUA = conA.reduce((a, r) => a + (r.unidadesAnt || 0), 0);
    const volp = _pctChg(sU, sUA), pNow = sU ? sV / sU : 0, pAnt = sUA ? sVA / sUA : 0, prip = _pctChg(pNow, pAnt), totp = _pctChg(sV, sVA);
    const perc = conA.map((r) => ({ nombre: r.nombre, vol: _pctChg(r.unidades || 0, r.unidadesAnt || 0), pri: _pctChg((r.unidades ? r.actual / r.unidades : 0), (r.unidadesAnt ? r.anterior / r.unidadesAnt : 0)) }));
    const volLed = perc.slice().sort((a, b) => b.vol - a.vol)[0], priLed = perc.slice().sort((a, b) => b.pri - a.pri)[0];
    const lines = [
      `El ${_sgnp(totp)}${_p1(totp)}% de crecimiento se parte en volumen y precio: **más unidades ${_sgnp(volp)}${_p1(volp)}%** y **mejor precio realizado ${_sgnp(prip)}${_p1(prip)}%**.`,
      `Del lado volumen empuja ${volLed.nombre} (${_sgnp(volLed.vol)}${_p1(volLed.vol)}% en unidades); del lado precio, ${priLed.nombre} (${_sgnp(priLed.pri)}${_p1(priLed.pri)}% de precio realizado).`,
      `Nota: "precio realizado" = venta/unidades (no es un ticket ni una lista de precios). El efecto MIX entre familias se ve por familia; la **frecuencia de compra no la tengo** (no hay transacciones).`,
      `**Qué hacer:** si el crecimiento es más volumen que precio, es sano (ganás mercado); si fuera casi todo precio, habría que revisar si es sostenible.`,
    ];
    bol.push(fig("Crecimiento total YoY", `${_sgnp(totp)}${_p1(totp)}%`, { unit: "pct", raw: +totp.toFixed(1), mandatory: true, context: "descomposición" }));
    bol.push(fig("Efecto volumen", `${_sgnp(volp)}${_p1(volp)}%`, { unit: "pct", raw: +volp.toFixed(1), mandatory: false, context: "descomposición" }));
    bol.push(fig("Efecto precio realizado", `${_sgnp(prip)}${_p1(prip)}%`, { unit: "pct", raw: +prip.toFixed(1), mandatory: false, context: "descomposición" }));
    const panel = { kind: "decomp", title: "Volumen vs precio", totp: +totp.toFixed(1), volp: +volp.toFixed(1), prip: +prip.toFixed(1), volLed: volLed.nombre, priLed: priLed.nombre };
    return { lines, suggestions: ["Quiénes traccionan el crecimiento", "Participación de familias en el mix"], bol, panel };
  }

  if (focus === "caida_clientes") {
    const conA = _scopeRows(_cVentas, {}, entityScope).filter((r) => typeof r.anterior === "number");   // "de esos, ¿cuáles se cayeron?" respeta el alcance heredado
    const down = conA.map((r) => ({ nombre: r.nombre, d: (r.actual || 0) - (r.anterior || 0), p: _pctChg(r.actual || 0, r.anterior || 0), du: (r.unidades || 0) - (r.unidadesAnt || 0) })).filter((r) => r.d < 0).sort((a, b) => a.d - b.d);
    if (!down.length) return { lines: [`Ningún cliente redujo su compra vs el año anterior — todos crecen o se mantienen. No te invento una fuga que no existe.`], suggestions: ["Crecimiento YoY por cliente", "Cómo vamos vs presupuesto"], bol: [] };
    const lines = [
      `Los clientes que retroceden vs el año anterior: ${down.slice(0, 4).map((r) => `${r.nombre} (${_m(r.d)}, ${_p1(r.p)}%)`).join(" · ")}.`,
      `El más marcado es ${down[0].nombre} (${_m(down[0].d)}, ${_p1(down[0].p)}%${down[0].du < 0 ? `, ${down[0].du}u menos` : ""}). Ninguno dejó de comprar del todo, pero estos son los que se enfrían.`,
      `Nota: no tengo flag de "cliente activo/nuevo" ni frecuencia de compra (no hay transacciones) — esto es caída de venta YoY, la señal más cercana a "dejar de comprar".`,
      `**Qué hacer:** la mayor oportunidad de recuperación está justo acá — recuperar a estos clientes vale ${_m(Math.abs(down.slice(0, 4).reduce((a, r) => a + r.d, 0)))}.`,
    ];
    for (const r of down.slice(0, 4)) bol.push(fig(`Cliente · ${r.nombre} YoY`, `${_m(r.d)}`, { unit: "money", raw: r.d * 1000, mandatory: false, context: "caída YoY" }));
    const panel = { kind: "movers", title: "Clientes que retroceden", headlineSub: "vs el año anterior", rows: down.map((r) => ({ nombre: r.nombre, val: r.d, valFmt: _m(r.d), pct: +r.p.toFixed(1), pos: false })) };
    return { lines, suggestions: ["Crecimiento YoY por cliente", "Es por volumen o por precio"], bol, panel };
  }

  if (focus === "precio_realizado") {
    const conU = rows.filter((r) => r.unidades > 0);
    if (!conU.length) return null;
    const withP = conU.map((r) => ({ nombre: r.nombre, pNow: r.actual / r.unidades, yoy: (typeof r.anterior === "number" && r.unidadesAnt) ? _pctChg(r.actual / r.unidades, r.anterior / r.unidadesAnt) : null }));
    const up = withP.filter((r) => r.yoy != null).sort((a, b) => b.yoy - a.yoy);
    const lines = [
      `**Ojo — no tengo ticket promedio real** (necesita nº de transacciones, y no hay pedidos en los datos). Lo más cercano es el **precio promedio realizado** (venta/unidades), que no es lo mismo.`,
      up.length ? `Por ${L.s}, quién subió más su precio realizado vs el año anterior: ${up.slice(0, 3).map((r) => `${r.nombre} (${_sgnp(r.yoy)}${_p1(r.yoy)}%)`).join(" · ")}.` : `Precio realizado por ${L.s}: ${withP.slice(0, 3).map((r) => r.nombre).join(" · ")}.`,
      `Tampoco tengo sucursal ni vendedor, así que el corte por esos ejes no es posible. Frecuencia y tráfico requieren transacciones (no existen).`,
    ];
    for (const r of up.slice(0, 3)) if (r.yoy != null) bol.push(fig(`${L.s} · ${r.nombre} precio realizado YoY`, `${_sgnp(r.yoy)}${_p1(r.yoy)}%`, { unit: "pct", raw: +r.yoy.toFixed(1), mandatory: false, context: "precio realizado" }));
    const panel = { kind: "movers", title: "Precio realizado YoY (proxy, no es ticket)", pctMode: true, rows: up.filter((r) => r.yoy != null).map((r) => ({ nombre: r.nombre, val: r.yoy, valFmt: `${_sgnp(r.yoy)}${_p1(r.yoy)}%`, pos: r.yoy >= 0 })) };
    return { lines, suggestions: ["Es por volumen o por precio", "Crecimiento YoY por cliente"], bol, panel };
  }

  if (focus === "mix_familia") {
    const rowsF = _scopeRows(_fVentas, {}, entityScope).filter((r) => typeof r.anterior === "number");   // scope heredado (sólo intersecta si lo heredado son familias)
    const tot = rowsF.reduce((a, r) => a + (r.actual || 0), 0), totA0 = rowsF.reduce((a, r) => a + (r.anterior || 0), 0);
    const mix = rowsF.map((r) => ({ nombre: r.nombre, sNow: tot ? (r.actual || 0) / tot * 100 : 0, sAnt: totA0 ? (r.anterior || 0) / totA0 * 100 : 0 })).map((r) => ({ ...r, dpp: r.sNow - r.sAnt })).sort((a, b) => b.dpp - a.dpp);
    const gan = mix[0], per = mix[mix.length - 1];
    const lines = [
      `En el mix de ventas, ${gan.nombre} gana participación (${_p1(gan.sAnt)}% → ${_p1(gan.sNow)}%, ${_sgnp(gan.dpp)}${_p1(gan.dpp)}pp) y ${per.nombre} pierde (${_p1(per.sAnt)}% → ${_p1(per.sNow)}%, ${_p1(per.dpp)}pp).`,
      `Participación actual: ${mix.slice().sort((a, b) => b.sNow - a.sNow).map((r) => `${r.nombre} ${_p1(r.sNow)}%`).join(" · ")}.`,
      `**Qué mirar:** quién gana peso del mix marca hacia dónde se mueve la demanda — útil para reponer y negociar donde estás creciendo.`,
    ];
    for (const r of mix) bol.push(fig(`Familia · ${r.nombre} share`, `${_p1(r.sNow)}%`, { unit: "pct", raw: +r.sNow.toFixed(1), mandatory: false, context: "mix de ventas" }));
    const panel = { kind: "mix", title: "Mix de ventas · participación", rows: mix.slice().sort((a, b) => b.sNow - a.sNow).map((r) => ({ nombre: r.nombre, sNow: +r.sNow.toFixed(1), sAnt: +r.sAnt.toFixed(1), dpp: +r.dpp.toFixed(1) })) };
    return { lines, suggestions: ["Crecimiento YoY por familia", "Es por volumen o por precio"], bol, panel };
  }

  if (focus === "rank_venta") {
    const ranked = _scopeRows(_skusM.slice(), {}, entityScope).sort((a, b) => (b.venta || 0) - (a.venta || 0));   // "de esos SKU, ¿cuál vende más?" respeta el alcance
    if (!ranked.length) return null;
    const lines = [
      `Los SKU que más venden: ${ranked.slice(0, 5).map((s) => `${s.nombre} (${_m(s.venta)})`).join(" · ")}.`,
      ranked[1] ? `${ranked[0].nombre} lidera con ${_m(ranked[0].venta)}, seguido de ${ranked[1].nombre} (${_m(ranked[1].venta)}).` : `${ranked[0].nombre} lidera con ${_m(ranked[0].venta)}.`,
      `**Ojo:** no tengo presupuesto ni año anterior POR SKU (sólo por cliente/marca/familia), así que no puedo comparar cada SKU contra plan ni contra el año pasado — eso te lo doy a nivel cliente o familia.`,
    ];
    for (const s of ranked.slice(0, 5)) bol.push(fig(`SKU · ${s.nombre} venta`, _m(s.venta), { unit: "money", raw: s.venta * 1000, mandatory: false, context: "ranking de venta" }));
    const panel = { kind: "rank", title: "SKU por venta", rows: ranked.slice(0, 8).map((s) => ({ nombre: s.nombre, val: s.venta, valFmt: _m(s.venta) })) };
    return { lines, suggestions: ["Venta vs año anterior por familia", "Los SKU de alto margen subpenetrados"], bol, panel };
  }
  return null;
}

const _VGAP = {
  sin_sucursal: { no: "cortar la venta por SUCURSAL / punto de venta", falta: "datos de venta por sucursal (sólo existe el catálogo de sucursales, sin ventas asociadas)" },
  sin_serie_mensual: { no: "comparar contra el MES anterior", falta: "serie mensual (el único período previo que tengo es el AÑO anterior, no el mes)" },
  sin_frecuencia: { no: "medir la FRECUENCIA de compra", falta: "pedidos/transacciones (sin ellos no hay cuántas veces compra cada cliente)" },
  sin_ticket: { no: "dar el TICKET promedio, el tráfico o la conversión", falta: "transacciones (el ticket real necesita nº de operaciones; lo que hay es venta/unidades = precio realizado)" },
};

export function composeSpecVentas({ filters = {}, scenario, focus = "vs_anterior", dimension = "cliente", gap = null, pivotFocus = null, entityScope = null } = {}) {
  const dim = _VLBL[dimension] ? dimension : "cliente";
  if (gap) {
    const g = _VGAP[gap] || _VGAP.sin_sucursal;
    const pf = pivotFocus || (gap === "sin_frecuencia" ? "caida_clientes" : gap === "sin_ticket" ? "precio_realizado" : gap === "sin_serie_mensual" ? "vs_anterior" : "vs_anterior");
    const pivotDim = pf === "mix_familia" ? "familia" : pf === "rank_venta" ? "sku" : "cliente";
    const block = _ventasFocusBlock(pf, pivotDim, {}) || { lines: [`Puedo mostrarte la venta vs el año anterior por cliente.`], suggestions: [], bol: [] };
    const lines = [
      `No te puedo ${g.no}: falta ${g.falta}. No lo invento.`,
      `Lo más cercano que SÍ tengo:`,
      ...block.lines,
    ];
    return { opener: lines.filter(Boolean).join("\n\n"), suggestions: block.suggestions.length ? block.suggestions : ["Cómo vamos vs el año anterior", "Cómo vamos vs presupuesto"], sentrixAction: null,
      evidence: { lens: "ventas", metrica: "ventas", dimension: pivotDim, boleta: block.bol, ventas: { focus: "gap:" + gap, pivot: pf, gapLabel: g.no, panel: block.panel || null } } };
  }
  const block = _ventasFocusBlock(focus, dim, filters, entityScope);
  if (!block) return null;
  return { opener: block.lines.filter(Boolean).join("\n\n"), suggestions: block.suggestions, sentrixAction: null,
    evidence: { lens: "ventas", metrica: "ventas", dimension: dim, boleta: block.bol, ventas: { focus, dimension: dim, panel: block.panel || null } } };
}

/* ── composeSpecContribucion · FOCO CONTRIBUCIÓN (owner 2026-07-06 · "la pregunta manda el foco") ────────────
 * 4º dominio. Contribución = el $ que aporta cada entidad (distinto del margen %). Conceptos propios: concentración 80/20
 * (quién la sostiene), origen (volumen vs calidad · reusa origenContribucion del motor), no capturada (gap vs benchmark ≈
 * el $4.9M del resumen), alta-venta-baja-contribución. Reusa _marginRows (mismas fuentes) + diagnoseClientes + concentracion.
 * Escala ×1000 (_mVenta) consistente con el resumen. Corre ANTES de margen/ventas (evita que "venta"/"margen" lo secuestren). */
const _ORIGEN_TXT = { volumen: "del VOLUMEN — es una cuenta grande, pero con margen bajo el promedio (plata por tamaño, no por calidad)", calidad: "de la CALIDAD — buen margen, aunque no sea la cuenta más grande", mix_balanceado: "de un mix equilibrado — buen tamaño y buen margen a la vez", bajo_impacto: "de poco — ni el volumen ni el margen la sostienen" };

export function composeSpecContribucion({ filters = {}, scenario, focus = "rank", dimension = "cliente", entity = null, entityScope = null } = {}) {
  const dim = _MLBL[dimension] ? dimension : "cliente";
  const L = _MLBL[dim];
  const rows = _scopeRows(_marginRows(dim, scenario), filters, entityScope).filter((r) => typeof r.contribucion === "number");
  if (!rows.length) return null;
  const bench = _benchOf(rows[0]);
  const totC = rows.reduce((a, r) => a + (r.contribucion || 0), 0) || 1;
  const _ctx = "contribución";
  const dc = dim === "cliente" ? diagnoseClientes(_cVentas, _marginRows("cliente", scenario)) : {};
  const _share = (c) => +(c / totC * 100).toFixed(1);
  let lines = [], suggestions = [], bol = [], panel = null;

  if (focus === "concentracion") {
    const con = concentracion(rows.map((r) => ({ nombre: _mNombre(r), valor: r.contribucion })), 0.8);
    const restN = rows.length - con.cantidadEntidades, restPct = +(100 - con.totalCubiertoPct).toFixed(1);
    const sorted = rows.slice().sort((a, b) => b.contribucion - a.contribucion);
    let acc = 0; const prows = sorted.map((r) => { acc += r.contribucion; return { nombre: _mNombre(r), valFmt: _mVenta(r.contribucion), part: _share(r.contribucion), acum: +(acc / totC * 100).toFixed(1) }; });
    lines = [
      `El ${_p1(con.totalCubiertoPct)}% de tu contribución la sostienen ${con.cantidadEntidades} de ${rows.length} ${L.p}: ${con.entidades.slice(0, 4).map((e) => `${e.nombre} (${_p1(e.participacionPct)}%)`).join(" · ")}.`,
      restN > 0 ? `El resto (${restN} ${L.p}) aporta apenas el ${_p1(restPct)}%.` : "",
      `**Qué significa:** tu contribución está ${con.cantidadEntidades <= rows.length / 2 ? "concentrada en pocas cuentas" : "bastante repartida"} — cuidar a esas ${con.cantidadEntidades} es prioridad, perder una pega directo en la plata.`,
    ];
    for (const e of con.entidades.slice(0, 5)) bol.push(fig(`${L.s} · ${e.nombre} contribución`, _mVenta(e.valor), { unit: "money", raw: e.valor * 1000, mandatory: false, context: _ctx }));
    panel = { kind: "pareto", title: "Quién sostiene la contribución", totalPct: con.totalCubiertoPct, cutoff: con.cantidadEntidades, of: rows.length, rows: prows };
    suggestions = ["De dónde viene esa contribución", "Cuánta contribución no capturo"];
  } else if (focus === "no_capturada") {
    // MISMA verdad que el diagnóstico del resumen (~$4.9M): venta(clientesVentas.actual)×benchmark/100 − contribución, con
    // los gates de materialidad (≥4pp bajo benchmark · ≥ piso $). Cliente-level (donde vive el gap). `gap` ya está en $ real.
    const vBy = {}; for (const v of _cVentas) vBy[v.nombre] = v;
    const mRows = _scopeRows(_marginRows("cliente", scenario), {}, entityScope);
    const withGap = [];
    for (const r of mRows) {
      const v = vBy[r.nombre]; if (!v || typeof v.actual !== "number") continue;
      const bmk = _benchOf(r), mg = r.margen, cb = r.contribucion;
      if (typeof mg !== "number" || typeof cb !== "number" || (bmk - mg) < _DIAG_MARGIN_GAP) continue;
      const usd = Math.round(((v.actual * bmk / 100) - cb) * 1000);
      if (usd >= _DIAG_FLOOR_USD) withGap.push({ nombre: r.nombre, gap: usd, margen: mg });
    }
    withGap.sort((a, b) => b.gap - a.gap);
    const totalGap = withGap.reduce((a, r) => a + r.gap, 0);
    lines = [
      `Estás dejando ${_money(totalGap)} de contribución sobre la mesa: es lo que sumarías si los ${withGap.length} clientes materiales que hoy están bajo el benchmark (${_p1(bench)}%) llegaran al piso.`,
      `Los que más dejan: ${withGap.slice(0, 4).map((r) => `${r.nombre} (${_money(r.gap)}, margen ${_p1(r.margen)}%)`).join(" · ")}.`,
      `**Por qué:** es la brecha entre lo que vendés y lo que rinde — no es una pérdida contable, es contribución que el margen delgado te deja capturar.`,
      `**Qué hacer:** cada punto de margen recuperado en los de mayor venta es la palanca más directa sobre esta plata.`,
    ];
    for (const r of withGap.slice(0, 4)) bol.push(fig(`${L.s} · ${r.nombre} no capturada`, _money(r.gap), { unit: "money", raw: r.gap, mandatory: false, context: _ctx }));
    panel = { kind: "gap", title: "Contribución no capturada", headline: _money(totalGap), rows: withGap.map((r) => ({ nombre: r.nombre, val: r.gap, valFmt: _money(r.gap) })) };
    suggestions = ["Quién sostiene la contribución", "Es por precio o por costo"];
  } else if (focus === "origen") {
    if (entity && dc[entity]) {
      const d = dc[entity], r = rows.find((x) => _mNombre(x) === entity);
      lines = [
        `La contribución de ${entity}${r ? ` (${_mVenta(r.contribucion)}, ${_share(r.contribucion)}% del total)` : ""} viene ${_ORIGEN_TXT[d.origenContribucion] || "de una mezcla de factores"}.`,
        `${d.razon}`,
        `**Qué mirar:** ${d.origenContribucion === "volumen" ? "crece por tamaño, no por rentabilidad — subir su margen aunque sea un punto rinde mucho por el volumen que mueve" : d.origenContribucion === "calidad" ? "aporta por calidad de venta — el upside está en ganarle volumen sin resignar ese margen" : "conviene sostener el equilibrio y empujar donde haya espacio"}.`,
      ];
      if (r) bol.push(fig(`${L.s} · ${entity} contribución`, _mVenta(r.contribucion), { unit: "money", raw: r.contribucion * 1000, mandatory: true, context: _ctx }));
      panel = { kind: "rank", title: `Contribución · contexto de ${entity}`, rows: rows.slice().sort((a, b) => b.contribucion - a.contribucion).slice(0, 8).map((x) => ({ nombre: _mNombre(x), val: x.contribucion, valFmt: _mVenta(x.contribucion), hi: _mNombre(x) === entity })) };
    } else {
      const byO = {}; for (const r of rows) { const d = dc[_mNombre(r)]; if (d) { (byO[d.origenContribucion] = byO[d.origenContribucion] || { c: 0, names: [] }); byO[d.origenContribucion].c += r.contribucion; byO[d.origenContribucion].names.push(_mNombre(r)); } }
      const ord = Object.entries(byO).sort((a, b) => b[1].c - a[1].c);
      const dom = ord[0];
      lines = [
        `Tu contribución viene sobre todo ${_ORIGEN_TXT[dom[0]] ? _ORIGEN_TXT[dom[0]].split(" — ")[0] : "del volumen"}: ${dom[1].names.slice(0, 3).join(", ")} pesan ${_mVenta(dom[1].c)} (${_share(dom[1].c)}%).`,
        ord[1] ? `Del lado ${ord[1][0] === "calidad" ? "de la calidad (margen alto)" : ord[1][0]}: ${ord[1][1].names.slice(0, 3).join(", ")} (${_mVenta(ord[1][1].c)}).` : "",
        `**Qué mirar:** si la contribución depende del volumen (cuentas grandes, margen bajo), es más frágil — un punto de margen ahí es la mayor palanca.`,
      ];
      panel = { kind: "rank", title: "Contribución por cliente", rows: rows.slice().sort((a, b) => b.contribucion - a.contribucion).slice(0, 8).map((x) => ({ nombre: _mNombre(x), val: x.contribucion, valFmt: _mVenta(x.contribucion) })) };
    }
    suggestions = ["Quién sostiene la contribución", "Cuánta contribución no capturo"];
  } else if (focus === "alta_venta_baja_contribucion") {
    const wd = rows.map((r) => ({ nombre: _mNombre(r), venta: r.venta, contribucion: r.contribucion, margen: r.margen, patron: dc[_mNombre(r)] && dc[_mNombre(r)].patron }));
    const altoVol = wd.filter((r) => r.patron === "alto_volumen_bajo_margen").sort((a, b) => (b.venta || 0) - (a.venta || 0));
    const buenM = wd.filter((r) => r.patron === "buen_margen_baja_contribucion").sort((a, b) => (b.margen || 0) - (a.margen || 0));
    const lead = altoVol.length ? altoVol : wd.slice().sort((a, b) => (b.venta || 0) - (a.venta || 0)).filter((r) => _share(r.contribucion) < 100 / rows.length).slice(0, 3);
    lines = [
      `Venden mucho pero su contribución no acompaña el tamaño: ${lead.slice(0, 3).map((r) => `${r.nombre} (${_mVenta(r.venta)} de venta, ${_mVenta(r.contribucion)} de contribución a ${_p1(r.margen)}%)`).join(" · ")}.`,
      lead[0] ? `${lead[0].nombre} es el caso más caro: factura mucho pero a margen ${_p1(lead[0].margen)}%, así que aporta menos plata de la que su volumen sugiere.` : "",
      buenM.length ? `Del otro lado, ${buenM.slice(0, 2).map((r) => `${r.nombre} (${_p1(r.margen)}% margen)`).join(" y ")} tienen buen margen pero aportan poco — por tamaño chico, no por calidad.` : "",
      `**Qué hacer:** en los de alto volumen y bajo margen, un punto de margen es la mayor palanca; en los de buen margen y poco tamaño, el upside es ganarles volumen.`,
    ];
    for (const r of lead.slice(0, 3)) bol.push(fig(`${L.s} · ${r.nombre} contribución`, _mVenta(r.contribucion), { unit: "money", raw: r.contribucion * 1000, mandatory: false, context: _ctx }));
    panel = { kind: "rank", title: "Venta vs contribución", rows: wd.slice().sort((a, b) => (b.venta || 0) - (a.venta || 0)).slice(0, 8).map((r) => ({ nombre: r.nombre, val: r.contribucion, valFmt: _mVenta(r.contribucion), sub: `${_p1(r.margen)}%` })) };
    suggestions = ["De dónde viene la contribución", "Cuánta contribución no capturo"];
  } else {   // rank
    const sorted = rows.slice().sort((a, b) => b.contribucion - a.contribucion);
    lines = [
      `Los ${L.p} que más aportan a la contribución: ${sorted.slice(0, 5).map((r) => `${_mNombre(r)} (${_mVenta(r.contribucion)}, ${_share(r.contribucion)}%)`).join(" · ")}.`,
      `Entre los primeros ${Math.min(3, sorted.length)} juntan ${_mVenta(sorted.slice(0, 3).reduce((a, r) => a + r.contribucion, 0))} de los ${_mVenta(totC)} totales.`,
      `**Qué mirar:** son las cuentas que hay que blindar; si querés ver qué tan concentrada está, mirá el 80/20.`,
    ];
    for (const r of sorted.slice(0, 5)) bol.push(fig(`${L.s} · ${_mNombre(r)} contribución`, _mVenta(r.contribucion), { unit: "money", raw: r.contribucion * 1000, mandatory: false, context: _ctx }));
    panel = { kind: "rank", title: `Contribución por ${L.s}`, rows: sorted.slice(0, 8).map((r) => ({ nombre: _mNombre(r), val: r.contribucion, valFmt: _mVenta(r.contribucion) })) };
    suggestions = ["Quién sostiene la contribución", "De dónde viene la contribución"];
  }

  bol.push(fig("Contribución total", _mVenta(totC), { unit: "money", raw: totC * 1000, mandatory: false, context: _ctx }));
  return {
    opener: lines.filter(Boolean).join("\n\n"),
    suggestions,
    sentrixAction: null,
    evidence: { lens: "contribucion", metrica: "contribucion", dimension: dim, boleta: bol, contribucion: { focus, dimension: dim, panel } },
  };
}

/* ── compareCauses · la CAPA CAUSAL del compare (owner 2026-07-07: "un controller senior da causas, no lee datos") ──
 * El composer del motor (sellado) entrega la lectura estructurada de A vs B; esta capa agrega LO QUE FALTABA para la
 * historia: POR QUÉ ocurre la brecha (costo vs carga, del mismo dato), DÓNDE está la plata (la no-capturada GATED de
 * cada uno — misma cuenta del diagnose, una verdad) y LA DECISIÓN (la palanca compartida + por cuál empezar y cuánto
 * vale el punto). Se APPENDEA en el seam — el motor no se toca. Cliente-only (los ejes con estructura precio/costo). */
export function compareCauses(a, b, scenario, dim = "cliente") {
  const rows = _marginRows(dim, scenario);
  const rA = rows.find((r) => _mNombre(r) === a), rB = rows.find((r) => _mNombre(r) === b);
  if (!rA || !rB || typeof rA.margen !== "number" || typeof rB.margen !== "number") return null;
  const bench = _benchOf(rA);
  const costo = (r) => (_costShare(r) != null ? +_costShare(r).toFixed(1) : null);
  const cA = costo(rA), cB = costo(rB);
  const gA = typeof rA.pctRebate === "number" ? rA.pctRebate : null, gB = typeof rB.pctRebate === "number" ? rB.pctRebate : null;
  const bol = [], lines = [];
  // POR QUÉ OCURRE · la brecha de margen se descompone en costo vs carga (mismo dato del que salen los %)
  const dCosto = cA != null && cB != null ? Math.abs(cA - cB) : 0;
  const dCarga = gA != null && gB != null ? Math.abs(gA - gB) : 0;
  const lever = dCosto >= dCarga ? "estructura de costo" : "carga comercial";
  if (cA != null && cB != null) {
    lines.push(`**Por qué ocurre:** la diferencia de margen viene de la ${lever === "estructura de costo" ? `ESTRUCTURA DE COSTO — a ${a} el costo se le lleva el ${_p1(cA)}% del precio de lista y a ${b} el ${_p1(cB)}%` : `CARGA COMERCIAL — ${a} entrega ${_p1(gA)}% en rebates/descuentos y ${b} ${_p1(gB)}%`}; ${lever === "estructura de costo" ? `la carga casi no separa (${_p1(gA)}% vs ${_p1(gB)}%)` : `el costo casi no separa (${_p1(cA)}% vs ${_p1(cB)}%)`}.`);
    bol.push(fig(`Causa · ${a} costo/lista`, `${_p1(cA)}%`, { unit: "pct", raw: cA, mandatory: false, source: "computed", formula: "costoMedio / precioLista", context: "causa de la brecha" }));
    bol.push(fig(`Causa · ${b} costo/lista`, `${_p1(cB)}%`, { unit: "pct", raw: cB, mandatory: false, source: "computed", formula: "costoMedio / precioLista", context: "causa de la brecha" }));
  }
  // DÓNDE ESTÁ TU PLATA · cliente: la no-capturada GATED de cada uno (misma cuenta del diagnose · una verdad) + el valor
  // del punto. Otros ejes (marca/familia): SIN detector gated → la plata visible honesta es el valor del punto (venta×1%).
  const foco = dim === "cliente" ? _leverFoco(scenario, "margen", { entities: [a, b] }) : null;
  const items = (foco && foco.items) || [];
  const iA = items.find((x) => x.entidad === a), iB = items.find((x) => x.entidad === b);
  const p1A = _pp1(rA), p1B = _pp1(rB);
  let hasPlata = false;
  if (iA || iB) {
    const parts = [];
    if (iA) { parts.push(`con ${a} estás dejando ${_money(iA.usd)} al año sobre la mesa (margen ${_p1(rA.margen)}% vs tu piso ${_p1(bench)}%)`); bol.push(_figLever(`Plata en juego · ${a}`, iA.usd, "venta × benchmark − contribución")); }
    if (iB) { parts.push(`con ${b}, ${_money(iB.usd)}`); bol.push(_figLever(`Plata en juego · ${b}`, iB.usd, "venta × benchmark − contribución")); }
    lines.push(`**Dónde está tu plata:** ${parts.join("; ")}.${p1A && p1B ? ` Cada punto de margen recuperado vale +${_money(p1A)}/año en ${a} y +${_money(p1B)} en ${b}.` : ""}`);
    if (p1A) bol.push(_figLever(`Palanca · 1pp en ${a}`, p1A, "venta × 1%"));
    if (p1B) bol.push(_figLever(`Palanca · 1pp en ${b}`, p1B, "venta × 1%"));
    hasPlata = true;
  } else if ((rA.margen < bench || rB.margen < bench) && p1A && p1B) {
    lines.push(`**Dónde está tu plata:** ${a} captura ${_p1(rA.margen)}% y ${b} ${_p1(rB.margen)}% contra tu piso de ${_p1(bench)}% — cada punto de margen vale +${_money(p1A)}/año en ${a} y +${_money(p1B)} en ${b}.`);
    bol.push(_figLever(`Palanca · 1pp en ${a}`, p1A, "venta × 1%"));
    bol.push(_figLever(`Palanca · 1pp en ${b}`, p1B, "venta × 1%"));
    hasPlata = true;
  } else if (rA.margen >= bench && rB.margen >= bench) {
    lines.push(`**Dónde está tu plata:** los dos capturan sobre tu piso de ${_p1(bench)}% — acá no se pierde, se defiende: el riesgo es ceder margen para crecer volumen.`);
  }
  // LA DECISIÓN · la palanca y por dónde empezar (más venta = cada punto rinde más)
  const first = (rA.venta || 0) >= (rB.venta || 0) ? a : b;
  if (hasPlata) lines.push(`**La decisión:** la palanca ${dCosto >= dCarga ? "de los dos es la misma — negociar costo/lista" : "es la carga — revisar rebates y condiciones"}. Empezá por ${first}: mueve más venta, cada punto recuperado rinde más.`);
  // EL AÑO, MES A MES (owner 2026-07-08: "al profundizar, que diga el porqué — si fue costos, si fue acciones, cuándo
  // subieron"): la curva del año de cada uno (la MISMA que dibuja la película: tendencia del historial × estacionalidad
  // real) + lo que se movió DEBAJO en el año — acciones de precios, costo medio, ticket — del mismo historial. Solo si
  // la serie mensual existe (cliente/marca/familia/SKU); sin historial (bodega) la sección no aparece — honesto.
  const filmCmp = _cmpEvolution(a, b, "venta");
  if (filmCmp) {
    const dPct = (x0, x1) => (x0 ? +(((x1 - x0) / x0) * 100).toFixed(1) : null);
    const yearOf = (E) => {
      const H = _histM[E.name] || [];
      const f = H[0], l = H[H.length - 1];
      let s = `${E.name} hace su mejor mes en ${E.maxMes} (${_money(E.max * 1000)}) y el más flojo en ${E.minMes} (${_money(E.min * 1000)})`;
      const drivers = [];
      if (f && l && typeof f.rebates === "number" && typeof l.rebates === "number") {
        const d = dPct(f.rebates, l.rebates);
        if (d != null) {
          drivers.push(`las acciones de precios ${d >= 0 ? "suben" : "bajan"} de ${_money(f.rebates * 1000)} a ${_money(l.rebates * 1000)} al mes${d > 0 ? " empujando la temporada alta" : ""}`);
          bol.push(fig(`El año · acciones de ${E.name} (inicio)`, _money(f.rebates * 1000), { unit: "money", raw: f.rebates * 1000, mandatory: false, source: "historial", formula: "rebates mensuales (Ene)", context: "el año, mes a mes" }));
          bol.push(fig(`El año · acciones de ${E.name} (cierre)`, _money(l.rebates * 1000), { unit: "money", raw: l.rebates * 1000, mandatory: false, source: "historial", formula: "rebates mensuales (Dic)", context: "el año, mes a mes" }));
        }
      }
      if (f && l && typeof f.costoMedio === "number" && typeof l.costoMedio === "number") {
        const d = dPct(f.costoMedio, l.costoMedio);
        if (d != null && d !== 0) drivers.push(`el costo medio ${d < 0 ? "baja" : "sube"} ${Math.abs(d)}% en el año`);
      }
      if (f && l && typeof f.ticket === "number" && typeof l.ticket === "number") {
        const d = dPct(f.ticket, l.ticket);
        if (d != null && d !== 0) drivers.push(`el ticket ${d >= 0 ? "sube" : "baja"} ${Math.abs(d)}%`);
      }
      if (drivers.length) s += `; detrás del año: ${drivers.join(", ")}`;
      bol.push(fig(`Mejor mes · ${E.name}`, _money(E.max * 1000), { unit: "money", raw: E.max * 1000, mandatory: false, source: "historial", formula: "tendencia del historial × estacionalidad global", context: `mes ${E.maxMes}` }));
      bol.push(fig(`Mes más flojo · ${E.name}`, _money(E.min * 1000), { unit: "money", raw: E.min * 1000, mandatory: false, source: "historial", formula: "tendencia del historial × estacionalidad global", context: `mes ${E.minMes}` }));
      return s + ".";
    };
    const eA = filmCmp.a, eB = filmCmp.b;
    const shared = eA.growth.mes && eA.growth.mes === eB.growth.mes && eA.drop.mes && eA.drop.mes === eB.drop.mes
      ? ` La subida fuerte de los dos llega ${eA.growth.from}→${eA.growth.mes} y el freno ${eA.drop.from}→${eA.drop.mes} — la estacionalidad de tu negocio los mueve a ambos.`
      : "";
    lines.push(`**El año, mes a mes:** ${yearOf(eA)} ${yearOf(eB)}${shared}`);
  }
  // EL PERFIL (owner 2026-07-08 · "que ADI lea el gráfico, no solo la tabla"): la película de las dos líneas — quién
  // parte arriba, dónde se cruzan, desde qué estación cambia el ganador y qué variable lo explica. MISMO dato y MISMA
  // semántica que el Perfil comparado de la Mesa (arriba = mejor · carga/costo invertidos). Abre el bloque causal.
  const stations = [
    { l: "ventas", va: rA.venta, vb: rB.venta, hi: true },
    { l: "contribución", va: rA.contribucion, vb: rB.contribucion, hi: true },
    { l: "margen", va: rA.margen, vb: rB.margen, hi: true },
    gA != null && gB != null ? { l: "carga", va: gA, vb: gB, hi: false } : null,
    cA != null && cB != null ? { l: "costo", va: cA, vb: cB, hi: false } : null,
  ].filter((s) => s && typeof s.va === "number" && typeof s.vb === "number");
  const wins = stations.map((s) => (s.va === s.vb ? null : (s.hi ? s.va > s.vb : s.va < s.vb) ? a : b));
  const seqIdx = wins.map((w, i) => ({ w, i })).filter((x) => x.w);
  if (seqIdx.length >= 2 && stations.length >= 3) {
    const lead = seqIdx[0].w, otherName = lead === a ? b : a;
    const nA = wins.filter((w) => w === a).length, nB = wins.filter((w) => w === b).length;
    const flips = [];
    for (let k = 1; k < seqIdx.length; k++) if (seqIdx[k].w !== seqIdx[k - 1].w) flips.push(seqIdx[k].i);
    const stationsOf = (who) => stations.filter((_, i) => wins[i] === who).map((s) => s.l);
    const score = ` ${a} gana ${nA} estaciones · ${b} ${nB} de ${stations.length}.`;
    let peli;
    if (!flips.length) {
      peli = `${lead} domina el perfil de punta a punta — la línea de ${otherName} nunca lo cruza.${score}`;
    } else if (Math.min(nA, nB) === 1) {
      const quiebre = stationsOf(nA < nB ? a : b)[0];
      peli = `${lead} parte arriba y domina casi todo el perfil; el ÚNICO quiebre es ${quiebre.toUpperCase()}, donde la línea de ${nA < nB ? a : b} lo cruza — ahí vive su única ventaja.${score}`;
    } else {
      const cierre = seqIdx[seqIdx.length - 1].w;
      peli = `${lead} parte arriba (${stationsOf(lead).slice(0, 2).join(" y ")}); las líneas se cruzan en ${stations[flips[0]].l.toUpperCase()} y de ahí manda ${cierre} (${stationsOf(cierre).join(", ")}). El cambio lo explica la ${lever}.${score}`;
    }
    lines.unshift(`**El perfil:** ${peli}`);
  }
  if (!lines.length) return null;
  return { lines, bol };
}

/* ── diveCauses · la CAPA CAUSAL del DIVE de cliente (owner 2026-07-07 · mismo principio que compareCauses) ──────────
 * "Profundiza en X" del motor entrega el perfil; esta capa agrega la HISTORIA del controller para UNA cuenta:
 * POR QUÉ está donde está (la brecha al piso DESCOMPUESTA en pp: cuánto se va en carga sobre target y cuánto en la
 * estructura precio/costo — aritmética del mismo dato) · DÓNDE está la plata (no-capturada y carga GATED de esa cuenta,
 * las cuentas del diagnose · una verdad) · LA DECISIÓN (la palanca dominante + el valor del punto). Cliente-only. */
export function diveCauses(entity, scenario) {
  const rows = _marginRows("cliente", scenario);
  const r = rows.find((x) => _mNombre(x) === entity);
  if (!r || typeof r.margen !== "number") return null;
  const bench = _benchOf(r), gap = +(bench - r.margen).toFixed(1);
  const lines = [], bol = [];
  const cShare = _costShare(r) != null ? +_costShare(r).toFixed(1) : null;
  const p1v = _pp1(r);
  if (gap > 0) {
    // POR QUÉ · la brecha al piso, partida en pp (carga sobre target + estructura precio/costo — mismo dato, pura aritmética)
    const cargaExc = typeof r.pctRebate === "number" ? +Math.max(0, r.pctRebate - POLICY.targetCarga).toFixed(1) : 0;
    const resto = +(gap - cargaExc).toFixed(1);
    lines.push(`**Por qué está donde está:** a ${entity} le faltan ${_p1(gap)}pp para tu piso de ${_p1(bench)}%. De esos, ${cargaExc > 0 ? `${_p1(cargaExc)}pp se van en carga sobre el target (${_p1(r.pctRebate)}% vs ${_p1(POLICY.targetCarga)}%) y ` : ""}${_p1(resto)}pp vienen de la estructura precio/costo${cShare != null ? ` — el costo se lleva el ${_p1(cShare)}% del precio de lista` : ""}.`);
    bol.push(fig(`Causa · brecha al piso`, `${_p1(gap)}pp`, { unit: "pp", raw: gap, mandatory: false, source: "computed", formula: "benchmark − margen", context: "causa" }));
    if (cargaExc > 0) bol.push(fig(`Causa · carga sobre target`, `${_p1(cargaExc)}pp`, { unit: "pp", raw: cargaExc, mandatory: false, source: "computed", formula: "carga − target", context: "causa" }));
    bol.push(fig(`Causa · precio/costo`, `${_p1(resto)}pp`, { unit: "pp", raw: resto, mandatory: false, source: "computed", formula: "brecha − exceso de carga", context: "causa" }));
    // DÓNDE ESTÁ TU PLATA · las cuentas GATED del diagnose para ESTA cuenta (una verdad)
    const fm = _leverFoco(scenario, "margen", { entities: [entity] });
    const fc = _leverFoco(scenario, "carga", { entities: [entity] });
    const im = fm && fm.items.find((x) => x.entidad === entity), ic = fc && fc.items.find((x) => x.entidad === entity);
    const parts = [];
    if (im) { parts.push(`${_money(im.usd)} al año de contribución sobre la mesa si llega a tu piso`); bol.push(_figLever(`Plata en juego · ${entity}`, im.usd, "venta × benchmark − contribución")); }
    if (ic) { parts.push(`${_money(ic.usd)} recuperables llevando la carga al target`); bol.push(_figLever(`Carga recuperable · ${entity}`, ic.usd, "(carga − target) × venta")); }
    if (p1v) { parts.push(`cada punto de margen vale +${_money(p1v)}/año`); bol.push(_figLever(`Palanca · 1pp en ${entity}`, p1v, "venta × 1%")); }
    if (parts.length) lines.push(`**Dónde está tu plata:** ${parts.join(" · ")}.`);
    // LA DECISIÓN · la palanca dominante en pp
    lines.push(`**La decisión:** ${cargaExc >= resto ? `la carga es la palanca dominante — renegociar rebates/condiciones es lo primero` : `la palanca dominante es precio/costo — revisar lista y costo de compra rinde más que tocar la carga`}; después medí el punto recuperado contra ${p1v ? `los +${_money(p1v)} que vale` : "su valor anual"}.`);
  } else {
    // sobre el piso: la historia es DEFENDER (y si la carga igual está sobre target, es plata recuperable extra)
    const fc = _leverFoco(scenario, "carga", { entities: [entity] });
    const ic = fc && fc.items.find((x) => x.entidad === entity);
    lines.push(`**Por qué gana:** ${entity} captura ${_p1(r.margen)}% — ${_p1(Math.abs(gap))}pp SOBRE tu piso de ${_p1(bench)}%. Acá no se pierde: se defiende ese margen mientras crece.`);
    if (ic) { lines.push(`**Plata extra igual disponible:** su carga está sobre el target — ${_money(ic.usd)} al año recuperables sin tocar el precio.`); bol.push(_figLever(`Carga recuperable · ${entity}`, ic.usd, "(carga − target) × venta")); }
    lines.push(`**La decisión:** cuidala — es de las cuentas que sostienen tu contribución; el riesgo real es cederle margen para crecer volumen.`);
  }
  return { lines, bol };
}

/* ── composeSpecSimulate · SIMULACIÓN = un SUPUESTO aplicado sobre el dato REAL (base única = real) ─────────────
 * NO es un escenario del negocio (nada de bonanza/tensión/crisis · no invoca el motor de escenarios). Lee la base real
 * (_loadReal), aplica el transform explícito, y arma la tabla ACTUAL vs SUPUESTO vs Δ con FÓRMULA por celda. La boleta
 * marca cada cifra: actual = source:"actual" · supuesto/Δ = source:"computed" + formula (auditable). Fuera de la allow-list
 * (o transform no soportado) → null → el seam degrada honesto ("puedo leer X actual, pero ese supuesto no está habilitado"). */
// métricas que admiten un supuesto delta-% (NIVELES monetarios que escalan linealmente · NO tasas/ratios: margen/rotación/DOH)
const _SIMULABLE_DELTA_PCT = new Set(["ventas", "contribucion", "capital"]);
const _sgn = (v) => (v >= 0 ? "+" : "");

// ── VEREDICTO DE CALIDAD (B · owner 2026-07-06): juzga el BLOQUE 80% contra DOS niveles — promedio INTERNO (cartera,
//    siempre disponible) + benchmark DECLARADO (POLICY · NUNCA inventado). Graduado: coinciden → fuerte · difieren →
//    mixto. Si no hay cruce/benchmark → "sin_benchmark" honesto. El LLM NO juzga: ADI calcula, el LLM narra.
//    Cruce por métrica: ventas/contribución → margen · capital → rotación (ambos higherIsBetter). ────────────────────
const _QUALITY_CROSS = { ventas: "margen", contribucion: "margen", capital: "rotacion" };

// mapa entidad→valor del cruce (reusa el patrón de composeSpecSimulate: group-by con agg, o por-fila)
function _crossByEntity(crossMetric, dimension) {
  const cm = METRICS[crossMetric], sba = cm && cm.sourceByAxis && cm.sourceByAxis[dimension], ent = ENTITIES[dimension];
  if (!sba || !ent) return null;
  const rows = _loadReal(sba.source);
  if (!Array.isArray(rows) || !rows.length) return null;
  const field = sba.field, map = {};
  if (ent.isGroupBy) {
    const groups = {};
    for (const r of rows) { const k = r[ent.keyField]; if (k == null) continue; (groups[k] = groups[k] || []).push(r); }
    const agg = sba.agg || "avg";
    for (const [name, grp] of Object.entries(groups)) {
      const vals = grp.map((r) => r[field]).filter((v) => typeof v === "number"), sum = vals.reduce((a, b) => a + b, 0);
      map[name] = agg === "sum" ? sum : (vals.length ? sum / vals.length : 0);
    }
  } else {
    const nameField = (SOURCES[sba.source] && SOURCES[sba.source].keyField) || "sku";
    for (const r of rows) { if (typeof r[field] === "number") map[r[nameField]] = r[field]; }
  }
  return map;
}

export function computeQualityVerdict({ metric, dimension, items, blockCount } = {}) {
  const _none = (reason) => ({ verdict: "sin_benchmark", basis: null, explanation: reason });
  const crossMetric = _QUALITY_CROSS[metric];
  if (!crossMetric) return _none("No puedo juzgar la calidad de este supuesto con el dato disponible.");
  const cm = METRICS[crossMetric], cross = _crossByEntity(crossMetric, dimension);
  if (!cross || !Object.keys(cross).length) return _none(`No tengo ${cm.label.toLowerCase()} por ${(ENTITIES[dimension] && ENTITIES[dimension].label.sing) || dimension} para juzgar la calidad.`);
  const wavg = (arr) => { let sw = 0, s = 0; for (const it of arr) { const cv = cross[it.name]; if (typeof cv !== "number") continue; const w = Math.abs(it.actual) || 0; s += cv * w; sw += w; } return sw ? s / sw : null; };
  const blockVal = wavg((items || []).slice(0, blockCount || 0)), internalAvg = wavg(items || []);
  if (blockVal == null || internalAvg == null) return _none(`No puedo cruzar ${cm.label.toLowerCase()} con este bloque.`);
  const declared = crossMetric === "margen" ? POLICY.benchmark : crossMetric === "rotacion" ? POLICY.rotacionMin : null;
  const aboveInternal = blockVal >= internalAvg, aboveDeclared = declared != null ? blockVal >= declared : aboveInternal;
  const verdict = (aboveInternal && aboveDeclared) ? "buena_captura" : (!aboveInternal && !aboveDeclared) ? "captura_debil" : "mixta";
  const u = cm.unit, f = (v) => u === "pct" ? `${v.toFixed(1)}%` : u === "ratio" ? `${v.toFixed(1)}x` : String(Math.round(v));
  const bF = f(blockVal), iF = f(internalAvg), dF = declared != null ? f(declared) : null;
  let explanation;
  if (crossMetric === "margen") {
    explanation = verdict === "buena_captura" ? `El bloque captura buen margen: ${bF} vs ${iF} de la cartera (benchmark ${dF}). Crecer ahí rinde.`
      : verdict === "captura_debil" ? `El bloque está por debajo en margen: ${bF} vs ${iF} de la cartera (benchmark ${dF}). Crecer ahí suma volumen, no rentabilidad.`
      : `Captura media: ${bF} de margen — ${aboveInternal ? "sobre" : "bajo"} el promedio de cartera (${iF}) pero ${aboveDeclared ? "sobre" : "bajo"} el benchmark (${dF}). Conviene mirar antes de empujar.`;
  } else {
    explanation = verdict === "buena_captura" ? `El bloque rota sano: ${bF} vs ${iF} (mínimo ${dF}). Liberar ahí suelta plata sana.`
      : verdict === "captura_debil" ? `El bloque rota lento: ${bF} vs ${iF} (mínimo ${dF}). Mover ese stock no libera plata real.`
      : `Rotación intermedia: ${bF} vs ${iF} (mínimo ${dF}). Mirar caso a caso antes de mover.`;
  }
  return { verdict, basis: declared != null ? "both" : "internal_avg", crossMetric, crossLabel: cm.label, blockValue: blockVal, blockValueFmt: bF, internalAvg, internalAvgFmt: iF, declared, declaredFmt: dF, aboveInternal, aboveDeclared, explanation };
}

export function composeSpecSimulate({ metric, dimension, filters = {}, transform } = {}) {
  // allow-list v1: solo delta +/-X% sobre métricas de nivel. Lo demás → null → degrade honesto.
  if (!transform || transform.op !== "delta" || transform.unit !== "pct" || !_SIMULABLE_DELTA_PCT.has(metric)) return null;
  const m = METRICS[metric];
  const sba = m && m.sourceByAxis && m.sourceByAxis[dimension];
  const ent = ENTITIES[dimension];
  if (!sba || !ent) return null;

  let rows = _loadReal(sba.source);                       // BASE REAL · sin escenario
  if (!Array.isArray(rows) || !rows.length) return null;
  if (filters.marca)   rows = rows.filter((r) => r && r.marca === filters.marca);
  if (filters.familia) rows = rows.filter((r) => r && r.sfamilia === filters.familia);
  if (filters.bodega)  rows = rows.filter((r) => r && r.bodega === filters.bodega);
  if (!rows.length) return null;

  const field = sba.field;
  let actual;
  if (ent.isGroupBy) {
    const groups = {};
    for (const r of rows) { const k = r[ent.keyField]; if (k == null) continue; (groups[k] = groups[k] || []).push(r); }
    const agg = sba.agg || "sum";
    actual = Object.entries(groups).map(([name, grp]) => {
      const vals = grp.map((r) => r[field]).filter((v) => typeof v === "number");
      const sum = vals.reduce((a, b) => a + b, 0);
      return { name, value: agg === "avg" ? (vals.length ? sum / vals.length : 0) : sum };
    });
  } else {
    const nameField = (SOURCES[sba.source] && SOURCES[sba.source].keyField) || "sku";
    actual = rows.map((r) => ({ name: r[nameField], value: r[field] })).filter((x) => typeof x.value === "number");
  }
  if (!actual.length) return null;
  actual.sort((a, b) => b.value - a.value);

  const pct = transform.value, factor = 1 + pct / 100;    // ej. +3% → 1.03
  const _sc = m.scale && m.scale[dimension];
  const _f = (v) => _fmt(v, m.unit, _sc);                 // MISMO formateador que el texto determinístico
  const items = actual.map((x) => {
    const supuesto = x.value * factor, delta = supuesto - x.value;
    return { name: x.name, actual: x.value, supuesto, delta, aFmt: _f(x.value), sFmt: _f(supuesto), dFmt: _f(delta) };
  });
  const totA = items.reduce((s, it) => s + it.actual, 0), totS = totA * factor, totD = totS - totA;

  // ── CONCENTRACIÓN DEL IMPACTO (80/20) · reusa el PRINCIPIO del Pareto (sentrix/concentration.js): orden desc por Δ +
  //    acumulado + bloque hasta cruzar el 80%. Para un delta PAREJO, Δ_i ∝ actual_i → la concentración del impacto ES la
  //    de la estructura actual (el supuesto la AMPLIFICA) · % REAL, nunca forzado a 80 (honesto, data-driven). ──────────
  const impSorted = items.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const impTot = impSorted.reduce((s, it) => s + Math.abs(it.delta), 0) || 1;
  let _cum = 0;
  const bars = impSorted.map((it) => {
    _cum += Math.abs(it.delta);
    return { name: it.name, value: Math.abs(it.delta), dFmt: it.dFmt, pct: Math.round((Math.abs(it.delta) / impTot) * 100), cumPct: (_cum / impTot) * 100 };
  });
  let blockCount = bars.findIndex((b) => b.cumPct >= 80) + 1;
  if (blockCount <= 0) blockCount = bars.length;
  bars.forEach((b, i) => { b.inBlock = i < blockCount; });
  const blockPct = bars[blockCount - 1] ? Math.round(bars[blockCount - 1].cumPct) : 0;   // % REAL en el corte
  const nEnt = bars.length;
  const single = nEnt === 1;
  const concentrated = !single && blockCount <= Math.ceil(nEnt / 2);   // una minoría explica la mayoría
  const _plural = ent.label.plural || `${ent.label.sing}s`;
  const _fem = new Set(["marca", "familia", "bodega"]).has(dimension);   // concordancia de género (premium · sin "olor a prototipo")
  const _esos = _fem ? "esas" : "esos";

  // ── HISTORIA EJECUTIVA FLUIDA (owner 2026-07-06): SIN títulos visibles. La estructura (qué cambia → dónde se concentra →
  //    qué riesgo → qué haría) ordena el razonamiento INTERNAMENTE; el usuario ve UN texto corrido. Sentrix muestra la tabla.
  const _absTotD = Math.abs(totD), _impPct = Math.abs(pct);   // impacto % = |pct| (delta parejo · consistente con el %)
  const _verb = totD >= 0 ? "suma" : "resta";
  const filt = [filters.marca, filters.familia, filters.bodega].filter(Boolean).join("/");
  const _art = { ventas: "las", contribucion: "la", capital: "el" }[metric] || "el";   // artículo del sustantivo métrica
  const _cambio = metric === "capital" ? "movimiento" : (pct >= 0 ? "crecimiento" : "ajuste");
  const _k = concentrated ? "block" : "spread";
  // Riesgo/Qué-hacer CONDICIONALES por métrica × (bloque concentrado / repartido), como PROSA (no computa calidad · eso es B).
  const _RISK = {
    ventas:       { block: `Si ${_esos} ${_plural} capturan margen, el crecimiento tiene potencia; si solo agregan volumen, puede agrandar una captura débil.`, spread: "Si el crecimiento cae donde hay margen, suma; si solo agrega volumen, agranda una captura débil sin mejorar la calidad." },
    contribucion: { block: "Si ese bloque sostiene su margen, subir la contribución rinde; si no, es aporte sin rentabilidad.",                                  spread: "Si el aporte viene con margen, rinde; si no, es más contribución sin rentabilidad." },
    capital:      { block: `Si ${_esos} ${_plural} son stock que rota, liberar suelta plata sana; si es stock lento, moverlo no libera nada real.`,             spread: "Si el stock que se mueve rota, libera plata sana; si es lento, no libera nada real." },
  };
  const _ACTION = {
    ventas:       { block: "Antes de empujar la cartera completa, revisaría ese bloque contra margen, contribución y carga comercial, y recién ahí decidiría dónde crecer.", spread: "Antes de empujar parejo, cruzaría el crecimiento contra margen, contribución y carga comercial y empujaría donde la captura sea sana." },
    contribucion: { block: "Revisaría ese bloque contra margen y participación, y priorizaría donde el margen acompañe.",                                                    spread: "Cruzaría el aporte contra margen y participación y priorizaría donde rinda." },
    capital:      { block: "Cruzaría ese bloque contra DOH y rotación, y liberaría primero lo que rota sano.",                                                              spread: "Cruzaría el stock contra DOH y rotación y liberaría primero lo que rota sano." },
  };
  const _riskT = (_RISK[metric] || _RISK.ventas)[_k];
  const _actionT = (_ACTION[metric] || _ACTION.ventas)[_k];
  const _reading = single ? `El supuesto recae sobre una sola ${ent.label.sing}.`
    : concentrated ? "El supuesto amplifica la estructura actual."
    : `El supuesto reparte el impacto entre ${nEnt} ${_plural}.`;
  // VEREDICTO DE CALIDAD (B · increment 2): cruza el bloque 80% con margen/rotación · reemplaza el riesgo CONDICIONAL por
  // el veredicto COMPUTADO (ADI ya juzgó). Si no hay cruce/benchmark (sin_benchmark) o el impacto está repartido → cae al
  // framing condicional (no hay bloque nítido que juzgar). El LLM NO juzga: ADI calcula, el LLM narra desde la boleta.
  const quality = computeQualityVerdict({ metric, dimension, items, blockCount });
  const _qOk = concentrated && quality && quality.verdict && quality.verdict !== "sin_benchmark";
  let _verdictS = "", _verdictA = "";
  if (_qOk) {
    const bF = quality.blockValueFmt, iF = quality.internalAvgFmt, dF = quality.declaredFmt, aI = quality.aboveInternal, aD = quality.aboveDeclared;
    if (quality.crossMetric === "margen") {
      _verdictS = quality.verdict === "buena_captura" ? `Y ese bloque captura buen margen —${bF} contra ${dF} del benchmark—, así que el crecimiento rinde.`
        : quality.verdict === "captura_debil" ? `Pero ese bloque captura poco margen —${bF} contra ${dF} del benchmark—, así que crecer ahí suma volumen, no rentabilidad.`
        : `Ese bloque captura margen medio —${bF}, ${aI ? "sobre" : "bajo"} la cartera (${iF}) pero ${aD ? "sobre" : "bajo"} el benchmark (${dF})—, así que conviene mirar caso a caso.`;
      _verdictA = quality.verdict === "buena_captura" ? "Priorizaría crecer ahí, donde la plata efectivamente se convierte."
        : quality.verdict === "captura_debil" ? "Antes de empujar parejo, priorizaría dónde el margen acompaña." : "Empujaría selectivo, donde el margen acompañe.";
    } else {
      _verdictS = quality.verdict === "buena_captura" ? `Y ese bloque rota sano —${bF} contra un mínimo de ${dF}—, así que liberar ahí suelta plata real.`
        : quality.verdict === "captura_debil" ? `Pero ese bloque rota lento —${bF} contra un mínimo de ${dF}—, así que mover ese stock no libera plata real.`
        : `Ese bloque rota a ${bF} —${aI ? "sobre" : "bajo"} el promedio (${iF}), sobre el mínimo (${dF})—, así que conviene mirar caso a caso.`;
      _verdictA = quality.verdict === "buena_captura" ? "Priorizaría liberar ese capital."
        : quality.verdict === "captura_debil" ? "Antes de moverlo, destrabaría la rotación." : "Liberaría selectivo, donde rote sano.";
    }
  }
  // HISTORIA · texto corrido, SIN headers (qué cambia · dónde se concentra · VEREDICTO/riesgo · qué haría) · producto
  const _s1 = `Un ${_sgn(pct)}${pct}% lleva ${_art} ${m.label.toLowerCase()}${filt ? ` (${filt})` : ""} de ${_f(totA)} a ${_f(totS)} y ${_verb} ${_f(_absTotD)} sobre el dato real.`;
  const _s2 = single
    ? `El supuesto recae sobre una sola ${ent.label.sing}, así que el impacto es directo.`
    : concentrated
    ? `El punto no es solo el ${_cambio}: el impacto se concentra en ${blockCount} ${_plural} que explican el ${blockPct}%, así que el supuesto amplifica la estructura actual del negocio.`
    : `El supuesto no se apoya en un bloque: reparte el impacto entre ${nEnt} ${_plural}, así que acompaña al tamaño de cada ${ent.label.sing} más que a una parte puntual.`;
  const opener = single ? `${_s1} ${_s2}`
    : _qOk ? `${_s1} ${_s2} ${_verdictS} ${_verdictA}`
    : `${_s1} ${_s2} ${_riskT} ${_actionT}`;

  // BOLETA ESTRUCTURAL · SOLO cifras de estructura (impacto total + concentración). SIN per-entidad → el guard del LLM #2
  // (guardAgainstBoleta) bloquea CUALQUIER cifra por entidad → la enumeración es IMPOSIBLE, no solo desaconsejada. El
  // detalle fila-por-fila vive en evidence.projection (la mesa de Sentrix), auditable, fuera del alcance de la narración.
  const _ctx = `supuesto ${m.label} ${_sgn(pct)}${pct}% sobre el dato real`;
  const bol = [];
  // total actual/supuesto AUTORIZADAS (no mandatory) → NARRATE ON puede usar el before/after sin que el guard obligue a citarlas
  bol.push(fig("Total · actual",       _f(totA),      { unit: m.unit, raw: totA,     context: _ctx, source: "actual" }));
  bol.push(fig("Total · supuesto",     _f(totS),      { unit: m.unit, raw: totS,     context: _ctx, source: "computed", formula: `total actual × ${factor}` }));
  // MANDATORY: impacto total + (bloque 80/20 cuando concentra) → la tesis SIEMPRE los cita. Impacto % AUTORIZADO (no
  // obligatorio): la lectura premium se centra en $ impacto y concentración, no siempre repite el % del supuesto.
  bol.push(fig("Impacto absoluto",     _f(_absTotD),  { unit: m.unit, raw: _absTotD, mandatory: true, context: _ctx, source: "computed", formula: "|supuesto − actual|" }));
  bol.push(fig("Impacto %",            `${_impPct}%`, { unit: "pct",  raw: _impPct,  context: _ctx, source: "computed", formula: "impacto / total actual" }));
  if (concentrated) bol.push(fig("Concentración · bloque", `${blockPct}%`, { unit: "pct", raw: blockPct, mandatory: true, context: _ctx, source: "computed", formula: `${blockCount} ${_plural} acumulan el ${blockPct}% del Δ` }));
  // CALIDAD (B) · autoriza las cifras del veredicto (margen/rotación del bloque · promedio de cartera · benchmark declarado)
  // → la narración puede citarlas y el chip de Sentrix las respalda (misma fuente · coherencia por construcción).
  if (_qOk) {
    const _qu = METRICS[quality.crossMetric].unit;
    bol.push(fig(`Calidad · ${quality.crossLabel.toLowerCase()} del bloque`, quality.blockValueFmt, { unit: _qu, raw: quality.blockValue, context: _ctx, source: "computed", formula: "promedio ponderado del bloque 80%" }));
    bol.push(fig("Calidad · promedio de cartera",  quality.internalAvgFmt, { unit: _qu, raw: quality.internalAvg, context: _ctx, source: "computed", formula: "promedio ponderado de la cartera" }));
    if (quality.declaredFmt != null) bol.push(fig("Calidad · benchmark declarado", quality.declaredFmt, { unit: _qu, raw: quality.declared, context: _ctx, source: "actual", formula: "POLICY (no inventado)" }));
  }

  return {
    opener, suggestions: null, sentrixAction: null,
    evidence: { entityType: dimension, dimension, metrica: metric, metricLabel: m.label, dimLabel: ent.label.sing,
      lens: "cuadro", boleta: bol, factor,
      transform: { op: "delta", value: pct, unit: "pct", base: "real" },
      // projection ENRIQUECIDA (formateados + fórmula) para que Sentrix renderice la tabla sin recomputar
      projection: items.map((it) => ({ name: it.name, actual: it.actual, supuesto: it.supuesto, delta: it.delta,
        aFmt: it.aFmt, sFmt: it.sFmt, dFmt: it.dFmt, formula: `${it.aFmt} × ${factor}` })),
      total: { actual: totA, supuesto: totS, delta: totD, aFmt: _f(totA), sFmt: _f(totS), dFmt: _f(totD) },
      // 80/20 DEL IMPACTO (para el panel Sentrix · barras + acumulado + bloque) + la lectura estructural
      concentration: { bars, blockCount, blockPct, n: nEnt, concentrated, single, impactTotal: impTot, impactTotalFmt: _f(_absTotD) },
      structural: { reading: _reading, risk: _riskT, action: _actionT, concentrated, blockCount, blockPct, plural: _plural },
      // VEREDICTO DE CALIDAD (B) · cruza el bloque 80% con margen/rotación vs promedio interno + benchmark declarado
      quality_verdict: quality },
  };
}

/* ── composeFollowupRecommendation · FOLLOW-UP EJECUTIVO sobre la última evidencia (owner 2026-07-06) ─────────────────
 * "dime qué hacemos" DESPUÉS de una simulación → recomendación desde la última evidence.transform (NO re-parsea eje/métrica).
 * Determinística · reusa las cifras/estructura ya computadas (pct + bloque 80/20) · misma boleta estructural (guard duro:
 * no inventa, no enumera, no lenguaje de escenario). Decisión primero → por qué → condición → siguiente paso. */
export function composeFollowupRecommendation(evidence) {
  if (!evidence || !evidence.transform || evidence.transform.op !== "delta") return null;
  const t = evidence.transform, st = evidence.structural || {}, con = evidence.concentration || {};
  const pct = t.value, sgn = pct >= 0 ? "+" : "";
  const metric = evidence.metrica, mLabel = String(evidence.metricLabel || metric || "").toLowerCase();
  const plural = st.plural || con.plural || `${evidence.dimLabel || "entidades"}`;
  const blockCount = con.blockCount || st.blockCount || 0, blockPct = con.blockPct || st.blockPct || 0;
  const concentrated = con.concentrated != null ? con.concentrated : !!st.concentrated;
  const _fem = new Set(["marca", "familia", "bodega"]).has(evidence.dimension);
  const _esos = _fem ? "esas" : "esos";
  const crosses = metric === "capital" ? "DOH, rotación y bodega"
    : metric === "contribucion" ? "margen, participación y costo"
    : "margen, contribución y carga comercial";
  const cond = metric === "capital" ? "Si ese capital rota sano, conviene liberarlo; si es stock lento, primero destrabar la rotación."
    : metric === "contribucion" ? "Si ese bloque sostiene su margen, priorizar ahí; si no, revisar precio y costo antes de escalar."
    : "Si ese bloque captura margen, priorizar crecimiento ahí; si solo suma volumen, corregir condiciones, costo o carga comercial antes de vender más.";
  const lead = concentrated
    ? `No empujaría el ${sgn}${pct}% a toda la cartera a ciegas. El impacto se concentra: ${blockCount} ${plural} explican el ${blockPct}%, así que la acción es revisar ese bloque antes de activar crecimiento general.`
    : `No empujaría el ${sgn}${pct}% a ciegas. El impacto está repartido, así que la acción es validar dónde el ${mLabel} es rentable antes de activarlo.`;
  const next = concentrated
    ? `El siguiente paso es cruzar ${_esos} ${blockCount} ${plural} contra ${crosses}.`
    : `El siguiente paso es cruzar el ${mLabel} contra ${crosses} y ver dónde conviene empujar.`;
  const opener = `${lead} ${cond} ${next}`;

  const _ctx = `recomendación sobre supuesto ${mLabel} ${sgn}${pct}%`;
  const bol = [];
  bol.push(fig("Supuesto %", `${Math.abs(pct)}%`, { unit: "pct", raw: Math.abs(pct), context: _ctx, source: "computed", formula: "supuesto aplicado sobre el dato real" }));
  if (concentrated) bol.push(fig("Concentración · bloque", `${blockPct}%`, { unit: "pct", raw: blockPct, mandatory: true, context: _ctx, source: "computed", formula: `${blockCount} ${plural} acumulan el ${blockPct}%` }));
  return {
    text: opener, suggestions: null, sentrixAction: null,   // `text` (shape finalizado que consume la UI · NO `opener`)
    // followup:true → narrate usa el prompt de RECOMENDACIÓN · transform → guard scoped (scrub escenario) · SIN projection/lens
    // (no reabre panel ni muestra botón) · SIN cifras por entidad (enumeración imposible). Lleva structural+concentration
    // para que un explain/meta encadenado siga teniendo el porqué a mano.
    evidence: { followup: true, transform: t, boleta: bol, metrica: metric, metricLabel: evidence.metricLabel, dimLabel: evidence.dimLabel, dimension: evidence.dimension, structural: st, concentration: con },
    route: "followup_recommendation",
  };
}

/* ── buildResumenEjecutivo · la LECTURA del negocio para el INICIO (KPIs + una línea) · data-driven, reusa el diagnose ──
 * KPIs de contexto (ventas/margen/contribución/capital) del dato del escenario + una LECTURA generada de los focos del
 * diagnose (el MISMO motor). Todo se recalcula cuando cambia el dato/escenario. NADA hardcodeado, NADA de texto fijo. */
export function buildResumenEjecutivo(scenario) {
  const cv = _load("clientesVentas", scenario), cm = _load("clientesMargen", scenario), inv = _load("skuInventario", scenario);
  const _sum = (arr, f) => arr.reduce((s, r) => s + (typeof r[f] === "number" ? r[f] : 0), 0);
  const ventasK = _sum(cv, "actual"), ventaBaseK = _sum(cm, "venta"), contribK = _sum(cm, "contribucion"), capital = _sum(inv, "stockUSD");
  const margenProm = ventaBaseK ? (contribK / ventaBaseK) * 100 : 0;
  const kpis = [
    { label: "Ventas del período",    value: _money(ventasK * 1000) },
    { label: "Margen promedio",       value: `${margenProm.toFixed(1)}%` },
    { label: "Contribución",          value: _money(contribK * 1000) },
    { label: "Capital en inventario", value: _money(capital) },
  ];
  // LECTURA: sale de los focos del diagnose (mismo motor · data-driven) · si no hay fugas materiales, lo dice honesto
  const diag = composeSpecDiagnose({ filters: {}, scenario });
  let lectura = "Todo lo que veo está sobre su benchmark y con el capital rotando — sin fugas materiales por ahora.";
  const F = diag && diag.evidence && diag.evidence.findings;
  // APERTURA PROACTIVA (asesor · Frente A.3): los focos también salen ESTRUCTURADOS (detector + $ + entidad) para que el
  // hero los vuelva BOTONES de arranque ("¿por cuál empezamos?") — mismos subtotales del diagnose (una verdad, cero recalculo).
  const focos = [];
  if (F && F.length) {
    const by = (d) => F.find((x) => x.detector === d);
    const mg = by("margen"), cg = by("carga"), cap = by("capital"), parts = [];
    if (mg && mg.items[0]) { parts.push(`${_money(mg.subtotal_usd)} de contribución no capturada vs benchmark (arrancá por ${mg.items[0].entidad})`); focos.push({ detector: "margen", usd: mg.subtotal_usd, usdFmt: _money(mg.subtotal_usd), label: "sobre la mesa en margen", entidad: mg.items[0].entidad }); }
    if (cg) { parts.push(`${_money(cg.subtotal_usd)} recuperable en carga comercial`); focos.push({ detector: "carga", usd: cg.subtotal_usd, usdFmt: _money(cg.subtotal_usd), label: "recuperable en carga", entidad: cg.items[0] && cg.items[0].entidad }); }
    if (cap) { parts.push(`${_money(cap.subtotal_usd)} de capital dormido en ${cap.items.length} SKU`); focos.push({ detector: "capital", usd: cap.subtotal_usd, usdFmt: _money(cap.subtotal_usd), label: `dormido en ${cap.items.length} SKU`, entidad: null }); }
    lectura = `${F.length} ${F.length === 1 ? "foco" : "focos"} donde se te va o inmoviliza plata: ${parts.join(" · ")}. ¿Por cuál empezamos?`;
  }
  return { kpis, lectura, focos };
}
