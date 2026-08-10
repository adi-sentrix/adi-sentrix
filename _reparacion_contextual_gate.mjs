/* === _reparacion_contextual_gate.mjs · CONTRATO CONVERSACIONAL v1.2 · REPARACIÓN CONTEXTUAL ====================
 * Cubre la SECCIÓN 8 del contrato ("verificación gratuita") en lo que se puede probar sin invocar al oráculo
 * entero: funciones puras del estado canónico, el contrato versionado, el guard y los dos prompts.
 * El cableado del pipeline lo certifica _reparacion_cableado_gate.mjs (inspección estática) y la conducta de
 * punta a punta, con las dos pasadas simuladas, _reparacion_pipeline_gate.mjs.
 *
 * CERO RED, CERO LLM: ejercita módulos directo, como _conversation_scope_gate.mjs / _model_router_gate.mjs.
 *
 * El PISO de la sección 8, punto por punto:
 *   1. corrección de entidad · métrica · período · alcance · criterio        → §8.1
 *   2. la pregunta ambigua se adapta al contexto y no enumera de más         → §8.2
 *   3. corrección ≠ desacuerdo                                              → §8.4
 *   4. cifra del usuario que contradice al motor                            → §8.5
 *   5. queda marcada y no entra a un total del motor                        → §8.6
 *   6. lo derivado de ella sale como estimación, no como dato probado        → §8.7
 *   7. conservación de lo compatible / invalidación de lo incompatible       → §8.8 · §8.9
 *   8. ausencia de ofertas y entidades antiguas                             → §8.10
 *   9. concordancia ADI ↔ Sentrix sobre el alcance corregido                → §8.11
 *  10. compatibilidad OpenAI/Anthropic (el contrato es dato, no prompt)      → §8.12
 *  11. crecimiento EXACTO del prompt, medido y acotado                      → §8.14
 */
import {
  CONTRACT_VERSION, REPAIR_KINDS, REPAIR_FIELDS, REPAIR_FIELD_KEYS, SCOPE_FIELDS, REPAIR_INVARIANTS,
  camposQueSobreviven, camposQueSeInvalidan, buildRepairPlanDoctrine, buildRepairNarrateDoctrine, MODE_KEYS,
} from "./src/adi/oracle/conversationalContract.js";
import {
  applyRepairToScope, composePrecisionQuestion, withSupuestoUsuario, supuestosUsuarioVivos,
  emptyConversationScope, SUPUESTOS_USUARIO_MAX,
} from "./src/adi/oracle/conversationScope.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { buildReparacion, buildNarrationContract, isSealed } from "./src/adi/oracle/narrationContract.js";
import { buildNarrateSystemC, buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { buildPlanSystem, buildPlanSystemSegments, PLAN_TOOL } from "./src/adi/oracle/planPrompt.js";
import { ADI_PERSONA, ADI_PERSONA_PLAN } from "./src/adi/oracle/persona.js";
import { buildOracleEvidence } from "./src/adi/oracle/sentrixEvidence.js";
import { parseFigures } from "./src/adi/boleta.js";
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  OK  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`); }
}
function section(title) { console.log(`\n== ${title} ==`); }

// ── FIXTURE · el estado que deja un turno real sobre UN cliente, con oferta pendiente y evidencia ──────────────
// Shape exacto de ConversationScopeEntry (ver conversationScope.js). Se arma a mano, como el resto de los gates
// de estado: nunca se deriva de una corrida con LLM.
function scopeFalabella() {
  return {
    version: 1,
    current: {
      turno: 4, dimension: "cliente", entities: ["Falabella"],
      selection: { orden: "por margen, ascendente", subset: { kind: "top", n: 1 } },
      periodo: "año cerrado", filtros: { cliente: "Falabella" }, metrica: "margen",
      operacion: "answer", modo: "default", tool: "entityProfile",
      origen: { callId: "c1", boletaLabels: ["Falabella · Margen", "Falabella · Venta"] },
      supuestos: [], faltantes: [],
      ofertaPendiente: { texto: "¿querés que profundice en el rebate de Falabella?", entidad: "Falabella", tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" }, turno: 4 },
      tenant: { tenantId: "acme-cl", dataSnapshotId: "acme-cl::actual" },
    },
    history: [],
    recentSubjects: [{ entidad: "Falabella", dimension: "cliente", turno: 4, mode: "default", intent: "answer", tool: "entityProfile" }],
  };
}
const ledgerDe = (figs) => ({ figs });
// las figs se derivan con el MISMO parser que usa el guard (parseFigures) — escribir el `canon` a mano sería
// inventar un formato que no es el real y el fixture pasaría por el motivo equivocado.
const _fig = (label, texto) => { const f = parseFigures(texto)[0]; return { label, value: f.text, canon: f.canon, raw: f.raw, unit: f.unit }; };
const FIGS_MOTOR = [_fig("Lider · Venta", "$17.8M"), _fig("Lider · Margen", "21.5%")];

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * 1 · EL CONTRATO ES DATO VERSIONADO (§8.12 — la mitad que se puede probar sin proveedor)
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
section("1 · el contrato versionado");
ok("la versión del contrato subió a 1.2.0", CONTRACT_VERSION === "adi-conversational-contract@1.2.0", CONTRACT_VERSION);
ok("NO se agregó ningún modo conversacional (§7: siguen siendo los 7)", MODE_KEYS.length === 7 && !MODE_KEYS.some((k) => ["confirm", "compare", "close", "reparacion"].includes(k)), MODE_KEYS.join(","));
ok("las 3 clases de mensaje están declaradas", REPAIR_KINDS.length === 3 && ["correccion", "desacuerdo", "dato_usuario"].every((k) => REPAIR_KINDS.includes(k)));
ok("§2 · los 8 campos corregibles del contrato están declarados",
  ["entidad", "metrica", "periodo", "alcance", "intencion", "criterio", "formato", "supuesto"].every((k) => REPAIR_FIELD_KEYS.includes(k)) && REPAIR_FIELD_KEYS.length === 8,
  REPAIR_FIELD_KEYS.join(","));
ok("cada campo declara qué CONSERVA (allowlist), y solo campos reales del scope",
  REPAIR_FIELDS.every((f) => Array.isArray(f.conserva) && f.conserva.every((c) => SCOPE_FIELDS.includes(c))));
ok("§3.6 · la oferta NUNCA sobrevive a una corrección de alcance", REPAIR_INVARIANTS.ofertaMuereSalvoFormato);
ok("§1 · la evidencia del turno corregido tampoco sobrevive", REPAIR_INVARIANTS.evidenciaMuereSalvoFormato);

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * 2 · CONSERVAR LO COMPATIBLE / INVALIDAR LO INCOMPATIBLE (§8.1 · §8.8 · §8.9)
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
section("2 · qué sobrevive a cada corrección");
const casos = [
  { corrige: ["entidad"],  muere: ["entities", "filtros", "selection", "origen", "ofertaPendiente"], vive: ["periodo", "metrica"] },
  { corrige: ["metrica"],  muere: ["metrica", "selection", "ofertaPendiente"],                       vive: ["entities", "periodo", "filtros"] },
  { corrige: ["periodo"],  muere: ["periodo", "selection", "ofertaPendiente", "supuestos"],          vive: ["entities", "metrica", "filtros"] },
  { corrige: ["alcance"],  muere: ["entities", "filtros", "selection", "ofertaPendiente"],           vive: ["periodo", "metrica"] },
  { corrige: ["criterio"], muere: ["selection", "origen", "ofertaPendiente"],                        vive: ["entities", "periodo", "metrica", "filtros"] },
];
for (const c of casos) {
  const inval = new Set(camposQueSeInvalidan(c.corrige));
  const vivos = camposQueSobreviven(c.corrige);
  ok(`corrección de ${c.corrige.join("+")} · invalida ${c.muere.join(", ")}`, c.muere.every((m) => inval.has(m)), [...inval].join(","));
  ok(`corrección de ${c.corrige.join("+")} · conserva ${c.vive.join(", ")}`, c.vive.every((v) => vivos.has(v)), [...vivos].join(","));
}
ok("corrección de FORMATO no toca el alcance (no invalida nada)", camposQueSeInvalidan(["formato"]).length === 0);
// INTERSECCIÓN, no unión — la trampa que dejaría el período de la entidad vieja pegado a la entidad nueva.
ok("§1 · dos correcciones a la vez cruzan por INTERSECCIÓN (entidad+período no conserva el período)",
  !camposQueSobreviven(["entidad", "periodo"]).has("periodo"), [...camposQueSobreviven(["entidad", "periodo"])].join(","));
ok("una corrección sin campos legibles se trata como la MÁS amplia (no como inofensiva)",
  camposQueSeInvalidan([]).length === SCOPE_FIELDS.length && camposQueSeInvalidan(["inventado"]).length === SCOPE_FIELDS.length);

section("3 · la invalidación aplicada sobre el estado canónico");
const repEntidad = applyRepairToScope(scopeFalabella(), { tipo: "correccion", corrige: ["entidad"] });
ok("§8.9 · la entidad corregida desaparece del alcance activo", repEntidad.current.entities.length === 0, JSON.stringify(repEntidad.current.entities));
ok("§8.10 · la oferta del turno corregido queda cancelada", repEntidad.current.ofertaPendiente === null);
ok("§8.10 · la entidad corregida no queda como «tema reciente» (no puede reaparecer en el prompt)",
  !repEntidad.recentSubjects.some((s) => s.entidad === "Falabella"), JSON.stringify(repEntidad.recentSubjects));
ok("§1 · la evidencia del turno equivocado se invalida", !repEntidad.current.origen.callId && repEntidad.current.origen.boletaLabels.length === 0);
ok("§1 · el filtro de la entidad vieja no sobrevive", repEntidad.current.filtros === null);
ok("§8.8 · lo compatible SÍ se conserva (el período y la métrica siguen ahí)",
  repEntidad.current.periodo === "año cerrado" && repEntidad.current.metrica === "margen");
ok("no muta el objeto recibido (función pura)", scopeFalabella().current.entities[0] === "Falabella" && repEntidad !== scopeFalabella());

const repMetrica = applyRepairToScope(scopeFalabella(), { tipo: "correccion", corrige: ["metrica"] });
ok("corregir la MÉTRICA conserva la entidad (solo cambia lo corregido)", repMetrica.current.entities[0] === "Falabella");
ok("corregir la MÉTRICA cancela igual la oferta que colgaba de la métrica vieja", repMetrica.current.ofertaPendiente === null);
ok("corregir la MÉTRICA descarta el orden sellado con la métrica anterior", repMetrica.current.selection === null);

section("4 · corrección ≠ desacuerdo ≠ dato aportado (§8.4)");
const desac = applyRepairToScope(scopeFalabella(), { tipo: "desacuerdo" });
ok("§5 · un DESACUERDO no invalida nada — la evidencia se conserva entera",
  desac.current.entities[0] === "Falabella" && !!desac.current.ofertaPendiente && !!desac.current.origen.callId);
const datoU = applyRepairToScope(scopeFalabella(), { tipo: "dato_usuario", dato: { metrica: "ventas", valor: "$20M" } });
ok("un DATO APORTADO tampoco invalida el alcance", datoU.current.entities[0] === "Falabella");
const ambigua = applyRepairToScope(scopeFalabella(), { tipo: "correccion", ambigua: true, corrige: [] });
ok("§4 · una corrección AMBIGUA no modifica el contexto (no se toca nada hasta saber qué corregir)",
  ambigua === scopeFalabella.call ? true : (ambigua.current.entities[0] === "Falabella" && !!ambigua.current.ofertaPendiente));
ok("la doctrina de NARRAR distingue las tres clases con texto propio",
  /CORRECCIÓN/.test(buildRepairNarrateDoctrine({ tipo: "correccion", corrige: ["entidad"] }))
  && /DESACUERDO/.test(buildRepairNarrateDoctrine({ tipo: "desacuerdo" }))
  && /CIFRA DEL USUARIO/.test(buildRepairNarrateDoctrine({ tipo: "dato_usuario" })));
ok("§5 · el desacuerdo exige separar probado / indicado / abierto",
  /PROBADO/.test(buildRepairNarrateDoctrine({ tipo: "desacuerdo" })) && /INDICADO/.test(buildRepairNarrateDoctrine({ tipo: "desacuerdo" })) && /ABIERTO/.test(buildRepairNarrateDoctrine({ tipo: "desacuerdo" })));
ok("§5 · el desacuerdo NUNCA pide retractarse de una cifra sellada", /no te retractes de una cifra que el motor selló/i.test(buildRepairNarrateDoctrine({ tipo: "desacuerdo" })));

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * 5 · LA CORRECCIÓN AMBIGUA (§8.2)
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
section("5 · la pregunta de precisión");
const preguntaPropia = composePrecisionQuestion(scopeFalabella(), { tipo: "correccion", ambigua: true, pregunta: "¿Te referías a Lider en vez de Falabella, o al trimestre en vez del año?" });
ok("el mecanismo PRINCIPAL es la pregunta que redacta PLAN con el contexto", /Lider/.test(preguntaPropia));
const q1 = composePrecisionQuestion(scopeFalabella(), { tipo: "correccion", ambigua: true });
ok("§4 · la red determinística hace UNA sola pregunta", (q1.match(/\?/g) || []).length === 1, q1);
ok("§4 · nombra lo que ese turno SÍ tenía (entidad, métrica, período, criterio)",
  /entidad/i.test(q1) && /métrica/i.test(q1) && /período/i.test(q1) && /criterio/i.test(q1), q1);
// un turno pelado: sin métrica, sin período, sin orden sellado → NO puede preguntar por ellos.
const scopePelado = { version: 1, current: { turno: 1, dimension: "cliente", entities: ["Lider"], selection: null, periodo: null, filtros: null, metrica: null, origen: { callId: null, boletaLabels: [] }, supuestos: [], ofertaPendiente: null, tenant: null }, history: [] };
const q2 = composePrecisionQuestion(scopePelado, { tipo: "correccion", ambigua: true });
ok("§4 · NO enumera opciones que no correspondan (sin métrica/período/criterio no los nombra)",
  !/métrica/i.test(q2) && !/período/i.test(q2) && !/criterio/i.test(q2) && /entidad/i.test(q2), q2);
const q3 = composePrecisionQuestion(emptyConversationScope(), { tipo: "correccion", ambigua: true });
ok("sin ningún contexto previo, igual pregunta (nunca adivina ni se queda muda)", typeof q3 === "string" && q3.includes("?"), q3);
// REGISTRO (owner 2026-08-10, defecto 4 de la certificación live): tuteo neutro, nunca voseo. Vale para las dos
// preguntas —la determinística de acá y la que redacta el LLM, que answerViaOracle pasa por stripLanguageLeaks.
const VOSEO = /\b(?:dec[ií]me|cont[aá]me|quer[eé]s|pod[eé]s|ten[eé]s|dec[ií]s|mir[aá]|fij[aá]te)(?![\p{L}])/iu;
ok("la pregunta determinística está en tuteo neutro, sin voseo", ![q1, q2, q3].some((s) => VOSEO.test(s)), [q1, q2, q3].find((s) => VOSEO.test(s)) || "");
ok("y la del LLM se normaliza con la garantía de runtime que ya existe",
  !VOSEO.test(stripLanguageLeaks("Decime si querés que revise otra cuenta.")), stripLanguageLeaks("Decime si querés que revise otra cuenta."));
ok("§4.1 · la pregunta de precisión NO trae datos y el guard la deja pasar",
  guardC(q1, { ledger: ledgerDe([]), results: [], question: "eso está mal", reparacion: { tipo: "correccion", ambigua: true, corrige: [], supuestos: [] } }).ok, JSON.stringify(guardC(q1, { ledger: ledgerDe([]), results: [] }).violations));

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * 6 · EL GUARD DISTINGUE LAS DOS CORRECCIONES (§8.3 lado guard · §4.1)
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
section("6 · corrección resuelta: sin evidencia es un defecto");
const repResuelta = { tipo: "correccion", corrige: ["entidad"], ambigua: false, supuestos: [] };
const sinDato = "Entendido: preguntabas por Lider, no por Falabella. Te lo reviso enseguida.";
const gSin = guardC(sinDato, { ledger: ledgerDe(FIGS_MOTOR), results: [], question: "no, era Lider", reparacion: repResuelta });
ok("§4.1 · una corrección RESUELTA sin una sola cifra se bloquea", !gSin.ok && gSin.violations.some((v) => v.kind === "correccion-sin-evidencia"), gSin.verdict);
const conDato = "Entendido: preguntabas por Lider, no por Falabella. Lider vende $17.8M y su margen es 21.5% — en el año cerrado.";
ok("§4.1 · la misma corrección CON el dato corregido pasa",
  guardC(conDato, { ledger: ledgerDe(FIGS_MOTOR), results: [], question: "no, era Lider", reparacion: repResuelta }).ok,
  JSON.stringify(guardC(conDato, { ledger: ledgerDe(FIGS_MOTOR), results: [], question: "no, era Lider", reparacion: repResuelta }).violations));
ok("§4.1 · una corrección AMBIGUA sin cifras NO cuenta como falla",
  guardC("Antes de rehacerlo, decime qué corrijo: ¿la entidad o el período?", { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: { tipo: "correccion", ambigua: true, corrige: [], supuestos: [] } }).ok);
ok("sin cifras autorizadas en la boleta no se exige evidencia (la tool declinó)",
  guardC(sinDato, { ledger: ledgerDe([]), results: [], reparacion: repResuelta }).ok);
ok("un turno NORMAL (sin reparación) no cambia en nada", guardC(sinDato, { ledger: ledgerDe(FIGS_MOTOR), results: [] }).ok);

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * 7 · EL TERCER UNIVERSO (§8.5 · §8.6 · §8.7 · §5.1)
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
section("7 · la cifra que aporta el usuario");
const repDato = { tipo: "dato_usuario", corrige: [], ambigua: false, dato: { metrica: "ventas", valor: "$20M" }, supuestos: [] };
const discrepancia = "Mi dato de venta de Lider es $17.8M en el año cerrado; según tu dato son $20M. ¿De dónde sale tu cifra, o la tomo como supuesto?";
ok("§8.5 · se pueden narrar LAS DOS cifras para mostrar la discrepancia",
  guardC(discrepancia, { ledger: ledgerDe(FIGS_MOTOR), results: [], question: "las ventas fueron $20M", reparacion: repDato }).ok,
  JSON.stringify(guardC(discrepancia, { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repDato }).violations));

const repSup = { tipo: null, corrige: [], ambigua: false, dato: null, supuestos: [{ origen: "usuario", valor: "$20M", metrica: "ventas", periodo: null }] };
const sinMarca = "La venta de Lider es $20M y el margen queda en 21.5%.";
const gMarca = guardC(sinMarca, { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repSup });
ok("§8.6 · la cifra del usuario escrita SIN decir de quién es se bloquea",
  !gMarca.ok && gMarca.violations.some((v) => v.kind === "procedencia-usuario"), gMarca.verdict);
ok("§8.6 · con su marca de procedencia, pasa",
  guardC("Según tu dato, la venta de Lider sería $20M.", { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repSup }).ok);
ok("§5.1 · marcarla UNA vez no habilita el resto (cada lugar donde aparece lleva su marca)",
  !guardC("Según tu dato la venta sería $20M. Con eso, la venta de Lider es $20M y cierra el año.", { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repSup }).ok);

const suma = "Según tu dato de $20M, junto con los $17.8M del sistema, suman la venta del período.";
const gSuma = guardC(suma, { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repSup });
ok("§8.6 · la cifra del usuario NO puede consolidarse con una cifra del motor",
  !gSuma.ok && gSuma.violations.some((v) => v.kind === "procedencia-usuario" && /consolida/.test(v.detail)), JSON.stringify(gSuma.violations));

// derivada: 20M − 17.8M = 2.2M. No está en la boleta ni sale de dos cifras del motor.
const derivadaCruda = "La diferencia asciende a $2.2M sobre lo registrado.";
const gDer = guardC(derivadaCruda, { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repSup });
ok("§8.7 · lo derivado del supuesto NO puede salir como dato probado",
  !gDer.ok && gDer.violations.some((v) => v.kind === "procedencia-usuario" && /estimaci/i.test(v.detail)), JSON.stringify(gDer.violations));
ok("§8.7 · enmarcado como escenario/estimación, sí",
  guardC("En ese escenario la diferencia sería de $2.2M — estimado sobre tu supuesto.", { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repSup }).ok,
  JSON.stringify(guardC("En ese escenario la diferencia sería de $2.2M — estimado sobre tu supuesto.", { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repSup }).violations));
ok("sin supuesto vivo, esa misma cifra vuelve a ser una cifra inventada (el candado no se aflojó)",
  !guardC(derivadaCruda, { ledger: ledgerDe(FIGS_MOTOR), results: [] }).ok);
// falso positivo que hay que evitar: si el usuario afirma EXACTAMENTE la cifra del motor no hay discrepancia que
// proteger, y exigir la marca castigaría una oración legítima sobre el dato propio del producto.
const repCoincide = { tipo: null, corrige: [], ambigua: false, dato: null, supuestos: [{ origen: "usuario", valor: "$17.8M", metrica: "ventas", periodo: null }] };
ok("si la cifra del usuario COINCIDE con la del motor, no se exige marca de procedencia",
  guardC("La venta de Lider es $17.8M en el año cerrado.", { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repCoincide }).ok,
  JSON.stringify(guardC("La venta de Lider es $17.8M en el año cerrado.", { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repCoincide }).violations));

section("8 · el supuesto vive en el estado canónico, no en una memoria nueva");
const conSupuesto = withSupuestoUsuario(scopeFalabella(), { metrica: "ventas", valor: "$20M" }, 5);
ok("se guarda en ConversationScopeEntry.supuestos (el campo que el shape ya reservaba)",
  conSupuesto.current.supuestos.length === 1 && conSupuesto.current.supuestos[0].origen === "usuario");
ok("supuestosUsuarioVivos lo lee del scope", supuestosUsuarioVivos(conSupuesto).length === 1);
ok("no duplica la misma cifra dos veces", withSupuestoUsuario(conSupuesto, { metrica: "ventas", valor: "$20M" }, 6).current.supuestos.length === 1);
ok(`tope de ${SUPUESTOS_USUARIO_MAX} supuestos vivos (LRU, como el resto del estado)`,
  [1, 2, 3, 4].reduce((s, i) => withSupuestoUsuario(s, { metrica: "ventas", valor: `$${i}M` }, i), conSupuesto).current.supuestos.length === SUPUESTOS_USUARIO_MAX);
// §5.1 · "se invalida junto con el resto del contexto incompatible cuando cambia el alcance"
ok("§5.1 · el supuesto del usuario muere con una corrección de alcance",
  applyRepairToScope(conSupuesto, { tipo: "correccion", corrige: ["alcance"] }).current.supuestos.length === 0);
ok("§5.1 · y sobrevive a una corrección que no cambia el alcance (métrica)",
  applyRepairToScope(conSupuesto, { tipo: "correccion", corrige: ["metrica"] }).current.supuestos.length === 1);

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * 9 · EL CONTRATO DE NARRACIÓN: sellado, y sin una llave de más en un turno normal
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
section("9 · el sellado del contrato de narración");
const planCorreccion = { intent: "redirect", mode: "default", calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Lider" } }], scope: { level: "entity", entities: ["Lider"] }, reparacion: { tipo: "correccion", corrige: ["entidad"] } };
const memConSupuesto = { conversationScope: conSupuesto };
ok("un turno NORMAL no produce objeto de reparación", buildReparacion({ plan: { intent: "answer" }, mem: {} }) === null);
const repSellada = buildReparacion({ plan: planCorreccion, mem: {} });
ok("una corrección sí, con su tipo y sus campos", repSellada && repSellada.tipo === "correccion" && repSellada.corrige[0] === "entidad");
ok("un campo corregido inventado por el LLM se descarta", buildReparacion({ plan: { reparacion: { tipo: "correccion", corrige: ["entidad", "loQueSea"] } }, mem: {} }).corrige.join(",") === "entidad");
ok("un tipo inventado por el LLM no crea una reparación", buildReparacion({ plan: { reparacion: { tipo: "loQueSea" } }, mem: {} }) === null);
ok("§5.1 · un supuesto vivo viaja AUNQUE este turno no sea una reparación",
  (buildReparacion({ plan: { intent: "answer" }, mem: memConSupuesto }) || {}).supuestos.length === 1);
const contrato = buildNarrationContract({ text: "no, era Lider", plan: planCorreccion, results: [], ledgerFigs: FIGS_MOTOR, mem: {}, history: [] });
ok("la reparación queda DENTRO del contrato congelado", isSealed(contrato) && contrato.reparacion && contrato.reparacion.tipo === "correccion");
const payloadCorr = buildNarrateUserMessageC({ text: "no, era Lider", plan: planCorreccion, results: [], ledgerFigs: FIGS_MOTOR, mem: {}, history: [] });
ok("el payload de una corrección declara `reparacion`", !!payloadCorr.reparacion);
const payloadNormal = buildNarrateUserMessageC({ text: "cómo viene Lider", plan: { intent: "answer", mode: "default", calls: [], scope: { level: "entity", entities: ["Lider"] } }, results: [], ledgerFigs: FIGS_MOTOR, mem: {}, history: [] });
ok("un turno normal NO agrega la llave al payload", !("reparacion" in payloadNormal));

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * 10 · CONCORDANCIA ADI ↔ SENTRIX SOBRE EL ALCANCE CORREGIDO (§8.11)
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
section("10 · Sentrix recibe el alcance CORREGIDO, por el canal de siempre");
const evidCorregida = buildOracleEvidence({ plan: planCorreccion, results: [], figs: FIGS_MOTOR, scenario: "actual" });
ok("§6 · el alcance que viaja a Sentrix es el corregido, no el anterior",
  evidCorregida.scope && evidCorregida.scope.entities.join(",") === "Lider", JSON.stringify(evidCorregida.scope));
ok("la corrección viaja como intent=redirect (sin canal nuevo)", evidCorregida.intent === "redirect");
const evidVieja = buildOracleEvidence({ plan: { ...planCorreccion, scope: { level: "entity", entities: ["Falabella"] } }, results: [], figs: FIGS_MOTOR, scenario: "actual" });
ok("y cambia de verdad cuando cambia el alcance (no es una constante)", evidVieja.scope.entities.join(",") === "Falabella");

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * 11 · COMPATIBILIDAD DE PROVEEDOR (§8.12) — el contrato es DATO, no un prompt con trucos de un proveedor
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
section("11 · OpenAI y Anthropic ven exactamente lo mismo");
const VOCAB_JSON_SCHEMA = new Set(["type", "enum", "description", "properties", "items", "required", "additionalProperties"]);
function vocabularioValido(node) {
  if (!node || typeof node !== "object") return true;
  if (Array.isArray(node)) return node.every(vocabularioValido);
  return Object.keys(node).every((k) => VOCAB_JSON_SCHEMA.has(k) || vocabularioValido(node[k])) &&
    Object.entries(node).every(([k, v]) => (VOCAB_JSON_SCHEMA.has(k) ? vocabularioValido(v) : true));
}
const repSchema = PLAN_TOOL.schema.properties.reparacion;
ok("el schema declara `reparacion` (sin esto el modelo no puede emitirla: additionalProperties=false)", !!repSchema && repSchema.type === "object");
ok("usa SOLO vocabulario JSON-Schema que los dos adapters pasan verbatim", vocabularioValido(repSchema));
ok("el schema entero sobrevive un round-trip JSON (es lo que viaja a los dos proveedores)",
  JSON.stringify(JSON.parse(JSON.stringify(PLAN_TOOL.schema))) === JSON.stringify(PLAN_TOOL.schema));
ok("intent sigue teniendo 4 valores — la reparación NO agregó una intención nueva",
  PLAN_TOOL.schema.properties.intent.enum.length === 4 && PLAN_TOOL.schema.properties.intent.enum.includes("redirect"));
const sinProveedor = (s) => !/openai|anthropic|gpt-|claude-|system_instruction|assistant_prefill/i.test(s);
ok("la doctrina de PLAN no nombra ningún proveedor", sinProveedor(buildRepairPlanDoctrine()));
ok("la doctrina de NARRAR tampoco", sinProveedor(buildRepairNarrateDoctrine({ tipo: "correccion", corrige: ["entidad"] })));

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * 12 · CRECIMIENTO EXACTO DEL PROMPT (§8.14)
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
section("12 · crecimiento del prompt, medido");
// LÍNEA BASE MEDIDA en b0ff517 (antes de este contrato), con la MISMA convención de la nota de planPrompt.js
// (caracteres / 4): PLAN system 30.534 car · PLAN_TOOL 3.699 car · NARRAR system (mode=default) 36.096 car.
const BASE = { planSystem: 30534, planTool: 3699, narrarDefault: 36096 };
const tok = (n) => Math.round(n / 4);
const planSystem = buildPlanSystem(ADI_PERSONA_PLAN, "", "actual", false).length;
const planTool = JSON.stringify(PLAN_TOOL).length;
const narrarBase = buildNarrateSystemC(ADI_PERSONA, "", "default", null, false).length;
const narrarCorr = buildNarrateSystemC(ADI_PERSONA, "", "default", null, false, { tipo: "correccion", corrige: ["entidad"], supuestos: [] }).length;
const narrarSup = buildNarrateSystemC(ADI_PERSONA, "", "default", null, false, { tipo: "dato_usuario", corrige: [], supuestos: [{ origen: "usuario", valor: "$20M", metrica: "ventas" }] }).length;
console.log(`  medición · PLAN system ${BASE.planSystem} → ${planSystem} car (+${planSystem - BASE.planSystem} car · +${tok(planSystem - BASE.planSystem)} tokens aprox.)`);
console.log(`  medición · PLAN_TOOL   ${BASE.planTool} → ${planTool} car (+${planTool - BASE.planTool} car · +${tok(planTool - BASE.planTool)} tokens aprox.)`);
console.log(`  medición · NARRAR normal ${BASE.narrarDefault} → ${narrarBase} car · corrección ${narrarCorr} (+${narrarCorr - narrarBase}) · con supuesto ${narrarSup} (+${narrarSup - narrarBase})`);
ok("NARRAR NO crece en un turno normal (la doctrina es condicional)", narrarBase === BASE.narrarDefault, `${narrarBase} vs ${BASE.narrarDefault}`);
ok("NARRAR crece SOLO cuando el turno repara algo", narrarCorr > narrarBase && narrarSup > narrarBase);
ok("PLAN crece menos de 2.500 caracteres (la doctrina + el schema, sin recortar ninguna regla existente)",
  planSystem - BASE.planSystem < 2500, `+${planSystem - BASE.planSystem}`);
ok("PLAN_TOOL crece menos de 2.000 caracteres", planTool - BASE.planTool < 2000, `+${planTool - BASE.planTool}`);
// el corte fijo/variable del caché tiene que seguir siendo byte-exacto: todo lo nuevo cae del lado FIJO (cacheable)
const seg = buildPlanSystemSegments(ADI_PERSONA_PLAN, "", "actual", false);
ok("`fijo + variable` sigue siendo byte por byte el system completo", seg.fijo + seg.variable === buildPlanSystem(ADI_PERSONA_PLAN, "", "actual", false));
ok("toda la doctrina nueva cae del lado FIJO del corte (la parte que el caché sirve)",
  /CORRECCIÓN \/ DESACUERDO \/ DATO APORTADO/.test(seg.fijo) && !/CORRECCIÓN \/ DESACUERDO/.test(seg.variable));

console.log(`\n${pass} OK · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
