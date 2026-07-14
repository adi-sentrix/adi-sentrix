/* === src/ui/theme.js ===
 * Tokens visuales + estilos del highlighter financiero · extraídos de 41cc33d8 · verbatim.
 * Presentación pura · cero cálculo. La única diferencia con el monolito es DÓNDE vive el estilo. */
import { clientesMargen } from "../data/demoData.js";   // hardening prep-LLM · KNOWN_ENTITIES derivado del dato (no lista hardcodeada)

// Paleta NEUTRA (owner 2026-07-10: "darle vida a ADI — bases blanco/negro/gris claro, y el celeste para resaltar
// números y textos"): negro y grises NEUTROS (muere el sepia/cálido), texto blanco, y el CELESTE como único acento
// de identidad — ahora también en las CIFRAS (FINANCIAL_*). Los colores SEMÁNTICOS no se tocan: verde=suma,
// rojo=resta, ámbar=vara/corte (cargan significado — doctrina del producto).
export const C = {
  bg: "#0a0a0a", surface: "#151515", surfaceAlt: "#1d1d1d", surfaceHover: "#262626",
  // CARDS DEL DIÁLOGO (owner 2026-07-09: "gris clarito elegante" → ahora gris NEUTRO claramente más luminoso que
  // el fondo, solo para el chat (burbujas + cards del hero); los paneles Sentrix quedan en surface.
  card: "#232323", cardUser: "#2b2b2b", cardBorder: "rgba(255,255,255,0.14)",
  border: "rgba(255,255,255,0.09)", borderLight: "rgba(255,255,255,0.13)",
  text: "#f5f5f5", textSub: "#c9c9c9", textMuted: "#969696",
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

// CIFRAS EN CELESTE (owner 2026-07-10: "para resaltar cosas el celeste — números, textos"): las magnitudes neutras
// (plata, %, unidades, ratios) llevan el acento de identidad; las SEMÁNTICAS conservan su color (pp ámbar · up
// verde · down rojo — dirección y vara significan, no decoran).
export const FINANCIAL_HIGHLIGHT = {
  money: { ...NUM_BASE, color:"#2fb8da", background:"rgba(47,184,218,0.07)", border:"1px solid rgba(47,184,218,0.13)" },
  pct:   { ...NUM_BASE, color:"#2fb8da", background:"rgba(47,184,218,0.07)", border:"1px solid rgba(47,184,218,0.13)" },
  unit:  { ...NUM_BASE, color:"#2fb8da", background:"rgba(47,184,218,0.07)", border:"1px solid rgba(47,184,218,0.13)" },
  mult:  { ...NUM_BASE, color:"#2fb8da", background:"rgba(47,184,218,0.07)", border:"1px solid rgba(47,184,218,0.13)" },
  ratio: { ...NUM_BASE, color:"#2fb8da", background:"rgba(47,184,218,0.07)", border:"1px solid rgba(47,184,218,0.13)" },
  pp:    { ...NUM_BASE, color:"#fde047", background:"rgba(253,224,71,0.06)", border:"1px solid rgba(253,224,71,0.1)" },
  up:    { ...NUM_BASE, color:"#10b981", background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.1)" },
  down:  { ...NUM_BASE, color:"#f43f5e", background:"rgba(244,63,94,0.06)", border:"1px solid rgba(244,63,94,0.1)" },
  entity:{ color:"#eef2f6", fontWeight:600 },
};

// Estilos "plain" sin chip: usados en contexto tabular para no romper alineación columnar.
export const FINANCIAL_PLAIN = {
  money: { color:"#2fb8da", fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:"0.94em", fontFeatureSettings:"'tnum'", letterSpacing:"0.2px" },
  pct:   { color:"#2fb8da", fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:"0.94em", fontFeatureSettings:"'tnum'" },
  unit:  { color:"#2fb8da", fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:"0.94em", fontFeatureSettings:"'tnum'" },
  mult:  { color:"#2fb8da", fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:"0.94em", fontFeatureSettings:"'tnum'" },
  ratio: { color:"#2fb8da", fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:"0.94em", fontFeatureSettings:"'tnum'" },
  pp:    { color:"#fde047", fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:"0.94em", fontFeatureSettings:"'tnum'" },
  up:    { color:"#10b981", fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:"0.94em", fontFeatureSettings:"'tnum'" },
  down:  { color:"#f43f5e", fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:"0.94em", fontFeatureSettings:"'tnum'" },
  entity:{ color:"#eef2f6", fontWeight:600 },
};

// Estilos TABULAR · SOLO color/peso · SIN font-family ni font-size → heredan del contenedor monoespaciado →
// alineación de columnas perfecta (bold-mono = mismo ancho que regular-mono · cifras y texto al mismo tamaño).
export const FINANCIAL_TABULAR = {
  money: { color:"#2fb8da", fontWeight:600 },
  pct:   { color:"#2fb8da", fontWeight:600 },
  unit:  { color:"#2fb8da", fontWeight:600 },
  mult:  { color:"#2fb8da", fontWeight:600 },
  ratio: { color:"#2fb8da", fontWeight:600 },
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
