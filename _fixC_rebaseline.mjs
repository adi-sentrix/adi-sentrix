// Fix C · RE-BASELINE DOCUMENTADO · las queries de inventario del corpus pasan a esperar AVISAR (flag ON).
// Cambio INTENCIONAL de contrato: el piso las responde con datos; ADI Core las AVISA (Fase 2.5).
import { answerADI } from "./src/adi/answerADI.js";
const run = (q) => answerADI(q, { activeModule: "inventario" }, { scenario: "bonanza" });
// [query, batería, esperado VIEJO (piso · ruta/dato), longitud piso]
const REBASELINE = [
  ["cómo está el inventario",                    "47[3]+canónica", "early_gate / overview inventario", 632],
  ["qué pasa con la bodega",                     "canónica",       "early_gate / 41.3% fuera de rango", 580],
  ["Santiago vs Valparaíso",                     "47[6]+canónica", "warehouse_comparison", 513],
  ["cuál es el SKU con peor rotación",           "47[8]+canónica", "ranking_extremes / MAK-COMP-AIR", 488],
  ["dónde tengo capital detenido",               "47[24]",         "cross_domain_query / $56K capital", 1856],
  ["qué productos no rotan",                     "47[25]",         "sku_operational / DOH 108d", 768],
  ["qué SKUs están atrapando más capital",       "47[26]",         "sku_operational / $47K", 768],
  ["qué productos debo liquidar",                "47[27]",         "sku_operational", 425],
  ["dónde tengo riesgo de quiebre",              "47[28]",         "sku_operational", 425],
  ["cuál es la rotación promedio del portafolio","47[29]",         "sku_operational / rotación", 768],
  ["cómo está Santiago",                         "47[35]",         "warehouse_dive / 1198 chars", 1198],
  ["peores SKUs por rotación",                   "47[38]",         "ranking_extremes / 0.8x", 488],
];
let ok = 0, fail = 0, msgs = new Set();
console.log("query".padEnd(46) + " batería".padEnd(18) + " VIEJO (piso)".padEnd(34) + " → NUEVO (ADI Core)");
console.log("─".repeat(120));
for (const [q, bat, viejo, lenViejo] of REBASELINE) {
  const r = run(q);
  const avisa = r.route === "qi_inventory_avisar" || r.route === "qi_inventory_filter_avisar";
  if (avisa) ok++; else fail++;
  msgs.add((r.text || "").trim());
  console.log((avisa ? "✓ " : "✗ ") + ("«" + q + "»").padEnd(44) + " " + bat.padEnd(17) + " " + (viejo + " (" + lenViejo + ")").padEnd(33) + " → " + r.route);
}
console.log("─".repeat(120));
console.log(`Re-baseline: ${ok}/${REBASELINE.length} → AVISAR · voces distintas: ${msgs.size} (debe ser 1 = consistente)`);
console.log("Mensaje único:\n  " + [...msgs][0]);
process.exit(fail || msgs.size !== 1 ? 1 : 0);
