/* === src/adi/contribucionFocus.js · "la pregunta manda el foco" para CONTRIBUCIÓN (owner 2026-07-06) ===
 * 4º dominio. El review en vivo mostró que las preguntas de contribución caían al genérico o se las robaban los coerces
 * de ventas/margen (las palabras "venta"/"margen" aparecen en preguntas de contribución). Contribución = el $ que aporta
 * cada entidad (distinto del margen %): concentración 80/20, quién la sostiene, de dónde viene (volumen vs calidad), la
 * no capturada vs benchmark. El motor YA calcula las piezas (concentracion() · origenContribucion · buen_margen_baja_
 * contribucion); acá se rutean. Corre PRIMERO en la cadena (su palabra "contribución" es el disparador más específico). Puro.
 *
 * FOCOS: concentracion (quién sostiene · 80/20) · origen (volumen vs calidad) · no_capturada (vs benchmark) ·
 *        alta_venta_baja_contribucion · rank (top por contribución). */

export const CONTRIB_INTENT_RE = /\bcontribuci[oó]n\w*\b/iu;
// simulación: un VERBO (subo/bajá/aumentá…) seguido de un %-número, o un % con signo. Un "80%" pelado (referencia
// Pareto) o "baja contribución" (sin %) NO son simulación → no ceden.
const SIM_PCT_RE = /\b(sub\w*|baj\w*|aument\w*|increment\w*|reduc\w*|proyect\w*)\b[^?.!]*\d+\s*%|[+\-]\s?\d+\s?%/i;

function _dim(t) {
  const lead = String(t).match(/(?:qu[eé]|cu[aá]l\w*|cu[aá]nt\w*)\s+(clientes?|sku|productos?|famili\w*|marcas?)/i);
  if (lead) { const w = lead[1].toLowerCase(); if (/sku|producto/.test(w)) return "sku"; if (/famili/.test(w)) return "familia"; if (/marca/.test(w)) return "marca"; return "cliente"; }
  if (/\bsku\b|\bproducto/i.test(t)) return "sku";
  if (/famili/i.test(t)) return "familia";
  if (/\bmarca/i.test(t)) return "marca";
  return "cliente";
}
// entidad nombrada para "origen" ("…contribución de Falabella…") · primer "de <Nombre en Mayúscula>" (salta "de dónde/la…")
function _entity(t) {
  const m = String(t).match(/\bde\s+([A-ZÁÉÍÓÚ][\wÁÉÍÓÚáéíóúñ.\-]*(?:\s+[A-ZÁÉÍÓÚ][\wÁÉÍÓÚáéíóúñ.\-]*)?)/);
  return m ? m[1].trim().replace(/[?.!,]+$/, "") : null;
}

// detectContribucionFocus(texto) → { isContrib, focus?, dimension?, entity? }
export function detectContribucionFocus(q) {
  const t = String(q || "");
  if (!CONTRIB_INTENT_RE.test(t)) return { isContrib: false };
  if (SIM_PCT_RE.test(t)) return { isContrib: false };   // simulación de contribución → la maneja el path de simulación
  const dim = _dim(t);
  // concentración / quién sostiene / 80-20
  if (/qui[eé]n\s+(la\s+)?sostiene|concentr\w*|\b80\s*%|el\s+80\b|mayor\s+parte|pareto|de\s+qui[eé]n\s+depende/i.test(t)) return { isContrib: true, focus: "concentracion", dimension: dim };
  // origen: de dónde viene (volumen vs calidad)
  if (/de\s+d[oó]nde\s+(viene|sale)|\borigen\b|viene\s+(de|por)\s|volumen\s+o\s+(margen|calidad)|por\s+volumen\s+o/i.test(t)) return { isContrib: true, focus: "origen", dimension: "cliente", entity: _entity(t) };
  // no capturada
  if (/no\s+(estoy\s+)?captur\w*|no\s+capturad\w*|dejando\s+(sobre|de|en)|sobre\s+la\s+mesa|perd\w*\s+.*contribuci|recuperar\s+contribuci|sin\s+captur\w*/i.test(t)) return { isContrib: true, focus: "no_capturada", dimension: dim };
  // alta venta / buen margen pero baja contribución
  if (/(alta|much[oa])\s+venta.*(baja|poca)\s+contribuci|venden?\s+much\w*.*(baja|poca)\s+contribuci|(buen|alto)\s+margen.*(baja|poca)\s+contribuci|poca\s+contribuci/i.test(t)) return { isContrib: true, focus: "alta_venta_baja_contribucion", dimension: dim };
  return { isContrib: true, focus: "rank", dimension: dim };   // default: top por contribución
}
