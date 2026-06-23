/* === narrativeLayer.js ===
 * Subsistema "narrative layer" (BRIEF M.* / N.*) extraído de 41cc33d8 ·
 * copiado VERBATIM · misma entrada → misma salida · sin React. La única
 * diferencia con el monolito es DÓNDE vive el código, nunca QUÉ computa.
 * Único cambio permitido: agregar import/export.
 *
 * Entry points (los llama el bloque de integración FASE 5):
 *   · dispatchNarrativeComposer
 *   · selectPosture
 *   · applyVoiceCalibration
 */
import { _fmtMoneyK } from "../engine/formatters.js";
import { EXECUTIVE_REFRAMES } from "../config/signalRules.js";
import { applyScenarioToClientesMargen } from "../engine/scenarios.js";
import { skuInventario } from "../data/demoData.js";
import {
  VOICE_NARRATIVE_LAYER_ENABLED,
  ARCO_ENABLED,
} from "../config/voiceFlags.js";

// ── EXECUTIVE_POSTURES · catálogo declarativo de posturas ────────────────
// 6 posturas reconocidas. recommend queda sin caso activo en M (simulation
// deferida a M.2 · deuda #D-SIMULATION-VOICE-LEGACY-DIFERIDA).
const EXECUTIVE_POSTURES = {
  validate: {
    description: "Confirma con cifras lo que el founder ya intuye",
    voice: "directa · sin sobre-explicar · cierra rápido",
  },
  reframe: {
    description: "Indica que la pregunta correcta es OTRA",
    voice: "honesta · provocadora · explica por qué Y > X",
  },
  prioritize: {
    description: "Ordena · jerarquiza · dice qué importa más AHORA",
    voice: "ejecutiva · cuantitativa · cierra con acción priorizada",
  },
  challenge: {
    description: "Cuestiona supuesto que el founder está dando por sentado",
    voice: "directa · contraintuitiva · respalda con evidencia",
  },
  explore: {
    description: "Sugiere ángulos que el founder no ha mirado",
    voice: "amplia · ofrece 2-3 caminos · invita a elegir",
  },
  recommend: {
    description: "Da recomendación específica con número y acción",
    voice: "asertiva · primera persona ejecutiva · sin hedges",
    // M-status: SIN_CASO_ACTIVO_EN_M · diferido M.2
  },
};

// ── METRIC_LABEL / METRIC_UNIT · verbalización + unidad por canonical key ──
const METRIC_LABEL = {
  margen:           "margen",
  contribucion:     "contribución",
  ventas:           "ventas",
  carga:            "carga comercial",
  rotacion:         "rotación",
  stockUSD:         "stock",
  cobertura:        "cobertura",
  doh:              "DOH",
  sku_margen:       "margen",
  sku_contribucion: "contribución",
};

// ── _ordinalSpanishMasc · 1→"primero" · 2→"segundo" · ... · default fallback ──
function _ordinalSpanishMasc(n) {
  const map = {
    1: "primero", 2: "segundo", 3: "tercero", 4: "cuarto", 5: "quinto",
    6: "sexto", 7: "séptimo", 8: "octavo", 9: "noveno", 10: "décimo",
  };
  return map[n] || `${n}º`;
}

// ── composeOpeningOrdinal · apertura para rank_position ≥ 2 ──────────────
// Cuando hay topN≥2 · cada entity posterior abre con ordinal · NO con
// "es tu peor" (que solo aplica al #1). Patrón asesor: jerarquía clara.
function composeOpeningOrdinal(signals) {
  const w = signals.what;
  if (!w) return "";
  const rank = signals.rank_position || 1;
  const valStr = w.unit === "%" ? `${w.value.toFixed(1)}%` :
                 w.unit === "x" ? `${w.value.toFixed(1)}x` :
                 w.unit === "d" ? `${Math.round(w.value)}d` :
                 w.unit === "$" ? _fmtMoneyK(w.value) :
                 String(w.value);
  const directionLabel = signals.direction === "best" ? "mejor" : "peor";
  const entityNounSingular = w.entityType === "client" ? "cliente" : "SKU";
  // rank_position=2 → "El segundo cliente con peor margen es Falabella · 22.0%."
  // rank_position=3 → "El tercero con peor margen es Sodimac · 23.5%."
  if (rank === 2) {
    return `El segundo ${entityNounSingular} con ${directionLabel} ${METRIC_LABEL[w.metricKey] || w.metric} es ${w.entity} · ${valStr}.`;
  }
  if (rank === 3) {
    return `El tercero con ${directionLabel} ${METRIC_LABEL[w.metricKey] || w.metric} es ${w.entity} · ${valStr}.`;
  }
  // rank ≥ 4 · forma numerada
  return `En posición ${_ordinalSpanishMasc(rank)} aparece ${w.entity} con ${directionLabel} ${METRIC_LABEL[w.metricKey] || w.metric} · ${valStr}.`;
}

// ── composeNarrativeForRankingItem · selecciona apertura por rank_position ──
// rank_position=1 → reframe interpretativo (si driver interno) o direct
// rank_position≥2 → ordinal · sin reframe interpretativo
// Causal + acción se incluyen SOLO si hay driver y solo en posiciones 1-2
// (en posiciones ≥3 la narrativa es más escueta · evita ruido).
function composeNarrativeForRankingItem(signals, posture, ctx) {
  if (!signals) return "";
  const rank = signals.rank_position || 1;
  const movements = [];

  // MOVIMIENTO 1 · Apertura
  if (rank === 1) {
    if (posture === "challenge" && signals.implication?.counter_intuition && signals.why) {
      movements.push(composeOpeningReframe(signals));
    } else {
      movements.push(composeOpeningDirect(signals));
    }
  } else {
    movements.push(composeOpeningOrdinal(signals));
  }

  // MOVIMIENTO 2 · Causalidad (solo si why y rank ≤ 2)
  if (signals.why && rank <= 2) {
    const causal = composeCausalMovement(signals.why, posture);
    if (causal) movements.push(causal);
  }

  // MOVIMIENTO 3 · Acción/implicación (solo rank=1)
  if (rank === 1) {
    if (signals.implication?.action) {
      const action = composeActionMovement(signals.implication, posture);
      if (action) movements.push(action);
    } else if (signals.implication?.severity) {
      const imp = composeImplicationOnly(signals.implication, posture);
      if (imp) movements.push(imp);
    }
  }

  // MOVIMIENTO 4 (opcional · rank=1) · Reframe ejecutivo final
  if (rank === 1 && posture === "challenge" && signals.implication?.reframe) {
    movements.push(composeReframeClosing(signals.implication.reframe));
  }

  return integrateMovements(movements, posture);
}

// ── composeRankingExtremesNarrative · entry point usado por el composer ──
// Recibe los signals (objeto único o {items[]}) + posture + ctx, retorna
// narrativa final lista para opener (PRE voice calibration).
// ── detectGroupPattern · clasificar set de items por driver detectado ────
// Categoriza un array de items signals según patrón de drivers internos.
// Salidas:
//   "all_same_driver"  · todos los items tienen el mismo mechanism
//   "mixed_drivers"    · todos tienen driver · pero mechanisms diferentes
//   "partial_drivers"  · algunos tienen driver · otros no
//   "no_driver_group"  · ninguno tiene driver detectable
function detectGroupPattern(items) {
  if (!Array.isArray(items) || items.length === 0) return "no_driver_group";
  const drivers = items.map(i => i?.why?.mechanism || null);
  const withDriver = drivers.filter(d => d != null);
  if (withDriver.length === 0) return "no_driver_group";
  if (withDriver.length === items.length) {
    const unique = new Set(withDriver);
    return unique.size === 1 ? "all_same_driver" : "mixed_drivers";
  }
  return "partial_drivers";
}

// ── composeRankingGroupNarrative · narrativa integrada para topN≥2 ───────
// Reemplaza el patrón anterior (replicar narrativa #1 + ordinales escuetos
// para #2-#3 huérfanos). El cliente pidió "los N peores" · entrega N análisis
// integrados como GRUPO · con pattern detection y agregaciones.
//
// Estructura output (siempre · independiente del pattern):
//   1. Lista de N con cifras: "Los N peores X son A (v) · B (v) · C (v)."
//   2. Pattern movement (depende de detectGroupPattern)
//      · all_same_driver  → reframe común + agregado + reframe ejecutivo (1 vez)
//      · partial_drivers  → "X e Y comparten driver · Z es distinto" + análisis subset
//      · mixed_drivers    → "los N tienen origen interno distinto" + outline
//      · no_driver_group  → "no hay driver interno obvio · sugerir drilldown"
function composeRankingGroupNarrative(items, posture, ctx) {
  if (!Array.isArray(items) || items.length === 0) return "";

  const head = items[0];
  const entityType = head?.what?.entityType || "client";
  const metricKey = head?.what?.metricKey || "margen";
  const metricLabel = METRIC_LABEL[metricKey] || metricKey;
  const direction = head?.direction || "worst";
  const directionLabel = direction === "worst" ? "peores" : "mejores";
  const entityPlural = entityType === "client" ? "clientes" : "SKUs";

  // ── MOVIMIENTO 1 · Lista de N con cifras (siempre) ──
  const listParts = items.map(it => {
    const w = it.what;
    const v = w.unit === "%" ? `${w.value.toFixed(1)}%`
            : w.unit === "x" ? `${w.value.toFixed(1)}x`
            : w.unit === "d" ? `${Math.round(w.value)}d`
            : String(w.value);
    return `${w.entity} (${v})`;
  });
  // Verbalización natural: "A · B · C" para 2-3 · "A · B · ... · Z" para N≥4
  const listStr = listParts.join(" · ");
  const listMovement = `Los ${items.length} ${directionLabel} ${entityPlural} por ${metricLabel} son ${listStr}.`;

  // ── MOVIMIENTO 2 · Pattern movement ──
  const pattern = detectGroupPattern(items);
  let patternMovement = "";

  if (pattern === "all_same_driver") {
    // Reframe común + agregado + reframe ejecutivo (una sola vez)
    const sharedMechanism = head.why.mechanism;
    const sharedFactor = head.why.driver?.factor;

    if (sharedFactor === "carga_comercial") {
      // Promedio de pctRebate del grupo
      const cargas = items.map(it => it.why.driver.value);
      const avgCarga = cargas.reduce((a, b) => a + b, 0) / cargas.length;
      // gap del grupo (vs promedio interno · usamos vs_promedio del head como referencia)
      const recoverables = items.map(it => it.implication?.recoverable_value || 0);
      const totalRecoverable = recoverables.reduce((a, b) => a + b, 0);
      const recoverablesBP = items.map(it => it.implication?.action?.bestPractice_recoverable_K || 0);
      const totalRecoverableBP = recoverablesBP.reduce((a, b) => a + b, 0);

      patternMovement = `Antes de mirar al ${entityType === "client" ? "cliente" : "producto"} · vale mirar adentro: los ${items.length} comparten el mismo driver. La carga comercial promedio del grupo es ${avgCarga.toFixed(1)}%. Si los ${items.length} se llevan al promedio interno · son ${_fmtMoneyK(totalRecoverable)} anuales recuperables · si bajan a mejor práctica (3.0%) · ${_fmtMoneyK(totalRecoverableBP)}.`;
    } else if (sharedFactor === "doh_alto") {
      const stocks = items.map(it => it.implication?.recoverable_value || 0);
      const totalStock = stocks.reduce((a, b) => a + b, 0);
      const dohs = items.map(it => it.why.driver.value);
      const avgDoh = dohs.reduce((a, b) => a + b, 0) / dohs.length;
      patternMovement = `El driver compartido es DOH alto · promedio ${Math.round(avgDoh)}d en el grupo. El capital atrapado entre los ${items.length} suma ${_fmtMoneyK(totalStock / 1000)}.`;
    } else {
      patternMovement = `Los ${items.length} comparten el mismo driver interno.`;
    }
  } else if (pattern === "partial_drivers") {
    // X e Y comparten · Z es distinto
    const withDriver = items.filter(it => it.why);
    const withoutDriver = items.filter(it => !it.why);
    const withNames = withDriver.map(it => it.what.entity).join(" y ");
    const withoutNames = withoutDriver.map(it => it.what.entity).join(" y ");
    if (withDriver.length > 0 && withoutDriver.length > 0) {
      patternMovement = `${withNames} ${withDriver.length === 1 ? "tiene" : "comparten"} driver interno detectable; ${withoutNames} ${withoutDriver.length === 1 ? "no" : "no lo comparten"}.`;
      // Si el subset común tiene carga_comercial · agregar recoverable subset
      const subsetCarga = withDriver.filter(it => it.why.driver?.factor === "carga_comercial");
      if (subsetCarga.length > 0) {
        const subsetRec = subsetCarga.reduce((s, it) => s + (it.implication?.recoverable_value || 0), 0);
        patternMovement += ` Sobre ${withNames} · si llevás la carga al promedio interno · son ${_fmtMoneyK(subsetRec)} anuales recuperables.`;
      }
    }
  } else if (pattern === "mixed_drivers") {
    // Cada uno tiene driver distinto · solo outline
    const mechanisms = items.map(it => ({ name: it.what.entity, mech: it.why.mechanism }));
    const outlineParts = mechanisms.map(m => `${m.name} (${_humanizeMechanism(m.mech)})`);
    patternMovement = `Los ${items.length} tienen origen interno distinto: ${outlineParts.join(" · ")}. Cada uno requiere intervención puntual.`;
  } else { // no_driver_group
    patternMovement = `Sin driver interno obvio en los ${items.length}. El gap vs benchmark puede ser mix-effect o pricing · sugerir drilldown por cliente.`;
  }

  // ── MOVIMIENTO 3 · Reframe ejecutivo (solo si pattern tiene driver común) ──
  let reframeMovement = "";
  if (pattern === "all_same_driver" || (pattern === "partial_drivers" && head.implication?.reframe)) {
    const reframe = items[0].implication?.reframe;
    if (reframe) reframeMovement = reframe;
  }

  const movements = [listMovement, patternMovement, reframeMovement].filter(m => m && m.length > 0);
  return movements.join("\n\n");
}

// ── _humanizeMechanism · etiqueta corta de mechanism para outlines ───────
function _humanizeMechanism(mechanism) {
  const m = {
    internal_commercial_load:    "carga comercial",
    internal_margin_compression: "margen unitario",
    structural_dependency:       "dependencia estructural",
    operational_inefficiency:    "DOH alto",
  };
  return m[mechanism] || mechanism;
}

// ── composeCrossMetricNarrative · cross-metric con contraste real (Ajuste B) ──
// El cross-metric NO clona "X es tu peor Y" del topN=1. Usa el set como
// contraste · interpreta lo que importa del ángulo cross.
//
// Estructura output:
//   1. Apertura cross: "Del top N {rankMetric} (set) · {winner} es el {sortDir} {sortMetric}."
//   2. Contraste: "{winner} rinde {value} vs {others_avg} de los otros · spread {spread}pp."
//   3. Reframe interpretativo (si counter_intuition): "Antes de mirar al cliente · vale mirar adentro."
//   4. Causal (si driver): "La carga sobre {winner} es X% · gap..."
//   5. Acción (si action): "Si negociás esa carga..."
//   6. Reframe ejecutivo (catálogo · si reframe)
function composeCrossMetricNarrative(signals, posture, ctx) {
  if (!signals || !signals.cross_metric || !signals.rank_context) return "";

  const rc = signals.rank_context;
  const w = signals.what;
  const gap = signals.winner_vs_others_gap;
  const setNames = Array.isArray(rc.set_entities) ? rc.set_entities.join(" · ") : "";
  const rankMetricLabel = METRIC_LABEL[rc.rankMetric] || rc.rankMetric;
  const sortMetricLabel = METRIC_LABEL[w.metricKey] || w.metric;
  const sortWord = signals.direction === "worst" ? "peor" : "mejor";

  const valStr = (v) => w.unit === "%" ? `${v.toFixed(1)}%`
                      : w.unit === "x" ? `${v.toFixed(1)}x`
                      : w.unit === "d" ? `${Math.round(v)}d`
                      : String(v);

  const movements = [];

  // MOVIMIENTO 1 · Apertura cross-metric
  movements.push(`Del top ${rc.rankN} ${rankMetricLabel} (${setNames}) · ${w.entity} es el ${sortWord} ${sortMetricLabel}.`);

  // MOVIMIENTO 2 · Contraste · "X rinde V vs O de los otros"
  if (gap && gap.spread != null) {
    const winnerVal = valStr(gap.winner_value);
    const othersVal = valStr(gap.others_avg);
    const spreadStr = w.unit === "%" ? `${gap.spread.toFixed(1)}pp` : `${gap.spread.toFixed(1)}`;
    // Si spread es chico (<1pp para %) · matizar
    const isNarrow = (w.unit === "%" && gap.spread < 1) || (w.unit !== "%" && gap.spread < 5);
    if (isNarrow) {
      movements.push(`${w.entity} rinde ${winnerVal} vs ${othersVal} promedio de los otros · los ${rc.rankN} son parecidos pero ${w.entity} queda ${spreadStr} por ${signals.direction === "worst" ? "debajo" : "encima"}.`);
    } else {
      movements.push(`${w.entity} rinde ${winnerVal} vs ${othersVal} promedio de los otros · ${spreadStr} de spread en el set.`);
    }
  }

  // MOVIMIENTO 3 · Reframe interpretativo (si counter_intuition · postura challenge)
  if (posture === "challenge" && signals.implication?.counter_intuition && signals.why) {
    const entityNoun = w.entityType === "client" ? "cliente" : "producto";
    movements.push(`Antes de mirar al ${entityNoun} · vale mirar adentro.`);
  }

  // MOVIMIENTO 4 · Causal (reusa M.A composeCausalMovement)
  if (signals.why) {
    const causal = composeCausalMovement(signals.why, posture);
    if (causal) movements.push(causal);
  }

  // MOVIMIENTO 5 · Acción (reusa M.A composeActionMovement)
  if (signals.implication?.action) {
    const action = composeActionMovement(signals.implication, posture);
    if (action) movements.push(action);
  }

  // MOVIMIENTO 6 · Reframe ejecutivo (catálogo founder)
  if (posture === "challenge" && signals.implication?.reframe) {
    movements.push(composeReframeClosing(signals.implication.reframe));
  }

  return movements.filter(m => m && m.length > 0).join("\n\n");
}

function composeRankingExtremesNarrative(signals, posture, ctx) {
  if (!signals || !VOICE_NARRATIVE_LAYER_ENABLED) return null;
  try {
    if (Array.isArray(signals.items)) {
      // topN ≥ 2 · narrativa integrada de grupo (Ajuste A · founder M.B.1)
      // Reemplaza el patrón viejo "replicar #1 + ordinales escuetos huérfanos".
      return composeRankingGroupNarrative(signals.items, posture, ctx);
    }
    // Caso topN=1 o cross-metric
    // Cross-metric usa composer dedicado · NO reusa itemNarrative para evitar
    // clonar "X es tu peor Y". El contraste con el set es la voz del cross.
    if (signals.cross_metric && signals.rank_context) {
      return composeCrossMetricNarrative(signals, posture, ctx);
    }

    const itemNarrative = composeNarrativeForRankingItem(signals, posture, ctx);
    return itemNarrative;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("BRIEF M.B.1 composeRankingExtremesNarrative error:", err);
    return null;
  }
}

// ── composeMechanismScanNarrative · narrativa "panorama del negocio" ─────
// Postura: prioritize · jerarquía + interpretación causal + reframe ejecutivo.
function composeMechanismScanNarrative(signals, posture, ctx) {
  if (!signals || signals.kind !== "mechanism_scan") return null;
  const movements = [];

  // MOVIMIENTO 1 · Apertura jerárquica
  const N = signals.activos_count;
  const labels = signals.hierarchy.map(h => h.label);
  const labelStr = labels.length === 1 ? labels[0]
                 : labels.length === 2 ? labels.join(" y ")
                 : labels.slice(0, -1).join(" · ") + " · " + labels[labels.length - 1];
  movements.push(`La cartera presenta ${N} ${N === 1 ? "mecanismo activo" : "mecanismos activos"} hoy: ${labelStr}.`);

  // MOVIMIENTO 2 · Cuerpo por mecanismo · interpretación con cifras
  const bodyParts = signals.hierarchy.map(h => {
    const hl = h.headline || {};
    if (h.mechanismId === "commercial_erosion") {
      const recK = hl.recoverable_K || 0;
      const recM_bp = hl.recoverable_M_at_bestPractice || 0;
      const top3 = (hl.top3_names || []).join(" · ");
      const recM_bp_str = recM_bp >= 1 ? `$${recM_bp.toFixed(2)}M` : `${_fmtMoneyK(recM_bp * 1000)}`;
      return `${h.label} concentra ${_fmtMoneyK(recK)} anuales recuperables al promedio interno · ${recM_bp_str} si la carga baja a mejor práctica (3.0%). Opera sobre ${hl.instances_count} cuentas: ${top3}. Controlabilidad alta · intervención inmediata.`;
    }
    if (h.mechanismId === "quality_of_growth_deterioration") {
      const cp = hl.contribPerdida_M || 0;
      const range = hl.crecimiento_range || {};
      const rangeStr = range.min === range.max ? `+${range.min}%` : `entre +${range.min}% y +${range.max}%`;
      const cp_str = cp >= 1 ? `$${cp.toFixed(2)}M` : _fmtMoneyK(cp * 1000);
      const derivedNote = h.derived_from === "commercial_erosion"
        ? ` Es derivado de erosión comercial · la carga sostenida es la causa.`
        : "";
      return `${h.label} opera sobre ${hl.instances_count} cuentas creciendo ${rangeStr} a costa de margen unitario · ${cp_str} de contribución que se pierde vs benchmark.${derivedNote}`;
    }
    if (h.mechanismId === "customer_dependency_risk") {
      const top3 = (hl.top3_names || []).join(" · ");
      const part = hl.top3_participacion_pct || 0;
      const contrib = hl.top3_contribucion_M || 0;
      const contrib_str = contrib >= 1 ? `$${contrib.toFixed(2)}M` : _fmtMoneyK(contrib * 1000);
      return `${h.label}: ${top3} concentran ${part.toFixed(1)}% de la venta y ${contrib_str} de contribución. Estructural · horizonte 12-18 meses vía diversificación.`;
    }
    if (h.mechanismId === "trapped_capital") {
      return `${h.label} · revisar drilldown por categoría de inventario para cuantificación.`;
    }
    if (h.mechanismId === "liquidity_compression") {
      return `${h.label} · ${hl.instances_count} señales detectadas.`;
    }
    return "";
  }).filter(p => p && p.length > 0);
  movements.push(...bodyParts);

  // MOVIMIENTO 3 · Interpretación causal (si hay derivado → raíz activos)
  if (signals.has_derived_from_root) {
    const root = signals.hierarchy.find(h => h.nature === "raíz");
    const derived = signals.hierarchy.find(h => h.nature === "derivado" && h.derived_from === root?.mechanismId);
    if (root && derived) {
      movements.push(`Intervenir sobre ${root.label.toLowerCase()} reduce automáticamente parte del costo de ${derived.label.toLowerCase()}: atacar la raíz desactiva el síntoma.`);
    }
  }

  // MOVIMIENTO 4 · Reframe ejecutivo
  // Para scan multi-mecanismo · usar mechanism_priority_controllability (cuando hay >1 activo)
  if (N > 1 && EXECUTIVE_REFRAMES.mechanism_priority_controllability) {
    movements.push(EXECUTIVE_REFRAMES.mechanism_priority_controllability);
  }

  return movements.filter(m => m && m.length > 0).join("\n\n");
}

// ── composeMechanismRankingNarrative · "cuál es el problema más grave" ───
// Postura: prioritize · TOP mecanismo + interpretación de prioridad (NO monto).
function composeMechanismRankingNarrative(signals, posture, ctx) {
  if (!signals || signals.kind !== "mechanism_ranking") return null;
  const movements = [];
  const top = signals.top;
  const hl = top.headline || {};

  // MOVIMIENTO 1 · Apertura: TOP con criterio explícito
  // Asesor dice POR QUÉ es el más grave (controlabilidad × magnitud · NO solo monto)
  movements.push(`El problema más grave para atacar ahora es ${top.label.toLowerCase()} · combina alta controlabilidad y horizonte inmediato.`);

  // MOVIMIENTO 2 · Cuerpo del TOP con cifras
  if (top.mechanismId === "commercial_erosion") {
    const recK = hl.recoverable_K || 0;
    const recM_bp = hl.recoverable_M_at_bestPractice || 0;
    const top3 = (hl.top3_names || []).join(" · ");
    const recM_bp_str = recM_bp >= 1 ? `$${recM_bp.toFixed(2)}M` : _fmtMoneyK(recM_bp * 1000);
    movements.push(`Concentra ${_fmtMoneyK(recK)} anuales recuperables al promedio interno · ${recM_bp_str} si la carga baja a mejor práctica. Opera sobre ${hl.instances_count} cuentas: ${top3}.`);
  } else if (top.mechanismId === "quality_of_growth_deterioration") {
    const cp = hl.contribPerdida_M || 0;
    const cp_str = cp >= 1 ? `$${cp.toFixed(2)}M` : _fmtMoneyK(cp * 1000);
    movements.push(`${cp_str} de contribución perdida vs benchmark sobre ${hl.instances_count} cuentas.`);
  } else if (top.mechanismId === "customer_dependency_risk") {
    const top3 = (hl.top3_names || []).join(" · ");
    const part = hl.top3_participacion_pct || 0;
    movements.push(`${top3} concentran ${part.toFixed(1)}% de la venta.`);
  }

  // MOVIMIENTO 3 · Otros mecanismos · jerarquía explícita
  if (signals.others && signals.others.length > 0) {
    const otherLabels = signals.others.map(o => {
      const ohl = o.headline || {};
      if (o.id === "quality_of_growth_deterioration") {
        const cp = ohl.contribPerdida_M || 0;
        const cp_str = cp >= 1 ? `$${cp.toFixed(2)}M` : _fmtMoneyK(cp * 1000);
        return `${o.label.toLowerCase()} (${cp_str} · ${o.rule.controllability || "media"} controlabilidad)`;
      }
      if (o.id === "customer_dependency_risk") {
        const part = ohl.top3_participacion_pct || 0;
        return `${o.label.toLowerCase()} (${part.toFixed(1)}% concentración · estructural)`;
      }
      if (o.id === "commercial_erosion") {
        const recK = ohl.recoverable_K || 0;
        return `${o.label.toLowerCase()} (${_fmtMoneyK(recK)} · alta controlabilidad)`;
      }
      return o.label.toLowerCase();
    });
    movements.push(`Los otros mecanismos activos son ${otherLabels.join(" y ")}.`);
  }

  // MOVIMIENTO 4 · Reframe ejecutivo
  if (top.reframe_key && EXECUTIVE_REFRAMES[top.reframe_key]) {
    movements.push(EXECUTIVE_REFRAMES[top.reframe_key]);
  }

  return movements.filter(m => m && m.length > 0).join("\n\n");
}

// ── composeClientDeepDiveNarrative ───────────────────────────────────────
// Narrativa deep-dive cliente · identidad → métricas → driver → reframe.
function composeClientDeepDiveNarrative(signals, posture, ctx) {
  if (!signals || signals.kind !== "client_deep_dive") return null;
  const movements = [];
  const id = signals.identity;
  const w = signals.what;

  // MOVIMIENTO 1 · Identidad ejecutiva
  // "Falabella es tu cliente Tier 1 · 18.5% de la venta y 16.4% de contribución · $18.5M ventas anuales."
  const tierStr = id.tier ? `Tier ${id.tier}` : "Tier no clasificado";
  const ventasStr = id.ventas_K >= 1000
    ? `$${(id.ventas_K / 1000).toFixed(1)}M ventas anuales`
    : `${_fmtMoneyK(id.ventas_K)} ventas anuales`;
  movements.push(`${id.entity} es tu cliente ${tierStr} · ${id.participacion_pct.toFixed(1)}% de la venta y ${id.contribucion_pct.toFixed(1)}% de contribución · ${ventasStr}.`);

  // MOVIMIENTO 2 · Métricas críticas con anclaje
  const gapBench = (w.benchmark - w.margen).toFixed(1);
  const dirBench = w.margen < w.benchmark ? "bajo" : "sobre";
  const cargaClause = w.pctRebate != null ? ` La carga comercial es ${w.pctRebate.toFixed(1)}%.` : "";
  movements.push(`El margen está en ${w.margen.toFixed(1)}% · ${gapBench}pp ${dirBench} el benchmark de industria (${w.benchmark.toFixed(1)}%).${cargaClause}`);

  // MOVIMIENTO 3 · Driver interpretativo (postura challenge si counter_intuition)
  if (posture === "challenge" && signals.why) {
    movements.push(`Antes de mirar al cliente · vale mirar adentro.`);
    const causal = composeCausalMovement(signals.why, posture);
    if (causal) movements.push(causal);
    if (signals.implication?.action) {
      const action = composeActionMovement(signals.implication, posture);
      if (action) movements.push(action);
    }
  }

  // MOVIMIENTO 4 · Reframe ejecutivo founder
  if (posture === "challenge" && signals.implication?.reframe) {
    movements.push(composeReframeClosing(signals.implication.reframe));
  }

  return movements.filter(m => m && m.length > 0).join("\n\n");
}

// ── composeSkuDeepDiveNarrative ──────────────────────────────────────────
// Narrativa deep-dive SKU · 3 modos · identity → operacional → driver/reframe
function composeSkuDeepDiveNarrative(signals, posture, ctx) {
  if (!signals || signals.kind !== "sku_deep_dive") return null;
  const movements = [];
  const id = signals.identity;
  const w = signals.what;

  // MOVIMIENTO 1 · Identidad ejecutiva
  // "LG-DRYER8KG · marca LG · familia Línea Blanca · stock $13.6K en bodega Valparaíso."
  const stockStr = _fmtMoneyK(id.stockUSD / 1000);
  movements.push(`${id.entity} · marca ${id.marca} · familia ${id.sfamilia} · stock ${stockStr} en bodega ${id.bodega}.`);

  // MOVIMIENTO 2 · Métricas operacionales con calificación
  if (signals.sku_mode === "critico") {
    movements.push(`Rotación ${w.rotacion.toFixed(1)}x · DOH ${Math.round(w.doh)}d · margen ${w.margenPct}%. Es un SKU crítico por baja velocidad de conversión.`);
  } else if (signals.sku_mode === "virtuoso") {
    movements.push(`Rotación ${w.rotacion.toFixed(1)}x · DOH ${Math.round(w.doh)}d · margen ${w.margenPct}%. SKU virtuoso: alta rotación y margen sobre benchmark interno.`);
  } else {
    movements.push(`Rotación ${w.rotacion.toFixed(1)}x · DOH ${Math.round(w.doh)}d · margen ${w.margenPct}%. Operación dentro de rango intermedio.`);
  }

  // MOVIMIENTO 3 · Arco: Mecanismo · Impacto · Acción (siempre presente · gradúa por contenido).
  // ARCO_ENABLED: presencia del arco depende de signals.why (contenido), NO de posture (tono).
  if ((ARCO_ENABLED || posture === "challenge") && signals.why) {
    movements.push(`Antes de mirar al producto · vale mirar adentro.`);
    if (signals.why.driver.factor === "doh_alto") {
      const stockK = signals.implication?.recoverable_value || 0;
      movements.push(`El DOH acumula ${Math.round(signals.why.driver.value)} días · capital atrapado en stock que no rota.`);
      movements.push(`Acción: un plan de salida libera ${_fmtMoneyK(stockK)} de capital inmovilizado.`);
    } else if (signals.why.driver.factor === "carga_comercial") {
      const d = signals.why.driver;
      const recK = signals.implication?.recoverable_value || 0;
      movements.push(`La carga comercial sobre ${id.entity} es ${d.value.toFixed(1)}% · ${d.vs_promedio.toFixed(2)} puntos sobre el promedio interno.`);
      movements.push(`Acción: si se lleva la carga al promedio · son ${_fmtMoneyK(recK)} anuales recuperables.`);
    } else if (signals.why.driver.factor === "margen_unitario") {
      const d = signals.why.driver;
      const recK = signals.implication?.recoverable_value || 0;
      movements.push(`El margen unitario está ${d.vs_benchmark.toFixed(1)}pp bajo el benchmark de industria.`);
      movements.push(`Acción: recuperarlo al benchmark libera ${_fmtMoneyK(recK)} anuales en contribución.`);
    }
  } else if (ARCO_ENABLED && !signals.why) {
    // Rama SANA explícita (why === null) · fortaleza con cifras reales · contextualiza vs promedio
    // de CARTERA · puro render (promedios inline · patrón composeSkuDeepDive L16081) · sin tocar señales.
    const _avgRot = skuInventario.reduce((s, x) => s + x.rotacion, 0) / skuInventario.length;
    const _avgMrg = skuInventario.reduce((s, x) => s + x.margenPct, 0) / skuInventario.length;
    const _rotCtx = w.rotacion >= _avgRot + 1
      ? `Rotación ${w.rotacion.toFixed(1)}x sobre el promedio de cartera`
      : `Rotación ${w.rotacion.toFixed(1)}x en línea con el promedio de cartera`;
    const _mrgCtx = w.margenPct >= _avgMrg + 1
      ? `margen ${w.margenPct}% sobre el promedio`
      : (w.margenPct >= _avgMrg - 1 ? `margen ${w.margenPct}% en línea con el promedio` : `margen ${w.margenPct}% sólido`);
    movements.push(`${_rotCtx} · ${_mrgCtx}. Capital trabajando, sin gap que recuperar.`);
    const _rotWatch = w.rotacion >= _avgRot + 1
      ? `monitorear que rotación y margen no se deterioren`
      : `monitorear que la rotación no ceda`;
    movements.push(`Acción: mantener · es capital trabajando · ${_rotWatch}.`);
  } else if (signals.sku_mode === "virtuoso") {
    // Legacy (ARCO_ENABLED=false) · narrativa de fortaleza original.
    movements.push(`Es un SKU para proteger y escalar · referente operacional dentro del portafolio.`);
  }

  // MOVIMIENTO 4 · Reframe ejecutivo (sale si existe · null en sano · fail-safe · ya no gateado por tono)
  if (ARCO_ENABLED ? !!signals.implication?.reframe : (posture === "challenge" && signals.implication?.reframe)) {
    movements.push(composeReframeClosing(signals.implication.reframe));
  }

  return movements.filter(m => m && m.length > 0).join("\n\n");
}

// ── composeSkuOperationalNarrative · composer dedicado (D-MB3-3 · B.3.B) ──
// "Capital atrapado" tiene voz distinta a "los N peores por X". Composer
// dedicado · grupo + agregación + reframe operational_inefficiency.
function composeSkuOperationalNarrative(signals, posture, ctx) {
  if (!signals || signals.kind !== "sku_operational_group") return null;
  const movements = [];
  const N = signals.aggregate.count;
  const totalStockUSD = signals.aggregate.total_stockUSD;
  const avgDoh = signals.aggregate.avg_doh;
  const totalStr = _fmtMoneyK(totalStockUSD / 1000);

  // Helper local · formato SKU individual
  const fmtSku = (it) => {
    const stockK = _fmtMoneyK(it.stockUSD / 1000);
    return `${it.sku} (${stockK} · ${Math.round(it.doh)}d DOH · rotación ${it.rotacion.toFixed(1)}x)`;
  };

  // ── MOVIMIENTO 1 · Apertura · siempre menciona el grupo completo ──
  // M.B.3 v2: cambiar "concentran capital atrapado" por "concentran $X de stock"
  // porque no todos están atrapados (mixed_operational_healthy lo aclara después).
  if (signals.pattern === "all_operational") {
    movements.push(`${N} SKUs concentran capital atrapado · ${totalStr} de stock con DOH promedio ${Math.round(avgDoh)}d.`);
  } else {
    // mixed · borderline · usar lenguaje neutro
    movements.push(`${N} SKUs concentran ${totalStr} de stock con DOH promedio ${Math.round(avgDoh)}d.`);
  }

  // ── MOVIMIENTOS 2+3 · adaptativos por pattern ──

  if (signals.pattern === "all_operational") {
    // Patrón homogéneo · narrativa anterior preservada (founder validó esta voz)
    const listParts = signals.items.map(fmtSku);
    movements.push(`Los SKUs son ${listParts.join(" · ")}.`);
    movements.push(`Liquidar o redirigir los ${N} libera ${totalStr} de capital inmovilizado. Es intervención inmediata sobre el inventario.`);
  } else if (signals.pattern === "mixed_operational_healthy") {
    // Distinguir subset operacional del healthy
    const opCount = signals.aggregate.operational_count;
    const opStockStr = _fmtMoneyK(signals.aggregate.operational_stockUSD / 1000);
    const opListParts = signals.operational_subset.map(fmtSku);
    const opVerb = opCount === 1 ? "es operacional" : `son operacionales`;
    movements.push(`${opCount} ${opVerb} con baja velocidad de conversión: ${opListParts.join(" · ")}. Liquidar o redirigir ${opCount === 1 ? "ese SKU" : `los ${opCount}`} libera ${opStockStr} de capital inmovilizado · intervención inmediata.`);

    // Nota sobre healthy subset
    const healthyList = signals.healthy_subset.map(fmtSku);
    const hVerb = signals.healthy_subset.length === 1 ? "está" : "están";
    const hVerb2 = signals.healthy_subset.length === 1 ? "está" : "están";
    movements.push(`${healthyList.join(" · ")} ${hVerb} acá por valor absoluto de stock · su rotación es saludable. NO ${signals.healthy_subset.length === 1 ? "requiere" : "requieren"} intervención · es capital trabajando.`);
  } else { // borderline_group
    const listParts = signals.items.map(fmtSku);
    movements.push(`Los SKUs son ${listParts.join(" · ")}.`);
    movements.push(`El grupo está en rango medio · ni claramente operacional ni claramente saludable. Sugerir drilldown por SKU para evaluar intervención individual.`);
  }

  // ── MOVIMIENTO 4 · Reframe founder · solo si pattern tiene componente operacional ──
  // M.B.3 v2: borderline_group NO recibe reframe (no hay caso de acción clara)
  if (signals.pattern !== "borderline_group" && EXECUTIVE_REFRAMES[signals.reframe_key]) {
    // Para mixed · el reframe se acota al subset operacional · NO al grupo completo
    if (signals.pattern === "mixed_operational_healthy") {
      const opCount = signals.aggregate.operational_count;
      movements.push(`El problema no parece ser la demanda en ${opCount === 1 ? "ese SKU" : `los ${opCount} operacionales`}; el capital está moviéndose más lento de lo que el negocio necesita.`);
    } else {
      movements.push(EXECUTIVE_REFRAMES[signals.reframe_key]);
    }
  }

  return movements.filter(m => m && m.length > 0).join("\n\n");
}

// ── HELPERS NARRATIVOS · composición selectiva por movimientos ───────────
//
// Cada helper recibe signals + posture y emite UNA frase (no un párrafo).
// La integración final (integrateMovements) ensambla con conectores fluidos.
//
// Decisión arquitectónica clave: NO usar plantillas rígidas "QUÉ: X. POR QUÉ: Y."
// Las frases se construyen frase a frase con sujeto + verbo + dato inline.

// composeOpeningDirect · apertura validate · dato + ancla
function composeOpeningDirect(signals) {
  const w = signals.what;
  if (!w) return "";
  const valStr = w.unit === "%" ? `${w.value.toFixed(1)}%` :
                 w.unit === "x" ? `${w.value.toFixed(1)}x` :
                 w.unit === "d" ? `${Math.round(w.value)}d` :
                 w.unit === "$" ? _fmtMoneyK(w.value) :
                 String(w.value);
  return `El ${_entityNoun(w.entityType)} con ${signals.direction === "best" ? "mejor" : "peor"} ${METRIC_LABEL[w.metricKey] || w.metric} es ${w.entity} · ${valStr}.`;
}

// composeOpeningReframe · apertura challenge · reframe interpretativo ANTES del dato
// RULE-VOICE-001: NO acusatorio absoluto ("el origen es interno"). USO interpretativo
// que invita a mirar antes de afirmar ("vale mirar adentro" / "podría no estar afuera").
// Voz: asesor senior · no auditor.
function composeOpeningReframe(signals) {
  const w = signals.what;
  const why = signals.why;
  if (!w || !why) return composeOpeningDirect(signals);
  const valStr = w.unit === "%" ? `${w.value.toFixed(1)}%` :
                 w.unit === "x" ? `${w.value.toFixed(1)}x` :
                 _fmtMoneyK(w.value);
  // Estructura interpretativa: "X es tu peor Y · Z%. Antes de mirar al cliente · vale mirar adentro."
  const adversative = why.origin === "internal" ? "Antes de mirar al cliente · vale mirar adentro"
                    : why.origin === "structural" ? "Antes de mirar al cliente · vale mirar la dependencia estructural"
                    : "Antes de mirar al cliente · vale revisar la causa";
  return `${w.entity} es tu ${signals.direction === "best" ? "mejor" : "peor"} ${METRIC_LABEL[w.metricKey] || w.metric} · ${valStr}. ${adversative}.`;
}

// composeOpeningHierarchy · apertura prioritize · jerarquía + cifras
function composeOpeningHierarchy(signals) {
  const w = signals.what;
  if (!w) return "";
  // signals viene con array · adaptar según composer
  if (signals.hierarchy && Array.isArray(signals.hierarchy)) {
    const topName = signals.hierarchy[0]?.name || "el mecanismo principal";
    return `La cartera presenta ${signals.hierarchy.length} ${signals.hierarchy.length === 1 ? "mecanismo activo" : "mecanismos activos"} · el más caro es ${topName}.`;
  }
  return composeOpeningDirect(signals);
}

// composeCausalMovement · movimiento 2 · POR QUÉ
// RULE-VOICE-002: sujeto = métrica/fenómeno · NO primera persona plural acusatoria.
// "Le aplicamos / aceptamos / decidimos" convierte al usuario en cómplice acusado.
// "La carga es X · N puntos sobre el promedio" = métrica habla · usuario observa.
function composeCausalMovement(why, posture) {
  if (!why || !why.driver) return "";
  const d = why.driver;
  if (d.factor === "carga_comercial") {
    // Sujeto = "La carga comercial sobre X" · no "Le aplicamos"
    const targetName = why.target_entity || d.target_entity || "";
    const targetClause = targetName ? `sobre ${targetName}` : "";
    const gapStr = d.vs_promedio > 0
      ? `${Math.abs(d.vs_promedio).toFixed(2)} puntos sobre el promedio interno`
      : `${Math.abs(d.vs_promedio).toFixed(2)} puntos bajo el promedio interno`;
    return `La carga comercial ${targetClause} es ${d.value.toFixed(1)}% · ${gapStr}.`.replace(/\s+/g, " ");
  }
  if (d.factor === "margen_unitario") {
    return `El margen unitario está ${d.vs_benchmark.toFixed(1)}pp bajo el benchmark de industria.`;
  }
  if (d.factor === "doh_alto") {
    return `El DOH acumula ${Math.round(d.value)} días · capital atrapado por baja velocidad de conversión.`;
  }
  return "";
}

// composeActionMovement · movimiento 3 · QUÉ HACER (con cifra y juicio)
function composeActionMovement(implication, posture) {
  if (!implication || !implication.action) return "";
  const a = implication.action;
  if (a.verb === "renegociar_carga_comercial") {
    // Decisión F1: cifras runtime reales + juicio de oportunidad si gap pequeño
    const recK = a.recoverable_K || 0;
    const recBPK = a.bestPractice_recoverable_K || 0;
    const promedio = `Si negociás esa carga al promedio interno (${a.target_carga}%) · son ${_fmtMoneyK(recK)} anuales recuperables`;
    const bestPractice = recBPK > recK
      ? ` · si la bajás a mejor práctica (3.0%) · ${_fmtMoneyK(recBPK)}`
      : "";
    // Si recK es pequeño (<50K) · plantear juicio de oportunidad explícito
    const judgment = recK < 50
      ? `. El gap es pequeño · evaluar si el monto justifica priorizar esta cuenta sobre otras.`
      : `.`;
    return promedio + bestPractice + judgment;
  }
  if (a.verb === "recuperar_margen_unitario") {
    const recK = a.recoverable_K || 0;
    return `Recuperar el margen unitario al benchmark libera ${_fmtMoneyK(recK)} anuales en contribución.`;
  }
  if (a.verb === "plan_de_salida") {
    const recK = a.recoverable_K || 0;
    return `Un plan de salida sobre ${a.target_entity} libera ${_fmtMoneyK(recK)} de capital inmovilizado.`;
  }
  if (a.verb === "liquidar") {
    const recK = a.recoverable_K || 0;
    return `Liquidar ${a.target_entity} libera ${_fmtMoneyK(recK)} de capital.`;
  }
  return "";
}

// composeReframeClosing · movimiento 4 (opcional · challenge)
function composeReframeClosing(reframeText) {
  if (!reframeText) return "";
  return reframeText;
}

// composeImplicationOnly · cuando no hay action específica · solo severidad
function composeImplicationOnly(implication, posture) {
  if (!implication) return "";
  if (implication.severity === "critica") return "Requiere intervención inmediata.";
  if (implication.severity === "atencion") return "Requiere seguimiento activo.";
  return "";
}

// _entityNoun · "cliente" / "SKU" / "producto"
function _entityNoun(entityType) {
  if (entityType === "client") return "cliente";
  if (entityType === "sku") return "SKU";
  return "ítem";
}

// integrateMovements · ensambla movimientos con conectores fluidos
//   movements: array de strings · pueden ser frases o párrafos cortos
//   posture: para ajustar densidad y conectores
function integrateMovements(movements, posture) {
  const clean = movements.filter(m => m && typeof m === "string" && m.trim().length > 0);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  // Para challenge · apertura · luego causal+acción en un párrafo · luego reframe closing
  // RULE-VOICE-003: el reframe del catálogo EXECUTIVE_REFRAMES es frase auto-contenida ·
  // NO forzar prefijo "La conversación que vale" · respetar texto exacto del catálogo.
  if (posture === "challenge") {
    const opener = clean[0];
    const middle = clean.slice(1, -1).join(" ");
    const closing = clean[clean.length - 1];
    if (middle) {
      return `${opener}\n\n${middle}\n\n${closing}`;
    }
    return `${opener}\n\n${closing}`;
  }
  // Default · separar por párrafos naturales
  return clean.join("\n\n");
}

// ── composeNarrativeResponse · composer narrativo principal ──────────────
function composeNarrativeResponse(signals, posture, ctx) {
  if (!signals || !VOICE_NARRATIVE_LAYER_ENABLED) return null;
  try {
    const movements = [];

    // MOVIMIENTO 1 · Apertura según postura
    if (posture === "challenge" && signals.implication?.counter_intuition) {
      movements.push(composeOpeningReframe(signals));
    } else if (posture === "prioritize") {
      movements.push(composeOpeningHierarchy(signals));
    } else {
      // validate · explore · default
      movements.push(composeOpeningDirect(signals));
    }

    // MOVIMIENTO 2 · Causalidad (solo si why existe)
    if (signals.why) {
      const causal = composeCausalMovement(signals.why, posture);
      if (causal) movements.push(causal);
    }

    // MOVIMIENTO 3 · Acción o implicación
    if (signals.implication?.action) {
      const action = composeActionMovement(signals.implication, posture);
      if (action) movements.push(action);
    } else if (signals.implication?.severity) {
      const imp = composeImplicationOnly(signals.implication, posture);
      if (imp) movements.push(imp);
    }

    // MOVIMIENTO 4 (opcional) · Reframe ejecutivo final
    if (posture === "challenge" && signals.implication?.reframe) {
      movements.push(composeReframeClosing(signals.implication.reframe));
    }

    return integrateMovements(movements, posture);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("BRIEF M composeNarrativeResponse error:", err);
    return null;
  }
}

// ── selectPosture · selector determinístico de postura ───────────────────
function selectPosture(intentType, signals, ctx) {
  // Reglas en orden de precedencia · NO probabilístico

  // 1 · Contraintuición gana · siempre challenge
  if (signals?.implication?.counter_intuition === true) {
    return "challenge";
  }

  // 2 · Severidad crítica + overview · prioritize
  if (signals?.implication?.severity === "critica" &&
      (intentType === "module" || intentType === "cross_domain_query")) {
    return "prioritize";
  }

  // 3 · Simulaciones · recommend (diferido a M.2 · placeholder)
  if (intentType === "simulation") {
    return "recommend";
  }

  // 4 · Mechanism scan / ranking · prioritize
  if (intentType === "cross_domain_query") {
    return "prioritize";
  }

  // 5 · Ad-hoc reasoning · validate (cifras pedidas explícitamente)
  if (intentType === "ad_hoc_reasoning") {
    return "validate";
  }

  // 6 · Ranking extremes · validate por default · challenge si causa interna
  if (intentType === "ranking_extremes" || intentType === "cross_metric_ranking") {
    return signals?.why?.origin === "internal" ? "challenge" : "validate";
  }

  // 7 · Honest fallback · explore (composer ya emite narrativa nativa)
  if (intentType === "global_honest_fallback") {
    return "explore";
  }

  // Default
  return "validate";
}

// ── applyVoiceCalibration · linter de voz sobre output narrativo ─────────
function applyVoiceCalibration(text, posture) {
  if (!text || typeof text !== "string") return text;
  let calibrated = text;

  // Eliminar hedges analista
  const HEDGE_PATTERNS = [
    /\bse\s+observa\s+que\s*/gi,
    /\bme\s+parece\s+que\s*/gi,
    /\bal\s+parecer\s*/gi,
    /\bpodr[ií]a\s+decirse\s+que\s*/gi,
    // Hedge "aproximadamente" solo si precede un número o símbolo $/€
    /\baproximadamente\s+(?=\$|\d)/gi,
  ];
  for (const pattern of HEDGE_PATTERNS) {
    calibrated = calibrated.replace(pattern, "");
  }

  // Eliminar disculpas
  const APOLOGY_PATTERNS = [/\bpor\s+favor\b/gi, /\bdisculpe\b/gi];
  for (const pattern of APOLOGY_PATTERNS) {
    calibrated = calibrated.replace(pattern, "");
  }

  // Eliminar emojis (rango unicode + dingbats)
  calibrated = calibrated.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, "");

  // Limpiar espacios dobles y leading whitespace en líneas
  calibrated = calibrated.replace(/[ \t]+/g, " ");
  calibrated = calibrated.replace(/\n /g, "\n");
  calibrated = calibrated.trim();

  return calibrated;
}

// ════════════════════════════════════════════════════════════════════════════
// BRIEF M.C · DISPATCHER NARRATIVE LAYER
//
// dispatchNarrativeComposer · routing por signals.kind hacia el composer
// narrativo correcto. Helper usado SOLO desde FASE 5 integration block.
// NO modifica composers M.A/M.B.* existentes · M.A LOCKED preservado.
//
// Mapeo:
//   cross_metric:true               → composeRankingExtremesNarrative (despacha internamente)
//   kind="mechanism_scan"           → composeMechanismScanNarrative (M.B.2)
//   kind="mechanism_ranking"        → composeMechanismRankingNarrative (M.B.2)
//   kind="client_deep_dive"         → composeClientDeepDiveNarrative (M.B.3)
//   kind="sku_deep_dive"            → composeSkuDeepDiveNarrative (M.B.3)
//   kind="sku_operational_group"    → composeSkuOperationalNarrative (M.B.3)
//   default (M.B.1 individual/grupo · sin kind) → composeRankingExtremesNarrative
//
// Composers que SKIP narrative_layer (M.B.4 fallback · M.B.5 QI) NO emiten
// signals · el guard previo en FASE 5 ya filtra esos casos.
// ════════════════════════════════════════════════════════════════════════════
function dispatchNarrativeComposer(signals, posture, ctx) {
  if (!signals) return null;
  // Cross-metric tiene su flag en signals · NO en .kind
  if (signals.cross_metric === true) {
    return composeRankingExtremesNarrative(signals, posture, ctx);
  }
  switch (signals.kind) {
    case "mechanism_scan":
      return composeMechanismScanNarrative(signals, posture, ctx);
    case "mechanism_ranking":
      return composeMechanismRankingNarrative(signals, posture, ctx);
    case "client_deep_dive":
      return composeClientDeepDiveNarrative(signals, posture, ctx);
    case "sku_deep_dive":
      return composeSkuDeepDiveNarrative(signals, posture, ctx);
    case "sku_operational_group":
      return composeSkuOperationalNarrative(signals, posture, ctx);
    // BRIEF N · 3 narrative composers nuevos (implementación en N.B.1/N.B.2/N.B.3)
    case "executive_action":
      return composeExecutiveActionNarrative(signals, posture, ctx);
    case "executive_opportunity":
      return composeHiddenOpportunityNarrative(signals, posture, ctx);
    case "executive_concern":
      return composeExecutiveConcernNarrative(signals, posture, ctx);
    default:
      // M.B.1 ranking individual + grupo · structure M.A-like · items[] o single
      return composeRankingExtremesNarrative(signals, posture, ctx);
  }
}

// ── _isStructuralCritical · regla de elevación nombrada (MATERIALITY v1) ──
function _isStructuralCritical(ax) {
  // Regla de elevación nombrada: cuenta estratégica (riesgo alto) Y deterioro activo (urgencia alta)
  return ax && ax.riesgo === "alto" && ax.urgencia === "alta";
}

// ── composeExecutiveActionNarrative · postura recommend · primera persona ──
function composeExecutiveActionNarrative(signals, posture, ctx) {
  if (!signals || signals.kind !== "executive_action") return null;
  if (!Array.isArray(signals.actions) || signals.actions.length === 0) return null;

  const actions = signals.actions;
  const movements = [];

  // MAT-VOZ · helpers de render PURO (no tocan jerarquía/ejes/detección/orden)
  const titleOf = (t) =>
    t === "commercial_load_renegotiation" ? "Recuperar margen en cuentas estratégicas" :
    t === "sku_operational_exit"          ? "Liberar capital inmovilizado" :
    t === "tier2_diversification"         ? "Reducir dependencia de cuentas concentradas" :
    "Movimiento prioritario";
  const fmtList = (arr) => !arr || arr.length === 0 ? "" :
    arr.length === 1 ? arr[0] :
    arr.length === 2 ? arr.join(" y ") :
    arr.slice(0, -1).join(" · ") + " y " + arr[arr.length - 1];
  // cuenta concentrada que opera bajo media benchmark (MISMA señal de deterioro · MAT-B3/C)
  const critClientOf = (a) => (a.entities || []).find(name => {
    const cm = applyScenarioToClientesMargen(signals.scenario).find(x => x.nombre === name);
    return cm && cm.margen != null && cm.margen < (cm.benchmark || 30.1) / 2;
  });

  // ── INTRO · materialidad (reemplaza la apertura en primera persona) ──
  movements.push(`Hay ${actions.length} ${actions.length === 1 ? "movimiento" : "movimientos"} que explican la mayor parte del resultado. Empezaría por este orden:`);

  // ── POR CADA acción (en orden de presentación · idéntico a build · la voz NO reordena) ──
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    const riesgoAlto = a.axes && a.axes.riesgo === "alto";
    const critico = _isStructuralCritical(a.axes);
    let body = "", reason = "";

    if (a.type === "commercial_load_renegotiation") {
      body = `${fmtList(a.entities)} operan con carga comercial sobre el estándar interno. Hay $${a.recoverable_K}K de margen anual recuperable (hasta $${a.recoverable_BP_K}K a mejor práctica).`;
      // jerarquía de razón · atada a riesgo alto (cuenta estratégica en juego) · NO fija
      if (riesgoAlto) {
        reason = critico
          ? ` Más importante aún: el deterioro toca cuentas estratégicas — no es solo rentabilidad, es proteger el valor de los principales clientes.`
          : ` Más importante aún: toca cuentas estratégicas (Tier 1) — no es solo rentabilidad, es el valor de los principales clientes.`;
      }
    } else if (a.type === "sku_operational_exit") {
      const verbo = (a.entities && a.entities.length === 1) ? "mantiene" : "mantienen";
      body = `${fmtList(a.entities)} ${verbo} ${a.avg_doh} días de cobertura y $${a.recoverable_K}K de capital detenido.`;
      // inventario es riesgo bajo · sin jerarquía de razón (atado a señal · no se inventa urgencia)
    } else if (a.type === "tier2_diversification") {
      body = `${a.entities.slice(0, 3).join(" · ")} concentran ${a.concentration_pct}% del negocio · $${a.exposed_M}M de contribución expuesta.`;
      // jerarquía de razón SOLO cuando la concentración se volvió crítica (elevación · atada a señal)
      if (critico) {
        const cc = critClientOf(a);
        reason = cc
          ? ` Más importante aún: el riesgo dejó de ser latente — ${cc} opera bajo media benchmark.`
          : ` Más importante aún: el riesgo de concentración dejó de ser latente.`;
      }
    } else {
      body = `${a.criterion}. Cifra clave $${a.recoverable_K}K.`;
    }

    // DECISIÓN · imperativo de cierre derivado de a.verb
    movements.push(`${i + 1}. ${titleOf(a.type)}. ${body}${reason} Decisión: ${a.verb}.`);
  }

  // ── LECTURA EJECUTIVA · reconstruye el criterio que ordenó (lee el #1 · NO toca _compareByHierarchy) ──
  const lead = actions[0];
  if (_isStructuralCritical(lead.axes)) {
    const cc = critClientOf(lead) || fmtList(lead.entities);
    movements.push(`La prioridad la define el riesgo, no el monto: ${cc} se está deteriorando y es cuenta estratégica. Por eso encabeza, aunque no sea la cifra más grande.`);
  } else {
    movements.push(`La prioridad no la define el monto más grande, sino la combinación de impacto, urgencia y capacidad de acción. ${titleOf(lead.type)} encabeza porque genera valor directo y puede ejecutarse ahora.`);
  }

  // ── HORIZONTE · SOLO si hay structural NO elevado al final (atado a señal · no fijo) ──
  // ── SÍNTESIS · conectar oportunidades que comparten entidad (firmado · solo si dato lo respalda) ──
  // Nivel 1: entidad compartida entre oportunidades de CLIENTE (carga ↔ concentración · mismo espacio
  // de nombres). Inventario (SKUs) queda fuera por naturaleza · no se fuerza vínculo.
  const _clientActions = actions.filter(a =>
    a.type === "commercial_load_renegotiation" || a.type === "tier2_diversification");
  if (_clientActions.length >= 2) {
    // intersección de entities entre las oportunidades de cliente
    const _sets = _clientActions.map(a => new Set(a.entities || []));
    const _shared = [...(_sets[0] || [])].filter(name => _sets.every(s => s.has(name)));
    if (_shared.length > 0) {
      const _list = _shared.length === 1 ? _shared[0]
        : _shared.slice(0, -1).join(", ") + " y " + _shared[_shared.length - 1];
      // Nivel 2 · causa común: ¿las oportunidades compartidas están elevadas por la misma entidad?
      const _ambasElevadas = _clientActions.every(a => _isStructuralCritical(a.axes));
      if (_ambasElevadas) {
        movements.push(`${_list} cruzan dos frentes a la vez: su carga comercial y la dependencia que genera. El mismo deterioro está elevando las dos — no son problemas separados, son la misma relación bajo presión.`);
      } else {
        movements.push(`${_list} aparecen en dos frentes: renegociar su carga y reducir la dependencia de esa cuenta. Son la misma relación comercial vista desde la rentabilidad y desde el riesgo.`);
      }
    }
  }

  const structuralPendiente = actions.find(a => a.controllability_tag === "baja" && !_isStructuralCritical(a.axes));
  if (structuralPendiente) {
    movements.push(`La concentración es el mayor riesgo en tamaño, pero su horizonte es de 12-18 meses: se aborda en paralelo, no antes que lo inmediato.`);
  }

  return movements.join("\n\n");
}

// composeHiddenOpportunityNarrative · postura recommend · provocación
function composeHiddenOpportunityNarrative(signals, posture, ctx) {
  if (!signals || signals.kind !== "executive_opportunity") return null;
  if (!signals.hidden_angle) return null; // defensive · signals incompletos
  const ang = signals.hidden_angle;
  const seenLabel = signals.context_seen?.label;
  const movements = [];

  // ── APERTURA · "Estás mirando X · pero hay un ángulo que no aparece..." ──
  // Si ctx vacío (regla 5) · apertura sin "estás mirando X" (no hay X que mirar)
  let opener;
  if (ang.rule === "default_ctx_empty" || !seenLabel) {
    opener = `Hay un ángulo del negocio que no aparece naturalmente en las consultas obvias: ${_hiddenAngleNoun(ang.dimension)}.`;
  } else {
    opener = `Estás mirando ${seenLabel} · pero hay un ángulo que no aparece en tus consultas: ${_hiddenAngleNoun(ang.dimension)}.`;
  }
  movements.push(opener);

  // ── MOVIMIENTO 2 · Cifra contrastante ──
  let cifraBlock = null;
  if (ang.reveal === "quality_growth_deterioration") {
    cifraBlock = `${ang.instances_count} cuentas crecen entre +${ang.growth_min}% y +${ang.growth_max}% YoY · suena bien · pero capturan ese crecimiento a costa de margen unitario. Son $${ang.cifra_M}M de contribución que se pierde frente al benchmark · más que cualquier driver comercial individual.`;
  } else if (ang.reveal === "customer_dependency_risk") {
    const names = ang.top3_names.join(" · ");
    cifraBlock = `${names} concentran ${ang.concentration_pct}% del negocio y $${ang.exposed_M}M de contribución expuesta. Una salida simultánea de los 3 borra cerca de la mitad de la rentabilidad operativa.`;
  } else if (ang.reveal === "sku_operational") {
    const skuList = ang.sku_names.length === 1
      ? ang.sku_names[0]
      : ang.sku_names.slice(0, -1).join(" · ") + " y " + ang.sku_names[ang.sku_names.length - 1];
    cifraBlock = `${ang.instances_count === 1 ? "1 SKU concentra" : ang.instances_count + " SKUs concentran"} $${ang.capital_K}K de stock con DOH promedio ${ang.avg_doh} días: ${skuList}. Capital que no rota · que podría reinvertirse en SKUs rotacionales.`;
  } else if (ang.reveal === "commercial_erosion") {
    cifraBlock = `${ang.instances_count} cuentas operan con carga comercial sobre el promedio interno · $${ang.recuperable_K}K anuales recuperables al promedio · $${(ang.recuperable_BP_M * 1000).toFixed(0)}K si baja a mejor práctica (3.0%). Es la palanca operativa de mayor impacto · NO se ve mirando solo inventario.`;
  }
  if (cifraBlock) movements.push(cifraBlock);

  // ── MOVIMIENTO 3 · Provocación específica del reframe ──
  // hidden_blind_spot (R1+R5) ya es la provocación contextual.
  // Para R2/R3/R4 · agregamos provocación inline antes del reframe del catálogo.
  let provocationBlock = null;
  if (ang.reveal === "customer_dependency_risk") {
    provocationBlock = `La performance individual de cada cliente la estás viendo. La dependencia que generan en conjunto · no.`;
  } else if (ang.reveal === "sku_operational") {
    provocationBlock = `Los rankings comerciales los estás viendo. El capital atrapado en inventario · no.`;
  } else if (ang.reveal === "commercial_erosion") {
    provocationBlock = `La rotación operativa la estás viendo. La carga comercial que erosiona margen en clientes grandes · no.`;
  }
  if (provocationBlock) movements.push(provocationBlock);

  // ── MOVIMIENTO 4 · Reframe del catálogo (firmado founder D-N.B.2-3) ──
  const reframe = EXECUTIVE_REFRAMES[signals.reframe_key];
  if (reframe) movements.push(reframe);

  // ── CIERRE · "Esa es la oportunidad ignorada" si aplica ──
  // Solo cuando el reframe NO cierra naturalmente (R2/R3/R4 reframes M.A son
  // más densos · cierre adicional refuerza el punto). Para R1/R5 con
  // hidden_blind_spot el reframe YA es la provocación final · NO duplicar.
  if (signals.reframe_key !== "hidden_blind_spot") {
    movements.push("Esa es la oportunidad ignorada.");
  }

  return movements.join("\n\n");
}

// Helper léxico · dimension key → noun ejecutivo en español
function _hiddenAngleNoun(dimensionKey) {
  const map = {
    "calidad_crecimiento":           "calidad de crecimiento",
    "concentración_estructural":     "concentración estructural en Tier 1",
    "capital_operacional_atrapado":  "capital operacional atrapado",
    "erosión_comercial":             "erosión comercial sobre clientes grandes",
  };
  return map[dimensionKey] || dimensionKey;
}

// Horizon labels (D-N.B.3-4):
//   inmediato → "corto plazo"
//   medio     → "mediano plazo"
//   largo     → "estructural"
const _CONCERN_HORIZON_LABEL = {
  inmediato: "corto plazo",
  medio:     "mediano plazo",
  largo:     "estructural",
};

// Helper · mapeo horizon → frase "horizonte de X" para cierre narrativo
const _CONCERN_HORIZON_PHRASE = {
  inmediato: "meses",
  medio:     "trimestres",
  largo:     "años",
};

// _renderConcernBody · template body por mecanismo (D-N.B.3-1: reframes M.A/M.B.2 reutilizados)
// La frase "deuda silenciosa" va EMBEDIDA en el body de customer_dependency · NO reframe nuevo.
function _renderConcernBody(concern) {
  const c = concern.cifras;
  if (concern.mechanism === "commercial_erosion") {
    const bp_K = Math.round((c.recuperable_BP_M || 0) * 1000);
    return `${c.instances_count} cuentas operan con carga comercial sobre el promedio interno · $${c.recuperable_K}K anuales recuperables al promedio · $${bp_K}K si baja a mejor práctica (3.0%). Es la palanca operativa de mayor impacto · cuanto más se sostiene · más naturaliza el cliente el descuento.`;
  }
  if (concern.mechanism === "quality_of_growth_deterioration") {
    const isSingleton = c.instances_count === 1;
    const rangeStr = c.growth_min === c.growth_max
      ? `+${c.growth_min}% YoY`
      : `entre +${c.growth_min}% y +${c.growth_max}% YoY`;
    const cuentasStr = isSingleton ? "1 cuenta crece" : `${c.instances_count} cuentas crecen`;
    return `${cuentasStr} ${rangeStr} · pero capturando ese crecimiento a costa de margen unitario. Son $${c.contribucion_perdida_M}M de contribución que se pierde frente al benchmark. Es el patrón clásico de "vende más · gana menos" · que se vuelve irreversible cuando el cliente naturaliza el descuento.`;
  }
  if (concern.mechanism === "customer_dependency_risk") {
    const names = (c.top3_names || []).join(" · ");
    // "Deuda silenciosa" embedida en el template body (D-N.B.3-1)
    return `${names} concentran ${c.concentration_pct}% del negocio y $${c.exposed_M}M de contribución expuesta. Una salida simultánea de los 3 borra cerca de la mitad de la rentabilidad operativa. No es plausible mañana · pero no tener un plan de Tier 2 ya activo es la deuda silenciosa: no se siente hasta que vence.`;
  }
  return null;
}

// composeExecutiveConcernNarrative · postura recommend · dimensión temporal
function composeExecutiveConcernNarrative(signals, posture, ctx) {
  if (!signals || signals.kind !== "executive_concern") return null;
  if (!Array.isArray(signals.concerns) || signals.concerns.length === 0) return null;

  const concerns = signals.concerns;
  const movements = [];

  // ── APERTURA · primera persona ejecutiva ──
  const opener = concerns.length === 1
    ? "Si esta fuera mi empresa · me preocuparía una cosa."
    : `Si esta fuera mi empresa · me preocuparían ${concerns.length === 2 ? "dos" : concerns.length} cosas.`;
  movements.push(opener);

  // ── MOVIMIENTO 2 · cada concern con dimensión temporal + body + reframe ──
  const ordinals = ["Lo primero", "Lo segundo"];
  for (let i = 0; i < concerns.length; i++) {
    const concern = concerns[i];
    const ordinal = ordinals[i] || `Lo ${i + 1}°`;
    const horizonLabel = _CONCERN_HORIZON_LABEL[concern.horizon] || concern.horizon;
    const body = _renderConcernBody(concern);
    const reframe = EXECUTIVE_REFRAMES[concern.reframe_key];
    // Estructura: "Lo primero es [horizon]: [body]. [reframe]"
    let block = `${ordinal} es ${horizonLabel}: ${body}`;
    if (reframe) block += `\n\n${reframe}`;
    movements.push(block);
  }

  // ── CIERRE · primera persona ejecutiva con dimensión temporal explícita ──
  if (concerns.length === 2) {
    const phrase1 = _CONCERN_HORIZON_PHRASE[concerns[0].horizon] || concerns[0].horizon;
    const phrase2 = _CONCERN_HORIZON_PHRASE[concerns[1].horizon] || concerns[1].horizon;
    movements.push(`Yo vigilaría esos dos frentes · uno en horizonte de ${phrase1} · el otro en horizonte de ${phrase2}.`);
  } else if (concerns.length === 1) {
    const phrase1 = _CONCERN_HORIZON_PHRASE[concerns[0].horizon] || concerns[0].horizon;
    movements.push(`Yo vigilaría ese frente · horizonte de ${phrase1}.`);
  }

  return movements.join("\n\n");
}

export {
  dispatchNarrativeComposer,
  selectPosture,
  applyVoiceCalibration,
  composeNarrativeResponse,
  composeRankingExtremesNarrative,
  composeMechanismScanNarrative,
  composeMechanismRankingNarrative,
  composeClientDeepDiveNarrative,
  composeSkuDeepDiveNarrative,
  composeSkuOperationalNarrative,
  composeExecutiveActionNarrative,
  composeHiddenOpportunityNarrative,
  composeExecutiveConcernNarrative,
};
