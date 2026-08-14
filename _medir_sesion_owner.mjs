/* === _medir_sesion_owner.mjs · Reproduce las 2 incógnitas de la sesión en vivo del owner (2026-08-14,
 * autorización de pruebas vigente): (A) «¿Dónde tengo capital inmovilizado?» — ¿por qué cae al suplente?
 * (B) el hilo de ventas 4% completo hasta «simula sobre el total de ventas». TOPE DURO 12 llamadas.
 * Mismo cableado que _medir_respaldo_vivo.mjs (anthropic, 90s). */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
process.env.LLM_PROVIDER = "anthropic";
process.env.LLM_TIMEOUT_MS = "90000";
delete process.env.LLM_MODEL_PARSE;
delete process.env.LLM_MODEL_NARRATE;

import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { proyectarDatoNegocio } from "./src/adi/oracle/datoProyectado.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const CAP = 12;
let llamadas = 0;
const DATO = proyectarDatoNegocio("actual");
const _cap = (s) => { llamadas++; if (llamadas > CAP) throw new Error(`TOPE (${CAP}) en ${s}`); };
const _ms = () => Number(process.hrtime.bigint() / 1000000n);

async function turno(q, history, mem, reg) {
  const t = { q, tiempos: [], plan: null };
  const callPlan = async (a) => {
    _cap("plan"); const t0 = _ms();
    const pr = await handlePlan({ text: a.text, history: a.history, mem: a.mem, scenario: a.scenario, attempt: a.attempt, vistaLinea: a.vistaLinea });
    t.tiempos.push({ p: "PLAN", ms: _ms() - t0, ok: !!pr.ok });
    if (!pr.ok) throw new Error(`handlePlan: ${pr.error || "sin plan"}`);
    t.plan = { intent: pr.plan.intent, mode: pr.plan.mode, tools: (pr.plan.calls || []).map((c) => c.tool) };
    return pr.plan;
  };
  const callNarrate = async (args) => {
    _cap("narrate"); const t0 = _ms();
    const payload = buildNarrateUserMessageC(args);
    let nr;
    try { nr = await handleNarrateC({ payload, mem: args.mem, attempt: args.attempt, datoNegocio: DATO }); }
    catch (e) { t.tiempos.push({ p: "NARRAR", ms: _ms() - t0, ok: false, err: String(e && e.message).slice(0, 90) }); throw e; }
    t.tiempos.push({ p: "NARRAR", ms: _ms() - t0, ok: !!nr.ok, err: nr.ok ? null : String(nr.error || "").slice(0, 90) });
    if (!nr.ok) throw new Error(`handleNarrateC: ${nr.error || "sin narración"}`);
    return nr.narration;
  };
  const out = await answerViaOracle({ text: q, history, mem, scenario: "actual", callPlan, callNarrate });
  t.final = { text: out && out.r.text, det: !!(out && out.r.deterministic), rep: !!(out && out.r.narrationRepaired), retryTrace: (out && out.r.retryTrace) || null };
  reg.push(t);
  console.log(`\n═══ «${q}»`);
  console.log(`plan: ${t.plan ? JSON.stringify(t.plan) : "(bypass determinístico, 0 llamadas)"} · tiempos: ${t.tiempos.map((x) => `${x.p} ${(x.ms / 1000).toFixed(1)}s${x.ok ? "" : " ✗" + (x.err || "")}`).join(" · ") || "—"}`);
  const nt = t.final.retryTrace && t.final.retryTrace.narrate;
  if (nt) for (const x of nt) console.log(`  guard[${x.attempt}]: ok=${x.guardOk} · ${x.reason || "fiel"}${x.detalle ? " · " + x.detalle.join(" | ") : ""}${x.reparado ? " · REPARADO" : ""}`);
  console.log(`SUPLENTE=${t.final.det || t.final.rep}`);
  console.log(`ADI ▸ ${String(t.final.text || "(sin texto)").slice(0, 500)}`);
  return out;
}

const registro = [];
console.log("── A · CAPITAL ──");
await turno("¿Dónde tengo capital inmovilizado?", [], {}, registro);

console.log("\n── B · EL HILO DE VENTAS DEL OWNER ──");
let history = [], mem = {};
for (const q of ["Si subo ventas 4%, ¿qué cambia?", "sobre las ventas", "simula sobre el total de ventas"]) {
  const out = await turno(q, history, mem, registro);
  history = history.concat([{ role: "user", text: q }, { role: "adi", text: (out && out.r.text) || "" }]);
  mem = (out && out.mem) || mem;
}

fs.writeFileSync("_medir_sesion_owner.json", JSON.stringify({ fecha: "2026-08-14", llamadas, registro }, null, 2), "utf8");
console.log(`\n─── llamadas: ${llamadas}/${CAP} · transcript en _medir_sesion_owner.json`);
