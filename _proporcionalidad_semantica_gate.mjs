/* === _proporcionalidad_semantica_gate.mjs · REGLA UNIVERSAL (owner 2026-08-07) =======================
 * "ADI nunca puede afirmar más de lo que la evidencia autorizada demuestra."
 *   [1] SELLO · cada claim declara sujeto+dimensión, procedencia, nivel financiero, cobertura causal y supuestos.
 *   [2] SUJETO · el eje se resuelve POR CLAIM contra el catálogo del tenant (antes se heredaba y mentía).
 *   [3] CAUSA · parte vs universo: con universo → fracción; sin universo → parcial e INNARRABLE, nunca estimada.
 *   [4] PROCEDENCIA · la vara es interna; sin fuente sectorial autorizada, decir "del sector" se bloquea.
 *   [5] NIVEL · venta/margen/contribución positivos NO autorizan "es rentable" sin un resultado.
 *   [6] GUARD · los cuatro límites bloquean de verdad, y NO bloquean la prosa legítima (falsos positivos).
 *   [7] EL PROMPT lo recibe · la doctrina y la semántica viajan al narrador (si no, es doctrina muerta).
 *   [8] NO HARDCODEADA · la MISMA regla en negocio, cliente, familia y SKU. Falabella es fixture, no caso especial.
 *   [9] CASO DE ACEPTACIÓN FALABELLA · las 6 correctas pasan, las 5 incorrectas se bloquean.
 * Cero red, cero LLM. `node _proporcionalidad_semantica_gate.mjs`
 */
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { buildClaims, buildRelations, sealScopeContract } from "./src/adi/oracle/narrationContract.js";
import { buildNarrateUserMessageC, buildProporcionalidadDoctrina } from "./src/adi/oracle/narratePromptC.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { REFERENCIA_PROCEDENCIA } from "./src/config/businessPolicy.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const corre = (plan) => {
  const { results, ledger } = runPlan(plan, { scenario: "actual" });
  const scope = sealScopeContract({ plan, results, scenario: "actual" });
  const claims = buildClaims(ledger.figs, { eje: scope.eje, periodo: scope.periodo });
  return { plan, results, ledger, scope, claims, rel: buildRelations(claims) };
};
const g = (texto, t) => guardC(texto, { ledger: t.ledger, results: t.results, trace: null, question: "" });
const kinds = (v) => (v.violations || []).map((x) => x.kind);

const PLAN_PERFIL = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } }] };
const PLAN_MARGEN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "marginRead", args: { dimension: "cliente", focus: "bajo_benchmark" } }] };
const PLAN_AMBOS = { intent: "answer", mode: "diagnostico", calls: [PLAN_PERFIL.calls[0], PLAN_MARGEN.calls[0]] };
// Fixture RICO: el turno real de "perfil de Falabella" (perfil + evolutivo + ranking + lectura de margen) — es el
// que autoriza las cifras de las frases de aceptación del owner (el 8.3% de crecimiento sale de trend, el "1º de
// 13" del ranking). Con el fixture pobre, esas frases rebotaban por cifra/conteo NO autorizado, que es el guard
// viejo funcionando bien: la frase es correcta EN SU TURNO, no en cualquiera.
const PLAN_RICO = { intent: "answer", mode: "diagnostico", scope: { level: "entity", entities: ["Falabella"] }, calls: [
  { tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } },
  { tool: "trend", args: { metric: "ventas", dimension: "cliente", entity: "Falabella" } },
  { tool: "ranking", args: { metric: "ventas", dimension: "cliente" } },
  { tool: "marginRead", args: { dimension: "cliente", focus: "bajo_benchmark" } },
] };
const T_PERFIL = corre(PLAN_PERFIL), T_AMBOS = corre(PLAN_AMBOS), T_RICO = corre(PLAN_RICO);

H("[1] SELLO · el claim declara todo lo que la regla exige");
{
  const c = T_PERFIL.claims.find((x) => x.metrica === "Ventas");
  for (const campo of ["entidad", "sujetoTipo", "eje", "metrica", "periodo", "valor", "unidad", "estatus", "procedencia", "nivelFinanciero", "coberturaCausal", "explica", "supuestos"])
    ok(campo in c, `el claim declara \`${campo}\``);
  ok(c.sujetoTipo === "entidad" && c.eje === "cliente" && c.nivelFinanciero === "venta", `sujeto+dimensión+nivel del claim de Ventas — ${c.sujetoTipo}/${c.eje}/${c.nivelFinanciero}`);
  const bench = T_PERFIL.claims.find((x) => x.procedencia);
  ok(bench && bench.procedencia === REFERENCIA_PROCEDENCIA, `la referencia declara procedencia — ${bench && bench.metrica}=${bench && bench.procedencia}`);
  ok(bench.supuestos.some((s) => /tu negocio|no una fuente sectorial/i.test(s)), `y su supuesto lo dice — "${bench.supuestos.join(" · ")}"`);
}

H("[2] SUJETO · el eje se resuelve por claim, no se hereda del turno");
{
  const inv = corre({ intent: "answer", mode: "diagnostico", calls: [{ tool: "inventoryStatus", args: { focus: "frenado" } }] });
  const ejes = [...new Set(inv.claims.map((c) => c.eje).filter(Boolean))].sort();
  ok(inv.scope.eje === "bodega", `el turno sella scope.eje="bodega" (la herencia vieja) — ${inv.scope.eje}`);
  ok(ejes.length > 1, `pero los claims traen sus ejes REALES — ${JSON.stringify(ejes)}`);
  const sku = inv.claims.find((c) => /^LG-|^SAM-|^BOS-|^MAK-/.test(String(c.entidad || "")));
  ok(sku && sku.eje === "sku", `un SKU queda tipado sku, no bodega — ${sku && sku.entidad}=${sku && sku.eje}`);
  ok(inv.claims.some((c) => c.sujetoTipo === "concepto"), "las pseudo-entidades ('Capital inmovilizado', 'Medida') se tipan `concepto`, no entidad");
  const ex = corre({ intent: "answer", mode: "default", calls: [{ tool: "executiveSummary", args: {} }] });
  ok(ex.claims.some((c) => c.sujetoTipo === "negocio"), "una lectura del negocio produce claims con sujetoTipo `negocio`");
}

H("[3] CAUSA · la parte nunca se confunde con el universo");
{
  const p = T_PERFIL.rel.parteDe;
  ok(p.length === 1 && p[0].clase === "acciones_comerciales", `el perfil declara 1 causa parcial — ${JSON.stringify(p.map((x) => x.clase))}`);
  ok(p[0].parte === "$194K" && p[0].universo === null && p[0].fraccion === null,
    `sin universo en la boleta: parte=$194K, fracción INNARRABLE (nunca estimada) — ${JSON.stringify(p[0])}`);
  const pa = T_AMBOS.rel.parteDe.find((x) => x.clase === "acciones_comerciales");
  ok(pa && pa.universo === "$1.6M" && pa.fraccion === "12.3%", `con el universo autorizado SÍ se cuantifica — $194K de ${pa && pa.universo} = ${pa && pa.fraccion}`);
  ok(!T_MARGEN_TIENE_BRECHA_COMO_PARTE(), "la BRECHA no se marca como causa parcial de sí misma (es el fenómeno, no la parte)");
  function T_MARGEN_TIENE_BRECHA_COMO_PARTE() { return corre(PLAN_MARGEN).rel.parteDe.some((x) => x.clase === "brecha_margen"); }
}

H("[4] PROCEDENCIA · sin fuente sectorial, la afirmación se bloquea");
{
  ok(!T_PERFIL.claims.some((c) => c.procedencia === "externa_sector"), "hoy NINGÚN claim puede declarar procedencia externa (no hay fuente sectorial en el dato)");
  const malo = "Falabella opera con un margen de 22%, bajo el estándar de la industria.";
  ok(kinds(g(malo, T_PERFIL)).includes("procedencia-no-autorizada"), `"estándar de la industria" → BLOQUEA — ${JSON.stringify(kinds(g(malo, T_PERFIL)))}`);
  const malo2 = "Falabella está 8.1pp bajo el promedio del mercado.";
  ok(kinds(g(malo2, T_PERFIL)).includes("procedencia-no-autorizada"), "\"promedio del mercado\" → BLOQUEA");
  const bueno = "Falabella opera con un margen de 22%, 8.1pp bajo tu benchmark de 30.1%.";
  ok(!kinds(g(bueno, T_PERFIL)).includes("procedencia-no-autorizada"), `"tu benchmark" → PASA — ${JSON.stringify(kinds(g(bueno, T_PERFIL)))}`);
  const bueno2 = "Falabella rinde bajo la referencia que definiste para tu negocio: 22% contra 30.1%.";
  ok(!kinds(g(bueno2, T_PERFIL)).includes("procedencia-no-autorizada"), "\"la referencia que definiste para tu negocio\" → PASA");
}

H("[5] NIVEL FINANCIERO · 'rentable' exige un resultado, no venta ni margen ni contribución");
{
  ok(!T_PERFIL.claims.some((c) => c.nivelFinanciero === "resultado"), "el perfil NO trae ningún claim con nivel `resultado`");
  ok(T_PERFIL.claims.some((c) => c.nivelFinanciero === "contribucion"), "…aunque sí trae contribución positiva ($4.3M)");
  const malo = "Falabella vende $19.4M con un margen de 22%, así que es una cuenta rentable.";
  ok(kinds(g(malo, T_PERFIL)).includes("nivel-financiero-no-autorizado"), `"es una cuenta rentable" → BLOQUEA — ${JSON.stringify(kinds(g(malo, T_PERFIL)))}`);
  const bueno = "Falabella deja contribución positiva de $4.3M, pero su margen de 22% está bajo tu referencia.";
  ok(kinds(g(bueno, T_PERFIL)).length === 0, `la formulación correcta PASA limpia — ${JSON.stringify(kinds(g(bueno, T_PERFIL)))}`);
}

H("[6] GUARD · bloquea de verdad, y NO bloquea la prosa legítima");
{
  // sujeto generalizado: cifra de una entidad narrada como del negocio, sin nombrarla
  const malo = "El negocio está en expansión: las ventas llegaron a $19.4M este año.";
  ok(kinds(g(malo, T_PERFIL)).includes("sujeto-generalizado"), `cifra de Falabella atribuida al negocio → BLOQUEA — ${JSON.stringify(kinds(g(malo, T_PERFIL)))}`);
  const bueno = "Las ventas a Falabella llegaron a $19.4M este año.";
  ok(!kinds(g(bueno, T_PERFIL)).includes("sujeto-generalizado"), "la misma cifra CON su sujeto → PASA");
  // causa sobredimensionada
  const maloC = "La principal causa de la brecha es el exceso de acciones comerciales, que suma $194K.";
  ok(kinds(g(maloC, T_PERFIL)).includes("causa-sobredimensionada"), `"la principal causa" sobre una parte → BLOQUEA — ${JSON.stringify(kinds(g(maloC, T_PERFIL)))}`);
  const buenoC = "Una causa comprobada es el exceso de acciones comerciales: $194K. Es una parte de la brecha; el resto permanece abierto.";
  ok(!kinds(g(buenoC, T_PERFIL)).includes("causa-sobredimensionada"), "la formulación parcial → PASA");
  // falsos positivos: prosa normal del producto
  for (const t of [
    "Falabella es 1º de 13 clientes por ventas, con $19.4M.",
    "Su margen es 22%, 8.1% de brecha contra tu benchmark de 30.1%.",
    "Revisá primero las acciones comerciales de Falabella: el exceso suma $194K.",
    "El exceso de acciones comerciales permite recuperar $194K.",
  ]) ok(kinds(g(t, T_RICO)).length === 0, `sin falso positivo: "${t.slice(0, 58)}…"`, JSON.stringify(kinds(g(t, T_RICO))));
}

H("[7] EL PROMPT LO RECIBE · si no viaja, es doctrina muerta");
{
  const pay = buildNarrateUserMessageC({ text: "perfil de Falabella", plan: PLAN_PERFIL, results: T_PERFIL.results, ledgerFigs: T_PERFIL.ledger.figs, mem: {}, history: [], pref: null, scenario: "actual" });
  ok(typeof pay.instruccion_proporcionalidad === "string" && pay.instruccion_proporcionalidad.length > 200, "la doctrina viaja en el payload de NARRAR");
  for (const [k, re] of [["sujeto", /ALCANCE DEL SUJETO/], ["causa", /ALCANCE CAUSAL/], ["referencia", /PROCEDENCIA DE LA REFERENCIA/], ["nivel", /NIVEL FINANCIERO/]])
    ok(re.test(pay.instruccion_proporcionalidad), `…con el límite de ${k}`);
  ok(/tu benchmark|tu referencia/.test(pay.instruccion_proporcionalidad) && /est[aá]ndar del sector/i.test(pay.instruccion_proporcionalidad),
    "…nombrando la formulación autorizada Y la prohibida");
  const conSem = pay.cifras_autorizadas.filter((c) => Object.keys(c).length > 2);
  ok(conSem.length > 0, `las cifras llevan su semántica al narrador — ${conSem.length}/${pay.cifras_autorizadas.length}`);
  ok(pay.cifras_autorizadas.some((c) => /parcial/.test(c.cobertura || "")), "la cifra de $194K viaja marcada `parcial`");
  ok(pay.cifras_autorizadas.some((c) => /tu negocio/.test(c.referencia || "")), "el benchmark viaja con su procedencia interna");
  // economía: un turno sin nada que limitar no paga el párrafo
  const pv = buildNarrateUserMessageC({ text: "x", plan: { intent: "answer", mode: "default", calls: [] }, results: [], ledgerFigs: [], mem: {}, history: [], pref: null, scenario: "actual" });
  ok(!pv.instruccion_proporcionalidad, "un turno sin claims NO paga la doctrina (economía de tokens)");
}

H("[8] NO HARDCODEADA · la MISMA regla en negocio, cliente, familia y SKU");
{
  const CASOS = [
    ["negocio", { intent: "answer", mode: "default", calls: [{ tool: "executiveSummary", args: {} }] }],
    ["cliente", PLAN_PERFIL],
    ["familia", { intent: "answer", mode: "default", calls: [{ tool: "queryMetric", args: { metric: "ventas", dimension: "familia" } }] }],
    ["sku", { intent: "answer", mode: "diagnostico", calls: [{ tool: "inventoryStatus", args: { focus: "frenado" } }] }],
  ];
  for (const [dim, plan] of CASOS) {
    const t = corre(plan);
    ok(t.claims.length > 0 && t.claims.every((c) => "sujetoTipo" in c && "nivelFinanciero" in c && "coberturaCausal" in c),
      `${dim}: TODOS los claims llevan los campos de la regla — ${t.claims.length} claims`);
    // el bloqueo de rentabilidad vale igual en los 4 (ninguno trae `resultado`)
    const ent = t.claims.find((c) => c.sujetoTipo === "entidad" && c.valor) || t.claims[0];
    const texto = `${ent.entidad || "El negocio"} muestra ${ent.valor}, así que es rentable.`;
    const esperado = !t.claims.some((c) => c.nivelFinanciero === "resultado");
    ok(kinds(g(texto, t)).includes("nivel-financiero-no-autorizado") === esperado,
      `${dim}: "es rentable" ${esperado ? "se bloquea" : "está autorizado"} — mismo criterio, sin caso especial`);
    // la procedencia vale igual en los 4
    ok(kinds(g("Está por debajo del estándar de la industria.", t)).includes("procedencia-no-autorizada"),
      `${dim}: la referencia sectorial se bloquea igual`);
  }
}

H("[9] CASO DE ACEPTACIÓN FALABELLA · las 6 correctas y las 5 incorrectas");
{
  const CORRECTAS = [
    "Falabella es 1.º de 13 clientes por ventas.",
    "Las ventas a Falabella crecieron 8.3%.",
    "Su margen es 22%, con 8.1% de brecha contra tu benchmark de 30.1%.",
    "El exceso de acciones comerciales permite recuperar $194K.",
    "Esta es una parte comprobada de la brecha; el resto permanece abierto.",
    "La cuenta deja contribución positiva, pero su margen está bajo tu referencia.",
  ];
  for (const t of CORRECTAS) ok(kinds(g(t, T_RICO)).length === 0, `correcta: "${t.slice(0, 62)}…"`, JSON.stringify(kinds(g(t, T_RICO))));
  const INCORRECTAS = [
    ["La carga comercial es la principal causa de la brecha: $194K.", "causa-sobredimensionada"],
    ["El negocio está en expansión: $19.4M este año.", "sujeto-generalizado"],
    ["Está bajo los estándares del sector.", "procedencia-no-autorizada"],
    ["La cuenta es rentable.", "nivel-financiero-no-autorizado"],
    ["Los $194K explican toda la diferencia de 8.1 puntos.", "causa-sobredimensionada"],
  ];
  for (const [t, esperado] of INCORRECTAS) {
    const k = kinds(g(t, T_RICO));
    ok(k.includes(esperado), `incorrecta bloqueada por \`${esperado}\`: "${t.slice(0, 55)}…"`, JSON.stringify(k));
  }
}

console.log(`\n── _proporcionalidad_semantica_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
