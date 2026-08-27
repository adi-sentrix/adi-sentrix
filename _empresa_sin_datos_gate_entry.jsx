/* === _empresa_sin_datos_gate_entry.jsx · entrada de esbuild para _empresa_sin_datos_gate ==================
 * Node no importa `.jsx`. Este archivo existe solo para que esbuild arme un bundle que el candado sí pueda
 * importar — el mismo patrón que ya usan los otros gates de pantalla. No agrega lógica: solo reexporta. */
export { PanelDatos } from "./src/ui/PanelDatos.jsx";
export { initTenant } from "./src/data/tenantStore.js";
export { TENANT_DEMO } from "./src/data/tenants/demo.js";
