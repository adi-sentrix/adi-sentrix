/* === src/adi/llm/voiceGuard.js · ADI Core · GUARD DE VOZ (determinístico) ===
 * La narración LLM (#2) debe entrar DIRECTO al negocio (controller/CFO senior): "Falabella cede margen por carga alta…",
 * no "Estuve revisando los números de Falabella y…". gpt-4o-mini no obedece el prompt de forma consistente (whack-a-mole
 * por conjugación · owner 2026-07-06). Este guard es el BACKSTOP determinístico: mata aperturas de PLANTILLA y muletillas
 * conectoras SIN tocar cifras (corre DESPUÉS del number-guard, sobre el texto ya validado). Puro string → testeable
 * (_voice_gate). NO toca el motor ni el seam · vive en la capa UI de narración (_narrateResult). Idempotente.
 */

const _cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Familia "revisé/analicé/miré <OBJETO-DE-DATOS> (de X)? y (encontré) que…" ROBUSTA a conjugación. El ancla SEGURA es el
// OBJETO-DE-DATOS (los números / los datos / la información / las cifras…) JUSTO tras el verbo → el contenido real jamás
// abre así (sólo la muletilla de informe). Consume hasta el hallazgo (deja "hay un par de cosas…"/"tres áreas…") y, si
// sigue un verbo de hallazgo + "que", lo consume. No toca cifras.
const _REVIEW_VERB = String.raw`(?:revis\p{L}+|analiz\p{L}+|analic\p{L}+|mir\p{L}+|examin\p{L}+|repas\p{L}+|estudi\p{L}+|evalu\p{L}+)`;
const _DATA_OBJ = String.raw`(?:(?:tus|los|las|mis|sus)\s+(?:datos|n[uú]meros|cifras)|la\s+(?:informaci[oó]n|data|situaci[oó]n|cartera)|el\s+(?:detalle|negocio|panorama)|tu\s+(?:cartera|negocio|informaci[oó]n|data))`;
const _FOUND_VERB = String.raw`(?:encontr\p{L}+|detect\p{L}+|not\p{L}+|identific\p{L}+|hall\p{L}+|vist\p{L}+|observ\p{L}+|cuent\p{L}+|ve\p{L}*)`;
const REVIEW_PREAMBLE = new RegExp(
  String.raw`^\s*(?:tras\s+|luego\s+de\s+|despu[eé]s\s+de\s+)?(?:he\s+|hemos\s+|estuve\s+|estoy\s+|estuvimos\s+)?(?:estado\s+)?` +
  _REVIEW_VERB + String.raw`\s+` + _DATA_OBJ +
  String.raw`(?:\s+de\s+\p{L}+(?:\s+\p{L}+)?)?\s*[,.:]?\s*(?:y\s+)?(?:(?:he\s+|te\s+|hemos\s+)?` + _FOUND_VERB + String.raw`\s*(?:que\s+)?)?`,
  "iu",
);
// Aperturas de PLANTILLA al inicio del mensaje → se borran; la frase real arranca y se capitaliza. Una sola vez.
const OPENERS = [
  REVIEW_PREAMBLE,
  /^\s*las\s+proyecciones\s+(?:indican|muestran|sugieren|reflejan|se[ñn]alan)\s+que\s+/iu,
  /^\s*(?:estos\s+datos|los\s+datos|las\s+cifras|los\s+n[uú]meros|estas\s+cifras)\s+(?:indican|muestran|sugieren|reflejan|se[ñn]alan)\s+que\s+/iu,
  /^\s*seg[uú]n\s+(?:los\s+datos|el\s+an[aá]lisis|la\s+informaci[oó]n|las\s+cifras)\s*[,]?\s*/iu,
];

// Muletillas CONECTORAS a inicio de frase (arranque o tras . ; : ! ?) → se borran, la palabra siguiente se capitaliza.
// Incluye "estos/los datos indican que" (informe) y fillers ("Claramente,"). OJO: "es importante NOTAR que" (muletilla),
// NO "es importante que <acción>" (recomendación real).
const CONNECTOR = /(^|[.;:!?]\s+)(?:sin\s+embargo|no\s+obstante|dicho\s+esto|claramente|obviamente|evidentemente|en\s+resumen|en\s+conclusi[oó]n|es\s+importante\s+(?:notar|destacar|mencionar)\s+que|cabe\s+(?:destacar|notar|mencionar)\s+que|(?:estos\s+datos|los\s+datos|las\s+cifras|los\s+n[uú]meros)\s+(?:indican|muestran|sugieren|reflejan|se[ñn]alan)\s+que)\s*[,]?\s+(\p{L})/giu;

// stripRoboticVoice(text) → sin apertura de plantilla ni muletillas conectoras. Idempotente · number-safe.
export function stripRoboticVoice(text) {
  if (typeof text !== "string" || !text.trim()) return text;
  let s = text;
  for (const re of OPENERS) {
    if (re.test(s)) {
      const stripped = _cap(s.replace(re, "").replace(/^\s+/, ""));
      if (stripped.trim()) s = stripped;   // seguridad: nunca dejar vacío
      break;
    }
  }
  // muletillas conectoras · loop hasta estable (atrapa encadenadas: "Claramente, estos datos indican que…")
  for (let i = 0; i < 4; i++) {
    const prev = s;
    s = s.replace(CONNECTOR, (_m, pre, ch) => pre + ch.toUpperCase());
    if (s === prev) break;
  }
  return s;
}
