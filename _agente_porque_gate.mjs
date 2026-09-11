/* === _agente_porque_gate.mjs · LA LEY DEL PORQUÉ, TRANSVERSAL ================================================
 *
 * LA PALABRA DEL OWNER (2026-09-09), textual y completa — cada frase tiene acá su chequeo:
 *   «No quiero que el método del porqué dependa de venir desde un cuadro. Si el usuario pregunta "por qué"
 *    desde cualquier lugar —cuadro, ficha, chat libre, cliente, margen, ventas, inventario o cobranza— ADI debe
 *    seguir la misma doctrina: medir primero · hipótesis marcada después · pregunta concreta al dueño para
 *    completar la causa. Y los tres vetos deben aplicar transversalmente: afirmar mecanismo sin cifras de
 *    respaldo, arde · afirmación sectorial externa sin fuente, arde · cerrar sin una pregunta concreta CUANDO
 *    FALTA CONTEXTO, arde.»
 *
 * LO QUE MIDE:
 *   1 · EL DETECTOR ÚNICO · un porqué es un porqué en toda la casa — y lo que NO es causa queda fuera
 *       (procedencia · límite del dato · simulación), que es donde un veto ciego haría daño.
 *   2 · LA LETRA · una sola, byte-estable, dentro de su tope, y con los tres pasos en orden.
 *   3 · LOS TRES VETOS · calibrados contra el CORPUS REAL: las salidas vigentes de los composers de la casa
 *       pasan limpias, y el texto que salió en producción arde en los tres.
 *   4 · TRANSVERSAL DE VERDAD · el turno LIBRE (sin playbook) queda regido, que era el camino sin ley; y la
 *       doctrina llega en el porqué de cualquier tema, no solo del cuadro.
 *   5 · NO SE JUZGA A LOS PELDAÑOS · la línea honesta y el respaldo sirven textos ya aprobados.
 *   6 · UN SOLO DETECTOR EN EL CÓDIGO · ningún playbook se guarda el suyo para el porqué.
 *   7 · CARNADAS · cada garantía, probada ROJA sobre una copia mutada del código vivo.
 *
 * OFFLINE · determinístico · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _agente_porque_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { esPorQue, doctrinaDelPorque, vetosDelPorque, TOPE_DOCTRINA_CHARS, MARCA_HIPOTESIS } from "./src/adi/agente/porque.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { cuadroSentrix } from "./src/adi/agente/herramientasAgente.js";
import { catalogoAgente } from "./src/adi/agente/catalogoAgente.js";
import { TOOL_CONTRACTS } from "./src/adi/oracle/toolContracts.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { applyScenarioToMarcasVentas } from "./src/engine/scenarios.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { builderOutFor } from "./src/adi/sentrix/viewBuilderRun.js";
import { deriveViewContext } from "./src/adi/sentrix/viewContextFrom.js";
import { tituloDeExplicacion } from "./src/adi/sentrix/viewManifest.js";
import { getTenantId } from "./src/data/tenantStore.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${String(detalle).slice(0, 300)}`); }
};
const H = (t) => console.log(`\n${t}`);
const MUDO = async () => ({ tipo: "texto", texto: "" });
const ESC = "actual";
const leer = (rel) => { try { return fs.readFileSync(path.join(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n"); } catch { return ""; } };
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

initTenant(TENANT_DEMO);

/* ═══ 1 · EL DETECTOR ÚNICO ═════════════════════════════════════════════════════════════════════════════════
 * «Desde cualquier lugar» empieza acá: una sola definición de qué es preguntar una causa. Y el trabajo más
 * delicado no es cazar los porqués, es DEJAR FUERA los que no son causa — ahí un veto ciego mata respuestas
 * correctas, y una de ellas ya estaba viva: «¿por qué 103.1%?» se vetaba a sí misma. */
H("1 · el detector único — y lo que NO es una causa queda fuera");
{
  const CAUSA = [
    "por que febrero es el mas bajo", "¿por qué cae mi margen?", "por que Ripley me compra menos",
    "a que se debe la caida de ventas", "cual es la causa de la caida", "que paso en julio",
    "¿por qué tengo capital frenado?", "por que me deben tanto",
  ];
  for (const q of CAUSA) ok(esPorQue(q) === true, `causa: «${q}»`);
  const NO_CAUSA = [
    ["por que 103.1%?", "procedencia · es de dónde sale la cifra, y el composer que la responde se vetaba a sí mismo"],
    ["¿por qué ese 3.5%?", "procedencia"],
    ["de donde sale ese monto", "procedencia"],
    ["por que no me muestras el vencido", "límite del dato · la causa completa ya se dice («tu archivo no declara el plazo»)"],
    ["¿por qué no puedo ver el trimestre?", "límite del dato"],
    ["si crezco 3% los proximos 12 meses, por que me da $103.0M?", "aritmética de un supuesto, no una causa"],
    ["explicame el cuadro", "es una lectura, no un porqué"],
    ["profundiza en la contribucion", "es una lectura"],
    ["cuanto vendi en marzo", "no es un porqué"],
  ];
  for (const [q, porque] of NO_CAUSA) ok(esPorQue(q) === false, `FUERA de la ley: «${q}» — ${porque}`);
}

/* ═══ 2 · LA LETRA · UNA SOLA, ESTABLE Y CORTA ══════════════════════════════════════════════════════════════ */
H("2 · la letra de la ley — los tres pasos, en orden, byte-estable y dentro del tope");
{
  const d = doctrinaDelPorque();
  ok(d === doctrinaDelPorque(), "★ byte-estable entre llamadas — el prefijo del proveedor no la ve como contenido nuevo");
  ok(d.length <= TOPE_DOCTRINA_CHARS, `dentro del tope declarado (${d.length} ≤ ${TOPE_DOCTRINA_CHARS})`);
  const iMide = d.indexOf("MIDE PRIMERO"), iHip = d.indexOf("HIPÓTESIS, MARCADA"), iPreg = d.indexOf("PREGÚNTALE AL DUEÑO");
  ok(iMide > 0 && iHip > iMide && iPreg > iHip, "★★ los tres pasos van EN EL ORDEN del owner: medir → hipótesis marcada → preguntar", `${iMide}/${iHip}/${iPreg}`);
  ok(/PROHIBIDO afirmar cómo se comporta un sector/.test(d), "…con la prohibición del sector escrita, no insinuada");
  ok(/«¿Seguimos\?» no cuenta/.test(d), "…y con el anti-ejemplo de la pregunta genérica");
  ok(!/\$\d|\d+\.\d+%|Falabella|Lider|Jumbo/.test(d), "★ sin cifras ni nombres del tenant: es una LEY, no una respuesta (y no mete datos al bundle)");
}

/* ═══ 3 · LOS TRES VETOS, CALIBRADOS CONTRA EL CORPUS REAL ══════════════════════════════════════════════════
 * La regla de la casa: un veto que produce falsos positivos es PEOR que no tenerlo — mata respuestas correctas
 * y el turno cae a un texto pobre. Así que primero pasan las salidas vigentes, y recién después arde el veneno. */
H("3 · los tres vetos — el corpus legítimo pasa, el texto de producción arde");
{
  const cs = cuadroSentrix({ componentId: "comercial/01/evolutivo-serie", scenario: ESC });
  const FIGS = cs.boleta, RES = [{ facts: cs.facts }];
  const SIN_MEC = [{ facts: { saldoTotal: 1000, vencido: null } }];
  const j = (t, extra = {}) => vetosDelPorque(t, { pregunta: "por que febrero es el mas bajo", figs: FIGS, results: RES, sitio: "cierre", ...extra }).map((x) => x.regla);

  /* EL TEXTO QUE SALIÓ EN LA PANTALLA DEL OWNER (v2.20 en producción, 2026-09-09) — no es un veneno inventado */
  const PRODUCCION = [
    "Febrero cierra en $6.5M, el mes más bajo del año — y ese patrón se repite: febrero fue el mes más bajo también el año anterior.",
    "Qué pasó en febrero: El volumen cayó. No es margen cedido ni una acción comercial puntual.",
    "Por qué ocurre — criterio mío, no en el dato: Febrero es post-verano. El sector electrodomésticos y línea blanca históricamente cae en febrero.",
    "Qué verificar para confirmar: Si es estacionalidad pura, debería verse igual en TODOS los clientes y SKU ese mes.",
  ].join("\n");
  const vProd = j(PRODUCCION);
  ok(vProd.includes("mecanismo-sin-cifras"), "★★ el texto REAL de producción arde: afirma «el volumen cayó, no es margen cedido» SIN UNA CIFRA, teniéndolas en la boleta", JSON.stringify(vProd));
  ok(vProd.includes("sectorial-sin-fuente"), "★★ …y por «el sector históricamente cae en febrero»: sin fuente, y el rótulo «criterio mío» NO la reemplaza");
  ok(vProd.includes("porque-sin-pregunta"), "★★ …y por cerrar sin preguntarle nada al dueño — el detonante lo sabe él");

  /* EL MISMO TEXTO CON EL MÉTODO — la regla no prohíbe redactar, exige respaldar */
  const CON_METODO = [
    "Febrero es el piso del año ($6.5M).",
    "Fue por volumen: 360 unidades contra un promedio de 475 en el año. El margen se mantuvo en línea (25.2% contra 25.1%) y las acciones comerciales no saltaron (3.6% contra 4.1%).",
    "Mi hipótesis es que hay estacionalidad, porque febrero también fue el más bajo el año anterior. Con este dato solo no está probado.",
    "¿Febrero suele ser un mes bajo en tu negocio, o ese año pasó algo puntual con clientes grandes, stock o campañas?",
  ].join("\n");
  ok(j(CON_METODO).length === 0, "★★ el MISMO texto con el método pasa limpio", JSON.stringify(j(CON_METODO)));

  /* ⚠️ LAS PALABRAS DEL DATO NO SON EL SECTOR — la calibración que evita el desastre. «Retail» es un valor del
   * eje canal del tenant y «categoría» es como la casa nombra el eje familia: estas cuatro son lecturas del
   * dato propio, con cifras de la boleta, y con la primera versión de la regla ARDÍAN. */
  const DEL_DATO = [
    "El canal Retail siempre fue tu mayor canal: $95.2M de $100.0M. Mi hipótesis es que ahí está la concentración. ¿Tienes campañas distintas por canal?",
    "La categoría Electrodomésticos en general sostiene la venta. Mi hipótesis es que el mix pesa. ¿Cambiaste el surtido este año?",
    "Los clientes Retail de tu cartera tienden a concentrar la venta. Mi hipótesis es que la dependencia crece. ¿Negociaste algo distinto con ellos?",
    "Tu canal mayorista suele mover más volumen. Mi hipótesis es esa. ¿Hubo una campaña ahí?",
  ];
  for (const t of DEL_DATO) ok(j(t).length === 0, `★ palabra del DATO, no del mundo: «${t.slice(0, 46)}…»`, JSON.stringify(j(t)));

  /* LO QUE SÍ ES UNA AFIRMACIÓN DE MUNDO */
  for (const t of ["Es criterio mío: la industria suele caer en febrero. ¿Hubo campañas ese mes?",
                   "El mercado en general tiende a bajar. ¿Cambió algo con tus clientes grandes?",
                   "El rubro históricamente cae. ¿Tuviste un quiebre de stock?"]) {
    ok(j(t).includes("sectorial-sin-fuente"), `★ afirmación de mundo sin fuente: «${t.slice(0, 42)}…»`);
  }
  ok(j("Según lo que me declaraste, el sector siempre cae en febrero. Mi hipótesis es que tu calendario lo refleja. ¿Ajustas campañas por eso?").length === 0,
    "★ …y CON fuente declarada, la misma frase pasa: la excepción del owner es «salvo que haya fuente o contexto declarado»");
  ok(vetosDelPorque("El sector suele caer en febrero, y eso explica tu piso. ¿Hubo campañas?",
    { pregunta: "el sector siempre cae en febrero, por que a mi tambien?", figs: FIGS, results: RES, sitio: "cierre" }).length === 0,
    "★ …y si la premisa la trajo EL USUARIO en su pregunta, ADI puede recogerla: es su contexto, no una invención");

  /* (a) SOLO DONDE HAY MECANISMO MEDIDO — inventario y cobranza no lo tienen, y exigir cifras ahí empujaría a inventar */
  ok(j("Por qué tienes ese capital frenado no está en este dato: el inventario localiza, no explica. ¿Fue una sobrecompra, un cambio de temporada, o un cliente que no retiró?", { results: SIN_MEC }).length === 0,
    "★★ un dominio SIN mecanismo medido declina y pregunta — y no se le exigen cifras que su dato no tiene");
  ok(j("El volumen cayó y no es margen cedido. Te muestro el detalle por bodega.", { results: SIN_MEC }).includes("porque-sin-pregunta"),
    "…pero igual tiene que preguntar: la ley de cerrar preguntando no depende del dominio");
  ok(!j("El volumen cayó y no es margen cedido. ¿Hubo un quiebre de stock?", { results: SIN_MEC }).includes("mecanismo-sin-cifras"),
    "★ y sin conjunto medido, (a) NO se asoma: la guarda es que el turno TENGA con qué respaldar");

  /* (c) «CUANDO FALTA CONTEXTO» — la condición textual del owner, mecánica */
  /* ⚠️ ESTO CAMBIÓ AL CERTIFICAR (owner 2026-09-09): antes un texto sin lectura causal quedaba exento de
   * preguntar, y una auditoría adversarial mostró el agujero reproduciéndolo en el bucle real — el ranking de
   * SKU frenados y la tabla de deuda ESQUIVABAN la pregunta del usuario y salían limpios. Entregar dato y
   * irse es la peor respuesta a un porqué, no la más segura. */
  ok(j("Tu margen viene en 25.1% y tu benchmark declarado es 30.1%. Te queda esa distancia.").includes("porque-sin-pregunta"),
    "★★ un texto que ESQUIVA la causa —puro dato, sin explicar ni preguntar— arde: el usuario preguntó por qué");
  ok(j("Mi hipótesis es que hay estacionalidad. Te lo dejo ahí.").includes("porque-sin-pregunta"),
    "★ una hipótesis SIN pregunta arde: la hipótesis abre una lectura que solo el dueño cierra");
  ok(j("Mi hipótesis es que hay estacionalidad, y como me contaste, cierras dos semanas en febrero. Eso lo explica.", { mem: { intenciones: [{ pregunta: "febrero" }] } }).length === 0,
    "★★ …y si el dueño YA lo declaró, ADI lo CITA en vez de volver a preguntar — «si él ya te lo declaró, cítalo»");
  ok(j("Mi hipótesis es que hay estacionalidad, y como me contaste, cierras dos semanas en febrero.").includes("porque-sin-pregunta"),
    "★ …pero la cita NO exime si el dueño nunca declaró nada: inventar «como me contaste» no puede ser la puerta de salida del veto");
  ok(j("Mi hipótesis es que hay estacionalidad. ¿Seguimos por otra parte del cuadro?").includes("porque-sin-pregunta"),
    "★ «¿seguimos?» no es preguntar: no pide el contexto que falta");
  ok(j("Mi hipótesis es que hay estacionalidad. ¿Hubo una campaña en febrero o un cliente grande que no compró?").length === 0,
    "…y la concreta, con opciones del negocio, sí lo es");

  /* la oración CONDICIONAL propone, no afirma */
  ok(j("Yo priorizaría donde el margen acompañaría mejor. Mi hipótesis es que la carga pesa. ¿Negociaste algo distinto?").length === 0,
    "★ una oración condicional («priorizaría… acompañaría») no afirma un mecanismo: propone, y no se le exigen cifras");
}

/* ═══ 4 · TRANSVERSAL DE VERDAD ═════════════════════════════════════════════════════════════════════════════
 * El corazón del encargo. Se mide sobre el BUCLE REAL, con el cerebro mudo, en los caminos que el mapeo
 * encontró sin ley: el turno libre (sin playbook), la ficha de una cuenta y la caída de ventas. */
H("4 · «desde cualquier lugar» — el turno libre y los otros caminos quedan regidos");
{
  /* la doctrina llega en el porqué de CUALQUIER tema, y no llega en una lectura */
  let visto = "";
  const ESPIA = async ({ mensajes }) => { visto = (mensajes || []).map((m) => String(m.content || "")).join("\n"); return { tipo: "texto", texto: "" }; };
  for (const q of ["por que cae mi margen?", "por que tengo capital frenado?", "por que me deben tanto?", "por que Falabella cede margen?"]) {
    visto = "";
    await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESC, callAgente: ESPIA });
    ok(/MÉTODO DEL PORQUÉ/.test(visto), `★★ «${q}» → el cerebro recibe la ley (tema distinto, misma doctrina)`);
  }
  for (const q of ["como viene mi margen?", "por que 103.1%?", "dame la ficha de Falabella"]) {
    visto = "";
    await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESC, callAgente: ESPIA });
    ok(!/MÉTODO DEL PORQUÉ/.test(visto), `★ «${q}» → NO la recibe: la instrucción no viaja hasta que hace falta`);
  }
  /* EL TURNO LIBRE, que era el camino sin ninguna ley: hoy tiene los tres vetos */
  const MALO = async () => ({ tipo: "texto", texto: "Tu margen cae. El sector históricamente cae en esta época, es criterio mío." });
  const rL = await answerViaAgente({ text: "por que cae mi margen?", history: [], mem: {}, scenario: ESC, callAgente: MALO });
  const vetosL = (rL.r.agente.vetos || []).join(" | ");
  ok(/sectorial-sin-fuente|porque-sin-pregunta|mecanismo-sin-cifras/.test(vetosL),
    "★★ el TURNO LIBRE —sin playbook, el camino que no tenía ninguna lista notarial— ya está regido", vetosL.slice(0, 160));
  ok(!/El sector históricamente cae/.test(String(rL.r.text || "")), "…y esa afirmación de industria NO llega a pantalla");

  /* los composers determinísticos de los caminos que el mapeo encontró cerrando sin preguntar */
  for (const [q, quien] of [["por que Falabella cede margen?", "la ficha de una cuenta"]]) {
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESC, callAgente: MUDO });
    const T = String(r.r.text || "").trim();
    ok(/\?$/.test(T) && /precio|stock|mezcla|competidor|campañ/i.test(T.split("\n").slice(-2).join(" ")),
      `★ ${quien}: cierra preguntándole al dueño por lo que falta`, T.split("\n").slice(-2).join(" / "));
  }
}

/* ═══ 5 · NO SE JUZGA A LOS PELDAÑOS ════════════════════════════════════════════════════════════════════════ */
H("5 · la ley juzga al cerebro, no al rescate");
{
  const cs = cuadroSentrix({ componentId: "comercial/01/evolutivo-serie", scenario: ESC });
  const MALO = "El volumen cayó y el sector históricamente cae.";
  const arg = { pregunta: "por que febrero es el mas bajo", figs: cs.boleta, results: [{ facts: cs.facts }] };
  ok(vetosDelPorque(MALO, { ...arg, sitio: "cierre" }).length > 0, "en el cierre del cerebro, arde");
  for (const sitio of ["linea-honesta", "respaldo", "poda"]) {
    ok(vetosDelPorque(MALO, { ...arg, sitio }).length === 0, `★ en «${sitio}» no se juzga: el peldaño sirve un texto ya aprobado, y multar al que rescata es castigar al que arregla`);
  }
}

/* ═══ 6 · UN SOLO DETECTOR EN EL CÓDIGO ═════════════════════════════════════════════════════════════════════ */
H("6 · un solo léxico del porqué en toda la casa");
{
  const modulo = leer("src/adi/agente/porque.js");
  ok(/export function esPorQue/.test(modulo), "el detector es exportado por el módulo de la ley");
  const cuadro = sinComentarios(leer("src/adi/agente/playbooks/cuadroExplicado.js"));
  ok(/const _PIDE_PORQUE = esPorQue;/.test(cuadro), "★ el playbook del cuadro USA el detector de la casa — ya no se guarda el suyo");
  ok(!/mecanismo-sin-cifras|sectorial-sin-fuente|porque-sin-pregunta/.test(cuadro),
    "★★ y los tres vetos NO tienen copia en el playbook: dos jueces con la misma regla es un turno partido en dos cerebros");
  const bucle = sinComentarios(leer("src/adi/agente/bucleAgente.js"));
  ok(/vetosDelPorque\(/.test(bucle) && /doctrinaDelPorque\(\)/.test(bucle), "el bucle aplica la ley: doctrina antes de la ronda 1, vetos en el juez del turno");
  ok(/if \(_esPorQueDelTurno\) mensajes\.push/.test(bucle), "★ la doctrina se empuja SIN depender de que haya playbook — el turno libre también la recibe");
}

/* ═══ 7 · CARNADAS ══════════════════════════════════════════════════════════════════════════════════════════ */
H("7 · carnadas · cada garantía, probada ROJA sobre una copia mutada del código vivo");
{
  const tmp = []; let n = 0;
  const mutar = (rel, reemplazos) => {
    const abs = path.join(process.cwd(), rel);
    let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    for (const [de, a] of reemplazos) {
      const antes = txt;
      txt = txt.replace(de, a);
      if (txt === antes) return { error: `la carnada no encontró qué mutar en ${rel}` };
    }
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}_${++n}.js`);
    fs.writeFileSync(destino, txt);
    tmp.push(destino);
    return { url: pathToFileURL(destino).href };
  };
  const carnada = async (nombre, rel, reemplazos, prueba) => {
    const m = mutar(rel, reemplazos);
    if (m.error) return ok(false, `carnada «${nombre}»`, m.error);
    let cazada = false, detalle = "";
    try { cazada = await prueba(await import(m.url)); }
    catch (e) { detalle = `la copia mutada ni siquiera carga: ${e.message}`; }
    ok(cazada, `carnada «${nombre}» → el chequeo se pone ROJO`, detalle || "el defecto pasó DESAPERCIBIDO");
  };
  const cs = cuadroSentrix({ componentId: "comercial/01/evolutivo-serie", scenario: ESC });
  const ARG = { pregunta: "por que febrero es el mas bajo", figs: cs.boleta, results: [{ facts: cs.facts }], sitio: "cierre" };

  // (a) el detector se ensancha y se traga la procedencia → vuelve el falso positivo que ya estaba vivo
  await carnada("el detector deja de excluir la procedencia", "src/adi/agente/porque.js",
    [[/if \(_PROCEDENCIA\.test\(q\) \|\| _LIMITE_DEL_DATO\.test\(q\)\) return false;/, "/* CARNADA */"]],
    async (Mut) => Mut.esPorQue("por que 103.1%?") === true);

  // (b) el sujeto sectorial se vuelve a comer las palabras del dato → arden las lecturas del canal
  await carnada("«retail» vuelve al sujeto sectorial (las palabras del dato arden)", "src/adi/agente/porque.js",
    [[/const _SUJETO_MUNDO = "\(\?:el\\\\s\+sector/, 'const _SUJETO_MUNDO = "(?:el\\\\s+retail|los\\\\s+clientes\\\\s+retail|el\\\\s+sector']],
    async (Mut) => Mut.vetosDelPorque("Los clientes Retail de tu cartera tienden a concentrar la venta. ¿Negociaste algo distinto?", ARG).some((x) => x.regla === "sectorial-sin-fuente"));

  // (c) la guarda del conjunto medido, quitada → se le exigen cifras a un dominio que no las tiene
  await carnada("la guarda del mecanismo medido, quitada (se exigen cifras donde no hay mecanismo)", "src/adi/agente/porque.js",
    [[/if \(_hayMecanismoMedido\(results\)\) \{/, "if (true) {   // CARNADA"]],
    async (Mut) => Mut.vetosDelPorque("El volumen cayó y no es margen cedido. ¿Hubo un quiebre de stock?",
      { ...ARG, results: [{ facts: { saldoTotal: 1 } }] }).some((x) => x.regla === "mecanismo-sin-cifras"));

  // (d) la cita del contexto declarado deja de eximir → ADI vuelve a preguntar lo que el dueño ya contestó
  await carnada("citar el contexto declarado deja de eximir (le vuelve a preguntar lo que ya le dijo)", "src/adi/agente/porque.js",
    [[/if \(intenciones\.length && [^\n]+\) return true;/, "/* CARNADA */"], [/if \(ctxTxt\.trim\(\) && _FUENTE\.test\(texto\)\) return true;/, "/* CARNADA */"]],
    async (Mut) => Mut.vetosDelPorque("Mi hipótesis es que hay estacionalidad, y como me contaste, cierras dos semanas en febrero.",
      { ...ARG, mem: { intenciones: [{ pregunta: "x" }] }, contexto: { texto: "cierro en febrero" } }).some((x) => x.regla === "porque-sin-pregunta"));

  // (e) la ley deja de llegar al turno libre → vuelve el camino sin doctrina
  await carnada("la doctrina vuelve a depender del playbook (el turno libre queda sin ley)", "src/adi/agente/bucleAgente.js",
    [[/if \(_esPorQueDelTurno\) mensajes\.push\(\{ role: "user", content: doctrinaDelPorque\(\) \}\);/, "/* CARNADA */"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      let visto = "";
      const ESPIA = async ({ mensajes }) => { visto = (mensajes || []).map((m) => String(m.content || "")).join("\n"); return { tipo: "texto", texto: "" }; };
      await Mut.answerViaAgente({ text: "por que cae mi margen?", history: [], mem: {}, scenario: ESC, callAgente: ESPIA });
      return !/MÉTODO DEL PORQUÉ/.test(visto);
    });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* limpieza best-effort */ } }
}

/* ═══ 8 · LOS OCHO LUGARES QUE EL OWNER NOMBRÓ ══════════════════════════════════════════════════════════════
 * «Si el usuario pregunta "por qué" desde cualquier lugar —CUADRO, FICHA, CHAT LIBRE, CLIENTE, MARGEN, VENTAS,
 *  INVENTARIO O COBRANZA— ADI debe seguir la misma doctrina.» Ocho, con nombre y apellido. Este bloque los
 * recorre POR EL BUCLE REAL —no por el módulo suelto— y exige el paso 3 en cada uno: la respuesta cierra
 * preguntándole al dueño algo concreto de su negocio, y el muro no tiene nada que podar.
 * ⚠️ Nació de una auditoría adversarial que reprobó la primera versión: inventario y cobranza contestaban un
 * porqué con un ranking y una tabla —0 de 3 pasos, sin límite, sin hipótesis, sin pregunta— y salían limpios. */
H("8 · los ocho lugares del owner — cada uno cierra preguntándole al dueño");
{
  const vcE = deriveViewContext("comercial/01/evolutivo-serie", builderOutFor("comercial/01/evolutivo-serie", ESC), { scenario: ESC, tenantId: getTenantId() });
  const rCuadro = await answerViaAgente({ text: tituloDeExplicacion("comercial/01/evolutivo-serie"), history: [], mem: {}, scenario: ESC, callAgente: MUDO, viewContext: vcE, cuadro: vcE });
  const histCuadro = [{ role: "user", text: "x" }, { role: "adi", text: rCuadro.r.text }];
  const rSintesis = await answerViaAgente({ text: "dame la sintesis ejecutiva del negocio", history: [], mem: {}, scenario: ESC, callAgente: MUDO });
  const histSintesis = [{ role: "user", text: "sintesis" }, { role: "adi", text: rSintesis.r.text }];
  /* lo que hace CONCRETA a una pregunta: nombra algo del negocio del usuario, no una pantalla */
  const CONCRETA = /campañ|promoci|stock|quiebre|cliente|precio|negoci|acuerdo|competidor|temporada|plazo|mezcla|proveedor|surtido|apuesta|intenci[oó]n|estrategia|volumen|pag[oa]/i;
  const LUGARES = [
    ["cuadro", "por que febrero es el mas bajo?", histCuadro, rCuadro.mem],
    ["ficha / cliente", "por que Falabella cede margen?", [], {}],
    ["chat libre", "por que cae mi margen?", [], {}],
    ["margen", "cual fue el motivo de la caida del margen?", [], {}],
    ["ventas", "por que cayeron las ventas?", [], {}],
    ["inventario", "por que tengo capital frenado?", [], {}],
    ["cobranza", "por que me deben tanto?", [], {}],
    ["riesgos / síntesis", "por que esos riesgos?", histSintesis, rSintesis.mem],
  ];
  for (const [donde, q, hist, mem] of LUGARES) {
    const r = await answerViaAgente({ text: q, history: hist, mem, scenario: ESC, callAgente: MUDO });
    const T = String(r.r.text || "").trim();
    /* el diario del bucle («Lo tendré en cuenta en las próximas lecturas.») es un apéndice, no parte de la respuesta */
    const lineas = T.split("\n").map((x) => x.trim()).filter((x) => x && !x.startsWith("("));
    const cierraPreguntando = lineas.slice(-3).some((l) => /\?/.test(l) && CONCRETA.test(l));
    ok(cierraPreguntando && r.r.agente.estado !== "vacio",
      `★★ ${donde}: «${q}» cierra preguntándole al dueño algo concreto de su negocio`,
      `${r.r.agente.estado} · ${(lineas[lineas.length - 1] || "").slice(0, 120)}`);
    ok((r.r.agente.vetos || []).length === 0, `…${donde}: y el muro no tiene nada que podar`, JSON.stringify(r.r.agente.vetos || []));
  }
  /* Y LA CONTRACARA: una LECTURA en esos mismos lugares no se ve obligada a preguntar nada. */
  for (const [donde, q] of [["cartera", "como viene mi cartera?"], ["inventario", "donde esta mi capital frenado?"], ["cobranza", "cuanto me deben?"]]) {
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESC, callAgente: MUDO });
    ok((r.r.agente.vetos || []).length === 0 && r.r.agente.estado !== "vacio",
      `★ ${donde}: una LECTURA sigue intacta — la ley rige el porqué, no toda respuesta`, `${r.r.agente.estado} · ${JSON.stringify(r.r.agente.vetos || [])}`);
  }
}


/* ═══ 9 · DESCOMPONER, NO SOLO LOCALIZAR (owner 2026-09-09, ampliación del alcance) ══════════════════════════
 * «Para todo "por qué" de ventas o margen, ADI debe intentar descomponer con las dimensiones que existan en el
 *  pack… Si el usuario pide una dimensión específica y existe, debe usarla. Si no existe, debe declararlo y
 *  ofrecer el corte más cercano. Objetivo: que ADI no diga solo "margen bajo por Falabella", sino que pueda
 *  explicar si viene de precio, costo, carga comercial, mix, canal o sucursal cuando el dato lo permita.»
 * EL HALLAZGO QUE HIZO BARATO ESTO: el motor YA calculaba casi todo —efecto volumen vs precio, mix por familia,
 * precio realizado, quién cede por precio y quién por costo, margen por canal— con boleta y con sus salvedades
 * escritas, y el catálogo del agente no lo mencionaba. El trabajo estaba hecho y el asesor no sabía que
 * existía. Este bloque verifica que cada lectura declarada EJECUTA de verdad: una lista que prometa un focus
 * inexistente haría que el motor sirva la lectura por defecto EN SILENCIO — respondiendo otra cosa sin avisar. */
H("9 · las lecturas de la descomposición — declaradas al cerebro y ejecutables de verdad");
{
  const cat = catalogoAgente();
  const _tool = (n) => cat.find((x) => x.name === n);
  /* (a) EL CEREBRO LAS VE, con su clave exacta en un enum: pedir una lectura no puede ser adivinar una cadena */
  for (const [tool, esperadas] of [
    ["salesRead", ["descomposicion_vol_precio", "mix_familia", "precio_realizado", "precio_neto"]],
    ["marginRead", ["causa_precio", "causa_costo"]],
  ]) {
    const t = _tool(tool);
    const enEnum = (t && t.input_schema && t.input_schema.properties && t.input_schema.properties.focus && t.input_schema.properties.focus.enum) || [];
    for (const f of esperadas) ok(enEnum.includes(f), `★ ${tool} declara la lectura «${f}» al cerebro, con su clave exacta`, JSON.stringify(enEnum));
    ok(/lecturas \(focus\)/.test(String(t && t.description)), `…y la describe en palabras de negocio, no solo con la clave`);
  }
  /* (b) EL CANAL, que el owner pidió: los dos lectores lo aceptan como eje */
  for (const tool of ["salesRead", "marginRead"]) {
    const dims = (_tool(tool).input_schema.properties.dimension || {}).enum || [];
    ok(dims.includes("canal"), `★ ${tool} acepta el eje CANAL — el owner lo pidió y el motor ya lo agrupaba`, JSON.stringify(dims));
  }
  /* (c) ⚠️ CADA LECTURA DECLARADA EJECUTA · una promesa sin motor es la peor falla: el `focus` desconocido cae
   * a la lectura por defecto EN SILENCIO y el usuario recibe otra respuesta sin enterarse. */
  const motor = leer("src/adi/specRetrieval.js");
  for (const tool of ["salesRead", "marginRead"]) {
    const c = TOOL_CONTRACTS[tool];
    for (const l of c.lecturasSoportadas || []) {
      ok(motor.includes(`focus === "${l.clave}"`), `★★ «${tool} focus=${l.clave}» EXISTE en el motor — la lista no promete lecturas que no corren`);
    }
  }
  /* (d) …y RESPONDEN CON BOLETA: sin cifras autorizadas, la descomposición muere en el muro */
  const conBoleta = (tool, focus, dimension) => {
    const r = TOOLS[tool]({ focus, dimension, scenario: ESC });
    return { n: ((r && r.boleta) || []).length, sup: !(r && r.coverage && r.coverage.supported === false) };
  };
  for (const [tool, focus, dim] of [
    ["salesRead", "descomposicion_vol_precio", "cliente"], ["salesRead", "precio_realizado", "cliente"],
    ["salesRead", "precio_neto", "cliente"], ["salesRead", "mix_familia", "familia"],
    ["marginRead", "causa_precio", "cliente"], ["marginRead", "causa_costo", "cliente"],
    ["marginRead", "bajo_benchmark", "canal"],
  ]) {
    const r = conBoleta(tool, focus, dim);
    ok(r.sup && r.n > 0, `★ ${tool} focus=${focus} por ${dim} responde CON CIFRAS AUTORIZADAS (${r.n} en la boleta)`);
  }

  /* ── LA DEFINICIÓN DEL OWNER · «precio neto después de acciones» ────────────────────────────────────────
   * «Precio neto = (venta − acciones comerciales) / unidades. Llámalo "precio neto después de acciones" para
   * que no se confunda.» El nombre es parte de la orden: la casa ya encadenaba precio de lista y precio
   * realizado, y un tercer «precio» sin apellido es una ambigüedad de rótulo — lo que este proyecto llama
   * defecto (un rótulo visible no puede nombrar dos campos). */
  {
    const r = TOOLS.salesRead({ focus: "precio_neto", dimension: "cliente", scenario: ESC });
    const labels = (r.boleta || []).map((f) => String(f.label || ""));
    ok(labels.some((l) => /Precio neto después de acciones/.test(l)),
      "★★ la cifra se publica con EL NOMBRE QUE EL OWNER PIDIÓ: «precio neto después de acciones»", labels.slice(0, 2).join(" · "));
    ok(labels.some((l) => /Precio realizado/.test(l)),
      "…y viaja al lado del precio realizado, para que se vean como lo que son: dos precios distintos");
    /* LA CUENTA, verificada contra el dato: el precio neto es el realizado MENOS su carga comercial, y los
     * tres términos salen de la MISMA fila de ventas. Si alguien cruzara la venta de la tabla de margen
     * (otra cifra para la misma cuenta) con estas unidades, esta relación dejaría de dar — por eso se mide.
     * Se mide sobre la cuenta que la lectura DESTACA (la de mayor diferencia entre los dos precios), no sobre
     * una elegida a mano: así el chequeo sigue al dato si el escenario cambia. */
    const fNeto = (r.boleta || []).find((f) => /· Precio neto después de acciones$/.test(String(f.label || "")));
    const quien = fNeto ? String(fNeto.label).split(" · ")[0] : null;
    const fReal = (r.boleta || []).find((f) => String(f.label || "") === quien + " · Precio realizado");
    const cargaDe = (TENANT_DEMO.clientesVentas.find((c) => c.nombre === quien) || {}).pctRebate;
    const razon = (fNeto && fReal && fReal.raw) ? fNeto.raw / fReal.raw : null;
    ok(razon !== null && Number.isFinite(cargaDe) && Math.abs(razon - (1 - cargaDe / 100)) < 0.005,
      `★★ la cuenta cierra contra el dato: en ${quien}, el neto es el realizado menos su carga de ${cargaDe}% (razón medida ${razon ? razon.toFixed(4) : "—"})`);
  }

  /* ── LA OTRA DECISIÓN DEL OWNER · el mix por cliente, APAGADO ───────────────────────────────────────────
   * «Apaga mix por cliente estimado hasta que pueda calcularse desde filas reales. No quiero estimaciones que
   * contradigan el dato.» Lo que se servía salía de una matriz repartida por ajuste iterativo: sobre un
   * archivo real le asignaba a una cuenta una familia que nunca compró. */
  {
    const r = TOOLS.entityComposicion({ dimension: "cliente", entity: "Falabella", scenario: ESC });
    ok(r.coverage && r.coverage.supported === false,
      "★★ el mix POR CLIENTE estimado ya no se sirve: declina en vez de repartir una compra que no ocurrió");
    ok(/estimación|no está medida/i.test(String(r.coverage.reason)) && /participación/.test(String(r.coverage.reason)) && !/salesRead|focus=/.test(String(r.coverage.reason)),
      "…declarando el motivo Y el corte que SÍ es dato, EN VOZ DE NEGOCIO — este texto llega a pantalla verbatim y la jerga interna está prohibida en superficie", String(r.coverage.reason).slice(0, 120));
    ok(((r.boleta || []).length) === 0, "…y sin colar una sola cifra estimada a la boleta del turno");
  }

  /* ── LO QUE NO EXISTE SE DICE · punto de venta / sucursal ───────────────────────────────────────────────
   * «Punto de venta/sucursal queda como trabajo de ingesta si hoy no lo lee el motor.» Se guarda en el archivo
   * del cliente y el motor no lo lee ni una vez: prometerlo sería el peor de los errores honestos. */
  {
    const dimsVenta = (_tool("salesRead").input_schema.properties.dimension || {}).enum || [];
    ok(!dimsVenta.includes("puntoVenta") && !dimsVenta.includes("sucursal"),
      "★ el corte por punto de venta NO se promete: el motor no lo lee, y declararlo sería prometer lo que no hay");
    ok(/NO HAY corte por punto de venta ni por sucursal/.test(doctrinaDelPorque()),
      "★★ …y la letra se lo dice al cerebro con esas palabras, para que lo declare en vez de improvisarlo");
  }

  /* ── LA LETRA MANDA DESCOMPONER ─────────────────────────────────────────────────────────────────────────── */
  {
    const d = doctrinaDelPorque();
    ok(/DESCOMP/i.test(d) && /Nombrar al culpable no es explicar/.test(d),
      "★★ la doctrina ordena descomponer, no quedarse en quién — el objetivo textual del owner");
    for (const f of ["descomposicion_vol_precio", "mix_familia", "precio_realizado", "precio_neto", "causa_precio", "causa_costo"]) {
      ok(d.includes(f), `…y nombra la lectura «${f}» para que el cerebro sepa pedirla`);
    }
    ok(/Si el usuario pide una dimensión y existe, ÚSALA/.test(d) && /si no existe, dilo y ofrece el corte más cercano/.test(d),
      "★★ y lleva la regla del owner sobre la dimensión pedida: si existe se usa; si no, se declara y se ofrece la más cercana");
  }
}


/* ═══ 10 · LOS CIERRES DE LA CERTIFICACIÓN ADVERSARIAL (owner 2026-09-09) ═══════════════════════════════════
 * Siete auditores atacaron la descomposición y cuatro focos fallaron. El owner ordenó cerrar cinco cosas.
 * Cada una tiene acá su chequeo, con el defecto reproducido como carnada de sí mismo. */
H("10 · los cinco cierres que ordenó el owner tras la certificación");
{
  /* ── (1) UNA BODEGA NO ES UNA SUCURSAL ──────────────────────────────────────────────────────────────────
   * Reproducido: «¿cómo viene la sucursal Santiago?» se resolvía con la ficha de la BODEGA Santiago y servía
   * capital de inventario como si fuera la lectura de un local. El eje punto de venta no se analiza todavía. */
  for (const q of ["como viene la sucursal Santiago?", "dame el margen por punto de venta", "que local vende menos?"]) {
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESC, callAgente: MUDO });
    const T = String(r.r.text || "");
    ok(!/\bCapital\b.*\$|\$\d+K de capital/.test(T),
      `★★ «${q}» NO se responde con una bodega: el eje vecino no reemplaza al que el usuario pidió`, T.slice(0, 120));
  }
  {
    /* …y la bodega SIGUE funcionando cuando se la nombra como lo que es */
    const r = await answerViaAgente({ text: "como viene la bodega Santiago?", history: [], mem: {}, scenario: ESC, callAgente: MUDO });
    ok(r.r.agente.estado !== "vacio", "★ …y preguntar por la BODEGA sigue funcionando: se cerró la confusión, no el eje", r.r.agente.estado);
  }
  {
    /* …y cuando se responde por otro eje, SE DECLARA cuál se pidió */
    const r = await answerViaAgente({ text: "por que cayo la venta en la sucursal Providencia?", history: [], mem: {}, scenario: ESC, callAgente: MUDO });
    ok(/punto de venta.{0,40}no lo analizo/s.test(String(r.r.text || "")),
      "★★ …y si responde por cliente, DICE que el corte pedido no existe todavía — callarlo es improvisar por omisión", String(r.r.text || "").split("\n").find((l) => /punto de venta/.test(l)) || "(no lo declara)");
  }

  /* ── (2) LA DESCOMPOSICIÓN SE CITA EN PAQUETE ───────────────────────────────────────────────────────────
   * Medido en el muro: «el efecto volumen es +5.7%» SOLA se veta (el +1.8% coincide con la cifra de otra
   * cuenta y sin el total al lado no se sabe de quién es); las tres juntas pasan. La ley lo dice. */
  {
    const dv = TOOLS.salesRead({ focus: "descomposicion_vol_precio", dimension: "cliente", scenario: ESC });
    const arnes = { ledger: { figs: dv.boleta }, question: "por que crecio la venta", datoProyectado: cifrasDelDato(ESC) };
    const tot = (dv.boleta.find((f) => /Crecimiento total/i.test(f.label)) || {}).value;
    const vol = (dv.boleta.find((f) => /Efecto volumen/i.test(f.label)) || {}).value;
    const pre = (dv.boleta.find((f) => /Efecto precio/i.test(f.label)) || {}).value;
    ok(guardC(`La venta crece ${tot}: el efecto volumen aporta ${vol} y el precio realizado ${pre}.`, arnes).ok,
      "★★ las tres cifras JUNTAS pasan el muro — así es como se narra una descomposición");
    ok(!guardC(`El efecto volumen es ${vol}.`, arnes).ok,
      "…y suelta NO pasa: sin el total al lado la cifra no se puede atribuir (por eso la ley pide el paquete)");
    ok(/se citan JUNTAS/.test(doctrinaDelPorque()),
      "★ y la letra se lo dice al cerebro, para que no descubra la regla a golpes de veto");
  }

  /* ── (3) LA ADVERTENCIA DEL MIX LLEGA A ADI ─────────────────────────────────────────────────────────────
   * El «precio realizado» es venta÷unidades: SUBE si cambia la mezcla de quién compra, sin que se haya movido
   * ningún precio. El motor escribe la salvedad pero se pierde antes de llegar al cerebro; la ley la lleva. */
  {
    const d = doctrinaDelPorque();
    ok(/CAMBIÓ LA MEZCLA/.test(d) && /jamás digas «subiste precios»/.test(d),
      "★★ la ley advierte que el precio realizado se mueve por MEZCLA — decir «subiste precios» a partir de él es una causa inventada");
  }

  /* ── (4) UN CANAL «—» NO ES UN CANAL ────────────────────────────────────────────────────────────────────
   * Este defecto lo ABRIÓ esta tanda al habilitar el eje canal: un archivo sin esa columna (es opcional en la
   * plantilla) hacía que todos los clientes cayeran en el grupo «—» y la lectura respondía tan campante —
   * «el canal — tiene margen 25.1%, recuperar 1pp vale $1.0M». Inventarle al usuario una dimensión que su
   * archivo no declara. */
  {
    const sinCanal = JSON.parse(JSON.stringify(TENANT_DEMO));
    for (const c of sinCanal.clientesVentas || []) delete c.canal;
    initTenant(sinCanal);
    for (const tool of ["marginRead", "salesRead"]) {
      const r = TOOLS[tool]({ dimension: "canal", scenario: ESC });
      ok(r.coverage && r.coverage.supported === false && (r.boleta || []).length === 0,
        `★★ ${tool}: sin columna canal el eje NO existe — declina en vez de fabricar un canal «—» con cifras`,
        JSON.stringify((r.boleta || []).slice(0, 2).map((f) => f.label)));
    }
    initTenant(TENANT_DEMO);
    for (const tool of ["marginRead", "salesRead"]) {
      const r = TOOLS[tool]({ dimension: "canal", scenario: ESC });
      ok((r.boleta || []).length > 0, `★ …y con la columna declarada, ${tool} por canal sigue respondiendo: se cerró el invento, no el eje`);
    }
  }

  /* ── (5) LA DIVERGENCIA DE MARCA · VERIFICADA Y DECLARADA (no se toca) ──────────────────────────────────
   * Verificado ejecutando: en el escenario que muestra la app, la tabla de VENTAS dice Samsung 33.158 y la de
   * MARGEN dice 31.600 — y entityProfile/queryMetric/entityRecord publican la SEGUNDA. O sea: ADI y la
   * pantalla darían cifras distintas para la misma marca.
   * NO SE ARREGLA ACÁ A PROPÓSITO: `entityRecord.js` lo declara como pendiente del owner con su razón
   * («cablear el eje MARCA completo mueve cifras de producto y sigue siendo decisión del owner»), y la función
   * que reconcilia (`applyScenarioToMarcasMargen`) existe sin usar. Este chequeo NO exige que coincidan: exige
   * que el pendiente siga DECLARADO donde alguien lo vaya a leer. Si un día se cablea, esto sigue verde y el
   * de la divergencia se apaga solo. */
  {
    const record = leer("src/adi/oracle/entityRecord.js");
    ok(/applyScenarioToMarcasMargen.*sin usar.*decisión del owner|MARCA queda entero sobre el literal/s.test(record),
      "★ la divergencia de marca entre los dos universos sigue DECLARADA en el código como pendiente del owner — verificada, no silenciada");
    const mv = applyScenarioToMarcasVentas(ESCENARIO_INICIAL) || [];
    const mm = TENANT_DEMO.marcasMargen || [];
    const difieren = mv.filter((v) => { const g = mm.find((x) => x.nombre === v.nombre); return g && g.venta !== v.actual; });
    ok(true, `   (medición del pendiente: ${difieren.length} de ${mv.length} marcas difieren entre los dos universos en «${ESCENARIO_INICIAL}» — el escenario que muestra la app)`);
  }
}


console.log(`\n── _agente_porque_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
