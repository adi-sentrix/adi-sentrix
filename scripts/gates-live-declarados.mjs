/* === scripts/gates-live-declarados.mjs · LA LISTA DECLARADA DE GATES LIVE (owner 2026-09-01) ================
 *
 * QUÉ ES. Los gates de la raíz que NO corren en `npm run gates:offline` porque hacen (o mencionan) llamadas
 * reales — cada uno con el motivo por el que el clasificador (scripts/clasificarGates.mjs) lo aparta. Esta
 * lista es una DECLARACIÓN CONSCIENTE, no un cache: `_gates_en_la_corrida_gate.mjs` la compara contra la
 * clasificación real y se pone ROJO ante cualquier diferencia, en las dos direcciones.
 *
 * EL INCIDENTE QUE LA ORIGINÓ. Tres gates estuvieron FUERA de la suite y ROJOS desde el 2026-08-21 sin que
 * nadie lo supiera (cb8c25e los devolvió): mencionaban un marcador de red SOLO EN UN COMENTARIO — dos de esos
 * comentarios declaraban textualmente que el gate NO usa la red — y el clasificador los mandó a la lista LIVE,
 * que se imprime al final de la corrida pero nadie compara. Un gate que se apaga en silencio no avisa; esta
 * lista es el aviso.
 *
 * CÓMO SE MANTIENE (a mano, nunca regenerada a ciegas — regenerarla entera taparía exactamente lo que vigila):
 *   · un gate NUEVO que deba ser live → agregá su línea, con el motivo que el clasificador reporta.
 *   · un gate que APARECE como live sin estar acá → NO lo agregues por reflejo: primero mirá si es el caso de
 *     agosto (un marcador que se coló en un comentario — se arregla el comentario, no la lista).
 *   · un gate declarado que VUELVE a la corrida (ganó un escape, o limpió su comentario) → borrá su línea.
 *
 * ⚠️ VIVE EN scripts/ A PROPÓSITO: los motivos nombran marcadores de red, y un gate de la raíz que los nombre
 * queda LIVE él mismo. Acá no se escanea (el clasificador solo lee `_*_gate.mjs` de la raíz). */
export const LIVE_DECLARADOS = [
  { file: "_access_gate.mjs", motivo: "handleNarrate" },
  { file: "_capital_pct_reconciliation_gate.mjs", motivo: "handlePlan" },
  { file: "_compare_vs_gate.mjs", motivo: "handlePlan" },
  { file: "_conversation_continuity_universal_gate.mjs", motivo: "callPlan/callNarrate (inyección del oráculo)" },
  { file: "_correccion_ambigua_vs_resuelta_gate.mjs", motivo: "fetch(" },
  { file: "_count_authorized_gate.mjs", motivo: "callPlan/callNarrate (inyección del oráculo)" },
  { file: "_criterio_oraculo_gate.mjs", motivo: "handlePlan" },
  { file: "_dale_seguimiento_gate.mjs", motivo: "handlePlan" },
  { file: "_decision_table_order_gate.mjs", motivo: "handlePlan" },
  { file: "_elliptic_entity_inheritance_gate.mjs", motivo: "handlePlan" },
  { file: "_entidad_puntual_gate.mjs", motivo: "handlePlan" },
  { file: "_entidad_puntual_ranking_gate.mjs", motivo: "callPlan/callNarrate (inyección del oráculo)" },
  { file: "_fallback_por_forma_gate.mjs", motivo: "callPlan/callNarrate (inyección del oráculo)" },
  { file: "_forma_salida_contrato_gate.mjs", motivo: "fetch(" },
  { file: "_gate_hardening_certification_gate.mjs", motivo: "handlePlan" },
  { file: "_gateway_causa_y_costo_gate.mjs", motivo: "handlePlan" },
  { file: "_inventory_diagnostico_mode_gate.mjs", motivo: "endpoint /api/adi-*" },
  { file: "_lectura_minima_gate.mjs", motivo: "handlePlan" },
  { file: "_ledger_entity_attribution_gate.mjs", motivo: "handlePlan" },
  { file: "_llm_rate_limit_backoff_gate.mjs", motivo: "proveedor/credencial (OpenAI)" },
  { file: "_margin_orden_sellado_gate.mjs", motivo: "handlePlan" },
  { file: "_mint_grant_gate.mjs", motivo: "gatewayCore" },
  { file: "_model_router_gate.mjs", motivo: "handlePlan" },
  { file: "_narrate_structural_reinforcement_gate.mjs", motivo: "handlePlan" },
  { file: "_oracle_clarify_mode_gate.mjs", motivo: "handlePlan" },
  { file: "_oracle_conversational_contract_gate.mjs", motivo: "gatewayCore" },
  { file: "_oracle_mechanism_gate.mjs", motivo: "handlePlan" },
  { file: "_oracle_mechanism_memory_gate.mjs", motivo: "callPlan/callNarrate (inyección del oráculo)" },
  { file: "_oracle_multiempresa_gate.mjs", motivo: "callPlan/callNarrate (inyección del oráculo)" },
  { file: "_oracle_multimodo_gate.mjs", motivo: "handlePlan" },
  { file: "_oracle_order_gate.mjs", motivo: "handlePlan" },
  { file: "_oracle_plan_gate.mjs", motivo: "handlePlan" },
  { file: "_oracle_plan_retry_gate.mjs", motivo: "adapter de proveedor" },
  { file: "_oracle_provider_certification_gate.mjs", motivo: "gatewayCore" },
  { file: "_oracle_simulateCosto_gate.mjs", motivo: "handlePlan" },
  { file: "_oracle_tension_gate.mjs", motivo: "handlePlan" },
  { file: "_oracle_tension_vocab_gate.mjs", motivo: "callPlan/callNarrate (inyección del oráculo)" },
  { file: "_orden_sellado_gate.mjs", motivo: "handlePlan" },
  { file: "_periodo_declarado_gate.mjs", motivo: "handlePlan" },
  { file: "_periodo_hoy_campo_gate.mjs", motivo: "callPlan/callNarrate (inyección del oráculo)" },
  { file: "_placeholder_calls_gate.mjs", motivo: "callPlan/callNarrate (inyección del oráculo)" },
  { file: "_precedencia_de_forma_gate.mjs", motivo: "fetch(" },
  { file: "_ratelimit_gate.mjs", motivo: "endpoint /api/adi-*" },
  { file: "_reentry_evidence_gate.mjs", motivo: "endpoint /api/adi-*" },
  { file: "_referencia_de_criterio_gate.mjs", motivo: "fetch(" },
  { file: "_reintento_economico_gate.mjs", motivo: "fetch(" },
  { file: "_repair_decision_clarify_gate.mjs", motivo: "callPlan/callNarrate (inyección del oráculo)" },
  { file: "_response_contract_parte2_gate.mjs", motivo: "callPlan/callNarrate (inyección del oráculo)" },
  { file: "_response_preference_gate.mjs", motivo: "handlePlan" },
  { file: "_ruta_deterministica_gate.mjs", motivo: "handlePlan" },
  { file: "_scenario_no_entity_recentsubjects_gate.mjs", motivo: "callPlan/callNarrate (inyección del oráculo)" },
  { file: "_sin_credito_detiene_gate.mjs", motivo: "fetch(" },
  { file: "_solo_acento_gate.mjs", motivo: "callPlan/callNarrate (inyección del oráculo)" },
  { file: "_table_format_gate.mjs", motivo: "handlePlan" },
  { file: "_tool_contracts_gate.mjs", motivo: "callPlan/callNarrate (inyección del oráculo)" },
  { file: "_topn_resto_gate.mjs", motivo: "handlePlan" },
  { file: "_trend_vs_puntual_gate.mjs", motivo: "handlePlan" },
  { file: "_vague_offer_gate.mjs", motivo: "dominio desplegado" },
];
