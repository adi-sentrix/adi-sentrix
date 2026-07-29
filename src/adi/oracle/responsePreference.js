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
  - detailLevel="brief": "responde breve/corto", "sé breve", "resumime" → más corto que tu forma habitual, en cualquier alcance.
  - Pedido de VOLVER a lo normal ("dame el análisis completo de nuevo", "como antes", "volvé a lo normal", "ya no hace falta que sea breve") → contentScope="full", detailLevel="standard".
  - persist=true SOLO si ADEMÁS dice algo que proyecte hacia adelante: "desde ahora"/"de ahora en adelante"/"siempre respondeme así", o una cancelación explícita de una preferencia previa ("volvé a lo normal", "ya no necesito/hace falta que sea breve"). persist=false (default) si dice "solo esta vez"/"por esta vez", o si no aclara nada — incluso un pedido de "volver a lo normal" formulado de forma ambigua ("dame el análisis completo de nuevo", "como antes", sin más) aplica SOLO a este turno: no asumas que cancela una preferencia de sesión salvo que lo diga con esa proyección hacia adelante.
  - Si el pedido suena contradictorio a primera vista ("resumen ejecutivo sin análisis"), interpretalo como la síntesis de las cifras clave — NUNCA lo uses de excusa para pedir una aclaración.`;
}

// buildPrefDispatch() → bloque para el system de la Pasada 2 (narratePromptC.js): CÓMO narrar bajo cada preferencia.
// Las reglas de CIFRAS/GUARD siguen valiendo SIEMPRE — pref nunca las relaja (regla 1: pesa más que la personalidad
// por defecto, nunca más que la veracidad/seguridad).
export function buildPrefDispatch() {
  return `PREFERENCIA DE RESPUESTA (viene en "preferencia_respuesta" SOLO cuando el usuario pidió algo distinto de tu forma habitual — si no viene, ignorá esta sección y respondé como siempre):
· Una instrucción explícita del usuario sobre CÓMO recibir la respuesta pesa más que tu personalidad por defecto — pero NUNCA más que la veracidad ni el guard de cifras (nunca inventes un número ni fuerces una cifra no autorizada para cumplir un pedido de brevedad).
· alcance="data_only": en una consulta puntual, el dato + entidad + período, sin nada más. En un diagnóstico/resumen/decisión, los KPIs o la tabla + período — PARÁ ahí: no avances a la causa (POR QUÉ) ni a la acción (QUÉ HACER). NO CIERRES con una frase de acción/recomendación ("cerrá la brecha…", "trabajá sobre…", "empezá por…") aunque sea una sola línea al final — la tabla/los KPIs son la respuesta COMPLETA, no un preámbulo antes del consejo de siempre.
· alcance="action_only": arrancá DIRECTO por la acción (punto 3 de LA ESTRUCTURA) con su $ SOLO si está autorizado — no reconstruyas el diagnóstico que ya diste antes en la conversación.
· alcance="results_only" (simulación): supuesto + resultado numérico, sin recomendación — no cierres con un consejo de qué hacer con eso.
· detalle="brief": respondé directo y sumá como mucho el contexto indispensable — más corto que tu forma habitual, en cualquier alcance.
· Si el pedido suena contradictorio a primera vista ("resumen ejecutivo sin análisis"), interpretalo como una síntesis de las cifras clave — nunca lo uses de excusa para frenar con una aclaración.`;
}
