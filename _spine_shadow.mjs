// FASE 2.1a · SHADOW-DIFF · _spine_ON.json vs _spine_OFF.json.
// Anti-overshadow: lo ÚNICO que puede cambiar es la firma del spine (marca/familia superlativo).
// Si una query que el viejo respondía cambia → ROJO.
import fs from "fs";
const ON = JSON.parse(fs.readFileSync("_spine_ON.json", "utf8"));
const OFF = JSON.parse(fs.readFileSync("_spine_OFF.json", "utf8"));
const _isSpine = (r) => typeof r === "string" && r.startsWith("spine_");  // 2.1a (spine_dim_*) + 2.1b (spine_filter_*)
let changed = [], hidden = [];
for (const q of Object.keys(OFF)) {
  const a = OFF[q], b = ON[q];
  if (!b) continue;
  const diff = a.text !== b.text || a.route !== b.route;
  if (!diff) continue;
  // un cambio es LEGÍTIMO solo si la versión ON es una ruta del spine
  if (_isSpine(b.route)) changed.push({ q, off: a.route, on: b.route });
  else hidden.push({ q, off: a.route, on: b.route });
}
console.log("════ SHADOW-DIFF · flag ON vs OFF ════");
console.log(`\nCAMBIADAS por el spine (legítimo · firma marca/familia): ${changed.length}`);
changed.forEach(c => console.log(`   ✓ «${c.q}»  ${c.off} → ${c.on}`));
console.log(`\nSIN CAMBIO (byte-idénticas): ${Object.keys(OFF).length - changed.length - hidden.length} de ${Object.keys(OFF).length}`);
console.log(`\nCAMBIOS ESCONDIDOS (overshadow · una query que andaba cambió a NO-spine): ${hidden.length}`);
hidden.forEach(h => console.log(`   ✗ ROJO «${h.q}»  ${h.off} → ${h.on}`));
console.log(`\n── ${hidden.length === 0 ? "VERDE · cero overshadow · solo la firma del spine cambió" : "ROJO · " + hidden.length + " overshadow"} ──`);
process.exit(hidden.length ? 1 : 0);
