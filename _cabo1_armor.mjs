// CABO 1 · VERIFICACIÓN BLINDADA · modular flag-ON === piso − cola_suffix_exacta (byte-exacto, no substring).
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
const { virtuousExceptionSuffix } = await import(pathToFileURL(path.join(root, "src/adi/proactive.js")).href);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const lastBubble = () => { const bs = [...document.querySelectorAll("div")].filter(d => d.style && d.style.whiteSpace === "pre-line" && (d.textContent || "").trim()); return bs.length ? bs[bs.length - 1].textContent : ""; };
async function waitAnswer(prev, { quiet = 1300, max = 26000 } = {}) { let last = lastBubble(), lc = Date.now(), st = Date.now(); while (Date.now() - st < max) { await sleep(120); const c = lastBubble(); if (c !== last) { last = c; lc = Date.now(); } else if (c !== prev && c && Date.now() - lc >= quiet) break; } return lastBubble(); }
function modularRendered(text) { if (text == null) return null; const t = document.createElement("div"); t.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text })); return t.textContent; }
const ML = { ventas: "Ventas", margenes: "Márgenes", inventario: "Inventario" };
async function oracleAnswer(q, mk) {
  W.localStorage.clear();
  const c = document.getElementById("root"); const r = createRoot(c); r.render(React.createElement(mod.ADISentric)); await sleep(160);
  [...document.querySelectorAll("button")].find(b => new RegExp(ML[mk]).test(b.textContent || ""))?.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
  await sleep(900); const hero = lastBubble();
  const input = document.querySelector('input[placeholder="Pregunta a ADI..."]'); const setter = Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set;
  setter.call(input, q); input.dispatchEvent(new W.Event("input", { bubbles: true })); input.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const a = await waitAnswer(hero); r.unmount(); c.innerHTML = ""; return a;
}
const CORPUS = [
  ["cómo están las ventas","ventas"],["cómo está el margen","margenes"],["cómo está el inventario","inventario"],["cómo va el negocio","ventas"],
  ["cómo están las ventas de Falabella","ventas"],["Santiago vs Valparaíso","inventario"],["cuánto debe vender Falabella para aportar $1M","margenes"],["cuál es el SKU con peor rotación","inventario"],["cómo viene Makita","ventas"],
  ["clientes con bajo margen","margenes"],["qué clientes tienen bajo margen","margenes"],["clientes menos rentables","margenes"],["qué clientes erosionan el margen","margenes"],["quién aporta más contribución","margenes"],["qué cliente concentra la pérdida","margenes"],["dónde se está yendo el margen","margenes"],
  ["dónde se concentra mi ingreso","ventas"],["qué clientes explican mis ventas","ventas"],["dónde estoy creciendo o cayendo","ventas"],["qué clientes están en caída","ventas"],["por qué Mercado Libre crece tanto","ventas"],["qué pasa si pierdo a Falabella","ventas"],["cuál es el riesgo de mi cartera","ventas"],
  ["dónde tengo capital detenido","inventario"],["qué productos no rotan","inventario"],["qué SKUs están atrapando más capital","inventario"],["qué productos debo liquidar","inventario"],["dónde tengo riesgo de quiebre","inventario"],["cuál es la rotación promedio del portafolio","inventario"],
  ["cómo está Lider","ventas"],["analizá Jumbo","ventas"],["Sodimac","margenes"],["cómo está Samsung","ventas"],["LG","ventas"],["cómo está Santiago","inventario"],
  ["mejores clientes","ventas"],["top 5 clientes","ventas"],["peores SKUs por rotación","inventario"],["ranking de clientes por contribución","margenes"],
  ["Falabella vs Lider","ventas"],["Samsung vs LG","ventas"],
  ["cuánto vender para aportar $2M adicional","margenes"],["qué pasa con las ventas si crece 10%","ventas"],["qué pasa con el precio si subo 5%","margenes"],
  ["qué clientes crecen vs año anterior","ventas"],["hola","ventas"],["qué tal el clima hoy","ventas"],
  // ── EXTENDIDA (D0 + combos) · cubre el 2º RIL "contribución por familia" ──
  ["hay algo raro acá","ventas"],["me preocupa el negocio","ventas"],["algo no me cierra","margenes"],["se ve mal esto","inventario"],
  ["dónde estoy dejando plata","ventas"],["qué margen no estoy capturando","margenes"],["dónde puedo ganar más","ventas"],
  ["sorprendeme","ventas"],["qué debería mirar","ventas"],["mostrame algo interesante","inventario"],["por dónde miro","margenes"],
  ["ventas por marca","ventas"],["top 3 SKU por margen","inventario"],["contribución por familia","margenes"],["margen por cliente","margenes"],
  ["cómo está Sodimac","ventas"],["cómo está Tottus","ventas"],["analizá Ripley","ventas"],["cómo está Paris","margenes"],
];
const SUF = modularRendered(virtuousExceptionSuffix("bonanza"));   // cola exacta renderizada
const _invRoute = (r) => r === "qi_inventory_avisar" || r === "qi_inventory_filter_avisar";
// transformaciones DOCUMENTADAS de Cabo 2 (sustitución RIL contribución · no inventa, reemplaza por comercial)
const _cabo2 = (s) => s
  .replace(/validar rotación y disponibilidad operativa del líder/g, "validar la composición de la contribución del líder")
  .replace(/cruzar con rotación por /g, "cruzar con margen por ");
let soloSuffix = [], conRIL = [], sinCambio = 0, inv = 0, fail = [];
for (const [q, mk] of CORPUS) {
  let X = ""; try { X = await oracleAnswer(q, mk); } catch (e) { X = "(err)"; }
  const r = mod.answerADI(q, { activeModule: mk }, { scenario: "bonanza" });
  const Y = modularRendered(r.text);
  if (_invRoute(r.route)) { inv++; continue; }                      // inventario · re-baseline AVISAR (aparte)
  const tieneSuffix = X.endsWith(SUF);
  const base = tieneSuffix ? X.slice(0, X.length - SUF.length) : X; // piso − cola EXACTA
  const esperado = _cabo2(base);                                    // + sustitución RIL documentada
  if (Y === esperado) {
    if (!tieneSuffix && base === esperado) sinCambio++;
    else if (base !== esperado) conRIL.push(q);                     // cambió RIL (+ suffix si tenía)
    else soloSuffix.push(q);                                        // solo suffix
  } else {
    fail.push({ q, route: r.route, motivo: "diff ESCONDIDO (≠ piso − suffix − RIL)", Ylen: (Y||"").length, espLen: esperado.length });
  }
}
console.log(`Suffix renderizado (cola): «${SUF.slice(0, 60)}…» (${SUF.length} chars)`);
console.log(`\nSOLO SUFFIX removido (diff EXACTO = la cola): ${soloSuffix.length}`);
console.log(`SUFFIX + sustitución RIL Cabo 2 (contribución · diff EXACTO documentado): ${conRIL.length}`);
conRIL.forEach(q => console.log(`   ✓ «${q}»`));
console.log(`SIN CAMBIO (piso sin suffix · byte-idénticas): ${sinCambio}`);
console.log(`INVENTARIO (re-baseline AVISAR · aparte): ${inv}`);
console.log(`\nFALLAS (diff escondido más allá de suffix+RIL): ${fail.length}`);
fail.forEach(f => console.log(`   ✗ «${f.q}» [${f.route}] · ${f.motivo} · ${JSON.stringify(f)}`));
console.log(`\n── BLINDADO: ${fail.length === 0 ? "VERDE · toda diferencia es EXACTAMENTE {suffix removido + sustitución RIL documentada}, cero cambio escondido" : "ROJO · " + fail.length + " con cambio escondido"} ──`);
process.exit(fail.length ? 1 : 0);
