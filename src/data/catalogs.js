/* === DATA · catálogos · FACHADA del tenant activo (F1 multiempresa · 2026-07-26) ===
 * Los mismos exports de siempre, como live bindings de la puerta del dato (tenantStore). Los literales del
 * demo viven en tenants/demo.js (byte-idénticos a 41cc33d8 · el ORDEN es parte del dato declarado). */
import { getTenantData, onTenantChange } from "./tenantStore.js";

let _d = getTenantData();
export let SUPERFAMILIAS = _d.SUPERFAMILIAS;
export let MARCAS_ALL = _d.MARCAS_ALL;
export let SUCURSALES = _d.SUCURSALES;

onTenantChange((d) => {
  _d = d;
  SUPERFAMILIAS = d.SUPERFAMILIAS;
  MARCAS_ALL = d.MARCAS_ALL;
  SUCURSALES = d.SUCURSALES;
});
