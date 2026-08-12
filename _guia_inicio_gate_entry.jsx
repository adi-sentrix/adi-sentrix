// Entry para esbuild · guía de inicio: la App REAL (el cableado de verdad: botón del header, apertura sola,
// ejecución de un ejemplo) + los helpers de persistencia + las dos fuentes de preguntas que tienen que coincidir.
// answerConversational y resetPnlDraft salen DE ACÁ, no de un import suelto del gate: el bundle de esbuild tiene su
// PROPIA instancia de cada módulo, así que importarlos aparte daría un motor con estado distinto al que corre la App
// — el borrador de P&L de un turno no se vería en el otro, y el gate mediría una app que no existe.
export { default as App } from "./src/ui/App.jsx";
// GUIA_CAPITULOS/GUIA_PASOS salen de acá para que el gate NO repita el número de capítulos: si mañana se agrega
// uno, el recorrido lo cubre solo en vez de dejar el último sin barrer.
export { GuiaInicio, GUIA_EJEMPLOS, GUIA_KEY, GUIA_VISTA, GUIA_NUNCA, GUIA_CAPITULOS, GUIA_PASOS, guiaAbreSola, leerGuiaMarca } from "./src/ui/GuiaInicio.jsx";
export { HERO_CHIPS, buildAdiTurn, NOT_YET_TEXT } from "./src/ui/ChatADI.jsx";
export { answerConversational } from "./src/adi/conversation.js";
export { resetPnlDraft } from "./src/adi/pnl.js";
export { coerceSpec, coerceFloor } from "./src/adi/coerceChain.js";   // el gate comprueba que el spec derivado sea EXACTAMENTE el que el coercer produce
