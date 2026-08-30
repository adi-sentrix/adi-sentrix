/* === _una_sola_carpeta_gate.mjs · UN SOLO FACT PACK PARA LOS DOS ENTORNOS (owner 2026-08-15) =================
 * «No quiero seguir midiendo si la app y la consola le dan al cerebro carpetas distintas. Eso contamina los
 * resultados. Necesito una sola carpeta/fact pack para ambos entornos.»
 *
 * EL DEFECTO QUE FIJA, medido: la app arrancaba en `"bonanza"` (literal en App.jsx) y la consola del examen en
 * `"actual"` (literal suyo). **«actual» no es un escenario declarado**: no tiene entrada en SCENARIO_TRANSFORMS,
 * así que caía al dato crudo sin ajustar. Consecuencias verificadas:
 *   · venta total $99.9M (app) vs $100.0M (consola);
 *   · el KPI de inventario («capital total $135K · 48d · inmovilizado 41.3% ($56K)») existía en la app y NO en la
 *     consola, porque sale de `SCENARIO_TRANSFORMS[id].kpis.inventario` y con «actual» eso es null.
 * O sea: dos exámenes enteros describieron un negocio que la app nunca mostró.
 *
 * LO QUE FIJA: una sola declaración (`ESCENARIO_INICIAL`), los dos entornos leyéndola, y que el escenario elegido
 * SEA uno declarado. CERO red, CERO .env. */
import { readFileSync } from "node:fs";
import { SCENARIOS, SCENARIO_TRANSFORMS, ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { deriveKpis } from "./src/engine/scenarios.js";
import { proyectarDatoNegocio, cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`  ${c ? "✓" : "✗"} ${m}`); c ? pass++ : fail++; };

console.log("── 1 · EL ESCENARIO INICIAL ES UNO DECLARADO ──");
ok(!!SCENARIOS[ESCENARIO_INICIAL], `«${ESCENARIO_INICIAL}» está en SCENARIOS (los declarados: ${Object.keys(SCENARIOS).join(", ")})`);
ok(!!(SCENARIO_TRANSFORMS && SCENARIO_TRANSFORMS[ESCENARIO_INICIAL]), "…y tiene transform del tenant: no cae al dato crudo sin ajustar");
ok(!SCENARIOS.actual && !(SCENARIO_TRANSFORMS || {}).actual,
  "…y «actual», el string que usaba la consola, NO es un escenario declarado (era el agujero)");

console.log("\n── 2 · LOS DOS ENTORNOS LEEN LA MISMA DECLARACIÓN, NINGUNO ESCRIBE EL SUYO ──");
{
  const app = readFileSync("./src/ui/App.jsx", "utf8");
  const consola = readFileSync("./_consola_examen.mjs", "utf8");
  ok(/import \{[^}]*ESCENARIO_INICIAL[^}]*\} from ".*config\/scenarios\.js"/.test(app), "App.jsx importa ESCENARIO_INICIAL");
  // COLAPSO DEL EJE (owner 2026-08-07, ejecutado 2026-08-30): el escenario dejó de ser ESTADO — es una
  // CONSTANTE desde la misma declaración. La propiedad que este gate guarda (app y consola arrancan de la
  // única fuente, jamás de un literal) se volvió más fuerte: ya no hay ni un setter que pudiera moverla.
  ok(/const scenario = ESCENARIO_INICIAL/.test(app), "…y corre sobre él como CONSTANTE, no con un literal ni un setter");
  ok(/import \{[^}]*ESCENARIO_INICIAL[^}]*\} from ".*config\/scenarios\.js"/.test(consola), "la consola del examen importa la MISMA declaración");
  const literalesApp = (app.match(/useState\("(?:bonanza|tension|crisis|actual)"\)/g) || []);
  const literalesConsola = (consola.match(/(?:scenario:|proyectarDatoNegocio\(|cifrasDelDato\()\s*"(?:bonanza|tension|crisis|actual)"/g) || []);
  ok(literalesApp.length === 0, `App.jsx no fija un escenario a mano${literalesApp.length ? " — encontrado: " + literalesApp.join(", ") : ""}`);
  ok(literalesConsola.length === 0, `la consola no fija un escenario a mano${literalesConsola.length ? " — encontrado: " + literalesConsola.join(", ") : ""}`);
}

console.log("\n── 3 · LA CARPETA ES LA MISMA · las seis cosas que el owner pidió alinear ──");
{
  const t = proyectarDatoNegocio(ESCENARIO_INICIAL);
  const c = cifrasDelDato(ESCENARIO_INICIAL);
  const k = deriveKpis(ESCENARIO_INICIAL);
  ok(/Ventas totales: \$[\d.]+M/.test(t), `misma VENTA TOTAL: ${(t.match(/Ventas totales: \$[\d.]+M/) || [])[0]}`);
  ok(!!k.inventario && /Inventario \(foto de hoy\)/.test(t), "mismos KPI DE INVENTARIO: el escenario los trae y la carpeta los emite");
  ok(/Capital inmovilizado \(categoría AMPLIA\)/.test(t) && /Frenado \(estado CRÍTICO/.test(t), "…con las dos métricas definidas por el owner (amplia y crítica)");
  ok((c.figs || []).length > 0 && (c.figs || []).every((f) => Array.isArray(f.duenos) && f.duenos.length), "mismos DUEÑOS: toda cifra de la carpeta trae los suyos");
  ok((c.figs || []).every((f) => f.universo), "mismos UNIVERSOS: toda cifra trae el suyo");
  const est = new Set((c.estados || []).map((e) => e.estado));
  ok(est.has("frenado") && est.has("inmovilizado"), `mismos ESTADOS: ${[...est].join(", ")}`);
  ok(/PROHIBIDO cruzarlos/.test(t) && /LOS DOS UNIVERSOS QUE NO RECONCILIAN/.test(t), "mismo CONTRATO: la carpeta lleva la divergencia declarada");
}

console.log("\n── 4 · Y LA CARPETA ES DETERMINÍSTICA: dos lecturas, byte por byte iguales ──");
ok(proyectarDatoNegocio(ESCENARIO_INICIAL) === proyectarDatoNegocio(ESCENARIO_INICIAL), "misma llamada → mismo texto (el caché del proveedor depende de esto)");

console.log(`\n── _una_sola_carpeta_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
