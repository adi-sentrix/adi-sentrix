/* === src/adi/conversation.js · ADI Core · PARSE CONVERSACIONAL (V1) ===
 * El LLM #1 pasa de "traductor de un turno" a "entendedor con memoria". Este módulo:
 *   · buildConversationContext(turns, lastEvidence) → el CONTEXTO chico que ve el LLM #1 (digest · presupuesto de tokens).
 *   · answerConversational(spec, ctx, state) → RUTEA el turno por `spec.turn_type` (registry, no switch rígido) y resuelve.
 * Regla madre INTACTA: el LLM decide intención/referencias/parámetros · el motor calcula y valida · los guards impiden
 * números nuevos. Ningún número entra por el LLM: los tipos spec-shaped RECALCULAN por el seam (boleta fresca); los
 * narrativos (recommendation/explain/meta) reusan la boleta de la última evidencia. answerADIFromSpec queda intacto (gate 42/0).
 *
 * ROADMAP (fases explícitas · V2-V6 son producto, no descartes):
 *   V1 · continuidad sobre última evidencia (recommendation · modify_assumption · change_dimension · explain · meta · clarify)
 *   V2 · followup_compare (comparación conversacional)         — DECLARADO · en V1 responde honesto, no finge
 *   V3 · multi_analysis (varias boletas · evidences[])          — shape reservado abajo, no emitido en V1
 *   V4 · recall_analysis (memoria de sesión · historial corto)
 *   V5 · session_resume / apply_criteria (entre sesiones · con permiso)
 *   V6 · conversación libre controlada (help · navigate · meta ampliado)
 */
import { answerADIFromSpec } from "./answerADIFromSpec.js";
import { composeFollowupRecommendation } from "./specRetrieval.js";
import { fig } from "./boleta.js";

// ── CONTEXTO · lo que ve el LLM #1 (chico · V1: 3 turnos + última evidencia) ─────────────────────────────────────────
export function buildConversationContext(recentTurns, lastEvidence) {
  const turns = (recentTurns || []).slice(-3).map((t) =>
    t.role === "user"
      ? { role: "user", text: String(t.text || "").slice(0, 200) }
      : { role: "adi", gist: String(t.gist || t.text || "").replace(/\s+/g, " ").slice(0, 160), route: t.route || null });
  return {
    turns,
    last: lastEvidence ? _digestLast(lastEvidence) : null,
    history: [],    // V4 · reservado (historial corto etiquetado) · NO usado en V1
    session: null,  // V5 · reservado (memoria entre sesiones · con permiso)
    criteria: null, // V5 · reservado (perfil/criterio)
  };
}
function _digestLast(ev) {
  const kind = ev.transform ? "supuesto" : (ev.lens === "cuadro" && !ev.reading) ? "ranking" : ev.reading ? "diagnostico" : "dato_real";
  const boletaDigest = (ev.boleta || []).filter((f) => f.mandatory || f.source === "computed").slice(0, 6).map((f) => ({ label: f.label, value: f.value }));
  return {
    kind, metric: ev.metrica || null, dimension: ev.dimension || null, entity: ev.entity || null,
    filters: ev.filters || {}, transform: ev.transform || null, boletaDigest,
    sentrixAction: ev.transform ? { type: "simulation_table" } : (ev.lens ? { type: ev.lens } : null),
  };
}

// ── helpers de respuesta (shape finalizado que consume la UI · `text`, no `opener`) ──────────────────────────────────
const _clarify = (q) => ({ text: q || "¿Podés precisar? Decime el eje (cliente/marca/familia/bodega) o la entidad.", suggestions: null, sentrixAction: null, evidence: null, route: "clarification_needed" });
const _needLast = () => ({ text: "No tengo una lectura reciente sobre la que recomendar. Arranquemos por una consulta: ¿ventas, contribución o capital, y por qué eje?", suggestions: null, sentrixAction: null, evidence: null, route: "followup_no_context" });
const _specSelfContained = (s) => !!(s && s.operation && s.metric && s.dimension);

// ── composeExplain · el PORQUÉ de la última lectura (reusa estructura/concentración ya computada · sin cifras nuevas) ──
export function composeExplain(last) {
  if (!last) return _needLast();
  const con = last.concentration, st = last.structural || {};
  if (last.transform && con) {
    const pct = last.transform.value, sgn = pct >= 0 ? "+" : "";
    const plural = st.plural || `${last.dimLabel || "entidades"}`;
    const mLow = String(last.metricLabel || last.metrica || "el dato").toLowerCase();
    const text = con.concentrated
      ? `**Por qué**\nEl ${sgn}${pct}% es parejo, así que el impacto cae igual que la estructura que ya tenés: los mismos ${con.blockCount} ${plural} que concentran ${mLow} explican el ${con.blockPct}% del impacto. Por eso el supuesto amplifica lo que ya existe, no cambia la forma del negocio. No es un cálculo nuevo — es leer dónde cae el Δ.`
      : `**Por qué**\nEl ${sgn}${pct}% es parejo y el impacto se reparte: ninguna parte concentra el resultado, así que el efecto acompaña al tamaño de cada ${last.dimLabel || "entidad"}. No hay un bloque para mandar a mirar primero.`;
    const bol = [fig("Supuesto %", `${Math.abs(pct)}%`, { unit: "pct", raw: Math.abs(pct), source: "computed", context: "explicación" })];
    if (con.concentrated) bol.push(fig("Concentración · bloque", `${con.blockPct}%`, { unit: "pct", raw: con.blockPct, mandatory: true, source: "computed", context: "explicación", formula: `${con.blockCount} ${plural} = ${con.blockPct}%` }));
    return { text, suggestions: null, sentrixAction: null, evidence: { followup: true, kind: "explain", transform: last.transform, boleta: bol, metrica: last.metrica, dimLabel: last.dimLabel }, route: "followup_explain" };
  }
  return { text: "**Por qué**\nEs la lectura directa del dato real, sin estimaciones: te muestro lo que hay y de dónde sale.", suggestions: null, sentrixAction: null, evidence: { followup: true, kind: "explain", boleta: [] }, route: "followup_explain" };
}

// ── composeMeta · preguntas meta HONESTAS (real vs supuesto · fuente · capacidades) · ancladas al contrato, sin inventar ──
export function composeMeta(topic, last) {
  const t = String(topic || "").toLowerCase();
  const mLow = last && (last.metricLabel || last.metrica) ? String(last.metricLabel || last.metrica).toLowerCase() : "el dato";
  const pct = last && last.transform ? last.transform.value : null;
  const sgn = pct != null && pct >= 0 ? "+" : "";
  let text;
  if (/real|supuesto|proyec/.test(t)) {
    text = (last && last.transform)
      ? `Es un supuesto, no un dato observado. Apliqué ${sgn}${pct}% sobre ${mLow} real de tu cartera: el Actual sí es dato real, el Supuesto es la proyección.`
      : `Es dato real de tu cartera — lo que hay, sin estimar.`;
  } else if (/de d[oó]nde|fuente|sale|origen/.test(t)) {
    text = "Sale del dato real de tu cartera. No estimo ni traigo nada de afuera.";
  } else if (/qu[eé] pod[eé]s|capacidad|hacer|sirv/.test(t)) {
    text = "Hoy proyecto ventas, contribución y capital con un +/-X% sobre el dato real, y te ordeno la decisión: lectura, estructura, riesgo y acción.";
  } else {
    text = "Trabajo sobre el dato real de tu cartera y te ordeno la decisión. Decime qué mirar (ventas, contribución o capital, por cliente/marca/familia/bodega) y arranco.";
  }
  const bol = (pct != null && /real|supuesto|proyec/.test(t)) ? [fig("Supuesto %", `${Math.abs(pct)}%`, { unit: "pct", raw: Math.abs(pct), source: "computed", context: "meta" })] : [];
  return { text, suggestions: null, sentrixAction: null, evidence: { followup: true, kind: "meta", boleta: bol, transform: (last && last.transform) || null }, route: "meta_question" };
}

// ── composeCompareNotYet · V2 declarado · en V1 responde HONESTO (no finge comparación) · pide target si falta ──────────
export function composeCompareNotYet(spec, last) {   // eslint-disable-line no-unused-vars
  const target = spec && ((spec.comparison && spec.comparison.entities && spec.comparison.entities.slice(-1)[0]) || spec.entity);
  const text = target
    ? `La comparación conversacional llega en el próximo paso. Decime que avance y la preparo contra ${target}; por ahora te dejo la lectura actual.`
    : "Puedo comparar en el próximo paso, pero necesito contra qué entidad. ¿Contra cuál querés cruzarlo?";
  return { text, suggestions: null, sentrixAction: null, evidence: { followup: true, kind: "compare_pending", boleta: [] }, route: "followup_compare" };
}

// ── REGISTRY · turn_type → resolver. Sumar una fase = sumar una entrada (V2-V6), NO reestructurar. ───────────────────
const TURN_RESOLVERS = {
  new_query:                  (spec, ctx, state) => answerADIFromSpec(spec, ctx, state),                  // V1
  followup_modify_assumption: (spec, ctx, state) => answerADIFromSpec(spec, ctx, state),                  // V1 · el LLM emite el spec YA resuelto → seam RECALCULA
  followup_change_dimension:  (spec, ctx, state) => answerADIFromSpec(spec, ctx, state),                  // V1 · idem
  followup_recommendation:    (spec, ctx) => composeFollowupRecommendation(ctx.last) || _needLast(),      // V1
  followup_explain:           (spec, ctx) => composeExplain(ctx.last),                                    // V1
  meta_question:              (spec, ctx) => composeMeta(spec && spec.meta, ctx.last),                    // V1
  clarification_needed:       (spec) => _clarify(spec && spec.clarify),                                   // V1
  followup_compare:           (spec, ctx) => composeCompareNotYet(spec, ctx.last),                        // V2 real · V1 = honesto (declarado)
  // ── V3 · multi_analysis: (spec, ctx, state) => composeMulti(spec, ctx, state)  → evidences[] (shape reservado)
  // ── V4 · recall_analysis: (spec, ctx) => composeRecall(spec, ctx.history)
  // ── V5 · session_resume / apply_criteria: (spec, ctx) => ... (ctx.session / ctx.criteria · con permiso)
  // ── V6 · help / navigate / meta ampliado
};

// resolveTurn · turn_type conocido → su resolver. DESCONOCIDO: contextual (followup_*/recall_*/session_* o spec incompleto)
// → clarificar (NO adivinar como consulta nueva) · autónomo (spec completo) → new_query. (Condición 1 del owner.)
export function resolveTurn(turnType, spec, ctx, state) {
  const tt = String(turnType || "new_query");
  const h = TURN_RESOLVERS[tt];
  if (h) return h(spec, ctx, state);
  const contextual = /^(followup_|recall_|session_|meta_|apply_)/.test(tt) || !_specSelfContained(spec);
  return contextual
    ? _clarify("¿Seguimos con lo último o arrancamos algo nuevo? Decime el eje o la entidad.")
    : answerADIFromSpec(spec, ctx, state);
}

// answerConversational · ENTRADA del camino LLM · `context.lastEvidence` = la última evidencia ACCIONABLE (completa · la
// tiene el cliente). El digest (buildConversationContext) es SOLO para el LLM; la resolución determinística usa la completa.
// SHAPE MULTI-READY (V3): una respuesta puede llevar `evidence` (una · V1) o `evidences:[]` (varias · V3). V1 emite UNA.
export function answerConversational(spec, context = {}, state = {}) {
  const last = (context && context.lastEvidence) || null;
  return resolveTurn(spec && spec.turn_type, spec, { ...context, last }, state);
}
