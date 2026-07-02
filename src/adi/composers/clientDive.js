/* === adi/composers/clientDive.js ===
 * Composer de ancla extraído de 41cc33d8 · verbatim · solo imports agregados. */
import { CAUSAL, OBSERVABLE_RELATIONS, POOL_CONCLUYE_BASE, POOL_CONCLUYE_DECLINE, POOL_CONECTORES_CONTEXT } from "../../config/cognitiveData.js";
import { MECHANISM_REGISTRY } from "../../config/mechanisms.js";
import { PRIMITIVES } from "../../config/primitives.js";
import { MECHANISM_LINK_ENABLED, VOICE_NARRATIVE_LAYER_ENABLED, VOZ2_ENABLED } from "../../config/voiceFlags.js";
import { CLIENTES_STRATEGIC_PROFILE } from "../../data/demoData.js";
import { calculateIncrementalGrowth } from "../../engine/portfolio.js";
import { applyScenarioToClientesMargen, applyScenarioToClientesVentas } from "../../engine/scenarios.js";
import { buildReframe, buildSuggestedAction, calculateRecoverable, classifySeverity, detectInternalDriver } from "../../engine/signals.js";
import { POLICY } from "../../config/businessPolicy.js";   // hardening · política de negocio · UNA fuente (byte-idéntico)
import { getStrategicProfile, getSubstitutionMap } from "../detectors.js";
import { filterTextualSuggestions } from "../helpers.js";
import { scanMechanisms } from "./thesis.js";

export function getObservableRelations(entityType, entityId, scenario, dataset) {
  try {
    const relations = OBSERVABLE_RELATIONS[entityType];
    if (!relations || Object.keys(relations).length === 0) {
      return { impacto: null, riesgo: null };
    }
    // Cargar dataset si no se pasó
    const margenes = dataset?.margenes || applyScenarioToClientesMargen(scenario);
    const ventas = dataset?.ventas || applyScenarioToClientesVentas(scenario);

    const impactoCandidates = [];
    const riesgoCandidates = [];

    for (const [key, rel] of Object.entries(relations)) {
      let result = null;
      try {
        result = rel.evaluate(entityId, margenes, ventas, scenario);
      } catch (innerErr) {
        result = null; // skip esta relación si su evaluate falla
      }
      if (result && result.triggered) {
        const candidate = {
          text: result.text,
          value: result.value || 0,
          priority: rel.priority || 99, // fallback alto si no se declara
          key: key,
        };
        if (rel.tipo === "impacto_economico") impactoCandidates.push(candidate);
        else if (rel.tipo === "riesgo") riesgoCandidates.push(candidate);
      }
    }

    // Ordenar por priority ASCENDENTE (1 = más accionable · gana)
    // Las unidades de value son heterogéneas (dólares vs puntos vs %) ·
    // ranking por priority declarado en el catálogo es la regla determinística.
    impactoCandidates.sort((a, b) => a.priority - b.priority);
    riesgoCandidates.sort((a, b) => a.priority - b.priority);

    return {
      impacto: impactoCandidates[0] || null,
      riesgo: riesgoCandidates[0] || null,
    };
  } catch (e) {
    return { impacto: null, riesgo: null };
  }
}

export function composeObservableRelationsBlock(relations, mode = "narrative") {
  const { impacto, riesgo } = relations || {};

  if (mode === "structured") {
    return {
      loRelevante: impacto?.text || null,
      riesgo: riesgo?.text || null,
    };
  }

  // narrative (default · legacy)
  if (!impacto && !riesgo) return "";
  if (impacto && riesgo) {
    return `Lo relevante es que ${lowerFirst(impacto.text)} Además, ${lowerFirst(riesgo.text)}`;
  }
  if (impacto) {
    return `Lo relevante es que ${lowerFirst(impacto.text)}`;
  }
  // Solo riesgo
  return `Hay que considerar que ${lowerFirst(riesgo.text)}`;
}

export function lowerFirst(s) {
  if (!s || typeof s !== "string") return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function getClientDeepDive(clientName, scenarioId, context = {}) {
  // BRIEF #12-C.3 · Composition driven by cognitive pipeline.
  // BRIEF #12-C.4 · Context-aware composition (activeModule, comparison, etc.).
  // Reads runReasoningEngine trace + composes via 5 composer functions.

  const ventas   = applyScenarioToClientesVentas(scenarioId);
  const margenes = applyScenarioToClientesMargen(scenarioId);
  const v = ventas.find(c => c.nombre === clientName);

  // Fallback (preserved from previous version)
  if (!v) {
    return {
      opener: `No tengo a ${clientName} en el detalle de la cartera de este escenario. Las cuentas activas son Falabella, Lider, Jumbo y otras 10. ¿Cuál querés revisar?`,
      // BRIEF N-bis · Tipo A puro · suggestions filtradas
      suggestions: filterTextualSuggestions([
        "Cuéntame de Falabella",
        "Cuéntame de Mercado Libre",
        "Cuéntame de Lider",
      ]),
      // FIX_GREETING_RESET_RRE · query negocio aunque cliente no exista · igual resetea
      reasoningPattern: "client_deep_dive_unavailable",
    };
  }

  // Run the full cognitive pipeline
  const trace = runReasoningEngine(clientName, scenarioId);

  // Auxiliary data composers may need
  const profile = getStrategicProfile(clientName);
  const incrementalGrowth = calculateIncrementalGrowth(clientName, scenarioId);
  const substMap = getSubstitutionMap(clientName, scenarioId);
  const fullDataset = { v, margenes };

  // BRIEF #12-C.5 · Select brevity level first
  const userInputText = context.userInputText || "";
  const brevity = selectBrevity(trace, context, userInputText);

  // Compose movements according to brevity
  let calcula = "", interpreta = "", contextualiza = "", proyecta = "", concluye = "";

  if (brevity === "micro") {
    // MICRO: just first sentence of CALCULA
    const fullCalcula = composeCalcula(trace, profile, context);
    // Take just the first sentence (split by ". " and take [0] + ".")
    const firstSentence = fullCalcula.split(". ")[0];
    calcula = firstSentence.endsWith(".") ? firstSentence : firstSentence + ".";
  } else if (brevity === "short") {
    // SHORT: CALCULA + CONCLUYE
    calcula = composeCalcula(trace, profile, context);
    concluye = composeConcluye(trace, profile);
  } else {
    // MEDIUM and EXPANDED: full 5 movements
    calcula = composeCalcula(trace, profile, context);
    interpreta = composeInterpreta(trace, profile, context);
    contextualiza = composeContextualiza(trace, profile, incrementalGrowth, fullDataset);
    proyecta = composeProyecta(trace, profile, substMap);
    concluye = composeConcluye(trace, profile);
  }

  // BRIEF #12-C.5 · Recommendation block
  // Composer returns null when not warranted (e.g., only hidden_profitability).
  let recommendation = null;
  if (brevity === "medium" || brevity === "expanded") {
    recommendation = composeRecommendation(trace, profile, context);
  }

  // BRIEF #12-C.6 · Confianza block (italic, separate from recommendation)
  let confianza = null;
  if (brevity === "medium" || brevity === "expanded") {
    confianza = composeConfianza(trace, profile, context);
  }

  // ════════════════════════════════════════════════════════════════════════
  // BRIEF #13 · EXECUTIVE STORY RULES V1 · PILOTO
  //
  // Bloque opcional con relaciones observables cuantificadas (impacto + riesgo).
  // Brevity gate: solo se invoca en medium/expanded · passthrough en micro/short.
  // Posición pipeline: entre proyecta y concluye (LOCKED).
  // Flag rollback: VOICE_STORY_RULES_PILOT_ENABLED = false → passthrough total.
  // try-catch defensivo · si falla helper · storyBlock="" y composer continúa.
  // ════════════════════════════════════════════════════════════════════════
  const VOICE_STORY_RULES_PILOT_ENABLED = true;
  let storyBlock = "";
  if (VOICE_STORY_RULES_PILOT_ENABLED && (brevity === "medium" || brevity === "expanded")) {
    try {
      const relations = getObservableRelations("cliente", clientName, scenarioId, { ventas, margenes });
      storyBlock = composeObservableRelationsBlock(relations);
    } catch (story_err) {
      // eslint-disable-next-line no-console
      console.warn("BRIEF #13 Story Rules error:", story_err);
      storyBlock = "";
    }
  }

  // Final assembly · double-newline between movements, skip empty blocks
  // Story Rules block (#13) se inserta entre proyecta y concluye (LOCKED).
  const parts = [calcula, interpreta, contextualiza, proyecta, storyBlock, concluye, recommendation, confianza]
                  .filter(p => p && p.length > 0);
  const opener = parts.join("\n\n");

  // Suggestions · based on triggered templates ranking
  const suggestions = [];
  const topTemplates = trace.layers.templates.slice(0, 3);

  // Tier 1 clients always get the "what if I lose it" suggestion
  if (profile && profile.tier === 1) {
    suggestions.push(`Qué pasa si pierdo a ${clientName}`);
  }

  // Suggestions inspired by detected templates
  if (topTemplates.some(t => t.id === "margin_erosion" || t.id === "benchmark_gap")) {
    suggestions.push(`Cómo está su margen vs benchmark`);
  }
  if (topTemplates.some(t => t.id === "rebate_leakage")) {
    suggestions.push(`Qué pasa si bajo su carga comercial`);
  }
  if (topTemplates.some(t => t.id === "dependency_risk")) {
    if (!suggestions.find(s => s.includes("pierdo"))) {
      suggestions.push(`Qué pasa si pierdo a ${clientName}`);
    }
  }
  if (topTemplates.some(t => t.id === "hidden_profitability")) {
    suggestions.push(`Cómo escalar esta cuenta`);
  }
  if (topTemplates.some(t => t.id === "low_quality_growth")) {
    suggestions.push(`Vale la pena este crecimiento`);
  }

  // Backfill with tier-based defaults if we have fewer than 3 suggestions
  if (suggestions.length < 3) {
    if (profile && profile.tier === 1) {
      if (!suggestions.find(s => s.includes("benchmark"))) suggestions.push(`Cómo está su margen vs benchmark`);
      if (!suggestions.find(s => s.includes("Compara"))) {
        const compareTarget = clientName === "Lider" ? "Falabella" : "Lider";
        suggestions.push(`Compara a ${clientName} con ${compareTarget}`);
      }
    } else if (profile && profile.tier === 2) {
      if (!suggestions.find(s => s.includes("evoluciona"))) suggestions.push(`Cómo evoluciona ${clientName} mes a mes`);
      if (!suggestions.find(s => s.includes("productos"))) suggestions.push(`Cuáles son sus principales productos`);
    } else {
      if (!suggestions.find(s => s.includes("riesgo"))) suggestions.push(`Cuál es el riesgo de ${clientName}`);
      if (!suggestions.find(s => s.includes("categoría"))) suggestions.push(`Cómo se compara con su categoría`);
    }
  }

  // Trim to max 3 suggestions
  const finalSuggestions = suggestions.slice(0, 3);

  // BRIEF #16 · acción Sentrix contextual
  const scanForAction = scanMechanisms(scenarioId);
  const primaryMechanismForAction = identifyPrimaryMechanism(clientName, scanForAction);
  // Resolve nombre_capitalizado from registry if missing
  let primaryMechForAction = primaryMechanismForAction;
  if (primaryMechForAction && !primaryMechForAction.nombre_capitalizado) {
    const regEntry = MECHANISM_REGISTRY[primaryMechForAction.id];
    if (regEntry) primaryMechForAction = { ...primaryMechForAction, nombre_capitalizado: regEntry.nombre_capitalizado };
  }
  const sentrixAction = composeSentrixAction("client_deep_dive", {
    clientName,
    primaryMechanism: primaryMechForAction,
  });

  // ── BRIEF M.B.3 · narrative_signals + posture_hint ──
  // Direct add · estructura plana del return permite agregar sin spread.
  let narrative_signals = null;
  let posture_hint = "validate";
  if (VOICE_NARRATIVE_LAYER_ENABLED) {
    try {
      narrative_signals = buildNarrativeSignalsForClientDeepDive(clientName, scenarioId);
      if (narrative_signals?.implication?.counter_intuition === true) {
        posture_hint = "challenge";
      }
    } catch (sig_err) {
      // eslint-disable-next-line no-console
      console.warn("BRIEF M.B.3 client deep-dive narrative_signals error:", sig_err);
      narrative_signals = null;
    }
  }

  // BRIEF N-bis · Tipo A puro · finalSuggestions filtradas en return
  return {
    opener,
    suggestions: filterTextualSuggestions(finalSuggestions),
    sentrixAction,
    narrative_signals,
    posture_hint,
    // FIX_GREETING_RESET_RRE · reasoningPattern explícito para que counter reset
    // post-FIX_GREETING_LAYER reconozca esta como query de negocio.
    // NO modifica narrativa runReasoningEngine · solo field tracking interno.
    reasoningPattern: "client_deep_dive",
  };
}

export function _deriveTierFromContribution(entityName, ventasScope) {
  if (!entityName || !Array.isArray(ventasScope) || ventasScope.length === 0) return null;
  const total = ventasScope.reduce((s, c) => s + (c.actual || 0), 0);
  const entity = ventasScope.find(c => c.nombre === entityName);
  if (!entity || total === 0) return null;
  const pct = (entity.actual / total) * 100;
  let tier;
  if (pct >= 10) tier = 1;
  else if (pct >= 3) tier = 2;
  else tier = 3;
  return { tier, participacion_pct: +pct.toFixed(2), ventas_K: entity.actual };
}

export function buildNarrativeSignalsForClientDeepDive(clientName, scenarioId) {
  if (!clientName) return null;
  try {
    const ventasScope = applyScenarioToClientesVentas(scenarioId);
    const margenScope = applyScenarioToClientesMargen(scenarioId).filter(c => c.tipo === "cliente");
    const ventasEntity = ventasScope.find(c => c.nombre === clientName);
    const margenEntity = margenScope.find(c => c.nombre === clientName);
    if (!ventasEntity || !margenEntity) return null;

    const tierInfo = _deriveTierFromContribution(clientName, ventasScope);

    // Detector reusa catálogo M.A · cliente.margen
    const driver = detectInternalDriver(margenEntity, "margen", "client", margenScope);
    const recoverable = driver ? calculateRecoverable(margenEntity, "margen", "client", driver, margenScope) : 0;
    const action = driver ? buildSuggestedAction(margenEntity, "margen", "client", margenScope, recoverable) : null;
    const reframe = driver ? buildReframe(driver) : null;

    // Calcular total contribución para el % del cliente
    const totalContribucion = margenScope.reduce((s, c) => s + (c.contribucion || 0), 0);
    const contribucion_pct = totalContribucion > 0
      ? +((margenEntity.contribucion / totalContribucion) * 100).toFixed(1)
      : 0;

    return {
      kind: "client_deep_dive",
      identity: {
        entity: clientName,
        tier: tierInfo?.tier || null,
        participacion_pct: tierInfo?.participacion_pct || 0,
        ventas_K: tierInfo?.ventas_K || 0,
        contribucion_K: margenEntity.contribucion || 0,
        contribucion_pct,
      },
      what: {
        entity: clientName,
        margen: margenEntity.margen,
        benchmark: margenEntity.benchmark || POLICY.benchmark,
        pctRebate: margenEntity.pctRebate,
      },
      why: driver ? {
        mechanism: driver.mechanism,
        origin: "internal",
        target_entity: clientName,
        driver,
      } : null,
      implication: {
        severity: classifySeverity(driver?.vs_promedio || 0, recoverable),
        counter_intuition: !!driver,
        recoverable_value: recoverable,
        recoverability: classifyRecoverability(driver),
        action,
        reframe,
      },
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("BRIEF M.B.3 client deep-dive signals error:", err);
    return null;
  }
}

export function classifyRecoverability(driver) {
  if (!driver) return "baja";
  if (driver.mechanism === "internal_commercial_load") return "alta";
  if (driver.mechanism === "internal_margin_compression") return "media";
  if (driver.mechanism === "operational_inefficiency") return "media";
  return "baja";
}

export function composeInterpreta(trace, profile, context = {}) {
  const clientName = trace.client;
  const templates = trace.layers.templates;

  // Helper · classifies templates as virtuous-side (from #12-C.3-bis)
  const isVirtuousSideTemplate = (t) => {
    if (t.id === "hidden_profitability") return true;
    if (t.id === "dependency_risk") {
      const ev = t.evidence || {};
      const isUnique = ev.isUnique === true;
      const lowParticipation = (ev.participacion === undefined) || ev.participacion < 15;
      return isUnique && lowParticipation;
    }
    return false;
  };

  const negativeTemplates = templates.filter(t => !isVirtuousSideTemplate(t));
  const hasHidden = templates.some(t => t.id === "hidden_profitability");
  const hasNegative = negativeTemplates.length > 0;

  // Pull primitives evidence
  const lastPeriod = trace.layers.primitives.compareVsLastPeriod;
  const benchmark = trace.layers.primitives.compareVsBenchmark;
  const leakage = trace.layers.primitives.detectLeakage;
  const concentration = trace.layers.primitives.detectConcentration;
  const variacion = lastPeriod.evidence.deltaPct;
  const margenPct = benchmark.evidence.margen;
  const gapBp = benchmark.evidence.gap;
  const benchmarkValue = benchmark.evidence.benchmark;
  const carga = leakage.evidence.pctRebate;
  const bestPractice = leakage.evidence.bestPractice;
  const leakagePp = leakage.evidence.leakagePp;
  const participacion = concentration.evidence.participacion;

  // BRIEF #15 · Mechanism link enrichment (controlled by flag)
  // If MECHANISM_LINK_ENABLED, append a sentence linking the client to its
  // primary mechanism. Skipped when flag is off → bitwise identical to BRIEF #13.5.
  let mechanismSentence = "";
  if (MECHANISM_LINK_ENABLED) {
    try {
      const scanForLink = scanMechanisms(trace.scenario);
      const mechanismLink = identifyPrimaryMechanism(clientName, scanForLink);
      if (mechanismLink) {
        mechanismSentence = ` La cuenta es instancia principal de ${mechanismLink.nombre} en la cartera.`;
      }
    } catch (e) { mechanismSentence = ""; }
  }

  // ─── RAMA C · DECLINE CON MARGEN SANO ────────────────
  // Variation strongly negative AND margin at or above benchmark.
  // Evaluated BEFORE virtuous to prevent declining clients with healthy margin
  // (e.g., La Polar with -12.5% YoY but margen 34% > benchmark) from falling
  // into virtuous + "scale" recommendation, which would be narratively incoherent.
  if (variacion < -5 && gapBp <= 0) {
    const firstSentence = composeReasoningSentence(trace, profile);
    const secondSentence = `El deterioro es de volumen, no de pricing ni de carga comercial.`;
    const thirdSentence = `La cuenta sostiene calidad de margen incluso bajo presión de ventas.`;
    return `${firstSentence} ${secondSentence} ${thirdSentence}${mechanismSentence}`;
  }

  // ─── RAMA B · VIRTUOUS ───────────────────────────────
  if (hasHidden && !hasNegative) {
    const firstSentence = composeReasoningSentence(trace, profile);
    let secondSentence = "";
    const profileRol = profile?.rolEstrategico || "";
    const profileCat = profile?.categoriaDominante || "";
    if (profileRol.includes("digital") || profileCat.includes("digital") || profileCat.includes("canal digital")) {
      secondSentence = `La cuenta sostiene esta combinación apoyada en el canal digital, donde el negocio no enfrenta la presión comercial directa que se observa en Tier 1 físico.`;
    } else if (variacion < 0) {
      secondSentence = `Pese a la caída de volumen, la cuenta sostiene calidad de margen, lo que indica deterioro de ventas pero no de pricing ni carga.`;
    } else {
      secondSentence = `La rentabilidad estructural se sostiene sobre carga comercial baja y mix de producto favorable.`;
    }
    return `${firstSentence} ${secondSentence}${mechanismSentence}`;
  }

  // ─── RAMA A · TENSIÓN DOMINANTE (default) ─────────────
  if (!hasNegative) {
    // Edge case: no negatives, no hidden · silent fallback
    return `La cuenta opera dentro de su perfil esperado, sin tensiones materiales detectadas.`;
  }

  // Priority list: identify the dominant tension (most actionable first)
  const DOMINANT_PRIORITY = [
    "rebate_leakage",
    "pricing_pressure",
    "low_quality_growth",
    "margin_erosion",
    "benchmark_gap",
    "dependency_risk",
  ];

  const sortedByPriority = [...negativeTemplates].sort((a, b) => {
    const idxA = DOMINANT_PRIORITY.indexOf(a.id);
    const idxB = DOMINANT_PRIORITY.indexOf(b.id);
    const safeA = idxA === -1 ? 999 : idxA;
    const safeB = idxB === -1 ? 999 : idxB;
    return safeA - safeB;
  });

  const dominant = sortedByPriority[0];

  let firstSentence = "";
  let secondSentence = "";
  let thirdSentence = "";

  switch (dominant.id) {
    case "rebate_leakage":
    case "low_quality_growth":
    case "pricing_pressure": {
      firstSentence = composeReasoningSentence(trace, profile);
      secondSentence = `El rebate alcanza ${carga}% de las ventas, ${leakagePp} puntos sobre la mejor práctica interna (${bestPractice}%).`;
      thirdSentence = `El crecimiento de la cuenta viene acompañado de mayor presión comercial, deteriorando progresivamente el margen frente al benchmark de cartera.`;
      break;
    }
    case "margin_erosion":
    case "benchmark_gap": {
      firstSentence = composeReasoningSentence(trace, profile);
      secondSentence = `El margen opera en ${margenPct}%, ${gapBp} puntos bajo el benchmark de cartera (${benchmarkValue}%).`;
      thirdSentence = `La brecha es estructural: la cuenta no captura el margen promedio de la categoría, lo que erosiona la contribución unitaria del negocio.`;
      break;
    }
    case "dependency_risk": {
      firstSentence = composeReasoningSentence(trace, profile);
      secondSentence = `${clientName} representa ${participacion}% del total de ventas, un nivel que supera el umbral prudencial de diversificación.`;
      thirdSentence = `La dependencia estructural amplifica el impacto de cualquier variación en la cuenta y reduce el margen de maniobra comercial.`;
      break;
    }
    default: {
      firstSentence = composeReasoningSentence(trace, profile);
      secondSentence = `El margen opera en ${margenPct}% y la carga comercial en ${carga}%.`;
      thirdSentence = `La combinación requiere monitoreo y revisión de la estrategia comercial.`;
    }
  }

  return `${firstSentence} ${secondSentence} ${thirdSentence}${mechanismSentence}`;
}

export function composeCalcula(trace, profile, context = {}) {
  const clientName = trace.client;
  const activeModule = context.activeModule || "ventas";

  const lastPeriod = trace.layers.primitives.compareVsLastPeriod;
  const benchmark = trace.layers.primitives.compareVsBenchmark;
  const concentration = trace.layers.primitives.detectConcentration;
  const leakage = trace.layers.primitives.detectLeakage;

  // Live metrics (read from primitives.evidence)
  const ventasM        = +(lastPeriod.evidence.actual / 1000).toFixed(1);
  const participacion  = concentration.evidence.participacion;
  const variacion      = lastPeriod.evidence.deltaPct;
  const variacionLabel = variacion >= 0 ? `+${variacion}%` : `${variacion}%`;
  const margenPct      = benchmark.evidence.margen;
  const gapBenchmark   = benchmark.evidence.gap;
  const carga          = leakage.evidence.pctRebate;

  // Contribucion still requires direct dataset read (not in primitives)
  const margenes = applyScenarioToClientesMargen(trace.scenario);
  const m = margenes.find(c => c.nombre === clientName);
  const contribucionM = m ? +(m.contribucion / 1000).toFixed(2) : null;

  // BRIEF #12-C.4 · Branch by active module
  if (activeModule === "margenes") {
    // Margin-led narrative
    let calcula = "";
    const gapClause = (gapBenchmark > 0)
      ? `${gapBenchmark} puntos bajo benchmark`
      : (gapBenchmark < 0 ? `${Math.abs(gapBenchmark)} puntos sobre benchmark` : "en línea con benchmark");

    if (profile && profile.tier === 1) {
      calcula = `${clientName} opera con margen ${margenPct}% (${gapClause}) y carga comercial de ${carga}%. La cuenta concentra ${participacion}% de la cartera con ventas de $${ventasM}M y variación ${variacionLabel} YoY`;
    } else if (profile && profile.tier === 2) {
      calcula = `${clientName} opera con margen ${margenPct}% (${gapClause}) y carga comercial de ${carga}%. Aporta $${ventasM}M (${participacion}% de la cartera) con variación ${variacionLabel} YoY`;
    } else {
      calcula = `${clientName} opera con margen ${margenPct}% (${gapClause}) y carga comercial de ${carga}%. Cuenta de menor escala: $${ventasM}M (${participacion}% de la cartera), variación ${variacionLabel} YoY`;
    }

    if (contribucionM !== null) {
      calcula += `. Contribución $${contribucionM}M.`;
    } else {
      calcula += `.`;
    }
    return calcula;
  }

  // Default branch (ventas / inventario / fallback): sales-led narrative
  // BRIEF #12-C.6 · Voice rewrite: dato + causa + consecuencia.
  // Add absolute $ delta alongside % YoY. Use "Sin embargo" conector when
  // margin is below benchmark. Carga comercial migrates to INTERPRETA.
  const deltaM = +((lastPeriod.evidence.delta) / 1000).toFixed(2);
  const deltaLabel = variacion >= 0 ? `+$${Math.abs(deltaM)}M` : `-$${Math.abs(deltaM)}M`;
  const deltaPhrase = variacion >= 0
    ? `crece ${variacionLabel} YoY, equivalente a aproximadamente ${deltaLabel} en ventas adicionales`
    : `cae ${variacionLabel} YoY, equivalente a aproximadamente ${deltaLabel} en ventas perdidas`;

  let calcula = "";
  if (profile && profile.tier === 1) {
    calcula = `${clientName} vende $${ventasM}M y representa ${participacion}% de la cartera total. La cuenta ${deltaPhrase}`;
  } else if (profile && profile.tier === 2) {
    calcula = `${clientName} aporta $${ventasM}M y representa ${participacion}% de la cartera total. La cuenta ${deltaPhrase}`;
  } else {
    calcula = `${clientName} aporta $${ventasM}M y representa ${participacion}% de la cartera total. La cuenta ${deltaPhrase}`;
  }

  if (contribucionM !== null) {
    const gapClause = (gapBenchmark > 0)
      ? `${gapBenchmark} puntos bajo el benchmark de cartera`
      : (gapBenchmark < 0 ? `${Math.abs(gapBenchmark)} puntos sobre el benchmark de cartera` : "en línea con el benchmark de cartera");
    const conectorMargen = (gapBenchmark > 0) ? ". Sin embargo, opera" : ". Opera";
    calcula += `${conectorMargen} con margen de ${margenPct}%, ${gapClause}, y aporta cerca de $${contribucionM}M de contribución.`;
  } else {
    calcula += `.`;
  }

  return calcula;
}

export function composeContextualiza(trace, profile, incrementalGrowth, fullDataset) {
  const clientName = trace.client;
  const v = fullDataset.v;
  const variacion = trace.layers.primitives.compareVsLastPeriod.evidence.deltaPct;
  const benchmark = trace.layers.primitives.compareVsBenchmark.evidence.benchmark;
  const gapBenchmark = trace.layers.primitives.compareVsBenchmark.evidence.gap;
  const carga = +v.pctRebate.toFixed(1);
  const margenes = fullDataset.margenes;

  const bullets = [];

  // Bullet A · incremental growth share
  if (incrementalGrowth !== null && incrementalGrowth > 0) {
    bullets.push(`aproximadamente ${incrementalGrowth}% del crecimiento incremental anual de la cartera`);
  } else if (variacion < 0) {
    bullets.push(`pérdida directa de aproximadamente $${Math.abs(+(v.actual - v.anterior).toFixed(0))}K contra el año anterior`);
  }

  // Bullet B · categoría dominante
  if (profile && profile.categoriaDominante) {
    bullets.push(profile.categoriaDominante);
  }

  // Bullet C · posicionamiento estructural
  if (profile && profile.tier === 1 && gapBenchmark > 0) {
    const otrosTier1Presionados = Object.entries(CLIENTES_STRATEGIC_PROFILE)
      .filter(([name, p]) => name !== clientName && p.tier === 1)
      .filter(([name, p]) => {
        const otherM = margenes.find(c => c.nombre === name);
        return otherM && otherM.margen < benchmark;
      })
      .map(([name]) => name);

    if (otrosTier1Presionados.length === 1) {
      bullets.push(`una de las dos posiciones Tier 1 con margen bajo benchmark, junto a ${otrosTier1Presionados[0]}`);
    } else if (otrosTier1Presionados.length > 1) {
      bullets.push(`posición Tier 1 con margen bajo benchmark, junto a ${otrosTier1Presionados.join(" y ")}`);
    } else {
      bullets.push("única posición Tier 1 con margen bajo benchmark");
    }
  } else if (profile && profile.tier === 1) {
    bullets.push("posición Tier 1 con margen sobre el promedio de las cuentas grandes");
  } else if (profile && profile.poderNegociacion === "Alto" && profile.tier === 2) {
    bullets.push("Tier 2 con poder de negociación alto por canal o crecimiento");
  } else if (profile && profile.cargaComercial === "Alta") {
    bullets.push(`carga comercial de ${carga}% — alta para el tamaño de la cuenta`);
  } else if (profile && profile.tier === 3) {
    bullets.push("escala individual baja pero contribución unitaria sana");
  }

  // Compose CONTEXTUALIZA block
  const conector = selectFromPool(POOL_CONECTORES_CONTEXT, clientName, "conector");
  if (bullets.length >= 3) {
    return `${clientName} ${conector}:\n\n· ${bullets.map((b, i) => i === bullets.length - 1 ? `y ${b}` : b).join(",\n\n· ")}.`;
  } else if (bullets.length === 2) {
    return `${clientName} ${conector} ${bullets[0]} y ${bullets[1]}.`;
  } else if (bullets.length === 1) {
    return `${clientName} ${conector} ${bullets[0]}.`;
  }
  return "";
}

export function composeProyecta(trace, profile, substMap) {
  const clientName = trace.client;

  if (substMap.isUnique) {
    return `${clientName} no tiene reemplazo natural en la cartera actual: ${substMap.uniqueReason}. Una salida o deterioro de la cuenta no se compensa estructuralmente con las cuentas existentes.`;
  }

  if (substMap.substitutes.length > 0) {
    const subs = substMap.substitutes;
    if (subs.length === 1) {
      const s = subs[0];
      const shareTxt = s.currentShare !== null ? `${s.currentShare}% de la cartera` : "participación menor";
      return `El reemplazo natural sería ${s.calificator}. ${s.name} concentra ${shareTxt}, escala insuficiente para absorber una salida de esta magnitud en el corto plazo.`;
    } else {
      const s1 = subs[0];
      const s2 = subs[1];
      const share1Txt = s1.currentShare !== null ? `${s1.currentShare}% de la cartera` : "participación menor";
      const share2Txt = s2.currentShare !== null ? `apenas ${s2.currentShare}% de participación` : "participación marginal";
      if (s1.calificator === "parcial" && s2.calificator === "limitado") {
        let p = `El reemplazo natural sería parcial. ${s1.name} concentra ${share1Txt}`;
        const s1Profile = getStrategicProfile(s1.name);
        if (s1Profile && profile && s1Profile.rolEstrategico === profile.rolEstrategico) {
          p += ` pero opera con la misma presión de margen`;
        }
        p += `. ${s2.name} cubre la categoría con ${share2Txt}, escala insuficiente para absorber una salida de esta magnitud en el corto plazo.`;
        return p;
      }
      return `El reemplazo sería distribuido: ${s1.name} (${share1Txt}) y ${s2.name} (${share2Txt}). Ninguno tiene la escala para absorber una salida completa en el corto plazo.`;
    }
  }
  return "El reemplazo natural de la cuenta no es evidente con la cartera actual.";
}

export function composeConcluye(trace, profile) {
  const clientName = trace.client;
  const variacion = trace.layers.primitives.compareVsLastPeriod.evidence.deltaPct;

  if (variacion < -10) {
    return selectFromPool(POOL_CONCLUYE_DECLINE, clientName, "concluye_decline");
  }
  if (profile && POOL_CONCLUYE_BASE[profile.rolEstrategico]) {
    return selectFromPool(POOL_CONCLUYE_BASE[profile.rolEstrategico], clientName, "concluye");
  }
  return selectFromPool(POOL_CONCLUYE_BASE["default"], clientName, "concluye");
}

export function voz2WantsRecommendation(userInputText) {
  const t = (userInputText || "").toLowerCase();
  const activators = [
    "que hago", "qué hago", "como resuelvo", "cómo resuelvo",
    "que harias", "qué harías", "que deberia", "qué debería",
    "recomend", "necesito una recomend", "necesito una decisi",
  ];
  return activators.some(a =>
    new RegExp("\\b" + a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(t)
  );
}

export function composeRecommendation(trace, profile, context = {}) {
  const templates = trace.layers.templates;
  const clientName = trace.client;

  // VOZ2 rec-gate · interpretativo por default · imperativo solo con activador explícito
  const _voz2Interp = (typeof VOZ2_ENABLED !== "undefined" && VOZ2_ENABLED)
    && !voz2WantsRecommendation(context.userInputText || "");

  // Helper · same virtuous-side classifier as composeInterpreta
  const isVirtuousSideTemplate = (t) => {
    if (t.id === "hidden_profitability") return true;
    if (t.id === "dependency_risk") {
      const ev = t.evidence || {};
      const isUnique = ev.isUnique === true;
      const lowParticipation = (ev.participacion === undefined) || ev.participacion < 15;
      return isUnique && lowParticipation;
    }
    return false;
  };

  const negativeTemplates = templates.filter(t => !isVirtuousSideTemplate(t));
  const hasHidden = templates.some(t => t.id === "hidden_profitability");
  const hasNegative = negativeTemplates.length > 0;

  // Pull primitives evidence
  const lastPeriod = trace.layers.primitives.compareVsLastPeriod;
  const benchmark = trace.layers.primitives.compareVsBenchmark;
  const leakage = trace.layers.primitives.detectLeakage;
  const concentration = trace.layers.primitives.detectConcentration;
  const variacion = lastPeriod.evidence.deltaPct;
  const margenPct = benchmark.evidence.margen;
  const gapBp = benchmark.evidence.gap;
  const carga = leakage.evidence.pctRebate;
  const bestPractice = leakage.evidence.bestPractice;
  const ventasK = lastPeriod.evidence.actual;
  const ventasM = +(ventasK / 1000).toFixed(1);
  const participacion = concentration.evidence.participacion;

  // Contribution from margin dataset
  const margenes = applyScenarioToClientesMargen(trace.scenario);
  const m = margenes.find(c => c.nombre === clientName);
  const contribucionM = m ? +(m.contribucion / 1000).toFixed(2) : null;

  // ─── RAMA C · MONITOR (decline sano) ──────────────────
  // Strong decline AND margin at or above benchmark.
  // Evaluated BEFORE opportunity to prevent declining clients from getting
  // a "scale" recommendation (e.g., La Polar -12.5% YoY should be monitored, not scaled).
  if (variacion < -5 && gapBp <= 0) {
    const action = `Monitorear evolución de ventas en los próximos 2-3 meses antes de definir acciones.`;
    const reason = `La prioridad es confirmar si la caída de volumen es transitoria o si comienza a deteriorar el margen de la cuenta.`;
    const risk = `La rentabilidad sana del margen permite mantener la cuenta sin urgencia operativa, pero un deterioro adicional sin recuperación de margen activaría revisión de la estrategia comercial.`;
    const mech = `El volumen cae pero el margen se mantiene sano · lo que define el siguiente paso es si la caída empieza a afectar el margen en los próximos 2-3 meses.`;
    return _voz2Interp
      ? `**Mecanismos disponibles**\n\n${mech}`
      : `**Recomendación**\n\n${action} ${reason} ${risk}`;
  }

  // ─── RAMA B · OPPORTUNITY (virtuous) ──────────────────
  if (hasHidden && !hasNegative) {
    const action = `Evaluar plan de inversión comercial específico para escalar ${clientName} en categorías de mayor participación.`;
    const reason = `La cuenta soporta crecimiento adicional sin requerir carga comercial elevada, lo que permitiría aumentar contribución absoluta de la cartera sin replicar la presión de margen que se observa en Tier 1 físico.`;
    const risk = `El principal riesgo es depender de una sola cuenta para sostener crecimiento digital.`;
    const mech = `${clientName} tiene espacio para crecer sin elevar carga comercial · escalarlo en categorías de mayor participación sumaría contribución sin replicar la presión de margen que se observa en el Tier 1 físico.`;
    return _voz2Interp
      ? `**Mecanismos disponibles**\n\n${mech}`
      : `**Recomendación**\n\n${action} ${reason} ${risk}`;
  }

  // ─── RAMA A · ACTION (default for negative tensions) ───
  if (!hasNegative) return null;

  const DOMINANT_PRIORITY = [
    "rebate_leakage",
    "pricing_pressure",
    "low_quality_growth",
    "margin_erosion",
    "benchmark_gap",
    "dependency_risk",
  ];
  const sortedByPriority = [...negativeTemplates].sort((a, b) => {
    const idxA = DOMINANT_PRIORITY.indexOf(a.id);
    const idxB = DOMINANT_PRIORITY.indexOf(b.id);
    const safeA = idxA === -1 ? 999 : idxA;
    const safeB = idxB === -1 ? 999 : idxB;
    return safeA - safeB;
  });
  const dominant = sortedByPriority[0];

  // Decision threshold: only emit recommendation if dominant is high severity
  // OR there are 2+ medium-severity actionables
  const actionableHigh = negativeTemplates.filter(t => t.severity === "high");
  const actionableMedium = negativeTemplates.filter(t => t.severity === "medium");
  if (actionableHigh.length === 0 && actionableMedium.length < 2) return null;

  let action = "";
  let reason = "";
  let risk = "";
  let mech = "";

  switch (dominant.id) {
    case "rebate_leakage":
    case "low_quality_growth":
    case "pricing_pressure": {
      // Operational target: 3.5% (between best practice 3% and current load)
      const operationalTarget = POLICY.targetCarga;
      const pointsToReduce = +(carga - operationalTarget).toFixed(1);
      const impactK = Math.round(ventasK * pointsToReduce / 100);
      action = `Reducir gradualmente la carga comercial desde ${carga}% hacia niveles cercanos al benchmark interno de ${operationalTarget}% permitiría recuperar aproximadamente $${impactK}K anuales de contribución.`;
      reason = `El objetivo no es reducir volumen, sino frenar el deterioro del margen y mejorar la rentabilidad de la cuenta sin afectar participación en el corto plazo.`;
      risk = `El principal riesgo está en próximas negociaciones comerciales, donde ${clientName} podría exigir compensaciones para mantener las condiciones actuales.`;
      mech = `La carga comercial está en ${carga}% · acercarla al benchmark interno de ${operationalTarget}% liberaría aproximadamente $${impactK}K anuales de contribución · la palanca está en la carga, no en el volumen.`;
      break;
    }
    case "margin_erosion":
    case "benchmark_gap": {
      const targetMargin = +(margenPct + gapBp / 2).toFixed(1);
      action = `Revisar mix de producto o estructura de costo de ${clientName} para cerrar parcialmente el gap de margen frente al benchmark de cartera.`;
      reason = `Cerrar la mitad del gap (${(gapBp / 2).toFixed(1)} puntos sobre ${gapBp} actuales) elevaría el margen de la cuenta de ${margenPct}% a aproximadamente ${targetMargin}%, recuperando contribución sin afectar volumen.`;
      risk = `Acción sobre precio puede generar pérdida de volumen, mientras acción sobre costo depende del poder de negociación con proveedores.`;
      mech = `El gap de margen es ${gapBp} puntos · cerrar la mitad llevaría el margen de ${margenPct}% a aproximadamente ${targetMargin}% · el mecanismo está asociado al mix o a la estructura de costo.`;
      break;
    }
    case "dependency_risk": {
      const ventasToReplace = +(ventasM * (participacion - 15) / participacion).toFixed(1);
      action = `Diversificar la cartera reduciendo participación de ${clientName} desde ${participacion}% hacia niveles cercanos al 15%.`;
      reason = `Bajar la participación al umbral prudencial requiere desarrollar cuentas equivalentes a aproximadamente $${ventasToReplace}M en ventas alternativas, lo que reduce el impacto estructural de cualquier variación en la cuenta.`;
      risk = `La diversificación toma 12-18 meses; durante ese período, la pérdida de ${clientName} representaría ${participacion}% de los ingresos del negocio.`;
      mech = `${clientName} concentra ${participacion}% del negocio · llevar esa concentración hacia un nivel más equilibrado (~15%) requeriría desarrollar aproximadamente $${ventasToReplace}M en cuentas alternativas · el margen de diversificación existe, toma 12-18 meses.`;
      break;
    }
    default:
      return null;
  }

  return _voz2Interp
    ? `**Mecanismos disponibles**\n\n${mech}`
    : `**Recomendación**\n\n${action} ${reason} ${risk}`;
}

export function composeConfianza(trace, profile, context = {}) {
  const templates = trace.layers.templates;

  // Same virtuous-side helper
  const isVirtuousSideTemplate = (t) => {
    if (t.id === "hidden_profitability") return true;
    if (t.id === "dependency_risk") {
      const ev = t.evidence || {};
      const isUnique = ev.isUnique === true;
      const lowParticipation = (ev.participacion === undefined) || ev.participacion < 15;
      return isUnique && lowParticipation;
    }
    return false;
  };

  const negativeTemplates = templates.filter(t => !isVirtuousSideTemplate(t));
  const hasHidden = templates.some(t => t.id === "hidden_profitability");
  const hasNegative = negativeTemplates.length > 0;
  const variacion = trace.layers.primitives.compareVsLastPeriod.evidence.deltaPct;
  const gapBp = trace.layers.primitives.compareVsBenchmark.evidence.gap;

  // Determine confidence level + backing statement based on branch
  let level = "alta";
  let backing = "";

  // Decline-sano branch (evaluated first to align with composeInterpreta order)
  if (variacion < -5 && gapBp <= 0) {
    level = "media";
    backing = `La caída de volumen es consistente, pero todavía no hay evidencia suficiente para confirmar una tendencia estructural.`;
  }
  // Virtuous branch
  else if (hasHidden && !hasNegative) {
    level = "alta";
    backing = `La combinación de margen, carga comercial y crecimiento de ${trace.client} se sostiene como excepción consistente en el histórico de la cartera.`;
  }
  // High severity actionable branch
  else if (negativeTemplates.some(t => t.severity === "high")) {
    level = "alta";
    backing = `La relación entre carga comercial, benchmark y deterioro de margen se repite consistentemente en el histórico reciente de la cartera.`;
  }
  // Medium severity branch
  else if (negativeTemplates.length >= 2) {
    level = "media";
    backing = `Los indicadores de presión son consistentes con el perfil de la cuenta, aunque la magnitud individual de cada tensión es moderada.`;
  }
  else {
    return null;
  }

  return `*Confianza ${level}. ${backing}*`;
}

export function hashClientName(name) {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash) + name.charCodeAt(i);
    hash = hash | 0; // Force 32-bit integer
  }
  return Math.abs(hash);
}

export function composeReasoningSentence(trace, profile) {
  const clientName = trace.client;
  const lastPeriod = trace.layers.primitives.compareVsLastPeriod;
  const benchmark = trace.layers.primitives.compareVsBenchmark;
  const variacion = lastPeriod.evidence.deltaPct;
  const gapBp = benchmark.evidence.gap;
  const templates = trace.layers.templates;

  const isVirtuousSideTemplate = (t) => {
    if (t.id === "hidden_profitability") return true;
    if (t.id === "dependency_risk") {
      const ev = t.evidence || {};
      const isUnique = ev.isUnique === true;
      const lowParticipation = (ev.participacion === undefined) || ev.participacion < 15;
      return isUnique && lowParticipation;
    }
    return false;
  };

  const negativeTemplates = templates.filter(t => !isVirtuousSideTemplate(t));
  const hasHidden = templates.some(t => t.id === "hidden_profitability");
  const hasNegative = negativeTemplates.length > 0;

  // ─── PATRÓN 3 · DECLINE SANO ──────────────────────────
  if (variacion < -5 && gapBp <= 0) {
    const variants = [
      `La caída de volumen todavía no deteriora el margen, por lo que la principal lectura sigue estando en la calidad de contribución`,
      `La presión está en volumen pero no en margen, por lo que la lectura principal sigue siendo de rentabilidad estructural`,
      `El margen no se ha visto afectado por la caída de ventas, por lo que la atención debería estar en la calidad de contribución antes que en la escala`,
    ];
    const idx = hashClientName(clientName + "_reasoning_decline") % variants.length;
    return variants[idx] + ".";
  }

  // ─── PATRÓN 2 · EXCEPCIÓN VIRTUOSA ────────────────────
  if (hasHidden && !hasNegative) {
    const variants = [
      `${clientName} destaca por combinar crecimiento alto con carga comercial baja, algo poco frecuente en la cartera actual`,
      `${clientName} sostiene un perfil estructural sano que se diferencia del patrón de presión de Tier 1`,
      `${clientName} mantiene una combinación de margen, carga y crecimiento que no se replica en el resto de la cartera`,
    ];
    const idx = hashClientName(clientName + "_reasoning_virtuous") % variants.length;
    return variants[idx] + ".";
  }

  // ─── PATRÓN 1 · TENSIÓN DOMINANTE ─────────────────────
  if (!hasNegative) {
    return `El perfil comercial es estable, sin tensiones materiales detectadas.`;
  }

  const DOMINANT_PRIORITY = [
    "rebate_leakage", "pricing_pressure", "low_quality_growth",
    "margin_erosion", "benchmark_gap", "dependency_risk",
  ];
  const sortedByPriority = [...negativeTemplates].sort((a, b) => {
    const idxA = DOMINANT_PRIORITY.indexOf(a.id);
    const idxB = DOMINANT_PRIORITY.indexOf(b.id);
    const safeA = idxA === -1 ? 999 : idxA;
    const safeB = idxB === -1 ? 999 : idxB;
    return safeA - safeB;
  });
  const dominant = sortedByPriority[0];

  let variants = [];

  if (["rebate_leakage", "low_quality_growth", "pricing_pressure"].includes(dominant.id)) {
    variants = [
      `La principal presión está en la carga comercial porque hoy es la variable más controlable y la que más deteriora el benchmark`,
      `La carga comercial concentra el problema porque acumula sobre el margen sin retornar volumen incremental al benchmark`,
      `El deterioro del margen se explica principalmente por la carga comercial, que opera por encima de la mejor práctica sin compensar con volumen incremental`,
    ];
  } else if (["margin_erosion", "benchmark_gap"].includes(dominant.id)) {
    variants = [
      `La principal presión está en el margen porque la brecha frente al benchmark de cartera es estructural y comprime la contribución sistemáticamente`,
      `El margen concentra la lectura porque opera por debajo del benchmark de cartera sin ajustes en costo o pricing que compensen`,
      `El gap de margen frente al benchmark es la lectura central, porque la cuenta no captura la rentabilidad promedio de la categoría`,
    ];
  } else if (dominant.id === "dependency_risk") {
    variants = [
      `La exposición de cartera concentra el riesgo porque la participación de la cuenta supera el umbral prudencial de diversificación`,
      `La concentración de la cuenta es la lectura central porque amplifica el impacto de cualquier variación comercial`,
      `La dependencia estructural concentra el riesgo porque reduce el margen de maniobra ante cambios en la relación comercial`,
    ];
  } else {
    variants = [
      `La cuenta presenta presión material en su perfil comercial, lectura que requiere monitoreo activo`,
    ];
  }

  const idx = hashClientName(clientName + "_reasoning_" + dominant.id) % variants.length;
  return variants[idx] + ".";
}

export function selectFromPool(pool, clientName, salt = "") {
  if (!Array.isArray(pool) || pool.length === 0) return "";
  const idx = hashClientName(clientName + salt) % pool.length;
  return pool[idx];
}

export function detectTemplates(clientName, scenarioId) {
  const templates = [];

  // §8.2.1 · Margin Erosion → consumes detectErosion primitive
  const erosion = PRIMITIVES.detectErosion(clientName, scenarioId);
  if (erosion.triggered) {
    templates.push({
      id: "margin_erosion",
      name: "Margin Erosion",
      severity: erosion.severity,
      evidence: erosion.evidence,
      driven_by: ["detectErosion"],
    });
  }

  // §8.2.3 · Benchmark Gap → suppressed if margin_erosion already fired
  // (both have same root cause, avoid double-reporting)
  const benchmark = PRIMITIVES.compareVsBenchmark(clientName, scenarioId);
  if (benchmark.triggered && benchmark.evidence.position === "below"
      && !templates.find(t => t.id === "margin_erosion")) {
    templates.push({
      id: "benchmark_gap",
      name: "Benchmark Gap",
      severity: benchmark.severity,
      evidence: benchmark.evidence,
      driven_by: ["compareVsBenchmark"],
    });
  }

  // §8.2.4 · Rebate Leakage → consumes detectLeakage primitive
  const leakage = PRIMITIVES.detectLeakage(clientName, scenarioId);
  if (leakage.triggered) {
    templates.push({
      id: "rebate_leakage",
      name: "Rebate Leakage",
      severity: leakage.severity,
      evidence: leakage.evidence,
      driven_by: ["detectLeakage"],
    });
  }

  // §8.2.5 · Dependency Risk → consumes CAUSAL.dependencyRisk
  const depRisk = CAUSAL.dependencyRisk(clientName, scenarioId);
  if (depRisk.triggered) {
    templates.push({
      id: "dependency_risk",
      name: "Dependency Risk",
      severity: depRisk.severity,
      evidence: depRisk.evidence,
      driven_by: depRisk.primitives_involved,
    });
  }

  // §8.2.6 · Hidden Profitability → consumes detectHiddenProfitability primitive
  // (now with PATH A + PATH B threshold from #12-C.1 audit)
  const hidden = PRIMITIVES.detectHiddenProfitability(clientName, scenarioId);
  if (hidden.triggered) {
    templates.push({
      id: "hidden_profitability",
      name: "Hidden Profitability",
      severity: hidden.severity,
      evidence: hidden.evidence,
      driven_by: ["detectHiddenProfitability"],
    });
  }

  // §8.2.7 · Low Quality Growth → consumes CAUSAL.lowQualityGrowth
  const lqg = CAUSAL.lowQualityGrowth(clientName, scenarioId);
  if (lqg.triggered) {
    templates.push({
      id: "low_quality_growth",
      name: "Low Quality Growth",
      severity: lqg.severity,
      evidence: lqg.evidence,
      driven_by: lqg.primitives_involved,
    });
  }

  // §8.2.9 · Pricing Pressure → consumes CAUSAL.marginCompression
  const pricing = CAUSAL.marginCompression(clientName, scenarioId);
  if (pricing.triggered) {
    templates.push({
      id: "pricing_pressure",
      name: "Pricing Pressure",
      severity: pricing.severity,
      evidence: pricing.evidence,
      driven_by: pricing.primitives_involved,
    });
  }

  // §8.2.2 · Trapped Capital, §8.2.8 · Mix Deterioration, §8.2.10 · Inventory Aging
  // Not applicable at client deep-dive level. Skipped.

  // Sort by severity: high > medium > low
  const severityOrder = { high: 0, medium: 1, low: 2 };
  templates.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return templates;
}

export function composeSentrixAction(composerType, payload) {
  if (composerType === "client_deep_dive") {
    const banner = payload.primaryMechanism
      ? (payload.primaryMechanism.nombre_capitalizado
         || (payload.primaryMechanism.nombre
             ? payload.primaryMechanism.nombre.charAt(0).toUpperCase() + payload.primaryMechanism.nombre.slice(1)
             : null))
      : null;
    return {
      label: `Ver ${payload.clientName}`,
      moduleChip: "Márgenes",
      payload: {
        modulo: "margenes",
        clientes: [payload.clientName],
        mechanismBanner: banner,
      },
    };
  }

  if (composerType === "mechanism_commercial_erosion") {
    const top3 = payload.instances.slice(0, 3);
    const clientNames = top3.map(i => i.clientName);
    return {
      label: `Ver ${clientNames.length} cuentas con erosión`,
      moduleChip: "Márgenes",
      payload: {
        modulo: "margenes",
        clientes: clientNames,
        mechanismBanner: "Erosión comercial",
      },
    };
  }

  if (composerType === "mechanism_quality_growth") {
    const instances = payload.instances;
    const clientNames = instances.map(i => i.clientName);
    return {
      label: `Ver ${clientNames.length} cuentas en deterioro`,
      moduleChip: "Márgenes",
      payload: {
        modulo: "margenes",
        clientes: clientNames,
        mechanismBanner: "Deterioro de calidad de crecimiento",
      },
    };
  }

  if (composerType === "mechanism_dependency_risk") {
    const top3Names = payload.top3_names;
    return {
      label: `Ver Top 3`,
      moduleChip: "Márgenes",
      payload: {
        modulo: "margenes",
        clientes: top3Names,
        mechanismBanner: "Riesgo de dependencia de cliente",
      },
    };
  }

  if (composerType === "mechanism_ranking") {
    const topMechId = payload.topMechanismId;
    if (topMechId === "commercial_erosion") {
      const top3 = payload.instances.slice(0, 3);
      return {
        label: `Ver ${top3.length} cuentas con erosión`,
        moduleChip: "Márgenes",
        payload: {
          modulo: "margenes",
          clientes: top3.map(i => i.clientName),
          mechanismBanner: "Erosión comercial",
        },
      };
    }
    return null;
  }

  if (composerType === "priority_recommendation") {
    return {
      label: `Ver ${payload.primaryClient}`,
      moduleChip: "Márgenes",
      payload: {
        modulo: "margenes",
        clientes: [payload.primaryClient],
        mechanismBanner: "Erosión comercial",
      },
    };
  }

  if (composerType === "fuga_distribuida") {
    return {
      label: `Ver ${payload.tier1Names.length} cuentas con presión`,
      moduleChip: "Márgenes",
      payload: {
        modulo: "margenes",
        clientes: payload.tier1Names,
        mechanismBanner: "Erosión comercial",
      },
    };
  }

  return null;
}

export function identifyPrimaryMechanism(clientName, scan) {
  for (const [mechanismId, m] of Object.entries(scan)) {
    if (!m.triggered) continue;
    const top3 = m.instances.slice(0, 3);
    if (top3.some(i => i.clientName === clientName)) {
      return { id: mechanismId, nombre: m.nombre };
    }
  }
  return null;
}

export function runReasoningEngine(clientName, scenarioId) {
  // Layer 1: run all 14 primitives
  const primitives = {};
  Object.keys(PRIMITIVES).forEach(key => {
    primitives[key] = PRIMITIVES[key](clientName, scenarioId);
  });

  // Layer 2: run all 5 causal relations
  const causal = {};
  Object.keys(CAUSAL).forEach(key => {
    causal[key] = CAUSAL[key](clientName, scenarioId);
  });

  // Layer 3: detect templates (consumes primitives + causal)
  const templates = detectTemplates(clientName, scenarioId);

  // Summary: count triggered patterns at each layer
  const summary = {
    primitives_triggered: Object.entries(primitives).filter(([, v]) => v.triggered).map(([k]) => k),
    causal_triggered: Object.entries(causal).filter(([, v]) => v.triggered).map(([k]) => k),
    templates_triggered: templates.map(t => t.id),
    highest_severity_template: templates[0]?.id || null,
  };

  return {
    client: clientName,
    scenario: scenarioId,
    layers: {
      primitives: primitives,
      causal: causal,
      templates: templates,
    },
    summary: summary,
    timestamp: Date.now(),
  };
}

export function getResponseContext(uiState = {}) {
  // uiState shape (expected from React component):
  //   {
  //     activeModule, activeFilters, lastClientMentioned,
  //     lastTemplateMentioned, lastModuleConsulted, turnCount,
  //     userInputText, surfaceLocation
  //   }
  // All fields optional. Defaults are conservative.

  const {
    activeModule = "ventas",
    activeFilters = {},
    lastClientMentioned = null,
    lastTemplateMentioned = null,
    lastModuleConsulted = null,
    turnCount = 0,
    userInputText = "",
    surfaceLocation = "chat",
  } = uiState;

  // Detect comparison from user input
  // Pattern: "compara X con Y", "X vs Y", "diferencia entre X y Y"
  const comparisonActive = _detectComparison(userInputText);

  return {
    activeModule: activeModule,
    activeFilters: activeFilters,
    priorConversation: {
      lastClientMentioned: lastClientMentioned,
      lastTemplateMentioned: lastTemplateMentioned,
      lastModuleConsulted: lastModuleConsulted,
      turnCount: turnCount,
    },
    comparisonActive: comparisonActive,
    surfaceLocation: surfaceLocation,
  };
}

export function _detectComparison(userText) {
  if (!userText || typeof userText !== "string") {
    return { isComparing: false, entityA: null, entityB: null };
  }
  const lower = userText.toLowerCase();
  // Pattern A: "compara X con Y" / "compara X y Y"
  const patternA = /compara\s+a?\s*([\wáéíóúñ\s]+?)\s+(?:con|y|vs)\s+([\wáéíóúñ\s]+?)(?:\?|$|\.)/i;
  const matchA = lower.match(patternA);
  if (matchA) {
    return {
      isComparing: true,
      entityA: matchA[1].trim(),
      entityB: matchA[2].trim(),
    };
  }
  // Pattern B: "X vs Y"
  const patternB = /([\wáéíóúñ]+(?:\s[\wáéíóúñ]+)?)\s+vs\s+([\wáéíóúñ]+(?:\s[\wáéíóúñ]+)?)/i;
  const matchB = lower.match(patternB);
  if (matchB) {
    return {
      isComparing: true,
      entityA: matchB[1].trim(),
      entityB: matchB[2].trim(),
    };
  }
  return { isComparing: false, entityA: null, entityB: null };
}

export function selectBrevity(trace, context = {}, userInputText = "") {
  const text = (userInputText || "").toLowerCase().trim();

  // MICRO triggers: pure affirmative or negative replies
  const microPatterns = ["sí", "si", "ok", "okay", "dale", "claro", "no", "nope"];
  if (microPatterns.includes(text)) return "micro";

  // EXPANDED triggers: explicit drill request keywords
  const expandedKeywords = ["explícame", "explicame", "profundiza", "profundizá",
                            "detalle", "más detalle", "en profundidad", "drill",
                            "drilldown"];
  if (expandedKeywords.some(k => text.includes(k))) return "expanded";

  // SHORT triggers: follow-up on same client (turnCount >= 2 + already mentioned)
  const turnCount = context.priorConversation?.turnCount || 0;
  const lastClient = context.priorConversation?.lastClientMentioned;
  if (turnCount >= 2 && lastClient === trace.client) return "short";

  // MEDIUM: default for first deep-dive
  return "medium";
}
