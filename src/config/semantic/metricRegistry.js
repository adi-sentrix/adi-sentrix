/* === config/semantic/metricRegistry.js · ADI Core Fase 2.1a ===
 * Semantic Layer · registro CENTRAL de métricas. Ensamblado DESDE los configs vivos
 * (QI_METRIC_VOCAB · RANKING_EXTREMES_METRICS) + la fórmula DECLARADA por primera vez.
 * Cero recálculo: el cómputo sigue en engine/composers; esto solo declara el significado.
 * El test de consistencia (_spine_2_1a.mjs) asegura que NO hay drift contra los configs vivos. */
import { QI_METRIC_VOCAB } from "../../adi/composers/qiRetrieval.js";

// vocab ensamblado: los términos VIVOS de QI + sinónimos ejecutivos (resolverlos es trabajo del Semantic Layer)
const _vocab = (qiKey, extra = []) => [...new Set([...(QI_METRIC_VOCAB[qiKey] || []), ...extra])];

export const METRIC_REGISTRY = {
  // ── dominio comercial (disponible) ──
  contribucion: { label: "Contribución",     domain: "margenes", unit: "$", qiKey: "contribucion", formula: "venta − costo − rebates",            vocabulary: _vocab("contribucion", ["aporte", "aporta", "aportan", "aporten"]) },
  margen:       { label: "Margen",           domain: "margenes", unit: "%", qiKey: "margen",       formula: "(venta − costo − rebates) / venta",  vocabulary: _vocab("margen", ["rentabilidad"]) },
  ventas:       { label: "Ventas",           domain: "ventas",   unit: "$", qiKey: "ventas",       formula: "Σ venta",                            vocabulary: _vocab("ventas", ["vende", "venden"]) },
  carga:        { label: "Carga Comercial",  domain: "margenes", unit: "%", qiKey: "carga",        formula: "rebates / venta",                    vocabulary: _vocab("carga", ["rebate", "rebates"]) },
  // ── dominio inventario (bloqueado hasta Fase 2.5 · el spine AVISA vía Availability Map, NO computa) ──
  rotacion:     { label: "Rotación",         domain: "inventario", unit: "x", qiKey: null,         formula: "COGS / stock promedio",              vocabulary: ["rotacion", "rotación", "rota", "rotan"] },
  doh:          { label: "DOH",              domain: "inventario", unit: "d", qiKey: null,         formula: "stock / venta diaria",               vocabulary: ["doh", "cobertura", "dias de cobertura"] },
  stock:        { label: "Stock",            domain: "inventario", unit: "$", qiKey: null,         formula: "Σ stockUSD",                         vocabulary: ["stock", "capital inmovilizado", "capital detenido"] },
};
