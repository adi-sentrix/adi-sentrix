/* === _repair_decision_clarify_gate.mjs · GATE · reparación desde la boleta también cubre decision/clarify (full) ===
 * owner 2026-07-31, auditoría (defecto "Diagnóstico, causas y acciones" / "Orientación, aclaración y continuidad"):
 *
 * Cuando guardC bloquea correctamente una cifra citada por el narrador que NO está autorizada en la boleta del
 * turno actual, el mecanismo de reparación (composeFromLedger) solo cubría los modos action_only/simDegradado. Para
 * modo=decision (contentScope=full) y modo=clarify no existía NINGÚN camino de reparación: tras 3 intentos de
 * narrar rechazados, answerViaOracle devolvía null — abstención total y silenciosa, la conversación caía a la ruta
 * legacy sin que el usuario reciba ninguna respuesta. Confirmado 2/2 en Diagnóstico caso8 (misma pregunta, 2
 * corridas) y 2/4 en Orientación caso6.
 *
 * FIX: se generaliza la condición de reparación en answerViaOracle.js — cualquier rechazo de contentScope="full"
 * (no solo simDegradado) repara desde composeFromLedger/composeNoDataMessage antes de abstenerse del todo. Mismo
 * argumento de seguridad que ya valía para simDegradado: componer desde figs YA autorizadas nunca puede inventar.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

// el narrador SIEMPRE cita una cifra fabricada, no autorizada por ninguna boleta real — simula el caso confirmado
// (una cifra real de otro alcance, o directamente inventada) que guardC rechaza los 3 intentos sin excepción.
const HALLUCINATING_NARRATE = async () => "Falabella podría recuperar hasta $999K si ataca esto primero.";

console.log("── 1 · modo=decision, contentScope=full: guardC rechaza los 3 intentos → repara desde la boleta, NO null ──");
{
  const PLAN = { intent: "answer", mode: "decision", rationale: "priorizar", scope: { level: "entity", entities: ["Sodimac"] }, calls: [{ tool: "marginRead", args: { dimension: "cliente", filters: { cliente: "Sodimac" } } }] };
  const r = await answerViaOracle({ text: "¿qué hago primero con Sodimac?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: HALLUCINATING_NARRATE });
  ok(r !== null, `answerViaOracle NO devuelve null (antes: abstención total tras 3 intentos rechazados) — obtuvo ${r === null ? "null" : "respuesta"}`);
  ok(!!r && r.r.narrationRepaired === true, `la respuesta viene marcada narrationRepaired=true (reparada desde la boleta, no la alucinación) — obtuvo ${r && r.r.narrationRepaired}`);
  ok(!!r && !/\$999K/.test(r.r.text), `el texto final NUNCA contiene la cifra fabricada $999K — obtuvo: "${r && r.r.text}"`);
  ok(!!r && /Sodimac/.test(r.r.text), `el texto final SÍ trae cifras reales y autorizadas de Sodimac — obtuvo: "${r && r.r.text}"`);
}

console.log("\n── 2 · modo=clarify, contentScope=full: mismo mecanismo de reparación ──");
{
  const PLAN = { intent: "define", mode: "clarify", rationale: "qué es X", scope: { level: "entity", entities: ["Sodimac"] }, calls: [{ tool: "marginRead", args: { dimension: "cliente", filters: { cliente: "Sodimac" } } }] };
  const r = await answerViaOracle({ text: "no entendí, ¿cuál es el margen de Sodimac?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: HALLUCINATING_NARRATE });
  ok(r !== null, `modo=clarify: answerViaOracle NO devuelve null — obtuvo ${r === null ? "null" : "respuesta"}`);
  ok(!!r && r.r.narrationRepaired === true, "modo=clarify: la respuesta viene reparada desde la boleta");
}

console.log("\n── 3 · REGRESIÓN — cuando el narrador SÍ es fiel, sigue narrando libre normalmente (no siempre repara) ──");
{
  const PLAN = { intent: "answer", mode: "decision", rationale: "priorizar", scope: { level: "entity", entities: ["Sodimac"] }, calls: [{ tool: "marginRead", args: { dimension: "cliente", filters: { cliente: "Sodimac" } } }] };
  const r = await answerViaOracle({ text: "¿qué hago primero con Sodimac?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async () => "El margen de Sodimac está bajo el benchmark; empezá renegociando su carga comercial." });
  ok(!!r && !r.r.narrationRepaired, `un narrador fiel (sin cifras inventadas) NO se marca como reparado — sigue el camino normal — obtuvo narrationRepaired=${r && r.r.narrationRepaired}`);
}

console.log("\n── 4 · REGRESIÓN — sin NINGUNA cifra autorizada (boleta vacía), sigue abstiniéndose (null), no inventa una tabla vacía ──");
{
  const PLAN = { intent: "answer", mode: "decision", rationale: "entidad inexistente", scope: { level: "entity", entities: ["EmpresaQueNoExiste9999"] }, calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "EmpresaQueNoExiste9999" } }] };
  const r = await answerViaOracle({ text: "¿qué hago primero con EmpresaQueNoExiste9999?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: HALLUCINATING_NARRATE });
  ok(r !== null, `sin datos reales, IGUAL compone un mensaje honesto de "no tengo información" (composeNoDataMessage) en vez de null — obtuvo ${r === null ? "null" : "respuesta"}`);
  ok(!!r && /no tengo informaci[oó]n/i.test(r.r.text), `el mensaje declara honestamente la falta de datos — obtuvo: "${r && r.r.text}"`);
}

console.log(`\n── _repair_decision_clarify_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
