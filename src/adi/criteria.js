/* === src/adi/criteria.js · MEMORIA DE CRITERIO (V5 apply_criteria · Frente C.2 · owner 2026-07-07) ===
 * ADI recuerda las METAS Y BENCHMARKS PROPIOS del owner ("mi margen mínimo es 28%, no el estándar") entre sesiones.
 * Decisiones del owner (2026-07-07): V1 = solo metas/benchmarks · entra EXPLÍCITO ("recordá que…") + ADI PROPONE cuando
 * detecta un criterio (nunca guarda solo) · persiste en localStorage del navegador · control por panel + chat.
 *
 * UNA VERDAD: aplicar un criterio muta el punto único (POLICY / benchmarkOf override) → TODAS las lecturas, palancas,
 * diagnósticos y paneles usan la vara del owner sin recalcular nada acá. Sin criterio → defaults byte-exactos (gates).
 * Headless-safe: sin localStorage no persiste pero no crashea. */
import { POLICY, setBenchmarkOverride } from "../config/businessPolicy.js";

// ── registro DATA-DRIVEN de criterios soportados (sumar uno = sumar una entrada) ──────────────────────────────────────
export const CRITERIA = {
  margen_minimo:    { label: "Margen mínimo",             unit: "pct",  policyKey: "benchmark",  min: 5,   max: 60,  fmt: (v) => `${v}%`,
    re: /(margen\s+m[ií]nimo|piso\s+de(l)?\s+margen|benchmark\s+de(l)?\s+margen|margen\s+objetivo|meta\s+de\s+margen)/i },
  target_carga:     { label: "Target de carga comercial", unit: "pct",  policyKey: "targetCarga", min: 0.5, max: 15, fmt: (v) => `${v}%`,
    re: /((target|meta|tope|techo)\s+de\s+(la\s+)?carga|carga\s+(comercial\s+)?(m[aá]xima|objetivo))/i },
  rotacion_minima:  { label: "Rotación mínima",           unit: "ratio", policyKey: "rotacionMin", min: 0.5, max: 12, fmt: (v) => `${v}x`,
    re: /(rotaci[oó]n\s+m[ií]nima|piso\s+de\s+rotaci[oó]n|meta\s+de\s+rotaci[oó]n)/i },
  cobertura_maxima: { label: "Cobertura máxima (DOH)",    unit: "days", policyKey: "dohMax",     min: 30,  max: 365, fmt: (v) => `${Math.round(v)} días`,
    re: /((cobertura|doh)\s+m[aá]xim[oa]|techo\s+de\s+(cobertura|doh)|m[aá]ximo\s+de\s+d[ií]as\s+de\s+stock)/i },
};
const _DEFAULTS = { benchmark: POLICY.benchmark, targetCarga: POLICY.targetCarga, rotacionMin: POLICY.rotacionMin, dohMax: POLICY.dohMax };   // capturados al boot (para "olvidá")

// ── persistencia (localStorage · guarded para headless/gates) ────────────────────────────────────────────────────────
const _LS_KEY = "adi_criteria_v1";
const _hasLS = () => { try { return typeof localStorage !== "undefined" && !!localStorage; } catch { return false; } };
export function loadCriteria() { if (!_hasLS()) return {}; try { return JSON.parse(localStorage.getItem(_LS_KEY) || "{}") || {}; } catch { return {}; } }
function _persist(c) { if (_hasLS()) try { localStorage.setItem(_LS_KEY, JSON.stringify(c)); } catch {} }

// ── aplicar / olvidar · MUTA el punto único de verdad (POLICY + override de benchmark) ──────────────────────────────
let _active = {};   // { key: value } vigente en runtime (espejo de lo persistido)
function _applyToPolicy(key, value) {
  const c = CRITERIA[key]; if (!c) return;
  POLICY[c.policyKey] = value;
  if (c.policyKey === "benchmark") setBenchmarkOverride(value);   // pisa también el benchmark embebido por-fila
}
function _restoreDefault(key) {
  const c = CRITERIA[key]; if (!c) return;
  POLICY[c.policyKey] = _DEFAULTS[c.policyKey];
  if (c.policyKey === "benchmark") setBenchmarkOverride(null);
}
export function setCriterion(key, value) {
  const c = CRITERIA[key];
  if (!c) return { ok: false, reason: "desconocido" };
  if (typeof value !== "number" || !isFinite(value) || value < c.min || value > c.max)
    return { ok: false, reason: "rango", min: c.min, max: c.max };
  const prev = _active[key] != null ? _active[key] : _DEFAULTS[c.policyKey];
  _active = { ..._active, [key]: value };
  _applyToPolicy(key, value);
  _persist(_active);
  return { ok: true, prev, value };
}
export function forgetCriterion(key) {
  if (key === "todo") { for (const k of Object.keys(_active)) _restoreDefault(k); _active = {}; _persist(_active); return { ok: true, all: true }; }
  if (_active[key] == null) return { ok: false, reason: "no-guardado" };
  const { [key]: _gone, ...rest } = _active;
  _active = rest;
  _restoreDefault(key);
  _persist(_active);
  return { ok: true };
}
export function activeCriteria() {
  return Object.entries(_active).map(([k, v]) => ({ key: k, label: CRITERIA[k].label, value: v, valueFmt: CRITERIA[k].fmt(v), standard: CRITERIA[k].fmt(_DEFAULTS[CRITERIA[k].policyKey]) }));
}
// boot (llamar UNA vez desde la app en el navegador): re-aplica lo persistido
export function initCriteria() {
  const saved = loadCriteria();
  for (const [k, v] of Object.entries(saved)) { if (CRITERIA[k] && typeof v === "number") { _active[k] = v; _applyToPolicy(k, v); } }
  return activeCriteria();
}

// ── detección de intención (pura · el coerce la corre ANTES de toda la cadena) ──────────────────────────────────────
const _num = (t) => { const m = String(t).replace(",", ".").match(/(\d+(?:\.\d+)?)\s*%?/); return m ? parseFloat(m[1]) : null; };
function _keyOf(t) { for (const [k, c] of Object.entries(CRITERIA)) if (c.re.test(t)) return k; return null; }
// detectCriteriaIntent(q) → { action: "set"|"propose"|"recall"|"forget", key?, value? } | null
export function detectCriteriaIntent(q) {
  const t = String(q || "");
  // RECALL · "¿qué recordás?" / "¿qué sabés de mi negocio?" / "mis criterios"
  if (/qu[eé]\s+(record[aá]s|ten[eé]s\s+guardado|sab[eé]s\s+(de\s+)?(mi|del)\s+negocio)|criterios?\s+(m[ií]os|guardados|ten[eé]s)|lo\s+que\s+sab[eé]s\s+de\s+m[ií]/i.test(t)) return { action: "recall" };
  // FORGET · "olvidá el margen mínimo" / "olvidá todo" / "volvé al estándar"
  if (/olvid[aá]|borr[aá]\w*\s+(el|la|los|mis)|volv[eé]\w*\s+al\s+est[aá]ndar/i.test(t)) {
    if (/\btodo\b|\btodos\b|est[aá]ndar/i.test(t) && !_keyOf(t)) return { action: "forget", key: "todo" };
    const k = _keyOf(t);
    return k ? { action: "forget", key: k } : { action: "recall" };   // "olvidá" sin criterio claro → mostrar qué hay
  }
  const key = _keyOf(t), value = key ? _num(t) : null;
  if (!key || value == null) return null;
  // SET explícito · "recordá que mi margen mínimo es 28%"
  if (/record[aá]\w*\s+que|guard[aá]\w*\s+(que|esto)|anot[aá]\w*\s+que|fijate?\s+que\s+de\s+ahora/i.test(t)) return { action: "set", key, value };
  // PROPONER · lo dijo como criterio propio pero sin pedir guardarlo ("para mí el margen mínimo es 28") → ADI pregunta.
  // OJO: sin \b después de "mí" (la í acentuada no es word-char en JS sin flag u → el boundary fallaba silencioso).
  if (/(\bmi\b|\bmis\b|\bnuestr[oa]\b|para\s+m[ií]|ac[aá]\s+el\b)/i.test(t) && /\b(es|son|de)\s+\d|\bal?\s+\d/.test(t)) return { action: "propose", key, value };
  return null;
}
