/* === src/adi/notario/anclas.js · LA PROSA ANCLADA (verdad finita · etapa E2 · owner 2026-09-17) ══════════════════════════════════════
 * «La prosa puede ser infinita; la verdad de ADI debe ser finita, gobernada y verificable.» El modelo escribe libre y ancla cada hecho en su
 * sitio con la identidad del hecho del libro (hechos.js):
 *     {{h8 h3: el que más te debe es Lider, con {h3} pendientes}}   ·   celda de tabla: {h1}   ·   {{h14: {h14.n} cuentas superan {h14.umbral}}}
 * Alias tolerado: ⟦h8 h3: …⟧. Un placeholder suelto es su propia ancla. Sin anidar. Las marcas se quitan antes de servir y los valores los
 * escribe la casa desde el hecho verificado.
 *
 * El Notario ya no busca puntos, dueños, métricas, universos ni bases en la prosa. Comprueba una lista CERRADA; cada comprobación dice de qué
 * está hecha — [S] sintaxis · [L] lista cerrada de palabras · [P] posición · [G] geometría — y ninguna es gramática:
 *   1 forma [S] · 2 verdad (el libro) · 3 fuera de las anclas no hay léxico de hecho [L] · 4 dentro del ancla solo lo que dicen sus hechos [L+P]
 *   (entidades, números, métricas —pegadas a su placeholder cuando el ancla trae varias—, estados con paridad de negación, dirección por polaridad,
 *   lados de una relación, base con vocabulario de la casa, universo restringido escrito por la casa, roles visibles, sin dominio cruzado) ·
 *   5 núcleo [L] · 6 continuación [L+P] · 7 operadores fuera del ancla [L+P] · 8 dueño estructural [G] · 9 columnas y rótulos [G+L] ·
 *   10 predicación por dominio [L] · 12 render.
 * Lo que la casa decide NO leer: la interpretación, la ironía, la causa sin «porque», el pronombre que cruza dos hechos verdaderos (residuo
 * declarado). Puro: sin I/O, sin red. */
import { parseFigures } from "../boleta.js";
import { normalizar, menosAscii } from "./afirmacion.js";
import { metricasEn, mismoValor, unidadCompatible } from "./evidencia.js";
import { duenosEstructurales } from "./estructura.js";
import { estadoCanon, ESTADO_NOMBRADO_SRC, ESTADO_PROSA_SRC, complementoDe, ESTADOS_CANON, estadoDeclarado, ESTADOS_DE_LA_CASA } from "./estados.js";
/* el estado que dice una FRASE entera por una forma del catálogo («ni una factura vencida» = al día), sin el guardia de negación de estadoDeclarado */
const _estadoPorForma = (frase) => { const t = normalizar(String(frase || "")).trim(); if (!t) return null; for (const e of ESTADOS_DE_LA_CASA) { for (const src of [e.re && e.re.source, e.prosa && e.prosa.source]) { if (!src) continue; let ok = false; try { ok = new RegExp("^(?:" + src + ")$", "i").test(t); } catch { ok = false; } if (ok) return e.canon; } } return null; };
/* la forma del catálogo que termina en la marca de estado: hasta 4 palabras antes + la marca */
const _formaDeEstadoEn = (sp, e) => { const toks = _tokensAntes(sp, e.ini, 4); for (let k = toks.length; k >= 0; k--) { const c = _estadoPorForma((toks.slice(toks.length - k).join(" ") + " " + e.texto).trim()); if (c) return c; } return null; };
import { renderDe } from "./hechos.js";
import * as L from "./lexico.js";
import { rangoDeMatiz } from "../agente/atributosYRelaciones.js";
import { conjuntosConocidos } from "./verificar.js";

const _u = unidadCompatible;
const _esc = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const B = "(?<![a-záéíóúñ])", E = "(?![a-záéíóúñ])";
const _RE_ESTADO = new RegExp(B + "(?:" + ESTADO_NOMBRADO_SRC + ")[a-záéíóúñ]*", "gi");   // dentro de un ancla: todas las formas (se contrastan con el hecho)
const _RE_ESTADO_PROSA = new RegExp(B + "(?:" + ESTADO_PROSA_SRC + ")[a-záéíóúñ]*", "gi");   // fuera de las anclas: las formas que son PUNTO de estado (no cazan «no venderle»)
const _RE = {
  superlativo: new RegExp(B + L.SUPERLATIVO_SRC + E, "gi"),
  comparativo: new RegExp(B + L.COMPARATIVO_SRC + E, "gi"),
  variacion: new RegExp(B + L.VARIACION_SRC + E, "gi"),
  duracion: new RegExp(B + L.DURACION_SRC, "gi"),
  proporcion: new RegExp(B + L.PROPORCION_SRC + E, "gi"),
  proporcionSubjetiva: new RegExp(B + L.PROPORCION_SUBJETIVA_SRC + E, "gi"),
  proforma: new RegExp(B + L.PROFORMA_SRC + E, "gi"),
  negacion: new RegExp(B + L.NEGACION_SRC + E, "gi"),
  tiempo: new RegExp(B + L.TIEMPO_SRC + E, "gi"),
  modalidad: new RegExp(B + L.MODALIDAD_SRC + E, "gi"),
  pronombre: new RegExp(B + "(?:de\\s+[eé]l|de\\s+ella|de\\s+ellos|de\\s+ellas)" + E, "gi"),
  base: new RegExp(B + L.PREPOSICION_DE_BASE_SRC + "\\s+", "gi"),
  modismo: new RegExp(B + L.MODISMOS_SRC + E, "gi"),
  ordinal: new RegExp(B + L.ORDINAL_SRC + E, "gi"),
  numeroPalabra: new RegExp(B + "(?:casi\\s+|apenas\\s+|m[aá]s\\s+de\\s+|menos\\s+de\\s+|poco\\s+m[aá]s\\s+de\\s+|cerca\\s+de\\s+)?" + L.NUMERO_PALABRA_SRC + "(?:\\s+" + L.NUMERO_PALABRA_SRC + ")*\\s+" + L.UNIDADES_DE_HECHO_SRC + E, "gi"),
  fraccionPalabra: new RegExp(B + "(?:la\\s+mitad|un\\s+tercio|dos\\s+tercios|un\\s+cuarto|tres\\s+cuartos|(?:uno|dos|tres)\\s+de\\s+cada\\s+(?:dos|tres|cuatro|cinco|diez))" + E, "gi"),
  adjCasa: new RegExp(B + "m[aá]s\\s+" + L.ADJETIVOS_DE_LA_CASA_SRC + E, "gi"),
  verboCasa: new RegExp(B + L.VERBOS_DE_LA_CASA_SRC + E, "gi"),
  digito: /(?<![A-Za-z0-9\-_])[+\-−]?\$?\d[\d.,]*\s*(?:%|pp\b|[KMB]\b|x\b|d\b|d[ií]as?\b)?/g,
  placeholder: /\{([a-z][a-z0-9]*)(?:\.([a-z]+))?\}/gi,
  dominio: Object.fromEntries(Object.entries(L.DOMINIO_PALABRAS).map(([d, src]) => [d, new RegExp(B + src + E, "gi")])),
};
const MAYOR_SRC = "(?:m[aá]s|mayor(?:es)?|supera|superan|lidera|encabeza|primer[oa]?|arriba|encima|duplica|el\\s+doble|crece|sube|m[aá]s\\s+alt|m[aá]s\\s+grande|m[aá]s\\s+viej|m[aá]s\\s+antigu|m[aá]s\\s+lent|m[aá]s\\s+pesad|m[aá]s\\s+car)";
const MENOR_SRC = "(?:menos|menor(?:es)?|[uú]ltim[oa]|debajo|abajo|la\\s+mitad|cae|baja|m[aá]s\\s+baj|m[aá]s\\s+chic|m[aá]s\\s+peque|m[aá]s\\s+nuev|m[aá]s\\s+recient|m[aá]s\\s+r[aá]pid|m[aá]s\\s+barat)";
const _RE_MAYOR = new RegExp(B + MAYOR_SRC + E, "i"), _RE_MENOR = new RegExp(B + MENOR_SRC + E, "i");
const _RE_PEOR = /(?<![a-záéíóúñ])peor(?:es)?(?![a-záéíóúñ])/i, _RE_MEJOR = /(?<![a-záéíóúñ])mejor(?:es)?(?![a-záéíóúñ])/i;
const _RE_SUBE = /(?<![a-záéíóúñ])(?:sub(?:e|en|io|ió|ieron|iendo|ida)|crec(?:e|en|io|ió|ieron|iendo|imiento)|aument(?:a|an|o|ó|aron|ando|o)|mejor(?:a|an|o|ó|aron|ando)|repunt(?:a|an|o|ó|e)|se\s+dispar(?:a|o|ó)|gan(?:a|an|o|ó|aron)|avanz(?:a|an|o|ó)|al\s+alza|en\s+alza)(?![a-záéíóúñ])/i;
const _RE_BAJA = /(?<![a-záéíóúñ])(?:baj(?:a|an|o|ó|aron|ando|ada)|ca(?:e|en|yo|yó|yeron|yendo|ida)|retroced(?:e|en|io|ió|ieron)|se\s+contra(?:e|jo)|se\s+desplom(?:a|o|ó)|pierd(?:e|en)|perdi(?:o|ó|eron)|disminuy(?:e|en|o|ó)|empeor(?:a|an|o|ó)|ced(?:e|en|io|ió)|a\s+la\s+baja|en\s+baja)(?![a-záéíóúñ])/i;
/* el multiplicador escrito: «el doble» 2, «el triple» 3, «la mitad» 0.5, «un tercio» 1/3, «3 veces» 3; null si no hay */
const _multiplicadorDe = (t) => { const s = normalizar(t); const m = /(\d+(?:[.,]\d+)?)\s*(?:veces|x)\b/.exec(s); if (m) return +m[1].replace(",", "."); if (/\bdoble\b|duplic/.test(s)) return 2; if (/\btriple\b|triplic/.test(s)) return 3; if (/cuadrupl/.test(s)) return 4; if (/quintupl/.test(s)) return 5; if (/\bmitad\b/.test(s)) return 0.5; if (/\btercio\b|tercera parte/.test(s)) return 1 / 3; if (/\bcuarto\b|cuarta parte/.test(s)) return 0.25; return null; };
/* los dueños de una comparación con multiplicador: el k del hecho tiene que ser el multiplicador escrito («casi el triple» no lo dice un hecho de 2×) */
const _RE_MATIZ_ANTES = /(m[aá]s\s+de(?:l)?|menos\s+de(?:l)?|casi|apenas|pr[aá]cticamente|cerca\s+de(?:l)?|alrededor\s+de(?:l)?|aproximadamente|poco\s+m[aá]s\s+de(?:l)?|algo\s+m[aá]s\s+de(?:l)?|poco\s+menos\s+de(?:l)?|exactamente|justo)\s+(?:el|la|un|una)?\s*$/i;
const _conMultiplicador = (x, duenos, veto, span, ids, sp = "", I = null) => { const mult = _multiplicadorDe(x.texto); if (mult == null) return duenos; const conK = duenos.filter((h) => h.render && h.render.k != null && Number.isFinite(+h.render.k)); if (!conK.length) return duenos; const casa = conK.filter((h) => Math.abs(+h.render.k - mult) <= 0.02 * Math.max(1, mult));
  if (casa.length) {
    /* el matiz ESCRITO fija el rango («más del doble» con 1.83× no cierra aunque el hecho diga «casi el doble») */
    const mm = _RE_MATIZ_ANTES.exec(normalizar(sp.slice(Math.max(0, x.ini - 30), x.ini))) || _RE_MATIZ_ANTES.exec(normalizar(x.texto).replace(/(?:doble|triple|cu[aá]druple|mitad|tercio|cuarto|\d+\s*veces).*$/, "") + " ");
    const matiz = (mm ? mm[1] : "").replace(/(?<![a-z])del(?![a-z])/g, "de");   // «más del doble» = «más de» el doble
    let rango = null; try { rango = rangoDeMatiz(matiz); } catch { rango = null; }
    if (rango && I) for (const h of casa) { const q = _cocienteDe(h, I); if (q == null) continue; const r = q / mult; if (r < rango.lo - 1e-9 || r > rango.hi + 1e-9) veto("matiz-ajeno", `«${(normalizar(x.texto).startsWith(matiz) ? x.texto : matiz + " " + x.texto).trim()}» no cierra: ${h.id} es ${Math.round(q * 100) / 100}× (${matiz ? "el matiz «" + matiz + "» admite de " + rango.lo + " a " + rango.hi + " del múltiplo" : "a secas, de " + rango.lo + " a " + rango.hi + " del múltiplo"})`, span, [h.id]); }
    return duenos;
  } veto("multiplicador-ajeno", `«${x.texto}» dice ${Math.round(mult * 100) / 100}× y ${conK.map((h) => h.id + " dice " + h.render.k + "×").join(", ")}: escribe el multiplicador del hecho`, span, ids); return duenos; };
const BASE_DE_TASA = { margen: "ventas", margen_promedio: "ventas", markup: "costo", peso_costo: "ventas", carga: "ventas", recuperado: "ventas", umbral_materialidad: "ventas", variacion: "ventas_anterior", vs_presupuesto: "presupuesto", margen_inventario: "costo", benchmark: "ventas" };
const _CONDICIONAL = /r[ií]a(?:n|s|mos|is)?$/i;
const _BLANCO = "□";

/* ═══ 1 · EL PARSER ═══ */
const _ID = /^[a-z][a-z0-9]*$/i;
/** parsearAnclas(prosa) → { anclas: [{ini, fin, ids, inner, innerIni, innerFin, placeholders}], sueltos: [{id, campo, ini, fin}], errores } */
const _PERIODO_VIGENTE = "actual";
/* los nombres de métrica de la casa que llevan «no» («Contribución no capturada»): ese «no» no es una negación */
const _RE_NOMBRE_CON_NO = new RegExp(L.CLAVES_DE_METRICA.filter((m) => /(?:^|\s)no\s/.test(normalizar(m.nombre))).map((m) => normalizar(m.nombre).replace(/\s+/g, "\\s+").replace(/[aeiou]/g, (v) => ({ a: "[aá]", e: "[eé]", i: "[ií]", o: "[oó]", u: "[uúü]" })[v])).join("|") || "(?!x)x", "gi");
const _RE_MATERIAL = /(?<![a-záéíóúñ])(?:materia(?:l|les)|inmaterial(?:es)?|sobre\s+el\s+umbral|bajo\s+el\s+umbral)(?![a-záéíóúñ])/i;   // el período de la boleta (no es un escenario: el gate del colapso barre el literal como default)
export function parsearAnclas(prosa) {
  const s = String(prosa || "");
  const anclas = [], errores = [];
  const abre = /\{\{|⟦/g;
  let m;
  while ((m = abre.exec(s))) {
    const ini = m.index, esU = m[0] === "⟦";
    const cierreTok = esU ? "⟧" : "}}";
    const fin = esU ? s.indexOf(cierreTok, ini + m[0].length) : _cierreDeAncla(s, ini + m[0].length);
    if (fin === -2) { const fin2 = s.indexOf("}}", ini + 2); errores.push({ kind: "ancla-mal-formada", detail: `ancla-mal-formada: un ancla dentro de otra («${s.slice(ini + 2, ini + 42)}»)`, ini, fin: fin2 >= 0 ? fin2 + 2 : Math.min(s.length, ini + 40) }); abre.lastIndex = fin2 >= 0 ? fin2 + 2 : ini + 2; continue; }
    if (fin < 0) { errores.push({ kind: "ancla-mal-formada", detail: `ancla-mal-formada: «${s.slice(ini, ini + 40)}» no cierra`, ini, fin: Math.min(s.length, ini + 40) }); break; }
    const cuerpo = s.slice(ini + m[0].length, fin);
    const dos = cuerpo.indexOf(":");
    const cab = dos >= 0 ? cuerpo.slice(0, dos) : "";
    const ids = cab.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
    if (dos < 0 || !ids.length || !ids.every((x) => _ID.test(x))) { errores.push({ kind: "ancla-mal-formada", detail: `ancla-mal-formada: «${cuerpo.slice(0, 40)}» (la forma es {{h1 h2: tramo}})`, ini, fin: fin + cierreTok.length }); abre.lastIndex = fin + cierreTok.length; continue; }
    const innerIni = ini + m[0].length + dos + 1, innerFin = fin;
    const inner = s.slice(innerIni, innerFin);
    anclas.push({ ini, fin: fin + cierreTok.length, ids, inner, innerIni, innerFin, placeholders: _placeholders(inner, innerIni) });
    abre.lastIndex = fin + cierreTok.length;
  }
  const sueltos = _placeholders(s, 0).filter((p) => !anclas.some((a) => p.ini >= a.ini && p.fin <= a.fin) && !errores.some((e) => p.ini >= e.ini && p.fin <= e.fin));
  { const cierra = /\}\}|⟧/g; let c; while ((c = cierra.exec(s))) if (!anclas.some((a) => c.index >= a.ini && c.index < a.fin) && !errores.some((e) => c.index >= e.ini && c.index < e.fin)) errores.push({ kind: "ancla-mal-formada", detail: `ancla-mal-formada: cierre «${c[0]}» sin apertura`, ini: c.index, fin: c.index + c[0].length }); }
  return { anclas, sueltos, errores };
}
/* el cierre «}}» del ancla abierta en `desde`: salta los placeholders ({h3}, {h3.n}) y detecta un ancla anidada (-2); -1 si no cierra */
function _cierreDeAncla(s, desde) {
  const ph = /\{[a-z][a-z0-9]*(?:\.[a-z]+)?\}/iy;
  let i = desde;
  while (i < s.length) {
    if (s.startsWith("{{", i) || s[i] === "⟦") return -2;
    ph.lastIndex = i; const m = ph.exec(s); if (m && m.index === i) { i += m[0].length; continue; }
    if (s.startsWith("}}", i)) return i;
    i++;
  }
  return -1;
}
function _placeholders(t, base) {
  const out = []; const re = new RegExp(_RE.placeholder.source, "gi"); let m;
  while ((m = re.exec(t))) out.push({ id: m[1], campo: m[2] || "valor", ini: base + m.index, fin: base + m.index + m[0].length });
  return out;
}

/* ═══ 12 · EL RENDER (los valores los escribe la casa; las marcas no llegan a pantalla) ═══ */
const _canonTexto = (t) => menosAscii(String(t || "")).replace(/(\d),(\d)/g, "$1.$2").replace(/(\d)\s+%/g, "$1%");
/** renderizar(prosa, libro) → { texto, faltantes: [{id, campo}] } */
export function renderizar(prosa, libro) {
  const s = String(prosa || "");
  const P = parsearAnclas(s);
  const faltantes = [];
  const sust = (t) => t.replace(new RegExp(_RE.placeholder.source, "gi"), (m0, id, campo) => { const r = renderDe(libro, id, campo || "valor"); if (r == null) { faltantes.push({ id, campo: campo || "valor" }); return m0; } return r; });
  let out = "", pos = 0;
  for (const a of [...P.anclas].sort((x, y) => x.ini - y.ini)) { out += sust(s.slice(pos, a.ini)); out += _canonTexto(sust(_reemplazarCifras(a.inner.replace(/^\s+/, ""), a.ids.map((id) => libro && libro.porId ? libro.porId.get(id) : null).filter(Boolean)))); pos = a.fin; }
  out += sust(s.slice(pos));
  return { texto: out.replace(/[ \t]+\n/g, "\n"), faltantes };
}

/* el universo restringido de un hecho está ESCRITO cuando el ancla (o su línea) trae el nombre de la casa: el texto del universo tal como la casa
 * lo nombra, o el nombre de un conjunto de la evidencia con el mismo conjunto. Es lo mismo que {id.universo} rendería. Devuelve la posición
 * dentro del ancla (para exceptuar sus números) o true si está en la línea. */
function _universoEscrito(h, sp, tramo, libro) {
  if (!(h.universo && h.universo.restringido)) return null;
  const nombres = [];
  if (h.universo.texto) nombres.push(String(h.universo.texto));
  if (typeof h.universo.fuente === "string" && h.universo.fuente) nombres.push(h.universo.fuente);
  const I = libro && libro.indice;
  if (I && h.universo.set && h.universo.set.size) {
    let cs = []; try { cs = conjuntosConocidos(I); } catch { cs = []; }
    for (const c of cs) if (c && c.set && c.set.size === h.universo.set.size && [...c.set].every((k) => h.universo.set.has(k)) && c.nombre) nombres.push(String(c.nombre));
  }
  /* el conjunto mayor que describe al universo («5 cuentas materiales (de 8 bajo el benchmark)») también lo nombra, y los sinónimos de la casa */
  for (const nom of nombres.slice()) { const m = /\(de\s+\d+\s+([^)]+)\)/.exec(String(nom)); if (m) nombres.push(m[1]); }
  for (const nom of nombres.slice()) { const k = normalizar(nom).replace(/^(?:todos\s+los|todas\s+las|los|las)\s+/, ""); for (const [c, sins] of Object.entries(L.SINONIMOS_DE_CONJUNTO)) if (k === c || k.endsWith(" " + c) || sins.some((x) => normalizar(x) === k)) nombres.push(...sins); }
  const spN = normalizar(sp);
  /* exclusión por top («sin estar entre los que más contribuyen ni más venden»): el marcador de exclusión y la métrica de cada top excluido */
  const ut = h.universoTipado;
  if (ut && ut.excluir && ut.excluir.top) {
    const tops = (Array.isArray(ut.excluir.top) ? ut.excluir.top : [ut.excluir.top]).filter((t) => t && typeof t === "object");
    const mExc = /(?:sin\s+estar\s+entre|fuera\s+de|no\s+est[aá]n?\s+entre|salvo|excepto|que\s+no\s+est[aá]n?\s+entre)/i.exec(spN);
    if (mExc && tops.length) {
      const resto = spN.slice(mExc.index);
      const claves = new Set(_metricasConPosicion(resto).flatMap((mt) => [...mt.claves]));
      if (tops.every((t) => { const c = L.claveDeMetrica(t.metrica); return c && claves.has(c); })) return { ini: mExc.index, fin: spN.length };
    }
  }
  const _formas = (nom) => { const n0 = normalizar(nom).replace(/^(?:todos\s+los|todas\s+las|los|las|de\s+los|de\s+las|tus|sus)\s+/, ""); const n1 = n0.replace(/^(?:\d+\s+)?(?:clientes?|skus?|marcas?|familias?|bodegas?|canales?|cuentas?)\s+(?=que\s)/, ""); return [...new Set([n0, n1].filter((x) => x.length >= 3))]; };
  for (const nom of nombres) for (const n of _formas(nom)) {
    const p = spN.indexOf(n);
    if (p >= 0) return { ini: p, fin: p + n.length };
    const linea = tramo && (tramo.lineaTexto || tramo.texto);
    if (linea && normalizar(linea).includes(n)) return true;
  }
  return null;
}

/* las negaciones REALES de un ancla: sin el «no» de un nombre de métrica («Contribución no capturada»), sin el «No:» que abre la respuesta a la
 * premisa (estándar de los cuatro puntos) y sin el «no aparece / no hay» con que la casa dice un conteo de cero */
function _negacionesDe(sp, hechos) {
  const mets = [..._metricasConPosicion(sp), ..._todos(_RE_NOMBRE_CON_NO, sp)];
  const cero = (hechos || []).some((h) => h.tipo === "conteo" && ([+h.render.n, ...h.numeros.map((x) => x.raw)].some((v) => v === 0)));
  const ini0 = sp.search(/\S/);
  const excluye = (hechos || []).some((h) => h.universoTipado && h.universoTipado.excluir);
  return _todos(_RE.negacion, sp)
    .filter((x) => !mets.some((mt) => mt.ini <= x.ini && x.fin <= mt.fin))
    .filter((x) => !(excluye && /^(?:sin\s+estar\s+entre|no\s+est[aá]n?\s+entre|fuera\s+de)/i.test(sp.slice(x.ini))))   // la exclusión de un universo tipado no niega el hecho
    .filter((x) => !(x.ini === ini0 && /^\s*no\s*:/i.test(sp)))
    .filter((x) => !(cero && /^no\s+(?:aparece|hay|figura|queda|tienes?|tenemos)/i.test(sp.slice(x.ini))));
}

/* un grupo/subtotal está NOMBRADO cuando la línea trae el nombre de la casa de su conjunto (el texto de su universo o un conjunto de la evidencia con los mismos miembros) */
function _grupoNombrado(h, linea, libro) {
  if (!linea) return false;
  const nombres = [];
  if (h.universo && h.universo.texto) nombres.push(String(h.universo.texto));
  if (h.universo && typeof h.universo.fuente === "string" && h.universo.fuente) nombres.push(h.universo.fuente);
  const I = libro && libro.indice; const M = new Set((h.roles.miembros || []).map(normalizar));
  if (I && M.size) { let cs = []; try { cs = conjuntosConocidos(I); } catch { cs = []; } for (const c of cs) if (c && c.set && c.set.size === M.size && [...M].every((k) => c.set.has(k)) && c.nombre) nombres.push(String(c.nombre)); }
  for (const nom of nombres.slice()) { const k = normalizar(nom).replace(/^(?:todos\s+los|todas\s+las|los|las)\s+/, ""); for (const [c, sins] of Object.entries(L.SINONIMOS_DE_CONJUNTO)) if (k === c || k.includes(c) || sins.some((x) => normalizar(x) === k)) nombres.push(...sins); }
  const ln = normalizar(linea);
  return nombres.some((nom) => { const n = normalizar(nom).replace(/^(?:todos\s+los|todas\s+las|los|las)\s+/, "").replace(/\s*\(.*$/, "").trim(); return n.length >= 3 && ln.includes(n); });
}

/* la mención nombra por su concepto exacto una métrica CORTA (contribución) y el hecho es una LARGA cuyo nombre la contiene (contribución no capturada):
 * el ancla tiene que traer el calificador o un concepto de la larga; si no, {corta, larga} */
function _familiaLarga(mt, clavesHecho, sp) {
  const spN = normalizar(sp);
  const dicha = L.claveDeMetrica(mt.texto);
  if (!dicha || clavesHecho.has(dicha)) return null;
  const mA = L.metricaPorClave(dicha); if (!mA) return null;
  const nA = normalizar(mA.nombre);
  for (const kB of clavesHecho) {
    const mB = L.metricaPorClave(kB); if (!mB || kB === dicha) continue;
    const nB = normalizar(mB.nombre);
    if (!nB.includes(nA) || nB === nA) continue;
    const calificador = nB.replace(nA, "").trim();
    const presente = (calificador && spN.includes(calificador)) || mB.conceptos.some((c) => c !== nA && spN.includes(normalizar(c)));
    if (!presente) return { corta: dicha, larga: kB };
  }
  return null;
}
/* las cifras que el modelo escribió dentro de un ancla se reemplazan por el canon del hecho que las porta (misma unidad, mismo valor a su precisión) */
function _reemplazarCifras(inner, hechos) {
  if (!hechos.length) return inner;
  const nums = _numerosEn(_sinPlaceholders(inner)).filter((n) => !n.enPalabras && !n.fraccion && !_cotaAntes(inner, n.ini)).sort((a, b) => b.ini - a.ini);
  let out = inner;
  for (const n of nums) {
    const x = hechos.flatMap((h) => h.numeros).find((y) => Number.isFinite(y.raw) && y.texto && _u(y.unidad) === _u(n.unidad) && mismoValor({ texto: n.texto, raw: n.raw, unidad: n.unidad, canon: n.canon }, y.raw, y.unidad, y.texto));
    if (!x || !x.texto || x.texto === n.texto) continue;
    out = out.slice(0, n.ini) + x.texto + out.slice(n.fin);
  }
  return out;
}
/* la entidad DUEÑA de una cifra escrita dentro de un ancla: coordinación («A y B … X e Y» → la k-ésima cifra es de la k-ésima entidad) o el segmento
 * («A (métrica X · métrica Y)»: la última entidad antes de la cifra sin «)», «;» ni «|» entre medio; si ninguna precede, la que sigue) */
function _duenaDeLaCifra(sp, ents, nums, n) {
  const distintas = []; for (const e of ents) if (!distintas.some((x) => x.k === e.k)) distintas.push(e);
  const mismos = nums.filter((x) => _u(x.unidad) === _u(n.unidad) && !x.enPalabras);
  if (distintas.length >= 2 && mismos.length === distintas.length && distintas.every((e) => e.fin <= mismos[0].ini)) { const i = mismos.findIndex((x) => x.ini === n.ini); if (i >= 0) return distintas[i]; }
  const antes = ents.filter((e) => e.fin <= n.ini).sort((a, b) => b.fin - a.fin);
  for (const e of antes) { const entre = sp.slice(e.fin, n.ini); if (/[;|)]/.test(entre) || /\n/.test(entre)) break; return e; }
  const despues = ents.filter((e) => e.ini >= n.fin).sort((a, b) => a.ini - b.ini)[0];
  if (despues && !/[;|(]/.test(sp.slice(n.fin, despues.ini)) && _palabras(sp.slice(n.fin, despues.ini)).length <= 3) return despues;
  return null;
}
/* la cota que precede a una cifra («más de», «menos de», «al menos», «hasta», «casi», «cerca de», «apenas», «poco más de») */
const _cotaAntes = (t, pos) => { const antes = normalizar(t.slice(Math.max(0, pos - 24), pos)); const m = /(?:^|\s)(mas de|por encima de|superior a|menos de|por debajo de|inferior a|al menos|como minimo|desde|hasta|como maximo|a lo sumo|casi|cerca de|apenas|poco mas de|alrededor de|unos|unas)\s*(?:los\s+|las\s+|un\s+|una\s+)?$/.exec(antes); return m ? _cotaDe(m[1]) : null; };
const _cotaDe = (w) => { const s = normalizar(w); if (/^(?:mas de|por encima de|superior a)$/.test(s)) return ">"; if (/^(?:menos de|por debajo de|inferior a)$/.test(s)) return "<"; if (/^(?:al menos|como minimo|desde)$/.test(s)) return ">="; if (/^(?:hasta|como maximo|a lo sumo)$/.test(s)) return "<="; if (/^(?:casi|cerca de|apenas|poco mas de|alrededor de|unos|unas)$/.test(s)) return "~"; return null; };
const _ordinalANumero = (t) => { const s = normalizar(t).replace(/^(?:el|la|los|las|un|una|es)\s+/, ""); if (/despu|sigue/.test(s)) return 2; const m = /^(\d{1,2})/.exec(s); if (m) return +m[1]; const T = { primer: 1, segund: 2, tercer: 3, cuart: 4, quint: 5, sext: 6, septim: 7, octav: 8, noven: 9, decim: 10 }; for (const k of Object.keys(T)) if (s.startsWith(k)) return T[k]; return null; };

/* ═══ helpers v3.1 (turno) ═══ */
const _RE_RETRACTACION = /(?<![a-záéíóúñ])(?:no\s+es\s+as[ií]|en\s+realidad\s+no|es\s+falso|no\s+es\s+cierto|no\s+es\s+verdad|no\s+lo\s+es|ya\s+no\s+lo\s+est[aá]|eso\s+no\s+es)(?![a-záéíóúñ])/gi;
const _RE_RECOMENDACION = /(?<![a-záéíóúñ])(?:yo\s+(?:le\s+|les\s+)?(?:ampliar|recortar|priorizar|cobrar|pedir|dar|subir|bajar|cortar|abrir|cerrar|liberar|empezar|partir|ir|renegociar|exigir|suspender|apretar|soltar)[ií]a(?:n|s|mos)?|(?:te\s+)?recomiendo|conviene|convendr[ií]a|deber[ií]as|habr[ií]a\s+que|sugiero|propongo|sin\s+dudarlo)(?![a-záéíóúñ])/i;
const _EJE_DE_SUST = { cliente: "cliente", cuenta: "cliente", sku: "sku", producto: "sku", marca: "marca", familia: "familia", bodega: "bodega", canal: "canal" };
const _numeroDePalabra = (w) => { const s = normalizar(w); if (/^\d+$/.test(s)) return +s; const T = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 }; return T[s] != null ? T[s] : null; };
const _esTasaH = (h) => h.tipo === "razon" || h.numeros.some((n) => n.unidad === "pct") || /%/.test(String((h.render && h.render.valor) || "")) || [...h.claves].some((c) => c === "participacion");
/* la base de una participación es el universo de su fig («LG-DRYER8KG · % del total» del capital frenado) */
const _baseDeParticipacion = (h) => { if (![...h.claves].some((c) => c === "participacion")) return null; const f = h._fig || null; const ctx = f ? String(f.context || (f.fig && f.fig.context) || f.universo || (f.fig && f.fig.universo) || f.calificador || "") : ""; return ctx ? (L.claveDeMetrica(ctx) || null) : null; };
const _baseH = (h) => (h.tipo === "razon" && h.roles.den ? (L.claveDeMetrica(String(h.roles.den.label || "").split(" · ").slice(1).join(" · ")) || null) : ([...h.claves].map((c) => BASE_DE_TASA[c]).find(Boolean) || _baseDeParticipacion(h) || null));
/* la razón real (0–1) que respalda una proporción dicha: razón (su %), conteo (n/m), relación fracción (k), grupo (su suma sobre el total del negocio de esa métrica) */
function _ratioDe(h, I) {
  if (h.tipo === "razon") { const p = h.numeros.find((n) => n.unidad === "pct"); if (p) return p.raw / 100; const v = _numerosEn(String((h.render && h.render.valor) || ""))[0]; return v && v.unidad === "pct" ? v.raw / 100 : null; }
  if (h.tipo === "conteo") { const n = +(h.render && h.render.n), m = +(h.render && h.render.m); return Number.isFinite(n) && Number.isFinite(m) && m > 0 ? n / m : null; }
  if (h.tipo === "relacion" && /fraccion|parte/.test(h.direccion || "") && h.render && Number.isFinite(+h.render.k)) return +h.render.k;
  if (h.tipo === "grupo" && I) { const clave = [...h.claves][0]; const v = _numerosEn(String((h.render && h.render.valor) || ""))[0]; if (!clave || !v || !Number.isFinite(v.raw)) return null; let fs = []; try { fs = I.buscarFigs("negocio", L.metricaDeClave(clave)); } catch { fs = []; } const tot = fs.find((g) => Number.isFinite(g.raw) && g.raw > 0 && unidadCompatible(g.unidad) === unidadCompatible(v.unidad)); return tot ? v.raw / tot.raw : null; }
  return null;
}
/* el cociente real de una relación «veces» (sujeto ÷ comparado) desde sus figs de evidencia */
function _cocienteDe(h, I) { const labs = (h.evidencia || []).slice(0, 2); if (labs.length < 2) return null; const fa = I.figs.find((g) => normalizar(g.label) === normalizar(labs[0])), fb = I.figs.find((g) => normalizar(g.label) === normalizar(labs[1])); if (!fa || !fb || !Number.isFinite(fa.raw) || !Number.isFinite(fb.raw) || fb.raw === 0) return null; return fa.raw / fb.raw; }
/* el encabezado markdown más cercano por encima de una posición */
function _encabezadoDe(s, pos) {
  const antes = s.slice(0, pos).split("\n");
  const propia = antes[antes.length - 1] || "";
  const sangria = (l) => (l.match(/^\s*/) || [""])[0].length;
  for (let i = antes.length - 2; i >= 0; i--) {
    const m = /^\s*#{1,6}\s+(.+)$/.exec(antes[i]); if (m) return m[1];
    /* la viñeta padre (menos sangrada, sin cifra ni placeholder): «- **Valparaíso**» gobierna lo que cuelga de ella */
    const mv = /^(\s*)[-*•]\s+\*{0,2}([^*{}\d\n]{2,60}?)\*{0,2}\s*:?\s*$/.exec(antes[i]);
    if (mv && sangria(antes[i]) < sangria(propia) && /^\s*[-*•]/.test(propia)) return mv[2];
  }
  return null;
}

/* ═══ geometría: tramos (celda · viñeta · oración), entidades con posición, blanqueo ═══ */
function _tramos(s) {
  const out = [];
  let off = 0, parrafo = 0;
  for (const linea of s.split("\n")) {
    if (!linea.trim()) { parrafo++; off += linea.length + 1; continue; }
    const esTabla = /^\s*\|/.test(linea), esLista = /^\s*(?:[-*•]|\d+[.)])\s+/.test(linea);
    if (esTabla) {
      const re = /\|([^|]*)/g; let m;
      while ((m = re.exec(linea))) { const t = m[1]; const lead = t.length - t.trimStart().length; const txt = t.trim(); if (txt) out.push({ ini: off + m.index + 1 + lead, fin: off + m.index + 1 + lead + txt.length, texto: txt, tipo: "celda", linea: off, lineaTexto: linea, parrafo }); }
    } else {
      const re = /[^.;!?]+(?:[.;!?](?!\s+(?:[A-ZÁÉÍÓÚÑ¿¡«"(]|\{\{|⟦))[^.;!?]*)*[.;!?]?/g; let m;
      while ((m = re.exec(linea))) { const t = m[0]; if (!m[0].length) { re.lastIndex++; continue; } if (!t.trim()) continue; const lead = t.length - t.trimStart().length; out.push({ ini: off + m.index + lead, fin: off + m.index + t.length, texto: t.trim(), tipo: esLista ? "vineta" : "oracion", linea: off, lineaTexto: linea, parrafo }); }
    }
    off += linea.length + 1;
  }
  return out;
}
const _normPos = (t) => { const n = String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); return n.length === String(t || "").length ? n : String(t || "").toLowerCase(); };
function _entidadesEn(texto, nombres, alias) {
  const out = [];
  const t = _normPos(texto);
  const candidatos = [...nombres.map((n) => [n, n]), ...Object.entries(alias || {})];
  for (const [forma, nombre] of candidatos) {
    const k = _normPos(String(forma).trim()); if (!k) continue;
    const re = new RegExp("(?<![a-z0-9áéíóúñ])" + _esc(k).replace(/\s+/g, "\\s+") + "(?![a-z0-9áéíóúñ])", "g"); let m;
    while ((m = re.exec(t))) out.push({ nombre, k: normalizar(nombre), ini: m.index, fin: m.index + m[0].length });
  }
  out.sort((a, b) => a.ini - b.ini || b.fin - a.fin);
  const limpio = []; for (const e of out) if (!limpio.some((x) => e.ini >= x.ini && e.fin <= x.fin && x !== e)) limpio.push(e);
  return limpio;
}
const _blanquear = (s, tramos) => { let out = s; for (const t of tramos) out = out.slice(0, t.ini) + _BLANCO.repeat(t.fin - t.ini) + out.slice(t.fin); return out; };
const _sinPlaceholders = (t) => t.replace(new RegExp(_RE.placeholder.source, "gi"), (m0) => _BLANCO.repeat(m0.length));
const _palabras = (t) => normalizar(t).replace(/[^a-z0-9ñ ]+/g, " ").split(/\s+/).filter(Boolean);
const _COPULA = new Set(["es", "son", "fue", "era", "de", "del", "la", "el", "los", "las", "un", "una", "y", "o", "e", "u", "que", "con", "en", "a", "al", "su", "sus", "lo", "esta", "este", "esa", "ese", "para"]);
const _tokensAntes = (s, pos, n) => _palabras(s.slice(Math.max(0, pos - 80), pos)).slice(-n);
const _tokensDespues = (s, pos, n) => _palabras(s.slice(pos, pos + 80)).slice(0, n);

/* las palabras de métrica de un texto, con posición y las claves de la casa que nombran; las genéricas de cobranza («debe», «deuda», «saldo»)
 * nombran cualquier saldo, las específicas («pendiente», «vencido») uno solo */
function _clavesDeVentana(win, claves) {
  const w = normalizar(win);
  const out = new Set();
  for (const k of claves) {
    if (k.startsWith("lex:")) { out.add(k.slice(4)); continue; }   // una clave del léxico (conceptos de lexico.js) llega entera
    if (k === "pendiente" && !/pendiente/.test(w)) { for (const c of L.CLAVES_GENERICAS_DE_COBRANZA) out.add(c); continue; }
    for (const c of L.clavesPorPalabraDelMuro(k)) out.add(c);
  }
  return out;
}
/* las claves que nombra un texto: el muro de la evidencia (metricasEn) y los conceptos del léxico (claveDeMetrica por concepto exacto) */
const _clavesEn = (win0) => { const win = String(win0 || "").replace(/\s+(?:de|del|de\s+la|de\s+los|de\s+las)\s+□+\s+/g, " "); let c = null; try { c = metricasEn(win); } catch { c = null; } const out = new Set(c ? [...c] : []); const k = L.claveDeMetrica(win); if (k && L.CLAVES_DE_METRICA.some((m) => m.clave === k && m.conceptos.includes(normalizar(win)))) { const fam = new Set(["lex:" + k]); const nk = normalizar(win); for (const m of L.CLAVES_DE_METRICA) if (m.clave !== k && normalizar(m.nombre).startsWith(nk + " ")) fam.add("lex:" + m.clave); return fam; } return out; };   // …y su familia larga («variación vs año anterior en $»): la comprobación de familia exige el calificador   // un concepto exacto del léxico es el ÚNICO dueño de la mención («brecha al benchmark» no es «brecha por precio y costo»)
function _metricasConPosicion(texto) {
  const out = [];
  const re = /[a-záéíóúñ]+/gi; const toks = []; let m;
  while ((m = re.exec(texto))) toks.push({ w: m[0], ini: m.index, fin: m.index + m[0].length });
  const usados = new Set();
  for (const modo of ["lex", "muro"]) for (let n = 4; n >= 1; n--) {   // primero las ventanas con concepto exacto del léxico, después las del muro
    for (let i = 0; i + n <= toks.length; i++) {
      if ([...Array(n).keys()].some((j) => usados.has(i + j))) continue;
      const win = texto.slice(toks[i].ini, toks[i + n - 1].fin);
      const claves = _clavesEn(win);
      if (!claves || !claves.size) continue;
      if (modo === "lex" && ![...claves].some((k) => k.startsWith("lex:"))) continue;
      if (n > 1 && modo === "muro") { const solo = [...claves].filter((k) => { const c1 = _clavesEn(toks[i].w), cN = _clavesEn(toks[i + n - 1].w); return !(c1.has(k) || cN.has(k)); }); if (!solo.length) continue; }   // en la pasada léxica el concepto exacto más largo gana
      /* la ventana MÍNIMA que nombra las mismas claves: la máscara de la casa no se traga las palabras de al lado («duplica el capital frenado») */
      let a = i, b = i + n - 1;
      const mismas = (x, y) => { const c = _clavesEn(texto.slice(toks[x].ini, toks[y].fin)); return c.size === claves.size && [...claves].every((k) => c.has(k)); };
      while (a < b && mismas(a + 1, b)) a++;
      while (b > a && mismas(a, b - 1)) b--;
      out.push({ ini: toks[a].ini, fin: toks[b].fin, texto: texto.slice(toks[a].ini, toks[b].fin), muro: [...claves], claves: _clavesDeVentana(texto.slice(toks[a].ini, toks[b].fin), claves) });
      for (let j = a; j <= b; j++) usados.add(j);
    }
  }
  return out.sort((a, b) => a.ini - b.ini);
}
const _numerosEn = (texto) => {
  const out = []; const t = menosAscii(texto);
  for (const f of parseFigures(t)) { let p = t.indexOf(f.text); while (p >= 0) { if (!out.some((x) => x.ini === p)) out.push({ ini: p, fin: p + f.text.length, texto: f.text, raw: f.raw, unidad: f.unit, canon: f.canon }); p = t.indexOf(f.text, p + 1); } }
  const re = /(?<![\d.,$%\w\-])(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)(?![\d.,]*(?:%|pp|[KMBx]\b))(?![a-záéíóúñ0-9\-])/gi; let m;
  while ((m = re.exec(t))) if (!out.some((x) => m.index >= x.ini && m.index < x.fin)) { const raw = /^\d{1,3}(?:[.,]\d{3})+$/.test(m[1]) ? parseInt(m[1].replace(/[.,]/g, ""), 10) : parseFloat(m[1].replace(",", ".")); out.push({ ini: m.index, fin: m.index + m[0].length, texto: m[0], raw, unidad: "count", canon: null, pelado: true }); }
  _RE.numeroPalabra.lastIndex = 0; while ((m = _RE.numeroPalabra.exec(t))) { if (/^(?:un|una)\s/i.test(m[0]) && !/(?:solo|apenas|solamente|[uú]nicamente)\s+$/i.test(t.slice(Math.max(0, m.index - 14), m.index))) continue; const v = _valorEnPalabras(m[0]); if (v) out.push({ ini: m.index, fin: m.index + m[0].length, texto: m[0], raw: v.raw, unidad: v.unidad, canon: null, enPalabras: true, matiz: v.matiz }); }
  for (const ma of t.matchAll(/(?<![a-záéíóúñ])(?:(?:el|un|todo\s+el)\s+a[ñn]o\s+(?:entero|completo)|todo\s+el\s+a[ñn]o)(?![a-záéíóúñ])/gi)) if (!out.some((x) => x.ini === ma.index)) out.push({ ini: ma.index, fin: ma.index + ma[0].length, texto: ma[0], raw: 365, unidad: "days", canon: null, enPalabras: true, matiz: null });
  _RE.fraccionPalabra.lastIndex = 0; while ((m = _RE.fraccionPalabra.exec(t))) { const v = _fraccionEnPalabras(m[0]); if (v != null) out.push({ ini: m.index, fin: m.index + m[0].length, texto: m[0], raw: v * 100, unidad: "pct", canon: null, enPalabras: true, fraccion: true }); }
  return out.sort((a, b) => a.ini - b.ini);
};
function _valorEnPalabras(frase) {
  const s = normalizar(frase);
  const matiz = /^(casi|apenas|mas de|menos de|poco mas de|cerca de)\s+/.exec(s);
  const cuerpo = matiz ? s.slice(matiz[0].length) : s;
  let n = 0, unidad = "count", ok = false;
  for (const w of cuerpo.split(/\s+/)) {
    if (L.NUMEROS_EN_PALABRAS[w] != null) { const v = L.NUMEROS_EN_PALABRAS[w]; if (v >= 1000) n = (n || 1) * v; else n += v; ok = true; continue; }
    if (/^(?:millones?|mil)$/.test(w)) { n = (n || 1) * (w === "mil" ? 1000 : 1e6); continue; }
    if (/^por$/.test(w)) continue; if (/^ciento$/.test(w) || /^%$/.test(w)) { unidad = "pct"; continue; }
    if (/^(?:puntos?|pp|porcentuales)$/.test(w)) { unidad = "pp"; continue; }
    if (/^d[ií]as?$/.test(w)) { unidad = "days"; continue; }
    if (/^(?:veces|x)$/.test(w)) { unidad = "ratio"; continue; }
    if (/^(?:semanas?|meses|mes|trimestres?|semestres?|anos?)$/.test(w)) { const d = L.diasDe(n, w); if (d != null) { n = d; unidad = "days"; } continue; }
    if (/^[km]$/.test(w) || /^\$$/.test(w)) { unidad = "money"; continue; }
  }
  if (!ok) return null;
  if (unidad === "count" && n >= 1000) unidad = "money";
  return { raw: n, unidad, matiz: matiz ? matiz[1] : "" };
}
function _fraccionEnPalabras(frase) {
  const s = normalizar(frase);
  if (/mitad/.test(s)) return 0.5; if (/dos tercios/.test(s)) return 2 / 3; if (/un tercio/.test(s)) return 1 / 3; if (/tres cuartos/.test(s)) return 0.75; if (/un cuarto/.test(s)) return 0.25;
  const m = /^(uno|dos|tres) de cada (dos|tres|cuatro|cinco|diez)$/.exec(s); if (m) return L.NUMEROS_EN_PALABRAS[m[1]] / L.NUMEROS_EN_PALABRAS[m[2]];
  return null;
}
const _estadosEnSpan = (texto, re = _RE_ESTADO) => { const out = []; re.lastIndex = 0; let m; while ((m = re.exec(texto))) { const c = estadoCanon(m[0]); if (ESTADOS_CANON.has(c)) out.push({ canon: c, ini: m.index, fin: m.index + m[0].length, texto: m[0] }); } return out; };
const _hay = (re, t) => { re.lastIndex = 0; return re.test(t); };
/* la casa se reconoce a sí misma primero: los nombres de métrica (coincidencia más larga) enmascaran lo que vive dentro de ellos */
const _mascaraDeLaCasa = (texto) => _metricasConPosicion(texto).filter((mt) => (/\s/.test(mt.texto.trim()) || mt.claves.size) && (/\s/.test(mt.texto.trim()) || !(_hay(_RE.variacion, mt.texto) || _hay(_RE.comparativo, mt.texto) || _hay(_RE.superlativo, mt.texto))));
const _fueraDeLaCasa = (lista, mascara) => lista.filter((x) => !mascara.some((m) => m.ini <= x.ini && x.fin <= m.fin));
const _todos = (re, t) => { const out = []; re.lastIndex = 0; let m; while ((m = re.exec(t))) { out.push({ ini: m.index, fin: m.index + m[0].length, texto: m[0] }); if (!m[0].length) re.lastIndex++; } return out; };
const _dentroDe = (x, lista) => lista.some((y) => x.ini >= y.ini && x.fin <= y.fin);

/* ═══ LAS COMPROBACIONES ═══ */
/** comprobarAnclas(prosa, libro, { nombres, alias }) → { ok, violations: [{kind, detail, texto, ids}], medidas, servido, faltantes } */
export function comprobarAnclas(prosa, libro, ctx = {}) {
  const s = String(prosa || "");
  const V = [];
  const veto = (kind, detail, texto = "", ids = []) => { V.push({ kind, detail: `${kind}: ${detail}`, texto: String(texto || "").replace(new RegExp(_BLANCO, "g"), "").slice(0, 80), ids }); };
  const I = libro && libro.indice;
  if (I && libro && Array.isArray(libro.hechos)) for (const h of libro.hechos) if (!h._fig && Array.isArray(h.evidencia) && h.evidencia.length === 1) h._fig = I.figs.find((g) => normalizar(g.label) === normalizar(h.evidencia[0])) || null;
  const nombres = Array.isArray(ctx.nombres) && ctx.nombres.length ? ctx.nombres : (I ? [...I.entidades.values()].map((e) => e.nombre) : []);
  const alias = ctx.alias && typeof ctx.alias === "object" ? ctx.alias : {};
  const ejeDe = (k) => { try { const r = I && I.resolverEntidad(k); return r ? r.eje : null; } catch { return null; } };
  const P = parsearAnclas(s);
  for (const e of P.errores) veto("ancla-mal-formada", e.detail.replace(/^ancla-mal-formada:\s*/, ""), s.slice(e.ini, e.fin));
  const H = (id) => (libro && libro.porId ? libro.porId.get(String(id)) : null);

  /* 1 · forma */
  const unidades = [];
  for (const a of P.anclas) {
    const hechos = [];
    for (const id of a.ids) { const Hh = H(id); if (!Hh) { veto("hecho-desconocido", `«${id}» no está en el libro de hechos`, a.inner, [id]); continue; } if (!Hh.ok) { veto("hecho-invalido", `«${id}» ${Hh.veredicto === "falsa" ? "es FALSO" : "no es verificable"} (${Hh.motivo.slice(0, 120)}) y no puede anclarse`, a.inner, [id]); continue; } hechos.push(Hh); }
    for (const p of a.placeholders) { const Hh = H(p.id); if (!Hh) { veto("hecho-desconocido", `{${p.id}} no está en el libro`, a.inner, [p.id]); continue; } if (!Hh.ok) { veto("hecho-invalido", `{${p.id}} ${Hh.veredicto === "falsa" ? "es FALSO" : "no es verificable"} y no puede escribirse`, a.inner, [p.id]); continue; } if (renderDe(libro, p.id, p.campo) == null) veto("placeholder-sin-render", `{${p.id}.${p.campo}} no tiene valor que escribir`, a.inner, [p.id]); if (!a.ids.includes(p.id)) hechos.push(Hh); }
    for (const p of a.placeholders) if (p.campo === "m" && !a.placeholders.some((q) => q.id === p.id && q.campo === "n") && !(H(p.id) && H(p.id).render && H(p.id).render.n != null && new RegExp("(?<![\\d.,])" + String(H(p.id).render.n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\d.,])").test(_sinPlaceholders(a.inner)))) veto("m-sin-n", `{${p.id}.m} (el tamaño del universo) solo se escribe junto a {${p.id}.n}: «{n} de {m}»`, a.inner, [p.id]);
    unidades.push({ ...a, hechos: [...new Map(hechos.map((h) => [h.id, h])).values()], tipo: "ancla" });
  }
  for (const p of P.sueltos) {
    const Hh = H(p.id);
    if (!Hh) { veto("hecho-desconocido", `{${p.id}} no está en el libro`, s.slice(p.ini, p.fin), [p.id]); continue; }
    if (!Hh.ok) { veto("hecho-invalido", `{${p.id}} ${Hh.veredicto === "falsa" ? "es FALSO" : "no es verificable"} y no puede escribirse`, s.slice(p.ini, p.fin), [p.id]); continue; }
    if (renderDe(libro, p.id, p.campo) == null) veto("placeholder-sin-render", `{${p.id}.${p.campo}} no tiene valor que escribir`, s.slice(p.ini, p.fin), [p.id]);
    if (p.campo === "m") veto("m-sin-n", `{${p.id}.m} suelto: el tamaño del universo solo se escribe junto a {${p.id}.n}`, s.slice(p.ini, p.fin), [p.id]);
    unidades.push({ ini: p.ini, fin: p.fin, ids: [p.id], inner: s.slice(p.ini, p.fin), innerIni: p.ini, innerFin: p.fin, placeholders: [p], hechos: [Hh], tipo: "suelto" });
  }
  unidades.sort((a, b) => a.ini - b.ini);
  const tramos = _tramos(s);
  const tramoDe = (pos) => tramos.find((t) => pos >= t.ini && pos < t.fin) || null;
  for (const u of unidades) u.tramo = tramoDe(u.ini);
  for (let i = 0; i < unidades.length; i++) unidades[i].prev = i > 0 && unidades[i - 1].tramo === unidades[i].tramo ? unidades[i - 1] : null;   // el ancla anterior del mismo tramo (elipsis del verbo)
  const estructura = (() => { try { return duenosEstructurales(s, nombres); } catch { return []; } })();
  const duenoEstructural = (pos) => { const t = estructura.find((x) => x.dueno && pos >= x.ini && pos < x.fin); return t ? { nombre: t.dueno, k: normalizar(t.dueno), tipo: t.tipo, metrica: t.metrica } : null; };
  const libre = _blanquear(s, unidades);
  const enUnidad = (pos) => unidades.some((u) => pos >= u.ini && pos < u.fin);

  /* 3 · fuera de las anclas no hay léxico de hecho */
  const tramoTieneHecho = (t) => unidades.some((u) => u.tramo === t);
  for (const t of tramos) {
    const lt = libre.slice(t.ini, t.fin);
    const prevT = tramos[tramos.indexOf(t) - 1]; const prevTieneHecho = !!(prevT && prevT.parrafo === t.parrafo && tramoTieneHecho(prevT));
    if (!lt.replace(new RegExp(_BLANCO, "g"), "").trim() || /^\s*\|?\s*:?-{2,}/.test(t.texto)) continue;
    const ents = _entidadesEn(lt, nombres, alias);
    const ltSinEnt = _blanquear(lt, ents);
    const contexto = t.tipo === "celda" ? t.lineaTexto : lt;
    const conCasa = _entidadesEn(contexto, nombres, alias).length || _hay(_RE.verboCasa, contexto) || _metricasConPosicion(contexto).length || duenoEstructural(t.ini) || tramoTieneHecho(t) || (t.tipo === "celda" && /\{/.test(t.lineaTexto));
    /* números */
    _RE.digito.lastIndex = 0; let m;
    while ((m = _RE.digito.exec(ltSinEnt))) {
      const frag = m[0]; if (!/\d/.test(frag)) continue;
      if (/^\s*\d{1,2}\s*[.)·]\s/.test(lt.slice(m.index)) && /^\s*$/.test(lt.slice(0, m.index))) continue;   // enumerador («1.», «1)», «1 ·»)
      if (/\b(?:19|20)\d\d\b/.test(frag)) continue;   // año
      if (/^\s*\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)/i.test(lt.slice(m.index))) continue;   // fecha
      veto("hecho-sin-ancla", `la cifra «${frag.trim()}» está fuera de un ancla`, lt.slice(Math.max(0, m.index - 30), m.index + frag.length + 20));
    }
    for (const x of _todos(_RE.numeroPalabra, ltSinEnt)) if (!_hay(_RE.modismo, lt.slice(Math.max(0, x.ini - 12), x.fin + 12))) veto("hecho-sin-ancla", `«${x.texto}» es una cifra en palabras fuera de un ancla`, lt.slice(Math.max(0, x.ini - 30), x.fin + 20));
    if (conCasa) for (const x of _todos(_RE.fraccionPalabra, ltSinEnt)) veto("hecho-sin-ancla", `«${x.texto}» es una proporción fuera de un ancla`, lt.slice(Math.max(0, x.ini - 30), x.fin + 20));
    const _casa = _mascaraDeLaCasa(ltSinEnt);
    const _esTitulo = /^\s*#{1,6}\s/.test(t.lineaTexto || "");
    for (const x of _fueraDeLaCasa(_estadosEnSpan(ltSinEnt, _RE_ESTADO_PROSA), _casa)) veto("hecho-sin-ancla", `«${x.texto}» es un estado de la casa fuera de un ancla`, lt.slice(Math.max(0, x.ini - 30), x.fin + 20));
    if (tramoTieneHecho(t)) {
      /* una métrica pegada a un ancla de cláusula («{{r1: Tottus tiene $1.9M}} vencidos») es del hecho y tiene que ir dentro del ancla */
      const clausulas = unidades.filter((u) => u.tramo === t && u.tipo !== "suelto");
      for (const mt of _metricasConPosicion(ltSinEnt).filter((x) => x.claves.size)) {
        const pegadaDespues = clausulas.some((u) => { if (u.fin > t.ini + mt.ini) return false; const gap = s.slice(u.fin, t.ini + mt.ini); return /^\s?$/.test(gap.replace(/[}⟧]/g, "")) && gap.length <= 2; });
        const pegadaAntes = clausulas.some((u) => { if (u.ini < t.ini + mt.fin) return false; const gap = s.slice(t.ini + mt.fin, u.ini); return /^\s?$/.test(gap.replace(/[{⟦]/g, "")) && gap.length <= 2; });
        if (pegadaDespues || pegadaAntes) veto("hecho-sin-ancla", `«${mt.texto}» nombra una métrica pegada a un ancla: va dentro del ancla del hecho que la dice`, lt.slice(Math.max(0, mt.ini - 30), mt.fin + 20));
      }
      /* la base de una tasa dicha justo después del ancla va dentro del ancla */
      for (const u of clausulas) {
        if (!u.hechos.some(_esTasaH)) continue;
        const tras = s.slice(u.fin, Math.min(s.length, u.fin + 70));
        const mB2 = new RegExp("^\\s*(?:[,;]\\s*)?(?:(?:medid[oa]s?|calculad[oa]s?|tomad[oa]s?|contad[oa]s?|siempre|todo)\\s+)?(?:" + L.PREPOSICION_DE_BASE_SRC + ")\\s+", "i").exec(tras);
        if (!mB2) continue;
        const restoB = tras.slice(mB2[0].length, mB2[0].length + 40);
        if (/^\s*(?:los|las|l[oa]s\s+)?\$?\d/.test(restoB)) continue;   // «de los 13»: partitivo
        if (_entidadesEn(restoB.slice(0, 30), nombres, alias).some((e) => e.ini <= 1)) continue;   // «de Lider»: el dueño, no la base
        if (/^\s*\{/.test(restoB)) continue;   // «de {h.base}»: la casa la escribe
        veto("hecho-sin-ancla", `«${tras.slice(0, mB2[0].length + 24).trim()}…» dice la base de ${u.hechos.map((h) => h.id).join(", ")} fuera del ancla: la base de una tasa va dentro del ancla`, tras.slice(0, 60));
      }
      for (let k = 0; k + 1 < clausulas.length; k++) {
        const u1 = clausulas[k], u2 = clausulas[k + 1]; const gap = s.slice(u1.fin, u2.ini);
        if (!/^\s*(?:junto\s+con|junto\s+a|al\s+igual\s+que|igual\s+que|como)\s*$/i.test(gap.replace(/[{}⟦⟧]/g, ""))) continue;
        const b1 = _entidadesEn(s.slice(u1.ini, u1.fin), nombres, alias).filter((e) => ejeDe(e.k) === "bodega")[0] || null;
        if (!b1 || !I) continue;
        for (const h of u2.hechos) { const sj = h.roles.sujetos[0]; if (!sj || sj === "negocio") continue; let props = []; try { props = I.estadosDe(sj) || []; } catch { props = []; } const bod = [...new Set(props.map((p) => normalizar(String(p.bodega || ""))).filter(Boolean))]; if (bod.length && !bod.includes(b1.k)) veto("bodega-ajena", `«junto con» pega ${b1.nombre} a ${sj} y ${sj} está en ${bod.join("/")}`, s.slice(u1.ini, u2.fin).slice(0, 80), [h.id]); }
      }
      for (const e of ents) if (ejeDe(e.k) === "bodega" && !unidades.some((u) => u.tramo === t && u.hechos.some((h) => [...h.roles.sujetos, ...h.roles.miembros, ...h.roles.vs].map(normalizar).includes(e.k) || normalizar(String((h.roles && h.roles.bodega) || "")) === e.k || (h.universoTipado && normalizar(String(h.universoTipado.bodega || "")) === e.k)))) veto("hecho-sin-ancla", `«${e.nombre}» (bodega) está fuera de un ancla: la bodega es un hecho`, lt.slice(Math.max(0, e.ini - 30), e.fin + 20));
      if (ents.length && /(?<![a-záéíóúñ])(?:donde\s+figura|figura|figuran|entre\s+ell[oa]s|incluid[oa]s?|forma\s+parte|forman\s+parte|est[aá]n?\s+entre|aparecen?)(?![a-záéíóúñ])/i.test(ltSinEnt)) veto("predicacion-sin-hecho", `«${t.texto.trim().slice(0, 60)}» dice de ${ents.map((e) => e.nombre).join(", ")} una pertenencia fuera de un ancla`, lt.slice(0, 80));
    }
    if (unidades.some((u) => u.tramo && u.tramo.parrafo === t.parrafo)) for (const x of _todos(_RE_RETRACTACION, ltSinEnt)) veto("hecho-sin-ancla", `«${x.texto}» retracta o niega un hecho fuera de un ancla`, lt.slice(Math.max(0, x.ini - 30), x.fin + 20));
    if (/^\s*\[\^[^\]]+\]\s*:/.test(t.texto) && (_todos(_RE.tiempo, ltSinEnt).length || _metricasConPosicion(ltSinEnt).some((x) => x.claves.size))) veto("hecho-sin-ancla", `la nota al pie «${t.texto.trim().slice(0, 60)}» afirma un período o una métrica fuera de un ancla`, lt.slice(0, 80));
    const modismos = [..._todos(_RE.modismo, ltSinEnt), ..._casa];
    const marcas = [..._todos(_RE.superlativo, ltSinEnt).map((x) => ({ ...x, clase: "superlativo" })), ..._todos(_RE.comparativo, ltSinEnt).map((x) => ({ ...x, clase: "comparación" })), ..._todos(_RE.adjCasa, ltSinEnt).map((x) => ({ ...x, clase: "superlativo" })), ..._todos(_RE.ordinal, ltSinEnt).map((x) => ({ ...x, clase: "ordinal" })), ..._todos(_RE.variacion, ltSinEnt).filter((x) => !_CONDICIONAL.test(x.texto)).map((x) => ({ ...x, clase: "variación" })), ..._todos(_RE.duracion, ltSinEnt).map((x) => ({ ...x, clase: "duración" })), ..._todos(_RE.proporcion, ltSinEnt).map((x) => ({ ...x, clase: "proporción" }))];
    for (const x of marcas) {
      if (_dentroDe(x, modismos)) continue;
      if (_esTitulo) continue;   // un encabezado («### Venta contra el año anterior») anuncia el tema: sus marcas de clase no son afirmación
      if (x.clase === "ordinal") { const tras = _tokensDespues(lt, x.fin, 2).join(" "), antes = _tokensAntes(lt, x.ini, 2).join(" "); if (!/cuenta|cliente|sku|puesto|lugar|posici|\ben\b|\bde\b|mayor|menor|deudor|vendedor/.test(tras + " " + antes) || !conCasa) continue; }
      if (x.clase === "proporción" && _hay(_RE.proporcionSubjetiva, x.texto) && !tramoTieneHecho(t) && !prevTieneHecho) continue;   /* «Es el grueso de tu mora.» tras una oración anclada sí es hecho */
      if ((x.clase === "superlativo" || x.clase === "comparación" || x.clase === "variación" || x.clase === "proporción") && !conCasa && !(x.clase === "proporción" && prevTieneHecho)) continue;   // «Es el grueso de tu mora.» tras una oración anclada sí es hecho
      veto("hecho-sin-ancla", `«${x.texto}» (${x.clase}) está fuera de un ancla`, lt.slice(Math.max(0, x.ini - 30), x.fin + 25));
    }
  }

  /* 4s · un placeholder SUELTO lleva su cláusula: la métrica pegada antes y la base pegada después se contrastan con su hecho */
  /* el encabezado (o la viñeta padre) de bodega gobierna lo que cuelga de él: un SKU cuya bodega declarada por la proyección es otra no puede colgar ahí */
  const _cobrarEncabezadoDeBodega = (u) => {
    const enc = _encabezadoDe(s, u.ini); if (!enc || !I) return;
    const bEnc = _entidadesEn(enc, nombres, alias).filter((e) => ejeDe(e.k) === "bodega")[0]; if (!bEnc) return;
    for (const h of u.hechos) { if (!h.roles.sujetos.length || h.tipo === "lectura" || h.tipo === "propuesta" || h.roles.sujetos[0] === "negocio") continue; let props = []; try { props = I.estadosDe(h.roles.sujetos[0]) || []; } catch { props = []; } const bod = props.map((p) => normalizar(String(p.bodega || ""))).filter(Boolean); if (bod.length && !bod.includes(bEnc.k)) veto("bodega-ajena", `bajo el encabezado «${enc.trim()}» va ${h.id} y ${h.roles.sujetos[0]} está en ${[...new Set(bod)].join("/")}`, s.slice(u.ini, Math.min(u.fin, u.ini + 80)), [h.id]); }
  };
  for (const u of unidades) {
    if (u.tipo !== "suelto" || !u.hechos.length || !u.tramo) continue;
    _cobrarEncabezadoDeBodega(u);
    const h = u.hechos[0];
    if (/^(?:lectura|propuesta)$/.test(h.tipo) || !h.claves.size) continue;
    const t = u.tramo;
    const antes = s.slice(t.ini, u.ini), despues = s.slice(u.fin, t.fin);
    const antes2 = antes.replace(/[\s:·,(;]+$/, "");
    const clausulaAntes = antes2.slice(Math.max(antes2.lastIndexOf(":"), antes2.lastIndexOf("·"), antes2.lastIndexOf(","), antes2.lastIndexOf("("), antes2.lastIndexOf(";")) + 1);
    const mAntes = _metricasConPosicion(_blanquear(clausulaAntes, _entidadesEn(clausulaAntes, nombres, alias)));
    const ultima = mAntes.length ? mAntes[mAntes.length - 1] : null;
    if (ultima && ultima.claves.size && _palabras(clausulaAntes.slice(ultima.fin)).length <= 2 && ![...ultima.claves].some((c) => h.claves.has(c)) && !(h.tipo === "razon"))
      veto("metrica-ajena", `«${ultima.texto}» va pegada a {${h.id}} y ese hecho no es esa métrica (${[...h.claves].map(L.metricaDeClave).join(", ")})`, clausulaAntes + s.slice(u.ini, u.fin), [h.id]);
    const esTasa = h.tipo === "razon" || h.numeros.some((n) => n.unidad === "pct");
    if (esTasa) {
      const mB = new RegExp("^\\s*(?:[,;]\\s*)?(?:(?:medid[oa]s?|calculad[oa]s?|tomad[oa]s?|contad[oa]s?|siempre|todo)\\s+)?" + L.PREPOSICION_DE_BASE_SRC + "\\s+", "i").exec(despues);
      if (mB && !/^\s*\{/.test(despues.slice(mB[0].length))) {
        const resto = despues.slice(mB[0].length, mB[0].length + 40).replace(/^(?:la|el|lo|los|las|su|sus|toda\s+la|todo\s+el|tu|tus)\s+/i, "");
        const siguiente = (resto.match(/^[a-záéíóúñ]+/i) || [""])[0];
        const mBase = _metricasConPosicion(resto.slice(0, 32)).filter((x) => x.ini <= siguiente.length + 1);
        const baseH = _baseH(h);
        if (!mBase.length && /^(?:que|todo|toda|tod[oa]s)$/i.test(siguiente)) veto("base-sin-metrica", `«${mB[0].trim()} ${resto.slice(0, 24).trim()}…» dice la base de {${h.id}} sin vocabulario de la casa (usa la métrica o {${h.id}.base})`, s.slice(u.ini, u.fin) + despues.slice(0, 40), [h.id]);
        else if (mBase.length && baseH && !mBase.some((x) => x.claves.has(baseH)) && !(baseH === "ventas_anterior" && mBase.some((x) => x.claves.has("ventas")))) veto("base-ajena", `«${mB[0].trim()} ${siguiente}» no es la base de ${h.id} (${L.metricaDeClave(baseH).toLowerCase()})`, s.slice(u.ini, u.fin) + despues.slice(0, 40), [h.id]);
      }
    }
  }
  /* 4 · dentro del ancla, solo lo que dicen sus hechos */
  for (const u of unidades) {
    if (u.tipo === "suelto" || !u.hechos.length) continue;
    const span = u.inner;
    const sp = _sinPlaceholders(span);
    const roles = new Set(), claves = new Set(), estados = new Set(), dominios = new Set(), numeros = [];
    for (const h of u.hechos) {
      for (const e of h.entidades) roles.add(e);
      for (const c of h.claves) { claves.add(c); const d = L.dominioDeClave(c); if (d) dominios.add(d); }
      if (h.dominio) dominios.add(h.dominio);
      if (h.estado) { estados.add(h.estado); for (const c of L.METRICAS_DE_ESTADO[h.estado] || []) claves.add(c); }
      if (h.estadosDelUniverso) for (const e of h.estadosDelUniverso) { estados.add(e); for (const c of L.METRICAS_DE_ESTADO[e] || []) claves.add(c); }
      for (const n of h.numeros) numeros.push(n);
      if (h.roles.bodega) roles.add(normalizar(h.roles.bodega));
    }
    const ids = u.hechos.map((h) => h.id);
    const soloLectura = u.hechos.every((h) => h.tipo === "lectura" || h.tipo === "propuesta");
    const ents = _entidadesEn(sp, nombres, alias);
    const spSinEnt = _blanquear(sp, ents);
    /* una sola palabra que es a la vez estado y métrica del hecho («tiene frenado el {hP} de su capital») se usa como métrica, no como estado */
    const estadosSpan = _estadosEnSpan(spSinEnt).filter((e) => u.hechos.some((h) => h.tipo === "estado") || /\s/.test(e.texto.trim()) || !_metricasConPosicion(e.texto).flatMap((mt) => [...mt.claves]).some((c) => claves.has(c)));
    /* 4a entidades */
    const _bodegaDelSujeto = (e) => ejeDe(e.k) === "bodega" && !!I && u.hechos.some((h) => h.roles.sujetos.some((sj) => { let p = []; try { p = I.estadosDe(sj) || []; } catch { p = []; } return p.some((x) => normalizar(String(x.bodega || "")) === e.k); }));
    const _enElLibro = (e) => soloLectura && !!libro && Array.isArray(libro.hechos) && libro.hechos.some((h) => h.entidades && h.entidades.has(e.k));   // una lectura interpreta los hechos de la respuesta: sus entidades no le son ajenas
    for (const e of ents) if (!roles.has(e.k) && !_bodegaDelSujeto(e) && !_enElLibro(e)) veto("entidad-ajena", `«${e.nombre}» está dentro del ancla de ${ids.join(", ")} y no es parte de ese hecho`, span, ids);
    /* 4b números, a su precisión (un pp dicho como % es otro canon); los del nombre escrito de un universo no son ajenos */
    const _uEscritos = u.hechos.map((h) => _universoEscrito(h, sp, u.tramo, libro)).filter((x) => x && x.ini != null);
    const _numerosDelAncla = _numerosEn(spSinEnt);
    for (const n of _numerosDelAncla) {
      if (_uEscritos.some((x) => x.ini <= n.ini && n.fin <= x.fin)) continue;
      /* una fracción en palabras («la mitad», «uno de cada dos», «un tercio») se contrasta con la proporción real de sus dueños (±10 puntos) */
      if (n.fraccion || (n.enPalabras && /mitad|tercio|cuarto|de\s+cada/i.test(n.texto))) {
        const ratios = u.hechos.map((h) => _ratioDe(h, I)).filter((r) => r != null).map((r) => r * 100);
        const pcts = u.hechos.flatMap((h) => h.numeros.filter((x) => x.unidad === "pct").map((x) => x.raw));
        const todas = [...ratios, ...pcts];
        if (todas.some((r) => Math.abs(r - n.raw) <= 10)) continue;
        if (todas.length) { veto("proporcion-fuera-de-cota", `«${n.texto}» (${Math.round(n.raw)} %) no es la proporción de ${ids.join(", ")} (${todas.map((r) => Math.round(r * 10) / 10 + " %").join(" · ")})`, span, ids); continue; }
      }
      /* una COTA («más de ocho meses», «al menos $1M», «casi 270 días») se contrasta como cota contra una cifra del hecho de la misma unidad */
      const cota = _cotaAntes(spSinEnt, n.ini) || (n.enPalabras && n.matiz ? _cotaDe(n.matiz) : null);
      if (cota) {
        const mismaU = numeros.filter((x) => Number.isFinite(x.raw) && (_u(x.unidad) === _u(n.unidad) || (n.unidad === "count" && x.unidad === "days")));
        const okCota = mismaU.some((x) => cota === ">" ? x.raw > n.raw : cota === ">=" ? x.raw >= n.raw : cota === "<" ? x.raw < n.raw : cota === "<=" ? x.raw <= n.raw : Math.abs(x.raw - n.raw) <= Math.max(Math.abs(n.raw) * 0.1, 1e-9));
        if (!okCota) veto("numero-ajeno", `«${n.texto}» (cota) no la cumple ninguna cifra de ${ids.join(", ")} (${mismaU.map((x) => x.texto || x.raw).slice(0, 4).join(" · ") || "sin cifras de esa unidad"})`, span, ids);
        continue;
      }
      const cabe = numeros.some((x) => Number.isFinite(x.raw) && (n.pelado ? Math.abs(x.raw - n.raw) < 1e-9 : (_u(x.unidad) === _u(n.unidad) && !(x.unidad === "pp" && n.unidad === "pct" && !/pp|puntos/.test(n.texto)) && !(x.unidad === "pct" && n.unidad === "pp") && mismoValor({ texto: n.enPalabras ? String(n.raw) : n.texto, raw: n.raw, unidad: n.unidad, canon: n.canon }, x.raw, x.unidad, x.texto))));
      /* una cifra escrita va pegada a una palabra de SU métrica: la palabra de métrica INMEDIATA («190d sin venta», «$9.8M de venta») tiene que ser de un dueño de la cifra */
      {
        const duenosN = u.hechos.filter((h) => h.numeros.some((x) => Number.isFinite(x.raw) && _u(x.unidad) === _u(n.unidad) && mismoValor({ texto: n.texto, raw: n.raw, unidad: n.unidad, canon: n.canon }, x.raw, x.unidad, x.texto)));
        const clavesDuenos = new Set(duenosN.flatMap((h) => [...h.claves]));
        if (duenosN.length && clavesDuenos.size) {
          const _cortaAntes = spSinEnt.slice(0, n.ini).split(/[:;,\u2014(|\n]/).pop(), _cortaDespues = spSinEnt.slice(n.fin).split(/[:;,\u2014)|\n.]/)[0];   // la adyacencia no cruza puntuación («sin vencido: Jumbo $5.1M»)
          const desp = _palabras(_cortaDespues).slice(0, 3), antes = _palabras(_cortaAntes).slice(-2);
          const despT = desp.join(" "), antesT = antes.join(" ");
          const inmediatas = [..._metricasConPosicion(despT).filter((mt) => mt.claves.size && mt.ini <= (desp[0] || "").length), ..._metricasConPosicion(antesT).filter((mt) => mt.claves.size && mt.fin >= antesT.length - 1)];
          const ajenas = [...new Set(inmediatas.flatMap((mt) => [...mt.claves]))].filter((c) => !clavesDuenos.has(c));
          if (ajenas.length && !inmediatas.some((mt) => [...mt.claves].some((c) => clavesDuenos.has(c)))) veto("numero-ajeno", `«${n.texto}» es de ${duenosN.map((h) => h.id).join(", ")} (${[...clavesDuenos].map(L.metricaDeClave).join(", ")}) y va pegada a ${ajenas.map(L.metricaDeClave).join(", ")}`, span, ids);
        }
      }
      /* el operando de una razón no se viste de la otra métrica («le vendiste $9.8M» con el pendiente de $9.8M sobre la venta) */
      if (I) for (const h of u.hechos.filter((z) => z.tipo === "razon")) {
        const fN = h.roles.num && I.figs.find((g) => normalizar(g.label) === normalizar(h.roles.num.label)), fD = h.roles.den && I.figs.find((g) => normalizar(g.label) === normalizar(h.roles.den.label));
        if (!fN || !fD) continue;
        const cN = L.claveDeMetrica(fN.concepto), cD = L.claveDeMetrica(fD.concepto);
        const cerca = new Set(_metricasConPosicion(_tokensAntes(spSinEnt, n.ini, 3).join(" ")).flatMap((mt) => [...mt.claves]));
        const esN = Number.isFinite(fN.raw) && mismoValor({ texto: n.texto, raw: n.raw, unidad: n.unidad, canon: n.canon }, fN.raw, fN.unidad, fN.texto), esD = Number.isFinite(fD.raw) && mismoValor({ texto: n.texto, raw: n.raw, unidad: n.unidad, canon: n.canon }, fD.raw, fD.unidad, fD.texto);
        if (esN && !esD && cD && cerca.has(cD) && !cerca.has(cN)) veto("numero-ajeno", `«${n.texto}» es el numerador de ${h.id} (${fN.label}) y va vestido de ${L.metricaDeClave(cD)}`, span, [h.id]);
        if (esD && !esN && cN && cerca.has(cN) && !cerca.has(cD)) veto("numero-ajeno", `«${n.texto}» es el denominador de ${h.id} (${fD.label}) y va vestido de ${L.metricaDeClave(cN)}`, span, [h.id]);
      }
      const aprox = n.enPalabras && n.matiz && numeros.some((x) => _u(x.unidad) === _u(n.unidad) && Math.abs(x.raw - n.raw) <= Math.max(Math.abs(n.raw) * 0.1, 1e-9));
      if (!cabe && !aprox) { veto("numero-ajeno", `«${n.texto}» no es una cifra de ${ids.join(", ")} (${numeros.map((x) => x.texto || x.raw).slice(0, 4).join(" · ") || "sin cifras"})`, span, ids); continue; }
      /* reparto por sujeto: la entidad más cercana a una cifra escrita es su dueña; el hecho que porta esa cifra tiene que ser de esa entidad */
      if (ents.length >= 2) {
        const duenosN = u.hechos.filter((h) => h.numeros.some((x) => Number.isFinite(x.raw) && _u(x.unidad) === _u(n.unidad) && (mismoValor({ texto: n.enPalabras ? String(n.raw) : n.texto, raw: n.raw, unidad: n.unidad, canon: n.canon }, x.raw, x.unidad, x.texto) || (n.enPalabras && n.matiz && Math.abs(x.raw - n.raw) <= Math.max(Math.abs(n.raw) * 0.1, 1e-9)))));
        const dueña = _duenaDeLaCifra(spSinEnt, ents, _numerosDelAncla, n);
        if (duenosN.length && dueña && roles.has(dueña.k) && duenosN.every((h) => { const S = h.roles.sujetos.filter((x) => x !== "negocio").map(normalizar); return S.length === 1 && S[0] !== dueña.k && !h.roles.vs.map(normalizar).includes(dueña.k) && !h.roles.miembros.map(normalizar).includes(dueña.k); }))
          veto("orden-distributivo", `«${n.texto}» va junto a ${dueña.nombre} y el hecho que la porta (${duenosN.map((h) => h.id).join(", ")}) es de ${duenosN[0].roles.sujetos.join(", ")}: la cifra está junto al dueño equivocado`, span, ids);
      }
    }
    /* 4k el k escrito de una exclusión («fuera de las dos que más venden») es el k del universo; el sustantivo de eje junto a {n} es el eje del universo */
    if (!soloLectura) for (const h of u.hechos) {
      const ut = h.universoTipado;
      if (ut && ut.excluir && ut.excluir.top) {
        const tops = (Array.isArray(ut.excluir.top) ? ut.excluir.top : [ut.excluir.top]).filter((t) => t && typeof t === "object");
        const mk = /(?:sin\s+estar\s+entre|fuera\s+de|salvo|excepto|sin\s+contar|aparte\s+de|descontando)\s+(?:l[oa]s\s+)?(\d{1,2}|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/i.exec(normalizar(spSinEnt));
        if (mk && tops.length) { const kEsc = _numeroDePalabra(mk[1]); if (kEsc != null && !tops.some((t) => +t.k === kEsc)) veto("universo-ajeno", `la exclusión escrita dice ${kEsc} y el universo de ${h.id} excluye ${tops.map((t) => t.k).join("/")}`, span, [h.id]); }
      }
      if (ut && ut.eje && (h.tipo === "conteo" || h.tipo === "orden")) {
        const mEje = new RegExp("(?:\\{" + h.id + "(?:\\.n)?\\}|(?<![\\d.,])" + String(h.render && h.render.n != null ? h.render.n : "□□□□") + ")\\s+(?:de\\s+(?:tus|los|las|sus|mis)\\s+)?(clientes?|cuentas?|skus?|productos?|marcas?|familias?|bodegas?|canales?)(?![a-záéíóúñ])", "i").exec(span);
        if (mEje) { const ejeEsc = _EJE_DE_SUST[normalizar(mEje[1]).replace(/s$/, "")] || null; if (ejeEsc && ejeEsc !== normalizar(ut.eje)) veto("eje-ajeno", `«${mEje[1]}» es el eje ${ejeEsc} y el universo de ${h.id} es de ${normalizar(ut.eje)}`, span, [h.id]); }
      }
    }
    /* 4l una bodega dicha en el ancla («todos en la misma bodega», «en Valparaíso») exige un hecho con esa bodega; el encabezado de bodega manda sobre lo que cuelga de él */
    if (!soloLectura) {
      const bodegasDichas = ents.filter((e) => ejeDe(e.k) === "bodega" && !roles.has(e.k));   // la bodega que es sujeto, miembro o comparado del hecho no es «dicha sin hecho»
      const mismaBodega = /(?<![a-záéíóúñ])(?:la\s+misma\s+bodega|una\s+(?:sola|misma)\s+bodega|en\s+la\s+misma)(?![a-záéíóúñ])/i.test(spSinEnt);
      const conBodega = u.hechos.filter((h) => (h.roles && h.roles.bodega) || (h.universoTipado && h.universoTipado.bodega));
      if ((bodegasDichas.length || mismaBodega) && !conBodega.length && u.hechos.some((h) => h.tipo !== "lectura" && h.tipo !== "propuesta")) veto("bodega-sin-hecho", `el ancla dice ${bodegasDichas.map((e) => e.nombre).join(", ") || "«la misma bodega»"} y ningún hecho de ${ids.join(", ")} lleva bodega: declara el estado o la cifra con su bodega`, span, ids);
      for (const e of bodegasDichas) for (const h of conBodega) { const bH = normalizar(String((h.roles && h.roles.bodega) || (h.universoTipado && h.universoTipado.bodega) || "")); if (bH && bH !== e.k) veto("bodega-ajena", `el ancla dice ${e.nombre} y ${h.id} es de ${bH}`, span, [h.id]); }
      _cobrarEncabezadoDeBodega(u);
    }
    /* 4m un grupo no se atribuye a uno solo: con un solo miembro nombrado y sin palabra de conjunto, la suma se sirve como si fuera de él */
    if (!soloLectura) for (const h of u.hechos) {
      const esSumaDeDos = h.tipo === "derivada" && /^derivada \(suma\)/.test(String(h.motivo || "")) && h.entidades.size >= 2;
      if (!((h.tipo === "grupo" && h.roles.miembros.length >= 2) || esSumaDeDos)) continue;
      const miembrosH = h.tipo === "grupo" ? h.roles.miembros : [...h.entidades].map((k) => (I && I.entidades.get(k) || { nombre: k }).nombre);
      const nombradas = ents.filter((e) => roles.has(e.k));
      const palabraDeGrupo = /(?<![a-záéíóúñ])(?:junt[oa]s|entre\s+(?:l[oa]s\s+\w+|ambos|ambas|ell[oa]s)|ambos|ambas|l[oa]s\s+dos|en\s+conjunto|sumad[oa]s|suman|combinad[oa]s|l[oa]s\s+\d+|el\s+grupo|el\s+conjunto|el\s+par|la\s+dupla)(?![a-záéíóúñ])/i.test(spSinEnt);
      const pv = h.render && h.render.valor ? spSinEnt.indexOf(String(h.render.valor)) : -1;
      const clausulaDe = (pos) => { if (pos < 0) return null; const ini = Math.max(-1, ...["—", ":", ";", "(", ")", "|", "\n"].map((c) => spSinEnt.lastIndexOf(c, pos))) + 1; const fin = Math.min(...["—", ":", ";", "(", ")", "|", "\n"].map((c) => { const i = spSinEnt.indexOf(c, pos); return i < 0 ? spSinEnt.length : i; })); return { ini, fin }; };
      const cl = clausulaDe(pv);
      const enClausula = cl ? nombradas.filter((e) => e.ini >= cl.ini && e.fin <= cl.fin) : nombradas;
      if (enClausula.length === 1 && !palabraDeGrupo && miembrosH.map(normalizar).includes(enClausula[0].k) && (cl ? !ents.some((e) => e.ini >= cl.ini && e.fin <= cl.fin && e.k !== enClausula[0].k) : true)) veto("grupo-atribuido-a-uno", `${h.id} es la suma de ${miembrosH.join(" + ")} y el ancla la dice de ${enClausula[0].nombre} solo`, span, [h.id]);
    }
    /* 4o una recomendación dentro de un ancla de hecho no es un hecho: va en una lectura o propuesta con su apoyo */
    if (!soloLectura && u.hechos.every((h) => h.tipo !== "lectura" && h.tipo !== "propuesta") && _RE_RECOMENDACION.test(spSinEnt)) veto("recomendacion-en-hecho", `«${(_RE_RECOMENDACION.exec(spSinEnt) || [""])[0]}» es una recomendación dentro del ancla de ${ids.join(", ")}: dila como lectura con su apoyo`, span, ids);
    /* 4o' una lectura que recomienda crédito, cobro o plazo se apoya en cobranza (comprobación 11): sin un apoyo de ese dominio, la recomendación no tiene hecho */
    if (soloLectura && libro && libro.porId) for (const h of u.hechos) {
      if (h.tipo !== "lectura") continue;
      const recomienda = _RE_RECOMENDACION.test(spSinEnt) || /(?<![a-záéíóúñ])(?:ampliar|recortar|cerrar|abrir|subir|bajar|renegociar|exigir|cobrar|suspender)(?![a-záéíóúñ])/i.test(spSinEnt);
      const deCredito = /(?<![a-záéíóúñ])(?:l[ií]nea(?:\s+de\s+cr[eé]dito)?|cr[eé]dito|plazo|cobr[a-záéíóúñ]*|abono|pago|vencid|mora|deuda)(?![a-záéíóúñ])/i.test(spSinEnt);
      if (!recomienda || !deCredito) continue;
      const apoyos = ((h.roles && h.roles.apoyo) || []).map((id) => libro.porId.get(String(id))).filter(Boolean);
      const conCobranza = apoyos.some((a) => a.dominio === "cobranza" || [...a.claves].some((c) => L.dominioDeClave(c) === "cobranza") || /^(?:al dia|en mora|sin deuda|sin pagos|buen pagador|mal pagador)$/.test(a.estado || ""));
      if (!conCobranza) veto("recomendacion-sin-apoyo", `${h.id} recomienda sobre crédito o cobro y su apoyo (${apoyos.map((a) => a.id).join(", ") || "ninguno"}) no trae un hecho de cobranza: la recomendación no tiene el hecho que la sostiene`, span, [h.id]);
    }
    /* 4p «todos tus clientes» sobre un conteo que no es el eje entero */
    if (!soloLectura && /(?<![a-záéíóúñ])tod[oa]s\s+(?:tus|los|las|sus|mis)\s+(?:clientes|cuentas|skus?|productos|marcas|familias|bodegas|canales)(?![a-záéíóúñ])/i.test(spSinEnt)) for (const h of u.hechos.filter((z) => z.tipo === "conteo")) { const r = _ratioDe(h, I); if (r != null && r < 0.9999) veto("proporcion-fuera-de-cota", `«todos» y ${h.id} es ${h.render.n} de ${h.render.m}`, span, [h.id]); }
    /* 4q «casi lo mismo» es igualdad ±10 %: una relación mayor/menor con cociente lejos de 1 no lo dice */
    if (!soloLectura && /(?<![a-záéíóúñ])(?:casi|pr[aá]cticamente|m[aá]s\s+o\s+menos)\s+(?:lo\s+mismo|igual(?:es)?|parej[oa]s?|similar(?:es)?|a\s+la\s+par)(?![a-záéíóúñ])/i.test(spSinEnt)) for (const h of u.hechos.filter((z) => z.tipo === "relacion")) { const q = _cocienteDe(h, I); if (q != null && Math.abs(q - 1) > 0.1) veto("matiz-ajeno", `«casi lo mismo» y ${h.id} es ${Math.round(q * 100) / 100}×: no es casi igual (±10 %)`, span, [h.id]); }
    /* 4r el lado del conjunto es el de la fig: «Clientes · sobre el benchmark» no se dice «bajo el benchmark» */
    if (!soloLectura) for (const h of u.hechos) { const lab = (h.evidencia || []).map(String).join(" · "); const ml = /(sobre|bajo)\s+el\s+(?:benchmark|nivel|presupuesto|plan)/i.exec(normalizar(lab)); if (!ml) continue; const dicho = /(?<![a-záéíóúñ])(?:bajo|debajo|por\s+debajo)(?![a-záéíóúñ])/i.test(spSinEnt) ? "bajo" : /(?<![a-záéíóúñ])(?:sobre|encima|por\s+encima)(?![a-záéíóúñ])/i.test(spSinEnt) ? "sobre" : null; if (dicho && dicho !== ml[1]) veto("universo-ajeno", `el ancla dice «${dicho}» y ${h.id} es el conjunto «${lab}»`, span, [h.id]); }
    /* 4s el verbo de una derivada es su operación: «suman» no es una diferencia */
    if (!soloLectura) for (const h of u.hechos.filter((z) => z.tipo === "derivada")) { const mo = /^derivada \((\w+)\)/.exec(String(h.motivo || "")); const op = mo ? mo[1] : null; if (!op) continue; const diceSuma = /(?<![a-záéíóúñ])(?:suman?|sumad[oa]s|juntos|entre\s+(?:los|las)\s+dos|acumulan|en\s+total)(?![a-záéíóúñ])/i.test(spSinEnt); const diceDif = /(?<![a-záéíóúñ])(?:diferencia|brecha|distancia|de\s+ventaja|separan|m[aá]s\s+que|menos\s+que)(?![a-záéíóúñ])/i.test(spSinEnt); if (diceSuma && op !== "suma") veto("operacion-ajena", `el ancla dice una suma y ${h.id} es una ${op}`, span, [h.id]); if (diceDif && op === "suma") veto("operacion-ajena", `el ancla dice una diferencia y ${h.id} es una suma`, span, [h.id]); }
    /* 4t una palabra de OTRO dominio dentro del ancla («la gestión de cobranza deja {hMed}» con una medida comercial) */
    if (!soloLectura && dominios.size) { const mascaraD = _mascaraDeLaCasa(spSinEnt).filter((m) => [...m.claves].some((c) => claves.has(c)));   /* solo los nombres de las métricas del hecho tapan la palabra de dominio */ for (const [d, re] of Object.entries(_RE.dominio)) { if (dominios.has(d)) continue; const x = _fueraDeLaCasa(_todos(re, spSinEnt), mascaraD).find((y) => !estadosSpan.some((e) => e.ini <= y.ini && y.fin <= e.fin) && !_CONDICIONAL.test(y.texto)); if (x) { veto("dominio-cruzado", `«${x.texto}» es de ${d} y ${ids.join(", ")} es de ${[...dominios].join("/")}`, span, ids); break; } } }
    /* 4u una lectura que abre con «su» apunta al sujeto de la oración anterior: sus apoyos tienen que ser de él */
    if (soloLectura && /^\s*(?:su|sus)\s/i.test(sp)) { const prevEnt = _entidadesEn(s.slice(Math.max(0, u.ini - 220), u.ini), nombres, alias).sort((a, b) => b.fin - a.fin)[0]; const apEnts = new Set(u.hechos.flatMap((h) => ((h.roles && h.roles.apoyo) || []).map((id) => H(id)).filter(Boolean).flatMap((a) => [...a.entidades]))); if (prevEnt && apEnts.size && !apEnts.has(prevEnt.k)) veto("pronombre-en-ancla", `«Su…» apunta a ${prevEnt.nombre} y el apoyo de ${ids.join(", ")} es de ${[...apEnts].join(", ")}`, span, ids); }
    /* 4c0 la cláusula MUDA tras una coordinación hereda el verbo: «{{d1: Falabella vende $19.4M}} y {{d2: Lider $9.8M}}» dice que Lider VENDE $9.8M; si d2
     * no es de esa métrica, la elipsis miente */
    if (!soloLectura && ents.length === 1 && !_metricasConPosicion(spSinEnt).some((mt) => mt.claves.size) && /^\s*(?:y|e|ni|,)\s*$/i.test(s.slice(Math.max(0, u.ini - 4), u.ini).replace(/[}⟧]/g, ""))) {
      const prev = u.prev || null;
      const prevClaves = prev ? new Set(prev.hechos.flatMap((h) => [...h.claves])) : new Set();
      if (prevClaves.size && ![...prevClaves].some((c) => claves.has(c))) veto("metrica-heredada", `la cláusula «${span.trim()}» hereda el verbo de la anterior (${[...prevClaves].map(L.metricaDeClave).join(", ")}) y ${ids.join(", ")} es de otra métrica (${[...claves].map(L.metricaDeClave).join(", ") || "sin métrica"})`, span, ids);
    }
    /* 4c métricas: nombradas ⊆ las del hecho; con varias métricas en el ancla, cada palabra pegada a un placeholder de ESA métrica, y cada
     * placeholder de valor con una palabra de su métrica cerca (un ancla con dos valores mudos es ambigua) */
    const mets = soloLectura ? [] : _metricasConPosicion(spSinEnt).filter((mt) => !_dentroDe(mt, estadosSpan)).filter((mt) => !_uEscritos.some((x) => x.ini <= mt.ini && mt.fin <= x.fin));   // las métricas del nombre escrito de un universo no son ajenas
    const phs = u.placeholders.map((p) => ({ ...p, ini: p.ini - u.innerIni, fin: p.fin - u.innerIni, h: H(p.id) })).filter((p) => p.h);
    const setsDeClaves = new Set(phs.map((p) => [...p.h.claves].sort().join("|")).filter(Boolean));
    const variasMetricas = setsDeClaves.size > 1;
    for (const mt of mets) {
      if (!mt.claves.size) continue;
      if (![...mt.claves].some((c) => claves.has(c) || [...claves].some((k) => /^variacion|^vs_presupuesto/.test(k) && (c === "ventas" || c === BASE_DE_TASA[k])))) {   /* una VARIACIÓN es de una métrica: «la venta crece {hH}» la nombra; una tasa (margen) no se viste de su base («lidera en venta») */   // la base de una tasa del hecho también se puede nombrar («la venta crece {hH}»)
        /* «debe» a secas es el saldo pendiente; con el vencido, el por vencer o los días al lado, es el verbo de esa métrica */
        if (/^(?:te\s+|le\s+|les\s+|nos\s+|me\s+)?(?:deb(?:e|en|es|ia|ian)|adeud(?:a|an))$/i.test(normalizar(mt.texto)) && ([...claves].some((c) => c === "saldo_pendiente") || mets.some((m2) => m2 !== mt && [...m2.claves].some((c) => /^saldo_(?:vencido|por_vencer)$|^dias_vencido$|^abonado$|^recuperado$/.test(c))))) continue;   // «debe» a secas = saldo pendiente (decisión 3); con otra métrica de cobranza al lado, es el verbo de esa
        /* «58d de inventario»: el nombre abreviado de «Días de inventario» (la cifra en días + «d de» + el resto del nombre) */
        const abrev = /\d\s*d\s+de\s*$/i.test(spSinEnt.slice(0, mt.ini)) && [...claves].some((c) => { const n = normalizar(L.metricaDeClave(c) || ""); return n === "dias de " + normalizar(mt.texto) || n === "dias " + normalizar(mt.texto); });
        if (abrev) continue;
        /* «el 0.05% de tu venta», «{d3} sobre la venta»: la base de una tasa dicha junto a su cifra es su base, no una métrica ajena */
        /* tras una preposición de base en un ancla de tasa, la mención es una BASE y la juzga 4h (base-ajena / base-sin-metrica), no esta comprobación */
        const hechoTasa = u.hechos.some(_esTasaH);
        const _ART = "(?:la\\s+|el\\s+|tu\\s+|tus\\s+|su\\s+|sus\\s+|toda\\s+la\\s+|todo\\s+el\\s+)?";
        const esBase = hechoTasa && (new RegExp("(?:" + L.PREPOSICION_DE_BASE_SRC + ")\\s+" + _ART + "$", "i").test(spSinEnt.slice(0, mt.ini)) || new RegExp("(?:" + L.PREPOSICION_DE_BASE_SRC + ")\\s+" + _ART + "[a-záéíóúñ]+\\s*$", "i").test(mt.texto));
        if (esBase) continue;
        veto("metrica-ajena", `«${mt.texto}» nombra una métrica que ${ids.join(", ")} no tiene (${[...claves].map(L.metricaDeClave).join(", ") || "sin métrica"})`, span, ids); continue;
      }
      /* familias: la prosa dice el nombre corto (la mención casa por el muro) y el hecho es el nombre largo → el calificador tiene que estar en el ancla */
      { const larga = _familiaLarga(mt, claves, spSinEnt); if (larga) { veto("metrica-ajena", `«${mt.texto}» dice ${L.metricaDeClave(larga.corta)} y ${ids.join(", ")} es ${L.metricaDeClave(larga.larga)}: di el nombre completo («${L.metricaDeClave(larga.larga).toLowerCase()}»)`, span, ids); continue; } }
      if (variasMetricas) {
        /* el placeholder más cercano (en palabras) es el dueño de la palabra; si su hecho no es esa métrica, la cifra está vestida de otra cosa */
        const dist = (p) => _palabras(sp.slice(Math.min(p.fin, mt.ini), Math.max(p.ini, mt.fin))).length;
        const cerca = phs.filter((p) => dist(p) <= 3).sort((a, b) => dist(a) - dist(b));
        if (cerca.length && ![...cerca[0].h.claves].some((c) => mt.claves.has(c))) veto("metrica-cruzada", `«${mt.texto}» está pegada a {${cerca[0].id}} y ese hecho no es esa métrica`, span, ids);
      }
    }
    /* dos valores de la misma familia con unidades distintas (% y $ de la variación) no son ambiguos: la unidad dice cuál es cuál */
    const _familiaDe = (h) => [...h.claves].map((c) => c.replace(/_(?:usd|pct|pp)$/, "")).sort().join("|");
    const _unidadDe = (h) => { const v = String((h.render && h.render.valor) || ""); const n0 = h.numeros[0]; return n0 && n0.unidad ? n0.unidad : (/%/.test(v) ? "pct" : /\$/.test(v) ? "money" : /\dd\b/.test(v) ? "days" : "count"); };
    const _phsValor = phs.filter((p) => p.campo === "valor" && p.h.claves.size);
    const ambiguaPorUnidad = _phsValor.length >= 2 && new Set(_phsValor.map((p) => _familiaDe(p.h))).size === 1 && new Set(_phsValor.map((p) => _unidadDe(p.h))).size === _phsValor.length;
    if (variasMetricas && !ambiguaPorUnidad) for (const p of phs) {
      if (!/^(?:cifra|ref|razon|derivada|variacion)$/.test(p.h.tipo) || p.campo !== "valor" || !p.h.claves.size) continue;
      const cerca = mets.some((mt) => [...mt.claves].some((c) => p.h.claves.has(c)) && _palabras(sp.slice(Math.min(p.fin, mt.ini), Math.max(p.ini, mt.fin))).length <= 3);
      if (!cerca) veto("ancla-ambigua", `{${p.id}} (${[...p.h.claves].map(L.metricaDeClave).join("/")}) va junto a otro valor de otra métrica sin una palabra que diga cuál es cuál: nombra la métrica pegada a cada cifra`, span, ids);
    }
    /* 4c' orden distributivo: con varias entidades y varios placeholders de sujetos distintos, el k-ésimo valor es de la k-ésima entidad */
    {
      const entsOrden = []; for (const e of ents) if (roles.has(e.k) && !entsOrden.includes(e.k)) entsOrden.push(e.k);
      const sujetosPh = phs.map((p) => { const S = p.h.roles.sujetos.filter((x) => x !== "negocio").map(normalizar); return S.length === 1 ? S[0] : null; });
      if (entsOrden.length >= 2 && sujetosPh.length === entsOrden.length && sujetosPh.every(Boolean) && new Set(sujetosPh).size === sujetosPh.length && sujetosPh.every((k) => entsOrden.includes(k))) {
        const mal = sujetosPh.findIndex((k, i) => k !== entsOrden[i]);
        if (mal >= 0) veto("orden-distributivo", `el ${mal + 1}.º valor es de ${(I && I.entidades.get(sujetosPh[mal]) || { nombre: sujetosPh[mal] }).nombre} y la ${mal + 1}.ª entidad nombrada es ${(I && I.entidades.get(entsOrden[mal]) || { nombre: entsOrden[mal] }).nombre}: el reparto por orden no coincide`, span, ids);
      }
    }
    /* 4d estados con paridad de negación */
    for (const e of estadosSpan) {
      const negs = _todos(_RE.negacion, spSinEnt.slice(0, e.ini)).length;
      const dicho = negs % 2 === 1 ? (complementoDe(e.canon) || `no ${e.canon}`) : e.canon;
      /* la frase del estado puede ser el NOMBRE de una métrica de los hechos («sin venta» en «Días sin venta», «frenado» en «Capital frenado»): es la métrica, no un estado */
      const esNombreDeMetrica = [...claves].some((c) => normalizar(L.metricaDeClave(c)).includes(normalizar(e.texto)) || (L.metricaPorClave(c) && L.metricaPorClave(c).conceptos.includes(normalizar(e.texto)))) || u.hechos.some((h) => (h.evidencia || []).some((l) => normalizar(String(l)).includes(normalizar(e.texto))));   // …o un concepto de esa métrica («sin moverse» en días sin venta), o el rótulo de la fig anclada («riesgo de quiebre: $36K»)
      /* la forma del catálogo manda: «ni una factura vencida» es «al día», no «vencido» negado */
      { const porForma0 = _formaDeEstadoEn(spSinEnt, e); const porForma = porForma0 && (porForma0 !== e.canon || /(?<![a-záéíóúñ])(?:ni|sin|no)(?![a-záéíóúñ])/i.test(e.texto)) ? porForma0 : null; if (porForma && porForma !== dicho) { if (!estados.has(porForma) && !(porForma === "inmovilizado" && (estados.has("frenado") || estados.has("sobrestock")))) veto("estado-ajeno", `«${e.texto}» (forma «${porForma}») no es el estado de ${ids.join(", ")} (${[...estados].join(", ") || "sin estado"})`, span, ids); continue; } }
      if (!esNombreDeMetrica && !estados.has(dicho) && !(dicho === "inmovilizado" && (estados.has("frenado") || estados.has("sobrestock")))) veto("estado-ajeno", `«${e.texto}»${negs % 2 ? " (negado)" : ""} no es el estado de ${ids.join(", ")} (${[...estados].join(", ") || "sin estado"})`, span, ids);
    }
    /* 4e dirección por polaridad */
    for (const h of u.hechos) {
      if (!/^(?:orden|relacion|variacion)$/.test(h.tipo)) continue;
      const dir = h.tipo === "variacion" ? (h.direccion === "sube" ? "mayor" : h.direccion === "baja" ? "menor" : null) : (h.tipo === "orden" ? (h.direccion === "peor" ? (h.polaridad === "mayor" ? "menor" : h.polaridad === "menor" ? "mayor" : null) : h.direccion === "mejor" ? (h.polaridad || null) : h.direccion || null) : (h.direccion === "mayor" || h.direccion === "menor" ? h.direccion : null));
      if (!dir) continue;
      const spDir = _blanquear(spSinEnt, _uEscritos);   // la exclusión escrita de un universo («sin estar entre los que más venden») no es dirección del hecho
      const neg = _negacionesDe(spDir, u.hechos).length % 2 === 1;
      let dicha = null;
      const peor = _RE_PEOR.test(spDir), mejor = _RE_MEJOR.test(spDir);
      if (peor && !mejor) dicha = h.polaridad === "mayor" ? "menor" : h.polaridad === "menor" ? "mayor" : null;
      else if (mejor && !peor) dicha = h.polaridad || null;
      else { const M = _RE_MAYOR.test(spDir), N = _RE_MENOR.test(spDir); dicha = M && !N ? "mayor" : N && !M ? "menor" : null; }
      if (!dicha && h.tipo === "variacion") { const S = _RE_SUBE.test(spDir), Bj = _RE_BAJA.test(spDir); dicha = S && !Bj ? "mayor" : Bj && !S ? "menor" : null; }   // «cayó», «creció»: la palabra de variación es la dirección
      if (dicha && neg) dicha = dicha === "mayor" ? "menor" : "mayor";
      if (dicha && dicha !== dir && (h.tipo !== "relacion" || ents.length >= 2)) veto("direccion-contraria", `el ancla dice «${dicha}» y ${h.id} es «${dir}»`, span, [h.id]);
    }
    /* 4f lados de una relación */
    for (const h of u.hechos) {
      if (h.tipo !== "relacion" && !(h.tipo === "orden" && h.forma === "comparativo")) continue;
      const S = new Set(h.roles.sujetos.map(normalizar)), Vs = new Set(h.roles.vs.map(normalizar));
      const nombrados = ents.filter((e) => S.has(e.k) || Vs.has(e.k));
      if (nombrados.length >= 2 && !u.placeholders.some((p) => p.campo === "rel")) { const [a, b] = nombrados; if (Vs.has(a.k) && S.has(b.k) && !S.has(a.k)) veto("lados-invertidos", `en ${h.id} el sujeto es ${h.roles.sujetos.join(", ")} y el otro lado ${h.roles.vs.join(", ")}; el ancla los nombra al revés (usa {${h.id}.rel})`, span, [h.id]); }
    }
    /* 4g la base */
    const tasas = u.hechos.filter(_esTasaH);
    if (tasas.length && !soloLectura) for (const b of _todos(_RE.base, spSinEnt)) {
      const trasPh = /^\s*\{[a-z][a-z0-9]*\.(?:base|universo)\}/i.test(span.slice(b.fin));
      if (trasPh) continue;
      if (/(?<![%$.,\d])\d+\s*$/.test(spSinEnt.slice(0, b.ini))) continue;   // «8 de tus clientes»: partitivo de un conteo (una cifra escrita), no la base de una tasa; un placeholder o una entidad antes no eximen
      { const antesB = spSinEnt.slice(0, b.ini); const alFrente = /^\s*$|[.;:,(—•|]\s*$/.test(antesB); const pegada = /[\d%□}]\s*(?:[a-záéíóúñ]+\s+){0,2}$/.test(antesB); if (!alFrente && !pegada) continue; }   // la base va pegada a la cifra o al frente de la cláusula: «fuera del directorio» lejos de todo número no es una base
      if (/^\s*(?:la\s+|el\s+|los\s+|las\s+)?(?:clientes?|cuentas?|skus?|sku|marcas?|familias?|bodegas?|canales?|productos?)\b/i.test(spSinEnt.slice(b.fin))) continue;   // sigue un sustantivo de eje: universo, no base
      const resto = spSinEnt.slice(b.fin, b.fin + 40).replace(/^(?:la|el|lo|los|las|su|sus|toda\s+la|todo\s+el|esa|ese|esta|este|un|una)\s+/i, "");
      const siguiente = (resto.match(/^[a-záéíóúñ0-9$%□]+/i) || [""])[0];
      if (!siguiente || /□/.test(siguiente)) continue;   // sigue una entidad o un placeholder
      if (/^\d|^\$/.test(siguiente) || /^(?:cada|eso|esos|esas|cual|cuanto)$/i.test(siguiente)) continue;
      if (/^que$/i.test(siguiente)) {
        /* «de lo que le vendiste» / «sobre lo que le cuesta»: el verbo que sigue nombra la base o no la nombra */
        const trasQue = resto.slice(3).replace(/^\s*(?:le|les|te|se|nos|me|lo|la)\s+/i, "").trim();
        const verbo = (trasQue.match(/^[a-záéíóúñ]+/i) || [""])[0];
        const mV = verbo ? _metricasConPosicion(verbo) : [];
        if (!verbo) continue;
        if (!mV.length) { veto("base-sin-metrica", `«${b.texto.trim()}lo que ${verbo}…» dice una base sin vocabulario de la casa (usa la métrica o {${tasas[0].id}.base})`, span, ids); continue; }
        for (const h of tasas) { const baseH = _baseH(h); if (!baseH) continue; const dichas = new Set(mV.flatMap((x) => [...x.claves])); if (dichas.size && !dichas.has(baseH) && !(baseH === "ventas_anterior" && dichas.has("ventas"))) veto("base-ajena", `«${b.texto.trim()}lo que ${verbo}» no es la base de ${h.id} (${L.metricaDeClave(baseH).toLowerCase()})`, span, [h.id]); }
        continue;
      }
      const mBase = _metricasConPosicion(resto.slice(0, 32)).filter((x) => x.ini <= siguiente.length + 1);
      if (/(?<![a-záéíóúñ])sus?\s*$/i.test(spSinEnt.slice(0, b.fin)) || /^\s*sus?\s/i.test(spSinEnt.slice(b.fin, b.fin + 5))) for (const h of tasas) if (h.tipo === "razon" && h.roles.den && h.roles.num && h.roles.den.sujeto !== "negocio" && normalizar(String(h.roles.den.sujeto || "")) !== normalizar(String(h.roles.num.sujeto || ""))) veto("base-ajena", `«${b.texto.trim()} su…» apunta al sujeto y el denominador de ${h.id} es ${h.roles.den.sujeto}`, span, [h.id]);
      for (const h of tasas) if (h.tipo === "razon" && h.roles.den && /\s·\s/.test(String(h.roles.den.label || "")) && !/^(?:negocio|total)\b/i.test(String(h.roles.den.label || "")) && /^[a-záéíóúñ ]{0,24}\btotal\b|^(?:el\s+)?negocio\b|^(?:la\s+)?empresa\b|^tod[oa]\s+(?:la|el)\b/i.test(normalizar(resto.slice(0, 40)))) veto("base-ajena", `«${b.texto.trim()} ${resto.slice(0, 24).trim()}…» dice el total y el denominador de ${h.id} es ${String(h.roles.den.label).split(" · ")[0]}`, span, [h.id]);
      if (!mBase.length && /^total$/i.test(siguiente) && tasas.some((h) => [...h.claves].some((c) => /participacion|del_total/.test(c)) || (h.evidencia || []).some((l) => /%\s+del\s+total|participaci/i.test(String(l))))) continue;   // «el 75% del total»: la base de una participación es el total
      if (!mBase.length) { if (!/[a-záéíóúñ]{4,}/i.test(siguiente)) continue; veto("base-sin-metrica", `«${b.texto.trim()} ${siguiente}…» dice una base sin vocabulario de la casa (usa la métrica o {${tasas[0].id}.base})`, span, ids); continue; }
      for (const h of tasas) {
        const baseH = _baseH(h);
        if (!baseH) continue;
        const dichas = new Set(mBase.flatMap((x) => [...x.claves]));
        if (dichas.size && !dichas.has(baseH) && !(baseH === "ventas_anterior" && dichas.has("ventas"))) veto("base-ajena", `«${b.texto.trim()} ${siguiente}» no es la base de ${h.id} (${L.metricaDeClave(baseH).toLowerCase()})`, span, [h.id]);
      }
    }
    /* 4h universo restringido: lo escribe la casa ({id.universo} o {id.umbral}); si es solo por estado, basta el estado dicho */
    for (const h of u.hechos) {
      if (!(h.universo && h.universo.restringido)) continue;
      const ph = u.placeholders.some((p) => p.id === h.id && (p.campo === "universo" || p.campo === "umbral"));
      const soloEstado = h.estadosDelUniverso && h.estadosDelUniverso.size && !(h.numeros.some((n) => n.unidad !== "count" && n.texto && /d[ií]as|%|\$/.test(n.texto)) && h.tipo !== "conteo");
      const estadoDicho = soloEstado && estadosSpan.some((e) => h.estadosDelUniverso.has(e.canon));
      const escrito = _universoEscrito(h, sp, u.tramo, libro);
      if (!ph && !estadoDicho && !escrito) veto("universo-invisible", `${h.id} vale dentro de «${h.universo.texto}»: el ancla tiene que escribirlo con {${h.id}.universo}`, span, [h.id]);
    }
    /* 4j roles visibles de un cociente */
    for (const h of u.hechos) if (h.tipo === "razon" && h.roles.den && h.roles.den.sujeto && h.roles.den.sujeto !== "negocio" && h.roles.num && normalizar(h.roles.den.sujeto) !== normalizar(h.roles.num.sujeto || "")) { const k = normalizar(h.roles.den.sujeto); if (!ents.some((e) => e.k === k) && !/(?<![a-z])(?:su|sus)(?![a-z])/i.test(spSinEnt) && !u.placeholders.some((p) => p.id === h.id && p.campo === "base")) veto("base-invisible", `${h.id} se divide por ${h.roles.den.sujeto} y el ancla no lo nombra (nómbralo, usa «su» o {${h.id}.base})`, span, [h.id]); }
    /* 4k un pronombre que ata el hecho a un tercero que el hecho no tiene */
    if (roles.size <= 1 && _hay(_RE.pronombre, spSinEnt)) veto("pronombre-en-ancla", `«${_todos(_RE.pronombre, spSinEnt)[0].texto}» ata ${ids.join(", ")} a otra parte que el hecho no tiene`, span, ids);
    /* 4m dominio cruzado */
    if (dominios.size && !soloLectura) for (const [d, re] of Object.entries(_RE.dominio)) { if (dominios.has(d)) continue; const x = _todos(re, spSinEnt).find((y) => !_dentroDe(y, mets.filter((mt) => [...mt.claves].some((c) => claves.has(c)))) && !_dentroDe(y, estadosSpan)); if (x) veto("dominio-cruzado", `«${x.texto}» es de ${d} y ${ids.join(", ")} es de ${[...dominios].join("/")}`, span, ids); }
    /* 7 (dentro) · negación, tiempo, modalidad, proporción */
    const _negs = _negacionesDe(_blanquear(spSinEnt, _uEscritos), u.hechos);
    if (!estadosSpan.length && !u.hechos.some((h) => h.tipo === "estado" || h.tipo === "lectura") && _negs.length) veto("negacion-en-ancla", `«${_negs[0].texto}» niega dentro del ancla de ${ids.join(", ")}: un hecho se afirma en positivo`, span, ids);
    const _marcasTiempo = _fueraDeLaCasa(_todos(_RE.tiempo, spSinEnt), _mascaraDeLaCasa(spSinEnt)).map((x) => { const p = L.PERIODO_DE_MARCADOR.find(([re]) => re.test(normalizar(x.texto))); return { ...x, per: p ? p[1] : null }; }).filter((x) => x.per);
    /* un hecho de otro período («Ventas del año anterior») lleva su marca dentro del ancla */
    for (const h of u.hechos) {
      if (h.tipo === "lectura" || h.tipo === "propuesta" || h.tipo === "variacion") continue;
      const hp = h.periodo || _PERIODO_VIGENTE;
      if (hp !== _PERIODO_VIGENTE && hp !== "corte" && !_marcasTiempo.some((x) => x.per === hp) && !u.placeholders.some((p) => p.id === h.id && p.campo === "periodo")) veto("periodo-invisible", `${h.id} es del período «${hp}» y el ancla no lo dice: escríbelo (año anterior, presupuesto)`, span, [h.id]);
    }
    for (const x of _marcasTiempo) { const per = x.per; for (const h of u.hechos) { if (h.tipo === "lectura" || h.tipo === "propuesta") continue; const esVar = h.tipo === "variacion" || [...h.claves].some((c) => /^(?:variacion|vs_presupuesto)/.test(c)); const hp = esVar ? (h.periodo || "anterior") : (h.periodo || _PERIODO_VIGENTE); if (esVar && (per === _PERIODO_VIGENTE || per === "corte")) continue; if (per !== hp && !(per === _PERIODO_VIGENTE && hp === "corte")) veto("periodo-ajeno", `«${x.texto}» es «${per}» y ${h.id} es «${hp}»`, span, [h.id]); } }
    if (!u.hechos.every((h) => h.tipo === "lectura" || h.tipo === "propuesta") && _hay(_RE.modalidad, spSinEnt)) veto("modalidad-en-ancla", `«${_todos(_RE.modalidad, spSinEnt)[0].texto}» vuelve hipotético a ${ids.join(", ")}: un hecho no se anida en un supuesto`, span, ids);
    for (const x of [..._todos(_RE.proporcion, spSinEnt), ..._todos(_RE.proporcionSubjetiva, spSinEnt)]) if (!u.hechos.some((h) => h.tipo === "razon" || h.tipo === "conteo" || h.tipo === "grupo" || (h.tipo === "relacion" && /fraccion|parte/.test(h.direccion || "")))) { veto("proporcion-sin-razon", `«${x.texto}» pegada a ${ids.join(", ")} exige una razón o un conteo calculado`, span, ids); break; }
    /* 4n · CADA PALABRA TIENE DUEÑO (v3.1): una marca de clase dentro del ancla exige un hecho de su clase entre los anclados; una lectura no afirma */
    {
      const mascara = [..._mascaraDeLaCasa(spSinEnt), ..._uEscritos, ..._todos(_RE.modismo, spSinEnt)];
      const fuera = (lista) => lista.filter((x) => !mascara.some((m) => m.ini <= x.ini && x.fin <= m.fin));
      const de = (tipos) => u.hechos.filter((h) => tipos.includes(h.tipo));
      const cotaMark = (x) => /^(?:m[aá]s|menos)\s+de$/i.test(x.texto.trim()) && /^\s*(?:\d|□|\$|(?:casi\s+)?(?:un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta|cincuenta|cien|mil|medio|media)\b)/i.test(spSinEnt.slice(x.fin));
      let marcas = [
        ...fuera(_todos(_RE.superlativo, spSinEnt)).map((x) => ({ ...x, clase: "superlativo" })),
        ...fuera(_todos(_RE.adjCasa, spSinEnt)).map((x) => ({ ...x, clase: "superlativo" })),
        ...fuera(_todos(new RegExp(B + "(?:peor(?:es)?|mejor(?:es)?)" + E, "gi"), spSinEnt)).map((x) => ({ ...x, clase: "superlativo" })),
        ...fuera(_todos(_RE.ordinal, spSinEnt)).map((x) => ({ ...x, clase: "ordinal" })),
        ...fuera(_todos(_RE.comparativo, spSinEnt)).filter((x) => !cotaMark(x)).map((x) => ({ ...x, clase: "comparación" })),
        ...fuera(_todos(_RE.variacion, spSinEnt)).map((x) => ({ ...x, clase: "variación" })),
        ...fuera(_todos(_RE.duracion, spSinEnt)).map((x) => ({ ...x, clase: "duración" })),
        ...fuera(_todos(_RE.proporcion, spSinEnt)).map((x) => ({ ...x, clase: "proporción" })),
        ...fuera(_todos(_RE.fraccionPalabra, spSinEnt)).map((x) => ({ ...x, clase: "proporción" })),
      ].sort((a, b) => a.ini - b.ini || b.fin - a.fin);
      marcas = marcas.filter((x, i) => !marcas.some((y, j) => j !== i && y.ini <= x.ini && x.fin <= y.fin && (y.fin - y.ini > x.fin - x.ini || (y.fin - y.ini === x.fin - x.ini && j < i))));
      for (const x of marcas) {
        if (x.clase === "ordinal" && !/(?:cuenta|cliente|sku|puesto|lugar|posici|\ben\b|\bde\b|mayor|menor|deudor|vendedor|\bes\b|\bva\b)/i.test(_tokensAntes(spSinEnt, x.ini, 3).join(" ") + " " + _tokensDespues(spSinEnt, x.fin, 3).join(" "))) continue;   // «primero» retórico
        if (soloLectura) {
          const tras3 = _tokensDespues(spSinEnt, x.fin, 3).join(" "), antes3 = _tokensAntes(spSinEnt, x.ini, 3).join(" ");
          const ordinalRetorico = x.clase === "ordinal" && !/(?:cuenta|cliente|sku|marca|familia|bodega|canal|puesto|lugar|posici|deudor|vendedor|mayor|menor)/i.test(antes3 + " " + tras3);
          const masDe = x.clase === "comparación" && /^m[aá]s\s+de$/i.test(x.texto.trim());
          const criterio = (x.clase === "superlativo" || x.clase === "ordinal") && /^(?:que\s+|a\s+|para\s+)?(?:yo\s+)?[a-záéíóúñ]+r[ií]a(?:n|s|mos)?(?![a-záéíóúñ])/i.test(tras3);   /* «el primero que liquidaría»: criterio, no hecho */
          if (ordinalRetorico || masDe || criterio) continue;
          veto("lectura-con-hecho", `«${x.texto}» (${x.clase}) es léxico de hecho dentro de una lectura: una lectura no afirma hechos, ánclalo aparte como el hecho que es`, span, ids); continue; }
        let duenos = [];
        if (x.clase === "superlativo") { duenos = [...de(["orden"]), ...u.hechos.filter((h) => h.universoTipado && h.universoTipado.top)];
          /* «la primera», «el segundo»: un superlativo con ordinal exige el puesto como un ordinal */
          const kO = /primer|segund|tercer|cuart|quint|sext|[uú]ltim|\d/.test(normalizar(x.texto)) ? _ordinalANumero(x.texto) : null;
          if (kO != null) { const antesF = duenos; duenos = duenos.filter((h) => h.tipo !== "orden" || (h.forma === "puesto" ? Number.isFinite(+h.render.k) && +h.render.k === kO : h.forma === "topk" ? (!Number.isFinite(+h.render.k) || kO <= +h.render.k) : kO === 1 || /[uú]ltim/i.test(x.texto))); if (!duenos.length && antesF.some((h) => h.forma === "puesto")) { veto("puesto-ajeno", `«${x.texto}» no es el puesto de ${antesF.filter((h) => h.tipo === "orden").map((h) => `${h.id} (${h.render.k || "?"}.º)`).join(", ")}`, span, ids); continue; } } }   // «los SKU con más capital» lo cubre un conteo o grupo cuyo universo es un top
        else if (x.clase === "ordinal") { const k = _ordinalANumero(x.texto); duenos = de(["orden"]).filter((h) => k == null || (h.forma === "puesto" ? Number.isFinite(+h.render.k) && +h.render.k === k : h.forma === "topk" ? !Number.isFinite(+h.render.k) || k <= +h.render.k : k === 1 || /[uú]ltim/i.test(x.texto))); if (!duenos.length && de(["orden"]).some((h) => h.forma === "puesto")) { veto("puesto-ajeno", `«${x.texto}» no es el puesto de ${de(["orden"]).map((h) => `${h.id} (${h.render.k || "?"}.º)`).join(", ")}`, span, ids); continue; } }
        else if (x.clase === "comparación" && _multiplicadorDe(x.texto) != null && _multiplicadorDe(x.texto) < 1) {
          /* una fracción dicha («casi la mitad de tus clientes», «un tercio») la cubren la razón, el conteo o el grupo; se contrasta con la cota de la casa o con ±10 puntos */
          duenos = [...de(["razon", "conteo", "grupo"]), ...de(["relacion"]).filter((h) => /fraccion|parte/.test(h.direccion || ""))];
          const mult = _multiplicadorDe(x.texto);
          const cota = L.cotaDeProporcion((_tokensAntes(spSinEnt, x.ini, 1).join(" ") + " " + x.texto).trim()) || L.cotaDeProporcion(x.texto);
          const ratios = duenos.map((h) => _ratioDe(h, I)).filter((r) => r != null);
          if (ratios.length && !(cota ? ratios.some((r) => r >= cota.lo - 1e-9 && r <= cota.hi + 1e-9) : ratios.some((r) => Math.abs(r - mult) <= 0.1))) { veto("proporcion-fuera-de-cota", `«${x.texto}» (${cota ? cota.nombre : Math.round(mult * 100) + " %"}) y ${duenos.map((h) => h.id).join(", ")} es ${ratios.map((r) => Math.round(r * 1000) / 10 + " %").join(" · ")}`, span, ids); continue; }
        }
        else if (x.clase === "comparación") duenos = _conMultiplicador(x, [...de(["relacion"]), ...de(["orden"]).filter((h) => h.forma === "comparativo"), ...(/doble|triple|mitad|tercio|cuarto|veces|x$/i.test(x.texto) ? de(["razon"]) : []), ...u.hechos.filter((h) => (h.universoTipado && Array.isArray(h.universoTipado.filtros) && h.universoTipado.filtros.length) || (h.render && h.render.umbral != null))], veto, span, ids, spSinEnt, I);   // «superan {umbral}»: la comparación es el filtro del conteo
        if (x.clase === "comparación") { const sentido = /super|encima|m[aá]s\s+de|arriba|exced|rebas|sobre\s+el/i.test(x.texto) ? ">" : /debajo|bajo\s+el|menos\s+de|inferior|no\s+llegan/i.test(x.texto) ? "<" : null; if (sentido) for (const h of duenos) { const f = h.universoTipado && Array.isArray(h.universoTipado.filtros) && h.universoTipado.filtros[0]; if (f && f.op && String(f.op)[0] !== sentido) veto("direccion-contraria", `«${x.texto}» dice «${sentido}» y el filtro de ${h.id} es «${f.op}»`, span, [h.id]); } }
        else if (x.clase === "variación") duenos = [...de(["variacion"]), ...u.hechos.filter((h) => [...h.claves].some((c) => /^variacion|^vs_presupuesto|_anterior$/.test(c)))];   // la cifra de una métrica de variación también dice «crece» / «cae» / «año pasado»
        else if (x.clase === "duración") duenos = u.hechos.filter((h) => h.numeros.some((n) => n.unidad === "days"));
        else if (x.clase === "proporción") duenos = [...de(["razon", "conteo", "grupo"]), ...de(["relacion"]).filter((h) => /fraccion|parte|veces/.test(h.direccion || "") || h.numeros.some((n) => n.unidad === "ratio"))];
        /* la proporción dicha en palabras se contrasta con la cota de la casa sobre lo que la respalda (razón, conteo, grupo con el total del negocio) */
        if (x.clase === "proporción" && duenos.length) {
          const cota = L.cotaDeProporcion(x.texto) || L.cotaDeProporcion(_tokensAntes(spSinEnt, x.ini, 1).join(" ") + " " + x.texto);
          if (cota) { const ratios = duenos.map((h) => _ratioDe(h, I)).filter((r) => r != null); if (ratios.length && !ratios.some((r) => r >= cota.lo - 1e-9 && r <= cota.hi + 1e-9)) { veto("proporcion-fuera-de-cota", `«${x.texto}» dice ${cota.nombre} y ${duenos.map((h) => h.id).join(", ")} es ${ratios.map((r) => Math.round(r * 1000) / 10 + " %").join(" · ")}`, span, ids); continue; } }
        }
        /* el sujeto de un superlativo u ordinal es la entidad más cercana antes de la marca en su cláusula (o el sujeto de la oración): el dueño tiene que ser de esa entidad */
        if ((x.clase === "superlativo" || x.clase === "ordinal") && duenos.length && ents.length) {
          const claus = spSinEnt.slice(0, x.ini).split(/[;:]/).pop(); const ini0 = x.ini - claus.length;
          const antesE = ents.filter((e) => e.fin <= x.ini && e.ini >= ini0).sort((a, b) => b.fin - a.fin)[0] || null;
          const sujetoM = antesE || ents.slice().sort((a, b) => a.ini - b.ini)[0];
          const claveMarca = new Set(_metricasConPosicion(spSinEnt.slice(x.ini, Math.min(spSinEnt.length, x.fin + 30))).flatMap((mt) => [...mt.claves]));
          const duenosMarca = claveMarca.size ? duenos.filter((h) => [...h.claves].some((c) => claveMarca.has(c))) : duenos;   // «la que más te debe» es de cobranza: sus dueños son los de esa métrica
          if (claveMarca.size && !duenosMarca.length && duenos.length) { veto("sin-dueno", `«${x.texto}» habla de ${[...claveMarca].map(L.metricaDeClave).join("/")} y ningún orden de ${ids.join(", ")} es de esa métrica`, span, ids); continue; }
          if (sujetoM && roles.has(sujetoM.k) && duenosMarca.length) { const conS = duenosMarca.filter((h) => !h.roles.sujetos.length || h.roles.sujetos.map(normalizar).includes(sujetoM.k) || h.roles.miembros.map(normalizar).includes(sujetoM.k)); if (!conS.length && duenosMarca.every((h) => h.tipo === "orden" && h.roles.sujetos.filter((z) => z !== "negocio").length === 1)) { veto("sujeto-ajeno", `«${x.texto}» se dice de ${sujetoM.nombre} y ${duenosMarca.map((h) => h.id + " es de " + h.roles.sujetos.join("/")).join(", ")}`, span, ids); continue; } }
        }
        if (!duenos.length) veto("sin-dueno", `«${x.texto}» (${x.clase}) no tiene un hecho de su clase entre ${ids.join(", ")}: declara el ${x.clase === "superlativo" || x.clase === "ordinal" ? "orden" : x.clase === "comparación" ? "relacion" : x.clase === "variación" ? "variacion" : x.clase === "duración" ? "hecho con días" : "razon o conteo"} que lo dice, o sácalo del ancla`, span, ids);
      }
      /* un partitivo («de esos», «de los cuales», «de ese total») une dos hechos: exige la razón o la derivada que los une */
      if (!soloLectura && u.hechos.length >= 2 && /(?<![a-záéíóúñ])(?:de\s+es[oe]s|de\s+esas|de\s+los\s+cuales|de\s+las\s+cuales|de\s+ese\s+total|de\s+ah[ií]|de\s+ese\s+monto)(?![a-záéíóúñ])/i.test(spSinEnt) || (/(?<![a-záéíóúñ])de\s+(?:los|las|esos|esas|estos|estas)\s+\{([a-z][a-z0-9]*)\}/i.test(span) && (() => { const m = /(?<![a-záéíóúñ])de\s+(?:los|las|esos|esas|estos|estas)\s+\{([a-z][a-z0-9]*)\}/i.exec(span); const hh = m && H(m[1]); return !!(hh && /^(?:cifra|ref|derivada|grupo)$/.test(hh.tipo) && hh.numeros.some((x) => x.unidad === "money")); })()) && !de(["razon", "derivada"]).length && new Set(u.hechos.flatMap((h) => [...h.claves])).size > 1)
        veto("partitivo-sin-razon", `«de esos…» une hechos de métricas distintas (${ids.join(", ")}) sin la razón o la derivada que los relaciona`, span, ids);
      /* una propuesta (supuesto, objetivo) no se afirma en indicativo */
      if (de(["propuesta"]).length && !_hay(_RE.modalidad, spSinEnt) && !/(?<![a-záéíóúñ])(?:supuest|escenario|objetivo|hip[oó]tesis|proyecci[oó]n|simulaci[oó]n|criterio\s+m[ií]o|si\s+[a-záéíóúñ]+)/i.test(spSinEnt))
        veto("propuesta-en-indicativo", `${de(["propuesta"]).map((h) => h.id).join(", ")} es una propuesta y el ancla la afirma como hecho: dilo como supuesto, objetivo o condicional`, span, ids);
    }
    /* 5 · núcleo */
    for (const h of u.hechos) {
      if (u.placeholders.some((p) => p.id === h.id)) continue;
      let nucleo = true;
      if (h.tipo === "estado") nucleo = estadosSpan.some((e) => { const porForma0 = _formaDeEstadoEn(spSinEnt, e); const porForma = porForma0 && (porForma0 !== e.canon || /(?<![a-záéíóúñ])(?:ni|sin|no)(?![a-záéíóúñ])/i.test(e.texto)) ? porForma0 : null; if (porForma) return porForma === h.estado; const negs = _todos(_RE.negacion, spSinEnt.slice(0, e.ini)).length; const dicho = negs % 2 === 1 ? (complementoDe(e.canon) || `no ${e.canon}`) : e.canon; return dicho === h.estado || (h.estado === "inmovilizado" && (dicho === "frenado" || dicho === "sobrestock")); });
      else if (h.tipo === "orden") nucleo = _hay(_RE.superlativo, spSinEnt) || _hay(_RE.ordinal, spSinEnt) || _hay(_RE.comparativo, spSinEnt) || _hay(_RE.adjCasa, spSinEnt) || _RE_PEOR.test(spSinEnt) || _RE_MEJOR.test(spSinEnt)
        || (h.roles.sujetos.filter((x) => x !== "negocio").length >= 2 && h.roles.sujetos.filter((x) => x !== "negocio").every((x) => ents.some((e) => e.k === normalizar(x))));   // la enumeración de sus k sujetos ES el orden top-k
      else if (h.tipo === "relacion") nucleo = _hay(_RE.comparativo, spSinEnt) || _hay(_RE.proporcion, spSinEnt) || _hay(_RE.fraccionPalabra, spSinEnt) || _numerosEn(spSinEnt).length > 0 || (h.claves.has("umbral_materialidad") && _RE_MATERIAL.test(spSinEnt));   // «material» = sobre el umbral de materialidad (vocabulario de la casa)
      else if (h.tipo === "variacion") nucleo = _hay(_RE.variacion, spSinEnt) || _numerosEn(spSinEnt).length > 0;
      else if (h.tipo === "conteo") nucleo = _numerosEn(spSinEnt).length > 0 || _hay(_RE.numeroPalabra, spSinEnt) || /(?<![a-z])(?:ning[uú]n[oa]?|nadie|todas?|todos|no\s+(?:aparece|hay|figura|queda|tienes?|tenemos))(?![a-z])/i.test(spSinEnt)
        || (h.roles.sujetos.length >= 1 && Number.isFinite(+h.render.n) && +h.render.n === h.roles.sujetos.filter((x) => x !== "negocio").length && h.roles.sujetos.filter((x) => x !== "negocio").every((x) => ents.some((e) => e.k === normalizar(x))));   // la enumeración de sus n sujetos es el conteo
      else if (/^(?:cifra|ref|razon|derivada)$/.test(h.tipo)) nucleo = _numerosEn(spSinEnt).length > 0;
      if (!nucleo) veto("ancla-sin-nucleo", `el ancla de ${h.id} (${h.tipo}) no trae ni su valor ni una palabra de su clase: no afirma nada por sí misma`, span, [h.id]);
    }
    /* 6 · continuación */
    if (_hay(_RE.proforma, spSinEnt)) {
      const previa = [...unidades].reverse().find((x) => x.fin <= u.ini && x.tramo && u.tramo && x.tramo.parrafo === u.tramo.parrafo && x.hechos.length);
      const _firma = (h) => h.tipo + "|" + (h.estado || [...h.claves].sort().join(","));
      const pf0 = _todos(_RE.proforma, spSinEnt)[0]; const coordinada = !!pf0 && /(?:^|\s)(?:y|e|pero|aunque|ni)\s*$/i.test(spSinEnt.slice(Math.max(0, pf0.ini - 8), pf0.ini));   /* «y también concentran…» coordina dentro de la oración: no continúa la anterior */
      if (previa && !coordinada) { const firmas = [...new Set(previa.hechos.filter((h) => /^(?:estado|orden|relacion|variacion)$/.test(h.tipo)).map(_firma))]; if (firmas.length && !u.hechos.some((h) => firmas.includes(_firma(h)))) veto("continuacion-sin-hecho", `«${_todos(_RE.proforma, spSinEnt)[0].texto}» continúa ${firmas.join(" / ")} y el ancla de ${ids.join(", ")} no trae uno de la misma clase y métrica`, span, ids); }
      /* dentro del ancla: «Jumbo está al día y Falabella también» — el segundo sujeto necesita su propio hecho de esa clase */
      { const pf = _todos(_RE.proforma, spSinEnt)[0]; const entAntes = pf ? ents.filter((e) => e.fin <= pf.ini).sort((a, b) => b.fin - a.fin)[0] : null;
        if (pf && entAntes && _palabras(spSinEnt.slice(entAntes.fin, pf.ini)).length <= 1) { const clasesU = new Set([...u.hechos, ...(previa ? previa.hechos : [])].filter((h) => /^(?:estado|orden|relacion|variacion)$/.test(h.tipo)).map((h) => h.tipo)); if (clasesU.size && !u.hechos.some((h) => clasesU.has(h.tipo) && h.roles.sujetos.map(normalizar).includes(entAntes.k))) veto("continuacion-sin-hecho", `«${entAntes.nombre} ${pf.texto}» continúa un ${[...clasesU].join("/")} y ${entAntes.nombre} no tiene ese hecho en el ancla`, span, ids); } }
    }
  }

  /* 6b · una oración sin anclas que abre con una proforma («También Jumbo.», «Tampoco Falabella…») continúa el hecho de la oración anterior: sin hecho propio, no afirma nada */
  for (let i = 1; i < tramos.length; i++) {
    const t = tramos[i], prev = tramos[i - 1];
    if (unidades.some((u) => u.tramo === t) || !unidades.some((u) => u.tramo === prev) || t.parrafo !== prev.parrafo) continue;
    const lt = libre.slice(t.ini, t.fin);
    const ltB = _blanquear(lt, _entidadesEn(lt, nombres, alias));
    if (/^\s*(?:[-*•]\s+)?(?:y\s+|pero\s+)?(?:□+\s*[,:]?\s*)?(?:tambi[eé]n|tampoco|igual(?:mente)?|lo\s+mismo|[ií]dem|asimismo|otro\s+tanto|del\s+mismo\s+modo|de\s+igual\s+forma)(?![a-záéíóúñ])/i.test(ltB) && _entidadesEn(lt, nombres, alias).length) veto("continuacion-sin-hecho", `«${t.texto.slice(0, 60)}» continúa el hecho de la oración anterior sin un hecho propio anclado`, t.texto);
  }
  /* 7 · operadores fuera del ancla (pegados a un ancla en su oración) */
  for (const t of tramos) {
    const us = unidades.filter((u) => u.tramo === t);
    if (!us.length) continue;
    const lt = libre.slice(t.ini, t.fin);
    const _nomNo = [..._todos(_RE_NOMBRE_CON_NO, lt), ..._mascaraDeLaCasa(lt)];
    const ops = [..._todos(_RE.negacion, lt).filter((x) => !_nomNo.some((m) => m.ini <= x.ini && x.fin <= m.fin)).map((x) => ({ ...x, clase: "negación" })), ..._todos(_RE.tiempo, lt).filter((x) => !_nomNo.some((m) => m.ini <= x.ini && x.fin <= m.fin)).map((x) => ({ ...x, clase: "tiempo" })), ..._todos(_RE.modalidad, lt).map((x) => ({ ...x, clase: "modalidad" })), ..._todos(_RE.proforma, lt).map((x) => ({ ...x, clase: "continuación" })), ..._todos(_RE.proporcion, lt).map((x) => ({ ...x, clase: "proporción" })), ..._todos(_RE.proporcionSubjetiva, lt).map((x) => ({ ...x, clase: "proporción" }))];
    for (const x of ops) {
      const pos = t.ini + x.ini, fin = t.ini + x.fin;
      /* el alcance de un operador es su CLÁUSULA: la del ancla (sin cortes por «:», «;», «—», paréntesis ni nota al pie entre medio) */
      const pegado = us.some((u) => { const entre = fin <= u.ini ? s.slice(fin, u.ini) : pos >= u.fin ? s.slice(u.fin, pos) : ""; if (fin > u.ini && pos < u.fin) return false; return !/[:;—()]|\[\^/.test(entre) && _palabras(entre).length <= (x.clase === "negación" || x.clase === "modalidad" ? 12 : 8); });
      if (pegado) veto("operador-fuera-del-ancla", `«${x.texto}» (${x.clase}) cambia el sentido de un hecho anclado y queda fuera del ancla`, s.slice(Math.max(t.ini, pos - 30), Math.min(t.fin, fin + 30)));
    }
  }

  /* 8 · dueño estructural y visibilidad del sujeto (con anáfora al ancla anterior del mismo párrafo) */
  const _duenosDeListas = new Set(s.split("\n").filter((l) => /^\s*(?:[-*•]|\d{1,2}[.)])\s+|^\s*\|/.test(l)).flatMap((l) => _entidadesEn(l, nombres, alias).map((e) => e.k)));
  const _entsDelTexto = new Set(_entidadesEn(s, nombres, alias).map((e) => e.k));
  for (const u of unidades) {
    if (!u.hechos.length) continue;
    const t = u.tramo;
    const entsAncla = new Set(_entidadesEn(_sinPlaceholders(u.inner), nombres, alias).map((e) => e.k));
    const dueno = duenoEstructural(u.ini);
    const entsTramo = t ? _entidadesEn(s.slice(t.ini, t.fin), nombres, alias).map((e) => ({ ...e, ini: e.ini + t.ini, fin: e.fin + t.ini })) : [];
    for (const h of u.hechos) {
      if (/^(?:conteo|lectura|propuesta)$/.test(h.tipo)) continue;
      if (h.tipo === "grupo" && t && /(?<![a-záéíóúñ])(?:total(?:es)?|subtotal|suma|junt[oa]s|entre\s+(?:los|las)\s+(?:dos|tres|cuatro|cinco))(?![a-záéíóúñ])/i.test(t.lineaTexto || t.texto)) continue;
      if (h.tipo === "grupo" && _grupoNombrado(h, t ? (t.lineaTexto || t.texto) : u.inner, libro)) continue;   // un subtotal nombrado por su conjunto («en carga comercial alta, $655K») no enumera a sus miembros
      const S = h.tipo === "grupo" ? h.roles.miembros.map(normalizar) : h.roles.sujetos.filter((x) => x !== "negocio").map(normalizar);
      /* la línea que encabeza una lista: los dueños de las viñetas que siguen (hasta la línea en blanco) son los sujetos visibles del hecho */
      const hijos = (() => {
        if (S.length < 2 || !t) return null;
        const finLinea = s.indexOf("\n", u.fin); if (finLinea < 0) return null;
        const out = new Set(); let p = finLinea + 1;
        while (p < s.length) { const q = s.indexOf("\n", p); const linea = s.slice(p, q < 0 ? s.length : q); if (!linea.trim()) break; if (!/^\s*(?:[-*•]|\d{1,2}[.)])\s+|^\s*\|/.test(linea)) break; for (const e of _entidadesEn(linea, nombres, alias)) out.add(e.k); if (q < 0) break; p = q + 1; }
        return out.size ? out : null;
      })();
      if (hijos && S.every((k) => hijos.has(k) || entsAncla.has(k))) continue;
      /* un top-k o grupo cuyos miembros son los dueños de las viñetas o filas de la respuesta (en cualquier parte): la lista es su evidencia */
      if (S.length >= 2 && S.every((k) => entsAncla.has(k) || _duenosDeListas.has(k))) continue;
      /* un hecho de varios sujetos anclado en una frase que se refiere a ellos («por qué cada uno está frenado»): visibles si TODOS están nombrados en la respuesta */
      if (S.length >= 2 && S.every((k) => entsAncla.has(k) || _entsDelTexto.has(k))) continue;
      for (const k of S) {
        if (entsAncla.has(k)) continue;
        if (dueno && dueno.k === k) continue;
        if (h.tipo === "relacion" && h.roles.vs.map(normalizar).includes(k)) continue;
        const eje = ejeDe(k);
        const mismosEje = [...new Set(entsTramo.filter((e) => ejeDe(e.k) === eje).map((e) => e.k))];
        if (mismosEje.length === 1 && mismosEje[0] === k) continue;   // la única entidad del eje en la oración
        /* anáfora por adyacencia: el ancla anterior del mismo párrafo nombra al sujeto y no hay otra entidad del eje entre medio */
        const previa = [...unidades].reverse().find((x) => x.fin <= u.ini && x.tramo && t && x.tramo.parrafo === t.parrafo && x.hechos.some((hh) => hh.entidades.has(k)));
        const ajenasEnAncla = [...entsAncla].filter((e) => !h.entidades.has(e));
        if (previa && !ajenasEnAncla.length) { const entre = _entidadesEn(s.slice(previa.fin, u.ini), nombres, alias).filter((e) => ejeDe(e.k) === eje && e.k !== k); if (!entre.length) continue; }
        veto("sujeto-invisible", `${h.id} es de ${(I && I.entidades.get(k) || { nombre: k }).nombre} y ni el ancla ni la fila/viñeta ni la oración lo nombran solo`, u.inner, [h.id]);
      }
    }
    if (t) {
      const roles = new Set(u.hechos.flatMap((h) => [...h.entidades]));
      for (const e of entsTramo) {
        if (enUnidad(e.ini) || roles.has(e.k)) continue;
        const entre = e.ini >= u.fin ? s.slice(u.fin, e.ini) : s.slice(e.fin, u.ini);
        if (_palabras(entre).length > 4 || /[.;!?]/.test(entre) || (e.ini >= u.fin && /[.;!?]\s*$/.test(u.inner))) continue;
        const contenido = _palabras(entre).filter((w) => !_COPULA.has(w));
        if (!contenido.length) veto("entidad-pegada-al-ancla", `«${e.nombre}» queda pegada al ancla de ${u.hechos.map((h) => h.id).join(", ")} sin ser parte del hecho: la atribución por vecindad no vale`, s.slice(Math.min(u.ini, e.ini), Math.max(u.fin, e.fin)), u.hechos.map((h) => h.id));
      }
    }
  }

  /* 9 · columnas y rótulos */
  _comprobarTablas(s, unidades, veto, (txt) => _entidadesEn(txt, nombres, alias).length > 0, I);
  for (const t of tramos) {
    if (t.tipo !== "vineta" && t.tipo !== "celda") continue;
    const m = /^\s*(?:[-*•]|\d+[.)])?\s*\*{0,2}([^:{}|\n]{2,40}?)\*{0,2}\s*:\s*(?=\{|⟦)/.exec(t.texto);
    if (!m) continue;
    const us = unidades.filter((u) => u.tramo === t);
    if (!us.length) continue;
    const rotulo = _blanquear(m[1], _entidadesEn(m[1], nombres, alias)).replace(new RegExp(_BLANCO, "g"), " ").replace(/\s*·\s*/g, " ");
    if (!rotulo.trim()) continue;
    const claves = new Set(us.flatMap((u) => u.hechos.flatMap((h) => [...h.claves])));
    const estados = new Set(us.flatMap((u) => u.hechos.map((h) => h.estado).filter(Boolean)));
    const nombra = _metricasConPosicion(rotulo).some((mt) => [...mt.claves].some((c) => claves.has(c))) || _estadosEnSpan(rotulo).some((e) => estados.has(e.canon));
    if (!nombra && (claves.size || estados.size)) veto("rotulo-sin-metrica", `el rótulo «${rotulo.trim()}» no nombra la métrica del hecho con vocabulario de la casa (${[...claves].map(L.metricaDeClave).join(", ") || [...estados].join(", ")})`, t.texto, us.flatMap((u) => u.hechos.map((h) => h.id)));
  }

  /* 10 · predicación por dominio: una entidad + una palabra de un dominio exige un hecho de ese dominio para esa entidad en la respuesta */
  {
    const vistos = new Set();
    for (const u of unidades) for (const h of u.hechos) { const ds = new Set([h.dominio, ...[...h.claves].map(L.dominioDeClave)].filter(Boolean)); if (h.estado) { const d = /^(?:al dia|en mora|sin deuda|sin pagos|buen pagador|mal pagador)$/.test(h.estado) ? "cobranza" : /^(?:sin contribucion|sin margen)$/.test(h.estado) ? "comercial" : "inventario"; ds.add(d); } for (const k of h.entidades) for (const d of ds) vistos.add(k + "|" + d); }
    for (const t of tramos) {
      const ents = _entidadesEn(_sinPlaceholders(s.slice(t.ini, t.fin)), nombres, alias).filter((e) => /^(?:cliente|sku|bodega|marca|familia)$/.test(String(ejeDe(e.k) || "")));
      if (!ents.length) continue;
      for (const [d, re] of Object.entries(_RE.dominio)) {
        /* la palabra de dominio dentro del nombre de una métrica de OTRO dominio («venta» en «días sin venta») o de una frase de estado no predica ese dominio */
        const metsT = _metricasConPosicion(t.texto), estsT = _estadosEnSpan(t.texto);
        const tapada = (y) => metsT.some((mt) => mt.ini <= y.ini && y.fin <= mt.fin && [...mt.claves].some((c) => L.dominioDeClave(c) && L.dominioDeClave(c) !== d)) || estsT.some((e) => e.ini <= y.ini && y.fin <= e.fin);
        const x = _todos(re, t.texto).find((y) => !_CONDICIONAL.test(y.texto) && !tapada(y));
        if (!x) continue;
        for (const e of ents) if (!vistos.has(e.k + "|" + d)) { veto("predicacion-sin-hecho", `la oración habla de ${d} sobre ${e.nombre} («${x.texto}») sin un hecho de ${d} de ${e.nombre} anclado en la respuesta`, t.texto, []); break; }
      }
    }
  }

  const R = renderizar(s, libro);
  const medidas = { anclas: P.anclas.length, sueltos: P.sueltos.length, hechosAnclados: new Set(unidades.flatMap((u) => u.hechos.map((h) => h.id))).size, hechosDelLibro: libro && libro.hechos ? libro.hechos.filter((h) => !h.derivadoDe).length : 0, vetos: V.length, porClase: V.reduce((acc, v) => { acc[v.kind] = (acc[v.kind] || 0) + 1; return acc; }, {}) };
  return { ok: V.length === 0, violations: V, medidas, servido: R.texto, faltantes: R.faltantes };
}

/* tablas markdown: columnas homogéneas, cabecera = métrica de la columna (sin puentes), celdas booleanas bajo cabecera de estado */
function _comprobarTablas(s, unidades, veto, esEntidad = () => false, I = null) {
  const lineas = []; { let off = 0; for (const l of s.split("\n")) { lineas.push({ texto: l, ini: off }); off += l.length + 1; } }
  let i = 0;
  while (i < lineas.length) {
    if (!/^\s*\|/.test(lineas[i].texto)) { i++; continue; }
    const filas = []; while (i < lineas.length && /^\s*\|/.test(lineas[i].texto)) { filas.push(lineas[i]); i++; }
    const cuerpo = filas.filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l.texto));
    if (cuerpo.length < 2) continue;
    const celdas = (l) => { const out = []; const re = /\|([^|]*)/g; let m; while ((m = re.exec(l.texto))) out.push({ texto: m[1].trim(), ini: l.ini + m.index + 1 + (m[1].length - m[1].trimStart().length), fin: l.ini + m.index + 1 + m[1].length }); return out.filter((c, k, arr) => !(k === arr.length - 1 && !c.texto)); };
    const cab = celdas(cuerpo[0]);
    const datos = cuerpo.slice(1).map(celdas);
    /* transpuesta (columna = entidad, fila = métrica): se juzga por filas, con el rótulo de la fila como cabecera */
    if (cab.slice(1).some((c) => esEntidad(c.texto))) {
      for (const fila of datos) {
        const rot = (fila[0] && fila[0].texto || "").replace(/\*\*|__|`/g, "");
        const hechosFila = []; for (const c of fila.slice(1)) for (const u of unidades) if (u.ini >= c.ini && u.fin <= c.fin) for (const h of u.hechos) hechosFila.push(h);
        if (!hechosFila.length) continue;
        const mets = _metricasConPosicion(rot), est = _estadosEnSpan(rot);
        if (/\s\/\s/.test(rot)) { const partes = rot.split(/\s\/\s/).map((p) => new Set(_metricasConPosicion(p).flatMap((m) => [...m.claves]))); for (const c of fila.slice(1)) { const idsC = [...c.texto.matchAll(/\{([a-z][a-z0-9]*)(?:\.[a-z]+)?\}/gi)].map((m) => m[1]); if (idsC.length !== partes.length) continue; idsC.forEach((id, k) => { const hh = unidades.flatMap((u) => u.hechos).find((h) => h.id === id); if (hh && partes[k].size && ![...hh.claves].some((cl) => partes[k].has(cl))) veto("columna-ajena", `en la fila «${rot}» la posición ${k + 1} es «${[...partes[k]].map(L.metricaDeClave).join("/")}» y lleva ${id} (${[...hh.claves].map(L.metricaDeClave).join(", ")})`, c.texto, [id]); }); } continue; }
        if ((est.length && !mets.some((m) => m.claves.size)) || /\?/.test(rot)) { for (const c of fila.slice(1)) if (c.texto && !unidades.some((u) => u.ini >= c.ini && u.fin <= c.fin && u.hechos.some((h) => h.tipo === "estado"))) veto("celda-sin-estado", `en la fila «${rot}» la celda «${c.texto}» no es un hecho de estado anclado`, c.texto); continue; }
        if (mets.length) { const cl = new Set(mets.flatMap((m) => [...m.claves])); for (const h of hechosFila) if (h.tipo !== "estado" && h.claves.size && ![...h.claves].some((c) => cl.has(c))) veto("columna-ajena", `en la fila «${rot}» va ${h.id} (${[...h.claves].map(L.metricaDeClave).join(", ")}): la fila es «${[...cl].map(L.metricaDeClave).join("/")}» y no admite otra métrica`, rot, [h.id]); }
        else { const sets = new Set(hechosFila.filter((h) => h.tipo !== "estado").map((h) => [...h.claves].sort().join("|")).filter(Boolean)); if (sets.size > 1) veto("columna-mezclada", `en la fila «${rot}» hay hechos de métricas distintas: una fila es una sola métrica y su rótulo la nombra`, rot, hechosFila.map((h) => h.id)); }
      }
      continue;
    }
    /* la fila «Total» es el total de la columna: un grupo parcial (menos miembros que entidades con esa métrica en la boleta) no es el total */
    for (const fila of datos) {
      if (!/^\**\s*total(?:es)?\s*\**$/i.test(((fila[0] && fila[0].texto) || "").trim())) continue;
      for (const c of fila.slice(1)) for (const u of unidades) if (u.ini >= c.ini && u.fin <= c.fin) for (const h of u.hechos) {
        if (h.tipo !== "grupo" || !I) continue;
        const clave = [...h.claves][0]; if (!clave) continue;
        let fs = []; try { fs = I.figsDeMetrica(L.metricaDeClave(clave), null) || []; } catch { fs = []; }
        const conMetrica = new Set(fs.filter((g) => g.entidad).map((g) => normalizar(g.entidad)));
        const filasDato = datos.filter((f) => !/^\**\s*total(?:es)?\s*\**$/i.test(((f[0] && f[0].texto) || "").trim()) && f.slice(1).some((x) => x.texto));
        if (filasDato.length && h.roles.miembros.length !== filasDato.length) veto("total-parcial", `la fila «Total» lleva ${h.id}, la suma de ${h.roles.miembros.join(" + ")} (${h.roles.miembros.length}), y la tabla muestra ${filasDato.length} filas: el total no suma lo que se ve`, c.texto, [h.id]);
        void conMetrica;
      }
    }
    for (let col = 1; col < cab.length; col++) {
      const header = cab[col].texto.replace(/\*\*|__|`/g, "");
      const hechosCol = [], celdasCol = [];
      for (const fila of datos) { const c = fila[col]; if (!c || !c.texto) continue; celdasCol.push(c); for (const u of unidades) if (u.ini >= c.ini && u.fin <= c.fin) for (const h of u.hechos) hechosCol.push(h); }
      if (!hechosCol.length) continue;
      const claveSets = hechosCol.filter((h) => h.tipo !== "estado").map((h) => [...h.claves].sort().join("|")).filter(Boolean);
      const metsCab = _metricasConPosicion(header);
      const estCab = _estadosEnSpan(header);
      if (/\?/.test(header) || (estCab.length && !metsCab.some((m) => m.claves.size))) {   // «Capital frenado» es una métrica, no una columna de estado
        for (const c of celdasCol) if (!unidades.some((u) => u.ini >= c.ini && u.fin <= c.fin && u.hechos.some((h) => h.tipo === "estado"))) veto("celda-sin-estado", `bajo la cabecera «${header}» la celda «${c.texto}» no es un hecho de estado anclado`, c.texto);
        continue;
      }
      if (metsCab.length) {
        const clavesCab = new Set(metsCab.flatMap((m) => [...m.claves]));
        if (clavesCab.size > 1 && new Set(claveSets).size > 1) veto("columna-mezclada", `bajo la cabecera «${header}» (genérica: ${[...clavesCab].map(L.metricaDeClave).join("/")}) hay hechos de métricas distintas (${[...new Set(claveSets)].map((x) => x.split("|").map(L.metricaDeClave).join("+")).join(" vs ")}): la cabecera tiene que decir cuál`, header, hechosCol.map((h) => h.id));
        for (const h of hechosCol) if (h.tipo !== "estado" && h.claves.size && ![...h.claves].some((c) => clavesCab.has(c))) veto("columna-ajena", `bajo la cabecera «${header}» va ${h.id} (${[...h.claves].map(L.metricaDeClave).join(", ")}): la columna es «${[...clavesCab].map(L.metricaDeClave).join("/")}» y no admite otra métrica`, header, [h.id]);
      } else if (new Set(claveSets).size > 1) {
        veto("columna-mezclada", `bajo la cabecera «${header}» hay hechos de métricas distintas (${[...new Set(claveSets)].map((x) => x.split("|").map(L.metricaDeClave).join("+")).join(" vs ")}): una columna es una sola métrica y su cabecera la nombra`, header, hechosCol.map((h) => h.id));
      }
    }
  }
}

export const CLASES_DE_VETO = ["sin-dueno", "lectura-con-hecho", "multiplicador-ajeno", "metrica-heredada", "matiz-ajeno", "recomendacion-sin-apoyo", "operacion-ajena", "proporcion-fuera-de-cota", "sujeto-ajeno", "universo-ajeno", "eje-ajeno", "bodega-sin-hecho", "bodega-ajena", "grupo-atribuido-a-uno", "recomendacion-en-hecho", "total-parcial", "periodo-invisible", "puesto-ajeno", "partitivo-sin-razon", "propuesta-en-indicativo", "m-sin-n", "orden-distributivo", "ancla-mal-formada", "hecho-desconocido", "hecho-invalido", "placeholder-sin-render", "hecho-sin-ancla", "entidad-ajena", "numero-ajeno", "metrica-ajena", "metrica-cruzada", "ancla-ambigua", "estado-ajeno", "direccion-contraria", "lados-invertidos", "base-sin-metrica", "base-ajena", "universo-invisible", "base-invisible", "pronombre-en-ancla", "dominio-cruzado", "negacion-en-ancla", "periodo-ajeno", "modalidad-en-ancla", "proporcion-sin-razon", "ancla-sin-nucleo", "continuacion-sin-hecho", "operador-fuera-del-ancla", "sujeto-invisible", "entidad-pegada-al-ancla", "rotulo-sin-metrica", "celda-sin-estado", "columna-ajena", "columna-mezclada", "predicacion-sin-hecho"];
