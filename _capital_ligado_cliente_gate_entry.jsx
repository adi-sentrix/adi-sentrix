// Entry para esbuild · SOLO lo que _capital_ligado_cliente_gate.mjs necesita (la Ficha Ejecutiva de cliente).
export { SentrixPanel } from "./src/ui/SentrixPanel.jsx";
// vía 1 (2026-08-20): el tenant se declara DENTRO del bundle. El store ya no importa ningún dataset (esos
// imports metían el dato de todas las empresas en el bundle publicado), y esta instancia de esbuild tiene su PROPIA
// copia del store: declararlo en el proceso del gate no la alcanza.
export { initTenant } from "./src/data/tenantStore.js";
export { TENANT_DEMO } from "./src/data/tenants/demo.js";
