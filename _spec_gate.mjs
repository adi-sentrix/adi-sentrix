/* === _spec_gate.mjs · GATE del SEAM answerADIFromSpec (Paso 4) ===
 * Prueba el seam del spec SIN proveedor LLM: specs escritos a mano → answerADIFromSpec → asserts.
 * Demuestra el objetivo del owner: el LLM habla contra un spec canónico · ADI valida contra el contrato · recién ahí responde.
 * Uso: node _spec_gate.mjs   (exit 1 si algún test falla · para CI). El gate del MOTOR (16/0) corre aparte: node _gate.mjs
 */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(), out = path.join(root, "_sgb.mjs");
await esbuild.build({ entryPoints: [path.join(root, "src/adi/answerADIFromSpec.js")], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(out); } catch {}
const A = M.answerADIFromSpec;

const S = (o) => ({ schemaVersion: 1, scenario: "actual", filters: {}, ...o });   // spec base + overrides
const blocked = (r, kind) => typeof r.route === "string" && r.route === "spec_blocked_" + kind;
const executes = (r, route) => typeof r.text === "string" && r.text.length > 0 && r.route === route && !/^spec_blocked/.test(r.route);

const TESTS = [
  // ── EJECUTA (spec válido → productor real) ──
  { n: "1 · rank válido ejecuta",        spec: S({ operation: "rank", metric: "ventas", dimension: "cliente", sort: { by: "ventas", dir: "desc" }, limit: 3 }), ok: (r) => executes(r, "ranking_extremes") },
  { n: "2 · overview válido ejecuta",    spec: S({ operation: "overview", metric: "margen", dimension: "cliente" }), ok: (r) => executes(r, "qi_retrieval") },
  { n: "3 · compare 2 clientes ejecuta", spec: S({ operation: "compare", metric: "margen", dimension: "cliente", comparison: { dimension: "cliente", entities: ["Falabella", "Lider"] } }), ok: (r) => executes(r, "client_comparison") },
  { n: "4 · dive cliente ejecuta",       spec: S({ operation: "dive", metric: "margen", dimension: "cliente", entity: "Falabella" }), ok: (r) => executes(r, "client_dive") },
  // ── BLOQUEA HONESTO (validación contra el contrato) ──
  { n: "5 · métrica inexistente bloquea", spec: S({ operation: "overview", metric: "foo", dimension: "cliente" }), ok: (r) => blocked(r, "unknown-metric") },
  { n: "6 · dimensión inválida bloquea",  spec: S({ operation: "rank", metric: "ventas", dimension: "vendedor" }), ok: (r) => blocked(r, "unknown-dimension") },
  { n: "7 · métrica no en dimensión",     spec: S({ operation: "overview", metric: "margen", dimension: "bodega" }), ok: (r) => blocked(r, "metric-not-in-dim") },
  { n: "8 · SKU margen en simulación (base-only) bloquea honesto", spec: S({ operation: "overview", metric: "margen", dimension: "sku", scenario: "simulation", assumption: { type: "margin", value: -5, unit: "pct" } }), ok: (r) => blocked(r, "scenario-blind") },
  { n: "9 · cruce marca×cliente bloquea",  spec: S({ operation: "overview", metric: "margen", dimension: "cliente", filters: { marca: "Bosch" } }), ok: (r) => blocked(r, "blocked-cross") },
  { n: "10 · operación no soportada ofrece", spec: S({ operation: "forecast", metric: "ventas", dimension: "cliente" }), ok: (r) => blocked(r, "unsupported-op") },
  { n: "11 · costo (declarado, no cableado) degrada", spec: S({ operation: "overview", metric: "costo", dimension: "cliente" }), ok: (r) => blocked(r, "metric-not-wired") },
  { n: "12 · schemaVersion desconocida bloquea", spec: { schemaVersion: 2, operation: "overview", metric: "ventas", dimension: "cliente" }, ok: (r) => blocked(r, "version") },
  // fix #2 (hallado en el experimento LLM): explain_availability EXPLICA (no cae en el bloqueo genérico metric-not-in-dim)
  { n: "13 · explain_availability(margen@bodega) explica, no bloquea", spec: S({ operation: "explain_availability", metric: "margen", dimension: "bodega" }), ok: (r) => r.route === "spec_explain" && typeof r.text === "string" && /bodega/i.test(r.text) },
  { n: "14 · overview(margen@bodega) SÍ bloquea metric-not-in-dim (regresión #7)", spec: S({ operation: "overview", metric: "margen", dimension: "bodega" }), ok: (r) => blocked(r, "metric-not-in-dim") },
  // productor de inventario spec-driven (capital/rotación/DOH por bodega/sku · sin texto)
  { n: "15 · capital@bodega overview EJECUTA (spec-driven)", spec: S({ operation: "overview", metric: "capital", dimension: "bodega" }), ok: (r) => executes(r, "qi_retrieval") && /Santiago|Valpara|\$/.test(r.text) },
  { n: "16 · rotacion@bodega overview EJECUTA", spec: S({ operation: "overview", metric: "rotacion", dimension: "bodega" }), ok: (r) => executes(r, "qi_retrieval") && /x/.test(r.text) },
  { n: "17 · doh@bodega overview EJECUTA", spec: S({ operation: "overview", metric: "doh", dimension: "bodega" }), ok: (r) => executes(r, "qi_retrieval") },
  { n: "18 · capital@bodega rank top 2 EJECUTA", spec: S({ operation: "rank", metric: "capital", dimension: "bodega", limit: 2, sort: { by: "capital", dir: "desc" } }), ok: (r) => executes(r, "qi_retrieval") },
  { n: "19 · capital@cliente degrada honesto (métrica no en esa dimensión)", spec: S({ operation: "overview", metric: "capital", dimension: "cliente" }), ok: (r) => blocked(r, "metric-not-in-dim") },
];

let pass = 0, fail = 0; const lines = [];
for (const t of TESTS) {
  let r; try { r = A(t.spec, {}, {}); } catch (e) { r = { route: "THREW", text: String(e && e.message) }; }
  const good = !!t.ok(r);
  if (good) pass++; else fail++;
  lines.push(`  ${good ? "✓" : "✗"} ${t.n}${good ? "" : `   → route="${r.route}" text="${String(r.text).slice(0, 60)}…"`}`);
}
console.log(`── _spec_gate: PASS ${pass} · FAIL ${fail} (de ${TESTS.length}) ──`);
console.log(lines.join("\n"));
process.exit(fail ? 1 : 0);
