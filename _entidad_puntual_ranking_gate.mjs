/* === _entidad_puntual_ranking_gate.mjs · GATE · entidad puntual NUNCA va a una tool de ranking sin filtro ===
 * owner 2026-07-31, auditoría integral (defecto de mayor alcance — 7 capacidades afectadas):
 *
 * Cuando el usuario nombra 1-2 entidades puntuales conocidas, la Pasada 1 (PLAN) a veces elige una tool de
 * ranking/portafolio (marginRead, contributionRead, queryMetric, diagnose) SIN el filtro que la acota a esa
 * entidad. Confirmado por lectura de código: composeSpecContribucion (focus="rank", su DEFAULT) ignora
 * ESTRUCTURALMENTE el parámetro `entity` — cualquier plan que pase {dimension,entity} sin filters a
 * contributionRead queda GARANTIZADO a traer la cartera completa. Mismo patrón en marginRead/diagnose (sin
 * concepto de `entity`, solo `filters` las acota). Efecto real medido: cifras agregadas de TODA la cartera
 * atribuidas por error a una sola entidad nombrada (ej. Tottus recibiendo $656K de carga comercial de TODA la
 * cartera; Lider con $4.9M de brecha agregada cuando la suya real es ~$1.5M).
 *
 * FIX: (1) doctrina reforzada en planPrompt.js (TOOL_CATALOG: marginRead/contributionRead/diagnose/
 * executiveSummary declaran explícitamente que NUNCA van sin filtro para una entidad puntual, con el ejemplo
 * contrastante). (2) backstop determinístico en answerViaOracle.js (_coerceEntityScopedFilters): cuando
 * plan.scope.level="entity" con EXACTAMENTE 1 entidad nombrada, cualquier call a marginRead/contributionRead/
 * diagnose/queryMetric se re-escribe con filters:{eje real de la entidad: entidad} ANTES de ejecutar — sin
 * depender de que el LLM lo haga bien, mismo principio que el resto de _coerce* del archivo.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };
const SAFE = "Texto de narración seguro.";

console.log("── 0 · CONFIRMACIÓN DEL MECANISMO DE FALLA (a nivel de tool, sin el fix) — documenta la causa raíz ──");
{
  const noFilter = TOOLS.contributionRead({ dimension: "cliente", entity: "Tottus", scenario: "actual" });
  const totalFig = noFilter.boleta.find((f) => f.label === "Contribución total");
  ok(!!totalFig && totalFig.value !== "$1.9M", `contributionRead({entity:"Tottus"} SIN filters) trae el total de TODA la cartera (${totalFig && totalFig.value}), no el de Tottus ($1.9M) — 'entity' se ignora estructuralmente en focus="rank"`);
}

console.log('\n── 1 · contributionRead: plan misroteado (sin filters) para Tottus → coerción lo acota a SU PROPIA cifra ──');
{
  const PLAN = { intent: "answer", mode: "default", rationale: "contribución de Tottus", scope: { level: "entity", entities: ["Tottus"] }, calls: [{ tool: "contributionRead", args: { dimension: "cliente", entity: "Tottus" } }] };
  let seenResults = null;
  await answerViaOracle({ text: "¿cuánto contribuye Tottus?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async (a) => { seenResults = a.results; return SAFE; } });
  const r = seenResults && seenResults[0];
  const totalFig = r && r.boleta && r.boleta.find((f) => f.label === "Contribución total");
  ok(!!totalFig && totalFig.value === "$1.9M", `tras la coerción, "Contribución total" = $1.9M (SOLO Tottus), no el agregado de la cartera — obtuvo ${totalFig && totalFig.value}`);
  ok(r && r.facts && r.facts.contribucion && r.facts.contribucion.panel && r.facts.contribucion.panel.rows.length === 1, `el panel queda acotado a 1 sola fila (Tottus) — obtuvo ${r && r.facts && r.facts.contribucion && r.facts.contribucion.panel && r.facts.contribucion.panel.rows.length} filas`);
}

console.log('\n── 2 · marginRead: plan misroteado (sin filters) para Sodimac → coerción lo acota, sin traer otras cuentas ──');
{
  const PLAN = { intent: "answer", mode: "default", rationale: "margen de Sodimac", scope: { level: "entity", entities: ["Sodimac"] }, calls: [{ tool: "marginRead", args: { dimension: "cliente" } }] };
  let seenResults = null;
  await answerViaOracle({ text: "¿qué margen tiene Sodimac?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async (a) => { seenResults = a.results; return SAFE; } });
  const r = seenResults && seenResults[0];
  const labels = (r && r.boleta || []).map((f) => f.label);
  ok(labels.some((l) => /Sodimac/.test(l)), `la boleta SÍ trae una cifra de Sodimac — obtuvo ${JSON.stringify(labels)}`);
  ok(!labels.some((l) => /Falabella|Jumbo|Lider|Ripley/.test(l)), `tras la coerción, NINGUNA otra cuenta aparece en la boleta (antes: traía el ranking de toda la cartera) — obtuvo ${JSON.stringify(labels)}`);
}

console.log('\n── 3 · diagnose: plan misroteado (sin filters) para Tottus → NUNCA le atribuye el $ agregado de la cartera ──');
{
  const PLAN = { intent: "answer", mode: "diagnostico", rationale: "diagnóstico de Tottus", scope: { level: "entity", entities: ["Tottus"] }, calls: [{ tool: "diagnose", args: {} }] };
  let seenResults = null;
  await answerViaOracle({ text: "¿por qué Tottus pierde plata?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async (a) => { seenResults = a.results; return SAFE; } });
  const r = seenResults && seenResults[0];
  const labels = (r && r.boleta || []).map((f) => f.label);
  ok(!labels.some((l) => /\$4\.9M|\$656K/.test((r.boleta.find((f) => f.label === l) || {}).value || "")), `la boleta NUNCA contiene los totales agregados de TODA la cartera ($4.9M / $656K) atribuidos a Tottus — obtuvo ${JSON.stringify(r && r.boleta)}`);
}

console.log('\n── 4 · queryMetric: plan misroteado (sin filters) para Tottus → coerción + redirect existente a entityRecord ──');
{
  const PLAN = { intent: "answer", mode: "default", rationale: "contribución de Tottus", scope: { level: "entity", entities: ["Tottus"] }, calls: [{ tool: "queryMetric", args: { metric: "contribucion", dimension: "cliente" } }] };
  let seenResults = null;
  await answerViaOracle({ text: "¿cuánto contribuye Tottus?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async (a) => { seenResults = a.results; return SAFE; } });
  const r = seenResults && seenResults[0];
  ok(!!r && r.facts && r.facts.entidad === "Tottus" && r.facts.entityType === "cliente", `queryMetric misroteado termina en la FILA de Tottus (redirect a entityRecord), no en un ranking de cartera — obtuvo facts=${JSON.stringify(r && r.facts && { entidad: r.facts.entidad, entityType: r.facts.entityType })}`);
}

console.log("\n── 5 · REGRESIÓN — 2+ entidades nombradas (comparación) NO se fuerza ningún filtro ──");
{
  const PLAN = { intent: "answer", mode: "diagnostico", rationale: "priorizar entre Tottus y Sodimac", scope: { level: "entity", entities: ["Tottus", "Sodimac"] }, calls: [{ tool: "diagnose", args: {} }] };
  let seenResults = null;
  await answerViaOracle({ text: "¿a cuál priorizo entre Tottus y Sodimac?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async (a) => { seenResults = a.results; return SAFE; } });
  const r = seenResults && seenResults[0];
  ok(!!r && r.coverage && r.coverage.supported === true && r.facts.findings && r.facts.findings.length > 0, "con 2 entidades nombradas, diagnose SIGUE trayendo el barrido completo (sin acotar) — terreno de comparación, no se toca");
}

console.log("\n── 6 · REGRESIÓN — scope.level='global' (negocio completo) NO se toca ──");
{
  const PLAN = { intent: "answer", mode: "diagnostico", rationale: "diagnóstico del negocio", scope: { level: "global" }, calls: [{ tool: "diagnose", args: {} }] };
  let seenResults = null;
  await answerViaOracle({ text: "¿dónde pierdo plata en el negocio?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async (a) => { seenResults = a.results; return SAFE; } });
  const r = seenResults && seenResults[0];
  const totalFig = r && r.boleta && r.boleta.find((f) => /subtotal/.test(f.label));
  ok(!!totalFig, `scope global sigue trayendo el diagnóstico COMPLETO del negocio (sin acotar a nada) — obtuvo ${totalFig && totalFig.value}`);
}

console.log("\n── 7 · REGRESIÓN — filtro YA correcto en el plan no se rompe (no-op) ──");
{
  const PLAN = { intent: "answer", mode: "default", rationale: "margen de Sodimac (ya bien filtrado)", scope: { level: "entity", entities: ["Sodimac"] }, calls: [{ tool: "marginRead", args: { dimension: "cliente", filters: { cliente: "Sodimac" } } }] };
  let seenResults = null;
  await answerViaOracle({ text: "¿qué margen tiene Sodimac?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async (a) => { seenResults = a.results; return SAFE; } });
  const r = seenResults && seenResults[0];
  const labels = (r && r.boleta || []).map((f) => f.label);
  ok(labels.some((l) => /Sodimac/.test(l)) && !labels.some((l) => /Falabella|Jumbo|Lider|Ripley/.test(l)), `un plan YA bien filtrado sigue funcionando igual — obtuvo ${JSON.stringify(labels)}`);
}

console.log(`\n── _entidad_puntual_ranking_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
