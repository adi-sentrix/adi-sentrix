// === SPIKE del ORÁCULO · ¿puedo ejecutar el monolito real headless y leer su respuesta? ===
// Monta <ADISentric/> en jsdom, entra a Márgenes, tipea "clientes con bajo margen", y extrae
// la respuesta del piso. Si funciona, este es el oráculo para la batería de paridad total.
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
  url: "http://localhost/", pretendToBeVisual: true,
});
const W = dom.window;
globalThis.window = W;
globalThis.document = W.document;
try { Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = W.HTMLElement;
globalThis.Node = W.Node;
globalThis.getComputedStyle = W.getComputedStyle.bind(W);
globalThis.requestAnimationFrame = W.requestAnimationFrame.bind(W);
globalThis.cancelAnimationFrame = W.cancelAnimationFrame.bind(W);
globalThis.localStorage = W.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const root = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(root, "_oracle_bundle.mjs");
await esbuild.build({
  entryPoints: [path.join(root, "_oracle_entry.jsx")],
  bundle: true, outfile: bundlePath, format: "esm", platform: "browser", jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") },
  logLevel: "warning",
});
console.log("bundle OK");

const mod = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitStable(getText, { quiet = 700, max = 9000 } = {}) {
  let last = getText(), lastChange = Date.now(), start = Date.now();
  while (Date.now() - start < max) {
    await sleep(120);
    const cur = getText();
    if (cur !== last) { last = cur; lastChange = Date.now(); }
    else if (Date.now() - lastChange >= quiet) break;
  }
  return getText();
}

const mainText = () => (document.querySelector("main")?.textContent || "");

const root_ = createRoot(document.getElementById("root"));
root_.render(React.createElement(mod.ADISentric));
await sleep(300);

// entrar a Márgenes (empty-state card)
const card = [...document.querySelectorAll("button")].find(b => /Márgenes/.test(b.textContent || ""));
console.log("card Márgenes:", card ? "encontrada" : "NO");
card?.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
await waitStable(mainText, { quiet: 800, max: 9000 });   // dejar terminar el hero

const beforeLen = mainText().length;
const input = document.querySelector('input[placeholder="Pregunta a ADI..."]');
console.log("input:", input ? "encontrado" : "NO");
const setter = Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set;
setter.call(input, "clientes con bajo margen");
input.dispatchEvent(new W.Event("input", { bubbles: true }));
input.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
await waitStable(mainText, { quiet: 900, max: 12000 });

const after = mainText();
console.log("\n===== main.textContent (cola 1200) =====");
console.log(after.slice(Math.max(0, beforeLen - 40)).slice(0, 1200));

console.log("\n===== localStorage chats =====");
try {
  const raw = W.localStorage.getItem("adi_sentric_chats_v1");
  const chats = raw ? JSON.parse(raw) : null;
  if (chats && chats[0] && chats[0].messages) {
    for (const m of chats[0].messages) console.log(`  [${m.role}] ${(m.content || m.text || "").slice(0, 200)}`);
  } else { console.log("  (sin chats persistidos:", raw ? raw.slice(0, 120) : "null", ")"); }
} catch (e) { console.log("  err:", e.message); }

console.log("\n===== modular answerADI =====");
const r = mod.answerADI("clientes con bajo margen", {}, { scenario: "bonanza" });
console.log("  route:", r.route, "· len:", r.text ? r.text.length : 0);
console.log("  " + (r.text ? r.text.split("\n")[0] : "(null)"));
process.exit(0);
