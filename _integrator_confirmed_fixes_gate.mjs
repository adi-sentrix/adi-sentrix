/* === _integrator_confirmed_fixes_gate.mjs · GATE DEL INTEGRADOR (owner 2026-07-31) ===
 * Reproduce, contra el dataset demo REAL (sin LLM, sin mocks), cada uno de los 5 hallazgos CONFIRMADOS por la
 * auditoría adversarial (mirada CFO) + el Hallazgo 1 del revisor UX (mismo bug, reportado dos veces) + el gap de
 * UI del revisor UX (SimulationPanel oráculo inalcanzable) — y confirma que NINGUNO se reproduce después del fix
 * de este turno de integración. PURO · determinístico · mismos calls+scenario → mismo resultado siempre.
 */
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
import { buildOracleEvidence } from "./src/adi/oracle/sentrixEvidence.js";
import { setBenchmarkOverride } from "./src/config/businessPolicy.js";

const SC = "actual";
let pass = 0; const fails = [];
const ok = (cond, label, extra) => { if (cond) pass++; else fails.push({ label, extra }); console.log(`  ${cond ? "✓" : "✗"} ${label}${cond ? "" : "  ← " + JSON.stringify(extra)}`); };

function runTurn(plan, scenario = SC) {
  const { ledger, results, unsupported } = runPlan({ intent: plan.intent, calls: plan.calls }, { scenario });
  const figs = ledgerBoleta(ledger);
  const evidence = buildOracleEvidence({ plan, results, figs, scenario, unsupported });
  return { evidence, figs, results, unsupported };
}

console.log("\n═══ INTEGRADOR · verificación de los 5 hallazgos CONFIRMADOS por la auditoría adversarial ═══\n");

// ── Hallazgo 1 · entityProfile() ignoraba _benchmarkOverride (POLICY.benchmark crudo) ───────────────────────────
console.log("── Hallazgo 1 · entityProfile() ahora respeta _benchmarkOverride (C.2) ──");
{
  setBenchmarkOverride(25);
  const plan = { intent: "answer", mode: "default", rationale: "margen de Lider vs benchmark",
    scope: { level: "entity", entities: ["Lider"] },
    calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Lider" } }] };
  const { results } = runTurn(plan);
  const facts = results[0] && results[0].facts;
  ok(!!facts, "entityProfile devolvió facts (Lider existe en el dato demo)");
  ok(facts && facts.benchmarkMargen === "25%", "facts.benchmarkMargen === '25%' (override, NO 30.1% de POLICY)", facts && facts.benchmarkMargen);
  const bfig = (results[0].boleta || []).find((f) => /Benchmark de margen/.test(f.label));
  ok(!!bfig && bfig.value === "25%", "fig 'Benchmark de margen' en la boleta también dice 25% (lo que puede citar ADI)", bfig);
  setBenchmarkOverride(null);
}
{
  // segunda entidad (Ripley) con override que INVIERTE el sentido del gap (auditor: 25%→22.5%, +2.5pp arriba, no abajo)
  setBenchmarkOverride(22.5);
  const plan = { intent: "answer", mode: "default", rationale: "margen de Ripley vs benchmark",
    scope: { level: "entity", entities: ["Ripley"] },
    calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Ripley" } }] };
  const { results } = runTurn(plan);
  const facts = results[0] && results[0].facts;
  ok(facts && facts.benchmarkMargen === "22.5%", "Ripley: facts.benchmarkMargen === '22.5%' (override)", facts && facts.benchmarkMargen);
  ok(facts && facts.brechaMargen === undefined, "Ripley: SIN brechaMargen (su margen real está ARRIBA de 22.5%, no hay brecha que fabricar)", facts && facts.brechaMargen);
  setBenchmarkOverride(null);
}

// ── Hallazgo 2 · DecisionPanel/evidenceSpec.action mezclaba el foco de OTRA entidad ──────────────────────────────
console.log("\n── Hallazgo 2 · evidenceSpec.action ya NO mezcla el foco de otra entidad (Ripley vs Falabella) ──");
{
  const plan = { intent: "answer", mode: "decision", rationale: "qué acción priorizada para Ripley",
    scope: { level: "entity", entities: ["Ripley"] },
    calls: [{ tool: "diagnose", args: { filters: { cliente: "Ripley" } } }] };
  const { evidence } = runTurn(plan);
  const es = evidence.evidenceSpec;
  ok(!!es, "evidenceSpec presente");
  ok(es && Array.isArray(es.factors) && es.factors.length > 0, "factors presente (findings de Ripley)");
  const factorsMentionFalabella = es && JSON.stringify(es.factors).includes("Falabella");
  ok(!factorsMentionFalabella, "factors NO mencionan Falabella (scope es Ripley)", es && es.factors);
  if (es && es.action) {
    const actionMentionsFalabella = JSON.stringify(es.action).includes("Falabella");
    ok(!actionMentionsFalabella, "action NO menciona Falabella — antes del fix citaba 'Recuperar el margen que cede Falabella'", es.action);
    const actionMentionsRipley = JSON.stringify(es.action).includes("Ripley");
    ok(actionMentionsRipley, "action, si existe, nombra a Ripley (la entidad del turno) — nunca otra ajena", es.action);
  } else {
    ok(true, "action === null (sin foco propio de Ripley en este escenario) — honesto, NUNCA la acción de otra entidad");
  }
}
// scope GLOBAL (sin entidad puntual) → sigue usando el foco top del portafolio, comportamiento correcto sin cambios
{
  const plan = { intent: "answer", mode: "decision", rationale: "acción prioritaria del negocio",
    scope: { level: "global" },
    calls: [{ tool: "diagnose", args: {} }] };
  const { evidence } = runTurn(plan);
  const es = evidence.evidenceSpec;
  ok(es && es.action && typeof es.action.text === "string", "scope global: action SÍ sale del foco top del portafolio (comportamiento correcto, sin cambios)", es && es.action);
}

// ── Hallazgo 3 · grade sobre-confiaba 'probado' en comparación con entidad inexistente ──────────────────────────
console.log("\n── Hallazgo 3 · grade ya NO certifica 'probado' cuando falta una entidad de la comparación ──");
{
  const plan = { intent: "answer", mode: "default", rationale: "compara Falabella vs una entidad inexistente",
    scope: { level: "entity", entities: ["Falabella", "Comercial Fantasma SPA"] },
    calls: [{ tool: "compareEntities", args: { dimension: "cliente", entities: ["Falabella", "Comercial Fantasma SPA"] } }] };
  const { evidence, figs, unsupported } = runTurn(plan);
  const es = evidence.evidenceSpec;
  const hasFalabellaActual = figs.some((f) => f.source === "actual" && f.label.includes("Falabella"));
  const hasFantasmaActual = figs.some((f) => f.source === "actual" && f.label.includes("Comercial Fantasma SPA"));
  ok(hasFalabellaActual, "figs SÍ traen a Falabella (existe)");
  ok(!hasFantasmaActual, "figs NO traen a 'Comercial Fantasma SPA' (no existe) — reproduce la premisa del hallazgo", figs.map(f=>f.label));
  ok(es && es.grade !== "probado", `grade NO es 'probado' pese a que falta media comparación (obtuvo: ${es && es.grade})`, es && es.grade);
  ok(es && es.grade === "indicado", "grade === 'indicado' (downgrade honesto — figs SÍ existen para Falabella, pero no para las 2 entidades del scope)", es && es.grade);
}
// caso de control: comparación donde AMBAS entidades existen → sigue dando 'probado' (no rompí el caso sano)
{
  const plan = { intent: "answer", mode: "default", rationale: "compara Falabella vs Ripley",
    scope: { level: "entity", entities: ["Falabella", "Ripley"] },
    calls: [{ tool: "compareEntities", args: { dimension: "cliente", entities: ["Falabella", "Ripley"] } }] };
  const { evidence } = runTurn(plan);
  ok(evidence.evidenceSpec && evidence.evidenceSpec.grade === "probado", "control: Falabella vs Ripley (ambas existen) → grade SIGUE siendo 'probado'", evidence.evidenceSpec && evidence.evidenceSpec.grade);
}
// caso de control: scope global (0 entidades nombradas) → sigue funcionando como antes (cualquier fig actual alcanza)
{
  const plan = { intent: "answer", mode: "default", rationale: "resumen del negocio", scope: { level: "global" },
    calls: [{ tool: "executiveSummary", args: {} }] };
  const { evidence } = runTurn(plan);
  ok(evidence.evidenceSpec && evidence.evidenceSpec.grade === "probado", "control: scope global sigue graduando 'probado' con figs reales (sin cambios)", evidence.evidenceSpec && evidence.evidenceSpec.grade);
}

// ── Hallazgo 4 · figFor() devolvía la fig 'Margen' STALE de SKU (skuInventario.margenPct) ────────────────────────
console.log("\n── Hallazgo 4 · figFor() ya no diverge de kpis.js/ADI para SKU (dedup por label) ──");
{
  const { figFor } = await import("./src/adi/boleta.js");
  const plan = { intent: "answer", mode: "default", rationale: "todos los datos de LG-AIR9000",
    scope: { level: "entity", entities: ["LG-AIR9000"] },
    calls: [{ tool: "entityRecord", args: { dimension: "sku", entity: "LG-AIR9000" } }] };
  const { figs } = runTurn(plan);
  const margenFigs = figs.filter((f) => /· Margen$/.test(f.label));
  ok(margenFigs.length === 1, `exactamente 1 fig 'Margen' en boleta para LG-AIR9000 (antes: 2 conflictivas) — obtuvo ${margenFigs.length}`, margenFigs);
  const found = figFor(figs, "LG-AIR9000", "Margen");
  ok(!!found && found.value === "28%", `figFor(figs,'LG-AIR9000','Margen') === '28%' (coincide con kpis.js/_skuKPIs y con lo que ADI narra — antes devolvía '22%')`, found);
}

// ── Hallazgo 5 · scope.dimension usaba el arg PRE-corrección del plan, no el eje REAL post-autocorrección ────────
console.log("\n── Hallazgo 5 · scope.dimension usa el eje REAL post-autocorrección (Mercado Libre: marca→cliente) ──");
{
  const plan = { intent: "answer", mode: "default", rationale: "margen de Mercado Libre",
    scope: { level: "entity", entities: ["Mercado Libre"] },
    calls: [{ tool: "entityProfile", args: { dimension: "marca", entity: "Mercado Libre" } }] };
  const { evidence, results } = runTurn(plan);
  const facts = results[0] && results[0].facts;
  ok(facts && facts.entityType === "cliente", "el motor SÍ se autocorrigió a 'cliente' (Mercado Libre no es una marca en el dato)", facts && facts.entityType);
  const es = evidence.evidenceSpec;
  ok(es && es.scope && es.scope.dimension === "cliente", `evidenceSpec.scope.dimension === 'cliente' (el eje REAL, no 'marca' el argumento viejo) — obtuvo '${es && es.scope && es.scope.dimension}'`, es && es.scope);
  ok(es && es.reference && typeof es.reference.value === "number", "reference YA NO es null — antes rawRecordFor('marca','Mercado Libre') fallaba y daba un falso 'sin referencia'", es && es.reference);
}

// ── Hallazgo 6 (encontrado por el integrador en conversación LLM real en vivo) · grade='probado' para una
// simulación cuando el LLM real elige mode='default' en vez de 'simulacion' (aunque llame simulateGeneral) ────────
console.log("\n── Hallazgo 6 (integrador, conversación en vivo) · grade ya NO certifica 'probado' para un supuesto con mode!='simulacion' ──");
{
  // reproduce EXACTO el plan real devuelto por el LLM en vivo (capturado de /api/adi-plan, ver reporte final)
  const plan = { intent: "simulacion", mode: "default", rationale: "impacto en ventas de un aumento de precio y una disminución de volumen",
    scope: { level: "entity", entities: ["Lider"] },
    calls: [{ tool: "simulateGeneral", args: { dimension: "cliente", entity: "Lider", variableA: { campo: "precioLista", delta_pct: 8 }, variableB: { campo: "unidades", delta_pct: -2 } } }] };
  const { evidence } = runTurn(plan);
  const es = evidence.evidenceSpec;
  ok(es && es.grade === "indicado", `grade === 'indicado' pese a mode='default' (obtuvo: ${es && es.grade}) — un supuesto NUNCA es 'probado'`, es && es.grade);
}

console.log(`\n── _integrator_confirmed_fixes_gate: ${pass} PASS · ${fails.length} FAIL (de ${pass + fails.length}) ──`);
if (fails.length) { console.log(JSON.stringify(fails, null, 2)); process.exit(1); }
