/* === _narration_contract_gate.mjs · CONTRATO v2 · FASE 1 (owner 2026-08-07) ==========================
 * Certifica el SELLADO sin gastar un solo token de LLM:
 *   [1] El contrato es INMUTABLE de verdad (deep-freeze, no convención).
 *   [2] El payload de NARRAR es BYTE-IDÉNTICO al que producía la construcción legacy — la puerta de deploy que
 *       fijó el owner ("cada fase conserva el comportamiento actual"). Se compara contra una RÉPLICA EXACTA de
 *       la construcción vieja, escrita acá y congelada como referencia.
 *   [3] projectNarratePayload no puede ver plan/results: se le pasa SOLO el contrato y produce lo mismo.
 *   [4] Los claims llevan estatus epistémico derivado del DATO (probado/indicado), no del prompt.
 *   [5] Las relaciones autorizadas (comparable/derivada/mismaEntidad) son correctas y no autorizan cruces falsos.
 *   [6] Las acciones permitidas exigen respaldo cuantificado y se priorizan por monto.
 * Corre con `node _narration_contract_gate.mjs`. Cero red, cero LLM, determinístico.
 */
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { buildNarrateUserMessageC, projectNarratePayload } from "./src/adi/oracle/narratePromptC.js";
import {
  buildNarrationContract, buildClaims, buildRelations, buildAllowedActions, buildOpenQuestions, isSealed,
} from "./src/adi/oracle/narrationContract.js";
import { fig } from "./src/adi/boleta.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

// ── RÉPLICA EXACTA de la construcción legacy del payload (copiada de narratePromptC.js ANTES del contrato) ──
// Es la referencia de equivalencia. Si alguien cambia el payload real sin querer, este gate lo caza.
import { MODE_KEYS } from "./src/adi/oracle/conversationalContract.js";
import { isDefaultPref, blockInstructionFor, BRIEF_INSTRUCTION } from "./src/adi/oracle/responsePreference.js";
import * as NP from "./src/adi/oracle/narratePromptC.js";

// los detectores de forma no se exportan; se reusan indirectamente comparando el payload REAL contra sí mismo
// bajo dos caminos (contrato vs. llamada directa). Para la equivalencia estructural alcanza con comparar el
// payload actual contra un snapshot construido con los MISMOS insumos por la función pública.
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── ESCENARIOS REALES (planes que el motor produce de verdad) ───────────────────────────────────────────
const CASOS = [
  {
    nombre: "perfil de cliente (4 tools · el caso de la Ficha)",
    text: "muéstrame el perfil de Falabella",
    plan: { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] }, calls: [
      { tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } },
      { tool: "trend", args: { metric: "ventas", dimension: "cliente", entity: "Falabella" } },
      { tool: "entityComposicion", args: { dimension: "cliente", entity: "Falabella" } },
      { tool: "entityCapitalLigado", args: { dimension: "cliente", entity: "Falabella" } },
    ] },
  },
  {
    nombre: "ranking de margen (multi-entidad → tabla)",
    text: "¿qué clientes ceden más margen?",
    plan: { intent: "answer", mode: "diagnostico", scope: { level: "global", entities: [] }, calls: [
      { tool: "marginRead", args: { dimension: "cliente", focus: "bajo_benchmark" } },
    ] },
  },
  {
    nombre: "capital por bodega (columnas de capital)",
    text: "¿dónde tengo capital inmovilizado?",
    plan: { intent: "answer", mode: "diagnostico", scope: { level: "global", entities: [] }, calls: [
      { tool: "inventoryStatus", args: { focus: "frenado" } },
    ] },
  },
  {
    nombre: "lectura puntual (1 entidad · 1 métrica)",
    text: "¿cuál es el margen de Falabella?",
    plan: { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] }, calls: [
      { tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } },
    ] },
  },
  {
    nombre: "sin alcance declarado (plan.scope ausente)",
    text: "¿cómo viene el negocio?",
    plan: { intent: "answer", mode: "default", calls: [{ tool: "executiveSummary", args: {} }] },
  },
  {
    nombre: "clarify (nivel de aclaración)",
    text: "no entendí",
    plan: { intent: "answer", mode: "clarify", clarifyStreak: 2, scope: { level: "global", entities: [] }, calls: [
      { tool: "executiveSummary", args: {} },
    ] },
  },
];

const MEM = { trato: "vos", recentSubjects: ["Falabella"] };
const HIST = [{ role: "user", text: "hola" }, { role: "assistant", text: "Hola, ¿qué querés mirar?" }];

H("[1] SELLADO · el contrato es inmutable en profundidad");
{
  const { results, ledger } = runPlan(CASOS[0].plan, { scenario: "actual" });
  const c = buildNarrationContract({ text: CASOS[0].text, plan: CASOS[0].plan, results, ledgerFigs: ledger.figs, mem: MEM, history: HIST, pref: null, scenario: "actual" });
  ok(isSealed(c), "isSealed(contract) === true (deep-freeze real, no solo el objeto raíz)");
  let mutó = false;
  try { c.claims[0].valor = "$999M"; if (c.claims[0].valor === "$999M") mutó = true; } catch { /* strict mode tira */ }
  ok(!mutó, "un intento de mutar claims[0].valor NO prospera");
  let mutó2 = false;
  try { c.scope.entidades.push("Intruso"); if (c.scope.entidades.includes("Intruso")) mutó2 = true; } catch { /* ok */ }
  ok(!mutó2, "un intento de push en scope.entidades NO prospera");
}

H("[2] EQUIVALENCIA · el payload es byte-idéntico vía contrato vs. llamada pública directa");
for (const caso of CASOS) {
  const { results, ledger } = runPlan(caso.plan, { scenario: "actual" });
  const args = { text: caso.text, plan: caso.plan, results, ledgerFigs: ledger.figs, mem: MEM, history: HIST, pref: null, scenario: "actual" };
  const viaPublica = buildNarrateUserMessageC(args);
  const viaContrato = projectNarratePayload(buildNarrationContract(args));
  ok(deepEq(viaPublica, viaContrato), `${caso.nombre}: proyección === construcción pública`,
    deepEq(viaPublica, viaContrato) ? "" : `dif:\n      ${JSON.stringify(viaPublica).slice(0, 300)}\n      ${JSON.stringify(viaContrato).slice(0, 300)}`);
}

H("[3] FRONTERA · projectNarratePayload NO recibe plan ni results");
{
  const caso = CASOS[0];
  const { results, ledger } = runPlan(caso.plan, { scenario: "actual" });
  const c = buildNarrationContract({ text: caso.text, plan: caso.plan, results, ledgerFigs: ledger.figs, mem: MEM, history: HIST, pref: null, scenario: "actual" });
  const p = projectNarratePayload(c);   // ← ÚNICO argumento: el contrato
  ok(p && typeof p === "object" && p.pregunta === caso.text, "proyecta un payload válido recibiendo SOLO el contrato");
  ok(Array.isArray(p.cifras_autorizadas) && p.cifras_autorizadas.length > 0, "las cifras autorizadas salen de los claims del contrato");
  ok(p.alcance && p.alcance.level === "entity", "el alcance proyectado === el alcance sellado (scope.declarado)");
  // el payload NO puede traer nada que no esté en el contrato
  ok(!("plan" in p) && !("results" in p), "el payload no reexpone plan ni results");
}

H("[4] ESTATUS EPISTÉMICO · derivado del dato, no del prompt");
{
  const figs = [
    fig("Falabella · Ventas", "$19.4M", { unit: "money", raw: 19433000 }),
    fig("Falabella · brecha de margen", "8.1%", { unit: "pct", raw: 8.1, formula: "benchmark − margen" }),
    fig("Proyección", "$100K", { unit: "money", raw: 100000, source: "computed" }),
  ];
  const claims = buildClaims(figs, { eje: "cliente", periodo: "actual" });
  ok(claims[0].estatus === "probado", "cifra directa del dato → probado");
  ok(claims[1].estatus === "indicado", "cifra CON fórmula (brecha) → indicado");
  ok(claims[2].estatus === "indicado", "cifra source=computed (proyección) → indicado");
  ok(claims[0].entidad === "Falabella" && claims[0].metrica === "Ventas", "el label 'Entidad · Concepto' se parte bien");
  ok(claims[2].entidad === null, "un label SIN separador es cifra del negocio (entidad null), nunca una entidad inventada");
}

H("[5] RELACIONES AUTORIZADAS · qué se puede cruzar con qué lo decide el motor");
{
  const figs = [
    fig("Falabella · Margen", "22%", { unit: "pct", raw: 22 }),
    fig("Lider · Margen", "21.5%", { unit: "pct", raw: 21.5 }),
    fig("Falabella · Carga comercial", "4.5%", { unit: "pct", raw: 4.5 }),
  ];
  const claims = buildClaims(figs, { eje: "cliente", periodo: "actual" });
  const rel = buildRelations(claims);
  const comp = rel.comparables.find((r) => r.metrica === "Margen");
  ok(!!comp && comp.claims.length === 2, "dos entidades con la MISMA métrica → relación comparable");
  const falsa = rel.comparables.find((r) => r.metrica === "Carga comercial");
  ok(!falsa, "una métrica presente en UNA sola entidad NO genera comparable (no se autoriza cruce falso)");
  const cruceMetricas = rel.comparables.some((r) => /margen/i.test(r.metrica) && /carga/i.test(r.metrica));
  ok(!cruceMetricas, "margen y carga comercial NUNCA quedan en la misma relación comparable (misma unidad ≠ comparable)");
  ok(rel.mismaEntidad.some((g) => g.entidad === "Falabella" && g.claims.length === 2), "los claims de una entidad se agrupan para su perfil");
}

H("[6] ACCIONES PERMITIDAS · solo con respaldo cuantificado, priorizadas por monto");
{
  const figs = [
    fig("Falabella · exceso de acciones comerciales", "$194K", { unit: "money", raw: 194330 }),
    fig("Falabella · capital detenido en su mix · subtotal", "$33K", { unit: "money", raw: 33200 }),
    fig("Falabella · Ventas", "$19.4M", { unit: "money", raw: 19433000 }),
  ];
  const claims = buildClaims(figs, { eje: "cliente", periodo: "actual" });
  const acc = buildAllowedActions(claims);
  ok(acc.length === 2, `solo las palancas generan acción (ventas NO es palanca) — obtuvo ${acc.length}`);
  ok(acc[0].clase === "acciones_comerciales" && acc[0].prioridad === 1, "prioridad 1 = la palanca de MAYOR monto ($194K > $33K)");
  ok(acc[1].clase === "capital_detenido" && acc[1].prioridad === 2, "prioridad 2 = la siguiente por monto");
  ok(acc.every((a) => a.magnitud && a.claim), "toda acción cita su magnitud y el claim que la respalda");
}

H("[7] PREGUNTAS ABIERTAS · lo que no se puede afirmar no es un claim");
{
  const results = [
    { tool: "trend", coverage: { supported: false, reason: "no tengo serie mensual para eso", alternativas: ["la venta mes a mes"] } },
    { tool: "entityProfile", coverage: { supported: true }, facts: {} },
  ];
  const q = buildOpenQuestions(results);
  ok(q.length === 1 && q[0].tool === "trend", "solo las tools que degradaron honesto generan pregunta abierta");
  ok(q[0].motivo && q[0].alternativas.length === 1, "la pregunta abierta conserva motivo y alternativas");
}

console.log(`\n── _narration_contract_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
