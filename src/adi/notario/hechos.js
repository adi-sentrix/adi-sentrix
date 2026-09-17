/* === src/adi/notario/hechos.js · EL LIBRO DE HECHOS DEL TURNO (verdad finita · etapas E0-E1 · owner 2026-09-17) ═══════════════════
 * «La verdad se identifica, no se describe.» Cada hecho que el modelo puede afirmar existe antes como un objeto con IDENTIDAD:
 *   · una fig de la boleta, por su id (`ref`);
 *   · una expresión tipada sobre la evidencia que la casa evalúa: cifra por clave, orden, relación, grupo, conteo, variación, estado,
 *     razón (numerador ÷ denominador, sin lista blanca), derivada (suma, diferencia, pp, variación relativa, producto), propuesta (un
 *     número del asesor, sellado) y lectura (interpretación con apoyo).
 * El universo de un orden, un conteo o un grupo es un OBJETO ({eje, base, estados, no_estados, bodega, filtros, top, excluir, union}) que
 * verificar.js evalúa con sus primitivas; la métrica es una CLAVE del léxico (lexico.js); el estado es un canon del catálogo (estados.js).
 * Nada se lee de la prosa: el libro no recibe texto, recibe hechos. Lo que la casa verifica con verificar.js sigue verificándose ahí;
 * este módulo traduce el hecho identificado a la afirmación que el verificador ya sabe juzgar, evalúa lo nuevo (razón, derivada, conteo
 * tipado), y devuelve por hecho: veredicto, verdad, roles (entidades), claves de métrica, números, estado, dominio, universo evaluado y
 * el RENDER de cada placeholder ({id}, {id.n}, {id.m}, {id.k}, {id.umbral}, {id.universo}, {id.rel}, {id.estado}, {id.base}).
 * Y la verdad de lo falso vuelve como hechos nuevos con id (h13 falso → h13a, h13b…), para que el modelo pueda usarla sin adivinar.
 * Puro: sin I/O, sin red. */
import { parseFigures } from "../boleta.js";
import { tolCalculo } from "../oracle/calculoCatalogo.js";
import { verificarAfirmaciones, conjuntoDeUniverso, valorDeRanking } from "./verificar.js";
import { indiceDeEvidencia, mismoValor, unidadCompatible } from "./evidencia.js";
import { normalizar, menosAscii, leerValor } from "./afirmacion.js";
import { parsearLineasDeBloque, MARCA_FIN } from "./declaracion.js";
import { metricaDeClave, claveDeMetrica, metricaPorClave, dominioDeClave, polaridadDeClave, unidadDeClave, periodoDe, PLURAL_DE_EJE, ARTICULO_DE_EJE, diasDe } from "./lexico.js";
import { estadoCanon, estadoDeLaCasa, complementoDe, ESTADOS_CANON } from "./estados.js";

export const MARCA_HECHOS = "<<HECHOS>>";
export const TIPOS_DE_HECHO = ["ref", "cifra", "orden", "relacion", "grupo", "conteo", "variacion", "estado", "razon", "derivada", "propuesta", "lectura"];
const _FACTUALES = new Set(["ref", "cifra", "orden", "relacion", "grupo", "conteo", "variacion", "estado", "razon", "derivada"]);
const _es = (x) => x && typeof x === "object" && !Array.isArray(x);
const _lista = (x) => (Array.isArray(x) ? x : x == null || x === "" ? [] : [x]).map((s) => (typeof s === "string" ? s.trim() : s)).filter((s) => s !== "" && s != null);
const _u = unidadCompatible;

/* ── ids en la boleta: cada fig recibe una identidad estable dentro del turno (por posición; idempotente) ── */
export function asignarIds(figs, prefijo = "c") {
  if (!Array.isArray(figs)) return figs;
  let n = 0;
  for (const f of figs) { n++; if (f && typeof f === "object" && !f.id) f.id = `${prefijo}${n}`; }
  return figs;
}

/* ── el bloque <<HECHOS>> … <<FIN>> de la salida del modelo (va ANTES de la prosa; se quita antes de servir) ── */
export function extraerHechos(salida) {
  const s = String(salida == null ? "" : salida);
  const i = s.indexOf(MARCA_HECHOS);
  if (i < 0) return { prosa: s.trim(), hechos: null, errores: [], bloque: false };
  const j = s.indexOf(MARCA_FIN, i + MARCA_HECHOS.length);
  const bloque = j >= 0 ? s.slice(i + MARCA_HECHOS.length, j) : s.slice(i + MARCA_HECHOS.length);
  const prosa = (s.slice(0, i) + (j >= 0 ? s.slice(j + MARCA_FIN.length) : "")).trim();
  const p = parsearLineasDeBloque(bloque);
  return { prosa, hechos: p.afirmaciones, errores: j >= 0 ? p.errores : [...p.errores, "bloque sin marca de cierre"], bloque: true };
}

/* ── formato de la casa para lo calculado (lo directo se imprime como la boleta lo trae) ── */
const _fmtMoney = (raw) => { const a = Math.abs(raw), s = raw < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };
const _fmtPct = (x) => (Math.abs(x - Math.round(x)) < 0.05 ? String(Math.round(x)) : x.toFixed(1)) + "%";
export function formatoDeLaCasa(raw, unidad) {
  if (!Number.isFinite(raw)) return "";
  switch (unidad) {
    case "money": return _fmtMoney(raw);
    case "pct": return _fmtPct(raw);
    case "pp": return `${(Math.abs(raw - Math.round(raw)) < 0.05 ? String(Math.round(raw)) : raw.toFixed(1))} pp`;
    case "days": return `${Math.round(raw)} días`;
    case "ratio": return `${raw.toFixed(1)}x`;
    default: return String(Math.round(raw * 100) / 100);
  }
}
const _NOMBRE_DE_ESTADO = { "al dia": "al día", critico: "crítico", "sin contribucion": "sin contribución", "riesgo de quiebre": "en riesgo de quiebre", "capital sano": "con capital sano" };
export const nombreDeEstado = (canon) => _NOMBRE_DE_ESTADO[canon] || canon;
const _canonDe = (e) => estadoCanon(String(e || "").replace(/_/g, " "));
const _ESTADOS_COBRANZA = new Set(["al dia", "en mora", "sin deuda", "sin pagos", "buen pagador", "mal pagador"]);
const _ESTADOS_COMERCIAL = new Set(["sin contribucion", "sin margen"]);
const dominioDeEstado = (canon) => (_ESTADOS_COBRANZA.has(canon) ? "cobranza" : _ESTADOS_COMERCIAL.has(canon) ? "comercial" : ESTADOS_CANON.has(canon) ? "inventario" : null);

/* ── el nombre de un universo tipado, escrito por la casa (la plantilla de {id.universo}) ── */
const _OPS = { ">": "superior a", ">=": "de al menos", "<": "inferior a", "<=": "de hasta", "==": "igual a" };
const _fmtUmbral = (f) => {
  const clave = String(f.metrica || "").toLowerCase();
  const nombre = metricaDeClave(clave).toLowerCase();
  if (f.ref != null) return `${nombre} ${_OPS[f.op] || f.op} ${metricaDeClave(f.ref).toLowerCase()}`;
  const unidad = f.unidad ? String(f.unidad) : unidadDeClave(clave) || "";
  const val = (v) => (/^(?:days|money|pct|pp|count|ratio)$/.test(unidad) ? formatoDeLaCasa(+v, unidad) : `${v} ${unidad}`);
  if (f.op === "entre") { const v = Array.isArray(f.valor) ? f.valor : [f.valor, f.hasta]; return `${nombre} entre ${val(v[0])} y ${val(v[1])}`; }
  return `${nombre} ${_OPS[f.op] || "superior a"} ${val(f.valor)}`;
};
export function nombrarUniverso(u, I = null) {
  if (!_es(u)) return typeof u === "string" ? u : Array.isArray(u) ? u.join(", ") : "";
  const eje = normalizar(u.eje || "cliente");
  const plural = PLURAL_DE_EJE[eje] || `${eje}s`;
  const art = ARTICULO_DE_EJE[eje] || "los";
  const total = I && typeof I.tamanoDelEje === "function" ? I.tamanoDelEje(eje) : null;
  const restringido = !!(u.base && !/^todos?|todas$/i.test(String(u.base))) || _lista(u.estados).length || _lista(u.no_estados).length || u.bodega || (Array.isArray(u.filtros) && u.filtros.length) || u.top || u.excluir || (Array.isArray(u.union) && u.union.length);
  const partes = [];
  if (u.base && !/^todos?|todas$/i.test(String(u.base))) partes.push(String(u.base));
  for (const e of _lista(u.estados)) partes.push(nombreDeEstado(_canonDe(e)));
  for (const e of _lista(u.no_estados)) { const c = _canonDe(e); partes.push(c === "en mora" ? "sin mora" : c === "sin deuda" ? "con deuda" : c === "al dia" ? "que no están al día" : `no ${nombreDeEstado(c)}`); }
  if (u.bodega) partes.push(`de ${u.bodega}`);
  for (const f of Array.isArray(u.filtros) ? u.filtros : []) partes.push(`con ${_fmtUmbral(f)}`);
  if (u.top) { const dir = normalizar(u.top.direccion || "mayor"); partes.push(`${u.top.k} de ${dir === "menor" ? "menor" : dir === "peor" ? "peor" : dir === "mejor" ? "mejor" : "mayor"} ${metricaDeClave(u.top.metrica).toLowerCase()}`); }
  const cabeza = restringido ? `${art} ${plural}` : `${art} ${total ? total + " " : ""}${plural}`;
  let texto = partes.length ? `${cabeza} ${partes.join(" ")}` : cabeza;
  if (u.top && partes.length === 1) texto = `${art} ${partes[0]}`;
  if (u.excluir && typeof u.excluir === "object") {
    const ex = u.excluir; const fuera = [];
    for (const e of _lista(ex.entidades)) fuera.push(e);
    for (const n of _lista(ex.conjuntos)) fuera.push(n);
    for (const e of _lista(ex.estados)) fuera.push(nombreDeEstado(_canonDe(e)));
    if (ex.bodega) fuera.push(ex.bodega);
    if (ex.top) fuera.push(`${art} ${ex.top.k} de ${normalizar(ex.top.direccion || "mayor") === "menor" ? "menor" : "mayor"} ${metricaDeClave(ex.top.metrica).toLowerCase()}`);
    texto += ` fuera de ${fuera.join(" y ")}`;
  }
  if (Array.isArray(u.union) && u.union.length) texto += ` y ${u.union.map((v) => nombrarUniverso(v, I)).join(" y ")}`;
  return texto;
}

/* ── búsqueda de figs por id o por (sujeto, clave) ── */
function _figPorId(I, id) {
  const k = String(id || "").trim();
  if (!k) return null;
  return I.figs.find((f) => f.fig && String(f.fig.id || "") === k) || I.figs.find((f) => normalizar(f.label) === normalizar(k)) || null;
}
function _figDe(I, sujeto, clave, unidad = null) {
  const nombre = metricaDeClave(clave);
  let fs = [];
  try { fs = I.buscarFigs(sujeto, nombre, { agregados: sujeto === "negocio" }); } catch { fs = []; }
  if (unidad) { const mu = fs.filter((f) => _u(f.unidad) === _u(unidad)); if (mu.length) fs = mu; }
  /* el todo del negocio: «· total» primero; nunca un subtotal si hay total */
  if (sujeto === "negocio" && fs.length > 1) { const t = fs.find((f) => /(?:^|· )total$/.test(f.conceptoNorm)); if (t) return t; const sinParte = fs.filter((f) => !/resto de|subtotal/.test(f.conceptoNorm)); if (sinParte.length) return sinParte.find((f) => !f.agregado) || sinParte[0]; }
  if (fs.length) return fs.find((f) => !f.agregado) || fs[0];
  /* la proyección (ranking con cifra impresa o unidad sin escala ambigua) cuando la boleta no trae la fig */
  const rk = valorDeRanking({ sujeto, metrica: nombre }, I);
  if (rk) return { label: rk.label, texto: rk.texto, raw: rk.raw, unidad: rk.unidad, entidad: sujeto, concepto: nombre, conceptoNorm: normalizar(nombre), deRanking: true, fig: { id: null, value: rk.texto } };
  return null;
}
const _operando = (I, x) => {
  if (x == null) return null;
  if (typeof x === "string") return _figPorId(I, x);
  if (_es(x)) { if (x.id) return _figPorId(I, x.id); if (x.sujeto != null && x.metrica != null) return _figDe(I, x.sujeto === "negocio" || /^(?:negocio|total)$/i.test(String(x.sujeto)) ? "negocio" : x.sujeto, x.metrica); }
  return null;
};
const _fmtFig = (f) => `${f.label} = ${f.texto || (f.fig && f.fig.value) || formatoDeLaCasa(f.raw, f.unidad)}`;
/* tolerancia de una razón dicha: media unidad de su precisión + 0,02 puntos (la de tasas.js) */
const _tolPct = (texto) => { const m = /(\d+)(?:[.,](\d+))?\s*%/.exec(String(texto || "")); const dec = m && m[2] ? m[2].length : 0; return 0.5 / Math.pow(10, dec) + 0.02; };

/* ── el hecho evaluado ── */
function _H(id, tipo, extra = {}) {
  return { id, tipo, ok: false, veredicto: "no-verificable", motivo: "", verdad: "", evidencia: [], entidades: new Set(), roles: { sujetos: [], vs: [], miembros: [], bodega: null, num: null, den: null }, claves: new Set(), dominio: null, estado: null, polaridad: null, numeros: [], universo: null, periodo: "", render: {}, derivados: [], ...extra };
}
const _addEnt = (H, I, nombre) => { if (!nombre || typeof nombre !== "string" || nombre === "negocio") return; const r = I.resolverEntidad(nombre); H.entidades.add(normalizar(r ? r.nombre : nombre)); };
const _addClave = (H, m) => { if (m == null || m === "") return; const c = claveDeMetrica(m) || normalizar(String(m)).replace(/\s+/g, "_"); H.claves.add(c); if (!H.dominio) H.dominio = dominioDeClave(c); if (H.polaridad == null) H.polaridad = polaridadDeClave(c); };
const _addNum = (H, v, unidad = null) => { const r = typeof v === "object" && v && Number.isFinite(v.raw) ? v : leerValor(v); if (r && Number.isFinite(r.raw)) H.numeros.push({ raw: r.raw, unidad: unidad || r.unidad || "count", texto: r.texto || String(v) }); };
const _dominioDeFig = (f) => { const c = claveDeMetrica(f.concepto); const d = c ? dominioDeClave(c) : null; if (d) return d; const t = normalizar((f.context || "") + " " + (f.calificador || "") + " " + (f.fig && f.fig.universo || "")); if (/vencid|pendiente|abonad|recuperad|cobr|mora/.test(t)) return "cobranza"; if (/capital|frenad|inventario|stock|bodega|rotaci/.test(t)) return "inventario"; if (/venta|margen|contribuci|carga|benchmark|costo/.test(t)) return "comercial"; return null; };

function _deFig(H, I, f, sujeto = null) {
  H.ok = true; H.veredicto = "verdadera"; H.motivo = `fig de la boleta: ${_fmtFig(f)}`; H.verdad = _fmtFig(f); H.evidencia = [f.label];
  const s = sujeto || f.entidad || "negocio";
  H.roles.sujetos = [s]; _addEnt(H, I, s);
  const c = claveDeMetrica(f.concepto);
  if (c) H.claves.add(c); else H.claves.add(normalizar(f.concepto).replace(/\s+/g, "_"));
  H.dominio = _dominioDeFig(f); H.polaridad = c ? polaridadDeClave(c) : null;
  H.numeros.push({ raw: f.raw, unidad: f.unidad, texto: f.texto || (f.fig && f.fig.value) || "" });
  H.render.valor = f.texto || (f.fig && String(f.fig.value)) || formatoDeLaCasa(f.raw, f.unidad);
  if (f.agregado) { H.universo = { set: null, fuente: f.universoTexto || f.calificador || "", texto: f.universoTexto || "" }; H.render.universo = f.universoTexto || ""; }
  if (/anterior|pasado/.test(f.conceptoNorm) && !/variacion|vs/.test(f.conceptoNorm)) H.periodo = "anterior";
  return H;
}

/* la traducción de un hecho tipado a la afirmación que verificar.js juzga (la casa canoniza; nada se lee de la prosa) */
function _aV2(h, I) {
  const tipo = normalizar(h.tipo);
  const base = { id: h.id, tipo, texto: `«${h.id}»`, sujeto: h.sujeto, metrica: h.metrica != null ? metricaDeClave(h.metrica) : "", valor: h.valor, periodo: h.periodo != null ? _periodoV2(h.periodo) : "" };
  const universo = (u, sujeto) => { if (_es(u)) return u; if (Array.isArray(u)) return u; if (typeof u === "string" && u.trim() && !/^(?:todos|todas|todo)$/i.test(u.trim())) return u; const r = typeof sujeto === "string" && sujeto !== "negocio" ? I.resolverEntidad(sujeto) : (Array.isArray(sujeto) && sujeto.length ? I.resolverEntidad(sujeto[0]) : null); return { eje: r && r.eje ? r.eje : "cliente" }; };
  switch (tipo) {
    case "orden": {
      const o = _es(h.orden) ? h.orden : {};
      return { ...base, orden: { forma: o.forma, k: o.k, direccion: o.direccion, vs: o.vs }, universo: universo(h.universo, h.sujeto) };
    }
    case "relacion": {
      const r = _es(h.relacion) ? h.relacion : {};
      const vs = _es(r.vs) ? { sujeto: r.vs.sujeto != null ? r.vs.sujeto : (r.vs.grupo != null ? r.vs.grupo : null), metrica: r.vs.metrica != null ? metricaDeClave(r.vs.metrica) : "" } : (r.vs != null ? { sujeto: r.vs, metrica: "" } : (h.vs != null ? (_es(h.vs) ? { sujeto: h.vs.sujeto != null ? h.vs.sujeto : h.vs.grupo, metrica: h.vs.metrica != null ? metricaDeClave(h.vs.metrica) : "" } : { sujeto: h.vs, metrica: "" }) : null));
      return { ...base, relacion: { forma: r.forma, k: r.k, matiz: r.matiz, vs, valor: r.valor, ...(r.suma === true || h.suma === true ? { suma: true } : {}) }, universo: typeof h.universo === "string" ? h.universo : "" };
    }
    case "grupo": {
      const miembros = _lista(h.miembros).length ? _lista(h.miembros) : (Array.isArray(h.sujeto) ? h.sujeto : []);
      const agregado = normalizar(h.agregado || "suma");
      const metrica = agregado === "participacion" ? "Participación en la venta" : base.metrica;
      return { ...base, sujeto: miembros, metrica, grupo: { entidades: miembros, n: miembros.length || h.n }, universo: typeof h.universo === "string" ? h.universo : (h.de && typeof h.de === "string" ? h.de : "") };
    }
    case "variacion": {
      const v = _es(h.variacion) ? h.variacion : {};
      return { ...base, variacion: { direccion: v.direccion, valor: v.valor != null ? v.valor : h.valor }, periodo: _periodoV2(h.periodo || v.periodo || "anterior") };
    }
    case "estado": {
      const e = _es(h.estado) ? h.estado : { estado: h.estado, bodega: h.bodega };
      return { ...base, estado: { estado: String(e.estado || "").replace(/_/g, " "), bodega: e.bodega || h.bodega || "" } };
    }
    case "conteo": {
      const c = _es(h.conteo) ? h.conteo : { n: h.n, m: h.m, predicado: h.predicado };
      return { ...base, conteo: { n: c.n, m: c.m, predicado: c.predicado || (typeof h.de === "string" ? h.de : "") }, universo: typeof h.de === "string" ? h.de : (typeof h.universo === "string" ? h.universo : "") };
    }
    default: return { ...base, universo: typeof h.universo === "string" ? h.universo : "", ...(h.base != null ? { base: h.base } : {}), ...(Array.isArray(h.evidencia) ? { evidencia: h.evidencia } : {}) };
  }
}
const _periodoV2 = (p) => { const e = periodoDe(p); return e === "anterior" ? "vs año anterior" : e === "presupuesto" ? "vs presupuesto" : e === "corte" || e === "actual" ? "" : String(p || ""); };
function _juzgarV2(a2, I) {
  const R = verificarAfirmaciones([a2], { indice: I });
  const vs = R.veredictos || [];
  if (!vs.length) return { veredicto: "no-verificable", motivo: "sin veredicto", verdad: "", evidencia: [] };
  const falsa = vs.find((v) => v.veredicto === "falsa"); if (falsa) return falsa;
  const nv = vs.find((v) => v.veredicto === "no-verificable"); if (nv) return nv;
  return { ...vs[0], motivo: vs.map((v) => v.motivo).join(" · "), verdad: vs.map((v) => v.verdad).filter(Boolean).join(" · "), evidencia: [...new Set(vs.flatMap((v) => v.evidencia || []))], canonicas: R.afirmaciones };
}
const _aplica = (H, v) => { H.veredicto = v.veredicto; H.ok = v.veredicto === "verdadera" || v.veredicto === "sellada"; H.motivo = String(v.motivo || ""); H.verdad = String(v.verdad || ""); H.evidencia = Array.isArray(v.evidencia) ? v.evidencia.slice() : []; return H; };

/* ── los evaluadores nuevos ── */
function _razon(H, h, I) {
  const num = _operando(I, h.num), den = _operando(I, h.den);
  if (!num) return _aplica(H, { veredicto: "no-verificable", motivo: `sin-evidencia: el numerador ${JSON.stringify(h.num)} no está en la evidencia`, verdad: "", evidencia: [] });
  if (!den) return _aplica(H, { veredicto: "no-verificable", motivo: `sin-evidencia: el denominador ${JSON.stringify(h.den)} no está en la evidencia`, verdad: "", evidencia: den ? [den.label] : [] });
  if (_u(num.unidad) !== _u(den.unidad)) return _aplica(H, { veredicto: "no-verificable", motivo: `unidades-distintas: ${_fmtFig(num)} y ${_fmtFig(den)} no se dividen`, verdad: "", evidencia: [num.label, den.label] });
  if (!Number.isFinite(den.raw) || den.raw === 0) return _aplica(H, { veredicto: "no-verificable", motivo: `sin-evidencia: ${_fmtFig(den)} es cero`, verdad: "", evidencia: [den.label] });
  const q = num.raw / den.raw;
  const forma = normalizar(h.forma || (h.valor && /x\s*$|veces/i.test(String(h.valor)) ? "veces" : "pct"));
  H.roles.num = { sujeto: num.entidad || "negocio", label: num.label }; H.roles.den = { sujeto: den.entidad || "negocio", label: den.label };
  H.roles.sujetos = [num.entidad || "negocio"]; _addEnt(H, I, num.entidad); _addEnt(H, I, den.entidad);
  for (const f of [num, den]) { const c = claveDeMetrica(f.concepto); H.claves.add(c || normalizar(f.concepto).replace(/\s+/g, "_")); }
  H.dominio = _dominioDeFig(num) || _dominioDeFig(den);
  H.numeros.push({ raw: num.raw, unidad: num.unidad, texto: num.texto || "" }, { raw: den.raw, unidad: den.unidad, texto: den.texto || "" });
  const cuenta = `${_fmtFig(num)} ÷ ${_fmtFig(den)} = ${forma === "veces" ? q.toFixed(2) + "×" : _fmtPct(q * 100)}`;
  const v = h.valor != null ? leerValor(h.valor) : null;
  if (v && Number.isFinite(v.raw)) {
    const dicho = v.unidad === "pct" ? v.raw : v.unidad === "ratio" ? v.raw * 100 : (forma === "veces" ? v.raw * 100 : v.raw);
    const tol = v.unidad === "pct" || forma !== "veces" ? _tolPct(v.texto) : 5;
    /* dos lecturas: con los crudos y con lo impreso (la prosa pudo dividir cifras redondeadas) */
    const pn = _impreso(num.texto), pd = _impreso(den.texto);
    const lecturas = [q * 100]; if (pn != null && pd != null && pd !== 0) lecturas.push((pn / pd) * 100);
    if (!lecturas.some((x) => Math.abs(x - dicho) <= tol)) return _aplica(H, { veredicto: "falsa", motivo: `razon-falsa: ${cuenta}, no ${v.texto}`, verdad: cuenta, evidencia: [num.label, den.label] });
    H.numeros.push({ raw: v.raw, unidad: v.unidad, texto: v.texto });
  }
  H.render.valor = forma === "veces" ? `${(Math.round(q * 10) / 10).toFixed(1)}x` : _fmtPct(q * 100);
  /* el valor dicho y verificado se imprime con SU precisión (el canon de la casa lo lava después): «55%» sigue siendo «55%», no «55.1%» */
  if (v && Number.isFinite(v.raw)) H.render.valor = _canonTexto(v.texto);
  H.render.base = den.entidad ? `de ${den.label}` : `del ${String(den.concepto || den.label).toLowerCase()}`;
  H.numeros.push({ raw: forma === "veces" ? q : q * 100, unidad: forma === "veces" ? "ratio" : "pct", texto: H.render.valor });
  return _aplica(H, { veredicto: "verdadera", motivo: `razon: ${cuenta}`, verdad: cuenta, evidencia: [num.label, den.label] });
}
const _impreso = (t) => { const m = /(-?\d+(?:[.,]\d+)?)\s*([kmb])?/i.exec(String(t || "").replace(/\$/g, "").replace(/\.(?=\d{3}\b)/g, "")); if (!m) return null; const v = parseFloat(m[1].replace(",", ".")); const e = m[2] ? { k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()] : 1; return v * e; };

function _derivada(H, h, I) {
  const op = normalizar(h.op || "");
  const ops = _lista(h.de).map((x) => _operando(I, x));
  const falta = _lista(h.de)[ops.findIndex((x) => !x)];
  if (falta !== undefined) return _aplica(H, { veredicto: "no-verificable", motivo: `sin-evidencia: el operando ${JSON.stringify(falta)} no está en la evidencia`, verdad: "", evidencia: [] });
  if (ops.length < 2) return _aplica(H, { veredicto: "no-verificable", motivo: "derivada-incompleta: hacen falta al menos dos operandos", verdad: "", evidencia: [] });
  for (const f of ops) { _addEnt(H, I, f.entidad); const c = claveDeMetrica(f.concepto); H.claves.add(c || normalizar(f.concepto).replace(/\s+/g, "_")); H.numeros.push({ raw: f.raw, unidad: f.unidad, texto: f.texto || "" }); }
  H.roles.sujetos = [...new Set(ops.map((f) => f.entidad || "negocio"))]; H.dominio = _dominioDeFig(ops[0]);
  const raws = ops.map((f) => f.raw), u0 = ops[0].unidad;
  let res = null, unidad = u0, cuenta = "";
  if (op === "suma") { if (!ops.every((f) => _u(f.unidad) === _u(u0))) return _aplica(H, { veredicto: "no-verificable", motivo: "unidades-mezcladas", verdad: "", evidencia: ops.map((f) => f.label) }); res = raws.reduce((s, x) => s + x, 0); cuenta = ops.map(_fmtFig).join(" + "); }
  else if (op === "diferencia") { if (ops.length !== 2 || _u(ops[1].unidad) !== _u(u0)) return _aplica(H, { veredicto: "no-verificable", motivo: "diferencia: dos operandos de la misma unidad", verdad: "", evidencia: ops.map((f) => f.label) }); res = raws[0] - raws[1]; cuenta = `${_fmtFig(ops[0])} − ${_fmtFig(ops[1])}`; if (u0 === "pct") unidad = "pp"; }
  else if (op === "pp") { if (ops.length !== 2 || !ops.every((f) => f.unidad === "pct" || f.unidad === "pp")) return _aplica(H, { veredicto: "no-verificable", motivo: "pp: dos tasas", verdad: "", evidencia: ops.map((f) => f.label) }); res = raws[0] - raws[1]; unidad = "pp"; cuenta = `${_fmtFig(ops[0])} − ${_fmtFig(ops[1])}`; }
  else if (op === "variacion_relativa") { if (ops.length !== 2 || raws[1] === 0) return _aplica(H, { veredicto: "no-verificable", motivo: "variación relativa: (nuevo − base) ÷ base, base ≠ 0", verdad: "", evidencia: ops.map((f) => f.label) }); res = ((raws[0] - raws[1]) / Math.abs(raws[1])) * 100; unidad = "pct"; cuenta = `(${_fmtFig(ops[0])} − ${_fmtFig(ops[1])}) ÷ ${_fmtFig(ops[1])}`; }
  else if (op === "producto") { if (ops.length !== 2) return _aplica(H, { veredicto: "no-verificable", motivo: "producto: dos operandos", verdad: "", evidencia: ops.map((f) => f.label) }); const pct = ops.find((f) => f.unidad === "pct"), otro = ops.find((f) => f !== pct); if (!pct || !otro) return _aplica(H, { veredicto: "no-verificable", motivo: "producto: una cifra × una tasa", verdad: "", evidencia: ops.map((f) => f.label) }); res = otro.raw * pct.raw / 100; unidad = otro.unidad; cuenta = `${_fmtFig(otro)} × ${_fmtFig(pct)}`; }
  else return _aplica(H, { veredicto: "no-verificable", motivo: `derivada: operación «${h.op}» desconocida (suma · diferencia · pp · variacion_relativa · producto)`, verdad: "", evidencia: [] });
  const verdad = `${cuenta} = ${formatoDeLaCasa(res, unidad)}`;
  const v = h.valor != null ? leerValor(h.valor) : null;
  if (v && Number.isFinite(v.raw)) {
    if (_u(v.unidad) !== _u(unidad) && !(unidad === "pp" && v.unidad === "pct")) return _aplica(H, { veredicto: "no-verificable", motivo: `unidad-distinta: la cuenta da ${formatoDeLaCasa(res, unidad)} y el valor dicho es ${v.texto}`, verdad, evidencia: ops.map((f) => f.label) });
    const tol = Math.max(tolCalculo(res, unidad === "pp" ? "pct" : unidad), 0.5 * Math.pow(10, -_decimales(v.texto)) + 1e-9);
    if (Math.abs(Math.abs(res) - Math.abs(v.raw)) > tol) return _aplica(H, { veredicto: "falsa", motivo: `derivada-falsa: ${verdad}, no ${v.texto}`, verdad, evidencia: ops.map((f) => f.label) });
    H.numeros.push({ raw: v.raw, unidad: v.unidad, texto: v.texto });
  }
  H.render.valor = v && Number.isFinite(v.raw) ? _canonTexto(v.texto) : formatoDeLaCasa(res, unidad); H.numeros.push({ raw: res, unidad, texto: formatoDeLaCasa(res, unidad) });
  return _aplica(H, { veredicto: "verdadera", motivo: `derivada (${op}): ${verdad}`, verdad, evidencia: ops.map((f) => f.label) });
}
const _decimales = (t) => { const m = /\d+[.,](\d+)/.exec(String(t || "")); return m ? m[1].length : 0; };
/* el texto de una cifra dicha, en el canon de la casa (decimal con punto, sin espacio antes de % ni de pp) */
const _canonTexto = (t) => menosAscii(String(t || "")).trim().replace(/(\d),(\d)/g, "$1.$2").replace(/\s+%/g, "%").replace(/\s+pp\b/g, " pp");

function _conteoTipado(H, h, I) {
  const u = _es(h.de) ? h.de : (_es(h.universo) ? h.universo : null);
  if (!u) return null;   // sin universo tipado: lo juzga el verificador de siempre
  const c = _es(h.conteo) ? h.conteo : { n: h.n, m: h.m };
  const n = Number.isFinite(+c.n) ? +c.n : NaN;
  const U = conjuntoDeUniverso(u, I, u.eje || null, "");
  if (U.error) return _aplica(H, { veredicto: "no-verificable", motivo: U.error, verdad: "", evidencia: [] });
  const eje = normalizar(u.eje || "cliente");
  const total = I.tamanoDelEje(eje);
  const set = U.set || new Set([...I.entidades].filter(([, e]) => e.eje === eje).map(([k]) => k));
  const mBase = u.base && !/^todos?|todas$/i.test(String(u.base)) ? (conjuntoDeUniverso({ eje, base: u.base }, I, eje, "").set || new Set()).size : (total || set.size);
  H.universo = { set, fuente: U.fuente, texto: nombrarUniverso(u, I), restringido: !!U.set };
  H.render.universo = H.universo.texto; H.render.n = String(set.size); H.render.m = String(mBase);
  for (const k of set) H.entidades.add(k);
  H.roles.miembros = [...set].map((k) => (I.entidades.get(k) || { nombre: k }).nombre);
  for (const f of Array.isArray(u.filtros) ? u.filtros : []) { _addClave(H, f.metrica); if (f.valor != null && !Array.isArray(f.valor)) { const unidad = f.unidad && !/^(?:days|money|pct|pp|count|ratio)$/.test(String(f.unidad)) ? "days" : (f.unidad || unidadDeClave(f.metrica) || "count"); const raw = f.unidad && !/^(?:days|money|pct|pp|count|ratio)$/.test(String(f.unidad)) ? diasDe(f.valor, f.unidad) : +f.valor; H.numeros.push({ raw: +f.valor, unidad: unidad === "days" && raw !== +f.valor ? "count" : unidad, texto: String(f.valor) }); if (raw != null && raw !== +f.valor) H.numeros.push({ raw, unidad: "days", texto: `${raw} días` }); H.render.umbral = _fmtUmbral(f).replace(/^.*?(?:superior a|de al menos|inferior a|de hasta|igual a|entre)\s+/, ""); } }
  if (u.top) { _addClave(H, u.top.metrica); H.numeros.push({ raw: +u.top.k, unidad: "count", texto: String(u.top.k) }); H.render.k = String(u.top.k); }
  for (const e of [..._lista(u.estados), ..._lista(u.no_estados), ..._lista(u.excluir && u.excluir.estados)]) { const c = _canonDe(e); H.estado = H.estado || c; H.estadosDelUniverso = H.estadosDelUniverso || new Set(); H.estadosDelUniverso.add(c); if (!H.dominio) H.dominio = dominioDeEstado(c); }
  H.numeros.push({ raw: set.size, unidad: "count", texto: String(set.size) }, { raw: mBase, unidad: "count", texto: String(mBase) });
  const lista = H.roles.miembros.join(", ");
  const verdad = `${set.size}${mBase ? " de " + mBase : ""} en ${H.universo.texto}${lista ? ": " + lista : ""}`;
  if (!Number.isFinite(n)) return _aplica(H, { veredicto: "verdadera", motivo: `conteo tipado: ${verdad}`, verdad, evidencia: [U.fuente] });
  if (n !== set.size) return _aplica(H, { veredicto: "falsa", motivo: `conteo-falso: son ${verdad}, no ${n}`, verdad, evidencia: [U.fuente] });
  if (c.m != null && Number.isFinite(+c.m) && +c.m !== mBase) return _aplica(H, { veredicto: "falsa", motivo: `universo-falso: son ${set.size} de ${mBase}, no de ${c.m}`, verdad, evidencia: [U.fuente] });
  return _aplica(H, { veredicto: "verdadera", motivo: `conteo tipado: ${verdad}`, verdad, evidencia: [U.fuente] });
}

/* ── la verdad de lo falso, con id: el complemento del estado y las cifras que la evidencia citó ── */
function _verdadDeLoFalso(H, h, I, libro) {
  const out = [];
  const nuevo = (suf, tipo, extra) => { const id = `${H.id}${suf}`; if (libro.porId.has(id)) return null; return { id, tipo, ...extra }; };
  if (H.tipo === "estado" && H.estado) {
    const comp = complementoDe(H.estado);
    if (comp) { const n = nuevo("a", "estado", { sujeto: H.roles.sujetos[0], estado: comp }); if (n) out.push(n); }
  }
  let k = 0;
  for (const label of H.evidencia || []) {
    const f = I.figs.find((g) => normalizar(g.label) === normalizar(label));
    if (!f || !Number.isFinite(f.raw)) continue;
    const n = nuevo(String.fromCharCode(98 + k), "ref", { de: f.fig && f.fig.id ? f.fig.id : f.label }); if (n) { out.push(n); k++; }
  }
  return out;
}

/** libroDeHechos(hechos, ctx) → { hechos: [H], porId: Map, errores, resumen, texto } · ctx = { indice } | { figs, datoProyectado, ejesDelTenant } */
export function libroDeHechos(hechos, ctx = {}) {
  const I = ctx.indice || indiceDeEvidencia({ figs: ctx.figs || [], datoProyectado: ctx.datoProyectado || null, ejesDelTenant: ctx.ejesDelTenant || null });
  const libro = { hechos: [], porId: new Map(), errores: [], indice: I };
  const cola = (Array.isArray(hechos) ? hechos : []).map((h, i) => (h && typeof h === "object" ? { ...h, id: String(h.id || `h${i + 1}`) } : null)).filter(Boolean);
  const evaluar = (h) => {
    const tipo = normalizar(h.tipo);
    const H = _H(h.id, tipo);
    if (libro.porId.has(h.id)) { H.motivo = `id-repetido: «${h.id}» ya existe en el libro`; libro.errores.push(H.motivo); return H; }
    if (!TIPOS_DE_HECHO.includes(tipo)) { H.motivo = `tipo desconocido «${h.tipo}» (${TIPOS_DE_HECHO.join(" · ")})`; return H; }
    try {
      if (tipo === "ref") {
        const f = _figPorId(I, h.de != null ? h.de : h.ref);
        if (!f) { H.motivo = `ref-desconocida: «${h.de != null ? h.de : h.ref}» no es una fig de la boleta de este turno`; return H; }
        return _deFig(H, I, f);
      }
      if (tipo === "propuesta") {
        const v = leerValor(h.valor);
        if (!v || !Number.isFinite(v.raw)) { H.motivo = "propuesta sin valor"; return H; }
        H.ok = true; H.veredicto = "sellada"; H.motivo = "propuesta del asesor (criterio mío): no se juzga contra la boleta"; H.render.valor = v.texto; H.numeros.push({ raw: v.raw, unidad: v.unidad, texto: v.texto });
        if (h.de != null) _addClave(H, h.de); if (h.sujeto) { H.roles.sujetos = [h.sujeto]; _addEnt(H, I, h.sujeto); }
        return H;
      }
      if (tipo === "lectura") {
        const apoyo = _lista(h.apoyo);
        const faltan = apoyo.filter((id) => !libro.porId.has(String(id)));
        H.roles.apoyo = apoyo.map(String);
        if (faltan.length) { H.motivo = `apoyo-desconocido: ${faltan.join(", ")} no está en el libro`; return H; }
        const falsos = apoyo.filter((id) => libro.porId.get(String(id)) && !libro.porId.get(String(id)).ok);
        if (falsos.length) { H.motivo = `apoyo-falso: la lectura se apoya en ${falsos.join(", ")}, que no es verdadero`; return H; }
        for (const id of apoyo) { const A = libro.porId.get(String(id)); for (const e of A.entidades) H.entidades.add(e); for (const c of A.claves) H.claves.add(c); if (!H.dominio) H.dominio = A.dominio; }
        H.ok = true; H.veredicto = "sellada"; H.motivo = `lectura con sello «${h.sello || "criterio mío"}»${apoyo.length ? " · apoyo " + apoyo.join(", ") : ""}`; H.sello = h.sello || "criterio mío";
        return H;
      }
      if (tipo === "razon") return _razon(H, h, I);
      if (tipo === "derivada") return _derivada(H, h, I);
      if (tipo === "conteo") { const R = _conteoTipado(H, h, I); if (R) return R; }
      if (tipo === "cifra" && (h.valor == null || h.valor === "")) {
        /* la cifra identificada por (sujeto, clave) sin valor: la fig de la boleta o la proyección */
        const sujeto = h.sujeto === "negocio" || /^(?:negocio|total)$/i.test(String(h.sujeto || "")) ? "negocio" : h.sujeto;
        const f = _figDe(I, sujeto, h.metrica, h.unidad || null);
        if (!f) { H.motivo = `sin-evidencia: la boleta no trae «${metricaDeClave(h.metrica)}» de ${sujeto}`; H.roles.sujetos = [sujeto]; _addEnt(H, I, sujeto); _addClave(H, h.metrica); return H; }
        return _deFig(H, I, f, sujeto);
      }
      /* lo demás lo juzga verificar.js con la afirmación traducida */
      const a2 = _aV2(h, I);
      const v = _juzgarV2(a2, I);
      _aplica(H, v);
      /* roles, claves, números y render desde el hecho identificado (no desde ninguna prosa) */
      const sujetos = Array.isArray(a2.sujeto) ? a2.sujeto : (a2.sujeto != null ? [a2.sujeto] : []);
      H.roles.sujetos = sujetos.map(String); for (const s of sujetos) _addEnt(H, I, typeof s === "string" ? s : null);
      if (h.metrica != null) _addClave(H, h.metrica);
      if (a2.orden && a2.orden.vs) { H.roles.vs = [String(a2.orden.vs)]; _addEnt(H, I, String(a2.orden.vs)); }
      if (a2.relacion && a2.relacion.vs) { const vsS = _lista(a2.relacion.vs.sujeto); H.roles.vs = vsS.map(String); for (const s of vsS) _addEnt(H, I, typeof s === "string" ? s : null); if (a2.relacion.vs.metrica) _addClave(H, a2.relacion.vs.metrica); }
      if (a2.grupo) { H.roles.miembros = _lista(a2.grupo.entidades).map(String); for (const s of H.roles.miembros) _addEnt(H, I, s); }
      if (a2.estado) { H.estado = _canonDe(a2.estado.estado); H.roles.bodega = a2.estado.bodega || null; if (a2.estado.bodega) _addEnt(H, I, a2.estado.bodega); H.dominio = H.dominio || dominioDeEstado(H.estado); H.render.estado = nombreDeEstado(H.estado); }
      if (a2.valor != null) _addNum(H, a2.valor);
      if (a2.relacion) { if (a2.relacion.valor != null) _addNum(H, a2.relacion.valor); if (Number.isFinite(+a2.relacion.k)) { H.numeros.push({ raw: +a2.relacion.k, unidad: "ratio", texto: String(a2.relacion.k) }); H.render.k = String(a2.relacion.k); } H.render.rel = _renderRelacion(a2, I); H.matiz = a2.relacion.matiz || ""; H.direccion = a2.relacion.forma; }
      if (a2.orden) { if (Number.isFinite(+a2.orden.k)) { H.numeros.push({ raw: +a2.orden.k, unidad: "count", texto: String(a2.orden.k) }); H.render.k = String(a2.orden.k); } H.direccion = a2.orden.direccion || ""; H.forma = a2.orden.forma; }
      if (a2.variacion) { if (a2.variacion.valor != null) _addNum(H, a2.variacion.valor); H.direccion = a2.variacion.direccion; H.periodo = periodoDe(h.periodo || "anterior"); H.claves.add(H.periodo === "presupuesto" ? "vs_presupuesto" : "variacion"); }
      if (a2.conteo) { H.numeros.push({ raw: +a2.conteo.n, unidad: "count", texto: String(a2.conteo.n) }); H.render.n = String(a2.conteo.n); if (a2.conteo.m != null) { H.numeros.push({ raw: +a2.conteo.m, unidad: "count", texto: String(a2.conteo.m) }); H.render.m = String(a2.conteo.m); } }
      if (a2.periodo && !H.periodo) H.periodo = periodoDe(a2.periodo);
      /* el universo evaluado (tipado o texto) y su nombre para {id.universo} */
      const u = a2.universo;
      if (_es(u) || (typeof u === "string" && u.trim() && (tipo === "orden" || tipo === "grupo" || tipo === "conteo"))) {
        let U = null; try { U = conjuntoDeUniverso(u, I, _es(u) ? u.eje || null : null, a2.metrica); } catch { U = null; }
        H.universo = { set: U && U.set ? U.set : null, fuente: U ? (U.fuente || U.error || "") : "", texto: nombrarUniverso(u, I), restringido: _es(u) ? !!(U && U.set) : true };
        H.render.universo = H.universo.texto;
        if (_es(u)) { for (const f of Array.isArray(u.filtros) ? u.filtros : []) { _addClave(H, f.metrica); if (f.valor != null && !Array.isArray(f.valor)) { const enDias = f.unidad && !/^(?:days|money|pct|pp|count|ratio)$/.test(String(f.unidad)); H.numeros.push({ raw: +f.valor, unidad: enDias ? "count" : (f.unidad || unidadDeClave(f.metrica) || "count"), texto: String(f.valor) }); if (enDias) { const d = diasDe(f.valor, f.unidad); if (d != null) H.numeros.push({ raw: d, unidad: "days", texto: `${d} días` }); } H.render.umbral = _fmtUmbral(f).replace(/^.*?(?:superior a|de al menos|inferior a|de hasta|igual a|entre)\s+/, ""); } } if (u.top) { _addClave(H, u.top.metrica); H.numeros.push({ raw: +u.top.k, unidad: "count", texto: String(u.top.k) }); } for (const e of [..._lista(u.estados), ..._lista(u.no_estados), ..._lista(u.excluir && u.excluir.estados)]) { H.estadosDelUniverso = H.estadosDelUniverso || new Set(); H.estadosDelUniverso.add(_canonDe(e)); } }
      }
      if (tipo === "cifra" && v.veredicto === "verdadera") { const f = (v.evidencia || []).map((l) => I.figs.find((g) => normalizar(g.label) === normalizar(l))).find(Boolean); if (f) { H.render.valor = f.texto || (f.fig && String(f.fig.value)) || ""; if (!H.dominio) H.dominio = _dominioDeFig(f); } if (!H.render.valor && a2.valor && a2.valor.texto) H.render.valor = a2.valor.texto; }
      if (tipo === "grupo") { const gv = leerValor(a2.valor); if (gv && gv.texto) H.render.valor = _canonTexto(gv.texto); }
      if (tipo === "variacion") { const f = (v.evidencia || []).map((l) => I.figs.find((g) => normalizar(g.label) === normalizar(l))).find(Boolean); H.render.valor = a2.variacion && a2.variacion.valor && a2.variacion.valor.texto ? _canonTexto(a2.variacion.valor.texto) : (f ? (f.texto || (f.fig && String(f.fig.value)) || "") : ""); if (f && !H.numeros.length) H.numeros.push({ raw: f.raw, unidad: f.unidad, texto: f.texto || "" }); }
      return H;
    } catch (e) {
      H.veredicto = "no-verificable"; H.motivo = `error-del-libro: ${e && e.message ? e.message : e}`; return H;
    }
  };
  for (const h of cola) {
    const H = evaluar(h);
    libro.hechos.push(H); libro.porId.set(H.id, H);
    if (!H.ok && _FACTUALES.has(H.tipo) && H.veredicto === "falsa") {
      for (const d of _verdadDeLoFalso(H, h, I, libro)) { const D = evaluar(d); if (D.ok) { D.derivadoDe = H.id; libro.hechos.push(D); libro.porId.set(D.id, D); H.derivados.push(D.id); } }
    }
  }
  libro.resumen = { total: libro.hechos.length, verdaderos: libro.hechos.filter((x) => x.ok && x.veredicto === "verdadera").length, sellados: libro.hechos.filter((x) => x.veredicto === "sellada").length, falsos: libro.hechos.filter((x) => x.veredicto === "falsa").length, noVerificables: libro.hechos.filter((x) => x.veredicto === "no-verificable").length, derivados: libro.hechos.filter((x) => x.derivadoDe).length };
  libro.texto = textoDelLibro(libro);
  return libro;
}
function _renderRelacion(a2, I) {
  const r = a2.relacion || {};
  const nom = (s) => (s === "negocio" ? "el negocio" : Array.isArray(s) ? s.join(" y ") : String(s || ""));
  const A = nom(a2.sujeto), B = r.vs ? nom(r.vs.sujeto) : "";
  const k = Number.isFinite(+r.k) ? +r.k : null;
  const matiz = r.matiz ? r.matiz + " " : "";
  void I;
  switch (r.forma) {
    case "veces": return `${A} ${matiz}${k === 2 ? "el doble que" : k === 3 ? "el triple que" : `${k} veces`} ${B}`;
    case "mayor": return `${A} más que ${B}`;
    case "menor": return `${A} menos que ${B}`;
    case "igual": return `${A} ${matiz || "igual que "}${B}`;
    case "fraccion": case "parte": return `${A} ${matiz}${k != null ? (k === 0.5 ? "la mitad de" : `el ${_fmtPct(k * 100)} de`) : "parte de"} ${B}`;
    case "diferencia": return `${A} ${r.valor && r.valor.texto ? r.valor.texto + " " : ""}${B ? "frente a " + B : ""}`;
    default: return "";
  }
}

/* ── el libro en texto para el modelo (formato fijo; «✗» trae la verdad y sus ids nuevos) ── */
export function textoDelLibro(libro) {
  const L = [];
  for (const H of libro.hechos) {
    if (H.derivadoDe) continue;
    if (H.ok) L.push(`✓ ${H.id} ${H.verdad || H.motivo}`);
    else L.push(`✗ ${H.id} — ${H.veredicto === "falsa" ? "FALSO" : "NO VERIFICABLE"}: ${H.motivo}${H.verdad && !H.motivo.includes(H.verdad) ? " · la verdad: " + H.verdad : ""}${H.derivados.length ? ` → la verdad, con id: ${H.derivados.map((d) => { const D = libro.porId.get(d); return `${d} ${D.verdad || D.motivo}`; }).join(" · ")}` : ""}. Este hecho NO existe: no lo escribas ni lo insinúes.`);
  }
  return L.join("\n");
}

/** renderDe(libro, id, campo) → el texto de un placeholder {id} / {id.n} / {id.m} / {id.k} / {id.umbral} / {id.universo} / {id.rel} / {id.estado} / {id.base} (null si no existe) */
export function renderDe(libro, id, campo = "valor") {
  const H = libro && libro.porId ? libro.porId.get(String(id)) : null;
  if (!H || !H.ok) return null;
  const c = campo || "valor";
  if (c === "valor") return H.render.valor != null ? H.render.valor : (H.render.estado || H.render.n || null);
  return H.render[c] != null ? H.render[c] : null;
}

export const esFactual = (tipo) => _FACTUALES.has(normalizar(tipo));
