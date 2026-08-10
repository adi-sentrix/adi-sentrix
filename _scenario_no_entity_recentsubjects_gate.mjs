/* === _scenario_no_entity_recentsubjects_gate.mjs · GATE · el bypass "no_entity" consulta recentSubjects ANTES de preguntar genérico ===
 * owner 2026-07-31, auditoría (defecto "Simulaciones"):
 *
 * El bypass determinístico scenarioIntent kind='no_entity' (answerViaOracle.js) operaba SOLO sobre el texto crudo
 * del turno actual, nunca sobre history/pendingSimulation, y se disparaba ANTES de invocar a PLAN. Un retorno
 * elíptico a una simulación cuya entidad quedó establecida turnos atrás (interrumpida por un tema no relacionado)
 * era interceptado con una pregunta genérica ("¿Para qué cliente...?"), perdiendo el contexto — aunque
 * mem.recentSubjects (Fase 3, sobrevive varios turnos, a diferencia de mem.pendingSimulation que se limpia cada
 * turno) SÍ tenía la entidad recuperable.
 *
 * FIX: antes de emitir la pregunta genérica, se consulta mem.recentSubjects — si hay un sujeto reciente
 * recuperable (dimension "cliente", la única que simulateGeneral soporta), el turno se deja pasar a PLAN en vez
 * de bypasearlo.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

const SAFE = "Texto de narración seguro, sin cifras inventadas.";

console.log("── 1 · turno 1: establece Falabella como sujeto reciente (scope.level=entity) ──");
let mem = {};
{
  const PLAN1 = { intent: "answer", mode: "default", rationale: "perfil", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } }] };
  const r1 = await answerViaOracle({ text: "¿cómo viene Falabella?", history: [], mem, scenario: "actual", callPlan: async () => PLAN1, callNarrate: async () => SAFE });
  ok(!!r1, "turno 1 responde");
  ok(!!r1 && Array.isArray(r1.mem.recentSubjects) && r1.mem.recentSubjects[0] && r1.mem.recentSubjects[0].entidad === "Falabella", `mem.recentSubjects[0] = Falabella — obtuvo ${JSON.stringify(r1 && r1.mem.recentSubjects)}`);
  mem = r1.mem;
}

console.log("\n── 2 · turno 2: desvío de tema (scope global) — recentSubjects debe SOBREVIVIR ──");
{
  const PLAN2 = { intent: "answer", mode: "default", rationale: "resumen", scope: { level: "global" }, calls: [{ tool: "executiveSummary", args: {} }] };
  const r2 = await answerViaOracle({ text: "¿cómo viene el negocio en general?", history: [{ role: "user", gist: "¿cómo viene Falabella?" }, { role: "assistant", gist: SAFE }], mem, scenario: "actual", callPlan: async () => PLAN2, callNarrate: async () => SAFE });
  ok(!!r2, "turno 2 (desvío de tema) responde");
  ok(!!r2 && Array.isArray(r2.mem.recentSubjects) && r2.mem.recentSubjects.some((s) => s.entidad === "Falabella"), `Falabella SOBREVIVE el desvío de tema en mem.recentSubjects — obtuvo ${JSON.stringify(r2 && r2.mem.recentSubjects)}`);
  ok(!r2.mem.pendingSimulation, "mem.pendingSimulation sigue null (nunca se estableció una simulación pendiente)");
  mem = r2.mem;
}

console.log('\n── 3 · turno 3: retorno ELÍPTICO ("bajale el precio un 5%", sin nombrar cliente) — debe llegar a PLAN, NO preguntar genérico ──');
{
  let planCalled = false;
  const PLAN3 = { intent: "answer", mode: "simulacion", rationale: "retoma la simulación de Falabella por comprensión", scope: { level: "entity", entities: ["Falabella"] }, supuestos_faltantes: ["¿cuánto esperás que cambie el volumen o las unidades vendidas?"], calls: [] };
  const r3 = await answerViaOracle({
    text: "bajale el precio un 5%",
    history: [{ role: "user", gist: "¿cómo viene Falabella?" }, { role: "assistant", gist: SAFE }, { role: "user", gist: "¿cómo viene el negocio en general?" }, { role: "assistant", gist: SAFE }],
    mem, scenario: "actual",
    callPlan: async (a) => { planCalled = true; return PLAN3; },
    callNarrate: async () => SAFE,
  });
  ok(planCalled === true, "PLAN fue invocado para el turno 3 (el bypass NO se disparó porque había un sujeto reciente recuperable)");
  ok(!!r3 && !/para qu[eé] cliente/i.test(r3.r.text || ""), `la respuesta NO es la pregunta genérica "¿Para qué cliente...?" (recuperó el contexto) — obtuvo: "${r3 && r3.r && r3.r.text}"`);
}

console.log("\n── 4 · REGRESIÓN — SIN sujeto reciente recuperable, el bypass genérico sigue funcionando igual ──");
{
  let planCalled = false;
  const r4 = await answerViaOracle({ text: "bajale el precio un 5%", history: [], mem: {}, scenario: "actual", callPlan: async () => { planCalled = true; return { intent: "answer", mode: "default", calls: [] }; }, callNarrate: async () => SAFE });
  ok(planCalled === false, "sin recentSubjects, el bypass SIGUE disparando (PLAN nunca se invoca)");
  // Etapa 3 (owner 2026-08-03, continuidad conversacional universal) generalizó el texto de esta pregunta —
  // simulateGeneral ya soporta cliente/sku/marca/familia (toolContracts.js), así que "¿Para qué CLIENTE...?" (solo
  // un eje) quedó stale; ahora pregunta por el eje/entidad en general — el comportamiento (bypass dispara, PLAN
  // nunca se invoca) es el mismo, solo cambió la redacción.
  ok(!!r4 && /qu[eé] (cliente|entidad)/i.test(r4.r.text || ""), `sin contexto recuperable, sigue preguntando por la entidad/eje del escenario — obtuvo: "${r4 && r4.r && r4.r.text}"`);
}

console.log(`\n── _scenario_no_entity_recentsubjects_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
