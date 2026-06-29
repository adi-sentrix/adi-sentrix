/* === adi/sentrix/boleta.js · Etapa 5 · Sentrix S1 · boleta UNIFORME ===
 * Normaliza la evidencia de CUALQUIER ruta (comercial ranking_*, spine inv, etc.) a UN contrato uniforme
 * que el motor de Sentrix consume: entidad/entityType/métrica + el bloque availability (qué puede mostrar el
 * motor con ESTE dato y ESTA respuesta). Conserva lo que el composer ya trajo (spread), no recalcula nada. */
import { datasetCapability, entityExplorable } from "./capability.js";
import { ADI_SENTRIX_EXPLORE_ENABLED } from "../../config/voiceFlags.js";

export function buildSentrixBoleta(resp, intent, route, scenario) {
  const ev = (resp && resp.evidence) || {};

  // entidad / tipo / métrica · de la evidencia comercial (ranking_*), del spine, o del intent — lo primero que haya.
  const entidad =
    (Array.isArray(ev.ranking_entities) && ev.ranking_entities[0]) ||
    ev.entidad || (intent && (intent.clientName || intent.skuName || intent.brandName)) || null;
  const entityType =
    ev.ranking_entityType || ev.entityType || (intent && intent.entityType) || null;
  const metrica =
    ev.ranking_metric || ev.metrica || (intent && intent.metric) || null;

  // sin entidad NI métrica NI evidencia previa → no es una respuesta-resultado (saludo/fallback) → sin boleta.
  if (!entidad && !metrica && (!ev || Object.keys(ev).length === 0)) return null;

  const cap = datasetCapability();

  return {
    ...ev,                                                  // conserva ranking_*/query_plan/formula/… del composer
    entidad,
    entityType,
    metrica,
    dimension: ev.dimension || (intent && intent.dimension) || null,
    periodo: ev.periodo || scenario || null,
    fuente: ev.fuente || "ventas + costos",
    confianza: ev.confianza || (resp && resp.confidence) || "alta",
    // bloque AVAILABILITY · lo que el motor puede mostrar con este dato (data-driven · future-proof).
    availability: { history: cap.history, crosses: cap.crosses },
    // bloque EXPLORABLE · §7 · qué se puede explorar desde esta entidad (comparar/cambiar métrica) + bloqueos
    // honestos · data-driven · base de la mesa interactiva (paso 3) · gated · OFF = sin campo (byte-exacto).
    // El spine (bodega) no setea entidad/entityType a nivel boleta → fallback al foco de la lectura.
    ...(() => {
      if (!ADI_SENTRIX_EXPLORE_ENABLED) return {};
      const exType = entityType || (ev.reading && ev.reading.focusType) || null;
      const exEnt = entidad || (ev.reading && ev.reading.focus) || null;
      return exType && exEnt ? { explorable: entityExplorable(exType, exEnt) } : {};
    })(),
    _sentrix: true,
  };
}
