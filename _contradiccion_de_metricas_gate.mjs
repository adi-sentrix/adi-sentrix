/* === _contradiccion_de_metricas_gate.mjs · LAS DOS SON CIERTAS ==============================================
 *
 * EL ENCARGO DEL OWNER (2026-09-09), tercero de su orden, con sus cinco frases textuales y su regla:
 *   «Debe explicar la tensión entre dos métricas, no responder solo una.»
 *
 * LA FALLA QUE ESTE ARCHIVO EXISTE PARA IMPEDIR es responder MEDIA pregunta: servir la venta a quien preguntó
 * por qué vende más y gana menos. Lo deja donde estaba y encima parece una respuesta. Por eso el chequeo
 * estrella (§5) no mide que ADI conteste: mide que cite LAS DOS MITADES y nombre el mecanismo que las une.
 *
 * ⚠️ Y §7 GUARDA LA LECCIÓN MÁS CARA DE ESTA RUTA. La primera versión leía la venta total del `trend` y decía
 * «$100.0M contra $92.9M del año anterior». El muro volteó el turno entero, y tenía razón: el motor sella esas
 * dos cifras `source: computed · derivada_no_reconciliada` — son un total que el propio dato declara que no
 * cierra. Un asesor no sostiene una lectura sobre un total que su fuente no reconcilia. La rama se rehízo
 * sobre cifras literales, y acá queda el candado que impide volver.
 *
 * ⚠️ NADA DE NOMBRES ESCRITOS A MANO: las cuentas salen del pack y se eligen POR SU CONDUCTA (una que vende
 * menos y aporta más que otra), así el candado vale también para la planilla de un usuario.
 *
 * OFFLINE · determinístico · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _contradiccion_de_metricas_gate.mjs` */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { contradiccionDeMetricas as PB } from "./src/adi/agente/playbooks/contradiccionDeMetricas.js";
import { PLAYBOOKS, playbookPara, pasosDe, obligatoriasDe, promesasCumplidas } from "./src/adi/agente/playbooks/registro.js";
import { formaConversacional } from "./src/adi/agente/formaConversacional.js";
import { entidadesNombradas } from "./src/adi/agente/playbooks/indiceEntidades.js";
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
const ledgerDe = (pasos, pregunta) =>
  runPlan({ intent: "answer", calls: pasos.map((s) => ({ tool: s.tool, args: s.args })) },
    { scenario: ESC, maxCalls: 8, preguntaUsuario: pregunta, registry: CAJA }).ledger || {};
const figsDe = (pasos, pregunta) => ledgerDe(pasos, pregunta).figs || [];
const valDe = (f) => String((f && (f.text || f.value)) || "");
const entDe = (l) => { const p = String(l || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };
const numDe = (f) => { if (!f) return NaN; if (Number.isFinite(f.raw)) return f.raw;
  const m = /(\d+(?:\.\d+)?)\s*([KkMmBb])?(?![A-Za-zÁÉÍÓÚÜáéíóúüÑñ])/.exec(valDe(f));
  return m ? (/^[^\d]*-/.test(valDe(f)) ? -1 : 1) * Number(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] || "").toLowerCase()] || 1) : NaN; };

/* ── EL PAR QUE §5 NECESITA: una cuenta que vende MENOS y aporta MÁS que otra ────────────────────────────── */
const PAR = (() => {
  const figs = figsDe([{ tool: "marginRead", args: { dimension: "cliente" } }], "x")
    .concat(figsDe([{ tool: "contributionRead", args: {} }], "x"));
  const venta = new Map(), contrib = new Map();
  for (const f of figs) {
    const n = entDe(f.label); if (!n) continue;
    if (/· Venta$|· Ventas$/i.test(f.label)) venta.set(n, numDe(f));
    if (/· Contribución$/i.test(f.label)) contrib.set(n, numDe(f));
  }
  for (const [a, va] of venta) for (const [b, vb] of venta) {
    if (a === b) continue;
    const ca = contrib.get(a), cb = contrib.get(b);
    if (![va, vb, ca, cb].every(Number.isFinite)) continue;
    if (va < vb && ca > cb) return { menor: a, mayor: b };   // vende menos, aporta más
  }
  return null;
})();

/* ═══ 0 · EL PACK TRAE LA CONTRADICCIÓN ═════════════════════════════════════════════════════════════════════ */
H("0 · el pack tiene dos cuentas donde una vende menos y aporta más — sin eso §5 no probaría nada");
ok(!!PAR, `hay un par así (${PAR ? `${PAR.menor} vende menos que ${PAR.mayor} y aporta más` : "—"})`);
if (!PAR) { console.log("\n── sin el par no se puede medir la ruta ──"); process.exit(1); }

/* ═══ 1 · EL DETECTOR ═══════════════════════════════════════════════════════════════════════════════════════ */
H("1 · el detector — las cinco frases del owner, y ni un turno ajeno");
{
  const DEBE = [
    "¿por qué vendo más pero gano menos?",
    `¿por qué ${PAR.menor} vende menos que ${PAR.mayor} pero aporta más?`,
    "¿por qué crece la venta pero cae el margen?",
    "¿por qué tengo deuda alta pero poco vencido?",
    "¿por qué inventario bajo en monto pero alto en días?",
  ];
  const miss = DEBE.filter((q) => !PB.cuandoAplica(q));
  ok(miss.length === 0, `★ las ${DEBE.length} frases del owner, TEXTUALES, se reconocen`, miss.join(" · "));

  /* ⚠️ EL FALSO POSITIVO QUE COSTÓ UN TURNO CONGELADO: «venden mucho pero están bajo el benchmark» es una
   * LISTA con dos condiciones, no una contradicción — el usuario pide nombres, no pide entender. */
  const NO_DEBE = [
    "Dime cuáles son los clientes que venden mucho pero están bajo el benchmark",
    "dame los clientes de venta alta pero margen bajo", "¿quiénes venden mucho pero aportan poco?",
    "¿por qué febrero es el mes más bajo?", `muéstrame la ficha de ${PAR.mayor}`,
    "¿cuánto vendimos este año?", "explícame el cuadro", "¿qué harías primero?",
    `¿será que ${PAR.mayor} está comprando menos?`, "creo que es por descuentos, ¿estoy en lo correcto?",
    "¿hago bien en priorizar volumen?", "¿me conviene bajar precios?", "qué hago esta semana",
    "dame los tres pasos", "¿cómo va la cobranza?", "proyecta 12 meses con +4%",
  ];
  const fp = NO_DEBE.filter((q) => PB.cuandoAplica(q));
  ok(fp.length === 0, `★ cero falsos positivos sobre ${NO_DEBE.length} turnos ajenos, incluidos 3 pedidos de lista`, fp.join(" · "));
  ok(formaConversacional("Dime cuáles son los clientes que venden mucho pero están bajo el benchmark") !== "contradiccion",
    "★★ el turno CONGELADO de la certificación no es una contradicción: pedir una lista con dos condiciones no es preguntar cómo conviven");
  ok(entidadesNombradas(`¿por qué ${PAR.menor} vende menos que ${PAR.mayor} pero aporta más?`, "cliente").length >= 2,
    "y el índice devuelve las DOS cuentas nombradas, en el orden en que aparecen");
}

/* ═══ 2 · LAS PROMESAS ══════════════════════════════════════════════════════════════════════════════════════ */
H("2 · cada contradicción promete su lado más frágil — sin él sería la mitad que el owner prohibió");
const CASOS = [
  ["negocio", "¿por qué vendo más pero gano menos?"],
  ["cuentas", `¿por qué ${PAR.menor} vende menos que ${PAR.mayor} pero aporta más?`],
  ["cobranza", "¿por qué tengo deuda alta pero poco vencido?"],
  ["inventario", "¿por qué inventario bajo en monto pero alto en días?"],
];
{
  for (const [tag, q] of CASOS) {
    const oblig = obligatoriasDe(PB, q, {});
    const figs = figsDe(pasosDe(PB, q, {}), q);
    ok(oblig.length > 0, `«${tag}» declara promesa (${oblig.map(String).join(" ")})`);
    ok(promesasCumplidas(PB, figs, q, {}), `…y el dato la cumple, así que el procedimiento se activa (${figs.length} cifras)`);
  }
  ok(obligatoriasDe(PB, "¿cuánto vendimos este año?", {}).length === 0, "y en una pregunta que no es contradicción no promete nada");
}

/* ═══ 3 · EL CABLEADO ═══════════════════════════════════════════════════════════════════════════════════════ */
H("3 · el cableado — herramientas reales, precedencia, y sin quitarle el turno a las rutas hermanas");
{
  const todas = CASOS.flatMap(([, q]) => pasosDe(PB, q, {}));
  ok(todas.every((p) => typeof CAJA[p.tool] === "function"), `las ${todas.length} herramientas de sus pasos existen en la caja del agente`);
  ok(todas.every((p) => p.args && typeof p.para === "string" && p.para.length > 10), "…y cada paso declara args y PARA QUÉ");
  ok(PLAYBOOKS.indexOf(PB) === 2, "★ va tercero: detrás de hipótesis y decisión, delante de las puertas de tema");
  ok(playbookPara("¿por qué vendo más pero gano menos?", { history: [], viewContext: null, cuadro: null, mem: {} }) === PB,
    "…y el registro lo elige de verdad");
  ok(playbookPara(`¿será que ${PAR.mayor} está comprando menos?`, { history: [], viewContext: null, cuadro: null, mem: {} }) !== PB,
    "…y NO se lleva la hipótesis");
  ok(playbookPara("¿hago bien en priorizar volumen?", { history: [], viewContext: null, cuadro: null, mem: {} }) !== PB,
    "…ni la decisión");
}

/* ═══ 4 · POR EL BUCLE ══════════════════════════════════════════════════════════════════════════════════════ */
H("4 · por el camino real del agente — con el cerebro mudo, el piso solo");
const T = {};
{
  for (const [tag, q] of CASOS) {
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESC, callAgente: MUDO });
    T[tag] = { q, texto: String((r.r && r.r.text) || ""), agente: (r.r && r.r.agente) || {} };
    ok(T[tag].agente.estado === "playbook", `«${tag}» lo resuelve el procedimiento (estado ${T[tag].agente.estado})`);
    ok((T[tag].agente.vetos || []).length === 0, "…sin vetos del muro", (T[tag].agente.vetos || [])[0]);
  }
}

/* ═══ 5 · ★ LAS DOS MITADES, Y EL MECANISMO ═════════════════════════════════════════════════════════════════ */
H("5 · ★ la regla del owner: explica las dos métricas, no responde solo una");
{
  for (const [tag, q] of CASOS) {
    const figs = figsDe(pasosDe(PB, q, {}), q);
    const notarios = PB.listaNotarial(T[tag].texto, { figs, pregunta: q }).map((v) => v.regla);
    ok(!notarios.includes("media-contradiccion"), `★ «${tag}» cita LAS DOS mitades — no la que sabe leer`, T[tag].texto.slice(0, 200));
    ok(!notarios.includes("contradiccion-sin-mecanismo"), `…y nombra lo que las reconcilia, que es el aporte`);
    ok(!notarios.includes("contradiccion-desmentida"), `…sin desmentir al dueño: las dos mitades que vio son ciertas`);
  }
  ok(/no se contradicen|miden cosas distintas/i.test(T["cuentas"].texto), "★ y lo dice explícito: las dos son ciertas");
  ok(T["cuentas"].texto.includes(PAR.menor) && T["cuentas"].texto.includes(PAR.mayor),
    "★ la contradicción entre dos cuentas nombra a las DOS — no responde por una");
  ok(/viene de la tasa|no viene del tamaño/i.test(T["cuentas"].texto),
    "…y nombra el mecanismo: el aporte no es el tamaño de la venta, es la tasa", T["cuentas"].texto.slice(0, 200));
}

/* ═══ 6 · NINGÚN NÚMERO ESCRITO A MANO ══════════════════════════════════════════════════════════════════════ */
H("6 · cada número del texto sale de la boleta");
{
  for (const [tag, q] of CASOS) {
    const enBoleta = new Set(figsDe(pasosDe(PB, q, {}), q).map(valDe).filter(Boolean));
    const sueltos = (T[tag].texto.match(/[+-]?\$?\d[\d.,]*\s*(?:pp|%|[KMBd])?/g) || [])
      .map((s) => s.trim()).filter((s) => /\d/.test(s))
      .filter((s) => ![...enBoleta].some((v) => v === s || (v.includes(s) && /^[+-]?\$?\d[\d.,]*\s*(?:pp|%|[KMBd])?$/.test(v))));
    ok(sueltos.length === 0, `«${tag}» no escribe ningún número propio`, sueltos.join(" · "));
  }
}

/* ═══ 7 · ★ NI UNA CIFRA QUE EL DATO DECLARE NO RECONCILIADA ════════════════════════════════════════════════
 * La lección más cara de esta ruta, hecha candado. */
H("7 · ★ ninguna cifra citada es un total que el propio dato declara no reconciliado");
{
  for (const [tag, q] of CASOS) {
    const figs = figsDe(pasosDe(PB, q, {}), q);
    const derivadas = figs.filter((f) => {
      const v = (f.tipo && f.tipo.verificabilidad) || "";
      return v === "derivada_no_reconciliada" && valDe(f) && /\d/.test(valDe(f)) && T[tag].texto.includes(valDe(f));
    });
    ok(derivadas.length === 0, `★ «${tag}» no se apoya en ninguna cifra derivada no reconciliada`,
      derivadas.map((f) => `${f.label}=${valDe(f)}`).join(" · "));
  }
  /* y que el chequeo esté MIRANDO: la lectura del negocio tiene cifras así, y son justo las que tentaban */
  const conDerivadas = figsDe([{ tool: "trend", args: { metric: "ventas" } }], "x")
    .filter((f) => (f.tipo && f.tipo.verificabilidad) === "derivada_no_reconciliada");
  ok(conDerivadas.length > 0, `…y el chequeo tiene qué cazar: el pack publica ${conDerivadas.length} cifras así (p. ej. «${conDerivadas[0].label}»)`);
}

/* ═══ 8 · LOS UNIVERSOS NO SE CRUZAN ════════════════════════════════════════════════════════════════════════
 * `skusMargen` y `skuInventario` no reconcilian (CLAUDE.md §4): una frase que los ponga juntos sería un
 * descuadre disfrazado de hallazgo. */
H("8 · la contradicción de inventario se responde con cifras de inventario");
{
  const universos = new Set(figsDe(pasosDe(PB, "¿por qué inventario bajo en monto pero alto en días?"), "x")
    .map((f) => (f.tipo && f.tipo.universo) || null).filter(Boolean));
  ok(!(universos.has("venta_comercial") && universos.size > 1),
    `★ la lectura de inventario no arrastra el universo comercial (universos: ${[...universos].join(" · ") || "—"})`);
  ok(!/contribuci[oó]n/i.test(T["inventario"].texto), "…y su texto no nombra contribución, que es del otro universo");
}

/* ═══ 9 · EL NOTARIO ════════════════════════════════════════════════════════════════════════════════════════ */
H("9 · su lista notarial — la mitad faltante, el mecanismo ausente, y el dueño desmentido");
{
  const q = "¿por qué tengo deuda alta pero poco vencido?";
  const figs = figsDe(pasosDe(PB, q, {}), q);
  const reglas = (t) => PB.listaNotarial(t, { figs, pregunta: q }).map((v) => v.regla);
  const pend = valDe(figs.find((f) => /^Saldo pendiente · total$/i.test(f.label)));
  const venc = valDe(figs.find((f) => /^Saldo vencido · total$/i.test(f.label)));

  ok(reglas(`Te deben ${pend}.`).includes("media-contradiccion"),
    "★ responder SOLO una de las dos métricas ARDE — es la falla que el owner nombró");
  ok(reglas(`Te deben ${pend} y de eso está vencido ${venc}.`).includes("contradiccion-sin-mecanismo"),
    "★ poner las dos cifras juntas sin decir qué las une ARDE — dos números no resuelven nada");
  ok(reglas(`Te deben ${pend} y vencido ${venc}. Lo que las une: la mayor parte está dentro de plazo.`).length === 0,
    "…y las dos con su mecanismo pasan limpio");
  ok(reglas(`No es cierto: te deben ${pend}, no lo que dices.`).includes("contradiccion-desmentida"),
    "★ desmentir al dueño ARDE — las dos mitades que vio son ciertas, por eso preguntó");
  ok(reglas("No tengo información autorizada suficiente para responder eso.").length === 0,
    "★ declinar honestamente NO arde");
  ok(reglas("").length === 0, "y un texto vacío no genera multas fantasma");
}

/* ═══ 10 · LAS CARNADAS ═════════════════════════════════════════════════════════════════════════════════════ */
H("10 · carnadas — si el chequeo no se pone rojo, no está mirando");
{
  const q = "¿por qué vendo más pero gano menos?";
  const figs = figsDe(pasosDe(PB, q, {}), q);
  ok(PB.componer({ figs: [], pregunta: q, semilla: 1 }) === null, "★ carnada «boleta vacía» → el composer se RETIRA");
  ok(PB.componer({ figs, pregunta: "¿cuánto vendimos este año?", semilla: 1 }) === null,
    "carnada «pregunta que no es contradicción» → el composer se RETIRA con la boleta llena");
  ok(PB.componer({ figs: figs.filter((f) => !/^(?:Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)$/i.test(f.label)), pregunta: q, semilla: 1 }) === null,
    "★ carnada «sin la serie de margen» → se retira en vez de responder la mitad de la venta");
}

console.log(`\n── _contradiccion_de_metricas_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
