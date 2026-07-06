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

export const VENTAS_INTENT_RE = /\b(venta\w*|vende\w*|vend[íi]\w*|factura\w*|despach\w*|compr\w*|reduj\w*|dejaron\s+de|presupuesto|ppto|\bmeta\b|\bplan\b|planificad\w*|crece\w*|crecimiento|crecimos|crec[ií]\b|ca[ií]d\w*|cay\w*|me\s+ca[ií]\b|a[ñn]o\s+(anterior|pasado)|hace\s+(un[ao]?\s+)?(a[ñn]o|mes)|yoy|ticket|precio\s+(promedio|real|por\s+unidad)|cobrando|frecuencia|\bmix\b|participa\w*|canal\w*|nuevos?|desviaci[oó]n|unidad\w*|\bcaja\w*|volumen|recuperaci\w*|sucursal\w*|tienda\w*|\blocal\w*|puntos?\s+de\s+(venta|despacho)|\btop\b|rubro\w*|categor\w*|l[ií]nea\w*|caballito\w*|c[oó]mo\s+(vamos|venimos|va))/iu;
const SIM_PCT_RE = /\b(sub[ei]\w*|baj[ae]\w*|aument\w*|increment\w*|proyect\w*|si\s+vend\w*)\b.*\d|[+\-]\s?\d+\s?%|\d+\s?%/i;
// sucursal es EL sujeto ("qué sucursales...") → hueco (no hay venta por sucursal). Distinto de listarla entre otras dims.
// sucursal como SUJETO ("qué sucursales…") → hueco directo · CUT ("…por sucursal") → hueco sólo si no hay un foco más fuerte (ticket)
const SUCURSAL_SUBJECT_RE = /\bqu[eé]\s+(sucursal\w*|local\w*|tienda\w*|puntos?\s+de\s+(venta|despacho))|\bcu[aá]l\s+(de\s+(mis|los|las)\s+)?(local\w*|tienda\w*|sucursal\w*)/i;
const SUCURSAL_CUT_RE = /\bpor\s+(sucursal\w*|tienda\w*|local\w*|punto\w*\s+de\s+despacho)|separ\w*\s+.*por\s+tienda/i;
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
  if (/(mayor(es)?\s+venta|generan?\s+.*venta|m[aá]s\s+(me\s+)?vend|m[aá]s\s+sal\w*|r[aá]nke\w*.*(venta|producto|sku)|top\s+(de\s+)?(sku|producto|venta)|caballito\w*\s+de\s+batalla|qu[eé]\s+.*m[aá]s\s+(se\s+vende|sale))/i.test(t) && !/famili|\bcanal|cliente|sucursal/i.test(t)) return "rank_venta";
  if (/por\s+(menor|m[aá]s)\s*(volumen|unidades)|efecto\s+precio|crecimiento\s+real|cambio\s+de\s+mix|variaci[oó]n\s+de\s+ventas\s+viene|viene\s+por\s+(m[aá]s|menor)|deterioran?\w*|(volumen|cantidad|unidades|cajas)\s+o\s+(por\s+)?(precio|caro|cobr)|(precio|caro)\s+o\s+(por\s+)?(volumen|cantidad|unidades|cajas)|separ\w*.*(cantidad|unidades).*precio|(despach\w*|muevo|vend\w*)\s+m[aá]s.*(o\s|porque).*(precio|caro|cobr)|sub[ií]\s+.*precio.*(o\s|porque).*(unidades|cajas|muev|vend|despach)/i.test(t)) return "descomposicion_vol_precio";
  if (/evoluciona\s+el\s+ticket|aumentaron?\s+.*ticket|ticket\s+promedio|precio\s+(promedio|real|por\s+unidad)|cu[aá]nto\s+.*(cobrando|me\s+queda|me\s+sale|cobro)\s+.*(por\s+)?(unidad|caja)|cu[aá]nto\s+.*(cada|por)\s+(caja|unidad)/i.test(t)) return "precio_realizado";
  if (/recuperaci\w*|dejaron\s+de\s+comprar|redujeron|activos\s+que|perdimos|(compr\w*|vend\w*)\s+menos\s+que\s+(antes|el\s+a[ñn]o)|se\s+(me\s+)?(cayeron|cay[oó]|enfriaron|fueron)|casi\s+no\s+(aparecen|compran)|compr\w*\s+menos/i.test(t)) return "caida_clientes";
  if (/participaci[oó]n|participa\w*\s+cada|ganando\s+o\s+perdiendo|mix\s+de\s+ventas|\bmix\b|qu[eé]\s+(familias?|categor\w*|rubro\w*|l[ií]nea\w*)\s+.*(pesa|manda|concentra|reparti|m[aá]s\s+(vend|pesa|sal))|repartid\w*\s+.*(venta|categor|familia|rubro|l[ií]nea)|c[oó]mo\s+.*repartid\w*\s+.*(venta|categor)|en\s+qu[eé]\s+(rubro|l[ií]nea|categor)\w*\s+.*(concentra|vend|venta)|(familias?|categor\w*|rubro\w*|l[ií]nea\w*)\s+.*(pesa|manda)\s+m[aá]s/i.test(t)) return "mix_familia";
  if (/presupuesto|\bppto\b|\bmeta\b|\bplan\b|desviaci[oó]n|planificad\w*|le\s+.*peg\w*\s+al\s+plan/i.test(t)) return "vs_presupuesto";
  if (/explican?\s+(el|la|que)\s+.*(crecimiento|ca[ií]da|sub|baj)|qui[eé]n\s+(me\s+)?explica|explican\s+del\s+crecimiento|nuevos?\s+aportaron|de\s+d[oó]nde\s+viene\s+(ese|el|este)\s+crecimiento|qu[eé]\s+.*(mueve\s+la\s+aguja|est[aá]\s+detr[aá]s|hay\s+detr[aá]s).*(a[ñn]o|crecimiento|diferencia)|desglos\w*.*(diferencia|crecimiento|a[ñn]o|anterior)/i.test(t)) return "explica_yoy";
  if (/a[ñn]o\s+(anterior|pasado)|versus\s+el\s+mismo\s+per[ií]odo|yoy|crece\w*|crecimos|crec[ií]\b|c[oó]mo\s+(va\s+la\s+venta|vamos|venimos)|vs\.?\s+.*(anterior|pasado)|contra\s+(el\s+)?a[ñn]o|hace\s+(un[ao]?\s+)?a[ñn]o|me\s+ca[ií]\b|crec[ií]\s+o\s+me\s+ca[ií]|respecto\s+(a|al)\s+.*a[ñn]o/i.test(t)) return "vs_anterior";
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
  // sucursal como SUJETO ANTES de ceder a inventario (Q10 dice "pese a stock" pero es de sucursal, no de inventario)
  if (SUCURSAL_SUBJECT_RE.test(t)) return { isVentas: true, gap: "sin_sucursal", pivotFocus: _focus(t, dim) || "vs_anterior", dimension: "cliente" };
  if (INV_INTENT_RE.test(t)) return { isVentas: false };   // dominio inventario (quiebre/stock/rotación/sin-vender) → lo toma _coerceInventory
  if (MES_ANTERIOR_RE.test(t) && !/a[ñn]o/i.test(t)) return { isVentas: true, gap: "sin_serie_mensual", dimension: "cliente" };
  const f = _focus(t, dim);
  if (f) return { isVentas: true, focus: f, dimension: _focusDim(f, dim) };
  if (SUCURSAL_CUT_RE.test(t)) return { isVentas: true, gap: "sin_sucursal", pivotFocus: "vs_anterior", dimension: "cliente" };   // "por sucursal" como corte, sin foco más fuerte
  if (/frecuencia/i.test(t)) return { isVentas: true, gap: "sin_frecuencia", dimension: "cliente" };
  if (/tr[aá]fico|conversi[oó]n/i.test(t)) return { isVentas: true, gap: "sin_ticket", dimension: "cliente" };
  return { isVentas: true, focus: "vs_anterior", dimension: dim };   // default útil (YoY)
}
