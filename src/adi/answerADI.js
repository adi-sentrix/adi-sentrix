/* === src/adi/answerADI.js · API PÚBLICA del ADI conversacional ===
 * answerADI(question, context, state) → { text, intent, route, suggestions, sentrixAction, context }
 * Determinística, sin UI. Extrae la ORQUESTACIÓN de PanelADI (D5 · rama por rama).
 *
 * Orden (replica PanelADI): inverse → early gate → detectIntent + dispatch → guard de
 * número → capa tardía → not_yet_extracted.
 *
 * Capas transversales aplicadas a la respuesta (replica unified pipeline):
 *   · ECL voice-polish      (applyVoiceContract · PanelADI L38287)
 *   · Suffix proactivo      (observación aditiva · PanelADI L38489-38502 · gate de sesión)
 * La inversa NO pasa por estas capas (corre ANTES del punto de suffix en el piso · L35500).
 */
import { resolveIntentLayerEarly, resolveIntentLayer } from "./intentLayer.js";
import { normalizeText } from "./helpers.js";
import { detectIntent, detectAllFamiliesInText, detectAllWarehousesInText } from "./router.js";
import { detectBrandInText, detectClientInText } from "./detectors.js";  // ADI Core · Escape 1 · filtro marca/familia + 2.2a-2 cliente nombrado
import { composeBrandDive } from "./composers/brand.js";
import { composeWarehouseComparison, composeWarehouseAnalysis } from "./composers/warehouse.js";
import { composeClientComparison, composeBrandComparison } from "./composers/comparisons.js";
import { executiveLanguageDetector, queryInterpreter, composeRetrieval, QI_METRIC_VOCAB, QI_DIMENSION_VOCAB } from "./composers/qiRetrieval.js";
import { resolveDimensionalSuperlative, resolveFilteredRetrieval, resolveInventoryRetrieval } from "./core/spine.js";  // ADI Core · Fase 2.1a/b · spine · 2.5a inventario
import { isAvailable, unavailableMessage } from "./core/availabilityMap.js";  // ADI Core · Fase 2.2a · anti-fuga · guardrail de continuación (R4 + MODE 2)
import { detectAnomalyIntent, detectOpportunityIntent, detectExplorationIntent } from "./composers/d0Cascade.js";
import { composeClientMetricFollowUp } from "./composers/followups.js";
import { applyInvestigationContext, _d1ExtractCause, _d1fResolveEntityName } from "./deepThreading.js";
import { eclContIsPureContinuation, composeSkuDevelopment } from "./eclCont.js";
import { composeModuleOverview } from "./composers/overview.js";
import { composeSmartGuide } from "./composers/smartGuide.js";   // fix demo-readiness · "se adueña de la conversación"
import { composeHonestyGuard } from "./composers/honestyGuard.js";   // GAP 1 · guard de honestidad ante lo imposible
import { buildSentrixBoleta } from "./sentrix/boleta.js";        // Etapa 5 · Sentrix S1 · boleta universal availability-driven
import { buildReadingFromSignals, buildSkuMarginSignals } from "./sentrix/reading.js";    // Etapa 5 · Sentrix · pipeline único de lectura ejecutiva
import { extractInverseProjection, composeInverseProjection } from "./composers/inverse.js";
import { extractMarginSimulation, extractLossSimulation, extractGrowthSimulation, extractPriceSimulation, buildSimulationState, compareStates, composeSimulationDelta, composeGrowthProjection, composePriceLever } from "./composers/simulation.js";
import { detectRankingExtremesIntent, composeRankingExtremes, _buildScopeForMetric, _rwmDetectPrincipalAnexa } from "./composers/ranking.js";
import { getClientDeepDive, getResponseContext } from "./composers/clientDive.js";
import { composeMechanismResponse } from "./composers/mechanisms.js";
import { composeCrossDomainResponse } from "./composers/crossDomain.js";
import { composeClientContributionRanking } from "./composers/contribution.js";
import { composeSkuOperationalAnalysis } from "./composers/skuOperational.js";
import { composeGlobalHonestFallback } from "./composers/honestFallback.js";
import { composeExecutiveReport, composeExecutiveReportNarrative } from "./composers/executiveReport.js";
import { applyVoiceContract } from "./voiceContract.js";
import { virtuousExceptionSuffix } from "./proactive.js";
import { detectRceTier, executiveThesisLineGenerator } from "./etlg.js";
import { _isExplicitModuleOverviewQuery, _isBareModuleWord } from "./overviewGate.js";
import { dispatchNarrativeComposer, selectPosture, applyVoiceCalibration } from "./narrativeLayer.js";
import { VOICE_NARRATIVE_LAYER_ENABLED } from "../config/voiceFlags.js";
import { RANKING_EXTREMES_METRICS } from "../config/rankingData.js";
import { VOICE_RANKING_EXTREMES_ENABLED, ADI_RANKING_WITH_METRICS_ENABLED, ADI_ECL_VOICE_POLISH_ENABLED, VOICE_GLOBAL_HONEST_FALLBACK_ENABLED, ADI_BARE_MODULE_OVERVIEW_ENABLED, ADI_D0A_ANOMALY_ROUTER_ENABLED, ADI_D0B_OPPORTUNITY_ROUTER_ENABLED, ADI_D0C_EXPLORATION_ROUTER_ENABLED, ADI_CTX_THREADING_ENABLED, ADI_FOLLOWUP_CLIENT_METRIC_ENABLED, VOICE_ACTIVE_RESULT_ENABLED, VOICE_DEUDA_J_ENABLED, VOICE_D1_CAUSE_ENABLED, VOICE_D1F_ENTITY_SANITIZE_ENABLED, ADI_ECL_CONT_FOLLOWUP_ENABLED, VOICE_R4_SKU_DEV_ENABLED, ADI_QI_FILTER_ENABLED, ADI_MT_SAFETY_ENABLED, ADI_MT_INV_COVERAGE_ENABLED, ADI_MT_TOPIC_CLEAN_ENABLED, ADI_MT_SPINE_FOLLOWUP_ENABLED, ADI_MT_REFINE_METRIC_ENABLED, ADI_MT_REFINE_FILTER_ENABLED, ADI_MT_REFINE_CUT_ENABLED, ADI_SMART_GUIDE_ENABLED, ADI_SIM_SCOPE_FOLLOWUP_ENABLED, ADI_SENTRIX_BOLETA_ENABLED, ADI_SENTRIX_READING_ENABLED, ADI_HONESTY_GUARD_ENABLED } from "../config/voiceFlags.js";
import { FEATURE_INTENT_LAYER, FEATURE_INTENT_LAYER_EARLY, FEATURE_BRAND_AS_ENTITY, FEATURE_ENTITY_COMPARISON, FEATURE_INVERSE_PROJECTION, FEATURE_WAREHOUSE_AS_ENTITY, FEATURE_GROWTH_PROJECTION, FEATURE_PRICE_LEVER } from "../config/features.js";

// ── _finalize · capas transversales sobre la respuesta (ECL polish + suffix proactivo) ──
// Replica el unified pipeline: applyVoiceContract (L38287) → observación aditiva (L38489-38502).
// El suffix lleva el gate de sesión observationEmittedScenario (una vez por escenario · multi-turno).
function _finalize(resp, route, intentLabel, ctx, scenario, intent) {
  let text = resp.opener;
  // ── Capa narrativa (FASE 5 · replica PanelADI L38177-38207) ──
  // Dispara cuando el composer expone narrative_signals (el piso lo hace cuando el dispatch setea
  // lastComposerResponse: ranking/sku/mechanism/executive SÍ · client_dive NO · verificado ESTÁTICO
  // single-turn Y multi-turno). Reescribe el opener · y SALTEA ETLG + ECL (narrativeLayerHandled).
  let _narrativeHandled = false;
  if (typeof VOICE_NARRATIVE_LAYER_ENABLED !== "undefined" && VOICE_NARRATIVE_LAYER_ENABLED && resp.narrative_signals) {
    try {
      const _sig = resp.narrative_signals;
      const _posture = resp.posture_hint || selectPosture(intent && intent.type, _sig, ctx);
      const _narr = dispatchNarrativeComposer(_sig, _posture, ctx);
      if (_narr && _narr.length > 0) {
        const _cal = applyVoiceCalibration(_narr, _posture);
        if (_cal && _cal.length > 0) { text = _cal; _narrativeHandled = true; }
      }
    } catch (e) { /* fail-safe · opener legacy intacto */ }
  }
  // Capa 2a · ETLG lead · prepend ANTES de ECL (replica PanelADI L38218-38241) · SKIP si narrativa aplicó.
  // Solo rutas con `intent` (dispatch · tier ferrari). Las overview module_overview (early/late)
  // reciben intent solo cuando _overviewLeadIntent matchea (predicado verificado 23/23).
  if (!_narrativeHandled && intent && text) {
    const _tier = detectRceTier(intent.type, intent.type, null);
    if (_tier === "ferrari" || _tier === "module_overview") {
      const _meta = {
        intent_id: (intent._semantic_meta && intent._semantic_meta.intent_id) || null,
        intent_type: intent.type || null,
        archetype: (intent.crossDomain && intent.crossDomain.archetype) || null,
        concepts: (intent._semantic_meta && intent._semantic_meta.concepts) || [],
        modulo: intent.modulo || null,
        client_name: intent.clientName || null,
        tier: _tier,
      };
      const _etlg = executiveThesisLineGenerator({ opener: text, suggestions: resp.suggestions, sentrixAction: resp.sentrixAction }, _meta, scenario);
      if (_etlg && _etlg.shouldApply === true && typeof _etlg.thesisLine === "string" && _etlg.thesisLine.length > 0) {
        text = _etlg.thesisLine + "\n\n" + text;
        // Lead module_overview: el piso lo rutea por composeModuleOverview directo (SIN el _confLine que
        // _routeIntentToComposer agrega en el early-gate/late-layer modular). Remover "Confianza determinística: alta."
        // solo en los lead-cases module_overview (los honest-fallback la conservan · ventas).
        if (_tier === "module_overview") {
          text = text.replace("\n\nConfianza determinística: alta.", "");
        }
      }
    }
  }
  // Capa ECL · voice-polish (el applier ignora tier/scenario · reemplazo puro) · SKIP si narrativa aplicó
  if (!_narrativeHandled && typeof ADI_ECL_VOICE_POLISH_ENABLED !== "undefined" && ADI_ECL_VOICE_POLISH_ENABLED && text) {
    const vr = applyVoiceContract(text, { scenario });
    if (vr && vr.shouldApply === true && typeof vr.transformedOpener === "string" && vr.transformedOpener.length > 0) {
      text = vr.transformedOpener;
    }
  }
  // Capa 3 · observación aditiva (suffix) · gate de sesión (calla si ya se observó este escenario)
  // ADI Core · Fix B · OMITIR el suffix cuando la respuesta está FILTRADA (resp._filtered): lee el
  // portafolio GLOBAL (ej "Mercado Libre", fuera del filtro Samsung) y no puede probar que respeta el
  // filtro → principio: capa de contexto global se omite si la respuesta está scopeada. NO consume el
  // gate de sesión (no setea observationEmittedScenario) → un turno NO-filtrado posterior sí lo emite.
  const nextCtx = { ...ctx, turnCount: (ctx.turnCount || 0) + 1 };
  // ADI Core · Cabo 1 · suffix proactivo "un punto que no saliste a buscar" APAGADO con flag ON (sobrio ·
  // no menciona un cliente global fuera del análisis pedido). NO consume el gate de sesión → consistente
  // (un turno posterior tampoco lo emite). Flag OFF → comportamiento del piso byte-exacto (suffix presente).
  if (!ADI_QI_FILTER_ENABLED && text && ctx.observationEmittedScenario !== scenario && !(resp && resp._filtered)) {
    const sfx = virtuousExceptionSuffix(scenario);
    if (sfx) { text = text + "\n\n" + sfx; nextCtx.observationEmittedScenario = scenario; }
  }
  // ── Fase 0 · THREADING de contexto conversacional (replica FINALIZE piso L38517-38556) ──
  // Persiste memoria de entidad/módulo para que los detectores de follow-up (ya en router.js)
  // tengan qué leer en el turno siguiente. Single-turn (47): sin memoria previa, los detectores
  // devuelven null → cero efecto. Solo escribe campos con valor nuevo (no sobrescribe con null).
  if (ADI_CTX_THREADING_ENABLED) {
    _threadContext(nextCtx, intent, resp, route);
  }
  return {
    text,
    suggestions: (resp.suggestions && resp.suggestions.length) ? resp.suggestions : null,
    sentrixAction: _gateInvCTA(resp.sentrixAction),
    intent: intentLabel,
    route,
    context: nextCtx,
    // Etapa 5 · Sentrix S1 · boleta UNIFORME en TODA respuesta comercial (cierra el gap: _finalize no surfaceaba
    // evidence). Flag OFF → sin campo (byte-exacto). Normaliza ranking_*/intent → entidad/métrica + availability.
    ...(ADI_SENTRIX_BOLETA_ENABLED ? { evidence: buildSentrixBoleta(resp, intent, route, scenario) } : {}),
  };
}

// ── _threadContext · escribe memoria de entidad/módulo/lista en nextCtx (Fase 0 · raíz multi-turno) ──
// Replica el subset del FINALIZE del piso (L38521-38556) que alimenta los detectores de follow-up.
// derivedClient = intent.clientName (client_dive) | intent.clientB (comparación · último pasa a ser B).
// Listas desde sentrixAction.payload (clientes/skus). Freshness por turnCount (lastXTurn).
function _threadContext(nextCtx, intent, resp, route) {
  if (intent) {
    const _dClient = intent.clientName || intent.clientB || null;
    if (_dClient) { nextCtx.lastClientMentioned = _dClient; nextCtx.lastClientMentionedTurn = nextCtx.turnCount; }
    const _dSku = intent.skuName || null;
    if (_dSku) { nextCtx.lastSkuMentioned = _dSku; nextCtx.lastSkuMentionedTurn = nextCtx.turnCount; }
    if (intent.modulo) nextCtx.lastModuleAsked = intent.modulo;
  }
  const _payload = resp && resp.sentrixAction && resp.sentrixAction.payload;
  if (_payload) {
    if (Array.isArray(_payload.clientes) && _payload.clientes.length > 0) { nextCtx.lastClientList = _payload.clientes; if (ADI_MT_SAFETY_ENABLED) nextCtx.lastClientListTurn = nextCtx.turnCount; }
    if (Array.isArray(_payload.skus) && _payload.skus.length > 0) { nextCtx.lastSkuList = _payload.skus; if (ADI_MT_SAFETY_ENABLED) nextCtx.lastSkuListTurn = nextCtx.turnCount; }
  }
  // QI populates context (replica piso L37302-37314) · entities/entityDim de composeRetrieval ·
  // override de módulo (cliente→margenes · sku→inventario) para el deepContext del dive deíctico.
  if (resp && Array.isArray(resp.entities) && resp.entities.length >= 2) {
    if (resp.entityDim === "cliente") { nextCtx.lastClientList = resp.entities; nextCtx.lastModuleAsked = "margenes"; if (ADI_MT_SAFETY_ENABLED) nextCtx.lastClientListTurn = nextCtx.turnCount; }
    else if (resp.entityDim === "sku" || resp.entityDim === "producto") { nextCtx.lastSkuList = resp.entities; nextCtx.lastModuleAsked = "inventario"; if (ADI_MT_SAFETY_ENABLED) nextCtx.lastSkuListTurn = nextCtx.turnCount; }
  }

  // ── FASE R · CAPA PROFUNDA · A→B→C en ESTE updater (replica FINALIZE piso L38588-38710) ──
  // Trampa #1: A (applyInvestigationContext) ANTES de B (R1) sobre el MISMO nextCtx · R1 lee
  // nextCtx.investigationDomain/Metric que A acaba de poblar. NO separar, NO clonar nextCtx entre medio.
  // Derivación per-ruta de _lcr (verificada contra _deep_trace.json): LOCKED (lcr=null) en client/QI/sku_operational.
  if (VOICE_ACTIVE_RESULT_ENABLED) {
    try {
      const _locked = route === "client_dive" || route === "qi_retrieval" || route === "sku_operational";
      const _lcr = _locked ? null : (resp || null);
      const _dit = route === "qi_retrieval" ? "query_interpreter"
                 : route === "sku_operational" ? "global_honest_fallback"
                 : ((intent && intent.type) || route || null);
      const _isQi = route === "qi_retrieval" && resp;
      const _dInvEnts = _isQi && Array.isArray(resp.entities) ? resp.entities : null;
      const _dInvEntDim = _isQi ? (resp.entityDim || null) : null;
      const _dInvMetrics = _isQi ? (resp.materialMetrics != null ? resp.materialMetrics : null) : null;
      const _dClient = (intent && (intent.clientName || intent.clientB)) || null;  // clientB · comparación: último pasa a ser B (piso L37388)
      const _dSku = (intent && intent.skuName) || null;
      // ── A · applyInvestigationContext (con _lcrForInvestigation synthetic · piso L38594) ──
      const _lcrForInv = _lcr || ((Array.isArray(_dInvEnts) && _dInvEnts.length)
        ? { entities: _dInvEnts, entityDim: _dInvEntDim, materialMetrics: _dInvMetrics } : null);
      applyInvestigationContext(nextCtx, _dit, _lcrForInv, null);
      // ── B · R1 activeResult writer (cascada verbatim piso L38643-38690) ──
      const _lcrR1 = _lcr || {};
      const _pay = (_lcrR1.sentrixAction && _lcrR1.sentrixAction.payload) || {};
      const _evEnts = _lcrR1.evidence && (_lcrR1.evidence.ranking_entities || _lcrR1.evidence.cross_metric_set);
      const _typeMap = { client: "cliente", cliente: "cliente", sku: "sku", familia: "familia", marca: "marca" };
      let _ents = null, _etype = (intent && _typeMap[intent.entityType]) || null;
      if (_lcrR1.clientList && _lcrR1.clientList.length) { _ents = _lcrR1.clientList; _etype = _etype || "cliente"; }
      else if (_lcrR1.skuList && _lcrR1.skuList.length) { _ents = _lcrR1.skuList; _etype = _etype || "sku"; }
      else if (_pay.clientes && _pay.clientes.length) { _ents = _pay.clientes; _etype = _etype || "cliente"; }
      else if (_pay.skus && _pay.skus.length) { _ents = _pay.skus; _etype = _etype || "sku"; }
      else if (_dInvEnts && _dInvEnts.length) { _ents = _dInvEnts; _etype = _typeMap[_dInvEntDim] || _etype; }
      else if (Array.isArray(_evEnts) && _evEnts.length) { _ents = _evEnts; }
      else if (_dClient) { _ents = [_dClient]; _etype = _etype || "cliente"; }
      else if (_dSku) { _ents = [_dSku]; _etype = _etype || "sku"; }
      if (_ents && _ents.length) {
        let _names = _ents
          .map(e => typeof e === "string" ? e : (e && (e.nombre || e.name || e.cliente || e.sku || e.label)) || null)
          .filter(Boolean);
        if (VOICE_D1F_ENTITY_SANITIZE_ENABLED) {
          try { _names = _names.map(_d1fResolveEntityName); } catch (e) { /* defensivo */ }
        }
        if (_names.length) {
          nextCtx.activeResult = {
            entities: _names,
            entityType: _etype,
            domain: nextCtx.investigationDomain || null,
            metric: nextCtx.investigationMetric || null,
            cardinality: _names.length === 1 ? "single" : "list",
            turn: nextCtx.turnCount,
            finding: {
              reasoningPattern: _lcrR1.reasoningPattern || null,
              thesis: _lcrR1.focus || null,
              cause: (typeof VOICE_D1_CAUSE_ENABLED !== "undefined" && VOICE_D1_CAUSE_ENABLED)
                ? _d1ExtractCause(_lcrR1) : null,
            },
          };
          // ── C · DEUDA J · hilo de evidencia compartido (piso L38699-38706) ──
          if (VOICE_DEUDA_J_ENABLED && (!nextCtx.investigationEntidades || !nextCtx.investigationEntidades.length) && _names.length) {
            nextCtx.investigationEntidades = _names;
            nextCtx.investigationDerivable = { ...nextCtx.investigationDerivable, entidades: true };
            if (!nextCtx.investigationEntityDim && _etype) nextCtx.investigationEntityDim = _etype;
          }
        }
      }
    } catch (e) { /* defensivo · R1 inerte si falla */ }
  }
  // ── ADI Core · 2.2c-1 · lastRetrievalContext · gemelo de pendingSpineDecision (2.2b) · spec del retrieval
  // para refinar. SIEMPRE setea el campo (null si la respuesta no es un QI retrieval) → vive un turno por
  // construcción (un turno no-QI lo limpia). Estampado con turn (freshness de 2.2a). Flag OFF → no toca.
  if (ADI_MT_REFINE_METRIC_ENABLED || ADI_MT_REFINE_FILTER_ENABLED || ADI_MT_REFINE_CUT_ENABLED) nextCtx.lastRetrievalContext = (resp && resp._qiContext) ? { ...resp._qiContext, turn: nextCtx.turnCount } : null;
}

// wrap plano · sin ECL/suffix (rutas que en el piso corren ANTES del punto de suffix · ej. inversa)
const _plainWrap = (resp, route, ctx) => ({
  text: resp.opener,
  suggestions: (resp.suggestions && resp.suggestions.length) ? resp.suggestions : null,
  sentrixAction: _gateInvCTA(resp.sentrixAction),   // Cabo 2 · 3er punto de salida (hoy null/comercial · futuro-seguro)
  // Fase 2.1d · payload hermano. Etapa 5 · Sentrix S1: con el flag, normaliza a la boleta UNIFORME (+ availability) ·
  // OFF = resp.evidence || null byte-exacto. Las rutas sin evidencia (avisar/smart-guide) → boleta null (guard interno).
  evidence: ADI_SENTRIX_BOLETA_ENABLED ? buildSentrixBoleta(resp, null, route, null) : (resp.evidence || null),
  intent: route,
  route,
  // ADI Core · 2.2b · escribe el contexto pendiente del spine (estampado con turn para el freshness de N+1).
  // SIEMPRE setea el campo (null si no hay _pending) → un wrap posterior sin pendiente lo LIMPIA: vive un solo
  // turno por construcción. Flag OFF → no toca el contexto (byte-exacto).
  context: { ...ctx, turnCount: (ctx.turnCount || 0) + 1,
    ...(ADI_MT_SPINE_FOLLOWUP_ENABLED ? { pendingSpineDecision: resp._pending ? { ...resp._pending, turn: (ctx.turnCount || 0) + 1 } : null } : {}) },
});

// ── ADI Core · MURO DE INVENTARIO · toda pregunta de inventario/capital por el chat → AVISAR Fase 2.5 ──
// Detecta inventario por 3 vías SIN aflojar los discriminadores:
//  (A) intent de composer de inventario puro (sku_operational / warehouse_dive).
//  (B) ranking_extremes SOLO con métrica domain==="inventario" (rotacion/doh/cobertura/stockUSD) · NUNCA el
//      composer entero → los rankings de margen/ventas ("top 3 SKU por margen", "cliente con peor margen") intactos.
//  (C) concepto TEXTUAL de inventario (rotación/DOH/cobertura/capital-inmovilizado/stock detenido/días sin
//      venta/bodega). Esto ancla cross_domain a "disparado por keyword de inventario" (la pieza comercial pura
//      —carga/margen, sin estos términos— NO se intercepta) y unifica la voz con los honest_fallback de inventario.
const _INV_STATES = "inmoviliz|atrap|detenid|amarrad|estancad|varad|parad|comprometid|frenad|muert";
function _esPreguntaInventarioChat(intent, trimmed) {
  if (intent && (intent.type === "sku_operational" || intent.type === "warehouse_dive")) return true;
  if (intent && intent.type === "ranking_extremes" && intent.metric
      && RANKING_EXTREMES_METRICS[intent.metric] && RANKING_EXTREMES_METRICS[intent.metric].domain === "inventario") return true;
  const n = normalizeText(trimmed);
  if (/\brotaci[oó]n\b|\brotan\b|no\s+rota|\bdoh\b|sobre[\s-]?cobertura|\bcobertura\b|\binventario\b|\bbodegas?\b|\bsucursal(?:es)?\b|\bquiebre\b|\bliquidar\b/.test(n)) return true;
  if (new RegExp(`\\b(capital|stock|sku|skus|producto|productos|inventario)\\b[\\s\\w]{0,25}\\b(${_INV_STATES})|\\b(${_INV_STATES})[\\s\\w]{0,25}\\b(capital|stock)\\b`).test(n)) return true;
  if (/sobre[\s-]?stock|stock\s*usd|d[ií]as\s+sin\s+vent|sin\s+venderse|d[ií]as\s+detenid/.test(n)) return true;
  const _wh = detectAllWarehousesInText(trimmed) || [];
  if (_wh.some(w => w && w !== "Todas")) return true;
  return false;
}
// ADI Core · Cabo 2 · capability-gate de CTA · con flag ON dropea cualquier sentrixAction de inventario
// (moduleChip "Inventario" / payload.modulo "inventario"). Verificado: ningún CTA comercial usa ese chip.
function _gateInvCTA(sa) {
  if (ADI_QI_FILTER_ENABLED && sa && (sa.moduleChip === "Inventario" || (sa.payload && sa.payload.modulo === "inventario"))) return null;
  return sa || null;
}
// mensaje ÚNICO, terminal · conserva filtro si lo hay · NO ofrece números alternativos · NO agrega adyacente
function _inventarioAvisarMsg(filterName) {
  const _filt = filterName ? ` Con el filtro de ${filterName} que mencionaste, igual te aviso en vez de darte un número que parezca firme.` : "";
  return `Eso vive en inventario y todavía no está habilitado en esta fase (Fase 2.5). No voy a responder con datos parciales o globales.${_filt} Lo que sí tengo hoy es ventas y márgenes.`;
}

// wrap fallback · opener (con applyVoiceCalibration interno) + SOLO suffix.
// El honest fallback SKIP-ea FASE 5 narrativa/ETLG/ECL (composer emite narrativa propia · L11981)
// pero SÍ recibe la observación aditiva. Replica el gate de sesión de _finalize.
const _fallbackWrap = (resp, route, intentLabel, ctx, scenario) => {
  let text = resp.opener;
  const nextCtx = { ...ctx, turnCount: (ctx.turnCount || 0) + 1 };
  // ADI Core · Cabo 1 · suffix proactivo APAGADO con flag ON (gemelo del gate de _finalize · honest_fallback).
  if (!ADI_QI_FILTER_ENABLED && text && ctx.observationEmittedScenario !== scenario) {
    const sfx = virtuousExceptionSuffix(scenario);
    if (sfx) { text = text + "\n\n" + sfx; nextCtx.observationEmittedScenario = scenario; }
  }
  return {
    text,
    suggestions: (resp.suggestions && resp.suggestions.length) ? resp.suggestions : null,
    sentrixAction: _gateInvCTA(resp.sentrixAction),
    intent: intentLabel,
    route,
    context: nextCtx,
  };
};

// Dispatch de la cascada de PanelADI · intent.type → composer (rama por rama). Todas con _finalize.
function dispatchIntent(intent, trimmed, scenario, ctx) {
  if (!intent) return null;
  // client metric follow-up ("y su margen?" · resuelto desde lastClientMentioned) — replica PanelADI L37356.
  // detectClientMetricFollowUp (router.js · ya en resolveSemanticIntent) requiere lastClientMentioned →
  // null en sesión fresca (los 47 single-turn no lo disparan). Fase 1a.
  if (ADI_FOLLOWUP_CLIENT_METRIC_ENABLED && intent.type === "client_metric_followup") {
    const resp = composeClientMetricFollowUp(intent.clientName, intent.metricKey, scenario, ctx.activeModule || null);
    if (resp && resp.opener) return _finalize(resp, "client_metric_followup", "client_metric_followup", ctx, scenario, intent);
  }
  // brand dive (Makita) — replica PanelADI L37922
  if (FEATURE_BRAND_AS_ENTITY && intent.type === "brand_dive") {
    return _finalize(composeBrandDive(intent.brand, scenario, { subFocus: intent.subFocus || null }), "brand_dive", "brand_dive", ctx, scenario, intent);
  }
  // warehouse comparison (Santiago vs Valparaíso) — replica PanelADI L37940
  if (FEATURE_ENTITY_COMPARISON && intent.type === "warehouse_comparison") {
    return _finalize(composeWarehouseComparison(intent.whA, intent.whB, scenario), "warehouse_comparison", "warehouse_comparison", ctx, scenario, intent);
  }
  // warehouse dive (cómo está Santiago) — replica PanelADI L37825-37842
  if (intent.type === "warehouse_dive") {
    const params = FEATURE_WAREHOUSE_AS_ENTITY ? { specificSucursal: intent.specificSucursal || null } : undefined;
    const resp = composeWarehouseAnalysis(scenario, params);
    if (resp && resp.opener) return _finalize(resp, "warehouse_dive", "warehouse_dive", ctx, scenario, intent);
  }
  // client comparison (Falabella vs Lider) — replica PanelADI L37375 · modulo = módulo activo
  if (intent.type === "client_comparison") {
    const resp = composeClientComparison(intent.clientA, intent.clientB, scenario, ctx.activeModule || null);
    if (resp && resp.opener) return _finalize(resp, "client_comparison", "client_comparison", ctx, scenario, intent);
  }
  // brand comparison (Samsung vs LG) — replica PanelADI L37913 (mundo-marca estático)
  if (FEATURE_BRAND_AS_ENTITY && intent.type === "brand_comparison") {
    const resp = composeBrandComparison(intent.brandA, intent.brandB, scenario);
    if (resp && resp.opener) return _finalize(resp, "brand_comparison", "brand_comparison", ctx, scenario, intent);
  }
  // ranking extremes (SKU peor rotación) — replica PanelADI L37690-37716
  if (VOICE_RANKING_EXTREMES_ENABLED && intent.type === "ranking_extremes") {
    let _rankMetric = intent.metric, _anexaMetric = null;
    if (typeof ADI_RANKING_WITH_METRICS_ENABLED !== "undefined" && ADI_RANKING_WITH_METRICS_ENABLED) {
      const _pa = _rwmDetectPrincipalAnexa(trimmed, intent.entityType);
      if (_pa && RANKING_EXTREMES_METRICS[_pa.principal] && RANKING_EXTREMES_METRICS[_pa.principal].entityType === intent.entityType) {
        _rankMetric = _pa.principal; _anexaMetric = _pa.anexa;
      }
    }
    const response = composeRankingExtremes({
      direction: intent.direction, metric: _rankMetric, entityType: intent.entityType, topN: intent.topN,
      scope: _buildScopeForMetric(_rankMetric, scenario),
      ctx: { ...ctx, scenarioId: scenario },
      inheritedScope: intent.inheritedScope || null, anexaMetric: _anexaMetric,
    });
    if (response) {
      // Etapa 5 · Sentrix S2b · LECTURA EJECUTIVA de margen de SKU · el porqué = descomposición del precio
      // (costo + rebate + margen → el driver que aplasta el margen). ADI dice el porqué en vez de la línea fina,
      // y el boleta carga reading{} → Sentrix lo demuestra. Gated · OFF = opener de composeRankingExtremes byte-exacto.
      if (ADI_SENTRIX_READING_ENABLED && response.evidence &&
          response.evidence.ranking_entityType === "sku" && response.evidence.ranking_direction === "worst" &&
          response.evidence.ranking_topN === 1 &&     // foco singular · "los 3 peores" queda como lista
          /marg/i.test(String(response.evidence.ranking_metric || ""))) {
        const _ent = response.evidence.ranking_entities && response.evidence.ranking_entities[0];
        const _rd = _ent ? buildReadingFromSignals(buildSkuMarginSignals(_ent)) : null;
        if (_rd) {
          response.opener = _rd.sentence;          // ADI dice la lectura ejecutiva (el porqué)
          response.narrative_signals = null;       // la frase ejecutiva ES la narrativa → no dejar que la capa narrativa la pise
          response.evidence.reading = _rd;         // el boleta la spread-ea → Sentrix la demuestra
        }
      }
      // Etapa 5 · Sentrix S2c · LECTURA del CLIENTE · el porqué = la carga comercial sobre el promedio interno.
      // A DIFERENCIA del SKU: el texto narrativo del cliente YA es ejecutivo → NO se reemplaza ni se limpia. Solo
      // se carga reading{} en el boleta, construido DESDE response.narrative_signals (mismo objeto que formatea el
      // texto) → los números del panel == los del texto, cero divergencia (regla madre). Gated · OFF = sin reading.
      if (ADI_SENTRIX_READING_ENABLED && response.evidence && response.narrative_signals &&
          response.evidence.ranking_entityType === "client" && response.evidence.ranking_direction === "worst" &&
          response.evidence.ranking_topN === 1 && /marg/i.test(String(response.evidence.ranking_metric || ""))) {
        const _crd = buildReadingFromSignals(response.narrative_signals);
        if (_crd) response.evidence.reading = _crd;   // solo el panel · texto narrativo intacto
      }
      return _finalize(response, "ranking_extremes", "ranking_extremes", ctx, scenario, intent);
    }
  }
  // client dive (Falabella) — replica PanelADI L36734
  if (intent.type === "client" || intent.type === "client_followup") {
    const deepContext = getResponseContext({
      activeModule: ctx.activeModule || "ventas",
      lastClientMentioned: ctx.lastClientMentioned,
      lastModuleConsulted: ctx.lastModuleAsked,
      turnCount: ctx.turnCount,
      userInputText: trimmed,
    });
    const deep = getClientDeepDive(intent.clientName, scenario, deepContext);
    // El dispatch vivo de client del piso NO setea lastComposerResponse → la capa narrativa no dispara
    // (verificado ESTÁTICO). El modular replica no exponiendo narrative_signals en client_dive.
    if (deep && deep.opener) return _finalize({ ...deep, narrative_signals: null }, "client_dive", "client_dive", ctx, scenario, intent);
  }
  // client contribution ranking (quién aporta más contribución) — replica PanelADI L37682
  if (intent.type === "client_contribution_ranking") {
    const resp = composeClientContributionRanking(scenario);
    if (resp && resp.opener) return _finalize(resp, "client_contribution_ranking", "client_contribution_ranking", ctx, scenario, intent);
  }
  // sku operational (qué SKUs atrapan capital · no rotan · rotación promedio) — replica PanelADI L37801.
  // Expone narrative_signals (kind="sku_operational_group") → la capa narrativa lo reescribe.
  // NO se strippea (a diferencia de client_dive): el piso setea lastComposerResponse aquí.
  if (intent.type === "sku_operational") {
    const resp = composeSkuOperationalAnalysis(scenario);
    if (resp && resp.opener) return _finalize(resp, "sku_operational", "sku_operational", ctx, scenario, intent);
  }
  // cross-domain → dispatch de mecanismo (replica composeCrossDomainResponse · PanelADI L4441-4448).
  // Solo archetypes de mecanismo YA extraídos. dependency_risk pendiente (deps r7_*); otros archetypes pendientes.
  if (intent.type === "cross_domain_query" && intent.crossDomain) {
    const _mechId = { mechanism_commercial_erosion: "commercial_erosion",
                      mechanism_quality_growth: "quality_of_growth_deterioration",
                      mechanism_dependency_risk: "customer_dependency_risk" }[intent.crossDomain.archetype];
    if (_mechId) {
      const resp = composeMechanismResponse(_mechId, scenario);
      if (resp && resp.opener) return _finalize(resp, "cross_domain_mechanism", "cross_domain_mechanism", ctx, scenario, intent);
    }
    // fuga_distribuida (dónde tengo capital detenido) → composeCrossDomainResponse · M1-M4 (replica PanelADI L37469).
    if (intent.crossDomain.archetype === "fuga_distribuida") {
      const resp = composeCrossDomainResponse(intent.crossDomain, scenario);
      if (resp && resp.opener) return _finalize(resp, "cross_domain_query", "cross_domain_query", ctx, scenario, intent);
    }
  }
  return null; // otros intent.type aún no despachados (ramas siguientes)
}

// Overview "module" explícito/bare → habilita el lead ETLG module_overview (replica guard del piso L37852-37855).
// Devuelve un intent-lite para _finalize (tier module_overview). null = sin lead (honest fallback del piso).
// Regla verificada: detectIntent.type==="module" && (explicit-overview || bare-module) · 23/23 sin falsos +/-.
function _overviewLeadIntent(trimmed) {
  const di = detectIntent(trimmed, {});
  if (di && di.type === "module" && (_isExplicitModuleOverviewQuery(trimmed) || _isBareModuleWord(trimmed))) {
    return { type: "module", modulo: di.modulo || null, _semantic_meta: {} };
  }
  return null;
}

// ── ADI Core · 2.2a-2 parte A · detector de TOPIC-CHANGE (pregunta nueva limpia el foco) ──
// Dispara SOLO con señal DOBLE: alcance global explícito + métrica, Y ausencia de anáfora ("su/sus") o
// cliente nombrado. Requiere un foco de cliente vigente para limpiar. CONSERVADOR: por defecto NO limpia
// → preserva el follow-up legítimo ("y su margen") y el ambiguo ("cuál es el margen", sin "global"/"su").
function _detectTopicChange(text, ctx) {
  if (!ctx || !ctx.lastClientMentioned) return false;                 // nada que limpiar
  const n = normalizeText(text || "");
  if (!/\bglobal(es)?\b|\bgeneral(es)?\b|de (toda )?la cartera\b|del portafolio\b|del negocio\b|\bpromedio\b/.test(n)) return false;  // alcance global
  if (!/\bmargen(es)?\b|\bcarga\b|\bcontribuci[oó]n\b|\bventas?\b|\brotaci[oó]n\b|\brentabilidad\b/.test(n)) return false;            // + métrica
  if (/\bsus?\b/.test(n)) return false;                               // anáfora "su"/"sus" → follow-up legítimo
  if (detectClientInText(text)) return false;                         // cliente nombrado → no es topic-change vago
  return true;
}

// ── ADI Core · 2.2b · resolver el contexto pendiente del spine (ACLARAR/AVISAR) ──
// Consume SOLO un pendiente FRESCO (turno inmediato anterior) que NO sea topic-change, y SOLO si la respuesta
// es suelta (una métrica-eje sola para clarify). Sin pendiente fresco → null (la respuesta suelta es pregunta
// nueva). Reusa el spine (cero recálculo nuevo).
function _isLooseMetric(n, m) {
  const _s = n.replace(/\b(el|la|lo|los|las|por|en|de|del|dame|quiero|es|son|seria)\b/g, " ").replace(/\s+/g, " ").trim();
  return _s === m;                                            // tras quitar filler queda EXACTAMENTE la métrica
}
function _resolvePending(text, ctx, scenario) {
  const p = ctx && ctx.pendingSpineDecision;
  if (!p || p.turn !== ctx.turnCount) return null;           // candado 1 · freshness (turno inmediato anterior)
  if (_detectTopicChange(text, ctx)) return null;            // candado 2 · topic-change descarta (no fuerza)
  const n = normalizeText(text || "");
  if (p.kind === "clarify") {
    if (detectBrandInText(text) || detectClientInText(text)) return null;  // nombra otra entidad → pregunta nueva
    const pm = (p.pendingMetrics || []).find(m => _isLooseMetric(n, normalizeText(m)));
    if (!pm) return null;                                     // candado 3 · respuesta suelta = métrica-eje sola
    return resolveFilteredRetrieval(`el ${p.dir} ${p.dimW} de ${p.filterValue} en ${pm}`, scenario);  // recompone + reusa el spine
  }
  if (p.kind === "combined") {
    // candado 3 (combined) · la elección debe ser UNÍVOCA: detalle del cliente XOR la marca sola.
    const _mClient = normalizeText(p.specificClient || ""), _mBrand = normalizeText(p.filterValue || "");
    const _wantsClient = (_mClient && n.includes(_mClient)) || /\bdetalle\b|\bcliente\b|\bcuenta\b/.test(n);
    const _wantsBrand = (_mBrand && n.includes(_mBrand)) || /\b(sola|solo|unica|sóla)\b|\bmarca\b/.test(n);
    if (_wantsClient && !_wantsBrand) return { _rewrite: `cómo está ${p.specificClient}` };          // opción 2 · client_dive
    if (_wantsBrand && !_wantsClient) return { _rewrite: `${p.metric || "ventas"} de ${p.filterValue}` };  // opción 1 · marca sola COMERCIAL (no brand_dive)
    return null;                                              // ambiguo / ninguno → pregunta nueva (no fuerza)
  }
  if (p.kind === "sim_scope") {
    // sub-fix "todas" · resuelve el alcance del clarify de contribución/margen, DETERMINÍSTICO (no smart-guide).
    const cli = (typeof detectClientInText === "function") ? detectClientInText(text) : null;
    if (cli) return { _rewrite: `cómo está ${cli}` };                         // cuenta nombrada (ej. Lider) → client_dive
    if (/\btodas?\b|\btodos\b|el\s+total|la\s+cartera|portafolio|portfolio|todas\s+las\s+cuentas|el\s+grupo|erosionad|las\s+cuentas\b/.test(n))
      return { _rewrite: "los clientes con mayor contribución" };             // todas / grupo erosionado → vista de cartera (concentración + márgenes + mecanismos)
    return null;                                                              // ambiguo → pregunta nueva (no fuerza)
  }
  return null;
}

// ── ADI Core · 2.2c-1 · REFINAMIENTO de MÉTRICA (elíptico vs autónomo · EL DISCRIMINADOR) ──
// "y por margen" tras "ventas por cliente de Samsung" → refina (cambia métrica, MANTIENE filtro+dim).
// La regla (línea clara, no corazonada): NOMBRA UNA DIMENSIÓN (cliente/familia/marca/sku…) → pregunta nueva
// (autónoma). SOLO una métrica-eje elíptica (sin dimensión) → refinamiento. Métricas-eje = comercial
// (ventas/margen/contribución · NUNCA inventario → cero fuga). Reusa el pipeline QI (cero recálculo nuevo).
const _wordIn = (n, w) => new RegExp("(^|[^a-z0-9])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)").test(n);
function _detectMetricRefinement(text, ctx, scenario) {
  const lrc = ctx && ctx.lastRetrievalContext;
  if (!lrc || lrc.turn !== ctx.turnCount) return null;                 // candado · freshness (turno inmediato anterior)
  const n = normalizeText(text || "");
  // (1) ¿nombra una DIMENSIÓN? → AUTÓNOMA (pregunta nueva), aunque parezca elíptica
  for (const vocab of Object.values(QI_DIMENSION_VOCAB))
    if (vocab.some(w => _wordIn(n, normalizeText(w)))) return null;
  // (2) ¿referencia una métrica-EJE (comercial · NUNCA inventario)? + ¿cuál?
  let newMetric = null;
  for (const mk of ["ventas", "margen", "contribucion"])
    if (QI_METRIC_VOCAB[mk].some(w => _wordIn(n, normalizeText(w)))) { newMetric = mk; break; }
  if (!newMetric) return null;
  // (3) ¿ELÍPTICO? (arranca con "y", o es una métrica suelta corta · un intent autónomo largo NO es refinamiento)
  if (!(/^y\b/.test(n) || n.split(/\s+/).filter(Boolean).length <= 3)) return null;
  // recompone "{métrica} por {dim} de {filtro}" y reusa el pipeline QI (byte-idéntico a tipear la query completa)
  const _q = `${newMetric} por ${lrc.dimension}${lrc.filterValue ? " de " + lrc.filterValue : ""}`;
  const _parse = queryInterpreter(_q, scenario);
  if (!_parse || !_parse.isRetrieval) return null;
  const _composed = composeRetrieval(_parse, scenario);
  return (_composed && typeof _composed.opener === "string" && _composed.opener.length) ? _composed : null;
}

// ── ADI Core · 2.2c-2 · REFINAMIENTO de FILTRO ("solo Bosch") · gemelo de _detectMetricRefinement ──
// "solo Bosch"/"y Bosch" (elíptico · marca/familia, SIN dimensión/métrica nueva) re-filtra la vista del
// lastRetrievalContext: cambia el FILTRO, mantiene métrica+dimensión. ANTI-FUGA: si la vista previa era
// inventario → AVISA (no refina hacia inventario · compone con el Availability Map). Reusa el pipeline QI.
function _detectFilterRefinement(text, ctx, scenario) {
  const lrc = ctx && ctx.lastRetrievalContext;
  if (!lrc || lrc.turn !== ctx.turnCount) return null;                 // candado · freshness
  const n = normalizeText(text || "");
  // (1) ¿señal ELÍPTICA de filtro? "solo"/"solamente"/"y" al inicio (un "Bosch" a secas NO es refinamiento)
  if (!/^(solo|solamente|unicamente|y)\b/.test(n)) return null;
  // (2) ¿nombra una DIMENSIÓN o una MÉTRICA-eje nueva? → AUTÓNOMA (no es refinamiento de filtro)
  for (const vocab of Object.values(QI_DIMENSION_VOCAB))
    if (vocab.some(w => _wordIn(n, normalizeText(w)))) return null;
  for (const mk of ["ventas", "margen", "contribucion"])
    if (QI_METRIC_VOCAB[mk].some(w => _wordIn(n, normalizeText(w)))) return null;   // métrica → es c-1, no c-2
  // (3) detecta la nueva marca/familia (el filtro · strict · gemelo del spine)
  const _fams = detectAllFamiliesInText(text, { strict: true }) || [];
  const newFilter = detectBrandInText(text) || (_fams.length ? _fams[0] : null);
  if (!newFilter) return null;
  // (4) ANTI-FUGA · si la vista previa era inventario (bloqueado) → AVISA (no surfacea rotación/capital)
  if (lrc.domain === "inventario" && !isAvailable("inventario")) return { _avisa: true, opener: unavailableMessage("inventario") };
  // (5) recompone con el FILTRO nuevo (mantiene métrica+dim) · reusa el pipeline QI · el QI filter decide
  // la aplicabilidad (responde el cruce válido · AVISA/ACLARA el decorativo marca×cliente, reusa 2.1c).
  const _parse = queryInterpreter(`${lrc.metric} por ${lrc.dimension} de ${newFilter}`, scenario);
  if (!_parse || !_parse.isRetrieval) return null;
  const _composed = composeRetrieval(_parse, scenario);
  if (_composed && _composed._verdict) return _composed;               // AVISAR/ACLARAR (cruce decorativo) → _plainWrap en el wire
  return (_composed && typeof _composed.opener === "string" && _composed.opener.length) ? _composed : null;
}

// ── ADI Core · 2.2c-3 · REFINAMIENTO de CORTE ("los tres peores"/"el top 3") · gemelo de los anteriores ──
// Un cuantificador de corte ELÍPTICO (N + dirección, SIN dimensión/métrica/marca nueva) rebana el ranking
// guardado del lastRetrievalContext (top N / bottom N) → one-liner. ANTI-FUGA: las vistas de inventario
// rutean a sku_operational (NO escriben lastRetrievalContext) → "los tres peores" cae a la continuación de
// 2.2a → AVISA; + domain-check belt-and-suspenders. El corte es INHERENTEMENTE comercial.
const _NUMWORDS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
function _parseCutQuantifier(n) {
  const direction = /\bpeor(es)?\b/.test(n) ? "bottom" : (/\bmejor(es)?\b|\btop\b/.test(n) ? "top" : null);
  if (!direction) return null;                               // sin dirección explícita → no es un corte
  let N = null;
  const dM = n.match(/\b(\d+)\b/);
  if (dM) N = parseInt(dM[1], 10);
  else { for (const [w, v] of Object.entries(_NUMWORDS)) if (_wordIn(n, w)) { N = v; break; } }
  if (!N || N < 1 || N > 50) return null;                    // sin N explícito ("dame menos") → no adivina el delta
  return { N, direction };
}
function _detectCutRefinement(text, ctx) {
  const lrc = ctx && ctx.lastRetrievalContext;
  if (!lrc || lrc.turn !== ctx.turnCount) return null;                 // candado · freshness
  const n = normalizeText(text || "");
  // (1) ¿nombra DIMENSIÓN / MÉTRICA-eje / MARCA nueva? → AUTÓNOMA (pregunta nueva)
  for (const vocab of Object.values(QI_DIMENSION_VOCAB)) if (vocab.some(w => _wordIn(n, normalizeText(w)))) return null;
  for (const mk of ["ventas", "margen", "contribucion"]) if (QI_METRIC_VOCAB[mk].some(w => _wordIn(n, normalizeText(w)))) return null;
  if (detectBrandInText(text) || (detectAllFamiliesInText(text, { strict: true }) || []).length) return null;
  // (2) cuantificador de corte (N + dirección explícitos · si no, no corta)
  const q = _parseCutQuantifier(n);
  if (!q) return null;
  // (3) ANTI-FUGA belt-and-suspenders (la base inventario ya cae a 2.2a · esto es la red extra)
  if (lrc.domain === "inventario" && !isAvailable("inventario")) return { _avisa: true, opener: unavailableMessage("inventario") };
  // (4) rebana el ranking guardado (DESC) + one-liner · cero recálculo (reusa los valores ya formateados)
  const ranking = Array.isArray(lrc.ranking) ? lrc.ranking : [];
  if (!ranking.length) return null;
  const slice = q.direction === "top" ? ranking.slice(0, q.N) : ranking.slice(-q.N).reverse();   // peores → el peor primero
  if (!slice.length) return null;
  const _dirW = q.direction === "top" ? (q.N === 1 ? "mejor" : "mejores") : (q.N === 1 ? "peor" : "peores");
  const _met = (lrc.metricLabel || lrc.metric || "valor").toLowerCase();
  const _filt = lrc.filterValue ? ` de ${lrc.filterValue}` : "";
  return { opener: `${q.N === 1 ? "El" : "Los"} ${q.N} ${_dirW} en ${_met}${_filt}: ${slice.map(x => `${x.entity} ${x.value}`).join(", ")}.` };
}

export function answerADI(question, context = {}, state = {}) {
  const scenario = (state && state.scenario) || "bonanza";
  let trimmed = (question || "").trim();
  let ctx = context || {};
  // ── ADI Core · 2.2b · resolver el contexto pendiente del spine (ANTES de re-detectar y del topic-change) ──
  // El turno N+1 lee el pendiente al TOPE. clarify → respuesta sellada del spine (return). combined → reescribe
  // la query ("el detalle de Falabella" → "cómo está Falabella") y sigue el flujo normal (client_dive). Si NO
  // se consume (stale/topic-change/pregunta nueva) → descarta el pendiente y sigue. El pendiente vive un turno.
  if (ADI_MT_SPINE_FOLLOWUP_ENABLED && ctx.pendingSpineDecision) {
    const _rp = _resolvePending(trimmed, ctx, scenario);
    ctx = { ...ctx, pendingSpineDecision: null };            // consumido o no → el pendiente se descarta
    if (_rp && _rp.opener) return _plainWrap(_rp, _rp.route, ctx);   // clarify → respuesta sellada
    if (_rp && _rp._rewrite) trimmed = _rp._rewrite;                 // combined → reescribe y sigue el flujo
  }
  // ── ADI Core · 2.2a-2 parte A · TOPIC-CHANGE cleanup (en el ORIGEN · cierra las 2 puertas) ──
  // Una pregunta de alcance global limpia el foco de cliente ANTES de detectIntent (puerta 1: follow-up
  // greedy detectClientMetricFollowUp) y del bloque ECL-CONT (puerta 2: MODO1 getClientDeepDive). Reasigna
  // ctx (NO muta el input). Limpia adelante también (la pregunta nueva olvida el cliente). Flag OFF → no toca.
  if (ADI_MT_TOPIC_CLEAN_ENABLED && _detectTopicChange(trimmed, ctx)) {
    ctx = { ...ctx, lastClientMentioned: null, lastClientMentionedTurn: null,
            activeResult: (ctx.activeResult && ctx.activeResult.entityType === "cliente") ? null : ctx.activeResult,
            lastRetrievalContext: null };   // 2.2c · el cambio de tema también descarta el refinamiento pendiente
  }
  // ── ADI Core · 2.2c · REFINAMIENTOS deícticos (métrica c-1 · filtro c-2 · corte c-3) · corren tras 2.2b
  // (prioridad del pending) y el topic-change cleanup, ANTES del spine/detectIntent. Reusan el lastRetrievalContext
  // fresco. La limpieza va al FINAL (tras los tres detectores) para que ninguno quede sin contexto si el anterior
  // no refinó. Disjuntos: c-1 detecta una MÉTRICA, c-2 una MARCA/FAMILIA, c-3 un CUANTIFICADOR → no se pisan.
  if ((ADI_MT_REFINE_METRIC_ENABLED || ADI_MT_REFINE_FILTER_ENABLED || ADI_MT_REFINE_CUT_ENABLED) && ctx.lastRetrievalContext) {
    if (ADI_MT_REFINE_METRIC_ENABLED) {
      const _rm = _detectMetricRefinement(trimmed, ctx, scenario);                          // c-1 · cambia la métrica
      if (_rm && _rm.opener) return _finalize(_rm, "qi_retrieval", "qi_retrieval", ctx, scenario, null);
    }
    if (ADI_MT_REFINE_FILTER_ENABLED) {
      const _rf = _detectFilterRefinement(trimmed, ctx, scenario);                          // c-2 · cambia el filtro
      if (_rf && _rf._avisa) return _plainWrap({ opener: _rf.opener }, "qi_inventory_avisar", ctx);   // anti-fuga inventario
      if (_rf && _rf._verdict) return _plainWrap(_rf, "qi_retrieval_" + _rf._verdict, ctx);            // cruce decorativo → AVISA/ACLARA
      if (_rf && _rf.opener) return _finalize(_rf, "qi_retrieval", "qi_retrieval", ctx, scenario, null);
    }
    if (ADI_MT_REFINE_CUT_ENABLED) {
      const _rc = _detectCutRefinement(trimmed, ctx);                                       // c-3 · acota (top/bottom N)
      if (_rc && _rc._avisa) return _plainWrap({ opener: _rc.opener }, "qi_inventory_avisar", { ...ctx, lastRetrievalContext: null });  // anti-fuga
      if (_rc && _rc.opener) return _plainWrap({ opener: _rc.opener }, "qi_retrieval_cut", { ...ctx, lastRetrievalContext: null });      // corte (one-liner · terminal)
    }
    ctx = { ...ctx, lastRetrievalContext: null };   // ningún refinamiento (autónoma/stale) → descartar (no fuerza)
  }

  // ── GAP 1 · GUARD DE HONESTIDAD · intercepta lo imposible ANTES del spine/ranking ──
  // Cruce sin granularidad atómica (marca×cliente · cliente×SKU) o SKU inexistente → declara el límite y
  // redirige a lo disponible, en vez de contestar otra pregunta o sustituir la entidad. Lo que hace VERDADERO
  // "ADI no inventa". Gated · OFF → null → el spine/ranking responden como antes (byte-exacto).
  if (ADI_HONESTY_GUARD_ENABLED) {
    const _hg = composeHonestyGuard(trimmed);
    if (_hg) return _plainWrap({ opener: _hg }, "honesty_guard", ctx);
  }

  // ── ADI Core · Fase 2.1a · SPINE · superlativo por dimensión (marca/familia) SIN filtro ──
  // Corre PRIMERO (antes de simulación/early-gate/dispatch) para OWNAR su firma angosta: la capa de
  // simulación mal-clasifica "mejor/peor margen" + marca/familia como simulación. El spine reclama SOLO
  // esa firma (marca/familia que ranking_extremes no alcanza = guard de mismatch); todo lo demás cae al
  // flujo viejo intacto. Resuelve vía Semantic Layer, valida vía Availability Map, reusa el cómputo QI.
  // Flag OFF → null → cero cambio. (El shadow-diff prueba que solo la firma cambia.)
  {
    const _sp = resolveDimensionalSuperlative(trimmed, scenario);
    if (_sp && _sp.opener) return _plainWrap({ opener: _sp.opener, evidence: _sp.evidence }, _sp.route, ctx);
  }
  // ── ADI Core · Fase 2.1b · SPINE FILTRO · métrica + filtro marca/familia nombrado SIN "por" ──
  // Corre DESPUÉS de 2.1a (precedencia disjunta: 2.1a=dimensión genérica sin entidad; 2.1b=entidad nombrada).
  // Reusa el escudo QI (opts.spineFilter). Flag OFF → null → cae al viejo. El shadow-diff prueba cero overshadow.
  {
    const _fr = resolveFilteredRetrieval(trimmed, scenario);
    if (_fr && _fr.opener) return _plainWrap({ opener: _fr.opener, suggestions: _fr.suggestions || null, evidence: _fr.evidence, _pending: _fr._pending }, _fr.route, ctx);
  }
  // ── ADI Core · Fase 2.5a · SPINE INVENTARIO · métrica MODELADA (rotación) por SKU · RESPONDE con evidence ──
  // Corre ANTES del muro. Reclama SOLO métricas de inventario DISPONIBLES (per-flag · rotación en 2.5a); las no
  // modeladas → null → el muro AVISA (disolución métrica por métrica). Atomicidad: mezcla con no-modelada → AVISA.
  // Flag OFF → isAvailable false → resolver inerte → byte-exacto (el muro AVISA como en la Etapa 2).
  {
    const _ir = resolveInventoryRetrieval(trimmed, scenario);
    if (_ir && _ir.opener) return _plainWrap({ opener: _ir.opener, suggestions: _ir.suggestions || null, evidence: _ir.evidence }, _ir.route, ctx);
  }

  // ── SIMULACIÓN B2a · cadena pre-detectIntent (replica PanelADI L35500-35733) ──
  // Orden-sensible: margen → pérdida → inverse → growth → price. Cada extractor gateado.
  // NO pasa por _finalize · el piso no le aplica ECL/suffix en esta rama (wrap plano).
  // NOTA: el piso suprime con _d1Causal (follow-up causal multi-turno · no extraído aún) ·
  // para single-turn (ctx vacío) _d1Causal=null → la cadena corre igual. Multi-turno causal = deuda conocida.
  {
    const _simOv = extractMarginSimulation(trimmed, scenario)
      || extractLossSimulation(trimmed, scenario)
      || (FEATURE_INVERSE_PROJECTION ? extractInverseProjection(trimmed, scenario) : null)
      || (FEATURE_GROWTH_PROJECTION ? extractGrowthSimulation(trimmed, scenario) : null)
      || (FEATURE_PRICE_LEVER ? extractPriceSimulation(trimmed, scenario) : null);
    if (_simOv) {
      // margen/pérdida → delta · compareStates + composeSimulationDelta (B2b · L35649)
      if (_simOv.override) {
        const _diff = compareStates(buildSimulationState(scenario), buildSimulationState(scenario, _simOv.override));
        const _narr = composeSimulationDelta({ ov: _simOv, diff: _diff }, scenario);
        if (_narr) return _plainWrap({ opener: _narr }, "simulation_delta", ctx);
      }
      // inverse (CORTE 7 · L35607)
      else if (FEATURE_INVERSE_PROJECTION && _simOv.inverse) {
        const _inv = composeInverseProjection(_simOv, scenario);
        if (_inv && _inv.opener) return _plainWrap(_inv, "inverse_projection", ctx);
      }
      // growth (CORTE 2 · L35521)
      else if (FEATURE_GROWTH_PROJECTION && _simOv.growth) {
        const _proj = composeGrowthProjection(_simOv, scenario);
        if (_proj && _proj.opener) return _plainWrap(_proj, "growth_projection", ctx);
      }
      // price (CORTE 3 · L35563)
      else if (FEATURE_PRICE_LEVER && _simOv.price) {
        const _plev = composePriceLever(_simOv, scenario);
        if (_plev && _plev.opener) return _plainWrap(_plev, "price_lever", ctx);
      }
      // needsPrecision · pregunta de precisión (texto = question + options · L35705-35721)
      else if (_simOv.needsPrecision) {
        const _q = _simOv.question || "¿En qué cuentas querés simular el cambio de margen?";
        const _opts = _simOv.options || [];
        const _optTxt = _opts.length ? ` (${_opts.join(" · ")})` : "";
        // sub-fix "todas" · persiste un pendiente de ALCANCE (solo el clarify de cuentas · no el de pp/% ni el de magnitud)
        // para que el turno N+1 resuelva "todas"/"el grupo erosionado"/un cliente. Gated · espeja pendingSpineDecision (2.2b).
        const _isScope = ADI_SIM_SCOPE_FOLLOWUP_ENABLED && Array.isArray(_simOv.options) && _simOv.options.some(o => /cuenta|todas|erosionad/i.test(o));
        return _plainWrap({ opener: _q + _optTxt, ...(_isScope ? { _pending: { kind: "sim_scope" } } : {}) }, "simulation_needs_precision", ctx);
      }
    }
  }

  // ── EXECUTIVE REPORT (cómo va el negocio · panorama) · el piso lo rutea por detectIntent ──
  // (no por el early-gate legacy · muerto en el piso). Corre ANTES del early gate para no ser
  // interceptado por la tesis corta. Solo dispara con intent.type === "executive_report".
  {
    const _intentER = detectIntent(trimmed, ctx);
    if (_intentER && _intentER.type === "executive_report") {
      const _report = composeExecutiveReport(scenario, { areas: _intentER.areas });
      if (_report && _report.available) {
        const _narr = composeExecutiveReportNarrative(_report);
        if (_narr && _narr.opener) return _finalize(_narr, "executive_report", "executive_report", ctx, scenario, _intentER);
      }
    }
  }

  // ── EARLY GATE v2 · si _earlyOv gana, opener + return ──
  const early = FEATURE_INTENT_LAYER_EARLY ? resolveIntentLayerEarly(trimmed, scenario, ctx) : null;
  if (early) {
    // ADI Core · MURO DE INVENTARIO (pre-early-gate) · un OVERVIEW de inventario ("cómo está el inventario")
    // también AVISA · el early gate corre ANTES del muro principal y daría capital/rotación si no se intercepta.
    // 2.2a-2 parte B · cierre SEMÁNTICO: si el early resolvió a MÓDULO inventario (early._module · ej. "ese
    // stock" que el regex de texto no caza), AVISA por _plainWrap ANTES de _finalize (que le prepende un
    // preámbulo narrativo de inventario). Cierra el "stock" elíptico sin tocar el regex (cero over-trigger).
    if (ADI_QI_FILTER_ENABLED && (_esPreguntaInventarioChat(null, trimmed)
        || (ADI_MT_INV_COVERAGE_ENABLED && early._module === "inventario" && !isAvailable("inventario")))) {
      const _ef = detectBrandInText(trimmed) || (detectAllFamiliesInText(trimmed, { strict: true })[0] || null);
      return _plainWrap({ opener: ADI_SMART_GUIDE_ENABLED ? composeSmartGuide(trimmed) : _inventarioAvisarMsg(_ef) }, "qi_inventory_avisar", ctx);
    }
    return _finalize(early, "early_gate", early.intent || "module_overview", ctx, scenario, _overviewLeadIntent(trimmed));
  }

  // ── detectIntent → dispatch de cascada (ramas de anclas extraídas) ──
  let intent = detectIntent(trimmed, ctx);
  // ranking-extremes re-detection (replica PanelADI L37143) · puede sobrescribir intent
  if (VOICE_RANKING_EXTREMES_ENABLED) {
    const _re = detectRankingExtremesIntent(trimmed, ctx);
    if (_re) intent = _re;
  }

  // ── ADI Core · Escape 1 · ranking de INVENTARIO con FILTRO de marca/familia → AVISAR (conserva el filtro) ──
  // "qué SKU de Samsung rota peor" (sin "por") cae a ranking_extremes, que sirve el peor SKU GLOBAL e IGNORA
  // la marca → devolvía MAK-COMP-AIR (Makita) como si fuera Samsung. Interceptamos ANTES del dispatch SOLO si:
  // (métrica de inventario: rotacion/doh/cobertura/stockUSD) Y (filtro de marca/familia detectado como TAL,
  // con conector "de", vía detector STRICT de Piece 1). El filtro es el discriminador → sin filtro NO se
  // intercepta y composeRankingExtremes global queda INTACTO (corpus-safe · no ensombrece el ranking sellado).
  if (ADI_QI_FILTER_ENABLED && intent && intent.type === "ranking_extremes"
      && intent.metric && RANKING_EXTREMES_METRICS[intent.metric]
      && RANKING_EXTREMES_METRICS[intent.metric].domain === "inventario") {
    const _normT = normalizeText(trimmed);
    const _afterDe = (name) => new RegExp(`\\bde(?:l)?\\s+(?:la\\s+|las\\s+|los\\s+|marca\\s+|familia\\s+|categoria\\s+)*${normalizeText(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(_normT);
    const _brand = detectBrandInText(trimmed);                       // strict \b · FEATURE_BRAND_AS_ENTITY
    const _fams = detectAllFamiliesInText(trimmed, { strict: true }); // strict · boundaries + nombre completo (Piece 1)
    const _filterName = (_brand && _afterDe(_brand)) ? _brand
                      : (_fams.length && _afterDe(_fams[0])) ? _fams[0] : null;
    if (_filterName) {
      const _metricLabel = intent.metric === "rotacion" ? "La rotación"
                         : intent.metric === "doh" ? "El DOH"
                         : intent.metric === "cobertura" ? "La cobertura"
                         : "El capital en inventario";                // stockUSD
      const _msg = `${_metricLabel} vive en el inventario y todavía no puedo aplicar el filtro de ${_filterName} sobre inventario en esta vista (Fase 2.5). Lo que sí puedo darte con el filtro de ${_filterName} es ventas o margen por SKU. No voy a devolverte un SKU global como si fuera ${_filterName}.`;
      return _plainWrap({ opener: _msg }, "qi_inventory_filter_avisar", ctx);
    }
  }

  // ── ADI Core · MURO DE INVENTARIO · intercepta TODA pregunta de inventario/capital ANTES del dispatch ──
  // Un solo gate (mismo lugar que Fix A · gated por el master). AVISAR único terminal vía _plainWrap (sin
  // suffix · no contamina N+1). Conserva el filtro nombrado si lo hay. Corre DESPUÉS de Fix A (que mantiene
  // su mensaje para el ranking filtrado) y ANTES del puente QI y el dispatch → captura las 4 puertas.
  if (ADI_QI_FILTER_ENABLED && _esPreguntaInventarioChat(intent, trimmed)) {
    const _b = detectBrandInText(trimmed);
    const _f = detectAllFamiliesInText(trimmed, { strict: true });
    const _filterName = _b || (_f.length ? _f[0] : null);
    return _plainWrap({ opener: ADI_SMART_GUIDE_ENABLED ? composeSmartGuide(trimmed) : _inventarioAvisarMsg(_filterName) }, "qi_inventory_avisar", ctx);
  }

  // ── QI RETRIEVAL · tabla paramétrica (replica PanelADI FASE 3 · L37159-37182) ──
  // Corre DESPUÉS de detectIntent + re-detección de ranking, ANTES del dispatch de cascada
  // (intercepta antes de cross_domain · por eso [39] da tabla, no mechanism_ranking).
  // Gate fiel: no-ejecutivo (executiveLanguageDetector) → queryInterpreter → isRetrieval → composeRetrieval.
  // Guard !ranking_extremes = replica !rankingExtremesEarlyHandled del piso (evita robar [8]/[38]).
  // qi_composed pasa por FASE 5 (suffix · sin lead ETLG) → _finalize con intent=null (ETLG no dispara).
  if (!intent || intent.type !== "ranking_extremes") {
    const _qiConcepts = (intent && intent._semantic_meta && intent._semantic_meta.concepts_full) || [];
    const _qiExec = executiveLanguageDetector(trimmed, _qiConcepts);
    if (!_qiExec.isExecutive) {
      const _qiParse = queryInterpreter(trimmed, scenario, intent && intent._semantic_meta);
      if (_qiParse && _qiParse.isRetrieval) {
        const _qiComposed = composeRetrieval(_qiParse, scenario);
        // Piece 3 · verdicto de filtro (AVISAR/ACLARAR) → _plainWrap (limpio · sin suffix/threading)
        if (_qiComposed && _qiComposed._verdict) {
          return _plainWrap(_qiComposed, "qi_retrieval_" + _qiComposed._verdict, ctx);
        }
        if (_qiComposed && typeof _qiComposed.opener === "string" && _qiComposed.opener.length > 0) {
          return _finalize(_qiComposed, "qi_retrieval", "qi_retrieval", ctx, scenario, null);
        }
      }
    }
  }

  const dispatched = dispatchIntent(intent, trimmed, scenario, ctx);
  if (dispatched) return dispatched;

  // ── GUARD DE NÚMERO · operaciones cuya ruta (growth/price/inverse) aún NO está extraída ──
  if (/\d/.test(normalizeText(trimmed))) {
    return { text: null, route: "not_yet_extracted", intent: (intent && intent.type) || null, suggestions: null, sentrixAction: null, context: ctx };
  }

  // ── ECL-CONT continuation · [5] R4 sku-dev (replica PanelADI L38007-38092 · corre ANTES de D0) ──
  // Dispara cuando NO hay intent nuevo Y hay foco activo (activeResult/investigation · poblado por la raíz).
  // En sesión fresca (los 47 · sin foco) el gate devuelve false → NO toca el single-turn. Opción A:
  // solo R4 sku-dev + MODO 1/2 (extraídos) · MODO 3 (_freshSku/descenso) y R3 (cliente) = deuda ECL-CONT.
  if (ADI_ECL_CONT_FOLLOWUP_ENABLED && intent
      && eclContIsPureContinuation({ derivedClient: null, derivedSku: null, derivedModule: null, derivedMetric: null, conversationContext: ctx })) {
    const _inv = ctx;
    let _contResp = null;
    const _freshSku = !!_inv.lastSkuMentioned && _inv.lastSkuMentionedTurn === _inv.turnCount;
    const _clientCentric = ["client_dive", "client_followup", "client", "profitability_gap"].includes(_inv.investigationLastIntent)
      || (!!_inv.lastClientMentioned && _inv.lastClientMentionedTurn === _inv.turnCount && !_inv.investigationDomain);
    if (_freshSku) { /* MODO 3-2 · composeSkuDeepDive · DEUDA ECL-CONT → no manejar (cae al flujo normal) */ }
    else if (_clientCentric && _inv.lastClientMentioned) {
      // MODO 1 · deepen del cliente vigente (getClientDeepDive ya extraído)
      const _dc = getResponseContext({ activeModule: ctx.activeModule, lastClientMentioned: _inv.lastClientMentioned, lastModuleConsulted: _inv.lastModuleAsked, turnCount: _inv.turnCount, userInputText: trimmed });
      _contResp = getClientDeepDive(_inv.lastClientMentioned, scenario, _dc);
    }
    else if (_inv.activeResult && _inv.activeResult.entityType === "cliente" && Array.isArray(_inv.activeResult.entities) && _inv.activeResult.entities.length > 0) {
      /* R3 account-dev · composeAccountDevelopment entra con [8] · DEUDA → no manejar (cae al flujo normal) */
    }
    else if (VOICE_R4_SKU_DEV_ENABLED && _inv.activeResult && _inv.activeResult.entityType === "sku" && Array.isArray(_inv.activeResult.entities) && _inv.activeResult.entities.length > 0) {
      // ADI Core · 2.2a · ANTI-FUGA (guardrail · R4): el sku-dev es inventario · si el muro lo bloquea,
      // AVISA igual que el single-turn (mismo _plainWrap · mensaje byte-idéntico) en vez de surfacear capital/rotación.
      if (ADI_MT_SAFETY_ENABLED && !isAvailable("inventario"))
        return _plainWrap({ opener: unavailableMessage("inventario") }, "mt_safety_inventory_avisar", ctx);
      // R4 · sku-dev ([5] "profundizá en ese") · composeSkuDevelopment lee activeResult (set estable)
      _contResp = composeSkuDevelopment(_inv.activeResult, scenario);
    }
    else {
      // MODO 2 · re-entrar el dominio vigente (composeModuleOverview ya extraído)
      const _md = _inv.investigationDomain || ctx.activeModule;
      // ADI Core · 2.2a · ANTI-FUGA (guardrail · MODE 2): si la continuación re-entra inventario y el muro lo bloquea, AVISA.
      if (ADI_MT_SAFETY_ENABLED && _md === "inventario" && !isAvailable("inventario"))
        return _plainWrap({ opener: unavailableMessage("inventario") }, "mt_safety_inventory_avisar", ctx);
      _contResp = composeModuleOverview(scenario, _md);
    }
    if (_contResp && _contResp.opener) return _finalize(_contResp, "ecl_cont_continuation", "ecl_cont_continuation", ctx, scenario, null);
  }

  // ── CASCADA D0 · type "generic" · ANTES de la capa tardía (fix de orden · replica piso L38093-38131) ──
  // El piso corre D0.a → D0.b → D0.c → (resolveIntentLayer || fallback): D0 va ANTES de resolveIntentLayer.
  // El modular antes corría la capa tardía primero, desviando queries que D0 debía capturar (ej.
  // "me preocupa el negocio" → late_layer en vez de d0a→dependency_risk). Ahora D0 corre primero.
  // Léxicos cerrados disjuntos · responses (dive/mecanismo/overview) van por _finalize (intent=null · sin ETLG).
  if (intent && intent.type === "generic") {
    const _mod = ctx.activeModule || null;
    if (ADI_D0A_ANOMALY_ROUTER_ENABLED) {
      const _d0a = detectAnomalyIntent(trimmed, ctx, scenario, _mod);
      if (_d0a && _d0a.response && _d0a.response.opener) return _finalize(_d0a.response, "d0a_anomaly", "d0a_anomaly", ctx, scenario, null);
    }
    if (ADI_D0B_OPPORTUNITY_ROUTER_ENABLED) {
      const _d0b = detectOpportunityIntent(trimmed, ctx, scenario, _mod);
      if (_d0b && _d0b.response && _d0b.response.opener) return _finalize(_d0b.response, "d0b_opportunity", "d0b_opportunity", ctx, scenario, null);
    }
    if (ADI_D0C_EXPLORATION_ROUTER_ENABLED) {
      const _d0c = detectExplorationIntent(trimmed, ctx, scenario, _mod);
      if (_d0c && _d0c.response && _d0c.response.opener) return _finalize(_d0c.response, "d0c_exploration", "d0c_exploration", ctx, scenario, null);
    }
  }

  // ── LATE LAYER v1 · módulo desnudo / ambigüedad (= resolveIntentLayer del piso · _ilResult2 para generic) ──
  const late = FEATURE_INTENT_LAYER ? resolveIntentLayer(trimmed, scenario, ctx) : null;
  if (late) {
    return _finalize(late, "late_layer", late.intent || "module_overview", ctx, scenario, _overviewLeadIntent(trimmed));
  }

  // ── BRIEF K · type "module" no-overview → honest fallback (replica PanelADI L37843-37868) ──
  // El piso hace `resolveIntentLayer(...) || composeGlobalHonestFallback(...)`: la capa tardía ya
  // corrió arriba y devolvió null, así que acá cae el fallback. Gate verbatim L37852-37855.
  // modulo = módulo ACTIVO (no intent.modulo) · espejando la firma del piso L37861.
  if (intent && intent.type === "module"
      && VOICE_GLOBAL_HONEST_FALLBACK_ENABLED
      && !_isExplicitModuleOverviewQuery(trimmed)
      && !(ADI_BARE_MODULE_OVERVIEW_ENABLED && _isBareModuleWord(trimmed))
      && !(intent._ventasTotalGlobal)) {
    const fb = composeGlobalHonestFallback(trimmed, ctx, ctx.activeModule || intent.modulo || null, scenario);
    if (fb && fb.opener) return _fallbackWrap(ADI_SMART_GUIDE_ENABLED ? { ...fb, opener: composeSmartGuide(trimmed) } : fb, "global_honest_fallback", "global_honest_fallback", ctx, scenario);
  }

  // ── HONEST FALLBACK · type "generic" · cierre de la cascada DEFAULT (replica PanelADI L38125) ──
  // D0.a/b/c ya corrieron ARRIBA (antes de la capa tardía) · resolveIntentLayer también (null acá).
  // Espeja `_ilResult2 || composeGlobalHonestFallback`: la capa tardía fue null → cae el fallback final.
  // disambiguation + ECL-CONT (anteriores en el piso) son multi-turno → inertes single-turn (deuda conocida).
  if (intent && intent.type === "generic") {
    const _fb = composeGlobalHonestFallback(trimmed, ctx, ctx.activeModule || null, scenario);
    if (_fb && _fb.opener) return _fallbackWrap(ADI_SMART_GUIDE_ENABLED ? { ..._fb, opener: composeSmartGuide(trimmed) } : _fb, "global_honest_fallback", "global_honest_fallback", ctx, scenario);
  }

  // ── ramas aún no extraídas ──
  return { text: null, route: "not_yet_extracted", intent: (intent && intent.type) || null, suggestions: null, sentrixAction: null, context: ctx };
}
