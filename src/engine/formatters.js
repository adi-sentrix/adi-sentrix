/* === formatters.js ===
 * MOTOR PURO extraído de 41cc33d8 · misma entrada → misma salida · sin React.
 * Funciones copiadas verbatim; solo se agregan imports. Cero cambio de cálculo. */
import { ADI_PANORAMA_CAPITAL_KPI_FIX_ENABLED } from "../config/voiceFlags.js";

export function _fmtMoneyK(valueK) {
  if (valueK == null || isNaN(valueK)) return "$0K";
  const abs = Math.abs(valueK);
  if (abs >= 1000) return `$${(valueK / 1000).toFixed(2)}M`;
  if (abs >= 100)  return `$${Math.round(valueK)}K`;
  return `$${Math.round(valueK)}K`;
}

export function _familyFmtMoney(v) {
  // Espeja el render del dashboard: "$" + valor.toLocaleString() + "K".
  return "$" + (v).toLocaleString() + "K";
}

export function _familyFmtPct(v) {
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}

export function _capEscalaK(capitalUSD) {
  if (typeof ADI_PANORAMA_CAPITAL_KPI_FIX_ENABLED !== "undefined" && ADI_PANORAMA_CAPITAL_KPI_FIX_ENABLED) {
    return (typeof capitalUSD === "number") ? capitalUSD / 1000 : capitalUSD;
  }
  return capitalUSD;
}
