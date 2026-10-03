/* === src/adi/continuidad/serializar.js · UNA COLA POR CLAVE (Etapa 2, bloque 1 · guardado durable) ═══════════════
 * Leer el libro, calcular y guardarlo NO es atómico: con un almacén asíncrono (la base), dos llamadas de la MISMA
 * conversación que se crucen leen las dos el turno 0, calculan las dos el turno 1 y guardan las dos — la segunda
 * pisa a la primera y UNA Entrega entregada desaparece del libro («el pasado no se reescribe»). Lo mismo con la
 * memoria de empresa: dos «el plazo es 45» en paralelo guardarían dos filas donde la ley dice una.
 *
 * `serializarPorClave(clave, fn)` ejecuta las `fn` de una MISMA clave de a una, en orden de llegada; claves
 * distintas corren en paralelo sin esperarse. Una `fn` que lanza no envenena la cola: la siguiente corre igual.
 *
 * ALCANCE, DICHO SIN ADORNO: es un candado DE PROCESO. Protege dos llamadas que caen en la misma instancia del
 * servidor; NO protege dos instancias distintas del hosting. Esa garantía solo puede darla la base (guardar el
 * libro con «solo si sigue en el turno que leí»), y es una decisión de migración que queda reportada al owner. El
 * estado vive en el módulo: un reinicio lo vacía, que es lo correcto (no hay nada que esperar de un proceso
 * que ya no existe).
 *
 * REGLA DE USO: la clave de un candado externo nunca se vuelve a tomar adentro de otro con la MISMA clave (la cola
 * no es reentrante: se esperaría a sí misma). `capacidad/acciones.js` toma UNA clave por acción. */
const _colas = new Map();

export function serializarPorClave(clave, fn) {
  const previa = _colas.get(clave) || Promise.resolve();
  const actual = previa.then(() => fn());
  // la cola avanza aunque `fn` falle; el error le llega a QUIEN LLAMÓ (por `actual`), no a la siguiente en la cola
  const cola = actual.then(() => undefined, () => undefined);
  _colas.set(clave, cola);
  cola.then(() => { if (_colas.get(clave) === cola) _colas.delete(clave); });
  return actual;
}

/** colasAbiertas() → número de claves con trabajo pendiente (para el candado: una cola vacía no deja rastro). */
export const colasAbiertas = () => _colas.size;
