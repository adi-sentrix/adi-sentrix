/* === src/adi/agente/variacion.js · LA VARIACIÓN DETERMINÍSTICA (owner 2026-09-03, «matar la repetición») ====
 *
 * EL DEFECTO QUE MATA: los cierres de los composers eran UNA cadena por sitio — «Dime y lo abrimos» podía
 * salir tres turnos seguidos, y una frase repetida tres veces suena a máquina aunque cada cifra sea verdad.
 *
 * EL DISEÑO, y sus dos obligaciones a la vez:
 *   · REPRODUCIBLE: la variante sale de un hash (FNV-1a) de una SEMILLA que el bucle arma con lo que el turno
 *     ya tiene (tenant · pregunta · largo del hilo). Mismo turno, mismo texto — siempre. Un gate puede correr
 *     dos veces y exigir igualdad byte a byte.
 *   · VARIADA: turnos distintos (el hilo crece, la pregunta cambia) → semillas distintas → cierres que rotan.
 *
 * SIN SEMILLA (undefined/null/"") SE DEVUELVE LA PRIMERA OPCIÓN: los callers viejos y los gates que llaman
 * `componer({figs})` a secas quedan byte-idénticos a hoy. La variación es opt-in del bucle, no un cambio de
 * conducta de los peldaños.
 *
 * LA GARANTÍA NO SE MUDA ACÁ: cada opción de cada sitio pasa por el MISMO muro y la MISMA lista notarial que
 * la frase única de antes (el turno juzga el texto final, venga la variante que venga). Las opciones varían la
 * PROSA de la envoltura; las cifras y sus dueños viajan idénticos en todas. */

/** variante(semilla, opciones) → una opción, estable para esa semilla. Sin semilla: opciones[0]. */
export function variante(semilla, opciones) {
  if (!Array.isArray(opciones) || !opciones.length) return "";
  if (semilla === undefined || semilla === null || semilla === "") return opciones[0];
  let h = 0x811c9dc5;
  const s = String(semilla);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return opciones[h % opciones.length];
}
