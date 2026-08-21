/* === adi/helpers.js ===
 * ADI conversacional extraído de 41cc33d8 · verbatim · solo imports agregados.
 * Importa motor (engine/) + datos/config sellados. Cero cambio de cálculo. */
import { VOICE_REMOVE_TEXTUAL_SUGGESTIONS_ENABLED } from "../config/voiceFlags.js";

export function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ── LAS CUENTAS QUE SE NOMBRAN COMO EJEMPLO (2026-08-21) ────────────────────────────────────────────────────
 * Varios composers ofrecían «Cuéntame de Falabella / Lider / Jumbo» con los nombres escritos a mano: las tres
 * cuentas más grandes DEL DEMO, clavadas en código de producto. Con el archivo de un cliente real, ADI habría
 * ofrecido cuentas que ese negocio no tiene — y encima justo cuando la respuesta es «no encontré esa cuenta»,
 * que es el peor momento posible para nombrar otras tres que tampoco existen.
 * Acá se le piden al dato. Sirve para filas de margen (`venta`) y de ventas (`actual`): mismo criterio, tamaño. */
export function cuentasMasGrandes(dataset, n = 3) {
  return (Array.isArray(dataset) ? [...dataset] : [])
    .filter((c) => c && c.nombre)
    .sort((a, b) => (b.venta ?? b.actual ?? 0) - (a.venta ?? a.actual ?? 0))
    .slice(0, n)
    .map((c) => c.nombre);
}

export function filterTextualSuggestions(suggestions) {
  // Guard defensivo · si la entrada no es array, retornar intacto.
  if (!Array.isArray(suggestions)) return suggestions;
  // Flag rollback · si OFF, preservar array original bitwise.
  if (!VOICE_REMOVE_TEXTUAL_SUGGESTIONS_ENABLED) return suggestions;
  // Filtro: preservar SOLO objects con action.type (cognitive actions Tipo B).
  return suggestions.filter(s =>
    typeof s === "object"
    && s !== null
    && typeof s.action === "object"
    && s.action !== null
    && typeof s.action.type === "string"
  );
}

export function buildResponseContract({
  opener,
  suggestions = [],
  sentrixAction = null,
  decision = null,
  evidence = null,
  focus = null,
  confidence = "alta",
  materialMetrics = [],
  reasoningPattern = null,
  suggestedNextActions = [],
  clientList = null,              // 🆕 AN+.FIX2-5 · habilita ring poblamiento AN+
}) {
  return {
    opener,
    suggestions,
    sentrixAction,
    decision,
    evidence,
    focus,
    confidence,
    materialMetrics,
    reasoningPattern,
    suggestedNextActions,
    clientList,                     // 🆕 AN+.FIX2-5
    responseObjectVersion: "v1",
  };
}
