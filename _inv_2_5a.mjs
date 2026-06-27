// === FASE 2.5a · inventario disponible · rotación (1ª métrica modelada) + andamio ===
// Asume flags seteados afuera (rotación + QI + spine + evidence para responder). Gates: rotación RESPONDE
// con payload (peor/mejor/filtro) + evidence (fuente skuInventario, fórmula, operación) · 🚨 RED: no-leak +
// atomicidad · las otras métricas (capital/DOH) AVISAN · comercial intacto. Dump → argv para shadow-diff.
import { JSDOM } from "jsdom"; import esbuild from "esbuild"; import { fileURLToPath, pathToFileURL } from "url"; import path from "path"; import fs from "fs";
import { ADI_INV_DOH_ENABLED, ADI_INV_CAPITAL_ENABLED, ADI_INV_BODEGA_ENABLED } from "./src/config/voiceFlags.js";   // 2.5b/c/d · DOH/capital/bodega modelables → controles flag-aware; la atomicidad mezclaba con bodega (que en 2.5d ya se modela → la atomicidad queda inerte)
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
// número AJENO a rotación: capital $/K, DOH/cobertura en días, stockUSD, inmovilizado. (rotación = "N.Nx" → permitido)
const FOREIGN = /\$\s?\d|\bUSD\b|\d+\s*d[ií]as|\bdoh\b|inmoviliz|capital\s+(atrap|deten)|stock\s*usd|d[ií]as\s+(de\s+)?cobertura/i;

const CASES = [
  { name: "ROTACION-peor", q: "el peor SKU por rotación", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /MAK-COMP-AIR/.test(r.text) && /0\.8x/.test(r.text) && r.ev && r.ev.fuente === "skuInventario" },
  { name: "ROTACION-mejor", q: "el mejor SKU por rotación", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /PHI-SHAVER9/.test(r.text) && /11\.2x/.test(r.text) && r.ev && r.ev.metrica === "rotacion" },
  { name: "ROTACION-filtro-Bosch", q: "rotación de Bosch", mk: "inventario",
    check: (r) => r.route === "spine_inv_retrieval" && /BOS-/.test(r.text) && /Bosch/.test(r.text) && r.ev && r.ev.fuente === "skuInventario" },
  { name: "🚨RED-no-leak", q: "el peor SKU por rotación", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && !FOREIGN.test(r.text) },                  // cero número ajeno
  // 2.5d · la atomicidad mezclaba rotación(modelada)+bodega(NO modelada) → AVISA. Modelada bodega, la mezcla deja
  // de ser parcial → la atomicidad queda INERTE para inventario y responde (la transición de la regla madre).
  { name: "atomicidad/transición (OFF→AVISA · ON→inerte responde · 2.5d)", q: "rotación y bodega por SKU", mk: "inventario",
    check: (r) => ADI_INV_BODEGA_ENABLED ? (r.route === "spine_inv_superlative" || r.route === "spine_inv_retrieval") : (/habilitado en esta fase/.test(r.text) && !/\d\.\dx/.test(r.text) && !FOREIGN.test(r.text)) },
  { name: "CTRL-capital (OFF→AVISA / ON→responde · 2.5c)", q: "dónde tengo capital detenido", mk: "inventario",
    check: (r) => ADI_INV_CAPITAL_ENABLED ? (r.route === "spine_inv_superlative") : (/habilitado en esta fase/.test(r.text) && r.route !== "spine_inv_superlative" && r.route !== "spine_inv_retrieval") },
  { name: "CTRL-DOH (OFF→AVISA / ON→responde · 2.5b)", q: "el peor SKU por DOH", mk: "inventario",
    check: (r) => ADI_INV_DOH_ENABLED ? (r.route === "spine_inv_superlative") : (/habilitado en esta fase|inventario/.test(r.text) && r.route !== "spine_inv_superlative") },
  { name: "CTRL-cobertura (OFF→AVISA / ON→responde · 2.5b)", q: "qué SKU tiene peor cobertura", mk: "inventario",
    check: (r) => ADI_INV_DOH_ENABLED ? (r.route === "spine_inv_superlative" || r.route === "spine_inv_retrieval") : (r.route !== "spine_inv_superlative" && r.route !== "spine_inv_retrieval") },
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
fs.writeFileSync(path.join(root, process.argv[2] || "_inv25a_dump.json"), JSON.stringify(out, null, 2));
console.log("█".repeat(72)); console.log("FASE 2.5a · rotación + andamio"); console.log("█".repeat(72));
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
