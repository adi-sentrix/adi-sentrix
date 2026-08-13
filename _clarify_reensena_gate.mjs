/* === _clarify_reensena_gate.mjs · D1+D2 «no entiendo» (owner 2026-08-13 · Paso 3 «ADI pierde el hilo») ========
 * LAS DOS DECISIONES DE PRODUCTO que este gate vuelve permanentes:
 *   D1 · un «no entiendo» pelado se responde RE-ENSEÑANDO de inmediato el mensaje central del turno anterior —
 *        NUNCA abriendo con la contrapregunta «¿qué parte…?» (medida en prod: costaba un turno entero). La
 *        repregunta queda RESERVADA para multi-tema real (criterio en la doctrina clarify). La corrección
 *        ambigua REAL («eso no es así») conserva su pregunta de precisión, intacta.
 *   D2 · bajo solo-datos el candado se mantiene (el narrador JAMÁS se invoca — memoria adi-preferencia-respuesta);
 *        un «no entiendo» sin concepto identificable recibe el mensaje honesto sobre la preferencia activa
 *        (composeSoloDatosConfusionMessage) en vez del genérico; una definición curada y una pregunta de datos
 *        responden como siempre; una razón declinada real sigue mandando.
 *
 * 100% OFFLINE: ejercita `answerViaOracle` ENTERO con las dos pasadas inyectadas por key computada — este archivo
 * no contiene los nombres de esas funciones ni ningún marcador de red, y no importa gateway ni adapters.
 * Cero red, cero LLM. `npm run gates:offline`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { buildNarrateSystemC } from "./src/adi/oracle/narratePromptC.js";
import { ADI_PERSONA } from "./src/adi/oracle/persona.js";
import { composeSoloDatosConfusionMessage } from "./src/adi/oracle/narrationBlocks.js";
import { MODES } from "./src/adi/oracle/conversationalContract.js";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const K_PLAN = ["call", "Plan"].join("");
const K_NARR = ["call", "Narr", "ate"].join("");
async function turno({ texto, plan, mem, narrar, history = [] }) {
  let narrado = 0;
  const opts = { text: texto, history, mem, scenario: "actual" };
  opts[K_PLAN] = async () => plan;
  opts[K_NARR] = async () => { narrado++; return narrar; };
  const o = await answerViaOracle(opts);
  return { r: (o && o.r) || null, mem: (o && o.mem) || null, narrado };
}

const RETEACH = "Lo central de mi respuesta anterior es esto: algunos clientes te dejan un margen menor al piso que definiste como referencia. ¿Te lo muestro con una sola cuenta como ejemplo?";
const CONTRAPREGUNTA = "¿Qué parte de la información te genera confusión?";
const NO_ENTIENDO = "no entiendo que me quieres decir";

// turno 1 con datos reales (marginRead offline) — deja hilo, scope y boleta
const PLAN_T1 = { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] };
const Q1 = "¿qué clientes están operando bajo el benchmark?";
const t1 = await turno({ texto: Q1, plan: PLAN_T1, mem: {}, narrar: "" });
const HIST = [{ role: "user", text: Q1 }, { role: "adi", text: String((t1.r && t1.r.text) || "") }];

H("[1] D1 · LA DOCTRINA: la apertura de clarify re-enseña, la contrapregunta queda para multi-tema");
{
  const doc = MODES.find((m) => m.key === "clarify").narrate;
  ok(doc.includes("NUNCA abras con una contrapregunta"), "la doctrina PROHÍBE abrir con contrapregunta");
  ok(doc.includes("RE-ENSEÑANDO de inmediato el mensaje central"), "…y exige re-enseñar de inmediato el mensaje central");
  ok(doc.includes("MULTI-TEMA REAL") && doc.includes("una respuesta larga de UN solo tema NO cuenta"),
    "…con la repregunta reservada a multi-tema real (y una respuesta larga de un solo tema NO cuenta)");
  ok(doc.indexOf("NUNCA abras con una contrapregunta") < doc.indexOf("Cerrá SIEMPRE con una pregunta guía"),
    "la apertura se regula ANTES del cierre — la pregunta guía de cierre sigue intacta");
  ok(doc.includes("nivel_aclaracion\" es 1") && doc.includes("nivel_aclaracion\" es 2"), "la escalera de niveles 1/2 no se tocó");
  const system = buildNarrateSystemC(ADI_PERSONA, "");
  ok(system.includes("NUNCA abras con una contrapregunta") && !system.includes(CONTRAPREGUNTA),
    "el system del narrador lleva la prohibición y NO lleva la contrapregunta medida en prod");
}

H("[2] D1 · EL GENERADOR VIEJO, CERRADO: la corrección ambigua ya no repregunta ante confusión pelada");
{
  // declarada por el planificador, con la contrapregunta escrita — la desclasificación se descarta y se re-enseña
  const PLAN_AMBIGUA = { intent: "redirect", mode: "clarify", calls: [], reparacion: { tipo: "correccion", corrige: [], ambigua: true, pregunta: CONTRAPREGUNTA, dato: null, aceptado: false } };
  const a = await turno({ texto: NO_ENTIENDO, plan: PLAN_AMBIGUA, mem: t1.mem, narrar: RETEACH, history: HIST });
  ok(!!a.r && a.r.text !== CONTRAPREGUNTA && !String(a.r.text).includes("¿Qué parte") && !String(a.r.text).includes("¿qué parte"),
    "«no entiendo» + reparación ambigua declarada → NINGUNA contrapregunta sale al usuario", a.r && a.r.text);
  ok(a.narrado >= 1 && String(a.r.text).includes(RETEACH), "…el turno siguió al narrador y re-enseñó");
  const coer = (a.r && a.r.retryTrace && a.r.retryTrace.coerciones) || [];
  ok(coer.some((c) => String(c).includes("confusion-pelada")), "…con la coerción trazada", JSON.stringify(coer));

  // inferida por el motor (redirect que repite la misma tool) — tampoco repregunta
  const PLAN_REPITE = { intent: "redirect", mode: "clarify", calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] };
  const b = await turno({ texto: "no entiendo", plan: PLAN_REPITE, mem: t1.mem, narrar: RETEACH, history: HIST });
  ok(!!b.r && !String(b.r.text).includes("Antes de rehacerlo") && !String(b.r.text).includes("qué parte está mal") && b.narrado >= 1,
    "la variante inferida tampoco emite la red de precisión — re-enseña", b.r && b.r.text);

  // la GARANTÍA VIEJA, intacta: una ambigüedad real sigue cortando con su pregunta de precisión
  const PLAN_REAL = { intent: "redirect", mode: "default", calls: [], reparacion: { tipo: "correccion", corrige: [], ambigua: true, pregunta: "¿Qué corrijo: la entidad, la métrica o el período?", dato: null, aceptado: false } };
  const c = await turno({ texto: "eso no es así", plan: PLAN_REAL, mem: t1.mem, narrar: RETEACH, history: HIST });
  ok(!!c.r && String(c.r.text).includes("¿Qué corrijo") && c.narrado === 0,
    "«eso no es así» (ambigüedad real) SIGUE cortando con su pregunta de precisión, sin narrador", c.r && c.r.text);
}

H("[3] D2 · BAJO SOLO-DATOS: candado intacto y mensaje honesto para la confusión sin concepto");
{
  const MEM = { ...t1.mem, responsePref: { contentScope: "data_only", detailLevel: "standard" } };
  const MSG = composeSoloDatosConfusionMessage([]);

  const a = await turno({ texto: NO_ENTIENDO, plan: { intent: "answer", mode: "clarify", calls: [] }, mem: MEM, narrar: RETEACH, history: HIST });
  ok(!!a.r && a.r.text === MSG && a.narrado === 0, "«no entiendo» sin concepto → el mensaje nuevo, sin narrador", a.r && a.r.text);
  ok(!/\w_\w/.test(MSG) && !/(plata|vara|dormido|guita|palanca|apretar)/i.test(MSG) && !/(marginRead|defineConcept|queryMetric|data.?only|results.?only)/i.test(MSG),
    "el mensaje cumple el registro: sin tokens internos, sin palabras prohibidas, sin nombres de tools");
  ok(MSG.includes("análisis completo") && MSG.includes("dato o concepto puntual"),
    "…e invita a las dos salidas reales (reset de la preferencia o el dato puntual)");

  const b = await turno({ texto: "qué significa la carga comercial", plan: { intent: "define", mode: "clarify", calls: [{ tool: "defineConcept", args: { concept: "carga comercial" } }] }, mem: MEM, narrar: RETEACH, history: HIST });
  ok(!!b.r && /carga comercial/i.test(String(b.r.text)) && b.r.text !== MSG && b.narrado === 0,
    "«qué significa X» con X curado → la definición, sin narrador", b.r && b.r.text);

  const c = await turno({ texto: "cuál es el margen por cliente", plan: PLAN_T1, mem: MEM, narrar: RETEACH, history: HIST });
  ok(!!c.r && /[%$]/.test(String(c.r.text)) && !String(c.r.text).includes("preferencia de recibir solo los datos") && c.narrado === 0,
    "una pregunta de datos normal → cifras de la boleta, ni mensaje nuevo ni narrador");

  const d = await turno({ texto: "no entiendo qué significa el factor zeta", plan: { intent: "define", mode: "clarify", calls: [{ tool: "defineConcept", args: { concept: "factor zeta" } }] }, mem: MEM, narrar: RETEACH, history: HIST });
  ok(!!d.r && String(d.r.text).startsWith("No tengo información autorizada suficiente:") && d.narrado === 0,
    "concepto identificado pero desconocido → la razón declinada real sigue mandando", d.r && d.r.text);
}

console.log(`\n── CLARIFY RE-ENSEÑA (D1+D2) · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
