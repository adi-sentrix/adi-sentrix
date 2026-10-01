/* === scripts/consolidacion/base.mjs · LA BASE DE LOS CONTROLES (consolidación, infraestructura común) ═══════════════════
 * Carga, desde una RAÍZ del repo (por defecto este mismo repo; con `--raiz` puede ser otro árbol: el control «antes» corre sobre un
 * árbol del commit anterior), los módulos que los generadores y los controles necesitan, e inicia el tenant demo. OFFLINE: solo
 * imports de archivos locales; ninguna llamada a un proveedor ni al gateway. */
import { pathToFileURL, fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

export const RAIZ_POR_DEFECTO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function cargarBase(raiz = RAIZ_POR_DEFECTO) {
  const U = (p) => import(pathToFileURL(join(raiz, p)).href);
  const [tenantStore, demo, esquema, validar, componer, verificar, lexico, estados, conjuntos, entityIndex, dato, scenarios, prioridadIntegrada, dominios] = await Promise.all([
    U("src/data/tenantStore.js"), U("src/data/tenants/demo.js"), U("src/adi/encargo/esquema.js"), U("src/adi/encargo/validar.js"),
    U("src/adi/entrega/componer.js"), U("src/adi/entrega/verificar.js"), U("src/adi/notario/lexico.js"), U("src/adi/notario/estados.js"),
    U("src/adi/notario/conjuntosDeLaCasa.js"), U("src/adi/oracle/entityIndex.js"), U("src/adi/oracle/datoProyectado.js"),
    U("src/config/scenarios.js"), U("src/adi/agente/prioridadIntegrada.js"), U("src/config/contract/dominios.js"),
  ]);
  tenantStore.initTenant(demo.TENANT_DEMO);
  /* la PROYECCIÓN del dato (la misma que lee el Notario): una vez por proceso */
  const proyeccion = dato.cifrasDelDato(scenarios.ESCENARIO_INICIAL);
  return { raiz, esquema, validar, componer, verificar, lexico, estados, conjuntos, entityIndex, proyeccion, prioridadIntegrada, dominios };
}
