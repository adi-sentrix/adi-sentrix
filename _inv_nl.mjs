// === tanda 2b · reconocimiento NL de inventario (ADI_INV_NL_VOCAB_ENABLED) ===
// Fraseos naturales del dueño → el spine RESPONDE directo (en vez de que el smart-guide ofrezca).
// Asume flags afuera. Gate: parado/stock muerto/no se mueve/bodega peor → spine_inv · comercial intacto.
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
const React = (await import("react")).default; const { renderToStaticMarkup } = await import("react-dom/server");
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
function modR(t) { if (t == null) return null; const d = document.createElement("div"); d.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text: t })); return d.textContent; }
const SPINE = (r) => r.route === "spine_inv_superlative" || r.route === "spine_inv_retrieval";
const CASES = [
  { name: "parado en bodega → capital inmoviliz.", q: "qué tengo parado en bodega", mk: "inventario", check: (r) => SPINE(r) && /Valparaíso/.test(r.text) && /inmovilizado/.test(r.text) },
  { name: "no se mueven → rotación baja", q: "qué productos no se mueven", mk: "inventario", check: (r) => r.route === "spine_inv_superlative" && /MAK-COMP-AIR/.test(r.text) && /0\.8x/.test(r.text) },
  { name: "stock muerto → inmovilizado (Def2)", q: "cuánto stock muerto tengo", mk: "inventario", check: (r) => r.route === "spine_inv_superlative" && /LG-DRYER8KG/.test(r.text) },
  { name: "casi no vendo → rotación baja", q: "qué casi no vendo", mk: "inventario", check: (r) => r.route === "spine_inv_superlative" && /0\.8x/.test(r.text) },
  { name: "bodega peor → complicada", q: "qué bodega está peor", mk: "inventario", check: (r) => r.route === "spine_inv_superlative" && /Valparaíso/.test(r.text) },
  { name: "plata dormida → inmovilizado", q: "dónde tengo plata dormida", mk: "inventario", check: (r) => r.route === "spine_inv_superlative" && /LG-DRYER8KG/.test(r.text) },
  { name: "no se venden → rotación baja", q: "los SKU que no se venden", mk: "inventario", check: (r) => r.route === "spine_inv_superlative" && /0\.8x/.test(r.text) },
  // controles · comercial NO tocado por el bloque NL de inventario
  { name: "CTRL menor margen (comercial)", q: "cuáles son los SKU con menor margen", mk: "margenes", check: (r) => r.route === "ranking_extremes" && /MAK-COMP-AIR/.test(r.text) && /7\.9%/.test(r.text) },
  { name: "CTRL peor cliente margen", q: "el peor cliente por margen", mk: "margenes", check: (r) => r.route === "ranking_extremes" },
];
const out = {}; const rows = [];
for (const c of CASES) { const res = mod.answerADI(c.q, { activeModule: c.mk }, { scenario: "bonanza" }); const r = { q: c.q, route: res.route, text: modR(res.text) }; out[c.name] = r; rows.push({ name: c.name, route: r.route, pass: c.check(r), text: r.text }); }
fs.writeFileSync(path.join(root, process.argv[2] || "_invnl_dump.json"), JSON.stringify(out, null, 2));
console.log("█".repeat(64)); console.log("tanda 2b · reconocimiento NL de inventario"); console.log("█".repeat(64));
for (const r of rows) { console.log(`${r.pass ? "✅" : "🚨 FALLA"} ${r.name.padEnd(38)} → ${r.route}`); if (!r.pass) console.log(`        ${norm(r.text || "(null)").slice(0, 88)}`); }
const fails = rows.filter(r => !r.pass);
console.log("═".repeat(64)); console.log(`GATES: ${rows.length - fails.length}/${rows.length}` + (fails.length ? ` · 🚨 ${fails.map(f => f.name).join(", ")}` : " · TODOS VERDES")); console.log("═".repeat(64));
process.exit(fails.length ? 1 : 0);
