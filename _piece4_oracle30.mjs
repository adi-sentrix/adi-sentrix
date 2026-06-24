// Piece 4 · ORÁCULO 30 (flag ON) · cada query rutea a su rama correcta. Vara de cierre de v1.
import { answerADI } from "./src/adi/answerADI.js";
const run = (q) => answerADI(q, { activeModule: "ventas" }, { scenario: "bonanza" });
// clasifica la ruta real en una rama
function branch(route) {
  if (route === "qi_retrieval") return "APLICAR";
  if (route === "qi_retrieval_avisar") return "AVISAR";
  if (route === "qi_retrieval_aclarar") return "ACLARAR";
  return "LEGACY"; // fuera del bridge (no-por / no-métrica) → composer existente · NO debe interceptar
}
// [n, query, expectedBranch]  (LEGACY = fuera del bridge · el bridge NO la toca)
const CASES = [
  [1,"ventas por cliente de Samsung","APLICAR"],
  [2,"margen por SKU de Bosch","APLICAR"],
  [3,"contribución por cliente de la familia Cuidado Personal","APLICAR"],
  [4,"ventas por SKU de la familia Línea Blanca","APLICAR"],
  [5,"margen por marca de la familia Electrodomésticos","APLICAR"],
  [6,"carga comercial por cliente de LG","APLICAR"],
  [7,"margen por SKU de Samsung en Electrodomésticos","APLICAR"],
  [8,"top 3 clientes por ventas de Philips","APLICAR"],
  [9,"participación por cliente de Bosch","APLICAR"],
  [10,"qué SKU de Samsung rota peor","LEGACY"],
  [11,"cuánto stock hay en Santiago de productos LG","LEGACY"],
  [12,"qué canal vende más","LEGACY"],
  [13,"contribución por canal","AVISAR"],
  [14,"margen promedio de los clientes Tier 1","LEGACY"],
  [15,"promedio de margen de los clientes que crecen","LEGACY"],
  [16,"rotación por marca","AVISAR"],
  [17,"cruzá ventas por familia y por canal","AVISAR"],
  [18,"clientes con margen menor a 20%","LEGACY"],
  [19,"DOH por bodega","AVISAR"],
  [20,"capital inmovilizado por marca","LEGACY"],
  [21,"cuántos clientes venden Samsung","LEGACY"],
  [22,"stock por marca","ACLARAR"],
  [23,"ventas de Samsung","LEGACY"],
  [24,"margen de Línea Blanca","LEGACY"],
  [25,"los mejores de Bosch","LEGACY"],
  [26,"margen por marca","APLICAR"],
  [27,"top 3 familias por contribución","APLICAR"],
  [28,"ventas y margen por cliente","APLICAR"],
  [29,"ventas por marca de estos 3 clientes","AVISAR"],
  [30,"ventas por cliente de Makita","AVISAR"],
];
let pass = 0, fail = 0;
console.log("#    rama esperada → real (route)");
for (const [n, q, exp] of CASES) {
  const r = run(q);
  const got = branch(r.route);
  const ok = got === exp;
  if (ok) pass++; else fail++;
  console.log(`${ok ? "✓" : "✗ FAIL"} #${String(n).padEnd(3)} ${exp.padEnd(8)}→ ${got.padEnd(8)} [${r.route}]  «${q}»`);
}
console.log(`\n── ORÁCULO 30 (flag ON): ${pass}/30 a su rama correcta ──`);
process.exit(fail ? 1 : 0);
