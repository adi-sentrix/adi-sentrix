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
export const ADI_INV_CAPITAL_ENABLED = false;           // 2.5c-1 · capital/stock en valor (campo stockUSD · key NUEVO `capital`, SIN pisar el "stock=unidades" comercial · polaridad higherIsWorse · anchor "detenido"/"inmovilizado" = vista amplia, todos los SKUs) RESPONDE vía el resolver · el inmovilizado Def2 fino es 2.5c-2 · bodega sigue AVISANDO
export const ADI_INV_INMOVILIZADO_ENABLED = false;      // 2.5c-2 · refina el anchor "inmovilizado/detenido/atrapado" del capital de la VISTA AMPLIA al subconjunto Def2 (alerta crit/warn O rotación<2 · def canónica _capitalInmovilizado) · "capital" a secas sigue dando la vista amplia · requiere ADI_INV_CAPITAL_ENABLED ON · el evidence refleja el subconjunto
export const ADI_INV_BODEGA_ENABLED = false;            // 2.5d (último · cierra Etapa 3) · bodega como DIMENSIÓN (group-by skuInventario · "capital por bodega"/"rotación por bodega" · agregación por unidad: $ suma, x/d promedio) + filtro ("capital de Antofagasta") · "qué bodega está complicada" = más capital inmovilizado (Def2) · con esto TODO inventario disponible: la atomicidad queda inerte (red dormida para futuros dominios), la regla madre se transforma (avisa cruces NO soportados por el dato)

// ── ADI Core · Fix sobre-ruteo margen/SKU (hallado en prueba en vivo del owner · pre-Etapa 4) · default OFF ──
// Raíz: "SKU/productos" se clasificaba como inventario (Capa 1) y el vocab de superlativo comercial solo conocía
// "peor/más bajo", no las palabras naturales del dueño "menor/menos/bajo/mayor/alto" (Capa 2). Un flag por capa.
export const ADI_RANKING_NL_DIRECTION_ENABLED = false;  // Capa 2 · extiende el vocab de dirección de detectRankingExtremesIntent con sinónimos naturales (worst += menor(es)/menos/bajo(s)/baja(s) · best += mayor(es)/alto(s)/alta(s)) → "los SKU con menor margen"/"mayor margen" RESPONDEN el ranking (igual que "peor"); la re-detección sobre-escribe la mala clasificación de módulo y esquiva el muro · inventario "menor rotación" lo reclama antes el spine (no se cruza)
export const ADI_CLASSIFY_SKU_COMMERCIAL_ENABLED = false; // Capa 1 (endurecimiento de raíz) · guard en resolveSemanticIntent: "sku/producto + métrica comercial (margen/contribución/ventas) y SIN señal de inventario" NO se clasifica como inventario → cae al flujo comercial · NO toca el inventario legítimo (con señal de inventario el guard no dispara) · protege también los cruces producto+comercial de la Etapa 4
// ── Ranking panorámico SIN métrica → Cuadro de mando · default OFF ──
export const ADI_RANKING_DEFAULT_METRIC_ENABLED = false; // "los N mejores/peores clientes/SKU" (N explícito o "top", SIN métrica nombrada) → detectRankingExtremesIntent no aborta: default métrica comercial (cliente→contribucion · SKU→sku_margen) → composeRankingExtremes arma la lista real con sentrixAction+evidence → el boleta abre el Cuadro (el monolito TAMBIÉN honest-fallbackea estas frases: no hay nada que extraer, esto es capacidad NUEVA) · scope estricto: "mejores clientes" PELADO (sin N/top) sigue en honest_fallback (gate [36] intacto) · OFF = detectRanking aborta igual que hoy (byte-exacto · el guard de número difería el dígito)
// ── Smart-fallback · "ADI se adueña de la conversación" (principio premium del owner) · default OFF ──
export const ADI_SMART_GUIDE_ENABLED = false;            // tanda 2 · cuando ADI cae al dead-end (muro de inventario / global_honest_fallback), en vez de un "no llego" seco (que filtraba "Fase 2.5"), detecta los términos del texto (cliente/margen/SKU/bodega/rotación) y GUÍA hacia lo disponible (composeSmartGuide) · NUNCA ofrece lo no-modelado ni inventa número (regla madre) · reemplaza el mensaje, conserva la ruta (qi_inventory_avisar / global_honest_fallback)
export const ADI_INV_NL_VOCAB_ENABLED = false;          // tanda 2b · reconocimiento NL de inventario en el spine: "parado/stock muerto/plata dormida"→capital inmovilizado, "no se mueve/vende/rota"→rotación baja, "bodega peor/mal"→complicada → RESPONDEN directo (en vez de que el smart-guide ofrezca) · bloque ADITIVO (solo dispara si el registro no detectó métrica) → cero impacto en lo existente
export const ADI_SIM_SCOPE_FOLLOWUP_ENABLED = false;   // sub-fix "todas" · el clarify de alcance de simulación ("¿En qué cuentas? Lider · el grupo erosionado · todas") persiste un pendiente (kind sim_scope · espeja 2.2b) y el turno N+1 lo resuelve determinístico: cliente nombrado → client_dive · "todas"/"el grupo erosionado"/"la cartera" → vista de cartera (client_contribution_ranking) · requiere ADI_MT_SPINE_FOLLOWUP_ENABLED (el escritor del pendiente)

// ── ADI Core · Etapa 5 · Sentrix · S1 · boleta de evidencia UNIVERSAL + availability-driven · default OFF ──
export const ADI_SENTRIX_BOLETA_ENABLED = false;       // S1 · _finalize surfacea una boleta UNIFORME (normalizada vía buildSentrixBoleta) en TODA respuesta comercial (hoy ranking_extremes/client_* devuelven evidence:null) · entidad/entityType/métrica + bloque availability (datasetCapability data-driven: history{global/perEntity/scenario}, crosses{atomic}) · OFF = _finalize sin campo evidence (byte-exacto) · es la columna vertebral que consume Sentrix
export const ADI_SENTRIX_READING_ENABLED = false;      // S2a · LECTURA EJECUTIVA · "capital inmovilizado por bodega" (el foco) → ADI dice el porqué (reframe concentrado+lento + drivers DOH/rotación/concentración + recomendación + SKU sensible · todo derivado del dato vía buildCapitalReading) en vez de la línea fina · el boleta carga reading{} → Sentrix lo demuestra campo por campo · OFF = one-liner del spine byte-exacto
export const ADI_SENTRIX_EXPLORE_ENABLED = false;     // Paso 3a · ESTADO DE ANÁLISIS · la boleta declara el bloque `explorable` (data-driven · §7): con qué pares comparar, qué métricas tiene la entidad, y qué vistas se BLOQUEAN honesto (cruce a entidad relacionada sin granularidad atómica · Ejemplo 5 Situación B) · base de la mesa interactiva (comparar/cambiar/desglosar · v2 LLM por voz) · OFF = boleta sin campo explorable (byte-exacto)
export const ADI_HONESTY_GUARD_ENABLED = false;      // GAP 1 · guard de HONESTIDAD ante lo imposible · corre ANTES del spine: cruce marca×cliente / cliente×SKU (sin granularidad atómica) + SKU inexistente → declara el límite y redirige a lo disponible (composeHonestyGuard→smartGuide) en vez de contestar otra pregunta o sustituir la entidad · lo que hace VERDADERO "ADI no inventa" · OFF = byte-exacto (el spine/ranking responden como antes)
export const ADI_SENTRIX_PARETO_ENABLED = false;     // Paso 4b · EL PARETO (concentración 80/20) · barras+acumulada+ref-80% · data-driven (muestra el % REAL del dato, NO fuerza 80) · scenario-aware (cliente/marca/familia · SKU base) · honesto sin bloqueos (sumas acumuladas de dato real) · SOLO panel (buildConcentration client-side · motor sellado) · OFF = el panel no muestra el Pareto
export const ADI_SENTRIX_SHELL_ENABLED = false;      // Estructura · brick 1 · SHELL de 3 tabs (Diagnóstico | Evidencia | Control) sobre UN estado compartido (el caso vigente) · organiza por FUNCIÓN, no por módulo de dato · Diagnóstico = el contenido actual (lectura+evolutivo+Pareto) · Evidencia/Control = placeholders (próximos bricks) · SOLO panel (motor sellado) · OFF = sin tabs, el panel renderiza como hoy (byte-exacto)
export const ADI_SENTRIX_TEMPORAL_ENABLED = false;   // Paso 4 · LA HISTORIA (evolutivo) · desbloquea el TemporalSlot como pieza CENTRAL de Sentrix v1 · honestidad aplicada al tiempo (regla del owner · temporalCapability): histórico GLOBAL de ventas REAL (ventasMensuales 12m + año anterior + presupuesto) → película rica (mín/máx, mayor caída/crecimiento, vs ppto/año ant., toggle de series) · por ENTIDAD sintético → bloqueo honesto (se enciende solo con histórico real del cliente) · SOLO panel (motor sellado · buildGlobalEvolution client-side) → GATE PRINCIPAL byte-exacto trivial · OFF = el panel no muestra el evolutivo
export const ADI_MULTI_ASK_ENABLED = false;         // PEDIDO MÚLTIPLE · "mostrame ventas, márgenes y capital inmovilizado" (lista de ≥2 métricas enumeradas, NO un cruce) → SECUENCIAL GUIADO: contesta la 1ª entera (reusa el motor · recursión) + encadena "¿sigo con X o Y?" + guarda la cola (ctx.pendingSequence) para el turno N+1 · el CRUCE ("ventas contra margen") sigue avisando honesto · se adueña sin inventar · OFF = byte-exacto (cae al smart-guide/avisar de antes)
export const ADI_SENTRIX_CUADRO_ENABLED = false;    // 4ª lente · CUADRO DE MANDO · la grilla operable (cockpit): TODAS las entidades de una dimensión (clientes/SKU/marcas/bodegas) × columnas del catálogo · ordenar/top-N/en-alerta/seleccionar-y-comparar · fila TOTALES + acción derivada + alerta honesta · scenario-aware · global vs fecha (serie por-entidad sintética → límite honesto) · SOLO panel (buildCuadroMando client-side · motor sellado) · OFF = sin la 4ª tab (byte-exacto)

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
