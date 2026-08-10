/* === _lastoffer_recentsubjects_derived_gate.mjs · Etapa 4/5 · lastOffer/recentSubjects como vistas derivadas ===
 * LOCAL, NO commiteado (convención del repo: _*_gate.mjs es local). CERO red, CERO LLM: ejercita
 * dialogueState.js:getLastOffer/getRecentSubjects (funciones puras) y answerViaOracle.js de punta a punta con
 * callPlan/callNarrate MOCKEADOS a mano (mismo patrón que _dialogue_state_gate.mjs/_conversation_continuity_
 * universal_gate.mjs — el BATCH corre REAL contra el dataset demo, nunca se mockea).
 *
 * Cubre lo que el diseño de Etapa 4 pedía verificar, específico de ESTA migración (no repite la cobertura ya
 * verde de _dialogue_state_gate.mjs/_vague_offer_gate.mjs/_recentsubjects_filters_gate.mjs — todos siguen en
 * verde byte a byte, ver el informe de la etapa):
 *   1. getLastOffer/getRecentSubjects — precedencia (conversationScope primero, mem.<campo> plano como fallback
 *      para fixtures viejos) y el caso más común: SIN conversationScope, el fallback es el ÚNICO camino.
 *   2. dual-write real end-a-end: tras un turno que deja una oferta activa, mem.lastOffer y
 *      mem.conversationScope.current.ofertaPendiente son EXACTAMENTE el mismo objeto (nunca 2 fuentes que puedan
 *      divergir con el tiempo).
 *   3. EL RIESGO REAL que este diseño identificó y cerró (no estaba en el plan original, encontrado auditando el
 *      código real): un bypass que limpia mem.lastOffer=null (criteriaIntent, aceptación huérfana, oferta vaga,
 *      etc.) DEBE limpiar TAMBIÉN conversationScope.current.ofertaPendiente — si no, un "sí" 2 turnos después
 *      resucitaría una oferta ya invalidada (fromScope gana por precedencia sobre el shim). Sección 3 reproduce
 *      el escenario exacto y confirma — con git stash del fix — que el bug es REAL sin el sync, no hipotético.
 *   4. recentSubjects: dual-write real (mem.recentSubjects === mem.conversationScope.recentSubjects, mismo
 *      contenido) y que el shim de compatibilidad (mem sin conversationScope) sigue funcionando end-a-end.
 *   5. persona.js:renderInteractionMemory produce el MISMO string ya sea que la memoria venga por el camino
 *      canónico o por el shim legacy — la migración es invisible para el prompt.
 */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { getLastOffer, getRecentSubjects } from "./src/adi/oracle/dialogueState.js";
import { renderInteractionMemory } from "./src/adi/oracle/persona.js";

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  OK  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`); }
}
function section(title) { console.log(`\n== ${title} ==`); }

// llamada REAL segura (mismo call ya probado seguro por _dialogue_state_gate.mjs contra el dataset real).
const SAFE_CALL = { tool: "marginRead", args: { dimension: "cliente", focus: "bajo_benchmark" } };
const mkPlan = (entidad) => ({ intent: "answer", scope: { level: "entity", entities: [entidad] }, calls: [{ ...SAFE_CALL }] });

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("1 · getLastOffer/getRecentSubjects — funciones puras (precedencia + fallback)");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  ok("getLastOffer(null/undefined) → null, no crashea", getLastOffer(null) === null && getLastOffer(undefined) === null);
  ok("getRecentSubjects(null/undefined) → [], no crashea", Array.isArray(getRecentSubjects(null)) && getRecentSubjects(null).length === 0);

  // SIN conversationScope — el shim es el ÚNICO camino (el caso de los ~13-20 fixtures de gate viejos).
  const memShimOnly = { lastOffer: { texto: "¿Seguimos?", entidad: "Acme", tool: "marginRead", args: {} }, recentSubjects: [{ entidad: "Acme" }] };
  ok("SIN conversationScope: getLastOffer cae al shim mem.lastOffer", getLastOffer(memShimOnly) === memShimOnly.lastOffer);
  ok("SIN conversationScope: getRecentSubjects cae al shim mem.recentSubjects", getRecentSubjects(memShimOnly) === memShimOnly.recentSubjects);

  // conversationScope PRESENTE pero sin ofertaPendiente/recentSubjects poblados (ej. escrito por otra etapa que
  // no tocaba estos 2 campos, como pnl.js) — sigue cayendo al shim, nunca null/[] espurio.
  const memScopeSinOferta = {
    lastOffer: { texto: "¿Vemos el detalle?", entidad: "Acme", tool: null, args: null },
    conversationScope: { version: 1, current: { dimension: "cliente", entities: ["Acme"], ofertaPendiente: null }, history: [] },
  };
  ok("conversationScope SIN ofertaPendiente → cae al shim mem.lastOffer", getLastOffer(memScopeSinOferta) === memScopeSinOferta.lastOffer);
  const memScopeSinRecent = { recentSubjects: [{ entidad: "X" }], conversationScope: { version: 1, current: null, history: [] } };
  ok("conversationScope SIN recentSubjects (key ausente) → cae al shim mem.recentSubjects", getRecentSubjects(memScopeSinRecent) === memScopeSinRecent.recentSubjects);

  // conversationScope CON valor canónico → gana, incluso si el shim trae algo DISTINTO (precedencia real, no
  // solo "el shim está vacío") — este es el caso de producción real tras el dual-write.
  const oferta = { texto: "¿Profundizamos en el desglose?", entidad: "Acme", tool: "marginRead", args: {} };
  const memAmbos = {
    lastOffer: { texto: "OFERTA VIEJA STALE", entidad: "Otro", tool: null, args: null },
    conversationScope: { version: 1, current: { dimension: "cliente", entities: ["Acme"], ofertaPendiente: oferta }, history: [] },
  };
  ok("conversationScope CON ofertaPendiente → gana sobre un shim DISTINTO (precedencia real)", getLastOffer(memAmbos) === oferta);

  const rs = [{ entidad: "Acme" }, { entidad: "Otro" }];
  const memAmbosRS = { recentSubjects: [{ entidad: "STALE" }], conversationScope: { version: 1, current: null, history: [], recentSubjects: rs } };
  ok("conversationScope CON recentSubjects → gana sobre un shim DISTINTO", getRecentSubjects(memAmbosRS) === rs);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("2 · dual-write end-a-end vía answerViaOracle — lastOffer y conversationScope.current.ofertaPendiente SIEMPRE de acuerdo");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const callPlan1 = async () => mkPlan("ClienteDual1");
  const callNarrate1 = async () => "Este cliente está por debajo del objetivo de margen.\n\n[[SIGUIENTE_PASO]]\n¿Querés que profundice en el porqué?";
  const r1 = await answerViaOracle({ text: "¿cómo viene el margen de los clientes bajo benchmark?", history: [], mem: {}, scenario: "actual", callPlan: callPlan1, callNarrate: callNarrate1 });
  ok("turno 1 deja mem.lastOffer poblado", !!(r1 && r1.mem.lastOffer && r1.mem.lastOffer.texto));
  const scopeOferta1 = r1 && r1.mem.conversationScope && r1.mem.conversationScope.current && r1.mem.conversationScope.current.ofertaPendiente;
  ok("turno 1: conversationScope.current.ofertaPendiente === mem.lastOffer (MISMO objeto, dual-write real)",
    !!scopeOferta1 && scopeOferta1 === r1.mem.lastOffer, JSON.stringify({ shim: r1 && r1.mem.lastOffer, scope: scopeOferta1 }));
  ok("turno 1: getLastOffer(mem) coincide con ambos caminos", getLastOffer(r1.mem) === r1.mem.lastOffer);

  // recentSubjects: mismo criterio, ya calculado ANTES de narrar (a diferencia de ofertaPendiente).
  const rsShim1 = r1.mem.recentSubjects;
  const rsScope1 = r1.mem.conversationScope && r1.mem.conversationScope.recentSubjects;
  ok("turno 1: conversationScope.recentSubjects === mem.recentSubjects (dual-write real)",
    Array.isArray(rsScope1) && JSON.stringify(rsScope1) === JSON.stringify(rsShim1) && rsScope1 === rsShim1, JSON.stringify({ shim: rsShim1, scope: rsScope1 }));

  // turno 2 · "sí" — ejecuta EXACTAMENTE lo ofrecido (mismo comportamiento que antes de la migración, ver
  // _dialogue_state_gate.mjs 2a) — reconfirma que el camino de LECTURA (priorOffer = getLastOffer(mem)) sigue
  // resolviendo bien con el mem real que devuelve un turno completo (no un fixture a mano).
  let planCalledT2 = false, narratePlanSpyT2 = null;
  const r2 = await answerViaOracle({
    text: "sí", history: [], mem: r1.mem, scenario: "actual",
    callPlan: async () => { planCalledT2 = true; return { intent: "answer", calls: [] }; },
    callNarrate: async ({ plan }) => { narratePlanSpyT2 = plan; return "Acá va el detalle adicional que pediste."; },
  });
  ok("turno 2 ('sí'): PLAN NUNCA se invoca (aceptación estructurada bypasea)", planCalledT2 === false);
  ok("turno 2: re-ejecuta EXACTAMENTE tool+args de la oferta del turno 1",
    !!narratePlanSpyT2 && narratePlanSpyT2.calls[0].tool === "marginRead" && JSON.stringify(narratePlanSpyT2.calls[0].args) === JSON.stringify(SAFE_CALL.args));

  // turno 2: la oferta FRESCA de este turno también queda sincronizada.
  const scopeOferta2 = r2 && r2.mem.conversationScope && r2.mem.conversationScope.current && r2.mem.conversationScope.current.ofertaPendiente;
  ok("turno 2: la nueva oferta (o null) también queda sincronizada en conversationScope", scopeOferta2 === (r2 && r2.mem.lastOffer));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("3 · EL RIESGO REAL — un bypass que limpia lastOffer=null DEBE limpiar conversationScope.ofertaPendiente también");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Sin este sync, un "sí" 2 turnos después de un bypass resucitaría una oferta YA invalidada (fromScope gana por
// precedencia sobre el shim mem.lastOffer=null) — la propia razón de ser de withOfertaPendiente en los bypasses.
{
  // turno 1: deja una oferta activa con tool+args (mismo patrón de la sección 2).
  const r1 = await answerViaOracle({
    text: "¿cómo viene el margen de los clientes bajo benchmark?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => mkPlan("ClienteRiesgo1"),
    callNarrate: async () => "Este cliente está por debajo del objetivo de margen.\n\n[[SIGUIENTE_PASO]]\n¿Querés que profundice en el porqué?",
  });
  ok("[riesgo] turno 1 deja una oferta activa con tool+args", !!(r1 && r1.mem.lastOffer && r1.mem.lastOffer.tool === "marginRead"));

  // turno 2: dispara el bypass de criteriaIntent ("recordá que...") — NUNCA llega a PLAN/NARRAR, limpia
  // mem.lastOffer=null por diseño (ver el comentario de _composedBypassResult/criteriaIntent en answerViaOracle.js).
  let planCalledT2 = false;
  const r2 = await answerViaOracle({
    text: "recordá que mi margen mínimo es 25%", history: [], mem: r1.mem, scenario: "actual",
    callPlan: async () => { planCalledT2 = true; return { intent: "answer", calls: [] }; },
    callNarrate: async () => { throw new Error("NUNCA debería narrar — criteriaIntent bypasea antes"); },
  });
  ok("[riesgo] turno 2 (criteria) bypasea PLAN/NARRAR por completo", !!r2 && planCalledT2 === false);
  ok("[riesgo] turno 2: mem.lastOffer queda null (shim limpio, comportamiento preexistente)", r2 && r2.mem.lastOffer === null);
  const scopeOferta2 = r2 && r2.mem.conversationScope && r2.mem.conversationScope.current && r2.mem.conversationScope.current.ofertaPendiente;
  ok("[riesgo] turno 2: conversationScope.current.ofertaPendiente TAMBIÉN queda null (EL FIX — sin esto, quedaría stale con la oferta del turno 1)",
    scopeOferta2 === null, `obtuvo ${JSON.stringify(scopeOferta2)}`);

  // turno 3: "sí" — SIN oferta real activa, debe caer en ACEPTACIÓN HUÉRFANA (composeOrphanAcceptance), NUNCA
  // re-ejecutar la oferta stale del turno 1 (marginRead sobre ClienteRiesgo1).
  let planCalledT3 = false, narrateCalledT3 = false;
  const r3 = await answerViaOracle({
    text: "sí", history: [], mem: r2.mem, scenario: "actual",
    callPlan: async () => { planCalledT3 = true; return { intent: "answer", calls: [] }; },
    callNarrate: async () => { narrateCalledT3 = true; return "esto no debería usarse"; },
  });
  ok("[riesgo] turno 3 ('sí' sin oferta real): PLAN NUNCA se invoca (bypass de aceptación huérfana, no de ejecución estructurada)", planCalledT3 === false);
  ok("[riesgo] turno 3: NARRAR NUNCA se invoca", narrateCalledT3 === false);
  ok("[riesgo] turno 3: el texto es la ACEPTACIÓN HUÉRFANA honesta, NUNCA la re-ejecución de la oferta stale del turno 1",
    !!r3 && /no tengo (una oferta pendiente|un contexto previo)/i.test(r3.r.text), r3 && r3.r.text);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("4 · compatibilidad hacia atrás — fixtures viejos SIN conversationScope siguen funcionando end-a-end");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  // mem armado A MANO, mismo patrón que ~13-20 fixtures de gate existentes: SOLO mem.lastOffer, sin
  // conversationScope en absoluto — el turno 2 ("sí") debe seguir ejecutando exactamente lo ofrecido.
  const memViejo = { lastOffer: { texto: "¿Profundizamos?", entidad: "ClienteViejo", tool: "marginRead", args: { ...SAFE_CALL.args } } };
  let narratePlanSpy = null;
  const r = await answerViaOracle({
    text: "sí", history: [], mem: memViejo, scenario: "actual",
    callPlan: async () => { throw new Error("NUNCA debería llamar a PLAN"); },
    callNarrate: async ({ plan }) => { narratePlanSpy = plan; return "Acá va el detalle."; },
  });
  ok("fixture viejo (SOLO mem.lastOffer, sin conversationScope): 'sí' sigue ejecutando la oferta estructurada",
    !!narratePlanSpy && narratePlanSpy.calls[0].tool === "marginRead" && narratePlanSpy.scope.entities[0] === "ClienteViejo");
  ok("el resultado SIGUE poblando conversationScope de acá en adelante (turno arranca a construir el lado canónico)",
    !!(r && r.mem.conversationScope));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("5 · persona.js:renderInteractionMemory — MISMO string por el camino canónico o por el shim legacy");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const oferta = { texto: "¿Querés que profundice en el desglose?", entidad: "Acme" };
  const recientes = [{ entidad: "Acme" }, { entidad: "Otro" }];

  const memLegacy = { lastOffer: oferta, recentSubjects: recientes };
  const memCanonico = { conversationScope: { version: 1, current: { dimension: "cliente", entities: ["Acme"], ofertaPendiente: oferta }, history: [], recentSubjects: recientes } };

  const outLegacy = renderInteractionMemory(memLegacy);
  const outCanonico = renderInteractionMemory(memCanonico);
  ok("renderInteractionMemory: el bloque de 'última oferta' es IDÉNTICO por ambos caminos",
    outLegacy.includes(`"${oferta.texto}"`) && outCanonico.includes(`"${oferta.texto}"`));
  ok("renderInteractionMemory: el bloque de 'temas recientes' es IDÉNTICO por ambos caminos",
    outLegacy.includes("Acme, Otro") && outCanonico.includes("Acme, Otro"));

  // mem vacío → "" (sin ruido), sin cambios respecto al comportamiento preexistente.
  ok("renderInteractionMemory({}) === '' (sin ruido, sin conversationScope ni shim)", renderInteractionMemory({}) === "");
}

console.log(`\n── _lastoffer_recentsubjects_derived_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
