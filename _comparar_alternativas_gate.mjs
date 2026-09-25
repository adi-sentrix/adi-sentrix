/* === _comparar_alternativas_gate.mjs · LOS DOS CAMINOS, CON PRECIO =========================================
 *
 * EL ENCARGO DEL OWNER (2026-09-09), cuarto de su orden, con sus cuatro frases y su regla:
 *   «ADI debe comparar los dos caminos, ponerles precio, elegir o marcar tradeoff. No responder solo una
 *    alternativa ni esconder la otra.»
 *
 * LA FALLA A IMPEDIR es contestar la mitad de una disyuntiva: abrir A —la primera que se reconoce— cuando el
 * dueño no pidió ver A, pidió saber CUÁL. Esconder la otra es peor que no contestar, porque parece una
 * recomendación. Por eso §5 exige las dos mitades nombradas Y con precio, y §6 exige el cierre: elegir o
 * declarar el tradeoff. Un resumen que pone los dos montos y se calla le devuelve la pregunta.
 *
 * ⚠️ §7 GUARDA UN DEFECTO REAL DE ESTA RUTA, y es de los caros: sin el nivel de carga declarado en la boleta,
 * el composer afirmaba «no cede de más» de una cuenta que cede 4.5% contra un nivel de 3.5%. No era un hueco,
 * era una afirmación FALSA — y nació de leer una carga sin su referencia, que es justo lo que el owner
 * prohibió el mismo día. El arreglo fue traer la referencia con un paso propio.
 *
 * ⛔ RONDA 7 (coordinador, 2026-09-24) — CONSOLIDACIÓN: «la misma clase de pregunta no puede tener dos voces
 * según la redacción». Este archivo YA NO reconoce disyuntivas entre TEMAS/FRENTES del negocio (margen · carga
 * · cobranza · capital · tesorería) — «¿qué es más urgente, margen o cobranza?», «¿ataco el margen o el
 * capital frenado?», «¿priorizo caja o cobranza?» las responde `coberturaCorta.js`, siempre, en cualquier
 * redacción (incluida la corta). Lo único que queda ACÁ: (a) dos CUENTAS nombradas y (b) las ESTRATEGIAS fijas
 * (crecer vs proteger margen). §10 prueba la consolidación completa por el bucle real.
 *
 * ⚠️ NADA DE NOMBRES ESCRITOS A MANO: las cuentas salen del pack y se eligen POR SU CONDUCTA (una que cae y
 * otra que cede sobre el nivel declarado), así el candado vale también para la planilla de un usuario.
 *
 * OFFLINE · determinístico · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _comparar_alternativas_gate.mjs` */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { compararAlternativas as PB } from "./src/adi/agente/playbooks/compararAlternativas.js";
import { PLAYBOOKS, playbookPara, pasosDe, obligatoriasDe, promesasCumplidas } from "./src/adi/agente/playbooks/registro.js";
import { formaConversacional } from "./src/adi/agente/formaConversacional.js";
import { reDeReferencia } from "./src/adi/oracle/entityRecord.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { pasosDeDominios } from "./src/adi/agente/contratoDeDominios.js";
import { decisionEntreTemas } from "./src/adi/agente/coberturaCorta.js";

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
/* la boleta AMPLIA de un par de dominios (owner 2026-09-24, ronda 6/7): `decisionEntreTemas` necesita señales
 * (p. ej. la brecha al benchmark en pp) que los pasos PROPIOS de este playbook no siempre traen — el mismo
 * toolset que usa `coberturaCorta.js`, por dominio real (no por la palabra del frente). */
const figsAmpliasDe = (dominios) => {
  const out = [];
  for (const d of [...new Set(dominios)]) { try { out.push(...figsDe(pasosDeDominios({ dominios: [d], eje: null }), "x")); } catch { /* sin este dominio, sigue con los demás */ } }
  return out;
};
/* «269 días» (la forma deletreada, owner 2026-09-24 forma E) y «269d» (la forma corta de la boleta) son el
 * MISMO número — el espacio interno no cuenta para esta ley. */
const _sinEspacios = (s) => String(s || "").replace(/\s+/g, "");
const valDe = (f) => String((f && (f.text || f.value)) || "");
const entDe = (l) => { const p = String(l || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };
const numDe = (f) => { if (!f) return NaN; if (Number.isFinite(f.raw)) return f.raw;
  const m = /(\d+(?:\.\d+)?)\s*([KkMmBb])?(?![A-Za-zÁÉÍÓÚÜáéíóúüÑñ])/.exec(valDe(f));
  return m ? (/^[^\d]*-/.test(valDe(f)) ? -1 : 1) * Number(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] || "").toLowerCase()] || 1) : NaN; };

/* ── LAS DOS CUENTAS QUE ESTA RUTA NECESITA ────────────────────────────────────────────────────────────────
 * `cae` = viene a la baja contra el comparable · `cede` = su carga supera el nivel declarado. Son los dos
 * PRECIOS distintos que la ruta tiene que saber poner, y por eso el par prueba lo que dice probar. */
const CUENTAS = (() => {
  const roles = figsDe([{ tool: "rolesCartera", args: {} }], "x");
  const nivel = roles.find((f) => reDeReferencia("pctRebate").test(f.label || "")) || null;
  const yoy = figsDe([{ tool: "salesRead", args: { focus: "vs_anterior", dimension: "cliente" } }], "x")
    .filter((f) => /· YoY$/i.test(f.label || ""))
    .map((f) => ({ n: entDe(f.label), v: numDe(f), fmt: valDe(f) })).filter((x) => x.n && Number.isFinite(x.v));
  const cae = yoy.filter((x) => x.v < 0).sort((a, b) => a.v - b.v)[0] || null;
  const cede = roles.filter((f) => /· Carga comercial$/i.test(f.label || ""))
    .map((f) => ({ n: entDe(f.label), v: numDe(f), fmt: valDe(f) }))
    .filter((x) => x.n && Number.isFinite(x.v) && nivel && x.v > numDe(nivel))
    .sort((a, b) => b.v - a.v)[0] || null;
  return { cae, cede, nivel: nivel ? valDe(nivel) : null };
})();

/* ═══ 0 · EL PACK TRAE LOS DOS PRECIOS ══════════════════════════════════════════════════════════════════════ */
H("0 · el pack tiene una cuenta que cae y otra que cede sobre el nivel declarado — los dos precios de la ruta");
ok(!!CUENTAS.cae, `hay una cuenta a la baja (${CUENTAS.cae ? `${CUENTAS.cae.n} ${CUENTAS.cae.fmt}` : "—"})`);
ok(!!CUENTAS.cede && !!CUENTAS.nivel, `hay una que cede sobre el nivel declarado (${CUENTAS.cede ? `${CUENTAS.cede.n} ${CUENTAS.cede.fmt} vs ${CUENTAS.nivel}` : "—"})`);
if (!CUENTAS.cae || !CUENTAS.cede || !CUENTAS.nivel) { console.log("\n── sin los dos precios no se puede medir la ruta ──"); process.exit(1); }

const Q_CUENTAS = `¿renegocio ${CUENTAS.cede.n} o recupero ${CUENTAS.cae.n}?`;
const Q_ESTRATEGIAS = "¿vendo más o protejo margen?";
/* SOLO lo que de verdad es de este archivo (ronda 7): cuentas y estrategias. Los frentes del negocio
 * («dominios»/«universos»/«tesorería» de las rondas anteriores) se prueban en §10, por el bucle real, contra
 * `coberturaCorta.js` — que es quien ahora los responde. */
const CASOS = [
  ["cuentas", Q_CUENTAS],
  ["estrategias", Q_ESTRATEGIAS],
];
const Q_TESORERIA = "¿priorizo caja o cobranza?";

/* ═══ 1 · EL DETECTOR ═══════════════════════════════════════════════════════════════════════════════════════ */
H("1 · el detector — cuentas y estrategias, ni un turno ajeno, ni un frente/tema retirado");
{
  const DEBE = [
    `¿miro ${CUENTAS.cae.n} o ${CUENTAS.cede.n}?`,
    Q_ESTRATEGIAS,
    Q_CUENTAS,
  ];
  const miss = DEBE.filter((q) => !PB.cuandoAplica(q));
  ok(miss.length === 0, "★ cuentas y estrategias, TEXTUALES, se reconocen", miss.join(" · "));
  ok(formaConversacional(Q_CUENTAS) === "comparar",
    "★ «¿renegocio A o recupero B?» es una comparación — dos caminos distintos sobre dos cuentas distintas, y no la veía ninguna forma");

  const NO_DEBE = [
    "¿por qué febrero es el mes más bajo?", `muéstrame la ficha de ${CUENTAS.cede.n}`, "dame los 5 clientes de mejor margen",
    "¿cuánto vendimos este año?", "explícame el cuadro", "¿qué harías primero?", "¿cuál es mi margen?",
    `¿será que ${CUENTAS.cede.n} está comprando menos?`, "creo que es por descuentos, ¿estoy en lo correcto?",
    "¿hago bien en priorizar volumen?", "¿me conviene bajar precios?", "¿por qué vendo más pero gano menos?",
    "¿por qué tengo deuda alta pero poco vencido?", "qué hago esta semana", "dame los tres pasos",
    "Dime cuáles son los clientes que venden mucho pero están bajo el benchmark", "¿cómo va la cobranza?", "proyecta 12 meses con +4%",
    /* ⛔ RONDA 7: retirados — los frentes/temas del registro ya no los reconoce este archivo, en NINGUNA forma */
    "¿qué es más urgente, margen o cobranza?", "¿ataco el margen o el capital frenado?",
    "¿ataco la carga comercial o el capital frenado?", Q_TESORERIA,
    "¿dónde tengo el mayor problema entre margen, stock y caja?",
  ];
  const fp = NO_DEBE.filter((q) => PB.cuandoAplica(q));
  ok(fp.length === 0, `★ cero falsos positivos sobre ${NO_DEBE.length} turnos ajenos (incluidos los frentes/temas retirados)`, fp.join(" · "));
}

/* ═══ 2 · LAS PROMESAS Y EL CABLEADO ════════════════════════════════════════════════════════════════════════ */
H("2 · promete el PRECIO — sin poder ponerle cifra a los dos caminos se retira, en vez de opinar cuál conviene");
{
  for (const [tag, q] of CASOS) {
    const oblig = obligatoriasDe(PB, q, {});
    const figs = figsDe(pasosDe(PB, q, {}), q);
    ok(oblig.length > 0, `«${tag}» declara promesa (${oblig.map(String).join(" ")})`);
    ok(promesasCumplidas(PB, figs, q, {}), `…y el dato la cumple, así que el procedimiento se activa (${figs.length} cifras)`);
  }
  const todas = CASOS.flatMap(([, q]) => pasosDe(PB, q, {}));
  ok(todas.every((p) => typeof CAJA[p.tool] === "function"), `las ${todas.length} herramientas de sus pasos existen en la caja del agente`);
  ok(todas.every((p) => p.args && typeof p.para === "string" && p.para.length > 10), "…y cada paso declara args y PARA QUÉ");
  ok(PLAYBOOKS.indexOf(PB) === 3, "★ va cuarto: detrás de hipótesis, decisión y contradicción");
  for (const [tag, q] of [["hipótesis", `¿será que ${CUENTAS.cede.n} está comprando menos?`], ["decisión", "¿hago bien en priorizar volumen?"], ["contradicción", "¿por qué vendo más pero gano menos?"]]) {
    ok(playbookPara(q, { history: [], viewContext: null, cuadro: null, mem: {} }) !== PB, `…y NO le quita el turno a la ruta de ${tag}`);
  }
}

/* ═══ 3 · POR EL BUCLE ══════════════════════════════════════════════════════════════════════════════════════ */
H("3 · por el camino real del agente — con el cerebro mudo, el piso solo");
const T = {};
{
  for (const [tag, q] of CASOS) {
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESC, callAgente: MUDO });
    T[tag] = { q, texto: String((r.r && r.r.text) || ""), agente: (r.r && r.r.agente) || {} };
    ok(T[tag].agente.estado === "playbook", `«${tag}» lo resuelve el procedimiento (estado ${T[tag].agente.estado})`);
    ok((T[tag].agente.vetos || []).length === 0, "…sin vetos del muro", (T[tag].agente.vetos || [])[0]);
  }
}

/* ═══ 4 · ★ LOS DOS CAMINOS, NOMBRADOS Y CON PRECIO ═════════════════════════════════════════════════════════ */
H("4 · ★ la regla del owner: los dos caminos, con precio — ninguno escondido");
{
  for (const [tag, q] of CASOS) {
    const figs = figsDe(pasosDe(PB, q, {}), q);
    const reglas = PB.listaNotarial(T[tag].texto, { figs, pregunta: q }).map((v) => v.regla);
    ok(!reglas.includes("alternativa-escondida"), `★ «${tag}» nombra LOS DOS caminos — no responde por uno`, T[tag].texto.slice(0, 200));
    ok(!reglas.includes("comparacion-sin-precio"), `…y cada uno lleva su cifra`);
    ok(!reglas.includes("comparacion-sin-cierre"), `…y cierra: elige o marca el tradeoff, no devuelve la pregunta`);
  }
  ok(T["cuentas"].texto.includes(CUENTAS.cae.n) && T["cuentas"].texto.includes(CUENTAS.cede.n),
    "★ la disyuntiva entre cuentas nombra a las DOS");
  ok(/Yo entrar[ií]a por/i.test(T["cuentas"].texto), "★ y ELIGE, con su razón — el owner pidió elegir o marcar el tradeoff");
}

/* ═══ 5 · ★ CADA PRECIO CON SU REFERENCIA (la ley del owner del mismo día) ══════════════════════════════════ */
H("5 · ★ ningún precio va suelto: la cifra que sostiene la elección trae contra qué se mide");
{
  ok(T["cuentas"].texto.includes(CUENTAS.nivel),
    `★ la carga de la cuenta que cede viaja con el nivel declarado (${CUENTAS.nivel})`, T["cuentas"].texto.slice(0, 240));
  ok(/contra el per[ií]odo comparable/i.test(T["cuentas"].texto),
    "…y la que cae viaja con el período contra el que se mide");
  ok(/nivel de .*que tienes declarado|nivel declarado/i.test(T["estrategias"].texto),
    "★ y el camino de proteger margen dice contra qué nivel se está cediendo", T["estrategias"].texto.slice(0, 240));
  for (const [tag] of CASOS) {
    const v = (T[tag].agente.vetos || []).filter((x) => /cifra-sin-referencia/.test(String(x)));
    ok(v.length === 0, `«${tag}» no cae en la ley de la referencia`, v[0]);
  }
}

/* ═══ 6 · ★ EL DEFECTO REAL: UNA CARGA SIN SU REFERENCIA NO AUTORIZA NINGUNA CONCLUSIÓN ═════════════════════ */
H("6 · ★ sin el nivel declarado no se afirma «cede» ni «no cede» — se declara que falta");
{
  const figs = figsDe(pasosDe(PB, Q_CUENTAS, {}), Q_CUENTAS);
  const sinNivel = figs.filter((f) => !reDeReferencia("pctRebate").test(f.label || ""));
  const t = PB.componer({ figs: sinNivel, pregunta: Q_CUENTAS, semilla: 1 }) || "";
  ok(!/no cede de m[aá]s|dentro del nivel/i.test(t),
    "★ quitando el nivel de la boleta, NO afirma que la cuenta esté dentro del nivel — que fue el defecto real", t.slice(0, 240));
  ok(/no trae el nivel contra el que se mide|no te puedo decir si eso es mucho o poco/i.test(t),
    "…y en vez de eso DECLARA que le falta la referencia", t.slice(0, 240));
  /* y con el nivel puesto, sí afirma — el chequeo mira las dos caras */
  ok(/contra un nivel declarado de/i.test(T["cuentas"].texto), "…y con el nivel en la boleta, sí lo dice con su cifra");
}

/* ═══ 7 · LOS UNIVERSOS SE DECLARAN — ahora por `coberturaCorta.js` ═══════════════════════════════════════════
 * CLAUDE.md §2: dos montos de universos distintos NUNCA van juntos sin decir de cuál sale cada uno. RONDA 7:
 * este archivo ya no compone la frase de «dos mundos» — la ley la sostiene `coberturaCorta.js`: cada línea
 * lleva su PROPIO dominio pegado al monto (nunca una suma), y el cierre declara «no comparten clave» cuando
 * las claves no calzan, sin ordenar por tamaño. */
H("7 · comparar margen con capital de inventario es legítimo; esconder que son dos mundos, no (vía coberturaCorta.js)");
{
  const rUniv = await answerViaAgente({ text: "¿ataco el margen o el capital frenado?", history: [], mem: {}, scenario: ESC, callAgente: MUDO });
  const tUniv = String((rUniv.r && rUniv.r.text) || "");
  ok(/Margen:|Comercial:/i.test(tUniv) && /Inventario:/i.test(tUniv),
    "★ cada monto sale pegado a SU dominio — nunca junto sin decir de cuál sale", tUniv.slice(0, 300));
  ok(/no comparten clave/i.test(tUniv), "…y declara que el procedimiento no los ordena entre sí (no comparte clave)", tUniv.slice(0, 300));
  ok(!/\bsuma\b|\btotal combinado\b/i.test(tUniv), "…y nunca los suma en un solo monto");

  const rDom = await answerViaAgente({ text: "¿qué es más urgente, margen o cobranza?", history: [], mem: {}, scenario: ESC, callAgente: MUDO });
  const tDom = String((rDom.r && rDom.r.text) || "");
  ok(!/no comparten clave/i.test(tDom),
    "…y NO lo dice cuando los dos frentes comparten clave — el procedimiento SÍ los ordena (margen↔cobranza, cliente↔cliente)", tDom.slice(0, 300));
}

/* ═══ 8 · NINGÚN NÚMERO ESCRITO A MANO ══════════════════════════════════════════════════════════════════════ */
H("8 · cada número del texto sale de la boleta");
{
  for (const [tag, q] of CASOS) {
    const enBoleta = new Set(figsDe(pasosDe(PB, q, {}), q).map(valDe).filter(Boolean));
    const sueltos = (T[tag].texto.match(/[+-]?\$?\d[\d.,]*\s*(?:pp|%|[KMBd])?/g) || [])
      .map((s) => s.trim()).filter((s) => /\d/.test(s))
      /* «269 días» (deletreado) y «269d» (la boleta) son el MISMO número: el espacio interno no cuenta. */
      .filter((s) => ![...enBoleta].some((v) => _sinEspacios(v) === _sinEspacios(s) || (v.includes(s) && /^[+-]?\$?\d[\d.,]*\s*(?:pp|%|[KMBd])?$/.test(v))));
    ok(sueltos.length === 0, `«${tag}» no escribe ningún número propio`, sueltos.join(" · "));
  }
}

/* ═══ 9 · EL NOTARIO Y SUS CARNADAS (sobre «estrategias», el único frente genérico que queda acá) ═════════════ */
H("9 · su lista notarial — y las carnadas que prueban que mira");
{
  const q = Q_ESTRATEGIAS;
  const figs = figsDe(pasosDe(PB, q, {}), q);
  const cargaAltaFig = figs.find((f) => /^Carga comercial alta · subtotal(?: · \d+ cuentas[^·]*)?$/i.test(f.label));
  const cargaAlta = valDe(cargaAltaFig);
  /* las ilustrativas usan una boleta REDUCIDA a solo esta fig (owner: el detector de «citadas» empareja por
   * substring de TEXTO, y esta boleta de 100+ cifras trae conteos de una cifra —«6 cuentas», «5 de ellas»—
   * que son substring de «$655K»: con la boleta completa se «citan» de arrastre. Acotarla a la fig que la
   * ilustrativa de verdad cita es lo mismo que hace cualquier turno real con menos ruido en pantalla). */
  const figsChicas = [cargaAltaFig];
  /* «los dos montos» necesita DOS figs citables — con solo `cargaAltaFig` no hay forma de citar dos. Se agrega
   * el `headline` (la venta vs. año anterior) como segundo monto: acotar la boleta a estas DOS evita el ruido
   * de los conteos de una cifra («6 cuentas», «5 de ellas») que, en la boleta completa, son substring de
   * «$655K» y «citan» de arrastre — la misma trampa de siempre de esta casa con substrings numéricos. */
  const headlineFig = figs.find((f) => /^headline$/i.test(f.label));
  const headline = valDe(headlineFig);
  const figsDosMontos = [cargaAltaFig, headlineFig].filter(Boolean);
  const reglas = (t, fx = figs) => PB.listaNotarial(t, { figs: fx, pregunta: q }).map((v) => v.regla);

  ok(reglas(`Vender: la venta viene creciendo, ${cargaAlta} en juego.`, figsChicas).includes("alternativa-escondida"),
    "★ responder por UN camino y esconder el otro ARDE — es la falla que el owner nombró");
  ok(reglas(`Vender más y margen ${cargaAlta}: mucho.`, figsChicas).includes("comparacion-sin-precio"),
    "★ comparar con una sola cifra ARDE — con un número se sostiene cualquiera de las dos conclusiones");
  ok(reglas(`Vender más: la venta crece ${headline}. Margen ${cargaAlta} cediéndose.`, figsDosMontos).includes("comparacion-sin-cierre"),
    "★ poner los dos montos y callarse ARDE — el owner pidió elegir o marcar el tradeoff");
  ok(reglas(`Vender más: la venta crece ${headline}. Margen ${cargaAlta} cediéndose. Primero la condición, después el volumen.`, figsDosMontos).length === 0,
    "…y los dos con precio y con cierre pasan limpio");
  ok(reglas("No tengo información autorizada suficiente para responder eso.").length === 0, "★ declinar honestamente NO arde");
  ok(reglas("").length === 0, "y un texto vacío no genera multas fantasma");
  ok(PB.componer({ figs: [], pregunta: q, semilla: 1 }) === null, "★ carnada «boleta vacía» → el composer se RETIRA, no opina cuál conviene");
  ok(PB.componer({ figs, pregunta: "¿cuánto vendimos este año?", semilla: 1 }) === null,
    "carnada «pregunta que no es disyuntiva» → se RETIRA con la boleta llena");
}

/* ═══ 10 · RONDA 7 (coordinador): LA CONSOLIDACIÓN ══════════════════════════════════════════════════════════
 *   (a) cualquier disyuntiva de TEMAS/FRENTES del registro —en cualquier redacción, también las cortas— la
 *       reconoce `coberturaCorta.js` y SOLO ella: `compararAlternativas.js` ya no la ve (probado en §1).
 *   (b) un tema pedido (tesorería incluida) nunca falta en silencio en la respuesta final.
 *   (c) ningún cierre hace dos preguntas seguidas.
 * Los cuatro literales del informe: Q_CUENTAS (cuentas, sigue acá), Q_URGENTE, Q_ATACO, Q_CAJA. */
H("10 · ronda 7: LOS FRENTES/TEMAS DEL NEGOCIO SON DE `coberturaCorta.js`, UNA SOLA VOZ, SIN LOS TRES DEFECTOS");
{
  const Q_URGENTE = "¿qué es más urgente, margen o cobranza?";
  const Q_ATACO = "¿ataco el margen o el capital frenado?";
  const Q_CARGA = "¿ataco la carga comercial o el capital frenado?";
  const Q_TRIPLE = "¿dónde tengo el mayor problema entre margen, stock y caja?";
  const FRENTES = [Q_URGENTE, Q_ATACO, Q_CARGA, Q_TESORERIA, Q_TRIPLE];

  /* (a) cualquier redacción, corta o larga, termina en cobertura-corta — nunca en compararAlternativas */
  const R = {};
  for (const q of FRENTES) {
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESC, callAgente: MUDO });
    R[q] = { texto: String((r.r && r.r.text) || ""), agente: (r.r && r.r.agente) || {} };
    ok(R[q].agente.estado === "cobertura-corta", `★ (a) «${q}» termina en cobertura-corta, en cualquier redacción`, `estado=${R[q].agente.estado}: ${R[q].texto.slice(0, 160)}`);
    ok((R[q].agente.vetos || []).length === 0, "…sin vetos del muro", JSON.stringify(R[q].agente.vetos || []).slice(0, 240));
  }

  /* naming: «carga comercial» nombrada como carga (no como margen/contribución) porque el usuario dijo «carga» */
  ok(/carga comercial/i.test(R[Q_CARGA].texto) && !/contribuci[oó]n no capturada/i.test(R[Q_CARGA].texto),
    "…nombrada como carga (no como margen/contribución) porque el usuario dijo «carga»", R[Q_CARGA].texto);

  /* (b) tesorería (o cualquier tema pedido) nunca falta en silencio */
  ok(/Tesor[eé]r[ií]a: este archivo no trae datos de tesorer[ií]a\. Puedo mostrarte en su lugar la exposici[oó]n de cr[eé]dito por cliente si te sirve\./.test(R[Q_TESORERIA].texto),
    "(b) tesorería se declara ausente con su oferta — la MISMA línea, fuente única", R[Q_TESORERIA].texto);
  ok(/la cobranza:|cobranza:/i.test(R[Q_TESORERIA].texto.toLowerCase()), "…y el frente real (cobranza) sí lleva su precio", R[Q_TESORERIA].texto);
  ok(!/\$[\d.,]+[KMB]?\s*(?:de\s+)?(?:caja|tesorer[ií]a|liquidez)/i.test(R[Q_TESORERIA].texto), "…nunca un precio puesto sobre caja/tesorería/liquidez", R[Q_TESORERIA].texto);

  /* el literal del owner: «margen, stock y caja» (630 caracteres) — la caja NO puede desaparecer en silencio */
  const tTriple = R[Q_TRIPLE].texto;
  ok(/margen|comercial/i.test(tTriple), "(b) «margen, stock y caja» — margen/comercial presente", tTriple.slice(0, 200));
  ok(/inventario|stock|capital/i.test(tTriple), "…inventario/stock presente", tTriple.slice(0, 200));
  ok(/Tesorer[ií]a/i.test(tTriple), "…y TESORERÍA presente — el defecto medido por el owner, cerrado", tTriple);

  /* el defecto de la TRIPLE REPETICIÓN: «(estimada contra el benchmark)… frente al benchmark… una estimación,
   * no dinero ya perdido» decía la misma idea tres veces. Ahora la marca de estimación aparece UNA sola vez. */
  const marcas = (tTriple.match(/estimad[ao] contra el benchmark|frente al benchmark|una estimaci[oó]n, no dinero ya perdido/gi) || []).length;
  ok(marcas <= 1, "…y la marca de estimación NO se repite (el defecto de la triple repetición, cerrado)", `x${marcas} · ${tTriple}`);

  /* (c) el defecto de las DOS PREGUNTAS SEGUIDAS: «¿Cuál abrimos primero?» + «Dime cuál abrimos…» */
  const preguntas = (tTriple.match(/\?/g) || []).length;
  ok(preguntas <= 1, "(c) ningún cierre hace dos preguntas seguidas", `${preguntas} signos «?» · ${tTriple}`);
  for (const q of FRENTES) {
    const n = (R[q].texto.match(/\?/g) || []).length;
    ok(n <= 1, `(c) …tampoco en «${q}»`, `${n} signos «?» · ${R[q].texto}`);
  }

  /* `decisionEntreTemas` es LA MISMA función, determinística, para cualquier consumidor — se prueba llamándola
   * directo, dos veces, con la misma boleta y pregunta. */
  {
    const figsDom = figsAmpliasDe(["comercial", "cobranza"]);
    const d1 = decisionEntreTemas({ dominios: ["comercial", "cobranza"], figs: figsDom, pregunta: Q_URGENTE });
    const d2 = decisionEntreTemas({ dominios: ["comercial", "cobranza"], figs: figsDom, pregunta: Q_URGENTE });
    ok(d1 && d2 && d1.tipo === "veredicto" && d1.temaGanador === d2.temaGanador && d1.x.entidad === d2.x.entidad,
      "`decisionEntreTemas` es determinística — la MISMA respuesta para la misma boleta y pregunta", JSON.stringify({ d1: d1 && { temaGanador: d1.temaGanador, entidad: d1.x && d1.x.entidad }, d2: d2 && { temaGanador: d2.temaGanador, entidad: d2.x && d2.x.entidad } }));
  }
}

console.log(`\n── _comparar_alternativas_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
