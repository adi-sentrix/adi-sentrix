// FASE 2.1d · evidence payload. Dual-state (evidence ON/OFF · spine RESPONDE flags siempre ON acá).
import { answerADI } from "./src/adi/answerADI.js";
import { ADI_SPINE_EVIDENCE_ENABLED } from "./src/config/voiceFlags.js";
import fs from "fs";
const EV = ADI_SPINE_EVIDENCE_ENABLED;
const run = (q) => answerADI(q, {}, { scenario: "bonanza" });
let pass = 0, fail = 0;
const ck = (l, c, d) => { if (c) pass++; else fail++; console.log(`${c ? "✓" : "✗ FAIL"} ${l}${c ? "" : "  · " + (d || "")}`); };

console.log(`════ 2.1d · evidence ${EV ? "ON" : "OFF"} ════`);

if (EV) {
  // helper: valida un payload contra los valores esperados + lo imprime
  const checkEv = (q, exp) => {
    const r = run(q); const e = r.evidence;
    console.log(`\n【${q}】 route=${r.route}`);
    console.log(`  text: ${(r.text||"").replace(/\s+/g," ").slice(0,75)}`);
    console.log(`  evidence: ${JSON.stringify(e)}`);
    if (!e) { ck(`  payload presente`, false, "evidence null"); return; }
    for (const [k, v] of Object.entries(exp)) {
      const got = k.split(".").reduce((o, kk) => (o == null ? o : o[kk]), e);
      const ok = typeof v === "function" ? v(got) : JSON.stringify(got) === JSON.stringify(v);
      ck(`  ${k} = ${String(JSON.stringify(v) ?? "fn/undefined").slice(0,40)}`, ok, `got ${JSON.stringify(got)}`);
    }
  };

  console.log("\n══ RESPONDE marca/familia (2.1a) ══");
  checkEv("qué marca tiene peor contribución", { metrica: "contribucion", dimension: "marca", "filtros.marcas": undefined, fuente: "clientesMargen", filas_usadas: 4, periodo: "bonanza", "query_plan.operacion": "rank_bottom", unsupported_clauses: [], confianza: "determinística", formula: f => /venta/.test(f||"") });

  console.log("\n══ RESPONDE filtro superlativo (2.1b) ══");
  checkEv("el peor margen de Bosch", { metrica: "margen", dimension: "sku", "filtros.marcas": ["Bosch"], fuente: "skusMargen", filas_usadas: 2, "query_plan.operacion": "rank_bottom", unsupported_clauses: [], formula: f => /venta/.test(f||"") });
  checkEv("qué cliente Samsung vende más", { metrica: "ventas", dimension: "cliente", "filtros.marcas": ["Samsung"], fuente: "clientesMargen", filas_usadas: 4, "query_plan.operacion": "rank_top", unsupported_clauses: [] });

  console.log("\n══ RESPONDE filtro tabla (2.1b) ══");
  checkEv("carga comercial de los clientes de Bosch", { metrica: "carga", dimension: "cliente", "filtros.marcas": ["Bosch"], fuente: "clientesMargen", filas_usadas: 2, "query_plan.operacion": "retrieve", unsupported_clauses: [] });

  console.log("\n══ ACLARAR (2.1b-2) ══");
  checkEv("el mejor SKU de Bosch", { dimension: "sku", "filtros.marcas": ["Bosch"], "query_plan.operacion": "clarify", "unsupported_clauses.0.kind": "metric_missing", metrica: null });

  console.log("\n══ AVISAR inventario ══");
  checkEv("qué SKU de Bosch rota peor", { metrica: "rotacion", dimension: "sku", fuente: "skuInventario", "query_plan.operacion": "avisar", "unsupported_clauses.0.kind": "domain_unavailable", "unsupported_clauses.0.raw": "inventario" });

  console.log("\n══ AVISAR combinado ══");
  checkEv("ventas de Samsung en Falabella", { "query_plan.operacion": "avisar", "unsupported_clauses.0.kind": "cross_dimension" });

  console.log("\n══ Camino viejo (non-spine) → evidence null ══");
  for (const q of ["el cliente con peor margen", "cómo está Samsung", "Falabella vs Lider"]) {
    const r = run(q); ck(`«${q}» → evidence null (route=${r.route})`, (r.evidence == null), `evidence=${JSON.stringify(r.evidence)}`);
  }
}

// dump para shadow-diff de TEXTO (evidence no debe cambiar el text)
const PROBE = [
  "qué marca tiene peor contribución", "el peor margen de Bosch", "qué cliente Samsung vende más", "carga comercial de los clientes de Bosch",
  "el mejor SKU de Bosch", "qué SKU de Bosch rota peor", "ventas de Samsung en Falabella", "qué SKU de LG más débil en margen",
  "qué familia aporta menos", "el cliente con peor margen", "cómo está Samsung", "Falabella vs Lider", "ventas por cliente de Samsung",
  "cómo están las ventas", "contribución por marca", "mejores clientes", "el margen de Bosch", "cuál es el SKU con peor rotación",
];
const dump = {};
for (const q of PROBE) { const r = run(q); dump[q] = { route: r.route, text: r.text, hasEv: r.evidence != null }; }
fs.writeFileSync(EV ? "_spine_ev_ON.json" : "_spine_ev_OFF.json", JSON.stringify(dump, null, 2));
console.log(`\n→ dump ${EV ? "ev_ON" : "ev_OFF"}`);
console.log(`\n── 2.1d ${EV ? "ON" : "OFF"}: ${pass} ok / ${fail} fail ──`);
process.exit(fail ? 1 : 0);
