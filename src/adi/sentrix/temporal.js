/* === adi/sentrix/temporal.js · Etapa 5 · Sentrix · paso 4 · LA HISTORIA (evolutivo) ===
 * El evolutivo es honestidad aplicada al tiempo. Solo dibuja lo que el dato sostiene de verdad:
 *   - Histórico GLOBAL de ventas (ventasMensuales: este año + año anterior + presupuesto) = REAL → se muestra.
 *   - Histórico POR ENTIDAD (historialMargen) = SINTÉTICO (margen plano) → la capa de capability lo bloquea honesto.
 * Esta función produce SOLO el caso real (global ventas): la serie + el análisis (mín/máx, mayor caída/crecimiento,
 * vs presupuesto, vs año anterior), todo DERIVADO del dato, nunca inventado. Pura · client-side · el motor no la llama
 * (igual que buildComparisonReading) → motor sellado. La regla madre: cada cifra del gráfico cierra con su serie. */
import { ventasMensuales, ventasKPI } from "../../data/baseKpis.js";

const _sum = (a) => a.reduce((x, y) => x + y, 0);
const _round1 = (n) => Math.round(n * 10) / 10;

// Construye el evolutivo GLOBAL de ventas desde la serie real. Devuelve datos + análisis (sin render).
export function buildGlobalEvolution() {
  const M = ventasMensuales || [];
  const meses = M.map((m) => m.mes);
  const actual = M.map((m) => Number(m.actual));
  const anterior = M.map((m) => Number(m.anterior));
  const presupuesto = M.map((m) => Number(m.presupuesto));
  const n = actual.length;

  // 24 meses secuenciales REALES: año anterior (12) seguido de año actual (12).
  const seq24 = [
    ...M.map((m) => ({ mes: m.mes, anio: "anterior", v: Number(m.anterior) })),
    ...M.map((m) => ({ mes: m.mes, anio: "actual", v: Number(m.actual) })),
  ];

  // mín / máx del año en foco (actual).
  const max = Math.max(...actual), min = Math.min(...actual);
  const maxMes = meses[actual.indexOf(max)] || null;
  const minMes = meses[actual.indexOf(min)] || null;

  // mayor caída / mayor crecimiento mes a mes (deltas reales).
  let drop = { delta: 0, mes: null, from: null }, growth = { delta: 0, mes: null, from: null };
  for (let i = 1; i < n; i++) {
    const d = actual[i] - actual[i - 1];
    if (d < drop.delta) drop = { delta: d, mes: meses[i], from: meses[i - 1] };
    if (d > growth.delta) growth = { delta: d, mes: meses[i], from: meses[i - 1] };
  }

  // totales y comparaciones. FUENTE DE VERDAD = ventasKPI (lo que muestran las tarjetas) → el gráfico y la tarjeta
  // cierran. La serie mensual del año anterior suma 93000 pero la KPI canónica dice 92900 (micro-inconsistencia del
  // propio dato · 0.1%); usamos la KPI para que no haya dos cifras distintas de "año anterior" lado a lado.
  const totAct = ventasKPI ? Number(ventasKPI.totalActual) : _sum(actual);
  const totAnt = ventasKPI ? Number(ventasKPI.totalAnterior) : _sum(anterior);
  const totPpto = ventasKPI ? Number(ventasKPI.totalPresupuesto) : _sum(presupuesto);
  const vsAnterior = totAnt ? _round1(((totAct - totAnt) / totAnt) * 100) : 0;
  const vsPresupuesto = totPpto ? _round1(((totAct - totPpto) / totPpto) * 100) : 0;

  return {
    scope: "global", metric: "ventas", confidence: "high",
    meses, actual, anterior, presupuesto, seq24, n, nSeq: seq24.length,
    max, min, maxMes, minMes, drop, growth,
    totAct, totAnt, totPpto, vsAnterior, vsPresupuesto,
  };
}
