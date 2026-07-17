/* === src/adi/contribucionFocus.js · "la pregunta manda el foco" para CONTRIBUCIÓN (owner 2026-07-06) ===
 * 4º dominio. El review en vivo mostró que las preguntas de contribución caían al genérico o se las robaban los coerces
 * de ventas/margen (las palabras "venta"/"margen" aparecen en preguntas de contribución). Contribución = el $ que aporta
 * cada entidad (distinto del margen %): concentración 80/20, quién la sostiene, de dónde viene (volumen vs calidad), la
 * no capturada vs benchmark. El motor YA calcula las piezas (concentracion() · origenContribucion · buen_margen_baja_
 * contribucion); acá se rutean. Corre PRIMERO en la cadena (su palabra "contribución" es el disparador más específico). Puro.
 *
 * FOCOS: concentracion (quién sostiene · 80/20) · origen (volumen vs calidad) · no_capturada (vs benchmark) ·
 *        alta_venta_baja_contribucion · rank (top por contribución). */

// contribución colloquial: aporta/sostiene/banca/plata-en-el-bolsillo/concentración/80-20/sobre-la-mesa/lo-que-me-deja.
export const CONTRIB_INTENT_RE = /\b(contribuci[oó]n\w*|aporta\w*|sostien\w*|banca\w*|plata\s+en\s+el\s+bolsillo|(concentr\w*|amarrad\w*|pegad\w*|depend\w*)\s+.*(cliente|cuenta|plata|negocio|poc|par|grande|todo)|80\s*[\/\-]\s*20|el\s+80\s*%|sobre\s+la\s+mesa|se\s+me\s+.*(escap|va\s).*(plata|entrar|manos)|dejando\s+ir|me\s+da\s+plata|regal\w*\s+.*(plata|sin\s+darme|descuento)|mueve\w*\s+la\s+aguja|casi\s+toda\s+(la\s+)?plata|pa\s+la\s+escoba|me\s+(queda|deja|pone|mete)\s+.*(de\s+cada|por\s+cada|cada\s+uno|al\s+final|m[aá]s\s+plata|bolsillo)|lo\s+(poco\s+)?que\s+(dejan|aportan|me\s+deja\w*|me\s+queda\w*)|no\s+se\s+justific\w*.*(poco|dejan))/iu;
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
// entidad nombrada para "origen": primer token en Mayúscula que no sea palabra-pregunta (subject "Falabella…" o "de Falabella").
// Si no es un cliente real, el composer lo valida contra dc[entity] y cae a la lectura general (fallback seguro).
const _STOP = /^(de|del|d[oó]nde|qu[eé]|c[oó]mo|cu[aá]l|cu[aá]les|cu[aá]nt[oa]s?|y|el|la|los|las|su|mi|en|es|para|con|un|una)$/i;
function _entity(t) {
  const caps = String(t).match(/[A-ZÁÉÍÓÚ][\wáéíóúñ.\-]+(?:\s+[A-ZÁÉÍÓÚ][\wáéíóúñ.\-]+)?/g) || [];
  for (const w of caps) { const c = w.trim().replace(/[?.!,]+$/, ""); if (!_STOP.test(c)) return c; }
  return null;
}

// detectContribucionFocus(texto) → { isContrib, focus?, dimension?, entity? }
export function detectContribucionFocus(q) {
  const t = String(q || "");
  if (!CONTRIB_INTENT_RE.test(t)) return { isContrib: false };
  if (SIM_PCT_RE.test(t)) return { isContrib: false };   // simulación de contribución → la maneja el path de simulación
  // CEDE a inventario: "plata pegada en stock/bodega" es capital inmovilizado, no contribución (salvo que diga contribución/aporta/…)
  if (/\b(stock|inventario|bodeg\w*|mercader)\b/i.test(t) && !/contribuci|aporta|sostien|banca|concentr|80\s*[\/\-%]/i.test(t)) return { isContrib: false };
  // CEDE a VENTAS (coherencia del 80/20 de la Mesa · owner 2026-07-15): "¿qué clientes explican el 80% de mi VENTA?"
  // es concentración DE VENTA — si el texto nombra la venta y no la contribución, el foco de ventas responde con SU
  // métrica (antes contribución la secuestraba y contestaba OTRA cifra que la del gráfico que emitió la pregunta).
  if (/\bventas?\b/i.test(t) && /explica\w*|concentr\w*|80/i.test(t) && !/contribuci|aporta|sostien|banca|deja|margen/i.test(t)) return { isContrib: false };
  const dim = _dim(t);
  // concentración / quién sostiene / 80-20
  if (/qui[eé]n\s+(la\s+|me\s+)?(sostiene|banca)|banca\w*|sostien\w*|concentr\w*|\b80\s*[\/\-%]|el\s+80\b|mayor\s+parte|pareto|de\s+qui[eé]n\s+depende|amarrad\w*|pegad\w*\s+a\s+(poc|un\s+par)|depend\w*\s+de\s+(poc|un\s+par|cu[aá]ntos)|casi\s+toda\s+(la\s+)?plata|pa\s+la\s+escoba|par\s+de\s+grandes|cu[aá]ntos?\s+(clientes|cuentas).*(banca|sostien|toda|casi)|de\s+cu[aá]ntos/i.test(t)) return { isContrib: true, focus: "concentracion", dimension: dim };
  // no capturada (antes de origen: "de dónde se me escapa" no es origen)
  if (/no\s+(estoy\s+)?captur\w*|no\s+capturad\w*|dejando\s+(sobre|de|ir|en)|dej[eé]\s+.*sobre\s+la\s+mesa|sobre\s+la\s+mesa|perd\w*\s+.*contribuci|recuperar\s+contribuci|sin\s+captur\w*|se\s+me\s+.*(escap|va\s).*(plata|entrar|de\s+las\s+manos|entrando)|regal\w*\s+.*(plata|sin\s+darme|descuento)|plata\s+que\s+.*(no\s+cobr|no\s+gan|regal|dej|escap)|pude\s+haber\s+ganado|deber[ií]a\s+estar\s+entrando|dejando\s+ir/i.test(t)) return { isContrib: true, focus: "no_capturada", dimension: dim };
  // origen: de dónde viene/saca/se arma (volumen vs calidad/margen)
  if (/de\s+d[oó]nde\s+(me\s+)?(viene|sale|saca|obtiene|proviene|se\s+arma)|se\s+arma\s+lo\s+que|\borigen\b|(viene|sale|saca|proviene)\s+(de|por)\s|volumen\s+o\s+(de\s+)?(margen|calidad|precio)|(margen|calidad)\s+o\s+(de\s+)?volumen|por\s+volumen\s+o|(aporta|da\s+plata|me\s+deja|me\s+da)\w*\s+.*(por|de)\s+(vender|volumen|margen|calidad|pagar|comprar|precio)|porque\s+(compra|vende|paga)\w*\s+.*o\s+(porque|por|de)/i.test(t)) return { isContrib: true, focus: "origen", dimension: "cliente", entity: _entity(t) };
  // alta venta / buen margen pero baja contribución
  if (/(alta|much[oa])\s+venta.*(baja|poca)\s+contribuci|venden?\s+much\w*.*(baja|poca)\s+contribuci|(buen|alto)\s+margen.*(baja|poca)\s+contribuci|poca\s+contribuci|(compr\w*|vend\w*|factura\w*|mueve\w*)\s+.*(mont[oó]n|harto|much|caleta|bonito|grande).*(casi\s+no\s+.*(deja|aporta)|aporta\w*\s+.*(miseria|poco|nada|humo)|lo\s+que\s+.*(queda|deja|me\s+queda).*(humo|poco|nada|miseria)|no\s+se\s+justific|una\s+miseria|no\s+me\s+sube|puro\s+humo)|grandes?\s+en\s+venta.*(poco|nada|no\s+se\s+justif)/i.test(t)) return { isContrib: true, focus: "alta_venta_baja_contribucion", dimension: dim };
  return { isContrib: true, focus: "rank", dimension: dim };   // default: top por contribución
}
