// === FASE 2.5d · bodega (dimensión) + LA REGLA MADRE (cierra la Etapa 3) ===
// Asume flags afuera (bodega + capital + inmovilizado + rotación + DOH + QI + spine + evidence). Gates: bodega
// RESPONDE (capital/rotación por bodega · "complicada"=inmovilizado · filtro) + 🚨 REGLA MADRE (lo NO soportado
// AVISA · inventario disponible ≠ "responde cualquier cosa") + comercial/otras intactas. Dump → argv (shadow).
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
const isResp = (r) => r.route === "spine_inv_superlative" || r.route === "spine_inv_retrieval";
const AVISA = (r) => /habilitado en esta fase|no tengo|no reconozco|no cruzo|no responder/i.test(r.text) && !isResp(r);
const NUM = /\$\s?\d|\d+\.\dx|\b\d+d\b|\d+\s*d[ií]as/;   // cualquier número de inventario

const CASES = [
  // bodega como DIMENSIÓN + filtro
  { name: "capital por bodega (dim)", q: "capital por bodega", mk: "inventario",
    check: (r) => isResp(r) && /[Bb]odega/.test(r.text) && r.ev && r.ev.dimension === "sucursal" },
  { name: "qué bodega complicada (=inmovilizado)", q: "qué bodega está más complicada", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /Valparaíso/.test(r.text) && /\$24\.8K/.test(r.text) && r.ev && /inmovilizado/.test(r.ev.query_plan.operacion) },
  { name: "rotación por bodega (dim)", q: "rotación por bodega", mk: "inventario",
    check: (r) => isResp(r) && r.ev && r.ev.dimension === "sucursal" },
  { name: "capital de Antofagasta (filtro)", q: "capital de Antofagasta", mk: "inventario",
    check: (r) => isResp(r) && /MAK/.test(r.text) },
  // 🚨 LA REGLA MADRE · lo NO soportado por el dato → AVISA honesto, cero número inventado
  { name: "🚨REGLA-rotación por canal", q: "rotación por canal", mk: "inventario",
    check: (r) => AVISA(r) && !NUM.test(r.text) },
  { name: "🚨REGLA-rotación por marca", q: "rotación por marca", mk: "inventario",
    check: (r) => AVISA(r) && !NUM.test(r.text) },
  { name: "🚨REGLA-inventario por cliente", q: "inventario por cliente", mk: "inventario",
    check: (r) => AVISA(r) },
  { name: "🚨REGLA-ventas por bodega", q: "ventas por bodega", mk: "ventas",
    check: (r) => AVISA(r) || r.route === "global_honest_fallback" },
  // las métricas modeladas siguen respondiendo · comercial intacto
  { name: "CTRL-rotación", q: "el peor SKU por rotación", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /MAK-COMP-AIR/.test(r.text) && /0\.8x/.test(r.text) },
  { name: "CTRL-capital amplio", q: "qué SKU tiene más capital", mk: "inventario",
    check: (r) => r.route === "spine_inv_superlative" && /SAM-REF500L/.test(r.text) },
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
fs.writeFileSync(path.join(root, process.argv[2] || "_inv25d_dump.json"), JSON.stringify(out, null, 2));
console.log("█".repeat(72)); console.log("FASE 2.5d · bodega + la regla madre"); console.log("█".repeat(72));
for (const r of rows) {
  console.log(`\n${r.pass ? "✅" : "🚨 FALLA"} ${r.name}  → ${r.route}`);
  console.log(`   ${norm(r.text || "(null)").slice(0, 95)}`);
}
const fails = rows.filter(r => !r.pass);
console.log("\n" + "═".repeat(72));
console.log(`GATES: ${rows.length - fails.length}/${rows.length}` + (fails.length ? ` · 🚨 ${fails.map(f => f.name).join(", ")}` : " · TODOS VERDES"));
console.log("═".repeat(72));
process.exit(fails.length ? 1 : 0);
