/* === adi/sentrix/kpis.js · Etapa 5 · Sentrix · la TIRA DE DATOS del Diagnóstico ===
 * "Todo el dato poderoso de la entidad, a la mano" — anticipa la pregunta del experto (¿cuánta carga? ¿rotación?)
 * sin que la tenga que pedir. Point-in-time, REAL, scenario-aware (lección GAP 2). Puro · client-side · el motor
 * no lo llama → motor sellado. Devuelve [{label, value, sub, tone}] · el panel solo renderiza. Data-driven:
 * deriva del dataset cargado, no hardcodea — mañana con el Excel del cliente sus columnas se declaran solas. */
import { applyScenarioToClientesVentas, applyScenarioToClientesMargen, applyScenarioToSkuInventario } from "../../engine/scenarios.js";

const _r1 = (n) => Math.round(n * 10) / 10;
const _pp = (n) => (n >= 0 ? "+" : "") + _r1(n) + "pp";
const _fM = (n) => "$" + (Math.abs(Number(n) || 0) / 1000).toFixed(1) + "M";   // $K → $M (cliente/SKU ventas)
const _fKu = (n) => "$" + (Number(n) || 0).toFixed(1) + "K";                   // valor unitario ya en $K (ticket, costo medio)
const _fCap = (n) => "$" + (Math.abs(Number(n) || 0) / 1000).toFixed(1) + "K"; // inventario en $ → $K (capital)

// El dato poderoso de la entidad (anticipa la pregunta). Vacío si el tipo no se sostiene aún.
export function buildEntityKPIs(focusType, focus, scenario) {
  const s = scenario || "bonanza";
  if (focusType === "client") return _clientKPIs(focus, s);
  if (focusType === "bodega") return _bodegaKPIs(focus, s);
  return [];   // sku/marca/familia: próximo brick · el resto del Diagnóstico igual se muestra
}

function _clientKPIs(name, s) {
  const all = applyScenarioToClientesMargen(s);
  const cm = all.find((c) => c.nombre === name);
  if (!cm) return [];
  const cv = (applyScenarioToClientesVentas(s) || []).find((c) => c.nombre === name);
  const avgM = all.reduce((a, c) => a + c.margen, 0) / all.length;
  const avgC = all.reduce((a, c) => a + c.pctRebate, 0) / all.length;
  const venta = cv ? cv.actual : cm.venta;
  const ant = cv ? cv.anterior : null;
  const yoY = ant && ant > 0 ? _r1((venta - ant) / ant * 100) : null;
  const ticket = cm.unidades ? venta / cm.unidades : null;
  return [
    { label: "Ventas", value: _fM(venta), sub: yoY != null ? `${yoY >= 0 ? "+" : ""}${yoY}% vs año ant.` : "", tone: yoY != null && yoY >= 0 ? "up" : yoY != null ? "down" : null },
    { label: "Margen", value: cm.margen + "%", sub: `${_pp(cm.margen - avgM)} vs prom.`, tone: cm.margen >= avgM ? "up" : "down" },
    { label: "Contribución", value: _fM(cm.contribucion), sub: `${_r1(cm.contribucion / cm.venta * 100)}% de venta` },
    { label: "Carga comercial", value: cm.pctRebate + "%", sub: `prom. ${_r1(avgC)}%`, tone: "warn" },
    { label: "Ticket prom.", value: ticket != null ? _fKu(ticket) : "—", sub: `${cm.unidades} unidades` },
    { label: "Costo unitario", value: _fKu(cm.costoMedio), sub: `${_r1(100 - cm.margen - cm.pctRebate)}% de venta` },
    { label: "Unidades", value: "" + cm.unidades, sub: "" },
    { label: "vs benchmark", value: _pp(cm.margen - cm.benchmark), sub: `bench ${cm.benchmark}%`, tone: cm.margen >= cm.benchmark ? "up" : "down" },
  ];
}

// DESCOMPOSICIÓN del margen (cliente) · margen = 100 − costo% − carga% · descompone el gap vs el promedio en sus
// palancas y elige la DOMINANTE → la tesis la dice el DATO, no un molde. La reusa la Evidencia (misma cuenta).
export function buildMarginDecomposition(focus, scenario) {
  const s = scenario || "bonanza";
  const all = applyScenarioToClientesMargen(s);
  const c = all.find((x) => x.nombre === focus);
  if (!c) return null;
  // margin-consistente: carga = pctRebate (canónico) · costo% = 100 − margen − carga → margen+carga+costo=100 SIEMPRE
  // (el ajuste de escenario desincroniza costo/venta vs el margen; derivar del margen hace que la cuenta CIERRE).
  const cargaPct = c.pctRebate, costoPct = 100 - c.margen - cargaPct;
  const avgM = all.reduce((a, x) => a + x.margen, 0) / all.length;
  const avgCarga = all.reduce((a, x) => a + x.pctRebate, 0) / all.length;
  const avgCosto = 100 - avgM - avgCarga;
  const gap = _r1(c.margen - avgM);                 // − = bajo el promedio
  const cargaComp = _r1(avgCarga - cargaPct);       // aporte de la carga al gap
  const costoComp = _r1(gap - cargaComp);           // aporte del costo = RESIDUAL → la cuenta cierra exacto (costo+carga=gap)
  const absC = Math.abs(costoComp), absG = Math.abs(cargaComp), tot = absC + absG || 1;
  const dominant = absC >= absG ? "costo" : "carga";
  const thesis = dominant === "costo" ? "estructura de costo" : "carga comercial";
  const otra = dominant === "costo" ? "la carga" : "el costo";
  const thesisFull = gap < 0
    ? `${focus} no pierde por ${otra} — pierde por ${thesis}`
    : `${focus} destaca por ${thesis}`;
  return {
    focus, margen: c.margen, avgM: _r1(avgM), gap,
    costoPct: _r1(costoPct), cargaPct: _r1(cargaPct), avgCosto: _r1(avgCosto), avgCarga: _r1(avgCarga),
    costoComp, cargaComp, dominant, thesis, thesisFull,
    costoShare: Math.round(absC / tot * 100), cargaShare: Math.round(absG / tot * 100),
  };
}

function _bodegaKPIs(name, s) {
  const allInv = applyScenarioToSkuInventario(s) || [];
  const inv = allInv.filter((x) => x.bodega === name);
  if (!inv.length) return [];
  const inmov = (x) => (x.alerta && x.alerta !== "ok") || x.rotacion < 2;   // def canónica (alerta o rotación<2)
  const cap = inv.reduce((a, x) => a + x.stockUSD, 0);
  const inmovCap = inv.filter(inmov).reduce((a, x) => a + x.stockUSD, 0);
  const rot = inv.reduce((a, x) => a + x.rotacion, 0) / inv.length;
  const doh = inv.reduce((a, x) => a + x.doh, 0) / inv.length;
  const enAlerta = inv.filter((x) => x.alerta && x.alerta !== "ok").length;
  const peor = inv.reduce((m, x) => (x.diasSinVenta > m.d ? { d: x.diasSinVenta, sku: x.sku } : m), { d: 0, sku: "" });
  const totInmov = allInv.filter(inmov).reduce((a, x) => a + x.stockUSD, 0);
  return [
    { label: "Capital", value: _fCap(cap), sub: `${inv.length} SKUs` },
    { label: "Inmovilizado", value: _fCap(inmovCap), sub: `${_r1(inmovCap / cap * 100)}%`, tone: "down" },
    { label: "Rotación", value: _r1(rot) + "x", sub: "", tone: rot < 3 ? "down" : null },
    { label: "DOH", value: Math.round(doh) + "d", sub: "días de cobertura" },
    { label: "SKUs en alerta", value: `${enAlerta} / ${inv.length}`, sub: "", tone: "warn" },
    { label: "Peor sin venta", value: peor.d + "d", sub: peor.sku },
    { label: "% del inmov. total", value: totInmov ? `${_r1(inmovCap / totInmov * 100)}%` : "—", sub: `de ${_fCap(totInmov)}`, tone: "down" },
  ];
}
