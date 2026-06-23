/* === adi/composers/d0Cascade.js ===
 * ADI conversacional extraído de 41cc33d8 · verbatim · solo imports agregados.
 * Los tres routers léxicos D0 (anomalía / oportunidad / exploración) que se
 * sientan ANTES del honest-fallback en el pipeline del monolito. Cero cambio de
 * cálculo · gate de supresión _d0SuppressionGate definido UNA sola vez (compartido). */
import { _normalizeSemanticText } from "../router.js";
import { detectClientInText } from "../detectors.js";
import { getClientDeepDive } from "./clientDive.js";
import { scanMechanisms } from "./thesis.js";
import { composeMechanismResponse, composeMechanismScan } from "./mechanisms.js";
import { composeModuleOverview } from "./overview.js";
import { SEMANTIC_INTENTS } from "../../config/routerData.js";
import {
  ADI_D0A_ANOMALY_ROUTER_ENABLED,
  ADI_D0B_OPPORTUNITY_ROUTER_ENABLED,
  ADI_D0C_EXPLORATION_ROUTER_ENABLED,
} from "../../config/voiceFlags.js";

// ═══ ENCARGO D0.a · ANOMALÍA IMPLÍCITA DETERMINÍSTICA · cero LLM ═══
// Intercepta frases de anomalía/tensión que HOY caen a composeGlobalHonestFallback y las
// rutea a un composer EXISTENTE: con entidad → dive de la cuenta (ángulo anomaly) · sin
// entidad → el mecanismo MÁS MATERIAL del escenario (scanMechanisms · NO lista fija).
// SOLO captura si la anomalía es la intención DOMINANTE (gate de 6 pasos · léxico cerrado).
// off = byte-idéntico (el else-if no existe). NO crea composers, NO toca cifras, NO LLM.

// ── léxico cerrado de anomalía (determinístico · auditable) ──
const _D0A_ANOMALY_MARKERS = [
  "raro", "extrano", "extraño", "no me cierra", "no cuadra", "no calza",
  "me preocupa", "no me gusta", "algo esta mal", "algo está mal",
  "algo no anda", "se ve mal", "no me suena", "no me cuadra",
];
// ── marcadores de LISTADO/RANKING (intención de enumerar · suprime D0.a) ──
const _D0A_LISTING_MARKERS = ["cuales son", "cuáles son", "muestrame los", "muéstrame los", "muestrame las", "lista de", "listame", "top ", "ranking", "cuales clientes", "qué clientes", "que clientes", "qué productos", "que productos"];
// ── marcadores de MEDIDA/CUANTIFICACIÓN (suprime D0.a) ──
const _D0A_MEASURE_MARKERS = ["cuanto", "cuánto", "que fraccion", "qué fracción", "representa", "cuantos", "cuántos", "cuanta", "cuánta"];
// ── exclusiones GD0-1 (fuera de D0.a por decisión firmada) ──
const _D0A_GD01_EXCLUSIONS = ["no me convence", "no entendi", "no entendí", "explicame", "explícame", "explica mejor"];

// ── _d0aDetectAnomalyMarker(n) · ¿hay patrón de anomalía? (sobre texto normalizado) ──
function _d0aDetectAnomalyMarker(n) {
  try {
    for (const m of _D0A_ANOMALY_MARKERS) if (n.indexOf(m) >= 0) return m;
    return null;
  } catch (e) { return null; }
}

// ── _d0aDominantGate(trimmed) · el gate de intención dominante (6 pasos · §4 aprobado) ──
// Devuelve { pass:true, marker } si la anomalía es dominante; { pass:false, suppressedBy } si no.
// ── _d0SuppressionGate(n) · pasos 1-4 COMPARTIDOS (causal/listing/measure/exclusión) ──
// El motor de supresión común a D0.a y D0.b (GD0b-1 cláusula 5 · reuso literal). Sobre texto
// ya normalizado. Devuelve { suppressed:true, by } si alguna ruta más fuerte aplica, o
// { suppressed:false } si pasa. NO chequea el patrón positivo (eso lo hace cada detector).
function _d0SuppressionGate(n) {
  try {
    if (!n) return { suppressed: true, by: "empty" };
    // paso 1 · marcador CAUSAL dominante (léxico del motor · cause_query)
    const causalMarkers = (typeof SEMANTIC_INTENTS !== "undefined" && SEMANTIC_INTENTS.cause_query
      && SEMANTIC_INTENTS.cause_query.vocabulary_markers) || [];
    for (const c of causalMarkers) if (n.indexOf(c) >= 0) return { suppressed: true, by: "causal:" + c };
    // paso 2 · marcador de LISTADO/RANKING dominante
    for (const l of _D0A_LISTING_MARKERS) if (n.indexOf(l) >= 0) return { suppressed: true, by: "listing:" + l };
    // paso 3 · marcador de MEDIDA/CUANTIFICACIÓN dominante (+ decision_query del motor)
    const decisionMarkers = (typeof SEMANTIC_INTENTS !== "undefined" && SEMANTIC_INTENTS.decision_query
      && SEMANTIC_INTENTS.decision_query.vocabulary_markers) || [];
    for (const d of _D0A_MEASURE_MARKERS.concat(decisionMarkers)) if (n.indexOf(d) >= 0) return { suppressed: true, by: "measure:" + d };
    // paso 4 · exclusiones GD0-1
    for (const x of _D0A_GD01_EXCLUSIONS) if (n.indexOf(x) >= 0) return { suppressed: true, by: "gd01:" + x };
    return { suppressed: false };
  } catch (e) { return { suppressed: true, by: "error" }; }
}

function _d0aDominantGate(trimmed) {
  try {
    const n = _normalizeSemanticText(trimmed);
    if (!n) return { pass: false, suppressedBy: "empty" };
    // pasos 1-4 · supresión compartida
    const sup = _d0SuppressionGate(n);
    if (sup.suppressed) return { pass: false, suppressedBy: sup.by };
    // paso 5 · ¿hay patrón de anomalía? (red de seguridad · si no, no es D0.a)
    const marker = _d0aDetectAnomalyMarker(n);
    if (!marker) return { pass: false, suppressedBy: "no_anomaly_marker" };
    // paso 6 · pasó todo → la anomalía es dominante
    return { pass: true, marker };
  } catch (e) { return { pass: false, suppressedBy: "error" }; }
}

// ── _d0aResolveMaterialMechanism(scenario) · el mecanismo MÁS MATERIAL (§5 · NO lista fija) ──
// Reusa scanMechanisms (Evidencia Única). Ranking: impacto $ absoluto → severidad → ID estable.
function _d0aResolveMaterialMechanism(scenario) {
  try {
    const scan = (typeof scanMechanisms === "function") ? scanMechanisms(scenario) : null;
    if (!scan) return null;
    // normalizar impacto económico a $K anuales desde el campo de agregado de cada mecanismo
    const _impactK = (id, m) => {
      const agg = (m && m.aggregate) || {};
      if (id === "commercial_erosion") {
        if (typeof agg.recuperable_total_K === "number") return agg.recuperable_total_K;
        if (typeof agg.recuperable_total_M_at_3_5 === "number") return agg.recuperable_total_M_at_3_5 * 1000;
      }
      if (id === "quality_of_growth_deterioration" && typeof agg.contribucion_perdida_M === "number") return agg.contribucion_perdida_M * 1000;
      if (id === "customer_dependency_risk" && typeof agg.top3_contribucion_M === "number") return agg.top3_contribucion_M * 1000;
      if (typeof agg.capital_inmovilizado_K === "number") return agg.capital_inmovilizado_K;
      if (typeof agg.total_stockUSD === "number") return agg.total_stockUSD / 1000;
      return 0;
    };
    const _maxSeverity = (m) => {
      const order = { critico: 3, crítico: 3, alto: 2, atencion: 1, atención: 1, bajo: 0 };
      let mx = -1;
      for (const inst of (m.instances || [])) { const s = order[inst.severity] != null ? order[inst.severity] : 0; if (s > mx) mx = s; }
      return mx;
    };
    // elegibles: triggered Y con composer existente (los 3 con composer dedicado + los de scan)
    const COMPOSER_EXISTS = ["commercial_erosion", "quality_of_growth_deterioration", "customer_dependency_risk", "trapped_capital", "liquidity_compression"];
    const elegibles = Object.entries(scan)
      .filter(([id, m]) => m && m.triggered && COMPOSER_EXISTS.indexOf(id) >= 0)
      .map(([id, m]) => ({ id, m, impactK: _impactK(id, m), severity: _maxSeverity(m) }));
    if (elegibles.length === 0) return null;
    // ranking determinístico: impacto $ desc → severidad desc → ID alfabético asc (tie-break estable)
    elegibles.sort((a, b) => {
      if (b.impactK !== a.impactK) return b.impactK - a.impactK;        // paso 1 · impacto absoluto
      if (b.severity !== a.severity) return b.severity - a.severity;     // paso 2 · severidad
      return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);                   // paso 4 · ID estable
    });
    const top = elegibles[0];
    const reason = top.impactK > 0 ? ("impacto_$" + Math.round(top.impactK) + "K")
      : (top.severity >= 0 ? "severidad" : "tie_break_id");
    return { mechanismId: top.id, materialityReason: reason, impactK: top.impactK };
  } catch (e) { return null; }
}

// ── detectAnomalyIntent(trimmed, ctx, scenario, modulo) · el router D0.a ──
// Devuelve null (no_match) | { route, response, debug }. route: "dive" | "mechanism" | "overview".
export function detectAnomalyIntent(trimmed, ctx, scenario, modulo) {
  const debug = { matchedPattern: null, dominantIntentPassed: false, suppressedByStrongerRoute: false, strongerRouteDetected: null, hasEntity: false, entityResolved: null, materialitySelectedMechanism: null, materialityReason: null, routeDestination: null, fallbackPrevented: false, flagEnabled: true };
  try {
    if (typeof ADI_D0A_ANOMALY_ROUTER_ENABLED === "undefined" || !ADI_D0A_ANOMALY_ROUTER_ENABLED) { debug.flagEnabled = false; return null; }
    const gate = _d0aDominantGate(trimmed);
    debug.matchedPattern = gate.marker || null;
    if (!gate.pass) {
      debug.suppressedByStrongerRoute = !!(gate.suppressedBy && gate.suppressedBy !== "no_anomaly_marker" && gate.suppressedBy !== "empty");
      debug.strongerRouteDetected = gate.suppressedBy || null;
      return null; // no_match · el flujo normal continúa
    }
    debug.dominantIntentPassed = true;
    // (a) anomalía CON entidad → dive existente + ángulo anomaly
    const entity = (typeof detectClientInText === "function") ? detectClientInText(trimmed) : null;
    if (entity) {
      debug.hasEntity = true; debug.entityResolved = entity;
      const resp = getClientDeepDive(entity, scenario, { ...(ctx || {}), d0aAngle: "anomaly" });
      debug.routeDestination = "dive:" + entity; debug.fallbackPrevented = true;
      return { route: "dive", response: resp, debug };
    }
    // (b) anomalía SIN entidad → mecanismo MÁS MATERIAL (§5)
    const mat = _d0aResolveMaterialMechanism(scenario);
    if (mat && mat.mechanismId) {
      debug.materialitySelectedMechanism = mat.mechanismId; debug.materialityReason = mat.materialityReason;
      const resp = composeMechanismResponse(mat.mechanismId, scenario);
      debug.routeDestination = "mechanism:" + mat.mechanismId; debug.fallbackPrevented = true;
      return { route: "mechanism", response: resp, debug };
    }
    // (c) sin mecanismo elegible → overview material existente
    if (typeof composeModuleOverview === "function") {
      const resp = composeModuleOverview(scenario, modulo || "ventas");
      debug.routeDestination = "overview"; debug.fallbackPrevented = true;
      return { route: "overview", response: resp, debug };
    }
    // (d) nada seguro → dejar pasar al fallback honesto
    return null;
  } catch (e) { return null; }
}
// ═══ FIN ENCARGO D0.a · símbolos top-level ═══

// ═══ ENCARGO D0.b · OPORTUNIDAD DIFUSA DETERMINÍSTICA · cero LLM (GD0b-1) ═══
// Cuando el gerente insinúa OPORTUNIDAD/upside ("dónde gano más", "plata sobre la mesa",
// "margen que no capturo") y la frase cae al fallback, ADI rutea al UPSIDE recuperable
// (commercial_erosion · destino fijo · el único con recuperable). Reusa el gate de D0.a.
// Las 4 condiciones de honestidad: si no hay recuperable válido → fallback, NO inventa upside.
// Léxico DISJUNTO de D0.a (anomalía≠oportunidad). off = byte-idéntico (el else-if no existe).

// ── léxico de oportunidad (cerrado · DISJUNTO de _D0A_ANOMALY_MARKERS · §2) ──
const _D0B_OPPORTUNITY_MARKERS = [
  "dejando plata", "plata sobre la mesa", "no capturando", "margen que no",
  "ganar mas", "ganar más", "sacar mas", "sacar más", "aprovechar",
  "no estoy aprovechando", "plata que no estoy viendo", "plata que no veo",
  "oportunidad que me pierdo", "podriamos aprovechar", "podríamos aprovechar",
  "puedo ganar", "puedo sacar", "margen para mejorar",
];

// ── _d0bDetectOpportunityMarker(n) · ¿hay patrón de oportunidad? (texto normalizado) ──
function _d0bDetectOpportunityMarker(n) {
  try {
    for (const m of _D0B_OPPORTUNITY_MARKERS) if (n.indexOf(m) >= 0) return m;
    return null;
  } catch (e) { return null; }
}

// ── _d0bDominantGate(trimmed) · reusa el motor de supresión de D0.a (GD0b-1 cláusula 5) ──
// Mismos pasos 1-4 (causal/listing/measure/exclusión) vía _d0SuppressionGate; paso 5 con el
// léxico de OPORTUNIDAD en vez de anomalía.
function _d0bDominantGate(trimmed) {
  try {
    const n = _normalizeSemanticText(trimmed);
    if (!n) return { pass: false, suppressedBy: "empty" };
    const sup = _d0SuppressionGate(n); // pasos 1-4 COMPARTIDOS con D0.a
    if (sup.suppressed) return { pass: false, suppressedBy: sup.by };
    const marker = _d0bDetectOpportunityMarker(n);
    if (!marker) return { pass: false, suppressedBy: "no_opportunity_marker" };
    return { pass: true, marker };
  } catch (e) { return { pass: false, suppressedBy: "error" }; }
}

// ── _d0bResolveRecoverable(scenario) · las 4 condiciones de GD0b-1 (cláusula 3) ──
// Antes de rutear a commercial_erosion, chequear: (a) activo, (b) composer seguro,
// (c) evidencia, (d) recuperable válido. Si CUALQUIERA falla → null → fallback honesto.
function _d0bResolveRecoverable(scenario) {
  try {
    const scan = (typeof scanMechanisms === "function") ? scanMechanisms(scenario) : null;
    if (!scan) return null;
    const ce = scan["commercial_erosion"];
    if (!ce || !ce.triggered) return null;                              // (a) no activo
    if (typeof composeMechanismResponse !== "function") return null;    // (b) sin composer seguro
    if (!ce.instances || ce.instances.length === 0) return null;        // (c) sin evidencia
    const recuperable = ce.aggregate && ce.aggregate.recuperable_total_K;
    if (!recuperable || recuperable <= 0) return null;                  // (d) sin recuperable válido
    return { mechanism: "commercial_erosion", recuperable };            // upside válido
  } catch (e) { return null; }
}

// ── detectOpportunityIntent(trimmed, ctx, scenario, modulo) · el router D0.b ──
// Devuelve null (no_match) | { route, response, debug }.
export function detectOpportunityIntent(trimmed, ctx, scenario, modulo) {
  const debug = { matchedPattern: null, dominantIntentPassed: false, suppressedBy: null, commercialErosionActive: false, recoverableAmount: null, fallbackHonestUsed: false, routeDestination: null, flagEnabled: true };
  try {
    if (typeof ADI_D0B_OPPORTUNITY_ROUTER_ENABLED === "undefined" || !ADI_D0B_OPPORTUNITY_ROUTER_ENABLED) { debug.flagEnabled = false; return null; }
    const gate = _d0bDominantGate(trimmed);
    debug.matchedPattern = gate.marker || null;
    if (!gate.pass) { debug.suppressedBy = gate.suppressedBy || null; return null; } // no_match
    debug.dominantIntentPassed = true;
    // las 4 condiciones de recuperable (GD0b-1 cláusula 3)
    const rec = _d0bResolveRecoverable(scenario);
    if (!rec) {
      // I-D0b-HONESTO · NO inventa upside · deja pasar al fallback honesto (GD0b-1 cláusula 4)
      debug.fallbackHonestUsed = true; debug.routeDestination = "fallback_honest";
      return null;
    }
    debug.commercialErosionActive = true; debug.recoverableAmount = rec.recuperable;
    const resp = composeMechanismResponse("commercial_erosion", scenario);
    debug.routeDestination = "mechanism:commercial_erosion";
    return { route: "mechanism", response: resp, debug };
  } catch (e) { return null; }
}
// ═══ FIN ENCARGO D0.b · símbolos top-level ═══

// ═══ ENCARGO D0.c · EXPLORACIÓN VAGA DETERMINÍSTICA · cero LLM (GD0c-1) ═══
// Cuando el gerente explora SIN dirección ("sorprendeme", "mostrame algo interesante",
// "qué debería mirar", "ayudame a entender el negocio") y la frase cae al fallback, ADI la
// rutea al PANORAMA transversal (composeMechanismScan · el mismo que "dame un panorama").
// Destino FIJO: todas las vagas convergen al mismo panorama (no se personaliza por frase).
// Léxico DISJUNTO de D0.a Y D0.b (frontera triple). Reusa el gate compartido SIN cambios.
// off = byte-idéntico (el else-if no existe). El ÚLTIMO corte de D0.

// ── léxico de exploración (cerrado · DISJUNTO de _D0A_ANOMALY_MARKERS y _D0B_OPPORTUNITY_MARKERS) ──
// NO incluye "qué me estoy perdiendo" (GD0c-1 cláusula 5 · ya rutea vía cross_domain).
const _D0C_EXPLORATION_MARKERS = [
  "mostrame algo", "mostrame algo interesante", "mostrame lo importante",
  "sorprendeme", "sorpréndeme", "que deberia mirar", "qué debería mirar",
  "que tengo que saber", "qué tengo que saber", "por donde miro", "por dónde miro",
  "por donde parto", "por dónde parto", "que hay de interesante", "qué hay de interesante",
  "ayudame a entender", "ayúdame a entender", "que es lo importante", "qué es lo importante",
];

// ── _d0cDetectExplorationMarker(n) · ¿hay patrón de exploración? (texto normalizado) ──
function _d0cDetectExplorationMarker(n) {
  try {
    for (const m of _D0C_EXPLORATION_MARKERS) if (n.indexOf(m) >= 0) return m;
    return null;
  } catch (e) { return null; }
}

// ── _d0cDominantGate(trimmed) · reusa el motor de supresión compartido (GD0c-1 cláusula 6) ──
// Mismos pasos 1-4 (causal/listing/measure/exclusión) vía _d0SuppressionGate; paso 5 con el
// léxico de EXPLORACIÓN. El marcador de listing es "muéstrame los" (con artículo) → "mostrame
// algo"/"mostrame lo importante" NO se suprimen falsamente.
function _d0cDominantGate(trimmed) {
  try {
    const n = _normalizeSemanticText(trimmed);
    if (!n) return { pass: false, suppressedBy: "empty" };
    const sup = _d0SuppressionGate(n); // pasos 1-4 COMPARTIDOS con D0.a y D0.b
    if (sup.suppressed) return { pass: false, suppressedBy: sup.by };
    const marker = _d0cDetectExplorationMarker(n);
    if (!marker) return { pass: false, suppressedBy: "no_exploration_marker" };
    return { pass: true, marker };
  } catch (e) { return { pass: false, suppressedBy: "error" }; }
}

// ── detectExplorationIntent(trimmed, ctx, scenario, modulo) · el router D0.c ──
// Devuelve null (no_match) | { route, response, debug }. Destino FIJO: composeMechanismScan.
export function detectExplorationIntent(trimmed, ctx, scenario, modulo) {
  const debug = { matchedPattern: null, dominantIntentPassed: false, suppressedBy: null, routeDestination: null, flagEnabled: true };
  try {
    if (typeof ADI_D0C_EXPLORATION_ROUTER_ENABLED === "undefined" || !ADI_D0C_EXPLORATION_ROUTER_ENABLED) { debug.flagEnabled = false; return null; }
    const gate = _d0cDominantGate(trimmed);
    debug.matchedPattern = gate.marker || null;
    if (!gate.pass) { debug.suppressedBy = gate.suppressedBy || null; return null; } // no_match
    debug.dominantIntentPassed = true;
    // destino FIJO · el panorama transversal (GD0c-1 cláusula 1) · NO personaliza por frase
    if (typeof composeMechanismScan !== "function") return null; // seguridad · sin composer → fallback
    const resp = composeMechanismScan(scenario);
    debug.routeDestination = "panorama:composeMechanismScan";
    return { route: "panorama", response: resp, debug };
  } catch (e) { return null; }
}
// ═══ FIN ENCARGO D0.c · símbolos top-level ═══
