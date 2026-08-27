/* === data/tenantEmpty.js · LA FORMA VACÍA · el default de arranque (vía 1 · 2026-08-20) ==========================
 *
 * POR QUÉ EXISTE. Hasta hoy `tenantStore.js` arrancaba con `TENANT_DEMO` importado estáticamente, y `main.jsx`
 * importaba el REGISTRO COMPLETO de tenants. Esos dos imports eran los únicos que metían dato de negocio en el
 * bundle que se publica — y lo metían de VERDAD: se construyó el bundle y `NevadaFoods` (una marca que solo existe
 * en `tenants/empresa2.js`) aparecía 9 veces, con sus ventas y sus márgenes. El `if (import.meta.env.DEV)` de
 * `main.jsx` borraba el objeto de cabecera del tenant, no sus filas.
 *
 * QUÉ ES ESTO. El dataset con el que el store arranca cuando todavía no llegó el de la empresa: **la misma FORMA,
 * sin una sola cifra de negocio**. No es un tenant: es el hueco declarado que la app ocupa durante los milisegundos
 * que van entre el arranque y `initTenant(dataset)`.
 *
 * TRES REGLAS QUE ESTE ARCHIVO NO PUEDE ROMPER:
 *   1. **Ni una cifra inventada.** Todo cero, vacío o ausente. Un número plausible acá sería un dato falso en
 *      pantalla durante el arranque, y este proyecto ya pagó caro mostrar una cifra sin dueño.
 *   2. **Todas las llaves de `TENANT_DEMO`, exactamente.** Las fachadas (`demoData`, `baseKpis`, `catalogs`,
 *      `skusMargen`, `config/scenarios`) leen sus bindings EN TIEMPO DE IMPORT; una llave que falte acá es un
 *      `undefined` propagándose por 34 módulos antes del primer render.
 *   3. **`perfil: {}` a propósito.** `businessPolicy._perfilVal` solo acepta números finitos: con el perfil vacío
 *      cae limpio a `POLICY_CONFIG` y ninguna vara queda inventada. Sin `costModel`, el motor degrada a solo-ventas
 *      —que es exactamente lo honesto cuando todavía no hay empresa.
 *
 * `id: null` es deliberado: desde la vía 3 `getTenantId()` devuelve `null` sin tenant cargado, y un id nulo acá hace que cualquier
 * consumidor que scopee por tenant (criteria, caches) no confunda "todavía no cargó" con "es el demo".
 */

/** El KPI vacío de ventas — mismas llaves que el del tenant, todas en cero. */
const _ventasKPI = { totalActual: 0, totalAnterior: 0, totalPresupuesto: 0, vsAnterior: 0, vsPresupuesto: 0, unidades: 0, ticketProm: 0 };
/** El KPI vacío de margen. */
const _margenKPI = { pct: 0, pctAnt: 0, totalUSD: 0, gapPuntos: 0 };
/** El KPI vacío de inventario. */
const _invKPI = { totalUSD: 0, doh: 0, inmovilizadoPct: 0, inmovilizadoUSD: 0, sobrestockPct: 0, riesgoPct: 0 };

/** TENANT_VACIO · la forma sin dato. Congelado: nadie lo muta por accidente creyendo que es un dataset real. */
export const TENANT_VACIO = Object.freeze({
  id: null,
  nombre: "",
  perfil: {},

  clientesVentas: [],
  clientesMargen: [],
  marcasVentas: [],
  marcasMargen: [],
  sfamiliasVentas: [],
  sfamiliasMargen: [],
  skuInventario: [],
  skusMargen: [],

  historialMargen: {},
  CLIENTES_STRATEGIC_PROFILE: {},

  ventasKPI: _ventasKPI,
  margenKPI: _margenKPI,
  invKPI: _invKPI,
  ventasMensuales: [],

  SUPERFAMILIAS: [],
  MARCAS_ALL: [],
  SUCURSALES: [],

  SCENARIO_TRANSFORMS: {},

  // Vocabulario de entrada declarado por el negocio (ver tenants/demo.js). Vacío = el router arranca sin una sola
  // cuenta que reconocer, que es lo correcto mientras no hay empresa: reconocer nombres sería reconocer los de otro.
  clientesAlias: {},
  clientesAmbiguos: [],
});

/** ¿Este dataset es el hueco de arranque? Lo usa el store para responder `tenantCargado()`. */
export const esTenantVacio = (d) => !d || d === TENANT_VACIO || d.id === null;
