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
import { metricaDeClave, claveDeMetrica, metricaPorClave, dominioDeClave, polaridadDeClave, unidadDeClave, periodoDe, PLURAL_DE_EJE, ARTICULO_DE_EJE, diasDe, METRICAS_DE_ESTADO, opDe } from "./lexico.js";
import { estadoCanon, estadoDeLaCasa, complementoDe, ESTADOS_CANON, estadosEn, estadoDeclarado, ejeCompatible, COMPLEMENTO_V3 } from "./estados.js";

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
    for (const t of _lista(ex.top)) if (_es(t)) fuera.push(`${art} ${t.k} de ${normalizar(t.direccion || "mayor") === "menor" ? "menor" : "mayor"} ${metricaDeClave(t.metrica).toLowerCase()}`);
    texto += ` fuera de ${fuera.join(" y ")}`;
  }
  if (Array.isArray(u.union) && u.union.length) texto += ` y ${u.union.map((v) => nombrarUniverso(v, I)).join(" y ")}`;
  return texto;
}

/* ── búsqueda de figs por id o por (sujeto, clave) ── */
function _figPorId(I, id) {
  const k = String(id || "").trim();
  if (!k) return null;
  const kl = k.toLowerCase();
  const porId = I.figs.find((f) => f.fig && String(f.fig.id || "").toLowerCase() === kl) || null;
  if (porId) return porId;
  if (/^\d+$/.test(k)) { const cands = I.figs.filter((f) => f.fig && /^[a-z]+\d+$/i.test(String(f.fig.id || "")) && String(f.fig.id).replace(/^[a-z]+/i, "") === k); if (cands.length === 1) return cands[0]; }
  return I.figs.find((f) => normalizar(f.label) === normalizar(k)) || null;
}
function _figDe(I, sujeto, clave, unidad = null) {
  const nombre = metricaDeClave(clave);
  let fs = [];
  try { fs = I.buscarFigs(sujeto, nombre, { agregados: sujeto === "negocio" }); } catch { fs = []; }
  if (unidad) { const mu = fs.filter((f) => _u(f.unidad) === _u(unidad)); if (mu.length) fs = mu; }
  /* el todo del negocio: «· total» primero; nunca un subtotal si hay total */
  if (sujeto === "negocio") { fs = fs.filter((f) => !/resto de|subtotal|\(\d+ de \d+\)/.test(f.conceptoNorm + " " + normalizar(f.label || ""))); }   // el negocio nunca es un «Resto de…» ni un subtotal parcial (ronda 5, VE R01)
  if (sujeto === "negocio" && fs.length > 1) { const t = fs.find((f) => /(?:^|· )total$/.test(f.conceptoNorm)); if (t) return t; const sinParte = fs.filter((f) => !/resto de|subtotal/.test(f.conceptoNorm)); if (sinParte.length) return sinParte.find((f) => !f.agregado) || sinParte[0]; }
  if (fs.length) return fs.find((f) => !f.agregado) || fs[0];
  /* la proyección (ranking con cifra impresa o unidad sin escala ambigua) cuando la boleta no trae la fig */
  const rk = valorDeRanking({ sujeto, metrica: nombre }, I);
  if (rk) return { label: rk.label, texto: rk.texto, raw: rk.raw, unidad: rk.unidad, entidad: sujeto, concepto: nombre, conceptoNorm: normalizar(nombre), deRanking: true, fig: { id: null, value: rk.texto } };
  return null;
}
/* un operando por id de HECHO del libro (h1): la fig de su evidencia, o el hecho calculado como operando */
const _operandoDeHecho = (I, libro, id) => {
  const Hh = libro && libro.porId ? libro.porId.get(String(id)) : null;
  if (!Hh || !Hh.ok) return null;
  if (Hh.tipo === "derivada" && Hh.resultado && Number.isFinite(Hh.resultado.raw)) { const clave = [...Hh.claves][0] || null; return { label: Hh.id, texto: Hh.resultado.texto || "", raw: Hh.resultado.raw, unidad: Hh.resultado.unidad, entidad: Hh.roles.sujetos[0] || "negocio", concepto: clave ? metricaDeClave(clave) : Hh.id, conceptoNorm: normalizar(clave ? metricaDeClave(clave) : Hh.id), fig: { id: Hh.id, value: Hh.resultado.texto } }; }
  if (Array.isArray(Hh.evidencia) && Hh.evidencia.length === 1) { const f = _figPorId(I, Hh.evidencia[0]); if (f) return f; }
  const n = Hh.numeros[0]; if (!n || !Number.isFinite(n.raw)) return null;
  const clave = [...Hh.claves][0] || null;
  return { label: Hh.id, texto: Hh.render.valor || n.texto || "", raw: n.raw, unidad: n.unidad, entidad: Hh.roles.sujetos[0] || "negocio", concepto: clave ? metricaDeClave(clave) : Hh.id, conceptoNorm: normalizar(clave ? metricaDeClave(clave) : Hh.id), fig: { id: Hh.id, value: Hh.render.valor } };
};
const _operando = (I, x, libro = null) => {
  if (x == null) return null;
  if (typeof x === "string") return _figPorId(I, x) || _operandoDeHecho(I, libro, x);
  if (_es(x)) { if (x.id) return _figPorId(I, x.id) || _operandoDeHecho(I, libro, x.id); if (x.sujeto != null && x.metrica != null) return _figDe(I, x.sujeto === "negocio" || /^(?:negocio|total)$/i.test(String(x.sujeto)) ? "negocio" : x.sujeto, x.metrica); }
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
const _dominioDeFig = (f) => { const c = claveDeMetrica(f.concepto); const d = c ? dominioDeClave(c) : null; if (d) return d; const t = normalizar((f.context || "") + " " + (f.calificador || "") + " " + (f.fig && f.fig.universo || "") + " " + (f.fig && f.fig.context || "") + " " + String(f.label || "").split(" · ").slice(1).join(" "));   /* el rótulo también dice el dominio («Medida · cerrar brecha al piso») */ if (/vencid|pendiente|abonad|recuperad|cobr|mora/.test(t)) return "cobranza"; if (/capital|frenad|inventario|stock|bodega|rotaci/.test(t)) return "inventario"; if (/venta|margen|contribuci|carga|benchmark|costo|brecha|precio|markup/.test(t)) return "comercial"; return null; };

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
      let miembros = _lista(h.miembros).length ? _lista(h.miembros) : (Array.isArray(h.sujeto) ? h.sujeto : []);
      const agregado = normalizar(h.agregado || "suma");
      /* sin miembros y con universo tipado («los clientes en mora»): los miembros son el conjunto */
      if (!miembros.length && (_es(h.de) || _es(h.universo))) { try { const U = conjuntoDeUniverso(_es(h.de) ? h.de : h.universo, I, (_es(h.de) ? h.de : h.universo).eje || null, ""); if (U && U.set) miembros = [...U.set].map((k) => (I.entidades.get(k) || { nombre: k }).nombre); } catch { /* sin conjunto: la declaración queda incompleta */ } }
      const metrica = agregado === "participacion" ? "Participación en la venta" : base.metrica;
      return { ...base, sujeto: miembros, metrica, grupo: { entidades: miembros, n: miembros.length || h.n, agregado }, universo: typeof h.universo === "string" ? h.universo : (h.de && typeof h.de === "string" ? h.de : "") };
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
      return { ...base, conteo: { n: c.n, m: c.m, predicado: c.predicado || (typeof h.de === "string" ? h.de : "") }, universo: typeof h.de === "string" ? h.de : (typeof h.universo === "string" ? h.universo : ""), ...(c.predicado ? { _predicado: c.predicado } : {}) };
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
/* la base con que una métrica forma una tasa de la casa (recuperado = abonado ÷ venta; vencido sobre venta; participaciones sobre el total) */
const _BASE_DE_RAZON = { abonado: "ventas", saldo_vencido: "ventas", saldo_pendiente: "ventas", saldo_por_vencer: "ventas", contribucion: "ventas", no_capturada: "ventas", carga_alta: "ventas", costo: "ventas", capital_frenado: "capital", capital_inmovilizado: "capital", unidades: "unidades", ventas: "ventas" };
/* una métrica que contiene a otra (misma entidad): sumarlas cuenta dos veces */
const _CONTIENE = { saldo_pendiente: ["saldo_vencido", "saldo_por_vencer"], capital: ["capital_frenado", "capital_inmovilizado"], ventas: ["contribucion", "costo", "no_capturada", "carga_alta"], contribucion: ["no_capturada"] };
/* comercial y cobranza comparten el universo (la venta a crédito produce el saldo); inventario es otro universo y no se relaciona por cociente ni por suma */
const _reconcilian = (a, b) => a === b || (["comercial", "cobranza"].includes(a) && ["comercial", "cobranza"].includes(b));
function _razon(H, h, I, libro = null) {
  const num = _operando(I, h.num, libro), den = _operando(I, h.den, libro);
  if (!num) return _aplica(H, { veredicto: "no-verificable", motivo: `sin-evidencia: el numerador ${JSON.stringify(h.num)} no está en la evidencia`, verdad: "", evidencia: [] });
  if (!den) return _aplica(H, { veredicto: "no-verificable", motivo: `sin-evidencia: el denominador ${JSON.stringify(h.den)} no está en la evidencia`, verdad: "", evidencia: den ? [den.label] : [] });
  if (_u(num.unidad) !== _u(den.unidad)) return _aplica(H, { veredicto: "no-verificable", motivo: `unidades-distintas: ${_fmtFig(num)} y ${_fmtFig(den)} no se dividen`, verdad: "", evidencia: [num.label, den.label] });
  if (!Number.isFinite(den.raw) || den.raw === 0) return _aplica(H, { veredicto: "no-verificable", motivo: `sin-evidencia: ${_fmtFig(den)} es cero`, verdad: "", evidencia: [den.label] });
  if (normalizar(num.label) === normalizar(den.label)) return _aplica(H, { veredicto: "no-verificable", motivo: "razon-vacua: la misma cifra sobre sí misma no dice nada", verdad: "", evidencia: [num.label] });
  /* una razón es aritmética: cualquier par de cifras de la misma unidad se divide (v3.1: sin lista de pares); lo que no se divide es una cifra sobre sí misma,
   * unidades distintas, o dos universos que la casa declara que NO reconcilian (inventario contra comercial/cobranza) */
  { const dn = _dominioDeFig(num), dd = _dominioDeFig(den); if (dn && dd && !_reconcilian(dn, dd)) return _aplica(H, { veredicto: "no-verificable", motivo: `universos-que-no-reconcilian: ${dn} sobre ${dd} no es una proporción de la casa`, verdad: "", evidencia: [num.label, den.label] }); }
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

const _OP_ALIAS = { resta: "diferencia", diferencia_pp: "pp", division: "cociente", ratio: "cociente", veces: "cociente", proporcion: "cociente", total: "suma", sumar: "suma", restar: "diferencia" };
function _derivada(H, h, I, libro = null) {
  const op0 = normalizar(h.op || "");
  const op = _OP_ALIAS[op0] || op0;
  const ops = _lista(h.de).map((x) => _operando(I, x, libro));
  const falta = _lista(h.de)[ops.findIndex((x) => !x)];
  if (falta !== undefined) return _aplica(H, { veredicto: "no-verificable", motivo: `sin-evidencia: el operando ${JSON.stringify(falta)} no está en la evidencia`, verdad: "", evidencia: [] });
  if (ops.length < 2) return _aplica(H, { veredicto: "no-verificable", motivo: "derivada-incompleta: hacen falta al menos dos operandos", verdad: "", evidencia: [] });
  for (const f of ops) { _addEnt(H, I, f.entidad); const c = claveDeMetrica(f.concepto); H.claves.add(c || normalizar(f.concepto).replace(/\s+/g, "_")); H.numeros.push({ raw: f.raw, unidad: f.unidad, texto: f.texto || "" }); }
  H.roles.sujetos = [...new Set(ops.map((f) => f.entidad || "negocio"))]; H.dominio = _dominioDeFig(ops[0]);
  const raws = ops.map((f) => f.raw), u0 = ops[0].unidad;
  let res = null, unidad = u0, cuenta = "";
  if (op === "suma" || op === "diferencia") {
    if (ops.some((f) => f.unidad === "pct" || f.unidad === "pp")) return _aplica(H, { veredicto: "no-verificable", motivo: "las tasas no se suman ni se restan (usa pp para la brecha entre dos tasas)", verdad: "", evidencia: ops.map((f) => f.label) });
    const claves = [...new Set(ops.map((f) => claveDeMetrica(f.concepto) || normalizar(f.concepto)))];
    if (claves.length > 1 && new Set(ops.map((f) => _dominioDeFig(f) || "")).size > 1) return _aplica(H, { veredicto: "no-verificable", motivo: `dominios-distintos: ${ops.map((f) => f.label).join(" y ")} no se suman`, verdad: "", evidencia: ops.map((f) => f.label) });
    const totales = ops.filter((f) => !f.entidad || f.entidad === "negocio"), partes = ops.filter((f) => f.entidad && f.entidad !== "negocio");
    if (op === "suma" && totales.length && partes.length && totales.some((t) => partes.some((p) => (claveDeMetrica(t.concepto) || "") === (claveDeMetrica(p.concepto) || "x")))) return _aplica(H, { veredicto: "no-verificable", motivo: "total-y-parte: el total ya contiene a la parte", verdad: "", evidencia: ops.map((f) => f.label) });
    /* la misma entidad, una métrica que contiene a la otra (el vencido es parte del pendiente): sumarlas cuenta dos veces */
    if (op === "suma") for (const a of ops) for (const b of ops) { if (a === b) continue; const ca = claveDeMetrica(a.concepto), cb = claveDeMetrica(b.concepto); if (ca && cb && (_CONTIENE[ca] || []).includes(cb) && normalizar(a.entidad || "negocio") === normalizar(b.entidad || "negocio")) return _aplica(H, { veredicto: "no-verificable", motivo: `parte-y-todo: ${metricaDeClave(cb)} ya está dentro de ${metricaDeClave(ca)}`, verdad: "", evidencia: ops.map((f) => f.label) }); }
  }
  if (op === "suma") { if (!ops.every((f) => _u(f.unidad) === _u(u0))) return _aplica(H, { veredicto: "no-verificable", motivo: "unidades-mezcladas", verdad: "", evidencia: ops.map((f) => f.label) }); res = raws.reduce((s, x) => s + x, 0); cuenta = ops.map(_fmtFig).join(" + "); }
  else if (op === "diferencia") { if (ops.length !== 2 || _u(ops[1].unidad) !== _u(u0)) return _aplica(H, { veredicto: "no-verificable", motivo: "diferencia: dos operandos de la misma unidad", verdad: "", evidencia: ops.map((f) => f.label) }); res = raws[0] - raws[1]; cuenta = `${_fmtFig(ops[0])} − ${_fmtFig(ops[1])}`; if (u0 === "pct") unidad = "pp"; }
  else if (op === "cociente") { if (ops.length !== 2 || raws[1] === 0) return _aplica(H, { veredicto: "no-verificable", motivo: "cociente: dos operandos, divisor ≠ 0", verdad: "", evidencia: ops.map((f) => f.label) }); if (_u(ops[0].unidad) !== _u(ops[1].unidad)) return _aplica(H, { veredicto: "no-verificable", motivo: `unidades-distintas: ${ops[0].label} (${ops[0].unidad}) no se divide por ${ops[1].label} (${ops[1].unidad})`, verdad: "", evidencia: ops.map((f) => f.label) }); const enPct = /%/.test(String(h.valor || "")) || !(h.valor != null); res = enPct ? (raws[0] / raws[1]) * 100 : raws[0] / raws[1]; unidad = enPct ? "pct" : "ratio"; cuenta = `${_fmtFig(ops[0])} ÷ ${_fmtFig(ops[1])}`; }
  else if (op === "pp") { if (ops.length !== 2 || !ops.every((f) => f.unidad === "pct" || f.unidad === "pp")) return _aplica(H, { veredicto: "no-verificable", motivo: "pp: dos tasas", verdad: "", evidencia: ops.map((f) => f.label) }); res = raws[0] - raws[1]; unidad = "pp"; cuenta = `${_fmtFig(ops[0])} − ${_fmtFig(ops[1])}`; }
  else if (op === "variacion_relativa") { if (ops.length !== 2 || raws[1] === 0) return _aplica(H, { veredicto: "no-verificable", motivo: "variación relativa: (nuevo − base) ÷ base, base ≠ 0", verdad: "", evidencia: ops.map((f) => f.label) }); res = ((raws[0] - raws[1]) / Math.abs(raws[1])) * 100; unidad = "pct"; cuenta = `(${_fmtFig(ops[0])} − ${_fmtFig(ops[1])}) ÷ ${_fmtFig(ops[1])}`; }
  else if (op === "producto") { if (ops.length !== 2) return _aplica(H, { veredicto: "no-verificable", motivo: "producto: dos operandos", verdad: "", evidencia: ops.map((f) => f.label) }); const pct = ops.find((f) => f.unidad === "pct"), otro = ops.find((f) => f !== pct); if (!pct || !otro) return _aplica(H, { veredicto: "no-verificable", motivo: "producto: una cifra × una tasa", verdad: "", evidencia: ops.map((f) => f.label) }); res = otro.raw * pct.raw / 100; unidad = otro.unidad; cuenta = `${_fmtFig(otro)} × ${_fmtFig(pct)}`; }
  else return _aplica(H, { veredicto: "no-verificable", motivo: `derivada: operación «${h.op}» desconocida (suma · diferencia · pp · variacion_relativa · producto)`, verdad: "", evidencia: [] });
  const verdad = `${cuenta} = ${formatoDeLaCasa(res, unidad)}`;
  const v = h.valor != null ? leerValor(h.valor) : null;
  if (v && Number.isFinite(v.raw)) {
    if (_u(v.unidad) !== _u(unidad) && !(unidad === "pp" && v.unidad === "pct")) return _aplica(H, { veredicto: "no-verificable", motivo: `unidad-distinta: la cuenta da ${formatoDeLaCasa(res, unidad)} y el valor dicho es ${v.texto}`, verdad, evidencia: ops.map((f) => f.label) });
    const dec = _decimales(v.texto), escala = /m\b/i.test(v.texto) ? 1e6 : /k\b/i.test(v.texto) ? 1e3 : 1;
    const tol = (unidad === "money" && dec > 0) ? 0.5 * Math.pow(10, -dec) * escala + 1e-9 : Math.max(tolCalculo(res, unidad === "pp" ? "pct" : unidad), 0.5 * Math.pow(10, -dec) + 1e-9);
    const conSigno = /^\s*[+\-−]/.test(String(h.valor || ""));
    /* la cuenta sobre los operandos tal como se muestran (redondeados a la precisión dicha) también vale: $4.6M + $2.5M = $7.1M */
    const redondear = (x) => (Math.round((x / escala) * Math.pow(10, dec)) / Math.pow(10, dec)) * escala;
    const resRed = op === "suma" ? raws.map(redondear).reduce((s, x) => s + x, 0) : (op === "diferencia" || op === "pp") ? redondear(raws[0]) - redondear(raws[1]) : res;
    const cerca = (r) => Math.abs(Math.abs(r) - Math.abs(v.raw)) <= tol;
    if (!cerca(res) && !cerca(resRed)) return _aplica(H, { veredicto: "falsa", motivo: `derivada-falsa: ${verdad}, no ${v.texto}`, verdad, evidencia: ops.map((f) => f.label) });
    if (op === "diferencia" && res < 0 && !conSigno && v.raw > 0 && Math.abs(res) > tol) return _aplica(H, { veredicto: "falsa", motivo: `signo: la diferencia es ${formatoDeLaCasa(res, unidad)} (negativa), no ${v.texto}`, verdad, evidencia: ops.map((f) => f.label) });
    H.numeros.push({ raw: v.raw, unidad: v.unidad, texto: v.texto });
  }
  H.render.valor = v && Number.isFinite(v.raw) ? _canonTexto(v.texto) : formatoDeLaCasa(res, unidad); H.numeros.push({ raw: res, unidad, texto: formatoDeLaCasa(res, unidad) });
  H.resultado = { raw: res, unidad, texto: formatoDeLaCasa(res, unidad) };
  return _aplica(H, { veredicto: "verdadera", motivo: `derivada (${op}): ${verdad}`, verdad, evidencia: ops.map((f) => f.label) });
}
const _decimales = (t) => { const m = /\d+[.,](\d+)/.exec(String(t || "")); return m ? m[1].length : 0; };
/* el texto de una cifra dicha, en el canon de la casa (decimal con punto, sin espacio antes de % ni de pp) */
const _canonTexto = (t) => menosAscii(String(t || "")).trim().replace(/(\d),(\d)/g, "$1.$2").replace(/\s+%/g, "%").replace(/\s+pp\b/g, " pp");

function _conteoTipado(H, h, I) {
  const u = _es(h.de) ? h.de : (_es(h.universo) ? h.universo : null);
  if (!u) return null;   // sin universo tipado: lo juzga el verificador de siempre
  const c = _es(h.conteo) ? h.conteo : { n: h.n, m: h.m };
  H.universoTipado = u;   // el universo tal como se declaró: las anclas leen su eje y su exclusión
  const n = Number.isFinite(+c.n) ? +c.n : NaN;
  const U = conjuntoDeUniverso(u, I, u.eje || null, "");
  if (U.error) return _aplica(H, { veredicto: "no-verificable", motivo: U.error, verdad: "", evidencia: [] });
  const eje = normalizar(u.eje || "cliente");
  const total = I.tamanoDelEje(eje);
  const set = U.set || new Set([...I.entidades].filter(([, e]) => e.eje === eje).map(([k]) => k));
  const mBase = u.base && !/^todos?|todas$/i.test(String(u.base)) ? (conjuntoDeUniverso({ eje, base: u.base }, I, eje, "").set || new Set()).size : (total || set.size);
  /* los «de M» admisibles: el eje entero, la base, el conjunto por estados y la base con estados (la cadena antes de filtros, top y exclusiones) */
  const mAdmisibles = new Set([mBase, total].filter((x) => Number.isFinite(x) && x > 0));
  { const tam = (uu) => { try { const S = conjuntoDeUniverso(uu, I, eje, ""); return S && S.set ? S.set.size : null; } catch { return null; } };
    const tieneEst = _lista(u.estados).length || _lista(u.no_estados).length;
    const masRestriccion = (Array.isArray(u.filtros) && u.filtros.length) || u.top || u.bodega || u.excluir;   // el «de M» por estados vale solo si algo más restringe: «6 de 6 en mora» es vacuo
    if (tieneEst && masRestriccion) { const s1 = tam({ eje, estados: u.estados, no_estados: u.no_estados }); if (s1) mAdmisibles.add(s1); if (u.base) { const s2 = tam({ eje, base: u.base, estados: u.estados, no_estados: u.no_estados }); if (s2) mAdmisibles.add(s2); } }
    if (u.bodega) { const s3 = tam({ eje, bodega: u.bodega }); if (s3) mAdmisibles.add(s3); } }
  const mDicho = c.m != null && Number.isFinite(+c.m) ? +c.m : null;
  const mRender = mDicho != null && mAdmisibles.has(mDicho) ? mDicho : mBase;
  H.universo = { set, fuente: U.fuente, texto: nombrarUniverso(u, I), restringido: !!U.set };
  H.render.universo = H.universo.texto; H.render.n = String(set.size); H.render.m = String(mRender);
  for (const k of set) H.entidades.add(k);
  H.roles.miembros = [...set].map((k) => (I.entidades.get(k) || { nombre: k }).nombre);
  { const nombrados = _lista(h.sujeto).map((x) => { const r = I.resolverEntidad(x); return normalizar(r ? r.nombre : x); }); const fuera = nombrados.filter((k) => !set.has(k)); if (fuera.length) return _aplica(H, { veredicto: "falsa", motivo: `fuera-del-conjunto: ${fuera.map((k) => (I.entidades.get(k) || { nombre: k }).nombre).join(", ")} no está en «${nombrarUniverso(u, I)}»`, verdad: `${nombrarUniverso(u, I)}: ${H.roles.miembros.join(", ")}`, evidencia: [U.fuente].filter(Boolean) }); }
  for (const f of Array.isArray(u.filtros) ? u.filtros : []) { _addClave(H, f.metrica); if (f.valor != null && !Array.isArray(f.valor)) { const unidad = f.unidad && !/^(?:days|money|pct|pp|count|ratio)$/.test(String(f.unidad)) ? "days" : (f.unidad || unidadDeClave(f.metrica) || "count"); const raw = f.unidad && !/^(?:days|money|pct|pp|count|ratio)$/.test(String(f.unidad)) ? diasDe(f.valor, f.unidad) : +f.valor; H.numeros.push({ raw: +f.valor, unidad: unidad === "days" && raw !== +f.valor ? "count" : unidad, texto: String(f.valor) }); if (raw != null && raw !== +f.valor) H.numeros.push({ raw, unidad: "days", texto: `${raw} días` }); H.render.umbral = _fmtUmbral(f).replace(/^.*?(?:superior a|de al menos|inferior a|de hasta|igual a|entre)\s+/, ""); } }
  if (u.top) { _addClave(H, u.top.metrica); H.numeros.push({ raw: +u.top.k, unidad: "count", texto: String(u.top.k) }); H.render.k = String(u.top.k); }
  for (const e of [..._lista(u.estados), ..._lista(u.no_estados), ..._lista(u.excluir && u.excluir.estados)]) { const c = _canonDe(e); H.estado = H.estado || c; H.estadosDelUniverso = H.estadosDelUniverso || new Set(); H.estadosDelUniverso.add(c); if (!H.dominio) H.dominio = dominioDeEstado(c); }
  H.numeros.push({ raw: set.size, unidad: "count", texto: String(set.size) }, { raw: mBase, unidad: "count", texto: String(mBase) });
  const lista = H.roles.miembros.join(", ");
  const verdad = `${set.size}${mBase ? " de " + mBase : ""} en ${H.universo.texto}${lista ? ": " + lista : ""}`;
  if (!Number.isFinite(n)) return _aplica(H, { veredicto: "verdadera", motivo: `conteo tipado: ${verdad}`, verdad, evidencia: [U.fuente] });
  if (n !== set.size) return _aplica(H, { veredicto: "falsa", motivo: `conteo-falso: son ${verdad}, no ${n}`, verdad, evidencia: [U.fuente] });
  if (mDicho != null && !mAdmisibles.has(mDicho)) return _aplica(H, { veredicto: "falsa", motivo: `universo-falso: son ${set.size} de ${[...mAdmisibles].join(" o de ")}, no de ${c.m}`, verdad, evidencia: [U.fuente] });
  return _aplica(H, { veredicto: "verdadera", motivo: `conteo tipado: ${verdad}`, verdad, evidencia: [U.fuente] });
}

/* ── la verdad de lo falso, con id: el complemento del estado y las cifras que la evidencia citó ── */
function _verdadDeLoFalso(H, h, I, libro) {
  const out = [];
  const nuevo = (suf, tipo, extra) => { const id = `${H.id}${suf}`; if (libro.porId.has(id)) return null; return { id, tipo, ...extra }; };
  if (H.tipo === "estado" && H.estado) {
    const comp = complementoDe(H.estado) || COMPLEMENTO_V3[H.estado] || null;
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

/* ── VALIDACIÓN DE ESQUEMA (v3.1 · pieza 2): el hecho tipado tiene la forma que el protocolo enseña, o no entra al libro ── */
const _ENUM = { orden_forma: ["max", "min", "puesto", "topk", "comparativo"], direccion: ["mayor", "menor", "peor", "mejor"], relacion_forma: ["veces", "fraccion", "parte", "mayor", "menor", "igual", "diferencia"], variacion_dir: ["sube", "baja"], agregado: ["suma", "participacion", "promedio"], op: ["suma", "diferencia", "cociente", "pp", "resta", "diferencia_pp", "division", "ratio", "producto", "variacion_relativa", "veces", "proporcion", "total", "sumar", "restar"] };
const _entero = (x) => Number.isFinite(+x) && Math.floor(+x) === +x;
const _esNegado = (e) => /^\s*no[ _]+\S/i.test(String(e == null ? "" : e));
const _sinNo = (e) => (typeof e === "string" ? e.replace(/^\s*no[ _]+/i, "") : e);
/* un universo escrito que nombra un estado («clientes al día», «SKU sin venta», «cuentas no en mora») se resuelve como universo tipado */
const _EJE_DE_SUSTANTIVO = { cliente: "cliente", clientes: "cliente", cuenta: "cliente", cuentas: "cliente", sku: "sku", skus: "sku", producto: "sku", productos: "sku", marca: "marca", marcas: "marca", familia: "familia", familias: "familia", bodega: "bodega", bodegas: "bodega", canal: "canal", canales: "canal" };
function _universoDeTexto(s) {
  const m = /^(?:los|las|tus|mis|sus|todos\s+los|todas\s+las)?\s*(?:\d+\s+)?([a-z]+)\s+(?:que\s+est[aá]n\s+|que\s+)?(.+)$/i.exec(normalizar(String(s || "")).trim());
  if (!m) return null;
  const eje = _EJE_DE_SUSTANTIVO[m[1]]; if (!eje) return null;
  const resto = m[2].trim();
  const c = estadoDeclarado(resto); if (c) return { eje, estados: [c] };
  const neg = /^(?:no|sin)\s+(.+)$/.exec(resto); if (neg) { const c2 = estadoDeclarado(neg[1]); if (c2) return { eje, no_estados: [c2] }; }
  return null;
}
const _ejeDeEntidad = (I, nombre) => { try { const r = I.resolverEntidad(nombre); return r ? r.eje : null; } catch { return null; } };
export function validarUniverso(u, I, sujeto = null) {
  if (u == null || typeof u === "string") return null;
  if (Array.isArray(u)) return u.every((x) => typeof x === "string" && x.trim()) ? null : "una lista de universo trae nombres de entidades";
  if (!_es(u)) return "el universo es un objeto, un texto o una lista de entidades";
  const permitidas = ["eje", "base", "estados", "no_estados", "bodega", "filtros", "top", "excluir", "union"];
  const raras = Object.keys(u).filter((k) => !permitidas.includes(k)); if (raras.length) return `universo con campos desconocidos: ${raras.join(", ")}`;
  const eje = normalizar(u.eje || "cliente");
  if (!EJES_VALIDOS.includes(eje)) return `eje desconocido «${u.eje}»`;
  if (I && typeof I.tamanoDelEje === "function" && !I.tamanoDelEje(eje)) return `eje-sin-entidades: la evidencia no trae ${PLURAL_DE_EJE[eje] || eje + "s"}`;
  for (const e of [..._lista(u.estados), ..._lista(u.no_estados)]) { const c = estadoDeclarado(e); if (!c) return `estado-desconocido: «${e}» (se escribe con su nombre exacto)`; const def = estadoDeLaCasa(c); if (!ejeCompatible(def, eje)) return `el estado «${e}» es de ${def.eje}, no de ${eje}`; }
  if (u.bodega != null && eje !== "sku") return "la bodega solo restringe SKU";
  if (u.filtros != null) { if (!Array.isArray(u.filtros)) return "filtros es una lista"; for (const f of u.filtros) { if (!_es(f) || !f.metrica) return "cada filtro es {metrica, op, valor, unidad}"; const op = opDe(f.op); if (!op) return `op desconocido «${f.op}»`; if (op === "entre") { const v = Array.isArray(f.valor) ? f.valor : [f.valor, f.hasta]; if (!Number.isFinite(+v[0]) || !Number.isFinite(+v[1]) || +v[0] > +v[1]) return "«entre» necesita [desde, hasta] con desde ≤ hasta"; } else if (f.ref == null && !Number.isFinite(+String(f.valor).replace(",", "."))) return `el filtro de ${f.metrica} necesita un valor numérico`; } }
  if (u.top != null) { if (!_es(u.top) || !u.top.metrica) return "top es {metrica, k, direccion}"; if (!_entero(u.top.k) || +u.top.k < 1) return "top.k es un entero ≥ 1"; if (u.top.direccion && !_ENUM.direccion.includes(normalizar(u.top.direccion))) return `direccion desconocida «${u.top.direccion}»`; }
  if (u.excluir != null) { if (!_es(u.excluir)) return "excluir es un objeto"; const rarasX = Object.keys(u.excluir).filter((k) => !["entidades", "conjuntos", "estados", "top", "bodega"].includes(k)); if (rarasX.length) return `excluir con campos desconocidos: ${rarasX.join(", ")}`; if (u.excluir.bodega != null && eje !== "sku") return "la exclusión por bodega solo aplica a SKU"; for (const e of _lista(u.excluir.estados)) { if (!estadoDeclarado(e)) return `estado-desconocido: «${e}»`; } for (const t of _lista(u.excluir.top)) { if (!_es(t) || !t.metrica || !_entero(t.k) || +t.k < 1) return "excluir.top es {metrica, k} con k entero ≥ 1"; } }
  if (u.union != null) { if (!Array.isArray(u.union) || !u.union.every(_es)) return "union es una lista de universos"; for (const v of u.union) { const e = validarUniverso(v, I); if (e) return e; if (!["base", "estados", "no_estados", "bodega", "filtros", "top", "excluir"].some((k) => v[k] != null)) return "una unión con el eje entero no restringe nada"; if (v.eje && normalizar(v.eje) !== eje) return `una unión mezcla ejes (${eje} y ${normalizar(v.eje)})`; } }
  { const est = _lista(u.estados).map((e) => estadoDeclarado(e)).filter(Boolean), noEst = _lista(u.no_estados).map((e) => estadoDeclarado(e)).filter(Boolean), exEst = _lista(u.excluir && u.excluir.estados).map((e) => estadoDeclarado(e)).filter(Boolean);
    if (est.some((c) => noEst.includes(c) || exEst.includes(c))) return "el universo pide y excluye el mismo estado";
    if (est.some((c) => est.includes((complementoDe(c) || COMPLEMENTO_V3[c])))) return "estados contradictorios en el mismo universo";
    if (exEst.some((c) => exEst.includes((complementoDe(c) || COMPLEMENTO_V3[c])))) return "excluir un estado y su complemento deja el eje vacío";
    if (noEst.some((c) => noEst.includes((complementoDe(c) || COMPLEMENTO_V3[c])))) return "quitar un estado y su complemento deja el eje vacío";
    const total = typeof I.tamanoDelEje === "function" ? I.tamanoDelEje(eje) : null;
    for (const t of _lista(u.excluir && u.excluir.top)) if (_es(t) && total && +t.k >= total) return `excluir los ${t.k} de mayor/menor es excluir el eje entero (${total})`;
    for (const e of _lista(u.excluir && u.excluir.entidades)) { const es = _ejeDeEntidad(I, e); if (es && es !== eje) return `«${e}» es de ${es} y el universo es de ${eje}`; } }
  if (u.filtros != null) for (const f of u.filtros) { const c = _claveEstricta(f.metrica); if (!c) return `la métrica «${f.metrica}» del filtro no es una clave de la casa`; const um = unidadDeClave(c); const uf = f.unidad ? String(f.unidad).toLowerCase() : null; if (uf && um && !_unidadCompatibleEstricta(uf, um)) return `unidad «${uf}» no es la de ${c} (${um})`; if (f.ref != null) { const rc = _refDeLaCasa(f.ref); if (rc) { if (!rc.familia.test(c)) return `referencia-ajena: ${rc.nombre} no es la referencia de ${c}`; } else { const cr = _claveEstricta(f.ref); if (!cr) return `la referencia «${f.ref}» no es una referencia ni una clave de la casa`; if (dominioDeClave(cr) && dominioDeClave(c) && dominioDeClave(cr) !== dominioDeClave(c)) return `la referencia ${cr} es de ${dominioDeClave(cr)} y la métrica ${c} de ${dominioDeClave(c)}`; if (unidadDeClave(cr) && um && !_unidadCompatibleEstricta(unidadDeClave(cr), um)) return `la referencia ${cr} (${unidadDeClave(cr)}) no se compara con ${c} (${um})`; } } }
  if (sujeto && typeof sujeto === "string" && sujeto !== "negocio") { const es = _ejeDeEntidad(I, sujeto); if (es && es !== eje) return `el sujeto «${sujeto}» es de ${es} y el universo es de ${eje}`; }
  return null;
}
const EJES_VALIDOS = ["cliente", "sku", "marca", "familia", "bodega", "canal", "mes"];
const _GENERICAS = new Set(["deuda", "saldo", "deuda total", "saldos", "monto", "cifra", "valor"]);
const _claveEstricta = (m) => { const s = normalizar(String(m || "")); if (!s || _GENERICAS.has(s)) return null; const k = claveDeMetrica(m); return k && metricaPorClave(k) ? k : null; };
/* las referencias de la casa y la familia de métricas que comparan: una referencia de otra familia no es un filtro */
const _REF_DE_LA_CASA = [
  { re: /^benchmark(?:[ _]de[ _]margen)?$|^margen[ _]benchmark$/, familia: /^margen/, nombre: "benchmark" },
  { re: /^nivel[ _](?:de[ _])?carga(?:[ _]declarad[oa])?$|^carga[ _]declarada$/, familia: /^carga/, nombre: "nivel_carga" },
  { re: /^umbral(?:[ _]de)?[ _]materialidad$|^materialidad$/, familia: /^(?:ventas|contribucion|no_capturada|brecha|saldo_|abonado|carga_alta)/, nombre: "umbral_materialidad" },
  { re: /^piso(?:[ _]de)?[ _]rotacion$/, familia: /^rotacion/, nombre: "piso_rotacion" },
  { re: /^techo(?:[ _]de)?[ _]cobertura$/, familia: /^(?:dias_inventario|cobertura)/, nombre: "techo_cobertura" },
];
const _refDeLaCasa = (ref) => { const s = normalizar(String(ref || "")).trim(); return _REF_DE_LA_CASA.find((r) => r.re.test(s)) || null; };
const _unidadCompatibleEstricta = (a, b) => { const A = String(a || "").toLowerCase(), B = String(b || "").toLowerCase(); if (A === B) return true; if ((A === "pct" && B === "pp") || (A === "pp" && B === "pct")) return false; const t = /^(?:days|dias|dia|d|semanas?|meses|mes|trimestres?|semestres?|anos?|años?)$/; if (t.test(A) && t.test(B)) return true; return unidadCompatible(A) === unidadCompatible(B); };
export function validarHecho(h, I) {
  const tipo = normalizar(h.tipo);
  const repetidos = (xs) => { const v = xs.map((x) => normalizar(typeof x === "string" ? x : JSON.stringify(x))); return new Set(v).size !== v.length; };
  if (tipo === "orden") { const o = _es(h.orden) ? h.orden : {}; if (!_ENUM.orden_forma.includes(normalizar(o.forma || ""))) return `orden.forma desconocida «${o.forma}»`; if ((normalizar(o.forma) === "min" && normalizar(o.direccion || "") === "mayor") || (normalizar(o.forma) === "max" && normalizar(o.direccion || "") === "menor")) return "forma y dirección contradictorias (min es menor, max es mayor)"; if (/^(?:puesto|topk)$/.test(normalizar(o.forma)) && (!_entero(o.k) || +o.k < 1)) return "orden.k es un entero ≥ 1"; if (o.direccion && !_ENUM.direccion.includes(normalizar(o.direccion))) return `orden.direccion desconocida «${o.direccion}»`; if (Array.isArray(h.sujeto) && repetidos(h.sujeto)) return "sujetos repetidos"; return validarUniverso(h.universo, I, Array.isArray(h.sujeto) ? h.sujeto[0] : h.sujeto); }
  if (tipo === "relacion") { const r = _es(h.relacion) ? h.relacion : {}; if (!_ENUM.relacion_forma.includes(normalizar(r.forma || ""))) return `relacion.forma desconocida «${r.forma}»`; if (Array.isArray(h.sujeto) && repetidos(h.sujeto)) return "sujetos repetidos"; if (_es(r.vs) && Array.isArray(r.vs.grupo) && repetidos(r.vs.grupo)) return "comparados repetidos"; if (r.k != null && !(Number.isFinite(+r.k) && +r.k > 0)) return "relacion.k es un número > 0"; return null; }
  if (tipo === "conteo") { const c = _es(h.conteo) ? h.conteo : h; if (!_entero(c.n) || +c.n < 0) return "conteo.n es un entero ≥ 0"; if (c.m != null && (!_entero(c.m) || +c.m < +c.n)) return "conteo.m es un entero ≥ n"; return validarUniverso(h.de != null ? h.de : h.universo, I); }
  if (tipo === "variacion") { const v = _es(h.variacion) ? h.variacion : {}; if (v.direccion && !_ENUM.variacion_dir.includes(normalizar(v.direccion))) return `variacion.direccion desconocida «${v.direccion}»`; if (h.periodo && !/^(?:anterior|presupuesto|actual)$/.test(periodoDe(h.periodo))) return `periodo desconocido «${h.periodo}»`; return null; }
  if (tipo === "estado") { const e = _sinNo(_es(h.estado) ? h.estado.estado : h.estado); const c = estadoDeclarado(e); if (!c) return `estado-desconocido: «${e}» (se escribe con su nombre exacto)`; const def = estadoDeLaCasa(c); const sujetos = _lista(h.sujeto); for (const s of sujetos) { const es = _ejeDeEntidad(I, s); if (es && !ejeCompatible(def, es)) return `el estado «${e}» es de ${def.eje} y «${s}» es de ${es}`; } const bodega = _es(h.estado) ? h.estado.bodega : h.bodega; if (bodega && sujetos.some((s) => _ejeDeEntidad(I, s) && _ejeDeEntidad(I, s) !== "sku")) return "la bodega solo acompaña a un SKU"; return null; }
  if (tipo === "razon") { if (h.valor != null) { const v = leerValor(h.valor); if (v && Number.isFinite(v.raw) && (!/^(?:pct|ratio|count)$/.test(v.unidad || "count") || /(?:unidades?|d[ií]as?|\$|\bpp\b|puntos|k\b|m\b)/i.test(String(h.valor)))) return `una razón es una proporción: «${h.valor}» no es un porcentaje ni un cociente`; } const nk = _es(h.num) && h.num.metrica != null ? _claveEstricta(h.num.metrica) : null, dk = _es(h.den) && h.den.metrica != null ? _claveEstricta(h.den.metrica) : null; if (_es(h.num) && h.num.metrica != null && !nk) return `la métrica «${h.num.metrica}» del numerador no es una clave de la casa`; if (_es(h.den) && h.den.metrica != null && !dk) return `la métrica «${h.den.metrica}» del denominador no es una clave de la casa`; if (nk && dk && unidadDeClave(nk) && unidadDeClave(dk) && !_unidadCompatibleEstricta(unidadDeClave(nk), unidadDeClave(dk))) return `unidades-distintas: ${nk} (${unidadDeClave(nk)}) no se divide por ${dk} (${unidadDeClave(dk)})`; return null; }
  if (tipo === "derivada") { const op = normalizar(h.op || ""); if (!_ENUM.op.includes(op)) return `derivada.op desconocida «${h.op}»`; const de = _lista(h.de); if (de.length < 2) return "derivada.de necesita al menos dos operandos"; if (repetidos(de)) return "operandos repetidos"; return null; }
  if (tipo === "grupo") { const m = _lista(h.miembros).length ? _lista(h.miembros) : _lista(h.sujeto); if (repetidos(m)) return "miembros repetidos"; { const ejesM = [...new Set(m.map((x) => _ejeDeEntidad(I, x)).filter(Boolean))]; if (ejesM.length > 1) return `miembros de ejes distintos (${ejesM.join(", ")}) no forman un grupo`; } if (h.agregado && !_ENUM.agregado.includes(normalizar(h.agregado))) return `agregado desconocido «${h.agregado}»`; return validarUniverso(h.universo, I); }
  if (tipo === "cifra") { if (h.universo != null && typeof h.universo !== "string") { const e = validarUniverso(h.universo, I, h.sujeto); if (e) return e; } return null; }
  return null;
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
    /* el contrato tipado se valida ANTES de evaluar: lo mal formado no se adivina (ronda 5, R13) */
    { const e = validarHecho(h, I); if (e) { H.motivo = `esquema: ${e}`; return H; } }
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
      if (tipo === "razon") return _razon(H, h, I, libro);
      if (tipo === "derivada") return _derivada(H, h, I, libro);
      if (tipo === "conteo" && typeof h.de === "string") { const t = _universoDeTexto(h.de); if (t) h = { ...h, de: t }; }
      if (tipo === "conteo") { const R = _conteoTipado(H, h, I); if (R) return R; }
      if (tipo === "cifra" && (h.valor == null || h.valor === "")) {
        /* la cifra identificada por (sujeto, clave) sin valor: la fig de la boleta o la proyección */
        const sujeto = h.sujeto === "negocio" || /^(?:negocio|total)$/i.test(String(h.sujeto || "")) ? "negocio" : h.sujeto;
        const f = _figDe(I, sujeto, h.metrica, h.unidad || null);
        if (!f) { H.motivo = `sin-evidencia: la boleta no trae «${metricaDeClave(h.metrica)}» de ${sujeto}`; H.roles.sujetos = [sujeto]; _addEnt(H, I, sujeto); _addClave(H, h.metrica); return H; }
        if (h.unidad && !_unidadCompatibleEstricta(String(h.unidad), f.unidad || "count")) { H.motivo = `unidad-declarada: ${f.label} viene en ${f.unidad || "count"}, no en ${h.unidad}`; H.roles.sujetos = [sujeto]; _addEnt(H, I, sujeto); _addClave(H, h.metrica); H.evidencia = [f.label]; return H; }
        return _deFig(H, I, f, sujeto);
      }
      /* lo demás lo juzga verificar.js con la afirmación traducida */
      const negado = tipo === "estado" && _esNegado(_es(h.estado) ? h.estado.estado : h.estado);
      const a2 = _aV2(negado ? { ...h, estado: _es(h.estado) ? { ...h.estado, estado: _sinNo(h.estado.estado) } : _sinNo(h.estado) } : h, I);
      const v = _juzgarV2(a2, I);
      if (negado) { if (v.veredicto === "verdadera") { v.veredicto = "falsa"; v.motivo = `negacion-falsa: sí está «${a2.estado.estado}» (${v.verdad || v.motivo})`; } else if (v.veredicto === "falsa") { v.veredicto = "verdadera"; v.motivo = `no está «${a2.estado.estado}»: ${v.verdad || v.motivo}`; } }
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
      if (a2.orden) { H.forma = normalizar(String(a2.orden.forma || "")); if (Number.isFinite(+a2.orden.k)) { H.numeros.push({ raw: +a2.orden.k, unidad: "count", texto: String(a2.orden.k) }); H.render.k = String(a2.orden.k); } H.direccion = a2.orden.direccion || (a2.orden.forma === "max" || a2.orden.forma === "topk" ? "mayor" : a2.orden.forma === "min" ? "menor" : "");   /* por definición: max = mayor, min = menor (ronda 5, R2) */ H.forma = a2.orden.forma; }
      if (a2.variacion) { if (a2.variacion.valor != null) _addNum(H, a2.variacion.valor); H.direccion = a2.variacion.direccion; H.periodo = periodoDe(h.periodo || "anterior"); H.claves.add(H.periodo === "presupuesto" ? "vs_presupuesto" : "variacion"); }
      if (a2.conteo) { H.numeros.push({ raw: +a2.conteo.n, unidad: "count", texto: String(a2.conteo.n) }); H.render.n = String(a2.conteo.n); if (a2.conteo.m != null) { H.numeros.push({ raw: +a2.conteo.m, unidad: "count", texto: String(a2.conteo.m) }); H.render.m = String(a2.conteo.m); } }
      if (a2.periodo && !H.periodo) H.periodo = periodoDe(a2.periodo);
      /* el universo evaluado (tipado o texto) y su nombre para {id.universo} */
      const u = a2.universo;
      if (_es(u) || (typeof u === "string" && u.trim() && (tipo === "orden" || tipo === "grupo" || tipo === "conteo"))) {
        let U = null; try { U = conjuntoDeUniverso(u, I, _es(u) ? u.eje || null : null, a2.metrica); } catch { U = null; }
        H.universo = { set: U && U.set ? U.set : null, fuente: U ? (U.fuente || U.error || "") : "", texto: nombrarUniverso(u, I), restringido: _es(u) ? !!(U && U.set) : true };
        if (_es(u)) H.universoTipado = u;   // el universo tal como se declaró (las anclas leen su exclusión)
        /* un universo escrito como texto («los clientes con saldo vencido», «las 5 marcas»): publica sus estados y solo restringe si no es el eje entero */
        if (typeof u === "string") {
          for (const e of estadosEn(u)) { const c = _canonDe(typeof e === "string" ? e : (e && (e.canon || e.estado)) || ""); if (c && ESTADOS_CANON.has(c)) { H.estadosDelUniverso = H.estadosDelUniverso || new Set(); H.estadosDelUniverso.add(c); } }
          const ejeU = (() => { const s0 = H.roles.sujetos.find((x) => x !== "negocio"); const ent = s0 && I.entidades ? I.entidades.get(normalizar(s0)) : null; return (ent && ent.eje) || (typeof I.ejeDe === "function" ? I.ejeDe(s0) : null) || null; })();
          const total = ejeU && typeof I.tamanoDelEje === "function" ? I.tamanoDelEje(ejeU) : null;
          if (U && U.set && total && U.set.size >= total) H.universo.restringido = false;
          const mEje = /^(?:todos\s+los|todas\s+las|los|las|tus|sus|mis)\s+(?:(\d+)\s+)?(?:clientes?|skus?|marcas?|familias?|bodegas?|canales?)(?:\s+(?:de\s+(?:la|tu|su)\s+cartera|del\s+negocio|de\s+la\s+empresa))?$/i.exec(normalizar(u).trim());
          if (mEje && (!mEje[1] || !total || +mEje[1] >= total)) H.universo.restringido = false;
        }
        /* un conteo con predicado de estado («frenados», «en mora») afirma ese estado: lo lleva con sus métricas y su dominio */
        if (tipo === "conteo" && typeof a2._predicado === "string") {
          for (const c of estadosEn(a2._predicado)) { if (!ESTADOS_CANON.has(c)) continue; H.estado = H.estado || c; H.estadosDelUniverso = H.estadosDelUniverso || new Set(); H.estadosDelUniverso.add(c); for (const k of METRICAS_DE_ESTADO[c] || []) H.claves.add(k); if (!H.dominio) H.dominio = dominioDeEstado(c); }
        }
        H.render.universo = H.universo.texto;
        if (_es(u)) { for (const f of Array.isArray(u.filtros) ? u.filtros : []) { _addClave(H, f.metrica); if (f.valor != null && !Array.isArray(f.valor)) { const enDias = f.unidad && !/^(?:days|money|pct|pp|count|ratio)$/.test(String(f.unidad)); H.numeros.push({ raw: +f.valor, unidad: enDias ? "count" : (f.unidad || unidadDeClave(f.metrica) || "count"), texto: String(f.valor) }); if (enDias) { const d = diasDe(f.valor, f.unidad); if (d != null) H.numeros.push({ raw: d, unidad: "days", texto: `${d} días` }); } H.render.umbral = _fmtUmbral(f).replace(/^.*?(?:superior a|de al menos|inferior a|de hasta|igual a|entre)\s+/, ""); } } if (u.top) { _addClave(H, u.top.metrica); H.numeros.push({ raw: +u.top.k, unidad: "count", texto: String(u.top.k) }); } for (const e of [..._lista(u.estados), ..._lista(u.no_estados), ..._lista(u.excluir && u.excluir.estados)]) { H.estadosDelUniverso = H.estadosDelUniverso || new Set(); H.estadosDelUniverso.add(_canonDe(e)); } }
      }
      if (tipo === "cifra" && v.veredicto === "verdadera") { const f = (v.evidencia || []).map((l) => I.figs.find((g) => normalizar(g.label) === normalizar(l))).find(Boolean); if (f) { H.render.valor = f.texto || (f.fig && String(f.fig.value)) || ""; if (!H.dominio) H.dominio = _dominioDeFig(f); } if (!H.render.valor && a2.valor && a2.valor.texto) H.render.valor = a2.valor.texto; }
      if (tipo === "grupo") { const gv = leerValor(a2.valor); if (gv && gv.texto) H.render.valor = _canonTexto(gv.texto); }
      /* un grupo con universo tipado: cada miembro pertenece al universo, o el grupo es falso */
      if (tipo === "grupo" && _es(h.universo) && H.ok) { let U = null; try { U = conjuntoDeUniverso(h.universo, I, h.universo.eje || null, ""); } catch { U = null; } const miembros = (_lista(h.miembros).length ? _lista(h.miembros) : _lista(h.sujeto)).map((x) => { const r = I.resolverEntidad(x); return normalizar(r ? r.nombre : x); }); if (U && U.set) { const fuera = miembros.filter((k) => !U.set.has(k)); if (fuera.length) _aplica(H, { veredicto: "falsa", motivo: `fuera-del-universo: ${fuera.map((k) => (I.entidades.get(k) || { nombre: k }).nombre).join(", ")} no pertenece a «${nombrarUniverso(h.universo, I)}»`, verdad: `${nombrarUniverso(h.universo, I)}: ${[...U.set].map((k) => (I.entidades.get(k) || { nombre: k }).nombre).join(", ")}`, evidencia: H.evidencia }); } else if (U && U.error) _aplica(H, { veredicto: "no-verificable", motivo: U.error, verdad: "", evidencia: [] }); }
      /* la unidad declarada tiene que ser la de la fig; pp dicho por % (o al revés) es otra cifra; el signo de una variación es su dirección */
      if ((tipo === "cifra" || tipo === "variacion") && H.ok) {
        const f = (v.evidencia || []).map((l) => I.figs.find((g) => normalizar(g.label) === normalizar(l))).find(Boolean);
        const vd = h.valor != null ? leerValor(h.valor) : (tipo === "variacion" && _es(h.variacion) && h.variacion.valor != null ? leerValor(h.variacion.valor) : null);
        if (f && h.unidad && !_unidadCompatibleEstricta(String(h.unidad), f.unidad || "count")) _aplica(H, { veredicto: "no-verificable", motivo: `unidad-declarada: ${f.label} viene en ${f.unidad}, no en ${h.unidad}`, verdad: _fmtFig(f), evidencia: [f.label] });
        else if (f && vd && Number.isFinite(vd.raw) && ((vd.unidad === "pp" && f.unidad === "pct") || (vd.unidad === "pct" && f.unidad === "pp")) && /pp|puntos|%/i.test(String(h.valor != null ? h.valor : (h.variacion && h.variacion.valor)))) _aplica(H, { veredicto: "falsa", motivo: `unidad: ${f.label} es ${f.unidad === "pct" ? "un porcentaje" : "puntos"}, no ${vd.texto}`, verdad: _fmtFig(f), evidencia: [f.label] });
        else if (tipo === "variacion" && vd && Number.isFinite(vd.raw) && /^[+\-−]/.test(String(h.variacion && h.variacion.valor || "").trim()) && H.direccion && ((H.direccion === "sube" && vd.raw < 0) || (H.direccion === "baja" && vd.raw > 0))) _aplica(H, { veredicto: "falsa", motivo: `signo: «${vd.texto}» contradice la dirección «${H.direccion}»`, verdad: f ? _fmtFig(f) : "", evidencia: f ? [f.label] : [] });
      }
      if (tipo === "variacion") { const f = (v.evidencia || []).map((l) => I.figs.find((g) => normalizar(g.label) === normalizar(l))).find(Boolean); H.render.valor = a2.variacion && a2.variacion.valor && a2.variacion.valor.texto ? _canonTexto(a2.variacion.valor.texto) : (f ? (f.texto || (f.fig && String(f.fig.value)) || "") : ""); if (f && !H.numeros.length) H.numeros.push({ raw: f.raw, unidad: f.unidad, texto: f.texto || "" }); }
      return H;
    } catch (e) {
      H.veredicto = "no-verificable"; H.motivo = `error-del-libro: ${e && e.message ? e.message : e}`; return H;
    }
  };
  /* las lecturas y las propuestas se evalúan después de los hechos: su apoyo puede venir declarado más abajo */
  cola.sort((a, b) => (normalizar(a.tipo) === "lectura" ? 1 : 0) - (normalizar(b.tipo) === "lectura" ? 1 : 0));
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
