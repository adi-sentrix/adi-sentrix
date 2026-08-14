/* === _probe_typos_notario.mjs · LA GRIETA DE LOS TYPOS (owner 2026-08-14): el narrador normaliza la intención,
 * el notario verifica la respuesta YA normalizada. Tres costuras, contra el notario real. CERO red, CERO .env. */
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const ejes = (a) => { const o = []; for (const e of a) for (const n of axisEntityNames(e)) o.push(n); return o; };
const CTX = { ledger: { figs: [] }, results: [], trace: null, datoProyectado: cifrasDelDato("actual"), entidadesDelTenant: ejes(["cliente", "sku", "marca"]), duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full", tablePolicy: "auto" };

// A · usuario con typos («falabela», «benckmark») → narrador responde canónico → el notario juzga LO NORMALIZADO
const a = guardC("Falabella vende $19.4M con margen 22.0%, bajo tu benchmark de 30.1%.", { ...CTX, question: "cuanto vende falabela y como va contra el benckmark" });
console.log("A (typos en la ENTRADA, salida canónica):", a.ok ? "🟢 PASA" : "🔴 " + a.verdict);

// B · el narrador REPITE el typo en la SALIDA → el registro canónico se exige en pantalla
const b = guardC("falabela vende $19.4M con margen 22.0%, bajo tu benchmark de 30.1%.", { ...CTX, question: "cuanto vende falabela" });
console.log("B (typo EN LA SALIDA):", b.ok ? "🟠 pasó — revisar" : "🔴 muere → " + b.verdict);

// C · LA COSTURA FINA: «2 putnos» — ¿el 2 que el usuario tipeó respalda la fórmula mostrada?
const c = guardC("Interpreto 2 puntos porcentuales: la carga comercial de Falabella marca 4.5%, y 4.5% − 2.0pp = 2.5%.", { ...CTX, question: "baja 2 putnos la carga de falabela" });
console.log("C (typo en la UNIDAD del supuesto):", c.ok ? "🟢 PASA" : "🔴 " + c.verdict + " · " + (c.violations[0] ? c.violations[0].detail.slice(0, 120) : ""));
