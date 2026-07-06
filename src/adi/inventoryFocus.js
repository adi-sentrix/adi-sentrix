/* === src/adi/inventoryFocus.js · "la pregunta manda el foco" para INVENTARIO (owner 2026-07-06) ===
 * Detector PURO y determinístico: mapea el texto de una pregunta de inventario a la PUNTA que debe liderar la respuesta.
 * El motor (diagnoseInventario) computa las 4 puntas siempre; esto sólo elige CUÁL lidera — sin esto el composer respondía
 * siempre "capital frenado" aunque el usuario preguntara por reposición, exceso o SKU parados (media respuesta).
 *
 * Doble uso: (1) safety-net en el cliente (_coerceInventory de ChatADI · no depende de la clasificación variable del LLM),
 * (2) gate-testable (módulo puro, sin React ni seam). El LLM también puede setear `focus` en el spec; el coerce lo refuerza. */

// intención de INVENTARIO (amplia · dispara el foco) — capital/stock/reposición/quiebre/sobrestock/rotación/sin-venta
export const INV_INTENT_RE = /\b(capital|inmoviliz\w*|dormid\w*|inventario|stock|reposici\w*|repon\w*|reabastec\w*|quiebr\w*|sobre[-\s]?stock|exceso|excedent\w*|rotaci\w*|d[ií]as?\s+sin\s+vend\w*|sin\s+vend\w*|sin\s+rotar|estancad\w*|sin\s+movimiento)\b/iu;
// simulación de NIVEL (delta %) — "subí/bajá/aumentá el capital 10%" · NO es lectura de inventario → dejar simular.
// Requiere un NÚMERO junto al verbo (si no, "baja disponibilidad" / "baja rotación" caían como simulación por error).
const SIM_PCT_RE = /\b(sub[ei]\w*|baj[ae]\w*|aument\w*|increment\w*|reduc[íi]\w*|proyect\w*)\b.*\d|[+\-]\s?\d+\s?%|\d+\s?%/i;
// sub-focos (la pregunta manda cuál lidera)
const QUIEBRE_RE = /\b(reposici\w*|repon\w*|reabastec\w*|quiebr\w*|urgente|se\s+(agota|corta|acaba)\w*|falta\w*\s+(de\s+)?stock|qued\w*\s+sin\s+stock|alta\s+demanda|sin\s+producto)\b/iu;
const SOBRE_RE   = /\b(sobre[-\s]?stock|exceso|excedent\w*|sobra\w*|demasiad\w*\s+stock|much[oa]\s+stock|cobertura\s+(alta|excesiv\w*))\b/iu;
const STALE_RE   = /\b(sin\s+vend\w*|sin\s+rotar|d[ií]as?\s+sin|estancad\w*|no\s+(se\s+)?vend\w*|inactiv\w*|parad\w*|sin\s+movimiento)\b/iu;

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
