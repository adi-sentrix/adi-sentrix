// === FASE 2.2b · follow-ups del spine (ACLARAR + combinado) + los 3 candados (controles ROJOS) ===
// Corre cadenas a través del MODULAR (hila ctx). Gates: ACLARAR resuelto · combinado resuelto · y los 3
// controles (margen sin pendiente → pregunta nueva · topic-change descarta · otra marca → pregunta nueva).
// Dump → argv para shadow-diff. Correr con los flags spine (CORE+FILTER+CLARIFY+COMBINED) + SPINE_FOLLOWUP ON.
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
const INV_NUM = /inmoviliz|capital\s+(atrapad|deten)|rotaci[oó]n\s+[\d.]|\b\d+(?:[.,]\d+)?x\b|\bdoh\b|d[ií]as\s+(de\s+)?cobertura|d[ií]as\s+sin\s+vent|stock\s*usd|cobertura\s+(promedio\s+)?\d|del\s+inventario|fuera\s+de\s+rango/i;

// check(lastRoute, lastText) → bool
const CHAINS = [
  { name: "ACLARAR-bosch-margen", mk: "margenes", turns: ["el mejor SKU de Bosch", "margen"],
    check: (r, t) => r === "spine_filter_superlative" && /bos-/i.test(t) },
  { name: "ACLARAR-lg-contribucion", mk: "margenes", turns: ["el peor SKU de LG", "contribución"],
    check: (r, t) => r === "spine_filter_superlative" && /lg-/i.test(t) },
  { name: "combinado-detalle-cliente", mk: "ventas", turns: ["ventas de Samsung en Falabella", "el detalle de Falabella"],
    check: (r, t) => r === "client_dive" && /falabella/i.test(t) },
  { name: "combinado-marca-sola", mk: "margenes", turns: ["margen de Bosch para Lider", "Bosch sola"],
    check: (r, t) => /bosch/i.test(t) && !INV_NUM.test(t) },   // comercial · cero inventario
  { name: "CTRL-margen-sin-pendiente", mk: "margenes", turns: ["margen"],
    check: (r, t) => r !== "spine_filter_superlative" && r !== "spine_filter_table" },   // pregunta nueva
  { name: "CTRL-topic-change-descarta", mk: "margenes", turns: ["el mejor SKU de Bosch", "cómo va el negocio", "margen"],
    check: (r, t) => !(r === "spine_filter_superlative" && /bos-/i.test(t)) },   // NO resucita el ACLARAR de Bosch
  { name: "CTRL-otra-marca", mk: "margenes", turns: ["el mejor SKU de Bosch", "el mejor SKU de Samsung"],
    check: (r, t) => r === "spine_filter_clarify" && /samsung/i.test(t) },       // ACLARA Samsung (pregunta nueva)
  { name: "CTRL-combinado-ambiguo", mk: "ventas", turns: ["ventas de Samsung en Falabella", "dale"],
    check: (r, t) => r !== "client_dive" },                                       // no resuelve la elección
];

const out = {}; const rows = [];
for (const ch of CHAINS) {
  let ctx = { activeModule: ch.mk }; const seq = [];
  for (const q of ch.turns) { const res = mod.answerADI(q, ctx, { scenario: "bonanza" }); seq.push({ q, route: res.route, text: modR(res.text) }); ctx = res.context || ctx; }
  out[ch.name] = seq;
  const last = seq[seq.length - 1];
  const pass = ch.check(last.route, last.text || "");
  rows.push({ name: ch.name, q: last.q, route: last.route, pass, head: norm(last.text || "(null)").slice(0, 95) });
}
fs.writeFileSync(path.join(root, process.argv[2] || "_mt2b_dump.json"), JSON.stringify(out, null, 2));
console.log("█".repeat(76)); console.log("FASE 2.2b · ACLARAR + combinado + 3 candados"); console.log("█".repeat(76));
for (const r of rows) { console.log(`\n${r.pass ? "✅" : "🚨 FALLA"} ${r.name}  → ${r.route}\n   «${r.q}»  ${r.head}`); }
const fails = rows.filter(r => !r.pass);
console.log("\n" + "═".repeat(76));
console.log(`GATES: ${rows.length - fails.length}/${rows.length}` + (fails.length ? ` · 🚨 ${fails.map(f => f.name).join(", ")}` : " · TODOS VERDES"));
console.log("═".repeat(76));
process.exit(fails.length ? 1 : 0);
