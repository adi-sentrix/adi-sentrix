/* === adi/intentLayer.js ===
 * ADI conversacional extraído de 41cc33d8 · verbatim · solo imports agregados.
 * Importa motor (engine/) + datos/config sellados. Cero cambio de cálculo. */
import { FEATURE_INTENT_LAYER, FEATURE_INTENT_LAYER_EARLY } from "../config/features.js";
import { SUCURSALES, SUPERFAMILIAS } from "../data/catalogs.js";
import { composeModuleOverview } from "./composers/overview.js";
import { composeBusinessThesisOpener } from "./composers/thesis.js";
import { detectBrandInText, detectClientInText, detectSkuInText } from "./detectors.js";
import { filterTextualSuggestions, normalizeText } from "./helpers.js";

export function resolveIntentLayerEarly(text, scenario, context) {
  if (!FEATURE_INTENT_LAYER_EARLY || !text || typeof text !== "string") return null;
  const norm = normalizeText(text);

  // ── CONDICIÓN 4 · SIN OPERACIÓN ──
  // (a) endurecimiento crítico: toda operación avanzada lleva un número → DEFIERE
  //     (growth "si crece 10%", price "subo 5%", inversa "$2M" la dueñan). Los overviews no llevan dígitos.
  if (/\d/.test(norm)) return null;
  // (b) átomos de acción (vs/comparar/aportar/ranking/cuanto vender/proyecta/...) → DEFIERE.
  if (INTENT_SPECIFIC_ACTION_ATOMS.some(a => norm.indexOf(a.trim()) >= 0)) return null;

  // ── CONDICIÓN 3 · SIN ENTIDAD nombrada → DEFIERE (dive/comparación/inversa la dueñan) ──
  if ((typeof detectClientInText === "function" && detectClientInText(text)) ||
      (typeof detectBrandInText === "function" && detectBrandInText(text)) ||
      (typeof detectSkuInText === "function" && detectSkuInText(text))) return null;
  for (const fam of SUPERFAMILIAS.slice(1)) { if (norm.indexOf(normalizeText(fam)) >= 0) return null; }
  for (const suc of SUCURSALES) { if (norm.indexOf(normalizeText(suc)) >= 0) return null; }

  // ── CONDICIÓN 2 · VERBO/PREGUNTA VAGA (overview atom) REQUERIDO ──
  const overviewHit = INTENT_OVERVIEW_ATOMS.find(a => norm.indexOf(a) >= 0);
  if (!overviewHit) return null;

  // ── CONDICIÓN 1 · MÓDULO CLARO (átomo de módulo o métrica explícito) ──
  let module = null, route_reason = ["early"];
  for (const mod in INTENT_MODULE_ATOMS) {
    const hit = INTENT_MODULE_ATOMS[mod].find(l => _intentHasToken(norm, l));
    if (hit) { module = mod; route_reason.push("modulo:" + hit); break; }
  }
  let metric = null;
  for (const met in INTENT_METRIC_ATOMS) {
    const hit = INTENT_METRIC_ATOMS[met].find(l => _intentHasToken(norm, l));
    if (hit) { metric = met; route_reason.push("metrica:" + hit); break; }
  }
  if (!module) {
    if (metric) {
      module = (metric === "margen" || metric === "contribucion") ? "margenes"
             : (metric === "stock" || metric === "doh" || metric === "rotacion") ? "inventario"
             : (metric === "precio") ? "precio" : "ventas";
      route_reason.push("modulo<-metrica");
    } else {
      // módulo NO explícito · el early gate es quirúrgico → DEFIERE (la capa tardía v1 / ambigüedad lo maneja).
      return null;
    }
  }
  route_reason.push("accion:" + overviewHit);

  // Las 4 condiciones se cumplen → overview (regla de oro · entity=cartera). NUNCA calcula.
  const intent = { module, action: "overview", entity_type: "cartera", entity_name: null,
    metric: metric || null, confidence: 0.95, route_reason };
  const _res = _routeIntentToComposer(intent, scenario);
  // ADI Core · 2.2a-2 parte B · expone el MÓDULO resuelto (metadata interna · invisible al texto y al
  // contexto de salida) para que el muro del early-gate (answerADI) cace el "stock" elíptico por semántica.
  if (_res) _res._module = module;
  return _res;
}

export function resolveIntentLayer(text, scenario, context) {
  if (!FEATURE_INTENT_LAYER || !text || typeof text !== "string") return null;
  const norm = normalizeText(text);

  // 1 · Entidad específica nombrada → DEFIERE (rutas selladas la dueñan · §3/§12).
  if ((typeof detectClientInText === "function" && detectClientInText(text)) ||
      (typeof detectBrandInText === "function" && detectBrandInText(text)) ||
      (typeof detectSkuInText === "function" && detectSkuInText(text))) return null;
  for (const fam of SUPERFAMILIAS.slice(1)) { if (norm.indexOf(normalizeText(fam)) >= 0) return null; }
  for (const suc of SUCURSALES) { if (norm.indexOf(normalizeText(suc)) >= 0) return null; }

  // 2 · Acción específica (ranking/comparación/proyección/inversa/explicación/detalle) → DEFIERE.
  if (INTENT_SPECIFIC_ACTION_ATOMS.some(a => norm.indexOf(a.trim()) >= 0)) return null;

  // 3 · Detectar módulo y métrica por átomos (token/lema · no frase).
  let module = null, route_reason = [];
  for (const mod in INTENT_MODULE_ATOMS) {
    const hit = INTENT_MODULE_ATOMS[mod].find(l => _intentHasToken(norm, l));
    if (hit) { module = mod; route_reason.push("modulo:" + hit); break; }
  }
  let metric = null;
  for (const met in INTENT_METRIC_ATOMS) {
    const hit = INTENT_METRIC_ATOMS[met].find(l => _intentHasToken(norm, l));
    if (hit) { metric = met; route_reason.push("metrica:" + hit); break; }
  }
  const overviewHit = INTENT_OVERVIEW_ATOMS.find(a => norm.indexOf(a) >= 0);
  if (overviewHit) route_reason.push("accion:" + overviewHit);

  // 4 · Sin módulo NI métrica NI acción reconocida → fallback real (§10). La capa no reconoció nada.
  if (!module && !metric && !overviewHit) return null;

  // 5 · Ambigüedad de módulo (§8): sin módulo nombrado → métrica→su módulo, o módulo activo, o negocio.
  if (!module) {
    if (metric) {
      module = (metric === "margen" || metric === "contribucion") ? "margenes"
             : (metric === "stock" || metric === "doh" || metric === "rotacion") ? "inventario"
             : (metric === "precio") ? "precio" : "ventas";
      route_reason.push("modulo<-metrica");
    } else {
      const activo = (context && context.lastPanoramaDomain) ? context.lastPanoramaDomain : null;
      module = activo || "negocio";
      route_reason.push(activo ? "modulo<-activo" : "modulo<-negocio");
    }
  }

  // 6 · Regla de oro (§6): módulo claro + acción vaga = overview · entity null → cartera.
  const intent = { module, action: "overview", entity_type: "cartera", entity_name: null,
    metric: metric || null, confidence: overviewHit ? 0.92 : 0.8, route_reason };

  // 7 · Rutear a composer SELLADO (§7). NUNCA calcula.
  return _routeIntentToComposer(intent, scenario);
}

export function _routeIntentToComposer(intent, scenario) {
  const _confLine = "\n\nConfianza determinística: alta.";
  const _wrap = (res) => {
    if (!res) return null;
    if (typeof res === "string") return { opener: res + _confLine, suggestions: [], sentrixAction: null };
    return { opener: (res.opener || "") + _confLine,
      suggestions: res.suggestions || [], sentrixAction: res.sentrixAction || null };
  };
  const mod = intent.module;
  // overview ventas/margen/inventario → composeModuleOverview (sellado)
  if (mod === "ventas" || mod === "margenes" || mod === "inventario") {
    return _wrap(composeModuleOverview(scenario, mod));
  }
  // contribución vive en el módulo margenes (clientesMargen carga venta+contribución+margen)
  if (mod === "contribucion") {
    return _wrap(composeModuleOverview(scenario, "margenes"));
  }
  // negocio general → tesis de negocio (sellado); si no hay tesis → declaración honesta, NO inventa
  if (mod === "negocio") {
    const thesis = (typeof composeBusinessThesisOpener === "function") ? composeBusinessThesisOpener(scenario) : null;
    if (thesis) return _wrap(thesis);
    return { opener: "El panorama del negocio se arma sobre tres módulos: ventas, margen e inventario. Decime cuál querés y te doy la vista completa." + _confLine,
      suggestions: (typeof filterTextualSuggestions === "function" ? filterTextualSuggestions(["Las ventas", "El margen", "El inventario"]) : ["Las ventas", "El margen", "El inventario"]),
      sentrixAction: null };
  }
  // precio: NO hay panorama de precio (es palanca sobre una entidad · §7 declara, no fabrica)
  if (mod === "precio") {
    return { opener: "El precio en ADI se analiza como palanca sobre una entidad puntual, no como panorama general. Puedo darte el panorama de ventas, margen o inventario, o el efecto de un cambio de precio sobre un cliente, familia o SKU." + _confLine,
      suggestions: (typeof filterTextualSuggestions === "function" ? filterTextualSuggestions(["El margen", "Las ventas"]) : ["El margen", "Las ventas"]),
      sentrixAction: null };
  }
  return null;   // módulo no ruteable → fallback real
}

export function _intentHasToken(norm, lema) {
  if (!lema) return false;
  if (lema.indexOf(" ") >= 0) return norm.indexOf(lema) >= 0;
  return new RegExp("(^|[^a-z0-9])" + lema + "([^a-z0-9]|$)").test(norm);
}

export const INTENT_MODULE_ATOMS = {
  ventas:       ["venta", "ventas", "vender", "facturacion", "facturo", "comercial"],
  margenes:     ["margen", "margenes", "rentabilidad", "rentable"],
  contribucion: ["contribucion", "contribuciones", "aporte", "aportes"],
  inventario:   ["inventario", "stock", "bodega", "bodegas", "almacen", "almacenes"],
  precio:       ["precio", "precios"],
  negocio:      ["negocio", "empresa", "compania", "panorama"],
};

export const INTENT_METRIC_ATOMS = {
  venta:        ["venta", "ventas", "facturacion"],
  margen:       ["margen", "rentabilidad"],
  contribucion: ["contribucion", "aporte"],
  stock:        ["stock"],
  doh:          ["doh", "cobertura"],
  rotacion:     ["rotacion"],
  precio:       ["precio", "precios"],
};

export const INTENT_OVERVIEW_ATOMS = ["panorama", "resumen", "como esta", "como estan", "como va", "como van", "como viene", "como vienen", "que pasa con", "que tal", "como vamos", "como anda", "vista general", "dame"];

export const INTENT_SPECIFIC_ACTION_ATOMS = ["compara", "comparar", "versus", " vs ", "contra", "ranking", "top ", "mejores", "peores", "peor", "mejor", "proyecta", "proyeccion", "cuanto vender", "cuanto debe vender", "para aportar", "para llegar", "por que", "porque", "explica", "detalle", "desglose", "cual es el", "cual es la"];
