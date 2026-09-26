/* === src/adi/capacidad/continuidadMemoria.js · EL DOBLE EN MEMORIA DE LA CONTINUIDAD (Etapa 3, corte 8) ═══════
 * `aportarContexto`/`retomar` (acciones.js) necesitan un lugar donde vivan los aportes de una conversación y su
 * estado vigente MIENTRAS el carril B construye la continuidad real (`src/adi/continuidad/`, `_ADI_DISENO_
 * FLUJO_V2.md` §B: memoria de empresa + libro de conversación + estado vigente, con persistencia en Supabase).
 * Este archivo es el DOBLE de esa pieza — vive en memoria del proceso, se pierde al reiniciar, y existe SOLO
 * para que `capacidad/acciones.js` tenga algo real contra qué probar la FORMA de sus dos acciones sin esperar al
 * otro carril.
 *
 * EL PUNTO DE ENGANCHE: cualquier objeto que implemente esta misma interfaz — `nuevaConversacion`,
 * `obtenerEstado`, `registrarAporte`, `confirmarAporte`, `listarAportes` — sirve. `acciones.js` lo recibe
 * INYECTADO (`crearAcciones({ continuidad })`); el día que el carril B publique `src/adi/continuidad/libro.js`,
 * se pasa esa implementación ahí y NINGUNA línea de `acciones.js` cambia. */

let _contador = 0;
const _ahora = () => new Date().toISOString();

/** crearContinuidadEnMemoria() → una instancia AISLADA del doble (cada llamada es su propio almacén — así un gate
 *  no arrastra estado de otro caso, y `puerta.js` puede compartir una sola instancia por proceso si quiere). */
export function crearContinuidadEnMemoria() {
  const conversaciones = new Map();   // conversacionId → EstadoVigente

  const _vacio = (conversacionId, tenantId = null) => ({
    conversacionId, tenantId, turno: 0, creadoEn: _ahora(), actualizadoEn: _ahora(), hechosAportados: [],
  });

  function nuevaConversacion(tenantId = null) {
    const id = `mem-${Date.now().toString(36)}-${(++_contador).toString(36)}`;
    conversaciones.set(id, _vacio(id, tenantId));
    return id;
  }

  function obtenerEstado(conversacionId) {
    return conversaciones.get(String(conversacionId || "")) || null;
  }

  function registrarAporte(conversacionId, aporte) {
    const id = String(conversacionId || "");
    let estado = conversaciones.get(id);
    if (!estado) { estado = _vacio(id); conversaciones.set(id, estado); }
    const registro = { id: `h${estado.hechosAportados.length + 1}`, ...aporte, estado: "pendiente", creadoEn: _ahora() };
    estado.hechosAportados.push(registro);
    estado.turno += 1;
    estado.actualizadoEn = _ahora();
    return registro;
  }

  function confirmarAporte(conversacionId, aporteId) {
    const estado = conversaciones.get(String(conversacionId || ""));
    if (!estado) return false;
    const a = estado.hechosAportados.find((x) => x.id === aporteId);
    if (!a) return false;
    a.estado = "vigente";
    estado.actualizadoEn = _ahora();
    return true;
  }

  function listarAportes(conversacionId) {
    const estado = conversaciones.get(String(conversacionId || ""));
    return estado ? estado.hechosAportados.slice() : [];
  }

  return { nuevaConversacion, obtenerEstado, registrarAporte, confirmarAporte, listarAportes };
}
