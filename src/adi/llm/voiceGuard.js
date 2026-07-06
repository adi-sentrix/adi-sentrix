/* === src/adi/llm/voiceGuard.js · ADI Core · GUARD DE VOZ (determinístico) ===
 * La narración LLM (#2) debe sonar a controller / CFO senior: directa, ejecutiva, sin muletillas ni aperturas de
 * plantilla. gpt-4o-mini NO obedece el prompt de forma consistente (a veces abre con "He revisado tus datos…" o
 * "Las proyecciones indican que…", a veces no · owner 2026-07-06). Este guard es el BACKSTOP determinístico:
 * limpia aperturas robóticas y muletillas conectoras SIN tocar cifras. Corre DESPUÉS del number-guard, sobre el
 * texto ya validado → no puede alterar una cifra autorizada (no toca dígitos). Puro string → testeable (_voice_gate).
 * NO toca el motor ni el seam · vive en la capa UI de narración (_narrateResult). Idempotente.
 */

const _cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Aperturas de PLANTILLA al inicio del mensaje → se borran; la frase real arranca y se capitaliza. Una sola vez.
// Familia "revisé/analicé TUS DATOS y encontré…" ROBUSTA a conjugación (he/he estado/estuve/tras · revis*/analiz*/
// mir*/examin*/repas* · encontr*/detect*/cuent*…). El ancla SEGURA es "tus datos/la información/los datos" JUSTO tras
// el verbo → el contenido real jamás abre así (sólo la muletilla). Consume hasta el hallazgo (deja "algunos puntos…"/
// "tres áreas…") y, si sigue "que", lo consume (deja la cláusula). No toca cifras.
const REVIEW_PREAMBLE = /^\s*(?:tras\s+|luego\s+de\s+|despu[eé]s\s+de\s+)?(?:he\s+|hemos\s+|estuve\s+|estoy\s+|estuvimos\s+)?(?:estado\s+)?(?:revis\p{L}+|analiz\p{L}+|analic\p{L}+|mir\p{L}+|examin\p{L}+|repas\p{L}+)\s+(?:tus\s+datos|la\s+informaci[oó]n|los\s+datos|la\s+data|tu\s+(?:cartera|negocio|informaci[oó]n))\s*[,.:]?\s*(?:y\s+)?(?:he\s+|te\s+|hemos\s+)?(?:encontr\p{L}+|detect\p{L}+|not\p{L}+|identific\p{L}+|hall\p{L}+|vist\p{L}+|observ\p{L}+|cuent\p{L}+)?\s*(?:que\s+|lo\s+siguiente[:,]?\s*)?/iu;
const OPENERS = [
  REVIEW_PREAMBLE,
  /^\s*las\s+proyecciones\s+(?:indican|muestran|sugieren|reflejan|se[ñn]alan)\s+que\s+/i,
  /^\s*(?:los\s+datos|las\s+cifras|los\s+n[uú]meros)\s+(?:indican|muestran|sugieren|reflejan|se[ñn]alan)\s+que\s+/i,
  /^\s*seg[uú]n\s+(?:los\s+datos|el\s+an[aá]lisis|la\s+informaci[oó]n|las\s+cifras)\s*[,]?\s*/i,
];

// Muletillas CONECTORAS al inicio de frase (arranque o tras . ; : ! ?) → se borran, la palabra siguiente se capitaliza.
// OJO: "es importante NOTAR/destacar que" (observación · muletilla) — NO "es importante que <acción>" (recomendación real).
const CONNECTOR = /(^|[.;:!?]\s+)(?:sin\s+embargo|no\s+obstante|dicho\s+esto|es\s+importante\s+(?:notar|destacar|mencionar)\s+que|cabe\s+(?:destacar|notar|mencionar)\s+que)\s*[,]?\s+(\p{L})/giu;

// stripRoboticVoice(text) → text sin apertura de plantilla ni muletillas conectoras. Idempotente · number-safe.
export function stripRoboticVoice(text) {
  if (typeof text !== "string" || !text.trim()) return text;
  let s = text;
  // 1) apertura de plantilla (una sola vez, al inicio)
  for (const re of OPENERS) {
    if (re.test(s)) {
      const stripped = _cap(s.replace(re, "").replace(/^\s+/, ""));
      if (stripped.trim()) s = stripped;   // seguridad: nunca dejar vacío
      break;
    }
  }
  // 2) muletillas conectoras (todas)
  s = s.replace(CONNECTOR, (_m, pre, ch) => pre + ch.toUpperCase());
  return s;
}
