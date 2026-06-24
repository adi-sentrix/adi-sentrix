// Fix C · MURO DE INVENTARIO · barrido completo (todo AVISA, una sola voz) + Fix A + preservados intactos.
import { answerADI } from "./src/adi/answerADI.js";
const run = (q, mod) => answerADI(q, { activeModule: mod || "inventario" }, { scenario: "bonanza" });
const isData = (t) => /\$\d+[.,]?\d*K|MAK-COMP-AIR|\d+\.\dx|concentran|capital comprometido|DOH promedio/.test(t);
const MSG = "Eso vive en inventario y todavía no está habilitado en esta fase (Fase 2.5)";
let pass = 0, fail = 0;
const ck = (lbl, cond, det) => { if (cond) pass++; else fail++; console.log(`${cond ? "✓" : "✗ FAIL"} ${lbl}${cond ? "" : "  " + (det || "")}`); };

console.log("════ GATE 1 · BARRIDO · toda pregunta de inventario/capital → AVISAR único, sin dato ════");
const BARRIDO = {
  "owner (técnico)": ["dime cuánto es mi capital inmovilizado, dónde está concentrado y los días sin venderse"],
  "capital": ["cuánto capital inmovilizado tengo", "dónde está concentrado mi capital detenido", "capital inmovilizado por marca", "qué SKUs atrapan más capital", "qué SKUs están atrapando más capital"],
  "rotación/DOH/cobertura": ["qué SKU tiene más DOH", "cuál es la rotación promedio del portafolio", "qué productos no rotan", "qué productos tienen sobre-cobertura", "rotación por marca"],
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
console.log("\n  Mensaje único (muestra):");
console.log("   " + (run("cuánto capital inmovilizado tengo").text || ""));

console.log("\n════ VAGO/AMBIGUO (sin métrica) · honest_fallback SIN dato es aceptable (el leak ya se fue) ════");
for (const q of ["cuál es el peor SKU", "cuál es el mejor SKU", "cuál es el peor producto"]) {
  const r = run(q);
  const t = r.text || "";
  ck(`«${q}» → ${r.route} · sin dato`, !isData(t), `tieneDato=${isData(t)}`);
}

console.log("\n════ GATE 2 · Fix A INTACTO (Samsung/rotación filtrado → conserva Samsung, NO Makita) ════");
{
  const r = run("qué SKU de Samsung rota peor");
  ck(`«qué SKU de Samsung rota peor» → ${r.route}`, r.route === "qi_inventory_filter_avisar" && (r.text||"").includes("Samsung") && !(r.text||"").includes("MAK-COMP-AIR"));
  console.log("   " + (r.text || ""));
}

console.log("\n════ GATE 3 · PRESERVADOS (NO se interceptan · responden con datos) ════");
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
  const ok = r.route !== "qi_inventory_avisar" && r.route !== "qi_inventory_filter_avisar";
  ck(`«${q}» → ${r.route} (preservado)`, ok, "se interceptó de más!");
}
console.log(`\n── Fix C (muro): ${pass} ok / ${fail} fail ──`);
process.exit(fail ? 1 : 0);
