/* === config/semantic/domainRegistry.js · ADI Core Fase 2.1a ===
 * Semantic Layer · qué métricas EXPONE cada dominio. Formaliza lo que hoy es inferible
 * solo leyendo SEMANTIC_METRICS/RANKING_EXTREMES_METRICS. Consumido por el Availability Map. */
export const DOMAIN_REGISTRY = {
  ventas:     { label: "ventas",     exposes: ["ventas"] },
  margenes:   { label: "márgenes",   exposes: ["contribucion", "margen", "carga"] },
  inventario: { label: "inventario", exposes: ["rotacion", "doh", "stock", "cobertura"] },
};
