// Captura TARGET del piso + detectIntent.type para las 16 DEFER restantes (fundación de extracción).
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";
import { detectIntent } from "./src/adi/router.js";
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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const lastBubble = () => { const bs = [...document.querySelectorAll("div")].filter(d => d.style && d.style.whiteSpace === "pre-line" && (d.textContent || "").trim()); return bs.length ? bs[bs.length - 1].textContent : ""; };
async function waitAnswer(prev, { quiet = 1500, max = 26000 } = {}) { let last = lastBubble(), lc = Date.now(), st = Date.now(); while (Date.now() - st < max) { await sleep(120); const c = lastBubble(); if (c !== last) { last = c; lc = Date.now(); } else if (c !== prev && c && Date.now() - lc >= quiet) break; } return lastBubble(); }
const MODULE_LABEL = { ventas: "Ventas", margenes: "Márgenes", inventario: "Inventario" };
async function oracle(q, mk) {
  W.localStorage.clear();
  const container = document.getElementById("root"); const r = createRoot(container); r.render(React.createElement(mod.ADISentric)); await sleep(160);
  [...document.querySelectorAll("button")].find(b => new RegExp(MODULE_LABEL[mk] || mk, "i").test(b.textContent || ""))?.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
  await sleep(900); const hero = lastBubble();
  const input = document.querySelector('input[placeholder="Pregunta a ADI..."]'); const setter = Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set;
  setter.call(input, q); input.dispatchEvent(new W.Event("input", { bubbles: true })); input.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const a = await waitAnswer(hero); r.unmount(); container.innerHTML = ""; return a;
}
// 16 DEFER · [i, family, query, moduleKey]
const DEFER = [
  [12, "margen-qi", "clientes menos rentables", "margenes"],
  [15, "margen-qi", "qué cliente concentra la pérdida", "margenes"],
  [19, "ventas-qi", "dónde estoy creciendo o cayendo", "ventas"],
  [20, "ventas-qi", "qué clientes están en caída", "ventas"],
  [22, "ventas-qi", "qué pasa si pierdo a Falabella", "ventas"],
  [23, "ventas-qi", "cuál es el riesgo de mi cartera", "ventas"],
  [35, "dive-bodega", "cómo está Santiago", "inventario"],
  [36, "ranking", "mejores clientes", "ventas"],
  [37, "ranking", "top 5 clientes", "ventas"],
  [39, "ranking", "ranking de clientes por contribución", "margenes"],
  [40, "comparación", "Falabella vs Lider", "ventas"],
  [41, "comparación", "Samsung vs LG", "ventas"],
  [43, "operación", "qué pasa con las ventas si crece 10%", "ventas"],
  [44, "operación", "qué pasa con el precio si subo 5%", "margenes"],
  [45, "cross", "qué clientes crecen vs año anterior", "ventas"],
  [46, "greeting", "hola", "ventas"],
];
const out = [];
for (const [i, fam, q, mk] of DEFER) {
  const di = detectIntent(q, {});
  const t = await oracle(q, mk);
  const rec = { i, family: fam, q, moduleKey: mk, intentType: di ? di.type : "(no detectIntent export)", archetype: di && di.crossDomain ? di.crossDomain.archetype : null, len: t.length, text: t };
  out.push(rec);
  console.log(`[${i}] ${fam.padEnd(12)} type=${String(rec.intentType).padEnd(20)}${rec.archetype ? " arch=" + rec.archetype : ""} len ${rec.len} «${q}»`);
}
fs.writeFileSync(path.join(root, "_defer_targets.json"), JSON.stringify(out, null, 2));
console.log("\n→ targets completos en _defer_targets.json");
process.exit(0);
