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
import { normalizarAfirmaciones, normalizar, menosAscii } from "./afirmacion.js";
import { resolverDeclaraciones } from "./resolutor.js";   // fase 4: la casa canoniza la forma de la declaración antes del veredicto
import { indiceDeEvidencia, tokens, numerosEn, ES_TODO, estadoCanon, conceptosDe, mismoValor as _mismoValor, unidadCompatible as _u, necesitaUniverso as _necesitaUniverso } from "./evidencia.js";

export const VEREDICTOS = ["verdadera", "falsa", "no-verificable", "sellada"];

const _fmt = (f) => `${f.label} = ${f.fig.value}`;
const _lista = (l) => (l || []).join(", ");
const _decimales = (texto) => { const m = /\d+[.,](\d+)\s*(?:%|pp|x|d\b)/i.exec(String(texto || "")); return m ? m[1].length : (/\d+\s*(?:%|pp|x|d\b)/i.test(String(texto || "")) ? 0 : null); };
const _nom = (s) => (s === "negocio" ? "el negocio" : Array.isArray(s) ? s.join(", ") : s && typeof s === "object" ? s.descripcion : String(s));

/* _mismoValor y _u viven en evidencia.js (`mismoValor`, `unidadCompatible`): una sola tolerancia para el verificador y el resolutor */
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
  const indice0 = ctx.indice || indiceDeEvidencia({ figs: ctx.figs || (ctx.ledger && ctx.ledger.figs) || [], datoProyectado: ctx.datoProyectado || null, ejesDelTenant: ctx.ejesDelTenant || null });
  /* los cálculos que el muro recomputó y autorizó en este mismo texto ([[CALCULO]]) viajan con el índice: son evidencia de una cifra declarada */
  const indice1 = Array.isArray(ctx.calculos) && ctx.calculos.length ? { ...indice0, calculos: ctx.calculos } : indice0;
  /* los conjuntos que la evidencia identifica, para el resolutor (la misma lista con la que se resuelve un universo) */
  const indice = { ...indice1, conjuntosConocidos: () => _conjuntosConocidos(indice1) };
  /* LA CASA CANONIZA LA FORMA (fase 4): cada afirmación se traduce a su forma canónica antes del veredicto — sujeto-concepto → negocio +
   * métrica, universo dentro de la métrica, grupo con lista de valores → cifras, unidad implícita, dirección leída del fragmento. Nunca
   * cambia una cifra ni el estándar de verdad (ver resolutor.js). `ctx.resueltas` evita resolver dos veces. */
  const resueltas = ctx.resueltas ? afirmaciones : resolverDeclaraciones(afirmaciones, indice);
  const todas = normalizarAfirmaciones(resueltas);
  const veredictos = todas.map(({ afirmacion: a, faltas }, k) => {
    const src = resueltas[k] || {};
    const base = { id: a.id, tipo: a.tipo, texto: a.texto, faltas, ...(Array.isArray(src._resuelta) && src._resuelta.length ? { resuelta: src._resuelta } : {}) };
    if (faltas.length) return { ...base, veredicto: "no-verificable", motivo: `declaracion-incompleta: falta ${faltas.join("; ")}`, verdad: "", evidencia: [] };
    try {
      return { ...base, ..._verificar(a, indice, todas) };
    } catch (e) {
      return { ...base, veredicto: "no-verificable", motivo: `error-del-verificador: ${e && e.message ? e.message : e}`, verdad: "", evidencia: [] };
    }
  });
  const resumen = { total: veredictos.length, verdaderas: 0, falsas: 0, noVerificables: 0, selladas: 0 };
  for (const v of veredictos) { if (v.veredicto === "verdadera") resumen.verdaderas++; else if (v.veredicto === "falsa") resumen.falsas++; else if (v.veredicto === "sellada") resumen.selladas++; else resumen.noVerificables++; }
  return { veredictos, resumen, afirmaciones: resueltas };
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
/* la BASE del año anterior («Ventas del año anterior»): un nivel del período anterior, no una variación contra él («Variación vs año anterior en $», «YoY») */
const _esBaseAnterior = (f) => /(?:^|\s)(?:del\s+)?ano\s+(?:anterior|pasado)$/.test(f.conceptoNorm) && !/variacion|crecimiento|yoy|\bvs\b/.test(f.conceptoNorm);
const _periodoCasa = (declarado, f, metrica = "") => {
  const p = normalizar(declarado);
  /* sin período declarado, la BASE del año anterior solo casa si la métrica declarada lo dice: «Venta $92.9M» no es verdad */
  if (!p) return !_esBaseAnterior(f) || /anterior|pasado|previo/.test(normalizar(metrica));
  const fp = normalizar(f.periodo + " " + f.concepto + " " + f.context);
  /* solo dos períodos que la boleta distingue: el ANTERIOR («año anterior», «año pasado») y los cortes menores que el año («mes», «trimestre»);
   * «año cerrado», «anual», «foto de hoy», «al corte (31 ago 2026)», «al 31 de agosto» son el marco de la boleta */
  if (/anterior|pasado|previo/.test(p)) return /anterior|pasado|previo/.test(fp);   // «Ventas del año anterior» lo dice en el rótulo
  if (/\bmes\b|trimestre|semana|semestre|mensual/.test(p)) return /\bmes\b|trimestre|semana|semestre|mensual/.test(fp);
  return !/anterior|pasado|previo/.test(normalizar(f.concepto));
};
/* _necesitaUniverso vive en evidencia.js (`necesitaUniverso`): la comparten el verificador y el resolutor */
/* _puntajeUniverso(declarado, f) → cuántas palabras del universo/descripción declarado están en el CALIFICADOR del agregado (no en su contexto):
 * «los que caen» elige «Markup promedio · los que caen» y no «· sanos» aunque el contexto de este nombre el benchmark */
const _puntajeUniverso = (declarado, f) => { const tu = tokens(Array.isArray(declarado) ? declarado.join(" ") : String(declarado || "")); const tf = tokens(f.calificador + " " + f.conceptoNorm); return tu.filter((t) => tf.some((x) => x.startsWith(t.slice(0, 5)))).length; };

/* ── LOS CONJUNTOS QUE LA EVIDENCIA IDENTIFICA (para universos de orden y conteo) ─────────────────────────────────────────── */
const _CLAVE_A_RANKING = { ventas: "ventas", contribucion: "contribucion", margen: "margen", carga: "carga", brecha: "brecha", unidades: "unidades", vencido: "saldo_vencido", pendiente: "saldo_pendiente", recuperado: "recuperado", diasvencido: "dias_vencido", capital: "capital", frenado: "capital_frenado", rotacion: "rotacion", cobertura: "dias_inventario", sinventa: "dias_sin_venta" };
/** conjuntosConocidos(I) → los conjuntos que la evidencia identifica (para la carta de hechos del turno: nombre, tamaño, eje, fuente) */
export function conjuntosConocidos(I) { return _conjuntosConocidos(I); }
/* _conjuntosConocidos(I) → [{nombre, set, fuente, re}] · los estados, los umbrales de los rankings (bajo/sobre el benchmark de margen, con saldo
 * vencido, sobre el nivel de carga declarado), los que caen/crecen vs año anterior, y los grupos de los agregados (con sus palabras) */
function _conjuntosConocidos(I) {
  const out = [];
  const porEstado = new Map();
  for (const x of I.estados) { const e = estadoCanon(x.estado); if (!porEstado.has(e)) porEstado.set(e, new Set()); porEstado.get(e).add(normalizar(x.entidad)); }
  for (const [e, set] of porEstado) out.push({ nombre: e, eje: "sku", set, fuente: `estados «${e}»`, re: new RegExp(e === "inmovilizado" ? "\\b(?:inmoviliz|deten|parad)" : e === "frenado" ? "\\bfrenad" : e === "sobrestock" ? "\\bsobrestock" : e === "riesgo de quiebre" ? "\\bquiebre" : e === "critico" ? "\\bcr[ií]tic" : "\\bsan[oa]s?\\b", "i") });
  /* «con capital frenado» por eje, desde las figs «<entidad> · Capital frenado» de la boleta: las bodegas no tienen estado en la proyección
   * (los estados son de SKU); para SKU manda el estado de la proyección si lo hay */
  const frenadoPorEje = new Map();
  for (const f of I.figs) if (f.entidad && f.eje && /^capital frenado$/.test(f.conceptoNorm) && Number.isFinite(f.raw) && f.raw > 0) { if (!frenadoPorEje.has(f.eje)) frenadoPorEje.set(f.eje, new Set()); frenadoPorEje.get(f.eje).add(normalizar(f.entidad)); }
  for (const [eje, set] of frenadoPorEje) if (eje !== "sku" || !porEstado.has("frenado")) out.push({ nombre: "con capital frenado", eje, set, fuente: "«Capital frenado» por " + eje + " en la boleta", re: /\bfrenad/i });
  const R = I.rankings.cliente || {};
  const bench = I.figs.find((f) => /^benchmark de margen$/.test(f.conceptoNorm) && !f.entidad);
  if (R.margen && bench) {
    /* el benchmark es el de MARGEN («bajo el benchmark», «bajo la referencia de margen»); «el nivel de referencia» de la carga es otro umbral */
    out.push({ nombre: "bajo el benchmark", eje: "cliente", set: new Set(R.margen.filas.filter((x) => +x.valor < bench.raw).map((x) => normalizar(x.entidad))), fuente: "margen < benchmark", re: /(?:bajo|debajo|menor|no llega|lejos)[^.]{0,25}(?:benchmark|referencia\s+de\s+margen|piso\s+de\s+margen)|(?:benchmark|referencia\s+de\s+margen)[^.]{0,15}(?:bajo|debajo)/i });
    out.push({ nombre: "sobre el benchmark", eje: "cliente", set: new Set(R.margen.filas.filter((x) => +x.valor >= bench.raw).map((x) => normalizar(x.entidad))), fuente: "margen ≥ benchmark", re: /(?:sobre|encima|supera|mayor)[^.]{0,25}(?:benchmark|referencia\s+de\s+margen|piso\s+de\s+margen)|\bsan[oa]s?\b/i });
  }
  /* la simulación de carga publica «Margen supuesto» por cuenta: «con margen supuesto sobre/bajo el benchmark» se cuenta sobre esas figs */
  const sup = new Map(); for (const f of I.figs) if (f.entidad && /^margen supuesto/.test(f.conceptoNorm) && Number.isFinite(f.raw) && !sup.has(f.entidad)) sup.set(f.entidad, f.raw);
  if (sup.size && bench) {
    out.push({ nombre: "margen supuesto sobre el benchmark", eje: "cliente", set: new Set([...sup].filter(([, v]) => v >= bench.raw).map(([e]) => normalizar(e))), fuente: "margen supuesto ≥ benchmark", re: /supuest[^.]{0,40}(?:sobre|encima|supera|mayor|llega)[^.]{0,25}benchmark|(?:sobre|encima|supera|mayor)[^.]{0,25}benchmark[^.]{0,30}supuest/i });
    out.push({ nombre: "margen supuesto bajo el benchmark", eje: "cliente", set: new Set([...sup].filter(([, v]) => v < bench.raw).map(([e]) => normalizar(e))), fuente: "margen supuesto < benchmark", re: /supuest[^.]{0,40}(?:bajo|debajo|menor|no llega)[^.]{0,25}benchmark|(?:bajo|debajo|menor)[^.]{0,25}benchmark[^.]{0,30}supuest/i });
  }
  /* por SKU: el margen de cada SKU de la boleta contra el benchmark */
  const mSku = new Map(); for (const f of I.figs) if (f.entidad && f.eje === "sku" && /^margen(?:\s+de\s+venta)?$/.test(f.conceptoNorm) && f.unidad === "pct" && Number.isFinite(f.raw) && !mSku.has(f.entidad)) mSku.set(f.entidad, f.raw);
  if (mSku.size && bench) {
    out.push({ nombre: "SKU bajo el benchmark", eje: "sku", set: new Set([...mSku].filter(([, v]) => v < bench.raw).map(([e]) => normalizar(e))), fuente: "margen del SKU < benchmark", re: /(?:bajo|debajo|menor|no llega|lejos)[^.]{0,25}(?:benchmark|referencia\s+de\s+margen|piso\s+de\s+margen)|(?:benchmark|referencia)[^.]{0,12}(?:por\s+debajo|hacia\s+abajo)/i });
    out.push({ nombre: "SKU sobre el benchmark", eje: "sku", set: new Set([...mSku].filter(([, v]) => v >= bench.raw).map(([e]) => normalizar(e))), fuente: "margen del SKU ≥ benchmark", re: /(?:sobre|encima|supera|mayor)[^.]{0,25}(?:benchmark|referencia\s+de\s+margen|piso\s+de\s+margen)/i });
  }
  if (R.saldo_vencido) out.push({ nombre: "con saldo vencido", eje: "cliente", set: new Set(R.saldo_vencido.filas.filter((x) => +x.valor > 0).map((x) => normalizar(x.entidad))), fuente: "saldo vencido > 0", re: /vencid|mora\b/i });
  /* «CARGA COMERCIAL ALTA» TIENE UNA SOLA DEFINICIÓN (owner 2026-09-16): la del detector, publicada por la proyección (`conjuntos`) desde la misma
   * función que la boleta. Va primero: «cuentas con carga alta» es ESTE conjunto. Las que solo exceden el nivel declarado son otro conjunto,
   * con otro nombre («sobre el nivel declarado de carga»), y su patrón ya no reconoce «alta». */
  const oficial = I.conjuntos && I.conjuntos["carga comercial alta"];
  /* con `tokens` y `n`, como un grupo de la boleta: «las cuentas con carga alta» resuelve al oficial aunque el subtotal no viaje en la boleta
   * de ese turno. ⚠️ «sobre el nivel declarado» se lee LITERAL (carga > nivel: el crudo, 9), aunque el rótulo del subtotal describa así a
   * sus 6 — esa redacción del rótulo queda anotada como decisión de producto pendiente (una sola verdad por frase) */
  if (oficial && Array.isArray(oficial.entidades) && oficial.entidades.length) out.push({ nombre: "carga comercial alta", eje: oficial.eje || "cliente", set: new Set(oficial.entidades.map(normalizar)), fuente: oficial.fuente || "detector de carga alta", n: oficial.entidades.length, tokens: tokens("carga comercial alta"), re: /carga(?:\s+comercial)?\s+alta|alta\s+carga|carga[^.]{0,25}\balta\b|exceso\s+de\s+carga\s+material|carga\s+(?:comercial\s+)?excedida/i });
  const nivel = I.figs.find((f) => /nivel de carga/.test(f.conceptoNorm) && !f.entidad);
  const crudo = I.conjuntos && I.conjuntos["sobre el nivel declarado de carga"];
  if (crudo && Array.isArray(crudo.entidades) && crudo.entidades.length) out.push({ nombre: "sobre el nivel declarado de carga", eje: crudo.eje || "cliente", set: new Set(crudo.entidades.map(normalizar)), fuente: crudo.fuente || "carga > nivel declarado", re: /(?:sobre|exced|encima|superan?)[^.]{0,30}(?:nivel\s+(?:de\s+referencia|declarado|de\s+carga)|carga)(?![^.]{0,12}\balta\b)|nivel\s+de\s+(?:referencia|carga)(?![^.]{0,12}\balta\b)/i });
  else if (R.carga && nivel) out.push({ nombre: "sobre el nivel declarado de carga", eje: "cliente", set: new Set(R.carga.filas.filter((x) => +x.valor > nivel.raw).map((x) => normalizar(x.entidad))), fuente: "carga > nivel declarado", re: /(?:sobre|exced|encima|superan?)[^.]{0,30}(?:nivel\s+(?:de\s+referencia|declarado|de\s+carga)|carga)(?![^.]{0,12}\balta\b)|nivel\s+de\s+(?:referencia|carga)(?![^.]{0,12}\balta\b)/i });
  /* contra el PLAN: la brecha al presupuesto por cliente («vs ppto» / «Variación vs presupuesto en $») — antes que «los que caen» a secas, que es
   * contra el año anterior y no se lleva un predicado que nombra el plan */
  const varPpto = new Map(); for (const f of I.figs) if (f.entidad && _FIG_VARIACION_PPTO(f) && Number.isFinite(f.raw) && !varPpto.has(f.entidad)) varPpto.set(f.entidad, f.raw);
  if (varPpto.size) {
    const _RE_PLAN = "(?:presupuesto|ppto|plan\\b)";
    out.push({ nombre: "bajo el presupuesto", eje: "cliente", set: new Set([...varPpto].filter(([, v]) => v < 0).map(([e]) => normalizar(e))), fuente: "variación vs presupuesto < 0", re: new RegExp("(?:caen|cae|cayendo|bajo|debajo|quedan|queda|no\\s+llegan?|se\\s+alejan?|lejos)[^.]{0,24}" + _RE_PLAN + "|" + _RE_PLAN + "[^.]{0,14}(?:abajo|debajo|negativ|en\\s+contra)", "i") });
    out.push({ nombre: "sobre el presupuesto", eje: "cliente", set: new Set([...varPpto].filter(([, v]) => v > 0).map(([e]) => normalizar(e))), fuente: "variación vs presupuesto > 0", re: new RegExp("(?:sobre|encima|superan?|cumplen?|aportan|arriba)[^.]{0,24}" + _RE_PLAN + "|" + _RE_PLAN + "[^.]{0,14}(?:arriba|encima|positiv|a\\s+favor)", "i") });
  }
  const vars = new Map(); for (const f of I.figs) if (f.entidad && /variacion vs ano anterior/.test(f.conceptoNorm) && Number.isFinite(f.raw) && !vars.has(f.entidad)) vars.set(f.entidad, f.raw);
  if (vars.size) {
    out.push({ nombre: "los que caen", eje: "cliente", set: new Set([...vars].filter(([, v]) => v < 0).map(([e]) => normalizar(e))), fuente: "variación < 0", re: /(?:\bcaen\b|\bcae\b|cayendo|cay[oó]|bajan\b|retroced|pierden|en\s+ca[ií]da)(?![^.]{0,24}(?:presupuesto|ppto|plan\b))/i });
    out.push({ nombre: "los que crecen", eje: "cliente", set: new Set([...vars].filter(([, v]) => v > 0).map(([e]) => normalizar(e))), fuente: "variación > 0", re: /\bcrecen\b|\bcrece\b|creciendo|crecieron|suben\b|avanzan/i });
  }
  /* los que caen DE FORMA MATERIAL / BAJO EL UMBRAL: la variación en $ por cuenta contra el umbral de materialidad en dinero de la boleta */
  const umbral = I.figs.find((f) => !f.entidad && /umbral de materialidad/.test(f.conceptoNorm) && f.unidad === "money" && Number.isFinite(f.raw));
  const varUsd = new Map(); for (const f of I.figs) if (f.entidad && _FIG_VARIACION_DINERO(f) && Number.isFinite(f.raw) && !varUsd.has(f.entidad)) varUsd.set(f.entidad, f.raw);
  if (umbral && varUsd.size) {
    out.push({ nombre: "caen de forma material", eje: "cliente", set: new Set([...varUsd].filter(([, v]) => v < 0 && Math.abs(v) >= umbral.raw).map(([e]) => normalizar(e))), fuente: `variación < 0 y |variación| ≥ ${umbral.texto}`, re: /(?:caen|ca[ií]da|pierden)[^.]{0,30}material|material(?:es)?[^.]{0,30}(?:caen|ca[ií]da)|sobre el umbral|de forma material|materiales?(?:\s+contra)?/i });
    out.push({ nombre: "caen bajo el umbral", eje: "cliente", set: new Set([...varUsd].filter(([, v]) => v < 0 && Math.abs(v) < umbral.raw).map(([e]) => normalizar(e))), fuente: `variación < 0 y |variación| < ${umbral.texto}`, re: /bajo el umbral|debajo del umbral|no material/i });
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
  /* «la cartera», «la cartera de clientes», «toda la cartera comercial»: los clientes, todos (fase 4: «la más alta de toda la cartera») */
  if ((!eje || eje === "cliente") && /^(?:toda\s+)?(?:la\s+)?cartera(?:\s+(?:de\s+clientes|de\s+cuentas|comercial|entera|completa|actual))?\s*$/i.test(s.trim())) return { set: null, fuente: "el eje entero" };
  /* el nombre pelado del eje («familias», «marcas», «los SKU», «carteras») es el eje entero (fase 4: el vocabulario libre del extractor) */
  if (/^(?:las?|los)?\s*(?:familias?|marcas?|bodegas?|clientes?|cuentas?|skus?|canales?|carteras?|meses)\s*$/i.test(s.trim())) return { set: null, fuente: "el eje entero" };
  /* «las bodegas del inventario», «los clientes de la cartera», «todos los SKU»: el eje entero */
  if (/^(?:las?|los|todos?|todas?)\s+(?:las?\s+|los\s+)?(?:bodegas?|clientes?|cuentas?|skus?|marcas?|familias?|meses)(?:\s+(?:del|de\s+la|de\s+los|de\s+las|en)\s+(?:negocio|cartera|inventario|empresa|demo|a[ñn]o))?\s*$/i.test(s.trim())) return { set: null, fuente: "el eje entero" };
  const total = I.tamanoDelEje(eje);
  const nums = numerosEn(s).filter(Number.isInteger);
  if (nums.length && total && nums.includes(total) && !/que m[aá]s|de mayor|top|mayores|primer/i.test(s)) return { set: null, fuente: "el eje entero" };
  /* «los N clientes con variación vs año anterior» / «con YoY en la boleta» / «publicados»: el conjunto con esa métrica en la boleta */
  const conMetrica = /\b(?:con\s+(?:variaci[oó]n|yoy|cifra|dato|a[ñn]o\s+anterior|[a-záéíóúñ ]{3,30})\s+(?:en|de)\s+la\s+boleta|publicad[oa]s?|con\s+variaci[oó]n\s+vs\s+a[ñn]o\s+anterior|con\s+a[ñn]o\s+anterior|con\s+yoy)\b/i.exec(s);
  if (conMetrica && metrica) {
    const fsM = I.figsDeMetrica(metrica, eje).slice();
    if (/yoy|variaci[oó]n/i.test(String(metrica))) { const vistas = new Set(fsM.map((g) => g.entidad)); for (const g of I.figs) if (g.entidad && !vistas.has(g.entidad) && _FIG_VARIACION_DINERO(g) && (!eje || !g.eje || g.eje === eje)) fsM.push(g); }
    const fm = fsM.filter((g) => g.entidad).map((g) => normalizar(g.entidad));
    if (fm.length && (!nums.length || nums.includes(new Set(fm).size))) return { set: new Set(fm), fuente: `los ${new Set(fm).size} ${eje}s con «${metrica}» en la boleta` };
  }
  const top = _topKDe(s, I, eje);
  if (top) return top;
  const tu = tokens(s);
  const conocidos = _conjuntosConocidos(I).filter((c) => !c.eje || !eje || c.eje === eje);   // un conjunto de clientes no resuelve un universo de SKU
  /* un grupo de un agregado, por su tamaño y sus palabras («las 5 cuentas materiales», «los que caen», «los grandes») */
  const grupos = conocidos.filter((c) => c.tokens);
  let g = null;
  if (nums.length) g = grupos.find((c) => nums.includes(c.n) && (tu.some((t) => c.tokens.some((x) => x.startsWith(t.slice(0, 5)))) || (metrica && (() => { const fg = I.figs.find((f) => f.label === c.nombre); return !!fg && I.casa(metrica, fg) > 0; })())));
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
const _DICE_BAJA = /\b(?:ca[ií]da|baja|cae|caen|reducci[oó]n|retroce|pierde|disminu|menos|negativ|recorte)/i;
function _cifra(a, I) {
  let v = _valorDeclarado(a);
  const descripcion = a.sujeto && typeof a.sujeto === "object" ? a.sujeto.descripcion : null;
  /* el signo dicho en palabras: «una caída de 3%» declarada «3%» contra la fig «−3.0%» es la misma cifra */
  if (v && Number.isFinite(v.raw) && v.raw > 0 && !/^\s*[-+−]/.test(String(v.texto || "")) && _DICE_BAJA.test(String(a.texto || ""))) {
    const neg = I.buscarFigs(a.sujeto, a.metrica, { agregados: a.sujeto === "negocio" }).some((f) => Number.isFinite(f.raw) && f.raw < 0 && _u(f.unidad) === _u(v.unidad) && _mismoValor({ ...v, raw: -v.raw, canon: null }, f.raw, f.unidad));
    if (neg) v = { ...v, raw: -v.raw, canon: null };
  }
  /* un sujeto descrito («las 5 cuentas materiales») es un agregado: se verifica como grupo por descripción */
  if (descripcion) return _grupo({ ...a, grupo: { entidades: [], n: null }, universo: a.universo || descripcion }, I);
  if (typeof a.sujeto === "string" && a.sujeto !== "negocio" && !I.resolverEntidad(a.sujeto)) return _nv(`entidad-desconocida: «${a.sujeto}» no es una entidad del tenant`);
  /* solo las figs en la UNIDAD de la cifra dicha son candidatas: «Ventas vs año anterior = +7.5%» no juzga «$92,9M» */
  /* con período «año anterior» declarado, la base se busca por su nombre («Venta del año anterior»), además de la métrica a secas */
  const _conBase = /anterior|pasado|previo/.test(normalizar(a.periodo)) && !/anterior|pasado|previo/.test(normalizar(a.metrica)) ? I.buscarFigs(a.sujeto, a.metrica + " del año anterior", { agregados: a.sujeto === "negocio" }) : [];
  const cands = [..._conBase, ...I.buscarFigs(a.sujeto, a.metrica, { agregados: a.sujeto === "negocio" }).filter((f) => !_conBase.includes(f))].filter((f) => !v || _u(f.unidad) === _u(v.unidad));
  if (!cands.length) {
    /* la proyección del dato (rankings sin escala ambigua) como evidencia cuando la boleta del turno no trae la fig */
    const rk = _delRanking(a, I);
    if (rk && (_u(rk.unidad) === _u(v.unidad) || (v.unidad === "count" && rk.unidad === "days"))) {
      if (v.unidad === "count" && rk.unidad === "days") v = { ...v, unidad: "days", canon: `days:${v.raw}d` };
      if (_mismoValor(v, rk.raw, rk.unidad, rk.texto)) return _ok(`coincide con ${rk.label} = ${rk.texto}`, [rk.label], `${rk.label} = ${rk.texto}`);
      return _falsa(`cifra-distinta: la proyección dice ${rk.label} = ${rk.texto}`, `${rk.label} = ${rk.texto}`, [rk.label]);
    }
    /* ¿la cifra es de OTRA métrica del mismo sujeto, o de OTRA entidad en la misma métrica? Se dice para la multa; el veredicto sigue
     * siendo no-verificable (no hay evidencia de esa afirmación) — y nunca verdadera */
    const ent = a.sujeto !== "negocio" ? I.resolverEntidad(a.sujeto) : null;
    /* con evidencia declarada, la cuenta va primero: una coincidencia por azar con otra fig no le gana a una derivación que cierra */
    if (a.evidencia && a.evidencia.length) { const d0 = _derivada(a, I); if (d0) return d0; }
    const otras = I.figs.filter((f) => a.sujeto === "negocio" ? !f.entidad : (f.entidad && ent && normalizar(f.entidad) === normalizar(ent.nombre)));
    const coincideOtra = otras.find((f) => _mismoValor(v, f.raw, f.unidad, f.texto));
    if (coincideOtra) return _nv(`sin-evidencia: la boleta no trae «${a.metrica}» de ${_nom(a.sujeto)}; la cifra coincide con ${_fmt(coincideOtra)}`, [coincideOtra.label], _fmt(coincideOtra));
    const deOtra = I.figs.find((f) => f.entidad && I.casa(a.metrica, f) > 0 && _mismoValor(v, f.raw, f.unidad, f.texto));
    if (deOtra) return _nv(`sin-evidencia: la boleta no trae «${a.metrica}» de ${_nom(a.sujeto)}; la cifra es de ${_fmt(deOtra)}`, [deOtra.label], _fmt(deOtra));
    const derivada = _derivada(a, I);
    if (derivada) return derivada;
    return _nv(`sin-evidencia: la boleta no trae «${a.metrica}» de ${_nom(a.sujeto)}`);
  }
  /* el universo/período declarados eligen entre las candidatas (Venta vs Venta (flujo); el subtotal de 5 vs el de 6) */
  const enPeriodo = cands.filter((f) => _periodoCasa(a.periodo, f, a.metrica));
  if (!enPeriodo.length) return _nv(`sin-evidencia: la boleta no trae «${a.metrica}» de ${_nom(a.sujeto)} en el período «${a.periodo}»`, cands.slice(0, 2).map((f) => f.label), cands.slice(0, 2).map(_fmt).join(" · "));
  const compatibles = enPeriodo.filter((f) => !f.agregado || !_necesitaUniverso(f, a.sujeto) || _universoCasa(a.universo, f) === "ok");
  const pool = compatibles.length ? compatibles : enPeriodo;
  const exacta = pool.find((f) => _mismoValor(v, f.raw, f.unidad, f.texto));
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
  const otra = I.figs.find((f) => f !== f0 && f.entidad === f0.entidad && _mismoValor(v, f.raw, f.unidad, f.texto));
  const deOtra = I.figs.find((f) => f.entidad && f.entidad !== f0.entidad && I.casa(a.metrica, f) > 0 && _mismoValor(v, f.raw, f.unidad, f.texto));
  const agregadoCoincide = cands.find((f) => f.agregado && _mismoValor(v, f.raw, f.unidad, f.texto));
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
/* _calculoAutorizado(a, I) → verdadera si la cifra declarada es el RESULTADO de un cálculo del bloque [[CALCULO]] que el muro recomputó y
 * autorizó (insumos de la boleta, dueño coherente): la cuenta la declaró el propio texto; la declaración dice de quién y de qué es */
function _calculoAutorizado(a, I) {
  const cs = Array.isArray(I.calculos) ? I.calculos : [];
  const v = _valorDeclarado(a);
  if (!cs.length || !v) return null;
  const _AGREG = /^(?:negocio|total|totales|cartera|global|conjunto|agregad[oa])$/i;
  const sujeto = typeof a.sujeto === "string" ? a.sujeto : "";
  for (const c of cs) {
    const mismoValor = (c.verbatim && String(v.texto || "").replace(/\s+/g, "") === c.verbatim) || (c.canon && v.canon && String(c.canon).replace(/\$/g, "") === String(v.canon).replace(/\$/g, "")) || (Number.isFinite(c.raw) && Number.isFinite(v.raw) && _u(c.unidad) === _u(v.unidad) && Math.abs(c.raw - v.raw) <= tolCalculo(c.raw, _u(c.unidad)));
    if (!mismoValor) continue;
    const duenoOk = !sujeto || !c.dueno || (_AGREG.test(String(c.dueno)) ? sujeto === "negocio" || _AGREG.test(sujeto) : normalizar(c.dueno) === normalizar(sujeto) || (I.resolverEntidad(sujeto) && normalizar(I.resolverEntidad(sujeto).nombre) === normalizar(c.dueno)));
    if (!duenoOk) continue;
    if (a.evidencia.length && c.id && !a.evidencia.some((e) => normalizar(e) === normalizar(c.id)) && !a.evidencia.some((e) => I.figs.some((f) => normalizar(f.label) === normalizar(e)))) continue;   // si nombra evidencia, que sea el cálculo o sus rótulos
    return _ok(`cálculo declarado${c.id ? " " + c.id : ""}: ${c.formula} = ${c.resultado}, recomputado por el muro con insumos de la boleta`, [c.id ? `[[CALCULO]] ${c.id}` : "[[CALCULO]]"], `${c.formula} = ${c.resultado}`);
  }
  return null;
}
function _derivada(a, I) {
  const porCalculo = _calculoAutorizado(a, I);
  if (porCalculo) return porCalculo;
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
    if (_mismoValor(v, propio.raw, propio.unidad, propio.texto)) return _ok(`coincide con ${_fmt(propio)} (${propio.n != null ? propio.n + " entidades" : "el conjunto declarado"})`, [propio.label], _fmt(propio));
    return _falsa(`cifra-distinta: ${_fmt(propio)}`, _fmt(propio), [propio.label]);
  }
  /* 2 · la cifra coincide con un agregado de OTRO conjunto: la cifra es del grupo entero, no del declarado (cifra-de-grupo-mal-repartida) */
  const ajeno = agregados.find((f) => _mismoValor(v, f.raw, f.unidad, f.texto));
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
  /* 3b · una PARTICIPACIÓN de un grupo sí se suma: la parte de cada miembro en el mismo todo. Con las participaciones de los miembros, su suma;
   * sin ellas, la suma de sus ventas sobre la venta total del negocio */
  if (declaradas.length && v.unidad === "pct" && /participaci|peso en la venta|% de la venta|cuota|concentraci/i.test(String(a.metrica || ""))) {
    const tolP = _tolCalculada(v, "pct");
    const partes = declaradas.map((e) => I.buscarFigs(e, "Participación en la venta").filter((g) => _u(g.unidad) === "pct")[0] || I.buscarFigs(e, "Peso en la venta").filter((g) => _u(g.unidad) === "pct")[0] || null);
    if (partes.every(Boolean)) {
      const suma = partes.reduce((x, g) => x + g.raw, 0);
      if (Math.abs(suma - v.raw) <= tolP) return _ok(`derivada: suma de ${partes.map(_fmt).join(" + ")}`, partes.map((g) => g.label), `suma = ${suma.toFixed(1)}%`);
      return _falsa(`suma-distinta: ${partes.map(_fmt).join(" + ")} = ${suma.toFixed(1)}%`, `suma = ${suma.toFixed(1)}%`, partes.map((g) => g.label));
    }
    const ventas = declaradas.map((e) => I.buscarFigs(e, "Venta").filter((g) => _u(g.unidad) === "money" && Number.isFinite(g.raw))[0] || null);
    const total = I.figs.find((g) => !g.entidad && _u(g.unidad) === "money" && Number.isFinite(g.raw) && /^(?:ventas? totales|ventas del periodo|venta del periodo|ventas)$/.test(g.conceptoNorm));
    if (ventas.every(Boolean) && total && total.raw > 0) {
      const part = (ventas.reduce((x, g) => x + g.raw, 0) / total.raw) * 100;
      const ev = [...ventas.map((g) => g.label), total.label];
      if (Math.abs(part - v.raw) <= tolP) return _ok(`derivada: (${ventas.map(_fmt).join(" + ")}) / ${_fmt(total)} = ${part.toFixed(1)}%`, ev, `${part.toFixed(1)}%`);
      return _falsa(`participacion-distinta: (${ventas.map(_fmt).join(" + ")}) / ${_fmt(total)} = ${part.toFixed(1)}%`, `${part.toFixed(1)}%`, ev);
    }
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
  if (/familia/.test(u)) return "familia";
  if (/canal/.test(u)) return "canal";
  if (/\bmes(?:es)?\b/.test(u)) return "mes";
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
    if (/yoy|variaci[oó]n.*(?:dinero|\$)|d[oó]lares nuevos|crecimiento en (?:dinero|\$)/i.test(String(a.metrica)) && !/ppto|presupuesto|plan\b/i.test(String(a.metrica))) {
      const vistas = new Set(fs.map((f) => f.entidad));
      for (const f of I.figs) if (f.entidad && !vistas.has(f.entidad) && _FIG_VARIACION_DINERO(f) && (!eje || !f.eje || f.eje === eje)) fs.push(f);
    }
    /* …y la brecha al PLAN en dinero: «vs ppto» (los destacados) y «Variación vs presupuesto en $» (el panel entero) son la misma cifra */
    if (/vs\s*ppto|presupuesto|\bplan\b/i.test(String(a.metrica))) {
      const vistas = new Set(fs.map((f) => f.entidad));
      for (const f of I.figs) if (f.entidad && !vistas.has(f.entidad) && _FIG_VARIACION_PPTO(f) && (!eje || !f.eje || f.eje === eje)) fs.push(f);
    }
    if (!fs.length) return { error: `sin-evidencia: no hay ranking ni cifras de «${a.metrica}» por ${eje} en la boleta` };
    /* un ranking es de UNA unidad: si la casación juntó «Carga comercial» (%) con «Carga comercial alta» ($), manda la unidad mayoritaria */
    { const cuenta = new Map(); for (const f of fs) cuenta.set(f.unidad || "?", (cuenta.get(f.unidad || "?") || 0) + 1); const [uMax] = [...cuenta].sort((x, y) => y[1] - x[1])[0]; if (cuenta.size > 1) fs = fs.filter((f) => (f.unidad || "?") === uMax); }
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
const _FIG_VARIACION_PPTO = (f) => f.unidad === "money" && (f.conceptoNorm === "vs ppto" || /^variacion vs presupuesto en \$/.test(f.conceptoNorm));
const _FIG_VARIACION_DINERO = (f) => f.unidad === "money" && (f.conceptoNorm === "yoy" || /^variacion vs ano anterior en \$/.test(f.conceptoNorm) || (f.conceptoNorm === "valor" && /salesread/i.test(String(f.fig.origin && f.fig.origin.tool || ""))));
function _valorDe(sujeto, metrica, I, universo = "", unidad = null) {
  if (sujeto && typeof sujeto === "object" && sujeto.descripcion) {
    const todos = _agregadosDe(metrica, I);
    let ag = todos.filter((f) => _universoCasa(sujeto.descripcion, f) === "ok").sort((x, y) => _puntajeUniverso(sujeto.descripcion, y) - _puntajeUniverso(sujeto.descripcion, x));
    /* sin casación por palabras, por CONJUNTO: «cuentas bajo el benchmark» es el grupo de «Markup promedio · los que caen» (los mismos 8) */
    if (!ag.length) {
      const U = _conjuntoDeUniverso(sujeto.descripcion, I, null, metrica);
      if (U && U.set && U.set.size) ag = todos.filter((f) => f.entidadesDelGrupo && f.entidadesDelGrupo.length === U.set.size && f.entidadesDelGrupo.every((x) => U.set.has(normalizar(x))));
    }
    return (unidad && ag.find((f) => _u(f.unidad) === _u(unidad))) || ag[0] || null;
  }
  let c = I.buscarFigs(sujeto, metrica, { agregados: sujeto === "negocio" });
  /* la variación de la venta EN DINERO: «YoY» y la fig «Valor» del emisor salesRead (sin rótulo propio — deuda anotada para la fase 2) */
  if (_ES_VARIACION_DINERO(metrica) && sujeto !== "negocio") { const ent = I.resolverEntidad(sujeto); if (ent) c = [...I.figs.filter((f) => f.entidad && normalizar(f.entidad) === normalizar(ent.nombre) && _FIG_VARIACION_DINERO(f)), ...c]; }
  if (!c.length) return null;
  /* la métrica sin «año anterior» es la del período: la base del año anterior no la representa (venta vs presupuesto comparaba $92.9M) */
  if (!/anterior|pasado|previo/.test(normalizar(metrica))) { const delPeriodo = c.filter((f) => !_esBaseAnterior(f)); if (delPeriodo.length) c = delPeriodo; }
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
  /* «con margen publicado en esta lectura», «con YoY en la boleta»: las entidades del eje que traen esa métrica en la boleta */
  const mPub = /^(?:con|que\s+traen?|que\s+tienen)\s+(.+?)\s+(?:publicad[oa]s?(?:\s+en\s+(?:la|esta)\s+(?:boleta|lectura))?|en\s+(?:la|esta)\s+(?:boleta|lectura))\s*$/i.exec(String(pred).trim());
  if (mPub) {
    const fsM = I.figsDeMetrica(mPub[1], eje).filter((g) => g.entidad);
    const set = new Set(fsM.map((g) => normalizar(g.entidad)));
    if (set.size) return [{ n: set.size, m: I.tamanoDelEje(eje) || null, fuente: `entidades con «${mPub[1]}» en la boleta`, label: `${set.size} ${eje}s con «${mPub[1]}» en la boleta`, set }];
  }
  /* el predicado casa con un rótulo cuando las palabras de UNO de los dos caben en el otro («materiales» ⊂ «cuentas materiales que concentran la brecha») */
const predN = normalizar(pred);
  const casaPred = (texto) => {
    const tt = tokens(texto); if (!tt.length) return false;
    const igual = (t, w) => t === w || (Math.min(t.length, w.length) >= 6 && (t.startsWith(w) || w.startsWith(t))) || (Math.min(t.length, w.length) >= 3 && Math.abs(t.length - w.length) <= 2 && (t.startsWith(w) || w.startsWith(t)));   // «sobre» no es «sobrestock»; «frenado» sí es «frenados»; «cae» sí es «caen»
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
  const conocidos = _conjuntosConocidos(I).filter((c) => c.re && (!c.eje || c.eje === eje));
  const total = I.tamanoDelEje(eje) || null;
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
  const _uNp = normalizar(uTexto + " " + pred);
  const ejeU = /sku|producto/.test(_uNp) ? "sku" : /bodega/.test(_uNp) ? "bodega" : /marca/.test(_uNp) ? "marca" : /familia/.test(_uNp) ? "familia" : /canal/.test(_uNp) ? "canal" : "cliente";
  let cn = _candidatosDeConteo(pred, I, ejeU);
  if (!cn.length) return _nv(`sin-evidencia: la boleta no cuenta «${pred}»`);
  const fmtC = (x) => `${x.n}${x.m != null ? " de " + x.m : ""} (${x.fuente}: ${x.label})`;
  const total = I.tamanoDelEje(ejeU);
  /* el universo declarado: si es un SUBCONJUNTO identificable, se cuenta dentro de él (solo con candidatos que traen su conjunto) */
  const U = _conjuntoDeUniverso(a.universo, I, ejeU, pred);
  if (U.set) {
    const conSet = cn.filter((x) => x.set);
    if (!conSet.length) return _nv(`universo-no-contable: la boleta cuenta «${pred}» (${fmtC(cn[0])}) pero no identifica quiénes, y el universo es «${uTexto}»`, [cn[0].label]);
    /* el tamaño del universo lo dice la boleta si lo cuenta («12 SKU bajo el benchmark») aunque el conjunto por cifras individuales sea menor */
    const _mDicho0 = c.m != null ? c.m : (numerosEn(uTexto).find(Number.isInteger) ?? null);
    const _mBoleta = _mDicho0 != null && _candidatosDeConteo(uTexto.replace(/\d+/g, " "), I, ejeU).some((x) => x.n === _mDicho0 && !x.set) ? _mDicho0 : null;
    cn = conSet.map((x) => ({ ...x, n: [...x.set].filter((e) => U.set.has(e)).length, m: _mBoleta != null ? _mBoleta : U.set.size, fuente: `${x.fuente} dentro de ${U.fuente}` }));
  }
  /* con varias candidatas del mismo n gana la que trae el «de M» declarado (o la de predicado más parecido: las de rótulo antes que las de conjunto) */
  const _mDicho = c.m != null ? c.m : (numerosEn(uTexto).find(Number.isInteger) ?? null);
  const exacto = cn.find((x) => x.n === c.n && _mDicho != null && x.m === _mDicho) || cn.find((x) => x.n === c.n && (x.m == null || _mDicho == null)) || cn.find((x) => x.n === c.n);
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
  /* el período elige el panel: «vs presupuesto» se verifica con la variación contra el presupuesto, nunca con la del año anterior */
  if (/presupuesto|ppto|plan\b/.test(p)) {
    const ent = a.sujeto !== "negocio" ? I.resolverEntidad(a.sujeto) : null;
    const cp = I.figs.filter((g) => (a.sujeto === "negocio" ? !g.entidad : (g.entidad && ent && normalizar(g.entidad) === normalizar(ent.nombre))) && /presupuesto|ppto/.test(g.conceptoNorm) && Number.isFinite(g.raw));
    if (!cp.length) return _nv(`sin-evidencia-temporal: la boleta no trae la variación vs presupuesto de ${_nom(a.sujeto)}`);
    const val = v.valor && Number.isFinite(v.valor.raw) ? v.valor : null;
    const g = (val ? cp.find((x) => _u(x.unidad) === _u(val.unidad)) : null) || cp.find((x) => x.unidad === "pct") || cp[0];
    const dirReal = Math.abs(g.raw) < 0.05 ? "estable" : g.raw > 0 ? "sube" : "baja";
    if (dirReal !== v.direccion) return _falsa(`direccion-falsa: ${_fmt(g)} (${dirReal}), no «${v.direccion}»`, _fmt(g), [g.label]);
    if (val && _u(val.unidad) === _u(g.unidad) && !_mismoValor({ ...val, raw: Math.abs(val.raw) }, Math.abs(g.raw), g.unidad)) return _falsa(`magnitud-distinta: ${_fmt(g)}`, _fmt(g), [g.label]);
    return _ok(`${v.direccion} vs presupuesto: ${_fmt(g)}`, [g.label], _fmt(g));
  }
  let cands = I.buscarFigs(a.sujeto, "variacion", { agregados: a.sujeto === "negocio" }).filter((f) => /variacion|crecimiento|yoy|vs ano anterior/.test(f.conceptoNorm) && !/presupuesto|ppto/.test(f.conceptoNorm));
  if (esVenta) {
    /* la variación de la venta EN DINERO: «YoY = +$2.3M» y, del mismo emisor (salesRead), la fig «Valor» que acompaña a la variación en % —
     * un rótulo sin significado propio (deuda del emisor, anotada para la fase 2): solo cuenta cuando el sujeto tiene su variación en % */
    const ent = a.sujeto !== "negocio" ? I.resolverEntidad(a.sujeto) : null;
    if (ent && cands.length) for (const f of I.figs) if (f.entidad && normalizar(f.entidad) === normalizar(ent.nombre) && _FIG_VARIACION_DINERO(f) && !cands.includes(f)) cands.push(f);
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
const _ESTADOS_CONOCIDOS = new Set(["inmovilizado", "frenado", "sobrestock", "riesgo de quiebre", "capital sano", "critico"]);
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
  if (!_ESTADOS_CONOCIDOS.has(quiere)) return _nv(`estado-desconocido: «${e.estado}» no es un estado que la evidencia declare (inmovilizado · frenado · sobrestock · riesgo de quiebre · capital sano · crítico)`, ev, verdad);
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
