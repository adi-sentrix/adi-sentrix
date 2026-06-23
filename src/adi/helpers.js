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
