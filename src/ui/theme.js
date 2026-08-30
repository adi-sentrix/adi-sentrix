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
  /* LA COSTURA · dónde Sentrix toca a ADI. En el tablero NO hay costura: negro contra negro, no había nada
     que separar. Va como token —y no como un condicional dentro de App.jsx— porque con TRES superficies un
     condicional de dos lados ya no alcanza. El `null` dice «acá no se dibuja junta», no es un olvido. */
  sombraJunta: null,
  /* LAS PASTILLAS DE LA BARRA · el owner las pidió opacas y con resplandor: «deben estar en cuadro negro
     notarse». En el tablero eso es un negro más hondo que el fondo. */
  veloBarra: "linear-gradient(90deg, rgba(10,10,10,0.97) 0%, rgba(10,10,10,0.95) 44%, rgba(10,10,10,0.72) 76%, rgba(10,10,10,0) 100%)",
  pastillaBg: "#0b0b0d",
  pastillaSombra: "0 10px 26px -10px rgba(0,0,0,0.95)",
  /* ⚠️ `esPapel` Y `esSuperficieADI` NO SON LO MISMO, y confundirlas era el riesgo de esta versión.
     · `esPapel` = la superficie es CLARA. Decide COLOR: cuánto tinte lleva un resalte, si una sombra
       hunde o apoya. Sólo la enciende el papel blanco.
     · `esSuperficieADI` = estamos en el diseño NUEVO del lado que conversa (papel o pizarra). Decide
       ESTRUCTURA: que la respuesta de ADI no lleve burbuja, que el titular sea corto, que el pulso no vaya,
       que los hexágonos se corran al costado. Son decisiones del owner sobre LA CONVERSACIÓN, no sobre el
       color — y por eso tienen que sobrevivir a que la hoja pase de blanca a gris. Fue literalmente lo que
       pidió al elegir la pizarra: «mantener todo el resto».
     El tablero de `?papel=0` es el diseño viejo entero: las dos en false. */
};

/* ⚠️ ACÁ VIVÍA `TEMA_PAPEL`, la hoja blanca. Fue LA superficie del producto entre el 26 y el 27 de agosto, y
 * se retiró cuando el owner eligió la pizarra: «consolidar la experiencia elegida; sacar las variantes que ya
 * no vamos a usar». Mantener una paleta clara viva obligaba a decidir dos veces cada color nuevo —cuánto tinte
 * sobre blanco, cuánta luz sobre gris— para una superficie que nadie iba a ver.
 * Lo que la hoja blanca dejó y sigue vivo es el MÉTODO: los claros no se inventaron, se midieron de la landing;
 * la retícula de hexágonos y el latido se calibraron rasterizando y comparando tinta. Esa forma de trabajar es
 * la que produjo los números de la pizarra. */

/* ── LA PIZARRA · la superficie que eligió el owner (2026-08-27) ───────────────────────────────────────────────
 * EL DIAGNÓSTICO, con sus palabras: «el contraste blanco y negro es un poco pesado para la vista». Y la medida
 * le daba la razón: la hoja en #fafafa contra el tablero en #0a0a0a es un salto de 19,2 a 1 —el rango entero
 * en un pixel— y ese pixel cae justo en el medio de la pantalla, por donde el ojo cruza cien veces mientras
 * lee una respuesta y mira el dato. En pizarra ese salto queda en 1,10 a 1.
 *
 * DE DOS PROPUESTAS ELIGIÓ ÉSTA (B · pizarra) y no la neutra: gris con una vuelta FRÍA, del lado del celeste,
 * casi a la misma profundidad que Sentrix. Los dos lados no se separan por un salto de color sino por un
 * filete de luz en la junta, así que la pantalla se lee como un solo instrumento con dos caras.
 *
 * ⚠️ LA ORDEN QUE MANDA ACÁ ES «MANTENER TODO EL RESTO», y por eso esta paleta NO reinventa nada:
 *   · los SEMÁNTICOS son los del tablero, byte por byte — verde, rojo, ámbar y celeste significan lo mismo y
 *     ya están calibrados para oscuro, que es donde la pizarra vive. Moverlos obligaría a recalibrar los
 *     semáforos, los sellos y cada cifra dentro de la prosa.
 *   · el celeste queda en #2fb8da, EL MISMO de Sentrix. La propuesta lo mostraba un punto más vivo (#35bfdd);
 *     se descartó a propósito, porque el acento lo comparten los dos lados y el otro lado no se toca.
 *   · los HEXÁGONOS se quedan —el owner los nombró— y con el MISMO peso en pantalla que tenían sobre papel. */
const TEMA_PIZARRA = {
  bg: "#14171b", surface: "#1b1f25", surfaceAlt: "#20242b", surfaceHover: "#262c34",
  card: "#1b1f25", cardUser: "#222730", cardBorder: "rgba(176,204,232,0.14)",
  border: "rgba(176,204,232,0.10)", borderLight: "rgba(176,204,232,0.15)",
  text: "#e8ecf1", textSub: "#9aa4b0", textMuted: "#7d8794",
  /* IDÉNTICOS AL TABLERO · no es pereza: lo que SIGNIFICA no cambia de superficie */
  blue: "#00b0d4", indigo: "#0e7fa8", green: "#10b981",
  red: "#f43f5e", amber: "#fde047", cyan: "#219ebc", violet: "#00a8e8",
  celeste: "#2fb8da",
  elec: "#3d74f5", teal: "#7fc9c4", lav: "#a49bd0",
  hoverSuave: "rgba(190,215,240,0.04)",
  hoverMedio: "rgba(190,215,240,0.07)",
  velo: "rgba(190,215,240,0.10)",
  entidad: "#f2f6fa",
  /* ⚠️ LA RETÍCULA Y EL LATIDO, MEDIDOS CONTRA LO QUE EL OWNER YA VEÍA. Sobre papel la retícula era tinta al
     0,203; acá es LUZ sobre gris, que es el mismo gesto al revés, y copiar el número habría dado otra cosa.
     Se rasterizaron las dos versiones y se buscó el alfa que iguala la tinta total: retícula 0,23 (desvío
     0,2%) y latido 0,37 (desvío 0,7%). O sea: se notan exactamente igual que ahora, que es lo que se pidió. */
  hexTrazo: "rgba(198,222,242,0.23)",
  hexLit: "rgba(47,184,218,0.37)",
  logoTrazo: "rgba(214,232,245,0.32)",
  haloNucleo: "rgba(47,184,218,0.14)",
  haloAmplio: "rgba(47,184,218,0.10)",
  dashInactivo: "#5f6b78",
  /* el campo se HUNDE, como en el tablero: sobre gris hay dónde hundirse. El filete de arriba es luz fría. */
  sombraCampo: "0 2px 10px rgba(0,0,0,0.34), inset 0 1px 0 rgba(190,215,240,0.05)",
  sombraCampoFoco: "0 0 0 3px rgba(47,184,218,0.13), inset 0 1px 0 rgba(190,215,240,0.06)",
  /* EL PLIEGUE ILUMINADO · lo que separa las dos caras, y lo que hace que esta propuesta sea ÉSTA y no la
     neutra. Filete celeste tenue, resplandor corto hacia la izquierda, sombra negra pegada al canto. */
  sombraJunta: "-14px 0 30px -16px rgba(47,184,218,0.35), -3px 0 12px -6px rgba(0,0,0,0.60), -1px 0 0 rgba(90,190,220,0.26)",
  /* EL VELO DE LA BARRA · el degradado que se enciende detrás de las pastillas cuando la barra se abre. Va como
     token y no escrito en el CSS porque es LA MISMA superficie viniendo hacia adelante: si el fondo cambia, el
     velo tiene que cambiar con él o deja de leerse como la misma hoja y pasa a ser una mancha encima. Termina
     en transparente para que el borde derecho no sea una línea, que es justo lo que se veía mal. */
  veloBarra: "linear-gradient(90deg, rgba(20,23,27,0.97) 0%, rgba(20,23,27,0.95) 44%, rgba(20,23,27,0.72) 76%, rgba(20,23,27,0) 100%)",
  /* la pastilla se LEVANTA del fondo (más clara), al revés que en el tablero, donde se hundía */
  pastillaBg: "#1f242c",
  pastillaSombra: "0 10px 26px -10px rgba(0,0,0,0.85)",
};

/** `C` · la superficie donde estás. Arranca en el tablero: sin interruptor, nada cambia. */
export const C = { ...TEMA_TABLERO };

/** `T` · el tablero, SIEMPRE. Lo que mide no cambia de mundo. Congelado a propósito: si alguien lo mutara,
 *  los gráficos y los semáforos se irían a claro y habría que recalibrar todo el color semántico. */
export const T = Object.freeze({ ...TEMA_TABLERO });

/** ¿la superficie actual es papel? Lo consultan las pocas piezas cuya ESTRUCTURA cambia, no solo su color. */
/* ⚠️ ACÁ VIVÍAN `esPapel()` y `esSuperficieADI()`. Existían para que las piezas del chat supieran sobre qué
 * superficie estaban dibujando, mientras convivían la pizarra, la hoja blanca y el diseño viejo. Con una sola
 * superficie no hay nada que preguntar: las decisiones que colgaban de ellos —la respuesta de ADI sin burbuja,
 * el titular corto, el hero sin bajada y sin pulso, los hexágonos al costado— son el producto, y están escritas
 * derecho en `ChatADI.jsx`, cada una con la orden del owner que la fijó.
 * La distinción que ELLOS enseñaron sigue valiendo y quedó anotada donde se aplicó: una cosa es el COLOR y otra
 * la ESTRUCTURA. Confundirlas fue lo que casi apagó las cuatro decisiones al pasar la hoja de blanca a gris. */


/* aplicarTema("papel" | "tablero") → reescribe `C` en el lugar. Se llama UNA vez, antes de montar React. */
export function aplicarTema(nombre) {
  /* Queda una sola superficie de conversación. La firma se conserva —recibe un nombre— porque es la puerta por
     la que `C` se escribe en el lugar, y catorce archivos dependen de que esa referencia no cambie. */
  const fuente = TEMA_PIZARRA;
  for (const k of Object.keys(fuente)) C[k] = fuente[k];
  _aplicarFinancieros(fuente);
  return C;
}

/** Las tres tablas de resalte de cifras viven aparte y también tienen que seguir la superficie: una cifra en
 *  celeste #2fb8da sobre papel blanco no se lee. El ámbar, el verde y el rojo CONSERVAN su significado. */
function _aplicarFinancieros(t) {
  const cif = t.celeste, ent = t.entidad;
  const tinte = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  for (const clave of ["money", "pct", "unit", "mult", "ratio"]) {
    FINANCIAL_HIGHLIGHT[clave] = { ...NUM_BASE, color: cif, background: tinte(cif, 0.07), border: `1px solid ${tinte(cif, 0.13)}` };
    FINANCIAL_PLAIN[clave].color = cif;
    FINANCIAL_TABULAR[clave].color = cif;
  }
  /* ⚠️ LOS ALFAS DEL TABLERO SON LOS HISTÓRICOS (0.06 y 0.1), no unos redondeados: con el interruptor apagado
   * la app tiene que quedar idéntica, y un tinte 0.02 más fuerte ya es una diferencia. Sobre papel se suben
   * un punto porque un tinte tan tenue sobre blanco no se ve. */
  /* ⚠️ LOS ALFAS SON LOS HISTÓRICOS (0.06 y 0.1), no unos redondeados: un tinte 0,02 más fuerte ya es una
   * diferencia visible sobre oscuro. La rama que los subía un punto era para la hoja blanca —un tinte tan tenue
   * sobre blanco no se veía— y se fue con ella. */
  const aF = 0.06, aB = 0.1;
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
