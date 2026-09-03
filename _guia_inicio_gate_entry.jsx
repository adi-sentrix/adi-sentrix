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
// vía 1 (2026-08-20): el tenant se declara DENTRO del bundle. El store ya no importa ningún dataset (esos
// imports metían el dato de todas las empresas en el bundle publicado), y esta instancia de esbuild tiene su PROPIA
// copia del store: declararlo en el proceso del gate no la alcanza.
export { initTenant } from "./src/data/tenantStore.js";
export { TENANT_DEMO } from "./src/data/tenants/demo.js";
// EL VIGÍA (2026-09-03): el gate siembra su huella como «ya vista» para aislar lo que mide (la guía: 1 pregunta
// → 1 respuesta). buildVigia/getTenantId salen DE ACÁ por la misma razón que todo lo demás: la instancia del bundle.
export { buildVigia } from "./src/adi/sentrix/vigia.js";
export { getTenantId } from "./src/data/tenantStore.js";
