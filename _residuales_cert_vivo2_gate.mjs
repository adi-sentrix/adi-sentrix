/* === _residuales_cert_vivo2_gate.mjs · los 2 residuales finos de la certificación viva #2 (owner 2026-08-13 · Paso 3c)
 * La certificación viva #2 (transcript `_cert_vivo_openai.json`, dev=929a504) dejó dos conductas que este gate
 * vuelve permanentes:
 *   1 · LA CONFUSIÓN PELADA BAJO SOLO-DATOS LE GANA A LA CALL ALUCINADA (hilo C turno 3). «no entiendo» bajo
 *       data_only/results_only con una call que nadie pidió responde el mensaje D2 (o la definición curada si el
 *       turno la trae), nunca las cifras de esa call — y no pisa la boleta del último turno con datos MOSTRADOS.
 *       Una pregunta de datos real, o una confusión que nombra algo concreto, queda byte-idéntica.
 *   2 · EL BARRIDO DE REGISTRO ATRAPA ANGLICISMOS (hilo B turno 2). «ese reference point» sale «ese punto de
 *       referencia»; driver→factor y performance→desempeño; el vocabulario ADOPTADO del producto (benchmark,
 *       rebate, target —label vivo del dato—, gap —etiqueta del concepto brecha—) queda intacto; la red de notas
 *       internas («driver interno») sigue eliminando la oración entera.
 *
 * 100% OFFLINE: ejercita `answerViaOracle` ENTERO con las dos pasadas inyectadas por key computada — este archivo
 * no contiene los nombres de esas funciones ni ningún marcador de red, y no importa gateway ni adapters.
 * Cero red, cero LLM. `npm run gates:offline`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { composeSoloDatosConfusionMessage } from "./src/adi/oracle/narrationBlocks.js";
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";

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

const MSG_D2 = composeSoloDatosConfusionMessage([]);
const PLAN_ALUCINADO = { intent: "answer", mode: "seguimiento", calls: [{ tool: "entityProfile", args: { entity: "Sodimac", dimension: "cliente" } }] };

H("[1] LA CONFUSIÓN PELADA BAJO SOLO-DATOS LE GANA A LA CALL ALUCINADA (hilo C turno 3)");
{
  const MEM_DO = { responsePref: { contentScope: "data_only", detailLevel: "standard" } };
  const t1 = await turno({ texto: "dame el margen por cliente", plan: { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] }, mem: MEM_DO });
  const a = await turno({ texto: "no entiendo", plan: PLAN_ALUCINADO, mem: t1.mem });
  ok(!!a.r && a.r.text === MSG_D2 && a.narrado === 0,
    "«no entiendo» + call alucinada bajo data_only → EXACTAMENTE el mensaje D2, sin narrador", a.r && a.r.text);
  ok(!!a.mem && JSON.stringify(a.mem.boletaAnterior) === JSON.stringify(t1.mem.boletaAnterior),
    "…la boleta del último turno con datos MOSTRADOS no se pisa con figs que jamás salieron a pantalla");
  const d = await turno({ texto: "no entiendo", plan: { ...PLAN_ALUCINADO, calls: [...PLAN_ALUCINADO.calls, { tool: "defineConcept", args: { concept: "benchmark" } }] }, mem: t1.mem });
  ok(!!d.r && /^Benchmark:/.test(String(d.r.text)) && !/\$8\.2M/.test(String(d.r.text)) && d.narrado === 0,
    "…con definición curada en el turno, la definición gana (nunca las cifras de la call)", d.r && d.r.text);
  const b = await turno({ texto: "margen de Sodimac", plan: { ...PLAN_ALUCINADO, mode: "default" }, mem: t1.mem });
  ok(!!b.r && /^Sodimac · Margen: 23\.5%/.test(String(b.r.text)),
    "una pregunta de datos real sigue byte-idéntica (la call SÍ fue pedida)", b.r && b.r.text);
  const c = await turno({ texto: "no entiendo el margen de Sodimac", plan: { ...PLAN_ALUCINADO, mode: "default" }, mem: t1.mem });
  ok(!!c.r && /^Sodimac · Margen: 23\.5%/.test(String(c.r.text)),
    "una confusión que NOMBRA algo concreto no es pelada: el dato manda, como siempre", c.r && c.r.text);
}

H("[2] EL BARRIDO DE REGISTRO ATRAPA ANGLICISMOS (hilo B turno 2)");
{
  ok(stripLanguageLeaks("La brecha es la distancia entre tu margen actual y ese reference point.")
    === "La brecha es la distancia entre tu margen actual y ese punto de referencia.",
    "«ese reference point» → «ese punto de referencia» (la fuga medida en vivo)");
  ok(stripLanguageLeaks("El driver principal es la carga comercial.") === "El factor principal es la carga comercial."
    && stripLanguageLeaks("Los drivers del margen son costo y carga.") === "Los factores del margen son costo y carga.",
    "driver/drivers → factor/factores");
  ok(stripLanguageLeaks("La performance comercial de Falabella mejoró.") === "El desempeño comercial de Falabella mejoró.",
    "«la performance» → «el desempeño» (artículo enumerado: cambia de género)");
  const nota = "Falabella cede margen por carga alta. Sin driver interno obvio en los 5.";
  ok(stripLanguageLeaks(nota) === "Falabella cede margen por carga alta.",
    "«driver interno» NO se traduce: sigue siendo el marcador de nota interna y la oración entera se elimina", stripLanguageLeaks(nota));
  const adoptados = "Tu benchmark es 30.1%, el rebate es parte de la carga, tu target de carga es 3.5% y el gap de margen se descompone.";
  ok(stripLanguageLeaks(adoptados) === adoptados,
    "el vocabulario ADOPTADO no se barre: benchmark, rebate, target (label vivo del dato) y gap (etiqueta de brecha)");
  const limpia = "Falabella cede margen por carga alta: 22% contra un benchmark de 30.1%. La brecha es de 8.1 puntos.";
  ok(stripLanguageLeaks(limpia) === limpia, "una narración sin anglicismos sale byte-idéntica");
}

console.log(`\n── RESIDUALES CERT VIVO #2 (Paso 3c) · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
