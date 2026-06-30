// === PRUEBA CONTUNDENTE C · TRAZABILIDAD · "cada cifra cierra con su cuenta" (§10/§11.5) ===
// Recalcula CADA cifra DESDE EL DATO CRUDO (sin pasar por reading.js) y verifica la triple igualdad:
//   número del reading == número en el TEXTO de ADI == recálculo independiente desde el dataset.
// Si algo no cierra, es una cifra no trazable → FALLA contundente.
import { JSDOM } from "jsdom"; import esbuild from "esbuild"; import { fileURLToPath, pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "http://localhost/", pretendToBeVisual: true });
const W = dom.window; globalThis.window = W; globalThis.document = W.document;
try { Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = W.HTMLElement; globalThis.Node = W.Node; globalThis.getComputedStyle = W.getComputedStyle.bind(W);
globalThis.localStorage = W.localStorage; globalThis.IS_REACT_ACT_ENVIRONMENT = false; console.error = () => {};
const root = path.dirname(fileURLToPath(import.meta.url)); const bp = path.join(root, "_oracle_bundle.mjs");
await esbuild.build({ entryPoints: [path.join(root, "_oracle_entry.jsx")], bundle: true, outfile: bp, format: "esm", platform: "browser", jsx: "automatic", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"], alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "silent" });
const mod = await import(pathToFileURL(bp).href);
const React = (await import("react")).default; const { renderToStaticMarkup } = await import("react-dom/server");
// imports DIRECTOS del dato crudo + builders (puros · el recálculo es independiente del answerADI)
const { skusMargen } = await import(pathToFileURL(path.join(root, "src/data/skusMargen.js")).href);
const dd = await import(pathToFileURL(path.join(root, "src/data/demoData.js")).href);
const { applyScenarioToSkuInventario, applyScenarioToClientesMargen } = await import(pathToFileURL(path.join(root, "src/engine/scenarios.js")).href);
const cmBon = applyScenarioToClientesMargen("bonanza");   // el cliente que ve el usuario en bonanza (escenario por defecto)
const { buildReadingFromSignals, buildSkuContribSignals, buildClientContribSignals, buildComparisonReading } = await import(pathToFileURL(path.join(root, "src/adi/sentrix/reading.js")).href);
function txt(t) { if (t == null) return ""; const d = document.createElement("div"); d.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text: t })); return d.textContent; }
const ask = (q, mk) => mod.answerADI(q, { activeModule: mk }, { scenario: "bonanza" });
const round = (n) => Math.round(n);
const r1 = (n) => +n.toFixed(1);

const CASES = [];
const ck = (name, pass, detail) => CASES.push({ name, pass, detail: pass ? "" : detail });

// ── 1. SKU margen (cost_structure) · recálculo desde skusMargen ──
{
  const r = ask("el peor SKU por margen", "margenes"); const rd = r.evidence && r.evidence.reading; const T = txt(r.text);
  const s = skusMargen.find(x => x.nombre === rd.focus);
  const costRaw = round((s.costo / s.venta) * 100), rebRaw = round((s.rebates / s.venta) * 100), gapRaw = r1(s.benchmark - s.margen);
  const fam = skusMargen.filter(x => x.marca === s.marca && x.nombre !== s.nombre);
  const famRaw = fam.length ? round(fam.reduce((a, x) => a + x.margen, 0) / fam.length) : null;
  ck(`SKU·costo: reading(${rd.decomposition.costo}) == crudo(${costRaw}) == texto`, rd.decomposition.costo === costRaw && T.includes(`${costRaw}%`), `rd=${rd.decomposition.costo} crudo=${costRaw} enTexto=${T.includes(costRaw+"%")}`);
  ck(`SKU·rebate: reading(${rd.decomposition.rebate}) == crudo(${rebRaw})`, rd.decomposition.rebate === rebRaw, `rd=${rd.decomposition.rebate} crudo=${rebRaw}`);
  ck(`SKU·gap vs benchmark: reading(${rd.gap}) == crudo(${gapRaw}) == texto`, rd.gap === gapRaw && T.includes(`${gapRaw}pp`), `rd=${rd.gap} crudo=${gapRaw} enTexto=${T.includes(gapRaw+"pp")}`);
  ck(`SKU·margen: reading(${rd.pct}) == crudo(${s.margen}) == texto`, rd.pct === s.margen && T.includes(`${s.margen}%`), `rd=${rd.pct} crudo=${s.margen}`);
  ck(`SKU·promedio familia: reading(${famRaw}) en texto`, famRaw == null || T.includes(`${famRaw}%`), `famRaw=${famRaw}`);
}

// ── 2. cliente margen (carga) · campos directos de clientesMargen ──
{
  const r = ask("el peor cliente por margen", "margenes"); const rd = r.evidence && r.evidence.reading; const T = txt(r.text);
  const c = cmBon.find(x => x.nombre === rd.focus);   // recálculo contra el dato del escenario (bonanza)
  ck(`cliente·margen: reading(${rd.pct}) == crudo(${c.margen}) == texto`, rd.pct === c.margen && T.includes(`${c.margen}%`), `rd=${rd.pct} crudo=${c.margen}`);
  ck(`cliente·carga: reading(${rd.carga}) == crudo pctRebate(${c.pctRebate}) == texto`, rd.carga === c.pctRebate && T.includes(`${c.pctRebate}%`), `rd=${rd.carga} crudo=${c.pctRebate}`);
  ck(`cliente·recuperable en texto (${rd.recoverableK}K)`, T.includes(`$${rd.recoverableK}K`), `recK=${rd.recoverableK} text?`);
}

// ── 3. capital por bodega (capital_concentration) · recálculo de la agregación inmovilizado Def2 ──
{
  const r = ask("qué bodega está más complicada", "inventario"); const rd = r.evidence && r.evidence.reading; const T = txt(r.text);
  const esInmov = (x) => x.alerta === "crit" || x.alerta === "warn" || x.rotacion < 2;
  const inv = applyScenarioToSkuInventario("bonanza").filter(esInmov);
  const total = inv.reduce((a, x) => a + x.stockUSD, 0);
  const by = {}; for (const x of inv) (by[x.bodega] = by[x.bodega] || []).push(x);
  const bods = Object.entries(by).map(([b, rows]) => ({ b, cap: rows.reduce((a, x) => a + x.stockUSD, 0) })).sort((a, z) => z.cap - a.cap);
  const focus = bods[0]; const pctRaw = round((focus.cap / total) * 100);
  const fmt = (n) => "$" + (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + "K" : round(n));
  ck(`capital·foco: reading(${rd.focus}) == crudo(${focus.b})`, rd.focus === focus.b, `rd=${rd.focus} crudo=${focus.b}`);
  ck(`capital·monto: reading(${rd.monto}) == crudo(${focus.cap}) == texto(${fmt(focus.cap)})`, rd.monto === focus.cap && T.includes(fmt(focus.cap)), `rd=${rd.monto} crudo=${focus.cap}`);
  ck(`capital·%: reading(${rd.pct}) == crudo(${pctRaw}) == texto`, rd.pct === pctRaw && T.includes(`${pctRaw}%`), `rd=${rd.pct} crudo=${pctRaw}`);
  ck(`capital·total inmovilizado: reading(${rd.totalInmov}) == crudo(${total})`, rd.totalInmov === total, `rd=${rd.totalInmov} crudo=${total}`);
}

// ── 4. SKU contribución (margin_compression) · recálculo desde skusMargen ──
{
  const rd = buildReadingFromSignals(buildSkuContribSignals("MAK-COMP-AIR"));
  const s = skusMargen.find(x => x.nombre === "MAK-COMP-AIR");
  const gapRaw = r1(s.benchmark - s.margen), recRaw = round(s.venta * (gapRaw / 100));
  ck(`SKU contrib·brecha: reading(${rd.gap}) == crudo(${gapRaw})`, rd.gap === gapRaw, `rd=${rd.gap} crudo=${gapRaw}`);
  ck(`SKU contrib·recuperable: reading(${rd.recoverableK}) == crudo(${recRaw})`, rd.recoverableK === recRaw, `rd=${rd.recoverableK} crudo=${recRaw}`);
}

// ── 5. cliente contribución (margin_compression) · recálculo desde clientesMargen ──
{
  const rd = buildReadingFromSignals(buildClientContribSignals("Lider"));
  const c = cmBon.find(x => x.nombre === "Lider");   // bonanza-adjusted (lo que ve el usuario)
  const gapRaw = r1(c.benchmark - c.margen), recRaw = round(c.venta * (gapRaw / 100));
  ck(`cliente contrib·brecha: reading(${rd.gap}) == crudo(${gapRaw})`, rd.gap === gapRaw, `rd=${rd.gap} crudo=${gapRaw}`);
  ck(`cliente contrib·recuperable: reading(${rd.recoverableK}) == crudo(${recRaw})`, rd.recoverableK === recRaw, `rd=${rd.recoverableK} crudo=${recRaw}`);
}

// ── 6. comparación SKU · gap recalculado desde skusMargen ──
{
  const rd = buildComparisonReading("sku", "MAK-COMP-AIR", "BOS-SANDER");
  const a = skusMargen.find(x => x.nombre === "MAK-COMP-AIR"), b = skusMargen.find(x => x.nombre === "BOS-SANDER");
  const gapRaw = r1(Math.abs(a.margen - b.margen)); const betterRaw = a.margen >= b.margen ? a.nombre : b.nombre;
  ck(`compara SKU·gap: reading(${rd.gap}) == crudo(${gapRaw})`, rd.gap === gapRaw, `rd=${rd.gap} crudo=${gapRaw}`);
  ck(`compara SKU·mejor: reading(${rd.better}) == crudo(${betterRaw})`, rd.better === betterRaw, `rd=${rd.better} crudo=${betterRaw}`);
}

// ── 7. comparación bodega · gap de capital recalculado ──
{
  const rd = buildComparisonReading("bodega", "Valparaíso", "Santiago", "bonanza");
  const esInmov = (x) => x.alerta === "crit" || x.alerta === "warn" || x.rotacion < 2;
  const inv = applyScenarioToSkuInventario("bonanza").filter(esInmov);
  const cap = (b) => inv.filter(x => x.bodega === b).reduce((a, x) => a + x.stockUSD, 0);
  const gapRaw = r1(Math.abs(cap("Valparaíso") - cap("Santiago")));
  ck(`compara bodega·gap capital: reading(${rd.gap}) == crudo(${gapRaw})`, rd.gap === gapRaw, `rd=${rd.gap} crudo=${gapRaw}`);
}

fs.writeFileSync(path.join(root, "_C_dump.json"), JSON.stringify(CASES, null, 2));
console.log("█".repeat(66)); console.log("PRUEBA C · TRAZABILIDAD · cada cifra == texto == recálculo desde el dato"); console.log("█".repeat(66));
for (const c of CASES) console.log(`${c.pass ? "✅" : "🚨 FALLA"} ${c.name}${c.pass ? "" : "  · " + c.detail}`);
const fails = CASES.filter(c => !c.pass);
console.log("═".repeat(66)); console.log(`RESULTADO C: ${CASES.length - fails.length}/${CASES.length}` + (fails.length ? ` · 🚨 ${fails.length} cifra(s) NO trazable(s)` : " · TODAS LAS CIFRAS CIERRAN")); console.log("═".repeat(66));
process.exit(fails.length ? 1 : 0);
