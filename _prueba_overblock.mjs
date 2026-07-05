// [LEGACY · NO-GATE · 2026-07-04] Harness ROTO: el bundle del oráculo (_oracle_entry.jsx, que incluye ADISentric) da
// "m.answerADI is not a function" — issue pre-existente del oracle-bundle, NO del producto. NO es un gate vigente
// (los gates del producto son _gate · _spec_gate · _struct_gate · _guard_gate · _boleta_gate). NO usar para CI/readiness.
// Su intención (el HONESTY_GUARD no sobre-bloquea preguntas legítimas) quedó verificada en la auditoría de flags (2026-07-04).
// === PRUEBA · NO SOBRE-BLOQUEO · el guard de honestidad NO debe bloquear preguntas LEGÍTIMAS ===
// El riesgo real del guard: bloquear lo que ADI SÍ puede responder. Corre el corpus legítimo por answerADI
// (guard ON) y verifica que NINGUNA rutee a "honesty_guard". Es la otra mitad del doble gate.
import { JSDOM } from "jsdom"; import esbuild from "esbuild"; import { fileURLToPath, pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://localhost/" }); const W = dom.window;
globalThis.window = W; globalThis.document = W.document; globalThis.localStorage = W.localStorage; console.error = () => {};
const root = path.dirname(fileURLToPath(import.meta.url)); const bp = path.join(root, "_oracle_bundle.mjs");
await esbuild.build({ entryPoints: [path.join(root, "_oracle_entry.jsx")], bundle: true, outfile: bp, format: "esm", platform: "browser", jsx: "automatic", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"], alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "silent" });
const m = await import(pathToFileURL(bp).href);
const extracted = JSON.parse(fs.readFileSync(path.join(root, "_legit_corpus.json"), "utf8"));
// analíticas reales que ADI SÍ responde (donde vive el riesgo de sobre-bloqueo · marca-filtro, etc.)
const analytical = [
  ["el peor SKU por margen", "margenes"], ["el mejor SKU por margen", "margenes"], ["el peor cliente por margen", "margenes"],
  ["el mejor cliente por margen", "margenes"], ["qué bodega está más complicada", "inventario"], ["el peor margen de Bosch", "margenes"],
  ["qué marca tiene peor contribución", "margenes"], ["mejores clientes", "margenes"], ["el margen de Bosch", "margenes"],
  ["qué SKU de Bosch rota peor", "inventario"], ["contribución por marca", "margenes"], ["cuál es el SKU con peor rotación", "inventario"],
  ["la peor bodega por capital", "inventario"], ["el mejor SKU de Bosch", "margenes"], ["los clientes con mayor contribución", "margenes"],
  ["qué familia aporta menos", "margenes"], ["el margen de Lider", "margenes"], ["ventas por cliente", "margenes"],
];
const legit = [...extracted.map(q => [q, "ventas"]), ...analytical];
const blocked = [];
for (const [q, mk] of legit) { const r = m.answerADI(q, { activeModule: mk }, { scenario: "bonanza" }); if (r.route === "honesty_guard") blocked.push(q); }
console.log("█".repeat(64)); console.log(`PRUEBA · NO SOBRE-BLOQUEO · ${legit.length} preguntas legítimas con el guard ON`); console.log("█".repeat(64));
if (blocked.length === 0) console.log("✅ NINGUNA legítima fue bloqueada por el guard");
else { console.log(`🚨 ${blocked.length} legítima(s) SOBRE-BLOQUEADA(s):`); for (const q of blocked) console.log("   ✗ " + q); }
console.log("═".repeat(64));
process.exit(blocked.length ? 1 : 0);
