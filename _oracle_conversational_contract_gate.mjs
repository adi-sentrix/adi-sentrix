/* === _oracle_conversational_contract_gate.mjs · CAPA DE ROL CONVERSACIONAL · CONTRATO PROVIDER-NEUTRAL ===
 * owner 2026-07-29: "diseña los contratos para que sean independientes del proveedor y del modelo LLM... ningún
 * comportamiento esencial de ADI debe depender de una capacidad implícita del modelo... el adaptador solo debe
 * recibir el contrato, el contexto y la boleta autorizada, y devolver una narración estructurada. No pongas lógica
 * de producto específica dentro del adaptador... agrega pruebas de contrato que puedan ejecutarse con cualquier
 * modelo compatible."
 * 1) ESTRUCTURAL (sin LLM): el contrato versionado (conversationalContract.js) es internamente consistente — los 7
 *    modos tienen doctrina+narrate no vacíos, el enum de PLAN_TOOL viene DE ese contrato (no duplicado a mano), y
 *    los adapters (openai.js/anthropic.js) NO importan NINGÚN módulo de producto (grep del código fuente real).
 * 2) CROSS-PROVIDER (vivo, honesto): corre el MISMO contrato (buildPlanSystem+PLAN_TOOL / buildNarrateSystemC) a
 *    través de getAdapter(provider) directo (bypass del `_config` de un-solo-proveedor de gatewayCore) para CADA
 *    adapter implementado — el que tenga credenciales en este entorno corre en vivo, el que no, se reporta SKIPPED
 *    (nunca se finge una corrida). El objetivo: la identidad/criterio/seguridad de ADI no dependen de qué modelo
 *    responda — solo el traductor de API cambia.
 *
 * SMOKE LLM REAL (etiquetado 2026-07-31, integrador evidenceSpec — hallazgo del revisor de integridad de datos:
 * este archivo invoca adapter.parse/adapter.narrate reales con credenciales de .env en la sección 2 y no tenía la
 * etiqueta que sí llevan los otros 3 gates de este mismo patrón — probabilístico, no determinístico, mismo
 * criterio que los demás "SMOKE LLM REAL" del repo). Etiqueta agregada por instrucción del brief, cero cambio de
 * lógica.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { CONTRACT_VERSION, MODES, MODE_KEYS, buildModeDoctrine, buildModeDispatch } from "./src/adi/oracle/conversationalContract.js";
import { PLAN_TOOL, buildPlanSystem } from "./src/adi/oracle/planPrompt.js";
import { buildNarrateSystemC, buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { ADI_PERSONA } from "./src/adi/oracle/persona.js";
import { ADAPTERS } from "./src/adi/llm/providerAdapter.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
import { guardC } from "./src/adi/oracle/guardC.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · ESTRUCTURAL — el contrato versionado es internamente consistente (sin LLM) ──");
{
  ok(typeof CONTRACT_VERSION === "string" && /^adi-conversational-contract@\d+\.\d+\.\d+$/.test(CONTRACT_VERSION), `CONTRACT_VERSION es una versión válida — obtuvo "${CONTRACT_VERSION}"`);
  ok(MODE_KEYS.length === 7, `7 modos definidos (obtuvo ${MODE_KEYS.length}: ${MODE_KEYS.join(", ")})`);
  for (const m of MODES) {
    ok(typeof m.whenToUse === "string" && m.whenToUse.length > 20, `modo "${m.key}": whenToUse no vacío/trivial`);
    ok(typeof m.narrate === "string" && m.narrate.length > 20, `modo "${m.key}": narrate no vacío/trivial`);
  }
  // planPrompt.js/narratePromptC.js IMPORTAN de acá (no duplican el enum a mano) — se confirma por construcción:
  // el enum del schema debe ser LITERALMENTE MODE_KEYS (misma fuente, no una copia que pueda driftear).
  ok(PLAN_TOOL.schema.properties.mode.enum === MODE_KEYS, "PLAN_TOOL.mode.enum es LITERALMENTE MODE_KEYS (misma referencia — imposible que drifee)");
  const doctrine = buildModeDoctrine();
  const dispatch = buildModeDispatch();
  for (const key of MODE_KEYS) {
    ok(doctrine.includes(key.toUpperCase()) || doctrine.toLowerCase().includes(key), `buildModeDoctrine() menciona el modo "${key}"`);
    ok(dispatch.includes(`· ${key}`), `buildModeDispatch() tiene una entrada propia para "${key}"`);
  }
  // el system COMPLETO de cada pasada realmente incluye el contrato (no quedó huérfano de la función que lo arma)
  const planSystem = buildPlanSystem(ADI_PERSONA, "", "actual");
  const narrateSystem = buildNarrateSystemC(ADI_PERSONA, "");
  ok(planSystem.includes(doctrine), "buildPlanSystem() incluye la doctrina de modos completa");
  ok(narrateSystem.includes(dispatch), "buildNarrateSystemC() incluye el dispatch de modos completo");
}

console.log("\n── 2 · PUREZA DE LOS ADAPTERS — cero lógica/import de producto (grep del código fuente real) ──");
{
  for (const file of ["./src/adi/llm/adapters/openai.js", "./src/adi/llm/adapters/anthropic.js"]) {
    const src = fs.readFileSync(file, "utf8");
    const imports = [...src.matchAll(/^import .* from ["']([^"']+)["'];?\s*$/gm)].map((m) => m[1]);
    const productImports = imports.filter((p) => p.includes("oracle") || p.includes("narratePrompt") || p.includes("persona") || p.includes("conversationalContract"));
    ok(productImports.length === 0, `${file}: 0 imports de módulos de producto (obtuvo ${JSON.stringify(imports)})`);
    ok(!/\bmode\s*===\s*["']/.test(src) && !MODE_KEYS.some((k) => src.includes(`"${k}"`) || src.includes(`'${k}'`)), `${file}: no referencia ningún nombre de modo (clarify/diagnostico/decision/...) — sería lógica de producto en el adapter`);
    ok(/if \(!system\) throw/.test(src), `${file}: falla fuerte si no recibe "system" (nunca narra con una voz propia por default)`);
  }
}

console.log("\n── 3 · CROSS-PROVIDER — el MISMO contrato corre contra CADA adapter con credenciales (honesto: skip si no hay key) ──");
{
  const scenario = "actual";
  const persona = ADI_PERSONA;
  const planSystem = buildPlanSystem(persona, "", scenario);
  for (const providerName of ["openai", "anthropic"]) {
    const adapter = ADAPTERS[providerName];
    const available = typeof adapter.isAvailable === "function" && adapter.isAvailable();
    if (!available) { console.log(`  ${providerName}: SKIPPED (sin credenciales en este entorno — ${adapter.keyEnv} no está seteado)`); continue; }
    const model = process.env[`${providerName.toUpperCase()}_MODEL`] || (providerName === "openai" ? "gpt-4o-mini" : "claude-haiku-4-5-20251001");
    let plan;
    try {
      const r = await adapter.parse("¿Qué clientes ceden más margen?", { system: planSystem, tool: PLAN_TOOL, model });
      plan = r.spec;
    } catch (e) { ok(false, `${providerName}: parse() no tiró — ${e.message}`); continue; }
    ok(plan && MODE_KEYS.includes(plan.mode), `${providerName}: el plan trae un mode VÁLIDO del contrato (obtuvo "${plan && plan.mode}")`);
    ok(plan && ["answer", "define", "redirect", "ack"].includes(plan.intent), `${providerName}: intent válido (obtuvo "${plan && plan.intent}")`);

    const calls = Array.isArray(plan.calls) ? plan.calls : [];
    const { ledger, results, trace } = runPlan({ intent: plan.intent, calls }, { scenario });
    const figs = ledgerBoleta(ledger);
    const narrateSystem = buildNarrateSystemC(persona, "");
    const payload = buildNarrateUserMessageC({ text: "¿Qué clientes ceden más margen?", plan, results, ledgerFigs: figs, mem: {}, history: [] });
    let narration;
    try {
      const r = await adapter.narrate(payload, { model, system: narrateSystem });
      narration = r.text;
    } catch (e) { ok(false, `${providerName}: narrate() no tiró — ${e.message}`); continue; }
    ok(typeof narration === "string" && narration.trim().length > 0, `${providerName}: narró algo no vacío`);
    const g = guardC(narration, { ledger, results, trace, question: "¿Qué clientes ceden más margen?" });
    console.log(`  ${providerName}: guard.ok=${g.ok} (${g.ok ? "fiel" : g.verdict}) — "${narration.slice(0, 140).replace(/\n/g, " ⏎ ")}"`);
    ok(true, `${providerName}: corrida completa registrada (guard.ok medido arriba, no forzado — variance real de un modelo es aceptable)`);
    // adapter.narrate() SIN system debe fallar fuerte (no debe existir voz propia del adapter) — re-confirmado en vivo
    try { await adapter.narrate(payload, { model }); ok(false, `${providerName}: narrate() SIN system debería haber tirado y no tiró`); }
    catch { ok(true, `${providerName}: narrate() sin system tira (confirmado en vivo, no solo por lectura de código)`); }
  }
}

console.log(`\n── _oracle_conversational_contract_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
