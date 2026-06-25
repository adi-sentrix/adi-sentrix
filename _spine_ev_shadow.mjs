// FASE 2.1d · SHADOW-DIFF de TEXTO · evidence ON vs OFF (spine RESPONDE flags ON en ambos).
// El .text DEBE ser byte-idéntico en TODAS; lo único que cambia es el campo evidence.
import fs from "fs";
const ON = JSON.parse(fs.readFileSync("_spine_ev_ON.json", "utf8"));
const OFF = JSON.parse(fs.readFileSync("_spine_ev_OFF.json", "utf8"));
let textDiff = [], evAppeared = [];
for (const q of Object.keys(OFF)) {
  const a = OFF[q], b = ON[q]; if (!b) continue;
  if (a.text !== b.text) textDiff.push({ q, off: a.text, on: b.text });
  if (b.hasEv && !a.hasEv) evAppeared.push(q);
}
console.log("════ 2.1d · SHADOW-DIFF de TEXTO ════");
console.log(`\nTEXTO byte-idéntico: ${Object.keys(OFF).length - textDiff.length}/${Object.keys(OFF).length}`);
console.log(`Evidence apareció (solo con flag ON): ${evAppeared.length}`);
evAppeared.forEach(q => console.log(`   + «${q}»`));
console.log(`\nDIFERENCIAS DE TEXTO (deberían ser 0): ${textDiff.length}`);
textDiff.forEach(d => console.log(`   ✗ ROJO «${d.q}»\n     OFF: ${d.off}\n     ON:  ${d.on}`));
console.log(`\n── ${textDiff.length === 0 ? "VERDE · el evidence NO cambió ni un carácter del texto" : "ROJO · " + textDiff.length + " textos cambiaron"} ──`);
process.exit(textDiff.length ? 1 : 0);
