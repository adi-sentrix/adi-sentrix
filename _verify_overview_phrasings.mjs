// VERIFICACIÓN AMPLIADA · ¿el predicado explicit-overview captura TODOS los fraseos sin falsos +/-?
// Por query: predicado (modular helpers) vs piso (oráculo · ¿la respuesta arranca con el lead ETLG?).
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
const oracle = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const gate = await import(pathToFileURL(path.join(root, "src", "adi", "overviewGate.js")).href);
const etlg = await import(pathToFileURL(path.join(root, "src", "adi", "etlg.js")).href);
const answer = await import(pathToFileURL(path.join(root, "src", "adi", "answerADI.js")).href);
const router = await import(pathToFileURL(path.join(root, "src", "adi", "router.js")).href);

// leads ETLG por módulo (lo que el piso prependería)
const thesis = {};
for (const m of ["ventas", "margenes", "inventario"]) {
  const r = etlg.executiveThesisLineGenerator({ opener: "x" }, { tier: "module_overview", modulo: m }, "bonanza");
  thesis[m] = (r && r.thesisLine) || "";
}
const N = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const lastBubble = () => { const bs = [...document.querySelectorAll("div")].filter(d => d.style && d.style.whiteSpace === "pre-line" && (d.textContent || "").trim()); return bs.length ? bs[bs.length - 1].textContent : ""; };
async function waitAnswer(prev) { let last = lastBubble(), lc = Date.now(), st = Date.now(); while (Date.now() - st < 12000) { await sleep(120); const c = lastBubble(); if (c !== last) { last = c; lc = Date.now(); } else if (c !== prev && c && Date.now() - lc >= 800) break; } return lastBubble(); }
const ML = { ventas: "Ventas", margenes: "Márgenes", inventario: "Inventario" };
async function pisoAnswer(query, moduleKey) {
  W.localStorage.clear();
  const container = document.getElementById("root");
  const r = createRoot(container); r.render(React.createElement(oracle.ADISentric)); await sleep(160);
  [...document.querySelectorAll("button")].find(b => new RegExp(ML[moduleKey]).test(b.textContent || ""))?.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
  await sleep(900); const hero = lastBubble();
  const input = document.querySelector('input[placeholder="Pregunta a ADI..."]');
  const setter = Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set;
  setter.call(input, query); input.dispatchEvent(new W.Event("input", { bubbles: true })); input.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const a = await waitAnswer(hero); r.unmount(); container.innerHTML = ""; return a;
}

const CASES = [
  ["cómo está la venta", "ventas"], ["cómo están las ventas", "ventas"], ["panorama de ventas", "ventas"],
  ["resumen de ventas", "ventas"], ["qué pasa con las ventas", "ventas"], ["ventas", "ventas"],
  ["vista general de ventas", "ventas"], ["cómo van las ventas", "ventas"],
  ["cómo está el margen", "margenes"], ["cómo están los márgenes", "margenes"], ["panorama de márgenes", "margenes"],
  ["resumen de márgenes", "margenes"], ["qué pasa con el margen", "margenes"], ["margenes", "margenes"],
  ["rentabilidad general", "margenes"],
  ["cómo está el inventario", "inventario"], ["cómo están los inventarios", "inventario"], ["panorama de inventario", "inventario"],
  ["resumen de inventario", "inventario"], ["qué pasa con el inventario", "inventario"], ["inventario", "inventario"],
  ["stock", "inventario"], ["qué pasa con la bodega", "inventario"],
];

let agree = 0, falsePos = 0, falseNeg = 0;
console.log("predicado | piso | route(mod) | query");
for (const [q, m] of CASES) {
  const predicate = router.detectIntent(q, {}).type === "module" && (gate._isExplicitModuleOverviewQuery(q) || gate._isBareModuleWord(q));
  const p = await pisoAnswer(q, m);
  const pisoHasLead = N(p).startsWith(N(thesis[m]).slice(0, 28));
  const route = answer.answerADI(q, { activeModule: m }, { scenario: "bonanza" }).route;
  const ok = predicate === pisoHasLead;
  if (ok) agree++; else if (predicate && !pisoHasLead) falsePos++; else falseNeg++;
  const flag = ok ? "✓" : (predicate && !pisoHasLead ? "✗ FALSO+" : "✗ FALSO-");
  console.log(`${predicate ? "LEAD" : "—   "}      | ${pisoHasLead ? "LEAD" : "—   "} | ${route.padEnd(18)} | ${flag}  «${q}»`);
}
console.log(`\n→ coinciden ${agree}/${CASES.length} · falsos positivos ${falsePos} · falsos negativos ${falseNeg}`);
console.log(falsePos === 0 && falseNeg === 0 ? "PREDICADO PERFECTO · el parche cubre todo sin escapes" : "HAY DESVÍOS · frenar y revisar antes de cablear");
process.exit(0);
