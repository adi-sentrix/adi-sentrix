/* === adi/sentrix/reading.js · Etapa 5 · Sentrix · LECTURA EJECUTIVA · PIPELINE ÚNICO ===
 * El valor agregado de ADI sobre un BI: no el dato, el POR QUÉ ganás/perdés plata.
 *
 * Arquitectura general (refactor 2026-06-29): un SOLO renderer `buildReadingFromSignals(signals)` que produce la
 * lectura para Sentrix desde un contrato UNIFORME de signals {what, why:{driver:{mechanism}}, implication}.
 * Los signals vienen de DOS fuentes, pero el renderer es uno:
 *   - el MOTOR (narrative_signals · driver-vs-pares): cliente/carga comercial (internal_commercial_load). El mismo
 *     objeto que formatea el texto narrativo → los números del panel == los del texto, cero divergencia.
 *   - PRODUCTORES sintéticos (matemática irreducible por métrica, emiten el mismo contrato): SKU/margen
 *     (descomposición del precio · cost_structure) y capital/bodega (agregación · capital_concentration).
 * Agregar una métrica = un productor (o una regla del motor) + una rama de render. La aritmética es real (regla
 * madre en lo causal): el porqué se DERIVA del dato, no se inventa.
 * Presentación nula · cero React. */
import { applyScenarioToSkuInventario, applyScenarioToClientesMargen } from "../../engine/scenarios.js";
import { skusMargen } from "../../data/skusMargen.js";
import { invKPI } from "../../data/baseKpis.js";

// inmovilizado Def2 canónica (igual que el spine/warehouse): alerta crit/warn O rotación < 2.
const _esInmov = (r) => r.alerta === "crit" || r.alerta === "warn" || r.rotacion < 2;
const _p1 = (n) => (Math.round((Number(n) || 0) * 10) / 10).toFixed(1);               // % SIEMPRE con 1 decimal (parejos en la visual · solo campos del PANEL, nunca los `sentence` del chat)
const _fmtK = (n) => "$" + Math.round(n || 0) + "K";                                  // cliente · $K ya en miles
const _fmtMoney = (n) => "$" + (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + "K" : Math.round(n));  // capital · USD

// ══════════════════════════ RENDERER ÚNICO ══════════════════════════
// signals uniforme → lectura. Despacha por mechanism. Mecanismo sin pack → null (honesto · sin reading).
export function buildReadingFromSignals(signals) {
  if (!signals || !signals.what || !signals.why || !signals.why.driver) return null;
  const mech = signals.why.driver.mechanism || signals.why.mechanism;
  if (mech === "internal_commercial_load")   return _readClientLoad(signals);
  if (mech === "cost_structure")             return _readCostStructure(signals);
  if (mech === "capital_concentration")      return _readCapital(signals);
  if (mech === "internal_margin_compression") return _readMarginCompression(signals);
  return null;
}
const _money = (k) => (Math.abs(k) >= 1000 ? "$" + (k / 1000).toFixed(1) + "M" : "$" + Math.round(k || 0) + "K");

// ── render · contribución de cliente · el margen unitario bajo el benchmark COMPRIME la contribución ──
function _readMarginCompression(signals) {
  const w = signals.what, d = signals.why.driver;
  const a = (signals.implication && signals.implication.action) || {};
  const gap = d.vs_benchmark, benchmark = +(w.value + gap).toFixed(1);
  const recK = a.recoverable_K || 0;
  return {
    kind: "margin_compression",
    domain: "margenes", metric: "contribucion", focusType: w.entityType || "client", focus: w.entity,
    monto: w.value, montoFmt: _p1(w.value) + "%", pct: w.value, benchmark, gap,
    reframe: "el margen unitario bajo el benchmark comprime la contribución",
    recoverableK: recK, targetMargen: benchmark,
    drivers: [
      { v: `${_p1(w.value)}%`, label: "margen unitario actual" },
      { v: `${_p1(benchmark)}%`, label: "benchmark de cartera" },
      { v: `${_p1(gap)}pp`, label: "brecha de margen unitario" },
      { v: _money(recK), label: "contribución recuperable al benchmark (anual)" },
    ],
    recommendation: signals.implication.reframe || "recuperaría el margen unitario hacia el benchmark de cartera",
    sensitive: w.entity,
  };
}

// ── render · cliente · carga comercial sobre el promedio interno (el porqué = la palanca de carga) ──
function _readClientLoad(signals) {
  const w = signals.what, d = signals.why.driver;
  const a = (signals.implication && signals.implication.action) || null;
  if (!a) return null;
  const carga = d.value, vsProm = d.vs_promedio, targetCarga = a.target_carga;
  const recK = a.recoverable_K || 0, recBPK = a.bestPractice_recoverable_K || 0;
  const bpCarga = a.bestPractice_carga || 3.0;
  return {
    kind: "internal_commercial_load",        // → el panel resuelve el pack por kind (espejo del renderer)
    domain: "margenes", metric: "margen", focusType: "client", focus: w.entity,
    monto: w.value, montoFmt: _p1(w.value) + "%", pct: w.value,
    reframe: "antes de mirar al cliente, el margen se decide en la carga comercial",
    carga, vsPromedio: vsProm, targetCarga, bestPracticeCarga: bpCarga,
    recoverableK: recK, recoverableBPK: recBPK, targetMargen: a.expected_impact && a.expected_impact.to,
    drivers: [
      { v: `${_p1(carga)}%`, label: "carga comercial sobre la venta" },
      { v: `+${_p1(vsProm)}pp`, label: `sobre el promedio interno (${_p1(targetCarga)}%)` },
      { v: _fmtK(recK), label: "recuperable al promedio interno (anual)" },
      { v: _fmtK(recBPK), label: `recuperable a mejor práctica (${bpCarga.toFixed(1)}%)` },
    ],
    recommendation: signals.implication.reframe || "renegociaría la carga comercial de esta cuenta",
    sensitive: w.entity,
  };
}

// ── render · SKU · descomposición del precio (costo + rebate + margen → el componente que lo aplasta) ──
function _readCostStructure(signals) {
  const w = signals.what, d = signals.why.driver;
  const driver = d.component;
  const rec = driver === "costo" ? "revisaría el costeo o el precio de lista de este SKU"
            : driver === "carga comercial" ? "revisaría el rebate de este SKU"
            : "revisaría el precio de lista";
  return {
    kind: "cost_structure",
    domain: "margenes", metric: "margen", focusType: "sku", focus: w.entity,
    monto: w.value, montoFmt: _p1(w.value) + "%", pct: w.value, benchmark: d.benchmark, gap: d.gap,
    reframe: `el ${driver} se lleva el margen, no la venta`,
    decomposition: { costo: d.costShare, rebate: d.rebateShare, margen: Math.max(0, 100 - d.costShare - d.rebateShare) },
    drivers: [
      { v: `${_p1(d.costShare)}%`, label: "del precio se lo lleva el costo" },
      { v: `${_p1(d.pctRebate)}%`, label: "rebate (carga) sobre la venta" },
      { v: `${_p1(d.gap)}pp`, label: `bajo el benchmark (${_p1(d.benchmark)}%)` },
      ...(d.famAvg != null ? [{ v: `${_p1(d.famAvg)}%`, label: `margen promedio de ${d.marca}` }] : []),
    ],
    recommendation: rec, sensitive: w.entity,
    sentence: `${w.entity} es el peor en margen: ${w.value}%, ${d.gap}pp bajo el benchmark (${d.benchmark}%). ` +
              `El costo se lleva el ${d.costShare}% del precio y el rebate (${d.pctRebate}%) suma — ` +
              `el precio no cubre el costo como en el resto de ${d.marca}${d.famAvg != null ? ` (margen ${d.famAvg}%)` : ""}. ` +
              `Mi lectura: ${rec}. El problema es el ${driver}, no la venta.`,
  };
}

// ── render · capital por bodega · concentración + lentitud (el foco = la bodega con más capital frenado) ──
function _readCapital(signals) {
  const w = signals.what, d = signals.why.driver, im = signals.implication;
  const rec = d.lento
    ? "antes de comprar más, revisaría salida comercial y transferencia de stock"
    : "revisaría la salida comercial de los SKUs detenidos";
  return {
    kind: "capital_concentration",
    domain: "inventario", metric: "capital", subset: "inmovilizado (Def2)", focusType: "bodega",
    focus: w.entity, monto: w.value, montoFmt: _fmtMoney(w.value),
    pct: d.pct, totalInmov: im.totalInmov, totalInmovFmt: _fmtMoney(im.totalInmov),
    reframe: "el problema no es tener stock, es que está concentrado y lento",
    drivers: [
      { v: `${d.dohAvg}d`, label: `cobertura promedio vs ${d.dohBench}d benchmark interno` },
      { v: `${d.rotAvg}x`, label: "rotación baja del capital detenido" },
      { v: `${im.ranking.length} SKU`, label: `concentran el ${_p1(d.pct)}% del capital inmovilizado` },
      { v: `${im.sensitiveDoh}d`, label: `${im.sensitive} es el caso más sensible` },
    ],
    ranking: im.ranking,
    recommendation: rec,
    sensitive: im.sensitive,
    sentence: `Tu capital inmovilizado está en ${w.entity}: ${_fmtMoney(w.value)}, el ${d.pct}% del total. ` +
              `Pero el problema no es tener stock — está concentrado y lento: ${im.ranking.length} SKUs lo explican, ` +
              `con ${d.dohAvg} días de cobertura, casi ${(d.dohAvg / d.dohBench).toFixed(1)}x el benchmark interno. ` +
              `Mi lectura: ${rec}. El más sensible es ${im.sensitive}.`,
  };
}

// ══════════════════════════ PRODUCTORES de signals (matemática por métrica · emiten el contrato uniforme) ══════════════════════════

// SKU/margen → signals(cost_structure): descomposición del precio del registro comercial (skusMargen). Aritmética real.
export function buildSkuMarginSignals(skuName) {
  const s = skusMargen.find((x) => x.nombre === skuName);
  if (!s || !s.venta) return null;
  const costShare = Math.round((s.costo / s.venta) * 100);
  const rebateShare = Math.round((s.rebates / s.venta) * 100);
  const gap = +(s.benchmark - s.margen).toFixed(1);
  const fam = skusMargen.filter((x) => x.marca === s.marca && x.nombre !== s.nombre);
  const famAvg = fam.length ? Math.round(fam.reduce((a, x) => a + x.margen, 0) / fam.length) : null;
  // el componente que más aplasta el margen (costo dominante · rebate alto suma · si no, precio).
  const component = costShare >= 75 ? "costo" : s.pctRebate >= 5 ? "carga comercial" : "precio";
  return {
    what: { entity: skuName, value: s.margen, unit: "%", metric: "margen", entityType: "sku" },
    why: { mechanism: "cost_structure", origin: "internal", target_entity: skuName,
           driver: { mechanism: "cost_structure", component, costShare, rebateShare, pctRebate: s.pctRebate, benchmark: s.benchmark, gap, marca: s.marca, famAvg } },
    implication: {},
  };
}

// capital/bodega → signals(capital_concentration): agregación de inmovilizado (Def2) por bodega · el foco + por qué.
export function buildCapitalSignals(scenario) {
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
    .map((r) => ({ sku: r.sku, capital: r.stockUSD, doh: r.doh, alerta: r.alerta }));
  const sensitive = ranking[0];
  const dohBench = invKPI && invKPI.doh ? invKPI.doh : 48;
  const lento = focus.dohAvg >= dohBench * 1.5;
  return {
    what: { entity: focus.bodega, value: focus.capital, unit: "$", metric: "capital", entityType: "bodega" },
    why: { mechanism: "capital_concentration", origin: "internal", target_entity: focus.bodega,
           driver: { mechanism: "capital_concentration", dohAvg: focus.dohAvg, rotAvg: focus.rotAvg, dohBench, pct, lento } },
    implication: { ranking, totalInmov, sensitive: sensitive.sku, sensitiveDoh: sensitive.doh },
  };
}

// cliente/contribución → signals(internal_margin_compression): margen unitario vs benchmark de cartera. Campos
// DIRECTOS (margen, benchmark, venta de clientesMargen) → matchea la regla client.contribucion del motor sellado
// (sin recompute dependiente de scope) → habilita "el peor cliente por contribución" Y el cambio de métrica.
export function buildClientContribSignals(clientName, scenario) {
  const c = applyScenarioToClientesMargen(scenario || "bonanza").find((x) => x.nombre === clientName);
  if (!c || !c.benchmark || typeof c.margen !== "number") return null;
  const gap = +(c.benchmark - c.margen).toFixed(1);
  return {
    what: { entity: clientName, value: c.margen, unit: "%", metric: "contribucion", entityType: "client" },
    why: { mechanism: "internal_margin_compression", origin: "internal", target_entity: clientName,
           driver: { mechanism: "internal_margin_compression", factor: "margen_unitario", value: c.margen, vs_benchmark: gap, unit: "pp" } },
    implication: { action: { verb: "recuperar_margen_unitario", recoverable_K: Math.round(c.venta * (gap / 100)),
                             expected_impact: { metric: "margen", from: c.margen, to: c.benchmark } }, reframe: null },
  };
}

// SKU/contribución → signals(internal_margin_compression): mismo lente que el cliente (margen unitario vs
// benchmark · campos directos de skusMargen) → el cambio de métrica del SKU usa el renderer único.
export function buildSkuContribSignals(skuName) {
  const s = skusMargen.find((x) => x.nombre === skuName);
  if (!s || !s.benchmark || typeof s.margen !== "number") return null;
  const gap = +(s.benchmark - s.margen).toFixed(1);
  return {
    what: { entity: skuName, value: s.margen, unit: "%", metric: "contribucion", entityType: "sku" },
    why: { mechanism: "internal_margin_compression", origin: "internal", target_entity: skuName,
           driver: { mechanism: "internal_margin_compression", factor: "margen_unitario", value: s.margen, vs_benchmark: gap, unit: "pp" } },
    implication: { action: { verb: "recuperar_margen_unitario", recoverable_K: Math.round(s.venta * (gap / 100)),
                             expected_impact: { metric: "margen", from: s.margen, to: s.benchmark } }, reframe: null },
  };
}

// ══════════════════════════ OPERACIÓN · COMPARAR (paso 3b · estado de análisis §3) ══════════════════════════
// Compara DOS entidades del mismo tipo en su métrica, con campos DIRECTOS del dato (exacto · sin recompute
// dependiente de scope) → consistente con la lectura primaria. El porqué de la brecha lo deriva del driver real
// (SKU: costo del precio · cliente: carga comercial). kind "comparison" → el panel lo resuelve con su pack.
function _comp(metric, domain, driverKey, a, b, opts = {}) {
  const betterIsHigher = opts.betterIsHigher !== false;     // margen: más=mejor · capital inmovilizado: menos=mejor
  const gapU = opts.gapUnit || "pp";
  const rawGap = +(a.value - b.value).toFixed(1);
  const aBetter = betterIsHigher ? rawGap >= 0 : rawGap <= 0;
  const better = aBetter ? a.entity : b.entity;
  const worse = aBetter ? b.entity : a.entity;
  const gapAbs = Math.abs(rawGap);
  const gapFmt = opts.gapFmt ? opts.gapFmt(gapAbs) : `${gapAbs}${gapU}`;
  const dDelta = Math.abs(+(a.driverVal - b.driverVal).toFixed(1));
  const dDeltaFmt = opts.driverDeltaFmt ? opts.driverDeltaFmt(dDelta) : `${dDelta}${gapU}`;
  return {
    kind: "comparison", domain, metric, focusType: "comparison",
    focus: `${a.entity} vs ${b.entity}`,
    a, b, gap: gapAbs, gapFmt, better, worse,
    reframe: opts.reframe ? opts.reframe(better, worse, gapFmt)
           : `${better} tiene mejor ${metric} que ${worse}: ${gapFmt} de diferencia`,
    drivers: [
      { v: a.valueFmt, label: `${metric} de ${a.entity}` },
      { v: b.valueFmt, label: `${metric} de ${b.entity}` },
      { v: dDeltaFmt, label: `diferencia en ${driverKey}` },
    ],
    recommendation: opts.recommendation ? opts.recommendation(worse) : `el ${driverKey} explica la brecha — revisaría el de ${worse}`,
    sensitive: worse,
  };
}

// capital inmovilizado por bodega (Def2) bajo el escenario · para comparar bodega↔bodega.
function _bodegaCapital(scenario) {
  const inv = applyScenarioToSkuInventario(scenario).filter(_esInmov);
  const by = {};
  for (const r of inv) (by[r.bodega] = by[r.bodega] || []).push(r);
  const map = {};
  for (const [bodega, rows] of Object.entries(by)) {
    map[bodega] = { capital: rows.reduce((s, r) => s + r.stockUSD, 0), dohAvg: Math.round(rows.reduce((s, r) => s + r.doh, 0) / rows.length) };
  }
  return map;
}

export function buildComparisonReading(entityType, entA, entB, scenario) {
  if (!entA || !entB || entA === entB) return null;
  if (entityType === "bodega") {
    const map = _bodegaCapital(scenario || "bonanza");
    const da = map[entA], db = map[entB];
    if (!da || !db) return null;
    const mk = (name, d) => ({ entity: name, value: d.capital, valueFmt: _fmtMoney(d.capital), driverVal: d.dohAvg, sub: `cobertura ${d.dohAvg}d` });
    return _comp("capital", "inventario", "cobertura", mk(entA, da), mk(entB, db), {
      betterIsHigher: false,                                  // menos capital inmovilizado = mejor
      gapFmt: (g) => _fmtMoney(g), driverDeltaFmt: (d) => `${d}d`,
      reframe: (b, w, g) => `${b} tiene menos capital inmovilizado que ${w}: ${g} de diferencia`,
      recommendation: (w) => `revisaría la cobertura y la salida comercial de ${w}`,
    });
  }
  if (entityType === "sku") {
    const sA = buildSkuMarginSignals(entA), sB = buildSkuMarginSignals(entB);
    if (!sA || !sB) return null;
    const mk = (s) => ({ entity: s.what.entity, value: s.what.value, valueFmt: s.what.value + "%",
                         driverVal: s.why.driver.costShare, sub: `costo ${s.why.driver.costShare}% del precio` });
    return _comp("margen", "margenes", "costo", mk(sA), mk(sB));
  }
  if (entityType === "client") {
    const cm = applyScenarioToClientesMargen(scenario || "bonanza");
    const ca = cm.find((x) => x.nombre === entA), cb = cm.find((x) => x.nombre === entB);
    if (!ca || !cb) return null;
    const mk = (c) => ({ entity: c.nombre, value: c.margen, valueFmt: c.margen + "%",
                         driverVal: c.pctRebate, sub: `carga ${c.pctRebate}%` });
    return _comp("margen", "margenes", "carga", mk(ca), mk(cb));
  }
  return null;   // tipo aún sin comparación (bodega/otros) → el panel no ofrece comparar
}
