/* === adi/composers/qiRetrieval.js ===
 * Query Intelligence · retrieval-table subsystem extraído de 41cc33d8 · verbatim · solo imports agregados.
 * Exporta: executiveLanguageDetector, queryInterpreter, composeRetrieval. */
import { sfamiliasMargen } from "../../data/demoData.js";
import { skusMargen } from "../../data/skusMargen.js";
import { applyScenarioToClientesMargen, applyScenarioToSfamiliasMargen } from "../../engine/scenarios.js";
import { applyFiltros } from "../../engine/metrics.js";  // Piece 3 · motor de filtros (sin tocar)
import { FEATURE_FAMILY_AS_ENTITY } from "../../config/features.js";
import { filterTextualSuggestions, normalizeText } from "../helpers.js";
// ── ADI Core Fase 1+2 · Piece 2 · extractor de filtro (reusa detectores endurecidos · strict) ──
import { detectAllBrandsInText, detectAllFamiliesInText, detectAllClientsInText, detectAllWarehousesInText } from "../router.js";
import { detectSkuInText } from "../detectors.js";
import { ADI_QI_FILTER_ENABLED } from "../../config/voiceFlags.js";

const EXECUTIVE_KEYWORDS_RAW = [
  "problema", "foco", "causa", "por que", "porque", "que pasa", "riesgo",
  "presion", "erosion", "comprimido", "comprimida", "atrapado", "atrapada",
  "dependencia", "amenaza", "donde esta", "me cuesta", "comen", "comiendo",
  "esta cayendo", "pierdo", "perdemos", "pagando", "renegociar",
  "bajo carga", "sobre el margen", "crece tanto", "erosionado", "erosionada",
  "presionado", "presionada", "destruyen", "diluyen", "asfixia",
];
const EXECUTIVE_CONCEPTS_RAW = [
  "loss_explicit", "mechanism_entity_erosion", "mechanism_entity_dependency",
  "mechanism_entity_quality", "domain_concentration", "profitability_negative",
];

export function executiveLanguageDetector(text, concepts) {
  if (!text || typeof text !== "string") {
    return { isExecutive: false, marker: null };
  }
  // Normalizar (lowercase + remove accents)
  const norm = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Excepción D1 · top N + por + dimension + metric: NO bloquear como executive
  // (es retrieval ranked puro · F6 "concentration" debe ceder a QI)
  const hasTopN = /\btop\s+\d+\b/.test(norm) || /\bprimeros?\s+\d+\b/.test(norm);
  const hasPorConector = /\bpor\b/.test(norm);
  const METRIC_TOKENS_QUICK = [
    "ventas", "venta", "margen", "margenes", "contribucion", "contribuciones",
    "rotacion", "cobertura", "doh", "carga", "stock", "rentabilidad",
    "participacion", "aporte",
  ];
  const DIMENSION_TOKENS_QUICK = [
    "cliente", "clientes", "cuenta", "cuentas", "sku", "skus",
    "producto", "productos", "familia", "familias", "marca", "marcas",
    "sucursal", "sucursales", "bodega", "bodegas", "canal", "canales",
    "tier",
  ];
  const hasMetric = METRIC_TOKENS_QUICK.some(m => new RegExp("\\b" + m + "\\b").test(norm));
  const hasDimension = DIMENSION_TOKENS_QUICK.some(d => new RegExp("\\b" + d + "\\b").test(norm));
  const isTopNRanked = hasTopN && hasPorConector && hasMetric && hasDimension;

  // Keywords ejecutivos
  for (const kw of EXECUTIVE_KEYWORDS_RAW) {
    if (norm.includes(kw)) {
      // Verificar excepción top N antes de bloquear
      if (isTopNRanked) {
        // top N override: ignorar keyword executive (caso D1)
        // Salvo keywords MUY fuertes que claramente son ejecutivos
        const HARD_KEYWORDS = ["problema", "foco", "causa", "riesgo", "amenaza", "me cuesta"];
        if (!HARD_KEYWORDS.includes(kw)) continue;
      }
      return { isExecutive: true, marker: "keyword:" + kw };
    }
  }

  // Concepts ejecutivos (desde semantic pipeline)
  const conceptsList = Array.isArray(concepts) ? concepts : [];
  for (const c of EXECUTIVE_CONCEPTS_RAW) {
    if (conceptsList.includes(c)) {
      // Excepción D1: domain_concentration con estructura top N + por + metric
      if (c === "domain_concentration" && isTopNRanked) {
        continue;
      }
      return { isExecutive: true, marker: "concept:" + c };
    }
  }

  return { isExecutive: false, marker: null };
}

// ── PIEZA 1 · queryInterpreter ──────────────────────────────────────────────
// Función pura · toma (text, scenario, semanticContext) y retorna shape de
// retrieval paramétrico:
//   { isRetrieval, queryType, metrics, dimensions, format, limit }
//
// queryType V1 (Decisión 2 · retrieval_filtered diferido a #7-bis):
//   "simple"  · 1 metric + 1 dimension
//   "multi"   · 2+ metrics + 1 dimension
//   "ranked"  · 1 metric + 1 dimension + top N
//
// METRICS singular Y plural (Decisión 3).
const QI_METRIC_VOCAB = {
  ventas:        ["ventas", "venta"],
  margen:        ["margen", "margenes", "márgenes"],
  contribucion:  ["contribucion", "contribuciones", "contribución"],
  rotacion:      ["rotacion", "rotación"],
  cobertura:     ["cobertura", "doh"],
  carga:         ["carga", "carga comercial"],
  stock:         ["stock"],
  rentabilidad:  ["rentabilidad"],
  participacion: ["participacion", "participación"],
  aporte:        ["aporte"],
};
const QI_DIMENSION_VOCAB = {
  cliente:   ["cliente", "clientes", "cuenta", "cuentas"],
  sku:       ["sku", "skus"],
  producto:  ["producto", "productos"],
  familia:   ["familia", "familias", "categoria", "categorias", "categoría", "categorías"],
  marca:     ["marca", "marcas"],
  sucursal:  ["sucursal", "sucursales", "bodega", "bodegas"],
  canal:     ["canal", "canales"],
  tier:      ["tier"],
};
const QI_FORMAT_KEYWORDS = {
  tabla:   ["en tabla", "tabular", "como tabla"],
  ranking: ["rankeado", "ranking", "ordenado"],
  lista:   ["en lista", "como lista"],
};
const QI_IMPERATIVE_PREFIX = [
  "dame", "muestrame", "muéstrame", "listame", "lístame",
  "lista de", "lista", "ranking de", "dame ranking de",
];

export function queryInterpreter(text, scenario, semanticContext) {
  const empty = {
    isRetrieval: false,
    queryType: null,
    metrics: [],
    dimensions: [],
    format: null,
    limit: null,
  };
  if (!text || typeof text !== "string") return empty;

  // Normalizar (lowercase + remove accents)
  const norm = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!]/g, "")
    .trim();

  // 1. Detectar metrics (canonical key · puede haber múltiples)
  const detectedMetrics = [];
  for (const [canonical, vocab] of Object.entries(QI_METRIC_VOCAB)) {
    for (const term of vocab) {
      if (new RegExp("\\b" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(norm)) {
        if (!detectedMetrics.includes(canonical)) detectedMetrics.push(canonical);
        break;
      }
    }
  }

  // 2. Detectar dimensions (canonical key)
  const detectedDimensions = [];
  for (const [canonical, vocab] of Object.entries(QI_DIMENSION_VOCAB)) {
    for (const term of vocab) {
      if (new RegExp("\\b" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(norm)) {
        if (!detectedDimensions.includes(canonical)) detectedDimensions.push(canonical);
        break;
      }
    }
  }

  // 3. Detectar conector "por" (requerido para retrieval)
  const hasPor = /\bpor\b/.test(norm);

  // 4. Sin metrics o sin dimensions o sin "por" · NO es retrieval V1
  if (detectedMetrics.length === 0 || detectedDimensions.length === 0 || !hasPor) {
    return empty;
  }

  // 5. Detectar top N (ranked)
  let topN = null;
  const topMatch = norm.match(/\btop\s+(\d+)\b/) || norm.match(/\bprimeros?\s+(\d+)\b/);
  if (topMatch) {
    topN = parseInt(topMatch[1], 10);
    if (Number.isNaN(topN) || topN < 1 || topN > 50) topN = null;
  }

  // 6. Detectar format keyword
  let detectedFormat = null;
  for (const [fmtKey, kws] of Object.entries(QI_FORMAT_KEYWORDS)) {
    for (const kw of kws) {
      if (norm.includes(kw)) { detectedFormat = fmtKey; break; }
    }
    if (detectedFormat) break;
  }

  // 7. Detectar imperativo (informativo · no requerido)
  const hasImperative = QI_IMPERATIVE_PREFIX.some(p =>
    norm === p || norm.startsWith(p + " ")
  );

  // 8. Determinar queryType
  let queryType;
  if (topN !== null) {
    queryType = "ranked";
  } else if (detectedMetrics.length >= 2) {
    queryType = "multi";
  } else {
    queryType = "simple";
  }

  // 9. Default format
  let finalFormat = detectedFormat;
  if (!finalFormat) {
    if (queryType === "ranked") finalFormat = "ranking";
    else if (queryType === "multi") finalFormat = "tabla";
    else finalFormat = "tabla";
  }

  const _qi = {
    isRetrieval: true,
    queryType,
    metrics: detectedMetrics,
    dimensions: detectedDimensions,
    format: finalFormat,
    limit: topN,
  };
  // ── Piece 2 (aditivo · inerte hasta Piece 3) · adjunta filtros + dim por sustracción ──
  // Solo con el flag maestro ON. composeRetrieval IGNORA estos campos hasta Piece 3 → byte-idéntico.
  if (ADI_QI_FILTER_ENABLED) {
    const _fp = extractFilterPredicate(text);
    const _dimsEff = computeEffectiveDims(detectedDimensions, norm);
    _qi.filtros = _fp.filtros;
    _qi.filterPhrasesRaw = _fp.filterPhrasesRaw;
    _qi.unresolvedFilters = _fp.unresolvedFilters;
    _qi.unsupportedSignals = _fp.unsupportedSignals;
    _qi.ambiguousStock = _fp.ambiguousStock;
    _qi.dimsEffective = _dimsEff;
    _qi.dimCount = _dimsEff.length;
  }
  return _qi;
}

// ════════════════════════════════════════════════════════════════════════════
// ADI Core Fase 1+2 · Piece 2 · extracción de predicado de filtro + dim por sustracción
// (aditivo · queryInterpreter los adjunta solo con ADI_QI_FILTER_ENABLED · inerte hasta Piece 3)
// ════════════════════════════════════════════════════════════════════════════

const _DIM_MARKER_TOKENS = {
  familia: ["familia", "familias", "categoria", "categorias"],
  marca:   ["marca", "marcas"],
  cliente: ["cliente", "clientes", "cuenta", "cuentas"],
};

// Stopwords para el "nombrado-no-resuelto": un valor capturado tras un marcador ("de marca X")
// que sea conector/dimensión/métrica NO es un nombre de filtro real (ej "de clientes POR contribución"
// captura "por" → no es un cliente). Evita falsos AVISAR sobre frases de dimensión del corpus.
const _FILTER_VALUE_STOP = new Set([
  "por", "y", "en", "con", "de", "del", "la", "el", "los", "las", "un", "una", "para",
  "cliente", "clientes", "cuenta", "cuentas", "sku", "skus", "producto", "productos",
  "familia", "familias", "categoria", "categorias", "marca", "marcas",
  "sucursal", "sucursales", "bodega", "bodegas", "canal", "canales", "tier",
  "ventas", "venta", "margen", "margenes", "contribucion", "contribuciones",
  "rotacion", "cobertura", "doh", "carga", "stock", "rentabilidad", "participacion", "aporte",
  "ranking", "rankeado", "top", "primeros", "primero", "mejores", "peores",
]);
function _plausibleFilterValue(raw) {
  if (!raw) return false;
  const w = String(raw).trim().split(/\s+/)[0];
  return w.length >= 3 && !_FILTER_VALUE_STOP.has(w);
}

// Un token de dimensión queda "consumido por filtro" si aparece como MARCADOR de filtro
// ("de/del/en (la) familia/marca/cliente …") y NO como group-by ("por (la) …"). Así
// "por cliente de la familia X" → cliente=dim, familia=filtro (NO cuenta como 2da dim).
function _filterConsumedDim(dim, norm) {
  const toks = _DIM_MARKER_TOKENS[dim];
  if (!toks) return false;
  for (const t of toks) {
    const inFilter   = new RegExp(`\\b(?:de|del|en)\\s+(?:la\\s+|las\\s+|los\\s+)?${t}\\b`).test(norm);
    const inDeictic  = new RegExp(`\\b(?:estos|esos|estas|esas)\\s+\\d*\\s*${t}\\b`).test(norm);  // "estos 3 clientes"
    const inGroupBy  = new RegExp(`\\bpor\\s+(?:la\\s+)?${t}\\b`).test(norm);
    if ((inFilter || inDeictic) && !inGroupBy) return true;
  }
  return false;
}

// dimensión por SUSTRACCIÓN · lo nombrado como filtro NO cuenta como dimensión group-by.
export function computeEffectiveDims(dimensions, norm) {
  if (!Array.isArray(dimensions)) return [];
  return dimensions.filter(d => !_filterConsumedDim(d, norm));
}

// ¿el token aparece tras un conector de filtro (de/del/en …)? (núcleo del "nombrado-no-resuelto")
function _afterFilterConnector(norm, tok) {
  const t = normalizeText(String(tok)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!t) return false;
  return new RegExp(`\\b(?:de|del|en)\\b(?:\\s+(?:la|el|las|los|familias?|marcas?|categorias?|cliente|cuenta))*\\s+${t}\\b`).test(norm);
}

// extractFilterPredicate · wrapper sobre los detectores YA endurecidos (strict:true) → canónicas.
// Separa: filtros resueltos · frases crudas nombradas · señales no-soportadas · NOMBRADO-NO-RESUELTO.
export function extractFilterPredicate(text) {
  const norm = normalizeText(text || "");
  // 1 · RESUELTOS (canónicos · strict)
  const marcas    = detectAllBrandsInText(text) || [];               // marcas ya usan \b (strict≈loose)
  const sfamilias = detectAllFamiliesInText(text, { strict: true });
  const clientes  = detectAllClientsInText(text, { strict: true });
  const _sku      = detectSkuInText(text);
  const skus      = _sku ? [_sku] : [];
  const filtros = { marcas, sfamilias, clientes, skus };
  const filterPhrasesRaw = [...marcas, ...sfamilias, ...clientes, ...skus];
  // 2 · NO-SOPORTADOS nombrados (canal/bodega/tier · deíctico) → unsupportedSignals (Piece 3 → AVISAR)
  const unsupportedSignals = [];
  for (const w of (detectAllWarehousesInText(text) || [])) if (w && w !== "Todas") unsupportedSignals.push({ kind: "bodega", raw: w });
  if (/\bcanal(?:es)?\b/.test(norm) || /\b(?:retail|e-?commerce)\b/.test(norm)) unsupportedSignals.push({ kind: "canal", raw: "canal" });
  if (/\btier\b/.test(norm)) unsupportedSignals.push({ kind: "tier", raw: "tier" });
  if (/\b(?:estos|esos|estas|esas)\s+\d*\s*(?:clientes|cuentas|skus|productos)\b/.test(norm) && !clientes.length && !skus.length)
    unsupportedSignals.push({ kind: "deictico", raw: "estos/esos" });
  // 3 · NOMBRADO-PERO-NO-RESUELTO · señal explícita → Piece 3 AVISAR "no reconozco X" (NUNCA "sin filtro")
  const unresolvedFilters = [];
  // 3a · familia: loose la reconoce vía conector pero strict la rechaza (ej "de materiales" genérico)
  const _looseTrig = [];
  detectAllFamiliesInText(text, { triggers: _looseTrig });           // loose (substring) · captura token disparador
  for (const { name, token } of _looseTrig) {
    if (!sfamilias.includes(name) && _afterFilterConnector(norm, token)) unresolvedFilters.push({ axis: "sfamilia", raw: token });
  }
  // 3b · marcador explícito con valor desconocido ("de marca Acme", "de la familia Zzz", "de cliente Xyz")
  const _mMarca = norm.match(/\b(?:de|del)\s+marcas?\s+([a-z0-9][a-z0-9-]*)/);
  if (_mMarca && !marcas.length && _plausibleFilterValue(_mMarca[1]) && !unresolvedFilters.some(u => u.axis === "marca")) unresolvedFilters.push({ axis: "marca", raw: _mMarca[1] });
  const _mFam = norm.match(/\b(?:de|del|en)\s+(?:la\s+)?(?:familia|categoria)s?\s+([a-z][a-z\s]*?)(?:\s+(?:por|en|con|y)\b|$)/);
  if (_mFam && !sfamilias.length && _plausibleFilterValue(_mFam[1]) && !unresolvedFilters.some(u => u.axis === "sfamilia")) unresolvedFilters.push({ axis: "sfamilia", raw: _mFam[1].trim() });
  const _mCli = norm.match(/\b(?:de|del)\s+(?:cliente|cuenta)s?\s+([a-z][a-z\s]*?)(?:\s+(?:por|en|con|y)\b|$)/);
  if (_mCli && !clientes.length && _plausibleFilterValue(_mCli[1]) && !unresolvedFilters.some(u => u.axis === "cliente")) unresolvedFilters.push({ axis: "cliente", raw: _mCli[1].trim() });
  // 4 · stock ambiguo → Piece 3 ACLARAR (nunca remapear en silencio a unidades)
  const ambiguousStock = /\bstock\b/.test(norm);
  return { filtros, filterPhrasesRaw, unresolvedFilters, unsupportedSignals, ambiguousStock };
}

// ── PIEZA 3 · composeRetrieval ──────────────────────────────────────────────
// Composer ligero · genera output paramétrico estructurado.
// Estructura canónica preliminar: Header + Cuerpo tabular (NBSP padding) +
// Foco breve + Confianza. SIN recomendación full. SIN sentrixAction V1.
//
// Lee datasets canónicos:
//   · clientesMargen (via applyScenarioToClientesMargen) · cliente dim
//   · skusMargen · sku/producto dim
//   · sfamiliasMargen · familia/categoria dim
//   · clientesVentas / sfamiliasVentas para metric "ventas" cuando aplica
//
// Si una metric/dimension no se puede resolver con datasets disponibles,
// retorna null · QI fallback a path legacy.

// ════════════════════════════════════════════════════════════════════════════
// BRIEF #9 (post-46-bis) · RETRIEVAL INTELLIGENCE LAYER · PIEZAS 1-3
// ════════════════════════════════════════════════════════════════════════════
//
// Capa de razonamiento mínimo sobre QueryInterpreter retrieval.
// Agrega Lectura ejecutiva (1-2 frases) + Próximo ángulo dentro del Foco.
//
// REGLA NUCLEAR · IDENTIDAD COGNITIVA RETRIEVAL:
//   RIL describe patrones · NUNCA explica causas.
//   No inventa. No interpreta más allá de lo objetivo.
//   Fallback silencioso si datos no soportan lectura no-trivial.
//
// Decisiones founder integradas FASE 2:
//   D1 · Signature variables runtime directas (no qiOutput parsing)
//   D2 · Calidad cruzada · cruce confirmado AMBOS sentidos (estricto)
//   D3 · Riesgo umbral · top3_share ∈ (0.40, 0.95)
//   D4 · Brecha umbral · gap_pct ≥ 15% (wording natural)
//   D5 · Brecha scope · solo queryType === "ranked"
//   D6 · Próximo ángulo · mapeo rentabilidad→margen, aporte→contribucion,
//        participacion→ventas
//   D7 · Datos no-monetary · CONCENTRACIÓN/RIESGO flexibles · CALIDAD
//        CRUZADA y BRECHA strict
//
// GUARDRAILS LOCKED:
//   1. NO inventar causas
//   2. NO convertir retrieval en Ferrari (≤ 2 frases Lectura)
//   3. NO tocar Ferrari composers / handleUserSubmit
//   4. Próximo ángulo SIEMPRE dentro de Foco · NUNCA en suggestions
//   5. try-catch defensivo · passthrough si falla
// ════════════════════════════════════════════════════════════════════════════

// ── PIEZA 3.1 · rilIsMonetaryOrPct ──────────────────────────────────────────
// Identifica si una metric es monetary o porcentual (para D7 · BRECHA/CALIDAD
// requieren tipo conocido; CONCENTRACIÓN acepta cualquier sumable).
function rilIsMonetaryOrPct(metricKey) {
  // Monetary
  if (metricKey === "ventas" || metricKey === "venta") return "monetary";
  if (metricKey === "contribucion" || metricKey === "contribuciones") return "monetary";
  if (metricKey === "aporte") return "monetary";
  // Porcentual
  if (metricKey === "margen" || metricKey === "margenes") return "pct";
  if (metricKey === "rentabilidad") return "pct";
  if (metricKey === "carga") return "pct";
  if (metricKey === "participacion") return "pct";
  // Sumable numérico (unidades stock)
  if (metricKey === "stock") return "count";
  return null;
}

// ── PIEZA 3.2 · rilComputeConcentracion ─────────────────────────────────────
// Compute concentración stats sobre sortedRows (ya ordenado desc).
// Retorna métricas: top3Share, leaderShare, plus nombres.
function rilComputeConcentracion(sortedRows, sortField) {
  if (!Array.isArray(sortedRows) || sortedRows.length === 0) return null;
  let total = 0;
  for (const r of sortedRows) total += (r[sortField] || 0);
  if (total <= 0) return null;
  const top1Val = sortedRows[0][sortField] || 0;
  const top2Val = sortedRows.length > 1 ? (sortedRows[1][sortField] || 0) : 0;
  const top3Val = sortedRows.length > 2 ? (sortedRows[2][sortField] || 0) : 0;
  const top3Sum = top1Val + top2Val + top3Val;
  return {
    total: total,
    top1Val: top1Val,
    top2Val: top2Val,
    top3Val: top3Val,
    top1Name: sortedRows[0].nombre || "—",
    top2Name: sortedRows.length > 1 ? (sortedRows[1].nombre || "—") : null,
    top3Name: sortedRows.length > 2 ? (sortedRows[2].nombre || "—") : null,
    leaderShare: top1Val / total,
    top3Share: top3Sum / total,
    // Para CONCENTRACIÓN: porcentaje del siguiente (top2) sobre total
    nextShare: top2Val / total,
  };
}

// ── PIEZA 3.3 · rilComputeBrecha ────────────────────────────────────────────
// Compute brecha top1 vs top2 · solo si datos suficientes y monetary/pct.
function rilComputeBrecha(sortedRows, sortField) {
  if (!Array.isArray(sortedRows) || sortedRows.length < 2) return null;
  const top1Val = sortedRows[0][sortField] || 0;
  const top2Val = sortedRows[1][sortField] || 0;
  if (top2Val <= 0) return null;
  const gap = top1Val - top2Val;
  const gapPct = gap / top2Val;
  return {
    top1Val: top1Val,
    top2Val: top2Val,
    top1Name: sortedRows[0].nombre || "—",
    top2Name: sortedRows[1].nombre || "—",
    gap: gap,
    gapPct: gapPct, // ratio (0.17 = 17%)
  };
}

// ── PIEZA 3.4 · rilDetectCalidadCruzada ─────────────────────────────────────
// Detecta disonancia multi-metric: top1 de metric[0] tiene metric[1] bajo avg
// PORTAFOLIO Y best metric[1] tiene metric[0] bajo avg PORTAFOLIO.
// Cruce confirmado en AMBOS sentidos (D2 estricto). Si solo uno → null.
//
// Solo aplica para metric[1] de tipo "pct" o "monetary" (D7 strict para
// CALIDAD CRUZADA · comparable contra avg portfolio).
function rilDetectCalidadCruzada(sortedRows, metricMap, metrics) {
  if (!Array.isArray(metrics) || metrics.length < 2) return null;
  if (!Array.isArray(sortedRows) || sortedRows.length < 4) return null;

  const m0Key = metrics[0];
  const m1Key = metrics[1];
  const m0Field = metricMap[m0Key]?.field;
  const m1Field = metricMap[m1Key]?.field;
  if (!m0Field || !m1Field) return null;

  const m1Type = rilIsMonetaryOrPct(m1Key);
  const m0Type = rilIsMonetaryOrPct(m0Key);
  if (!m1Type || !m0Type) return null;
  // D7 strict: ambos comparables
  if (m1Type === "count" || m0Type === "count") return null;

  // Calcular promedios del portfolio (todos los rows)
  let sumM0 = 0, sumM1 = 0, count = 0;
  for (const r of sortedRows) {
    if (typeof r[m0Field] === "number" && typeof r[m1Field] === "number") {
      sumM0 += r[m0Field];
      sumM1 += r[m1Field];
      count++;
    }
  }
  if (count === 0) return null;
  const avgM0 = sumM0 / count;
  const avgM1 = sumM1 / count;
  if (avgM0 <= 0 || avgM1 <= 0) return null;

  // Top1 por metric[0] = sortedRows[0]
  const top1 = sortedRows[0];
  const top1M0 = top1[m0Field];
  const top1M1 = top1[m1Field];
  if (typeof top1M0 !== "number" || typeof top1M1 !== "number") return null;

  // Best row por metric[1] (orden descendente m1Field)
  let bestM1Row = null;
  let bestM1Val = -Infinity;
  for (const r of sortedRows) {
    const v = r[m1Field];
    if (typeof v === "number" && v > bestM1Val) {
      bestM1Val = v;
      bestM1Row = r;
    }
  }
  if (!bestM1Row || bestM1Row === top1) return null;
  const bestM1M0 = bestM1Row[m0Field];
  if (typeof bestM1M0 !== "number") return null;

  // Cruce AMBOS sentidos · D2 estricto:
  //   · top1 metric[0] tiene metric[1] BAJO avg portfolio
  //   · best metric[1] tiene metric[0] BAJO avg portfolio
  const top1HasLowM1 = top1M1 < avgM1;
  const bestHasLowM0 = bestM1M0 < avgM0;
  if (!top1HasLowM1 || !bestHasLowM0) return null;

  // Adicionalmente: para evitar disonancias triviales, exigir margen
  // significativo (≥ 10% de gap relativo en cualquier dirección).
  const m1GapPct = Math.abs(top1M1 - avgM1) / avgM1;
  const m0GapPct = Math.abs(bestM1M0 - avgM0) / avgM0;
  if (m1GapPct < 0.10 && m0GapPct < 0.10) return null;

  return {
    top1Name: top1.nombre || "—",
    top1M0Val: top1M0,
    top1M1Val: top1M1,
    bestM1Name: bestM1Row.nombre || "—",
    bestM1Val: bestM1Val,
    bestM1M0Val: bestM1M0,
    avgM0: avgM0,
    avgM1: avgM1,
    m0Type: m0Type,
    m1Type: m1Type,
  };
}

// ── PIEZA 3.5 · rilPickNextAngle ────────────────────────────────────────────
// Determinístico · retorna frase de próximo ángulo según queryType + primary
// metric (con mapeo D6) + dim.
function rilPickNextAngle(queryType, primaryMetric, dim) {
  // D6 · mapeo de metrics derivadas a base
  const metricMap = {
    rentabilidad: "margen",
    aporte: "contribucion",
    participacion: "ventas",
  };
  const m = metricMap[primaryMetric] || primaryMetric;
  const dimLow = (dim === "cliente" || dim === "sku" || dim === "familia" || dim === "marca")
                 ? dim : "item";

  if (queryType === "multi") {
    return "evaluar carga comercial por " + dimLow + " para identificar palancas de margen";
  }
  if (queryType === "ranked") {
    if (m === "ventas") return "validar margen del líder";
    if (m === "margen") return "validar volumen del líder vs lastres";
    if (m === "contribucion") return "validar rotación y disponibilidad operativa del líder";
    return "profundizar en el líder o validar lastres del portafolio";
  }
  // simple
  if (m === "ventas")       return "cruzar con margen y carga comercial para validar si esa concentración es sana";
  if (m === "margen")       return "cruzar con ventas para identificar palancas de margen";
  if (m === "contribucion") return "validar rotación y disponibilidad operativa del líder";
  if (m === "carga")        return "comparar contra benchmark interno (3.5%)";
  if (m === "stock")        return "cruzar con rotación por " + dimLow;
  return "profundizar en el líder o validar lastres del portafolio";
}

// ── PIEZA 1 · retrievalIntelligenceLayer ────────────────────────────────────
// Dispatcher principal · aplica prioridad LOCKED 5 dimensiones.
// Variables runtime directas (D1) · no parsing del opener.
//
// Retorna:
//   {
//     readingLine: string | null,   // Lectura 1-2 frases (null = fallback)
//     nextAngleLine: string,        // Próximo ángulo · siempre presente
//     enrichedFoco: string,         // Foco original + próximo ángulo
//   }
//
// Si datos no soportan lectura no-trivial · readingLine=null (fallback
// silencioso · respeta D3 del BRIEF #8).
function retrievalIntelligenceLayer(qi, scenario, sortedRows, metricMap, sortField, originalFoco, dim) {
  // Sanity checks
  if (!qi || !Array.isArray(sortedRows) || sortedRows.length === 0) {
    return { readingLine: null, nextAngleLine: "", enrichedFoco: originalFoco || "" };
  }

  const primaryMetric = qi.metrics?.[0];
  const queryType = qi.queryType;
  if (!primaryMetric || !queryType) {
    return { readingLine: null, nextAngleLine: "", enrichedFoco: originalFoco || "" };
  }

  // Próximo ángulo siempre se computa (Prioridad 5)
  const nextAngle = rilPickNextAngle(queryType, primaryMetric, dim);
  // Enriquecer Foco: " · Próximo ángulo: <angle>."
  let enrichedFoco = originalFoco || "";
  if (enrichedFoco && nextAngle) {
    // Remover punto final si lo tiene · agregar próximo ángulo
    const trimmedFoco = enrichedFoco.replace(/\.\s*$/, "");
    enrichedFoco = trimmedFoco + ". Próximo ángulo: " + nextAngle + ".";
  }

  // Fallback inmediato si sortedRows < 4 · disciplina edge cases
  if (sortedRows.length < 4) {
    return { readingLine: null, nextAngleLine: nextAngle, enrichedFoco };
  }

  let readingLine = null;

  try {
    // ── PRIORIDAD 1 · CALIDAD CRUZADA (solo multi-metric) ───────────────
    if (qi.metrics.length >= 2) {
      const cal = rilDetectCalidadCruzada(sortedRows, metricMap, qi.metrics);
      if (cal) {
        const m0Label = metricMap[qi.metrics[0]]?.label || qi.metrics[0];
        const m1Label = metricMap[qi.metrics[1]]?.label || qi.metrics[1];
        const fmtM0 = metricMap[qi.metrics[0]]?.formatter || ((v) => String(v));
        const fmtM1 = metricMap[qi.metrics[1]]?.formatter || ((v) => String(v));
        const avgM1Formatted = cal.m1Type === "pct"
          ? cal.avgM1.toFixed(1) + "%"
          : fmtM1(cal.avgM1);
        readingLine = "Lectura · " + cal.top1Name + " lidera " + m0Label
                    + " (" + fmtM0(cal.top1M0Val) + ") pero opera con "
                    + m1Label + " " + fmtM1(cal.top1M1Val)
                    + ", bajo el portafolio promedio (" + avgM1Formatted + "). "
                    + cal.bestM1Name + " cruza la lectura: "
                    + m1Label + " " + fmtM1(cal.bestM1Val)
                    + " con apenas " + fmtM0(cal.bestM1M0Val) + " en " + m0Label + ".";
        return { readingLine, nextAngleLine: nextAngle, enrichedFoco };
      }
      // Calidad no detectada · fallback a CONCENTRACIÓN/RIESGO de metric[0]
    }

    // ── PRIORIDAD 2/3 · RIESGO / CONCENTRACIÓN (single-metric o fallback) ─
    const conc = rilComputeConcentracion(sortedRows, sortField);
    if (!conc) {
      return { readingLine: null, nextAngleLine: nextAngle, enrichedFoco };
    }

    // PRIORIDAD 4 (en ranked) · BRECHA · puede combinarse con concentración
    // D5 · solo aplica ranked · D4 umbral 15%
    let brechaLine = null;
    if (queryType === "ranked") {
      const metricType = rilIsMonetaryOrPct(primaryMetric);
      // D7 · BRECHA solo monetary o pct
      if (metricType === "monetary" || metricType === "pct") {
        const brecha = rilComputeBrecha(sortedRows, sortField);
        if (brecha && brecha.gapPct >= 0.15) {
          const fmt = metricMap[primaryMetric]?.formatter || ((v) => String(v));
          const gapPctRounded = Math.round(brecha.gapPct * 100);
          brechaLine = "Lectura · " + brecha.top1Name + " lidera con "
                     + fmt(brecha.top1Val) + ", " + gapPctRounded + "% sobre "
                     + brecha.top2Name + " (" + fmt(brecha.top2Val) + ").";
        }
      }
    }

    if (brechaLine) {
      readingLine = brechaLine;
      return { readingLine, nextAngleLine: nextAngle, enrichedFoco };
    }

    // PRIORIDAD 2 · RIESGO (top3 ∈ (0.40, 0.95))
    // Solo aplica en queryType "simple" · en ranked, top3 es mecánicamente
    // alto por construcción del filtro (top N usuario) · "dependencia
    // operacional sobre top3" sería engañoso en top5/top10.
    if (queryType === "simple" && qi.metrics.length === 1
        && conc.top3Share > 0.40 && conc.top3Share < 0.95) {
      const pct = Math.round(conc.top3Share * 100);
      // Nombres con coma + "y"
      const t1 = conc.top1Name || "";
      const t2 = conc.top2Name || "";
      const t3 = conc.top3Name || "";
      readingLine = "Lectura · Top 3 concentra " + pct + "% del total · dependencia operacional sobre "
                  + t1 + ", " + t2 + " y " + t3 + ".";
      return { readingLine, nextAngleLine: nextAngle, enrichedFoco };
    }

    // PRIORIDAD 3 · CONCENTRACIÓN (default · leader > 15%)
    if (conc.leaderShare > 0.15 && sortedRows.length >= 4) {
      const leaderPct = Math.round(conc.leaderShare * 100);
      const nextPct = Math.round(conc.nextShare * 100);
      readingLine = "Lectura · " + conc.top1Name + " concentra " + leaderPct
                  + "% del total · resto fragmentado bajo " + nextPct + "% individual.";
      return { readingLine, nextAngleLine: nextAngle, enrichedFoco };
    }

    // Fallback silencioso · datos no soportan lectura no-trivial (D3 del #8)
    return { readingLine: null, nextAngleLine: nextAngle, enrichedFoco };
  } catch (e) {
    // try-catch defensivo · fallback completo
    return { readingLine: null, nextAngleLine: nextAngle, enrichedFoco };
  }
}

// ── ADI Core Fase 1+2 · Piece 3 · escudo de filtro (helpers) ──────────────────
const _AXIS_SINGULAR = { marcas: "marca", sfamilias: "sfamilia", clientes: "cliente", skus: "sku" };
const _AXIS_LABEL    = { marca: "marca", sfamilia: "familia", cliente: "cliente", sku: "SKU" };
function _axisLabel(a) { return _AXIS_LABEL[a] || a; }
function _dimLabelEs(d) { return d === "cliente" ? "cliente" : (d === "sku" || d === "producto") ? "SKU" : d === "familia" ? "familia" : d === "marca" ? "marca" : d; }

// APLICABILIDAD (semántica · NO confía en applyFiltros) · campo REAL por-fila en la fuente:
// marca/sfamilia = atributo → aplican sobre fuentes row-level (cliente, sku) y marca-pre-group.
// marca×familia = DECORATIVO (sfamiliasMargen.marca = marca dominante) → INAPLICABLE.
// cliente/sku = entidad → solo sobre su propia dim (mismo grano).
function _filterApplicable(axis, dim) {
  if (axis === "marca")    return dim === "cliente" || dim === "sku" || dim === "producto" || dim === "marca";
  if (axis === "sfamilia") return dim === "cliente" || dim === "sku" || dim === "producto" || dim === "marca" || dim === "familia";
  if (axis === "cliente")  return dim === "cliente";
  if (axis === "sku")      return dim === "sku" || dim === "producto";
  return false;
}
function _filterValuesStr(filtros) {
  return [...(filtros.marcas || []), ...(filtros.sfamilias || []), ...(filtros.clientes || []), ...(filtros.skus || [])].join(", ");
}
// verdicto de filtro (AVISAR/ACLARAR) · answerADI lo rutea vía _plainWrap (limpio · sin suffix)
function _qiVerdict(verdict, kind, opener) {
  return { _verdict: verdict, _avisarKind: kind, opener, suggestions: [], sentrixAction: null, derivedIntentType: "query_interpreter_" + verdict, reasoningPattern: "qi_" + verdict + "_" + kind };
}

export function composeRetrieval(qi, scenario) {
  // Sanity check
  if (!qi || !qi.isRetrieval || !Array.isArray(qi.metrics) || !Array.isArray(qi.dimensions)) {
    return null;
  }
  if (qi.metrics.length === 0 || qi.dimensions.length === 0) return null;

  // ── Piece 3 · contexto de filtro (solo flag ON · qi trae los campos de Piece 2) ──
  const _filterOn = ADI_QI_FILTER_ENABLED && qi.filtros && typeof qi.filtros === "object";
  const _hasUnresolved = _filterOn && Array.isArray(qi.unresolvedFilters) && qi.unresolvedFilters.length > 0;
  const _resolvedAxes = _filterOn ? ["marcas", "sfamilias", "clientes", "skus"].filter(k => Array.isArray(qi.filtros[k]) && qi.filtros[k].length) : [];
  const _hasFilter = _resolvedAxes.length > 0;

  // dimensión efectiva (sustracción de Piece 2 · corrige #5) · sin filtro = dimensions[0] (byte-idéntico)
  const dim = (_filterOn && Array.isArray(qi.dimsEffective) && qi.dimsEffective.length) ? qi.dimsEffective[0] : qi.dimensions[0];

  // ── VERDICTO de filtro · intercepta SOLO cuando hay señal de filtro (no toca queries sin filtro) ──
  if (_filterOn && (_hasFilter || _hasUnresolved)) {
    // a · NOMBRADO-PERO-NO-RESUELTO → AVISAR "no reconozco X" (NUNCA tabla sin filtro)
    if (_hasUnresolved) {
      const u = qi.unresolvedFilters[0];
      return _qiVerdict("avisar", "unrecognized", `No reconozco "${u.raw}" como ${_axisLabel(u.axis)} para filtrar. ¿Lo reformulás con el nombre exacto?`);
    }
    // b · APLICABILIDAD (cross-grano / decorativo) → AVISAR (antes de tocar el dataset)
    for (const k of _resolvedAxes) {
      const ax = _AXIS_SINGULAR[k];
      if (!_filterApplicable(ax, dim)) {
        return _qiVerdict("avisar", "inapplicable", `No llego a filtrar por ${_axisLabel(ax)} en una vista por ${_dimLabelEs(dim)}.`);
      }
    }
  }
  // sin filtro → undefined (NO {}) · applyFiltros(rows, undefined) devuelve rows intactos → byte-idéntico
  const _filtrosArg = (_filterOn && _hasFilter) ? qi.filtros : undefined;

  // ── Piece 4 · verdictos de retrieval no-servible (gated · SOLO dentro del path QI · corpus-safe) ──
  // CORPUS-SAFE: solo intercepta queries que HOY composeRetrieval tampoco servía (caía a null→legacy
  // o remapeo silencioso). El corpus verde CON flag ON es la prueba de que no ensombrece composers.
  if (_filterOn) {
    // G3 · multi-dimensión real (2+ dims efectivas · no las consumidas por filtro)
    if (Array.isArray(qi.dimsEffective) && qi.dimCount >= 2) {
      return _qiVerdict("avisar", "multidim", `No cruzo dos dimensiones en una sola tabla (${qi.dimsEffective.join(" y ")}). Pedímelas de a una y las cruzamos a mano.`);
    }
    // G2 · dimensión no soportada (canal/sucursal/tier) · hoy → null → legacy
    if (dim === "canal" || dim === "sucursal" || dim === "tier") {
      const _d = dim === "sucursal" ? "sucursal/bodega" : dim;
      return _qiVerdict("avisar", "dim", `No tengo "${_d}" como dimensión consultable en esta vista todavía.`);
    }
    // G4 · deíctico irresoluble ("estos N clientes" sin lista) → AVISAR (NO responder sin filtro = adyacente)
    if (Array.isArray(qi.unsupportedSignals) && qi.unsupportedSignals.some(s => s.kind === "deictico")) {
      return _qiVerdict("avisar", "deictic", `Me estás hablando de entidades específicas ("estos…") que no puedo resolver sin la lista. ¿Cuáles son?`);
    }
    // G5 · "stock" ambiguo → ACLARAR (decisión: nunca remapear en silencio a unidades)
    if (qi.ambiguousStock) {
      return _qiVerdict("aclarar", "stock", `¿Te referís a unidades vendidas o a capital en inventario? "Stock" puede ser las dos cosas — decime cuál y te lo armo.`);
    }
  }

  // Resolver dataset según dimension
  let rows = null;
  let dimLabel = "";
  let nameField = "nombre";
  try {
    if (dim === "cliente") {
      // Piece 3 · filtrar la fuente (campo real: marca/sfamilia/nombre+tipo) · undefined = intacto
      rows = applyFiltros(applyScenarioToClientesMargen(scenario), _filtrosArg);
      dimLabel = "Cliente";
    } else if (dim === "sku" || dim === "producto") {
      rows = applyFiltros(skusMargen, _filtrosArg);
      dimLabel = "SKU";
    } else if (dim === "familia") {
      // CORTE 1 · R2 · fuente canónica scenario-aware (idéntica al dashboard).
      // Con flag OFF se preserva el estático (comportamiento del piso). Con flag ON
      // ningún path conversacional emite la cifra estática (mundo-marca).
      rows = applyFiltros(FEATURE_FAMILY_AS_ENTITY ? applyScenarioToSfamiliasMargen(scenario) : sfamiliasMargen, _filtrosArg);
      dimLabel = "Familia";
    } else if (dim === "marca") {
      // Marca · agrupación dinámica desde clientesMargen
      // Piece 3 · FILTRAR clientesMargen ANTES de agrupar (campo real) · NUNCA el agregado
      const grouped = {};
      const baseRows = applyFiltros(applyScenarioToClientesMargen(scenario), _filtrosArg);
      for (const r of baseRows) {
        const m = r.marca || "Otros";
        if (!grouped[m]) {
          grouped[m] = { nombre: m, venta: 0, contribucion: 0, margen: 0, count: 0, pctRebate: 0 };
        }
        grouped[m].venta        += r.venta;
        grouped[m].contribucion += r.contribucion;
        grouped[m].margen       += r.margen;
        grouped[m].pctRebate    += r.pctRebate;
        grouped[m].count        += 1;
      }
      rows = Object.values(grouped).map(g => ({
        ...g,
        margen:    +(g.margen / g.count).toFixed(1),
        pctRebate: +(g.pctRebate / g.count).toFixed(1),
      }));
      dimLabel = "Marca";
    } else {
      // Dimensions no soportadas V1 (sucursal/canal/tier): fail to legacy
      return null;
    }
  } catch (e) {
    return null;
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    // Piece 3 · 0 filas con aplicabilidad ya validada (campo real presente) → AVISAR terminal.
    // Distingue "no hay datos de X" (Makita en clientes) de "el filtro no mordió". Sin filtro: legacy.
    if (_filterOn && _hasFilter) return _qiVerdict("avisar", "absent", `No hay datos de ${_filterValuesStr(qi.filtros)} en la vista por ${_dimLabelEs(dim)}.`);
    return null;
  }

  // Resolver metrics (fields del row)
  const metricMap = {
    ventas:        { field: "venta",         label: "Ventas",        formatter: (v) => "$" + Math.round(v / 100) / 10 + "M" },
    margen:        { field: "margen",        label: "Margen",        formatter: (v) => v.toFixed(1) + "%" },
    contribucion:  { field: "contribucion",  label: "Contribución",  formatter: (v) => "$" + Math.round(v / 100) / 10 + "M" },
    carga:         { field: "pctRebate",     label: "Carga Comercial", formatter: (v) => v.toFixed(1) + "%" },
    aporte:        { field: "contribucion",  label: "Aporte",        formatter: (v) => "$" + Math.round(v / 100) / 10 + "M" },
    rentabilidad:  { field: "margen",        label: "Rentabilidad",  formatter: (v) => v.toFixed(1) + "%" },
    stock:         { field: "unidades",      label: "Unidades",      formatter: (v) => String(v) },
    participacion: { field: "venta",         label: "Participación", formatter: (v, total) => total ? ((v / total) * 100).toFixed(1) + "%" : "—" },
    cobertura:     null,
    rotacion:      null,
  };

  // Validar que todas las metrics solicitadas se pueden resolver con este dataset
  for (const m of qi.metrics) {
    const map = metricMap[m];
    if (!map) {
      // G1 · métrica de inventario (rotación/cobertura·DOH) no vive en datasets de margen → AVISAR (Fase 2.5)
      if (_filterOn && (m === "rotacion" || m === "cobertura")) {
        return _qiVerdict("avisar", "metric", `${m === "cobertura" ? "DOH/cobertura" : "Rotación"} vive en el inventario, fuera de esta vista de ventas/márgenes. (Fase 2.5)`);
      }
      return null;
    }
    if (!(map.field in rows[0])) return null;
  }

  // Sort + limit (ranked usa primera metric)
  let sortedRows = [...rows];
  const sortField = metricMap[qi.metrics[0]].field;
  sortedRows.sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0));
  if (qi.limit !== null && qi.limit > 0) {
    sortedRows = sortedRows.slice(0, qi.limit);
  }

  // Total para participación (si aplica)
  const totalVenta = rows.reduce((s, r) => s + (r.venta || 0), 0);

  // Build cuerpo tabular con NBSP padding
  const NBSP = "\u00A0";
  function padRight(s, width) {
    s = String(s);
    if (s.length >= width) return s.substring(0, width);
    return s + NBSP.repeat(width - s.length);
  }
  function padLeft(s, width) {
    s = String(s);
    if (s.length >= width) return s.substring(s.length - width);
    return NBSP.repeat(width - s.length) + s;
  }

  // Header dinámico
  const metricLabels = qi.metrics.map(m => metricMap[m].label);
  let scenarioLabel = "Bonanza";
  if (scenario === "tension") scenarioLabel = "Tensión";
  else if (scenario === "crisis") scenarioLabel = "Crisis";

  // Piece 3 · tag de filtro VISIBLE · si la extracción se equivocó, se ve en el header
  const _filterTag = (_filterOn && _hasFilter) ? ` · filtrado por: ${_filterValuesStr(qi.filtros)}` : "";
  let header;
  if (qi.queryType === "ranked") {
    header = `Top ${qi.limit} ${dimLabel === "Cliente" ? "clientes" : dimLabel === "SKU" ? "SKUs" : dimLabel === "Familia" ? "familias" : "marcas"} por ${metricLabels[0]} · escenario ${scenarioLabel}${_filterTag}.`;
  } else if (qi.queryType === "multi") {
    header = `${metricLabels.join(" y ")} por ${dimLabel} · escenario ${scenarioLabel}${_filterTag}.`;
  } else {
    header = `${metricLabels[0]} por ${dimLabel} · escenario ${scenarioLabel}${_filterTag}.`;
  }

  // Build tabla
  // Columna 0: nombre (max 22 char)
  // Columna 1..N: metrics formatted
  const NAME_W = 22;
  const METRIC_W = 12;
  let table = "";
  // Header row
  table += padRight(dimLabel, NAME_W);
  for (const lbl of metricLabels) table += padLeft(lbl, METRIC_W);
  table += "\n";
  // Separator
  table += "─".repeat(NAME_W + METRIC_W * metricLabels.length) + "\n";
  // Data rows
  for (const r of sortedRows) {
    const name = r[nameField] || r.nombre || "—";
    table += padRight(name, NAME_W);
    for (const m of qi.metrics) {
      const map = metricMap[m];
      const val = r[map.field];
      if (typeof val !== "number") {
        table += padLeft("—", METRIC_W);
      } else {
        table += padLeft(map.formatter(val, totalVenta), METRIC_W);
      }
    }
    table += "\n";
  }

  // Foco · breve insight ejecutivo del top1
  const top1 = sortedRows[0];
  const top1Name = top1?.[nameField] || top1?.nombre || "—";
  const top1Val = top1 ? top1[sortField] : null;
  const top1Formatted = top1Val !== null && top1Val !== undefined
    ? metricMap[qi.metrics[0]].formatter(top1Val, totalVenta)
    : "—";

  let foco;
  if (qi.queryType === "ranked") {
    foco = `Foco · ${top1Name} encabeza el ranking con ${top1Formatted} en ${metricLabels[0]}.`;
  } else {
    foco = `Foco · ${top1Name} concentra el mayor ${metricLabels[0]} (${top1Formatted}).`;
  }

  // ════════════════════════════════════════════════════════════════════════
  // BRIEF #9 · PIEZA 2 · RIL INTEGRATION
  //
  // Llamar al Retrieval Intelligence Layer con variables runtime directas.
  // try-catch defensivo · si RIL falla · passthrough opener actual sin Lectura.
  // Variables ril_* prefijadas · scoped al try-catch.
  // RIL NO toca foco original directamente · retorna enrichedFoco para
  // reemplazo controlado.
  // ════════════════════════════════════════════════════════════════════════
  let ril_readingLine = null;
  let ril_enrichedFoco = foco;
  try {
    const ril_result = retrievalIntelligenceLayer(
      qi, scenario, sortedRows, metricMap, sortField, foco, dim
    );
    if (ril_result && typeof ril_result === "object") {
      if (typeof ril_result.readingLine === "string" && ril_result.readingLine.length > 0) {
        ril_readingLine = ril_result.readingLine;
      }
      if (typeof ril_result.enrichedFoco === "string" && ril_result.enrichedFoco.length > 0) {
        ril_enrichedFoco = ril_result.enrichedFoco;
      }
    }
  } catch (ril_err) {
    // eslint-disable-next-line no-console
    console.warn("BRIEF #9 RIL error:", ril_err);
    // FAIL-SAFE: opener actual sin Lectura · foco original intacto
    ril_readingLine = null;
    ril_enrichedFoco = foco;
  }

  // Confianza · referencia escenario + dataset
  const confianza = `Cifras runtime del escenario ${scenarioLabel}. ${sortedRows.length} ${dimLabel.toLowerCase()}(s) en la respuesta.`;

  // Build opener · Lectura insertada entre tabla y Foco si presente
  let opener;
  if (ril_readingLine) {
    opener = `${header}\n\n${table}\n${ril_readingLine}\n\n${ril_enrichedFoco}\n\n${confianza}`;
  } else {
    opener = `${header}\n\n${table}\n${ril_enrichedFoco}\n\n${confianza}`;
  }

  // Suggestions contextuales · 3 invitaciones a profundizar
  const suggestions = [];
  if (qi.queryType !== "ranked") {
    suggestions.push(`Top 5 ${dimLabel.toLowerCase()}s por ${metricLabels[0]}`);
  }
  if (qi.metrics.length === 1 && qi.metrics[0] !== "margen") {
    suggestions.push(`${metricLabels[0]} y margen por ${dimLabel.toLowerCase()}`);
  } else if (qi.metrics.length === 1 && qi.metrics[0] === "margen") {
    suggestions.push(`Ventas y margen por ${dimLabel.toLowerCase()}`);
  }
  if (suggestions.length < 3) suggestions.push(`¿Cómo está el ${dimLabel === "Cliente" ? "negocio por cliente" : dimLabel === "SKU" ? "portafolio de productos" : "mix por familia"}?`);
  while (suggestions.length < 3) suggestions.push("¿Qué más querés explorar?");

  return {
    opener,
    // BRIEF N-bis · Tipo A puro · suggestions filtradas
    suggestions: filterTextualSuggestions(suggestions.slice(0, 3)),
    sentrixAction: null,
    derivedIntentType: "query_interpreter",
    // ADI Core · Fix B · señal de SCOPE · si la respuesta está filtrada, _finalize omite la narrativa
    // GLOBAL (suffix proactivo) que no puede probar que respeta el filtro. Sin filtro → false → suffix normal.
    _filtered: _hasFilter,
    // FIX FOUNDATION-REASONER · campos aditivos · backward compat estricta
    // Permite QI Guard poblar lastClientList/lastSkuList sin recomputar.
    // sortedRows ya está ordenado+sliced por composeRetrieval · single source
    // of truth. nameField default "nombre" para cliente/familia/marca · para
    // sku/producto la key real es "sku" pero el filtro tolera ambos (fallback
    // r.nombre captura familia/marca · primer hit gana).
    entities: sortedRows
      .map(r => r[nameField] || r.nombre || r.sku)
      .filter(n => typeof n === "string" && n.length > 0),
    entityDim: dim,
    // RETRIEVALFIX→CONTRATO (ARCO B) · exponer las CIFRAS del ranking — las MISMAS
    // de la tabla (sortField + formatter primario del metricMap) — alineadas 1:1
    // con `entities` (mismo orden de sortedRows · misma resolución de nombre).
    // CERO recompute · CERO formato nuevo · si un row no trae número → se omite
    // (honesto · el cruce nombre↔cifra servirá ese nombre sin cifra, no inventa).
    materialMetrics: sortedRows.map(r => {
      const _name = r[nameField] || r.nombre || r.sku;
      if (typeof _name !== "string" || !_name.length) return null;
      const _raw = r[sortField];
      if (typeof _raw !== "number") return null;
      return { entity: _name, metric: metricLabels[0] || "Valor", value: metricMap[qi.metrics[0]].formatter(_raw, totalVenta) };
    }).filter(Boolean),
  };
}
