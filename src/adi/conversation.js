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
import { CRITERIA, setCriterion, forgetCriterion, activeCriteria } from "./criteria.js";   // V5 · memoria de criterio (Frente C.2)
import { coerceFloor } from "./coerceChain.js";   // CONTINUIDAD (owner 2026-07-15): el "sí" ejecuta LA OFERTA con que ADI cerró — por la misma red del piso

// ── LA OFERTA DE CIERRE (owner 2026-07-15 · "respondo SI y luego se pierde"): toda respuesta de ADI suele cerrar
// con una pregunta-oferta ("¿empezamos con el análisis de costos?"). Esa pregunta es una PROMESA: se captura acá
// (la ÚLTIMA interrogación del texto que el usuario VIO — narrado o determinístico) y viaja en la memoria, para
// que el "sí" la ejecute y el LLM #1 la vea en el digest. Pura · gate-testable. ──
export function extractOffer(text) {
  const qs = String(text || "").match(/¿[^¿?\n]{6,220}\?/g);
  return qs && qs.length ? qs[qs.length - 1].trim() : null;
}

/* ── LA BOLETA DE MEMORIA (owner 2026-07-15: "no hay que mandarle toda la conversación, sino una boleta chica y
 * bien hecha con lo que importa para decidir el siguiente paso: última entidad + última pregunta/oferta + última
 * evidencia + próxima acción sugerida — eso basta para que 'sí', 'dale', 'compáralo', 'por qué' o 'muéstrame más'
 * tengan sentido"). updateMemoria(prev, r) → la boleta del turno, pura y gate-testable; el cliente la threadea
 * (ChatADI · context.memoria) y la leen LAS DOS CAPAS: el digest del LLM #1 (campo `memoria`) y los resolvers
 * determinísticos (composeAccept · composeCompare). La evidencia completa sigue viajando aparte (lastEvidence —
 * la fuente de verdad para recalcular); la memoria es el ÍNDICE chico de la conversación:
 *   · entidad  { nombre, eje } — la última entidad EN FOCO (dive/why/compare). PERSISTE en turnos narrativos y
 *     globales (un "compáralo" después de un paréntesis sigue teniendo sujeto); una entidad nueva la reemplaza.
 *   · tema     { metrica, dimension } — de qué veníamos hablando (la última evidencia accionable).
 *   · oferta   — la pregunta de cierre del ÚLTIMO turno (el "sí" siempre refiere al último cierre; las
 *     clarificaciones no dejan oferta). Se REEMPLAZA (o limpia) en cada turno de ADI.
 *   · sugerencias / proximaAccion — las chips del último turno · la 1ª es LA próxima acción (promesa gate-proven). */
export function updateMemoria(prev, r) {
  const p = prev || {};
  if (!r || typeof r !== "object") return { entidad: p.entidad || null, tema: p.tema || null, oferta: null, sugerencias: null, proximaAccion: null, ruta: null };
  const ev = r.evidence || null;
  const clarifica = /clarification|no_context/.test(String(r.route || ""));
  let entidad = p.entidad || null;
  if (ev && ev.entidad) entidad = { nombre: ev.entidad, eje: ev.entityType || ev.dimension || (entidad && entidad.eje) || null };
  else if (ev && ev.compareA) entidad = { nombre: ev.compareA, eje: ev.entityType || ev.dimension || null };
  let tema = p.tema || null;
  if (ev && !ev.followup && (ev.metrica || ev.dimension)) tema = { metrica: ev.metrica || (tema && tema.metrica) || null, dimension: ev.dimension || (tema && tema.dimension) || null };
  const oferta = (!clarifica && typeof r.text === "string") ? extractOffer(r.text) : null;
  const sugerencias = (r.suggestions && r.suggestions.length) ? r.suggestions.slice(0, 3) : null;
  // ruta del turno: le da al "sí" repetido su escalada (why ya dado → recommend) — review adversarial 2026-07-15
  return { entidad, tema, oferta, sugerencias, proximaAccion: (sugerencias && sugerencias[0]) || null, ruta: r.route || null };
}

// ── CONTEXTO · lo que ve el LLM #1 (chico · V1: 3 turnos + última evidencia + señales de UI + LA MEMORIA) ───────────
export function buildConversationContext(recentTurns, lastEvidence, uiSignals = null, memoria = null) {
  const turns = (recentTurns || []).slice(-3).map((t) => {
    if (t.role === "user") return { role: "user", text: String(t.text || "").slice(0, 200) };
    // OFERTA DE CIERRE en el digest (owner 2026-07-15): el gist trunca el ARRANQUE del texto — la pregunta con que
    // ADI cerró (lo que un "sí" acepta) quedaba fuera y el LLM #1 no podía resolver la aceptación. Viaja explícita.
    const off = extractOffer(t.text);
    return { role: "adi", gist: String(t.gist || t.text || "").replace(/\s+/g, " ").slice(0, 160), ...(off ? { offer: off } : {}), route: t.route || null };
  });
  // SEÑALES DE UI (owner 2026-07-08 · "memoria en todos los grados"): lo que el usuario está HACIENDO en Sentrix —
  // selección de la Mesa, estación tocada, lo que SIGUE en la watchlist (Mesa 2.0 pase 2) — para que "compará esto"/
  // "esto que estoy viendo"/"los que sigo" tenga referente. Chico (caps para el presupuesto de tokens).
  const _wl = Array.isArray(uiSignals && uiSignals.watchlist) && uiSignals.watchlist.length ? uiSignals.watchlist.slice(0, 8) : null;
  const ui = uiSignals && ((Array.isArray(uiSignals.mesaSel) && uiSignals.mesaSel.length) || uiSignals.station || _wl)
    ? { mesaSel: (uiSignals.mesaSel || []).slice(0, 4), mesaDim: uiSignals.mesaDim || null, station: uiSignals.station || null, watchlist: _wl }
    : null;
  return {
    turns,
    last: lastEvidence ? _digestLast(lastEvidence) : null,
    memoria: memoria || null,   // LA BOLETA DE MEMORIA (owner 2026-07-15): entidad en foco · oferta de cierre · próxima acción · tema
    ui,             // qué está mirando/seleccionando el usuario en Sentrix AHORA (null si nada)
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
// ctx/state opcionales (memoria · owner 2026-07-15): "por qué" mirando UNA entidad → su mecanismo graduado, no el relleno.
export function composeExplain(last, ctx = null, state = {}) {
  // el porqué de la entidad EN FOCO — de la evidencia si existe; la memoria SOLO cuando no hay evidencia (review
  // adversarial 2026-07-15: con una lectura global reciente, heredar una entidad de turnos atrás inventa el referente)
  const _entWhy = () => {
    const mem = (ctx && ctx.memoria) || null;
    const e = (last && last.entidad) ? { nombre: last.entidad, eje: last.entityType || last.dimension }
      : (!last && mem && mem.entidad && mem.entidad.nombre) ? mem.entidad : null;
    if (!e) return null;
    const dim = (e.eje && ENTITIES[e.eje]) ? e.eje : "cliente";
    try { return answerADIFromSpec({ schemaVersion: 1, operation: "why", dimension: dim, entity: e.nombre, metric: "margen", scenario: "actual" }, ctx || {}, state); } catch { return null; }
  };
  if (!last) return _entWhy() || _needLast();
  // CONTINUIDAD (D · owner 2026-07-06): el "por qué" sigue el ÚLTIMO foco. Si el foco era CAPITAL inmovilizado, explica
  // capital (rotación/DOH), NO margen. Reusa la evidencia de inventario · cita solo el total (en boleta) · honesto sobre
  // la causa raíz (el dato dice DÓNDE está frenado, no todavía por qué dejó de venderse).
  if (last.inventory && Array.isArray(last.inventory.bySku) && last.inventory.bySku.length) {
    const inv = last.inventory, _m = (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`);
    const top = inv.bySku.slice(0, 2).map((s) => s.sku).join(" y ");
    const text = `Lo digo porque esos SKU dejaron de rotar: quedaron con rotación por debajo del umbral y DOH alto, así que el stock no sale y esos ${_m(inv.total)} quedan atrapados en góndola. Los más detenidos (${top}) llevan meses sin salida. La causa de fondo — sobrestock, estacionalidad o precio de lista — hay que verla SKU por SKU: el dato te dice DÓNDE está detenido el capital, todavía no por qué dejó de venderse.`;
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
      ? "la carga comercial está por encima del target interno — es valor que se va en condiciones/rebate y no llega al margen."
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
  // MEMORIA (owner 2026-07-15): antes del relleno genérico, el porqué de la ENTIDAD en foco (dive/why previos) —
  // el mecanismo graduado siempre responde; el genérico queda solo para lecturas sin entidad ni estructura.
  return _entWhy() || { text: "**Por qué**\nEs la lectura directa del dato real, sin estimaciones: te muestro lo que hay y de dónde sale.", suggestions: null, sentrixAction: null, evidence: { followup: true, kind: "explain", boleta: [] }, route: "followup_explain" };
}

// ── composeMeta · preguntas meta HONESTAS (real vs supuesto · fuente · capacidades) · ancladas al contrato, sin inventar ──
export function composeMeta(topic, last) {
  const t = String(topic || "").toLowerCase();
  // SALUDO / AYUDA (sweep simple 2026-07-09: "hola" caía en una lectura random y "ayuda" en repregunta seca — es la
  // PRIMERA impresión del invitado): bienvenida cálida determinística + orientación concreta. Va VERBATIM (sin narrar).
  if (t === "saludo") {
    return {
      text: "¡Hola! Soy ADI, tu asesor de negocio. Trabajo sobre el dato real de tu cartera y te ordeno la decisión: dónde ganás, dónde cedés margen y qué mover primero.\n\nProbá preguntarme: «¿dónde estoy perdiendo dinero?» · «margen por cliente» · «¿qué SKU rota peor?» — o abrí la **Mesa de control** (arriba) para ver todas tus cifras conmigo al lado.",
      suggestions: ["¿Dónde estoy perdiendo dinero?", "Margen por cliente", "¿Qué SKU rota peor?"],
      sentrixAction: null,
      evidence: { followup: true, kind: "saludo", boleta: [] },
      route: "meta_saludo",
    };
  }
  // FUERA DE DATO (owner 2026-07-09 · el narrador ofreció "campañas de marketing" y el hilo murió en un callejón):
  // ADI se adueña del término — declara el límite SIN inventar y convierte hacia las palancas que SÍ puede correr.
  // VERBATIM (no se narra · kind "fuera_de_dato" en shouldNarrate): es una declaración de frontera, el narrador
  // demostró fabular sobre estos límites. Las 3 chips están probadas por el gate de promesas (emisor meta).
  if (t === "fuera_de_dato") {
    const ent = last && typeof last.entity === "string" && last.entity.trim() ? ` de ${last.entity}` : "";
    return {
      text: `Campañas, marketing y publicidad no los tengo como dato — ese análisis no te lo voy a inventar. Lo que sí tengo para empujar la venta${ent}: la **carga comercial** (cuánto margen retiene y cómo se recupera) · la **causa del margen** (si cede por precio o por costo) · el espacio para **subir precio** · y el **capital detenido** en inventario para liberar y reinvertir. ¿Por cuál arranco?`,
      suggestions: ["¿Cuánta carga comercial puedo recuperar?", "Cuáles ceden por precio", "Qué SKU libero primero"],
      sentrixAction: null,
      evidence: { followup: true, kind: "fuera_de_dato", boleta: [] },
      route: "meta_fuera_de_dato",
    };
  }
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
    text = "Hoy proyecto ventas, contribución y capital con un +/-X% sobre el dato real («¿qué pasa si las ventas suben 3%?»), y también el supuesto de una acción: llevar la carga comercial al target o liberar el capital detenido. Siempre te ordeno la decisión: lectura, estructura, riesgo y acción.";
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
  const _mem = (ctx && ctx.memoria) || null;   // LA MEMORIA (owner 2026-07-15): "compáralo" mantiene sujeto aunque medie un paréntesis
  const cmpEnts = (spec && spec.comparison && Array.isArray(spec.comparison.entities)) ? spec.comparison.entities.filter(Boolean) : [];
  const dim0 = (last && (last.dimension || last.entityType)) || (spec && spec.comparison && spec.comparison.dimension) || (spec && spec.dimension)
    || (_mem && _mem.entidad && _mem.entidad.eje) || null;
  // dim a prueba de balas: si el contexto/LLM no trae un eje VÁLIDO, caemos al eje primario (cliente) — la mayoría de las
  // comparaciones son cliente-vs-cliente. Así el compare NUNCA cae al genérico "unknown-dimension" del seam; si la entidad
  // no existe en ese eje, el seam degrada HONESTO ("no tengo X"). NADA hardcodeado del dato, sólo el eje por defecto.
  let dim = (dim0 && ENTITIES[dim0]) ? dim0 : (ENTITIES.cliente ? "cliente" : Object.keys(ENTITIES)[0]);
  let subject, target;
  let subjMem = false;
  if (cmpEnts.length >= 2) { subject = cmpEnts[0]; target = cmpEnts[1]; }  // dos entidades EXPLÍCITAS ('compará A con B')
  else {
    subject = _lastEntity(last) || null;                                    // elíptico: primero el contexto…
    if (!subject && _mem && _mem.entidad && _mem.entidad.nombre) { subject = _mem.entidad.nombre; subjMem = true; }   // …después la memoria
    target = _compareTarget(spec, subject);
  }
  // COHESIÓN nombre+eje (review adversarial 2026-07-15): si el sujeto salió de la MEMORIA, el eje también sale de
  // ella — jamás cruzar el nombre de un cliente con la dimensión de otra evidencia (fabricaba comparaciones vacías).
  if (subjMem && _mem.entidad.eje && ENTITIES[_mem.entidad.eje]) dim = _mem.entidad.eje;
  const dLabel = (ENTITIES[dim] && ENTITIES[dim].label.sing) || "eje";
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

// ── V3 · MULTI-ANÁLISIS (Frente C.1 · owner 2026-07-07): una pregunta que cruza DOS O MÁS lentes ("Lider en margen y
// rotación") se responde con UNA respuesta de secciones — cada sección la produce SU composer vía el seam (misma honestidad,
// mismos degrades, misma boleta) y las boletas se MERGEAN (el guard autoriza las cifras de ambas). La evidencia primaria
// lleva `multi: [evidencias extra]` → la UI muestra un botón de Sentrix por lente. NADA se recalcula acá: solo se orquesta. ──
const _MULTI_LENS = {
  margen:       (d, f) => ({ schemaVersion: 1, operation: "margin", metric: "margen", dimension: d, focus: "bajo_benchmark", filters: f, scenario: "actual" }),
  ventas:       (d, f) => ({ schemaVersion: 1, operation: "ventas", metric: "ventas", dimension: d === "bodega" ? "cliente" : d, focus: "vs_anterior", filters: f, scenario: "actual" }),
  contribucion: (d, f) => ({ schemaVersion: 1, operation: "contribucion", metric: "contribucion", dimension: d, focus: "rank", filters: f, scenario: "actual" }),
  // rotación/capital: por sku/bodega/familia el foco de inventario responde entero; por cliente/canal NO existe el eje →
  // overview deja que el SEAM degrade honesto ("no lo tengo por cliente; sí por SKU/bodega") — la honestidad ya construida.
  rotacion:     (d, f) => (d === "cliente" || d === "canal" || d === "marca") ? ({ schemaVersion: 1, operation: "overview", metric: "rotacion", dimension: d, filters: f, scenario: "actual" }) : ({ schemaVersion: 1, operation: "inventory", metric: "capital", dimension: d, focus: "frenado", filters: f, scenario: "actual" }),
  capital:      (d, f) => (d === "cliente" || d === "canal" || d === "marca") ? ({ schemaVersion: 1, operation: "overview", metric: "capital", dimension: d, filters: f, scenario: "actual" }) : ({ schemaVersion: 1, operation: "inventory", metric: "capital", dimension: d, focus: "frenado", filters: f, scenario: "actual" }),
  carga:        (d, f) => ({ schemaVersion: 1, operation: "margin", metric: "margen", dimension: "cliente", focus: "palancas", filters: f, scenario: "actual" }),
};
const _MULTI_LABEL = { margen: "Margen", ventas: "Ventas", contribucion: "Contribución", rotacion: "Rotación", capital: "Capital en inventario", carga: "Carga comercial" };
export function composeMulti(spec, ctx, state) {
  const m = spec && spec.multi;
  if (!m || !Array.isArray(m.metrics) || m.metrics.length < 2)
    return _clarify("¿Qué dos métricas querés cruzar? Ej: margen y rotación de los SKU.");
  const dim = m.dimension || "cliente";
  const filters = { ...(spec.filters || {}), ...(m.entity && dim === "cliente" ? { cliente: m.entity } : {}) };
  const parts = [], evs = [], bol = [];
  for (const met of m.metrics.slice(0, 3)) {
    const mk = _MULTI_LENS[met];
    if (!mk) continue;
    const r = answerADIFromSpec(mk(dim, filters), ctx, state);
    if (!r || !r.text) continue;
    parts.push(`**${_MULTI_LABEL[met] || met}** — ${r.text}`);
    if (r.evidence) { evs.push(r.evidence); for (const f of (r.evidence.boleta || [])) bol.push(f); }
  }
  if (!parts.length) return _clarify("No pude armar ese cruce. Decime las métricas (margen, ventas, contribución, rotación) y el eje.");
  const primary = evs[0] ? { ...evs[0], boleta: bol, multi: evs.slice(1) } : { boleta: bol };
  return { text: parts.join("\n\n"), suggestions: null, sentrixAction: null, evidence: primary, route: "multi_analysis" };
}

// ── V5 · MEMORIA DE CRITERIO (Frente C.2 · owner 2026-07-07): metas y benchmarks PROPIOS del owner. set aplica al punto
// único de verdad (POLICY/benchmarkOf) → todas las lecturas, palancas y paneles usan SU vara desde el próximo turno.
// propose = ADI detectó un criterio pero NO guarda solo (regla del owner): pregunta y sugiere la frase exacta.
// La evidencia lleva `criteriaList` → panel "Lo que sé de tu negocio" (ver/borrar por ítem). Fuera de rango → honesto. ──
function _criteriaEvidence() {
  const list = activeCriteria();
  return { followup: true, kind: "criteria", criteriaList: list, boleta: list.map((c) => fig(`Criterio · ${c.label}`, c.valueFmt, { unit: c.valueFmt.endsWith("%") ? "pct" : "count", raw: c.value, mandatory: false, source: "computed", context: "criterio del negocio" })) };
}
export function composeCriteria(ci) {
  if (!ci) return _clarify("¿Qué criterio querés que recuerde? Ej: 'recordá que mi margen mínimo es 28%'.");
  const c = CRITERIA[ci.key];
  if (ci.action === "recall") {
    const list = activeCriteria();
    const text = list.length
      ? `Esto es lo que sé de tu negocio: ${list.map((x) => `${x.label} ${x.valueFmt} (estándar ${x.standard})`).join(" · ")}. Uso TU vara en todas las lecturas y medidas. Para borrar uno: "olvidá el ${list[0].label.toLowerCase()}".`
      : `Todavía no guardé ningún criterio tuyo — uso los estándares (margen mínimo ${CRITERIA.margen_minimo.fmt(30.1)}, carga ${CRITERIA.target_carga.fmt(3.5)}). Podés fijar tu vara: "recordá que mi margen mínimo es 28%".`;
    return { text, suggestions: null, sentrixAction: null, evidence: _criteriaEvidence(), route: "apply_criteria" };
  }
  if (ci.action === "forget") {
    const r = forgetCriterion(ci.key);
    const text = !r.ok
      ? `No tengo guardado ese criterio — estás usando los estándares.`
      : r.all
      ? `Listo, olvidé todos tus criterios: vuelvo a los estándares en todas las lecturas.`
      : `Listo, olvidé tu ${c ? c.label.toLowerCase() : ci.key}: vuelvo al estándar desde ahora.`;
    return { text, suggestions: null, sentrixAction: null, evidence: _criteriaEvidence(), route: "apply_criteria" };
  }
  if (ci.action === "propose") {
    const text = `Eso suena a un criterio tuyo: ${c.label.toLowerCase()} ${c.fmt(ci.value)}. No lo guardo sin tu OK — si querés que lo use como TU vara en todas las lecturas, decime: "recordá que mi ${c.label.toLowerCase()} es ${ci.value}".`;
    return { text, suggestions: [`Recordá que mi ${c.label.toLowerCase()} es ${ci.value}`], sentrixAction: null, evidence: _criteriaEvidence(), route: "apply_criteria" };
  }
  // set
  const r = setCriterion(ci.key, ci.value);
  if (!r.ok) {
    const text = r.reason === "rango"
      ? `Ese valor no me cierra como ${c.label.toLowerCase()}: tiene que estar entre ${c.fmt(r.min)} y ${c.fmt(r.max)}. No lo guardo — decímelo de nuevo con un valor en ese rango.`
      : `No reconozco ese criterio. Hoy puedo recordar: ${Object.values(CRITERIA).map((x) => x.label.toLowerCase()).join(", ")}.`;
    return { text, suggestions: null, sentrixAction: null, evidence: _criteriaEvidence(), route: "apply_criteria" };
  }
  const text = `Listo — desde ahora tu ${c.label.toLowerCase()} es ${c.fmt(r.value)} (antes usaba ${c.fmt(r.prev)}). Todas las lecturas, medidas y paneles miden contra TU vara. Para volver al estándar: "olvidá el ${c.label.toLowerCase()}".`;
  return { text, suggestions: null, sentrixAction: null, evidence: _criteriaEvidence(), route: "apply_criteria" };
}

// ── ACEPTACIÓN · "sí" pelado tras una oferta de ADI (bug cazado por el owner 2026-07-07 · rehecho 2026-07-15:
// "respondo SI y luego se pierde" — tras un dive narrado caía al clarify genérico). El orden de resolución:
//   1 · LA OFERTA REAL (ctx.lastOffer = la pregunta con que ADI cerró · o la primera sugerencia): se ejecuta por la
//       MISMA red del piso (coerceFloor — la que responde las promesas de la UI), heredando entidad/alcance de la
//       última evidencia. El cierre de ADI es una promesa: "sí" la cumple, no la re-pregunta.
//   2 · tras un COMPARE → el dive causal de la cuenta floja (la que la oferta proponía trabajar).
//   3 · tras una lectura con LISTA → el dive de la primera entidad nombrada.
//   4 · veníamos mirando UNA entidad (dive/why) → su PORQUÉ graduado (mecanismo · siempre responde).
//   5 · tras una simulación → la recomendación de seguimiento.
// Nunca vuelve al LLM a adivinar, nunca degrada con vocabulario interno. ─────────────────────────────────────────
function _execOffer(text, ctx, state) {
  const t = String(text || "").trim();
  if (!t || t.length > 240) return null;
  let s = null;
  // hasLast=true: las ofertas elípticas ("¿Es por precio o por costo?") necesitan el contexto para reclamar su foco;
  // los claims de turno que no corresponden acá (accept/clarify) se filtran abajo — sin riesgo de recursión.
  try { s = coerceFloor(t, true, null); } catch { return null; }
  if (!s || s.turn_type === "followup_accept" || s.turn_type === "clarification_needed") return null;
  const last = ctx && ctx.last;
  const mem = (ctx && ctx.memoria) || null;
  const _dim = (d) => (d && ENTITIES[d] ? d : null);
  // la ENTIDAD EN FOCO — reglas del review adversarial 2026-07-15 (2 jueces c/u):
  //   · LA OFERTA HEREDA DEL TURNO QUE LA EMITIÓ: si hay última evidencia, la entidad sale SOLO de ella (una oferta
  //     tras un turno global NO se reescribe con una entidad de 2 turnos atrás — eso era inventar el referente).
  //   · NOMBRE+EJE DE LA MISMA FUENTE: jamás mezclar el nombre de la memoria con el eje de otra evidencia (comparaba
  //     un cliente como si fuera bodega). La memoria entra SOLO cuando no hay evidencia (paréntesis largo).
  const _foco = (last && last.entidad)
    ? { nombre: last.entidad, eje: _dim(last.entityType) || _dim(last.dimension) }
    : (!last && mem && mem.entidad && mem.entidad.nombre) ? { nombre: mem.entidad.nombre, eje: _dim(mem.entidad.eje) } : null;
  const focoNombre = _foco && _foco.nombre, focoEje = _foco && _foco.eje;
  if (last || focoNombre) {
    // HERENCIA DE ALCANCE: la oferta suele nombrar el ANÁLISIS ("análisis de costos"), no la entidad — la entidad
    // viene de lo que veníamos mirando. dive/why sin entidad → la última entidad; overview genérico mirando UNA
    // entidad → su porqué (mecanismo: margen/costo/carga graduado); dominio sin filtros → entityScope heredado.
    const hasFilters = !!(s.filters && Object.values(s.filters).some(Boolean));
    if ((s.operation === "dive" || s.operation === "why") && !s.entity && focoNombre) {
      s = { ...s, entity: focoNombre, dimension: _dim(s.dimension) || focoEje || "cliente" };
    } else if (s.operation === "overview" && !s.entity && !hasFilters && focoNombre) {
      s = { schemaVersion: 1, operation: "why", dimension: focoEje || "cliente", entity: focoNombre, metric: "margen", scenario: "actual" };
    } else if (!s.entity && !hasFilters) {
      const scope = (last && last.entityList && Array.isArray(last.entityList.entities) && last.entityList.entities.length) ? last.entityList
        : (focoNombre ? { entities: [focoNombre], dimension: focoEje } : null);
      if (scope) {
        s = { ...s, entityScope: scope };
        // misma regla del camino deíctico: los composers que honran spec.dimension se ALINEAN al eje del set
        // heredado — si no, el alcance de un SKU sobre un claim dim=cliente no intersecta y se ignora (cartera).
        if ((s.operation === "margin" || s.operation === "contribucion") && scope.dimension && ENTITIES[scope.dimension]) s = { ...s, dimension: scope.dimension };
      }
    }
  }
  let r = null;
  const subCtx = { ...(ctx || {}) }; delete subCtx.lastOffer; delete subCtx.lastSuggestions;   // sin re-entrar al accept
  try { r = answerConversational(s, subCtx, state); } catch { return null; }
  const bad = !r || !String(r.text || "").trim() || /^(clarification_needed|followup_no_context)$|^spec_blocked/.test(String(r.route || ""));
  return bad ? null : r;
}
export function composeAccept(spec, ctx, state) {
  const last = ctx && ctx.last;
  const mem = (ctx && ctx.memoria) || null;
  if (!last && !(mem && (mem.oferta || mem.proximaAccion || mem.entidad))) return _needLast();
  // 1 · la oferta con que ADI cerró (o la próxima acción sugerida) — lo que el usuario está aceptando LITERALMENTE.
  // La MEMORIA manda (la boleta del owner); lastOffer/lastSuggestions quedan como compat del shape anterior.
  const viaOferta = _execOffer((mem && mem.oferta) || (ctx && ctx.lastOffer), ctx, state)
    || _execOffer((mem && mem.proximaAccion) || (ctx && Array.isArray(ctx.lastSuggestions) && ctx.lastSuggestions[0]), ctx, state);
  if (viaOferta) return viaOferta;
  if (!last) {
    // sin evidencia pero con ENTIDAD en memoria (paréntesis largo) → su porqué graduado antes que el mensaje vacío
    if (mem && mem.entidad && mem.entidad.nombre) {
      const dim = (mem.entidad.eje && ENTITIES[mem.entidad.eje]) ? mem.entidad.eje : "cliente";
      return answerADIFromSpec({ schemaVersion: 1, operation: "why", dimension: dim, entity: mem.entidad.nombre, metric: "margen", scenario: "actual" }, ctx, state);
    }
    return _needLast();
  }
  // 2 · compare previo → el dive causal de la cuenta floja
  const a = last.compareA || last.entidad, b = last.compareB || last.entityB;
  if (a && b && Array.isArray(last.pairs) && last.pairs.length) {
    const mp = last.pairs.find((p) => /margen/i.test(String(p.label)));
    const target = (mp && typeof mp.aVal === "number" && typeof mp.bVal === "number") ? (mp.aVal <= mp.bVal ? a : b) : a;
    const dim = (last.entityType && ENTITIES[last.entityType]) ? last.entityType : "cliente";
    return answerADIFromSpec({ schemaVersion: 1, operation: "dive", dimension: dim, entity: target, scenario: "actual" }, ctx, state);
  }
  // 3 · lista nombrada → el dive de la primera
  const el = last.entityList;
  if (el && Array.isArray(el.entities) && el.entities.length) {
    const dim = (el.dimension && ENTITIES[el.dimension]) ? el.dimension : "cliente";
    return answerADIFromSpec({ schemaVersion: 1, operation: "dive", dimension: dim, entity: el.entities[0], scenario: "actual" }, ctx, state);
  }
  // 4 · veníamos mirando UNA entidad (de LA evidencia — la memoria solo aplica sin evidencia, arriba) → el
  // siguiente paso ESCALA: si el turno anterior ya fue su porqué (mem.ruta why) el "sí" no lo repite — pasa a
  // la RECOMENDACIÓN de esa entidad (dive → why → recommend · review adversarial: el "sí" repetido quedaba pegado).
  if (last.entidad) {
    const dim = (last.entityType && ENTITIES[last.entityType]) ? last.entityType
      : (last.dimension && ENTITIES[last.dimension]) ? last.dimension : "cliente";
    const yaWhy = mem && mem.ruta && /why/.test(String(mem.ruta)) && mem.entidad && mem.entidad.nombre === last.entidad;
    return answerADIFromSpec({ schemaVersion: 1, operation: yaWhy ? "recommend" : "why", dimension: dim, entity: last.entidad, metric: "margen", scenario: "actual" }, ctx, state);
  }
  // 5 · tras una simulación → la recomendación de seguimiento
  const rec = composeFollowupRecommendation(last);
  if (rec) return rec;
  return _clarify("Dale — ¿seguimos con lo último o miramos otra cosa? Decime la cuenta o el foco y arranco.");
}

// ── REGISTRY · turn_type → resolver. Sumar una fase = sumar una entrada (V2-V6), NO reestructurar. ───────────────────
const TURN_RESOLVERS = {
  new_query:                  (spec, ctx, state) => answerADIFromSpec(spec, ctx, state),                  // V1
  followup_modify_assumption: (spec, ctx, state) => answerADIFromSpec(spec, ctx, state),                  // V1 · el LLM emite el spec YA resuelto → seam RECALCULA
  followup_change_dimension:  (spec, ctx, state) => answerADIFromSpec(spec, ctx, state),                  // V1 · idem
  followup_recommendation:    (spec, ctx) => composeFollowupRecommendation(ctx.last) || _needLast(),      // V1
  followup_explain:           (spec, ctx, state) => composeExplain(ctx.last, ctx, state),                 // V1 (+ memoria: el porqué de la entidad en foco)
  meta_question:              (spec, ctx) => composeMeta(spec && spec.meta, ctx.last),                    // V1
  clarification_needed:       (spec) => _clarify(spec && spec.clarify),                                   // V1
  followup_compare:           (spec, ctx, state) => composeCompare(spec, ctx, state),                      // V2 · comparación conversacional REAL (target del LLM · sujeto/eje del contexto · seam ejecuta)
  multi_analysis:             (spec, ctx, state) => composeMulti(spec, ctx, state),                        // V3 · cruce de lentes (Frente C.1 · secciones por composer · boletas mergeadas · evidence.multi)
  apply_criteria:             (spec) => composeCriteria(spec && spec.criteria),                            // V5 · memoria de criterio (Frente C.2 · metas/benchmarks del owner · una verdad vía POLICY)
  followup_accept:            (spec, ctx, state) => composeAccept(spec, ctx, state),                       // "sí" pelado → ejecutar la oferta (dive causal de la cuenta floja / primera nombrada / recomendación)
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
  // BLINDAJE del campo operation (bug cazado por el owner 2026-07-07): el LLM #1 a veces pone un TURN_TYPE en OPERATION
  // ("operation":"followup_compare") → el seam lo rechazaba y el degrade filtraba vocabulario interno al usuario. Un
  // operation con forma de turn_type ES un turn_type: se migra de campo (resolver conocido) o cae a recomendación contextual.
  // + clarification_needed (gate de promesas 2026-07-09): en operation llegaba al seam como op desconocida → "Eso todavía
  // no lo tengo como análisis directo" (mentira — no es un límite del contrato, es una repregunta). Migra a su resolver.
  if (spec && /^(followup_|recall_|session_|apply_|meta_|multi_|clarification_)/.test(String(spec.operation || ""))) {
    // un turn_type ESPECÍFICO ya coercido (multi_analysis/apply_criteria/…) MANDA sobre la migración — el blindaje
    // nació para el caso tt="new_query" espurio; si lo dejáramos migrar siempre, operation:"clarification_needed"
    // del LLM le robaba el turno al multi de la Ficha (cazado por el gate de promesas 2026-07-10).
    tt = (tt && tt !== "new_query" && TURN_RESOLVERS[tt]) ? tt
      : (TURN_RESOLVERS[spec.operation] ? spec.operation : (tt && TURN_RESOLVERS[tt] ? tt : "followup_recommendation"));
    spec = { ...spec, operation: undefined };
  }
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
