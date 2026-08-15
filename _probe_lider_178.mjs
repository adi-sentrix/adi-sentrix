/* ¿Por qué pasa «Lider — $17.8M»? El dato dice que Lider vende $17.9M; $17.8M es la venta de la MARCA LG.
 * Sonda OFFLINE, cero red, cero costo. */
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
const _ejes = (a) => { const o = []; for (const e of a) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { } } return o.length ? o : null; };
const CTX = {
  ledger: { figs: [] }, results: [], trace: null, question: "clientes bajo benchmark",
  datoProyectado: cifrasDelDato("actual"),
  entidadesDelTenant: _ejes(["cliente", "sku", "marca"]), duenosDelTenant: _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]),
  contentScope: "full", tablePolicy: "auto",
};
for (const [rot, t] of [
  ["la CIFRA DE OTRO DUEÑO (LG) puesta en Lider", "Lider — $17.8M en ventas · margen 21.5% (8.6 puntos bajo benchmark)."],
  ["la cifra CORRECTA de Lider", "Lider — $17.9M en ventas · margen 21.5% (8.6 puntos bajo benchmark)."],
  ["la de LG en su propio dueño", "LG — $17.8M en ventas."],
  ["una cifra que no existe en el dato", "Lider — $17.6M en ventas · margen 21.5%."],
  // LA HIPÓTESIS: un resultado ADOPTADO por el contrato de cálculo entra SIN DUEÑO, así que el chequeo que mata
  // la misma cifra suelta ya no la mira. Si esto PASA, el contrato de cálculo abre un hueco en la atribución.
  ["la MISMA cifra, pero adoptada por un cálculo que cierra",
    "Lider — $17.8M en ventas · margen 21.5%.\n\n[[CALCULO]]\nid=c1 · op=aplicar_pct · inputs=$17.3M; 3.0% · formula=$17.3M + 3.0% · resultado=$17.8M · unidad=money"],
]) {
  const v = guardC(t, CTX);
  console.log(`${v.ok ? "🔴 PASA" : "✅ muere (" + v.verdict + ")"}  ·  ${rot}`);
}
