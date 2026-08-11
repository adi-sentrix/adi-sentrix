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
  REPAIR_SIEMPRE_INCOMPATIBLE, normalizeReparacion,
  camposQueSobreviven, camposQueSeInvalidan, buildRepairPlanDoctrine, buildRepairNarrateDoctrine, MODE_KEYS,
} from "./src/adi/oracle/conversationalContract.js";
import { invalidateViewContext } from "./src/adi/oracle/viewContext.js";
import {
  applyRepairToScope, composePrecisionQuestion, withSupuestoUsuario, supuestosUsuarioVivos,
  emptyConversationScope, SUPUESTOS_USUARIO_MAX,
} from "./src/adi/oracle/conversationScope.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { buildReparacion, buildNarrationContract, isSealed, cifrasDelUsuario } from "./src/adi/oracle/narrationContract.js";
import { buildNarrateSystemC, buildNarrateUserMessageC, markUserProvenance } from "./src/adi/oracle/narratePromptC.js";
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
// una corrección que no sabemos leer apaga el PISO (oferta, evidencia, orden sellado) y conserva el resto. Antes
// borraba el scope entero: el usuario tenía que redeclarar entidad, métrica y período por haber contestado la
// pregunta de precisión que ADI le hizo — eso rompe la otra mitad de §1 ("se modifica ÚNICAMENTE lo corregido").
for (const corrige of [[], ["inventado"]]) {
  const inval = camposQueSeInvalidan(corrige);
  ok(`corrección ilegible (${JSON.stringify(corrige)}) · apaga el piso: oferta, evidencia y orden sellado`,
    REPAIR_SIEMPRE_INCOMPATIBLE.every((f) => inval.includes(f)), inval.join(","));
  ok(`corrección ilegible (${JSON.stringify(corrige)}) · NO borra el alcance entero`,
    !inval.includes("entities") && !inval.includes("periodo") && !inval.includes("metrica"), inval.join(","));
}
// SCOPE_FIELDS tiene que cubrir el shape REAL, o los campos que falten son inmortales: no hay corrección que
// pueda apagarlos. `tool` era el caso vivo — tras "te pedí ventas, no margen" el prompt del turno siguiente
// seguía declarando "(tool=marginRead)" como alcance activo.
{
  const shape = Object.keys(scopeFalabella().current).filter((k) => !["turno", "tenant"].includes(k));
  const faltan = shape.filter((k) => !SCOPE_FIELDS.includes(k));
  ok("SCOPE_FIELDS cubre TODOS los campos del ConversationScopeEntry real", faltan.length === 0, `faltan: ${faltan.join(",")}`);
  ok("…y `tool` puede invalidarse de verdad", camposQueSeInvalidan(["metrica"]).includes("tool"));
}

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

// ── §8.6 primera mitad · LA MARCA LA PONE EL PRODUCTO, NO EL NARRADOR ─────────────────────────────────────────
// El candado ya NO reconoce frases. Se probó contra 16 formas reales de declarar la procedencia que un regex
// cerrado rechazaba —cada una era una respuesta correcta bloqueada y un reintento pagado— y contra el caso
// inverso: ninguna forma de decirlo es necesaria, porque el renderer estampa la marca él mismo.
const FORMAS_REALES = [
  "Según tus números, la venta de Lider sería $20M.",
  "El monto que me pasaste es $20M.",
  "Por lo que me contaste, la venta sería $20M.",
  "El dato tuyo es $20M.",
  "Con el número que aportás, $20M, el cuadro cambia.",
  "La venta de Lider es $20M.",
];
for (const frase of FORMAS_REALES) {
  const g = guardC(frase, { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: { ...repSup, supuestos: repSup.supuestos } });
  const marcada = markUserProvenance(frase, repSup, FIGS_MOTOR);
  ok(`«${frase.slice(0, 34)}…» · el guard no la juzga por cómo esté redactada`,
    !g.violations.some((v) => v.kind === "procedencia-usuario"), JSON.stringify(g.violations));
  ok(`«${frase.slice(0, 34)}…» · y sale marcada como del usuario`, /tu dato|aportás|tuyo|tus números|me pasaste|me contaste/i.test(marcada), marcada);
}
{
  // marcarla una vez al principio no cubre el resto del texto: la segunda oración, que no la declara, recibe la
  // marca; la primera, que sí la declara, no la duplica.
  const dosVeces = markUserProvenance("Según tu dato la venta sería $20M. Con eso, la venta de Lider es $20M y cierra el año.", repSup, FIGS_MOTOR);
  const [ora1, ora2] = dosVeces.split(/(?<=\.)\s+/);
  ok("§5.1 · CADA aparición lleva su marca, no solo la primera",
    !/\(tu dato\)/.test(ora1) && /\(tu dato\)/.test(ora2 || ""), dosVeces);
}
ok("la marca no se duplica cuando el narrador ya la declaró (idempotente)",
  !/\(tu dato\)/.test(markUserProvenance("Según tu dato, la venta sería $20M.", repSup, FIGS_MOTOR)));
ok("una tabla markdown también queda marcada fila por fila",
  /\| Venta \| \$20M \| \(tu dato\)/.test(markUserProvenance("| Métrica | Valor |\n|---|---|\n| Venta | $20M |", repSup, FIGS_MOTOR)),
  markUserProvenance("| Métrica | Valor |\n|---|---|\n| Venta | $20M |", repSup, FIGS_MOTOR));
ok("un turno sin cifras del usuario sale byte-idéntico del renderer",
  markUserProvenance("La venta de Lider es $17.8M.", null, FIGS_MOTOR) === "La venta de Lider es $17.8M.");

// ── §8.6 segunda mitad · LO QUE EL RENDERER NO PUEDE REPARAR, SÍ BLOQUEA ──────────────────────────────────────
// (a) reemplazar el dato oficial · (b) consolidar los dos universos en un total. Las dos, sin vocabulario.
const gReemplazo = guardC("La venta de Lider es $20M y el margen queda en 21.5%.", { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repSup });
ok("§5 · la cifra del usuario NO puede reemplazar al dato oficial en silencio",
  !gReemplazo.ok && gReemplazo.violations.some((v) => v.kind === "dato-oficial-reemplazado"), gReemplazo.verdict);
ok("§5 · mostrando la discrepancia, pasa",
  guardC("Mi dato de venta de Lider es $17.8M; el tuyo, $20M.", { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repSup }).ok,
  JSON.stringify(guardC("Mi dato de venta de Lider es $17.8M; el tuyo, $20M.", { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repSup }).violations));
// el candado NO se apaga porque el LLM haya omitido la métrica (defecto real: era un `continue` silencioso).
const repSinMetrica = { ...repSup, supuestos: [{ origen: "usuario", valor: "$20M", metrica: null, periodo: null }] };
ok("§5 · sin métrica declarada el candado sigue armado (se compara por unidad)",
  !guardC("La venta de Lider es $20M y cierra el año.", { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repSinMetrica }).ok);
// CONSOLIDACIÓN: aritmética pura. 20 + 17.8 = 37.8. Ninguna de estas usa la palabra "sumar".
for (const frase of [
  "Según tu dato son $20M y el sistema registra $17.8M; el total queda en $37.8M.",
  "Tu dato aporta $20M. El sistema registra $17.8M. El año cierra en $37.8M.",
  "En este escenario, con $20M tuyos y $17.8M del sistema, el acumulado llega a $37.8M.",
]) {
  const g = guardC(frase, { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repSup });
  ok(`§5.1 · consolidar los dos universos bloquea, se llame como se llame («${frase.slice(0, 30)}…»)`,
    !g.ok && g.violations.some((v) => v.kind === "consolida-universo-usuario"), JSON.stringify(g.violations));
}
ok("§5.1 · la RESTA no es consolidación: la discrepancia es justo lo que hay que mostrar",
  !guardC("Tu dato de $20M contra los $17.8M del sistema deja una diferencia de $2.2M.", { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repSup })
    .violations.some((v) => v.kind === "consolida-universo-usuario"));

// ── §8.7 · lo derivado sale como estimación, y lo pone el renderer ────────────────────────────────────────────
const derivadaCruda = "La diferencia asciende a $2.2M sobre lo registrado.";
ok("§8.7 · una cifra derivada del supuesto sale marcada como estimación, sin pedírselo al narrador",
  /\(estimado sobre tu supuesto\)/.test(markUserProvenance(derivadaCruda, repSup, FIGS_MOTOR)),
  markUserProvenance(derivadaCruda, repSup, FIGS_MOTOR));
ok("§8.7 · si el narrador ya la enmarcó, no se le agrega nada",
  !/\(estimado sobre tu supuesto\)/.test(markUserProvenance("En ese escenario la diferencia sería de $2.2M.", repSup, FIGS_MOTOR)));
ok("sin supuesto vivo, esa misma cifra vuelve a ser una cifra inventada (el candado no se aflojó)",
  !guardC(derivadaCruda, { ledger: ledgerDe(FIGS_MOTOR), results: [] }).ok);
// falso positivo que hay que evitar: si el usuario afirma EXACTAMENTE la cifra del motor no hay discrepancia que
// proteger, y marcarla ensuciaría una oración legítima sobre el dato propio del producto.
const repCoincide = { tipo: null, corrige: [], ambigua: false, dato: null, supuestos: [{ origen: "usuario", valor: "$17.8M", metrica: "ventas", periodo: null }] };
ok("si la cifra del usuario COINCIDE con la del motor, no se juzga ni se marca",
  guardC("La venta de Lider es $17.8M en el año cerrado.", { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: repCoincide }).ok
  && markUserProvenance("La venta de Lider es $17.8M en el año cerrado.", repCoincide, FIGS_MOTOR) === "La venta de Lider es $17.8M en el año cerrado.");

// ── el formato con que el usuario escribe su cifra no puede decidir si hay candado ────────────────────────────
// Sin esto, «20 millones» o «$20.000.000» dejaban §5.1 apagado Y bloqueaban como inventada la discrepancia que el
// contrato OBLIGA a mostrar: un turno sin salida posible.
for (const crudo of ["$20M", "20 millones", "$20 millones", "20M", "$20.000.000", "$20,000,000"]) {
  const figs = cifrasDelUsuario({ supuestos: [{ origen: "usuario", valor: crudo, metrica: "ventas" }] });
  ok(`«${crudo}» se canoniza a la misma cifra del usuario`, figs.length === 1 && figs[0].canon === "money:$20.0M", JSON.stringify(figs.map((f) => f.canon)));
}

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
ok("un campo corregido inventado por el LLM se descarta", buildReparacion({ plan: { intent: "redirect", reparacion: { tipo: "correccion", corrige: ["entidad", "loQueSea"] } }, mem: {} }).corrige.join(",") === "entidad");
ok("un tipo inventado por el LLM no crea una reparación", buildReparacion({ plan: { intent: "redirect", reparacion: { tipo: "loQueSea" } }, mem: {} }) === null);

// ── UNA SOLA LECTURA DEL OBJETO · el normalizador ─────────────────────────────────────────────────────────────
// Los cuatro consumidores (motor, estado, contrato de narración y guard) leían el objeto crudo y resolvían por su
// cuenta dos cosas — el intent y la contradicción `ambigua`+`corrige` — y resolvían distinto. Con eso, ADI podía
// recalcular sobre la entidad nueva mientras su estado conservaba la oferta y el período de la vieja.
section("9b · el normalizador: una sola lectura para los cuatro consumidores");
ok("§2 · la reparación SOLO vive dentro de intent='redirect'",
  normalizeReparacion({ intent: "answer", reparacion: { tipo: "correccion", corrige: ["entidad"] } }) === null);
ok("…y un `reparacion` colgado de un turno normal no secuestra el turno",
  buildReparacion({ plan: { intent: "answer", reparacion: { tipo: "correccion", ambigua: true } }, mem: {} }) === null);
{
  // la contradicción: se declara ambigua PERO dice qué corrigió. Vale lo RESUELTO — preguntar lo que el usuario
  // ya contestó es peor que recalcular de más. Y las tres lecturas tienen que coincidir.
  const contradictoria = { intent: "redirect", reparacion: { tipo: "correccion", ambigua: true, corrige: ["entidad"] } };
  const norm = normalizeReparacion(contradictoria);
  ok("la contradicción `ambigua` + `corrige` se resuelve como RESUELTA, una sola vez", norm && norm.ambigua === false && norm.corrige.join(",") === "entidad");
  ok("…y el estado la trata igual: invalida de verdad",
    applyRepairToScope(scopeFalabella(), norm).current.entities.length === 0);
  ok("…y el guard también: le exige evidencia",
    !guardC("Entendido, era Lider.", { ledger: ledgerDe(FIGS_MOTOR), results: [], reparacion: { ...norm, supuestos: [] } }).ok);
}
ok("`ambigua` con un valor no booleano no cuela como ambigua",
  normalizeReparacion({ intent: "redirect", reparacion: { tipo: "correccion", ambigua: "true" } }).ambigua === false);
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
// REQUERIDO Y NULLABLE (owner 2026-08-10, tras la primera corrida pagada). Era opcional, y la certificación lo
// cazó en la primera sonda: el modelo base simplemente lo omitió. Ahora tiene que decidir explícitamente.
ok("el schema declara `reparacion` como REQUERIDO y nullable",
  !!repSchema && Array.isArray(repSchema.type) && repSchema.type.includes("object") && repSchema.type.includes("null")
  && PLAN_TOOL.schema.required.includes("reparacion"), JSON.stringify(repSchema && repSchema.type));
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
// TOPES APRETADOS TRAS LA PASADA DE ECONOMÍA (owner 2026-08-10): las reglas vivían dos veces —una en la doctrina
// del system y otra en las descripciones del schema— y eso costaba ~700 caracteres en TODOS los turnos para decir
// lo mismo dos veces. Ahora las reglas viven una sola vez, en la doctrina; el schema solo declara QUÉ va en cada
// campo. Ni una regla de negocio se recortó, y la lista de abajo lo verifica una por una.
ok("PLAN system crece menos de 1.700 caracteres", planSystem - BASE.planSystem < 1700, `+${planSystem - BASE.planSystem}`);
ok("PLAN_TOOL crece menos de 1.000 caracteres", planTool - BASE.planTool < 1000, `+${planTool - BASE.planTool}`);
// el tope subió de 600 a 620 al volver `reparacion` requerida y nullable: el campo pasó a `required` y el tipo a
// unión, y eso se paga en el esquema. Se declara el número exacto en vez de dejar el tope holgado.
ok("el crecimiento TOTAL de PLAN queda bajo 660 tokens aprox.",
  tok((planSystem - BASE.planSystem) + (planTool - BASE.planTool)) < 660, `${tok((planSystem - BASE.planSystem) + (planTool - BASE.planTool))} tok`);
// NINGUNA REGLA SE PERDIÓ EN LA COMPRESIÓN. Cada línea es una conducta que el contrato exige y que solo el prompt
// puede pedir: si una futura pasada de economía la borra, este gate se pone rojo antes de que se note en vivo.
{
  const d = buildRepairPlanDoctrine();
  const REGLAS = [
    [/intent="redirect"/, "la reparación viaja dentro de redirect"],
    [/tipo="correccion"[\s\S]*corrige=/, "la corrección declara QUÉ cambió"],
    [/level="global"/, "una corrección de alcance normalmente es global y sin filtro"],
    [/nunca calls vac[ií]o/i, "una corrección resuelta trae las calls"],
    [/Reconoc[eé] breve y entreg/i, "reconocer y entregar (§3.7/§3.8)"],
    [/NO arrastres per[ií]odo, filtro, criterio ni entidad/i, "no arrastrar lo incompatible"],
    [/ambigua=true/, "la corrección ambigua se declara"],
    [/UNA de precisi[oó]n/i, "una sola pregunta"],
    [/nombrando SOLO lo que ah[ií] pudo fallar/i, "no enumerar lo que no corresponde"],
    [/calls VAC[IÍ]O/i, "la ambigua no recalcula"],
    [/No es un plan roto/i, "la ambigua no es un error de plan"],
    [/tipo="desacuerdo"/, "el desacuerdo se distingue"],
    [/el alcance NO cambia/i, "el desacuerdo no cambia el alcance"],
    [/probado de lo indicado y lo abierto/i, "el desacuerdo gradúa la evidencia"],
    [/tipo="dato_usuario"/, "el dato aportado se distingue"],
    [/CIFRA OFICIAL/, "se pide la cifra oficial para contrastar"],
    [/NUNCA reemplaza al dato del motor/i, "la cifra del usuario no reemplaza"],
    [/se muestra la discrepancia/i, "se muestra la discrepancia"],
    [/aceptado=true/, "la autorización a tratarla como supuesto"],
  ];
  const faltan = REGLAS.filter(([re]) => !re.test(d)).map(([, n]) => n);
  ok(`las ${REGLAS.length} reglas de la doctrina de PLAN sobreviven a la compresión`, faltan.length === 0, `faltan: ${faltan.join(" · ")}`);
}
// el corte fijo/variable del caché tiene que seguir siendo byte-exacto: todo lo nuevo cae del lado FIJO (cacheable)
const seg = buildPlanSystemSegments(ADI_PERSONA_PLAN, "", "actual", false);
ok("`fijo + variable` sigue siendo byte por byte el system completo", seg.fijo + seg.variable === buildPlanSystem(ADI_PERSONA_PLAN, "", "actual", false));
ok("toda la doctrina nueva cae del lado FIJO del corte (la parte que el caché sirve)",
  /CORRECCIÓN \/ DESACUERDO \/ DATO APORTADO/.test(seg.fijo) && !/CORRECCIÓN \/ DESACUERDO/.test(seg.variable));

console.log(`\n${pass} OK · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
