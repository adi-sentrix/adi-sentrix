// === Batería CANÓNICA · strings sellados por el arquitecto contra el piso 41cc33d8 ===
// Formato pedido: ruta · longitud de texto · primeras 60 letras. No construye UI.
import { answerADI } from "./src/adi/answerADI.js";

const STATE = { scenario: "bonanza" };

const FLOOR_ROUTES = new Set([
  "early_gate", "late_layer", "client_dive", "warehouse_comparison",
  "inverse_projection", "ranking_extremes", "brand_dive",
  "cross_domain_mechanism", "client_contribution_ranking", "executive_report",
]);

const BASICOS = [
  "cómo están las ventas",
  "cómo van las ventas",
  "ventas",
  "qué pasa con las ventas",
  "cómo está el margen",
  "cómo viene la contribución",
  "cómo está el inventario",
  "qué pasa con la bodega",
  "cómo va el negocio",
  "dame panorama comercial",
];

const ANCLAS = [
  { q: "cómo están las ventas de Falabella",            exp: "client_dive" },
  { q: "Santiago vs Valparaíso",                        exp: "warehouse_comparison" },
  { q: "cuánto debe vender Falabella para aportar $1M", exp: "inverse_projection" },
  { q: "cuánto vender para aportar $2M adicional",      exp: "inverse_projection" },
  { q: "cuál es el SKU con peor rotación",              exp: "ranking_extremes" },
  { q: "cómo viene Makita",                             exp: "brand_dive" },
];

// "deben DEFERIR, no dar overview"
const OPERACIONES = [
  "qué pasa con las ventas si crece 10%",
  "qué pasa con el precio si subo 5%",
  "cuánto vender para aportar $2M adicional",
];

const first60 = (t) => t == null ? "(null)" : ("«" + t.slice(0, 60).replace(/\s+/g, " ") + "»");
const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);

function row(i, q, r, tag) {
  const len = r.text ? r.text.length : 0;
  console.log(`[${pad(String(i + 1), 2)}] ${pad(r.route, 22)} len ${pad(String(len), 5)} ${first60(r.text)}`);
  return r;
}

console.log("\n══ 10 BÁSICOS · deben dar overview (texto del piso) ══");
let basicOk = 0;
BASICOS.forEach((q, i) => {
  console.log(`     q: «${q}»`);
  const r = row(i, q, answerADI(q, {}, STATE));
  const floor = FLOOR_ROUTES.has(r.route) && r.text != null;
  if (floor) basicOk++;
});
console.log(`   → overview/texto del piso: ${basicOk}/${BASICOS.length}`);

console.log("\n══ 6 ANCLAS · cada una a su ruta sellada ══");
let anclaOk = 0;
ANCLAS.forEach((item, i) => {
  console.log(`     q: «${item.q}»   (esp: ${item.exp})`);
  const r = row(i, item.q, answerADI(item.q, {}, STATE));
  const ok = r.route === item.exp && r.text != null;
  if (ok) anclaOk++; else console.log(`        ⚠ ruta ${r.route} ≠ esperada ${item.exp}`);
});
console.log(`   → ruta sellada: ${anclaOk}/${ANCLAS.length}`);

console.log("\n══ 3 OPERACIONES · deben DEFERIR (no overview) ══");
OPERACIONES.forEach((q, i) => {
  console.log(`     q: «${q}»`);
  const r = row(i, q, answerADI(q, {}, STATE));
  const overview = (r.route === "early_gate" || r.route === "late_layer");
  const defiere = r.route === "not_yet_extracted";
  console.log(`        defiere(not_yet_extracted): ${defiere ? "SÍ" : "NO"}  ·  da overview: ${overview ? "SÍ ⚠" : "NO"}`);
});
