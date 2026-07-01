/* === adi/composers/multiAsk.js · PEDIDO MÚLTIPLE (lista de métricas) → secuencial guiado ===
 * "Mostrame las ventas, los márgenes y dónde está mi capital inmovilizado" = una LISTA de ≥2 métricas enumeradas
 * (no un cruce). ADI se adueña (no puntea, no inventa un cruce): reconoce las N, contesta la 1ª entera y encadena.
 * Este módulo es DETECCIÓN PURA (sin dep de answerADI) · la orquestación (recursión + cola) vive en answerADI. */

export const normAsk = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// métricas reconocibles (comercial + inventario) · label → patrón (para hallar posición en el texto)
const _PATS = [
  { m: "ventas",                re: /\bventas?\b|factura/ },
  { m: "margen",                re: /\bmargen|margenes|rentab/ },
  { m: "contribución",          re: /\bcontribuci|aporta/ },
  { m: "rotación",              re: /\brotaci|\brota[ns]?\b/ },
  { m: "capital inmovilizado",  re: /\bcapital|inmoviliz|detenid|atrapad|stock\s+muerto|plata\s+dormida/ },
  { m: "cobertura",             re: /\bcobertura|\bdoh\b/ },
];

// sub-pregunta CANÓNICA que responde cada métrica sola (la que answerADI contesta bien · verificado)
export const SUBQ = {
  "ventas": "las ventas",
  "margen": "los márgenes",
  "contribución": "la contribución",
  "rotación": "la rotación",
  "capital inmovilizado": "dónde está el capital inmovilizado",
  "cobertura": "la cobertura",
};

// métricas pedidas, EN EL ORDEN en que aparecen en el texto (no un orden fijo).
export function extractAskedMetrics(text) {
  const n = normAsk(text);
  const found = [];
  for (const p of _PATS) { const i = n.search(p.re); if (i >= 0) found.push({ m: p.m, i }); }
  return found.sort((a, b) => a.i - b.i).map((x) => x.m);
}

// ¿es un PEDIDO MÚLTIPLE (lista)? ≥2 métricas + marcador de enumeración + NO un cruce. null = no aplica.
export function detectMultiAsk(text) {
  const n = normAsk(text);
  if (/\bcontra\b|\bvs\b|\bversus\b|cruz/.test(n)) return null;                 // "ventas contra margen" = cruce → avisa honesto
  const metrics = extractAskedMetrics(text);
  if (metrics.length < 2) return null;
  if (!/,|\by\b|\be\b|adem[aá]s|tambi[eé]n|junto|todo/.test(n)) return null;    // sin "," ni "y" → no es enumeración
  return metrics;
}

// "a, b o c" (para el encadenado "¿sigo con …?")
export function joinOr(list) {
  if (!list || !list.length) return "";
  if (list.length === 1) return list[0];
  return list.slice(0, -1).join(", ") + " o " + list[list.length - 1];
}
