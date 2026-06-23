/* === CONFIG · ontología que el router necesita (CONCEPT_ONTOLOGY + SEMANTIC_FAMILIES) ===
 * Extraído de 41cc33d8 · valores byte-idénticos · cero recálculo (Fase 2 del refactor).
 * La única diferencia con el monolito es DÓNDE vive el dato, nunca QUÉ vale. */

import { ADI_COLOQUIAL_LOSS_LEXICON_ENABLED } from "./voiceFlags.js";

export const CONCEPT_ONTOLOGY = {
  // ─── CONCEPTOS DE DIRECCIÓN ECONÓMICA ──────────────────
  growth_positive: {
    description: "Refiere a crecimiento, mejora o aumento de actividad",
    signals: [
      { type: "verb_root", patterns: ["crec", "crece", "vend", "vendemos", "factur", "subier", "suben"], weight: 0.7 },
      { type: "noun", patterns: ["ventas", "facturacion", "ingreso", "ingresos", "volumen", "facturacion arriba"], weight: 0.5 },
      { type: "directional_up", patterns: ["mas", "mayor", "mejor", "incremen", "aumenta", "subi", "arriba"], weight: 0.4 },
      { type: "positive_number", patterns: ["+8", "+10", "+5", "+15", "+20", "+25"], weight: 0.3 },
      // BRIEF #18 · vocabulario ejecutivo de ventas
      { type: "concept_sales_growth_ejecutivo", patterns: [
          "facturacion incremental", "crecimiento incremental",
          "ventas incrementales", "volumen incremental",
          "topline crece", "topline arriba", "topline crecio",
          "crecimiento sostenido", "crecimiento del trimestre",
          "expansion", "expansion comercial",
          "yoy", "year over year", "ano sobre ano",
        ], weight: 0.55 },
      { type: "concept_channel_growth", patterns: [
          "canal digital crece", "ecommerce crece", "online crece",
          "canal crece", "canales crecen", "canal e commerce",
        ], weight: 0.45 },
      // BRIEF #37-quintus · Fase 2 · F5 volume_growth canonical token
      { type: "volume_growth_canonical", patterns: ["__volume_growth__"], weight: 0.75 },
    ],
    activation_rule: {
      // Aflojado: con verbo+modificador O verbo solo si peso supera 0.6
      // BRIEF #37-quintus · Fase 2 · aditivo · backward compat preserved
      required_any: [
        "verb_root", "noun", "concept_sales_growth_ejecutivo", "concept_channel_growth",
        "volume_growth_canonical",
      ],
      minimum_signal_count: 1,
      minimum_combined_weight: 0.6,
    }
  },

  profitability_negative: {
    description: "Deterioro, pérdida o compresión de captura económica",
    signals: [
      { type: "concept_profitability", patterns: [
          // BRIEF #17/18 originales
          "margen", "margenes", "contribucion", "rentabilidad", "ganancia", "ganamos", "ganando", "plata", "utilidad", "bottom line",
          // BRIEF #21-A · Familia 8A · Contribución (canon)
          "aporte", "aportes",
          "aporte economico", "aporte económico",
          "valor generado",
          "plata generada",
          "qué deja", "que deja",
          "qué aporta", "que aporta",
          "lo que deja",
          "lo que aporta",
          // BRIEF #21-A · Familia 8B · Margen (canon)
          "margen comercial",
          "margen unitario",
          "margen %", "margen pct", "margen porcentual",
          "compresion margen", "compresion de margen",
          "presion margen", "presion de margen",
        ], weight: 0.6 },
      { type: "directional_loss", patterns: ["menos", "cae", "caen", "baja", "bajan", "abajo", "comprime", "comprimid", "comprimi", "no veo", "no se siente", "no cuadra", "perd", "perdemos", "perdiendo"], weight: 0.5 },
      { type: "metaphor_loss", patterns: ["agujero", "se va", "se pierde", "perdiendo", "se escapa", "se nos escapa", "escap"], weight: 0.5 },
      // BRIEF #18 · vocabulario ejecutivo de rentabilidad
      { type: "concept_contribution_pressure", patterns: [
          "contribucion presionada", "contribucion bajo presion",
          "contribucion comprimida", "presion sobre contribucion", "presion sobre la contribucion",
          "presion en contribucion", "presion en la contribucion",
          "no captura contribucion",
          "no capturamos contribucion", "no capturando", "capturando contribucion",
          "contribucion no capturada", "contribucion dejada",
          "gap de contribucion", "diferencia de contribucion",
          "sin captura", "sin captura de margen", "sin captura de contribucion",
          "bottom line no", "bottom line bajo", "bottom line cae",
        ], weight: 0.6 },
      { type: "concept_benchmark_gap", patterns: [
          "bajo benchmark", "por debajo del benchmark",
          "gap de benchmark", "diferencia con benchmark",
          "diferencia versus benchmark", "lejos del benchmark",
          "alejados del benchmark", "no llegamos al benchmark",
        ], weight: 0.55 },
      { type: "concept_unit_economics", patterns: [
          "margen unitario", "rentabilidad unitaria",
          "rentabilidad por unidad", "rentabilidad por cliente",
          "rentabilidad por cuenta", "captura por unidad",
        ], weight: 0.5 },
      // BRIEF #37 v2 · F3 margin_erosion canonical token
      // NOTA: profitability_negative tiene minimum_signal_count=2, así que
      // el canonical SOLO activa cuando matchea con otro signal (ej. "margen"
      // como concept_profitability). Esto preserva la defensa anti-FP.
      { type: "margin_erosion_canonical", patterns: ["__margin_erosion__"], weight: 0.80 },
      // BRIEF #37-quintus · Fase 2 · F4 volume_decline canonical token
      // NOTA: misma defensa anti-FP que F3 · minimum_signal_count=2 fuerza
      // co-matching con otro signal del concept (ej. "margen", "comprimid").
      { type: "volume_decline_canonical", patterns: ["__volume_decline__"], weight: 0.75 },
    ],
    activation_rule: {
      // BRIEF #18 · activación con concept_profitability requiere 2 signals
      // (para evitar que "márgenes" solo active el concepto y rompa module_dive).
      // Vocabulario ejecutivo (concept_contribution_pressure, etc.) puede
      // activar con 1 signal porque es semánticamente unívoco.
      // BRIEF #37 v2 · aditivo · backward compat preserved by construction
      // BRIEF #37-quintus · Fase 2 · aditivo · F4 volume_decline canonical
      required_any: [
        "concept_profitability", "concept_contribution_pressure",
        "concept_benchmark_gap", "concept_unit_economics",
        "margin_erosion_canonical",
        "volume_decline_canonical",
      ],
      minimum_signal_count: 2,
      minimum_combined_weight: 0.7,
    }
  },

  loss_explicit: {
    description: "Pérdida explícita o fuga de dinero/oportunidad",
    signals: [
      { type: "verb_loss", patterns: ["perd", "perdiendo", "pierdo", "pierde", "fuga", "fugando", "se va el", "se nos va"], weight: 0.7 },
      // FIX #D-LEXICO-COLOQUIAL · metáforas chilenas de dolor (flag-gated · solo léxico de ENTRADA).
      // Rutean al mismo fuga_distribuida que "dónde pierdo plata". El composer NO se toca · la salida
      // sigue ejecutiva (ADI entiende la jerga, NO la usa). Formas CON contexto ("me esta matando",
      // "me mata") para evitar substring espurio (bare "mata" podría chocar con "automatizado"/etc).
      // NO se incluye "come" (ruido con "comercial") ni genéricos ("problema"/"mal").
      ...((typeof ADI_COLOQUIAL_LOSS_LEXICON_ENABLED !== "undefined" && ADI_COLOQUIAL_LOSS_LEXICON_ENABLED) ? [{
        type: "metaphor_pain_colloquial",
        patterns: [
          "me esta matando", "me estan matando", "me mata", "me matan",
          "me esta jodiendo", "me estan jodiendo", "me jode", "me joden",
          "me esta cagando", "me estan cagando", "me caga",
          "la embarrada", "donde esta la embarrada",
          "me esta hundiendo", "me estan hundiendo", "me hunde",
        ],
        weight: 0.7,
      }] : []),
      { type: "noun_money", patterns: ["plata", "dinero", "capital", "contribucion"], weight: 0.4 },
      { type: "location_query", patterns: ["donde", "dónde"], weight: 0.3 },
      // BRIEF #18 · vocabulario ejecutivo de pérdida
      { type: "concept_capital_drain", patterns: [
          // BRIEF #18 originales (verbos y participios)
          "consume capital", "consumiendo capital",
          "drena capital", "absorbe capital", "amarra capital",
          // BRIEF #42 cleanup · removidos: "capital amarrado", "capital atrapado"
          // (Categoría A · cubiertos por F1 canonical __capital_inmovilizado__
          // + adjetivos sueltos "atrapado/amarrado" más abajo en este array)
          // BRIEF #6 (post-46-bis) cleanup · removido: "capital inmovilizado"
          // (F1 canonical __capital_inmovilizado__ lo cubre · capital+inmovilizad)
          "working capital presionado", "capital de trabajo presionado",
          // BRIEF #6 (post-46-bis) cleanup · removidos: "stock muerto", "plata parada"
          // (cubiertos por F1 canonical __capital_inmovilizado__ · stock+muert · plata+parad)
          // BRIEF #42 cleanup · removido: "inventario detenido"
          // (Categoría A · cubierto por F1 canonical + adjetivo "detenido")
          "inventario dormido",
          "stock dormido",
          // BRIEF #6 (post-46-bis) cleanup · removidos: "stock inmovilizado",
          // "stock parado", "stock detenido" (F1 canonical __capital_inmovilizado__ los cubre).
          // "inventario dormido" + "stock dormido" PRESERVADOS · "dormid" no está
          // en F1.states (deuda heredada · activación depende de patterns legacy).
          // BRIEF #21-A · variantes gerundias (fix feedback visual)
          "inmovilizando", "inmovilizando capital",
          "atrapando", "atrapando capital",
          "amarrando", "amarrando capital",
          "drenando", "drenando capital",
          "consumiendo",
          "deteniendo", "deteniendo inventario",
          // BRIEF #21-A · variantes coloquiales
          "plata dormida",
          // BRIEF #42 cleanup · removido: "plata muerta"
          // (Categoría A · cubierto por F1 canonical __capital_inmovilizado__
          // + adjetivo "muert" en F1.states)
          // BRIEF #6 (post-46-bis) cleanup · removidos: "dinero parado",
          // "dinero amarrado", "dinero atrapado" (F1 canonical los cubre).
          // "dinero dormido" PRESERVADO · estado "dormid" no en F1.states.
          "dinero dormido",
          // BRIEF #21-A FIX · variantes con verbo copulativo "está"
          "esta dormido", "está dormido",
          "esta muerto", "está muerto",
          "esta parado", "está parado",
          "esta detenido", "está detenido",
          "esta atrapado", "está atrapado",
          "esta amarrado", "está amarrado",
          "esta inmovilizado", "está inmovilizado",
          "estan dormidos", "están dormidos",
          "estan muertos", "están muertos",
          "estan parados", "están parados",
          "estan detenidos", "están detenidos",
          // BRIEF #23-bis · patterns telegráficos (sustantivo + adjetivo)
          "sku inmovilizados", "skus inmovilizados",
          "sku inmovilizado", "skus inmovilizado",
          "sku atrapados", "skus atrapados",
          "sku atrapado", "skus atrapado",
          "sku detenidos", "skus detenidos",
          "sku detenido", "skus detenido",
          "sku dormidos", "skus dormidos",
          "sku dormido", "skus dormido",
          "productos inmovilizados", "producto inmovilizado",
          "productos atrapados", "producto atrapado",
          "productos detenidos", "producto detenido",
          "productos dormidos", "producto dormido",
          "items inmovilizados", "items atrapados",
          "items detenidos", "items dormidos",
          // BRIEF #6 (post-46-bis) cleanup · removido: "stock atrapado"
          // (F1 canonical __capital_inmovilizado__ lo cubre · stock+atrapad).
          // BRIEF #23-bis · adjetivos solos (críticos para telegráficas)
          // Riesgo bajo: en dominio retail/comercial estas palabras
          // refieren casi siempre a stock/capital. Si emergen falsos
          // positivos en preguntas no-inventario, restringir con prefijo.
          "inmovilizado", "inmovilizados",
          "atrapado", "atrapados",
          "detenido", "detenidos",
          "dormido", "dormidos",
          // BRIEF #29-quinquies-FIX · cobertura léxica · grietas de género
          // gramatical y verbos ejecutivos de acción ("liberar X").
          // Pre-validado: cero colisión con otros concepts (incluido
          // concept_financial_out_of_scope que cubre "flujo de caja").
          // BRIEF #6 (post-46-bis) cleanup · Grupo A removido completo:
          // "plata atrapada(s)", "plata amarrada(s)", "plata estancada", "plata varada"
          // (F1 canonical __capital_inmovilizado__ + bidireccional cubren todos).
          // Grupo B · "capital" + adjetivos adicionales
          // BRIEF #42 cleanup · removidos "capital atrapado", "capital amarrado"
          // (Categoría A · F1 canonical los cubre · adjetivos sueltos quedan)
          // BRIEF #6 (post-46-bis) cleanup · removidos "capital estancado",
          // "capital varado", "capital detenido" (F1 canonical los cubre).
          // Grupo C · verbos ejecutivos de acción
          // BRIEF #42 cleanup · removidos "liberar capital", "liberar plata"
          // (Categoría A · F2 canonical __action_liberate__ + noun_money cubre)
          // BRIEF #6 (post-46-bis) cleanup · removidos "liberar caja",
          // "liberar inventario", "necesito liberar", "tengo que liberar",
          // "quiero liberar" (F2 canonical __action_liberate__ los cubre).
          // Grupo D · "inventario" + adjetivos asociados
          // BRIEF #42 cleanup · removido "inventario detenido" (duplicado)
          // BRIEF #6 (post-46-bis) cleanup · removidos "inventario atrapado",
          // "inventario estancado" (F1 canonical __capital_inmovilizado__ los cubre).
        ], weight: 0.65 },
      { type: "concept_cash_consumption", patterns: [
          "consumo de caja", "consumir caja", "consume caja",
          "tension de caja", "tension financiera",
          "presion de caja", "caja presionada",
        ], weight: 0.7 },
      // BRIEF #37 v2 · canonical tokens emitidos por SemanticNormalizer_v1
      // F1 capital_inmovilizado · combinatorial 6 NOUNS × 8 STATES
      { type: "capital_inmovilizado_canonical", patterns: ["__capital_inmovilizado__"], weight: 0.85 },
      // F2 action_liberate · stem_only · verbos ejecutivos de liberación
      // OVERRIDE goal post-mapa (PIEZA 6 setConversationContext)
      { type: "action_liberate_canonical", patterns: ["__action_liberate__"], weight: 0.60 },
    ],
    activation_rule: {
      // BRIEF #37 v2 · aditivo · backward compat preserved by construction
      // (agregar types al required_any es estrictamente más permisivo).
      required_any: [
        "verb_loss", "concept_capital_drain", "concept_cash_consumption",
        "capital_inmovilizado_canonical", "action_liberate_canonical",
        // FIX #D-LEXICO-COLOQUIAL · el signal de dolor coloquial activa loss_explicit (aditivo ·
        // estrictamente más permisivo · solo existe cuando el flag agrega el signal arriba).
        "metaphor_pain_colloquial",
      ],
      minimum_combined_weight: 0.6,
    }
  },

  // ─── CONCEPTOS DE ESTRUCTURA SINTÁCTICA ────────────────
  contrastive_pivot: {
    description: "Estructura adversativa que conecta 2 ideas opuestas",
    signals: [
      { type: "explicit_marker", patterns: ["pero", "sin embargo", "aun asi", "y aun", "y todavia", "mas no", "aunque"], weight: 0.9 },
    ],
    activation_rule: {
      required_any: ["explicit_marker"],
      minimum_combined_weight: 0.8,
    }
  },

  conditional_loss: {
    description: "Condicional hipotético de pérdida (simulación contrafactual)",
    signals: [
      { type: "conditional_marker", patterns: ["si pierdo", "si me voy", "si se va", "que pasa si", "si maniana", "si mañana", "sin falabella", "sin lider", "sin jumbo"], weight: 0.8 },
      { type: "absence_marker", patterns: ["sin tener", "sin la cuenta"], weight: 0.6 },
    ],
    activation_rule: {
      required_any: ["conditional_marker", "absence_marker"],
      minimum_combined_weight: 0.7,
    }
  },

  comparison_marker: {
    description: "Comparación entre 2 o más entidades",
    signals: [
      { type: "explicit_compare", patterns: ["comparar", "compara", "versus", " vs ", "frente a", "diferencia entre"], weight: 0.8 },
    ],
    activation_rule: {
      required_any: ["explicit_compare"],
      minimum_combined_weight: 0.7,
    }
  },

  intervention_request: {
    description: "Solicitud de priorización o intervención ejecutiva",
    signals: [
      { type: "verb_intervention", patterns: ["intervenir", "intervenis", "intervens", "arreglar", "atacar"], weight: 0.7 },
      { type: "verb_priority", patterns: ["priorizar", "prioriza", "priorizo", "empezar", "empiezo"], weight: 0.7 },
      { type: "temporal_first", patterns: ["primero", "primer", "antes que nada", "para arrancar"], weight: 0.5 },
      { type: "uniqueness", patterns: ["una sola", "un solo", "una parte", "una palanca", "una cosa", "si pudiera hacer una", "hacer una sola"], weight: 0.7 },
      { type: "impact_query", patterns: ["mayor impacto", "mas impacto", "donde duele", "mas urgente", "por donde empiezo"], weight: 0.7 },
    ],
    activation_rule: {
      required_any: ["verb_intervention", "verb_priority", "temporal_first", "uniqueness", "impact_query"],
      minimum_combined_weight: 0.6,
    }
  },

  // ─── CONCEPTOS DE DOMINIO ──────────────────────────────
  domain_inventory: {
    description: "Inventario, stock o capital inmovilizado",
    signals: [
      // BRIEF #42 cleanup · removido "capital atrapado" del noun_inventory
      // (Categoría A · F1 canonical __capital_inmovilizado__ ya activa este concept)
      { type: "noun_inventory", patterns: ["inventario", "stock", "capital inmovilizado", "skus", "sku", "rotacion", "doh", "cobertura"], weight: 0.7 },
      { type: "noun_category", patterns: ["categoria", "categorias", "bodega"], weight: 0.4 },
      // BRIEF #37 v2 · F1 capital_inmovilizado canonical token
      { type: "capital_inmovilizado_canonical", patterns: ["__capital_inmovilizado__"], weight: 0.85 },
    ],
    activation_rule: {
      // BRIEF #37 v2 · aditivo · backward compat preserved by construction
      required_any: ["noun_inventory", "capital_inmovilizado_canonical"],
      minimum_combined_weight: 0.6,
    }
  },

  // ═════════════════════════════════════════════════════
  // BRIEF #18 · CONCEPTOS DE DOMINIO INVENTARIO/OPERACIONES
  // Vocabulario ejecutivo del controller operacional sobre
  // inventario. Sub-tipos específicos dentro del dominio.
  // ═════════════════════════════════════════════════════

  concept_fill_rate: {
    description: "Referencia a fill rate, nivel de servicio, disponibilidad",
    signals: [
      { type: "noun_fillrate", patterns: [
          "fill rate", "fillrate", "nivel de servicio",
          "service level", "disponibilidad",
          "tasa de cumplimiento", "tasa de fill",
          "ots", "on time shipment",
        ], weight: 0.8 },
    ],
    activation_rule: {
      required_any: ["noun_fillrate"],
      minimum_combined_weight: 0.7,
    }
  },

  concept_stockout_risk: {
    description: "Referencia a riesgo de quiebre, faltante, ruptura de stock",
    signals: [
      { type: "noun_stockout", patterns: [
          "quiebre", "quiebres", "stockout", "ruptura de stock",
          "ruptura", "faltante", "faltantes",
          "riesgo de quiebre", "riesgo de stockout",
          "sin stock", "fuera de stock",
        ], weight: 0.8 },
    ],
    activation_rule: {
      required_any: ["noun_stockout"],
      minimum_combined_weight: 0.7,
    }
  },

  concept_overstock: {
    description: "Referencia a sobre-stock, exceso de inventario",
    signals: [
      { type: "noun_overstock", patterns: [
          "sobre stock", "sobrestock", "sobre-stock",
          "exceso de inventario", "exceso de stock",
          "stock excedente", "inventario excedente",
          "obsoletos", "inventario obsoleto",
        ], weight: 0.8 },
    ],
    activation_rule: {
      required_any: ["noun_overstock"],
      minimum_combined_weight: 0.7,
    }
  },

  concept_rotation: {
    description: "Referencia a rotación de inventario",
    signals: [
      { type: "noun_rotation", patterns: [
          // BRIEF #18 originales · BRIEF #6 (post-46-bis) cleanup · removidos:
          // "rotacion", "rotacion de inventario", "rotacion baja", "baja rotacion",
          // "lenta rotacion", "rotacion lenta", "turnover", "vueltas de inventario"
          // (cubiertos por F7 canonical __rotation_query__ via nounStandalone).
          "rota poco", "no rota",
          "turn",
          // BRIEF #21-A · Familia 4 · canon del founder
          "gira", "girando", "gira rapido", "gira lento",
          "sale", "salida", "saliendo",
          "se mueve", "moviendo", "movimiento",
          "fluye", "fluyendo", "flujo",
          "rota rapido", "rota lento",
          "no esta rotando", "no rota bien",
          // BRIEF #21-A · gerundios (fix feedback visual)
          "rotando", "no rotando",
        ], weight: 0.75 },
      // BRIEF #37-sextus · Fase 3 · F7 rotation_query canonical token
      { type: "rotation_query_canonical", patterns: ["__rotation_query__"], weight: 0.75 },
    ],
    activation_rule: {
      // BRIEF #37-sextus · Fase 3 inicio · aditivo · backward compat preserved
      required_any: ["noun_rotation", "rotation_query_canonical"],
      minimum_combined_weight: 0.6,
    }
  },

  concept_days_on_hand: {
    description: "Referencia a DOH, días de cobertura, cobertura de inventario",
    signals: [
      { type: "noun_doh", patterns: [
          // BRIEF #18 originales · BRIEF #6 (post-46-bis) cleanup · removidos:
          // "doh", "dias de cobertura", "dias en stock", "cobertura optima",
          // "cobertura de inventario", "rango de cobertura", "dias de inventario",
          // "cobertura", "dias stock"/"días stock", "dias inventario"/"días inventario",
          // "para cuanto alcanza"/"para cuánto alcanza", "duracion del stock"/"duración del stock",
          // "dias que dura", "cuanto stock tengo"/"cuánto stock tengo"
          // (cubiertos por F8 canonical __coverage_query__ vía disjunctive_set).
          // Preservados (no en F8 terms): "para cuanto me alcanza" + tilde.
          "para cuanto me alcanza", "para cuánto me alcanza",
        ], weight: 0.75 },
      // BRIEF #37-sextus · Fase 3 · F8 coverage_query canonical token
      { type: "coverage_query_canonical", patterns: ["__coverage_query__"], weight: 0.75 },
    ],
    activation_rule: {
      // BRIEF #37-sextus · Fase 3 inicio · aditivo · backward compat preserved
      required_any: ["noun_doh", "coverage_query_canonical"],
      minimum_combined_weight: 0.6,
    }
  },

  // BRIEF #21-A · Familia 6 · Ubicación física (canon: Centro distribución)
  concept_warehouse: {
    description: "Referencia a bodega, almacén, depósito, centro distribución",
    signals: [
      { type: "noun_warehouse", patterns: [
          // BRIEF #6 (post-46-bis) cleanup · removidos 18 patterns cubiertos por
          // F11 canonical __warehouse_location__ vía disjunctive_set:
          // bodega(s), almacen/almacén/almacenes, cd, centro de distribucion/distribución,
          // sucursal(es), punto/s de venta, santiago, valparaiso/valparaíso,
          // concepcion/concepción, antofagasta.
          // Preservados (no en F11 terms · deuda del dataset F11):
          // deposito/depósito/depositos, centro distribucion (sin "de"),
          // centros de distribucion (plural), local/locales (F11 excluye por FP).
          "deposito", "depósito", "depositos",
          "centro distribucion", "centro distribución",
          "centros de distribucion", "centros de distribución",
          "local", "locales",
        ], weight: 0.7 },
      // BRIEF #37-septimus · Fase 3 cierre · F11 warehouse_location canonical
      { type: "warehouse_location_canonical", patterns: ["__warehouse_location__"], weight: 0.75 },
    ],
    activation_rule: {
      // BRIEF #37-septimus · Fase 3 cierre · aditivo · backward compat preserved
      required_any: ["noun_warehouse", "warehouse_location_canonical"],
      minimum_combined_weight: 0.6,
    }
  },

  // BRIEF #37-septimus · Fase 3 cierre · NUEVO concept
  // concept_tier_segment captura referencias al segmento tier (1/2/3)
  // como entidad cognitiva. El claim "tier 1" hoy vive hardcoded en
  // CROSS_DOMAIN_EXECUTIVE_EXPRESSIONS pero NO como concept ontological.
  // F12-Tier emite __tier_segment__ → activa este concept con weight 0.80.
  // Cubre cold-start de queries tipo "qué pasa con tier 1" sin
  // requerir co-pattern.
  concept_tier_segment: {
    description: "Segmentación tier 1/2/3 + variantes léxicas (t1, tier alto, primera línea)",
    signals: [
      { type: "tier_segment_canonical", patterns: ["__tier_segment__"], weight: 0.80 },
    ],
    activation_rule: {
      required_any: ["tier_segment_canonical"],
      minimum_signal_count: 1,
      minimum_combined_weight: 0.75,
    }
  },

  // BRIEF #21-A · Familia 10 · Acciones comerciales (canon)
  concept_commercial_action: {
    description: "Referencia a rebates, descuentos, bonificaciones, convenios",
    signals: [
      // BRIEF #37-octavus · cleanup · 11 patterns removidos (rebate/rebates,
      // descuento/descuentos, bonificacion/bonificación/bonificaciones,
      // convenio/convenios, carga comercial/cargas comerciales). Cobertura
      // 100% delegada a F12 commercial_action canonical (línea 1907).
      // Preservados: promocion/promoción/promociones (F12 no tiene standalone),
      // incentivo/incentivos (F12 solo "incentivo comercial" combinado).
      { type: "noun_commercial", patterns: [
          "promocion", "promoción", "promociones",
          "incentivo", "incentivos",
        ], weight: 0.7 },
      // BRIEF #41 · F12 commercial_action canonical · aditivo
      { type: "commercial_action_canonical", patterns: ["__commercial_action__"], weight: 0.75 },
    ],
    activation_rule: {
      // BRIEF #41 · aditivo · backward compat preserved
      required_any: ["noun_commercial", "commercial_action_canonical"],
      minimum_combined_weight: 0.6,
    }
  },

  // BRIEF #21-B · Lenguaje ambiguo del controller para valor económico.
  // El usuario usa términos coloquiales que NO son métricas específicas:
  // "dejan plata", "aportan", "rinden", "generan valor", "sirven más".
  // ADI los resuelve internamente como ranking por Contribución +
  // contexto Ventas + Margen %.
  concept_economic_value_query: {
    description: "Pregunta ambigua del controller sobre valor económico (resolver como ranking por Contribución)",
    signals: [
      // Verbo + objeto económico (formas activas)
      { type: "verb_economic_yield", patterns: [
          // BRIEF #6 (post-46-bis) cleanup · removidos 28 patterns hygiene
          // cubiertos por F9 canonical __economic_value_query__ vía combinatorial
          // (verbStem × intensifier × economicObject) o singleNouns BRIEF #3.
          // Preservados (F9 NO cubre):
          //   "da mas plata"/"da mas dinero" (F9 "da" en cuarentena · solo "dan")
          //   "son mas valiosos"/"es mas valioso"/"son mas valiosas"/"es mas valiosa"
          //   (F9 no tiene son/es como verbStem · "valioso" no es economicObject).
          "da mas plata", "da mas dinero",
          "son mas valiosos", "es mas valioso", "son mas valiosas", "es mas valiosa",
        ], weight: 0.7 },

      // Variantes interrogativas frecuentes
      { type: "question_economic_value", patterns: [
          "que deja mas", "qué deja más", "que dejan mas", "qué dejan más",
          "que aporta mas", "qué aporta más", "que aportan mas", "qué aportan más",
          "que rinde mas", "qué rinde más", "que rinden mas", "qué rinden más",
          "que genera mas", "qué genera más", "que generan mas", "qué generan más",
          "que da mas", "qué da más", "que dan mas", "qué dan más",
          "donde esta la plata", "dónde está la plata",
          "donde se gana mas", "dónde se gana más",
          "que es mas rentable", "qué es más rentable",
          "que es mas valioso", "qué es más valioso",
        ], weight: 0.7 },

      // Sinónimos económicos coloquiales
      { type: "noun_economic_value", patterns: [
          // BRIEF #6 (post-46-bis) cleanup · removidos "aporte economico"/"aporte económico"
          // (cubiertos por F9 singleNouns BRIEF #3 extension).
          // Preservados:
          //   "rentabilidad por X" (3) · PRIORIDAD A paramétricos pre-#7
          //   "valor por cliente" (F9 no incluye "valor" en singleNouns por FP)
          //   "valor por producto" · PRIORIDAD A paramétrico pre-#7
          "rentabilidad por producto",
          "rentabilidad por cliente",
          "rentabilidad por sku",
          "valor por cliente", "valor por producto",
        ], weight: 0.6 },
      // BRIEF #37-sextus · Fase 3 · F9 economic_value_query canonical token
      { type: "economic_value_query_canonical", patterns: ["__economic_value_query__"], weight: 0.70 },
    ],
    activation_rule: {
      // BRIEF #37-sextus · Fase 3 inicio · aditivo · backward compat preserved
      required_any: [
        "verb_economic_yield",
        "question_economic_value",
        "noun_economic_value",
        "economic_value_query_canonical",
      ],
      minimum_combined_weight: 0.6,
    }
  },

  // BRIEF #21-A · Conceptos financieros FUERA del dominio actual.
  // ADI es motor comercial-operacional, NO financiero completo.
  // Cuando se detectan estos términos, ADI declina honestamente.
  concept_financial_out_of_scope: {
    description: "Términos financieros fuera del dominio actual de ADI (EBITDA, OPEX, flujo de caja, utilidad neta)",
    signals: [
      { type: "concept_ebitda", patterns: [
          "ebitda",
          "ebit",
          "ebt",
        ], weight: 0.95 },
      { type: "concept_net_income", patterns: [
          "utilidad neta",
          "utilidad operacional",
          "utilidad final",
          "beneficio neto",
          "beneficio operacional",
          "beneficio financiero",
          "profit neto",
          "profit financiero",
          "net income",
          "net profit",
          "operating income",
        ], weight: 0.9 },
      { type: "concept_opex", patterns: [
          "opex",
          "capex",
          "gastos administracion", "gastos administración",
          "gastos generales",
          "gastos operativos",
          "g&a",
          "sga",
          "overhead",
        ], weight: 0.9 },
      { type: "concept_cash_flow", patterns: [
          "flujo de caja",
          "flujo caja",
          "cash flow",
          "cashflow",
          "free cash flow",
          "fcf",
          "flujo libre",
        ], weight: 0.9 },
      { type: "concept_financial_statements", patterns: [
          "estado de resultados",
          "estado resultados",
          "estado financiero",
          "income statement",
          "p&l completo",
          "balance general",
          "balance",
        ], weight: 0.85 },
      // BRIEF #37-septimus · Fase 3 cierre · F10 out_of_scope_financial canonical
      { type: "out_of_scope_financial_canonical", patterns: ["__out_of_scope_financial__"], weight: 0.85 },
    ],
    activation_rule: {
      // BRIEF #37-septimus · Fase 3 cierre · aditivo · backward compat preserved
      required_any: [
        "concept_ebitda",
        "concept_net_income",
        "concept_opex",
        "concept_cash_flow",
        "concept_financial_statements",
        "out_of_scope_financial_canonical",
      ],
      minimum_combined_weight: 0.7,
    }
  },

  concept_inventory_aging: {
    description: "Referencia a antigüedad de inventario, stock viejo",
    signals: [
      { type: "noun_aging", patterns: [
          "antiguedad", "stock antiguo", "inventario antiguo",
          "stock viejo", "inventario viejo",
          "aging", "stock envejecido", "inventario envejecido",
          "lento movimiento", "slow movers",
        ], weight: 0.75 },
    ],
    activation_rule: {
      required_any: ["noun_aging"],
      minimum_combined_weight: 0.6,
    }
  },

  concept_sku_query: {
    description: "Referencia a SKUs específicos, productos puntuales",
    signals: [
      // BRIEF #21-A · Familia 1 · Producto (canon: Producto)
      { type: "noun_sku", patterns: [
          // BRIEF #18 originales
          "skus", "sku", "codigos", "items", "referencias",
          "productos puntuales", "productos especificos",
          // BRIEF #21-A · canon del founder
          "producto", "productos",
          "item",
          "articulo", "articulos",
          "modelo", "modelos",
          "codigo",
          "referencia",
          "material", "materiales",
          "unidad", "unidades",
          "que productos", "qué productos",
          "que skus", "qué skus",
          "que items", "qué items",
          "que articulos", "qué artículos",
          "que modelos", "qué modelos",
        ], weight: 0.6 },
      // BRIEF #21-A · Familia 2 · Agrupación (canon: Familia)
      { type: "noun_category_q", patterns: [
          // BRIEF #18 originales
          "familia", "familias", "linea de producto", "lineas de producto",
          // BRIEF #21-A · canon del founder
          "linea", "lineas",
          "grupo", "grupos",
          "segmento", "segmentos",
          "subfamilia", "subfamilias",
          "rubro", "rubros",
          "mix",
          "portfolio", "portafolio",
          "que familia", "que familias", "qué familia", "qué familias",
          "que categoria", "que categorias", "qué categoría", "qué categorías",
          "que linea", "qué línea",
          "categoria", "categorias",
        ], weight: 0.55 },
    ],
    activation_rule: {
      required_any: ["noun_sku", "noun_category_q"],
      minimum_combined_weight: 0.5,
    }
  },

  // ═════════════════════════════════════════════════════
  // BRIEF #18 · CONCEPTOS CONTROLLER / FINANCIERO
  // ═════════════════════════════════════════════════════

  concept_working_capital: {
    description: "Referencia a capital de trabajo, working capital",
    signals: [
      { type: "noun_working_capital", patterns: [
          "working capital", "capital de trabajo",
          "capital operativo", "capital circulante",
          "necesidad de financiamiento",
        ], weight: 0.8 },
    ],
    activation_rule: {
      required_any: ["noun_working_capital"],
      minimum_combined_weight: 0.7,
    }
  },

  concept_capital_efficiency: {
    description: "Referencia a eficiencia de capital, retorno sobre activos",
    signals: [
      { type: "noun_capital_efficiency", patterns: [
          "eficiencia de capital", "eficiencia del capital",
          "retorno sobre capital", "roce", "roic",
          "retorno sobre activos", "roa",
          "rendimiento del capital",
        ], weight: 0.75 },
    ],
    activation_rule: {
      required_any: ["noun_capital_efficiency"],
      minimum_combined_weight: 0.6,
    }
  },

  domain_concentration: {
    description: "Concentración, dependencia o exposición de cartera",
    signals: [
      { type: "noun_concentration", patterns: ["concentracion", "dependencia", "exposicion", "expuesto", "que tan expuesto"], weight: 0.7 },
      { type: "noun_top", patterns: ["top 3", "principales clientes", "tres principales", "3 principales", "los grandes", "mis grandes", "a los grandes"], weight: 0.65 },
      { type: "risk_marker", patterns: ["riesgo", "criticos", "critico"], weight: 0.4 },
      // BRIEF #18 · vocabulario ejecutivo de concentración
      { type: "concept_revenue_concentration", patterns: [
          "concentracion de revenue", "concentracion de ingresos",
          "concentracion de ventas", "cartera concentrada",
          "cartera muy concentrada", "cuentas que pesan",
          "cuentas grandes", "grandes cuentas",
          "tier 1", "tier uno",
          "clientes pesados", "cuentas pesadas",
        ], weight: 0.6 },
      // BRIEF #21-A · Familia 11 · Concentración (canon Pareto)
      { type: "concept_pareto_question", patterns: [
          "80 20", "80/20", "pareto",
          "que sostiene el negocio", "qué sostiene el negocio",
          "que sostiene la cartera", "qué sostiene la cartera",
          "participacion", "participación",
          "participacion en la cartera", "participación en la cartera",
          "% de la cartera",
        ], weight: 0.6 },
      // BRIEF #37-quintus · Fase 2 · F6 concentration_risk canonical token
      { type: "concentration_risk_canonical", patterns: ["__concentration_risk__"], weight: 0.75 },
    ],
    activation_rule: {
      // BRIEF #37-quintus · Fase 2 · aditivo · backward compat preserved
      required_any: [
        "noun_concentration", "noun_top",
        "concept_revenue_concentration", "concept_pareto_question",
        "concentration_risk_canonical",
      ],
      minimum_combined_weight: 0.6,
    }
  },

  // ─── CONCEPTOS DE ENTIDADES ────────────────────────────
  client_entity: {
    description: "Referencia a un cliente del dataset (canónico) o genérico",
    signals: [
      // BRIEF #17 original · lookup contra CLIENT_NAMES (dinámico)
      { type: "client_name", patterns: [], weight: 0.9, dynamic: true },
      // BRIEF #21-A · Familia 7 · canon del founder. Genéricos de cliente
      // con peso bajo (0.35): NO ganan contra client_name específico, pero
      // SÍ activan client_entity para preguntas como "qué cliente vende más".
      { type: "noun_client_generic", patterns: [
          "cliente", "clientes",
          "cuenta", "cuentas",
          "retailer", "retailers",
          "partner", "partners",
          "canal", "canales",
          "cadena", "cadenas",
          "account", "accounts",
        ], weight: 0.35 },
    ],
    activation_rule: {
      required_any: ["client_name", "noun_client_generic"],
      minimum_combined_weight: 0.3,
    }
  },

  module_entity: {
    description: "Referencia explícita a módulo (Ventas / Márgenes / Inventario)",
    signals: [
      { type: "module_ventas", patterns: ["ventas", "facturacion"], weight: 0.7 },
      { type: "module_margenes", patterns: ["margenes", "margen general", "rentabilidad general", "mis margenes", "mis márgenes"], weight: 0.7 },
      { type: "module_inventario", patterns: ["inventario", "stock general"], weight: 0.7 },
    ],
    activation_rule: {
      required_any: ["module_ventas", "module_margenes", "module_inventario"],
      minimum_combined_weight: 0.6,
    }
  },

  mechanism_entity_erosion: {
    description: "Referencia explícita o implícita a erosión comercial",
    signals: [
      // BRIEF #17 original · explicit/rebate/pressure
      { type: "explicit_erosion", patterns: ["erosion comercial", "erosion"], weight: 0.9 },
      { type: "concept_rebate", patterns: ["carga comercial", "rebates", "rebate"], weight: 0.5 },
      { type: "concept_margin_pressure", patterns: ["margen comprimido", "margen presionado", "presion de margen"], weight: 0.5 },

      // BRIEF #17-bis · semántica natural de erosión por cliente
      { type: "concept_clients_erode_margin", patterns: [
          "clientes que comen", "clientes que comen el margen", "cuentas que comen",
          "clientes me estan comiendo", "clientes me están comiendo",
          "clientes me estan erosionando", "clientes erosionan",
          "cuentas que erosionan", "cuentas que erosionen",
          "clientes que destruyen margen", "cuentas que destruyen margen",
          "clientes que comprimen margen", "cuentas que comprimen margen",
          "clientes que cuestan margen", "cuentas que cuestan margen",
          "que clientes me cuestan", "que clientes me cuesta",
          "donde se me come el margen", "donde se me comen el margen",
        ], weight: 0.85
      },

      // Pivote composicional: clientes/cuentas + verbo de deterioro
      { type: "client_collective", patterns: [
          "que clientes", "qué clientes", "que cuentas", "qué cuentas",
          "quienes", "quiénes", "que cliente", "qué cliente",
        ], weight: 0.4
      },
      { type: "margin_deterioration_verb", patterns: [
          "comen", "comiendo", " come ", "cuestan", "cuesta",
          "destruyen", "destruyen valor", "erosionan", "erosiona",
          "comprimen", "comprimiendo", "comprimir",
          "presionan", "comprometen", "fugan",
        ], weight: 0.5
      },

      // BRIEF #18 · vocabulario ejecutivo de erosión
      { type: "concept_price_pressure", patterns: [
          "presion de precio", "presion en precios",
          "presion en precio", "compresion de precio",
          "concesiones de precio", "concesiones comerciales",
          "guerra de precios", "competencia de precios",
          "negociacion comercial dura", "negociacion presionada",
          "presionan precios", "presionan en precios", "presionan en precio",
        ], weight: 0.7
      },
      // BRIEF #22-bis · disonancia margen vs contribución
      // "bajo margen pero buena contribución" / "margen comprimido pero aportan"
      { type: "concept_low_margin_high_contribution", patterns: [
          // Patrón "bajo margen + buena contribución"
          "bajo margen pero buena contribucion",
          "bajo margen pero alta contribucion",
          "margen bajo pero buena contribucion",
          "margen bajo pero alta contribucion",
          "margen bajo pero buen aporte",
          "margen bajo pero buenos aportes",
          "margen comprimido pero buena contribucion",
          "margen comprimido pero aportan",
          "margen presionado pero contribuyen",
          "margen presionado pero aportan",
          "margen bajo pero contribuyen bien",
          "margen bajo pero generan plata",
          // Variantes interrogativas
          "que clientes tienen bajo margen pero buena contribucion",
          "que cuentas tienen margen bajo pero contribuyen bien",
          "clientes con bajo margen pero buena contribucion",
          "clientes con bajo margen y alta contribucion",
          "clientes con bajo margen pero aportan",
          "clientes con margen bajo pero aportan",
          "cuentas con bajo margen pero aportan",
          // BRIEF #23-bis · patterns telegráficos sin sujeto
          "bajo margen buena contribucion",
          "bajo margen alta contribucion",
          "bajo margen contribuyen bien",
          "margen bajo buena contribucion",
          "margen bajo alta contribucion",
          "margen bajo contribuyen bien",
          "margen comprimido buena contribucion",
          "margen comprimido alta contribucion",
          "margen presionado buena contribucion",
          "margen presionado aportan",
        ], weight: 0.85
      },
      // BRIEF #24-bis · patterns cortos · margen bajo SIN necesidad de
      // mencionar contribución. Estos rutean a mechanism_explore_erosion
      // (Ferrari) en vez de caer a module_dive(margenes) genérico.
      // Peso 0.80 · ligeramente menor que la disonancia explícita (0.85)
      // porque es menos específico, pero ambos signals activan el mismo
      // intent → mismo composer.
      { type: "concept_low_margin_simple", patterns: [
          // Versiones cortas (sin "pero buena contribución")
          "que clientes con bajo margen",
          "qué clientes con bajo margen",
          "clientes con bajo margen",
          "que cuentas con bajo margen",
          "qué cuentas con bajo margen",
          "cuentas con bajo margen",
          "que clientes con margen bajo",
          "qué clientes con margen bajo",
          "clientes con margen bajo",
          // BRIEF #24-bis fix V4.b · variantes "cuentas con margen bajo"
          "que cuentas con margen bajo",
          "qué cuentas con margen bajo",
          "cuentas con margen bajo",
          "clientes con margen comprimido",
          "clientes con margen presionado",
          "cuentas con margen comprimido",
          "que clientes tienen bajo margen",
          "qué clientes tienen bajo margen",
          "que cuentas tienen bajo margen",
          "qué cuentas tienen bajo margen",
          "que clientes tienen margen bajo",
          "qué clientes tienen margen bajo",
          // Versiones con verbos terminales
          "clientes que comprimen margen",
          "cuentas que comprimen margen",
          "clientes presionando margen",
          "cuentas presionando margen",
          // Variantes "donde/dónde" sin sujeto cliente
          "donde tengo bajo margen",
          "donde tengo margen bajo",
        ], weight: 0.80
      },
      // Nota: "sacrificando margen/contribución" se trata en mechanism_entity_quality
      // (es calidad de crecimiento, no erosión por presión de precio).
      // BRIEF #37 v2 · F3 margin_erosion canonical token
      { type: "margin_erosion_canonical", patterns: ["__margin_erosion__"], weight: 0.80 },
    ],
    activation_rule: {
      // Activación clásica O composicional (client_collective + margin_deterioration_verb)
      required_any: [
        "explicit_erosion", "concept_rebate", "concept_margin_pressure",
        "concept_clients_erode_margin",
        "client_collective + margin_deterioration_verb",
        // BRIEF #18 · activación con vocabulario ejecutivo
        "concept_price_pressure",
        // BRIEF #22-bis · disonancia margen-contribución
        "concept_low_margin_high_contribution",
        // BRIEF #24-bis · patterns cortos sin disonancia explícita
        "concept_low_margin_simple",
        // BRIEF #37 v2 · aditivo · backward compat preserved by construction
        "margin_erosion_canonical",
      ],
      minimum_combined_weight: 0.6,
    }
  },

  mechanism_entity_quality: {
    description: "Deterioro de calidad de crecimiento",
    signals: [
      { type: "explicit_quality", patterns: ["calidad de crecimiento", "calidad del crecimiento", "deterioro de calidad"], weight: 0.9 },
      { type: "concept_destroy_value", patterns: ["destruyen valor", "destruyendo valor"], weight: 0.7 },
      // BRIEF #18 · vocabulario ejecutivo de calidad de crecimiento
      { type: "concept_growth_quality_poor", patterns: [
          "crecimiento de baja calidad", "calidad de crecimiento mala",
          "crecimiento sin captura", "crecimiento que no captura",
          "crecimiento sin contribucion", "crecen sin contribuir",
          "crecen sin contribucion", "crecimiento diluye",
          "crecimiento sin retorno", "crecimiento que diluye",
          "crecimiento poco rentable", "crecen poco rentable",
          "topline sin bottom line", "topline crece bottom no",
        ], weight: 0.85
      },
      { type: "concept_growth_with_sacrifice", patterns: [
          "crecen sacrificando", "crece sacrificando",
          "crecen cediendo", "crecen renunciando",
          "ganan participacion perdiendo margen",
          "ganan share perdiendo margen", "share growth no rentable",
          // BRIEF #18 fix · sacrificio/dilución/cesión de margen
          "sacrificando margen", "sacrifican margen",
          "sacrificio de margen", "sacrifican contribucion",
          "sacrificando contribucion", "ceden margen",
          "cediendo margen", "cediendo contribucion",
          "renuncia a margen", "renunciando a margen",
          "diluyen margen", "diluyendo margen",
          "diluyen contribucion", "diluyendo contribucion",
        ], weight: 0.85
      },
      // BRIEF #22-bis · disonancia volumen vs contribución
      // "buena venta pero baja contribución" / "vendo bien pero contribuyen poco"
      { type: "concept_volume_low_contribution", patterns: [
          // Patrón "buena venta + baja contribución"
          "buena venta pero baja contribucion",
          "buena venta pero poca contribucion",
          "buenas ventas pero baja contribucion",
          "buenas ventas pero poca contribucion",
          "vendemos bien pero contribuyen poco",
          "vendemos bien pero contribuyen menos",
          "venden bien pero contribuyen poco",
          "venden bien pero aportan poco",
          "venden mucho pero contribuyen poco",
          "venden mucho pero aportan poco",
          "vendo bien pero contribuyen poco",
          "vendo mucho pero contribuyen menos",
          "alto volumen pero baja contribucion",
          "mucha venta pero poca contribucion",
          "mucha venta pero baja contribucion",
          // Patrón "ventas altas + contribución baja" sin "pero"
          "ventas altas contribucion baja",
          "venden alto contribuyen bajo",
          // Patrón interrogativo founder
          "tengo clientes que tienen buena venta pero baja contribucion",
          "que clientes tienen buena venta pero baja contribucion",
          "clientes con buena venta pero baja contribucion",
          "clientes con alta venta y baja contribucion",
          // BRIEF #23-bis · patterns telegráficos sin sujeto
          "buena venta baja contribucion",
          "buenas ventas baja contribucion",
          "buenas ventas bajas contribuciones",
          "venta alta contribucion baja",
          "venta alta baja contribucion",
          "altas ventas baja contribucion",
          "alta venta baja contribucion",
          "venden mucho aportan poco",
          "venden bien aportan poco",
          "vendemos bien contribuyen poco",
          "venta sin contribucion",
          "ventas sin contribucion",
        ], weight: 0.85
      },
    ],
    activation_rule: {
      required_any: [
        "explicit_quality", "concept_destroy_value",
        "concept_growth_quality_poor", "concept_growth_with_sacrifice",
        // BRIEF #22-bis · disonancia volumen-contribución
        "concept_volume_low_contribution",
      ],
      minimum_combined_weight: 0.7,
    }
  },

  mechanism_scan_query: {
    description: "Solicitud de overview / scan general de mecanismos",
    signals: [
      { type: "scan_query", patterns: ["que mecanismos", "mecanismos activos", "estado del negocio", "panorama", "resumen", "como esta el negocio"], weight: 0.7 },
    ],
    activation_rule: {
      required_any: ["scan_query"],
      minimum_combined_weight: 0.6,
    }
  },

  ranking_query: {
    description: "Solicitud de ranking, comparación de severidad",
    signals: [
      { type: "ranking_marker", patterns: ["el mas caro", "mas grave", "ranking", "mayor costo", "principal problema", "mecanismo mas caro", "mecanismo mas grave"], weight: 0.7 },
    ],
    activation_rule: {
      required_any: ["ranking_marker"],
      minimum_combined_weight: 0.6,
    }
  },

  // ════════════════════════════════════════════════════════════════════════
  // BRIEF #26-ter · Modo Oportunidad · concepts duales del modo ejecutivo
  //
  // concept_dual_comparison · "caballo de carrera vs lastre"
  // concept_growth_opportunity · "dónde invertir esfuerzo comercial"
  //
  // Categorías de pensamiento simétricas al modo problema existente.
  // ════════════════════════════════════════════════════════════════════════
  concept_dual_comparison: {
    description: "Comparación dual virtuoso vs lastre · top vs bottom · ganador vs perdedor",
    signals: [
      { type: "dual_marker", patterns: [
        // Metáfora "caballo de carrera"
        "caballo de carrera",
        "caballos de carrera",
        "cual es mi caballo de carrera",
        "cuál es mi caballo de carrera",
        "que sku es mi caballo de carrera",
        "qué sku es mi caballo de carrera",
        // Lastre / freno
        "cual me esta frenando",
        "cuál me está frenando",
        "que me esta frenando",
        "qué me está frenando",
        "cual es lastre",
        "cuál es lastre",
        "cual me lastra",
        "cuál me lastra",
        // Top vs bottom
        "top vs bottom",
        "los que rinden vs los que no",
        "los que rinden y los que no",
        "ganador y perdedor",
        "ganadores y perdedores",
        // Ganador vs Lastre combinados
        "caballo de carrera y cual es lastre",
        "caballo de carrera y cuál es lastre",
        "caballo de carrera vs lastre",
        "ganador vs lastre",
        // El que rinde / el que pesa
        "el que mas rinde",
        "el que más rinde",
        "el que mas pesa",
        "el que más pesa",
        "los que rinden",
        "los que pesan",
        // Naturales adicionales
        "que productos rinden",
        "qué productos rinden",
        "sku virtuosos y sku problema",
        "skus virtuosos y skus problema",
      ], weight: 0.90 },
    ],
    activation_rule: {
      required_any: ["dual_marker"],
      minimum_combined_weight: 0.7,
    }
  },

  concept_growth_opportunity: {
    description: "Oportunidad de inversión comercial · dónde poner esfuerzo",
    signals: [
      { type: "growth_marker", patterns: [
        // Inversión y foco
        "donde invertir",
        "dónde invertir",
        "donde poner foco",
        "dónde poner foco",
        "donde apostar",
        "dónde apostar",
        "donde apostar mas",
        "dónde apostar más",
        // Empujar / escalar
        "que empujar",
        "qué empujar",
        "que linea empujar",
        "qué línea empujar",
        "que cliente empujar",
        "qué cliente empujar",
        "que escalar",
        "qué escalar",
        "donde puedo crecer",
        "dónde puedo crecer",
        "donde tengo espacio para crecer",
        "dónde tengo espacio para crecer",
        // Vale la pena / esfuerzo
        "en que cliente vale la pena",
        "en qué cliente vale la pena",
        "donde vale la pena invertir",
        "dónde vale la pena invertir",
        "donde vale la pena el esfuerzo",
        "dónde vale la pena el esfuerzo",
        "vale la pena invertir mas esfuerzo",
        "vale la pena invertir más esfuerzo",
        "esfuerzo comercial",
        "donde meter esfuerzo",
        "dónde meter esfuerzo",
        // Proteger / mantener
        "que proteger",
        "qué proteger",
        "cuenta a proteger",
        "cuentas a proteger",
        // Si tuviera / hipotético
        "si tuviera presupuesto",
        "si tuviera plata para invertir",
        "si tengo recursos",
        "si pudiera empujar",
        // Upside
        "donde tengo upside",
        "dónde tengo upside",
        "que cuenta tiene potencial",
        "qué cuenta tiene potencial",
      ], weight: 0.90 },
    ],
    activation_rule: {
      required_any: ["growth_marker"],
      minimum_combined_weight: 0.7,
    }
  },
};

export const SEMANTIC_FAMILIES = {
  // ── F1 · capital_inmovilizado ──────────────────────────────────────────
  // Combinatorial 6 NOUNS × 8 STATES con proximidad ≤ 3 tokens.
  // Cobertura: "plata atrapada", "stock muerto", "capital varado",
  //            "dinero detenido", "inventario inmovilizado", "caja parada"...
  capital_inmovilizado: {
    id: "capital_inmovilizado",
    description: "Capital económico en estado de inmovilización",
    type: "combinatorial",
    nouns: ["plata", "dinero", "capital", "caja", "inventario", "stock"],
    states: ["atrapad", "amarrad", "detenid", "inmovilizad", "estancad", "varad", "muert", "parad"],
    proximityWindow: 3,
    canonicalToken: "__capital_inmovilizado__",
    confidence: 0.85,
    cognitiveMap: {
      domain: "inventario",
      metric: "capital_inmovilizado",
      goalDefault: "liberar_capital",
      goalOverride: false,
    },
    conceptTargets: ["loss_explicit", "domain_inventory"],
  },

  // ── F2 · action_liberate ───────────────────────────────────────────────
  // Stem-only · verbos ejecutivos de acción de liberación.
  // STEMS son raíces sin terminación de infinitivo para cubrir conjugaciones:
  //   "liber" → liberar/libero/liberando/libera/liberaba/liberen
  //   "recuper" → recuperar/recupero/recuperando/recupera/recuperaba
  //   "destrab" → destrabar/destrabamos/destrabando/destraba
  //   "solt" → soltar/solto/soltando/suelta (no cubre "suelt", trade-off aceptado)
  // FPs potenciales documentados:
  //   "liber" puede matchear "libertad", "libélula", "libreta", "liberal"
  //   "solt" puede matchear "soltero"
  // Mitigación: action_liberate aporta weight 0.6 solo · no alcanza umbral
  // de intent fuga_distribuida sin otros signals · FPs solo activan
  // loss_explicit pero el intent semántico no resuelve (cae al fallback).
  // Si en producción genera problemas, Fase 2 restringe a contexto económico.
  // OVERRIDE GOAL: si matchea, fuerza investigationGoal = "liberar_capital"
  // post-PATTERN_TO_GOAL/INTENT_TO_GOAL (acción explícita manda sobre
  // goal inferido por intent type).
  action_liberate: {
    id: "action_liberate",
    description: "Verbo ejecutivo de acción de liberación",
    type: "stem_only",
    stems: ["liber", "recuper", "destrab", "solt"],
    canonicalToken: "__action_liberate__",
    confidence: 0.60,
    cognitiveMap: {
      domain: null,
      metric: null,
      goalDefault: null,
      goalOverride: true,
      goalOverrideValue: "liberar_capital",
    },
    conceptTargets: ["loss_explicit"],
  },

  // ── F3 · margin_erosion ────────────────────────────────────────────────
  // Combinatorial 5 NOUNS × 9 STATES con proximidad ≤ 4 tokens.
  // Cobertura: "margen comprimido", "contribución erosionada",
  //            "rentabilidad presionada", "margen estan comiendo
  //            los clientes" (proximidad 4, forward).
  // NOTA: "comid" cubre participio (margen comido) · "comiend" cubre gerundio
  // (margen estan comiendo) · sin ambos, gerundio FORWARD no matchea.
  margin_erosion: {
    id: "margin_erosion",
    description: "Erosión, compresión o presión sobre margen/contribución",
    type: "combinatorial",
    nouns: ["margen", "margenes", "contribucion", "rentabilidad", "captura"],
    states: ["comprim", "presion", "erosion", "comid", "comiend", "destruid", "cedid", "fug", "perd"],
    proximityWindow: 4,
    canonicalToken: "__margin_erosion__",
    confidence: 0.80,
    cognitiveMap: {
      domain: "margenes",
      metric: "contribucion",
      goalDefault: "recuperar_margen",
      goalOverride: false,
    },
    conceptTargets: ["profitability_negative", "mechanism_entity_erosion"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FASE 2 · BRIEF #37-quintus · F4 + F5 + F6
  //
  // Refinamiento clave vs Fase 1: nuevo campo `stateMatchers` (en lugar de
  // `states`) que soporta dos modos de match:
  //   · matchType "exact_word"      → token EXACTAMENTE igual al pattern
  //   · matchType "stem_startswith" → token startsWith el stem
  //
  // Motivación: stems crudos como "ca"/"contra"/"sub" tienen alto FP léxico
  // ("casa", "contrato", "subasta"). Los stems en cuarentena (ca, contra,
  // sub, da, gener, sal, fug) NO entran al registry. En su lugar usamos
  // formas exactas o stems lo suficientemente largos para evitar colisión.
  //
  // Backward compat: familias F1/F2/F3 (states[]) siguen funcionando · el
  // dispatcher en semanticNormalize() detecta presencia de stateMatchers
  // vs states y rutea a la lógica correspondiente.
  // ─────────────────────────────────────────────────────────────────────────

  // ── F4 · volume_decline ────────────────────────────────────────────────
  // Combinatorial 5 NOUNS × 11 matchers con proximidad ≤ 3.
  // Cobertura: "ventas cayendo", "facturación baja", "ingresos retroceden",
  //            "volumen contraen", "topline abajo".
  // Activa profitability_negative (cuando matchea con otro signal, porque
  // ese concept tiene minimum_signal_count=2).
  volume_decline: {
    id: "volume_decline",
    description: "Caída/retroceso de volumen, ventas, facturación o topline",
    type: "combinatorial",
    nouns: ["ventas", "facturacion", "volumen", "ingresos", "topline"],
    stateMatchers: [
      { pattern: "cae", matchType: "exact_word" },
      { pattern: "caen", matchType: "exact_word" },
      { pattern: "cayendo", matchType: "exact_word" },
      { pattern: "baja", matchType: "exact_word" },
      { pattern: "bajan", matchType: "exact_word" },
      { pattern: "bajando", matchType: "exact_word" },
      { pattern: "retroced", matchType: "stem_startswith" },
      { pattern: "comprim", matchType: "stem_startswith" },
      { pattern: "contraen", matchType: "exact_word" },
      { pattern: "contrayendo", matchType: "exact_word" },
      { pattern: "abajo", matchType: "exact_word" },
      // BRIEF #45 · expansión léxica · sinónimos castellano natural
      // "caída"/"caida" post-NFD queda como "caida" · solo agregar versión sin tilde
      { pattern: "descenso", matchType: "exact_word" },
      { pattern: "caida", matchType: "exact_word" },
      { pattern: "desplom", matchType: "stem_startswith" },
      { pattern: "hundimiento", matchType: "exact_word" },
      { pattern: "decae", matchType: "exact_word" },
      { pattern: "decayendo", matchType: "exact_word" },
      { pattern: "decaen", matchType: "exact_word" },
    ],
    proximityWindow: 3,
    canonicalToken: "__volume_decline__",
    confidence: 0.75,
    cognitiveMap: {
      domain: "ventas",
      metric: "actual",
      goalDefault: "entender_problema",
      goalOverride: false,
    },
    conceptTargets: ["profitability_negative"],
  },

  // ── F5 · volume_growth ─────────────────────────────────────────────────
  // Combinatorial 5 NOUNS × 9 matchers con proximidad ≤ 3.
  // Cobertura: "ventas crecen", "facturación sube", "ingresos aumentan",
  //            "volumen expande", "topline incrementa".
  // Activa growth_positive.
  volume_growth: {
    id: "volume_growth",
    description: "Crecimiento/expansión de volumen, ventas, facturación o topline",
    type: "combinatorial",
    // BRIEF #45 · agregados "cartera" y "portafolio" como nouns
    // (bajo riesgo FP · castellano natural · "cartera del banco/cuero" sin
    // state F5 cerca queda inerte · "tengo cartera personal" tampoco activa).
    nouns: ["ventas", "facturacion", "volumen", "ingresos", "topline", "cartera", "portafolio"],
    stateMatchers: [
      { pattern: "crec", matchType: "stem_startswith" },
      { pattern: "crece", matchType: "exact_word" },
      { pattern: "crecen", matchType: "exact_word" },
      { pattern: "sube", matchType: "exact_word" },
      { pattern: "suben", matchType: "exact_word" },
      { pattern: "subiendo", matchType: "exact_word" },
      { pattern: "aument", matchType: "stem_startswith" },
      { pattern: "expand", matchType: "stem_startswith" },
      { pattern: "incremen", matchType: "stem_startswith" },
      // BRIEF #45 · expansión léxica · sinónimos crecimiento
      { pattern: "alza", matchType: "exact_word" },
      { pattern: "disparad", matchType: "stem_startswith" },
      { pattern: "dispara", matchType: "exact_word" },
      { pattern: "disparan", matchType: "exact_word" },
      { pattern: "expansion", matchType: "exact_word" },
    ],
    proximityWindow: 3,
    canonicalToken: "__volume_growth__",
    confidence: 0.75,
    cognitiveMap: {
      domain: "ventas",
      metric: "actual",
      goalDefault: "maximizar_contribucion",
      goalOverride: false,
    },
    conceptTargets: ["growth_positive"],
  },

  // ── F6 · concentration_risk ────────────────────────────────────────────
  // Combinatorial 7 NOUNS × 6 matchers con proximidad ≤ 4 (ventana extendida
  // para capturar frases largas tipo "los grandes clientes que concentran").
  // Cobertura: "cartera concentrada", "clientes pesados", "cuentas top",
  //            "ingresos dependientes", "facturación expuesta".
  // Activa domain_concentration.
  concentration_risk: {
    id: "concentration_risk",
    description: "Concentración o exposición de cartera/clientes/ingresos",
    type: "combinatorial",
    // BRIEF #45 · nouns extendidos · vocabulario sustantivado
    // ("la concentración alta..." · "tengo dependencia de Falabella").
    // Bajo riesgo FP: "concentración del jugo" sin state F6 cerca queda inerte.
    nouns: ["cliente", "clientes", "cuenta", "cuentas", "cartera", "ingresos", "facturacion",
            "concentracion", "dependencia", "exposicion", "portafolio"],
    stateMatchers: [
      { pattern: "concentr", matchType: "stem_startswith" },
      { pattern: "depend", matchType: "stem_startswith" },
      { pattern: "expuest", matchType: "stem_startswith" },
      { pattern: "pesad", matchType: "stem_startswith" },
      { pattern: "principal", matchType: "stem_startswith" },
      { pattern: "top", matchType: "exact_word" },
      // BRIEF #45 · expansión · verbos finitos faltantes
      { pattern: "depende", matchType: "exact_word" },
      { pattern: "dependen", matchType: "exact_word" },
      { pattern: "dependiendo", matchType: "exact_word" },
      // BRIEF #45 · stateMatchers complementarios autorizados condicionalmente
      // por el BRIEF ("si emerge en QA"). Emergió en QA: "dependencia alta",
      // "exposición alta", "concentración fuerte" requieren capturar el modificador.
      // Stems específicos · NO "alt" crudo (matchea "altura/alterar/alternativo").
      { pattern: "alta", matchType: "exact_word" },
      { pattern: "alto", matchType: "exact_word" },
      { pattern: "altas", matchType: "exact_word" },
      { pattern: "altos", matchType: "exact_word" },
      { pattern: "elevada", matchType: "exact_word" },
      { pattern: "elevado", matchType: "exact_word" },
      { pattern: "elevadas", matchType: "exact_word" },
      { pattern: "elevados", matchType: "exact_word" },
      { pattern: "fuerte", matchType: "exact_word" },
      { pattern: "fuertes", matchType: "exact_word" },
      // F6 búsqueda combinatorial es noun-first (preexistente): noun pos N,
      // state pos N+1 a N+proximityWindow. "concentración en pocos clientes":
      // noun=concentracion pos 0 · busca state pos 1-4 · "clientes" pos 3 NO
      // es state · falla. Bidireccionalidad sería refactor mayor · NO en este
      // BRIEF. "dependencia alta de Falabella" SÍ captura ahora (alta pos 1).
    ],
    proximityWindow: 4,
    canonicalToken: "__concentration_risk__",
    confidence: 0.75,
    cognitiveMap: {
      domain: "margenes",
      metric: "contribucion",
      goalDefault: "proteger_rentabilidad",
      goalOverride: false,
    },
    conceptTargets: ["domain_concentration"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FASE 3 INICIO · BRIEF #37-sextus · F7 + F8 + F9
  //
  // 3 matchType nuevos extienden semanticNormalize sin refactor:
  //   · combinatorial_with_standalone (F7): combinatoria normal + fallback
  //     nounStandalone si ningún state matcheó. Cubre "¿cómo está la
  //     rotación?" sin requerir verbo cercano.
  //   · disjunctive_set (F8): vocabulario técnico DOH/cobertura · lookup
  //     directo (rama YA existente desde Fase 1 · F8 la reutiliza).
  //   · combinatorial_double (F9): verbStem × (intensifiers ∪ economicObjects)
  //     con VENTANA BIDIRECCIONAL ≤ 2. Única excepción · justificada por
  //     sintaxis interrogativa española invertida ("¿qué deja más?" vs
  //     "¿más rinde qué?"). Riesgo FP mitigado por restricción a sets
  //     estrictos (no a cualquier token).
  //
  // Stem "da/dan" del registry original en CUARENTENA · NO incluido aquí.
  // Cubrir "qué da más" depende de patterns legacy. Deuda Fase 4 si emerge.
  // ─────────────────────────────────────────────────────────────────────────

  // ── F7 · rotation_query ────────────────────────────────────────────────
  // Combinatorial 5 NOUNS × 12 stateMatchers · proximityWindow 2 · MÁS
  // fallback nounStandalone para queries directos ("¿cómo está la rotación?").
  // Cobertura: rotación + verbos de movimiento (gira/mueve/fluye/sale).
  // El standalone se activa SOLO si combinatorial NO matcheó (orden importa).
  rotation_query: {
    id: "rotation_query",
    description: "Pregunta sobre rotación de inventario o flujo de stock",
    type: "combinatorial_with_standalone",
    nouns: ["rotacion", "vueltas", "turnover", "turn", "movimiento"],
    stateMatchers: [
      { pattern: "rota", matchType: "stem_startswith" },
      { pattern: "rotan", matchType: "exact_word" },
      { pattern: "rotando", matchType: "exact_word" },
      { pattern: "gira", matchType: "exact_word" },
      { pattern: "giran", matchType: "exact_word" },
      { pattern: "girando", matchType: "exact_word" },
      { pattern: "mueve", matchType: "exact_word" },
      { pattern: "mueven", matchType: "exact_word" },
      { pattern: "moviendo", matchType: "exact_word" },
      { pattern: "fluy", matchType: "stem_startswith" },
      { pattern: "salida", matchType: "exact_word" },
      { pattern: "saliendo", matchType: "exact_word" },
    ],
    proximityWindow: 2,
    // Excepción F7: estos nouns activan canonical SIN requerir state cercano.
    // Razón: queries directos del founder tipo "¿cómo está la rotación?" o
    // "qué pasa con el DOH" no tienen verbo de movimiento explícito.
    nounStandalone: ["rotacion", "doh", "vueltas", "turnover"],
    canonicalToken: "__rotation_query__",
    confidence: 0.75,
    cognitiveMap: {
      domain: "inventario",
      metric: "rotacion",
      goalDefault: "entender_problema",
      goalOverride: false,
    },
    conceptTargets: ["concept_rotation"],
  },

  // ── F8 · coverage_query ────────────────────────────────────────────────
  // Disjunctive_set · vocabulario técnico DOH/cobertura cerrado.
  // Lookup directo sobre normalizedText (no requiere proximidad).
  // La rama disjunctive_set YA existe en semanticNormalize (desde Fase 1
  // documentado · F8 la reutiliza out-of-the-box).
  coverage_query: {
    id: "coverage_query",
    description: "Pregunta sobre días de cobertura, DOH, duración de stock",
    type: "disjunctive_set",
    terms: [
      "cobertura",
      "doh",
      "dias de cobertura",
      "dias en stock",
      "rango de cobertura",
      "dias de inventario",
      "dias stock",
      "dias inventario",
      "duracion del stock",
      "dias que dura",
      "para cuanto alcanza",
      "cuanto stock tengo",
      // BRIEF #45 · expansión · variantes interrogativas naturales
      "cuantos dias",
      "cuantos dias tengo",
      "cuanto stock",
      "days on hand",
      "days on hand actual",
      "doh actual",
    ],
    canonicalToken: "__coverage_query__",
    confidence: 0.75,
    cognitiveMap: {
      domain: "inventario",
      metric: "doh",
      goalDefault: "entender_problema",
      goalOverride: false,
    },
    conceptTargets: ["concept_days_on_hand"],
  },

  // ── F9 · economic_value_query ──────────────────────────────────────────
  // Combinatorial_double · verbStem × (intensifiers ∪ economicObjects).
  // Ventana BIDIRECCIONAL ≤ 2 (única excepción del registry · sintaxis
  // interrogativa española invierte verbo+modificador frecuentemente).
  //
  // Cobertura: "qué SKUs dejan más plata", "qué rinde más valor",
  //            "más rentabilidad por producto".
  //
  // Stem "da/dan" en cuarentena · NO incluido (muy corto · FPs altos).
  // Cubrir "qué da más" depende de patterns legacy ("que da mas" en
  // question_economic_value del concept). Deuda Fase 4 si necesario.
  economic_value_query: {
    id: "economic_value_query",
    description: "Pregunta ambigua sobre valor económico (resolver como ranking por contribución)",
    type: "combinatorial_double",
    verbStems: [
      { pattern: "dej", matchType: "stem_startswith" },
      { pattern: "aport", matchType: "stem_startswith" },
      { pattern: "rind", matchType: "stem_startswith" },
      { pattern: "rinde", matchType: "exact_word" },
      { pattern: "rinden", matchType: "exact_word" },
      { pattern: "gener", matchType: "stem_startswith" },
      { pattern: "rent", matchType: "stem_startswith" },
      { pattern: "renta", matchType: "exact_word" },
      { pattern: "rentan", matchType: "exact_word" },
      { pattern: "sirv", matchType: "stem_startswith" },
      { pattern: "produc", matchType: "stem_startswith" },
      // BRIEF #45 · "dan" exact_word (NO "da" · "da" sigue en cuarentena
      // #37-sextus por ambigüedad "dame"/"se da"/"da igual").
      // Auditoría empírica #43: "le dan duro"/"me dan ganas" NO emiten
      // porque F9 requiere combinatoria con intensifier/economicObject
      // en ventana ≤ 2. "qué clientes dan más" SÍ emite (mas en intensifiers).
      { pattern: "dan", matchType: "exact_word" },
    ],
    intensifiers: ["mas", "más", "mejor", "mayor"],
    economicObjects: ["plata", "dinero", "valor", "rentabilidad", "aporte"],
    // BRIEF #3 (post-46-bis) · single_noun matchType paralelo a la combinatoria.
    // Captura economicObjects standalone sin verbStem (ej: "aporte económico
    // del portafolio", "rentabilidad por cliente", "contribución por familia").
    // Se evalúa ANTES de la combinatoria en la rama combinatorial_double · si
    // matchea, emite canonical y termina (idempotente). Si no, sigue flujo
    // combinatorial estándar bitwise preservado.
    // "valor" deliberadamente excluido · FP alto ("valor histórico", "valor
    // agregado", "no tiene valor"). Vocabulario disponible en signals legacy
    // del concept (noun_economic_value: "valor por cliente").
    singleNouns: [
      { pattern: "aporte economico", subType: "substring" },
      { pattern: "aporte",        subType: "exact_word" },
      { pattern: "rentabilidad",  subType: "exact_word" },
      { pattern: "contribucion",  subType: "exact_word" },
    ],
    proximityWindow: 2,
    canonicalToken: "__economic_value_query__",
    confidence: 0.70,
    cognitiveMap: {
      domain: "inventario",
      metric: "contribucion",
      goalDefault: "maximizar_contribucion",
      goalOverride: false,
    },
    conceptTargets: ["concept_economic_value_query"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FASE 3 CIERRE · BRIEF #37-septimus · F10 + F11 + F12-Tier
  //
  // Las 3 familias son disjunctive_set (lookup directo sobre normalizedText).
  // La rama disjunctive_set ya está implementada desde Fase 1 · F10/F11/F12
  // la reutilizan out-of-the-box · cero cambio al motor.
  //
  // F10 out_of_scope_financial: protege contra preguntas trampa fuera de
  //   dominio (EBITDA/OPEX/cash flow). La arquitectura existente ya rutea
  //   a out_of_domain_query vía concept_financial_out_of_scope · F10 solo
  //   agrega vocabulario adicional vía canonical token.
  //
  // F11 warehouse_location: cubre cold-start sobre bodegas
  //   (Santiago/Valparaíso/Concepción/Antofagasta + variantes léxicas).
  //
  // F12-Tier tier_segment: captura "tier 1/2/3" y variantes (t1, t2, t3,
  //   tier alto/medio/bajo, primera/segunda línea). Reemplaza F12
  //   commercial_action del registry original · commercial_action diferido
  //   a Fase 4 post-postulación.
  // ─────────────────────────────────────────────────────────────────────────

  // ── F10 · out_of_scope_financial ───────────────────────────────────────
  // Disjunctive_set · vocabulario financiero fuera de dominio actual.
  // Activa concept_financial_out_of_scope → intent out_of_domain_query
  // (signature existente · ver INTENTS_REGISTRY:out_of_domain_query).
  // NOTA arquitectónica: intentOverride manual NO necesario · el flujo
  // estándar (extractConcepts → scoreIntents → resolveSemanticIntent)
  // resuelve correctamente porque out_of_domain_query.signature.required
  // ya incluye concept_financial_out_of_scope.
  out_of_scope_financial: {
    id: "out_of_scope_financial",
    description: "Términos financieros fuera de dominio · EBITDA/OPEX/cash flow",
    type: "disjunctive_set",
    terms: [
      "ebitda",
      "opex",
      "capex",
      "cash flow",
      "flujo de caja",
      "free cash flow",
      "utilidad neta",
      "resultado neto",
      "balance",
      "estado de resultados",
      "p&l",
      "p y l",
      "wacc",
      "tir",
      "van",
      "valor presente",
      "dividendos",
      "deuda financiera",
    ],
    canonicalToken: "__out_of_scope_financial__",
    confidence: 0.85,
    cognitiveMap: {
      domain: null,
      metric: null,
      goalDefault: null,
      goalOverride: true,
      intentOverride: "out_of_domain_query",
    },
    conceptTargets: ["concept_financial_out_of_scope"],
  },

  // ── F11 · warehouse_location ───────────────────────────────────────────
  // Disjunctive_set · ciudades canon Chile + sustantivos de localización
  // de inventario. Activa concept_warehouse (existe en CONCEPT_ONTOLOGY).
  warehouse_location: {
    id: "warehouse_location",
    description: "Bodegas, sucursales, centros de distribución, ciudades canon Chile",
    type: "disjunctive_set",
    terms: [
      "santiago",
      "valparaiso",
      "valparaíso",
      "concepcion",
      "concepción",
      "antofagasta",
      "bodega",
      "bodegas",
      "centro de distribucion",
      "centro de distribución",
      "cd",
      "sucursal",
      "sucursales",
      "punto de venta",
      "puntos de venta",
      "almacen",
      "almacén",
    ],
    canonicalToken: "__warehouse_location__",
    confidence: 0.75,
    cognitiveMap: {
      domain: "inventario",
      metric: "capital_inmovilizado",
      goalDefault: "entender_problema",
      goalOverride: false,
    },
    conceptTargets: ["concept_warehouse"],
  },

  // ── F12-Tier · tier_segment ────────────────────────────────────────────
  // Disjunctive_set · vocabulario de segmentación tier. Reemplaza F12
  // commercial_action del registry original (diferido Fase 4).
  // Activa concept_tier_segment (NUEVO concept · creado en este BRIEF).
  tier_segment: {
    id: "tier_segment",
    description: "Segmentación tier 1/2/3 + variantes (t1, tier alto, primera línea)",
    type: "disjunctive_set",
    terms: [
      "tier 1",
      "tier 2",
      "tier 3",
      "tier1",
      "tier2",
      "tier3",
      "t1",
      "t2",
      "t3",
      "cuentas tier",
      "segmento tier",
      "tier alto",
      "tier medio",
      "tier bajo",
      "top tier",
      "primera linea",
      "segunda linea",
    ],
    canonicalToken: "__tier_segment__",
    confidence: 0.80,
    cognitiveMap: {
      domain: "ventas",
      metric: "actual",
      goalDefault: "entender_problema",
      goalOverride: false,
    },
    conceptTargets: ["concept_tier_segment"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BRIEF #41 · F12 cierre registry · vocabulario crítico Gerente Comercial
  //
  // F12 commercial_action: cubre vocabulario del Gerente Comercial sobre
  // acciones comerciales · rebates, descuentos, convenios, carga comercial,
  // bonificaciones, comisiones, notas de crédito, back margin.
  //
  // Cierra el registry técnico locked 18-mayo · 12/12 familias activas.
  //
  // Disjunctive_set · activa concept_commercial_action (existe línea 1751).
  // F12 actúa como señal contextual aditiva · NO ruteo a intent dedicado.
  // El ruteo natural de "los rebates están comiendo el margen" es
  // mechanism_explore_erosion vía co-pattern F3 margin_erosion.
  // Si en QA expandida del jueves se detecta necesidad de composer
  // dedicado, BRIEF #41-bis lo agrega.
  // ─────────────────────────────────────────────────────────────────────────
  commercial_action: {
    id: "commercial_action",
    description: "Acciones comerciales · rebates, descuentos, carga, convenios, bonificaciones",
    type: "disjunctive_set",
    terms: [
      "rebate",
      "rebates",
      "descuento",
      "descuentos",
      "convenio",
      "convenios",
      "carga comercial",
      "carga",
      "acciones comerciales",
      "accion comercial",
      "bonificacion",
      "bonificaciones",
      "comision comercial",
      "comisiones comerciales",
      "incentivo comercial",
      "incentivos comerciales",
      "nota de credito",
      "notas de credito",
      "back margin",
      "compensacion comercial",
    ],
    canonicalToken: "__commercial_action__",
    confidence: 0.75,
    cognitiveMap: {
      domain: "margenes",
      metric: "contribucion",
      goalDefault: "recuperar_margen",
      goalOverride: false,
    },
    conceptTargets: ["concept_commercial_action"],
  },
};
