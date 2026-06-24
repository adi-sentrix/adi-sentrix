// Fix B · Escape 2 · chequeo de SCOPE sobre el texto COMPLETO (no solo la tabla) · 4 listas.
import { answerADI } from "./src/adi/answerADI.js";
const run = (q) => answerADI(q, { activeModule: "ventas" }, { scenario: "bonanza" });
// mapas (de demoData) · cliente → marca/familia · SKU → marca/familia
const CLI_MARCA = { Falabella:"Samsung", Lider:"LG", Jumbo:"Philips", Sodimac:"Bosch", Tottus:"Philips", Paris:"Samsung", "Mercado Libre":"LG", Ripley:"Samsung", Easy:"Bosch", "La Polar":"Philips", Hites:"Samsung", ABC:"LG", Unimarc:"Philips" };
const CLI_FAM = { Falabella:"Electrodomésticos", Lider:"Línea Blanca", Jumbo:"Cuidado Personal", Sodimac:"Materiales de Construcción", Tottus:"Cuidado Personal", Paris:"Electrodomésticos", "Mercado Libre":"Línea Blanca", Ripley:"Electrodomésticos", Easy:"Materiales de Construcción", "La Polar":"Cuidado Personal", Hites:"Electrodomésticos", ABC:"Línea Blanca", Unimarc:"Cuidado Personal" };
const SKU_MARCA = { "SAM-REF500L":"Samsung","SAM-TV55":"Samsung","SAM-MICRO32L":"Samsung","LG-WASH11KG":"LG","LG-DRYER8KG":"LG","LG-AIR9000":"LG","PHI-SHAVER9":"Philips","PHI-HAIR-PRO":"Philips","PHI-IRON-PRO":"Philips","BOS-DRILL18V":"Bosch","BOS-SANDER":"Bosch","MAK-SAW18V":"Makita","MAK-COMP-AIR":"Makita" };
const SKU_FAM = { "SAM-REF500L":"Electrodomésticos","SAM-TV55":"Electrodomésticos","SAM-MICRO32L":"Electrodomésticos","LG-WASH11KG":"Línea Blanca","LG-DRYER8KG":"Línea Blanca","LG-AIR9000":"Línea Blanca","PHI-SHAVER9":"Cuidado Personal","PHI-HAIR-PRO":"Cuidado Personal","PHI-IRON-PRO":"Cuidado Personal","BOS-DRILL18V":"Materiales de Construcción","BOS-SANDER":"Materiales de Construcción","MAK-SAW18V":"Materiales de Construcción","MAK-COMP-AIR":"Materiales de Construcción" };
const BRANDS = ["Samsung","LG","Philips","Bosch","Makita"];
const FAMS = ["Electrodomésticos","Línea Blanca","Cuidado Personal","Materiales de Construcción"];

// [n, query, {marca?, sfamilia?}]  · el filtro de cada APLICAR
const CASES = [
  [1, "ventas por cliente de Samsung", { marca:"Samsung" }],
  [2, "margen por SKU de Bosch", { marca:"Bosch" }],
  [3, "contribución por cliente de la familia Cuidado Personal", { sfamilia:"Cuidado Personal" }],
  [4, "ventas por SKU de la familia Línea Blanca", { sfamilia:"Línea Blanca" }],
  [5, "margen por marca de la familia Electrodomésticos", { sfamilia:"Electrodomésticos" }],
  [6, "carga comercial por cliente de LG", { marca:"LG" }],
  [7, "margen por SKU de Samsung en Electrodomésticos", { marca:"Samsung", sfamilia:"Electrodomésticos" }],
  [8, "top 3 clientes por ventas de Philips", { marca:"Philips" }],
  [9, "participación por cliente de Bosch", { marca:"Bosch" }],
];
// construye la lista de entidades PROHIBIDAS (fuera del filtro) · 4 listas
function forbidden(f) {
  const out = new Set();
  // marcas fuera del filtro
  for (const b of BRANDS) if ((f.marca && b !== f.marca)) out.add(b);
  // familias fuera del filtro
  for (const fam of FAMS) if (f.sfamilia && fam !== f.sfamilia) out.add(fam);
  // clientes fuera del filtro (por marca o por familia)
  for (const c of Object.keys(CLI_MARCA)) {
    if (f.marca && CLI_MARCA[c] !== f.marca) out.add(c);
    if (f.sfamilia && CLI_FAM[c] !== f.sfamilia) out.add(c);
  }
  // SKUs fuera del filtro
  for (const s of Object.keys(SKU_MARCA)) {
    if (f.marca && SKU_MARCA[s] !== f.marca) out.add(s);
    if (f.sfamilia && SKU_FAM[s] !== f.sfamilia) out.add(s);
  }
  // nunca prohibir el valor del propio filtro
  if (f.marca) out.delete(f.marca);
  if (f.sfamilia) out.delete(f.sfamilia);
  return [...out];
}
let pass = 0, fail = 0;
console.log("════ GATE 3 · scope sobre texto COMPLETO · ninguna entidad fuera del filtro (4 listas) ════");
for (const [n, q, f] of CASES) {
  const r = run(q);
  const t = r.text || "";
  const leaked = forbidden(f).filter(e => new RegExp(`(^|[^\\w-])${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\w-]|$)`).test(t));
  const noSuffix = !/Un punto que no saliste/.test(t);
  const ok = leaked.length === 0 && noSuffix;
  if (ok) pass++; else fail++;
  console.log(`${ok ? "✓" : "✗ FAIL"} #${n} «${q}»`);
  console.log(`   fuera del filtro en el texto: ${leaked.length ? "✗ " + leaked.join(", ") : "ninguna ✓"} · suffix global: ${noSuffix ? "omitido ✓" : "✗ PRESENTE"}`);
}
console.log("\n════ GATE 4 · suffix PRESERVADO sin filtro (paridad intacta) ════");
for (const q of ["ventas por cliente", "margen por marca", "ventas y margen por cliente"]) {
  const r = run(q);
  const t = r.text || "";
  const hasSuffix = /Un punto que no saliste/.test(t);
  const ok = hasSuffix;  // sin filtro → el suffix DEBE seguir (corpus byte-idéntico)
  if (ok) pass++; else fail++;
  console.log(`${ok ? "✓" : "✗ FAIL"} «${q}» (sin filtro) · suffix presente: ${hasSuffix ? "sí ✓" : "✗ NO"}`);
}
console.log(`\n── Fix B: ${pass} ok / ${fail} fail ──`);
process.exit(fail ? 1 : 0);
