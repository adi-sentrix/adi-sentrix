/* === ingesta/estadoCarga.js · QUÉ ARCHIVO ESTÁ ACTIVO Y CON QUÉ OBSERVACIONES (owner 2026-08-25) ==============
 *
 * POR QUÉ EXISTE. Cuando el usuario confirma su archivo, pasan dos cosas: el dato entra por `initTenant`, y queda
 * una OBSERVACIÓN abierta que él decidió asumir. Lo primero ya tenía casa (`tenantStore`); lo segundo vivía en un
 * global del navegador puesto de apuro. Un dato que gobierna lo que ADI dice no puede vivir ahí.
 *
 * ⚠️ ES UN SELLO, NO UNA ALARMA. Acá no se decide nada sobre el negocio: solo se guarda que el usuario vio unas
 * observaciones y eligió seguir. Quién lo menciona y cuándo lo decide `selloEnRespuesta.js` — y ese reparto
 * importa, porque si el estado supiera redactar, habría dos redacciones del mismo hallazgo.
 *
 * SE LIMPIA AL VOLVER AL DEMO. Un sello que sobreviviera al cambio de dato haría que ADI hablara de una
 * observación sobre un archivo que ya no está activo, que es peor que no avisar.
 *
 * MISMA FORMA QUE `tenantStore`: módulo con estado y suscriptores. Vive en el mismo proceso que la pantalla y
 * que el camino natural, así que los dos leen lo mismo sin pasarlo de mano en mano.
 */

let _sello = null;      // el sello de la lectura, o null si corre el demo / no hubo observaciones
let _archivo = null;    // { nombre, empresa } · solo para poder nombrarlo en pantalla
const _avisos = [];

/** getSelloDeCarga() → el sello activo, o null. Null es la respuesta normal: el demo no tiene observaciones. */
export const getSelloDeCarga = () => _sello;

/** getArchivoActivo() → { nombre, empresa } del archivo que el usuario activó, o null si corre el demo. */
export const getArchivoActivo = () => _archivo;

/** idDeCargaActiva() → la identidad de la carga con la que se está leyendo, o null (el demo).
 *  DIARIO ETAPA 2: la tesis guardada lleva esta identidad — una tesis medida contra OTRA carga se re-mide y
 *  se dice, jamás se afirma. Una sola función para escribir y para comparar: dos derivaciones divergirían. */
export const idDeCargaActiva = () => {
  const a = _archivo;
  if (!a || typeof a !== "object") return null;
  return String(a.hash || a.sha || `${a.nombre || "?"}@${a.fechaCarga || a.fecha || "?"}`);
};

/** onCargaChange(fn) → se avisa cuando cambia el archivo activo. Mismo patrón que `onTenantChange`. */
export const onCargaChange = (fn) => { _avisos.push(fn); };

/** setCargaActiva(sello, archivo) → el usuario confirmó y activó su archivo. */
export function setCargaActiva(sello, archivo) {
  _sello = sello && typeof sello === "object" ? sello : null;
  _archivo = archivo && typeof archivo === "object" ? archivo : null;
  for (const fn of _avisos) fn({ sello: _sello, archivo: _archivo });
}

/** limpiarCarga() → se volvió al demo: no hay archivo del usuario ni observación que arrastrar. */
export function limpiarCarga() {
  _sello = null; _archivo = null;
  for (const fn of _avisos) fn({ sello: null, archivo: null });
}
