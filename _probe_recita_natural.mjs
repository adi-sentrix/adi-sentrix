/* HIPÓTESIS: el brazo natural veta el $104.0M en los turnos 2-4 porque lo DERIVÓ Y MOSTRÓ en el turno 1, y
 * cada turno se juzga aislado. El camino vigente ya tiene el permiso para eso —la CUARTA fuente,
 * `boletaAnterior`: «re-citar lo que ADI misma ya mostró no es inventar»—, pero al brazo natural nadie se la
 * pasa. Se prueba pasándola. CERO red. */
import fs from "fs";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { parseFigures } from "./src/adi/boleta.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
const BASE = { ledger: { figs: [] }, results: [], trace: null, datoProyectado: cifrasDelDato("actual"), entidadesDelTenant: ejes(["cliente", "sku", "marca"]), duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full", tablePolicy: "auto" };
const h = JSON.parse(fs.readFileSync("_corrida_doble_h1h2.json", "utf8")).registro[0];

const supuestos = [];
let previa = null;   // las cifras que ADI YA MOSTRÓ en su respuesta anterior
for (let i = 0; i < h.B.length; i++) {
  const t = h.B[i];
  for (const pf of parseFigures(t.q)) supuestos.push(pf.text);
  const sin = guardC(t.texto, { ...BASE, question: t.q, supuestoPendiente: supuestos });
  const con = guardC(t.texto, { ...BASE, question: t.q, supuestoPendiente: supuestos, boletaAnterior: previa });
  console.log(`Q${i + 1} «${t.q.slice(0, 36)}»  SIN re-cita: ${sin.ok ? "🟢" : "🔴 " + sin.verdict}   ·   CON re-cita: ${con.ok ? "🟢 PASA" : "🔴 " + con.verdict}`);
  // la boleta anterior del camino natural son las cifras de su propio texto anterior (cap 24, igual que 1b)
  previa = { figs: parseFigures(t.texto).slice(0, 24).map((f) => ({ value: f.text })) };
}
