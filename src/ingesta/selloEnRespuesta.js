/* === ingesta/selloEnRespuesta.js · ADI NOMBRA EL SELLO CUANDO CORRESPONDE (owner 2026-08-25) =================
 *
 * LA REGLA, textual del owner: «si el usuario confirmó una observación de plausibilidad, ADI puede responder;
 * pero no debe hablar como si el dato estuviera limpio; debe mencionar el sello cuando la respuesta use una
 * métrica afectada por esa observación. No quiero que lo repita en cada frase, pero sí que aparezca cuando
 * corresponda: comparaciones, variaciones, inventario o cualquier lectura afectada.»
 *
 * Eso son dos decisiones distintas y acá viven separadas:
 *   1 · ¿QUÉ TOCA ESTA RESPUESTA?  → `dominiosDeLaRespuesta`
 *   2 · ¿QUÉ OBSERVACIÓN ALCANZA A ESO? → el mapa `DOMINIOS_POR_ALARMA`, que vive junto a las señales.
 * Solo se menciona la intersección. Si un archivo trae tres observaciones y la respuesta habla de inventario,
 * se nombra la de inventario y nada más: mencionar las tres sería volver a la letra chica que nadie lee.
 *
 * ⚠️ POR QUÉ SE MIRA LA RESPUESTA Y NO LA PREGUNTA. El owner lo dijo con precisión: «cuando la RESPUESTA use una
 * métrica afectada». Alguien puede preguntar «¿cómo voy?» y recibir una comparación contra el mes anterior; y al
 * revés, preguntar por el inventario y recibir una declinación honesta que no usa ninguna cifra tocada. Lo que
 * hay que sellar es lo que ADI afirmó, no lo que el usuario quiso saber.
 *
 * ⚠️ DOS CAPAS, PORQUE LA DOCTRINA SOLA NO ALCANZA — está medido en este repo (ver el refuerzo de serie
 * temporal): el bloque de `enLaCarpeta` se lo lleva el cerebro y suele hacerle caso; `anteponerSello` es el
 * cerrojo determinístico que garantiza que aparezca. Y es idempotente: si el cerebro ya lo dijo, no lo repite.
 *
 * CERO CÁLCULO DE NEGOCIO ACÁ. Este módulo no toca una cifra: solo decide si una frase corresponde.
 */
import { DOMINIOS_POR_ALARMA } from "./plausibilidad.js";

/* ── el vocabulario de cada lectura ───────────────────────────────────────────────────────────────────────────
 * Se busca sobre texto NORMALIZADO (minúsculas y sin tildes) y con frontera de palabra, por una razón medida en
 * este proyecto: el candado de voseo estuvo ciego 26 formas por no mirar las versiones sin tilde. «rotación» y
 * «rotacion» son la misma palabra para un lector y dos cadenas distintas para un `includes`.
 *
 * ⚠️ LO QUE NO ESTÁ ACÁ ES TAN DELIBERADO COMO LO QUE SÍ. «sku» y «bodega» quedaron FUERA de `inventario`: un
 * ranking de margen por SKU no es una lectura de inventario, y meterlas haría sonar el sello de inventario en
 * respuestas que solo hablan de rentabilidad. El listón alto es lo que hace que el aviso se siga leyendo. */
export const VOCABULARIO = {
  comparacion: ["variacion", "vario", "variaron", "crecio", "crecimiento", "cayo", "caida", "bajo", "subio",
    "aumento", "aumentaron", "disminuyo", "retrocedio", "tendencia", "interanual", "mes anterior",
    "periodo anterior", "mes pasado", "ano anterior", "ano pasado", "versus", "vs", "pp", "punto porcentual",
    "puntos porcentuales", "respecto del", "respecto al", "contra el mes", "contra el periodo"],
  inventario: ["inventario", "stock", "dias de inventario", "rotacion", "inmovilizado", "inmovilizada",
    "sobrestock", "quiebre", "cobertura", "capital"],
  margen: ["margen", "margenes", "costo", "costos", "contribucion", "benchmark", "brecha", "rentabilidad"],
};

const _norm = (s) => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/* Cortes de oración y detección de cifra, declarados una vez: el punto también separa miles en es-CL, y eso
 * está bien acá — si «$1.234» se parte, los dos pedazos siguen teniendo dígito y el término queda con uno. */
const _CORTE_DE_ORACION = /[\n.;!?]+/;
const _TIENE_CIFRA = /[0-9]/;
const _CORTE_DE_BLOQUE = /\n\s*\n/;          // párrafos: una tabla y su cabecera son UN bloque
// una pleca que separa dos cosas — basta UNA por fila: «Cliente | Margen» es tabla aunque no lleve pleca de cierre
const _ES_TABLA = /\S\s*\|\s*\S/;

/** ¿aparece `termino` como palabra (no como fragmento) dentro de `hay`? · `hay` ya viene normalizado. */
function _tiene(hay, termino) {
  let desde = 0;
  for (;;) {
    const i = hay.indexOf(termino, desde);
    if (i < 0) return false;
    const antes = i === 0 ? " " : hay[i - 1];
    const despues = i + termino.length >= hay.length ? " " : hay[i + termino.length];
    const esLetra = (c) => (c >= "a" && c <= "z") || (c >= "0" && c <= "9");
    if (!esLetra(antes) && !esLetra(despues)) return true;
    desde = i + 1;
  }
}

/* dominiosDeLaRespuesta(texto, calculos) → ["comparacion", "inventario", …]
 * Se miran DOS fuentes porque ninguna alcanza sola: la prosa cubre las lecturas que no declararon cálculo (una
 * cifra ya autorizada que se vuelve a citar), y los bloques [[CALCULO]] cubren lo que la prosa no nombra —traen
 * `op`, `inputs` y `unidad`, así que identifican la métrica aunque el texto la llame de otra manera. */
export function dominiosDeLaRespuesta(texto, calculos = []) {
  const out = new Set();
  const marcar = (hay) => {
    for (const [dominio, terminos] of Object.entries(VOCABULARIO)) {
      if (terminos.some((t) => _tiene(hay, t))) out.add(dominio);
    }
  };

  /* ⚠️ NOMBRAR UNA MÉTRICA NO ES USARLA, y esta distinción es la que hace que el aviso siga sirviendo. «Puedo
   * ayudarte con ventas, márgenes o inventario» nombra tres y no afirma ninguna: sellar eso enseñaría al usuario
   * a saltarse el aviso, que es exactamente lo que el owner no quiere («no quiero que lo repita en cada frase»).
   * La regla que él escribió es precisa —«cuando la respuesta USE una métrica afectada»— y usar una métrica es
   * ponerle un número. Por eso se exige que el término y una cifra convivan en la misma unidad de lectura: una
   * declinación, una oferta o una pregunta de vuelta no sellan; una lectura sí. Medido: sin esta condición, el
   * menú de bienvenida disparaba el sello.
   *
   * ⚠️ LA TABLA ES UNA UNIDAD, NO VARIAS FRASES, y esto también está medido. En «Cliente | Margen» seguido de
   * «La Polar | 34%», el rótulo vive en la cabecera y la cifra en otra fila: mirando línea por línea, ninguna
   * cumple las dos condiciones y la tabla —que es la forma más común de USAR una métrica— quedaba sin sellar.
   * Por eso un bloque con pleca se juzga entero. */
  for (const bloque of _norm(texto).split(_CORTE_DE_BLOQUE)) {
    if (!_TIENE_CIFRA.test(bloque)) continue;
    if (_ES_TABLA.test(bloque)) { marcar(bloque); continue; }
    for (const frase of bloque.split(_CORTE_DE_ORACION)) if (_TIENE_CIFRA.test(frase)) marcar(frase);
  }

  /* LOS CÁLCULOS DECLARADOS CUENTAN SIEMPRE: un bloque [[CALCULO]] trae `resultado` por contrato, así que por
   * definición es una métrica usada. Es la segunda red bajo la tabla — y la que sigue funcionando si mañana la
   * cifra viaja en una forma que este barrido no conoce. */
  for (const c of Array.isArray(calculos) ? calculos : []) {
    if (!c || typeof c !== "object") continue;
    const campos = [];
    for (const k of ["id", "op", "formula", "unidad", "linea"]) if (c[k]) campos.push(String(c[k]));
    if (Array.isArray(c.inputs)) campos.push(c.inputs.join(" "));
    marcar(_norm(campos.join(" ")));
  }
  return [...out];
}

/* observacionesQueAlcanzan(sello, dominios) → las observaciones del sello que tocan alguno de esos dominios. */
export function observacionesQueAlcanzan(sello, dominios) {
  if (!sello || !Array.isArray(sello.observaciones) || !dominios || !dominios.length) return [];
  return sello.observaciones.filter((o) => Array.isArray(o.dominios) && o.dominios.some((d) => dominios.includes(d)));
}

/* mencionDelSello(sello, { texto, calculos }) → la frase, o null si no corresponde decirla.
 * Null es la respuesta normal y frecuente: sin archivo del usuario, sin observaciones, o con observaciones que
 * no alcanzan a lo que esta respuesta afirmó. */
export function mencionDelSello(sello, { texto = "", calculos = [] } = {}) {
  if (!sello || !sello.conAlarmas) return null;
  const alcanzan = observacionesQueAlcanzan(sello, dominiosDeLaRespuesta(texto, calculos));
  const frases = alcanzan.map((o) => o.enUnaLinea).filter(Boolean);
  if (!frases.length) return null;

  const cabeza = sello.confirmadoPorElUsuario
    ? "Sobre los datos que confirmaste"
    : "Sobre datos con una observación sin resolver";
  /* Una sola observación se nombra en singular y con la fórmula del owner; dos o más se enumeran, porque
   * encadenarlas con «y» dentro de la misma cláusula produce una oración que nadie termina de leer. */
  if (frases.length === 1) return `${cabeza}, con la observación de que ${frases[0]}.`;
  return `${cabeza}, con estas observaciones abiertas: ${frases.join("; ")}.`;
}

/* anteponerSello(texto, sello, { calculos }) → el texto con la mención adelante, o el texto igual.
 * EL CERROJO. Va después del notario a propósito: la frase no afirma nada del negocio —no lleva cifras ni
 * atribuye nada a nadie—, así que no hay qué verificar; y ponerla antes obligaría al muro a juzgar una oración
 * que el cerebro no escribió. */
export function anteponerSello(texto, sello, { calculos = [] } = {}) {
  const t = String(texto == null ? "" : texto);
  const m = mencionDelSello(sello, { texto: t, calculos });
  if (!m) return t;
  /* IDEMPOTENTE. El cerebro ya recibió el sello en la carpeta y a veces lo dice por su cuenta — que es lo
   * deseable. Si ya está dicho, repetirlo sería la letra chica dos veces. Se compara por la frase concreta de
   * cada observación, no por la cabecera, porque el cerebro la redacta a su manera. */
  const hay = _norm(t);
  const yaEsta = (Array.isArray(sello.observaciones) ? sello.observaciones : [])
    .map((o) => o.enUnaLinea).filter(Boolean)
    .some((f) => hay.includes(_norm(f)));
  if (yaEsta) return t;
  return `${m}\n\n${t}`;
}

/* enLaCarpeta(sello) → el bloque que ve el cerebro, o "" si no hay nada que declarar.
 * LA CAPA DE DOCTRINA. Entra en la carpeta —no en el prompt fijo— porque es un hecho de ESTE dato, no una regla
 * de la casa: cambia cuando cambia el archivo activo, igual que las cifras que lo acompañan. */
export function enLaCarpeta(sello) {
  if (!sello || !sello.conAlarmas) return "";
  const L = ["", "════════ OBSERVACIONES SOBRE ESTE ARCHIVO ════════"];
  L.push(sello.confirmadoPorElUsuario
    ? "El usuario subió estos datos, vio estas observaciones y eligió seguir igual. Puedes responder con ellos."
    : "Estos datos tienen observaciones sin resolver.");
  L.push("NO hables como si el dato estuviera limpio. Cuando tu respuesta use una lectura afectada, dilo en UNA");
  L.push("frase al principio y sigue normal — no lo repitas en cada oración ni te disculpes por el dato.");
  for (const o of sello.observaciones || []) {
    if (!o.enUnaLinea) continue;
    L.push(`· ${o.enUnaLinea} — afecta: ${(o.dominios || []).join(", ") || "sin alcance declarado"}.`);
  }
  return L.join("\n");
}

/** Los dominios declarados, para que un gate pueda comprobar que el mapa y el vocabulario no se separen. */
export const DOMINIOS = Object.keys(VOCABULARIO);
export { DOMINIOS_POR_ALARMA };
