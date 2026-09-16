/* resolutor.js · LA CASA CANONIZA LA FORMA DE LA DECLARACIÓN (Notario semántico, fase 4 · 2026-09-16) ═══════════════════════════════
 * La fase 1 sacó la verdad de la redacción de la PROSA. La fase 3 en vivo mostró que la verdad seguía atada a la redacción de la
 * DECLARACIÓN: 29 hechos verdaderos (8,7 %) quedaron «no verificables» porque el modelo nombró el benchmark como sujeto, escribió el
 * universo dentro de la métrica, declaró un grupo con la lista de valores de cada cuenta, una fracción contra «el total frenado» o una
 * rotación sin unidad. Nada de eso es un error de verdad: es un choque de convención, y la convención la conoce la casa (el índice de la
 * evidencia), no el modelo. Este módulo traduce cada afirmación a la forma canónica ANTES del veredicto.
 *
 * LAS TRES REGLAS DURAS (la seguridad no se mueve):
 *  1. Una resolución se acepta solo si es ÚNICA. Con dos candidatos, no se resuelve: queda como estaba y el verificador dictará
 *     no-verificable, nombrando los candidatos en la nota.
 *  2. El VALOR declarado es el comprobante: si la afirmación trae cifra y el candidato no la sostiene, no se resuelve (jamás se cambia
 *     una cifra ni se aproxima nada). El veredicto sigue saliendo de `verificar.js` contra la boleta, con la tolerancia de siempre.
 *  3. Solo se rellena lo que el fragmento declarado dice sin ambigüedad (la dirección de un superlativo: «más grande» → mayor). Un
 *     campo que no se puede inferir sigue faltando y la afirmación sigue incompleta → no-verificable, nunca verdadera.
 * Todo queda escrito: cada afirmación resuelta lleva `_resuelta: [notas]`, y el expediente las publica.
 *
 * LAS REGLAS DE FORMA (cada una con su comprobante):
 *  R3 · el universo escrito dentro de la métrica («Carga comercial · 5 cuentas materiales») → metrica + universo.
 *  R5 · un grupo con la lista de valores («$56K / $36K / $33K / $10K») → N cifras, una por entidad (y ninguna suma que no se dijo); una
 *       variación con dos valores («+7.6% ($7.1M)») → dos variaciones, una por unidad.
 *  R1 · el sujeto (o el otro lado) que no es una entidad: «total …» → el todo del negocio · un concepto del negocio (benchmark, nivel,
 *       estado del inventario) si el valor lo sostiene · un conjunto que la evidencia identifica → sujeto descrito · una cifra pelada como
 *       otro lado → la fig única con ese valor. En «A contra B» el sujeto se comprueba con A y el otro lado con B.
 *  R4 · la unidad implícita por la métrica («rotación 1» → 1.0x).
 *  R9 · el universo de un subtotal que la cifra identifica (si es único; si el fragmento dice el TODO, se declara el todo → falsa).
 *  R10 · la dirección de un orden y la forma de una relación, leídas del fragmento («más grande» → mayor; «el doble» → veces).
 *  R12 · el período implícito de una variación («vs año anterior» si es la única variación que la boleta trae para ese sujeto y métrica).
 *  R13 · el otro lado que trae su cifra («nivel de referencia (3,5%)») la usa de comprobante; entre candidatos, el de la unidad del sujeto.
 *  R8 · las derivadas de la casa (brecha = benchmark − margen; variación en $ = venta − venta del año anterior), con su evidencia. */
import { normalizar, menosAscii, leerValor } from "./afirmacion.js";
import { parseFigures } from "../boleta.js";
import { mismoValor, necesitaUniverso, universoDeFig, ES_TODO } from "./evidencia.js";

const _NEGOCIO = /^(?:el\s+)?(?:negocio|empresa|compañía|compania|total)$/i;
const _TOK = (s) => normalizar(String(s || "")).replace(/[()·,;:%$]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w));
const _es = (x) => x && typeof x === "object" && !Array.isArray(x);
const _clon = (x) => JSON.parse(JSON.stringify(x));
/* «un total», «el total frenado», «total»: el TODO de una métrica del negocio */
const _TOTAL_RE = /^(?:el\s+|la\s+|un\s+)?total(?:\s+(?:de\s+|del\s+)?(.+))?$/i;
/* las palabras que orientan un superlativo o una comparación (las mismas que el detector de presencia ya usa: son léxico de la casa) */
const _MAYOR = /\b(?:m[aá]s\s+(?:grande|alt[oa]|pesad[oa]|larg[oa]|car[oa]|ancha|lejos|lejana|extensa|fuerte)s?|mayor(?:es)?|m[aá]s\s+que|supera|superan|por\s+encima|encima\s+de|arriba\s+de|excede|exceden)\b/i;
const _MENOR = /\b(?:m[aá]s\s+(?:pequeñ[oa]|baj[oa]|chic[oa]|cort[oa]|barat[oa]|cercan[oa]|pegad[oa])s?|menor(?:es)?|menos\s+que|por\s+debajo|debajo\s+de|bajo\s+el|no\s+llega|queda\s+corto|inferior)\b/i;
const _MEJOR = /\b(?:mejor(?:es)?|m[aá]s\s+san[oa]s?)\b/i, _PEOR = /\b(?:peor(?:es)?)\b/i;
/* la dirección de un ORDEN solo sale de un superlativo («la más alta», «el que más», «mayor», «el que menos»): «bajo el benchmark» o «por
 * encima del nivel» son umbrales de una cifra, no la dirección de un ranking */
const _SUP_MAYOR = /\b(?:m[aá]s\s+(?:grande|alt[oa]|pesad[oa]|larg[oa]|car[oa]|ancha|lejos|lejana|extensa|fuerte)s?|mayor(?:es)?|(?:el|la|los|las|quien(?:es)?)\s+que\s+m[aá]s|encabeza|lidera)\b/i;
const _SUP_MENOR = /\b(?:m[aá]s\s+(?:pequeñ[oa]|baj[oa]|chic[oa]|cort[oa]|barat[oa]|cercan[oa]|pegad[oa])s?|menor(?:es)?|(?:el|la|los|las|quien(?:es)?)\s+que\s+menos)\b/i;
/* la polaridad de las métricas que la casa conoce («mejor margen» = mayor; «mejor brecha/carga/días vencido» = menor) */
const _POLARIDAD = [[/margen|contribuci|venta|rotaci|recuperad|abonad|unidades/, "mayor"], [/brecha|carga|vencid|atraso|mora|d[ií]as\s+de\s+inventario|cobertura|d[ií]as\s+sin\s+venta|no\s+capturad|frenad|inmoviliz|sobrestock|pendiente|deuda|costo/, "menor"]];
const _polaridad = (metrica) => { const m = normalizar(metrica); for (const [re, d] of _POLARIDAD) if (re.test(m)) return d; return null; };
const _VECES = /\b(\d+(?:[.,]\d+)?)\s*(?:veces|x)\b|\b(dos|tres|cuatro|cinco|seis|diez)\s+veces\b|\b(?:el\s+|al\s+)?doble\b|\btriple\b|\bcu[aá]druple\b/i;
const _FRACCION = /\b(?:la\s+)?mitad\b|\b(?:un\s+)?tercio\b|\b(?:un\s+)?cuarto\s+de\b|\b(\d+(?:[.,]\d+)?)\s?%\s+(?:de|del)\b/i;
const _IGUAL = /\b(?:igual|iguales|similar(?:es)?|parecid[oa]s?|casi\s+lo\s+mismo|empatad[oa]s?|a\s+la\s+par)\b/i;

/* ── el índice como oráculo de formas (nada se inventa: todo sale de las figs, el catálogo y los conjuntos del turno) ── */
function _entidad(I, s) { try { return I.resolverEntidad(s); } catch { return null; } }
/* la MISMA comparación que dicta el veredicto (canon de la casa + tolerancia del muro): el comprobante no puede ser más estricto ni más laxo
 * que el juicio — «$10K» dicho por los $9.8K de la boleta (que ella misma imprime «$10K») resuelve y luego se juzga verdadero */
const _mismoValor = (v, f) => !!(v && f && mismoValor(v, f.raw, f.unidad, f.texto));
/* las figs SIN dueño (del negocio) cuyo concepto nombra lo que el modelo puso como sujeto o como otro lado («Benchmark de margen», «nivel de
 * referencia», «total frenado», «Estado del inventario: capital sano») */
function _conceptosDelNegocio(I, s, v = null) {
  const n = normalizar(s).replace(/^(?:el|la|los|las|un|una)\s+/, "");
  if (!n) return [];
  let c = [];
  try { c = I.buscarFigs("negocio", n, { agregados: true }).filter((f) => !f.entidad); } catch { c = []; }
  /* el comprobante decide entre capas: si la mejor casación no sostiene el valor declarado, valen las figs del negocio de cualquier capa que sí
   * lo sostengan («capital sano» casa mejor con «capital sano · % del total» = 41 %; el $56K declarado es «Estado del inventario: capital sano») */
  if (v && !c.some((f) => _mismoValor(v, f))) { const otras = I.figs.filter((f) => !f.entidad && _mismoValor(v, f) && ((typeof I.casa === "function" && I.casa(n, f) > 0) || f.conceptoNorm.includes(n))); if (otras.length) c = otras; }
  if (!c.length) { const tn = _TOK(n); if (tn.length) c = I.figs.filter((f) => !f.entidad && tn.every((t) => f.conceptoNorm.includes(t.slice(0, 5)))); }
  return c;
}
/* los conjuntos que la evidencia identifica (los mismos que usa el verificador para resolver un universo) */
function _conjuntos(I) { try { return typeof I.conjuntosConocidos === "function" ? I.conjuntosConocidos() : []; } catch { return []; }
}
function _esConjunto(I, s) {
  const n = normalizar(s);
  const tn = _TOK(n);
  for (const c of _conjuntos(I)) {
    if (c.re && c.re.test(n)) return c;
    if (c.tokens && tn.length && tn.every((t) => c.tokens.some((x) => x.startsWith(t.slice(0, 5))))) return c;
  }
  /* «N cuentas materiales», «las 5 cuentas bajo el benchmark»: un agregado de la boleta con ese rótulo de grupo */
  const nums = (n.match(/\d+/g) || []).map(Number);
  for (const f of I.figs) if (f.agregado && f.entidadesDelGrupo && f.entidadesDelGrupo.length && (!nums.length || nums.includes(f.n) || nums.includes(f.entidadesDelGrupo.length))) {
    const tt = _TOK(String(f.calificador || "").replace(/\(.*?\)/g, ""));
    if (tt.length && tn.length && tn.filter((t) => !/^(?:cuentas?|clientes?|skus?|grupo|de)$/.test(t)).every((t) => tt.some((x) => x.startsWith(t.slice(0, 5))))) return { nombre: f.label, agregado: f };
  }
  return null;
}
/* ¿la cola de una métrica («5 cuentas materiales», «los que caen», «total») es un universo que la evidencia entiende? */
function _pareceUniverso(I, s) {
  const n = normalizar(s).replace(/^(?:el|la|los|las|un|una|todos?\s+(?:los|las)?|todas?\s+(?:los|las)?)\s+/, "").trim();
  if (!n) return false;
  /* el nombre de una métrica de la boleta («Venta», «Margen», «Contribución») no es un universo: «Cola (6) · Venta» es un rótulo del cuadro */
  if (I.figs.some((f) => (f.conceptoNorm === n || f.base === n) && f.unidad !== "count")) return false;   // un CONTEO («clientes bajo el benchmark» = 8) sí nombra un conjunto
  if (/^(?:total|negocio|cartera|todos?|todas?|subtotal)\b/.test(n)) return true;
  if (/\b(?:cuentas?|clientes?|skus?|marcas?|familias?|bodegas?|canales?|meses|productos?)\b/.test(n)) return true;   // «los 13 clientes», «las 5 cuentas materiales», «subtotal · 3 sku»
  if (/^(?:top|los|las)\s*\d+|que\s+m[aá]s|de\s+mayor|de\s+menor/.test(n)) return true;
  return !!_esConjunto(I, n);
}

/* el comprobante de cada lado: el sujeto se comprueba con la primera cifra del valor («41.4% contra 57.3%» → 41.4) y el otro lado con la
 * segunda (57.3) o con relacion.valor; sin cifra propia, el otro lado se resuelve solo si es único */
function _comprobante(a, rol) {
  const texto = menosAscii(String(a.valor || ""));
  /* parseFigures agrupa por unidad, no por posición: el orden de los lados es el del texto */
  const figs = parseFigures(texto).map((f) => ({ f, i: texto.indexOf(f.text) })).sort((x, y) => x.i - y.i).map((x) => x.f);
  if (rol === "sujeto") return leerValor(a.valor) || (a.variacion && leerValor(a.variacion.valor)) || null;
  if (figs.length >= 2) return leerValor(figs[1].text) || null;
  if (a.relacion && a.relacion.valor != null) return leerValor(a.relacion.valor) || null;
  return null;
}
/* R13 · el otro lado que trae su propia cifra («nivel de referencia (3,5%)», «referencia de 120»): esa cifra es su comprobante */
function _comprobanteEnElTexto(s) {
  const t = menosAscii(String(s || ""));
  const figs = parseFigures(t);
  if (figs.length === 1) return leerValor(figs[0].text) || null;
  const m = /\b(?:de|a|en)\s+(\d+(?:[.,]\d+)?)\s*$/.exec(t.trim());   // «referencia de 120» (sin unidad: la métrica del sujeto la pone)
  if (m) return leerValor(m[1]) || null;
  return null;
}
/* la unidad con que la boleta trae la métrica del sujeto (para elegir, entre dos candidatos del otro lado, el comparable) */
function _unidadDelSujeto(I, a) {
  try {
    const s = typeof a.sujeto === "string" ? a.sujeto : null;
    if (!s || !a.metrica) return null;
    /* solo una casación exacta o sinónima de la métrica: «Carga comercial» ⊂ «Carga comercial alta» es otra métrica (y otra unidad) */
    const u = [...new Set(I.buscarFigs(s, a.metrica).filter((f) => typeof I.casa === "function" ? I.casa(a.metrica, f) >= 3 : true).map((f) => f.unidad).filter(Boolean))];
    return u.length === 1 ? u[0] : null;
  } catch { return null; }
}

/* ── R1 · el sujeto (o el otro lado de una relación) que no es una entidad ── */
function _resolverSujeto(I, sujeto, a, notas, rol = "sujeto") {
  if (sujeto == null) return sujeto;
  if (Array.isArray(sujeto)) return sujeto.map((x) => _resolverSujeto(I, x, a, notas, rol));
  if (_es(sujeto)) return sujeto;   // {descripcion} ya viene en la forma canónica
  const s = String(sujeto).trim();
  if (!s || _NEGOCIO.test(s) || _entidad(I, s)) return s;
  const v = _comprobante(a, rol) || (rol !== "sujeto" ? _comprobanteEnElTexto(s) : null);
  /* (a) «total …» → el todo de una métrica del negocio */
  const mt = _TOTAL_RE.exec(s);
  if (mt) {
    const resto = (mt[1] || "").trim();
    const conceptos = resto ? _conceptosDelNegocio(I, resto) : [];
    if (resto && conceptos.length) { const f = conceptos[0]; if (rol === "sujeto") { a.metrica = a.metrica || f.concepto; a.universo = a.universo || "total"; } notas.push(`${rol} «${s}» → negocio · ${f.concepto} (total)`); return rol === "sujeto" ? "negocio" : { sujeto: "negocio", metrica: f.concepto, universo: "total" }; }
    if (!resto) { if (rol === "sujeto") a.universo = a.universo || "total"; notas.push(`${rol} «${s}» → negocio (total)`); return rol === "sujeto" ? "negocio" : { sujeto: "negocio", metrica: a.metrica || "", universo: "total" }; }
  }
  /* (b) un concepto del negocio (benchmark, nivel de carga, techo, umbral, un estado del inventario…): el comprobante es el valor */
  const conceptos0 = _conceptosDelNegocio(I, s, v);
  /* con varios candidatos y sin comprobante, el otro lado tiene que ser COMPARABLE con la métrica del sujeto: misma unidad
   * («por encima del nivel declarado» de una carga en % no es el subtotal en $ que también dice «nivel declarado») */
  const uS = rol !== "sujeto" && !v && conceptos0.length > 1 ? _unidadDelSujeto(I, a) : null;
  const conceptos = uS && conceptos0.some((f) => f.unidad === uS) ? conceptos0.filter((f) => f.unidad === uS) : conceptos0;
  if (conceptos.length) {
    const compat = v ? conceptos.filter((f) => _mismoValor(v, f)) : conceptos;
    /* con valor, todo candidato que lo sostiene da el mismo veredicto: se toma el mejor casado (el primero); sin valor, dos candidatos son
     * ambigüedad solo si sus valores difieren (el «total» y el «subtotal» iguales no lo son) */
    const raws = [...new Set(compat.map((f) => Math.round(f.raw * 1000)))];
    const exacto = compat.find((f) => f.conceptoNorm === normalizar(s) || f.conceptoNorm === normalizar(s).replace(/^(?:el|la|los|las|un|una)\s+/, ""));
    const conceptosUnicos = exacto ? [exacto.conceptoNorm] : (v && compat.length) || raws.length === 1 ? [compat[0].conceptoNorm] : [...new Set(compat.map((f) => f.conceptoNorm))];
    if (exacto) compat.unshift(exacto);
    if (conceptosUnicos.length === 1) {
      const f = compat[0];
      if (rol === "sujeto") {
        a.metrica = f.concepto; notas.push(`sujeto «${s}» → negocio · ${f.concepto}`);
        /* el sujeto era el universo de un subtotal («5 cuentas materiales», «grandes», «resto»): queda declarado como universo de la cifra */
        if (normalizar(a.tipo) === "cifra" && !a.universo && f.agregado && necesitaUniverso(f, "negocio")) { a.universo = s; notas.push(`universo «${s}» (el sujeto nombraba el conjunto del subtotal)`); }
        return "negocio";
      }
      notas.push(`${rol} «${s}» → negocio · ${f.concepto}`); return { sujeto: "negocio", metrica: f.concepto };
    }
    if (conceptosUnicos.length > 1) { notas.push(`${rol} «${s}» ambiguo entre ${conceptosUnicos.slice(0, 3).join(" · ")}: no se resuelve`); return s; }   // nombra conceptos, no un conjunto: la ambigüedad queda no-verificable
    if (v && !compat.length) notas.push(`${rol} «${s}» nombra ${conceptos[0].concepto} = ${conceptos[0].texto}, no ${v.texto}: no se resuelve como concepto`);
    /* sin concepto que cierre, se sigue probando como conjunto: «cuentas bajo el benchmark» casaba por palabras con el subtotal «… (de 8
     * bajo el benchmark)» y ES el conjunto de los 8 */
  }
  /* (d, antes que c) un otro lado que trae su cifra («nivel de referencia (3,5%)», «$4.9M»): la fig del negocio con ese valor, si es única —
   * el valor identifica; un conjunto no lleva valor, así que no puede ganarle */
  if (rol !== "sujeto" && v && Number.isFinite(v.raw)) {
    const cands = I.figs.filter((f) => !f.entidad && _mismoValor(v, f));
    const conceptos2 = [...new Set(cands.map((f) => f.conceptoNorm))];
    /* varios rótulos con el MISMO valor (la referencia emitida por dos fuentes: «Nivel de carga declarado» y «Nivel de carga comercial declarado»)
     * dan el mismo veredicto: se toma el que mejor casa con las palabras del otro lado, o el primero */
    const mismoRaw = cands.length > 1 && cands.every((f) => f.unidad === cands[0].unidad && Math.abs(f.raw - cands[0].raw) <= Math.abs(cands[0].raw) * 0.005);
    if (conceptos2.length === 1 || mismoRaw) { const f = (typeof I.casa === "function" ? [...cands].sort((x, y) => I.casa(s, y) - I.casa(s, x))[0] : cands[0]); notas.push(`${rol} «${s}» → negocio · ${f.concepto} (por su cifra)`); return { sujeto: "negocio", metrica: f.concepto, ...(f.agregado ? { universo: f.calificador || "" } : {}) }; }
  }
  /* (c) un conjunto que la evidencia identifica («5 cuentas materiales», «los que caen», «las cuentas sanas») → sujeto descrito */
  const c = _esConjunto(I, s);
  if (c) { notas.push(`${rol} «${s}» → conjunto «${c.nombre}»`); return { descripcion: s }; }
  /* (d) un otro-lado que es una cifra pelada («$4.9M»): la fig del negocio con ese valor, si es única */
  if (rol !== "sujeto") {
    const vv = leerValor(s);
    if (vv && Number.isFinite(vv.raw)) {
      const cands = I.figs.filter((f) => !f.entidad && _mismoValor(vv, f));
      const conceptos2 = [...new Set(cands.map((f) => f.conceptoNorm))];
      if (conceptos2.length === 1) { const f = cands[0]; notas.push(`${rol} «${s}» → negocio · ${f.concepto}`); return { sujeto: "negocio", metrica: f.concepto, ...(f.agregado ? { universo: f.calificador || "" } : {}) }; }
    }
  }
  return s;
}

/* ── R4 · la unidad implícita por la métrica («rotación 1» → 1.0x · «115» en días → 115d) ── */
function _unidadImplicita(I, a, notas) {
  const v = leerValor(a.valor);
  if (!v || v.unidad !== "count" || !a.metrica) return;
  let figs = [];
  try { figs = I.buscarFigs(typeof a.sujeto === "string" ? a.sujeto : "negocio", a.metrica); } catch { figs = []; }
  if (!figs.length) { try { figs = I.figsDeMetrica(a.metrica); } catch { figs = []; } }
  const unidades = [...new Set(figs.map((f) => f.unidad).filter(Boolean))];
  if (unidades.length !== 1 || unidades[0] === "count" || unidades[0] === "money") return;
  const u = unidades[0];
  const nuevo = u === "ratio" ? `${v.raw}x` : u === "days" ? `${v.raw}d` : u === "pct" ? `${v.raw}%` : u === "pp" ? `${v.raw}pp` : null;
  if (!nuevo) return;
  a.valor = nuevo; notas.push(`valor «${v.texto}» sin unidad → ${nuevo} (la unidad de «${a.metrica}» en la boleta)`);
}

/* ── R10 · lo que el fragmento dice sin ambigüedad: la dirección de un orden, la forma de una relación ── */
function _inferirDireccion(a, notas) {
  if (!a.orden || typeof a.orden !== "object" || a.orden.direccion) return;
  if (/^(?:max|min)$/.test(normalizar(a.orden.forma))) return;   // max/min llevan su dirección en la forma: nada que leer
  const t = menosAscii(String(a.texto || ""));
  let d = null;
  if (_SUP_MAYOR.test(t)) d = "mayor"; else if (_SUP_MENOR.test(t)) d = "menor";
  else if (_MEJOR.test(t)) d = _polaridad(a.metrica); else if (_PEOR.test(t)) { const p = _polaridad(a.metrica); d = p === "mayor" ? "menor" : p === "menor" ? "mayor" : null; }
  if (d) { a.orden.direccion = d; notas.push(`orden.direccion «${d}» leída del fragmento`); }
}
function _inferirFormaDeRelacion(a, notas) {
  if (!a.relacion || typeof a.relacion !== "object" || a.relacion.forma) return;
  const t = menosAscii(String(a.texto || ""));
  const r = a.relacion;
  const mv = _VECES.exec(t);
  if (mv) { r.forma = "veces"; if (!r.k) r.k = mv[1] ? parseFloat(mv[1].replace(",", ".")) : mv[2] ? ({ dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, diez: 10 })[mv[2].toLowerCase()] : /doble/i.test(mv[0]) ? 2 : /triple/i.test(mv[0]) ? 3 : 4; notas.push(`relacion.forma «veces» leída del fragmento`); return; }
  if (_FRACCION.test(t)) { r.forma = "fraccion"; notas.push(`relacion.forma «fraccion» leída del fragmento`); return; }
  if (_IGUAL.test(t)) { r.forma = "igual"; notas.push(`relacion.forma «igual» leída del fragmento`); return; }
  if (_MAYOR.test(t)) { r.forma = "mayor"; notas.push(`relacion.forma «mayor» leída del fragmento`); return; }
  if (_MENOR.test(t)) { r.forma = "menor"; notas.push(`relacion.forma «menor» leída del fragmento`); return; }
  if (_MEJOR.test(t) || _PEOR.test(t)) { const p = _polaridad(a.metrica); if (p) { r.forma = _MEJOR.test(t) ? p : (p === "mayor" ? "menor" : "mayor"); notas.push(`relacion.forma «${r.forma}» leída del fragmento («${_MEJOR.test(t) ? "mejor" : "peor"}» en ${a.metrica})`); } }
}

/* ── R12 · el período implícito de una variación: «vs año anterior» cuando es la única variación que la boleta trae para ese sujeto y esa
 * métrica (el valor sigue siendo el comprobante en el verificador); con una serie mensual o un plan al lado, sigue faltando ── */
function _periodoImplicito(I, a, notas) {
  if (normalizar(a.tipo) !== "variacion" || a.periodo || typeof a.sujeto !== "string" || !a.metrica) return;
  /* las variaciones de la entidad: la de la VENTA es la «Variación vs año anterior» de la cuenta (así la rotula la casa, sin apellido); para otra
   * métrica, solo una fig de variación que la nombre */
  const m = normalizar(a.metrica);
  const ent = a.sujeto === "negocio" ? null : (() => { try { return I.resolverEntidad(a.sujeto); } catch { return null; } })();
  const propias = a.sujeto === "negocio" ? I.figs.filter((f) => !f.entidad) : (ent ? I.figs.filter((f) => f.entidad && normalizar(f.entidad) === normalizar(ent.nombre)) : []);
  const variaciones = propias.filter((f) => /variacion|yoy|vs ano anterior|vs presupuesto|vs ppto|crecimiento/.test(f.conceptoNorm) && (/venta|crecimiento|variacion/.test(m) ? !/margen|contribucion|carga|capital|saldo|unidades/.test(f.conceptoNorm) : f.conceptoNorm.includes(m.split(" ")[0])));
  const anteriores = variaciones.filter((f) => /ano anterior|yoy/.test(f.conceptoNorm) && !/presupuesto|ppto|plan/.test(f.conceptoNorm));
  const otras = variaciones.filter((f) => !anteriores.includes(f));
  if (!anteriores.length || otras.length) return;
  /* también cuando la métrica es la del crecimiento a secas («crecimiento», «variación»): la boleta solo trae la del año anterior */
  a.periodo = "vs año anterior"; notas.push(`periodo «vs año anterior» (la única variación de «${a.metrica}» que la boleta trae para ${a.sujeto})`);
}

/* ── R8 · las derivadas de la casa: la evidencia que la cuenta necesita, si la boleta la trae y es única ── */
function _evidenciaDerivada(I, a, notas) {
  if (Array.isArray(a.evidencia) && a.evidencia.length) return;
  const v = leerValor(a.valor) || (a.variacion && leerValor(a.variacion.valor));
  if (!v || !Number.isFinite(v.raw)) return;
  const m = normalizar(a.metrica);
  const sujeto = typeof a.sujeto === "string" ? a.sujeto : null;
  /* única por rótulo — o varias con el MISMO valor («headlineSub» y «Ventas totales», ambas $100.0M): la cuenta no cambia */
  const unica = (lista) => { const c = [...new Set(lista.map((f) => f.label))]; if (c.length === 1) return lista[0]; return lista.length > 1 && lista.every((f) => f.unidad === lista[0].unidad && Math.abs(f.raw - lista[0].raw) <= Math.abs(lista[0].raw) * 0.005) ? lista[0] : null; };
  /* brecha contra la referencia: margen del sujeto − benchmark de margen (en pp) */
  if (/brecha/.test(m) && sujeto && (v.unidad === "pp" || v.unidad === "pct")) {
    let propia = []; try { propia = I.buscarFigs(sujeto, "Brecha al benchmark"); } catch { propia = []; }
    if (propia.length) return;   // la boleta la trae: se verifica directo
    let margen = []; try { margen = I.buscarFigs(sujeto, "Margen").filter((f) => f.unidad === "pct"); } catch { margen = []; }
    const bench = I.figs.filter((f) => !f.entidad && /^benchmark de margen$/.test(f.conceptoNorm));
    const fm = unica(margen), fb = unica(bench);
    if (fm && fb) { a.evidencia = [fm.label, fb.label]; a.tipo = "cifra"; a.valor = a.valor || v.texto; notas.push(`brecha derivada de ${fm.label} y ${fb.label}`); }
    return;
  }
  /* una variación de la venta del negocio dicha en dinero: la diferencia entre el período y el año anterior */
  if (normalizar(a.tipo) === "variacion" && v.unidad === "money" && (!sujeto || _NEGOCIO.test(sujeto)) && /venta/.test(m)) {
    const hoy = unica(I.figs.filter((f) => !f.entidad && /^(?:ventas totales|ventas del periodo|venta del periodo|headlinesub)$/.test(f.conceptoNorm)));
    const ant = unica(I.figs.filter((f) => !f.entidad && /^ventas del ano anterior$/.test(f.conceptoNorm)));
    if (hoy && ant) { a.evidencia = [hoy.label, ant.label]; a.valorDerivado = true; notas.push(`variación en $ derivada de ${hoy.label} y ${ant.label}`); }
  }
}

/* ── R9 · el universo de un subtotal que la cifra identifica ──
 * Una cifra del negocio sin universo que coincide con UN solo subtotal de su métrica («$588K» de «Carga comercial alta · subtotal · 5 cuentas
 * materiales…») lleva el universo de ese subtotal: el valor es el comprobante y el rótulo de la boleta dice de qué conjunto es. Con dos
 * subtotales que la sostengan, no se resuelve. Y si el fragmento dice el TODO («toda la cartera», «en total», «los 13 clientes») el universo
 * declarado es ese todo — el verificador dictará alcance-promovido: falsa, nunca verdadera. */
function _universoPorValor(I, a, notas) {
  if (normalizar(a.tipo) !== "cifra" || a.universo || a.sujeto !== "negocio" || !a.metrica) return;
  const v = leerValor(a.valor);
  if (!v || !Number.isFinite(v.raw)) return;
  let cands = []; try { cands = I.buscarFigs("negocio", a.metrica, { agregados: true }).filter((f) => !f.entidad); } catch { cands = []; }
  const sostienen = cands.filter((f) => f.agregado && necesitaUniverso(f, "negocio") && _mismoValor(v, f));
  const labels = [...new Set(sostienen.map((f) => f.label))];
  if (labels.length !== 1) { if (labels.length > 1) notas.push(`la cifra ${v.texto} sostiene dos subtotales (${labels.slice(0, 2).join(" · ")}): el universo no se resuelve`); return; }
  const f = sostienen[0];
  const texto = menosAscii(String(a.texto || ""));
  if (ES_TODO.test(texto) && !/total/.test(f.conceptoNorm)) { a.universo = "el total"; notas.push(`el fragmento dice el todo y la cifra es de ${f.label}: universo «el total»`); return; }
  const u = universoDeFig(f);
  if (!u) return;
  a.universo = u; notas.push(`universo «${u}» ← ${f.label} (la cifra lo identifica)`);
}
/* una variación con dos valores en unidades distintas («+7.6% ($7.1M)») son dos variaciones, una por unidad */
function _partirVariacion(a, notas) {
  if (normalizar(a.tipo) !== "variacion" || !_es(a.variacion)) return null;
  const figs = parseFigures(menosAscii(String(a.variacion.valor != null ? a.variacion.valor : a.valor || "")));
  if (figs.length !== 2 || figs[0].unit === figs[1].unit) return null;
  notas.push(`variación con dos valores (${figs[0].text} y ${figs[1].text}) → dos variaciones, una por unidad`);
  return figs.map((f, k) => ({ ...a, ...(a.id ? { id: `${a.id}.${k + 1}` } : {}), variacion: { ...a.variacion, valor: f.text }, valor: f.text, _resuelta: [`de una variación con dos valores (${a.id || "sin id"})`] }));
}

/* ── R5 · un grupo con la lista de valores de cada entidad son N cifras (y, si el modelo no lo dijo, ninguna suma) ── */
function _partirGrupo(a, notas) {
  if (normalizar(a.tipo) !== "grupo") return null;
  /* las piezas de la lista («$56K / $36K / $33K / $10K», «1.194, 1.042», «22,0 % y 21,5 %»): cada una con su propio lector de valor, que
   * entiende una cifra pelada («1.194» son 1.194 unidades) — la coma decimal no parte («$1,2M, $900K» se parte por «, ») */
  const texto = menosAscii(String(a.valor || ""));
  const piezas = texto.split(/\s*(?:\/|;|\|)\s*|,\s+|\s+y\s+|\s+·\s+/).map((t) => t.trim()).filter(Boolean);
  const figs = piezas.length >= 2 ? piezas.map((p) => leerValor(p)).map((v, k) => (v && Number.isFinite(v.raw) ? { text: piezas[k] } : null)) : parseFigures(texto);
  if (figs.some((x) => !x)) return null;
  const g = _es(a.grupo) ? a.grupo : {};
  const entidades = Array.isArray(g.entidades) && g.entidades.length ? g.entidades : Array.isArray(a.sujeto) ? a.sujeto : [];
  if (figs.length < 2 || figs.length !== entidades.length) return null;
  notas.push(`grupo con ${figs.length} valores → ${figs.length} cifras, una por entidad`);
  return entidades.map((e, k) => ({ ...(a.id ? { id: `${a.id}.${k + 1}` } : {}), tipo: "cifra", sujeto: e, metrica: a.metrica, valor: figs[k].text, universo: "", periodo: a.periodo || "", evidencia: Array.isArray(a.evidencia) ? a.evidencia : [], texto: a.texto, _resuelta: [`de un grupo con lista de valores (${a.id || "sin id"})`] }));
}

/** resolverDeclaracion(raw, I) → [afirmaciones raw canónicas] (una, o varias si un grupo se parte) — cada una con `_resuelta` */
export function resolverDeclaracion(raw, I) {
  if (!raw || typeof raw !== "object" || !I) return [raw];
  const a = _clon(raw);
  const notas = [];
  const tipo = normalizar(a.tipo);
  /* R3 · el universo escrito dentro de la métrica */
  if (typeof a.metrica === "string" && /\s+·\s+/.test(a.metrica)) {
    const partes = a.metrica.split(/\s+·\s+/);
    const cola = partes.slice(1).join(" · ");
    if (!a.universo && _pareceUniverso(I, cola)) { a.metrica = partes[0]; a.universo = cola; notas.push(`universo «${cola}» leído desde la métrica`); }
  }
  /* R5 · el grupo con lista de valores */
  const partido = _partirGrupo(a, notas) || _partirVariacion(a, notas);
  if (partido) return partido.flatMap((x) => resolverDeclaracion(x, I));
  /* R1 · el sujeto y el otro lado */
  if (tipo !== "lectura") {
    a.sujeto = _resolverSujeto(I, a.sujeto, a, notas, "sujeto");
    if (_es(a.relacion) && a.relacion.vs != null) {
      const vs = a.relacion.vs;
      if (typeof vs === "string" || Array.isArray(vs)) a.relacion.vs = _resolverSujeto(I, vs, a, notas, "relacion.vs");
      else if (_es(vs) && vs.sujeto != null && !vs.descripcion) { const r = _resolverSujeto(I, vs.sujeto, a, notas, "relacion.vs"); if (_es(r)) a.relacion.vs = { ...vs, ...r, metrica: r.metrica || vs.metrica }; else a.relacion.vs = { ...vs, sujeto: r }; }
    }
    if (_es(a.orden) && typeof a.orden.vs === "string" && a.orden.vs) { const r = _resolverSujeto(I, a.orden.vs, a, notas, "orden.vs"); if (typeof r === "string") a.orden.vs = r; }
  }
  /* R4 · R9 · R10 · R8 */
  if (tipo === "cifra") _unidadImplicita(I, a, notas);
  if (tipo === "cifra") _universoPorValor(I, a, notas);
  if (tipo === "orden") _inferirDireccion(a, notas);
  if (tipo === "relacion") _inferirFormaDeRelacion(a, notas);
  if (tipo === "variacion") _periodoImplicito(I, a, notas);
  if (tipo === "cifra" || tipo === "variacion") _evidenciaDerivada(I, a, notas);
  if (notas.length) a._resuelta = [...(Array.isArray(a._resuelta) ? a._resuelta : []), ...notas];
  return [a];
}

/** resolverDeclaraciones(lista, I) → la lista canónica (puede ser más larga que la original si un grupo se partió) */
export function resolverDeclaraciones(lista, I) {
  if (!Array.isArray(lista) || !I) return Array.isArray(lista) ? lista : [];
  return lista.flatMap((a, i) => resolverDeclaracion(a && typeof a === "object" && !a.id ? { ...a, id: `a${i + 1}` } : a, I));
}
