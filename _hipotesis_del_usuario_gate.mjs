/* === _hipotesis_del_usuario_gate.mjs · EL USUARIO PROPONE, ADI CONTRASTA ====================================
 *
 * EL ENCARGO DEL OWNER (2026-09-09), primero de su orden de prioridad: «Después del candado, prioridad:
 * 1. validar hipótesis». Y su descripción de la ruta: «Si el usuario dice "creo que es por descuentos, ¿estoy
 * en lo correcto?" o "¿será que Lider está comprando menos?", ADI debe contrastar esa hipótesis contra el
 * dato: confirmarla, corregirla o dejarla abierta diciendo qué falta.»
 *
 * POR QUÉ ESTA RUTA VA PRIMERA, y por qué su candado es distinto de los demás: es la única donde ADI puede
 * afirmar algo FALSO y salir limpio. Un «sí, está comprando menos» no lleva ninguna cifra, así que ningún
 * juez del muro tiene qué verificar — y el dueño se va con una creencia equivocada confirmada por su asesor.
 * El dato del pack de demostración dice lo contrario: esa cuenta compró MÁS. Por eso el chequeo estrella de
 * este archivo (§5) no mide que ADI responda: mide que CORRIJA al dueño con su propio dato.
 *
 * ⚠️ NADA DE NOMBRES ESCRITOS A MANO. Las cuentas salen del pack cargado, leídas de la boleta de la propia
 * lectura — así el candado vale también para la planilla de un usuario y no solo para el demo, que es la
 * condición que el owner puso cuando se arregló el eje marca.
 *
 * OFFLINE · determinístico · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _hipotesis_del_usuario_gate.mjs` */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { hipotesisDelUsuario as PB } from "./src/adi/agente/playbooks/hipotesisDelUsuario.js";
import { PLAYBOOKS, playbookPara, pasosDe, obligatoriasDe, promesasCumplidas } from "./src/adi/agente/playbooks/registro.js";
import { formaConversacional } from "./src/adi/agente/formaConversacional.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${String(detalle).slice(0, 320)}`); }
};
const H = (t) => console.log(`\n${t}`);
const MUDO = async () => ({ tipo: "texto", texto: "" });
const ESC = ESCENARIO_INICIAL;   // el escenario que muestra la app

initTenant(TENANT_DEMO);

const CAJA = cajaDelAgente(TOOLS);
const figsDe = (pasos, pregunta) =>
  (runPlan({ intent: "answer", calls: pasos.map((s) => ({ tool: s.tool, args: s.args })) },
    { scenario: ESC, maxCalls: 8, preguntaUsuario: pregunta, registry: CAJA }).ledger || {}).figs || [];
const valDe = (f) => String((f && (f.text || f.value)) || "");
const entDe = (l) => { const p = String(l || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };

/* LAS CUENTAS SALEN DEL PACK, no de esta hoja: la que más sube y la que más baja contra el comparable. */
const MOV = (() => {
  const figs = figsDe([{ tool: "salesRead", args: { focus: "vs_anterior", dimension: "cliente" } }], "x");
  const xs = figs.filter((f) => /· YoY$/i.test(f.label || ""))
    .map((f) => ({ n: entDe(f.label), v: Number(f.raw), fmt: valDe(f) }))
    .filter((x) => x.n && Number.isFinite(x.v)).sort((a, b) => b.v - a.v);
  return { sube: xs[0] || null, baja: xs[xs.length - 1] || null };
})();

/* ═══ 0 · EL PACK TRAE CON QUÉ MEDIR ════════════════════════════════════════════════════════════════════════ */
H("0 · el pack cargado tiene una cuenta que sube y otra que baja — sin eso, §5 no probaría nada");
ok(MOV.sube && MOV.sube.v > 0, `hay una cuenta al alza (${MOV.sube ? `${MOV.sube.n} ${MOV.sube.fmt}` : "—"})`);
ok(MOV.baja && MOV.baja.v < 0, `hay una cuenta a la baja (${MOV.baja ? `${MOV.baja.n} ${MOV.baja.fmt}` : "—"})`);

/* ═══ 1 · EL DETECTOR · TRES PIEZAS O NADA ══════════════════════════════════════════════════════════════════
 * forma de hipótesis + tema + dirección. Sin las tres se retira: adivinar qué quiso decir el usuario y
 * contrastar ESO es peor que no tomar el turno. */
H("1 · el detector — la hipótesis se identifica entera, o el playbook se retira");
{
  const DEBE = [
    `¿será que ${MOV.sube.n} está comprando menos?`,
    `creo que ${MOV.baja.n} me está comprando menos, ¿es así?`,
    "creo que es por descuentos, ¿estoy en lo correcto?",
    "me parece que el problema es el costo, ¿tú qué ves?",
    `¿es cierto que ${MOV.sube.n} me está dejando menos?`,
    "sospecho que el margen viene cayendo, ¿lo confirmas?",
    "¿no será que el precio está muy bajo?",
    `creo que ${MOV.sube.n} está creciendo, ¿es así?`,
    "supongo que la culpa es de los rebates, ¿me equivoco?",
    "¿será que estamos vendiendo menos?",
  ];
  const NO_DEBE = [
    "¿por qué febrero es el mes más bajo?", `muéstrame la ficha de ${MOV.sube.n}`, "dame los 5 clientes de mejor margen",
    "¿cuánto vendimos este año?", "explícame el cuadro", "¿qué harías primero?", `compárame ${MOV.sube.n} contra ${MOV.baja.n}`,
    "¿cuál es mi margen?", `quiero ver el detalle de ${MOV.baja.n}`, "¿tú qué opinas?", `¿será algo con ${MOV.sube.n}?`,
    "proyecta 12 meses con +4%", "¿cómo va la cobranza?", "¿qué pasó en marzo?", "dime el top de clientes por venta",
  ];
  const miss = DEBE.filter((q) => !PB.cuandoAplica(q));
  ok(miss.length === 0, `★ las ${DEBE.length} formas de hipótesis del owner se reconocen`, miss.join(" · "));
  const fp = NO_DEBE.filter((q) => PB.cuandoAplica(q));
  ok(fp.length === 0, `★ cero falsos positivos sobre ${NO_DEBE.length} preguntas corrientes`, fp.join(" · "));

  /* las tres piezas, una por una */
  ok(!PB.cuandoAplica("¿tú qué opinas?"), "sin tema no abre — «¿tú qué opinas?» no dice sobre qué");
  ok(!PB.cuandoAplica(`¿será algo con ${MOV.sube.n}?`), "sin dirección no abre — «¿será algo con X?» no afirma nada verificable");
  ok(!PB.cuandoAplica("el margen viene cayendo"), "sin forma de hipótesis no abre — una afirmación seca no pide contraste");
  ok(formaConversacional("creo que es por descuentos, ¿estoy en lo correcto?") === "hipotesis",
    "y la forma la resuelve el detector único de la casa, no un léxico paralelo");
}

/* ═══ 2 · LAS PROMESAS · SIN ELLAS EL PLAYBOOK NO EXISTE ════════════════════════════════════════════════════
 * `promesasCumplidas` devuelve false con la lista vacía: un playbook sin obligatorias declaradas NUNCA se
 * activa. Con `[]` este procedimiento corría sus herramientas —45 cifras en la boleta— y el turno caía igual
 * al rescate porque el composer no se llamaba nunca. */
H("2 · cada tema declara SU promesa — un playbook sin obligatorias no se activa jamás");
{
  const TEMAS = [
    ["compra", "¿será que estamos vendiendo menos?"],
    ["acciones", "creo que es por descuentos, ¿estoy en lo correcto?"],
    ["costo", "me parece que el problema es el costo, ¿tú qué ves?"],
    ["precio", "¿no será que el precio está muy bajo?"],
    ["margen", "sospecho que el margen viene cayendo, ¿lo confirmas?"],
  ];
  for (const [tema, q] of TEMAS) {
    const oblig = obligatoriasDe(PB, q, {});
    const figs = figsDe(pasosDe(PB, q, {}), q);
    ok(oblig.length > 0, `«${tema}» declara promesa (${oblig.map(String).join(" ")})`);
    ok(oblig.every((re) => figs.some((f) => re.test(f.label || ""))),
      `…y el dato la cumple: la lectura de «${tema}» trae esa cifra (${figs.length} en boleta)`);
    ok(promesasCumplidas(PB, figs, q, {}), `…y por eso el procedimiento se activa en «${tema}»`);
  }
  ok(obligatoriasDe(PB, "¿cuánto vendimos este año?", {}).length === 0,
    "y en una pregunta que no es hipótesis no promete nada");
}

/* ═══ 3 · EL CABLEADO · LAS HERRAMIENTAS EXISTEN Y EL REGISTRO LO PONE PRIMERO ══════════════════════════════ */
H("3 · el cableado — herramientas reales, y la precedencia que el owner pidió");
{
  const todas = PB.ejemplos.flatMap((q) => pasosDe(PB, q, {}));
  ok(todas.length > 0 && todas.every((p) => typeof CAJA[p.tool] === "function"),
    `las ${todas.length} herramientas de sus pasos existen en la caja del agente`);
  ok(todas.every((p) => p.args && typeof p.para === "string" && p.para.length > 10),
    "…y cada paso declara args y PARA QUÉ, como exige el registro");
  ok(PLAYBOOKS[0] === PB, "★ va PRIMERO en el registro: la hipótesis del usuario gana sobre ficha y margen general");
  const q = "creo que es por descuentos, ¿estoy en lo correcto?";
  ok(playbookPara(q, { history: [], viewContext: null, cuadro: null, mem: {} }) === PB,
    "…y el registro lo elige de verdad para una hipótesis");
  /* la deuda de la ruta anterior: precio contrastado con cifras de costo era responder otra pregunta */
  const pPrecio = pasosDe(PB, "¿no será que el precio está muy bajo?", {})[0];
  const pCosto = pasosDe(PB, "me parece que el problema es el costo, ¿tú qué ves?", {})[0];
  ok(JSON.stringify(pPrecio) !== JSON.stringify(pCosto),
    "★ precio y costo NO leen lo mismo — contrastar una hipótesis de precio con cifras de costo es responder otra pregunta");
}

/* ═══ 4 · POR EL BUCLE · LAS FRASES DEL OWNER LLEGAN AL PROCEDIMIENTO ═══════════════════════════════════════
 * Con el cerebro MUDO: lo que se mide es el piso determinístico, no la prosa viva. */
H("4 · por el camino real del agente — con el cerebro mudo, el piso solo");
const TURNOS = {};
{
  const CASOS = [
    ["cuenta-que-sube", `¿será que ${MOV.sube.n} está comprando menos?`],
    ["cuenta-que-baja", `¿será que ${MOV.baja.n} está comprando menos?`],
    ["acciones", "creo que es por descuentos, ¿estoy en lo correcto?"],
    ["costo", "me parece que el problema es el costo, ¿tú qué ves?"],
    ["margen-de-cuenta", `¿es cierto que ${MOV.sube.n} me está dejando menos?`],
    ["precio", "¿no será que el precio está muy bajo?"],
    ["cartera", "¿será que estamos vendiendo menos?"],
  ];
  for (const [tag, q] of CASOS) {
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESC, callAgente: MUDO });
    TURNOS[tag] = { q, texto: String((r.r && r.r.text) || ""), agente: (r.r && r.r.agente) || {} };
    ok(TURNOS[tag].agente.estado === "playbook", `«${tag}» lo resuelve el procedimiento (estado ${TURNOS[tag].agente.estado})`);
    ok((TURNOS[tag].agente.vetos || []).length === 0, `…sin vetos del muro`, (TURNOS[tag].agente.vetos || [])[0]);
  }
}

/* ═══ 5 · EL CHEQUEO ESTRELLA · CORREGIR AL DUEÑO CON SU PROPIO DATO ════════════════════════════════════════
 * El defecto que hizo que esta ruta fuera la primera de la lista: confirmar una creencia falsa sin leer. */
H("5 · ★ el veredicto — confirma, corrige, o declara qué falta; nunca un «sí» pelado");
{
  const sube = TURNOS["cuenta-que-sube"], baja = TURNOS["cuenta-que-baja"];
  ok(/al rev[eé]s de lo que supon|no es lo que dice tu dato/i.test(sube.texto),
    `★ CORRIGE: al dueño que cree que ${MOV.sube.n} compra menos le dice que va al revés`, sube.texto.slice(0, 160));
  ok(sube.texto.includes(MOV.sube.fmt), `…y la corrección viaja con SU cifra (${MOV.sube.fmt})`);
  ok(/es correcta/i.test(baja.texto) && baja.texto.includes(MOV.baja.fmt),
    `★ CONFIRMA cuando el dato le da la razón (${MOV.baja.n} ${MOV.baja.fmt})`, baja.texto.slice(0, 160));
  ok(/tu hip[oó]tesis|contrasto/i.test(sube.texto) && /tu hip[oó]tesis|contrasto/i.test(baja.texto),
    "★ y ambas abren repitiendo QUÉ se está contrastando — si entendió mal, el dueño lo ve en la primera línea");
  /* la caja apretada de este playbook: el mecanismo medido no es la causa probada */
  ok(/no si fue la razón|no por qué|no los separa|de tu lado|dímelo/i.test(TURNOS["acciones"].texto),
    "confirmar el MECANISMO no es confirmar la CAUSA: la atribución queda abierta y pide el dato del dueño",
    TURNOS["acciones"].texto.slice(0, 160));
  ok(/su propio pasado|no su historia/i.test(TURNOS["margen-de-cuenta"].texto),
    "★ y el límite se DECLARA: contra el benchmark responde, contra su propio pasado dice que no lo tiene",
    TURNOS["margen-de-cuenta"].texto.slice(0, 160));
}

/* ═══ 6 · NINGÚN NÚMERO ESCRITO A MANO ══════════════════════════════════════════════════════════════════════
 * CLAUDE.md §2.3. La primera versión abría con «2 cuentas bajan y 6 suben» — ese 2 y ese 6 los contó el
 * composer, no salen de ninguna cifra de la boleta. El muro la vetó; acá queda el candado. */
H("6 · cada número del texto sale de la boleta — cero cuentas hechas a mano");
{
  for (const [tag, t] of Object.entries(TURNOS)) {
    const figs = figsDe(pasosDe(PB, t.q, {}), t.q);
    const enBoleta = new Set(figs.map(valDe).filter(Boolean));
    /* los números del texto, con su formato: se buscan como los publica la boleta */
    const sueltos = (t.texto.match(/[+-]?\$?\d[\d.,]*\s*(?:pp|%|[KMB])?/g) || [])
      .map((s) => s.trim()).filter((s) => /\d/.test(s))
      .filter((s) => ![...enBoleta].some((v) => v === s || v.includes(s) && /^[+-]?\$?\d[\d.,]*\s*(?:pp|%|[KMB])?$/.test(v)));
    ok(sueltos.length === 0, `«${tag}» no escribe ningún número propio`, sueltos.join(" · "));
  }
}

/* ═══ 7 · LA COLA SE DECLARA ════════════════════════════════════════════════════════════════════════════════
 * CLAUDE.md §5: un top-N que no declara su cola miente por omisión aunque cada barra sea correcta. */
H("7 · la cola declarada — y sin contarla, que sería otro número a mano");
{
  const t = TURNOS["cartera"].texto;
  ok(/y siguen otras/i.test(t), "cuando la lista se recorta, el texto lo dice", t.slice(0, 200));
  ok(!/\b\d+\s+(?:cuentas?|clientes?)\s+(?:bajan?|suben?)/i.test(t),
    "★ y NO las cuenta: «N cuentas bajan» sería un número escrito a mano — y falso, porque la lectura ya recortó su top");
}

/* ═══ 8 · EL NOTARIO DEL PROCEDIMIENTO ══════════════════════════════════════════════════════════════════════ */
H("8 · su lista notarial — lo que multa, y lo que NO debe multar");
{
  const q = `¿será que ${MOV.sube.n} está comprando menos?`;
  const figs = figsDe(pasosDe(PB, q, {}), q);
  const reglas = (texto) => PB.listaNotarial(texto, { figs, pregunta: q }).map((v) => v.regla);

  ok(reglas(`Sí, ${MOV.sube.n} está comprando menos.`).includes("confirmacion-sin-lectura"),
    "★ confirmar sin una sola cifra del turno ARDE — el defecto que hizo primera a esta ruta");
  ok(reglas(`Tu hipótesis: contrasto. No es lo que dice tu dato: ${MOV.sube.n} va ${MOV.sube.fmt}.`).length === 0,
    "…y el mismo veredicto CON su cifra pasa limpio");
  ok(reglas(`${MOV.sube.n} va ${MOV.sube.fmt} contra el período comparable.`).includes("hipotesis-no-repetida"),
    "responder con cifras sin decir qué se contrasta ARDE — es el secuestro que este playbook impide");
  /* ⚠️ y la mitad que se aprendió midiendo: declinar honestamente cuenta como éxito (CLAUDE.md §5) */
  ok(reglas("No tengo información autorizada suficiente para responder eso con el alcance pedido.").length === 0,
    "★ pero DECLINAR honestamente no arde: sin cifras no hay contraste, y vetar la línea honesta deja el turno vacío");
  ok(reglas("").length === 0, "y un texto vacío no genera multas fantasma");
}

/* ═══ 9 · EL LÉXICO DE LA CASA ══════════════════════════════════════════════════════════════════════════════
 * El composer volcaba etiquetas del motor a la prosa, y una traía «Target de carga»: benchmark ≠ meta, y las
 * metas las fija el cliente. Una etiqueta es un nombre de columna, no una frase. */
H("9 · el registro — la prosa no hereda las palabras internas del motor");
{
  const PROHIBIDAS = /\b(?:meta|target)s?\b|\bvara\b|\bpalanca\b|\bplata\b|\bdormido\b|\bapretar\b|\bdetenido\b/i;
  for (const [tag, t] of Object.entries(TURNOS)) {
    ok(!PROHIBIDAS.test(t.texto), `«${tag}» no usa vocabulario prohibido`, (t.texto.match(PROHIBIDAS) || [])[0]);
  }
  ok(/nivel de carga declarado|benchmark declarado/i.test(TURNOS["acciones"].texto + TURNOS["costo"].texto),
    "★ y la referencia se nombra por lo que ES: «declarado», nunca como una meta del cliente");
}

/* ═══ 10 · LAS CARNADAS · que el candado vea lo que dice ver ════════════════════════════════════════════════ */
H("10 · carnadas — si el chequeo no se pone rojo, no está mirando");
{
  const q = `¿será que ${MOV.sube.n} está comprando menos?`;
  const figs = figsDe(pasosDe(PB, q, {}), q);
  const reglas = (texto) => PB.listaNotarial(texto, { figs, pregunta: q }).map((v) => v.regla);
  ok(reglas(`Tienes razón, va a la baja.`).length > 0, "carnada «un veredicto sin cifra» → el notario se pone ROJO");
  ok(reglas(`Efectivamente. ${MOV.sube.n} viene cayendo hace meses.`).length > 0,
    "carnada «afirmar con seguridad sin leer» → el notario se pone ROJO");
  /* el composer sin dato: si la boleta no sostiene el contraste, se retira en vez de prometer */
  ok(PB.componer({ figs: [], pregunta: q, semilla: 1 }) === null,
    "★ carnada «boleta vacía» → el composer se RETIRA, no improvisa un veredicto");
  ok(PB.componer({ figs, pregunta: "¿cuánto vendimos este año?", semilla: 1 }) === null,
    "carnada «pregunta que no es hipótesis» → el composer se RETIRA aunque tenga la boleta llena");
}

console.log(`\n── _hipotesis_del_usuario_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
