// Gate de familia inv-qi · oráculo vs modular, por query, con primer-diff.
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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
const lastBubble = () => { const bs = [...document.querySelectorAll("div")].filter(d => d.style && d.style.whiteSpace === "pre-line" && (d.textContent || "").trim()); return bs.length ? bs[bs.length - 1].textContent : ""; };
async function waitAnswer(prev, { quiet = 1500, max = 26000 } = {}) { let last = lastBubble(), lc = Date.now(), st = Date.now(); while (Date.now() - st < max) { await sleep(120); const c = lastBubble(); if (c !== last) { last = c; lc = Date.now(); } else if (c !== prev && c && Date.now() - lc >= quiet) break; } return lastBubble(); }
function modRendered(text) { if (text == null) return null; const t = document.createElement("div"); t.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text })); return t.textContent; }
async function oracle(q, mk = "Inventario") {
  W.localStorage.clear();
  const container = document.getElementById("root"); const r = createRoot(container); r.render(React.createElement(mod.ADISentric)); await sleep(160);
  [...document.querySelectorAll("button")].find(b => new RegExp(mk, "i").test(b.textContent || ""))?.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
  await sleep(900); const hero = lastBubble();
  const input = document.querySelector('input[placeholder="Pregunta a ADI..."]'); const setter = Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set;
  setter.call(input, q); input.dispatchEvent(new W.Event("input", { bubbles: true })); input.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const a = await waitAnswer(hero); r.unmount(); container.innerHTML = ""; return a;
}
const QS = ["dónde tengo capital detenido", "qué productos no rotan", "qué SKUs están atrapando más capital", "qué productos debo liquidar", "dónde tengo riesgo de quiebre", "cuál es la rotación promedio del portafolio"];
let pass = 0, defer = 0, mism = 0;
for (const q of QS) {
  const P = norm(await oracle(q));
  const r = mod.answerADI(q, { activeModule: "inventario" }, { scenario: "bonanza" });
  const M = norm(modRendered(r.text));
  let cat, diff = "";
  if (r.text == null) { cat = "DEFIERE"; defer++; }
  else if (P === M) { cat = "PARIDAD"; pass++; }
  else { cat = "MISMATCH"; mism++; let i = 0; while (i < Math.min(P.length, M.length) && P[i] === M[i]) i++; diff = `\n     @${i} piso«…${P.slice(Math.max(0,i-25),i+55)}»\n         mod «…${M.slice(Math.max(0,i-25),i+55)}»`; }
  console.log(`${cat.padEnd(8)} ${r.route.padEnd(20)} piso ${String(P.length).padStart(4)} / mod ${String(M ? M.length : 0).padStart(4)} «${q}»${diff}`);
}
console.log(`\n── inv-qi: PARIDAD ${pass} · MISMATCH ${mism} · DEFIERE ${defer} (de ${QS.length}) ──`);
process.exit(0);
