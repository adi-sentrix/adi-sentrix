/* === adi/core/availabilityMap.js · ADI Core Fase 2.1a ===
 * Availability Map · generaliza el muro de inventario a un mapa DECLARATIVO.
 * "Disponible" = conectado + modelado + validable + consultable + trazable (def del NORTE).
 * Inventario está BLOQUEADO hasta Fase 2.5 (modelarlo lo vuelve disponible).
 * El muro existente (_esPreguntaInventarioChat en answerADI) queda intacto (coexistencia);
 * este mapa es el primer consumidor centralizado, usado por el spine. */
import { DOMAIN_REGISTRY } from "../../config/semantic/domainRegistry.js";

export const AVAILABILITY = {
  ventas:     { status: "available" },
  margenes:   { status: "available" },
  inventario: { status: "blocked", reason: "Fase 2.5", phase: "2.5", alternatives: ["ventas", "márgenes"] },
};

export function isAvailable(domain) {
  const d = AVAILABILITY[domain];
  return !!d && d.status === "available";
}

// mensaje honesto único · coincide BYTE a BYTE con _inventarioAvisarMsg del muro (voz uniforme)
export function unavailableMessage(domain, { filterName } = {}) {
  const d = AVAILABILITY[domain] || {};
  const _label = (DOMAIN_REGISTRY[domain] && DOMAIN_REGISTRY[domain].label) || domain;
  const _filt = filterName ? ` Con el filtro de ${filterName} que mencionaste, igual te aviso en vez de darte un número que parezca firme.` : "";
  return `Eso vive en ${_label} y todavía no está habilitado en esta fase (${d.reason || "más adelante"}). No voy a responder con datos parciales o globales.${_filt} Lo que sí tengo hoy es ventas y márgenes.`;
}
