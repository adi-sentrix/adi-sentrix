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
import { detectIntent } from "./router.js";
import { composeBrandDive } from "./composers/brand.js";
import { composeWarehouseComparison, composeWarehouseAnalysis } from "./composers/warehouse.js";
import { composeClientComparison, composeBrandComparison } from "./composers/comparisons.js";
import { executiveLanguageDetector, queryInterpreter, composeRetrieval } from "./composers/qiRetrieval.js";
import { detectAnomalyIntent, detectOpportunityIntent, detectExplorationIntent } from "./composers/d0Cascade.js";
import { composeClientMetricFollowUp } from "./composers/followups.js";
import { applyInvestigationContext, _d1ExtractCause, _d1fResolveEntityName } from "./deepThreading.js";
import { eclContIsPureContinuation, composeSkuDevelopment } from "./eclCont.js";
import { composeModuleOverview } from "./composers/overview.js";
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
import { VOICE_RANKING_EXTREMES_ENABLED, ADI_RANKING_WITH_METRICS_ENABLED, ADI_ECL_VOICE_POLISH_ENABLED, VOICE_GLOBAL_HONEST_FALLBACK_ENABLED, ADI_BARE_MODULE_OVERVIEW_ENABLED, ADI_D0A_ANOMALY_ROUTER_ENABLED, ADI_D0B_OPPORTUNITY_ROUTER_ENABLED, ADI_D0C_EXPLORATION_ROUTER_ENABLED, ADI_CTX_THREADING_ENABLED, ADI_FOLLOWUP_CLIENT_METRIC_ENABLED, VOICE_ACTIVE_RESULT_ENABLED, VOICE_DEUDA_J_ENABLED, VOICE_D1_CAUSE_ENABLED, VOICE_D1F_ENTITY_SANITIZE_ENABLED, ADI_ECL_CONT_FOLLOWUP_ENABLED, VOICE_R4_SKU_DEV_ENABLED } from "../config/voiceFlags.js";
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
  const nextCtx = { ...ctx, turnCount: (ctx.turnCount || 0) + 1 };
  if (text && ctx.observationEmittedScenario !== scenario) {
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
    sentrixAction: resp.sentrixAction || null,
    intent: intentLabel,
    route,
    context: nextCtx,
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
    if (Array.isArray(_payload.clientes) && _payload.clientes.length > 0) nextCtx.lastClientList = _payload.clientes;
    if (Array.isArray(_payload.skus) && _payload.skus.length > 0) nextCtx.lastSkuList = _payload.skus;
  }
  // QI populates context (replica piso L37302-37314) · entities/entityDim de composeRetrieval ·
  // override de módulo (cliente→margenes · sku→inventario) para el deepContext del dive deíctico.
  if (resp && Array.isArray(resp.entities) && resp.entities.length >= 2) {
    if (resp.entityDim === "cliente") { nextCtx.lastClientList = resp.entities; nextCtx.lastModuleAsked = "margenes"; }
    else if (resp.entityDim === "sku" || resp.entityDim === "producto") { nextCtx.lastSkuList = resp.entities; nextCtx.lastModuleAsked = "inventario"; }
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
}

// wrap plano · sin ECL/suffix (rutas que en el piso corren ANTES del punto de suffix · ej. inversa)
const _plainWrap = (resp, route, ctx) => ({
  text: resp.opener,
  suggestions: (resp.suggestions && resp.suggestions.length) ? resp.suggestions : null,
  sentrixAction: resp.sentrixAction || null,
  intent: route,
  route,
  context: { ...ctx, turnCount: (ctx.turnCount || 0) + 1 },
});

// wrap fallback · opener (con applyVoiceCalibration interno) + SOLO suffix.
// El honest fallback SKIP-ea FASE 5 narrativa/ETLG/ECL (composer emite narrativa propia · L11981)
// pero SÍ recibe la observación aditiva. Replica el gate de sesión de _finalize.
const _fallbackWrap = (resp, route, intentLabel, ctx, scenario) => {
  let text = resp.opener;
  const nextCtx = { ...ctx, turnCount: (ctx.turnCount || 0) + 1 };
  if (text && ctx.observationEmittedScenario !== scenario) {
    const sfx = virtuousExceptionSuffix(scenario);
    if (sfx) { text = text + "\n\n" + sfx; nextCtx.observationEmittedScenario = scenario; }
  }
  return {
    text,
    suggestions: (resp.suggestions && resp.suggestions.length) ? resp.suggestions : null,
    sentrixAction: resp.sentrixAction || null,
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
    if (response) return _finalize(response, "ranking_extremes", "ranking_extremes", ctx, scenario, intent);
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

export function answerADI(question, context = {}, state = {}) {
  const scenario = (state && state.scenario) || "bonanza";
  const trimmed = (question || "").trim();
  const ctx = context || {};

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
        return _plainWrap({ opener: _q + _optTxt }, "simulation_needs_precision", ctx);
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
    return _finalize(early, "early_gate", early.intent || "module_overview", ctx, scenario, _overviewLeadIntent(trimmed));
  }

  // ── detectIntent → dispatch de cascada (ramas de anclas extraídas) ──
  let intent = detectIntent(trimmed, ctx);
  // ranking-extremes re-detection (replica PanelADI L37143) · puede sobrescribir intent
  if (VOICE_RANKING_EXTREMES_ENABLED) {
    const _re = detectRankingExtremesIntent(trimmed, ctx);
    if (_re) intent = _re;
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
      // R4 · sku-dev ([5] "profundizá en ese") · composeSkuDevelopment lee activeResult (set estable)
      _contResp = composeSkuDevelopment(_inv.activeResult, scenario);
    }
    else {
      // MODO 2 · re-entrar el dominio vigente (composeModuleOverview ya extraído)
      _contResp = composeModuleOverview(scenario, _inv.investigationDomain || ctx.activeModule);
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
    if (fb && fb.opener) return _fallbackWrap(fb, "global_honest_fallback", "global_honest_fallback", ctx, scenario);
  }

  // ── HONEST FALLBACK · type "generic" · cierre de la cascada DEFAULT (replica PanelADI L38125) ──
  // D0.a/b/c ya corrieron ARRIBA (antes de la capa tardía) · resolveIntentLayer también (null acá).
  // Espeja `_ilResult2 || composeGlobalHonestFallback`: la capa tardía fue null → cae el fallback final.
  // disambiguation + ECL-CONT (anteriores en el piso) son multi-turno → inertes single-turn (deuda conocida).
  if (intent && intent.type === "generic") {
    const _fb = composeGlobalHonestFallback(trimmed, ctx, ctx.activeModule || null, scenario);
    if (_fb && _fb.opener) return _fallbackWrap(_fb, "global_honest_fallback", "global_honest_fallback", ctx, scenario);
  }

  // ── ramas aún no extraídas ──
  return { text: null, route: "not_yet_extracted", intent: (intent && intent.type) || null, suggestions: null, sentrixAction: null, context: ctx };
}
