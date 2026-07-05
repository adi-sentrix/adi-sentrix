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
