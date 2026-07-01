/* === adi/sentrix/control.js · Etapa 5 · Sentrix · el CONTROL · la TABLA-RING ===
 * "El ring, nunca una fila sola" (la ley de las lentes · owner): el foco SIEMPRE anclado contra (a) el PROMEDIO,
 * (b) el PAR INSTRUCTIVO (comparación controlada · aísla la palanca) y (c) el MEJOR-EN-CLASE (el objetivo). La
 * mesa de operaciones: qué tocar y cuánto vale. Columnas del catálogo, con la PLATA al frente ("la gente reacciona
 * a la plata" · owner). Genérico: cliente·margen (contribución/carga) ↔ bodega·inventario (capital/inmovilizado/
 * rotación) — MISMO esqueleto, distinto juego de datos. DERIVADO del dato · scenario-aware · puro · testable. */
import { applyScenarioToClientesVentas, applyScenarioToClientesMargen, applyScenarioToSkuInventario } from "../../engine/scenarios.js";
import { buildMarginDecomposition } from "./kpis.js";

const _r1 = (n) => Math.round(n * 10) / 10;
const _inmovilizado = (x) => (x.alerta && x.alerta !== "ok") || x.rotacion < 2;   // def canónica (= tira/Pareto)

// EL MOTOR arma el ring según el foco (LLM-ready) · null si el tipo no se sostiene → el panel cae al placeholder.
export function buildControlRing(focusType, focus, scenario) {
  if (focusType === "client") return _clientRing(focus, scenario);
  if (focusType === "bodega") return _bodegaRing(focus, scenario);
  return null;
}

// ── CLIENTE · margen · la plata = CONTRIBUCIÓN · la palanca = costo/carga ──
// El par que AÍSLA la palanca: mismo valor en el eje NO-palanca (carga si la palanca es costo, y viceversa) pero
// mejor margen → su ventaja se explica por la palanca. Comparación controlada (primitivo de 1ª clase de la ley).
function _instructiveParClient(c, all, dominant) {
  const better = all.filter((x) => x.nombre !== c.nombre && x.margen > c.margen);
  if (!better.length) return null;
  const axis = dominant === "costo" ? "carga" : "costo";
  const valOf = (x) => (axis === "carga" ? x.pctRebate : 100 - x.margen - x.pctRebate);
  const focoAxis = valOf(c);
  return better.slice().sort((a, b) => Math.abs(valOf(a) - focoAxis) - Math.abs(valOf(b) - focoAxis))[0];
}
const _rowClient = (x, role, avgM, note) => ({
  name: x.nombre, role,
  margen: x.margen, carga: _r1(x.pctRebate),
  contribucion: Math.round(x.contribucion),   // la plata (el stake del cliente)
  gap: role === "avg" ? 0 : _r1(x.margen - avgM),
  note: note || null,
});
function _clientRing(focus, scenario) {
  const s = scenario || "bonanza";
  const all = applyScenarioToClientesMargen(s);
  const c = all.find((x) => x.nombre === focus);
  if (!c) return null;
  const avgM = all.reduce((a, x) => a + x.margen, 0) / all.length;
  const avgCarga = all.reduce((a, x) => a + x.pctRebate, 0) / all.length;
  const avgCosto = 100 - avgM - avgCarga;
  const best = all.reduce((m, x) => (x.margen > m.margen ? x : m), all[0]);
  const d = buildMarginDecomposition(focus, s);
  const lever = d ? d.dominant : "carga";
  const leverLabel = lever === "costo" ? "estructura de costo" : "carga comercial";
  const par = _instructiveParClient(c, all, lever);
  const parNote = lever === "costo" ? "≈ misma carga, mejor margen → la palanca es el costo"
                                    : "≈ mismo costo, mejor margen → la palanca es la carga";
  const avgContrib = all.reduce((a, x) => a + (x.contribucion || 0), 0) / all.length;
  const avgRow = { name: "Promedio interno", role: "avg", margen: _r1(avgM), carga: _r1(avgCarga), contribucion: Math.round(avgContrib), gap: 0, note: null };
  const rows = [_rowClient(c, "focus", avgM)];
  if (par && par.nombre !== best.nombre) rows.push(_rowClient(par, "peer", avgM, parNote));
  rows.push(avgRow);
  if (best.nombre !== c.nombre) rows.push(_rowClient(best, "best", avgM, "mejor en clase · el objetivo"));

  const cv = (applyScenarioToClientesVentas(s) || []).find((x) => x.nombre === focus);
  const venta = cv ? cv.actual : c.venta;
  const focoCosto = 100 - c.margen - c.pctRebate;
  const costoTechoK = Math.max(0, Math.round((focoCosto - avgCosto) * venta / 100));

  return {
    entityType: "client", focus, lever, leverLabel, framingVerb: "pierde por",
    columns: [
      { key: "margen",       label: "Margen",       fmt: "pct",   defKey: "Margen" },
      { key: "carga",        label: "Carga",        fmt: "pct",   defKey: "Carga comercial" },
      { key: "contribucion", label: "Contribución", fmt: "money", defKey: "Contribución" },
      { key: "gap",          label: "vs prom",      fmt: "pp",    defKey: "vs promedio" },
    ],
    rows, costoTechoK,
  };
}

// ── BODEGA · inventario · la plata = CAPITAL / INMOVILIZADO · la palanca = rotar el stock lento ──
// El par que AÍSLA la palanca: capital parecido pero MENOS inmovilizado → su ventaja se explica por la rotación/mix.
function _bodegaStats(inv, name) {
  const rows = inv.filter((x) => x.bodega === name);
  if (!rows.length) return null;
  const capital = rows.reduce((a, x) => a + x.stockUSD, 0);
  const inmovCap = rows.filter(_inmovilizado).reduce((a, x) => a + x.stockUSD, 0);
  const critCap = rows.filter((x) => x.alerta === "crit").reduce((a, x) => a + x.stockUSD, 0);
  const rot = rows.reduce((a, x) => a + x.rotacion, 0) / rows.length;
  return { name, capital, inmovCap, critCap, rotacion: rot, inmovPct: capital ? inmovCap / capital * 100 : 0, n: rows.length };
}
const _rowBodega = (x, role, avgInmovPct, note) => ({
  name: x.name, role,
  capital: Math.round(x.capital),
  inmovilizado: Math.round(x.inmovCap),   // la plata ATRAPADA
  rotacion: _r1(x.rotacion),
  gap: role === "avg" ? 0 : _r1(avgInmovPct - x.inmovPct),   // invertido: + = MENOS inmovilizado que el prom = mejor (verde)
  note: note || null,
});
function _bodegaRing(focus, scenario) {
  const s = scenario || "bonanza";
  const inv = applyScenarioToSkuInventario(s) || [];
  const names = [...new Set(inv.map((x) => x.bodega))];
  const all = names.map((n) => _bodegaStats(inv, n)).filter(Boolean);
  const c = all.find((x) => x.name === focus);
  if (!c) return null;
  const avgCap = all.reduce((a, x) => a + x.capital, 0) / all.length;
  const avgInmovCap = all.reduce((a, x) => a + x.inmovCap, 0) / all.length;
  const avgRot = all.reduce((a, x) => a + x.rotacion, 0) / all.length;
  const avgInmovPct = all.reduce((a, x) => a + x.inmovPct, 0) / all.length;
  const best = all.reduce((m, x) => (x.inmovPct < m.inmovPct ? x : m), all[0]);   // el más sano = menos inmovilizado
  const better = all.filter((x) => x.name !== focus && x.inmovPct < c.inmovPct);
  const par = better.length ? better.slice().sort((a, b) => Math.abs(a.capital - c.capital) - Math.abs(b.capital - c.capital))[0] : null;

  const avgRow = { name: "Promedio interno", role: "avg", capital: Math.round(avgCap), inmovilizado: Math.round(avgInmovCap), rotacion: _r1(avgRot), gap: 0, note: null };
  const rows = [_rowBodega(c, "focus", avgInmovPct)];
  if (par && par.name !== best.name) rows.push(_rowBodega(par, "peer", avgInmovPct, "≈ mismo capital, menos inmovilizado → la palanca es rotar el stock lento"));
  rows.push(avgRow);
  if (best.name !== c.name) rows.push(_rowBodega(best, "best", avgInmovPct, "mejor en clase · el objetivo"));

  return {
    entityType: "bodega", focus, lever: "rotación", leverLabel: "stock inmovilizado", framingVerb: "traba plata en",
    columns: [
      { key: "capital",      label: "Capital",      fmt: "money", defKey: "Capital" },
      { key: "inmovilizado", label: "Inmovilizado", fmt: "money", defKey: "Inmovilizado" },
      { key: "rotacion",     label: "Rotación",     fmt: "x",     defKey: "Rotación" },
      { key: "gap",          label: "vs prom",      fmt: "pp",    defKey: "vs promedio inmov" },
    ],
    rows,
    quickWinK: Math.round(c.critCap),      // liquidar lo CRÍTICO ahora
    estructuralK: Math.round(c.inmovCap),  // rotar/mover TODO el inmovilizado (más lento)
  };
}
