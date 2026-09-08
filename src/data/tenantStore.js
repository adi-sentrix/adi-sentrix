/* === data/tenantStore.js · LA PUERTA DEL DATO (F1 multiempresa · 2026-07-26 · vía 1 · 2026-08-20) ===
 * UNA puerta: el dataset activo entra por acá y por ningún otro lado. Los módulos del producto siguen
 * importando sus bindings de siempre (demoData/skusMargen/baseKpis/catalogs/scenarios) — esos archivos son
 * FACHADAS de este store con live bindings, así el refactor es byte-exacto: mismo import, mismo valor.
 *
 * `initTenant(dataset)` cambia la empresa activa y dispara los REBUILDS registrados: todo estado derivado
 * del dato (canon de entidades, KNOWN_ENTITIES, anclas temporales, matriz cliente×SKU, caches del P&L) se
 * re-arma acá, en INIT — nunca más en import de módulo. El orden de los callbacks es el orden de evaluación
 * de módulos (las fachadas se evalúan antes que sus consumidores) → dependencias siempre al día primero.
 *
 * ⚠️ VÍA 1 (2026-08-20) · EL DEFAULT DEJÓ DE SER EL DEMO, y esa es toda la razón de este cambio.
 * Antes, la primera línea de este archivo era `import { TENANT_DEMO } from "./tenants/demo.js"`. Junto con el
 * `import { TENANTS }` de `main.jsx`, esos dos imports eran los ÚNICOS que metían dato de negocio en el bundle
 * publicado — y lo metían de verdad: se construyó el bundle de producción y `NevadaFoods`, una marca que solo
 * existe en `tenants/empresa2.js`, aparecía 9 veces con sus ventas y sus márgenes. Un usuario de una empresa se
 * descargaba el dato de la otra; la pantalla simplemente no se lo pintaba.
 *
 * Ahora el store arranca en `TENANT_VACIO` (la misma FORMA, cero cifras · ver tenantEmpty.js) y **el dataset
 * llega por `initTenant`**: en el navegador lo trae `tenantClient.js` desde `/api/adi-data`, que resuelve la
 * empresa DEL LADO DEL SERVIDOR a partir de la sesión firmada. En Node (gates, consola, exámenes) lo declara
 * quien corre — `initTenant(TENANT_DEMO)` — igual que `ESCENARIO_INICIAL` se declara una vez y no se hereda.
 *
 * CONSECUENCIA QUE HAY QUE SABER: entre la evaluación de módulos y `initTenant` hay un instante con la forma
 * vacía. Los módulos que derivan estado del dato ya estaban escritos para eso (re-arman en el callback), y el
 * candado `_bundle_sin_datos_gate.mjs` [B] prueba que ese instante no rompe nada. Lo que NO se puede hacer es
 * mostrar pantalla antes de `initTenant`: de eso se encarga `main.jsx`, que espera el dato para montar la app.
 */
import { TENANT_VACIO, esTenantVacio } from "./tenantEmpty.js";

let _data = TENANT_VACIO;
const _rebuilds = [];

export const getTenantData = () => _data;
/* ⚠️ `null` CUANDO NO HAY NADA CARGADO, y hasta la vía 3 esto devolvía `"demo"`. Ese default era cómodo
 * mientras el demo era el único negocio: nombraba lo que efectivamente iba a haber. Con empresas reales pasó a
 * ser una AFIRMACIÓN FALSA — una sesión de otra empresa que todavía no subió su archivo quedaba etiquetada
 * como «demo» en el contexto del turno, en la boleta y en cualquier respuesta que se guardara. Un identificador
 * de empresa equivocado es peor que ninguno: `null` se ve y se puede rechazar; «demo» se cree. */
export const getTenantId = () => (_data && _data.id) || null;

/** ¿Ya entró un dataset real por la puerta? `false` = todavía estamos en la forma vacía del arranque. */
export const tenantCargado = () => !esTenantVacio(_data);

// registra un rebuild de estado derivado del dato · se dispara en cada initTenant (no en el registro)
export const onTenantChange = (fn) => { _rebuilds.push(fn); };

export function initTenant(tenant) {
  _data = tenant || TENANT_VACIO;
  for (const fn of _rebuilds) fn(_data);
  return _data;
}

/* EL DIARIO, AL DÍA EN CALIENTE (owner 2026-09-08, textual: «no se puede cerrar y crear un nuevo chat para
 * probar la continuidad»). EL DEFECTO, MEDIDO: el diario se persiste por su propia puerta y vuelve confirmado
 * desde el servidor, pero el pack que YA está en memoria conservaba el diario viejo — y la siembra de un hilo
 * nuevo (ChatADI) lee justamente de ahí. Resultado: abrir un chat nuevo DENTRO de la misma sesión sembraba un
 * diario rancio (vacío, la primera vez) y la memoria parecía no existir hasta recargar la página entera.
 * POR QUÉ NO DISPARA LOS REBUILDS: el diario no es dato del negocio —es la relación— y ninguna vista, motor ni
 * boleta deriva de él; correr los rebuilds acá recalcularía la Mesa entera por una escritura que nadie mira.
 * SE GUARDA LO QUE EL SERVIDOR CONFIRMÓ, no lo que se mandó: el mismo criterio de `declararDiario`. */
export function actualizarDiarioDelPack(diario) {
  if (!_data || esTenantVacio(_data)) return false;
  _data = { ..._data, perfil: { ...(_data.perfil || {}), diario: (diario && typeof diario === "object") ? diario : {} } };
  return true;
}
