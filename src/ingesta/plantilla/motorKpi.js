/* === ingesta/plantilla/motorKpi.js · ADI CALCULA · SOLO CON FÓRMULAS DECLARADAS (v1 · 2026-08-22) =============
 *
 * «ADI calcula. El usuario informa hechos.» Este módulo toma los hechos de la plantilla y produce las tablas que
 * Sentrix lee. La regla que lo gobierna, textual del owner: **no inventar fórmulas. Si una fórmula no está
 * declarada, dejarlo bloqueado y explícito.**
 *
 * ── CADA CIFRA VIAJA CON SU CITA ─────────────────────────────────────────────────────────────────────────────
 * Cada cálculo declara en `CALCULOS` de dónde sale la autorización (`metricRegistry`, `validationRules`,
 * `entityRegistry`) y, cuando la fórmula no está escrita en el contrato pero SÍ se puede comprobar contra el dato
 * de referencia, cuál fue la medición. Así «no inventamos fórmulas» deja de ser una promesa y pasa a ser una
 * lista que se puede auditar renglón por renglón.
 *
 * ── LO QUE SE PUEDE CALCULAR (medido contra el tenant demo, 2026-08-22) ──────────────────────────────────────
 *   · carga % (pctRebate) = acciones / venta × 100      ← inversa de METRICS.acciones.formula · desvío 0 en 26 filas
 *   · margen %            = 100 − costo% − carga%       ← validationRules «margen-cierra» · desvío 0 en 26 filas
 *   · contribución        = venta × margen / 100        ← METRICS.contribucion.formula · desvío 0 en 26 filas
 *   · costo medio         = costo / unidades            ← desvío 0.005 (redondeo) en 13 SKU
 *   · marca y familia     = suma de sus SKU             ← ENTITIES.sku.parents + sourceManifest aggregate:true · desvío $0
 *
 * ── DÍAS Y ROTACIÓN · «INFORMADO MANDA, CALCULADO RELLENA» (regla del owner, 2026-08-22) ─────────────────────
 * Estas dos eran el bloqueo del frente: el contrato las declaraba dato primario sin fórmula, ningún módulo las
 * calculaba, y medido sobre el dato de referencia `stock ÷ venta diaria` acertaba 2 de 13 y `365 ÷ días` 0 de 13.
 * El owner cerró la definición: si el origen las informa, ADI las respeta y no le discute el número a su sistema;
 * si no vienen, las calcula con la fórmula declarada en `metricRegistry.formulaSiFalta`. En los dos casos la
 * PROCEDENCIA viaja con el valor. La implementación vive en `sentrix/diasYRotacion.js` — acá no se recalcula nada.
 * Con eso el diagnóstico de capital (inmovilizado · quiebre · sobrestock · estado del SKU) dejó de estar bloqueado
 * y lo asigna `diagnoseInventarioSku`, la misma función que usa el producto.
 *
 * ── LO QUE SIGUE BLOQUEADO ───────────────────────────────────────────────────────────────────────────────────
 * La brecha de margen de cabecera, los escenarios y el presupuesto — cada uno con su motivo y su camino para
 * abrirse en `BLOQUEADOS`. Ninguno se rellena con un valor plausible.
 */
import { PARAMETROS } from "../../config/contract/plantilla.js";
import { resolverDiasYRotacion, FORMULA_DIAS, FORMULA_ROTACION } from "../../adi/sentrix/diasYRotacion.js";
import { diagnoseInventarioSku } from "../../adi/diagnosis/economicDiagnosis.js";
import { METRICS } from "../../config/contract/metricRegistry.js";
import { POLICY_CONFIG } from "../../config/businessPolicy.js";

/** La cuenta del capital en stock · vive en el contrato, no en este archivo (una sola fuente). */
const FORMULA_CAPITAL = METRICS.capital.formulaSiFalta;

/** El registro de lo que el motor sabe calcular, con su autorización. Es la lista auditable. */
export const CALCULOS = [
  { id: "carga", que: "carga comercial (%) por cuenta, SKU, marca y familia", formula: "acciones ÷ venta × 100", fuente: "metricRegistry · METRICS.acciones.formula (inversa)", medido: "desvío 0 pp en 13 clientes y 13 SKU del dato de referencia" },
  { id: "margen", que: "margen (%) por cuenta, SKU, marca y familia", formula: "100 − (costo ÷ venta × 100) − carga%", fuente: "validationRules · regla «margen-cierra»", medido: "desvío 0 pp en 13 clientes y 13 SKU" },
  { id: "contribucion", que: "contribución por cuenta, SKU, marca y familia", formula: "venta × margen ÷ 100", fuente: "metricRegistry · METRICS.contribucion.formula", medido: "desvío $0 en 13 clientes y 13 SKU" },
  { id: "costoMedio", que: "costo medio por unidad", formula: "costo ÷ unidades", fuente: "no está en el contrato; se comprueba contra el dato de referencia", medido: "desvío 0.005 sobre valores de 10 a 16 (redondeo)" },
  { id: "rollup", que: "las tablas por marca y por familia", formula: "suma de los SKU de cada marca / familia", fuente: "entityRegistry · ENTITIES.sku.parents + sourceManifest · aggregate:true", medido: "desvío $0 contra las tablas declaradas del dato de referencia" },
  { id: "periodos", que: "venta del período, período anterior y variación", formula: "suma de las filas de cada período; variación = (actual ÷ anterior − 1) × 100", fuente: "suma de hechos informados, no una fórmula de negocio", medido: null },
  { id: "diasSinVenta", que: "días sin venta por SKU", formula: "fecha de corte − fecha de la última venta", fuente: "resta de dos fechas informadas", medido: null },
  { id: "diasYRotacion", que: "días de inventario y rotación · INFORMADO MANDA, calculado rellena", formula: `si el origen los informa se respetan tal cual; si no: días = ${FORMULA_DIAS} · rotación = ${FORMULA_ROTACION}`, fuente: "metricRegistry · formulaSiFalta (regla del owner 2026-08-22) · implementada en sentrix/diasYRotacion.js", medido: "la procedencia viaja con cada valor: informado · calculado · sin dato" },
  { id: "brechaYTendencia", que: "brecha de margen y tendencia de margen (cabecera)", formula: "brecha = benchmark − margen actual · tendencia = margen actual − margen del período anterior", fuente: "definición del owner 2026-08-23, declarada en metricRegistry.margen (brechaFormula · tendenciaFormula)", medido: "sin benchmark declarado la brecha es null, nunca un cero que parezca meta cumplida" },
  { id: "estadoSku", que: "el estado de cada SKU (inmovilizado · riesgo de quiebre · sobrestock · sano)", formula: "compara rotación y días contra los umbrales del negocio", fuente: "diagnosis/economicDiagnosis · diagnoseInventarioSku (la misma función del producto, no una copia)", medido: null },
  { id: "capital", que: "capital en stock por SKU, bodega y familia", formula: "suma del stock valorizado", fuente: "metricRegistry · METRICS.capital (dato primario, se agrega por suma)", medido: null },
];

/** Lo que el motor NO calcula, con el motivo y qué haría falta para desbloquearlo. */
export const BLOQUEADOS = [
  { id: "escenarios", que: "los escenarios de simulación", porque: "SCENARIO_TRANSFORMS es un supuesto declarado por el negocio, no un hecho que se derive de las ventas",
    paraAbrirlo: "que el negocio los declare, o que se acuerde una forma de generarlos" },
  { id: "presupuesto", que: "venta contra presupuesto", porque: "el presupuesto es por cuenta y período, no por fila de venta: como columna se repetiría en cada fila y se contradiría solo. Quedó fuera de la v1 al colapsar la plantilla a dos hojas (decisión del owner, 2026-08-22)",
    paraAbrirlo: "agregar una tercera hoja chica (período · cuenta · presupuesto) en una v2, si alguien lo pide" },
];

const _sum = (arr, f) => arr.reduce((s, r) => s + (typeof f(r) === "number" ? f(r) : 0), 0);
const _r1 = (x) => Math.round(x * 10) / 10;
const _r2 = (x) => Math.round(x * 100) / 100;
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** El bloque de margen de un grupo de filas de venta · TODAS las fórmulas de acá están citadas en CALCULOS. */
function bloqueMargen(filas, benchmark) {
  const venta = _sum(filas, (r) => r.venta);
  const costo = _sum(filas, (r) => r.costo);
  const rebates = _sum(filas, (r) => r.acciones);
  const unidades = _sum(filas, (r) => r.unidades);
  const pctRebate = venta ? _r1(rebates / venta * 100) : 0;                    // METRICS.acciones.formula (inversa)
  const margen = venta ? _r1(100 - (costo / venta * 100) - (rebates / venta * 100)) : 0;   // regla margen-cierra
  const contribucion = Math.round(venta * margen / 100);                       // METRICS.contribucion.formula
  return { venta: Math.round(venta), costo: Math.round(costo), rebates: Math.round(rebates), contribucion,
    pctRebate, margen, benchmark, unidades: Math.round(unidades),
    costoMedio: unidades ? _r2(costo / unidades) : null };
}

/* calcularDataset({ parametros, tablas }) → { dataset, calculado, bloqueado, avisos }
 * `dataset` tiene la forma de un tenant. Lo que no se puede calcular queda en null/[] y sale nombrado en
 * `bloqueado` — nunca relleno con un valor plausible. */
export function calcularDataset({ parametros = {}, tablas = {}, fechaCarga = null } = {}) {
  const avisos = [];
  const ventas = tablas.Ventas || [];
  const inventario = tablas.Inventario || [];

  const benchmark = typeof parametros.benchmark === "number" ? parametros.benchmark : null;
  if (benchmark === null) avisos.push({ tipo: "benchmark-sin-declarar", detalle: "el negocio no declaró su margen de referencia: ADI usa el general y lo dice en pantalla" });

  /* EL PERÍODO DECLARADO VIENE CON DÍA desde 2026-08-26 («fecha de cierre del período que informas»), y las
   * filas se agrupan por MES. Se compara por mes: si no, un «2026-08-31» perfectamente correcto no coincidía
   * con ningún período y el motor avisaba que el período declarado no tenía ventas. */
  const periodoActual = parametros.periodo_actual ? String(parametros.periodo_actual).slice(0, 7) : null;
  const periodos = [...new Set(ventas.map((v) => v.periodo))].sort();
  /* CUÁNTAS FILAS TRAE CADA PERÍODO · un hecho del archivo, no una cuenta de negocio. Viaja en la preview porque
   * la lectura de plausibilidad lo necesita para detectar un período cargado a medias: sin este conteo esa señal
   * no puede disparar nunca (ya nació muerta una vez por leer un campo que no existía). */
  const filasPorPeriodo = {}; for (const v of ventas) filasPorPeriodo[v.periodo] = (filasPorPeriodo[v.periodo] || 0) + 1;
  const actual = periodoActual && periodos.includes(periodoActual) ? periodoActual : periodos[periodos.length - 1] || null;
  const anterior = periodos[periodos.indexOf(actual) - 1] || null;
  if (periodoActual && actual !== periodoActual) avisos.push({ tipo: "periodo-declarado-sin-ventas", detalle: `«${periodoActual}» no tiene filas de venta; se usa «${actual}»` });
  if (!anterior) avisos.push({ tipo: "sin-periodo-anterior", detalle: "solo hay un período: no hay comparación contra el anterior ni variación" });

  /* v1 · los maestros ya no son hojas: la marca, la familia, el precio de lista y el canal viajan como columnas
   * de la fila de venta, y de ahí se reconstruyen. El validador ya garantizó que un mismo SKU no traiga dos
   * marcas distintas (regla de COHERENCIA), así que acá la primera aparición ES la verdad, no una elección. */
  const perfilNum = (k) => { const p = PARAMETROS.find((x) => x.policyKey === k); const v = p ? parametros[p.clave] : undefined; return typeof v === "number" ? v : undefined; };

  const dimSku = new Map(), dimCli = new Map();
  for (const v of ventas) {
    if (!dimSku.has(v.sku)) dimSku.set(v.sku, { sku: v.sku, marca: v.marca ?? null, sfamilia: v.sfamilia ?? null, precioLista: v.precioLista ?? null });
    else { const d = dimSku.get(v.sku); d.marca = d.marca ?? v.marca ?? null; d.sfamilia = d.sfamilia ?? v.sfamilia ?? null; d.precioLista = d.precioLista ?? v.precioLista ?? null; }
    if (!dimCli.has(v.cliente)) dimCli.set(v.cliente, { nombre: v.cliente, canal: v.canal ?? null });
    else if (dimCli.get(v.cliente).canal === null) dimCli.get(v.cliente).canal = v.canal ?? null;
  }

  const delActual = ventas.filter((v) => v.periodo === actual);
  const delAnterior = anterior ? ventas.filter((v) => v.periodo === anterior) : [];

  // un SKU que está en stock pero nunca se vendió no tiene marca ni familia: se DECLARA, no se inventa
  for (const s of new Set(inventario.map((r) => r.sku))) if (!dimSku.has(s)) avisos.push({ tipo: "sku-solo-en-inventario", detalle: `el SKU "${s}" está en stock pero no tiene ninguna venta informada: queda sin marca ni familia` });

  const agrupar = (filas, clave) => { const m = new Map(); for (const f of filas) { const k = clave(f); if (k === null || k === undefined) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(f); } return m; };

  /* ── clientes ─────────────────────────────────────────────────────────────────────────────────────────── */
  const porCliAct = agrupar(delActual, (v) => v.cliente);
  const porCliAnt = agrupar(delAnterior, (v) => v.cliente);
  const clientesVentas = [], clientesMargen = [];
  for (const [nombre, filas] of [...porCliAct].sort((a, b) => _sum(b[1], (r) => r.venta) - _sum(a[1], (r) => r.venta))) {
    const b = bloqueMargen(filas, benchmark);
    const ant = porCliAnt.get(nombre) || [];
    const cat = dimCli.get(nombre) || {};
    // la marca/familia dominante de la cuenta: la de mayor venta. Es una lectura del dato, no una atribución nueva.
    const dom = (campo) => { const m = agrupar(filas, (v) => (dimSku.get(v.sku) || {})[campo]); let mejor = null, max = -1; for (const [k, fs] of m) { const s = _sum(fs, (r) => r.venta); if (s > max) { max = s; mejor = k; } } return mejor; };
    clientesVentas.push({ nombre, tipo: "cliente", canal: cat.canal ?? null, marca: dom("marca"), sfamilia: dom("sfamilia"),
      actual: b.venta, anterior: Math.round(_sum(ant, (r) => r.venta)), presupuesto: null,   // fuera de la v1 · ver BLOQUEADOS
      unidades: b.unidades, unidadesAnt: Math.round(_sum(ant, (r) => r.unidades)), pctRebate: b.pctRebate });
    clientesMargen.push({ nombre, tipo: "cliente", marca: dom("marca"), sfamilia: dom("sfamilia"), ...b, precioLista: null });
  }

  /* ── SKU ──────────────────────────────────────────────────────────────────────────────────────────────── */
  const skusMargen = [];
  for (const [sku, filas] of [...agrupar(delActual, (v) => v.sku)].sort((a, b) => _sum(b[1], (r) => r.venta) - _sum(a[1], (r) => r.venta))) {
    const b = bloqueMargen(filas, benchmark);
    const p = dimSku.get(sku) || {};
    skusMargen.push({ nombre: sku, tipo: "sku", marca: p.marca ?? null, sfamilia: p.sfamilia ?? null, ...b, precioLista: p.precioLista ?? null });
  }

  /* ── marca y familia · rollup declarado desde SKU ─────────────────────────────────────────────────────── */
  const rollup = (campo, tipo) => {
    const out = [];
    for (const [k, filas] of agrupar(delActual.filter((v) => dimSku.has(v.sku)), (v) => dimSku.get(v.sku)[campo])) {
      const b = bloqueMargen(filas, benchmark);
      const ant = delAnterior.filter((v) => dimSku.has(v.sku) && dimSku.get(v.sku)[campo] === k);
      out.push({ nombre: k, tipo, [campo === "marca" ? "marca" : "sfamilia"]: k, ...b,
        actual: b.venta, anterior: Math.round(_sum(ant, (r) => r.venta)), unidadesAnt: Math.round(_sum(ant, (r) => r.unidades)) });
    }
    return out.sort((a, b2) => b2.venta - a.venta);
  };
  const marcasMargen = rollup("marca", "marca");
  const sfamiliasMargen = rollup("sfamilia", "sfamilia");

  /* ── inventario · hechos sí, diagnóstico NO ───────────────────────────────────────────────────────────── */
  const dias = (desde, hasta) => { if (!desde || !hasta) return null; const d = (Date.parse(hasta) - Date.parse(desde)) / 86400000; return Number.isFinite(d) ? Math.max(0, Math.round(d)) : null; };
  /* DÍAS Y ROTACIÓN · «informado manda, calculado rellena» (owner 2026-08-22). La regla y su fórmula viven en
   * `sentrix/diasYRotacion.js` y `metricRegistry.formulaSiFalta` — acá NO se recalcula nada por cuenta propia:
   * se le pasa la fila y las unidades vendidas del período, y el módulo decide. Las unidades salen de la hoja
   * Ventas por (SKU, bodega), que es por qué la bodega sigue siendo columna de Ventas: sin ella, el ritmo de
   * venta de una bodega se mediría con el de todas. Con días y rotación resueltos, el estado del SKU lo asigna
   * `diagnoseInventarioSku` con los umbrales del negocio — la misma función que usa el producto, no una copia. */
  const undPorSkuBodega = new Map();
  for (const v of delActual) {
    const k = `${v.sku} ⋅ ${v.bodega ?? ""}`;
    undPorSkuBodega.set(k, (undPorSkuBodega.get(k) || 0) + (v.unidades || 0));
  }
  const undPorSku = new Map();
  for (const v of delActual) undPorSku.set(v.sku, (undPorSku.get(v.sku) || 0) + (v.unidades || 0));

  /* ── EL COSTO UNITARIO SALE DE VENTAS, NO DE LA PLANTILLA DE INVENTARIO (owner 2026-08-26) ─────────────────
   * «Costo unitario = Costo / Unidades vendidas. Capital en stock = Stock actual × costo unitario.» Por eso la
   * hoja Inventario dejó de pedir «stock valorizado»: era pedirle al usuario una valorización a mano teniendo
   * los dos insumos en la otra hoja. Se acumulan costo y unidades del período ACTUAL, por (SKU, bodega) y por
   * SKU, para poder caer al total cuando la venta no viene separada por bodega. */
  const costoPorSkuBodega = new Map(), costoPorSku = new Map();
  for (const v of delActual) {
    const k = `${v.sku} ⋅ ${v.bodega ?? ""}`;
    const a = costoPorSkuBodega.get(k) || { costo: 0, und: 0 };
    a.costo += v.costo || 0; a.und += v.unidades || 0;
    costoPorSkuBodega.set(k, a);
    const b = costoPorSku.get(v.sku) || { costo: 0, und: 0 };
    b.costo += v.costo || 0; b.und += v.unidades || 0;
    costoPorSku.set(v.sku, b);
  }
  /** costo unitario, o null si no hay unidades vendidas con qué dividir — jamás un cero de relleno. */
  const costoUnitarioDe = (sku, bodega) => {
    const a = costoPorSkuBodega.get(`${sku} ⋅ ${bodega ?? ""}`) || costoPorSku.get(sku);
    if (!a || !a.und) return null;
    return a.costo / a.und;
  };

  /* ÚLTIMA VENTA · derivada de Ventas, no pedida al usuario. La precisión es MENSUAL porque la hoja informa el
   * período (AAAA-MM), no el día: se cuenta contra el fin del último mes en que el SKU vendió. Se declara así en
   * la procedencia para que nadie lea esos días como si fueran exactos al día. */
  const ultimoPeriodoConVenta = new Map();
  for (const v of ventas) {
    if (!(v.unidades > 0)) continue;
    const prev = ultimoPeriodoConVenta.get(v.sku);
    if (!prev || v.periodo > prev) ultimoPeriodoConVenta.set(v.sku, v.periodo);
  }
  const _finDeMes = (per) => { const [a, m] = String(per).split("-").map(Number); return new Date(Date.UTC(a, m, 0)); };
  /* La fecha contra la que se cuenta: la de CARGA si el llamador la declaró (es la que pidió el owner), y si no,
   * el fin del período informado — un hecho del archivo, para que esto sea reproducible sin reloj. */
  const _referencia = fechaCarga ? new Date(`${fechaCarga}T00:00:00Z`) : (actual ? _finDeMes(actual) : null);
  const diasSinVentaDe = (sku) => {
    const per = ultimoPeriodoConVenta.get(sku);
    if (!per || !_referencia) return null;
    const d = Math.round((_referencia - _finDeMes(per)) / 86400000);
    return d < 0 ? 0 : d;
  };

  /* DÍAS DEL PERÍODO · los reales del mes informado, que es lo que dice la fórmula del owner («unidades del
   * período / días del período»). Usar 30 fijo desviaría en febrero y en los meses de 31. */
  const _diasDelPeriodo = actual ? _finDeMes(actual).getUTCDate() : undefined;

  const umbrales = { rotacionMin: perfilNum("rotacionMin"), dohMax: perfilNum("dohMax") };
  const sinValorizar = [], sinRitmo = [];
  const skuInventario = inventario.map((r) => {
    const p = dimSku.get(r.sku) || {};
    // si la venta del período no distingue bodega, se cae al total del SKU y se declara en los avisos
    const porBodega = undPorSkuBodega.get(`${r.sku} ⋅ ${r.bodega ?? ""}`);
    const und = porBodega !== undefined ? porBodega : (undPorSku.get(r.sku) ?? null);
    const { dias: d, rotacion: rot } = resolverDiasYRotacion(r, { unidadesPeriodo: und, diasPeriodo: _diasDelPeriodo });

    /* ⚠️ SI NO SE PUEDE, SE DECLARA. Orden textual del owner: «si un SKU tiene stock pero no tiene venta/costo
     * suficiente en el período, ADI no inventa: declara que no puede valorizar o calcular rotación/días para
     * ese SKU». Un cero acá diría «no tiene capital inmovilizado», que es lo contrario de «no lo sé». */
    const cu = costoUnitarioDe(r.sku, r.bodega);
    const stockUSD = cu !== null && typeof r.stockUnd === "number" ? Math.round(r.stockUnd * cu) : null;
    if (stockUSD === null) sinValorizar.push(r.sku);
    if (d.valor === null) sinRitmo.push(r.sku);

    const estado = (d.valor !== null || rot.valor !== null)
      ? diagnoseInventarioSku({ rotacion: rot.valor, doh: d.valor }, umbrales)
      : null;
    return { sku: r.sku, bodega: r.bodega ?? null, marca: p.marca ?? null, sfamilia: p.sfamilia ?? null,
      stockUSD, stockUnd: r.stockUnd,
      diasSinVenta: diasSinVentaDe(r.sku),
      doh: d.valor, rotacion: rot.valor, cobertura: null, margenPct: null,
      estado, alerta: null,
      // la procedencia viaja CON el valor, como pidió el owner: nadie tiene que ir a buscarla para mostrarla
      procedencia: { doh: d.procedencia, rotacion: rot.procedencia, formulaDoh: d.formula, formulaRotacion: rot.formula,
        capital: stockUSD === null ? "sin dato" : "calculado", formulaCapital: FORMULA_CAPITAL,
        diasSinVenta: "calculado · precisión mensual (el período se informa por mes, no por día)" } };
  });
  if (sinValorizar.length) avisos.push({ tipo: "sku-sin-valorizar", detalle: `${sinValorizar.length} SKU con stock no se pueden valorizar: no vendieron unidades en el período, así que no hay costo unitario (${sinValorizar.slice(0, 5).join(", ")})` });
  if (sinRitmo.length) avisos.push({ tipo: "sku-sin-ritmo", detalle: `${sinRitmo.length} SKU con stock se quedan sin días ni rotación: sin venta en el período no hay ritmo con qué dividir (${sinRitmo.slice(0, 5).join(", ")})` });
  /* EL RITMO SE MIDE POR SKU, no por bodega, y desde que la hoja Ventas dejó de pedir bodega (owner
   * 2026-08-26) ese es el camino NORMAL, no una anomalía. Se declara UNA vez —antes salía un aviso por fila y
   * enterraba a los que sí importan— y solo cuando hay bodegas en el inventario, que es cuando la diferencia
   * entre «este depósito» y «el SKU completo» significa algo. */
  if (inventario.some((r) => r.bodega)) {
    avisos.push({ tipo: "ritmo-por-sku-no-por-bodega", detalle: "el stock viene por bodega y la venta no: los días y la rotación de cada bodega se miden con el ritmo del SKU completo" });
  }
  if (inventario.length && !inventario.some((r) => r.bodega)) {
    avisos.push({ tipo: "inventario-sin-bodega", detalle: "el inventario no declara bodega: capital, días y rotación se calculan por SKU total" });
  }

  /* ── serie mensual · suma de hechos por período ───────────────────────────────────────────────────────── */
  const ventasMensuales = periodos.map((per) => {
    const mes = MESES[Number(per.slice(5, 7)) - 1] || per;
    const prev = periodos[periodos.indexOf(per) - 1];
    return { mes, periodo: per,
      actual: Math.round(_sum(ventas.filter((v) => v.periodo === per), (r) => r.venta)),
      anterior: prev ? Math.round(_sum(ventas.filter((v) => v.periodo === prev), (r) => r.venta)) : null,
      presupuesto: null };   // fuera de la v1
  });

  /* ── KPI de cabecera · solo lo que es suma de hechos ──────────────────────────────────────────────────── */
  const totalActual = Math.round(_sum(delActual, (r) => r.venta));
  const totalAnterior = Math.round(_sum(delAnterior, (r) => r.venta));
  const totalPpto = null;   // fuera de la v1 · ver BLOQUEADOS
  const totalCosto = _sum(delActual, (r) => r.costo), totalAcc = _sum(delActual, (r) => r.acciones);
  const margenGlobal = totalActual ? _r1(100 - (totalCosto / totalActual * 100) - (totalAcc / totalActual * 100)) : 0;
  const ventasKPI = { totalActual, totalAnterior: totalAnterior || null, totalPresupuesto: totalPpto,
    vsAnterior: totalAnterior ? _r1((totalActual / totalAnterior - 1) * 100) : null,
    vsPresupuesto: totalPpto ? _r1((totalActual / totalPpto - 1) * 100) : null,
    unidades: Math.round(_sum(delActual, (r) => r.unidades)), ticketProm: null };
  /* EL MARGEN DEL PERÍODO ANTERIOR sale de las mismas filas, con la misma cuenta: sin él no hay tendencia. */
  const totalCostoAnt = _sum(delAnterior, (r) => r.costo), totalAccAnt = _sum(delAnterior, (r) => r.acciones);
  const margenAnterior = totalAnterior ? _r1(100 - (totalCostoAnt / totalAnterior * 100) - (totalAccAnt / totalAnterior * 100)) : null;
  /* ⚠️ BRECHA Y TENDENCIA SON DOS COSAS DISTINTAS (owner 2026-08-23, definición suya):
   *   · BRECHA   = benchmark − margen actual → cuánto falta para llegar al benchmark. Positiva = por debajo.
   *   · TENDENCIA = margen actual − margen anterior → cómo cambió contra el período pasado.
   * Estaba BLOQUEADO porque ninguna de las dos estaba declarada como «la brecha», y el campo histórico
   * `gapPuntos` guarda la TENDENCIA con nombre de brecha — confusión que ya causó un defecto real en pantalla
   * (#D-MARGEN-GAP-BENCHMARK-MIENTE en overview.js). Ahora las dos van con su nombre y su cuenta.
   * Sin benchmark declarado no hay brecha: null, nunca un cero que parezca «llegaste a la meta». */
  /* ⚠️ EL BENCHMARK CAE A LA REFERENCIA GENERAL DE ADI (2026-08-26). Salió de la plantilla junto con el resto
   * de las políticas —«deja solo datos de empresa y período»— y sin referencia la brecha de margen quedaba en
   * null para siempre, apagando el KPI de cabecera. La regla que ya estaba escrita en el aviso es la que se
   * aplica: si el negocio no lo declara, ADI usa el suyo y lo dice en pantalla. La procedencia viaja abajo. */
  const benchmarkDelNegocio = perfilNum("benchmark");
  const benchmarkDeclarado = benchmarkDelNegocio !== undefined ? benchmarkDelNegocio : POLICY_CONFIG.benchmark;
  const margenKPI = {
    pct: margenGlobal, pctAnt: margenAnterior,
    totalUSD: Math.round(totalActual * margenGlobal / 100),
    brechaPuntos: benchmarkDeclarado !== undefined ? _r1(benchmarkDeclarado - margenGlobal) : null,
    benchmark: benchmarkDeclarado ?? null,
    benchmarkProcedencia: benchmarkDelNegocio !== undefined ? "informado" : "referencia general de ADI",
    tendenciaPuntos: margenAnterior !== null ? _r1(margenGlobal - margenAnterior) : null,
    /* el campo histórico sigue existiendo con su significado de siempre —la tendencia— para no romper a los 18
     * consumidores que ya lo leen. Renombrarlo es un pase aparte. */
    gapPuntos: margenAnterior !== null ? _r1(margenGlobal - margenAnterior) : null,
  };
  const invKPI = skuInventario.length
    ? (() => {
        const total = Math.round(_sum(skuInventario, (r) => r.stockUSD));
        const cap = (est) => Math.round(_sum(skuInventario.filter((r) => r.estado === est), (x) => x.stockUSD));
        const conDoh = skuInventario.filter((r) => typeof r.doh === "number");
        return { totalUSD: total,
          doh: conDoh.length ? _r1(_sum(conDoh, (r) => r.doh) / conDoh.length) : null,
          inmovilizadoUSD: cap("capital_frenado"), inmovilizadoPct: total ? _r1(cap("capital_frenado") / total * 100) : null,
          sobrestockPct: total ? _r1(cap("sobrestock") / total * 100) : null,
          riesgoPct: total ? _r1(cap("riesgo_quiebre") / total * 100) : null };
      })()
    : null;

  /* ── catálogos · la lista de lo que hay ───────────────────────────────────────────────────────────────── */
  const marcas = [...new Set([...dimSku.values()].map((p) => p.marca).filter(Boolean))];
  const familias = [...new Set([...dimSku.values()].map((p) => p.sfamilia).filter(Boolean))];
  const bodegas = [...new Set([...ventas, ...inventario].map((r) => r.bodega).filter(Boolean))];

  /* ── el perfil del negocio · los parámetros declarados, con su llave de POLICY ─────────────────────────── */
  const perfil = {};
  for (const p of PARAMETROS) if (p.policyKey && typeof parametros[p.clave] === "number") perfil[p.policyKey] = parametros[p.clave];

  const dataset = {
    id: parametros.empresa_id || null,
    nombre: parametros.empresa_nombre || parametros.empresa_id || "",
    perfil,
    clientesVentas, clientesMargen,
    marcasVentas: marcasMargen.map((m) => ({ nombre: m.nombre, marca: m.nombre, sfamilia: null, actual: m.actual, anterior: m.anterior, unidades: m.unidades, unidadesAnt: m.unidadesAnt, pctRebate: m.pctRebate })),
    marcasMargen,
    sfamiliasVentas: sfamiliasMargen.map((f) => ({ nombre: f.nombre, sfamilia: f.nombre, marca: null, actual: f.actual, anterior: f.anterior, unidades: f.unidades, unidadesAnt: f.unidadesAnt, pctRebate: f.pctRebate })),
    sfamiliasMargen,
    skuInventario, skusMargen,
    historialMargen: {},
    CLIENTES_STRATEGIC_PROFILE: {},
    ventasKPI, margenKPI, invKPI, ventasMensuales,
    SUPERFAMILIAS: familias.length ? ["Todas", ...familias] : [],
    MARCAS_ALL: marcas, SUCURSALES: bodegas,
    SCENARIO_TRANSFORMS: {},
    clientesAlias: {}, clientesAmbiguos: [],
  };

  return { dataset, calculado: CALCULOS, bloqueado: BLOQUEADOS, avisos, periodos: { actual, anterior, todos: periodos, filas: filasPorPeriodo } };
}
