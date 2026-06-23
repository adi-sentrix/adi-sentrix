/* === adi/composers/executiveAction.js ===
 * ADI conversacional extraído de 41cc33d8 · verbatim · solo imports agregados.
 * buildNarrativeSignalsForExecutiveAction + helpers ejecutivos (BRIEF N.B.1 · MATERIALITY v1).
 * Dependencia transitiva de buildSimulationState (simulation.js). Cero cambio de cálculo. */
import { MATERIALITY_AXES_ENABLED, HIERARCHY_ENABLED } from "../../config/voiceFlags.js";
import { applyScenarioToClientesVentas, applyScenarioToClientesMargen, applyScenarioToSkuInventario } from "../../engine/scenarios.js";
import { detectInternalDriver, calculateRecoverable } from "../../engine/signals.js";
import { _deriveTierFromContribution } from "./clientDive.js";
import { scanMechanisms } from "./thesis.js";

// ── classifySkuOperationalProfile · perfil individual del SKU (L11476) · módulo-local verbatim ──
function classifySkuOperationalProfile(sku) {
  if (sku.doh > 90 && sku.rotacion < 3) return "operational_inefficient";
  if (sku.doh <= 90 && sku.rotacion >= 3) return "high_volume_healthy";
  return "borderline";
}

// ── BRIEF N.B.1 · helpers ejecutivos ───────────────────────────────────────
// Scoring weights firmados founder D-N-1: 0.4 impact · 0.4 controllability · 0.2 urgency
const _EXEC_WEIGHTS = { impact: 0.4, controllability: 0.4, urgency: 0.2 };
const _EXEC_CTRL_MAP = { alta: 1.0, media: 0.6, baja: 0.3 };
const _EXEC_URG_MAP  = { critica: 1.0, atencion: 0.6, seguir: 0.3 };

function _scoreExecutiveAction(impactK, controllability, urgency) {
  // impactK normalizado: 1.0 = $1M+ · escala lineal por debajo
  const impactNorm = Math.min(1, Math.max(0, impactK / 1000));
  const ctrl = _EXEC_CTRL_MAP[controllability] || 0.3;
  const urg = _EXEC_URG_MAP[urgency] || 0.3;
  return +(
    impactNorm * _EXEC_WEIGHTS.impact +
    ctrl * _EXEC_WEIGHTS.controllability +
    urg * _EXEC_WEIGHTS.urgency
  ).toFixed(3);
}

// ── _deriveOpportunityAxes · MATERIALITY v1 · 5 ejes firmados sobre cada candidato ──
// NO score · NO ponderación · ejes OBSERVABLES y separados (valor_anual vs capital · regla de oro).
// Reusa _deriveTierFromContribution (L9022) para riesgo · _EXEC_CTRL_MAP como insumo de esfuerzo (NO peso).
const MATERIALITY_COMPLETE = true;  // MATERIALITY v1 · cierre formal · paridad VOICE_BRIEF_*_COMPLETE / ARCO
function _deriveOpportunityAxes(candidate, scenarioId) {
  if (!candidate) return null;
  const t = candidate.type;
  // EJE valor_anual vs capital_liberable · SEPARADOS por naturaleza (nunca sumar)
  let valor_anual = null, capital_liberable = null;
  if (t === "commercial_load_renegotiation") {
    valor_anual = candidate.recoverable_K || 0;        // flujo recurrente anual
  } else if (t === "sku_operational_exit") {
    capital_liberable = candidate.recoverable_K || 0;  // capital one-time liberable
  } else if (t === "tier2_diversification") {
    // Concentración: valor en RIESGO (exposed_M), NO captura ni capital liberable (firmado v1.1-B).
    // exposed_M queda como CONTEXTO NARRATIVO · NO es eje. valor/capital permanecen null.
    valor_anual = null; capital_liberable = null;
  } else {
    valor_anual = null; capital_liberable = null;
  }
  // EJE riesgo · ordinal alto/medio/bajo
  let riesgo = "bajo";
  if (t === "commercial_load_renegotiation") {
    // entities son clientes · riesgo = mayor Tier entre las entities (T1=alto · T2=medio · T3=bajo)
    try {
      // clientesVentas NO tiene campo `tipo` (sí clientesMargen) · patrón canónico L9120: sin filtro.
      const ventasScope = applyScenarioToClientesVentas(scenarioId);
      let maxTierRank = 0; // 0=bajo · 1=medio · 2=alto
      for (const name of (candidate.entities || [])) {
        const ti = _deriveTierFromContribution(name, ventasScope);
        const r = ti ? (ti.tier === 1 ? 2 : (ti.tier === 2 ? 1 : 0)) : 0;
        if (r > maxTierRank) maxTierRank = r;
      }
      riesgo = maxTierRank === 2 ? "alto" : (maxTierRank === 1 ? "medio" : "bajo");
    } catch (e) { riesgo = "bajo"; }
  } else if (t === "sku_operational_exit") {
    // SKUs · capital propio · sin cuenta estratégica en juego · riesgo de concentración bajo (v1)
    riesgo = "bajo";
  } else if (t === "tier2_diversification") {
    // Concentración: riesgo desde concentration_pct · umbral canónico ≥50 (= L11216 severity_threshold_hit)
    // Defendible: "riesgo alto porque 3 cuentas superan la mitad del negocio".
    const _conc = candidate.concentration_pct || 0;
    riesgo = _conc >= 50 ? "alto" : (_conc >= 35 ? "medio" : "bajo");
  }
  // EJE urgencia · del tag existente (critica/atencion/seguir → alta/media/baja)
  const _urgMap = { critica: "alta", atencion: "media", seguir: "baja" };
  const urgencia = _urgMap[candidate.urgency] || "media";
  // EJE esfuerzo · naturaleza de la acción × Tier (Tier agrava SOLO negociación · firmado)
  let esfuerzo;
  if (t === "sku_operational_exit") {
    esfuerzo = "bajo";          // liquidar/plan de salida = unilateral (Tier NO agrava)
  } else if (t === "commercial_load_renegotiation") {
    esfuerzo = (riesgo === "alto") ? "alto" : "medio";  // negociar · agravado si Tier 1
  } else if (t === "tier2_diversification") {
    esfuerzo = "medio";  // diversificar = coordinación estructural · ni unilateral ni negociación pura
  } else {
    esfuerzo = "medio";
  }
  return { valor_anual, capital_liberable, riesgo, urgencia, esfuerzo };
}

// ── _detectExecutiveActions · construye candidatos runtime ────────────────
// Retorna array de candidatos · cada uno pre-scoreado. El builder de signals
// se queda con top 3 por score (NO por orden de detección).
//
// Candidatos detectados:
//   1. Renegociar carga comercial sobre top contribuyentes con driver activo
//      (D-N-6 · D-N.B.1-1 opción b · filtra top-contribuyentes · ordena por recK)
//   2. Plan de salida sobre SKUs operacional_inefficient (cap 3)
//      (D-N-7 · runtime real · 3 SKUs bonanza/tensión · 1 SKU crisis)
//   3. Diversificación Tier 2 (customer_dependency_risk)
function _detectExecutiveActions(scenarioId, override) {
  const actions = [];

  // ── CANDIDATO 1 · renegociar carga top contribuyentes ──
  try {
    const cm = applyScenarioToClientesMargen(scenarioId, override).filter(c => c.tipo === "cliente");
    // Filtro D-N.B.1-1 (b): top contribuyentes con driver carga · luego ordenar por recK
    // Tomamos los 6 mayores contribuyentes como universo (cubre Tier 1+2)
    const topContrib = [...cm].sort((a, b) => (b.contribucion || 0) - (a.contribucion || 0)).slice(0, 6);
    const withDriver = [];
    for (const c of topContrib) {
      const driver = detectInternalDriver(c, "margen", "client", cm);
      if (driver && driver.factor === "carga_comercial") {
        const recK = calculateRecoverable(c, "margen", "client", driver, cm);
        // Recoverable a best practice 3.0% · cálculo paralelo
        const recK_BP = Math.round((c.venta || 0) * Math.max(0, (c.pctRebate || 0) - 3.0) / 100);
        withDriver.push({ nombre: c.nombre, recK, recK_BP, pctRebate: c.pctRebate });
      }
    }
    // Ordenar por recK desc · tomar top 3
    withDriver.sort((a, b) => b.recK - a.recK);
    const top3 = withDriver.slice(0, 3);
    if (top3.length >= 2) {
      const totalRecK = top3.reduce((s, c) => s + c.recK, 0);
      const totalRecK_BP = top3.reduce((s, c) => s + c.recK_BP, 0);
      // MAT-B2 · urgencia crítica si algún cliente del grupo opera bajo costo real (margen < 0 o muy bajo)
      // MAT-B3 · umbral relativo defendible: opera a menos de la mitad del benchmark de cartera.
      // (margen<0 era inalcanzable · clamp Math.max(6,...) · #L-MAT-B2-ELEVACION-AUN-INALCANZABLE)
      const _cargaCrit = top3.some(c => {
        const cm = applyScenarioToClientesMargen(scenarioId, override).find(x => x.nombre === c.nombre);
        const _bench = (cm && cm.benchmark) || 30.1;
        return cm && cm.margen != null && cm.margen < _bench / 2;
      });
      const _cargaUrgency = _cargaCrit ? "critica" : "atencion";
      actions.push({
        type: "commercial_load_renegotiation",
        entities: top3.map(c => c.nombre),
        recoverable_K: totalRecK,
        recoverable_BP_K: totalRecK_BP,
        controllability: "alta",
        urgency: _cargaUrgency,
        verb: "renegociar carga comercial",
        criterion: "alta controlabilidad · horizonte inmediato",
        instance_count: top3.length,
        score: _scoreExecutiveAction(totalRecK, "alta", _cargaUrgency),
      });
    }
  } catch (e) {
    // fail-safe · candidato no se agrega
  }

  // ── CANDIDATO 2 · plan de salida SKUs operacionales ──
  try {
    const inv = applyScenarioToSkuInventario(scenarioId, override);
    // Top 4 capital atrapado (cualquier alerta) · filtrar a operational_inefficient
    const critical = inv
      .filter(s => s.alerta === "crit" || s.alerta === "warn" || s.estado !== "Activo")
      .sort((a, b) => (b.stockUSD || 0) - (a.stockUSD || 0))
      .slice(0, 4);
    const operational = critical
      .filter(s => classifySkuOperationalProfile(s) === "operational_inefficient")
      .slice(0, 3);
    if (operational.length >= 1) {
      const stockK = Math.round(operational.reduce((s, k) => s + (k.stockUSD || 0), 0) / 1000);
      const avgDoh = Math.round(operational.reduce((s, k) => s + (k.doh || 0), 0) / operational.length);
      // MAT-B2 · urgencia derivada del deterioro real (no hardcode): DOH crítico o alerta crit
      const _hasCrit = operational.some(s => s.alerta === "crit") || avgDoh > 150;
      const _invUrgency = _hasCrit ? "critica" : "atencion";
      actions.push({
        type: "sku_operational_exit",
        entities: operational.map(s => s.sku),
        recoverable_K: stockK,
        avg_doh: avgDoh,
        controllability: "alta",
        urgency: _invUrgency,
        verb: "activar plan de salida",
        criterion: _invUrgency === "critica"
          ? "capital atrapado · deterioro crítico · libera liquidez para reinvertir"
          : "capital atrapado · libera liquidez para reinvertir",
        instance_count: operational.length,
        score: _scoreExecutiveAction(stockK, "alta", _invUrgency),
      });
    }
  } catch (e) { /* fail-safe */ }

  // ── CANDIDATO 3 · diversificación Tier 2 (customer_dependency_risk) ──
  try {
    const scan = scanMechanisms(scenarioId, override);
    const dep = scan?.customer_dependency_risk;
    if (dep?.triggered && dep.aggregate) {
      const agg = dep.aggregate;
      // Impacto estructural: el monto expuesto en $M → convertir a K para scoring uniforme
      const exposedK = Math.round((agg.top3_contribucion_M || 0) * 1000);
      // MAT-v1.1-C · urgencia crítica si una cuenta CONCENTRADA opera bajo media benchmark
      // (MISMA señal de deterioro que la carga · MAT-B3 · no se inventa otra definición).
      // Defendible: "dependés de estas cuentas y una opera bajo media benchmark".
      const _cmConc = applyScenarioToClientesMargen(scenarioId, override);
      const _concDeteriorada = (agg.top3_names || []).some(name => {
        const c = _cmConc.find(x => x.nombre === name);
        const _bench = (c && c.benchmark) || 30.1;
        return c && c.margen != null && c.margen < _bench / 2;
      });
      const _concUrgency = _concDeteriorada ? "critica" : "seguir";
      actions.push({
        type: "tier2_diversification",
        entities: agg.top3_names || [],
        concentration_pct: agg.top3_participacion_pct,
        exposed_M: agg.top3_contribucion_M,
        recoverable_K: exposedK,
        controllability: "baja",
        urgency: _concUrgency,
        verb: "activar plan de diversificación Tier 2",
        criterion: _concDeteriorada
          ? "estructural · exposición activa: una cuenta concentrada opera bajo media benchmark"
          : "estructural · horizonte 12-18 meses",
        instance_count: agg.instances_count || 3,
        score: _scoreExecutiveAction(exposedK, "baja", _concUrgency),
      });
    }
  } catch (e) { /* fail-safe */ }

  return actions;
}

// ── _compareByHierarchy · MATERIALITY v1 · jerarquía firmada (NO score) ──
// Nivel 1: elevación (riesgo alto × urgencia alta = riesgo estructural crítico).
// Fuera de nivel 1: valor económico > urgencia > esfuerzo. Reglas nombradas · sin pesos.
const _URG_RANK = { alta: 3, media: 2, baja: 1 };
const _RIESGO_RANK = { alto: 3, medio: 2, bajo: 1 };
const _ESF_RANK = { bajo: 3, medio: 2, alto: 1 }; // menor esfuerzo = mejor (rank más alto)
function _isStructuralCritical(ax) {
  // Regla de elevación nombrada: cuenta estratégica (riesgo alto) Y deterioro activo (urgencia alta)
  return ax && ax.riesgo === "alto" && ax.urgencia === "alta";
}
function _opportunityValue(ax) {
  // valor económico comparable: usa el monto disponible SIN sumar naturalezas distintas.
  // valor_anual y capital_liberable NO se suman · se compara por el que exista (regla de oro).
  // Para ordenar, se toma el monto presente (uno de los dos es null por construcción).
  if (!ax) return 0;
  if (ax.valor_anual != null) return ax.valor_anual;
  if (ax.capital_liberable != null) return ax.capital_liberable;
  return 0;
}
function _compareByHierarchy(a, b) {
  const ax = a.axes, bx = b.axes;
  // NIVEL 1 · elevación
  const aCrit = _isStructuralCritical(ax), bCrit = _isStructuralCritical(bx);
  if (aCrit !== bCrit) return aCrit ? -1 : 1;
  // FUERA de nivel 1 · jerarquía valor > urgencia > esfuerzo
  // 1. valor económico (desc)
  const av = _opportunityValue(ax), bv = _opportunityValue(bx);
  if (av !== bv) return bv - av;
  // 2. urgencia (desc)
  const au = _URG_RANK[ax?.urgencia] || 0, bu = _URG_RANK[bx?.urgencia] || 0;
  if (au !== bu) return bu - au;
  // 3. esfuerzo (menor esfuerzo primero · _ESF_RANK ya invertido)
  const ae = _ESF_RANK[ax?.esfuerzo] || 0, be = _ESF_RANK[bx?.esfuerzo] || 0;
  if (ae !== be) return be - ae;
  return 0;
}

// ── buildNarrativeSignalsForExecutiveAction · signals kind=executive_action ──
export function buildNarrativeSignalsForExecutiveAction(scenarioId, conversationContext, modulo, override) {
  const candidates = _detectExecutiveActions(scenarioId, override);
  if (!candidates || candidates.length === 0) return null;
  // MATERIALITY v1 · ordenar por JERARQUÍA firmada (elevación > valor > urgencia > esfuerzo).
  // El score se preserva como CAMPO (Sentrix) pero ya NO decide el orden. Capa A pobló a.axes.
  if (HIERARCHY_ENABLED) {
    candidates.forEach(c => { if (!c.axes) c.axes = _deriveOpportunityAxes(c, scenarioId); });
    candidates.sort(_compareByHierarchy);
  } else {
    candidates.sort((a, b) => (b.score || 0) - (a.score || 0));
  }
  const top3Scored = candidates.slice(0, 3).map((a, i) => ({
    rank: i + 1, // rank matemático por score · preservado para Sentrix/consumidores
    type: a.type,
    entities: a.entities,
    recoverable_K: a.recoverable_K,
    recoverable_BP_K: a.recoverable_BP_K,
    avg_doh: a.avg_doh,
    concentration_pct: a.concentration_pct,
    exposed_M: a.exposed_M,
    controllability_tag: a.controllability,
    urgency_tag: a.urgency,
    verb: a.verb,
    criterion: a.criterion,
    instance_count: a.instance_count,
    score: a.score,
    axes: (typeof MATERIALITY_AXES_ENABLED !== "undefined" && MATERIALITY_AXES_ENABLED)
      ? _deriveOpportunityAxes(a, scenarioId) : null,
  }));
  // FIX D-N.B.1-2 · reorden de presentación · arco temporal coherente.
  // Mueve acciones de controlabilidad baja (structural-horizon · diversificación)
  // al final del array narrativo. El ranking matemático queda preservado en
  // actions[i].rank · pero el orden de iteración para narrativa cambia para
  // cerrar con la acción estructural + reframe parallel_horizons natural.
  // MAT-v1.1-D · la presentación NUNCA contradice el ranking. El arco temporal (estructural al
  // final) aplica solo a lo NO elevado · una oportunidad _isStructuralCritical dejó de ser horizonte
  // largo (es atención inmediata) → no va al bloque estructural · sigue a la jerarquía.
  const immediate = top3Scored.filter(a => a.controllability_tag !== "baja" || _isStructuralCritical(a.axes));
  const structural = top3Scored.filter(a => a.controllability_tag === "baja" && !_isStructuralCritical(a.axes));
  const presentationOrder = [...immediate, ...structural];
  // Priority rationale: criterio del action top1 por score (el de mayor score)
  const priorityRationale = top3Scored[0].criterion;
  // Detectar si hay structural action (para activar reframe parallel_horizons)
  const hasStructural = top3Scored.some(a => a.type === "tier2_diversification");
  return {
    kind: "executive_action",
    scenario: scenarioId,
    actions: presentationOrder,
    priority_rationale: priorityRationale,
    has_structural: hasStructural,
  };
}
