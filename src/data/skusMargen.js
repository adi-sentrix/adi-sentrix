/* === data/skusMargen.js · FACHADA del tenant activo (F1 multiempresa · 2026-07-26) ===
 * El mismo export de siempre, como live binding de la puerta del dato (tenantStore). El literal del demo
 * vive en tenants/demo.js (byte-idéntico a 41cc33d8). */
import { getTenantData, onTenantChange } from "./tenantStore.js";

export let skusMargen = getTenantData().skusMargen;

onTenantChange((d) => { skusMargen = d.skusMargen; });
