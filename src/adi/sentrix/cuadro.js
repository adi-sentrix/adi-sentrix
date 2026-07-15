/* === adi/sentrix/cuadro.js · Etapa 5 · Sentrix · CUADRO DE MANDO (4ª lente) · la grilla operable ===
 * El cockpit: TODAS las entidades de una dimensión (clientes/SKU/marcas/bodegas) × columnas del catálogo, para VER
 * y MANEJAR el dato (ordenar, filtrar, top-N, seleccionar y comparar). NO es un BI-volcado: solo columnas que el
 * dato sostiene, fila PROMEDIO de referencia (la ley de las lentes), acción DERIVADA, alerta honesta. Scenario-aware
 * (el "periodo"). Serie temporal por-entidad NO existe (sintética) → "global/actual" es real; el corte por fecha
 * fina por-entidad es el límite honesto (se enciende con el ERP). Puro · client-side · el panel solo renderiza. */
import { applyScenarioToClientesVentas, applyScenarioToClientesMargen, applyScenarioToMarcasVentas, applyScenarioToSkuInventario } from "../../engine/scenarios.js";
import { skusMargen } from "../../data/skusMargen.js";
import { marcasMargen } from "../../data/demoData.js";   // margen/contribución/rebates de MARCA (la grilla mostraba 0.0% — bug cazado 2026-07-10)
import { POLICY, benchmarkOf } from "../../config/businessPolicy.js";   // Mesa 2.0 · el semáforo de cada fila contra TU vara (criterio C.2 del owner manda)

const _r1 = (n) => Math.round(n * 10) / 10;
const _sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const _mean = (a, f) => (a.length ? _sum(a, f) / a.length : 0);
const _inmov = (x) => (x.alerta && x.alerta !== "ok") || x.rotacion < 2;
// SEMÁFORO CONTRA TU VARA (Mesa 2.0 · owner 2026-07-14): cada fila con margen trae su estado contra benchmarkOf
// (el criterio C.2 pisa todo) con la MISMA brecha material del detector del diagnose (POLICY.margenBrechaMaterial):
// verde = en o sobre la vara · ámbar = bajo por menos de la brecha · rojo = la brecha completa. El "vs prom" (gap
// contra el promedio interno) queda intacto — son dos comparaciones distintas y las dos valen.
const _vara = (margen, row) => {
  const ref = benchmarkOf(row), gap = _r1((margen || 0) - ref);
  return { varaRef: ref, varaGap: gap, vara: gap >= 0 ? "verde" : gap > -POLICY.margenBrechaMaterial ? "ambar" : "rojo" };
};

export const CUADRO_DIMS = [
  { key: "cliente", label: "Clientes", plural: "clientes" },
  { key: "sku",     label: "SKU",      plural: "SKUs" },
  { key: "marca",   label: "Marcas",   plural: "marcas" },
  { key: "bodega",  label: "Bodegas",  plural: "bodegas" },
];

// columnas por dimensión · fmt: money($K→$M) / moneyk($→$K) / pct / x / pp / int · sortDir: "desc"=más arriba mejor-o-mayor
const COLS = {
  cliente: [
    { key: "ventas", label: "Ventas", fmt: "money", sort: "desc" },
    { key: "unidades", label: "Unidades", fmt: "int", sort: "desc" },
    { key: "acciones", label: "Acciones de precios", fmt: "money", sort: "asc" },   // rebates/descuentos ($) · menos = mejor
    { key: "contribucion", label: "Contribución", fmt: "money", sort: "desc" },
    { key: "margen", label: "Margen", fmt: "pct", sort: "desc", tone: "margen" },
    { key: "gap", label: "vs prom", fmt: "pp", sort: "desc", tone: "gap" },
    { key: "accion", label: "Acción", fmt: "accion" },
  ],
  bodega: [
    { key: "capital", label: "Capital", fmt: "moneyk", sort: "desc" },
    { key: "inmovilizado", label: "Inmovilizado", fmt: "moneyk", sort: "asc", tone: "inmov" },
    { key: "inmovPct", label: "% inmov.", fmt: "pct", sort: "asc", tone: "inmov" },
    { key: "rotacion", label: "Rotación", fmt: "x", sort: "desc" },
    { key: "gap", label: "vs prom", fmt: "pp", sort: "desc", tone: "gap" },
    { key: "accion", label: "Acción", fmt: "accion" },
  ],
  sku: [
    { key: "margen", label: "Margen", fmt: "pct", sort: "desc", tone: "margen" },
    { key: "capital", label: "Capital", fmt: "moneyk", sort: "desc" },
    { key: "rotacion", label: "Rotación", fmt: "x", sort: "desc" },
    { key: "gap", label: "vs prom", fmt: "pp", sort: "desc", tone: "gap" },
    { key: "accion", label: "Acción", fmt: "accion" },
  ],
  marca: [
    // fmt "money" (el dato viene en $K → $M, igual que clientes) — el "moneyk" pintaba $33.2K donde son $33.2M
    { key: "ventas", label: "Ventas", fmt: "money", sort: "desc" },
    { key: "acciones", label: "Acciones de precios", fmt: "money", sort: "asc" },
    { key: "contribucion", label: "Contribución", fmt: "money", sort: "desc" },
    { key: "margen", label: "Margen", fmt: "pct", sort: "desc", tone: "margen" },
    { key: "gap", label: "vs prom", fmt: "pp", sort: "desc", tone: "gap" },
    { key: "accion", label: "Acción", fmt: "accion" },
  ],
};

function _clientes(s) {
  const M = applyScenarioToClientesMargen(s) || [];
  const V = applyScenarioToClientesVentas(s) || [];
  const avgM = _mean(M, (c) => c.margen), avgCarga = _mean(M, (c) => c.pctRebate);
  const rows = M.map((c) => {
    const cv = V.find((v) => v.nombre === c.nombre);
    const gap = _r1(c.margen - avgM);
    const carga = _r1(c.pctRebate);
    const costoPct = 100 - c.margen - carga;
    // "En alerta" = ROJO contra TU vara (PASE 2 · antes benchmark−6 literal, ajeno al criterio C.2): una verdad con
    // el chevron y con los items del detector de margen del diagnose — el bloque "En alerta" de la Mesa cuenta lo mismo.
    const va = _vara(c.margen, c);
    const accion = gap <= -3 ? (costoPct > 100 - avgM - avgCarga ? "revisar costo" : "renegociar carga")
      : gap >= 3 ? "referencia" : "sostener";
    return { name: c.nombre, ventas: cv ? cv.actual : c.venta, unidades: c.unidades, acciones: c.rebates, margen: c.margen, contribucion: c.contribucion, carga, gap, accion, alert: va.vara === "rojo", ...va };
  });
  const tV = _sum(rows, (r) => r.ventas), tC = _sum(rows, (r) => r.contribucion);
  const total = { name: "Total", ventas: tV, unidades: _sum(rows, (r) => r.unidades), acciones: _sum(rows, (r) => r.acciones), contribucion: tC, margen: tV ? _r1(tC / tV * 100) : 0, gap: null, accion: "", _total: true };
  return { rows, total, avg: { name: "Promedio", margen: _r1(avgM), carga: _r1(avgCarga), ventas: _mean(rows, (r) => r.ventas), contribucion: _mean(rows, (r) => r.contribucion), gap: 0, accion: "—", _ref: true } };
}

function _bodegas(s) {
  const inv = applyScenarioToSkuInventario(s) || [];
  const names = [...new Set(inv.map((x) => x.bodega))];
  const stat = (b) => {
    const r = inv.filter((x) => x.bodega === b);
    const capital = r.reduce((a, x) => a + x.stockUSD, 0);
    const inmovilizado = r.filter(_inmov).reduce((a, x) => a + x.stockUSD, 0);
    return { name: b, capital, inmovilizado, inmovPct: capital ? _r1(inmovilizado / capital * 100) : 0, rotacion: _r1(_mean(r, (x) => x.rotacion)), alertCount: r.filter((x) => x.alerta === "crit").length };
  };
  const all = names.map(stat);
  const avgInmovPct = _mean(all, (x) => x.inmovPct);
  const rows = all.map((x) => {
    const gap = _r1(avgInmovPct - x.inmovPct);   // + = menos inmov = mejor
    const accion = x.inmovPct >= avgInmovPct + 8 ? "liquidar lento" : x.rotacion < 4 ? "acelerar rotación" : "sostener";
    return { ...x, gap, accion, alert: x.alertCount > 0 };
  });
  const tCap = _sum(all, (x) => x.capital), tInm = _sum(all, (x) => x.inmovilizado);
  const total = { name: "Total", capital: tCap, inmovilizado: tInm, inmovPct: tCap ? _r1(tInm / tCap * 100) : 0, rotacion: _r1(_mean(all, (x) => x.rotacion)), gap: null, accion: "", _total: true };
  return { rows, total, avg: { name: "Promedio", capital: _mean(all, (x) => x.capital), inmovilizado: _mean(all, (x) => x.inmovilizado), inmovPct: _r1(avgInmovPct), rotacion: _r1(_mean(all, (x) => x.rotacion)), gap: 0, accion: "—", _ref: true } };
}

function _skus(s) {
  const inv = applyScenarioToSkuInventario(s) || [];
  const avgM = _mean(skusMargen, (x) => x.margen);
  const rows = skusMargen.map((x) => {
    const i = inv.find((y) => y.sku === x.nombre) || {};
    const gap = _r1(x.margen - avgM);
    const accion = (i.rotacion != null && i.rotacion < 2) ? "stock lento" : gap <= -3 ? "revisar precio" : "sostener";
    return { name: x.nombre, margen: x.margen, capital: i.stockUSD || 0, rotacion: _r1(i.rotacion || 0), gap, accion, alert: i.alerta === "crit", ..._vara(x.margen, x) };
  });
  const total = { name: "Total", margen: _r1(avgM), capital: _sum(rows, (r) => r.capital), rotacion: _r1(_mean(rows, (r) => r.rotacion)), gap: null, accion: "", _total: true };
  return { rows, total, avg: { name: "Promedio", margen: _r1(avgM), capital: _mean(rows, (r) => r.capital), rotacion: _r1(_mean(rows, (r) => r.rotacion)), gap: 0, accion: "—", _ref: true } };
}

function _marcas(s) {
  // JOIN con marcasMargen (una verdad): margen/contribución/rebates viven ahí — antes se leía solo marcasVentas
  // (que no los trae) y la grilla mostraba contribución $0 y margen 0.0% (bug cazado en vivo 2026-07-10).
  const V = applyScenarioToMarcasVentas(s) || [];
  const avgM = _mean(marcasMargen, (x) => x.margen || 0);
  const rows = marcasMargen.map((m) => {
    const v = V.find((x) => x.nombre === m.nombre);
    const gap = _r1((m.margen || 0) - avgM);
    return { name: m.nombre, ventas: v ? v.actual : m.venta, acciones: m.rebates, contribucion: m.contribucion || 0, margen: _r1(m.margen || 0), gap, accion: gap <= -3 ? "revisar mix" : "sostener", alert: false, ..._vara(m.margen, m) };
  });
  const tV = _sum(rows, (r) => r.ventas), tC = _sum(rows, (r) => r.contribucion);
  const total = { name: "Total", ventas: tV, contribucion: tC, margen: tV ? _r1(tC / tV * 100) : _r1(avgM), gap: null, accion: "", _total: true };
  return { rows, total, avg: { name: "Promedio", ventas: _mean(rows, (r) => r.ventas), contribucion: _mean(rows, (r) => r.contribucion), margen: _r1(avgM), gap: 0, accion: "—", _ref: true } };
}

// LA GRILLA de una dimensión: columnas del catálogo + filas (con acción/alerta) + fila promedio de referencia.
export function buildCuadroMando(dimension = "cliente", scenario = "bonanza") {
  const s = scenario || "bonanza";
  const built = dimension === "bodega" ? _bodegas(s) : dimension === "sku" ? _skus(s) : dimension === "marca" ? _marcas(s) : _clientes(s);
  const meta = CUADRO_DIMS.find((d) => d.key === dimension) || CUADRO_DIMS[0];
  return { dimension, label: meta.label, plural: meta.plural, columns: COLS[dimension] || COLS.cliente, rows: built.rows, avg: built.avg, total: built.total, n: built.rows.length };
}
