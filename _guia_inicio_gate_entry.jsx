// Entry para esbuild · guía de inicio: la App REAL (el cableado de verdad: botón del header, apertura sola,
// ejecución de un ejemplo) + los helpers de persistencia + las dos fuentes de preguntas que tienen que coincidir.
// answerConversational y resetPnlDraft salen DE ACÁ, no de un import suelto del gate: el bundle de esbuild tiene su
// PROPIA instancia de cada módulo, así que importarlos aparte daría un motor con estado distinto al que corre la App
// — el borrador de P&L de un turno no se vería en el otro, y el gate mediría una app que no existe.
export { default as App } from "./src/ui/App.jsx";
export { GuiaInicio, GUIA_EJEMPLOS, GUIA_KEY, GUIA_VISTA, GUIA_NUNCA, guiaAbreSola, leerGuiaMarca } from "./src/ui/GuiaInicio.jsx";
export { HERO_CHIPS, buildAdiTurn, NOT_YET_TEXT } from "./src/ui/ChatADI.jsx";
export { answerConversational } from "./src/adi/conversation.js";
export { resetPnlDraft } from "./src/adi/pnl.js";
