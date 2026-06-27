/* === adi/core/availabilityMap.js · ADI Core Fase 2.1a ===
 * Availability Map · generaliza el muro de inventario a un mapa DECLARATIVO.
 * "Disponible" = conectado + modelado + validable + consultable + trazable (def del NORTE).
 * Inventario está BLOQUEADO hasta Fase 2.5 (modelarlo lo vuelve disponible).
 * El muro existente (_esPreguntaInventarioChat en answerADI) queda intacto (coexistencia);
 * este mapa es el primer consumidor centralizado, usado por el spine. */
import { DOMAIN_REGISTRY } from "../../config/semantic/domainRegistry.js";
import { ADI_INV_ROTACION_ENABLED, ADI_INV_DOH_ENABLED } from "../../config/voiceFlags.js";   // Fase 2.5 · el flag ES la disponibilidad per-métrica

export const AVAILABILITY = {
  ventas:     { status: "available" },
  margenes:   { status: "available" },
  inventario: { status: "blocked", reason: "Fase 2.5", phase: "2.5", alternatives: ["ventas", "márgenes"] },
};

// ── Fase 2.5 · disponibilidad PER-MÉTRICA de inventario · manejada por el flag de cada métrica (el flag ES la
// disponibilidad). El muro se disuelve de a una: con todos los flags OFF, inventario sigue bloqueado byte-exacto.
// cobertura/doh comparten estado (≡ misma métrica · se modela en 2.5b); capital (stockUSD) entra en 2.5c.
const _INV_METRIC_AVAILABLE = {
  rotacion: () => ADI_INV_ROTACION_ENABLED,            // 2.5a
  doh:       () => ADI_INV_DOH_ENABLED,                // 2.5b · DOH/cobertura = una métrica, dos nombres → el mismo flag
  cobertura: () => ADI_INV_DOH_ENABLED,                // 2.5b · (cobertura es el key del QI_VOCAB · doh el del registro)
};

// isAvailable(domain) → nivel dominio (como hasta 2.2 · fallback byte-exacto).
// isAvailable(domain, metric) → si el dominio está bloqueado pero la métrica está modelada+encendida, true.
export function isAvailable(domain, metric) {
  const d = AVAILABILITY[domain];
  if (!d) return false;
  if (d.status === "available") return true;           // ventas/márgenes
  if (metric && domain === "inventario") {             // dominio bloqueado · consultar la métrica per-flag
    const fn = _INV_METRIC_AVAILABLE[metric];
    return !!(fn && fn());
  }
  return false;
}

// mensaje honesto único · coincide BYTE a BYTE con _inventarioAvisarMsg del muro (voz uniforme)
export function unavailableMessage(domain, { filterName } = {}) {
  const d = AVAILABILITY[domain] || {};
  const _label = (DOMAIN_REGISTRY[domain] && DOMAIN_REGISTRY[domain].label) || domain;
  const _filt = filterName ? ` Con el filtro de ${filterName} que mencionaste, igual te aviso en vez de darte un número que parezca firme.` : "";
  return `Eso vive en ${_label} y todavía no está habilitado en esta fase (${d.reason || "más adelante"}). No voy a responder con datos parciales o globales.${_filt} Lo que sí tengo hoy es ventas y márgenes.`;
}
