/* === adi/sentrix/control.js · Etapa 5 · Sentrix · el CONTROL · la TABLA-RING ===
 * "El ring, nunca una fila sola" (la ley de las lentes · owner): el foco SIEMPRE anclado contra (a) el PROMEDIO,
 * (b) el PAR INSTRUCTIVO (comparación controlada · aísla la palanca) y (c) el MEJOR-EN-CLASE (el objetivo). La
 * mesa de operaciones: qué tocar y cuánto vale. Columnas del catálogo (margen/carga/costo/gap) · DERIVADO del
 * dato (identidad margen=100−costo−carga · cierra con la brecha y el recibo) · scenario-aware · puro · testable.
 * Cliente·margen hoy (el flagship); inventario (bodega) = próxima extensión del mismo esqueleto. */
import { applyScenarioToClientesVentas, applyScenarioToClientesMargen } from "../../engine/scenarios.js";
import { buildMarginDecomposition } from "./kpis.js";

const _r1 = (n) => Math.round(n * 10) / 10;

// El par que AÍSLA la palanca: mismo valor en el eje NO-palanca (carga si la palanca es el costo, y viceversa) pero
// mejor margen → su ventaja se explica por la palanca. Comparación controlada (primitivo de 1ª clase de la ley).
function _instructivePar(c, all, dominant) {
  const better = all.filter((x) => x.nombre !== c.nombre && x.margen > c.margen);
  if (!better.length) return null;
  const axis = dominant === "costo" ? "carga" : "costo";          // se mantiene fijo el eje NO-palanca
  const valOf = (x) => (axis === "carga" ? x.pctRebate : 100 - x.margen - x.pctRebate);
  const focoAxis = valOf(c);
  return better.slice().sort((a, b) => Math.abs(valOf(a) - focoAxis) - Math.abs(valOf(b) - focoAxis))[0];
}

const _row = (x, role, avgM, note) => ({
  name: x.nombre, role,
  margen: x.margen,
  carga: _r1(x.pctRebate),
  contribucion: Math.round(x.contribucion),   // $K · "la gente reacciona a la plata" (owner): el stake del cliente
  gap: role === "avg" ? 0 : _r1(x.margen - avgM),
  note: note || null,
});

// LA TABLA-RING de un cliente. null si el foco no es un cliente del set (honesto · el panel cae al placeholder).
export function buildControlRing(focus, scenario) {
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
  const par = _instructivePar(c, all, lever);
  const parNote = lever === "costo" ? "≈ misma carga, mejor margen → la palanca es el costo"
                                    : "≈ mismo costo, mejor margen → la palanca es la carga";

  // fila PROMEDIO y MEJOR sintéticas (mismo shape) · el promedio no tiene "nombre" de cliente
  const avgContrib = all.reduce((a, x) => a + (x.contribucion || 0), 0) / all.length;
  const avgRow = { name: "Promedio interno", role: "avg", margen: _r1(avgM), carga: _r1(avgCarga), contribucion: Math.round(avgContrib), gap: 0, note: null };
  const rows = [_row(c, "focus", avgM)];
  if (par && par.nombre !== best.nombre) rows.push(_row(par, "peer", avgM, parNote));
  rows.push(avgRow);
  if (best.nombre !== c.nombre) rows.push(_row(best, "best", avgM, "mejor en clase · el objetivo"));

  // TECHO estructural de costo: cuánto valdría (anual) que el costo del foco llegara al promedio interno.
  const cv = (applyScenarioToClientesVentas(s) || []).find((x) => x.nombre === focus);
  const venta = cv ? cv.actual : c.venta;
  const focoCosto = 100 - c.margen - c.pctRebate;
  const costoTechoK = Math.max(0, Math.round((focoCosto - avgCosto) * venta / 100));

  return {
    entityType: "client", focus, lever, leverLabel,
    columns: [
      { key: "margen",       label: "Margen",       fmt: "pct",   defKey: "Margen" },
      { key: "carga",        label: "Carga",        fmt: "pct",   defKey: "Carga comercial" },
      { key: "contribucion", label: "Contribución", fmt: "money", defKey: "Contribución" },   // la plata (owner) · reemplaza costo%
      { key: "gap",          label: "vs prom",      fmt: "pp",    defKey: "vs promedio" },
    ],
    rows, costoTechoK,
  };
}
