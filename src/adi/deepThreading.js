// deepThreading.js · helper layer para multi-turn deep threading
// (investigation context + causal cause snapshot).
// Extraído VERBATIM de 41cc33d8 · valores byte-idénticos · cero recálculo.
// Único cambio vs monolito: `export ` en las 3 funciones + imports ES module.

import { VOICE_D1_CAUSE_ENABLED } from "../config/voiceFlags.js";
import { getEntityById } from "./router.js";  // resuelve _d1fResolveEntityName (ID→nombre canónico vía EntityRegistry)

// PATTERN_MAP · contrato v1 reasoningPattern → dominio + métrica
const PATTERN_MAP = {
  "capital_trapped_low_rotation":         { domain: "inventario", metric: "capital_inmovilizado" },
  "high_rotation_high_margin":            { domain: "inventario", metric: "contribucion" },
  "intermediate_operational":             { domain: "inventario", metric: "capital_inmovilizado" },
  "high_sales_low_contribution_via_load": { domain: "margenes",   metric: "contribucion" },
  "high_margin_low_load_with_upside":     { domain: "margenes",   metric: "contribucion" },
  "portfolio_dual_efficiency_contrast":   { domain: "inventario", metric: "contribucion" },
  // CONT.1-HOTFIX · investigación de cliente escribe foco (antes quedaba null → fallback)
  "client_deep_dive":                     { domain: "margenes",   metric: "contribucion" },
  // "contextual_drilldown_by_dimension" → no aparece aquí · preserva goal existente
};

// INTENT_TO_INVESTIGATION · fallback por intent type cuando no hay contrato v1
const INTENT_TO_INVESTIGATION = {
  "fuga_distribuida":           { domain: "inventario", metric: "capital_inmovilizado" },
  "sku_operational":            { domain: "inventario", metric: "capital_inmovilizado" },
  "sku_operational_query":      { domain: "inventario", metric: "capital_inmovilizado" },
  "product_contribution":       { domain: "inventario", metric: "contribucion" },
  "product_contribution_query": { domain: "inventario", metric: "contribucion" },
  // BRIEF #29 · cross_domain_query con archetype fuga_distribuida es
  // semánticamente cross-domain · mapear a inventario por intención del
  // usuario ("plata muerta" ≡ capital).
  "cross_domain_query":         { domain: "inventario", metric: "capital_inmovilizado" },
  "mechanism_explore_erosion":  { domain: "margenes",   metric: "contribucion" },
  "mechanism_explore_quality":  { domain: "margenes",   metric: "contribucion" },
  "client_dive":                { domain: "margenes",   metric: "contribucion" },
  "client":                     { domain: "margenes",   metric: "contribucion" },
  "client_followup":            { domain: "margenes",   metric: "contribucion" },
  "profitability_gap":          { domain: "margenes",   metric: "contribucion" },
  // BRIEF #39 · rotation_dive y coverage_dive · operacionales inventario
  "rotation_dive":              { domain: "inventario", metric: "rotacion" },
  "coverage_dive":              { domain: "inventario", metric: "doh" },
  // BRIEF #40 · warehouse_dive · operacional inventario con métrica capital
  "warehouse_dive":             { domain: "inventario", metric: "capital_inmovilizado" },
  // BRIEF #46 · client_contribution_ranking · ranking cliente por contribución
  "client_contribution_ranking": { domain: "margenes", metric: "contribucion" },
};

// PATTERN_TO_GOAL · contrato v1 reasoningPattern → criterio de optimización
const PATTERN_TO_GOAL = {
  "capital_trapped_low_rotation":         "liberar_capital",
  "high_rotation_high_margin":            "maximizar_contribucion",
  "intermediate_operational":             "entender_problema",
  "high_sales_low_contribution_via_load": "recuperar_margen",
  "high_margin_low_load_with_upside":     "maximizar_contribucion",
  "portfolio_dual_efficiency_contrast":   "proteger_rentabilidad",
};

// INTENT_TO_GOAL · fallback por intent type
const INTENT_TO_GOAL = {
  // Modo problema · liberar capital
  "fuga_distribuida":           "liberar_capital",
  "sku_operational":            "liberar_capital",
  "sku_operational_query":      "liberar_capital",
  // Modo problema · recuperar margen
  "mechanism_explore_erosion":  "recuperar_margen",
  "profitability_gap":          "recuperar_margen",
  "client_dive":                "recuperar_margen",
  // Modo problema · maximizar contribución
  "product_contribution":       "maximizar_contribucion",
  "product_contribution_query": "maximizar_contribucion",
  "mechanism_explore_quality":  "maximizar_contribucion",
  // Modo oportunidad
  "growth_opportunity":         "maximizar_contribucion",
  // Modo protección
  "product_dual_comparison":    "proteger_rentabilidad",
  // Default cross-domain
  "cross_domain_query":         "liberar_capital",
  // BRIEF #39 · diagnóstico neutral / liberación
  "rotation_dive":              "entender_problema",
  "coverage_dive":              "liberar_capital",
  // BRIEF #40 · cold-start neutral
  "warehouse_dive":             "entender_problema",
  // BRIEF #46 · ranking cliente por contribución · objetivo maximizar
  "client_contribution_ranking": "maximizar_contribucion",
};

// applyInvestigationContext · helper puro para poblar el contexto de investigación.
// Aplicado en ambos sitios (handleUserSubmit + handleCognitiveAction) idénticamente.
//
// Argumentos:
//   next                   · objeto mutable con state derivado (modificado in-place y retornado)
//   derivedIntentType      · string intent type (o null)
//   lastComposerResponse   · contrato v1 si aplica (o null)
//   concepts               · array de concepts del semantic layer (para override F2)
//
// Orden de aplicación:
//   1. Si reasoningPattern === "contextual_drilldown_by_dimension" → preservar (no tocar)
//   2. PATTERN_MAP (contrato v1) > INTENT_TO_INVESTIGATION (fallback)
//   3. PATTERN_TO_GOAL > INTENT_TO_GOAL
//   4. OVERRIDE goal F2 action_liberate: si concepts incluye action_liberate_canonical,
//      goal = liberar_capital (manda sobre los mapeos · acción ejecutiva del usuario).
export function applyInvestigationContext(next, derivedIntentType, lastComposerResponse, concepts) {
  const pattern = lastComposerResponse?.responseObjectVersion === "v1"
    ? lastComposerResponse.reasoningPattern
    : null;

  // Continuación de investigation (drilldown) preserva state existente
  if (pattern === "contextual_drilldown_by_dimension") return next;

  // 1. PATTERN_MAP preferente · 2. INTENT_TO_INVESTIGATION fallback
  if (pattern && PATTERN_MAP[pattern]) {
    next.investigationDomain     = PATTERN_MAP[pattern].domain;
    next.investigationMetric     = PATTERN_MAP[pattern].metric;
    next.investigationHypothesis = lastComposerResponse.focus || null;
    next.investigationLastIntent = derivedIntentType || null;
  } else if (derivedIntentType && INTENT_TO_INVESTIGATION[derivedIntentType]) {
    next.investigationDomain     = INTENT_TO_INVESTIGATION[derivedIntentType].domain;
    next.investigationMetric     = INTENT_TO_INVESTIGATION[derivedIntentType].metric;
    next.investigationHypothesis = null;
    next.investigationLastIntent = derivedIntentType;
  }
  // 3. Sin matcheo · NO tocar investigation context (preservar)

  // BRIEF #27-bis · poblar investigationGoal con misma prioridad
  if (pattern && PATTERN_TO_GOAL[pattern]) {
    next.investigationGoal = PATTERN_TO_GOAL[pattern];
  } else if (derivedIntentType && INTENT_TO_GOAL[derivedIntentType]) {
    next.investigationGoal = INTENT_TO_GOAL[derivedIntentType];
  }

  // BRIEF #37 v2 · OVERRIDE goal F2 action_liberate
  // Si el usuario explicitó "liberar/recuperar/destrabar/soltar" (canonical
  // __action_liberate__ activó como signal de loss_explicit), la acción
  // ejecutiva del usuario manda sobre el goal inferido por intent type.
  // BRIEF #42 · ahora también aplica en sitio 2 (handleCognitiveAction)
  // como consecuencia incidental positiva de la consolidación (deuda
  // anotada en #37 v2 cerrada).
  if (Array.isArray(concepts) && concepts.length > 0) {
    const lossExplicitConcept = concepts.find(c => c.type === "loss_explicit");
    if (lossExplicitConcept?.signals_matched_types?.includes("action_liberate_canonical")) {
      next.investigationGoal = "liberar_capital";
    }
  }

  // BRIEF EVIDENCIA1 (ARCO B) · CAPTURA del núcleo de razonamiento · ADITIVO · NO recalcula · NO toca los 51 mapeos.
  // Sube a investigationContext lo que el composer YA produjo (clientList/materialMetrics) para servir la
  // evidencia del último análisis en CUALQUIER hilo. Honestidad: si no hay nada que capturar, NO toca (preserva);
  // lo capturado declara su derivabilidad (entidades/cifras) · cero invención.
  if (lastComposerResponse && (lastComposerResponse.clientList || lastComposerResponse.materialMetrics || lastComposerResponse.entities)) {
    const _entName = (id) => {
      if (typeof id !== "string") return null;
      try { const e = (typeof EntityRegistry !== "undefined") && EntityRegistry.entities && EntityRegistry.entities[id]; if (e && e.canonical_name) return e.canonical_name; } catch (_e) {}
      const raw = id.replace(/^[a-z]+_/, "").replace(/_/g, " ");                  // fallback lossy · solo nombres simples
      return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : null;
    };
    // RETRIEVALFIX (ARCO B) · capturar entidades de AMBAS fuentes: clientList (preferente, ruta
    // composeClientContributionRanking) o entities (fallback, ruta REAL composeRetrieval L23186).
    // composeRetrieval expone `entities` (no clientList) → sin esto la captura nunca veía el ranking
    // que el usuario realmente dispara → investigationEntidades=undefined → "cuáles son" → fallback.
    const _rawEnts = (Array.isArray(lastComposerResponse.clientList) && lastComposerResponse.clientList.length)
                       ? lastComposerResponse.clientList
                       : (Array.isArray(lastComposerResponse.entities) ? lastComposerResponse.entities : []);
    const _ents = _rawEnts.map(_entName).filter(Boolean);
    const _evi  = (lastComposerResponse.materialMetrics != null) ? lastComposerResponse.materialMetrics : null;
    next.investigationEntidades = _ents;
    next.investigationEntityDim = lastComposerResponse.entityDim || null;   // RETRIEVALFIX · sustantivo (cliente/sku/familia/marca)
    next.investigationSubtema   = derivedIntentType || null;
    next.investigationEvidencia = _evi;
    next.investigationDerivable = { entidades: _ents.length > 0, cifras: !!(Array.isArray(_evi) ? _evi.length : _evi) };
    next.investigationTurn      = (typeof next.turnCount === "number") ? next.turnCount : 0;
  }

  return next;
}

// resuelve como ID en el Registry S.A (getEntityById · API pública READ-ONLY ·
// L42071) → canonical_name user-facing. Si no resuelve (nombre real, basura,
// registry apagado) → pasa INTACTO. Defensivo total: cero mutación del Registry,
// cero throw al flujo, lista mixta soportada vía .map().
export function _d1fResolveEntityName(s) {
  if (typeof s !== "string" || !s) return s;
  try {
    const e = (typeof getEntityById === "function") ? getEntityById(s) : null;
    if (e && typeof e.canonical_name === "string" && e.canonical_name) return e.canonical_name;
  } catch (err) { /* defensivo · read-only · nunca rompe el flujo */ }
  return s;
}

// ═══ BRIEF D1.a/b/c · CONTINUIDAD DE CAUSA (D-D1-1..7 firmadas · diseño D1.1) ═══
// Tras un hallazgo, "¿por qué?" (y variantes del catálogo cause_query) sirve la CAUSA
// que el motor computó EN EL TURNO DEL HALLAZGO · cifras persistidas en finding.cause ·
// CERO recompute (I1). off = byte-idéntico D1.F (detector null → flujo intacto · I2/I4).
// VOICE_D1_CAUSE_ENABLED importado de voiceFlags.js (byte-idéntico = true)

// ── _D1_PATTERN_TO_DRIVER · catálogo estático régimen 2 (mapeo evidence→cause) ──
// UNA entrada con materia prima real (pre-flight D1 aprobado): quality_growth y
// customer_dependency NO exponen evidence/reasoningPattern al write (objeto plano
// pre-contrato-v1 · H-D1-1 · deuda #D-D1-QUALITY-DEPENDENCY-SIN-CONTRATO-V1) →
// cause null → salida 2 honesta anclada (D-D1-1). Cada *_field referencia un key
// de lcr.evidence YA presente al write · cero recompute.
const _D1_PATTERN_TO_DRIVER = {
  high_sales_low_contribution_via_load: {
    driver_key: "commercial_erosion",          // alineado DRIVER_CANONICAL_KEYS
    factor: "carga_comercial",
    value_field: "carga_actual",               // % · ej. 4.5
    unit: "%",
    vs: { type: "best_practice", ref_field: "best_practice_carga", gap_field: "gap_carga_pp" },
    target_field: "cliente_principal",
    narrable_fields: ["carga_actual", "gap_carga_pp", "best_practice_carga",
                      "recuperable_principal_USD", "recuperable_agregado_K",
                      "margen_pct", "benchmark_margen", "top3_clientes"],
  },
};

// ── _d1ExtractCause(lcr) · D1.a · snapshot del driver YA computado este turno ──
// Régimen 1 (copy): lcr.narrative_signals.why.driver (ranking_extremes · cross_metric).
// Régimen 2 (map): lcr.evidence + reasoningPattern vía _D1_PATTERN_TO_DRIVER.
// Resto → null explícito (retrieval/overviews/sku_operational/client-dive D-MB3-1/
// quality/dependency H-D1-1). Defensivo total · null en duda · cero throw.
export function _d1ExtractCause(lcr) {
  try {
    if (!lcr || typeof lcr !== "object") return null;
    const _why = lcr.narrative_signals && lcr.narrative_signals.why;
    const _drv = _why && _why.driver;
    if (_drv && _drv.factor) {
      return {
        source: "why_signal",
        driver_key: _drv.mechanism || null,
        factor: _drv.factor,
        value: (typeof _drv.value === "number") ? _drv.value : null,
        unit: _drv.unit || null,
        vs: {
          type: "promedio_interno",
          vs_promedio: (typeof _drv.vs_promedio === "number") ? _drv.vs_promedio : null,
          vs_benchmark: (typeof _drv.vs_benchmark === "number") ? _drv.vs_benchmark : null,
        },
        target_entity: _why.target_entity || _drv.target_entity || null,
        fields: {
          chain: Array.isArray(_drv.chain) ? _drv.chain.slice() : null,
          borderline: !!_drv.borderline,
        },
      };
    }
    const _map = lcr.reasoningPattern && _D1_PATTERN_TO_DRIVER[lcr.reasoningPattern];
    const _ev = lcr.evidence;
    if (_map && _ev && typeof _ev === "object") {
      const _val = _ev[_map.value_field];
      if (typeof _val !== "number") return null; // sin cifra central no hay causa narrable · honest null
      const _fields = {};
      for (const k of _map.narrable_fields) { if (_ev[k] != null) _fields[k] = _ev[k]; }
      return {
        source: "evidence_mapping",
        driver_key: _map.driver_key,
        factor: _map.factor,
        value: _val,
        unit: _map.unit,
        vs: {
          type: _map.vs.type,
          ref: (_ev[_map.vs.ref_field] != null) ? _ev[_map.vs.ref_field] : null,
          gap: (_ev[_map.vs.gap_field] != null) ? _ev[_map.vs.gap_field] : null,
        },
        target_entity: _ev[_map.target_field] || null,
        fields: _fields,
      };
    }
    return null;
  } catch (e) { return null; }
}
