// Fix A · Escape 1 · ranking de inventario CON filtro de marca/familia → AVISAR (conserva filtro · sin SKU global).
import { answerADI } from "./src/adi/answerADI.js";
const run = (q) => answerADI(q, { activeModule: "inventario" }, { scenario: "bonanza" });
let pass = 0, fail = 0;
const ck = (label, cond, detail) => { if (cond) { pass++; console.log(`✓ ${label}`); } else { fail++; console.log(`✗ FAIL ${label}  ${detail || ""}`); } };

console.log("════ GATE 1 · Escape 1 cerrado (AVISAR · NO MAK-COMP-AIR · conserva el filtro) ════");
for (const [q, filt] of [
  ["qué SKU de Samsung rota peor", "Samsung"],
  ["cuál es el SKU de Samsung que peor rota", "Samsung"],
  ["qué SKU de la familia Línea Blanca rota peor", "Línea Blanca"],
  ["qué SKU de Bosch tiene peor DOH", "Bosch"],
]) {
  const r = run(q);
  const t = r.text || "";
  const ok = r.route === "qi_inventory_filter_avisar" && !t.includes("MAK-COMP-AIR") && t.includes(filt);
  ck(`«${q}»`, ok, `route=${r.route}`);
  console.log(`   RESPUESTA COMPLETA: ${t}`);
}

console.log("\n════ GATE 2 · NO-regresión: sin filtro NO se intercepta (composer de siempre intacto) ════");
// CONTRATO ACTUALIZADO (Fix C): la decisión del owner hizo que rotación SIN filtro YA NO se preserve
// (ya no da MAK-COMP-AIR) — el muro de inventario la AVISA como todo lo de inventario. Fix A sigue
// sirviendo el caso FILTRADO con su propio mensaje (gate 1). Sin filtro → muro (qi_inventory_avisar).
for (const q of ["cuál es el SKU con peor rotación", "peor rotación", "cuál es el SKU con mejor rotación", "el SKU con más DOH"]) {
  const r = run(q);
  ck(`«${q}» → muro inventario (AVISA · sin MAK-COMP-AIR)`, r.route === "qi_inventory_avisar" && !(r.text || "").includes("MAK-COMP-AIR"), `route=${r.route}`);
}
console.log(`\n── Fix A: ${pass} ok / ${fail} fail ──`);
process.exit(fail ? 1 : 0);
