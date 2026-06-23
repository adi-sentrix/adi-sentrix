// Piece 3 · controles #26-28 (sin filtro) byte-idénticos al piso · flag ON → undefined → intactos.
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "http://localhost/", pretendToBeVisual: true });
const W = dom.window;
globalThis.window = W; globalThis.document = W.document;
try { Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = W.HTMLElement; globalThis.Node = W.Node; globalThis.getComputedStyle = W.getComputedStyle.bind(W);
globalThis.requestAnimationFrame = W.requestAnimationFrame.bind(W); globalThis.cancelAnimationFrame = W.cancelAnimationFrame.bind(W);
globalThis.localStorage = W.localStorage; globalThis.IS_REACT_ACT_ENVIRONMENT = false; console.error = () => {};
const root = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(root, "_oracle_bundle.mjs");
await esbuild.build({ entryPoints: [path.join(root, "_oracle_entry.jsx")], bundle: true, outfile: bundlePath, format: "esm", platform: "browser", jsx: "automatic", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"], alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "silent" });
const mod = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { renderToStaticMarkup } = await import("react-dom/server");
const { answerADI } = await import(pathToFileURL(path.join(root, "src/adi/answerADI.js")).href);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
const lastBubble = () => { const bs = [...document.querySelectorAll("div")].filter(d => d.style && d.style.whiteSpace === "pre-line" && (d.textContent || "").trim()); return bs.length ? bs[bs.length - 1].textContent : ""; };
async function waitAnswer(prev, { quiet = 1300, max = 22000 } = {}) { let last = lastBubble(), lc = Date.now(), st = Date.now(); while (Date.now() - st < max) { await sleep(110); const c = lastBubble(); if (c !== last) { last = c; lc = Date.now(); } else if (c !== prev && c && Date.now() - lc >= quiet) break; } return lastBubble(); }
function modR(text) { if (text == null) return null; const t = document.createElement("div"); t.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text })); return t.textContent; }
async function oracle(q, mk) {
  W.localStorage.clear();
  const c = document.getElementById("root"); const r = createRoot(c); r.render(React.createElement(mod.ADISentric)); await sleep(150);
  [...document.querySelectorAll("button")].find(b => new RegExp(mk, "i").test(b.textContent || ""))?.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
  await sleep(850); const hero = lastBubble();
  const input = document.querySelector('input[placeholder="Pregunta a ADI..."]'); const setter = Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set;
  setter.call(input, q); input.dispatchEvent(new W.Event("input", { bubbles: true })); input.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const a = await waitAnswer(hero); r.unmount(); c.innerHTML = ""; return a;
}
const CASES = [
  [26, "margen por marca", "Márgenes"],
  [27, "top 3 familias por contribución", "Márgenes"],
  [28, "ventas y margen por cliente", "Márgenes"],
];
let pass = 0;
for (const [n, q, mk] of CASES) {
  const O = norm(await oracle(q, mk));
  const M = norm(modR(answerADI(q, { activeModule: mk }, { scenario: "bonanza" }).text));
  const ok = O === M;
  if (ok) pass++;
  console.log(`${ok ? "✓ byte-idéntico" : "✗ MISMATCH"} #${n} «${q}» · piso ${O.length}/mod ${M.length}`);
  if (!ok) { let i = 0; while (i < Math.min(O.length, M.length) && O[i] === M[i]) i++; console.log(`   @${i} piso«…${O.slice(Math.max(0,i-25),i+50)}»\n        mod «…${M.slice(Math.max(0,i-25),i+50)}»`); }
}
console.log(`\n── controles #26-28 (flag ON): ${pass}/3 byte-idénticos ──`);
process.exit(pass === 3 ? 0 : 1);
