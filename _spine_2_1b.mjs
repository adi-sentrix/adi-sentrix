// FASE 2.1b · validación del spine de filtros. Corre en AMBOS estados:
//   flag ON (3 spine flags) → asserts del oráculo + dump _spine_ON.json
//   flag OFF → dump _spine_OFF.json (para el shadow-diff)
import { answerADI } from "./src/adi/answerADI.js";
import { ADI_CORE_SPINE_ENABLED, ADI_SPINE_FILTER_ENABLED } from "./src/config/voiceFlags.js";
import fs from "fs";

const ON = ADI_CORE_SPINE_ENABLED && ADI_SPINE_FILTER_ENABLED;
const run = (q) => answerADI(q, {}, { scenario: "bonanza" });
let pass = 0, fail = 0;
const ck = (l, c, d) => { if (c) pass++; else fail++; console.log(`${c ? "✓" : "✗ FAIL"} ${l}${c ? "" : "  · " + (d || "")}`); };

console.log(`════ FASE 2.1b · spine filtro ${ON ? "ON" : "OFF"} ════`);

if (ON) {
  console.log("\n— RESPONDE (filtro simple · era 🔴) —");
  const r1 = run("el peor margen de Bosch");
  ck(`«el peor margen de Bosch» → BOS-SANDER (no Lider)`, r1.route === "spine_filter_superlative" && /BOS-SANDER/.test(r1.text) && !/Lider/.test(r1.text), `route=${r1.route} | ${r1.text}`);
  const r2 = run("qué cliente Samsung vende más");
  ck(`«qué cliente Samsung vende más» → Falabella (no brand_dive)`, r2.route === "spine_filter_superlative" && /Falabella/.test(r2.text), `route=${r2.route} | ${r2.text}`);
  const r3 = run("qué SKU de LG es más débil en margen");
  ck(`«qué SKU de LG es más débil en margen» → LG-DRYER8KG`, r3.route === "spine_filter_superlative" && /LG-DRYER8KG/.test(r3.text), `route=${r3.route} | ${r3.text}`);
  const r4 = run("carga comercial de los clientes de Bosch");
  ck(`«carga comercial de los clientes de Bosch» → tabla filtrada (Sodimac/Easy + tag)`, r4.route === "spine_filter_table" && /Sodimac|Easy/.test(r4.text) && /filtrado por: Bosch/i.test(r4.text), `route=${r4.route} | ${r4.text.replace(/\s+/g," ").slice(0,160)}`);

  console.log("\n— AVISA (inventario bajo filtro · vía Availability Map) —");
  const ri = run("qué SKU de Bosch rota peor");
  ck(`«qué SKU de Bosch rota peor» → AVISA Fase 2.5, cero dato`, ri.route === "spine_filter_unavailable" && /Fase 2\.5/.test(ri.text) && !/[\d.]+x\b|rotacion\s+[\d.]/i.test(ri.text), `route=${ri.route} | ${ri.text}`);

  console.log("\n— AVISA (combinado marca+cliente · el dato no tiene el cruce → 2.1c) —");
  for (const q of ["ventas de Samsung en Falabella", "ventas de LG en Falabella"]) {
    const r = run(q);
    const fuga = /\$[\d.]+[MK]/.test(r.text);  // no debe tirar un número del cruce
    ck(`«${q}» → combinado AVISA, no inventa el cruce`, r.route === "spine_filter_combinado_avisar" && !fuga, `route=${r.route} | ${r.text}`);
  }

  console.log("\n— NO ROMPE (cae al viejo · NO es spine_filter) —");
  for (const q of ["Falabella vs Lider", "Samsung vs LG", "mejores clientes", "ventas por marca", "cómo está Samsung", "el cliente con peor margen", "cómo le va a Falabella", "contribución por marca", "cuál es el SKU con peor rotación", "el margen de Bosch"]) {
    const r = run(q);
    ck(`«${q}» → ${r.route} (no spine_filter)`, !String(r.route || "").startsWith("spine_filter"), r.text ? r.text.slice(0,60) : "(vacío)");
  }
}

// ── dump para shadow-diff ──
const PROBE = [
  // 2.1b RESPONDE/AVISA
  "el peor margen de Bosch", "qué cliente Samsung vende más", "qué SKU de LG es más débil en margen", "carga comercial de los clientes de Bosch",
  "qué SKU de Bosch rota peor", "ventas de Samsung en Falabella", "ventas de LG en Falabella",
  // 2.1a (sigue)
  "qué marca tiene peor contribución", "qué marca tiene mejor margen", "qué familia aporta menos",
  // CONTROLES — no deben cambiar
  "Falabella vs Lider", "Samsung vs LG", "mejores clientes", "ventas por marca", "cómo está Samsung", "el cliente con peor margen",
  "cómo le va a Falabella", "contribución por marca", "cuál es el SKU con peor rotación", "el margen de Bosch", "top 5 clientes",
  "el peor margen de Bosch sin filtro",
  // 42 re-test representativo
  "ventas de Samsung en Falabella", "margen de Bosch para Lider", "qué está mal con Samsung", "dónde se está perdiendo plata",
  "quién me está dañando el margen", "qué cliente está raro", "ventas de Easy", "margen de ABC", "Paris por cliente",
  "cliente Lider margen", "marca Lider ventas", "ventas por cliente de Samsung", "margen por SKU de Bosch", "por qué cae mi margen",
  "cómo están las ventas", "cómo está el margen", "qué pasa si pierdo a Falabella",
];
const dump = {};
for (const q of PROBE) { const r = run(q); dump[q] = { route: r.route, text: r.text }; }
const outFile = ON ? "_spine_ON.json" : "_spine_OFF.json";
fs.writeFileSync(outFile, JSON.stringify(dump, null, 2));
console.log(`\n→ dump: ${outFile}`);
console.log(`\n── 2.1b ${ON ? "ON" : "OFF"}: ${pass} ok / ${fail} fail ──`);
process.exit(fail ? 1 : 0);
