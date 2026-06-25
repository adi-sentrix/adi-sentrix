/* === adi/core/spine.js · ADI Core Fase 2.1a ===
 * El pipeline (Intent Resolver → Validation → Planner → Query Engine → render) para UN slice angosto:
 * "superlativo por dimensión SIN filtro" → qué [marca|familia] [peor|mejor] [métrica].
 *
 * Guard anti-overshadow (el riesgo #1 del red-team): reclama SOLO dimensión marca/familia, que
 * ranking_extremes NO puede alcanzar (RANKING_EXTREMES_METRICS solo tiene cliente/sku) → mismatch
 * garantizado. cliente/sku/filtros/"por" → devuelve null y CAE al camino viejo intacto.
 *
 * Cero cálculo reescrito: reusa queryInterpreter + composeRetrieval ("{métrica} por {dimensión}") y
 * toma el extremo de materialMetrics (ya ordenado desc, con el valor ya formateado). Flag-gated.
 * Produce un objeto-plan evidence-ready (semilla del payload) que NO se emite todavía (eso es 2.1d). */
import { ADI_CORE_SPINE_ENABLED, ADI_SPINE_DIM_SUPERLATIVE_ENABLED } from "../../config/voiceFlags.js";
import { METRIC_REGISTRY } from "../../config/semantic/metricRegistry.js";
import { DIMENSION_REGISTRY } from "../../config/semantic/dimensionRegistry.js";
import { isAvailable, unavailableMessage } from "./availabilityMap.js";
import { queryInterpreter, composeRetrieval } from "../composers/qiRetrieval.js";
import { detectBrandInText } from "../detectors.js";
import { detectAllClientsInText, detectAllFamiliesInText } from "../router.js";

const _norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!]/g, "").trim();
const _has = (norm, term) => new RegExp("\\b" + _norm(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(norm);

// marcadores de superlativo (dirección) · top = mayor/mejor · bottom = menor/peor
const _SUPERLATIVE_BOTTOM = ["peor", "menor", "mas bajo", "mas baja", "minimo", "minima", "que menos", "mas chico", "mas chica", "menos"];
const _SUPERLATIVE_TOP    = ["mejor", "mayor", "mas alto", "mas alta", "maximo", "maxima", "que mas", "mas grande"];

// firma del slice: superlativo + dimensión marca/familia + métrica + SIN "por" + SIN filtro nombrado
function _resolveFirma(text) {
  const norm = _norm(text);
  if (/\bpor\b/.test(norm)) return null;                       // "por" → es trabajo de QI, no del slice

  // dirección (superlativo) — requerida
  let direction = null;
  for (const w of _SUPERLATIVE_BOTTOM) if (_has(norm, w)) { direction = "bottom"; break; }
  if (!direction) for (const w of _SUPERLATIVE_TOP) if (_has(norm, w)) { direction = "top"; break; }
  if (!direction) return null;

  // dimensión — SOLO marca/familia (las que el viejo no alcanza = guard de mismatch)
  let dimKey = null;
  for (const [key, def] of Object.entries(DIMENSION_REGISTRY)) {
    if (def.reachableByLegacy) continue;
    if ((def.vocabulary || []).some(t => _has(norm, t))) { dimKey = key; break; }
  }
  if (!dimKey) return null;

  // métrica
  let metricKey = null;
  for (const [key, def] of Object.entries(METRIC_REGISTRY)) {
    if ((def.vocabulary || []).some(t => _has(norm, t))) { metricKey = key; break; }
  }
  if (!metricKey) return null;

  // SIN filtro: si hay una entidad ESPECÍFICA nombrada (marca/cliente/familia), es 2.1b → cae al viejo
  if (detectBrandInText(text)) return null;
  if ((detectAllClientsInText(text, { strict: true }) || []).length) return null;
  if ((detectAllFamiliesInText(text, { strict: true }) || []).length) return null;

  return { dimKey, metricKey, direction };
}

export function resolveDimensionalSuperlative(text, scenario) {
  if (!ADI_CORE_SPINE_ENABLED || !ADI_SPINE_DIM_SUPERLATIVE_ENABLED) return null;   // flag OFF → inerte (cae al viejo)
  if (!text || typeof text !== "string") return null;

  const firma = _resolveFirma(text);
  if (!firma) return null;
  const { dimKey, metricKey, direction } = firma;
  const metric = METRIC_REGISTRY[metricKey];

  // VALIDATION · ¿el dominio de la métrica está disponible? (Availability Map generaliza el muro)
  if (!isAvailable(metric.domain)) {
    return { _spine: true, route: "spine_dim_unavailable", opener: unavailableMessage(metric.domain) };
  }

  // PLANNER + QUERY ENGINE · reuso del cómputo QI ("{qiKey} por {dimKey}") · cero recálculo
  if (!metric.qiKey) return null;                              // disponible pero sin path QI → cae al viejo (defensivo)
  const qi = queryInterpreter(`${metric.qiKey} por ${dimKey}`, scenario);
  if (!qi || !qi.isRetrieval) return null;
  const resp = composeRetrieval(qi, scenario);
  if (!resp || !Array.isArray(resp.materialMetrics) || resp.materialMetrics.length === 0) return null;

  // selección del extremo · materialMetrics viene ordenado DESC (single source of truth de composeRetrieval)
  const mm = resp.materialMetrics;
  const pick = direction === "bottom" ? mm[mm.length - 1] : mm[0];
  const opp  = direction === "bottom" ? mm[0] : mm[mm.length - 1];
  const dimWord = DIMENSION_REGISTRY[dimKey].label;
  const dirWord = direction === "bottom" ? "menor" : "mayor";
  const oppWord = direction === "bottom" ? "mayor" : "menor";
  const ml = (pick.metric || metric.label).toLowerCase();

  let opener = `${pick.entity} es la ${dimWord} con ${dirWord} ${ml} · ${pick.value}.`;
  if (opp && opp.entity !== pick.entity) opener += ` La de ${oppWord} es ${opp.entity} · ${opp.value}.`;

  return {
    _spine: true,
    route: "spine_dim_superlative",
    opener,
    // objeto-plan evidence-ready (NO se emite hasta 2.1d · acá solo nace)
    _plan: { metric: metricKey, dimension: dimKey, direction, domain: metric.domain, formula: metric.formula, source: "queryInterpreter+composeRetrieval", rows_used: mm.length },
  };
}
