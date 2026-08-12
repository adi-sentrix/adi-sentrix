/* === _tabla_no_autorizada_gate.mjs · POLÍTICA DE PRESENTACIÓN (owner 2026-08-07) =====================
 * La tabla NO es un booleano global: es una política de TRES estados que el contrato sella y guardC valida —
 * forbidden (perfil general) · required (se pidió tabla/mes a mes/desglose) · auto (el resto).
 * Ante una infracción se compone una salida DETERMINÍSTICA desde lo ya autorizado, sin otra llamada al LLM.
 *   [1] EL CONTRATO lo declara (politicaExtension.tablePolicy) y va sellado.
 *   [2] EL PROMPT no se contradice: sin instrucción de tabla, con la prohibición explícita.
 *   [3] guardC BLOQUEA la tabla markdown Y el listado tabular (la misma tabla con otra puntuación).
 *   [4] NO BLOQUEA prosa legítima, ni una enumeración en una oración.
 *   [5] LA SALIDA determinística: prosa desde los claims, que pasa guardC por construcción.
 *   [6] LA TABLA SIGUE PERMITIDA con intención explícita (evolución/mes a mes/composición/desglose/detalle).
 *   [7] LOS CUATRO EJES.
 *   [8] AUTO no juzga: el guard no opina donde la política no decidió.
 *   [9] CASO DE ACEPTACIÓN: "Muéstrame en una tabla las ventas mes a mes del negocio completo".
 * Cero red, cero LLM. `node _tabla_no_autorizada_gate.mjs`
 */
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { buildNarrationContract, buildClaims, isSealed } from "./src/adi/oracle/narrationContract.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { podarPlanProgresivo, podarLedgerProgresivo, composeProsaEjecutiva, resolveTablePolicy, pideDetalleTemporal, esConsultaGeneralDeEntidad } from "./src/adi/oracle/progressiveDisclosure.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const planCompleto = (entity, dimension = "cliente") => ({
  intent: "answer", mode: "default", scope: { level: "entity", entities: [entity] },
  calls: [
    { tool: "entityProfile", args: { dimension, entity } },
    { tool: "trend", args: { dimension, entity } },
    ...(dimension === "cliente" ? [{ tool: "entityComposicion", args: { dimension, entity } }, { tool: "entityCapitalLigado", args: { dimension, entity } }] : []),
  ],
});
function turno(entity, q, dimension = "cliente") {
  const gen = podarPlanProgresivo(planCompleto(entity, dimension), q);
  const r = runPlan({ intent: "answer", calls: gen.plan.calls }, { scenario: "actual" });
  const figs = podarLedgerProgresivo(r.ledger.figs, { quiereDesglose: !gen.podado.length }).figs;
  const tablePolicy = resolveTablePolicy({ text: q, podado: gen.podado });
  return { gen, results: r.results, figs, tablePolicy, ledger: { figs } };
}
const g = (texto, t) => guardC(texto, { ledger: t.ledger, results: t.results, trace: null, question: "", tablePolicy: t.tablePolicy });
const kinds = (v) => (v.violations || []).map((x) => x.kind);

const T = turno("Falabella", "perfil de Falabella");
const T_TMP = turno("Falabella", "Falabella mes a mes");

H("[1] EL CONTRATO lo declara, y va sellado");
{
  const c = buildNarrationContract({ text: "perfil de Falabella", plan: T.gen.plan, results: T.results, ledgerFigs: T.figs, mem: {}, history: [], pref: null, scenario: "actual", tablePolicy: "forbidden" });
  ok(c.politicaExtension.tablePolicy === "forbidden", `politicaExtension.tablePolicy === false — ${c.politicaExtension.tablePolicy}`);
  ok(isSealed(c), "el contrato con la prohibición sigue sellado (deep-freeze)");
  let mutó = false;
  try { c.politicaExtension.tablePolicy = "required"; if (c.politicaExtension.tablePolicy === "required") mutó = true; } catch { /* ok */ }
  ok(!mutó, "nadie río abajo puede levantar la prohibición mutando el contrato");
  const libre = buildNarrationContract({ text: "Falabella mes a mes", plan: T_TMP.gen.plan, results: T_TMP.results, ledgerFigs: T_TMP.figs, mem: {}, history: [], pref: null, scenario: "actual", tablePolicy: "required" });
  ok(libre.politicaExtension.tablePolicy === "required", "con intención temporal explícita el contrato la PERMITE");
}

H("[2] EL PROMPT no se contradice con el guard");
{
  const pay = buildNarrateUserMessageC({ text: "perfil de Falabella", plan: T.gen.plan, results: T.results, ledgerFigs: T.figs, mem: {}, history: [], pref: null, scenario: "actual", tablePolicy: "forbidden" });
  ok(pay.politica_tabla === "forbidden", "el payload declara politica_tabla:forbidden");
  ok(!("instruccion_tabla" in pay), "…y NO manda ninguna instrucción de tabla (pedir lo que el guard bloquea sería contradecirse)");
  ok(typeof pay.instruccion_sin_tabla === "string" && /listado tabular/i.test(pay.instruccion_sin_tabla), "…y sí manda la prohibición explícita, nombrando también el listado tabular");
  ok(/ficha de Sentrix/i.test(pay.instruccion_sin_tabla), "…apuntando a la Ficha como el lugar del detalle");
  const libre = buildNarrateUserMessageC({ text: "Falabella mes a mes", plan: T_TMP.gen.plan, results: T_TMP.results, ledgerFigs: T_TMP.figs, mem: {}, history: [], pref: null, scenario: "actual", tablePolicy: "required" });
  ok(libre.politica_tabla !== "forbidden" && !("instruccion_sin_tabla" in libre), "con la tabla permitida, el payload no paga ninguna de las dos claves");
}

H("[3] guardC BLOQUEA · las DOS formas de tabular");
{
  const md = `Falabella vendió $19.4M.\n\n| Concepto | Valor |\n|---|---|\n| Ventas | $19.4M |\n| Margen | 22% |`;
  ok(kinds(g(md, T)).includes("tabla-no-autorizada"), `tabla markdown → BLOQUEA — ${JSON.stringify(kinds(g(md, T)))}`);
  const lista = `Acá va el detalle:\n- Ventas: $19.4M\n- Margen: 22%\n- Contribución: $4.3M\n- Costo: $15.2M`;
  ok(kinds(g(lista, T)).includes("tabla-no-autorizada"), `listado tabular con guiones → BLOQUEA — ${JSON.stringify(kinds(g(lista, T)))}`);
  const num = `1. Ventas — $19.4M\n2. Margen — 22%\n3. Contribución — $4.3M`;
  ok(kinds(g(num, T)).includes("tabla-no-autorizada"), "listado numerado con em-dash → BLOQUEA");
  const bold = `**Ventas**: $19.4M\n**Margen**: 22%\n**Contribución**: $4.3M`;
  ok(kinds(g(bold, T)).includes("tabla-no-autorizada"), "listado en negrita sin viñeta → BLOQUEA");
}

H("[4] guardC NO BLOQUEA prosa legítima");
{
  const LIMPIAS = [
    "Falabella vendió $19.4M y está 1º de 13 por venta. Su margen es 22%, 8.1% de brecha contra tu benchmark de 30.1%.",
    "Una causa comprobada es el exceso de acciones comerciales: $194K. Es una parte; el resto permanece abierto.",
    "Falabella vendió $19.4M, con un margen de 22% y una contribución de $4.3M — todo en la misma oración, que es prosa, no tabla.",
    "Empezá por revisar las acciones comerciales de Falabella: $194K.\n\nEl detalle está en la ficha de Falabella en Sentrix.",
  ];
  for (const t of LIMPIAS) ok(!kinds(g(t, T)).includes("tabla-no-autorizada"), `prosa OK: "${t.slice(0, 62)}…"`, JSON.stringify(kinds(g(t, T))));
  // dos líneas no alcanzan: el umbral es 3 (una lectura con dos cifras destacadas sigue siendo prosa)
  ok(!kinds(g("Ventas: $19.4M\nMargen: 22%", T)).includes("tabla-no-autorizada"), "dos líneas etiqueta:cifra NO alcanzan (el umbral es 3)");
}

H("[5] LA SALIDA DETERMINÍSTICA · prosa desde los claims, sin otra llamada");
{
  const prosa = composeProsaEjecutiva(buildClaims(T.figs), { entidad: "Falabella" });
  ok(typeof prosa === "string" && prosa.length > 120, `compone prosa desde los claims — ${prosa && prosa.length} caracteres`);
  const v = g(prosa, T);
  ok(v.ok && kinds(v).length === 0, `y PASA guardC limpia (por construcción: cada cifra sale verbatim del claim) — ${JSON.stringify(kinds(v))}`);
  ok(/vendi[oó]/.test(prosa), "QUÉ PASA: la venta");
  ok(/benchmark|referencia/.test(prosa) && /brecha/.test(prosa), "POR QUÉ: la brecha contra la referencia");
  ok(/causa comprobada/.test(prosa) && /\$194K/.test(prosa), "QUÉ HACER PRIMERO: la palanca con su monto");
  ok(/permanece abierto/.test(prosa), "…y declara que es una parte, no la explicación completa (Proporcionalidad Semántica)");
  ok(/tu benchmark/.test(prosa) && !/sector|industria|mercado/i.test(prosa), "…narra 'tu benchmark', nunca sectorial");
  ok(!/rentable/i.test(prosa), "…y no afirma rentabilidad");
  ok(/ficha de Falabella en Sentrix/i.test(prosa), "cierra con la Ficha, que es donde vive el detalle");
  ok(!/\|/.test(prosa) && prosa.split("\n").length === 1, "y NO es una tabla ni un listado: una sola tirada de prosa");
  ok(composeProsaEjecutiva([], { entidad: "Falabella" }) === null && composeProsaEjecutiva(buildClaims(T.figs), {}) !== null,
    "sin claims devuelve null (el caller cae a su camino normal); sin entidad explícita la deduce de los claims");
}

H("[6] LA TABLA SIGUE PERMITIDA con intención explícita");
{
  const md = `| Mes | Venta |\n|---|---|\n| Ene | $1.1M |\n| Feb | $1.4M |`;
  for (const q of ["Falabella mes a mes", "la evolución de Falabella", "la tendencia de Falabella", "qué me compra Falabella", "el desglose de Falabella", "abrí el detalle de Falabella"]) {
    const t = turno("Falabella", q);
    ok(t.tablePolicy === "required", `"${q}" → tablePolicy required`);
    ok(!kinds(g(md, t)).includes("tabla-no-autorizada"), `…y la tabla NO se bloquea`);
  }
}

H("[7] LOS CUATRO EJES · mismo candado");
{
  const md = `| Concepto | Valor |\n|---|---|\n| A | 1 |\n| B | 2 |`;
  for (const [eje, ent] of [["cliente", "Falabella"], ["familia", "Electrodomésticos"], ["marca", "Samsung"], ["sku", "LG-DRYER8KG"]]) {
    const t = turno(ent, ent, eje);
    ok(t.tablePolicy === "forbidden", `${eje}: la consulta general de "${ent}" niega la tabla`);
    ok(kinds(g(md, t)).includes("tabla-no-autorizada"), `${eje}: y guardC la bloquea`);
    const tt = turno(ent, `${ent} mes a mes`, eje);
    ok(tt.tablePolicy === "required" && !kinds(g(md, tt)).includes("tabla-no-autorizada"), `${eje}: con "mes a mes" vuelve a estar permitida`);
  }
}

H("[8] AUTO · el guard no juzga donde la política no decidió");
{
  const auto = { ledger: T.ledger, results: T.results, trace: null, question: "", tablePolicy: "auto" };
  const md = ["| A | B |", "|---|---|", "| 1 | 2 |"].join("\n");
  ok(!kinds(guardC(md, auto)).includes("tabla-no-autorizada"), "auto: una tabla NO se bloquea");
  ok(!kinds(guardC("Prosa sin ninguna tabla.", auto)).includes("tabla-faltante"), "auto: la AUSENCIA de tabla tampoco se bloquea");
  ok(resolveTablePolicy({ text: "cómo va el negocio", podado: [] }) === "auto", "una consulta que no poda ni pide tabla resuelve `auto`");
  ok(resolveTablePolicy({ text: "compará Falabella y Lider", podado: [] }) === "auto", "una comparación resuelve `auto` — la tabla la decide el narrador, no el guard");
}

H("[9] CASO DE ACEPTACIÓN · 'Muéstrame en una tabla las ventas mes a mes del negocio completo'");
{
  const Q = "Muéstrame en una tabla las ventas mes a mes del negocio completo";
  ok(resolveTablePolicy({ text: Q, podado: [] }) === "required", "política REQUIRED (pide tabla Y pide mes a mes)");
  ok(pideDetalleTemporal(Q), "detalle: temporal");
  // ALCANCE NEGOCIO: sin entidad no hay entityProfile, así que la divulgación progresiva NI SIQUIERA entra
  const plan = { intent: "answer", mode: "default", calls: [{ tool: "trend", args: { metric: "ventas" } }] };
  ok(esConsultaGeneralDeEntidad(plan) === null, "alcance NEGOCIO: sin entityProfile, la regla de perfil no aplica");
  const pod = podarPlanProgresivo(plan, Q);
  ok(pod.podado.length === 0 && pod.plan.calls.length === 1, "la serie mensual NO se poda: se ejecuta completa");
  const r = runPlan({ intent: "answer", calls: pod.plan.calls }, { scenario: "actual" });
  // RE-CERTIFICADO (owner 2026-08-11, punto 4): una fig «Ene» PELADA era ambigua entre las tres series de
  // la tabla (este año / año anterior / presupuesto). Desde que la matriz se cruza con su columna, cada celda se
  // identifica «<serie> · <mes>». La expectativa vieja contaba justo la forma que producia el defecto de E3.t3
  // -cinco filas «Ene» indistinguibles-, asi que se cuenta la etiqueta identificada.

  const meses = r.ledger.figs.filter((f) => /(^|·\s*)(?:Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)$/i.test(String(f.label || "")));
  ok(meses.length >= 10, `la serie mensual completa viaja al narrador — ${meses.length} cifras de mes`);
  const t = { ledger: r.ledger, results: r.results, trace: null, question: Q, tablePolicy: "required" };
  ok(kinds(guardC("Las ventas del negocio fueron $100.0M, con su mejor tramo a mitad de año.", t)).includes("tabla-faltante"),
    "responder eso en PROSA se BLOQUEA: `tabla-faltante`");
  const conTabla = ["| Mes | Venta |", "|---|---|", "| Ene | $1.1M |", "| Feb | $1.4M |"].join("\n");
  ok(!kinds(guardC(conTabla, t)).includes("tabla-faltante"), "con la tabla, cumple");
  const pay = buildNarrateUserMessageC({ text: Q, plan: pod.plan, results: r.results, ledgerFigs: r.ledger.figs, mem: {}, history: [], pref: null, scenario: "actual", tablePolicy: "required" });
  ok(pay.politica_tabla === "required" && /OBLIGATORIA/.test(pay.instruccion_tabla || ""), "el payload manda la tabla como OBLIGATORIA");
  ok(!("instruccion_sin_tabla" in pay), "…y ninguna prohibición contradictoria");
}

console.log(`\n── _tabla_no_autorizada_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
