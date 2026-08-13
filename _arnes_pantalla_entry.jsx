/* Entry para esbuild · ARNÉS DE PANTALLA. Expone el MISMO `buildAdiTurnLLM` que corre cuando el usuario escribe
 * en el chat — no `answerViaOracle` suelto. Esa distinción es el motivo de que este archivo exista: la corrida
 * anterior mandó al oráculo un turno que la App le cede al flujo del P&L, y probó una carretera por la que ese
 * turno no pasa.
 * TODO SALE DE ACÁ, no de imports sueltos: el bundle de esbuild tiene su PROPIA instancia de cada módulo, así que
 * importar `pnl.js` por separado daría un motor con OTRO estado — el P&L montado en un lado no se vería en el
 * otro, y el arnés mediría una app que no existe. Es la misma razón que declara el entry de la guía. */
export { buildAdiTurnLLM } from "./src/ui/ChatADI.jsx";
export { detectPnlIntent, composePnl, activePnl, resetPnlDraft } from "./src/adi/pnl.js";
export { answerConversational } from "./src/adi/conversation.js";
// Los flags se exportan para PROBAR con qué perfil corre el bundle: si el oráculo quedara apagado, el arnés
// estaría midiendo el piso determinístico y creyendo que mide producción.
export { ADI_ORACLE_ENABLED, ADI_LLM_ENABLED, ADI_LLM_NARRATE_ENABLED, ADI_BYPASS_SIN_PAGO } from "./src/config/voiceFlags.js";
export { gatewayFetch } from "./src/adi/llm/gatewayFetch.js";
