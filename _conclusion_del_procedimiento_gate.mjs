/* === _conclusion_del_procedimiento_gate.mjs · LA CONCLUSIÓN ES DEL PROCEDIMIENTO, NO DEL NARRADOR ==========
 *
 * LA LEY, palabra del owner (2026-09-10): el narrador decide CÓMO explicarlo, cuánto resumir, cómo adaptarlo
 * al destinatario. Lo que NO puede cambiar: el cliente prioritario, la cifra relevante, el ranking, la
 * causalidad demostrada, el veredicto, la primera acción. «La conclusión es del procedimiento, no del
 * narrador.»
 *
 * LA FALLA REAL QUE LA ORIGINÓ, vista en su pantalla el mismo día: el camino de respaldo recomendó renegociar
 * la cuenta DESCARTADA y dio por sana justo la que el procedimiento había elegido — misma boleta, conclusión
 * opuesta. La forma de esa pantalla es la carnada de este gate.
 *
 * LO QUE SE PRUEBA, y en este orden por playbook (comparar · plan · hipótesis) más reformular:
 *   1 · el procedimiento DERIVA su conclusión (`conclusionDe`) y el composer escribe ESA — una verdad, no
 *       una copia: la función que el notario defiende es la que el composer come.
 *   2 · el texto que la invierte ARDE con `conclusion-cambiada` (negar la elegida · elegir la descartada ·
 *       inventar elección donde el dato no eligió · cambiar la primera acción o su dueño · dar vuelta el
 *       veredicto).
 *   3 · el composer NO tropieza con su propio notario, y la adaptación legítima pasa limpia — una regla que
 *       muerde prosa buena se termina apagando.
 *
 * ⚠️ NADA DE NOMBRES ESCRITOS A MANO: las cuentas salen del pack y se eligen POR SU CONDUCTA, así el candado
 * vale también para la planilla de un usuario.
 *
 * OFFLINE · determinístico · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _conclusion_del_procedimiento_gate.mjs` */
import { readFileSync } from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { compararAlternativas as PBC, conclusionDe as conclusionComparar } from "./src/adi/agente/playbooks/compararAlternativas.js";
import { planDeAccion as PBP, conclusionDe as conclusionPlan } from "./src/adi/agente/playbooks/planDeAccion.js";
import { hipotesisDelUsuario as PBH, conclusionDe as conclusionHipotesis } from "./src/adi/agente/playbooks/hipotesisDelUsuario.js";
import { vetosDeReformular } from "./src/adi/agente/reformular.js";
import { reDeReferencia } from "./src/adi/oracle/entityRecord.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${String(detalle).slice(0, 360)}`); }
};
const H = (t) => console.log(`\n${t}`);
const ESC = ESCENARIO_INICIAL;
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

/* ── LAS CUENTAS POR SU CONDUCTA: una que CAE y una que CEDE sobre el nivel declarado ─────────────────────── */
const CUENTAS = (() => {
  const roles = figsDe([{ tool: "rolesCartera", args: {} }], "x");
  const nivel = roles.find((f) => reDeReferencia("pctRebate").test(f.label || "")) || null;
  const yoy = figsDe([{ tool: "salesRead", args: { focus: "vs_anterior", dimension: "cliente" } }], "x")
    .filter((f) => /· YoY$/i.test(f.label || ""))
    .map((f) => ({ n: entDe(f.label), v: numDe(f), fmt: valDe(f) })).filter((x) => x.n && Number.isFinite(x.v));
  const cae = yoy.filter((x) => x.v < 0).sort((a, b) => a.v - b.v)[0] || null;
  const sube = yoy.filter((x) => x.v > 0).sort((a, b) => b.v - a.v)[0] || null;
  const cede = roles.filter((f) => /· Carga comercial$/i.test(f.label || ""))
    .map((f) => ({ n: entDe(f.label), v: numDe(f), fmt: valDe(f) }))
    .filter((x) => x.n && Number.isFinite(x.v) && nivel && x.v > numDe(nivel))
    .sort((a, b) => b.v - a.v)[0] || null;
  return { cae, sube, cede };
})();

H("0 · el pack trae la conducta que la ley necesita medir");
ok(!!CUENTAS.cae && !!CUENTAS.cede && CUENTAS.cae.n !== CUENTAS.cede.n,
  `hay una cuenta que cae (${CUENTAS.cae ? CUENTAS.cae.n : "—"}) y otra que cede (${CUENTAS.cede ? CUENTAS.cede.n : "—"})`);
ok(!!CUENTAS.sube, `y una que sube (${CUENTAS.sube ? `${CUENTAS.sube.n} ${CUENTAS.sube.fmt}` : "—"}) — para el veredicto que corrige`);
if (!CUENTAS.cae || !CUENTAS.cede || !CUENTAS.sube) { console.log("\n── sin esa conducta no se puede medir la ley ──"); process.exit(1); }

/* ═══ 1 · COMPARAR: LA ELECCIÓN NO SE INVIERTE ══════════════════════════════════════════════════════════════ */
H("1 · comparar-alternativas · la elección es del procedimiento");
{
  const Q = `¿renegocio ${CUENTAS.cede.n} o recupero ${CUENTAS.cae.n}?`;
  const figs = figsDe(PBC.pasos(Q), Q);
  const con = conclusionComparar(figs, Q);
  ok(!!con && Array.isArray(con.eleccion) && con.eleccion.length === 1,
    `el procedimiento deriva una elección (${con && con.eleccion ? con.eleccion[0] : "—"}, regla ${con ? con.regla : "—"})`);
  const elegida = con.eleccion[0], descartada = (con.descartada || [])[0];
  const composed = PBC.componer({ figs, pregunta: Q, semilla: 1 });
  ok(!!composed && composed.includes(`Yo entraría por ${elegida}`),
    "★ el composer escribe LA MISMA elección que la derivación — una verdad, no una copia");
  const reglas = (t) => PBC.listaNotarial(t, { figs, pregunta: Q }).map((x) => x.regla);
  ok(!reglas(composed).includes("conclusion-cambiada"), "el composer no tropieza con su propio notario");

  const cita = valDe(figs.find((f) => new RegExp(`^${esc(elegida)} · Contribución$`, "i").test(f.label || "")) || figs.find((f) => /\d/.test(valDe(f))));
  const baitPantalla = `${elegida} aporta ${cita} hoy. Renegocia la condición de ${descartada}. ${elegida} no necesita recuperación.`;
  ok(reglas(baitPantalla).includes("conclusion-cambiada"),
    "★★ la forma de la pantalla del owner ARDE: dar por sana la cuenta elegida es cambiar la conclusión", reglas(baitPantalla).join(","));
  const baitElige = `${elegida} aporta ${cita} hoy y ${descartada} cede de más. Yo entraría por ${descartada}: la condición cara se ataca esta semana.`;
  ok(reglas(baitElige).includes("conclusion-cambiada"),
    "★ poner primero la descartada TAMBIÉN arde — elegir el otro camino es cambiar la conclusión");
  const adaptada = `La cuenta que se está yendo es ${elegida} (${cita} de aporte): ahí está la ventana, y por eso va primero. ${descartada} entrega margen, y esa condición sigue ahí la semana que viene.`;
  ok(!reglas(adaptada).includes("conclusion-cambiada"),
    "…y la adaptación legítima pasa limpia: misma elección dicha con otras palabras");

  /* donde el dato NO elige, inventarle una elección también es cambiarla — figs sintéticas de rótulos */
  const FIGS_DOM = [
    { label: "Carga comercial alta · subtotal", text: "$4.0M", raw: 4.0e6 },
    { label: "Saldo vencido · total", text: "$3.0M", raw: 3.0e6 },
  ];
  const QD = "¿qué es más urgente, margen o cobranza?";
  const conD = conclusionComparar(FIGS_DOM, QD);
  ok(!!conD && !conD.eleccion && Array.isArray(conD.opciones),
    "con montos parejos el procedimiento NO elige — y eso también es una conclusión");
  const reglasD = (t) => PBC.listaNotarial(t, { figs: FIGS_DOM, pregunta: QD }).map((x) => x.regla);
  ok(reglasD("El margen va en $4.0M y la cobranza en $3.0M. Yo empezaría por la cobranza, que es más rápida.").includes("conclusion-cambiada"),
    "★ inventarle una elección al dato ARDE: el empate era la conclusión");
  ok(!reglasD("El margen va en $4.0M y la cobranza en $3.0M: pesan parecido, así que el tamaño no elige. Elige el que puedas mover más rápido — eso lo sabes tú.").includes("conclusion-cambiada"),
    "…y declarar el empate pasa limpio");
}

/* ═══ 2 · PLAN: LA PRIMERA ACCIÓN NO CAMBIA DE FRENTE NI DE DUEÑO ══════════════════════════════════════════ */
H("2 · plan-de-accion · la primera acción es del procedimiento");
{
  const Q = "qué hago esta semana";
  const figs = figsDe(PBP.pasos(Q), Q);
  const pa = conclusionPlan(figs, Q);
  ok(!!pa && !!pa.entrada, `el procedimiento deriva la primera acción (${pa ? pa.frente.clave : "—"} · entrar por ${pa ? pa.entrada : "—"})`);
  const composed = PBP.componer({ figs, pregunta: Q, semilla: 1, ctx: { history: [] } });
  ok(!!composed && composed.includes(`Esta semana haría una cosa: ${pa.frente.accion(pa.entrada)}.`),
    "★ el composer escribe LA MISMA primera acción que la derivación");
  const reglas = (t) => PBP.listaNotarial(t, { figs, pregunta: Q }).map((x) => x.regla);
  ok(!reglas(composed).includes("conclusion-cambiada"), "el composer no tropieza con su propio notario");

  /* la «otra cuenta» sale de las filas POR ENTIDAD de los frentes — el mismo universo del que el
   * procedimiento elige a su dueño — y no de cualquier rótulo con un punto medio adentro */
  const otra = [...new Set(figs.filter((f) => /· (?:Carga comercial alta|Saldo vencido|Capital frenado)$/i.test(f.label || ""))
    .map((f) => entDe(f.label)).filter(Boolean))].find((n) => n !== pa.entrada);
  const cita = valDe(figs.find((f) => /\d/.test(valDe(f))));
  ok(!!otra, `hay otra cuenta medida en un frente para la carnada (${otra || "—"})`);
  const baitDuenio = `Esta semana haría una cosa: entrar por ${otra} y revisar su condición. Por qué esa primero: ahí pesa ${cita}. Qué miraría para confirmar: lo pactado. Si se confirma, sigo; si no, pasaría a otro frente. No haría todavía lo demás. Es criterio mío.`;
  ok(reglas(baitDuenio).includes("conclusion-cambiada"),
    "★★ cambiarle el dueño a la primera acción ARDE — el cliente prioritario lo eligió el procedimiento", reglas(baitDuenio).join(","));
  const baitNiega = `Esta semana haría una cosa: revisar la cartera completa con calma (${cita} en juego). ${pa.entrada} no corre prisa. Es criterio mío.`;
  ok(reglas(baitNiega).includes("conclusion-cambiada"),
    "★ dar por sin urgencia justo la entrada elegida TAMBIÉN arde");
  ok(!reglas(composed).length || reglas(composed).every((r) => r !== "conclusion-cambiada"),
    "…y el plan legítimo no paga la ley nueva");
}

/* ═══ 3 · HIPÓTESIS: EL VEREDICTO NO SE DA VUELTA ══════════════════════════════════════════════════════════ */
H("3 · hipotesis-del-usuario · el veredicto es del procedimiento");
{
  const Q1 = `¿será que ${CUENTAS.sube.n} está comprando menos?`;
  const figs1 = figsDe(PBH.pasos(Q1), Q1);
  const con1 = conclusionHipotesis(figs1, Q1);
  ok(!!con1 && con1.veredicto === "corrige", `una cuenta que SUBE con hipótesis «compra menos» → el procedimiento CORRIGE (${con1 ? con1.veredicto : "—"})`);
  const composed1 = PBH.componer({ figs: figs1, pregunta: Q1, semilla: 1 });
  ok(!!composed1 && /No es lo que dice tu dato/.test(composed1), "★ el composer escribe ESE veredicto");
  const reglas1 = (t) => PBH.listaNotarial(t, { figs: figs1, pregunta: Q1 }).map((x) => x.regla);
  ok(!reglas1(composed1).includes("conclusion-cambiada"), "el composer no tropieza con su propio notario");
  const bait1 = `Tu hipótesis: ${CUENTAS.sube.n} está comprando menos. Estás en lo correcto: va ${CUENTAS.sube.fmt}.`;
  ok(reglas1(bait1).includes("conclusion-cambiada"),
    "★★ confirmarle al dueño lo que su dato DESMIENTE arde — la falla fundacional de la ruta, ahora con cifra y todo", reglas1(bait1).join(","));

  const Q2 = `¿será que ${CUENTAS.cae.n} está comprando menos?`;
  const figs2 = figsDe(PBH.pasos(Q2), Q2);
  const con2 = conclusionHipotesis(figs2, Q2);
  ok(!!con2 && con2.veredicto === "confirma", `una cuenta que CAE con la misma hipótesis → el procedimiento CONFIRMA (${con2 ? con2.veredicto : "—"})`);
  const reglas2 = (t) => PBH.listaNotarial(t, { figs: figs2, pregunta: Q2 }).map((x) => x.regla);
  const bait2 = `Tu hipótesis: ${CUENTAS.cae.n} está comprando menos. No es lo que dice tu dato: va ${CUENTAS.cae.fmt}.`;
  ok(reglas2(bait2).includes("conclusion-cambiada"), "★ y corregir un veredicto CONFIRMADO arde igual — la ley corta para los dos lados");
  const composed2 = PBH.componer({ figs: figs2, pregunta: Q2, semilla: 1 });
  ok(!!composed2 && /Es correcta:/.test(composed2) && !reglas2(composed2).includes("conclusion-cambiada"),
    "…y la confirmación legítima del composer pasa limpia");
}

/* ═══ 4 · LA INVERSIÓN LATENTE QUE LA EXTRACCIÓN DESTAPÓ ═══════════════════════════════════════════════════ */
H("4 · el veredicto concuerda con la DIRECCIÓN de la hipótesis, no con la posición a secas");
{
  /* una cuenta BAJO el benchmark con hipótesis «está subiendo» (alza): antes respondía «sí» — el «sí» era de
   * la posición (está bajo el benchmark) y no de la dirección que el usuario afirmó. La cuenta se busca con
   * la lectura directa (los pasos del playbook necesitan una pregunta ya armada, y el nombre sale de acá). */
  const figsM = figsDe([{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }], "x");
  const bench = figsM.find((f) => /^Benchmark de margen$/i.test(f.label || ""));
  const bajo = figsM.filter((f) => /· Margen$/i.test(f.label || ""))
    .map((f) => ({ n: entDe(f.label), v: numDe(f) }))
    .filter((x) => x.n && Number.isFinite(x.v) && bench && x.v < numDe(bench))[0];
  ok(!!bajo, `hay una cuenta bajo el benchmark (${bajo ? bajo.n : "—"})`);
  if (bajo) {
    const QM = `¿no será que el margen de ${bajo.n} está subiendo?`;
    const figsQ = figsDe(PBH.pasos(QM), QM);
    const conM = conclusionHipotesis(figsQ, QM);
    ok(!!conM && conM.veredicto === "corrige", `hipótesis al ALZA sobre una cuenta bajo el benchmark → CORRIGE (${conM ? conM.veredicto : "—"})`);
    const composedM = PBH.componer({ figs: figsQ, pregunta: QM, semilla: 1 });
    ok(!!composedM && /, no: /.test(composedM) && /por debajo/.test(composedM),
      "★★ el composer ya no dice «sí» a una mejora que el dato no muestra — el veredicto sigue a la dirección", composedM);
  }
}

/* ═══ 5 · REFORMULAR: LA CONCLUSIÓN PREVIA NO SE INVIERTE NI PIERDE SU CIFRA ═══════════════════════════════ */
H("5 · reformular · la misma respuesta para otro lector, no una segunda opinión");
{
  const Q = "explícamelo para el equipo comercial";
  const PREVIA = `Yo entraría por ${CUENTAS.cae.n}: una cuenta que cae tiene una ventana. Recuperarla es recuperar ${CUENTAS.cae.fmt}.`;
  const v = (t, previa = PREVIA) => vetosDeReformular(t, { pregunta: Q, previa, sitio: "cierre" }).map((x) => x.regla);

  ok(v(`Para el equipo: renegocien la condición de ${CUENTAS.cede.n}. ${CUENTAS.cae.n} no necesita recuperación.`).includes("reformular-invierte-conclusion"),
    "★★ la pantalla del owner ARDE también acá: reformular no puede dar vuelta la elección previa");
  ok(v("Para el equipo: hay una cuenta que se está yendo y conviene entrar ahí esta semana.").includes("reformular-pierde-la-cifra"),
    "★ y la versión sin ninguna cifra arde: «más corto» no es quitar el número, es quitar el rodeo");
  ok(v(`Para el equipo comercial: la cuenta que atender primero es ${CUENTAS.cae.n} — dejó de comprar ${CUENTAS.cae.fmt}. Ahí va la semana.`).length === 0,
    "…y la reformulación legítima pasa limpia: misma conclusión, misma cifra, otro lector");
  const PREVIA_PLAN = `Esta semana haría una cosa: entrar por ${CUENTAS.cae.n} y ordenar su cobranza. Concentra ${CUENTAS.cae.fmt}.`;
  ok(v(`Para el equipo: ${CUENTAS.cae.n} puede esperar — mejor mirar la cartera completa (${CUENTAS.cae.fmt}).`, PREVIA_PLAN).includes("reformular-invierte-conclusion"),
    "★ la primera acción de un plan previo tampoco se da vuelta al reformular");
}

/* ═══ 6 · CABLEADO: EL NOTARIO DE LOS PLAYBOOKS VE LA BOLETA ═══════════════════════════════════════════════ */
H("6 · la ley está conectada, no solo escrita");
{
  const bucle = readFileSync(new URL("./src/adi/agente/bucleAgente.js", import.meta.url), "utf8");
  ok(/vetosDelPlaybook\(playbookActivo, t, \{ figs: figsTotales, pregunta: q/.test(bucle),
    "el bucle pasa figs y pregunta al notario del playbook — sin boleta no hay conclusión que defender");
}

console.log(`\n══ ${pass} PASS · ${fail} FAIL ══`);
process.exit(fail ? 1 : 0);
