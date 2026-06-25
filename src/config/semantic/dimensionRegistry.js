/* === config/semantic/dimensionRegistry.js · ADI Core Fase 2.1a ===
 * Semantic Layer · registro CENTRAL de dimensiones. Unifica el vocab de cliente/marca/familia/sku
 * hoy disperso en 4 archivos, con PRECEDENCIA explícita.
 * `reachableByLegacy`: ranking_extremes (RANKING_EXTREMES_METRICS) solo alcanza cliente/sku.
 *   marca/familia = false → ES el guard de mismatch del spine: el camino viejo NO puede responder
 *   un superlativo por marca/familia, así que reclamarlos NO ensombrece nada. */
import { QI_DIMENSION_VOCAB } from "../../adi/composers/qiRetrieval.js";

export const DIMENSION_REGISTRY = {
  cliente:  { label: "cliente", labelPlural: "clientes", qiKey: "cliente", reachableByLegacy: true,  vocabulary: QI_DIMENSION_VOCAB.cliente },
  sku:      { label: "SKU",     labelPlural: "SKUs",     qiKey: "sku",     reachableByLegacy: true,  vocabulary: [...QI_DIMENSION_VOCAB.sku, ...QI_DIMENSION_VOCAB.producto] },
  familia:  { label: "familia", labelPlural: "familias", qiKey: "familia", reachableByLegacy: false, vocabulary: QI_DIMENSION_VOCAB.familia },
  marca:    { label: "marca",   labelPlural: "marcas",   qiKey: "marca",   reachableByLegacy: false, vocabulary: QI_DIMENSION_VOCAB.marca },
};
