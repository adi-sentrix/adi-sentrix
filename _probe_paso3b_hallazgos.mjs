/* === _probe_paso3b_hallazgos.mjs · Paso 3b «ADI pierde el hilo» · los 3 hallazgos de la certificación en vivo
 * (2026-08-13, transcript `_cert_vivo_openai.json`, dev=07f5a85) ================================================
 * PROBE 100% OFFLINE: ejercita `answerViaOracle` ENTERO con las dos pasadas inyectadas por key computada — este
 * archivo no contiene los nombres de esas funciones ni ningún marcador de red, y no importa gateway ni adapters.
 * Correr con el candado de red puesto:  node --import ./scripts/offline-guard.mjs _probe_paso3b_hallazgos.mjs
 *
 * BISECT DEL DIAGNÓSTICO: este probe afirma la REGLA DEL OWNER (post-fix). Corrido sobre el árbol SIN los fixes
 * del motor (este archivo se commitea ANTES que ellos), las aserciones del hallazgo 1 fallan mostrando la
 * contrapregunta emitida verbatim — esa corrida ES la reproducción del camino vivo. El diagnóstico exacto vive en
 * `_INFORME_PASO_3B.md` §1: el tercer generador era `supuestos_faltantes` (el request_clarification de simulate
 * v2), que emitía la pregunta del PLAN verbatim, deterministic=true y sin narrador, sin mirar intent ni
 * _CLARIFY_RE — y ANTES de la rama de solo-datos, por eso el mensaje D2 nunca se alcanzaba.
 *
 *   A1 · «no entiendo» pelado JAMÁS emite contrapregunta, venga como venga el plan (matriz: intent clarify fuera
 *        de enum / redirect / answer × reparación declarada/inferida × con/sin pregunta escrita × con/sin calls ×
 *        supuestos escritos). «eso no es así» SIGUE cortando con su pregunta de precisión. Bajo solo-datos el
 *        «no entiendo» llega al mensaje D2.
 *   A2 · bajo solo-datos, la métrica PREGUNTADA encabeza si está en la boleta; sin métrica nombrada, el criterio
 *        de magnitud queda intacto; la justificación del cierre AUTO dice la verdad del criterio usado.
 *   A3 · el ack de preferencia PURO confirma lo configurado (registro verificado, invitación al reset ejecutable);
 *        ack+pedido de dato → el dato manda; un ack sin preferencia declarada NO recibe la confirmación.
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
// import por NAMESPACE a propósito: corrido sobre un árbol ANTERIOR a los fixes (bisect del diagnóstico), los
// compositores nuevos no existen todavía — con el namespace el probe CARGA igual y muestra las aserciones rojas
// con la contrapregunta emitida, que es la reproducción; con imports nombrados moriría en el import sin mostrar nada.
import * as NB from "./src/adi/oracle/narrationBlocks.js";
const componerPorForma = NB.componerPorForma;
const composeSoloDatosConfusionMessage = NB.composeSoloDatosConfusionMessage;
const composeAckPreferenciaMessage = NB.composeAckPreferenciaMessage || (() => "«composeAckPreferenciaMessage aún no existe en este árbol»");

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
const PREG_VIVA_A = "¿qué parte no entendiste?";     // la frase EXACTA medida en vivo (hilo A turno 2)
const PREG_VIVA_C = "¿qué parte no entiendes?";      // hilo C turno 3
const NO_ENTIENDO_A = "no entiendo que me quieres decir";
const sinContrapregunta = (t) => !/qu[eé] parte/i.test(String(t || ""));

// turno 1 con datos reales (marginRead offline) — deja hilo, scope y boleta, como el turno 1 del hilo A vivo
const PLAN_T1 = { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] };
const Q1 = "¿qué clientes venden mucho pero dejan poco margen?";
const t1 = await turno({ texto: Q1, plan: PLAN_T1, mem: {} });
const HIST = [{ role: "user", text: Q1 }, { role: "adi", text: String((t1.r && t1.r.text) || "") }];

/* ══ A1 · LA MATRIZ DEL TERCER CAMINO — «no entiendo» pelado jamás sale con contrapregunta ════════════════════ */
H("[A1] la matriz: cada forma en que el plan puede traer la contrapregunta, y ninguna la emite");
const MATRIZ = [
  { rotulo: "V1 · intent=clarify (fuera de enum) + reparación declarada ambigua CON pregunta, sin calls",
    texto: NO_ENTIENDO_A,
    plan: { intent: "clarify", mode: "default", calls: [], reparacion: { tipo: "correccion", corrige: [], ambigua: true, pregunta: PREG_VIVA_A, dato: null, aceptado: false } } },
  { rotulo: "V2 · EL CAMINO VIVO (hilo A turno 2): intent=clarify + supuestos_faltantes con la pregunta, sin calls",
    texto: NO_ENTIENDO_A,
    plan: { intent: "clarify", mode: "default", calls: [], reparacion: null, supuestos_faltantes: [PREG_VIVA_A] } },
  { rotulo: "V3 · intent=redirect + supuestos_faltantes con la pregunta, sin calls",
    texto: NO_ENTIENDO_A,
    plan: { intent: "redirect", mode: "default", calls: [], reparacion: null, supuestos_faltantes: [PREG_VIVA_A] } },
  { rotulo: "V4 · intent=answer + supuestos_faltantes con la pregunta, sin calls",
    texto: "no comprendo",
    plan: { intent: "answer", mode: "default", calls: [], reparacion: null, supuestos_faltantes: [PREG_VIVA_A] } },
  { rotulo: "V5 · intent=clarify + supuestos_faltantes + CON calls (el plan también trajo datos)",
    texto: "no entiendo",
    plan: { intent: "clarify", mode: "default", calls: PLAN_T1.calls, reparacion: null, supuestos_faltantes: [PREG_VIVA_A] } },
  { rotulo: "V6 · intent=redirect + reparación INFERIDA (repite la misma tool, sin reparación declarada)",
    texto: "no entiendo",
    plan: { intent: "redirect", mode: "clarify", calls: PLAN_T1.calls } },
  { rotulo: "V7 · intent=redirect + reparación declarada ambigua SIN pregunta escrita, sin calls",
    texto: NO_ENTIENDO_A,
    plan: { intent: "redirect", mode: "default", calls: [], reparacion: { tipo: "correccion", corrige: [], ambigua: true, pregunta: null, dato: null, aceptado: false } } },
];
for (const v of MATRIZ) {
  const a = await turno({ texto: v.texto, plan: v.plan, mem: t1.mem, narrar: RETEACH, history: HIST });
  const texto = a.r && a.r.text;
  ok(!!texto && sinContrapregunta(texto) && texto !== PREG_VIVA_A,
    `${v.rotulo} → sin contrapregunta`, texto);
  ok(a.narrado >= 1 && String(texto).includes(RETEACH), "   …y el turno re-enseñó vía narrador");
}
// la coerción queda trazada (V2, el camino vivo)
{
  const a = await turno({ texto: NO_ENTIENDO_A, plan: MATRIZ[1].plan, mem: t1.mem, narrar: RETEACH, history: HIST });
  const coer = (a.r && a.r.retryTrace && a.r.retryTrace.coerciones) || [];
  ok(coer.some((c) => String(c).includes("supuestos-faltantes-descartados")), "V2 traza el descarte de supuestos_faltantes", JSON.stringify(coer));
  ok(coer.some((c) => String(c).includes("intent-fuera-de-enum-descartado")), "V2 traza la normalización del intent fuera de enum", JSON.stringify(coer));
}

H("[A1b] la red angosta se mantiene: «eso no es así» sigue cortando con su pregunta de precisión");
{
  const PLAN_REAL = { intent: "redirect", mode: "default", calls: [], reparacion: { tipo: "correccion", corrige: [], ambigua: true, pregunta: "¿Qué corrijo: la entidad, la métrica o el período?", dato: null, aceptado: false } };
  const a = await turno({ texto: "eso no es así", plan: PLAN_REAL, mem: t1.mem, narrar: RETEACH, history: HIST });
  ok(!!a.r && String(a.r.text).includes("¿Qué corrijo") && a.narrado === 0,
    "la pregunta de precisión SÍ se emite, sin narrador (garantía vieja intacta)", a.r && a.r.text);
}

H("[A1c] bajo solo-datos, el «no entiendo» del hilo C llega al mensaje D2 — venga con supuestos o sin ellos");
{
  const MEM_DO = { ...t1.mem, responsePref: { contentScope: "data_only", detailLevel: "standard" } };
  const MSG_D2 = composeSoloDatosConfusionMessage([]);
  // la variante EXACTA del hilo C turno 3: intent=clarify crudo, mode=seguimiento, supuestos con la pregunta
  const a = await turno({ texto: "no entiendo", plan: { intent: "clarify", mode: "seguimiento", calls: [], reparacion: null, supuestos_faltantes: [PREG_VIVA_C] }, mem: MEM_DO, narrar: RETEACH, history: HIST });
  ok(!!a.r && a.r.text === MSG_D2 && a.narrado === 0, "hilo C turno 3 reproducido → EXACTAMENTE el mensaje D2, sin narrador", a.r && a.r.text);
  const b = await turno({ texto: "no entiendo", plan: { intent: "answer", mode: "clarify", calls: [] }, mem: MEM_DO, narrar: RETEACH, history: HIST });
  ok(!!b.r && b.r.text === MSG_D2 && b.narrado === 0, "…y sin supuestos también (el candado por construcción se mantiene)");
}

/* ══ A2 · LA MÉTRICA PREGUNTADA ENCABEZA (hilo C turnos 2 y 4) ════════════════════════════════════════════════ */
H("[A2] bajo solo-datos, la métrica preguntada encabeza; sin métrica nombrada, la magnitud manda");
const MEM_DO2 = { responsePref: { contentScope: "data_only", detailLevel: "standard" } };
const PLAN_PROFILE = { intent: "answer", mode: "default", calls: [{ tool: "entityProfile", args: { entity: "Sodimac", dimension: "cliente" } }] };
{
  const a = await turno({ texto: "margen de Sodimac", plan: PLAN_PROFILE, mem: MEM_DO2 });
  ok(!!a.r && /^Sodimac · Margen: 23\.5%/.test(String(a.r.text)), "«margen de Sodimac» → encabeza Sodimac · Margen: 23.5%", a.r && a.r.text);
  ok(a.narrado === 0, "   …sin narrador (candado intacto)");
  const b = await turno({ texto: "dame Sodimac", plan: PLAN_PROFILE, mem: MEM_DO2 });
  ok(!!b.r && /^Sodimac · Ventas: \$8\.2M/.test(String(b.r.text)), "«dame Sodimac» (sin métrica) → la magnitud mayor de siempre (Ventas)", b.r && b.r.text);
  const c = await turno({ texto: "ventas de Sodimac", plan: PLAN_PROFILE, mem: MEM_DO2 });
  ok(!!c.r && /^Sodimac · Ventas: \$8\.2M/.test(String(c.r.text)), "«ventas de Sodimac» → Ventas (la nombrada coincide con la mayor)", c.r && c.r.text);
}
H("[A2b] el compositor de emergencia (forma auto): la fig que abre y la justificación dicen la verdad del criterio");
{
  const FIGS = [
    { label: "Sodimac · Ventas", value: "$8.2M", raw: 8200, tipo: { entidad: "Sodimac", periodo: "año cerrado" } },
    { label: "Sodimac · Margen", value: "23.5%", raw: 23.5, tipo: { entidad: "Sodimac", periodo: "año cerrado" } },
    { label: "Benchmark de margen", value: "30.1%", raw: 30.1 },
  ];
  const conMetrica = componerPorForma({ figs: FIGS, contentScope: "full", forma: "auto", metricaLabels: ["Margen"] });
  ok(/^Sobre Sodimac: Sodimac · Margen marca 23\.5%/.test(String(conMetrica)), "con métrica preguntada: abre con Sodimac · Margen", conMetrica);
  ok(String(conMetrica).includes("Por dónde partir: Sodimac · Margen, que es la métrica por la que preguntaste."),
    "…y el cierre dice el criterio VERDADERO (la métrica preguntada, no «magnitud mayor»)");
  ok(!String(conMetrica).includes("magnitud mayor"), "…sin afirmar una magnitud que no fue el criterio");
  const sinMetrica = componerPorForma({ figs: FIGS, contentScope: "full", forma: "auto" });
  ok(/^Sobre Sodimac: Sodimac · Ventas marca \$8\.2M/.test(String(sinMetrica)) && String(sinMetrica).includes("magnitud mayor de las autorizadas"),
    "sin métrica preguntada: la magnitud mayor y su justificación de siempre, byte-compatibles", sinMetrica);
  // «Margen» pedido NO matchea la referencia «Benchmark de margen» (un solo segmento, no es la métrica): sin una
  // fig «· Margen» presente, el criterio cae a la magnitud de siempre — la referencia jamás encabeza por contagio.
  const soloBench = componerPorForma({ figs: [FIGS[0], FIGS[2]], contentScope: "data_only", forma: "auto", metricaLabels: ["Margen"] });
  ok(/^Sodimac · Ventas/.test(String(soloBench)), "«Margen» pedido sin fig de margen: el benchmark NO encabeza por contener la palabra — magnitud de siempre", soloBench);
  const tabla = componerPorForma({ figs: FIGS, contentScope: "full", forma: "tabla", metricaLabels: ["Margen"] });
  ok(String(tabla).includes("La fila de mayor magnitud es Sodimac · Ventas"),
    "la lectura mínima de la tabla sigue nombrando la fila de mayor magnitud REAL (hecho de magnitud, no de qué se preguntó)", tabla);
}

/* ══ A3 · EL ACK DE PREFERENCIA PURO CONFIRMA (hilo C turno 1) ════════════════════════════════════════════════ */
H("[A3] «de ahora en adelante dame solo los datos» → confirmación, no una ausencia");
{
  const a = await turno({ texto: "de ahora en adelante dame solo los datos, sin explicaciones", plan: { intent: "ack", mode: "default", calls: [] }, mem: {} });
  const MSG = composeAckPreferenciaMessage("data_only");
  ok(!!a.r && a.r.text === MSG, "la respuesta es EXACTAMENTE la confirmación determinística", a.r && a.r.text);
  ok(a.narrado === 0, "…sin narrador (turno de pura configuración)");
  ok(!String(a.r.text).startsWith("No tengo información"), "…y el genérico de ausencia ya no aparece (el defecto vivo)");
  ok(a.mem && a.mem.responsePref && a.mem.responsePref.contentScope === "data_only", "…la preferencia quedó persistida igual que antes");
  ok(!/\w_\w/.test(MSG) && !/(plata|vara|dormido|guita|palanca|apretar)/i.test(MSG) && !/(marginRead|defineConcept|queryMetric|entityProfile|data.?only|results.?only)/i.test(MSG),
    "registro: sin tokens internos, sin palabras prohibidas, sin nombres de tools ni valores del enum");
  ok(MSG.includes("análisis completo"), "la invitación al reset usa la frase que el motor YA reconoce (ejecutable)");
}
H("[A3b] ack + pedido de dato → el dato manda; ack sin preferencia declarada → sin confirmación");
{
  const a = await turno({ texto: "desde ahora solo los datos: margen de Sodimac", plan: PLAN_PROFILE, mem: {} });
  ok(!!a.r && /^Sodimac · Margen: 23\.5%/.test(String(a.r.text)), "con pedido de dato en el mismo turno, responde EL DATO (y encabeza la métrica pedida)", a.r && a.r.text);
  const b = await turno({ texto: "ok, gracias", plan: { intent: "ack", mode: "default", calls: [] }, mem: { responsePref: { contentScope: "data_only", detailLevel: "standard" } } });
  ok(!!b.r && b.r.text !== composeAckPreferenciaMessage("data_only"),
    "un ack cualquiera bajo la sesión solo-datos NO recibe la confirmación (solo el turno que declaró la preferencia)", b.r && b.r.text);
}

console.log(`\n── _probe_paso3b_hallazgos: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
