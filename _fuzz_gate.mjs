/* === _fuzz_gate.mjs · GATE DE BLINDAJE (owner 2026-07-09: "no podemos fallar — una pregunta sencilla fue un error") ===
 * El crash de prod vino de una FORMA rara del spec del LLM (filters:null explícito). Garantía estructural que este
 * gate lockea: SEA CUAL SEA la forma que el LLM #1 emita (nulls, tipos equivocados, enums basura, objetos vacíos),
 * la cadena coerceSpec → answerConversational:
 *   1. JAMÁS lanza una excepción al llamador,
 *   2. SIEMPRE devuelve texto no vacío,
 *   3. NUNCA filtra un error crudo de JS al texto del usuario ("Cannot read", "TypeError", stack traces).
 * (executor-error con texto limpio de producto es el último recurso aceptable; el crash no.) */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_fze.js"), out = path.join(root, "_fzb.mjs");
fs.writeFileSync(entry, ['export { coerceSpec } from "./src/adi/coerceChain.js";', 'export { answerConversational } from "./src/adi/conversation.js";'].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }
const { coerceSpec: C, answerConversational: A } = M;

let pass = 0, fail = 0;
const RAW_ERROR = /Cannot read|TypeError|ReferenceError|undefined is not|is not a function|at Object\.|\bat [A-Za-z_$][\w$]*\s+\(/;

const BASE = { schemaVersion: 1, operation: "overview", metric: "ventas", dimension: "cliente", entity: null, filters: null, comparison: null, sort: null, limit: null, scenario: "actual", transform: null, lens: null, confidence: null, turn_type: "new_query", meta: null, clarify: null };

// mutaciones hostiles: cada campo con null / tipo equivocado / valor basura + shapes rotos completos
const MUT = [];
const FIELDS = ["operation", "metric", "dimension", "entity", "filters", "comparison", "sort", "limit", "scenario", "transform", "lens", "turn_type", "meta", "clarify"];
const JUNK = [null, 0, 7, "", "zzz_basura", true, [], {}, [null], { x: null }];
for (const f of FIELDS) for (const j of JUNK) MUT.push({ name: `${f}=${JSON.stringify(j)}`, spec: { ...BASE, [f]: j } });
MUT.push({ name: "spec vacío {}", spec: {} });
MUT.push({ name: "spec null", spec: null });
MUT.push({ name: "comparison sin entities", spec: { ...BASE, operation: "compare", comparison: {} } });
MUT.push({ name: "comparison entities null", spec: { ...BASE, operation: "compare", comparison: { entities: null } } });
MUT.push({ name: "comparison entities [null, Lider]", spec: { ...BASE, operation: "compare", comparison: { entities: [null, "Lider"] } } });
MUT.push({ name: "comparison entities números", spec: { ...BASE, operation: "compare", comparison: { entities: [1, 2] } } });
MUT.push({ name: "dive entity número", spec: { ...BASE, operation: "dive", entity: 42 } });
MUT.push({ name: "dive entity objeto", spec: { ...BASE, operation: "dive", entity: { nombre: "Lider" } } });
MUT.push({ name: "filters con valores no-string", spec: { ...BASE, filters: { cliente: 42, marca: {}, bodega: [] } } });
MUT.push({ name: "transform basura", spec: { ...BASE, operation: "simulate", transform: { type: null, value: "mucho" } } });
MUT.push({ name: "todo null menos operation", spec: { operation: "overview" } });
MUT.push({ name: "rank sin metric", spec: { schemaVersion: 1, operation: "rank", dimension: "cliente" } });
MUT.push({ name: "diagnose filters null", spec: { schemaVersion: 1, operation: "diagnose", filters: null } });
MUT.push({ name: "inventory sin foco", spec: { schemaVersion: 1, operation: "inventory", metric: "capital", dimension: "sku", filters: null } });

const QS = ["ventas", "¿cómo viene mi margen?"];
for (const m of MUT) {
  let good = true, detail = "";
  for (const q of QS) {
    try {
      const r = A(C(q, m.spec, false, null), {}, { scenario: "bonanza" });
      const t = r && r.text;
      if (typeof t !== "string" || !t.trim()) { good = false; detail = "texto vacío"; break; }
      if (RAW_ERROR.test(t)) { good = false; detail = `error crudo en texto: ${t.slice(0, 90)}`; break; }
    } catch (e) { good = false; detail = `THROW: ${String(e && e.message).slice(0, 90)}`; break; }
  }
  if (good) pass++; else { fail++; console.log(`  ✗ ${m.name} → ${detail}`); }
}
console.log(`\n── _fuzz_gate: PASS ${pass} · FAIL ${fail} (de ${MUT.length} formas hostiles × ${QS.length} preguntas) ──`);
process.exit(fail ? 1 : 0);
