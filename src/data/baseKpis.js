/* === DATA · KPIs base + serie mensual · FACHADA del tenant activo (F1 multiempresa · 2026-07-26) ===
 * Los mismos exports de siempre, como live bindings de la puerta del dato (tenantStore). Los literales del
 * demo viven en tenants/demo.js (byte-idénticos a 41cc33d8). MESES_IDX es calendario, no dato: queda acá. */
import { getTenantData, onTenantChange } from "./tenantStore.js";

let _d = getTenantData();
export let ventasKPI = _d.ventasKPI;
export let margenKPI = _d.margenKPI;
export let invKPI = _d.invKPI;
export let ventasMensuales = _d.ventasMensuales;

onTenantChange((d) => {
  _d = d;
  ventasKPI = d.ventasKPI;
  margenKPI = d.margenKPI;
  invKPI = d.invKPI;
  ventasMensuales = d.ventasMensuales;
});

export const MESES_IDX = { Ene:0,Feb:1,Mar:2,Abr:3,May:4,Jun:5,Jul:6,Ago:7,Sep:8,Oct:9,Nov:10,Dic:11 };
