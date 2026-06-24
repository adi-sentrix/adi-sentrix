// DIAGNÓSTICO · inventario de PUERTAS · qué composer responde cada pregunta de inventario/capital (flag ON).
import { answerADI } from "./src/adi/answerADI.js";
const run = (q, mod) => answerADI(q, { activeModule: mod || "inventario" }, { scenario: "bonanza" });
const flags = (t) => ({
  capK: /\$\d+[.,]?\d*K/.test(t),                 // cifras de capital $XK
  doh: /\bDOH\b|días de cobertura|cobertura/i.test(t),
  rot: /rotaci[oó]n|\b\d+\.\d+x\b/i.test(t),
  dias: /días sin vent|sin venderse|días detenid/i.test(t),
  mak: t.includes("MAK-COMP-AIR"),
  avisa: /no tengo evidencia|no llego|Fase 2\.5|inventario y todavía no/i.test(t),
});
// casos del owner (❌ = debió avisar) + barrido de puertas
const QS = [
  ["OWNER-1 ❌", "dime cuánto es mi capital inmovilizado, dónde está concentrado y los días sin venderse"],
  ["OWNER-2 ❌", "cuál es el peor SKU"],
  ["OWNER-3 ✓", "arme una estrategia para el capital inmovilizado"],
  ["capital-1", "cuánto capital inmovilizado tengo"],
  ["capital-2", "dónde está concentrado mi capital detenido"],
  ["capital-3", "capital inmovilizado por marca"],
  ["sku-op-1", "qué SKUs atrapan más capital"],
  ["sku-op-2", "profundizá en los SKUs con más capital"],
  ["doh-1", "qué SKU tiene más DOH"],
  ["doh-2", "cuántos días sin venta tengo"],
  ["rot-preserve", "cuál es el SKU con peor rotación"],
  ["rot-2", "rotación promedio del portafolio"],
  ["rot-3", "qué SKU rota peor"],
  ["stock-1", "cuánto stock detenido tengo"],
  ["stock-2", "stockUSD por SKU"],
  ["cobertura-1", "qué productos tienen sobre-cobertura"],
  ["peor-sku-var", "cuál es el peor producto"],
  ["mejor-sku", "cuál es el mejor SKU"],
];
const out = [];
for (const [tag, q] of QS) {
  let r; try { r = run(q); } catch (e) { r = { text: "(err " + e.message + ")", route: "err" }; }
  const t = r.text || "";
  const f = flags(t);
  out.push({ tag, q, route: r.route, ...f, len: t.length });
  const mark = f.avisa ? "🟢AVISA" : (f.capK || f.doh || f.rot || f.dias) ? "🔴DATO-INV" : "⚪otro";
  console.log(`${mark} [${tag}] route=${(r.route||"").padEnd(22)} «${q}»`);
  console.log(`     capK=${f.capK} doh=${f.doh} rot=${f.rot} dias=${f.dias} mak=${f.mak} | ${t.replace(/\s+/g," ").slice(0,140)}`);
}
import fs from "fs";
fs.writeFileSync("./_diag_inventory.json", JSON.stringify(out, null, 2));
console.log("\n── resumen por route ──");
const byRoute = {};
for (const o of out) { (byRoute[o.route] = byRoute[o.route] || []).push(o.tag + (o.avisa ? "🟢" : (o.capK||o.doh||o.rot||o.dias) ? "🔴" : "⚪")); }
for (const [r, tags] of Object.entries(byRoute)) console.log(`  ${r}: ${tags.join(", ")}`);
process.exit(0);
