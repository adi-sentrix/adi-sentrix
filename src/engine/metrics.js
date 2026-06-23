/* === metrics.js ===
 * MOTOR PURO extraído de 41cc33d8 · misma entrada → misma salida · sin React.
 * Funciones copiadas verbatim; solo se agregan imports. Cero cambio de cálculo. */
import { SCENARIO_TRANSFORMS } from "../config/scenarios.js";
import { MESES_IDX, invKPI, margenKPI, ventasKPI, ventasMensuales } from "../data/baseKpis.js";
import { clientesVentas } from "../data/demoData.js";
import { applyScenarioToClientesVentas } from "./scenarios.js";

export function getVentasKPI(filtro, filtros, scenario="bonanza") {
  const mesIdx = filtro && filtro !== "Anual" ? MESES_IDX[filtro] : -1;
  // ── Base: si hay override de escenario, usarlo; sino ventasKPI estándar
  const scenarioK = SCENARIO_TRANSFORMS[scenario]?.kpis?.ventas;
  const baseSource = scenarioK ? { ...ventasKPI, ...scenarioK } : ventasKPI;
  let base = { ...baseSource };
  if (mesIdx >= 0) {
    const m = ventasMensuales[mesIdx];
    const fAct = m.actual    / ventasKPI.totalActual;
    const fAnt = m.anterior  / ventasKPI.totalAnterior;
    base = {
      ...base,
      totalActual:      Math.round(baseSource.totalActual    * fAct),
      totalAnterior:    Math.round(baseSource.totalAnterior  * fAnt),
      totalPresupuesto: Math.round(baseSource.totalPresupuesto * (m.presupuesto / ventasKPI.totalPresupuesto)),
      vsAnterior: +((m.actual - m.anterior) / m.anterior * 100).toFixed(1),
      vsPresupuesto: +((m.actual - m.presupuesto) / m.presupuesto * 100).toFixed(1),
      unidades:  Math.round(ventasKPI.unidades * fAct),
    };
  }
  // Ajuste por filtros: reducir proporcional a marcas/familias seleccionadas
  if (filtros) {
    // Usar la base de clientes del escenario activo para coherencia
    const baseClientes = scenarioK ? applyScenarioToClientesVentas(scenario) : clientesVentas;
    const allRows = applyFiltros([...baseClientes], filtros);
    if (allRows.length < baseClientes.length) {
      const pct = allRows.reduce((s,r)=>s+r.actual,0) / baseClientes.reduce((s,r)=>s+r.actual,0);
      base.totalActual      = Math.round(base.totalActual * pct);
      base.totalAnterior    = Math.round(base.totalAnterior * pct);
      base.totalPresupuesto = Math.round(base.totalPresupuesto * pct);
    }
  }
  return base;
}

export function getMargenKPI(scenarioId) {
  const k = SCENARIO_TRANSFORMS[scenarioId]?.kpis?.margen;
  if (!k) return margenKPI;
  return { ...margenKPI, ...k };
}

export function getInvKPI(scenarioId) {
  const k = SCENARIO_TRANSFORMS[scenarioId]?.kpis?.inventario;
  if (!k) return invKPI;
  return { ...invKPI, ...k };
}

export function _aggregateVentas(dataset) {
  if (!Array.isArray(dataset) || dataset.length === 0) {
    return { total: 0, crecimientoYoY: 0, concentracionTier1: 0, cuentasExpuestas: [] };
  }
  const total = dataset.reduce((s, c) => s + (c.actual || 0), 0);
  const totalAnt = dataset.reduce((s, c) => s + (c.anterior || 0), 0);
  const crecimientoYoY = totalAnt > 0 ? +(((total - totalAnt) / totalAnt) * 100).toFixed(1) : 0;
  // Tier 1 = top 3 por ventas actuales
  const sorted = [...dataset].sort((a, b) => (b.actual || 0) - (a.actual || 0));
  const top3 = sorted.slice(0, 3);
  const top3Sum = top3.reduce((s, c) => s + (c.actual || 0), 0);
  const concentracionTier1 = total > 0 ? +((top3Sum / total) * 100).toFixed(1) : 0;
  const cuentasExpuestas = top3.map((c, idx) => ({
    cliente: c.nombre,
    contribucion: c.actual,
    tier: idx + 1,
  }));
  return {
    total: Math.round(total),
    totalAnterior: Math.round(totalAnt),
    crecimientoYoY,
    concentracionTier1,
    cuentasExpuestas,
    cuentasCount: dataset.length,
  };
}

export function _aggregateMargenes(dataset) {
  if (!Array.isArray(dataset) || dataset.length === 0) {
    return {
      margenPromedio: 0, cargaComercialPromedio: 0, cuentasBajoBenchmark: 0,
      spread: { min: 0, max: 0, median: 0 }, recuperableBenchmark: 0, recuperableBestPractice: 0,
    };
  }
  const benchmark = dataset[0]?.benchmark || 30.1;
  const margenes_arr = dataset.map(c => c.margen).filter(v => typeof v === "number");
  const cargas_arr = dataset.map(c => c.pctRebate).filter(v => typeof v === "number");
  const margenPromedio = margenes_arr.length > 0
    ? +(margenes_arr.reduce((s, v) => s + v, 0) / margenes_arr.length).toFixed(2) : 0;
  const cargaComercialPromedio = cargas_arr.length > 0
    ? +(cargas_arr.reduce((s, v) => s + v, 0) / cargas_arr.length).toFixed(2) : 0;
  const cuentasBajoBenchmark = dataset.filter(c => (c.margen || 0) < benchmark).length;
  // Spread
  const sortedM = [...margenes_arr].sort((a, b) => a - b);
  const median = sortedM.length > 0
    ? (sortedM.length % 2 === 1
        ? sortedM[Math.floor(sortedM.length / 2)]
        : (sortedM[sortedM.length / 2 - 1] + sortedM[sortedM.length / 2]) / 2)
    : 0;
  // Recuperables: aproximación · si carga > 3.5 (target) → recuperable_at_target
  // si carga > 3.0 (best practice) → recuperable_at_bestPractice
  // Cálculo simplificado para vista agregada · cifras detalladas vienen de scanMechanisms.
  let recuperableBenchmark = 0;
  let recuperableBestPractice = 0;
  for (const c of dataset) {
    const carga = c.pctRebate || 0;
    const venta = c.venta || 0;
    if (carga > 3.5) recuperableBenchmark += venta * ((carga - 3.5) / 100);
    if (carga > 3.0) recuperableBestPractice += venta * ((carga - 3.0) / 100);
  }
  return {
    margenPromedio,
    cargaComercialPromedio,
    cuentasBajoBenchmark,
    cuentasCount: dataset.length,
    benchmark,
    spread: {
      min: sortedM.length > 0 ? +sortedM[0].toFixed(1) : 0,
      max: sortedM.length > 0 ? +sortedM[sortedM.length - 1].toFixed(1) : 0,
      median: +median.toFixed(1),
    },
    recuperableBenchmark: Math.round(recuperableBenchmark),
    recuperableBestPractice: Math.round(recuperableBestPractice),
  };
}

export function _aggregateInventario(dataset) {
  if (!Array.isArray(dataset) || dataset.length === 0) {
    return {
      capitalTotal: 0, capitalAtrapado: 0, capitalPctAtrapado: 0,
      skusCriticos: [], DOHPromedio: 0, skusVirtuosos: 0,
    };
  }
  const capitalTotal = dataset.reduce((s, k) => s + (k.stockUSD || 0), 0);
  const criticos = dataset.filter(
    k => k.alerta === "crit" || k.alerta === "warn" || k.estado !== "Activo"
  );
  const capitalAtrapado = criticos.reduce((s, k) => s + (k.stockUSD || 0), 0);
  const capitalPctAtrapado = capitalTotal > 0
    ? +((capitalAtrapado / capitalTotal) * 100).toFixed(1) : 0;
  const skusCriticos = [...criticos]
    .sort((a, b) => (b.stockUSD || 0) - (a.stockUSD || 0))
    .slice(0, 5)
    .map(k => ({ sku: k.sku, capitalUSD: k.stockUSD, DOH: k.doh }));
  const doh_arr = dataset.map(k => k.doh).filter(v => typeof v === "number");
  const DOHPromedio = doh_arr.length > 0
    ? Math.round(doh_arr.reduce((s, v) => s + v, 0) / doh_arr.length) : 0;
  const skusVirtuosos = dataset.filter(
    k => k.alerta === "ok" && k.estado === "Activo" && (k.rotacion || 0) >= 8
  ).length;
  return {
    capitalTotal: Math.round(capitalTotal),
    capitalAtrapado: Math.round(capitalAtrapado),
    capitalPctAtrapado,
    skusCriticos,
    skusCriticosCount: criticos.length,
    DOHPromedio,
    skusVirtuosos,
    skusCount: dataset.length,
  };
}

export function applyFiltros(rows, filtros) {
  if (!filtros) return rows;
  return rows.filter(r => {
    if (filtros.marcas?.length    && !filtros.marcas.includes(r.marca))                                           return false;
    if (filtros.sfamilias?.length && !filtros.sfamilias.includes(r.sfamilia))                                     return false;
    if (filtros.canales?.length   && r.canal    && !filtros.canales.includes(r.canal))                            return false;
    // BRIEF #23-quinquies · FIX B · cruzamiento de dimensiones.
    // Solo filtrar por clientes/skus cuando la fila ES de ese tipo
    // (r.tipo discriminador, presente en los 4 datasets de margen).
    // Sin este check, filtrar por 3 clientes y cambiar dim a Familia
    // intentaba matchear "Electrodomésticos" contra ["Falabella",...]
    // y vaciaba la tabla. Ahora: cuando la dim no es cliente, el filtro
    // de clientes no aplica como filtro literal; la tabla muestra todas
    // las familias/marcas/SKUs disponibles. Mismo principio para skus.
    if (filtros.clientes?.length && r.tipo === "cliente"
        && r.nombre   && !filtros.clientes.includes(r.nombre))                                                    return false;
    if (filtros.skus?.length      && (r.tipo === "sku" || (!r.tipo && (r.nombre || r.sku)))
        && !filtros.skus.includes(r.nombre ?? r.sku))                                                              return false;
    return true;
  });
}
