/* === CONFIG · escenarios + transforms + benchmarks sectoriales ===
 * Extraído de 41cc33d8 · valores byte-idénticos · cero recálculo (Fase 2 del refactor).
 * F1 multiempresa (2026-07-26): SCENARIO_TRANSFORMS es DATO DEL TENANT (nombra SUS entidades y trae SUS
 * kpis) → pasa a fachada de la puerta del dato (tenantStore · literal del demo en tenants/demo.js).
 * SCENARIOS (ids/labels de la UI) y SECTORAL_BENCHMARKS (referencias sectoriales) siguen siendo config. */
import { getTenantData, onTenantChange } from "../data/tenantStore.js";

export let SCENARIO_TRANSFORMS = getTenantData().SCENARIO_TRANSFORMS;
onTenantChange((d) => { SCENARIO_TRANSFORMS = d.SCENARIO_TRANSFORMS; });

export const SCENARIOS = {
  bonanza: { id:"bonanza", label:"Bonanza", sublabel:"La trampa del éxito",   color:"#10b981", dotColor:"#34d399", icon:"🟢" },
  tension: { id:"tension", label:"Tensión", sublabel:"KPIs dejan de funcionar", color:"#f59e0b", dotColor:"#fbbf24", icon:"🟡" },
  crisis:  { id:"crisis",  label:"Crisis",  sublabel:"Todo se rompe a la vez",  color:"#ef4444", dotColor:"#f87171", icon:"🔴" },
};

export const SECTORAL_BENCHMARKS = {
  // doh · = typical_doh U.A
  doh: {
    retail: 53,         // typical_doh U.A retail [DERIVADO n=6 SKU]
    construccion: 90,   // typical_doh U.A construcción [DERIVADO n=4 SKU Materiales]
    consumo_masivo: 43, // typical_doh U.A consumo_masivo [DERIVADO n=3 SKU]
    generico: 62,       // typical_doh U.A genérico [DERIVADO portfolio.doh_promedio]
  },
  // margen_pct · = typical_margin_pct U.A
  margen_pct: {
    retail: 20,         // typical_margin U.A retail [DERIVADO n=6 SKU]
    construccion: 21,   // typical_margin U.A construcción [DERIVADO n=4 SKU]
    consumo_masivo: 26, // typical_margin U.A consumo_masivo [DERIVADO n=3 SKU]
    generico: 22,       // typical_margin U.A genérico [ASUNCIÓN U.A]
  },
  // rotacion · = typical_rotation U.A
  rotacion: {
    retail: 6.0,        // typical_rotation U.A retail [DERIVADO n=6 SKU]
    construccion: 3.9,  // typical_rotation U.A construcción [DERIVADO n=4 SKU]
    consumo_masivo: 7.9,// typical_rotation U.A consumo_masivo [DERIVADO n=3 SKU]
    generico: 6.0,      // typical_rotation U.A genérico [ASUNCIÓN U.A]
  },
  // carga_comercial_pct · = typical_carga_pct U.A
  carga_comercial_pct: {
    retail: 3.7,        // typical_carga U.A retail [DERIVADO n=7 clientes]
    construccion: 5.5,  // typical_carga U.A construcción [DERIVADO n=2 clientes]
    consumo_masivo: 3.5,// typical_carga U.A consumo_masivo [DERIVADO n=4 clientes]
    generico: 4.0,      // typical_carga U.A genérico [ASUNCIÓN U.A]
  },
};
