/* === src/adi/overviewGate.js ===
 * Predicados del guard "module overview vs honest fallback" · extraídos de 41cc33d8 · verbatim.
 * El piso aplica el lead ETLG module_overview SOLO si la query es overview explícita
 * (_isExplicitModuleOverviewQuery) o palabra-módulo suelta (_isBareModuleWord). Si no → honest
 * fallback (sin lead). Funciones puras · sin deps. */

export function _isExplicitModuleOverviewQuery(text) {
  if (!text || typeof text !== "string") return false;
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const overviewPatterns = /\b(como\s+esta|que\s+pasa\s+en|resumen|panorama|vista\s+general)\b/i;
  return overviewPatterns.test(normalized);
}

// FIX #D-BARE-MODULE-WORD · detector ESTRICTO de palabra de módulo suelta (match EXACTO del texto completo).
export function _isBareModuleWord(text) {
  if (!text || typeof text !== "string") return false;
  const norm = text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")        // sin tildes
    .replace(/[¿?¡!.,;:]/g, "")             // sin puntuación
    .trim();
  const bareModulePatterns = [
    "inventario", "stock general", "stock",
    "ventas", "facturacion",
    "margenes", "margen general", "rentabilidad general", "mis margenes",
  ];
  return bareModulePatterns.includes(norm);  // match EXACTO del texto completo · NO substring
}
