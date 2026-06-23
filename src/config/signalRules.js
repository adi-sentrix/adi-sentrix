/* === CONFIG · reglas del motor de señales ===
 * Datos extraídos de 41cc33d8 · valores byte-idénticos · surfaceados por el motor en Fase 3.
 * Los archivos aprobados de Fase 2 quedan intactos; esto es aditivo. */

export const INTERNAL_DRIVER_RULES = {
  // ── client.margen · driver = carga comercial sobre promedio interno ──
  // F1 (founder): cifras runtime reales · cuando gap > 0.5pp → driver activo
  // (mechanism "internal_commercial_load"). Cuando 0 < gap ≤ 0.5pp → driver
  // "borderline" para que narrativa plantee juicio de oportunidad explícito
  // (NO inflar el caso · pero tampoco silenciar el origen interno).
  "client.margen": {
    detect: (entity, scope) => {
      if (!entity || typeof entity.pctRebate !== "number" || !Array.isArray(scope)) return null;
      const avg = scope.reduce((s, c) => s + (c.pctRebate || 0), 0) / scope.length;
      const gap = entity.pctRebate - avg;
      if (gap > 0.5) {
        return {
          mechanism: "internal_commercial_load",
          factor: "carga_comercial",
          value: entity.pctRebate,
          vs_promedio: +gap.toFixed(2),
          unit: "pp",
          chain: ["carga_comercial_alta", "margen_unitario_bajo"],
          borderline: false,
        };
      }
      if (gap > 0) {
        // Borderline · gap positivo pero pequeño · narrativa plantea juicio
        return {
          mechanism: "internal_commercial_load",
          factor: "carga_comercial",
          value: entity.pctRebate,
          vs_promedio: +gap.toFixed(2),
          unit: "pp",
          chain: ["carga_comercial_levemente_alta"],
          borderline: true,
        };
      }
      return null;
    },
    calculateRecoverable: (entity, driver, scope) => {
      // Recoverable si entity baja pctRebate al promedio interno
      if (!entity || !Array.isArray(scope)) return 0;
      const avg = scope.reduce((s, c) => s + (c.pctRebate || 0), 0) / scope.length;
      const gap_pp = entity.pctRebate - avg;
      return Math.round(entity.venta * (gap_pp / 100)); // en $K (venta ya en $K)
    },
    suggestedAction: (entity, scope, recoverable) => {
      const avg = scope.reduce((s, c) => s + (c.pctRebate || 0), 0) / scope.length;
      const target_carga = +avg.toFixed(1);
      const target_margen = +(entity.margen + (entity.pctRebate - target_carga)).toFixed(1);
      return {
        verb: "renegociar_carga_comercial",
        target_entity: entity.nombre,
        expected_impact: { metric: "margen", from: entity.margen, to: target_margen },
        risk: "bajo",
        recoverable_K: recoverable,
        target_carga,
        // Cifras alternativas para narrativa con juicio de oportunidad
        bestPractice_carga: 3.0,
        bestPractice_recoverable_K: Math.round(entity.venta * ((entity.pctRebate - 3.0) / 100)),
      };
    },
  },

  // ── client.contribucion · driver = margen unitario bajo benchmark ──
  "client.contribucion": {
    detect: (entity) => {
      if (!entity || !entity.benchmark || typeof entity.margen !== "number") return null;
      const gap = entity.benchmark - entity.margen;
      if (gap > 5) {
        return {
          mechanism: "internal_margin_compression",
          factor: "margen_unitario",
          value: entity.margen,
          vs_benchmark: +gap.toFixed(1),
          unit: "pp",
          chain: ["margen_unitario_bajo", "contribucion_diluida"],
        };
      }
      return null;
    },
    calculateRecoverable: (entity) => {
      const gap = entity.benchmark - entity.margen;
      return Math.round(entity.venta * (gap / 100));
    },
    suggestedAction: (entity, scope, recoverable) => ({
      verb: "recuperar_margen_unitario",
      target_entity: entity.nombre,
      expected_impact: { metric: "margen", from: entity.margen, to: entity.benchmark },
      risk: "medio",
      recoverable_K: recoverable,
    }),
  },

  // ── sku.rotacion · driver = DOH alto · capital atrapado ──
  "sku.rotacion": {
    detect: (entity, scope) => {
      if (!entity || typeof entity.rotacion !== "number" || !Array.isArray(scope)) return null;
      const avg = scope.reduce((s, k) => s + (k.rotacion || 0), 0) / scope.length;
      if (entity.rotacion < avg / 2 && entity.doh > 90) {
        return {
          mechanism: "operational_inefficiency",
          factor: "doh_alto",
          value: entity.doh,
          vs_promedio_rotacion: +avg.toFixed(1),
          unit: "d",
          chain: ["rotacion_baja", "capital_inmovilizado"],
        };
      }
      return null;
    },
    calculateRecoverable: (entity) => entity.stockUSD || 0,
    suggestedAction: (entity, scope, recoverable) => ({
      verb: "plan_de_salida",
      target_entity: entity.sku,
      expected_impact: { metric: "stockUSD", from: entity.stockUSD, to: 0 },
      risk: "medio",
      recoverable_K: Math.round(recoverable / 1000),
    }),
  },

  // ── sku.stockUSD · driver = DOH alto ──
  "sku.stockUSD": {
    detect: (entity) => {
      if (!entity || typeof entity.doh !== "number") return null;
      if (entity.doh > 90) {
        return {
          mechanism: "operational_inefficiency",
          factor: "doh_alto",
          value: entity.doh,
          unit: "d",
          chain: ["doh_alto", "capital_inmovilizado"],
        };
      }
      return null;
    },
    calculateRecoverable: (entity) => entity.stockUSD || 0,
    suggestedAction: (entity, scope, recoverable) => ({
      verb: "liquidar",
      target_entity: entity.sku,
      expected_impact: { metric: "stockUSD", from: entity.stockUSD, to: 0 },
      risk: "alto",
      recoverable_K: Math.round(recoverable / 1000),
    }),
  },

  // ── Placeholders (null detector · narrativa salta movimiento causal) ──
  "client.ventas":       { detect: () => null, calculateRecoverable: () => 0, suggestedAction: () => null },
  "client.carga":        { detect: () => null, calculateRecoverable: () => 0, suggestedAction: () => null },
  "sku.cobertura":       { detect: () => null, calculateRecoverable: () => 0, suggestedAction: () => null },
  "sku.doh":             { detect: () => null, calculateRecoverable: () => 0, suggestedAction: () => null },
  "sku.sku_margen":      { detect: () => null, calculateRecoverable: () => 0, suggestedAction: () => null },
  "sku.sku_contribucion":{ detect: () => null, calculateRecoverable: () => 0, suggestedAction: () => null },
};

export const EXECUTIVE_REFRAMES = {
  internal_commercial_load:
    "El volumen ya está. La conversación que vale es si la carga comercial sigue justificándose al valor que hoy genera.",
  internal_margin_compression:
    "El problema no parece estar en el cliente; está en cuánto valor decidimos ceder para mantener la venta.",
  structural_dependency:
    "El riesgo no está en el cliente; está en cuánto depende el negocio de él.",
  operational_inefficiency:
    "El problema no parece ser la demanda; el capital está moviéndose más lento de lo que el negocio necesita.",
  // M.B.2 placeholders · founder valida
  quality_growth_derived:
    "El deterioro de calidad de crecimiento no es la enfermedad; es el síntoma. La causa está en la carga comercial sostenida.",
  mechanism_priority_controllability:
    "No todos los mecanismos cuestan lo mismo en intervención. Vale empezar por el más controlable.",
  // BRIEF N · reframes Executive Intelligence (firmados founder D-N-3)
  parallel_horizons:
    "Sembrar este mes lo que se cosecha en seis.",
  hidden_blind_spot:
    "El margen comprimido lo estás viendo · el margen ofrecido para sostener crecimiento · no.",
};
