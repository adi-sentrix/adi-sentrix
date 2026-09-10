/* === _plan_de_accion_gate.mjs · UNA COSA ESTA SEMANA, Y QUÉ NO TODAVÍA =====================================
 *
 * EL ENCARGO DEL OWNER (2026-09-09), última de su orden: «ADI debe convertir la lectura en una secuencia
 * concreta, pero SIN GESTIONAR POR EL USUARIO». Las cinco piezas, textuales:
 *   1 primera acción · 2 por qué esa primero · 3 qué mirar para confirmar · 4 segunda acción si la primera se
 *   valida · 5 qué NO haría todavía.
 * Y las tres de siempre: ofrece, no ordena · criterio marcado · cada cifra con su referencia.
 *
 * ⚠️ LA PIEZA QUE MÁS SE CAE ES LA QUINTA. Un plan que solo dice qué hacer parece completo aunque esté
 * apoyado en aire; decir qué NO se hace todavía —y por qué el dato no lo sostiene— es lo que separa una
 * secuencia de una lista de buenas intenciones. Por eso §4 la exige por su nombre.
 *
 * ⚠️ Y §6 GUARDA LA LÍNEA DE LA CASA: «no somos un sistema que gestiona cosas, es asesor». El plan va en
 * primera persona condicional. Un «llama a Falabella» convierte al asesor en un sistema de tareas.
 *
 * OFFLINE · determinístico · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _plan_de_accion_gate.mjs` */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { planDeAccion as PB } from "./src/adi/agente/playbooks/planDeAccion.js";
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
const ESC = ESCENARIO_INICIAL;

initTenant(TENANT_DEMO);

const CAJA = cajaDelAgente(TOOLS);
const figsDe = (pasos, pregunta) =>
  (runPlan({ intent: "answer", calls: pasos.map((s) => ({ tool: s.tool, args: s.args })) },
    { scenario: ESC, maxCalls: 8, preguntaUsuario: pregunta, registry: CAJA }).ledger || {}).figs || [];
const valDe = (f) => String((f && (f.text || f.value)) || "");
const entDe = (l) => { const p = String(l || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };

const Q_GENERAL = "qué hago esta semana";
const FIGS = figsDe(pasosDe(PB, Q_GENERAL, {}), Q_GENERAL);
/* la cuenta que concentra el frente mayor, leída del pack — nunca escrita a mano */
const CONCENTRA = (() => {
  const xs = FIGS.filter((f) => /· Saldo vencido$/i.test(f.label || ""))
    .map((f) => ({ n: entDe(f.label), v: Number(f.raw) || 0, fmt: valDe(f) }))
    .filter((x) => x.n).sort((a, b) => b.v - a.v);
  return xs[0] || null;
})();

/* ═══ 0 · EL PACK SOSTIENE UNA SECUENCIA ════════════════════════════════════════════════════════════════════ */
H("0 · el pack trae frentes medidos y quién los concentra — sin eso no hay secuencia que probar");
ok(FIGS.length > 0, `la lectura del plan trae ${FIGS.length} cifras`);
ok(!!CONCENTRA, `y hay una cuenta que concentra el frente mayor (${CONCENTRA ? `${CONCENTRA.n} ${CONCENTRA.fmt}` : "—"})`);
if (!CONCENTRA) { console.log("\n── sin eso no se puede medir la ruta ──"); process.exit(1); }

const CASOS = [["general", Q_GENERAL], ["arranque", "por dónde empiezo"], ["equipo", "qué le digo al equipo comercial"], ["cuenta", `¿qué hago con ${CONCENTRA.n}?`]];

/* ═══ 1 · EL DETECTOR Y EL CABLEADO ═════════════════════════════════════════════════════════════════════════ */
H("1 · el detector — pide pasos, y no le quita el turno a nadie");
{
  const DEBE = ["qué hago esta semana", "por dónde empiezo", "dame los tres pasos", "qué le digo al equipo comercial", "plan de acción", `¿qué hago con ${CONCENTRA.n}?`];
  const miss = DEBE.filter((q) => !PB.cuandoAplica(q));
  ok(miss.length === 0, `★ las ${DEBE.length} formas de pedir una secuencia se reconocen`, miss.join(" · "));
  const NO_DEBE = [
    "¿por qué febrero es el mes más bajo?", `muéstrame la ficha de ${CONCENTRA.n}`, "dame los 5 clientes de mejor margen",
    "¿cuánto vendimos este año?", "explícame el cuadro", "¿cuál es mi margen?",
    `¿será que ${CONCENTRA.n} está comprando menos?`, "creo que es por descuentos, ¿estoy en lo correcto?",
    "¿hago bien en priorizar volumen?", "¿por qué vendo más pero gano menos?", "¿qué es más urgente, margen o cobranza?",
    "¿vendo más o protejo margen?", "¿cómo va la cobranza?", "proyecta 12 meses con +4%",
  ];
  const fp = NO_DEBE.filter((q) => PB.cuandoAplica(q));
  ok(fp.length === 0, `★ cero falsos positivos sobre ${NO_DEBE.length} turnos ajenos`, fp.join(" · "));
  ok(formaConversacional("qué hago esta semana") === "accion", "y la forma la resuelve el detector único de la casa");

  ok(PB.pasos(Q_GENERAL).every((p) => typeof CAJA[p.tool] === "function"), "sus herramientas existen en la caja del agente");
  ok(PB.pasos(Q_GENERAL).every((p) => p.args && typeof p.para === "string" && p.para.length > 10), "…y cada paso declara args y PARA QUÉ");
  ok(obligatoriasDe(PB, Q_GENERAL, {}).length > 0 && promesasCumplidas(PB, FIGS, Q_GENERAL, {}),
    "promete el frente que ordena la secuencia, y el dato lo cumple");
  ok(obligatoriasDe(PB, "¿cuánto vendimos este año?", {}).length === 0, "y en una pregunta que no pide pasos no promete nada");
  /* ⚠️ LA PRECEDENCIA ES DELIBERADA Y LA PAGÓ UNA REGRESIÓN: puesto arriba, esta ruta se llevaba turnos de
   * ASESORÍA («qué hago con el inventario inmovilizado») y de otros procedimientos — la forma «acción» es la
   * más ancha de las siete. Va DESPUÉS de todos los playbooks de tema, como limite-honesto y sintesis-
   * ejecutiva: así solo toma las preguntas de pasos que no tienen dueño previo. */
  ok(PLAYBOOKS.indexOf(PB) > PLAYBOOKS.findIndex((p) => p.nombre === "inventario-inmovilizado"),
    "★ va DESPUÉS de los playbooks de tema: la forma «acción» es la más ancha, y arriba les quitaba el turno");
  ok(playbookPara("qué hago con el inventario inmovilizado", { history: [], viewContext: null, cuadro: null, mem: {} }).nombre !== PB.nombre,
    "…y se comprueba: la asesoría del inmovilizado sigue siendo suya");
  /* ⚠️ LA ELÍPTICA NO ES DE ESTA RUTA, y lo pagó una regresión de doce combinaciones: «¿y qué harías
   * primero?» tiene forma de acción, pero su tema vive en el HILO. Contestarla con la prioridad del negocio
   * después de que el usuario venía en cobranza o inventario es cambiarle el tema en silencio. */
  ok(!PB.cuandoAplica("¿y qué harías primero?"),
    "★ la elíptica «¿y qué harías primero?» NO es suya: su tema está en el hilo, y responderla de cero cambia el tema");
  ok(playbookPara("¿y qué harías primero?", { history: [], viewContext: null, cuadro: null, mem: {} }) !== PB,
    "…y sin hilo ese turno no lo toma nadie: declinar es lo correcto cuando el tema vive en una conversación que no hubo");
  /* ⚠️ Y UN SUPUESTO DECLARADO TAMPOCO ES SUYO: «ponele que X tiene 30% de margen, qué hacemos» pide qué
   * hacer bajo un supuesto que el dato no contiene, y un plan sobre las cifras reales contesta otra pregunta.
   * El repo ya tenía escrito ese caso como el que una regla demasiado ancha rompe. */
  ok(!PB.cuandoAplica("ponele que riachuelo tiene 30% de margen, que hacemos?"),
    "★ un supuesto declarado NO es suyo: la refutación del supuesto es de otro camino");
  /* ⚠️ TERCERA REGRESIÓN, la más instructiva: una cuenta que NO está en el pack caía en la rama general y
   * recibía el plan del negocio entero. Peor que declinar: el dueño preguntó por algo puntual y se lleva una
   * respuesta que PARECE contestarle. */
  ok(!PB.cuandoAplica("que hago con Ferretería Aurora?"),
    "★ un objeto que el dato no conoce NO es suyo: se declara que ese nombre no está, no se rodea con el plan general");
  ok(playbookPara(Q_GENERAL, { history: [], viewContext: null, cuadro: null, mem: {} }) === PB, "…mientras que el plan general sí es de esta ruta");
}

/* ═══ 2 · POR EL BUCLE ══════════════════════════════════════════════════════════════════════════════════════ */
H("2 · por el camino real del agente — con el cerebro mudo, el piso solo");
const T = {};
{
  for (const [tag, q] of CASOS) {
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESC, callAgente: MUDO });
    T[tag] = { q, texto: String((r.r && r.r.text) || ""), agente: (r.r && r.r.agente) || {} };
    ok(T[tag].agente.estado === "playbook", `«${tag}» lo resuelve el procedimiento (estado ${T[tag].agente.estado})`);
    ok((T[tag].agente.vetos || []).length === 0, "…sin vetos del muro", (T[tag].agente.vetos || [])[0]);
  }
}

/* ═══ 3 · ★ LAS CINCO PIEZAS DEL OWNER, UNA POR UNA ═════════════════════════════════════════════════════════ */
H("3 · ★ las cinco piezas que el owner pidió, en cada plan");
{
  const PIEZAS = [
    ["1 · la primera acción, UNA sola", /esta semana har[ií]a una cosa/i],
    ["2 · por qué esa primero", /por qu[eé] esa primero/i],
    ["3 · qué mirar para confirmar", /qu[eé] mirar[ií]a para confirmar/i],
    ["4 · la segunda acción, condicionada", /si se confirma[^\n]*si (?:resulta|no)/i],
    ["5 · qué NO haría todavía", /lo que NO har[ií]a todav[ií]a/i],
  ];
  for (const [tag] of CASOS) {
    for (const [nombre, re] of PIEZAS) {
      ok(re.test(T[tag].texto), `«${tag}» trae la pieza ${nombre}`, T[tag].texto.slice(0, 200));
    }
  }
  ok(/porque el dato|no est[aá] en el dato|no lo tengo|no trae|se apoyar[ií]a|es gastarla en lo chico/i.test(T["general"].texto),
    "★ y el «todavía no» viene con SU razón, no como una preferencia");
}

/* ═══ 4 · ★ OFRECE, NO ORDENA · ADI ASESORA, NO GESTIONA ════════════════════════════════════════════════════ */
H("4 · ★ la secuencia va en primera persona condicional — no es una lista de tareas");
{
  for (const [tag] of CASOS) {
    const reglas = PB.listaNotarial(T[tag].texto, { figs: FIGS, pregunta: T[tag].q }).map((v) => v.regla);
    ok(!reglas.includes("plan-que-ordena"), `«${tag}» no ordena`, T[tag].texto.slice(0, 160));
    ok(!reglas.includes("plan-incompleto"), `…y su notario lo da por completo`);
    ok(!reglas.includes("plan-sin-criterio-marcado"), `…y marca qué parte es criterio suyo`);
  }
  ok(/criterio m[ií]o|prefiero/i.test(T["general"].texto), "★ el criterio se DECLARA criterio: el dueño sabe qué dice el dato y qué se lo dice ADI");
  ok(/¿Te preparo|Si quieres armo|D[ií]me si te dejo/i.test(T["general"].texto), "★ y cierra OFRECIENDO, no mandando");
}

/* ═══ 5 · CADA CIFRA CON SU REFERENCIA, Y NINGUNA NO RECONCILIADA ═══════════════════════════════════════════ */
H("5 · el precio de cada paso, con contra qué se mide — y sin cifras que el dato declare no cerradas");
{
  for (const [tag] of CASOS) {
    const v = (T[tag].agente.vetos || []).filter((x) => /cifra-sin-referencia/.test(String(x)));
    ok(v.length === 0, `«${tag}» no cae en la ley de la referencia`, v[0]);
    const derivadas = FIGS.filter((f) => (f.tipo && f.tipo.verificabilidad) === "derivada_no_reconciliada"
      && valDe(f) && /\d/.test(valDe(f)) && T[tag].texto.includes(valDe(f)));
    ok(derivadas.length === 0, `★ «${tag}» no apoya el plan en una cifra que el dato declara no reconciliada`,
      derivadas.map((f) => `${f.label}=${valDe(f)}`).join(" · "));
  }
  const tentacion = FIGS.filter((f) => (f.tipo && f.tipo.verificabilidad) === "derivada_no_reconciliada");
  ok(tentacion.length > 0, `…y el chequeo tiene qué cazar: la lectura publica ${tentacion.length} cifras así (p. ej. «${tentacion[0].label}»)`);
  ok(/concentra[^\n]*de \$/i.test(T["general"].texto), "★ la cifra del primer paso va contra el total de su frente, no suelta");
}

/* ═══ 6 · LOS UNIVERSOS, DECLARADOS ═════════════════════════════════════════════════════════════════════════ */
H("6 · si el «todavía no» es de otro universo de dinero, se dice");
{
  const t = T["general"].texto;
  ok(!/inventario/i.test(t) || /otro dinero|no cierran entre s[ií]|no se suman/i.test(t),
    "★ al dejar el inventario para después, declara que es otro dinero y no se suma con el primero", t.slice(0, 240));
}

/* ═══ 7 · NINGÚN NÚMERO ESCRITO A MANO ══════════════════════════════════════════════════════════════════════ */
H("7 · cada número del texto sale de la boleta");
{
  const enBoleta = new Set(FIGS.map(valDe).filter(Boolean));
  for (const [tag] of CASOS) {
    const sueltos = (T[tag].texto.match(/[+-]?\$?\d[\d.,]*\s*(?:pp|%|[KMBd])?/g) || [])
      .map((s) => s.trim()).filter((s) => /\d/.test(s))
      .filter((s) => ![...enBoleta].some((v) => v === s || (v.includes(s) && /^[+-]?\$?\d[\d.,]*\s*(?:pp|%|[KMBd])?$/.test(v))));
    ok(sueltos.length === 0, `«${tag}» no escribe ningún número propio`, sueltos.join(" · "));
  }
}

/* ═══ 8 · LAS CARNADAS ══════════════════════════════════════════════════════════════════════════════════════ */
H("8 · carnadas — si el chequeo no se pone rojo, no está mirando");
{
  const reglas = (t) => PB.listaNotarial(t, { figs: FIGS, pregunta: Q_GENERAL }).map((v) => v.regla);
  const cifra = CONCENTRA.fmt;
  ok(reglas(`Esta semana haría una cosa: entrar por ${CONCENTRA.n} (${cifra}). Por qué esa primero: ahí se concentra. Qué miraría para confirmar: el motivo. Si se confirma, seguiría; si no, pasaría a otra. Es criterio mío.`).includes("plan-incompleto"),
    "★ carnada «sin el todavía-no» → ROJO: es la pieza que hace honesto al plan");
  ok(reglas(`Esta semana haría una cosa: llama a ${CONCENTRA.n} (${cifra}). Por qué esa primero: ahí se concentra. Qué miraría para confirmar: el motivo. Si se confirma, seguiría; si no, pasaría. Lo que NO haría todavía: nada. Es criterio mío.`).includes("plan-que-ordena"),
    "★ carnada «un imperativo» → ROJO: ADI asesora, no gestiona");
  ok(reglas(`Esta semana haría una cosa: entrar por ${CONCENTRA.n} (${cifra}). Por qué esa primero: ahí se concentra. Qué miraría para confirmar: el motivo. Si se confirma, seguiría; si no, pasaría. Lo que NO haría todavía: el inventario.`).includes("plan-sin-criterio-marcado"),
    "★ carnada «el juicio disfrazado de lectura» → ROJO: lo que es criterio se marca");
  /* ⚠️ y la prosa correcta NO arde — la lección del falso positivo de «la lista corta» */
  ok(!reglas(T["general"].texto).length, "★ y el plan real pasa limpio: una regla que muerde prosa buena se termina apagando");
  ok(reglas("No tengo información autorizada suficiente para responder eso.").length === 0, "declinar honestamente no arde");
  ok(PB.componer({ figs: [], pregunta: Q_GENERAL, semilla: 1 }) === null, "★ carnada «boleta vacía» → el composer se RETIRA, no improvisa el orden");
  ok(PB.componer({ figs: FIGS, pregunta: "¿cuánto vendimos este año?", semilla: 1 }) === null,
    "carnada «pregunta que no pide pasos» → se RETIRA con la boleta llena");
}

console.log(`\n── _plan_de_accion_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
