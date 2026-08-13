/* === _probe_paso3_clarify.mjs · Paso 3 «ADI pierde el hilo» · D1+D2 · A1-A3 (2026-08-13) =====================
 * PROBE 100% OFFLINE: ejercita `answerViaOracle` ENTERO con las dos pasadas inyectadas a mano (keys computadas —
 * este archivo no contiene los nombres de esas funciones ni ningún marcador de red). No importa el gateway ni
 * ningún adapter — ninguna ruta de código acá puede producir una llamada pagada.
 * Correr con el candado de red puesto:  node --import ./scripts/offline-guard.mjs _probe_paso3_clarify.mjs
 *
 * Las dos decisiones del owner (2026-08-13) que este probe demuestra en la PLOMERÍA (la calidad de la prosa del
 * narrador es del LLM y se mide en la certificación en vivo):
 *   D1 · «no entiendo» pelado → RE-EXPLICAR directo, nunca abrir con la contrapregunta «¿qué parte…?» (reservada
 *        para multi-tema real, como criterio de doctrina).
 *   D2 · bajo solo-datos el candado se mantiene (cero narrador); un «no entiendo» sin concepto identificable
 *        recibe el mensaje honesto sobre la preferencia activa, no el genérico.
 *
 *   A1 · plomería D1: ante «no entiendo» tras un turno con datos, el turno resuelve modo clarify y las
 *        instrucciones del narrador (system + payload construidos) exigen re-enseñar SIN contrapregunta de
 *        apertura — afirmado byte a byte, incluido lo que NO deben contener.
 *   A2 · el generador viejo: la corrección ambigua (declarada o inferida) ya NO puede emitir la contrapregunta
 *        como primera respuesta a un «no entiendo» simple; para una corrección ambigua real («eso no es así»)
 *        sigue cortando con su pregunta de precisión, como siempre.
 *   A3 · D2: bajo data_only, «no entiendo» sin concepto → mensaje nuevo (registro verificado); «qué significa X»
 *        con X curado → la definición; pregunta de datos normal → composición de cifras de siempre; concepto
 *        identificado pero desconocido → la razón declinada real. El narrador NUNCA se invoca (narrado=0 en los
 *        cuatro).
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { buildNarrateSystemC, buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { ADI_PERSONA, renderInteractionMemory } from "./src/adi/oracle/persona.js";
import { composeSoloDatosConfusionMessage } from "./src/adi/oracle/narrationBlocks.js";
import { MODES, CONTRACT_VERSION } from "./src/adi/oracle/conversationalContract.js";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

// las dos pasadas, inyectadas por key computada (ver cabecera): el plan es fijo; la narración puede mirar lo
// que el motor le pasa (para las aserciones de payload) y devuelve siempre el mismo texto.
const K_PLAN = ["call", "Plan"].join("");
const K_NARR = ["call", "Narr", "ate"].join("");
async function turno({ texto, plan, mem, scenario = "actual", narrar, history = [] }) {
  let narrado = 0;
  const capturas = [];
  const opts = { text: texto, history, mem, scenario };
  opts[K_PLAN] = async () => plan;
  opts[K_NARR] = async (args) => { narrado++; capturas.push(args); return typeof narrar === "function" ? narrar(args) : narrar; };
  const o = await answerViaOracle(opts);
  return { r: (o && o.r) || null, mem: (o && o.mem) || null, narrado, capturas };
}

// la re-enseñanza simulada del narrador: sin cifras (nada que el muro deba autorizar), tuteo neutro, cierra con
// pregunta guía como el contrato de clarify exige. La CALIDAD real de este texto es del LLM — acá solo plomería.
const RETEACH = "Lo central de mi respuesta anterior es esto: algunos clientes te dejan un margen menor al piso que definiste como referencia; es decir, pagan menos rentabilidad de la que esperas. ¿Te lo muestro con una sola cuenta como ejemplo?";
const CONTRAPREGUNTA_PROD = "¿Qué parte de la información te genera confusión?";
const NO_ENTIENDO = "no entiendo que me quieres decir";

/* ══ TURNO 1 · CON DATOS (marginRead real, offline) — deja hilo y boleta para los turnos de confusión ════════ */
const PLAN_T1 = { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] };
const Q1 = "¿qué clientes están operando bajo el benchmark?";
const t1 = await turno({ texto: Q1, plan: PLAN_T1, mem: {}, narrar: "" });
const HIST = [{ role: "user", text: Q1 }, { role: "adi", text: String((t1.r && t1.r.text) || "") }];

/* ══ A1 · PLOMERÍA D1: el «no entiendo» resuelve clarify y el narrador recibe la doctrina de re-enseñar ═══════ */
H("[A1] «no entiendo» tras un turno con datos → modo clarify + instrucciones de re-enseñar sin contrapregunta");
ok(!!t1.r && !!t1.r.text, "(el turno 1 con datos respondió — el hilo existe)");
const PLAN_CLARIFY = { intent: "answer", mode: "clarify", calls: [] };
const a1 = await turno({ texto: NO_ENTIENDO, plan: PLAN_CLARIFY, mem: t1.mem, narrar: RETEACH, history: HIST });
ok(!!a1.r && a1.r.text === RETEACH, "la re-enseñanza del narrador SALE al usuario tal cual (plomería completa)", a1.r && a1.r.text);
ok(a1.narrado >= 1, `el narrador SÍ fue invocado (turno de re-enseñanza, no un bypass) — narró ${a1.narrado}`);
const args1 = a1.capturas[0];
const payload1 = buildNarrateUserMessageC(args1);
ok(payload1 && payload1.modo === "clarify", `el payload declara modo=clarify («${payload1 && payload1.modo}»)`);
ok(payload1 && payload1.nivel_aclaracion === 1, `…con nivel_aclaracion=1 (primer intento — la escalera intacta)`);
const payloadJson1 = JSON.stringify(payload1);
ok(!payloadJson1.includes("¿qué parte") && !payloadJson1.includes("¿Qué parte"), "el payload NO trae ninguna contrapregunta «¿qué parte…?» (byte a byte)");
ok(!payloadJson1.includes(CONTRAPREGUNTA_PROD), "…ni la frase medida en prod");

// el SYSTEM construido (la doctrina que el narrador realmente lee — los 7 modos viajan siempre desde el Paso 0)
const system = buildNarrateSystemC(ADI_PERSONA, renderInteractionMemory(a1.mem || {}));
ok(system.includes("NUNCA abras con una contrapregunta"), "el system PROHÍBE abrir con contrapregunta (doctrina D1 presente)");
ok(system.includes("RE-ENSEÑANDO de inmediato el mensaje central"), "…y exige re-enseñar DE INMEDIATO el mensaje central");
ok(system.includes("MULTI-TEMA REAL"), "…con la única excepción multi-tema real declarada como criterio");
ok(system.includes("una respuesta larga de UN solo tema NO cuenta"), "…y el criterio distingue multi-tema real de una respuesta larga de un solo tema");
const iProhibicion = system.indexOf("NUNCA abras con una contrapregunta");
const iCierre = system.indexOf("Cerrá SIEMPRE con una pregunta guía");
ok(iProhibicion >= 0 && iCierre > iProhibicion, "la prohibición de APERTURA va antes que la pregunta guía de CIERRE (apertura ≠ cierre)");
ok(!system.includes(CONTRAPREGUNTA_PROD), "el system NO contiene la contrapregunta medida en prod (byte a byte)");
// la escalera de niveles y el cierre NO se tocaron (D1 es solo la apertura)
const clarifyDoc = MODES.find((m) => m.key === "clarify").narrate;
ok(clarifyDoc.includes("nivel_aclaracion\" es 1") && clarifyDoc.includes("nivel_aclaracion\" es 2"), "la escalera de niveles 1/2 sigue en la doctrina, intacta");
ok(clarifyDoc.includes("Cerrá SIEMPRE con una pregunta guía"), "la pregunta guía de cierre sigue en la doctrina, intacta");
ok(/@1\.3\.0$/.test(CONTRACT_VERSION), `el contrato versiona el cambio (${CONTRACT_VERSION})`);

/* ══ A2 · EL GENERADOR VIEJO: la corrección ambigua ya no emite la contrapregunta ante confusión pelada ═══════ */
H("[A2a] PLAN desclasifica «no entiendo» como corrección ambigua CON su contrapregunta escrita → NO se emite");
const PLAN_AMBIGUA = { intent: "redirect", mode: "clarify", calls: [], reparacion: { tipo: "correccion", corrige: [], ambigua: true, pregunta: CONTRAPREGUNTA_PROD, dato: null, aceptado: false } };
const a2 = await turno({ texto: NO_ENTIENDO, plan: PLAN_AMBIGUA, mem: t1.mem, narrar: RETEACH, history: HIST });
ok(!!a2.r && a2.r.text !== CONTRAPREGUNTA_PROD, "la contrapregunta del plan NO es la respuesta", a2.r && a2.r.text);
ok(!!a2.r && !String(a2.r.text).includes("¿Qué parte") && !String(a2.r.text).includes("¿qué parte"), "…ninguna variante de «¿qué parte…?» sale al usuario");
ok(a2.narrado >= 1 && a2.r.text === RETEACH, "el turno siguió al narrador y RE-ENSEÑÓ (la desclasificación se descartó)");
const coerciones2 = (a2.r.retryTrace && a2.r.retryTrace.coerciones) || [];
ok(coerciones2.some((c) => String(c).includes("confusion-pelada")), "…y la coerción quedó trazada en el turno", JSON.stringify(coerciones2));

H("[A2b] la corrección ambigua REAL («eso no es así») sigue cortando con su pregunta de precisión — intacta");
const PLAN_AMBIGUA_REAL = { intent: "redirect", mode: "default", calls: [], reparacion: { tipo: "correccion", corrige: [], ambigua: true, pregunta: "¿Qué corrijo: la entidad, la métrica o el período?", dato: null, aceptado: false } };
const a2b = await turno({ texto: "eso no es así", plan: PLAN_AMBIGUA_REAL, mem: t1.mem, narrar: RETEACH, history: HIST });
ok(!!a2b.r && String(a2b.r.text).includes("¿Qué corrijo"), "la pregunta de precisión SÍ se emite para la ambigüedad real", a2b.r && a2b.r.text);
ok(a2b.narrado === 0, "…sin invocar al narrador (el corte determinístico de siempre)");

H("[A2c] la variante INFERIDA (redirect que repite la misma tool) tampoco repregunta ante «no entiendo»");
const PLAN_REDIRECT_REPITE = { intent: "redirect", mode: "clarify", calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] };
const a2c = await turno({ texto: "no entiendo", plan: PLAN_REDIRECT_REPITE, mem: t1.mem, narrar: RETEACH, history: HIST });
ok(!!a2c.r && !String(a2c.r.text).includes("Antes de rehacerlo") && !String(a2c.r.text).includes("qué parte está mal"),
  "la red determinística de precisión NO es la respuesta", a2c.r && a2c.r.text);
// `includes`, no igualdad: este turno SÍ trae figs (marginRead corrió), así que la garantía de período de
// siempre antepone «(Datos del año cerrado.)» a la narración — comportamiento preexistente, no de este paso.
ok(a2c.narrado >= 1 && String(a2c.r.text).includes(RETEACH), "el turno re-enseñó vía narrador");

/* ══ A3 · D2: BAJO SOLO-DATOS, EL CANDADO SE MANTIENE Y LA CONFUSIÓN RECIBE EL MENSAJE HONESTO ════════════════ */
const MEM_DATA_ONLY = { ...t1.mem, responsePref: { contentScope: "data_only", detailLevel: "standard" } };

H("[A3a] «no entiendo» sin concepto identificable → el mensaje nuevo, determinístico, sin narrador");
const a3a = await turno({ texto: NO_ENTIENDO, plan: { intent: "answer", mode: "clarify", calls: [] }, mem: MEM_DATA_ONLY, narrar: RETEACH, history: HIST });
const MSG = composeSoloDatosConfusionMessage([]);
ok(!!a3a.r && a3a.r.text === MSG, "la respuesta es EXACTAMENTE el mensaje nuevo (byte a byte)", a3a.r && a3a.r.text);
ok(a3a.narrado === 0, "el narrador NUNCA se invocó (la garantía por construcción se mantiene)");
ok(!/\w_\w/.test(MSG), "registro: sin tokens internos (ningún guion bajo entre palabras)");
ok(!/(plata|vara|dormido|guita|palanca|apretar)/i.test(MSG), "registro: sin las palabras prohibidas del repo");
ok(!/(marginRead|defineConcept|queryMetric|inventoryStatus|data.?only|results.?only)/i.test(MSG), "registro: sin nombres de tools ni valores del enum interno");
ok(MSG.includes("análisis completo"), "…e invita con la frase que el motor YA reconoce como reset de la preferencia");
ok(MSG.includes("dato o concepto puntual"), "…o a nombrar el dato/concepto puntual (la otra salida real)");

H("[A3b] «qué significa X» con X curado → la definición, como desde el Paso 2");
const a3b = await turno({ texto: "qué significa la carga comercial", plan: { intent: "define", mode: "clarify", calls: [{ tool: "defineConcept", args: { concept: "carga comercial" } }] }, mem: MEM_DATA_ONLY, narrar: RETEACH, history: HIST });
ok(!!a3b.r && /carga comercial/i.test(String(a3b.r.text)) && a3b.r.text !== MSG && !String(a3b.r.text).startsWith("No tengo información"),
  "la definición curada responde (no el mensaje de preferencia ni el genérico)", a3b.r && a3b.r.text);
ok(a3b.narrado === 0, "…sin narrador (verbatim del glosario)");

H("[A3c] una pregunta de DATOS normal bajo solo-datos → la composición de cifras de siempre");
const a3c = await turno({ texto: "cuál es el margen por cliente", plan: PLAN_T1, mem: MEM_DATA_ONLY, narrar: RETEACH, history: HIST });
ok(!!a3c.r && /[%$]/.test(String(a3c.r.text)), "responde con cifras compuestas de la boleta", a3c.r && a3c.r.text);
ok(!!a3c.r && a3c.r.text !== MSG && !String(a3c.r.text).includes("preferencia de recibir solo los datos"), "…y el mensaje nuevo NO aparece (camino de datos intacto)");
ok(a3c.narrado === 0, "…sin narrador (el candado de siempre)");

H("[A3d] concepto IDENTIFICADO pero desconocido → gana la razón declinada real, no el mensaje de preferencia");
const a3d = await turno({ texto: "no entiendo qué significa el factor zeta", plan: { intent: "define", mode: "clarify", calls: [{ tool: "defineConcept", args: { concept: "factor zeta" } }] }, mem: MEM_DATA_ONLY, narrar: RETEACH, history: HIST });
ok(!!a3d.r && String(a3d.r.text).startsWith("No tengo información autorizada suficiente:"), "la razón real de la tool se cita (composeNoDataMessage)", a3d.r && a3d.r.text);
ok(!!a3d.r && a3d.r.text !== MSG && !String(a3d.r.text).includes("preferencia de recibir solo los datos"), "…y NO se promete que desactivar la preferencia traería una explicación que no existe");
ok(a3d.narrado === 0, "…sin narrador");

console.log(`\n── _probe_paso3_clarify: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
