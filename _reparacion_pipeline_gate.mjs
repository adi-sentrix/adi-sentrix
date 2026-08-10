/* === _reparacion_pipeline_gate.mjs · CONTRATO v1.2 · LA CONDUCTA DE PUNTA A PUNTA =============================
 * CERO RED, CERO LLM, CERO CRÉDITO: answerViaOracle corre entero con las DOS pasadas simuladas a mano (mismo
 * patrón que _lastoffer_recentsubjects_derived_gate.mjs / _dialogue_state_gate.mjs). El BATCH corre REAL contra
 * el dataset demo — eso es aritmética local, no una llamada.
 *
 * ⚠ CLASIFICACIÓN: `scripts/gates-offline.mjs` marca LIVE a todo gate que mencione la inyección del oráculo, así
 * que este archivo NO entra a `npm run gates:offline` aunque no abra un socket. Es la misma situación de los ~20
 * gates de oráculo que ya viven así en el repo. Se corre con el MISMO candado que la suite:
 *     node --import ./scripts/offline-guard.mjs _reparacion_pipeline_gate.mjs
 * (el candado mata el proceso con exit 97 ante cualquier fetch y con 98 ante una credencial viva).
 *
 * LO QUE SOLO SE PUEDE PROBAR ACÁ — el costo y la memoria REALES de un turno de corrección:
 *   §8.3  · una corrección ambigua cuesta UNA llamada de PLAN y CERO de NARRAR. Antes costaba tres de PLAN.
 *   §4    · y no toca el contexto: la oferta y el alcance siguen intactos esperando la respuesta.
 *   §8.10 · tras una corrección resuelta, el narrador YA NO recibe la oferta ni los temas de la entidad vieja.
 *   §8.13 · dos llamadas por turno, contadas de verdad.
 *   +      · el backstop original sigue castigando al redirect resuelto SIN calls (no se aflojó nada).
 */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { renderInteractionMemory } from "./src/adi/oracle/persona.js";
import { composeFromLedger } from "./src/adi/oracle/narrationBlocks.js";
import { getLastOffer, getRecentSubjects } from "./src/adi/oracle/dialogueState.js";

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  OK  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`); }
}
function section(t) { console.log(`\n== ${t} ==`); }

// call REAL segura contra el dataset demo (la misma que usan los gates de estado desde 2026-08-04).
const CALL = (entidad) => ({ tool: "marginRead", args: { dimension: "cliente", filters: { cliente: entidad } } });
const planNormal = (entidad) => ({ intent: "answer", mode: "default", rationale: "t", scope: { level: "entity", entities: [entidad] }, calls: [CALL(entidad)] });
const planCorreccion = (entidad) => ({ intent: "redirect", mode: "default", rationale: "corrección", scope: { level: "entity", entities: [entidad] }, calls: [CALL(entidad)], reparacion: { tipo: "correccion", corrige: ["entidad"] } });
// la narración se compone del ledger REAL del turno: así cumple el chequeo 20 del guard (una corrección resuelta
// TRAE el dato) sin que el gate tenga que adivinar qué cifras autorizó el motor.
// DOS FORMAS, y la diferencia importa: el turno base compone la TABLA (la política de presentación de esa
// pregunta la exige), y los turnos siguientes citan UNA cifra en prosa. Si todos compusieran la tabla, el
// segundo repetiría un tramo verbatim del primero y guardC lo marcaría "degradado" — reintentaría tres veces por
// un artefacto del arnés, no por conducta del producto.
const narrarTablaConOferta = (oferta) => async ({ ledgerFigs }) => `${composeFromLedger(ledgerFigs || [], "full") || "Sin datos."}\n\n[[SIGUIENTE_PASO]]\n${oferta}`;
const unaCifra = (figs, entidad) => {
  const l = (figs || []);
  const f = l.find((x) => x && new RegExp(`^${entidad}\\s+·\\s+Margen`).test(String(x.label || ""))) || l[0];
  return f ? `${f.label} — ${f.value}, en el año cerrado.` : "Sin cifras autorizadas.";
};
const narrarConEvidencia = (prefijo, entidad) => async ({ ledgerFigs }) => `${prefijo} ${unaCifra(ledgerFigs, entidad)}`;

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("1 · turno base: deja alcance, evidencia y una oferta pendiente sobre Falabella");
let planN = 0, narrarN = 0;
const t1 = await answerViaOracle({
  text: "¿cómo viene el margen de Falabella?", history: [], mem: {}, scenario: "actual",
  callPlan: async () => { planN++; return planNormal("Falabella"); },
  callNarrate: async (a) => { narrarN++; return narrarTablaConOferta("¿Querés que profundice en el rebate de Falabella?")(a); },
});
ok("el turno base responde", !!(t1 && t1.r && t1.r.text));
ok("dos llamadas: una de PLAN, una de NARRAR", planN === 1 && narrarN === 1, `plan=${planN} narrar=${narrarN}`);
ok("deja una oferta pendiente sobre Falabella", !!(getLastOffer(t1.mem) && /Falabella/.test(getLastOffer(t1.mem).texto || "")), JSON.stringify(getLastOffer(t1.mem)));
ok("deja a Falabella como tema reciente", getRecentSubjects(t1.mem).some((s) => s.entidad === "Falabella"));

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("2 · «no, era Lider» — corrección RESUELTA (§8.10 · §1)");
let planN2 = 0, narrarN2 = 0, memQueVioElNarrador = null;
const t2 = await answerViaOracle({
  text: "no, era Lider", history: [{ role: "user", text: "¿cómo viene el margen de Falabella?" }, { role: "assistant", text: t1.r.text }], mem: t1.mem, scenario: "actual",
  callPlan: async () => { planN2++; return planCorreccion("Lider"); },
  callNarrate: async (args) => { narrarN2++; memQueVioElNarrador = args.mem; return narrarConEvidencia("Entendido: preguntabas por Lider, no por Falabella.", "Lider")(args); },
});
ok("la corrección responde", !!(t2 && t2.r && t2.r.text));
ok("§8.13 · sigue costando DOS llamadas, no más", planN2 === 1 && narrarN2 === 1, `plan=${planN2} narrar=${narrarN2}`);
const memBlockNarrador = renderInteractionMemory(memQueVioElNarrador || {});
ok("§8.10 · el narrador YA NO recibe la oferta de la entidad corregida",
  !/rebate de Falabella/.test(memBlockNarrador), memBlockNarrador);
ok("§8.10 · ni a Falabella como «tema reciente»", !/Temas recientes[^\n]*Falabella/.test(memBlockNarrador), memBlockNarrador);
ok("§1 · el alcance activo que ve el narrador ya es Lider", /Alcance activo[^\n]*Lider/.test(memBlockNarrador), memBlockNarrador);
ok("§3.6 · al cerrar el turno, la oferta de Falabella no revive por el shim",
  !(getLastOffer(t2.mem) && /Falabella/.test(getLastOffer(t2.mem).texto || "")), JSON.stringify(getLastOffer(t2.mem)));
ok("§8.11 · Sentrix recibe el alcance corregido", t2.r.evidence && t2.r.evidence.scope && t2.r.evidence.scope.entities.join(",") === "Lider", JSON.stringify(t2.r.evidence && t2.r.evidence.scope));

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("3 · «eso no es así» — corrección AMBIGUA (§8.3 · §4)");
let planN3 = 0, narrarN3 = 0;
const PREGUNTA = "¿Te referías a otra cuenta, o a otro período?";
const t3 = await answerViaOracle({
  text: "eso no es así", history: [{ role: "user", text: "¿cómo viene el margen de Falabella?" }], mem: t1.mem, scenario: "actual",
  callPlan: async () => { planN3++; return { intent: "redirect", mode: "default", rationale: "no dice qué está mal", scope: { level: "entity", entities: [] }, calls: [], reparacion: { tipo: "correccion", ambigua: true, pregunta: PREGUNTA } }; },
  callNarrate: async () => { narrarN3++; return "no debería llamarse"; },
});
ok("§8.3 · UNA sola llamada de PLAN (antes eran tres: el backstop la descartaba y escalaba)", planN3 === 1, `plan=${planN3}`);
ok("§4 · CERO llamadas a NARRAR (la pregunta no se narra libre)", narrarN3 === 0, `narrar=${narrarN3}`);
ok("§4 · la respuesta ES la pregunta de precisión que redactó PLAN", t3 && t3.r && t3.r.text.includes(PREGUNTA), t3 && t3.r && t3.r.text);
ok("§4 · una sola pregunta", ((t3.r.text.match(/\?/g)) || []).length === 1, t3.r.text);
ok("§4 · NO se recalculó nada (la respuesta no trae ninguna afirmación del motor)", !t3.r.claims || t3.r.claims.length === 0, JSON.stringify(t3.r.claims));
ok("§4 · el contexto queda INTACTO: la oferta sigue viva esperando la respuesta",
  !!(getLastOffer(t3.mem) && /Falabella/.test(getLastOffer(t3.mem).texto || "")), JSON.stringify(getLastOffer(t3.mem)));
ok("§4 · y el alcance también sigue en Falabella",
  t3.mem.conversationScope && t3.mem.conversationScope.current && t3.mem.conversationScope.current.entities.join(",") === "Falabella",
  JSON.stringify(t3.mem.conversationScope && t3.mem.conversationScope.current && t3.mem.conversationScope.current.entities));

section("4 · el backstop original NO se aflojó");
let planN4 = 0;
await answerViaOracle({
  text: "te pedí del negocio", history: [], mem: t1.mem, scenario: "actual",
  callPlan: async () => { planN4++; return { intent: "redirect", mode: "default", rationale: "sin calls y sin reparación", scope: { level: "global", entities: [] }, calls: [] }; },
  callNarrate: async ({ ledgerFigs }) => composeFromLedger(ledgerFigs || [], "full") || "Sin datos disponibles para responder eso.",
});
ok("un redirect RESUELTO sin calls sigue gastando sus 3 intentos (el defecto que el backstop mide sigue medido)", planN4 === 3, `plan=${planN4}`);
let planN5 = 0;
await answerViaOracle({
  text: "eso está mal", history: [], mem: t1.mem, scenario: "actual",
  callPlan: async () => { planN5++; return { intent: "redirect", mode: "default", rationale: "ambigua pero con corrige poblado", scope: { level: "entity", entities: [] }, calls: [], reparacion: { tipo: "correccion", ambigua: true, corrige: ["entidad"], pregunta: "¿cuál?" } }; },
  callNarrate: async ({ ledgerFigs }) => composeFromLedger(ledgerFigs || [], "full") || "Sin datos.",
});
ok("una reparación que se declara ambigua PERO dice qué corrigió no se cuela como pregunta", planN5 === 3, `plan=${planN5}`);

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("5 · desacuerdo y dato aportado (§8.4 · §8.5 · §5.1)");
let memDesacuerdo = null;
const t5 = await answerViaOracle({
  text: "no creo que sea por los rebates", history: [], mem: t1.mem, scenario: "actual",
  callPlan: async () => ({ intent: "redirect", mode: "evidencia", rationale: "desacuerdo", scope: { level: "entity", entities: ["Falabella"] }, calls: [CALL("Falabella")], reparacion: { tipo: "desacuerdo" } }),
  callNarrate: async (args) => { memDesacuerdo = args.mem; return narrarConEvidencia("Lo tomo, y separo lo que el dato prueba de lo que solo indica.", "Falabella")(args); },
});
ok("§8.4 · un DESACUERDO conserva el alcance",
  t5.mem.conversationScope.current.entities.join(",") === "Falabella", JSON.stringify(t5.mem.conversationScope.current.entities));
ok("§8.4 · y conserva la evidencia del turno (no la invalida como haría una corrección)",
  !!(memDesacuerdo && memDesacuerdo.conversationScope && memDesacuerdo.conversationScope.current));

const t6 = await answerViaOracle({
  text: "las ventas de Falabella fueron $20M, tomalo como supuesto", history: [], mem: t1.mem, scenario: "actual",
  callPlan: async () => ({ intent: "redirect", mode: "default", rationale: "dato aportado y aceptado", scope: { level: "entity", entities: ["Falabella"] }, calls: [CALL("Falabella")], reparacion: { tipo: "dato_usuario", dato: { metrica: "ventas", valor: "$20M" }, aceptado: true } }),
  callNarrate: async (args) => narrarConEvidencia("Mi dato difiere del tuyo; según tu dato serían $20M.", "Falabella")(args),
});
const supuestos = (t6.mem.conversationScope && t6.mem.conversationScope.current && t6.mem.conversationScope.current.supuestos) || [];
ok("§5.1 · la cifra aceptada queda viva en el estado canónico, marcada como del usuario",
  supuestos.length === 1 && supuestos[0].origen === "usuario" && supuestos[0].valor === "$20M", JSON.stringify(supuestos));
const t7 = await answerViaOracle({
  text: "¿y el margen de Falabella?", history: [], mem: t6.mem, scenario: "actual",
  callPlan: async () => planNormal("Falabella"),
  callNarrate: async (args) => narrarConEvidencia("Su lectura de margen queda así:", "Falabella")(args),
});
const sigueVivo = (t7.mem.conversationScope.current.supuestos || []).some((s) => s.origen === "usuario");
ok("§5.1 · y sigue vivo en el turno siguiente, sin que nadie lo vuelva a declarar", sigueVivo, JSON.stringify(t7.mem.conversationScope.current.supuestos));

console.log(`\n${pass} OK · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
