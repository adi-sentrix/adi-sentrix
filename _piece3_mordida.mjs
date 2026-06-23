// Piece 3 · TEST DE MORDIDA · cada APLICAR filtra de verdad (entidades correctas + header) · flag ON.
import { answerADI } from "./src/adi/answerADI.js";
const run = (q) => answerADI(q, { activeModule: "ventas" }, { scenario: "bonanza" });
const ALL_CLIENTS = ["Falabella","Lider","Jumbo","Sodimac","Tottus","Paris","Mercado Libre","Ripley","Easy","La Polar","Hites","ABC","Unimarc"];
const ALL_SKUS = ["SAM-REF500L","SAM-TV55","SAM-MICRO32L","LG-WASH11KG","LG-DRYER8KG","LG-AIR9000","PHI-SHAVER9","PHI-HAIR-PRO","PHI-IRON-PRO","BOS-DRILL18V","BOS-SANDER","MAK-SAW18V","MAK-COMP-AIR"];
const present = (t, names) => names.filter(n => t.includes(n));
const absent  = (t, names) => names.filter(n => !t.includes(n));
let pass = 0, fail = 0;

// [n, query, expectedPresent, mustBeAbsent, filterTag]
const APLICAR = [
  [1, "ventas por cliente de Samsung",                          ["Falabella","Paris","Ripley","Hites"], ["Lider","Jumbo","Sodimac"], "Samsung"],
  [2, "margen por SKU de Bosch",                                ["BOS-DRILL18V","BOS-SANDER"], ["SAM-REF500L","LG-WASH11KG","MAK-SAW18V"], "Bosch"],
  [3, "contribución por cliente de la familia Cuidado Personal",["Jumbo","Tottus","La Polar","Unimarc"], ["Falabella","Lider","Sodimac"], "Cuidado Personal"],
  [4, "ventas por SKU de la familia Línea Blanca",              ["LG-WASH11KG","LG-DRYER8KG","LG-AIR9000"], ["SAM-REF500L","BOS-DRILL18V","PHI-SHAVER9"], "Línea Blanca"],
  [5, "margen por marca de la familia Electrodomésticos",       ["Samsung"], ["LG","Philips","Bosch"], "Electrodomésticos"],
  [6, "carga comercial por cliente de LG",                      ["Lider","Mercado Libre","ABC"], ["Falabella","Jumbo","Sodimac"], "LG"],
  [7, "margen por SKU de Samsung en Electrodomésticos",         ["SAM-REF500L","SAM-TV55","SAM-MICRO32L"], ["LG-WASH11KG","BOS-DRILL18V","PHI-SHAVER9"], "Samsung, Electrodomésticos"],
  [8, "top 3 clientes por ventas de Philips",                   ["Jumbo","Tottus","La Polar"], ["Unimarc","Falabella","Lider"], "Philips"],
  [9, "participación por cliente de Bosch",                     ["Sodimac","Easy"], ["Falabella","Lider","Jumbo"], "Bosch"],
];
console.log("══════════ TEST DE MORDIDA · APLICAR (tabla por tabla) ══════════");
for (const [n, q, exp, mustAbsent, tag] of APLICAR) {
  const r = run(q);
  const t = r.text || "";
  const gotPresent = present(t, exp);
  const leaked = present(t, mustAbsent);            // entidades excluidas que NO deberían aparecer
  const hasTag = t.includes("filtrado por:") && t.includes(tag.split(",")[0].trim());
  const isTable = r.route === "qi_retrieval";
  const ok = isTable && gotPresent.length === exp.length && leaked.length === 0 && hasTag;
  if (ok) pass++; else fail++;
  console.log(`\n${ok ? "✓ MUERDE" : "✗ FALLA "} #${n} «${q}»  route=${r.route}`);
  console.log(`  esperadas presentes: ${gotPresent.length}/${exp.length} [${gotPresent.join(", ")}]`);
  console.log(`  excluidas filtradas: ${leaked.length === 0 ? "OK (ninguna se coló)" : "✗ SE COLARON: " + leaked.join(", ")}`);
  console.log(`  header filtrado-por: ${hasTag ? "✓" : "✗ FALTA"}`);
  console.log(`  ── tabla ──\n${t.split("\n").slice(0, 7).map(l => "    " + l).join("\n")}`);
}

console.log("\n══════════ VERDICTOS · escudo de falsa ausencia + no-resuelto ══════════");
const VERD = [
  ["#30 Makita (válido pero AUSENTE en clientes)", "ventas por cliente de Makita", "avisar", ["No hay datos","Makita"]],
  ["unresolved 'de materiales' (genérico)",        "ventas por cliente de materiales", "avisar", ["No reconozco","materiales"]],
  ["unresolved 'de marca Acme'",                   "margen por cliente de marca Acme", "avisar", ["No reconozco"]],
  ["#1 Samsung (presente · NO falsa ausencia)",    "ventas por cliente de Samsung", "qi_retrieval", ["Falabella"]],
];
for (const [label, q, expectVerdict, mustContain] of VERD) {
  const r = run(q);
  const t = r.text || "";
  const routeOk = expectVerdict === "qi_retrieval" ? r.route === "qi_retrieval" : r.route === "qi_retrieval_" + expectVerdict;
  const contentOk = mustContain.every(s => t.includes(s));
  const ok = routeOk && contentOk;
  if (ok) pass++; else fail++;
  console.log(`${ok ? "✓" : "✗"} ${label}  route=${r.route}\n    «${t.replace(/\s+/g," ").slice(0,110)}»`);
}
console.log(`\n── Piece 3 mordida+verdictos: ${pass} ok / ${fail} fail ──`);
process.exit(fail ? 1 : 0);
