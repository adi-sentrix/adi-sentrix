/* === src/adi/llm/numberGuard.js · ADI Core · Paso 5 · NUMBER-GUARD ===
 * La narración (LLM #2) SOLO puede usar cifras que ADI YA emitió. Este guard compara los números de la narración
 * contra los AUTORIZADOS (los del output validado: texto determinístico + evidence). Falla si la narración:
 *   · ALTERA una cifra   · INVENTA una cifra   · OMITE una cifra OBLIGATORIA.
 * Al fallar, el llamador DEGRADA (usa el texto determinístico de ADI). El LLM NO calcula: cualquier número derivado
 * (no verbatim en el output) cuenta como no-autorizado → bloqueado. Puro · sin red · sin estado · NO toca el motor sellado.
 * Regla madre: el LLM narra, ADI decide la cifra. Este es el candado que lo garantiza.
 */
import { guardAgainstBoleta } from "../boleta.js";   // guard v2 · valida la narración contra la BOLETA (unit-aware · verbatim)

// tokens numéricos de un texto (con separadores · el % y $ se sacan al normalizar)
function _tokens(text) { return String(text == null ? "" : text).match(/\d[\d.,]*\d|\d/g) || []; }

// candidatos de valor normalizado de UN token · maneja miles/decimal ambiguos:
//   "4271"→{4271} · "4.271"→{4271,4.271} · "4,271"→{4271,4.271} · "34.0"→{34} · "34"→{34}
function _cands(tok) {
  const s = String(tok).replace(/[$%\s]/g, "");
  const c = new Set();
  if (!/^\d[\d.,]*\d$|^\d$/.test(s)) return c;
  // entero con agrupación de miles (solo '.' O solo ',' en grupos de 3)
  if (/^\d{1,3}([.]\d{3})+$/.test(s) || /^\d{1,3}([,]\d{3})+$/.test(s)) c.add(String(parseInt(s.replace(/[.,]/g, ""), 10)));
  // decimal con '.' (comas = miles, se quitan)
  { const d = s.replace(/,/g, ""); if (/^\d+(\.\d+)?$/.test(d)) c.add(String(parseFloat(d))); }
  // decimal con ',' — SOLO si hay coma (puntos = miles, se quitan · coma → punto)
  if (s.includes(",")) { const d = s.replace(/\./g, "").replace(",", "."); if (/^\d+(\.\d+)?$/.test(d)) c.add(String(parseFloat(d))); }
  return c;
}

const _match = (a, b) => { for (const x of a) if (b.has(x)) return true; return false; };

// recolecta números de un evidence (recursivo · números, strings, arrays, objetos)
function _evidenceNumbers(ev, acc) {
  if (ev == null) return acc;
  if (typeof ev === "number") { acc.push(String(ev)); return acc; }
  if (typeof ev === "string") { for (const t of _tokens(ev)) acc.push(t); return acc; }
  if (Array.isArray(ev)) { for (const x of ev) _evidenceNumbers(x, acc); return acc; }
  if (typeof ev === "object") { for (const k of Object.keys(ev)) _evidenceNumbers(ev[k], acc); return acc; }
  return acc;
}

// cifras OBLIGATORIAS: las estructuradas del evidence (ranking_values · mandatoryFigures explícito). Si no hay → ninguna.
function _mandatory(validated) {
  const ev = (validated && validated.evidence) || {};
  const nums = [];
  if (Array.isArray(ev.ranking_values)) for (const n of ev.ranking_values) nums.push(String(n));
  if (Array.isArray(ev.mandatoryFigures)) for (const n of ev.mandatoryFigures) nums.push(String(n));
  if (nums.length) return nums;
  // sin figuras estructuradas → TODAS las cifras del texto determinístico son obligatorias (no perder ninguna · seguro)
  return _tokens(validated && validated.text);
}

// numberGuard(narration, validated) → { ok, verdict, reason, unauthorized[], missing[] }
export function numberGuard(narration, validated) {
  const authTokens = [..._tokens(validated && validated.text), ..._evidenceNumbers(validated && validated.evidence, [])];
  const authCands = authTokens.map(_cands);
  const narrTokens = _tokens(narration);
  const narrCands = narrTokens.map(_cands);

  // Regla A · toda cifra de la narración debe estar AUTORIZADA (no alterada, no inventada, no derivada)
  const unauthorized = [];
  for (let i = 0; i < narrTokens.length; i++) {
    if (narrCands[i].size && !authCands.some((ac) => _match(narrCands[i], ac))) unauthorized.push(narrTokens[i]);
  }
  // Regla B · toda cifra OBLIGATORIA debe aparecer en la narración (no omitida)
  const missing = [];
  for (const m of _mandatory(validated)) {
    const mc = _cands(m);
    if (mc.size && !narrCands.some((nc) => _match(mc, nc))) missing.push(m);
  }

  const ok = unauthorized.length === 0 && missing.length === 0;
  const verdict = ok ? "fiel" : (unauthorized.length ? "cifra-no-autorizada" : "cifra-obligatoria-faltante");
  const reason = ok
    ? "la narración solo usa cifras de ADI y no omite obligatorias"
    : (unauthorized.length ? `cifra(s) no autorizada(s): ${unauthorized.join(", ")}` : `falta(n) cifra(s) obligatoria(s): ${missing.join(", ")}`);
  return { ok, verdict, reason, unauthorized, missing };
}

// DECISOR de la narración: devuelve la narración SOLO si pasa el guard; si no (o si vino vacía) → el texto
// determinístico de ADI. Es el punto único donde "si numberGuard falla, se descarta la narración".
// LENGUAJE PROHIBIDO en narración: producto = dato real + supuesto · NO hay escenarios. "escenario(s)" es corregible
// ("escenario"→"supuesto", case-preserving); los NOMBRES de escenario (Bonanza/Tensión/Crisis) NO son corregibles
// semánticamente → la narración se descarta y cae al texto determinístico (ya limpio por el seam).
function _scrubNarrationLang(s) {
  return String(s)
    .replace(/escenarios/g, "supuestos").replace(/Escenarios/g, "Supuestos")
    .replace(/escenario/g, "supuesto").replace(/Escenario/g, "Supuesto");
}
const _PROHIBITED = /\b(bonanza|tensi[oó]n|crisis)\b/i;

export function pickNarratedText(validated, narration) {
  const det = (validated && validated.text) || "";
  if (!narration || typeof narration !== "string" || !narration.trim())
    return { text: det, narrated: false, verdict: "sin-narración", reason: "narración vacía" };
  let narr = narration;
  // LENGUAJE PROHIBIDO (scoped a simulaciones · evidence.transform): corregí "escenario"→"supuesto"; si quedan
  // nombres de escenario (Bonanza/Tensión/Crisis) → descartá la narración (cae al determinístico). Owner 2026-07-06.
  if (validated && validated.evidence && validated.evidence.transform) {
    narr = _scrubNarrationLang(narr);
    if (_PROHIBITED.test(narr))
      return { text: det, narrated: false, verdict: "lenguaje-prohibido", reason: "narración con lenguaje de escenario" };
  }
  // GUARD v2 · ÚNICO punto que usa la BOLETA: si el output la trae → validamos CONTRA ella (unit-aware · verbatim ·
  // obligatorias · atrapa drift de escala y ratio garbleado). Si no → guard v1 (dígitos de texto+evidence). El _guardWrap
  // del closer sigue en v1 (valida el texto EJECUTIVO de ADI, no la narración) → gates struct/guard intactos.
  const _bol = validated && validated.evidence && validated.evidence.boleta;
  let g;
  if (Array.isArray(_bol) && _bol.length) {
    const r = guardAgainstBoleta(narr, _bol);
    g = { ...r, verdict: r.ok ? "fiel" : (r.unauthorized.length ? "cifra-no-autorizada" : "cifra-obligatoria-faltante") };
  } else {
    g = numberGuard(narr, validated);
  }
  return g.ok
    ? { text: narr, narrated: true, verdict: "fiel", reason: g.reason }
    : { text: det, narrated: false, verdict: g.verdict, reason: g.reason };
}
