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
import { composeSpecRetrieval, composeSpecDive, composeSpecCompare, composeSpecDiagnose } from "./specRetrieval.js";   // productores spec-driven genéricos (retrieval/rank · dive · compare · diagnose · data-driven del contrato)
import { composeContract } from "./contracts/contractCloser.js";   // Fase 1 · capa de contratos de respuesta (envuelve el productor · aditiva · el motor sellado NO la importa → 16/0 intacto)

const SCHEMA_VERSION = 1;
const OPERATIONS = new Set(["overview", "rank", "compare", "dive", "diagnose", "why", "recommend", "explain_availability"]);

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

/* ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * answerADIFromSpec(spec, context, state) → { text, suggestions, sentrixAction, intent, route, context, evidence }
 * Camino PARALELO/dev · testeable sin proveedor LLM (specs a mano · _spec_gate.mjs). La UI lo usa solo con ADI_LLM_ENABLED.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════ */
export function answerADIFromSpec(spec, context = {}, state = {}) {   // eslint-disable-line no-unused-vars
  const ctx = { ...(context || {}), __query: "" };

  // ── #0 · schemaVersion (ANTES que todo · si no reconozco la versión, no interpreto los demás campos) ──
  if (!spec || typeof spec !== "object")
    return _degrade("no-spec", "No recibí un pedido para procesar.", [], ctx);
  if (spec.schemaVersion !== SCHEMA_VERSION)
    return _degrade("version", `Este pedido viene en un formato que no reconozco (schemaVersion ${spec.schemaVersion}). Hoy soporto la versión ${SCHEMA_VERSION}.`, [], ctx);

  // ── #1 · operación soportada ──
  if (!OPERATIONS.has(spec.operation))
    return _degrade("unsupported-op", `No sé hacer "${spec.operation}". Hoy puedo: ${[...OPERATIONS].join(", ")}.`, [], ctx);

  // ── #2 · métrica existe (dive NO la requiere: perfila la entidad entera) ──
  if (spec.operation !== "dive" && spec.operation !== "why" && spec.operation !== "recommend" && (!spec.metric || !METRICS[spec.metric]))
    return _degrade("unknown-metric", `¿Qué métrica querés ver? Tengo: ${Object.keys(METRICS).map(_m).join(", ")}.`, [], ctx);

  // ── #3 · dimensión existe ──
  if (!spec.dimension || !ENTITIES[spec.dimension])
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

  // ── #4 · métrica disponible en esa dimensión (dive/diagnose se saltan: dive no usa métrica · diagnose barre cross-eje) ──
  const axes = (METRICS[spec.metric] && METRICS[spec.metric].axes) || [];
  if (spec.operation !== "dive" && spec.operation !== "diagnose" && spec.operation !== "why" && spec.operation !== "recommend" && !axes.includes(spec.dimension))
    return _degrade("metric-not-in-dim", `El ${_m(spec.metric)} no lo tengo por ${_d(spec.dimension)}. Sí lo tengo por ${axes.map(_d).join(", ")}.`, axes.map((a) => `${spec.metric}@${a}`), ctx);

  // ── #5 · filtros válidos (clave = una dimensión conocida) ──
  for (const k of Object.keys(spec.filters || {}))
    if (!ENTITIES[k]) return _degrade("bad-filter", `No reconozco el filtro "${k}". Filtrá por ${Object.keys(ENTITIES).map(_d).join(", ")}.`, [], ctx);

  // ── #8 (cruce) · no cruzar mundos sin granularidad atómica ──
  const cross = _crossBlocked(spec.dimension, spec.filters);
  if (cross) return _degrade("blocked-cross", `${_cap(cross.reason)}. Te muestro lo disponible en su lugar.`, cross.offer, ctx);

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
    if (spec.operation === "overview") {
      // INVENTARIO (capital/rotación/DOH) → productor spec-driven (data-driven del contrato · sin texto) · sku o bodega
      if (METRICS[spec.metric].domain === "inventario") {
        const resp = composeSpecRetrieval({ metric: spec.metric, dimension: spec.dimension, filters: spec.filters, scenario, limit: spec.limit, sort: spec.sort });
        if (!resp || !resp.opener) return _degrade("inventory-empty", `No pude armar ${_m(spec.metric)} por ${_dp(spec.dimension)}.`, [], ctx);
        // Fase 2 · contrato overview_domain (lectura → volumen → concentración → señal → cruce · data-driven, sin cifras nuevas)
        return _finalize(composeContract("overview_domain", resp, resp.evidence, ctx, scenario), "qi_retrieval", "qi_retrieval", ctx, scenario, null);
      }
      const qm = _QIM[spec.metric];
      if (!qm) {   // ej. costo: declarado en el registro (tu enum) pero sin productor de tabla → honesto
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
      return _finalize(composeContract("overview_domain", resp, resp.evidence, ctx, scenario), "qi_retrieval", "qi_retrieval", ctx, scenario, null);
    }

    if (spec.operation === "rank") {
      // ejes que composeRankingExtremes NO cubre (marca/familia/bodega) → productor spec-driven genérico (agregados)
      if (spec.dimension === "marca" || spec.dimension === "familia" || spec.dimension === "bodega") {
        const resp = composeSpecRetrieval({ metric: spec.metric, dimension: spec.dimension, filters: spec.filters, scenario, limit: Math.max(1, spec.limit || 5), sort: spec.sort || { dir: "desc" } });
        if (!resp || !resp.opener) return _degrade("rank-empty", `No pude rankear ${_m(spec.metric)} por ${_d(spec.dimension)}. Probá otra métrica para ese eje.`, [], ctx);
        // Fase 2 · contrato rank_business_entity (ranking → patrón → brecha → advertencia → cruce)
        return _finalize(composeContract("rank_business_entity", resp, resp.evidence, ctx, scenario), "qi_retrieval", "qi_retrieval", ctx, scenario, null);
      }
      const entityType = spec.dimension === "sku" ? "sku" : (spec.dimension === "cliente" ? "client" : null);
      if (!entityType)
        return _degrade("rank-dim-not-wired", `El ranking por ${_d(spec.dimension)} todavía no está conectado. Lo tengo por cliente, SKU, marca, familia y bodega.`, [], ctx);
      const rm = (_RANK[spec.dimension] || {})[spec.metric];
      if (!rm || !RANKING_EXTREMES_METRICS[rm] || RANKING_EXTREMES_METRICS[rm].entityType !== entityType) {
        const sibs = Object.keys(_RANK[spec.dimension] || {}).map((x) => `${x}@${spec.dimension}`);
        return _degrade("rank-metric-not-wired", `El ranking de ${_m(spec.metric)} por ${_d(spec.dimension)} todavía no está conectado. Probá ${sibs.map(_offerLabel).join(", ")}.`, sibs, ctx);
      }
      const direction = (spec.sort && spec.sort.dir === "asc") ? "worst" : "best";
      const topN = Math.max(1, spec.limit || 5);
      const intent = { type: "ranking_extremes", direction, metric: rm, entityType, topN, inheritedScope: null };
      const out = dispatchIntent(intent, "", scenario, ctx);
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
        return out || _degrade("compare-empty", `No pude comparar ${cmp.entities[0]} y ${cmp.entities[1]}. ¿Están bien escritos?`, [], ctx);
      }
      if (cdim === "sku" || cdim === "familia") {   // sku/familia → productor spec-driven (data-driven del contrato)
        const resp = composeSpecCompare({ dimension: cdim, entities: cmp.entities, scenario });
        if (!resp || !resp.opener) return _degrade("compare-empty", `No pude comparar ${cmp.entities[0]} y ${cmp.entities[1]} por ${_d(cdim)}. ¿Están bien escritos?`, [], ctx);
        // Fase 2b · contrato compare_entities (diferencia principal → ganador → riesgo → decisión)
        return _finalize(composeContract("compare_entities", resp, resp.evidence, ctx, scenario), "qi_retrieval", "qi_retrieval", ctx, scenario, null);
      }
      return _degrade("compare-dim-not-wired", `La comparación por ${_d(cdim)} todavía no está conectada.`, [], ctx);
    }

    if (spec.operation === "dive") {
      const mk = _DIVE_INTENT[spec.dimension];
      if (mk) {   // cliente/marca/bodega → composer rico del motor
        const ent = spec.entity || (spec.filters && (spec.filters[spec.dimension] || spec.filters.cliente));
        if (!ent) return _degrade("dive-no-entity", `¿En qué ${_d(spec.dimension)} querés que profundice?`, [], ctx);
        const out = dispatchIntent(mk(ent), "", scenario, ctx);
        return out || _degrade("dive-empty", `No encontré "${ent}". ¿Está bien escrito?`, [], ctx);
      }
      if (spec.dimension === "sku" || spec.dimension === "familia") {   // sku/familia → productor spec-driven
        const ent = spec.entity || (spec.filters && spec.filters[spec.dimension]);
        if (!ent) return _degrade("dive-no-entity", `¿En qué ${_d(spec.dimension)} querés que profundice?`, [], ctx);
        const resp = composeSpecDive({ dimension: spec.dimension, entity: ent, scenario });
        if (!resp || !resp.opener) return _degrade("dive-empty", `No encontré "${ent}" en ${_dp(spec.dimension)}. ¿Está bien escrito?`, [], ctx);
        // Fase 2b · contrato dive_entity (perfil → tensión → mecanismo graduado → impacto → acción)
        return _finalize(composeContract("dive_entity", resp, resp.evidence, ctx, scenario), "qi_retrieval", "qi_retrieval", ctx, scenario, null);
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
      return _finalize(composeContract("diagnose_value_leak", resp, resp.evidence, ctx, scenario), "qi_retrieval", "qi_retrieval", ctx, scenario, null);
    }

    if (spec.operation === "why") {
      // Fase 3a · el porqué: REUSA el mecanismo determinístico (no duplica). Ruta por (dimensión, entidad):
      const dim = spec.dimension, ent = spec.entity || (spec.filters && spec.filters[dim]);
      // (A) cliente book-wide (sin entidad) → mecanismo del motor vía dispatchIntent (rico · assert-only · ya narrado, NO pasa por el closer)
      if (dim === "cliente" && !ent) {
        const arch = spec.metric === "contribucion" ? "mechanism_quality_growth" : "mechanism_commercial_erosion";
        const out = dispatchIntent({ type: "cross_domain_query", crossDomain: { isCrossDomainQuery: true, archetype: arch, domainsDetected: [], hasRankingIntent: false } }, "", scenario, ctx);
        if (out && out.text) return out;   // si el mecanismo no dispara → cae a la vía data-driven honesta de abajo
      }
      // (B) sku/familia con entidad → composeSpecDive + contrato why (el trapped_capital del motor es stub · esta es la lógica reusable)
      if (dim === "sku" || dim === "familia") {
        if (!ent) return _degrade("why-no-entity", `¿De qué ${_d(dim)} querés el porqué?`, [], ctx);
        const resp = composeSpecDive({ dimension: dim, entity: ent, scenario });
        if (!resp || !resp.opener) return _degrade("why-empty", `No encontré "${ent}" para explicar su porqué. ¿Está bien escrito?`, [], ctx);
        return _finalize(composeContract("why_mechanism", resp, resp.evidence, ctx, scenario), "why_mechanism", "why_mechanism", ctx, scenario, null);
      }
      // (C) cliente con entidad (o fallback) → diagnose SCOPED al cliente + contrato why (reusa los detectores carga/margen graduados)
      const filters = { ...(spec.filters || {}), ...(ent && dim === "cliente" ? { cliente: ent } : {}) };
      const resp = composeSpecDiagnose({ filters, scenario });
      if (!resp || !resp.opener) return _degrade("why-empty", `Con este dato no encontré una causa material que afirmar${ent ? ` en ${ent}` : ""}. Para cerrarla necesito el detalle por SKU o canal.`, [], ctx);
      return _finalize(composeContract("why_mechanism", resp, resp.evidence, ctx, scenario), "why_mechanism", "why_mechanism", ctx, scenario, null);
    }

    if (spec.operation === "recommend") {
      // Fase 3b · SOLO recomienda sobre palancas PROBADAS (carga/capital) del diagnose · si la causa está abierta el closer recomienda diagnosticar, no inventa.
      const dim = spec.dimension, ent = spec.entity || (spec.filters && spec.filters[dim]);
      const filters = { ...(spec.filters || {}), ...(ent && dim === "cliente" ? { cliente: ent } : {}) };
      const resp = composeSpecDiagnose({ filters, scenario });
      if (!resp || !resp.opener) return _degrade("recommend-empty", `No tengo una palanca accionable probada para recomendar${ent ? ` en ${ent}` : ""}. Para recomendar necesito un foco material con causa probada.`, [], ctx);
      return _finalize(composeContract("recommend_action", resp, resp.evidence, ctx, scenario), "recommend_action", "recommend_action", ctx, scenario, null);
    }
  } catch (e) {
    return _degrade("executor-error", `Algo falló al ejecutar el pedido (${e && e.message}). No inventé un número: mejor te lo digo.`, [], ctx);
  }

  return _degrade("unhandled", "No supe cómo resolver ese pedido.", [], ctx);
}
