/* === src/adi/continuidad/almacen.js · LA INTERFAZ DE ALMACENAMIENTO, INYECTABLE (Etapa 2 · owner 2026-09-25/26) ===
 * «Una sola realidad canónica de empresa» (REVISIÓN 3 §2 de `_ADI_DISENO_FLUJO_V2.md`): los módulos puros de
 * `continuidad/` (`empresa.js`, `libro.js`) NUNCA tocan I/O directamente — reciben un ALMACÉN por parámetro,
 * el mismo patrón que ya usa el resto del repo para separar cálculo de transporte (`data/supabaseRest.js` para
 * la base, `oracle/toolRunner.js` para las herramientas). Así el candado offline (`_continuidad_gate.mjs`)
 * ejercita la lógica real con el adaptador EN MEMORIA de más abajo, sin abrir una conexión, y el adaptador de
 * Supabase (`almacenSupabase.js`, escrito aparte, NUNCA importado por un gate) sirve la misma forma cuando el
 * owner autorice aplicar la migración 015 y desplegar.
 *
 * LA FORMA QUE TODO ALMACÉN TIENE QUE CUMPLIR (contrato, no una clase — cualquier objeto con estas funciones sirve):
 *
 *   // memoria de empresa (tabla `memoria_empresa` de la migración 015)
 *   leerHechosEmpresa(tenantId) -> HechoEmpresa[]
 *     Todos los hechos de la empresa, VIGENTES y de HISTORIA (retirados/omitidos incluidos) — el filtrado por
 *     estado lo hace `empresa.js`, no el almacén: un almacén que ya filtrara no podría servir `leerHistoria`.
 *   guardarHechoEmpresa(tenantId, hecho) -> HechoEmpresa
 *     Inserta SIEMPRE una fila nueva (append-only, como `access_audit`): un "reemplazo" es una fila nueva con
 *     `reemplaza: idViejo` más la actualización del estado de la fila vieja — nunca un UPDATE del valor.
 *   actualizarHechoEmpresa(tenantId, id, cambios) -> HechoEmpresa | null
 *     El ÚNICO uso legítimo es tocar `estado` y `confirmacion` (nunca `valor`, `concepto` ni `origen`: la ley
 *     del owner, «la confirmación no cambia el origen», y la ley general, «nunca se reemplaza en silencio»,
 *     hacen que el VALOR de un hecho sea inmutable una vez guardado).
 *
 *   // libro de conversación (columna `estado jsonb` de `conversaciones`, migración 015 — NO una tabla nueva,
 *   // ley del owner: «el libro de conversación va como estado en la tabla conversaciones de la migración 009»)
 *   leerLibro(conversacionId) -> Libro | null
 *   guardarLibro(libro) -> Libro          // upsert por `libro.conversacionId`
 *
 * Puro en el sentido de que NINGÚN módulo de `continuidad/` importa esto para usarlo por su cuenta: cada
 * función de `empresa.js`/`libro.js`/`retomar.js` recibe el almacén como primer o segundo parámetro. El
 * candado (`_continuidad_gate.mjs`) construye el almacén en memoria y se lo pasa a las mismas funciones que un
 * futuro `componerEntrega`/la puerta usarían con `crearAlmacenSupabase(...)`.
 */

/** crearAlmacenEnMemoria() → Almacen · para los gates y para cualquier demo sin base configurada.
 * Cada tenant tiene su propia lista de hechos (aislamiento por clave del Map, no por RLS — acá no hay muro que
 * probar, la seguridad real vive en la migración 015 y en `almacenSupabase.js`). Devuelve SIEMPRE copias: nadie
 * que reciba una fila puede mutar el almacén por accidente compartiendo la misma referencia. */
export function crearAlmacenEnMemoria() {
  const hechosPorTenant = new Map();
  const librosPorConversacion = new Map();
  let contadorId = 0;

  const _clon = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

  return {
    leerHechosEmpresa(tenantId) {
      return (hechosPorTenant.get(tenantId) || []).map(_clon);
    },
    guardarHechoEmpresa(tenantId, hecho) {
      const arr = hechosPorTenant.get(tenantId) || [];
      const copia = _clon(hecho);
      arr.push(copia);
      hechosPorTenant.set(tenantId, arr);
      return _clon(copia);
    },
    actualizarHechoEmpresa(tenantId, id, cambios) {
      const arr = hechosPorTenant.get(tenantId) || [];
      const h = arr.find((x) => x.id === id);
      if (!h) return null;
      Object.assign(h, _clon(cambios));
      return _clon(h);
    },
    leerLibro(conversacionId) {
      const L = librosPorConversacion.get(conversacionId);
      return L ? _clon(L) : null;
    },
    guardarLibro(libro) {
      if (!libro || !libro.conversacionId) throw new Error("guardarLibro: falta conversacionId");
      librosPorConversacion.set(libro.conversacionId, _clon(libro));
      return _clon(libro);
    },
    /* generador de ids del ALMACÉN (no del hecho de negocio ni de la conversación, que emite `libro.js`):
     * sirve para que `empresa.js` no tenga que saber si el id final es un uuid de Postgres o una clave local. */
    nuevoIdHecho() {
      contadorId += 1;
      return `mem-h${contadorId}`;
    },
  };
}
