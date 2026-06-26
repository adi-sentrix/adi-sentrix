// === FASE 2.2c-2 · refinamiento de FILTRO ("solo Bosch") + el discriminador ===
// QI-on + la red. Gates: REFINA filtro (re-filtra, mantiene métrica+dim) + decorativo (marca×cliente → AVISA)
// + controles ROJOS (pregunta nueva NO refina · Bosch a secas NO refina · topic-change descarta · sin vista
// fresca → nueva · coord 2.2b gana). La anti-fuga de inventario se prueba en _probe (QI-off). Dump → argv.
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
const hasBosch = (t) => /bosch/i.test(t || "");

const CHAINS = [
  { name: "REFINA-filtro-por-SKU", mk: "ventas", turns: ["ventas por SKU", "solo Bosch"],
    check: (r, t) => r === "qi_retrieval" && /filtrado por: bosch/i.test(t) },          // re-filtra a Bosch
  { name: "REFINA-filtro-por-cliente", mk: "ventas", turns: ["ventas por cliente", "solo Bosch"],
    check: (r, t) => r === "qi_retrieval" && /filtrado por: bosch/i.test(t) },           // re-filtra (clientes con Bosch dominante · reusa el QI filter)
  { name: "CTRL-pregunta-nueva-familia", mk: "ventas", turns: ["ventas por SKU", "ventas de Bosch por familia"],
    check: (r, t) => /por familia/i.test(t) },                                           // autónoma (nombra dimensión)
  { name: "CTRL-Bosch-a-secas-no-refina", mk: "ventas", turns: ["ventas por SKU", "Bosch"],
    check: (r, t) => r !== "qi_retrieval" || !/filtrado por: bosch/i.test(t) },          // NO re-filtra en silencio
  { name: "CTRL-topic-change-descarta", mk: "ventas", turns: ["ventas por cliente de Samsung", "cuál es el margen global", "solo Bosch"],
    check: (r, t) => !/filtrado por: bosch/i.test(t) },                                   // el refinamiento se descartó
  { name: "CTRL-sin-vista-fresca", mk: "ventas", turns: ["solo Bosch"],
    check: (r, t) => r !== "qi_retrieval" },                                             // pregunta nueva
  { name: "CTRL-coord-2.2b-spine-gana", mk: "margenes", turns: ["el mejor SKU de Bosch", "margen"],
    check: (r, t) => r === "spine_filter_superlative" && /bos-/i.test(t) },              // 2.2b resuelve el ACLARAR
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
fs.writeFileSync(path.join(root, process.argv[2] || "_mt2c2_dump.json"), JSON.stringify(out, null, 2));
console.log("█".repeat(76)); console.log("FASE 2.2c-2 · refinamiento de FILTRO + el discriminador"); console.log("█".repeat(76));
for (const r of rows) console.log(`\n${r.pass ? "✅" : "🚨 FALLA"} ${r.name}  → ${r.route}\n   «${r.q}»  ${r.head}`);
const fails = rows.filter(r => !r.pass);
console.log("\n" + "═".repeat(76));
console.log(`GATES: ${rows.length - fails.length}/${rows.length}` + (fails.length ? ` · 🚨 ${fails.map(f => f.name).join(", ")}` : " · TODOS VERDES"));
console.log("═".repeat(76));
process.exit(fails.length ? 1 : 0);
