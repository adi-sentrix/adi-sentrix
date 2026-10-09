/* === src/adi/capacidad/brazo.js · EL INTERRUPTOR DEL ALCANCE ESTRUCTURAL (owner 2026-10-09 · `_ADI_DISENO_ALCANCE_DE_LO_ENTREGADO.md`) ═════════════════════════════════════════
 * UN SOLO LUGAR donde se decide qué brazo del experimento A/B corre. La variable de entorno del PROCESO que sirve la puerta (el servidor MCP de ADI, la función de la puerta REST):
 *
 *     ADI_ALCANCE_ESTRUCTURAL = "1"   (por defecto) → BRAZO B = el producto nuevo: cada lista y tabla de una respuesta lleva su ALCANCE como dato (cobertura · selección · orden ·
 *                                        métricas ordenadas o solo mostradas · resto no evaluado), cada respuesta trae «lo establecido» (`establecido`), `conocerEmpresa` dice el
 *                                        valor vigente de cada criterio y la cabecera de uso tiene CUATRO reglas.
 *     ADI_ALCANCE_ESTRUCTURAL = "0"                 → BRAZO A = las entregas de hoy, byte a byte: los campos de universo de siempre (`n` · `parcial`), el índice de dueños de `loEntregado`,
 *                                        la cabecera de cinco reglas, sin `establecido` y sin `vigente`.
 *
 * Solo el experimento lo apaga: el arnés de la medición pone la variable en el entorno del servidor MCP que levanta. Se lee en CADA llamada (nunca se guarda al cargar el módulo): un
 * candado puede probar los dos brazos en el mismo proceso. Cualquier valor distinto de «0» (y la variable ausente) es el brazo B. `retomar` paginado NO depende del brazo (es un arreglo de
 * ADI, no del experimento). Sin `node:*`: corre en `edge` como el resto de la puerta. */

export const VARIABLE_DEL_BRAZO = "ADI_ALCANCE_ESTRUCTURAL";

/** alcanceEstructural() → true en el brazo B (el producto nuevo, por defecto), false en el brazo A (las entregas de hoy). */
export function alcanceEstructural() {
  try {
    const v = typeof process !== "undefined" && process && process.env ? process.env[VARIABLE_DEL_BRAZO] : undefined;
    return String(v == null ? "1" : v).trim() !== "0";
  } catch { return true; }
}

/** brazoActual() → "A" | "B" (para rotular una corrida). */
export const brazoActual = () => (alcanceEstructural() ? "B" : "A");
