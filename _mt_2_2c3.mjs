// === FASE 2.2c-3 · refinamiento de CORTE ("los tres peores"/"el top 3") + anti-fuga ===
// Combinado (QI + MT_SAFETY + la red). Gates: CORTE (top/bottom N, mantiene métrica+dim+filtro) + cadena
// c-1→c-3 + 🚨 RED anti-fuga ("SKUs por rotación" → "los tres peores" → AVISA cero número, ambos turnos) +
// controles ROJOS (pregunta nueva NO corta · vago NO corta · topic-change descarta · sin vista → nueva ·
// coord 2.2b gana). Dump → argv. Requiere QI + REFINE_CUT + REFINE_METRIC + MT_SAFETY + TOPIC + spine + SPINE_FOLLOWUP.
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
// inventario-ESPECÍFICO (NO el "$" comercial del corte "Los 3 mejores: Falabella $19.4M", NO "Fase 2.5")
const INV = /inmoviliz|capital\s+(atrapad|deten)|rotaci[oó]n\s+[\d.]|\b\d+(?:[.,]\d+)?x\b|\bdoh\b|d[ií]as\s+(de\s+)?cobertura|d[ií]as\s+sin\s+vent|stock\s*usd|inventario\s+f[ií]sico|del\s+inventario|fuera\s+de\s+rango/i;

const CHAINS = [
  { name: "CORTE-los-tres-peores", mk: "ventas", turns: ["ventas por cliente de Samsung", "los tres peores"],
    check: (s) => { const t = s[1]; return t.route === "qi_retrieval_cut" && /3 peores en ventas de samsung/i.test(t.text); } },
  { name: "CORTE-el-top-3", mk: "ventas", turns: ["ventas por cliente de Samsung", "el top 3"],
    check: (s) => { const t = s[1]; return t.route === "qi_retrieval_cut" && /3 mejores en ventas de samsung/i.test(t.text); } },
  { name: "CADENA-c1-c3", mk: "ventas", turns: ["ventas por cliente de Samsung", "y por margen", "los tres peores"],
    check: (s) => { const t = s[2]; return t.route === "qi_retrieval_cut" && /3 peores en margen de samsung/i.test(t.text); } },
  // 🚨 AMBOS turnos cero número de inventario. Con TODO inventario modelado (2.5d), la prueba-de-bloqueo pasa de
  // "métrica no modelada" a "cruce NO SOPORTADO por el dato" (la regla madre transformada · rotación por canal).
  { name: "RED-anti-fuga", mk: "inventario", turns: ["rotación por canal", "los tres peores"],
    check: (s) => !INV.test(s[0].text || "") && !INV.test(s[1].text || "") },
  { name: "CTRL-pregunta-nueva", mk: "ventas", turns: ["ventas por cliente de Samsung", "los tres peores SKU de Bosch"],
    check: (s) => s[1].route !== "qi_retrieval_cut" },                          // nombra dim+filtro → autónoma
  { name: "CTRL-vago-dame-menos", mk: "ventas", turns: ["ventas por cliente de Samsung", "dame menos"],
    check: (s) => s[1].route !== "qi_retrieval_cut" },                          // sin N → no corta
  { name: "CTRL-topic-change", mk: "ventas", turns: ["ventas por cliente de Samsung", "cuál es el margen global", "los tres peores"],
    check: (s) => s[2].route !== "qi_retrieval_cut" },                          // descartado
  { name: "CTRL-sin-vista-fresca", mk: "ventas", turns: ["los tres peores"],
    check: (s) => s[0].route !== "qi_retrieval_cut" },                          // pregunta nueva
  { name: "CTRL-coord-2.2b", mk: "margenes", turns: ["el mejor SKU de Bosch", "margen"],
    check: (s) => s[1].route === "spine_filter_superlative" },                  // 2.2b gana
];

const out = {}; const rows = [];
for (const ch of CHAINS) {
  let ctx = { activeModule: ch.mk }; const seq = [];
  for (const q of ch.turns) { const res = mod.answerADI(q, ctx, { scenario: "bonanza" }); seq.push({ q, route: res.route, text: modR(res.text) }); ctx = res.context || ctx; }
  out[ch.name] = seq;
  const pass = ch.check(seq);
  const last = seq[seq.length - 1];
  rows.push({ name: ch.name, q: last.q, route: last.route, pass, seq });
}
fs.writeFileSync(path.join(root, process.argv[2] || "_mt2c3_dump.json"), JSON.stringify(out, null, 2));
console.log("█".repeat(76)); console.log("FASE 2.2c-3 · corte + anti-fuga"); console.log("█".repeat(76));
for (const r of rows) {
  console.log(`\n${r.pass ? "✅" : "🚨 FALLA"} ${r.name}  → ${r.route}`);
  r.seq.forEach((s, i) => console.log(`   T${i + 1} (${s.route}) «${s.q}» → ${norm(s.text || "(null)").slice(0, 90)}`));
}
const fails = rows.filter(r => !r.pass);
console.log("\n" + "═".repeat(76));
console.log(`GATES: ${rows.length - fails.length}/${rows.length}` + (fails.length ? ` · 🚨 ${fails.map(f => f.name).join(", ")}` : " · TODOS VERDES"));
console.log("═".repeat(76));
process.exit(fails.length ? 1 : 0);
