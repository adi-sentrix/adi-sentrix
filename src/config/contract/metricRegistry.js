/* === config/contract/metricRegistry.js · CONTRATO DE DATOS · Paso 3 ===
 * LAS MÉTRICAS que existen hoy (mínimo). Cada una declara: unidad, ejes donde aplica, polaridad, y — clave —
 * `sourceByAxis`: de qué fuente + campo sale la métrica SEGÚN el eje (ej. ventas del cliente = clientesVentas.actual,
 * pero ventas del SKU = skusMargen.venta). `scenarioAware` puede ser por-eje (el margen es aware por cliente, base por SKU).
 *
 * FÓRMULA = METADATA (condición 4 del owner): `formula` documenta y el validador la usa para CHEQUEAR el valor
 * almacenado contra el computado. NO es un ejecutor — el cálculo real vive en el motor. Una sola verdad ejecutable.
 *
 * EXTENSIBILIDAD: un dominio nuevo suma sus métricas acá (ej. ebitda con formula "ingresos - cogs - opex") → el Cuadro
 * y el resolver del LLM las ven sin tocar el motor. */
export const METRICS = {
  ventas: {
    // scale sku: "raw"→"K" (matriz 2026-07-09): skusMargen.venta viene en MILES (SAM-TV55 13300 = $13.3M) — el
    // "raw" hacía que el retrieval del contrato imprimiera "$13K" donde el motor dice $13.3M (dos verdades).
    label: "Ventas", unit: "money", scale: { cliente: "K", marca: "K", familia: "K", sku: "K", canal: "K" },
    polarity: "higherIsBetter", formula: null,   // dato primario
    axes: ["cliente", "marca", "familia", "sku", "canal"],
    scenarioAware: { cliente: true, marca: false, familia: true, sku: false, canal: true },
    sourceByAxis: {
      cliente: { source: "clientesVentas", field: "actual" },
      marca:   { source: "marcasMargen",   field: "venta"  },
      familia: { source: "sfamiliasMargen", field: "venta" },
      sku:     { source: "skusMargen",     field: "venta"  },
      canal:   { source: "clientesVentas", field: "actual", agg: "sum" },   // eje canal (2026-07-26) · group-by Retail/E-commerce
    },
  },
  margen: {
    label: "Margen", unit: "pct", polarity: "higherIsBetter", formula: null,   // dato del ERP
    benchmark: { field: "benchmark", policyFallback: "benchmark" },            // por-fila · fallback POLICY (hardening item 1)
    /* ⚠️ BRECHA Y TENDENCIA SON DOS COSAS, Y HASTA HOY NO ESTABAN DECLARADAS (owner 2026-08-23).
     * Su definición, textual: «brecha de margen = benchmark de margen − margen actual. La variación contra mes
     * anterior debe quedar como TENDENCIA de margen, no como brecha.»
     *   · BRECHA   = cuánto falta para llegar al benchmark.  Positiva = por debajo.
     *   · TENDENCIA = cómo cambió contra el período anterior. Positiva = mejoró.
     * POR QUÉ HACÍA FALTA ESCRIBIRLO: el campo histórico `margenKPI.gapPuntos` guarda 1.8, que es la TENDENCIA
     * (25.6 − 23.8), no la brecha (30.1 − 25.6 = 4.5). El nombre dice una cosa y el valor es otra, y eso ya
     * produjo un defecto real —está documentado en overview.js como #D-MARGEN-GAP-BENCHMARK-MIENTE— donde la
     * pantalla presentaba la variación interanual como si fuera la distancia al benchmark. El código ya lo
     * resuelve caso por caso; lo que faltaba era LA DEFINICIÓN, y sin ella la ingesta no podía calcular el KPI.
     * ⚠️ El campo `gapPuntos` NO se toca acá: 18 referencias en 6 archivos, incluido el dato de los tenants.
     * Renombrarlo a `tendenciaPuntos` es un pase aparte, declarado como pendiente. */
    brechaFormula: "benchmark − margen_actual",
    tendenciaFormula: "margen_actual − margen_periodo_anterior",
    axes: ["cliente", "sku", "marca", "familia"],
    scenarioAware: { cliente: true, sku: false, marca: false, familia: true }, // ← sku/marca base-only → surfaceContract bloquea honesto
    sourceByAxis: {
      cliente: { source: "clientesMargen", field: "margen" },
      sku:     { source: "skusMargen",     field: "margen" },
      marca:   { source: "marcasMargen",   field: "margen" },
      familia: { source: "sfamiliasMargen", field: "margen" },
    },
  },
  contribucion: {
    label: "Contribución", unit: "money", scale: { cliente: "K", marca: "K", familia: "K", sku: "K", canal: "K" },   // sku "raw"→"K" (matriz 2026-07-09 · skusMargen en miles)
    polarity: "higherIsBetter",
    formula: "venta * margen / 100",                    // ← METADATA · el validador chequea que el campo almacenado cierre
    axes: ["cliente", "sku", "marca", "familia", "canal"],
    scenarioAware: { cliente: true, sku: false, marca: false, familia: true, canal: true },
    sourceByAxis: {
      cliente: { source: "clientesMargen", field: "contribucion" },
      sku:     { source: "skusMargen",     field: "contribucion" },
      marca:   { source: "marcasMargen",   field: "contribucion" },
      familia: { source: "sfamiliasMargen", field: "contribucion" },
      // eje canal (2026-07-26): clientesMargen NO trae canal — el grupo de cada fila sale del JOIN declarado
      // nombre↔canal contra clientesVentas (groupVia · agregación exacta por suma, jamás prorrateo).
      canal:   { source: "clientesMargen", field: "contribucion", agg: "sum", groupVia: { source: "clientesVentas", key: "nombre", field: "canal" } },
    },
  },
  costo: {  // costo de la venta (dato del ERP) · en tu enum del spec
    // EXPANSIÓN (auditoría de la matriz 2026-07-09): marcasMargen y sfamiliasMargen SÍ traen campo costo — el
    // contrato no lo declaraba y esas celdas degradaban pudiendo responder. + scale sku "raw"→"K" (miles).
    label: "Costo", unit: "money", scale: { cliente: "K", sku: "K", marca: "K", familia: "K" },
    polarity: "lowerIsBetter", formula: null,   // dato primario almacenado
    axes: ["cliente", "sku", "marca", "familia"],
    scenarioAware: { cliente: true, sku: false, marca: false, familia: true },
    sourceByAxis: {
      cliente: { source: "clientesMargen",  field: "costo" },
      sku:     { source: "skusMargen",      field: "costo" },
      marca:   { source: "marcasMargen",    field: "costo" },
      familia: { source: "sfamiliasMargen", field: "costo" },
    },
  },
  // ACCIONES COMERCIALES EN DINERO (owner 2026-08-09, decisión 6 · hallazgo E). `carga` estaba declarada SÓLO como
  // pct (pctRebate), así que el KPI más visible de la cara Comercial —"Acciones comerciales", el MONTO— no tenía
  // ninguna métrica del contrato detrás: ninguna tool del oráculo podía devolverlo y la card quedaba sin
  // equivalente. Son la misma realidad en dos unidades y por eso son DOS métricas, no una con dos caras: el
  // vocabulario del owner las separa a propósito — "carga comercial" es la MÉTRICA (%), "acciones comerciales" es
  // lo que se revisa y se negocia (el $). Declarada sólo en los ejes donde el sourceManifest declara el campo
  // `rebates`: cliente y SKU. Marca y familia lo traen en el dato pero el contrato no lo declara, y una métrica
  // sobre un campo no declarado sería justo la segunda verdad que este contrato existe para evitar.
  acciones: {
    label: "Acciones comerciales", unit: "money", scale: { cliente: "K", sku: "K" },
    polarity: "lowerIsBetter",
    formula: "venta * pctRebate / 100",   // ← METADATA · el validador chequea que el campo almacenado cierre
    target: "targetCarga",                // la meta se expresa en % de la venta (POLICY) · misma vara que `carga`
    axes: ["cliente", "sku"],
    scenarioAware: { cliente: true, sku: false },
    sourceByAxis: {
      cliente: { source: "clientesMargen", field: "rebates" },
      sku:     { source: "skusMargen",     field: "rebates" },
    },
  },
  carga: {  // carga comercial = pctRebate
    label: "Carga comercial", unit: "pct", polarity: "lowerIsBetter",
    target: "targetCarga", bestPractice: "bestPracticeCarga",   // → businessPolicy
    formula: null, axes: ["cliente", "sku", "marca", "familia"],   // familia EXPANDIDA (matriz 2026-07-09 · sfamiliasMargen.pctRebate existe)
    scenarioAware: { cliente: true, sku: false, marca: false, familia: true },
    sourceByAxis: {
      cliente: { source: "clientesMargen",  field: "pctRebate" },
      sku:     { source: "skusMargen",      field: "pctRebate" },
      marca:   { source: "marcasMargen",    field: "pctRebate" },
      familia: { source: "sfamiliasMargen", field: "pctRebate" },
    },
  },
  capital: {  // capital inmovilizado = stockUSD (inventario)
    label: "Capital", unit: "money", scale: { sku: "raw", bodega: "raw" },
    polarity: "lowerIsBetter", formula: null, domain: "inventario",
    axes: ["sku", "bodega"], scenarioAware: { sku: true, bodega: true },
    sourceByAxis: {
      sku:    { source: "skuInventario", field: "stockUSD" },
      bodega: { source: "skuInventario", field: "stockUSD", agg: "sum" },   // group-by bodega
    },
  },
  /* ⚠️ `formula` SIGUE EN null A PROPÓSITO, y `formulaSiFalta` es otra cosa (owner 2026-08-22).
   * `formula` significa acá «el valor ALMACENADO tiene que cerrar con esta cuenta», y el almacenado NO cierra:
   * medido sobre los 13 SKU del dato de referencia, `365 ÷ doh` reproduce la rotación declarada en 0 de 13.
   * Ponerla ahí sería declarar una verificación que el propio dato no pasa.
   * `formulaSiFalta` declara la otra regla, la que el owner fijó: si el origen NO informa la métrica, ADI la
   * calcula así. Informado manda, calculado rellena, y la procedencia se declara siempre.
   * La implementación vive en `sentrix/diasYRotacion.js`, en un solo lugar. */
  rotacion: {
    label: "Rotación", unit: "ratio", polarity: "higherIsBetter", formula: null, domain: "inventario",
    formulaSiFalta: "365 / dias_de_inventario",
    axes: ["sku", "bodega"], scenarioAware: { sku: true, bodega: true },
    sourceByAxis: {
      sku:    { source: "skuInventario", field: "rotacion" },
      bodega: { source: "skuInventario", field: "rotacion", agg: "avg" },
    },
  },
  doh: {  // days on hand / cobertura
    label: "Cobertura (DOH)", unit: "days", polarity: "lowerIsBetter", formula: null, domain: "inventario",
    /* Ver la nota de `rotacion`: el almacenado tampoco cierra (stock ÷ venta diaria acierta 2 de 13), así que
     * `formula` queda en null y la cuenta de relleno se declara aparte. */
    formulaSiFalta: "stockUnd / (unidades_del_periodo / dias_del_periodo)",
    axes: ["sku", "bodega"], scenarioAware: { sku: true, bodega: true },
    sourceByAxis: {
      sku:    { source: "skuInventario", field: "doh" },
      bodega: { source: "skuInventario", field: "doh", agg: "avg" },
    },
  },
};
