/* === _oracle_plan_retry_gate.mjs · ARQUITECTURA C · GATE DE RETRY DEL PLAN === hallazgo del re-barrido de 17
 * turnos (owner 2026-07-29): a diferencia de NARRAR (3 intentos), el PLAN no reintentaba — un JSON inválido del
 * tool_call (variance del LLM, ver src/adi/llm/adapters/openai.js) tumbaba el turno entero al fallback en el
 * primer intento. Fix en answerViaOracle.js: mismo loop de 3 intentos que ya usa NARRAR.
 * Determinístico · sin LLM real: `callPlan` es INYECTADO (mismo mecanismo que usa la app real para separar
 * headless/cliente), así que acá lo reemplazamos por un mock que simula fallas transitorias EXACTAS y controladas
 * — no dependemos de que el LLM falle de verdad para probar el mecanismo de retry en sí.
 */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

const OK_PLAN = { intent: "ack", calls: [] };
const OK_NARRATE = async () => "Listo, quedó anotado.";   // narración sin cifras → guardC no tiene nada que objetar

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · recupera tras 1 falla transitoria (throw) en el intento 1, éxito en el 2 ──");
{
  let calls = 0;
  const callPlan = async () => { calls++; if (calls === 1) throw new Error("JSON inválido del tool_call: Unterminated string"); return OK_PLAN; };
  const r = await answerViaOracle({ text: "hola", callPlan, callNarrate: OK_NARRATE, scenario: "actual" });
  ok(r && r.r && r.r.route === "oracle", `answerViaOracle recupera y devuelve route=oracle (calls al mock: ${calls})`);
  ok(calls === 2, `callPlan se llamó exactamente 2 veces (1 falla + 1 éxito, no de más) — obtuvo ${calls}`);
}

console.log("\n── 2 · recupera tras 2 fallas transitorias, éxito en el intento 3 (el último posible) ──");
{
  let calls = 0;
  const callPlan = async () => { calls++; if (calls <= 2) throw new Error("JSON inválido del tool_call"); return OK_PLAN; };
  const r = await answerViaOracle({ text: "hola", callPlan, callNarrate: OK_NARRATE, scenario: "actual" });
  ok(r && r.r && r.r.route === "oracle", `recupera en el ÚLTIMO intento posible (calls: ${calls})`);
  ok(calls === 3, `callPlan se llamó exactamente 3 veces — obtuvo ${calls}`);
}

console.log("\n── 3 · las 3 fallan → abstención limpia (null), NO crashea ──");
{
  let calls = 0;
  const callPlan = async () => { calls++; throw new Error("JSON inválido del tool_call"); };
  const r = await answerViaOracle({ text: "hola", callPlan, callNarrate: OK_NARRATE, scenario: "actual" });
  ok(r === null, `answerViaOracle devuelve null (cae al fallback viejo) sin lanzar excepción — obtuvo ${JSON.stringify(r)}`);
  ok(calls === 3, `agotó los 3 intentos antes de rendirse — obtuvo ${calls}`);
}

console.log("\n── 4 · plan con forma inválida (sin .intent, NO throw) también dispara reintento ──");
{
  let calls = 0;
  const callPlan = async () => { calls++; return calls === 1 ? { calls: [] } /* sin intent */ : OK_PLAN; };
  const r = await answerViaOracle({ text: "hola", callPlan, callNarrate: OK_NARRATE, scenario: "actual" });
  ok(r && r.r && r.r.route === "oracle", `recupera cuando el 1er intento devuelve forma inválida sin tirar excepción (calls: ${calls})`);
  ok(calls === 2, `reintentó tras la forma inválida — obtuvo ${calls}`);
}

console.log("\n── 5 · CONTROL — camino feliz: éxito al primer intento, CERO reintentos de más (no regresiona el caso normal) ──");
{
  let calls = 0;
  const callPlan = async () => { calls++; return OK_PLAN; };
  const r = await answerViaOracle({ text: "hola", callPlan, callNarrate: OK_NARRATE, scenario: "actual" });
  ok(r && r.r && r.r.route === "oracle", "responde normal al primer intento");
  ok(calls === 1, `NO reintenta innecesariamente cuando el 1er intento ya fue válido — obtuvo ${calls} (debe ser 1)`);
}

console.log(`\n── _oracle_plan_retry_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
