/* === _prioridad_integrada_gate.mjs · LA PRIORIDAD INTEGRADA POR SEÑALES (owner 2026-09-14) ══════════════════════════
 * EL CASO PERMANENTE: el prompt de producción del encargo multidominio. La primera versión del cierre integrado ponía
 * primero a Falabella «porque coincide Comercial + Cobranza». El owner, textual: «Lider también coincide en ambos
 * dominios y su severidad conjunta parece mayor: tiene $1,5M de contribución no capturada y, además, $4,6M vencidos con
 * 269 días de atraso. Falabella tiene mayor brecha comercial ($1,6M), pero su vencido es $2,5M a solo 8 días.»
 *
 * LA REGLA DE PRODUCTO, textual: «Cuando ADI prioriza entre dominios, debe considerar materialidad + severidad + urgencia
 * de cada señal, no solo cuántos dominios coinciden.» Puede existir una prioridad por dominio (Falabella primero en
 * Comercial) y una prioridad integrada del negocio (Lider). «La prioridad final debe explicar su criterio. No quiero una
 * fórmula rígida inventada ni sumar magnitudes incompatibles; quiero que ADI use las señales comparables dentro de cada
 * dominio y después justifique cuál requiere atención primero.»
 *
 * EL ESTÁNDAR (prioridadIntegrada.js): tres lentes por dominio con señales de la boleta —materialidad (cuánto está en
 * juego), severidad (distancia a la referencia declarada), urgencia (la señal de tiempo)—; dentro del dominio, cada lente
 * ordena; entre dominios, señal por señal en los dominios que comparten (clave real: el cliente), nunca por suma de
 * montos; va antes quien es más grave en más señales, en empate la señal de tiempo, después lo que hay en juego;
 * coincidir en dos dominios agrava, no decide; los SKU (otra clave) se ordenan aparte; el criterio se dice con las
 * señales que decidieron. Lo usan el respaldo (cierre), la doctrina del encargo (la conclusión del procedimiento) y el
 * contrato (`prioridad-integrada-cambiada`: el cerebro la explica, no la cambia).
 *
 * Cero red: cerebro mudo, herramientas puras, fixtures en disco. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { LENTES, senalesDelDominio, prioridadIntegrada, componerPrioridadIntegrada, conclusionDePrioridad, prioridadIntegradaCambiada, CRITERIO } from "./src/adi/agente/prioridadIntegrada.js";
import { partesDelEncargo, doctrinaDelEncargo } from "./src/adi/agente/encargoCompuesto.js";
import { vetosDeRegistro } from "./src/adi/agente/contratoAgente.js";
import { pasosDeDominios } from "./src/adi/agente/contratoDeDominios.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
const CAJA = cajaDelAgente(TOOLS);
const MUDO = async (a) => { MUDO.llamadas.push(a); return { tipo: "texto", texto: "", stop: "end_turn" }; };
MUDO.llamadas = [];
initTenant(TENANT_DEMO);
const FX = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo-produccion-2026-09-14.json", import.meta.url), "utf8"));
const VIVO = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo-vivo-2026-09-14.json", import.meta.url), "utf8"));
const Q = FX.pregunta;
const DOMS = ["comercial", "inventario", "cobranza"];
const figsDe = (doms) => runPlan({ intent: "answer", calls: pasosDeDominios({ dominios: doms, eje: null }).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: Q, registry: CAJA }).ledger.figs || [];
const FIGS = figsDe(DOMS);

/* ═══ 1 · LAS LENTES Y LAS SEÑALES DE CADA DOMINIO ═══════════════════════════════════════════════════════════════ */
H("1 · tres lentes por dominio, con señales de la boleta: materialidad · severidad · urgencia");
{
  ok(["comercial", "cobranza", "inventario"].every((d) => LENTES[d] && LENTES[d].materialidad && LENTES[d].severidad), "cada dominio declara materialidad y severidad con su rótulo de la boleta");
  ok(LENTES.cobranza.urgencia && LENTES.inventario.urgencia && LENTES.comercial.urgencia === null, "cobranza e inventario tienen señal de tiempo (atraso · días sin venta); el comercial no la trae en este dato, y se declara");
  const com = senalesDelDominio(FIGS, "comercial"), cob = senalesDelDominio(FIGS, "cobranza"), inv = senalesDelDominio(FIGS, "inventario");
  ok(com.slice(0, 3).map((x) => x.entidad).join(">") === "Falabella>Lider>Jumbo", `comercial, por materialidad: ${com.slice(0, 3).map((x) => `${x.entidad} ${x.materialidad.fmt}`).join(" > ")}`);
  ok(com[0].severidad.fmt === "8.1 pp" && com[1].severidad.fmt === "8.6 pp" && com[1].severidad.rango < com[0].severidad.rango, "…y por severidad Lider va antes (8.6 pp contra 8.1 pp bajo el benchmark): materialidad y severidad no coinciden en el comercial");
  ok(cob.slice(0, 3).map((x) => x.entidad).join(">") === "Lider>Falabella>Sodimac", `cobranza, por materialidad: ${cob.slice(0, 3).map((x) => `${x.entidad} ${x.materialidad.fmt}`).join(" > ")}`);
  ok(cob[0].urgencia.fmt === "269d" && cob[0].urgencia.rango === 2 && cob[1].urgencia.fmt === "8d" && cob[1].urgencia.rango === 4 && cob[0].severidad.fmt === "45%" && cob[2].severidad.rango === 1, "…Lider 1º en vencido ($4.6M), 269d de atraso (2º: Easy tiene 270d pero no es material) y 45% recuperado; Falabella 2ª en vencido y 4ª en atraso (8d); Sodimac la más severa (35% recuperado)");
  ok(!prioridadIntegrada(FIGS, DOMS).integrada.some((c) => c.entidad === "Easy"), "…y Easy, con el atraso más viejo (270d) pero sin materialidad en ningún dominio, no entra a la lista integrada: la urgencia matiza, no sube a la lista por sí sola");
  ok(inv.slice(0, 3).map((x) => x.entidad).join(">") === "LG-DRYER8KG>BOS-SANDER>MAK-COMP-AIR" && !inv.some((x) => /Valpara[ií]so|Antofagasta/.test(x.entidad)), "inventario, por materialidad: LG-DRYER8KG > BOS-SANDER > MAK-COMP-AIR — las bodegas no son entidades de la prioridad");
  ok(inv[0].urgencia && inv[0].urgencia.fmt === "94d" && inv.find((x) => x.entidad === "MAK-COMP-AIR").severidad.rango === 1, "…con sus lentes: LG-DRYER8KG 94d sin venta; MAK-COMP-AIR el más severo en días de inventario (190d)");
}

/* ═══ 2 · LA PRIORIDAD INTEGRADA, SEÑAL POR SEÑAL ═══════════════════════════════════════════════════════════════ */
H("2 · la prioridad integrada: Lider antes que Falabella por señales, no por «coincide en dos dominios»");
{
  const P = prioridadIntegrada(FIGS, DOMS);
  ok(P.porDominio.comercial[0].entidad === "Falabella" && P.porDominio.cobranza[0].entidad === "Lider" && P.porDominio.inventario[0].entidad === "LG-DRYER8KG", "★ prioridad POR DOMINIO: comercial → Falabella · cobranza → Lider · inventario → LG-DRYER8KG");
  ok(P.integrada.map((c) => c.entidad).join(">") === "Lider>Falabella>Sodimac>Jumbo", `★ prioridad INTEGRADA del negocio: ${P.integrada.map((c) => c.entidad).join(" > ")}`);
  const v = P.integrada[0].versus;
  ok(v.contra === "Falabella" && v.gana.length === 4 && v.pierde.length === 1 && v.pierde[0].nombre === "contribución sin capturar", `…Lider es más grave que Falabella en ${v.gana.map((x) => x.nombre).join(", ")}; Falabella solo la supera en ${v.pierde.map((x) => x.nombre).join(", ")}`);
  ok(v.gana.some((x) => x.nombre === "atraso" && x.a === "269d" && x.b === "8d") && v.gana.some((x) => x.nombre === "vencido" && x.a === "$4.6M" && x.b === "$2.5M"), "…con las cifras de la boleta (269d contra 8d · $4.6M contra $2.5M)");
  ok(P.integrada[0].dominios.length === 2 && P.integrada[1].dominios.length === 2, "las dos coinciden en dos dominios: la coincidencia no fue lo que decidió");
  const s = P.integrada[2].versus;
  ok(s.contra === "Jumbo" && s.gana.length === s.pierde.length && s.tiempo.a === "251d de atraso" && s.tiempo.b === null, "Sodimac antes que Jumbo por la señal de tiempo (251d de atraso; Jumbo sin vencido), con las demás señales parejas");
  ok(/no por suma de montos/.test(CRITERIO) && /coincidir en dos dominios agrava, no decide/.test(CRITERIO), "el criterio, en palabras: señal por señal, no por suma de montos; coincidir agrava, no decide");
  /* transversal: con dos dominios también funciona, y sin cobranza la integrada es la del comercial */
  const P2 = prioridadIntegrada(figsDe(["comercial", "cobranza"]), ["comercial", "cobranza"]);
  ok(P2.integrada[0].entidad === "Lider" && !P2.porDominio.inventario, "comercial + cobranza: Lider primero también, sin inventario en la lista");
  const P3 = prioridadIntegrada(figsDe(["comercial", "inventario"]), ["comercial", "inventario"]);
  ok(P3.integrada[0].entidad === "Falabella" && P3.porDominio.inventario[0].entidad === "LG-DRYER8KG", "comercial + inventario: sin cobranza no hay señal de tiempo entre las cuentas → manda la materialidad (Falabella), y el inventario va aparte (LG-DRYER8KG)");
}

/* ═══ 3 · EL RESPALDO LO DICE, CON EL CRITERIO ═══════════════════════════════════════════════════════════════════ */
H("3 · el cierre del respaldo, con cerebro mudo, sobre el prompt de producción");
{
  MUDO.llamadas = [];
  const r = await answerViaAgente({ text: Q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
  const t = r.r.text;
  const cierre = t.slice(t.indexOf("Dónde pondría el foco primero"));
  ok(r.r.agente.estado === "encargo-compuesto" && cierre.length > 100, `el turno lo responde el ensamblador (${r.r.agente.estado}) y cierra con la prioridad`);
  ok(/Por dominio: comercial → Falabella \(\$1\.6M sin capturar, 8\.1 pp bajo el benchmark\); Lider \$1\.5M sin capturar y más lejos de la referencia \(8\.6 pp contra 8\.1 pp\)/.test(cierre), "★ la prioridad por dominio: Falabella primero en comercial, con el matiz de Lider (más lejos del benchmark)");
  ok(/cobranza → Lider \(\$4\.6M vencidos, 45% recuperado, 269d de atraso\); Sodimac \$1\.9M vencidos y más lejos de la referencia \(35% contra 45%\)/.test(cierre) && /inventario → LG-DRYER8KG \(\$14K frenados, 165d de inventario, 94d sin venta\); MAK-COMP-AIR \$8K frenados y más lejos de la referencia \(190d contra 165d\) y más urgente \(112d contra 94d\)/.test(cierre), "…cobranza → Lider (con Sodimac más severa como matiz) · inventario → LG-DRYER8KG (con MAK-COMP-AIR más severo y más urgente como matiz): la materialidad manda, las otras lentes matizan");
  ok(/^1\. Lider — /m.test(cierre) && /antes que Falabella: más grave en comercial, distancia al benchmark \(8\.6 pp contra 8\.1 pp\); en cobranza, vencido \(\$4\.6M contra \$2\.5M\), recuperado \(45% contra 57\.7%\), atraso \(269d contra 8d\); Falabella solo la supera en comercial, contribución sin capturar \(\$1\.6M contra \$1\.5M\)/.test(cierre), "★ la integrada abre con Lider y dice por qué, señal por señal, con las cifras");
  ok(/^2\. Falabella — /m.test(cierre) && /^3\. Sodimac — .*antes que Jumbo por la señal de tiempo \(251d de atraso; Jumbo sin señal de tiempo\)/m.test(cierre), "…Falabella segunda, Sodimac tercera por la señal de tiempo");
  ok(/En inventario \(clave SKU: no se compara con las cuentas\): LG-DRYER8KG primero/.test(cierre), "…el inventario entra aparte, con su clave, sin compararse con las cuentas");
  ok(/El comercial no trae señal de tiempo en este dato/.test(cierre) && /^Criterio: dentro de cada dominio, materialidad/m.test(cierre), "…declara la lente que falta y dice el criterio");
  ok(!/coinciden en la misma cuenta|coincidencia/.test(cierre) && !/\bsuman\b|\bsuma\b(?! de montos)/.test(cierre), "sin el criterio viejo («coinciden en la misma cuenta») y sin sumar montos (la única «suma» es la negada del criterio)");
  ok(r.r.agente.vetos.length === 0, "y pasa el muro, el contrato y la notarial", JSON.stringify(r.r.agente.vetos).slice(0, 200));
  /* lo que recibe el cerebro: la conclusión del procedimiento, antes de escribir */
  const contenidos = (MUDO.llamadas[0] ? MUDO.llamadas[0].mensajes : []).map((m) => String(m.content || ""));
  const de = contenidos.find((c) => c.startsWith("[ENCARGO COMPUESTO"));
  ok(de && /\[PRIORIDAD DEL PROCEDIMIENTO — no es el usuario\] Se conserva; el cerebro la explica, no la cambia/.test(de) && /1º Lider · 2º Falabella · 3º Sodimac/.test(de) && /Lider va antes que Falabella porque es más grave en distancia al benchmark \(8\.6 pp contra 8\.1 pp\), vencido/.test(de), "★ el cerebro recibe la prioridad del procedimiento (por dominio e integrada) con sus razones, antes de escribir");
  ok(de && /materialidad \(cuánto está en juego\), severidad \(distancia a la referencia declarada\) y urgencia \(la señal de tiempo\)/.test(de) && !/primero la cuenta donde coinciden dos dominios/.test(de), "…y la doctrina del encargo pide la prioridad por dominio y la integrada con este criterio, ya no «coincide en dos dominios»");
  ok(doctrinaDelEncargo(partesDelEncargo("Dime cómo va el negocio, qué está explicando el resultado, qué clientes presionan más el margen, qué puedes demostrar y qué harías primero."), ["comercial"], FIGS).includes("[PRIORIDAD DEL PROCEDIMIENTO") === true, "en un encargo de un solo dominio la prioridad del procedimiento también viaja (la del comercial)");
}

/* ═══ 4 · LA LEY: LA PRIORIDAD INTEGRADA ES DEL PROCEDIMIENTO ════════════════════════════════════════════════════ */
H("4 · «prioridad-integrada-cambiada»: el cerebro la explica, no la cambia — calibrada con el borrador vivo");
{
  const b2 = VIVO.borradores[1].texto;
  ok(!prioridadIntegradaCambiada(b2, FIGS, DOMS), "★ el borrador vivo del modelo, que puso a Lider primero por su cuenta, pasa");
  ok(!vetosDeRegistro(b2, { pregunta: Q, figs: FIGS, sitio: "cierre" }).some((x) => x.regla === "prioridad-integrada-cambiada"), "…también por vetosDeRegistro (sitio cierre)");
  const conFalabella = b2.replace(/es \*\*Lider\*\*: es la única cuenta[^.]*\./, "es **Falabella**: la mayor brecha comercial.").replace("Lider concentra el peor cruce", "Sodimac concentra el peor cruce");
  const m = prioridadIntegradaCambiada(conFalabella, FIGS, DOMS);
  ok(m && /la prioridad integrada del procedimiento es Lider/.test(m) && /antes que Falabella: más grave en distancia al benchmark, 8\.6 pp contra 8\.1 pp; vencido, \$4\.6M contra \$2\.5M/.test(m), "★ el mismo borrador poniendo primero a Falabella arde, con las razones del procedimiento en la multa", String(m).slice(0, 200));
  ok(vetosDeRegistro(conFalabella, { pregunta: Q, figs: FIGS, sitio: "cierre" }).some((x) => x.regla === "prioridad-integrada-cambiada"), "…y la cobra vetosDeRegistro al cerebro");
  ok(!vetosDeRegistro(conFalabella, { pregunta: Q, figs: FIGS, sitio: "playbook:cruce-por-sku" }).some((x) => x.regla === "prioridad-integrada-cambiada"), "…no a los peldaños de abajo");
  ok(!prioridadIntegradaCambiada(FX.respuesta_observada.texto, FIGS, DOMS), "un texto que no dice ninguna prioridad no la «cambia» (eso lo cobra la cobertura del encargo)");
  ok(!vetosDeRegistro(conFalabella, { pregunta: "¿Qué harías primero con Falabella?", figs: FIGS, sitio: "cierre" }).some((x) => x.regla === "prioridad-integrada-cambiada"), "una pregunta simple no tiene esta ley");
  ok(!vetosDeRegistro("Primero Lider: es la cuenta más grave en cobranza y de las que más contribución dejan sin capturar.", { pregunta: Q, figs: FIGS, sitio: "cierre" }).some((x) => x.regla === "prioridad-integrada-cambiada"), "una prioridad dicha a la manera del modelo, con Lider primero, pasa");
}

/* ═══ 5 · EL ESTÁNDAR EN EL TEXTO DEL MÓDULO Y EN LA LEY ═════════════════════════════════════════════════════════ */
H("5 · el estándar está escrito donde vive");
{
  const src = fs.readFileSync(new URL("./src/adi/agente/prioridadIntegrada.js", import.meta.url), "utf8");
  ok(/materialidad \+ severidad \+[\s*]*urgencia/.test(src) && /no solo cuántos dominios coinciden/.test(src), "el módulo cita la regla de producto del owner");
  ok(/Lo que NO se hace: umbrales inventados/.test(src), "…y lo que no se hace: umbrales inventados, fórmulas opacas, sumar magnitudes de dominios distintos");
  const cons = fs.readFileSync(new URL("./_CONSTITUCION_ADI.md", import.meta.url), "utf8");
  ok(/prioridad integrada por señales/i.test(cons), "la Constitución tiene la ley");
  const comp = componerPrioridadIntegrada(FIGS, DOMS);
  ok(comp === conclusionDePrioridad(FIGS, DOMS) ? false : /^1\. Lider — /m.test(comp), "el cierre y la conclusión al cerebro salen de la misma prioridad (una sola verdad)");
}

/* ═══ 6 · LA CORRIDA EN VIVO DEL ESTÁNDAR, COMO FIXTURE: EL MODELO LO CUMPLIÓ Y LO TUMBARON DOS FALSOS POSITIVOS ══ */
H("6 · la corrida viva (autorizada, 2 llamadas): el modelo puso a Lider primero por señales; cayó por «motor de ventas» y «casi el doble» — cerrados");
{
  const V2 = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo-vivo2-2026-09-14.json", import.meta.url), "utf8"));
  ok(V2.pregunta === Q && V2.borradores.length === 2 && V2.final.estado === "encargo-compuesto", "la corrida: el prompt exacto, dos borradores, y el usuario recibió el respaldo");
  const b2 = V2.borradores[1].texto;
  ok(/\*\*Lider va primero\*\*: brecha al benchmark más severa \(8\.6 pp contra 8\.1 pp de Falabella\)/.test(b2) && /Falabella solo le gana en contribución no capturada en pesos \(\$1\.6M vs \$1\.5M\)/.test(b2), "★ el modelo, por su cuenta y con la doctrina, puso a Lider primero señal por señal y dijo en qué gana Falabella");
  ok(/en comercial, Falabella \(\$1\.6M de contribución no capturada, la mayor brecha en pesos\)/.test(b2) && /En inventario, aparte de las cuentas: LG-DRYER8KG/.test(b2), "…mantuvo a Falabella como prioridad comercial y el inventario aparte");
  ok(!prioridadIntegradaCambiada(b2, FIGS, DOMS) && !vetosDeRegistro(b2, { pregunta: Q, figs: FIGS, sitio: "cierre" }).length, "★ el borrador reparado pasa hoy el contrato entero: «el motor de ventas está sano» y «los tres motores del crecimiento» ya no son voz de sistema");
  const { guardC } = await import("./src/adi/oracle/guardC.js");
  const { cifrasDelDato } = await import("./src/adi/oracle/datoProyectado.js");
  const { playbookPara, pasosDe } = await import("./src/adi/agente/playbooks/registro.js");
  const { pasosDelEncargo } = await import("./src/adi/agente/encargoCompuesto.js");
  const pb = playbookPara(Q, {});
  const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(Q), pb ? pasosDe(pb, Q, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: Q, registry: CAJA });
  const v = guardC(b2, { ledger: { figs: rp.ledger.figs }, results: rp.results, question: Q, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), contentScope: "full" });
  ok(v.ok, "…y el muro entero", (v.violations || []).map((x) => x.kind).join(","));
  /* el camino del modelo, offline, con ese borrador como cerebro: se sirve VERDE a la primera */
  const r = await answerViaAgente({ text: Q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: b2, stop: "end_turn" }) });
  ok(r.r.agente.estado === "verde" && r.r.text === b2, `★ con el borrador vivo como cerebro, el turno se sirve entero y verde (${r.r.agente.estado}): el usuario recibe la lectura del modelo`, JSON.stringify(r.r.agente.vetos).slice(0, 200));
  /* los dos cierres, con sus candados */
  const reg = (t) => vetosDeRegistro(t, { pregunta: "x", figs: [] }).map((x) => x.regla);
  ok(!reg("El motor de ventas está sano y los tres motores del crecimiento son Lider, Jumbo y Falabella.").includes("lexico-voz-de-motor") && !reg("Lo que el motor de crecimiento muestra es sano.").includes("lexico-voz-de-motor"), "«motor de ventas» / «motores del crecimiento» / «motor de crecimiento»: metáfora de negocio, no voz de sistema");
  ok(reg("El motor detecta 3 SKU frenados.").includes("lexico-voz-de-motor") && reg("Según el procedimiento, Falabella va primero.").includes("lexico-voz-de-motor") && reg("Lo que el motor muestra es capital frenado.").includes("lexico-voz-de-motor"), "candados: «el motor detecta», «según el procedimiento», «lo que el motor muestra» siguen ardiendo");
  const { relacionEnPalabrasNoCierra } = await import("./src/adi/agente/atributosYRelaciones.js");
  ok(!relacionEnPalabrasNoCierra("brecha al benchmark más severa (8.6 pp contra 8.1 pp de Falabella), vencido casi el doble ($4.6M vs $2.5M), peor recuperación."), "★ «casi el doble ($4.6M vs $2.5M)» se juzga contra el par que compara: 1.84 veces, pasa — antes ardía contra los 8.1 pp de al lado");
  const mFalso = relacionEnPalabrasNoCierra("brecha al benchmark más severa (8.6 pp contra 8.1 pp de Falabella), vencido casi el doble ($4.6M vs $4.2M).");
  ok(mFalso && /\$4\.6M contra \$4\.2M son 1\.1 veces/.test(mFalso), "…y con un par que no cierra ($4.6M vs $4.2M) arde citando ESE par");
  ok(!!relacionEnPalabrasNoCierra("PHI-SHAVER9 tiene una cobertura de 15 días. Ahí no hay problema. PHI-IRON-PRO tiene 95 días — cuatro veces más lenta.") && !!relacionEnPalabrasNoCierra("Falabella vende $19.4M, más del doble que Lider ($17.8M)."), "candados: «cuatro veces» (6.3×) y «más del doble» (1.1×) siguen ardiendo");
}

/* ═══ 7 · LA TERCERA CORRIDA VIVA: «LÍDER» CON TILDE, EL SUJETO ELIDIDO Y «LA SUPERA» ════════════════════════════ */
H("7 · la tercera corrida viva (autorizada, 2 llamadas): la reparación cumplió los cinco puntos y cayó por tres falsos positivos — cerrados");
{
  const V3 = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo-vivo3-2026-09-14.json", import.meta.url), "utf8"));
  ok(V3.pregunta === Q && V3.borradores.length === 2 && V3.final.estado === "encargo-compuesto", "la corrida: el prompt exacto, dos borradores, y el usuario recibió el respaldo");
  const b3 = V3.borradores[1].texto;
  ok((b3.match(/Líder/g) || []).length >= 10 && !/\bLider\b/.test(b3), "el modelo escribió «Líder» con tilde en todas sus apariciones (el dato dice «Lider»)");
  ok(/\*\*Líder primero\*\*\. Es más grave que Falabella en distancia al benchmark \(8\.6 pp contra 8\.1 pp\), en vencido \(\$4\.6M contra \$2\.5M\)/.test(b3) && /Falabella solo la supera en contribución no capturada \(\$1\.6M contra \$1\.5M\)/.test(b3), "★ …y cumplió los cinco puntos: Lider primero señal por señal, Falabella solo la supera en contribución");
  ok(!prioridadIntegradaCambiada(b3, FIGS, DOMS), "★ la ley de prioridad reconoce «Líder» con tilde como Lider: ya no arde");
  const { guardC } = await import("./src/adi/oracle/guardC.js");
  const { cifrasDelDato } = await import("./src/adi/oracle/datoProyectado.js");
  const { playbookPara, pasosDe } = await import("./src/adi/agente/playbooks/registro.js");
  const { pasosDelEncargo } = await import("./src/adi/agente/encargoCompuesto.js");
  const pb = playbookPara(Q, {});
  const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(Q), pb ? pasosDe(pb, Q, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: Q, registry: CAJA });
  const muro = (t) => { const v = guardC(t, { ledger: { figs: rp.ledger.figs }, results: rp.results, question: Q, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), contentScope: "full" }); return v.ok ? [] : (v.violations || []); };
  ok(muro(b3).length === 0, "★ el muro entero: «8.6 pp contra 8.1 pp» con Lider como sujeto de la oración anterior, y «la supera» entre cuentas, ya no arden", muro(b3).map((x) => x.kind + ": " + String(x.detail).slice(0, 90)).join(" | "));
  ok(!vetosDeRegistro(b3, { pregunta: Q, figs: rp.ledger.figs, sitio: "cierre" }).length, "…y el contrato entero");
  const r = await answerViaAgente({ text: Q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: b3, stop: "end_turn" }) });
  ok(r.r.agente.estado === "verde" && r.r.text === b3, `★ con esa reparación como cerebro, el turno se sirve entero y verde (${r.r.agente.estado})`, JSON.stringify(r.r.agente.vetos).slice(0, 200));
  /* los candados que no aflojan */
  const ardeM = (t, kind) => muro(t).some((x) => x.kind === kind);
  ok(ardeM("Lider vende $19.4M.", "cifra-de-boleta-sin-dueno") && ardeM("Falabella lidera la venta con diferencia y sostiene la mayor parte del canal retail durante todo el año cerrado, mientras que Lider vende $19.4M.", "cifra-de-boleta-sin-dueno"), "candados: «Lider vende $19.4M» (de Falabella) sigue ardiendo, con el dueño cerca o lejos");
  ok(ardeM("PHI-HAIR-PRO y PHI-SHAVER9 son el mejor caso de la lista — lideran contribución con diferencia sobre el resto del catálogo, sostienen margen sin pedir capital y tienen cobertura corta (15 días y 19 días).", "cifra-de-boleta-sin-dueno"), "candado: la coordinación invertida sigue ardiendo (la del sujeto elidido solo libera, no condena)");
  ok(!ardeM("Lider tiene el mayor vencido. Falabella vende $19.4M contra $17.8M de Lider.", "cifra-de-boleta-sin-dueno"), "«Falabella vende $19.4M contra $17.8M de Lider»: cada cifra con su dueño, libre");
  ok(!ardeM("Lider tiene el mayor vencido de la cartera. Es más grave que Falabella en distancia al benchmark (8.6 pp contra 8.1 pp).", "cifra-de-boleta-sin-dueno"), "el sujeto elidido: «Lider … . Es más grave que Falabella … (8.6 pp contra 8.1 pp)» — 8.6 pp es de Lider, libre");
  ok(ardeM("Sodimac vende $8.2M. Es más grave que Falabella en distancia al benchmark (8.6 pp contra 8.1 pp).", "cifra-de-boleta-sin-dueno"), "…y con otro sujeto en la oración anterior (Sodimac) el mismo par sigue ardiendo: la lectura no condona una atribución equivocada");
  ok(!ardeM("Falabella está 8.1 pp bajo el benchmark; Falabella solo la supera en contribución no capturada ($1.6M contra $1.5M).", "relacion-contradictoria"), "«Falabella solo la supera en contribución» no es «Falabella supera el benchmark»");
  ok(ardeM("Falabella supera el benchmark con su margen de 22.0%.", "relacion-contradictoria"), "candado: «Falabella supera el benchmark» (está 8.1 pp bajo) sigue ardiendo");
}

console.log(`\n── _prioridad_integrada_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
