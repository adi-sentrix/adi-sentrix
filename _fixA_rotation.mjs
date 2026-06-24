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
// la query estrella del founder: ranking global intacto (MAK-COMP-AIR sigue saliendo)
{
  const r = run("cuál es el SKU con peor rotación");
  ck(`«cuál es el SKU con peor rotación» → ranking_extremes + MAK-COMP-AIR (global intacto)`,
    r.route === "ranking_extremes" && (r.text || "").includes("MAK-COMP-AIR"), `route=${r.route}`);
  console.log(`   ${(r.text || "").replace(/\s+/g, " ").slice(0, 120)}`);
}
// el resto: lo único que importa es que mi fix NO los intercepta (van a su composer de siempre)
for (const q of ["peor rotación", "cuál es el SKU con mejor rotación", "el SKU con más DOH"]) {
  const r = run(q);
  ck(`«${q}» NO interceptado → ${r.route}`, r.route !== "qi_inventory_filter_avisar", `route=${r.route}`);
}
console.log(`\n── Fix A: ${pass} ok / ${fail} fail ──`);
process.exit(fail ? 1 : 0);
