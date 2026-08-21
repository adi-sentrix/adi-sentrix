/* === data/tenantClient.js · EL DATO LLEGA POR LA RED, NO POR EL BUNDLE (vía 1 · 2026-08-20) ====================
 *
 * El lado navegador del cambio: pide `/api/adi-data` y mete lo que venga por LA PUERTA (`initTenant`). Es el
 * reemplazo exacto de lo que antes hacía un `import` estático — misma función, misma forma de dato, mismos
 * rebuilds; lo único que cambia es de dónde viene.
 *
 * NO DECIDE NADA. No elige empresa, no cae a un default, no reintenta con otra. Manda su código de acceso (que
 * es lo que el usuario ya tiene guardado) y el servidor resuelve cuál es su empresa a partir de la firma. Si el
 * servidor dice que no, acá no hay plan B: la app se queda en la forma vacía y muestra la puerta de acceso.
 * Esa ausencia de plan B es la garantía — un fallback «por las dudas» sería servirle a alguien el dato de otra
 * empresa, que es justo lo que la vía 1 vino a cerrar.
 *
 * `tenantSolicitado` solo se manda en desarrollo y solo lo honra el servidor si tiene `ADI_DEV_TENANT_SWITCH=true`.
 * Desde el navegador no es una palanca: es una sugerencia que en producción se ignora.
 */
import { initTenant, tenantCargado } from "./tenantStore.js";
import { getAccessCode } from "../adi/accessClient.js";

/** Lo último que respondió el servidor — para que la UI (y un humano mirando la consola) sepa qué se sirvió y por qué. */
let _ultimo = { ok: false, tenantId: null, origen: null, motivo: "todavía no se pidió" };
export const estadoDelDato = () => ({ ..._ultimo, cargado: tenantCargado() });

/* cargarTenant({ tenantSolicitado }) → { ok, tenantId?, origen?, nombre?, motivo? }
 * Éxito ⇒ el dataset YA entró por initTenant y todos los rebuilds corrieron. */
export async function cargarTenant({ tenantSolicitado = null } = {}) {
  try {
    const res = await fetch("/api/adi-data", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ access: getAccessCode(), tenantSolicitado }),
    });
    const d = await res.json();
    if (!d || d.ok !== true || !d.dataset) {
      _ultimo = { ok: false, tenantId: null, origen: null, motivo: (d && d.motivo) || "el servidor no entregó dato" };
      return { ok: false, motivo: _ultimo.motivo };
    }
    initTenant(d.dataset);
    _ultimo = { ok: true, tenantId: d.tenantId, origen: d.origen, motivo: null };
    return { ok: true, tenantId: d.tenantId, origen: d.origen, nombre: d.nombre };
  } catch (e) {
    // red caída / servidor no disponible: se declara y NO se inventa un dataset.
    _ultimo = { ok: false, tenantId: null, origen: null, motivo: "no se pudo contactar al servidor" };
    return { ok: false, motivo: _ultimo.motivo };
  }
}
