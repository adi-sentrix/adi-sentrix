/* === scripts/consolidacion/base.mjs · LA BASE DE LOS CONTROLES (consolidación, infraestructura común) ═══════════════════
 * Carga, desde una RAÍZ del repo (por defecto este mismo repo; con `--raiz` puede ser otro árbol: el control «antes» corre sobre un
 * árbol del commit anterior), los módulos que los generadores y los controles necesitan, e inicia el tenant demo. OFFLINE: solo
 * imports de archivos locales; ninguna llamada a un proveedor ni al gateway. */
import { pathToFileURL, fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

export const RAIZ_POR_DEFECTO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function cargarBase(raiz = RAIZ_POR_DEFECTO) {
  const U = (p) => import(pathToFileURL(join(raiz, p)).href);
  const [tenantStore, demo, esquema, validar, componer, verificar, lexico, estados, conjuntos, entityIndex, dato, scenarios, prioridadIntegrada, dominios, specRetrieval] = await Promise.all([
    U("src/data/tenantStore.js"), U("src/data/tenants/demo.js"), U("src/adi/encargo/esquema.js"), U("src/adi/encargo/validar.js"),
    U("src/adi/entrega/componer.js"), U("src/adi/entrega/verificar.js"), U("src/adi/notario/lexico.js"), U("src/adi/notario/estados.js"),
    U("src/adi/notario/conjuntosDeLaCasa.js"), U("src/adi/oracle/entityIndex.js"), U("src/adi/oracle/datoProyectado.js"),
    U("src/config/scenarios.js"), U("src/adi/agente/prioridadIntegrada.js"), U("src/config/contract/dominios.js"), U("src/adi/specRetrieval.js"),
  ]);
  tenantStore.initTenant(demo.TENANT_DEMO);
  /* la PROYECCIÓN del dato (la misma que lee el Notario): una vez por proceso */
  const proyeccion = dato.cifrasDelDato(scenarios.ESCENARIO_INICIAL);
  /* EL DATO PUBLICADO (consolidación, segunda vuelta): qué publica el Core para (eje, concepto), independiente de las piezas de composición de la Entrega. Es la unión de (a) el group-by del
   * registro de métricas (`composeSpecRetrieval`: ventas, margen, capital, rotación, días de inventario, unidades en stock… por cada eje que el registro declara) y (b) los rankings de la
   * proyección (lo que lee el Notario: capital inmovilizado, días sin venta, saldo vencido…). Devuelve un Map(nombre normalizado → valor) o null si el Core no publica ese concepto en ese eje. */
  const _norm = (x) => String(x == null ? "" : x).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const _memo = new Map();
  const publica = (eje, clave) => {
    const k = `${eje}|${clave}`;
    if (_memo.has(k)) return _memo.get(k);
    const out = new Map();
    const m = esquema.metricaCoreDe(clave);
    /* EXCEPCIÓN DECLARADA (CLAUDE.md §4, «los dos universos que NO reconcilian»): las unidades por SKU tienen DOS fuentes en el dato de fábrica —skusMargen.unidades (el registro de métricas) y la venta del mes del inventario (la fila completa del SKU, que
     * el Marco declara «unidades vendidas en el período: … el mes que cubre el dato de inventario»)— que difieren entre 4x y 35x. Ninguna es «la» verdad de un cero: el control no las contrasta. Queda como pendiente de producto (el rótulo «Unidades vendidas» nombra dos campos). */
    if (m && esquema.productorDe(clave, eje) && !(clave === "unidades" && eje === "sku")) {
      let r = null; try { r = specRetrieval.composeSpecRetrieval({ metric: m, dimension: eje, scenario: scenarios.ESCENARIO_INICIAL }); } catch { r = null; }
      for (const row of (r && r.evidence && r.evidence.rows) || []) if (row && Number.isFinite(row.value)) out.set(_norm(row.name), row.value);
    }
    const rk = proyeccion && proyeccion.rankings && proyeccion.rankings[eje] && (proyeccion.rankings[eje][clave] || (eje === "sku" && clave === "margen" ? proyeccion.rankings[eje].margen_venta : null));
    for (const f of (rk && rk.filas) || []) if (f && Number.isFinite(f.valor) && !out.has(_norm(f.entidad))) out.set(_norm(f.entidad), f.valor);
    const res = out.size ? out : null;
    _memo.set(k, res);
    return res;
  };
  return { raiz, esquema, validar, componer, verificar, lexico, estados, conjuntos, entityIndex, proyeccion, prioridadIntegrada, dominios, publica, scenarios };
}
