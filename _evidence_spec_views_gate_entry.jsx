// Entry para esbuild · _evidence_spec_views_gate.mjs monta <SentrixPanel/> con evidence REAL.
// RESTAURADO (2026-08-07): el gate estaba commiteado pero este shim no — quedó local en la sesión que lo escribió,
// así que `npm run gates:offline` fallaba en esbuild ("Could not resolve") sin llegar a correr una sola aserción.
export { SentrixPanel } from "./src/ui/SentrixPanel.jsx";
// vía 1 (2026-08-20): el tenant se declara DENTRO del bundle. El store ya no importa ningún dataset (esos
// imports metían el dato de todas las empresas en el bundle publicado), y esta instancia de esbuild tiene su PROPIA
// copia del store: declararlo en el proceso del gate no la alcanza.
export { initTenant } from "./src/data/tenantStore.js";
export { TENANT_DEMO } from "./src/data/tenants/demo.js";
