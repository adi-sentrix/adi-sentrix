/* === src/adi/boleta.js · ADI Core · BOLETA DE CIFRAS AUTORIZADAS ===
 * La "boleta" es el CONTRATO de cifras que ADI le pasa al LLM #2: la narración premium puede escribir libre,
 * pero SOLO puede usar los `value` de la boleta, verbatim. La arma el COMPOSER (primera clase, misma verdad que
 * el texto determinístico), NO se deriva raspando números. El number-guard valida la narración CONTRA la boleta.
 * Regla madre: ADI calcula y valida; el LLM entiende y narra.
 *
 * Figura de boleta:
 *   { label, value, unit, raw, mandatory, source, formula, context, canon }
 *   · label     semántico ("Falabella · contribución no capturada")
 *   · value     formateado VERBATIM ("$1.6M") — idéntico a lo que muestra el texto (una sola verdad)
 *   · unit      "money" | "pct" | "ratio" | "days" | "count"
 *   · raw       numérico crudo (referencia/auditoría)
 *   · mandatory la narración DEBE citarla (si falta → bloqueo)
 *   · source    "actual" | "computed"   ← RESERVADO para simulaciones (Fase futura)
 *   · formula   string | null           ← RESERVADO: fórmula auditable ("actual $4.27M × 1.03")
 *   · context   escenario o pregunta ("simulate ventas@cliente +3%")
 *   · canon     clave canónica "unit:value" para el match unit-aware del guard (interna)
 */

// formateador canónico · MISMA escala que specRetrieval._money (money en $ CRUDOS)
const _moneyC = (v) => { const a = Math.abs(v); if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (a >= 1e3) return `$${Math.round(v / 1e3)}K`; return `$${Math.round(v)}`; };
const _fmtC = (raw, unit) =>
  unit === "money" ? _moneyC(raw) :
  unit === "pct"   ? `${raw}%` :
  unit === "ratio" ? `${(+raw).toFixed(1)}x` :
  unit === "days"  ? `${Math.round(raw)}d` :
  String(raw);

// fig(label, value, opts) → figura de boleta normalizada. `value` es el string YA formateado por el composer.
export function fig(label, value, { unit = "money", raw = null, mandatory = false, source = "actual", formula = null, context = null } = {}) {
  return { label, value: String(value), unit, raw, mandatory, source, formula, context, canon: `${unit}:${String(value).replace(/\s/g, "")}` };
}

// parseFigures(text) → [{ unit, raw, text, canon }] · extrae las figuras de la narración CON su unidad (unit-aware).
// Cada figura se re-formatea a su forma canónica (mismo formateador) → "money:$31.6M" ≠ "money:$31.6K" (atrapa drift de escala).
export function parseFigures(text) {
  const s = String(text == null ? "" : text);
  const out = [];
  const push = (unit, raw, txt) => { if (Number.isFinite(raw)) out.push({ unit, raw, text: txt, canon: `${unit}:${_fmtC(raw, unit).replace(/\s/g, "")}` }); };
  const num = (t) => parseFloat(String(t).replace(/,/g, "")); // ADI formatea US-style: '.' = decimal, ',' = miles (se quita)
  let m;
  const reMoney = /\$\s?(\d[\d.,]*\d|\d)\s?([KMB])?/gi;   // $X, $X.YK, $X.YM, $XB
  while ((m = reMoney.exec(s))) { let v = num(m[1]); const u = (m[2] || "").toUpperCase(); if (u === "K") v *= 1e3; else if (u === "M") v *= 1e6; else if (u === "B") v *= 1e9; push("money", v, m[0]); }
  const rePct = /(\d[\d.,]*\d|\d)\s?%/g;                  // X% / X.Y%
  while ((m = rePct.exec(s))) push("pct", num(m[1]), m[0]);
  const reRatio = /(\d[\d.,]*\d|\d)\s?(?:x\b|×|veces\b|vez\b)/gi;   // Xx / X× / X veces (× = U+00D7, el que usa el motor; atrapa "13 veces")
  while ((m = reRatio.exec(s))) push("ratio", num(m[1]), m[0]);
  const reDays = /(\d[\d.,]*\d|\d)\s?(?:d\b|d[ií]as?\b)/gi;       // Xd / X días
  while ((m = reDays.exec(s))) push("days", num(m[1]), m[0]);
  return out;
}

// guardAgainstBoleta(narration, boleta) → { ok, unauthorized[], missing[], reason }
//   A · toda figura de la narración debe estar en la boleta (canónico unit-aware O verbatim). Si no → bloqueo.
//   B · toda figura mandatory de la boleta debe aparecer en la narración. Si falta → bloqueo.
// Atrapa: número inventado, drift de escala/unidad ($M vs $K), ratio garbleado (1.3x → "13 veces"), obligatoria omitida.
export function guardAgainstBoleta(narration, boleta) {
  const authCanon = new Set(boleta.map((f) => f.canon));
  const authVerbatim = new Set(boleta.map((f) => String(f.value).replace(/\s/g, "")));
  const figs = parseFigures(narration);
  const unauthorized = [];
  for (const f of figs) {
    if (!authCanon.has(f.canon) && !authVerbatim.has(String(f.text).replace(/\s/g, ""))) unauthorized.push(f.text);
  }
  const narrCanon = new Set(figs.map((f) => f.canon));
  const narrVerbatim = new Set(figs.map((f) => String(f.text).replace(/\s/g, "")));
  const missing = [];
  for (const f of boleta) {
    if (f.mandatory && !narrCanon.has(f.canon) && !narrVerbatim.has(String(f.value).replace(/\s/g, ""))) missing.push(f.value);
  }
  const ok = unauthorized.length === 0 && missing.length === 0;
  return {
    ok, unauthorized, missing,
    reason: ok ? "narración fiel a la boleta"
      : unauthorized.length ? `cifra(s) fuera de la boleta: ${unauthorized.join(", ")}`
      : `falta(n) cifra(s) obligatoria(s): ${missing.join(", ")}`,
  };
}

// boletaFromText(text) → boleta DERIVADA del texto de un composer SELLADO (rutas del motor: compare de marca/cliente/bodega,
// que no pueden emitir boleta propia sin tocar el motor). Unit-aware: value = la cifra VERBATIM del texto CON su unidad →
// el guard autoriza EXACTAMENTE las cifras de ADI y bloquea drift/garble (1.3× → "13 veces"). El closer del contrato no se toca.
export function boletaFromText(text, { context = null, mandatory = false } = {}) {
  return parseFigures(text).map((f) => ({
    label: f.text, value: f.text, unit: f.unit, raw: f.raw,
    mandatory, source: "actual", formula: null, context, canon: f.canon,
  }));
}

// ensureBoletaCoversText(boleta, text) → parte de la boleta FIRST-CLASS del composer (labels/mandatory/formula) y AGREGA
// las cifras del texto FINAL que no estén cubiertas (derivadas · las capas de _finalize agregan: suffix proactivo, lead,
// narrativa). Garantiza que la boleta cubra EXACTAMENTE el texto que la narración reformula → self-consistente, flag-independiente.
export function ensureBoletaCoversText(boleta, text, { context = null } = {}) {
  const base = Array.isArray(boleta) ? boleta.slice() : [];
  const seenCanon = new Set(base.map((f) => f.canon));
  const seenVerb = new Set(base.map((f) => String(f.value).replace(/\s/g, "")));
  for (const f of parseFigures(text)) {
    if (!seenCanon.has(f.canon) && !seenVerb.has(String(f.text).replace(/\s/g, ""))) {
      base.push({ label: f.text, value: f.text, unit: f.unit, raw: f.raw, mandatory: false, source: "actual", formula: null, context, canon: f.canon });
      seenCanon.add(f.canon);
    }
  }
  return base;
}
