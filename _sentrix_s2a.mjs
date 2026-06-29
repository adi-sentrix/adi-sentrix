// === Etapa 5 · Sentrix S2a · LECTURA EJECUTIVA · capital inmovilizado por bodega ===
// Asume flags afuera (régimen + SENTRIX_BOLETA + SENTRIX_READING). Gate: ADI DICE la lectura ejecutiva
// (reframe + drivers + recomendación + SKU sensible, datos reales) y el boleta carga reading{} para Sentrix.
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
function modR(t) { if (t == null) return null; const d = document.createElement("div"); d.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text: t })); return d.textContent; }
const r = mod.answerADI("qué bodega está más complicada", { activeModule: "inventario" }, { scenario: "bonanza" });
const txt = modR(r.text) || ""; const rd = r.evidence && r.evidence.reading;
const CASES = [
  { name: "ADI dice el reframe (concentrado y lento)", pass: /concentrado y lento/.test(txt) },
  { name: "ADI dice el monto + % reales (Valparaíso $24.8K 44%)", pass: /Valparaíso/.test(txt) && /\$24\.8K/.test(txt) && /44%/.test(txt) },
  { name: "ADI da los drivers (días de cobertura vs benchmark)", pass: /140 días de cobertura/.test(txt) && /benchmark/.test(txt) },
  { name: "ADI da la lectura/recomendación", pass: /Mi lectura:/.test(txt) && /transferencia/.test(txt) },
  { name: "ADI nombra el SKU más sensible", pass: /LG-DRYER8KG/.test(txt) },
  { name: "boleta carga reading{} (foco/drivers/recomendación/sensible)", pass: !!rd && rd.focus === "Valparaíso" && rd.drivers.length === 4 && rd.sensitive === "LG-DRYER8KG" && /transferencia/.test(rd.recommendation) },
  { name: "lectura data-backed (44% = $24.8K / $55.8K)", pass: !!rd && rd.pct === 44 && rd.montoFmt === "$24.8K" && rd.totalInmovFmt === "$55.8K" },
];
fs.writeFileSync(path.join(root, process.argv[2] || "_s2a_dump.json"), JSON.stringify({ text: txt, reading: rd }, null, 2));
console.log("█".repeat(62)); console.log("Sentrix S2a · lectura ejecutiva (capital por bodega)"); console.log("█".repeat(62));
for (const c of CASES) console.log(`${c.pass ? "✅" : "🚨 FALLA"} ${c.name}`);
const fails = CASES.filter(c => !c.pass);
console.log("═".repeat(62)); console.log(`GATES: ${CASES.length - fails.length}/${CASES.length}` + (fails.length ? " · 🚨" : " · TODOS VERDES")); console.log("═".repeat(62));
process.exit(fails.length ? 1 : 0);
