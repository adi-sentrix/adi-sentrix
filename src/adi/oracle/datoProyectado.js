/* === src/adi/oracle/datoProyectado.js · AMPLITUD F1 · LA PROYECCIÓN CURADA DEL DATO (owner 2026-08-13) ========
 * EL PROBLEMA QUE RESUELVE: el narrador solo veía la boleta del turno — respondía bien lo que las 22 tools
 * anticiparon y nada más. Este módulo proyecta EL DATO COMPLETO del tenant activo a un TEXTO compacto y legible
 * que viaja en el SEGMENTO FIJO del system de NARRAR (cacheable por tenant+escenario), para que el modelo
 * ENTIENDA el negocio — qué existe, qué se relaciona, qué tiene sentido. NUNCA para aritmética: la regla madre
 * es «el LLM propone, el motor calcula, el muro sella» (la calculadora es la fase 2, acá no existe).
 *
 * UNA SOLA VERDAD, en las tres dimensiones donde este proyecto ya pagó por duplicarla:
 *   · ETIQUETAS — las declaradas del contrato (metricRegistry.METRICS[].label) y las convenciones ya selladas
 *     («Días de inventario», nunca «cobertura» — CLAUDE.md §4: cobertura se resolvió POR ELIMINACIÓN y acá
 *     tampoco entra). Ningún rótulo nuevo.
 *   · CIFRAS — cada monto se formatea con el formateador CANÓNICO de la boleta, sin escribir un segundo:
 *     parseFigures (boleta.js, exportado) canoniza con el MISMO _fmtC privado que canoniza la narración, así
 *     que se le da el crudo y se lee la forma canónica del canon. Una cifra de esta proyección citada por el
 *     narrador matchea por canon contra guardC por construcción.
 *   · ESCENARIO — las filas salen de sourceManifest.SOURCES[].scenarioLoad (el contrato de cómo el escenario
 *     ajusta cada fuente) y los KPIs de deriveKpis (el MISMO motor que alimenta la Mesa). Cero recálculo propio.
 *
 * DETERMINÍSTICA: mismo tenant+escenario → mismo texto byte a byte (la condición del caché de prefijo del
 *   proveedor). Sin Date.now(), sin Math.random() (applyScenarioToSkuInventario usa _seededRand — determinístico).
 *   Memo por tenant+escenario, invalidado en initTenant (onTenantChange).
 *
 * LO QUE DELIBERADAMENTE NO PROYECTA (decisiones anotadas para el informe):
 *   · la serie mensual (ventasMensuales): la tool `trend` la sirve ANCLADA al escenario y reconciliada
 *     (temporalTable.js / buildGlobalEvolutionAnclada) — proyectar acá la serie cruda sería una segunda verdad
 *     que puede divergir mes a mes de lo que la tool autoriza. El mes a mes sigue llegando por su tool.
 *   · agregados por canal: el contrato los declara vía agg:"sum" y los computa el motor en sus tools — este
 *     módulo no suma nada por su cuenta.
 *   · clientesMargen.venta cruda: la venta oficial por cliente es clientesVentas.actual (D8, owner 2026-07-29)
 *     y scenarioLoad YA la reconcilia — acá viaja UNA venta por cliente, la oficial.
 *
 * PURO · sin I/O · no importa el gateway ni ningún adapter. */
import { SOURCES } from "../../config/contract/sourceManifest.js";
import { UNIVERSOS, DIVERGENCIAS } from "../../config/contract/figureType.js";
import { METRICS } from "../../config/contract/metricRegistry.js";
import { deriveKpis } from "../../engine/scenarios.js";
import { tenantPolicyDefault } from "../../config/businessPolicy.js";
import { getTenantId, getTenantData, onTenantChange } from "../../data/tenantStore.js";
import { parseFigures } from "../boleta.js";
import { composeNoDataMessage } from "./narrationBlocks.js";   // el último recurso ABSOLUTO del suplente digno — la MISMA frase canónica que usa la escalera anti-null, nunca una copia

// ── EL FORMATEADOR DE LA BOLETA, SIN UN SEGUNDO FORMATEADOR ────────────────────────────────────────────────────
// parseFigures canoniza toda cifra con el _fmtC privado de boleta.js (canon = `unit:_fmtC(raw,unit)`). Darle el
// crudo en una forma mínima y leer el canon ES usar ese formateador — la única alternativa sería exportar _fmtC
// (tocar boleta.js, intocable) o copiarlo (el segundo formateador que esta regla prohíbe).
function _fmtBoleta(raw, unit) {
  const semilla = unit === "money" ? `$${raw}` : unit === "pct" ? `${raw}%` : unit === "days" ? `${raw}d` : unit === "ratio" ? `${raw}x` : String(raw);
  const p = parseFigures(semilla);
  return p.length ? p[0].canon.slice(p[0].canon.indexOf(":") + 1) : semilla;
}
// % con LA convención del producto (`.toFixed(1)` — ledger.js:150: «SIEMPRE .toFixed(1) para %», la misma de
// composers/executiveReport/comparisons). El canon no distingue "22%" de "22.0%" (mismo raw), así que esto es
// presentación consistente con pantalla, no un formateador paralelo.
const _pct1 = (v) => `${(+v).toFixed(1)}%`;
const _money = (rawUSD) => _fmtBoleta(Math.round(rawUSD), "money");
const _moneyK = (milesUSD) => _money(milesUSD * 1000);   // venta comercial: almacenada en MILES (contrato: escala K)
const _dias = (v) => _fmtBoleta(Math.round(v), "days");
const _ratio = (v) => _fmtBoleta((+v).toFixed(1), "ratio");

// etiquetas DECLARADAS (metricRegistry) — jamás un rótulo inventado acá.
const _L = {
  ventas: METRICS.ventas.label,               // "Ventas"
  margen: METRICS.margen.label,               // "Margen"
  contribucion: METRICS.contribucion.label,   // "Contribución"
  costo: METRICS.costo.label,                 // "Costo"
  acciones: METRICS.acciones.label,           // "Acciones comerciales"
  carga: METRICS.carga.label,                 // "Carga comercial"
  capital: METRICS.capital.label,             // "Capital"
  rotacion: METRICS.rotacion.label,           // "Rotación"
};

// ── LOS HUECOS VERIFICADOS · «LO QUE ESTE DATO NO TIENE» ──────────────────────────────────────────────────────
// La lista verificada de CLAUDE.md §4 («quien prometa responder esto, inventa») + los límites que los propios
// composers ya declaran en pantalla (mesaCapital.js: lead time / orden de compra / causa; temporalTable.js:
// resultado por mes; figureType: la meta no existe). Es la sección que le permite al narrador DECLINAR BIEN
// en vez de estirar.
const _HUECOS = [
  "historial de compra cliente×SKU: NO existe. La relación cliente×SKU disponible es una AFINIDAD ESTIMADA (sellada `indicado`), nunca una venta registrada — «quiénes dejaron de comprar» no es respondible.",
  "entradas y recepciones de inventario: NO existen — «entradas y salidas» no es dibujable ni narrable.",
  "lead time de proveedor: NO existe — no se puede decir qué se quiebra antes de que llegue reposición.",
  "estado de órdenes de compra: NO existe.",
  "causa de la detención de un SKU: NO está en el dato — se localiza dónde, no por qué.",
  "meta de rotación por familia: NO existe.",
  "ningún SKU está en más de una bodega — transferir stock entre bodegas NO es evaluable con este dato.",
  "serie a futuro / pronóstico: NO existe — solo la evolución hasta hoy.",
  "resultado (después de gastos) POR MES: NO existe — los gastos son % sobre la venta anual.",
  "la META no existe en este dato: el benchmark lo declara el cliente y benchmark ≠ promedio ≠ meta.",
  "fuente sectorial autorizada: NO hay — la única referencia es la del propio negocio (su benchmark declarado).",
];

// ── memo por tenant+escenario (initTenant invalida) ───────────────────────────────────────────────────────────
const _memo = new Map();
onTenantChange(() => _memo.clear());

// _filas(scenario) → las filas de cada fuente, TAL COMO el contrato dicta que el escenario las ajusta.
function _filas(scenario) {
  const de = (src) => (SOURCES[src].scenarioLoad ? SOURCES[src].scenarioLoad(scenario) : SOURCES[src].load());
  return {
    clientesVentas: de("clientesVentas"),
    clientesMargen: de("clientesMargen"),
    skusMargen: de("skusMargen"),
    marcasMargen: de("marcasMargen"),
    sfamiliasMargen: de("sfamiliasMargen"),
    skuInventario: de("skuInventario"),
  };
}

/* _construir(scenario) → { texto, figs, counts } — texto y autorizaciones salen del MISMO recorrido: lo que el
 * narrador lee es exactamente lo que el muro autoriza (con su dueño), nunca dos listas que puedan divergir.
 * figs: [{ canon, value, duenos: [tokens] }] — `duenos` son los tokens cuya presencia en la MISMA oración de la
 * cita la valida (guardC, quinta fuente). counts: conteos declarados (filas por universo). */
function _construir(scenario) {
  const t = getTenantData();
  const f = _filas(scenario);
  const kpis = deriveKpis(scenario);
  const figs = [];
  const counts = new Set();
  /* ESTADOS y RANKINGS (constitución 2026-08-14, chequeos 3 y 4 del notario): las clasificaciones y los
   * órdenes que la carpeta DECLARA, como objetos verificables — el mismo recorrido y los mismos umbrales
   * del texto (tenantPolicyDefault, la única verdad), nunca una segunda regla. El TEXTO no cambia un byte. */
  const estados = [];
  const rankings = { cliente: { ventas: [], margen: [], contribucion: [], carga: [] }, marca: { ventas: [], margen: [], contribucion: [], carga: [] } };
  /* EL UNIVERSO DE CADA CIFRA (owner 2026-08-15, fuga medida en el examen 2): ADI comparó el «margen de
   * inventario 34%» de un SKU contra «el benchmark de cartera (30.1%)», que es del universo de VENTA. Ninguna
   * cuenta cruzó los dos mundos — cruzó la COMPARACIÓN. Para que el notario pueda verlo hace falta que la carpeta
   * diga de qué universo sale cada cifra: es ella la que lo sabe, no el muro. `_uni` marca el bloque en curso y
   * el tercer argumento de F() lo pisa cuando una línea mezcla varas de los dos (la de la referencia). */
  let _uni = "negocio";
  // F(valor, duenos[, universo]) → registra la autorización y devuelve el valor para interpolarlo en el texto.
  const F = (value, duenos, uni) => {
    const universo = uni || _uni;
    for (const pf of parseFigures(String(value))) figs.push({ canon: pf.canon, value: String(value), duenos, universo });
    return value;
  };
  const NEG = ["negocio", "total", "cartera", "global"];            // dueños de un agregado del negocio
  const REF = ["benchmark", "referencia", "piso"];                  // dueños de la vara declarada
  const META_CARGA = ["meta", "target", "objetivo"];                // dueños del target de carga (NUNCA «carga» sola:
  // «la carga de Falabella es 3.5%» sería falso y pasaría — el dueño del target es la palabra meta/target)

  const L = [];
  L.push(`EL DATO DEL NEGOCIO — ${t.nombre || t.id} · escenario: ${scenario} · moneda USD.`);
  L.push(`Esto es tu conocimiento del negocio completo, para ENTENDER y contextualizar. Dos universos con período distinto: la venta comercial es del AÑO CERRADO; el inventario es la FOTO DE HOY.`);
  L.push("");

  // ── KPIs del negocio (deriveKpis — el mismo motor de la Mesa) ──
  const kv = kpis.ventas, km = kpis.margen, ki = kpis.inventario || {};
  const _iKpi = L.length;   // ← dónde empieza el bloque de KPIs: `kpis` (abajo) es ESTE MISMO tramo, no una copia
  L.push("KPIs DEL NEGOCIO (año cerrado, salvo inventario = foto de hoy):");
  // los dueños de CONCEPTO (matriz de calibración 2026-08-14): «vs presupuesto ($97.0M)» nombra a su dueño con
  // la palabra «presupuesto», no con «negocio/total» — cada agregado del KPI lleva además su palabra propia.
  L.push(`- ${_L.ventas} totales: ${F(_moneyK(kv.totalActual), NEG)} (año anterior ${F(_moneyK(kv.totalAnterior), [...NEG, "anterior"])} · presupuesto ${F(_moneyK(kv.totalPresupuesto), [...NEG, "presupuesto"])} · ${F(_pct1(kv.vsAnterior), [...NEG, "anterior"])} vs año anterior · ${F(_pct1(kv.vsPresupuesto), [...NEG, "presupuesto"])} vs presupuesto).`);
  L.push(`- ${_L.margen} de la cartera: ${F(_pct1(km.pct), NEG)} · ${_L.contribucion} total ${F(_moneyK(km.totalUSD), NEG)}.`);
  // los KPI de INVENTARIO llevan además su palabra propia como dueño (medido 2026-08-14, falso positivo de la
  // defensa del examen): «la foto de inventario suma $135K de capital» nombra al dueño con «inventario», no con
  // «negocio» — sin esto, la frase LEGÍTIMA que separa los dos universos moría por falta de dueño.
  const INV = [...NEG, "inventario", "capital", "stock", "foto"];
  if (ki && ki.totalUSD != null) L.push(`- Inventario (foto de hoy): ${_L.capital.toLowerCase()} total ${F(_money(ki.totalUSD), INV, "inventario")} · ${F(_dias(ki.doh), INV)} de inventario promedio · inmovilizado ${F(_pct1(ki.inmovilizadoPct), INV)} (${F(_money(ki.inmovilizadoUSD), INV)}).`);
  const bench = tenantPolicyDefault("benchmark"), target = tenantPolicyDefault("targetCarga"), best = tenantPolicyDefault("bestPracticeCarga");
  const dohMax = tenantPolicyDefault("dohMax"), rotMin = tenantPolicyDefault("rotacionMin");
  /* ── LAS DOS MÉTRICAS DE INVENTARIO, DEFINIDAS POR EL OWNER (2026-08-15) ────────────────────────────────────
   * «capital inmovilizado = categoría amplia; frenado = estado crítico DENTRO de capital inmovilizado.»
   * POR QUÉ ESTABAN FALTANDO: `deriveKpis().inventario` devuelve null en este tenant, así que el cerebro veía
   * las 13 filas de SKU y NINGÚN agregado — en el examen 2 sumó a mano y se inventó el criterio de corte, y el
   * muro lo vetó con razón. La carpeta tiene que traer las dos, con NOMBRE, CRITERIO y MONTO, para que no haya
   * nada que deducir. Se calculan del mismo recorrido de filas que ya existe; cero segunda verdad.
   * Los estados se DECLARAN los dos (`inmovilizado` y `frenado`), así el notario puede exigir la palabra exacta. */
  const _inv = Array.isArray(f.skuInventario) ? f.skuInventario : [];
  const _esFrenado = (s) => (typeof s.rotacion === "number" && s.rotacion < rotMin) || (typeof s.doh === "number" && s.doh > dohMax);
  const _esInmovilizado = (s) => String(s.estado || "").trim().toLowerCase() !== "activo";
  const _sumaK = (arr) => arr.reduce((a, s) => a + (Number(s.stockUSD) || 0), 0);
  const _fInmov = _inv.filter(_esInmovilizado), _fFren = _inv.filter(_esFrenado);
  for (const s of _fInmov) estados.push({ entidad: s.sku, estado: "inmovilizado", bodega: s.bodega });
  counts.add(_fInmov.length); counts.add(_fFren.length);   // los conteos de cada categoría son cifras del dato: se autorizan como tales
  const CAP_INMOV = [...NEG, "inventario", "capital", "inmovilizado", "stock"];
  const CAP_FREN = [...NEG, "inventario", "capital", "frenado", "stock"];
  if (_fInmov.length) {
    // el criterio se dice en palabras, NO enumerando los códigos de estado: «60d/90d/120d» son cifras que
    // pertenecen a SKU concretos y citarlas acá, sin su dueño al lado, las deja huérfanas (medido: tumbaba el suplente).
    L.push(`- Capital inmovilizado (categoría AMPLIA): ${F(_money(_sumaK(_fInmov)), CAP_INMOV, "inventario")} en ${_fInmov.length} SKU — todo el stock cuyo estado NO es Activo.`);
    L.push(`- Frenado (estado CRÍTICO, subconjunto del capital inmovilizado): ${F(_money(_sumaK(_fFren)), CAP_FREN, "inventario")} en ${_fFren.length} SKU — rotación bajo el piso (${_ratio(rotMin)}) o días sobre el techo (${_dias(dohMax)}).`);
    L.push(`  «Frenado» NO es sinónimo de «inmovilizado»: todo frenado está inmovilizado, pero no todo inmovilizado está frenado. Usá la palabra que corresponde a la cifra que estés citando.`);
  }
  // «La REFERENCIA la declara el negocio», no «la vara» (medido 2026-08-14, examen 1 · turno 3): la carpeta es lo
  // que el cerebro lee, así que una palabra prohibida acá se la está ENSEÑANDO — y de acá salía también al
  // suplente digno, que va a pantalla. Se corrige en la fuente, además del lavado de salida.
  L.push(`- La referencia la declara el negocio: benchmark de margen ${F(_pct1(bench), REF, "venta")}. Meta de carga comercial ${F(_pct1(target), META_CARGA, "venta")} (mejor práctica interna ${F(_pct1(best), META_CARGA, "venta")}). Piso de rotación ${F(_ratio(rotMin), REF, "inventario")} · techo de días de inventario ${F(_dias(dohMax), [...REF, "techo"], "inventario")}.`);
  const kpisLineas = L.slice(_iKpi);   // el bloque de KPIs TAL CUAL viaja en la proyección — cada cifra ya registrada por F() con su dueño
  L.push("");

  // ── UNIVERSO VENTA COMERCIAL (año cerrado · almacenado en miles · Σ cierra contra el total del negocio) ──
  _uni = "venta";   // desde acá, cada cifra que registre F() es del universo de VENTA COMERCIAL
  L.push(`UNIVERSO «${UNIVERSOS.venta_comercial.etiqueta.toUpperCase()}» (año cerrado):`);
  counts.add(f.clientesVentas.length);
  L.push(`CLIENTES (${f.clientesVentas.length}):`);
  const margenPorCliente = new Map(f.clientesMargen.map((c) => [c.nombre, c]));
  for (const c of f.clientesVentas) {
    const m = margenPorCliente.get(c.nombre);
    const D = [c.nombre];
    let linea = `- ${c.nombre} — ${_L.ventas} ${F(_moneyK(c.actual), D)} (año anterior ${F(_moneyK(c.anterior), D)} · presupuesto ${F(_moneyK(c.presupuesto), D)}) · ${c.unidades} unidades · canal ${c.canal} · marca ${c.marca} · familia ${c.sfamilia}`;
    if (m) linea += ` · ${_L.margen} ${F(_pct1(m.margen), D)} · ${_L.contribucion} ${F(_moneyK(m.contribucion), D)} · ${_L.costo} ${F(_moneyK(m.costo), D)} · ${_L.carga} ${F(_pct1(m.pctRebate), D)} (${_L.acciones.toLowerCase()} ${F(_moneyK(m.rebates), D)})`;
    if (Number.isFinite(c.actual)) rankings.cliente.ventas.push({ entidad: c.nombre, valor: c.actual });
    if (m) {
      if (Number.isFinite(m.margen)) rankings.cliente.margen.push({ entidad: c.nombre, valor: m.margen });
      if (Number.isFinite(m.contribucion)) rankings.cliente.contribucion.push({ entidad: c.nombre, valor: m.contribucion });
      if (Number.isFinite(m.pctRebate)) rankings.cliente.carga.push({ entidad: c.nombre, valor: m.pctRebate });
    }
    L.push(linea + ".");
  }
  counts.add(f.marcasMargen.length);
  L.push(`MARCAS (${f.marcasMargen.length}):`);
  for (const m of f.marcasMargen) {
    const D = [m.nombre];
    if (Number.isFinite(m.venta)) rankings.marca.ventas.push({ entidad: m.nombre, valor: m.venta });
    if (Number.isFinite(m.margen)) rankings.marca.margen.push({ entidad: m.nombre, valor: m.margen });
    if (Number.isFinite(m.contribucion)) rankings.marca.contribucion.push({ entidad: m.nombre, valor: m.contribucion });
    if (Number.isFinite(m.pctRebate)) rankings.marca.carga.push({ entidad: m.nombre, valor: m.pctRebate });
    L.push(`- ${m.nombre} — ${_L.ventas} ${F(_moneyK(m.venta), D)} · ${_L.margen} ${F(_pct1(m.margen), D)} · ${_L.contribucion} ${F(_moneyK(m.contribucion), D)} · ${_L.costo} ${F(_moneyK(m.costo), D)} · ${_L.carga} ${F(_pct1(m.pctRebate), D)} · ${m.unidades} unidades · familia ${m.sfamilia}.`);
  }
  counts.add(f.sfamiliasMargen.length);
  L.push(`FAMILIAS (${f.sfamiliasMargen.length}):`);
  for (const s of f.sfamiliasMargen) {
    const D = [s.nombre];
    L.push(`- ${s.nombre} — ${_L.ventas} ${F(_moneyK(s.venta), D)} · ${_L.margen} ${F(_pct1(s.margen), D)} · ${_L.contribucion} ${F(_moneyK(s.contribucion), D)} · ${_L.carga} ${F(_pct1(s.pctRebate), D)} · ${s.unidades} unidades.`);
  }
  counts.add(f.skusMargen.length);
  L.push(`SKU COMERCIALES (${f.skusMargen.length} · venta del año cerrado — NO confundir con la foto de inventario de abajo):`);
  for (const s of f.skusMargen) {
    const D = [s.nombre];
    L.push(`- ${s.nombre} — ${_L.ventas} ${F(_moneyK(s.venta), D)} · ${_L.margen} ${F(_pct1(s.margen), D)} · ${_L.contribucion} ${F(_moneyK(s.contribucion), D)} · ${_L.costo} ${F(_moneyK(s.costo), D)} · ${_L.carga} ${F(_pct1(s.pctRebate), D)} · ${s.unidades} unidades · costo medio ${F(_money(s.costoMedio), D)} por unidad · precio de lista ${F(_money(s.precioLista), D)} por unidad · marca ${s.marca} · familia ${s.sfamilia}.`);
  }
  L.push("");

  // ── UNIVERSO INVENTARIO (foto de hoy · dólares crudos) ──
  counts.add(f.skuInventario.length);
  const bodegas = [...new Set(f.skuInventario.map((s) => s.bodega))];
  counts.add(bodegas.length);
  _uni = "inventario";   // …y desde acá, del universo INVENTARIO (foto de hoy)
  L.push(`UNIVERSO «${UNIVERSOS.inventario.etiqueta.toUpperCase()}» (foto de hoy · ${f.skuInventario.length} SKU en ${bodegas.length} bodegas: ${bodegas.join(", ")}):`);
  for (const s of f.skuInventario) {
    const D = [s.sku, s.bodega];
    // el MISMO predicado del detector de capital (specRetrieval:577 · POLICY, una verdad): frenado = rotación
    // bajo el piso o días sobre el techo — la clasificación se DECLARA como objeto para que el notario la verifique.
    if ((typeof s.rotacion === "number" && s.rotacion < rotMin) || (typeof s.doh === "number" && s.doh > dohMax)) {
      estados.push({ entidad: s.sku, estado: "frenado", bodega: s.bodega });
    }
    // `estado ${F(s.estado, D)}`: el estado crudo («90d», «120d») ES texto de la carpeta — si el narrador lo cita
    // fiel («estado 90d»), la cita tiene que estar registrada con su dueño (medido en la matriz: FP de P2). F()
    // devuelve el valor intacto: el TEXTO de la proyección no cambia un byte.
    L.push(`- ${s.sku} (bodega ${s.bodega}) — ${_L.capital} ${F(_money(s.stockUSD), D)} · ${s.stockUnd} unidades en stock · ${_L.rotacion} ${F(_ratio(s.rotacion), D)} · Días de inventario ${F(_dias(s.doh), D)} · ${s.diasSinVenta > 0 ? `${F(_dias(s.diasSinVenta), D)} sin venta` : "con venta al día"} · vendido en el mes ${s.vendidoMes} unidades · margen de inventario ${F(_pct1(s.margenPct), D)} · estado ${F(s.estado, D)} · marca ${s.marca} · familia ${s.sfamilia}.`);
  }
  L.push("");

  // ── LOS DOS UNIVERSOS QUE NO RECONCILIAN (obligatoria · sale del contrato figureType.DIVERGENCIAS) ──
  const divVI = DIVERGENCIAS.find((d) => d.entre.includes("venta_comercial") && d.entre.includes("inventario"));
  L.push("LOS DOS UNIVERSOS QUE NO RECONCILIAN:");
  L.push(`La venta comercial y el inventario NO son el mismo negocio medido dos veces. ${divVI ? divVI.razon : ""}`);
  L.push("PROHIBIDO cruzarlos: nunca dividas, sumes ni relaciones una cifra de venta con una de inventario (cobertura, días, ratio o participación cruzada). Una cifra que haga «cerrar» esos dos universos es una alarma, no un hallazgo. Si el usuario pide ese cruce, decliná y explicá esta divergencia.");
  for (const d of DIVERGENCIAS) {
    if (d === divVI) continue;
    L.push(`- Tampoco reconcilian ${UNIVERSOS[d.entre[0]].etiqueta} ↔ ${UNIVERSOS[d.entre[1]].etiqueta}: ${d.razon}`);
  }
  L.push("");

  // ── LO QUE ESTE DATO NO TIENE (obligatoria · los huecos verificados — para declinar bien, no estirar) ──
  L.push("LO QUE ESTE DATO NO TIENE (verificado — quien prometa responder esto, inventa):");
  for (const h of _HUECOS) L.push(`- ${h}`);

  return { texto: L.join("\n"), figs, counts: [...counts], estados, rankings, kpisLineas };
}

function _cacheado(scenario) {
  const key = `${getTenantId()}::${scenario}`;
  if (!_memo.has(key)) _memo.set(key, _construir(scenario));
  return _memo.get(key);
}

/** proyectarDatoNegocio(scenario) → el TEXTO de la proyección (determinístico por tenant+escenario). */
export function proyectarDatoNegocio(scenario = "actual") {
  return _cacheado(String(scenario || "actual")).texto;
}

/** cifrasDelDato(scenario) → { figs: [{canon, value, duenos}], counts: [n...] } — la QUINTA fuente de guardC:
 * cada cifra de la proyección con los tokens dueños que la validan por cercanía. MISMO recorrido que el texto. */
export function cifrasDelDato(scenario = "actual") {
  const c = _cacheado(String(scenario || "actual"));
  return { figs: c.figs, counts: c.counts, estados: c.estados, rankings: c.rankings };
}

/** kpisDelNegocio(scenario) → las líneas de KPI de la proyección, VERBATIM (header + 3-4 líneas).
 * Tercera vista del MISMO recorrido que ya producen `texto` y `figs`: no recalcula, no reformatea, no rotula.
 * Cada cifra de estas líneas ya está registrada en `figs` con su dueño y aparece CON ese dueño en su propia
 * oración — por eso citarlas verbatim es, por construcción, lo único que este módulo puede ofrecerle a un
 * suplente sin que el muro tenga algo que cobrarle. */
export function kpisDelNegocio(scenario = "actual") {
  return _cacheado(String(scenario || "actual")).kpisLineas.slice();
}

/* ── EL SUPLENTE DIGNO PARA UN CEREBRO SIN BOLETA (corrida doble 2026-08-14) ────────────────────────────────────
 * LA GARANTÍA ANTI-SILENCIO YA EXISTE, pero solo por el camino ACTUAL: `answerViaOracle` compone su suplente
 * DESDE LA BOLETA DEL TURNO (componerPorForma → tabla → composeNoDataMessage), y el último recurso absoluto es
 * `composeNoDataMessage(null)` — el genérico PELADO, cero cifras, el único texto que puede adoptarse sin
 * veredicto porque no hay chequeo del muro que tenga algo que cobrarle a una oración sin números.
 * EL CASO QUE NO CUBRÍA: un cerebro que responde SIN tools no tiene boleta del turno — no hay `figs` desde donde
 * componer. Sus cifras verificadas son las de la proyección, y son las mismas que el muro autoriza como quinta
 * fuente. Así que la escalera es LA MISMA, con el peldaño de arriba cambiado por lo único que ese camino tiene:
 *   (1) los KPIs de la proyección, VERBATIM (cada cifra con su dueño en la misma oración) — verificados por el
 *       muro antes de adoptarse, igual que cualquier otro peldaño;
 *   (2) `composeNoDataMessage(null)`, el MISMO genérico pelado del recurso absoluto — nunca una segunda frase.
 * NO ES UN CONTRATO PARALELO: es la escalera que ya existe, extendida al camino que nació sin ella. El muro no se
 * relaja en ningún peldaño — `juzgar` es el guardC del caller, con el mismo veredicto de siempre.
 * `juzgar` se INYECTA (no se importa guardC acá) para no cerrar un ciclo: guardC → narrationBlocks, y este módulo
 * ya es una hoja del grafo. Sin `juzgar`, se adopta el peldaño 1 tal cual (el caller sin muro no tiene qué
 * verificar) — nunca se devuelve vacío. */
export function suplenteDignoDelDato({ scenario = "actual", juzgar = null } = {}) {
  const kpis = kpisDelNegocio(scenario);
  const candidato = [
    "No pude entregarte la lectura que pediste con la calidad que corresponde. Para que no te quedes sin nada, estas son las cifras verificadas de tu negocio:",
    "",
    ...kpis,
    "",
    "Dime qué parte de esto necesitas y lo trabajo sobre estas mismas cifras.",
  ].join("\n");
  if (typeof juzgar !== "function") return candidato;
  const v = juzgar(candidato);
  if (v && v.ok) return candidato;
  return composeNoDataMessage(null);   // el genérico pelado — la misma frase canónica, nunca una copia
}
