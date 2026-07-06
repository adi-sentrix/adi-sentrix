/* === src/adi/marginFocus.js · "la pregunta manda el foco" para MARGEN (owner 2026-07-06) ===
 * Detector PURO y determinístico. El smoke en vivo mostró que el LLM colapsa CASI TODA pregunta de margen a
 * operation=diagnose → composeSpecDiagnose → el "diagnóstico genérico de 3 focos" (23 de 25 preguntas), respondiendo una
 * pregunta DISTINTA a la que se hizo (la regla madre prohibida). Este detector rompe la trampa: mapea el texto al FOCO real
 * que pide la pregunta, o marca el HUECO honesto cuando el dato no existe. Mismo patrón que inventoryFocus.js (gate-testable).
 *
 * FOCOS reales (los responde composeSpecMargin con el motor + el dato disponible):
 *   bajo_benchmark · alto_volumen_bajo_margen · causa_precio · causa_costo · subir_precio · alto_margen_subpenetrado ·
 *   stock_bajo_margen · palancas
 * HUECOS honestos (el dato NO existe → avisar + pivot a la lente más cercana, NUNCA el diagnóstico genérico):
 *   caida (sin histórico de margen) · sin_serie (sin serie costo/precio) · proveedor (sin eje) · mix_cliente_sku (sin
 *   matriz transaccional) · vendedor (sin dimensión). */

// intención de MARGEN (amplia · dispara el foco). Nota: las preguntas de proveedor/vendedor/caída SIEMPRE dicen "margen",
// así que 'margen' las cubre; 'lista de precios'/'subir precio'/'costo creciente' cubren las que no nombran margen.
export const MARGIN_INTENT_RE = /\b(margen|rebate|carga\s+comercial|benchmark|rentab\w*|lista\s+de\s+precios|subir\s+(el\s+)?precio|precio\s+insuficient\w*|costo\s+alto|costo\s+crecient\w*|precio\s+estancad\w*|subpenetrad\w*)\b/iu;
// simulación de NIVEL (delta %) — "subí el margen 2 puntos" · no es lectura de margen
const SIM_PCT_RE = /\b(sub[ei]\w*|baj[ae]\w*|aument\w*|increment\w*|proyect\w*)\b.*\d|[+\-]\s?\d+\s?%|\d+\s?%/i;

// dimensión atómica que pide la pregunta (sku/producto gana si aparece · luego familia/marca/canal · si no, cliente)
function _dim(t) {
  if (/\bsku\b|\bproducto/i.test(t)) return "sku";
  if (/famili/i.test(t)) return "familia";
  if (/\bmarca/i.test(t)) return "marca";
  if (/\bcanal/i.test(t)) return "canal";
  return "cliente";
}

// detectMarginFocus(texto) → { isMargin, focus?, dimension?, negativo?, pct?, gap? }
export function detectMarginFocus(q) {
  const t = String(q || "");
  if (!MARGIN_INTENT_RE.test(t)) return { isMargin: false };
  if (SIM_PCT_RE.test(t)) return { isMargin: false };   // simulación de nivel → no es lectura de margen
  const dim = _dim(t);
  // ── HUECOS honestos primero (palabras distintivas) ──
  if (/\bca[ií]d\w*\s+(de\s+|del\s+)?margen|mayor\s+ca[ií]d\w*|margen\s+.*(cay[oó]|baj[oó])\s+(vs|respecto|compar|el\s+mes|el\s+a[ñn]o)/i.test(t)) return { isMargin: true, gap: "caida", dimension: dim };
  if (/costo\s+crecient\w*|precio\s+estancad\w*|costo\s+.*(sube|crece)\w*.*precio|precio\s+.*(no\s+sube|estanc)/i.test(t)) return { isMargin: true, gap: "sin_serie", dimension: "sku" };
  if (/proveedor\w*/i.test(t)) return { isMargin: true, gap: "proveedor", dimension: "marca" };   // pivot = margen por MARCA (aprox. línea de suministro)
  if (/vendedor\w*/i.test(t)) return { isMargin: true, gap: "vendedor", dimension: dim };
  if (/mix\s+cliente[\s-]*sku|cliente[\s-]*sku|combinaci[oó]n\s+cliente/i.test(t)) return { isMargin: true, gap: "mix_cliente_sku", dimension: "sku" };
  // ── FOCOS reales (específico → general) ──
  if (/subpenetrad\w*|alto\s+margen\s+.*(subpenetrad\w*|baja\s+(venta|penetr))/i.test(t)) return { isMargin: true, focus: "alto_margen_subpenetrado", dimension: "sku" };
  if (/subir\s+(el\s+)?precio|deber[ií]an?\s+subir|aumentar\s+(el\s+)?precio/i.test(t)) return { isMargin: true, focus: "subir_precio", dimension: "sku" };
  if (/por\s+costo|costo\s+alto|margen\s+bajo\s+por\s+costo/i.test(t)) return { isMargin: true, focus: "causa_costo", dimension: dim };
  if (/por\s+precio|precio\s+insuficient\w*|revisar\s+(la\s+)?lista\s+de\s+precios|lista\s+de\s+precios/i.test(t)) return { isMargin: true, focus: "causa_precio", dimension: dim };
  if (/(alto\s+)?stock\s+.*bajo\s+margen|bodegas?\s+.*bajo\s+margen|stock\s+en\s+productos?\s+de\s+bajo\s+margen/i.test(t)) return { isMargin: true, focus: "stock_bajo_margen", dimension: "sku" };
  if (/palanca\w*|acci[oó]n\w*\s+comercial|recuperar\s+(el\s+)?margen|qu[eé]\s+decisiones|deterioran?\s+.*margen|comprim\w*\s+.*margen/i.test(t)) return { isMargin: true, focus: "palancas", dimension: dim };
  if (/venden?\s+much\w*.*(bajo|poco)\s+margen|alto\s+volumen.*bajo\s+margen|vende\w*\s+m[aá]s.*margen|generan?\s+volumen.*bajo\s+margen|volumen.*bajo\s+margen/i.test(t)) return { isMargin: true, focus: "alto_volumen_bajo_margen", dimension: dim };
  const negativo = /negativ\w*/i.test(t);
  const pct = /porcentaje|qu[eé]\s+%|cu[aá]nt[oa]\s+.*(venta|del\s+total)/i.test(t);
  if (negativo || pct || /bajo\s+(el\s+)?margen\s+m[ií]nimo|margen\s+m[ií]nimo|bajo\s+benchmark|debajo\s+.*(benchmark|m[ií]nimo)|bajo\s+margen\b/i.test(t)) return { isMargin: true, focus: "bajo_benchmark", dimension: dim, negativo, pct };
  return { isMargin: true, focus: "bajo_benchmark", dimension: dim };   // default útil (nivel vs benchmark)
}
