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
import { estadoCanon, ESTADO_NOMBRADO_SRC, ESTADO_PROSA_SRC, complementoDe, ESTADOS_CANON } from "./estados.js";
import { renderDe } from "./hechos.js";
import * as L from "./lexico.js";

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
const MAYOR_SRC = "(?:m[aá]s|mayor(?:es)?|supera|superan|lidera|encabeza|primer[oa]?|arriba|encima|duplica|el\\s+doble|crece|sube|m[aá]s\\s+alt|m[aá]s\\s+grande)";
const MENOR_SRC = "(?:menos|menor(?:es)?|[uú]ltim[oa]|debajo|abajo|la\\s+mitad|cae|baja|m[aá]s\\s+baj|m[aá]s\\s+chic|m[aá]s\\s+peque)";
const _RE_MAYOR = new RegExp(B + MAYOR_SRC + E, "i"), _RE_MENOR = new RegExp(B + MENOR_SRC + E, "i");
const _RE_PEOR = /(?<![a-záéíóúñ])peor(?:es)?(?![a-záéíóúñ])/i, _RE_MEJOR = /(?<![a-záéíóúñ])mejor(?:es)?(?![a-záéíóúñ])/i;
const BASE_DE_TASA = { margen: "ventas", margen_promedio: "ventas", markup: "costo", peso_costo: "ventas", carga: "ventas", recuperado: "ventas", umbral_materialidad: "ventas", variacion: "ventas_anterior", vs_presupuesto: "presupuesto", margen_inventario: "costo", benchmark: "ventas" };
const _CONDICIONAL = /r[ií]a(?:n|s|mos|is)?$/i;
const _BLANCO = "□";

/* ═══ 1 · EL PARSER ═══ */
const _ID = /^[a-z][a-z0-9]*$/i;
/** parsearAnclas(prosa) → { anclas: [{ini, fin, ids, inner, innerIni, innerFin, placeholders}], sueltos: [{id, campo, ini, fin}], errores } */
const _PERIODO_VIGENTE = "actual";   // el período de la boleta (no es un escenario: el gate del colapso barre el literal como default)
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
  for (const a of [...P.anclas].sort((x, y) => x.ini - y.ini)) { out += sust(s.slice(pos, a.ini)); out += _canonTexto(sust(a.inner.replace(/^\s+/, ""))); pos = a.fin; }
  out += sust(s.slice(pos));
  return { texto: out.replace(/[ \t]+\n/g, "\n"), faltantes };
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
    if (k === "pendiente" && !/pendiente/.test(w)) { for (const c of L.CLAVES_GENERICAS_DE_COBRANZA) out.add(c); continue; }
    for (const c of L.clavesPorPalabraDelMuro(k)) out.add(c);
  }
  return out;
}
function _metricasConPosicion(texto) {
  const out = [];
  const re = /[a-záéíóúñ]+/gi; const toks = []; let m;
  while ((m = re.exec(texto))) toks.push({ w: m[0], ini: m.index, fin: m.index + m[0].length });
  const usados = new Set();
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + n <= toks.length; i++) {
      if ([...Array(n).keys()].some((j) => usados.has(i + j))) continue;
      const win = texto.slice(toks[i].ini, toks[i + n - 1].fin);
      let claves = null; try { claves = metricasEn(win); } catch { claves = null; }
      if (!claves || !claves.size) continue;
      if (n > 1) { const solo = [...claves].filter((k) => { const c1 = metricasEn(toks[i].w), cN = metricasEn(toks[i + n - 1].w); return !(c1.has(k) || cN.has(k)); }); if (!solo.length) continue; }
      out.push({ ini: toks[i].ini, fin: toks[i + n - 1].fin, texto: win, muro: [...claves], claves: _clavesDeVentana(win, claves) });
      for (let j = 0; j < n; j++) usados.add(i + j);
    }
  }
  return out.sort((a, b) => a.ini - b.ini);
}
const _numerosEn = (texto) => {
  const out = []; const t = menosAscii(texto);
  for (const f of parseFigures(t)) { let p = t.indexOf(f.text); while (p >= 0) { if (!out.some((x) => x.ini === p)) out.push({ ini: p, fin: p + f.text.length, texto: f.text, raw: f.raw, unidad: f.unit, canon: f.canon }); p = t.indexOf(f.text, p + 1); } }
  const re = /(?<![\d.,$%\w\-])(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)(?![\d.,]*(?:%|pp|[KMBx]\b))(?![a-záéíóúñ0-9\-])/gi; let m;
  while ((m = re.exec(t))) if (!out.some((x) => m.index >= x.ini && m.index < x.fin)) { const raw = /^\d{1,3}(?:[.,]\d{3})+$/.test(m[1]) ? parseInt(m[1].replace(/[.,]/g, ""), 10) : parseFloat(m[1].replace(",", ".")); out.push({ ini: m.index, fin: m.index + m[0].length, texto: m[0], raw, unidad: "count", canon: null, pelado: true }); }
  _RE.numeroPalabra.lastIndex = 0; while ((m = _RE.numeroPalabra.exec(t))) { const v = _valorEnPalabras(m[0]); if (v) out.push({ ini: m.index, fin: m.index + m[0].length, texto: m[0], raw: v.raw, unidad: v.unidad, canon: null, enPalabras: true, matiz: v.matiz }); }
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
const _todos = (re, t) => { const out = []; re.lastIndex = 0; let m; while ((m = re.exec(t))) { out.push({ ini: m.index, fin: m.index + m[0].length, texto: m[0] }); if (!m[0].length) re.lastIndex++; } return out; };
const _dentroDe = (x, lista) => lista.some((y) => x.ini >= y.ini && x.fin <= y.fin);

/* ═══ LAS COMPROBACIONES ═══ */
/** comprobarAnclas(prosa, libro, { nombres, alias }) → { ok, violations: [{kind, detail, texto, ids}], medidas, servido, faltantes } */
export function comprobarAnclas(prosa, libro, ctx = {}) {
  const s = String(prosa || "");
  const V = [];
  const veto = (kind, detail, texto = "", ids = []) => { V.push({ kind, detail: `${kind}: ${detail}`, texto: String(texto || "").replace(new RegExp(_BLANCO, "g"), "").slice(0, 80), ids }); };
  const I = libro && libro.indice;
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
    unidades.push({ ...a, hechos: [...new Map(hechos.map((h) => [h.id, h])).values()], tipo: "ancla" });
  }
  for (const p of P.sueltos) {
    const Hh = H(p.id);
    if (!Hh) { veto("hecho-desconocido", `{${p.id}} no está en el libro`, s.slice(p.ini, p.fin), [p.id]); continue; }
    if (!Hh.ok) { veto("hecho-invalido", `{${p.id}} ${Hh.veredicto === "falsa" ? "es FALSO" : "no es verificable"} y no puede escribirse`, s.slice(p.ini, p.fin), [p.id]); continue; }
    if (renderDe(libro, p.id, p.campo) == null) veto("placeholder-sin-render", `{${p.id}.${p.campo}} no tiene valor que escribir`, s.slice(p.ini, p.fin), [p.id]);
    unidades.push({ ini: p.ini, fin: p.fin, ids: [p.id], inner: s.slice(p.ini, p.fin), innerIni: p.ini, innerFin: p.fin, placeholders: [p], hechos: [Hh], tipo: "suelto" });
  }
  unidades.sort((a, b) => a.ini - b.ini);
  const tramos = _tramos(s);
  const tramoDe = (pos) => tramos.find((t) => pos >= t.ini && pos < t.fin) || null;
  for (const u of unidades) u.tramo = tramoDe(u.ini);
  const estructura = (() => { try { return duenosEstructurales(s, nombres); } catch { return []; } })();
  const duenoEstructural = (pos) => { const t = estructura.find((x) => x.dueno && pos >= x.ini && pos < x.fin); return t ? { nombre: t.dueno, k: normalizar(t.dueno), tipo: t.tipo, metrica: t.metrica } : null; };
  const libre = _blanquear(s, unidades);
  const enUnidad = (pos) => unidades.some((u) => pos >= u.ini && pos < u.fin);

  /* 3 · fuera de las anclas no hay léxico de hecho */
  const tramoTieneHecho = (t) => unidades.some((u) => u.tramo === t);
  for (const t of tramos) {
    const lt = libre.slice(t.ini, t.fin);
    if (!lt.replace(new RegExp(_BLANCO, "g"), "").trim() || /^\s*\|?\s*:?-{2,}/.test(t.texto)) continue;
    const ents = _entidadesEn(lt, nombres, alias);
    const ltSinEnt = _blanquear(lt, ents);
    const contexto = t.tipo === "celda" ? t.lineaTexto : lt;
    const conCasa = _entidadesEn(contexto, nombres, alias).length || _hay(_RE.verboCasa, contexto) || _metricasConPosicion(contexto).length || duenoEstructural(t.ini) || tramoTieneHecho(t) || (t.tipo === "celda" && /\{/.test(t.lineaTexto));
    /* números */
    _RE.digito.lastIndex = 0; let m;
    while ((m = _RE.digito.exec(ltSinEnt))) {
      const frag = m[0]; if (!/\d/.test(frag)) continue;
      if (/^\s*\d{1,2}[.)]\s/.test(lt.slice(m.index)) && /^\s*$/.test(lt.slice(0, m.index))) continue;   // enumerador
      if (/\b(?:19|20)\d\d\b/.test(frag)) continue;   // año
      if (/^\s*\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)/i.test(lt.slice(m.index))) continue;   // fecha
      veto("hecho-sin-ancla", `la cifra «${frag.trim()}» está fuera de un ancla`, lt.slice(Math.max(0, m.index - 30), m.index + frag.length + 20));
    }
    for (const x of _todos(_RE.numeroPalabra, ltSinEnt)) if (!_hay(_RE.modismo, lt.slice(Math.max(0, x.ini - 12), x.fin + 12))) veto("hecho-sin-ancla", `«${x.texto}» es una cifra en palabras fuera de un ancla`, lt.slice(Math.max(0, x.ini - 30), x.fin + 20));
    if (conCasa) for (const x of _todos(_RE.fraccionPalabra, ltSinEnt)) veto("hecho-sin-ancla", `«${x.texto}» es una proporción fuera de un ancla`, lt.slice(Math.max(0, x.ini - 30), x.fin + 20));
    for (const x of _estadosEnSpan(ltSinEnt, _RE_ESTADO_PROSA)) veto("hecho-sin-ancla", `«${x.texto}» es un estado de la casa fuera de un ancla`, lt.slice(Math.max(0, x.ini - 30), x.fin + 20));
    const modismos = _todos(_RE.modismo, ltSinEnt);
    const marcas = [..._todos(_RE.superlativo, ltSinEnt).map((x) => ({ ...x, clase: "superlativo" })), ..._todos(_RE.comparativo, ltSinEnt).map((x) => ({ ...x, clase: "comparación" })), ..._todos(_RE.adjCasa, ltSinEnt).map((x) => ({ ...x, clase: "superlativo" })), ..._todos(_RE.ordinal, ltSinEnt).map((x) => ({ ...x, clase: "ordinal" })), ..._todos(_RE.variacion, ltSinEnt).filter((x) => !_CONDICIONAL.test(x.texto)).map((x) => ({ ...x, clase: "variación" })), ..._todos(_RE.duracion, ltSinEnt).map((x) => ({ ...x, clase: "duración" })), ..._todos(_RE.proporcion, ltSinEnt).map((x) => ({ ...x, clase: "proporción" }))];
    for (const x of marcas) {
      if (_dentroDe(x, modismos)) continue;
      if (x.clase === "ordinal") { const tras = _tokensDespues(lt, x.fin, 2).join(" "), antes = _tokensAntes(lt, x.ini, 2).join(" "); if (!/cuenta|cliente|sku|puesto|lugar|posici|\ben\b|\bde\b|mayor|menor|deudor|vendedor/.test(tras + " " + antes) || !conCasa) continue; }
      if (x.clase === "proporción" && _hay(_RE.proporcionSubjetiva, x.texto) && !tramoTieneHecho(t)) continue;
      if ((x.clase === "superlativo" || x.clase === "comparación" || x.clase === "variación" || x.clase === "proporción") && !conCasa) continue;
      veto("hecho-sin-ancla", `«${x.texto}» (${x.clase}) está fuera de un ancla`, lt.slice(Math.max(0, x.ini - 30), x.fin + 25));
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
    for (const e of ents) if (!roles.has(e.k)) veto("entidad-ajena", `«${e.nombre}» está dentro del ancla de ${ids.join(", ")} y no es parte de ese hecho`, span, ids);
    /* 4b números, a su precisión (un pp dicho como % es otro canon) */
    for (const n of _numerosEn(spSinEnt)) {
      const cabe = numeros.some((x) => Number.isFinite(x.raw) && (n.pelado ? Math.abs(x.raw - n.raw) < 1e-9 : (_u(x.unidad) === _u(n.unidad) && !(x.unidad === "pp" && n.unidad === "pct" && !/pp|puntos/.test(n.texto)) && !(x.unidad === "pct" && n.unidad === "pp") && mismoValor({ texto: n.enPalabras ? String(n.raw) : n.texto, raw: n.raw, unidad: n.unidad, canon: n.canon }, x.raw, x.unidad, x.texto))));
      const aprox = n.enPalabras && n.matiz && numeros.some((x) => _u(x.unidad) === _u(n.unidad) && Math.abs(x.raw - n.raw) <= Math.max(Math.abs(n.raw) * 0.1, 1e-9));
      if (!cabe && !aprox) veto("numero-ajeno", `«${n.texto}» no es una cifra de ${ids.join(", ")} (${numeros.map((x) => x.texto || x.raw).slice(0, 4).join(" · ") || "sin cifras"})`, span, ids);
    }
    /* 4c métricas: nombradas ⊆ las del hecho; con varias métricas en el ancla, cada palabra pegada a un placeholder de ESA métrica, y cada
     * placeholder de valor con una palabra de su métrica cerca (un ancla con dos valores mudos es ambigua) */
    const mets = soloLectura ? [] : _metricasConPosicion(spSinEnt).filter((mt) => !_dentroDe(mt, estadosSpan));
    const phs = u.placeholders.map((p) => ({ ...p, ini: p.ini - u.innerIni, fin: p.fin - u.innerIni, h: H(p.id) })).filter((p) => p.h);
    const setsDeClaves = new Set(phs.map((p) => [...p.h.claves].sort().join("|")).filter(Boolean));
    const variasMetricas = setsDeClaves.size > 1;
    for (const mt of mets) {
      if (!mt.claves.size) continue;
      if (![...mt.claves].some((c) => claves.has(c))) { veto("metrica-ajena", `«${mt.texto}» nombra una métrica que ${ids.join(", ")} no tiene (${[...claves].map(L.metricaDeClave).join(", ") || "sin métrica"})`, span, ids); continue; }
      if (variasMetricas) {
        /* el placeholder más cercano (en palabras) es el dueño de la palabra; si su hecho no es esa métrica, la cifra está vestida de otra cosa */
        const dist = (p) => _palabras(sp.slice(Math.min(p.fin, mt.ini), Math.max(p.ini, mt.fin))).length;
        const cerca = phs.filter((p) => dist(p) <= 3).sort((a, b) => dist(a) - dist(b));
        if (cerca.length && ![...cerca[0].h.claves].some((c) => mt.claves.has(c))) veto("metrica-cruzada", `«${mt.texto}» está pegada a {${cerca[0].id}} y ese hecho no es esa métrica`, span, ids);
      }
    }
    if (variasMetricas) for (const p of phs) {
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
      const esNombreDeMetrica = [...claves].some((c) => normalizar(L.metricaDeClave(c)).includes(normalizar(e.texto)));
      if (!esNombreDeMetrica && !estados.has(dicho) && !(dicho === "inmovilizado" && (estados.has("frenado") || estados.has("sobrestock")))) veto("estado-ajeno", `«${e.texto}»${negs % 2 ? " (negado)" : ""} no es el estado de ${ids.join(", ")} (${[...estados].join(", ") || "sin estado"})`, span, ids);
    }
    /* 4e dirección por polaridad */
    for (const h of u.hechos) {
      if (!/^(?:orden|relacion|variacion)$/.test(h.tipo)) continue;
      const dir = h.tipo === "variacion" ? (h.direccion === "sube" ? "mayor" : h.direccion === "baja" ? "menor" : null) : (h.tipo === "orden" ? (h.direccion === "peor" ? (h.polaridad === "mayor" ? "menor" : h.polaridad === "menor" ? "mayor" : null) : h.direccion === "mejor" ? (h.polaridad || null) : h.direccion || null) : (h.direccion === "mayor" || h.direccion === "menor" ? h.direccion : null));
      if (!dir) continue;
      const neg = _todos(_RE.negacion, spSinEnt).length % 2 === 1;
      let dicha = null;
      const peor = _RE_PEOR.test(spSinEnt), mejor = _RE_MEJOR.test(spSinEnt);
      if (peor && !mejor) dicha = h.polaridad === "mayor" ? "menor" : h.polaridad === "menor" ? "mayor" : null;
      else if (mejor && !peor) dicha = h.polaridad || null;
      else { const M = _RE_MAYOR.test(spSinEnt), N = _RE_MENOR.test(spSinEnt); dicha = M && !N ? "mayor" : N && !M ? "menor" : null; }
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
    const tasas = u.hechos.filter((h) => h.tipo === "razon" || (/^(?:cifra|ref|derivada)$/.test(h.tipo) && h.numeros.some((n) => n.unidad === "pct")));
    if (tasas.length && !soloLectura) for (const b of _todos(_RE.base, spSinEnt)) {
      const trasPh = /^\s*\{[a-z][a-z0-9]*\.(?:base|universo)\}/i.test(span.slice(b.fin));
      if (trasPh) continue;
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
        for (const h of tasas) { const baseH = h.tipo === "razon" && h.roles.den ? (L.claveDeMetrica(String(h.roles.den.label || "").split(" · ").slice(1).join(" · ")) || null) : ([...h.claves].map((c) => BASE_DE_TASA[c]).find(Boolean) || null); if (!baseH) continue; const dichas = new Set(mV.flatMap((x) => [...x.claves])); if (dichas.size && !dichas.has(baseH) && !(baseH === "ventas_anterior" && dichas.has("ventas"))) veto("base-ajena", `«${b.texto.trim()}lo que ${verbo}» no es la base de ${h.id} (${L.metricaDeClave(baseH).toLowerCase()})`, span, [h.id]); }
        continue;
      }
      const mBase = _metricasConPosicion(resto.slice(0, 32)).filter((x) => x.ini <= siguiente.length + 1);
      if (!mBase.length) { if (!/[a-záéíóúñ]{4,}/i.test(siguiente)) continue; veto("base-sin-metrica", `«${b.texto.trim()} ${siguiente}…» dice una base sin vocabulario de la casa (usa la métrica o {${tasas[0].id}.base})`, span, ids); continue; }
      for (const h of tasas) {
        const baseH = h.tipo === "razon" && h.roles.den ? (L.claveDeMetrica(String(h.roles.den.label || "").split(" · ").slice(1).join(" · ")) || null) : ([...h.claves].map((c) => BASE_DE_TASA[c]).find(Boolean) || null);
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
      if (!ph && !estadoDicho) veto("universo-invisible", `${h.id} vale dentro de «${h.universo.texto}»: el ancla tiene que escribirlo con {${h.id}.universo}`, span, [h.id]);
    }
    /* 4j roles visibles de un cociente */
    for (const h of u.hechos) if (h.tipo === "razon" && h.roles.den && h.roles.den.sujeto && h.roles.den.sujeto !== "negocio" && h.roles.num && normalizar(h.roles.den.sujeto) !== normalizar(h.roles.num.sujeto || "")) { const k = normalizar(h.roles.den.sujeto); if (!ents.some((e) => e.k === k) && !/(?<![a-z])(?:su|sus)(?![a-z])/i.test(spSinEnt) && !u.placeholders.some((p) => p.id === h.id && p.campo === "base")) veto("base-invisible", `${h.id} se divide por ${h.roles.den.sujeto} y el ancla no lo nombra (nómbralo, usa «su» o {${h.id}.base})`, span, [h.id]); }
    /* 4k un pronombre que ata el hecho a un tercero que el hecho no tiene */
    if (roles.size <= 1 && _hay(_RE.pronombre, spSinEnt)) veto("pronombre-en-ancla", `«${_todos(_RE.pronombre, spSinEnt)[0].texto}» ata ${ids.join(", ")} a otra parte que el hecho no tiene`, span, ids);
    /* 4m dominio cruzado */
    if (dominios.size && !soloLectura) for (const [d, re] of Object.entries(_RE.dominio)) { if (dominios.has(d)) continue; const x = _todos(re, spSinEnt).find((y) => !_dentroDe(y, mets.filter((mt) => [...mt.claves].some((c) => claves.has(c)))) && !_dentroDe(y, estadosSpan)); if (x) veto("dominio-cruzado", `«${x.texto}» es de ${d} y ${ids.join(", ")} es de ${[...dominios].join("/")}`, span, ids); }
    /* 7 (dentro) · negación, tiempo, modalidad, proporción */
    if (!estadosSpan.length && !u.hechos.some((h) => h.tipo === "estado" || h.tipo === "lectura") && _hay(_RE.negacion, spSinEnt)) veto("negacion-en-ancla", `«${_todos(_RE.negacion, spSinEnt)[0].texto}» niega dentro del ancla de ${ids.join(", ")}: un hecho se afirma en positivo`, span, ids);
    for (const x of _todos(_RE.tiempo, spSinEnt)) { const p = L.PERIODO_DE_MARCADOR.find(([re]) => re.test(normalizar(x.texto))); const per = p ? p[1] : null; if (!per) continue; for (const h of u.hechos) { if (h.tipo === "lectura") continue; const hp = h.periodo || _PERIODO_VIGENTE; if (per !== hp && !(per === _PERIODO_VIGENTE && hp === "corte")) veto("periodo-ajeno", `«${x.texto}» es «${per}» y ${h.id} es «${hp}»`, span, [h.id]); } }
    if (!u.hechos.every((h) => h.tipo === "lectura" || h.tipo === "propuesta") && _hay(_RE.modalidad, spSinEnt)) veto("modalidad-en-ancla", `«${_todos(_RE.modalidad, spSinEnt)[0].texto}» vuelve hipotético a ${ids.join(", ")}: un hecho no se anida en un supuesto`, span, ids);
    for (const x of [..._todos(_RE.proporcion, spSinEnt), ..._todos(_RE.proporcionSubjetiva, spSinEnt)]) if (!u.hechos.some((h) => h.tipo === "razon" || h.tipo === "conteo" || h.tipo === "grupo" || (h.tipo === "relacion" && /fraccion|parte/.test(h.direccion || "")))) { veto("proporcion-sin-razon", `«${x.texto}» pegada a ${ids.join(", ")} exige una razón o un conteo calculado`, span, ids); break; }
    /* 5 · núcleo */
    for (const h of u.hechos) {
      if (u.placeholders.some((p) => p.id === h.id)) continue;
      let nucleo = true;
      if (h.tipo === "estado") nucleo = estadosSpan.some((e) => { const negs = _todos(_RE.negacion, spSinEnt.slice(0, e.ini)).length; const dicho = negs % 2 === 1 ? (complementoDe(e.canon) || `no ${e.canon}`) : e.canon; return dicho === h.estado || (h.estado === "inmovilizado" && (dicho === "frenado" || dicho === "sobrestock")); });
      else if (h.tipo === "orden") nucleo = _hay(_RE.superlativo, spSinEnt) || _hay(_RE.ordinal, spSinEnt) || _hay(_RE.comparativo, spSinEnt) || _hay(_RE.adjCasa, spSinEnt) || _RE_PEOR.test(spSinEnt) || _RE_MEJOR.test(spSinEnt);
      else if (h.tipo === "relacion") nucleo = _hay(_RE.comparativo, spSinEnt) || _hay(_RE.proporcion, spSinEnt) || _hay(_RE.fraccionPalabra, spSinEnt) || _numerosEn(spSinEnt).length > 0;
      else if (h.tipo === "variacion") nucleo = _hay(_RE.variacion, spSinEnt) || _numerosEn(spSinEnt).length > 0;
      else if (h.tipo === "conteo") nucleo = _numerosEn(spSinEnt).length > 0 || _hay(_RE.numeroPalabra, spSinEnt) || /(?<![a-z])(?:ning[uú]n[oa]?|nadie|todas?|todos)(?![a-z])/i.test(spSinEnt);
      else if (/^(?:cifra|ref|razon|derivada)$/.test(h.tipo)) nucleo = _numerosEn(spSinEnt).length > 0;
      if (!nucleo) veto("ancla-sin-nucleo", `el ancla de ${h.id} (${h.tipo}) no trae ni su valor ni una palabra de su clase: no afirma nada por sí misma`, span, [h.id]);
    }
    /* 6 · continuación */
    if (_hay(_RE.proforma, spSinEnt)) {
      const previa = [...unidades].reverse().find((x) => x.fin <= u.ini && x.tramo === u.tramo && x.hechos.length);
      if (previa) { const clases = new Set(previa.hechos.map((h) => h.tipo).filter((t) => /^(?:estado|orden|relacion|variacion)$/.test(t))); if (clases.size && !u.hechos.some((h) => clases.has(h.tipo))) veto("continuacion-sin-hecho", `«${_todos(_RE.proforma, spSinEnt)[0].texto}» continúa un ${[...clases].join("/")} y el ancla de ${ids.join(", ")} no trae uno`, span, ids); }
    }
  }

  /* 7 · operadores fuera del ancla (pegados a un ancla en su oración) */
  for (const t of tramos) {
    const us = unidades.filter((u) => u.tramo === t);
    if (!us.length) continue;
    const lt = libre.slice(t.ini, t.fin);
    const ops = [..._todos(_RE.negacion, lt).map((x) => ({ ...x, clase: "negación" })), ..._todos(_RE.tiempo, lt).map((x) => ({ ...x, clase: "tiempo" })), ..._todos(_RE.modalidad, lt).map((x) => ({ ...x, clase: "modalidad" })), ..._todos(_RE.proforma, lt).map((x) => ({ ...x, clase: "continuación" })), ..._todos(_RE.proporcion, lt).map((x) => ({ ...x, clase: "proporción" })), ..._todos(_RE.proporcionSubjetiva, lt).map((x) => ({ ...x, clase: "proporción" }))];
    for (const x of ops) {
      const pos = t.ini + x.ini, fin = t.ini + x.fin;
      const pegado = us.some((u) => (fin <= u.ini && _palabras(s.slice(fin, u.ini)).length <= (x.clase === "negación" || x.clase === "modalidad" ? 5 : 3)) || (pos >= u.fin && _palabras(s.slice(u.fin, pos)).length <= 3));
      if (pegado) veto("operador-fuera-del-ancla", `«${x.texto}» (${x.clase}) cambia el sentido de un hecho anclado y queda fuera del ancla`, s.slice(Math.max(t.ini, pos - 30), Math.min(t.fin, fin + 30)));
    }
  }

  /* 8 · dueño estructural y visibilidad del sujeto (con anáfora al ancla anterior del mismo párrafo) */
  for (const u of unidades) {
    if (!u.hechos.length) continue;
    const t = u.tramo;
    const entsAncla = new Set(_entidadesEn(_sinPlaceholders(u.inner), nombres, alias).map((e) => e.k));
    const dueno = duenoEstructural(u.ini);
    const entsTramo = t ? _entidadesEn(s.slice(t.ini, t.fin), nombres, alias).map((e) => ({ ...e, ini: e.ini + t.ini, fin: e.fin + t.ini })) : [];
    for (const h of u.hechos) {
      if (/^(?:conteo|lectura|propuesta)$/.test(h.tipo)) continue;
      if (h.tipo === "grupo" && t && /(?<![a-záéíóúñ])(?:total(?:es)?|subtotal|suma|junt[oa]s|entre\s+(?:los|las)\s+(?:dos|tres|cuatro|cinco))(?![a-záéíóúñ])/i.test(t.lineaTexto || t.texto)) continue;
      const S = h.tipo === "grupo" ? h.roles.miembros.map(normalizar) : h.roles.sujetos.filter((x) => x !== "negocio").map(normalizar);
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
  _comprobarTablas(s, unidades, veto, (txt) => _entidadesEn(txt, nombres, alias).length > 0);
  for (const t of tramos) {
    if (t.tipo !== "vineta" && t.tipo !== "celda") continue;
    const m = /^\s*(?:[-*•]|\d+[.)])?\s*\*{0,2}([^:{}|\n]{2,40}?)\*{0,2}\s*:\s*(?=\{|⟦)/.exec(t.texto);
    if (!m) continue;
    const us = unidades.filter((u) => u.tramo === t);
    if (!us.length) continue;
    const rotulo = m[1];
    if (_entidadesEn(rotulo, nombres, alias).length) continue;
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
function _comprobarTablas(s, unidades, veto, esEntidad = () => false) {
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
        if (est.length || /\?/.test(rot)) { for (const c of fila.slice(1)) if (c.texto && !unidades.some((u) => u.ini >= c.ini && u.fin <= c.fin && u.hechos.some((h) => h.tipo === "estado"))) veto("celda-sin-estado", `en la fila «${rot}» la celda «${c.texto}» no es un hecho de estado anclado`, c.texto); continue; }
        if (mets.length) { const cl = new Set(mets.flatMap((m) => [...m.claves])); for (const h of hechosFila) if (h.tipo !== "estado" && h.claves.size && ![...h.claves].some((c) => cl.has(c))) veto("columna-ajena", `en la fila «${rot}» va ${h.id} (${[...h.claves].map(L.metricaDeClave).join(", ")}): la fila es «${[...cl].map(L.metricaDeClave).join("/")}» y no admite otra métrica`, rot, [h.id]); }
        else { const sets = new Set(hechosFila.filter((h) => h.tipo !== "estado").map((h) => [...h.claves].sort().join("|")).filter(Boolean)); if (sets.size > 1) veto("columna-mezclada", `en la fila «${rot}» hay hechos de métricas distintas: una fila es una sola métrica y su rótulo la nombra`, rot, hechosFila.map((h) => h.id)); }
      }
      continue;
    }
    for (let col = 1; col < cab.length; col++) {
      const header = cab[col].texto.replace(/\*\*|__|`/g, "");
      const hechosCol = [], celdasCol = [];
      for (const fila of datos) { const c = fila[col]; if (!c || !c.texto) continue; celdasCol.push(c); for (const u of unidades) if (u.ini >= c.ini && u.fin <= c.fin) for (const h of u.hechos) hechosCol.push(h); }
      if (!hechosCol.length) continue;
      const claveSets = hechosCol.filter((h) => h.tipo !== "estado").map((h) => [...h.claves].sort().join("|")).filter(Boolean);
      const metsCab = _metricasConPosicion(header);
      const estCab = _estadosEnSpan(header);
      if (/\?/.test(header) || estCab.length) {
        for (const c of celdasCol) if (!unidades.some((u) => u.ini >= c.ini && u.fin <= c.fin && u.hechos.some((h) => h.tipo === "estado"))) veto("celda-sin-estado", `bajo la cabecera «${header}» la celda «${c.texto}» no es un hecho de estado anclado`, c.texto);
        continue;
      }
      if (metsCab.length) {
        const clavesCab = new Set(metsCab.flatMap((m) => [...m.claves]));
        for (const h of hechosCol) if (h.tipo !== "estado" && h.claves.size && ![...h.claves].some((c) => clavesCab.has(c))) veto("columna-ajena", `bajo la cabecera «${header}» va ${h.id} (${[...h.claves].map(L.metricaDeClave).join(", ")}): la columna es «${[...clavesCab].map(L.metricaDeClave).join("/")}» y no admite otra métrica`, header, [h.id]);
      } else if (new Set(claveSets).size > 1) {
        veto("columna-mezclada", `bajo la cabecera «${header}» hay hechos de métricas distintas (${[...new Set(claveSets)].map((x) => x.split("|").map(L.metricaDeClave).join("+")).join(" vs ")}): una columna es una sola métrica y su cabecera la nombra`, header, hechosCol.map((h) => h.id));
      }
    }
  }
}

export const CLASES_DE_VETO = ["orden-distributivo", "ancla-mal-formada", "hecho-desconocido", "hecho-invalido", "placeholder-sin-render", "hecho-sin-ancla", "entidad-ajena", "numero-ajeno", "metrica-ajena", "metrica-cruzada", "ancla-ambigua", "estado-ajeno", "direccion-contraria", "lados-invertidos", "base-sin-metrica", "base-ajena", "universo-invisible", "base-invisible", "pronombre-en-ancla", "dominio-cruzado", "negacion-en-ancla", "periodo-ajeno", "modalidad-en-ancla", "proporcion-sin-razon", "ancla-sin-nucleo", "continuacion-sin-hecho", "operador-fuera-del-ancla", "sujeto-invisible", "entidad-pegada-al-ancla", "rotulo-sin-metrica", "celda-sin-estado", "columna-ajena", "columna-mezclada", "predicacion-sin-hecho"];
