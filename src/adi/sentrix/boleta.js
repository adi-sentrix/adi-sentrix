/* === adi/sentrix/boleta.js · Etapa 5 · Sentrix S1 · boleta UNIFORME ===
 * Normaliza la evidencia de CUALQUIER ruta (comercial ranking_*, spine inv, etc.) a UN contrato uniforme
 * que el motor de Sentrix consume: entidad/entityType/métrica + el bloque availability (qué puede mostrar el
 * motor con ESTE dato y ESTA respuesta). Conserva lo que el composer ya trajo (spread), no recalcula nada. */
import { datasetCapability, entityExplorable } from "./capability.js";
import { ADI_SENTRIX_EXPLORE_ENABLED, ADI_CUADRO_OVERVIEW_ENABLED } from "../../config/voiceFlags.js";

// B2 · ENUM CANÓNICO de eje · UN token por eje para que el LLM lea/emita sin dialectos por-ruta (hoy la boleta recibía
// 'client' del ranking vs 'cliente' del qi vs 'sucursal' del spine capital). Canónico = English (lo que ya usan
// reading.focusType + capability.entityExplorable + los packs del panel). Los English pasan igual; Spanish/sucursal se mapean.
const _CANON = { cliente: "client", clientes: "client", sku: "sku", skus: "sku", producto: "sku", productos: "sku", marca: "marca", marcas: "marca", bodega: "bodega", bodegas: "bodega", sucursal: "bodega", sucursales: "bodega" };
const _canonType = (t) => { const k = t && String(t).toLowerCase(); return (k && _CANON[k]) || t || null; };

// RUTEO DE LENTE · ADI elige qué lente abre Sentrix leyendo la INTENCIÓN de la pregunta (mismo dato, distinta
// intención). "probame / la cuenta / de dónde sale" → Evidencia (el recibo) · "qué hago / comparar / recuperar /
// palanca" → Control (la mesa) · el resto → Diagnóstico (la historia · el default). El panel VALIDA que la lente
// tenga contenido para el foco. LLM-ready: v2 setea evidence.lens directo (esto es la versión determinística).
function _lensFor(route, query) {
  const q = (query || "").toLowerCase();
  // PANORÁMICO ("todos/todas · el ranking · top N · los mejores/peores · la cartera · el cuadro") → Cuadro de mando
  if (/todos (mis|los|las)|todas (mis|las)|toda (mi|la) cartera|el ranking|\btop\s*\d|los (\d+ )?(mejores|peores)|las (\d+ )?(mejores|peores)|panorama|cuadro de mando|todo el (negocio|panorama)|la grilla|la tabla (general|de todos)|\b(ventas|margen|margenes|contribuci[oó]n|rotaci[oó]n|capital|unidades|stock|cobertura|doh)\s+por\s+(cliente|clientes|sku|skus|producto|productos|marca|marcas|bodega|bodegas|sucursal|sucursales)\b/.test(q)) return "cuadro";
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

  // OVERVIEW PANORÁMICO → Cuadro · "ventas/margen/rotación POR cliente/sku/..." (retrieval de DIMENSIÓN · sin foco
  // único). El motor ya trae dimensión+métrica en _qiContext (qi_retrieval) o query_plan (spine); armamos una boleta
  // cuadro SIN reading → el botón "Ver en el Cuadro de mando" + CuadroOnlyPanel abren la grilla en esa dimensión.
  // Solo si NO hay foco único Y el ruteo por intención dice cuadro. Gated · flag OFF = no dispara (byte-exacto).
  if (ADI_CUADRO_OVERVIEW_ENABLED && !entidad && _lensFor(route, ctx && ctx.__query) === "cuadro") {
    const qi = (resp && resp._qiContext) || null;
    const qp = ev.query_plan || null;
    const dim = ev.dimension || (qi && qi.dimension) || (qp && qp.dimension) || null;
    const met = metrica || (qi && qi.metric) || (qp && qp.metrica) || null;
    if (dim) {
      const capO = datasetCapability();
      return {
        ...ev,
        entidad: null,
        entityType: _canonType(dim),   // enum canónico (client/sku/marca/bodega) · CuadroOnlyPanel lo mapea a la dimensión del grid
        metrica: met,
        dimension: _canonType(dim),
        periodo: ev.periodo || scenario || null,
        lens: "cuadro",
        fuente: ev.fuente || "ventas + costos",
        confianza: ev.confianza || (resp && resp.confidence) || "alta",
        availability: { history: capO.history, crosses: capO.crosses },
        _sentrix: true,
      };
    }
  }

  // sin entidad NI métrica NI evidencia previa → no es una respuesta-resultado (saludo/fallback) → sin boleta.
  if (!entidad && !metrica && (!ev || Object.keys(ev).length === 0)) return null;

  const cap = datasetCapability();

  return {
    ...ev,                                                  // conserva ranking_*/query_plan/formula/… del composer
    entidad,
    entityType: _canonType(entityType),                    // B2 · enum canónico de eje (client/sku/marca/bodega)
    metrica,
    dimension: _canonType(ev.dimension || (intent && intent.dimension) || null),
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
      const exType = _canonType(entityType || (ev.reading && ev.reading.focusType) || null);
      const exEnt = entidad || (ev.reading && ev.reading.focus) || null;
      return exType && exEnt ? { explorable: entityExplorable(exType, exEnt) } : {};
    })(),
    _sentrix: true,
  };
}
