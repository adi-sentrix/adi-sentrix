/* === _espejo_hilo_captura.mjs · Reproducción del hilo de la captura del owner (2026-08-14, "autorizado":
 * ~8-12 llamadas Anthropic). Dos turnos exactos; captura el borrador CRUDO del narrador en cada intento y el
 * retryTrace (veredicto del guard + detalle) para adjudicar el veto que degradó el turno 2 en producción.
 * TOPE DURO 12 llamadas. Igual cableado que _ask_vivo.mjs, con LLM_PROVIDER=anthropic y defaults conscientes
 * (se borra LLM_MODEL_PARSE del entorno para que resuelva claude-haiku-4-5 / claude-sonnet-5). */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
process.env.LLM_PROVIDER = "anthropic";
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

const TURNOS = [
  "¿Qué clientes venden mucho pero dejan poco margen?",
  "si desglosalo, y ademas dime que clientes son los que estan bajo benchmark?",
];

const registro = [];
let history = [];
let mem = {};

for (const q of TURNOS) {
  const turno = { q, plan: null, borradoresCrudos: [], final: null };
  const callPlan = async ({ text, history, mem, scenario, vistaLinea, attempt }) => {
    _cap("plan");
    const pr = await handlePlan({ text, history, mem, scenario, attempt, vistaLinea });
    if (!pr.ok) throw new Error(`handlePlan: ${pr.error || "sin plan"}`);
    turno.plan = { intent: pr.plan.intent, mode: pr.plan.mode, tools: (pr.plan.calls || []).map((c) => ({ tool: c.tool, args: c.args })) };
    return pr.plan;
  };
  const callNarrate = async (args) => {
    _cap("narrate");
    const { text, plan, results, ledgerFigs, mem, history, requestContext, pref, instruccionOrientacion, instruccionDisclosure, tablePolicy, viewContext, formaRespuesta, attempt } = args;
    const payload = buildNarrateUserMessageC({ text, plan, results, ledgerFigs, mem, history, pref, instruccionOrientacion, instruccionDisclosure, tablePolicy, viewContext, formaRespuesta, requestContext });
    const nr = await handleNarrateC({ payload, mem, attempt, datoNegocio: DATO });
    if (!nr.ok) throw new Error(`handleNarrateC: ${nr.error || "sin narración"}`);
    turno.borradoresCrudos.push({ attempt, texto: nr.narration });
    return nr.narration;
  };
  const out = await answerViaOracle({ text: q, history, mem, scenario: "actual", callPlan, callNarrate });
  turno.final = {
    text: out && out.r.text,
    deterministic: !!(out && out.r.deterministic),
    narrationRepaired: !!(out && out.r.narrationRepaired),
    retryTrace: (out && out.r.retryTrace) || null,
  };
  registro.push(turno);
  history = history.concat([{ role: "user", text: q }, { role: "adi", text: (out && out.r.text) || "" }]);
  mem = (out && out.mem) || mem;
  console.log(`\n══ TURNO: «${q}»`);
  console.log(`plan: intent=${turno.plan && turno.plan.intent} · mode=${turno.plan && turno.plan.mode} · tools=${JSON.stringify((turno.plan && turno.plan.tools || []).map((t) => t.tool))}`);
  console.log(`det=${turno.final.deterministic} · rep=${turno.final.narrationRepaired} · intentos narrador=${turno.borradoresCrudos.length}`);
  if (turno.final.retryTrace && turno.final.retryTrace.narrate) {
    for (const t of turno.final.retryTrace.narrate) console.log(`  guard[intento ${t.attempt}]: ok=${t.guardOk} · ${t.reason || "fiel"}${t.detalle ? " · " + t.detalle.join(" | ") : ""}${t.reparado ? " · REPARADO: " + t.reparado : ""}`);
  }
  console.log(`ADI ▸ ${turno.final.text}`);
}

fs.writeFileSync("_espejo_hilo_captura.json", JSON.stringify({ fecha: "2026-08-14", proveedor: "anthropic", llamadas, registro }, null, 2), "utf8");
console.log(`\nllamadas totales: ${llamadas} · transcript en _espejo_hilo_captura.json`);
