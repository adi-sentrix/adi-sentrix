// === FASE 2.5c-2 · inmovilizado fino (Def2) ===
// Asume flags afuera (capital + inmovilizado + rotación + DOH + QI + spine + evidence). Gates: la DISTINCIÓN
// (capital amplio SAM-REF vs inmovilizado Def2 LG-DRYER) · 🚨 RED (SAM-REF NO aparece en inmovilizado · filtro
// mordió) · evidence refleja Def2 · capital amplio/comercial intactos · bodega AVISA. Dump → argv (shadow).
import { JSDOM } from "jsdom"; import esbuild from "esbuild"; import { fileURLToPath, pathToFileURL } from "url"; import path from "path"; import fs from "fs";
import { ADI_INV_BODEGA_ENABLED } from "./src/config/voiceFlags.js";   // 2.5d · bodega modelable → su control flag-aware (la atomicidad inerte / "complicada" responde)
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
const FOREIGN = /\d+\.\dx|\b\d+\s*d\b|\bdoh\b|rotaci[oó]n\s+[\d.]/i;  // rotación/DOH ($ de capital permitido)

const CASES = [
  // 🎯 LA DISTINCIÓN lado a lado
  { name: "🎯 capital AMPLIO (todos)", q: "qué SKU tiene más capital", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /SAM-REF500L/.test(r.text) && /\$18\.6K/.test(r.text) },
  { name: "🎯 capital INMOVILIZADO (Def2)", q: "qué SKU tiene más capital inmovilizado", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /LG-DRYER8KG/.test(r.text) && /\$13\.6K/.test(r.text) && r.ev && /inmovilizado/.test(r.ev.query_plan.operacion) },
  // 🚨 RED · el filtro mordió: SAM-REF (Activo) NO aparece en inmovilizado + cero rotación/DOH
  { name: "🚨RED-filtro-mordió (SAM-REF fuera)", q: "qué SKU tiene más capital inmovilizado", mk: "inventario",
    check: (r) => !/SAM-REF500L/.test(r.text) && !FOREIGN.test(r.text) },
  { name: "detenido → Def2 (LG-DRYER)", q: "dónde tengo capital detenido", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /LG-DRYER8KG/.test(r.text) && !/SAM-REF500L/.test(r.text) },
  { name: "evidence refleja Def2", q: "qué SKU tiene más capital inmovilizado", mk: "inventario",
    check: (r) => r.ev && /inmovilizado/.test(r.ev.query_plan.operacion) && r.ev.filtros && /Def2/.test(JSON.stringify(r.ev.filtros)) && /Def2/.test(r.ev.formula) },
  // capital AMPLIO intacto (sin "inmovilizado" → todos · evidence SIN Def2)
  { name: "capital de LG → amplio (sin Def2)", q: "capital de LG", mk: "inventario",
    check: (r) => r.route === "spine_inv_retrieval" && r.ev && !/Def2/.test(JSON.stringify(r.ev.filtros || {})) && !/Def2/.test(r.ev.formula) },
  // otras métricas intactas
  { name: "CTRL-rotación", q: "el peor SKU por rotación", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /MAK-COMP-AIR/.test(r.text) && /0\.8x/.test(r.text) },
  { name: "CTRL-DOH", q: "qué SKU tiene peor DOH", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /190d/.test(r.text) },
  { name: "CTRL-bodega (OFF→AVISA / ON→responde · 2.5d)", q: "qué bodega está más complicada", mk: "inventario",
    check: (r) => ADI_INV_BODEGA_ENABLED ? (r.route === "spine_inv_superlative") : (r.route !== "spine_inv_superlative" && r.route !== "spine_inv_retrieval") },
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
fs.writeFileSync(path.join(root, process.argv[2] || "_inv25c2_dump.json"), JSON.stringify(out, null, 2));
console.log("█".repeat(72)); console.log("FASE 2.5c-2 · inmovilizado Def2 · la distinción"); console.log("█".repeat(72));
for (const r of rows) {
  console.log(`\n${r.pass ? "✅" : "🚨 FALLA"} ${r.name}  → ${r.route}`);
  console.log(`   ${norm(r.text || "(null)").slice(0, 95)}`);
  if (r.ev && r.ev.metrica) console.log(`   ev: op=${r.ev.query_plan && r.ev.query_plan.operacion} · filtros=${JSON.stringify(r.ev.filtros)}`);
}
const fails = rows.filter(r => !r.pass);
console.log("\n" + "═".repeat(72));
console.log(`GATES: ${rows.length - fails.length}/${rows.length}` + (fails.length ? ` · 🚨 ${fails.map(f => f.name).join(", ")}` : " · TODOS VERDES"));
console.log("═".repeat(72));
process.exit(fails.length ? 1 : 0);
