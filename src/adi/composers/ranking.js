/* === adi/composers/ranking.js ===
 * Composer de ancla extraído de 41cc33d8 · verbatim · solo imports agregados. */
import { RANKING_EXTREMES_METRICS } from "../../config/rankingData.js";
import { ADI_RANKING_WITH_METRICS_ENABLED, VOICE_NARRATIVE_LAYER_ENABLED, VOICE_RANKING_EXTREMES_ENABLED } from "../../config/voiceFlags.js";
import { skusMargen } from "../../data/skusMargen.js";
import { applyScenarioToClientesMargen, applyScenarioToSkuInventario } from "../../engine/scenarios.js";
import { buildReframe, buildSuggestedAction, calculateRecoverable, classifySeverity, detectInternalDriver } from "../../engine/signals.js";
import { buildResponseContract, filterTextualSuggestions } from "../helpers.js";
import { _buildEntityId, _detectMetricInText, _normalizeSemanticText } from "../router.js";

export function composeHonestUnavailable(reason, moduleContext) {
  const moduleSuggestions = {
    inventario: [
      "¿Qué SKUs están atrapando más capital?",
      "¿Cuál es la rotación promedio del portafolio?",
      "¿Cuáles SKUs tienen mayor desalineación?",
    ],
    margenes: [
      "¿Qué clientes erosionan el margen?",
      "¿Cuál es el benchmark actual?",
      "¿Quién aporta más contribución?",
    ],
    ventas: [
      "¿Qué clientes crecen vs año anterior?",
      "¿Quiénes están bajo presupuesto?",
      "¿Cómo viene el GAP del módulo?",
    ],
  };
  const suggestions = moduleSuggestions[moduleContext] || moduleSuggestions.inventario;
  return {
    opener: `Para esa pregunta específica no puedo darte un cálculo directo · ${reason}\n\n¿Querés que profundice en alguno en particular?`,
    // BRIEF N-bis · Tipo A puro · suggestions filtradas
    suggestions: filterTextualSuggestions(suggestions),
    sentrixAction: null,
  };
}

export function _rwmDetectPrincipalAnexa(trimmed, entityType) {
  try {
    if (typeof ADI_RANKING_WITH_METRICS_ENABLED === "undefined" || !ADI_RANKING_WITH_METRICS_ENABLED) return null;
    const n = _normalizeSemanticText(trimmed);
    if (!n) return null;
    // exige una conjunción de anexo: "y" (que introduzca una 2da métrica)
    if (!/\by\b/.test(n)) return null;
    // patrones de métrica en orden de aparición (posición en la frase)
    const METRIC_RE = [
      { key: "ventas",       re: /\b(ventas|venta|venden|vende|facturaci[oó]n|facturan|factura)\b/g },
      { key: "contribucion", re: /\b(contribuci[oó]n|aporte|aportan|aporta)\b/g },
      { key: "margen",       re: /\b(margen|rentabilidad)\b/g },
      { key: "carga",        re: /\b(carga|rebate)\b/g },
    ];
    // recolectar todas las menciones con su índice de posición
    const hits = [];
    for (const m of METRIC_RE) {
      let mm;
      const re = new RegExp(m.re.source, "g");
      while ((mm = re.exec(n)) !== null) hits.push({ key: m.key, idx: mm.index });
    }
    if (hits.length < 2) return null;
    // ordenar por posición · la primera es principal, la siguiente DISTINTA es anexa
    hits.sort((a, b) => a.idx - b.idx);
    const principalBase = hits[0].key;
    let anexaBase = null;
    for (let i = 1; i < hits.length; i++) { if (hits[i].key !== principalBase) { anexaBase = hits[i].key; break; } }
    if (!anexaBase) return null;
    // verificar que entre la principal y la anexa haya una "y" (conjunción de anexo · no dos
    // métricas sueltas sin conectar). Tomamos la subcadena entre ambas posiciones.
    const pIdx = hits[0].idx;
    const aIdx = hits.find(h => h.key === anexaBase).idx;
    const between = n.slice(Math.min(pIdx, aIdx), Math.max(pIdx, aIdx));
    if (!/\by\b/.test(between)) return null;
    // mapear a keys del catálogo según entityType (sku usa sku_*)
    const toKey = (base) => {
      if (entityType === "sku" && (base === "margen" || base === "contribucion")) return "sku_" + base;
      return base;
    };
    const principal = toKey(principalBase);
    const anexa = toKey(anexaBase);
    if (principal === anexa) return null;
    // ambas deben existir en el catálogo y ser del entityType
    // excepción: ventas anexa para sku (el field `venta` existe en skusMargen aunque no haya
    // entrada sku_ventas en el catálogo · el composer lo resuelve · NO inventa)
    if (!RANKING_EXTREMES_METRICS[principal] || RANKING_EXTREMES_METRICS[principal].entityType !== entityType) return null;
    const anexaOk = (RANKING_EXTREMES_METRICS[anexa] && RANKING_EXTREMES_METRICS[anexa].entityType === entityType)
      || (anexa === "ventas" && entityType === "sku");
    if (!anexaOk) return null;
    return { principal, anexa };
  } catch (e) { return null; }
}

export function _detectEntityTypeInText(normalizedText) {
  const n = normalizedText;
  // Exclusión R2 · si menciona "mecanismo" · no es ranking-extremes
  if (/\b(mecanismo|mecanismos)\b/.test(n)) return null;
  if (/\b(cliente|clientes|cuenta|cuentas)\b/.test(n)) return "client";
  if (/\b(sku|skus|producto|productos|item|items|articulo|articulos)\b/.test(n)) return "sku";
  return null;
}

export function _detectTopNInText(normalizedText) {
  const n = normalizedText;
  // Número explícito: "los 3 peores", "los 5 mejores", "3 peores"
  const numMatch = n.match(/\b(?:los|las)?\s*(\d+)\s+(?:peor|peores|mejor|mejores|mas|menor|menores|mayor|mayores)\b/);
  if (numMatch) {
    const n_int = parseInt(numMatch[1], 10);
    if (!Number.isNaN(n_int) && n_int >= 1 && n_int <= 50) return n_int;
  }
  // Plural sin número: "los peores clientes", "los mejores SKUs"
  if (/\b(los|las)\s+(peores|mejores|menores|mayores)\b/.test(n)) return 3;
  // Singular default
  return 1;
}

export function _detectCrossMetricInText(normalizedText, entityTypeHint) {
  const n = normalizedText;
  // Patrón 1 · "del top N contribución" / "del top contribución" / "del top 3"
  const topMatch = n.match(/\b(?:del?|entre)\s+(?:el\s+)?top\s*(\d+)?\s*(\w+)?/);
  if (topMatch) {
    const rankN = topMatch[1] ? parseInt(topMatch[1], 10) : 3;
    // Tratar de detectar la métrica que acompaña al "top".
    // PRIORIDAD: si topMatch[2] tiene una palabra · resolverla AISLADAMENTE
    // primero · evita que la métrica del sort-side ("peor margen") gane la
    // detección al precederla en el orden de tests del _detectMetricInText.
    const remainder = topMatch[2] ? topMatch[2] : "";
    let rankMetric = null;
    if (remainder) {
      rankMetric = _detectMetricInText(remainder, entityTypeHint);
    }
    if (!rankMetric) {
      // Fallback · escanear texto completo (puede capturar la métrica equivocada
      // en queries muy ambiguas · pero es la mejor heurística sin parser)
      rankMetric = _detectMetricInText(n, entityTypeHint);
    }
    if (rankMetric && rankN >= 1 && rankN <= 50) {
      return { rankMetric, rankDirection: "best", rankN };
    }
  }
  // Patrón 2 · "entre los de mayor X" / "de los con mayor X"
  const mayorMatch = n.match(/\b(?:entre\s+los|de\s+los\s+con|de\s+las\s+con)\s+(?:mayor|mas\s+alta?o?s?|mas)\s+(\w+)/);
  if (mayorMatch) {
    const rankMetric = _detectMetricInText(mayorMatch[1], entityTypeHint);
    if (rankMetric) {
      return { rankMetric, rankDirection: "best", rankN: 3 };
    }
  }
  return null;
}

export function _buildScopeForMetric(metricKey, scenarioId) {
  const spec = RANKING_EXTREMES_METRICS[metricKey];
  if (!spec) return null;
  if (spec.source === "clientesMargen") {
    // 13 clientes raw · sin truncamiento PROTECTED_CLIENTS
    return applyScenarioToClientesMargen(scenarioId).filter(c => c.tipo === "cliente");
  }
  if (spec.source === "skuInventario") {
    return applyScenarioToSkuInventario(scenarioId);
  }
  if (spec.source === "skusMargen") {
    // skusMargen no tiene scenario transform · usar raw
    return skusMargen.filter(s => s.tipo === "sku");
  }
  return null;
}

export function _getEntityNameField(metricKey) {
  const spec = RANKING_EXTREMES_METRICS[metricKey];
  if (!spec) return "nombre";
  if (spec.source === "skuInventario") return "sku";
  return "nombre";
}

export function _formatMetricValue(value, metricKey) {
  const spec = RANKING_EXTREMES_METRICS[metricKey];
  if (!spec || value == null || isNaN(value)) return String(value);
  if (spec.unit === "%") return `${value.toFixed(1)}%`;
  if (spec.unit === "x") return `${value.toFixed(1)}x`;
  if (spec.unit === "d") return `${Math.round(value)}d`;
  if (spec.unit === "$") {
    // Heurística escala: ≥1000 → K · ≥1M → M
    if (value >= 1000) return `$${(value/1000).toFixed(2)}M`;
    return `$${Math.round(value)}K`;
  }
  return String(value);
}

export function detectRankingExtremesIntent(text, ctx) {
  if (!VOICE_RANKING_EXTREMES_ENABLED) return null;
  if (!text || typeof text !== "string") return null;

  const normalized = text.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!]/g, "")
    .trim();

  // Tokens worst/best (NO incluye "top" por H4-fix)
  // FIX_L_PRECEDENCE · eliminados mayor/menor/mayores/menores de los patterns.
  // Razón: queries tipo "clientes con mayor contribución" / "SKUs con menor
  // rotación" son retrieval ranked legítimo de QI o paths Ferrari · ranking-
  // extremes debe interceptar SOLO formas extremas explícitas (peor / mejor /
  // máximo / mínimo / más baja / más alta). Sin esta restricción · ranking-
  // extremes corriendo PRE-QI robaría queries QI legítimas. Trade-off
  // consciente: el caso "el cliente con menor margen" queda delegado a QI
  // (deuda #D-MENOR-MAYOR-DELEGADOS-A-QI-INTERPRETA-COMO-BEST).
  // Cubre masculino y femenino: bajo/baja/bajos/bajas · alto/alta/altos/altas
  const worstPatterns = /\b(peor|peores|mas\s+baj[oa]s?|minimo|ultimo|ultimos)\b/;
  const bestPatterns  = /\b(mejor|mejores|mas\s+alt[oa]s?|maximo|primero|primeros)\b/;
  const isWorst = worstPatterns.test(normalized);
  const isBest  = bestPatterns.test(normalized);
  if (!isWorst && !isBest) return null;

  // EntityType · primero intentamos detección explícita
  let entityType = _detectEntityTypeInText(normalized);

  // Si no hay entityType explícito · intentamos inferir desde la métrica:
  // métricas client-only (contribucion, margen, ventas, carga) → client
  // métricas sku-only (rotacion, cobertura, doh, stockUSD, sku_*) → sku
  let metric = _detectMetricInText(normalized, entityType);
  if (!entityType && metric) {
    const spec = RANKING_EXTREMES_METRICS[metric];
    if (spec) entityType = spec.entityType;
  }
  if (!entityType) return null;

  // Re-resolver métrica con entityType ya conocido (mejora desambiguación
  // margen → sku_margen vs margen según hint)
  metric = _detectMetricInText(normalized, entityType);
  if (!metric) return null;

  // Validar que el metric pertenece al entityType correcto
  const spec = RANKING_EXTREMES_METRICS[metric];
  if (!spec || spec.entityType !== entityType) return null;

  // Detectar cross-metric primero (patrón "del top X tiene peor Y")
  const cross = _detectCrossMetricInText(normalized, entityType);
  if (cross) {
    // Validar que rankMetric también es válido para el entityType
    const rankSpec = RANKING_EXTREMES_METRICS[cross.rankMetric];
    if (rankSpec && rankSpec.entityType === entityType) {
      return {
        type: "cross_metric_ranking",
        rankMetric: cross.rankMetric,
        rankDirection: cross.rankDirection,
        rankN: cross.rankN,
        sortMetric: metric,
        sortDirection: isWorst ? "worst" : "best",
        entityType,
      };
    }
  }

  // Familia A · ranking extremes simple
  const topN = _detectTopNInText(normalized);
  return {
    type: "ranking_extremes",
    direction: isWorst ? "worst" : "best",
    metric,
    entityType,
    topN,
  };
}

export function _filterScopeByEntities(scope, inheritedEntities, nameField) {
  if (!Array.isArray(scope) || !Array.isArray(inheritedEntities)) return scope;
  const set = new Set(inheritedEntities);
  return scope.filter(item => set.has(item[nameField]));
}

export function composeRankingExtremes({
  direction,
  metric,
  entityType,
  topN,
  scope,
  ctx,
  inheritedScope,
  anexaMetric,
}) {
  // Validación
  const spec = RANKING_EXTREMES_METRICS[metric];
  if (!spec || spec.entityType !== entityType) {
    const moduleCtx = entityType === "client" ? "margenes" : "inventario";
    return composeHonestUnavailable("la métrica solicitada no aplica a la dimensión consultada.", moduleCtx);
  }

  // FIX #D-RANKING-WITH-METRICS · resolver la métrica anexa (mostrar, NO ordenar).
  // El sort queda atado a `spec` (la principal · sin cambios). La anexa solo se lee para
  // mostrar la columna. Si no resuelve a un field trazable del mismo entityType → no se
  // muestra (I-RWM-NO-INVENTA). NUNCA entra al comparador (I-RWM-ORDEN).
  let anexaSpec = null;
  if (typeof ADI_RANKING_WITH_METRICS_ENABLED !== "undefined" && ADI_RANKING_WITH_METRICS_ENABLED
      && anexaMetric && anexaMetric !== metric) {
    let _as = RANKING_EXTREMES_METRICS[anexaMetric];
    // ventas anexa para sku: el catálogo no tiene sku_ventas, pero skusMargen tiene el field
    // `venta` (trazable). Sintetizamos un spec mínimo del mismo entityType (NO inventa: el
    // field existe en el dataset). Solo para mostrar · nunca para ordenar.
    if (!_as && anexaMetric === "ventas" && entityType === "sku") {
      _as = { entityType: "sku", field: "venta", unit: "$" };
    }
    if (_as && _as.entityType === entityType) anexaSpec = _as;
  }

  // Dataset base
  let dataset = scope || _buildScopeForMetric(metric, ctx?.scenarioId);
  if (!Array.isArray(dataset) || dataset.length === 0) {
    return composeHonestUnavailable("no hay datos disponibles en el escenario activo.", spec.domain);
  }

  // Si hay scope heredado · filtrar
  const nameField = _getEntityNameField(metric);
  if (Array.isArray(inheritedScope) && inheritedScope.length > 0) {
    dataset = _filterScopeByEntities(dataset, inheritedScope, nameField);
    if (dataset.length === 0) {
      return composeHonestUnavailable("las entidades referidas no se encuentran en el dataset activo.", spec.domain);
    }
  }

  // Sort estable con tiebreaker alfabético (V7)
  const sorted = [...dataset].sort((a, b) => {
    const va = a[spec.field];
    const vb = b[spec.field];
    if (va == null || isNaN(va)) return 1;
    if (vb == null || isNaN(vb)) return -1;
    const primary = direction === "worst" ? (va - vb) : (vb - va);
    if (primary !== 0) return primary;
    // Tiebreaker: alfabético por nameField
    return String(a[nameField]).localeCompare(String(b[nameField]));
  });

  const selected = sorted.slice(0, Math.max(1, topN));
  const moduleCtx = spec.domain;

  // Verbalización direction
  const directionWord = direction === "worst" ? "peor" : "mejor";
  const directionPlural = direction === "worst" ? "peores" : "mejores";
  const entityNoun = entityType === "client" ? "cliente" : "SKU";
  const entityNounPlural = entityType === "client" ? "clientes" : "SKUs";

  // Opener
  let opener;
  if (selected.length === 1) {
    const e = selected[0];
    const val = _formatMetricValue(e[spec.field], metric);
    opener = `El ${entityNoun} con ${directionWord} ${_metricNounEs(metric)} es ${e[nameField]} · ${val}.`;
    // FIX #D-RANKING-WITH-METRICS · anexa al lado (no reordena)
    if (anexaSpec) {
      const aval = _formatMetricValue(e[anexaSpec.field], anexaMetric);
      if (aval != null && aval !== "") {
        opener += ` Su ${_metricNounEs(anexaMetric)} es ${aval}.`;
      }
    }

    // Anclaje contextual cuando hay benchmark / mejor práctica conocida
    if (metric === "margen" && e.benchmark != null) {
      const gap = Math.abs(e.benchmark - e.margen).toFixed(1);
      const dir = e.margen < e.benchmark ? "bajo" : "sobre";
      opener += `\n\n${e[nameField]} opera ${gap}pp ${dir} el benchmark de industria (${e.benchmark}%).`;
      if (e.pctRebate != null) {
        opener += ` Su carga comercial es ${e.pctRebate.toFixed(1)}%.`;
      }
    } else if (metric === "rotacion" && e.doh != null) {
      opener += `\n\n${e[nameField]} acumula ${e.doh}d de DOH · señal de baja velocidad de conversión.`;
    } else if (metric === "stockUSD" && e.doh != null) {
      opener += `\n\n${e[nameField]} concentra capital con ${e.doh}d de cobertura.`;
    }
    opener += `\n\n*Confianza alta · cálculo determinístico sobre dataset runtime.*`;
  } else {
    // topN ≥ 2 · listado
    const _anexaHdr = anexaSpec ? ` (con ${_metricNounEs(anexaMetric)})` : "";
    opener = `Los ${selected.length} ${directionPlural} ${entityNounPlural} por ${_metricNounEs(metric)}${_anexaHdr}:\n\n`;
    selected.forEach((e, i) => {
      const val = _formatMetricValue(e[spec.field], metric);
      let line = `${i + 1}. ${e[nameField]} · ${val}`;
      // FIX #D-RANKING-WITH-METRICS · columna anexa (no reordena · el sort es por la principal)
      if (anexaSpec) {
        const aval = _formatMetricValue(e[anexaSpec.field], anexaMetric);
        if (aval != null && aval !== "") line += ` · ${_metricNounEs(anexaMetric)} ${aval}`;
      }
      opener += line + `\n`;
    });
    opener += `\n*Confianza alta · cálculo determinístico sobre dataset runtime.*`;
  }

  // Sentrix action · decisión D7
  const moduleChip = moduleCtx === "margenes" ? "Márgenes"
                   : moduleCtx === "ventas"    ? "Ventas"
                   : "Inventario";
  let sentrixAction;
  if (selected.length === 1) {
    const e = selected[0];
    sentrixAction = {
      label: `Ver ${e[nameField]} en ${moduleChip}`,
      moduleChip,
      payload: {
        modulo: moduleCtx,
        clientes: entityType === "client" ? [e[nameField]] : [],
        skus:     entityType === "sku"    ? [e[nameField]] : [],
        mechanismBanner: `${directionWord.charAt(0).toUpperCase() + directionWord.slice(1)} ${entityNoun} por ${_metricNounEs(metric)}`,
      },
    };
  } else {
    sentrixAction = {
      label: `Ver ${selected.length} ${entityNounPlural} en ${moduleChip}`,
      moduleChip,
      payload: {
        modulo: moduleCtx,
        clientes: entityType === "client" ? selected.map(e => e[nameField]) : [],
        skus:     entityType === "sku"    ? selected.map(e => e[nameField]) : [],
        mechanismBanner: `${selected.length} ${directionPlural} ${entityNounPlural} por ${_metricNounEs(metric)}`,
      },
    };
  }

  // Suggestions · BRIEF N-bis · vacías
  const suggestions = filterTextualSuggestions([]);

  // ── BRIEF M.B.1 · narrative_signals + posture_hint (spread D2) ──
  // Bajo flag OFF · ambos quedan null · return bitwise equivalente al legacy.
  let narrative_signals = null;
  let posture_hint = "validate";
  if (VOICE_NARRATIVE_LAYER_ENABLED) {
    try {
      narrative_signals = buildNarrativeSignalsForRankingExtremes(
        selected, direction, metric, entityType, dataset
      );
      // posture_hint: challenge si hay driver interno en el #1 · else validate
      const headSignals = Array.isArray(narrative_signals?.items)
        ? narrative_signals.items[0]
        : narrative_signals;
      if (headSignals?.implication?.counter_intuition === true) {
        posture_hint = "challenge";
      }
    } catch (sig_err) {
      // eslint-disable-next-line no-console
      console.warn("BRIEF M.B.1 narrative_signals error:", sig_err);
      narrative_signals = null;
    }
  }

  return {
    ...buildResponseContract({
      opener,
      suggestions,
      sentrixAction,
      decision: null,
      evidence: {
        ranking_direction: direction,
        ranking_metric: metric,
        ranking_topN: selected.length,
        ranking_entityType: entityType,
        ranking_entities: selected.map(e => e[nameField]),
        ranking_values: selected.map(e => e[spec.field]),
      },
      focus: "ranking_extremes",
      confidence: "alta",
      // BRIEF CONEXION1 (ARCO B) · clientList al hilo · gateado a entityType "client" (SKU/otros → vacío →
      // arco B declara límite honesto · evita servir un SKU como "cuenta") · entidades reales, cero recompute.
      clientList: entityType === "client" ? selected.map(e => _buildEntityId("client", e[nameField])) : [],
      materialMetrics: selected.map(e => ({
        entity: e[nameField],
        metric,
        value: e[spec.field],
      })),
      reasoningPattern: "ranking_extremes",
      suggestedNextActions: [],
    }),
    // BRIEF M · spread externo · narrative_layer consumirá si flag ON
    narrative_signals,
    posture_hint,
  };
}

export function buildNarrativeSignalsForRankingExtremes(selected, direction, metric, entityType, scope) {
  if (!Array.isArray(selected) || selected.length === 0) return null;
  const spec = RANKING_EXTREMES_METRICS[metric];
  if (!spec) return null;
  const nameField = _getEntityNameField(metric);

  // Construir signals para 1 entity (helper interno)
  const buildSignalsForEntity = (entity, rankPosition) => {
    const driver = detectInternalDriver(entity, metric, entityType, scope);
    const recoverable = driver ? calculateRecoverable(entity, metric, entityType, driver, scope) : 0;
    const action = driver ? buildSuggestedAction(entity, metric, entityType, scope, recoverable) : null;
    const reframe = driver ? buildReframe(driver) : null;
    const severity = classifySeverity(driver?.vs_promedio || 0, recoverable);

    return {
      direction,
      rank_position: rankPosition,
      what: {
        entity: entity[nameField],
        value: entity[spec.field],
        unit: spec.unit,
        metric,
        metricKey: metric,
        entityType,
      },
      why: driver ? {
        mechanism: driver.mechanism,
        origin: "internal", // todas las reglas activas de M.A son origen interno
        target_entity: entity[nameField],
        driver,
      } : null,
      implication: {
        severity,
        // counter_intuition: true si hay driver interno · false si null
        counter_intuition: !!driver,
        recoverable_value: recoverable,
        recoverability: classifyRecoverability(driver),
        action,
        reframe,
      },
    };
  };

  if (selected.length === 1) {
    return buildSignalsForEntity(selected[0], 1);
  }
  // topN ≥ 2 · array de signals ordinales
  return {
    items: selected.map((e, idx) => buildSignalsForEntity(e, idx + 1)),
    direction,
    metric,
    entityType,
  };
}

export function _metricNounEs(metricKey) {
  const m = {
    contribucion:     "contribución",
    margen:           "margen",
    ventas:           "ventas",
    carga:            "carga comercial",
    rotacion:         "rotación",
    stockUSD:         "stock USD",
    cobertura:        "cobertura",
    doh:              "DOH",
    sku_margen:       "margen",
    sku_contribucion: "contribución",
  };
  return m[metricKey] || metricKey;
}

export function classifyRecoverability(driver) {
  if (!driver) return "baja";
  if (driver.mechanism === "internal_commercial_load") return "alta";
  if (driver.mechanism === "internal_margin_compression") return "media";
  if (driver.mechanism === "operational_inefficiency") return "media";
  return "baja";
}
