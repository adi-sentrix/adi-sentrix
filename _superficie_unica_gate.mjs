/* === _superficie_unica_gate.mjs · UNA SOLA SUPERFICIE, Y EL TABLERO INTACTO (owner 2026-08-27) ================
 *
 * ESTE GATE REEMPLAZA A `_papel_y_tablero_gate`, Y LE DA VUELTA EL TRABAJO. Aquél nació el 2026-08-26 para
 * sostener una promesa del owner mientras se decidía el rediseño: «el cambio entero va detrás de un parámetro;
 * mientras vos no lo escribas, la app queda EXACTAMENTE como está». Comprobaba, con 45 afirmaciones, que las
 * variantes NO se vieran.
 *
 * El 2026-08-27 el owner cerró la decisión: «la UX ya está definida y aprobada. Deja de tratar los interruptores
 * como exploración. Consolidar la experiencia elegida como comportamiento normal de la app». Con eso, la promesa
 * que aquel gate cuidaba dejó de tener objeto —no hay nada que no mover, porque ya se movió y se aprobó— y lo
 * que hay que cuidar es lo de al lado: que la experiencia elegida sea LA ÚNICA y que nadie reintroduzca una
 * variante por comodidad.
 *
 * LO QUE SE CONSERVA ENTERO DEL GATE ANTERIOR es su parte más valiosa: el SELLO del tablero. `T` es la paleta de
 * todo lo que MIDE —Sentrix, los gráficos, los semáforos— y no puede moverse ni un byte, porque si se moviera
 * habría que recalibrar el color semántico completo. Ese sello viaja acá tal cual estaba.
 *
 * @inspeccion-estatica · lee los .jsx COMO TEXTO. No importa el gateway ni ningún adapter y no invoca a nadie.
 * OFFLINE · tokens y lectura de fuentes · no puede gastar. */
import { readFileSync } from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
import { C, T, aplicarTema, FINANCIAL_HIGHLIGHT, FINANCIAL_PLAIN, FINANCIAL_TABULAR } from "./src/ui/theme.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};
const H = (t) => console.log("\n" + "=".repeat(100) + "\n" + t + "\n" + "=".repeat(100));
const leer = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

/* ── EL SELLO · la paleta del TABLERO, token por token ────────────────────────────────────────────────────────
 * No es una copia decorativa: es el patrón contra el que se mide «lo que mide no se movió». Si algo de esto
 * necesitara cambiar, hay que cambiarlo ACÁ también — y entonces deja de ser un cambio invisible. */
const TABLERO_SELLADO = {
  bg: "#0a0a0a", surface: "#151515", surfaceAlt: "#1d1d1d", surfaceHover: "#262626",
  card: "#232323", cardUser: "#2b2b2b", cardBorder: "rgba(255,255,255,0.14)",
  border: "rgba(255,255,255,0.09)", borderLight: "rgba(255,255,255,0.13)",
  text: "#f5f5f5", textSub: "#c9c9c9", textMuted: "#969696",
  blue: "#00b0d4", indigo: "#0e7fa8", green: "#10b981",
  red: "#f43f5e", amber: "#fde047", cyan: "#219ebc", violet: "#00a8e8",
  celeste: "#2fb8da", elec: "#3d74f5", teal: "#7fc9c4", lav: "#a49bd0",
};

H("1 · HAY UNA SOLA SUPERFICIE DE CONVERSACIÓN, Y ES LA PIZARRA");
{
  aplicarTema("pizarra");
  ok(C.bg === "#14171b", `la superficie es la pizarra (${C.bg})`);
  /* ⚠️ Y NO HAY OTRA A LA QUE VOLVER. La firma de `aplicarTema` conserva su parámetro —es la puerta por la que
   * `C` se reescribe en el lugar, y catorce archivos dependen de que esa referencia no cambie— pero el nombre
   * ya no elige nada. Pedirle cualquier otra cosa devuelve la misma superficie: no queda un camino escondido. */
  aplicarTema("papel");
  ok(C.bg === "#14171b", "…y pedir «papel» ya no devuelve otra: no quedó una puerta trasera");
  aplicarTema("tablero");
  ok(C.bg === "#14171b", "…ni pedir «tablero»");

  const tema = leer("./src/ui/theme.js");
  ok(!tema.includes("const TEMA_PAPEL ="), "la paleta de la hoja blanca ya no existe en el código");
  ok(!tema.includes("export const esPapel"), "…ni el predicado que preguntaba por ella");
  ok(!tema.includes("export const esSuperficieADI"), "…ni el que preguntaba por la superficie");

  const main = leer("./src/main.jsx");
  ok(main.includes('aplicarTema("pizarra")'), "el arranque aplica la pizarra, sin condición");
  ok(!main.includes('get("papel")'), "…y no lee ningún parámetro de superficie de la dirección");
}

H("2 · EL TABLERO NO SE MOVIÓ · es la paleta de todo lo que MIDE, y eso no era una variante");
{
  /* ⚠️ ESTA ES LA PARTE QUE SOBREVIVE INTACTA DEL GATE ANTERIOR. Retirar el tablero como SUPERFICIE DE
   * CONVERSACIÓN no lo retira como PALETA DE MEDICIÓN: Sentrix, los gráficos que ADI dibuja en sus respuestas y
   * cada semáforo siguen viviendo sobre él. Son dos cosas con el mismo nombre, y confundirlas costaría
   * recalibrar el color semántico entero. */
  const movidos = Object.keys(TABLERO_SELLADO).filter((k) => T[k] !== TABLERO_SELLADO[k]);
  ok(movidos.length === 0, `los ${Object.keys(TABLERO_SELLADO).length} tokens sellados de T están intactos`,
    movidos.map((k) => `${k}: sellado ${TABLERO_SELLADO[k]} · vivo ${T[k]}`).join(" · "));
  ok(Object.isFrozen(T), "…y T está CONGELADO: nadie puede mutarlo por accidente");
  aplicarTema("pizarra");
  const tras = Object.keys(TABLERO_SELLADO).filter((k) => T[k] !== TABLERO_SELLADO[k]);
  ok(tras.length === 0, "…y sigue igual después de aplicar la superficie", tras.join(", "));

  const panel = leer("./src/ui/SentrixPanel.jsx");
  ok(panel.includes('import { T as C } from "./theme.js";'),
    "Sentrix importa el TABLERO, no la superficie: lo que mide no cambia de mundo");
  const chart = leer("./src/ui/InlineChart.jsx");
  ok(chart.includes('import { T as C } from "./theme.js";'),
    "…y los gráficos que ADI dibuja en sus respuestas, también");
}

H("3 · LO QUE SIGNIFICA NO CAMBIÓ · los semánticos son los del tablero, byte por byte");
{
  const semanticos = ["celeste", "blue", "indigo", "green", "red", "amber", "cyan", "violet", "elec", "teal", "lav"];
  const movidos = semanticos.filter((k) => C[k] !== TABLERO_SELLADO[k]);
  ok(movidos.length === 0, `los ${semanticos.length} colores que SIGNIFICAN son los del tablero`,
    movidos.map((k) => `${k}: ${C[k]} vs ${TABLERO_SELLADO[k]}`).join(" · "));
  ok(C.celeste === "#2fb8da", "…incluido el celeste, el mismo de Sentrix: el acento lo comparten los dos lados");
  ok(FINANCIAL_HIGHLIGHT.money.color === "#2fb8da" && FINANCIAL_HIGHLIGHT.pp.color === "#fde047",
    "el resalte de cifras sigue en su celeste y su ámbar");
  ok(FINANCIAL_HIGHLIGHT.pp.background === "rgba(253,224,71,0.06)",
    `…con los alfas históricos, no unos redondeados (${FINANCIAL_HIGHLIGHT.pp.background})`);
  ok(FINANCIAL_PLAIN.entity.color === "#f2f6fa" && FINANCIAL_TABULAR.up.color === "#10b981",
    "…y las entidades y los semáforos, en su sitio");
}

H("4 · LAS DECISIONES DEL OWNER, SIN CONDICIÓN · dejaron de ser una rama y pasaron a ser el producto");
{
  /* ⚠️ CADA UNA DE ESTAS CUATRO FUE UNA ORDEN SOBRE CÓMO SE CONVERSA, no sobre el color, y todas colgaban de un
   * predicado mientras convivían con el diseño viejo. Al retirarlo quedaron escritas derecho. Lo que este bloque
   * impide es que vuelvan a colgar de algo: una condición nueva acá sería una variante entrando por la ventana. */
  const chat = leer("./src/ui/ChatADI.jsx");
  ok(!chat.includes("esPapel") && !chat.includes("esSuperficieADI"),
    "el chat ya no pregunta sobre qué superficie dibuja: hay una sola");
  ok(chat.includes("¿Por dónde empezamos?") && !chat.includes("¿Qué quieres entender de tu negocio?"),
    "el titular es el corto, y el largo del diseño viejo no está");
  const iBurbuja = chat.indexOf('background:"transparent", padding:"2px 0 0"');
  ok(iBurbuja > 0, "la respuesta de ADI va sin burbuja: texto sobre la hoja");
  ok(!chat.includes('border:"1px solid rgba(47,184,218,0.22)"'),
    "…y la burbuja con borde celeste del diseño viejo no quedó de reserva");
  ok(!chat.includes("buildPulsoInicio"), "el pulso no se arma: no hay superficie que lo pinte");
  ok(leer("./src/adi/sentrix/pulsoInicio.js") === "", "…y su módulo tampoco quedó dando vueltas sin lectores");
  ok(chat.includes("_HEX_LIT_PAPEL.map"), "los hexágonos encendidos van al costado, sin preguntar");
  ok(chat.includes('_anillo = conversando ? "none" : _HEX_MASK_ANILLO_PAPEL'),
    "…y el hueco central del hero es el grande, el que despeja la columna de texto");
}

H("5 · NO QUEDAN VARIANTES DORMIDAS · ni sus restos");
{
  /* Una variante que nadie ejecuta no es una reserva: es una pieza que el próximo lector tiene que entender
   * antes de descubrir que no hace nada. Estas tres se cerraron el mismo día, por la misma razón. */
  const barra = leer("./src/ui/BarraLateral.jsx");
  ok(!barra.includes('get("barra")'), "la barra ya no lee `?barra`: quedó un solo comportamiento");
  /* ⚠️ EL VELO NO ES UN ADORNO: ES EL ARREGLO. Sin él la barra se abre por encima del contenido sin fondo, y
   * como lo único opaco son las pastillas, entre una y otra se sigue viendo el texto de abajo y cada pastilla
   * cae sobre una palabra distinta. Eso fue lo que el owner marcó el 2026-08-20 —«se superponen a la Mesa
   * central, es poco fino»— y estuvo abierto un mes. Estas líneas impiden que vuelva sin que nadie se entere. */
  ok(barra.includes("adi-rail-velo"), "la barra abre con un velo detrás: la superposición es una capa, no un choque");
  ok(barra.includes("backdrop-filter:blur"), "…con desenfoque, para que lo de abajo se lea como profundidad");
  ok(barra.includes("mask-image:linear-gradient"), "…y se disuelve a la derecha: sin borde duro");
  ok(barra.includes("z-index:-1") && barra.includes("pointer-events:none"),
    "…y va detrás y sin recibir clicks: es fondo, no superficie");
  ok(barra.includes("background:${C.veloBarra}"),
    "el color del velo sale de la paleta: si cambia el fondo, el velo cambia con él");
  ok(!barra.includes("adi-rail--velo") && !barra.includes("adi-rail--apuntada"),
    "…y el CSS de sus tres modos se fue con el parámetro");
  const app = leer("./src/ui/App.jsx");
  ok(!app.includes('get("historial")'), "la app ya no lee `?historial`");
  ok(!app.includes("PanelHistorial"), "…y el panel que mostraba un historial que no existía tampoco está");
  ok(leer("./src/ui/PanelHistorial.jsx") === "", "…ni su archivo");
  ok(!barra.includes("onConversaciones"), "…ni la barrita que lo abría");
}

H("6 · CARNADA · el sello del tablero tiene que poder ponerse rojo");
{
  /* Sin esto, la sección 2 podría estar comparando el sello contra sí mismo y dar verde para siempre. Se
   * fabrica el cambio que el gate existe para cazar y se comprueba que la comparación lo detecta. */
  const torcido = { ...TABLERO_SELLADO, bg: "#111111" };
  const detecta = Object.keys(torcido).filter((k) => T[k] !== torcido[k]);
  ok(detecta.length === 1 && detecta[0] === "bg",
    `un solo token cambiado se detecta, y se nombra (${detecta.join(", ")})`);
  ok(T.bg !== torcido.bg, "…y el vivo NO coincide con el torcido: la comparación distingue de verdad");
}

console.log(`\n── _superficie_unica_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
