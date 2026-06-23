/* === config/intentsRegistry.js ===
 * Datos del router extraídos de 41cc33d8 · byte-idénticos (Fase 4b · aditivo). */

import { SUCURSALES } from "../data/catalogs.js";

export const INTENTS_REGISTRY = {

  // BRIEF #21-A · Intent para declinar preguntas fuera del dominio
  // comercial-operacional (EBITDA, OPEX, flujo de caja, utilidad neta).
  // PRIORIDAD ALTA: declarado primero. Si la pregunta tiene un concepto
  // financiero fuera de dominio, se bloquea antes que otros intents la
  // capturen incorrectamente.
  out_of_domain_query: {
    id: "out_of_domain_query",
    description: "Pregunta sobre conceptos financieros fuera del dominio actual",
    domains: [],
    mechanisms_relacionados: [],
    signature: {
      required: ["concept_financial_out_of_scope"],
    },
    confidence_threshold: 0.65,
    legacy_intent_type: "out_of_domain",
    resolve_params: (text, concepts) => {
      const c = concepts.find(x => x.type === "concept_financial_out_of_scope");
      return {
        detectedFinancialTerm: c ? (c.value || "concepto financiero") : "concepto financiero",
      };
    },
  },

  client_dive: {
    id: "client_dive",
    description: "Deep dive de un cliente específico",
    domains: ["ventas", "margenes"],
    mechanisms_relacionados: ["all"],
    signature: {
      required: ["client_entity"],
      forbidden: ["conditional_loss", "comparison_marker"],
    },
    confidence_threshold: 0.7,
    legacy_intent_type: "client",
    resolve_params: (text, concepts) => {
      const c = concepts.find(x => x.type === "client_entity");
      return { clientName: c ? c.value : null };
    },
  },

  client_compare: {
    id: "client_compare",
    description: "Comparar 2 clientes",
    domains: ["ventas", "margenes"],
    mechanisms_relacionados: ["commercial_erosion", "customer_dependency_risk"],
    signature: {
      required: ["client_entity", "comparison_marker"],
      requires_multiple: { concept: "client_entity", min: 2 },
    },
    confidence_threshold: 0.7,
    legacy_intent_type: "client_compare",
    resolve_params: (text, concepts) => {
      const cs = concepts.filter(x => x.type === "client_entity");
      return { clients: cs.map(c => c.value) };
    },
  },

  client_simulation_lose: {
    id: "client_simulation_lose",
    description: "Simulación contrafactual de pérdida de cliente",
    domains: ["ventas", "margenes"],
    mechanisms_relacionados: ["customer_dependency_risk"],
    signature: {
      required: ["client_entity", "conditional_loss"],
    },
    confidence_threshold: 0.7,
    legacy_intent_type: "simulation",
    resolve_params: (text, concepts) => {
      const c = concepts.find(x => x.type === "client_entity");
      return { clientName: c ? c.value : null };
    },
  },

  mechanism_explore_erosion: {
    id: "mechanism_explore_erosion",
    description: "Explorar mecanismo de erosión comercial",
    domains: ["ventas", "margenes"],
    mechanisms_relacionados: ["commercial_erosion"],
    signature: {
      required: ["mechanism_entity_erosion"],
      forbidden: ["client_entity"],
    },
    confidence_threshold: 0.65,
    legacy_intent_type: "cross_domain_query",
    legacy_archetype: "mechanism_commercial_erosion",
    resolve_params: () => ({}),
  },

  mechanism_explore_quality: {
    id: "mechanism_explore_quality",
    description: "Explorar mecanismo de deterioro de calidad de crecimiento",
    domains: ["ventas", "margenes"],
    mechanisms_relacionados: ["quality_growth_deterioration"],
    signature: {
      required: ["mechanism_entity_quality"],
      forbidden: ["client_entity"],
    },
    confidence_threshold: 0.65,
    legacy_intent_type: "cross_domain_query",
    legacy_archetype: "mechanism_quality_growth",
    resolve_params: () => ({}),
  },

  mechanism_explore_dependency: {
    id: "mechanism_explore_dependency",
    description: "Explorar mecanismo de dependencia/concentración",
    domains: ["ventas", "margenes"],
    mechanisms_relacionados: ["customer_dependency_risk"],
    signature: {
      required: ["domain_concentration"],
      forbidden: ["client_entity", "conditional_loss"],
    },
    confidence_threshold: 0.65,
    legacy_intent_type: "cross_domain_query",
    legacy_archetype: "mechanism_dependency_risk",
    resolve_params: () => ({}),
  },

  mechanism_scan: {
    id: "mechanism_scan",
    description: "Vista general de todos los mecanismos activos",
    domains: ["ventas", "margenes", "inventario"],
    mechanisms_relacionados: ["all"],
    signature: {
      required: ["mechanism_scan_query"],
    },
    confidence_threshold: 0.6,
    legacy_intent_type: "cross_domain_query",
    legacy_archetype: "mechanism_scan",
    resolve_params: () => ({}),
  },

  mechanism_ranking: {
    id: "mechanism_ranking",
    description: "Priorización entre mecanismos activos por costo/severidad",
    domains: ["ventas", "margenes", "inventario"],
    mechanisms_relacionados: ["all"],
    signature: {
      required: ["ranking_query"],
    },
    confidence_threshold: 0.65,
    legacy_intent_type: "cross_domain_query",
    legacy_archetype: "mechanism_ranking",
    resolve_params: () => ({}),
  },

  profitability_gap: {
    id: "profitability_gap",
    description: "Crecen ventas pero ganamos menos · cross-domain",
    domains: ["ventas", "margenes"],
    mechanisms_relacionados: ["commercial_erosion", "quality_growth_deterioration"],
    signature: {
      required: ["growth_positive", "profitability_negative"],
      boost: ["contrastive_pivot"],
    },
    confidence_threshold: 0.7,
    legacy_intent_type: "cross_domain_query",
    legacy_archetype: "calidad_crecimiento",
    resolve_params: () => ({}),
  },

  priority_recommendation: {
    id: "priority_recommendation",
    description: "Qué palanca priorizar / dónde intervenir primero",
    domains: ["ventas", "margenes", "inventario"],
    mechanisms_relacionados: ["all"],
    signature: {
      required: ["intervention_request"],
      forbidden: ["client_entity"],
    },
    confidence_threshold: 0.65,
    legacy_intent_type: "cross_domain_query",
    legacy_archetype: "priority_recommendation",
    resolve_params: () => ({}),
  },

  exposure_analysis: {
    id: "exposure_analysis",
    description: "Análisis de exposición / qué pasa si pierdo top",
    domains: ["ventas", "margenes"],
    mechanisms_relacionados: ["customer_dependency_risk"],
    signature: {
      required: ["conditional_loss", "domain_concentration"],
    },
    confidence_threshold: 0.7,
    legacy_intent_type: "cross_domain_query",
    legacy_archetype: "exposure_analysis",
    resolve_params: () => ({}),
  },

  fuga_distribuida: {
    id: "fuga_distribuida",
    description: "Dónde estamos perdiendo plata (cross-domain general)",
    domains: ["ventas", "margenes", "inventario"],
    mechanisms_relacionados: ["commercial_erosion", "trapped_capital"],
    signature: {
      required: ["loss_explicit"],
      // BRIEF #19 · si la pregunta menciona SKUs/familias/categorías
      // específicas, es operacional inventario, no cross-domain estratégica.
      forbidden: [
        "client_entity",
        "intervention_request",
        "growth_positive",
        "concept_sku_query",
      ],
    },
    confidence_threshold: 0.65,
    legacy_intent_type: "cross_domain_query",
    legacy_archetype: "fuga_distribuida",
    resolve_params: () => ({}),
  },

  // BRIEF #20 · Intent para preguntas operacionales nivel SKU.
  // Activado cuando hay concept_sku_query + concepto operacional de
  // inventario (rotation, overstock, days_on_hand, aging, stockout,
  // working_capital, o loss_explicit que captura capital atrapado/
  // amarrado/inmovilizado vía sus signals internos).
  // BRIEF #24 · Intent para análisis individual de SKU específico.
  // Se activa cuando el usuario menciona un SKU canónico por nombre
  // (LG-DRYER8KG, SAM-REF500L, etc) o usa deíctico ordinal/anafórico
  // con SKU en memoria conversacional.
  //
  // Este intent NO se resuelve por extractConcepts (no hay pattern
  // léxico para SKUs canónicos en CONCEPT_ONTOLOGY). En cambio, la
  // detección ocurre en detectIntent ANTES de resolveSemanticIntent:
  // si detectSkuInText o detectDeicticReference encuentran SKU,
  // retorna directo el intent type "sku_deep_dive" sin pasar por la
  // capa semántica. Esto evita complejidad en CONCEPT_ONTOLOGY y
  // mantiene el flujo simple.
  //
  // El intent existe en el registry como documentación + por si en
  // el futuro se quiere activar vía concept; el dispatch real ocurre
  // en handleUserSubmit cuando intent.type === "sku_deep_dive".
  sku_deep_dive: {
    id: "sku_deep_dive",
    description: "Análisis individual de un SKU específico (deep dive)",
    domains: ["inventario", "margenes"],
    mechanisms_relacionados: [],
    signature: {
      required: ["sku_specific_reference"],
    },
    confidence_threshold: 0.6,
    legacy_intent_type: "sku_deep_dive",
    resolve_params: () => ({}),
  },

  // BRIEF #20 · Intent para análisis operacional de SKUs.
  // Si la pregunta es solo "qué SKUs" sin operacional, cae en module_dive.
  sku_operational_query: {
    id: "sku_operational_query",
    description: "Análisis operacional nivel SKU específico (DOH, capital atrapado, días sin venta)",
    domains: ["inventario"],
    mechanisms_relacionados: ["trapped_capital"],
    signature: {
      required: ["concept_sku_query"],
      required_any_secondary: [
        // Conceptos operacionales top-level del dominio inventario.
        "concept_working_capital",
        "concept_rotation",
        "concept_overstock",
        "concept_days_on_hand",
        "concept_inventory_aging",
        "concept_stockout_risk",
        // loss_explicit captura "capital atrapado/amarrado/inmovilizado"
        // vía sus signals internos concept_capital_drain y
        // concept_cash_consumption (BRIEF #18).
        "loss_explicit",
      ],
      forbidden: ["client_entity", "conditional_loss", "comparison_marker"],
    },
    confidence_threshold: 0.65,
    legacy_intent_type: "sku_operational",
    resolve_params: () => ({}),
  },

  // BRIEF #21-B · Intent para ranking de productos por aporte económico.
  // Resuelve ambigüedad "dejan plata"/"aportan"/"rinden" como ranking
  // por Contribución + contexto Ventas + Margen %.
  // Si hay client_entity, esto es client_dive (no este intent).
  // Si hay solo concept_economic_value_query sin SKU, cae en module_dive.
  product_contribution_query: {
    id: "product_contribution_query",
    description: "Ranking de productos/SKUs por aporte económico (contribución)",
    domains: ["margenes", "inventario"],
    mechanisms_relacionados: ["quality_growth_deterioration"],
    signature: {
      required: ["concept_sku_query", "concept_economic_value_query"],
      forbidden: ["client_entity", "conditional_loss"],
    },
    confidence_threshold: 0.6,
    legacy_intent_type: "product_contribution",
    resolve_params: () => ({}),
  },

  // BRIEF #46 · client_contribution_ranking
  // Ranking de CLIENTES por contribución mensual (vs product_contribution_query
  // que rankea SKUs/productos). Captura "¿qué clientes dan más?", "¿quiénes
  // aportan más?", "¿qué cuentas rinden más?".
  //
  // Signature:
  //   required: concept_economic_value_query (activado por F9 verbStem +
  //     intensifier/economicObject en proximidad ≤ 2)
  //   forbidden: concept_sku_query (preserva product_contribution_query),
  //              client_entity (cliente específico → client_dive),
  //              conditional_loss (simulación → client_simulation_lose)
  //   boost: domain_margenes (margen es contexto natural)
  //
  // Activa composeClientContributionRanking sobre clientesMargen runtime.
  client_contribution_ranking: {
    id: "client_contribution_ranking",
    description: "Ranking de clientes por contribución mensual",
    domains: ["margenes"],
    mechanisms_relacionados: ["quality_growth_deterioration"],
    signature: {
      required: ["concept_economic_value_query"],
      forbidden: ["concept_sku_query", "client_entity", "conditional_loss"],
      boost: ["domain_margenes"],
    },
    confidence_threshold: 0.6,
    legacy_intent_type: "client_contribution_ranking",
    resolve_params: () => ({}),
  },

  // ════════════════════════════════════════════════════════════════════════
  // BRIEF #26-ter · Modo Oportunidad · 2 intents simétricos al modo problema
  //
  // product_dual_comparison · activado por concept_dual_comparison
  // growth_opportunity · activado por concept_growth_opportunity
  //
  // Ambos requieren su concept único · alta especificidad sin colisión con
  // intents existentes.
  // ════════════════════════════════════════════════════════════════════════
  product_dual_comparison: {
    id: "product_dual_comparison",
    description: "Comparación dual virtuoso vs lastre · caballo de carrera vs freno",
    domains: ["inventario", "margenes"],
    mechanisms_relacionados: [],
    signature: {
      required: ["concept_dual_comparison"],
      forbidden: [],
    },
    confidence_threshold: 0.6,
    legacy_intent_type: "product_dual_comparison",
    resolve_params: () => ({}),
  },

  growth_opportunity: {
    id: "growth_opportunity",
    description: "Oportunidad de inversión comercial · dónde poner foco/esfuerzo",
    domains: ["margenes", "ventas"],
    mechanisms_relacionados: [],
    signature: {
      required: ["concept_growth_opportunity"],
      forbidden: [],
    },
    confidence_threshold: 0.6,
    legacy_intent_type: "growth_opportunity",
    resolve_params: () => ({}),
  },

  // BRIEF #39 · rotation_dive
  // Análisis Ferrari dedicado de rotación de inventario.
  // Captura queries directos ("¿cómo está la rotación?") sin caer a
  // module_dive(inventario) genérico hardcoded de EXPLAIN_MESSAGES.
  //
  // Signature:
  //   required: concept_rotation (activado por noun_rotation legacy o
  //     por canonical __rotation_query__ de F7 Fase 3)
  //   forbidden: client_entity (preserva client_dive),
  //              concept_sku_query (preserva sku_operational_query /
  //              product_contribution_query para queries SKU-específicos)
  //   boost: domain_inventory (+0.10 cuando hay contexto inventario · rompe
  //     empate de score 1.0 con module_dive · ambos clampean a 1.0 pero
  //     rotation_dive viene PRIMERO en orden de declaración del registry)
  //
  // confidence_threshold 0.65 alineado con sku_operational_query.
  rotation_dive: {
    id: "rotation_dive",
    description: "Análisis dedicado de rotación de inventario (top virtuosos + lastres)",
    domains: ["inventario"],
    mechanisms_relacionados: ["trapped_capital"],
    signature: {
      required: ["concept_rotation"],
      forbidden: ["client_entity", "concept_sku_query"],
      boost: ["domain_inventory"],
    },
    confidence_threshold: 0.65,
    legacy_intent_type: "rotation_dive",
    resolve_params: () => ({}),
  },

  // BRIEF #39 · coverage_dive
  // Análisis Ferrari dedicado de DOH / cobertura.
  // Captura queries directos ("¿cuál es la cobertura?", "doh por bodega")
  // sin caer a module_dive(inventario) hardcoded.
  //
  // Signature análoga a rotation_dive (mismo patrón arquitectónico):
  //   required: concept_days_on_hand (activado por noun_doh legacy o
  //     por canonical __coverage_query__ de F8 Fase 3)
  //   forbidden: client_entity, concept_sku_query
  //   boost: domain_inventory
  coverage_dive: {
    id: "coverage_dive",
    description: "Análisis dedicado de cobertura DOH (sobrestock + riesgo de quiebre)",
    domains: ["inventario"],
    mechanisms_relacionados: ["trapped_capital"],
    signature: {
      required: ["concept_days_on_hand"],
      forbidden: ["client_entity", "concept_sku_query"],
      boost: ["domain_inventory"],
    },
    confidence_threshold: 0.65,
    legacy_intent_type: "coverage_dive",
    resolve_params: () => ({}),
  },

  // BRIEF #40 · warehouse_dive
  // Análisis Ferrari dedicado de bodega/sucursal de inventario.
  // Captura queries directos ("¿qué pasa en Santiago?", "cómo está la
  // bodega de Antofagasta", "¿qué pasa en las bodegas?") sin caer a
  // GENERIC_RESPONSES por ausencia de intent dedicado (gap V_VISUAL
  // Cascada N expuesto en #37-septimus).
  //
  // Signature:
  //   required: concept_warehouse (activado por noun_warehouse legacy
  //     o por canonical __warehouse_location__ de F11 Fase 3 cierre)
  //   forbidden: client_entity (preserva client_dive),
  //              concept_sku_query (preserva sku_operational_query),
  //              concept_financial_out_of_scope (preserva out_of_domain_query)
  //   boost: domain_inventory (+0.10 cuando hay contexto inventario)
  //
  // Orden ENTRE coverage_dive y module_dive · gana sobre module_dive
  // en empate de score 1.0 (orden de inserción rompe empate · `>` estricto
  // en resolveSemanticIntent).
  //
  // Caso edge "rotación en Santiago": rotation_dive gana porque ambos
  // intents alcanzan 1.0 pero rotation_dive declarado ANTES en registry.
  // warehouse_dive NO interfiere · arquitectura preserva especificidad.
  warehouse_dive: {
    id: "warehouse_dive",
    description: "Análisis dedicado de bodega/sucursal (específica o agregado 4 sucursales)",
    domains: ["inventario"],
    mechanisms_relacionados: ["trapped_capital"],
    signature: {
      required: ["concept_warehouse"],
      forbidden: ["client_entity", "concept_sku_query", "concept_financial_out_of_scope"],
      boost: ["domain_inventory"],
    },
    confidence_threshold: 0.65,
    legacy_intent_type: "warehouse_dive",
    resolve_params: (text, concepts) => {
      // Extraer sucursal específica del texto (con tolerancia a acentos)
      const lowerText = (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const sucursalMatch = SUCURSALES.find(s => {
        const lowerSuc = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return lowerText.includes(lowerSuc);
      });
      return { specificSucursal: sucursalMatch || null };
    },
  },

  module_dive: {
    id: "module_dive",
    description: "Tesis general del módulo Ventas/Márgenes/Inventario",
    domains: ["depends_on_module"],
    mechanisms_relacionados: ["depends_on_module"],
    signature: {
      // BRIEF #18 · ahora también activable por conceptos operacionales
      // del dominio inventario (sin mencionar "inventario" explícitamente).
      required_any: [
        "module_entity",
        "concept_fill_rate",
        "concept_stockout_risk",
        "concept_overstock",
        "concept_rotation",
        "concept_days_on_hand",
        "concept_inventory_aging",
        "concept_working_capital",
        // BRIEF #19 · concept_sku_query habilita ruteo a module_dive
        // (inventario) para preguntas operacionales sobre SKUs/familias/
        // categorías.
        "concept_sku_query",
      ],
      // BRIEF #17-bis · forbidden ampliado.
      // module_dive es el intent más permisivo. Si la pregunta tiene OTRO
      // concepto cognitivo activo (erosión, calidad, pérdida, intervención,
      // scan, ranking), ese OTRO concepto es el verdadero intent.
      //
      // BRIEF #19 · loss_explicit es forbidden CONDICIONAL: solo bloquea
      // si NO hay concept_sku_query. Cuando la pregunta menciona SKUs/
      // familias/categorías Y capital/pérdida, es operacional inventario
      // (no fuga_distribuida cross-domain).
      forbidden: [
        "client_entity",
        "conditional_loss",
        "profitability_negative",
        "growth_positive",
        "mechanism_entity_erosion",
        "mechanism_entity_quality",
        { type: "loss_explicit", unless: "concept_sku_query" },
        "intervention_request",
        "mechanism_scan_query",
        "ranking_query",
      ],
    },
    confidence_threshold: 0.6,
    legacy_intent_type: "module",
    resolve_params: (text, concepts) => {
      const mc = concepts.find(c => c.type === "module_entity");
      let modulo = "ventas";

      // BRIEF #18 · inferir módulo de conceptos operacionales si no hay
      // module_entity explícito. Esto cubre preguntas como "qué SKUs
      // tienen baja rotación" donde "inventario" no se nombra.
      // BRIEF #19 · concept_sku_query también infiere módulo inventario.
      const inventoryConcepts = [
        "concept_fill_rate", "concept_stockout_risk",
        "concept_overstock", "concept_rotation",
        "concept_days_on_hand", "concept_inventory_aging",
        "concept_working_capital",
        "concept_sku_query",
      ];
      const hasInventoryConcept = concepts.some(c =>
        inventoryConcepts.includes(c.type)
      );

      if (mc) {
        const sub = mc.subtype;
        if (sub === "module_margenes") modulo = "margenes";
        else if (sub === "module_inventario") modulo = "inventario";
        else if (sub === "module_ventas") modulo = "ventas";
      } else if (hasInventoryConcept) {
        modulo = "inventario";
      }

      return { modulo };
    },
  },
};
