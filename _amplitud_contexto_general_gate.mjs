/* === _amplitud_contexto_general_gate.mjs · AMPLITUD F3 · EL CONTRATO DE CONTEXTO GENERAL (suite 139 → 140) ====
 * La decisión D2 del owner (2026-08-13) vuelta contrato ejecutable. EL PRINCIPIO: el conocimiento general del
 * modelo es LO ÚNICO que el notario no puede verificar por CONTENIDO — no hay boleta contra la cual contrastar
 * «en la industria el margen suele moverse entre 28% y 34%». Así que se verifica EL CONTENEDOR.
 *
 * LAS CINCO GARANTÍAS DE LA FASE:
 *   1 · EL MARCO ES DEL MOTOR, NO DEL MODELO — texto exacto y textual; una copia literal escrita por el narrador
 *       se borra; el system ni siquiera se lo muestra, así que no puede copiar lo que no ve.
 *   2 · EL CONTENEDOR SE COBRA — adentro se tolera lo no verificable (es su función); nombrar una entidad del
 *       cliente o repetir una cifra suya adentro son BLOQUEOS, no avisos.
 *   3 · AFUERA NO CAMBIA NADA — la misma cifra fuera del bloque cae al muro de siempre, y por eso [[ACCION]] no
 *       puede citar el contexto general sin un chequeo nuevo: ya es estructural.
 *   4 · UNO SOLO, Y EN SU LUGAR — un bloque por respuesta (el segundo se descarta entero), después de la lectura
 *       del dato y de la acción, antes de la pregunta de cierre.
 *   5 · LAS RAMAS RESTRINGIDAS NO LO EMITEN — data_only/results_only no invocan al narrador (intacto), el renderer
 *       corre en UN solo lugar bajo `full`, y la exención del muro no existe fuera de `full`.
 * Una regla nueva del contrato = un caso ACÁ, en las dos direcciones.
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import {
  renderContextoGeneral, rangoContextoGeneral, MARCO_CONTEXTO_GENERAL, MARCA_CONTEXTO_GENERAL, stripAllMarks, parseBlocks,
} from "./src/adi/oracle/narrationBlocks.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { fig } from "./src/adi/boleta.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { buildNarrateSystemSegments } from "./src/adi/oracle/narratePromptC.js";
import { readFileSync } from "node:fs";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 220) : "")); } };

const CATALOGO = ["cliente", "sku", "marca"].flatMap((e) => axisEntityNames(e));
const DATO = cifrasDelDato("actual");
const LEDGER = { figs: [fig("Falabella · Margen", "21.0%", { unit: "pct", raw: 21 })] };
const BASE = {
  ledger: LEDGER, results: [{ facts: { name: "Falabella" }, coverage: { supported: true } }],
  question: "¿el margen de Falabella es normal?", entidadesDelTenant: CATALOGO, datoProyectado: DATO,
};
const v = (t, extra = {}) => guardC(t, { ...BASE, ...extra });
const kind = (t, extra = {}) => { const r = v(t, extra); return r.ok ? "OK" : r.verdict; };
const conBloque = (aporte, cuerpo = "Falabella marca 21.0% de margen en el año cerrado.") =>
  renderContextoGeneral(`${cuerpo}\n\n${MARCA_CONTEXTO_GENERAL} ${aporte}`);

console.log("── 1 · EL MARCO ES DEL MOTOR, NO DEL MODELO ──");
// el texto EXACTO es contrato: si alguien lo edita sin decidirlo, esto se pone rojo.
ok(MARCO_CONTEXTO_GENERAL === "Como contexto general — esto no viene de tu dato y no puedo verificarlo con tu información:",
  "el marco es el texto EXACTO acordado (registro formal, dice las dos cosas que el usuario necesita saber)", MARCO_CONTEXTO_GENERAL);
{
  const r = conBloque("En este rubro suele moverse entre 28% y 34%, según lo que conozco.");
  ok(r.includes(MARCO_CONTEXTO_GENERAL) && !r.includes(MARCA_CONTEXTO_GENERAL), "el renderer antepone el marco y consume la marca");
  ok(r.split(MARCO_CONTEXTO_GENERAL).length - 1 === 1, "el marco aparece exactamente UNA vez");
  // forjado por el modelo, con y sin marca: nunca queda un marco que el motor no haya puesto.
  const forjado = renderContextoGeneral(`Lectura del dato. ${MARCO_CONTEXTO_GENERAL} la industria estaría en 37%.`);
  ok(!forjado.includes(MARCO_CONTEXTO_GENERAL), "un marco escrito por el modelo SIN marca se borra entero");
  ok(kind(forjado) === "cifra-no-autorizada", "…y su cifra queda bajo el muro de siempre", kind(forjado));
  const dentro = renderContextoGeneral(`Lectura.\n\n${MARCA_CONTEXTO_GENERAL} ${MARCO_CONTEXTO_GENERAL} suele estar entre 28% y 34%.`);
  ok(dentro.split(MARCO_CONTEXTO_GENERAL).length - 1 === 1, "una copia DENTRO del bloque tampoco duplica el marco");
  const fijo = buildNarrateSystemSegments("P", "M", "decision", null, false, null, null).fijo;
  ok(!fijo.includes(MARCO_CONTEXTO_GENERAL), "el system NO le muestra el texto del marco: no puede copiar lo que no ve");
  ok(/El encabezado del bloque lo pone el motor, no vos/.test(fijo), "y la doctrina se lo prohíbe explícitamente");
}

console.log("── 2 · EL CONTENEDOR SE COBRA (bidireccional) ──");
{
  ok(v(conBloque("En este rubro el margen bruto suele moverse entre 28% y 34%, según lo que conozco, que tiene fecha de corte.")).ok,
    "(a) un rango no verificable DENTRO del bloque pasa — es exactamente la función del bloque");
  ok(kind(conBloque("Falabella suele operar entre 28% y 34% según la industria.")) === "contexto-general-con-entidad",
    "(b) una entidad de la cartera adentro → BLOQUEO");
  ok(kind(conBloque("Una cadena como Falabella factura del orden de $80M al año.", "Te respondo con lo que tengo.")) === "contexto-general-con-entidad",
    "(b) el anti-contrabando: «cuánto vendió Falabella según la industria» no tiene camino");
  ok(kind(conBloque("Lider está bastante por encima de ese nivel.")) === "contexto-general-con-entidad",
    "(b) una entidad AUSENTE del turno también: por eso el catálogo del tenant viaja al muro");
  ok(kind(conBloque("Samsung se mueve en rangos más altos.")) === "contexto-general-con-entidad", "(b) vale para marcas");
  ok(kind(conBloque("SAM-TV55 se mueve en rangos más altos.")) === "contexto-general-con-entidad", "(b) y para SKU");
  ok(kind(conBloque("La referencia de la industria está en 21.0%.")) === "contexto-general-con-cifra-del-cliente",
    "(c) una cifra del turno adentro → BLOQUEO");
  ok(kind(conBloque("La referencia de la industria está en 21%.")) === "contexto-general-con-cifra-del-cliente",
    "(c) …y se caza escrita corta: la vara es unidad+valor, nunca el canon string");
  ok(guardC(conBloque("Efectivamente, la industria de este rubro está en 25%.", "Anotado."),
    { ...BASE, question: "una noticia dice que el margen de la industria debería estar en 25%, ¿cuál es el nuestro?" }).verdict === "contexto-general-con-cifra-del-cliente",
    "(c) el lavado del caso canónico: la cifra del usuario devuelta como conocimiento de la industria → BLOQUEO");
  const monto = DATO.figs.find((f) => /^money:/.test(f.canon) && f.value);
  ok(kind(conBloque(`Un actor de este tamaño mueve del orden de ${monto.value} al año.`)) === "contexto-general-con-cifra-del-cliente",
    `(c) un MONTO del dato del negocio (${monto.value}) adentro → BLOQUEO`);
  // LOS DOS SON BLOQUEOS, NO AVISOS: la exención se paga con estas condiciones, y una condición que no bloquea no
  // es una condición.
  for (const t of [conBloque("Falabella suele operar más arriba."), conBloque("La industria está en 21.0%.")]) {
    ok(!v(t).ok && v(t).advisories.every((a) => !/contexto-general/.test(a.kind)), "…y bloquean de verdad (violation, jamás advisory)");
  }
  // la forma CORRECTA del mismo turno pasa: la cifra del cliente AFUERA, el rango propio ADENTRO.
  ok(v(renderContextoGeneral(`Tu margen es 21.0% en el año cerrado.\n\n${MARCA_CONTEXTO_GENERAL} En este rubro suele moverse entre 28% y 34%, según lo que conozco.`)).ok,
    "la forma CORRECTA pasa: cifra del cliente afuera (autorizada), rango propio adentro");
}

console.log("── 3 · AFUERA NO CAMBIA NADA (y por eso [[ACCION]] ya es estructural) ──");
{
  ok(kind("Falabella marca 21.0% de margen y en el rubro se mueve cerca del 37%.") === "cifra-no-autorizada",
    "la misma clase de cifra, fuera del bloque, cae al chequeo 1 de siempre");
  const repetida = renderContextoGeneral(`Falabella marca 21.0% de margen.\n\nEmpezá por sus acciones comerciales: el objetivo es el 37%.\n\n${MARCA_CONTEXTO_GENERAL} En este rubro suele moverse cerca del 37%.`);
  ok(kind(repetida) === "cifra-no-autorizada" && v(repetida).violations[0].detail === "37%",
    "una cifra del bloque REPETIDA en la acción se veta — sin chequeo nuevo: es estructural", kind(repetida));
  // la exención NO existe fuera de `full`: es lo que impide comprársela desde un texto determinístico que ecoe la marca.
  const rendereado = conBloque("En el rubro se mueve cerca del 37%.", "Lectura del dato.");
  ok(kind(rendereado) === "OK", "bajo full el bloque exime");
  for (const sc of ["action_only", "data_only", "results_only"]) {
    ok(kind(rendereado, { contentScope: sc }) === "cifra-no-autorizada", `bajo ${sc} el MISMO texto se veta: no hay exención`, kind(rendereado, { contentScope: sc }));
  }
  // el bloque tampoco le presta un dueño a una cifra de afuera (el enmascarado conserva los saltos de línea, así
  // que las ventanas de oración de los chequeos de dueño siguen cortando donde cortaban).
  const kinds = v(renderContextoGeneral(`Las ventas alcanzan $17.9M.\n\n${MARCA_CONTEXTO_GENERAL} Lider es la referencia del rubro.`)).violations.map((x) => x.kind);
  ok(kinds.includes("cifra-de-dato-sin-dueno") && kinds.includes("contexto-general-con-entidad"),
    "el bloque no le presta el dueño a una cifra de afuera, y nombrarlo adentro se veta", kinds.join(","));
}

console.log("── 4 · UNO SOLO, Y EN SU LUGAR ──");
{
  const r = renderContextoGeneral(`Falabella marca 21.0% de margen.\n\nEmpezá por sus acciones comerciales.\n\n${MARCA_CONTEXTO_GENERAL} En el rubro suele estar más arriba.\n\n¿Querés que veamos la composición?`);
  const p = r.split(/\n{2,}/);
  ok(p[p.length - 2].startsWith(MARCO_CONTEXTO_GENERAL) && /\?\s*$/.test(p[p.length - 1]),
    "el bloque va DESPUÉS del dato y la acción, y ANTES de la pregunta de cierre", JSON.stringify(p));
  ok(p[0].includes("21.0%") && p[1].includes("acciones comerciales"), "la lectura y la acción quedan intactas, en su orden");
  const dos = renderContextoGeneral(`Lectura.\n\n${MARCA_CONTEXTO_GENERAL} El primero.\n\n${MARCA_CONTEXTO_GENERAL} El segundo, en torno al 37%.`);
  ok(dos.split(MARCO_CONTEXTO_GENERAL).length - 1 === 1 && dos.includes("El primero") && !dos.includes("El segundo"),
    "dos bloques → queda el PRIMERO y el segundo se descarta ENTERO (nunca desmarcado, que lo dejaría como prosa)", dos);
  ok(!/37%/.test(dos), "…así que el contenido descartado no reaparece como prosa sin autorizar");
  const vacia = renderContextoGeneral(`Lectura del dato.\n\n${MARCA_CONTEXTO_GENERAL}\n\n¿Seguimos?`);
  ok(!vacia.includes(MARCO_CONTEXTO_GENERAL), "una marca vacía no fabrica un marco encabezando la nada");
  const rango = rangoContextoGeneral(r);
  ok(rango && r.slice(rango[0], rango[1]).startsWith(MARCO_CONTEXTO_GENERAL) && !r.slice(rango[0], rango[1]).includes("\n\n"),
    "el rango que consume el muro delimita EXACTAMENTE el párrafo del bloque (renderer y muro no pueden discrepar)");
}

console.log("── 5 · LAS RAMAS RESTRINGIDAS NO LO EMITEN · ADITIVIDAD ──");
{
  // @inspeccion-estatica: se lee el motor como TEXTO para certificar el cableado. No se importa el gateway ni se
  // invoca a nadie (las dos condiciones que el clasificador de gates:offline verifica por su cuenta).
  const SRC = readFileSync(new URL("./src/adi/oracle/answerViaOracle.js", import.meta.url), "utf8");
  ok(/pref\.contentScope !== "data_only" && pref\.contentScope !== "results_only"\) for \(let attempt/.test(SRC),
    "el bucle de narración libre sigue excluyendo data_only/results_only (garantía por construcción, intacta)");
  ok(/if \(pref\.contentScope === "full"\) n = renderContextoGeneral\(n\);/.test(SRC), "el renderer del bloque corre SOLO bajo full");
  ok((SRC.match(/renderContextoGeneral\(/g) || []).length === 1, "…y en UN solo lugar de todo el motor");
  const iRender = SRC.indexOf("renderContextoGeneral(n);");
  const iBrief = SRC.indexOf("truncateToBriefBudget(n)");
  const iGuard = SRC.indexOf("const gVerdict = guardC(n,");
  ok(iRender > 0 && iBrief > iRender,
    "…y ANTES del tope de brevedad, que es estructural: el bloque compite por el presupuesto, no se lo saltea", `${iRender} / ${iBrief}`);
  ok(iGuard > iRender,
    "…y ANTES del muro: guardC juzga EXACTAMENTE el texto que se publica, no una versión que después se reacomoda", `${iRender} / ${iGuard}`);
  // la marca nunca llega al usuario, la haya rendereado alguien o no: stripAllMarks es la red de último recurso.
  ok(!stripAllMarks(`No tengo información autorizada: ${MARCA_CONTEXTO_GENERAL} el margen mundial.`).includes(MARCA_CONTEXTO_GENERAL),
    "stripAllMarks borra la marca aunque llegue por eco a un texto determinístico (ahí muere)");
  ok(!parseBlocks(`[[DATOS]] x\n${MARCA_CONTEXTO_GENERAL} y`).contexto_general,
    "CONTEXTO_GENERAL no es una clave de parseBlocks: el sistema de bloques de contentScope no se reestructuró");
  // ADITIVIDAD: sin bloque, el veredicto es idéntico con y sin las piezas nuevas.
  const bateria = [
    "Falabella marca 21.0% de margen sobre $19.4M de ventas en el año cerrado.",
    "Falabella marca 21.0% de margen y la industria está en 37%.",
    "La cartera tiene 9 clientes bajo el benchmark.",
    "| Concepto | Valor |\n|---|---|\n| Falabella · Margen | 21.0% |",
    "",
  ];
  const sinPiezas = { ledger: LEDGER, results: BASE.results, question: BASE.question, datoProyectado: DATO };
  ok(bateria.every((t) => JSON.stringify(guardC(t, BASE)) === JSON.stringify(guardC(t, sinPiezas))),
    `sin bloque el veredicto es IDÉNTICO con y sin las piezas nuevas (${bateria.length} narraciones)`);
  ok(bateria.every((t) => rangoContextoGeneral(t) === null), "…y sin marco no hay nada que enmascarar: los 25 chequeos ven el texto entero");
  ok(bateria.every((t) => renderContextoGeneral(t) === t), "…y el renderer devuelve el texto byte-idéntico");
}

console.log(`\n${PASS} PASS · ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
