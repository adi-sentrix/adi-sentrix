/* === src/ingesta/selloHistorial.js · DE QUÉ FECHA SON LAS CIFRAS DE UNA CONVERSACIÓN REABIERTA ===========
 *
 * LA ORDEN DEL OWNER (2026-09-08), textual: «muy bien con fecha». Al reabrir una conversación del historial,
 * su tabla vuelve — y una tabla guardada es la FOTO del dato de ese día. Si el negocio subió una planilla
 * nueva desde entonces, esas cifras son de OTRA carga: presentarlas sin decirlo sería mostrar dos verdades
 * como una sola, que es justo lo que la regla 1 prohíbe.
 *
 * ⚠️ VIVE EN UN MÓDULO PROPIO, PURO, y no en `persistirCarga.server.js` ni en el componente. No en el
 * servidor porque el navegador la necesita y arrastrar un módulo de servidor al bundle mete dependencias que
 * no tienen nada que hacer ahí; no en React porque la regla 3 de la casa es explícita: la frase y el número se
 * arman en el módulo y la vista solo pinta.
 */
const _MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** selloDelHistorial({fecha, carga, vigente}) → la frase que declara la procedencia. "" si no hay sello. */
export function selloDelHistorial(sello) {
  if (!sello || !sello.fecha) return "";
  const [, m, d] = String(sello.fecha).split("-");
  const cuando = (d && m && _MES[Number(m) - 1]) ? `${Number(d)} de ${_MES[Number(m) - 1]}` : String(sello.fecha);
  /* DOS FRASES PORQUE SON DOS SITUACIONES DISTINTAS: con la misma carga la fecha es contexto; con otra carga
   * es una advertencia, y se dice con todas las letras en vez de dejar que el dueño lo deduzca. */
  return sello.vigente
    ? `Cifras del ${cuando}, del mismo dato que tienes cargado hoy.`
    : `Cifras del ${cuando} — son de la carga de datos de entonces, no de la que tienes activa ahora.`;
}
