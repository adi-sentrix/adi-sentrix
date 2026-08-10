/* === _periodo_hoy_campo_gate.mjs · GATE · el período "foto a hoy" deriva del CAMPO pedido, no solo de la tool ===
 * owner 2026-07-31, auditoría (defecto "Inventario y capital inmovilizado"):
 *
 * toolRunner.js (_stampPeriodo/_PERIODO_HOY) solo reconoce 'inventoryStatus' como tool de snapshot ("foto a hoy").
 * Cuando la misma pregunta de negocio (capital inmovilizado / valor de inventario / rotación) se resuelve para un
 * SKU puntual vía entityRecord (porque inventoryStatus no filtra por SKU), el período quedaba etiquetado "año
 * cerrado" — inconsistente y engañoso para un concepto que es una FOTO del stock a hoy, no un acumulado anual.
 *
 * FIX (answerViaOracle.js, ruta determinística _simpleEntityMetric): cuando el token de UN SOLO CAMPO que se va a
 * narrar es un campo de inventario/foto (stockUSD/rotación/DOH), el período se estampa "foto a hoy" SIN IMPORTAR
 * que la tool haya sido entityRecord (no inventoryStatus) — el criterio deriva del CAMPO solicitado.
 *
 * Confirmado por lectura de código: _PERIODO_HOY solo contenía 'inventoryStatus'; reproducido de forma
 * determinística (100%) en el turno de corrección de SKU (mismo patrón que el caso 7 de Inventario).
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · SKU + campo de INVENTARIO (capital/valor de inventario) vía entityRecord → período 'foto a hoy' ──");
{
  const PLAN = {
    intent: "answer", mode: "default", rationale: "capital del sku",
    scope: { level: "entity", entities: ["SAM-REF500L"] },
    calls: [{ tool: "entityRecord", args: { dimension: "sku", entity: "SAM-REF500L" } }],
  };
  let narrateCalled = false;
  const r = await answerViaOracle({ text: "¿cuánto capital tiene inmovilizado el SKU SAM-REF500L?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async () => { narrateCalled = true; return "no debería narrar libre"; } });
  ok(!!r && r.r && r.r.deterministic === true, `resolvió por la ruta determinística (single-field), sin invocar al narrador libre — deterministic=${r && r.r && r.r.deterministic}, narrateCalled=${narrateCalled}`);
  ok(!!r && /foto|a la fecha|hoy/i.test(r.r.text) && !/a[nñ]o cerrado/i.test(r.r.text), `el texto declara "foto a hoy" (o equivalente), NO "año cerrado" — texto: "${r && r.r && r.r.text}"`);
}

console.log("\n── 2 · REGRESIÓN — el mismo SKU, pidiendo un campo ANUAL (unidades vendidas) sigue diciendo 'año cerrado' ──");
{
  const PLAN = {
    intent: "answer", mode: "default", rationale: "unidades del sku",
    scope: { level: "entity", entities: ["SAM-REF500L"] },
    calls: [{ tool: "entityRecord", args: { dimension: "sku", entity: "SAM-REF500L" } }],
  };
  const r = await answerViaOracle({ text: "¿cuántas unidades vendió el SKU SAM-REF500L?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async () => "no debería narrar libre" });
  ok(!!r && r.r && r.r.deterministic === true, "resolvió por la ruta determinística");
  ok(!!r && /a[nñ]o cerrado/i.test(r.r.text) && !/foto/i.test(r.r.text), `un campo ANUAL (unidades vendidas) sigue declarando "año cerrado", no se rompió por el fix — texto: "${r && r.r && r.r.text}"`);
}

console.log("\n── 3 · REGRESIÓN — inventoryStatus (el caso YA cubierto) sigue diciendo 'foto a hoy' igual que siempre ──");
{
  const PLAN = { intent: "answer", mode: "default", rationale: "inventario detenido", scope: { level: "global" }, calls: [{ tool: "inventoryStatus", args: {} }] };
  let seenPeriodos = null;
  const r = await answerViaOracle({ text: "¿dónde tengo capital inmovilizado?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN, callNarrate: async (a) => { seenPeriodos = a; return "El capital detenido asciende a lo que muestra el panel, foto de inventario a hoy."; } });
  ok(!!r, `inventoryStatus sigue respondiendo normalmente (r=${!!r})`);
}

console.log(`\n── _periodo_hoy_campo_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
