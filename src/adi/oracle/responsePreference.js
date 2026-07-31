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

// isDefaultPref(pref) → true si NO hay nada que comunicarle al narrador (turno normal, sin pedido especial). Se usa
// para decidir si "preferencia_respuesta" viaja en el payload de la Pasada 2 — igual que nivel_aclaracion, solo
// aparece cuando aporta algo (mismo principio de payload mínimo que ya usa narratePromptC.js).
export function isDefaultPref(pref) {
  if (!pref) return true;
  const scope = pref.contentScope || "full";
  const detail = pref.detailLevel || "standard";
  return scope === "full" && detail === "standard";
}

// buildPrefDoctrine() → bloque para el system de la Pasada 1 (planPrompt.js): CUÁNDO detectar cada valor. La
// detección es POR COMPRENSIÓN (mecanismo PRINCIPAL) — la coerción determinística en answerViaOracle.js es
// SOLO una red para las frases más inequívocas, nunca el mecanismo del que depende la feature (owner: "usa
// coerción determinística únicamente como red para instrucciones explícitas, no como mecanismo principal").
export function buildPrefDoctrine() {
  return `· PREFERENCIA DE RESPUESTA (eje "pref", DISTINTO de "mode" — mode decide QUÉ necesita el usuario, pref decide CÓMO recibirlo; nunca cambia qué tools pedís ni el alcance de los datos):
  - Detectala SOLO si el usuario la pidió en ESTE turno, explícita o casi-explícitamente. Si no dijo nada al respecto, dejá "pref" vacío/omitido — NO repitas ni inventes la preferencia de un turno anterior, eso lo administra el motor, no vos.
  - contentScope="data_only": "solo el dato/la cifra/el número", "sin análisis/interpretación", "solo cifras/KPIs" → quiere el dato sin la lectura.
  - contentScope="action_only": "solo la acción", "sin el diagnóstico", "andá al grano", "directo a qué hacer" → ya tiene el contexto, quiere solo la decisión.
  - contentScope="results_only": en una simulación, "solo los resultados", "sin recomendación" → quiere el efecto del supuesto, no el consejo.
  - detailLevel="brief": "responde breve/corto", "sé breve", "resumime" → más corto que tu forma habitual, en cualquier alcance. Sobre ESTE pedido puntual, no de tu registro en general → persist queda con la regla general de abajo (default false).
  - detailLevel="brief" Y persist=true, LOS DOS EN EL MISMO OBJETO "pref", SIEMPRE JUNTOS: "háblame más directo", "sé más directo", "sin rodeos", "menos detalle". Es una corrección de REGISTRO general — como "trátame de usted" —, no un pedido sobre este contenido puntual, así que a diferencia del bullet anterior VA con persist=true por defecto. NO alcanza con marcar solo persist: si detectás esta frase, el objeto pref DEBE tener detailLevel="brief" ADEMÁS de persist=true — nunca uno sin el otro.
  - detailLevel="standard" Y persist=true, LOS DOS EN EL MISMO OBJETO "pref", SIEMPRE JUNTOS (misma lógica que el bullet anterior, en la dirección opuesta): "explícamelo con más detalle", "sé más explicativo" → vuelve al nivel de detalle normal sin resetear ningún otro alcance/preferencia. Igual que arriba: nunca marques persist=true sin también fijar detailLevel="standard" en ese caso.
  - Pedido de VOLVER a lo normal ("dame el análisis completo de nuevo", "como antes", "volvé a lo normal", "ya no hace falta que sea breve") → contentScope="full", detailLevel="standard", persist=true SIEMPRE: cancela cualquier preferencia de sesión que hubiera — el turno siguiente NO debe volver a breve/restringido.
  - Fuera de los dos bullets de REGISTRO de arriba y de un pedido de "volver a lo normal": persist=true SOLO si dice algo que proyecte hacia adelante ("desde ahora"/"de ahora en adelante"/"siempre respondeme así"). persist=false (default) si dice "solo esta vez"/"por esta vez", o si no aclara nada. "Solo esta vez" gana SIEMPRE sobre cualquier default de persist=true de arriba, incluso sobre un pedido de volver a lo normal (ej. "dame el completo solo por esta vez" → no cancela la sesión; "háblame más directo, pero solo por esta vez" → detailLevel="brief" con persist=false).
  - Si el pedido suena contradictorio a primera vista ("resumen ejecutivo sin análisis"), interpretalo como la síntesis de las cifras clave — NUNCA lo uses de excusa para pedir una aclaración.`;
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
