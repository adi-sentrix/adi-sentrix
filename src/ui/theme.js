/* === src/ui/theme.js ===
 * Tokens visuales + estilos del highlighter financiero · extraídos de 41cc33d8 · verbatim.
 * Presentación pura · cero cálculo. La única diferencia con el monolito es DÓNDE vive el estilo. */
import { clientesMargen } from "../data/demoData.js";   // hardening prep-LLM · KNOWN_ENTITIES derivado del dato (no lista hardcodeada)
import { onTenantChange } from "../data/tenantStore.js";   // F1 multiempresa · KNOWN_ENTITIES se re-arma en initTenant

/* ── LOS DOS MUNDOS · «papel y tablero» (frente UX · owner 2026-08-26) ─────────────────────────────────────────
 * LA REGLA QUE LO GOBIERNA TODO, del owner: «a la izquierda se conversa, a la derecha se mide. TODO LO QUE MIDE
 * VIENE EN OSCURO; el papel es donde se conversa». De ahí salen DOS juegos de tokens y no uno:
 *
 *   · `C` — la superficie donde estás. Sigue el tema activo: negro hoy, papel con `?papel=1`.
 *   · `T` — el TABLERO, siempre oscuro. Lo usan las superficies que MIDEN: Sentrix, los gráficos que ADI dibuja
 *     dentro de sus respuestas, y las tablas. Por eso no hay que recalibrar ni una serie, ni un semáforo, ni un
 *     sello: siguen viviendo sobre negro, que es donde ya funcionan.
 *
 * ⚠️ `C` ES EL MISMO OBJETO SIEMPRE. `aplicarTema` reescribe sus propiedades en el lugar en vez de crear otro
 * objeto, porque catorce archivos ya lo importan y leen `C.bg` al pintar. Cambiar la referencia obligaría a tocar
 * los catorce; cambiar las propiedades no obliga a tocar ninguno.
 *
 * ⚠️ CON EL INTERRUPTOR APAGADO NO SE MUEVE NADA. `TEMA_TABLERO` son los mismos valores que estaban escritos acá
 * antes, verbatim. Sin `?papel=1` la app queda byte-idéntica — es la garantía que pidió el owner, y hay un gate
 * que la comprueba comparando las dos paletas contra la original.
 *
 * LOS CLAROS NO SE INVENTARON: son los que el frente UX midió de la landing — #fafafa lienzo, #f5f5f6 el papel
 * hondo (historial y burbuja del usuario), blanco puro para las tarjetas, filetes #e9e8ea, texto #17181c, y el
 * celeste que se oscurece a #0f7290 para seguir siendo legible sobre claro. */

const TEMA_TABLERO = {
  bg: "#0a0a0a", surface: "#151515", surfaceAlt: "#1d1d1d", surfaceHover: "#262626",
  card: "#232323", cardUser: "#2b2b2b", cardBorder: "rgba(255,255,255,0.14)",
  border: "rgba(255,255,255,0.09)", borderLight: "rgba(255,255,255,0.13)",
  text: "#f5f5f5", textSub: "#c9c9c9", textMuted: "#969696",
  blue: "#00b0d4", indigo: "#0e7fa8", green: "#10b981",
  red: "#f43f5e", amber: "#fde047", cyan: "#219ebc", violet: "#00a8e8",
  celeste: "#2fb8da",
  elec: "#3d74f5", teal: "#7fc9c4", lav: "#a49bd0",
  /* añadidos por el rediseño · en el tablero valen lo que ya se escribía a mano en cada archivo */
  hoverSuave: "rgba(255,255,255,0.035)",
  hoverMedio: "rgba(255,255,255,0.06)",
  velo: "rgba(255,255,255,0.10)",
  entidad: "#ffffff",
  /* EL CAMPO DE HEXÁGONOS Y SU LATIDO · lo único del rediseño que no se resuelve cambiando un color, sino
   * INVIRTIÉNDOLO: sobre negro la retícula es luz tenue, sobre papel es tinta tenue. Mismo gesto, al revés. */
/* ⚠️ CALIBRADO PARA UNA SOLA PASADA (2026-08-26). Estos valores subieron —0,036→0,121 y 0,085→0,264— y
     NO es que la retícula se haya querido más oscura: **se ve igual de cargada que antes**. Antes cada línea
     se dibujaba entre 2 y 6 veces encimada y la tinta se acumulaba sola; ahora se dibuja UNA sola vez.
     LOS NÚMEROS NO SON A OJO: se rasterizó la retícula vieja y la nueva y se buscó el alfa que iguala la tinta
     total. Papel 0,085→0,203 (308.250 vs 307.864 de tinta, 0,1% de diferencia); tablero 0,036→0,084 (133.408
     vs 132.660, 0,6%). Lo que cambió no es el peso: es que el desnivel entre unas líneas y otras pasó de 1,85
     y 2,25 a **1,00**. Ver la nota del `pattern` en ChatADI.jsx. */
  hexTrazo: "rgba(255,255,255,0.084)",
  hexLit: "rgba(47,184,218,0.15)",
  logoTrazo: "rgba(255,255,255,0.30)",
  haloNucleo: "rgba(47,184,218,0.13)",
  haloAmplio: "rgba(47,184,218,0.09)",
  dashInactivo: "#6b6f74",
  /* LA SOMBRA DEL CAMPO DE PREGUNTA · en el tablero es un pozo negro con un filete de luz arriba; sobre papel
   * ese mismo pozo ensucia la hoja. Va como token porque es una SOMBRA, no un color: se reemplaza entera. */
  sombraCampo: "0 2px 10px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03)",
  sombraCampoFoco: "0 0 0 3px rgba(47,184,218,0.12), inset 0 1px 0 rgba(255,255,255,0.04)",
  esPapel: false,
};

const TEMA_PAPEL = {
  bg: "#fafafa", surface: "#ffffff", surfaceAlt: "#f5f5f6", surfaceHover: "#eeedf0",
  /* la burbuja del usuario es papel gris; la de ADI no existe — se resuelve en ChatADI, no con un color */
  card: "#ffffff", cardUser: "#f5f5f6", cardBorder: "#e9e8ea",
  border: "#e9e8ea", borderLight: "#dbd9dd",
  text: "#17181c", textSub: "#5c5b63", textMuted: "#8b8a93",
  /* los SEMÁNTICOS se oscurecen lo justo para seguir significando sobre claro: verde suma, rojo resta, ámbar vara */
  blue: "#0f7290", indigo: "#0b5c74", green: "#0f8a5f",
  red: "#c0344b", amber: "#b47908", cyan: "#137f9c", violet: "#0f7290",
  celeste: "#0f7290",
  elec: "#2a55c9", teal: "#4f8f8a", lav: "#6f66a0",
  hoverSuave: "rgba(23,24,28,0.035)",
  hoverMedio: "rgba(23,24,28,0.06)",
  velo: "rgba(23,24,28,0.10)",
  entidad: "#17181c",
  /* MEDIDOS SOBRE EL PAPEL, no derivados: el 0.036 del tablero invertido a tinta desaparece —el ojo perdona
   * mucha menos luz sobre claro que sombra sobre negro—, así que la retícula sube a 0.085 y el latido se hace
   * celeste profundo. El owner lo dijo mirándolo: «los hexágonos quiero que se noten más, al igual que el
   * efecto que tienen, se nota muy poco». */
/* ⚠️ CALIBRADO PARA UNA SOLA PASADA (2026-08-26). Estos valores subieron —0,036→0,121 y 0,085→0,264— y
     NO es que la retícula se haya querido más oscura: se ve igual que antes. Antes cada línea se dibujaba
     entre 2 y 6 veces encimada y la tinta se acumulaba sola; ahora se dibuja UNA. El número es la media de
     tinta que daba el dibujo viejo, así que el peso en pantalla no se movió — lo que se fue es que unas
     líneas salieran al doble que otras. Ver la nota del `pattern` en ChatADI.jsx. */
  hexTrazo: "rgba(23,24,28,0.203)",
  hexLit: "rgba(15,114,144,0.30)",
  logoTrazo: "rgba(23,24,28,0.38)",
  haloNucleo: "rgba(15,114,144,0.20)",
  haloAmplio: "rgba(15,114,144,0.12)",
  dashInactivo: "rgba(23,24,28,0.32)",
  /* sobre papel el campo se APOYA en vez de hundirse: un filete y una sombra corta y baja, como la tarjeta de
   * la landing. Sin luz interior — sobre blanco no hay nada que iluminar. */
  sombraCampo: "0 1px 2px rgba(23,24,28,0.05), 0 8px 24px -14px rgba(23,24,28,0.20)",
  sombraCampoFoco: "0 0 0 3px rgba(15,114,144,0.14), 0 1px 2px rgba(23,24,28,0.05)",
  esPapel: true,
};

/** `C` · la superficie donde estás. Arranca en el tablero: sin interruptor, nada cambia. */
export const C = { ...TEMA_TABLERO };

/** `T` · el tablero, SIEMPRE. Lo que mide no cambia de mundo. Congelado a propósito: si alguien lo mutara,
 *  los gráficos y los semáforos se irían a claro y habría que recalibrar todo el color semántico. */
export const T = Object.freeze({ ...TEMA_TABLERO });

/** ¿la superficie actual es papel? Lo consultan las pocas piezas cuya ESTRUCTURA cambia, no solo su color. */
export const esPapel = () => C.esPapel === true;

/* aplicarTema("papel" | "tablero") → reescribe `C` en el lugar. Se llama UNA vez, antes de montar React. */
export function aplicarTema(nombre) {
  const fuente = nombre === "papel" ? TEMA_PAPEL : TEMA_TABLERO;
  for (const k of Object.keys(fuente)) C[k] = fuente[k];
  _aplicarFinancieros(fuente);
  return C;
}

/** Las tres tablas de resalte de cifras viven aparte y también tienen que seguir la superficie: una cifra en
 *  celeste #2fb8da sobre papel blanco no se lee. El ámbar, el verde y el rojo CONSERVAN su significado. */
function _aplicarFinancieros(t) {
  const cif = t.celeste, ent = t.entidad, papel = t.esPapel;
  const tinte = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  for (const clave of ["money", "pct", "unit", "mult", "ratio"]) {
    FINANCIAL_HIGHLIGHT[clave] = { ...NUM_BASE, color: cif, background: tinte(cif, papel ? 0.09 : 0.07), border: `1px solid ${tinte(cif, papel ? 0.16 : 0.13)}` };
    FINANCIAL_PLAIN[clave].color = cif;
    FINANCIAL_TABULAR[clave].color = cif;
  }
  /* ⚠️ LOS ALFAS DEL TABLERO SON LOS HISTÓRICOS (0.06 y 0.1), no unos redondeados: con el interruptor apagado
   * la app tiene que quedar idéntica, y un tinte 0.02 más fuerte ya es una diferencia. Sobre papel se suben
   * un punto porque un tinte tan tenue sobre blanco no se ve. */
  const aF = papel ? 0.10 : 0.06, aB = papel ? 0.18 : 0.1;
  FINANCIAL_HIGHLIGHT.pp = { ...NUM_BASE, color: t.amber, background: tinte(t.amber, aF), border: `1px solid ${tinte(t.amber, aB)}` };
  FINANCIAL_HIGHLIGHT.up = { ...NUM_BASE, color: t.green, background: tinte(t.green, aF), border: `1px solid ${tinte(t.green, aB)}` };
  FINANCIAL_HIGHLIGHT.down = { ...NUM_BASE, color: t.red, background: tinte(t.red, aF), border: `1px solid ${tinte(t.red, aB)}` };
  for (const tabla of [FINANCIAL_PLAIN, FINANCIAL_TABULAR]) {
    tabla.pp.color = t.amber; tabla.up.color = t.green; tabla.down.color = t.red;
    tabla.entity.color = ent;
  }
  FINANCIAL_HIGHLIGHT.entity = { color: ent, fontWeight: 700, borderBottom: `1px solid ${tinte(cif, 0.45)}`, paddingBottom: "0.5px" };
  FINANCIAL_PLAIN.entity.borderBottom = `1px solid ${tinte(cif, 0.45)}`;
}

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
  // ENTIDADES con su propio toque (owner 2026-07-10: "resaltar el Lider… le dará un toque diferente"): blanco pleno
  // + subrayado celeste sutil — distintivo sin competir con el celeste de las cifras.
  entity:{ color:"#ffffff", fontWeight:700, borderBottom:"1px solid rgba(47,184,218,0.45)", paddingBottom:"0.5px" },
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
  entity:{ color:"#ffffff", fontWeight:700, borderBottom:"1px solid rgba(47,184,218,0.45)", paddingBottom:"0.5px" },
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
  entity:{ color:"#ffffff", fontWeight:700 },   // tabular: sin subrayado (la grilla queda limpia)
};

// DERIVADO del dato (hardening prep-LLM): antes era una lista literal de 14 nombres → si el owner (o el LLM) agrega
// un cliente, ADI lo nombra pero el highlight no lo resaltaba. Ahora sale de clientesMargen · longest-first para el
// regex del tokenizer (Mercado Libre antes que Lider · match más largo primero) · presentación pura (byte-safe).
const _knownEntities = () => clientesMargen
  .filter((c) => c.tipo === "cliente")
  .map((c) => c.nombre)
  .sort((a, b) => b.length - a.length);
export let KNOWN_ENTITIES = _knownEntities();
onTenantChange(() => { KNOWN_ENTITIES = _knownEntities(); });

/* Se resuelve al evaluar el módulo: sin interruptor, el tablero — los mismos valores de siempre. */
aplicarTema("tablero");
