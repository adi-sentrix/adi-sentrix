// === BATERÍA DIFERENCIAL · modular vs piso 41cc33d8 (oráculo headless) ===
// Por cada query: monta el piso real, entra a un módulo, tipea, lee su respuesta;
// corre el modular; compara texto renderizado vs renderizado. Categoriza paridad/mismatch/defer.
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

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
const origError = console.error; console.error = (...a) => { const s = String(a[0] ?? ""); if (s.includes("not wrapped in act") || s.includes("ReactDOM.render")) return; origError(...a); };

const root = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(root, "_oracle_bundle.mjs");
await esbuild.build({
  entryPoints: [path.join(root, "_oracle_entry.jsx")], bundle: true, outfile: bundlePath,
  format: "esm", platform: "browser", jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "warning",
});
const mod = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { renderToStaticMarkup } = await import("react-dom/server");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
const lastBubble = () => {
  const bs = [...document.querySelectorAll("div")].filter(d => d.style && d.style.whiteSpace === "pre-line" && (d.textContent || "").trim());
  return bs.length ? bs[bs.length - 1].textContent : "";
};
async function waitAnswer(prev, { quiet = 1300, max = 26000 } = {}) {
  let last = lastBubble(), lastChange = Date.now(), start = Date.now();
  while (Date.now() - start < max) {
    await sleep(120);
    const cur = lastBubble();
    if (cur !== last) { last = cur; lastChange = Date.now(); }
    else if (cur !== prev && cur && Date.now() - lastChange >= quiet) break;
  }
  return lastBubble();
}

// Render del texto modular por el MISMO render del chat (AdiMessageBody) → textContent.
function modularRendered(text) {
  if (text == null) return null;
  const tmp = document.createElement("div");
  tmp.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text }));
  return tmp.textContent;
}

const MODULE_LABEL = { ventas: "Ventas", margenes: "Márgenes", inventario: "Inventario" };
async function oracleAnswer(query, moduleKey) {
  W.localStorage.clear();
  const container = document.getElementById("root");
  const r = createRoot(container);
  r.render(React.createElement(mod.ADISentric));
  await sleep(160);
  const card = [...document.querySelectorAll("button")].find(b => new RegExp(MODULE_LABEL[moduleKey]).test(b.textContent || ""));
  card?.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
  await sleep(900);
  const hero = lastBubble();
  const input = document.querySelector('input[placeholder="Pregunta a ADI..."]');
  if (!input) { r.unmount(); container.innerHTML = ""; return "(sin input)"; }
  const setter = Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set;
  setter.call(input, query); input.dispatchEvent(new W.Event("input", { bubbles: true }));
  input.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const ans = await waitAnswer(hero);
  r.unmount(); container.innerHTML = "";
  return ans;
}

// ── CORPUS · familias representativas (moduleKey = en qué módulo se tipea en el piso) ──
const CORPUS = [
  // críticas selladas (baseline de paridad)
  ["básico", "cómo están las ventas", "ventas"],
  ["básico", "cómo está el margen", "margenes"],
  ["básico", "cómo está el inventario", "inventario"],
  ["básico", "cómo va el negocio", "ventas"],
  ["ancla", "cómo están las ventas de Falabella", "ventas"],
  ["ancla", "Santiago vs Valparaíso", "inventario"],
  ["ancla", "cuánto debe vender Falabella para aportar $1M", "margenes"],
  ["ancla", "cuál es el SKU con peor rotación", "inventario"],
  ["ancla", "cómo viene Makita", "ventas"],
  // margen/cliente semántico (el gap reportado)
  ["margen-qi", "clientes con bajo margen", "margenes"],
  ["margen-qi", "qué clientes tienen bajo margen", "margenes"],
  ["margen-qi", "clientes menos rentables", "margenes"],
  ["margen-qi", "qué clientes erosionan el margen", "margenes"],
  ["margen-qi", "quién aporta más contribución", "margenes"],
  ["margen-qi", "qué cliente concentra la pérdida", "margenes"],
  ["margen-qi", "dónde se está yendo el margen", "margenes"],
  // ventas semántico
  ["ventas-qi", "dónde se concentra mi ingreso", "ventas"],
  ["ventas-qi", "qué clientes explican mis ventas", "ventas"],
  ["ventas-qi", "dónde estoy creciendo o cayendo", "ventas"],
  ["ventas-qi", "qué clientes están en caída", "ventas"],
  ["ventas-qi", "por qué Mercado Libre crece tanto", "ventas"],
  ["ventas-qi", "qué pasa si pierdo a Falabella", "ventas"],
  ["ventas-qi", "cuál es el riesgo de mi cartera", "ventas"],
  // inventario semántico
  ["inv-qi", "dónde tengo capital detenido", "inventario"],
  ["inv-qi", "qué productos no rotan", "inventario"],
  ["inv-qi", "qué SKUs están atrapando más capital", "inventario"],
  ["inv-qi", "qué productos debo liquidar", "inventario"],
  ["inv-qi", "dónde tengo riesgo de quiebre", "inventario"],
  ["inv-qi", "cuál es la rotación promedio del portafolio", "inventario"],
  // dives de entidad
  ["dive-cliente", "cómo está Lider", "ventas"],
  ["dive-cliente", "analizá Jumbo", "ventas"],
  ["dive-cliente", "Sodimac", "margenes"],
  ["dive-marca", "cómo está Samsung", "ventas"],
  ["dive-marca", "LG", "ventas"],
  ["dive-bodega", "cómo está Santiago", "inventario"],
  // rankings
  ["ranking", "mejores clientes", "ventas"],
  ["ranking", "top 5 clientes", "ventas"],
  ["ranking", "peores SKUs por rotación", "inventario"],
  ["ranking", "ranking de clientes por contribución", "margenes"],
  // comparaciones
  ["comparación", "Falabella vs Lider", "ventas"],
  ["comparación", "Samsung vs LG", "ventas"],
  // operaciones con número
  ["operación", "cuánto vender para aportar $2M adicional", "margenes"],
  ["operación", "qué pasa con las ventas si crece 10%", "ventas"],
  ["operación", "qué pasa con el precio si subo 5%", "margenes"],
  // cross / growth
  ["cross", "qué clientes crecen vs año anterior", "ventas"],
  // greeting / OOD
  ["greeting", "hola", "ventas"],
  ["ood", "qué tal el clima hoy", "ventas"],
];

const results = [];
const cats = {};
for (let i = 0; i < CORPUS.length; i++) {
  const [family, q, moduleKey] = CORPUS[i];
  let X = "";
  try { X = await oracleAnswer(q, moduleKey); } catch (e) { X = "(oracle err: " + e.message + ")"; }
  const r = mod.answerADI(q, { activeModule: moduleKey }, { scenario: "bonanza" });
  const Y = modularRendered(r.text);
  let cat;
  if (r.text == null) cat = "MODULAR_DEFER";
  else if (!X || X.startsWith("(")) cat = "ORACLE_FAIL";
  else if (norm(X) === norm(Y)) cat = "PARITY";
  else if (norm(Y) && norm(X).includes(norm(Y))) cat = "CORE_OK";   // modular = substring exacto del piso → core OK, faltan envolturas
  else cat = "MISMATCH";
  cats[cat] = (cats[cat] || 0) + 1;
  results.push({ i: i + 1, family, q, moduleKey, cat, route: r.route, lenPiso: (X || "").length, lenMod: r.text ? r.text.length : 0,
    pisoHead: norm(X).slice(0, 90), modHead: norm(Y || "(null)").slice(0, 90) });
  const tag = { PARITY: "✓ PARIDAD", CORE_OK: "~ CORE_OK", MISMATCH: "✗ MISMATCH", MODULAR_DEFER: "✗ DEFIERE", ORACLE_FAIL: "? ORACLE" }[cat];
  console.log(`[${String(i + 1).padStart(2)}] ${tag.padEnd(11)} ${family.padEnd(13)} «${q}»  piso ${(X || "").length} / mod ${r.text ? r.text.length : 0} (${r.route})`);
}

fs.writeFileSync(path.join(root, "_parity_results.json"), JSON.stringify(results, null, 2));
console.log("\n" + "█".repeat(72));
console.log("UNIVERSO (primer sweep):", Object.entries(cats).map(([k, v]) => `${k} ${v}`).join("  ·  "));
console.log(`total ${results.length} · detalle → _parity_results.json`);
console.log("█".repeat(72));
process.exit(0);
