// TABLA COMPLETA · ¿el piso reescribe (narrativa) cada ruta que emite narrative_signals?
// Instrumenta la línea del dispatch · narrLen>0 = reescribe · narrLen=0 = NO reescribe.
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";
const root = path.dirname(fileURLToPath(import.meta.url));
let src = fs.readFileSync(path.join(root, "_REFERENCIA_PISO_41cc33d8.jsx"), "utf8");
const ANCHOR = "if (_nl_narrative && _nl_narrative.length > 0) {";
const INSTR = "try{if(globalThis.__TR)globalThis.__TR.push({pt:'narr',q:trimmed,kind:_nl_signals&&_nl_signals.kind,cross:_nl_signals&&_nl_signals.cross_metric,intentType:intent&&intent.type,narrLen:_nl_narrative?_nl_narrative.length:0});}catch(e){}\n            " + ANCHOR;
console.log("anchors:", src.split(ANCHOR).length - 1);
src = src.split(ANCHOR).join(INSTR);
const instrPath = path.join(root, "_oracle", "_mono_narr.jsx");
fs.writeFileSync(instrPath, src);
fs.writeFileSync(path.join(root, "_oracle", "_narr_entry.jsx"), `export { default as ADISentric } from "./_mono_narr.jsx";\n`);

const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "http://localhost/", pretendToBeVisual: true });
const W = dom.window;
globalThis.window = W; globalThis.document = W.document;
try { Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = W.HTMLElement; globalThis.Node = W.Node; globalThis.getComputedStyle = W.getComputedStyle.bind(W);
globalThis.requestAnimationFrame = W.requestAnimationFrame.bind(W); globalThis.cancelAnimationFrame = W.cancelAnimationFrame.bind(W);
globalThis.localStorage = W.localStorage; globalThis.IS_REACT_ACT_ENVIRONMENT = false; console.error = () => {};
const bundlePath = path.join(root, "_oracle", "_mono_narr_bundle.mjs");
await esbuild.build({ entryPoints: [path.join(root, "_oracle", "_narr_entry.jsx")], bundle: true, outfile: bundlePath, format: "esm", platform: "browser", jsx: "automatic", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"], alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "silent" });
const mod = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const lastBubble = () => { const bs = [...document.querySelectorAll("div")].filter(d => d.style && d.style.whiteSpace === "pre-line" && (d.textContent || "").trim()); return bs.length ? bs[bs.length - 1].textContent : ""; };
const ML = { ventas: "Ventas", margenes: "Márgenes", inventario: "Inventario" };
async function trace(q, mk) {
  W.localStorage.clear();
  const container = document.getElementById("root"); const r = createRoot(container); r.render(React.createElement(mod.ADISentric)); await sleep(160);
  [...document.querySelectorAll("button")].find(b => new RegExp(ML[mk]).test(b.textContent || ""))?.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
  await sleep(900); globalThis.__TR = [];
  const input = document.querySelector('input[placeholder="Pregunta a ADI..."]'); const setter = Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set;
  setter.call(input, q); input.dispatchEvent(new W.Event("input", { bubbles: true })); input.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await sleep(4500);
  const tr = globalThis.__TR.slice(); r.unmount(); container.innerHTML = "";
  if (tr.length === 0) { console.log(`[no-signals]  «${q}»`); return; }
  for (const e of tr) console.log(`${e.narrLen > 0 ? "REESCRIBE  " : "no-reescribe"} kind=${String(e.kind || (e.cross ? "cross_metric" : "—")).padEnd(20)} intent=${String(e.intentType).padEnd(22)} narrLen=${e.narrLen}  «${q}»`);
}
const CASES = [
  ["cuál es el SKU con peor rotación", "inventario"], ["peores SKUs por rotación", "inventario"],
  ["cuál es el cliente con peor margen", "margenes"], ["mejores clientes", "ventas"],
  ["cómo está Lider", "ventas"], ["cómo está Falabella", "ventas"],
  ["analizá MAK-COMP-AIR", "inventario"], ["clientes con bajo margen", "margenes"],
  ["qué SKUs están atrapando más capital", "inventario"], ["qué productos debo liquidar", "inventario"],
  ["quién aporta más contribución", "margenes"], ["ranking de clientes por contribución", "margenes"],
];
for (const [q, mk] of CASES) await trace(q, mk);
process.exit(0);
