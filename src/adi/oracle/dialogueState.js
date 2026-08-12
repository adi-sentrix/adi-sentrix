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
import { extractSignedPct } from "./scenarioIntent.js";

// ── VISTAS DERIVADAS DE conversationScope (Etapa 4, owner 2026-08-04, "lastOffer/recentSubjects como vistas
// derivadas del scope canónico") ───────────────────────────────────────────────────────────────────────────────
// mem.lastOffer/mem.recentSubjects DEJAN DE SER una segunda fuente de verdad mantenida en paralelo — a partir de
// acá se CALCULAN leyendo mem.conversationScope (conversationScope.js) en el momento en que se necesitan, vía
// estos dos getters. answerViaOracle.js escribe el valor CANÓNICO en conversationScope (current.ofertaPendiente /
// root.recentSubjects) en el MISMO instante en que escribe el campo legacy — dual-write, nunca dos fuentes que
// puedan divergir (ver los comentarios junto a cada sitio de escritura en ese archivo: _composedBypassResult, el
// bypass de criteriaIntent, y el cierre del turno completo).
//
// El fallback a mem.lastOffer/mem.recentSubjects "pelados" es OBLIGATORIO, no cosmético: ~13-20 fixtures de gate
// (ej. _vague_offer_gate.mjs, _dialogue_state_gate.mjs, _tool_contracts_gate.mjs) arman `mem: {lastOffer:{...}}`
// a mano, sin poblar conversationScope en paralelo — sin el fallback, esos gates dejarían de funcionar. Por eso
// la precedencia es: conversationScope (si trae algo) primero, mem.<campo> plano después — NUNCA al revés (un
// mem.<campo> plano nunca debe pisar en silencio un valor canónico ya escrito ahí).
//
// `mem.conversationScope.current.ofertaPendiente` es el campo RESERVADO desde el diseño original del shape (ver
// el comentario de cabecera de conversationScope.js, "ofertaPendiente object|null reservado — Etapa 2/3") — nunca
// fue código muerto, solo esperaba a que Etapa 4 lo empezara a escribir. `mem.conversationScope.recentSubjects`
// es un campo NUEVO en la raíz del objeto (hermano de `current`/`history`) — consolidación FÍSICA (mismo mecanismo
// LRU de updateRecentSubjects de abajo, sin cambiar su semántica de retención) — NO la derivación semántica
// completa desde conversationScope.history, que quedó fuera de alcance de Etapa 4 (ver el comentario grande al
// final de este archivo, "POR QUÉ recentSubjects NO se deriva de conversationScope.history").
export function getLastOffer(mem) {
  const scope = mem && mem.conversationScope;
  const fromScope = scope && scope.current && scope.current.ofertaPendiente;
  if (fromScope && typeof fromScope === "object") return fromScope;
  return (mem && mem.lastOffer && typeof mem.lastOffer === "object") ? mem.lastOffer : null;
}
export function getRecentSubjects(mem) {
  const scope = mem && mem.conversationScope;
  if (scope && Array.isArray(scope.recentSubjects)) return scope.recentSubjects;
  return Array.isArray(mem && mem.recentSubjects) ? mem.recentSubjects : [];
}

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
// "profundi[zc]" (no solo "profundiz"): hallazgo en vivo 2026-08-02 — "¿profundicemos...?" (conjugación nosotros de
// "profundizar", MISMO cambio ortográfico z→c que "empezar"→"empecemos") no matcheaba, así que una oferta tan común
// como "¿te gustaría que profundicemos...?" caía SIEMPRE a la rama genérica aunque hubiera un mecanismo dedicado.
const _CONTINUATION_OFFER_RE = /profundi[zc]|m[aá]s\s+detalle|seguir\s+viendo|ver\s+m[aá]s|el\s+porqu[eé]|el\s+c[aá]lculo|c[oó]mo\s+se\s+compone|desglos/i;
// _VAGUE_TOPIC_RE — la oferta propone seguir en EL MISMO tema pero con palabras que no describen ninguna acción
// ejecutable ("explorar condiciones/alternativas/opciones de negociación") — señal de CONTINUACIÓN igual de válida
// que _CONTINUATION_OFFER_RE de arriba, usada en dos lugares (extractOffer más abajo + isVagueOffer): UNA sola
// fuente para no arriesgar que las dos definiciones diverjan con el tiempo.
const _VAGUE_TOPIC_RE = /condici[oó]n|negociaci|alternativa|opci[oó]n(es)?|explor/i;
const _QUESTION_RE = /¿[^?]{4,220}\?/g;

// MECANISMO CON SIMULACIÓN DEDICADA — MAPEO GENERAL (owner 2026-08-01/02, mismo bug reproducido en vivo 4 veces
// en dominios distintos: carga comercial, luego capital/inventario — ver adi-oferta-vaga-aceptada.md). Repetir la
// MISMA tool de LECTURA (entityProfile/inventoryStatus/…) para "profundizá en X" da una respuesta casi idéntica —
// una lectura no calcula ningún desglose nuevo. Cuando SÍ existe una tool dedicada (simulate*, PLAN catalog en
// planPrompt.js) que calcula el efecto REAL de mover esa palanca, "profundizar en el mecanismo" tiene una
// respuesta genuina — no hace falta conformarse con reformular la misma lectura. MECHANISM_TABLE es la ÚNICA
// fuente: agregar un mecanismo nuevo es una fila acá, no un if/else nuevo en extractOffer.
//
// Solo entran mecanismos de auto-aceptación SEGURA — ningún parámetro que ADI tenga que INVENTAR:
//   · requiresEntity:true  → necesita una entidad puntual en foco (simulateCarga es por cliente; sin filtro
//     correría sobre TODA la cartera, no lo que "profundizar en ESTE cliente" pide).
//   · needsPct:true        → necesita un % con signo — SOLO se auto-rutea si la propia oferta YA lo nombra
//     explícito (extractSignedPct, scenarioIntent.js — la MISMA fuente que ya usa el resto del motor: sin
//     verbo direccional ni signo, es ambiguo y NUNCA se adivina). Sin ese número, no rutea — cae al fallback
//     genérico/oferta vaga, igual que cualquier mecanismo sin match.
//   · simulateGeneral (2 variables: precio Y volumen) queda FUERA a propósito — ese flujo ya tiene un mecanismo
//     dedicado más robusto (mem.pendingSimulation, #56 "simulate v2") que pregunta la variable que falta en vez
//     de intentar parsear dos números de la prosa de cierre.
const _CARGA_MECHANISM_RE = /carga\s+comercial/i;
const _CAPITAL_MECHANISM_RE = /capital\s+(inmovilizad|detenid)/i;
const _COSTO_MECHANISM_RE = /costo\s+medio/i;
const MECHANISM_TABLE = [
  { key: "carga", tool: "simulateCarga", re: _CARGA_MECHANISM_RE, requiresEntity: true,
    argsFor: (entidad) => ({ filters: { cliente: entidad } }) },
  { key: "capital", tool: "simulateCapital", re: _CAPITAL_MECHANISM_RE, requiresEntity: false,
    argsFor: (entidad, dimension) => (entidad ? { filters: { [dimension || "bodega"]: entidad } } : {}) },
  { key: "costo", tool: "simulateCosto", re: _COSTO_MECHANISM_RE, requiresEntity: false, needsPct: true,
    argsFor: (entidad, dimension, pct) => ({ pct, ...(entidad ? { filters: { [dimension || "sku"]: entidad } } : {}) }) },
];

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
  // MECANISMO YA AGOTADO (owner 2026-08-01, hallazgo en vivo de 3er orden — ver adi-oferta-vaga-aceptada.md): la
  // respuesta de ESTE turno YA corrió la simulación dedicada (la entidad aceptó la oferta anterior), y el narrador
  // vuelve a cerrar con la MISMA oferta — pero ninguna de estas simulaciones tiene un desglose más fino que dar
  // (composeSpecSimulateCarga/Capital/Costo: una frase/cifra agregada, nunca items nuevos por SKU/cuenta). Repetir
  // la tool una segunda vez no agrega nada — sería el MISMO loop que este archivo ya cerró una vez. `ranThisTurn`
  // es la señal determinística (no depende de qué palabras use el narrador esta vez): si la tool que YA respondió
  // este turno es una dedicada de MECHANISM_TABLE, ninguna rama de abajo vuelve a ofrecerla.
  const narrationStr = String(narration || "");
  const continuación = _CONTINUATION_OFFER_RE.test(texto) || _VAGUE_TOPIC_RE.test(texto);
  // mechanismBlocked (owner 2026-08-02, hallazgo de la propia auditoría general): el mecanismo SÍ está nombrado y
  // la oferta SÍ es de continuación, pero falta lo mínimo para correrlo sin adivinar (entidad puntual, o el % de
  // simulateCosto) — en ese caso NUNCA cae al "repetí la misma tool" genérico de abajo (eso reproduciría el MISMO
  // bug: repetir una lectura que no calcula nada nuevo), sigue de largo a PLAN normal, que con criterio real puede
  // decidir algo mejor que repetir a ciegas la tool del turno anterior.
  let tool = null, args = null, mechanismExhausted = false, mechanism = null, mechanismBlocked = null;
  for (const m of MECHANISM_TABLE) {
    if (!m.re.test(narrationStr)) continue;
    const ranThisTurn = Array.isArray(calls) && calls.some((c) => c && c.tool === m.tool);
    if (ranThisTurn) { mechanismExhausted = true; mechanism = m.key; break; }
    if (!continuación) continue;
    if (m.requiresEntity && !entidad) { mechanismBlocked = m.key; break; }
    if (m.needsPct) {
      const signed = extractSignedPct(texto);
      if (!signed) { mechanismBlocked = m.key; break; }   // sin número/dirección explícita, no se adivina
      tool = m.tool; args = m.argsFor(entidad, dimension, signed.delta_pct); mechanism = m.key;
    } else {
      tool = m.tool; args = m.argsFor(entidad, dimension); mechanism = m.key;
    }
    break;
  }
  if (!tool && !mechanismExhausted && !mechanismBlocked && Array.isArray(calls) && calls.length === 1 && calls[0] && _CONTINUATION_OFFER_RE.test(texto)) {
    tool = calls[0].tool;
    args = calls[0].args || {};
  }
  return { texto, entidad, dimension, modoOrigen: (plan && plan.mode) || null, tool, args, mechanismExhausted, mechanism, mechanismBlocked, turno: turno == null ? null : turno };
}

// ── ELÍPTICO DE ENTIDAD (owner 2026-08-03, defecto "herencia de modo/intención en turnos elípticos tipo 'Y Lider?'")
// — un turno CORTO tipo "¿Y Lider?"/"Y Sodimac?"/"¿Y en Jumbo?" (conjunción "y" + lo que razonablemente es un
// nombre propio, SIN verbo de seguimiento) no matchea ninguno de los backstops de modo existentes (_CLARIFY_RE,
// _SEGUIMIENTO_MARKER_RE+_SEGUIMIENTO_VERB_RE en answerViaOracle.js) — medido en vivo (~9 corridas de 2 turnos):
// la resolución de ENTIDAD/SCOPE nunca falla (el LLM lee el nombre propio directo del texto corto sin necesitar
// memoria), pero la clasificación de `mode` sí es inconsistente (cae a mode=default perdiendo la profundidad del
// turno anterior para la misma clase de pregunta). Red angosta por diseño (mismo principio que _CLARIFY_RE/
// _SEGUIMIENTO_MARKER_RE — nunca "adivina" un caso ambiguo, solo actúa en el patrón NÍTIDO): texto de ≤6 palabras
// que empieza con "y"/"¿y" (con preposición opcional) seguido de 1-3 tokens que empiezan con mayúscula y nada más
// hasta el final (un "?" opcional). Una frase con verbo después de "y" ("y qué hago con Lider") NUNCA matchea — el
// verbo en minúscula rompe el patrón "solo tokens capitalizados hasta el final de la oración".
export const ELLIPTIC_ENTITY_RE = /^\s*¿?\s*[Yy]\s+(?:en\s+|con\s+|de\s+|sobre\s+)?([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑÜáéíóúñü0-9'.-]*(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑÜáéíóúñü0-9'.-]*){0,2})\s*\??\s*$/;
export function matchEllipticEntity(text) {
  const t = String(text || "").trim();
  if (!t || t.split(/\s+/).length > 6) return null;
  const m = ELLIPTIC_ENTITY_RE.exec(t);
  return m ? m[1].trim() : null;
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
  // mode/intent/tool (owner 2026-08-03, fix "herencia de modo/intención en turnos elípticos") — ADITIVO, mismo
  // shape de siempre + 3 campos nuevos: qué mode/intent resolvió PLAN y qué tool corrió para ESTA entidad en el
  // turno que la estableció. renderInteractionMemory (persona.js) sigue leyendo SOLO `s.entidad` — este cambio por
  // sí solo no altera ningún comportamiento observable hasta que _coerceMode (answerViaOracle.js) los consume.
  const tool = (Array.isArray(calls) && calls[0] && calls[0].tool) || null;
  const mode = (plan && plan.mode) || null;
  const intent = (plan && plan.intent) || null;
  list.unshift({ entidad, dimension, turno: turno == null ? null : turno, mode, intent, tool });
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

/* ── LA SEGUNDA ACLARACIÓN NO EXISTE (owner 2026-08-12, medido en vivo) ─────────────────────────────────────────
 * CASO REAL, cuatro turnos: el owner pide el resultado después de gastos y ADI responde bien, con la cascada.
 *   — «no entiendo»                        → ADI: «¿qué parte no entendés?»          ← CORRECTO
 *   — «logística por qué tiene un 3.5%»    → ADI: «¿a qué parte de la logística…?»   ← EL DEFECTO
 *   — el owner explica                     → ADI REPITE la lectura entera
 * La segunda pregunta es la falla: el usuario YA respondió, y respondió NOMBRANDO una línea y su cifra. Volver a
 * preguntar no es prudencia, es no haber procesado la respuesta — y deja al usuario hablándole a una pared.
 *
 * `needsOrientacion` (arriba) NO cubre esto: dispara en clarifyStreak>=3 y es para «sigue perdido, cambiemos de
 * enfoque». Acá el usuario NO está perdido: fue específico. Son dos problemas distintos y este no tenía regla.
 *
 * POR QUÉ DETERMINÍSTICO Y NO DOCTRINA: es una conducta de PROCESO («no repreguntes lo ya respondido»), no de
 * criterio. La doctrina sola ya falló en formato de bloques y en la tabla obligatoria; una regla de proceso se
 * hace cumplir, no se pide. Red ANGOSTA a propósito (mismo patrón que _ORIENTACION_RE): dispara con señales
 * inequívocas de especificidad —una cifra, un %, o el nombre de una línea/métrica— y ante la duda NO bloquea,
 * porque una aclaración de más molesta pero una respuesta a la pregunta equivocada miente. */
const _ESPECIFICO_RE = /\d/;                                    // cualquier cifra: «3.5%», «los 4», «el 22»
const _NOMBRA_LINEA_RE = /\b(log[ií]stica|gastos?|costo|margen|contribuci[oó]n|venta|carga|rebate|inventario|capital|rotaci[oó]n|benchmark|resultado|precio|unidades|bodega|cliente|marca|familia|sku)\b/i;
/** ¿La respuesta del usuario a una aclaración YA es específica? Entonces la próxima NO puede ser otra aclaración. */
export function respuestaYaEsEspecifica(text) {
  const t = String(text || "").trim();
  if (!t || t.length < 3) return false;                          // «?», «ah» → sigue sin ser específico
  return _ESPECIFICO_RE.test(t) || _NOMBRA_LINEA_RE.test(t);
}
/** Regla de proceso: con una aclaración ya pedida y una respuesta específica, el turno DEBE responder. */
export function debeResponderSinRepreguntar(text, clarifyStreakPrev) {
  return (Number(clarifyStreakPrev) || 0) >= 1 && respuestaYaEsEspecifica(text);
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

// ── MECANISMO YA AGOTADO (owner 2026-08-01, hallazgo en vivo de 3er orden — el owner aceptó DOS veces seguidas la
// misma oferta "¿profundice en el desglose de la carga comercial por SKU?": la 1ra vez ejecutó simulateCarga
// (correcto, contenido nuevo); la 2da vez volvió a repetir la MISMA simulación, con la MISMA oferta al cierre —
// simulateCarga no tiene ningún desglose por SKU que dar (composeSpecSimulateCarga: con `cliente` seteado, no hay
// items individuales, es una sola frase). extractOffer arriba ya corta la reejecución (`ranCargaThisTurn`); esto es
// la respuesta HONESTA para ese "sí" — reconoce que la simulación ya corrió, aclara el límite real del dato, y
// ofrece las 2 rutas que SÍ existen (ver el detalle en Sentrix, o una simulación distinta) en vez de dejar
// `tool=null` caer a PLAN normal (que reproduciría el mismo loop por su cuenta).
export function isExhaustedMechanismOffer(offer) {
  return !!(offer && !offer.tool && offer.mechanismExhausted);
}
// generalizado (owner 2026-08-02, mismo hallazgo en el mecanismo de capital/inventario): el TEXTO cambia según
// `offer.mechanism` (seteado por extractOffer), la estructura (reconocé que ya corrió, aclará el límite, ofrecé
// las 2 rutas que sí existen) es la misma para cualquier simulación dedicada de un solo número agregado.
// _MECHANISM_LABEL — un nombre corto por mecanismo (mismas claves que MECHANISM_TABLE arriba), SOLO para armar el
// mensaje honesto de abajo. "carga" queda con la frase original (nombra la entidad, como siempre) por
// compatibilidad con callers viejos que no pasan `mechanism` (ver REGRESIÓN sección 20 de _vague_offer_gate.mjs).
const _MECHANISM_LABEL = { capital: "de liberar el capital detenido", costo: "de cambiar el costo medio" };
export function composeExhaustedMechanismAcceptance(offer) {
  const entidad = offer && offer.entidad;
  const label = offer && _MECHANISM_LABEL[offer.mechanism];
  if (label) {
    return `Esa simulación ${label} ya la corrí — es un cálculo agregado, no tengo un desglose más fino por SKU/bodega de ESE mecanismo. ¿Querés ver el detalle completo en Sentrix, o simulamos otra cosa (un cambio de precio o de volumen)?`;
  }
  const quien = entidad ? ` de ${entidad}` : "";
  return `Esa simulación de la carga comercial${quien} ya la corrí — no tengo un desglose más fino (por SKU) de ese mecanismo, el cálculo es a nivel de la cuenta completa. ¿Querés ver el detalle completo en Sentrix, o simulamos otra cosa (un cambio de precio o de volumen)?`;
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

/* ── POR QUÉ recentSubjects NO se deriva de conversationScope.history (Etapa 4, documentado a propósito, para que
 * el próximo agente no lo re-descubra) ─────────────────────────────────────────────────────────────────────────
 * recentSubjects (updateRecentSubjects arriba) es LRU real: se actualiza en CADA turno que resuelve alguna
 * entidad, reordenando/evitando duplicados, tope 3. conversationScope.history (conversationScope.js) SOLO archiva
 * el `current` saliente cuando plan.scope.level==='global' ("CAMBIO REAL DE TEMA — disparador único", diseño
 * DELIBERADO para que resolveConversationReference nunca resucite un tema abandonado con "estos/esos" — ver el
 * comentario de cabecera de ese archivo). En el caso común (el usuario pasa de Falabella a Sodimac SIN decir
 * "cambiemos de tema"), `current` se PISA en silencio y NUNCA entra a history — recentSubjects hoy SÍ retiene
 * ambos (Falabella y Sodimac), conversationScope.history NO retendría a Falabella en ese mismo escenario.
 * Derivar recentSubjects de conversationScope.history tal como existe hoy degradaría de verdad varios consumidores
 * reales (composeOrphanAcceptance, resolveSubjectRecall "primer tema"/"lo anterior", la recuperación elíptica de
 * simulación a través de un desvío de tema, buildOrientacionInstruction, persona.js) — el escenario EXACTO que
 * esta etapa debía evitar ("verificar exhaustivamente que ningún consumidor existente se rompe, byte a byte").
 *
 * Lo que Etapa 4 SÍ hizo (ver getRecentSubjects arriba + los sitios de escritura en answerViaOracle.js): mover
 * recentSubjects DENTRO del envelope de conversationScope como key hermana física (mem.conversationScope.
 * recentSubjects en vez de mem.recentSubjects top-level) — SIN cambiar ninguna semántica de retención
 * (updateRecentSubjects sigue siendo la MISMA función pura, con la MISMA lógica LRU; solo cambia DÓNDE vive el
 * array resultante, vía dual-write con el campo legacy). Esto consolida el estado en un único objeto persistido
 * físicamente y satisface PARCIALMENTE el pedido del owner ("una sola fuente de verdad") con riesgo cero de
 * regresión — la derivación SEMÁNTICA completa (recentSubjects calculado desde conversationScope.history, ya sin
 * ningún campo paralelo) requeriría PRIMERO rediseñar la política de archivado de conversationScope.history
 * (separar "archivo por pivote global" de "archivo por cambio de entidad") y re-verificar con el MISMO rigor
 * byte-exacto tanto los gates de recentSubjects/dialogueState como los de conversationScope/continuidad universal
 * (que hoy asumen la política actual, incluida la garantía deliberada de que "estos/esos" no resucite temas
 * viejos) — alcance mayor al de una consolidación de bajo riesgo. Queda como decisión EXPLÍCITA pendiente del
 * owner: si se quiere la derivación completa, es su propia etapa futura con gates dedicados, no algo para forzar
 * dentro de este cierre. */
