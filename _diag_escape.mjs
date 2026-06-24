// DIAGNÓSTICO · reproduce los dos escapes en vivo (flag ON · estado de la prueba del owner).
import { answerADI } from "./src/adi/answerADI.js";
const M = { activeModule: "ventas" }, S = { scenario: "bonanza" };
const tail = (t) => (t || "").split("\n").map(l => l.trim()).filter(Boolean);

console.log("════════ ESCAPE 1 · pregunta natural sin 'por' + rotación ════════");
for (const q of ["qué SKU de Samsung rota peor", "cuál es el SKU de Samsung que peor rota", "rotación de Samsung"]) {
  const r = answerADI(q, { ...M, activeModule: "inventario" }, S);
  console.log(`\n«${q}»\n  route=${r.route}  len=${(r.text||"").length}`);
  console.log(`  MAK-COMP-AIR presente: ${(r.text||"").includes("MAK-COMP-AIR")}  · "Samsung" en texto: ${(r.text||"").includes("Samsung")}`);
  console.log(`  texto: ${(r.text||"").replace(/\s+/g," ").slice(0,200)}`);
}

console.log("\n\n════════ ESCAPE 2 · narrativa que cuelga de la tabla filtrada ════════");
console.log("── (a) intermitencia: misma query, ctx fresco vs secuencial ──");
for (let i = 1; i <= 4; i++) {
  const r = answerADI("ventas por cliente de Samsung", { ...M }, S);   // ctx FRESCO cada vez
  const t = r.text || "";
  console.log(`fresco#${i}: ML=${t.includes("Mercado Libre")} · "punto que"=${/punto que/i.test(t)} · LG=${t.includes(" LG")} · len=${t.length}`);
}
let ctx = { ...M };
for (let i = 1; i <= 4; i++) {
  const r = answerADI("ventas por cliente de Samsung", ctx, S);       // ctx SECUENCIAL (turnCount sube)
  const t = r.text || "";
  console.log(`seq#${i} (turn~${ctx.turnCount||0}): ML=${t.includes("Mercado Libre")} · "punto que"=${/punto que/i.test(t)} · len=${t.length}`);
  ctx = r.context || ctx;
}

console.log("\n── (b) anatomía COMPLETA del texto filtrado (líneas, una por una) ──");
const r = answerADI("ventas por cliente de Samsung", { ...M }, S);
tail(r.text).forEach((l, i) => console.log(`  [${i}] ${l.slice(0, 120)}`));

console.log("\n── (c) ¿el escape menciona entidades FUERA del filtro Samsung? ──");
// clientes Samsung = Falabella, Paris, Ripley, Hites · cualquier OTRO cliente nombrado = escape
const SAMSUNG = ["Falabella", "Paris", "Ripley", "Hites"];
const OTROS = ["Lider", "Jumbo", "Sodimac", "Tottus", "Mercado Libre", "Easy", "La Polar", "ABC", "Unimarc"];
const txt = r.text || "";
console.log(`  clientes Samsung en texto: ${SAMSUNG.filter(c => txt.includes(c)).join(", ") || "—"}`);
console.log(`  clientes FUERA del filtro en texto: ${OTROS.filter(c => txt.includes(c)).join(", ") || "(ninguno · limpio)"}`);
process.exit(0);
