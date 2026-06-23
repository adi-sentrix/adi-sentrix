// Diagnóstico · ¿el oráculo lee la burbuja correcta? Dump de TODAS las burbujas pre-line + texto full.
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
const preLineBubbles = () => [...document.querySelectorAll("div")].filter(d => d.style && d.style.whiteSpace === "pre-line" && (d.textContent || "").trim());
const ML = { ventas: "Ventas", margenes: "Márgenes", inventario: "Inventario" };

async function diag(query, moduleKey) {
  W.localStorage.clear();
  const container = document.getElementById("root");
  const r = createRoot(container);
  r.render(React.createElement(mod.ADISentric));
  await sleep(160);
  [...document.querySelectorAll("button")].find(b => new RegExp(ML[moduleKey]).test(b.textContent || ""))?.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
  await sleep(1500);
  const before = preLineBubbles().map(b => b.textContent.length);
  const input = document.querySelector('input[placeholder="Pregunta a ADI..."]');
  const setter = Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set;
  setter.call(input, query); input.dispatchEvent(new W.Event("input", { bubbles: true }));
  input.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await sleep(6000);
  const bubbles = preLineBubbles();
  console.log(`\n══════ «${query}» (módulo ${moduleKey}) ══════`);
  console.log("pre-line bubbles antes:", before, "→ después:", bubbles.map(b => b.textContent.length));
  const piso = bubbles.length ? bubbles[bubbles.length - 1].textContent : "";
  const r2 = mod.answerADI(query, { activeModule: moduleKey }, { scenario: "bonanza" });
  const m = r2.text || "";
  console.log("PISO  (len " + piso.length + "):\n" + piso);
  console.log("\nMODULAR (len " + m.length + ", route " + r2.route + "):\n" + m);
  console.log("\n¿modular es prefijo del piso?:", piso.replace(/\s+/g, " ").startsWith(m.replace(/\s+/g, " ").slice(0, 60)));
  r.unmount(); container.innerHTML = "";
}

await diag("cómo están las ventas", "ventas");
await diag("cómo está el margen", "margenes");
process.exit(0);
