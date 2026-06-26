// === FASE 2.2a-2 · topic-change cleanup (A) + cobertura stock elíptico (B) ===
// Corre las cadenas a través del MODULAR (hila ctx). Gates: A1 global limpia (T2 NO es client_metric_followup,
// da margen global) · A2 anafórico preserva (T2 client_metric_followup, da el cliente) · A3 ambiguo preserva ·
// B anti-fuga stock (T2 AVISA, cero número). Dump → argv para shadow-diff. Correr con QI+MT+los 2 sub-flags ON.
import { JSDOM } from "jsdom"; import esbuild from "esbuild"; import { fileURLToPath, pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "http://localhost/", pretendToBeVisual: true });
const W = dom.window;
globalThis.window = W; globalThis.document = W.document;
try { Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = W.HTMLElement; globalThis.Node = W.Node; globalThis.getComputedStyle = W.getComputedStyle.bind(W);
globalThis.requestAnimationFrame = W.requestAnimationFrame.bind(W); globalThis.cancelAnimationFrame = W.cancelAnimationFrame.bind(W);
globalThis.localStorage = W.localStorage; globalThis.IS_REACT_ACT_ENVIRONMENT = false; console.error = () => {};
const root = path.dirname(fileURLToPath(import.meta.url)); const bundlePath = path.join(root, "_oracle_bundle.mjs");
await esbuild.build({ entryPoints: [path.join(root, "_oracle_entry.jsx")], bundle: true, outfile: bundlePath, format: "esm", platform: "browser", jsx: "automatic", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"], alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "silent" });
const mod = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default; const { renderToStaticMarkup } = await import("react-dom/server");
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
function modRendered(text) { if (text == null) return null; const t = document.createElement("div"); t.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text })); return t.textContent; }
const INV_NUM = /inmoviliz|capital\s+(atrapad|deten)|rotaci[oó]n\s+[\d.]|\b\d+(?:[.,]\d+)?x\b|\bdoh\b|d[ií]as\s+(de\s+)?cobertura|d[ií]as\s+sin\s+vent|stock\s*usd|cobertura\s+(promedio\s+)?\d|del\s+inventario|fuera\s+de\s+rango/i;

// kind: "clean" (T2 NO debe ser client_metric_followup) · "preserve" (T2 SÍ client_metric_followup) · "avisa" (T2 cero inv)
const CHAINS = [
  { name: "A1-global-margen", mk: "ventas", turns: ["cómo está Falabella", "cuál es el margen global"], kind: "clean" },
  { name: "A1-general-cartera", mk: "ventas", turns: ["cómo está Lider", "cuál es el margen general de la cartera"], kind: "clean" },
  { name: "A1-ventas-global", mk: "ventas", turns: ["cómo está Falabella", "cuáles son las ventas globales"], kind: "clean" },
  { name: "A2-anaforico-margen", mk: "ventas", turns: ["cómo está Falabella", "y su margen"], kind: "preserve" },
  { name: "A2-anaforico-carga", mk: "ventas", turns: ["cómo está Falabella", "y la carga"], kind: "preserve" },
  { name: "A3-ambiguo-margen", mk: "ventas", turns: ["cómo está Falabella", "cuál es el margen"], kind: "preserve" },
  { name: "B-stock-masStock", mk: "inventario", turns: ["qué SKUs tienen capital atrapado", "el que más stock"], kind: "avisa" },
  { name: "B-stock-eseStock", mk: "margenes", turns: ["cómo está Falabella", "y cómo está ese stock?"], kind: "avisa" },
];

const out = {}; const rows = [];
for (const ch of CHAINS) {
  let ctx = { activeModule: ch.mk }; const seq = [];
  for (let t = 0; t < ch.turns.length; t++) {
    const res = mod.answerADI(ch.turns[t], ctx, { scenario: "bonanza" });
    const text = res.text == null ? null : modRendered(res.text);
    seq.push({ q: ch.turns[t], route: res.route, text });
    ctx = res.context || ctx;
  }
  out[ch.name] = seq;
  const t2 = seq[seq.length - 1];
  let pass, detail;
  if (ch.kind === "clean") { pass = t2.route !== "client_metric_followup" && /25\.6%|margen (general|global)/i.test(t2.text || ""); detail = "margen global (no follow-up del cliente)"; }
  else if (ch.kind === "preserve") { pass = t2.route === "client_metric_followup"; detail = "follow-up del cliente preservado"; }
  else { pass = !INV_NUM.test(t2.text || ""); detail = "AVISA cero número"; }
  rows.push({ name: ch.name, kind: ch.kind, q: t2.q, route: t2.route, pass, detail, head: norm(t2.text || "(null)").slice(0, 90) });
}
const outFile = process.argv[2] || "_mt2_dump.json";
fs.writeFileSync(path.join(root, outFile), JSON.stringify(out, null, 2));

console.log("█".repeat(76)); console.log(`FASE 2.2a-2 · topic-change + stock · dump → ${outFile}`); console.log("█".repeat(76));
for (const r of rows) {
  console.log(`\n${r.pass ? "✅" : "🚨 FALLA"} [${r.kind}] ${r.name}  → ${r.route}`);
  console.log(`   «${r.q}»  (${r.detail})`);
  console.log(`   → ${r.head}`);
}
const fails = rows.filter(r => !r.pass);
console.log("\n" + "═".repeat(76));
console.log(`GATES: ${rows.length - fails.length}/${rows.length} verde` + (fails.length ? ` · 🚨 FALLAS: ${fails.map(f => f.name).join(", ")}` : " · TODOS VERDES"));
console.log("═".repeat(76));
process.exit(fails.length ? 1 : 0);
