/* === _corrida_doble_casos.mjs · EL SET PROBATORIO DE LA CORRIDA DOBLE, UNA SOLA VEZ ===========================
 * 9 hilos · 16 turnos: los casos donde ADI se rompió en vivo + los ejemplos canónicos del owner.
 * Vive aparte —mismo patrón que `_calibracion_casos.mjs` con la matriz de la constitución— porque lo leen DOS
 * consumidores que no se pueden importar entre sí:
 *   · `_corrida_doble.mjs` — el arnés que los corre contra el modelo real (GASTA: no se ejecuta a la ligera).
 *   · `_garantia_anti_null_gate.mjs` — el gate offline que corre EL MISMO set con el modelo mockeado para fijar
 *     que ninguno de estos turnos puede terminar en una pantalla en blanco.
 * Si el set se copiara en el gate, el día que el arnés agregue un hilo el gate seguiría certificando el viejo.
 * DATO PURO: sin imports, sin lógica, sin I/O. */
export const HILOS = [
  { id: "H1·ventas (el hilo que rompió a ADI)", turnos: ["Si subo ventas 4%, ¿qué cambia?", "sobre las ventas", "simula sobre el total de ventas", "el precio queda igual"] },
  { id: "H2·el ejemplo soñado del owner", turnos: ["¿Qué clientes venden mucho pero dejan poco margen?", "reduce en 2 puntos las acciones comerciales de esos clientes y dime si quedan sobre el benchmark"] },
  { id: "H3·capital", turnos: ["¿Cuánto capital tengo inmovilizado en inventario?", "¿y el que lleva más de 90 días parado?"] },
  { id: "H4·premisa falsa", turnos: ["¿por qué Falabella tiene 30% de margen?"] },
  { id: "H5·hueco del dato", turnos: ["¿quiénes dejaron de comprar este año?"] },
  { id: "H6·eje difuso", turnos: ["¿cuál es el costo medio de Bosch?"] },
  { id: "H7·G1 multi-entidad con typos", turnos: ["dame todo lo de falabela y lider y dime cual es peor y por qe"] },
  { id: "H8·criterio + la foto original", turnos: ["recuerda que mi margen mínimo aceptable es 26%", "¿qué significa bajo benchmark?"] },
  { id: "H9·puntual con typos y 2 puntos", turnos: ["¿cómo viene Sodimac?", "baja 2 putnos su carga comercial y dime si queda sobre el benchmark"] },
];

/** TURNOS — los 16 turnos aplanados, en orden. Es lo que el gate recorre. */
export const TURNOS = HILOS.flatMap((h) => h.turnos.map((q) => ({ hilo: h.id, q })));
