/* === adi/sentrix/rotacion.js · LA ROTACIÓN MEDIA · UNA sola implementación ==================================
 * Vivía dentro de `headline.js` (decisión 6 del owner, 2026-08-09: se extrajo ahí porque el builder y el drill
 * decían 6,0x y 5,8x «con el mismo nombre y en la misma cara»). Sale a su propio módulo el 2026-08-10, sin cambiar
 * una línea de la cuenta, por una razón mecánica: `cuadro.js` también publica una rotación en su fila Total y
 * `headline.js` IMPORTA `cuadro.js`, así que el Cuadro no podía consumir la función sin un ciclo de imports — y
 * por eso seguía recalculando un promedio SIMPLE local. Medido en bonanza: 5,3x en el eje bodega y 5,8x en el eje
 * SKU, contra los 6,0x que la cara Capital publica como la rotación del negocio: tres cifras con el mismo nombre.
 * `headline.js` la re-exporta, así que todo importador existente sigue funcionando igual.
 *
 * PURO · sin estado · sin escenario (recibe las filas ya resueltas por quien las tiene).
 */
const _r1 = (n) => Math.round(n * 10) / 10;

/* Acepta las dos formas de fila que conviven en el producto (`stockUSD` del inventario crudo, `capital` del
 * diagnóstico) porque son la misma columna con dos nombres, no dos conceptos. Sin capital no hay ponderación
 * posible y devuelve 0 — nunca cae al promedio simple en silencio, que es exactamente cómo nació la segunda verdad. */
export function rotacionPonderada(rows) {
  const rs = Array.isArray(rows) ? rows : [];
  const cap = rs.reduce((a, r) => a + (Number(r && (r.stockUSD ?? r.capital)) || 0), 0);
  if (!cap) return 0;
  return _r1(rs.reduce((a, r) => a + (Number(r && r.rotacion) || 0) * (Number(r && (r.stockUSD ?? r.capital)) || 0), 0) / cap);
}
