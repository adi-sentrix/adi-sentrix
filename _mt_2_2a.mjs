// === FASE 2.2a · CADENAS MULTI-TURNO · anti-fuga + anti-contaminación ===
// Corre las cadenas encadenadas a través del MODULAR (hila ctx entre turnos · igual que ChatADI).
// NO usa el oráculo (la conducta multi-turno de 2.2a es NUEVA · no hay piso que comparar): el gate es
// (a) RED anti-fuga intrínseco (cero número de inventario en las continuaciones), (b) shadow-diff ON-vs-OFF.
// Uso: node _mt_2_2a.mjs _mt_OFF.json   (flag OFF)  ·  node _mt_2_2a.mjs _mt_ON.json  (flag ON)
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
const { renderToStaticMarkup } = await import("react-dom/server");
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
function modRendered(text) { if (text == null) return null; const t = document.createElement("div"); t.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text })); return t.textContent; }

// ── patrón de NÚMERO DE INVENTARIO (lo que NO debe aparecer en una continuación bloqueada) ──
// $ montos · rotación N · Nx · inmovilizado · DOH · días de cobertura/sin venta · stock USD.
// NO matchea "Fase 2.5" (el mensaje AVISA) ni la palabra "inventario" suelta.
const INV_NUM = /\$\s?\d|rotaci[oó]n\s+[\d.]|\b\d+(?:[.,]\d+)?x\b|inmoviliz|\bdoh\b|d[ií]as\s+de\s+cobertura|d[ií]as\s+sin\s+vent|stock\s*usd|cobertura\s+de\s+\d/i;

// ── CADENAS · {name, moduleKey, turns, red:[idx 0-based de turnos que NO deben fugar inventario]} ──
const CHAINS = [
  // A · ANTI-FUGA (RED) · la continuación tras inventario no surfacea capital/rotación
  { name: "fuga-capital-tresPeores", mk: "inventario", turns: ["qué SKUs atrapan capital", "los tres peores"], red: [1] },
  { name: "fuga-capital-profundiza", mk: "inventario", turns: ["dónde tengo capital detenido", "profundizá en esos"], red: [1] },
  { name: "fuga-rotacion-profundiza", mk: "inventario", turns: ["qué productos no rotan", "profundizá en ese"], red: [1] },
  { name: "fuga-skus-eseSku", mk: "inventario", turns: ["qué SKUs atrapan más capital", "y ese SKU?"], red: [1] },
  { name: "fuga-skugroup-primero", mk: "inventario", turns: ["qué SKUs atrapan más capital", "y el primero?"], red: [1] },
  { name: "fuga-peorRotacion-dive", mk: "inventario", turns: ["cuál es el SKU con peor rotación", "y ese SKU?"], red: [1] },

  // B · ANTI-CONTAMINACIÓN · una lista/cliente viejo no se resucita tras cambiar de tema
  // (T1 produce lista · T2 cambia de tema sin lista · T3 deíctico NO debe resucitar la lista stale)
  { name: "contam-stale-ranking-ordinal", mk: "margenes", turns: ["ranking de clientes por contribución", "qué tal el clima hoy", "el último"], red: [] },
  { name: "contam-stale-bajomargen-ordinal", mk: "margenes", turns: ["clientes con bajo margen", "qué tal el clima hoy", "el primero"], red: [] },
  { name: "contam-stale-tresPeores", mk: "margenes", turns: ["clientes con bajo margen", "qué tal el clima hoy", "los tres peores"], red: [] },
  { name: "contam-topic-change-falabella", mk: "ventas", turns: ["cómo está Falabella", "cuál es el margen global"], red: [] },
  { name: "contam-topic-change-margenGeneral", mk: "ventas", turns: ["cómo está Lider", "cuál es el margen general de la cartera"], red: [] },

  // C · CONTINUACIÓN LEGÍTIMA (control · debe seguir andando byte-idéntico ON vs OFF)
  { name: "legit-deictic-fresh-ordinal", mk: "margenes", turns: ["clientes con bajo margen", "el primero"], red: [] },
  { name: "legit-deictic-fresh-tresPeores", mk: "margenes", turns: ["clientes con bajo margen", "los tres peores"], red: [] },
  { name: "legit-rerank-peor", mk: "ventas", turns: ["mejores clientes", "y el peor de esos?"], red: [] },
  { name: "legit-list-aggregate", mk: "margenes", turns: ["clientes con bajo margen", "cuánto suman?"], red: [] },
  { name: "legit-dive-followup", mk: "ventas", turns: ["cómo está Falabella", "y la carga?"], red: [] },
  { name: "legit-dive-followup-2step", mk: "ventas", turns: ["cómo está Falabella", "y la carga?", "y el margen?"], red: [] },
  { name: "legit-overview-deepen", mk: "margenes", turns: ["cómo está el margen", "profundizá"], red: [] },
];

const out = {};
const redRows = [];
for (const ch of CHAINS) {
  let ctx = { activeModule: ch.mk };
  const seq = [];
  for (let t = 0; t < ch.turns.length; t++) {
    const q = ch.turns[t];
    const res = mod.answerADI(q, ctx, { scenario: "bonanza" });
    const text = res.text == null ? null : modRendered(res.text);
    const isRed = ch.red.includes(t);
    const leak = isRed && text ? INV_NUM.test(text) : false;
    seq.push({ q, route: res.route, text, isRed, leak });
    if (isRed) redRows.push({ chain: ch.name, turn: t + 1, q, route: res.route, leak, head: norm(text || "(null)").slice(0, 80) });
    ctx = res.context || ctx;
  }
  out[ch.name] = seq;
}

const outFile = process.argv[2] || "_mt_dump.json";
fs.writeFileSync(path.join(root, outFile), JSON.stringify(out, null, 2));

// ── Reporte ──
console.log("█".repeat(74));
console.log(`FASE 2.2a · CADENAS MULTI-TURNO · dump → ${outFile}`);
console.log("█".repeat(74));
for (const ch of CHAINS) {
  console.log(`\n■ ${ch.name}  [${ch.mk}]`);
  out[ch.name].forEach((s, t) => {
    const tag = s.isRed ? (s.leak ? "🚨FUGA" : "🛡️AVISA") : "  ";
    console.log(`   T${t + 1} ${tag} (${s.route}) «${s.q}»`);
    console.log(`        → ${norm(s.text || "(null)").slice(0, 110)}`);
  });
}
console.log("\n" + "═".repeat(74));
const leaks = redRows.filter(r => r.leak);
console.log(`🚨 GATE ROJO ANTI-FUGA · ${redRows.length} continuaciones de inventario chequeadas · FUGAS: ${leaks.length}`);
if (leaks.length) leaks.forEach(r => console.log(`   🚨 FUGA «${r.chain}» T${r.turn} (${r.route}): ${r.head}`));
else console.log(`   🛡️ CERO fuga · todas las continuaciones de inventario AVISAN`);
console.log("═".repeat(74));
process.exit(0);
