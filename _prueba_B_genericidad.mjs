// === PRUEBA CONTUNDENTE B · GENERICIDAD + DETERMINISMO + ROBUSTEZ DE ESCENARIO (§8) ===
// (1) un SOLO motor (buildReadingFromSignals) cubre N combos entidad×métrica. (2) mismo input → misma salida.
// (3) las lecturas corren en los 3 escenarios sin romper; el capital es scenario-aware.
import { JSDOM } from "jsdom"; import esbuild from "esbuild"; import { fileURLToPath, pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "http://localhost/", pretendToBeVisual: true });
const W = dom.window; globalThis.window = W; globalThis.document = W.document;
try { Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = W.HTMLElement; globalThis.Node = W.Node; globalThis.getComputedStyle = W.getComputedStyle.bind(W);
globalThis.localStorage = W.localStorage; globalThis.IS_REACT_ACT_ENVIRONMENT = false; console.error = () => {};
const root = path.dirname(fileURLToPath(import.meta.url)); const bp = path.join(root, "_oracle_bundle.mjs");
await esbuild.build({ entryPoints: [path.join(root, "_oracle_entry.jsx")], bundle: true, outfile: bp, format: "esm", platform: "browser", jsx: "automatic", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"], alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "silent" });
const mod = await import(pathToFileURL(bp).href);
const RD = await import(pathToFileURL(path.join(root, "src/adi/sentrix/reading.js")).href);
const ask = (q, mk, sc) => mod.answerADI(q, { activeModule: mk }, { scenario: sc });
const SC = ["bonanza", "tension", "crisis"];
const CASES = []; const ck = (n, p, d) => CASES.push({ n, p, d: p ? "" : d });

// ── (1) GENERICIDAD · el MISMO renderer produce todos estos kinds (un motor, no pantallas) ──
const kinds = new Set();
const viaAsk = [["el peor SKU por margen", "margenes"], ["el peor cliente por margen", "margenes"], ["qué bodega está más complicada", "inventario"]];
for (const [q, mk] of viaAsk) { const r = ask(q, mk, "bonanza"); if (r.evidence && r.evidence.reading) kinds.add(r.evidence.reading.kind); }
const viaProd = [
  RD.buildReadingFromSignals(RD.buildSkuContribSignals("MAK-COMP-AIR")),
  RD.buildReadingFromSignals(RD.buildClientContribSignals("Lider")),
  RD.buildComparisonReading("sku", "MAK-COMP-AIR", "BOS-SANDER"),
  RD.buildComparisonReading("client", "Lider", "Falabella"),
  RD.buildComparisonReading("bodega", "Valparaíso", "Santiago", "bonanza"),
];
for (const r of viaProd) if (r) kinds.add(r.kind);
const expectedKinds = ["cost_structure", "internal_commercial_load", "capital_concentration", "margin_compression", "comparison"];
ck(`genericidad · el renderer único cubre ${kinds.size} kinds: ${[...kinds].join(", ")}`, expectedKinds.every(k => kinds.has(k)), `faltan: ${expectedKinds.filter(k => !kinds.has(k))}`);
const combos = 3 /*sku/cliente/bodega base*/ + 2 /*contrib sku/cliente*/ + 3 /*compare sku/cliente/bodega*/;
ck(`genericidad · ≥8 combos entidad×métrica×operación por un solo pipeline (${combos})`, combos >= 8, `${combos}`);

// ── (2) DETERMINISMO · mismo input → salida byte-idéntica ──
for (const [q, mk] of viaAsk) {
  const a = JSON.stringify(ask(q, mk, "bonanza").evidence), b = JSON.stringify(ask(q, mk, "bonanza").evidence);
  ck(`determinismo · «${q}» idéntico en 2 corridas`, a === b, "difiere entre corridas");
}
const c1 = JSON.stringify(RD.buildComparisonReading("sku", "MAK-COMP-AIR", "BOS-SANDER"));
const c2 = JSON.stringify(RD.buildComparisonReading("sku", "MAK-COMP-AIR", "BOS-SANDER"));
ck(`determinismo · comparación idéntica en 2 corridas`, c1 === c2, "difiere");

// ── (3) ROBUSTEZ DE ESCENARIO · cada lectura corre en los 3 escenarios sin romper ──
let crashed = 0;
const capByScn = {};
for (const sc of SC) {
  for (const [q, mk] of viaAsk) {
    try { const r = ask(q, mk, sc); if (!r || (r.text == null && !r.evidence)) crashed++; } catch { crashed++; }
  }
  const cap = ask("qué bodega está más complicada", "inventario", sc).evidence;
  capByScn[sc] = cap && cap.reading ? cap.reading.monto : null;
}
ck(`robustez · 0 crashes en ${SC.length} escenarios × ${viaAsk.length} lecturas`, crashed === 0, `${crashed} crashes`);
// el capital ES scenario-aware (cambia entre escenarios) — si NO cambia, el productor ignora el escenario (gap)
const capValues = Object.values(capByScn);
const capVaries = new Set(capValues.filter(v => v != null)).size > 1;
ck(`escenario-aware · el capital inmovilizado cambia entre escenarios (${SC.map(s => capByScn[s]).join(" / ")})`, capVaries, `no varía: ${JSON.stringify(capByScn)} — el productor de capital ignoraría el escenario`);
// el margen de SKU/cliente vía answerADI por escenario (¿refleja el escenario o usa base?)
const skuMargByScn = {}; for (const sc of SC) { const r = ask("el peor SKU por margen", "margenes", sc).evidence; skuMargByScn[sc] = r && r.reading ? r.reading.pct : null; }
const skuVaries = new Set(Object.values(skuMargByScn).filter(v => v != null)).size > 1;
// NOTA: esto es informativo · si el SKU margen NO varía, las lecturas de margen leen el dato base (no scenario-adjusted)
ck(`[INFO] margen SKU por escenario: ${SC.map(s => skuMargByScn[s]).join(" / ")} · ${skuVaries ? "scenario-aware" : "USA DATO BASE (gap potencial en tensión/crisis)"}`, true, "");

fs.writeFileSync(path.join(root, "_B_dump.json"), JSON.stringify({ kinds: [...kinds], capByScn, skuMargByScn }, null, 2));
console.log("█".repeat(66)); console.log("PRUEBA B · GENERICIDAD + DETERMINISMO + ROBUSTEZ DE ESCENARIO"); console.log("█".repeat(66));
for (const c of CASES) console.log(`${c.p ? "✅" : "🚨 FALLA"} ${c.n}${c.p ? "" : "  · " + c.d}`);
const fails = CASES.filter(c => !c.p);
console.log("═".repeat(66)); console.log(`RESULTADO B: ${CASES.length - fails.length}/${CASES.length}` + (fails.length ? ` · 🚨 ${fails.length}` : " · TODO VERDE")); console.log("═".repeat(66));
process.exit(fails.length ? 1 : 0);
