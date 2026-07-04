/* === src/adi/contracts/contractRegistry.js · CONTRATO DE RESPUESTA · registro DECLARATIVO ===
 * Los 7 contratos como DATO (no código): cada uno declara sus SLOTS ordenados y si está ACTIVO.
 * Regla madre: ADI no muestra datos, arma decisiones (lectura → porqué → palanca → cierre), graduado por evidencia.
 *
 * ACTIVACIÓN PROGRESIVA por contrato, con gate verde por fase (decisión del owner 2026-07-03):
 *   Fase 1 → solo `diagnose_value_leak` ACTIVO · el resto queda declarado como stub (active:false) y el closer no-op.
 *   `recommend_action` DIFERIDO a Fase 3 (mayor riesgo de invención · recomendación prescriptiva).
 *
 * ADITIVO: este módulo (y el closer) NO lo importa el motor sellado answerADI.js → gate 16/0 intacto.
 * Ver [[adi-contrato-de-respuesta]] (la doctrina) y [[adi-sentrix-diagnose-motor]] (el productor que envuelve). */
export const CONTRACTS = {
  diagnose_value_leak: {
    active: true,
    slots: ["diagnostico", "impacto", "porque", "palanca", "prioridad", "proximo_paso"],
  },
  overview_domain: {
    active: true,    // Fase 2a · vía composeSpecRetrieval (inventario: capital/rotación/DOH por bodega/sku)
    slots: ["lectura_general", "tendencia_volumen", "concentracion_mix", "senales", "riesgo_oportunidad", "siguiente_cruce"],
  },
  rank_business_entity: {
    active: true,    // Fase 2a · vía composeSpecRetrieval (marca/familia/bodega · cliente/sku ya narran por dispatchIntent)
    slots: ["ranking", "patron", "concentracion_anomalia", "advertencia", "siguiente_cruce"],
  },
  dive_entity: {
    active: true,    // Fase 2b · vía composeSpecDive (sku/familia · cliente/marca/bodega ya narran por dispatchIntent)
    slots: ["perfil", "tension", "mecanismo", "impacto", "riesgo_oportunidad", "accion"],
  },
  compare_entities: {
    active: true,    // Fase 2b · vía composeSpecCompare (sku/familia · cliente/marca/bodega ya narran por dispatchIntent)
    slots: ["diferencia_principal", "trade_off", "ganador", "riesgo", "decision"],
  },
  why_mechanism: {
    active: true,    // Fase 3a · operación `why` · reusa el mecanismo determinístico (dispatchIntent) + diagnose/dive
    slots: ["mecanismo", "evidencia", "certeza", "impacto", "palanca"],
  },
  recommend_action: {
    active: true,    // Fase 3b · SOLO recomienda sobre palancas PROBADAS (carga/capital) · si la causa está abierta → recomienda diagnosticar, no una solución inventada
    slots: ["recomendacion", "fundamento", "impacto_esperado", "trade_off", "primer_paso"],
  },
};

// SELECTOR · operación del spec → contractId (reusa el if-chain que ya existe · ver answerADIFromSpec)
export const OPERATION_CONTRACT = {
  diagnose:  "diagnose_value_leak",
  overview:  "overview_domain",
  rank:      "rank_business_entity",
  dive:      "dive_entity",
  compare:   "compare_entities",
  why:       "why_mechanism",
  recommend: "recommend_action",
};
