/* === config/rankingData.js ===
 * Datos de ancla extraídos de 41cc33d8 · byte-idénticos (Fase 4c). */

export const RANKING_EXTREMES_METRICS = {
  // ── client metrics (dataset: applyScenarioToClientesMargen) ──
  contribucion: { entityType: "client", source: "clientesMargen", field: "contribucion", domain: "margenes", unit: "$" },
  margen:       { entityType: "client", source: "clientesMargen", field: "margen",       domain: "margenes", unit: "%" },
  ventas:       { entityType: "client", source: "clientesMargen", field: "venta",        domain: "ventas",   unit: "$" },
  carga:        { entityType: "client", source: "clientesMargen", field: "pctRebate",    domain: "margenes", unit: "%" },
  // ── sku metrics ──
  // rotacion / stockUSD / cobertura · dataset skuInventario
  rotacion:     { entityType: "sku",    source: "skuInventario",  field: "rotacion",     domain: "inventario", unit: "x" },
  stockUSD:     { entityType: "sku",    source: "skuInventario",  field: "stockUSD",     domain: "inventario", unit: "$" },
  cobertura:    { entityType: "sku",    source: "skuInventario",  field: "cobertura",    domain: "inventario", unit: "d" },
  doh:          { entityType: "sku",    source: "skuInventario",  field: "doh",          domain: "inventario", unit: "d" },
  // sku_margen / sku_contribucion · dataset skusMargen (decisión D3)
  sku_margen:       { entityType: "sku", source: "skusMargen", field: "margen",       domain: "margenes", unit: "%" },
  sku_contribucion: { entityType: "sku", source: "skusMargen", field: "contribucion", domain: "margenes", unit: "$" },
};
