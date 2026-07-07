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
import { composeFollowupRecommendation, sampleEntities } from "./specRetrieval.js";
import { fig } from "./boleta.js";
import { ENTITIES } from "../config/contract/entityRegistry.js";   // V2 · label del eje para las repreguntas de comparación

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
  // CONTINUIDAD (D · owner 2026-07-06): el "por qué" sigue el ÚLTIMO foco. Si el foco era CAPITAL inmovilizado, explica
  // capital (rotación/DOH), NO margen. Reusa la evidencia de inventario · cita solo el total (en boleta) · honesto sobre
  // la causa raíz (el dato dice DÓNDE está frenado, no todavía por qué dejó de venderse).
  if (last.inventory && Array.isArray(last.inventory.bySku) && last.inventory.bySku.length) {
    const inv = last.inventory, _m = (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`);
    const top = inv.bySku.slice(0, 2).map((s) => s.sku).join(" y ");
    const text = `Lo digo porque esos SKU dejaron de rotar: quedaron con rotación por debajo del umbral y DOH alto, así que el stock no sale y esos ${_m(inv.total)} quedan atrapados en góndola. Los más frenados (${top}) llevan meses sin salida. La causa de fondo — sobrestock, estacionalidad o precio de lista — hay que verla SKU por SKU: el dato te dice DÓNDE está frenado el capital, todavía no por qué dejó de venderse.`;
    // boleta = total + capital POR SKU (money · para que el narrador pueda ser rico) · SIN DOH/rotación sueltas (evitan el
    // guard) · sin `inventory` pesado en la evidencia → la narración pasa el guard (NARRADO), no cae a tabla cruda.
    const bol = [fig("Capital inmovilizado · total", _m(inv.total), { unit: "money", raw: inv.total, mandatory: true, context: "capital inmovilizado" })];
    for (const s of inv.bySku.slice(0, 3)) bol.push(fig(`SKU · ${s.sku}`, _m(s.usd), { unit: "money", raw: s.usd, context: "capital inmovilizado" }));
    return { text, suggestions: null, sentrixAction: null, evidence: { followup: true, kind: "explain", boleta: bol }, route: "followup_explain" };
  }
  // CONTINUIDAD (D) tras un DIAGNÓSTICO: el "por qué" explica el FOCO TOP (contribución/carga/capital), no un relleno
  // genérico. Mecanismo por detector · graduado y honesto (lo probado vs la causa raíz que necesita el detalle).
  if (Array.isArray(last.findings) && last.findings.length) {
    const _m = (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`);
    const f = last.findings[0], topE = (f.items && f.items[0] && f.items[0].entidad) || null;
    const mech = f.detector === "carga"
      ? "la carga comercial está por encima del target interno — es plata que se va en condiciones/rebate y no llega al margen."
      : f.detector === "capital"
      ? "esos SKU dejaron de rotar (DOH alto, rotación baja): el stock no sale y ahí queda el capital atrapado."
      : `${topE ? topE + " y compañía ceden" : "el margen cede"} frente al benchmark de la cartera; la causa raíz —precio, costo o mezcla— hay que verla por SKU o canal.`;
    const text = `Lo digo porque el foco que más pesa es ${f.titulo.toLowerCase()} (${_m(f.subtotal_usd)}): ${mech} Eso es lo que el dato prueba hoy; la causa exacta se confirma bajando al detalle.`;
    const bol = [fig(`${f.titulo} · subtotal`, _m(f.subtotal_usd), { unit: "money", raw: f.subtotal_usd, mandatory: true, context: "diagnóstico" })];
    return { text, suggestions: null, sentrixAction: null, evidence: { followup: true, kind: "explain", boleta: bol }, route: "followup_explain" };
  }
  const con = last.concentration, st = last.structural || {};
  if (last.transform && con) {
    const pct = last.transform.value, sgn = pct >= 0 ? "+" : "";
    const plural = st.plural || `${last.dimLabel || "entidades"}`;
    const mLow = String(last.metricLabel || last.metrica || "el dato").toLowerCase();
    const text = con.concentrated
      ? `Lo digo porque el ${sgn}${pct}% es parejo, así que el impacto cae igual que la estructura que ya tenés: los mismos ${con.blockCount} ${plural} que concentran ${mLow} explican el ${con.blockPct}% del impacto. Por eso el supuesto amplifica lo que ya existe, no cambia la forma del negocio.`
      : `Lo digo porque el ${sgn}${pct}% es parejo y el impacto se reparte: ninguna parte concentra el resultado, así que el efecto acompaña al tamaño de cada ${last.dimLabel || "entidad"} más que a una parte puntual.`;
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

// ── composeCompareNotYet · (legacy V1) placeholder honesto · reemplazado por composeCompare (V2) · se conserva por compat ──
export function composeCompareNotYet(spec, last) {   // eslint-disable-line no-unused-vars
  const target = spec && ((spec.comparison && spec.comparison.entities && spec.comparison.entities.slice(-1)[0]) || spec.entity);
  const text = target
    ? `La comparación conversacional llega en el próximo paso. Decime que avance y la preparo contra ${target}; por ahora te dejo la lectura actual.`
    : "Puedo comparar en el próximo paso, pero necesito contra qué entidad. ¿Contra cuál querés cruzarlo?";
  return { text, suggestions: null, sentrixAction: null, evidence: { followup: true, kind: "compare_pending", boleta: [] }, route: "followup_compare" };
}

// ── V2 · comparación conversacional REAL. El LLM aporta el TARGET (lo explícito del mensaje: "La Polar"); el SUJETO y el
// EJE salen de la última evidencia (fuente de verdad, no la memoria del LLM). Construye el spec de compare y lo ejecuta
// por el SEAM → comparación rica + boleta FRESCA (o degrade honesto si no encuentra / cruza mundos). Sin sujeto/target →
// repregunta ESPECÍFICO (no placeholder). Reglas del owner 2026-07-06.
const _low = (x) => String(x == null ? "" : x).trim().toLowerCase();
function _lastEntity(last) {
  if (!last) return null;
  if (last.entidad) return last.entidad;                                  // dive/why/compare sobre UNA entidad
  const f = Array.isArray(last.findings) && last.findings[0];             // tras un diagnose: el foco principal
  const it = f && Array.isArray(f.items) && f.items[0];
  return (it && it.entidad) || null;
}
function _compareTarget(spec, subject) {
  const ents = (spec && spec.comparison && Array.isArray(spec.comparison.entities)) ? spec.comparison.entities.filter(Boolean) : [];
  const notSubj = ents.filter((e) => _low(e) !== _low(subject));         // el LLM puede mandar [target] o [subject, target]
  if (notSubj.length) return notSubj[notSubj.length - 1];
  if (spec && spec.entity && _low(spec.entity) !== _low(subject)) return spec.entity;
  return null;
}
export function composeCompare(spec, ctx, state) {
  const last = ctx && ctx.last;
  const cmpEnts = (spec && spec.comparison && Array.isArray(spec.comparison.entities)) ? spec.comparison.entities.filter(Boolean) : [];
  const dim0 = (last && (last.dimension || last.entityType)) || (spec && spec.comparison && spec.comparison.dimension) || (spec && spec.dimension) || null;
  // dim a prueba de balas: si el contexto/LLM no trae un eje VÁLIDO, caemos al eje primario (cliente) — la mayoría de las
  // comparaciones son cliente-vs-cliente. Así el compare NUNCA cae al genérico "unknown-dimension" del seam; si la entidad
  // no existe en ese eje, el seam degrada HONESTO ("no tengo X"). NADA hardcodeado del dato, sólo el eje por defecto.
  const dim = (dim0 && ENTITIES[dim0]) ? dim0 : (ENTITIES.cliente ? "cliente" : Object.keys(ENTITIES)[0]);
  const dLabel = (ENTITIES[dim] && ENTITIES[dim].label.sing) || "eje";
  let subject, target;
  if (cmpEnts.length >= 2) { subject = cmpEnts[0]; target = cmpEnts[1]; }  // dos entidades EXPLÍCITAS ('compará A con B')
  else { subject = _lastEntity(last); target = _compareTarget(spec, subject); }  // elíptico: sujeto del contexto, target del LLM
  // NUNCA el _needLast genérico narrado: un compare-intent SIEMPRE devuelve repregunta CRISP (o compara).
  if (!dim) return _clarify("¿Sobre qué eje comparo? Decime cliente, marca, familia o bodega.");
  const _egs = (excl) => { const xs = sampleEntities(dim, 4).filter((e) => _low(e) !== _low(excl)).slice(0, 3); return xs.length ? xs.join(", ") : null; };
  const _plur = (ENTITIES[dim] && ENTITIES[dim].label.plur) || `${dLabel}s`;
  if (target && /^(el |la |los |las )?(promedio|media|benchmark|mercado|cartera)$/i.test(String(target).trim())) {
    const eg = _egs(subject); const sj = subject ? `${subject}` : `un ${dLabel}`;
    return _clarify(`El promedio de cartera lo tenés en el panel. Para cruzar puntual, decime contra qué ${dLabel} comparo ${sj}${eg ? ` — ej. ${eg}` : ""}.`);
  }
  if (!target && !subject) { const eg = _egs(); return _clarify(`¿Qué dos ${_plur} querés comparar?${eg ? ` Ej: ${eg}.` : ""}`); }
  if (!target) { const eg = _egs(subject); return _clarify(`¿Contra qué ${dLabel} comparo ${subject}?${eg ? ` Puedo cruzarlo contra ${eg} u otro ${dLabel}.` : ""}`); }
  if (!subject) { const eg = _egs(target); return _clarify(`¿Qué ${dLabel} querés comparar con ${target}?${eg ? ` Puedo cruzar ${target} contra ${eg} u otro ${dLabel}.` : ""}`); }
  const cmpSpec = {
    schemaVersion: 1, operation: "compare",
    metric: (spec && spec.metric) || (last && last.metrica) || "contribucion",
    dimension: dim,
    comparison: { dimension: dim, entities: [subject, target] },
    scenario: "actual",
  };
  return answerADIFromSpec(cmpSpec, ctx, state);   // seam: comparación real + boleta fresca · degrada honesto si no cierra
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
  followup_compare:           (spec, ctx, state) => composeCompare(spec, ctx, state),                      // V2 · comparación conversacional REAL (target del LLM · sujeto/eje del contexto · seam ejecuta)
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
  let tt = spec && spec.turn_type;
  // ROBUSTEZ V2 (no depender de la clasificación del LLM): "compáralo con X" a veces llega como new_query + operation
  // compare con UNA sola entidad (el target). Un compare con <2 entidades es un followup ELÍPTICO → composeCompare
  // rellena el sujeto desde el contexto (o degrada honesto si no hay). Un compare con 2 entidades explícitas sigue normal.
  if (spec && spec.operation === "compare") {
    const ents = (spec.comparison && Array.isArray(spec.comparison.entities)) ? spec.comparison.entities.filter(Boolean) : [];
    if (ents.length < 2) tt = "followup_compare";
  }
  // CONTINUIDAD DE ALCANCE (owner 2026-07-06 · "la mesa viva"): un follow-up deíctico ("y de esos, ¿cuáles…?") — marcado por
  // el coerce (spec._deictic) — HEREDA el conjunto de entidades que ADI nombró en la última evidencia (last.entityList) como
  // spec.entityScope. El composer filtra por nombre; si el alcance no intersecta (cruce de dimensión), lo IGNORA y responde
  // general (nunca miente). Para margin/contribucion (que honran spec.dimension) alineo la dimensión al set heredado.
  if (spec && spec._deictic && last && last.entityList && Array.isArray(last.entityList.entities) && last.entityList.entities.length) {
    spec = { ...spec, entityScope: last.entityList };
    if ((spec.operation === "margin" || spec.operation === "contribucion") && last.entityList.dimension) spec.dimension = last.entityList.dimension;
  }
  return resolveTurn(tt, spec, { ...context, last }, state);
}
