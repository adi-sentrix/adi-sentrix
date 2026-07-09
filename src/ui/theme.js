/* === src/ui/theme.js ===
 * Tokens visuales + estilos del highlighter financiero · extraídos de 41cc33d8 · verbatim.
 * Presentación pura · cero cálculo. La única diferencia con el monolito es DÓNDE vive el estilo. */
import { clientesMargen } from "../data/demoData.js";   // hardening prep-LLM · KNOWN_ENTITIES derivado del dato (no lista hardcodeada)

// Paleta SOBRIA + CÁLIDA (Etapa 5 · look de Code · owner 2026-06-29 · RECALIBRADA 2026-07-08: "el gris más cálido,
// más clarito"): charcoal cálido con grises PIEDRA más luminosos (sutil, no sepia), texto off-white cálido, cero
// brillo de ambiente. Cyan SOLO como acento funcional frío (cifras/logo/activo · identidad de ADI). Bordes cálidos.
export const C = {
  bg: "#0e0d0c", surface: "#1c1a17", surfaceAlt: "#262320", surfaceHover: "#2d2a26",
  // CARDS DEL DIÁLOGO (owner 2026-07-09: "las cards de ADI y el diálogo en un gris clarito elegante — aún muy oscuro"):
  // gris piedra claramente más luminoso SOLO para el chat (burbujas + cards del hero); los paneles Sentrix quedan en surface.
  card: "#33302b", cardUser: "#3b3833", cardBorder: "rgba(255,246,235,0.14)",
  border: "rgba(255,246,235,0.09)", borderLight: "rgba(255,246,235,0.13)",
  text: "#f0eeea", textSub: "#cdc8bf", textMuted: "#a09a90",
  blue: "#00b0d4", indigo: "#0e7fa8", green: "#10b981",
  red: "#f43f5e", amber: "#fde047", cyan: "#219ebc", violet: "#00a8e8",
  celeste: "#2fb8da",   // celeste · acumulada del Pareto (la línea que cruza)
  // Paleta PREMIUM de gráficos (owner 2026-06-30 · líneas y barras · 3 tiers/series): vibrante → ahumado → metálico.
  elec: "#3d74f5",      // azul eléctrico vibrante · tier alto / serie actual
  teal: "#5b9ea0",      // turquesa ahumado · tier medio / serie año anterior
  lav:  "#a49bd0",      // lavanda metálico · tier bajo / serie presupuesto
};

export const NUM_BASE = {
  fontFamily:"'JetBrains Mono', ui-monospace, monospace",
  fontFeatureSettings:"'tnum'",
  fontWeight:600,
  fontSize:"1.05em",
  letterSpacing:"0.2px",
  padding:"1px 5px",
  borderRadius:3,
  background:"rgba(255,255,255,0.04)",
  border:"1px solid rgba(255,255,255,0.04)",
  whiteSpace:"nowrap",
  verticalAlign:"baseline"
};

export const FINANCIAL_HIGHLIGHT = {
  money: { ...NUM_BASE, color:"#FFFFFF" },
  pct:   { ...NUM_BASE, color:"#FFFFFF" },
  unit:  { ...NUM_BASE, color:"#FFFFFF" },
  mult:  { ...NUM_BASE, color:"#FFFFFF" },
  ratio: { ...NUM_BASE, color:"#FFFFFF" },
  pp:    { ...NUM_BASE, color:"#fde047", background:"rgba(253,224,71,0.06)", border:"1px solid rgba(253,224,71,0.1)" },
  up:    { ...NUM_BASE, color:"#10b981", background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.1)" },
  down:  { ...NUM_BASE, color:"#f43f5e", background:"rgba(244,63,94,0.06)", border:"1px solid rgba(244,63,94,0.1)" },
  entity:{ color:"#eef2f6", fontWeight:600 },
};

// Estilos "plain" sin chip: usados en contexto tabular para no romper alineación columnar.
export const FINANCIAL_PLAIN = {
  money: { color:"#FFFFFF", fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:"0.94em", fontFeatureSettings:"'tnum'", letterSpacing:"0.2px" },
  pct:   { color:"#FFFFFF", fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:"0.94em", fontFeatureSettings:"'tnum'" },
  unit:  { color:"#FFFFFF", fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:"0.94em", fontFeatureSettings:"'tnum'" },
  mult:  { color:"#FFFFFF", fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:"0.94em", fontFeatureSettings:"'tnum'" },
  ratio: { color:"#FFFFFF", fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:"0.94em", fontFeatureSettings:"'tnum'" },
  pp:    { color:"#fde047", fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:"0.94em", fontFeatureSettings:"'tnum'" },
  up:    { color:"#10b981", fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:"0.94em", fontFeatureSettings:"'tnum'" },
  down:  { color:"#f43f5e", fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:"0.94em", fontFeatureSettings:"'tnum'" },
  entity:{ color:"#eef2f6", fontWeight:600 },
};

// Estilos TABULAR · SOLO color/peso · SIN font-family ni font-size → heredan del contenedor monoespaciado →
// alineación de columnas perfecta (bold-mono = mismo ancho que regular-mono · cifras y texto al mismo tamaño).
export const FINANCIAL_TABULAR = {
  money: { color:"#FFFFFF", fontWeight:600 },
  pct:   { color:"#FFFFFF", fontWeight:600 },
  unit:  { color:"#FFFFFF", fontWeight:600 },
  mult:  { color:"#FFFFFF", fontWeight:600 },
  ratio: { color:"#FFFFFF", fontWeight:600 },
  pp:    { color:"#fde047", fontWeight:600 },
  up:    { color:"#10b981", fontWeight:600 },
  down:  { color:"#f43f5e", fontWeight:600 },
  entity:{ color:"#eef2f6", fontWeight:600 },
};

// DERIVADO del dato (hardening prep-LLM): antes era una lista literal de 14 nombres → si el owner (o el LLM) agrega
// un cliente, ADI lo nombra pero el highlight no lo resaltaba. Ahora sale de clientesMargen · longest-first para el
// regex del tokenizer (Mercado Libre antes que Lider · match más largo primero) · presentación pura (byte-safe).
export const KNOWN_ENTITIES = clientesMargen
  .filter((c) => c.tipo === "cliente")
  .map((c) => c.nombre)
  .sort((a, b) => b.length - a.length);
