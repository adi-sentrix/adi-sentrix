/* Sonda OFFLINE: juzga el borrador que el examen guardó en _examen_debug_t*.json con EXACTAMENTE el mismo
 * contexto que arma caminoNatural, y lista TODAS las violaciones. Cero red, cero .env, cero costo. */
import fs from "node:fs";
import { guardC } from "./src/adi/oracle/guardC.js";
import { extraerCalculos } from "./src/adi/oracle/narrationBlocks.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { alcanceHeredadoDe } from "./src/adi/oracle/cicloNotarial.js";
import { parseFigures } from "./src/adi/boleta.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const T = process.argv[2] || "2";
const D = JSON.parse(fs.readFileSync(`_examen_debug_t${T}.json`, "utf8"));
const S = JSON.parse(fs.readFileSync("_examen_estado.json", "utf8"));
const _ejes = (a) => { const o = []; for (const e of a) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { } } return o.length ? o : null; };
const ENT = _ejes(["cliente", "sku", "marca"]), DUE = _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]);
const catalogoPorEje = {}; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { catalogoPorEje[e] = axisEntityNames(e); } catch { } }
const sup = [];
for (const h of S.history) if (h.role === "user") for (const pf of parseFigures(h.text)) sup.push(pf.text);
for (const pf of parseFigures(D.q)) sup.push(pf.text);
const her = alcanceHeredadoDe({ pregunta: D.q, respuestaAnterior: S.turnos[0] ? S.turnos[0].visible : null, catalogoPorEje });
const rec = S.mem && S.mem.recitaAprobada && S.mem.recitaAprobada.figs && S.mem.recitaAprobada.figs.length ? S.mem.recitaAprobada : null;

for (const it of D.intentos) {
  const v = guardC(it.borrador, {
    ledger: { figs: [] }, results: [], trace: null, question: D.q,
    supuestoPendiente: sup, alcanceHeredado: her, recitaAprobada: rec,
    datoProyectado: cifrasDelDato("actual"), entidadesDelTenant: ENT, duenosDelTenant: DUE,
    contentScope: "full", tablePolicy: "auto",
  });
  const ex = extraerCalculos(it.borrador);
  console.log(`\n═══ INTENTO ${it.intento} · ${v.ok ? "PASA" : v.verdict} · ${ex.calculos.length} cálculos, ${ex.malformadas.length} líneas rotas`);
  for (const x of (v.violations || [])) console.log(`  · [${x.kind}] ${x.detail}`);
}
