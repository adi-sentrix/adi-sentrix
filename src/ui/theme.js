/* === src/ui/theme.js ===
 * Tokens visuales + estilos del highlighter financiero · extraídos de 41cc33d8 · verbatim.
 * Presentación pura · cero cálculo. La única diferencia con el monolito es DÓNDE vive el estilo. */

// Paleta SOBRIA + CÁLIDA (Etapa 5 · look de Code · owner 2026-06-29): charcoal cálido (sutil, no sepia),
// texto off-white cálido, cero brillo de ambiente. Cyan SOLO como acento funcional frío (cifras/logo/activo ·
// identidad de ADI) → contraste premium frío-sobre-cálido. Bordes con una pizca de calidez.
export const C = {
  bg: "#0e0d0c", surface: "#181715", surfaceAlt: "#221f1d", surfaceHover: "#292623",
  border: "rgba(255,251,245,0.06)", borderLight: "rgba(255,251,245,0.09)",
  text: "#ecebe8", textSub: "#bcbab5", textMuted: "#8d8a84",
  blue: "#00b0d4", indigo: "#0e7fa8", green: "#10b981",
  red: "#f43f5e", amber: "#fde047", cyan: "#219ebc", violet: "#00a8e8",
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
  entity:{ color:"#7fdef0", fontWeight:500 },
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
  entity:{ color:"#7fdef0", fontWeight:500 },
};

export const KNOWN_ENTITIES = [
  "Mercado Libre", "Falabella", "Lider", "Líder", "Jumbo", "Sodimac",
  "Tottus", "Paris", "Ripley", "Easy", "La Polar", "Hites", "ABC", "Unimarc"
];
