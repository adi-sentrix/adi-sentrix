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
const lastBubble = () => { const bs = [...document.querySelectorAll("div")].filter(d => d.style && d.style.whiteSpace === "pre-line" && (d.textContent || "").trim()); return bs.length ? bs[bs.length - 1].textContent : ""; };
async function waitAnswer(prev) { let last = lastBubble(), lc = Date.now(), st = Date.now(); while (Date.now() - st < 12000) { await sleep(120); const c = lastBubble(); if (c !== last) { last = c; lc = Date.now(); } else if (c !== prev && c && Date.now() - lc >= 800) break; } return lastBubble(); }
function modRendered(text) { const t = document.createElement("div"); t.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text })); return t.textContent; }
async function go(query, moduleKey) {
  W.localStorage.clear();
  const container = document.getElementById("root"); const r = createRoot(container); r.render(React.createElement(mod.ADISentric)); await sleep(160);
  [...document.querySelectorAll("button")].find(b => new RegExp(moduleKey).test(b.textContent || ""))?.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
  await sleep(900); const hero = lastBubble();
  const input = document.querySelector('input[placeholder="Pregunta a ADI..."]'); const setter = Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set;
  setter.call(input, query); input.dispatchEvent(new W.Event("input", { bubbles: true })); input.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const piso = await waitAnswer(hero); r.unmount(); container.innerHTML = "";
  const m = mod.answerADI(query, { activeModule: "margenes" }, { scenario: "bonanza" });
  const modTxt = modRendered(m.text);
  const N = s => s.replace(/\s+/g, " ").trim();
  const p = N(piso), mm = N(modTxt);
  console.log(`«${query}» piso ${p.length} · mod ${mm.length}`);
  console.log("modular tiene 'Confianza determinística'?:", mm.includes("Confianza deterministica") || mm.includes("Confianza determinística"));
  console.log("piso    tiene 'Confianza determinística'?:", p.includes("Confianza deterministica") || p.includes("Confianza determinística"));
  let i = 0; while (i < Math.min(p.length, mm.length) && p[i] === mm[i]) i++;
  console.log("primer diff en char", i);
  console.log("  piso: «..." + p.slice(Math.max(0, i - 25), i + 45) + "»");
  console.log("  mod : «..." + mm.slice(Math.max(0, i - 25), i + 45) + "»");
}
await go("cómo está el margen", "Márgenes");
process.exit(0);
