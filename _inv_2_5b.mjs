// === FASE 2.5b · DOH/cobertura (2ª métrica modelada) ===
// Asume flags seteados afuera (DOH + rotación + QI + spine + evidence). Gates: DOH RESPONDE con payload
// (peor=más alto por polaridad / mejor=más bajo / filtro / cobertura sinónimo) + evidence · 🚨 RED no-leak +
// atomicidad · capital/bodega AVISAN · rotación sigue respondiendo · comercial intacto. Dump → argv.
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
// AJENO a DOH (días): capital $/USD/inmovilizado/stockUSD, rotación "Nx". (DOH = "Nd" → permitido)
const FOREIGN = /\$\s?\d|\bUSD\b|inmoviliz|capital\s+(atrap|deten)|stock\s*usd|\d+\.\dx/i;

const CASES = [
  { name: "DOH-peor (polaridad: más alto)", q: "qué SKU tiene peor DOH", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /MAK-COMP-AIR/.test(r.text) && /190d/.test(r.text) && r.ev && r.ev.metrica === "doh" && r.ev.fuente === "skuInventario" },
  { name: "DOH-mejor (más bajo)", q: "qué SKU tiene mejor DOH", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /PHI-SHAVER9/.test(r.text) && /15d/.test(r.text) },
  { name: "DOH-filtro-Bosch", q: "qué SKU de Bosch tiene peor DOH", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /BOS-SANDER/.test(r.text) && /115d/.test(r.text) && /Bosch/.test(r.text) },
  { name: "cobertura-sinónimo", q: "cuántos días de cobertura tiene Bosch", mk: "inventario",
    check: (r) => (r.route === "spine_inv_retrieval" || r.route === "spine_inv_superlative") && /BOS-/.test(r.text) && r.ev && r.ev.metrica === "doh" },
  { name: "🚨RED-no-leak", q: "qué SKU tiene peor DOH", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && !FOREIGN.test(r.text) },                  // cero capital/rotación
  { name: "🚨RED-atomicidad", q: "DOH y capital por SKU", mk: "inventario",
    check: (r) => /habilitado en esta fase/.test(r.text) && !/\d+d\b/.test(r.text) && !FOREIGN.test(r.text) },  // AVISA, cero DOH y cero capital
  { name: "CTRL-capital-AVISA", q: "dónde tengo capital detenido", mk: "inventario",
    check: (r) => /habilitado en esta fase/.test(r.text) && r.route !== "spine_inv_superlative" && r.route !== "spine_inv_retrieval" },
  { name: "CTRL-familia-DOH-AVISA", q: "qué familia tiene peor doh", mk: "inventario",
    check: (r) => r.route !== "spine_inv_superlative" && r.route !== "spine_inv_retrieval" && !/\d+d\b/.test(r.text) },  // familia no-SKU → AVISA
  { name: "CTRL-bodega-AVISA", q: "qué bodega está más complicada", mk: "inventario",
    check: (r) => r.route !== "spine_inv_superlative" && r.route !== "spine_inv_retrieval" },
  { name: "CTRL-rotación-responde", q: "el peor SKU por rotación", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /MAK-COMP-AIR/.test(r.text) && /0\.8x/.test(r.text) },
  { name: "CTRL-comercial-intacto", q: "el peor cliente por margen", mk: "margenes",
    check: (r) => r.route === "ranking_extremes" && /Lider/.test(r.text) },
];

const out = {}; const rows = [];
for (const c of CASES) {
  const res = mod.answerADI(c.q, { activeModule: c.mk }, { scenario: "bonanza" });
  const r = { q: c.q, route: res.route, text: modR(res.text), ev: res.evidence || null };
  out[c.name] = r;
  rows.push({ name: c.name, route: r.route, pass: c.check(r), text: r.text, ev: r.ev });
}
fs.writeFileSync(path.join(root, process.argv[2] || "_inv25b_dump.json"), JSON.stringify(out, null, 2));
console.log("█".repeat(72)); console.log("FASE 2.5b · DOH/cobertura"); console.log("█".repeat(72));
for (const r of rows) {
  console.log(`\n${r.pass ? "✅" : "🚨 FALLA"} ${r.name}  → ${r.route}`);
  console.log(`   ${norm(r.text || "(null)").slice(0, 100)}`);
  if (r.ev) console.log(`   evidence: metrica=${r.ev.metrica} fuente=${r.ev.fuente} op=${r.ev.query_plan && r.ev.query_plan.operacion} formula="${r.ev.formula}"`);
}
const fails = rows.filter(r => !r.pass);
console.log("\n" + "═".repeat(72));
console.log(`GATES: ${rows.length - fails.length}/${rows.length}` + (fails.length ? ` · 🚨 ${fails.map(f => f.name).join(", ")}` : " · TODOS VERDES"));
console.log("═".repeat(72));
process.exit(fails.length ? 1 : 0);
