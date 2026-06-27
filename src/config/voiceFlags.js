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

// ── ADI Core · Fase 2.1 · spine (Semantic Layer + Availability Map + Intent Resolver → Validation → Planner) · default OFF ──
export const ADI_CORE_SPINE_ENABLED = false;            // paraguas de TODA la Fase 2.1 · reversible · encender = poner true
export const ADI_SPINE_DIM_SUPERLATIVE_ENABLED = false; // 2.1a · superlativo por dimensión (marca/familia) SIN filtro · requiere el paraguas ON
export const ADI_SPINE_FILTER_ENABLED = false;          // 2.1b · filtro simple nombrado (marca/familia) SIN "por" · requiere el paraguas ON
export const ADI_SPINE_FILTER_CLARIFY_ENABLED = false;  // 2.1b-2 · filtro + superlativo SIN métrica → ACLARAR · requiere ADI_SPINE_FILTER_ENABLED ON
export const ADI_SPINE_EVIDENCE_ENABLED = false;        // 2.1d · cada respuesta del spine emite su evidence payload (campo hermano · texto byte-idéntico) · default OFF
export const ADI_SPINE_COMBINED_ENABLED = false;        // 2.1c · combinado marca+cliente → AVISAR consistente (conector ampliado para/con) · requiere ADI_SPINE_FILTER_ENABLED · flag-off = 2.1b exacto

// ── ADI Core · Fase 2.2a · red de seguridad multi-turno (anti-fuga ECL-CONT + anti-contaminación) · default OFF ──
export const ADI_MT_SAFETY_ENABLED = false;             // 2.2a · la continuación respeta el Availability Map (no fuga inventario) + age-check de listas plurales (no resucita contexto stale) · flag-off = piso multi-turno byte-exacto

// ── ADI Core · Fase 2.2a-2 · limpieza de foco (topic-change) + cobertura de inventario en conversación · default OFF ──
export const ADI_MT_INV_COVERAGE_ENABLED = false;       // 2.2a-2 parte B · cierre SEMÁNTICO del "stock" elíptico: composeModuleOverview de inventario AVISA (no surfacea) cuando el muro está activo · compone con ADI_QI_FILTER_ENABLED
export const ADI_MT_TOPIC_CLEAN_ENABLED = false;        // 2.2a-2 parte A · una pregunta de alcance global limpia el foco de cliente en el ORIGEN (antes de detectIntent) → cierra las 2 puertas (follow-up greedy + ECL-CONT MODO1) · preserva el follow-up anafórico

// ── ADI Core · Fase 2.2b · follow-ups del spine (resolver ACLARAR + elección tras AVISAR combinado) · default OFF ──
export const ADI_MT_SPINE_FOLLOWUP_ENABLED = false;     // 2.2b · el spine escribe pendingSpineDecision al ACLARAR/AVISAR; el turno N+1 lo lee al tope (freshness + descarte por topic-change) y resuelve la respuesta suelta · compone con los flags spine

// ── ADI Core · Fase 2.2c · refinamientos deícticos (refina la vista anterior) · default OFF ──
export const ADI_MT_REFINE_METRIC_ENABLED = false;      // 2.2c-1 · composeRetrieval guarda lastRetrievalContext {metric,dimension,filtro,domain}; "y por margen" (elíptico · solo métrica, SIN dimensión nueva) refina manteniendo filtro+dim · prioridad: pending del spine (2.2b) gana · compone con ADI_QI_FILTER_ENABLED
export const ADI_MT_REFINE_FILTER_ENABLED = false;      // 2.2c-2 · "solo Bosch"/"y Bosch" (elíptico · marca/familia, SIN dimensión/métrica nueva) re-filtra la vista del lastRetrievalContext manteniendo métrica+dim · el QI filter decide la aplicabilidad · reusa el mecanismo de 2.2c-1
export const ADI_MT_BRAND_INV_COVERAGE_ENABLED = false; // 2.2c-2 (cierre de fuga) · composeBrandDive omite la línea "Inventario físico $X" (L47) y AVISA el subFocus inventario cuando el Availability Map bloquea inventario · NO requiere QI_FILTER (el número de inventario es incorrecto en cualquier régimen hasta Fase 2.5) · flag-off = brand_dive del piso byte-exacto
export const ADI_MT_REFINE_CUT_ENABLED = false;         // 2.2c-3 (último de la Etapa 2) · "los tres peores"/"el top 3" (cuantificador elíptico N+dirección, SIN dimensión/métrica/marca nueva) acota la vista: rebana el lastRetrievalContext.ranking (top N / bottom N) → one-liner · anti-fuga: inventario → AVISA vía 2.2a (no escribe lastRetrieval) + domain-check · reusa el mecanismo de 2.2c-1

// ── ADI Core · Etapa 3 · Fase 2.5 · inventario disponible (modelado + validado + con evidence) · un flag POR MÉTRICA · default OFF ──
// El flag ES la disponibilidad: isAvailable("inventario", metric) consulta el flag de esa métrica. De a una, validada cada una;
// el muro se disuelve métrica por métrica. Camino MODELADO (spine + QI + evidence), NO los bundles operacionales.
export const ADI_INV_ROTACION_ENABLED = false;          // 2.5a · rotación (skuInventario · dim SKU · filtro marca/familia) RESPONDE con payload vía resolveInventoryRetrieval (spine, antes del muro) · gate principal: régimen muro ON + este OFF → AVISA byte-exacto · guard de atomicidad (mezcla con métrica no modelada → AVISA) · bundles gated
export const ADI_INV_DOH_ENABLED = false;               // 2.5b · DOH/cobertura (UNA métrica, dos nombres · campo doh · polaridad higherIsWorse: más días = peor) RESPONDE vía el resolver · reusa el andamio de 2.5a · capital/bodega siguen AVISANDO (disolución métrica por métrica)

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
