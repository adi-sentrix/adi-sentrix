/* === _papel_y_tablero_gate.mjs · EL REDISEÑO NO PUEDE MOVER LA APP DE HOY (owner 2026-08-26) =================
 *
 * LA PROMESA QUE HAY QUE SOSTENER, y es la que el owner pidió antes de dejar tocar una línea: «el cambio entero
 * va detrás de un parámetro. Mientras vos no lo escribas, la app queda EXACTAMENTE como está hoy». Todo el
 * rediseño «papel y tablero» descansa sobre eso, así que acá se prueba primero.
 *
 * CÓMO SE PRUEBA SIN CREER EN NADIE: la paleta del tablero está SELLADA abajo, con los valores que tenía el
 * archivo antes del rediseño, copiados uno por uno. Si alguien toca un token creyendo que «solo afecta al modo
 * papel», este gate lo caza — porque compara contra el sello, no contra sí mismo.
 *
 * ⚠️ LA SEGUNDA GARANTÍA ES `T`. La regla del rediseño es «todo lo que MIDE viene en oscuro», y eso solo se
 * sostiene si existe un juego de tokens que el interruptor no puede tocar. Si `T` siguiera al tema, los gráficos,
 * los semáforos y los sellos se irían a claro y habría que recalibrar el color semántico entero — que es
 * exactamente el trabajo que este diseño existe para evitar.
 *
 * @inspeccion-estatica · lee los .jsx COMO TEXTO para certificar qué superficie usa qué paleta. No importa el
 * gateway ni ningún adapter y no invoca a nadie.
 *
 * OFFLINE · tokens y lectura de fuentes · no puede gastar. */
import { readFileSync } from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
import { C, T, esPapel, esSuperficieADI, aplicarTema, FINANCIAL_HIGHLIGHT, FINANCIAL_PLAIN, FINANCIAL_TABULAR } from "./src/ui/theme.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};
const H = (t) => console.log("\n" + "=".repeat(100) + "\n" + t + "\n" + "=".repeat(100));
const leer = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

/* ── EL SELLO · la paleta que tenía la app ANTES del rediseño, token por token ─────────────────────────────────
 * No es una copia decorativa: es el patrón contra el que se mide «no se movió nada». Si el rediseño necesitara
 * cambiar uno de estos valores, hay que cambiarlo ACÁ también — y entonces deja de ser un cambio invisible. */
const TABLERO_SELLADO = {
  bg: "#0a0a0a", surface: "#151515", surfaceAlt: "#1d1d1d", surfaceHover: "#262626",
  card: "#232323", cardUser: "#2b2b2b", cardBorder: "rgba(255,255,255,0.14)",
  border: "rgba(255,255,255,0.09)", borderLight: "rgba(255,255,255,0.13)",
  text: "#f5f5f5", textSub: "#c9c9c9", textMuted: "#969696",
  blue: "#00b0d4", indigo: "#0e7fa8", green: "#10b981",
  red: "#f43f5e", amber: "#fde047", cyan: "#219ebc", violet: "#00a8e8",
  celeste: "#2fb8da", elec: "#3d74f5", teal: "#7fc9c4", lav: "#a49bd0",
};

H("1 · CON EL INTERRUPTOR APAGADO, LA APP DE HOY NO SE MUEVE");
{
  ok(esPapel() === false, "el tema arranca en TABLERO: sin `?papel=1` no hay nada que activar");
  const movidos = Object.keys(TABLERO_SELLADO).filter((k) => C[k] !== TABLERO_SELLADO[k]);
  ok(movidos.length === 0,
    `los ${Object.keys(TABLERO_SELLADO).length} tokens sellados están intactos`,
    movidos.map((k) => `${k}: sellado ${TABLERO_SELLADO[k]} · vivo ${C[k]}`).join("\n      "));

  /* Las tres tablas de resalte de cifras también viajan en el tema y también tienen que quedar quietas: son
   * las que pintan cada número dentro de la prosa de ADI. */
  ok(FINANCIAL_HIGHLIGHT.money.color === "#2fb8da" && FINANCIAL_HIGHLIGHT.pp.color === "#fde047",
    "el resalte de cifras sigue en su celeste y su ámbar");
  ok(FINANCIAL_HIGHLIGHT.pp.background === "rgba(253,224,71,0.06)",
    `…con los alfas históricos, no unos redondeados (${FINANCIAL_HIGHLIGHT.pp.background})`);
  ok(FINANCIAL_PLAIN.entity.color === "#ffffff" && FINANCIAL_TABULAR.up.color === "#10b981",
    "…y las entidades y los semáforos, iguales");
}

H("2 · `T` ES EL TABLERO Y NO SE MUEVE NUNCA · es lo que sostiene «lo que mide viene en oscuro»");
{
  const movidos = Object.keys(TABLERO_SELLADO).filter((k) => T[k] !== TABLERO_SELLADO[k]);
  ok(movidos.length === 0, "T nace igual al tablero sellado", movidos.join(", "));
  ok(Object.isFrozen(T), "…y está CONGELADO: nadie puede mutarlo por accidente");
  aplicarTema("papel");
  const trasPapel = Object.keys(TABLERO_SELLADO).filter((k) => T[k] !== TABLERO_SELLADO[k]);
  ok(trasPapel.length === 0, "…y sigue igual DESPUÉS de encender el papel: el interruptor no lo alcanza", trasPapel.join(", "));
  ok(C.bg === "#fafafa" && esPapel() === true, `mientras que C sí cambió (${C.bg})`);
  ok(C.celeste === "#0f7290", `…y el celeste se oscurece para leerse sobre claro (${C.celeste})`);
  ok(FINANCIAL_HIGHLIGHT.money.color === "#0f7290", "…incluido el resalte de cifras dentro de la prosa");
  ok(FINANCIAL_HIGHLIGHT.pp.color === "#b47908" && FINANCIAL_HIGHLIGHT.up.color === "#0f8a5f",
    "…y el ámbar y el verde conservan su SIGNIFICADO, oscurecidos lo justo");
  aplicarTema("tablero");
  ok(C.bg === "#0a0a0a" && esPapel() === false && FINANCIAL_HIGHLIGHT.money.color === "#2fb8da",
    "y al volver al tablero queda todo como estaba: el cambio es reversible sin tocar una línea");
}

H("3 · QUIÉN VIVE EN QUÉ MUNDO · la regla, hecha imports");
{
  /* Se mira el import y no una lista de colores: es la línea que decide si una superficie sigue al interruptor
   * o se queda en el tablero. Un archivo que MIDE y que importe `C` se iría a claro sin que nadie lo note. */
  for (const [ruta, que] of [
    ["./src/ui/SentrixPanel.jsx", "Sentrix"],
    ["./src/ui/InlineChart.jsx", "los gráficos que ADI dibuja en sus respuestas"],
  ]) {
    const src = leer(ruta);
    ok(/^import \{ T as C \} from "\.\/theme\.js";/m.test(src),
      `${que}: importa el TABLERO — el interruptor no lo alcanza`);
  }
  const chat = leer("./src/ui/ChatADI.jsx");
  ok(chat.includes('import { C, T, esPapel, esSuperficieADI } from "./theme.js";'),
    "el chat importa las dos paletas y los DOS predicados: conversa en su superficie y mide en tablero");
  const main = leer("./src/main.jsx");
  /* ⚠️ EL INTERRUPTOR SE DIO VUELTA (owner 2026-08-26: «subeloooo»). Nació apagado tras `?papel=1`; ahora el
   * papel ES la app y el tablero es la vuelta atrás, con `?papel=0`. Lo que NO cambió —y es lo que las
   * secciones 1 y 2 protegen— es que el defecto del MÓDULO siga siendo el tablero: los gates y cualquier
   * prueba fuera del navegador tienen que seguir viendo la paleta sellada. */
  ok(main.includes('_sup === "1"') && main.includes('aplicarTema("papel")'),
    "el PAPEL sigue existiendo, detrás de `?papel=1`");
  ok(main.includes('_sup !== "0"') && main.includes('aplicarTema("pizarra")'),
    "la PIZARRA es la superficie por defecto: sin parámetro, es lo que se ve");
  ok(main.includes('get("papel")'),
    "…y el parámetro se sigue llamando `papel`: es el que está escrito en los gates y el que el owner usa");
  /* Se comparan las LLAMADAS, no los imports: los `import` van todos arriba por definición, así que compararlos
   * no dice nada sobre el orden de ejecución. La primera versión de este chequeo se puso roja por eso. */
  const iAplica = main.indexOf('aplicarTema("pizarra")');
  const iMonta = main.indexOf("createRoot(document");
  ok(iAplica > 0 && iMonta > 0 && iAplica < iMonta,
    `el tema se aplica ANTES de montar React (posición ${iAplica} < ${iMonta}): sin parpadeo de negro a papel`);
}

H("4 · LO QUE EL OWNER PIDIÓ CONSERVAR, conservado");
{
  const chat = leer("./src/ui/ChatADI.jsx");
  /* La respuesta de ADI sin burbuja es ESTRUCTURA, no color, y esa distincion se pago cara: hasta el 27 de
   * agosto colgaba de esPapel(), o sea del COLOR, y al pasar la hoja de blanca a gris se habria perdido sola.
   * Ahora cuelga de esSuperficieADI(). En el tablero de ?papel=0 la burbuja sigue existiendo, con su borde
   * celeste — eso es lo que prueba la afirmacion de mas abajo. */
  /* Se mira LA LINEA DE ARRIBA del marcador, no todo el archivo: `...(esPapel()` sigue existiendo mas abajo,
     en la rama del pulso que solo corre en el tablero. Lo que hay que probar es que ESTA decision —la burbuja—
     dejo de colgar del color. Con indexOf y sin expresiones regulares: es una comparacion de texto, no un acertijo. */
  const _iBurbuja = chat.indexOf('background:"transparent", padding:"2px 0 0"');
  const _antesDeLaBurbuja = _iBurbuja > 0 ? chat.slice(Math.max(0, _iBurbuja - 120), _iBurbuja) : "";
  ok(_antesDeLaBurbuja.includes("esSuperficieADI("),
    "en la superficie de ADI la respuesta NO tiene burbuja: texto sobre la hoja");
  ok(_iBurbuja > 0 && !_antesDeLaBurbuja.includes("esPapel("),
    "…y esa decision ya no cuelga del color: es estructura, y sobrevive a que la hoja pase de blanca a gris");
  ok(/border:"1px solid rgba\(47,184,218,0\.22\)"/.test(chat),
    "…y en el tablero la burbuja conserva su borde celeste, intacta");
  /* El pulso: el owner eligió «con pulso» como base. Las cifras son BOTONES — es lo que las hace puertas de
   * entrada y no datos repetidos de la Mesa, y es la razón por la que no se sacó. */
  ok(/onClick=\{\(\) => onPregunta\(c\.ask\)\}/.test(chat),
    "cada cifra del pulso sigue siendo un BOTÓN que manda su pregunta al chat");
  ok(/background:T\.bg, borderRadius:13/.test(chat),
    "…y sobre papel el pulso es una tarjeta del TABLERO: lo que mide viene en oscuro");
  ok(/color:T\.celeste/.test(chat) && /color:T\.textMuted/.test(chat),
    "…con sus tokens del tablero, para que la cifra se lea sobre el negro de la tarjeta");

  const barra = leer("./src/ui/BarraLateral.jsx");
  ok(/datos-abrir/.test(barra), "la cuarta puerta «Tus datos» sigue en la barra");
  ok(/^import \{ C \} from "\.\/theme\.js";/m.test(barra),
    "…y la barra sigue el tema: sobre papel queda en papel, con las barritas oscuras");
  const panel = leer("./src/ui/PanelDatos.jsx");
  ok(/datos-referencia/.test(panel) && /no es tu meta/.test(panel),
    "la pantalla de carga y su recuadro de procedencia del benchmark, sin tocar");
}

H("5 · LA PIZARRA · el gris que eligió el owner, y lo que prometió NO mover");
{
  /* ⚠️ ÉSTE ES EL SELLO DE «MANTENER TODO EL RESTO» (owner 2026-08-27, al elegir la propuesta B). La pizarra
   * cambia LA SUPERFICIE del lado que conversa y NADA MÁS. Lo que más fácil se rompe después es justamente
   * eso: alguien toca un semántico «para que combine con el gris» y se lleva puesto el significado. */
  aplicarTema("pizarra");
  ok(C.bg === "#14171b", `la pizarra aplica su gris (${C.bg})`);
  ok(esPapel() === false, "…y NO es papel: es oscura, así que los tintes y las sombras son los de oscuro");
  ok(esSuperficieADI() === true, "…pero SÍ es superficie de ADI: la estructura nueva se mantiene entera");

  const semanticos = ["celeste","blue","indigo","green","red","amber","cyan","violet","elec","teal","lav"];
  const movidos = semanticos.filter((k) => C[k] !== TABLERO_SELLADO[k]);
  ok(movidos.length === 0,
    `los ${semanticos.length} colores que SIGNIFICAN son los del tablero, byte por byte`,
    movidos.map((k) => `${k}: sellado ${TABLERO_SELLADO[k]} · vivo ${C[k]}`).join(" · "));
  ok(C.celeste === "#2fb8da",
    "…incluido el celeste, que es EL MISMO de Sentrix: el acento lo comparten los dos lados");
  ok(FINANCIAL_HIGHLIGHT.money.color === "#2fb8da" && FINANCIAL_HIGHLIGHT.pp.background === "rgba(253,224,71,0.06)",
    "…y el resalte de cifras vuelve a los alfas del tablero, que es donde está calibrado");

  /* LOS HEXÁGONOS · el owner los nombró por su nombre («incluyendo los Hexágonos»), así que tienen que seguir
   * declarados y con tinta de verdad. Un token vacío los apagaría sin que nadie se entere. */
  ok(C.hexTrazo === "rgba(198,222,242,0.23)", `la retícula sigue, calibrada para el gris (${C.hexTrazo})`);
  ok(C.hexLit === "rgba(47,184,218,0.37)", "…y el latido también, con su alfa medido contra el papel");

  ok(typeof C.sombraJunta === "string" && C.sombraJunta.includes("rgba(90,190,220,0.26)"),
    "la junta es un PLIEGUE ILUMINADO: el filete celeste es lo que distingue esta propuesta de la neutra");

  const trasPizarra = Object.keys(TABLERO_SELLADO).filter((k) => T[k] !== TABLERO_SELLADO[k]);
  ok(trasPizarra.length === 0, "y T sigue intacto: lo que MIDE no se enteró de nada", trasPizarra.join(", "));

  aplicarTema("tablero");
  ok(C.bg === "#0a0a0a" && esSuperficieADI() === false,
    "?papel=0 devuelve el diseño VIEJO entero — no sólo el color: vuelven la burbuja, el titular largo y el pulso");

  const chat = leer("./src/ui/ChatADI.jsx");
  ok(chat.includes('{esSuperficieADI() ? "¿Por dónde empezamos?"'),
    "el titular corto cuelga de la superficie de ADI, no del color");
  ok(chat.includes("{pulso && !esSuperficieADI() &&"), "…el pulso sigue fuera de la superficie de ADI");
  ok(chat.includes("esSuperficieADI() ? _HEX_LIT_PAPEL : _HEX_LIT"),
    "…y los hexágonos encendidos siguen corridos al costado, que fue la orden de no interponerse");
}

H("6 · CARNADA · el chequeo de «no se movió nada» tiene que poder ponerse rojo");
{
  /* Sin esto, la sección 1 podría estar comparando el sello contra sí mismo y dar verde para siempre. Se
   * fabrica el cambio que el gate existe para cazar y se comprueba que la comparación lo detecta. */
  const torcido = { ...TABLERO_SELLADO, bg: "#111111" };
  const detecta = Object.keys(torcido).filter((k) => C[k] !== torcido[k]);
  ok(detecta.length === 1 && detecta[0] === "bg",
    `un solo token cambiado se detecta, y se nombra (${detecta.join(", ")})`);
  ok(C.bg !== torcido.bg, "…y el vivo NO coincide con el torcido: la comparación distingue de verdad");
}

console.log(`\n── _papel_y_tablero_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
