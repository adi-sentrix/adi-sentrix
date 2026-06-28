// FASE 2.1a · validación del spine (superlativo por dimensión). Corre en AMBOS estados de flag:
//   flag ON  → asserts del oráculo + dump _spine_ON.json
//   flag OFF → dump _spine_OFF.json (para el shadow-diff)
import { answerADI } from "./src/adi/answerADI.js";
import { ADI_CORE_SPINE_ENABLED, ADI_SPINE_DIM_SUPERLATIVE_ENABLED, ADI_INV_ROTACION_ENABLED } from "./src/config/voiceFlags.js";
import { METRIC_REGISTRY } from "./src/config/semantic/metricRegistry.js";
import { DIMENSION_REGISTRY } from "./src/config/semantic/dimensionRegistry.js";
import { isAvailable } from "./src/adi/core/availabilityMap.js";
import { QI_METRIC_VOCAB, QI_DIMENSION_VOCAB } from "./src/adi/composers/qiRetrieval.js";
import { RANKING_EXTREMES_METRICS } from "./src/config/rankingData.js";
import fs from "fs";

const ON = ADI_CORE_SPINE_ENABLED && ADI_SPINE_DIM_SUPERLATIVE_ENABLED;
const run = (q) => answerADI(q, {}, { scenario: "bonanza" });
let pass = 0, fail = 0;
const ck = (l, c, d) => { if (c) pass++; else fail++; console.log(`${c ? "✓" : "✗ FAIL"} ${l}${c ? "" : "  · " + (d || "")}`); };

console.log(`════ FASE 2.1a · spine ${ON ? "ON" : "OFF"} ════`);

// ── PARTE 1 · consistencia registros ↔ configs vivos (sin drift) · flag-independiente ──
console.log("\n— consistencia Semantic Layer ↔ configs vivos —");
const _RANK_KEY = { contribucion: "contribucion", margen: "margen", ventas: "ventas", carga: "carga", rotacion: "rotacion", doh: "doh", stock: "stockUSD" };
for (const [key, def] of Object.entries(METRIC_REGISTRY)) {
  if (def.qiKey) ck(`metric[${key}] vocab ⊇ QI_METRIC_VOCAB[${def.qiKey}]`, (QI_METRIC_VOCAB[def.qiKey] || []).every(t => def.vocabulary.includes(t)), JSON.stringify(QI_METRIC_VOCAB[def.qiKey]));
  const rk = _RANK_KEY[key];
  if (rk && RANKING_EXTREMES_METRICS[rk]) ck(`metric[${key}].domain == RANKING_EXTREMES[${rk}].domain`, def.domain === RANKING_EXTREMES_METRICS[rk].domain, `${def.domain} vs ${RANKING_EXTREMES_METRICS[rk].domain}`);
}
for (const [key, def] of Object.entries(DIMENSION_REGISTRY)) {
  ck(`dim[${key}] vocab ⊇ QI_DIMENSION_VOCAB[${def.qiKey}]`, (QI_DIMENSION_VOCAB[def.qiKey] || []).every(t => def.vocabulary.includes(t)));
}
ck("dim marca/familia NO reachableByLegacy (guard de mismatch)", DIMENSION_REGISTRY.marca.reachableByLegacy === false && DIMENSION_REGISTRY.familia.reachableByLegacy === false);
ck("dim cliente/sku SÍ reachableByLegacy", DIMENSION_REGISTRY.cliente.reachableByLegacy === true && DIMENSION_REGISTRY.sku.reachableByLegacy === true);

console.log("\n— Availability Map —");
ck("isAvailable(ventas) === true", isAvailable("ventas") === true);
ck("isAvailable(margenes) === true", isAvailable("margenes") === true);
ck("isAvailable(inventario) === false (bloqueado Fase 2.5)", isAvailable("inventario") === false);

// ── PARTE 2 · oráculo del spine (solo asserts con flag ON) ──
if (ON) {
  console.log("\n— oráculo · RESPONDE (era 🔴 o ausente) —");
  const r1 = run("qué marca tiene peor contribución");
  ck(`«qué marca tiene peor contribución» → spine · Bosch`, r1.route === "spine_dim_superlative" && /\bBosch\b/.test(r1.text) && !/Unimarc/.test(r1.text), `route=${r1.route} | ${r1.text}`);
  // número idéntico a la tabla "contribución por marca" (Bosch $3M)
  ck(`  ↳ número idéntico a la tabla (Bosch $3M)`, /Bosch[^.]*\$3M/.test(r1.text), r1.text);
  const r2 = run("qué marca tiene mejor margen");
  ck(`«qué marca tiene mejor margen» → spine`, r2.route === "spine_dim_superlative", `route=${r2.route} | ${r2.text}`);
  const r3 = run("qué familia aporta menos");
  ck(`«qué familia aporta menos» → spine (familia + aporte)`, r3.route === "spine_dim_superlative", `route=${r3.route} | ${r3.text}`);

  console.log("\n— oráculo · AVISA (inventario NO modelado · vía Availability Map/muro, sin fuga) —");
  // marca/familia-rotación y DOH NO se modelan en 2.5a → AVISAN. La ruta del AVISA depende de qué gate lo caza
  // (spine_dim_unavailable en spine-solo · el muro qi_inventory_avisar con QI_FILTER ON) — el intent es "AVISA cero dato".
  for (const q of ["qué marca tiene peor rotación", "qué familia tiene peor doh"]) {
    const r = run(q);
    const fuga = /rotacion\s+[\d.]|doh\s+[\d.]|\$\d+K?\s+(?:inmoviliz|stock)|[\d.]+x\b/i.test(r.text);
    const avisa = (r.route === "spine_dim_unavailable" || r.route === "qi_inventory_avisar" || r.route === "qi_inventory_filter_avisar");
    // message-agnostic: el marcador del AVISA es la RUTA + cero fuga de dato (con smart-guide el texto ya no dice "Fase 2.5").
    ck(`«${q}» → AVISA, cero dato (route=${r.route})`, avisa && !fuga, `route=${r.route} | ${r.text}`);
  }

  console.log("\n— oráculo · NO ROMPE (2.1a NO reclama · cae al viejo o a OTRO resolver legítimo) —");
  for (const q of ["el cliente con peor margen", "cuál es el SKU con peor rotación", "contribución por marca", "los 3 peores clientes por margen", "qué cliente Samsung vende más", "el peor margen de Bosch"]) {
    const r = run(q);
    // ADI Core 2.5a · "cuál es el SKU con peor rotación" la modela 2.5a (spine_inv) cuando rotación está ON
    // (supersesión: rotación responde por SKU). 2.1a NO la reclama de todos modos. Flag-aware.
    if (q === "cuál es el SKU con peor rotación" && ADI_INV_ROTACION_ENABLED) {
      ck(`«${q}» → spine_inv (2.5a · rotación modelada · 2.1a no la reclama)`, r.route === "spine_inv_superlative", r.text);
      continue;
    }
    ck(`«${q}» → 2.1a NO reclama (route=${r.route})`, r.route !== "spine_dim_superlative", r.text);
  }
}

// ── PARTE 3 · dump para shadow-diff (42 re-test representativo + probes marca/familia) ──
const PROBE = [
  // spine RESPONDE/AVISA
  "qué marca tiene peor contribución", "qué marca tiene mejor margen", "qué familia aporta menos", "qué marca tiene peor rotación", "qué familia tiene peor doh",
  // las que YA andaban (no deben cambiar)
  "el cliente con peor margen", "cuál es el SKU con peor rotación", "contribución por marca", "los 3 peores clientes por margen",
  "qué cliente Samsung vende más", "el peor margen de Bosch", "qué marca tiene peor contribución de Samsung",
  // 42 re-test representativo
  "ventas de Samsung en Falabella", "margen de Bosch para Lider", "qué está mal con Samsung", "dónde se está perdiendo plata",
  "quién me está dañando el margen", "qué cliente está raro", "qué producto me conviene mirar", "ventas de Easy", "margen de ABC",
  "Paris por cliente", "cliente Lider margen", "marca Lider ventas", "ventas por cliente de Samsung", "margen por SKU de Bosch",
  "por qué cae mi margen", "qué hago mañana", "cómo están las ventas", "cómo está el margen", "mejores clientes", "cómo le va a Falabella",
];
const dump = {};
for (const q of PROBE) { const r = run(q); dump[q] = { route: r.route, text: r.text }; }
const outFile = ON ? "_spine_ON.json" : "_spine_OFF.json";
fs.writeFileSync(outFile, JSON.stringify(dump, null, 2));
console.log(`\n→ dump: ${outFile}`);
console.log(`\n── 2.1a ${ON ? "ON" : "OFF"}: ${pass} ok / ${fail} fail ──`);
process.exit(fail ? 1 : 0);
