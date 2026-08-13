/* === _probe_amplitud_f3.mjs · AMPLITUD F3 · EL CONTRATO DE CONTEXTO GENERAL — probe integral ==================
 * La decisión D2 del owner (2026-08-13) y sus TRES REGLAS, ejercitadas de punta a punta:
 *   1 · EL RENDERER — el marco fijo lo pone el motor, el bloque va antes de la pregunta de cierre, uno solo por
 *       respuesta, y sin marca el texto sale byte-idéntico.
 *   2 · EL MARCO NO PUEDE VENIR DEL MODELO — copias literales borradas, con y sin marca.
 *   3 · EL MURO VERIFICA EL CONTENEDOR — adentro tolera lo no verificable; veta entidad del cliente y cifra del
 *       cliente; AFUERA el chequeo 1 sigue byte-idéntico (incluido el caso [[ACCION]], que es estructural).
 *   4 · LAS RAMAS RESTRINGIDAS — data_only/results_only jamás emiten el bloque, y se afirma DÓNDE muere la marca.
 *   5 · ADITIVIDAD — sin bloque, el veredicto del muro es idéntico con y sin las piezas nuevas.
 *   6 · FALSOS POSITIVOS MEDIDOS del veto (b), eje por eje — la medición que sostiene la elección de los 3 ejes.
 * Offline puro: cero red, cero credencial, cero gateway. Se corre suelto con `node --import ./scripts/offline-guard.mjs`.
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import {
  renderContextoGeneral, rangoContextoGeneral, MARCO_CONTEXTO_GENERAL, MARCA_CONTEXTO_GENERAL,
  stripAllMarks, parseBlocks, renderFromBlocks, componerPorForma, composeNoDataMessage,
} from "./src/adi/oracle/narrationBlocks.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { fig, parseFigures as parseFiguresDelProbe } from "./src/adi/boleta.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { buildNarrateSystemSegments } from "./src/adi/oracle/narratePromptC.js";
import { readFileSync } from "node:fs";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 240) : "")); } };

// EL CATÁLOGO REAL DEL TENANT, con los MISMOS tres ejes que inyecta answerViaOracle (contrapartes nombradas).
const CATALOGO = ["cliente", "sku", "marca"].flatMap((e) => axisEntityNames(e));
const DATO = cifrasDelDato("actual");

// una boleta chica y realista: el margen de Falabella y su benchmark.
const LEDGER = { figs: [
  fig("Falabella · Margen", "21.0%", { unit: "pct", raw: 21 }),
  fig("Falabella · Ventas", "$19.4M", { unit: "money", raw: 19400000 }),
] };
const RESULTS = [{ facts: { name: "Falabella" }, coverage: { supported: true } }];
const BASE = { ledger: LEDGER, results: RESULTS, question: "¿el margen de Falabella es normal?", entidadesDelTenant: CATALOGO, datoProyectado: DATO };
const veredicto = (t, extra = {}) => guardC(t, { ...BASE, ...extra });
const kind = (t, extra = {}) => { const v = veredicto(t, extra); return v.ok ? "OK" : v.verdict; };

console.log("── 1 · EL RENDERER: EL MARCO LO PONE EL MOTOR, Y EL BLOQUE VA EN SU LUGAR ──");
{
  const crudo = "Falabella marca 21.0% de margen sobre $19.4M de ventas.\n\nEmpezá por sus acciones comerciales.\n\n[[CONTEXTO_GENERAL]]\nEn este tipo de negocio el margen bruto suele moverse entre 28% y 34%, según lo que conozco, que tiene fecha de corte.\n\n¿Querés que veamos la composición?";
  const r = renderContextoGeneral(crudo);
  ok(r.includes(MARCO_CONTEXTO_GENERAL), "el render ANTEPONE el marco fijo, textual");
  ok(!r.includes(MARCA_CONTEXTO_GENERAL), "la marca [[CONTEXTO_GENERAL]] no sobrevive al render");
  const parrafos = r.split(/\n{2,}/);
  const iBloque = parrafos.findIndex((p) => p.startsWith(MARCO_CONTEXTO_GENERAL));
  ok(iBloque === parrafos.length - 2 && /\?\s*$/.test(parrafos[parrafos.length - 1]),
    "el bloque va DESPUÉS del dato y la acción, y ANTES de la pregunta de cierre", JSON.stringify(parrafos));
  ok(parrafos[0].includes("21.0%") && parrafos[1].includes("acciones comerciales"),
    "la lectura del dato y la acción quedan intactas y en su orden");
  ok(r.split(MARCO_CONTEXTO_GENERAL).length - 1 === 1, "el marco aparece EXACTAMENTE una vez");
  // sin pregunta de cierre, el bloque cierra el texto (y las garantías posteriores se suman detrás, como siempre)
  const sinPregunta = renderContextoGeneral("Lectura del dato.\n\n[[CONTEXTO_GENERAL]] La industria suele estar más arriba.");
  ok(sinPregunta.split(/\n{2,}/).pop().startsWith(MARCO_CONTEXTO_GENERAL), "sin pregunta de cierre, el bloque cierra el texto");
  // el bloque es UN párrafo: el renderer colapsa los saltos internos, así que el rango es inequívoco para el muro
  const multi = renderContextoGeneral("Lectura.\n\n[[CONTEXTO_GENERAL]]\nPrimera línea del aporte.\nSegunda línea del aporte.");
  ok(/Primera línea del aporte\. Segunda línea del aporte\./.test(multi), "el contenido del bloque queda en UN párrafo");
  const rango = rangoContextoGeneral(multi);
  ok(rango && multi.slice(rango[0], rango[1]).startsWith(MARCO_CONTEXTO_GENERAL) && !multi.slice(rango[0], rango[1]).includes("\n\n"),
    "rangoContextoGeneral delimita EXACTAMENTE el párrafo del bloque", JSON.stringify(rango));
}

console.log("── 1b · UNO SOLO POR RESPUESTA · MARCA VACÍA · SIN MARCA ──");
{
  const dos = renderContextoGeneral("Lectura.\n\n[[CONTEXTO_GENERAL]] El primero, entre 28% y 34%.\n\n[[CONTEXTO_GENERAL]] El segundo, en torno al 12%.\n\n¿Seguimos?");
  ok(dos.split(MARCO_CONTEXTO_GENERAL).length - 1 === 1, "dos bloques → queda UNO");
  ok(dos.includes("El primero") && !dos.includes("El segundo"),
    "el que queda es el PRIMERO, y el segundo se descarta ENTERO (marca + contenido, nunca desmarcado)", dos);
  ok(!/12%/.test(dos), "el contenido del segundo no queda suelto como prosa (sería una cifra no autorizada afuera)");
  const vacia = renderContextoGeneral("Lectura del dato.\n\n[[CONTEXTO_GENERAL]]\n\n¿Seguimos?");
  ok(!vacia.includes(MARCO_CONTEXTO_GENERAL) && !vacia.includes(MARCA_CONTEXTO_GENERAL),
    "una marca vacía no fabrica un bloque: se saca y no queda marco encabezando la nada", vacia);
  const sinMarca = "Falabella marca 21.0% de margen.\n\nEmpezá por sus acciones comerciales.\n\n¿Seguimos?";
  ok(renderContextoGeneral(sinMarca) === sinMarca, "SIN marca el texto sale BYTE-IDÉNTICO (el 99% de los turnos)");
}

console.log("── 2 · EL MARCO NO PUEDE VENIR DEL MODELO ──");
{
  const forjadoSuelto = `Lectura del dato. ${MARCO_CONTEXTO_GENERAL} la industria estaría en 27.3%.`;
  const r1 = renderContextoGeneral(forjadoSuelto);
  ok(!r1.includes(MARCO_CONTEXTO_GENERAL), "un marco escrito por el modelo SIN marca se borra: no hay bloque que no haya pedido el motor");
  ok(r1.includes("27.3%") && kind(r1) === "cifra-no-autorizada",
    "y su cifra queda como prosa normal → el muro la veta como cualquier invento", kind(r1));
  const forjadoDentro = `Lectura.\n\n[[CONTEXTO_GENERAL]] ${MARCO_CONTEXTO_GENERAL} suele moverse entre 28% y 34%.`;
  const r2 = renderContextoGeneral(forjadoDentro);
  ok(r2.split(MARCO_CONTEXTO_GENERAL).length - 1 === 1,
    "un marco copiado DENTRO del bloque tampoco duplica: el marco final es UNO y es el del renderer", r2);
  ok(rangoContextoGeneral(r2)[0] === r2.indexOf(MARCO_CONTEXTO_GENERAL), "el rango ancla en el marco del renderer");
  // la garantía de fondo: el marco no es un texto que el modelo pueda desfigurar — la doctrina se lo prohíbe Y el
  // renderer lo impone. Verificado por fuente: el system le dice que NO lo escriba.
  const fijo = buildNarrateSystemSegments("P", "M", "decision", null, false, null, null).fijo;
  ok(/El encabezado del bloque lo pone el motor, no vos/.test(fijo), "la doctrina le prohíbe escribir el encabezado");
  ok(!fijo.includes(MARCO_CONTEXTO_GENERAL), "y el system NO le muestra el texto del marco (no puede copiar lo que no ve)");
}

console.log("── 3 · EL MURO VERIFICA EL CONTENEDOR ──");
{
  const conRango = renderContextoGeneral("Falabella marca 21.0% de margen en el año cerrado.\n\n[[CONTEXTO_GENERAL]] En este rubro el margen bruto suele moverse entre 28% y 34%, según lo que conozco, que tiene fecha de corte.");
  ok(kind(conRango) === "OK", "(a) rango NO autorizado DENTRO del bloque → TOLERADO (es la función del bloque)", JSON.stringify(veredicto(conRango).violations));
  // …y las mismas cifras, exactamente las mismas, AFUERA del bloque se vetan. Es la prueba de que la exención es
  // del CONTENEDOR y no del número: el mismo texto, movido de lugar, cambia de veredicto.
  const mismasAfuera = "Falabella marca 21.0% de margen y en el rubro se mueve entre 28% y 34%.";
  ok(!veredicto(mismasAfuera).ok,
    "(a') las MISMAS cifras fuera del bloque → VETADAS: la exención es del contenedor, no del número", kind(mismasAfuera));
  // el veredicto exacto depende de si esa cifra además existe en el dato del negocio (ahí manda la quinta fuente,
  // que es más precisa). Con una cifra LIBRE —37%, ver §6b— se ve el veredicto limpio del chequeo 1.
  ok(kind("Falabella marca 21.0% de margen y en el rubro se mueve cerca del 37%.") === "cifra-no-autorizada",
    "(a'') y con una cifra libre el veredicto es el de siempre, textual: cifra-no-autorizada",
    kind("Falabella marca 21.0% de margen y en el rubro se mueve cerca del 37%."));

  const conEntidad = renderContextoGeneral("Falabella marca 21.0% de margen.\n\n[[CONTEXTO_GENERAL]] Falabella suele operar entre 28% y 34% según lo que se ve en la industria.");
  ok(kind(conEntidad) === "contexto-general-con-entidad", "(b) entidad del cliente DENTRO del bloque → VETO", kind(conEntidad));
  // EL ANTI-CONTRABANDO, en su forma canónica: «¿cuánto vendió Falabella según la industria?» no tiene camino.
  const contrabando = renderContextoGeneral("Te respondo con lo que tengo.\n\n[[CONTEXTO_GENERAL]] Una cadena como Falabella suele facturar del orden de $80M al año en esta categoría.");
  ok(kind(contrabando) === "contexto-general-con-entidad",
    "(b') «cuánto vendió Falabella según la industria» NO tiene camino: nombrarla adentro se veta");
  ok(veredicto(contrabando).violations[0].detail.includes("Falabella"), "el detalle nombra la entidad que hay que sacar");
  // una entidad que NO entró a ninguna tool de este turno también se veta — por eso hace falta el catálogo del
  // tenant y no alcanzan las entidades del turno (Lider no está en RESULTS ni en el ledger).
  const otraEntidad = renderContextoGeneral("Lectura.\n\n[[CONTEXTO_GENERAL]] Lider suele estar bastante por encima de ese nivel.");
  ok(kind(otraEntidad) === "contexto-general-con-entidad",
    "(b'') una entidad AUSENTE del turno también se veta — para eso viaja el catálogo del tenant");
  ok(kind(otraEntidad, { entidadesDelTenant: null }) !== "contexto-general-con-entidad",
    "y sin catálogo inyectado ESA no se cazaría: la inyección del caller es lo que cierra el hueco (degradación medida, no supuesta)");
  ok(kind(conEntidad, { entidadesDelTenant: null }) === "contexto-general-con-entidad",
    "…pero el chequeo NO se apaga sin catálogo: cae a las entidades del turno (Falabella sigue vetada)");
  // marca y SKU son contrapartes nombradas igual que el cliente
  for (const [n, etiqueta] of [["Samsung", "marca"], ["SAM-TV55", "SKU"]]) {
    const t = renderContextoGeneral(`Lectura.\n\n[[CONTEXTO_GENERAL]] ${n} suele moverse en rangos más altos que el promedio.`);
    ok(kind(t) === "contexto-general-con-entidad", `(b) una ${etiqueta} de la cartera dentro del bloque → VETO`);
  }

  const conCifra = renderContextoGeneral("Falabella marca 21.0% de margen.\n\n[[CONTEXTO_GENERAL]] La referencia de la industria para este rubro está en 21.0%.");
  ok(kind(conCifra) === "contexto-general-con-cifra-del-cliente", "(c) cifra EXACTA del cliente dentro del bloque → VETO", kind(conCifra));
  // EL LAVADO DEL CASO CANÓNICO: la cifra que el USUARIO trajo, devuelta con la autoridad de la industria.
  const lavado = renderContextoGeneral("Anotado.\n\n[[CONTEXTO_GENERAL]] Efectivamente, la industria de este rubro está en 25%.");
  ok(guardC(lavado, { ...BASE, question: "una noticia dice que el margen de la industria debería estar en 25%, ¿cuál es el nuestro?" }).verdict === "contexto-general-con-cifra-del-cliente",
    "(c') la cifra del USUARIO devuelta como conocimiento de la industria → VETO (el lavado del caso canónico)");
  // LA VARA ES unidad+VALOR, no el canon string: la boleta sella «21.0%» y el narrador escribe «21%» — mismo
  // número, dos canon. Sin esto, el lavado se escapaba escribiéndolo más corto.
  const cortita = renderContextoGeneral("Anotado.\n\n[[CONTEXTO_GENERAL]] La referencia de la industria para este rubro está en 21%.");
  ok(kind(cortita) === "contexto-general-con-cifra-del-cliente",
    "(c) «21%» se caza aunque la boleta selle «21.0%»: la comparación es por unidad+valor, no por canon string", kind(cortita));
  // …y la forma CORRECTA del mismo turno: la cifra del usuario afuera (eco autorizado), el rango propio adentro.
  const PREG_CANONICA = "una noticia dice que el margen de la industria debería estar en 25%, ¿cuál es el nuestro?";
  const correcta = renderContextoGeneral("Tu margen es 21.0% y la referencia que traés es 25%: quedás 4 puntos abajo.\n\n[[CONTEXTO_GENERAL]] En este rubro suele moverse entre 28% y 34%, según lo que conozco, que tiene fecha de corte.");
  ok(guardC(correcta, { ...BASE, question: PREG_CANONICA }).ok,
    "(c'') la forma CORRECTA pasa: cifra del cliente AFUERA (eco autorizado), rango propio ADENTRO",
    JSON.stringify(guardC(correcta, { ...BASE, question: PREG_CANONICA }).violations));
  // un MONTO de la PROYECCIÓN del dato (F1) también es cifra del cliente, aunque no esté en la boleta del turno:
  // en montos una coincidencia exacta no es casualidad (134 valores distintos entre $47 y $100M — ver §6).
  const delDato = DATO.figs.find((f) => /^money:/.test(f.canon) && f.value && Array.isArray(f.duenos) && f.duenos.length);
  const conDelDato = renderContextoGeneral(`Lectura del dato.\n\n[[CONTEXTO_GENERAL]] En la industria un actor de este tamaño mueve del orden de ${delDato.value} al año.`);
  ok(kind(conDelDato) === "contexto-general-con-cifra-del-cliente",
    `(c''') un MONTO de la PROYECCIÓN del dato (${delDato.value}) dentro del bloque → VETO`, kind(conDelDato));
}

console.log("── 3b · [[ACCION]] NO CITA CIFRAS DEL BLOQUE: YA ES ESTRUCTURAL (sin chequeo redundante) ──");
{
  // 37% es una cifra LIBRE en este dato (§6b mide cuáles lo son): así el veredicto es el limpio del chequeo 1 y no
  // el de la quinta fuente, que es más preciso pero taparía lo que esta sección quiere demostrar.
  const repetida = renderContextoGeneral("Falabella marca 21.0% de margen.\n\nEmpezá por sus acciones comerciales: llevarla al 37% del rubro es el objetivo.\n\n[[CONTEXTO_GENERAL]] En este rubro suele moverse cerca del 37%.");
  ok(kind(repetida) === "cifra-no-autorizada",
    "una cifra del bloque REPETIDA fuera de él cae al chequeo 1 → veto (no hace falta un chequeo nuevo)", kind(repetida));
  ok(veredicto(repetida).violations[0].detail === "37%", "y el detalle señala exactamente esa cifra", veredicto(repetida).violations[0].detail);
  // y una cifra del bloque que TAMBIÉN está en el dato del negocio no se escapa: cae a la quinta fuente (F1), que
  // exige nombrar al dueño — otro veto, más preciso. La conclusión de (d) es la misma por las dos vías.
  const repetidaDelDato = renderContextoGeneral("Falabella marca 21.0% de margen.\n\nEmpezá por llevarla al 31%.\n\n[[CONTEXTO_GENERAL]] En este rubro suele moverse cerca del 31%.");
  ok(!veredicto(repetidaDelDato).ok && /cifra-no-autorizada|cifra-de-dato-sin-dueno/.test(veredicto(repetidaDelDato).verdict),
    "…y si además existe en el dato, la quinta fuente la veta igual (dueño en la misma oración)", kind(repetidaDelDato));
  /* BAJO action_only NO HAY BLOQUE, y conviene ser exacto sobre POR QUÉ: `CONTEXTO_GENERAL` NO es una clave de
   * parseBlocks (es un inset, no una categoría del reparto — ver narrationBlocks.js), así que el renderer de
   * bloques no lo poda: su texto queda DENTRO del trozo [[ACCION]] como prosa cualquiera. Ahí está la garantía —
   * sin exención, el muro entero lo juzga y lo veta. Fail-closed, no invisible. */
  const conAccion = "[[ACCION]] Empezá por sus acciones comerciales, apuntando al 37%.\n\n[[CONTEXTO_GENERAL]] En el rubro se mueve cerca del 37%.";
  const soloAccion = stripAllMarks(renderFromBlocks(parseBlocks(conAccion), "action_only"));
  ok(!soloAccion.includes(MARCO_CONTEXTO_GENERAL), "bajo action_only no aparece ningún marco: el bloque nunca se rendereó");
  ok(!veredicto(soloAccion, { contentScope: "action_only" }).ok,
    "…y su texto queda bajo el muro ENTERO, sin exención → vetado", kind(soloAccion, { contentScope: "action_only" }));
  // …y la exención del contenedor NO aplica fuera de `full`, aunque el marco esté escrito: es lo que impide
  // comprarse la exención desde un texto determinístico que ecoe la marca.
  const rendereado = renderContextoGeneral("Lectura del dato.\n\n[[CONTEXTO_GENERAL]] En el rubro se mueve cerca del 37%.");
  ok(kind(rendereado) === "OK", "con contentScope=full, el bloque exime", kind(rendereado));
  for (const sc of ["action_only", "data_only", "results_only"]) {
    ok(kind(rendereado, { contentScope: sc }) === "cifra-no-autorizada",
      `con contentScope=${sc} NO hay exención: el mismo texto se veta`, kind(rendereado, { contentScope: sc }));
  }
}

console.log("── 4 · data_only / results_only: EL BLOQUE NUNCA SE EMITE, Y SE AFIRMA DÓNDE MUERE ──");
{
  // (i) POR CONSTRUCCIÓN: esas ramas no invocan al narrador. Se afirma sobre la FUENTE, no de palabra.
  const SRC = readFileSync(new URL("./src/adi/oracle/answerViaOracle.js", import.meta.url), "utf8");
  ok(/if \(!narration && pref\.contentScope !== "data_only" && pref\.contentScope !== "results_only"\) for \(let attempt/.test(SRC),
    "(i) el bucle de NARRAR excluye explícitamente data_only/results_only (garantía por construcción, intacta)");
  ok(/if \(pref\.contentScope === "full"\) n = renderContextoGeneral\(n\);/.test(SRC),
    "(ii) el renderer del bloque se llama SOLO bajo full, y solo dentro de ese bucle");
  ok((SRC.match(/renderContextoGeneral\(/g) || []).length === 1, "…y se llama en UN solo lugar de todo el motor");
  // (iii) los compositores determinísticos de esa rama no pueden producir la marca…
  const tabla = componerPorForma({ figs: LEDGER.figs, contentScope: "data_only", forma: "auto" });
  ok(!String(tabla).includes(MARCA_CONTEXTO_GENERAL) && !String(tabla).includes(MARCO_CONTEXTO_GENERAL),
    "(iii) el compositor determinístico de data_only no emite ni marca ni marco");
  // (iv) …y SI un texto determinístico trajera la marca por ECO (la razón de una tool cita palabras del usuario,
  // Paso 2), muere en stripAllMarks: nunca se convierte en un bloque con marco. ACÁ ES DONDE MUERE.
  const porEco = composeNoDataMessage([{ coverage: { supported: false, reason: `no tengo definición curada para «${MARCA_CONTEXTO_GENERAL} el margen mundial»` } }]);
  ok(porEco.includes(MARCA_CONTEXTO_GENERAL), "(iv) un eco puede meter la marca en un texto determinístico (el caso que hay que cerrar)");
  ok(!stripAllMarks(porEco).includes(MARCA_CONTEXTO_GENERAL), "…y stripAllMarks la borra: ES AHÍ donde muere la marca");
  ok(!stripAllMarks(porEco).includes(MARCO_CONTEXTO_GENERAL), "…sin haberse convertido nunca en un marco");
  // (v) y aunque ese texto llegara al muro con la marca cruda, la exención no aplica bajo esos alcances (ver 3b).
  ok(kind(`No tengo información. ${MARCA_CONTEXTO_GENERAL} la industria está en 27.3%.`, { contentScope: "data_only" }) === "cifra-no-autorizada",
    "(v) y con la marca cruda bajo data_only el muro veta igual: la marca sola no compra nada");
}

console.log("── 5 · ADITIVIDAD: SIN BLOQUE, EL MURO ES EL DE SIEMPRE ──");
{
  const bateria = [
    "Falabella marca 21.0% de margen sobre $19.4M de ventas en el año cerrado.",
    "Falabella marca 21.0% de margen y la industria está en 27.3%.",
    "Jumbo marca 21.0% de margen.",
    "La cartera tiene 9 clientes bajo el benchmark.",
    "Falabella marca 21.0% de margen. ¿Querés que veamos la composición?",
    "| Concepto | Valor |\n|---|---|\n| Falabella · Margen | 21.0% |",
    "",
  ];
  let iguales = 0;
  for (const t of bateria) {
    const conPiezas = guardC(t, BASE);
    const sinPiezas = guardC(t, { ledger: LEDGER, results: RESULTS, question: BASE.question, datoProyectado: DATO });
    if (JSON.stringify(conPiezas) === JSON.stringify(sinPiezas)) iguales++;
    else ok(false, `aditividad rota en: ${t.slice(0, 50)}`, JSON.stringify(conPiezas.violations) + " vs " + JSON.stringify(sinPiezas.violations));
  }
  ok(iguales === bateria.length, `sin bloque, el veredicto es IDÉNTICO con y sin las piezas nuevas (${iguales}/${bateria.length})`);
  // y el enmascarado tampoco corre: el texto que ve cada chequeo es el original
  ok(rangoContextoGeneral(bateria[0]) === null, "sin marco no hay rango que enmascarar: los 25 chequeos ven el texto entero");
  // una narración válida sigue válida y una inventada sigue vetada por el MISMO kind
  ok(kind(bateria[0]) === "OK" && kind(bateria[1]) === "cifra-no-autorizada",
    "los veredictos de siempre no se movieron (autorizada OK · inventada vetada)", `${kind(bateria[0])} / ${kind(bateria[1])}`);
  /* EL BLOQUE NO LE PRESTA UN DUEÑO A UNA CIFRA DE AFUERA. Enmascarar conserva los saltos de línea, así que las
   * ventanas de oración de los chequeos de dueño siguen cortando donde cortaban: «Lider», nombrado adentro, NO
   * satisface la condición de dueño que la quinta fuente le cobra a «$17.9M», que está afuera. Se ven las DOS
   * violaciones en el mismo veredicto, que es exactamente lo que hay que demostrar. */
  const prestado = renderContextoGeneral("Las ventas alcanzan $17.9M.\n\n[[CONTEXTO_GENERAL]] Lider es la referencia del rubro.");
  const kinds = veredicto(prestado).violations.map((v) => v.kind);
  ok(kinds.includes("cifra-de-dato-sin-dueno"),
    "el bloque NO le presta el dueño a la cifra de afuera: «$17.9M» sigue reclamando su dueño", kinds.join(","));
  ok(kinds.includes("contexto-general-con-entidad"),
    "…y nombrar a «Lider» adentro se veta por (b), en el mismo veredicto", kinds.join(","));
}

console.log("── 6 · FALSOS POSITIVOS DEL VETO (b), MEDIDOS EJE POR EJE ──");
{
  // frases de contexto general LEGÍTIMAS: hablan del mundo, no de nadie de la cartera.
  const LEGITIMAS = [
    "En el retail de electrodomésticos el margen bruto suele moverse entre 28% y 34%.",
    "En línea blanca los márgenes tienden a ser más ajustados que en cuidado personal.",
    "El comercio electrónico suele operar con márgenes distintos a los del canal presencial.",
    "En el mercado de Santiago la competencia por precio es más intensa que en regiones.",
    "En materiales de construcción la estacionalidad pesa más que en otros rubros.",
  ];
  const vetaAlguna = (ejes) => {
    const cat = ejes.flatMap((e) => axisEntityNames(e));
    return LEGITIMAS.filter((frase) => {
      const t = renderContextoGeneral(`Lectura del dato.\n\n[[CONTEXTO_GENERAL]] ${frase}`);
      return guardC(t, { ...BASE, entidadesDelTenant: cat }).verdict === "contexto-general-con-entidad";
    });
  };
  const conTres = vetaAlguna(["cliente", "sku", "marca"]);
  const conSeis = vetaAlguna(["cliente", "sku", "marca", "familia", "bodega", "canal"]);
  ok(conTres.length === 0, `con los TRES ejes de contrapartes: 0/${LEGITIMAS.length} frases legítimas vetadas`, conTres.join(" | "));
  ok(conSeis.length >= 4, `con los SEIS ejes: ${conSeis.length}/${LEGITIMAS.length} frases legítimas vetadas — los clasificadores (familia/bodega/canal) SON vocabulario de la industria en este dato`, conSeis.join(" | "));
  console.log(`      · vetadas por los 6 ejes: ${conSeis.length} → ${conSeis.map((s) => s.slice(0, 42) + "…").join(" | ")}`);
  console.log(`      · nombres que las causan: ${["familia", "bodega", "canal"].map((e) => `${e}=${JSON.stringify(axisEntityNames(e))}`).join(" · ")}`);
  // el contrabando SIGUE cerrado con los tres ejes — la elección no abre la puerta que el veto existe para cerrar
  const contrabandos = ["Falabella", "Lider", "Samsung", "SAM-TV55"].map((n) => {
    const t = renderContextoGeneral(`Lectura.\n\n[[CONTEXTO_GENERAL]] ${n} suele facturar del orden de $80M al año.`);
    return guardC(t, { ...BASE, entidadesDelTenant: CATALOGO }).verdict;
  });
  ok(contrabandos.every((v) => v === "contexto-general-con-entidad"),
    "y con los tres ejes el contrabando sigue cerrado en las cuatro formas (cliente/cliente ausente/marca/SKU)", contrabandos.join(","));
}

console.log("── 6b · LA MEDICIÓN QUE MOTIVÓ EL REFINAMIENTO DEL VETO (c) ──");
{
  // POR QUÉ LAS TASAS DE LA PROYECCIÓN NO ENTRAN AL VETO (c): su rango REAL cubre casi entera la banda donde vive
  // cualquier frase sobre márgenes. Incluirlas haría IMPOSIBLE la regla 2 del propio contrato («en RANGOS»).
  const porUnidad = {};
  for (const f of DATO.figs) for (const p of parseFiguresDelProbe(String(f.value || ""))) {
    (porUnidad[p.unit] = porUnidad[p.unit] || new Set()).add(p.raw);
  }
  const pct = [...(porUnidad.pct || [])];
  const enterosBanda = [...new Set(pct.filter((x) => Number.isInteger(x) && x >= 15 && x <= 40))].sort((a, b) => a - b);
  const money = [...(porUnidad.money || [])].sort((a, b) => a - b);
  console.log(`      · proyección: ${DATO.figs.length} cifras · pct distintos ${pct.length} · money distintos ${money.length} (de $${money[0]} a $${money[money.length - 1]})`);
  console.log(`      · ENTEROS 15-40% ocupados por la proyección: ${enterosBanda.length}/26 → ${enterosBanda.join(",")}`);
  ok(enterosBanda.length >= 15, `MEDIDO: la proyección ocupa ${enterosBanda.length}/26 enteros entre 15% y 40% — un rango genérico de márgenes NO puede esquivarlos`);
  ok(enterosBanda.includes(21) && enterosBanda.includes(34) && enterosBanda.length === (34 - 21 + 1) + enterosBanda.filter((x) => x < 21).length,
    "…y del 21 al 34 la corrida no tiene un solo hueco (por eso las tasas de la proyección quedan fuera del veto)", enterosBanda.join(","));
  // la consecuencia, demostrada en las dos direcciones sobre el MISMO texto:
  const rangoTipico = renderContextoGeneral("Falabella marca 21.0% de margen en el año cerrado.\n\n[[CONTEXTO_GENERAL]] En este rubro suele moverse entre 28% y 34%, según lo que conozco.");
  ok(guardC(rangoTipico, BASE).ok, "un rango genérico de márcenes PASA (28% y 34% están en la proyección, y por eso no cuentan)".replace("márcenes", "márgenes"));
  ok(guardC(renderContextoGeneral("Lectura del dato.\n\n[[CONTEXTO_GENERAL]] La referencia de la industria está en 21%."), BASE).verdict === "contexto-general-con-cifra-del-cliente",
    "…y la cifra DEL TURNO adentro se sigue vetando: lo que se acotó es la vara, no la prohibición");
  // FALSO POSITIVO QUE QUEDA, medido y DOCUMENTADO (no se relaja): si un extremo del rango cae exactamente sobre la
  // cifra del turno, colisiona. Es el caso correcto —esa cifra sí está en pantalla— pero se anota como el costo real.
  const colision = renderContextoGeneral("Falabella marca 21.0% de margen.\n\n[[CONTEXTO_GENERAL]] En el rubro suele moverse entre 21% y 34%.");
  ok(guardC(colision, BASE).verdict === "contexto-general-con-cifra-del-cliente",
    "(c) FALSO POSITIVO QUE QUEDA: un extremo del rango que cae sobre la cifra DEL TURNO colisiona — documentado, no relajado");
}

console.log(`\n${PASS} PASS · ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
