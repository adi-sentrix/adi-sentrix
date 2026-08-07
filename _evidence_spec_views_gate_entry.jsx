// Entry para esbuild · _evidence_spec_views_gate.mjs monta <SentrixPanel/> con evidence REAL.
// RESTAURADO (2026-08-07): el gate estaba commiteado pero este shim no — quedó local en la sesión que lo escribió,
// así que `npm run gates:offline` fallaba en esbuild ("Could not resolve") sin llegar a correr una sola aserción.
export { SentrixPanel } from "./src/ui/SentrixPanel.jsx";
