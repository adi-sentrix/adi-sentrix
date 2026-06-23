import { skuInventario } from "../../data/demoData.js";
import {
  applyScenarioToClientesMargen,
  applyScenarioToClientesVentas,
} from "../../engine/scenarios.js";
import { filterTextualSuggestions } from "../helpers.js";
import { composeMechanismResponse, composeMechanismScan } from "./mechanisms.js";
import { composeSentrixAction } from "./clientDive.js";
import { composeBusinessThesisOpener } from "./thesis.js";
import { _capitalInmovilizado } from "./warehouse.js";
import { ADI_CAPITAL_DEF_CANONICA_ENABLED } from "../../config/voiceFlags.js";

// Sub-composers de otros archetypes · aún no extraídos (no se invocan para fuga_distribuida).
const composeMechanismRanking = () => { throw new Error("composeMechanismRanking no extraído"); };
// NOTA · composePriorityRecommendationV2 SÍ existe en el monolito (L4361-4434) y se copia
// verbatim más abajo · NO se stubea (a diferencia de scan/ranking) porque tiene cuerpo real.

// ═══════════════════════════════════════════════════════
// BRIEF #14 · R5 Evidence Gate
//
// Valida si la combinación de dominios solicitada tiene
// evidencia suficiente para generar M3 (conexión causal).
// Si retorna { valid: false }, M3 debe emitir frase de honestidad.
// ═══════════════════════════════════════════════════════

function validateM3Evidence(archetype, domainsDetected, scenarioId) {
  const margenes = applyScenarioToClientesMargen(scenarioId);

  const ARCHETYPE_TO_CLAUSE = {
    fuga_distribuida: {
      clauses: ["§4.2.2", "§4.2.5"],
      mechanism: "commercial_erosion + liquidity_compression",
      source: "B+C",
    },
    calidad_crecimiento: {
      clauses: ["§4.2.1"],
      mechanism: "quality_of_growth_deterioration",
      source: "B+C",
    },
    exposure_analysis: {
      clauses: ["§4.2.4"],
      mechanism: "customer_dependency_risk",
      source: "B+C",
    },
    trapped_capital: {
      clauses: ["§4.2.3"],
      mechanism: "trapped_capital",
      source: "B+C",
    },
    priority_recommendation: {
      clauses: ["§7.5"],
      mechanism: "driver_ranking",
      source: "D",
    },
  };

  // Special case: trapped_capital requires inventory drilldown which the
  // current dataset does not provide. R5 fails → honesty fallback.
  if (archetype === "trapped_capital") {
    return {
      valid: false,
      reason: "inventory_drilldown_required",
      missing: "drilldown por categoría de inventario con datos de rotación específicos",
    };
  }

  if (archetype && ARCHETYPE_TO_CLAUSE[archetype]) {
    const clause = ARCHETYPE_TO_CLAUSE[archetype];
    return {
      valid: true,
      source: clause.source,
      mechanism: clause.mechanism,
      clauses: clause.clauses,
    };
  }

  // Generic multi-domain path · check observable evidence
  if (domainsDetected.length >= 2) {
    if (domainsDetected.includes("margenes") && domainsDetected.includes("ventas")) {
      const tier1WithPressure = margenes.filter(c =>
        c.margen < 30.1 && c.pctRebate > 3.0
      );
      if (tier1WithPressure.length > 0) {
        return {
          valid: true,
          source: "C",
          mechanism: "commercial_erosion_observable",
          clauses: ["§4.2.2"],
          evidence_count: tier1WithPressure.length,
        };
      }
    }

    if (domainsDetected.includes("margenes") && domainsDetected.includes("inventario")) {
      return {
        valid: false,
        reason: "inventory_drilldown_required",
        missing: "drilldown por categoría de inventario",
      };
    }

    if (domainsDetected.includes("ventas") && domainsDetected.includes("inventario")) {
      return {
        valid: false,
        reason: "inventory_drilldown_required",
        missing: "drilldown por categoría de inventario",
      };
    }
  }

  return {
    valid: false,
    reason: "no_evidence_found",
    missing: "información adicional para confirmar causalidad",
  };
}

// ═══════════════════════════════════════════════════════
// BRIEF #14 · Cross-Domain Response Composer
//
// Genera respuesta de 4 movimientos invariantes:
//   M1 · Dónde está el problema (materialidad + cifras)
//   M2 · Cómo opera (función económica)
//   M3 · Cómo se conectan (R5 evidence gate aplica)
//   M4 · Qué priorizar (UNA palanca + justificación)
// ═══════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// BRIEF #12 (post-46-bis) · NARRATIVE REFACTOR PILOT · priority_recommendation
//
// Función nueva especializada que construye los 6 bloques narrativos del
// target del founder con cifras runtime (KPI getters · cero hardcode).
//
// Pipeline:
//   composer V2 → opener (bloques 2-6) → ETLG prepend (bloque 1 thesis) →
//   RCE → Voice Contract → Premise APPLY → setters
//
// Bloque 1 (THESIS) NO se incluye aquí · ETLG (#10) lo prepend en pipeline.
// Bloques 2-6 se concatenan con "\n\n" como opener.
// ════════════════════════════════════════════════════════════════════════════
function composePriorityRecommendationV2(scenarioId) {
  const margenes = applyScenarioToClientesMargen(scenarioId);
  const ventas = applyScenarioToClientesVentas(scenarioId);
  const benchmark = 30.1;
  const bestPractice = 3.0;
  const target_carga = 3.5;

  // Cliente prioritario: Falabella · fall-back defensivo si no está en escenario.
  let cliente_m = margenes.find(c => c.nombre === "Falabella");
  let cliente_v = ventas.find(c => c.nombre === "Falabella");
  if (!cliente_m) {
    const tier1Pressure = margenes
      .filter(c => c.margen < benchmark && c.pctRebate > target_carga)
      .sort((a, b) => b.contribucion - a.contribucion);
    cliente_m = tier1Pressure[0];
    cliente_v = cliente_m ? ventas.find(c => c.nombre === cliente_m.nombre) : null;
  }
  // Total fallback: cero cliente Tier 1 con presión en escenario.
  if (!cliente_m || !cliente_v) {
    return {
      opener: "El detalle de priorización requiere identificación de la cuenta con mayor peso económico en el escenario activo.\n\n*Confianza media · lectura estructural · requiere drilldown por cliente.*",
      // BRIEF N-bis · Tipo A puro · suggestions filtradas
      suggestions: filterTextualSuggestions(["Ver por cuenta", "Ver capital detenido por categoría", "Comparar Tier 1"]),
      sentrixAction: null,
    };
  }

  // Cifras runtime (cero hardcode · todas del dataset).
  const cliente_nombre  = cliente_m.nombre;
  const venta_M         = (cliente_v.actual / 1000).toFixed(1);          // 19.4
  const contrib_M       = (cliente_m.contribucion / 1000).toFixed(2);     // 4.07 (dataset · NO 4.27 BRIEF)
  const margen_pct      = cliente_m.margen;                               // 22
  const carga_actual    = cliente_m.pctRebate;                            // 4.5
  const gap_pp          = (carga_actual - bestPractice).toFixed(1);       // 1.5
  // Recuperación bajar 1pp · misma fórmula que generateSimulation memClient
  // (clientesVentas.actual · NO clientesMargen.venta) · coherencia T1/T2 caso founder.
  const recuperable     = Math.round(((carga_actual - target_carga) / 100) * cliente_v.actual);

  // ── BLOQUE 2 · POR DÓNDE PARTIRÍA (BRIEF #15 Executive V1 LOCKED) ─────
  const b2 = `Partiría por ${cliente_nombre} · bajar carga de ${carga_actual.toFixed(1)}% a ${target_carga.toFixed(1)}% recupera aproximadamente $${recuperable}K anuales.`;

  // ── BLOQUE 3 · EVIDENCIA (cifras concatenadas · Executive V1) ─────────
  const b3 = `Ventas $${venta_M}M · Contribución $${contrib_M}M · Margen ${margen_pct}% · ${(benchmark - margen_pct).toFixed(1)}pp bajo benchmark · Carga ${gap_pp}pp sobre referencia.`;

  // ── BLOQUE 4 · QUÉ LO EXPLICA (observable · Executive V1) ─────────────
  // BRIEF MICRO 1 (#D-EXEC-15-3 fix) · V1 LOCKED · evita duplicación con B1 ETLG.
  // B1 ETLG ya dice "el crecimiento no se está convirtiendo..." · B4 ahora
  // identifica el mecanismo y la velocidad de la palanca priorizada.
  const b4 = `La carga comercial sobre Tier 1 es donde más se pierde captura · es lo más rápido de mover.`;

  // ── BLOQUE 5 · QUÉ HARÍA (D2 LOCKED · paralelismo verbal "Negociaría... revisaría") ─
  const b5 = `Negociaría primero la carga comercial de ${cliente_nombre} · luego revisaría inventario · finalmente canal digital.`;

  // ── BLOQUE 6 · CONFIANZA (compacto · Executive V1) ────────────────────
  const b6 = `*Confianza alta · cifras runtime sobre escenario activo.*`;

  const _teaser = composeBusinessThesisOpener(scenarioId) || `Si este mes solo pudieras mover una pieza, empezaría por esta.`;
  const opener = [_teaser, b2, b3, b4, b5, b6].join("\n\n");

  // Suggestions ajustadas (D3 · voz controller).
  const suggestions = [
    `Ver ${cliente_nombre} en detalle`,
    "¿Qué pasa si bajo carga 1pp?",
    "Ver capital detenido por categoría",
  ];

  // SentrixAction · mismo patrón legacy.
  const sentrixAction = composeSentrixAction("priority_recommendation", {
    primaryClient: cliente_nombre,
  });

  // BRIEF N-bis · Tipo A puro · suggestions filtradas en return
  return { opener, suggestions: filterTextualSuggestions(suggestions), sentrixAction };
}

export function composeCrossDomainResponse(detection, scenarioId) {
  const archetype = detection.archetype;
  const domains = detection.domainsDetected;

  // BRIEF #15 · Mechanism-first dispatch (highest priority)
  if (archetype === "mechanism_commercial_erosion") {
    return composeMechanismResponse("commercial_erosion", scenarioId);
  }
  if (archetype === "mechanism_quality_growth") {
    return composeMechanismResponse("quality_of_growth_deterioration", scenarioId);
  }
  if (archetype === "mechanism_dependency_risk") {
    return composeMechanismResponse("customer_dependency_risk", scenarioId);
  }
  if (archetype === "mechanism_scan") {
    return composeMechanismScan(scenarioId);
  }
  if (archetype === "mechanism_ranking") {
    return composeMechanismRanking(scenarioId);
  }

  // ════════════════════════════════════════════════════════════════════════
  // BRIEF #12 (post-46-bis) · NARRATIVE REFACTOR PILOT · Estrategia C
  // priority_recommendation usa composePriorityRecommendationV2 (6 bloques).
  // Rollback trivial: cambiar VOICE_NARRATIVE_PILOT_ENABLED a false.
  // BRIEF MICRO 3 (cleanup) · branches priority_rec dentro de M1-M4 eliminadas
  // físicamente · M1-M4 mantienen otras branches para archetypes restantes.
  // ════════════════════════════════════════════════════════════════════════
  const VOICE_NARRATIVE_PILOT_ENABLED = true;
  if (archetype === "priority_recommendation" && VOICE_NARRATIVE_PILOT_ENABLED) {
    return composePriorityRecommendationV2(scenarioId);
  }

  const evidence = validateM3Evidence(archetype, domains, scenarioId);

  const m1 = composeM1Donde(archetype, domains, scenarioId);
  const m2 = composeM2ComoOpera(archetype, domains, scenarioId);
  const m3 = composeM3ComoSeConectan(archetype, domains, evidence, scenarioId);
  const m4 = composeM4QuePriorizar(archetype, domains, scenarioId);
  const confianza = composeCrossDomainConfianza(archetype, evidence);

  const opener = [m1, m2, m3, m4, confianza]
    .filter(p => p && p.length > 0)
    .join("\n\n");

  const suggestions = composeCrossDomainSuggestions(archetype, domains);

  // BRIEF #16 · acción Sentrix contextual para cross-domain
  // Solo priority_recommendation y fuga_distribuida en cobertura demo.
  // Otras ramas (calidad_crecimiento, exposure_analysis, trapped_capital)
  // dejan sentrixAction null → botón no se renderiza.
  let sentrixAction = null;

  if (archetype === "priority_recommendation") {
    sentrixAction = composeSentrixAction("priority_recommendation", {
      primaryClient: "Falabella",
    });
  }

  if (archetype === "fuga_distribuida") {
    const margenesForAction = applyScenarioToClientesMargen(scenarioId);
    const benchmark = 30.1;
    const target_carga = 3.5;
    const tier1WithPressure = margenesForAction.filter(c =>
      c.margen < benchmark && c.pctRebate > target_carga
    );
    const tier1Names = tier1WithPressure.map(c => c.nombre);
    sentrixAction = composeSentrixAction("fuga_distribuida", {
      tier1Names,
    });
  }

  // BRIEF N-bis · Tipo A puro · suggestions filtradas en return
  return { opener, suggestions: filterTextualSuggestions(suggestions), sentrixAction };
}

// ─── M1 · DÓNDE ESTÁ EL PROBLEMA ────────────────────────

function composeM1Donde(archetype, domains, scenarioId) {
  const ventas = applyScenarioToClientesVentas(scenarioId);
  const margenes = applyScenarioToClientesMargen(scenarioId);
  const totalActual = ventas.reduce((s, c) => s + c.actual, 0);
  const benchmark = 30.1;
  const bestPractice = 3.0;

  if (archetype === "fuga_distribuida") {
    // BRIEF #15-quater · alinear target 3.5% con M4 y mecanismo-first.
    // Filtro: cuentas con margen bajo benchmark Y carga sobre target (no
    // sobre bestPractice). Asegura que las cuentas listadas efectivamente
    // tienen recuperable positivo al target 3.5%.
    const target_carga = 3.5;
    const tier1WithPressure = margenes.filter(c =>
      c.margen < benchmark && c.pctRebate > target_carga
    );
    const fugaContrib = tier1WithPressure.reduce((s, c) => {
      const carga_excedente_pp = c.pctRebate - target_carga;
      const recuperable = (carga_excedente_pp / 100) * c.venta;
      return s + recuperable;
    }, 0);
    const fugaK = Math.round(fugaContrib);

    // BRIEF #29 · Cifra dual · capital inmovilizado primero (decisión semántica).
    // El opener arranca con capital inmovilizado porque "plata muerta" ≡ capital
    // detenido en stock por definición ejecutiva. La contribución erosionada
    // es complemento ("además"), no jerarquía cuantitativa.
    //
    // Cifra A · capital inmovilizado en SKUs con alerta crit/warn o rotación<2.
    // Calculada en runtime desde skuInventario (cero hardcoding).
    const skusFugados = skuInventario.filter(
      s => s.alerta === "crit" || s.alerta === "warn" || s.rotacion < 2
    );
    const capitalFugado = skusFugados.reduce(
      (sum, s) => sum + s.stockUSD,
      0
    );
    const capitalFugadoK = Math.round(capitalFugado / 1000);

    // FIX #D-CAPITAL-DEF-CANONICA · cifra dual · agregar la sub-lectura estricta (>60d) tras la Def 2.
    if (typeof ADI_CAPITAL_DEF_CANONICA_ENABLED !== "undefined" && ADI_CAPITAL_DEF_CANONICA_ENABLED) {
      const _canon = _capitalInmovilizado(skuInventario);
      const _estrictoK = Math.round(_canon.estricto60d / 1000);
      return `La presión del negocio se concentra simultáneamente en dos lugares: capital inmovilizado en categorías de baja rotación (aproximadamente $${capitalFugadoK}K detenidos en stock entre SKUs con alerta operativa; de eso, aproximadamente $${_estrictoK}K corresponde a stock sin venta por más de 60 días), y contribución bajo benchmark sobre cuentas Tier 1 con carga comercial sobre la mejor práctica interna (aproximadamente $${fugaK}K anuales recuperables).`;
    }

    return `La presión del negocio se concentra simultáneamente en dos lugares: capital inmovilizado en categorías de baja rotación (aproximadamente $${capitalFugadoK}K detenidos en stock entre SKUs con alerta operativa), y contribución bajo benchmark sobre cuentas Tier 1 con carga comercial sobre la mejor práctica interna (aproximadamente $${fugaK}K anuales recuperables).`;
  }

  if (archetype === "calidad_crecimiento") {
    const lowQualityGrowers = ventas
      .map(c => ({ ...c, _var: c.anterior > 0 ? +((((c.actual - c.anterior) / c.anterior) * 100).toFixed(1)) : 0 }))
      .filter(c => c._var > 5)
      .map(c => {
        const m = margenes.find(x => x.nombre === c.nombre);
        return m && m.margen < benchmark ? { ...c, margen: m.margen, contrib: m.contribucion } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.actual - a.actual)
      .slice(0, 3);

    if (lowQualityGrowers.length === 0) {
      return `El crecimiento de la cartera no muestra deterioro material de calidad en el escenario actual.`;
    }

    const namesList = lowQualityGrowers.map(c =>
      `${c.nombre} (crece +${c._var}% pero opera con margen ${c.margen}%, ${(benchmark - c.margen).toFixed(1)}pp bajo benchmark)`
    ).join("; ");

    return `El crecimiento de las ventas se concentra en cuentas que operan con margen comprimido: ${namesList}. Las tres aportan volumen incremental pero por debajo de la rentabilidad estructural de la cartera.`;
  }

  if (archetype === "exposure_analysis") {
    const top3 = [...margenes].sort((a, b) => b.contribucion - a.contribucion).slice(0, 3);
    const top3Contrib = top3.reduce((s, c) => s + c.contribucion, 0);
    const top3Ventas = top3.reduce((s, c) => {
      const v = ventas.find(x => x.nombre === c.nombre);
      return s + (v ? v.actual : 0);
    }, 0);
    const top3Participacion = ((top3Ventas / totalActual) * 100).toFixed(1);
    const top3ContribM = (top3Contrib / 1000).toFixed(2);
    const top3VentasM = (top3Ventas / 1000).toFixed(1);
    const namesList = top3.map(c => c.nombre).join(", ");

    return `Los tres principales clientes por contribución son ${namesList}, que combinados representan $${top3ContribM}M de contribución y ${top3Participacion}% de la cartera total. Una salida simultánea de los tres significaría -$${top3VentasM}M en ventas anuales y eliminaría aproximadamente la mitad de la rentabilidad operativa.`;
  }

  if (archetype === "trapped_capital") {
    return `La pregunta toca capital de trabajo cruzado con rentabilidad por categoría. El capital inmovilizado vive en el módulo Inventario, donde se descompone por categoría, antigüedad y bodega. La lectura precisa de qué parte del negocio consume capital sin devolver rentabilidad requiere drilldown por categoría con datos de rotación específicos.`;
  }

  // Generic multi-domain fallback
  const domainsTxt = domains.map(d => ({
    margenes: "rentabilidad por cuenta",
    ventas: "carga comercial y crecimiento",
    inventario: "capital inmovilizado en inventario",
  }[d])).filter(Boolean).join(", ");

  return `La pregunta toca ${domains.length} ejes distintos del negocio: ${domainsTxt}. La lectura requiere cruzarlos para entender materialidad real.`;
}

// ─── M2 · CÓMO OPERA ────────────────────────────────────

function composeM2ComoOpera(archetype, domains, scenarioId) {
  if (archetype === "fuga_distribuida") {
    return `La contribución bajo benchmark deteriora resultado operativo mes a mes: cada punto de carga comercial sobre la mejor práctica interna se traduce en margen que no se captura. El capital inmovilizado opera distinto: no aparece en el P&L mensual, pero reduce velocidad de conversión de caja y limita capacidad de reinversión comercial.`;
  }

  if (archetype === "calidad_crecimiento") {
    return `El crecimiento de baja calidad opera por un mecanismo específico: el volumen incremental se captura a costa de margen unitario. La cuenta aporta facturación pero diluye contribución por mejor práctica interna, lo que comprime la rentabilidad agregada de la cartera mientras la línea de ventas reporta crecimiento positivo.`;
  }

  if (archetype === "exposure_analysis") {
    const margenes = applyScenarioToClientesMargen(scenarioId);
    const top3 = [...margenes].sort((a, b) => b.contribucion - a.contribucion).slice(0, 3);
    const tier2 = margenes.filter(c => c.contribucion < top3[2].contribucion && c.contribucion > 1000);
    const tier2Participacion = tier2.reduce((s, c) => s + c.venta, 0);
    const totalVentas = margenes.reduce((s, c) => s + c.venta, 0);
    const tier2Pct = ((tier2Participacion / totalVentas) * 100).toFixed(1);

    return `Las tres cuentas operan con el mismo patrón estructural: alta participación + margen bajo benchmark + carga comercial sobre la mejor práctica interna. Sostienen volumen pero deterioran rentabilidad unitaria. El Tier 2 disponible suma ${tier2Pct}% de participación, escala insuficiente para absorber el flujo Tier 1 en horizonte de 12 meses sin replicar el mismo patrón.`;
  }

  if (archetype === "trapped_capital") {
    return `El capital inmovilizado en inventario opera sobre liquidez, no sobre P&L mensual: no aparece como costo en el período, pero reduce flujo de caja disponible para reinversión comercial. Cuando se combina con margen comprimido en la categoría afectada, el negocio compromete capital sin retorno proporcional al ciclo.`;
  }

  return `Cada eje opera sobre una dimensión económica distinta del negocio. La lectura cruzada requiere identificar el mecanismo específico de cada uno antes de conectarlos.`;
}

// ─── M3 · CÓMO SE CONECTAN (R5 GATE APLICA) ─────────────

function composeM3ComoSeConectan(archetype, domains, evidence, scenarioId) {
  if (!evidence.valid) {
    const missingInfo = evidence.missing || "información adicional para confirmar causalidad";
    return `La relación precisa entre los dominios involucrados requiere ${missingInfo}. La lectura completa de la conexión necesita drilldown específico para confirmar el mecanismo causal.`;
  }

  if (archetype === "fuga_distribuida") {
    return `Ambos mecanismos comprometen la misma cosa por caminos distintos: uno erosiona la rentabilidad presente, el otro limita la capacidad de generar rentabilidad futura. El negocio paga doble: una vez en resultado operativo, otra en liquidez disponible para reinversión.`;
  }

  if (archetype === "calidad_crecimiento") {
    return `Ventas y contribución dejan de moverse al mismo ritmo cuando el crecimiento se captura con concesiones comerciales que comprimen margen unitario. El crecimiento puede ser real en facturación pero estructuralmente negativo en rentabilidad, lo que distorsiona la lectura de salud del negocio si solo se mira la línea de ventas.`;
  }

  if (archetype === "exposure_analysis") {
    return `La dependencia de las tres cuentas no es solo de volumen: es estructural. Absorben el modelo comercial actual de la cartera, con su carga y su presión de margen. Reemplazarlas exige reconstruir simultáneamente volumen, margen y mecanismo comercial, lo que el Tier 2 actual no puede absorber sin replicar el mismo patrón de presión.`;
  }

  if (archetype === "trapped_capital") {
    return `Inventario y margen operan sobre escalas temporales distintas pero comprometen la misma capacidad operativa del negocio. Uno congela liquidez presente, el otro reduce rentabilidad presente. La combinación limita doblemente la capacidad de reinvertir en categorías de mayor retorno.`;
  }

  return `Los dominios identificados operan por mecanismos distintos pero comprometen capacidad operativa común del negocio. La conexión es real, observable en datos del escenario activo.`;
}

// ─── M4 · QUÉ PRIORIZAR ─────────────────────────────────

function composeM4QuePriorizar(archetype, domains, scenarioId) {
  const margenes = applyScenarioToClientesMargen(scenarioId);
  const benchmark = 30.1;
  const bestPractice = 3.0;

  if (archetype === "fuga_distribuida") {
    const falabella = margenes.find(c => c.nombre === "Falabella");
    if (!falabella) return `La palanca prioritaria requiere identificación de la cuenta de mayor materialidad activa.`;

    // BRIEF #15-ter · FIX 3b · alinear target con BRIEF #15 (3.5%, no 3.0%)
    const target_carga = 3.5;
    const recuperable = ((falabella.pctRebate - target_carga) / 100) * falabella.venta;
    const recuperableK = Math.round(recuperable);

    return `La palanca de mayor impacto inmediato está en carga comercial sobre Falabella, porque combina el mayor peso económico en la cartera ($${(falabella.contribucion/1000).toFixed(2)}M de contribución), el mayor control directo (es decisión comercial directa) y el efecto secundario de liberar margen para absorber inventario sin compromiso explícito de volumen. Una reducción gradual desde ${falabella.pctRebate}% hacia ${target_carga}% recuperaría aproximadamente $${recuperableK}K anuales en contribución.`;
  }

  if (archetype === "calidad_crecimiento") {
    return `La palanca prioritaria es renegociar carga comercial sobre las cuentas que crecen con margen comprimido, no frenar su crecimiento. El objetivo es convertir el volumen incremental en rentabilidad incremental sin compromiso explícito de volumen. El orden natural sugerido es empezar por la cuenta de mayor materialidad con mejor controlabilidad de carga.`;
  }

  if (archetype === "exposure_analysis") {
    return `La diversificación proactiva del Tier 2 mientras los Tier 1 siguen activos es la única palanca real, porque ataca exposición y mecanismo simultáneamente. El objetivo no es reemplazar volumen, es construir capacidad comercial alternativa con perfil de margen sano antes de que la salida sea forzada.`;
  }

  if (archetype === "trapped_capital") {
    return `La palanca prioritaria es liberar capital en categorías de baja rotación con margen sano, no en categorías con margen ya comprimido. La intervención precisa requiere drilldown por categoría dentro del módulo Inventario para identificar qué SKUs combinan capital alto con rotación baja y margen aceptable.`;
  }

  return `La palanca prioritaria requiere análisis específico del dominio detectado con mayor materialidad activa en el escenario.`;
}

// ─── CONFIANZA ──────────────────────────────────────────

function composeCrossDomainConfianza(archetype, evidence) {
  if (!evidence.valid) {
    return `*Confianza media · la lectura es estructural pero requiere drilldown por dimensión específica para precisión cuantitativa.*`;
  }

  if (archetype === "fuga_distribuida") {
    return `*Confianza alta · el cruce contribución-capital se sostiene como mecanismo estructural en el escenario activo, con cifras determinísticas sobre carga comercial.*`;
  }

  if (archetype === "exposure_analysis") {
    return `*Confianza alta · la cuantificación de exposición es determinística sobre el escenario activo. La estimación de reemplazabilidad se sostiene en participación actual de Tier 2 y crecimiento histórico observado.*`;
  }

  if (archetype === "priority_recommendation") {
    return `*Confianza alta · la priorización se sostiene en evidencia observable del escenario activo, con impacto cuantificado sobre la cuenta de mayor materialidad de la cartera.*`;
  }

  return `*Confianza alta · la lectura cross-domain se sostiene en evidencia observable del escenario activo.*`;
}

// ─── SUGGESTIONS ────────────────────────────────────────

function composeCrossDomainSuggestions(archetype, domains) {
  if (archetype === "fuga_distribuida") {
    return [
      "Cómo arranco la renegociación con Falabella",
      "Cuál es el impacto exacto de bajar carga 1pp",
      "Profundizar en capital inmovilizado por categoría",
    ];
  }
  if (archetype === "exposure_analysis") {
    return [
      "Cómo arranco la diversificación de Tier 2",
      "Cuánto tiempo necesito para reducir exposición",
      "Qué cuentas Tier 2 tienen mayor potencial",
    ];
  }
  if (archetype === "priority_recommendation") {
    return [
      "Profundizar en Falabella",
      "Qué pasa si bajo carga 1pp",
      "Cuáles son las otras palancas subsecuentes",
    ];
  }
  return [
    "Profundizar en alguno de los ejes",
    "Cuáles cuentas son las más afectadas",
    "Qué impacto tendría intervenir esta semana",
  ];
}
