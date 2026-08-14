/* === _solo_acento_gate.mjs · GATE · preferencia de respuesta reconoce "sólo" (con tilde) ===
 * owner 2026-07-31, auditoría (defecto "Preferencias de respuesta" — regex sin acento):
 *
 * answerViaOracle.js (_PREF_DATA_ONLY_RE, _PREF_ACTION_ONLY_RE, _PREF_RESULTS_ONLY_SIM_RE, _PREF_ONE_TURN_RE) usaban
 * literalmente `\bsolo\b`, que NUNCA matchea la variante acentuada "sólo" (ortografía tradicional española, de uso
 * muy común). Confirmado por test de regex aislado, sin LLM involucrado — bug 100% determinístico. Cuando además la
 * comprensión propia del LLM en la Pasada 1 tampoco marca plan.pref (ocurrió en el caso real), el usuario que pide
 * explícitamente "sólo la cifra" (con tilde) recibía una respuesta completa, ignorando su preferencia declarada.
 *
 * FIX: las 4 regex se amplían a `\bs[oó]lo\b` (mismo patrón que ya usa el repo para otras variantes acentuadas,
 * ej. _CLARIFY_RE con expl[ií]c\w*). Este gate reproduce el caso EXACTO con tilde, mismo patrón/mocks que
 * _response_preference_gate.mjs (sección 1 y 4), que ya cubre la variante SIN tilde — así ambas conviven, ninguna
 * reemplaza a la otra.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

const SAFE_NARRATION = "El negocio se mantiene estable este período, sin sobresaltos que merezcan una alerta.";

console.log("── 1 · data_only con tilde: \"sólo la cifra\" (el caso EXACTO del hallazgo) ──");
{
  const PLAN = { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: { dimension: "cliente", filters: { cliente: "Sodimac" } } }] };
  let called = false;
  const r = await answerViaOracle({ text: "Dame el margen de Sodimac, sólo la cifra.", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async () => { called = true; return SAFE_NARRATION; } });
  ok(!called, '"sólo la cifra" (con tilde) fuerza data_only SIN invocar al narrador libre (antes: el narrador se invocaba igual, ignorando la preferencia)');
  ok(r && r.r && r.r.narrationRepaired === true, `la respuesta salió de la reparación determinística (data_only por construcción) — "${r && r.r && r.r.text.slice(0, 80)}..."`);
}

console.log('\n── 2 · action_only con tilde: "dame sólo la acción, sin el diagnóstico" ──');
{
  const PLAN = { intent: "answer", mode: "decision", calls: [{ tool: "diagnose", args: {} }] };
  let seenPref = null;
  const r = await answerViaOracle({ text: "¿a cuál priorizo? dame sólo la acción, sin el diagnóstico", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async (a) => { seenPref = a.pref; return "[[ACCION]]" + SAFE_NARRATION; } });
  ok(seenPref && seenPref.contentScope === "action_only", `"sólo la acción" (con tilde) fuerza action_only — obtuvo ${JSON.stringify(seenPref)}`);
}

console.log('\n── 3 · results_only con tilde (simulación): "dame sólo los resultados, sin recomendación" ──');
{
  const PLAN = { intent: "answer", mode: "simulacion", calls: [{ tool: "simulateCarga", args: {} }] };
  let called = false;
  const r = await answerViaOracle({ text: "¿y si bajo la carga al target? dame sólo los resultados, sin recomendación", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async () => { called = true; return SAFE_NARRATION; } });
  ok(!called, '"sólo los resultados" (con tilde), en simulación, resuelve results_only SIN invocar al narrador');
  ok(r && r.r && r.r.narrationRepaired === true, "la respuesta salió de la reparación determinística, no del narrador");
}

console.log('\n── 4 · "solo por esta vez" con tilde sigue ganando sobre un reset ──');
{
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  const callPlan = async () => PLAN;
  const callNarrate = async () => SAFE_NARRATION;
  const rBrief = await answerViaOracle({ text: "desde ahora respondeme breve", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(rBrief.mem.responsePref.detailLevel === "brief", "sesión inicial en brief");
  const rOneTurnReset = await answerViaOracle({ text: "dame el análisis completo, pero sólo por esta vez", history: [], mem: rBrief.mem, scenario: "actual", callPlan, callNarrate });
  ok(rOneTurnReset && rOneTurnReset.mem.responsePref && rOneTurnReset.mem.responsePref.detailLevel === "brief", `"sólo por esta vez" (con tilde) sigue ganando incluso sobre un reset — la sesión NO se cancela — obtuvo ${JSON.stringify(rOneTurnReset && rOneTurnReset.mem.responsePref)}`);
}

console.log("\n── 5 · REGRESIÓN — la variante SIN tilde sigue funcionando igual (no se rompe el caso ya probado) ──");
{
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
  let called = false;
  const r = await answerViaOracle({ text: "dame un resumen ejecutivo, solo cifras", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async () => { called = true; return SAFE_NARRATION; } });
  ok(!called, '"solo cifras" (sin tilde) sigue resolviendo data_only sin invocar al narrador');
}

console.log(`\n── _solo_acento_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
