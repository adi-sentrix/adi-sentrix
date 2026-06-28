// === FIX sobre-ruteo margen/SKU · Capa 1 (guard SKU-comercial) + Capa 2 (vocab dirección natural) ===
// Asume flags afuera. Gates: los 5 casos del owner + simétricos RESPONDEN el ranking · inventario real AVISA ·
// inventario disponible RESPONDE por el spine (sin cruce con "menor") · controles intactos. Dump → argv (shadow).
import { JSDOM } from "jsdom"; import esbuild from "esbuild"; import { fileURLToPath, pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "http://localhost/", pretendToBeVisual: true });
const W = dom.window; globalThis.window = W; globalThis.document = W.document;
try { Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = W.HTMLElement; globalThis.Node = W.Node; globalThis.getComputedStyle = W.getComputedStyle.bind(W);
globalThis.requestAnimationFrame = W.requestAnimationFrame.bind(W); globalThis.cancelAnimationFrame = W.cancelAnimationFrame.bind(W);
globalThis.localStorage = W.localStorage; globalThis.IS_REACT_ACT_ENVIRONMENT = false; console.error = () => {};
const root = path.dirname(fileURLToPath(import.meta.url)); const bundlePath = path.join(root, "_oracle_bundle.mjs");
await esbuild.build({ entryPoints: [path.join(root, "_oracle_entry.jsx")], bundle: true, outfile: bundlePath, format: "esm", platform: "browser", jsx: "automatic", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"], alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "silent" });
const mod = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default; const { renderToStaticMarkup } = await import("react-dom/server");
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
function modR(text) { if (text == null) return null; const t = document.createElement("div"); t.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text })); return t.textContent; }
const RANK = (r) => r.route === "ranking_extremes";
const SPINE = (r) => r.route === "spine_inv_superlative" || r.route === "spine_inv_retrieval";
// regla madre message-agnostic: NO responde el cruce con inventario/ranking ni inventa número (vale para el mensaje
// viejo "Fase 2.5" Y para el smart-guide "por canal no tengo, de rotación sí por SKU…").
const AVISA = (r) => !SPINE(r) && r.route !== "ranking_extremes" && !/\d+(?:\.\d+)?x|inmoviliz|\bdoh\b|\d+\s*d[ií]as/i.test(r.text || "");
const peorSKU = (r) => RANK(r) && /MAK-COMP-AIR/.test(r.text) && /7\.9%/.test(r.text);

const CASES = [
  // los 5 casos del owner → ranking de SKU por margen (MAK-COMP-AIR 7.9%)
  { name: "owner-1 menor margen (SKU)", q: "cuáles son los SKU con menor margen", mk: "margenes", check: peorSKU },
  { name: "owner-2 menor margen (productos)", q: "cuáles son los productos con menor margen", mk: "margenes", check: peorSKU },
  { name: "owner-3 están bajos en margen", q: "cuáles son los SKU que están bajos en margen", mk: "margenes", check: peorSKU },
  { name: "owner-4 muéstrame 3 SKU bajo margen", q: "muéstrame 3 SKU con bajo margen", mk: "margenes", check: peorSKU },
  // simétricos: mayor/alto + el paralelo de clientes
  { name: "sim mayor margen (SKU)", q: "los SKU con mayor margen", mk: "margenes", check: (r) => RANK(r) && /MAK-SAW18V/.test(r.text) && /34/.test(r.text) },
  { name: "sim cliente menor margen", q: "el cliente con menor margen", mk: "margenes", check: (r) => RANK(r) && /Lider/.test(r.text) },
  { name: "sim SKU bajo margen (alto/bajo)", q: "los SKU con bajo margen", mk: "margenes", check: peorSKU },
  // tanda 1 · vocab comercial v2 (rentable · plural márgenes · flojo · idiom "dejar plata" · bare "más")
  { name: "t1 dejar plata", q: "qué productos me dejan menos plata", mk: "margenes", check: peorSKU },
  { name: "t1 menos rentable", q: "el producto menos rentable", mk: "margenes", check: peorSKU },
  { name: "t1 más rentable (best)", q: "cuál es mi producto más rentable", mk: "margenes", check: (r) => RANK(r) && /MAK-SAW18V/.test(r.text) && /34/.test(r.text) },
  { name: "t1 márgenes plural", q: "los SKU con los márgenes más bajos", mk: "margenes", check: peorSKU },
  { name: "t1 flojos de margen", q: "qué productos están flojos de margen", mk: "margenes", check: peorSKU },
  { name: "t1 más margen (bare más)", q: "el SKU con más margen", mk: "margenes", check: (r) => RANK(r) && /MAK-SAW18V/.test(r.text) },
  // 🚨 inventario REAL sigue AVISANDO (regla madre · el endurecimiento NO hace responder lo que no debe)
  { name: "🚨REGLA rotación por canal", q: "rotación por canal", mk: "inventario", check: (r) => AVISA(r) && !SPINE(r) },
  { name: "🚨REGLA rotación por marca", q: "rotación por marca", mk: "inventario", check: (r) => AVISA(r) && !SPINE(r) },
  { name: "🚨REGLA inventario por cliente", q: "inventario por cliente", mk: "inventario", check: (r) => AVISA(r) && !SPINE(r) },
  // 🚨 inventario DISPONIBLE sigue respondiendo por el spine (sin cruce con "menor")
  { name: "🚨SPINE menor rotación", q: "los SKU con menor rotación", mk: "inventario", check: (r) => r.route === "spine_inv_superlative" && /MAK-COMP-AIR/.test(r.text) && /0\.8x/.test(r.text) },
  { name: "🚨SPINE menos rotación", q: "los SKU con menos rotación", mk: "inventario", check: (r) => r.route === "spine_inv_superlative" && /0\.8x/.test(r.text) },
  { name: "🚨SPINE capital detenido", q: "dónde tengo capital detenido", mk: "inventario", check: (r) => r.route === "spine_inv_superlative" && /LG-DRYER8KG/.test(r.text) },
  { name: "🚨SPINE bodega complicada", q: "qué bodega está más complicada", mk: "inventario", check: (r) => r.route === "spine_inv_superlative" && /Valparaíso/.test(r.text) },
  { name: "🚨SPINE menor capital (no cruza)", q: "el SKU con menor capital", mk: "inventario", check: (r) => SPINE(r) },
  // controles: lo que ANDABA sigue idéntico
  { name: "CTRL peor SKU margen", q: "el peor SKU por margen", mk: "margenes", check: peorSKU },
  { name: "CTRL peor cliente margen", q: "el peor cliente por margen", mk: "margenes", check: (r) => RANK(r) && /Lider/.test(r.text) },
  { name: "CTRL comercial cliente", q: "el peor cliente por margen", mk: "margenes", check: (r) => RANK(r) },
];

const out = {}; const rows = [];
for (const c of CASES) {
  const res = mod.answerADI(c.q, { activeModule: c.mk }, { scenario: "bonanza" });
  const r = { q: c.q, route: res.route, text: modR(res.text) };
  out[c.name] = r;
  rows.push({ name: c.name, route: r.route, pass: c.check(r), text: r.text });
}
fs.writeFileSync(path.join(root, process.argv[2] || "_fixmargen_dump.json"), JSON.stringify(out, null, 2));
console.log("█".repeat(74)); console.log("FIX sobre-ruteo margen/SKU · 2 capas"); console.log("█".repeat(74));
for (const r of rows) { console.log(`${r.pass ? "✅" : "🚨 FALLA"} ${r.name.padEnd(36)} → ${r.route}`); if (!r.pass) console.log(`        ${norm(r.text || "(null)").slice(0, 90)}`); }
const fails = rows.filter(r => !r.pass);
console.log("═".repeat(74));
console.log(`GATES: ${rows.length - fails.length}/${rows.length}` + (fails.length ? ` · 🚨 ${fails.map(f => f.name).join(", ")}` : " · TODOS VERDES"));
console.log("═".repeat(74));
process.exit(fails.length ? 1 : 0);
