/* === src/adi/coerceChain.js · CADENA DE COERCE determinística "la pregunta manda el foco" (owner 2026-07-06) ===
 * SAFETY NET del ruteo: no depende de la clasificación variable del LLM #1. Dado el spec del LLM y el texto, fuerza el
 * dominio+foco correcto (o lo deja pasar). Extraído de ChatADI para ser PURO y gate-testable de punta a punta (_routing_gate).
 *
 * ORDEN (más específico → más general): compare → contribución → margen → ventas → inventario → explain.
 *   · compare corre primero (verbo explícito manda) pero "contra <plan/tiempo>" NO es compare de entidades → lo toma ventas.
 *   · contribución 2º: su palabra "contribución" es la más específica (que "venta"/"margen" no la roben).
 *   · ventas cede el dominio inventario (INV_INTENT dentro de detectVentasFocus) → Q stock/quiebre van a inventario.
 *   · cada coerce respeta un dominio ya reclamado (guards por spec.operation). */
import { detectContribucionFocus } from "./contribucionFocus.js";
import { detectMarginFocus } from "./marginFocus.js";
import { detectVentasFocus } from "./ventasFocus.js";
import { detectInventoryFocus } from "./inventoryFocus.js";
import { detectMultiAnalysis } from "./multiFocus.js";
import { detectCriteriaIntent } from "./criteria.js";
import { ENTITIES } from "../config/contract/entityRegistry.js";

// SANEO de filters (safety-net): el LLM #1 a veces emite claves-ruido ("filters:{margen:'mínimo'}") que NO son ejes del
// contrato → el seam degradaba con "no reconozco el filtro" una pregunta YA bien ruteada. Al coercer a un dominio, solo
// sobreviven los filtros por ejes REALES (cliente/marca/familia/bodega/sku); el ruido se descarta, la respuesta responde.
function _cleanFilters(s) {
  if (!s || !s.filters) return s;
  const f = {};
  for (const k of Object.keys(s.filters)) if (ENTITIES[k] && s.filters[k] != null) f[k] = s.filters[k];
  return { ...s, filters: Object.keys(f).length ? f : undefined };
}

// COMPARE · verbo explícito de comparación o "contra X". "contra <plan/tiempo>" se desvía a ventas (ver abajo).
const _CMP_INTENT_RE = /\b(compar[aá]\w*|compár\w*|comparemos|versus|vs\.?)\b|\bcontra\s+\p{L}/iu;
// "contra/vs/versus/con <plan/tiempo>" (presupuesto/año/plan/mes/mismo período/hace un año…) NO es comparación de entidades
// → es ventas (vs plan/YoY). El TARGET es plan/tiempo (no una entidad), así que aplica incluso con "compará" ("compará la
// venta con el año pasado" = YoY). Los conectores/fillers (el/la/del/de/hace/un/mismo) pueden intercalarse antes del sustantivo.
const _CMP_PLAN_RE = /\b(contra|vs\.?|versus|con)\s+(?:(?:el|la|los|las|lo|del|de|hace|un[ao]?|mismo)\s+)*(per[ií]odo|presupuesto|ppto|a[ñn]o|plan\b|meta|objetivo|mes\b|benchmark)/i;
function _coerceCompare(q, spec) {
  if (!q || !spec || !_CMP_INTENT_RE.test(q)) return spec;
  // "contra/vs/con el presupuesto/año/plan" NO es comparación de entidades → la maneja ventas. Además LIMPIA un compare que
  // el LLM ya haya elegido (si no, "vs el año pasado" pide "¿comparar contra qué SKU?" en vez de responder el YoY).
  if (_CMP_PLAN_RE.test(q)) return spec.operation === "compare" ? { ...spec, operation: "overview", comparison: undefined } : spec;
  const s = { ...spec, operation: "compare", turn_type: "followup_compare" };
  const ents = (s.comparison && Array.isArray(s.comparison.entities)) ? s.comparison.entities.filter(Boolean) : [];
  if (!ents.length) {
    const m = q.match(/\b(?:con|contra|versus|vs\.?)\s+(.+?)\s*[?.!¡¿]*$/i);
    const t = m && m[1] && m[1].trim();
    s.comparison = { ...(s.comparison || {}), entities: t ? [t] : [] };
  }
  return s;
}

// CONTRIBUCIÓN · corre PRIMERO (su palabra es la más específica) para que "venta"/"margen" en la pregunta no la roben.
function _coerceContribucion(q, spec) {
  if (!q || !spec || spec.operation === "compare") return spec;
  const c = detectContribucionFocus(q);
  if (!c.isContrib) return spec;
  const s = { ...spec, operation: "contribucion", metric: "contribucion", dimension: c.dimension || "cliente",
    turn_type: spec.turn_type === "followup_compare" ? "new_query" : (spec.turn_type || "new_query") };
  if (c.focus) s.focus = c.focus;
  if (c.entity) s.entity = c.entity;
  if (s.transform) delete s.transform;
  return _cleanFilters(s);
}

// MARGEN · rompe la trampa "todo→diagnose genérico" con el sub-foco. No toca dives/compares de entidad puntual.
function _coerceMargin(q, spec) {
  if (!q || !spec || spec.operation === "compare" || spec.operation === "dive" || spec.operation === "contribucion" || spec.entity) return spec;
  const m = detectMarginFocus(q);
  if (!m.isMargin) return spec;
  const s = { ...spec, operation: "margin", metric: "margen", dimension: m.dimension || "cliente",
    turn_type: spec.turn_type === "followup_compare" ? "new_query" : (spec.turn_type || "new_query") };
  if (m.focus) s.focus = m.focus;
  if (m.gap) s.gap = m.gap;
  if (m.negativo) s.negativo = true;
  if (m.pct) s.pct = true;
  if (s.transform) delete s.transform;
  return _cleanFilters(s);
}

// VENTAS · fallback general de lo comercial (vs ppto/YoY/descomposición/mix). Cede el dominio inventario (dentro del detector).
function _coerceVentas(q, spec) {
  if (!q || !spec || spec.operation === "compare" || spec.operation === "dive" || spec.operation === "margin" || spec.operation === "contribucion" || spec.entity) return spec;
  const v = detectVentasFocus(q);
  if (!v.isVentas) return spec;
  const s = { ...spec, operation: "ventas", metric: "ventas", dimension: v.dimension || "cliente",
    turn_type: spec.turn_type === "followup_compare" ? "new_query" : (spec.turn_type || "new_query") };
  if (v.focus) s.focus = v.focus;
  if (v.gap) s.gap = v.gap;
  if (v.pivotFocus) s.pivotFocus = v.pivotFocus;
  if (s.transform) delete s.transform;
  return _cleanFilters(s);
}

// INVENTARIO · capital/quiebre/sobrestock/stale. Corre último de los dominios (ventas ya le cedió lo suyo).
function _coerceInventory(q, spec) {
  if (!q || !spec || spec.operation === "compare" || spec.operation === "margin" || spec.operation === "ventas" || spec.operation === "contribucion") return spec;
  const inv = detectInventoryFocus(q);
  if (!inv.isInventory) return spec;
  const dim = (spec.dimension === "sku" || spec.dimension === "familia" || spec.dimension === "bodega") ? spec.dimension : "bodega";
  const s = { ...spec, operation: "inventory", metric: "capital", dimension: dim, focus: inv.focus,
    turn_type: spec.turn_type === "followup_compare" ? "new_query" : (spec.turn_type || "new_query") };
  if (inv.staleDays != null) s.staleDays = inv.staleDays;
  if (s.transform && s.transform.unit !== "pct") delete s.transform;
  return _cleanFilters(s);
}

// CONTINUIDAD del "por qué": un "por qué" genérico (o sobre el foco de inventario) sigue el ÚLTIMO foco vía composeExplain.
const _BARE_WHY_RE = /^\s*(?:dime\s+|explic[aá]\w*(?:me)?\s+)?(?:el\s+)?por\s?qu[eé](?:\s+(?:ocurre|pasa|sucede|es\s+(?:eso|as[ií])|raz[oó]n|la\s+raz[oó]n))?\s*[?.!¡¿]*$/i;
const _WHY_CAPITAL_RE = /por\s?qu[eé].*(capital|dormid\w*|inmoviliz\w*|no\s+rot\w*|frenad\w*)/i;
function _coerceExplain(q, spec, hasLast) {
  if (!hasLast || !q || !spec) return spec;
  if (_BARE_WHY_RE.test(q) || _WHY_CAPITAL_RE.test(q)) return { ...spec, turn_type: "followup_explain" };
  return spec;
}

// CONTINUIDAD DE ALCANCE (owner 2026-07-06 · "la mesa viva"): un follow-up DEÍCTICO ("y de esos, ¿cuáles…?") referencia el
// conjunto que ADI acaba de nombrar. Acá sólo se DETECTA (puro/testeable); answerConversational hereda el set real
// (last.entityList) como entityScope y el composer filtra por nombre. Referenciales de Chile/es: "de esos/esas/ellos",
// "esos mismos", "de ese grupo/lista", "de los que me mostraste", "de esos que…". NO dispara con genéricos ("de los clientes").
const _DEICTIC_RE = /\b(?:de\s+(?:[eé]sos|[eé]sas|ellos|ellas|[eé]stos|[eé]stas)\b|entre\s+(?:[eé]sos|[eé]sas|ellos|ellas)\b|(?:[eé]sos|[eé]sas)\s+mismos?\b|de\s+(?:ese|esa)\s+(?:grupo|lista|listado|conjunto|selecci[oó]n)|de\s+(?:esa|esas)\s+cuentas?\b|de\s+(?:los|las)\s+(?:mismos|mismas|anteriores)\b|de\s+(?:los|las)\s+que\s+(?:me\s+)?(?:mostr\w*|dij\w*|nombr\w*|sali\w*|apareci\w*|list\w*)|de\s+(?:esos|esas)\s+que\b)/iu;

// MULTI-ANÁLISIS (V3 · Frente C.1): "¿cómo está Lider en margen y rotación?" cruza DOS lentes → turn_type multi_analysis
// (lo resuelve composeMulti reusando los composers vía el seam). CORTA la cadena: si no, el primer coerce de dominio que
// matchee una de las dos métricas se la roba. Corre DESPUÉS de compare (un "compará A y B" es de entidades, no de métricas).
function _coerceMulti(q, spec) {
  if (!q || !spec || spec.operation === "compare") return null;
  const m = detectMultiAnalysis(q);
  if (!m.isMulti) return null;
  const s = { ...spec, turn_type: "multi_analysis", multi: { metrics: m.metrics, dimension: m.dimension, entity: m.entity } };
  if (s.transform) delete s.transform;
  return _cleanFilters(s);
}

// ACEPTACIÓN ("sí" / "dale" / "hazlo" pelado · bug cazado por el owner 2026-07-07): tras una oferta de ADI ("¿te gustaría
// que profundizara?"), un "sí" debe EJECUTAR la oferta — no volver al LLM a adivinar (clasificaba turn_types como
// operations y el seam degradaba con vocabulario interno). Solo mensajes CORTOS que son pura afirmación.
const _AFFIRM_RE = /^\s*(s[ií]|dale|ok(ey)?|ya|bueno|claro|obvio|perfecto|de una|h[aá]z?lo|hacelo|adelante|me parece( bien)?|por ?favor|porfa|s[ií],?\s+(dale|claro|porfa|por ?favor|profundiz[aá]|hazlo|hacelo|adelante))[\s.!…]*$/i;

// coerceSpec(texto, spec del LLM, hayÚltimaEvidencia, señalesUI) → spec ruteado al dominio+foco correcto (o el original).
export function coerceSpec(q, spec, hasLast, ui = null) {
  // DEÍCTICO DE UI (owner 2026-07-08 · "compará estos dos" mirando la Mesa): la SELECCIÓN de la Mesa es el referente —
  // determinístico, sin que el LLM adivine. Solo con 2 seleccionados + intención de comparar + referencial plural.
  if (q && spec && ui && Array.isArray(ui.mesaSel) && ui.mesaSel.length === 2
      && /(compar|versus|\bvs\b|diferenc|enfrent)/i.test(q) && /\b(estos|esos|estas|esas)\s*(dos|2)?\b/i.test(q)) {
    const d = ui.mesaDim || "cliente";
    return { ...spec, operation: "compare", metric: spec.metric || "margen", dimension: d,
      comparison: { dimension: d, entities: [...ui.mesaSel] }, turn_type: "new_query" };
  }
  // MEMORIA DE CRITERIO (V5 · Frente C.2): "recordá que mi margen mínimo es 28%" / "¿qué recordás?" / "olvidá X" corre
  // PRIMERO y CORTA la cadena — si no, el coerce de margen roba "margen mínimo" y responde una lectura en vez de guardar.
  if (q && spec) {
    const ci = detectCriteriaIntent(q);
    if (ci) return { ...spec, turn_type: "apply_criteria", criteria: ci };
    if (hasLast && String(q).length <= 28 && _AFFIRM_RE.test(q)) return { ...spec, turn_type: "followup_accept" };
  }
  // RESUMEN DEL NEGOCIO (owner 2026-07-08): "dame un resumen del negocio / panorama general / cómo está mi negocio"
  // → el DIAGNÓSTICO ejecutivo (los focos con su $), no un ranking suelto. Determinístico, antes de los dominios.
  if (q && spec && /(resumen|panorama|foto|radiograf[ií]a)\s+(ejecutiv[oa]\s+)?(general\s+)?(de(l)?\s+)?(mi\s+|la\s+|el\s+)?(negocio|empresa|cartera|situaci[oó]n)|c[oó]mo\s+(est[aá]|va|viene)\s+(mi\s+|el\s+)?negocio/i.test(q))
    return _cleanFilters({ ...spec, operation: "diagnose", metric: spec.metric || "contribucion", dimension: "cliente", turn_type: "new_query" });
  const afterCompare = _coerceCompare(q, spec);
  const multi = _coerceMulti(q, afterCompare);
  if (multi) return multi;   // short-circuit: la enumeración de métricas manda (los coerces de dominio no la roban)
  const s = _coerceExplain(q, _coerceInventory(q, _coerceVentas(q, _coerceMargin(q, _coerceContribucion(q, afterCompare)))), hasLast);
  // marca el turno deíctico SÓLO si además ruteó a un dominio que sabe filtrar por nombre (margin/contribucion/ventas/inventory)
  if (hasLast && q && s && _DEICTIC_RE.test(q) && (s.operation === "margin" || s.operation === "contribucion" || s.operation === "ventas" || s.operation === "inventory"))
    return { ...s, _deictic: true };
  return s;
}
