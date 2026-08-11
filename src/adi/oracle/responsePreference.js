/* === src/adi/oracle/responsePreference.js · ARQUITECTURA C · PREFERENCIA DE RESPUESTA (eje DISTINTO de `mode`) ===
 * owner 2026-07-29: "el modo indica QUÉ necesita el usuario (dato, diagnóstico, decisión, simulación); la
 * preferencia indica CÓMO quiere recibirlo." `mode` (conversationalContract.js) es LA FUENTE de la FORMA/estructura
 * de la respuesta (el arco de 3 movimientos, el dispatch de 7 modos). `pref` es ORTOGONAL: comprime CUÁNTO de esa
 * forma se termina narrando, sin cambiar qué tools se llamaron, qué modo se eligió, ni el alcance de los datos.
 * NO otra colección de regex por ruta — UN solo contrato que planPrompt.js (detección, Pasada 1) y narratePromptC.js
 * (doctrina de narración, Pasada 2) IMPORTAN de acá, exactamente como ya hacen con conversationalContract.js. DATO
 * versionado, no un prompt suelto — testeable sin LLM real, portable a cualquier provider (ver providerAdapter.js).
 */
export const RESPONSE_PREF_VERSION = "adi-response-preference@1.0.0";

export const DETAIL_LEVELS = ["standard", "brief"];
export const CONTENT_SCOPES = ["full", "data_only", "action_only", "results_only"];
export const DEFAULT_PREF = Object.freeze({ detailLevel: "standard", contentScope: "full" });

/* ══ LOS DOS EJES DE UN PEDIDO DE FORMA, Y POR QUÉ NO SON UNO SOLO (defecto D8, 2026-08-11) ═══════════════════════
 * LA REGLA GENERAL, y vale para la clase entera: **una restricción NEGATIVA nunca fija el ALCANCE del contenido —
 * sólo reduce la FORMA. El alcance lo fija ÚNICAMENTE lo que el usuario nombra en POSITIVO como la cosa que quiere
 * recibir.** "Dame el dato" nombra el dato: eso es alcance (`contentScope="data_only"`). "Sin explicación", "en una
 * línea", "solo la conclusión", "hablame directo" NO nombran ninguna cosa: dicen CUÁNTA prosa quiere, que es el eje
 * `detailLevel`. Los dos ejes existían desde el principio; lo que faltaba era la frontera entre ellos.
 *
 * QUÉ ROMPÍA MEZCLARLOS. `data_only` significa —por construcción, ver narrationBlocks.js y answerViaOracle.js— "el
 * narrador NO se invoca: la respuesta se compone desde la boleta, en tabla". Así que todo pedido de MENOS que caía
 * en ese alcance terminaba devolviendo MÁS: doce filas de tabla y ni una frase. Medido: «Ahora solo la conclusión,
 * nada más» y «Hablame directo y sin rodeos» devolvieron los dos una tabla completa, con el narrador invocado CERO
 * veces. Pedir menos producía la respuesta más larga y más impersonal que el motor sabe dar.
 *
 * ESTE MÓDULO ES EL DUEÑO DEL VOCABULARIO, no de la decisión: `pideReduccionDeForma` se declara acá —junto al eje
 * `detailLevel` que le corresponde— y progressiveDisclosure.js la CONSULTA para resolver la forma del turno, igual
 * que ya hace con `pref` (ver su nota "acá se la CONSULTA, nunca se la reimplementa"). Una sola definición: la
 * doctrina de PLAN de más abajo se COMPONE de estos mismos ejemplos, así que el prompt y el detector determinístico
 * no pueden divergir nunca.
 */

// ── REDUCCIÓN DE FORMA · "menos prosa", no "el dato pelado" ────────────────────────────────────────────────────
// Tres familias, y las tres dicen lo mismo desde ángulos distintos: un PRESUPUESTO de largo ("en una línea"), un
// RECORTE a la conclusión ("solo la conclusión") o una corrección de REGISTRO ("al grano", "sin rodeos"). Ninguna
// nombra un dato: por eso ninguna puede fijar el alcance.
// OJO con "en una línea": «una línea DE producto/negocio/crédito» no es un presupuesto de largo — la lookahead
// negativa de "de" es lo único que separa el pedido de forma del sustantivo del negocio.
const _REDUCCION_LARGO = /\ben\s+(?:una|un|1|dos|2|tres|3)\s+(?:l[ií]neas?|frases?|oraciones?|renglones?|palabras?)\b(?!\s+de\b)/i;
// OJO CON EL `\b` INICIAL ANTE VOCAL ACENTUADA — es la misma trampa ASCII que progressiveDisclosure.js documenta en
// `_TEMPORAL` y `_DESGLOSE`, y acá estaba viva: `\b[uú]nicamente` NUNCA matcheaba la forma con tilde («únicamente la
// conclusión»), porque "ú" no es un carácter de palabra para `\b` y no hay frontera que abrir delante. Sin el `\b`
// las dos formas entran, y no se abre ningún falso positivo: no existe palabra del español que termine en "unicamente".
const _REDUCCION_CONCLUSION = /\bs[oó]lo\s+(?:la\s+|el\s+)?(?:conclusi[oó]n|titular|veredicto|resumen\s+de\s+una\s+l[ií]nea)\b|[uú]nicamente\s+(?:la\s+)?conclusi[oó]n\b|\bs[oó]lo\s+lo\s+(?:esencial|importante)\b|\bqu[eé]date\s+con\s+lo\s+esencial\b/i;
// REGISTRO: las mismas frases que ya fijan detailLevel="brief" con persist=true (ver el bullet de doctrina). Se
// listan acá, y no en answerViaOracle.js, porque el REGISTRO es un eje de ESTE módulo. PENDIENTE de integración: la
// red determinística de allá (`_PREF_DIRECTO_RE`) hoy declara su propia copia — cuando la consuma de acá dejará de
// haber dos listas para una sola clase.
const _REDUCCION_REGISTRO = /\bal\s+grano\b|\bsin\s+rodeos\b|\bsin\s+vueltas\b|\bsin\s+pre[aá]mbulos?\b|\bsin\s+introducci[oó]n\b|\bh[aá]bl[ae]me\s+(?:m[aá]s\s+)?directo\b|\bs[eé]\s+(?:m[aá]s\s+)?directo\b|\b(?:d[ií]|dec[ií])melo\s+(?:corto|directo)\b|\bcorto\s+y\s+(?:claro|directo|concreto)\b|\bdirecto\s+(?:al|a\s+la)\s+(?:grano|punto|conclusi[oó]n)\b/i;
const _REDUCCION = [_REDUCCION_LARGO, _REDUCCION_CONCLUSION, _REDUCCION_REGISTRO];

// LOS EJEMPLOS CANÓNICOS DE LA CLASE, en UN solo lugar: el detector de acá abajo los reconoce y la doctrina de PLAN
// los cita interpolando ESTA lista. Así el prompt no puede quedar hablando de una clase que el motor no detecta (ni
// al revés) por un olvido de edición — que es exactamente cómo nació este defecto: la doctrina mandaba "sin
// explicación"/"nada más" a data_only y nadie más en el módulo sabía que esas frases eran otra cosa.
export const REDUCCION_EJEMPLOS = Object.freeze([
  "en una línea", "en dos renglones", "solo la conclusión", "solo lo esencial", "al grano", "sin rodeos",
]);

// pideReduccionDeForma(text) → true si el turno pide MENOS RESPUESTA (largo, conclusión o registro directo). Es un
// pedido sobre la FORMA: nunca sobre qué datos traer. Puro, sin estado — gate-testable sin LLM. Es el vocabulario
// del eje `detailLevel="brief"`: las TRES familias bajan el nivel de detalle.
export function pideReduccionDeForma(text) {
  const t = String(text || "");
  return _REDUCCION.some((re) => re.test(t));
}

/* ── LAS TRES FAMILIAS NO PESAN LO MISMO SOBRE LA FORMA DE PRESENTACIÓN (revisión adversarial 2026-08-11) ────────
 * `detailLevel` las trata igual —las tres piden menos— pero la POLÍTICA DE TABLA no puede: un PRESUPUESTO de largo
 * ("en una línea", "en dos renglones") y un RECORTE a la conclusión ("solo la conclusión") son literalmente
 * incompatibles con doce filas, así que prohíben tabular. La corrección de REGISTRO ("al grano", "sin rodeos",
 * "hablame directo") habla del TONO y no dice absolutamente nada sobre tabular: «andá al grano: dame el top 10 de
 * clientes» y «sin rodeos, compará Falabella y Lider» eran `auto` —el narrador decidía la forma— y hacerlos
 * `forbidden` le niega al usuario una forma que nadie prohibió. Doctrina de la casa: antes falso negativo que falso
 * positivo. Por eso progressiveDisclosure.js consulta ESTA función, no la de arriba.
 */
export function pideReduccionDeLargo(text) {
  const t = String(text || "");
  return _REDUCCION_LARGO.test(t) || _REDUCCION_CONCLUSION.test(t);
}
// pideCorreccionDeRegistro(text) → la tercera familia, aislada: baja `detailLevel` y NUNCA toca la forma ni el
// alcance. Se exporta para que el límite se pueda verificar desde un gate en vez de quedar sólo en este comentario.
export function pideCorreccionDeRegistro(text) {
  return _REDUCCION_REGISTRO.test(String(text || ""));
}

// pideDatoPelado(text) → true si el turno nombra EN POSITIVO la cosa que quiere recibir (el dato, la cifra, el
// número, la tabla, el resultado). Es lo ÚNICO que puede fijar `contentScope="data_only"`. Se declara junto a su
// contraparte para que la frontera entre los dos ejes se lea de un vistazo — y para que un pedido que dice las DOS
// cosas ("solo el dato, sin explicación") se resuelva por el positivo, que es el que nombra el alcance.
const _DATO_PELADO = /\bs[oó]lo\s+(?:el\s+|la\s+|los\s+|las\s+)?(?:dato|datos|n[uú]mero|n[uú]meros|cifras?|kpis?|tabla|resultados?)\b|\bs[oó]lo\s+dame\b|\bdame\s+s[oó]lo\b|\b(?:dame|dime|decime|mu[eé]strame|quiero|necesito)\s+[uú]nicamente\b|\bdirecto\s+al\s+(?:n[uú]mero|dato|resultado|cifra)\b/i;
export function pideDatoPelado(text) {
  return _DATO_PELADO.test(String(text || ""));
}

// isDefaultPref(pref) → true si NO hay nada que comunicarle al narrador (turno normal, sin pedido especial). Se usa
// para decidir si "preferencia_respuesta" viaja en el payload de la Pasada 2 — igual que nivel_aclaracion, solo
// aparece cuando aporta algo (mismo principio de payload mínimo que ya usa narratePromptC.js).
export function isDefaultPref(pref) {
  if (!pref) return true;
  const scope = pref.contentScope || "full";
  const detail = pref.detailLevel || "standard";
  return scope === "full" && detail === "standard";
}

/* ── UNA FRASE, UN ALCANCE (revisión adversarial 2026-08-11) ────────────────────────────────────────────────────
 * "al grano" y "sin rodeos" estaban citadas a la vez en el bullet de REDUCCIÓN (detailLevel="brief", alcance
 * VACÍO) y en el de contentScope="action_only". O sea: el prompt le pedía al LLM del PLAN las dos cosas contrarias
 * sobre la misma frase — la segunda-verdad que este mismo módulo dice estar eliminando. Se resolvió a favor de la
 * REDUCCIÓN (es una corrección de registro: no nombra ninguna cosa pedida, así que no puede fijar un alcance) y se
 * BORRÓ la cita del bullet de alcance.
 * Y EL BULLET DEJÓ DE DECIR «SIEMPRE Y SÓLO ACÁ», porque era FALSO (revisión adversarial 2, 2026-08-11): "al grano"
 * y "sin rodeos" siguen —bien— citadas también en el bullet de REGISTRO (detailLevel="brief" Y persist=true). Las
 * dos ramas coinciden en `detailLevel` y ninguna fija alcance, así que la doctrina NO se contradice; lo que estaba
 * mal era la palabra «sólo». El invariante que de verdad se cumple es sobre el ALCANCE —ningún bullet que cite una
 * de estas frases fija `contentScope`—, y así se enuncia ahora y así se verifica en el gate.
 * El invariante no se enuncia otra vez en el prompt: se verifica en código
 * —_forma_pedida_negativa_gate.mjs pasa cada frase entrecomillada de los bullets de contentScope por el DETECTOR y
 * se pone rojo si alguna es una reducción—, que es enforcement de verdad y además no cuesta tokens.
 * OJO AL PRESUPUESTO: `_reparacion_contextual_gate.mjs` topea el crecimiento del system de PLAN (1.700 car / 660
 * tokens) y hoy queda del orden de decenas de caracteres de aire. Toda edición de esta doctrina se paga en TODOS
 * los turnos: si hay que decir algo nuevo, hay que sacar algo viejo.
 */
// buildPrefDoctrine() → bloque para el system de la Pasada 1 (planPrompt.js): CUÁNDO detectar cada valor. La
// detección es POR COMPRENSIÓN (mecanismo PRINCIPAL) — la coerción determinística en answerViaOracle.js es
// SOLO una red para las frases más inequívocas, nunca el mecanismo del que depende la feature (owner: "usa
// coerción determinística únicamente como red para instrucciones explícitas, no como mecanismo principal").
export function buildPrefDoctrine() {
  return `· PREFERENCIA DE RESPUESTA (eje "pref", DISTINTO de "mode" — mode decide QUÉ necesita el usuario, pref decide CÓMO recibirlo; nunca cambia qué tools pedís ni el alcance de los datos):
  - Detectala SOLO si el usuario la pidió en ESTE turno. Si no dijo nada al respecto, dejá "pref" vacío/omitido — NO repitas ni inventes la preferencia de un turno anterior: eso lo administra el motor, no vos.
  - REGLA QUE MANDA SOBRE TODO LO DE ABAJO: una restricción NEGATIVA nunca fija "contentScope" — sólo baja "detailLevel". El alcance lo fija ÚNICAMENTE lo que el turno nombra EN POSITIVO como la cosa pedida. "data_only" hace que el motor arme la respuesta EN TABLA sin invocarte: marcarlo ante un pedido de MENOS devuelve doce filas y ni una frase.
  - contentScope="data_only": "solo el dato/la cifra/el número", "sin análisis/interpretación", "solo cifras/KPIs" → quiere el dato sin la lectura. Cualquier paráfrasis cuenta ("solo dame el dato", "dime únicamente las ventas", "directo al número", "solo el resultado", "solo la tabla"), pero el requisito es que la frase NOMBRE la cosa pedida: "sin explicación"/"nada más"/"y punto"/"no me des contexto" SOLOS no alcanzan — son REDUCCIÓN; suman data_only sólo si el turno además nombra el dato.
  - detailLevel="brief" con contentScope VACÍO · REDUCCIÓN: presupuesto de largo, recorte a la conclusión o corrección de registro. Piden MENOS PROSA, no otro contenido — y una conclusión en una línea se escribe en prosa, nunca en tabla — y ninguna fija contentScope: ${REDUCCION_EJEMPLOS.map((e) => `"${e}"`).join(", ")}.
  - contentScope="action_only": "solo la acción", "sin el diagnóstico", "directo a qué hacer" → ya tiene el contexto, quiere solo la decisión.
  - contentScope="results_only": en una simulación, "solo los resultados", "sin recomendación", "no me recomiendes" → quiere el efecto del supuesto, no el consejo. Fuera de una simulación (mode≠"simulacion") eso es data_only: ese eje sólo existe cuando hay un supuesto simulado del que separar el consejo.
  - detailLevel="brief": "responde breve/corto", "sé breve", "resumime" → más corto que tu forma habitual, en cualquier alcance. Es sobre ESTE pedido puntual → persist con la regla general de abajo (default false).
  - detailLevel="brief" Y persist=true, SIEMPRE JUNTOS EN EL MISMO "pref": "háblame más directo", "sé más directo", "sin rodeos", "al grano", "menos detalle". Es una corrección de REGISTRO general — como "trátame de usted" —, no un pedido sobre este contenido, así que VA con persist=true por defecto; nunca marques uno sin el otro. Y NUNCA le agregues contentScope: el registro habla del LARGO, y su persist proyecta sólo detailLevel — un alcance pegado ahí secuestra toda la sesión.
  - detailLevel="standard" Y persist=true, SIEMPRE JUNTOS (misma lógica, dirección opuesta): "explícamelo con más detalle", "sé más explicativo" → vuelve al nivel normal sin resetear ningún otro alcance.
  - Pedido de VOLVER a lo normal ("dame el análisis completo de nuevo", "como antes", "volvé a lo normal", "ya no hace falta que sea breve") → contentScope="full", detailLevel="standard", persist=true SIEMPRE: cancela la preferencia de sesión — el turno siguiente NO vuelve a breve/restringido.
  - Fuera de los dos bullets de REGISTRO y del "volver a lo normal": persist=true SÓLO si proyecta hacia adelante ("desde ahora", "siempre respondeme así"); persist=false (default) si dice "solo esta vez"/"por esta vez" o no aclara nada. "Solo esta vez" gana SIEMPRE sobre cualquier default de persist=true, incluso sobre un reset.
  - Si el pedido suena contradictorio ("resumen ejecutivo sin análisis"), interpretalo como la síntesis de las cifras clave — NUNCA lo uses de excusa para pedir una aclaración.`;
}

// buildPrefDispatch() → bloque para el system de la Pasada 2 (narratePromptC.js): CÓMO narrar bajo cada preferencia.
// Las reglas de CIFRAS/GUARD siguen valiendo SIEMPRE — pref nunca las relaja (regla 1: pesa más que la personalidad
// por defecto, nunca más que la veracidad/seguridad).
export function buildPrefDispatch() {
  return `PREFERENCIA DE RESPUESTA (viene en "preferencia_respuesta" SOLO cuando el usuario pidió algo distinto de tu forma habitual — si NO viene, ignorá esta sección ENTERA y respondé como siempre, en prosa libre, SIN ninguna marca):

⚠ CUANDO "preferencia_respuesta" VIENE CON "alcance" DISTINTO DE "full", ESTO ES OBLIGATORIO Y VA PRIMERO, ANTES DE CUALQUIER OTRA COSA QUE LEAS ABAJO: el motor —no vos— decide qué parte de tu respuesta llega al usuario, y SOLO puede hacerlo si marcás tu texto en bloques. Sin las marcas, tu respuesta ENTERA se descarta y el motor la reemplaza por una versión mecánica y menos rica de las cifras — perdés la oportunidad de narrar bien este turno. Encerrá tu contenido en estas marcas, CADA UNA SOLA EN SU PROPIA LÍNEA, literal, antes del texto de ese bloque (podés seguir usando tablas/negritas/tu voz de siempre DENTRO de cada bloque):
  [[DATOS]] → el dato/cifra/tabla + entidad + período (el hallazgo, sin causa ni acción).
  [[INTERPRETACION]] → la causa/lectura, graduada (probado/indicado/abierto).
  [[ACCION]] → la acción priorizada + su $ SOLO si está autorizado.
  [[SIGUIENTE_PASO]] → el cierre/pregunta guía/qué mirar después.
Escribí SOLO los bloques que el alcance de abajo necesita — alcance="data_only"/"results_only" → escribí ÚNICAMENTE [[DATOS]] (nada de [[ACCION]] ni [[INTERPRETACION]], ni siquiera una línea); alcance="action_only" → escribí ÚNICAMENTE [[ACCION]]. Las marcas nunca las ve el usuario, el motor las quita — pero OMITIRLAS significa que el motor no puede leer tu respuesta y la descarta entera.

· Una instrucción explícita del usuario sobre CÓMO recibir la respuesta pesa más que tu personalidad por defecto — pero NUNCA más que la veracidad ni el guard de cifras (nunca inventes un número ni fuerces una cifra no autorizada para cumplir un pedido de brevedad).
· alcance="data_only": en una consulta puntual, el dato + entidad + período, sin nada más. En un diagnóstico/resumen/decisión, los KPIs o la tabla + período — PARÁ ahí: no avances a la causa (POR QUÉ) ni a la acción (QUÉ HACER). NO escribas ninguna frase de acción/recomendación ("cerrá la brecha…", "trabajá sobre…", "empezá por…") — si la escribís, va DENTRO de [[DATOS]] igual, así que directamente no la escribas.
· alcance="action_only": arrancá DIRECTO por la acción (punto 3 de LA ESTRUCTURA) con su $ SOLO si está autorizado — no reconstruyas el diagnóstico que ya diste antes en la conversación.
· alcance="results_only" (simulación): supuesto + resultado numérico, sin recomendación — no cierres con un consejo de qué hacer con eso.
· detalle="brief": respondé directo y sumá como mucho el contexto indispensable — más corto que tu forma habitual, en cualquier alcance.
· Si el pedido suena contradictorio a primera vista ("resumen ejecutivo sin análisis"), interpretalo como una síntesis de las cifras clave — nunca lo uses de excusa para frenar con una aclaración.`;
}

// blockInstructionFor(contentScope) → instrucción de marcado REFORZADA A NIVEL DE TURNO (viaja en el payload de la
// Pasada 2 como "instruccion_formato", no solo en el system prompt) — owner-audit 2026-07-29: la instrucción del
// system prompt SOLA (buildPrefDispatch, arriba) no bastó — medido en vivo, el narrador ignoraba las marcas 3/3
// veces y cada turno restringido caía a la reparación determinística (composeFromLedger), perdiendo la narración
// rica. Repetir la instrucción, ESPECÍFICA para el alcance de ESTE turno, en el payload (lo que el modelo trata
// como la tarea inmediata, no una regla general de fondo) recuperó el cumplimiento en la primera corrida de prueba.
// null para contentScope="full" (no aplica ninguna restricción, no hace falta reforzar nada).
export function blockInstructionFor(contentScope) {
  if (contentScope === "action_only") {
    return "Tu respuesta ENTERA debe empezar con la marca [[ACCION]] en su propia línea, seguida de la acción priorizada (con su $ solo si está autorizado). NO escribas ninguna otra marca ([[DATOS]]/[[INTERPRETACION]]/[[SIGUIENTE_PASO]]) ni el diagnóstico que la justifica.";
  }
  if (contentScope === "data_only" || contentScope === "results_only") {
    return "Tu respuesta ENTERA debe empezar con la marca [[DATOS]] en su propia línea, seguida de tu contenido (tabla, dato, o supuesto+resultado si es una simulación). NO escribas ninguna otra marca ([[ACCION]]/[[INTERPRETACION]]/[[SIGUIENTE_PASO]]) ni ningún texto de interpretación o recomendación en esta respuesta.";
  }
  return null;
}

// BRIEF_INSTRUCTION → mismo principio que blockInstructionFor de arriba (owner-audit 2026-07-29: reforzar A NIVEL
// DE TURNO, no solo en el system prompt, es lo que recuperó cumplimiento) — pero para detailLevel="brief", que
// hasta ahora NO tenía ningún refuerzo de turno (el hallazgo EN VIVO de la certificación integral: 2 turnos
// consecutivos con brief+persist activo, sin ninguna reducción real de longitud). Viaja en el payload como
// "instruccion_brevedad" SOLO cuando detailLevel="brief" (ver narratePromptC.js) — el motor igual trunca
// determinísticamente si no alcanza (truncateToBriefBudget, narrationBlocks.js), esto es para que la MAYORÍA de
// los turnos ya lleguen cortos por sí solos y no dependan del corte.
export const BRIEF_INSTRUCTION = "Tu respuesta ENTERA debe entrar en 2-3 oraciones cortas (máximo ~90 palabras): andá directo al dato/causa/acción, sin ejemplos extra, sin repetir contexto que ya diste en este hilo. Si no entra en ese largo, el motor la recorta a la fuerza en la última oración completa que sí entre — mejor que la escribas corta vos.";
