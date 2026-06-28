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
import { ADI_CORE_SPINE_ENABLED, ADI_SPINE_DIM_SUPERLATIVE_ENABLED, ADI_SPINE_FILTER_ENABLED, ADI_SPINE_FILTER_CLARIFY_ENABLED, ADI_SPINE_EVIDENCE_ENABLED, ADI_SPINE_COMBINED_ENABLED, ADI_QI_FILTER_ENABLED, ADI_INV_INMOVILIZADO_ENABLED, ADI_INV_NL_VOCAB_ENABLED } from "../../config/voiceFlags.js";
import { METRIC_REGISTRY } from "../../config/semantic/metricRegistry.js";
import { DIMENSION_REGISTRY } from "../../config/semantic/dimensionRegistry.js";
import { isAvailable, unavailableMessage } from "./availabilityMap.js";
import { queryInterpreter, composeRetrieval } from "../composers/qiRetrieval.js";
import { detectBrandInText } from "../detectors.js";
import { detectAllClientsInText, detectAllFamiliesInText, detectAllWarehousesInText } from "../router.js";

const _norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!]/g, "").trim();
const _has = (norm, term) => new RegExp("\\b" + _norm(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(norm);

// marcadores de superlativo (dirección) · top = mayor/mejor · bottom = menor/peor
const _SUPERLATIVE_BOTTOM = ["peor", "menor", "mas bajo", "mas baja", "minimo", "minima", "que menos", "mas chico", "mas chica", "menos", "mas debil", "mas debiles", "debil"];
const _SUPERLATIVE_TOP    = ["mejor", "mayor", "mas alto", "mas alta", "maximo", "maxima", "que mas", "mas grande", "mas"];

// ── Fase 2.5a/b · lexicones del resolver de inventario ──
// Atomicidad future-proof: cada concepto de inventario mapea a su métrica · el guard AVISA si la query nombra
// OTRO concepto (≠ el detectado) cuya métrica NO está disponible. Se "apaga" solo a medida que se modela (isAvailable).
const _INV_CONCEPTS = [
  { re: /\brotaci/,                                              m: "rotacion" },   // 2.5a
  { re: /\bdoh\b|\bcobertura\b/,                                 m: "doh" },        // 2.5b
  { re: /\bcapital\b|inmoviliz|detenid|atrapad|stock\s*usd|d[ií]as\s+sin\s+vent/, m: "capital" }, // 2.5c-1
  { re: /\bbodegas?\b|\bsucursal(?:es)?\b/,                      m: "bodega" },     // 2.5d (no modelada aún)
];
const _COMM_METRIC = /\bventas?\b|\bmargen|\bcontribuci|\brentabilidad\b|\bcarga\b|\baporte/;              // nombra comercial → no es inventario puro → defiere
const _NONSKU_DIM = /\bpor\s+(bodegas?|sucursal(?:es)?|clientes?|canal|familias?|marcas?)\b/;             // otra dimensión nombrada → 2.5d → defiere
const _ANAPHORIC = /^(y\s+)?(su|sus|ese|esa|esos|esas|este|esta|estos|el\s+(primero|segundo|tercero|cuarto|ultimo|mismo))\b/; // follow-up deíctico → no es query fresca → defiere

// ── Fase 2.1d · evidence payload ─────────────────────────────────────────────────────────────────
// Construye los 10 campos del NORTE del MISMO _plan que produjo la respuesta (single source · cero recálculo).
// Campo HERMANO del retorno · NUNCA toca el .text. Flag-gated → undefined si OFF (no se emite).
const _DIM_SOURCE = { cliente: "clientesMargen", marca: "clientesMargen", sku: "skusMargen", producto: "skusMargen", familia: "sfamiliasMargen" };
function _evidence(scenario, { metricKey = null, dimKey = null, filtros = {}, operacion = null, formula = null, rowsUsed = null, unsupported = [], invMetric = false } = {}) {
  if (!ADI_SPINE_EVIDENCE_ENABLED) return undefined;
  return {
    query_plan: { metrica: metricKey, dimension: dimKey, filtros, operacion },
    metrica: metricKey,
    dimension: dimKey,
    filtros,
    periodo: scenario || "bonanza",
    formula,
    fuente: invMetric ? "skuInventario" : (_DIM_SOURCE[dimKey] || null),
    filas_usadas: rowsUsed,
    confianza: "determinística",
    unsupported_clauses: unsupported,
  };
}

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
  if (!isAvailable(metric.domain, metricKey)) {   // Fase 2.5 · per-métrica · rotación disponible → salta el AVISA (qiKey null → cae al resolver de inventario)
    if (ADI_QI_FILTER_ENABLED) return null;   // coexistencia: el muro/Fix A (activo) maneja inventario con su mensaje específico
    return { _spine: true, route: "spine_dim_unavailable", opener: unavailableMessage(metric.domain),
      evidence: _evidence(scenario, { metricKey, dimKey, operacion: "avisar", formula: metric.formula, invMetric: true, unsupported: [{ kind: "domain_unavailable", raw: metric.domain, phase: "2.5" }] }) };
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
    _plan: { metric: metricKey, dimension: dimKey, direction, domain: metric.domain, formula: metric.formula, source: "queryInterpreter+composeRetrieval", rows_used: mm.length },
    evidence: _evidence(scenario, { metricKey, dimKey, operacion: direction === "bottom" ? "rank_bottom" : "rank_top", formula: metric.formula, rowsUsed: mm.length, unsupported: [] }),
  };
}

// ── Fase 2.5a · resolver de INVENTARIO (métrica MODELADA por SKU · rotación) ───────────────────────
// Camino MODELADO con evidence (NO ranking_extremes/bundles): detecta una métrica de inventario DISPONIBLE
// (per-flag) por SKU, recompone "{metric} por sku [de filtro]" → composeRetrieval (lee skuInventario vía
// _invAvail) → extremo (si hay dirección) o tabla → evidence (fórmula + fuente:skuInventario + operación).
// Corre ANTES del muro. Atomicidad: si nombra OTRA métrica de inventario NO modelada → AVISA (no mezcla).
// Defiere (null): métrica no disponible (→ muro AVISA), dimensión no-SKU (→ 2.5d), o query comercial/cruzada.
export function resolveInventoryRetrieval(text, scenario) {
  if (!text || typeof text !== "string") return null;
  const norm = _norm(text);
  const _bodegaAvail = isAvailable("inventario", "bodega");

  // 2.5d · "qué bodega está complicada" → especial: capital INMOVILIZADO por bodega (vista sin métrica explícita).
  const _complicada = _bodegaAvail && (/\bcomplicad|\bproblematic|peor\s+bodega/.test(norm)
    || (ADI_INV_NL_VOCAB_ENABLED && /\bbodega[\s\w]{0,14}\b(peor|mal|jodid|complicad)/.test(norm)));   // tanda 2b · "qué bodega está peor/mal"

  // (1) ¿nombra una métrica de inventario? (la primera que matchee su vocabulario)
  let metricKey = null;
  for (const [key, def] of Object.entries(METRIC_REGISTRY)) {
    if (def.domain !== "inventario") continue;
    if ((def.vocabulary || []).some(t => _has(norm, t))) { metricKey = key; break; }
  }
  if (!metricKey && _complicada) metricKey = "capital";          // "complicada" sin métrica → capital (inmovilizado)
  // tanda 2b · reconocimiento NL (flag ON · ADITIVO: solo si el registro no detectó métrica) · sinónimos del dueño →
  // métrica de inventario. "parado/stock muerto/plata dormida" → capital INMOVILIZADO · "no se mueve/vende/rota" → rotación.
  let _nlInmov = false, _nlWorst = false;
  if (!metricKey && ADI_INV_NL_VOCAB_ENABLED) {
    if (/\bparad[oa]s?\b|\bvarad|\bfrenad|\bestancad|\bmuert|stock\s+muerto|plata\s+dormida|\bdormid/.test(norm)) { metricKey = "capital"; _nlInmov = true; _nlWorst = true; }
    else if (/no\s+se\s+(mueve|mueven|vende|venden)|no\s+rota[ns]?|no\s+gira[ns]?|casi\s+no\s+(se\s+)?vend/.test(norm)) { metricKey = "rotacion"; _nlWorst = true; }
  }
  if (!metricKey) return null;                                   // sin métrica de inventario → no es nuestro
  const metric = METRIC_REGISTRY[metricKey];

  // (2) VALIDATION · disponibilidad per-flag · NO disponible → null (cae al muro, que AVISA) · gate del flag → inerte OFF
  if (!isAvailable("inventario", metricKey)) return null;

  // 2.5d · bodega como DIMENSIÓN (group-by) cuando la query nombra bodega/sucursal Y bodega está modelada.
  // Es un EJE válido (no una métrica) → NO defiere por los guards de dim-no-SKU. La regla madre: si bodega NO está
  // modelada, "por bodega" cae a los defers de abajo (→ muro AVISA · cruce no soportado).
  const _bodegaDim = _bodegaAvail && (_complicada || /\bbodegas?\b|\bsucursal/.test(norm));

  // (3) query comercial/cruzada → defiere · dimensión no-SKU (vía "por X") → defiere SALVO bodega modelada
  if (_COMM_METRIC.test(norm)) return null;
  if (_NONSKU_DIM.test(norm) && !_bodegaDim) return null;

  // (3a) dimensión no-SKU como TARGET ("qué marca tiene peor rotación") → defiere · EXCEPTO bodega modelada (eje válido).
  // "de la familia X"/"de Bosch" es FILTRO (no target). SKU explícito siempre gana.
  const _hasSkuWord = /\bskus?\b|\bproductos?\b/.test(norm);
  const _hasNonSkuDimWord = /\b(marcas?|familias?|bodegas?|sucursal(?:es)?|clientes?|canal(?:es)?)\b/.test(norm);
  const _dimWordAsFilter = /\bde\s+(la\s+|el\s+|las\s+|los\s+)?(marca|familia|bodega|sucursal|cliente|canal)/.test(norm);
  if (_hasNonSkuDimWord && !_hasSkuWord && !_dimWordAsFilter && !_bodegaDim) return null;

  // (3b) follow-up deíctico ("y su rotación", "el segundo rota cuánto") → defiere · resolvemos queries FRESCAS.
  if (_ANAPHORIC.test(norm)) return null;

  // (3c) dirección: CALIDAD (peor/mejor · polaridad) O VALOR (más/menos · directo). wantHigh = ¿el de mayor valor?
  let wantHigh = null, _dirWord = null, _oppWord = null;
  if (/\bpeor(es)?\b|mas\s+debil|\bdebil(es)?\b/.test(norm))      { wantHigh = !!metric.higherIsWorse; _dirWord = "peor";  _oppWord = "mejor"; }
  else if (/\bmejor(es)?\b/.test(norm))                          { wantHigh = !metric.higherIsWorse;  _dirWord = "mejor"; _oppWord = "peor"; }
  else if (/mas\s+(baja|bajo|chica|chico)|\bmenor(es)?\b|\bminim|que\s+menos|\bmenos\b/.test(norm)) { wantHigh = false; _dirWord = "menos"; _oppWord = "más"; }
  else if (/mas\s+(alta|alto|grande|elevad)|\bmayor(es)?\b|\bmaxim|que\s+mas|\bmas\b/.test(norm))   { wantHigh = true;  _dirWord = "más";   _oppWord = "menos"; }
  // 2.5c-1 · anchor "estado-malo" (inmovilizado/detenido/atrapado) · SIN "más"/"peor" implica el extremo PEOR.
  else if (/\binmoviliz|\bdetenid|\batrapad|\bestancad/.test(norm))                                { wantHigh = !!metric.higherIsWorse; _dirWord = "más"; _oppWord = "menos"; }
  // 2.5d · "complicada" sin dirección explícita → la PEOR bodega (más capital inmovilizado).
  if (_complicada && wantHigh === null) { wantHigh = true; _dirWord = "más"; _oppWord = "menos"; }
  // tanda 2b · "parado/no se mueve/stock muerto" implican el extremo PEOR (capital: el más inmovilizado · rotación: el más bajo).
  if (_nlWorst && wantHigh === null) { wantHigh = !!metric.higherIsWorse; _dirWord = metric.higherIsWorse ? "más" : "menos"; _oppWord = metric.higherIsWorse ? "menos" : "más"; }
  const _hasDir = wantHigh !== null;
  const _filtro = detectBrandInText(text) || (detectAllFamiliesInText(text, { strict: true }) || [])[0] || null;
  // 2.5d · bodega VALUE como FILTRO ("capital de Antofagasta") · solo si NO es dim=bodega.
  const _bodegaFiltro = (_bodegaAvail && !_bodegaDim) ? ((detectAllWarehousesInText(text) || []).find(w => w && w !== "Todas") || null) : null;
  if (!_hasDir && !_filtro && !_hasSkuWord && !_bodegaDim && !_bodegaFiltro) return null;

  // (4) ATOMICIDAD · nombra OTRA métrica de inventario (≠ la detectada) que NO está disponible → AVISA (no mezcla
  // modelada+no-modelada). Mezclar dos MODELADAS (ej. rotación+DOH) NO avisa (la primera detectada responde).
  if (_INV_CONCEPTS.some(c => c.m !== metricKey && c.re.test(norm) && !isAvailable("inventario", c.m))) {
    return { _spine: true, route: "spine_inv_atomicity_avisar", opener: unavailableMessage("inventario"),
      evidence: _evidence(scenario, { metricKey, dimKey: "sku", operacion: "avisar", formula: metric.formula, invMetric: true,
        unsupported: [{ kind: "mixed_metric_status", raw: "inventario_no_modelado", phase: "2.5" }] }) };
  }

  // (5) PLANNER + QUERY ENGINE · recompone reusando composeRetrieval. Las métricas EN el QI_VOCAB (rotación→rotacion,
  // DOH→cobertura) recomponen directo; las que NO (capital · a propósito, para no tocar el "stock" comercial) usan un
  // placeholder de inventario (rotacion) + swap de qi.metrics → composeRetrieval resuelve el campo vía metricMap[capital].
  // 2.5c-2 · el anchor "inmovilizado/detenido/atrapado" del CAPITAL refina al subconjunto Def2 (flag-gated · requiere
  // capital ON). "capital" a secas NO → vista amplia. Pasa invInmovilizado a composeRetrieval (filtra Def2).
  // 2.5c-2 · el anchor inmovilizado/detenido del capital filtra Def2 (flag) · 2.5d · "complicada" lo fuerza (es su def).
  const _inmovilizado = (ADI_INV_INMOVILIZADO_ENABLED && metricKey === "capital" && /\binmoviliz|\bdetenid|\batrapad/.test(norm)) || _complicada || _nlInmov;
  const _dim = _bodegaDim ? "sucursal" : "sku";                  // 2.5d · bodega como dimensión
  // el evidence refleja el subconjunto/eje: la "boleta" dice que es el Def2 (si aplica) y la dimensión real.
  const _evFiltros = { ...(_filtro ? { marca_o_familia: _filtro } : {}), ...(_bodegaFiltro ? { bodega: _bodegaFiltro } : {}), ...(_inmovilizado ? { subconjunto: "inmovilizado (Def2: alerta crit/warn O rotación<2)" } : {}) };
  const _evFormula = _inmovilizado ? metric.formula + " · subconjunto Def2 (alerta crit/warn O rotación<2)" : metric.formula;
  const _mlSuffix = _inmovilizado ? " inmovilizado" : "";

  const _gloss = `por ${_dim}${(!_bodegaDim && _filtro) ? " de " + _filtro : ""}`;
  let qi = queryInterpreter(`${metricKey} ${_gloss}`, scenario);
  if (!qi || !qi.isRetrieval) {
    qi = queryInterpreter(`rotacion ${_gloss}`, scenario);
    if (qi && qi.isRetrieval) qi.metrics = [metricKey];
  }
  if (!qi || !qi.isRetrieval) return null;
  const resp = composeRetrieval(qi, scenario, { spineFilter: true, invInmovilizado: _inmovilizado, invBodega: _bodegaFiltro });
  if (!resp || !Array.isArray(resp.materialMetrics) || resp.materialMetrics.length === 0) return null;
  const mm = resp.materialMetrics;
  const _dimNoun = _bodegaDim ? "la bodega" : "el SKU";
  const _filGloss = _filtro ? " de " + _filtro : (_bodegaFiltro ? " de " + _bodegaFiltro : "");

  // (6) dirección → extremo (one-liner con evidence) · sin dirección → la tabla de composeRetrieval
  if (_hasDir) {
    // mm viene DESC. wantHigh → mm[0] (valor más alto) · !wantHigh → mm[last] (más bajo). La calidad ya se resolvió
    // a wantHigh vía la polaridad (peor DOH = alto · peor rotación = bajo). _dirWord es la palabra natural del pedido.
    const pick = wantHigh ? mm[0] : mm[mm.length - 1];
    const opp  = wantHigh ? mm[mm.length - 1] : mm[0];
    const ml = (pick.metric || metric.label).toLowerCase() + _mlSuffix;
    let opener = `${pick.entity} es ${_dimNoun} con ${_dirWord} ${ml}${_filGloss} · ${pick.value}.`;
    if (opp && opp.entity !== pick.entity) opener += ` ${_bodegaDim ? "La" : "El"} de ${_oppWord} es ${opp.entity} · ${opp.value}.`;
    return {
      _spine: true, route: "spine_inv_superlative", opener,
      _plan: { metric: metricKey, dimension: _dim, direction: wantHigh ? "high" : "low", domain: "inventario", inmovilizado: _inmovilizado, formula: _evFormula, source: "queryInterpreter+composeRetrieval", rows_used: mm.length },
      evidence: _evidence(scenario, { metricKey, dimKey: _dim, filtros: _evFiltros, operacion: (wantHigh ? "rank_top" : "rank_bottom") + (_inmovilizado ? "_inmovilizado" : ""), formula: _evFormula, rowsUsed: mm.length, invMetric: true }),
    };
  }
  // sin dirección → tabla (reusa la respuesta de composeRetrieval · route + evidence de inventario)
  return {
    _spine: true, route: "spine_inv_retrieval", opener: resp.opener, suggestions: resp.suggestions || null,
    evidence: _evidence(scenario, { metricKey, dimKey: _dim, filtros: _evFiltros, operacion: "rank" + (_inmovilizado ? "_inmovilizado" : ""), formula: _evFormula, rowsUsed: mm.length, invMetric: true }),
  };
}

// ── Fase 2.1b · filtro simple NOMBRADO (marca/familia) sin "por" ──────────────────────────────────
// Firma: métrica + filtro marca/familia ESPECÍFICO + (superlativo O dimensión explícita) + SIN "por"/"vs".
// Disjunta de 2.1a (que exige NO entidad nombrada). Las marcas/familias se detectan confiables sin conector
// (detectBrandInText es word-boundary robusto); el conector "de/en" se usa para el caso COMBINADO cliente
// (donde el detector strict de cliente falla) → marca+cliente específico = 2.1c → AVISA (el dato no tiene el cruce).
// Cero recálculo: arma "{métrica} por {dim} de {filtro}" y reusa el escudo QI vía opts.spineFilter.
const _CONN = "(?:de|del|en)\\s+(?:la\\s+|las\\s+|los\\s+|el\\s+|marca\\s+|familia\\s+|categoria\\s+)*";
const _CONN_WIDE = "(?:de|del|en|para|con)\\s+(?:la\\s+|las\\s+|los\\s+|el\\s+|marca\\s+|familia\\s+|categoria\\s+|cliente\\s+|cuenta\\s+)*";  // 2.1c · incluye para/con
function _afterConnector(norm, name, conn) {
  const n = _norm(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("\\b" + (conn || _CONN) + n + "\\b").test(norm);
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
  const _filtros = { [filterAxis === "marca" ? "marcas" : "sfamilias"]: [filterValue] };   // 2.1d · filtros del payload

  // COMBINADO marca/familia + cliente ESPECÍFICO (nombre real, tras conector) → AVISA (no inventa el cruce).
  // 2.1c (ADI_SPINE_COMBINED_ENABLED): conector ampliado (para/con) + mensaje connector-agnóstico.
  // Flag OFF → exactamente la rama 2.1b (conector de/del/en, mensaje viejo). El cliente debe ser un NOMBRE
  // (detectAllClientsInText strict), NO el genérico "cliente/clientes" → no pisa los filtros simples.
  const _combConn = ADI_SPINE_COMBINED_ENABLED ? _CONN_WIDE : _CONN;
  const specificClient = (detectAllClientsInText(text, { strict: true }) || []).find(c => _afterConnector(norm, c, _combConn));
  if (specificClient) {
    // 2.2b · métrica-eje del combinado (para resolver "marca sola" COMERCIALMENTE vía spine filter · NUNCA
    // brand_dive, que surfacea inventario). Default ventas si la query no la nombra. NUNCA inventario.
    let _combMetric = null;
    for (const [k, def] of Object.entries(METRIC_REGISTRY)) {
      if (def.axis && def.qiKey && isAvailable(def.domain) && (def.vocabulary || []).some(t => _has(norm, t))) { _combMetric = METRIC_REGISTRY[k].label.toLowerCase(); break; }
    }
    const _opener = ADI_SPINE_COMBINED_ENABLED
      ? `Cruzar ${filterValue} (${filterAxis}) con ${specificClient} (cliente) no lo tengo: el dato guarda una ${filterAxis} dominante por cliente, no el detalle por ${filterAxis} dentro del cliente. Te puedo dar ${filterValue} sola, o el detalle de ${specificClient}. ¿Cuál?`
      : `"${filterValue} en ${specificClient}" cruza marca y cliente, y ese cruce no vive en los datos como dato firme (cada cliente tiene su marca dominante, no el detalle por marca dentro del cliente). Te puedo dar ${filterValue} por separado, o el detalle de ${specificClient}. ¿Cuál?`;
    return { _spine: true, route: "spine_filter_combinado_avisar", suggestions: null,
      opener: _opener,
      // ADI Core · 2.2b · contexto pendiente · el turno N+1 ("el detalle de Falabella" → client_dive ·
      // "{filtro} sola" → "{métrica} de {filtro}" comercial). _plainWrap lo estampa con turn.
      _pending: { kind: "combined", filterValue, filterAxis, specificClient, metric: _combMetric || "ventas" },
      evidence: _evidence(scenario, { filtros: _filtros, operacion: "avisar", unsupported: [{ kind: "cross_dimension", raw: `${filterValue}×${specificClient}` }] }) };
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
        suggestions: _ms.map(m => `${_cap} ${_dir} ${_dimW} de ${filterValue} en ${m}`),
        // ADI Core · 2.2b · contexto pendiente · el turno N+1 ("margen" suelto) recompone "{dir} {dimW} de
        // {filterValue} en {métrica}" y reusa el spine. _plainWrap lo estampa con turn (inerte si el flag 2.2b OFF).
        _pending: { kind: "clarify", filterValue, dir: _dir, dimW: _dimW, pendingMetrics: _ms },
        evidence: _evidence(scenario, { dimKey, filtros: _filtros, operacion: "clarify", unsupported: [{ kind: "metric_missing", options: _ms }] }) };
    }
    return null;                                               // sin métrica (+ sin superlativo, o flag off) → cae al viejo
  }
  const metric = METRIC_REGISTRY[metricKey];

  // VALIDATION · dominio disponible (inventario bajo filtro → AVISA vía Availability Map)
  if (!isAvailable(metric.domain, metricKey)) {   // Fase 2.5 · per-métrica · rotación disponible → salta el AVISA (qiKey null → cae al resolver de inventario)
    if (ADI_QI_FILTER_ENABLED) return null;   // coexistencia: el muro/Fix A (activo) maneja inventario con su mensaje específico
    return { _spine: true, route: "spine_filter_unavailable", suggestions: null, opener: unavailableMessage(metric.domain, { filterName: filterValue }),
      evidence: _evidence(scenario, { metricKey, dimKey, filtros: _filtros, operacion: "avisar", formula: metric.formula, invMetric: true, unsupported: [{ kind: "domain_unavailable", raw: metric.domain, phase: "2.5" }] }) };
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
  if (resp._verdict) return { _spine: true, route: "spine_filter_" + resp._verdict, opener: resp.opener, suggestions: resp.suggestions || null,
    evidence: _evidence(scenario, { metricKey, dimKey, filtros: _filtros, operacion: resp._verdict, formula: metric.formula, unsupported: [{ kind: resp._avisarKind || "shield", raw: resp._verdict }] }) };

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
    return { _spine: true, route: "spine_filter_superlative", opener, suggestions: null, _plan: { ..._planBase, direction, rows_used: mm.length },
      evidence: _evidence(scenario, { metricKey, dimKey, filtros: _filtros, operacion: direction === "bottom" ? "rank_bottom" : "rank_top", formula: metric.formula, rowsUsed: mm.length, unsupported: [] }) };
  }

  // sin superlativo → la tabla filtrada (render de composeRetrieval · con tag "filtrado por: X")
  return { _spine: true, route: "spine_filter_table", opener: resp.opener, suggestions: resp.suggestions || null, _plan: _planBase,
    evidence: _evidence(scenario, { metricKey, dimKey, filtros: _filtros, operacion: "retrieve", formula: metric.formula, rowsUsed: Array.isArray(resp.materialMetrics) ? resp.materialMetrics.length : null, unsupported: [] }) };
}
