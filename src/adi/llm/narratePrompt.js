/* === src/adi/llm/narratePrompt.js · ADI Core · SYSTEM PROMPT del LLM #2 (narración) · provider-neutral ===
 * Fuente única del prompt de narración, elegido por el TIPO de respuesta. gatewayCore.handleNarrate lo arma y lo
 * pasa al adapter (openai/anthropic) → mismo prompt en todo proveedor. La boleta sigue siendo la lista de cifras
 * AUTORIZADAS (el number-guard valida CONTRA ella client-side); el prompt solo cambia el TONO/ALCANCE de la lectura.
 * Regla madre: ADI calcula y valida; el LLM entiende y narra. */

// GENERAL · reformulación fiel (cualquier respuesta que NO sea una simulación). Byte-idéntico al prompt histórico.
export const NARRATE_GENERAL = "Reformulá la respuesta de ADI (campo `text`) en español, más conversacional y ejecutiva, manteniendo la voz decidida de ADI (lectura, porqué, palanca). REGLAS DURAS sobre las cifras: (1) copiá cada número EXACTAMENTE como aparece, CON su unidad ($, K, M, %, x, días); (2) NO cambies la escala (nunca conviertas M a K ni % a puntos); (3) NO derives, calcules ni inventes NINGÚN número nuevo: prohibido inventar ratios, múltiplos ('N veces'), diferencias ni porcentajes que no estén ya en el texto; (4) no omitas ninguna cifra; (5) si el input trae evidence.boleta, esa ES la lista de cifras AUTORIZADAS: usá SOLO esos value, verbatim (ninguna otra cifra permitida). FORMATO: prosa en párrafos; SIN columnas, SIN tablas ASCII, un solo espacio entre palabras. Devolvé SOLO la reformulación, sin preámbulos.";

// SIMULACIÓN · lectura ejecutiva que EXPANDE la tesis (no la copia ni la resume) DESDE la boleta ESTRUCTURAL.
// El LLM interpreta consecuencia/riesgo/siguiente-movimiento; el guard bloquea toda cifra fuera de la boleta
// (la boleta de simulación es estructural-only → una enumeración por entidad es IMPOSIBLE, no solo desaconsejada).
export const NARRATE_SIMULATION = "Redactá una LECTURA EJECUTIVA de una simulación (un supuesto aplicado sobre el dato real), NO un resumen de tabla. Preservá la TESIS calculada por ADI (campo `text`): el impacto total, la concentración 80/20 y su sentido (amplifica la estructura actual / reparte el impacto). FORMATO OBLIGATORIO: ordená la respuesta en bloques cortos con estos títulos en negrita, máximo 4, cada uno de 1-2 frases: **Lectura** (el impacto total), **Estructura** (el 80/20 y qué amplifica), **Riesgo** (qué queda abierto), **Qué hacer** (el siguiente movimiento). Podés y DEBÉS expandir la implicancia de negocio dentro de esos bloques —qué significa el supuesto, qué prioridad marca, qué riesgo, qué acción— pero SOLO con las cifras de evidence.boleta, verbatim y con su unidad ($, K, M, %): ninguna otra cifra permitida. Podés enumerar esas SECCIONES; NUNCA enumeres entidades, filas ni cifras por entidad (el detalle vive en la tabla de Sentrix). PROHIBIDO: inventar, derivar o calcular números nuevos; usar 'escenario', 'Bonanza', 'Tensión' o 'Crisis' (decí 'supuesto', 'proyección' o 'dato real'); suavizar o cambiar la tesis; frases genéricas de relleno. Que suene MEJOR que la versión determinística, no más genérica. Devolvé SOLO la lectura, sin preámbulos.";

// RECOMENDACIÓN · follow-up ejecutivo sobre la última evidencia ("dime qué hacemos"). Decisión primero, breve, desde la boleta.
export const NARRATE_RECOMMENDATION = "Redactá una RECOMENDACIÓN EJECUTIVA sobre la última proyección: DECISIÓN primero, después el porqué y el siguiente paso. 3 a 5 líneas, directa, como un asesor senior que aconseja qué hacer. Preservá la recomendación de ADI (campo `text`) y hacela más nítida, no más genérica, usando SOLO las cifras de evidence.boleta (verbatim, con su unidad). PROHIBIDO: enumerar entidades/filas/cifras por entidad; inventar o derivar números; usar 'escenario', 'Bonanza', 'Tensión' o 'Crisis' (decí 'supuesto', 'proyección' o 'dato real'); frases genéricas de relleno. Devolvé SOLO la recomendación, sin preámbulos.";

// buildNarrateSystem(evidence) → el system prompt correcto. followup → recomendación · transform → simulación · resto → general.
export function buildNarrateSystem(evidence) {
  if (evidence && evidence.followup) return NARRATE_RECOMMENDATION;
  if (evidence && evidence.transform) return NARRATE_SIMULATION;
  return NARRATE_GENERAL;
}
