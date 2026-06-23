import { detectIntent } from "./src/adi/router.js";
import { _isExplicitModuleOverviewQuery, _isBareModuleWord } from "./src/adi/overviewGate.js";
// FP = falso positivo del predicado simple · TP = verdadero positivo (piso SÍ da lead)
const cases = [
  ["FP", "panorama de ventas"], ["FP", "resumen de ventas"], ["FP", "panorama de márgenes"],
  ["FP", "resumen de márgenes"], ["FP", "rentabilidad general"], ["FP", "panorama de inventario"], ["FP", "resumen de inventario"],
  ["TP", "cómo está la venta"], ["TP", "cómo está el margen"], ["TP", "cómo está el inventario"],
  ["TP", "vista general de ventas"], ["TP", "ventas"], ["TP", "margenes"], ["TP", "inventario"], ["TP", "stock"],
];
for (const [kind, q] of cases) {
  const t = detectIntent(q, {}).type;
  const pred = _isExplicitModuleOverviewQuery(q) || _isBareModuleWord(q);
  const refined = t === "module" && pred;
  console.log(`${kind} · detectIntent.type=${(t||"").padEnd(20)} · pred=${pred?"LEAD":"—"} · refinado(type==module && pred)=${refined?"LEAD":"—"}  «${q}»`);
}
