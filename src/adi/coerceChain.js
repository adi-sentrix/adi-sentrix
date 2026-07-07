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
  return s;
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
  return s;
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
  return s;
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
  return s;
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

// coerceSpec(texto, spec del LLM, hayÚltimaEvidencia) → spec ruteado al dominio+foco correcto (o el spec original).
export function coerceSpec(q, spec, hasLast) {
  const s = _coerceExplain(q, _coerceInventory(q, _coerceVentas(q, _coerceMargin(q, _coerceContribucion(q, _coerceCompare(q, spec))))), hasLast);
  // marca el turno deíctico SÓLO si además ruteó a un dominio que sabe filtrar por nombre (margin/contribucion/ventas/inventory)
  if (hasLast && q && s && _DEICTIC_RE.test(q) && (s.operation === "margin" || s.operation === "contribucion" || s.operation === "ventas" || s.operation === "inventory"))
    return { ...s, _deictic: true };
  return s;
}
