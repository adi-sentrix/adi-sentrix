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
import { ADI_CORE_SPINE_ENABLED, ADI_SPINE_DIM_SUPERLATIVE_ENABLED, ADI_SPINE_FILTER_ENABLED, ADI_SPINE_FILTER_CLARIFY_ENABLED, ADI_QI_FILTER_ENABLED } from "../../config/voiceFlags.js";
import { METRIC_REGISTRY } from "../../config/semantic/metricRegistry.js";
import { DIMENSION_REGISTRY } from "../../config/semantic/dimensionRegistry.js";
import { isAvailable, unavailableMessage } from "./availabilityMap.js";
import { queryInterpreter, composeRetrieval } from "../composers/qiRetrieval.js";
import { detectBrandInText } from "../detectors.js";
import { detectAllClientsInText, detectAllFamiliesInText } from "../router.js";

const _norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!]/g, "").trim();
const _has = (norm, term) => new RegExp("\\b" + _norm(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(norm);

// marcadores de superlativo (dirección) · top = mayor/mejor · bottom = menor/peor
const _SUPERLATIVE_BOTTOM = ["peor", "menor", "mas bajo", "mas baja", "minimo", "minima", "que menos", "mas chico", "mas chica", "menos", "mas debil", "mas debiles", "debil"];
const _SUPERLATIVE_TOP    = ["mejor", "mayor", "mas alto", "mas alta", "maximo", "maxima", "que mas", "mas grande", "mas"];

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
    if (ADI_QI_FILTER_ENABLED) return null;   // coexistencia: el muro/Fix A (activo) maneja inventario con su mensaje específico
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

// ── Fase 2.1b · filtro simple NOMBRADO (marca/familia) sin "por" ──────────────────────────────────
// Firma: métrica + filtro marca/familia ESPECÍFICO + (superlativo O dimensión explícita) + SIN "por"/"vs".
// Disjunta de 2.1a (que exige NO entidad nombrada). Las marcas/familias se detectan confiables sin conector
// (detectBrandInText es word-boundary robusto); el conector "de/en" se usa para el caso COMBINADO cliente
// (donde el detector strict de cliente falla) → marca+cliente específico = 2.1c → AVISA (el dato no tiene el cruce).
// Cero recálculo: arma "{métrica} por {dim} de {filtro}" y reusa el escudo QI vía opts.spineFilter.
const _CONN = "(?:de|del|en)\\s+(?:la\\s+|las\\s+|los\\s+|el\\s+|marca\\s+|familia\\s+|categoria\\s+)*";
function _afterConnector(norm, name) {
  const n = _norm(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("\\b" + _CONN + n + "\\b").test(norm);
}
// 2.1b-2 · métricas-eje OFRECIBLES en la pregunta ACLARAR: las que el Semantic Layer marca axis,
// tienen path QI, y cuyo dominio está DISPONIBLE (Availability Map) → ventas/margen/contribución.
// NUNCA inventario (bloqueado) → cero Cabo-2 leak. Orden natural fijo.
function _clarifyMetrics() {
  return ["ventas", "margen", "contribucion"]
    .filter(k => METRIC_REGISTRY[k] && METRIC_REGISTRY[k].axis && METRIC_REGISTRY[k].qiKey && isAvailable(METRIC_REGISTRY[k].domain))
    .map(k => METRIC_REGISTRY[k].label.toLowerCase());
}

export function resolveFilteredRetrieval(text, scenario) {
  if (!ADI_CORE_SPINE_ENABLED || !ADI_SPINE_FILTER_ENABLED) return null;   // flag OFF → inerte
  if (!text || typeof text !== "string") return null;
  const norm = _norm(text);
  if (/\bpor\b/.test(norm)) return null;                       // "por" → QI
  if (/\bvs\b|\bversus\b/.test(norm)) return null;             // "vs" → comparación

  // filtro NOMBRADO marca/familia (detección confiable sin conector · cliente-como-filtro NO es 2.1b)
  const brand = detectBrandInText(text);
  const fams = detectAllFamiliesInText(text, { strict: true }) || [];
  let filterValue = null, filterAxis = null;
  if (brand) { filterValue = brand; filterAxis = "marca"; }
  else if (fams.length) { filterValue = fams[0]; filterAxis = "familia"; }
  if (!filterValue) return null;                               // sin marca/familia nombrada → no es 2.1b

  // COMBINADO marca/familia + cliente específico (tras conector) → 2.1c · AVISA (no inventa el cruce)
  const specificClient = (detectAllClientsInText(text, { strict: true }) || []).find(c => _afterConnector(norm, c));
  if (specificClient) {
    return { _spine: true, route: "spine_filter_combinado_avisar", suggestions: null,
      opener: `"${filterValue} en ${specificClient}" cruza marca y cliente, y ese cruce no vive en los datos como dato firme (cada cliente tiene su marca dominante, no el detalle por marca dentro del cliente). Te puedo dar ${filterValue} por separado, o el detalle de ${specificClient}. ¿Cuál?` };
  }

  // dimensión: explícita (cliente/sku/marca/familia genérico) o inferida = sku (el grano del producto)
  let dimKey = null;
  for (const [key, def] of Object.entries(DIMENSION_REGISTRY)) {
    if ((def.vocabulary || []).some(t => _has(norm, t))) { dimKey = key; break; }
  }
  const hadExplicitDim = !!dimKey;
  if (!dimKey) dimKey = "sku";

  // superlativo (opcional)
  let direction = null;
  for (const w of _SUPERLATIVE_BOTTOM) if (_has(norm, w)) { direction = "bottom"; break; }
  if (!direction) for (const w of _SUPERLATIVE_TOP) if (_has(norm, w)) { direction = "top"; break; }

  // métrica
  let metricKey = null;
  for (const [key, def] of Object.entries(METRIC_REGISTRY)) {
    if ((def.vocabulary || []).some(t => _has(norm, t))) { metricKey = key; break; }
  }
  // ── Fase 2.1b-2 · filtro + superlativo SIN métrica explícita → ACLARAR (regla madre · no adivina la métrica) ──
  // La rama vive DENTRO de !metricKey → si hay métrica, ni se evalúa (imposible robar un caso que RESPONDE).
  if (!metricKey) {
    if (ADI_SPINE_FILTER_CLARIFY_ENABLED && direction) {
      const _ms = _clarifyMetrics();                           // métricas-eje DISPONIBLES del Semantic Layer (NUNCA inventario)
      const _dimW = (DIMENSION_REGISTRY[dimKey] && DIMENSION_REGISTRY[dimKey].label) || "ítem";
      const _art = (dimKey === "sku" || dimKey === "cliente") ? "el" : "la";
      const _dir = direction === "bottom" ? "peor" : "mejor";
      const _cap = _art.charAt(0).toUpperCase() + _art.slice(1);
      const _list = _ms.join(", ").replace(/, ([^,]+)$/, " o $1");
      return { _spine: true, route: "spine_filter_clarify",
        opener: `¿${_cap} ${_dir} ${_dimW} de ${filterValue} en qué: ${_list}?`,
        suggestions: _ms.map(m => `${_cap} ${_dir} ${_dimW} de ${filterValue} en ${m}`) };
    }
    return null;                                               // sin métrica (+ sin superlativo, o flag off) → cae al viejo
  }
  const metric = METRIC_REGISTRY[metricKey];

  // VALIDATION · dominio disponible (inventario bajo filtro → AVISA vía Availability Map)
  if (!isAvailable(metric.domain)) {
    if (ADI_QI_FILTER_ENABLED) return null;   // coexistencia: el muro/Fix A (activo) maneja inventario con su mensaje específico
    return { _spine: true, route: "spine_filter_unavailable", suggestions: null, opener: unavailableMessage(metric.domain, { filterName: filterValue }) };
  }
  if (!metric.qiKey) return null;

  // mismatch: exigir superlativo O dimensión explícita (sin eso, "el margen de Bosch" → brand_dive del viejo)
  if (!direction && !hadExplicitDim) return null;

  // PLANNER + QUERY ENGINE · reuso del escudo QI ("{métrica} por {dim} de {filtro}") con opts.spineFilter
  const qi = queryInterpreter(`${metric.qiKey} por ${dimKey} de ${filterValue}`, scenario, null, { spineFilter: true });
  if (!qi || !qi.isRetrieval) return null;
  const resp = composeRetrieval(qi, scenario, { spineFilter: true });
  if (!resp) return null;
  // el escudo habló (no-reconocido / inaplicable / 0-filas / multidim / métrica inventario) → AVISA/ACLARA
  if (resp._verdict) return { _spine: true, route: "spine_filter_" + resp._verdict, opener: resp.opener, suggestions: resp.suggestions || null };

  const _planBase = { metric: metricKey, dimension: dimKey, filtros: { [filterAxis === "marca" ? "marcas" : "sfamilias"]: [filterValue] }, domain: metric.domain, formula: metric.formula };

  if (direction) {
    if (!Array.isArray(resp.materialMetrics) || resp.materialMetrics.length === 0) return null;
    const mm = resp.materialMetrics;
    const pick = direction === "bottom" ? mm[mm.length - 1] : mm[0];
    const dimWord = DIMENSION_REGISTRY[dimKey].label;
    const _art = (dimKey === "sku" || dimKey === "cliente") ? "el" : "la";
    const dirWord = direction === "bottom" ? "menor" : "mayor";
    const ml = (pick.metric || metric.label).toLowerCase();
    const opener = `${pick.entity} es ${_art} ${dimWord} de ${filterValue} con ${dirWord} ${ml} · ${pick.value}.`;
    return { _spine: true, route: "spine_filter_superlative", opener, suggestions: null, _plan: { ..._planBase, direction, rows_used: mm.length } };
  }

  // sin superlativo → la tabla filtrada (render de composeRetrieval · con tag "filtrado por: X")
  return { _spine: true, route: "spine_filter_table", opener: resp.opener, suggestions: resp.suggestions || null, _plan: _planBase };
}
