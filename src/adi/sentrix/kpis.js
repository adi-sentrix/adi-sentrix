/* === adi/sentrix/kpis.js · Etapa 5 · Sentrix · la TIRA DE DATOS del Diagnóstico ===
 * "Todo el dato poderoso de la entidad, a la mano" — anticipa la pregunta del experto (¿cuánta carga? ¿rotación?)
 * sin que la tenga que pedir. Point-in-time, REAL, scenario-aware (lección GAP 2). Puro · client-side · el motor
 * no lo llama → motor sellado. Devuelve [{label, value, sub, tone}] · el panel solo renderiza. Data-driven:
 * deriva del dataset cargado, no hardcodea — mañana con el Excel del cliente sus columnas se declaran solas. */
import { applyScenarioToClientesVentas, applyScenarioToClientesMargen, applyScenarioToSkuInventario } from "../../engine/scenarios.js";
import { skusMargen } from "../../data/skusMargen.js";
import { temporalCapability, entityExplorable } from "./capability.js";

const _r1 = (n) => Math.round(n * 10) / 10;
const _p1 = (n) => (Math.round((Number(n) || 0) * 10) / 10).toFixed(1);   // % SIEMPRE con 1 decimal (parejos en la visual)
const _pp = (n) => (n >= 0 ? "+" : "") + _p1(n) + "pp";
const _fM = (n) => "$" + (Math.abs(Number(n) || 0) / 1000).toFixed(1) + "M";   // $K → $M (cliente/SKU ventas)
const _fKu = (n) => "$" + (Number(n) || 0).toFixed(1) + "K";                   // valor unitario ya en $K (ticket, costo medio)
const _fCap = (n) => "$" + (Math.abs(Number(n) || 0) / 1000).toFixed(1) + "K"; // inventario en $ → $K (capital)

// El dato poderoso de la entidad (anticipa la pregunta). Vacío si el tipo no se sostiene aún.
export function buildEntityKPIs(focusType, focus, scenario) {
  const s = scenario || "bonanza";
  if (focusType === "client") return _clientKPIs(focus, s);
  if (focusType === "bodega") return _bodegaKPIs(focus, s);
  if (focusType === "sku")    return _skuKPIs(focus);        // B4 · SKU y marca leen skusMargen (scenario-blind · el motor no ajusta skusMargen)
  if (focusType === "marca")  return _marcaKPIs(focus);
  return [];   // familia: próximo · el resto del Diagnóstico igual se muestra
}

// ── SKU · el dato del producto a la mano (skusMargen · $ raw → _fCap) · la liga = la familia ──
function _skuKPIs(name) {
  const sku = skusMargen.find((x) => x.nombre === name);
  if (!sku) return [];
  const fam = skusMargen.filter((x) => x.sfamilia === sku.sfamilia);
  const avgM = fam.reduce((a, x) => a + x.margen, 0) / fam.length;
  const costoPct = 100 - sku.margen - sku.pctRebate;
  return [
    { label: "Margen", value: _p1(sku.margen) + "%", sub: `${_pp(sku.margen - sku.benchmark)} vs bench`, tone: sku.margen >= sku.benchmark ? "up" : "down" },
    { label: "Ventas", value: _fCap(sku.venta), sub: `${sku.unidades} unidades` },
    { label: "Contribución", value: _fCap(sku.contribucion), sub: `${_p1(sku.contribucion / sku.venta * 100)}% de venta` },
    { label: "Costo", value: _p1(costoPct) + "%", sub: "del precio", tone: "warn" },
    { label: "Carga comercial", value: _p1(sku.pctRebate) + "%", sub: "rebate sobre venta", tone: "warn" },
    { label: "Precio lista", value: "$" + Math.round(sku.precioLista), sub: `costo unitario $${Math.round(sku.costoMedio)}` },
    { label: "vs familia", value: _pp(sku.margen - avgM), sub: `${sku.marca} · ${sku.sfamilia}`, tone: sku.margen >= avgM ? "up" : "down" },
    { label: "Benchmark", value: _p1(sku.benchmark) + "%", sub: "de cartera" },
  ];
}

// ── MARCA · agregación de sus SKUs (venta/contribución totales · margen PONDERADO = Σcontrib/Σventa) ──
function _marcaKPIs(name) {
  const rows = skusMargen.filter((x) => x.marca === name);
  if (!rows.length) return [];
  const venta = rows.reduce((a, x) => a + x.venta, 0);
  const contrib = rows.reduce((a, x) => a + x.contribucion, 0);
  const unidades = rows.reduce((a, x) => a + x.unidades, 0);
  const margenP = venta ? contrib / venta * 100 : 0;
  const bench = rows[0].benchmark;
  const familias = [...new Set(rows.map((x) => x.sfamilia))];
  return [
    { label: "Margen", value: _p1(margenP) + "%", sub: `${_pp(margenP - bench)} vs bench (ponderado)`, tone: margenP >= bench ? "up" : "down" },
    { label: "Ventas", value: _fCap(venta), sub: `${rows.length} SKUs` },
    { label: "Contribución", value: _fCap(contrib), sub: `${_p1(contrib / venta * 100)}% de venta` },
    { label: "Unidades", value: "" + unidades, sub: "vendidas" },
    { label: "SKUs", value: "" + rows.length, sub: familias.join(" · ") },
    { label: "Benchmark", value: _p1(bench) + "%", sub: "de cartera" },
  ];
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
    { label: "Ventas", value: _fM(venta), sub: yoY != null ? `${yoY >= 0 ? "+" : ""}${_p1(yoY)}% vs año ant.` : "", tone: yoY != null && yoY >= 0 ? "up" : yoY != null ? "down" : null },
    { label: "Margen", value: _p1(cm.margen) + "%", sub: `${_pp(cm.margen - avgM)} vs prom.`, tone: cm.margen >= avgM ? "up" : "down" },
    { label: "Contribución", value: _fM(cm.contribucion), sub: `${_p1(cm.contribucion / cm.venta * 100)}% de venta` },
    { label: "Carga comercial", value: _p1(cm.pctRebate) + "%", sub: `prom. ${_p1(avgC)}%`, tone: "warn" },
    { label: "Ticket prom.", value: ticket != null ? _fKu(ticket) : "—", sub: `${cm.unidades} unidades` },
    { label: "Costo unitario", value: _fKu(cm.costoMedio), sub: `${_p1(100 - cm.margen - cm.pctRebate)}% de venta` },
    { label: "Unidades", value: "" + cm.unidades, sub: "" },
    { label: "vs benchmark", value: _pp(cm.margen - cm.benchmark), sub: `bench ${_p1(cm.benchmark)}%`, tone: cm.margen >= cm.benchmark ? "up" : "down" },
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

// LA BRECHA EN EL TIEMPO · VISTA DE EJEMPLO (2c clic-curvas) · HONESTIDAD GRADUADA: NO hay histórico mes a mes por
// entidad (historialMargen es sintético · la capability lo bloquea), así que esto es ILUSTRATIVO — el ERP lo enciende
// con el dato real. Anclado a la VERDAD de HOY (el último punto = decomp real actual) · la palanca DOMINANTE deriva
// desde el promedio de la industria hasta el valor de hoy (muestra la erosión), la otra queda plana · margen = 100 −
// costo − carga (cierra). `example: true` → el panel lo rotula sin ambigüedad. Determinístico (wiggle por índice).
export function buildBrechaFilm(focus, scenario) {
  const d = buildMarginDecomposition(focus, scenario);
  if (!d) return null;
  const N = 12, meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const wig = (i, amp) => Math.sin(i * 1.7 + 0.6) * amp;             // wiggle determinístico (no Math.random · estable)
  const costoDom = d.dominant === "costo";
  const costo = [], carga = [], margen = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const c = costoDom ? d.avgCosto + (d.costoPct - d.avgCosto) * t : d.costoPct;   // la dominante deriva; la otra, plana
    const g = costoDom ? d.cargaPct : d.avgCarga + (d.cargaPct - d.avgCarga) * t;
    costo.push(_r1(c + (costoDom ? wig(i, 0.6) : 0)));
    carga.push(_r1(g + (costoDom ? 0 : wig(i, 0.4))));
    margen.push(_r1(100 - costo[i] - carga[i]));
  }
  costo[N - 1] = d.costoPct; carga[N - 1] = d.cargaPct; margen[N - 1] = d.margen;   // ANCLA: el "hoy" es el dato REAL
  return { focus, meses, costo, carga, margen, dominant: d.dominant, thesis: d.thesis, example: true };
}

// EL RECIBO FRÍO (Evidencia enriquecida) · "no me creas, acá está la cuenta": la fórmula venta−costo−carga=margen
// con cada cifra, su % y su FUENTE (ERP), la base de comparación, la confianza y los LÍMITES honestos (lo que el
// dato NO afirma · derivados de capability, no hardcodeados). Reusa buildMarginDecomposition (misma cuenta que la
// brecha → cierra exacto). Cliente·margen. Puro · client-side · testable. Null si no aplica (otro tipo/métrica).
export function buildMarginReceipt(focus, scenario) {
  const s = scenario || "bonanza";
  const d = buildMarginDecomposition(focus, s);
  if (!d) return null;
  const cv = (applyScenarioToClientesVentas(s) || []).find((c) => c.nombre === focus);
  const cm = (applyScenarioToClientesMargen(s) || []).find((c) => c.nombre === focus);
  const venta = cv ? cv.actual : (cm ? cm.venta : 0);          // $K
  // $ derivados de la IDENTIDAD (venta × %/100) → la columna $ cierra exacto igual que la %.
  const costoUSD = venta * d.costoPct / 100;
  const cargaUSD = venta * d.cargaPct / 100;
  const margenUSD = venta * d.margen / 100;                    // = contribución (derivada)
  const lines = [
    { label: "Ventas netas",     usd: venta,     pct: 100,        sign: "",  source: "ERP · facturación del período",     tone: "base"   },
    { label: "Costo de ventas",  usd: costoUSD,  pct: d.costoPct, sign: "−", source: "ERP · costo de mercadería vendida", tone: "costo"  },
    { label: "Carga comercial",  usd: cargaUSD,  pct: d.cargaPct, sign: "−", source: "ERP · rebates + descuentos",        tone: "carga"  },
    { label: "Margen",           usd: margenUSD, pct: d.margen,   sign: "=", source: "derivado · venta − costo − carga",   tone: "margen", strong: true },
  ];
  const benchmark = cm ? cm.benchmark : null;
  const comparison = [                                                          // + = mejor · unidad pp
    { label: "Promedio interno", base: `${_p1(d.avgM)}%`, gap: d.gap, unit: "pp" },
    ...(benchmark != null ? [{ label: "Benchmark industria", base: `${_p1(benchmark)}%`, gap: _r1(d.margen - benchmark), unit: "pp" }] : []),
  ];
  const confianza = { level: "Alta", reason: "cuenta cerrada con dato del período — sin estimaciones (venta − costo − carga = margen, cierra exacto)" };
  // LÍMITES honestos · derivados de la capa de disponibilidad (no inventados)
  const limites = [];
  const temp = temporalCapability({ entityType: "client", entity: focus, metric: "margen" });
  if (temp.perEntity && temp.perEntity.status === "blocked")
    limites.push(`La evolución del margen de ${focus} mes a mes: el histórico por cliente aún es sintético — se enciende con el ERP.`);
  (entityExplorable("client", focus).blocked || []).forEach((b) =>
    limites.push(`El desglose de ${b.view}: ${b.reason}.`));
  return { entityType: "client", focus, venta, lines, comparison, confianza, limites, dominant: d.dominant, thesis: d.thesis };
}

// EL RECIBO FRÍO de una BODEGA (inventario) · la cuenta del capital: capital = sano (rota) + inmovilizado (atrapado)
// → cierra exacto. Misma forma que el de cliente (lines/comparison/confianza/limites) → UN componente los renderiza
// ambos. Fuentes ERP · comparación vs promedio de bodegas · límites honestos de inventario. Puro · testable.
export function buildCapitalReceipt(focus, scenario) {
  const s = scenario || "bonanza";
  const allInv = applyScenarioToSkuInventario(s) || [];
  const inv = allInv.filter((x) => x.bodega === focus);
  if (!inv.length) return null;
  const inmov = (x) => (x.alerta && x.alerta !== "ok") || x.rotacion < 2;   // def canónica
  const cap = inv.reduce((a, x) => a + x.stockUSD, 0);
  const inmovCap = inv.filter(inmov).reduce((a, x) => a + x.stockUSD, 0);
  const sano = cap - inmovCap;
  const inmovPct = cap ? inmovCap / cap * 100 : 0, sanoPct = 100 - inmovPct;
  const rot = inv.reduce((a, x) => a + x.rotacion, 0) / inv.length;
  const lines = [
    { label: "Capital en stock",       usd: cap,      pct: 100,           sign: "",  source: "ERP · valor de inventario",         tone: "base"  },
    { label: "Capital que rota (sano)", usd: sano,     pct: _r1(sanoPct),  sign: "−", source: "rotación ≥ 2 · sin alerta",         tone: "base"  },
    { label: "Inmovilizado (atrapado)", usd: inmovCap, pct: _r1(inmovPct), sign: "=", source: "en alerta o rotación < 2",          tone: "carga", strong: true },
  ];
  // comparación vs el promedio de las bodegas (+ = mejor: menos inmovilizado / más rotación)
  const names = [...new Set(allInv.map((x) => x.bodega))];
  const per = names.map((b) => {
    const r = allInv.filter((x) => x.bodega === b), c = r.reduce((a, x) => a + x.stockUSD, 0);
    const im = r.filter(inmov).reduce((a, x) => a + x.stockUSD, 0);
    return { inmovPct: c ? im / c * 100 : 0, rot: r.reduce((a, x) => a + x.rotacion, 0) / r.length };
  });
  const avgInmovPct = per.reduce((a, x) => a + x.inmovPct, 0) / per.length;
  const avgRot = per.reduce((a, x) => a + x.rot, 0) / per.length;
  const comparison = [
    { label: "Inmovilización vs promedio", base: `${_p1(avgInmovPct)}%`, gap: _r1(avgInmovPct - inmovPct), unit: "pp" },   // + = menos inmov = mejor
    { label: "Rotación vs promedio",       base: `${_r1(avgRot)}x`,      gap: _r1(rot - avgRot),            unit: "x"  },   // + = rota más = mejor
  ];
  const confianza = { level: "Alta", reason: "dato del ERP point-in-time — sin estimaciones (sano + inmovilizado = capital, cierra exacto)" };
  const limites = [   // honestos, propios de inventario (no hay serie temporal · no hay proyección por SKU)
    `La evolución del capital de ${focus} mes a mes: el inventario es point-in-time, no hay serie histórica — se enciende con el ERP.`,
    `Cuándo se venderá cada SKU: solo tengo el ritmo de rotación actual, no una proyección por fecha.`,
  ];
  return { entityType: "bodega", focus, lines, comparison, confianza, limites };
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
    { label: "Inmovilizado", value: _fCap(inmovCap), sub: `${_p1(inmovCap / cap * 100)}%`, tone: "down" },
    { label: "Rotación", value: _r1(rot) + "x", sub: "", tone: rot < 3 ? "down" : null },
    { label: "DOH", value: Math.round(doh) + "d", sub: "días de cobertura" },
    { label: "SKUs en alerta", value: `${enAlerta} / ${inv.length}`, sub: "", tone: "warn" },
    { label: "Peor sin venta", value: peor.d + "d", sub: peor.sku },
    { label: "% del inmov. total", value: totInmov ? `${_p1(inmovCap / totInmov * 100)}%` : "—", sub: `de ${_fCap(totInmov)}`, tone: "down" },
  ];
}
