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
import { referenciaEsDelNegocio } from "../../config/businessPolicy.js";
import { getSelloDeCarga } from "../../ingesta/estadoCarga.js";
import { enLaCarpeta } from "../../ingesta/selloEnRespuesta.js";
import { UNIVERSOS, DIVERGENCIAS, reconcilian } from "../../config/contract/figureType.js";   // `reconcilian` lee la declaración del pack (owner 2026-09-14)
import { METRICS } from "../../config/contract/metricRegistry.js";
import { deriveKpis } from "../../engine/scenarios.js";
import { getVentasKPI } from "../../engine/metrics.js";   // la venta del negocio que muestra la PANTALLA — decisión del owner 2026-09-01 (ver `_construir`)
import { tenantPolicyDefault, benchmarkOf, getBenchmarkOverride, POLICY } from "../../config/businessPolicy.js";   // `benchmarkOf`: la misma vara por cliente que usa rolesCartera (brecha al benchmark)
import { getTenantId, getTenantData, onTenantChange } from "../../data/tenantStore.js";
import { parseFigures } from "../boleta.js";
import { composeNoDataMessage } from "./narrationBlocks.js";   // el último recurso ABSOLUTO del suplente digno — la MISMA frase canónica que usa la escalera anti-null, nunca una copia
import { simboloMoneda, rotuloMoneda, etiquetaSinDeclarar } from "../../config/moneda.js";
import { factorComercialDe } from "../../config/contract/figureType.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // colapso del eje (C5): el default de conveniencia dejaba leer OTRA carpeta que la pantalla
import { figsUmbralFocos, descomposicionDeBrecha } from "../specRetrieval.js";   // `descomposicionDeBrecha`: la ÚNICA definición de «carga comercial alta» (el detector) — el Notario resuelve los conjuntos desde acá
import { buildMesaFlujo } from "../sentrix/mesaFlujo.js";   // los rankings de COBRANZA salen de la MISMA mesa que la herramienta `cobranza` y la pestaña Flujo (owner 2026-09-14)   // el umbral de materialidad, los MISMOS dos números que interpola `declaracionUmbralFocos` (2026-09-14)
import { diagnoseInventarioSku } from "../diagnosis/economicDiagnosis.js";   // el estado de cada SKU: la MISMA función que la Mesa Capital y la boleta del inventario (Notario semántico, fase 4)

// ── EL FORMATEADOR DE LA BOLETA, SIN UN SEGUNDO FORMATEADOR ────────────────────────────────────────────────────
// parseFigures canoniza toda cifra con el _fmtC privado de boleta.js (canon = `unit:_fmtC(raw,unit)`). Darle el
// crudo en una forma mínima y leer el canon ES usar ese formateador — la única alternativa sería exportar _fmtC
// (tocar boleta.js, intocable) o copiarlo (el segundo formateador que esta regla prohíbe).
function _fmtBoleta(raw, unit) {
  const semilla = unit === "money" ? `${simboloMoneda()}${raw}` : unit === "pct" ? `${raw}%` : unit === "days" ? `${raw}d` : unit === "ratio" ? `${raw}x` : String(raw);
  const p = parseFigures(semilla);
  return p.length ? p[0].canon.slice(p[0].canon.indexOf(":") + 1) : semilla;
}
// % con LA convención del producto (`.toFixed(1)` — ledger.js:150: «SIEMPRE .toFixed(1) para %», la misma de
// composers/executiveReport/comparisons). El canon no distingue "22%" de "22.0%" (mismo raw), así que esto es
// presentación consistente con pantalla, no un formateador paralelo.
const _pct1 = (v) => `${(+v).toFixed(1)}%`;
const _money = (rawUSD) => _fmtBoleta(Math.round(rawUSD), "money");
/* VENTA COMERCIAL · con la escala QUE EL PACK DECLARA (owner 2026-08-30). El ×1000 fijo era correcto para los
 * tenants de fábrica (almacenan en miles) y FALSO para un pack de planilla (moneda cruda): el archivo decía
 * $61.483 y esta proyección le contaba al cerebro $61.5M — ADI hablaba con cifras mil veces más grandes que las
 * del cliente. `factorComercialDe` lee `escalaComercial` del pack; sin declarar cae a «K», así que el demo
 * produce EXACTAMENTE los mismos bytes de siempre. */
const _moneyK = (almacenado) => _money(almacenado * factorComercialDe(getTenantData()));
/** ¿hay número de verdad? — un null convertido diría «$0», que es una afirmación, no una ausencia.
 *  El CERO también cuenta como ausencia acá, y es la convención del propio motor: motorKpi guarda
 *  `totalAnterior || null` y deriveKpis re-suma un dato ausente como 0 — así que un 0 en estos agregados
 *  significa «no hubo período/presupuesto», no «vendió cero». */
const _hay = (v) => typeof v === "number" && Number.isFinite(v) && v !== 0;
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
/* ── LA VENTA DEL NEGOCIO ES LA DE LA PANTALLA (owner 2026-09-01, textual) ──────────────────────────────────
 * «Usa como venta oficial del negocio la misma cifra que muestra la pantalla. ADI y Sentrix deben decir el
 * mismo número para el mismo concepto. Si existe otra suma interna, déjala como fuente secundaria o pendiente,
 * pero no la uses como "total del negocio" en conversación.»
 *
 * EL DEFECTO, medido (2026-09-01, escenario `bonanza`): este módulo publicaba los KPI de ventas desde
 * `deriveKpis`, que SUMA LAS FILAS de clientes (99.887 → «$99.9M»), mientras la superficie —card, hero y la
 * respuesta que abre su click— usa `getVentasKPI` (99.999 → «$100.0M»); ver `mesa.js:93` y su comentario de
 * COHERENCIA de 2026-07-15, donde la intención de «una verdad» ya estaba escrita. Divergían TRES cifras del
 * mismo concepto: el total, el % vs año anterior (7,5 contra 7,6) y el % vs presupuesto (3,0 contra 3,1).
 *
 * ⚠️ ACOTADO AL CONCEPTO, Y MEDIDO ANTES DE ACOTARLO: se comparó la familia entera con los mismos dueños
 * (`negocio+total+cartera+global`). El margen de la cartera (25,1%) y la contribución total ($25K) NO divergen
 * — la Mesa los calcula sumando las mismas filas que `deriveKpis` (`mesa.js:111`), así que ahí ADI y la
 * pantalla ya dicen lo mismo y no se tocan. El año anterior y el presupuesto tampoco: son literales del pack.
 * (La primera medición de esto comparó el margen contra `getMargenKPI` —que existe pero la card NO usa— y daba
 * un falso «el concepto entero está roto». La fuente de la pantalla es la que la pantalla llama, no la que
 * lleva su nombre.)
 *
 * LA OTRA SUMA NO SE BORRA: `deriveKpis().ventas` sigue siendo el motor de todo lo demás de este módulo y es
 * la Σ de las filas, que es lo correcto para hablar POR FILA. Queda como FUENTE SECUNDARIA del total: no se
 * publica como «total del negocio» en conversación, que es exactamente lo que el owner pidió. Los dos números
 * son sumas de verdad, no un redondeo — difieren en 112 (0,112%) por lo que el dataset arrastra entre
 * `ventasKPI` y Σ`clientesVentas`, y `sentrix/temporal.js` ya lo declaraba. */
function _construir(scenario) {
  const t = getTenantData();
  const f = _filas(scenario);
  const _derivados = deriveKpis(scenario);
  const _ventasPantalla = getVentasKPI(null, null, scenario) || {};
  const kpis = { ..._derivados, ventas: { ...(_derivados.ventas || {}), ..._ventasPantalla } };
  const figs = [];
  const counts = new Set();
  /* ESTADOS y RANKINGS (constitución 2026-08-14, chequeos 3 y 4 del notario): las clasificaciones y los
   * órdenes que la carpeta DECLARA, como objetos verificables — el mismo recorrido y los mismos umbrales
   * del texto (tenantPolicyDefault, la única verdad), nunca una segunda regla. El TEXTO no cambia un byte. */
  const estados = [];
  /* CADA RANKING SE DECLARA ENTERO (owner 2026-08-16): universo evaluado · dirección · regla de empate · campo
   * fuente · y los términos con los que la prosa lo nombra. Antes eran listas peladas y el notario tenía que
   * traer de su lado la polaridad de cada métrica —«la peor carga comercial» es la MÁS ALTA, «el peor margen» el
   * MÁS BAJO— o sea una segunda regla viviendo lejos del dato. Ahora la trae la carpeta, que es quien la sabe.
   *   · direccion : cómo se lee el orden (mayor = del más grande al más chico).
   *   · peorEs    : en qué extremo está el PROBLEMA. Es lo que resuelve «el peor» sin que el muro adivine.
   *   · empate    : qué pasa si dos comparten el extremo (ver EMPATE, abajo).
   *   · campo     : el campo del dato del que sale, textual — para poder auditarlo sin leer este archivo.
   *   · terminos  : cómo lo nombra la prosa. El muro no tiene vocabulario propio: usa el que declara la carpeta. */
  const EMPATE = "todos los que comparten el valor extremo son extremo válido; entre ellos el orden es alfabético";
  /* ── EL LÉXICO DE CADA MÉTRICA, DECLARADO (owner 2026-09-14, el orden se verifica en todas sus formas) ─────────────────────────
   * El conjunto adversarial mostró 158 afirmaciones de orden falsas que el muro no juzgaba porque el vocabulario del ranking eran solo
   * los SUSTANTIVOS («ventas», «contribución»): «la que más VENDE», «el que más contribución APORTA», «el mayor VENDEDOR», «el peor
   * PAGADOR», «la cuenta más CARGADA», «la más MOROSA», «el SKU más LENTO» nombran la misma métrica con un verbo, un adjetivo o un
   * sustantivo de agente. Ese vocabulario es de la métrica, y lo declara la carpeta —no el muro, que no sabe qué «lento» significa
   * para una rotación (menos) y para unos días de inventario (más)—: `lexico.verbos` son raíces («vend» cubre vende/venden/vendió),
   * `lexico.adjetivos` llevan su POLARIDAD (el extremo que nombra «la más morosa» es el de MÁS días), y `lexico.agentes` son los
   * sustantivos de persona («vendedor», «deudor», «pagador»), que toman la dirección del marcador («el mayor deudor»). Un adjetivo
   * de JUICIO («urgente», «crítica») nombra los días vencidos por defecto (así habla el cierre), pero cede cuando la oración
   * declara otro eje («la más urgente por monto»): `juicio: true`. */
  const _R = (universo, direccion, peorEs, campo, terminos, lexico = null) => ({ universo, direccion, peorEs, empate: EMPATE, campo, terminos, filas: [], ...(lexico ? { lexico } : {}) });
  const _LEX = {
    ventas:       { verbos: ["vend", "factur"], agentes: ["vendedor(?:es|a|as)?"] },
    margen:       { verbos: ["margin"] },
    contribucion: { verbos: ["contribu", "aport"] },
    carga:        { verbos: ["carg"], adjetivos: { "cargad[oa]s?": "mayor" } },
    unidades:     { },
    saldo_vencido:{ verbos: ["deb", "adeud"], agentes: ["deudor(?:es|a|as)?"] },   // «la cuenta más morosa» son los DÍAS (adjetivo de dias_vencido), no el monto
    recuperado:   { verbos: ["recuper", "cobr"], agentes: ["pagador(?:es|a|as)?"] },
    dias_vencido: { verbos: ["atras", "demor", "tard"], adjetivos: { "moros[oa]s?": "mayor", "atrasad[oa]s?": "mayor", "urgentes?": "mayor", "cr[íi]tic[oa]s?": "mayor" }, juicio: ["urgentes?", "cr[íi]tic[oa]s?", "urgencia"] },
    rotacion:     { verbos: ["rot"], adjetivos: { "lent[oa]s?": "menor", "r[áa]pid[oa]s?": "mayor" } },
    dias_inventario: { adjetivos: { "lent[oa]s?": "mayor" } },
  };
  const rankings = {
    cliente: {
      ventas:       _R("los 13 clientes · venta comercial (año cerrado)", "mayor", "menor", "clientesVentas.actual", ["ventas?", "factura(?:ci[óo]n)?"], _LEX.ventas),
      margen:       _R("los 13 clientes · venta comercial (año cerrado)", "mayor", "menor", "clientesMargen.margen", ["m[áa]rgen(?:es)?"], _LEX.margen),
      contribucion: _R("los 13 clientes · venta comercial (año cerrado)", "mayor", "menor", "clientesMargen.contribucion", ["contribuci[óo]n"], _LEX.contribucion),
      /* «carga» A SECAS es la carga comercial (auditoría del Notario 2026-09-14, P1·3: «Falabella … carga 4.5% — la más alta de la cartera»,
       * con Easy 5.5 y Sodimac 5.4): el borrador la nombra sin el apellido y el muro, con el término completo como único vocabulario, no la
       * juzgaba. El término más largo sigue ganando cuando el apellido está. */
      carga:        _R("los 13 clientes · venta comercial (año cerrado)", "mayor", "mayor", "clientesMargen.pctRebate", ["carga\\s+comercial", "carga"], _LEX.carga),
      /* LAS UNIDADES VENDIDAS (owner 2026-09-14, auditoría del Notario · familia «orden»): «Jumbo es el cliente con más unidades vendidas
       * (1.194) y más contribución ($4.2M)» — la primera mitad es verdad y la segunda no (Falabella $4.3M), y el muro no podía verificar
       * ninguna: las unidades son una métrica del contrato de dominios (Comercial + unidades) sin ranking declarado. Sin lado malo
       * (peorEs null): vender menos unidades no es «peor» por sí solo. «unidades en stock» es del inventario y no entra. */
      unidades:     _R("los 13 clientes · venta comercial (año cerrado)", "mayor", null, "clientesVentas.unidades", ["unidades(?:\\s+vendidas)?(?!\\s+en\\s+stock)", "volumen(?!\\s+(?:de|en)\\s+(?:venta|factura|negocio|d[óo]lares|\\$))"]),
      /* LA BRECHA AL BENCHMARK Y LA CONTRIBUCIÓN NO CAPTURADA (owner 2026-09-14, segunda corrida de la prueba 2): «la segunda
       * mayor brecha de margen, 8.6 pp» —la de Lider es la MAYOR— no tenía ranking contra el cual medirse, y «la mayor
       * contribución no capturada» se juzgaba contra la contribución a secas (otra métrica). Los ordinales y los extremos
       * se verifican igual: una cifra correcta con posición incorrecta es una conclusión falsa. La brecha es la misma
       * cuenta que rolesCartera (vara del cliente − margen); la no capturada, venta oficial × brecha, solo bajo la vara.
       * «brecha» A SECAS (el orden en todas sus formas, 2026-09-14): «Falabella tiene mayor brecha que Lider» —8.1 contra 8.6— es la
       * brecha de margen en la prosa de la casa; solo «brecha de contribución» es la otra (y su término, más largo, gana). */
      brecha:       _R("los 13 clientes · venta comercial (año cerrado)", "mayor", "mayor", "benchmarkOf(cliente) − clientesMargen.margen", ["brecha\\s+(?:al|contra\\s+el|frente\\s+al|respecto\\s+(?:al|del))\\s+benchmark", "brecha\\s+de\\s+margen", "distancia\\s+(?:al\\s+benchmark|a\\s+la\\s+referencia)", "brecha\\s+al\\s+margen", "brecha(?!\\s+(?:de|en|por)\\s+(?:contribuci[óo]n|precio|costo|carga|dinero|d[óo]lares|pesos|plata|monto|venta|volumen|\\$))"]),
      no_capturada: _R("los clientes bajo el benchmark · venta comercial (año cerrado)", "mayor", "mayor", "clientesVentas.actual × (benchmarkOf(cliente) − clientesMargen.margen)", ["contribuci[óo]n\\s+(?:no\\s+capturada|sin\\s+capturar)", "contribuci[óo]n\\s+(?:que\\s+)?(?:se\\s+)?dej(?:a|an|as|amos)\\s+de\\s+capturar", "brecha\\s+de\\s+contribuci[óo]n(?:\\s+(?:no\\s+capturada|sin\\s+capturar))?", "brecha\\s+en\\s+(?:pesos|dinero|d[óo]lares|plata|\\$)", "sin\\s+capturar", "no\\s+capturad[oa]s?"]),
    },
    marca: {
      ventas:       _R("las 5 marcas · venta comercial (año cerrado)", "mayor", "menor", "marcas.venta", ["ventas?", "factura(?:ci[óo]n)?"], _LEX.ventas),
      margen:       _R("las 5 marcas · venta comercial (año cerrado)", "mayor", "menor", "marcas.margen", ["m[áa]rgen(?:es)?"], _LEX.margen),
      contribucion: _R("las 5 marcas · venta comercial (año cerrado)", "mayor", "menor", "marcas.contribucion", ["contribuci[óo]n"], _LEX.contribucion),
      /* ⚠️ el término iba con UNA barra invertida («carga\\s+comercial» dentro de una cadena JS es «cargas+comercial»): el ranking de carga
       * por marca existía pero no casaba nunca — medido al declarar los de cobranza (2026-09-14). Mismos términos que el eje cliente. */
      carga:        _R("las 5 marcas · venta comercial (año cerrado)", "mayor", "mayor", "marcas.pctRebate", ["carga\\s+comercial", "carga"], _LEX.carga),
      /* la brecha al benchmark por marca: LA MISMA cuenta que por cliente (benchmarkOf − margen, con signo: una marca sobre el benchmark
       * va negativa). Sin ella, «LG es la mayor brecha en puntos de toda la cartera» (fase 3 del Notario, 2026-09-15) no tenía contra qué
       * medirse y casaba, por vocabulario, con las medidas en $ de cerrar brecha de 4 marcas — otra métrica y otra unidad. */
      brecha:       _R("las 5 marcas · venta comercial (año cerrado)", "mayor", "mayor", "benchmarkOf(marca) − marcas.margen", ["brecha\\s+(?:al|contra\\s+el|frente\\s+al|respecto\\s+(?:al|del))\\s+benchmark", "brecha\\s+de\\s+margen", "distancia\\s+(?:al\\s+benchmark|a\\s+la\\s+referencia)", "brecha\\s+al\\s+margen", "brecha(?!\\s+(?:de|en|por)\\s+(?:contribuci[óo]n|precio|costo|carga|dinero|d[óo]lares|pesos|plata|monto|venta|volumen|\\$))"]),
    },
    /* EL EJE SKU · el hueco que dejó la corrida de adopción: el cerebro acertó sus tres superlativos de SKU, pero
     * por mérito suyo — el muro no tenía contra qué medirlos. Son los del universo INVENTARIO (foto de hoy).
     * ⚠️ NO HAY RANKING DE «COBERTURA», y no es un olvido: el dato trae `doh` y `cobertura` como campos
     * distintos (difieren en 8 de 13 SKU, hasta 28 días) y el owner resolvió la ambigüedad POR ELIMINACIÓN —
     * `cobertura` es un duplicado redondeado que se declina. En pantalla se dice «días de inventario» y sale
     * de `doh`. Declarar un ranking de cobertura sería reponer el término que se sacó.
     * ⚠️ Y el margen del SKU es el de INVENTARIO, no el de venta: el mismo SKU tiene los dos y son cifras
     * distintas. Por eso el término declarado exige la etiqueta completa. */
    sku: {
      /* LA VENTA Y LA CONTRIBUCIÓN DEL SKU (el orden en todas sus formas, 2026-09-14): «LG-WASH11KG es el SKU de mayor venta ($12.4M)»
       * —SAM-TV55 vende $13.3M— y «SAM-TV55 es el SKU con más contribución ($2.5M)» —PHI-SHAVER9 $3.4M— no tenían ranking: el eje SKU
       * solo declaraba los del universo INVENTARIO. Son del universo VENTA (año cerrado, `skusMargen`), como los del cliente; el margen del
       * SKU NO se declara acá porque «margen» a secas para un SKU es ambiguo (venta o inventario) y la casa exige la etiqueta completa. */
      ventas:           _R("los 13 SKU comerciales · venta comercial (año cerrado)", "mayor", "menor", "skusMargen.venta", ["ventas?", "factura(?:ci[óo]n)?", "vendid[oa]s?"], _LEX.ventas),
      contribucion:     _R("los 13 SKU comerciales · venta comercial (año cerrado)", "mayor", "menor", "skusMargen.contribucion", ["contribuci[óo]n"], _LEX.contribucion),
      /* «más capital» NO es «peor capital»: SAM-REF500L es el SKU de más capital ($19K) y rota 9.8x — está sano.
       * Por eso este ranking va SIN polaridad (peorEs null) y el notario solo le verifica «mayor/menor», nunca
       * «el peor». El capital que sí tiene lado malo es el INMOVILIZADO, y ese es su propio ranking, sobre su
       * propio universo: los SKU cuyo estado no es Activo. Son dos conjuntos distintos y se declaran distintos. */
      capital:            _R("los 13 SKU en inventario · foto de hoy", "mayor", null, "skuInventario.stockUSD", ["capital"]),
      /* «FRENADO» NO ES SINÓNIMO DE «INMOVILIZADO» (la propia proyección lo declara más abajo; medido en el conjunto adversarial, 2026-09-14):
       * «BOS-SANDER es el segundo SKU en capital frenado ($11K)» es verdad sobre los 3 frenados (POLICY: rotación bajo el piso o días sobre
       * el techo) y falsa sobre los 5 inmovilizados (estado ≠ Activo). Antes «capital frenado» era un término del ranking inmovilizado y
       * ese ordinal verdadero ardía. Dos rankings, dos universos, cada término en el suyo. */
      capital_inmovilizado: _R("los SKU cuyo estado NO es Activo · foto de hoy", "mayor", "mayor", "skuInventario.stockUSD (estado ≠ Activo)", ["capital\\s+inmovilizado"]),
      capital_frenado:      _R("los SKU frenados (rotación bajo el piso o días sobre el techo) · foto de hoy", "mayor", "mayor", "skuInventario.stockUSD (frenado por POLICY)", ["capital\\s+frenado", "capital\\s+detenido"]),
      rotacion:         _R("los 13 SKU en inventario · foto de hoy", "mayor", "menor", "skuInventario.rotacion", ["rotaci[óo]n"], _LEX.rotacion),
      dias_inventario:  _R("los 13 SKU en inventario · foto de hoy", "mayor", "mayor", "skuInventario.doh", ["d[íi]as\\s+de\\s+inventario"], _LEX.dias_inventario),
      dias_sin_venta:   _R("los SKU con días sin venta registrados · foto de hoy", "mayor", "mayor", "skuInventario.diasSinVenta", ["d[íi]as\\s+sin\\s+venta"]),
      margen_inventario:_R("los 13 SKU en inventario · foto de hoy", "mayor", "menor", "skuInventario.margenPct", ["m[áa]rgen\\s+de\\s+inventario"]),
    },
    /* EL EJE BODEGA (el orden en todas sus formas, 2026-09-14): «Valparaíso es la bodega con más capital ($39K)» —Santiago tiene $64K—
     * no tenía ranking. Es el capital de la foto sumado por bodega, con el MISMO predicado de frenado que `estados` (POLICY, una verdad)
     * para el frenado; el capital total sin lado malo (más capital en una bodega no es peor). Las filas se llenan en el recorrido del
     * inventario, sin recalcular nada fuera de él. */
    bodega: {
      capital:          _R("las bodegas del inventario · foto de hoy", "mayor", null, "Σ skuInventario.stockUSD por bodega", ["capital(?!\\s+(?:frenado|inmovilizado|detenido))", "inventario", "stock"]),
      capital_frenado:  _R("las bodegas del inventario · foto de hoy", "mayor", "mayor", "Σ skuInventario.stockUSD por bodega (frenados por POLICY)", ["capital\\s+frenado", "capital\\s+detenido", "frenado"]),
      capital_inmovilizado: _R("las bodegas del inventario · foto de hoy", "mayor", "mayor", "Σ skuInventario.stockUSD por bodega (estado ≠ Activo)", ["capital\\s+inmovilizado", "inmovilizado"]),
    },
  };
  /* LOS DOS CAMPOS DE DÍAS, POR SEPARADO (owner 2026-08-16, deriva medida en el Examen 4). El texto ya los
   * distingue —«Días de inventario 190d» y «112d sin venta»— pero como CIFRAS los dos llegan al notario con el
   * mismo dueño y la misma unidad, así que no tenía cómo ver que el narrador le puso a uno el rótulo del otro
   * («más de 120 días sin rotar» sobre un valor que era de inventario). Acá se declaran nombrados. `sinVenta`
   * es null cuando el SKU está con venta al día: esa ausencia también es un dato, y el notario la exige. */
  const dias = {};
  /* EL UNIVERSO DE CADA CIFRA (owner 2026-08-15, fuga medida en el examen 2): ADI comparó el «margen de
   * inventario 34%» de un SKU contra «el benchmark de cartera (30.1%)», que es del universo de VENTA. Ninguna
   * cuenta cruzó los dos mundos — cruzó la COMPARACIÓN. Para que el notario pueda verlo hace falta que la carpeta
   * diga de qué universo sale cada cifra: es ella la que lo sabe, no el muro. `_uni` marca el bloque en curso y
   * el tercer argumento de F() lo pisa cuando una línea mezcla varas de los dos (la de la referencia). */
  let _uni = "negocio";
  // F(valor, duenos[, universo]) → registra la autorización y devuelve el valor para interpolarlo en el texto.
  const F = (value, duenos, uni, concepto = null) => {
    const universo = uni || _uni;
    for (const pf of parseFigures(String(value))) figs.push({ canon: pf.canon, value: String(value), duenos, universo, ...(concepto ? { concepto } : {}) });
    return value;
  };
  /* ── LAS UNIDADES, CON DUEÑO Y CONCEPTO (owner 2026-09-14, atribución y significado) ─────────────────────────────────────
   * parseFigures no ve enteros sin unidad, así que F() nunca registró «1.194 unidades» ni «140 unidades en stock», y sin salesRead en
   * el turno «Falabella tiene 1.042 unidades en stock» (son sus VENDIDAS) no tenía con qué juzgarse. U() registra el conteo con el
   * mismo canon que la boleta («count:1194»), su dueño y el concepto (unidades_vendidas · unidades_stock) — SIN tocar el texto de la
   * proyección ni los conteos declarados (`counts`): solo alimenta el dueño y el significado en el muro. Nunca un cero. */
  const U = (n, duenos, uni, concepto) => {
    const v = Number(n);
    if (Number.isFinite(v) && v > 0) figs.push({ canon: `count:${Math.round(v)}`, value: String(Math.round(v)), duenos, universo: uni, concepto });
  };
  const NEG = ["negocio", "total", "cartera", "global"];            // dueños de un agregado del negocio
  const REF = ["benchmark", "referencia", "piso"];                  // dueños de la vara declarada
  const META_CARGA = ["meta", "target", "objetivo"];                // dueños del target de carga (NUNCA «carga» sola:
  // «la carga de Falabella es 3.5%» sería falso y pasaría — el dueño del target es la palabra meta/target)

  const L = [];
  /* LA MONEDA DEL HEADER ES LA DECLARADA. «USD» fijo le afirmaba al cerebro la moneda equivocada de cualquier
   * pack que declare otra (un archivo en CLP quedaba presentado como dólares). Sin declaración cae a «USD» —
   * los tenants de fábrica, byte-idéntico. */
  // (el token «escenario: X» murió con el colapso del eje — retrabajo ultracode 2026-08-30: el único mundo no
  //  se declara al modelo; el parámetro sigue siendo la ranura del dato, no una etiqueta del prompt)
  L.push(`EL DATO DEL NEGOCIO — ${t.nombre || t.id} · moneda ${rotuloMoneda(t) || "USD"}.`);
  L.push(`Esto es tu conocimiento del negocio completo, para ENTENDER y contextualizar. Dos universos con período distinto: la venta comercial es del AÑO CERRADO; el inventario es la FOTO DE HOY.`);
  L.push("");

  // ── KPIs del negocio (deriveKpis — el mismo motor de la Mesa) ──
  const kv = kpis.ventas, km = kpis.margen, ki = kpis.inventario || {};
  const _iKpi = L.length;   // ← dónde empieza el bloque de KPIs: `kpis` (abajo) es ESTE MISMO tramo, no una copia
  L.push("KPIs DEL NEGOCIO (año cerrado, salvo inventario = foto de hoy):");
  // los dueños de CONCEPTO (matriz de calibración 2026-08-14): «vs presupuesto ($97.0M)» nombra a su dueño con
  // la palabra «presupuesto», no con «negocio/total» — cada agregado del KPI lleva además su palabra propia.
  /* LO AUSENTE SE DICE CON PALABRAS, NUNCA «$0» (owner 2026-08-30, misma regla que la moneda de la v2.3): un
   * pack de planilla no declara presupuesto y puede no tener período anterior. `$0 · 0.0% vs presupuesto` acá le
   * afirmaba al cerebro un presupuesto de cero — una cifra inventada con cara de dato. Con todos los valores
   * presentes (los tenants de fábrica), la línea es byte-idéntica a la de siempre. */
  const _kvPartes = [
    _hay(kv.totalAnterior) ? `año anterior ${F(_moneyK(kv.totalAnterior), [...NEG, "anterior"])}` : "sin período anterior",
    _hay(kv.totalPresupuesto) ? `presupuesto ${F(_moneyK(kv.totalPresupuesto), [...NEG, "presupuesto"])}` : etiquetaSinDeclarar("presupuesto"),
    /* el «vs» cuelga de la presencia del TOTAL, no del vs mismo: un año plano da 0.0% legítimo y se dice */
    ...(_hay(kv.totalAnterior) ? [`${F(_pct1(kv.vsAnterior || 0), [...NEG, "anterior"])} vs año anterior`] : []),
    ...(_hay(kv.totalPresupuesto) ? [`${F(_pct1(kv.vsPresupuesto || 0), [...NEG, "presupuesto"])} vs presupuesto`] : []),
  ];
  L.push(`- ${_L.ventas} totales: ${F(_moneyK(kv.totalActual), NEG)} (${_kvPartes.join(" · ")}).`);
  L.push(`- ${_L.margen} de la cartera: ${F(_pct1(km.pct), NEG)} · ${_L.contribucion} total ${F(_moneyK(km.totalUSD), NEG)}.`);
  /* LOS MISMOS KPIs CON SU SIGNIFICADO (Notario semántico, fase 2): figs rotuladas para el índice de la evidencia — `figs` de arriba
   * solo lleva valor y dueños («$97.0M · negocio/total» no dice si es la venta o el presupuesto); estas dicen qué es cada cifra. Mismo
   * recorrido, mismos formateadores: cero segunda verdad. */
  const kpisFigs = [];
  const K = (label, value, unit, raw) => { if (value != null && Number.isFinite(raw)) kpisFigs.push({ label, value: String(value), unit, raw, source: "dato", mandatory: false, context: "KPI del negocio (proyección del dato)" }); };
  const _fxK = factorComercialDe(getTenantData());
  K("Ventas totales", _moneyK(kv.totalActual), "money", kv.totalActual * _fxK);
  if (_hay(kv.totalAnterior)) { K("Ventas del año anterior", _moneyK(kv.totalAnterior), "money", kv.totalAnterior * _fxK); K("Variación vs año anterior", _pct1(kv.vsAnterior || 0), "pct", +(kv.vsAnterior || 0)); }
  if (_hay(kv.totalPresupuesto)) { K("Presupuesto total", _moneyK(kv.totalPresupuesto), "money", kv.totalPresupuesto * _fxK); K("Variación vs presupuesto", _pct1(kv.vsPresupuesto || 0), "pct", +(kv.vsPresupuesto || 0)); }
  K("Margen promedio", _pct1(km.pct), "pct", +km.pct);
  K("Contribución total", _moneyK(km.totalUSD), "money", km.totalUSD * _fxK);
  // los KPI de INVENTARIO llevan además su palabra propia como dueño (medido 2026-08-14, falso positivo de la
  // defensa del examen): «la foto de inventario suma $135K de capital» nombra al dueño con «inventario», no con
  // «negocio» — sin esto, la frase LEGÍTIMA que separa los dos universos moría por falta de dueño.
  const INV = [...NEG, "inventario", "capital", "stock", "foto"];
  if (ki && ki.totalUSD != null) { K("Capital total", _money(ki.totalUSD), "money", +ki.totalUSD); if (Number.isFinite(+ki.doh)) K("Días de inventario promedio", _dias(ki.doh), "days", Math.round(+ki.doh)); }
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
  /* EL TOTAL DE LA FOTO, CUANDO EL KPI NO LO TRAE (2026-09-14, al cerrar la lotería del catálogo): en el demo
   * `deriveKpis().inventario` es null y la carpeta declaraba lo inmovilizado y lo frenado SIN el total del que son
   * parte — «$33K de $135K en inventario frenados en 3 SKU» (corpus congelado de la calibración) pasaba solo porque
   * el catálogo recomputaba el $135K a ciegas. Es la misma Σ de `stockUSD` que ya suma las dos categorías y la que
   * pinta la card «Capital en inventario» de la Mesa: cero segunda verdad, con los dueños de la foto. */
  if (!(ki && ki.totalUSD != null) && _inv.length) K("Capital total", _money(_sumaK(_inv)), "money", _sumaK(_inv));
  if (!(ki && ki.totalUSD != null) && _inv.length) L.push(`- Inventario (foto de hoy): ${_L.capital.toLowerCase()} total ${F(_money(_sumaK(_inv)), INV, "inventario")} en ${_inv.length} SKU.`);
  if (_fInmov.length) {
    K(`Capital inmovilizado · subtotal · ${_fInmov.length} SKU`, _money(_sumaK(_fInmov)), "money", _sumaK(_fInmov));
    K(`Capital frenado · subtotal · ${_fFren.length} SKU`, _money(_sumaK(_fFren)), "money", _sumaK(_fFren));
    // el criterio se dice en palabras, NO enumerando los códigos de estado: «60d/90d/120d» son cifras que
    // pertenecen a SKU concretos y citarlas acá, sin su dueño al lado, las deja huérfanas (medido: tumbaba el suplente).
    L.push(`- Capital inmovilizado (categoría AMPLIA): ${F(_money(_sumaK(_fInmov)), CAP_INMOV, "inventario")} en ${_fInmov.length} SKU — todo el stock cuyo estado NO es Activo.`);
    L.push(`- Frenado (estado CRÍTICO, subconjunto del capital inmovilizado): ${F(_money(_sumaK(_fFren)), CAP_FREN, "inventario")} en ${_fFren.length} SKU — rotación bajo el piso (${_ratio(rotMin)}) o días sobre el techo (${_dias(dohMax)}).`);
    L.push(`  «Frenado» NO es sinónimo de «inmovilizado»: todo frenado está inmovilizado, pero no todo inmovilizado está frenado. Usá la palabra que corresponde a la cifra que estés citando.`);
  }
  // «La REFERENCIA la declara el negocio», no «la vara» (medido 2026-08-14, examen 1 · turno 3): la carpeta es lo
  // que el cerebro lee, así que una palabra prohibida acá se la está ENSEÑANDO — y de acá salía también al
  // suplente digno, que va a pantalla. Se corrige en la fuente, además del lavado de salida.
  /* ⚠️ DE QUIÉN ES LA VARA, dicho en la carpeta (owner 2026-08-26): «no quiero que la referencia general parezca
   * una meta del cliente». Esta línea antes afirmaba SIEMPRE que la referencia la declaraba el negocio, y desde
   * que la plantilla dejó de pedir el benchmark eso puede ser falso — le estaría enseñando al cerebro a
   * atribuirle al usuario un objetivo que nunca fijó. La procedencia sale de `businessPolicy`, que es quien
   * resuelve el valor: una sola verdad sobre la misma cifra. */
  const _refPropia = referenciaEsDelNegocio();
  K("Benchmark de margen", _pct1(bench), "pct", +bench); K("Nivel de carga declarado", _pct1(target), "pct", +target);
  if (Number.isFinite(+dohMax)) K("Techo de días de inventario", _dias(dohMax), "days", Math.round(+dohMax)); if (Number.isFinite(+rotMin)) K("Piso de rotación", _ratio(rotMin), "ratio", +rotMin);
  L.push(`- ${_refPropia ? "La referencia la declara el negocio" : "La referencia es la GENERAL DE ADI (el negocio no declaró una propia; NO es su meta, y así hay que decirlo si se nombra)"}: benchmark de margen ${F(_pct1(bench), REF, "venta")}. Meta de carga comercial ${F(_pct1(target), META_CARGA, "venta")} (mejor práctica interna ${F(_pct1(best), META_CARGA, "venta")}). Piso de rotación ${F(_ratio(rotMin), REF, "inventario")} · techo de días de inventario ${F(_dias(dohMax), [...REF, "techo"], "inventario")}.`);
  /* EL UMBRAL DE MATERIALIDAD ES UNA REFERENCIA DEL NEGOCIO (owner 2026-09-14, al cerrar la lotería del catálogo): «0.05%
   * de la venta: $50K» decide qué foco es material y qué queda en monitoreo, y ningún emisor lo publicaba — el cerebro lo
   * decía («está bajo el 0.05% de tu venta») y el muro lo dejaba pasar solo por una participación recomputada a ciegas.
   * Los dos números salen de la MISMA función que interpola la frase (`figsUmbralFocos`, specRetrieval) y llevan como
   * dueño la palabra que lo nombra: «umbral», «material(es)», «materialidad» — nunca «venta» sola, que autorizaría
   * cualquier $50K colgado de una cuenta. */
  const _umbral = (() => { try { return figsUmbralFocos(); } catch { return []; } })();
  if (_umbral.length === 2) {
    const UMBRAL = ["umbral", "material", "materialidad"];
    L.push(`- Umbral de materialidad de los focos: ${F(_umbral[0].value, UMBRAL, "venta")} de la venta real (${F(_umbral[1].value, UMBRAL, "venta")}) — lo que queda bajo el umbral se declara como monitoreo, no se calla.`);
    for (const u of _umbral) if (u && u.label) K(String(u.label), u.value, u.unit || null, Number.isFinite(+u.raw) ? +u.raw : NaN);
  }
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
    // año anterior y presupuesto ausentes → palabras, no un «$0» (la misma regla que la línea de KPIs)
    const _cCola = [
      _hay(c.anterior) ? `año anterior ${F(_moneyK(c.anterior), D)}` : "sin período anterior",
      _hay(c.presupuesto) ? `presupuesto ${F(_moneyK(c.presupuesto), D)}` : etiquetaSinDeclarar("presupuesto"),
    ].join(" · ");
    U(c.unidades, D, "unidades", "unidades_vendidas");
    let linea = `- ${c.nombre} — ${_L.ventas} ${F(_moneyK(c.actual), D, undefined, "ventas")} (${_cCola}) · ${c.unidades} unidades · canal ${c.canal} · marca ${c.marca} · familia ${c.sfamilia}`;
    /* ── LA VARIACIÓN DE CADA CUENTA, CON SU SIGNO (owner 2026-09-14, atribución y significado) ─────────────────────────────
     * La venta actual y la del año anterior ya viajan por cuenta; la VARIACIÓN entre ambas (la que publica salesRead como «X · YoY»
     * y «X · Variación vs año anterior») no, y sin salesRead en el turno «Ripley cae en venta (-8.2%)» —verdad— ardía como cifra
     * no autorizada y «Ripley suma $422K más que el año pasado» —falsa— pasaba sin signo que verificar. Se registra con el
     * concepto «variacion» para que el muro la lea como movimiento (dirección y signo), SIN tocar el texto de la proyección. La
     * cuenta es la misma de salesRead (actual − anterior, y su razón): dos cifras publicadas y su diferencia, nunca un tercer dato. */
    if (_hay(c.anterior) && Number.isFinite(c.actual)) {
      const dif = c.actual - c.anterior, pct = (dif / c.anterior) * 100;
      F(`${dif < 0 ? "-" : "+"}${_moneyK(Math.abs(dif))}`, D, "venta", "variacion");
      F(`${pct < 0 ? "-" : "+"}${_pct1(Math.abs(pct))}`, D, "venta", "variacion");
    }
    if (m) linea += ` · ${_L.margen} ${F(_pct1(m.margen), D, undefined, "margen")} · ${_L.contribucion} ${F(_moneyK(m.contribucion), D, undefined, "contribucion")} · ${_L.costo} ${F(_moneyK(m.costo), D, undefined, "costo")} · ${_L.carga} ${F(_pct1(m.pctRebate), D, undefined, "carga")} (${_L.acciones.toLowerCase()} ${F(_moneyK(m.rebates), D, undefined, "carga")})`;
    if (Number.isFinite(c.actual)) rankings.cliente.ventas.filas.push({ entidad: c.nombre, valor: c.actual });
    if (Number.isFinite(+c.unidades)) rankings.cliente.unidades.filas.push({ entidad: c.nombre, valor: +c.unidades });
    if (m) {
      if (Number.isFinite(m.margen)) rankings.cliente.margen.filas.push({ entidad: c.nombre, valor: m.margen });
      if (Number.isFinite(m.contribucion)) rankings.cliente.contribucion.filas.push({ entidad: c.nombre, valor: m.contribucion });
      if (Number.isFinite(m.pctRebate)) rankings.cliente.carga.filas.push({ entidad: c.nombre, valor: m.pctRebate });
      if (Number.isFinite(m.margen)) {
        const _vara = benchmarkOf(m);
        if (Number.isFinite(_vara)) {
          const _brecha = Math.round((_vara - m.margen) * 10) / 10;
          rankings.cliente.brecha.filas.push({ entidad: c.nombre, valor: _brecha });
          if (_brecha > 0 && Number.isFinite(c.actual)) rankings.cliente.no_capturada.filas.push({ entidad: c.nombre, valor: Math.round(c.actual * _brecha / 100) });
        }
      }
    }
    L.push(linea + ".");
  }
  /* ── LOS RANKINGS DE COBRANZA (owner 2026-09-14, auditoría del Notario · familia «orden») ─────────────────────────────────
   * «Lider … la más urgente en cobranza (269 días vencidos, peor recuperación)» pasó verde con Easy en 270 días y Sodimac en 35 %
   * recuperado: la proyección no declaraba ningún orden de cobranza, así que el muro no tenía contra qué medir un superlativo de
   * mora. Salen de la MISMA mesa que la herramienta `cobranza` y la pestaña Flujo Comercial (`buildMesaFlujo`, una sola verdad,
   * cero recalculo), sobre TODAS sus filas —no las 8 que la boleta recorta—, porque un orden se afirma sobre el conjunto. Cada
   * ranking con su lado malo: más saldo vencido, más días y menos recuperado son el problema; el saldo pendiente no tiene lado
   * malo por sí solo (deber no es estar atrasado). Sin plazo declarado (planilla sin política) el vencido y los días son `null`
   * en la mesa y esas filas simplemente no entran: nunca un cero. «urgente / urgencia / mora / atraso» nombran los días vencidos
   * porque así los nombra la prosa del cierre («la más urgente en cobranza (269 días vencidos)»). El TEXTO no cambia un byte. */
  let _mesaCobro = null;
  try { _mesaCobro = buildMesaFlujo(scenario); } catch { _mesaCobro = null; }
  if (_mesaCobro && Array.isArray(_mesaCobro.filas) && _mesaCobro.filas.length) {
    const _uniCobro = `los ${_mesaCobro.filas.length} clientes de la cobranza · al corte (${_mesaCobro.fechaCorteFmt || "cierre del período"})`;
    /* `formulas`: cómo la prosa nombra ESTA mesa entera («la más urgente EN COBRANZA»). El muro las lee como universo declarado,
     * igual que «de la cartera»; nombrar la tabla es nombrar el conjunto. */
    const _formulasCobro = ["\\ben\\s+(?:la\\s+)?cobranza\\b", "\\bde\\s+(?:toda\\s+)?la\\s+cobranza\\b", "\\b(?:en|del?)\\s+(?:el\\s+)?flujo\\s+comercial\\b", "\\bde\\s+(?:toda\\s+)?la\\s+mesa\\s+de\\s+cobranza\\b"];
    const _RC = (peorEs, campo, terminos, lexico = null) => ({ ..._R(_uniCobro, "mayor", peorEs, campo, terminos, lexico), formulas: _formulasCobro });
    rankings.cliente.saldo_vencido   = _RC("mayor", "mesaFlujo.filas.vencidoK", ["saldos?\\s+vencidos?", "montos?\\s+vencidos?", "deudas?\\s+vencidas?", "vencid[oa]s?"], _LEX.saldo_vencido);
    rankings.cliente.recuperado      = _RC("menor", "mesaFlujo.filas.recuperadoPct", ["(?:porcentaje|tasa|%)\\s+de\\s+recuperaci[óo]n", "recuperaci[óo]n(?!\\s+de\\s+(?:margen|contribuci|venta))", "recuperad[oa]"], _LEX.recuperado);
    /* «mora / atraso / urgencia» a secas y «la más morosa / atrasada» (el orden en todas sus formas, 2026-09-14): la prosa nombra los días
     * vencidos con el sustantivo suelto y con el adjetivo; «antigüedad» también, cuando la oración habla de cobranza. */
    rankings.cliente.dias_vencido    = _RC("mayor", "mesaFlujo.filas.diasVencido", ["d[íi]as\\s+(?:de\\s+)?(?:atraso|retraso|mora|vencid[oa]s?)", "d[íi]as\\s+de\\s+vencimiento", "atrasos?", "retrasos?", "mora", "morosidad", "urgentes?", "urgencia", "antig[üu]edad"], _LEX.dias_vencido);
    rankings.cliente.saldo_pendiente = _RC(null, "mesaFlujo.filas.saldoK", ["saldo\\s+pendiente", "saldo\\s+por\\s+cobrar", "pendiente\\s+de\\s+cobro", "saldo(?!\\s+vencido)", "deuda(?!\\s+vencida)"]);
    for (const fc of _mesaCobro.filas) {
      if (Number.isFinite(fc.vencidoK)) rankings.cliente.saldo_vencido.filas.push({ entidad: fc.nombre, valor: fc.vencidoK });
      if (Number.isFinite(fc.recuperadoPct)) rankings.cliente.recuperado.filas.push({ entidad: fc.nombre, valor: fc.recuperadoPct });
      if (Number.isFinite(fc.diasVencido)) rankings.cliente.dias_vencido.filas.push({ entidad: fc.nombre, valor: fc.diasVencido });
      if (Number.isFinite(fc.saldoK)) rankings.cliente.saldo_pendiente.filas.push({ entidad: fc.nombre, valor: fc.saldoK });
      /* ── Y CADA CIFRA DE COBRANZA CON SU DUEÑO (owner 2026-09-14, atribución y significado) ──────────────────────────────
       * La herramienta `cobranza` recorta 8 filas; la mesa tiene 13. «Falabella, Tottus y Paris tienen 8 días de atraso» es
       * verdad y el muro no podía saberlo: solo Falabella viajaba con sus días. Se registran las cifras YA FORMATEADAS por la
       * mesa (una sola verdad, cero recálculo) con su dueño y el universo «cobranza» — SIN tocar el texto de la proyección
       * (F() registra; el valor devuelto no se interpola). El vencido y los días nulos (sin plazo) no entran: nunca un cero. */
      if (fc.ventaFmt) F(fc.ventaFmt, [fc.nombre], "cobranza", "ventas");
      if (fc.abonadoFmt) F(fc.abonadoFmt, [fc.nombre], "cobranza", "abonado");
      if (fc.saldoFmt) F(fc.saldoFmt, [fc.nombre], "cobranza", "pendiente");
      if (fc.vencidoFmt) F(fc.vencidoFmt, [fc.nombre], "cobranza", "vencido");
      if (fc.recuperadoFmt) F(fc.recuperadoFmt, [fc.nombre], "cobranza", "recuperado");
      if (fc.diasVencidoFmt && fc.diasVencidoFmt !== "—") F(fc.diasVencidoFmt, [fc.nombre], "cobranza", "diasvencido");
    }
  }
  counts.add(f.marcasMargen.length);
  L.push(`MARCAS (${f.marcasMargen.length}):`);
  for (const m of f.marcasMargen) {
    const D = [m.nombre];
    U(m.unidades, D, "unidades", "unidades_vendidas");
    if (Number.isFinite(m.venta)) rankings.marca.ventas.filas.push({ entidad: m.nombre, valor: m.venta });
    if (Number.isFinite(m.margen)) rankings.marca.margen.filas.push({ entidad: m.nombre, valor: m.margen });
    if (Number.isFinite(m.contribucion)) rankings.marca.contribucion.filas.push({ entidad: m.nombre, valor: m.contribucion });
    if (Number.isFinite(m.pctRebate)) rankings.marca.carga.filas.push({ entidad: m.nombre, valor: m.pctRebate });
    if (Number.isFinite(m.margen)) { const _vara = benchmarkOf(m); if (Number.isFinite(_vara)) rankings.marca.brecha.filas.push({ entidad: m.nombre, valor: Math.round((_vara - m.margen) * 10) / 10 }); }
    L.push(`- ${m.nombre} — ${_L.ventas} ${F(_moneyK(m.venta), D, undefined, "ventas")} · ${_L.margen} ${F(_pct1(m.margen), D, undefined, "margen")} · ${_L.contribucion} ${F(_moneyK(m.contribucion), D, undefined, "contribucion")} · ${_L.costo} ${F(_moneyK(m.costo), D, undefined, "costo")} · ${_L.carga} ${F(_pct1(m.pctRebate), D, undefined, "carga")} · ${m.unidades} unidades · familia ${m.sfamilia}.`);
  }
  counts.add(f.sfamiliasMargen.length);
  L.push(`FAMILIAS (${f.sfamiliasMargen.length}):`);
  for (const s of f.sfamiliasMargen) {
    const D = [s.nombre];
    U(s.unidades, D, "unidades", "unidades_vendidas");
    L.push(`- ${s.nombre} — ${_L.ventas} ${F(_moneyK(s.venta), D, undefined, "ventas")} · ${_L.margen} ${F(_pct1(s.margen), D, undefined, "margen")} · ${_L.contribucion} ${F(_moneyK(s.contribucion), D, undefined, "contribucion")} · ${_L.carga} ${F(_pct1(s.pctRebate), D, undefined, "carga")} · ${s.unidades} unidades.`);
  }
  counts.add(f.skusMargen.length);
  L.push(`SKU COMERCIALES (${f.skusMargen.length} · venta del año cerrado — NO confundir con la foto de inventario de abajo):`);
  for (const s of f.skusMargen) {
    const D = [s.nombre];
    U(s.unidades, D, "unidades", "unidades_vendidas");
    if (Number.isFinite(s.venta)) rankings.sku.ventas.filas.push({ entidad: s.nombre, valor: s.venta });
    if (Number.isFinite(s.contribucion)) rankings.sku.contribucion.filas.push({ entidad: s.nombre, valor: s.contribucion });
    L.push(`- ${s.nombre} — ${_L.ventas} ${F(_moneyK(s.venta), D, undefined, "ventas")} · ${_L.margen} ${F(_pct1(s.margen), D, undefined, "margen")} · ${_L.contribucion} ${F(_moneyK(s.contribucion), D, undefined, "contribucion")} · ${_L.costo} ${F(_moneyK(s.costo), D, undefined, "costo")} · ${_L.carga} ${F(_pct1(s.pctRebate), D, undefined, "carga")} · ${s.unidades} unidades · costo medio ${F(_money(s.costoMedio), D)} por unidad · precio de lista ${F(_money(s.precioLista), D)} por unidad · marca ${s.marca} · familia ${s.sfamilia}.`);
  }
  L.push("");

  // ── UNIVERSO INVENTARIO (foto de hoy · dólares crudos) ──
  counts.add(f.skuInventario.length);
  const bodegas = [...new Set(f.skuInventario.map((s) => s.bodega))];
  counts.add(bodegas.length);
  _uni = "inventario";   // …y desde acá, del universo INVENTARIO (foto de hoy)
  L.push(`UNIVERSO «${UNIVERSOS.inventario.etiqueta.toUpperCase()}» (foto de hoy · ${f.skuInventario.length} SKU en ${bodegas.length} bodegas: ${bodegas.join(", ")}):`);
  const _capitalBodega = new Map(), _frenadoBodega = new Map(), _inmovBodega = new Map();   // el eje bodega: sumas por bodega en el mismo recorrido
  for (const s of f.skuInventario) {
    const D = [s.sku, s.bodega];
    U(s.stockUnd, [s.sku], "unidades", "unidades_stock");   // las unidades en stock son del SKU (la bodega las contiene, no las posee)
    // el MISMO predicado del detector de capital (specRetrieval:577 · POLICY, una verdad): frenado = rotación
    // bajo el piso o días sobre el techo — la clasificación se DECLARA como objeto para que el notario la verifique.
    const _frenado = (typeof s.rotacion === "number" && s.rotacion < rotMin) || (typeof s.doh === "number" && s.doh > dohMax);
    if (_frenado) {
      estados.push({ entidad: s.sku, estado: "frenado", bodega: s.bodega });
    }
    /* los OTROS tres estados de la Mesa Capital (riesgo de quiebre · sobrestock · capital sano), por la misma función que los pinta; y la
     * alerta del dato («crítico»). Así «PHI-SHAVER9 está en riesgo de quiebre» o «MAK-COMP-AIR está marcado como crítico» se verifican. */
    { const e = diagnoseInventarioSku(s); const nombre = { riesgo_quiebre: "riesgo de quiebre", sobrestock: "sobrestock", capital_sano: "capital sano" }[e]; if (nombre) estados.push({ entidad: s.sku, estado: nombre, bodega: s.bodega }); }
    if (String(s.alerta || "").toLowerCase() === "crit") estados.push({ entidad: s.sku, estado: "crítico", bodega: s.bodega });
    if (Number.isFinite(s.stockUSD) && s.bodega) {
      _capitalBodega.set(s.bodega, (_capitalBodega.get(s.bodega) || 0) + s.stockUSD);
      if (_frenado) _frenadoBodega.set(s.bodega, (_frenadoBodega.get(s.bodega) || 0) + s.stockUSD);
      if (s.estado !== "Activo") _inmovBodega.set(s.bodega, (_inmovBodega.get(s.bodega) || 0) + s.stockUSD);
    }
    if (Number.isFinite(s.stockUSD) && _frenado) rankings.sku.capital_frenado.filas.push({ entidad: s.sku, valor: s.stockUSD });
    // el eje SKU alimenta sus cinco rankings declarados (owner 2026-08-16) — mismo recorrido, cero recálculo
    if (Number.isFinite(s.stockUSD)) rankings.sku.capital.filas.push({ entidad: s.sku, valor: s.stockUSD });
    if (Number.isFinite(s.stockUSD) && s.estado !== "Activo") rankings.sku.capital_inmovilizado.filas.push({ entidad: s.sku, valor: s.stockUSD });
    if (Number.isFinite(s.rotacion)) rankings.sku.rotacion.filas.push({ entidad: s.sku, valor: +(+s.rotacion).toFixed(1) });
    if (Number.isFinite(s.doh)) rankings.sku.dias_inventario.filas.push({ entidad: s.sku, valor: Math.round(s.doh) });
    if (Number.isFinite(s.diasSinVenta) && s.diasSinVenta > 0) rankings.sku.dias_sin_venta.filas.push({ entidad: s.sku, valor: Math.round(s.diasSinVenta) });
    if (Number.isFinite(s.margenPct)) rankings.sku.margen_inventario.filas.push({ entidad: s.sku, valor: +(+s.margenPct).toFixed(1) });
    dias[s.sku] = {
      inventario: typeof s.doh === "number" ? Math.round(s.doh) : null,
      sinVenta: typeof s.diasSinVenta === "number" && s.diasSinVenta > 0 ? Math.round(s.diasSinVenta) : null,
    };
    // `estado ${F(s.estado, D)}`: el estado crudo («90d», «120d») ES texto de la carpeta — si el narrador lo cita
    // fiel («estado 90d»), la cita tiene que estar registrada con su dueño (medido en la matriz: FP de P2). F()
    // devuelve el valor intacto: el TEXTO de la proyección no cambia un byte.
    L.push(`- ${s.sku} (bodega ${s.bodega}) — ${_L.capital} ${F(_money(s.stockUSD), D, undefined, "capital")} · ${s.stockUnd} unidades en stock · ${_L.rotacion} ${F(_ratio(s.rotacion), D, undefined, "rotacion")} · Días de inventario ${F(_dias(s.doh), D, undefined, "cobertura")} · ${s.diasSinVenta > 0 ? `${F(_dias(s.diasSinVenta), D, undefined, "sinventa")} sin venta` : "con venta al día"} · vendido en el mes ${s.vendidoMes} unidades · margen de inventario ${F(_pct1(s.margenPct), D, undefined, "margen")} · estado ${F(s.estado, D)} · marca ${s.marca} · familia ${s.sfamilia}.`);
  }
  for (const [b, v] of _capitalBodega) rankings.bodega.capital.filas.push({ entidad: b, valor: v });
  for (const [b, v] of _frenadoBodega) rankings.bodega.capital_frenado.filas.push({ entidad: b, valor: v });
  for (const [b, v] of _inmovBodega) rankings.bodega.capital_inmovilizado.filas.push({ entidad: b, valor: v });
  L.push("");

  // ── LOS DOS UNIVERSOS: LO QUE ESTE PACK DECLARA (owner 2026-09-14: la compatibilidad la declara el archivo) ──
  // Antes esto pegaba `DIVERGENCIAS` —la verdad del dato de fábrica— a toda carpeta. Ahora se pregunta al contrato,
  // que lee la declaración del pack activo (`reconcilian`): el demo sigue diciendo lo de siempre, byte a byte; un
  // pack de planilla dice que se comparan con sus dos marcos y que no se suman.
  const rcVI = reconcilian("venta_comercial", "inventario");
  const divVI = DIVERGENCIAS.find((d) => d.entre.includes("venta_comercial") && d.entre.includes("inventario"));
  if (rcVI.estado === "comparable") {
    const m = rcVI.marcos || {};
    L.push("LOS DOS UNIVERSOS, CADA UNO CON SU MARCO:");
    L.push(`La venta comercial es de ${m.venta_comercial || "el período cerrado"} y el inventario es ${m.inventario || "una foto a hoy"}. ${rcVI.razon}`);
    L.push("Se comparan por SKU nombrando los dos marcos en la misma respuesta; PROHIBIDO sumarlos o consolidarlos en un total, y los días de inventario se citan del dato, no se recalculan.");
  } else {
    L.push("LOS DOS UNIVERSOS QUE NO RECONCILIAN:");
    L.push(`La venta comercial y el inventario NO son el mismo negocio medido dos veces. ${rcVI.estado === "divergent" ? rcVI.razon : (divVI ? divVI.razon : "")}`);
    L.push("PROHIBIDO cruzarlos: nunca dividas, sumes ni relaciones una cifra de venta con una de inventario (cobertura, días, ratio o participación cruzada). Una cifra que haga «cerrar» esos dos universos es una alarma, no un hallazgo. Si el usuario pide ese cruce, decliná y explicá esta divergencia.");
  }
  for (const d of DIVERGENCIAS) {
    if (d === divVI) continue;
    const rc = reconcilian(d.entre[0], d.entre[1]);
    if (rc.estado === "comparable") L.push(`- ${UNIVERSOS[d.entre[0]].etiqueta} ↔ ${UNIVERSOS[d.entre[1]].etiqueta}: se comparan con sus marcos, no se suman — ${rc.razon}`);
    else L.push(`- Tampoco reconcilian ${UNIVERSOS[d.entre[0]].etiqueta} ↔ ${UNIVERSOS[d.entre[1]].etiqueta}: ${rc.estado === "divergent" ? rc.razon : d.razon}`);
  }
  L.push("");

  // ── LO QUE ESTE DATO NO TIENE (obligatoria · los huecos verificados — para declinar bien, no estirar) ──
  L.push("LO QUE ESTE DATO NO TIENE (verificado — quien prometa responder esto, inventa):");
  for (const h of _HUECOS) L.push(`- ${h}`);

  /* ── LOS CONJUNTOS OFICIALES (Notario semántico, fase 4 · owner 2026-09-16: una sola definición por métrica/eje) ──
   * «carga comercial alta» es el universo del DETECTOR (carga > nivel declarado y exceso en $ ≥ piso), calculado por la misma función que
   * lo publica en la boleta; las cuentas que solo exceden el nivel son OTRO conjunto y se llaman «sobre el nivel declarado de carga». */
  const conjuntos = {};
  try {
    const D = descomposicionDeBrecha(scenario);
    if (D && Array.isArray(D.filas)) {
      conjuntos["carga comercial alta"] = { eje: "cliente", entidades: D.filas.filter((x) => x.cargaMaterial).map((x) => x.entidad), fuente: `detector de carga alta: carga > nivel declarado (${D.nivelCarga}%) y exceso ≥ piso de materialidad` };
      conjuntos["sobre el nivel declarado de carga"] = { eje: "cliente", entidades: D.filas.filter((x) => typeof x.carga === "number" && x.carga > D.nivelCarga).map((x) => x.entidad), fuente: `carga > nivel declarado (${D.nivelCarga}%), sin piso de materialidad` };
    }
  } catch { /* sin contrato comercial en este pack: no hay conjunto que declarar */ }
  return { texto: L.join("\n"), figs, counts: [...counts], estados, rankings, dias, kpisLineas, kpisFigs, conjuntos };
}

/* LA VARA ES PARTE DE LA CLAVE (Notario semántico, fase 2): el criterio del usuario («mi margen mínimo es 25%») muta el benchmark en runtime y
 * con él los conjuntos de la proyección (quiénes están bajo el benchmark, la contribución no capturada). Un memo solo por tenant+escenario
 * servía la proyección de la vara ANTERIOR después de «olvida mi margen mínimo» (medido: el verificador daba «universo-incompleto»). */
function _cacheado(scenario) {
  const key = `${getTenantId()}::${scenario}::b${getBenchmarkOverride() != null ? getBenchmarkOverride() : POLICY.benchmark}`;
  if (!_memo.has(key)) _memo.set(key, _construir(scenario));
  return _memo.get(key);
}

/** proyectarDatoNegocio(scenario) → el TEXTO de la proyección (determinístico por tenant+escenario). */
export function proyectarDatoNegocio(scenario = ESCENARIO_INICIAL) {
  const base = _cacheado(String(scenario || ESCENARIO_INICIAL)).texto;
  /* EL SELLO DE LA CARGA SE SUMA FUERA DEL CACHÉ (owner 2026-08-25), y tiene que ser así: el caché está armado
   * por tenant+escenario, mientras que el sello cambia cuando el usuario activa o descarta un archivo. Dentro
   * del caché serviría la observación de un archivo que ya no está activo — peor que no avisar. Es un hecho de
   * ESTE dato, así que va en la carpeta y no en el prompt fijo: cambia cuando cambian las cifras que acompaña. */
  const bloque = enLaCarpeta(getSelloDeCarga());
  return bloque ? [base, bloque].join(String.fromCharCode(10)) : base;
}

/** cifrasDelDato(scenario) → { figs: [{canon, value, duenos}], counts: [n...] } — la QUINTA fuente de guardC:
 * cada cifra de la proyección con los tokens dueños que la validan por cercanía. MISMO recorrido que el texto. */
export function cifrasDelDato(scenario = ESCENARIO_INICIAL) {
  const c = _cacheado(String(scenario || ESCENARIO_INICIAL));
  return { figs: c.figs, counts: c.counts, estados: c.estados, rankings: c.rankings, dias: c.dias, kpis: c.kpisFigs, conjuntos: c.conjuntos || {} };   // `kpis`: los KPIs del negocio con su rótulo · `conjuntos`: los conjuntos oficiales (Notario semántico)
}

/** kpisDelNegocio(scenario) → las líneas de KPI de la proyección, VERBATIM (header + 3-4 líneas).
 * Tercera vista del MISMO recorrido que ya producen `texto` y `figs`: no recalcula, no reformatea, no rotula.
 * Cada cifra de estas líneas ya está registrada en `figs` con su dueño y aparece CON ese dueño en su propia
 * oración — por eso citarlas verbatim es, por construcción, lo único que este módulo puede ofrecerle a un
 * suplente sin que el muro tenga algo que cobrarle. */
export function kpisDelNegocio(scenario = ESCENARIO_INICIAL) {
  return _cacheado(String(scenario || ESCENARIO_INICIAL)).kpisLineas.slice();
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
export function suplenteDignoDelDato({ scenario = ESCENARIO_INICIAL, juzgar = null } = {}) {
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
