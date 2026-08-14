/* === _dialogue_state_gate.mjs · ARQUITECTURA C · GATE DE FASE 3 "ORIENTACIÓN INICIAL MID-CONVERSACIÓN" ===
 * owner 2026-07-30: "Agrega gates multiturno para: 'sí' ejecutando exactamente la oferta estructurada; oferta
 * invalidada tras cambio de tema; rechazo y reemplazo de oferta; retorno a uno de los temas recientes; estado
 * persistido sin imponerse sobre lo que el usuario acaba de pedir; orientación útil y grounded; repetición
 * detectada sin bloquear falsos positivos." Los 7 escenarios, en ese orden, en la sección 2 de abajo.
 *
 * owner 2026-07-31 (cierre de #48, antes de subir a main), 2 casos MÁS, ahora determinísticos por construcción
 * (no dependientes del juicio del LLM como se dejó originalmente):
 *   3) ACEPTACIÓN HUÉRFANA — "sí"/"dale" SIN mem.lastOffer activa: nunca repite la respuesta anterior, pide
 *      precisión breve o muestra las opciones vigentes (recentSubjects). Medido en vivo que dejarlo al narrador
 *      producía una respuesta casi idéntica a la anterior — ver adi-fase3-orientacion-inicial.md.
 *   4) RETORNO A TEMAS RECIENTES — referencia POSICIONAL (no por nombre): "volvamos a lo anterior" → el sujeto
 *      inmediatamente anterior (recentSubjects[0]); "volvamos al primer tema" → el más viejo trackeado (último
 *      índice); ambigüedad genuina (2+ candidatos, sin apuntar posición) → pregunta cuál, nunca adivina.
 *
 * 0) DETERMINÍSTICO puro — funciones de dialogueState.js sin LLM ni motor (isAcceptance/extractOffer/
 *    updateRecentSubjects/needsOrientacion/buildOrientacionInstruction/composeOrphanAcceptance/stripAllMarks (narrationBlocks.js)/
 *    resolveSubjectRecall/composeSubjectAmbiguity).
 * 1) DETERMINÍSTICO — guardC._repetitionAdvisory vía fixtures fijos (mismo estilo que
 *    _oracle_mechanism_memory_gate.mjs sección 1).
 * 2) DETERMINÍSTICO end-to-end — answerViaOracle con callPlan/callNarrate MOCKEADOS (mismo patrón que
 *    _oracle_mechanism_memory_gate.mjs sección 2: runPlan NO está inyectado, corre contra el dataset real, así
 *    que los calls usados acá son los YA probados seguros por ese gate — marginRead/dimension=cliente/
 *    focus=bajo_benchmark — y los textos de narración son deliberadamente genéricos (sin cifras ni nombres de
 *    entidad reales) para no rozar los violations duros de guardC, que no son lo que este gate certifica).
 * 3) ACEPTACIÓN HUÉRFANA end-to-end — igual que 2, pero el bypass NUNCA invoca a callPlan/callNarrate (garantía
 *    por construcción: se prueba con espías que lanzan si se llaman, igual que data_only/results_only).
 * 4) RETORNO A TEMAS RECIENTES end-to-end — resuelto (bypasea PLAN, corre BATCH+NARRAR reales) y ambiguo (bypasea
 *    todo, igual que la sección 3).
 *
 * Lo que este gate NO puede certificar (queda dependiente del juicio del LLM, no de esta red determinística):
 * que el LLM real, sin mockear, efectivamente resuelva "volvamos a lo de X" (con NOMBRE, no posición) usando
 * recentSubjects, o que sus ofertas de seguimiento real lleguen redactadas de forma natural — eso es litigio de
 * calidad de prompt, no de cableado, y se verifica en vivo (ver paso de verificación posterior a este gate).
 *
 * @inyeccion-simulada — este gate le pasa a `answerViaOracle` sus DOS pasadas (PLAN y NARRAR) como funciones
 * locales definidas en este mismo archivo. No importa el gateway ni un adapter, no importa nada de `src/ui/`
 * (donde viven las únicas implementaciones reales de esas dos funciones) y no contiene una salida cruda. Cumple
 * las cuatro condiciones del escape declarado en scripts/gates-offline.mjs, que las verifica una por una en vez
 * de creerle a esta línea. Sin esto el gate quedaba clasificado LIVE y NUNCA corría: una garantía que hay que
 * acordarse de invocar a mano no es una garantía.
 */
import { guardC } from "./src/adi/oracle/guardC.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { isAcceptance, extractOffer, updateRecentSubjects, needsOrientacion, buildOrientacionInstruction, composeOrphanAcceptance, resolveSubjectRecall, composeSubjectAmbiguity } from "./src/adi/oracle/dialogueState.js";
import { stripAllMarks } from "./src/adi/oracle/narrationBlocks.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

// llamada REAL segura (misma exacta que _oracle_mechanism_memory_gate.mjs ya probó contra el dataset real, sin
// asumir nombres de entidad — acá tampoco los necesitamos: los textos de narración nunca mencionan una entidad).
const SAFE_CALL = { tool: "marginRead", args: { dimension: "cliente", focus: "bajo_benchmark" } };
const mkPlan = (entidad) => ({ intent: "answer", scope: { level: "entity", entities: [entidad] }, calls: [{ ...SAFE_CALL }] });

console.log("── 0 · DETERMINÍSTICO — funciones puras de dialogueState.js (sin LLM, sin motor) ──");
{
  ok(isAcceptance("sí"), 'isAcceptance("sí") === true');
  ok(isAcceptance("Sí."), 'isAcceptance("Sí.") === true (mayúscula + punto)');
  ok(isAcceptance("dale"), 'isAcceptance("dale") === true');
  ok(isAcceptance("  ok  "), 'isAcceptance("  ok  ") === true (espacios)');
  ok(isAcceptance("de acuerdo"), 'isAcceptance("de acuerdo") === true');
  ok(!isAcceptance("no, gracias"), 'isAcceptance("no, gracias") === false');
  ok(!isAcceptance("sí, pero primero decime x"), 'isAcceptance("sí, pero...") === false (no es aceptación pura)');
  ok(!isAcceptance("no sé"), 'isAcceptance("no sé") === false');
  ok(!isAcceptance(""), 'isAcceptance("") === false');

  const FULL = { contentScope: "full", detailLevel: "standard" };
  const DATA_ONLY = { contentScope: "data_only", detailLevel: "standard" };
  const PLAN_ENT = { scope: { level: "entity", entities: ["Acme"] } };
  const CALL1 = [{ tool: "marginRead", args: { dimension: "cliente" } }];

  ok(extractOffer("¿Profundizamos?", { plan: PLAN_ENT, calls: CALL1, pref: null }) === null, "extractOffer sin pref → null");
  ok(extractOffer("[[SIGUIENTE_PASO]]\n¿Profundizamos?", { plan: PLAN_ENT, calls: CALL1, pref: DATA_ONLY }) === null, "extractOffer bajo data_only → null (data_only nunca ofrece seguimiento)");

  const off1 = extractOffer("Texto libre.\n\n[[SIGUIENTE_PASO]]\n¿Querés que profundice en el desglose por cliente?", { plan: PLAN_ENT, calls: CALL1, pref: FULL, turno: 4 });
  ok(off1 && off1.texto === "¿Querés que profundice en el desglose por cliente?", `oferta ESTRUCTURADA usa la oración marcada tal cual — obtuvo "${off1 && off1.texto}"`);
  ok(off1 && off1.entidad === "Acme", "extractOffer deriva entidad de plan.scope.entities[0]");
  ok(off1 && off1.tool === "marginRead" && JSON.stringify(off1.args) === JSON.stringify(CALL1[0].args), "oferta de CONTINUACIÓN (1 sola call + 'desglose') deriva tool+args ejecutables");

  const off2 = extractOffer("[[SIGUIENTE_PASO]]\n¿Querés que revisemos también otro segmento distinto?", { plan: PLAN_ENT, calls: CALL1, pref: FULL });
  ok(off2 && off2.tool === null && off2.args === null, "oferta de ÁNGULO NUEVO (no matchea continuación) deja tool/args en null — no finge precisión que no existe");

  const off3 = extractOffer("Cierro con una pregunta sin marca. ¿Seguimos la próxima con esto?", { plan: PLAN_ENT, calls: CALL1, pref: FULL });
  ok(off3 && off3.texto === "¿Seguimos la próxima con esto?", "sin marca, fallback a la última '¿...?' del texto");

  ok(extractOffer("Sin preguntas ni marca.", { plan: PLAN_ENT, calls: CALL1, pref: FULL }) === null, "sin marca y sin pregunta → null (no inventa una oferta)");

  const off4 = extractOffer("[[SIGUIENTE_PASO]]\n¿Profundizamos en el detalle?", { plan: PLAN_ENT, calls: [CALL1[0], CALL1[0]], pref: FULL });
  ok(off4 && off4.tool === null, "2+ calls este turno → tool/args en null aunque el texto sea 'continuación' (no es seguro asumir CUÁL call repetir)");

  ok(stripAllMarks("Texto.\n\n[[SIGUIENTE_PASO]]\n¿Seguimos?") === "Texto.\n\n¿Seguimos?", "stripAllMarks saca [[SIGUIENTE_PASO]], preserva el resto");
  ok(stripAllMarks("Texto sin marca.") === "Texto sin marca.", "stripAllMarks es no-op si no hay ninguna marca");
  // REGRESIÓN — hallazgo EN VIVO (owner 2026-07-31, certificación integral): bajo contentScope="full" (turno
  // normal, sin instruccion_formato) el narrador real igual emitió "[[ACCION]] Renegociá primero con Falabella..."
  // en un resumen ejecutivo — reproducido, no hipotético. stripAllMarks debe sacar CUALQUIERA de los 4 tokens.
  ok(stripAllMarks("Texto.\n\n[[ACCION]] Renegociá con Falabella.") === "Texto.\n\nRenegociá con Falabella.", "REGRESIÓN: stripAllMarks también saca [[ACCION]] filtrado en un turno full (el bug real cazado en vivo)");
  ok(stripAllMarks("[[DATOS]] Ventas $19.4M.\n\n[[INTERPRETACION]] Va bien.\n\n[[ACCION]] Seguí así.") === "Ventas $19.4M.\n\nVa bien.\n\nSeguí así.", "stripAllMarks saca los 4 tipos de marca en un solo texto, en cualquier orden");

  let subj = updateRecentSubjects([], { scope: { level: "entity", entities: ["A"] } }, [], 1);
  subj = updateRecentSubjects(subj, { scope: { level: "entity", entities: ["B"] } }, [], 2);
  subj = updateRecentSubjects(subj, { scope: { level: "entity", entities: ["C"] } }, [], 3);
  ok(JSON.stringify(subj.map((s) => s.entidad)) === JSON.stringify(["C", "B", "A"]), `updateRecentSubjects: más reciente primero — obtuvo ${JSON.stringify(subj.map((s) => s.entidad))}`);
  subj = updateRecentSubjects(subj, { scope: { level: "entity", entities: ["D"] } }, [], 4);
  ok(subj.length === 3 && !subj.some((s) => s.entidad === "A"), "updateRecentSubjects: tope 3, descarta el más viejo (memoria NO ilimitada)");
  subj = updateRecentSubjects(subj, { scope: { level: "entity", entities: ["C"] } }, [], 5);
  ok(subj[0].entidad === "C" && subj.filter((s) => s.entidad === "C").length === 1, "updateRecentSubjects: retomar un tema YA visto lo reordena, no lo duplica");
  const subjGlobal = updateRecentSubjects(subj, { scope: { level: "global" } }, [], 6);
  ok(JSON.stringify(subjGlobal) === JSON.stringify(subj), "updateRecentSubjects: scope global (sin entidad puntual) no altera la lista");

  ok(needsOrientacion("no sé qué más preguntar", 0) === "pedido_explicito", "needsOrientacion: pedido explícito detectado");
  ok(needsOrientacion("¿por dónde sigo?", 0) === "pedido_explicito", 'needsOrientacion: "por dónde sigo" detectado');
  ok(needsOrientacion("¿cuál es el margen de Acme?", 2) === null, "needsOrientacion: pregunta normal + clarifyStreak bajo → null");
  ok(needsOrientacion("¿cuál es el margen de Acme?", 3) === "confusion_persistente", "needsOrientacion: clarifyStreak>=3 sin frase explícita → confusion_persistente");
  ok(needsOrientacion("x", undefined) === null, "needsOrientacion: sin clarifyStreak numérico → null, no crashea");

  ok(buildOrientacionInstruction(null, []) === null, "buildOrientacionInstruction: sin razón → null");
  const instrSinTemas = buildOrientacionInstruction("pedido_explicito", []);
  ok(typeof instrSinTemas === "string" && instrSinTemas.length > 0, "buildOrientacionInstruction: sin temas recientes, igual devuelve instrucción usable");
  const instrConTemas = buildOrientacionInstruction("pedido_explicito", [{ entidad: "Acme" }, { entidad: "Beta" }]);
  ok(/Acme/.test(instrConTemas) && /Beta/.test(instrConTemas), "buildOrientacionInstruction: referencia los temas recientes reales cuando existen");
  ok(/en qué más te puedo ayudar/i.test(instrConTemas), "buildOrientacionInstruction: prohíbe explícitamente el cierre vacío tipo '¿en qué más te ayudo?'");

  ok(!/qu[ié]?[eé]n\s+sabe|no\s+s[eé]/i.test(composeOrphanAcceptance([])), "composeOrphanAcceptance sin temas: nunca un 'no sé' seco (pide contexto activamente)");
  const orphanConTemas = composeOrphanAcceptance([{ entidad: "Acme" }, { entidad: "Beta" }]);
  ok(/Acme/.test(orphanConTemas) && /Beta/.test(orphanConTemas), "composeOrphanAcceptance con temas: los ofrece como opciones concretas, no genérico");
  ok(!/^(?:s[ií]|dale|ok)/i.test(orphanConTemas), "composeOrphanAcceptance NUNCA repite/confirma la aceptación como si supiera a qué — pregunta");

  const REC = [{ entidad: "A", dimension: "cliente" }, { entidad: "B", dimension: "sku" }, { entidad: "C", dimension: "cliente" }];
  ok(resolveSubjectRecall("volvamos a lo anterior", REC).kind === "resolved" && resolveSubjectRecall("volvamos a lo anterior", REC).subject.entidad === "A", 'resolveSubjectRecall: "volvamos a lo anterior" → el MÁS RECIENTE (index 0)');
  ok(resolveSubjectRecall("el tema anterior, por favor", REC).subject.entidad === "A", 'resolveSubjectRecall: "el tema anterior" también resuelve a index 0');
  ok(resolveSubjectRecall("volvamos al primer tema", REC).kind === "resolved" && resolveSubjectRecall("volvamos al primer tema", REC).subject.entidad === "C", 'resolveSubjectRecall: "el primer tema" → el MÁS VIEJO trackeado (último índice)');
  ok(resolveSubjectRecall("con lo que empezamos", REC).subject.entidad === "C", 'resolveSubjectRecall: "con lo que empezamos" también resuelve al más viejo');
  const ambig = resolveSubjectRecall("volvamos a un tema anterior", REC);
  ok(ambig && ambig.kind === "ambiguous" && ambig.options.length === 3, "resolveSubjectRecall: referencia GENÉRICA (sin posición) con 2+ candidatos → ambiguo, nunca adivina");
  ok(resolveSubjectRecall("volvamos a un tema anterior", [{ entidad: "A" }]) === null, "resolveSubjectRecall: genérica con SOLO 1 candidato → no hay ambigüedad real, deja pasar a PLAN normal");
  ok(resolveSubjectRecall("volvamos a lo anterior", []) === null, "resolveSubjectRecall: sin recentSubjects → null, no crashea");
  ok(resolveSubjectRecall("¿cómo viene Falabella?", REC) === null, "resolveSubjectRecall: texto sin referencia de retorno → null (no secuestra un turno normal)");

  const ambiguityMsg = composeSubjectAmbiguity(REC);
  ok(/A/.test(ambiguityMsg) && /B/.test(ambiguityMsg) && /C/.test(ambiguityMsg) && /\?/.test(ambiguityMsg), "composeSubjectAmbiguity: lista las opciones reales y cierra preguntando cuál");
}

console.log("\n── 1 · DETERMINÍSTICO — guardC + _repetitionAdvisory (aviso puro, nunca bloquea) ──");
{
  const textoBase = "El desempeño general del negocio se mantiene estable este período, sin cambios relevantes que reportar en el panorama actual.";
  const g1 = guardC(textoBase, { ledger: { figs: [] }, results: [], trace: null, question: "", recentNarrations: [textoBase] });
  ok(g1.ok, "repetición 100% → el turno SIGUE pasando el guard (ok=true)");
  ok(g1.advisories.some((a) => a.kind === "repeticion"), "repetición 100% → SÍ dispara el aviso");

  const textoDistinto = "Ahora te comento un tema completamente distinto, sin relación textual con lo anterior en absoluto.";
  const g2 = guardC(textoDistinto, { ledger: { figs: [] }, results: [], trace: null, question: "", recentNarrations: [textoBase] });
  ok(!g2.advisories.some((a) => a.kind === "repeticion"), "texto genuinamente distinto → NO dispara el aviso (sin falsos positivos)");

  const g3 = guardC(textoBase, { ledger: { figs: [] }, results: [], trace: null, question: "" });
  ok(g3.ok && !g3.advisories.some((a) => a.kind === "repeticion"), "sin recentNarrations (turno 1 de la conversación) → no dispara, no crashea");

  const g4 = guardC(textoBase, { ledger: { figs: [] }, results: [], trace: null, question: "", recentNarrations: [] });
  ok(g4.ok && !g4.advisories.some((a) => a.kind === "repeticion"), "recentNarrations vacío → no dispara, no crashea");
}

// AJUSTE 2026-08-11: «cómo viene» dejó de ser un pedido de serie por sí solo (residual del defecto 8), así que
// el fixture de 2h —que SÍ certifica un turno de EVOLUCIÓN— nombra ahora la serie explícitamente.
// ── HIGIENE DE FIXTURE (owner 2026-08-11) ─────────────────────────────────────────────────────────────────────
// Las preguntas de arranque de 2a/2b/2c/2g decían "¿cómo viene el margen…?" y "¿cómo viene todo?". Esas frases
// dejaron de ser neutras cuando llegó la política de presentación del turno: `pideDetalleTemporal` (progressive-
// Disclosure.js) lee "cómo viene" como un pedido de EVOLUCIÓN, así que tablePolicy quedaba en `required`, guardC
// rechazaba la narración mockeada por `tabla-faltante` y el motor la reemplazaba por la tabla de la boleta — sin
// la pregunta de cierre, o sea sin oferta que extraer. Los 6 chequeos rojos NO eran del mecanismo que este gate
// certifica (oferta estructurada / repetición): eran el arnés midiendo otro turno del que creía medir. Se cambia
// SÓLO la redacción de la pregunta por una que no pide serie ni tabla; ninguna aserción se relaja.
console.log("\n── 2 · DETERMINÍSTICO end-to-end — answerViaOracle con callPlan/callNarrate MOCKEADOS (7 escenarios) ──");

console.log("\n  ▸ 2a · 'sí' ejecuta EXACTAMENTE la oferta estructurada (PLAN bypaseado)");
{
  const PLAN_A1 = mkPlan("ClienteA1");
  let planCallCount1 = 0;
  const callPlanA1 = async () => { planCallCount1++; return PLAN_A1; };
  const callNarrateA1 = async () => "Este es un comentario general sobre el margen del segmento consultado.\n\n[[SIGUIENTE_PASO]]\n¿Querés que profundice en el desglose por cliente?";
  const rA1 = await answerViaOracle({ text: "¿qué margen tienen los clientes bajo benchmark?", history: [], mem: {}, scenario: "actual", callPlan: callPlanA1, callNarrate: callNarrateA1 });
  ok(rA1 && rA1.r && rA1.r.route === "oracle", "turno 1 responde por C");
  ok(planCallCount1 === 1, "turno 1 SÍ llama a PLAN (sin oferta previa que bypasear)");
  ok(rA1 && rA1.mem.lastOffer && rA1.mem.lastOffer.tool === "marginRead" && JSON.stringify(rA1.mem.lastOffer.args) === JSON.stringify(SAFE_CALL.args), `turno 1 extrae oferta estructurada con tool+args replicables — obtuvo ${JSON.stringify(rA1 && rA1.mem.lastOffer)}`);
  ok(rA1 && !/SIGUIENTE_PASO/.test(rA1.r.text), "la marca [[SIGUIENTE_PASO]] nunca llega al texto visible del turno 1");

  let planCallCount2 = 0;
  const callPlanA2 = async () => { planCallCount2++; return { intent: "answer", calls: [] }; };
  let narratePlanSpyA2 = null;
  const callNarrateA2 = async ({ plan }) => { narratePlanSpyA2 = plan; return "Acá va el detalle adicional que pediste."; };
  const rA2 = await answerViaOracle({ text: "sí", history: [], mem: rA1.mem, scenario: "actual", callPlan: callPlanA2, callNarrate: callNarrateA2 });
  ok(rA2 && rA2.r && rA2.r.route === "oracle", 'turno 2 ("sí") responde por C');
  ok(planCallCount2 === 0, "turno 2 NUNCA llama a PLAN — la ruta de aceptación estructurada lo bypasea");
  ok(narratePlanSpyA2 && Array.isArray(narratePlanSpyA2.calls) && narratePlanSpyA2.calls.length === 1 && narratePlanSpyA2.calls[0].tool === "marginRead" && JSON.stringify(narratePlanSpyA2.calls[0].args) === JSON.stringify(SAFE_CALL.args), `turno 2 re-ejecuta EXACTAMENTE tool+args de la oferta (no reinterpreta) — obtuvo ${JSON.stringify(narratePlanSpyA2 && narratePlanSpyA2.calls)}`);
  ok(narratePlanSpyA2 && narratePlanSpyA2.scope && narratePlanSpyA2.scope.entities && narratePlanSpyA2.scope.entities[0] === "ClienteA1", "turno 2 también hereda la entidad de la oferta en el scope sintético");
}

console.log("\n  ▸ 2b · oferta invalidada tras cambio de tema (SIEMPRE recalculada, nunca heredada)");
{
  const callPlanB1 = async () => mkPlan("ClienteB1");
  const callNarrateB1 = async () => "Este cliente está por debajo del objetivo de margen.\n\n[[SIGUIENTE_PASO]]\n¿Querés que profundice en el porqué?";
  const rB1 = await answerViaOracle({ text: "¿qué margen tienen los clientes bajo benchmark?", history: [], mem: {}, scenario: "actual", callPlan: callPlanB1, callNarrate: callNarrateB1 });
  ok(rB1 && rB1.mem.lastOffer && rB1.mem.lastOffer.texto, "turno 1 (B) deja una oferta activa");

  let planCalledB2 = false;
  const callPlanB2 = async () => { planCalledB2 = true; return { intent: "answer", scope: { level: "global" }, calls: [] }; };
  const callNarrateB2 = async () => "Acá va una respuesta sobre un tema completamente distinto, sin ninguna pregunta de cierre.";
  const rB2 = await answerViaOracle({ text: "¿y cómo viene la rotación general del inventario?", history: [], mem: rB1.mem, scenario: "actual", callPlan: callPlanB2, callNarrate: callNarrateB2 });
  ok(planCalledB2, "turno 2 (B, tema nuevo) SÍ llama a PLAN — no es una aceptación, no se bypasea");
  ok(rB2 && rB2.mem.lastOffer == null, `la oferta del turno 1 quedó invalidada tras el cambio de tema (nunca heredada) — obtuvo ${JSON.stringify(rB2 && rB2.mem.lastOffer)}`);
}

console.log("\n  ▸ 2c · rechazo y reemplazo de oferta");
{
  const callPlanC1 = async () => mkPlan("ClienteC1");
  const callNarrateC1 = async () => "Este cliente está por debajo del objetivo de margen.\n\n[[SIGUIENTE_PASO]]\n¿Querés que profundice en el porqué?";
  const rC1 = await answerViaOracle({ text: "¿qué margen tienen los clientes bajo benchmark?", history: [], mem: {}, scenario: "actual", callPlan: callPlanC1, callNarrate: callNarrateC1 });
  const ofertaC1 = rC1 && rC1.mem.lastOffer && rC1.mem.lastOffer.texto;
  ok(!!ofertaC1, "turno 1 (C) deja una oferta activa");

  let planCalledC2 = false;
  const callPlanC2 = async () => { planCalledC2 = true; return mkPlan("ClienteC1"); };
  const callNarrateC2 = async () => "Acá va una respuesta distinta a lo que pediste en su lugar.\n\n[[SIGUIENTE_PASO]]\n¿Querés que revisemos también otro segmento distinto?";
  const rC2 = await answerViaOracle({ text: "no, mejor mostrame otra cosa", history: [], mem: rC1.mem, scenario: "actual", callPlan: callPlanC2, callNarrate: callNarrateC2 });
  ok(planCalledC2, 'turno 2 (C, rechazo + pedido nuevo) SÍ llama a PLAN — "no, mejor..." no matchea aceptación');
  const ofertaC2 = rC2 && rC2.mem.lastOffer && rC2.mem.lastOffer.texto;
  ok(!!ofertaC2 && ofertaC2 !== ofertaC1, `la oferta del turno 1 fue REEMPLAZADA por la nueva del turno 2, no arrastrada — turno1="${ofertaC1}" turno2="${ofertaC2}"`);
}

console.log("\n  ▸ 2d · retorno a uno de los temas recientes (recentSubjects: LRU acotado a 3)");
let memD4 = null;
{
  const callNarrateD = async () => "Respuesta breve sin oferta de seguimiento.";
  const rD1 = await answerViaOracle({ text: "margen de A", history: [], mem: {}, scenario: "actual", callPlan: async () => mkPlan("EntidadD_A"), callNarrate: callNarrateD });
  const rD2 = await answerViaOracle({ text: "margen de B", history: [], mem: rD1.mem, scenario: "actual", callPlan: async () => mkPlan("EntidadD_B"), callNarrate: callNarrateD });
  ok(JSON.stringify((rD2.mem.recentSubjects || []).map((s) => s.entidad)) === JSON.stringify(["EntidadD_B", "EntidadD_A"]), `recentSubjects trackea A→B en orden más-reciente-primero — obtuvo ${JSON.stringify(rD2.mem.recentSubjects)}`);

  const rD3 = await answerViaOracle({ text: "margen de C", history: [], mem: rD2.mem, scenario: "actual", callPlan: async () => mkPlan("EntidadD_C"), callNarrate: callNarrateD });
  ok((rD3.mem.recentSubjects || []).length === 3, "recentSubjects acepta hasta 3");

  const rD4 = await answerViaOracle({ text: "margen de D", history: [], mem: rD3.mem, scenario: "actual", callPlan: async () => mkPlan("EntidadD_D"), callNarrate: callNarrateD });
  ok((rD4.mem.recentSubjects || []).length === 3 && !rD4.mem.recentSubjects.some((s) => s.entidad === "EntidadD_A"), `4to tema desplaza al más viejo (tope 3, memoria NO ilimitada) — obtuvo ${JSON.stringify(rD4.mem.recentSubjects)}`);
  memD4 = rD4.mem;

  const rD5 = await answerViaOracle({ text: "volvamos a B", history: [], mem: rD4.mem, scenario: "actual", callPlan: async () => mkPlan("EntidadD_B"), callNarrate: callNarrateD });
  const namesD5 = (rD5.mem.recentSubjects || []).map((s) => s.entidad);
  ok(namesD5[0] === "EntidadD_B" && namesD5.filter((n) => n === "EntidadD_B").length === 1, `retomar un tema YA visto lo trae al frente SIN duplicarlo — obtuvo ${JSON.stringify(namesD5)}`);
}
console.log("     (NOTA honesta: esto certifica que la LISTA se mantiene bien — que el LLM real efectivamente LEA");
console.log("      recentSubjects y resuelva 'volvamos a lo de X' en consecuencia depende de su comprensión, no de esta red)");

console.log("\n  ▸ 2e · estado persistido SIN imponerse sobre lo que el usuario acaba de pedir");
{
  const callNarrateE1 = async () => "Resumen general del margen de este cliente.\n\n[[SIGUIENTE_PASO]]\n¿Querés que profundice en el porqué?";
  const rE1 = await answerViaOracle({ text: "margen de EntidadE1", history: [], mem: {}, scenario: "actual", callPlan: async () => mkPlan("EntidadE1"), callNarrate: callNarrateE1 });
  ok(rE1 && rE1.mem.lastOffer && rE1.mem.lastOffer.tool === "marginRead", "turno 1 (E) deja oferta con tool marginRead/dimension=cliente");

  const PLAN_E2 = { intent: "answer", scope: { level: "entity", entities: ["EntidadE2"] }, calls: [{ tool: "marginRead", args: { dimension: "marca", focus: "bajo_benchmark" } }] };
  let planCalledE2 = false;
  let executedCallsE2 = null;
  const callPlanE2 = async () => { planCalledE2 = true; return PLAN_E2; };
  const callNarrateE2 = async ({ plan }) => { executedCallsE2 = plan.calls; return "Acá va la respuesta a tu pregunta nueva, sin relación con lo anterior."; };
  const rE2 = await answerViaOracle({ text: "¿y la marca con menor margen?", history: [], mem: rE1.mem, scenario: "actual", callPlan: callPlanE2, callNarrate: callNarrateE2 });
  ok(planCalledE2, "turno 2 (E, pregunta nueva) SÍ llama a PLAN normalmente");
  ok(executedCallsE2 && executedCallsE2[0] && executedCallsE2[0].args && executedCallsE2[0].args.dimension === "marca", `el turno 2 ejecuta SU PROPIO plan (dimension=marca) — la oferta guardada (dimension=cliente) NO se impone — obtuvo ${JSON.stringify(executedCallsE2)}`);
}

console.log("\n  ▸ 2f · orientación útil y grounded (pedido explícito + confusión persistente)");
{
  let orientacionSpy = null;
  const callPlanF = async () => ({ intent: "ack", calls: [] });
  const callNarrateF = async ({ instruccionOrientacion }) => { orientacionSpy = instruccionOrientacion; return "Acá van algunas ideas concretas para seguir."; };
  const rF = await answerViaOracle({ text: "no sé qué más preguntar", history: [], mem: memD4 || {}, scenario: "actual", callPlan: callPlanF, callNarrate: callNarrateF });
  ok(rF && rF.r && rF.r.route === "oracle", "turno de orientación (pedido explícito) responde por C");
  ok(!!orientacionSpy, `se generó instruccion_orientacion (payload reforzado a nivel de turno, no solo doctrina de fondo) — obtuvo ${JSON.stringify(orientacionSpy)}`);
  ok(/EntidadD_B|EntidadD_C|EntidadD_D/.test(orientacionSpy || ""), `la instrucción referencia temas REALES de la conversación (recentSubjects), no genéricos — obtuvo "${orientacionSpy}"`);
  ok(/en qué más te puedo ayudar/i.test(orientacionSpy || ""), "la instrucción prohíbe explícitamente el cierre genérico");

  const callPlanClarify = async () => ({ intent: "define", mode: "clarify", calls: [] });
  let orientacionSpy2 = null;
  let memClarify = {};
  for (let i = 0; i < 3; i++) {
    const isLast = i === 2;
    const callNarrateClarify = isLast
      ? async ({ instruccionOrientacion }) => { orientacionSpy2 = instruccionOrientacion; return "Un ángulo más chico y concreto para seguir explicando esto."; }
      : async () => "Te lo explico de nuevo, en términos simples.";
    const r = await answerViaOracle({ text: "no entiendo, explicámelo más simple", history: [], mem: memClarify, scenario: "actual", callPlan: callPlanClarify, callNarrate: callNarrateClarify });
    memClarify = r.mem;
  }
  ok(memClarify.clarifyStreak >= 3, `3 turnos consecutivos de clarify acumulan clarifyStreak>=3 — obtuvo ${memClarify.clarifyStreak}`);
  ok(!!orientacionSpy2, `confusión persistente (clarifyStreak>=3, SIN frase explícita) también dispara orientación — obtuvo ${JSON.stringify(orientacionSpy2)}`);
  ok(/[aá]ngulo|m[aá]s\s+chico|m[aá]s\s+concreto/i.test(orientacionSpy2 || ""), `la instrucción de confusión persistente propone un ángulo más chico y concreto — obtuvo "${orientacionSpy2}"`);
}

console.log("\n  ▸ 2g · repetición detectada end-to-end SIN bloquear (complementa la sección 1)");
{
  const callPlanG = async () => ({ intent: "ack", calls: [] });
  const textoG1 = "El desempeño general del negocio se mantiene estable este período, sin cambios relevantes que reportar en el panorama actual.";
  const rG1 = await answerViaOracle({ text: "dame la lectura del negocio", history: [], mem: {}, scenario: "actual", callPlan: callPlanG, callNarrate: async () => textoG1 });
  ok(rG1 && rG1.r && rG1.r.route === "oracle", "turno 1 (G) responde por C");
  ok(Array.isArray(rG1.mem.recentNarrations) && rG1.mem.recentNarrations[0] === textoG1, "turno 1 (G) registra su propia narración en recentNarrations");

  const rG2 = await answerViaOracle({ text: "dame la lectura del negocio", history: [], mem: rG1.mem, scenario: "actual", callPlan: callPlanG, callNarrate: async () => textoG1 });
  ok(rG2 && rG2.r && rG2.r.route === "oracle", "turno 2 (G, repetición 100% de la propia narración anterior) IGUAL responde por C — el aviso nunca bloquea");
  ok(rG2.mem.recentNarrations.length === 2, `recentNarrations acumula (tope 2) — obtuvo ${rG2.mem.recentNarrations.length}`);

  const textoG3 = "Ahora te comento un tema completamente distinto, sin relación textual con lo anterior en absoluto.";
  const rG3 = await answerViaOracle({ text: "otra cosa", history: [], mem: rG2.mem, scenario: "actual", callPlan: callPlanG, callNarrate: async () => textoG3 });
  ok(rG3.mem.recentNarrations.length === 2 && rG3.mem.recentNarrations[0] === textoG3, `recentNarrations tope 2, más reciente primero (desplaza al más viejo) — obtuvo ${JSON.stringify(rG3.mem.recentNarrations)}`);
}

// ── 2h · LA COBERTURA QUE LA HIGIENE DE FIXTURE SE LLEVÓ, DEVUELTA (owner 2026-08-11) ─────────────────────────
// Al cambiar «¿cómo viene el margen…?» por «¿qué margen tienen…?» en 2a/2b/2c, estos escenarios dejaron de
// ejercitar la redacción que dispara `pideDetalleTemporal` — o sea, nadie certificaba ya que un turno de
// EVOLUCIÓN conserve su oferta de cierre. Eso es una PÉRDIDA DE COBERTURA, no una relajación de aserciones, y se
// paga acá en vez de dejarse escrita en un residual: el turno vuelve con su redacción original y el arnés cumple
// la política que ese turno impone (tablePolicy="required" ⇒ el narrador tabula, como haría el LLM real leyendo
// su contrato). Lo que se certifica es que tabular NO se lleva puesta la oferta estructurada.
console.log("\n  ▸ 2h · turno de EVOLUCIÓN (tablePolicy=required) — la oferta de cierre sobrevive a la tabla");
{
  const PLAN_H = { intent: "answer", mode: "default", scope: { level: "list", entities: [] }, calls: [{ tool: "marginRead", args: { scope: "bajo_benchmark" } }] };
  let policyVista = null;
  const rH = await answerViaOracle({
    text: "¿cómo viene el margen de los clientes bajo benchmark, mes a mes?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => PLAN_H,
    callNarrate: async (a) => {
      policyVista = a.tablePolicy;
      // la tabla se arma con las cifras YA autorizadas del turno (a.ledgerFigs) — nunca inventadas, igual que
      // tendría que hacer el narrador real.
      const filas = (a.ledgerFigs || []).slice(0, 5).map((f) => `| ${f.label} | ${f.value} |`).join("\n");
      return `| Concepto | Valor |\n|---|---|\n${filas}\n\n[[SIGUIENTE_PASO]]\n¿Querés que profundice en el desglose por cliente?`;
    },
  });
  ok(policyVista === "required", `2h: la redacción de EVOLUCIÓN llega al narrador como tablePolicy="required" — obtuvo ${JSON.stringify(policyVista)}`);
  ok(rH && rH.r && rH.r.route === "oracle", "2h: el turno responde por C");
  ok(rH && /\|\s*Concepto\s*\|/.test(rH.r.text), "2h: la respuesta trae la tabla que el turno pidió");
  ok(rH && rH.mem.lastOffer && rH.mem.lastOffer.tool === "marginRead",
    `2h: y la oferta estructurada de cierre SOBREVIVE a la tabla — obtuvo ${JSON.stringify(rH && rH.mem.lastOffer)}`);
  ok(rH && /desglose por cliente/i.test(rH.r.text), "2h: el texto de la oferta sigue llegando al usuario (no se la come el renderer de la tabla)");
}

console.log("\n── 3 · ACEPTACIÓN HUÉRFANA — 'sí'/'dale' SIN lastOffer activa (owner 2026-07-31, cierre de #48) ──");
{
  let planCalledA = false, narrateCalledA = false;
  const callPlanA = async () => { planCalledA = true; return { intent: "ack", calls: [] }; };
  const callNarrateA = async () => { narrateCalledA = true; return "esto NUNCA debería aparecer — sería narración libre repitiendo algo"; };
  const rA = await answerViaOracle({ text: "sí", history: [], mem: {}, scenario: "actual", callPlan: callPlanA, callNarrate: callNarrateA });
  ok(rA && rA.r && rA.r.route === "oracle", '"sí" sin lastOffer ni recentSubjects: IGUAL responde por C (nunca se abstiene)');
  ok(!planCalledA && !narrateCalledA, '"sí" huérfano: NUNCA invoca PLAN ni NARRAR — garantía por construcción, no depende del LLM');
  ok(rA && !/nunca deber[ií]a aparecer/i.test(rA.r.text), "el texto compuesto no tiene NADA que ver con lo que hubiera dicho el narrador (imposible que repita)");
  // el registro pasó a tuteo neutro (owner 2026-08-14): «Contame qué querés revisar» → «Cuéntame qué quieres
  // revisar». Se aceptan LAS DOS formas a propósito — lo que esta línea prueba es que PIDE PRECISIÓN, no cómo se
  // conjuga; atarla a una sola redacción la volvería un test de ortografía y no del comportamiento.
  ok(rA && /cu[eé]ntame|contame|qu[eé] quieres revisar|qu[eé] quer[eé]s revisar/i.test(rA.r.text),
    'sin ningún tema previo: pide precisión activamente, nunca un "no sé" seco');

  const memConTemas = { recentSubjects: [{ entidad: "Falabella", dimension: "cliente" }, { entidad: "Sodimac", dimension: "cliente" }] };
  let narrateCalledB = false;
  const rB = await answerViaOracle({ text: "dale", history: [], mem: memConTemas, scenario: "actual", callPlan: async () => { throw new Error("no debería llamarse"); }, callNarrate: async () => { narrateCalledB = true; return "x"; } });
  ok(!narrateCalledB, '"dale" huérfano con temas recientes: tampoco invoca al narrador');
  ok(rB && /Falabella/.test(rB.r.text) && /Sodimac/.test(rB.r.text), "con temas recientes: los OFRECE como opciones concretas vigentes, no genérico");
  ok(rB && Array.isArray(rB.mem.recentSubjects) && rB.mem.recentSubjects.length === 2, "recentSubjects se hereda sin tocar (no se resolvió ninguna entidad nueva este turno)");
  ok(rB && rB.mem.lastOffer == null, "la aceptación huérfana nunca deja una nueva lastOffer (no es una oferta estructurada real)");

  // control: CON lastOffer.tool activo, "sí" NO cae en la ruta huérfana — usa la ejecución estructurada existente.
  const memConOferta = { lastOffer: { texto: "¿profundizamos?", entidad: "Falabella", tool: "marginRead", args: { dimension: "cliente" } } };
  let planCalledC = false;
  const rC = await answerViaOracle({ text: "sí", history: [], mem: memConOferta, scenario: "actual", callPlan: async () => { planCalledC = true; return { intent: "answer", calls: [] }; }, callNarrate: async () => "respuesta real" });
  ok(!planCalledC, "control: con lastOffer.tool activo, 'sí' NO cae en la ruta huérfana (usa la ejecución estructurada, que tampoco llama a PLAN)");
  // "respuesta real" pasa por ensurePeriodoDeclared (marginRead trae período real) — puede llegar con la cláusula
  // de período agregada al final, eso es la garantía de siempre funcionando, no un desvío de este bypass.
  ok(rC && rC.r.text.startsWith("respuesta real") && !/no tengo (?:una oferta|un contexto)/i.test(rC.r.text), "control: con oferta activa, el resultado es la narración real de la ejecución estructurada, no el mensaje huérfano");

  // control: texto que NO es aceptación, sin oferta → PLAN corre normal, ningún bypass nuevo se entromete.
  let planCalledD = false;
  const rD = await answerViaOracle({ text: "no, mejor mostrame otra cosa", history: [], mem: {}, scenario: "actual", callPlan: async () => { planCalledD = true; return { intent: "answer", mode: "diagnostico", calls: [{ tool: "marginRead", args: { dimension: "cliente", focus: "bajo_benchmark" } }] }; }, callNarrate: async () => "respuesta normal" });
  ok(planCalledD, '"no, mejor mostrame otra cosa" (no es aceptación): PLAN corre normal, ningún bypass se entromete');
}

console.log("\n── 4 · RETORNO A TEMAS RECIENTES — resuelto (bypasea PLAN) y ambiguo (bypasea todo) ──");
{
  const REC3 = [{ entidad: "TemaReciente1", dimension: "cliente" }, { entidad: "TemaReciente2", dimension: "cliente" }, { entidad: "TemaReciente3", dimension: "cliente" }];

  let planCalledAnterior = false, narratePlanSpyAnterior = null;
  const rAnterior = await answerViaOracle({ text: "volvamos a lo anterior", history: [], mem: { recentSubjects: REC3 }, scenario: "actual", callPlan: async () => { planCalledAnterior = true; return { intent: "answer", calls: [] }; }, callNarrate: async ({ plan }) => { narratePlanSpyAnterior = plan; return "Respuesta sobre el tema recuperado."; } });
  ok(!planCalledAnterior, '"volvamos a lo anterior": bypasea PLAN — nunca lo llama (referencia posicional resuelta determinísticamente)');
  ok(narratePlanSpyAnterior && narratePlanSpyAnterior.scope && narratePlanSpyAnterior.scope.entities && narratePlanSpyAnterior.scope.entities[0] === "TemaReciente1", `"volvamos a lo anterior" resuelve al MÁS RECIENTE (TemaReciente1) — obtuvo ${JSON.stringify(narratePlanSpyAnterior && narratePlanSpyAnterior.scope)}`);
  ok(narratePlanSpyAnterior && Array.isArray(narratePlanSpyAnterior.calls) && narratePlanSpyAnterior.calls[0] && narratePlanSpyAnterior.calls[0].tool === "entityProfile", `usa entityProfile (perfil general de la entidad, no un campo puntual) — obtuvo ${JSON.stringify(narratePlanSpyAnterior && narratePlanSpyAnterior.calls)}`);
  ok(rAnterior && rAnterior.r && rAnterior.r.route === "oracle", '"volvamos a lo anterior" responde por C con datos REALES de esa entidad (no un mensaje fijo)');

  let planCalledPrimero = false, narratePlanSpyPrimero = null;
  const rPrimero = await answerViaOracle({ text: "volvamos al primer tema", history: [], mem: { recentSubjects: REC3 }, scenario: "actual", callPlan: async () => { planCalledPrimero = true; return { intent: "answer", calls: [] }; }, callNarrate: async ({ plan }) => { narratePlanSpyPrimero = plan; return "Respuesta sobre el primer tema."; } });
  ok(!planCalledPrimero, '"volvamos al primer tema": también bypasea PLAN');
  ok(narratePlanSpyPrimero && narratePlanSpyPrimero.scope.entities[0] === "TemaReciente3", `"el primer tema" resuelve al MÁS VIEJO trackeado (TemaReciente3, último índice) — obtuvo ${JSON.stringify(narratePlanSpyPrimero && narratePlanSpyPrimero.scope)}`);

  // AMBIGUO: referencia genérica, 2+ candidatos → nunca adivina, pregunta — bypasea TODO (ni PLAN ni NARRAR).
  let planCalledAmbig = false, narrateCalledAmbig = false;
  const rAmbig = await answerViaOracle({ text: "volvamos a un tema anterior", history: [], mem: { recentSubjects: REC3 }, scenario: "actual", callPlan: async () => { planCalledAmbig = true; return { intent: "answer", calls: [] }; }, callNarrate: async () => { narrateCalledAmbig = true; return "no debería llegar acá"; } });
  ok(!planCalledAmbig && !narrateCalledAmbig, '"volvamos a un tema anterior" (genérico, ambiguo): NUNCA invoca PLAN ni NARRAR — nunca adivina');
  ok(rAmbig && /TemaReciente1/.test(rAmbig.r.text) && /TemaReciente2/.test(rAmbig.r.text) && /TemaReciente3/.test(rAmbig.r.text), `el mensaje ambiguo lista las 3 opciones reales — "${rAmbig && rAmbig.r.text}"`);

  // control: con SOLO 1 tema reciente, la referencia genérica NO es ambigua de verdad → PLAN corre normal.
  let planCalledUnico = false;
  const rUnico = await answerViaOracle({ text: "volvamos a un tema anterior", history: [], mem: { recentSubjects: [{ entidad: "Único", dimension: "cliente" }] }, scenario: "actual", callPlan: async () => { planCalledUnico = true; return { intent: "answer", mode: "seguimiento", scope: { level: "entity", entities: ["Único"] }, calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Único" } }] }; }, callNarrate: async () => "respuesta normal" });
  ok(planCalledUnico, "control: con un SOLO tema reciente, la referencia genérica no es ambigua de verdad — PLAN corre normal (juicio del LLM, no forzado)");

  // control: sin recentSubjects, referencia posicional → nada que resolver, PLAN corre normal, no crashea.
  let planCalledVacio = false;
  const rVacio = await answerViaOracle({ text: "volvamos a lo anterior", history: [], mem: {}, scenario: "actual", callPlan: async () => { planCalledVacio = true; return { intent: "ack", calls: [] }; }, callNarrate: async () => "x" });
  ok(planCalledVacio, "control: sin recentSubjects, la referencia posicional no tiene nada que resolver — PLAN corre normal, no crashea");
}

console.log(`\n── _dialogue_state_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
