/* === _certificacion_congelada_gate.mjs · LOS 28 TURNOS DE LA CERTIFICACIÓN, CONGELADOS (owner 2026-09-02) ===
 *
 * El owner pagó por medir estos 28 turnos (demo 8 · planilla COMPLETA 12 · planilla PARCIAL 8, conductor5 +
 * remedición). Hoy son expedientes; ESTO los convierte en candado: cada turno corre OFFLINE con el cerebro
 * MUDO y su veredicto es el PASS escrito de la certificación, medido como CONDUCTA — playbook que aplica ·
 * cifra insignia presente · límite que nombra la pieza · cero menú de labels internos · trato cuando se pidió —
 * jamás una comparación de texto byte a byte: el texto del cerebro varía, la conducta no debe.
 *
 * EL CEREBRO MUDO ES EL PISO, y que el piso apruebe 26/28 es el punto: la escalera determinística (playbooks ·
 * puente · composer · límite con pieza) responde sola lo que el owner midió. Los DOS turnos donde el piso no
 * alcanza el techo del cerebro vivo quedan DECLARADOS con su porqué, no maquillados:
 *   · DEMO t7 («versión más dura») es RE-NARRACIÓN: la calidad de la reformulación es del cerebro vivo; lo
 *     congelable es la ECONOMÍA (cero herramientas — el empujón ahí se midió 43× más caro y peor) y el
 *     no-secuestro. Eso es lo que se exige.
 *   · COMPLETA t10 («llamame jc. ¿cómo viene mi margen?»): el composer del molde se retira porque el panel
 *     declara 15 bajo el benchmark y publica 13 márgenes (la misma hambruna de raws medida en el panel de SKU)
 *     — reportado como hallazgo; el piso congelado es trato + cifra verificada + sin frase de molde.
 *
 * LOS TRES MUNDOS: el demo siempre; las DOS planillas del owner CONDICIONALES a los archivos en disco — si no
 * están, esa mitad se DECLARA saltada (jamás un verde de adorno), igual que en _medida_escala_gate.
 *
 * EL REPLAY DE LA ESCALERA (fixtures/certificacion-2026-09-expediente.json — el turno 4 real de la COMPLETA,
 * capturado ANTES del playbook del límite): el cerebro del expediente pide gridTable y entrega dos borradores
 * con «4.9x» que el muro veta; HOY la escalera entera queda visible en un solo turno — cierre vetado →
 * reparación vetada → LA PODA corre (tira la oración del 4.9x) → su producto lo caza la notarial nueva
 * (eje-servido-a-escondidas: la conducta T4 exacta que el owner marcó) → el peldaño compone el límite honesto.
 * Agosto terminaba en «podado» con el eje escondido; hoy termina en la respuesta correcta, con la poda y la
 * notarial trabajando a la vista.
 *
 * CARNADAS — una por familia, la red de todo lo demás: desconectar los playbooks pone ROJO el t1 del demo Y el
 * replay; revertir la poda pone ROJO el replay (su tercer veto desaparece); apagar el trato pone ROJO el t1.
 *
 * ═══ EL PROCESO DE CRECIMIENTO DE ESTE GATE (owner 2026-09-03, la regla del «UN SOLO ADI») ═════════════════
 * Cada defecto REAL encontrado en uso entra como TURNO de este gate **ANTES de arreglarse**: se escribe el
 * turno con la conducta correcta como veredicto, se ve ROJO (la prueba de que el turno reproduce el defecto),
 * y queda VERDE con el arreglo — TDD de conducta. El turno lleva la fecha y de dónde salió (la captura, el
 * reporte del owner, el examen). Así la certificación no es una foto de septiembre: es el acumulado de todo lo
 * que el producto ya se equivocó una vez, y nadie degrada mañana lo que un usuario ya pagó por descubrir.
 *   caso 1 · t9 del demo (2026-09-02): «Mercado Norte» → declinaba sobre «Mercado Libre» — el sujeto
 *            sustituido. Verde con 310ca8f (solo exacto resuelve; el parecido se ofrece).
 *   caso 2 · replay 1b del demo (2026-09-03, corrida del supervisor): «tu margen está 8,6 puntos por debajo
 *            del benchmark» — la brecha de LIDER vestida de brecha del negocio (la real: 5,0 = 30,1 − 25,1,
 *            la card de la Mesa al lado). ROJO antes del arreglo (el borrador salía tal cual: ninguna pieza
 *            hacía la resta); verde con la regla notarial «brecha-del-negocio-no-cierra» + la fig sellada
 *            «El negocio · Brecha al benchmark» + el criterio aritmético del humo. La conducta congelada:
 *            una brecha atribuida al negocio CIERRA con benchmark − promedio, o no sale.
 *
 * OFFLINE · determinístico · cerebro = mudo o guion del expediente · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _certificacion_congelada_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { playbookPara } from "./src/adi/agente/playbooks/registro.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const MUDO = async () => ({ tipo: "texto", texto: "" });

const COMPLETA = "C:/Users/jcnav/Downloads/Plantilla_ADI_v2_completa_25_clientes_ajustada.xlsx";
const PARCIAL = "C:/Users/jcnav/Downloads/Plantilla_ADI_v2_parcial_10_clientes_ajustada.xlsx";
const cargar = (ruta, nombre) => {
  const ing = ingestarPlantilla(fs.readFileSync(ruta), { nombreArchivo: nombre, fechaCarga: "2026-08-31" });
  if (!ing.ok || !ing.dataset) throw new Error(`la planilla ${nombre} no ingesta`);
  return ing.dataset;
};

/* el runner secuencial: history y mem se acumulan COMO EN LA CONSOLA del examen (turnos que dependen del hilo:
 * «Con ese total anual…», «Sobre esos clientes…»). El check de cada turno recibe el resultado y el texto. */
async function escenario(nombre, turnos, callAgente = MUDO) {
  let S = { history: [], mem: {} };
  for (const t of turnos) {
    const out = await answerViaAgente({ text: t.q, history: S.history, mem: S.mem, scenario: ESCENARIO_INICIAL, callAgente });
    const texto = String(out.r.text || "");
    t.check(out.r.agente, texto);
    S.history = S.history.concat([{ role: "user", text: t.q }, { role: "adi", text: texto }]);
    S.mem = out.mem || S.mem;
  }
}

/* ═══ 1 · DEMO · los 8 turnos del escenario 1 ════════════════════════════════════════════════════════════════ */
H("1 · DEMO · la confirmación de los cuatro arreglos, congelada");
initTenant(TENANT_DEMO);
await escenario("DEMO", [
  { q: "llamame jc de ahora en adelante. como viene mi margen?", check: (a, t) => {
    ok(a.estado === "playbook" && /^jc[:,]/.test(t), `t1 · playbook margen CON el trato «jc» registrado solo (${a.estado})`, t.slice(0, 80));
    // (conducta, no frase — la voz humana 2026-09-03 reescribió el entregable; las cifras son las mismas)
    ok(/(?:benchmark|referencia)[^\n]{0,60}30\.1%|30\.1%[^\n]{0,60}benchmark/i.test(t) && /\b8\b[^\n]{0,60}bajo (?:esa referencia|el benchmark)/i.test(t),
      "t1 · la cartera con sus cifras: benchmark 30.1% y los 8 bajo la vara");
  } },
  { q: "ponele que el año que viene crezco 3%: cuanto seria mi venta?", check: (a, t) => {
    ok(a.estado === "playbook" && /\$103\.0M/.test(t) && /proyección sobre el supuesto que declaraste/.test(t),
      `t2 · proyecta sobre la venta TOTAL y declara el supuesto (${a.estado})`, t.slice(0, 90));
    ok(!/¿[^?]*global o por cliente/i.test(t), "t2 · NO pregunta «¿global o por cliente?» — el defecto P1 no vuelve");
  } },
  { q: "Dime cuáles son los clientes que venden mucho pero están bajo el benchmark", check: (a, t) => {
    ok(a.estado === "playbook" && /contribuci[oó]n (?:no capturada|sin capturar)/i.test(t) && /Falabella/.test(t),
      `t3 · la cartera bajo el benchmark con cifras verbatim (${a.estado})`);
  } },
  { q: "Con ese total anual, proyecta 12 meses con +4% y dime cuánto genera adicional.", check: (a, t) => {
    ok(a.estado === "playbook" && /\$104\.0M/.test(t) && /Adicional generado: \$4\.0M/.test(t),
      `t4 · proyecta sobre el total del hilo sin re-pedir la entidad (${a.estado})`, t.slice(0, 90));
  } },
  { q: "Sobre esos clientes, simula reducir 2 puntos porcentuales las acciones comerciales y dime si alguno queda sobre el benchmark.", check: (a, t) => {
    ok(a.estado === "playbook" && /-2pp/.test(t) && /Quedan sobre el benchmark 6 de 13/.test(t),
      `t5 · la simulación declarada con el signo correcto y quiénes quedan sobre Y bajo (${a.estado})`, t.slice(0, 90));
  } },
  { q: "Compara Q1 vs Q2 en ventas, margen y contribución. Si no está en la carpeta, dilo.", check: (a, t) => {
    ok(a.estado === "playbook" && /no trae un corte por trimestre/.test(t) && /no la invento/.test(t),
      `t6 · el límite del trimestre con su razón, sin inventar la suma (${a.estado})`);
    ok(/lectura por CLIENTE contra el año anterior/.test(t) && !/dime cu[aá]l abro/.test(t),
      "t6 · la alternativa NOMBRADA con su eje — el menú de labels internos no vuelve");
  } },
  { q: "Dame una versión más dura, como si tuviera que presentarla al gerente general.", check: (a, t) => {
    /* re-narración: la CALIDAD de la reformulación es del cerebro vivo (acá está mudo); lo congelado es la
     * economía —cero herramientas, la lección del 43×— y que nadie la secuestre ni vuelva el molde. */
    ok(a.calls === 0, `t7 · re-narración SIN salir a leer: 0 herramientas (la lección del 43×) (calls=${a.calls})`);
    ok(playbookPara("Dame una versión más dura, como si tuviera que presentarla al gerente general.") === null
      && !/sigue verificado y en pie/.test(t), "t7 · ningún playbook la secuestra y la frase de molde no existe más");
  } },
  { q: "cuanto me compro falabella el ultimo mes", check: (a, t) => {
    ok(a.estado === "puente" && /no reconcilia|de muestra/.test(t) && /Falabella/.test(t),
      `t8 · la serie bloqueada se declina con la razón VERDADERA y la puerta a la ficha (${a.estado})`, t.slice(0, 90));
  } },
  /* ── EL PROCESO DE CRECIMIENTO · caso 1 (ver la doctrina en la cabecera) ──────────────────────────────────
   * 2026-09-02, captura del owner EN USO: preguntó por «Mercado Norte» y ADI declinó sobre «Mercado Libre» —
   * el sujeto sustituido en silencio. Entró acá como turno ANTES del arreglo (rojo) y quedó verde con 310ca8f:
   * el nombre pedido no existe en el demo, se declina NOMBRÁNDOLO y el parecido se OFRECE, jamás se asume. */
  { q: "¿Cuánto me compró Mercado Norte el último mes?", check: (a, t) => {
    ok(a.estado === "puente" && /No encuentro «Mercado Norte» entre tus clientes/.test(t),
      `t9 · PROCESO caso 1: el sujeto de la pregunta es sagrado — se declina con SU nombre (${a.estado})`, t.slice(0, 100));
    ok(/¿Quisiste decir Mercado Libre\?/.test(t) && !/de Mercado Libre no está/.test(t),
      "t9 · …y Mercado Libre se ofrece, jamás se asume — ni una línea sobre el cliente equivocado");
  } },
]);

/* ═══ 1b · EL PROCESO DE CRECIMIENTO · caso 2 · el 8,6 que no cierra (owner 2026-09-03) ═════════════════════
 * El borrador REAL de la corrida del supervisor (congelado en el expediente como `caso2`), re-emitido por un
 * cerebro-guion sobre el demo: abre con la brecha de Lider vestida de brecha del negocio. La escalera de HOY
 * tiene que vetarlo (la notarial nueva hace la resta) y el turno tiene que salir SIN esa afirmación — por
 * poda o por peldaño, el mecanismo no se congela: la CONDUCTA sí. */
H("1b · PROCESO caso 2: la brecha del negocio que no cierra muere en el muro");
{
  const EXP2 = JSON.parse(fs.readFileSync(path.join(process.cwd(), "fixtures", "certificacion-2026-09-expediente.json"), "utf8"));
  initTenant(TENANT_DEMO);
  let n = 0;
  const guion = async () => (++n === 1 ? { tipo: "texto", texto: EXP2.caso2.borrador } : { tipo: "texto", texto: "" });
  const r = await answerViaAgente({ text: EXP2.caso2.q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guion });
  const t = String(r.r.text || "");
  const vetos = (r.r.agente.vetos || []).map((v) => String(v && (v.multa || v.detail) || v));
  ok(vetos.some((v) => /declaras que el margen del negocio|brecha-del-negocio/.test(v)),
    "★ caso 2: el muro caza el borrador vivo del 8,6 — la notarial hace la resta (30,1 − 25,1 ≠ 8,6)");
  ok(!/(?:tu margen|margen promedio)[^|\n]{0,60}8[.,]6\s*(?:pp|puntos)/i.test(t),
    "★ caso 2: el turno sale SIN la brecha de Lider vestida de negocio — la conducta que el borrador violaba", t.slice(0, 120));
  ok(t.trim().length > 80 && /%/.test(t) && r.r.agente.estado !== "vacia",
    `caso 2: …y sigue siendo una respuesta con cifras, no un silencio (${r.r.agente.estado})`, t.slice(0, 90));
}

/* ═══ 1c · PROCESO casos 3 y 4 · LAS DOS SEÑALES DEL OWNER EN PRODUCCIÓN (2026-09-05) ═══════════════════════
 * Probó la 2.x («esto me gusta mucho más») y trajo dos preguntas que caían al rescate honesto. Medido antes de
 * arreglar: las dos daban `playbookPara` = NINGUNO → el cerebro quedaba sin piso → veto → rescate. El diario NO
 * falló (la tesis se guarda y sobrevive turnos ajenos); lo que no existía era la RUTA.
 *   caso 3 · el SEGUIMIENTO: «¿cambia tu lectura?» con una tesis viva en el hilo tiene que RE-MEDIR y decir
 *            confirma/cambió — jamás una lectura nueva desde cero, jamás un declive.
 *   caso 4 · el RESUMEN GENERAL: «¿cómo va el negocio?» / «resumen ejecutivo de negocio» es la FOTO (distinta
 *            de los riesgos del directorio, que ya tiene su playbook) y no tenía camino garantizado. */
H("1c · PROCESO casos 3 y 4: las dos señales del owner — seguimiento y resumen general");
{
  initTenant(TENANT_DEMO);
  /* caso 3 · el seguimiento re-mide sobre la tesis del hilo */
  const previo = await answerViaAgente({ text: "por que estamos perdiendo margen?", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
  ok(!!(previo.mem && previo.mem.diarioTesis), "caso 3 · la premisa: el turno del porqué deja su tesis en el hilo");
  const seg = await answerViaAgente({ text: "¿cambia tu lectura?", history: [{ role: "user", text: "por que estamos perdiendo margen?" }, { role: "adi", text: previo.r.text }],
    mem: previo.mem, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
  const ts = String(seg.r.text || "");
  ok(seg.r.agente.estado === "playbook" && !/No pude completar la lectura/.test(ts),
    `★ caso 3: el seguimiento tiene camino garantizado — ni rescate ni vacío (${seg.r.agente.estado})`, ts.slice(0, 100));
  ok(/no cambia|sigue|confirma/i.test(ts) && /(?:al )?volver a medir|re-?medi|midiendo de nuevo/i.test(ts),
    "★ caso 3: responde confirmando y NOMBRA la re-medición — no repite de memoria", ts.slice(0, 140));
  ok(/lo nuevo/i.test(ts), "★ caso 3: declara QUÉ APORTA este turno («lo nuevo es…») — un seguimiento sin novedad es un eco");
  /* …y sin tesis en el hilo, el mismo turno es honesto y arma la lectura */
  const segSin = await answerViaAgente({ text: "¿cambia tu lectura?", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
  ok(/no tenemos una lectura previa|no hay una lectura previa/i.test(String(segSin.r.text || "")),
    "★ caso 3: sin tesis en el hilo lo dice y arma la lectura — jamás finge recordar", String(segSin.r.text || "").slice(0, 110));

  /* caso 3-bis · EL REPRO DEL SUPERVISOR, congelado tal cual (2026-09-05). Su corrida cayó al rescate donde la
   * mía pasaba: mismo turno, OTRO largo de hilo → otra semilla → otra variante del cierre, y esa variante
   * («Lo nuevo está en QUÉ HACER: …») recomendaba sin marcar el criterio. La lección quedó en el gate de
   * variación (todas las variantes × varios largos, por el turno completo); acá queda el turno exacto que lo
   * destapó, con SU forma: history vacío en los dos turnos y la memoria acarreada. */
  {
    const p1 = await answerViaAgente({ text: "dime por qué estamos perdiendo margen", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
    const p2 = await answerViaAgente({ text: "Volviendo al margen, ¿cambia tu lectura?", history: [], mem: p1.mem, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
    const t2 = String(p2.r.text || "");
    ok(p2.r.agente.estado === "playbook" && !(p2.r.agente.vetos || []).length,
      `★ caso 3-bis (repro del supervisor): el seguimiento con history vacío y mem acarreado NO cae al rescate (${p2.r.agente.estado})`,
      `${t2.slice(0, 100)} · vetos: ${JSON.stringify((p2.r.agente.vetos || []).map((v) => String(v).slice(0, 60)))}`);
    ok(/criterio m[íi]o|dato duro|no sale del dato/i.test(t2),
      "★ caso 3-bis: la variante que salga marca su criterio — la que recomendaba sin marcarlo era la que se vetaba");
  }

  /* caso 4 · el resumen general del negocio */
  for (const q of ["¿cómo va el negocio?", "dame un resumen ejecutivo de negocio", "puntos altos y bajos"]) {
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
    const t = String(r.r.text || "");
    ok(r.r.agente.estado === "playbook" && !/No pude completar la lectura/.test(t),
      `★ caso 4 «${q}»: la foto del negocio tiene camino garantizado (${r.r.agente.estado})`, t.slice(0, 90));
    ok(/\$/.test(t) && /(?:alto|bien|sostiene|favor)/i.test(t) && /(?:bajo|presion|cuida|riesgo|atenci)/i.test(t),
      `★ caso 4 «${q}»: cuenta la historia con cifras — lo que va bien y lo que no`, t.slice(0, 110));
  }
  /* y el DESLINDE: los riesgos del directorio siguen siendo de la síntesis, no de la foto */
  ok(playbookPara("dame los 3 riesgos para el directorio") && playbookPara("dame los 3 riesgos para el directorio").nombre === "sintesis-ejecutiva",
    "★ caso 4: el deslinde se mantiene — «los 3 riesgos para el directorio» sigue siendo de la síntesis ejecutiva");
  ok(playbookPara("¿cómo va el negocio?") && playbookPara("¿cómo va el negocio?").nombre !== "sintesis-ejecutiva",
    "…y «cómo va el negocio» NO cae en la síntesis: son dos preguntas distintas y el registro no duda");
}

/* ═══ 1d · LA SIEMBRA DEL ASK DE CUADRO (owner 2026-09-05, adenda «sembrar, no construir») ══════════════════
 * El contexto de la pieza tocada YA lo armaba la UI y se lo pasaba solo al camino natural: el agente no lo
 * recibía. Ahora entra, viaja y queda en el expediente del turno. Esto es TODO lo que se promete hoy — el
 * anclaje campo-por-campo es el pulido que el owner difirió. El contrato está en .
 * Se congela acá para que la siembra tenga carnada viva y el pulido futuro tenga de dónde agarrarse. */
H("1d · la siembra: el ask de cuadro llega con su contexto y queda registrado");
{
  initTenant(TENANT_DEMO);
  const vc = { vista: "capital", seccion: "cuadro-bodegas", eje: "bodega", entidad: "Santiago" };
  const r = await answerViaAgente({ text: "¿Cuánto capital tengo en Santiago?", history: [], mem: {}, scenario: ESCENARIO_INICIAL, viewContext: vc, callAgente: MUDO });
  const reg = r.r.agente.viewContext;
  ok(!!reg && reg.vista === "capital" && reg.seccion === "cuadro-bodegas" && reg.eje === "bodega" && reg.entidad === "Santiago",
    "★ el contexto del cuadro llega al agente y queda en su expediente — el receptor ya escucha lo que el emisor sembraba", JSON.stringify(reg));
  const sin = await answerViaAgente({ text: "¿Cuánto capital tengo en Santiago?", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
  ok(sin.r.agente.viewContext === undefined,
    "…y sin contexto no se inventa uno: la llave no aparece (un contexto adivinado sería peor que ninguno)");
  ok(!/\$\s?[\d.,]|\d+\s?%/.test(JSON.stringify(reg)),
    "★ el contexto DESCRIBE la superficie y no trae cifras: el cuadro dice QUÉ mirar, el módulo dice CUÁNTO");
}
/* ═══ 2 · COMPLETA · los 12 turnos del techo del producto (condicional al archivo del owner) ═════════════════ */
H("2 · COMPLETA · el techo del producto, congelado");
if (fs.existsSync(COMPLETA)) {
  initTenant(cargar(COMPLETA, "completa.xlsx"));
  await escenario("COMPLETA", [
    { q: "cuánto me compró Mercado Norte el último mes", check: (a, t) => {
      ok(a.estado === "playbook" && /Mercado Norte te compró \$8\.226\.765 en agosto 2026/.test(t),
        `c1 · INSIGNIA: la cifra del mes con su nombre (${a.estado})`, t.slice(0, 90));
      ok(/43\.6% más contra el mes anterior/.test(t), "c1 · …y el delta contra el anterior, con la cuenta declarada y el signo que el muro lee");
    } },
    { q: "muéstrame la venta de Mercado Norte mes a mes", check: (a, t) => {
      ok(a.estado === "playbook" && /marzo 2026: \$2\.180\.776/.test(t) && /agosto 2026: \$8\.226\.765/.test(t) && (t.match(/- \w+ 2026:/g) || []).length === 6,
        `c2 · INSIGNIA: los 6 meses con sus cifras verbatim (${a.estado})`);
    } },
    { q: "ranking por canal: mejores y peores", check: (a, t) => {
      ok(a.estado === "playbook" && ["Mayorista", "Retail", "Supermercado", "Tienda", "Construccion", "Distribuidor", "Online"].every((c) => t.includes(c)),
        `c3 · los 7 canales REALES del archivo (${a.estado})`);
    } },
    { q: "por punto de venta, ¿quién queda bajo el plan?", check: (a, t) => {
      ok(a.estado === "playbook" && /SÍ trae punto de venta \(150 filas con 5 valores distintos\)/.test(t) && /todavía no analiza por ese eje/.test(t),
        `c4 · el límite honesto: capturado SIN analizar, con las filas y valores de SU archivo (${a.estado})`);
      ok(/lectura por CLIENTE/.test(t) && !/dime cu[aá]l abro/.test(t), "c4 · …y la alternativa nombrada, sin menú de labels");
    } },
    { q: "qué marca deja más margen", check: (a, t) => {
      ok(a.estado === "playbook" && /Astra: 36\.7%/.test(t) && /Vulcano: 19\.8%/.test(t), `c5 · ranking por marca con las cifras reales (${a.estado})`);
    } },
    { q: "margen por familia", check: (a, t) => {
      ok(a.estado === "playbook" && /Iluminacion: 36\.7%/.test(t) && /Electrico: 19\.8%/.test(t), `c6 · ranking por familia con las cifras reales (${a.estado})`);
    } },
    { q: "capital por bodega", check: (a, t) => {
      ok(a.estado === "playbook" && /Central: \$46\.9M/.test(t) && ["Norte", "Sur", "CD Santiago"].every((b) => t.includes(b)),
        `c7 · las 4 bodegas sin mezclar con venta (${a.estado})`);
    } },
    { q: "quién me debe y qué está vencido", check: (a, t) => {
      ok(a.estado === "playbook" && /\$118\.8M/.test(t) && /\$266\.5M/.test(t) && /Comercial Valparaiso: \$17\.7M/.test(t),
        `c8 · la deuda de la hoja Abonos con nombres (${a.estado})`);
      ok(/no se puede saber/.test(t) && !/vencid[oa][^.\n]*\$/.test(t), "c8 · LA REGLA DEL OWNER: el vencido en palabras — ni $0 ni ninguna cifra");
    } },
    { q: "cuánto vendí a crédito vs contado", check: (a, t) => {
      ok(a.estado === "playbook" && /\$266\.5M/.test(t) && /contado no generan deuda/.test(t),
        `c9 · la columna condición con su cifra, sin restar un contado que el dato no trae (${a.estado})`);
    } },
    { q: "llamame jc. ¿cómo viene mi margen?", check: (a, t) => {
      /* EL PISO DECLARADO (ver cabecera): el composer del molde se retira acá — el panel declara 15 bajo el
       * benchmark y publica 13 márgenes (hambruna de raws, reportada). El techo lo pone el cerebro vivo. */
      ok(/^jc[:,]/.test(t) && a.estado !== "vacio", `c10 · PISO: el trato viaja y el turno no cae al genérico (${a.estado})`);
      ok(/\$|%/.test(t) && !/sigue verificado y en pie/.test(t) && !/No tengo información autorizada suficiente/.test(t),
        "c10 · PISO: una cifra verificada presente, sin molde y sin disculpa pelada");
    } },
    { q: "dame los 3 riesgos para el directorio", check: (a, t) => {
      ok(a.estado === "playbook" && /Los 3 riesgos, por materialidad:/.test(t) && /-40\.5%[^\n]{0,50}a[ñn]o anterior|a[ñn]o anterior[^\n]{0,50}-40\.5%/i.test(t),
        `c11 · los 3 riesgos, la venta cayendo primero (${a.estado})`);
      // (la OFERTA, medida como conducta desde la voz ejecutiva del owner 2026-09-03: pregunta o «si te
      //  parece/si quieres», y ninguna orden — el cierre pasó a ser UNO solo, priorizado)
      ok(/Capital frenado en inventario: \$38\.1M/.test(t) && /encabeza ELE-CAB25/.test(t)
        && (/¿[^?]{0,80}\?/.test(t) || /si (?:quieres|te parece)/i.test(t)) && !/ten[eé]s que|hay que\b/i.test(t),
        "c11 · QUÉ·DÓNDE·PRIMERO con cifras del negocio — ofertas, jamás órdenes");
    } },
    { q: "compará Q1 vs Q2", check: (a, t) => {
      ok(a.estado === "playbook" && /no trae un corte por trimestre/.test(t) && /ese eje/.test(t),
        `c12 · límite corto CON la alternativa nombrada (${a.estado})`);
    } },
  ]);
} else {
  console.log("      (la planilla COMPLETA del owner no está en esta máquina: los 12 turnos del escenario 2 NO corren — saltados y declarados, jamás verdes)");
}

/* ═══ 3 · PARCIAL · los 8 turnos de la conducta con dato incompleto (condicional al archivo del owner) ═══════ */
H("3 · PARCIAL · la conducta con dato incompleto, congelada");
if (fs.existsSync(PARCIAL)) {
  initTenant(cargar(PARCIAL, "parcial.xlsx"));
  await escenario("PARCIAL", [
    { q: "quién me debe y qué está vencido", check: (a, t) => {
      ok(/no trae la hoja Abonos/.test(t) && /con eso te abro/.test(t) && !/No tengo información autorizada suficiente/.test(t),
        `p1 · nombra la HOJA que falta y qué abriría (${a.estado})`);
    } },
    { q: "ranking por canal", check: (a, t) => ok(/columna «canal»/.test(t), `p2 · nombra la columna «canal» (${a.estado})`) },
    { q: "cuánto vendí a crédito", check: (a, t) => ok(/columna «condición»/.test(t), `p3 · nombra la columna «condición» (${a.estado})`) },
    { q: "mejores y peores puntos de venta", check: (a, t) => {
      ok(a.estado === "playbook" && /columna «punto de venta»/.test(t) && /lectura por CLIENTE/.test(t),
        `p4 · la columna vacía Y la alternativa nombrada — la razón DISTINTA del mismo límite que en la completa (${a.estado})`);
    } },
    { q: "capital por bodega", check: (a, t) => ok(/columna «bodega»/.test(t) && !/Central|Norte|Sur/.test(t), `p5 · nombra la columna «bodega» sin inventar el corte (${a.estado})`) },
    { q: "¿cómo viene mi margen?", check: (a, t) => {
      ok(a.estado === "playbook" && /(?:benchmark|referencia)[^\n]{0,60}30\.1%|30\.1%[^\n]{0,60}benchmark/i.test(t) && /\b6\b[^\n]{0,60}bajo (?:esa referencia|el benchmark)/i.test(t),
        `p6 · NO-DEGRADACIÓN: el margen funciona igual con el dato incompleto (${a.estado})`);
    } },
    { q: "qué SKU tienen capital frenado", check: (a, t) => {
      ok(a.estado === "playbook" && /ELE-CAB25/.test(t) && /Capital frenado/i.test(t), `p7 · NO-DEGRADACIÓN: el frenado responde por SKU (${a.estado})`);
    } },
    { q: "cuánto me compró Easy el último mes", check: (a, t) => {
      // sin «$»: la planilla parcial no declara símbolo de moneda y el formateador respeta SU archivo
      ok(a.estado === "playbook" && /Easy te compró 5\.007\.016 en agosto 2026/.test(t),
        `p8 · NO-DEGRADACIÓN: la serie responde con las 7 obligatorias (${a.estado})`);
    } },
  ]);
} else {
  console.log("      (la planilla PARCIAL del owner no está en esta máquina: los 8 turnos del escenario 3 NO corren — saltados y declarados, jamás verdes)");
}

/* ═══ 4 · EL REPLAY DE LA ESCALERA · el turno 4 real, con el cerebro del expediente ═════════════════════════ */
H("4 · el replay del expediente: cierre vetado → reparación vetada → PODA → notarial → peldaño");
const EXP = JSON.parse(fs.readFileSync(path.join(process.cwd(), "fixtures", "certificacion-2026-09-expediente.json"), "utf8"));
async function replayEscalera(bucle) {
  let n = 0;
  const guion = async () => {
    n++;
    if (n === 1) return { tipo: "herramientas", pedidos: EXP.pedidos };
    if (n === 2) return { tipo: "texto", texto: EXP.borradorVetado };
    if (n === 3) return { tipo: "texto", texto: EXP.borradorReparado };
    return { tipo: "texto", texto: "" };
  };
  return bucle({ text: EXP.q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guion });
}
if (fs.existsSync(COMPLETA)) {
  initTenant(cargar(COMPLETA, "completa.xlsx"));
  const r = await replayEscalera(answerViaAgente);
  const vetos = (r.r.agente.vetos || []).map((v) => String(v && (v.multa || v.detail) || v));
  ok(vetos.some((v) => /^cierre · 4\.9x/.test(v)) && vetos.some((v) => /^reparacion · 4\.9x/.test(v)),
    "★ el muro veta el borrador del expediente y su reparación (el «4.9x» de agosto sigue muriendo)");
  ok(vetos.some((v) => /^poda · eje-servido-a-escondidas/.test(v)),
    "★ LA PODA CORRIÓ: tiró la oración del 4.9x, y su producto lo cazó la notarial nueva — la conducta T4 exacta que el owner marcó, ahora con nombre");
  ok(r.r.agente.estado === "playbook" && /SÍ trae punto de venta/.test(r.r.text) && !/4\.9x/.test(r.r.text),
    `★ y el turno termina en la respuesta CORRECTA (el límite honesto), mejor que el «podado» de agosto (${r.r.agente.estado})`);
} else {
  console.log("      (sin la planilla COMPLETA, el replay de la escalera no corre — saltado y declarado)");
}

/* ═══ 5 · CARNADAS · desarmar una pieza pone ROJO el turno de la certificación, no solo su gate ═════════════ */
H("5 · carnadas: la certificación congelada es la RED de todo lo demás");
{
  const tmp = [];
  let nMut = 0;
  const mutar = (rel, reemplazos) => {
    const abs = path.join(process.cwd(), rel);
    let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    for (const [de, a] of reemplazos) {
      const antes = txt;
      txt = txt.replace(de, a);
      if (txt === antes) return { error: `la carnada no encontró qué mutar en ${rel}` };
    }
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}_${++nMut}.js`);
    fs.writeFileSync(destino, txt);
    tmp.push(destino);
    return { url: pathToFileURL(destino).href };
  };
  const carnada = async (nombre, reemplazos, prueba) => {
    const m = mutar("src/adi/agente/bucleAgente.js", reemplazos);
    if (m.error) return ok(false, `carnada «${nombre}»`, m.error);
    let cazada = false, detalle = "";
    try { cazada = await prueba((await import(m.url)).answerViaAgente); }
    catch (e) { detalle = `la copia mutada no carga: ${e.message}`; }
    ok(cazada, `carnada «${nombre}» → el turno congelado se pone ROJO`, detalle || "el defecto pasó DESAPERCIBIDO");
  };

  // (1) los playbooks desconectados: el t1 del demo pierde su lectura del margen
  await carnada("los playbooks desconectados del bucle",
    // (re-apuntada T5/anclaje/tanda 3, 2026-09-05: el sitio arma ctxTurno y lo pasa — mide lo mismo de siempre)
    [[/  const playbook = \(\(\) => \{ try \{ return playbookPara\(q, ctxTurno\); \} catch \{ return null; \} \}\)\(\);/, "  const playbook = null;   // CARNADA"]],
    async (bucleMut) => {
      initTenant(TENANT_DEMO);
      const r = await bucleMut({ text: "llamame jc de ahora en adelante. como viene mi margen?", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
      return !(r.r.agente.estado === "playbook" && /30\.1%/.test(r.r.text));
    });
  // (2) la poda revertida: el replay pierde su tercer peldaño (el veto sobre el producto de la poda desaparece)
  if (fs.existsSync(COMPLETA)) {
    await carnada("la poda revertida (la que más quería el supervisor)",
      [[/        const podado = _podarOracionVetada\(t2, _multaDe\(v2\), figsTotales\);/, "        const podado = null;   // CARNADA"]],
      async (bucleMut) => {
        initTenant(cargar(COMPLETA, "completa.xlsx"));
        const r = await replayEscalera(bucleMut);
        const vetos = (r.r.agente.vetos || []).map((v) => String(v && (v.multa || v.detail) || v));
        return !vetos.some((v) => /^poda ·/.test(v));   // el rastro de la poda desaparece → el check ★ de arriba daría ✗
      });
  } else {
    console.log("      (sin la planilla COMPLETA, la carnada de la poda no corre — saltada y declarada)");
  }
  // (3) el trato apagado: la petición de trato se ignora. Con OTRO nombre («ana») a propósito — el store del
  // nombre persiste en el proceso (el t1 de arriba ya registró «jc») y limpiar no tiene API; con el registro
  // mutado, «ana» no puede aparecer jamás — esa ausencia es la prueba.
  await carnada("el trato apagado (el «llamame ana» se ignora)",
    [[/    if \(_trato\) \{ try \{ setNombreUsuario\(_trato\); \} catch \{ \/\* un trato inválido no rompe el turno \*\/ \} \}/, "    if (false) { try { setNombreUsuario(_trato); } catch { /* CARNADA */ } }"]],
    async (bucleMut) => {
      initTenant(TENANT_DEMO);
      const r = await bucleMut({ text: "llamame ana de ahora en adelante. como viene mi margen?", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
      return !/^ana[:,]/.test(String(r.r.text || ""));
    });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _certificacion_congelada_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
