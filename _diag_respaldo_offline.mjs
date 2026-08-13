/* === _diag_respaldo_offline.mjs · Qué produce EL RESPALDO para «¿Qué clientes venden mucho pero dejan poco
 * margen?» (queja del owner 2026-08-14: «antes aparecía la venta, era mucho más completo» + «qué es eso de
 * en este turno»). CERO red. Fuerza el fallback devolviendo un borrador que el muro veta con certeza, y
 * compara las tres formas del compositor contra la vieja composeFromLedger. */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { componerPorForma, composeFromLedger } from "./src/adi/oracle/narrationBlocks.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const Q = "¿Qué clientes venden mucho pero dejan poco margen?";
const PLAN = { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: {} }] };

let figs = null;
const out = await answerViaOracle({
  text: Q, history: [], mem: {}, scenario: "actual",
  callPlan: async () => PLAN,
  // borrador con una cifra inventada → veto seguro (cifra-no-autorizada) → cae la escalera
  callNarrate: async (args) => { figs = args.ledgerFigs || []; return "Falabella vendió $77.7M con un margen de 99.9% y eso explica todo."; },
});

console.log("── BOLETA DEL TURNO (lo que el respaldo tiene disponible) ──");
for (const f of figs) console.log(`  ${f.label} = ${f.value}`);

const nt = out && out.r.retryTrace && out.r.retryTrace.narrate;
console.log("\n── QUÉ PASÓ ──");
if (nt) for (const t of nt) console.log(`guard[${t.attempt}]: ok=${t.guardOk} · ${t.reason || "fiel"}${t.detalle ? " · " + t.detalle.join(" | ") : ""}`);
console.log(`det=${!!out.r.deterministic} · rep=${!!out.r.narrationRepaired}`);

console.log("\n── LO QUE VE EL OWNER HOY (texto final) ──");
console.log(out.r.text);

console.log("\n── COMPARACIÓN DE COMPOSITORES, misma boleta ──");
for (const forma of ["auto", "tabla"]) {
  console.log(`\n### componerPorForma forma=${forma}`);
  try { console.log(componerPorForma({ figs, contentScope: null, forma }) || "(null)"); } catch (e) { console.log("ERROR: " + e.message); }
}
console.log("\n### composeFromLedger (el compositor VIEJO que el inventario dio por muerto)");
try { console.log(composeFromLedger(figs, null) || "(null)"); } catch (e) { console.log("ERROR: " + e.message); }
