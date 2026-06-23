// DIAGNÓSTICO · comportamiento ACTUAL del piso para las 30 preguntas del oráculo ADI Core.
// Read-only · captura texto real (para análisis de adyacencia · ¿hoy responde adyacente?).
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";
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
async function waitAnswer(prev, { quiet = 1300, max = 24000 } = {}) { let last = lastBubble(), lc = Date.now(), st = Date.now(); while (Date.now() - st < max) { await sleep(110); const c = lastBubble(); if (c !== last) { last = c; lc = Date.now(); } else if (c !== prev && c && Date.now() - lc >= quiet) break; } return lastBubble(); }
async function piso(q, mk) {
  W.localStorage.clear();
  const c = document.getElementById("root"); const r = createRoot(c); r.render(React.createElement(mod.ADISentric)); await sleep(150);
  [...document.querySelectorAll("button")].find(b => new RegExp(mk, "i").test(b.textContent || ""))?.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
  await sleep(850); const hero = lastBubble();
  const input = document.querySelector('input[placeholder="Pregunta a ADI..."]'); const setter = Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set;
  setter.call(input, q); input.dispatchEvent(new W.Event("input", { bubbles: true })); input.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const a = await waitAnswer(hero); r.unmount(); c.innerHTML = ""; return a;
}
// [n, expectedBranch, query, module]
const QS = [
  [1,"APLICAR","ventas por cliente de Samsung","Ventas"],
  [2,"APLICAR","margen por SKU de Bosch","Márgenes"],
  [3,"APLICAR","contribución por cliente de la familia Cuidado Personal","Márgenes"],
  [4,"APLICAR","ventas por SKU de la familia Línea Blanca","Ventas"],
  [5,"APLICAR","margen por marca de la familia Electrodomésticos","Márgenes"],
  [6,"APLICAR","carga comercial por cliente de LG","Márgenes"],
  [7,"APLICAR","margen por SKU de Samsung en Electrodomésticos","Márgenes"],
  [8,"APLICAR","top 3 clientes por ventas de Philips","Ventas"],
  [9,"APLICAR","participación por cliente de Bosch","Ventas"],
  [10,"AVISAR","qué SKU de Samsung rota peor","Inventario"],
  [11,"AVISAR","cuánto stock hay en Santiago de productos LG","Inventario"],
  [12,"AVISAR","qué canal vende más","Ventas"],
  [13,"AVISAR","contribución por canal","Márgenes"],
  [14,"AVISAR","margen promedio de los clientes Tier 1","Márgenes"],
  [15,"AVISAR","promedio de margen de los clientes que crecen","Márgenes"],
  [16,"AVISAR","rotación por marca","Inventario"],
  [17,"AVISAR","cruzá ventas por familia y por canal","Ventas"],
  [18,"AVISAR","clientes con margen menor a 20%","Márgenes"],
  [19,"AVISAR","DOH por bodega","Inventario"],
  [20,"AVISAR","capital inmovilizado por marca","Inventario"],
  [21,"AVISAR","cuántos clientes venden Samsung","Ventas"],
  [22,"ACLARAR","stock por marca","Inventario"],
  [23,"ACLARAR","ventas de Samsung","Ventas"],
  [24,"ACLARAR","margen de Línea Blanca","Márgenes"],
  [25,"ACLARAR","los mejores de Bosch","Ventas"],
  [26,"APLICAR(control)","margen por marca","Márgenes"],
  [27,"APLICAR(control)","top 3 familias por contribución","Márgenes"],
  [28,"APLICAR(control)","ventas y margen por cliente","Márgenes"],
  [29,"AVISAR","ventas por marca de estos 3 clientes","Ventas"],
  [30,"AVISAR","ventas por cliente de Makita","Ventas"],
];
const out = [];
for (const [n, exp, q, mk] of QS) {
  let t = ""; try { t = await piso(q, mk); } catch (e) { t = "(err: " + e.message + ")"; }
  out.push({ n, exp, q, mk, len: t.length, text: t });
  console.log(`#${n} [exp:${exp}] «${q}» (len ${t.length})\n   HOY: ${t.replace(/\s+/g, " ").slice(0, 200)}\n`);
}
fs.writeFileSync(path.join(root, "_diag_routing30.json"), JSON.stringify(out, null, 2));
console.log("→ _diag_routing30.json");
process.exit(0);
