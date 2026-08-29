/* === config/moneda.js · CÓMO SE ESCRIBE UN MONTO · UNA SOLA VEZ (owner 2026-08-27) =====================
 *
 * LA ORDEN, textual: «no quiero que ADI asuma CLP ni USD». Y el problema medido antes de escribir esto: había
 * **113 lugares** que ponían el signo `$` a mano y ningún formateador central. La moneda no era un dato del
 * negocio: era una letra repartida por todo el producto. Guardarla sin cerrar eso habría sido guardar un valor
 * que ninguna pantalla usa — el defecto de «nace muerta» que ya apareció dos veces en este frente.
 *
 * ⚠️ LA MONEDA SE DECLARA, NUNCA SE INFIERE. Ni del rango de los valores, ni del país, ni de un valor por
 * defecto cómodo. Es la lección de miles-contra-dólares: dos universos que no reconcilian porque nadie dijo en
 * qué unidad estaba cada uno. Por eso `monedaDelNegocio()` puede devolver `null`, y `null` NO es un error: es
 * «todavía nadie lo dijo», y quien pinta tiene que poder distinguirlo de «son pesos».
 *
 * DE DÓNDE SALE, en este orden y sin adivinar:
 *   1. lo que declaró la planilla en su hoja Empresa (`perfil.moneda`),
 *   2. lo que respondió el usuario en la pantalla de carga, que se guarda en el mismo lugar,
 *   3. nada. Y entonces se rotula sin símbolo, no con uno inventado.
 *
 * ESTE ARCHIVO NO SABE DE REACT NI DE NODE: es una función pura sobre el dato del tenant, así que sirve igual
 * en el navegador, en los módulos de Sentrix y en el servidor.
 */
import { getTenantData } from "../data/tenantStore.js";

/* Las que sabemos escribir bien. No es una lista de monedas permitidas —el usuario puede declarar la que sea—
 * sino de las que tienen símbolo y forma conocidos. Una moneda fuera de esta lista se rotula con su código,
 * que es más honesto que ponerle un `$` que puede querer decir otra cosa. */
const CONOCIDAS = {
  CLP: { simbolo: "$",    decimales: 0, locale: "es-CL" },
  USD: { simbolo: "US$",  decimales: 2, locale: "en-US" },
  EUR: { simbolo: "€",    decimales: 2, locale: "es-ES" },
  ARS: { simbolo: "$",    decimales: 0, locale: "es-AR" },
  PEN: { simbolo: "S/",   decimales: 2, locale: "es-PE" },
  COP: { simbolo: "$",    decimales: 0, locale: "es-CO" },
  MXN: { simbolo: "$",    decimales: 2, locale: "es-MX" },
  BRL: { simbolo: "R$",   decimales: 2, locale: "pt-BR" },
  UF:  { simbolo: "UF",   decimales: 2, locale: "es-CL" },
};

/** Normaliza lo que haya escrito el usuario: «clp», « Usd », «CLP ». No traduce ni corrige: solo limpia. */
export function monedaLimpia(x) {
  const s = String(x == null ? "" : x).trim().toUpperCase();
  return /^[A-Z]{2,6}$/.test(s) ? s : null;
}

/** La moneda declarada para el negocio activo, o `null` si nadie la declaró todavía. */
export function monedaDelNegocio(dataset) {
  const d = dataset || getTenantData();
  return monedaLimpia(d && d.perfil && d.perfil.moneda);
}

/** ¿Se puede rotular un monto sin inventar nada? */
export const monedaDeclarada = (dataset) => monedaDelNegocio(dataset) !== null;

/* fmtMonto(valor, opciones) → el texto de un monto, con la moneda del negocio.
 *
 * ⚠️ SIN MONEDA DECLARADA NO SE PONE SÍMBOLO. Se escribe el número solo. Un `$` puesto «mientras tanto» es
 * exactamente la afirmación que el owner prohibió: le estaría diciendo al usuario en qué moneda está su dato
 * cuando nadie se lo preguntó todavía.
 *
 * `compacto: true` abrevia a millones/miles para las cabeceras, igual que hacía el `_M` de cada archivo.
 */
export function fmtMonto(valor, { compacto = false, dataset = null, sinSimbolo = false } = {}) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return "—";

  const codigo = monedaDelNegocio(dataset);
  const c = (codigo && CONOCIDAS[codigo]) || null;
  const locale = (c && c.locale) || "es-CL";

  let cuerpo;
  if (compacto) {
    const abs = Math.abs(valor);
    if (abs >= 1e6) cuerpo = (valor / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace(".", ",") + "M";
    else if (abs >= 1e3) cuerpo = Math.round(valor / 1e3).toLocaleString(locale) + "K";
    else cuerpo = Math.round(valor).toLocaleString(locale);
  } else {
    const dec = c ? c.decimales : 0;
    cuerpo = (dec ? valor : Math.round(valor)).toLocaleString(locale, { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  if (sinSimbolo || !codigo) return cuerpo;
  return c ? `${c.simbolo}${cuerpo}` : `${cuerpo} ${codigo}`;   // moneda desconocida: su código, nunca un «$» prestado
}

/** El rótulo corto de la moneda para una leyenda o una cabecera: «CLP», «USD»… o null si no hay. */
export const rotuloMoneda = (dataset) => monedaDelNegocio(dataset);

/* simboloMoneda() → el símbolo con el que se escribe un monto, o "" si nadie declaró la moneda.
 *
 * Es la pieza que usan los formateadores que ya existían en cada módulo: conservan SU forma de redondear y
 * abreviar —que es lo que el notario compara contra la boleta— y solo cambian el símbolo. Tocar el número
 * habría sido otra cosa muy distinta: si un monto pasa de «$4.1M» a «4,10 M», el notario deja de reconocerlo. */
export function simboloMoneda(dataset) {
  const codigo = monedaDelNegocio(dataset);
  if (!codigo) return "";
  const c = CONOCIDAS[codigo];
  return c ? c.simbolo : `${codigo} `;   // moneda desconocida: su código delante, nunca un «$» prestado
}

const _escapar = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* patronMonto() → cómo se RECONOCE un monto escrito, para el notario.
 *
 * ⚠️ ESTA FUNCIÓN EXISTE PORQUE EL MURO TAMBIÉN ASUMÍA «$». `guardC` reconocía una cifra de dinero con
 * `/\$\s?[\d.,]+\s?[KMB]?/`: con la moneda en euros —o sin moneda declarada, que es cuando no se escribe
 * símbolo— no encontraba nada, la secuencia quedaba vacía y **el chequeo se saltaba entero**. No fallaba: se
 * volvía ciego, que es peor. El propio comentario de `guardC` ya advertía de esa forma de falso negativo para
 * el caso de «pp».
 *
 * EL SÍMBOLO ES OPCIONAL A PROPÓSITO, y es seguro: quien llama ya decidió por el nombre de la columna que esa
 * cifra es dinero —los porcentajes y los «pp» se desvían antes a su propio patrón—, así que un número pelado
 * en esa rama solo puede ser el monto que se está verificando.
 *
 * `$` se acepta siempre, además del símbolo declarado: el negocio de demostración y todo lo ya escrito lo usan. */
export function patronMonto(dataset, { global = false } = {}) {
  const s = simboloMoneda(dataset).trim();
  const simbolos = [...new Set([s, "$"].filter(Boolean))].map(_escapar).sort((a, b) => b.length - a.length);
  return new RegExp(`(?:${simbolos.join("|")})?\\s?[\\d.,]+\\s?[KMB]?`, global ? "g" : "");
}

/* numeroDelMonto(texto) → el valor numérico de un monto escrito, con su escala (K/M/B).
 * La contraparte de `patronMonto`: el notario no solo tiene que ENCONTRAR la cifra, tiene que poder compararla. */
export function numeroDelMonto(tok, dataset) {
  const s = simboloMoneda(dataset).trim();
  const simbolos = [...new Set([s, "$"].filter(Boolean))].map(_escapar).sort((a, b) => b.length - a.length);
  const m = String(tok).match(new RegExp(`(?:${simbolos.join("|")})?\\s?([\\d.,]+)\\s?([KMB]?)`, "i"));
  if (!m) return null;
  let v = parseFloat(String(m[1]).replace(/,/g, ""));
  if (!Number.isFinite(v)) return null;
  const esc = (m[2] || "").toUpperCase();
  if (esc === "K") v *= 1e3; else if (esc === "M") v *= 1e6; else if (esc === "B") v *= 1e9;
  return v;
}

/* etiquetaSinDeclarar(que) → cómo se dice que algo no fue declarado, en vez de mostrar un cero.
 *
 * ⚠️ UN CERO NO ES «NO HAY». El owner lo pidió por el presupuesto —que quedó FUERA de la plantilla v1, así que
 * para cualquier archivo cargado no existe nunca— y vale igual para cualquier cifra ausente: «$0» dice que el
 * plan era cero, y eso es una afirmación que nadie hizo. */
export const etiquetaSinDeclarar = (que = "presupuesto") => `sin ${que} declarado`;
