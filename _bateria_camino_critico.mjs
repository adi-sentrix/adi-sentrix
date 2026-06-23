// === Batería headless · camino crítico ADI · 10 básicos + 6 anclas (HANDOFF §4) ===
// Verifica SOLO que la base corre: por cada query, qué ruta toma y si da texto del piso.
// NO compara byte-a-byte contra el monolito (eso fue Fase 4). NO construye UI.
//
// NOTA DE FIDELIDAD: el zip no trae el archivo de batería del ejecutor anterior, y el
// HANDOFF §4 lista las anclas por RUTA, no por string literal. Estas queries están
// reconstruidas desde la lógica de detección real (intentLayer/detectors/inverse/ranking)
// para que cada una caiga en su ruta. La ruta efectiva se imprime: cualquier desvío es visible.
import { answerADI } from "./src/adi/answerADI.js";

const STATE = { scenario: "bonanza" };

// route → ¿produce texto del piso? (todas menos not_yet_extracted)
const FLOOR_ROUTES = new Set([
  "early_gate", "late_layer", "client_dive", "warehouse_comparison",
  "inverse_projection", "ranking_extremes", "brand_dive",
]);

const BASICOS = [
  { q: "cómo están las ventas",        exp: "early_gate" },
  { q: "cómo están los márgenes",      exp: "early_gate" },
  { q: "cómo está el inventario",      exp: "early_gate" },
  { q: "panorama de ventas",           exp: "early_gate" },
  { q: "resumen de márgenes",          exp: "early_gate" },
  { q: "qué tal las ventas",           exp: "early_gate" },
  { q: "cómo vamos en inventario",     exp: "early_gate" },
  { q: "cómo anda la facturación",     exp: "early_gate" },
  { q: "las ventas",                   exp: "late_layer" },  // módulo desnudo → capa tardía
  { q: "el inventario",                exp: "late_layer" },  // módulo desnudo → capa tardía
];

const ANCLAS = [
  { q: "cómo está Falabella",                              exp: "client_dive" },
  { q: "Santiago vs Valparaíso",                           exp: "warehouse_comparison" },
  { q: "cuánto necesita vender Falabella para aportar $2M", exp: "inverse_projection" }, // entidad
  { q: "cuánto necesito vender para aportar $2M",          exp: "inverse_projection" },   // cartera (noEntity)
  { q: "cuál es el SKU con peor rotación",                 exp: "ranking_extremes" },
  { q: "cómo está Makita",                                 exp: "brand_dive" },
];

function snippet(text) {
  if (text == null) return "(null)";
  const first = text.split("\n").find(l => l.trim().length) || "";
  return first.length > 110 ? first.slice(0, 110) + "…" : first;
}

function run(title, set) {
  console.log("\n" + "═".repeat(78));
  console.log(title);
  console.log("═".repeat(78));
  let okRoute = 0, okFloor = 0;
  set.forEach((item, i) => {
    let r;
    try {
      r = answerADI(item.q, {}, STATE);
    } catch (e) {
      console.log(`\n[${i + 1}] ✗ EXCEPCIÓN  «${item.q}»`);
      console.log(`     ${e.message}`);
      return;
    }
    const floor = FLOOR_ROUTES.has(r.route) && r.text != null;
    const routeMatch = r.route === item.exp;
    if (routeMatch) okRoute++;
    if (floor) okFloor++;
    console.log(`\n[${i + 1}] «${item.q}»`);
    console.log(`     ruta:        ${r.route}${routeMatch ? "  ✓" : "  ✗ (esperaba " + item.exp + ")"}`);
    console.log(`     intent:      ${r.intent}`);
    console.log(`     texto piso:  ${floor ? "SÍ" : "NO"}  (len ${r.text ? r.text.length : 0})`);
    console.log(`     apertura:    ${snippet(r.text)}`);
  });
  console.log(`\n   → ruta esperada: ${okRoute}/${set.length} · texto del piso: ${okFloor}/${set.length}`);
  return { okRoute, okFloor, total: set.length };
}

const b = run("10 BÁSICOS  (early_gate / late_layer)", BASICOS);
const a = run("6 ANCLAS  (client/warehouse/inverse×2/ranking/brand)", ANCLAS);

console.log("\n" + "█".repeat(78));
console.log(`RESUMEN  ·  ruta correcta ${b.okRoute + a.okRoute}/${b.total + a.total}` +
  `  ·  texto del piso ${b.okFloor + a.okFloor}/${b.total + a.total}`);
console.log("█".repeat(78));
