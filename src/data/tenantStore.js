/* === data/tenantStore.js · LA PUERTA DEL DATO (F1 multiempresa · 2026-07-26) ===
 * UNA puerta: el dataset activo entra por acá y por ningún otro lado. Los módulos del producto siguen
 * importando sus bindings de siempre (demoData/skusMargen/baseKpis/catalogs/scenarios) — esos archivos son
 * FACHADAS de este store con live bindings, así el refactor es byte-exacto: mismo import, mismo valor.
 *
 * `initTenant(dataset)` cambia la empresa activa y dispara los REBUILDS registrados: todo estado derivado
 * del dato (canon de entidades, KNOWN_ENTITIES, anclas temporales, matriz cliente×SKU, caches del P&L) se
 * re-arma acá, en INIT — nunca más en import de módulo. El orden de los callbacks es el orden de evaluación
 * de módulos (las fachadas se evalúan antes que sus consumidores) → dependencias siempre al día primero.
 *
 * Default = TENANT_DEMO (misma app, cero cambio visible). Un tenant nuevo = un objeto con el shape de
 * TENANT_DEMO (ver tenants/demo.js) — el fixture empresa-2 es la prueba de fuego de este contrato. */
import { TENANT_DEMO } from "./tenants/demo.js";

let _data = TENANT_DEMO;
const _rebuilds = [];

export const getTenantData = () => _data;
export const getTenantId = () => (_data && _data.id) || "demo";

// registra un rebuild de estado derivado del dato · se dispara en cada initTenant (no en el registro)
export const onTenantChange = (fn) => { _rebuilds.push(fn); };

export function initTenant(tenant) {
  _data = tenant || TENANT_DEMO;
  for (const fn of _rebuilds) fn(_data);
  return _data;
}
