/* === _viabilidad_escenario_gate.mjs · LA VIABILIDAD DEL ESCENARIO (owner 2026-08-14) =========================
 * LA REGLA, textual del owner: «si una simulación reduce una tasa o carga por más de lo disponible, ADI no puede
 * aplicar el efecto completo como si fuera posible. Carga actual 1.8%, reducción pedida 2.0pp: no puede quedar en
 * −0.2%. El máximo aplicable es 1.8pp, o ADI debe decir que el supuesto no aplica completo.»
 *
 * EL CASO MEDIDO (humo del 2026-08-14, Mercado Libre): la respuesta escribió «1.8% − 2pp = −0.2pp (no aplica,
 * carga insuficiente)» —lo NOTÓ— y a renglón seguido calculó «29.0% + 2pp = 31.0%», concluyendo que cruzaba el
 * benchmark. La aritmética cerraba; lo que fallaba era la VIABILIDAD. Es lo que separa a un asesor de una
 * calculadora, y por eso el owner lo pidió cerrado ANTES del examen ejecutivo.
 * CERO red, CERO .env. */
import { guardC } from "./src/adi/oracle/guardC.js";
import { MARCA_CALCULO } from "./src/adi/oracle/narrationBlocks.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`  ${c ? "✓" : "✗"} ${m}`); c ? pass++ : fail++; };
const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
const Q = "reduce en 2 puntos las acciones comerciales de esos clientes y dime si alguno queda sobre el benchmark";
const J = (t) => guardC(t, { ledger: { figs: [] }, results: [], trace: null, question: Q, supuestoPendiente: ["2pp"], datoProyectado: cifrasDelDato("actual"), entidadesDelTenant: ejes(["cliente", "sku", "marca"]), duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full", tablePolicy: "auto" });

/* Los textos van CON su bloque declarado, como en la conversación real: sin la declaración las cifras derivadas
 * mueren antes por «no autorizada» y el chequeo de viabilidad ni se ejercita. Lo que se prueba acá es que una
 * cuenta PERFECTAMENTE VERIFICADA igual se detiene cuando el supuesto no es posible. */
const CALC = (linea) => `\n\n${MARCA_CALCULO}\n${linea}`;

console.log("── 1 · EL CASO MEDIDO: el efecto completo sobre una carga que no da ──");
// Mercado Libre: carga 1.8%, margen 29.0%. Con −2pp completos el margen daría 31.0% y "cruzaría" el benchmark.
const INVIABLE = "Mercado Libre tiene margen 29.0% y su carga comercial es 1.8%. Con la baja de 2 puntos su margen proyectado sería 31.0%, cruzando el benchmark de 30.1%."
  + CALC("id=c1 · op=puntos · inputs=29.0%; 2 · formula=29.0% + 2pp · resultado=31.0% · unidad=pct · dueno=Mercado Libre");
const v1 = J(INVIABLE);
ok(!v1.ok && /escenario-inviable/.test(String(v1.verdict)), `el efecto completo sobre una carga insuficiente MUERE aunque la cuenta cierre (obtuvo ${v1.verdict})`);
ok(String((v1.violations.find((x) => x.kind === "escenario-inviable") || {}).detail || "").includes("1.8pp"),
  "la multa dice el TOPE REAL aplicable (1.8pp), no solo que está mal");

console.log("\n── 2 · LO QUE SÍ DEBE PASAR (la regla pide el tope, no el silencio) ──");
ok(J("Mercado Libre tiene margen 29.0% y su carga comercial es 1.8%: no puede bajar 2 puntos completos, el máximo aplicable es 1.8pp y con ese tope su margen llega a 30.8%."
  + CALC("id=c1 · op=puntos · inputs=29.0%; 1.8 · formula=29.0% + 1.8pp · resultado=30.8% · unidad=pct · dueno=Mercado Libre")).ok,
  "usar el TOPE REAL (margen 29.0% + carga 1.8pp = 30.8%) pasa");
ok(J("Falabella tiene margen 22.0% y carga comercial 4.5%. Con la baja de 2 puntos su margen proyectado sería 24.0%, todavía bajo el benchmark de 30.1%."
  + CALC("id=c1 · op=puntos · inputs=22.0%; 2 · formula=22.0% + 2pp · resultado=24.0% · unidad=pct · dueno=Falabella")).ok,
  "una entidad con carga SUFICIENTE (4.5% ≥ 2pp) no se toca: el escenario es viable");
ok(J("Jumbo tiene margen 24.0% y carga comercial 3.8%: con 2 puntos menos quedaría en 26.0%."
  + CALC("id=c1 · op=puntos · inputs=24.0%; 2 · formula=24.0% + 2pp · resultado=26.0% · unidad=pct · dueno=Jumbo")).ok,
  "otra entidad viable tampoco se veta (no hay falso positivo por vecindad)");

console.log("\n── 3 · LA TASA NEGATIVA EN EL CÁLCULO DECLARADO ──");
const NEG = `Mercado Libre bajaría su carga comercial a −0.2%.\n\n${MARCA_CALCULO}\nid=c1 · op=puntos · inputs=1.8%; 2 · formula=1.8% − 2pp · resultado=-0.2% · unidad=pct · dueno=Mercado Libre`;
const v3 = J(NEG);
ok(!v3.ok && /escenario-inviable/.test(String(v3.verdict)), `una tasa que queda NEGATIVA muere aunque la aritmética cierre (obtuvo ${v3.verdict})`);
const POS = `Falabella bajaría su carga comercial a 2.5%.\n\n${MARCA_CALCULO}\nid=c1 · op=puntos · inputs=4.5%; 2 · formula=4.5% − 2pp · resultado=2.5% · unidad=pct · dueno=Falabella`;
ok(J(POS).ok, "la misma operación con resultado viable pasa");

console.log("\n── 4 · SIN DELTA DEL USUARIO, EL CHEQUEO NO CORRE ──");
const sinDelta = guardC("Mercado Libre tiene margen 29.0% y carga comercial 1.8%.", { ledger: { figs: [] }, results: [], trace: null, question: "¿cómo viene Mercado Libre?", datoProyectado: cifrasDelDato("actual"), entidadesDelTenant: ejes(["cliente", "sku", "marca"]), duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full", tablePolicy: "auto" });
ok(sinDelta.ok, "una lectura sin simulación no se juzga por viabilidad");

console.log(`\n── _viabilidad_escenario_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
