// === Etapa 5 · Sentrix S1 · boleta UNIVERSAL + availability-driven ===
// Asume flags afuera (régimen + ADI_SENTRIX_BOLETA_ENABLED). Gate: comerciales y spine traen boleta UNIFORME
// (entidad/entityType/métrica + availability), avisar/saludo → sin boleta, availability data-driven HONESTO.
import { JSDOM } from "jsdom"; import esbuild from "esbuild"; import { fileURLToPath, pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "http://localhost/", pretendToBeVisual: true });
const W = dom.window; globalThis.window = W; globalThis.document = W.document;
try { Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = W.HTMLElement; globalThis.Node = W.Node; globalThis.getComputedStyle = W.getComputedStyle.bind(W);
globalThis.requestAnimationFrame = W.requestAnimationFrame.bind(W); globalThis.cancelAnimationFrame = W.cancelAnimationFrame.bind(W);
globalThis.localStorage = W.localStorage; globalThis.IS_REACT_ACT_ENVIRONMENT = false; console.error = () => {};
const root = path.dirname(fileURLToPath(import.meta.url)); const bundlePath = path.join(root, "_oracle_bundle.mjs");
await esbuild.build({ entryPoints: [path.join(root, "_oracle_entry.jsx")], bundle: true, outfile: bundlePath, format: "esm", platform: "browser", jsx: "automatic", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"], alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "silent" });
const mod = await import(pathToFileURL(bundlePath).href);
const run = (q, mk) => mod.answerADI(q, { activeModule: mk }, { scenario: "bonanza" });
const CASES = [
  { name: "comercial SKU → boleta uniforme", q: "el peor SKU por margen", mk: "margenes",
    check: (r) => r.evidence && r.evidence._sentrix && r.evidence.entidad === "MAK-COMP-AIR" && r.evidence.entityType === "sku" && r.evidence.availability },
  { name: "comercial cliente → boleta uniforme", q: "el peor cliente por margen", mk: "margenes",
    check: (r) => r.evidence && r.evidence.entidad === "Lider" && r.evidence.entityType === "client" && r.evidence.availability },
  { name: "spine → boleta con availability", q: "qué bodega está más complicada", mk: "inventario",
    check: (r) => r.evidence && r.evidence._sentrix && r.evidence.metrica === "capital" && r.evidence.availability && r.evidence.query_plan },
  { name: "availability data-driven HONESTO (perEntity=false · dato sintético)", q: "el peor SKU por margen", mk: "margenes",
    check: (r) => r.evidence.availability.history.global === true && r.evidence.availability.history.perEntity === false && r.evidence.availability.history.scenario === true && r.evidence.availability.crosses.atomic === false },
  { name: "avisar (cruce no soportado) → SIN boleta", q: "rotación por canal", mk: "inventario",
    check: (r) => r.evidence == null },
  { name: "saludo → SIN boleta", q: "hola", mk: "ventas",
    check: (r) => r.evidence == null },
];
const out = {}; const rows = [];
for (const c of CASES) { const r = run(c.q, c.mk); out[c.name] = { route: r.route, evidence: r.evidence }; rows.push({ name: c.name, pass: c.check(r) }); }
fs.writeFileSync(path.join(root, process.argv[2] || "_sentrixs1_dump.json"), JSON.stringify(out, null, 2));
console.log("█".repeat(60)); console.log("Sentrix S1 · boleta universal + availability"); console.log("█".repeat(60));
for (const r of rows) console.log(`${r.pass ? "✅" : "🚨 FALLA"} ${r.name}`);
const fails = rows.filter(r => !r.pass);
console.log("═".repeat(60)); console.log(`GATES: ${rows.length - fails.length}/${rows.length}` + (fails.length ? ` · 🚨 ${fails.map(f => f.name).join(", ")}` : " · TODOS VERDES")); console.log("═".repeat(60));
process.exit(fails.length ? 1 : 0);
