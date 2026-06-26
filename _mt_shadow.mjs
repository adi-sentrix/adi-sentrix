// FASE 2.2a · SHADOW-DIFF multi-turno · _mt_ON.json vs _mt_OFF.json (modular vs modular).
// Un cambio es LEGÍTIMO solo si es (a) anti-fuga: ON route = mt_safety_inventory_avisar, o
// (b) anti-contaminación de lista: un deíctico que resolvía sobre lista STALE pasa a fallback (no resucita).
// Cualquier otro cambio = ROJO (overshadow · 2.2a tocó algo que no debía).
import fs from "fs";
const ON = JSON.parse(fs.readFileSync("_mt_ON.json", "utf8"));
const OFF = JSON.parse(fs.readFileSync("_mt_OFF.json", "utf8"));
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
let antifuga = [], anticontam = [], identical = 0, total = 0, red = [];
for (const chain of Object.keys(OFF)) {
  const a = OFF[chain], b = ON[chain];
  if (!b) continue;
  for (let t = 0; t < a.length; t++) {
    total++;
    const o = a[t], n = b[t];
    const diff = norm(o.text) !== norm(n.text) || o.route !== n.route;
    if (!diff) { identical++; continue; }
    if (n.route === "mt_safety_inventory_avisar") antifuga.push({ chain, t: t + 1, q: o.q, off: o.route, on: n.route });
    // anti-contaminación: el deíctico stale dejaba de resolver (client_dive/sku_dive/ranking → fallback/no-resolución)
    else if (chain.startsWith("contam-stale") && n.route === "global_honest_fallback") anticontam.push({ chain, t: t + 1, q: o.q, off: o.route, on: n.route });
    else red.push({ chain, t: t + 1, q: o.q, off: o.route, on: n.route, offHead: norm(o.text).slice(0, 70), onHead: norm(n.text).slice(0, 70) });
  }
}
console.log("════ SHADOW-DIFF 2.2a · ON vs OFF (modular) ════");
console.log(`\n🛡️ ANTI-FUGA (legítimo · continuación inventario → AVISA): ${antifuga.length}`);
antifuga.forEach(c => console.log(`   ✓ «${c.chain}» T${c.t} «${c.q}»  ${c.off} → ${c.on}`));
console.log(`\n🧹 ANTI-CONTAMINACIÓN (legítimo · deíctico stale no resucita): ${anticontam.length}`);
anticontam.forEach(c => console.log(`   ✓ «${c.chain}» T${c.t} «${c.q}»  ${c.off} → ${c.on}`));
console.log(`\n· BYTE-IDÉNTICAS: ${identical} de ${total} turnos`);
console.log(`\n🚨 CAMBIOS NO ESPERADOS (overshadow): ${red.length}`);
red.forEach(h => { console.log(`   ✗ ROJO «${h.chain}» T${h.t} «${h.q}»  ${h.off} → ${h.on}`); console.log(`        off: ${h.offHead}`); console.log(`        on : ${h.onHead}`); });
console.log(`\n── ${red.length === 0 ? "VERDE · solo anti-fuga + anti-contaminación cambiaron · resto byte-idéntico" : "ROJO · " + red.length + " overshadow"} ──`);
process.exit(red.length ? 1 : 0);
