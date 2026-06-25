// FASE 2.1b-2 · re-test ACLARAR (filtro+superlativo sin métrica). Dual-state.
import { answerADI } from "./src/adi/answerADI.js";
import { ADI_SPINE_FILTER_CLARIFY_ENABLED } from "./src/config/voiceFlags.js";
import fs from "fs";
const ON = ADI_SPINE_FILTER_CLARIFY_ENABLED;
const run = (q) => { const r = answerADI(q, {}, { scenario: "bonanza" }); return { route: r.route, text: (r.text || "").replace(/\s+/g, " ").trim() }; };
let pass = 0, fail = 0;
const ck = (l, c, d) => { if (c) pass++; else fail++; console.log(`${c ? "✓" : "✗ FAIL"} ${l}${c ? "" : "  · " + (d || "")}`); };
const INV = /rotaci|\bdoh\b|\bstock\b|cobertura|inmoviliz/i;

console.log(`════ 2.1b-2 · clarify ${ON ? "ON" : "OFF"} ════`);
if (ON) {
  console.log("\n— ACLARAR (filtro+superlativo SIN métrica) —");
  const CLAR = [
    ["el mejor SKU de Bosch", "Bosch", "SKU"],
    ["cuál es el peor cliente de Philips", "Philips", "cliente"],
    ["el peor producto de LG", "LG", "SKU"],
    ["el mejor producto de Makita", "Makita", "SKU"],
    ["cuál es el mejor cliente de Samsung", "Samsung", "cliente"],
  ];
  for (const [q, filt, dim] of CLAR) {
    const r = run(q);
    const okRoute = r.route === "spine_filter_clarify";
    const askMetrics = /en qué/i.test(r.text) && /ventas/i.test(r.text) && /margen/i.test(r.text) && /contribuci/i.test(r.text);
    const noInv = !INV.test(r.text);
    ck(`«${q}» → pregunta métrica (${filt}/${dim}) sin inventario`, okRoute && askMetrics && noInv, `route=${r.route} | ${r.text}`);
  }

  console.log("\n— 🛡️ CONTROL ANTI-TRAMPA · CON métrica → siguen RESPONDE (NO preguntan) —");
  const RESP = [
    ["el peor margen de Bosch", "BOS-SANDER", "spine_filter_superlative"],
    ["qué cliente Samsung vende más", "Falabella", "spine_filter_superlative"],
    ["qué SKU de LG más débil en margen", "LG-DRYER8KG", "spine_filter_superlative"],
    ["qué producto de Samsung rinde menos en margen", "SAM-TV55", "spine_filter_superlative"],
    ["el SKU de Philips con mejor contribución", "PHI-SHAVER9", "spine_filter_superlative"],
    ["qué cliente de Bosch tiene peor margen", "Sodimac", "spine_filter_superlative"],
  ];
  for (const [q, ent, route] of RESP) {
    const r = run(q);
    ck(`«${q}» → RESPONDE ${ent} (no "en qué")`, r.route === route && r.text.includes(ent) && !/en qué/i.test(r.text), `route=${r.route} | ${r.text.slice(0,80)}`);
  }

  console.log("\n— NO ENTRA a clarify (sin filtro / sin superlativo) —");
  for (const q of ["el mejor cliente", "el margen de Bosch", "mejores clientes", "carga comercial de los clientes de Bosch"]) {
    const r = run(q);
    ck(`«${q}» → no clarify (route=${r.route})`, r.route !== "spine_filter_clarify", r.text.slice(0,60));
  }

  console.log("\n— CONTROLES viejos intactos —");
  for (const [q, route] of [["Falabella vs Lider", "client_comparison"], ["qué marca tiene peor contribución", "spine_dim_superlative"], ["el cliente con peor margen", "ranking_extremes"]]) {
    const r = run(q);
    ck(`«${q}» → ${r.route}`, r.route === route, r.text.slice(0,60));
  }
}

// dump para shadow-diff
const PROBE = [
  "el mejor SKU de Bosch", "cuál es el peor cliente de Philips", "el peor producto de LG", "el mejor producto de Makita", "cuál es el mejor cliente de Samsung",
  "el peor margen de Bosch", "qué cliente Samsung vende más", "qué SKU de LG más débil en margen", "qué producto de Samsung rinde menos en margen",
  "el SKU de Philips con mejor contribución", "qué cliente de Bosch tiene peor margen", "carga comercial de los clientes de Bosch",
  "el mejor cliente", "el margen de Bosch", "mejores clientes", "Falabella vs Lider", "Samsung vs LG", "qué marca tiene peor contribución",
  "el cliente con peor margen", "ventas por cliente de Samsung", "qué SKU de Bosch rota peor", "cómo está Samsung", "contribución por marca",
  "cómo están las ventas", "cómo le va a Falabella", "cuál es el SKU con peor rotación", "ventas de Samsung en Falabella",
];
const dump = {};
for (const q of PROBE) { const r = run(q); dump[q] = { route: r.route, text: r.text }; }
fs.writeFileSync(ON ? "_spine_ON.json" : "_spine_OFF.json", JSON.stringify(dump, null, 2));
console.log(`\n→ dump ${ON ? "ON" : "OFF"}`);
console.log(`\n── 2.1b-2 ${ON ? "ON" : "OFF"}: ${pass} ok / ${fail} fail ──`);
process.exit(fail ? 1 : 0);
