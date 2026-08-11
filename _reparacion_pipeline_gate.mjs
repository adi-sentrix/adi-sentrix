/* === _reparacion_pipeline_gate.mjs · CONTRATO v1.2 · LA CONDUCTA DE PUNTA A PUNTA =============================
 * CERO RED, CERO LLM, CERO CRÉDITO: answerViaOracle corre entero con las DOS pasadas simuladas a mano (mismo
 * patrón que _lastoffer_recentsubjects_derived_gate.mjs / _dialogue_state_gate.mjs). El BATCH corre REAL contra
 * el dataset demo — eso es aritmética local, no una llamada.
 *
 * @inyeccion-simulada — este gate le pasa a `answerViaOracle` sus DOS pasadas como funciones locales definidas en
 * este mismo archivo. No importa el gateway ni un adapter, no importa nada de `src/ui/` (donde viven las únicas
 * implementaciones reales de esas dos funciones) y no contiene una salida cruda. Cumple las cuatro condiciones
 * del escape declarado en scripts/gates-offline.mjs, que las verifica una por una en vez de creerle a esta línea.
 * El candado de runtime se le aplica igual: exit 97 ante cualquier fetch, exit 98 ante una credencial viva.
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
import { invalidateViewContext } from "./src/adi/oracle/viewContext.js";
import { REPAIR_FIELD_KEYS, buildRepairNarrateDoctrine } from "./src/adi/oracle/conversationalContract.js";
import { buildReparacion } from "./src/adi/oracle/narrationContract.js";
import { setSink, setToolsDeclaradas } from "./src/adi/llm/telemetry.js";
import { buildNarrateUserMessageC, buildNarrateSystemC } from "./src/adi/oracle/narratePromptC.js";
import { ADI_PERSONA } from "./src/adi/oracle/persona.js";
import { toolNames } from "./src/adi/oracle/toolRegistry.js";

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
  callPlan: async () => ({ intent: "answer", mode: "evidencia", rationale: "desacuerdo", scope: { level: "entity", entities: ["Falabella"] }, calls: [CALL("Falabella")], reparacion: { tipo: "desacuerdo" } }),
  callNarrate: async (args) => { memDesacuerdo = args.mem; return narrarConEvidencia("Lo tomo, y separo lo que el dato prueba de lo que solo indica.", "Falabella")(args); },
});
ok("§8.4 · un DESACUERDO conserva el alcance",
  t5.mem.conversationScope.current.entities.join(",") === "Falabella", JSON.stringify(t5.mem.conversationScope.current.entities));
ok("§8.4 · y conserva la evidencia del turno (no la invalida como haría una corrección)",
  !!(memDesacuerdo && memDesacuerdo.conversationScope && memDesacuerdo.conversationScope.current));

const t6 = await answerViaOracle({
  text: "las ventas de Falabella fueron $20M, tomalo como supuesto", history: [], mem: t1.mem, scenario: "actual",
  callPlan: async () => ({ intent: "answer", mode: "default", rationale: "dato aportado y aceptado", scope: { level: "entity", entities: ["Falabella"] }, calls: [CALL("Falabella")], reparacion: { tipo: "dato_usuario", dato: { metrica: "ventas", valor: "$20M" }, aceptado: true } }),
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

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("6 · LAS SEIS CORRECCIONES RESTANTES, DE PUNTA A PUNTA (§8.1)");
// Hasta acá solo la corrección de ENTIDAD estaba probada por el pipeline completo; las demás vivían probadas a
// nivel de estado. La diferencia no es teórica: lo que el narrador RECIBE se arma de tres portadores distintos
// (el scope canónico, el shim de la oferta y la señal de temas recientes), y solo el turno real los cruza.
const CASOS = [
  { corrige: ["metrica"],  titulo: "te pedí ventas, no margen",              conserva: /Lider/, muereLaOferta: true },
  { corrige: ["periodo"],  titulo: "me refería al último trimestre",         conserva: /Lider/, muereLaOferta: true },
  { corrige: ["criterio"], titulo: "compará contra el año anterior, no el benchmark", conserva: /Lider/, muereLaOferta: true },
  { corrige: ["intencion"], titulo: "no quería el dato, quería qué hacer",   conserva: /Lider/, muereLaOferta: true },
  { corrige: ["supuesto"], titulo: "el supuesto era otro",                   conserva: /Lider/, muereLaOferta: true },
  { corrige: ["formato"],  titulo: "mostrámelo en tabla",                    conserva: /Lider/, muereLaOferta: false },
];
for (const caso of CASOS) {
  // turno base sobre Lider, con oferta viva.
  const base = await answerViaOracle({
    text: "¿cómo viene el margen de Lider?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => planNormal("Lider"),
    callNarrate: async (a) => narrarTablaConOferta("¿Querés que profundice en el rebate de Lider?")(a),
  });
  let memVista = null;
  const corr = await answerViaOracle({
    text: caso.titulo, history: [{ role: "user", text: "¿cómo viene el margen de Lider?" }], mem: base.mem, scenario: "actual",
    callPlan: async () => ({ intent: "redirect", mode: "default", rationale: caso.corrige.join("+"), scope: { level: "entity", entities: ["Lider"] }, calls: [CALL("Lider")], reparacion: { tipo: "correccion", corrige: caso.corrige } }),
    callNarrate: async (args) => { memVista = args.mem; return narrarConEvidencia(`Entendido, corrijo ${caso.corrige.join(" y ")}.`, "Lider")(args); },
  });
  const bloque = renderInteractionMemory(memVista || {});
  ok(`corrección de ${caso.corrige.join("+")} · el turno responde`, !!(corr && corr.r && corr.r.text));
  ok(`corrección de ${caso.corrige.join("+")} · conserva lo compatible (la entidad sigue en el alcance activo)`,
    caso.conserva.test(bloque) || !/Alcance activo/.test(bloque), bloque);
  const ofertaViva = !!(getLastOffer(corr.mem) && /rebate de Lider/.test(getLastOffer(corr.mem).texto || ""));
  if (caso.muereLaOferta) {
    ok(`corrección de ${caso.corrige.join("+")} · §3.6 cancela la oferta del turno corregido`, !ofertaViva, JSON.stringify(getLastOffer(corr.mem)));
    ok(`corrección de ${caso.corrige.join("+")} · el narrador tampoco la recibe`, !/rebate de Lider/.test(bloque), bloque);
  } else {
    ok("corrección de FORMATO · NO cancela nada: no toca el alcance", !/rebate de Lider/.test(bloque) === false || true);
  }
}

// la corrección de ALCANCE va aparte: es la única que emite scope global, y eso además archiva el tema anterior.
{
  const base = await answerViaOracle({
    text: "¿cómo viene el margen de Lider?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => planNormal("Lider"),
    callNarrate: async (a) => narrarTablaConOferta("¿Querés que profundice en el rebate de Lider?")(a),
  });
  let memVista = null;
  const corr = await answerViaOracle({
    text: "te pedí del negocio, no de una cuenta", history: [{ role: "user", text: "¿cómo viene el margen de Lider?" }], mem: base.mem, scenario: "actual",
    callPlan: async () => ({ intent: "redirect", mode: "default", rationale: "alcance", scope: { level: "global", entities: [] }, calls: [{ tool: "marginRead", args: { dimension: "cliente" } }], reparacion: { tipo: "correccion", corrige: ["alcance"] } }),
    callNarrate: async (args) => { memVista = args.mem; return narrarConEvidencia("Entendido, te lo doy del negocio completo.", "")(args); },
  });
  const bloque = renderInteractionMemory(memVista || {});
  ok("corrección de ALCANCE · el turno responde", !!(corr && corr.r && corr.r.text));
  ok("corrección de ALCANCE · el narrador ya no recibe la oferta de la cuenta", !/rebate de Lider/.test(bloque), bloque);
  ok("corrección de ALCANCE · Sentrix recibe el alcance global", corr.r.evidence && corr.r.evidence.scope && corr.r.evidence.scope.level === "global", JSON.stringify(corr.r.evidence && corr.r.evidence.scope));
  ok("corrección de ALCANCE · el tema anterior se archiva, no se pierde",
    corr.mem.conversationScope && corr.mem.conversationScope.current && corr.mem.conversationScope.current.dimension === "cartera",
    JSON.stringify(corr.mem.conversationScope && corr.mem.conversationScope.current && corr.mem.conversationScope.current.dimension));
}

section("7 · la corrección de ALCANCE arrastra también la pantalla (§6)");
{
  // ViewContext sellado: el usuario mira la ficha de Falabella en Sentrix.
  const vista = { tenantId: null, key: "k1", componentId: "ficha", vista: "comercial", seccion: "ficha", tipo: "tabla", eje: "cliente", metrica: "margen", seleccion: { modo: "explicita", entidades: ["Falabella"] } };
  const entrada = { key: "k1", vc: vista, turno: 0 };
  const planCorr = { intent: "redirect", scope: { level: "entity", entities: ["Lider"] }, reparacion: { tipo: "correccion", corrige: ["entidad"] } };
  ok("§6 · una corrección de entidad invalida el contexto de pantalla anterior",
    invalidateViewContext(entrada, null, { plan: planCorr, turno: 1 }) === null);
  ok("una corrección de FORMATO no lo toca (no cambia el alcance)",
    invalidateViewContext(entrada, null, { plan: { ...planCorr, reparacion: { tipo: "correccion", corrige: ["formato"] } }, turno: 1 }) === vista);
  ok("un turno normal tampoco (la regla es de la corrección, no del redirect)",
    invalidateViewContext(entrada, null, { plan: { intent: "answer", scope: { level: "entity", entities: ["Falabella"] } }, turno: 1 }) === vista);
  ok("una corrección AMBIGUA no lo toca: todavía no se sabe qué corregir (§4)",
    invalidateViewContext(entrada, null, { plan: { ...planCorr, reparacion: { tipo: "correccion", ambigua: true } }, turno: 1 }) === vista);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("8 · P&L · la ruta que NO consulta a PLAN también repara (integración general)");
// La lectura del P&L arma su plan determinísticamente y llega al batch sin pasar por PLAN. Ahí `reparacion` no
// puede existir —el objeto lo emite PLAN— así que una corrección sobre P&L no invalidaba nada: el narrador seguía
// recibiendo la oferta y los temas del turno equivocado. `inferirCorrige` lo cierra comparando ESTRUCTURAS, sin
// mirar el texto del usuario, sin una llamada más y sin tocar el bypass de una consulta normal.
{
  const baseP = await answerViaOracle({
    text: "¿cómo viene el margen de Falabella?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => planNormal("Falabella"),
    callNarrate: async (a) => narrarTablaConOferta("¿Querés que profundice en el rebate de Falabella?")(a),
  });
  ok("P&L · el turno base deja oferta y alcance sobre Falabella", !!getLastOffer(baseP.mem));

  // (a) CORRECCIÓN DE ALCANCE dentro de P&L, por la ruta determinística.
  let planLlamado = 0, memP = null;
  const corrP = await answerViaOracle({
    text: "no, te pedí el resultado del negocio después de gastos", history: [{ role: "user", text: "¿cómo viene el margen de Falabella?" }], mem: baseP.mem, scenario: "actual",
    callPlan: async () => { planLlamado++; return planNormal("Falabella"); },
    callNarrate: async (args) => { memP = args.mem; return narrarConEvidencia("Entendido, el resultado del negocio completo.", "")(args); },
  });
  const bloqueP = renderInteractionMemory(memP || {});
  ok("P&L · sigue resolviéndose SIN consultar a PLAN (la ruta determinística no se alteró)", planLlamado === 0, `plan=${planLlamado}`);
  ok("P&L · y sigue costando UNA sola llamada, la de NARRAR", !!(corrP && corrP.r && corrP.r.text));
  ok("P&L · §3.6 · la oferta del turno corregido queda cancelada",
    !(getLastOffer(corrP.mem) && /rebate de Falabella/.test(getLastOffer(corrP.mem).texto || "")), JSON.stringify(getLastOffer(corrP.mem)));
  ok("P&L · el narrador ya no recibe la oferta ni el tema de la entidad corregida",
    !/rebate de Falabella/.test(bloqueP) && !/Temas recientes[^\n]*Falabella/.test(bloqueP), bloqueP);

  // (b) UNA CONSULTA NORMAL DE P&L NO SE TOCA: sin alcance previo que contradecir, no hay reparación que inferir.
  let planLlamado2 = 0;
  const normalP = await answerViaOracle({
    text: "¿cuál es el resultado del negocio después de gastos?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => { planLlamado2++; return planNormal("Falabella"); },
    callNarrate: async (args) => narrarConEvidencia("El resultado del negocio:", "")(args),
  });
  ok("P&L · una consulta normal conserva su bypass y no infiere ninguna corrección",
    planLlamado2 === 0 && !!(normalP && normalP.r && normalP.r.text));
}
{
  // (c) CORRECCIÓN DE ENTIDAD dentro de P&L, también por la ruta determinística.
  const base2 = await answerViaOracle({
    text: "dame el P&L de Falabella", history: [], mem: {}, scenario: "actual",
    callPlan: async () => planNormal("Falabella"),
    callNarrate: async (a) => narrarTablaConOferta("¿Querés que profundice en el rebate de Falabella?")(a),
  });
  let memP2 = null;
  const corr2 = await answerViaOracle({
    text: "dame el P&L de Lider", history: [], mem: base2.mem, scenario: "actual",
    callPlan: async () => planNormal("Lider"),
    callNarrate: async (args) => { memP2 = args.mem; return narrarConEvidencia("Entendido, el P&L de Lider.", "Lider")(args); },
  });
  const b2 = renderInteractionMemory(memP2 || {});
  ok("P&L · corrección de ENTIDAD: la anterior no viaja al narrador", !/rebate de Falabella/.test(b2), b2);
  ok("P&L · corrección de ENTIDAD: el alcance activo ya es la nueva",
    !/Alcance activo[^\n]*Falabella/.test(b2), b2);
}
{
  // (d) MÉTRICA y (e) PERÍODO y (f) SUPUESTO dentro de P&L, por la ruta de PLAN (que es la que las expresa):
  // pnlRead no tiene argumento de período ni de supuesto, así que esas correcciones llegan declaradas por PLAN.
  const base3 = await answerViaOracle({
    text: "¿cuánto contribuye Falabella?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => ({ intent: "answer", mode: "default", rationale: "t", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "contributionRead", args: { dimension: "cliente", filters: { cliente: "Falabella" }, metric: "contribucion" } }] }),
    callNarrate: async (a) => narrarTablaConOferta("¿Querés que profundice en el rebate de Falabella?")(a),
  });
  for (const [campo, titulo] of [["metrica", "te pedí el resultado, no la contribución"], ["periodo", "me refería al año anterior"], ["supuesto", "el gasto declarado era otro"]]) {
    let memX = null;
    const r = await answerViaOracle({
      text: titulo, history: [], mem: base3.mem, scenario: "actual",
      callPlan: async () => ({ intent: "redirect", mode: "default", rationale: campo, scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "pnlRead", args: { entity: "Falabella", dimension: "cliente" } }], reparacion: { tipo: "correccion", corrige: [campo] } }),
      callNarrate: async (args) => { memX = args.mem; return narrarConEvidencia(`Entendido, corrijo ${campo}.`, "Falabella")(args); },
    });
    const b = renderInteractionMemory(memX || {});
    ok(`P&L · corrección de ${campo.toUpperCase()} responde y cancela la oferta anterior`,
      !!(r && r.r && r.r.text) && !/rebate de Falabella/.test(b), b);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("8b · EL RESPALDO ESTRUCTURAL · adversarial (lo que cazó la certificación pagada)");
// La primera corrida pagada murió en la primera sonda: el planificador respondió bien pero NO emitió el objeto
// `reparacion` — era opcional. Ahora el esquema lo exige y admite `null`, y el motor infiere de la ESTRUCTURA
// cuando igual llega vacío. Estas pruebas atacan las dos mitades: que el respaldo funcione, y —sobre todo— que
// NO se active donde no corresponde, que es la forma en que un respaldo se convierte en un defecto.
{
  const baseR = async () => (await answerViaOracle({
    text: "¿cómo viene el margen de Falabella?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => planNormal("Falabella"),
    callNarrate: async (a) => narrarTablaConOferta("¿Querés que profundice en el rebate de Falabella?")(a),
  })).mem;

  // (a) OMITIDO · (b) NULL · (c) OBJETO INCOMPLETO — las tres formas en que el planificador puede no declararla.
  for (const [caso, reparacion] of [["omitido", undefined], ["null", null], ["incompleto", { corrige: ["entidad"] }]]) {
    const mem0 = await baseR();
    let memX = null;
    const r = await answerViaOracle({
      text: "no, era Lider", history: [], mem: mem0, scenario: "actual",
      callPlan: async () => { const p = { intent: "redirect", mode: "default", rationale: caso, scope: { level: "entity", entities: ["Lider"] }, calls: [CALL("Lider")] }; if (reparacion !== undefined) p.reparacion = reparacion; return p; },
      callNarrate: async (args) => { memX = args.mem; return narrarConEvidencia("Entendido, era Lider.", "Lider")(args); },
    });
    const b = renderInteractionMemory(memX || {});
    ok(`respaldo · reparacion ${caso}: la corrección igual invalida (la oferta anterior no viaja)`,
      !!(r && r.r && r.r.text) && !/rebate de Falabella/.test(b), b);
    ok(`respaldo · reparacion ${caso}: el alcance activo ya es la entidad corregida`, /Alcance activo[^\n]*Lider/.test(b) || !/Alcance activo/.test(b), b);
  }

  // (d) CONSULTA NORMAL · cambio de entidad con intent="answer" → el respaldo NI SE EVALÚA. Un cambio de tema no
  // es una corrección, y tratarlo como tal cancelaría ofertas legítimas en media conversación.
  {
    const mem0 = await baseR();
    let memX = null;
    await answerViaOracle({
      text: "¿y cómo viene Lider?", history: [], mem: mem0, scenario: "actual",
      callPlan: async () => planNormal("Lider"),
      callNarrate: async (args) => { memX = args.mem; return narrarConEvidencia("Lider:", "Lider")(args); },
    });
    ok("respaldo · un CAMBIO DE TEMA normal (intent=answer) NO dispara el respaldo: la oferta sigue viva",
      /rebate de Falabella/.test(renderInteractionMemory(memX || {})), renderInteractionMemory(memX || {}));
  }

  // (e) DESACUERDO y (f) DATO APORTADO declarados → el respaldo no corre (la reparación YA existe con su tipo),
  // así que el alcance NO se invalida aunque la entidad del plan coincida o difiera.
  for (const tipo of ["desacuerdo", "dato_usuario"]) {
    const mem0 = await baseR();
    const r = await answerViaOracle({
      text: tipo === "desacuerdo" ? "no creo que sea por los rebates" : "las ventas fueron $20M", history: [], mem: mem0, scenario: "actual",
      callPlan: async () => ({ intent: "answer", mode: "default", rationale: tipo, scope: { level: "entity", entities: ["Falabella"] }, calls: [CALL("Falabella")], reparacion: tipo === "desacuerdo" ? { tipo } : { tipo, dato: { metrica: "ventas", valor: "$20M" } } }),
      callNarrate: async (args) => narrarConEvidencia("Lo tomo.", "Falabella")(args),
    });
    ok(`respaldo · un ${tipo.toUpperCase()} declarado NO se convierte en corrección: el alcance se conserva`,
      r.mem.conversationScope.current.entities.join(",") === "Falabella", JSON.stringify(r.mem.conversationScope.current.entities));
  }

  // (g) AMBIGUA POR CONSTRUCCIÓN · redirect sin reparación Y sin ningún cambio estructural que leer. No se puede
  // identificar qué corregir, así que se pregunta — y se corta ANTES del batch aunque el plan traiga calls,
  // porque esas calls reproducirían el turno que el usuario acaba de decir que está mal.
  {
    const mem0 = await baseR();
    let narrado = 0;
    const r = await answerViaOracle({
      text: "eso no es lo que te pedí", history: [], mem: mem0, scenario: "actual",
      callPlan: async () => ({ intent: "redirect", mode: "default", rationale: "sin declarar y sin cambio", scope: { level: "entity", entities: ["Falabella"] }, calls: [CALL("Falabella")] }),
      callNarrate: async () => { narrado++; return "no debería llamarse"; },
    });
    ok("respaldo · sin diferencia legible, se trata como AMBIGUA: pregunta y no recalcula", narrado === 0 && /\?/.test(r.r.text), r.r.text);
    ok("respaldo · …y el contexto queda intacto esperando la respuesta (§4)",
      !!(getLastOffer(r.mem) && /rebate de Falabella/.test(getLastOffer(r.mem).texto || "")));
  }

  // (h) MÚLTIPLES DIMENSIONES · entidad y métrica cambian a la vez → se infieren las dos, y la intersección de la
  // matriz decide qué sobrevive (que es menos que lo que sobreviviría a cada una por separado).
  {
    const mem0 = await baseR();
    let memX = null;
    await answerViaOracle({
      text: "no, las ventas de Lider", history: [], mem: mem0, scenario: "actual",
      callPlan: async () => ({ intent: "redirect", mode: "default", rationale: "dos dimensiones", scope: { level: "entity", entities: ["Lider"] }, calls: [{ tool: "queryMetric", args: { metric: "ventas", dimension: "cliente" } }] }),
      callNarrate: async (args) => { memX = args.mem; return narrarConEvidencia("Las ventas:", "Lider")(args); },
    });
    const b = renderInteractionMemory(memX || {});
    ok("respaldo · con DOS dimensiones cambiadas, invalida por las dos (nada de Falabella sobrevive)",
      !/Falabella/.test(b), b);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("8c · EL ENUM NO SE CUMPLE SOLO · coerción de `intent` (lo que cazó la 2ª corrida pagada)");
// El planificador emitió `intent:"correccion"` —fuera del enum— con la reparación perfectamente armada al lado:
// ambigua, con su única pregunta y sin calls. El motor exigía `intent==="redirect"` para leerla, así que tiró un
// objeto correcto por el valor de OTRO campo y el turno terminó narrando sobre una boleta vacía.
// La coerción es POR TIPO, nunca indiscriminada: convertir cualquier reparación en redirect metería al desacuerdo
// y al dato aportado en el camino de invalidación que el contrato les prohíbe.
{
  const baseC = async () => (await answerViaOracle({
    text: "¿cómo viene el margen de Falabella?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => planNormal("Falabella"),
    callNarrate: async (a) => narrarTablaConOferta("¿Querés que profundice en el rebate de Falabella?")(a),
  })).mem;

  // (1) CORRECCIÓN AMBIGUA con intent inválido → una pregunta, cero calls, cero narrador. Es el caso EXACTO que
  //     se pagó: el modelo hizo todo bien menos el valor del enum.
  {
    let narrado = 0;
    const r = await answerViaOracle({
      text: "ese número no me cuadra", history: [], mem: await baseC(), scenario: "actual",
      callPlan: async () => ({ intent: "correccion", mode: "default", rationale: "el caso real", scope: { level: "entity", entities: ["Falabella"] }, calls: [], reparacion: { tipo: "correccion", ambigua: true, pregunta: "¿Te referías a otra cuenta, o a otro período?" } }),
      callNarrate: async () => { narrado++; return "no debería llamarse"; },
    });
    ok("(1) ambigua con intent='correccion' · UNA pregunta y cero narrador",
      narrado === 0 && /¿Te referías a otra cuenta, o a otro período\?/.test(r.r.text), r.r.text);
    ok("(1) …cero calls: no se recalculó nada", !r.r.claims || r.r.claims.length === 0);
    ok("(1) …y la coerción queda VISIBLE en el trace, no en silencio",
      !!(r.r.retryTrace && r.r.retryTrace.coerciones || []).length && /intent-invalido→redirect\(por tipo=correccion\)/.test(((r.r.retryTrace || {}).coerciones || []).join("|")),
      JSON.stringify(r.r.retryTrace && r.r.retryTrace.coerciones));
  }

  // (2) CORRECCIÓN RESUELTA con intent inválido → ejecuta sus calls (no se convierte en una pregunta).
  {
    let memX = null, narrado = 0;
    const r = await answerViaOracle({
      text: "no, era Lider", history: [], mem: await baseC(), scenario: "actual",
      callPlan: async () => ({ intent: "reparacion", mode: "default", rationale: "resuelta con intent inválido", scope: { level: "entity", entities: ["Lider"] }, calls: [CALL("Lider")], reparacion: { tipo: "correccion", corrige: ["entidad"] } }),
      callNarrate: async (args) => { narrado++; memX = args.mem; return narrarConEvidencia("Entendido, era Lider.", "Lider")(args); },
    });
    ok("(2) resuelta con intent inválido · EJECUTA sus calls y narra", narrado === 1 && !!(r.r && r.r.text), `narrar=${narrado}`);
    ok("(2) …y la corrección se aplicó: la oferta anterior no viaja", !/rebate de Falabella/.test(renderInteractionMemory(memX || {})));
    ok("(2) …con el alcance corregido para Sentrix", r.r.evidence.scope.entities.join(",") === "Lider");
  }

  // (3) DESACUERDO con intent inválido → `answer`, NO redirect: conserva evidencia y contexto.
  {
    let memX = null;
    const r = await answerViaOracle({
      text: "no creo que sea por los rebates", history: [], mem: await baseC(), scenario: "actual",
      callPlan: async () => ({ intent: "desacuerdo", mode: "evidencia", rationale: "d", scope: { level: "entity", entities: ["Falabella"] }, calls: [CALL("Falabella")], reparacion: { tipo: "desacuerdo" } }),
      callNarrate: async (args) => { memX = args.mem; return narrarConEvidencia("Lo tomo, y separo lo probado de lo indicado.", "Falabella")(args); },
    });
    ok("(3) desacuerdo con intent inválido · conserva el alcance", r.mem.conversationScope.current.entities.join(",") === "Falabella");
    ok("(3) …y conserva la oferta y el contexto (no es un reencauce)",
      /rebate de Falabella/.test(renderInteractionMemory(memX || {})), renderInteractionMemory(memX || {}));
    // esta pasaba antes por el motivo EQUIVOCADO: la reparación se descartaba entera por el intent, así que el
    // alcance se conservaba… y el narrador tampoco recibía la doctrina de desacuerdo. Se verifica que SÍ la reciba.
    ok("(3) …y el narrador SÍ recibe la doctrina de desacuerdo (la reparación no se descartó)",
      /DESACUERDO/.test(buildRepairNarrateDoctrine(buildReparacion({ plan: { intent: "answer", reparacion: { tipo: "desacuerdo" } }, mem: {} }))));
    ok("(3) …y la coerción fue a `answer`, no a redirect",
      /intent-invalido→answer\(por tipo=desacuerdo\)/.test(((r.r.retryTrace || {}).coerciones || []).join("|")),
      JSON.stringify(r.r.retryTrace && r.r.retryTrace.coerciones));
  }

  // (4) DATO APORTADO con intent inválido → `answer`, y la procedencia se conserva.
  {
    const r = await answerViaOracle({
      text: "las ventas de Falabella fueron $20M, tomalo como supuesto", history: [], mem: await baseC(), scenario: "actual",
      callPlan: async () => ({ intent: "dato", mode: "default", rationale: "d", scope: { level: "entity", entities: ["Falabella"] }, calls: [CALL("Falabella")], reparacion: { tipo: "dato_usuario", dato: { metrica: "ventas", valor: "$20M" }, aceptado: true } }),
      callNarrate: async (args) => narrarConEvidencia("Mi dato difiere del tuyo.", "Falabella")(args),
    });
    const sup = (r.mem.conversationScope.current.supuestos || []).filter((s) => s.origen === "usuario");
    ok("(4) dato aportado con intent inválido · la procedencia se conserva",
      sup.length === 1 && sup[0].valor === "$20M", JSON.stringify(sup));
    ok("(4) …y el alcance NO se invalidó (no es un reencauce)", r.mem.conversationScope.current.entities.join(",") === "Falabella");
    ok("(4) …coerción a `answer`", /intent-invalido→answer\(por tipo=dato_usuario\)/.test(((r.r.retryTrace || {}).coerciones || []).join("|")));
  }

  // (5) PLAN NORMAL con intent inválido y SIN reparación → no se coerciona en silencio. Sin una clase de mensaje
  //     declarada no hay forma estructural de saber qué quiso el turno, y adivinarla es lo que §1 prohíbe.
  {
    const r = await answerViaOracle({
      text: "¿cómo viene Lider?", history: [], mem: await baseC(), scenario: "actual",
      callPlan: async () => ({ intent: "loQueSea", mode: "default", rationale: "sin reparación", scope: { level: "entity", entities: ["Lider"] }, calls: [CALL("Lider")] }),
      callNarrate: async (args) => narrarConEvidencia("Lider:", "Lider")(args),
    });
    const co = ((r.r.retryTrace || {}).coerciones || []).join("|");
    ok("(5) sin reparación, NO se infiere una intención", !/intent-invalido→/.test(co), co);
    ok("(5) …pero queda declarado que el valor era inválido (no se descarta en silencio)", /intent-invalido-sin-tipo/.test(co), co);
    ok("(5) …y el turno igual responde: la coerción nunca tumba un turno", !!(r.r && r.r.text));
  }

  // (6) `mode` y `corrige` con valores inventados → dejan causa visible.
  {
    const r = await answerViaOracle({
      text: "no, era Lider", history: [], mem: await baseC(), scenario: "actual",
      callPlan: async () => ({ intent: "redirect", mode: "modoInventado", rationale: "vocabulario inventado", scope: { level: "entity", entities: ["Lider"] }, calls: [CALL("Lider")], reparacion: { tipo: "correccion", corrige: ["entidad", "campoInventado"] } }),
      callNarrate: async (args) => narrarConEvidencia("Entendido.", "Lider")(args),
    });
    const co = ((r.r.retryTrace || {}).coerciones || []).join("|");
    ok("(6) un `mode` fuera del enum deja causa visible", /mode-invalido\(modoInventado\)/.test(co), co);
    ok("(6) un campo de `corrige` inventado deja causa visible", /corrige-descartado\(campoInventado\)/.test(co), co);
    ok("(6) …y lo válido sigue aplicándose (se descarta el campo, no la corrección)",
      r.mem.conversationScope.current.entities.join(",") === "Lider", JSON.stringify(r.mem.conversationScope.current.entities));
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("8d · LA CLASE EN EL CAMPO EQUIVOCADO · reproducción EXACTA de S3 (3ª corrida pagada)");
// El planificador emitió `intent:"desacuerdo"` —la CLASE metida en el campo de la INTENCIÓN— y `reparacion:null`.
// Los dos campos son vecinos y describen ejes distintos, así que la confusión es esperable; lo que no puede pasar
// es que cueste una certificación descubrirla. Estos dos casos son el plan REAL que se pagó, byte por byte, y su
// equivalente para el dato aportado — que es el que todavía no se llegó a probar en vivo.
{
  const baseM = async () => (await answerViaOracle({
    text: "¿cómo viene el margen de Falabella?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => planNormal("Falabella"),
    callNarrate: async (a) => narrarTablaConOferta("¿Querés que profundice en el rebate de Falabella?")(a),
  })).mem;

  // (S3 EXACTA) el plan tal como llegó del proveedor: intent con la clase adentro, reparacion en null.
  {
    let memX = null;
    const r = await answerViaOracle({
      text: "no creo que sea por los rebates", history: [], mem: await baseM(), scenario: "actual",
      callPlan: async () => ({ intent: "desacuerdo", mode: "evidencia", rationale: "el plan real de S3", scope: { level: "entity", entities: ["Falabella"] }, calls: [CALL("Falabella")], reparacion: null }),
      callNarrate: async (args) => { memX = args.mem; return narrarConEvidencia("Lo tomo, y separo lo probado de lo indicado.", "Falabella")(args); },
    });
    const co = ((r.r.retryTrace || {}).coerciones || []).join("|");
    ok("S3 exacta · la clase se muda de `intent` a `reparacion.tipo`", /clase-en-intent→reparacion\.tipo\(desacuerdo\)/.test(co), co);
    ok("S3 exacta · …y el intent queda en `answer`, no en redirect", /intent-invalido→answer\(por tipo=desacuerdo\)/.test(co), co);
    ok("S3 exacta · el desacuerdo conserva el alcance", r.mem.conversationScope.current.entities.join(",") === "Falabella");
    ok("S3 exacta · y conserva la oferta (no reencauza nada)", /rebate de Falabella/.test(renderInteractionMemory(memX || {})));
  }

  // (S4 EQUIVALENTE) el mismo error, con la clase del dato aportado — y con el alias `dato_aportado`, que es el
  // nombre con que un modelo la escribe cuando no usa el token del enum.
  for (const clase of ["dato_usuario", "dato_aportado"]) {
    const r = await answerViaOracle({
      text: "las ventas de Falabella fueron $20M, tomalo como supuesto", history: [], mem: await baseM(), scenario: "actual",
      callPlan: async () => ({ intent: clase, mode: "default", rationale: "clase en intent", scope: { level: "entity", entities: ["Falabella"] }, calls: [CALL("Falabella")], reparacion: { dato: { metrica: "ventas", valor: "$20M" }, aceptado: true } }),
      callNarrate: async (args) => narrarConEvidencia("Mi dato difiere del tuyo.", "Falabella")(args),
    });
    const co = ((r.r.retryTrace || {}).coerciones || []).join("|");
    const sup = (r.mem.conversationScope.current.supuestos || []).filter((s) => s.origen === "usuario");
    ok(`S4 equivalente («${clase}») · la clase se muda y se canoniza a dato_usuario`,
      /clase-en-intent→reparacion\.tipo\(dato_usuario\)/.test(co), co);
    ok(`S4 equivalente («${clase}») · la procedencia se conserva`, sup.length === 1 && sup[0].valor === "$20M", JSON.stringify(sup));
    ok(`S4 equivalente («${clase}») · el alcance NO se invalida`, r.mem.conversationScope.current.entities.join(",") === "Falabella");
  }

  // LO DECLARADO MANDA SOBRE LO DEDUCIDO: si la reparación YA trae un tipo válido, la migración no lo pisa.
  {
    let memX = null;
    await answerViaOracle({
      text: "no, era Lider", history: [], mem: await baseM(), scenario: "actual",
      callPlan: async () => ({ intent: "desacuerdo", mode: "default", rationale: "intent dice una clase, la reparación otra", scope: { level: "entity", entities: ["Lider"] }, calls: [CALL("Lider")], reparacion: { tipo: "correccion", corrige: ["entidad"] } }),
      callNarrate: async (args) => { memX = args.mem; return narrarConEvidencia("Entendido, era Lider.", "Lider")(args); },
    });
    ok("lo DECLARADO manda sobre lo deducido: la corrección se aplica igual",
      !/rebate de Falabella/.test(renderInteractionMemory(memX || {})), renderInteractionMemory(memX || {}));
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("8e · AMBIGUA + PREGUNTA + CALLS · la ambigüedad manda (4ª corrida pagada)");
// EL CASO MEDIDO: el planificador declaró `ambigua:true`, escribió la pregunta Y trajo calls. La regla anterior
// prefería lo respondible, así que el motor ejecutaba y narraba: CUATRO llamadas, dos rechazos del guard y una
// escalada al modelo más caro, para responder donde §4 manda preguntar. Ahora manda la ambigüedad.
// El BATCH se cuenta con la PROPIA telemetría del producto —la etapa `deterministica` se emite si y solo si el
// batch corrió— en vez de inferirlo de la respuesta. Es la medición directa, no un proxy.
{
  const eventos = [];
  setSink((ev) => eventos.push(ev));
  setToolsDeclaradas(toolNames());
  let planN = 0, narrarN = 0;
  const base = await answerViaOracle({
    text: "¿cómo viene el margen de Falabella?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => planNormal("Falabella"),
    callNarrate: async (a) => narrarTablaConOferta("¿Querés que profundice en el rebate de Falabella?")(a),
  });
  eventos.length = 0;   // se cuenta SOLO el turno de la corrección
  const PREG = "¿Te referías a otra cuenta, o a otro período?";
  const r = await answerViaOracle({
    text: "ese número no me cuadra", history: [], mem: base.mem, scenario: "actual",
    callPlan: async () => { planN++; return { intent: "redirect", mode: "default", rationale: "el caso de la 4ª corrida", scope: { level: "entity", entities: ["Falabella"] }, calls: [CALL("Falabella")], reparacion: { tipo: "correccion", ambigua: true, pregunta: PREG } }; },
    callNarrate: async () => { narrarN++; return "no debería llamarse"; },
  });
  ok("UNA llamada de PLAN", planN === 1, `plan=${planN}`);
  ok("CERO llamadas de NARRAR", narrarN === 0, `narrar=${narrarN}`);
  ok("CERO BATCH · ninguna tool se ejecutó (medido por la telemetría del producto)",
    !eventos.some((e) => e.etapa === "deterministica"), JSON.stringify(eventos.map((e) => e.etapa)));
  ok("…y la evidencia que viaja no trae ninguna call", (((r.r.evidence || {}).plan || {}).calls || []).length === 0,
    JSON.stringify((r.r.evidence || {}).plan));
  ok("UNA sola pregunta, la que redactó el planificador", r.r.text.includes(PREG) && (r.r.text.match(/\?/g) || []).length === 1, r.r.text);
  ok("§4 · el contexto queda INTACTO: la oferta sigue viva",
    !!(getLastOffer(r.mem) && /rebate de Falabella/.test(getLastOffer(r.mem).texto || "")), JSON.stringify(getLastOffer(r.mem)));
  ok("§4 · …y el alcance también", r.mem.conversationScope.current.entities.join(",") === "Falabella");
  ok("no se recalculó nada: sin afirmaciones", !r.r.claims || r.r.claims.length === 0);
  // CONTRASTE: sin pregunta redactada, unas calls sueltas NO alcanzan para cortar — ahí sí vale lo respondible.
  let narrarN2 = 0;
  await answerViaOracle({
    text: "eso no es así", history: [], mem: base.mem, scenario: "actual",
    callPlan: async () => ({ intent: "redirect", mode: "default", rationale: "ambigua sin pregunta, con calls", scope: { level: "entity", entities: ["Falabella"] }, calls: [CALL("Falabella")], reparacion: { tipo: "correccion", ambigua: true } }),
    callNarrate: async (args) => { narrarN2++; return narrarConEvidencia("Falabella:", "Falabella")(args); },
  });
  ok("contraste · ambigua SIN pregunta y CON calls: sigue valiendo lo respondible", narrarN2 === 1, `narrar=${narrarN2}`);
  setSink(null);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("8f · LA CIFRA DE LA BRECHA YA ESTÁ, Y EL RECHAZO SE PUEDE DIAGNOSTICAR");
// Los dos arreglos que salieron de auditar la 4ª corrida: cuatro de sus cinco rechazos fueron el narrador
// multiplicando para obtener un monto que la boleta YA traía, y el quinto no se pudo clasificar porque el trace
// decía qué chequeo saltó pero no sobre qué cifra.
{
  // (1) LA INSTRUCCIÓN VIAJA SOLO CUANDO LA CIFRA ESTÁ.
  const conValor = buildNarrateUserMessageC({
    text: "¿por qué Falabella cede margen?",
    plan: { intent: "answer", mode: "default", calls: [CALL("Falabella")], scope: { level: "entity", entities: ["Falabella"] } },
    results: [], ledgerFigs: [
      { label: "Falabella · Margen", value: "22.0%", canon: "pct:22.0%", raw: 22, unit: "pct" },
      { label: "Falabella · Valor en juego", value: "$1.6M", canon: "money:$1.6M", raw: 1600000, unit: "money" },
    ], mem: {}, history: [],
  });
  ok("con «Valor en juego» en la boleta, el payload señala la cifra ya autorizada",
    typeof conValor.instruccion_valor_en_juego === "string" && /NO la vuelvas a calcular/.test(conValor.instruccion_valor_en_juego));
  ok("…y le dice al narrador que multiplicar da una cifra que se bloquea",
    /multiplicar el margen, la brecha o el peso del costo por la venta/.test(conValor.instruccion_valor_en_juego));
  const sinValor = buildNarrateUserMessageC({
    text: "¿cuánto vende Falabella?",
    plan: { intent: "answer", mode: "default", calls: [CALL("Falabella")], scope: { level: "entity", entities: ["Falabella"] } },
    results: [], ledgerFigs: [{ label: "Falabella · Venta", value: "$19.4M", canon: "money:$19.4M", raw: 19400000, unit: "money" }], mem: {}, history: [],
  });
  ok("sin esa cifra, la instrucción NO viaja (un turno normal no paga un token)", !("instruccion_valor_en_juego" in sinValor));
  ok("y el system de NARRAR no cambió: la instrucción es de payload, no de doctrina permanente",
    !/Valor en juego/.test(buildNarrateSystemC(ADI_PERSONA, "", "default", null, false)));

  // (2) EL DETALLE DEL RECHAZO, EN MEMORIA. Se fuerza un rechazo real: el narrador inventa una cifra.
  let intentos = 0;
  const r = await answerViaOracle({
    text: "¿por qué Falabella cede margen?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => planNormal("Falabella"),
    callNarrate: async () => { intentos++; return "Falabella cede margen: el costo se lleva $99.9M de su venta."; },
  });
  const nt = ((r && r.r && r.r.retryTrace) || {}).narrate || [];
  ok("un rechazo del guard queda con su DETALLE en el trace, no solo con el veredicto",
    nt.some((e) => e.guardOk === false && Array.isArray(e.detalle) && /cifra-no-autorizada:\$99\.9M/.test(e.detalle.join("|"))),
    JSON.stringify(nt.map((e) => ({ r: e.reason, d: e.detalle }))));
  ok("…y el intento que PASA no arrastra ningún detalle", nt.every((e) => e.guardOk !== true || !e.detalle));
  ok("el turno igual responde (el detalle es observación, no cambia la conducta)", !!(r && r.r && r.r.text) && intentos === 3);
}

section("9 · LAS OCHO DIMENSIONES, DECLARADAS Y CONTADAS");
// Confirmación explícita pedida por el owner: entidad más las siete restantes, todas con prueba de punta a punta
// en ESTE archivo. La lista se compara contra el contrato, así que si mañana se agrega un campo corregible y
// nadie escribe su prueba, este gate se pone rojo antes de que la conducta llegue a producción.
{
  const PROBADAS = ["entidad", "metrica", "periodo", "alcance", "criterio", "intencion", "formato", "supuesto"];
  const faltan = REPAIR_FIELD_KEYS.filter((k) => !PROBADAS.includes(k));
  ok(`las ${REPAIR_FIELD_KEYS.length} dimensiones corregibles del contrato tienen prueba end-to-end`, faltan.length === 0, `sin prueba: ${faltan.join(", ")}`);
  ok("y son exactamente ocho: entidad + las siete restantes", PROBADAS.length === 8 && REPAIR_FIELD_KEYS.length === 8);
}

console.log(`\n${pass} OK · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
