// === Etapa 5 · Sentrix S2b · LECTURA EJECUTIVA · margen de SKU (descomposición de costo) ===
// Asume flags afuera (régimen + SENTRIX_BOLETA + SENTRIX_READING). Gate: ADI dice POR QUÉ el SKU pierde margen
// (precio = costo + rebate + margen → el driver), datos reales, y el boleta carga reading{} para Sentrix.
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
const run = (q) => mod.answerADI(q, { activeModule: "margenes" }, { scenario: "bonanza" });
const r = run("el peor SKU por margen"); const txt = modR(r.text) || ""; const rd = r.evidence && r.evidence.reading;
const r3 = run("los 3 peores SKU por margen");                       // control: lista, sin colapsar a 1
const rb = run("el mejor SKU de Bosch");                             // control: best/clarify, sin reading
const CASES = [
  { name: "ADI dice el monto + gap vs benchmark (7.9% · 22.2pp · 30.1%)", pass: /MAK-COMP-AIR es el peor en margen: 7\.9%/.test(txt) && /22\.2pp/.test(txt) && /30\.1%/.test(txt) },
  { name: "ADI da la descomposición de costo (86% del precio + rebate 6%)", pass: /costo se lleva el 86% del precio/.test(txt) && /rebate \(6%\)/.test(txt) },
  { name: "ADI contrasta con la familia (resto de Makita 34%)", pass: /resto de Makita \(margen 34%\)/.test(txt) },
  { name: "ADI da la lectura + nombra el driver (costo, no la venta)", pass: /Mi lectura:/.test(txt) && /El problema es el costo, no la venta/.test(txt) },
  { name: "boleta carga reading{} (decomposition + drivers + recomendación)", pass: !!rd && rd.focus === "MAK-COMP-AIR" && rd.decomposition.costo === 86 && rd.drivers.length === 4 && /costeo/.test(rd.recommendation) },
  { name: "lectura data-backed (gap 22.2pp = 30.1 − 7.9)", pass: !!rd && rd.gap === 22.2 && rd.benchmark === 30.1 && rd.pct === 7.9 },
  { name: "control · 'los 3 peores' queda LISTA (sin reading singular)", pass: !(r3.evidence && r3.evidence.reading) },
  { name: "control · best/otro NO recibe reading de peor margen", pass: !(rb.evidence && rb.evidence.reading) },
];
fs.writeFileSync(path.join(root, process.argv[2] || "_s2b_dump.json"), JSON.stringify({ text: txt, reading: rd }, null, 2));
console.log("█".repeat(62)); console.log("Sentrix S2b · lectura ejecutiva (margen de SKU · descomposición)"); console.log("█".repeat(62));
for (const c of CASES) console.log(`${c.pass ? "✅" : "🚨 FALLA"} ${c.name}`);
const fails = CASES.filter(c => !c.pass);
console.log("═".repeat(62)); console.log(`GATES: ${CASES.length - fails.length}/${CASES.length}` + (fails.length ? " · 🚨" : " · TODOS VERDES")); console.log("═".repeat(62));
process.exit(fails.length ? 1 : 0);
