/* === config/primitives.js ===
 * Datos extraídos de 41cc33d8 · byte-idénticos · surfaceados en Fase 4 (aditivo). */

import { getSubstitutionMap } from "../adi/detectors.js";
import { applyScenarioToClientesMargen, applyScenarioToClientesVentas } from "../engine/scenarios.js";

export const PRIMITIVES = {

  // §3.2.1 · COMPARE_VS_LASTPERIOD
  // Detects delta between current period and prior year.
  compareVsLastPeriod(clientName, scenarioId) {
    const ventas = applyScenarioToClientesVentas(scenarioId);
    const v = ventas.find(c => c.nombre === clientName);
    if (!v) return { triggered: false, severity: null, confidence: "high", evidence: {}, silent_reason: "client not in dataset" };

    const delta    = v.actual - v.anterior;
    const deltaPct = (delta / v.anterior) * 100;
    const absMaterial = Math.abs(deltaPct) >= 3; // 3% materiality threshold

    return {
      triggered: absMaterial,
      severity: Math.abs(deltaPct) >= 10 ? "high" : Math.abs(deltaPct) >= 3 ? "medium" : "low",
      confidence: "high",
      evidence: {
        actual: v.actual,
        anterior: v.anterior,
        delta: delta,
        deltaPct: +deltaPct.toFixed(1),
        direction: deltaPct >= 0 ? "growth" : "decline",
      },
      silent_reason: absMaterial ? null : "delta below materiality threshold (<3%)",
    };
  },

  // §3.2.2 · COMPARE_VS_BUDGET
  // Detects variance between actual and budgeted target.
  compareVsBudget(clientName, scenarioId) {
    const ventas = applyScenarioToClientesVentas(scenarioId);
    const v = ventas.find(c => c.nombre === clientName);
    if (!v) return { triggered: false, severity: null, confidence: "high", evidence: {}, silent_reason: "client not in dataset" };
    if (!v.presupuesto) return { triggered: false, severity: null, confidence: "low", evidence: {}, silent_reason: "no budget data" };

    const variance    = v.actual - v.presupuesto;
    const variancePct = (variance / v.presupuesto) * 100;
    const material    = Math.abs(variancePct) >= 5; // 5% materiality for budget

    return {
      triggered: material,
      severity: Math.abs(variancePct) >= 10 ? "high" : "medium",
      confidence: "high",
      evidence: {
        actual: v.actual,
        budget: v.presupuesto,
        variance: variance,
        variancePct: +variancePct.toFixed(1),
        favorable: variance >= 0,
      },
      silent_reason: material ? null : "variance below materiality threshold (<5%)",
    };
  },

  // §3.2.3 · COMPARE_VS_BENCHMARK
  // Detects positioning against category/market norm.
  compareVsBenchmark(clientName, scenarioId) {
    const margenes = applyScenarioToClientesMargen(scenarioId);
    const m = margenes.find(c => c.nombre === clientName);
    if (!m) return { triggered: false, severity: null, confidence: "high", evidence: {}, silent_reason: "client not in margin dataset" };

    const benchmark = m.benchmark || 30.1;
    const gap       = benchmark - m.margen;  // positive = below benchmark
    const material  = Math.abs(gap) >= 2;    // 2pp materiality

    return {
      triggered: material,
      severity: Math.abs(gap) >= 8 ? "high" : Math.abs(gap) >= 4 ? "medium" : "low",
      confidence: "high",
      evidence: {
        margen: m.margen,
        benchmark: benchmark,
        gap: +gap.toFixed(1),
        position: gap > 0 ? "below" : gap < 0 ? "above" : "at",
      },
      silent_reason: material ? null : "gap below materiality threshold (<2pp)",
    };
  },

  // §3.2.4 · DETECT_CONCENTRATION
  // Identifies business dependency on a customer.
  detectConcentration(clientName, scenarioId) {
    const ventas = applyScenarioToClientesVentas(scenarioId);
    const v = ventas.find(c => c.nombre === clientName);
    if (!v) return { triggered: false, severity: null, confidence: "high", evidence: {}, silent_reason: "client not in dataset" };

    const totalActual   = ventas.reduce((s, c) => s + c.actual, 0);
    const participacion = (v.actual / totalActual) * 100;
    const material      = participacion >= 8; // 8% materiality for concentration

    return {
      triggered: material,
      severity: participacion >= 18 ? "high" : participacion >= 12 ? "medium" : "low",
      confidence: "high",
      evidence: {
        participacion: +participacion.toFixed(1),
        actual: v.actual,
        totalActual: totalActual,
      },
      silent_reason: material ? null : "participation below materiality threshold (<8%)",
    };
  },

  // §3.2.5 · DETECT_EROSION
  // Identifies margin or pricing deterioration.
  // For client-level: erosion = margin gap below benchmark + (optional) rebate climbing.
  detectErosion(clientName, scenarioId) {
    const margenes = applyScenarioToClientesMargen(scenarioId);
    const m = margenes.find(c => c.nombre === clientName);
    if (!m) return { triggered: false, severity: null, confidence: "medium", evidence: {}, silent_reason: "client not in margin dataset" };

    const benchmark = m.benchmark || 30.1;
    const gap       = benchmark - m.margen;
    const eroded    = gap >= 4; // 4pp threshold for erosion

    return {
      triggered: eroded,
      severity: gap >= 8 ? "high" : "medium",
      confidence: "medium", // medium because true erosion requires time-series; we approximate via gap
      evidence: {
        margen: m.margen,
        benchmark: benchmark,
        gap: +gap.toFixed(1),
      },
      silent_reason: eroded ? null : "margin within benchmark band",
    };
  },

  // §3.2.6 · DETECT_CAUSALRELATION
  // Identifies cause-effect relationships. At primitive level, returns
  // candidate pairs of observed metrics that suggest causality.
  // CAUSAL layer composes these into named relations.
  detectCausalRelation(clientName, scenarioId) {
    const ventas   = applyScenarioToClientesVentas(scenarioId);
    const margenes = applyScenarioToClientesMargen(scenarioId);
    const v = ventas.find(c => c.nombre === clientName);
    const m = margenes.find(c => c.nombre === clientName);
    if (!v || !m) return { triggered: false, severity: null, confidence: "low", evidence: {}, silent_reason: "incomplete data for causal analysis" };

    const variacion = ((v.actual - v.anterior) / v.anterior) * 100;
    const gap       = (m.benchmark || 30.1) - m.margen;
    const carga     = v.pctRebate;

    // Surface signals that pair (CAUSAL layer interprets them)
    const signals = [];
    if (variacion >= 5 && gap >= 4) signals.push("sales_growth_with_margin_gap");
    if (carga >= 4 && gap >= 4)     signals.push("high_rebate_with_margin_gap");
    if (variacion < 0 && carga >= 4) signals.push("decline_with_sustained_rebate");

    return {
      triggered: signals.length > 0,
      severity: signals.length >= 2 ? "high" : signals.length === 1 ? "medium" : null,
      confidence: "medium",
      evidence: {
        signals: signals,
        variacion: +variacion.toFixed(1),
        gap: +gap.toFixed(1),
        carga: +carga.toFixed(1),
      },
      silent_reason: signals.length === 0 ? "no causal signals detected" : null,
    };
  },

  // §3.2.7 · DETECT_TRADEOFF
  // Identifies inverse relationships (e.g., volume up but margin down).
  detectTradeoff(clientName, scenarioId) {
    const ventas   = applyScenarioToClientesVentas(scenarioId);
    const margenes = applyScenarioToClientesMargen(scenarioId);
    const v = ventas.find(c => c.nombre === clientName);
    const m = margenes.find(c => c.nombre === clientName);
    if (!v || !m) return { triggered: false, severity: null, confidence: "low", evidence: {}, silent_reason: "incomplete data" };

    const variacion = ((v.actual - v.anterior) / v.anterior) * 100;
    const gap       = (m.benchmark || 30.1) - m.margen;
    // Tradeoff: sales growth + margin below benchmark + high rebate
    const tradeoff = variacion >= 5 && gap >= 4 && v.pctRebate >= 4;

    return {
      triggered: tradeoff,
      severity: tradeoff ? (variacion >= 10 ? "high" : "medium") : null,
      confidence: "medium",
      evidence: {
        variacion: +variacion.toFixed(1),
        gap: +gap.toFixed(1),
        carga: +v.pctRebate.toFixed(1),
        tradeoff_axis: tradeoff ? "volume_vs_profitability" : null,
      },
      silent_reason: tradeoff ? null : "no significant tradeoff detected",
    };
  },

  // §3.2.8 · DETECT_ANOMALY
  // Identifies outliers vs cartera average.
  detectAnomaly(clientName, scenarioId) {
    const ventas = applyScenarioToClientesVentas(scenarioId);
    const v = ventas.find(c => c.nombre === clientName);
    if (!v) return { triggered: false, severity: null, confidence: "high", evidence: {}, silent_reason: "client not in dataset" };

    // Compute cartera average pctRebate (excluding this client)
    const others = ventas.filter(c => c.nombre !== clientName);
    const avgRebate = others.reduce((s, c) => s + c.pctRebate, 0) / others.length;
    const deviation = v.pctRebate - avgRebate;
    const anomalous = Math.abs(deviation) >= 1.5; // 1.5pp from cartera average

    return {
      triggered: anomalous,
      severity: Math.abs(deviation) >= 2.5 ? "high" : "medium",
      confidence: "medium",
      evidence: {
        pctRebate: +v.pctRebate.toFixed(1),
        avgCarteraRebate: +avgRebate.toFixed(2),
        deviation: +deviation.toFixed(2),
        direction: deviation > 0 ? "above_average" : "below_average",
      },
      silent_reason: anomalous ? null : "rebate within cartera band",
    };
  },

  // §3.2.9 · DETECT_MIXSHIFT
  // At client level: detect if client's sfamilia composition is structurally
  // shifting the cartera mix. For deep-dive, returns position in sfamilia.
  detectMixShift(clientName, scenarioId) {
    const ventas = applyScenarioToClientesVentas(scenarioId);
    const v = ventas.find(c => c.nombre === clientName);
    if (!v) return { triggered: false, severity: null, confidence: "low", evidence: {}, silent_reason: "client not in dataset" };

    // Calculate share within client's sfamilia
    const sameSfamilia = ventas.filter(c => c.sfamilia === v.sfamilia);
    const sfamiliaTotal = sameSfamilia.reduce((s, c) => s + c.actual, 0);
    const shareInSfamilia = (v.actual / sfamiliaTotal) * 100;

    // Mix shift is silent at client level — meaningful at sfamilia aggregate.
    // We surface position only as low-confidence evidence.
    return {
      triggered: false, // Always silent at client level
      severity: null,
      confidence: "low",
      evidence: {
        sfamilia: v.sfamilia,
        shareInSfamilia: +shareInSfamilia.toFixed(1),
      },
      silent_reason: "mix shift detection requires sfamilia-level aggregation (not client-level)",
    };
  },

  // §3.2.10 · DETECT_TRAPPEDCAPITAL
  // Working capital locked in inventory. NOT available at client deep-dive
  // (requires inventory data per client which dataset does not expose).
  detectTrappedCapital(clientName, scenarioId) {
    return {
      triggered: false,
      severity: null,
      confidence: "low",
      evidence: {},
      silent_reason: "trapped capital detection requires inventory-level data not available at client deep-dive",
    };
  },

  // §3.2.11 · DETECT_HIDDENPROFITABILITY
  // Identifies profit pockets. Two paths:
  //   PATH A: margin >= benchmark (classic hidden profitability)
  //   PATH B: structurally virtuous profile (margin near benchmark + low rebate + strong growth)
  // This implements the threshold extension discussed in audit of #12-C.1.
  detectHiddenProfitability(clientName, scenarioId) {
    const ventas   = applyScenarioToClientesVentas(scenarioId);
    const margenes = applyScenarioToClientesMargen(scenarioId);
    const v = ventas.find(c => c.nombre === clientName);
    const m = margenes.find(c => c.nombre === clientName);
    if (!v || !m) return { triggered: false, severity: null, confidence: "high", evidence: {}, silent_reason: "incomplete data" };

    const benchmark    = m.benchmark || 30.1;
    const variacion    = ((v.actual - v.anterior) / v.anterior) * 100;
    const totalActual  = ventas.reduce((s, c) => s + c.actual, 0);
    const participacion = (v.actual / totalActual) * 100;

    // PATH A: classic hidden profitability — margin above benchmark
    const pathA = m.margen >= benchmark;
    // PATH B: structurally virtuous — margin near benchmark + low rebate + strong growth
    const pathB = m.margen >= benchmark - 2 && v.pctRebate < 2.5 && variacion >= 10;

    const triggered = pathA || pathB;

    return {
      triggered: triggered,
      severity: pathA && m.margen >= benchmark + 3 ? "high"
              : triggered ? "medium" : null,
      confidence: "high",
      evidence: {
        margen: m.margen,
        benchmark: benchmark,
        marginPremium: +(m.margen - benchmark).toFixed(1),
        pctRebate: +v.pctRebate.toFixed(1),
        variacion: +variacion.toFixed(1),
        participacion: +participacion.toFixed(1),
        detected_via: pathA ? "classic" : pathB ? "structural_virtue" : null,
      },
      silent_reason: triggered ? null : "no hidden profitability pattern detected",
    };
  },

  // §3.2.12 · DETECT_LEAKAGE
  // Profit/margin leakage. At client level: rebate as % of sales vs best practice.
  detectLeakage(clientName, scenarioId) {
    const ventas = applyScenarioToClientesVentas(scenarioId);
    const v = ventas.find(c => c.nombre === clientName);
    if (!v) return { triggered: false, severity: null, confidence: "high", evidence: {}, silent_reason: "client not in dataset" };

    const bestPracticeRebate = 3.0; // constitutional reference
    const leakagePp = v.pctRebate - bestPracticeRebate;
    const leakage = leakagePp >= 1.0; // 1pp threshold for leakage

    return {
      triggered: leakage,
      severity: leakagePp >= 2.0 ? "high" : "medium",
      confidence: "high",
      evidence: {
        pctRebate: +v.pctRebate.toFixed(1),
        bestPractice: bestPracticeRebate,
        leakagePp: +leakagePp.toFixed(1),
        leakageAbsolute: Math.round(v.actual * leakagePp / 100), // approx $K leakage
      },
      silent_reason: leakage ? null : "rebate at or below best practice",
    };
  },

  // §3.2.13 · DETECT_DEPENDENCYRISK
  // Excessive reliance on a single customer.
  detectDependencyRisk(clientName, scenarioId) {
    const ventas = applyScenarioToClientesVentas(scenarioId);
    const v = ventas.find(c => c.nombre === clientName);
    if (!v) return { triggered: false, severity: null, confidence: "high", evidence: {}, silent_reason: "client not in dataset" };

    const totalActual   = ventas.reduce((s, c) => s + c.actual, 0);
    const participacion = (v.actual / totalActual) * 100;
    const substMap      = getSubstitutionMap(clientName, scenarioId);
    const isUnique      = substMap.isUnique;

    // Risk if: high participation (>= 15%) OR unique customer with no substitute
    const risk = participacion >= 15 || isUnique;

    return {
      triggered: risk,
      severity: participacion >= 18 ? "high"
              : (isUnique || participacion >= 15) ? "medium" : null,
      confidence: "high",
      evidence: {
        participacion: +participacion.toFixed(1),
        isUnique: isUnique,
        uniqueReason: isUnique ? (substMap.uniqueReason || null) : null,
      },
      silent_reason: risk ? null : "participation below threshold and substitutes available",
    };
  },

  // §3.2.14 · DETECT_GROWTHDETERIORATION
  // Quality of growth: sales up + margin below benchmark = low quality.
  detectGrowthDeterioration(clientName, scenarioId) {
    const ventas   = applyScenarioToClientesVentas(scenarioId);
    const margenes = applyScenarioToClientesMargen(scenarioId);
    const v = ventas.find(c => c.nombre === clientName);
    const m = margenes.find(c => c.nombre === clientName);
    if (!v || !m) return { triggered: false, severity: null, confidence: "low", evidence: {}, silent_reason: "incomplete data" };

    const variacion = ((v.actual - v.anterior) / v.anterior) * 100;
    const gap       = (m.benchmark || 30.1) - m.margen;
    // Low quality growth: client is growing, but margin is below benchmark
    const deterioration = variacion >= 5 && gap >= 4;

    return {
      triggered: deterioration,
      severity: deterioration ? (variacion >= 10 && gap >= 6 ? "high" : "medium") : null,
      confidence: "high",
      evidence: {
        variacion: +variacion.toFixed(1),
        margen: m.margen,
        gap: +gap.toFixed(1),
        quality: deterioration ? "low" : "acceptable",
      },
      silent_reason: deterioration ? null : "growth quality acceptable or no growth",
    };
  },
};
