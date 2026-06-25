// FASE 2.1c · SHADOW-DIFF · combined ON vs OFF (spine flags ON en ambos).
// Legítimo: cambia un combinado (ON route = spine_filter_combinado_avisar). ROJO: cambia cualquier otra cosa.
import fs from "fs";
const ON = JSON.parse(fs.readFileSync("_spine_c_ON.json", "utf8"));
const OFF = JSON.parse(fs.readFileSync("_spine_c_OFF.json", "utf8"));
let legit = [], red = [];
for (const q of Object.keys(OFF)) {
  const a = OFF[q], b = ON[q]; if (!b) continue;
  if (a.text === b.text && a.route === b.route) continue;   // sin cambio
  if (b.route === "spine_filter_combinado_avisar") legit.push({ q, off: a.route, on: b.route });
  else red.push({ q, off: a.route, on: b.route });
}
console.log("════ 2.1c · SHADOW-DIFF (combined ON vs OFF) ════");
console.log(`\nCAMBIOS LEGÍTIMOS (combinado): ${legit.length}`);
legit.forEach(c => console.log(`   ✓ «${c.q}»  ${c.off} → ${c.on}`));
console.log(`SIN CAMBIO (byte-idénticas): ${Object.keys(OFF).length - legit.length - red.length}/${Object.keys(OFF).length}`);
console.log(`\nOVERSHADOW (un NO-combinado cambió · ROJO): ${red.length}`);
red.forEach(r => console.log(`   ✗ ROJO «${r.q}»  ${r.off} → ${r.on}`));
console.log(`\n── ${red.length === 0 ? "VERDE · solo cambiaron combinados · cero filtro simple tocado" : "ROJO · " + red.length + " overshadow"} ──`);
process.exit(red.length ? 1 : 0);
