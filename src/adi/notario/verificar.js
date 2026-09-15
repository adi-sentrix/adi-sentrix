/* === src/adi/notario/verificar.js · EL VERIFICADOR DE AFIRMACIONES (Notario semántico, fase 1 · owner 2026-09-15) ═══════════
 * «Notario verifica la afirmación y su evidencia, no la redacción superficial con la que el modelo decidió expresarla.»
 *
 * Entra una lista de afirmaciones declaradas (afirmacion.js) y la evidencia estructurada del turno (la boleta y la proyección del
 * dato, indexadas por evidencia.js). Sale, POR AFIRMACIÓN, uno de tres veredictos de hecho:
 *   · verdadera       — la evidencia la sostiene (cifra dentro de la tolerancia del muro, posición correcta en el ranking, relación
 *                       que cierra con el matiz dicho, agregado del grupo entero, conteo exacto, variación con su signo, estado declarado)
 *   · falsa           — la evidencia dice otra cosa, y se devuelve LA VERDAD al lado (para una multa exacta)
 *   · no-verificable  — la evidencia no está en la boleta, o la declaración no cubre el significado completo (universo, período,
 *                       el otro lado de la relación); NUNCA se transforma en verdadera (guardrail del owner)
 * …y para las lecturas, «sellada» (una interpretación con sello) — salvo que la lectura ENCUBRA un hecho verificable (una cifra, un
 * orden o una variación sobre una métrica de la boleta, sin negación, sin ser una recomendación y sin que otra afirmación de hecho
 * lo declare): entonces es «no-verificable» con motivo `lectura-encubre-hecho`, porque «lectura no puede usarse para transformar un
 * hecho verificable en opinión» (owner).
 *
 * LO QUE REUTILIZA (y no duplica): la tolerancia del muro (`tolCalculo`), el canon de la boleta (`parseFigures`), la tabla de matices
 * del juez de relaciones (`rangoDeMatiz`), los rankings con universo y dirección de la proyección, `grupo`/`cobertura` de las figs, el
 * vocabulario de métricas del muro (`metricasEn`). NO lee prosa para juzgar: el veredicto es función de la afirmación estructurada.
 * Tres redacciones de la misma afirmación → el mismo veredicto, por construcción. Puro: sin I/O, sin red. */
import { tolCalculo } from "../oracle/calculoCatalogo.js";
import { parseFigures } from "../boleta.js";
import { metricasEn } from "../oracle/guardC.js";
import { rangoDeMatiz } from "../agente/atributosYRelaciones.js";
import { normalizarAfirmaciones, normalizar } from "./afirmacion.js";
import { indiceDeEvidencia, tokens, numerosEn, ES_TODO, estadoCanon, conceptosDe } from "./evidencia.js";

export const VEREDICTOS = ["verdadera", "falsa", "no-verificable", "sellada"];

const _COMPAT = { pct: "tasa", pp: "tasa", money: "money", days: "days", ratio: "ratio", count: "count" };
const _u = (x) => _COMPAT[x || "count"] || x;
const _fmt = (f) => `${f.label} = ${f.fig.value}`;
const _lista = (l) => (l || []).join(", ");
const _decimales = (texto) => { const m = /\d+[.,](\d+)\s*(?:%|pp|x|d\b)/i.exec(String(texto || "")); return m ? m[1].length : (/\d+\s*(?:%|pp|x|d\b)/i.test(String(texto || "")) ? 0 : null); };
const _nom = (s) => (s === "negocio" ? "el negocio" : Array.isArray(s) ? s.join(", ") : s && typeof s === "object" ? s.descripcion : String(s));

/* _mismoValor(valorDeclarado, raw, unidad) → true si la cifra dicha es la de la boleta: mismo canon (el formateador de la casa) o dentro de
 * la tolerancia del muro (tolCalculo). Una cifra DIRECTA de la boleta se dice como la boleta la trae («21.5%», no «22%» — que es la de
 * Falabella); el redondeo a media unidad solo se admite en lo CALCULADO (derivadas y relaciones), donde el modelo redondea. */
function _mismoValor(v, raw, unidad) {
  if (!v || !Number.isFinite(v.raw) || !Number.isFinite(raw)) return false;
  const ud = v.unidad || "count", uf = unidad || "count";
  if (_u(ud) !== _u(uf)) return false;
  if (uf === "money" || uf === "days" || uf === "ratio") {
    const c = parseFigures(uf === "money" ? `$${raw}` : uf === "days" ? `${raw}d` : `${raw}x`);
    if (c.length && v.canon && c[0].canon.replace(/\$/g, "") === String(v.canon).replace(/\$/g, "")) return true;
  }
  const tol = uf === "count" ? 0 : tolCalculo(raw, uf);
  return Math.abs(v.raw - raw) <= tol;
}
/* la tolerancia de lo CALCULADO: la del muro, y al menos media unidad de la precisión dicha («36 %» cubre 35.5–36.5; «46.9 %» no cubre 47.3) */
const _tolCalculada = (v, unidad) => { const d = _decimales(v && v.texto); return Math.max(tolCalculo(v ? v.raw : 0, unidad), d != null ? 0.5 * Math.pow(10, -d) + 1e-9 : 0); };

/* ── LOS MARCADORES DE HECHO QUE UNA LECTURA NO PUEDE ENCUBRIR ────────────────────────────────────────────────────────────── */
const _ORDEN = /\b(?:(?:el|la|los|las|quien|quienes)\s+(?:[a-záéíóúñ]+\s+)?que\s+(?:m[aá]s|menos)\b|(?:el|la|los|las|quien|quienes)\s+(?:m[aá]s|menos)\b|m[aá]s\s+(?:alt[oa]s?|baj[oa]s?|grandes?|pequeñ[oa]s?|graves?|pesad[oa]s?|caros?|barat[oa]s?|lent[oa]s?|r[aá]pid[oa]s?|larg[oa]s?|cort[oa]s?|fuertes?|d[eé]bil(?:es)?)|(?:el|la|los|las)\s+(?:mayor|menor|peor|mejor)(?:es)?\b|(?:mayor|menor|peor|mejor)(?:es)?\s+(?:que|de\s+(?:la|los|las|todos|todas|toda))\b|primer[oa]?\b|segund[oa]\b|tercer[oa]?\b|cuart[oa]\b|quint[oa]\b|[uú]ltim[oa]\b|encabeza|lidera\b|supera\s+a|por\s+delante\s+de|por\s+encima\s+de|por\s+debajo\s+de|top\s*\d|ranking|se\s+lleva\s+la\s+palma)/i;
const _RELACION = /\b(?:doble|triple|mitad|tercio|cuarto\s+de|veces|casi\s+igual|igual\s+que|tanto\s+como|duplica|triplica)\b/i;
/* solo las FORMAS VERBALES de la variación: el sustantivo («ese crecimiento», «la caída») remite a una variación dicha en otra parte */
const _VARIACION = /\b(?:crec(?:e|en|i[oó]|ieron|iendo)|ca(?:e|en|y[oó]|yeron|yendo)|sub(?:e|en|i[oó]|ieron|iendo)|baj(?:a|an|ó|aron|ando)|se\s+deterior(?:a|an|[oó]|aron)|mejor(?:a|an|[oó]|aron)|empeor(?:a|an|[oó]|aron)|retroced(?:e|en|i[oó]|ieron)|avanz(?:a|an|[oó]|aron)|aument(?:a|an|[oó]|aron)|disminu(?:ye|yen|y[oó]|yeron))(?!\w)/i;
/* una RECOMENDACIÓN («resolvería LG-DRYER8KG primero», «yo miraría primero a Lider») no es un ranking: «primero» ahí es el orden de la acción */
const _RECOMIENDA = /\b(?:yo|resolver[ií]a|mirar[ií]a|atacar[ií]a|priorizar[ií]a|empezar[ií]a|arrancar[ií]a|partir[ií]a|iniciar[ií]a|abordar[ií]a|ir[ií]a|cerrar[ií]a|negociar[ií]a|liberar[ií]a|cobrar[ií]a|revisar[ií]a|recomiendo|sugiero|conviene|deber[ií]a|habr[ií]a\s+que|hay\s+que|lo\s+primero|primero\s+(?:a|con|por|hay)|prioridad|ir\s+primero|van?\s+primero|raz[oó]n\s+de\s+ir)\b/i;
const _NEGADO = /\b(?:no|sin|ni|nada|ning[uú]n[oa]?|tampoco|falta|carece|imposible)\b/i;
const _bajoNegacion = (s, pos) => _NEGADO.test((s.slice(Math.max(0, pos - 60), pos).split(/[.;:—()]/).pop() || ""));
export function encubreHecho(texto) {
  const s = String(texto || "");
  if (parseFigures(s).length || /\b\d{1,3}(?:[.,]\d{3})+\b|\b\d+\s+(?:unidades|cuentas|clientes|sku|skus|d[ií]as)\b/i.test(s)) return "una cifra";
  const mets = metricasEn(s);
  /* «crecimiento sano», «participación» a secas no son una métrica con la que verificar: hace falta una métrica de la boleta */
  const conMetrica = [...mets].some((k) => k !== "variacion" && k !== "participacion");
  if (!conMetrica) return null;
  /* la recomendación solo exime al ORDINAL («resolvería X primero»); «encabeza la venta» o «la que más vende» son hechos aunque la frase recomiende */
  { const rx = new RegExp(_ORDEN.source, "gi"); let m1; while ((m1 = rx.exec(s))) { if (_bajoNegacion(s, m1.index)) continue; if (/^(?:primer|segund|tercer|[uú]ltim)/i.test(m1[0]) && _RECOMIENDA.test(s)) continue; return "un orden sobre una métrica de la boleta"; } }
  const m2 = _RELACION.exec(s); if (m2 && !_bajoNegacion(s, m2.index)) return "una relación entre cifras";
  const m3 = _VARIACION.exec(s); if (m3 && !_bajoNegacion(s, m3.index)) return "una variación de una métrica";
  return null;
}

/** verificarAfirmaciones(afirmaciones, ctx) → { veredictos: [{id, tipo, veredicto, motivo, verdad, evidencia, texto, faltas}], resumen }
 *  ctx: { figs | ledger.figs, datoProyectado, ejesDelTenant } o un `indice` ya armado con indiceDeEvidencia. */
export function verificarAfirmaciones(afirmaciones, ctx = {}) {
  const indice = ctx.indice || indiceDeEvidencia({ figs: ctx.figs || (ctx.ledger && ctx.ledger.figs) || [], datoProyectado: ctx.datoProyectado || null, ejesDelTenant: ctx.ejesDelTenant || null });
  const todas = normalizarAfirmaciones(afirmaciones);
  const veredictos = todas.map(({ afirmacion: a, faltas }) => {
    const base = { id: a.id, tipo: a.tipo, texto: a.texto, faltas };
    if (faltas.length) return { ...base, veredicto: "no-verificable", motivo: `declaracion-incompleta: falta ${faltas.join("; ")}`, verdad: "", evidencia: [] };
    try {
      return { ...base, ..._verificar(a, indice, todas) };
    } catch (e) {
      return { ...base, veredicto: "no-verificable", motivo: `error-del-verificador: ${e && e.message ? e.message : e}`, verdad: "", evidencia: [] };
    }
  });
  const resumen = { total: veredictos.length, verdaderas: 0, falsas: 0, noVerificables: 0, selladas: 0 };
  for (const v of veredictos) { if (v.veredicto === "verdadera") resumen.verdaderas++; else if (v.veredicto === "falsa") resumen.falsas++; else if (v.veredicto === "sellada") resumen.selladas++; else resumen.noVerificables++; }
  return { veredictos, resumen };
}

function _verificar(a, I, todas) {
  switch (a.tipo) {
    case "cifra": return Array.isArray(a.sujeto) ? _grupo({ ...a, grupo: { entidades: a.sujeto, n: a.sujeto.length } }, I) : _cifra(a, I);
    case "orden": return _orden(a, I);
    case "relacion": return _relacion(a, I);
    case "grupo": return _grupo(a, I);
    case "conteo": return _conteo(a, I);
    case "variacion": return _variacion(a, I);
    case "estado": return _estado(a, I);
    case "lectura": return _lectura(a, I, todas);
  }
  return { veredicto: "no-verificable", motivo: "tipo desconocido", verdad: "", evidencia: [] };
}

const _ok = (motivo, evidencia, verdad = "") => ({ veredicto: "verdadera", motivo, verdad, evidencia });
const _falsa = (motivo, verdad, evidencia) => ({ veredicto: "falsa", motivo, verdad, evidencia });
const _nv = (motivo, evidencia = [], verdad = "") => ({ veredicto: "no-verificable", motivo, verdad, evidencia });

/* ── EL UNIVERSO DECLARADO CONTRA EL DE LA FIG (subtotales, agregados) ─────────────────────────────────────────────────────── */
/* _universoCasa(declarado, f) → "ok" | "promovido" (dice el todo y la fig es un subtotal) | "distinto" (otro n) | "vacio" (no declarado) */
function _universoCasa(declarado, f) {
  const u = Array.isArray(declarado) ? declarado.join(", ") : String(declarado || "");
  if (!u.trim()) return "vacio";
  const nums = numerosEn(u).filter((x) => Number.isInteger(x));
  const esSubtotal = /subtotal|promedio|resto de/i.test(f.conceptoNorm) || (f.grupo && f.n != null) || (f.cobertura && f.cobertura.alcance && !/total|negocio|global/i.test(String(f.cobertura.alcance)));
  if (nums.length && f.n != null) return nums.includes(f.n) ? "ok" : "distinto";
  if (Array.isArray(declarado) && f.entidadesDelGrupo.length) {
    const a = new Set(declarado.map(normalizar)), b = new Set(f.entidadesDelGrupo.map(normalizar));
    return a.size === b.size && [...a].every((x) => b.has(x)) ? "ok" : "distinto";
  }
  if (ES_TODO.test(u) && esSubtotal && !/total/i.test(f.conceptoNorm)) return "promovido";
  const tu = tokens(u), tf = tokens(f.universoTexto + " " + f.conceptoNorm);
  if (tu.length && tu.some((t) => tf.some((x) => x.startsWith(t.slice(0, 5))))) return "ok";
  if (!tu.length) return "ok";
  return esSubtotal ? "distinto" : "ok";
}
const _periodoCasa = (declarado, f) => {
  const p = normalizar(declarado);
  if (!p) return true;
  const fp = normalizar(f.periodo + " " + f.concepto + " " + f.context);
  /* solo dos períodos que la boleta distingue: el ANTERIOR («año anterior», «año pasado») y los cortes menores que el año («mes», «trimestre»);
   * «año cerrado», «anual», «foto de hoy», «al corte (31 ago 2026)», «al 31 de agosto» son el marco de la boleta */
  if (/anterior|pasado|previo/.test(p)) return /anterior|pasado|previo/.test(fp);
  if (/\bmes\b|trimestre|semana|semestre|mensual/.test(p)) return /\bmes\b|trimestre|semana|semestre|mensual/.test(fp);
  return !/anterior|pasado|previo/.test(normalizar(f.concepto));
};
/* un agregado que NECESITA universo declarado: un subtotal, un grupo, un «resto de» — no el promedio o el total del negocio entero */
const _necesitaUniverso = (f, sujeto) => {
  if (/(?:^|· )total$/.test(f.conceptoNorm) || (sujeto === "negocio" && /promedio/.test(f.conceptoNorm) && !/subtotal/.test(f.conceptoNorm))) return false;   // «Saldo vencido · total», «Margen promedio»: el todo
  return !!(f.grupo || f.n != null || /subtotal|resto de/.test(f.conceptoNorm) || (f.cobertura && f.cobertura.alcance && !/total|negocio|global/i.test(String(f.cobertura.alcance))));
};
/* _puntajeUniverso(declarado, f) → cuántas palabras del universo/descripción declarado están en el CALIFICADOR del agregado (no en su contexto):
 * «los que caen» elige «Markup promedio · los que caen» y no «· sanos» aunque el contexto de este nombre el benchmark */
const _puntajeUniverso = (declarado, f) => { const tu = tokens(Array.isArray(declarado) ? declarado.join(" ") : String(declarado || "")); const tf = tokens(f.calificador + " " + f.conceptoNorm); return tu.filter((t) => tf.some((x) => x.startsWith(t.slice(0, 5)))).length; };

/* ── LOS CONJUNTOS QUE LA EVIDENCIA IDENTIFICA (para universos de orden y conteo) ─────────────────────────────────────────── */
const _CLAVE_A_RANKING = { ventas: "ventas", contribucion: "contribucion", margen: "margen", carga: "carga", brecha: "brecha", unidades: "unidades", vencido: "saldo_vencido", pendiente: "saldo_pendiente", recuperado: "recuperado", diasvencido: "dias_vencido", capital: "capital", frenado: "capital_frenado", rotacion: "rotacion", cobertura: "dias_inventario", sinventa: "dias_sin_venta" };
/* _conjuntosConocidos(I) → [{nombre, set, fuente, re}] · los estados, los umbrales de los rankings (bajo/sobre el benchmark de margen, con saldo
 * vencido, sobre el nivel de carga declarado), los que caen/crecen vs año anterior, y los grupos de los agregados (con sus palabras) */
function _conjuntosConocidos(I) {
  const out = [];
  const porEstado = new Map();
  for (const x of I.estados) { const e = estadoCanon(x.estado); if (!porEstado.has(e)) porEstado.set(e, new Set()); porEstado.get(e).add(normalizar(x.entidad)); }
  for (const [e, set] of porEstado) out.push({ nombre: e, set, fuente: `estados «${e}»`, re: new RegExp(e === "inmovilizado" ? "\\b(?:inmoviliz|deten|parad)" : e === "frenado" ? "\\bfrenad" : e === "sobrestock" ? "\\bsobrestock" : e === "riesgo de quiebre" ? "\\bquiebre" : "\\bsan[oa]s?\\b", "i") });
  const R = I.rankings.cliente || {};
  const bench = I.figs.find((f) => /^benchmark de margen$/.test(f.conceptoNorm) && !f.entidad);
  if (R.margen && bench) {
    /* el benchmark es el de MARGEN («bajo el benchmark», «bajo la referencia de margen»); «el nivel de referencia» de la carga es otro umbral */
    out.push({ nombre: "bajo el benchmark", set: new Set(R.margen.filas.filter((x) => +x.valor < bench.raw).map((x) => normalizar(x.entidad))), fuente: "margen < benchmark", re: /(?:bajo|debajo|menor|no llega|lejos)[^.]{0,25}(?:benchmark|referencia\s+de\s+margen|piso\s+de\s+margen)|(?:benchmark|referencia\s+de\s+margen)[^.]{0,15}(?:bajo|debajo)/i });
    out.push({ nombre: "sobre el benchmark", set: new Set(R.margen.filas.filter((x) => +x.valor >= bench.raw).map((x) => normalizar(x.entidad))), fuente: "margen ≥ benchmark", re: /(?:sobre|encima|supera|mayor)[^.]{0,25}(?:benchmark|referencia\s+de\s+margen|piso\s+de\s+margen)|\bsan[oa]s?\b/i });
  }
  if (R.saldo_vencido) out.push({ nombre: "con saldo vencido", set: new Set(R.saldo_vencido.filas.filter((x) => +x.valor > 0).map((x) => normalizar(x.entidad))), fuente: "saldo vencido > 0", re: /vencid|mora\b/i });
  const nivel = I.figs.find((f) => /nivel de carga/.test(f.conceptoNorm) && !f.entidad);
  if (R.carga && nivel) out.push({ nombre: "sobre el nivel de carga", set: new Set(R.carga.filas.filter((x) => +x.valor > nivel.raw).map((x) => normalizar(x.entidad))), fuente: "carga > nivel declarado", re: /carga[^.]{0,40}(?:sobre|exced|encima|alta)|(?:sobre|exced|encima)[^.]{0,30}(?:carga|nivel\s+(?:de\s+referencia|declarado))|nivel\s+de\s+(?:referencia|carga)/i });
  const vars = new Map(); for (const f of I.figs) if (f.entidad && /variacion vs ano anterior/.test(f.conceptoNorm) && Number.isFinite(f.raw) && !vars.has(f.entidad)) vars.set(f.entidad, f.raw);
  if (vars.size) {
    out.push({ nombre: "los que caen", set: new Set([...vars].filter(([, v]) => v < 0).map(([e]) => normalizar(e))), fuente: "variación < 0", re: /\bcaen\b|\bcae\b|cayendo|cay[oó]|bajan\b|retroced|pierden|en\s+ca[ií]da/i });
    out.push({ nombre: "los que crecen", set: new Set([...vars].filter(([, v]) => v > 0).map(([e]) => normalizar(e))), fuente: "variación > 0", re: /\bcrecen\b|\bcrece\b|creciendo|crecieron|suben\b|avanzan/i });
  }
  for (const f of I.figs) if (f.entidadesDelGrupo.length) out.push({ nombre: f.label, set: new Set(f.entidadesDelGrupo.map(normalizar)), fuente: `grupo «${f.label}»`, tokens: tokens(f.calificador.replace(/\(.*?\)/g, "") + " " + f.base), n: f.n });
  return out;
}
const _NUM = { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
/* _topKDe(u, I, eje) → {set, fuente} para «los 5 SKU que más venden», «las 3 cuentas de mayor brecha», «top 3 en contribución»; «los que más
 * venden» sin número es el top 5 (la lista que publica la casa) */
function _topKDe(u, I, eje) {
  const s = normalizar(u);
  if (!/que m[aá]s|que menos|de mayor|de menor|mayores|menores|\btop\b|primer|principales|m[aá]s vend|m[aá]s grandes|peor|mejor/.test(s)) return null;
  const m = /(?:^|\b)(\d+|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/.exec(s);
  const k = m ? (_NUM[m[1]] || parseInt(m[1], 10)) : 5;
const tras = (/(?:m[aá]s|menos|mayor|menor|peor|mejor)\s+(.{0,40})$/.exec(s) || [])[1] || "";
  const clavesTras = [...metricasEn(tras)].map((c) => _CLAVE_A_RANKING[c]).filter(Boolean);
  const claves = clavesTras.length ? clavesTras : [...metricasEn(s)].map((c) => _CLAVE_A_RANKING[c]).filter(Boolean);
  const clave = claves[0] || (/vend|factur|grandes|principales/.test(tras || s) ? "ventas" : /contribu|aport|dejan/.test(tras || s) ? "contribucion" : /deb|pendiente/.test(tras || s) ? "saldo_pendiente" : null);
  const R = I.rankings[eje] || {};
  if (!clave || !R[clave]) return null;
  const dir = /menos|menor|peor/.test(s) && !/mejor/.test(s) ? (R[clave].peorEs && /peor/.test(s) ? R[clave].peorEs : "menor") : (R[clave].peorEs && /mejor/.test(s) ? (R[clave].peorEs === "mayor" ? "menor" : "mayor") : "mayor");
  const filas = [...R[clave].filas].sort((x, y) => dir === "mayor" ? +y.valor - +x.valor : +x.valor - +y.valor).slice(0, k);
  return { set: new Set(filas.map((x) => normalizar(x.entidad))), fuente: `los ${k} de «${dir}» en ${eje} · ${clave}` };
}
/* _conjuntoDeUniverso(u, I, eje, metrica) → { set|null (entero), fuente } o { error } */
function _conjuntoDeUniverso(u, I, eje, metrica = "") {
  if (Array.isArray(u)) return { set: new Set(u.map((e) => { const r = I.resolverEntidad(e); return normalizar(r ? r.nombre : e); })), fuente: "lista declarada" };
  const s = String(u || "");
  if (!s.trim() || ES_TODO.test(s)) return { set: null, fuente: "el eje entero" };
  /* «las bodegas del inventario», «los clientes de la cartera», «todos los SKU»: el eje entero */
  if (/^(?:las?|los|todos?|todas?)\s+(?:las?\s+|los\s+)?(?:bodegas?|clientes?|cuentas?|skus?|marcas?|familias?)(?:\s+(?:del|de\s+la|de\s+los|de\s+las|en)\s+(?:negocio|cartera|inventario|empresa|demo))?\s*$/i.test(s.trim())) return { set: null, fuente: "el eje entero" };
  const total = I.tamanoDelEje(eje);
  const nums = numerosEn(s).filter(Number.isInteger);
  if (nums.length && total && nums.includes(total) && !/que m[aá]s|de mayor|top|mayores|primer/i.test(s)) return { set: null, fuente: "el eje entero" };
  const top = _topKDe(s, I, eje);
  if (top) return top;
  const tu = tokens(s);
  const conocidos = _conjuntosConocidos(I);
  /* un grupo de un agregado, por su tamaño y sus palabras («las 5 cuentas materiales», «los que caen», «los grandes») */
  const grupos = conocidos.filter((c) => c.tokens);
  let g = null;
  if (nums.length) g = grupos.find((c) => nums.includes(c.n) && (tu.some((t) => c.tokens.some((x) => x.startsWith(t.slice(0, 5)))) || (metrica && I.casa(metrica, I.figs.find((f) => f.label === c.nombre)) > 0)));
  if (!g && tu.length) g = grupos.find((c) => tu.every((t) => c.tokens.some((x) => x.startsWith(t.slice(0, 5)))));
  if (g) return { set: g.set, fuente: g.fuente };
  /* los estados, los umbrales, los que caen/crecen — y una conjunción de dos («bajo el benchmark y sobre el nivel de carga») */
  const partes = s.split(/\s+(?:y|e)\s+|\s*\+\s*|\s*,\s*/i).map((x) => x.trim()).filter(Boolean);
  const sets = partes.map((p) => conocidos.find((x) => x.re && x.re.test(p))).filter(Boolean);
  if (sets.length && sets.length === partes.length) {
    let set = new Set(sets[0].set); for (const c of sets.slice(1)) set = new Set([...set].filter((e) => c.set.has(e)));
    return { set, fuente: sets.map((c) => c.fuente).join(" ∩ ") };
  }
  const c = conocidos.find((x) => x.re && x.re.test(s));
  if (c) return { set: c.set, fuente: c.fuente };
  return { error: `universo-no-resoluble: «${s}» no es un conjunto que la evidencia identifique (ni el eje entero)` };
}

/* ── CIFRA ──────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
function _valorDeclarado(a) { return a.valor && Number.isFinite(a.valor.raw) ? a.valor : null; }
/* las métricas cuyo ranking de la proyección trae el valor SIN escala ambigua (la venta va en miles en el dato y el capital en dólares:
 * el dinero de los rankings no se compara; unidades, tasas, días y rotación sí) — la proyección es evidencia estructurada aunque la
 * boleta del turno no traiga la fig */
const _UNIDAD_DE_RANKING = { unidades: "count", margen: "pct", carga: "pct", brecha: "pp", recuperado: "pct", dias_vencido: "days", rotacion: "ratio", dias_inventario: "days", dias_sin_venta: "days", margen_inventario: "pct" };
function _delRanking(a, I) {
  const ent = typeof a.sujeto === "string" && a.sujeto !== "negocio" ? I.resolverEntidad(a.sujeto) : null;
  if (!ent) return null;
  const rk = I.rankingDe(ent.eje, a.metrica);
  if (!rk) return null;
  const fila = rk.r.filas.find((x) => normalizar(x.entidad) === normalizar(ent.nombre));
  if (!fila || !Number.isFinite(+fila.valor)) return null;
  let u = _UNIDAD_DE_RANKING[rk.clave], escala = 1;
  if (!u) {
    /* dinero: la escala se infiere de una fig de la boleta con la misma métrica para otra entidad del ranking (misma proporción); sin ella, no se juzga */
    const par = rk.r.filas.map((x) => ({ x, f: I.buscarFigs(x.entidad, a.metrica).find((g) => g.unidad === "money" && Number.isFinite(g.raw) && g.raw !== 0) })).find((p) => p.f && +p.x.valor !== 0);
    if (!par) return null;
    escala = par.f.raw / +par.x.valor; u = "money";
  }
  const raw = +fila.valor * escala;
  return { raw, unidad: u, label: `ranking ${ent.eje} · ${rk.clave} · ${ent.nombre}`, texto: u === "money" ? (parseFigures(`$${Math.round(raw)}`)[0] || {}).text || String(raw) : `${fila.valor}${u === "pct" ? "%" : u === "pp" ? " pp" : u === "days" ? "d" : u === "ratio" ? "x" : ""}` };
}
function _cifra(a, I) {
  let v = _valorDeclarado(a);
  const descripcion = a.sujeto && typeof a.sujeto === "object" ? a.sujeto.descripcion : null;
  /* un sujeto descrito («las 5 cuentas materiales») es un agregado: se verifica como grupo por descripción */
  if (descripcion) return _grupo({ ...a, grupo: { entidades: [], n: null }, universo: a.universo || descripcion }, I);
  if (typeof a.sujeto === "string" && a.sujeto !== "negocio" && !I.resolverEntidad(a.sujeto)) return _nv(`entidad-desconocida: «${a.sujeto}» no es una entidad del tenant`);
  /* solo las figs en la UNIDAD de la cifra dicha son candidatas: «Ventas vs año anterior = +7.5%» no juzga «$92,9M» */
  const cands = I.buscarFigs(a.sujeto, a.metrica, { agregados: a.sujeto === "negocio" }).filter((f) => !v || _u(f.unidad) === _u(v.unidad));
  if (!cands.length) {
    /* la proyección del dato (rankings sin escala ambigua) como evidencia cuando la boleta del turno no trae la fig */
    const rk = _delRanking(a, I);
    if (rk && (_u(rk.unidad) === _u(v.unidad) || (v.unidad === "count" && rk.unidad === "days"))) {
      if (v.unidad === "count" && rk.unidad === "days") v = { ...v, unidad: "days", canon: `days:${v.raw}d` };
      if (_mismoValor(v, rk.raw, rk.unidad)) return _ok(`coincide con ${rk.label} = ${rk.texto}`, [rk.label], `${rk.label} = ${rk.texto}`);
      return _falsa(`cifra-distinta: la proyección dice ${rk.label} = ${rk.texto}`, `${rk.label} = ${rk.texto}`, [rk.label]);
    }
    /* ¿la cifra es de OTRA métrica del mismo sujeto, o de OTRA entidad en la misma métrica? Se dice para la multa; el veredicto sigue
     * siendo no-verificable (no hay evidencia de esa afirmación) — y nunca verdadera */
    const ent = a.sujeto !== "negocio" ? I.resolverEntidad(a.sujeto) : null;
    const otras = I.figs.filter((f) => a.sujeto === "negocio" ? !f.entidad : (f.entidad && ent && normalizar(f.entidad) === normalizar(ent.nombre)));
    const coincideOtra = otras.find((f) => _mismoValor(v, f.raw, f.unidad));
    if (coincideOtra) return _nv(`sin-evidencia: la boleta no trae «${a.metrica}» de ${_nom(a.sujeto)}; la cifra coincide con ${_fmt(coincideOtra)}`, [coincideOtra.label], _fmt(coincideOtra));
    const deOtra = I.figs.find((f) => f.entidad && I.casa(a.metrica, f) > 0 && _mismoValor(v, f.raw, f.unidad));
    if (deOtra) return _nv(`sin-evidencia: la boleta no trae «${a.metrica}» de ${_nom(a.sujeto)}; la cifra es de ${_fmt(deOtra)}`, [deOtra.label], _fmt(deOtra));
    const derivada = _derivada(a, I);
    if (derivada) return derivada;
    return _nv(`sin-evidencia: la boleta no trae «${a.metrica}» de ${_nom(a.sujeto)}`);
  }
  /* el universo/período declarados eligen entre las candidatas (Venta vs Venta (flujo); el subtotal de 5 vs el de 6) */
  const enPeriodo = cands.filter((f) => _periodoCasa(a.periodo, f));
  if (!enPeriodo.length) return _nv(`sin-evidencia: la boleta no trae «${a.metrica}» de ${_nom(a.sujeto)} en el período «${a.periodo}»`, cands.slice(0, 2).map((f) => f.label), cands.slice(0, 2).map(_fmt).join(" · "));
  const compatibles = enPeriodo.filter((f) => !f.agregado || !_necesitaUniverso(f, a.sujeto) || _universoCasa(a.universo, f) === "ok");
  const pool = compatibles.length ? compatibles : enPeriodo;
  const exacta = pool.find((f) => _mismoValor(v, f.raw, f.unidad));
  if (exacta) {
    if (exacta.agregado && _necesitaUniverso(exacta, a.sujeto)) {
      const u = _universoCasa(a.universo, exacta);
      if (u === "vacio") return _nv(`universo-no-declarado: la cifra es un agregado (${exacta.label}); la afirmación debe decir de qué conjunto es`, [exacta.label], _fmt(exacta));
      if (u === "promovido") return _falsa(`alcance-promovido: la cifra es de ${exacta.label}, no del total`, _fmt(exacta), [exacta.label]);
      if (u === "distinto") return _falsa(`universo-distinto: la cifra es de ${exacta.label}`, _fmt(exacta), [exacta.label]);
    }
    return _ok(`coincide con ${_fmt(exacta)}`, [exacta.label], _fmt(exacta));
  }
  /* la métrica existe para el sujeto y la cifra no es esa: falsa, con la verdad. Si la cifra es la de OTRA métrica del sujeto, se dice */
  const f0 = pool[0];
  const otra = I.figs.find((f) => f !== f0 && f.entidad === f0.entidad && _mismoValor(v, f.raw, f.unidad));
  const deOtra = I.figs.find((f) => f.entidad && f.entidad !== f0.entidad && I.casa(a.metrica, f) > 0 && _mismoValor(v, f.raw, f.unidad));
  const agregadoCoincide = cands.find((f) => f.agregado && _mismoValor(v, f.raw, f.unidad));
  if (agregadoCoincide) {
    const u = _universoCasa(a.universo, agregadoCoincide);
    if (u === "vacio") return _nv(`universo-no-declarado: la cifra es un agregado (${agregadoCoincide.label}); la afirmación debe decir de qué conjunto es`, [agregadoCoincide.label], _fmt(agregadoCoincide));
    return _falsa(`universo-distinto: la cifra es de ${agregadoCoincide.label}`, _fmt(agregadoCoincide), [agregadoCoincide.label]);
  }
  const derivada = _derivada(a, I);
  if (derivada) return derivada;
  const verdad = pool.slice(0, 2).map(_fmt).join(" · ");
  if (otra) return _falsa(`cifra-de-otra-metrica: ${v.texto} es ${_fmt(otra)}, no su ${a.metrica}`, verdad, [f0.label, otra.label]);
  if (deOtra) return _falsa(`cifra-de-otra-entidad: ${v.texto} es ${_fmt(deOtra)}`, verdad, [f0.label, deOtra.label]);
  return _falsa(`cifra-distinta: la boleta dice ${verdad}`, verdad, pool.slice(0, 2).map((f) => f.label));
}

/* _derivada(a, I) → verdadera si la cifra es una cuenta del catálogo sobre la EVIDENCIA declarada (participación, variación, diferencia, suma
 * de ≤ 4 rótulos); la amnistía nunca sale de un pool ciego: los operandos son los rótulos que la afirmación nombra */
function _derivada(a, I) {
  const v = _valorDeclarado(a);
  if (!v || !a.evidencia.length) return null;
  const figsE = a.evidencia.map((r) => I.figs.find((f) => normalizar(f.label) === normalizar(r))).filter(Boolean);
  if (figsE.length < 2 || figsE.length > 4) return null;
  const raws = figsE.map((f) => f.raw);
  if (raws.some((x) => !Number.isFinite(x))) return null;
  const tol = tolCalculo(v.raw, v.unidad);
  const ev = figsE.map((f) => f.label);
  const tolPct = _tolCalculada(v, "pct");
  if ((v.unidad === "pct") && figsE.length === 2) {
    const [x, y] = raws;
    if (y !== 0 && Math.abs((x / y) * 100 - v.raw) <= tolPct) return _ok(`derivada: ${v.texto} = ${figsE[0].fig.value} / ${figsE[1].fig.value}`, ev, `${figsE[0].fig.value} / ${figsE[1].fig.value} = ${((x / y) * 100).toFixed(1)}%`);
    if (x !== 0 && Math.abs((y / x) * 100 - v.raw) <= tolPct) return _ok(`derivada: ${v.texto} = ${figsE[1].fig.value} / ${figsE[0].fig.value}`, ev, `${figsE[1].fig.value} / ${figsE[0].fig.value} = ${((y / x) * 100).toFixed(1)}%`);
    if (x !== 0 && Math.abs(((y - x) / Math.abs(x)) * 100 - v.raw) <= tolPct) return _ok(`derivada: variación ${v.texto} de ${figsE[0].fig.value} a ${figsE[1].fig.value}`, ev);
  }
  if ((v.unidad === "pp" || v.unidad === "pct") && figsE.length === 2 && figsE.every((f) => f.unidad === "pct" || f.unidad === "pp")) {
    if (Math.abs(Math.abs(raws[0] - raws[1]) - Math.abs(v.raw)) <= tolPct) return _ok(`derivada: ${v.texto} = |${figsE[0].fig.value} − ${figsE[1].fig.value}|`, ev);
  }
  if (v.unidad === "money" || v.unidad === "count") {
    const suma = raws.reduce((s, x) => s + x, 0);
    if (figsE.every((f) => (f.unidad || "count") === v.unidad) && Math.abs(suma - v.raw) <= tol) return _ok(`derivada: ${v.texto} = suma de ${ev.length} rótulos`, ev, `suma = ${suma}`);
    if (figsE.length === 2 && Math.abs(Math.abs(raws[0] - raws[1]) - Math.abs(v.raw)) <= tol) return _ok(`derivada: ${v.texto} = |${figsE[0].fig.value} − ${figsE[1].fig.value}|`, ev);
    if (figsE.length === 2 && figsE[0].unidad === "money" && figsE[1].unidad === "pct" && Math.abs(raws[0] * raws[1] / 100 - v.raw) <= tol) return _ok(`derivada: ${v.texto} = ${figsE[0].fig.value} × ${figsE[1].fig.value}`, ev);
  }
  return null;
}

/* ── GRUPO (cifra agregada de un conjunto entero) ───────────────────────────────────────────────────────────────────────── */
/* los agregados de una métrica: por casación del concepto y, si no, por el vocabulario del muro («Markup promedio · sanos» es el
 * agregado de «Markup sobre costo»; «Contribución de los grandes», de «Contribución») */
function _agregadosDe(metrica, I) {
  let ag = I.buscarFigs("negocio", metrica, { agregados: true }).filter((f) => f.agregado);
  if (ag.length) return ag;
  const km = [...metricasEn(metrica)].filter((k) => k !== "participacion" && k !== "variacion");
  const primera = normalizar(metrica).split(/\s+/)[0];
  return I.figs.filter((f) => f.agregado && !f.entidad && (f.base.split(/\s+/)[0] === primera || (km.length && km.every((k) => f.claves.has(k)))));
}
function _grupo(a, I) {
  const v = _valorDeclarado(a);
  const declaradas = (a.grupo && a.grupo.entidades.length ? a.grupo.entidades : Array.isArray(a.sujeto) ? a.sujeto : []).map((e) => { const r = I.resolverEntidad(e); return r ? r.nombre : e; });
  const n = declaradas.length || (a.grupo && a.grupo.n) || null;
  const descripcion = [a.universo, a.sujeto && typeof a.sujeto === "object" ? a.sujeto.descripcion : ""].filter(Boolean).join(" ");
  const agregados = _agregadosDe(a.metrica, I);
  const setD = new Set(declaradas.map(normalizar));
  const mismoConjunto = (f) => f.entidadesDelGrupo.length ? (f.entidadesDelGrupo.length === setD.size && f.entidadesDelGrupo.every((e) => setD.has(normalizar(e)))) : (n != null && f.n === n);
  /* 1 · el agregado del conjunto declarado */
  const propio = [...agregados].sort((x, y) => _puntajeUniverso(descripcion, y) - _puntajeUniverso(descripcion, x)).find((f) => declaradas.length ? mismoConjunto(f) : _universoCasa(descripcion || (n != null ? `${n} cuentas` : ""), f) === "ok" && (n == null || f.n == null || f.n === n));
  if (propio) {
    if (_mismoValor(v, propio.raw, propio.unidad)) return _ok(`coincide con ${_fmt(propio)} (${propio.n != null ? propio.n + " entidades" : "el conjunto declarado"})`, [propio.label], _fmt(propio));
    return _falsa(`cifra-distinta: ${_fmt(propio)}`, _fmt(propio), [propio.label]);
  }
  /* 2 · la cifra coincide con un agregado de OTRO conjunto: la cifra es del grupo entero, no del declarado (cifra-de-grupo-mal-repartida) */
  const ajeno = agregados.find((f) => _mismoValor(v, f.raw, f.unidad));
  if (ajeno) return _falsa(`grupo-distinto: ${v.texto} es ${_fmt(ajeno)} — el conjunto es de ${ajeno.n != null ? ajeno.n : "otro tamaño"}${ajeno.entidadesDelGrupo.length ? ": " + _lista(ajeno.entidadesDelGrupo) : ""}, no ${declaradas.length ? _lista(declaradas) : descripcion}`, _fmt(ajeno), [ajeno.label]);
  /* 3 · sin agregado: la suma de las figs individuales del conjunto declarado (solo montos y conteos) */
  if (declaradas.length && (v.unidad === "money" || v.unidad === "count")) {
    const figsI = declaradas.map((e) => I.buscarFigs(e, a.metrica).filter((f) => _u(f.unidad) === _u(v.unidad))[0] || null);
    if (figsI.every(Boolean)) {
      const suma = figsI.reduce((s, f) => s + f.raw, 0);
      const ev = figsI.map((f) => f.label);
      if (Math.abs(suma - v.raw) <= tolCalculo(v.raw, v.unidad)) return _ok(`derivada: suma de ${figsI.map(_fmt).join(" + ")}`, ev, `suma = ${suma}`);
      return _falsa(`suma-distinta: ${figsI.map(_fmt).join(" + ")} = ${suma}`, `suma = ${suma}`, ev);
    }
    const faltan = declaradas.filter((e, i) => !figsI[i]);
    return _nv(`sin-evidencia: la boleta no trae «${a.metrica}» de ${_lista(faltan)}`);
  }
  if (declaradas.length) return _nv(`sin-evidencia: no hay un agregado de «${a.metrica}» para ${_lista(declaradas)} en la boleta (una tasa del grupo no se suma)`);
  return _nv(`sin-evidencia: no hay un agregado de «${a.metrica}» para «${descripcion}» en la boleta`);
}

/* ── ORDEN (máximo, mínimo, puesto k, top-k, A antes que B) ─────────────────────────────────────────────────────────────── */
function _ejeDe(a, I) {
  const s = Array.isArray(a.sujeto) ? a.sujeto[0] : a.sujeto;
  const r = typeof s === "string" ? I.resolverEntidad(s) : null;
  if (r && r.eje) return r.eje;
  if (Array.isArray(a.universo)) { const r2 = I.resolverEntidad(a.universo[0]); if (r2) return r2.eje; }
  const u = normalizar(a.universo);
  if (/sku|producto|referencia/.test(u)) return "sku";
  if (/bodega/.test(u)) return "bodega";
  if (/marca/.test(u)) return "marca";
  if (/cliente|cuenta|cartera/.test(u)) return "cliente";
  return r ? r.eje : "cliente";
}
/* _filas(a, I, eje) → {filas:[{entidad, valor}], universo, peorEs, rk} sobre el universo declarado, o {error} */
function _filas(a, I, eje) {
  const rk = I.rankingDe(eje, a.metrica);
  let filas = rk ? rk.r.filas.map((x) => ({ entidad: x.entidad, valor: +x.valor })) : null;
  let universo = rk ? rk.r.universo : "";
  const peorEs = rk ? rk.r.peorEs : null;
  const total = I.tamanoDelEje(eje);
  if (!filas) {
    /* sin ranking en la proyección: las figs individuales de esa métrica, si cubren el eje entero o el subconjunto declarado */
    let fs = I.figsDeMetrica(a.metrica, eje);
    if (/yoy|variaci[oó]n.*(?:dinero|\$)|d[oó]lares nuevos|crecimiento en (?:dinero|\$)/i.test(String(a.metrica))) {
      const vistas = new Set(fs.map((f) => f.entidad));
      for (const f of I.figs) if (f.entidad && !vistas.has(f.entidad) && f.conceptoNorm === "valor" && f.unidad === "money" && /salesread/i.test(String(f.fig.origin && f.fig.origin.tool || "")) && (!eje || !f.eje || f.eje === eje)) fs.push(f);
    }
    if (!fs.length) return { error: `sin-evidencia: no hay ranking ni cifras de «${a.metrica}» por ${eje} en la boleta` };
    const vistos = new Map(); for (const f of fs) if (!vistos.has(f.entidad)) vistos.set(f.entidad, f);
    filas = [...vistos.values()].map((f) => ({ entidad: f.entidad, valor: f.raw }));
    universo = `${filas.length} ${eje}s con «${a.metrica}» en la boleta`;
  }
  const U = _conjuntoDeUniverso(a.universo, I, eje, a.metrica);
  if (U.error) return { error: U.error };
  if (U.set) filas = filas.filter((x) => U.set.has(normalizar(x.entidad)));
  if (!rk && !U.set && total && filas.length < total) return { error: `universo-incompleto: la boleta trae «${a.metrica}» de ${filas.length} de ${total} ${eje}s; el orden sobre el eje entero no se puede verificar` };
  if (U.set && filas.length < U.set.size) return { error: `universo-incompleto: faltan cifras de «${a.metrica}» para ${U.set.size - filas.length} del conjunto declarado (${U.fuente})` };
  return { filas, universo: U.set ? `${U.fuente} (${filas.length})` : universo, peorEs, rk };
}
function _orden(a, I) {
  const eje = _ejeDe(a, I);
  const F = _filas(a, I, eje);
  if (F.error) return _nv(F.error);
  const o = a.orden;
  let dir = o.direccion || "mayor";
  if (dir === "peor" || dir === "mejor") {
    if (!F.peorEs) return _nv(`polaridad-no-declarada: la boleta no dice qué es «${dir}» en «${a.metrica}»`);
    dir = dir === "peor" ? F.peorEs : (F.peorEs === "mayor" ? "menor" : "mayor");
  }
  const filas = [...F.filas].sort((x, y) => dir === "mayor" ? y.valor - x.valor : x.valor - y.valor);
  const puesto = new Map();
  for (let i = 0; i < filas.length; i++) { const prev = i > 0 && filas[i - 1].valor === filas[i].valor ? puesto.get(normalizar(filas[i - 1].entidad)) : i + 1; puesto.set(normalizar(filas[i].entidad), prev); }
  const nombre = (e) => { const r = I.resolverEntidad(e); return r ? r.nombre : e; };
  const fmtFila = (x) => { const f = I.buscarFigs(x.entidad, a.metrica)[0]; return `${x.entidad} (${f ? f.fig.value : x.valor})`; };
  const ev = F.rk ? [`ranking ${eje} · ${F.rk.clave} · ${F.universo}`] : [`cifras de «${a.metrica}» por ${eje}`];
  const cabeza = filas.slice(0, Math.min(3, filas.length)).map(fmtFila).join(" · ");
  const sujetos = (Array.isArray(a.sujeto) ? a.sujeto : [a.sujeto]).map(nombre);
  const faltan = sujetos.filter((s) => !puesto.has(normalizar(s)));
  if (faltan.length) return _nv(`fuera-del-universo: ${_lista(faltan)} no está en «${F.universo}»`, ev);
  const kDe = (s) => puesto.get(normalizar(s));
  if (o.forma === "max" || o.forma === "min") {
    if (sujetos.length > 1) return _topk({ ...a, orden: { ...o, forma: "topk", k: sujetos.length } }, sujetos, filas, puesto, ev, cabeza, fmtFila, dir);
    const k = kDe(sujetos[0]);
    if (k === 1) return _ok(`${sujetos[0]} es el extremo «${dir}» de «${a.metrica}» en ${F.universo}`, ev, cabeza);
    return _falsa(`orden-falso: ${sujetos[0]} va ${k}.º de ${filas.length} en «${a.metrica}» (${dir}); el primero es ${fmtFila(filas[0])}`, cabeza, ev);
  }
  if (o.forma === "puesto") {
    const k = kDe(sujetos[0]);
    if (k === o.k) return _ok(`${sujetos[0]} va ${k}.º en «${a.metrica}» (${dir}) en ${F.universo}`, ev, cabeza);
    const enK = filas.filter((x) => puesto.get(normalizar(x.entidad)) === o.k).map(fmtFila).join(", ");
    return _falsa(`orden-falso: ${sujetos[0]} va ${k}.º de ${filas.length} en «${a.metrica}» (${dir}); el ${o.k}.º es ${enK || "nadie"}`, cabeza, ev);
  }
  if (o.forma === "topk") return _topk(a, sujetos, filas, puesto, ev, cabeza, fmtFila, dir);
  if (o.forma === "comparativo") {
    const b = nombre(o.vs);
    if (!puesto.has(normalizar(b))) return _nv(`fuera-del-universo: ${b} no tiene «${a.metrica}» en ${F.universo}`, ev);
    const fa = filas.find((x) => normalizar(x.entidad) === normalizar(sujetos[0])), fb = filas.find((x) => normalizar(x.entidad) === normalizar(b));
    const cierra = dir === "mayor" ? fa.valor > fb.valor : fa.valor < fb.valor;
    const verdad = `${fmtFila(fa)} vs ${fmtFila(fb)}`;
    if (cierra) return _ok(`${sujetos[0]} está por «${dir}» que ${b} en «${a.metrica}»`, ev, verdad);
    return _falsa(fa.valor === fb.valor ? `orden-falso: ${sujetos[0]} y ${b} empatan en «${a.metrica}»` : `orden-falso: ${sujetos[0]} no está por «${dir}» que ${b} en «${a.metrica}»`, verdad, ev);
  }
  return _nv("forma de orden desconocida");
}
function _topk(a, sujetos, filas, puesto, ev, cabeza, fmtFila, dir) {
  const k = a.orden.k;
  const top = filas.filter((x) => puesto.get(normalizar(x.entidad)) <= k);
  if (sujetos.length === 1) {
    const p = puesto.get(normalizar(sujetos[0]));
    if (p <= k) return _ok(`${sujetos[0]} está entre los ${k} de «${dir}» en «${a.metrica}» (va ${p}.º)`, ev, cabeza);
    return _falsa(`orden-falso: ${sujetos[0]} va ${p}.º, fuera de los ${k} primeros en «${a.metrica}» (${dir}): ${top.map(fmtFila).join(", ")}`, top.map(fmtFila).join(", "), ev);
  }
  const setTop = new Set(top.map((x) => normalizar(x.entidad)));
  const fuera = sujetos.filter((s) => !setTop.has(normalizar(s)));
  const faltanDelTop = top.filter((x) => !sujetos.some((s) => normalizar(s) === normalizar(x.entidad)));
  if (!fuera.length && (sujetos.length >= k || !faltanDelTop.length)) return _ok(`${_lista(sujetos)} son los ${k} de «${dir}» en «${a.metrica}»`, ev, top.map(fmtFila).join(", "));
  if (!fuera.length) return _ok(`${_lista(sujetos)} están entre los ${k} de «${dir}» en «${a.metrica}»`, ev, top.map(fmtFila).join(", "));
  return _falsa(`orden-falso: ${_lista(fuera)} no está entre los ${k} de «${dir}» en «${a.metrica}»; los ${k} son ${top.map(fmtFila).join(", ")}`, top.map(fmtFila).join(", "), ev);
}

/* ── RELACIÓN (k veces, fracción, parte, mayor/menor, igual, diferencia) ────────────────────────────────────────────────── */
const _ES_VARIACION_DINERO = (metrica) => /yoy|variaci[oó]n.*(?:dinero|\$)|d[oó]lares nuevos|crecimiento en (?:dinero|\$)/i.test(String(metrica || ""));
function _valorDe(sujeto, metrica, I, universo = "", unidad = null) {
  if (sujeto && typeof sujeto === "object" && sujeto.descripcion) {
    const ag = _agregadosDe(metrica, I).filter((f) => _universoCasa(sujeto.descripcion, f) === "ok").sort((x, y) => _puntajeUniverso(sujeto.descripcion, y) - _puntajeUniverso(sujeto.descripcion, x));
    return (unidad && ag.find((f) => _u(f.unidad) === _u(unidad))) || ag[0] || null;
  }
  let c = I.buscarFigs(sujeto, metrica, { agregados: sujeto === "negocio" });
  /* la variación de la venta EN DINERO: «YoY» y la fig «Valor» del emisor salesRead (sin rótulo propio — deuda anotada para la fase 2) */
  if (_ES_VARIACION_DINERO(metrica) && sujeto !== "negocio") { const ent = I.resolverEntidad(sujeto); if (ent) c = [...I.figs.filter((f) => f.entidad && normalizar(f.entidad) === normalizar(ent.nombre) && f.unidad === "money" && (f.conceptoNorm === "yoy" || (f.conceptoNorm === "valor" && /salesread/i.test(String(f.fig.origin && f.fig.origin.tool || ""))))), ...c]; }
  if (!c.length) return null;
  if (unidad) { const mismaU = c.filter((f) => _u(f.unidad) === _u(unidad)); if (mismaU.length) c = mismaU; }
  if (universo) { const u = c.find((f) => _universoCasa(universo, f) === "ok"); if (u) return u; }
  if (sujeto === "negocio") {
    /* el todo del negocio: «· total» primero, después un promedio; un «resto de» o un subtotal solo si el universo los nombra */
    const total = c.find((f) => /(?:^|· )total$/.test(f.conceptoNorm)); if (total) return total;
    const sinParte = c.filter((f) => !/resto de|subtotal/.test(f.conceptoNorm)); if (sinParte.length) return sinParte.find((f) => !f.agregado) || sinParte[0];
  }
  return c.find((f) => !f.agregado) || c[0];
}
function _relacion(a, I) {
  const r = a.relacion;
  /* sujetos o comparados en LISTA: la relación es distributiva — vale si vale para cada par; falla con el primer par que falla */
  const A = Array.isArray(a.sujeto) ? a.sujeto : [a.sujeto];
  const B = Array.isArray(r.vs.sujeto) ? r.vs.sujeto : [r.vs.sujeto];
  if (A.length > 1 || B.length > 1) {
    const res = [];
    for (const x of A) for (const y of B) res.push({ x, y, v: _relacion({ ...a, sujeto: x, relacion: { ...r, vs: { ...r.vs, sujeto: y } } }, I) });
    const mala = res.find(({ v }) => v.veredicto === "falsa");
    if (mala) return _falsa(`relacion-falsa (${mala.x} vs ${mala.y}): ${mala.v.motivo}`, mala.v.verdad, mala.v.evidencia);
    const nv = res.find(({ v }) => v.veredicto === "no-verificable");
    if (nv) return _nv(`${nv.v.motivo} (${nv.x} vs ${nv.y})`, nv.v.evidencia, nv.v.verdad);
    return _ok(`cierra para los ${res.length} pares: ${res.map(({ v }) => v.verdad).join(" · ")}`, [...new Set(res.flatMap(({ v }) => v.evidencia))], res.map(({ v }) => v.verdad).join(" · "));
  }
  const fa0 = _valorDe(a.sujeto, a.metrica, I, a.universo);
  const fb = _valorDe(r.vs.sujeto, r.vs.metrica || a.metrica, I, a.universo, fa0 ? fa0.unidad : null);
  const fa = fb ? _valorDe(a.sujeto, a.metrica, I, a.universo, fb.unidad) : fa0;
  if (!fa) return _nv(`sin-evidencia: la boleta no trae «${a.metrica}» de ${_nom(a.sujeto)}`);
  if (!fb) return _nv(`sin-evidencia: la boleta no trae «${r.vs.metrica || a.metrica}» de ${_nom(r.vs.sujeto)}`);
  if (_u(fa.unidad) !== _u(fb.unidad)) return _nv(`unidades-distintas: ${_fmt(fa)} y ${_fmt(fb)} no son comparables`, [fa.label, fb.label]);
  const ev = [fa.label, fb.label];
  const x = fa.raw, y = fb.raw;
  const verdad = `${_fmt(fa)} · ${_fmt(fb)}${y ? ` · cociente ${(x / y).toFixed(2)}×` : ""}`;
  if (r.forma === "mayor" || r.forma === "menor") {
    const cierra = r.forma === "mayor" ? x > y : x < y;
    return cierra ? _ok(`${_nom(a.sujeto)} es ${r.forma} que ${_nom(r.vs.sujeto)} en «${a.metrica}»`, ev, verdad) : _falsa(`relacion-falsa: ${_nom(a.sujeto)} no es ${r.forma} que ${_nom(r.vs.sujeto)} en «${a.metrica}»`, verdad, ev);
  }
  if (r.forma === "parte") {
    /* A es parte de B: A ≤ B, misma unidad, y el universo de los dos rótulos no se cruza (venta comercial vs inventario) */
    if (fa.universo && fb.universo && fa.universo !== fb.universo && !/tasa/.test(fa.universo + fb.universo)) return _falsa(`universos-distintos: ${_fmt(fa)} (${fa.universo}) no es parte de ${_fmt(fb)} (${fb.universo})`, verdad, ev);
    return Math.abs(x) <= Math.abs(y) + tolCalculo(y, fb.unidad) ? _ok(`${_fmt(fa)} es parte de ${_fmt(fb)}`, ev, verdad) : _falsa(`relacion-falsa: ${_fmt(fa)} no cabe en ${_fmt(fb)}`, verdad, ev);
  }
  if (r.forma === "igual") {
    return Math.abs(x - y) <= tolCalculo(x, fa.unidad) ? _ok("iguales dentro de la tolerancia", ev, verdad) : _falsa("relacion-falsa: no son iguales", verdad, ev);
  }
  if (r.forma === "diferencia") {
    const v = (r.valor && Number.isFinite(r.valor.raw)) ? r.valor : a.valor;
    const d = x - y;
    const u = fa.unidad === "pct" ? "pp" : fa.unidad;
    const tol = _tolCalculada(v, u);
    return Math.abs(Math.abs(d) - Math.abs(v.raw)) <= tol ? _ok(`diferencia ${v.texto} entre ${_fmt(fa)} y ${_fmt(fb)}`, ev, verdad) : _falsa(`relacion-falsa: la diferencia es ${u === "money" ? "$" : ""}${Math.round(d * 100) / 100}${u === "pp" ? " pp" : ""}`, verdad, ev);
  }
  /* veces / fracción: q = A/B contra k con el rango del matiz (la misma tabla del juez de la prosa) */
  if (y === 0) return _nv(`sin-evidencia: ${_fmt(fb)} es cero`, ev);
  let k = r.k;
  if (!Number.isFinite(k) && a.valor && Number.isFinite(a.valor.raw) && a.valor.unidad !== "money" && a.valor.unidad !== "days") k = a.valor.unidad === "pct" ? a.valor.raw / 100 : a.valor.raw;
  const q = x / y;
  /* «$33K sobre $135K», «$9.8M pendientes, de eso $4.6M vencidos»: una fracción sin cociente dicho es una relación de PARTE (A ≤ B) */
  if (r.forma === "fraccion" && !Number.isFinite(k)) return _relacion({ ...a, relacion: { ...r, forma: "parte" } }, I);
  /* una fracción dicha en % se juzga como cifra calculada («36 %»): la tolerancia del muro y media unidad de su precisión */
  if (r.forma === "fraccion" && a.valor && a.valor.unidad === "pct" && !r.matiz) {
    const tol = _tolCalculada(a.valor, "pct");
    return Math.abs(q * 100 - a.valor.raw) <= tol ? _ok(`${a.valor.texto} = ${_fmt(fa)} / ${_fmt(fb)}`, ev, verdad) : _falsa(`relacion-falsa: ${_fmt(fa)} es el ${(q * 100).toFixed(1)}% de ${_fmt(fb)}`, verdad, ev);
  }
  if (!Number.isFinite(k) || k === 0) return _nv("relacion sin cociente declarado", ev, verdad);
  const rango = rangoDeMatiz(r.matiz);
  const cierra = q / k >= rango.lo && q / k <= rango.hi;
  if (cierra) return _ok(`${k}× (${r.matiz ? r.matiz + " " : ""}${r.forma}) cierra: cociente ${q.toFixed(2)}`, ev, verdad);
  return _falsa(`relacion-falsa: ${_nom(a.sujeto)} es ${q.toFixed(2)}× ${_nom(r.vs.sujeto)} en «${a.metrica}», no ${r.matiz ? r.matiz + " " : ""}${k}×`, verdad, ev);
}

/* ── CONTEO (n de m que cumplen un predicado) ───────────────────────────────────────────────────────────────────────────── */
/* _candidatosDeConteo(pred, I, eje) → [{n, m, fuente, label, set?}] · todo lo que la evidencia CUENTA bajo ese predicado: figs de conteo, los
 * conteos escritos en el rótulo de los agregados («5 cuentas materiales (de 8 bajo el benchmark)» → 5 materiales de 8; «6 cuentas sobre el
 * nivel declarado (5 de ellas bajo el benchmark)» → 6, y 5 de esas 6), el grupo de un agregado, los estados del inventario, los umbrales
 * conocidos sobre los rankings, un top-k («los 5 SKU que más venden») y la CONJUNCIÓN de dos conjuntos («bajo el benchmark y sobre el
 * nivel de carga») — con el conjunto de entidades cuando se conoce, para contar dentro de un universo */
function _candidatosDeConteo(pred, I, eje = "cliente") {
  const tp = tokens(pred);
  if (!tp.length) return [];
  /* el predicado casa con un rótulo cuando las palabras de UNO de los dos caben en el otro («materiales» ⊂ «cuentas materiales que concentran la brecha») */
const predN = normalizar(pred);
  const casaPred = (texto) => {
    const tt = tokens(texto); if (!tt.length) return false;
    const igual = (t, w) => t === w || (Math.min(t.length, w.length) >= 6 && (t.startsWith(w) || w.startsWith(t)));   // «sobre» no es «sobrestock»; «frenado» sí es «frenados»
    const cabe = (x, y) => x.every((t) => y.some((w) => igual(t, w)));
    if (cabe(tp, tt)) return true;
    const frase = new RegExp("\\b" + tt.map((t) => t.slice(0, 5).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[a-z]*(?:\\s+\\S+){0,2}\\s+\\b") + "[a-z]*", "i");
    return frase.test(predN);
  };
  const out = [];
  for (const f of I.figs) if ((f.unidad === "count" || f.fig.unit === "count") && Number.isFinite(f.raw) && !f.agregado && casaPred(f.conceptoNorm + " " + (f.entidad || ""))) out.push({ n: f.raw, m: null, fuente: "conteo de la boleta", label: f.label });
  for (const f of I.figs) {
    if (!f.agregado) continue;
    const seg = String(f.concepto).split(/\s+·\s+/).find((s) => /^\d+\s+(?:cuentas?|clientes?|skus?|bodegas?|marcas?)\b/i.test(s));
    if (seg) {
      const m = /^(\d+)\s+(?:cuentas?|clientes?|skus?|bodegas?|marcas?)\s+([^()]+?)\s*(?:\(([^)]*)\))?\s*$/i.exec(seg);
      if (m) {
        let mDe = null;
        const par = m[3] ? m[3].trim() : "";
        const deN = /^de\s+(\d+)\s+(.+)$/i.exec(par);
        const deEllas = /^(\d+)\s+de\s+(?:ellas|ellos|esas|esos)\s+(.+)$/i.exec(par);
        if (deN) { mDe = +deN[1]; if (casaPred(deN[2])) out.push({ n: +deN[1], m: null, fuente: "rótulo del agregado", label: f.label }); }
        if (casaPred(m[2])) out.push({ n: +m[1], m: mDe, fuente: "rótulo del agregado", label: f.label, set: f.entidadesDelGrupo.length ? new Set(f.entidadesDelGrupo.map(normalizar)) : null });
        if (deEllas && casaPred(deEllas[2])) {
          const cc = _conjuntosConocidos(I).find((c) => c.re && c.re.test(deEllas[2]));
          const set = cc && f.entidadesDelGrupo.length ? new Set(f.entidadesDelGrupo.map(normalizar).filter((e) => cc.set.has(e))) : null;
          out.push({ n: +deEllas[1], m: +m[1], fuente: "rótulo del agregado (de ellas)", label: f.label, set: set && set.size === +deEllas[1] ? set : null });
        }
      }
    }
    if (f.grupo && f.entidadesDelGrupo.length && casaPred(f.calificador.replace(/\(.*?\)/g, ""))) out.push({ n: f.entidadesDelGrupo.length, m: null, fuente: "grupo del agregado", label: f.label, set: new Set(f.entidadesDelGrupo.map(normalizar)) });
  }
  const conocidos = _conjuntosConocidos(I).filter((c) => c.re);
  const total = I.tamanoDelEje("cliente") || null;
  const partes = String(pred).split(/\s+(?:y|e)\s+|\s*\+\s*/i).map((x) => x.trim()).filter(Boolean);
  const sets = partes.map((p) => conocidos.find((c) => c.re.test(p)) || (() => { const t = _topKDe(p, I, eje); return t ? { ...t, nombre: t.fuente } : null; })()).filter(Boolean);
  if (partes.length > 1 && sets.length === partes.length) {
    let set = new Set(sets[0].set); for (const c of sets.slice(1)) set = new Set([...set].filter((e) => c.set.has(e)));
    out.push({ n: set.size, m: total, fuente: sets.map((c) => c.fuente).join(" ∩ "), label: sets.map((c) => c.nombre).join(" ∩ "), set });
  } else {
    for (const c of conocidos) if (c.re.test(pred)) out.push({ n: c.set.size, m: c.fuente.startsWith("estados") ? null : total, fuente: c.fuente, label: c.nombre, set: c.set });
    const t = _topKDe(pred, I, eje);
    if (t) out.push({ n: t.set.size, m: total, fuente: t.fuente, label: t.fuente, set: t.set });
  }
  return out;
}
function _conteo(a, I) {
  const c = a.conteo;
  const pred = c.predicado || a.metrica;
  const uTexto = Array.isArray(a.universo) ? "" : String(a.universo || "");
  const ejeU = /sku|producto/.test(normalizar(uTexto + " " + pred)) ? "sku" : /bodega/.test(normalizar(uTexto + " " + pred)) ? "bodega" : /marca/.test(normalizar(uTexto + " " + pred)) ? "marca" : "cliente";
  let cn = _candidatosDeConteo(pred, I, ejeU);
  if (!cn.length) return _nv(`sin-evidencia: la boleta no cuenta «${pred}»`);
  const fmtC = (x) => `${x.n}${x.m != null ? " de " + x.m : ""} (${x.fuente}: ${x.label})`;
  const total = I.tamanoDelEje(ejeU);
  /* el universo declarado: si es un SUBCONJUNTO identificable, se cuenta dentro de él (solo con candidatos que traen su conjunto) */
  const U = _conjuntoDeUniverso(a.universo, I, ejeU, pred);
  if (U.set) {
    const conSet = cn.filter((x) => x.set);
    if (!conSet.length) return _nv(`universo-no-contable: la boleta cuenta «${pred}» (${fmtC(cn[0])}) pero no identifica quiénes, y el universo es «${uTexto}»`, [cn[0].label]);
    cn = conSet.map((x) => ({ ...x, n: [...x.set].filter((e) => U.set.has(e)).length, m: U.set.size, fuente: `${x.fuente} dentro de ${U.fuente}` }));
  }
  const exacto = cn.find((x) => x.n === c.n);
  if (!exacto) return _falsa(`conteo-falso: son ${fmtC(cn[0])}, no ${c.n}`, fmtC(cn[0]), [cn[0].label]);
  if (Array.isArray(a.sujeto) && a.sujeto.length) {
    const nombrados = a.sujeto.map((e) => { const r = I.resolverEntidad(e); return normalizar(r ? r.nombre : e); });
    const conSets = cn.filter((x) => x.set);
    if (conSets.length) {
      const solape = (x) => nombrados.filter((e) => x.set.has(e)).length;
      const mejor = [...conSets].sort((x, y) => solape(y) - solape(x) || (x.n === c.n ? -1 : 1) - (y.n === c.n ? -1 : 1))[0];
      const fuera = nombrados.filter((e) => !mejor.set.has(e));
      const faltan = [...mejor.set].filter((e) => !nombrados.includes(e));
      const sinNombrar = Math.max(0, c.n - nombrados.length);
      if (fuera.length || mejor.n !== c.n || faltan.length !== sinNombrar) return _falsa(`enumeracion-falsa: ${fuera.length ? fuera.join(", ") + " no cumple" : ""}${fuera.length && faltan.length ? "; " : ""}${faltan.length ? "falta " + faltan.join(", ") : ""}${mejor.n !== c.n ? `; son ${mejor.n}, no ${c.n}` : ""} (${mejor.fuente}: ${mejor.label})`, [...mejor.set].join(", "), [mejor.label]);
      return _ok(`${c.n} según ${mejor.fuente} (${mejor.label}); los nombrados cumplen`, [mejor.label], [...mejor.set].join(", "));
    }
  }
  const mDecl = c.m != null ? c.m : (numerosEn(uTexto).find(Number.isInteger) ?? null);
  if (mDecl != null && !U.set) {
    if (exacto.m != null) {
      if (exacto.m !== mDecl && !(mDecl === total && /^rótulo/.test(exacto.fuente))) {
        /* la verdad para la multa: el conteo del mismo predicado sobre el universo dicho, si la evidencia lo trae («son 8 de 13, no 5 de 13») */
        const alt = cn.find((x) => x.m === mDecl) || cn.find((x) => x.m == null && x !== exacto);
        return _falsa(`universo-falso: ${alt ? "son " + fmtC(alt) + "; " : ""}${fmtC(exacto)} es de ${exacto.m}, no de ${mDecl}`, fmtC(alt || exacto), [exacto.label, ...(alt ? [alt.label] : [])]);
      }
    } else if (mDecl !== total) {
      const predU = uTexto.replace(/\d+/g, " ");
      const cm = tokens(predU).length ? _candidatosDeConteo(predU, I, ejeU) : [];
      if (!cm.some((x) => x.n === mDecl)) {
        if (cm.length) return _falsa(`universo-falso: «${uTexto}» son ${fmtC(cm[0])}, no ${mDecl}`, fmtC(cm[0]), [exacto.label, cm[0].label]);
        return _nv(`universo-no-verificable: la boleta cuenta ${fmtC(exacto)} pero no dice «de ${mDecl}»`, [exacto.label], fmtC(exacto));
      }
    }
  }
  if (mDecl != null && U.set && exacto.m !== mDecl) return _falsa(`universo-falso: ${fmtC(exacto)}, no de ${mDecl}`, fmtC(exacto), [exacto.label]);
  return _ok(`${c.n} según ${exacto.fuente} (${exacto.label})`, [exacto.label], fmtC(exacto));
}

/* ── VARIACIÓN (sube / baja respecto de un período) ─────────────────────────────────────────────────────────────────────── */
function _variacion(a, I) {
  const v = a.variacion;
  const p = normalizar(a.periodo);
  if (/\bmes\b|trimestre|semana|semestre|mensual|trimestral/.test(p)) return _nv(`sin-evidencia: la boleta no trae la serie «${a.periodo}» de «${a.metrica}»`);
  if (Array.isArray(a.sujeto)) {
    const res = a.sujeto.map((s) => ({ s, v: _variacion({ ...a, sujeto: s }, I) }));
    const mala = res.find(({ v: x }) => x.veredicto === "falsa"); if (mala) return _falsa(`(${mala.s}) ${mala.v.motivo}`, mala.v.verdad, mala.v.evidencia);
    const nv = res.find(({ v: x }) => x.veredicto === "no-verificable"); if (nv) return _nv(`(${nv.s}) ${nv.v.motivo}`, nv.v.evidencia);
    return _ok(res.map(({ v: x }) => x.motivo).join(" · "), res.flatMap(({ v: x }) => x.evidencia), res.map(({ v: x }) => x.verdad).join(" · "));
  }
  const met = normalizar(a.metrica);
  const esVenta = /venta|factur|ingreso/.test(met) || conceptosDe(a.metrica).includes("venta");
  let cands = I.buscarFigs(a.sujeto, "variacion", { agregados: a.sujeto === "negocio" }).filter((f) => /variacion|crecimiento|yoy|vs ano anterior/.test(f.conceptoNorm));
  if (esVenta) {
    /* la variación de la venta EN DINERO: «YoY = +$2.3M» y, del mismo emisor (salesRead), la fig «Valor» que acompaña a la variación en % —
     * un rótulo sin significado propio (deuda del emisor, anotada para la fase 2): solo cuenta cuando el sujeto tiene su variación en % */
    const ent = a.sujeto !== "negocio" ? I.resolverEntidad(a.sujeto) : null;
    if (ent && cands.length) for (const f of I.figs) if (f.entidad && normalizar(f.entidad) === normalizar(ent.nombre) && (f.conceptoNorm === "yoy" || (f.conceptoNorm === "valor" && /salesread/i.test(String(f.fig.origin && f.fig.origin.tool || "")))) && f.unidad === "money" && !cands.includes(f)) cands.push(f);
  } else {
    /* solo una variación que NOMBRE la métrica («Variación de margen», «Margen vs año anterior»); la de la venta no absuelve otra métrica */
    cands = I.buscarFigs(a.sujeto, a.metrica, { agregados: a.sujeto === "negocio" }).filter((f) => /variacion|crecimiento|yoy|vs ano anterior|anterior/.test(f.conceptoNorm + " " + f.context));
    if (!cands.length) return _nv(`sin-evidencia-temporal: la boleta no trae la variación ni la serie de «${a.metrica}» de ${_nom(a.sujeto)} — sin evidencia temporal no hay «${v.direccion}»`);
  }
  if (!cands.length) return _nv(`sin-evidencia-temporal: la boleta no trae la variación de «${a.metrica}» de ${_nom(a.sujeto)}`);
  const val = v.valor && Number.isFinite(v.valor.raw) ? v.valor : null;
  /* con magnitud dicha, la fig de la misma unidad (% vs $); sin magnitud, la primera con signo */
  const f = (val ? cands.find((x) => _u(x.unidad) === _u(val.unidad)) : null) || cands[0];
  const ev = [f.label];
  const dirReal = Math.abs(f.raw) < 0.05 ? "estable" : f.raw > 0 ? "sube" : "baja";
  if (dirReal !== v.direccion) return _falsa(`direccion-falsa: ${_fmt(f)} (${dirReal}), no «${v.direccion}»`, _fmt(f), ev);
  if (val) {
    if (_u(val.unidad) !== _u(f.unidad)) return _nv(`sin-evidencia: la boleta trae la variación de «${a.metrica}» de ${_nom(a.sujeto)} en ${f.unidad}, no en ${val.unidad}`, ev, _fmt(f));
    const magnitud = { ...val, raw: Math.abs(val.raw) };
    if (!_mismoValor(magnitud, Math.abs(f.raw), f.unidad)) return _falsa(`magnitud-distinta: ${_fmt(f)}`, _fmt(f), ev);
  }
  return _ok(`${v.direccion}: ${_fmt(f)}`, ev, _fmt(f));
}

/* ── ESTADO (inventario) ────────────────────────────────────────────────────────────────────────────────────────────────── */
const _ESTADOS_CONOCIDOS = new Set(["inmovilizado", "frenado", "sobrestock", "riesgo de quiebre", "capital sano"]);
function _estado(a, I) {
  const e = a.estado;
  if (Array.isArray(a.sujeto)) {
    const res = a.sujeto.map((s) => ({ s, v: _estado({ ...a, sujeto: s }, I) }));
    const mala = res.find(({ v }) => v.veredicto === "falsa"); if (mala) return _falsa(`(${mala.s}) ${mala.v.motivo}`, mala.v.verdad, mala.v.evidencia);
    const nv = res.find(({ v }) => v.veredicto === "no-verificable"); if (nv) return _nv(`(${nv.s}) ${nv.v.motivo}`, nv.v.evidencia);
    return _ok(res.map(({ v }) => v.motivo).join(" · "), ["estados del inventario"], res.map(({ v }) => v.verdad).join(" · "));
  }
  const ent = I.resolverEntidad(a.sujeto);
  if (!ent) return _nv(`entidad-desconocida: «${a.sujeto}»`);
  const propios = I.estadosDe(ent.nombre);
  const quiere = estadoCanon(e.estado);
  const verdad = propios.length ? propios.map((x) => `${x.estado}${x.bodega ? " (" + x.bodega + ")" : ""}`).join(" · ") : "sin estado declarado";
  const ev = ["estados del inventario"];
  /* «sin vencido» / «sin mora» es un estado de la cobranza: saldo vencido cero en el ranking de la proyección */
  if (/^sin (?:saldo )?vencido|^sin mora|^por vencer|^al dia$/.test(quiere)) {
    const rk = I.rankings.cliente && I.rankings.cliente.saldo_vencido;
    const fila = rk ? rk.filas.find((x) => normalizar(x.entidad) === normalizar(ent.nombre)) : null;
    if (!fila) return _nv(`sin-evidencia: la proyección no trae el saldo vencido de ${ent.nombre}`, ["ranking saldo_vencido"]);
    return +fila.valor === 0 ? _ok(`${ent.nombre}: saldo vencido 0`, ["ranking saldo_vencido"], "saldo vencido 0") : _falsa(`estado-falso: ${ent.nombre} sí tiene saldo vencido (${fila.valor})`, `saldo vencido ${fila.valor}`, ["ranking saldo_vencido"]);
  }
  /* «sin venta (reciente)» es un estado que la proyección declara en días: hay días sin venta > 0 */
  if (/^sin venta/.test(quiere)) { const d = I.dias[ent.nombre]; if (d && Number.isFinite(d.sinVenta)) return d.sinVenta > 0 ? _ok(`${ent.nombre}: ${d.sinVenta} días sin venta`, ["días de la proyección"], `${d.sinVenta}d sin venta`) : _falsa(`estado-falso: ${ent.nombre} no acumula días sin venta`, "0 días sin venta", ["días de la proyección"]); return _nv(`sin-evidencia: la proyección no trae días sin venta de ${ent.nombre}`, ev, verdad); }
  /* «crítico», «urgente», «delicado» no son estados de la evidencia: no se verifican (ni se sirven como verdaderos) */
  if (!_ESTADOS_CONOCIDOS.has(quiere)) return _nv(`estado-desconocido: «${e.estado}» no es un estado que la evidencia declare (inmovilizado · frenado · sobrestock · riesgo de quiebre · capital sano)`, ev, verdad);
  const tiene = propios.map((x) => estadoCanon(x.estado));
  if (!propios.length) {
    if (quiere === "capital sano" && I.dias[ent.nombre]) return _ok(`${ent.nombre} no tiene estado de alerta declarado`, ev, verdad);
    return _nv(`sin-evidencia: la proyección no declara estado para ${ent.nombre}`, ev, verdad);
  }
  if (!tiene.includes(quiere)) return _falsa(`estado-falso: ${ent.nombre} está «${verdad}», no «${e.estado}»`, verdad, ev);
  if (e.bodega) { const b = propios.find((x) => estadoCanon(x.estado) === quiere); if (b && b.bodega && normalizar(b.bodega) !== normalizar(e.bodega)) return _falsa(`bodega-falsa: ${ent.nombre} está ${quiere} en ${b.bodega}, no en ${e.bodega}`, verdad, ev); }
  return _ok(`${ent.nombre}: ${verdad}`, ev, verdad);
}

/* ── LECTURA (opinión sellada, que no puede encubrir un hecho) ──────────────────────────────────────────────────────────── */
const _FACTUALES = new Set(["cifra", "orden", "relacion", "grupo", "conteo", "variacion", "estado"]);
function _lectura(a, I, todas = []) {
  const hecho = encubreHecho(a.texto);
  if (hecho) {
    /* el hecho que la lectura roza ya está declarado por otra afirmación de hecho que se solapa con ella: la lectura es la síntesis, no el escondite */
    const t = normalizar(a.texto);
    const declarado = todas.some(({ afirmacion: b }) => b !== a && _FACTUALES.has(b.tipo) && b.texto && (() => { const u = normalizar(b.texto); return t.includes(u) || u.includes(t) || (u.length > 25 && t.includes(u.slice(0, 25))) || (t.length > 25 && u.includes(t.slice(0, 25))); })());
    if (!declarado) return _nv(`lectura-encubre-hecho: «${a.texto.slice(0, 80)}» afirma ${hecho}; declárala como cifra, orden, relación, conteo o variación`, [], "");
  }
  return { veredicto: "sellada", motivo: `lectura con sello «${a.sello}»`, verdad: "", evidencia: [] };
}
