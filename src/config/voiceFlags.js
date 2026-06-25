/* === CONFIG · 95 toggles *_ENABLED ===
 * Extraído de 41cc33d8 · valores byte-idénticos · cero recálculo (Fase 2 del refactor).
 * La única diferencia con el monolito es DÓNDE vive el dato, nunca QUÉ vale. */

export const VOICE_REMOVE_TEXTUAL_SUGGESTIONS_ENABLED = true;

export const ADI_COLOQUIAL_LOSS_LEXICON_ENABLED = true;

export const VOICE_DEICTIC_PLURAL_ENABLED = true;

export const ADI_IDLEAK_RESOLVE_ORDINAL_ENABLED = true;

export const VOICE_AD_HOC_REASONER_ENABLED = true;

export const VOICE_AD_HOC_IMPLICIT_INHERITANCE_ENABLED = true;

export const VOICE_AD_HOC_REASONER_CLIENT_ENABLED = true;

export const VOICE_QI_POPULATES_CONTEXT_ENABLED = true;

export const VOICE_UNIFIED_ROUTING_ENABLED = true;

export const VOICE_GLOBAL_HONEST_FALLBACK_ENABLED = true;

export const VOICE_ACTIVE_RESULT_ENABLED = true;

export const ADI_ACTIVE_RESULT_CONTINUITY_ENABLED = true;

export const ADI_AUTOLINK_FILTER_ORIGIN_ENABLED = true;

export const ADI_BOTON_LIMPIAR_FILTROS_ENABLED = true;

export const ADI_RANKING_DEICTIC_RERANK_ENABLED = true;

export const ADI_BARE_MODULE_OVERVIEW_ENABLED = true;

export const ADI_PANORAMA_SYNONYMS_ENABLED = true;

export const ADI_DRILL_ELIPTICO_SKU_ENABLED = true;

export const ADI_CAPITAL_CIFRA_REAL_ENABLED = true;

export const ADI_CAPITAL_DEF_CANONICA_ENABLED = true;

export const ADI_MARGIN_BENCHMARK_GAP_FIX_ENABLED = true;

export const ADI_VENTAS_TOTAL_LEXICO_ENABLED = true;

export const ADI_PANORAMA_CAPITAL_ESCALA_FIX_ENABLED = true;

export const ADI_RECUPERABLE_DUAL_ENABLED = true;

export const ADI_PANORAMA_CAPITAL_KPI_FIX_ENABLED = true;

export const ADI_DELTA_PRELUDE_CAPITAL_ESCALA_ENABLED = true;

export const VOICE_R3_ACCOUNT_DEV_ENABLED = true;

export const VOICE_DEUDA_J_ENABLED = true;

export const VOICE_R4_SKU_DEV_ENABLED = true;

export const VOICE_C1_FOCUS_ENABLED = true;

export const VOICE_C2_SHELL_ENABLED = true;

export const VOICE_C3_LINK_ENABLED = true;

export const VOICE_C4_AMBIENT_ENABLED = true;

export const VOICE_C32_EVIDENCE_ENABLED = true;

export const VOICE_D1F_ENTITY_SANITIZE_ENABLED = true;

export const VOICE_D1_CAUSE_ENABLED = true;

export const VOICE_D2_CROSS_ENABLED = true;

export const VOICE_D2B_PREMIUM_SLOW_ENABLED = true;

export const VOICE_RANKING_EXTREMES_ENABLED = true;

export const ADI_SCOPE_SHIFT_ENABLED = true;

export const VOICE_SEMANTIC_INTENT_LAYER_ENABLED = true;

export const VOICE_GREETING_LAYER_ENABLED = true;

export const ADI_D0A_ANOMALY_ROUTER_ENABLED = true;

export const ADI_D0B_OPPORTUNITY_ROUTER_ENABLED = true;

export const ADI_D0C_EXPLORATION_ROUTER_ENABLED = true;

export const ADI_SESSION_RESET_CLEARS_CONTEXT_ENABLED = true;

export const ADI_RANKING_WITH_METRICS_ENABLED = true;

export const VOICE_NARRATIVE_LAYER_ENABLED = true;

export const VOICE_EXECUTIVE_INTELLIGENCE_ENABLED = true;

export const VOICE_D3A_COMPOUND_ENABLED = true;

export const VOICE_D3B_ORCHESTRATE_ENABLED = true;

export const VOICE_D3C_PRESENT_ENABLED = true;

export const VOICE_D3D_SUMMARY_ENABLED = true;

export const VOICE_D30BIS_MEASURES_ENABLED = true;

export const MATERIALITY_AXES_ENABLED = true;

export const HIERARCHY_ENABLED = true;

export const VOICE_EA1_RESOLVER_ENABLED = true;

export const ADI_ECL_VOICE_POLISH_ENABLED = true;

// ── Multi-turno (Fase 0+1) · threading de contexto + follow-ups · validados flag-por-flag contra 47 ──
export const ADI_CTX_THREADING_ENABLED = true;          // Fase 0 · raíz: hila lastClientMentioned/lastSkuList/lastClientList
export const ADI_FOLLOWUP_CLIENT_METRIC_ENABLED = true; // Fase 1a · dispatch client_metric_followup ("y su margen?")
export const ADI_ECL_CONT_FOLLOWUP_ENABLED = true;      // Fase profunda [5] · ECL-CONT R4 sku-dev ("profundizá en ese")

// ── ADI Core · Fase 1+2 · puente QI↔applyFiltros (las 24 con "por") · flag maestro · default OFF ──
export const ADI_QI_FILTER_ENABLED = false;             // ADI Core Fase 1+2 (+ Fix A/B/C muro · Cabo 1 suffix off · Cabo 2 capability-gate inventario) · default OFF · reversible · encender = poner true

export const MECHANISM_LINK_ENABLED = true;

export const VOICE_EXECUTIVE_REPORT_ENGINE_ENABLED = true;

export const VOICE_VALORIZATION_FORWARD_LOOKING_ENABLED = true;

export const VOICE_KPI_SELECTOR_ENABLED = true;

export const VOICE_EXECUTIVE_REPORT_COMPOSER_ENABLED = true;

export const VOICE_SEMANTIC_CONTEXT_ENABLED = true;

export const VOICE_ECONOMIC_TENSION_ENABLED = true;

export const VOICE_CAUSAL_GRAPH_ENABLED = true;

export const VOICE_CONFIDENCE_ENGINE_ENABLED = true;

export const VOICE_RECOMMENDATION_REGISTRY_ENABLED = true;

export const VOICE_BUSINESS_PATTERN_ENABLED = true;

export const VOICE_PRIORITIZATION_ENGINE_ENABLED = true;

export const VOICE_QUESTION_GENERATOR_ENABLED = true;

export const VOICE_NARRATIVE_V2_ENABLED = true;

export const VOICE_ENTITY_REGISTRY_ENABLED = true;

export const VOICE_MEMORY_STORE_ENABLED = true;

export const VOICE_SESSION_CONTINUITY_ENABLED = true;

export const VOICE_BUSINESS_SNAPSHOT_ENABLED = true;

export const VOICE_TEMPORAL_COMPARATOR_ENABLED = true;

export const VOICE_RECALL_NARRATIVE_ENABLED = true;

export const VOICE_AUTO_DELTA_INTEGRATOR_ENABLED = true;

export const VOICE_PERSISTENCE_BRIDGE_ENABLED = true;

export const VOICE_DEMO_DELTA_HARNESS_ENABLED = true;

export const VOICE_INDUSTRY_CATALOG_ENABLED = true;

export const VOICE_INDUSTRY_ASSIGNMENT_ENABLED = true;

export const VOICE_SECTORAL_THRESHOLDS_ENABLED = true;

export const VOICE_SECTORAL_BENCHMARK_ENABLED = true;

export const VOICE_CALIBRATION_RESOLVER_ENABLED = false;

export const VOICE_CALIBRATION_INTEGRATOR_ENABLED = true;

export const VOICE_AN_ENABLED = false;

export const W_ENABLED = true;

export const T_ENABLED = true;

export const ECL_ENABLED = true;

export const VOZ2_ENABLED = true;

export const ECL_CONT_ENABLED = true;

export const ARCO_ENABLED = true;

export const VOICE_AN_INTEGRATOR_ENABLED = false;
