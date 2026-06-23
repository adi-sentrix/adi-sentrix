/* === executiveReport.js ===
 * Cadena compositora "reporte ejecutivo" extraída de 41cc33d8 · verbatim.
 * Misma entrada → misma salida. La única diferencia con el monolito es DÓNDE
 * vive el dato (imports), nunca QUÉ vale ni CÓMO se calcula.
 *
 * Entry points públicos:
 *   · composeExecutiveReport(scenarioId, options)
 *   · composeExecutiveReportNarrative(report)
 */

import {
  VOICE_EXECUTIVE_REPORT_ENGINE_ENABLED,
  VOICE_VALORIZATION_FORWARD_LOOKING_ENABLED,
  VOICE_KPI_SELECTOR_ENABLED,
  VOICE_EXECUTIVE_REPORT_COMPOSER_ENABLED,
  ADI_PANORAMA_CAPITAL_ESCALA_FIX_ENABLED,
  ADI_RECUPERABLE_DUAL_ENABLED,
} from "../../config/voiceFlags.js";
import { EXECUTIVE_REFRAMES } from "../../config/signalRules.js";
import { _fmtMoneyK, _capEscalaK } from "../../engine/formatters.js";
import {
  applyScenarioToClientesVentas,
  applyScenarioToClientesMargen,
  applyScenarioToSkuInventario,
} from "../../engine/scenarios.js";
import {
  _aggregateVentas,
  _aggregateMargenes,
  _aggregateInventario,
} from "../../engine/metrics.js";
import { scanMechanisms } from "./thesis.js";

// ── classifySkuOperationalProfile · clasificación perfil SKU (monolito L11476) ──
function classifySkuOperationalProfile(sku) {
  if (sku.doh > 90 && sku.rotacion < 3) return "operational_inefficient";
  if (sku.doh <= 90 && sku.rotacion >= 3) return "high_volume_healthy";
  return "borderline";
}

// ── _buildHiddenAngleCifras · cifras por reveal angle (monolito L13735) ──────
function _buildHiddenAngleCifras(reveal, scenarioId) {
  try {
    if (reveal === "quality_growth_deterioration") {
      const scan = scanMechanisms(scenarioId);
      const m = scan?.quality_of_growth_deterioration;
      if (!m?.triggered || !m.aggregate) return null;
      const agg = m.aggregate;
      return {
        dimension: "calidad_crecimiento",
        cifra_M: agg.contribucion_perdida_M,
        instances_count: agg.instances_count,
        growth_min: agg.crecimiento_range?.min,
        growth_max: agg.crecimiento_range?.max,
      };
    }
    if (reveal === "customer_dependency_risk") {
      const scan = scanMechanisms(scenarioId);
      const m = scan?.customer_dependency_risk;
      if (!m?.triggered || !m.aggregate) return null;
      const agg = m.aggregate;
      return {
        dimension: "concentración_estructural",
        top3_names: agg.top3_names || [],
        concentration_pct: agg.top3_participacion_pct,
        exposed_M: agg.top3_contribucion_M,
      };
    }
    if (reveal === "sku_operational") {
      // Reusa lógica de _detectExecutiveActions (N.B.1) · NO duplica helper.
      // SKUs operational_inefficient · top 3 por stockUSD descendente.
      const inv = applyScenarioToSkuInventario(scenarioId);
      const critical = inv
        .filter(s => s.alerta === "crit" || s.alerta === "warn" || s.estado !== "Activo")
        .sort((a, b) => (b.stockUSD || 0) - (a.stockUSD || 0))
        .slice(0, 4);
      const op = critical.filter(s => classifySkuOperationalProfile(s) === "operational_inefficient").slice(0, 3);
      if (op.length === 0) return null;
      const stockK = Math.round(op.reduce((s, k) => s + (k.stockUSD || 0), 0) / 1000);
      const avgDoh = Math.round(op.reduce((s, k) => s + (k.doh || 0), 0) / op.length);
      return {
        dimension: "capital_operacional_atrapado",
        instances_count: op.length,
        capital_K: stockK,
        avg_doh: avgDoh,
        sku_names: op.map(s => s.sku),
      };
    }
    if (reveal === "commercial_erosion") {
      const scan = scanMechanisms(scenarioId);
      const m = scan?.commercial_erosion;
      if (!m?.triggered || !m.aggregate) return null;
      const agg = m.aggregate;
      return {
        dimension: "erosión_comercial",
        recuperable_K: agg.recuperable_total_K,
        recuperable_BP_M: agg.recuperable_total_M_at_3_0,
        instances_count: agg.instances_count,
      };
    }
  } catch (e) {
    // fail-safe
    return null;
  }
  return null;
}

// ── _extractFromMechanism · normaliza mechanism → BRIEF exterior (monolito L41342) ──
function _extractFromMechanism(mechanisms, mechanismId) {
  const m = mechanisms?.[mechanismId];
  if (!m || !m.triggered || !m.aggregate) {
    return { existe: false };
  }
  // Shape específico por mechanism · BRIEF exterior consistente
  if (mechanismId === "commercial_erosion") {
    return {
      existe: true,
      mechanismId,
      valor_recuperable_K: m.aggregate.recuperable_total_K,
      valor_recuperable_M_at_3_0: m.aggregate.recuperable_total_M_at_3_0,
      pct_of_total_sales: m.aggregate.pct_of_total_sales,
      pct_of_total_contribution: m.aggregate.pct_of_total_contribution,
      instances_count: m.aggregate.instances_count,
      top3_instances: m.instances.slice(0, 3),
    };
  }
  if (mechanismId === "quality_of_growth_deterioration") {
    return {
      existe: true,
      mechanismId,
      contribucion_perdida_M: m.aggregate.contribucion_perdida_M,
      instances_count: m.aggregate.instances_count,
      crecimiento_range: m.aggregate.crecimiento_range,
      top3_instances: m.instances.slice(0, 3),
    };
  }
  if (mechanismId === "customer_dependency_risk") {
    return {
      existe: true,
      mechanismId,
      top3_names: m.aggregate.top3_names,
      top3_participacion_pct: m.aggregate.top3_participacion_pct,
      top3_contribucion_M: m.aggregate.top3_contribucion_M,
      instances_count: m.aggregate.instances_count,
    };
  }
  // Default · mecanismo triggered pero shape no normalizado
  return {
    existe: true,
    mechanismId,
    instances_count: m.instances.length,
  };
}

// ── _getVentaPresupuestada · Q.A · presupuesto agregado (monolito L41510) ─────
function _getVentaPresupuestada(scenarioId) {
  try {
    const dataset = applyScenarioToClientesVentas(scenarioId);
    if (!Array.isArray(dataset) || dataset.length === 0) {
      return { available: false, fallback: 0, caveat: "Dataset de ventas no disponible." };
    }
    // Sum de presupuesto si campo existe en TODAS las filas
    const hasPresupuesto = dataset.every(c => typeof c.presupuesto === "number" && !isNaN(c.presupuesto));
    if (!hasPresupuesto) {
      const ventaActual = dataset.reduce((s, c) => s + (c.actual || 0), 0);
      return {
        available: false,
        fallback: Math.round(ventaActual),
        caveat: "Venta presupuestada no disponible · uso venta actual como proxy.",
      };
    }
    const total = dataset.reduce((s, c) => s + c.presupuesto, 0);
    return {
      available: true,
      value: Math.round(total),
      caveat: null,
    };
  } catch (err) {
    return { available: false, fallback: 0, caveat: "Error leyendo presupuesto · " + String(err?.message || err) };
  }
}

// ── crossDomainAggregator · función principal orquestador (monolito L41540) ───
// Invoca detectores helpers existentes y produce objeto context unificado.
// Reusa motor cognitivo completo · NO reimplementa signals.
function crossDomainAggregator(scenarioId) {
  // Datasets · cero touch a applyScenarioTo*
  const ventasDataset = applyScenarioToClientesVentas(scenarioId);
  const margenesDataset = applyScenarioToClientesMargen(scenarioId);
  const inventarioDataset = applyScenarioToSkuInventario(scenarioId);
  // Mechanism scan · cero touch a scanMechanisms
  const mechanisms = scanMechanisms(scenarioId);
  // Cross-signals · mapeo 1:1 mechanisms → BRIEF exterior shape
  // trapped_capital y liquidity_compression son STUBS en MECHANISM_REGISTRY ·
  // capital_leak usa _buildHiddenAngleCifras("sku_operational") para bypass.
  // Lección #L-MECHANISMS-REGISTRY-PUEDE-TENER-STUBS-AUDITAR-IMPLEMENTACION.
  const capitalLeakSig = _buildHiddenAngleCifras("sku_operational", scenarioId);
  const cross_signals = {
    margin_pressure: _extractFromMechanism(mechanisms, "commercial_erosion"),
    quality_of_growth: _extractFromMechanism(mechanisms, "quality_of_growth_deterioration"),
    customer_dependency: _extractFromMechanism(mechanisms, "customer_dependency_risk"),
    capital_leak: capitalLeakSig
      ? { existe: true, ...capitalLeakSig }
      : { existe: false },
  };
  // Cifras agregadas por dominio
  const ventas = _aggregateVentas(ventasDataset);
  const margenes = _aggregateMargenes(margenesDataset);
  const inventario = _aggregateInventario(inventarioDataset);
  return { scenarioId, ventas, margenes, inventario, cross_signals };
}

// ── executiveReportContext · función pública · entry point Q.D compositor ──
// Si flag OFF · retorna null (rollback granular bitwise pre-BETA).
function executiveReportContext(scenarioId) {
  if (!VOICE_EXECUTIVE_REPORT_ENGINE_ENABLED) return null;
  return {
    aggregator: crossDomainAggregator(scenarioId),
    presupuesto: _getVentaPresupuestada(scenarioId),
    timestamp: Date.now(),
  };
}

// Decay factor anual · D-Q.B-2 · 1.0 sostenido para MVP.
// Narrativa Q.D incluye caveat "asume cumplimiento sostenido 12 meses".
// Post-BETA: parametrizable con atenuación realista (0.85-0.95) si se justifica.
const VALORIZATION_DECAY_FACTOR = 1.0;

// COMPLIANCE_SCENARIOS · catálogo determinístico de 4 escenarios.
// Cada uno representa nivel de implementación + sostenimiento de las medidas
// renegociación de carga comercial recomendadas por composeExecutiveAction (N.B.1).
const COMPLIANCE_SCENARIOS = [
  { id: "compliance_100", pct: 1.00, label: "Implementación 100% sostenida" },
  { id: "compliance_75",  pct: 0.75, label: "Implementación parcial sostenida" },
  { id: "compliance_50",  pct: 0.50, label: "Iniciado pero deteriora" },
  { id: "compliance_25",  pct: 0.25, label: "Medidas anunciadas no ejecutadas" },
];

// ── _getVentaPresupuestadaStrict · guard extendido para Q.B (D-Q.B-4) ────
// Versión más estricta que Q.A _getVentaPresupuestada · agrega validaciones:
//   · valor > 0 (rechaza ceros)
//   · valor finite (rechaza Infinity)
//   · valor no negativo (presupuesto negativo es absurdo)
// Si CUALQUIER fila falla · cae a fallback con caveat completo.
// Cero touch a Q.A helper · este es independiente.
function _getVentaPresupuestadaStrict(scenarioId) {
  try {
    const dataset = applyScenarioToClientesVentas(scenarioId);
    if (!Array.isArray(dataset) || dataset.length === 0) {
      return { available: false, value: 0, caveat: "Dataset de ventas no disponible." };
    }
    // Guard máximo · D-Q.B-4 · null / undefined / NaN / no-number / ≤ 0 / no-finite / negativos
    const allValid = dataset.every(c => {
      const p = c.presupuesto;
      return p !== null && p !== undefined && typeof p === "number"
        && !isNaN(p) && isFinite(p) && p > 0;
    });
    if (!allValid) {
      const ventaActual = dataset.reduce((s, c) => s + (c.actual || 0), 0);
      return {
        available: false,
        value: Math.round(ventaActual),
        caveat: "Usando venta actual como proxy · presupuesto no disponible o incompleto en algunos clientes.",
      };
    }
    const total = dataset.reduce((s, c) => s + c.presupuesto, 0);
    return { available: true, value: Math.round(total), caveat: null };
  } catch (err) {
    return {
      available: false,
      value: 0,
      caveat: "Error leyendo presupuesto · " + String(err?.message || err),
    };
  }
}

// ── valorizationEngine · función principal Q.B ───────────────────────────
// Convierte recuperable mensual retrospectivo (scan.commercial_erosion) en
// proyección mensual + anual sobre 4 escenarios compliance.
//
// CONVENCIÓN UNIDADES (V5 firmado):
//   · Todo internamente en K (alineado con scan)
//   · scan.commercial_erosion.aggregate.recuperable_total_K es MENSUAL
//   · Anual = mensual × 12 × decay_factor
//   · Narrativa Q.D convierte a $/M via _fmtMoneyK (helper existente L9457)
//
// R-Q.B-3 · IMPORTANTE para Q.D compositor:
//   scan.commercial_erosion.aggregate.pct_of_total_sales (45.5% Bonanza) NO ES
//   "% recuperable sobre ventas". Es el % del volumen que las instances
//   detectadas representan. Si Q.D necesita "% recuperable sobre ventas" usar:
//     recuperable_K / aggregator.ventas.total
//   NO usar pct_of_total_sales del scan. Confusión semántica peligrosa.
function valorizationEngine(scenarioId) {
  if (!VOICE_VALORIZATION_FORWARD_LOOKING_ENABLED) return null;
  const scan = scanMechanisms(scenarioId);
  const presupuesto = _getVentaPresupuestadaStrict(scenarioId);
  const erosion = scan?.commercial_erosion;
  // Si commercial_erosion no triggered · no hay base para proyectar
  if (!erosion || !erosion.triggered || !erosion.aggregate) {
    return {
      available: false,
      scenarioId,
      reason: "commercial_erosion no triggered en escenario actual · sin base para proyección",
      presupuesto,
    };
  }
  const recuperable_mensual_K = erosion.aggregate.recuperable_total_K || 0;
  // recuperable_total_M_at_3_0 viene en M · convertir a K (× 1000)
  const recuperable_BP_mensual_K = Math.round((erosion.aggregate.recuperable_total_M_at_3_0 || 0) * 1000);
  if (recuperable_mensual_K === 0 && recuperable_BP_mensual_K === 0) {
    return {
      available: false,
      scenarioId,
      reason: "recuperable mensual = 0 · sin cifra base proyectable",
      presupuesto,
    };
  }
  // Proyección mensual · escenarios compliance
  const monthly = {
    base_target_3_5_K: recuperable_mensual_K,
    base_bestPractice_3_0_K: recuperable_BP_mensual_K,
    escenarios: {},
  };
  // Proyección anual · mensual × 12 × decay
  const yearly = {
    base_target_3_5_K: 0,
    base_bestPractice_3_0_K: 0,
    escenarios: {},
  };
  for (const sc of COMPLIANCE_SCENARIOS) {
    monthly.escenarios[sc.id] = {
      target_3_5_K: Math.round(recuperable_mensual_K * sc.pct),
      bestPractice_3_0_K: Math.round(recuperable_BP_mensual_K * sc.pct),
      pct: sc.pct,
      label: sc.label,
    };
    yearly.escenarios[sc.id] = {
      target_3_5_K: Math.round(recuperable_mensual_K * sc.pct * 12 * VALORIZATION_DECAY_FACTOR),
      bestPractice_3_0_K: Math.round(recuperable_BP_mensual_K * sc.pct * 12 * VALORIZATION_DECAY_FACTOR),
      pct: sc.pct,
      label: sc.label,
    };
  }
  yearly.base_target_3_5_K = yearly.escenarios.compliance_100.target_3_5_K;
  yearly.base_bestPractice_3_0_K = yearly.escenarios.compliance_100.bestPractice_3_0_K;
  return {
    available: true,
    scenarioId,
    presupuesto,
    monthly,
    yearly,
    decay_factor: VALORIZATION_DECAY_FACTOR,
    source: "scanMechanisms.commercial_erosion",
    instances_count: erosion.aggregate.instances_count,
    caveat_sustained: "Proyección asume cumplimiento sostenido 12 meses · decay 1.0",
    caveat_presupuesto: presupuesto.available ? null : presupuesto.caveat,
  };
}

// KPI_CATALOG · array extensible top-level con 9 KPIs.
// Cada KPI: { id, area, label, compute, target, target_direction, frequency, governance }
// compute(ctx, scenarioId) es función pura · lee de aggregator Q.A o helper Q.C.
// target numérico opcional · si null, KPI cualitativo (heurística por id).
const KPI_CATALOG = [
  // ── VENTAS · 3 KPIs ──────────────────────────────────────────────────
  {
    id: "contribucion_total",
    area: "ventas",
    label: "Contribución total del periodo",
    compute: (ctx, scenarioId) => _sumContribucion(scenarioId),
    unit: "K",
    target: null,
    target_direction: null,
    target_label: "creciente vs periodo anterior",
    frequency: "mensual",
    governance: "Comercial · Gerencia",
  },
  {
    id: "concentracion_tier1",
    area: "ventas",
    label: "Concentración Tier 1 (top 3 clientes)",
    compute: (ctx) => ctx?.ventas?.concentracionTier1,
    unit: "%",
    target: 50,
    target_direction: "lte",
    benchmark: 50,
    target_label: "diversificación ≤ 50% en top 3",
    frequency: "mensual",
    governance: "Comercial · Riesgo",
  },
  {
    id: "crecimiento_yoy_total",
    area: "ventas",
    label: "Crecimiento YoY del periodo",
    compute: (ctx) => ctx?.ventas?.crecimientoYoY,
    unit: "%",
    target: null,
    target_direction: null,
    target_label: "positivo y sostenido",
    frequency: "trimestral",
    governance: "Comercial · Pricing",
  },
  // ── MÁRGENES · 3 KPIs ────────────────────────────────────────────────
  {
    id: "carga_comercial_promedio",
    area: "margenes",
    label: "Carga comercial promedio",
    compute: (ctx) => ctx?.margenes?.cargaComercialPromedio,
    unit: "%",
    target: 3.5,
    target_direction: "lte",
    benchmark: 3.5,
    target_label: "≤ 3.5% (best practice 3.0%)",
    frequency: "mensual",
    governance: "Pricing · Comercial",
  },
  {
    id: "pct_cuentas_bajo_benchmark",
    area: "margenes",
    label: "% cuentas bajo benchmark de margen",
    compute: (ctx) => {
      if (!ctx?.margenes || !ctx.margenes.cuentasCount) return null;
      return (ctx.margenes.cuentasBajoBenchmark / ctx.margenes.cuentasCount) * 100;
    },
    unit: "%",
    target: 20,
    target_direction: "lte",
    benchmark: 20,
    target_label: "≤ 20% del portafolio",
    frequency: "mensual",
    governance: "Pricing · Comercial",
  },
  {
    id: "recuperable_disponible",
    area: "margenes",
    label: "Recuperable disponible al benchmark",
    compute: (ctx) => ctx?.margenes?.recuperableBenchmark,
    unit: "K",
    target: null,
    target_direction: null,
    target_label: "ejecutado vs pendiente",
    frequency: "mensual",
    governance: "Comercial · Finanzas",
  },
  // ── INVENTARIO · 3 KPIs ──────────────────────────────────────────────
  {
    id: "doh_promedio_portafolio",
    area: "inventario",
    label: "DOH promedio portafolio",
    compute: (ctx) => ctx?.inventario?.DOHPromedio,
    unit: "d",
    target: 60,
    target_direction: "lte",
    benchmark: 60,
    target_label: "≤ 60 días",
    frequency: "semanal",
    governance: "Operaciones · Compras",
  },
  {
    id: "capital_atrapado",
    area: "inventario",
    label: "Capital atrapado",
    // FIX #D-PANORAMA-CAPITAL-ESCALA-KPI-BIS · capitalAtrapado viene en USD crudo · unit:"K" hace que el
    // render lo trate como miles → "$55.80M". Escalar a K real (÷1000) → "$56K". off = el bug (byte-idéntico).
    compute: (ctx) => _capEscalaK(ctx?.inventario?.capitalAtrapado),
    unit: "K",
    target: null,
    target_direction: null,
    target_label: "decreciente trimestre a trimestre",
    frequency: "mensual",
    governance: "Operaciones · Finanzas",
  },
  {
    id: "skus_criticos_count",
    area: "inventario",
    label: "Cantidad de SKUs críticos",
    compute: (ctx) => ctx?.inventario?.skusCriticosCount,
    unit: "count",
    target: null,
    target_direction: null,
    target_label: "≤ 10% del portafolio",
    frequency: "mensual",
    governance: "Operaciones · Comercial",
  },
];

// ── _sumContribucion · helper Q.C · contribución total runtime ───────────
// D-Q.C-6 · helper para KPI contribucion_total. NO toca Q.A _aggregateVentas.
// Razón: deuda #D-Q-A-VENTAS-CUENTASEXPUESTAS-CONTRIBUCION-NAMING-AMBIGUO
// (cuentasExpuestas[].contribucion en Q.A es realmente cliente.actual · NO
// la cifra contribucion del dataset clientesMargen).
// Suma directa runtime: clientesMargen[].contribucion en K.
function _sumContribucion(scenarioId) {
  try {
    const dataset = applyScenarioToClientesMargen(scenarioId);
    if (!Array.isArray(dataset)) return null;
    return dataset.reduce((acc, c) => acc + (c.contribucion || 0), 0);
  } catch (err) {
    return null;
  }
}

// ── _computeKPIRelevance · heurística determinística relevancia (0-1) ────
// D-Q.C-2 · cutoff 0.05 aplicado en selector · acá solo cálculo.
// KPI con target numérico · gap normalizado (clamp a 1.0).
// KPI cualitativo · heurística por id (ej. crecimiento_yoy_total).
// Saludable (gap negativo · target cumplido) · retorna 0.1 (mantenimiento).
function _computeKPIRelevance(kpi, ctx, scenarioId) {
  if (!kpi || typeof kpi.compute !== "function") return 0;
  const value = kpi.compute(ctx, scenarioId);
  if (typeof value !== "number" || isNaN(value)) return 0;
  // Con target numérico · gap normalizado
  if (typeof kpi.target === "number" && kpi.target > 0) {
    const gap = kpi.target_direction === "lte"
      ? (value - kpi.target) / kpi.target  // exceso sobre target
      : (kpi.target - value) / kpi.target; // déficit bajo target
    if (gap <= 0) return 0.1; // saludable · mantenimiento
    return Math.min(1.0, gap);
  }
  // KPIs cualitativos · heurística por id
  if (kpi.id === "crecimiento_yoy_total") {
    return value < 0 ? Math.min(1.0, Math.abs(value) / 10) : 0.1;
  }
  // Baseline informativos (sin target numérico ni heurística específica)
  return 0.5;
}

// ── selectKPIsForReport · función pública · entry point Q.D ──────────────
// Selecciona top 2-3 KPIs por área según relevance descendente.
// D-Q.C-5 · `areas` opcional · null/undefined/[] = 3 áreas default.
// D-Q.C-2 · cutoff relevance < 0.05 · si TODOS saludables · retorna 2 mantenimiento.
// D-Q.C-4 · caveats declarados en array si KPI no calculable (value null/NaN).
function selectKPIsForReport(ctx, areas, scenarioId) {
  if (!VOICE_KPI_SELECTOR_ENABLED) return null;
  if (!ctx) {
    return { available: false, kpis: [], caveats: [{ caveat: "Context cero · no disponible." }] };
  }
  const targetAreas = Array.isArray(areas) && areas.length > 0
    ? areas.filter(a => a === "ventas" || a === "margenes" || a === "inventario")
    : ["ventas", "margenes", "inventario"];
  const result = { available: true, scenarioId: scenarioId || ctx.scenarioId, kpis: [], caveats: [] };
  const CUTOFF = 0.05;
  for (const area of targetAreas) {
    const areaKPIs = KPI_CATALOG.filter(k => k.area === area);
    const scored = [];
    for (const kpi of areaKPIs) {
      const value = typeof kpi.compute === "function" ? kpi.compute(ctx, scenarioId) : null;
      const isInvalid = value === null || value === undefined ||
        (typeof value === "number" && isNaN(value));
      if (isInvalid) {
        result.caveats.push({
          kpi_id: kpi.id,
          area: kpi.area,
          caveat: `${kpi.label} no calculable · field source ausente o inválido.`,
        });
        continue;
      }
      const relevance = _computeKPIRelevance(kpi, ctx, scenarioId);
      scored.push({
        id: kpi.id,
        area: kpi.area,
        label: kpi.label,
        value,
        unit: kpi.unit,
        target: kpi.target,
        target_direction: kpi.target_direction,
        target_label: kpi.target_label,
        frequency: kpi.frequency,
        governance: kpi.governance,
        relevance,
      });
    }
    scored.sort((a, b) => b.relevance - a.relevance);
    // Cutoff · si ≥ 2 KPIs sobre cutoff · seleccionar top 3
    // Si NO · todos saludables · retornar 2 para mantenimiento
    const aboveCutoff = scored.filter(k => k.relevance >= CUTOFF);
    const selected = aboveCutoff.length >= 2
      ? aboveCutoff.slice(0, 3)
      : scored.slice(0, 2);
    result.kpis.push(...selected);
  }
  return result;
}

// ── _composeCapitalSection · sección capital atrapado ────────────────────
// Severity calculo:
//   base = capital_atrapado_K / capital_total_K
//   mod  = DOH_promedio / 90 (90d umbral healthy)
//   severity = clamp(0, 1, (base + mod) / 2)
function _composeCapitalSection(ctx) {
  if (!ctx || !ctx.inventario) return null;
  const inv = ctx.inventario;
  // FIX #D-PANORAMA-CAPITAL-ESCALA-MIENTE · inv.capitalAtrapado/capitalTotal vienen en USD crudo. Los
  // campos _K deben estar en MILES (eso espera _fmtMoneyK en el render). OFF: USD crudo (el bug · 1000×).
  const _panoCapFixOn = (typeof ADI_PANORAMA_CAPITAL_ESCALA_FIX_ENABLED !== "undefined" && ADI_PANORAMA_CAPITAL_ESCALA_FIX_ENABLED);
  const capatrap_K = _panoCapFixOn ? ((inv.capitalAtrapado || 0) / 1000) : (inv.capitalAtrapado || 0);
  const captot_K = _panoCapFixOn ? ((inv.capitalTotal || 0) / 1000) : (inv.capitalTotal || 0);
  const pct = inv.capitalPctAtrapado || 0;
  const doh = inv.DOHPromedio || 0;
  const skus_count = inv.skusCriticosCount || 0;
  // FIX #D-PANORAMA-CAPITAL-ESCALA-MIENTE · agregar capital_K (en miles) a cada SKU del top-5, para que
  // el render use `s.capital_K` (escala correcta) en vez de caer a `s.capitalUSD` (USD crudo · 1000×).
  const skus_top5 = (inv.skusCriticos || []).slice(0, 5).map(s =>
    _panoCapFixOn ? { ...s, capital_K: (s.capitalUSD || 0) / 1000 } : s
  );
  // Severity 0-1 (base = ratio · invariante a la escala · el % sale igual)
  const base = captot_K > 0 ? capatrap_K / captot_K : 0;
  const mod = Math.min(1, doh / 90);
  const severity = Math.max(0, Math.min(1, (base + mod) / 2));
  // Reframe key · lookup defensivo en Día 3 sobre EXECUTIVE_REFRAMES.operational_inefficiency
  return {
    seccion: "capital_atrapado",
    evidencia: {
      capital_atrapado_K: capatrap_K,
      capital_total_K: captot_K,
      pct_portafolio: pct,
      DOH_promedio: doh,
      skus_criticos_count: skus_count,
      skus_top_5: skus_top5,
    },
    lectura: {
      causa: pct >= 50 ? "alta concentración de capital inmovilizado" :
             pct >= 30 ? "porción material del portafolio inmovilizada" :
             "capital atrapado controlable",
      reframe_key: "operational_inefficiency",
    },
    severity,
  };
}

// ── _composeMargenesSection · sección margenes problemáticos ─────────────
// CRÍTICO R-Q.D-3: usar valorization.monthly.base_target_3_5_K / ctx.ventas.total
// para "% recuperable sobre ventas". NO usar scan.pct_of_total_sales (que es
// % del volumen que las instances representan · semántica distinta).
//
// Severity calculo:
//   base = pct_recuperable_sobre_ventas (recuperable_K / ventas_total_K)
//   mod  = top_3_instances.length / 10
//   severity = clamp(0, 1, base + mod)
// Si margin_pressure no triggered · retorna null (razonador skip).
function _composeMargenesSection(ctx, valorization) {
  if (!ctx || !ctx.cross_signals || !ctx.cross_signals.margin_pressure) return null;
  const mp = ctx.cross_signals.margin_pressure;
  if (!mp.existe) return null;
  // R-Q.D-3 · fuente única scan precise
  const recuperable_mensual_K = valorization && valorization.available
    ? valorization.monthly.base_target_3_5_K
    : (mp.valor_recuperable_K || 0);
  const ventas_total_K = ctx.ventas && ctx.ventas.total ? ctx.ventas.total : 0;
  // R-Q.D-3 · NO usar mp.pct_of_total_sales · semánticamente distinto
  const pct_recuperable_sobre_ventas = ventas_total_K > 0
    ? recuperable_mensual_K / ventas_total_K
    : 0;
  const top3 = (mp.top3_instances || []).map(inst => ({
    cliente: inst.clientName,
    ventas_M: inst.ventas_M,
    contribucion_M: inst.contribucion_M,
    margen_pct: inst.margen_pct,
    carga_pct: inst.carga_pct,
    gap_vs_bench_pp: inst.gap_carga_pp,
    recuperable_at_target_3_5_K: inst.recuperable_at_target_3_5,
    severity_label: inst.severity,
  }));
  // Severity 0-1
  const base = Math.min(1, pct_recuperable_sobre_ventas);
  const mod = Math.min(1, top3.length / 10);
  const severity = Math.max(0, Math.min(1, base + mod));
  return {
    seccion: "margenes_problematicos",
    evidencia: {
      top_3_instances: top3,
      instances_count: mp.instances_count,
      recuperable_mensual_K,
      // FIX #D-RECUPERABLE-566-VS-701 · el techo total ($701K · toda la base con carga>3.5%) para la
      // cifra dual jerarquizada (foco $566K → techo). Solo etiqueta/relación · cero cálculo nuevo.
      recuperable_techo_K: (ctx.margenes && typeof ctx.margenes.recuperableBenchmark === "number")
        ? ctx.margenes.recuperableBenchmark : null,
      pct_recuperable_sobre_ventas: +(pct_recuperable_sobre_ventas * 100).toFixed(2),
    },
    lectura: {
      causa: "carga comercial sobre top contribuyentes desalineada con benchmark interno",
      reframe_key: "internal_commercial_load",
    },
    severity,
  };
}

// ── _composeValorizacionSection · sección proyección forward-looking ────
// Severity fijo 0.5 · siempre informativo · NO alarmante.
// Si valorization no available · retorna shape declarativo con caveats.
function _composeValorizacionSection(ctx, valorization) {
  if (!valorization) {
    return {
      seccion: "valorizacion",
      available: false,
      caveats: ["Motor de valorización no disponible · sin proyección forward-looking."],
      severity: 0.0,
    };
  }
  if (!valorization.available) {
    return {
      seccion: "valorizacion",
      available: false,
      reason: valorization.reason || "valorización no disponible",
      caveats: [valorization.reason || "valorización no disponible"],
      severity: 0.0,
    };
  }
  const caveats = [];
  if (valorization.caveat_sustained) caveats.push(valorization.caveat_sustained);
  if (valorization.caveat_presupuesto) caveats.push(valorization.caveat_presupuesto);
  return {
    seccion: "valorizacion",
    available: true,
    mensual: {
      base_target_3_5_K: valorization.monthly.base_target_3_5_K,
      base_bestPractice_3_0_K: valorization.monthly.base_bestPractice_3_0_K,
      escenarios: valorization.monthly.escenarios,
    },
    anual: {
      base_target_3_5_K: valorization.yearly.base_target_3_5_K,
      base_bestPractice_3_0_K: valorization.yearly.base_bestPractice_3_0_K,
      escenarios: valorization.yearly.escenarios,
    },
    decay_factor: valorization.decay_factor,
    instances_count: valorization.instances_count,
    caveats,
    severity: 0.5,
  };
}

// ── _composeKPIsSection · sección KPIs seguimiento ───────────────────────
// Status determinístico por relevance:
//   verde   si relevance < 0.3
//   amarillo si 0.3 ≤ relevance < 0.7
//   rojo    si relevance ≥ 0.7
// Severity de la sección = max severity de KPIs en alarma (rojo/amarillo).
function _composeKPIsSection(kpis_result) {
  if (!kpis_result || !kpis_result.available) {
    return {
      seccion: "kpis_seguimiento",
      available: false,
      caveats: kpis_result && kpis_result.caveats ? kpis_result.caveats : [],
      severity: 0.0,
    };
  }
  const by_area = { ventas: [], margenes: [], inventario: [] };
  let max_relevance = 0;
  for (const k of kpis_result.kpis) {
    const status = k.relevance >= 0.7 ? "rojo"
                 : k.relevance >= 0.3 ? "amarillo"
                 : "verde";
    if (k.relevance > max_relevance) max_relevance = k.relevance;
    const entry = {
      kpi_id: k.id,
      label: k.label,
      value: k.value,
      unit: k.unit,
      target: k.target,
      target_direction: k.target_direction,
      target_label: k.target_label,
      relevance: k.relevance,
      status,
      frequency: k.frequency,
      governance: k.governance,
    };
    if (by_area[k.area]) by_area[k.area].push(entry);
  }
  return {
    seccion: "kpis_seguimiento",
    available: true,
    by_area,
    caveats: kpis_result.caveats || [],
    severity: max_relevance,
  };
}

// EXECUTIVE_REPORT_REFRAMES · 1 reframe nuevo (D-Q.A-6 firmado)
const EXECUTIVE_REPORT_REFRAMES = {
  integrated_executive_closing:
    "Tres frentes simultáneos · cada uno con palanca distinta · cada uno con horizonte distinto. La intervención requiere disciplina · no heroísmo.",
};

// Variantes del reframe según número de frentes críticos (severity >= 0.5)
const INTEGRATED_CLOSING_VARIANTS = {
  one_front:
    "Un frente crítico · una palanca · un horizonte. La intervención es focal.",
  two_fronts:
    "Dos frentes simultáneos · palancas distintas · horizontes complementarios. La intervención requiere coordinación.",
  three_fronts:
    "Tres frentes simultáneos · cada uno con palanca distinta · cada uno con horizonte distinto. La intervención requiere disciplina · no heroísmo.",
};

// Tie-breaker order · usado por _reasonComposition para resolver empates severity
const Q_D_TIEBREAKER_ORDER = [
  "capital_atrapado",
  "margenes_problematicos",
  "customer_dependency",
  "quality_of_growth",
  "valorizacion",
  "kpis_seguimiento",
];

// Mapeo sección → áreas relevantes · para filtrado options.areas
const Q_D_SECTION_AREA_MAP = {
  capital_atrapado: ["inventario"],
  margenes_problematicos: ["margenes", "ventas"],
  valorizacion: ["margenes", "ventas"],
  kpis_seguimiento: ["ventas", "margenes", "inventario"], // siempre incluido si areas no-vacío
};

// ── _sectionMatchesAreas · helper privado de filtrado por áreas ──────────
function _sectionMatchesAreas(section, areas) {
  if (!section || !Array.isArray(areas)) return false;
  const sectionAreas = Q_D_SECTION_AREA_MAP[section.seccion] || [];
  return areas.some(a => sectionAreas.includes(a));
}

// ── _reasonComposition · razonador composición (D-Q.D-3) ─────────────────
// FASE 1 · Invoca 4 compositores sección (cada uno retorna null o shape)
// FASE 2 · Filtra por options.areas (opcional · null = todas)
// FASE 3 · Ordena severity desc + tie-breaker fijo (empate → orden catálogo)
// FASE 4 · Subsecciones customer_dependency/quality_of_growth integradas
//          en cierre (post-MVP upgrade a sección si severity > 0.8)
function _reasonComposition(ctx, valorization, kpis_result, options) {
  if (!ctx) return [];
  options = options || {};
  // FASE 1 · candidatos
  const candidates = [];
  const capitalSection = _composeCapitalSection(ctx);
  if (capitalSection) candidates.push(capitalSection);
  const margenesSection = _composeMargenesSection(ctx, valorization);
  if (margenesSection) candidates.push(margenesSection); // null si margin_pressure.existe === false
  const valorizSection = _composeValorizacionSection(ctx, valorization);
  if (valorizSection) candidates.push(valorizSection);
  const kpisSection = _composeKPIsSection(kpis_result);
  if (kpisSection) candidates.push(kpisSection);
  // FASE 2 · filtrado por áreas (Q8 V_VISUAL final)
  let filtered = candidates;
  if (Array.isArray(options.areas) && options.areas.length > 0) {
    filtered = candidates.filter(s => _sectionMatchesAreas(s, options.areas));
  }
  // FASE 3 · ordenamiento severity desc + tie-breaker
  filtered.sort((a, b) => {
    if (Math.abs(b.severity - a.severity) > 0.01) {
      return b.severity - a.severity;
    }
    const idxA = Q_D_TIEBREAKER_ORDER.indexOf(a.seccion);
    const idxB = Q_D_TIEBREAKER_ORDER.indexOf(b.seccion);
    return idxA - idxB;
  });
  // FIX-ORDER · KPIs SIEMPRE último · Valorización penúltima
  // Razón: KPIs son tracking ongoing · no compiten por urgencia narrativa
  // (severity 1.0 los pondría primero, rompiendo arquitectura ejecutiva).
  // Valorización es decisión cuantificada · sigue diagnóstico.
  // Orden ejecutivo: intro → diagnóstico (capital/margenes) → decisión (valoriz)
  //                  → seguimiento (KPIs) → cierre integrado.
  // Founder firmado · "esto es consultor ejecutivo, no BI dashboard".
  const fix_kpisIndex = filtered.findIndex(s => s.seccion === "kpis_seguimiento");
  const fix_kpisSection = fix_kpisIndex >= 0 ? filtered.splice(fix_kpisIndex, 1)[0] : null;
  // Re-buscar valoriz · índice puede haber cambiado tras splice anterior
  const fix_valorizIndex = filtered.findIndex(s => s.seccion === "valorizacion");
  const fix_valorizSection = fix_valorizIndex >= 0 ? filtered.splice(fix_valorizIndex, 1)[0] : null;
  // Push en orden: valorización primero, KPIs último
  if (fix_valorizSection) filtered.push(fix_valorizSection);
  if (fix_kpisSection) filtered.push(fix_kpisSection);
  return filtered;
}

// ── _composeIntegratedClosing · cierre integrado con variant + dimensiones ─
// Variant según número de frentes críticos (severity >= 0.5 · excluye
// valorizacion y kpis_seguimiento que siempre son informativos).
// Dimensiones contextuales · lookup defensivo a EXECUTIVE_REFRAMES (LOCKED).
function _composeIntegratedClosing(secciones, ctx) {
  if (!Array.isArray(secciones) || secciones.length === 0) {
    return {
      variant_key: null,
      variant_text: "",
      dimensiones: [],
      frentes_criticos_count: 0,
    };
  }
  // FIX-VARIANT-OPCION-E · variant por SEVERITY MÁXIMA cross-sección.
  // Lección #L-VARIANT-VARIANCE-VERIFIED-RUNTIME-ANTES-DE-FIRMAR.
  // Razón: opciones A/B/C/D (umbral 0.3 · contar cross_signals · severity log
  // absoluto · status quo) NO discriminan runtime real (audit Día 3 verificó
  // que margenes severity 0.31-0.33 < 0.5 en 3 escenarios · NUNCA suma frente).
  // Solo capital severity tiene spread real (0.55 → 0.78 cross-escenario)
  // y mapear max severity directo a variant produce 2 variants distintas:
  //   Bonanza/Tensión max ≈ 0.55-0.60 → one_front
  //   Crisis max ≈ 0.78              → two_fronts (discrimina)
  //   Aspirational: max ≥ 0.85       → three_fronts (escenarios de crisis estructural)
  // Mapeo determinístico:
  //   maxSev < 0.5         → null
  //   0.5 ≤ maxSev < 0.7   → one_front
  //   0.7 ≤ maxSev < 0.85  → two_fronts
  //   maxSev ≥ 0.85        → three_fronts
  const seccionesCriticas = secciones.filter(s =>
    s.seccion !== "valorizacion" && s.seccion !== "kpis_seguimiento"
  );
  const maxSev = seccionesCriticas.length > 0
    ? Math.max(...seccionesCriticas.map(s => s.severity || 0))
    : 0;
  let variant_key;
  if (maxSev >= 0.85)      variant_key = "three_fronts";
  else if (maxSev >= 0.7)  variant_key = "two_fronts";
  else if (maxSev >= 0.5)  variant_key = "one_front";
  else                     variant_key = null;
  // n_frentes_criticos preservado como métrica separada (D14.8) · útil para
  // narrativa Día 4 · NO usado para mapeo de variant_key (eso es maxSev).
  const frentes_criticos = seccionesCriticas.filter(s => (s.severity || 0) >= 0.5);
  const n_frentes = frentes_criticos.length;
  // Lookup defensivo (R-Q.D-2)
  const variant_text = variant_key
    ? (INTEGRATED_CLOSING_VARIANTS[variant_key]
        || EXECUTIVE_REPORT_REFRAMES.integrated_executive_closing
        || "")
    : "";
  // Dimensiones contextuales · reusan EXECUTIVE_REFRAMES (LOCKED) vía lookup
  // defensivo. Si EXECUTIVE_REFRAMES cambia en futuro · Q.D no crashea.
  const dimensiones = [];
  const cs = ctx && ctx.cross_signals;
  if (cs && cs.customer_dependency && cs.customer_dependency.existe) {
    const reframe = (typeof EXECUTIVE_REFRAMES !== "undefined"
      && EXECUTIVE_REFRAMES.structural_dependency) || "";
    if (reframe) dimensiones.push({
      key: "customer_dependency",
      reframe_key_source: "structural_dependency",
      text: reframe,
    });
  }
  if (cs && cs.quality_of_growth && cs.quality_of_growth.existe) {
    const reframe = (typeof EXECUTIVE_REFRAMES !== "undefined"
      && EXECUTIVE_REFRAMES.hidden_blind_spot) || "";
    if (reframe) dimensiones.push({
      key: "quality_of_growth",
      reframe_key_source: "hidden_blind_spot",
      text: reframe,
    });
  }
  return {
    variant_key,
    variant_text,
    dimensiones,
    frentes_criticos_count: n_frentes,
  };
}

// ── _composeReportIntro · intro determinística contextual ────────────────
function _composeReportIntro(scenarioId, secciones, ctx) {
  const n_secciones = Array.isArray(secciones) ? secciones.length : 0;
  const escenario_label = scenarioId === "bonanza" ? "favorable"
                        : scenarioId === "tension" ? "de tensión"
                        : scenarioId === "crisis" ? "crítico"
                        : "actual";
  return `Resumen ejecutivo · escenario ${escenario_label}. ${n_secciones} frentes para mirar.`;
}

// ── composeExecutiveReport · función pública principal Q.D ───────────────
// Entry point · invoca aggregator (Q.A) + valorization (Q.B) + selector (Q.C)
// + razonador + cierre + intro · retorna shape estructurado completo.
// Flag rollback granular · si OFF retorna null.
export function composeExecutiveReport(scenarioId, options) {
  if (!VOICE_EXECUTIVE_REPORT_COMPOSER_ENABLED) return null;
  if (!scenarioId || typeof scenarioId !== "string") return null;
  options = options || {};
  // FASE 1 · context cross-domain (Q.A)
  const reportContext = executiveReportContext(scenarioId);
  if (!reportContext) return null;
  const ctx = reportContext.aggregator;
  if (!ctx) return null;
  // FASE 2 · valorization (Q.B)
  const valorization = valorizationEngine(scenarioId);
  // FASE 3 · KPIs (Q.C) · respeta options.areas
  const kpis_result = selectKPIsForReport(ctx, options.areas, scenarioId);
  // FASE 4 · razonador composición
  const secciones = _reasonComposition(ctx, valorization, kpis_result, options);
  // FASE 5 · cierre integrado
  const cierre = _composeIntegratedClosing(secciones, ctx);
  // FASE 6 · intro
  const intro = _composeReportIntro(scenarioId, secciones, ctx);
  return {
    available: true,
    scenarioId,
    intro,
    secciones,
    cierre_integrado: cierre,
    meta: {
      scenarioId,
      timestamp: Date.now(),
      areas_filtradas: options.areas || null,
      n_secciones: secciones.length,
      n_frentes_criticos: cierre.frentes_criticos_count,
      valorization_available: valorization ? valorization.available : false,
      kpis_available: kpis_result ? kpis_result.available : false,
    },
  };
}

// ── _renderCapitalText · sección capital atrapado ────────────────────────
// Pattern voz: [evidencia cifra] · [lectura top SKUs] · [foco palanca] · [reframe]
function _renderCapitalText(section) {
  if (!section || !section.evidencia) return "";
  const ev = section.evidencia;
  const reframe = (typeof EXECUTIVE_REFRAMES !== "undefined"
    && EXECUTIVE_REFRAMES.operational_inefficiency) || "";
  const evidence = `Capital atrapado · ${_fmtMoneyK(ev.capital_atrapado_K)} en ${ev.skus_criticos_count} SKUs críticos · ${ev.pct_portafolio.toFixed(1)}% del portafolio · DOH promedio ${ev.DOH_promedio} días.`;
  // Top 3 SKUs (capital absoluto) · estructura compacta line-by-line
  const top_skus_lines = (ev.skus_top_5 || [])
    .slice(0, 3)
    .map(s => {
      // s shape: { sku, capitalUSD, DOH, ... } · marca opcional
      const cap_k = typeof s.capital_K === "number" ? s.capital_K : s.capitalUSD;
      const doh = typeof s.DOH === "number" ? s.DOH : s.doh;
      const marca = s.marca ? ` (${s.marca})` : "";
      return `· ${s.sku}${marca} · ${_fmtMoneyK(cap_k)} · DOH ${doh}d`;
    })
    .join("\n");
  const lectura = top_skus_lines
    ? `Los 3 SKUs con más capital detenido:\n${top_skus_lines}`
    : "";
  const foco = `El stock no rota a la velocidad que el negocio necesita. Liberar capital permite reinvertir en SKUs rotacionales del portafolio.`;
  const parts = [`**Capital inmovilizado**`, evidence];
  if (lectura) parts.push(lectura);
  parts.push(foco);
  if (reframe) parts.push(reframe);
  return parts.join("\n\n");
}

// ── _renderMargenesText · sección márgenes problemáticos ─────────────────
// R-Q.D-3 crítico: cita pct_recuperable_sobre_ventas (cifra real) · NO scan.pct_of_total_sales
function _renderMargenesText(section) {
  if (!section || !section.evidencia) return "";
  const ev = section.evidencia;
  const reframe = (typeof EXECUTIVE_REFRAMES !== "undefined"
    && EXECUTIVE_REFRAMES.internal_commercial_load) || "";
  // R-Q.D-3 · pct_recuperable_sobre_ventas ya está en % (× 100 en compositor Día 2)
  // NO multiplicar nuevamente. Mostrar con 2 decimales.
  const pct_real = typeof ev.pct_recuperable_sobre_ventas === "number"
    ? ev.pct_recuperable_sobre_ventas
    : 0;
  const evidence = `Margen comprimido · ${_fmtMoneyK(ev.recuperable_mensual_K)} mensual recuperable · ${pct_real.toFixed(2)}% sobre ventas totales.`;
  // FIX #D-RECUPERABLE-566-VS-701 · cifra dual jerarquizada (la redacción del founder · Opción B):
  // foco ejecutivo ($566K · top-3 con margen comprimido) + techo total ($701K · toda la base con carga
  // sobre benchmark), con la relación explicada. Solo si el techo es mayor que el foco (si no, no aporta).
  const _recDualOn = (typeof ADI_RECUPERABLE_DUAL_ENABLED !== "undefined" && ADI_RECUPERABLE_DUAL_ENABLED);
  const _dualLine = (_recDualOn
    && typeof ev.recuperable_techo_K === "number"
    && typeof ev.recuperable_mensual_K === "number"
    && ev.recuperable_techo_K > ev.recuperable_mensual_K)
    ? `Recuperable mensual foco: ${_fmtMoneyK(ev.recuperable_mensual_K)} en el top-3 de cuentas con margen comprimido. Si se considera toda la base con carga sobre benchmark, el potencial total sube a ${_fmtMoneyK(ev.recuperable_techo_K)}.`
    : "";
  // Top 3 instances · cliente + margen + carga + gap_pp
  const top3_lines = (ev.top_3_instances || [])
    .map(c => {
      const margen = typeof c.margen_pct === "number" ? c.margen_pct.toFixed(1) : "n/d";
      const carga = typeof c.carga_pct === "number" ? c.carga_pct.toFixed(1) : "n/d";
      const gap = typeof c.gap_vs_bench_pp === "number" ? c.gap_vs_bench_pp.toFixed(1) : "n/d";
      return `· ${c.cliente} · margen ${margen}% · carga ${carga}% · gap ${gap} puntos`;
    })
    .join("\n");
  const lectura = top3_lines
    ? `Top 3 cuentas con mayor presión sobre margen:\n${top3_lines}`
    : "";
  const foco = `La carga comercial sostenida sobre cuentas Tier 1 es la palanca más directa. Negociar al benchmark interno (3.5%) recupera mensualmente sin afectar volumen.`;
  const parts = [`**Márgenes problemáticos**`, evidence];
  if (_dualLine) parts.push(_dualLine);
  if (lectura) parts.push(lectura);
  parts.push(foco);
  if (reframe) parts.push(reframe);
  return parts.join("\n\n");
}

// ── _renderValorizText · sección proyección forward-looking ──────────────
function _renderValorizText(section) {
  if (!section) return "";
  if (!section.available) {
    // Sección declarativa · solo caveats
    const reason = section.reason || (section.caveats && section.caveats[0]) || "valorización no disponible";
    return `**Valorización**\n\nProyección no disponible · ${reason}`;
  }
  const mensual = section.mensual;
  const anual = section.anual;
  if (!mensual || !anual) return "";
  const evidence = `Recuperable proyectado al benchmark interno (3.5%):\n· Mensual base: ${_fmtMoneyK(mensual.base_target_3_5_K)}\n· Anual sostenido (compliance 100%): ${_fmtMoneyK(anual.escenarios.compliance_100.target_3_5_K)}`;
  const esc = anual.escenarios;
  const escenarios_text = `Sensibilidad por cumplimiento sostenido:\n`
    + `· 100% · ${_fmtMoneyK(esc.compliance_100.target_3_5_K)} anuales\n`
    + `· 75% · ${_fmtMoneyK(esc.compliance_75.target_3_5_K)} anuales\n`
    + `· 50% · ${_fmtMoneyK(esc.compliance_50.target_3_5_K)} anuales\n`
    + `· 25% · ${_fmtMoneyK(esc.compliance_25.target_3_5_K)} anuales`;
  const upgrade = `Si bajás carga a mejor práctica (3.0%) sostenida 100% · son ${_fmtMoneyK(esc.compliance_100.bestPractice_3_0_K)} anuales adicionales.`;
  const caveats_text = (section.caveats && section.caveats.length > 0)
    ? `_${section.caveats.join(" · ")}_`
    : "";
  const parts = [`**Valorización**`, evidence, escenarios_text, upgrade];
  if (caveats_text) parts.push(caveats_text);
  return parts.join("\n\n");
}

// ── _renderKPIsText · sección KPIs seguimiento · agrupado por área ───────
function _renderKPIsText(section) {
  if (!section) return "";
  if (!section.available) {
    const caveat = (section.caveats && section.caveats[0])
      ? (typeof section.caveats[0] === "string" ? section.caveats[0] : section.caveats[0].caveat)
      : "KPIs no disponibles";
    return `**KPIs de seguimiento**\n\n${caveat}`;
  }
  const by_area = section.by_area || {};
  const AREA_LABELS = { ventas: "Ventas", margenes: "Márgenes", inventario: "Inventario" };
  const areas_text = ["ventas", "margenes", "inventario"]
    .filter(a => Array.isArray(by_area[a]) && by_area[a].length > 0)
    .map(area => {
      const area_label = AREA_LABELS[area];
      const kpis_lines = by_area[area].map(k => {
        const status_emoji = k.status === "rojo" ? "🔴"
                           : k.status === "amarillo" ? "🟡"
                           : "🟢";
        // FIX-RENDER · uniformizar moneda · _fmtMoneyK cuando unit === "K"
        // Razón: Bonanza renderizaba 701.0 sin unidad · Crisis $2.36M con formato.
        // Coherencia visual cross-escenario. DOH sin decimal (siempre integer).
        let value_text;
        if (typeof k.value !== "number") {
          value_text = "n/d";
        } else if (k.unit === "K") {
          value_text = _fmtMoneyK(k.value);
        } else if (k.unit === "%") {
          value_text = k.value.toFixed(1) + "%";
        } else if (k.unit === "d") {
          value_text = Math.round(k.value) + "d";
        } else if (k.unit === "count") {
          value_text = Math.round(k.value).toString();
        } else {
          value_text = k.value.toFixed(1);
        }
        // unit_suffix vacío · ahora value_text ya incluye unidad cuando aplica
        return `${status_emoji} ${k.label} · ${value_text} · seguimiento ${k.frequency} · ${k.governance}`;
      }).join("\n");
      return `*${area_label}*\n${kpis_lines}`;
    })
    .join("\n\n");
  const caveats = (section.caveats || []).map(c => typeof c === "string" ? c : (c.caveat || ""));
  const caveats_text = caveats.length > 0 ? `_${caveats.filter(c => c).join(" · ")}_` : "";
  const parts = [`**KPIs de seguimiento**`];
  if (areas_text) parts.push(areas_text);
  if (caveats_text) parts.push(caveats_text);
  return parts.join("\n\n");
}

// ── _renderClosing · cierre integrado · variant + dimensiones ────────────
// dimensiones[i] = { key, reframe_key_source, text } · usar d.text (NO d directo)
function _renderClosing(cierre, secciones) {
  if (!cierre || !cierre.variant_text) return "";
  const variant = cierre.variant_text;
  const dimensiones = Array.isArray(cierre.dimensiones) ? cierre.dimensiones : [];
  const parts = [`**Cierre integrado**`, variant];
  for (const d of dimensiones) {
    const text = typeof d === "string" ? d : (d && d.text) || "";
    if (text) parts.push(`_${text}_`);
  }
  return parts.join("\n\n");
}

// ── _renderSection · dispatcher por section.seccion ──────────────────────
function _renderSection(section, scenarioId) {
  if (!section) return "";
  switch (section.seccion) {
    case "capital_atrapado":         return _renderCapitalText(section);
    case "margenes_problematicos":   return _renderMargenesText(section);
    case "valorizacion":             return _renderValorizText(section);
    case "kpis_seguimiento":         return _renderKPIsText(section);
    default:                         return "";
  }
}

// ── composeExecutiveReportNarrative · función pública narrativa text ─────
// Recibe shape estructurado de composeExecutiveReport · retorna shape compatible
// con pipeline B dispatch (opener + suggestions + sentrixAction + reasoningPattern
// + narrative_signals). Día 5 conecta pipeline B.
export function composeExecutiveReportNarrative(report) {
  if (!report || !report.available) return null;
  const sections_text = (report.secciones || [])
    .map(s => _renderSection(s, report.scenarioId))
    .filter(t => typeof t === "string" && t.length > 0);
  const closing_text = _renderClosing(report.cierre_integrado, report.secciones);
  const parts = [];
  if (report.intro) parts.push(report.intro);
  for (const t of sections_text) parts.push(t);
  if (closing_text) parts.push(closing_text);
  const opener = parts.join("\n\n");
  return {
    opener,
    suggestions: [], // D-Q.D-5 firmado · NO suggestions MVP
    sentrixAction: null,
    reasoningPattern: "executive_report",
    narrative_signals: {
      kind: "executive_report",
      scenario: report.scenarioId,
      n_secciones: Array.isArray(report.secciones) ? report.secciones.length : 0,
      n_frentes_criticos: report.cierre_integrado
        ? report.cierre_integrado.frentes_criticos_count : 0,
      variant_key: report.cierre_integrado
        ? report.cierre_integrado.variant_key : null,
    },
  };
}
