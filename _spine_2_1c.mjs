// FASE 2.1c · combinado marca+cliente → AVISAR consistente. Dual-state (combined ON/OFF · spine flags ON).
import { answerADI } from "./src/adi/answerADI.js";
import { ADI_SPINE_COMBINED_ENABLED } from "./src/config/voiceFlags.js";
import fs from "fs";
const ON = ADI_SPINE_COMBINED_ENABLED;
const run = (q) => { const r = answerADI(q, {}, { scenario: "bonanza" }); return { route: r.route, text: (r.text || "").replace(/\s+/g, " ").trim(), ev: r.evidence }; };
let pass = 0, fail = 0;
const ck = (l, c, d) => { if (c) pass++; else fail++; console.log(`${c ? "✓" : "✗ FAIL"} ${l}${c ? "" : "  · " + (d || "")}`); };

console.log(`════ 2.1c · combined ${ON ? "ON" : "OFF"} ════`);
if (ON) {
  console.log("\n— COMBINADO marca+cliente → AVISA consistente (en/para/con) —");
  const COMB = ["ventas de Samsung en Falabella", "margen de Bosch para Lider", "contribución de LG para Jumbo", "ventas de Philips en Tottus", "margen de Bosch con Sodimac"];
  for (const q of COMB) {
    const r = run(q);
    const okRoute = r.route === "spine_filter_combinado_avisar";
    const okMsg = /no lo tengo/i.test(r.text) && /(sola|por separado).*detalle de/i.test(r.text);
    const okPay = r.ev && Array.isArray(r.ev.unsupported_clauses) && r.ev.unsupported_clauses[0] && r.ev.unsupported_clauses[0].kind === "cross_dimension";
    ck(`«${q}» → AVISA combinado + payload cross_dimension`, okRoute && okMsg && okPay, `route=${r.route} | ${r.text}`);
  }

  console.log("\n— 🛡️ ANTI-TRAMPA · filtro SIMPLE (una entidad) → sigue RESPONDE, NO avisa combinado —");
  const SIMPLE = [
    ["el peor margen de Bosch", "BOS-SANDER", "spine_filter_superlative"],
    ["qué cliente Samsung vende más", "Falabella", "spine_filter_superlative"],
    ["carga comercial de los clientes de Bosch", "Sodimac", "spine_filter_table"],
    ["qué SKU de LG más débil en margen", "LG-DRYER8KG", "spine_filter_superlative"],
  ];
  for (const [q, ent, route] of SIMPLE) {
    const r = run(q);
    ck(`«${q}» → ${ent} (route=${r.route}, NO combinado)`, r.route === route && r.text.includes(ent) && r.route !== "spine_filter_combinado_avisar", `route=${r.route} | ${r.text.slice(0,70)}`);
  }

  console.log("\n— el mensaje exacto (para que lo veas) —");
  for (const q of ["ventas de Samsung en Falabella", "margen de Bosch para Lider"]) {
    console.log(`  «${q}»\n    → ${run(q).text}`);
  }
}

// dump para shadow-diff (combined ON vs OFF)
const PROBE = [
  "ventas de Samsung en Falabella", "margen de Bosch para Lider", "contribución de LG para Jumbo", "ventas de Philips en Tottus", "margen de Bosch con Sodimac",
  "el peor margen de Bosch", "qué cliente Samsung vende más", "carga comercial de los clientes de Bosch", "qué SKU de LG más débil en margen",
  "el mejor SKU de Bosch", "qué marca tiene peor contribución", "qué SKU de Bosch rota peor", "Falabella vs Lider", "Samsung vs LG",
  "el cliente con peor margen", "ventas por cliente de Samsung", "cómo está Samsung", "contribución por marca", "cómo le va a Falabella",
];
const dump = {};
for (const q of PROBE) { const r = run(q); dump[q] = { route: r.route, text: r.text }; }
fs.writeFileSync(ON ? "_spine_c_ON.json" : "_spine_c_OFF.json", JSON.stringify(dump, null, 2));
console.log(`\n→ dump ${ON ? "c_ON" : "c_OFF"}`);
console.log(`\n── 2.1c ${ON ? "ON" : "OFF"}: ${pass} ok / ${fail} fail ──`);
process.exit(fail ? 1 : 0);
