/* === config/contract/entityRegistry.js · CONTRATO DE DATOS · Paso 3 ===
 * LOS EJES/ENTIDADES que existen hoy. Cada uno declara: su fuente (→ sourceManifest), la key, cómo hace rollup a sus
 * padres, y si es SCENARIO-AWARE. Los consumidores (Sentrix, Cuadro, resolver del LLM) ITERAN esto — no hardcodean
 * "cliente/sku/marca". Por eso un eje nuevo aparece solo en las superficies que iteran.
 *
 * EXTENSIBILIDAD: un dominio nuevo suma un eje acá (ej. "periodo" para un P&L) → aparece disponible sin tocar el motor.
 *
 * `scenarioAware`: si el eje se mueve con el escenario. false = base-only (hoy: sku, marca) → el surfaceContract usa
 * esto para bloquear honesto fuera de bonanza (lo que el guard del hardening hizo a mano, ahora declarado).
 * `parents`: relación de agregación (SKU rollup a marca vía campo "marca", a familia vía "sfamilia"). */
export const ENTITIES = {
  cliente: {
    label: { sing: "cliente", plur: "clientes" },
    source: "clientesMargen",           // fuente primaria de sus métricas de margen
    ventasSource: "clientesVentas",      // fuente de sus ventas (dato distinto · dos "venta" por diseño del demo)
    keyField: "nombre",
    scenarioAware: true,
    parents: {},                         // el cliente es un eje de tope
  },
  sku: {
    label: { sing: "SKU", plur: "SKUs" },
    source: "skusMargen",
    inventorySource: "skuInventario",    // el mismo SKU tiene métricas de inventario en otra fuente
    keyField: "nombre",
    scenarioAware: false,                // ← el motor NO ajusta skusMargen · base-only (info declarada)
    parents: { marca: "marca", familia: "sfamilia" },   // rollup: campo del que sale cada padre
  },
  marca: {
    label: { sing: "marca", plur: "marcas" },
    source: "marcasMargen",
    keyField: "nombre",
    scenarioAware: false,                // agregación base (hoy)
    parents: {},
    groupsFrom: { sku: "marca" },        // se puede derivar agrupando SKUs por su campo "marca"
  },
  familia: {
    label: { sing: "familia", plur: "familias" },
    source: "sfamiliasMargen",
    keyField: "nombre",
    scenarioAware: true,                 // sfamiliasMargen se ajusta por escenario (derivada de clientes)
    parents: {},
    groupsFrom: { sku: "sfamilia" },
  },
  bodega: {
    label: { sing: "bodega", plur: "bodegas" },
    source: "skuInventario",
    keyField: "bodega",                  // eje de agrupación (group-by) sobre skuInventario
    isGroupBy: true,                     // no es una fila propia · se agrega por este campo
    scenarioAware: true,
    parents: {},
  },
  canal: {
    // EJE CANAL (mejora 6 · 2026-07-26): el dato SIEMPRE lo trajo (clientesVentas.canal · Retail/E-commerce) —
    // el contrato no lo declaraba y "ventas por canal" degradaba pudiendo responder. Mismo patrón que bodega:
    // group-by sobre la fuente de ventas. Las métricas de margen viven en clientesMargen (sin canal) y se
    // agregan vía el join declarado nombre↔canal (groupVia en el metricRegistry) — agregación exacta, jamás prorrateo.
    label: { sing: "canal", plur: "canales" },
    source: "clientesVentas",
    keyField: "canal",                   // eje de agrupación (group-by) sobre clientesVentas
    isGroupBy: true,
    scenarioAware: true,
    parents: {},
  },
};
