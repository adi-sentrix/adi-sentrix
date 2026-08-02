/* === src/adi/oracle/dialogueState.js · ARQUITECTURA C · Fase 3 · ESTADO CONVERSACIONAL DENTRO DE `mem` ===
 * owner 2026-07-30: "Estoy de acuerdo con usar `mem` como única memoria conversacional. No construyamos un
 * DialogueState paralelo ni agreguemos nuevas llamadas al LLM." Funciones PURAS (sin LLM, sin I/O) que
 * answerViaOracle.js orquesta — mismo patrón que responsePreference.js/narrationBlocks.js: dato + funciones,
 * consumidas por PLAN y NARRATE vía persona.js/renderInteractionMemory (el ÚNICO injection point ya compartido
 * entre las dos pasadas — no hace falta plumbing nuevo).
 *
 * Dos piezas de estado, cada una con su regla de vigencia:
 *   · mem.lastOffer — la última oferta de seguimiento que ADI hizo, SIEMPRE recalculada desde CERO en cada turno
 *     (nunca heredada — mismo principio que ya probó `updateMemoria` en el pipeline viejo, conversation.js:49-63:
 *     la entidad puede persistir, pero la oferta se recomputa siempre). Esto es lo que hace que "cambio de tema",
 *     "rechazo" y "ejecución" inviden la oferta anterior SIN código especial: la próxima narración simplemente
 *     produce (o no) su propia oferta fresca. Estructurada cuando es posible (tool+args), para que "sí" ejecute
 *     EXACTAMENTE lo ofrecido en vez de reinterpretarlo — ver extractOffer().
 *   · mem.recentSubjects — lista acotada (máx 3, más reciente primero) de qué entidades se discutieron. SEÑAL para
 *     que el LLM pueda reconocer "volvamos a lo de Sodimac", NUNCA autoridad: se deriva DESPUÉS de que el PLAN ya
 *     resolvió su propio scope (por comprensión, como siempre) — jamás se le da al PLAN como valor por defecto.
 */
import { parseBlocks } from "./narrationBlocks.js";

// ── ACEPTACIÓN ("sí", "dale"...) ────────────────────────────────────────────────────────────────────────────────
export const ACCEPT_RE = /^\s*(s[ií]|dale|de acuerdo|ok(?:ay)?|listo|adelante|hag[aá]moslo|hazlo|hacelo|perfecto|correcto|as[ií]\s+es|eso\s+mismo)[\s.,!¡]*$/i;
export function isAcceptance(text) {
  return ACCEPT_RE.test(String(text || "").trim());
}

// ── EXTRACCIÓN DE LA OFERTA ──────────────────────────────────────────────────────────────────────────────────────
// solo relevante para contentScope="full": data_only/action_only/results_only NUNCA ofrecen seguimiento (data_only
// por diseño explícito del owner; action_only/results_only porque su respuesta YA es mínima por pedido del
// usuario) — pedir "más" después de "dame solo la acción" contradice lo que se pidió. Sin oferta, sin estado.
//
// "Estructurada cuando sea posible" (owner): si el narrador cerró con [[SIGUIENTE_PASO]] (instrucción SIEMPRE
// activa, ver narratePromptC.js — a diferencia del uso de este mismo marcador bajo pref restringido, acá NO
// selecciona contenido, solo IDENTIFICA cuál oración es la oferta) se usa esa oración tal cual, exacta. Sin marca,
// fallback a la última "¿...?" del texto (mismo método que `extractOffer` del pipeline viejo).
//
// tool/args SOLO se derivan en el caso limpio: la respuesta usó UNA sola tool este turno Y la oferta es del tipo
// "profundizá en esto mismo" (no "explorá algo distinto") — ahí "ejecutar exactamente lo ofrecido" es honesto:
// repetir la MISMA tool/scope es literalmente lo que se ofreció. Una oferta que propone un ángulo nuevo (otra
// entidad, otra métrica) queda con tool=null — sigue necesitando criterio del LLM la próxima vez, y ESO se declara
// así, no se finge una precisión que no existe.
const _CONTINUATION_OFFER_RE = /profundiz|m[aá]s\s+detalle|seguir\s+viendo|ver\s+m[aá]s|el\s+porqu[eé]|el\s+c[aá]lculo|c[oó]mo\s+se\s+compone|desglos/i;
// _VAGUE_TOPIC_RE — la oferta propone seguir en EL MISMO tema pero con palabras que no describen ninguna acción
// ejecutable ("explorar condiciones/alternativas/opciones de negociación") — señal de CONTINUACIÓN igual de válida
// que _CONTINUATION_OFFER_RE de arriba, usada en dos lugares (extractOffer más abajo + isVagueOffer): UNA sola
// fuente para no arriesgar que las dos definiciones diverjan con el tiempo.
const _VAGUE_TOPIC_RE = /condici[oó]n|negociaci|alternativa|opci[oó]n(es)?|explor/i;
const _QUESTION_RE = /¿[^?]{4,220}\?/g;

// MECANISMO CON SIMULACIÓN DEDICADA (owner 2026-08-01, hallazgo en vivo de 2do orden — ver
// adi-oferta-vaga-aceptada.md): repetir la MISMA tool (entityProfile) para "profundizá en el desglose de la carga
// comercial" seguía dando una respuesta casi idéntica — entityProfile no calcula ningún desglose nuevo, así que
// "profundizar" con la MISMA tool no profundiza nada. Pero SÍ existe una tool dedicada, `simulateCarga` (PLAN
// catalog, planPrompt.js), que calcula el $ recuperable REAL de bajar la carga comercial al target — "profundizar
// en la carga comercial" de una entidad puntual tiene un mecanismo genuino, no hace falta conformarse con
// reformular. Se prefiere ESTA tool sobre el "repetí lo mismo" genérico de abajo cuando (a) la respuesta NOMBRÓ la
// carga comercial como mecanismo (no alcanza con que la oferta la mencione de pasada) y (b) hay una entidad puntual
// conocida (simulateCarga sin filtro corre sobre TODA la cartera — no es lo que "profundizar en ESTE cliente" pide).
const _CARGA_MECHANISM_RE = /carga\s+comercial/i;

// _singleFilterEntity(calls) → {entidad, dimension} | null — RESPALDO (owner 2026-07-31, hallazgo por lectura de
// código): planPrompt.js nunca le pide al LLM declarar scope.level="entity" cuando el alcance de una consulta
// viaja vía `filters` (bodega/marca/familia/cliente — inventoryStatus/marginRead/contributionRead/etc.) — el plan
// deja scope.level="global" aunque el usuario haya nombrado una bodega/entidad explícita, y esa entidad nunca
// quedaba registrada en mem.recentSubjects/mem.lastOffer. Genuinamente INEQUÍVOCO (no adivina nada): si `filters`
// trae EXACTAMENTE UN valor de eje poblado, ESA es la entidad del turno, sin importar qué haya declarado scope.
const _FILTER_AXES = ["marca", "familia", "bodega", "cliente"];
function _singleFilterEntity(calls) {
  const filters = Array.isArray(calls) && calls[0] && calls[0].args && calls[0].args.filters;
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) return null;
  const present = _FILTER_AXES.filter((k) => filters[k] != null && filters[k] !== "");
  return present.length === 1 ? { entidad: filters[present[0]], dimension: present[0] } : null;
}

export function extractOffer(narration, { plan, calls, pref, turno } = {}) {
  if (!pref || pref.contentScope !== "full") return null;
  const parsed = parseBlocks(narration);
  let texto = parsed && parsed.siguiente_paso ? parsed.siguiente_paso.trim() : null;
  if (!texto) {
    const matches = [...String(narration || "").matchAll(_QUESTION_RE)];
    if (matches.length) texto = matches[matches.length - 1][0].trim();
  }
  if (!texto) return null;
  const singleFilter = _singleFilterEntity(calls);
  const entidad = (plan && plan.scope && plan.scope.level === "entity" && Array.isArray(plan.scope.entities) && plan.scope.entities[0])
    || (singleFilter && singleFilter.entidad) || null;
  const dimension = (Array.isArray(calls) && calls[0] && calls[0].args && calls[0].args.dimension) || (singleFilter && singleFilter.dimension) || null;
  let tool = null, args = null;
  if (entidad && _CARGA_MECHANISM_RE.test(String(narration || "")) && (_CONTINUATION_OFFER_RE.test(texto) || _VAGUE_TOPIC_RE.test(texto))) {
    tool = "simulateCarga";
    args = { filters: { cliente: entidad } };
  } else if (Array.isArray(calls) && calls.length === 1 && calls[0] && _CONTINUATION_OFFER_RE.test(texto)) {
    tool = calls[0].tool;
    args = calls[0].args || {};
  }
  return { texto, entidad, dimension, modoOrigen: (plan && plan.mode) || null, tool, args, turno: turno == null ? null : turno };
}

// ── TEMAS RECIENTES (LRU acotado a 3) ───────────────────────────────────────────────────────────────────────────
// owner: "un único sujeto sobrescrito no puede cumplir honestamente [volver a un tema anterior]... no construyas
// memoria ilimitada." Se deriva DESPUÉS de que plan.scope ya está resuelto (por comprensión, como siempre) — nunca
// antes, nunca como input que lo condicione. Reordena (no duplica) si el tema YA estaba en la lista.
export function updateRecentSubjects(prev, plan, calls, turno) {
  const list = (Array.isArray(prev) ? prev : []).slice(0, 3);
  let entidad = null, dimension = null;
  if (plan && plan.scope && plan.scope.level === "entity" && Array.isArray(plan.scope.entities) && plan.scope.entities.length && plan.scope.entities[0]) {
    entidad = plan.scope.entities[0];
    dimension = (Array.isArray(calls) && calls[0] && calls[0].args && calls[0].args.dimension) || null;
  } else {
    // RESPALDO vía filters (ver _singleFilterEntity arriba) — solo cuando scope no trajo ya una entidad explícita.
    const single = _singleFilterEntity(calls);
    if (single) { entidad = single.entidad; dimension = single.dimension; }
  }
  if (!entidad) return list;
  const idx = list.findIndex((s) => s && s.entidad === entidad);
  if (idx >= 0) list.splice(idx, 1);
  list.unshift({ entidad, dimension, turno: turno == null ? null : turno });
  return list.slice(0, 3);
}

// ── ORIENTACIÓN INICIAL MID-CONVERSACIÓN (la tarea que nombra la Fase 3) ────────────────────────────────────────
// Dos disparadores DETERMINÍSTICOS (mismo patrón que _coerceMode/_coercePref — red angosta para frases inequívocas,
// nunca el mecanismo principal para casos ambiguos): pedido explícito de orientación, o confusión persistente MÁS
// ALLÁ de los 2 niveles de escalación que clarify ya cubre (nivel 3 = "probamos simplificar dos veces, cambiemos
// de enfoque"). "Objetivo recién cerrado" (owner) se resuelve como refuerzo de doctrina en modos decision/evidencia
// (conversationalContract.js), NO como un tercer disparador determinístico — detectar en silencio que un objetivo
// "se cerró" sin que el usuario diga nada es inherentemente ambiguo; forzarlo arriesga sonar a chip genérico
// pegado con violencia, exactamente lo que el owner pidió evitar.
const _ORIENTACION_RE = /\bno s[eé] qu[eé] (?:m[aá]s\s+)?preguntar\b|\bpor\s+d[oó]nde\s+(?:sigo|empiezo)\b|\bqu[eé]\s+m[aá]s\s+hay\b|\bqu[eé]\s+sigue\b|\by\s+ahora\s+qu[eé]\b|\bqu[eé]\s+me\s+falta\s+ver\b|\bqu[eé]\s+deber[ií]a\s+mirar\b|\bqu[eé]\s+m[aá]s\s+puedo\s+preguntar\b/i;
export function needsOrientacion(text, clarifyStreakNow) {
  if (_ORIENTACION_RE.test(String(text || ""))) return "pedido_explicito";
  if (typeof clarifyStreakNow === "number" && clarifyStreakNow >= 3) return "confusion_persistente";
  return null;
}

// buildOrientacionInstruction(reason, recentSubjects) → instrucción REFORZADA a nivel de turno (mismo hallazgo de
// calibración que "instruccion_formato" en responsePreference.js: el system prompt solo no bastó para el formato de
// bloques, así que esto va DIRECTO en el payload de NARRATE, no solo como una regla de fondo).
export function buildOrientacionInstruction(reason, recentSubjects) {
  if (!reason) return null;
  const temas = (Array.isArray(recentSubjects) && recentSubjects.length) ? recentSubjects.map((s) => s.entidad).filter(Boolean).join(", ") : null;
  const base = reason === "confusion_persistente"
    ? "El usuario sigue sin entender después de varios intentos de simplificar. Además de tu explicación, cerrá proponiendo mirar el MISMO tema desde un ángulo más chico y concreto (ej. una sola cuenta en vez de la cartera completa)"
    : "El usuario no sabe qué preguntar. Cerrá con 2 o 3 ángulos CONCRETOS y distintos para seguir, basados en datos reales de esta conversación";
  const conTemas = temas ? `${base} — si tiene sentido, podés retomar alguno de estos temas recientes: ${temas}.` : `${base}.`;
  return `${conTemas} NUNCA ofrezcas algo genérico tipo "¿en qué más te puedo ayudar?" — cada sugerencia nombra una entidad, métrica o foco real, no una categoría vacía.`;
}

// ── ACEPTACIÓN HUÉRFANA (owner 2026-07-31, cierre de #48) — "sí"/"dale" SIN ninguna mem.lastOffer activa: "no debe
// repetir la respuesta anterior; debe pedir una precisión breve o mostrar las opciones vigentes." Medido en vivo
// (ver adi-fase3-orientacion-inicial.md): dejarlo en manos del narrador produjo una respuesta casi idéntica a la
// anterior — el riesgo exacto que esto cierra. composeOrphanAcceptance() NUNCA se narra libre (answerViaOracle.js
// la usa para un bypass determinístico, igual que composeNoDataMessage en narrationBlocks.js).
export function composeOrphanAcceptance(recentSubjects) {
  const temas = (Array.isArray(recentSubjects) ? recentSubjects : []).map((s) => s && s.entidad).filter(Boolean);
  if (temas.length) return `No tengo una oferta pendiente para ese "sí" — ¿te referís a ${temas.join(" o a ")}? Decime a cuál y sigo.`;
  return `No tengo un contexto previo para saber a qué te referís con "sí". Contame qué querés revisar y lo armo.`;
}

// ── OFERTA VAGA ACEPTADA (owner 2026-08-01, hallazgo en vivo: "¿querés que exploremos más sobre las condiciones
// posibles para esa renegociación?" → "sí" no matchea _CONTINUATION_OFFER_RE (no es "profundizá"/"el cálculo"), así
// que priorOffer.tool queda null y el turno cae de largo a PLAN normal — que, sin nada nuevo que decidir, vuelve a
// llamar la MISMA tool (ej. entityProfile) y el narrador solo puede reformular: respuesta casi idéntica, el usuario
// (con razón) lee "no me escuchó". Causa raíz real: "condiciones de negociación" no tiene mecanismo genérico —
// simulateGeneral SOLO modela precio/volumen (toolRegistry.js), nunca rebate/descuento. Cuando el mecanismo nombrado
// SÍ es la carga comercial, extractOffer de arriba ya lo resuelve mejor (ruta simulateCarga, real) — esto es el
// remanente honesto para cuando NO hay tool dedicada (rebate/descuento) o la entidad no se pudo determinar: ofrecer
// lo que SÍ existe en vez de repetir en silencio. Ver también narratePromptC.js (OFERTA DE SEGUIMIENTO MARCADA):
// esto es la red de seguridad para ofertas YA narradas antes del fix de prompt — el fix de prompt evita que se
// sigan generando.
export function isVagueOffer(offer) {
  return !!(offer && !offer.tool && offer.texto && _VAGUE_TOPIC_RE.test(offer.texto));
}
export function composeVagueOfferAcceptance(offer) {
  const entidad = offer && offer.entidad;
  if (!entidad) return `No tengo una forma concreta de "explorar esas condiciones" con el dato que manejo — ¿querés que simule un cambio de precio o de volumen, o preferís el desglose completo del mecanismo que ya nombré?`;
  return `No tengo un mecanismo para simular "condiciones de negociación" en abstracto — pero puedo simular un cambio concreto de precio o de volumen para ${entidad}, o mostrarte el desglose completo del mecanismo que ya nombré. ¿Cuál preferís?`;
}

// ── RETORNO A TEMAS RECIENTES (owner 2026-07-31, cierre de #48) — referencia POSICIONAL a recentSubjects (una
// entidad NOMBRADA explícita, ej. "volvamos a lo de Falabella", ya la resuelve PLAN por comprensión vía la REGLA DE
// ALCANCE de planPrompt.js — esto de acá es SOLO para cuando el usuario apunta por POSICIÓN, no por nombre):
//   · "volvamos a lo anterior"/"el tema anterior" → el sujeto INMEDIATAMENTE anterior = recentSubjects[0] (el más
//     reciente trackeado — recordar que la lista viaja más-reciente-primero).
//   · "el primer tema"/"con lo que empezamos" → el MÁS VIEJO trackeado = el ÚLTIMO índice de la lista (tope 3 — no
//     necesariamente el primero de TODA la conversación si ya se cayó del tope; es lo más honesto que se puede
//     prometer sin memoria ilimitada, mismo principio que el resto de recentSubjects).
//   · Referencia GENÉRICA de retorno ("volvamos a un tema anterior"/"a alguno de los de antes") SIN apuntar una
//     posición concreta, con 2+ candidatos → AMBIGUO POR DISEÑO: nunca se adivina, se pregunta cuál (ver
//     composeSubjectAmbiguity). Con 0-1 candidatos no hay ambigüedad real que declarar (deja pasar a PLAN normal).
const _RECALL_ANTERIOR_RE = /\bvolvamos\s+a\s+lo\s+anterior\b|\bvolv[eé]\s+a\s+lo\s+anterior\b|\bel\s+tema\s+anterior\b|\blo\s+de\s+antes\b|\bal\s+tema\s+anterior\b/i;
const _RECALL_PRIMERO_RE = /\b(?:el|al)\s+primer\s+tema\b|\bcon\s+lo\s+que\s+empezamos\b|\bel\s+primero\s+de\s+todos\b|\bvolvamos\s+al\s+principio\b/i;
const _RECALL_GENERIC_RE = /\bvolvamos\s+a\s+(?:un|uno\s+de\s+los?)\s+tema\b|\ba\s+alguno\s+de\s+los\s+(?:temas|de\s+antes)\b|\botro\s+de\s+los\s+temas\s+anteriores\b/i;

// resolveSubjectRecall(text, recentSubjects) → {kind:"resolved", subject} | {kind:"ambiguous", options} | null.
export function resolveSubjectRecall(text, recentSubjects) {
  const list = (Array.isArray(recentSubjects) ? recentSubjects : []).filter((s) => s && s.entidad);
  if (!list.length) return null;
  const t = String(text || "");
  if (_RECALL_ANTERIOR_RE.test(t)) return { kind: "resolved", subject: list[0] };
  if (_RECALL_PRIMERO_RE.test(t)) return { kind: "resolved", subject: list[list.length - 1] };
  if (_RECALL_GENERIC_RE.test(t) && list.length >= 2) return { kind: "ambiguous", options: list };
  return null;
}

export function composeSubjectAmbiguity(options) {
  const temas = (Array.isArray(options) ? options : []).map((s) => s && s.entidad).filter(Boolean);
  return `Tengo varios temas recientes: ${temas.join(", ")}. ¿A cuál te referís?`;
}
