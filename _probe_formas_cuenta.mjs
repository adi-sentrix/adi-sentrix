/* ¿Qué forma de cuenta a la vista NO reconoce el catálogo? Diagnóstico de los vetos de H1 en la mini doble. */
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
const CTX = { ledger: { figs: [] }, results: [], trace: null, question: "Si subo ventas 4%, ¿qué cambia?", datoProyectado: cifrasDelDato("actual"), entidadesDelTenant: ejes(["cliente", "sku", "marca"]), duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full", tablePolicy: "auto" };
const FORMAS = [
  ["factor limpio", "Las ventas totales del negocio son $100.0M × 1.04 = $104.0M."],
  ["factor CON palabra en medio", "Ventas totales del negocio: $100.0M proyectados × 1.04 = $104.0M."],
  ["tasa sobre monto, resultado último", "Contribución: $104.0M proyectados × 25.1% = $26.1M."],
  ["resta, resultado último", "Costo implícito del negocio: $104.0M proyectados − $26.1M = $77.9M."],
  ["comparación vs presupuesto", "La proyección de $104.0M quedaría 7.2% sobre el presupuesto del negocio ($97.0M)."],
];
for (const [nombre, texto] of FORMAS) {
  const v = guardC(texto, CTX);
  console.log(`${v.ok ? "🟢 PASA " : "🔴 VETA "} · ${nombre}${v.ok ? "" : " → " + (v.violations[0] || {}).detail}`);
}
