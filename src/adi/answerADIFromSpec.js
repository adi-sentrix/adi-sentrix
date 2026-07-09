/* === src/adi/answerADIFromSpec.js · SEAM del SPEC · ADI Core · Paso 4 (pre-LLM) ===
 * El LLM NO habla con el motor suelto: emite un SPEC canónico, ADI lo VALIDA contra el contrato (Paso 3) y RECIÉN
 * ahí ejecuta. Este archivo es un ROUTER DELGADO — no reimplementa cálculo: traduce el spec al `intent` interno y lo
 * mete por el DISPATCH SELLADO (dispatchIntent/_finalize de answerADI.js) o llama al productor exportado
 * (composeRetrieval). Devuelve la MISMA forma que answerADI(text) → la UI consume cualquiera de las dos igual.
 *
 * ADITIVO: answerADI.js NO importa este archivo → el bundle del gate nunca lo toca → answerADI(text) byte-exacto (16/0).
 * HONESTO: lo que un productor NO ejecuta hoy (costo, simulación paramétrica, rank/compare/dive por ejes no cableados)
 * NO se inventa → degrada honesto, se adueña y ofrece lo disponible (principio del owner · ver [[adi-conversational-ownership]]).
 *
 * REGLA MADRE: el LLM emite el spec y narra · el MOTOR valida, calcula y DECIDE disponibilidad. Acá vive esa validación.
 *
 * Forma del spec (LOCKED · owner 2026-07-02):
 *   { schemaVersion:1, operation, metric, dimension, entity, filters, comparison, sort, limit, scenario, assumption, lens, confidence }
 */
import { dispatchIntent, _finalize } from "./answerADI.js";               // dispatch sellado (export aditivo · gate 16/0)
import { composeRetrieval } from "./composers/qiRetrieval.js";            // productor de retrieval (overview) · ya exportado
import { METRICS } from "../config/contract/metricRegistry.js";
import { ENTITIES } from "../config/contract/entityRegistry.js";
import { SURFACE, BLOCKED_CROSSES } from "../config/contract/surfaceContract.js";
import { assumptionValid } from "../config/contract/assumptionRegistry.js";
import { RANKING_EXTREMES_METRICS } from "../config/rankingData.js";
import { composeSpecRetrieval, composeSpecDive, composeSpecCompare, composeSpecDiagnose, composeSpecSimulate, comparePairs, composeSpecInventory, composeSpecMargin, composeSpecVentas, composeSpecContribucion, compareCauses, diveCauses } from "./specRetrieval.js";   // productores spec-driven genéricos + capa causal (el motor lee; la capa explica)
import { composeContract } from "./contracts/contractCloser.js";   // Fase 1 · capa de contratos de respuesta (envuelve el productor · aditiva · el motor sellado NO la importa → 16/0 intacto)
import { boletaFromText, ensureBoletaCoversText } from "./boleta.js";   // increment 2 · boleta para rutas del MOTOR + cobertura del texto final (flag-independiente)

// _finBoleta · como _finalize pero adjunta evidence.boleta que CUBRE el texto final, INDEPENDIENTE de flags.
// Necesario porque _finalize surfacea `evidence` solo con ADI_SENTRIX_BOLETA_ENABLED (colisión con la boleta-Sentrix del panel);
// al piso ese flag está OFF → la boleta del composer se perdía. Base = boleta first-class del composer + cifras que _finalize
// agrega al texto (suffix proactivo, lead, narrativa) → self-consistente: la propia respuesta pasa su boleta.
function _finBoleta(contractResp, composerResp, route, intentLabel, ctx, scenario) {
  const r = _finalize(contractResp, route, intentLabel, ctx, scenario, null);
  if (r && r.text) {
    const base = (composerResp && composerResp.evidence && composerResp.evidence.boleta) || [];
    // La evidencia del COMPOSER es la base (trae rows/metricLabel/unit — las alimenta el gráfico de la respuesta,
    // I1 2026-07-09); la del contrato la pisa donde ambas hablan. Antes el contrato la reemplazaba y las filas se perdían.
    r.evidence = { ...((composerResp && composerResp.evidence) || {}), ...(r.evidence || {}), boleta: ensureBoletaCoversText(base, r.text) };
  }
  return r;
}

const SCHEMA_VERSION = 1;
const OPERATIONS = new Set(["overview", "rank", "compare", "dive", "diagnose", "inventory", "margin", "ventas", "contribucion", "why", "recommend", "explain_availability", "table"]);

// ── mapeos contrato → identificadores internos del motor ─────────────────────────────────────────────
// rank (composeRankingExtremes · vía RANKING_EXTREMES_METRICS): cliente = nombres base · sku = prefijo sku_ / stockUSD.
const _RANK = {
  cliente: { ventas: "ventas", margen: "margen", contribucion: "contribucion", carga: "carga" },
  sku:     { margen: "sku_margen", contribucion: "sku_contribucion", rotacion: "rotacion", doh: "doh", capital: "stockUSD", cobertura: "cobertura" },
};
// overview (composeRetrieval · vocab QI): costo NO está en el vocab → cae al degrade honesto.
const _QIM = { ventas: "ventas", margen: "margen", contribucion: "contribucion", rotacion: "rotacion", carga: "carga", capital: "capital", doh: "cobertura", cobertura: "cobertura" };
const _QID = { cliente: "cliente", sku: "sku", marca: "marca", familia: "familia", bodega: "bodega" };
// compare/dive · eje → intent del motor (composers que YA existen · brand/warehouse dispatchan con sus FEATURE_* ON)
const _COMPARE_INTENT = {
  cliente: (a, b) => ({ type: "client_comparison", clientA: a, clientB: b }),
  marca:   (a, b) => ({ type: "brand_comparison", brandA: a, brandB: b }),
  bodega:  (a, b) => ({ type: "warehouse_comparison", whA: a, whB: b }),
};
const _DIVE_INTENT = {
  cliente: (e) => ({ type: "client", clientName: e }),
  marca:   (e) => ({ type: "brand_dive", brand: e }),
  bodega:  (e) => ({ type: "warehouse_dive", specificSucursal: e }),
};

// ── helpers de etiqueta (para hablarle al usuario en criollo, no en claves) ──
const _m = (k) => (METRICS[k] ? String(METRICS[k].label).toLowerCase() : k);
const _d = (k) => (ENTITIES[k] ? ENTITIES[k].label.sing : k);
const _dp = (k) => (ENTITIES[k] ? ENTITIES[k].label.plur : k);
const _offerLabel = (o) => {
  if (typeof o !== "string") return String(o);
  const p = o.split("@");
  return (p.length === 2 && METRICS[p[0]] && ENTITIES[p[1]]) ? `${_m(p[0])} por ${_d(p[1])}` : o;
};
const _cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ── constructores de respuesta · MISMA forma que _finalize (la UI no distingue el origen) ──
function _plain(text, { route, intent, ctx, offer }) {
  const sug = (offer && offer.length) ? offer.map(_offerLabel) : null;
  return {
    text,
    suggestions: sug,
    sentrixAction: null,
    intent: intent || "spec",
    route: route || "spec",
    context: { ...(ctx || {}), turnCount: ((ctx && ctx.turnCount) || 0) + 1 },
    evidence: null,
  };
}
// degrada HONESTO: nunca inventa · declara el límite y ofrece lo disponible (se adueña).
function _degrade(kind, text, offer, ctx) {
  return _plain(text, { route: "spec_blocked_" + kind, intent: "spec_blocked", ctx, offer });
}

// cruce sin granularidad atómica (marca×cliente · cliente×sku) declarado en el contrato → bloqueo honesto.
function _crossBlocked(dimension, filters) {
  for (const fk of Object.keys(filters || {})) {
    for (const bc of BLOCKED_CROSSES) {
      const [a, b] = bc.cross;
      if ((a === dimension && b === fk) || (b === dimension && a === fk)) return bc;
    }
  }
  return null;
}

// filtros del spec → forma del composeRetrieval ({marcas, sfamilias, clientes, skus})
function _qiFiltros(filters) {
  if (!filters) return undefined;
  const f = {};
  if (filters.marca) f.marcas = [filters.marca];
  if (filters.familia) f.sfamilias = [filters.familia];
  if (filters.cliente) f.clientes = [filters.cliente];
  if (filters.sku) f.skus = [filters.sku];
  return Object.keys(f).length ? f : undefined;
}

// eco del supuesto para mostrar que ADI lo entendió (aunque la simulación aún no ejecute)
function _assumptionEcho(a) {
  if (!a) return "sin supuesto";
  const u = a.unit === "pct" ? "%" : a.unit === "money" ? " (monto)" : a.unit === "days" ? " días" : "";
  return `${a.type} ${a.value}${u}`;
}

// ── SCRUB de lenguaje de escenario (producto: base única = real · demo/prod NUNCA dicen Bonanza/Tensión/Crisis) ──
// Reescribe el label heredado de los composers ("· escenario Bonanza", "cifras runtime sobre escenario X") a
// "base real" / "dato real". SOLO en el retorno del seam → el motor 16/0 (answerADI) queda byte-exacto · cero cifras tocadas.
const _SCN = "(?:Bonanza|Tensi[oó]n|Crisis|bonanza|tensi[oó]n|crisis|activo|actual)";
function _scrubScenario(text) {
  if (typeof text !== "string" || text.indexOf("escenario") < 0) return text;
  return text
    .replace(new RegExp(`runtime (?:sobre|del) escenario ${_SCN}`, "g"), "sobre el dato real")   // "Cifras runtime del escenario Bonanza" → "Cifras sobre el dato real"
    .replace(new RegExp(`· escenario ${_SCN}`, "g"), "· base real")                              // "… por Cliente · escenario Bonanza" → "… · base real"
    .replace(new RegExp(`del escenario ${_SCN}`, "g"), "del dato real")
    .replace(new RegExp(`en (?:este|el) escenario\\b`, "g"), "en la base real")
    .replace(new RegExp(`escenario ${_SCN}`, "g"), "base real");                                 // residual ("escenario activo/actual")
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * answerADIFromSpec(spec, context, state) → { text, suggestions, sentrixAction, intent, route, context, evidence }
 * Camino PARALELO/dev · testeable sin proveedor LLM (specs a mano · _spec_gate.mjs). La UI lo usa solo con ADI_LLM_ENABLED.
 * WRAPPER: llama al impl y aplica _scrubScenario al texto de salida (choke point único · gate-safe · no toca el motor).
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════ */
export function answerADIFromSpec(spec, context = {}, state = {}) {
  // SANEO (crash en prod 2026-07-09): filters:null explícito rompe composers con default {} — se normaliza
  // también acá (cinturón para specs que llegan sin pasar por coerceSpec, ej. chips del inicio).
  if (spec && spec.filters === null) spec = { ...spec, filters: undefined };
  const r = _answerADIFromSpecImpl(spec, context, state);
  if (r && typeof r.text === "string") r.text = _scrubScenario(r.text);
  // SENTRIX · overview/rank/diagnose (evidencia de DIMENSIÓN · sin reading/transform/followup) → abren el CUADRO de la
  // cartera (owner 2026-07-06). El camino LLM no cableaba esto (solo dive→shell e inventario→cuadro lo hacían) → el
  // usuario no veía la evidencia. El CuadroOnlyPanel es genérico (carga la grilla por entityType). Post-proceso del seam:
  // NO toca el motor/composers ni la vía determinística · el spec_gate valida rutas, no lens.
  // overview/rank = evidencia de DIMENSIÓN → el Cuadro (la grilla ES lo que dice el texto). diagnose NO va acá: su evidencia
  // son los FOCOS (evidence.findings · contribución no capturada/carga/capital) → panel de focos (SentrixPanel los rutea).
  const e = r && r.evidence;
  const _op = spec && spec.operation, _dim = (e && e.dimension) || (spec && spec.dimension) || null;
  if (e && _dim && !e.reading && !e.transform && !e.followup && e.lens !== "cuadro" && (_op === "overview" || _op === "rank")) {
    r.evidence = { ...e, lens: "cuadro", dimension: _dim, entityType: e.entityType || _dim };
  }
  // CONTINUIDAD DE ALCANCE: adjunto a la evidencia de los dominios comerciales el `entityList` = el conjunto que ADI nombró
  // (el que un "de esos…" hereda como entityScope). Central acá (una verdad · no toca los composers ni el motor sellado).
  const e2 = r && r.evidence;
  if (e2 && !e2.entityList && (_op === "inventory" || _op === "margin" || _op === "ventas" || _op === "contribucion")) {
    const el = _deriveEntityList(e2);
    if (el && el.entities.length) e2.entityList = el;
  }
  // VOZ de continuidad: si un "de esos…" heredó alcance y el filtro REALMENTE aplicó (todo lo nombrado ⊆ scope), la
  // respuesta lo reconoce — sin la marca, "los que más aportan… $X totales" se leería como cartera entera (deshonesto).
  // Si el scope se ignoró (cruce sin intersección), NO se marca (la respuesta ES general). Sin cifras → guard-safe.
  if (r && typeof r.text === "string" && spec && spec.entityScope && Array.isArray(spec.entityScope.entities) && e2 && e2.entityList) {
    const scopeSet = new Set(spec.entityScope.entities.map(String));
    if (e2.entityList.entities.length && e2.entityList.entities.every((n) => scopeSet.has(String(n)))) {
      r.text = "De los que veníamos mirando:\n\n" + r.text;
      e2.scopedInherited = true;   // ESPEJO Sentrix (Frente B): el panel muestra el chip "los que veníamos mirando"
    }
  }
  return r;
}

// _deriveEntityList(evidence) → { dimension, entities:[...] } · el conjunto DESTACADO de la respuesta (lo que un "de esos…"
// referencia). Concentración honra el corte 80/20 (cutoff); margen usa los `below`; el resto, el top del panel. Central: una
// sola definición del "de esos" para los 4 dominios · no reimplementa nada de los composers.
function _deriveEntityList(e) {
  if (!e) return null;
  const take = (rows, n) => rows.slice(0, n).map((x) => x && (x.nombre != null ? x.nombre : x.sku)).filter(Boolean);
  if (e.contribucion && e.contribucion.panel && Array.isArray(e.contribucion.panel.rows) && e.contribucion.panel.rows.length) {
    const p = e.contribucion.panel, n = (p.kind === "pareto" && p.cutoff) ? p.cutoff : Math.min(p.rows.length, 8);
    return { dimension: e.dimension || "cliente", entities: take(p.rows, n) };
  }
  if (e.margin) {
    if (Array.isArray(e.margin.below) && e.margin.below.length) return { dimension: e.dimension || "cliente", entities: e.margin.below.map((x) => x.nombre).filter(Boolean) };
    if (e.margin.panel && Array.isArray(e.margin.panel.rows) && e.margin.panel.rows.length) return { dimension: e.dimension || "cliente", entities: take(e.margin.panel.rows, 8) };
  }
  if (e.ventas && e.ventas.panel && Array.isArray(e.ventas.panel.rows) && e.ventas.panel.rows.length)
    return { dimension: e.dimension || "cliente", entities: take(e.ventas.panel.rows, 8) };
  if (e.inventory && Array.isArray(e.inventory.bySku) && e.inventory.bySku.length)
    return { dimension: "sku", entities: e.inventory.bySku.map((x) => x.sku).filter(Boolean) };
  return null;
}

function _answerADIFromSpecImpl(spec, context = {}, state = {}) {   // eslint-disable-line no-unused-vars
  const ctx = { ...(context || {}), __query: "" };

  // ── #0 · schemaVersion (ANTES que todo · si no reconozco la versión, no interpreto los demás campos) ──
  if (!spec || typeof spec !== "object")
    return _degrade("no-spec", "No recibí un pedido para procesar.", [], ctx);
  if (spec.schemaVersion !== SCHEMA_VERSION)
    return _degrade("version", `Este pedido viene en un formato que no reconozco (schemaVersion ${spec.schemaVersion}). Hoy soporto la versión ${SCHEMA_VERSION}.`, [], ctx);

  // ── #1 · operación soportada · el degrade habla en VOCABULARIO DE PRODUCTO (bug cazado por el owner 2026-07-07:
  //     el enum interno "overview, rank, compare…" se filtraba al usuario cuando el LLM emitía una operación inválida) ──
  if (!OPERATIONS.has(spec.operation))
    return _degrade("unsupported-op", `Eso todavía no lo tengo como análisis directo. Lo que sí puedo: mirar tus ventas, margen, contribución o inventario · comparar dos cuentas · profundizar en una ("profundiza en…") · o diagnosticar dónde se te va la plata ("¿dónde estoy perdiendo dinero?").`, [], ctx);

  // ── #2 · métrica existe (dive NO la requiere: perfila la entidad entera) ──
  if (spec.operation !== "dive" && spec.operation !== "why" && spec.operation !== "recommend" && (!spec.metric || !METRICS[spec.metric]))
    return _degrade("unknown-metric", `¿Qué métrica querés ver? Tengo: ${Object.keys(METRICS).map(_m).join(", ")}.`, [], ctx);

  // ── #3 · dimensión existe (margin/ventas holísticos se saltan: manejan su propio eje, incl. "canal" que no es una ENTITY del contrato) ──
  if (spec.operation !== "margin" && spec.operation !== "ventas" && (!spec.dimension || !ENTITIES[spec.dimension]))
    return _degrade("unknown-dimension", `¿Por qué eje? Tengo: ${Object.keys(ENTITIES).map(_dp).join(", ")}.`, [], ctx);

  // explain_availability se resuelve ACÁ (antes de #4): su trabajo ES explicar disponibilidad, incluso cuando la
  // métrica NO está en esa dimensión (ese es justo el caso a explicar) → no debe caer en el bloqueo genérico #4.
  if (spec.operation === "explain_availability") {
    const ax = METRICS[spec.metric].axes || [];
    if (!ax.includes(spec.dimension))
      return _plain(`El ${_m(spec.metric)} no está disponible por ${_d(spec.dimension)}. Sí lo tengo por ${ax.map(_d).join(", ")}.`, { route: "spec_explain", intent: "explain_availability", ctx, offer: ax.map((a) => `${spec.metric}@${a}`) });
    const sf = SURFACE[`${spec.metric}@${spec.dimension}`];
    if (sf) {
      const b = sf.blockedWhen("bonanza");
      if (b) return _plain(`${_cap(b.reason)}.`, { route: "spec_explain", intent: "explain_availability", ctx, offer: b.offer });
      return _plain(`Sí lo tengo: ${_m(spec.metric)} por ${_d(spec.dimension)} está disponible (lentes: ${sf.lenses.join(", ")}).`, { route: "spec_explain", intent: "explain_availability", ctx });
    }
    const sib0 = ax.filter((a) => SURFACE[`${spec.metric}@${a}`]).map((a) => `${spec.metric}@${a}`);
    return _plain(`El ${_m(spec.metric)} por ${_d(spec.dimension)} no lo tengo como vista propia hoy.`, { route: "spec_explain", intent: "explain_availability", ctx, offer: sib0 });
  }

  // ── #4 · métrica disponible en esa dimensión (dive/diagnose/inventory se saltan: dive no usa métrica · diagnose barre
  //     cross-eje · inventory es HOLÍSTICO — composeSpecInventory usa el motor sellado, no retrieval por eje, y responde
  //     "la pregunta manda el foco" por SKU/bodega/familia con UNA sola verdad, así que capital@familia NO debe bloquear) ──
  const axes = (METRICS[spec.metric] && METRICS[spec.metric].axes) || [];
  if (spec.operation !== "dive" && spec.operation !== "diagnose" && spec.operation !== "why" && spec.operation !== "recommend" && spec.operation !== "inventory" && spec.operation !== "margin" && spec.operation !== "ventas" && spec.operation !== "contribucion" && !axes.includes(spec.dimension))
    return _degrade("metric-not-in-dim", `El ${_m(spec.metric)} no lo tengo por ${_d(spec.dimension)}. Sí lo tengo por ${axes.map(_d).join(", ")}.`, axes.map((a) => `${spec.metric}@${a}`), ctx);

  // ── #5 · filtros válidos (clave = una dimensión conocida) ──
  for (const k of Object.keys(spec.filters || {}))
    if (!ENTITIES[k]) return _degrade("bad-filter", `No reconozco el filtro "${k}". Filtrá por ${Object.keys(ENTITIES).map(_d).join(", ")}.`, [], ctx);

  // ── #8 (cruce) · no cruzar mundos sin granularidad atómica ──
  // RECETA PARCIAL (matriz de cobertura 2026-07-09): para overview/rank con filtro marca/familia/bodega, el dato del
  // atributo DOMINANTE sí existe en las filas → se responde con la salvedad DECLARADA en vez de bloquear entero.
  // El resto de operaciones (dive/compare/…) mantiene el bloqueo honesto.
  const cross = _crossBlocked(spec.dimension, spec.filters);
  if (cross) {
    const _fk = Object.keys(spec.filters || {});
    const _partial = (spec.operation === "overview" || spec.operation === "rank")
      && _fk.length && _fk.every((k) => k === "marca" || k === "familia" || k === "bodega");
    if (!_partial) return _degrade("blocked-cross", `${_cap(cross.reason)}. Te muestro lo disponible en su lugar.`, cross.offer, ctx);
    ctx.__crossDominant = { cross, filtro: _fk[0] };
  }

  // ── #6 · escenario / supuesto ──
  const specScn = spec.scenario || "actual";
  if (specScn !== "actual" && specScn !== "simulation")
    return _degrade("bad-scenario", `El escenario "${specScn}" no existe. Uso "actual" o "simulation".`, [], ctx);
  if (specScn === "simulation") {
    const av = assumptionValid(spec.assumption);   // valida la FORMA del supuesto (aunque la ejecución aún no exista)
    if (!av.ok) return _degrade("bad-assumption", av.reason, av.offer || [], ctx);
    // BASE-ONLY (scenario-blind · sku/marca) → NO se puede simular · razón ESPECÍFICA del contrato (más honesta que "no wired").
    const mAware = METRICS[spec.metric].scenarioAware;
    const blind = ENTITIES[spec.dimension].scenarioAware === false || (mAware && mAware[spec.dimension] === false);
    if (blind) {
      const simAxes = axes.filter((a) => ENTITIES[a].scenarioAware !== false && !(mAware && mAware[a] === false));
      return _degrade("scenario-blind", `El ${_m(spec.metric)} por ${_d(spec.dimension)} es base-only: no responde a escenario (se enciende con el ERP), así que no lo puedo simular. Te muestro el estado actual, o ${_m(spec.metric)} por un eje que sí simula (${simAxes.map(_d).join(", ") || "cliente"}).`, simAxes.map((a) => `${spec.metric}@${a}`), ctx);
    }
    // la SIMULACIÓN paramétrica todavía no tiene productor → degrada honesto ofreciendo el estado actual (no ejecuta el "actual" en silencio).
    return _degrade("simulation-not-wired", `La simulación (${_assumptionEcho(spec.assumption)}) todavía no está conectada en esta vista. Puedo mostrarte el estado actual de ${_m(spec.metric)} por ${_d(spec.dimension)}.`, [`${spec.metric}@${spec.dimension}`], ctx);
  }
  const scenario = "bonanza";   // "actual" → base interna (mapeo invisible · el producto nunca dice "bonanza")

  // ── #8b · disponibilidad de superficie declarada (ej. margen@sku fuera de bonanza) ──
  const surf = SURFACE[`${spec.metric}@${spec.dimension}`];
  if (surf) {
    const blk = surf.blockedWhen(scenario);
    if (blk) return _degrade("surface-blocked", `${_cap(blk.reason)}.`, blk.offer || [], ctx);
  }

  // ── ejecución por operación ──────────────────────────────────────────────────────────────────────
  try {
    // SIMULACIÓN · un SUPUESTO sobre el dato REAL (transform presente). Base única = real · NO invoca el motor de escenarios.
    // Ortogonal a la operación (operation "table"/"overview"); lo que dispara la proyección es el transform.
    if (spec.transform && spec.transform.op && (spec.transform.unit === "pct" || spec.transform.op === "multi")) {
      // La ÚNICA simulación soportada es un delta/target en PORCENTAJE sobre un nivel (composeSpecSimulate lo exige). Un
      // transform con otra unidad (ej. el LLM lee "90 días sin vender" como delta:90 unit:days) NO es una simulación →
      // cae fuera de este if y sigue a la operación normal (inventory/overview/…), en vez de degradar con "no habilitado".
      // COMPUESTO · el pedido trae 2+ supuestos (el schema v1 lleva UN transform) → el LLM marca op:"multi".
      // Decisión de producto: NO proyectar parcial ni tomar uno en silencio · degradar honesto y sugerir separar.
      if (spec.transform.op === "multi" || spec.transform.compound === true) {
        return _degrade("simulate-compound", "Puedo proyectar un supuesto a la vez sobre el dato real. Hoy simulo ventas, contribución o capital con un +/-X%. Tu pedido combina dos supuestos — separémoslo: probá primero el que ya está habilitado y el otro cuando esa palanca lo esté.", [], ctx);
      }
      const sim = composeSpecSimulate({ metric: spec.metric, dimension: spec.dimension, filters: spec.filters || {}, transform: spec.transform });
      if (sim && sim.opener) {
        const r = _finalize(sim, "qi_retrieval", "qi_retrieval", ctx, scenario, null);
        if (r && r.text) r.evidence = { ...(r.evidence || {}), ...sim.evidence, boleta: ensureBoletaCoversText(sim.evidence.boleta, r.text) };
        return r;
      }
      const _te = `${spec.transform.op} ${spec.transform.value}${spec.transform.unit === "pct" ? "%" : ""}`;
      return _degrade("simulate-not-supported", `Puedo leer ${_m(spec.metric)} actual, pero ese supuesto (${_te}) todavía no está habilitado para ${_dp(spec.dimension)}. Hoy proyecto ventas/contribución/capital con un +/-X% sobre el dato real.`, [], ctx);
    }
    if (spec.operation === "overview") {
      // INVENTARIO (capital/rotación/DOH) → productor spec-driven (data-driven del contrato · sin texto) · sku o bodega
      if (METRICS[spec.metric].domain === "inventario") {
        const resp = composeSpecRetrieval({ metric: spec.metric, dimension: spec.dimension, filters: spec.filters, scenario, limit: spec.limit, sort: spec.sort });
        if (!resp || !resp.opener) return _degrade("inventory-empty", `No pude armar ${_m(spec.metric)} por ${_dp(spec.dimension)}.`, [], ctx);
        // Fase 2 · contrato overview_domain (lectura → volumen → concentración → señal → cruce · data-driven, sin cifras nuevas)
        return _finBoleta(composeContract("overview_domain", resp, resp.evidence, ctx, scenario), resp, "qi_retrieval", "qi_retrieval", ctx, scenario);
      }
      // CRUCE POR ATRIBUTO DOMINANTE (matriz 2026-07-09): con la salvedad declarada, el retrieval del contrato
      // filtra por la marca/familia dominante de cada fila — nunca el QI del motor (que bloquearía o fabularía).
      if (ctx.__crossDominant) {
        const respD = composeSpecRetrieval({ metric: spec.metric, dimension: spec.dimension, filters: spec.filters, scenario, limit: spec.limit, sort: spec.sort });
        if (respD && respD.opener) {
          respD.opener = `Una salvedad primero: te lo doy por ${_d(ctx.__crossDominant.filtro)} DOMINANTE de cada ${_d(spec.dimension)} — el mix atómico no está en los datos (se enciende con el ERP).\n\n${respD.opener}`;
          return _finBoleta(composeContract("overview_domain", respD, respD.evidence, ctx, scenario), respD, "qi_retrieval", "qi_retrieval", ctx, scenario);
        }
        return _degrade("blocked-cross", `${_cap(ctx.__crossDominant.cross.reason)}. Te muestro lo disponible en su lugar.`, ctx.__crossDominant.cross.offer, ctx);
      }
      const qm = _QIM[spec.metric];
      if (!qm) {   // ej. costo: declarado en el registro (tu enum) pero sin productor de tabla → honesto
        // MATRIZ 2026-07-09 (celda ROTA costo@cliente/sku): métrica DECLARADA en el contrato sin productor QI →
        // el retrieval genérico del contrato la sirve (misma vía que inventario) antes de degradar.
        const resp0 = composeSpecRetrieval({ metric: spec.metric, dimension: spec.dimension, filters: spec.filters, scenario, limit: spec.limit, sort: spec.sort });
        if (resp0 && resp0.opener) return _finBoleta(composeContract("overview_domain", resp0, resp0.evidence, ctx, scenario), resp0, "qi_retrieval", "qi_retrieval", ctx, scenario);
        const sibs = ["ventas", "margen", "contribucion"].filter((x) => (METRICS[x].axes || []).includes(spec.dimension)).map((x) => `${x}@${spec.dimension}`);
        return _degrade("metric-not-wired", `El ${_m(spec.metric)} por ${_d(spec.dimension)} todavía no lo tengo como tabla. Te puedo mostrar ${sibs.map(_offerLabel).join(", ")}.`, sibs, ctx);
      }
      const qi = {
        isRetrieval: true,
        queryType: spec.limit ? "ranked" : "simple",
        metrics: [qm],
        dimensions: [_QID[spec.dimension]],
        format: spec.limit ? "ranking" : "tabla",
        limit: spec.limit || null,
        filtros: _qiFiltros(spec.filters),
      };
      const resp = composeRetrieval(qi, scenario, {});
      if (!resp || !resp.opener) return _degrade("overview-empty", `No pude armar ${_m(spec.metric)} por ${_dp(spec.dimension)}.`, [], ctx);
      // Fase 2c · contrato overview_domain comercial (prepone lectura general volumen/valor · reusa el RIL · reading-forward)
      // BOLETA (overview comercial · composeRetrieval no emite boleta first-class): _finBoleta la deriva del texto final (base vacía).
      return _finBoleta(composeContract("overview_domain", resp, resp.evidence, ctx, scenario), resp, "qi_retrieval", "qi_retrieval", ctx, scenario);
    }

    if (spec.operation === "rank") {
      // ejes que composeRankingExtremes NO cubre (marca/familia/bodega) → productor spec-driven genérico (agregados)
      if (spec.dimension === "marca" || spec.dimension === "familia" || spec.dimension === "bodega") {
        const resp = composeSpecRetrieval({ metric: spec.metric, dimension: spec.dimension, filters: spec.filters, scenario, limit: Math.max(1, spec.limit || 5), sort: spec.sort || { dir: "desc" } });
        if (!resp || !resp.opener) return _degrade("rank-empty", `No pude rankear ${_m(spec.metric)} por ${_d(spec.dimension)}. Probá otra métrica para ese eje.`, [], ctx);
        // Fase 2 · contrato rank_business_entity (ranking → patrón → brecha → advertencia → cruce)
        return _finBoleta(composeContract("rank_business_entity", resp, resp.evidence, ctx, scenario), resp, "qi_retrieval", "qi_retrieval", ctx, scenario);
      }
      const entityType = spec.dimension === "sku" ? "sku" : (spec.dimension === "cliente" ? "client" : null);
      if (!entityType)
        return _degrade("rank-dim-not-wired", `El ranking por ${_d(spec.dimension)} todavía no está conectado. Lo tengo por cliente, SKU, marca, familia y bodega.`, [], ctx);
      const rm = (_RANK[spec.dimension] || {})[spec.metric];
      if (!rm || !RANKING_EXTREMES_METRICS[rm] || RANKING_EXTREMES_METRICS[rm].entityType !== entityType || ctx.__crossDominant) {
        // MATRIZ 2026-07-09 (celdas ROTAS ventas@sku · costo · carga@sku): el motor ranking_extremes no cubre la
        // métrica → el retrieval del contrato rankea CUALQUIER métrica declarada (misma vía que marca/familia/bodega).
        // También el cruce por atributo dominante (rank@cliente con filtro marca) baja por acá con su salvedad.
        const respR = composeSpecRetrieval({ metric: spec.metric, dimension: spec.dimension, filters: spec.filters, scenario, limit: Math.max(1, spec.limit || 5), sort: spec.sort || { dir: "desc" } });
        if (respR && respR.opener) {
          if (ctx.__crossDominant) respR.opener = `Una salvedad primero: te lo doy por ${_d(ctx.__crossDominant.filtro)} DOMINANTE de cada ${_d(spec.dimension)} — el mix atómico no está en los datos (se enciende con el ERP).\n\n${respR.opener}`;
          return _finBoleta(composeContract("rank_business_entity", respR, respR.evidence, ctx, scenario), respR, "qi_retrieval", "qi_retrieval", ctx, scenario);
        }
        const sibs = Object.keys(_RANK[spec.dimension] || {}).map((x) => `${x}@${spec.dimension}`);
        return _degrade("rank-metric-not-wired", `El ranking de ${_m(spec.metric)} por ${_d(spec.dimension)} todavía no está conectado. Probá ${sibs.map(_offerLabel).join(", ")}.`, sibs, ctx);
      }
      const direction = (spec.sort && spec.sort.dir === "asc") ? "worst" : "best";
      const topN = Math.max(1, spec.limit || 5);
      const intent = { type: "ranking_extremes", direction, metric: rm, entityType, topN, inheritedScope: null };
      const out = dispatchIntent(intent, "", scenario, ctx);
      // BOLETA (ruta del MOTOR · rank cliente/sku): el composer sellado no emite boleta → la derivamos de SU texto (unit-aware)
      if (out && out.text) out.evidence = { ...(out.evidence || {}), boleta: boletaFromText(out.text, { context: `rank ${_m(spec.metric)} por ${_d(spec.dimension)}` }) };
      return out || _degrade("rank-empty", `No pude armar el ranking de ${_m(spec.metric)}.`, [], ctx);
    }

    if (spec.operation === "compare") {
      const cmp = spec.comparison;
      if (!cmp || !Array.isArray(cmp.entities) || cmp.entities.length !== 2)
        return _degrade("compare-shape", "Para comparar necesito exactamente dos entidades.", [], ctx);
      const cdim = cmp.dimension || spec.dimension;
      const mk = _COMPARE_INTENT[cdim];
      if (mk) {   // cliente/marca/bodega → composer rico del motor
        const out = dispatchIntent(mk(cmp.entities[0], cmp.entities[1]), "", scenario, ctx);
        // BOLETA (ruta del MOTOR · increment 2): el composer sellado no emite boleta → la derivamos de SU texto (unit-aware).
        // Cierra el garble de marca (1.3× → "13 veces"): el guard del LLM #2 autoriza SOLO las cifras que ADI ya dijo, con su unidad.
        if (out && out.text) {
          // CAPA CAUSAL (owner 2026-07-07 · "un controller senior da causas, no lee datos"): el motor entrega la lectura
          // estructurada; acá se APPENDEA el por qué ocurre + dónde está la plata + la decisión (mismo dato · una verdad
          // con el diagnose). Se agrega ANTES de derivar la boleta → toda cifra causal queda autorizada para el narrador.
          let causesBol = [];
          {
            const causes = compareCauses(cmp.entities[0], cmp.entities[1], scenario, cdim);   // cliente/marca/… · null-safe si el eje no trae estructura
            if (causes) { out.text = out.text + "\n\n" + causes.lines.join("\n\n"); causesBol = causes.bol; }
          }
          out.evidence = { ...(out.evidence || {}), boleta: [...boletaFromText(out.text, { context: `${cmp.entities[0]} vs ${cmp.entities[1]}` }), ...causesBol] };
          // PANEL COMPARATIVO de Sentrix: adjunto los pairs A vs B (si AMBAS entidades existen · si falta una, cp=null y el
          // texto del composer ya degradó honesto → sin panel roto). El texto no cambia; esto sólo alimenta la evidencia.
          const cp = comparePairs(cdim, cmp.entities, scenario);
          if (cp) out.evidence = { ...out.evidence, pairs: cp.pairs, compareA: cp.a, compareB: cp.b, entityType: cdim, dimension: cdim, lens: "compare" };
        }
        return out || _degrade("compare-empty", `No pude comparar ${cmp.entities[0]} y ${cmp.entities[1]}. ¿Están bien escritos?`, [], ctx);
      }
      if (cdim === "sku" || cdim === "familia") {   // sku/familia → productor spec-driven (data-driven del contrato)
        const resp = composeSpecCompare({ dimension: cdim, entities: cmp.entities, scenario });
        if (!resp || !resp.opener) return _degrade("compare-empty", `No pude comparar ${cmp.entities[0]} y ${cmp.entities[1]} por ${_d(cdim)}. ¿Están bien escritos?`, [], ctx);
        // Fase 2b · contrato compare_entities (diferencia principal → ganador → riesgo → decisión)
        return _finBoleta(composeContract("compare_entities", resp, resp.evidence, ctx, scenario), resp, "qi_retrieval", "qi_retrieval", ctx, scenario);
      }
      return _degrade("compare-dim-not-wired", `La comparación por ${_d(cdim)} todavía no está conectada.`, [], ctx);
    }

    if (spec.operation === "dive") {
      const mk = _DIVE_INTENT[spec.dimension];
      if (mk) {   // cliente/marca/bodega → composer rico del motor
        const ent = spec.entity || (spec.filters && (spec.filters[spec.dimension] || spec.filters.cliente));
        if (!ent) return _degrade("dive-no-entity", `¿En qué ${_d(spec.dimension)} querés que profundice?`, [], ctx);
        const out = dispatchIntent(mk(ent), "", scenario, ctx);
        // BOLETA (ruta del MOTOR · dive cliente/marca/bodega): el composer sellado no emite boleta → la derivamos de SU texto
        if (out && out.text) {
          // CAPA CAUSAL del dive (owner 2026-07-07): el motor perfila; acá se APPENDEA por qué está donde está (la brecha
          // en pp), dónde está la plata (cuentas gated del diagnose) y la decisión. ANTES de la boleta → cifras autorizadas.
          let causesBol = [];
          if (spec.dimension === "cliente") {
            const causes = diveCauses(ent, scenario);
            if (causes) { out.text = out.text + "\n\n" + causes.lines.join("\n\n"); causesBol = causes.bol; }
          }
          out.evidence = { ...(out.evidence || {}), boleta: [...boletaFromText(out.text, { context: `${ent} (${_d(spec.dimension)})` }), ...causesBol] };
        }
        return out || _degrade("dive-empty", `No encontré "${ent}". ¿Está bien escrito?`, [], ctx);
      }
      if (spec.dimension === "sku" || spec.dimension === "familia") {   // sku/familia → productor spec-driven
        const ent = spec.entity || (spec.filters && spec.filters[spec.dimension]);
        if (!ent) return _degrade("dive-no-entity", `¿En qué ${_d(spec.dimension)} querés que profundice?`, [], ctx);
        const resp = composeSpecDive({ dimension: spec.dimension, entity: ent, scenario });
        if (!resp || !resp.opener) return _degrade("dive-empty", `No encontré "${ent}" en ${_dp(spec.dimension)}. ¿Está bien escrito?`, [], ctx);
        // Fase 2b · contrato dive_entity (perfil → tensión → mecanismo graduado → impacto → acción)
        return _finBoleta(composeContract("dive_entity", resp, resp.evidence, ctx, scenario), resp, "qi_retrieval", "qi_retrieval", ctx, scenario);
      }
      return _degrade("dive-dim-not-wired", `El detalle por ${_d(spec.dimension)} todavía no está conectado.`, [], ctx);
    }

    if (spec.operation === "diagnose") {
      // barrido data-driven de focos de pérdida/inmovilización (contribución/carga/capital) · el `filters` lo acota
      const resp = composeSpecDiagnose({ filters: spec.filters, scenario });
      if (!resp || !resp.opener) {
        const sc = [spec.filters && spec.filters.marca, spec.filters && spec.filters.familia, spec.filters && spec.filters.bodega, spec.filters && spec.filters.cliente].filter(Boolean).join("/");
        return _degrade("diagnose-empty", `No encontré fugas materiales${sc ? ` en ${sc}` : ""} en este escenario. Todo lo que veo está sobre su benchmark y con el capital rotando.`, [], ctx);
      }
      // Fase 1 · CONTRATO de respuesta: envolver el productor en el contrato ejecutivo (diagnose_value_leak) antes de finalizar.
      return _finBoleta(composeContract("diagnose_value_leak", resp, resp.evidence, ctx, scenario), resp, "qi_retrieval", "qi_retrieval", ctx, scenario);
    }

    // FOCO INVENTARIO (owner 2026-07-06 · "la pregunta manda el foco"): capital inmovilizado por bodega/SKU · NO el
    // diagnóstico genérico. El composer ya trae la estructura (lectura→bodega→SKU→por qué→qué hacer) → finalizo directo.
    if (spec.operation === "inventory") {
      // la pregunta manda el foco (frenado|quiebre|sobrestock|stale) · lo infiere el cliente del texto o el LLM
      const resp = composeSpecInventory({ filters: spec.filters, scenario, focus: spec.focus, staleDays: spec.staleDays, entityScope: spec.entityScope, limit: spec.limit });
      if (!resp || !resp.opener) {
        const _fMsg = { quiebre: "No veo SKU en riesgo de quiebre material — la cobertura alcanza en lo que rota rápido.", sobrestock: "No veo sobrestock material — la cobertura está dentro de rango.", stale: "No veo SKU parados por ese plazo — todo tuvo movimiento reciente." };
        // SCOPE DECLARADO (invitado 2026-07-09: "stock inmovilizado en Concepción" respondía el GLOBAL en silencio):
        // con filtro de alcance, el vacío se responde SOBRE ESE ALCANCE — nunca se sustituye por el global sin avisar.
        const _sc = spec.filters && (spec.filters.bodega || spec.filters.familia || spec.filters.marca || spec.filters.cliente);
        if (_sc) return _degrade("inventory-empty", `En ${_sc} no veo ${({ quiebre: "riesgo de quiebre material", sobrestock: "sobrestock material", stale: "SKU parados por ese plazo" })[spec.focus] || "capital frenado según tu vara (rotación bajo 2x o más de 120 días)"} — lo que hay ahí se está moviendo dentro de rango. ¿Te muestro el estado completo de ese alcance?`, [], ctx);
        return _degrade("inventory-empty", (_fMsg[spec.focus]) || `No veo capital dormido material en este escenario — el inventario está rotando dentro de rango.`, [], ctx);
      }
      const r = _finBoleta(resp, resp, "qi_retrieval", "qi_retrieval", ctx, scenario);
      if (r && r.evidence && resp.evidence && resp.evidence.inventory) r.evidence = { ...r.evidence, inventory: resp.evidence.inventory, lens: "inventory", dimension: resp.evidence.dimension };
      return r;
    }

    // FOCO MARGEN (owner 2026-07-06 · "la pregunta manda el foco"): rompe la trampa "todo→diagnose genérico" que el smoke en
    // vivo encontró. La pregunta elige el foco (bajo_benchmark/alto_volumen_bajo_margen/causa_precio|costo/subir_precio/
    // subpenetrado/stock_bajo_margen/palancas) o marca el HUECO honesto (caida/sin_serie/proveedor/mix/vendedor) → responde
    // lo específico o avisa + pivotea, NUNCA los "3 focos" genéricos.
    if (spec.operation === "margin") {
      const resp = composeSpecMargin({ filters: spec.filters, scenario, focus: spec.focus, dimension: spec.dimension, negativo: spec.negativo, pct: spec.pct, gap: spec.gap, entityScope: spec.entityScope });
      if (!resp || !resp.opener)
        return _degrade("margin-empty", `No veo ${_m("margen")} material bajo el benchmark en este corte — la cartera está sobre el mínimo.`, [], ctx);
      // dimension: la del composer (p.ej. margen@sku heredado de un "de esos" sobre inventario) — _finalize no la arrastra,
      // y sin ella el entityList del turno diría "cliente" con nombres de SKU (rompería el TERCER encadenamiento).
      const r = _finBoleta(resp, resp, "qi_retrieval", "qi_retrieval", ctx, scenario);
      if (r && r.evidence && resp.evidence && resp.evidence.margin) r.evidence = { ...r.evidence, margin: resp.evidence.margin, lens: "margin", dimension: resp.evidence.dimension };
      return r;
    }

    // FOCO VENTAS (owner 2026-07-06 · "la pregunta manda el foco"): vs_presupuesto/vs_anterior/explica_yoy/descomposicion/
    // caida_clientes/precio_realizado/mix_familia/rank_venta o el HUECO honesto (sin_sucursal/sin_serie_mensual/sin_frecuencia/
    // sin_ticket) con pivot a la lente más cercana. Rompe la trampa "todo→diagnose genérico".
    if (spec.operation === "ventas") {
      const resp = composeSpecVentas({ filters: spec.filters, scenario, focus: spec.focus, dimension: spec.dimension, gap: spec.gap, pivotFocus: spec.pivotFocus, entityScope: spec.entityScope });
      if (!resp || !resp.opener)
        return _degrade("ventas-empty", `No pude armar la lectura de ventas para ese corte. Te puedo mostrar la venta vs presupuesto o vs el año anterior por cliente.`, [], ctx);
      const r = _finBoleta(resp, resp, "qi_retrieval", "qi_retrieval", ctx, scenario);
      if (r && r.evidence && resp.evidence && resp.evidence.ventas) r.evidence = { ...r.evidence, ventas: resp.evidence.ventas, lens: "ventas", dimension: resp.evidence.dimension };
      return r;
    }

    // FOCO CONTRIBUCIÓN (owner 2026-07-06 · "la pregunta manda el foco"): concentración 80/20 · origen (volumen vs calidad) ·
    // no capturada · alta-venta-baja-contribución · rank. El motor ya tiene las piezas (concentracion/origenContribucion);
    // acá se rutean en vez de caer al genérico. Rompe la trampa "todo→diagnose" para las preguntas de contribución.
    if (spec.operation === "contribucion") {
      const resp = composeSpecContribucion({ filters: spec.filters, scenario, focus: spec.focus, dimension: spec.dimension, entity: spec.entity, entityScope: spec.entityScope });
      if (!resp || !resp.opener)
        return _degrade("contribucion-empty", `No pude armar la lectura de contribución para ese corte. Te puedo mostrar quién sostiene la contribución o el ranking por cliente.`, [], ctx);
      const r = _finBoleta(resp, resp, "qi_retrieval", "qi_retrieval", ctx, scenario);
      if (r && r.evidence && resp.evidence && resp.evidence.contribucion) r.evidence = { ...r.evidence, contribucion: resp.evidence.contribucion, lens: "contribucion", dimension: resp.evidence.dimension };
      return r;
    }

    if (spec.operation === "why") {
      // Fase 3a · el porqué: REUSA el mecanismo determinístico (no duplica). Ruta por (dimensión, entidad):
      const dim = spec.dimension, ent = spec.entity || (spec.filters && spec.filters[dim]);
      // (A) cliente book-wide (sin entidad) → mecanismo del motor vía dispatchIntent (rico · assert-only · ya narrado, NO pasa por el closer)
      if (dim === "cliente" && !ent) {
        const arch = spec.metric === "contribucion" ? "mechanism_quality_growth" : "mechanism_commercial_erosion";
        const out = dispatchIntent({ type: "cross_domain_query", crossDomain: { isCrossDomainQuery: true, archetype: arch, domainsDetected: [], hasRankingIntent: false } }, "", scenario, ctx);
        if (out && out.text) {   // si el mecanismo no dispara → cae a la vía data-driven honesta de abajo
          // BOLETA (ruta del MOTOR · why book-wide): el mecanismo sellado no emite boleta → la derivamos de SU texto (unit-aware)
          out.evidence = { ...(out.evidence || {}), boleta: boletaFromText(out.text, { context: `por qué (${dim})` }) };
          return out;
        }
      }
      // (B) sku/familia con entidad → composeSpecDive + contrato why (el trapped_capital del motor es stub · esta es la lógica reusable)
      if (dim === "sku" || dim === "familia") {
        if (!ent) return _degrade("why-no-entity", `¿De qué ${_d(dim)} querés el porqué?`, [], ctx);
        const resp = composeSpecDive({ dimension: dim, entity: ent, scenario });
        if (!resp || !resp.opener) return _degrade("why-empty", `No encontré "${ent}" para explicar su porqué. ¿Está bien escrito?`, [], ctx);
        return _finBoleta(composeContract("why_mechanism", resp, resp.evidence, ctx, scenario), resp, "why_mechanism", "why_mechanism", ctx, scenario);
      }
      // (C) cliente con entidad (o fallback) → diagnose SCOPED al cliente + contrato why (reusa los detectores carga/margen graduados)
      const filters = { ...(spec.filters || {}), ...(ent && dim === "cliente" ? { cliente: ent } : {}) };
      const resp = composeSpecDiagnose({ filters, scenario });
      if (!resp || !resp.opener) return _degrade("why-empty", `Con este dato no encontré una causa material que afirmar${ent ? ` en ${ent}` : ""}. Para cerrarla necesito el detalle por SKU o canal.`, [], ctx);
      return _finBoleta(composeContract("why_mechanism", resp, resp.evidence, ctx, scenario), resp, "why_mechanism", "why_mechanism", ctx, scenario);
    }

    if (spec.operation === "recommend") {
      // Fase 3b · SOLO recomienda sobre palancas PROBADAS (carga/capital) del diagnose · si la causa está abierta el closer recomienda diagnosticar, no inventa.
      const dim = spec.dimension, ent = spec.entity || (spec.filters && spec.filters[dim]);
      const filters = { ...(spec.filters || {}), ...(ent && dim === "cliente" ? { cliente: ent } : {}) };
      const resp = composeSpecDiagnose({ filters, scenario });
      if (!resp || !resp.opener) return _degrade("recommend-empty", `No tengo una palanca accionable probada para recomendar${ent ? ` en ${ent}` : ""}. Para recomendar necesito un foco material con causa probada.`, [], ctx);
      return _finBoleta(composeContract("recommend_action", resp, resp.evidence, ctx, scenario), resp, "recommend_action", "recommend_action", ctx, scenario);
    }
  } catch (e) {
    // El mensaje CRUDO de la excepción jamás llega al usuario (en prod se narró un "Cannot read properties of
    // null…" como si fuera asesoría técnica — 2026-07-09). Voz de producto + honestidad; el detalle va a consola.
    try { console.error("[adi executor-error]", e); } catch { /* headless sin console */ }
    return _degrade("executor-error", 'Se me trabó ese pedido y prefiero no inventarte un número. Probá de nuevo o pedímelo de otra forma — por ejemplo: "¿cómo vienen las ventas?" o "margen por cliente".', [], ctx);
  }

  return _degrade("unhandled", "No supe cómo resolver ese pedido.", [], ctx);
}
