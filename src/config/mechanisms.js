/* === config/mechanisms.js ===
 * Datos extraídos de 41cc33d8 · byte-idénticos · surfaceados en Fase 4 (aditivo). */

import { applyScenarioToClientesMargen, applyScenarioToClientesVentas } from "../engine/scenarios.js";
import { PRIMITIVES } from "./primitives.js";

export const MECHANISM_REGISTRY = {
  commercial_erosion: {
    id: "commercial_erosion",
    nombre: "erosión comercial",
    nombre_capitalizado: "Erosión comercial",
    clausula: "§4.2.2",
    descripcion_humana: "La presión aparece cuando la carga comercial aumenta más rápido que el margen que genera",

    detect: function(clientName, scenarioId) {
      const benchmark = PRIMITIVES.compareVsBenchmark(clientName, scenarioId);
      const leakage = PRIMITIVES.detectLeakage(clientName, scenarioId);
      return benchmark.triggered &&
             benchmark.evidence.position === "below" &&
             leakage.triggered;
    },

    gatherEvidence: function(clientName, scenarioId) {
      const benchmark = PRIMITIVES.compareVsBenchmark(clientName, scenarioId);
      const leakage = PRIMITIVES.detectLeakage(clientName, scenarioId);
      const ventas = applyScenarioToClientesVentas(scenarioId);
      const margenes = applyScenarioToClientesMargen(scenarioId);
      const cliente = ventas.find(c => c.nombre === clientName);
      const margenCliente = margenes.find(c => c.nombre === clientName);

      if (!cliente || !margenCliente) return null;

      const bestPractice = 3.0;
      const gap_carga_pp = leakage.evidence.pctRebate - bestPractice;
      const target_carga = 3.5;
      const recuperable_at_target = gap_carga_pp > 0 && leakage.evidence.pctRebate > target_carga
        ? ((leakage.evidence.pctRebate - target_carga) / 100) * cliente.actual
        : 0;
      const recuperable_at_bestPractice = (gap_carga_pp / 100) * cliente.actual;

      return {
        clientName,
        ventas_M: +(cliente.actual / 1000).toFixed(2),
        margen_pct: margenCliente.margen,
        gap_margen_pp: +(benchmark.evidence.gap).toFixed(1),
        carga_pct: leakage.evidence.pctRebate,
        gap_carga_pp: +gap_carga_pp.toFixed(1),
        bestPractice_pct: bestPractice,
        recuperable_at_target_3_5: Math.round(recuperable_at_target),
        recuperable_at_bestPractice_3_0: Math.round(recuperable_at_bestPractice),
        contribucion_M: +(margenCliente.contribucion / 1000).toFixed(2),
      };
    },

    severityOfInstance: function(instance) {
      if (instance.gap_carga_pp >= 1.5 && instance.gap_margen_pp >= 6) return "alta";
      if (instance.gap_carga_pp >= 1.0 || instance.gap_margen_pp >= 4) return "media";
      return "baja";
    },

    relations: {
      quality_of_growth_deterioration: "causal_proximal",
    },
  },

  quality_of_growth_deterioration: {
    id: "quality_of_growth_deterioration",
    nombre: "deterioro de calidad de crecimiento",
    nombre_capitalizado: "Deterioro de calidad de crecimiento",
    clausula: "§4.2.1",
    descripcion_humana: "El crecimiento se captura a costa del margen unitario",

    detect: function(clientName, scenarioId) {
      const lastPeriod = PRIMITIVES.compareVsLastPeriod(clientName, scenarioId);
      const benchmark = PRIMITIVES.compareVsBenchmark(clientName, scenarioId);
      return lastPeriod.triggered &&
             lastPeriod.evidence.deltaPct > 3 &&
             benchmark.triggered &&
             benchmark.evidence.position === "below" &&
             benchmark.evidence.gap >= 4;
    },

    gatherEvidence: function(clientName, scenarioId) {
      const lastPeriod = PRIMITIVES.compareVsLastPeriod(clientName, scenarioId);
      const benchmark = PRIMITIVES.compareVsBenchmark(clientName, scenarioId);
      const ventas = applyScenarioToClientesVentas(scenarioId);
      const margenes = applyScenarioToClientesMargen(scenarioId);
      const cliente = ventas.find(c => c.nombre === clientName);
      const margenCliente = margenes.find(c => c.nombre === clientName);

      if (!cliente || !margenCliente) return null;

      const crecimiento_M = +((cliente.actual - cliente.anterior) / 1000).toFixed(2);
      const benchmark_pct = 30.1;
      const contrib_teorica = (cliente.actual * benchmark_pct) / 100 / 1000;
      const contrib_real = margenCliente.contribucion / 1000;
      const contribucion_perdida = +(contrib_teorica - contrib_real).toFixed(2);

      return {
        clientName,
        ventas_M: +(cliente.actual / 1000).toFixed(2),
        crecimiento_pct: lastPeriod.evidence.deltaPct,
        crecimiento_M: crecimiento_M,
        margen_pct: margenCliente.margen,
        benchmark_pct: benchmark_pct,
        gap_margen_pp: +benchmark.evidence.gap.toFixed(1),
        contribucion_perdida_M: contribucion_perdida,
      };
    },

    severityOfInstance: function(instance) {
      if (instance.crecimiento_pct >= 10 && instance.gap_margen_pp >= 6) return "alta";
      if (instance.crecimiento_pct >= 5 || instance.gap_margen_pp >= 4) return "media";
      return "baja";
    },

    relations: {
      commercial_erosion: "causal_consequence",
    },
  },

  customer_dependency_risk: {
    id: "customer_dependency_risk",
    nombre: "riesgo de dependencia de cliente",
    nombre_capitalizado: "Riesgo de dependencia de cliente",
    clausula: "§4.2.4",
    descripcion_humana: "La concentración aumenta el costo de cualquier pérdida estructural",

    detect: function(clientName, scenarioId) {
      const concentration = PRIMITIVES.detectConcentration(clientName, scenarioId);
      return concentration.triggered && concentration.evidence.participacion >= 10;
    },

    gatherEvidence: function(clientName, scenarioId) {
      const concentration = PRIMITIVES.detectConcentration(clientName, scenarioId);
      const ventas = applyScenarioToClientesVentas(scenarioId);
      const margenes = applyScenarioToClientesMargen(scenarioId);
      const cliente = ventas.find(c => c.nombre === clientName);
      const margenCliente = margenes.find(c => c.nombre === clientName);

      if (!cliente || !margenCliente) return null;

      return {
        clientName,
        ventas_M: +(cliente.actual / 1000).toFixed(2),
        participacion_pct: concentration.evidence.participacion,
        contribucion_M: +(margenCliente.contribucion / 1000).toFixed(2),
        contribucion_expuesta_M: +(margenCliente.contribucion / 1000).toFixed(2),
      };
    },

    severityOfInstance: function(instance) {
      if (instance.participacion_pct >= 15) return "alta";
      if (instance.participacion_pct >= 10) return "media";
      return "baja";
    },

    relations: {},
  },

  trapped_capital: {
    id: "trapped_capital",
    nombre: "capital atrapado",
    nombre_capitalizado: "Capital atrapado",
    clausula: "§4.2.3",
    descripcion_humana: "El inventario congela liquidez sin retornar al ciclo comercial",
    detect: function(clientName, scenarioId) { return false; },
    gatherEvidence: function(clientName, scenarioId) { return null; },
    severityOfInstance: function(instance) { return "baja"; },
    relations: { liquidity_compression: "causal_proximal" },
  },

  liquidity_compression: {
    id: "liquidity_compression",
    nombre: "compresión de liquidez",
    nombre_capitalizado: "Compresión de liquidez",
    clausula: "§4.2.5",
    descripcion_humana: "El flujo de caja se comprime cuando capital de trabajo absorbe más recursos de los esperados",
    detect: function(clientName, scenarioId) { return false; },
    gatherEvidence: function(clientName, scenarioId) { return null; },
    severityOfInstance: function(instance) { return "baja"; },
    relations: {},
  },
};
