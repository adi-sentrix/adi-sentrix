/* === config/rankingData.js ===
 * Datos de ancla extraídos de 41cc33d8 · byte-idénticos (Fase 4c). */

// `scale` (owner 2026-08-10): "K" = el valor guardado está en MILES de dólares · "raw" = dólares crudos. NO es
// decorativo: `_formatMetricValue` lo lee para no adivinar la magnitud. Una entrada nueva sin `scale` se formatea
// como "raw" (la lectura conservadora: nunca multiplica por mil una cifra que no lo pidió).
export const RANKING_EXTREMES_METRICS = {
  // ── client metrics (dataset: applyScenarioToClientesMargen) ──
  contribucion: { entityType: "client", source: "clientesMargen", field: "contribucion", domain: "margenes", unit: "$", scale: "K" },
  margen:       { entityType: "client", source: "clientesMargen", field: "margen",       domain: "margenes", unit: "%", scale: "raw" },
  ventas:       { entityType: "client", source: "clientesMargen", field: "venta",        domain: "ventas",   unit: "$", scale: "K" },
  carga:        { entityType: "client", source: "clientesMargen", field: "pctRebate",    domain: "margenes", unit: "%", scale: "raw" },
  // ── sku metrics ──
  // rotacion / stockUSD / doh · dataset skuInventario
  rotacion:     { entityType: "sku",    source: "skuInventario",  field: "rotacion",     domain: "inventario", unit: "x", scale: "raw" },
  // ESCALA DECLARADA, NO ADIVINADA (owner 2026-08-10). `unit:"$"` significa MILES en contribucion/ventas/
  // sku_contribucion (salen de clientesMargen/skusMargen, que sourceManifest declara money(K)) y DÓLARES CRUDOS en
  // stockUSD (sourceManifest: money(raw)). `_formatMetricValue` (composers/ranking.js) lo resolvía con la heurística
  // «≥1000 → M», así que el ranking servía $18.60M donde la cifra real es $18.6K — 1000x, con la boleta autorizando
  // raw 18.600.000 y el total del inventario saliendo $135,00M contra los $135,0K reales, es decir MÁS que la venta
  // anual del negocio. Esa cifra es exactamente la que haría PARECER que skusMargen y skuInventario reconcilian, y
  // los dos universos NO reconcilian por declaración: es una alarma, no un logro. La escala se declara acá y el
  // formateador la LEE — misma regla que specRetrieval.js:52 ya aplica del lado del contrato.
  stockUSD:     { entityType: "sku",    source: "skuInventario",  field: "stockUSD",     domain: "inventario", unit: "$", scale: "raw" },
  // CANDADO «COBERTURA» (owner: `doh` es la única verdad · en pantalla se llama «Días de inventario»). El dato trae
  // DOS campos declarados y distintos, `doh` y `cobertura`, que difieren hasta 28 días en un mismo SKU (SAM-TV55:
  // 58d vs 30d, 8 de 13 SKU difieren). Este registro apuntaba `cobertura` al campo CRUDO homónimo mientras
  // `qiRetrieval.js` (metricMap: `cobertura → field "doh"`) servía el canónico: un mismo término daba dos valores
  // según por dónde entrara la pregunta. La palabra «cobertura» se conserva como ALIAS DE ENTRADA — el usuario la
  // escribe y declinar sería peor — pero apunta al MISMO campo que todo el resto: `doh`. NO agregar acá una entrada
  // que lea el campo `cobertura`.
  cobertura:    { entityType: "sku",    source: "skuInventario",  field: "doh",          domain: "inventario", unit: "d", scale: "raw" },
  doh:          { entityType: "sku",    source: "skuInventario",  field: "doh",          domain: "inventario", unit: "d", scale: "raw" },
  // sku_margen / sku_contribucion · dataset skusMargen (decisión D3)
  sku_margen:       { entityType: "sku", source: "skusMargen", field: "margen",       domain: "margenes", unit: "%", scale: "raw" },
  sku_contribucion: { entityType: "sku", source: "skusMargen", field: "contribucion", domain: "margenes", unit: "$", scale: "K" },
};
