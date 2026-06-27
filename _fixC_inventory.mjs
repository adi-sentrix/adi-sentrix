// Fix C · MURO DE INVENTARIO · barrido completo (capital/DOH/cobertura/stock/bodega → AVISA, una sola voz).
// ADI Core Fase 2.5a: ROTACIÓN modelada → RESPONDE (flag ON) / AVISA (flag OFF). El resto del muro intacto
// (disolución métrica por métrica: rotación disponible NO habilita capital/DOH/cobertura). Flag-aware.
import { answerADI } from "./src/adi/answerADI.js";
import { ADI_INV_ROTACION_ENABLED } from "./src/config/voiceFlags.js";
const run = (q, mod) => answerADI(q, { activeModule: mod || "inventario" }, { scenario: "bonanza" });
const isData = (t) => /\$\d+[.,]?\d*K|MAK-COMP-AIR|\d+\.\dx|concentran|capital comprometido|DOH promedio/.test(t);
let pass = 0, fail = 0;
const ck = (lbl, cond, det) => { if (cond) pass++; else fail++; console.log(`${cond ? "✓" : "✗ FAIL"} ${lbl}${cond ? "" : "  " + (det || "")}`); };
const ROT = ADI_INV_ROTACION_ENABLED;
const isInvResp = (r) => r.route === "spine_inv_superlative" || r.route === "spine_inv_retrieval";

console.log("════ GATE 1 · BARRIDO · capital/DOH/cobertura/stock/bodega → AVISAR único, sin dato (NO modeladas) ════");
const BARRIDO = {
  "capital": ["cuánto capital inmovilizado tengo", "dónde está concentrado mi capital detenido", "capital inmovilizado por marca", "qué SKUs atrapan más capital", "qué SKUs están atrapando más capital"],
  "DOH/cobertura/rotación-agregada": ["qué SKU tiene más DOH", "cuál es la rotación promedio del portafolio", "qué productos tienen sobre-cobertura", "rotación por marca"],
  "stock/días/quiebre/liquidar": ["cuánto stock detenido tengo", "cuántos días sin venta tengo", "dónde tengo riesgo de quiebre", "qué productos debo liquidar"],
  "bodega/inventario": ["cómo está el inventario", "cómo está Santiago", "Santiago vs Valparaíso"],
};
for (const [cat, qs] of Object.entries(BARRIDO)) {
  console.log(`  ── ${cat} ──`);
  for (const q of qs) {
    const r = run(q);
    const t = r.text || "";
    const avisa = (r.route === "qi_inventory_avisar" || r.route === "qi_inventory_filter_avisar") && !isData(t);
    ck(`«${q}» → ${r.route}`, avisa, `tieneDato=${isData(t)} | ${t.slice(0, 80)}`);
  }
}

console.log(`\n════ ROTACIÓN MODELADA (2.5a) · ${ROT ? "RESPONDE con dato + evidence" : "AVISA (pre-2.5a)"} ════`);
for (const q of ["qué productos no rotan", "qué SKU de Samsung rota peor"]) {
  const r = run(q); const t = r.text || "";
  const ok = ROT ? (isInvResp(r) && /\d\.\dx/.test(t)) : ((r.route === "qi_inventory_avisar" || r.route === "qi_inventory_filter_avisar") && !isData(t));
  ck(`«${q}» → ${r.route}`, ok, `route=${r.route}`);
}

console.log("\n════ VAGO/AMBIGUO (sin métrica) · honest_fallback SIN dato es aceptable ════");
for (const q of ["cuál es el peor SKU", "cuál es el mejor SKU", "cuál es el peor producto"]) {
  const r = run(q);
  const t = r.text || "";
  ck(`«${q}» → ${r.route} · sin dato`, !isData(t), `tieneDato=${isData(t)}`);
}

console.log("\n════ GATE 3 · PRESERVADOS comerciales (NO se interceptan · responden con datos) ════");
const PRESERV = [
  ["cliente con peor margen", "margenes"],
  ["cuál es el cliente con peor margen", "margenes"],
  ["top 3 SKU por margen", "margenes"],
  ["por qué cae mi margen", "margenes"],
  ["ventas por cliente de Samsung", "ventas"],
  ["margen por marca", "margenes"],
];
for (const [q, mod] of PRESERV) {
  const r = run(q, mod);
  const ok = r.route !== "qi_inventory_avisar" && r.route !== "qi_inventory_filter_avisar" && !isInvResp(r);
  ck(`«${q}» → ${r.route} (preservado)`, ok, "se interceptó de más!");
}
console.log(`\n── Fix C (muro): ${pass} ok / ${fail} fail ── (rotación ${ROT ? "RESPONDE" : "AVISA"} · resto del muro AVISA · comercial intacto)`);
process.exit(fail ? 1 : 0);
