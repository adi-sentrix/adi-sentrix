/* === src/adi/oracle/narrationBlocks.js · CUMPLIMIENTO ESTRUCTURAL DE `pref` (owner 2026-07-29, residual) ===
 * "No quiero resolverlo con un guard duro que produzca fallback. Quiero cumplimiento estructural." La v1 de
 * responsePreference.js dependía 100% de que el narrador OBEDECIERA la doctrina en prosa libre — verificado en vivo:
 * "resumen ejecutivo, solo cifras" salió como tabla limpia PERO con una frase de acción colgada al final. La v2
 * (bloques + renderer) cerró ESE hueco — pero el owner cazó uno más profundo, con prueba: una etiqueta [[DATOS]]
 * correcta no garantiza que el CONTENIDO adentro sea del tipo correcto (el LLM puede escribir la recomendación
 * ENTERA dentro de un bloque bien marcado, sin usar [[ACCION]] en absoluto — el renderer nunca lo vería como algo
 * que descartar). "Para que 'no puede pasar' sea literalmente cierta":
 *   - data_only / results_only: GARANTÍA POR CONSTRUCCIÓN, SIN EXCEPCIÓN. answerViaOracle.js NUNCA invoca al
 *     narrador libre para estos dos alcances — cero superficie lingüística, compone SIEMPRE desde la boleta
 *     (composeFromLedger), y si la boleta viene vacía, composeNoDataMessage() cierra el último escape que existía
 *     (owner, 3er residual: "nunca debe volver al narrador libre — si falta evidencia, responde determinísticamente
 *     que no existe información autorizada suficiente"). No hay bloque que parsear ni contenido que validar porque
 *     no hay prosa libre en absoluto, en NINGÚN caso.
 *   - action_only: el único alcance que SIGUE narrando libre (la recomendación es juicio, no solo datos — un
 *     composer determinístico no puede razonar el mecanismo). Doble candado: (1) el renderer de bloques descarta
 *     cualquier bloque que no sea [[ACCION]] (v2, sin cambios); (2) hasForbiddenContent() valida el CONTENIDO
 *     mismo del bloque permitido — si coló lenguaje de causa/interpretación o de siguiente-paso, el intento se
 *     descarta ENTERO (nunca se repara quirúrgicamente) y se reintenta; agotados los intentos, composeFromLedger.
 */
export const BLOCK_KEYS = ["datos", "interpretacion", "accion", "siguiente_paso"];

// KEEP_BLOCKS[contentScope] → qué bloques sobreviven el render (siguen siendo pure functions testeables solas,
// aunque en la práctica solo action_only las ejercita hoy — data_only/results_only ya no llegan acá).
export const KEEP_BLOCKS = {
  full: ["datos", "interpretacion", "accion", "siguiente_paso"],
  data_only: ["datos"],
  results_only: ["datos"],
  action_only: ["accion"],
};
export const MANDATORY_BLOCK = { full: null, data_only: "datos", results_only: "datos", action_only: "accion" };

const _MARK_RE = /\[\[(DATOS|INTERPRETACION|ACCION|SIGUIENTE_PASO)\]\]/g;
const _MARK_STRIP_RE = /\[\[(?:DATOS|INTERPRETACION|ACCION|SIGUIENTE_PASO)\]\]\s*/g;

// stripAllMarks(text) → saca CUALQUIER marca [[...]] del texto VISIBLE (owner 2026-07-31, hallazgo en vivo,
// certificación integral pre-#57): bajo contentScope="full" el narrador NUNCA recibe instruccion_formato (esa
// instrucción está gateada a alcance≠"full", ver blockInstructionFor en responsePreference.js) — pero igual emitió
// "[[ACCION]] Renegociá primero con Falabella..." en un resumen ejecutivo normal, probablemente por aprender el
// patrón de marcado de la MISMA doctrina que se lo prohíbe para este alcance (el LLM ve el token igual, aunque la
// condición diga que no aplica). Bajo full nunca se llama a parseBlocks/renderFromBlocks (eso SOLO corre para
// action_only) así que sin este strip la marca cruda llegaba al usuario tal cual — reproducido, no hipotético.
// Reemplaza a stripOfferMarkers (dialogueState.js, retirada): mismo strip, generalizado a los 4 tokens, no solo
// SIGUIENTE_PASO — evita mantener 2 funciones casi idénticas para lo que en la práctica es el MISMO riesgo.
export function stripAllMarks(text) {
  return String(text || "").replace(_MARK_STRIP_RE, "").trim();
}

// ── truncateToBriefBudget (owner 2026-07-31, certificación integral, riesgo residual #1: "detailLevel=brief no
// muestra compresión medible") ── contentScope tiene enforcement DURO (los bloques [[...]] de arriba); detailLevel
// nunca lo tuvo — era SOLO doctrina de prosa ("respondé más corto que tu forma habitual"), y medido en vivo (2
// turnos consecutivos con brief+persist activo) no mostró NINGUNA reducción real frente al modo estándar. Esto no
// es un ajuste de prompt: es un TOPE ESTRUCTURAL sobre el TEXTO FINAL, igual de duro que el de contentScope, solo
// que en el eje de LARGO en vez de CATEGORÍA de contenido — el resultado NO PUEDE exceder el presupuesto, sin
// importar qué haya escrito el narrador. Corta en el ÚLTIMO límite de oración (.!?) que entre en el presupuesto —
// nunca a mitad de oración (evita dejar una cifra o un nombre colgando sin cierre gramatical). BRIEF_WORD_CAP es
// generoso para 2-3 oraciones + un cierre corto — "breve" no es "telegráfico", solo notablemente más corto que el
// estándar (que en vivo rondaba 120-220 palabras).
export const BRIEF_WORD_CAP = 90;
export function truncateToBriefBudget(text, maxWords = BRIEF_WORD_CAP) {
  const s = String(text || "").trim();
  if (!s) return s;
  const words = s.split(/\s+/);
  if (words.length <= maxWords) return s;   // ya cumple — no toca nada, cero costo en el caso común
  let cut = null;
  for (const m of s.matchAll(/[.!?](?=\s|$)/g)) {
    const upTo = s.slice(0, m.index + 1);
    if (upTo.split(/\s+/).length <= maxWords) cut = upTo;
    else break;
  }
  if (cut && cut.trim().length > 20) return cut.trim();   // al menos una oración completa entró — gramaticalmente sano
  // ni la PRIMERA oración entra en el presupuesto (caso raro, oración inicial larga) → corte duro por palabra,
  // con "…" visual para que quede claro que es un recorte, no el cierre natural del narrador.
  return `${words.slice(0, maxWords).join(" ").replace(/[,;:]+$/, "")}…`;
}

// parseBlocks(text) → { datos?, interpretacion?, accion?, siguiente_paso? } | null (null = el narrador NO usó el
// formato de bloques — falla estructural, el caller reintenta o repara). Cada bloque corre hasta el PRÓXIMO marcador
// o el fin del texto — no hace falta cierre explícito, más fácil de producir consistentemente para el LLM.
export function parseBlocks(text) {
  const s = String(text == null ? "" : text);
  const marks = [...s.matchAll(_MARK_RE)];
  if (!marks.length) return null;
  const out = {};
  for (let i = 0; i < marks.length; i++) {
    const key = marks[i][1].toLowerCase();
    const start = marks[i].index + marks[i][0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : s.length;
    const chunk = s.slice(start, end).trim();
    if (!chunk) continue;
    out[key] = out[key] ? `${out[key]}\n\n${chunk}` : chunk;   // el LLM a veces repite un bloque partido — se concatena
  }
  return Object.keys(out).length ? out : null;
}

// renderFromBlocks(parsed, contentScope) → SOLO los bloques que ese alcance permite, tags fuera. Sigue siendo
// necesario para action_only (KEEP_BLOCKS.action_only descarta [[DATOS]]/[[INTERPRETACION]]/[[SIGUIENTE_PASO]] por
// construcción) — pero YA NO es, por sí sola, la garantía completa: ver hasForbiddenContent abajo.
export function renderFromBlocks(parsed, contentScope) {
  const keep = KEEP_BLOCKS[contentScope] || KEEP_BLOCKS.full;
  return keep.map((k) => parsed && parsed[k]).filter(Boolean).join("\n\n").trim();
}

// ── CONTAMINACIÓN INTERNA DEL BLOQUE (owner 2026-07-29, 2do residual: "[[DATOS]] Ventas: $100M. Te recomiendo
// renegociar con Falabella." — la etiqueta es correcta, el CONTENIDO no) ── SOLO aplica a action_only: es el
// ÚNICO alcance que sigue narrando libre después de este fix (data_only/results_only nunca llegan acá, ver
// answerViaOracle.js). Detecta lenguaje de OTRA categoría colado dentro del bloque permitido — si lo encuentra,
// el caller DESCARTA el intento entero (no intenta stripear la oración ofensora: un texto que ya mezcló
// categorías es más barato de re-generar que de editar a mano sin dejarlo gramaticalmente roto).
const _CAUSAL_LEAK_RE = /\b(esto se debe a|esto ocurre porque|esto sucede porque|la causa (?:de esto )?es|se debe a que|el motivo es|esto explica por qu[eé]|esto indica que|esto sugiere que|esto refleja que)\b/i;
const _NEXT_STEP_LEAK_RE = /¿(?:quer[eé]s|te gustar[ií]a|avanzamos|seguimos|profundizamos)\b|si quer[eé]s,? puedo\b/i;
export function hasForbiddenContent(text, contentScope) {
  const s = String(text || "");
  if (contentScope === "action_only") return _CAUSAL_LEAK_RE.test(s) || _NEXT_STEP_LEAK_RE.test(s);
  return false;   // data_only/results_only: sin narración libre, sin contenido que validar (garantía por construcción)
}

// ── composeFromLedger(figs, contentScope) ── SIN LLM, sin invención: arma la respuesta DIRECTO de las cifras ya
// autorizadas. Para data_only/results_only, YA NO es una reparación de último recurso — es la ÚNICA vía (ver
// answerViaOracle.js). Para action_only, sigue siendo la reparación tras 3 intentos fallidos.
const _NON_ENTITY_SUFFIX_RE = /^(subtotal|total)$/i;
// _isEntityAttributed: el ÚLTIMO segmento del label (tras el separador "·") es un nombre real, no "subtotal"/
// "total" — evita que la "prioridad" de action_only termine siendo un total agregado (bug real cazado en este
// mismo pase: list[0] a veces ES "Contribución no capturada · subtotal", no una entidad accionable).
function _isEntityAttributed(fig) {
  const segs = String(fig.label || "").split("·").map((s) => s.trim());
  if (segs.length < 2) return false;
  const last = segs[segs.length - 1];
  return last.length >= 3 && !_NON_ENTITY_SUFFIX_RE.test(last);
}
function _bestByMagnitude(figs) {
  let best = figs[0], bestAbs = typeof best.raw === "number" && isFinite(best.raw) ? Math.abs(best.raw) : -Infinity;
  for (const f of figs) {
    const abs = typeof f.raw === "number" && isFinite(f.raw) ? Math.abs(f.raw) : -Infinity;
    if (abs > bestAbs) { best = f; bestAbs = abs; }
  }
  return best;
}

// ── SUPUESTO DE SIMULACIÓN BAJO data_only/results_only (owner 2026-08-04, GAP 3, consolidación Parte 2) ──
// composeFromLedger armaba la tabla SOLO de fig.label/fig.value — fig.context (donde vive el texto del supuesto,
// ej. "supuesto: costo medio -3% sobre los sku bajo benchmark (dato real)", ver composeSpecSimulateCosto/
// composeSpecSimulate/composeSpecSimulateCarga/composeSpecSimulateCapital en specRetrieval.js — TODAS estampan
// "supuesto" al inicio de fig.context) se descartaba por completo. Bajo data_only/results_only este composer es el
// ÚNICO texto que llega al usuario (garantía por construcción, ver el comentario de cabecera del archivo) — sin
// este fix, una simulación bajo results_only mostraba el resultado numérico SIN decir sobre qué supuesto se
// calculó, violando DIRECTO el requisito del owner ("en una simulación NUNCA ocultes el supuesto usado"). Declarar
// el supuesto es METADATO indispensable (qué %/acción se asumió), no análisis ni recomendación — no rompe "sin
// análisis". Toma el PRIMER fig con un context de supuesto (todas las filas de una misma simulación comparten el
// mismo _ctx en origen, ver specRetrieval.js) — nunca concatena varios, evita ruido si hubiera figs de más de una
// simulación mezcladas en el mismo turno (caso hoy no ejercitado, pero la función queda correcta igual).
const _SUPUESTO_CTX_RE = /supuesto/i;
function _findSupuestoContext(list) {
  for (const f of list) {
    if (f && typeof f.context === "string" && _SUPUESTO_CTX_RE.test(f.context)) return f.context.trim();
  }
  return null;
}
function _formatSupuestoLine(context) {
  const cleaned = context.replace(/^supuesto\s*:?\s*/i, "");
  return `Supuesto: ${cleaned}.`;
}

export function composeFromLedger(figs, contentScope) {
  const list = Array.isArray(figs) ? figs.filter((f) => f && typeof f.label === "string" && f.value != null) : [];
  if (!list.length) return null;
  if (contentScope === "action_only") {
    const entityFigs = list.filter(_isEntityAttributed);
    const top = _bestByMagnitude(entityFigs.length ? entityFigs : list);
    return `La prioridad: ${top.label} (${top.value}).`;
  }
  const rows = list.slice(0, 12).map((f) => `| ${f.label} | ${f.value} |`);
  let table = `| Concepto | Valor |\n|---|---|\n${rows.join("\n")}`;
  if (contentScope === "data_only" || contentScope === "results_only") {
    const supuesto = _findSupuestoContext(list);
    if (supuesto) table += `\n\n${_formatSupuestoLine(supuesto)}`;
  }
  return table;
}

// ── composeFromTextualEvidence(results) ── LA EVIDENCIA AUTORIZADA QUE NO ES UNA CIFRA (owner 2026-08-11) ───────
// EL DEFECTO QUE CIERRA (medido): tras usar "contribución no capturada" cuatro veces, ante "No entendí lo de
// contribución no capturada" ADI contestó "No tengo información autorizada suficiente para responder eso con el
// alcance pedido" — MIENTRAS tenía la definición en la mano, resuelta y sellada. El plan era correcto
// (intent="define", defineConcept), la tool respondió con coverage.supported=true… y su evidencia es TEXTO, no
// cifras. Bajo data_only/results_only el único compositor que existía sabía imprimir BOLETA (composeFromLedger);
// con la boleta vacía caía a composeNoDataMessage y el motor declaraba una ausencia que no era cierta.
//
// LA REGLA GENERAL, y por qué no es un parche a ese término: el alcance restringido acota los turnos que responden
// un DATO — le dice al motor cuánta interpretación puede acompañar a una cifra. Una DEFINICIÓN no es un turno de
// dato: no tiene universo, no tiene período y no hay nada que interpretar de más. Cuando la evidencia autorizada
// del turno es textual, se dice tal cual viene del glosario, y el alcance se cumple igual —de hecho mejor: cero
// prosa libre, cero superficie lingüística, exactamente la garantía por construcción que esta rama existe para
// sostener. Vale para los 35+ conceptos del glosario, para cualquier redacción ("qué es X", "no entiendo X",
// "explicame X en simple") y para los DOS alcances restringidos.
//
// EL LÍMITE, angosto a propósito: exige (a) que la tool haya declarado `supported: true` —evidencia AUTORIZADA, no
// una tool que declinó—, (b) que NO haya aportado ninguna cifra a la boleta del turno, y (c) que sus `facts`
// declaren ser una definición (`es_definicion`) o traigan el campo `definicion`. Sin (c), cualquier turno de datos
// con boleta vacía dejaría de dar el mensaje honesto y empezaría a narrar algo — que es justo lo que el 3er
// residual cerró. VERBATIM: se imprime lo que la tool selló, sin reescribir ni resumir (una definición curada es
// el antídoto al "inventa algo": cero deriva). Devuelve null cuando no hay evidencia textual — el caller sigue con
// composeNoDataMessage, que sigue siendo la última red honesta del motor.
const _MAX_DEFINICIONES = 2;   // un turno pregunta por un concepto, a veces por dos; más que eso es un volcado
export function composeFromTextualEvidence(results) {
  const list = Array.isArray(results) ? results : [];
  const textuales = list.filter((r) => {
    if (!r || !r.coverage || r.coverage.supported !== true) return false;
    if (Array.isArray(r.boleta) && r.boleta.length) return false;
    const f = r.facts;
    if (!f || typeof f !== "object") return false;
    return f.es_definicion === true || typeof f.definicion === "string";
  });
  if (!textuales.length) return null;
  const bloques = [];
  for (const r of textuales.slice(0, _MAX_DEFINICIONES)) {
    const f = r.facts;
    const def = typeof f.definicion === "string" ? f.definicion.trim() : "";
    if (!def) continue;
    const concepto = typeof f.concepto === "string" ? f.concepto.trim() : "";
    // el concepto encabeza (el usuario preguntó por un nombre: la respuesta empieza nombrándolo) y la distinción,
    // cuando la hay, va aparte — es parte de la definición curada, no una interpretación agregada acá.
    bloques.push(concepto ? `${concepto.charAt(0).toUpperCase()}${concepto.slice(1)}: ${def}` : def);
    if (typeof f.distingue === "string" && f.distingue.trim()) bloques.push(f.distingue.trim());
  }
  return bloques.length ? bloques.join("\n\n") : null;
}

// ── composeNoDataMessage(results) ── owner 2026-07-29, 3er residual: "bajo data_only o results_only, NUNCA debe
// volver al narrador libre — si falta evidencia, responde determinísticamente." Cierra el ÚLTIMO escape: hasta acá,
// una boleta vacía (composeFromLedger devuelve null) todavía cedía al narrador como red — el único hueco que
// quedaba para estos dos alcances. Esta función NUNCA devuelve null: siempre hay AL MENOS el mensaje genérico, así
// que el caller (answerViaOracle.js) ya no necesita ese escape en absoluto.
//   - si algún tool YA declinó con una razón real (coverage.reason — la MISMA razón que citaría el narrador libre
//     por la doctrina HONESTIDAD de narratePromptC.js), la cita literal — nunca inventa una razón distinta.
//   - si no hay ninguna razón específica (ej. intent=ack, calls vacío), el mensaje genérico igual es honesto: no
//     hay información autorizada, punto.
//   - en espíritu de "solicita el dato faltante" (owner): cierra pidiendo la precisión que falta, en vez de un
//     "no" seco — SIN construir el mecanismo formal `request_clarification` de intent en el PLAN, que sigue
//     guardado para el proyecto simulate v2 (ver memoria adi-simulate-v2-motor-escenarios) — acá es solo la frase
//     de cierre de un mensaje ya determinístico, no un nuevo intent ni un nuevo turno de conversación.
export function composeNoDataMessage(results) {
  const list = Array.isArray(results) ? results : [];
  const declined = list.find((r) => r && r.coverage && r.coverage.supported === false && typeof r.coverage.reason === "string" && r.coverage.reason.trim());
  if (declined) return `No tengo información autorizada suficiente: ${declined.coverage.reason}. Dime el nombre exacto o el dato que buscas y lo reviso.`;
  return "No tengo información autorizada suficiente para responder eso con el alcance pedido. Cuéntame qué dato específico necesitas y lo busco.";
}
