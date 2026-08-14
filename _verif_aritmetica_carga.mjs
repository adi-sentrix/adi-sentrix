/* Verificación independiente del arquitecto: ¿bajar la carga X pp sube el margen EXACTAMENTE X pp?
 * Recomputado desde los campos crudos del tenant, sin creerle al informe. CERO red. */
import { initTenant, getTenantData } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
const t = getTenantData();
const filas = t.clientesMargen || [];
const DELTA = 2;
let exactas = 0, fallas = [];
for (const f of filas) {
  const margenBase = (f.contribucion / f.venta) * 100;
  // bajar la carga DELTA pp = pagar DELTA% menos de la venta en rebates
  const rebatesNuevos = f.rebates - (DELTA / 100) * f.venta;
  const contribNueva = f.venta - f.costo - rebatesNuevos;
  const margenNuevo = (contribNueva / f.venta) * 100;
  const salto = margenNuevo - margenBase;
  const exacta = Math.abs(salto - DELTA) < 1e-9;
  if (exacta) exactas++; else fallas.push(`${f.nombre}: salto ${salto.toFixed(6)}pp`);
  // además: ¿la identidad contribución = venta − costo − rebates se sostiene?
  const idOK = Math.abs((f.venta - f.costo - f.rebates) - f.contribucion) < 0.51;
  if (!idOK) fallas.push(`${f.nombre}: contribución declarada ${f.contribucion} vs recomputada ${(f.venta - f.costo - f.rebates).toFixed(1)}`);
}
console.log(`filas: ${filas.length} · saltos exactos de ${DELTA}pp: ${exactas}/${filas.length}`);
console.log(fallas.length ? "FALLAS:\n  " + fallas.join("\n  ") : "✅ la identidad se sostiene en todas las filas");
// y el caso del piso: una carga menor al delta
const chica = filas.filter((f) => (f.pctRebate || 0) < DELTA).map((f) => `${f.nombre} carga ${f.pctRebate}%`);
console.log(`cuentas con carga < ${DELTA}pp (el piso en cero debe declararse): ${chica.length ? chica.join(" · ") : "ninguna"}`);
