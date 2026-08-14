/* ¿Qué sale a pantalla cuando el cerebro insiste dos veces con un texto VETADO (no vacío)?
 * La constitución dice «reincide → suplente digno». CERO red. */
import { responderConNotario } from "./src/adi/oracle/cicloNotarial.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
const juzgar = (t) => guardC(t, { ledger: { figs: [] }, results: [], trace: null, question: "¿cómo viene el negocio?", datoProyectado: cifrasDelDato("actual"), entidadesDelTenant: ejes(["cliente", "sku", "marca"]), duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full", tablePolicy: "auto" });

const INVENTO = "El negocio cerró con $777.7M de venta y un margen de 99.9%, muy por encima del benchmark.";
console.log("el texto del cerebro:", juzgar(INVENTO).ok ? "PASA (mal armado el probe)" : "🔴 VETADO → " + juzgar(INVENTO).verdict);

const r = await responderConNotario({
  pedir: async () => INVENTO,          // el cerebro insiste con lo mismo las dos veces
  juzgar,
  suplente: () => "SUPLENTE DIGNO: las cifras verificadas del negocio.",
});
console.log(`\nestado: ${r.estado} · suplenteDigno: ${r.suplenteDigno} · aprobado: ${r.aprobado}`);
console.log(`TEXTO QUE SALE A PANTALLA:\n  «${r.texto}»`);
console.log(`\n${r.texto === INVENTO ? "🔴 SALE EL TEXTO QUE EL NOTARIO RECHAZÓ DOS VECES — cifras inventadas a la pantalla" : "✅ sale el suplente digno"}`);
