// Clasificar el residuo de commercial_erosion: ¿core byte-idéntico (solo faltan lead+suffix) o bug?
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
async function waitAnswer(prev) { let last = lastBubble(), lc = Date.now(), st = Date.now(); while (Date.now() - st < 13000) { await sleep(120); const c = lastBubble(); if (c !== last) { last = c; lc = Date.now(); } else if (c !== prev && c && Date.now() - lc >= 800) break; } return lastBubble(); }
function modRendered(text) { const t = document.createElement("div"); t.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text })); return t.textContent; }

const container = document.getElementById("root");
const r = createRoot(container); r.render(React.createElement(mod.ADISentric)); await sleep(160);
[...document.querySelectorAll("button")].find(b => /Márgenes/.test(b.textContent || ""))?.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
await sleep(900); const hero = lastBubble();
const input = document.querySelector('input[placeholder="Pregunta a ADI..."]');
const setter = Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set;
setter.call(input, "clientes con bajo margen"); input.dispatchEvent(new W.Event("input", { bubbles: true })); input.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
const piso = await waitAnswer(hero);

const m = mod.answerADI("clientes con bajo margen", { activeModule: "margenes" }, { scenario: "bonanza" });
const modTxt = modRendered(m.text);
const N = (s) => s.replace(/\s+/g, " ").trim();
const pisoN = N(piso), modN = N(modTxt);
console.log("PISO   len", pisoN.length);
console.log("MODULAR len", modN.length, "(core)");
const idx = pisoN.indexOf(modN);
console.log("\n¿modular-core es substring EXACTO del piso?:", idx >= 0 ? `SÍ · en offset ${idx}` : "NO");
if (idx >= 0) {
  console.log("LEAD (piso antes del core):  «" + pisoN.slice(0, idx) + "»");
  console.log("SUFFIX (piso después del core): «" + pisoN.slice(idx + modN.length) + "»");
} else {
  // localizar primer divergencia alineando por el inicio del core "3 cuentas"
  const anchor = pisoN.indexOf("3 cuentas Tier 1 con margen");
  const pisoCore = anchor >= 0 ? pisoN.slice(anchor) : pisoN;
  let i = 0; while (i < Math.min(pisoCore.length, modN.length) && pisoCore[i] === modN[i]) i++;
  console.log("primer diff (alineado al core) en char", i);
  console.log("  piso: «..." + pisoCore.slice(Math.max(0, i - 30), i + 40) + "»");
  console.log("  mod : «..." + modN.slice(Math.max(0, i - 30), i + 40) + "»");
}
process.exit(0);
