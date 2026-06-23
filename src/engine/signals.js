/* === signals.js ===
 * MOTOR PURO extraído de 41cc33d8 · misma entrada → misma salida · sin React.
 * Funciones copiadas verbatim; solo se agregan imports. Cero cambio de cálculo. */
import { EXECUTIVE_REFRAMES, INTERNAL_DRIVER_RULES } from "../config/signalRules.js";

export function classifySeverity(gap, recoverableK) {
  const gapAbs = Math.abs(gap || 0);
  const rec = recoverableK || 0;
  if (gapAbs >= 5 || rec >= 500) return "critica";
  if (gapAbs >= 1.5 || rec >= 100) return "atencion";
  return "seguir";
}

export function buildReframe(driver) {
  if (!driver || !driver.mechanism) return null;
  return EXECUTIVE_REFRAMES[driver.mechanism] || null;
}

export function detectInternalDriver(entity, metricKey, entityType, scope) {
  if (!entity || !metricKey || !entityType) return null;
  const ruleKey = entityType + "." + metricKey;
  const rule = INTERNAL_DRIVER_RULES[ruleKey];
  if (!rule || typeof rule.detect !== "function") return null;
  try {
    return rule.detect(entity, scope);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("BRIEF M detectInternalDriver error:", err);
    return null;
  }
}

export function calculateRecoverable(entity, metricKey, entityType, driver, scope) {
  if (!entity || !metricKey || !entityType || !driver) return 0;
  const rule = INTERNAL_DRIVER_RULES[entityType + "." + metricKey];
  if (!rule || typeof rule.calculateRecoverable !== "function") return 0;
  try {
    return rule.calculateRecoverable(entity, driver, scope);
  } catch (err) {
    return 0;
  }
}

export function buildSuggestedAction(entity, metricKey, entityType, scope, recoverable) {
  if (!entity || !metricKey || !entityType) return null;
  const rule = INTERNAL_DRIVER_RULES[entityType + "." + metricKey];
  if (!rule || typeof rule.suggestedAction !== "function") return null;
  try {
    return rule.suggestedAction(entity, scope, recoverable);
  } catch (err) {
    return null;
  }
}
