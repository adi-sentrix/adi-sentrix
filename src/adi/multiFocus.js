/* === src/adi/multiFocus.js · MULTI-ANÁLISIS (V3 del roadmap · Frente C.1 · owner 2026-07-07) ===
 * Detector PURO de preguntas que cruzan DOS O MÁS lentes ("¿cómo está Lider en margen y rotación?" · "ventas y
 * contribución por cliente"). Hoy el ruteo elige UNA lente; esto detecta la enumeración explícita de métricas.
 *
 * CONSERVADOR a propósito: solo dispara con una ENUMERACIÓN de SUSTANTIVOS de métrica ("A y B"). Los cruces de un solo
 * foco que mencionan dos métricas NO son multi y tienen dueño: "los que más venden y peor margen" (alto_volumen ·
 * "venden" es verbo, no sustantivo) · "cuánta venta está bajo el margen mínimo" (pct de margen · bloqueado explícito).
 * En la duda, single-domain gana (mejor un foco correcto que un multi equivocado). */

// sustantivos de métrica → familia de lente (el orden importa: el match más largo primero)
const _FAMS = [
  ["contribucion", /contribuci[oó]n(es)?/i],
  ["rotacion", /rotaci[oó]n/i],
  ["margen", /m[aá]rgen(es)?|\bmargen\b|rentabilidad/i],
  ["ventas", /\bventas?\b|facturaci[oó]n/i],
  ["capital", /\bcapital\b|\bstock\b|\binventario\b|cobertura|\bdoh\b/i],
  ["carga", /carga\s+comercial|\bcargas?\b|rebates?/i],
];
const _NOUN = "(contribuci[oó]n(?:es)?|rotaci[oó]n|m[aá]rgen(?:es)?|margen|rentabilidad|ventas?|facturaci[oó]n|capital|stock|inventario|cobertura|doh|cargas?|rebates?)";
// enumeración: "A y B" / "A, B y C" con artículos opcionales entre medio
const _PAIR_RE = new RegExp(`\\b${_NOUN}\\b\\s*(?:,\\s*(?:la\\s+|el\\s+|su\\s+)?\\b${_NOUN}\\b\\s*)*(?:y|e)\\s+(?:la\\s+|el\\s+|su\\s+)?\\b${_NOUN}\\b`, "iu");
// cruces de UN solo foco que mencionan dos métricas → NO multi (tienen dueño en los detectores de dominio)
const _SINGLE_CROSS_RE = /bajo\s+(el\s+)?(margen|m[ií]nimo|benchmark)|peor\s+margen|mal\s+margen|poco\s+margen|bajo\s+margen|margen\s+m[ií]nimo|(vend|factur|compr)\w+\s+(mucho|harto|m[aá]s|caleta|un\s+mont[oó]n)|no\s+captur|sobre\s+la\s+mesa/i;
// simulación (verbo + % / % con signo) → la maneja el path de simulación, no el multi
const _SIM_RE = /\b(sub\w*|baj\w*|aument\w*|increment\w*|reduc\w*|proyect\w*)\b[^?.!]*\d+\s*%|[+\-]\s?\d+\s?%/i;

function _dim(t) {
  if (/\bsku\b|\bproducto/i.test(t)) return "sku";
  if (/famili/i.test(t)) return "familia";
  if (/\bmarca/i.test(t)) return "marca";
  if (/\bbodega/i.test(t)) return "bodega";
  return "cliente";
}
const _STOP = /^(de|del|d[oó]nde|qu[eé]|c[oó]mo|cu[aá]l|cu[aá]les|cu[aá]nt[oa]s?|y|e|el|la|los|las|su|mi|en|es|para|con|un|una|sku|doh)$/i;
function _entity(t) {
  const caps = String(t).match(/[A-ZÁÉÍÓÚ][\wáéíóúñ.\-]+(?:\s+[A-ZÁÉÍÓÚ][\wáéíóúñ.\-]+)?/g) || [];
  for (const w of caps) { const c = w.trim().replace(/[?.!,]+$/, ""); if (!_STOP.test(c)) return c; }
  return null;
}

// detectMultiAnalysis(texto) → { isMulti, metrics: [familias en orden de aparición], dimension, entity }
export function detectMultiAnalysis(q) {
  const t = String(q || "");
  const m = t.match(_PAIR_RE);
  if (!m) return { isMulti: false };
  if (_SINGLE_CROSS_RE.test(t) || _SIM_RE.test(t)) return { isMulti: false };   // cruce con dueño / simulación → single gana
  // familias DISTINTAS presentes en la enumeración capturada (no en todo el texto: evita falsos por menciones lejanas),
  // ORDENADAS POR APARICIÓN — la primera métrica que el usuario nombra es la lente PRIMARIA (su panel manda).
  const seg = m[0];
  const fams = [];
  for (const [fam, re] of _FAMS) { const hit = seg.search(re); if (hit >= 0 && !fams.some((f) => f[0] === fam)) fams.push([fam, hit]); }
  fams.sort((a, b) => a[1] - b[1]);
  if (fams.length < 2) return { isMulti: false };   // "ventas y facturación" = una sola familia → no es multi
  return { isMulti: true, metrics: fams.slice(0, 3).map((f) => f[0]), dimension: _dim(t), entity: _entity(t) };
}
