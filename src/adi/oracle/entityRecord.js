/* === src/adi/oracle/entityRecord.js · ARQUITECTURA C · LA FILA COMPLETA (owner "el Excel completo") ===
 * Devuelve TODAS las columnas reales de UNA entidad (cliente/SKU/marca/familia) del dato, cada una con su unidad
 * correcta — no un menú recortado de métricas. El LLM lee la columna que necesita y, si un valor no viene, lo calcula
 * (como Claude leyendo el Excel). Es "el motor le entrega la sábana completa". Cada columna-cifra va a la boleta
 * (autorizada) → el guard sigue garantizando que no invente. Multiempresa-safe: lee las fachadas live-binding.
 */
import { clientesMargen, clientesVentas, marcasMargen, marcasVentas, sfamiliasMargen, sfamiliasVentas, skuInventario } from "../../data/demoData.js";
import { skusMargen } from "../../data/skusMargen.js";
import { applyScenarioToClientesMargen } from "../../engine/scenarios.js";
import { fig } from "../boleta.js";

const _money = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };

// META de cada columna real: etiqueta clara (que NO se pise con otra) + unidad + escala ($ en miles K vs crudo).
// text = no es cifra (contexto). Si una columna no está acá, se ignora (no rompe).
const F = {
  // $ en MILES (comercial): el valor guardado × 1000 = dólares
  venta: { l: "Ventas", u: "money", k: true }, actual: { l: "Ventas", u: "money", k: true }, anterior: { l: "Ventas año anterior", u: "money", k: true },
  presupuesto: { l: "Presupuesto de ventas", u: "money", k: true }, contribucion: { l: "Contribución", u: "money", k: true },
  costo: { l: "Costo", u: "money", k: true }, rebates: { l: "Rebate (monto $)", u: "money", k: true },
  // $ CRUDO (precios unitarios, valor de stock)
  stockUSD: { l: "Valor de inventario", u: "money" }, precioLista: { l: "Precio de lista", u: "money" }, costoMedio: { l: "Costo medio unitario", u: "money" },
  // porcentajes
  margen: { l: "Margen", u: "pct" }, margenPct: { l: "Margen", u: "pct" }, pctRebate: { l: "Rebate (%)", u: "pct" }, benchmark: { l: "Benchmark de margen", u: "pct" }, pctInv: { l: "% del inventario total", u: "pct" },
  // ratio / días
  rotacion: { l: "Rotación", u: "ratio" }, doh: { l: "Cobertura (DOH)", u: "days" }, cobertura: { l: "Cobertura", u: "days" }, diasSinVenta: { l: "Días sin venta", u: "days" },
  // CONTEOS (unidades)
  stockUnd: { l: "Unidades en stock", u: "count" }, unidades: { l: "Unidades vendidas", u: "count" }, unidadesAnt: { l: "Unidades vendidas año anterior", u: "count" }, vendidoMes: { l: "Unidades vendidas en el mes", u: "count" }, ventaDiaria: { l: "Venta diaria (unidades)", u: "count" },
  // texto / contexto (no es cifra)
  nombre: { l: "Nombre", u: "text" }, sku: { l: "SKU", u: "text" }, bodega: { l: "Bodega", u: "text" }, marca: { l: "Marca", u: "text" }, sfamilia: { l: "Familia", u: "text" }, canal: { l: "Canal", u: "text" }, estado: { l: "Estado", u: "text" }, alerta: { l: "Alerta", u: "text" }, tipo: { l: "Tipo", u: "text" },
};

const _fmt = (m, v) => m.u === "money" ? _money(m.k ? v * 1000 : v) : m.u === "pct" ? `${v}%` : m.u === "ratio" ? `${(+v).toFixed(1)}x` : m.u === "days" ? `${Math.round(v)}d` : String(v);

// fuentes por dimensión (fachadas live-binding · multiempresa). Cada fuente trae su PROPIO keyField: skuInventario
// identifica el SKU por `sku`, pero skusMargen lo identifica por `nombre` (bug corregido: antes se perdían las
// columnas comerciales del SKU — costoMedio, precioLista, margen, contribución — por filtrar todo por `sku`).
function _sources(dimension) {
  const A = (x) => (Array.isArray(x) ? x : []);
  switch (dimension) {
    case "sku": return [{ rows: A(skuInventario), key: "sku" }, { rows: A(skusMargen), key: "nombre" }];
    // cliente: `venta` viene reconciliada contra clientesVentas.actual (owner 2026-07-29, D8 — una sola verdad de
    // venta por cliente), NO el import crudo de clientesMargen. margen/costo/contribución quedan tal cual clientesMargen.
    case "cliente": return [{ rows: A(applyScenarioToClientesMargen("actual")), key: "nombre" }, { rows: A(clientesVentas), key: "nombre" }];
    case "marca": return [{ rows: A(marcasMargen), key: "nombre" }, { rows: A(marcasVentas), key: "nombre" }];
    case "familia": return [{ rows: A(sfamiliasMargen), key: "nombre" }, { rows: A(sfamiliasVentas), key: "nombre" }];
    default: return null;
  }
}

// MÉTRICAS DERIVADAS que calcula el MOTOR (exactas, sin trampa de escala — owner 2026-07-28: "los cálculos estándar
// los hace el motor, no el LLM"). Se computan sobre el registro CRUDO y se agregan como columnas más.
//   · Precio medio de venta = venta / unidades  (venta está en miles → ×1000 para $ por unidad crudo)
//   · Costo medio de venta  = costo / unidades   (ídem)  [costoMedio, si viene, es el ponderado ya calculado]
//   · Margen de contribución = contribución / venta × 100  (misma escala → % limpio)
// venta/costo y precio/costo unitario van EN LA MISMA escala en el dato (venta/unidades == precioLista, costo/unidades
// == costoMedio) → el precio/costo medio se computa SIN ×1000 para coincidir con esas columnas ancla. El margen de
// contribución es un RATIO (misma escala arriba y abajo) → limpio siempre.
function _derived(rec) {
  const out = [];
  const num = (k) => (typeof rec[k] === "number" && Number.isFinite(rec[k]) ? rec[k] : null);
  const venta = num("venta"), unidades = num("unidades"), costo = num("costo"), contrib = num("contribucion");
  if (num("precioLista") == null && venta != null && unidades && unidades > 0) out.push({ label: "Precio medio de venta", value: +(venta / unidades).toFixed(1), unit: "money" });
  if (num("costoMedio") == null && costo != null && unidades && unidades > 0) out.push({ label: "Costo medio de venta", value: +(costo / unidades).toFixed(1), unit: "money" });
  if (contrib != null && venta && venta > 0) out.push({ label: "Margen de contribución", value: +((contrib / venta) * 100).toFixed(1), unit: "pct" });
  return out;
}

// _rawRecord(dimension, entity) → el registro CRUDO mergeado (todas las columnas) | null
// `actual` (clientesVentas/marcasVentas/sfamiliasVentas) es ALIAS de `venta` (mismo label "Ventas" en F) — se
// omite si `venta` ya llegó de la fuente Margen (siempre primera en _sources) para no emitir un fig() duplicado
// con el mismo label y (antes del fix D8) valores distintos — hallazgo real: los 2 sobrevivían en el boleta array,
// autorizando cualquiera de los dos números a la narración.
function _rawRecord(dimension, entity) {
  const srcs = _sources(dimension);
  if (!srcs || entity == null) return null;
  const rec = {};
  for (const s of srcs) for (const r of s.rows) if (r && String(r[s.key]) === String(entity)) for (const k of Object.keys(r)) {
    if (k === "actual" && rec.venta != null) continue;
    if (rec[k] == null) rec[k] = r[k];
  }
  return Object.keys(rec).length ? rec : null;
}

// _formatRecord(entity, rec) → { facts, boleta } · formatea cada columna (cruda + derivada) con su unidad.
function _formatRecord(entity, rec) {
  const facts = { entidad: entity };
  const boleta = [];
  const add = (label, val, unit) => { facts[label] = val; boleta.push(fig(`${entity} · ${label}`, val, { unit })); };
  for (const [k, v] of Object.entries(rec)) {
    const m = F[k]; if (!m) continue;
    if (m.u === "text") { if (v != null && v !== "") facts[m.l] = v; continue; }
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    add(m.l, _fmt(m, v), m.u);
  }
  for (const d of _derived(rec)) if (facts[d.label] == null) add(d.label, _fmt({ u: d.unit, k: false }, d.value), d.unit);
  return { facts, boleta };
}

// todas las entidades de una dimensión (para la grilla / ranking)
function _allEntities(dimension) {
  const srcs = _sources(dimension); if (!srcs) return [];
  const seen = new Set(); const out = [];
  for (const s of srcs) for (const r of s.rows) { const id = r && r[s.key]; if (id != null && !seen.has(String(id))) { seen.add(String(id)); out.push(String(id)); } }
  return out;
}

// guessDimension(entity) → "sku"|"cliente"|"marca"|"familia"|null · a qué eje pertenece un NOMBRE, cuando el plan
// solo tiene el nombre (ej. `trend` con `entity` pero sin `dimension`) — para que la evidencia sepa qué cuadro abrir
// aun cuando la tool DECLINA (no hay serie mensual de esa métrica, pero SÍ sabemos que se hablaba de esa entidad).
export function guessDimension(entity) {
  if (entity == null) return null;
  for (const dim of ["sku", "cliente", "marca", "familia"]) {
    const srcs = _sources(dim);
    for (const s of srcs) if (s.rows.some((r) => r && String(r[s.key]) === String(entity))) return dim;
  }
  return null;
}

// buildEntityRecord(dimension, entity) → { facts, boleta } | null
export function buildEntityRecord(dimension, entity) {
  const rec = _rawRecord(dimension, entity);
  if (!rec) return null;
  const r = _formatRecord(entity, rec);
  r.facts.entityType = dimension;
  return r;
}

// axisHasField(dimension, field) → true si ALGUNA fuente de ese eje trae esa columna numérica (turno 14 del
// veredicto de 18 turnos: base de buildTension — determina qué cruces existen REALMENTE en el dato).
export function axisHasField(dimension, field) {
  const srcs = _sources(dimension);
  if (!srcs) return false;
  return srcs.some((s) => s.rows.some((r) => r && typeof r[field] === "number"));
}

// buildTension(dimension, {metricA, metricB, limit}) → { facts, boleta } | { unsupported: razón } | null
// TENSIÓN "quién sostiene vs quién consume" (turno 14 del veredicto de 18 turnos, owner 2026-07-29): antes, pedir
// esto disparaba 2 tool-calls de EJES DISTINTOS (contribución por cliente + capital por SKU) que el narrador
// mezclaba sin declarar el mismatch de eje (guardC lo cazaba a veces como total-mal-atribuido, otras veces pasaba
// con una atribución falsa en prosa). Acá se cruzan DOS MÉTRICAS DEL MISMO EJE sobre las MISMAS entidades —
// top-N por metricA y por metricB YA CALCULADOS + su intersección — el narrador no arma el cruce a mano, lo recibe
// resuelto y autorizado. Si el eje no tiene AMBAS columnas (hoy: cliente/marca/familia no tienen capital/inventario
// — no hay tabla puente eje↔SKU en el dato), degrada HONESTO con la razón exacta vía `unsupported`.
export function buildTension(dimension, { metricA = "contribucion", metricB = "stockUSD", limit = 10, dirA = "desc", dirB = "desc" } = {}) {
  const hasA = axisHasField(dimension, metricA), hasB = axisHasField(dimension, metricB);
  const lblA = (F[metricA] && F[metricA].l) || metricA, lblB = (F[metricB] && F[metricB].l) || metricB;
  if (!hasA || !hasB) {
    const falta = !hasA && !hasB ? `${lblA} ni ${lblB}` : !hasA ? lblA : lblB;
    return { unsupported: `${lblA} y ${lblB} no se miden juntas por ${dimension} — falta ${falta} en ese eje (no hay tabla puente ${dimension}↔SKU en el dato).` };
  }
  const ents = _allEntities(dimension); if (!ents.length) return null;
  const recs = ents.map((e) => ({ e, rec: _rawRecord(dimension, e) }))
    .filter((x) => x.rec && typeof x.rec[metricA] === "number" && typeof x.rec[metricB] === "number");
  if (recs.length < 2) return null;
  // DIRECCIÓN por métrica (owner 2026-07-29, hallazgo en vivo): "quién CEDE más margen" pide el margen más BAJO
  // primero (el que peor está, no el mejor) — antes siempre ordenaba descendente (mayor primero) sin importar el
  // verbo, así que "cede más margen" mostraba a los de MEJOR margen, lo opuesto de lo pedido. dirA/dirB="asc" invierte.
  const sA = dirA === "asc" ? 1 : -1, sB = dirB === "asc" ? 1 : -1;
  const byA = recs.slice().sort((a, b) => sA * (a.rec[metricA] - b.rec[metricA]));
  const byB = recs.slice().sort((a, b) => sB * (a.rec[metricB] - b.rec[metricB]));
  const topA = byA.slice(0, limit), topB = byB.slice(0, limit);
  const setTopB = new Set(topB.map((x) => x.e)), setTopA = new Set(topA.map((x) => x.e));
  const mA = F[metricA] || { l: metricA, u: "money" }, mB = F[metricB] || { l: metricB, u: "money" };
  const facts = {
    metricA: lblA, metricB: lblB, dimension,
    topA: topA.map((x) => ({ nombre: x.e, valor: _fmt(mA, x.rec[metricA]) })),
    topB: topB.map((x) => ({ nombre: x.e, valor: _fmt(mB, x.rec[metricB]) })),
    enAmbosRankings: topA.filter((x) => setTopB.has(x.e)).map((x) => x.e),
    soloTopA: topA.filter((x) => !setTopB.has(x.e)).map((x) => x.e),
    soloTopB: topB.filter((x) => !setTopA.has(x.e)).map((x) => x.e),
  };
  const boleta = [];
  const seen = new Set();
  const addFig = (x, m, metric) => { const key = `${x.e}·${metric}`; if (seen.has(key)) return; seen.add(key); boleta.push(fig(`${x.e} · ${m.l}`, _fmt(m, x.rec[metric]), { unit: m.u })); };
  for (const x of topA) addFig(x, mA, metricA);
  for (const x of topB) addFig(x, mB, metricB);
  return { facts, boleta };
}

// buildGrid(dimension, {sortBy, dir, limit}) → { facts:{rows, sortBy, dimension}, boleta } | null
// LA GRILLA: top-N entidades × TODAS sus columnas (el motor arma la tabla junta y exacta; el LLM elige qué columnas
// mostrar). sortBy = campo crudo por el que rankear (venta/contribucion/stockUSD/rotacion/margen…) o su etiqueta.
const _LABEL2FIELD = Object.fromEntries(Object.entries(F).map(([k, m]) => [m.l.toLowerCase(), k]));
export function buildGrid(dimension, { sortBy = null, dir = "desc", limit = 20 } = {}) {
  const ents = _allEntities(dimension); if (!ents.length) return null;
  const field = (sortBy && (F[sortBy] ? sortBy : _LABEL2FIELD[String(sortBy).toLowerCase()])) || (F["venta"] ? "venta" : (F["contribucion"] ? "contribucion" : "stockUSD"));
  const recs = ents.map((e) => ({ e, rec: _rawRecord(dimension, e) })).filter((x) => x.rec);
  recs.sort((a, b) => { const av = a.rec[field], bv = b.rec[field]; const an = typeof av === "number" ? av : -Infinity, bn = typeof bv === "number" ? bv : -Infinity; return dir === "asc" ? an - bn : bn - an; });
  const top = recs.slice(0, Math.max(1, limit));
  const rows = []; const boleta = [];
  for (const { e, rec } of top) { const fr = _formatRecord(e, rec); rows.push(fr.facts); for (const f of fr.boleta) boleta.push(f); }
  return { facts: { dimension, sortBy: field, count: rows.length, rows }, boleta };
}
