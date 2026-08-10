/* === _evidence_spec_shape_gate.mjs · evidenceSpec · GATE DE SHAPE (owner 2026-07-31) ===
 * Construye un evidenceSpec REAL (contra el dataset demo real, sin mocks) para 3 casos distintos — dato puntual,
 * diagnóstico, simulación — y confirma que el shape acordado aparece con los campos esperados. También cubre:
 *   · figFor(figs, entidad, metrica) (boleta.js) — la lectura sancionada de una cifra ya citada.
 *   · el wire-through de `unsupported` (runPlan → answerViaOracle-equivalente → evidenceSpec.missing).
 *   · grade="abierto" en modo clarify · action{...} en modo decision · reference respeta un override activo.
 * PURO · sin LLM · sin red. Determinístico: mismos calls+scenario → mismo evidenceSpec (turnId incluido).
 */
import fs from "fs";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
import { buildOracleEvidence } from "./src/adi/oracle/sentrixEvidence.js";
import { figFor } from "./src/adi/boleta.js";
import { setBenchmarkOverride } from "./src/config/businessPolicy.js";

const SC = "actual";
let pass = 0; const fails = [];
const ok = (cond, label, extra) => { if (cond) pass++; else fails.push({ label, extra }); console.log(`  ${cond ? "✓" : "✗"} ${label}`); };

function runTurn(plan, scenario = SC) {
  const { ledger, results, trace, unsupported } = runPlan({ intent: plan.intent, calls: plan.calls }, { scenario });
  const figs = ledgerBoleta(ledger);
  const evidence = buildOracleEvidence({ plan, results, figs, scenario, unsupported });
  return { evidence, figs, results, unsupported, trace };
}

console.log("\n═══ evidenceSpec · GATE DE SHAPE ═══\n");

// ── CASO 1 · DATO PUNTUAL (entityRecord · Falabella · margen) ──────────────────────────────────────────────────
console.log("── 1 · dato puntual (entityRecord, Falabella) ──");
{
  const plan = {
    intent: "answer", mode: "default", rationale: "el margen puntual de Falabella",
    scope: { level: "entity", entities: ["Falabella"] },
    calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }],
  };
  const { evidence, figs } = runTurn(plan);
  const es = evidence.evidenceSpec;
  ok(!!es, "evidenceSpec presente");
  ok(es && es.version === 1, "version === 1");
  ok(es && typeof es.turnId === "string" && es.turnId.startsWith("t_"), "turnId es string t_<hash>");
  ok(es && es.claim && es.claim.text === "el margen puntual de Falabella", "claim.text === plan.rationale", es && es.claim);
  ok(es && es.claim && es.claim.type === "default", "claim.type === plan.mode");
  ok(es && es.periodHuman === "año cerrado — los 12 meses ya ocurrieron", "periodHuman = string estampado por toolRunner", es && es.periodHuman);
  ok(es && es.scope && es.scope.entityType === "cliente" && es.scope.dimension === "cliente", "scope.entityType/dimension === 'cliente'", es && es.scope);
  ok(es && es.scope && es.scope.entityLabel === "Falabella", "scope.entityLabel === 'Falabella'");
  ok(es && es.metrics === figs, "metrics ES la misma referencia que figs (no una copia)");
  ok(es && Array.isArray(es.traceability) && es.traceability.length === figs.length && es.traceability.every((o) => o && o.tool === "entityRecord"), "traceability = figs.map(f=>f.origin), con tool correcto");
  ok(es && Array.isArray(es.missing) && es.missing.length === 0, "missing === [] (entityRecord soportado)");
  ok(es && es.reference && es.reference.value === 30.1, "reference.value === 30.1 (benchmarkOf sin override)", es && es.reference);
  ok(es && es.reference && es.reference.source === "benchmark_fila", "reference.source === 'benchmark_fila'");
  ok(es && es.reference && es.reference.rememberedFrom === null, "reference.rememberedFrom === null (sin override)");
  ok(es && es.sources && es.sources.availability && Array.isArray(es.sources.availability.metrics) && es.sources.availability.metrics.length > 0, "sources.availability trae metrics reales (capability.js traducido a 'client')", es && es.sources);
  ok(es && Array.isArray(es.formula) && es.formula.length === 4 && es.formula[0].label === "Ventas netas", "formula = lines[] de buildMarginReceipt (cliente)", es && es.formula);
  ok(es && es.grade === "probado", "grade === 'probado' (fig source:'actual' de la entidad central)", es && es.grade);
  ok(es && es.action === null, "action === null (mode !== 'decision')");
  ok(es && es.assumptions === null, "assumptions === null (no es simulación)");

  const fFalabellaMargen = figFor(figs, "Falabella", "Margen");
  ok(!!fFalabellaMargen && fFalabellaMargen.value === "22%", "figFor(figs,'Falabella','Margen') → fig con value '22%'", fFalabellaMargen);
  ok(figFor(figs, "Falabella", "Métrica inexistente XYZ") === null, "figFor con métrica inexistente → null");
  ok(figFor(figs, "Entidad inexistente XYZ", "Margen") === null, "figFor con entidad inexistente → null");
}

// ── CASO 2 · DIAGNÓSTICO (diagnose · global) ────────────────────────────────────────────────────────────────────
console.log("\n── 2 · diagnóstico (diagnose, global) ──");
{
  const plan = {
    intent: "answer", mode: "diagnostico", rationale: "panorama general del negocio",
    scope: { level: "global" },
    calls: [{ tool: "diagnose", args: {} }],
  };
  const { evidence, figs } = runTurn(plan);
  const es = evidence.evidenceSpec;
  ok(!!es, "evidenceSpec presente");
  ok(es && es.claim && es.claim.type === "diagnostico", "claim.type === 'diagnostico'");
  ok(es && es.scope && es.scope.entityType === "cartera" && es.scope.entityLabel === null && es.scope.dimension === null, "scope global → {entityType:'cartera', entityLabel:null, dimension:null}", es && es.scope);
  ok(es && Array.isArray(es.factors) && es.factors.length > 0 && es.factors[0].detector, "factors = evidence.findings (diagnose)", es && es.factors && es.factors[0]);
  ok(es && es.formula === null, "formula === null (scope global, sin entidad puntual)");
  ok(es && es.reference && typeof es.reference.value === "number", "reference.value numérico también en scope global (benchmarkOf(null))", es && es.reference);
  ok(es && es.sources && es.sources.availability && typeof es.sources.availability.crosses === "object", "sources.availability = datasetCapability() en scope global", es && es.sources);
  ok(es && (es.grade === "probado" || es.grade === "indicado"), "grade calculado (no null) con figs presentes", es && es.grade);
  ok(figs.length > 0, "diagnose trajo figs reales");
}

// ── CASO 2b · DECISIÓN (mismo diagnose, mode='decision') → action{} desde mesa.js ─────────────────────────────
console.log("\n── 2b · decisión (mode='decision') → action desde mesa.js ──");
{
  const plan = {
    intent: "answer", mode: "decision", rationale: "qué priorizar primero",
    scope: { level: "global" },
    calls: [{ tool: "diagnose", args: {} }],
  };
  const { evidence } = runTurn(plan);
  const es = evidence.evidenceSpec;
  ok(es && es.action && typeof es.action.text === "string" && es.action.text.length > 0, "action.text presente (mode='decision')", es && es.action);
  ok(es && es.action && typeof es.action.impact === "string", "action.impact presente ($ formateado)", es && es.action);
  ok(es && es.action && ("askLabel" in es.action), "action.askLabel presente (puede ser string o null)", es && es.action);
}

// ── CASO 3 · SIMULACIÓN (simulateGeneral · precio+volumen sobre Falabella) ──────────────────────────────────────
console.log("\n── 3 · simulación (simulateGeneral, Falabella) ──");
{
  const plan = {
    intent: "answer", mode: "simulacion", rationale: "si subo 5% el precio y bajo 3% el volumen de Falabella",
    scope: { level: "entity", entities: ["Falabella"] },
    calls: [{ tool: "simulateGeneral", args: { dimension: "cliente", entity: "Falabella", variableA: { campo: "precioLista", delta_pct: 5 }, variableB: { campo: "unidades", delta_pct: -3 } } }],
  };
  const { evidence, figs, results } = runTurn(plan);
  const es = evidence.evidenceSpec;
  ok(!!es, "evidenceSpec presente");
  ok(es && es.claim && es.claim.type === "simulacion", "claim.type === 'simulacion'");
  ok(es && es.grade === "indicado", "grade === 'indicado' (mode simulacion, supuesto no hecho consumado)", es && es.grade);
  ok(Array.isArray(results) && results[0] && Array.isArray(results[0].facts.assumptions) && results[0].facts.assumptions.length === 2, "facts.assumptions estructurado presente en el result de la call (toolRegistry.js)", results[0] && results[0].facts.assumptions);
  ok(es && Array.isArray(es.assumptions) && es.assumptions.length === 2, "evidenceSpec.assumptions[] con 2 entradas", es && es.assumptions);
  const precioA = es && es.assumptions && es.assumptions.find((a) => a.delta === 5);
  ok(!!precioA && precioA.unit === "pct", "assumption de precio: delta=5, unit='pct'", precioA);
  const volA = es && es.assumptions && es.assumptions.find((a) => a.delta === -3);
  ok(!!volA && volA.unit === "pct", "assumption de volumen: delta=-3, unit='pct'", volA);
  // guardrail: la clave interna NO debe filtrarse como un fig fantasma "% suelto" sin entidad (landmine de
  // enrichFromFacts/_KEYUNIT — ver el comentario en toolRegistry.js). Ningún fig debe tener label === "Falabella" a secas.
  ok(!figs.some((f) => f.label === "Falabella"), "sin fig fantasma 'Falabella' (delta_pct no filtró vía enrichFromFacts)");
  ok(es && Array.isArray(es.formula) && es.formula.length === 4, "formula también resuelve en modo simulación (mismo scope cliente)", es && es.formula);
}

// ── CASO 4 · GRADE='abierto' (mode='clarify') ───────────────────────────────────────────────────────────────────
console.log("\n── 4 · grade='abierto' (mode='clarify') ──");
{
  const plan = {
    intent: "answer", mode: "clarify", rationale: "el usuario no entendió la carga comercial",
    scope: { level: "entity", entities: ["Falabella"] },
    calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }],
  };
  const { evidence } = runTurn(plan);
  const es = evidence.evidenceSpec;
  ok(es && es.grade === "abierto", "grade === 'abierto' en mode=clarify pese a tener figs", es && es.grade);
}

// ── CASO 5 · unsupported → missing[] + grade='abierto' (tool declina) ──────────────────────────────────────────
console.log("\n── 5 · tool declina → missing[] no vacío + grade='abierto' ──");
{
  const plan = {
    intent: "answer", mode: "default", rationale: "margen de una entidad que no existe",
    scope: { level: "entity", entities: ["Entidad Que No Existe SRL"] },
    calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Entidad Que No Existe SRL" } }],
  };
  const { evidence, unsupported } = runTurn(plan);
  const es = evidence.evidenceSpec;
  ok(unsupported.length > 0, "runPlan reporta unsupported (tool declina, entidad no existe)");
  ok(es && Array.isArray(es.missing) && es.missing.length === unsupported.length, "evidenceSpec.missing === unsupported (wire-through completo)", { missing: es && es.missing, unsupported });
  ok(es && es.grade === "abierto", "grade === 'abierto' cuando hay unsupported", es && es.grade);
}

// ── CASO 6 · REFERENCE respeta un override de criterio activo (C.2 · defecto de integridad #1) ─────────────────
console.log("\n── 6 · reference respeta _benchmarkOverride activo (memoria de criterio) ──");
{
  setBenchmarkOverride(28);
  try {
    const plan = {
      intent: "answer", mode: "default", rationale: "margen de Falabella con criterio propio",
      scope: { level: "entity", entities: ["Falabella"] },
      calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }],
    };
    const { evidence } = runTurn(plan);
    const es = evidence.evidenceSpec;
    ok(es && es.reference && es.reference.value === 28, "reference.value === 28 (override activo, NO el benchmark de fila 30.1)", es && es.reference);
    ok(es && es.reference && es.reference.source === "criterio_usuario", "reference.source === 'criterio_usuario'");
    ok(es && es.reference && typeof es.reference.rememberedFrom === "string" && es.reference.rememberedFrom.length > 0, "reference.rememberedFrom explica el origen (override activo)", es && es.reference);
  } finally {
    setBenchmarkOverride(null);   // limpieza — no debe arrastrar a otros gates del runner
  }
}

// ── CASO 7 · turnId es determinístico (mismo plan+figs+scenario → mismo turnId) ─────────────────────────────────
console.log("\n── 7 · turnId determinístico (byte-igual en 2 corridas) ──");
{
  const plan = {
    intent: "answer", mode: "default", rationale: "repetibilidad",
    scope: { level: "entity", entities: ["Falabella"] },
    calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }],
  };
  const a = runTurn(plan).evidence.evidenceSpec.turnId;
  const b = runTurn(plan).evidence.evidenceSpec.turnId;
  ok(a === b, `turnId repetible (${a} === ${b})`);
}

const summary = { total: pass + fails.length, pass, fails };
fs.writeFileSync("_evidence_spec_shape_gate.json", JSON.stringify(summary, null, 2));
console.log(`\n${pass}/${pass + fails.length} casos correctos${fails.length ? " · FALLAS: " + JSON.stringify(fails, null, 1) : " ✓"}`);
console.log("→ _evidence_spec_shape_gate.json");
process.exit(fails.length ? 1 : 0);
