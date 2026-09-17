/* tasas.js · LAS TASAS DE LA CASA — todo porcentaje conserva su significado completo: valor + base (denominador) + universo ══════════════
 *
 * Decisión del owner (2026-09-17, ronda adversarial 3): «Toda tasa o porcentaje debe conservar su significado completo: valor + base/denominador
 * + universo + período cuando corresponda». Medido en la ronda: «Lider recuperó el 45 % de su saldo pendiente» (el 45 % es abonado ÷ venta),
 * «Lider margina 21,5 % sobre el costo» (es sobre la venta), «Valparaíso concentra el 75 % del capital en inventario» (es del capital FRENADO),
 * «LG-DRYER8KG es el 41 % de lo frenado en Valparaíso» (es del frenado total; en Valparaíso es 55 %): la cifra era real y el verificador la daba
 * verdadera porque comparaba el número y no de qué base habla.
 *
 * Una sola fuente: cada tasa de la casa declara su BASE (el denominador, en claves del vocabulario de métricas) y su numerador; una participación
 * («% del total») toma la base de su cuadro (el `context` de la fig: «capital frenado», «riesgo de quiebre», «capital en inventario»). El resolutor
 * lee la base dicha junto a la cifra (`leerBase`), el juez no la confunde con otra métrica, y el verificador la contrasta (`juzgarBase`):
 *   · base dicha = base de la casa → la cifra vale por lo que es
 *   · base dicha ≠ base de la casa → la afirmación es OTRA tasa: si se puede calcular con las cifras de la boleta, se calcula y se dicta
 *     (verdadera o falsa con la cuenta); si es una tasa de la casa con base fija, es falsa (la cifra no significa eso) y se nombra la tasa que
 *     sí tiene esa base cuando existe; si no se puede demostrar, no verificable — nunca verdadera
 *   · una participación sin base dicha vale por la base de su cuadro (la evidencia la trae en su rótulo o en su `context`); exigir que la prosa
 *     diga la base es una decisión de producto pendiente del owner (hoy no se veta)
 *   · un cualificador que la evidencia no trae («en el canal online») deja la cifra sin evidencia: no verificable
 *   · «contra un benchmark de 30,1 %», «sobre los $92,9M del año pasado», «24 % de Jumbo»: una referencia, una cifra o un dueño no son bases */
import { normalizar } from "./afirmacion.js";
import { metricasEn, conceptosDe } from "./evidencia.js";
import { estadoCanon, ESTADOS_CANON } from "./estados.js";

/* ── el catálogo: concepto → base (claves del vocabulario) · numerador · definición ── */
export const TASAS_DE_LA_CASA = [
  { conceptos: ["margen", "margen promedio", "benchmark de margen", "piso de margen"], base: ["ventas"], baseNombre: "la venta", numerador: ["contribucion"], definicion: "contribución ÷ venta" },
  { conceptos: ["markup sobre costo", "markup promedio"], base: ["costo"], baseNombre: "el costo", numerador: null, definicion: "(venta − costo) ÷ costo" },
  { conceptos: ["peso del costo"], base: ["ventas"], baseNombre: "la venta", numerador: ["costo"], definicion: "costo ÷ venta" },
  { conceptos: ["carga comercial", "carga", "carga comercial alta", "nivel de carga declarado", "nivel de carga comercial declarado", "nivel de carga"], base: ["ventas"], baseNombre: "la venta", numerador: null, definicion: "acciones comerciales ÷ venta" },
  { conceptos: ["recuperado"], base: ["ventas"], baseNombre: "la venta a crédito del período", numerador: ["abonado"], definicion: "abonado ÷ venta a crédito" },
  { conceptos: ["umbral de materialidad"], base: ["ventas"], baseNombre: "la venta", numerador: null, definicion: "% de la venta del negocio" },
  { conceptos: ["variacion vs ano anterior", "crecimiento", "ventas vs ano anterior"], base: ["ano anterior"], baseNombre: "la venta del año anterior", numerador: null, definicion: "(venta − venta del año anterior) ÷ venta del año anterior" },
  { conceptos: ["variacion vs presupuesto", "ventas vs presupuesto"], base: ["presupuesto"], baseNombre: "el presupuesto", numerador: null, definicion: "(venta − presupuesto) ÷ presupuesto" },
  { conceptos: ["margen de inventario", "margen inventario"], base: ["costo"], baseNombre: "el costo", numerador: null, definicion: "margen sobre el costo del inventario" },
];
/* una participación: la base la dice su cuadro (la fig), no el concepto */
export const ES_PARTICIPACION = /^(?:%\s+del\s+total|participaci[oó]n|peso(?:\s+en\s+la\s+venta)?|porcentaje\s+del\s+total|cuota|concentraci[oó]n|share)$/i;

/* ── las claves de una base: el vocabulario de métricas, con «frenado/inmovilizado» absorbiendo «capital» (capital frenado ≠ capital) ── */
const _PERIODO_BASE = [[/a[ñn]o\s+(?:anterior|pasado|previo)|periodo\s+anterior|20\d\d\s+anterior/, "ano anterior"], [/presupuesto|ppto|plan\b/, "presupuesto"]];
function clavesDeBase(texto) {
  const s = normalizar(texto);
  const k = new Set([...metricasEn(s)].filter((x) => x !== "participacion" && x !== "variacion"));
  if (k.has("frenado")) k.delete("capital");
  for (const [re, clave] of _PERIODO_BASE) if (re.test(s)) k.add(clave);
  return k;
}
const _mismasClaves = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

/* palabras de universo (no de base): «de la cartera», «del negocio», «entre los 13 clientes», «del cuadro» */
const _UNIVERSO_PALABRAS = /^(?:(?:la|el|los|las|toda\s+la|todo\s+el|tu|tus|mi|mis|su|sus)\s+)?(?:cartera|negocio|empresa|compañia|compania|clientes|cuentas|clientes?\s+de\s+la\s+cartera|skus?|bodegas?|marcas?|familias?|cuadro|tabla|ranking|lista|top\s*\d*|total(?:es)?|todos|todas|los\s+\d+\s+\w+|las\s+\d+\s+\w+|\d+\s+\w+|periodo|per[ií]odo|a[ñn]o|mes|este\s+a[ñn]o|el\s+a[ñn]o|hoy|al\s+corte)\s*$/;
const _PREP = /^(?:de|del|sobre|respecto\s+(?:de|a|al)|en\s+relaci[oó]n\s+(?:a|con)|frente\s+a|contra|en)\s+/;
const _ART = /^(?:su|sus|la|el|lo|las|los|toda\s+la|todo\s+el|esa|ese|esta|este|un|una)\s+/;
const _CORTE = /[,;:()!?—–]|\.(?!\d)|\s+(?:y|e|o|u|pero|mientras|aunque|que|con|para|por|si|cuando|donde|como)\s+/;

/* la expresión de una base → { texto, claves, entidad, estado, desconocida } · null si es palabra de universo o vacía */
function _leerExpresion(expr, { resolverEntidad = null } = {}) {
  let e = normalizar(expr).replace(_PREP, "").replace(_ART, "").trim();
  e = e.split(_CORTE)[0].trim();
  if (!e || /^[$\d+\-−]/.test(e) || /^(?:unos|casi|apenas|solo|cerca\s+de|m[aá]s\s+de|menos\s+de)\s+[$\d]/.test(e)) return null;   // una cifra de referencia («sobre los $92,9M») no es una base
  if (_UNIVERSO_PALABRAS.test(e)) return null;
  /* una REFERENCIA de la casa («benchmark de 30,1 %», «el nivel declarado», «el piso de rotación») es el otro lado de una comparación, no una base */
  if (/^(?:un\s+|una\s+)?(?:benchmark|referencia|nivel|piso|techo|umbral|objetivo|presupuesto|ppto|plan|promedio)\b/.test(e) && !/^(?:presupuesto|ppto|plan)\b/.test(e)) return null;
  const out = { texto: e, claves: clavesDeBase(e), entidad: null, estado: null, desconocida: false };
  /* la entidad dicha en la base («lo frenado EN VALPARAÍSO», «el capital DE LÍNEA BLANCA», «de Línea Blanca») */
  if (typeof resolverEntidad === "function") {
    const palabras = e.split(/\s+/);
    for (let i = 0; i < palabras.length && !out.entidad; i++) {
      for (let j = palabras.length; j > i; j--) {
        const cand = palabras.slice(i, j).join(" ");
        if (/^(?:de|del|en|la|el|lo|los|las|su|sus)$/.test(cand)) continue;
        let ent = null; try { ent = resolverEntidad(cand); } catch { ent = null; }
        if (ent && ent.nombre) { out.entidad = ent; out.resto = (palabras.slice(0, i).join(" ") + " " + palabras.slice(j).join(" ")).replace(/\s+(?:en|de|del)\s*$/, "").trim(); break; }
      }
    }
  }
  /* «24 % de Jumbo», «$2,5M de Lider»: solo una entidad (sin concepto ni estado) es el DUEÑO de la cifra, no una base */
  if (out.entidad && !String(out.resto || "").trim() && !out.claves.size) return null;
  const cuerpo = out.resto != null ? out.resto : e;
  const est = cuerpo ? estadoCanon(cuerpo.replace(/^(?:lo|el|la|los|las)\s+/, "")) : null;
  if (est && ESTADOS_CANON.has(est) && !/capital\s+(?:sano|frenado|inmovilizado)/.test(cuerpo)) out.estado = est;
  if (!out.claves.size && !out.entidad && !out.estado) {
    /* «del capital sano» / «del inventario» / «del stock» / «de la deuda» nombran conceptos que el vocabulario reduce a una clave; lo que no
     * nombra nada de la casa es un cualificador desconocido («canal online», «la sucursal norte») */
    out.desconocida = true;
  }
  return out;
}

/** leerBase(fragmento, valorTexto, { resolverEntidad, metrica }) → la base dicha JUNTO a la cifra o null.
 *  «45% de su saldo pendiente» · «21,5% sobre el costo» · «41% de lo frenado en Valparaíso» · «el 75% del capital en inventario» ·
 *  «45% de recuperación sobre la venta» (la primera frase nombra la métrica: se salta) · «22,0% de margen» (nombra la métrica: no es base) */
export function leerBase(fragmento, valorTexto, { resolverEntidad = null, metrica = null } = {}) {
  if (!fragmento || !valorTexto) return null;
  const f = normalizar(fragmento), v = normalizar(valorTexto);
  const p = f.indexOf(v);
  if (p < 0) return null;
  let tras = f.slice(p + v.length, p + v.length + 90);
  const propias = new Set(metrica ? [...clavesDeBase(metrica), ...conceptosDe(metrica).flatMap((c) => [...clavesDeBase(c)])] : []);
  const conceptoDecl = metrica ? normalizar(metrica).split(/\s*[:·]\s*/)[0].trim() : "";
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    /* «en» introduce la base solo tras el nombre de la métrica («participación EN el inventario», «peso EN la venta»), nunca de entrada («$52K en Jumbo» es dueño) */
    const m = (vuelta > 0 ? /^\s*(?:(?:de|del|sobre|respecto\s+(?:de|a|al)|en\s+relaci[oó]n\s+(?:a|con)|en)\s+)(.+)$/ : /^\s*(?:(?:de|del|sobre|respecto\s+(?:de|a|al)|en\s+relaci[oó]n\s+(?:a|con))\s+)(.+)$/).exec(tras);
    if (!m) return null;
    const expr = m[1].split(_CORTE)[0];
    const b = _leerExpresion("de " + expr, { resolverEntidad });
    if (!b) return null;
    /* la frase que nombra la propia métrica («de margen», «de carga comercial», «de recuperación») no es la base: se mira la siguiente */
    const nombraLaMetrica = conceptoDecl && (conceptosDe(b.texto).includes(conceptoDecl) || b.texto === conceptoDecl || (b.claves.size && [...b.claves].every((k) => propias.has(k)) && !b.entidad));
    if (nombraLaMetrica && !ES_PARTICIPACION.test(conceptoDecl)) { tras = tras.slice(m[0].length - m[1].length + expr.length); continue; }
    return b;
  }
  return null;
}

/** clavesDeMetrica(metrica) → las claves del vocabulario de una métrica declarada y de sus sinónimos (para saber si un texto la nombra) */
export function clavesDeMetrica(metrica) {
  const c = normalizar(String(metrica || "")).split(/\s*[:·]\s*/)[0].trim();
  const out = new Set([...clavesDeBase(c)]);
  for (const s of conceptosDe(c)) for (const k of clavesDeBase(s)) out.add(k);
  return out;
}
/** leerBaseDeclarada(texto, { resolverEntidad }) → la base escrita en el campo `base`/`universo` de la declaración («de su saldo pendiente»,
 *  «sobre el costo», «canal online») o null si es un universo (cartera, negocio, N clientes) */
export function leerBaseDeclarada(texto, { resolverEntidad = null } = {}) {
  if (!texto || typeof texto !== "string") return null;
  return _leerExpresion(texto, { resolverEntidad });
}

/* ── la base de la EVIDENCIA: la tasa de la casa por concepto, o el cuadro de una participación ── */
export function tasaDe(concepto) {
  const c = normalizar(concepto).split(/\s*[:·]\s*/)[0].trim();
  const sin = conceptosDe(c);
  for (const t of TASAS_DE_LA_CASA) if (t.conceptos.includes(c) || sin.some((s) => t.conceptos.includes(s))) return t;
  return null;
}
/** baseDeLaEvidencia(fig, concepto) → { claves, estado, nombre, entidad: null, participacion } | null (base desconocida) */
export function baseDeLaEvidencia(fig, concepto = null) {
  const c = normalizar(concepto || (fig && fig.conceptoNorm) || "").split(/\s*[:·]\s*/)[0].trim();
  const t = tasaDe(c);
  if (t) return { claves: new Set(t.base), estado: null, nombre: t.baseNombre, entidad: null, participacion: false, tasa: t };
  /* «Umbral de materialidad · % de la venta»: el rótulo dice la base */
  const rotulo = fig ? normalizar(fig.conceptoNorm || fig.concepto || "") : "";
  const mb = /%\s+(?:de|del|sobre)\s+(?:la|el|los|las)?\s*([a-z\s]+)$/.exec(rotulo);
  if (mb) { const k = clavesDeBase(mb[1]); if (k.size) return { claves: k, estado: null, nombre: mb[1].trim(), entidad: null, participacion: false, tasa: null }; }
  if (ES_PARTICIPACION.test(c) || /% del total/.test(c)) {
    /* «Peso en la venta», «Participación en la venta del negocio»: el propio rótulo (o el concepto declarado) nombra la base */
    { const mp = /(?:peso|participaci[o]n|cuota|share)s+(?:en|de|del|sobre)s+(?:las+|els+|loss+|lass+)?([a-zs]+)$/.exec(rotulo) || /(?:peso|participaci[o]n|cuota|share)s+(?:en|de|del|sobre)s+(?:las+|els+|loss+|lass+)?([a-zs]+)$/.exec(normalizar(concepto || "")); if (mp) { const k = clavesDeBase(mp[1]); if (k.size) return { claves: k, estado: null, nombre: mp[1].trim(), entidad: null, participacion: true, tasa: null }; } }
    const ctx = fig && fig.context ? normalizar(String(fig.context)) : "";
    if (!ctx) return null;
    /* «… · participación en la venta»: la frase del context manda sobre las claves sueltas del nombre del cuadro */
    { const mc = /(?:peso|participaci[o]n|acumulado|cuota|share)\s+(?:en|de|del|sobre)\s+(?:la\s+|el\s+|los\s+|las\s+)?([a-z\s]+)$/.exec(ctx); if (mc) { const k = clavesDeBase(mc[1]); if (k.size) return { claves: k, estado: null, nombre: mc[1].trim(), entidad: null, participacion: true, tasa: null }; } }
    const k = clavesDeBase(ctx);
    const est = estadoCanon(ctx);
    if (!k.size && !(est && ESTADOS_CANON.has(est))) return null;
    return { claves: k, estado: est && ESTADOS_CANON.has(est) && !k.size ? est : null, nombre: String(fig.context), entidad: null, participacion: true, tasa: null };
  }
  return undefined;   // no es una tasa: la base no aplica
}

/* ¿la base dicha y la de la evidencia son la misma? (mismas claves o mismo estado, y el mismo alcance: sin entidad dicha, o la entidad del todo) */
export function mismaBase(dicha, ev) {
  if (!dicha || !ev) return false;
  const conceptoIgual = (dicha.claves.size || ev.claves.size) ? _mismasClaves(dicha.claves, ev.claves) : (dicha.estado && ev.estado && dicha.estado === ev.estado);
  if (!conceptoIgual) {
    /* «del capital frenado» dicho contra un cuadro cuyo contexto es el estado «frenado» (o al revés) */
    if (dicha.estado && ev.claves.has("frenado") && dicha.estado === "frenado" && !dicha.claves.size) return !dicha.entidad;
    if (ev.estado && dicha.claves.has("frenado") && ev.estado === "frenado" && !ev.claves.size) return !dicha.entidad;
    return false;
  }
  return !dicha.entidad;   // una entidad dicha en la base («en Valparaíso») restringe el denominador: ya no es el total del cuadro
}

/* la cifra (money) de una entidad —o del negocio— en un concepto dado por claves/estado, buscada en el índice (por rótulo o por contexto) */
function _cifraDe(I, entidad, base, { permitirContexto = true } = {}) {
  const k = entidad ? normalizar(entidad) : null;
  const casaConcepto = (f) => {
    const kf = clavesDeBase(f.conceptoNorm);
    if (base.claves.size) { if (_mismasClaves(kf, base.claves)) return true; if (permitirContexto && f.context && _mismasClaves(clavesDeBase(f.context), base.claves) && (kf.has("capital") || /^capital$|familia|bodega/.test(f.conceptoNorm))) return true; return false; }
    if (base.estado) { const e = estadoCanon(f.conceptoNorm); if (e === base.estado) return true; if (permitirContexto && f.context && estadoCanon(f.context) === base.estado && (kf.has("capital") || /familia|bodega/.test(f.conceptoNorm))) return true; }
    return false;
  };
  const cands = I.figs.filter((f) => Number.isFinite(f.raw) && f.unidad === "money" && (k ? f.entidad && normalizar(f.entidad) === k : !f.entidad) && casaConcepto(f) && (k || /total|^estado del inventario/.test(f.conceptoNorm) || !f.agregado));
  if (!cands.length) return null;
  /* del negocio: el total antes que un subtotal */
  cands.sort((a, b) => (/total/.test(b.conceptoNorm) ? 1 : 0) - (/total/.test(a.conceptoNorm) ? 1 : 0));
  return cands[0];
}

/* el cociente en % con dos lecturas: con los crudos y con lo impreso (la prosa pudo dividir cifras redondeadas) */
function _cocientes(num, den) {
  const out = [];
  if (Number.isFinite(num.raw) && Number.isFinite(den.raw) && den.raw !== 0) out.push((num.raw / den.raw) * 100);
  const pn = _impreso(num.texto), pd = _impreso(den.texto);
  if (pn != null && pd != null && pd !== 0) out.push((pn / pd) * 100);
  return out;
}
const _impreso = (t) => { const m = /(-?\d+(?:[.,]\d+)?)\s*([kmb])?/i.exec(String(t || "").replace(/\$/g, "").replace(/\.(?=\d{3}\b)/g, "")); if (!m) return null; const v = parseFloat(m[1].replace(",", ".")); const e = m[2] ? m[2].toLowerCase() : ""; return v * (e === "k" ? 1e3 : e === "m" ? 1e6 : e === "b" ? 1e9 : 1); };
const _tolerancia = (valorTexto) => { const m = /(\d+)(?:[.,](\d+))?\s*%/.exec(String(valorTexto || "")); const dec = m && m[2] ? m[2].length : 0; return 0.5 / Math.pow(10, dec) + 0.02; };
const _fmtPct = (x) => (Math.abs(x - Math.round(x)) < 0.05 ? String(Math.round(x)) : x.toFixed(1)) + "%";

/* la cuenta de la tasa dicha: numerador = la cifra del sujeto en el concepto de la base (participación) o el numerador de la tasa de la casa;
 * denominador = la cifra de la base dicha (de la entidad dicha, del sujeto, o del negocio) */
function _cuentaSobreBase(I, sujeto, ev, dicha) {
  let num = null, den = null;
  if (sujeto && sujeto !== "negocio" && dicha) {
    /* una participación sobre otra base es la cifra del sujeto EN ESA base («Valparaíso, del capital en inventario» = su capital total, no su
     * frenado); una tasa de la casa conserva su numerador («recuperó … de su saldo pendiente» = abonado ÷ pendiente) */
    const numBase = !ev || ev.participacion ? dicha : (ev.tasa && ev.tasa.numerador ? { claves: new Set(ev.tasa.numerador), estado: null } : null);
    if (numBase) num = _cifraDe(I, sujeto, numBase);
    if (dicha.entidad) den = _cifraDe(I, dicha.entidad.nombre, dicha);
    else if (!ev || ev.participacion) den = _cifraDe(I, null, dicha) || _cifraDe(I, sujeto, dicha);
    else den = _cifraDe(I, sujeto, dicha) || _cifraDe(I, null, dicha);
  }
  return { num, den, partes: num && den ? _cocientes(num, den) : [] };
}
/** calcularConBase(a, I, { concepto }) → { veredicto: "ok"|"falsa", motivo, verdad, evidencia } | null — la tasa dicha sobre una base, calculada con
 *  las cifras de la boleta aunque ninguna fig traiga esa cifra (una participación o una tasa de la casa cuya base se dijo) */
export function calcularConBase(a, I, { concepto = null } = {}) {
  const v = a && a.valor;
  if (!v || v.unidad !== "pct") return null;
  const c = concepto || a.metrica;
  const dicha = _normBase(a.base);
  if (!dicha || dicha.desconocida || !(dicha.claves.size || dicha.entidad || dicha.estado)) return null;
  const t = tasaDe(c);
  const ev = t ? { claves: new Set(t.base), estado: null, nombre: t.baseNombre, participacion: false, tasa: t } : (ES_PARTICIPACION.test(normalizar(c).split(/\s*[:·]\s*/)[0].trim()) ? { claves: new Set(), estado: null, nombre: "", participacion: true, tasa: null } : null);
  if (!ev) return null;
  const sujeto = typeof a.sujeto === "string" ? a.sujeto : null;
  const { num, den, partes } = _cuentaSobreBase(I, sujeto, ev, dicha);
  if (!partes.length) return null;
  const tol = _tolerancia(v.texto);
  const cierra = partes.some((x) => Math.abs(x - v.raw) <= tol);
  const cuenta = `${num.label} = ${num.texto} sobre ${den.label} = ${den.texto} = ${_fmtPct(partes[0])}`;
  if (cierra) return { veredicto: "ok", motivo: `base-calculada: ${cuenta}`, verdad: cuenta, evidencia: [num.label, den.label] };
  return { veredicto: "falsa", motivo: `cifra-distinta: sobre «${dicha.texto}» la cuenta da ${_fmtPct(partes[0])}, no ${v.texto}`, verdad: cuenta, evidencia: [num.label, den.label] };
}
/** juzgarBase(a, evidencia, I, { concepto }) → null si la base no aplica o coincide; si no, { veredicto: "falsa"|"no-verificable", motivo, verdad, evidencia }
 *  a.valor = { texto, raw, unidad } · a.base = la base dicha (objeto de leerBase) · evidencia = la fig del índice (o null con un ranking) */
export function juzgarBase(a, evidencia, I, { concepto = null } = {}) {
  const v = a && a.valor;
  if (!v) return null;
  const c = concepto || a.metrica;
  const dicha = _normBase(a.base);
  /* una cifra que no es tasa (dinero, días): solo un cualificador que la evidencia no trae la deja sin evidencia («$19,4M en el canal online») */
  if (v.unidad !== "pct") { if (dicha && dicha.desconocida) return { veredicto: "no-verificable", motivo: `cualificador-sin-evidencia: la evidencia no trae «${c}» de ${_nom(a.sujeto)} «${dicha.texto}»`, verdad: "", evidencia: [] }; return null; }
  const ev = baseDeLaEvidencia(evidencia, c);
  if (ev === undefined) {
    /* no es una tasa de la casa: solo un cualificador desconocido deja la cifra sin evidencia */
    if (dicha && dicha.desconocida) return { veredicto: "no-verificable", motivo: `cualificador-sin-evidencia: la evidencia no trae «${c}» de ${_nom(a.sujeto)} «${dicha.texto}»`, verdad: "", evidencia: [] };
    return null;
  }
  if (dicha && dicha.desconocida) return { veredicto: "no-verificable", motivo: `cualificador-sin-evidencia: la evidencia no trae «${c}» de ${_nom(a.sujeto)} «${dicha.texto}»`, verdad: "", evidencia: [] };
  if (!dicha) {
    /* una participación sin base dicha vale por la base que su cuadro le da (la evidencia la trae con su contexto); si NI la frase NI la evidencia
     * dicen de qué total es, «41 %» no significa nada verificable */
    /* (una participación sin base dicha vale por la de su cuadro: el número es el de la casa; la exigencia de decir la base es una decisión de
     * producto pendiente — hoy no se veta) */
    return null;
  }
  if (ev === null) {
    return { veredicto: "no-verificable", motivo: `base-no-verificable: la evidencia no dice de qué total es «${v.texto}» de ${_nom(a.sujeto)}; la frase dice «${dicha.texto}»`, verdad: "", evidencia: evidencia ? [evidencia.label] : [] };
  }
  if (mismaBase(dicha, ev)) return null;
  /* base distinta: ¿se puede calcular la tasa que la frase afirma? numerador = la cifra del sujeto en el concepto de la evidencia (o el
   * numerador de la tasa), denominador = la cifra de la base dicha (de la entidad dicha, del sujeto, o del negocio) */
  const sujeto = typeof a.sujeto === "string" ? a.sujeto : null;
  const { num, den, partes } = _cuentaSobreBase(I, sujeto, ev, dicha);
  const tol = _tolerancia(v.texto);
  if (partes.length) {
    const cierra = partes.some((x) => Math.abs(x - v.raw) <= tol);
    const cuenta = `${num.label} = ${num.texto} sobre ${den.label} = ${den.texto} = ${_fmtPct(partes[0])}`;
    if (cierra) return { veredicto: "ok", motivo: `base-calculada: ${cuenta}`, verdad: cuenta, evidencia: [num.label, den.label] };
    return { veredicto: "falsa", motivo: `base-distinta: «${v.texto}» de ${_nom(sujeto)} es sobre ${ev.nombre}; sobre «${dicha.texto}» la cuenta da ${_fmtPct(partes[0])}`, verdad: cuenta, evidencia: [num.label, den.label, ...(evidencia ? [evidencia.label] : [])] };
  }
  if (ev.tasa) {
    /* una tasa de la casa con base fija: la cifra no significa eso. Si la casa tiene la tasa con la base dicha, se nombra */
    const otra = TASAS_DE_LA_CASA.find((t) => t !== ev.tasa && _mismasClaves(new Set(t.base), dicha.claves));
    let figOtra = null;
    if (otra && sujeto) { for (const cc of otra.conceptos) { const fs = I.buscarFigs(sujeto, cc, { agregados: sujeto === "negocio" }); if (fs.length) { figOtra = fs[0]; break; } } }
    const verdad = `${_nom(sujeto)} · ${c} = ${v.texto} es ${ev.tasa.definicion} (sobre ${ev.nombre})${figOtra ? `; sobre «${dicha.texto}»: ${figOtra.label} = ${figOtra.texto}` : ""}`;
    return { veredicto: "falsa", motivo: `base-distinta: «${c}» se mide sobre ${ev.nombre}, no «${dicha.texto}»`, verdad, evidencia: [...(evidencia ? [evidencia.label] : []), ...(figOtra ? [figOtra.label] : [])] };
  }
  return { veredicto: "no-verificable", motivo: `base-distinta: «${v.texto}» de ${_nom(sujeto)} es sobre ${ev.nombre}, no sobre «${dicha.texto}», y la evidencia no permite calcularlo`, verdad: `${_nom(sujeto)} · ${c} = ${v.texto} sobre ${ev.nombre}`, evidencia: evidencia ? [evidencia.label] : [] };
}
const _nom = (s) => (s == null ? "" : typeof s === "string" ? s : s.descripcion || s.nombre || JSON.stringify(s));
/* la base viaja en la declaración resuelta como JSON (claves en lista, entidad por nombre): acá se vuelve a leer */
function _normBase(b) {
  if (!b || typeof b !== "object") return null;
  return { texto: String(b.texto || ""), claves: b.claves instanceof Set ? b.claves : new Set(Array.isArray(b.claves) ? b.claves : []), entidad: b.entidad ? (typeof b.entidad === "string" ? { nombre: b.entidad } : b.entidad) : null, estado: b.estado || null, desconocida: !!b.desconocida };
}

/** definicionesDeTasas() → [{ conceptos, base, definicion }] para documentos y gates */
export function definicionesDeTasas() { return TASAS_DE_LA_CASA.map((t) => ({ conceptos: t.conceptos, base: t.baseNombre, definicion: t.definicion })); }
