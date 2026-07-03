/* === src/adi/llm/numberGuard.js · ADI Core · Paso 5 · NUMBER-GUARD ===
 * La narración (LLM #2) SOLO puede usar cifras que ADI YA emitió. Este guard compara los números de la narración
 * contra los AUTORIZADOS (los del output validado: texto determinístico + evidence). Falla si la narración:
 *   · ALTERA una cifra   · INVENTA una cifra   · OMITE una cifra OBLIGATORIA.
 * Al fallar, el llamador DEGRADA (usa el texto determinístico de ADI). El LLM NO calcula: cualquier número derivado
 * (no verbatim en el output) cuenta como no-autorizado → bloqueado. Puro · sin red · sin estado · NO toca el motor sellado.
 * Regla madre: el LLM narra, ADI decide la cifra. Este es el candado que lo garantiza.
 */

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
  return nums;
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
