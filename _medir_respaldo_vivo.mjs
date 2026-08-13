/* === _medir_respaldo_vivo.mjs · POR QUÉ dispara el respaldo en producción (owner 2026-08-14: «estás
 * autorizado», ~15 llamadas). Reproduce las TRES preguntas de las capturas contra Anthropic con la misma
 * configuración que prod (LLM_TIMEOUT_MS=90000, Haiku PLAN / Sonnet NARRAR) y mide, por intento:
 *   · cuánto TARDA cada llamada (¿el reloj sigue mordiendo?)
 *   · el veredicto del muro y SOBRE QUÉ (¿vetos de Sonnet?)
 *   · si el texto final es del modelo o del respaldo
 * TOPE DURO 15 llamadas. */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
process.env.LLM_PROVIDER = "anthropic";
process.env.LLM_TIMEOUT_MS = "90000";   // el valor que el owner declaró en Vercel
delete process.env.LLM_MODEL_PARSE;
delete process.env.LLM_MODEL_NARRATE;

import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { proyectarDatoNegocio } from "./src/adi/oracle/datoProyectado.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const CAP = 15;
let llamadas = 0;
const DATO = proyectarDatoNegocio("actual");
const _cap = (s) => { llamadas++; if (llamadas > CAP) throw new Error(`TOPE (${CAP}) en ${s}`); };
const _ms = () => Number(process.hrtime.bigint() / 1000000n);

const PREGUNTAS = [
  "¿Qué clientes venden mucho pero dejan poco margen?",
  "¿Cuánto capital tengo inmovilizado en inventario?",
  "Si subo ventas 4%, ¿qué cambia?",
];

const registro = [];
for (const q of PREGUNTAS) {
  const t = { q, tiempos: [], borradores: [], final: null, error: null };
  const callPlan = async (a) => {
    _cap("plan"); const t0 = _ms();
    const pr = await handlePlan({ text: a.text, history: a.history, mem: a.mem, scenario: a.scenario, attempt: a.attempt, vistaLinea: a.vistaLinea });
    t.tiempos.push({ pasada: "PLAN", ms: _ms() - t0, ok: !!pr.ok });
    if (!pr.ok) throw new Error(`handlePlan: ${pr.error || "sin plan"}`);
    t.plan = { intent: pr.plan.intent, mode: pr.plan.mode, tools: (pr.plan.calls || []).map((c) => c.tool) };
    return pr.plan;
  };
  const callNarrate = async (args) => {
    _cap("narrate"); const t0 = _ms();
    const payload = buildNarrateUserMessageC(args);
    let nr;
    try { nr = await handleNarrateC({ payload, mem: args.mem, attempt: args.attempt, datoNegocio: DATO }); }
    catch (e) { t.tiempos.push({ pasada: "NARRAR", ms: _ms() - t0, ok: false, err: String(e && e.message).slice(0, 80) }); throw e; }
    t.tiempos.push({ pasada: "NARRAR", ms: _ms() - t0, ok: !!nr.ok, err: nr.ok ? null : String(nr.error || "").slice(0, 80) });
    if (!nr.ok) throw new Error(`handleNarrateC: ${nr.error || "sin narración"}`);
    t.borradores.push(nr.narration);
    return nr.narration;
  };
  try {
    const out = await answerViaOracle({ text: q, history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    t.final = { text: out && out.r.text, deterministic: !!(out && out.r.deterministic), repaired: !!(out && out.r.narrationRepaired), retryTrace: (out && out.r.retryTrace) || null };
  } catch (e) { t.error = String(e && e.message).slice(0, 200); }
  registro.push(t);

  console.log(`\n═══ «${q}»`);
  console.log(`tiempos: ${t.tiempos.map((x) => `${x.pasada} ${(x.ms / 1000).toFixed(1)}s${x.ok ? "" : " ✗" + (x.err || "")}`).join(" · ")}`);
  const nt = t.final && t.final.retryTrace && t.final.retryTrace.narrate;
  if (nt) for (const x of nt) console.log(`  guard[${x.attempt}]: ok=${x.guardOk} · ${x.reason || "fiel"}${x.detalle ? " · " + x.detalle.join(" | ") : ""}${x.reparado ? " · REPARADO" : ""}`);
  console.log(`RESPALDO=${t.final ? (t.final.deterministic || t.final.repaired) : "?"} · borradores del modelo=${t.borradores.length}${t.error ? " · ERROR: " + t.error : ""}`);
  console.log(`ADI ▸ ${String((t.final && t.final.text) || "(sin texto)").slice(0, 700)}`);
}

fs.writeFileSync("_medir_respaldo_vivo.json", JSON.stringify({ fecha: "2026-08-14", llamadas, registro }, null, 2), "utf8");
console.log(`\n─── llamadas: ${llamadas}/${CAP} · transcript en _medir_respaldo_vivo.json`);
