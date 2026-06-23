/* === config/cognitiveData.js ===
 * Datos de ancla extraídos de 41cc33d8 · byte-idénticos (Fase 4c). */

import { PRIMITIVES } from "./primitives.js";

export const OBSERVABLE_RELATIONS = {
  cliente: {
    obs_carga_sobre_referencia: {
      tipo: "impacto_economico",
      priority: 1, // mayor accionabilidad · "puedes recuperar $XK"
      evaluate: (clientName, margenes, ventas, scenario) => {
        const cm = margenes.find(c => c.nombre === clientName);
        const cv = ventas.find(c => c.nombre === clientName);
        if (!cm || !cv) return null;
        const BEST_PRACTICE = 3.0;
        // Trigger: carga supera referencia interna en más de 1pp
        if (cm.pctRebate <= BEST_PRACTICE + 1.0) return null;
        const deltaCarga = (cm.pctRebate - BEST_PRACTICE).toFixed(1);
        // Recuperable runtime · coherencia con generateSimulation memClient
        // y composePriorityRecommendationV2 (#12) · usa clientesVentas.actual.
        const recuperable = Math.round((cm.pctRebate - BEST_PRACTICE) / 100 * cv.actual);
        return {
          triggered: true,
          value: recuperable,
          text: `La carga comercial está ${deltaCarga} puntos sobre la referencia interna · aproximadamente $${recuperable}K menos de captura de contribución vs benchmark.`,
        };
      },
    },
    obs_crecimiento_sin_proporcion: {
      tipo: "impacto_economico",
      priority: 2, // insight de calidad · segundo más accionable
      evaluate: (clientName, margenes, ventas, scenario) => {
        const cv = ventas.find(c => c.nombre === clientName);
        const cm = margenes.find(c => c.nombre === clientName);
        if (!cv || !cm) return null;
        const benchmark_cartera = 30.1;
        if (!cv.anterior || cv.anterior <= 0) return null;
        const crecimiento = ((cv.actual - cv.anterior) / cv.anterior) * 100;
        // Trigger: crecimiento >5% YoY AND margen por debajo de benchmark
        if (crecimiento <= 5 || cm.margen >= benchmark_cartera) return null;
        const deltaMargen = (benchmark_cartera - cm.margen).toFixed(1);
        return {
          triggered: true,
          value: crecimiento * Math.abs(parseFloat(deltaMargen)),
          text: `Crece +${crecimiento.toFixed(1)}% YoY mientras opera ${deltaMargen} puntos bajo benchmark · el crecimiento no se transforma en la misma proporción en contribución.`,
        };
      },
    },
    obs_margen_bajo_benchmark: {
      tipo: "impacto_economico",
      priority: 3, // diagnóstico · menos accionable como observable único
      evaluate: (clientName, margenes, ventas, scenario) => {
        const cm = margenes.find(c => c.nombre === clientName);
        if (!cm) return null;
        const benchmark_cartera = 30.1;
        // Trigger: margen del cliente más de 2pp bajo benchmark de cartera
        if (cm.margen >= benchmark_cartera - 2.0) return null;
        const deltaMargen = (benchmark_cartera - cm.margen).toFixed(1);
        return {
          triggered: true,
          value: parseFloat(deltaMargen) * 100,
          text: `Opera con margen ${cm.margen}% mientras el benchmark de cartera es ${benchmark_cartera}% · diferencia de ${deltaMargen} puntos.`,
        };
      },
    },
    obs_concentracion_cartera: {
      tipo: "riesgo",
      priority: 1, // único riesgo CLIENTE V1
      evaluate: (clientName, margenes, ventas, scenario) => {
        const cv = ventas.find(c => c.nombre === clientName);
        if (!cv) return null;
        const totalVentas = ventas.reduce((s, c) => s + (c.actual || 0), 0);
        if (totalVentas <= 0) return null;
        const participacion = (cv.actual / totalVentas) * 100;
        // Trigger: cuenta concentra más del 18% del total de ventas
        if (participacion <= 18) return null;
        return {
          triggered: true,
          value: participacion,
          text: `Aporta ${participacion.toFixed(1)}% del total de ventas · concentración alta en una sola cuenta.`,
        };
      },
    },
  },
  // MÓDULO y SKU reservados · diferidos a BRIEF futuro post-V_VISUAL.
  modulo: {},
  sku: {},
};

export const POOL_CONCLUYE_BASE = {
  "Volumen con carga alta y margen presionado": [
    "La cuenta es volumen necesario, con costo estructural alto.",
    "Volumen indispensable que la cartera paga caro en margen.",
    "Cuenta estructuralmente cara de sostener, difícil de soltar.",
  ],
  "Volumen sano con contribución estructural": [
    "La cuenta sostiene volumen y contribución de manera estable.",
    "Pieza estable del Top de la cartera, sin tensión inmediata.",
    "Aporte estructural sólido, sin señales de deterioro.",
  ],
  "Margen alto con baja carga comercial": [
    "La cuenta es la excepción virtuosa de la cartera.",
    "Combinación poco común de rentabilidad y crecimiento sin costo comercial.",
    "Modelo de cuenta deseable: rinde sobre promedio y no exige carga comercial.",
  ],
  "Margen sano con carga moderada": [
    "La cuenta opera dentro de un perfil saludable.",
    "Combinación equilibrada que no requiere intervención inmediata.",
    "Cuenta sin tensiones estructurales relevantes.",
  ],
  "Margen alto con carga cara": [
    "El margen alto no compensa el costo comercial que la cuenta exige.",
    "Rentabilidad superficial: la carga comercial neutraliza el margen unitario.",
    "Cuenta rentable en apariencia, costosa en estructura comercial.",
  ],
  "Cuenta de baja escala con margen sano": [
    "La cuenta aporta rentabilidad sin mover el negocio.",
    "Volumen marginal, contribución unitaria por encima del promedio.",
    "Aporte rentable pero no estructural a la cartera.",
  ],
  "default": [
    "La cuenta presenta señales mixtas que conviene revisar.",
    "Perfil irregular que requiere lectura caso a caso.",
    "Combinación heterogénea de fortalezas y debilidades.",
  ],
};

export const POOL_CONCLUYE_DECLINE = [
  "La tendencia exige atención antes que la estructura.",
  "El deterioro reciente pesa más que el perfil de base.",
  "La caída del período supera la lectura estructural de la cuenta.",
];

export const POOL_CONECTORES_CONTEXT = [
  "hoy concentra",
  "explica hoy",
  "sostiene",
  "actualmente combina",
];

export const CAUSAL = {

  // §4.2.1 · Sales Growth + Contribution Decline = Low Quality Growth
  lowQualityGrowth(clientName, scenarioId) {
    const lastPeriod = PRIMITIVES.compareVsLastPeriod(clientName, scenarioId);
    const benchmark  = PRIMITIVES.compareVsBenchmark(clientName, scenarioId);
    const growthQual = PRIMITIVES.detectGrowthDeterioration(clientName, scenarioId);

    const triggered = growthQual.triggered;
    return {
      triggered: triggered,
      severity: growthQual.severity,
      confidence: "high",
      evidence: {
        variation: lastPeriod.evidence.deltaPct,
        marginGap: benchmark.evidence.gap,
        quality: growthQual.evidence.quality,
      },
      primitives_involved: ["compareVsLastPeriod", "compareVsBenchmark", "detectGrowthDeterioration"],
      silent_reason: triggered ? null : "no low-quality growth pattern",
    };
  },

  // §4.2.2 · Rebates Up + Margin Down = Commercial Erosion
  commercialErosion(clientName, scenarioId) {
    const leakage   = PRIMITIVES.detectLeakage(clientName, scenarioId);
    const erosion   = PRIMITIVES.detectErosion(clientName, scenarioId);

    const triggered = leakage.triggered && erosion.triggered;
    return {
      triggered: triggered,
      severity: triggered ? (leakage.severity === "high" || erosion.severity === "high" ? "high" : "medium") : null,
      confidence: "high",
      evidence: {
        pctRebate: leakage.evidence.pctRebate,
        bestPractice: leakage.evidence.bestPractice,
        leakagePp: leakage.evidence.leakagePp,
        marginGap: erosion.evidence.gap,
      },
      primitives_involved: ["detectLeakage", "detectErosion"],
      silent_reason: triggered ? null : "no commercial erosion pattern (requires both leakage and erosion)",
    };
  },

  // §4.2.3 · Inventory Up + Flat Sell-Out = Trapped Capital
  // NOT applicable at client deep-dive level. Stub returns silent.
  trappedCapital(clientName, scenarioId) {
    return {
      triggered: false,
      severity: null,
      confidence: "low",
      evidence: {},
      primitives_involved: ["detectTrappedCapital"],
      silent_reason: "trapped capital is inventory-level pattern, not client-level",
    };
  },

  // §4.2.4 · Customer Concentration → Dependency Risk
  dependencyRisk(clientName, scenarioId) {
    const concentration = PRIMITIVES.detectConcentration(clientName, scenarioId);
    const dependency    = PRIMITIVES.detectDependencyRisk(clientName, scenarioId);

    const triggered = dependency.triggered;
    return {
      triggered: triggered,
      severity: dependency.severity,
      confidence: "high",
      evidence: {
        participacion: dependency.evidence.participacion,
        isUnique: dependency.evidence.isUnique,
        uniqueReason: dependency.evidence.uniqueReason,
      },
      primitives_involved: ["detectConcentration", "detectDependencyRisk"],
      silent_reason: triggered ? null : "no dependency risk pattern",
    };
  },

  // §4.2.5 · Pricing Below Benchmark + Rising Costs = Margin Compression
  // At client level, approximated by: benchmark gap + leakage (the rebate
  // proxy for cost-of-business with the client).
  marginCompression(clientName, scenarioId) {
    const benchmark = PRIMITIVES.compareVsBenchmark(clientName, scenarioId);
    const leakage   = PRIMITIVES.detectLeakage(clientName, scenarioId);
    const tradeoff  = PRIMITIVES.detectTradeoff(clientName, scenarioId);

    const triggered = benchmark.triggered && benchmark.evidence.position === "below"
                   && (leakage.triggered || tradeoff.triggered);
    return {
      triggered: triggered,
      severity: triggered ? (benchmark.severity === "high" ? "high" : "medium") : null,
      confidence: "medium",
      evidence: {
        marginGap: benchmark.evidence.gap,
        leakagePresent: leakage.triggered,
        tradeoffPresent: tradeoff.triggered,
      },
      primitives_involved: ["compareVsBenchmark", "detectLeakage", "detectTradeoff"],
      silent_reason: triggered ? null : "no margin compression pattern",
    };
  },
};
