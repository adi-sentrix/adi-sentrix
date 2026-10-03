/* === src/adi/capacidad/aislamiento.js · EL TRAMO DEL CORE, SÍNCRONO Y SIN RESIDUO (Etapa 2, bloque 1 · D2) ═══════
 * EL HECHO. El Core del producto lee la empresa activa de UN estado global del proceso (`data/tenantStore.js`:
 * `initTenant(dataset)` lo fija, todo lo demás —catálogo, rankings, la Entrega— lo lee de ahí). Las acciones de
 * la capacidad hacían `initTenant(...)` y, sin esperar nada, calculaban: como JavaScript no se interrumpe entre
 * dos líneas sin `await`, ese tramo era atómico por accidente. Con el almacén asíncrono (la base), cualquier
 * `await` entre `initTenant` y el cálculo cede el turno: otra llamada, de OTRA empresa, entra, hace su
 * `initTenant`, y cuando la primera retoma calcula SOBRE LOS DATOS DE LA OTRA — cifras de una empresa en la Entrega
 * de la otra, sin un solo error. Es exactamente el defecto que el frente de identidad (`adi-identity-data-boundary`)
 * salió a eliminar, vuelto a abrir por un `await`.
 *
 * LA REGLA (la que cumplen las cuatro acciones de `acciones.js`):
 *     leer de la base  →  ENTRAR AL TRAMO (initTenant + Core, SÍNCRONO, sin await adentro)  →  salir  →  escribir
 * Este helper es ese tramo, y lo hace CUMPLIBLE EN VEZ DE RECOMENDABLE:
 *   1. el tramo es una función SÍNCRONA: si devuelve una promesa (alguien le puso un `await` adentro), se lanza
 *      — nunca queda una empresa activa a medias esperando a la base;
 *   2. al salir, se comprueba que la empresa activa SIGUE siendo la que entró (si otro código la cambió en el
 *      medio, el resultado no se entrega);
 *   3. al salir SIEMPRE se RESTAURA lo que había antes (el `finally`): una acción no deja a la empresa A «activa»
 *      para el próximo que mire el Core. Cualquier lectura del Core FUERA de un tramo ve lo que había antes (en el
 *      servidor de la puerta, el estado vacío) — falla visible, no una empresa ajena.
 * Un candado funcional (`_guardado_durable_gate.mjs`) lo prueba con carnadas: el orden viejo mezcla empresas y este
 * helper no. */
import { initTenant, getTenantData } from "../../data/tenantStore.js";

/** conTenantActivo(dataset, tramo) → lo que devuelva `tramo()` · `tramo` es SÍNCRONO. */
export function conTenantActivo(dataset, tramo) {
  if (!dataset || typeof dataset !== "object") throw new Error("conTenantActivo: falta el dataset de la empresa");
  if (typeof tramo !== "function") throw new Error("conTenantActivo: el tramo tiene que ser una función");
  const previo = getTenantData();
  initTenant(dataset);
  try {
    const salida = tramo();
    if (salida && typeof salida.then === "function") {
      // la promesa se ignora a propósito: este tramo no tiene derecho a esperar nada con la empresa activa
      Promise.resolve(salida).catch(() => {});
      throw new Error("conTenantActivo: el tramo del Core es síncrono — un `await` adentro dejaría la empresa activa mientras otra llamada entra");
    }
    if (getTenantData() !== dataset) throw new Error("conTenantActivo: la empresa activa cambió durante el tramo — el resultado no es de la empresa que lo pidió");
    return salida;
  } finally {
    initTenant(previo);
  }
}
