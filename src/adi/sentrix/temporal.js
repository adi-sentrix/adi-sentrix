/* === adi/sentrix/temporal.js · Etapa 5 · Sentrix · paso 4 · LA HISTORIA (evolutivo) ===
 * El evolutivo es honestidad aplicada al tiempo. Solo dibuja lo que el dato sostiene de verdad:
 *   - Histórico GLOBAL de ventas (ventasMensuales: este año + año anterior + presupuesto) = REAL → se muestra.
 *   - Histórico POR ENTIDAD (historialMargen) = SINTÉTICO (margen plano) → la capa de capability lo bloquea honesto.
 * Esta función produce SOLO el caso real (global ventas): la serie + el análisis (mín/máx, mayor caída/crecimiento,
 * vs presupuesto, vs año anterior), todo DERIVADO del dato, nunca inventado. Pura · client-side · el motor no la llama
 * (igual que buildComparisonReading) → motor sellado. La regla madre: cada cifra del gráfico cierra con su serie. */
import { ventasMensuales, ventasKPI } from "../../data/baseKpis.js";
import { historialMargen, clientesMargen, clientesVentas, marcasMargen, sfamiliasMargen } from "../../data/demoData.js";
import { skusMargen } from "../../data/skusMargen.js";

const _sum = (a) => a.reduce((x, y) => x + y, 0);
const _round1 = (n) => Math.round(n * 10) / 10;

// ── ANCLA DEL PERÍODO (owner 2026-07-10: "deben quedar todos conectados — fijate bien en eso"): el total anual de
// cada serie mensual del historial NO cerraba con el dato del período que muestran el cuadro y el perfil (venta
// −3.4%…+5% según entidad — dos verdades). Cada serie se RE-ANCLA a su valor del período (la forma mes a mes viene
// del historial; el total cierra EXACTO — la misma técnica `distribuir` del dataset). Una sola verdad por métrica:
// venta → clientesVentas.actual / venta de la tabla del eje · contribución → contribución almacenada · margen del
// período → para normalizar la curva derivada c/v · acciones → rebates almacenados. ──
const _PERIOD = (() => {
  const m = new Map();
  for (const c of clientesMargen) {
    const cv = clientesVentas.find((x) => x.nombre === c.nombre);
    m.set(c.nombre, { venta: cv ? cv.actual : c.venta, contribucion: c.contribucion, margen: c.margen, acciones: c.rebates });
  }
  for (const x of marcasMargen)    m.set(x.nombre, { venta: x.venta, contribucion: x.contribucion, margen: x.margen, acciones: x.rebates });
  for (const f of sfamiliasMargen) m.set(f.nombre, { venta: f.venta, contribucion: f.contribucion, margen: f.margen, acciones: f.rebates });
  for (const s of skusMargen)      m.set(s.nombre, { venta: s.venta, contribucion: s.contribucion, margen: s.margen, acciones: s.rebates });   // OJO: la clave es `nombre` (el gate de conexión cazó que con `sku` los SKU quedaban SIN ancla)
  return m;
})();
// re-ancla una serie a un total del período (forma intacta · total exacto · cuadre en el último mes)
const _anchor = (serie, total) => {
  const sHist = _sum(serie);
  if (!Number.isFinite(total) || total <= 0 || !sHist) return serie;
  const k = total / sHist;
  const out = serie.map((v) => Math.round(v * k));
  out[out.length - 1] += total - _sum(out);
  return out;
};

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
  // ACCIONES DE PRECIOS (owner 2026-07-10 · Ficha de entidad): rebates/descuentos $ del mes — serie REAL del
  // historial (la misma que alimenta "qué se movió debajo" del compare a fondo). Se modula con la estacionalidad
  // global igual que la venta (van atadas a la venta · el total del historial se conserva exacto).
  acciones:     (m) => Number(m.rebates),
};

// La serie mensual de UNA entidad + su análisis (pico/valle, mayor alza/caída, trayectoria) — todo derivado.
export function buildEntityEvolution(name, metric = "venta") {
  const H = historialMargen && historialMargen[name];
  if (!H || !H.length) return null;
  const P = _PERIOD.get(name) || {};
  // MARGEN DERIVADO (owner 2026-07-10: "si hay contribución debe tener"): margen del mes = contribución ÷ venta de
  // las MISMAS dos series de la ficha, normalizado para que el agregado del año cierre EXACTO con el margen del
  // período (el del perfil y el cuadro) — conectado por construcción, no una serie aparte. El campo margen plano
  // del historial (sintético) sigue sin usarse.
  if (metric === "margen") {
    const V = buildEntityEvolution(name, "venta");
    const Cc = buildEntityEvolution(name, "contribucion");
    if (!V || !Cc || V.n !== Cc.n || V.serie.some((v) => v <= 0)) return null;
    let serie = V.serie.map((v, i) => (Cc.serie[i] / v) * 100);
    const agg = (_sum(Cc.serie) / Math.max(_sum(V.serie), 1)) * 100;
    serie = serie.map((v) => _round1(Number.isFinite(P.margen) && agg > 0 ? v * (P.margen / agg) : v));
    return _entityAnalysis(name, metric, V.meses, serie);
  }
  const get = _ENTITY_METRICS[metric];
  if (!get) return null;
  const meses = H.map((m) => m.mes);
  let serie = H.map(get);
  if (serie.some((v) => !Number.isFinite(v))) return null;
  // La venta del historial viene como TENDENCIA suavizada (rampa). Para que el mes a mes refleje el negocio real
  // (owner 2026-07-08: "debe reflejar las alzas y bajas, como la curva global"), se modula con la estacionalidad
  // REAL de la curva global (ventasMensuales) y se re-escala para conservar el total del historial — la misma
  // técnica `distribuir` que el dataset usa para mensualizar contribución. No se inventa ruido por entidad:
  // tendencia (dato del historial) × estacionalidad (dato global real), y el total cierra exacto.
  if ((metric === "venta" || metric === "acciones") && Array.isArray(ventasMensuales) && ventasMensuales.length === serie.length) {
    const g = ventasMensuales.map((m) => Number(m.actual));
    const gMean = _sum(g) / g.length;
    if (gMean > 0 && g.every((v) => Number.isFinite(v))) {
      const total = _sum(serie);
      let mod = serie.map((v, i) => v * (g[i] / gMean));
      const k = _sum(mod) ? total / _sum(mod) : 1;
      mod = mod.map((v) => Math.round(v * k));
      mod[mod.length - 1] += total - _sum(mod);   // cuadre exacto al total (técnica del dataset)
      serie = mod;
    }
  }
  // ANCLA AL PERÍODO (owner 2026-07-10 · "todos conectados"): el total del año cierra EXACTO con el dato que
  // muestran el cuadro y el perfil — una sola verdad por métrica, la forma mensual la pone el historial.
  const anchorTotal = metric === "venta" ? P.venta : metric === "contribucion" ? P.contribucion : metric === "acciones" ? P.acciones : null;
  if (anchorTotal != null) serie = _anchor(serie, anchorTotal);
  return _entityAnalysis(name, metric, meses, serie);
}

// análisis de una serie mensual (pico/valle · mayor alza/caída · trayectoria) — compartido por todas las métricas
function _entityAnalysis(name, metric, meses, serie) {
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
