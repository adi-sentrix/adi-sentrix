/* === _referencia_de_criterio_gate.mjs · «A LA META» ES UN VALOR, NO UNA PREGUNTA (owner 2026-08-11) ===========
 * @inyeccion-simulada — `answerViaOracle` con `callPlan`/`callNarrate` a mano. Sin gateway, sin adapter, sin
 * `fetch(`, sin `src/ui/`. Cero red, cero llamadas pagadas.
 *
 * ── EL DEFECTO (número 6 de la certificación final, turno E1.t4) ──────────────────────────────────────────────
 * «Si llevo sus acciones comerciales a la meta, ¿cuánto recupero?» → ADI respondió «¿cuánto esperas que
 * disminuyan las acciones comerciales (en $)?». La meta está declarada en la política de la empresa
 * (`targetCarga` = 3,5%): preguntarla es hacerle repetir al usuario algo que su propia empresa ya definió, en un
 * turno donde además lo había dicho con todas las letras.
 *
 * ── LO QUE ESTE GATE PROTEGE ─────────────────────────────────────────────────────────────────────────────────
 * Que el valor salga de `POLICY` y NUNCA del texto del narrador; que cada métrica resuelva SU referencia (el
 * benchmark de margen y la meta de carga comercial son 30,1% y 3,5% — confundirlas daría un número correcto de la
 * política aplicado a la métrica equivocada, que es peor que preguntar); y que ante varias referencias posibles o
 * ninguna se haga UNA pregunta concreta en vez de adivinar.
 *
 * `node --import ./scripts/offline-guard.mjs _referencia_de_criterio_gate.mjs`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { resolverReferencia, REFERENCIA_ANAFORA_RE, REFERENCIA_POR_METRICA, POLICY } from "./src/config/businessPolicy.js";

initTenant(TENANT_DEMO);
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

H("[1] CADA MÉTRICA RESUELVE SU PROPIA REFERENCIA · y el valor sale de POLICY");
{
  const c = resolverReferencia({ texto: "Si llevo sus acciones comerciales a la meta, ¿cuánto recupero?" });
  ok(!!c && c.metrica === "carga", "«acciones comerciales a la meta» → la meta de CARGA, no el benchmark de margen");
  ok(!!c && c.valor === POLICY.targetCarga, `el valor viene de POLICY.targetCarga (${POLICY.targetCarga}), no del texto`);
  const m = resolverReferencia({ texto: "Llevá el margen al benchmark" });
  ok(!!m && m.metrica === "margen" && m.valor === POLICY.benchmark, `«margen al benchmark» → POLICY.benchmark (${POLICY.benchmark})`);
  ok(c && m && c.valor !== m.valor, "las dos referencias NO son intercambiables: 3,5% de carga ≠ 30,1% de margen");
  const r = resolverReferencia({ texto: "Subí la rotación al piso definido" });
  ok(!!r && r.valor === POLICY.rotacionMin, `«rotación al piso» → POLICY.rotacionMin (${POLICY.rotacionMin})`);
  const d = resolverReferencia({ texto: "Bajá la cobertura al techo" });
  ok(!!d && d.valor === POLICY.dohMax, `«cobertura al techo» → POLICY.dohMax (${POLICY.dohMax})`);
  // el mapeo es una lista CERRADA y declarada: si alguien agrega una métrica sin su referencia, se ve acá.
  ok(Object.keys(REFERENCIA_POR_METRICA).every((k) => POLICY[REFERENCIA_POR_METRICA[k].clave] != null),
    "toda métrica declarada en el mapeo tiene su referencia viva en POLICY");
}

H("[2] AMBIGUA O AUSENTE → NO SE ADIVINA");
{
  ok(resolverReferencia({ texto: "Llevalo a la meta" }) === null,
    "sin métrica reconocible no resuelve: el motor pregunta (una referencia adivinada contamina la simulación)");
  ok(resolverReferencia({ texto: "Llevá el margen y la rotación a la meta" }) === null,
    "con DOS métricas posibles tampoco resuelve — «varias» y «ninguna» se tratan igual");
  ok(resolverReferencia({ texto: "subilo un 5%" }) === null, "un supuesto numérico explícito no es una anáfora de referencia");
}

H("[3] LA MÉTRICA EXPLÍCITA DEL LLAMADOR GANA · sirve para la simulación pendiente");
{
  // cuando el pendiente ya sabe qué campo le falta, esa certeza vale más que reconocer el texto: es el camino por
  // el que «llevalo a la meta» funciona como RESPUESTA a una pregunta que ADI hizo dos turnos antes.
  const r = resolverReferencia({ texto: "llevalo a la meta", metrica: "carga" });
  ok(!!r && r.valor === POLICY.targetCarga, "con la métrica dada por el llamador, un texto ambiguo SÍ resuelve");
  ok(resolverReferencia({ texto: "llevalo a la meta", metrica: "inventada" }) === null, "una métrica que no existe no inventa referencia");
}

H("[4] LA ANÁFORA SE RECONOCE EN SUS FORMAS REALES");
{
  for (const t of ["a la meta", "al objetivo", "al benchmark", "a nuestra referencia", "al nivel definido", "al piso", "hasta la meta"]) {
    ok(REFERENCIA_ANAFORA_RE.test(t), `«${t}» se reconoce como referencia a la política`);
  }
  for (const t of ["subilo 5%", "bajá 3 puntos", "a Falabella", "al mes que viene"]) {
    ok(!REFERENCIA_ANAFORA_RE.test(t), `«${t}» NO es una referencia a la política`);
  }
}

H("[5] END-TO-END · el turno EXACTO de E1.t4 deja de preguntar lo que la política ya dice");
{
  let pregunto = 0;
  const PLAN = { intent: "answer", mode: "default", calls: [{ tool: "simulateGeneral", args: { dimension: "cliente", entity: "Lider", campo: "cargaComercial" } }] };
  const o = await answerViaOracle({
    text: "Si llevo sus acciones comerciales a la meta, ¿cuánto recupero? No digas que eso cierra toda la brecha si el dato no lo prueba.",
    history: [], mem: {}, scenario: "bonanza",
    callPlan: async () => PLAN,
    callNarrate: async () => "Con la carga comercial en la meta de 3.5%, el exceso de Lider es $125K. Eso es una parte de la brecha, no toda.",
  });
  const txt = (o && o.r && o.r.text) || "";
  pregunto = /¿cu[aá]nto esperas?\b|¿cu[aá]nto esper[aá]s\b/i.test(txt) ? 1 : 0;
  ok(pregunto === 0, "ya NO pregunta el valor que la política declara", txt.slice(0, 140));
}

console.log(`\n── _referencia_de_criterio_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
