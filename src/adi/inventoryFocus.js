/* === src/adi/inventoryFocus.js · "la pregunta manda el foco" para INVENTARIO (owner 2026-07-06) ===
 * Detector PURO y determinístico: mapea el texto de una pregunta de inventario a la PUNTA que debe liderar la respuesta.
 * El motor (diagnoseInventario) computa las 4 puntas siempre; esto sólo elige CUÁL lidera — sin esto el composer respondía
 * siempre "capital frenado" aunque el usuario preguntara por reposición, exceso o SKU parados (media respuesta).
 *
 * Doble uso: (1) safety-net en el cliente (_coerceInventory de ChatADI · no depende de la clasificación variable del LLM),
 * (2) gate-testable (módulo puro, sin React ni seam). El LLM también puede setear `focus` en el spec; el coerce lo refuerza. */

// intención de INVENTARIO (amplia · dispara el foco) — capital/stock/reposición/quiebre/sobrestock/rotación/sin-venta
export const INV_INTENT_RE = /\b(capital|inmoviliz\w*|dormid\w*|congelad\w*|pegad\w*|inventario|stock|mercader[ií]a|bodeg\w*|reposici\w*|repon\w*|reabastec\w*|pedir|quiebr\w*|se\s+(me\s+)?(acab|agot)|agotar\w*|quedar?\s+en\s+cero|sobre[-\s]?stock|exceso|excedent\w*|sobrad\w*|cerros?\b|apila\w*|rotaci\w*|d[ií]as?\s+sin\s+vend\w*|sin\s+vend\w*|sin\s+rotar|no\s+se\s+mueve\w*|muerto\w*|polvo|botad\w*|estancad\w*|sin\s+movimiento|frenad\w*|parad\w*|liquid\w*|cobertura)\b/iu;
// simulación: VERBO + %-número, o % con signo · "baja disponibilidad"/"90 días" NO son simulación
const SIM_PCT_RE = /\b(sub\w*|baj\w*|aument\w*|increment\w*|reduc\w*|proyect\w*)\b[^?.!]*\d+\s*%|[+\-]\s?\d+\s?%/i;
// sub-focos (la pregunta manda cuál lidera)
const QUIEBRE_RE = /\b(reposici\w*|repon\w*|reabastec\w*|quiebr\w*|urgente|se\s+(me\s+)?(va\s+a\s+)?(agota|corta|acaba|acab)\w*|agotar\w*|por\s+agotar|a\s+punto\s+de\s+(quedar|acabar|agotar)|quedar?\s+(en\s+cero|sin\s+stock)|falta\w*\s+(de\s+)?stock|qued\w*\s+sin\s+stock|alta\s+demanda|sin\s+producto|pedir|mandar\s+la\s+orden|hay\s+que\s+(reponer|pedir))\b/iu;
const SOBRE_RE   = /\b(sobre[-\s]?stock|exceso|excedent\w*|sobra\w*|sobrad\w*|cerros?\b|apila\w*|demasiad\w*\s+(stock|mercader)|much[oa]\s+stock|m[aá]s\s+de\s+la\s+cuenta|de\s+sobra|pa\s+rato|cobertura\s+(alta|excesiv\w*|de\s+meses)|meses?\s+de\s+stock)\b/iu;
const STALE_RE   = /\b(sin\s+vend\w*|sin\s+rotar|d[ií]as?\s+sin|estancad\w*|no\s+(se\s+)?vend\w*|no\s+se\s+mueve\w*|muerto\w*|junta\w*\s+polvo|botad\w*|inactiv\w*|parad\w*|sin\s+movimiento)\b/iu;

// detectInventoryFocus(texto) → { isInventory, focus?, staleDays? }
//   focus ∈ frenado (default · capital inmovilizado) | quiebre (reposición) | sobrestock (exceso) | stale (sin rotar N días)
export function detectInventoryFocus(q) {
  const t = String(q || "");
  if (!INV_INTENT_RE.test(t)) return { isInventory: false };
  if (SIM_PCT_RE.test(t)) return { isInventory: false };   // simulación de nivel → no es lectura de inventario
  let focus = "frenado", staleDays = null;
  if (STALE_RE.test(t)) { focus = "stale"; const m = t.match(/(\d{1,4})\s*d[ií]as?/i); staleDays = m ? +m[1] : null; }
  else if (QUIEBRE_RE.test(t)) focus = "quiebre";
  else if (SOBRE_RE.test(t)) focus = "sobrestock";
  return { isInventory: true, focus, staleDays };
}
