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
    label: "Ventas", unit: "money", scale: { cliente: "K", marca: "K", familia: "K", sku: "K" },
    polarity: "higherIsBetter", formula: null,   // dato primario
    axes: ["cliente", "marca", "familia", "sku"],
    scenarioAware: { cliente: true, marca: false, familia: true, sku: false },
    sourceByAxis: {
      cliente: { source: "clientesVentas", field: "actual" },
      marca:   { source: "marcasMargen",   field: "venta"  },
      familia: { source: "sfamiliasMargen", field: "venta" },
      sku:     { source: "skusMargen",     field: "venta"  },
    },
  },
  margen: {
    label: "Margen", unit: "pct", polarity: "higherIsBetter", formula: null,   // dato del ERP
    benchmark: { field: "benchmark", policyFallback: "benchmark" },            // por-fila · fallback POLICY (hardening item 1)
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
    label: "Contribución", unit: "money", scale: { cliente: "K", marca: "K", familia: "K", sku: "K" },   // sku "raw"→"K" (matriz 2026-07-09 · skusMargen en miles)
    polarity: "higherIsBetter",
    formula: "venta * margen / 100",                    // ← METADATA · el validador chequea que el campo almacenado cierre
    axes: ["cliente", "sku", "marca", "familia"],
    scenarioAware: { cliente: true, sku: false, marca: false, familia: true },
    sourceByAxis: {
      cliente: { source: "clientesMargen", field: "contribucion" },
      sku:     { source: "skusMargen",     field: "contribucion" },
      marca:   { source: "marcasMargen",   field: "contribucion" },
      familia: { source: "sfamiliasMargen", field: "contribucion" },
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
  rotacion: {
    label: "Rotación", unit: "ratio", polarity: "higherIsBetter", formula: null, domain: "inventario",
    axes: ["sku", "bodega"], scenarioAware: { sku: true, bodega: true },
    sourceByAxis: {
      sku:    { source: "skuInventario", field: "rotacion" },
      bodega: { source: "skuInventario", field: "rotacion", agg: "avg" },
    },
  },
  doh: {  // days on hand / cobertura
    label: "Cobertura (DOH)", unit: "days", polarity: "lowerIsBetter", formula: null, domain: "inventario",
    axes: ["sku", "bodega"], scenarioAware: { sku: true, bodega: true },
    sourceByAxis: {
      sku:    { source: "skuInventario", field: "doh" },
      bodega: { source: "skuInventario", field: "doh", agg: "avg" },
    },
  },
};
