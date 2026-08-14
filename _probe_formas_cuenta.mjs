/* === _probe_formas_cuenta.mjs · LAS FORMAS NATURALES DE LA CUENTA, antes y después de la calibración =========
 * Diagnóstico que nació de los vetos de H1 en la mini doble (2026-08-14) y quedó como lupa.
 * DOS BLOQUES, y la diferencia entre ellos ES el punto: una cifra derivada vale por su CADENA. En una oración
 * suelta, «$104.0M» no tiene origen y el veto es CORRECTO; en la cascada donde se mostró de dónde sale, pasa.
 * CERO red, CERO .env. */
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
const CTX = { ledger: { figs: [] }, results: [], trace: null, question: "Si subo ventas 4%, ¿qué cambia?", datoProyectado: cifrasDelDato("actual"), entidadesDelTenant: ejes(["cliente", "sku", "marca"]), duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full", tablePolicy: "auto" };
const juzgar = (t) => guardC(t, CTX);
const P = (esperado, nombre, texto) => {
  const v = juzgar(texto);
  const bien = v.ok === (esperado === "PASA");
  console.log(`${bien ? "  " : "⚠️"} ${v.ok ? "🟢 PASA" : "🔴 VETA"} · ${nombre}${v.ok ? "" : " → " + String((v.violations[0] || {}).detail).slice(0, 60)}`);
};

const CADENA = "Ventas totales del negocio: $100.0M proyectados × 1.04 = $104.0M.";

console.log("── LA CIFRA HUÉRFANA · el veto es CORRECTO (nadie mostró de dónde sale el $104.0M) ──");
P("MUERE", "tasa sobre monto suelta", "Contribución del negocio: $104.0M proyectados × 25.1% = $26.1M.");
P("MUERE", "resta suelta", "Costo implícito del negocio: $104.0M proyectados − $26.1M = $77.9M.");

console.log("\n── LA MISMA FORMA, CON SU CADENA A LA VISTA · tiene que pasar ──");
P("PASA", "factor limpio", "Las ventas totales del negocio son $100.0M × 1.04 = $104.0M.");
P("PASA", "factor con palabra en medio", CADENA);
P("PASA", "tasa sobre monto, resultado último", `${CADENA} Contribución del negocio: $104.0M proyectados × 25.1% = $26.1M.`);
P("PASA", "resta con resultado último", `${CADENA} Contribución del negocio: $104.0M proyectados × 25.1% = $26.1M. El costo implícito queda en $104.0M proyectados − $26.1M = $77.9M.`);
P("PASA", "comparación vs presupuesto", `${CADENA} Esa proyección de $104.0M quedaría 7.2% sobre el presupuesto del negocio ($97.0M).`);

console.log("\n── LOS CONTROLES NEGATIVOS · la cuenta que NO cierra sigue muriendo ──");
P("MUERE", "factor con resultado mal", "Ventas totales del negocio: $100.0M proyectados × 1.04 = $121.0M.");
P("MUERE", "resta con resultado mal", `${CADENA} El costo implícito queda en $104.0M proyectados − $26.1M = $61.4M.`);
P("MUERE", "comparación con el % mal", `${CADENA} Esa proyección de $104.0M quedaría 19.4% sobre el presupuesto del negocio ($97.0M).`);
