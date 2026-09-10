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
const CASOS = [
  ["cuentas", Q_CUENTAS],
  ["dominios", "¿qué es más urgente, margen o cobranza?"],
  ["universos", "¿ataco el margen o el capital frenado?"],
  ["estrategias", "¿vendo más o protejo margen?"],
];

/* ═══ 1 · EL DETECTOR ═══════════════════════════════════════════════════════════════════════════════════════ */
H("1 · el detector — las cuatro frases del owner, y ni un turno ajeno");
{
  const DEBE = [
    `¿miro ${CUENTAS.cae.n} o ${CUENTAS.cede.n}?`,
    "¿qué es más urgente, margen o cobranza?",
    "¿vendo más o protejo margen?",
    Q_CUENTAS,
  ];
  const miss = DEBE.filter((q) => !PB.cuandoAplica(q));
  ok(miss.length === 0, "★ las 4 frases del owner, TEXTUALES, se reconocen", miss.join(" · "));
  ok(formaConversacional(Q_CUENTAS) === "comparar",
    "★ «¿renegocio A o recupero B?» es una comparación — dos caminos distintos sobre dos cuentas distintas, y no la veía ninguna forma");

  const NO_DEBE = [
    "¿por qué febrero es el mes más bajo?", `muéstrame la ficha de ${CUENTAS.cede.n}`, "dame los 5 clientes de mejor margen",
    "¿cuánto vendimos este año?", "explícame el cuadro", "¿qué harías primero?", "¿cuál es mi margen?",
    `¿será que ${CUENTAS.cede.n} está comprando menos?`, "creo que es por descuentos, ¿estoy en lo correcto?",
    "¿hago bien en priorizar volumen?", "¿me conviene bajar precios?", "¿por qué vendo más pero gano menos?",
    "¿por qué tengo deuda alta pero poco vencido?", "qué hago esta semana", "dame los tres pasos",
    "Dime cuáles son los clientes que venden mucho pero están bajo el benchmark", "¿cómo va la cobranza?", "proyecta 12 meses con +4%",
  ];
  const fp = NO_DEBE.filter((q) => PB.cuandoAplica(q));
  ok(fp.length === 0, `★ cero falsos positivos sobre ${NO_DEBE.length} turnos ajenos`, fp.join(" · "));
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
  ok(/no hay empate|pesan parecido/i.test(T["dominios"].texto), "★ entre frentes, el tamaño decide y se dice");
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

/* ═══ 7 · LOS UNIVERSOS SE DECLARAN ═════════════════════════════════════════════════════════════════════════
 * CLAUDE.md §2: dos montos de universos distintos NUNCA van juntos sin decir de cuál sale cada uno. */
H("7 · comparar margen con capital de inventario es legítimo; esconder que son dos mundos, no");
{
  ok(/no son el mismo dinero|dos mundos/i.test(T["universos"].texto),
    "★ al poner venta comercial e inventario en la misma balanza, lo DECLARA", T["universos"].texto.slice(0, 240));
  ok(/ordenar por urgencia, no sumar|no sumar/i.test(T["universos"].texto), "…y dice qué se puede hacer con ellos y qué no");
  ok(!/no son el mismo dinero/i.test(T["dominios"].texto),
    "…y NO lo dice cuando los dos frentes salen del mismo universo — la advertencia se gana, no se reparte");
}

/* ═══ 8 · NINGÚN NÚMERO ESCRITO A MANO ══════════════════════════════════════════════════════════════════════ */
H("8 · cada número del texto sale de la boleta");
{
  for (const [tag, q] of CASOS) {
    const enBoleta = new Set(figsDe(pasosDe(PB, q, {}), q).map(valDe).filter(Boolean));
    const sueltos = (T[tag].texto.match(/[+-]?\$?\d[\d.,]*\s*(?:pp|%|[KMBd])?/g) || [])
      .map((s) => s.trim()).filter((s) => /\d/.test(s))
      .filter((s) => ![...enBoleta].some((v) => v === s || (v.includes(s) && /^[+-]?\$?\d[\d.,]*\s*(?:pp|%|[KMBd])?$/.test(v))));
    ok(sueltos.length === 0, `«${tag}» no escribe ningún número propio`, sueltos.join(" · "));
  }
}

/* ═══ 9 · EL NOTARIO Y SUS CARNADAS ═════════════════════════════════════════════════════════════════════════ */
H("9 · su lista notarial — y las carnadas que prueban que mira");
{
  const q = "¿qué es más urgente, margen o cobranza?";
  const figs = figsDe(pasosDe(PB, q, {}), q);
  const reglas = (t) => PB.listaNotarial(t, { figs, pregunta: q }).map((v) => v.regla);
  const margen = valDe(figs.find((f) => /^Carga comercial alta · subtotal$/i.test(f.label)));
  const cob = valDe(figs.find((f) => /^Saldo vencido · total$/i.test(f.label)));

  ok(reglas(`El margen: se están cediendo ${margen}.`).includes("alternativa-escondida"),
    "★ responder por UN camino y esconder el otro ARDE — es la falla que el owner nombró");
  ok(reglas(`Margen ${margen} y cobranza: mucho.`).includes("comparacion-sin-precio"),
    "★ comparar con una sola cifra ARDE — con un número se sostiene cualquiera de las dos conclusiones");
  ok(reglas(`Margen ${margen}. Cobranza ${cob}.`).includes("comparacion-sin-cierre"),
    "★ poner los dos montos y callarse ARDE — el owner pidió elegir o marcar el tradeoff");
  ok(reglas(`Margen ${margen}. Cobranza ${cob}. Por tamaño no hay empate: la cobranza pesa más.`).length === 0,
    "…y los dos con precio y con cierre pasan limpio");
  ok(reglas("No tengo información autorizada suficiente para responder eso.").length === 0, "★ declinar honestamente NO arde");
  ok(reglas("").length === 0, "y un texto vacío no genera multas fantasma");
  ok(PB.componer({ figs: [], pregunta: q, semilla: 1 }) === null, "★ carnada «boleta vacía» → el composer se RETIRA, no opina cuál conviene");
  ok(PB.componer({ figs, pregunta: "¿cuánto vendimos este año?", semilla: 1 }) === null,
    "carnada «pregunta que no es disyuntiva» → se RETIRA con la boleta llena");
}

console.log(`\n── _comparar_alternativas_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
