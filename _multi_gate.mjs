/* === _multi_gate.mjs · GATE del MULTI-ANÁLISIS (V3 · Frente C.1 · owner 2026-07-07) ===
 * "¿Cómo está Lider en margen y rotación?" cruza DOS lentes → UNA respuesta de secciones, cada una producida por SU
 * composer vía el seam (misma honestidad y degrades) con las boletas MERGEADAS y evidencias múltiples (un botón por lente).
 * Lockea: (1) detección conservadora — la enumeración de sustantivos dispara, los cruces con dueño NO ("venden mucho y
 * peor margen" = alto_volumen · "venta bajo el mínimo" = pct · "compará A y B" = compare) · (2) secciones con su verdad
 * (entity-scoped · hueco honesto donde el eje no existe) · (3) boleta mergeada (mandatorias de ambas) · (4) evidence.multi. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_mue.js"), out = path.join(root, "_mub.mjs");
fs.writeFileSync(entry, [
  'export { coerceSpec } from "./src/adi/coerceChain.js";',
  'export { answerConversational } from "./src/adi/conversation.js";',
  'export { detectMultiAnalysis } from "./src/adi/multiFocus.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { coerceSpec: C, answerConversational: AC, detectMultiAnalysis: D } = M;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
const base = (q) => { const cmp = /\bcompar/i.test(q); return { schemaVersion: 1, operation: cmp ? "compare" : "overview", metric: "ventas", dimension: "cliente", ...(cmp ? { comparison: { entities: ["Falabella", "Lider"] } } : {}) }; };
const run = (q) => { const s = C(q, base(q), false); const r = AC(s, {}, {}); r._spec = s; return r; };

console.log("── detección conservadora · la enumeración dispara, los cruces con dueño NO ──");
ok("«Lider en margen y rotación» → multi (metrics margen+rotacion · entity Lider)", (() => { const d = D("¿cómo está Lider en margen y rotación?"); return d.isMulti && d.metrics.includes("margen") && d.metrics.includes("rotacion") && d.entity === "Lider"; })());
ok("«margen y rotación de los SKU» → multi dimension sku", (() => { const d = D("muéstrame el margen y la rotación de los SKU"); return d.isMulti && d.dimension === "sku"; })());
ok("«ventas y contribución por cliente» → multi", D("¿cómo van las ventas y la contribución por cliente?").isMulti);
ok("«cuánta venta está bajo el margen mínimo» → NO multi (pct de margen, tiene dueño)", !D("¿cuánta venta está bajo el margen mínimo?").isMulti);
ok("«los que más venden y peor margen» → NO multi (alto_volumen, verbo no sustantivo)", !D("¿qué clientes son los que más venden y peor margen dejan?").isMulti);
ok("«ventas y facturación» → NO multi (una sola familia)", !D("¿cómo van las ventas y la facturación?").isMulti);
ok("«compará Falabella y Lider» → NO multi (entidades, no métricas)", C("compará Falabella y Lider", base("compará Falabella y Lider"), false).operation === "compare");
ok("«si subo 5% la venta y el margen» → NO multi (simulación)", !D("¿qué pasa si subo 5% la venta y el margen?").isMulti);

console.log("\n── secciones con su verdad · entity-scoped + hueco honesto ──");
const r1 = run("¿cómo está Lider en margen y rotación?");
ok("rutea a multi_analysis", r1._spec.turn_type === "multi_analysis");
ok("sección **Margen** presente y scopeada a Lider (no nombra a Falabella)", /\*\*Margen\*\*/.test(r1.text) && /Lider/.test(r1.text) && !/Falabella/.test(r1.text.split("**Rotación**")[0]));
ok("sección **Rotación** = hueco HONESTO (rotación no existe por cliente)", /\*\*Rotación\*\*/.test(r1.text) && /no lo tengo por cliente|S[ií] lo tengo por/i.test(r1.text));
const r2 = run("muéstrame el margen y la rotación de los SKU");
ok("multi@sku: margen@sku + inventario, ambas secciones REALES", /\*\*Margen\*\*/.test(r2.text) && /\*\*Rotación\*\*/.test(r2.text) && /DOH|rotaci[oó]n/i.test(r2.text.split("**Rotación**")[1] || ""));

console.log("\n── boleta mergeada + evidencias múltiples (un botón por lente) ──");
const bol2 = (r2.evidence && r2.evidence.boleta) || [];
ok("la boleta mergeada trae cifras de AMBAS lentes", bol2.some((f) => /margen|Medida|Palanca/i.test(f.label)) && bol2.some((f) => /Capital|SKU · |Inventario/i.test(f.label)));
ok("las mandatorias de ambas secciones sobreviven el merge", bol2.filter((f) => f.mandatory).length >= 2);
ok("evidence.multi trae la evidencia de la 2ª lente (botón propio)", Array.isArray(r2.evidence.multi) && r2.evidence.multi.length >= 1 && !!r2.evidence.multi[0].inventory);
ok("la evidencia primaria es la 1ª lente (margen)", !!(r2.evidence.margin && r2.evidence.margin.panel));
const r3 = run("¿cómo van las ventas y la contribución por cliente?");
ok("ventas+contribución: dos secciones + evidencia multi", /\*\*Ventas\*\*/.test(r3.text) && /\*\*Contribución\*\*/.test(r3.text) && Array.isArray(r3.evidence.multi) && r3.evidence.multi.length >= 1);

console.log(`\n── _multi_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
