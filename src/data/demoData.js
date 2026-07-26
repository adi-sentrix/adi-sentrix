/* === DATA · datasets del tenant activo (F1 multiempresa · 2026-07-26) ===
 * FACHADA de la puerta del dato (tenantStore): los mismos exports de siempre, ahora como live bindings del
 * tenant activo. El demo (tenants/demo.js · literales byte-idénticos a 41cc33d8) es el default — misma app,
 * cero cambio visible. `initTenant(dataset)` re-apunta estos bindings ANTES que cualquier rebuild derivado
 * (las fachadas se registran primero por orden de evaluación de módulos). Nadie más importa el dato crudo. */
import { getTenantData, onTenantChange } from "./tenantStore.js";

let _d = getTenantData();
export let clientesVentas = _d.clientesVentas;
export let clientesMargen = _d.clientesMargen;
export let marcasVentas = _d.marcasVentas;
export let marcasMargen = _d.marcasMargen;
export let sfamiliasVentas = _d.sfamiliasVentas;
export let sfamiliasMargen = _d.sfamiliasMargen;
export let skuInventario = _d.skuInventario;
export let historialMargen = _d.historialMargen;
export let CLIENTES_STRATEGIC_PROFILE = _d.CLIENTES_STRATEGIC_PROFILE;

onTenantChange((d) => {
  _d = d;
  clientesVentas = d.clientesVentas;
  clientesMargen = d.clientesMargen;
  marcasVentas = d.marcasVentas;
  marcasMargen = d.marcasMargen;
  sfamiliasVentas = d.sfamiliasVentas;
  sfamiliasMargen = d.sfamiliasMargen;
  skuInventario = d.skuInventario;
  historialMargen = d.historialMargen;
  CLIENTES_STRATEGIC_PROFILE = d.CLIENTES_STRATEGIC_PROFILE;
});
