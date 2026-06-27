// === FASE 2.5c-1 · capital (stock en valor) + desambiguación de "stock" ===
// Asume flags afuera (capital + rotación + DOH + QI + spine + evidence). Gates: capital RESPONDE con payload
// ($K · más/menos · anchor "detenido" vista amplia · filtro · evidence) · 🚨 RED no-leak + atomicidad · bodega
// AVISA · rotación/DOH responden · 🛡️ comercial-stock intacto. Dump → argv (para shadow + GATE COMERCIAL-STOCK).
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
function modR(text) { if (text == null) return null; const t = document.createElement("div"); t.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text })); return t.textContent; }
// AJENO a capital ($): rotación "Nx", DOH/días "Nd". (capital = "$N.NK" → permitido)
const FOREIGN = /\d+\.\dx|\b\d+\s*d\b|\d+\s*d[ií]as|\bdoh\b|rotaci[oó]n\s+[\d.]/i;

const CASES = [
  { name: "CAPITAL-más", q: "qué SKU tiene más capital", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /SAM-REF500L/.test(r.text) && /\$18\.6K/.test(r.text) && r.ev && r.ev.metrica === "capital" && r.ev.fuente === "skuInventario" },
  { name: "CAPITAL-de-LG (filtro)", q: "capital de LG", mk: "inventario",
    check: (r) => r.route === "spine_inv_retrieval" && /LG-/.test(r.text) && /LG/.test(r.text) && r.ev && r.ev.metrica === "capital" },
  { name: "CAPITAL-detenido (anchor · vista amplia)", q: "dónde tengo capital detenido", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /SAM-REF500L/.test(r.text) && /\$18\.6K/.test(r.text) },
  { name: "stock-en-valor → capital", q: "stock en valor de Samsung", mk: "inventario",
    check: (r) => (r.route === "spine_inv_retrieval" || r.route === "spine_inv_superlative") && r.ev && r.ev.metrica === "capital" },
  { name: "🚨RED-no-leak", q: "qué SKU tiene más capital", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && !FOREIGN.test(r.text) },                  // cero rotación/DOH ajeno
  { name: "🚨RED-atomicidad (capital y bodega)", q: "capital y bodega por SKU", mk: "inventario",
    check: (r) => /habilitado en esta fase/.test(r.text) && !/\$\d/.test(r.text) && !FOREIGN.test(r.text) },  // AVISA, cero capital y cero bodega
  { name: "CTRL-bodega-AVISA", q: "qué bodega está más complicada", mk: "inventario",
    check: (r) => r.route !== "spine_inv_superlative" && r.route !== "spine_inv_retrieval" },
  { name: "CTRL-rotación-responde", q: "el peor SKU por rotación", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /MAK-COMP-AIR/.test(r.text) && /0\.8x/.test(r.text) },
  { name: "CTRL-DOH-responde", q: "qué SKU tiene peor DOH", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /190d/.test(r.text) },
  { name: "CTRL-comercial-intacto", q: "el peor cliente por margen", mk: "margenes",
    check: (r) => r.route === "ranking_extremes" && /Lider/.test(r.text) },
  // 🛡️ COMERCIAL-STOCK · el "stock" comercial NO debe rutear a una respuesta de CAPITAL (spine_inv) · el byte-exacto
  // ON vs OFF vs HEAD se prueba con el diff de los dumps (el camino comercial es idéntico por construcción).
  { name: "COMM-stock-pelado (no es capital)", q: "stock", mk: "ventas",
    check: (r) => r.route !== "spine_inv_superlative" && r.route !== "spine_inv_retrieval" },
  { name: "COMM-unidades-de-stock (no es capital)", q: "cuántas unidades de stock", mk: "ventas",
    check: (r) => r.route !== "spine_inv_superlative" && r.route !== "spine_inv_retrieval" },
];

const out = {}; const rows = [];
for (const c of CASES) {
  const res = mod.answerADI(c.q, { activeModule: c.mk }, { scenario: "bonanza" });
  const r = { q: c.q, route: res.route, text: modR(res.text), ev: res.evidence || null };
  out[c.name] = r;
  rows.push({ name: c.name, route: r.route, pass: c.check(r), text: r.text, ev: r.ev });
}
fs.writeFileSync(path.join(root, process.argv[2] || "_inv25c_dump.json"), JSON.stringify(out, null, 2));
console.log("█".repeat(72)); console.log("FASE 2.5c-1 · capital + desambiguación"); console.log("█".repeat(72));
for (const r of rows) {
  console.log(`\n${r.pass ? "✅" : "🚨 FALLA"} ${r.name}  → ${r.route}`);
  console.log(`   ${norm(r.text || "(null)").slice(0, 100)}`);
  if (r.ev && r.ev.metrica) console.log(`   evidence: metrica=${r.ev.metrica} fuente=${r.ev.fuente} op=${r.ev.query_plan && r.ev.query_plan.operacion}`);
}
const fails = rows.filter(r => !r.pass);
console.log("\n" + "═".repeat(72));
console.log(`GATES: ${rows.length - fails.length}/${rows.length}` + (fails.length ? ` · 🚨 ${fails.map(f => f.name).join(", ")}` : " · TODOS VERDES"));
console.log("═".repeat(72));
process.exit(fails.length ? 1 : 0);
