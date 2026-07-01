// === HARNESS · 2c · LA BRECHA EN EL TIEMPO (buildBrechaFilm · vista de ejemplo honesta) ===
import { buildBrechaFilm, buildMarginDecomposition } from "./src/adi/sentrix/kpis.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("✅", m); } else { fail++; console.log("🚨", m); } };

const f = buildBrechaFilm("Lider", "bonanza");
const d = buildMarginDecomposition("Lider", "bonanza");

console.log("── ESTRUCTURA · 12 meses · rotulada ejemplo ──");
ok(f != null && f.example === true, "película existe y está marcada example:true (rótulo honesto)");
ok(f.costo.length === 12 && f.carga.length === 12 && f.margen.length === 12, "12 puntos por curva");

console.log("\n── LA CUENTA CIERRA EN CADA MES · costo + carga + margen = 100 ──");
ok(f.costo.every((_, i) => Math.abs(f.costo[i] + f.carga[i] + f.margen[i] - 100) < 0.15), "cada mes cierra (±0.15)");

console.log("\n── ANCLA · el «hoy» (último punto) es el dato REAL de la brecha ──");
ok(f.costo[11] === d.costoPct, `costo hoy ${f.costo[11]}% == decomp real ${d.costoPct}%`);
ok(f.carga[11] === d.cargaPct, `carga hoy ${f.carga[11]}% == decomp real ${d.cargaPct}%`);
ok(f.margen[11] === d.margen, `margen hoy ${f.margen[11]}% == decomp real ${d.margen}%`);

console.log("\n── LA TESIS EN EL TIEMPO · la palanca DOMINANTE deriva, la otra ~plana ──");
ok(f.dominant === d.dominant, `dominante ${f.dominant} == decomp`);
if (f.dominant === "costo") {
  ok(f.costo[11] > f.costo[0], `costo TREPA (${f.costo[0]}% → ${f.costo[11]}%) · la erosión es costo`);
  ok(Math.abs(f.carga[11] - f.carga[0]) <= 0.5, `carga se mantiene (${f.carga[0]}% → ${f.carga[11]}%)`);
  ok(f.margen[0] > f.margen[11], `margen se EROSIONA (${f.margen[0]}% → ${f.margen[11]}%)`);
} else {
  ok(f.carga[11] !== f.carga[0], "carga deriva (dominante carga)");
}

console.log("\n── DETERMINISMO · misma entrada → misma película (sin Math.random) ──");
const f2 = buildBrechaFilm("Lider", "bonanza");
ok(JSON.stringify(f) === JSON.stringify(f2), "estable entre llamadas");

console.log("\n── GENERICIDAD ──");
ok(buildBrechaFilm("NoExiste", "bonanza") === null, "cliente inexistente → null");

console.log("\n════════════════════════════════════════════════════");
console.log(`GATES: ${pass}/${pass + fail} · ${fail === 0 ? "TODOS VERDES" : "HAY ROJOS"}`);
process.exit(fail === 0 ? 0 : 1);
