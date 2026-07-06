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

// acota el barrido a una marca/familia/bodega/cliente (los `filters` del spec)
function _scopeRows(rows, filters) {
  if (filters.marca)   rows = rows.filter((r) => r.marca === filters.marca);
  if (filters.familia) rows = rows.filter((r) => r.sfamilia === filters.familia);
  if (filters.bodega)  rows = rows.filter((r) => r.bodega === filters.bodega);
  if (filters.cliente) rows = rows.filter((r) => r.nombre === filters.cliente);
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
 * "¿dónde está mi capital inmovilizado, qué bodegas, qué SKU?" → responde CAPITAL, no el diagnóstico genérico.
 * Estructura por PARTES: lectura (total + bodega principal) → por bodega → por SKU → por qué (rotación/DOH) → qué hacer.
 * Def de dormido = la del diagnose (POLICY · rotación<rotacionMin ó doh>dohMax) → UNA verdad. Data-driven de skuInventario;
 * la evidencia (inventory: total/byBodega/bySku) alimenta el panel de inventario de Sentrix. null → el seam degrada honesto. */
export function composeSpecInventory({ filters = {}, scenario } = {}) {
  const kSF = _sf("capital", "sku"), rSF = _sf("rotacion", "sku"), dSF = _sf("doh", "sku");
  if (!kSF || !rSF || !dSF) return null;
  const rows = _scopeRows(_load(kSF.source, scenario), filters);
  if (!rows.length) return null;
  const key = (SOURCES[kSF.source] && SOURCES[kSF.source].keyField) || "sku";
  const dormant = [];
  for (const r of rows) {
    const cap = r[kSF.field], rot = r[rSF.field], doh = r[dSF.field];
    if (typeof cap !== "number") continue;
    const isDorm = (typeof rot === "number" && rot < POLICY.rotacionMin) || (typeof doh === "number" && doh > POLICY.dohMax);
    if (!isDorm) continue;
    dormant.push({ sku: r[key], usd: cap, doh, rotacion: rot, bodega: r.bodega || "—", diasSinVenta: r.diasSinVenta, critico: r.alerta === "crit" });
  }
  if (!dormant.length) return null;
  dormant.sort((a, b) => b.usd - a.usd);
  const total = dormant.reduce((s, r) => s + r.usd, 0);
  const bMap = {};
  for (const r of dormant) bMap[r.bodega] = (bMap[r.bodega] || 0) + r.usd;
  const byBodega = Object.entries(bMap).map(([bodega, usd]) => ({ bodega, usd, pct: Math.round(usd / total * 100) })).sort((a, b) => b.usd - a.usd);
  const topB = byBodega[0], crit = dormant.filter((r) => r.critico);
  // TEXTO por partes — la pregunta (capital) manda el foco
  const L1 = `Tenés ${_money(total)} de capital inmovilizado en ${dormant.length} SKU sin rotar. Se concentra en ${topB.bodega} (${_money(topB.usd)}, ${topB.pct}%).`;
  const L2 = `Por bodega: ${byBodega.map((b) => `${b.bodega} ${_money(b.usd)}`).join(" · ")}.`;
  const L3 = `Los SKU que lo explican: ${dormant.slice(0, 4).map((r) => `${r.sku} ${_money(r.usd)} (${r.doh}d DOH, rotación ${r.rotacion}x)`).join(" · ")}.`;
  const L4 = `**Por qué:** dejaron de rotar — rotación bajo ${POLICY.rotacionMin}x o DOH sobre ${POLICY.dohMax}d. Es stock que no sale y te atrapa la plata.`;
  const topCrit = crit.slice(0, 2).map((r) => r.sku);
  const L5 = `**Qué hacer:** arrancá por ${topCrit.length ? topCrit.join(" y ") : dormant[0].sku} (los más frenados) — liquidación o reasignación libera esa plata para SKU que sí rotan; después revisá la reposición para no repetirlo.`;
  const _ctx = "capital inmovilizado";
  const bol = [fig("Capital inmovilizado · total", _money(total), { unit: "money", raw: total, mandatory: true, context: _ctx })];
  for (const b of byBodega) bol.push(fig(`Bodega · ${b.bodega}`, _money(b.usd), { unit: "money", raw: b.usd, mandatory: false, context: _ctx }));
  for (const r of dormant.slice(0, 4)) bol.push(fig(`SKU · ${r.sku}`, _money(r.usd), { unit: "money", raw: r.usd, mandatory: false, context: _ctx }));
  return {
    opener: `${L1}\n\n${L2}\n\n${L3}\n\n${L4}\n\n${L5}`,
    suggestions: ["Por qué el capital está dormido", "Qué SKU libero primero"],
    sentrixAction: null,
    evidence: { lens: "inventory", metrica: "capital", dimension: "bodega", boleta: bol,
      inventory: { total, byBodega, bySku: dormant.map((r) => ({ sku: r.sku, usd: r.usd, doh: r.doh, rotacion: r.rotacion, bodega: r.bodega, critico: r.critico })) } },
  };
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
  if (filters.marca)   rows = rows.filter((r) => r.marca === filters.marca);
  if (filters.familia) rows = rows.filter((r) => r.sfamilia === filters.familia);
  if (filters.bodega)  rows = rows.filter((r) => r.bodega === filters.bodega);
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
  if (F && F.length) {
    const by = (d) => F.find((x) => x.detector === d);
    const mg = by("margen"), cg = by("carga"), cap = by("capital"), parts = [];
    if (mg && mg.items[0]) parts.push(`${_money(mg.subtotal_usd)} de contribución no capturada vs benchmark (arrancá por ${mg.items[0].entidad})`);
    if (cg) parts.push(`${_money(cg.subtotal_usd)} recuperable en carga comercial`);
    if (cap) parts.push(`${_money(cap.subtotal_usd)} de capital dormido en ${cap.items.length} SKU`);
    lectura = `${F.length} ${F.length === 1 ? "foco" : "focos"} donde se te va o inmoviliza plata: ${parts.join(" · ")}.`;
  }
  return { kpis, lectura };
}
