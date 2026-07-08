/* === src/adi/uiSignals.js · SEÑALES DE UI → CONTEXTO CONVERSACIONAL (owner 2026-07-08) ===
 * "ADI debe recordar lo que se conversa en todos los grados: preguntas directas, cards, clicks en gráficos."
 * Lo que el usuario HACE en Sentrix (selección en la Mesa, estación tocada, panel abierto) se vuelve contexto para
 * la conversación: el LLM #1 lo ve (interpreta "compará esto" / "resumime esto") y el coerce lo usa determinístico
 * ("compará estos dos" = la selección de la Mesa). REGLA DURA: el click INFORMA contexto, NUNCA dispara respuestas —
 * la conversación sigue siendo por turnos, del usuario. Módulo mínimo sin React (lo leen coerce y contexto). */
let _sig = {};
export const setUISignal = (patch) => { _sig = { ..._sig, ...patch }; };
export const getUISignals = () => _sig;
export const clearUISignals = () => { _sig = {}; };
