/* === metrics.js ===
 * MOTOR PURO extraído de 41cc33d8 · misma entrada → misma salida · sin React.
 * Funciones copiadas verbatim; solo se agregan imports. Cero cambio de cálculo. */
import { getTenantData } from "../data/tenantStore.js";
import { factorComercialDe } from "../config/contract/figureType.js";
import { benchmarkOf } from "../config/businessPolicy.js";   // la vara única: la puerta (criterio → perfil → config), jamás un literal
// miles VERDADEROS del monto almacenado (barrido A·maquinaria 2026-08-30) — con el demo es la identidad
const _enK = (v) => (Number(v) || 0) * factorComercialDe(getTenantData()) / 1e3;
import { MESES_IDX, margenKPI, ventasKPI, ventasMensuales } from "../data/baseKpis.js";
import { clientesVentas } from "../data/demoData.js";
import { applyScenarioToSkuInventario } from "./scenarios.js";
import { ESCENARIO_INICIAL } from "../config/scenarios.js";   // colapso del eje: la base real se declara UNA vez
import { kpiInventario, jerarquiaInventario } from "../adi/diagnosis/economicDiagnosis.js";   // R7 (owner 2026-09-28): getInvKPI deja de leer el literal — misma fuente única que deriveKpis().inventario · jerarquiaInventario: _aggregateInventario (§7.3·30-32)

export function getVentasKPI(filtro, filtros, scenario = ESCENARIO_INICIAL) {
  const mesIdx = filtro && filtro !== "Anual" ? MESES_IDX[filtro] : -1;
  /* UNA SOLA REALIDAD (owner 2026-10-06): la cabecera es la del pack — en el demo se DERIVA de las mismas filas
   * (tenants/demo.js), en una planilla la mide la ingesta (motorKpi). Ya no hay un `kpis` literal de escenario que
   * la pise: antes «bonanza» declaraba 99.999 mientras las filas sumaban 99.887 y la tabla 100.000. */
  const baseSource = ventasKPI;
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
    const baseClientes = clientesVentas;   // la realidad: la tabla del tenant
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

/* ⚠️ LA VARA ES POLÍTICA VIVA, NO UN DATO DEL PERÍODO (ley de la vara única, 2026-09-03 · hallazgo medido con la
 * sonda del supervisor). `margenKPI.benchmark` lo CONGELA la ingesta: si el negocio declara su benchmark
 * DESPUÉS de cargar el archivo —el mismo caso del plazo de cobro, que sí re-arma su cara con lo guardado— el
 * KPI de cabecera seguía mostrando la vara vieja mientras el motor, la Mesa y ADI ya usaban la nueva. Cuatro
 * superficies, dos varas: exactamente lo que esta ley existe para impedir.
 * LA REGLA: si el pack DECLARA una vara, la VIGENTE (la puerta `benchmarkOf`, que resuelve criterio → perfil →
 * config) manda sobre la congelada, y la brecha se recompone con la MISMA cuenta declarada por el owner
 * (brecha = benchmark − margen actual). Un pack que no declara benchmark queda BYTE-IDÉNTICO: el demo y
 * empresa-2 no traen el campo, así que no se les inventa uno. */
export function getMargenKPI(scenarioId) {
  const base = margenKPI;   // una sola realidad: el KPI del pack (en el demo, derivado de las mismas filas) — sin `kpis` de escenario que lo pise
  if (typeof base.benchmark !== "number") return base;               // sin vara declarada: nada que refrescar
  const vigente = benchmarkOf(null);
  if (!Number.isFinite(vigente) || vigente === base.benchmark) return base;
  return { ...base, benchmark: vigente,
    brechaPuntos: typeof base.pct === "number" ? Math.round((vigente - base.pct) * 10) / 10 : base.brechaPuntos };
}

/* getInvKPI(scenarioId) → el indicador de inventario, CALCULADO (owner 2026-09-28, §7.3·31-32; diseño §8.2/R7).
 * Antes leía el literal `invKPI` del tenant y, si el escenario declaraba un override a mano, lo pisaba con OTRO
 * literal — así `overview.js` (única consumidora) podía quedar leyendo un número de tensión/crisis que ni
 * siquiera cerraba con sus propias filas (diseño §0.4). Ahora es la MISMA fuente única que `deriveKpis().inventario`:
 * `kpiInventario` sobre las filas del escenario. Mismo contrato de llaves (`totalUSD`, `doh`, `inmovilizadoUSD`,
 * `inmovilizadoPct`, más lo nuevo) — `overview.js` no cambia, cambia de dónde sale el número (diseño §2, tabla). */
export function getInvKPI(scenarioId) {
  return kpiInventario(applyScenarioToSkuInventario(scenarioId));
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
  const benchmark = benchmarkOf(dataset[0] || null);   // la vara: SIEMPRE por la puerta (benchmarkOf) — jamás un literal (ley de la vara única, 2026-09-03)
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
    recuperableBenchmark: Math.round(_enK(recuperableBenchmark)),
    recuperableBestPractice: Math.round(_enK(recuperableBestPractice)),
  };
}

/* LEE `jerarquiaInventario` (owner 2026-09-28, §7.3·30-32, diseño §2/R1-R2/R9): antes `criticos` mezclaba la
 * alerta del archivo (R9, ningún pack real la trae) con el texto crudo `estado !== "Activo"` (R2 — marca el
 * 100% del capital en una planilla real). Ahora `capitalAtrapado`/`skusCriticos` son `J.inmovilizado`
 * (capital_frenado ⊎ sobrestock), la única definición aprobada — mismo contrato de llaves de salida. */
export function _aggregateInventario(dataset) {
  if (!Array.isArray(dataset) || dataset.length === 0) {
    return {
      capitalTotal: 0, capitalAtrapado: 0, capitalPctAtrapado: 0,
      skusCriticos: [], DOHPromedio: 0, skusVirtuosos: 0,
    };
  }
  const capitalTotal = dataset.reduce((s, k) => s + (k.stockUSD || 0), 0);
  const J = jerarquiaInventario(dataset);
  const inmovSet = new Set(J.inmovilizado.skus);
  const criticos = dataset.filter(k => inmovSet.has(k.sku));
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
