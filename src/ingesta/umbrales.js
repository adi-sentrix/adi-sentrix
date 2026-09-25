/* === ingesta/umbrales.js · LOS UMBRALES CON LOS QUE SE JUZGA LA PLAUSIBILIDAD (2026-09-25) =====================
 *
 * Extraído de `handleIngesta.server.js` (corrección del supervisor sobre el Acta de ingesta — «una sola
 * verdad»: `umbralesDe` estaba duplicado, una copia en el endpoint y otra en `acta/actaDeIngesta.js`). Esta es
 * la ÚNICA copia; el comportamiento no cambió una coma — es el mismo cuerpo, movido.
 *
 * ⚠️ CAEN A LA REFERENCIA GENERAL DE ADI (2026-08-26). Antes salían solo de lo que el negocio declaraba en su
 * cabecera, y cuando el owner sacó esos parámetros de la plantilla —«no tienes para qué colocar eso»— la
 * alarma principal («casi todo el inventario sobre el techo») se habría quedado sin techo y no podría sonar
 * nunca. Es la misma referencia con la que el diagnóstico asigna los estados, así que la vara es una sola.
 *
 * PURO · sin dependencias de servidor (ni `persistirCarga.server.js`, ni nada que lea sesión, base o red):
 * por eso puede vivir en `src/ingesta/` y ser importado tanto por el endpoint (`handleIngesta.server.js`) como
 * por el Acta (`acta/actaDeIngesta.js`, que no puede depender de un módulo `.server.js`).
 */
import { POLICY_CONFIG } from "../config/businessPolicy.js";

/** umbralesDe(dataset) → { dohMax, rotacionMin, benchmark } — la vara del negocio, o la de ADI si no la declaró. */
export function umbralesDe(dataset) {
  const p = (dataset && dataset.perfil) || {};
  const u = {};
  for (const k of ["dohMax", "rotacionMin", "benchmark"]) {
    u[k] = typeof p[k] === "number" ? p[k] : POLICY_CONFIG[k];
  }
  return u;
}
