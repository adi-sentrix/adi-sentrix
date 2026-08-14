/* === _probe_cadena_alcance.mjs · DÓNDE SE CORTA LA CADENA en «esos clientes + reduce 2 puntos + benchmark»
 * (owner 2026-08-14: «necesito el recorrido real y el punto exacto donde se corta»). CERO red, CERO .env.
 * Traza los 5 eslabones que el owner enumeró, uno por uno, con el motor real. */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { detectScenarioIntent, extractScenarioVariable } from "./src/adi/oracle/scenarioIntent.js";
import { resolveConversationReference } from "./src/adi/oracle/conversationScope.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const Q1 = "¿Qué clientes venden mucho pero dejan poco margen?";
const Q2 = "reduce en 2 puntos las acciones comerciales de esos clientes y dime si quedan sobre el benchmark";

// ── ESLABÓN 1 · ¿el turno anterior guarda un alcance operativo? ────────────────────────────────────────────
const PLAN1 = { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: {} }] };
const out1 = await answerViaOracle({
  text: Q1, history: [], mem: {}, scenario: "actual",
  callPlan: async () => PLAN1,
  callNarrate: async () => "Falabella vende $19.4M con margen 22.0%, Lider $17.9M con 21.5%, Jumbo $17.3M con 24.0% y Sodimac $8.2M con 23.5% — los cuatro bajo tu benchmark de 30.1%.",
});
const cs = out1.mem && out1.mem.conversationScope && out1.mem.conversationScope.current;
console.log("① ¿SE GUARDA UN ALCANCE OPERATIVO TRAS EL TURNO 1?");
console.log(`   ${cs ? "✅ SÍ" : "❌ NO"} · entidades = ${cs ? JSON.stringify(cs.entities) : "—"}`);
console.log(`   dimensión = ${cs ? cs.dimension : "—"} · tool de origen = ${cs ? cs.tool : "—"} · período = ${cs ? (cs.periodo || "—") : "—"}`);

// ── ESLABÓN 2 · ¿«esos clientes» resuelve a ese alcance? ───────────────────────────────────────────────────
const ref = resolveConversationReference(Q2, out1.mem.conversationScope);
console.log("\n② ¿«esos clientes» RESUELVE AL ALCANCE GUARDADO?");
console.log(`   ${ref && ref.kind === "resolved" ? "✅ SÍ" : (ref ? `⚠️ kind=${ref.kind}` : "❌ null")} · ${JSON.stringify(ref && (ref.entities || ref.reason) || null)}`);

// ── ESLABÓN 3 · ¿«reduce 2 puntos las acciones comerciales» es una operación ejecutable? ───────────────────
console.log("\n③ ¿«reduce 2 puntos las acciones comerciales» SE CONVIERTE EN OPERACIÓN?");
const si = detectScenarioIntent(Q2, out1.mem.conversationScope && out1.mem.conversationScope.current);
console.log(`   detectScenarioIntent → ${JSON.stringify(si)}`);
console.log(`   extractScenarioVariable → ${JSON.stringify(extractScenarioVariable(Q2))}`);
for (const v of ["reduce 2 puntos las acciones comerciales", "baja la carga comercial 2 puntos", "sube el precio 2%", "sube el volumen 2%"]) {
  console.log(`   · «${v}» → ${JSON.stringify(extractScenarioVariable(v))}`);
}

// ── ESLABÓN 4 · ¿el motor de cálculo puede recibir esa simulación armada? ─────────────────────────────────
console.log("\n④ ¿EL MOTOR PUEDE RECIBIR «carga −2pp sobre un conjunto»?");
const { TOOL_CONTRACTS } = await import("./src/adi/oracle/toolContracts.js");
const c = TOOL_CONTRACTS && (TOOL_CONTRACTS.simulateCarga || (TOOL_CONTRACTS.find && TOOL_CONTRACTS.find((x) => x.name === "simulateCarga")));
console.log(`   contrato de simulateCarga: ${c ? JSON.stringify({ args: Object.keys(c.args || c.parametros || {}), obligatorios: c.inputsObligatorios }) : "(no legible por nombre — ver toolContracts.js)"}`);
const { OPERACIONES_CALCULO } = await import("./src/adi/oracle/calculoCatalogo.js");
console.log(`   operaciones del catálogo de cálculo: ${JSON.stringify(Object.keys(OPERACIONES_CALCULO || {}))}`);

// ── ESLABÓN 5 · ¿el notario verifica que se usaron ESOS clientes? ─────────────────────────────────────────
const _ejes = (a) => { const o = []; for (const e of a) for (const n of axisEntityNames(e)) o.push(n); return o; };
const CTX = { ledger: { figs: [] }, results: [], trace: null, question: Q2, datoProyectado: cifrasDelDato("actual"), entidadesDelTenant: _ejes(["cliente", "sku", "marca"]), duenosDelTenant: _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full", tablePolicy: "auto" };
const conOtros = guardC("Con esa baja, Paris queda en 28.5% y Tottus en 30.0% — Paris sigue bajo tu benchmark de 30.1%.", CTX);
console.log("\n⑤ ¿EL NOTARIO EXIGE QUE SEAN LOS CLIENTES DEL ALCANCE ANTERIOR?");
console.log(`   respuesta que cambia de clientes (Paris/Tottus en vez de los 4): ${conOtros.ok ? "🟠 PASA — el muro NO conoce el alcance heredado" : "🔴 muere → " + conOtros.verdict}`);
