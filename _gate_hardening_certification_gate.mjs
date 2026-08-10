/* === _gate_hardening_certification_gate.mjs · CERTIFICACIÓN AGREGADA · las 5 protecciones juntas (owner 2026-08-03) ===
 * Dashboard DETERMINÍSTICO de la investigación cruzada + integración de _oracle_clarify_mode_gate.mjs /
 * _oracle_multimodo_gate.mjs / _oracle_provider_certification_gate.mjs / _oracle_plan_gate.mjs /
 * _oracle_tension_gate.mjs, en una sola corrida:
 *   1. TASA DE CUMPLIMIENTO de cada uno de los 5 gates originales — los corre como subproceso real (mismo mecanismo
 *      que scripts/run-gates.mjs) y parsea su propio resumen "X PASS · Y FAIL" — NUNCA reimplementa su lógica.
 *   2. ESCALADA DE MODELO (mini→terra→sol): (a) el mapeo PURO attempt→tier de modelRouter.chooseModel — 100%
 *      determinístico, sin red; (b) DEMOSTRACIÓN end-to-end (mocks, sin LLM real) de que un RECHAZO forzado de
 *      guardC (violación real, no solo `degraded`) efectivamente dispara el reintento con `attempt` incrementado en
 *      el loop real de answerViaOracle.js — la escalada "funciona cuando se fuerza un rechazo", tal como pide el
 *      checklist, sin depender de rate-limit real ni de qué tan disponible esté el proveedor hoy.
 *   3. LATENCIA aproximada de cada gate original (wall-clock del subproceso).
 *   4. COSTO aproximado (tokens) — UN solo par PLAN+NARRAR real mínimo (SMOKE LLM REAL, probabilístico: si no hay
 *      credencial o el proveedor está saturado, se reporta N/A — no tumba este gate, no es lo que certifica).
 * Los checks 1/3/4 son un DASHBOARD (informativo — dependen del proveedor/rate-limit del momento, exactamente como
 * el resto de "SMOKE LLM REAL" de este repo). El check 2 es la ÚNICA parte que afecta el exit code de este gate:
 * 100% determinístico, debe fallar SIEMPRE que la escalada de modelo se rompa, sin excepción ni variance.
 */
import fs from "fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { chooseModel } from "./src/adi/llm/modelRouter.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

const ROOT = dirname(fileURLToPath(import.meta.url));
const ORIGINAL_5 = [
  "_oracle_clarify_mode_gate.mjs",
  "_oracle_multimodo_gate.mjs",
  "_oracle_provider_certification_gate.mjs",
  "_oracle_plan_gate.mjs",
  "_oracle_tension_gate.mjs",
];

console.log("═══ 2 · ESCALADA DE MODELO (DETERMINÍSTICO — único bloque que afecta el exit code de este gate) ═══\n");

console.log("── 2a · modelRouter.chooseModel — mapeo PURO attempt→tier (sin red, sin proveedor) ──");
{
  const t1 = chooseModel({ provider: "openai", tier1: "gpt-4o-mini", attempt: 0, step: "narrate" });
  const t2 = chooseModel({ provider: "openai", tier1: "gpt-4o-mini", attempt: 1, step: "narrate" });
  const t3 = chooseModel({ provider: "openai", tier1: "gpt-4o-mini", attempt: 2, step: "narrate" });
  ok(t1 && t1.tier === 1 && t1.model === "gpt-4o-mini", `attempt=0 → tier1 (mini) — obtuvo ${JSON.stringify(t1)}`);
  ok(t2 && t2.tier === 2 && t2.model !== t1.model, `attempt=1 → tier2 (modelo DISTINTO de tier1) — obtuvo ${JSON.stringify(t2)}`);
  ok(t3 && t3.tier === 3 && t3.model !== t2.model, `attempt=2 → tier3 (modelo DISTINTO de tier2) — obtuvo ${JSON.stringify(t3)}`);
  const clamped = chooseModel({ provider: "openai", tier1: "gpt-4o-mini", attempt: 999, step: "narrate" });
  ok(clamped.tier === 3, `attempt=999 (hostil) sigue acotado a tier3, NUNCA un tier4+ — obtuvo tier${clamped.tier}`);
  const otroProveedor = chooseModel({ provider: "anthropic", tier1: "claude-haiku-4-5-20251001", attempt: 1, step: "narrate" });
  ok(otroProveedor === null, "proveedor≠openai → el router NO aplica (null), el caller usa su modelo estático de siempre");
  ok(!!t1.reason && !!t2.reason && !!t3.reason, "cada tier trae una `reason` legible (telemetría, nunca decide nada)");
}

console.log("\n── 2b · end-to-end (mocks, sin LLM real) — un RECHAZO real de guardC SÍ dispara reintento con attempt++ ──");
{
  // pregunta con UNA cifra en el texto (autorizada por eco) — la primera narración inventa una cifra NO autorizada
  // (rechazo REAL de guardC, no solo `degraded`); el 2do intento cita solo lo autorizado → guardC la acepta.
  const seenAttempts = [];
  const callPlan = async () => ({ intent: "ack", calls: [] });
  const callNarrate = async ({ attempt }) => {
    seenAttempts.push(attempt);
    return attempt === 0
      ? "La contribución no capturada asciende a $842,193,777 este período." // cifra inventada, sin autorización → guardC la rechaza
      : "No hay cifras autorizadas adicionales para este turno.";
  };
  const r = await answerViaOracle({ text: "hola", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(!!r && r.r && r.r.route === "oracle", "el turno se recupera tras el rechazo (no cae a fallback total)");
  ok(seenAttempts.length >= 2 && seenAttempts[0] === 0 && seenAttempts[1] === 1, `guardC rechazó el intento 0 (cifra no autorizada) → el loop SÍ reintentó con attempt=1 — attempts: ${JSON.stringify(seenAttempts)}`);
  ok(r && r.r && r.r.text === "No hay cifras autorizadas adicionales para este turno.", "acepta la narración del reintento (la que SÍ pasa guardC), no la rechazada");
  // confirma DIRECTO que guardC de verdad rechazó la primera (no es que el mock ya sabía el resultado)
  const gRechazo = guardC("La contribución no capturada asciende a $842,193,777 este período.", { ledger: { figs: [] }, results: [], trace: null, question: "hola" });
  ok(gRechazo.ok === false && gRechazo.verdict === "cifra-no-autorizada", `guardC() confirma el rechazo real: ok=false, verdict="${gRechazo.verdict}"`);
}

console.log(`\n  ── subtotal ESCALADA (bloqueante): ${pass} PASS · ${fail} FAIL ──`);
const blockingPass = pass, blockingFail = fail;

console.log("\n═══ 1+3 · TASA DE CUMPLIMIENTO + LATENCIA de los 5 gates originales (DASHBOARD — informativo, subprocesos reales) ═══\n");
function runGateSubprocess(file, timeoutMs = 180000) {
  return new Promise((resolve) => {
    const start = Date.now();
    let out = "";
    const p = spawn(process.execPath, [file], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => { p.kill(); }, timeoutMs);
    p.stdout.on("data", (d) => { out += d.toString(); });
    p.stderr.on("data", (d) => { out += d.toString(); });
    p.on("close", (code) => {
      clearTimeout(timer);
      // formato estándar "X PASS · Y FAIL (de Z)" (la mayoría de los gates) — con fallback al formato propio de
      // _oracle_plan_gate.mjs ("PLAN-GATE · X/Y", sin FAIL explícito) para que el dashboard no lo reporte como
      // "sin resumen parseable" solo porque ese gate en particular imprime su tally distinto.
      const m = out.match(/(\d+)\s*PASS\s*·\s*(\d+)\s*FAIL\s*\(de\s*(\d+)\)/);
      const mPlan = !m ? out.match(/PLAN-GATE\s*·\s*(\d+)\/(\d+)/) : null;
      resolve({
        file, code, ms: Date.now() - start,
        summaryPass: m ? Number(m[1]) : (mPlan ? Number(mPlan[1]) : null),
        summaryFail: m ? Number(m[2]) : (mPlan ? Number(mPlan[2]) - Number(mPlan[1]) : null),
        summaryTotal: m ? Number(m[3]) : (mPlan ? Number(mPlan[2]) : null),
      });
    });
    p.on("error", () => { clearTimeout(timer); resolve({ file, code: 1, ms: Date.now() - start, summaryPass: null, summaryFail: null, summaryTotal: null }); });
  });
}

const dashboard = [];
for (const file of ORIGINAL_5) {
  console.log(`  ▶ corriendo ${file}...`);
  const r = await runGateSubprocess(file);
  dashboard.push(r);
  const rate = r.summaryTotal ? `${r.summaryPass}/${r.summaryTotal} asserts` : "(sin resumen parseable)";
  console.log(`    ${r.code === 0 ? "✓ PASS" : "✗ FAIL"} · exit=${r.code} · ${(r.ms / 1000).toFixed(1)}s · ${rate}`);
}

console.log("\n  ── DASHBOARD ──");
console.log("  gate".padEnd(42) + "exit".padEnd(8) + "latencia".padEnd(12) + "asserts");
for (const r of dashboard) {
  const rate = r.summaryTotal ? `${r.summaryPass}/${r.summaryTotal}` : "N/A";
  console.log(`  ${r.file.padEnd(40)}${String(r.code).padEnd(8)}${(r.ms / 1000).toFixed(1) + "s"} `.padEnd(54) + rate);
}
const gatesOk = dashboard.filter((r) => r.code === 0).length;
console.log(`\n  ${gatesOk}/${dashboard.length} gates originales exit=0 en esta corrida (informativo — variance de LLM real/rate-limit del proveedor, NO afecta el exit code de este gate — ver cabecera)`);

console.log("\n═══ 4 · COSTO APROXIMADO (tokens) — SMOKE LLM REAL mínimo, probabilístico, informativo ═══\n");
{
  try {
    const q = "¿cuál es el margen de Falabella?";
    const t0 = Date.now();
    const pr = await handlePlan({ text: q, history: [], mem: {}, scenario: "actual" });
    const planMs = Date.now() - t0;
    if (!pr.ok) throw new Error(pr.error || "handlePlan sin ok");
    console.log(`  PLAN: ${planMs}ms · modelo=${pr.modelUsed || "?"} · tokens=${pr.usage ? JSON.stringify(pr.usage) : "N/A (adapter no reportó usage)"}`);
    const { ledger, results } = runPlan({ intent: pr.plan.intent, calls: pr.plan.calls || [] }, { scenario: "actual" });
    const figs = ledgerBoleta(ledger);
    const payload = buildNarrateUserMessageC({ text: q, plan: pr.plan, results, ledgerFigs: figs, mem: {}, history: [] });
    const t1 = Date.now();
    const nr = await handleNarrateC({ payload, mem: {} });
    const narrateMs = Date.now() - t1;
    if (!nr.ok) throw new Error(nr.error || "handleNarrateC sin ok");
    console.log(`  NARRAR: ${narrateMs}ms · modelo=${nr.modelUsed || "?"} · tokens=${nr.usage ? JSON.stringify(nr.usage) : "N/A (adapter no reportó usage)"}`);
    console.log(`  total aproximado: ${planMs + narrateMs}ms para 1 turno simple (PLAN+NARRAR) — referencia de orden de magnitud, no un benchmark formal`);
  } catch (e) {
    console.log(`  N/A — no se pudo completar el smoke de costo (${String(e.message || e).slice(0, 200)}) — informativo, no afecta el exit code de este gate`);
  }
}

console.log(`\n── _gate_hardening_certification_gate: ${blockingPass} PASS · ${blockingFail} FAIL bloqueantes (de ${blockingPass + blockingFail}) — dashboard informativo arriba, no bloqueante ──`);
process.exit(blockingFail ? 1 : 0);
