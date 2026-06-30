// === Etapa 5 · Sentrix · operación CAMBIAR MÉTRICA · contribución de cliente (internal_margin_compression) ===
// reading.js puro → import directo. La lectura de contribución sale del pipeline general (mismo renderer) con
// campos DIRECTOS del dato (margen/benchmark/venta de clientesMargen) → matchea la regla del motor sellado.
import { buildReadingFromSignals, buildClientContribSignals, buildSkuContribSignals } from "./src/adi/sentrix/reading.js";
import { applyScenarioToClientesMargen } from "./src/engine/scenarios.js";
const _liderC = applyScenarioToClientesMargen("bonanza").find(x => x.nombre === "Lider");   // dato que ve el usuario (bonanza)
const _liderRec = Math.round(_liderC.venta * (+(_liderC.benchmark - _liderC.margen).toFixed(1)) / 100);
const lider = buildReadingFromSignals(buildClientContribSignals("Lider"));
const fala = buildReadingFromSignals(buildClientContribSignals("Falabella"));
const none = buildClientContribSignals("NoExisteSA");
const skuC = buildReadingFromSignals(buildSkuContribSignals("MAK-COMP-AIR"));   // margen 7.9 vs benchmark 30.1
const CASES = [
  { name: "Lider · kind margin_compression · vía el renderer único", pass: !!lider && lider.kind === "margin_compression" && lider.focusType === "client" && lider.metric === "contribucion" },
  { name: "Lider · margen 21.5 vs benchmark 30.1 · brecha 8.6pp (campos directos)", pass: !!lider && lider.pct === 21.5 && lider.benchmark === 30.1 && lider.gap === 8.6 },
  { name: `Lider · contribución recuperable == recálculo bonanza (${_liderRec}) → scenario-aware`, pass: !!lider && lider.recoverableK === _liderRec && lider.drivers.some(d => /^\$/.test(d.v)) },
  { name: "Lider · reframe + recomendación de la compresión de margen", pass: !!lider && /comprime la contribución/.test(lider.reframe) && /margen unitario/.test(lider.recommendation) },
  { name: "Falabella · margen 22.0 vs 30.1 · brecha 8.1pp", pass: !!fala && fala.pct === 22.0 && fala.gap === 8.1 },
  { name: "control · cliente inexistente → null (honesto)", pass: none === null },
  { name: "SKU · cambiar métrica a contribución (mismo renderer · margen 7.9 vs benchmark 30.1 · brecha 22.2)", pass: !!skuC && skuC.kind === "margin_compression" && skuC.focusType === "sku" && skuC.pct === 7.9 && skuC.benchmark === 30.1 && skuC.gap === 22.2 },
];
console.log("█".repeat(60)); console.log("Sentrix · operación CAMBIAR MÉTRICA (contribución cliente)"); console.log("█".repeat(60));
for (const k of CASES) console.log(`${k.pass ? "✅" : "🚨 FALLA"} ${k.name}`);
const fails = CASES.filter(k => !k.pass);
console.log("═".repeat(60)); console.log(`GATES: ${CASES.length - fails.length}/${CASES.length}` + (fails.length ? " · 🚨" : " · TODOS VERDES")); console.log("═".repeat(60));
process.exit(fails.length ? 1 : 0);
