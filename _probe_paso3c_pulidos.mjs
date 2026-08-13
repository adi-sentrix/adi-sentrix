/* === _probe_paso3c_pulidos.mjs · Paso 3c «ADI pierde el hilo» · los 2 pulidos finos de la certificación viva #2
 * (2026-08-13, transcript `_cert_vivo_openai.json`, dev=929a504) ================================================
 * PROBE 100% OFFLINE: ejercita `answerViaOracle` ENTERO con las dos pasadas inyectadas por key computada — este
 * archivo no contiene los nombres de esas funciones ni ningún marcador de red, y no importa gateway ni adapters.
 * Correr con el candado de red puesto:  node --import ./scripts/offline-guard.mjs _probe_paso3c_pulidos.mjs
 *
 * BISECT DE LA REPRODUCCIÓN: este probe afirma la conducta esperada (post-fix) y se commitea ANTES que los fixes.
 * Corrido sobre el árbol base (929a504), las aserciones del pulido 1 fallan mostrando «Sodimac · Ventas: $8.2M»
 * donde corresponde el mensaje D2 — esa corrida ES la reproducción del hilo C turno 3 — y las del pulido 2 fallan
 * mostrando «ese reference point» intacto (hilo B turno 2).
 *
 *   P1 · LA CONFUSIÓN PELADA BAJO SOLO-DATOS LE GANA A LA CALL ALUCINADA. «no entiendo» bajo data_only con una
 *        call que nadie pidió (el PLAN alucinó entityProfile) responde el mensaje D2, no las cifras de esa call.
 *        Si el turno trae DEFINICIÓN curada, la definición gana (es la mejor respuesta a la confusión bajo el
 *        candado). Una pregunta de datos real —o una confusión que nombra algo concreto— queda byte-idéntica.
 *        Y la boleta del último turno con datos MOSTRADOS no se pisa con figs que jamás salieron a pantalla.
 *   P2 · EL BARRIDO DE REGISTRO ATRAPA ANGLICISMOS. stripLanguageLeaks reemplaza los anglicismos de negocio
 *        frecuentes (reference point, driver, performance) por su forma española; el vocabulario ADOPTADO del
 *        producto (benchmark, rebate, target —label vivo del dato—, gap —etiqueta del concepto brecha—) queda
 *        intacto; la red de notas internas («driver interno» → oración eliminada) sigue funcionando; y una
 *        narración sin anglicismos sale byte-idéntica.
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import * as NB from "./src/adi/oracle/narrationBlocks.js";
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";
const composeSoloDatosConfusionMessage = NB.composeSoloDatosConfusionMessage;

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

const RETEACH = "Lo central de mi respuesta anterior es esto: algunos clientes te dejan un margen menor al piso que definiste como referencia.";
const MSG_D2 = composeSoloDatosConfusionMessage([]);
// la call ALUCINADA del hilo C turno 3: nadie pidió el perfil de Sodimac — el planificador la inventó ante «no entiendo»
const PLAN_ALUCINADO = { intent: "answer", mode: "seguimiento", calls: [{ tool: "entityProfile", args: { entity: "Sodimac", dimension: "cliente" } }] };
const PLAN_PROFILE = { intent: "answer", mode: "default", calls: [{ tool: "entityProfile", args: { entity: "Sodimac", dimension: "cliente" } }] };

/* ══ P1 · LA CONFUSIÓN PELADA BAJO SOLO-DATOS LE GANA A LA CALL ALUCINADA (hilo C turno 3) ════════════════════ */
H("[P1] el hilo C reproducido: t1 datos reales bajo solo-datos, t2 «no entiendo» con la call alucinada");
// t1 · el turno de datos real que abre el hilo (como el «dame el margen por cliente» vivo)
const MEM_DO = { responsePref: { contentScope: "data_only", detailLevel: "standard" } };
const PLAN_T1 = { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] };
const Q1 = "dame el margen por cliente";
const t1 = await turno({ texto: Q1, plan: PLAN_T1, mem: MEM_DO });
const HIST = [{ role: "user", text: Q1 }, { role: "adi", text: String((t1.r && t1.r.text) || "") }];
ok(!!t1.r && !!t1.mem && !!t1.mem.boletaAnterior && Array.isArray(t1.mem.boletaAnterior.figs) && t1.mem.boletaAnterior.figs.length > 0,
  "t1 respondió con datos y escribió su boleta (el permiso de re-cita del Paso 1b)");

{
  const a = await turno({ texto: "no entiendo", plan: PLAN_ALUCINADO, mem: t1.mem, narrar: RETEACH, history: HIST });
  ok(!!a.r && a.r.text === MSG_D2, "«no entiendo» + call alucinada bajo data_only → EXACTAMENTE el mensaje D2, no las cifras de la call", a.r && a.r.text);
  ok(a.narrado === 0, "   …sin narrador (el candado por construcción se mantiene)");
  ok(!!a.mem && JSON.stringify(a.mem.boletaAnterior) === JSON.stringify(t1.mem.boletaAnterior),
    "   …y la boleta del último turno con datos MOSTRADOS queda intacta (las figs de la call alucinada jamás salieron a pantalla)");
}
{
  // mismo corner bajo results_only (el candado cubre los dos alcances)
  const MEM_RO = { responsePref: { contentScope: "results_only", detailLevel: "standard" } };
  const a = await turno({ texto: "no comprendo", plan: PLAN_ALUCINADO, mem: MEM_RO, narrar: RETEACH });
  ok(!!a.r && a.r.text === MSG_D2 && a.narrado === 0, "bajo results_only el corner responde igual: el mensaje D2, sin narrador", a.r && a.r.text);
}

H("[P1b] si la confusión trae DEFINICIÓN curada, la definición gana (aunque la call alucinada también venga)");
{
  const PLAN_DEF = { intent: "clarify", mode: "clarify", calls: [
    { tool: "entityProfile", args: { entity: "Sodimac", dimension: "cliente" } },
    { tool: "defineConcept", args: { concept: "benchmark" } },
  ] };
  const a = await turno({ texto: "no entiendo", plan: PLAN_DEF, mem: t1.mem, narrar: RETEACH, history: HIST });
  ok(!!a.r && /^Benchmark:/.test(String(a.r.text)) && /punto de referencia/i.test(String(a.r.text)),
    "la definición curada abre la respuesta (desdeTexto sigue mandando sobre la confusión)", a.r && a.r.text);
  ok(!/\$8\.2M/.test(String(a.r.text)) && a.narrado === 0, "   …sin las cifras de la call alucinada y sin narrador");
}

H("[P1c] la red es ANGOSTA: lo que hoy funciona queda byte-idéntico");
{
  // pregunta de datos real bajo solo-datos: la conducta de siempre (y la métrica preguntada encabeza, h2 del 3b)
  const a = await turno({ texto: "margen de Sodimac", plan: PLAN_PROFILE, mem: t1.mem });
  ok(!!a.r && /^Sodimac · Margen: 23\.5%/.test(String(a.r.text)), "«margen de Sodimac» → el dato de siempre (la call SÍ fue pedida)", a.r && a.r.text);
  ok(!!a.mem && !!a.mem.boletaAnterior && JSON.stringify(a.mem.boletaAnterior) !== JSON.stringify(t1.mem.boletaAnterior),
    "   …y ese turno SÍ escribe su boleta (mostró sus figs)");
  // confusión que NOMBRA algo concreto: no es pelada — el dato sigue mandando (la MISMA vara del 3b)
  const b = await turno({ texto: "no entiendo el margen de Sodimac", plan: PLAN_PROFILE, mem: t1.mem });
  ok(!!b.r && /^Sodimac · Margen: 23\.5%/.test(String(b.r.text)),
    "«no entiendo el margen de Sodimac» (nombra la métrica) → NO es confusión pelada: el dato manda, como siempre", b.r && b.r.text);
  // confusión pelada SIN ninguna call (el caso D2 que ya existía) — sigue exactamente igual
  const c = await turno({ texto: "no entiendo", plan: { intent: "answer", mode: "clarify", calls: [] }, mem: t1.mem, narrar: RETEACH, history: HIST });
  ok(!!c.r && c.r.text === MSG_D2 && c.narrado === 0, "la confusión pelada sin calls sigue llegando al mensaje D2 (conducta previa intacta)");
}

/* ══ P2 · EL BARRIDO DE REGISTRO ATRAPA ANGLICISMOS (hilo B turno 2) ══════════════════════════════════════════ */
H("[P2] la fuga medida en vivo: «ese reference point» sale en español");
{
  const vivo = "La brecha es la distancia entre tu margen actual y ese reference point.";
  ok(stripLanguageLeaks(vivo) === "La brecha es la distancia entre tu margen actual y ese punto de referencia.",
    "«ese reference point» → «ese punto de referencia»", stripLanguageLeaks(vivo));
  ok(stripLanguageLeaks("Definimos reference points por cuenta.") === "Definimos puntos de referencia por cuenta.",
    "el plural también: «reference points» → «puntos de referencia»");
  ok(stripLanguageLeaks("Reference point: el benchmark de 30.1%.") === "Punto de referencia: el benchmark de 30.1%.",
    "a inicio de oración preserva la mayúscula — y «benchmark» en la misma frase queda intacto");
}
H("[P2b] driver y performance, con sus trampas cuidadas");
{
  ok(stripLanguageLeaks("El driver principal es la carga comercial.") === "El factor principal es la carga comercial.",
    "«driver» → «factor» (ambos masculinos, concordancia intacta)");
  ok(stripLanguageLeaks("Los drivers del margen son costo y carga.") === "Los factores del margen son costo y carga.",
    "«drivers» → «factores»");
  // la red de NOTAS INTERNAS no se rompe: «driver interno» es su marcador y la oración entera se sigue eliminando
  const nota = "Falabella cede margen por carga alta. Sin driver interno obvio en los 5.";
  ok(stripLanguageLeaks(nota) === "Falabella cede margen por carga alta.",
    "«driver interno» NO se traduce: sigue siendo el marcador de nota interna y la oración entera se elimina", stripLanguageLeaks(nota));
  ok(stripLanguageLeaks("La performance comercial de Falabella mejoró.") === "El desempeño comercial de Falabella mejoró.",
    "«la performance» → «el desempeño» (artículo enumerado: cambia de género)");
  ok(stripLanguageLeaks("Su performance del período está bajo el benchmark.") === "Su desempeño del período está bajo el benchmark.",
    "«performance» pelada → «desempeño»");
}
H("[P2c] el vocabulario ADOPTADO del producto no se barre");
{
  const rebate = "El rebate forma parte de la carga comercial y se negocia cuenta por cuenta.";
  ok(stripLanguageLeaks(rebate) === rebate, "«rebate» intacto (concepto propio del glosario)");
  const bench = "Tu benchmark de margen es 30.1% y Falabella rinde 22%.";
  ok(stripLanguageLeaks(bench) === bench, "«benchmark» intacto (concepto propio del glosario)");
  const target = "Tu target de carga comercial es 3.5%.";
  ok(stripLanguageLeaks(target) === target, "«target» intacto (label vivo del dato: «Target de carga comercial»)");
  const gap = "El gap de margen partido en sus dos componentes — estructura de costo vs carga comercial — para ver cuál pesa más.";
  ok(stripLanguageLeaks(gap) === gap, "«gap» intacto (etiqueta declarada del concepto brecha; barrerlo rompería texto curado y concordancia)");
}
H("[P2d] una narración limpia sale byte-idéntica; el barrido es idempotente");
{
  const limpia = "Falabella cede margen por carga alta: 22% contra un benchmark de 30.1%. La brecha es de 8.1 puntos y la primera acción es revisar las acciones comerciales de esa cuenta.";
  ok(stripLanguageLeaks(limpia) === limpia, "narración sin anglicismos → byte-idéntica");
  const sucia = "El driver de la brecha es la performance frente a ese reference point.";
  ok(stripLanguageLeaks(stripLanguageLeaks(sucia)) === stripLanguageLeaks(sucia), "idempotente: dos pasadas = una pasada",
    stripLanguageLeaks(sucia));
}

console.log(`\n── _probe_paso3c_pulidos: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
