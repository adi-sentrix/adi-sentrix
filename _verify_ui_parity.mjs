// === Verificación Fase 5 · UI == answerADI headless ===
// Monta ChatADI en jsdom, TIPEA cada query sellada, y compara lo que la UI muestra contra
// answerADI headless. Dos niveles:
//   (1) fuente:  buildAdiTurn(q).adiMsg.text === answerADI(q).text   (passthrough byte-idéntico)
//   (2) DOM:     <ChatADI> burbuja renderizada === <AdiMessageBody answerADI(q).text>  (render sin pérdida)
// No usa Vite. esbuild solo transforma el JSX para correr en Node.
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

// ── 1 · DOM global ANTES de testing-library ──
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
try { Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── 2 · bundle de la UI (esbuild transforma JSX · react externo) ──
const root = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(root, "_ui_bundle.mjs");
await esbuild.build({
  entryPoints: [path.join(root, "_ui_entry.jsx")],
  bundle: true, outfile: bundlePath, format: "esm", platform: "node", jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  logLevel: "silent",
});

const ui = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default;
const { render, fireEvent, cleanup } = await import("@testing-library/react");

const SCENARIO = "bonanza";

const BASICOS = [
  "cómo están las ventas", "cómo van las ventas", "ventas", "qué pasa con las ventas",
  "cómo está el margen", "cómo viene la contribución", "cómo está el inventario",
  "qué pasa con la bodega", "cómo va el negocio", "dame panorama comercial",
];
const ANCLAS = [
  "cómo están las ventas de Falabella", "Santiago vs Valparaíso",
  "cuánto debe vender Falabella para aportar $1M", "cuánto vender para aportar $2M adicional",
  "cuál es el SKU con peor rotación", "cómo viene Makita",
];

// Render aislado de AdiMessageBody → textContent canónico de un texto dado.
function domTextOf(text) {
  const { container, unmount } = render(React.createElement(ui.AdiMessageBody, { text }));
  const t = container.textContent;
  unmount();
  return t;
}

// Tipea q en una instancia fresca de ChatADI y devuelve el textContent de la burbuja ADI.
function typeIntoUI(q) {
  const { container, unmount } = render(React.createElement(ui.ChatADI, { scenario: SCENARIO, animate: false }));
  const input = container.querySelector("input");
  fireEvent.change(input, { target: { value: q } });
  fireEvent.click(container.querySelector("button"));   // botón enviar
  const bubbles = container.querySelectorAll('[data-testid="adi-bubble"]');
  const got = bubbles.length ? bubbles[bubbles.length - 1].textContent : "(sin burbuja)";
  unmount();
  return got;
}

function runSet(title, set) {
  console.log("\n" + "═".repeat(82));
  console.log(title);
  console.log("═".repeat(82));
  let srcOk = 0, domOk = 0;
  for (let i = 0; i < set.length; i++) {
    const q = set[i];
    const headless = ui.answerADI(q, {}, { scenario: SCENARIO });
    const turn = ui.buildAdiTurn(q, {}, SCENARIO);
    const srcIdentical = turn.adiMsg.text === headless.text;            // (1) passthrough byte
    const uiText = typeIntoUI(q);
    const domIdentical = uiText === domTextOf(headless.text);           // (2) render sin pérdida
    if (srcIdentical) srcOk++;
    if (domIdentical) domOk++;
    console.log(`\n[${String(i + 1).padStart(2)}] «${q}»`);
    console.log(`     ruta ${headless.route} · len ${headless.text ? headless.text.length : 0}`);
    console.log(`     fuente UI==headless: ${srcIdentical ? "SÍ ✓" : "NO ✗"} · DOM UI==headless: ${domIdentical ? "SÍ ✓" : "NO ✗"}`);
    console.log(`     UI muestra: «${uiText.slice(0, 64).replace(/\s+/g, " ")}…»`);
  }
  console.log(`\n   → fuente idéntica ${srcOk}/${set.length} · DOM idéntico ${domOk}/${set.length}`);
  return { srcOk, domOk, n: set.length };
}

const b = runSet("10 BÁSICOS · tipeados en la UI vs answerADI headless", BASICOS);
const a = runSet("6 ANCLAS · tipeadas en la UI vs answerADI headless", ANCLAS);

console.log("\n" + "█".repeat(82));
console.log(`RESUMEN PARIDAD UI  ·  fuente idéntica ${b.srcOk + a.srcOk}/${b.n + a.n}  ·  DOM idéntico ${b.domOk + a.domOk}/${b.n + a.n}`);
console.log("█".repeat(82));

const total = b.n + a.n;
const allPass = (b.srcOk + a.srcOk) === total && (b.domOk + a.domOk) === total;
process.exit(allPass ? 0 : 1);
