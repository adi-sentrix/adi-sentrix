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
import { partesDelEncargo, doctrinaDelEncargo, coberturaDelEncargo, esEncargoCompuesto } from "./src/adi/agente/encargoCompuesto.js";
import { vetosDeRegistro } from "./src/adi/agente/contratoAgente.js";
import { pasosDeDominios, dominiosDe } from "./src/adi/agente/contratoDeDominios.js";
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
  ok(de && /\[PRIORIDAD DEL PROCEDIMIENTO — no es el usuario\] El usuario NO fijó criterio\. La jerarquía: \(1\) si lo fija, manda; \(2\) si se lee en su pregunta, se interpreta; \(3\)/.test(de) && /1º Lider · 2º Falabella · 3º Sodimac/.test(de) && /Lider va antes que Falabella porque es más grave en distancia al benchmark \(8\.6 pp contra 8\.1 pp\), vencido/.test(de), "★ el cerebro recibe la prioridad del procedimiento (por dominio e integrada) con sus razones y la JERARQUÍA del criterio (el usuario no fijó ninguno: la ejecutiva de la casa, declarada)");
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
  ok(!m, "★ sin criterio del usuario, el mismo borrador poniendo primero a Falabella «por contribución» (criterio declarado) YA NO arde: la prioridad no es universal — es la lectura ejecutiva con su criterio (jerarquía 4)", String(m).slice(0, 160));
  const sinCriterioDicho = b2.slice(0, b2.indexOf("**Dónde pondría el foco primero**")) + "Dónde pondría el foco primero: Falabella — es la cuenta más grande.";
  const m2 = prioridadIntegradaCambiada(sinCriterioDicho, FIGS, DOMS);
  ok(m2 && /sin declarar bajo qué criterio/.test(m2) && /por riesgo integrado, Lider/.test(m2), "…pero poner primero a Falabella SIN declarar el criterio arde: «declara el criterio en el cierre»", String(m2).slice(0, 200));
  const m3 = prioridadIntegradaCambiada(conFalabella, FIGS, DOMS, { criterio: "riesgo", modo: "explicito" });
  ok(m3 && /fijó el criterio «riesgo integrado» y bajo ese criterio va primero Lider/.test(m3), "…y con el criterio explícito «prioriza riesgo», Falabella primero arde: el criterio del usuario manda", String(m3).slice(0, 200));
  ok(vetosDeRegistro(conFalabella, { pregunta: Q + " Prioriza riesgo.", figs: FIGS, sitio: "cierre" }).some((x) => x.regla === "prioridad-integrada-cambiada"), "…y la cobra vetosDeRegistro al cerebro cuando la pregunta fija el criterio");
  ok(!vetosDeRegistro(conFalabella, { pregunta: Q + " Prioriza riesgo.", figs: FIGS, sitio: "playbook:cruce-por-sku" }).some((x) => x.regla === "prioridad-integrada-cambiada"), "…no a los peldaños de abajo");
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
  /* LOS TRES FALSOS POSITIVOS SIGUEN CERRADOS; LO QUE QUEDA ES UN ERROR REAL QUE ENTONCES NADIE VIO (auditoría del Notario, owner 2026-09-14,
   * familia C): «markup promedio 41.4% contra 57.3% en Easy, La Polar, Hites» — el 57.3% es el promedio de los CINCO sanos (faltan ABC y
   * Unimarc). Es la misma afirmación que la auditoría registró en el cierre de la prueba 2 (P2·1). El turno ya no sirve esa reparación entera. */
  ok(!muro(b3).some((x) => x.kind === "cifra-de-boleta-sin-dueno" || x.kind === "cifra-de-dato-sin-dueno" || x.kind === "relacion-contradictoria"), "★ «8.6 pp contra 8.1 pp» con Lider como sujeto de la oración anterior, y «la supera» entre cuentas, ya no arden", muro(b3).map((x) => x.kind + ": " + String(x.detail).slice(0, 90)).join(" | "));
  ok(muro(b3).map((x) => x.kind).join(",") === "cifra-de-grupo-mal-repartida" && /«57\.3%».*3 nombres \(Easy, La Polar, Hites\) — quedan fuera: ABC, Unimarc/.test(String(muro(b3)[0].detail)), "…y del muro solo queda el error real de la auditoría: «57.3% en Easy, La Polar, Hites» reparte a tres el promedio de cinco sanos", muro(b3).map((x) => x.kind + ": " + String(x.detail).slice(0, 90)).join(" | "));
  ok(!vetosDeRegistro(b3, { pregunta: Q, figs: rp.ledger.figs, sitio: "cierre" }).length, "…y el contrato entero");
  const r = await answerViaAgente({ text: Q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: b3, stop: "end_turn" }) });
  ok(r.r.agente.estado !== "verde" && r.r.agente.vetos.some((v) => /«57\.3%»/.test(String(v))) && r.r.text.split(/\s+/).length >= 400, `★ con esa reparación como cerebro, el turno ya NO se sirve verde: el 57.3% repartido se detiene y el usuario recibe una respuesta completa (${r.r.agente.estado}, ${r.r.text.split(/\s+/).length} palabras)`, JSON.stringify(r.r.agente.vetos).slice(0, 200));
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

/* ═══ 8 · EL SEGUNDO CASO PERMANENTE: «EL MAYOR RIESGO ECONÓMICO» — EL CIERRE INTEGRADO VA SIEMPRE ══════════════════ */
H("8 · segundo prompt de producción: pide el mayor riesgo con sus palabras — el cierre integrado va siempre y ninguna prioridad local sobrevive como global");
{
  const FX2 = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo-produccion2-2026-09-14.json", import.meta.url), "utf8"));
  const Q2 = FX2.pregunta;
  ok(/mayor riesgo económico/.test(Q2) && /debería preocuparme primero/.test(Q2) && /prioritario/.test(Q2) && !/\bprioridad\b|har[ií]as primero|pondr[ií]as el foco/.test(Q2), "el prompt pide la decisión con sus palabras: «mayor riesgo», «debería preocuparme primero», «prioritario» — sin «prioridad» ni «qué harías primero»");
  const partes2 = partesDelEncargo(Q2);
  ok(partes2.map((p) => p.clave).join(",") === "foto,cruce-sku,inventario,cobranza,sello,primero", `★ la parte «primero» se reconoce (${partes2.map((p) => p.clave).join(" → ")})`);
  for (const f of ["¿Dónde está hoy el mayor riesgo del negocio, qué lo explica y qué puedes demostrar?", "Mira ventas y cobranza: qué cliente debería preocuparme, qué está probado y qué es lo más grave.", "Cruza inventario y ventas y dime qué SKU merece atención primero, por qué y qué no sabes."])
    ok(partesDelEncargo(f).some((p) => p.clave === "primero"), `…y también «${f.slice(0, 60)}…»`);
  MUDO.llamadas = [];
  const r = await answerViaAgente({ text: Q2, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
  const t = r.r.text;
  const cierre = t.slice(t.indexOf("Dónde pondría el foco primero"));
  ok(r.r.agente.estado === "encargo-compuesto" && t.indexOf("Dónde pondría el foco primero") > 0, `★ el respaldo cierra con la prioridad integrada (${r.r.agente.estado})`);
  ok(/^1\. Lider — /m.test(cierre) && /antes que Falabella/.test(cierre) && /Por dominio: comercial → Falabella/.test(cierre) && /En inventario \(clave SKU/.test(cierre), "★ …Lider primero por señales; Falabella sigue como prioridad comercial; el inventario aparte");
  ok(!/criterio mío|Yo mirar[ií]a primero|entrar[ií]a por Falabella|Si fuera mi decisi[oó]n/.test(t), "★ ninguna prioridad local («Yo miraría primero Falabella —criterio mío—») sobrevive en la lectura");
  ok(t.trimEnd().endsWith("agrava, no decide.") , "…y la lectura termina en el criterio de la prioridad integrada, no en una oferta de una parte");
  ok(r.r.agente.vetos.length === 0, "pasa muro, contrato y notarial", JSON.stringify(r.r.agente.vetos).slice(0, 200));
  const de = (MUDO.llamadas[0] ? MUDO.llamadas[0].mensajes : []).map((m) => String(m.content || "")).find((c) => c.startsWith("[ENCARGO COMPUESTO"));
  ok(de && /\[PRIORIDAD DEL PROCEDIMIENTO/.test(de) && /1º Lider · 2º Falabella/.test(de), "★ el cerebro recibe la misma conclusión (modelo, reparación y respaldo comparten la prioridad)");
  /* la ley: el CIERRE con la prioridad local arde; con Lider en el cierre, pasa */
  const F2 = figsDe(DOMS);
  const conLocal = t.replace(/\n\nDónde pondría el foco primero[\s\S]*$/, "") + "\n\n" + FX2.cierre_observado;
  const { criterioDeLaPregunta: _crit } = await import("./src/adi/agente/prioridadIntegrada.js");
  const m = prioridadIntegradaCambiada(conLocal, F2, DOMS, _crit(Q2) || {});   // el criterio se lee en la pregunta: riesgo (implícito)
  ok(m && /pidió \(con sus palabras\) el criterio «riesgo integrado» y bajo ese criterio va primero Lider/.test(m), "★ la respuesta observada en producción (cierra con «Yo miraría primero Falabella —criterio mío—») arde: el criterio se lee en la pregunta (mayor riesgo) y bajo él va primero Lider", String(m).slice(0, 160));
  ok(vetosDeRegistro(conLocal, { pregunta: Q2, figs: F2, sitio: "cierre" }).some((x) => x.regla === "prioridad-integrada-cambiada"), "…también por vetosDeRegistro, sin que el encargo diga «prioridad» (dos o más dominios bastan)");
  ok(!prioridadIntegradaCambiada(conLocal + "\n\nIntegrando las señales, Lider va primero: $4.6M vencidos a 269 días y 8.6 pp bajo el benchmark.", F2, DOMS), "…y si el cierre nombra a Lider, pasa aunque antes haya dicho la prioridad comercial de Falabella");
  ok(!prioridadIntegradaCambiada("Por dominio: en comercial partiría por Falabella. Integrando, pondría Lider primero.\n\nEn inventario, LG-DRYER8KG primero.", F2, DOMS), "un cierre de inventario después del integrado no cambia la conclusión (el último párrafo con prioridad global es el que nombra a Lider… o el de inventario, que no compite con las cuentas)");
}

/* ═══ 9 · LA CORRIDA VIVA DEL SEGUNDO CASO: VERDE EN UNA LLAMADA, Y EL NOTARIO VERIFICA LA MISMA PRIORIDAD ═══════ */
H("9 · el segundo prompt en vivo (autorizado, 1 llamada): el modelo terminó en Lider por señales; modelo y respaldo comparten la conclusión");
{
  const V = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo2-vivo-2026-09-14.json", import.meta.url), "utf8"));
  const FX2 = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo-produccion2-2026-09-14.json", import.meta.url), "utf8"));
  const tv = V.final.texto;
  ok(V.pregunta === FX2.pregunta && V.final.estado === "verde" && V.llamadas === 1, "la corrida: el prompt exacto, verde en una llamada");
  ok(/es \*\*Lider\*\*/.test(tv) && /\*\*Lider es la prioridad integrada\*\*/.test(tv) && /Va primero que Falabella no por el monto de contribución/.test(tv), "★ el modelo abre con Lider como el mayor riesgo y lo explica por severidad y urgencia, no por el monto");
  ok(/Coincidir en cobranza vencida y margen deprimido agrava el caso, no lo decide por sí solo/.test(tv), "…y dice que coincidir agrava, no decide");
  ok(/Comercial: Falabella encabeza por monto/.test(tv) && /Inventario: LG-DRYER8KG/.test(tv), "…Falabella sigue como prioridad comercial y el inventario va aparte");
  const F2 = figsDe(DOMS);
  ok(!prioridadIntegradaCambiada(tv, F2, DOMS) && !vetosDeRegistro(tv, { pregunta: FX2.pregunta, figs: F2, sitio: "cierre" }).length, "★ el Notario verifica la misma prioridad: la ley pasa sobre el texto servido (agente y Notario avanzan juntos)");
  /* AUDITORÍA DEL NOTARIO (owner 2026-09-14): lo servido dice «269 días y 45% de recuperación es la señal más urgente de la cartera» — el
   * mismo superlativo que la auditoría declaró FALSO en la prueba 2 («la más urgente en cobranza (269 días vencidos)»: Easy tiene 270). Con los
   * rankings de cobranza declarados, el muro lo verifica y el turno ya no se sirve verde; la ley de prioridad y el contrato siguen pasando. */
  const r = await answerViaAgente({ text: FX2.pregunta, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: tv, stop: "end_turn" }) });
  ok(r.r.agente.estado !== "verde" && JSON.stringify(r.r.agente.vetos).includes("«la señal más urgente» en dias vencido") && JSON.stringify(r.r.agente.vetos).includes("Easy (270d"), `…y con ese texto como cerebro el turno ya NO se sirve verde (${r.r.agente.estado}): «la señal más urgente de la cartera» con 269 días es falsa — Easy tiene 270 (error de orden real, auditoría 2026-09-14)`, JSON.stringify(r.r.agente.vetos).slice(0, 200));
}

/* ═══ 10 · EL CRITERIO DEL USUARIO MANDA: LA JERARQUÍA (owner 2026-09-14, corrección del estándar) ═══════════════════ */
H("10 · la jerarquía del criterio: explícito manda · implícito se interpreta · ambiguo se puede preguntar · ejecutivo se entrega con el criterio declarado");
{
  const { criterioDeLaPregunta, ordenPorCriterio, primerosPorCriterio, CRITERIOS } = await import("./src/adi/agente/prioridadIntegrada.js");
  const { playbookPara } = await import("./src/adi/agente/playbooks/registro.js");
  const FX2 = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo-produccion2-2026-09-14.json", import.meta.url), "utf8"));
  /* 1 · explícito */
  const expl = [["Prioriza ventas y dime por dónde parto.", "ventas"], ["Ahora ordénamelo por caja.", "caja"], ["Quiero recuperar contribución: ¿qué cuenta primero?", "contribucion"], ["Prioriza riesgo.", "riesgo"], ["Con la lente de cobranza, ¿quién primero?", "caja"], ["ahora por contribución", "contribucion"], ["Prioriza margen.", "contribucion"], ["ordénamelo por crecimiento", "crecimiento"], ["quiero liberar capital: ¿qué SKU primero?", "capital"]];
  for (const [q, c] of expl) { const r = criterioDeLaPregunta(q); ok(r && r.criterio === c && r.modo === "explicito", `explícito: «${q}» → ${c}`, JSON.stringify(r)); }
  /* 2 · implícito: solo el riesgo (en un encargo, «riesgo de cobranza» o «dejo contribución sobre la mesa» son partes, no el criterio) */
  ok(criterioDeLaPregunta(FX2.pregunta) && criterioDeLaPregunta(FX2.pregunta).criterio === "riesgo" && criterioDeLaPregunta(FX2.pregunta).modo === "implicito", "implícito: «el mayor riesgo económico… qué debería preocuparme» → riesgo integrado, sin preguntar");
  ok(criterioDeLaPregunta(Q) === null, "★ el primer prompt de producción (menciona «riesgo de cobranza» como PARTE) no fija criterio: lectura ejecutiva general");
  ok(criterioDeLaPregunta("Mira el negocio y dime qué harías primero.") === null && criterioDeLaPregunta("¿Cómo va el negocio?") === null, "sin objetivo dicho no hay criterio");
  /* los órdenes bajo cada lente: los mismos hechos, otra prioridad */
  const P1 = primerosPorCriterio(FIGS, DOMS);
  ok(P1.riesgo.entidad === "Lider" && P1.caja.entidad === "Lider" && P1.crecimiento.entidad === "Lider", `por riesgo integrado, cobranza y crecimiento: Lider primero`);
  ok(P1.contribucion.entidad === "Falabella" && P1.ventas.entidad === "Falabella" && P1.capital.entidad === "LG-DRYER8KG", `★ por contribución y por ventas: Falabella primero; por capital: LG-DRYER8KG — Lider no es una prioridad universal`);
  ok(ordenPorCriterio(FIGS, DOMS, "caja").lista.slice(0, 3).map((x) => x.entidad).join(">") === "Lider>Falabella>Sodimac" && ordenPorCriterio(FIGS, DOMS, "contribucion").lista.slice(0, 3).map((x) => x.entidad).join(">") === "Falabella>Lider>Jumbo", "…con sus listas: cobranza Lider > Falabella > Sodimac · contribución Falabella > Lider > Jumbo");
  ok(CRITERIOS.caja.nombre === "cobranza", "la lente de caja se NOMBRA «cobranza» en pantalla (la palabra «caja» junto a una contribución dispara la naturaleza económica del muro)");
  /* el respaldo bajo cada modo, con cerebro mudo */
  const corre = async (q) => { MUDO.llamadas = []; const r0 = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO }); const r = r0.r; const t = r.text; return { r, t, cierre: t.slice(Math.max(0, t.indexOf("Dónde pondría el foco primero"))), doctrina: (MUDO.llamadas[0] ? MUDO.llamadas[0].mensajes : []).map((m) => String(m.content || "")).find((c) => c.startsWith("[ENCARGO COMPUESTO")) || "" }; };
  const a = await corre(Q);
  ok(a.r.agente.estado === "encargo-compuesto" && /criterio ejecutivo de ADI, porque no fijaste otro: riesgo integrado/.test(a.cierre) && /^1\. Lider — /m.test(a.cierre), "★ sin criterio (prompt 1): la prioridad ejecutiva de ADI —riesgo integrado— DECLARADA como tal, Lider primero", a.cierre.slice(0, 160));
  ok(/Con otra lente cambia quién va primero: por contribución, Falabella primero \(\$1\.6M sin capturar\); por ventas, Falabella primero/.test(a.cierre) && /Dime por cuál quieres que lo reordene/.test(a.cierre), "…y dice que con otra lente cambia quién va primero (contribución → Falabella) y ofrece reordenar");
  ok(/El usuario NO fijó criterio\. La jerarquía/.test(a.doctrina) && /puedes preguntarle qué lente quiere/.test(a.doctrina) && /Si eliges otra lente, decláralo/.test(a.doctrina), "…y el cerebro recibe la jerarquía entera: puede elegir otra lente declarándola, o preguntar si es realmente ambiguo");
  const b = await corre(FX2.pregunta);
  ok(b.r.agente.estado === "encargo-compuesto" && /por riesgo integrado, el criterio que se lee en tu pregunta/.test(b.cierre) && /^1\. Lider — /m.test(b.cierre), "★ implícito (prompt 2): «por riesgo integrado, el criterio que se lee en tu pregunta», Lider primero", b.cierre.slice(0, 160));
  ok(/El criterio se lee en la pregunta del usuario: riesgo integrado/.test(b.doctrina), "…y el cerebro lo recibe como criterio leído, no como elección propia");
  const c = await corre(Q + " Prioriza contribución.");
  ok(c.r.agente.estado === "encargo-compuesto" && /por contribución, el criterio que pediste/.test(c.cierre) && /^1\. Falabella — \$1\.6M sin capturar/m.test(c.cierre) && /^2\. Lider — \$1\.5M sin capturar/m.test(c.cierre), "★ explícito («prioriza contribución») sobre el mismo encargo: Falabella primero — el criterio del usuario manda sobre el riesgo integrado", c.cierre.slice(0, 200));
  ok(/por riesgo integrado, Lider primero/.test(c.cierre) && !/\bel orden\b/.test(c.cierre), "…y dice que por riesgo integrado sería Lider (sin la palabra «orden», que el muro lee como ranking)");
  ok(/El usuario fijó el criterio: contribución/.test(c.doctrina) && /1º Falabella/.test(c.doctrina), "…y el cerebro recibe ese criterio como conclusión que conserva");
  ok(a.r.agente.vetos.length === 0 && b.r.agente.vetos.length === 0 && c.r.agente.vetos.length === 0, "los tres pasan muro, contrato y notarial", [a, b, c].map((x) => JSON.stringify(x.r.agente.vetos).slice(0, 80)).join(" | "));
  /* el cambio de criterio en un turno siguiente: los mismos hechos, otra prioridad (playbook prioridad-por-lente) */
  ok((playbookPara("Ahora ordénamelo por caja.", {}) || {}).nombre === "prioridad-por-lente" && (playbookPara("Prioriza ventas: ¿qué cuenta va primero?", {}) || {}).nombre === "prioridad-por-lente", "«ahora ordénamelo por caja» y «prioriza ventas» los atiende el playbook prioridad-por-lente");
  ok((playbookPara(Q, {}) || {}).nombre === "cruce-por-sku" && (playbookPara(Q + " Prioriza contribución.", {}) || {}).nombre === "cruce-por-sku", "…que se retira en un encargo compuesto (ahí el criterio va por el ensamblador)");
  const d = await corre("Ahora ordénamelo por caja.");
  ok(d.r.agente.estado === "playbook" && /Ordenado bajo el criterio que fijaste — cobranza/.test(d.t) && /por cobranza, el criterio que pediste/.test(d.t) && /^1\. Lider — \$4\.6M vencidos, 269d de atraso/m.test(d.t) && /^2\. Falabella — \$2\.5M vencidos, 8d de atraso/m.test(d.t), "★ «ahora ordénamelo por caja» → Lider > Falabella > Sodimac por cobranza, los mismos hechos", d.t.slice(0, 200));
  ok(/Con otra lente cambia quién va primero: por contribución, Falabella primero/.test(d.t) && d.r.agente.vetos.length === 0, "…con la nota de la otra lente, y pasa el Notario");
  const e = await corre("Prioriza ventas: ¿qué cuenta va primero?");
  ok(e.r.agente.estado === "playbook" && /por ventas, el criterio que pediste/.test(e.t) && /^1\. Falabella — \$19\.4M de venta/m.test(e.t) && /por riesgo integrado, Lider primero/.test(e.t), "★ «prioriza ventas» → Falabella primero por venta, y dice que por riesgo integrado sería Lider");
  /* la ley por criterio */
  const { prioridadIntegradaCambiada: ley } = await import("./src/adi/agente/prioridadIntegrada.js");
  const cierraCon = (ent, crit) => `Lectura.\n\nDónde pondría el foco primero: ${ent} — ${crit}.`;
  ok(!ley(cierraCon("Falabella", "por contribución, la mayor brecha comercial"), FIGS, DOMS, {}), "sin criterio: Falabella primero «por contribución» (criterio declarado) pasa");
  ok(/sin declarar bajo qué criterio/.test(ley(cierraCon("Falabella", "es la cuenta más grande"), FIGS, DOMS, {}) || ""), "sin criterio: Falabella primero sin declarar el criterio arde");
  ok(/no pone primero a quien va primero bajo ninguna lente/.test(ley(cierraCon("Jumbo", "por criterio propio"), FIGS, DOMS, {}) || ""), "sin criterio: Jumbo primero (primero bajo ninguna lente) arde");
  ok(!ley("Lectura.\n\nHay dos prioridades posibles: Lider por riesgo, Falabella por contribución. ¿Con qué criterio quieres que lo ordene?", FIGS, DOMS, {}), "sin criterio: preguntar qué lente usar (jerarquía 3) pasa");
  ok(/fijó el criterio «contribución» y bajo ese criterio va primero Falabella/.test(ley(cierraCon("Lider", "por riesgo"), FIGS, DOMS, { criterio: "contribucion", modo: "explicito" }) || ""), "explícito contribución: Lider primero arde — el criterio del usuario manda");
  ok(!ley(cierraCon("Falabella", "por contribución"), FIGS, DOMS, { criterio: "contribucion", modo: "explicito" }), "explícito contribución: Falabella primero pasa");
  ok(/pidió \(con sus palabras\) el criterio «riesgo integrado» y bajo ese criterio va primero Lider/.test(ley(cierraCon("Falabella", "por contribución"), FIGS, DOMS, { criterio: "riesgo", modo: "implicito" }) || ""), "implícito riesgo: Falabella primero arde");
  ok(vetosDeRegistro(cierraCon("Lider", "por riesgo"), { pregunta: Q + " Prioriza contribución.", figs: FIGS, sitio: "cierre" }).some((x) => x.regla === "prioridad-integrada-cambiada"), "…y vetosDeRegistro lee el criterio de la pregunta del encargo");
  ok(!vetosDeRegistro(cierraCon("Lider", "por riesgo"), { pregunta: Q + " Prioriza contribución.", figs: FIGS, sitio: "playbook:cruce-por-sku" }).length, "…no a los peldaños de abajo");
}

/* ═══ 11 · LA LECTURA EJECUTIVA DE LOS DATOS (prueba 2 del owner): el negocio entero, con la prioridad que se lee en la pregunta ═ */
H("11 · «Hazme una lectura ejecutiva de estos datos… qué debería preocuparme más y dónde pondrías el foco primero»: todos los dominios, Lider por riesgo (implícito), criterio declarado");
{
  const { esLecturaEjecutiva } = await import("./src/adi/agente/partesDelEncargo.js");
  const { criterioDeLaPregunta } = await import("./src/adi/agente/prioridadIntegrada.js");
  const { playbookPara } = await import("./src/adi/agente/playbooks/registro.js");
  const Q3 = "Hazme una lectura ejecutiva de estos datos. Dime qué debería preocuparme más y dónde pondrías el foco primero.";
  ok(esLecturaEjecutiva(Q3) && !esEncargoCompuesto(Q3), "es una lectura ejecutiva de los datos (no enumera tres preguntas, pide el negocio entero)");
  ok(dominiosDe(Q3).dominios.join(",") === "comercial,inventario,cobranza", "★ participan todos los dominios que el dato trae, aunque no los nombre");
  ok(partesDelEncargo(Q3).map((p) => p.clave).join(",") === "foto,inventario,cobranza,primero", "★ las partes: la foto, el inventario, la cobranza y la prioridad");
  ok((playbookPara(Q3, {}) || {}).nombre === "resumen-del-negocio", "la foto del negocio es su paraguas (el cruce por SKU no la toma)");
  ok(criterioDeLaPregunta(Q3) && criterioDeLaPregunta(Q3).criterio === "riesgo" && criterioDeLaPregunta(Q3).modo === "implicito", "«qué debería preocuparme más» → riesgo integrado, leído de la pregunta");
  MUDO.llamadas = [];
  const r0 = await answerViaAgente({ text: Q3, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
  const t = r0.r.text, cierre = t.slice(Math.max(0, t.indexOf("Dónde pondría el foco primero")));
  ok(r0.r.agente.estado === "encargo-compuesto" && /^Lectura conjunta de comercial, inventario y cobranza/.test(t), `★ el respaldo: una lectura conjunta de los tres dominios (${r0.r.agente.estado})`, t.slice(0, 100));
  ok(/El negocio está creciendo/.test(t) && /capital inmovilizado/.test(t) && /Cobranza, al corte declarado por la mesa/.test(t), "…con la foto, el inventario y la cobranza cruzada por cliente");
  ok(/por riesgo integrado, el criterio que se lee en tu pregunta/.test(cierre) && /^1\. Lider — /m.test(cierre) && /Por dominio: comercial → Falabella/.test(cierre) && /En inventario \(clave SKU/.test(cierre), "★ cierra con Lider primero por riesgo integrado —criterio declarado como leído de la pregunta—, Falabella comercial, inventario aparte");
  ok(/Con otra lente cambia quién va primero: por contribución, Falabella primero/.test(cierre), "…y dice que con otra lente cambia quién va primero");
  ok(!/criterio mío|Yo mirar[ií]a primero|entrar[ií]a por Falabella|Si fuera mi decisi[oó]n/.test(t) && coberturaDelEncargo(t, partesDelEncargo(Q3)).length === 0 && r0.r.agente.vetos.length === 0, "ninguna prioridad local sobrevive, cobertura completa, sin vetos", JSON.stringify(r0.r.agente.vetos).slice(0, 160));
  const de = (MUDO.llamadas[0] ? MUDO.llamadas[0].mensajes : []).map((m) => String(m.content || "")).find((c) => c.startsWith("[ENCARGO COMPUESTO"));
  ok(de && /El criterio se lee en la pregunta del usuario: riesgo integrado/.test(de) && /1º Lider · 2º Falabella/.test(de), "★ el cerebro recibe la misma conclusión y el mismo criterio: modelo, reparación y respaldo comparten hechos y lógica");
  ok(/foto,porque,quienes,primero/.test(partesDelEncargo("Mira el negocio completo como si fueras mi asesor. Dime qué está bien, qué te preocupa, por qué, cuánto dinero está en juego y dónde actuarías primero.").map((p) => p.clave).join(",")), "«el negocio completo» de la batería 2.27 no cambia: sigue siendo la foto comercial (la lectura ejecutiva se acota a «estos datos»)");
}

/* ═══ 12 · LAS DOS PRUEBAS DEL OWNER EN VIVO (v2.31): AMBAS «PODADO» — EL CRITERIO DE ÉXITO ES LO QUE RECIBE EL USUARIO ═ */
H("12 · las dos pruebas vivas de la v2.31 (autorizadas, 2 llamadas cada una): dos falsos positivos cerrados, los vetos legítimos se quedan, y lo servido cumple");
{
  const V5 = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo-vivo5-2026-09-14.json", import.meta.url), "utf8"));
  const LE = JSON.parse(fs.readFileSync(new URL("./fixtures/lectura-ejecutiva-vivo-2026-09-14.json", import.meta.url), "utf8"));
  const { criterioDeLaPregunta } = await import("./src/adi/agente/prioridadIntegrada.js");
  const { guardC } = await import("./src/adi/oracle/guardC.js");
  const { cifrasDelDato } = await import("./src/adi/oracle/datoProyectado.js");
  const { playbookPara, pasosDe } = await import("./src/adi/agente/playbooks/registro.js");
  const { pasosDelEncargo } = await import("./src/adi/agente/encargoCompuesto.js");
  ok(V5.pregunta === Q && V5.final.estado === "podado" && LE.final.estado === "podado" && V5.borradores.length === 2 && LE.borradores.length === 2, "las dos corridas: el prompt exacto, dos borradores, y el usuario recibió el texto del modelo con una parte quitada por el Notario (podado)");
  const muroDe = (pregunta) => {
    const pb = playbookPara(pregunta, {});
    const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
    return { rp, muro: (t) => { const v = guardC(t, { ledger: { figs: rp.ledger.figs }, results: rp.results, question: pregunta, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), contentScope: "full" }); return v.ok ? [] : (v.violations || []); } };
  };
  /* ── prueba 1: la reparación era correcta y cayó por «(8.6 pp contra 8.1 pp de Falabella)» ── */
  const M1 = muroDe(Q);
  const rep = V5.borradores[1].texto;
  ok(/Falabella es la mayor brecha de contribución sin capturar \(\$1\.6M\), y Lider es la cuenta con peores indicadores de cobranza \(269 días, 45% recuperado, \$4\.6M vencidos\) y la mayor distancia al benchmark de margen \(8\.6 pp contra 8\.1 pp de Falabella\)/.test(rep), "la frase: «Falabella es la mayor brecha… ($1.6M), y Lider es la cuenta con… (8.6 pp contra 8.1 pp de Falabella)» — dos cláusulas, cada cifra con su dueño");
  ok(M1.muro(rep).length === 0 && !vetosDeRegistro(rep, { pregunta: Q, figs: M1.rp.ledger.figs, sitio: "reparacion" }).length, "★ ya no arde: la distributiva solo reparte entre entidades COORDINADAS entre sí; con dos sujetos manda el sujeto de la cláusula (8.6 pp es de Lider)", M1.muro(rep).map((x) => x.kind + ": " + String(x.detail).slice(0, 90)).join(" | "));
  const r5 = await answerViaAgente({ text: Q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: rep, stop: "end_turn" }) });
  ok(r5.r.agente.estado === "verde" && r5.r.text === rep, `★ con esa reparación como cerebro, el turno se sirve entero y verde (${r5.r.agente.estado}): el usuario recibe la lectura del modelo`, JSON.stringify(r5.r.agente.vetos).slice(0, 200));
  const ardeD = (t) => M1.muro(t).some((x) => x.kind === "cifra-de-boleta-sin-dueno");
  const largo = " —que son las dos cuentas más grandes del canal retail y las que más pesan en la contribución del año cerrado, con diferencia sobre el resto—";
  ok(!ardeD("Entre Lider y Falabella" + largo + ", la distancia al benchmark es 8.6 pp contra 8.1 pp.") && ardeD("Entre Falabella y Lider" + largo + ", la distancia al benchmark es 8.6 pp contra 8.1 pp."), "candado: con dos entidades COORDINADAS («entre Falabella y Lider … 8.6 pp contra 8.1 pp») la lectura por orden sigue decidiendo, y la invertida arde");
  ok(!ardeD("SAM-REF500L ($19K) y LG-WASH11KG ($15K) —esos sí cruzan con ventas altas y además rotan rápido, mucho más que el resto del catálogo frenado (17 días y 21 días de cobertura).") && ardeD("PHI-HAIR-PRO y PHI-SHAVER9 son el mejor caso de la lista — lideran contribución con diferencia sobre el resto del catálogo, sostienen margen sin pedir capital y tienen cobertura corta (15 días y 19 días)."), "candado: «A ($19K) y B ($15K) … (17 días y 21 días)» sigue libre y la coordinación invertida sigue ardiendo");
  ok(ardeD("Sodimac vende $8.2M. Es más grave que Falabella en distancia al benchmark (8.6 pp contra 8.1 pp).") && ardeD("Falabella lidera la venta con diferencia y sostiene la mayor parte del canal retail durante todo el año cerrado, mientras que Lider vende $19.4M."), "candado: el sujeto elidido ajeno y «mientras que Lider vende $19.4M» siguen ardiendo");
  /* lo que recibió el usuario en la prueba 1 */
  const f1 = V5.final.texto;
  ok(coberturaDelEncargo(f1, partesDelEncargo(Q)).length === 0 && /Criterio mío[^.]*yo pondría el foco en Lider primero/.test(f1) && /Falabella la supera solo en contribución sin capturar/.test(f1) && /En inventario, aparte: LG-DRYER8KG/.test(f1), "★ lo servido: los tres dominios, Lider primero con el criterio dicho, Falabella en contribución, inventario aparte");
  ok(!prioridadIntegradaCambiada(f1, FIGS, DOMS, criterioDeLaPregunta(Q) || {}) && !vetosDeRegistro(f1, { pregunta: Q, figs: M1.rp.ledger.figs, sitio: "poda" }).length && M1.muro(f1).length === 0, "…y lo servido pasa la ley, el contrato y el muro", M1.muro(f1).map((x) => x.kind).join(","));
  /* ── prueba 2: un falso positivo (el sujeto coordinado) y los vetos legítimos que se quedan ── */
  const M2 = muroDe(LE.pregunta);
  const b1 = LE.borradores[0].texto, b2 = LE.borradores[1].texto;
  ok(/Falabella, Jumbo y Lider concentran la mayor contribución \(\$4\.3M, \$4\.2M y \$3\.8M respectivamente\)/.test(b1), "la frase: «Falabella, Jumbo y Lider concentran la mayor contribución ($4.3M, $4.2M y $3.8M)» — el extremo es del grupo, y es cierto");
  const ardeS = (t) => M2.muro(t).some((x) => x.kind === "superlativo-no-sostenido");
  ok(!M2.muro(b1).some((x) => x.kind === "superlativo-no-sostenido" && /Lider es «mayor» en contribucion/.test(String(x.detail))), "★ ya no se le cobra a Lider «ser el máximo»: un sujeto «A, B y C» es un plural, sin reclamante único no se juzga");
  /* (auditoría del Notario 2026-09-14: ese mismo cierre SÍ arde por «la más urgente en cobranza (269 días vencidos, peor recuperación)» — Easy tiene
   * 270 días y Sodimac 35 % recuperado; error real, verificado contra los rankings de cobranza de la proyección) */
  ok(M2.muro(b1).some((x) => x.kind === "superlativo-no-sostenido" && /«la más urgente» en dias vencido.*Easy \(270d/.test(String(x.detail))), "★ …y el error de orden real del mismo cierre arde: «la más urgente en cobranza (269 días)» con Easy en 270 (rankings de cobranza)");
  ok(ardeS("Después de Jumbo y Sodimac, Lider concentra la mayor contribución.") && ardeS("Falabella, Jumbo y Lider crecen; Lider concentra la mayor contribución.") && ardeS("Falabella y Jumbo crecen, y la mayor contribución es Lider."), "candados: «después de Jumbo y Sodimac, Lider…», la segunda cláusula y la cópula siguen cobrándole a Lider");
  ok(M2.muro(b1).some((x) => x.kind === "juicio-sin-marcar") && vetosDeRegistro(b1, { pregunta: LE.pregunta, figs: M2.rp.ledger.figs, sitio: "cierre" }).map((x) => x.regla).includes("intencion-inferida"), "los vetos legítimos del cierre se quedan: «no es apuesta de volumen» (la intención no se lee en el dato, ni negada) y priorizar sin marcar dato duro/criterio");
  ok(/6 cuentas con 73\.8% del peso de venta/.test(b2) && M2.rp.ledger.figs.some((f) => f.grupo && f.grupo.n === 6 && f.value === "73.8%") && !M2.muro(b2).some((x) => /73\.8%/.test(String(x.detail))), "★ la reparación dijo «6 cuentas con 73.8% del peso de venta»: entonces cayó (la cifra no estaba en la boleta); hoy la boleta trae el peso del grupo con su grupo y ese reparto —seis— es el correcto (§14)");
  const f2 = LE.final.texto;
  ok(!/73\.8%/.test(f2) && !/no es apuesta de volumen/.test(f2) && /el dato no distingue intención/.test(f2), "lo servido no lleva ni el 73.8% ni la intención negada");
  ok(coberturaDelEncargo(f2, partesDelEncargo(LE.pregunta)).length === 0 && /Criterio mío[^.]*yo entraría primero por Lider/.test(f2) && /severidad \(8\.6 pp/.test(f2) && /urgencia \(269 días/.test(f2) && /por contribución sin capturar, Falabella encabeza/.test(f2) && /En inventario trataría LG-DRYER8KG aparte/.test(f2), "★ lo servido: los tres dominios, Lider primero por severidad + urgencia + monto (criterio dicho), Falabella por contribución, inventario aparte");
  /* la reparación decía «su precio de lista … (markup 41.4% contra 57.3%)» con «su» = Falabella, Jumbo y Lider (error real de la auditoría del
   * Notario, familia C: el 41.4% es de las ocho bajo el benchmark — hoy arde, ver §17); en lo SERVIDO la poda quitó la oración de los tres y el
   * «su» quedó sin lista en el párrafo, que es el caso que no se juzga */
  ok(!prioridadIntegradaCambiada(f2, FIGS, DOMS, criterioDeLaPregunta(LE.pregunta) || {}) && !vetosDeRegistro(f2, { pregunta: LE.pregunta, figs: M2.rp.ledger.figs, sitio: "poda" }).length && M2.muro(f2).length === 0, "…y lo servido pasa la ley, el contrato y el muro", M2.muro(f2).map((x) => x.kind).join(","));
}

/* ═══ 13 · LAS SEGUNDAS CORRIDAS (v2.31): DOS FALSOS POSITIVOS MÁS EN LA PRUEBA 1 — CERRADOS — Y LO QUE EL MURO NO VIO EN LA 2 ═ */
H("13 · segundas corridas vivas (autorizadas, 2 llamadas cada una): la prueba 1 cayó por «recuperas $22K» y «cambia el orden» — cerrados; la prueba 2 sirvió la reparación con dos errores que el muro no vio (caso al owner)");
{
  const V6 = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo-vivo6-2026-09-14.json", import.meta.url), "utf8"));
  const L2 = JSON.parse(fs.readFileSync(new URL("./fixtures/lectura-ejecutiva-vivo2-2026-09-14.json", import.meta.url), "utf8"));
  const { guardC } = await import("./src/adi/oracle/guardC.js");
  const { cifrasDelDato } = await import("./src/adi/oracle/datoProyectado.js");
  const { playbookPara, pasosDe } = await import("./src/adi/agente/playbooks/registro.js");
  const { pasosDelEncargo } = await import("./src/adi/agente/encargoCompuesto.js");
  const { axisEntityNames } = await import("./src/adi/oracle/entityIndex.js");
  const _ejes = (lista) => { const o = []; for (const e of lista) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* eje sin índice */ } } return o.length ? o : null; };
  /* el muro con el MISMO contexto que el bucle (entidades y dueños del tenant): sin eso el ranking sin cola ni se evalúa */
  const muroDe = (pregunta) => {
    const pb = playbookPara(pregunta, {});
    const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
    return { rp, muro: (t) => { const v = guardC(t, { ledger: { figs: rp.ledger.figs }, results: rp.results, trace: null, question: pregunta, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), entidadesDelTenant: _ejes(["cliente", "sku", "marca"]), duenosDelTenant: _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full" }); return v.ok ? [] : (v.violations || []); } };
  };
  /* ── prueba 1, segunda corrida: el respaldo se sirvió porque dos falsos positivos tumbaron al modelo ── */
  ok(V6.pregunta === Q && V6.final.estado === "encargo-compuesto" && V6.borradores.length === 2 && /«\$22K».*MAK-COMP-AIR/.test(V6.final.vetos[0]) && /anuncias un orden y muestras 8 de 13/.test(V6.final.vetos[1]), "la corrida: el prompt exacto, dos borradores, el usuario recibió el respaldo; los vetos fueron «$22K» y «anuncias un orden y muestras 8 de 13»");
  const M1 = muroDe(Q);
  const c1 = V6.borradores[0].texto, r1 = V6.borradores[1].texto;
  ok(/libéralo junto con MAK-COMP-AIR y recuperas \$22K/.test(c1) && M1.rp.ledger.figs.some((f) => /liberar LG-DRYER8KG y MAK-COMP-AIR/.test(f.label) && f.value === "$22K"), "«libéralo junto con MAK-COMP-AIR y recuperas $22K»: el rótulo de la medida nombra a los dos SKU — no es un total huérfano");
  ok(!M1.muro(c1).some((x) => x.kind === "total-mal-atribuido" && /\$22K/.test(String(x.detail))), "★ ya no arde: la medida que nombra a sus dueños en el rótulo se cuelga de uno de ellos con razón (el verbo era «contribuye», de la cláusula anterior)");
  ok(/lo declaro porque cambia el orden/.test(r1) && !M1.muro(r1).some((x) => x.kind === "ranking-sin-cola"), "★ «lo declaro porque cambia el orden» ya no anuncia un ranking: la reparación pasa el muro");
  /* AUDITORÍA DEL NOTARIO (owner 2026-09-14): los dos borradores de esta corrida traen errores REALES que entonces nadie vio — de ORDEN («los
   * tres motores más grandes son también los que tienen el margen más bajo de la cartera — Lider, Falabella, Jumbo»: los tres son Lider,
   * Falabella y Sodimac; «Jumbo … con más unidades vendidas (1.194) y más contribución ($4.2M)»: Falabella $4.3M) y de GRUPO/CONTEO («ese mismo
   * grupo tiene markup promedio 41.4%»: el grupo eran cuatro y el 41.4% es de las ocho; «Cayendo (2 de 13 cuentas)»: caen cuatro). «Pasa entera»
   * ya no es la verdad: el muro los cobra por verificación contra los rankings (familia B) y contra el grupo declarado (familia C); el contrato
   * sigue limpio; los dos falsos positivos cerrados acá («recuperas $22K», «cambia el orden») no vuelven; con ese cerebro el turno NO se sirve
   * verde y el usuario recibe una lectura completa (poda o respaldo). */
  const _vR1 = M1.muro(r1);
  ok(_vR1.every((x) => ["superlativo-no-sostenido", "cifra-de-grupo-mal-repartida", "conteo-de-lista-falso"].includes(x.kind)) && _vR1.some((x) => /son los 3 de «más bajo» en margen.*Sodimac/.test(String(x.detail))) && _vR1.some((x) => /Jumbo es «y más contribución» en contribucion.*Falabella/.test(String(x.detail))) && _vR1.some((x) => /«41\.4%».*«ese mismo grupo» remite/.test(String(x.detail))) && _vR1.some((x) => /«2 de 13 cuentas» caen: según la boleta son 4 de 13/.test(String(x.detail))) && !vetosDeRegistro(r1, { pregunta: Q, figs: M1.rp.ledger.figs, sitio: "reparacion" }).length, "★ del muro quedan SOLO los errores reales de la auditoría (el grupo de margen sin Sodimac · Jumbo «y más contribución» · el 41.4% de «ese mismo grupo» · «2 de 13» caen) y el contrato pasa", _vR1.map((x) => x.kind + ": " + String(x.detail).slice(0, 80)).join(" | "));
  for (const [i, b] of [c1, r1].entries()) {
    const r = await answerViaAgente({ text: Q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: b, stop: "end_turn" }) });
    ok(r.r.agente.estado !== "verde" && r.r.text.split(/\s+/).length >= 400, `★ con el ${i ? "segundo" : "primer"} borrador vivo como cerebro, el turno ya NO se sirve verde (${r.r.agente.estado}): el Notario detiene los errores reales y el usuario recibe una lectura completa`, JSON.stringify(r.r.agente.vetos).slice(0, 200));
  }
  ok(/\*\*Lider primero\*\*/.test(c1) && /Con criterio de riesgo integrado \(materialidad \+ severidad \+ urgencia, señal por señal, sin sumar dominios\)/.test(c1) && /Falabella solo le gana en contribución no capturada/.test(c1) && /En inventario, el foco es LG-DRYER8KG/.test(c1) && coberturaDelEncargo(c1, partesDelEncargo(Q)).length === 0, "el modelo cumplió: tres dominios, Lider primero por riesgo integrado con el criterio dicho, Falabella por contribución, inventario aparte");
  /* candados: lo que sí anuncia un ranking y lo que sí es un total huérfano siguen ardiendo */
  const ardeK = (t, k) => M1.muro(t).some((x) => x.kind === k);
  ok(ardeK("El orden es: LG-DRYER8KG, BOS-SANDER, MAK-COMP-AIR, SAM-TV55, LG-WASH11KG, PHI-SHAVER9, SAM-REF500L y PHI-HAIR-PRO.", "ranking-sin-cola") && ardeK("En este orden: LG-DRYER8KG, BOS-SANDER, MAK-COMP-AIR, SAM-TV55, LG-WASH11KG, PHI-SHAVER9, SAM-REF500L y PHI-HAIR-PRO.", "ranking-sin-cola") && ardeK("Ranking de SKU por peor rotación: MAK-COMP-AIR 0.8x, LG-DRYER8KG 1.0x, BOS-SANDER 1.6x, PHI-IRON-PRO 2.4x, SAM-TV55 3.6x, MAK-SAW18V 5.2x, LG-AIR9000 5.8x.", "ranking-sin-cola"), "candados: «el orden es», «en este orden» y «ranking de» con 8 de 13 siguen ardiendo");
  ok(ardeK("Falabella genera $4.9M de contribución no capturada.", "total-mal-atribuido") && ardeK("SAM-TV55 representa $22K de capital liberable.", "total-mal-atribuido"), "candados: el subtotal de 5 cuentas colgado de Falabella y el $22K colgado de un SKU que el rótulo no nombra siguen ardiendo");
  /* ── prueba 2, segunda corrida: se sirvió la reparación, y lleva dos errores que el muro no ve (caso al owner, sin publicar) ── */
  ok(L2.final.estado === "reparado" && L2.borradores.length === 2 && Math.abs(L2.final.texto.length - L2.borradores[1].texto.length) <= 8, "la corrida: dos borradores, el usuario recibió la reparación entera");
  const M2 = muroDe(L2.pregunta);
  const f2 = L2.final.texto;
  ok(/Falabella, Lider, Jumbo, Sodimac y Paris \(73\.8% de la venta\)/.test(f2) && JSON.stringify(M2.rp.results).includes('"n":6,"pesoVenta":73.8'), "lo servido dice «Falabella, Lider, Jumbo, Sodimac y Paris (73.8% de la venta)» — y el 73.8% es el peso de SEIS cuentas en los results (falta Ripley)");
  ok(/la segunda mayor brecha de margen, 8\.6 pp/.test(f2) && M2.rp.ledger.figs.filter((x) => /Brecha al benchmark/.test(x.label) && !/negocio/i.test(x.label)).every((x) => x.raw <= 8.6), "…y «la segunda mayor brecha de margen, 8.6 pp»: la de Lider es la MAYOR de todas");
  ok(M2.muro(f2).some((x) => x.kind === "cifra-de-grupo-mal-repartida") && M2.muro(f2).some((x) => x.kind === "superlativo-no-sostenido"), "★ el muro ya ve los dos (cerrados en §14): la cifra de un grupo repartida a un grupo distinto, y el ordinal falso", M2.muro(f2).map((x) => x.kind).join(","));
  /* el falso positivo del cierre, CERRADO con el lector de cláusula (owner 2026-09-14): «$33K frenados en total (foto de hoy), concentrados en
   * Valparaíso (75%)» — el «(75%)» pegado a Valparaíso dice que tiene una PARTE; una entidad con su propia cifra pegada no reclama el total.
   * El candado: sin la parte dicha, colgar el total de la bodega sigue ardiendo. */
  ok(!M2.muro(L2.borradores[0].texto).some((x) => x.kind === "total-mal-atribuido" && /\$33K/.test(String(x.detail))), "★ el cierre ya no cae por «$33K frenados en total, concentrados en Valparaíso (75%)»: el 75% dice que es una parte (lector de cláusula)", M2.muro(L2.borradores[0].texto).map((x) => x.kind).join(","));
  ok(M2.muro("Capital: $33K frenados en total, concentrados en Valparaíso.").some((x) => x.kind === "total-mal-atribuido" && /\$33K/.test(String(x.detail))), "candado: «$33K frenados en total, concentrados en Valparaíso» (sin la parte dicha) sigue ardiendo");
}

/* ═══ 14 · LOS DOS HUECOS DEL MURO, CERRADOS, Y LA LEY DE LA COINCIDENCIA (owner 2026-09-14) ════════════════════════ */
H("14 · universo de grupos · ordinales y rankings · «coincide en dos dominios» no es razón: los tres, sobre las respuestas reales");
{
  const L2 = JSON.parse(fs.readFileSync(new URL("./fixtures/lectura-ejecutiva-vivo2-2026-09-14.json", import.meta.url), "utf8"));
  const V6 = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo-vivo6-2026-09-14.json", import.meta.url), "utf8"));
  const { guardC } = await import("./src/adi/oracle/guardC.js");
  const { cifrasDelDato } = await import("./src/adi/oracle/datoProyectado.js");
  const { playbookPara, pasosDe } = await import("./src/adi/agente/playbooks/registro.js");
  const { pasosDelEncargo } = await import("./src/adi/agente/encargoCompuesto.js");
  const { axisEntityNames } = await import("./src/adi/oracle/entityIndex.js");
  const { coincidenciaComoRazon } = await import("./src/adi/agente/prioridadIntegrada.js");
  const _ejes = (lista) => { const o = []; for (const e of lista) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* eje sin índice */ } } return o.length ? o : null; };
  const muroDe = (pregunta) => {
    const pb = playbookPara(pregunta, {});
    const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
    return { rp, muro: (t) => { const v = guardC(t, { ledger: { figs: rp.ledger.figs }, results: rp.results, trace: null, question: pregunta, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), entidadesDelTenant: _ejes(["cliente", "sku", "marca"]), duenosDelTenant: _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full" }); return v.ok ? [] : (v.violations || []); } };
  };
  const M2 = muroDe(L2.pregunta);
  const kinds = (t) => M2.muro(t).map((x) => x.kind);
  const arde = (t, k) => kinds(t).includes(k);
  /* 1 · universo de grupos: la herramienta publica el peso del grupo con su grupo, la lista va completa, y el muro cobra el reparto */
  const G6 = M2.rp.ledger.figs.find((f) => f.grupo && f.grupo.n === 6 && /^Peso en la venta/.test(String(f.label)));   // desde §17 también el subtotal de carga ($655K) declara un grupo de 6
  ok(G6 && G6.value === "73.8%" && G6.grupo.entidades.join(",") === "Falabella,Lider,Jumbo,Sodimac,Paris,Ripley" && /^Peso en la venta · papel: .+ \(6 cuentas\)$/.test(G6.label), "★ la boleta trae el peso del grupo con su grupo declarado: «Peso en la venta · papel: … (6 cuentas) = 73.8%» (Falabella, Lider, Jumbo, Sodimac, Paris, Ripley)", G6 && G6.label);
  const rolesF = (M2.rp.results.find((r) => r.tool === "rolesCartera") || {}).facts;
  ok(rolesF && rolesF.roles.every((r) => r.entidades.length === r.n), "…y los facts traen la lista COMPLETA de cada papel (n = entidades): el cerebro ya no copia una lista recortada");
  ok(arde(L2.final.texto, "cifra-de-grupo-mal-repartida"), "★ lo servido en la prueba 2 («Falabella, Lider, Jumbo, Sodimac y Paris (73.8% de la venta)») ahora arde: la cifra de un grupo de 6 narrada como de 5", kinds(L2.final.texto).join(","));
  ok(arde("Falabella, Lider, Jumbo, Sodimac y Paris (73.8% de la venta) tienen margen bajo el benchmark.", "cifra-de-grupo-mal-repartida") && arde("Cinco cuentas con carga sobre el nivel pesan 73.8% de la venta.", "cifra-de-grupo-mal-repartida") && arde("Lider pesa 73.8% de la venta.", "cifra-de-grupo-mal-repartida"), "candados: la lista corta, el conteo equivocado («cinco cuentas») y una sola cuenta arden");
  ok(!arde("Falabella, Lider, Jumbo, Sodimac, Paris y Ripley (73.8% de la venta) tienen margen bajo el benchmark.", "cifra-de-grupo-mal-repartida") && !arde("Seis cuentas con margen bajo el benchmark y carga sobre el nivel pesan 73.8% de la venta.", "cifra-de-grupo-mal-repartida") && kinds("Las cuentas con carga sobre el nivel declarado pesan 73.8% de la venta.").length === 0, "el grupo completo, «seis cuentas» y la descripción sin lista pasan (y el 73.8% ya está autorizado por la boleta)");
  ok(!arde("LG-DRYER8KG ($14K) es el 41.0% de los $33K frenados.", "cifra-no-autorizada"), "la cuenta mostrada ($14K de $33K → 41.0%) sigue pasando: los dos operandos están en el texto");
  /* LA LOTERÍA DEL CATÁLOGO, CERRADA (owner 2026-09-14): un % que no está en la boleta solo se autoriza como cuenta MOSTRADA
   * (participación o variación entre dos montos dichos en el texto). Antes, con 50+ montos en el pool, «68.4%» pasaba
   * por coincidir con la razón entre dos montos que el texto jamás nombró. Los porcentajes de corrido de la casa (el YoY
   * del negocio, el umbral de materialidad) los publican ahora los emisores con rótulo, y el «+» del emisor no es otra cifra. */
  ok(arde("Seis cuentas pesan 68.4% de la venta.", "cifra-no-autorizada") && arde("Falabella, Lider y Jumbo pesan 68.4% de la venta.", "cifra-no-autorizada"), "★ «Seis cuentas pesan 68.4% de la venta» ARDE como cifra no autorizada: ya no hay razón entre dos montos no dichos que la salve");
  ok(!arde("La venta viene +7.5% contra el año anterior.", "cifra-no-autorizada") && !arde("La venta crece 7.5% contra el año anterior.", "cifra-no-autorizada") && M2.rp.ledger.figs.some((f) => f.label === "Ventas vs año anterior" && f.value === "+7.5%"), "el YoY del negocio que el emisor publica con signo («Ventas vs año anterior = +7.5%») autoriza «+7.5%» y «7.5%» por la boleta, no por el catálogo");
  ok(!arde("Está bajo el 0.05% de tu venta: $50K — no es tu incendio de hoy.", "cifra-no-autorizada") && M2.rp.ledger.figs.some((f) => /^Umbral de materialidad · % de la venta$/.test(f.label)) && M2.rp.ledger.figs.some((f) => /^Umbral de materialidad · en dinero$/.test(f.label)), "el umbral de materialidad («bajo el 0.05% de tu venta: $50K») viaja en la boleta con rótulo, y la frase pasa por él");
  {
    /* los 12 borradores reales de la auditoría: ningún porcentaje correcto se veta ahora — todos siguen autorizados por la
     * boleta, por una cuenta mostrada o por la proyección del dato con su dueño */
    const { stripLanguageLeaks } = await import("./src/adi/llm/voiceGuard.js");
    const AUD = JSON.parse(fs.readFileSync(new URL("./fixtures/auditoria-notario-2026-09-14.json", import.meta.url), "utf8"));
    const jueces = new Map();
    const pctVetados = [];
    for (const c of AUD.corpus) {
      const FX = JSON.parse(fs.readFileSync(new URL("./fixtures/" + c.fixture, import.meta.url), "utf8"));
      if (!jueces.has(FX.pregunta)) jueces.set(FX.pregunta, muroDe(FX.pregunta));
      const texto = stripLanguageLeaks(String(FX.borradores[c.borrador - 1].texto));
      for (const x of jueces.get(FX.pregunta).muro(texto)) if (x.kind === "cifra-no-autorizada" && /%|pp\b/.test(String(x.detail))) pctVetados.push(`${c.id}·${c.sitio}: ${x.detail}`);
    }
    ok(AUD.corpus.length === 12 && pctVetados.length === 0, "★ en los 12 borradores reales de la auditoría ningún porcentaje se veta como cifra no autorizada (todos siguen autorizados por la boleta o por una cuenta mostrada)", pctVetados.join(" · "));
  }
  /* 2 · ordinales y rankings: «segunda mayor brecha» se verifica igual que «mayor» */
  const dp = cifrasDelDato(ESCENARIO_INICIAL);
  ok(dp.rankings.cliente.brecha && dp.rankings.cliente.no_capturada && dp.rankings.cliente.brecha.filas.slice().sort((a, b) => b.valor - a.valor).slice(0, 2).map((x) => x.entidad + " " + x.valor).join(" · ") === "Lider 8.6 · Falabella 8.1", "la proyección declara los rankings de brecha al benchmark (Lider 8.6 · Falabella 8.1 · …) y de contribución no capturada");
  ok(arde(L2.final.texto, "superlativo-no-sostenido") && M2.muro(L2.final.texto).some((x) => x.kind === "superlativo-no-sostenido" && /«segunda mayor» en brecha/.test(String(x.detail)) && /en el puesto 2 va Falabella \(8\.1 pp\) y Lider va en el puesto 1 \(8\.6 pp\)/.test(String(x.detail))), "★ «la segunda mayor brecha de margen, 8.6 pp» arde: en el puesto 2 va Falabella (8.1 pp) y Lider va en el puesto 1 (8.6 pp)");
  ok(arde("Lider es la cuenta más grave en cobranza y la segunda en brecha de margen (8.6 pp).", "superlativo-no-sostenido") && arde("Jumbo es el segundo en ventas.", "superlativo-no-sostenido") && !arde("Lider es el segundo en ventas.", "superlativo-no-sostenido") && !arde("Falabella tiene la segunda mayor brecha de margen (8.1 pp).", "superlativo-no-sostenido"), "candados: «la segunda en brecha», «el segundo en ventas» se verifican por puesto — el puesto correcto pasa, el incorrecto arde");
  ok(!arde("Falabella tiene la mayor contribución no capturada ($1.6M).", "superlativo-no-sostenido") && !arde("Lider tiene la segunda mayor contribución sin capturar ($1.5M).", "superlativo-no-sostenido") && arde("Jumbo tiene la segunda mayor contribución no capturada ($1.1M).", "superlativo-no-sostenido") && !arde("Jumbo tiene la tercera mayor contribución no capturada ($1.1M).", "superlativo-no-sostenido"), "«contribución no capturada» se juzga contra SU ranking, no contra la contribución a secas");
  /* 3 · la coincidencia agrava, no decide: la ley del contrato y la doctrina al cerebro */
  const cc = coincidenciaComoRazon(L2.final.texto);
  ok(cc && /coincidir agrava el caso, no lo decide/.test(cc), "★ lo servido en la prueba 2 («partir por Lider: coincide en dos dominios… esa coincidencia agrava más que cualquier monto aislado») arde por «coincidencia-como-razon»", String(cc).slice(0, 120));
  ok(vetosDeRegistro(L2.final.texto, { pregunta: L2.pregunta, figs: M2.rp.ledger.figs, sitio: "reparacion" }).map((x) => x.regla).includes("coincidencia-como-razon"), "…y el contrato la cobra en el sitio de la reparación");
  ok(!!coincidenciaComoRazon("Lider va primero porque coincide en ambos dominios.") && !!coincidenciaComoRazon("Yo entraría primero por Lider, por coincidir en dos dominios."), "candados: «porque coincide», «por coincidir» arden");
  ok(!coincidenciaComoRazon("Yo entraría primero por Lider: la mayor brecha al benchmark (8.6 pp) y el atraso más largo (269 días); coincide en dos dominios, lo que agrava el caso.") && !coincidenciaComoRazon("Criterio: coincidir en dos dominios agrava, no decide.") && !coincidenciaComoRazon("Criterio mío: yo entraría primero por Lider, porque ahí coinciden severidad (8.6 pp), urgencia (269 días vencidos) y monto."), "la coincidencia como agravante con las señales al lado, la doctrina y «coinciden severidad, urgencia y monto» pasan");
  ok(/Nunca des «coincide en dos dominios» como LA razón de ir primero/.test(conclusionDePrioridad(FIGS, DOMS, {})), "la doctrina al cerebro lo dice con todas sus letras");
  /* las lecturas de la prueba 1 (segunda corrida) no pierden nada con los tres cierres — salvo lo que la auditoría del Notario (owner
   * 2026-09-14) probó que era un error real: «ese mismo grupo tiene markup promedio 41.4%» reparte a cuatro el promedio de ocho. El grupo
   * de 73.8% / 13.8% / 12.3% sigue sin arder en esos borradores. */
  const M1 = muroDe(Q);
  /* (auditoría del Notario 2026-09-14: los dos borradores de la prueba 1 SÍ traen errores reales — dos de ORDEN, el grupo de margen sin Sodimac y
   * «Jumbo … y más contribución», y uno de GRUPO, el 41.4% repartido a «ese mismo grupo» —; arden exactamente por esos, y por la coincidencia
   * siguen sin arder) */
  for (const [i, b] of V6.borradores.entries()) {
    const _m = M1.muro(b.texto);
    const _sup = _m.filter((x) => x.kind === "superlativo-no-sostenido").map((x) => String(x.detail));
    const _grp = _m.filter((x) => x.kind === "cifra-de-grupo-mal-repartida");
    ok(_sup.length === 2 && _sup.some((d) => /«más bajo» en margen.*Sodimac/.test(d)) && _sup.some((d) => /Jumbo es «y más contribución»/.test(d)) && _grp.length >= 1 && _grp.every((x) => /^«41[.,]4%»/.test(String(x.detail))) && !vetosDeRegistro(b.texto, { pregunta: Q, figs: M1.rp.ledger.figs, sitio: i ? "reparacion" : "cierre" }).map((x) => x.regla).includes("coincidencia-como-razon"), `el borrador ${i + 1} de la prueba 1 arde exactamente por sus errores reales (dos de orden, el 41.4% de grupo) y no por la coincidencia`, _m.map((x) => x.kind).join(","));
  }
}

/* ═══ 15 · LA TERCERA CORRIDA DE LA PRUEBA 1: LA REPARACIÓN ERA LA RESPUESTA Y CAYÓ POR CUATRO FALSOS POSITIVOS — CERRADOS ═══ */
H("15 · tercera corrida viva de la prueba 1 (autorizada, 2 llamadas): «carga baja» adjetivo · «de eso» pegado · «frenados» es capital · «carga» a secas — cerrados; la reparación se sirve entera");
{
  const V7 = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo-vivo7-2026-09-14.json", import.meta.url), "utf8"));
  const { guardC } = await import("./src/adi/oracle/guardC.js");
  const { cifrasDelDato } = await import("./src/adi/oracle/datoProyectado.js");
  const { playbookPara, pasosDe } = await import("./src/adi/agente/playbooks/registro.js");
  const { pasosDelEncargo } = await import("./src/adi/agente/encargoCompuesto.js");
  const { axisEntityNames } = await import("./src/adi/oracle/entityIndex.js");
  const _ejes = (lista) => { const o = []; for (const e of lista) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* eje sin índice */ } } return o.length ? o : null; };
  const pb = playbookPara(Q, {});
  const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(Q), pb ? pasosDe(pb, Q, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: Q, registry: CAJA });
  const muro = (t) => { const v = guardC(t, { ledger: { figs: rp.ledger.figs }, results: rp.results, trace: null, question: Q, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), entidadesDelTenant: _ejes(["cliente", "sku", "marca"]), duenosDelTenant: _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full" }); return v.ok ? [] : (v.violations || []); };
  const reglas = (t, sitio) => vetosDeRegistro(t, { pregunta: Q, figs: rp.ledger.figs, sitio }).map((x) => x.regla);
  const c1 = V7.borradores[0].texto, r1 = V7.borradores[1].texto;
  ok(V7.pregunta === Q && V7.final.estado === "encargo-compuesto" && /«\$14K» narrado como ventas/.test(V7.final.vetos[0]) && /carga «baja»/.test(V7.final.vetos[1]), "la corrida: el usuario recibió el respaldo; los vetos fueron «$14K narrado como ventas» (cierre) y «carga baja» (reparación)");
  /* los falsos positivos, cerrados */
  ok(/el patrón de carga baja está ahí/.test(r1) && !reglas(r1, "reparacion").includes("variacion-no-medida"), "★ «el patrón de carga baja está ahí»: adjetivo, no verbo — ya no arde");
  ok(/\$9\.8M de saldo pendiente, de eso \$4\.6M vencidos/.test(r1) && !reglas(r1, "reparacion").includes("subtotal-de-otro-universo"), "★ «$9.8M de saldo pendiente, de eso $4.6M vencidos»: el «eso» es la cifra pegada, no el $135K del párrafo anterior — ya no arde");
  ok(/carga de solo 1\.8%/.test(c1) && !muro(c1).some((x) => x.kind === "metrica-mal-atribuida" && /1\.8%/.test(String(x.detail))), "★ «carga de solo 1.8%» tras «crece»: «carga» a secas es la carga comercial — ya no arde");
  /* el falso positivo del cierre, CERRADO con el lector de cláusula (owner 2026-09-14): «sin relación con lo que más vende: LG-DRYER8KG ($14K
   * frenados, …)» — «vende» queda del otro lado de los dos puntos y fuera del paréntesis: la ventana hacia atrás empieza en la cláusula que
   * contiene el paréntesis. «frenados» sigue SIN entrar al vocabulario de capital («75% del frenado total» es una participación). El candado:
   * el rótulo «vende: $14K» sí describe la cifra, y arde. */
  ok(!muro(c1).some((x) => x.kind === "metrica-mal-atribuida" && /\$14K/.test(String(x.detail))), "★ «($14K frenados…)» tras «lo que más vende:» ya no arde: «vende» es de otra cláusula (lector de cláusula)", muro(c1).filter((x) => x.kind === "metrica-mal-atribuida").map((x) => String(x.detail).slice(0, 100)).join(" | "));
  ok(muro("Lo que más vende: $14K en LG-DRYER8KG.").some((x) => x.kind === "metrica-mal-atribuida" && /\$14K/.test(String(x.detail))), "candado: el rótulo «vende: $14K» sí describe la cifra y arde");
  /* AUDITORÍA DEL NOTARIO (owner 2026-09-14): esta reparación trae DOS errores REALES que entonces nadie vio — de ORDEN, «Falabella … carga 4.5% —
   * la más alta de la cartera» (Easy 5.5 %, Sodimac 5.4 %, Ripley 4.8 %), y de GRUPO, «en esos mismos cuatro el precio de lista está más pegado al
   * costo que en los sanos (markup 41.4% contra 57.3% …)» (los cuatro son Falabella, Lider, Jumbo y Sodimac; el 41.4% es el promedio de las OCHO).
   * Los cuatro falsos positivos siguen cerrados (arriba); del muro quedan SOLO esos dos vetos, verificados contra el ranking de carga y contra el
   * grupo declarado; el contrato sigue pasando; y con ese cerebro el turno ya no se sirve verde. */
  ok(muro(r1).every((x) => x.kind === "superlativo-no-sostenido" || x.kind === "cifra-de-grupo-mal-repartida") && muro(r1).some((x) => /Falabella es «más alta» en carga.*Easy \(5\.5%/.test(String(x.detail))) && muro(r1).some((x) => /«41\.4%».*«esos mismos cuatro» remite/.test(String(x.detail))) && reglas(r1, "reparacion").length === 0, "★ la reparación pasa el contrato, y del muro quedan SOLO los dos errores reales de la auditoría: «carga 4.5% — la más alta de la cartera» y el 41.4% de «esos mismos cuatro»", muro(r1).map((x) => x.kind + ": " + String(x.detail).slice(0, 80)).join(" | "));
  const r = await answerViaAgente({ text: Q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: r1, stop: "end_turn" }) });
  ok(r.r.agente.estado !== "verde" && !/esos mismos cuatro/.test(r.r.text) && r.r.text.split(/\s+/).length >= 400, `★ con esa reparación como cerebro, el turno ya NO se sirve verde (${r.r.agente.estado}): el Notario detiene los dos errores y lo servido no lleva el reparto del 41.4%`, JSON.stringify(r.r.agente.vetos).slice(0, 200));
  ok(/Lider va primero: peor brecha al benchmark \(8\.6 pp\)/.test(r1) && /la razón de ir primero es la severidad de cada señal, no la coincidencia/.test(r1) && /Falabella es la prioridad si miras solo contribución no capturada/.test(r1) && /En inventario, resolvería LG-DRYER8KG primero/.test(r1) && coberturaDelEncargo(r1, partesDelEncargo(Q)).length === 0, "el modelo cumplió: Lider primero por severidad, la coincidencia como agravante (la doctrina llegó), Falabella por contribución/ventas, inventario aparte, nueve partes cubiertas");
  /* los vetos legítimos del cierre se quedan */
  ok(muro(c1).some((x) => x.kind === "dias-etiqueta-incorrecta") && reglas(c1, "cierre").includes("intencion-inferida") && reglas(c1, "cierre").includes("parte-del-encargo-omitida"), "el cierre sigue cayendo por lo legítimo: «165 días sin rotar», la intención negada, las unidades omitidas");
  /* candados */
  ok(reglas("En Mercado Libre la carga baja y el margen se sostiene.", "cierre").includes("variacion-no-medida") && reglas("Su carga comercial baja este año.", "cierre").includes("variacion-no-medida"), "candado: «la carga baja» y «su carga comercial baja» (verbo) siguen ardiendo");
  ok(reglas("El capital total es $135K. De eso, $4.6M están vencidos en Lider.", "cierre").includes("subtotal-de-otro-universo") && reglas("De los $13.3M de SAM-TV55, $12.4M son de LG-WASH11KG.", "cierre").includes("subtotal-de-otro-universo"), "candado: el «de eso» que sí cruza universos y «de los $X de A, $Y son de B» siguen ardiendo");
  ok(!reglas("De los 5 SKU que más venden (SAM-TV55 $13.3M, LG-WASH11KG $12.4M, PHI-SHAVER9 $12.3M), los 5 están entre los que más contribución dejan.", "cierre").includes("subtotal-de-otro-universo"), "una enumeración «(A $x, B $y)» que abre con «De los» no es un continente");
  ok(muro("LG-DRYER8KG vende $14K en el período.").some((x) => x.kind === "metrica-mal-atribuida"), "candado: «LG-DRYER8KG vende $14K» (capital narrado como venta) sigue ardiendo");
}

/* ═══ 16 · LA TERCERA CORRIDA DE LA PRUEBA 2: EL CIERRE ERA LA RESPUESTA Y CAYÓ POR DOS FALSOS POSITIVOS — CERRADOS ═════════ */
H("16 · tercera corrida viva de la prueba 2 (autorizada, 2 llamadas): el paréntesis no cambia el sujeto · la coincidencia negada no arde · «mayor que» es comparativo · el «la» de dos oraciones atrás — cerrados; el cierre se sirve entero");
{
  const L3 = JSON.parse(fs.readFileSync(new URL("./fixtures/lectura-ejecutiva-vivo3-2026-09-14.json", import.meta.url), "utf8"));
  const { guardC } = await import("./src/adi/oracle/guardC.js");
  const { cifrasDelDato } = await import("./src/adi/oracle/datoProyectado.js");
  const { playbookPara, pasosDe } = await import("./src/adi/agente/playbooks/registro.js");
  const { pasosDelEncargo } = await import("./src/adi/agente/encargoCompuesto.js");
  const { axisEntityNames } = await import("./src/adi/oracle/entityIndex.js");
  const { coincidenciaComoRazon } = await import("./src/adi/agente/prioridadIntegrada.js");
  const _ejes = (lista) => { const o = []; for (const e of lista) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* eje sin índice */ } } return o.length ? o : null; };
  const Q3 = L3.pregunta;
  const pb = playbookPara(Q3, {});
  const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(Q3), pb ? pasosDe(pb, Q3, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: Q3, registry: CAJA });
  const muro = (t) => { const v = guardC(t, { ledger: { figs: rp.ledger.figs }, results: rp.results, trace: null, question: Q3, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), entidadesDelTenant: _ejes(["cliente", "sku", "marca"]), duenosDelTenant: _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full" }); return v.ok ? [] : (v.violations || []); };
  const arde = (t, k) => muro(t).some((x) => x.kind === k);
  const c1 = L3.borradores[0].texto, r1 = L3.borradores[1].texto;
  ok(L3.final.estado === "encargo-compuesto" && /«269 d» pertenece a Lider/.test(L3.final.vetos[0]) && /coincidencia-como-razon/.test(L3.final.vetos[0]) && /Falabella es «mayor» en brecha/.test(L3.final.vetos[1]), "la corrida: el usuario recibió el respaldo; los vetos fueron «269 d» + coincidencia (cierre) y «Falabella mayor en brecha» (reparación)");
  ok(/Lider pesa más: 8,6 pp de brecha \(peor que Falabella\), \$4,6M vencidos con apenas 45% recuperado y 269 días de atraso/.test(c1) && !arde(c1, "cifra-de-boleta-sin-dueno"), "★ «Lider pesa más: 8.6 pp (peor que Falabella), … y 269 días de atraso»: la comparación entre paréntesis no le quita la oración a Lider — ya no arde");
  ok(/no porque coincidir en dos dominios lo decida solo, sino porque en cada uno pesa más/.test(c1) && !coincidenciaComoRazon(c1), "★ «no porque coincidir en dos dominios lo decida solo, sino porque en cada uno pesa más»: la coincidencia NEGADA como razón es lo que la ley pide — ya no arde");
  ok(muro(c1).length === 0, "★ el cierre pasa el muro entero", muro(c1).map((x) => x.kind).join(","));
  const r = await answerViaAgente({ text: Q3, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: c1, stop: "end_turn" }) });
  ok(r.r.agente.estado === "verde" && r.r.text.split(/\s+/).length >= 450, `★ con ese cierre como cerebro, el turno se sirve entero y verde (${r.r.agente.estado}): el usuario recibe la lectura del modelo`, JSON.stringify(r.r.agente.vetos).slice(0, 200));
  ok(/su brecha al benchmark es mayor que la de Falabella \(8\.6 pp contra 8\.1 pp\)/.test(r1) && !arde(r1, "superlativo-no-sostenido") && !arde(r1, "cifra-de-boleta-sin-dueno"), "★ la reparación: «su brecha es mayor QUE la de Falabella» es un comparativo, y «Falabella solo la supera ($1.6M contra $1.5M)» tiene el «la» dos oraciones atrás — ya no arden");
  ok(vetosDeRegistro(r1, { pregunta: Q3, figs: rp.ledger.figs, sitio: "reparacion" }).map((x) => x.regla).includes("deterioro-no-medido"), "…y la reparación sigue cayendo por lo de la casa: «el deterioro es más profundo» sin una variación medida (y tres subtítulos)");
  /* candados */
  ok(arde("Lider pesa más en la balanza integrada por la severidad de su brecha y por el peso de su vencido en la cartera, pero Falabella acumula 269 días de atraso.", "cifra-de-boleta-sin-dueno") && arde("Iría por Sodimac. La razón es la severidad. Falabella solo la supera en un punto, la contribución sin capturar ($1.6M contra $1.5M).", "cifra-de-boleta-sin-dueno"), "candados: «Falabella acumula 269 días» y el «la» que no es Lider siguen ardiendo");
  ok(arde("Falabella tiene la mayor brecha al benchmark de la cartera (8.1 pp).", "superlativo-no-sostenido") && !arde("Lider tiene la mayor brecha al benchmark de la cartera (8.6 pp).", "superlativo-no-sostenido"), "candado: el superlativo de verdad («la mayor brecha … de la cartera») se sigue verificando");
  ok(!!coincidenciaComoRazon("Iría por Lider porque coincide en dos dominios.") && !coincidenciaComoRazon("Que Lider aparezca pesada en los dos dominios a la vez agrava el caso, pero la decisión la toma la severidad de cada señal."), "candado: «iría por Lider porque coincide en dos dominios» arde; «agrava el caso, pero la decisión la toma la severidad» pasa");
}

/* ═══ 17 · LA CIFRA DE UN GRUPO ES DEL GRUPO COMPLETO — PROMEDIOS, SUBTOTALES, PRONOMBRES Y «N DE M» (owner 2026-09-14) ══════════
 * Familia C de la auditoría del Notario (`_AUDITORIA_NOTARIO_2026-09-14.md`): 7 casos de «cifra de grupo repartida a un subgrupo» y 1 de
 * conteo, en los 12 borradores reales, ninguno detectado. La familia se cierra en tres piezas: (1) la CONVENCIÓN DE LA CASA — quien publica un
 * agregado de un conjunto conocido declara el conjunto (`grupo` en los promedios de markup, en los subtotales del diagnóstico); (2) el muro
 * lee por estructura (lector de cláusula) la referencia pegada a la cifra —lista, conteo o pronombre/demostrativo cuyo referente es la última
 * lista del párrafo— y cobra `cifra-de-grupo-mal-repartida`; (3) un «N de M cuentas» con predicado derivable se compara con lo que la boleta
 * permite contar (`conteo-de-lista-falso`). Cada detección es una verificación real; la precisión se mide a mano sobre los 12 borradores. */
H("17 · la cifra de un grupo es del grupo completo: promedios, subtotales, pronombres y «N de M» — verificados contra la boleta, sin falsos positivos en los 12 borradores");
{
  const { guardC } = await import("./src/adi/oracle/guardC.js");
  const { cifrasDelDato } = await import("./src/adi/oracle/datoProyectado.js");
  const { playbookPara, pasosDe } = await import("./src/adi/agente/playbooks/registro.js");
  const { pasosDelEncargo } = await import("./src/adi/agente/encargoCompuesto.js");
  const { axisEntityNames } = await import("./src/adi/oracle/entityIndex.js");
  const { stripLanguageLeaks } = await import("./src/adi/llm/voiceGuard.js");
  const _ejes = (lista) => { const o = []; for (const e of lista) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* eje sin índice */ } } return o.length ? o : null; };
  const muroDe = (pregunta) => {
    const pb = playbookPara(pregunta, {});
    const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
    return { rp, muro: (t) => { const v = guardC(t, { ledger: { figs: rp.ledger.figs }, results: rp.results, trace: null, question: pregunta, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), entidadesDelTenant: _ejes(["cliente", "sku", "marca"]), duenosDelTenant: _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full" }); return v.ok ? [] : (v.violations || []); } };
  };
  const FAM = /^(?:cifra-de-grupo-mal-repartida|conteo-de-lista-falso)$/;
  const M1 = muroDe(Q);
  const fam = (M, t) => M.muro(t).filter((x) => FAM.test(x.kind)).map((x) => `${x.kind}: ${x.detail}`);
  /* 1 · la convención: los agregados de conjunto conocido viajan con su grupo */
  const grupoDe = (re, M = M1) => (M.rp.ledger.figs.find((f) => f.grupo && re.test(String(f.label))) || {}).grupo;
  const g414 = grupoDe(/^Markup promedio · los que caen$/), g573 = grupoDe(/^Markup promedio · sanos$/), g49 = grupoDe(/^Contribución no capturada · subtotal · 5 cuentas materiales/), g655 = grupoDe(/^Carga comercial alta · subtotal · 6 cuentas sobre el nivel/), g588 = grupoDe(/^Carga comercial alta · subtotal · 5 cuentas materiales/), g44 = grupoDe(/^Brecha por precio y costo · subtotal · 5 cuentas materiales/), g33 = grupoDe(/^Capital frenado · subtotal$/);
  ok(g414 && g414.n === 8 && g414.entidades.length === 8 && g573 && g573.n === 5 && g573.entidades.join(",") === "Easy,La Polar,Hites,ABC,Unimarc", "★ los promedios de markup declaran su grupo: «los que caen» son los 8 bajo el benchmark, «sanos» son Easy, La Polar, Hites, ABC y Unimarc", JSON.stringify([g414, g573]));
  ok(g49 && g49.n === 5 && g49.entidades.join(",") === "Falabella,Lider,Jumbo,Sodimac,Ripley" && g588 && g588.n === 5 && g44 && g44.n === 5 && g655 && g655.n === 6 && g33 && g33.n === 3 && g33.entidades.join(",") === "LG-DRYER8KG,BOS-SANDER,MAK-COMP-AIR", "★ los subtotales del diagnóstico declaran su grupo: $4.9M/$588K/$4.4M de las 5 materiales, $655K de las 6 sobre el nivel, $33K de los 3 SKU frenados", JSON.stringify([g49, g655, g33]));
  ok(!M1.rp.ledger.figs.some((f) => f.grupo && /^(?:Medida|Resto de)/.test(String(f.label))) && !M1.rp.ledger.figs.some((f) => f.grupo && f.unit === "count"), "y NO llevan grupo: la medida «liberar A y B = $22K» (colgarla de uno de los dos es correcto), «Resto (3 de 13)» (su canon también es de Lider y de Falabella) ni los conteos (un entero suelto no se lee del texto)");
  /* 2 · los 8 casos reales de la familia, detectados por verificación (y ningún veto de la familia sobre lo que la auditoría dio por correcto) */
  const AUD = JSON.parse(fs.readFileSync(new URL("./fixtures/auditoria-notario-2026-09-14.json", import.meta.url), "utf8"));
  const ESPERADOS = { "P1·1·cierre": [], "P1·1·reparacion": [], "P1·2·cierre": ["41.4%"], "P1·2·reparacion": ["41.4%", "2 de 13 cuentas"], "P1·3·cierre": ["41.4%"], "P1·3·reparacion": ["41.4%"], "P2·1·cierre": ["41.4%", "57.3%"], "P2·1·reparacion": ["41.4%"], "P2·2·cierre": ["73.8%"], "P2·2·reparacion": ["73.8%"], "P2·3·cierre": [], "P2·3·reparacion": [] };
  const jueces = new Map();
  let familiaDetectada = 0, familiaTotal = 0;
  for (const c of AUD.corpus) {
    const FXc = JSON.parse(fs.readFileSync(new URL("./fixtures/" + c.fixture, import.meta.url), "utf8"));
    if (!jueces.has(FXc.pregunta)) jueces.set(FXc.pregunta, muroDe(FXc.pregunta));
    const texto = stripLanguageLeaks(String(FXc.borradores[c.borrador - 1].texto));
    const vetos = fam(jueces.get(FXc.pregunta), texto);
    const errs = c.errores_reales.filter((e) => /cifra de grupo|conteo falso/.test(e.tipo));
    familiaTotal += errs.length; familiaDetectada += errs.filter((e) => vetos.some((v) => new RegExp(e.clave, "i").test(v))).length;
    const esperado = ESPERADOS[`${c.id}·${c.sitio}`];
    ok(vetos.length === esperado.length && esperado.every((cifra) => vetos.some((v) => v.includes(`«${cifra}»`))), `${c.id}·${c.sitio}: vetos de la familia = ${esperado.length ? esperado.map((x) => "«" + x + "»").join(" y ") : "ninguno"}`, vetos.map((v) => v.slice(0, 110)).join(" | "));
  }
  ok(familiaTotal === 9 && familiaDetectada === 9, `★ los 9 errores reales de la familia (8 de grupo —los dos del 73.8% ya se veían— + 1 de conteo) se detectan: ${familiaDetectada}/${familiaTotal}`);
  /* el 41.4% de «estos clientes» en el cierre de P2·1 no está en la auditoría, pero es la misma afirmación que su reparación («su precio de
   * lista … 41.4%», registrada): «estos clientes» remite a Falabella, Jumbo y Lider */
  const LEc = JSON.parse(fs.readFileSync(new URL("./fixtures/lectura-ejecutiva-vivo-2026-09-14.json", import.meta.url), "utf8"));
  ok(fam(jueces.get(LEc.pregunta), stripLanguageLeaks(LEc.borradores[0].texto)).some((v) => /«41\.4%».*«estos clientes» remite a la última lista del párrafo, de 3 nombres \(Falabella, Jumbo, Lider\)/.test(v)), "el cierre de P2·1 también reparte el 41.4% («el precio de lista de estos clientes» → Falabella, Jumbo y Lider), igual que su reparación con «su»");
  /* 3 · las afirmaciones correctas de los 12 borradores, una por una (revisadas a mano contra la hoja de referencia) */
  const arde = (t, M = M1) => fam(M, t).length > 0;
  for (const t of ["6 cuentas con 73.8% del peso de venta.", "Falabella, Lider, Jumbo, Sodimac, Paris y Ripley (73.8% de la venta) tienen margen bajo el benchmark.", "La brecha estimada de las 5 cuentas materiales (Falabella, Lider, Jumbo, Sodimac, Ripley) es $4.9M.", "Falabella encabeza la contribución no capturada ($1.6M de $4.9M en las 5 cuentas materiales bajo el benchmark).", "Hay 8 cuentas bajo el benchmark en total; estas 5 son las materiales y suman $4.9M.", "Easy, La Polar, Hites, ABC y Unimarc (13.8% de la venta) están sobre el benchmark.", "Tottus y Mercado Libre (12.3%) caen sin que la carga ni el volumen lo expliquen.", "Ese mismo grupo tiene markup promedio 41.4% contra 57.3% en las cuentas sanas (Easy, La Polar, Hites, ABC, Unimarc).", "Los que caen tienen markup promedio 41.4% y los sanos 57.3%.", "el precio de lista también está más pegado al costo en las que caen (markup promedio 41.4%) que en las sanas (57.3%).", "8 clientes están bajo el benchmark, pero 5 concentran una brecha estimada de $4.9M frente a ese piso.", "6 cuentas —Falabella, Lider, Jumbo, Sodimac, Paris y una quinta— pesan 73.8% de la venta.", "Los tres tienen carga comercial por sobre el nivel de referencia, patrón que se repite en 6 cuentas con 73.8% del peso de venta.", "De eso, $588K es efecto de carga comercial sobre el nivel declarado y $4.4M es precio y costo.", "Capital: $33K frenados en total (foto de hoy), concentrados en Valparaíso (75%).", "El capital frenado total de la foto de hoy es $33K, con Valparaíso concentrando el 75% de ese total ($25K) entre LG-DRYER8KG ($14K, 165 días, crítico) y BOS-SANDER ($11K, 115 días).", "Dónde está: en carga comercial alta, $655K — la más pesada es la de Falabella ($194K).", "La brecha total es $4.9M de contribución no capturada (Falabella $1.6M, Lider $1.5M, Jumbo $1.1M, Sodimac $540K, Ripley $240K).", "Easy, La Polar, Hites, ABC y Unimarc están sobre el benchmark — el 13.8% de la venta, sin problema de margen."]) ok(!arde(t), `pasa: «${t.slice(0, 96)}»`, fam(M1, t).join(" | ").slice(0, 160));
  /* 4 · las paráfrasis que reparten la cifra del grupo — arden por verificación, con el grupo y la lista dichos */
  const cita = (t, re) => fam(M1, t).some((v) => re.test(v));
  ok(cita("Falabella, Lider, Jumbo y Sodimac tienen markup promedio 41.4%.", /«41\.4%» es la cifra de un GRUPO de 8 .* 4 nombres \(Falabella, Lider, Jumbo, Sodimac\) — quedan fuera: Tottus, Paris, Mercado Libre, Ripley/) && cita("El markup promedio de Falabella, Lider y Jumbo es 41.4%.", /GRUPO de 8/), "la lista antes de la cifra: «Falabella, Lider, Jumbo y Sodimac tienen markup promedio 41.4%» arde con el grupo de 8 y los cuatro que faltan");
  ok(cita("Esas cuatro cuentas tienen markup promedio 41.4%.", /narras como de 4/) && cita("Los cuatro con carga alta tienen markup promedio 41.4%.", /narras como de 4/) && cita("Cinco cuentas con carga sobre el nivel pesan 73.8% de la venta.", /narras como de 5/), "el conteo pegado: «esas cuatro cuentas», «los cuatro», «cinco cuentas» arden contra el n del grupo");
  ok(cita("Falabella, Lider, Jumbo y Sodimac están bajo el benchmark. Esas cuentas tienen markup promedio 41.4%.", /«esas cuentas» remite a la última lista del párrafo, de 4 nombres/) && cita("Falabella, Lider, Jumbo y Sodimac caen; su markup promedio es 41.4%.", /«su» remite a la última lista/) && cita("Falabella, Lider, Jumbo, Sodimac, Paris y Tottus caen por carga. Esas seis cuentas pesan 73.8% de la venta.", /«esas seis cuentas» remite .* sobran: Tottus/), "el pronombre o demostrativo remite a la última lista del párrafo: «esas cuentas», «su», y «esas seis cuentas» con Tottus en vez de Ripley arden diciendo la lista");
  ok(cita("El markup de los sanos es 57.3% (Easy, La Polar, Hites).", /«57\.3%» .* 3 nombres \(Easy, La Polar, Hites\) — quedan fuera: ABC, Unimarc/) && cita("Easy, La Polar y Hites promedian 57.3% de markup.", /quedan fuera: ABC, Unimarc/) && cita("Su precio de lista está más pegado al costo (markup 41.4% contra 57.3% en Easy, La Polar y Hites).", /«57\.3%»/), "la lista después de la cifra: «57.3% (Easy, La Polar, Hites)», «Easy, La Polar y Hites promedian 57.3%» y «57.3% en Easy, La Polar y Hites» arden con ABC y Unimarc faltando");
  ok(cita("Falabella, Lider, Jumbo y Sodimac caen. El precio de lista de los sanos está más lejos del costo que el de estos cuatro (markup 57.3% contra 41.4%).", /«41\.4%».*«estos cuatro»/) && !arde("El precio de lista de los sanos está más lejos del costo que el de los que caen (markup 57.3% contra 41.4%).") && !cita("Además, el precio de lista de estos cuatro está más pegado al costo que el de los sanos (markup 41.4% contra 57.3% en Easy/La Polar/Hites/ABC/Unimarc).", /«57\.3%»/), "cada referencia ata la cifra de SU lado de la comparación: «estos cuatro» tras «que el de» ata el 41.4% que va tras «contra», nunca el 57.3%; y la lista con barras de los cinco sanos no arde");
  ok(cita("La contribución no capturada de Falabella, Lider y Jumbo suma $4.9M.", /«\$4\.9M» es la cifra de un GRUPO de 5/) && cita("Falabella y Lider concentran $655K de carga comercial alta.", /«\$655K» es la cifra de un GRUPO de 6/) && cita("LG-DRYER8KG y BOS-SANDER suman $33K de capital frenado.", /«\$33K» es la cifra de un GRUPO de 3 .* quedan fuera: MAK-COMP-AIR/), "los subtotales también: $4.9M en tres, $655K en dos y $33K en dos SKU arden con su grupo");
  /* 5 · «N de M cuentas» con predicado: contra lo que la boleta permite contar */
  ok(cita("Cayendo (2 de 13 cuentas): Ripley y La Polar.", /«2 de 13 cuentas» caen: según la boleta son 4 de 13 \(Ripley, La Polar, Unimarc, Easy\) — sin nombrar: Unimarc, Easy/) && cita("Solo 2 de 13 cuentas caen: Ripley y La Polar.", /son 4 de 13/) && cita("Caen 3 de 13 cuentas.", /son 4 de 13/), "★ «Cayendo (2 de 13 cuentas)» arde: la boleta trae la variación de las 13 con signo y caen 4 (faltan Unimarc y Easy) — también «solo 2 de 13 caen» y «caen 3 de 13»");
  ok(cita("Hay 7 de 13 clientes bajo el benchmark.", /son 8 de 13/) && cita("Crecen 8 de 13 cuentas.", /crecen: según la boleta son 9 de 13/) && !arde("8 de 13 clientes están bajo el benchmark.") && !arde("5 de 13 cuentas están sobre el benchmark.") && !arde("4 de 13 cuentas caen: Ripley, La Polar, Easy y Unimarc."), "bajo/sobre el benchmark y crecen se derivan del ranking de brecha y de las variaciones: el conteo correcto pasa, el otro arde");
  ok(!arde("2 de 13 cuentas caen más de 8%: Ripley y La Polar.") && !arde("6 de 13 cuentas tienen carga sobre el nivel declarado.") && !arde("6 de 13 cuentas —Falabella, Lider, Jumbo, Sodimac, Paris y Ripley— están bajo el benchmark y con carga sobre el nivel.") && !arde("Resto (3 de 13) de contribución: $1.5M.") && !arde("Los 5 SKU que más venden son también los 5 que más contribución dejan (de 13 SKU en total)."), "no se juzga lo que no se puede derivar: un predicado con umbral («caen más de 8%»), el conteo material de la propia boleta («6 sobre el nivel declarado»), dos predicados intersecados (6), un «N de M» sin predicado ni sustantivo, y el eje SKU");
  /* 6 · el respaldo (ensamblador) y lo servido en las corridas no arden por la familia */
  const V6c = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo-vivo6-2026-09-14.json", import.meta.url), "utf8"));
  ok(!arde(V6c.final.texto) && V6c.final.estado === "encargo-compuesto", "el respaldo compuesto («$655K — la más pesada es la de Falabella ($194K)», «6 pagan margen en acciones comerciales (Falabella · Lider)») no arde: la respuesta de la casa sigue sirviéndose entera");
}

console.log(`\n── _prioridad_integrada_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
