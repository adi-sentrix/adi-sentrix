/* === adi/sentrix/boleta.js · Etapa 5 · Sentrix S1 · boleta UNIFORME ===
 * Normaliza la evidencia de CUALQUIER ruta (comercial ranking_*, spine inv, etc.) a UN contrato uniforme
 * que el motor de Sentrix consume: entidad/entityType/métrica + el bloque availability (qué puede mostrar el
 * motor con ESTE dato y ESTA respuesta). Conserva lo que el composer ya trajo (spread), no recalcula nada. */
import { datasetCapability, entityExplorable } from "./capability.js";
import { ADI_SENTRIX_EXPLORE_ENABLED } from "../../config/voiceFlags.js";

// RUTEO DE LENTE · ADI elige qué lente abre Sentrix leyendo la INTENCIÓN de la pregunta (mismo dato, distinta
// intención). "probame / la cuenta / de dónde sale" → Evidencia (el recibo) · "qué hago / comparar / recuperar /
// palanca" → Control (la mesa) · el resto → Diagnóstico (la historia · el default). El panel VALIDA que la lente
// tenga contenido para el foco. LLM-ready: v2 setea evidence.lens directo (esto es la versión determinística).
function _lensFor(route, query) {
  const q = (query || "").toLowerCase();
  // PANORÁMICO ("todos/todas · el ranking · top N · los mejores/peores · la cartera · el cuadro") → Cuadro de mando
  if (/todos (mis|los|las)|todas (mis|las)|toda (mi|la) cartera|el ranking|\btop\s*\d|los (\d+ )?(mejores|peores)|las (\d+ )?(mejores|peores)|panorama|cuadro de mando|todo el (negocio|panorama)|la grilla|la tabla (general|de todos)/.test(q)) return "cuadro";
  if (/prob[aá]me|prueb|de d[oó]nde (sale|viene)|la cuenta|c[oó]mo se calcula|desglos|descompon|justific|f[oó]rmula|no te creo/.test(q)) return "evidencia";
  if (/qu[eé] hago|qu[eé] hacer|acci[oó]n|compar|contra el (promedio|resto)|recuper|cu[aá]nto (gano|puedo|recupero|vale)|palanca|camino|qu[eé] toco/.test(q)) return "control";
  if (/simulation/.test(route || "") || route === "qi_retrieval") return "control";
  return "diagnostico";
}

export function buildSentrixBoleta(resp, intent, route, scenario, ctx) {
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
    lens: ev.lens || _lensFor(route, ctx && ctx.__query),  // qué lente abre Sentrix (ruteo por intención · el panel la valida)
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
