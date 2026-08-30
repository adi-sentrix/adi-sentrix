/* === adi/sentrix/temporal.js · Etapa 5 · Sentrix · paso 4 · LA HISTORIA (evolutivo) ===
 * El evolutivo es honestidad aplicada al tiempo. Solo dibuja lo que el dato sostiene de verdad:
 *   - Histórico GLOBAL de ventas (ventasMensuales: este año + año anterior + presupuesto) = REAL → se muestra.
 *   - Histórico POR ENTIDAD (historialMargen) = SINTÉTICO (margen plano) → la capa de capability lo bloquea honesto.
 * Esta función produce SOLO el caso real (global ventas): la serie + el análisis (mín/máx, mayor caída/crecimiento,
 * vs presupuesto, vs año anterior), todo DERIVADO del dato, nunca inventado. Pura · client-side · el motor no la llama
 * (igual que buildComparisonReading) → motor sellado. La regla madre: cada cifra del gráfico cierra con su serie. */
import { ventasMensuales, ventasKPI } from "../../data/baseKpis.js";
import { historialMargen, clientesMargen, clientesVentas, marcasVentas, marcasMargen, sfamiliasVentas, sfamiliasMargen } from "../../data/demoData.js";
import { skusMargen } from "../../data/skusMargen.js";
import { onTenantChange } from "../../data/tenantStore.js";   // F1 multiempresa · las anclas del período se re-arman en initTenant
import { esSerieDelArchivo } from "./capability.js";          // UNA definición de «serie real», compartida con la capa de disponibilidad
import { getVentasKPI } from "../../engine/metrics.js";       // el total de ventas DEL ESCENARIO (el mismo que lee la card de la Mesa) — ver buildGlobalEvolutionAnclada

const _sum = (a) => a.reduce((x, y) => x + y, 0);
const _round1 = (n) => Math.round(n * 10) / 10;

// resolveEntityName (owner "estas son preguntas simples", hallazgo en vivo 2026-07-29): historialMargen es una key
// FLAT (cliente∪marca∪familia∪sku) accedida por igualdad EXACTA — si el plan manda el nombre con otra mayúscula o
// acento que como lo tipeó el usuario ("falabella" en vez de "Falabella"), `historialMargen[name]` da undefined y
// el turno entero declina "no tengo esa serie", aunque el dato SÍ existe. Se resuelve contra las keys REALES antes
// de cualquier acceso — mismo patrón `_norm` ya probado en coerceChain.js/composers/temporalTable.js (duplicado acá
// a propósito: son módulos de capas distintas del pipeline, no vale la pena acoplarlos por una función de 1 línea).
const _norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
export function resolveEntityName(name) {
  if (name == null || (historialMargen && historialMargen[name])) return name;   // match exacto ya funciona, no tocar
  const target = _norm(name);
  for (const k of Object.keys(historialMargen || {})) if (_norm(k) === target) return k;
  return name;   // sin match → tal cual (el caller declina honesto, no se inventa un nombre)
}

// ── ANCLA DEL PERÍODO (owner 2026-07-10: "deben quedar todos conectados — fijate bien en eso"): el total anual de
// cada serie mensual del historial NO cerraba con el dato del período que muestran el cuadro y el perfil (venta
// −3.4%…+5% según entidad — dos verdades). Cada serie se RE-ANCLA a su valor del período (la forma mes a mes viene
// del historial; el total cierra EXACTO — la misma técnica `distribuir` del dataset). Una sola verdad por métrica:
// venta → clientesVentas.actual / venta de la tabla del eje · contribución → contribución almacenada · margen del
// período → para normalizar la curva derivada c/v · acciones → rebates almacenados. ──
function _buildPeriod() {
  const m = new Map();
  for (const c of clientesMargen) {
    const cv = clientesVentas.find((x) => x.nombre === c.nombre);
    m.set(c.nombre, { venta: cv ? cv.actual : c.venta, contribucion: c.contribucion, margen: c.margen, acciones: c.rebates });
  }
  for (const x of marcasMargen)    m.set(x.nombre, { venta: x.venta, contribucion: x.contribucion, margen: x.margen, acciones: x.rebates });
  for (const f of sfamiliasMargen) m.set(f.nombre, { venta: f.venta, contribucion: f.contribucion, margen: f.margen, acciones: f.rebates });
  for (const s of skusMargen)      m.set(s.nombre, { venta: s.venta, contribucion: s.contribucion, margen: s.margen, acciones: s.rebates });   // OJO: la clave es `nombre` (el gate de conexión cazó que con `sku` los SKU quedaban SIN ancla)
  return m;
}
let _PERIOD = _buildPeriod();   // F1 multiempresa · se re-arma en initTenant (nunca más solo en import)
// re-ancla una serie a un total del período (forma intacta · total exacto · cuadre en el último mes)
const _anchor = (serie, total) => {
  const sHist = _sum(serie);
  if (!Number.isFinite(total) || total <= 0 || !sHist) return serie;
  const k = total / sHist;
  const out = serie.map((v) => Math.round(v * k));
  out[out.length - 1] += total - _sum(out);
  return out;
};
/* ── ¿ESTA SERIE SALE DEL ARCHIVO DEL CLIENTE? (owner 2026-08-30 · ingesta con grano fino) ─────────────────────
 * Se reconoce porque CADA punto declara el período del que se sumó. Un histórico modelado no lo trae —no lo
 * tiene: sus meses son una rampa, no la suma de las filas de un mes—, así que el dataset de fábrica sigue
 * exactamente por donde iba y esta rama no lo toca.
 *
 * ⚠️ POR QUÉ IMPORTA LA DISTINCIÓN, y no es cosmética. Todo lo que hace la rama de abajo —modular con la
 * estacionalidad global y RE-ESCALAR la serie al total del período— existe para arreglar un histórico sintético:
 * su forma es inventada y su total no cierra, así que se le impone la forma del negocio y se lo ancla. Aplicarle
 * eso a una serie REAL la destruye. Medido con el pack de la plantilla de ejemplo: la serie de una cuenta era
 * [19.637 · 20.600] —los dos meses que el usuario cargó— y salía [10.098 · 10.502], porque el ancla comprimía los
 * DOS meses para que sumaran la venta de UNO. Es decir: la respuesta a «cuánto me compró el último mes» habría
 * salido a la mitad, con cara de cifra verificada.
 *
 * LA REGLA VIVE EN `capability.js` y se importa: es la misma con la que la capa de disponibilidad decide si
 * enciende la película por entidad. Dos copias de esta condición serían dos definiciones de «serie real», y el
 * día que una cambiara, la capability diría que se puede y esto serviría otra cosa. */
const _esSerieDelArchivo = esSerieDelArchivo;

/* La serie del archivo NO se re-escala: cada punto ya es la suma de las filas de su mes. Lo que sí se EXIGE es
 * que la cifra oficial del período esté EN la serie —el mes informado tiene que coincidir exacto con lo que el
 * resto del producto muestra—. Si no coincide son dos verdades del mismo negocio, y la regla de la casa es
 * servir una o ninguna: se declina. La ingesta ya deja fuera a la entidad que no cierra; esto es el segundo
 * cerrojo, del lado del que sirve, para que un pack armado por otro camino tampoco pueda colarla. */
function _serieDelArchivo(name, metric, H, serie, oficial) {
  if (oficial != null && !serie.some((v) => v === oficial)) return null;
  return _entityAnalysis(name, metric, H.map((m) => m.mes), serie);
}

// EXPORTADO (owner 2026-08-07 · Resumen comercial): el evolutivo de la cara Comercial tiene que cerrar con la venta
// OFICIAL por cliente, y la serie mensual vive en OTRA tabla del dataset (difieren ~0.1%). Se reusa ESTA técnica en
// vez de copiarla: reescala la curva y deja el residuo en el último mes, así el total queda exacto y la FORMA del
// año (picos, valles, caídas) intacta. Aditivo puro — no cambia una sola línea del comportamiento existente.
export const anchorSerie = _anchor;

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

/* ── LA CURVA DEL NEGOCIO, ANCLADA · UNA implementación para las DOS puntas ────────────────────────────────────
 * (owner 2026-08-09, decisión 4 · hallazgo C: "Sentrix y ADI deben consumir LA MISMA transformación de escenario,
 *  nunca implementaciones paralelas")
 *
 * EL DEFECTO QUE CIERRA. `buildGlobalEvolution()` devuelve la serie CRUDA de `ventasMensuales`: no conoce el
 * escenario y no cierra con la venta oficial por cliente (Σ mensual = 100.000 · Σ clientesVentas = 99.887 en
 * bonanza, 92.828 en tensión, 81.091 en crisis). El evolutivo de Sentrix ya resolvía las dos cosas anclando con
 * `anchorSerie`; `composeSpecTemporal` llamaba a `buildGlobalEvolution()` pelado. Resultado medido: la pantalla
 * decía $99.9M / $92.8M / $81.1M y `trend` contestaba $100.0M en los tres — cifra real, escenario ajeno.
 *
 * QUÉ ANCLA Y QUÉ NO. Las dos series con contraparte oficial por cliente (este año, año anterior) se re-escalan a
 * ese total; el PRESUPUESTO no, porque es un plan declarado y no tiene contraparte por cliente contra la cual
 * conciliarlo. Es la misma regla que ya declaraba la leyenda del gráfico, ahora en un solo lugar.
 *
 * DE DÓNDE SALE EL ANCLA. `getVentasKPI(null, null, scenario)` — la MISMA llamada que hace `sentrix/mesa.js` para
 * la card de ventas, y el total que el owner ya declaró como una sola verdad con la respuesta de ADI (2026-07-15).
 * Es scenario-aware (`SCENARIO_TRANSFORMS[scn].kpis.ventas`: 99.999 · 92.892 · 81.182), a diferencia de
 * `ventasKPI`, que es un literal fijo y es el que hacía que la tool contestara lo mismo en los tres escenarios.
 * NO se usa `deriveKpis` (Σ de las filas transformadas: 99.887 · 92.828 · 81.091) aunque sea el total de la cara
 * Comercial: son dos anclas separadas por el ~0,1% que el dataset arrastra entre `ventasKPI` y Σ`clientesVentas`,
 * y elegir cuál es LA venta oficial es decisión del owner. Acá se conserva la que ADI ya tenía comprometida y el
 * resto queda declarado en el manifiesto.
 */
export function ventaOficialDelPeriodo(scenario = "actual") {
  const k = getVentasKPI(null, null, scenario) || {};
  return { actual: k.totalActual || null, anterior: k.totalAnterior || null };
}
// `oficial` explícito gana sobre el escenario: el llamador que YA resolvió su venta oficial (Sentrix, desde el
// total del cuadro) sigue anclando contra la suya, byte-idéntico — lo que se comparte es el anclaje, no el ancla.
export function buildGlobalEvolutionAnclada(scenario = "actual", oficial = null) {
  const ev = buildGlobalEvolution();
  if (!ev || !ev.n || !Array.isArray(ev.actual)) return null;
  const of = oficial || ventaOficialDelPeriodo(scenario);
  return {
    ...ev,
    actual:      of && of.actual   ? _anchor(ev.actual, of.actual)     : ev.actual,
    anterior:    of && of.anterior ? _anchor(ev.anterior, of.anterior) : ev.anterior,
    presupuesto: ev.presupuesto,
    oficial: of || null,
    anclada: { actual: !!(of && of.actual), anterior: !!(of && of.anterior), presupuesto: false },
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
  name = resolveEntityName(name);
  const H = historialMargen && historialMargen[name];
  if (!H || !H.length) return null;
  const P = _PERIOD.get(name) || {};
  const delArchivo = _esSerieDelArchivo(H);
  /* MARGEN DEL ARCHIVO · cuando la serie sale de las filas del cliente, el margen de cada mes YA está calculado
   * con la fórmula declarada sobre las filas de ESE mes; no hay nada que derivar ni que normalizar. Un mes sin
   * venta no tiene margen (no hay denominador) y llega en null: entonces no hay serie de margen y se declina —
   * antes que rellenar ese mes con un 0% que diría «marginó cero» en vez de «no vendió». */
  if (delArchivo && metric === "margen") {
    const serie = H.map((m) => m.margen);
    if (serie.some((v) => !Number.isFinite(v))) return null;
    return _serieDelArchivo(name, metric, H, serie, P.margen);
  }
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
  /* SERIE DEL ARCHIVO · se sirve tal cual, con el mes informado exigido a coincidir. Ni estacionalidad impuesta
   * ni re-escalado: los dos existen para enderezar un histórico modelado, y sobre dato real lo tuercen. */
  if (delArchivo) {
    const oficial = metric === "venta" ? P.venta : metric === "contribucion" ? P.contribucion : metric === "acciones" ? P.acciones : null;
    return _serieDelArchivo(name, metric, H, serie, oficial);
  }
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

/* === Evolutivo por entidad COMPARADO vs año anterior (owner 2026-07-15 · Cuadro 2.0 pase 1b: "debe ir comparado
 * contra el año anterior") — la curva del cuadro pasa de evolutiva a comparada, HONESTA por entidad:
 *   - `actual` = buildEntityEvolution intacto (la MISMA serie anclada de la Ficha — una verdad).
 *   - `anterior` SOLO donde el dataset DECLARA el total del año anterior de esa entidad (clientesVentas/marcasVentas/
 *     sfamiliasVentas.anterior · métrica venta). La forma mensual la pone el historial (ventaAnt) modulada con la
 *     estacionalidad global REAL del año anterior (ventasMensuales.anterior) y se ANCLA a ese total — la misma
 *     técnica del actual, así el ghost cierra EXACTO con el "vs año anterior" que ya muestran los movers y el 80/20.
 *   - Sin total declarado NO se fabrica: contribución/margen (el contribucionAnt del historial es ÷1.081 uniforme —
 *     contradiría el YoY por entidad de la venta: Ripley cae −8% y "crecería" +8%) y los SKU (skusMargen no trae
 *     `anterior`) devuelven anterior:null → la curva va sola, sin ghost (honesto, como bodega sin serie hoy). */
function _buildPeriodAnt() {
  const m = new Map();
  for (const t of [clientesVentas, marcasVentas, sfamiliasVentas])
    for (const x of t || []) if (Number.isFinite(Number(x.anterior))) m.set(x.nombre, Number(x.anterior));
  return m;
}
let _PERIOD_ANT = _buildPeriodAnt();
onTenantChange(() => { _PERIOD = _buildPeriod(); _PERIOD_ANT = _buildPeriodAnt(); });
export function buildEntityEvolutionComparado(name, metric = "venta") {
  name = resolveEntityName(name);
  const A = buildEntityEvolution(name, metric);
  if (!A) return null;
  let anterior = null;
  const antTotal = metric === "venta" ? _PERIOD_ANT.get(name) : null;
  const H = historialMargen && historialMargen[name];
  /* ⚠️ EN UNA SERIE DEL ARCHIVO, «anterior» SON DOS COSAS DISTINTAS y no se pueden mezclar: `ventaAnt` es el
   * MISMO MES DEL AÑO PASADO (lo trae el archivo sólo si el cliente cargó ese año), mientras que el `.anterior`
   * de la tabla del eje es EL PERÍODO PREVIO —el mes pasado— porque en un pack de planilla el período es un mes.
   * Anclar la curva del año anterior al total del mes anterior mezclaría los dos universos en una sola línea.
   * Así que el ghost se sirve tal cual lo trae el archivo, o no se sirve: si algún mes no tiene su homólogo del
   * año anterior, `ventaAnt` llega en null y la curva va sola —honesto, como la bodega sin serie. */
  if (_esSerieDelArchivo(H)) {
    if (metric === "venta" && H.length === A.n) {
      /* ⚠️ `Number(null)` es 0, y 0 es finito: comprobar sólo la finitud daba una curva de ceros para el negocio
       * que cargó un año solo — un año anterior inventado en plano, dibujado como si fuera dato. El mes sin
       * homólogo se reconoce por el null, antes de convertirlo. */
      const serie = H.map((x) => x.ventaAnt);
      if (serie.every((v) => typeof v === "number" && Number.isFinite(v))) anterior = { serie, total: _sum(serie) };
    }
    return { ...A, anterior };
  }
  if (antTotal != null && H && H.length === A.n) {
    let serie = H.map((x) => Number(x.ventaAnt));
    if (serie.every(Number.isFinite)) {
      // tendencia (historial) × estacionalidad global del AÑO ANTERIOR (dato real) · total conservado — como el actual
      if (Array.isArray(ventasMensuales) && ventasMensuales.length === serie.length) {
        const g = ventasMensuales.map((x) => Number(x.anterior));
        const gMean = _sum(g) / g.length;
        if (gMean > 0 && g.every(Number.isFinite)) {
          const total = _sum(serie);
          let mod = serie.map((v, i) => v * (g[i] / gMean));
          const k = _sum(mod) ? total / _sum(mod) : 1;
          mod = mod.map((v) => Math.round(v * k));
          mod[mod.length - 1] += total - _sum(mod);
          serie = mod;
        }
      }
      serie = _anchor(serie, antTotal);   // cierra EXACTO con el `anterior` declarado del eje (una verdad con los movers)
      anterior = { serie, total: antTotal };
    }
  }
  return { ...A, anterior };
}

/* === El evolutivo DEL NEGOCIO por eje (owner 2026-07-15 · pase 1d: "si no hay nada seleccionado, es el negocio") ===
 * La suma de las series ancladas de TODAS las entidades del eje del cuadro — cierra EXACTO con la fila Total de la
 * tabla que vive debajo (una verdad con lo que el usuario está mirando): venta/contribución = Σ de las series por
 * entidad (cada una anclada a su período → la suma ancla al Total); margen mensual = Σcontribución ÷ Σventa del mes
 * (el agregado del año = el margen de la fila Total, por construcción). Año anterior: SOLO venta y SOLO si TODAS
 * las entidades del eje declaran su total (clientes Σ=92.900 = el KPI anual anterior · marcas ídem — una suma
 * parcial mentiría; los SKU no lo declaran → sin ghost). Bodega sin serie mensual → null (honesto). */
const _AXIS_NAMES = {
  cliente: () => clientesMargen.map((c) => c.nombre),
  marca:   () => marcasMargen.map((m) => m.nombre),
  sku:     () => skusMargen.map((s) => s.nombre),
};

/* === reconcileMonthly (owner 2026-07-28 · auditoría "D1"): "la matriz por eje y la curva global son DOS SERIES
 * DISTINTAS" — medido: Ene global=6.800 vs Σclientes=5.795 · Dic 9.600 vs 10.834 · el AÑO cuadra (100.000=100.000)
 * pero NINGÚN MES cuadra. Raíz: cada entidad modula su propia tendencia histórica por la MISMA forma de estacionalidad
 * y se ancla solo al TOTAL ANUAL propio — nada fuerza que la SUMA de todas por mes reproduzca el mes real del negocio.
 *
 * FIX = IPF (ajuste proporcional iterativo / RAS): alterna reescalar cada FILA (entidad) a su propio total anual —
 * el que ya declaraba, intacto — y cada COLUMNA (mes) al mes real del negocio, hasta converger. Preserva AMBOS
 * márgenes: el total de cada entidad sigue anclado a su período (por construcción, con el redondeo final CORRIGE
 * el residuo en el ÚLTIMO mes de cada fila — la misma técnica que ya usa `_anchor`) y la suma mensual queda cerca
 * del real (redondeo aparte). Si los universos no cuadran a nivel anual (no es una cobertura completa del eje),
 * degrada SIN TOCAR la serie — nunca fuerza un ajuste que mentiría. Puro · determinístico · gate-testable. */
export function reconcileMonthly(seriesList, globalSerie, iters = 12) {
  const n = Array.isArray(seriesList) ? seriesList.length : 0;
  if (!n || !Array.isArray(globalSerie)) return seriesList;
  const m = globalSerie.length;
  if (seriesList.some((s) => !Array.isArray(s) || s.length !== m)) return seriesList;
  const rowTotals = seriesList.map((s) => _sum(s));
  const totRow = _sum(rowTotals), totCol = _sum(globalSerie);
  if (!totRow || !totCol || Math.abs(totRow - totCol) / totCol > 0.005) return seriesList;   // universos distintos → no ajustar (honesto)
  let M = seriesList.map((s) => s.slice());
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) { const s = _sum(M[i]); if (s > 0) { const k = rowTotals[i] / s; M[i] = M[i].map((v) => v * k); } }
    for (let j = 0; j < m; j++) {
      const s = M.reduce((a, r) => a + r[j], 0);
      if (s > 0) { const k = globalSerie[j] / s; for (const r of M) r[j] *= k; }
    }
  }
  // redondeo final: entero por celda, el residuo de CADA FILA se corrige en su último mes (el total de la entidad
  // queda EXACTO al que ya declaraba · misma técnica de `_anchor`); la suma mensual queda cerca del real (rounding).
  return M.map((row, i) => {
    const rounded = row.map((v) => Math.round(v));
    rounded[rounded.length - 1] += rowTotals[i] - _sum(rounded);
    return rounded;
  });
}

export function buildNegocioEvolution(dim = "cliente", metric = "venta") {
  const getNames = _AXIS_NAMES[dim];
  if (!getNames) return null;
  const names = getNames();
  if (metric === "margen") {
    const V = buildNegocioEvolution(dim, "venta"), Cc = buildNegocioEvolution(dim, "contribucion");
    if (!V || !Cc || V.n !== Cc.n || V.serie.some((v) => v <= 0)) return null;
    const serie = V.serie.map((v, i) => _round1((Cc.serie[i] / v) * 100));
    return { ..._entityAnalysis("negocio", metric, V.meses, serie), anterior: null };
  }
  let meses = null, allAnt = true;
  const rows = [];      // series ACTUALES por entidad (para reconciliar mes-a-mes contra el negocio real)
  const antRows = [];   // series AÑO ANTERIOR por entidad — MISMO tratamiento que `rows` (ver fix de abajo)
  for (const nm of names) {
    const e = buildEntityEvolutionComparado(nm, metric);
    if (!e) return null;   // una entidad sin serie → la suma no sería el negocio (honesto: sin gráfico)
    if (!meses) meses = e.meses;
    else if (e.n !== meses.length) return null;
    rows.push(e.serie);
    if (e.anterior) antRows.push(e.anterior.serie);
    else allAnt = false;
  }
  if (!rows.length) return null;
  // D1 · UNA VERDAD CON LA CURVA REAL: solo "venta" tiene un curva global independiente (ventasMensuales) contra la
  // que reconciliar — contribución/margen agregados no tienen un ancla externa propia, quedan como antes (honesto).
  const reconciled = metric === "venta" ? reconcileMonthly(rows, buildGlobalEvolution().actual) : rows;
  const sum = meses.map((_, i) => reconciled.reduce((a, r) => a + r[i], 0));
  // FIX (owner 2026-08-04, hallazgo en vivo — "Ene: ADI dice $6.3M de año anterior, la Mesa dice $5.4M"): el mismo
  // bug D1 de arriba, pero SOLO se había corregido para `actual` — `anterior` sumaba las series crudas de cada
  // entidad sin reconciliar contra la curva real del negocio (buildGlobalEvolution().anterior), así que el AÑO
  // cuadraba pero NINGÚN MES cuadraba (idéntico síntoma que D1 documentó para `actual`). Mismo tratamiento: IPF
  // contra la curva real del año anterior, nunca contra un supuesto — si los universos no cuadran, reconcileMonthly
  // ya degrada solo (devuelve la serie sin tocar), honesto.
  const reconciledAnt = metric === "venta" && allAnt && antRows.length ? reconcileMonthly(antRows, buildGlobalEvolution().anterior) : antRows;
  const sumAnt = allAnt && reconciledAnt.length ? meses.map((_, i) => reconciledAnt.reduce((a, r) => a + r[i], 0)) : null;
  const anterior = metric === "venta" && allAnt && sumAnt ? { serie: sumAnt, total: _sum(sumAnt) } : null;
  return { ..._entityAnalysis("negocio", metric, meses, sum), anterior };
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
