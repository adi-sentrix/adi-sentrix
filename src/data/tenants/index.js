/* === data/tenants/index.js · REGISTRO DE TENANTS (F1 multiempresa · 2026-07-26) ===
 * Los datasets que esta build conoce. El demo es el default (tenantStore); empresa2 es el FIXTURE permanente
 * de la prueba de fuego multiempresa (_tenant_gate) y se puede activar en dev con ?tenant=empresa2.
 * F3 (tenancy operativa) moverá esta resolución al gateway (tenant-id del código firmado → dataset server-side). */
import { TENANT_DEMO } from "./demo.js";
import { TENANT_EMPRESA2 } from "./empresa2.js";

export const TENANTS = { demo: TENANT_DEMO, empresa2: TENANT_EMPRESA2 };
