/* === adi/sentrix/reading.js · Etapa 5 · Sentrix · LECTURA EJECUTIVA ===
 * El valor agregado de ADI sobre un BI: no el dato, el POR QUÉ ganás/perdés plata.
 * Computa la lectura estructurada (reframe + drivers + ranking + recomendación + entidad sensible) DESDE el dato
 * real — aritmética, no opinión (regla madre en lo causal). El boleta la carga → ADI la dice y Sentrix la demuestra.
 * General y data-driven: corre sobre el dataset cargado (demo hoy, Excel del cliente mañana). */
import { applyScenarioToSkuInventario } from "../../engine/scenarios.js";
import { skusMargen } from "../../data/skusMargen.js";
import { invKPI } from "../../data/baseKpis.js";

// inmovilizado Def2 canónica (igual que el spine/warehouse): alerta crit/warn O rotación < 2.
const _esInmov = (r) => r.alerta === "crit" || r.alerta === "warn" || r.rotacion < 2;

// LECTURA de "capital inmovilizado por bodega" · el foco = la bodega con más capital frenado, y POR QUÉ lo es.
export function buildCapitalReading(scenario) {
  const inv = applyScenarioToSkuInventario(scenario).filter(_esInmov);
  if (!inv.length) return null;
  const totalInmov = inv.reduce((s, r) => s + r.stockUSD, 0);

  const byBodega = {};
  for (const r of inv) (byBodega[r.bodega] = byBodega[r.bodega] || []).push(r);
  const bodegas = Object.entries(byBodega).map(([bodega, rows]) => ({
    bodega, rows,
    capital: rows.reduce((s, r) => s + r.stockUSD, 0),
    dohAvg: Math.round(rows.reduce((s, r) => s + r.doh, 0) / rows.length),
    rotAvg: +(rows.reduce((s, r) => s + r.rotacion, 0) / rows.length).toFixed(1),
  })).sort((a, b) => b.capital - a.capital);

  const focus = bodegas[0];
  const pct = Math.round((focus.capital / totalInmov) * 100);
  const ranking = focus.rows.slice().sort((a, b) => b.stockUSD - a.stockUSD)
    .map(r => ({ sku: r.sku, capital: r.stockUSD, doh: r.doh, alerta: r.alerta }));
  const sensitive = ranking[0];                                   // más capital (= el más sensible del foco)
  const dohBench = invKPI && invKPI.doh ? invKPI.doh : 48;
  const lento = focus.dohAvg >= dohBench * 1.5;

  // recomendación DERIVADA de las señales (no template fijo): lento+concentrado → transferencia/liquidación.
  const rec = lento
    ? "antes de comprar más, revisaría salida comercial y transferencia de stock"
    : "revisaría la salida comercial de los SKUs frenados";

  const fmt = (n) => "$" + (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + "K" : Math.round(n));

  return {
    domain: "inventario", metric: "capital", subset: "inmovilizado (Def2)",
    focusType: "bodega", focus: focus.bodega, monto: focus.capital, montoFmt: fmt(focus.capital),
    pct, totalInmov, totalInmovFmt: fmt(totalInmov),
    // el reframe: lo que lo vuelve criterio ejecutivo, no reporte.
    reframe: "el problema no es tener stock, es que está concentrado y lento",
    drivers: [
      { v: `${focus.dohAvg}d`, label: `cobertura promedio vs ${dohBench}d benchmark interno` },
      { v: `${focus.rotAvg}x`, label: "rotación baja del capital frenado" },
      { v: `${ranking.length} SKU`, label: `concentran el ${pct}% del capital inmovilizado` },
      { v: `${sensitive.doh}d`, label: `${sensitive.sku} es el caso más sensible` },
    ],
    ranking,
    recommendation: rec,
    sensitive: sensitive.sku,
    // frase ejecutiva lista (lo que ADI DICE · la demuestra Sentrix campo por campo).
    sentence: `Tu capital inmovilizado está en ${focus.bodega}: ${fmt(focus.capital)}, el ${pct}% del total. ` +
              `Pero el problema no es tener stock — está concentrado y lento: ${ranking.length} SKUs lo explican, ` +
              `con ${focus.dohAvg} días de cobertura, casi ${(focus.dohAvg / dohBench).toFixed(1)}x el benchmark interno. ` +
              `Mi lectura: ${rec}. El más sensible es ${sensitive.sku}.`,
  };
}

// LECTURA de "margen de un SKU" · el porqué del margen bajo = descomposición del precio (costo + rebate + margen)
// → cuál componente lo aplasta (el driver). Aritmética del registro comercial, no opinión.
export function buildSkuMarginReading(skuName) {
  const s = skusMargen.find((x) => x.nombre === skuName);
  if (!s || !s.venta) return null;
  const costShare = Math.round((s.costo / s.venta) * 100);
  const rebateShare = Math.round((s.rebates / s.venta) * 100);
  const gap = +(s.benchmark - s.margen).toFixed(1);
  const fam = skusMargen.filter((x) => x.marca === s.marca && x.nombre !== s.nombre);
  const famAvg = fam.length ? Math.round(fam.reduce((a, x) => a + x.margen, 0) / fam.length) : null;
  // driver = el componente que más aplasta el margen (costo dominante · rebate alto suma · si no, precio).
  const driver = costShare >= 75 ? "costo" : s.pctRebate >= 5 ? "carga comercial" : "precio";
  const rec = driver === "costo" ? "revisaría el costeo o el precio de lista de este SKU"
            : driver === "carga comercial" ? "revisaría el rebate de este SKU"
            : "revisaría el precio de lista";
  return {
    domain: "margenes", metric: "margen", focusType: "sku", focus: skuName,
    monto: s.margen, montoFmt: s.margen + "%", pct: s.margen, benchmark: s.benchmark, gap,
    reframe: `el ${driver} se lleva el margen, no la venta`,
    decomposition: { costo: costShare, rebate: rebateShare, margen: Math.max(0, 100 - costShare - rebateShare) },
    drivers: [
      { v: `${costShare}%`, label: "del precio se lo lleva el costo" },
      { v: `${s.pctRebate}%`, label: "rebate (carga) sobre la venta" },
      { v: `${gap}pp`, label: `bajo el benchmark (${s.benchmark}%)` },
      ...(famAvg != null ? [{ v: `${famAvg}%`, label: `margen promedio de ${s.marca}` }] : []),
    ],
    recommendation: rec, sensitive: skuName,
    sentence: `${skuName} es el peor en margen: ${s.margen}%, ${gap}pp bajo el benchmark (${s.benchmark}%). ` +
              `El costo se lleva el ${costShare}% del precio y el rebate (${s.pctRebate}%) suma — ` +
              `el precio no cubre el costo como en el resto de ${s.marca}${famAvg != null ? ` (margen ${famAvg}%)` : ""}. ` +
              `Mi lectura: ${rec}. El problema es el ${driver}, no la venta.`,
  };
}

// LECTURA de "margen de un CLIENTE" · el porqué = la CARGA COMERCIAL (rebate) sobre el promedio interno → lo
// recuperable si se renegocia. NO recomputa: lee el objeto narrative_signals (lo MISMO que formatea el texto
// narrativo del cliente · what/why/implication) → los números del panel == los del texto, byte por byte.
// El texto del cliente NO se reemplaza (ya es ejecutivo); esto SOLO carga la boleta para que el panel lo demuestre.
const _fmtK = (n) => "$" + Math.round(n) + "K";
export function buildClientMarginReading(signals) {
  if (!signals || !signals.what || !signals.why || !signals.why.driver) return null;
  const a = (signals.implication && signals.implication.action) || null;
  if (!a) return null;
  const focus = signals.what.entity;
  const margen = signals.what.value;                 // margen actual del cliente (lo que ADI dice)
  const carga = signals.why.driver.value;            // pctRebate
  const vsProm = signals.why.driver.vs_promedio;     // gap vs promedio interno (pp)
  const targetCarga = a.target_carga;                // promedio interno (carga objetivo)
  const recK = a.recoverable_K || 0;                 // recuperable al promedio (anual, $K)
  const recBPK = a.bestPractice_recoverable_K || 0;  // recuperable a mejor práctica 3.0% ($K)
  const targetMargen = a.expected_impact && a.expected_impact.to;  // margen si baja la carga al promedio
  return {
    domain: "margenes", metric: "margen", focusType: "client", focus,
    monto: margen, montoFmt: margen + "%", pct: margen,
    // el reframe del cliente: el margen no se decide mirando al cliente sino la carga comercial que le damos.
    reframe: "antes de mirar al cliente, el margen se decide en la carga comercial",
    // campos propios del cliente (la palanca = carga vs promedio · lo recuperable)
    carga, vsPromedio: vsProm, targetCarga, bestPracticeCarga: a.bestPractice_carga || 3.0,
    recoverableK: recK, recoverableBPK: recBPK, targetMargen,
    drivers: [
      { v: `${carga}%`, label: "carga comercial sobre la venta" },
      { v: `+${vsProm}pp`, label: `sobre el promedio interno (${targetCarga}%)` },
      { v: _fmtK(recK), label: "recuperable al promedio interno (anual)" },
      { v: _fmtK(recBPK), label: `recuperable a mejor práctica (${(a.bestPractice_carga || 3.0).toFixed(1)}%)` },
    ],
    recommendation: signals.implication.reframe ||
      "renegociaría la carga comercial de esta cuenta",
    sensitive: focus,
  };
}
