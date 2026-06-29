// === Etapa 5 · Sentrix Paso 3b · operación COMPARAR · buildComparisonReading ===
// reading.js es puro (sin DOM/React) → import directo. Verifica la comparación SKU↔SKU y cliente↔cliente:
// campos directos del dato (exacto), gap correcto, better/worse, el porqué por el driver real, kind "comparison".
import { buildComparisonReading } from "./src/adi/sentrix/reading.js";
const s = buildComparisonReading("sku", "MAK-COMP-AIR", "BOS-SANDER");   // 7.9% vs BOS-SANDER
const c = buildComparisonReading("client", "Lider", "Falabella");        // 21.5% vs 22.0%
const same = buildComparisonReading("sku", "MAK-COMP-AIR", "MAK-COMP-AIR");
const bod = buildComparisonReading("bodega", "Valparaíso", "Santiago");
const CASES = [
  { name: "SKU · kind comparison + foco 'A vs B'", pass: !!s && s.kind === "comparison" && s.focus === "MAK-COMP-AIR vs BOS-SANDER" },
  { name: "SKU · a/b con margen directo + sub=costo del precio", pass: !!s && s.a.value === 7.9 && s.a.valueFmt === "7.9%" && /costo \d+% del precio/.test(s.a.sub) && /costo/.test(s.b.sub) },
  { name: "SKU · gap = |7.9 − margen(BOS-SANDER)| y better/worse coherentes", pass: !!s && s.gap === +Math.abs(s.a.value - s.b.value).toFixed(1) && (s.better === (s.a.value >= s.b.value ? s.a.entity : s.b.entity)) },
  { name: "SKU · drivers (2 márgenes + Δ costo) y recomendación al peor", pass: !!s && s.drivers.length === 3 && /costo/.test(s.recommendation) && s.sensitive === s.worse },
  { name: "cliente · margen directo (Lider 21.5 vs Falabella 22.0) + sub=carga", pass: !!c && c.a.value === 21.5 && c.b.value === 22.0 && /carga 4\.2%/.test(c.a.sub) && /carga 4\.5%/.test(c.b.sub) },
  { name: "cliente · Falabella mejor margen, gap 0.5pp, Δ por carga", pass: !!c && c.better === "Falabella" && c.gap === 0.5 && /carga/.test(c.recommendation) },
  { name: "control · misma entidad → null", pass: same === null },
  { name: "control · bodega (sin comparación aún) → null", pass: bod === null },
];
console.log("█".repeat(60)); console.log("Sentrix Paso 3b · operación COMPARAR"); console.log("█".repeat(60));
for (const k of CASES) console.log(`${k.pass ? "✅" : "🚨 FALLA"} ${k.name}`);
const fails = CASES.filter(k => !k.pass);
console.log("═".repeat(60)); console.log(`GATES: ${CASES.length - fails.length}/${CASES.length}` + (fails.length ? " · 🚨" : " · TODOS VERDES")); console.log("═".repeat(60));
process.exit(fails.length ? 1 : 0);
