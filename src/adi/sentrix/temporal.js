/* === adi/sentrix/temporal.js · Etapa 5 · Sentrix · paso 4 · LA HISTORIA (evolutivo) ===
 * El evolutivo es honestidad aplicada al tiempo. Solo dibuja lo que el dato sostiene de verdad:
 *   - Histórico GLOBAL de ventas (ventasMensuales: este año + año anterior + presupuesto) = REAL → se muestra.
 *   - Histórico POR ENTIDAD (historialMargen) = SINTÉTICO (margen plano) → la capa de capability lo bloquea honesto.
 * Esta función produce SOLO el caso real (global ventas): la serie + el análisis (mín/máx, mayor caída/crecimiento,
 * vs presupuesto, vs año anterior), todo DERIVADO del dato, nunca inventado. Pura · client-side · el motor no la llama
 * (igual que buildComparisonReading) → motor sellado. La regla madre: cada cifra del gráfico cierra con su serie. */
import { ventasMensuales, ventasKPI } from "../../data/baseKpis.js";
import { historialMargen } from "../../data/demoData.js";

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

/* === Evolutivo POR ENTIDAD (owner 2026-07-08: "si está comparando, deberían ser dos curvas") ===
 * Fuente: historialMargen — la tabla mensual por entidad DEL DATASET (la misma que alimenta la película de la
 * brecha). Solo se exponen las métricas cuya serie mensual existe de verdad: venta y contribución. El margen
 * mensual del dataset viene plano (sintético) → sigue bloqueado honesto. Solo 12 meses del año en curso: el
 * "año anterior" mensualizado del historial (÷1.081 uniforme) NO cierra con el KPI anual anterior del cuadro
 * → mostrarlo crearía dos cifras en conflicto; el 24m queda solo en la película global (dato real). */
const _ENTITY_METRICS = {
  venta:        (m) => Number(m.venta),
  contribucion: (m) => Number(m.contribucion),
};

// La serie mensual de UNA entidad + su análisis (pico/valle, mayor alza/caída, trayectoria) — todo derivado.
export function buildEntityEvolution(name, metric = "venta") {
  const H = historialMargen && historialMargen[name];
  const get = _ENTITY_METRICS[metric];
  if (!H || !H.length || !get) return null;
  const meses = H.map((m) => m.mes);
  const serie = H.map(get);
  if (serie.some((v) => !Number.isFinite(v))) return null;
  const n = serie.length;
  const max = Math.max(...serie), min = Math.min(...serie);
  const maxMes = meses[serie.indexOf(max)], minMes = meses[serie.indexOf(min)];
  let drop = { delta: 0, mes: null, from: null }, growth = { delta: 0, mes: null, from: null };
  for (let i = 1; i < n; i++) {
    const d = serie[i] - serie[i - 1];
    if (d < drop.delta) drop = { delta: d, mes: meses[i], from: meses[i - 1] };
    if (d > growth.delta) growth = { delta: d, mes: meses[i], from: meses[i - 1] };
  }
  const first = serie[0], last = serie[n - 1];
  const pct = first ? _round1(((last - first) / first) * 100) : null;
  return { name, metric, meses, serie, n, max, min, maxMes, minMes, drop, growth, first, last, pct, sinCaidas: drop.mes == null };
}

// Las DOS curvas de una comparación + el análisis del PAR: brecha (dónde se abre/cierra) y cruces (quién pasa arriba).
export function buildCompareEvolution(aName, bName, metric = "venta") {
  const A = buildEntityEvolution(aName, metric), B = buildEntityEvolution(bName, metric);
  if (!A || !B || A.n !== B.n || A.n < 2) return null;
  const gap = A.serie.map((v, i) => v - B.serie[i]);
  const absGap = gap.map(Math.abs);
  const iWide = absGap.indexOf(Math.max(...absGap)), iNarrow = absGap.indexOf(Math.min(...absGap));
  const cruces = [];
  for (let i = 1; i < gap.length; i++) {
    if (gap[i] !== 0 && gap[i - 1] !== 0 && Math.sign(gap[i]) !== Math.sign(gap[i - 1]))
      cruces.push({ mes: A.meses[i], arriba: gap[i] > 0 ? aName : bName });
  }
  const aArribaTodo = gap.every((g) => g > 0), bArribaTodo = gap.every((g) => g < 0);
  return {
    a: A, b: B, metric, meses: A.meses, n: A.n, gap,
    gapInicio: gap[0], gapHoy: gap[gap.length - 1],
    wideMes: A.meses[iWide], wideGap: gap[iWide], narrowMes: A.meses[iNarrow], narrowGap: gap[iNarrow],
    cruces, aArribaTodo, bArribaTodo,
  };
}
