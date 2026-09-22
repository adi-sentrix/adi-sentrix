/* === src/adi/notario/afirmacion.js · LA AFIRMACIÓN DECLARADA (Notario semántico, fase 1 · owner 2026-09-15) ═══════════
 * EL PRINCIPIO DE PRODUCTO (owner): «el modelo redacta; el modelo declara qué está afirmando; Notario verifica la afirmación
 * contra la evidencia estructurada; la redacción no determina la verdad».
 *
 * Este archivo es el ESQUEMA de esa declaración y su normalización. Una afirmación es una forma cerrada con vocabulario de la
 * boleta —no de la prosa—: qué tipo de hecho es, de quién, qué métrica, qué valor o relación, en qué universo y período, y con
 * qué evidencia. Lo que la prosa diga es libre; lo que se verifica es esto.
 *
 * EL CANDADO DEL SIGNIFICADO COMPLETO (owner): «la declaración debe cubrir el significado completo de la frase, incluida relación,
 * orden, grupo, universo y período cuando correspondan». Acá se traduce en CAMPOS OBLIGATORIOS POR TIPO: un orden sin universo,
 * una variación sin período, un grupo sin sus entidades o una relación sin el otro lado NO es una afirmación verificable — la
 * normalización la devuelve con `faltas`, y el verificador la califica «no-verificable» (nunca verdadera). Y «lectura» exige sello.
 *
 * Los tipos:
 *   cifra      · una entidad (o el negocio, o un agregado descrito) tiene un valor en una métrica       «Lider · Saldo vencido = $4.6M»
 *   orden      · una posición en un ranking: máximo, mínimo, puesto k, top-k, o A antes que B         «Falabella es la que más vende»
 *   relacion   · dos cifras en palabras: k veces, fracción de un todo, mayor/menor, diferencia         «vende más del doble que Ripley»
 *   grupo      · una cifra AGREGADA que pertenece a un conjunto entero de entidades                     «los tres grandes suman 49 %»
 *   conteo     · cuántas entidades cumplen un predicado, de cuántas                                     «5 cuentas materiales de 8»
 *   variacion  · una métrica sube o baja respecto de un período, con o sin magnitud                     «Mercado Libre crece 25.3 %»
 *   estado     · el estado declarado de una entidad (inventario)                                         «LG-DRYER8KG está frenado»
 *   lectura    · una interpretación, no un hecho: lleva sello y NO puede encubrir un hecho verificable   «Yo miraría primero a Lider»
 *
 * Puro: sin I/O, sin dato. Quien verifica es verificar.js; quien detecta lo no declarado, presencia.js. */
import { parseFigures } from "../boleta.js";

export const TIPOS = ["cifra", "orden", "relacion", "grupo", "conteo", "variacion", "estado", "lectura"];
export const SELLOS = ["probado", "indicado", "abierto", "criterio mío"];
export const FORMAS_DE_ORDEN = ["max", "min", "puesto", "topk", "comparativo"];
export const FORMAS_DE_RELACION = ["veces", "fraccion", "parte", "mayor", "menor", "igual", "diferencia"];   // «parte»: A es parte de B («$9.8M pendientes, de eso $4.6M vencidos»), sin cociente dicho
export const DIRECCIONES = ["mayor", "menor", "peor", "mejor"];
export const DIRECCIONES_DE_VARIACION = ["sube", "baja", "estable"];

/* los sujetos que nombran el todo: se resuelven a las figs sin entidad (totales del negocio) */
const _NEGOCIO = /^(?:el\s+)?(?:negocio|total|la\s+cartera|cartera|global|la\s+empresa|empresa|el\s+total)$/i;

export const normalizar = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/* _valor(v) → {texto, raw, unidad} desde «$4.6M», «47%», «8.6 pp», «269 días», «1.0x», «1.194 unidades», 5, «5» o un objeto ya armado.
 * Las cifras con unidad las canoniza parseFigures (el MISMO canon de la boleta); los enteros pelados son conteos/unidades. */
/** menosAscii(s) → el menos tipográfico («−», «–») como «-»: parseFigures lee «−3.7%» como +3.7 y el Notario no puede heredar ese signo */
export const menosAscii = (s) => String(s == null ? "" : s).replace(/[\u2212\u2013]/g, "-");
export function leerValor(v) {
  if (v == null || v === "") return null;
  if (typeof v === "object") {
    const t = v.texto != null ? String(v.texto) : (v.raw != null ? String(v.raw) : "");
    const base = t ? leerValor(t) : null;
    return { texto: t || (base ? base.texto : ""), raw: Number.isFinite(+v.raw) ? +v.raw : (base ? base.raw : NaN), unidad: v.unidad || (base ? base.unidad : "count"), canon: base ? base.canon : null };
  }
  if (typeof v === "number") return { texto: String(v), raw: v, unidad: "count", canon: `count:${v}` };
  const s = String(v).trim();
  const p = parseFigures(menosAscii(s));
  if (p.length) return { texto: s, raw: p[0].raw, unidad: p[0].unit, canon: p[0].canon };
  /* la moneda sin símbolo («330K», «34.5M»: un pack que declara su moneda sin signo): dinero con su escala */
  const mk = /^([+-]?)(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s?([KMB])$/i.exec(menosAscii(s).trim());
  if (mk) { const base = /^\d{1,3}(?:[.,]\d{3})+$/.test(mk[2]) ? parseInt(mk[2].replace(/[.,]/g, ""), 10) : parseFloat(mk[2].replace(",", ".")); const esc = { K: 1e3, M: 1e6, B: 1e9 }[mk[3].toUpperCase()]; const raw = (mk[1] === "-" ? -1 : 1) * base * esc; return { texto: s, raw, unidad: "money", canon: `money:${mk[1] === "-" ? "-" : ""}${mk[2]}${mk[3].toUpperCase()}` }; }
  const m = /^([+-]?)(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(unidades|cuentas|clientes|sku|skus|bodegas|marcas|d[ií]as?|veces|x|puntos(?:\s+porcentuales)?|pp)?$/i.exec(s);
  if (m) {
    const entero = /^\d{1,3}(?:[.,]\d{3})+$/.test(m[2]);
    const raw = entero ? parseInt(m[2].replace(/[.,]/g, ""), 10) : parseFloat(m[2].replace(",", "."));
    const u = /^d/i.test(m[3] || "") ? "days" : /^(?:veces|x)$/i.test(m[3] || "") ? "ratio" : /^(?:puntos|pp)/i.test(m[3] || "") ? "pp" : "count";
    const val = m[1] === "-" ? -raw : raw;
    return { texto: s, raw: val, unidad: u, canon: u === "pp" ? `pp:${val}pp` : `${u}:${val}` };   // «1 puntos» con el canon de «1 pp» (el de parseFigures)
  }
  return { texto: s, raw: NaN, unidad: null, canon: null };
}

/* _sujeto(s) → "negocio" | nombre | [nombres] | {descripcion} — tal como lo declaró el modelo, limpio */
function _sujeto(s) {
  if (s == null) return null;
  if (Array.isArray(s)) { const l = s.map((x) => String(x).trim()).filter(Boolean); return l.length ? l : null; }
  if (typeof s === "object") { const d = String(s.descripcion || s.desc || "").trim(); return d ? { descripcion: d } : null; }
  const t = String(s).trim();
  if (!t) return null;
  if (_NEGOCIO.test(t)) return "negocio";
  return t;
}

/* _lista(x) → siempre un arreglo de strings limpios */
const _lista = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]).map((s) => String(s).trim()).filter(Boolean);

/* K_EN_PALABRAS · «el doble» = 2, «la mitad» = 0.5, «el triple» = 3, «un tercio» = 1/3, «un cuarto» = 0.25 (para relaciones declaradas en palabras) */
export const K_EN_PALABRAS = { doble: 2, mitad: 0.5, triple: 3, "tercio": 1 / 3, "un tercio": 1 / 3, cuarto: 0.25, "un cuarto": 0.25, "cuádruple": 4, "cuadruple": 4, "quíntuple": 5, "quintuple": 5 };
function _k(k) {
  if (k == null || k === "") return NaN;
  if (typeof k === "number") return k;
  const s = normalizar(k).replace(/^(?:el|la|un|una)\s+/, "");
  if (K_EN_PALABRAS[s] != null) return K_EN_PALABRAS[s];
  const v = leerValor(String(k));
  if (v && Number.isFinite(v.raw) && v.unidad !== "money" && v.unidad !== "days") return v.unidad === "pct" ? v.raw / 100 : v.raw;   // «$33K» no es un múltiplo: la relación es de parte
  return NaN;
}

/** normalizarAfirmacion(a, i) → { afirmacion, faltas } · la afirmación limpia, con id, y la lista de lo que le falta para ser
 *  verificable según su tipo (vacía si está completa). Nunca lanza: una declaración malformada vuelve con sus faltas. */
export function normalizarAfirmacion(a, i = 0) {
  const src = a && typeof a === "object" ? a : {};
  const faltas = [];
  const tipo = normalizar(src.tipo);
  const out = { id: String(src.id || `a${i + 1}`), tipo, texto: String(src.texto || "").trim() };
  if (!TIPOS.includes(tipo)) { faltas.push(`tipo desconocido «${src.tipo}»`); return { afirmacion: out, faltas }; }
  if (!out.texto) faltas.push("texto (el fragmento de la prosa que declara)");
  out.sujeto = _sujeto(src.sujeto);
  out.metrica = src.metrica != null ? String(src.metrica).trim() : "";
  out.valor = leerValor(src.valor);
  /* el universo TIPADO (verdad finita, E1) viaja como objeto {eje, filtros, estados, excluir, top…}: no se vuelve texto */
  out.universo = src.universo != null ? (Array.isArray(src.universo) ? _lista(src.universo) : (typeof src.universo === "object" ? src.universo : String(src.universo).trim())) : "";
  out.periodo = src.periodo != null ? String(src.periodo).trim() : "";
  /* la BASE de una tasa («de su saldo pendiente», «sobre el costo»): el modelo puede declararla en `base`, y el resolutor la deja leída (objeto) */
  if (src.base != null && src.base !== "") out.base = typeof src.base === "object" ? src.base : String(src.base).trim();
  out.evidencia = _lista(src.evidencia);
  out.sello = src.sello != null ? normalizar(src.sello).replace(/^criterio\s+mio$/, "criterio mío") : "";
  const exige = (cond, que) => { if (!cond) faltas.push(que); };
  switch (tipo) {
    case "cifra": {
      exige(out.sujeto, "sujeto");
      exige(out.metrica, "metrica");
      exige(out.valor && Number.isFinite(out.valor.raw), "valor");
      break;
    }
    case "orden": {
      const o = src.orden && typeof src.orden === "object" ? src.orden : {};
      const forma = normalizar(o.forma);
      out.orden = { forma, k: o.k != null ? +o.k : null, direccion: normalizar(o.direccion) || (forma === "max" ? "mayor" : forma === "min" ? "menor" : ""), vs: o.vs != null ? String(o.vs).trim() : "" };
      exige(out.sujeto, "sujeto");
      exige(out.metrica, "metrica");
      exige(FORMAS_DE_ORDEN.includes(forma), "orden.forma (max · min · puesto · topk · comparativo)");
      if (forma === "puesto" || forma === "topk") exige(Number.isFinite(out.orden.k) && out.orden.k >= 1, "orden.k");
      if (forma === "comparativo") exige(out.orden.vs, "orden.vs (con quién se compara)");
      else exige(out.universo, "universo (de qué conjunto es el orden)");
      exige(!out.orden.direccion || DIRECCIONES.includes(out.orden.direccion), "orden.direccion (mayor · menor · peor · mejor)");
      if ((forma === "puesto" || forma === "topk" || forma === "comparativo") && !out.orden.direccion) faltas.push("orden.direccion");
      break;
    }
    case "relacion": {
      const r = src.relacion && typeof src.relacion === "object" ? src.relacion : {};
      let forma = normalizar(r.forma);
      /* una fracción sin cociente ni valor es una relación de PARTE («de eso, $4.6M vencidos»): A ⊂ B, A ≤ B */
      if (forma === "fraccion" && !(Number.isFinite(_k(r.k)) || (leerValor(src.valor) && Number.isFinite(leerValor(src.valor).raw)) || (leerValor(r.valor) && Number.isFinite(leerValor(r.valor).raw)))) forma = "parte";
      let vs = r.vs;
      /* el otro lado: un nombre, una lista, «negocio», {descripcion} o {sujeto, metrica} (con sujeto a su vez nombre, lista o {descripcion}) */
      if (Array.isArray(vs)) vs = { sujeto: _sujeto(vs), metrica: "" };
      else if (vs && typeof vs === "object") vs = { sujeto: _sujeto(vs.sujeto != null ? vs.sujeto : (vs.descripcion != null ? { descripcion: vs.descripcion } : null)), metrica: vs.metrica != null ? String(vs.metrica).trim() : "" };
      else if (vs != null && String(vs).trim()) vs = { sujeto: _sujeto(String(vs)), metrica: "" };
      else vs = null;
      out.relacion = { forma, k: _k(r.k), matiz: r.matiz != null ? normalizar(r.matiz) : "", vs, valor: leerValor(r.valor), ...(r.suma === true ? { suma: true } : {}) };   // «juntos»: la lista se compara como suma (resolutor)
      exige(out.sujeto, "sujeto");
      exige(out.metrica, "metrica");
      exige(FORMAS_DE_RELACION.includes(forma), "relacion.forma (veces · fraccion · mayor · menor · igual · diferencia)");
      exige(vs && vs.sujeto, "relacion.vs (el otro lado de la relación)");
      if (forma === "veces" || forma === "fraccion") exige(Number.isFinite(out.relacion.k) || (out.valor && Number.isFinite(out.valor.raw)), "relacion.k (el múltiplo o la fracción)");
      if (forma === "diferencia") exige((out.relacion.valor && Number.isFinite(out.relacion.valor.raw)) || (out.valor && Number.isFinite(out.valor.raw)), "valor (la diferencia dicha)");
      break;
    }
    case "grupo": {
      const g = src.grupo && typeof src.grupo === "object" ? src.grupo : {};
      const entidades = _lista(g.entidades).length ? _lista(g.entidades) : Array.isArray(out.sujeto) ? out.sujeto : [];
      out.grupo = { entidades, n: Number.isFinite(+g.n) ? +g.n : (entidades.length || null), ...(g.agregado ? { agregado: String(g.agregado) } : {}) };
      if (!Array.isArray(out.sujeto) && entidades.length) out.sujeto = entidades;
      exige(out.metrica, "metrica");
      exige(out.valor && Number.isFinite(out.valor.raw), "valor");
      exige(entidades.length || (out.sujeto && out.sujeto.descripcion) || out.universo, "grupo.entidades (o una descripción del conjunto)");
      break;
    }
    case "conteo": {
      const c = src.conteo && typeof src.conteo === "object" ? src.conteo : {};
      out.conteo = { n: c.n != null && c.n !== "" && Number.isFinite(+c.n) ? +c.n : NaN, m: c.m != null && c.m !== "" && Number.isFinite(+c.m) ? +c.m : null, predicado: c.predicado != null ? String(c.predicado).trim() : "" };   // `+null === 0`: un M ausente no es «de 0»
      exige(Number.isFinite(out.conteo.n), "conteo.n");
      exige(out.conteo.predicado || out.metrica, "conteo.predicado (qué cumplen las contadas)");
      exige(out.conteo.m != null || out.universo, "universo (de cuántas / de qué conjunto)");
      break;
    }
    case "variacion": {
      const v = src.variacion && typeof src.variacion === "object" ? src.variacion : {};
      out.variacion = { direccion: normalizar(v.direccion), valor: leerValor(v.valor) || out.valor };
      exige(out.sujeto, "sujeto");
      exige(out.metrica, "metrica");
      exige(DIRECCIONES_DE_VARIACION.includes(out.variacion.direccion), "variacion.direccion (sube · baja · estable)");
      exige(out.periodo, "periodo (respecto de qué período)");
      break;
    }
    case "estado": {
      const e = src.estado && typeof src.estado === "object" ? src.estado : { estado: src.estado };
      out.estado = { estado: normalizar(e.estado), bodega: e.bodega != null ? String(e.bodega).trim() : "" };
      exige(out.sujeto, "sujeto");
      exige(out.estado.estado, "estado.estado");
      break;
    }
    case "lectura": {
      exige(SELLOS.includes(out.sello), "sello (probado · indicado · abierto · criterio mío)");
      break;
    }
  }
  return { afirmacion: out, faltas };
}

/** normalizarAfirmaciones(lista) → [{afirmacion, faltas}] · id por posición cuando falta */
export function normalizarAfirmaciones(lista) {
  return (Array.isArray(lista) ? lista : []).map((a, i) => normalizarAfirmacion(a, i));
}
