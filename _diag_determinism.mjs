// Determinismo empírico · misma query 2 veces (mounts frescos) → ¿byte-idéntico el texto del piso?
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "http://localhost/", pretendToBeVisual: true });
const W = dom.window;
globalThis.window = W; globalThis.document = W.document;
try { Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = W.HTMLElement; globalThis.Node = W.Node;
globalThis.getComputedStyle = W.getComputedStyle.bind(W);
globalThis.requestAnimationFrame = W.requestAnimationFrame.bind(W);
globalThis.cancelAnimationFrame = W.cancelAnimationFrame.bind(W);
globalThis.localStorage = W.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
console.error = () => {};

const root = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(root, "_oracle_bundle.mjs");
await esbuild.build({ entryPoints: [path.join(root, "_oracle_entry.jsx")], bundle: true, outfile: bundlePath, format: "esm", platform: "browser", jsx: "automatic", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"], alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "silent" });
const mod = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const lastBubble = () => { const bs = [...document.querySelectorAll("div")].filter(d => d.style && d.style.whiteSpace === "pre-line" && (d.textContent || "").trim()); return bs.length ? bs[bs.length - 1].textContent : ""; };
async function waitAnswer(prev, max = 13000) { let last = lastBubble(), lc = Date.now(), st = Date.now(); while (Date.now() - st < max) { await sleep(120); const c = lastBubble(); if (c !== last) { last = c; lc = Date.now(); } else if (c !== prev && c && Date.now() - lc >= 800) break; } return lastBubble(); }
const ML = { ventas: "Ventas", margenes: "Márgenes", inventario: "Inventario" };
async function once(query, moduleKey) {
  W.localStorage.clear();
  const container = document.getElementById("root");
  const r = createRoot(container); r.render(React.createElement(mod.ADISentric)); await sleep(160);
  [...document.querySelectorAll("button")].find(b => new RegExp(ML[moduleKey]).test(b.textContent || ""))?.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
  await sleep(900); const hero = lastBubble();
  const input = document.querySelector('input[placeholder="Pregunta a ADI..."]');
  const setter = Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set;
  setter.call(input, query); input.dispatchEvent(new W.Event("input", { bubbles: true })); input.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const a = await waitAnswer(hero); r.unmount(); container.innerHTML = ""; return a;
}

const cases = [
  ["clientes con bajo margen", "margenes"],   // Capa 2b (erosión) + Capa 3 (suffix)
  ["cómo está el margen", "margenes"],         // Capa 2a (preface) + core + Capa 3
  ["cómo están las ventas", "ventas"],         // core + Capa 3
];
for (const [q, m] of cases) {
  const a = await once(q, m);
  const b = await once(q, m);
  console.log(`\n«${q}»  len ${a.length} vs ${b.length}  →  ${a === b ? "BYTE-IDÉNTICO ✓" : "VARÍA ✗"}`);
  if (a !== b) { for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.log(`  primer diff en char ${i}: «...${a.slice(Math.max(0,i-20), i+20)}» vs «...${b.slice(Math.max(0,i-20), i+20)}»`); break; } }
}
process.exit(0);
