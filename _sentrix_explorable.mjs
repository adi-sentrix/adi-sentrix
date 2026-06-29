// === Etapa 5 · Sentrix Paso 3a · boleta EXPLORABLE (estado de análisis · §7) ===
// Asume flags afuera (régimen + SENTRIX_BOLETA + SENTRIX_READING + SENTRIX_EXPLORE). Gate: la boleta declara
// qué se puede explorar (comparar/métricas) DATA-DRIVEN y bloquea honesto el cruce sin granularidad atómica.
import { JSDOM } from "jsdom"; import esbuild from "esbuild"; import { fileURLToPath, pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://localhost/", pretendToBeVisual: true });
const W = dom.window; globalThis.window = W; globalThis.document = W.document;
try { Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = W.HTMLElement; globalThis.Node = W.Node; globalThis.getComputedStyle = W.getComputedStyle.bind(W);
globalThis.localStorage = W.localStorage; globalThis.IS_REACT_ACT_ENVIRONMENT = false; console.error = () => {};
const root = path.dirname(fileURLToPath(import.meta.url)); const bp = path.join(root, "_oracle_bundle.mjs");
await esbuild.build({ entryPoints: [path.join(root, "_oracle_entry.jsx")], bundle: true, outfile: bp, format: "esm", platform: "browser", jsx: "automatic", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"], alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "silent" });
const m = await import(pathToFileURL(bp).href);
const run = (q, mk) => m.answerADI(q, { activeModule: mk }, { scenario: "bonanza" });
const sku = run("el peor SKU por margen", "margenes").evidence;
const cli = run("el peor cliente por margen", "margenes").evidence;
const bod = run("qué bodega está más complicada", "inventario").evidence;
const xS = sku && sku.explorable, xC = cli && cli.explorable, xB = bod && bod.explorable;
const CASES = [
  // SKU
  { name: "SKU · explorable presente · entityType sku", pass: !!xS && xS.entityType === "sku" },
  { name: "SKU · compare = pares reales del dataset, sin el propio (12)", pass: !!xS && xS.compare.length === 12 && !xS.compare.includes("MAK-COMP-AIR") && xS.compare.includes("BOS-SANDER") },
  { name: "SKU · métricas del tipo (margen, contribucion)", pass: !!xS && JSON.stringify(xS.metrics) === JSON.stringify(["margen", "contribucion"]) },
  { name: "SKU · BLOQUEA honesto 'quién lo compra' (sin granularidad atómica)", pass: !!xS && xS.blocked.some(b => /clientes que compran/.test(b.view) && /atómica/.test(b.reason)) },
  // cliente
  { name: "cliente · explorable presente · entityType client", pass: !!xC && xC.entityType === "client" },
  { name: "cliente · compare = clientes reales sin el propio", pass: !!xC && xC.compare.length === 12 && !xC.compare.includes("Lider") && xC.compare.includes("Falabella") },
  { name: "cliente · métricas incluyen ventas + carga", pass: !!xC && xC.metrics.includes("ventas") && xC.metrics.includes("carga") },
  { name: "cliente · BLOQUEA honesto 'qué le vendo'", pass: !!xC && xC.blocked.some(b => /productos que le vendo/.test(b.view)) },
  // bodega (vía fallback al foco de la lectura · el spine no setea entidad a nivel boleta)
  { name: "bodega · explorable presente vía fallback de la lectura · entityType bodega", pass: !!xB && xB.entityType === "bodega" },
  { name: "bodega · compare = otras bodegas reales (sin Valparaíso)", pass: !!xB && xB.compare.length >= 1 && !xB.compare.includes("Valparaíso") },
  { name: "bodega · métricas capital/rotacion/doh · sin bloqueo de cruce", pass: !!xB && xB.metrics.includes("capital") && xB.blocked.length === 0 },
  // honestidad transversal: histórico por entidad hoy es plano → false en todas
  { name: "histórico por entidad = false (sintético · honesto) en las 3", pass: !!xS && !!xC && !!xB && xS.historyPerEntity === false && xC.historyPerEntity === false && xB.historyPerEntity === false },
];
fs.writeFileSync(path.join(root, process.argv[2] || "_explorable_dump.json"), JSON.stringify({ sku: xS, cliente: xC, bodega: xB }, null, 2));
console.log("█".repeat(64)); console.log("Sentrix Paso 3a · boleta EXPLORABLE (estado de análisis · §7)"); console.log("█".repeat(64));
for (const c of CASES) console.log(`${c.pass ? "✅" : "🚨 FALLA"} ${c.name}`);
const fails = CASES.filter(c => !c.pass);
console.log("═".repeat(64)); console.log(`GATES: ${CASES.length - fails.length}/${CASES.length}` + (fails.length ? " · 🚨" : " · TODOS VERDES")); console.log("═".repeat(64));
process.exit(fails.length ? 1 : 0);
