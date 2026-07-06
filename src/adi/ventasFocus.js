/* === src/adi/ventasFocus.js · "la pregunta manda el foco" para VENTAS (owner 2026-07-06) ===
 * Tercer gemelo de inventoryFocus/marginFocus. El smoke en vivo mostró la misma trampa (el LLM manda casi toda pregunta de
 * ventas a operation=diagnose → el "genérico de 3 focos") + bugs de ruteo (compare que pide 2 entidades, meta_question,
 * ventas@sku sin cablear). Y este set es el más HUECO-pesado: no hay sucursal, ni transacciones (ticket real/frecuencia/
 * tráfico/conversión), ni serie mensual, ni flag de cliente nuevo. Este detector: mapea al foco real que el dato permite,
 * declara el hueco honesto cuando no, y CEDE a inventario cuando la pregunta es de quiebre/stock (Q20/Q21). Puro · gate-testable.
 *
 * FOCOS: vs_presupuesto · vs_anterior · explica_yoy · descomposicion_vol_precio · caida_clientes · precio_realizado
 *        (proxy de ticket, con aviso) · mix_familia · rank_venta.
 * GAPS: sin_sucursal · sin_serie_mensual · sin_frecuencia · sin_ticket (cada uno avisa + pivotea, nunca el genérico). */

import { INV_INTENT_RE } from "./inventoryFocus.js";   // el dominio inventario (quiebre/stock/rotación/sin-vender) → ventas CEDE

export const VENTAS_INTENT_RE = /\b(venta\w*|vende\w*|factura\w*|compr\w*|reduj\w*|dejaron\s+de|presupuesto|ppto|\bmeta\b|\bplan\b|crece\w*|crecimiento|ca[ií]d\w*|cay[oó]\w*|a[ñn]o anterior|yoy|ticket|precio promedio|frecuencia|\bmix\b|participaci[oó]n|canal\w*|nuevos?|desviaci[oó]n|unidades|volumen|recuperaci\w*|sucursal\w*|puntos?\s+de\s+venta)\b/iu;
const SIM_PCT_RE = /\b(sub[ei]\w*|baj[ae]\w*|aument\w*|increment\w*|proyect\w*|si\s+vend\w*)\b.*\d|[+\-]\s?\d+\s?%|\d+\s?%/i;
// sucursal es EL sujeto ("qué sucursales...") → hueco (no hay venta por sucursal). Distinto de listarla entre otras dims.
const SUCURSAL_PRIMARY_RE = /qu[eé]\s+(sucursal\w*|puntos?\s+de\s+venta)/i;
const MES_ANTERIOR_RE = /(mes\s+anterior|per[ií]odo\s+(anterior|pasado|inmediatamente\s+anterior))/i;

function _dim(t) {
  // preferí la dimensión LÍDER ("¿qué familias… y qué SKU…" → familia, no sku): la que sigue al qué/cuál inicial
  const lead = String(t).match(/(?:qu[eé]|cu[aá]l\w*|cu[aá]nt\w*)\s+(clientes?|sku|productos?|famili\w*|marcas?|canal\w*)/i);
  if (lead) { const w = lead[1].toLowerCase(); if (/sku|producto/.test(w)) return "sku"; if (/famili/.test(w)) return "familia"; if (/marca/.test(w)) return "marca"; if (/canal/.test(w)) return "canal"; return "cliente"; }
  if (/\bsku\b|\bproducto/i.test(t)) return "sku";
  if (/famili/i.test(t)) return "familia";
  if (/\bmarca/i.test(t)) return "marca";
  if (/\bcanal/i.test(t)) return "canal";
  return "cliente";
}
// el foco REAL que pide la pregunta (prioridad: específico → general)
function _focus(t, dim) {
  if (dim === "sku" && /mayor(es)?\s+venta|generan?\s+.*venta|m[aá]s\s+vend/i.test(t)) return "rank_venta";
  if (/por\s+(menor|m[aá]s)\s*(volumen|unidades)|efecto\s+precio|crecimiento\s+real|cambio\s+de\s+mix|variaci[oó]n\s+de\s+ventas\s+viene|viene\s+por\s+(m[aá]s|menor)|deterioran?\w*/i.test(t)) return "descomposicion_vol_precio";
  if (/evoluciona\s+el\s+ticket|aumentaron\s+.*ticket|ticket\s+promedio\s+(por|versus|vs)/i.test(t)) return "precio_realizado";
  if (/recuperaci\w*|dejaron\s+de\s+comprar|redujeron|activos\s+que|perdimos/i.test(t)) return "caida_clientes";
  if (/participaci[oó]n|ganando\s+o\s+perdiendo|mix\s+de\s+ventas/i.test(t)) return "mix_familia";
  if (/presupuesto|\bppto\b|\bmeta\b|\bplan\b|desviaci[oó]n/i.test(t)) return "vs_presupuesto";
  if (/explican\s+(el|la)\s+(crecimiento|ca[ií]da)|qui[eé]n\s+explica|explican\s+del\s+crecimiento|nuevos?\s+aportaron/i.test(t)) return "explica_yoy";
  if (/a[ñn]o\s+anterior|versus\s+el\s+mismo\s+per[ií]odo|yoy|crece\w*|c[oó]mo\s+va\s+la\s+venta|vs\.?\s+.*anterior/i.test(t)) return "vs_anterior";
  return null;
}
// algunos focos fijan su dimensión atómica
function _focusDim(focus, dim) {
  if (focus === "rank_venta") return "sku";
  if (focus === "mix_familia") return "familia";
  if (focus === "caida_clientes") return "cliente";
  if (focus === "precio_realizado") return dim === "canal" ? "canal" : "cliente";
  return dim;
}

// detectVentasFocus(texto) → { isVentas, focus?, gap?, pivotFocus?, dimension? }
export function detectVentasFocus(q) {
  const t = String(q || "");
  if (!VENTAS_INTENT_RE.test(t)) return { isVentas: false };
  if (SIM_PCT_RE.test(t)) return { isVentas: false };
  const dim = _dim(t);
  // sucursal-primaria ANTES de ceder a inventario (Q10 dice "pese a stock" pero es de sucursal, no de inventario)
  if (SUCURSAL_PRIMARY_RE.test(t)) return { isVentas: true, gap: "sin_sucursal", pivotFocus: _focus(t, dim) || "vs_anterior", dimension: "cliente" };
  if (INV_INTENT_RE.test(t)) return { isVentas: false };   // dominio inventario (quiebre/stock/rotación/sin-vender) → lo toma _coerceInventory
  if (MES_ANTERIOR_RE.test(t) && !/a[ñn]o/i.test(t)) return { isVentas: true, gap: "sin_serie_mensual", dimension: "cliente" };
  const f = _focus(t, dim);
  if (f) return { isVentas: true, focus: f, dimension: _focusDim(f, dim) };
  if (/frecuencia/i.test(t)) return { isVentas: true, gap: "sin_frecuencia", dimension: "cliente" };
  if (/tr[aá]fico|conversi[oó]n/i.test(t)) return { isVentas: true, gap: "sin_ticket", dimension: "cliente" };
  return { isVentas: true, focus: "vs_anterior", dimension: dim };   // default útil (YoY)
}
