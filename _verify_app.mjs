// === Verificación · App shell corre de verdad (headless, sin Vite) ===
// Monta <App/>, tipea una query, cambia de escenario con el chip, y confirma:
//   (a) la burbuja ADI == answerADI headless para el escenario vigente
//   (b) cambiar de escenario por la UI propaga: misma query → respuesta distinta y correcta
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
try { Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const root = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(root, "_app_bundle.mjs");
await esbuild.build({
  entryPoints: [path.join(root, "_app_entry.jsx")],
  bundle: true, outfile: bundlePath, format: "esm", platform: "node", jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  logLevel: "silent",
});

const ui = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default;
const { render, fireEvent } = await import("@testing-library/react");

const Q = "cómo están las ventas";

function domTextOf(text) {
  const { container, unmount } = render(React.createElement(ui.AdiMessageBody, { text }));
  const t = container.textContent; unmount(); return t;
}

const { container } = render(React.createElement(ui.App, { animate: false }));

function typeAndRead(q) {
  const input = container.querySelector("input");
  fireEvent.change(input, { target: { value: q } });
  // el botón enviar es el ÚLTIMO button del input bar; los chips de escenario son los primeros
  const buttons = [...container.querySelectorAll("button")];
  const send = buttons[buttons.length - 1];
  fireEvent.click(send);
  const bubbles = container.querySelectorAll('[data-testid="adi-bubble"]');
  return bubbles[bubbles.length - 1].textContent;
}

function clickScenario(label) {
  const btn = [...container.querySelectorAll("button")].find(b => b.textContent.trim() === label);
  if (!btn) throw new Error("no encontré el chip de escenario: " + label);
  fireEvent.click(btn);
}

console.log("App montó:", container.querySelector("header") ? "SÍ ✓" : "NO ✗");

// ── Escenario bonanza (default) ──
const uiBonanza = typeAndRead(Q);
const headBonanza = domTextOf(ui.answerADI(Q, {}, { scenario: "bonanza" }).text);
console.log("\n[bonanza] UI == headless:", uiBonanza === headBonanza ? "SÍ ✓" : "NO ✗");
console.log("          UI:", `«${uiBonanza.slice(0, 64).replace(/\s+/g, " ")}…»`);

// ── Cambiar a Tensión por la UI ──
clickScenario("Tensión");
const uiTension = typeAndRead(Q);
const headTension = domTextOf(ui.answerADI(Q, {}, { scenario: "tension" }).text);
console.log("\n[tensión] UI == headless:", uiTension === headTension ? "SÍ ✓" : "NO ✗");
console.log("          UI:", `«${uiTension.slice(0, 64).replace(/\s+/g, " ")}…»`);

// ── El cambio de escenario por la UI propaga (respuestas distintas) ──
const propaga = uiBonanza !== uiTension;
console.log("\nescenario propaga (bonanza ≠ tensión):", propaga ? "SÍ ✓" : "NO ✗");

const allPass = (uiBonanza === headBonanza) && (uiTension === headTension) && propaga && !!container.querySelector("header");
console.log("\n" + "█".repeat(60));
console.log("APP SHELL:", allPass ? "CORRE · paridad por escenario OK" : "FALLA");
console.log("█".repeat(60));
process.exit(allPass ? 0 : 1);
