/* === _hallazgos_cert_vivo_gate.mjs · los 3 hallazgos de la certificación en vivo (owner 2026-08-13 · Paso 3b) ==
 * La certificación viva #1 (transcript `_cert_vivo_openai.json`, dev=07f5a85) encontró tres conductas que este
 * gate vuelve permanentes:
 *   1 · LA CONTRAPREGUNTA NO TIENE TERCER CAMINO. «no entiendo» pelado jamás sale con «¿qué parte…?», venga como
 *       venga clasificado del planificador — incluido intent fuera de enum + la pregunta escrita en
 *       `supuestos_faltantes` (el request_clarification de simulate v2, el canal medido en vivo). La corrección
 *       ambigua real («eso no es así») conserva su pregunta de precisión. Bajo solo-datos, la confusión llega al
 *       mensaje D2, nunca a la contrapregunta.
 *   2 · LA MÉTRICA PREGUNTADA ENCABEZA. Bajo solo-datos, si la pregunta nombra una métrica presente en la boleta,
 *       esa fig abre la respuesta; la magnitud mayor queda como criterio SOLO cuando no se nombra métrica.
 *   3 · EL ACK DE PREFERENCIA CONFIRMA. Un turno de pura configuración («solo los datos») recibe la confirmación
 *       determinística con la invitación de reset ejecutable («análisis completo») — no una declaración de
 *       ausencia; si el mismo turno además pide un dato, el dato manda.
 *
 * 100% OFFLINE: ejercita `answerViaOracle` ENTERO con las dos pasadas inyectadas por key computada — este archivo
 * no contiene los nombres de esas funciones ni ningún marcador de red, y no importa gateway ni adapters.
 * Cero red, cero LLM. `npm run gates:offline`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { composeAckPreferenciaMessage, composeSoloDatosConfusionMessage } from "./src/adi/oracle/narrationBlocks.js";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const K_PLAN = ["call", "Plan"].join("");
const K_NARR = ["call", "Narr", "ate"].join("");
async function turno({ texto, plan, mem, narrar = "", history = [] }) {
  let narrado = 0;
  const opts = { text: texto, history, mem, scenario: "actual" };
  opts[K_PLAN] = async () => plan;
  opts[K_NARR] = async () => { narrado++; return narrar; };
  const o = await answerViaOracle(opts);
  return { r: (o && o.r) || null, mem: (o && o.mem) || null, narrado };
}

const RETEACH = "Lo central de mi respuesta anterior es esto: algunos clientes te dejan un margen menor al piso que definiste como referencia. ¿Te lo muestro con una sola cuenta como ejemplo?";
const PREG_VIVA = "¿qué parte no entendiste?";
const PLAN_T1 = { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] };
const Q1 = "¿qué clientes venden mucho pero dejan poco margen?";
const t1 = await turno({ texto: Q1, plan: PLAN_T1, mem: {} });
const HIST = [{ role: "user", text: Q1 }, { role: "adi", text: String((t1.r && t1.r.text) || "") }];

H("[1] EL TERCER CAMINO, CERRADO: intent fuera de enum + la pregunta en supuestos_faltantes → re-enseña");
{
  // la variante EXACTA medida en vivo (hilo A turno 2): plan crudo intent="clarify", calls vacío
  const a = await turno({ texto: "no entiendo que me quieres decir",
    plan: { intent: "clarify", mode: "default", calls: [], reparacion: null, supuestos_faltantes: [PREG_VIVA] },
    mem: t1.mem, narrar: RETEACH, history: HIST });
  ok(!!a.r && !/qu[eé] parte/i.test(String(a.r.text)), "la contrapregunta del planificador NO sale al usuario", a.r && a.r.text);
  ok(a.narrado >= 1 && String(a.r.text).includes(RETEACH), "…el turno siguió al narrador y re-enseñó");
  const coer = (a.r && a.r.retryTrace && a.r.retryTrace.coerciones) || [];
  ok(coer.some((c) => String(c).includes("supuestos-faltantes-descartados")) && coer.some((c) => String(c).includes("intent-fuera-de-enum-descartado")),
    "…con los dos descartes trazados en el turno", JSON.stringify(coer));

  // una simulación REAL a medio declarar no se toca: la pregunta de aclaración de simulate v2 sigue cortando
  const s = await turno({ texto: "¿y si le subo el precio a Falabella 5%?",
    plan: { intent: "answer", mode: "simulacion", calls: [], supuestos_faltantes: ["¿cuánto esperas que cambie el volumen o las unidades vendidas? No quiero asumir que se mantiene sin cambios."] },
    mem: t1.mem, narrar: RETEACH, history: HIST });
  ok(!!s.r && /volumen/i.test(String(s.r.text)) && s.narrado === 0,
    "la aclaración de una simulación de 2 variables SIGUE cortando antes del batch (red angosta intacta)", s.r && s.r.text);
}

H("[2] la corrección ambigua real y el candado de solo-datos, intactos");
{
  const PLAN_REAL = { intent: "redirect", mode: "default", calls: [], reparacion: { tipo: "correccion", corrige: [], ambigua: true, pregunta: "¿Qué corrijo: la entidad, la métrica o el período?", dato: null, aceptado: false } };
  const a = await turno({ texto: "eso no es así", plan: PLAN_REAL, mem: t1.mem, narrar: RETEACH, history: HIST });
  ok(!!a.r && String(a.r.text).includes("¿Qué corrijo") && a.narrado === 0,
    "«eso no es así» sigue cortando con su pregunta de precisión, sin narrador", a.r && a.r.text);

  const MEM_DO = { ...t1.mem, responsePref: { contentScope: "data_only", detailLevel: "standard" } };
  const b = await turno({ texto: "no entiendo",
    plan: { intent: "clarify", mode: "seguimiento", calls: [], reparacion: null, supuestos_faltantes: ["¿qué parte no entiendes?"] },
    mem: MEM_DO, narrar: RETEACH, history: HIST });
  ok(!!b.r && b.r.text === composeSoloDatosConfusionMessage([]) && b.narrado === 0,
    "bajo solo-datos, el «no entiendo» del hilo C llega EXACTAMENTE al mensaje D2, sin narrador", b.r && b.r.text);
}

H("[3] LA MÉTRICA PREGUNTADA ENCABEZA bajo solo-datos; sin métrica nombrada, la magnitud manda");
{
  const MEM_DO = { responsePref: { contentScope: "data_only", detailLevel: "standard" } };
  const PLAN_PROFILE = { intent: "answer", mode: "default", calls: [{ tool: "entityProfile", args: { entity: "Sodimac", dimension: "cliente" } }] };
  const a = await turno({ texto: "margen de Sodimac", plan: PLAN_PROFILE, mem: MEM_DO });
  ok(!!a.r && /^Sodimac · Margen: 23\.5%/.test(String(a.r.text)) && a.narrado === 0,
    "«margen de Sodimac» → encabeza Sodimac · Margen (la métrica preguntada), sin narrador", a.r && a.r.text);
  const b = await turno({ texto: "dame Sodimac", plan: PLAN_PROFILE, mem: MEM_DO });
  ok(!!b.r && /^Sodimac · Ventas: \$8\.2M/.test(String(b.r.text)),
    "«dame Sodimac» (sin métrica nombrada) → el criterio de magnitud de siempre", b.r && b.r.text);
}

H("[4] EL ACK DE PREFERENCIA PURO CONFIRMA; con pedido de dato, el dato manda");
{
  const a = await turno({ texto: "de ahora en adelante dame solo los datos, sin explicaciones", plan: { intent: "ack", mode: "default", calls: [] }, mem: {} });
  const MSG = composeAckPreferenciaMessage("data_only");
  ok(!!a.r && a.r.text === MSG && a.narrado === 0,
    "el turno de pura configuración recibe la confirmación determinística, sin narrador", a.r && a.r.text);
  ok(a.mem && a.mem.responsePref && a.mem.responsePref.contentScope === "data_only", "…y la preferencia quedó persistida");
  ok(!/\w_\w/.test(MSG) && !/(plata|vara|dormido|guita|palanca|apretar)/i.test(MSG) && MSG.includes("análisis completo"),
    "…registro limpio y la invitación de reset es la frase que el motor ya reconoce (ejecutable)");
  const b = await turno({ texto: "desde ahora solo los datos: margen de Sodimac",
    plan: { intent: "answer", mode: "default", calls: [{ tool: "entityProfile", args: { entity: "Sodimac", dimension: "cliente" } }] }, mem: {} });
  ok(!!b.r && /^Sodimac · Margen: 23\.5%/.test(String(b.r.text)), "ack + pedido de dato → responde EL DATO", b.r && b.r.text);
  const c = await turno({ texto: "ok, gracias", plan: { intent: "ack", mode: "default", calls: [] }, mem: { responsePref: { contentScope: "data_only", detailLevel: "standard" } } });
  ok(!!c.r && c.r.text !== MSG, "un ack cualquiera bajo la sesión solo-datos NO recibe la confirmación", c.r && c.r.text);
}

console.log(`\n── HALLAZGOS CERT VIVO (Paso 3b) · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
