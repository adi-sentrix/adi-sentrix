/* === _guia_promesas_gate_entry.jsx · entry de esbuild para _guia_promesas_gate.mjs ============================
 * SOLO re-exporta lo que el gate necesita — cero lógica propia (mismo patrón que _guia_inicio_gate_entry.jsx).
 * Los detectores salen DE ACÁ y no de un import suelto del gate: el bundle de esbuild tiene su PROPIA instancia
 * de cada módulo, y GUIA_EJEMPLOS ya se derivó al cargar el bundle con el coerceFloor de ESA instancia — comparar
 * contra otra instancia mediría un motor que no es el que armó la guía. */
export { GUIA_EJEMPLOS } from "./src/ui/GuiaInicio.jsx";
export { HERO_CHIPS } from "./src/ui/ChatADI.jsx";
export { coerceFloor } from "./src/adi/coerceChain.js";
export { detectScenarioIntent } from "./src/adi/oracle/scenarioIntent.js";
export { detectPnlIntent } from "./src/adi/pnl.js";
