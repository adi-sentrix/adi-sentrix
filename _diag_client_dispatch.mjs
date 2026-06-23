// ¿Por qué el client_dive del piso NO expone narrative_signals? ¿Estático o context-dependent?
// Instrumenta FASE 5: por query loguea si lastComposerResponse tiene narrative_signals + sus keys.
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";
const root = path.dirname(fileURLToPath(import.meta.url));
let src = fs.readFileSync(path.join(root, "_REFERENCIA_PISO_41cc33d8.jsx"), "utf8");
const ANCHOR = "let narrativeLayerHandled = false;";
const INSTR = ANCHOR + "\ntry{if(globalThis.__TR)globalThis.__TR.push({q:trimmed,hasLC:!!lastComposerResponse,hasSig:!!(lastComposerResponse&&lastComposerResponse.narrative_signals),sigKind:(lastComposerResponse&&lastComposerResponse.narrative_signals&&lastComposerResponse.narrative_signals.kind)||null,lcKeys:lastComposerResponse?Object.keys(lastComposerResponse).slice(0,8).join(','):null,derived:derivedIntentType,intentType:intent&&intent.type});}catch(e){}";
console.log("anchors:", src.split(ANCHOR).length - 1);
src = src.split(ANCHOR).join(INSTR);
fs.writeFileSync(path.join(root, "_oracle", "_mono_cd.jsx"), src);
fs.writeFileSync(path.join(root, "_oracle", "_cd_entry.jsx"), `export { default as ADISentric } from "./_mono_cd.jsx";\n`);
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "http://localhost/", pretendToBeVisual: true });
const W = dom.window;
globalThis.window = W; globalThis.document = W.document;
try { Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = W.HTMLElement; globalThis.Node = W.Node; globalThis.getComputedStyle = W.getComputedStyle.bind(W);
globalThis.requestAnimationFrame = W.requestAnimationFrame.bind(W); globalThis.cancelAnimationFrame = W.cancelAnimationFrame.bind(W);
globalThis.localStorage = W.localStorage; globalThis.IS_REACT_ACT_ENVIRONMENT = false; console.error = () => {};
const bundlePath = path.join(root, "_oracle", "_mono_cd_bundle.mjs");
await esbuild.build({ entryPoints: [path.join(root, "_oracle", "_cd_entry.jsx")], bundle: true, outfile: bundlePath, format: "esm", platform: "browser", jsx: "automatic", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"], alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "silent" });
const mod = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const lastBubble = () => { const bs = [...document.querySelectorAll("div")].filter(d => d.style && d.style.whiteSpace === "pre-line" && (d.textContent || "").trim()); return bs.length ? bs[bs.length - 1].textContent : ""; };
async function type1(input, setter, q) { setter.call(input, q); input.dispatchEvent(new W.Event("input", { bubbles: true })); input.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await sleep(4000); }
async function session(label, queries) {
  W.localStorage.clear();
  const container = document.getElementById("root"); const r = createRoot(container); r.render(React.createElement(mod.ADISentric)); await sleep(160);
  [...document.querySelectorAll("button")].find(b => /Ventas/.test(b.textContent || ""))?.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
  await sleep(900);
  const input = document.querySelector('input[placeholder="Pregunta a ADI..."]'); const setter = Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set;
  for (let i = 0; i < queries.length; i++) {
    if (i === queries.length - 1) globalThis.__TR = [];
    await type1(input, setter, queries[i]);
  }
  const tr = globalThis.__TR.slice(); r.unmount(); container.innerHTML = "";
  console.log(`\n── ${label} ──`);
  for (const e of tr) console.log(`  hasSignals=${e.hasSig?"SÍ":"no "} kind=${String(e.sigKind).padEnd(20)} intent=${String(e.intentType).padEnd(20)} derived=${e.derived} · lcKeys=[${e.lcKeys}]`);
}
await session("client_dive SINGLE-TURN: «cómo está Lider»", ["cómo está Lider"]);
await session("client_dive MULTI-TURNO: ventas → «cómo está Lider»", ["cómo están las ventas", "cómo está Lider"]);
await session("CONTROL ranking SINGLE: «cuál es el SKU con peor rotación»", ["cuál es el SKU con peor rotación"]);
process.exit(0);
