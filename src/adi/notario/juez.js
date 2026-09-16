/* === src/adi/notario/juez.js · EL JUEZ SEMÁNTICO DEL TURNO (Notario semántico, fase 2 · owner 2026-09-15) ═════════════════
 * «Notario verifica la afirmación contra la evidencia estructurada; la redacción no determina la verdad.» Acá se juntan, para UN
 * texto y SU declaración, las cuatro cosas que el turno necesita saber — y salen como vetos en la forma que el bucle ya entiende
 * ({kind, detail, texto}):
 *   1 · CONSISTENCIA: la respuesta y sus declaraciones representan la misma realidad. Cada afirmación declarada tiene que estar en la
 *       prosa (su `texto`), con su cifra en la frase, con el sujeto de la cláusula (el lector de cláusula, en su nuevo papel: contrasta
 *       la prosa con lo declarado, no dicta veredictos) y con una métrica que la frase no contradiga. Una declaración que no se
 *       corresponde con la frase es `declaracion-inconsistente`: la puerta por la que una prosa falsa se colaría con una declaración
 *       verdadera está cerrada.
 *   2 · VEREDICTO: verificar.js sobre cada afirmación → `afirmacion-falsa` (con la verdad de la boleta al lado: la multa exacta) y
 *       `afirmacion-no-verificable` (sin evidencia, incompleta, o una lectura que encubre un hecho). Nunca verdadera por defecto.
 *   3 · OMISIONES: presencia.js sobre la prosa contra lo declarado → `afirmacion-no-declarada` («declara o quita»).
 *   4 · SIN DECLARACIÓN: una salida del cerebro sin bloque, con hechos en la prosa → `sin-declaracion`.
 * Y las MEDIDAS del turno para el expediente: cuánto se declaró, cuánto quedó sin declarar, cuántas correctas, cuántas falsas.
 * Puro: sin I/O, sin red. */
import { extraerCalculos } from "../oracle/narrationBlocks.js";   // el bloque [[CALCULO]] se saca de la prosa antes de juzgar
import { verificarAfirmaciones } from "./verificar.js";
import { omisiones, puntosDeAfirmacion } from "./presencia.js";
import { normalizarAfirmaciones, normalizar, menosAscii } from "./afirmacion.js";
import { leerClausula } from "../oracle/lectorDeClausula.js";
import { metricasEn } from "../oracle/guardC.js";
import { parseFigures } from "../boleta.js";
import { conceptosDe, estadoCanon } from "./evidencia.js";
const _ESTADOS_CANON = new Set(["inmovilizado", "frenado", "sobrestock", "riesgo de quiebre", "capital sano", "critico"]);
import { ubicarFragmento } from "./ubicar.js";   // fase 4: el fragmento declarado se ubica con tolerancia (markdown, comillas, un paréntesis omitido)
const _PUNTOS = /(\d+(?:[.,]\d+)?)\s+puntos?\b/gi;
/* las cifras de un tramo: las del canon (parseFigures) + «N puntos» (pp) + los enteros con separador de miles («1.194») como conteos */
function _cifrasDe(t) {
  const out = parseFigures(t).map((f) => ({ canon: f.canon.replace(/\$/g, ""), raw: f.raw, unit: f.unit }));
  let m; _PUNTOS.lastIndex = 0;
  while ((m = _PUNTOS.exec(t))) { const raw = parseFloat(m[1].replace(",", ".")); out.push({ canon: `pp:${raw}pp`, raw, unit: "pp" }); }
  /* la moneda sin símbolo («330K», «34.5M»): dinero con su escala */
  for (const mk of t.matchAll(/(?<![\d.,$%\w-])([+-]?\d+(?:[.,]\d+)?)\s?([KMB])(?![a-záéíóúñ0-9])/g)) { const r = parseFloat(mk[1].replace(",", ".")) * ({ K: 1e3, M: 1e6, B: 1e9 })[mk[2].toUpperCase()]; out.push({ canon: `money:${mk[1].replace("+", "")}${mk[2].toUpperCase()}`, raw: r, unit: "money" }); }
  for (const mm of t.matchAll(/(?<![\d.,$])(\d{1,3}(?:\.\d{3})+|\d+)(?![\d.,]*\s*(?:%|pp|d\b|x\b|[KMB]\b))/g)) { const raw = parseInt(mm[1].replace(/\./g, ""), 10); out.push({ canon: `count:${raw}`, raw, unit: "count" }); }
  return out;
}

const FACTUALES = new Set(["cifra", "orden", "relacion", "grupo", "conteo", "variacion", "estado"]);
const _dec = (s) => s.replace(/(\d),(\d)/g, "$1.$2");

/* _ubicar(prosaN, textoN) → posición del fragmento declarado en la prosa normalizada (entero, o por su cabeza/cola de 30) */
function _ubicar(prosaN, textoN) {
  if (!textoN) return -1;
  let i = prosaN.indexOf(textoN);
  if (i >= 0) return i;
  if (textoN.length > 30) { i = prosaN.indexOf(textoN.slice(0, 30)); if (i >= 0) return i; const j = prosaN.indexOf(textoN.slice(-30)); if (j >= 0) return Math.max(0, j - (textoN.length - 30)); }
  return -1;
}

/** consistencia(prosa, afirmaciones, {nombres}) → [{id, motivo, texto}] · lo declarado contra lo escrito */
const _VERBO_DIRECCION = /\b(?:crec|ca(?:e|en|y)|sub(?:e|en|i)|baj(?:a|an|ó|aron|ando)|deterior|mejor|empeor|retroced|avanz|aument|disminu|descend|desplom|repunt|pierde|gana)/i;
/* ── LA CONSISTENCIA PROSA ↔ DECLARACIÓN, v2 (ronda adversarial 2026-09-16) ──────────────────────────────────────────────────────
 * Siete puertas que la ronda abrió, cerradas una por una:
 *  (a) la cifra declarada está en la frase (con «A vs B» basta una de las dos);
 *  (a′) EL DUEÑO POR CERCANÍA: en una frase que nombra dos cuentas, la cifra es de la más cercana — «Lider deja 22,0% y Falabella 21,5%»
 *       declarado Falabella 22,0% es inconsistente aunque las dos cifras estén en la frase; en una relación «A vs B», A va con el sujeto y B
 *       con el otro lado;
 *  (b) el sujeto de la cláusula: sin la ventana de 220 caracteres ANTERIORES (nombrar a Lider una oración antes no hace suya la cifra de la
 *       siguiente) y sin el atajo de «comparación» (que dejaba pasar los lados cruzados);
 *  (c) la métrica: las palabras de métrica JUNTO a la cifra (ventana de ±45 caracteres, después el fragmento, después la oración) tienen que
 *       ser la declarada o un sinónimo de la casa — no «la misma familia» (vencido ≠ pendiente ≠ abonado; carga ≠ contribución ≠ brecha);
 *  (d) la dirección: un superlativo, un comparativo o un verbo de variación en la prosa no puede contradecir la dirección declarada («la que
 *       más margen deja» no es un orden min; «cae 25%» no es una variación sube; «Falabella supera a La Polar» no es La Polar mayor vs
 *       Falabella); un estado nombrado en el fragmento tiene que ser el declarado; «sobre el benchmark» no es el predicado «bajo el benchmark»;
 *  (f) la negación: una cifra, un orden o una variación bajo negación o distancia («no deja», «ya no», «lejos de», «dista de», «bastante
 *       menos que») no se declara como el hecho afirmado. */
const _NEG_CLAUSULA = /\b(?:no|ni|nunca|jam[aá]s|tampoco|ya\s+no|sin|lejos\s+de|dista(?:n|nte)?\s+(?:mucho\s+)?de|bastante\s+menos|mucho\s+menos|ni\s+siquiera|no\s+llega)\b/i;
/* los estados que pueden convivir en la misma frase sin contradecirse: inmovilizado abarca frenado y sobrestock; «crítico» es la alerta del dato */
const _ESTADOS_COMPATIBLES = (dicho, enFrag) => dicho === enFrag || enFrag === "critico" || dicho === "critico" || (enFrag === "inmovilizado" && (dicho === "frenado" || dicho === "sobrestock")) || (dicho === "inmovilizado" && (enFrag === "frenado" || enFrag === "sobrestock"));
/* «la que más te está costando», «la peor», «el mayor problema»: un superlativo de daño no dice la dirección de la métrica (más costo = menor margen) */
const _SUP_INVERSO = /\bm[aá]s\s+(?:te\s+|le\s+|les\s+|nos\s+|se\s+)?(?:est[aá]n?\s+|viene\s+|vienen\s+)?(?:lejos|distante|alej\w*|grave|sever[oa]|cr[ií]tic[oa]|ca[eíy]\w*|baj[a-z]+|retroced\w*|desplom\w*|deterior\w*|empeor\w*|costando|cuesta|cuestan|pierde|pierden|perdiendo|duele|duelen|castiga|castigan|sufre|sufren|rezag\w*|atras\w*|dej[a-z]+\s+(?:sobre\s+la\s+mesa|en\s+el\s+camino|de\s+ganar))\b|\bpeor(?:es)?\b|\bproblema\b/i;
const _SUP_MAS = /\b(?:m[aá]s\s+(?!baj[oa]|pequeñ|chic|cort|barat|cerca|delgad|lent|d[eé]bil|escas|fin[oa]|estrech|livian|leve)[a-záéíóúñ]+|mayor(?:es)?|encabeza|lidera|primer[oa]?|en\s+cabeza|a\s+la\s+cabeza|(?:el|la|quien)\s+que\s+m[aá]s|top\s*\d)\b/i;
const _SUP_MENOS = /\b(?:menos\s+[a-záéíóúñ]+|menor(?:es)?|[uú]ltim[oa]|cierra\s+la\s+(?:tabla|lista)|en\s+la\s+cola|(?:el|la|quien)\s+que\s+menos|m[aá]s\s+(?:baj[oa]|pequeñ[oa]|chic[oa]|delgad[oa]|lent[oa]|d[eé]bil|escas[oa]|fin[oa]|estrech[oa])s?)\b/i;
const _PEQUENEZ = "delgad[oa]s?|baj[oa]s?|pequeñ[oa]s?|chic[oa]s?|cort[oa]s?|barat[oa]s?|lent[oa]s?|d[eé]bil(?:es)?|escas[oa]s?|fin[oa]s?|estrech[oa]s?|liviana?s?|leves?";
const _CMP_MAYOR = new RegExp("\\b(?:supera(?:n)?\\s+a?|por\\s+encima\\s+de|m[aá]s\\s+(?!(?:" + _PEQUENEZ + ")\\s+que)(?:[a-záéíóúñ]+\\s+)?que|mayor\\s+que|duplica|triplica|el\\s+doble\\s+(?:que|de)|por\\s+delante\\s+de)\\b", "i");
const _CMP_MENOR = new RegExp("\\b(?:por\\s+debajo\\s+de|menos\\s+(?:[a-záéíóúñ]+\\s+)?que|m[aá]s\\s+(?:" + _PEQUENEZ + ")\\s+que|menor\\s+que|la\\s+mitad\\s+(?:que|de)|un\\s+tercio\\s+(?:que|de)|detr[aá]s\\s+de|no\\s+llega\\s+a)\\b", "i");
const _VAR_SUBE = /\b(?:crec[ieó][a-záéíóúñ]*|sub[eií][a-záéíóúñ]*|aument[a-záéíóúñ]+|mejor[a-záéíóúñ]+|avanz[a-záéíóúñ]+|repunt[a-záéíóúñ]+|gan[a-záéíóúñ]+)\b/i;
const _VAR_BAJA = /\b(?:ca[eíy][a-záéíóúñ]*|baj[a-záéíóúñ]+|retroced[a-záéíóúñ]+|disminu[a-záéíóúñ]+|deterior[a-záéíóúñ]+|pierd[a-záéíóúñ]+|empeor[a-záéíóúñ]+|desplom[a-záéíóúñ]+|descend[a-záéíóúñ]+|se\s+contrae)\b/i;
/* las claves del vocabulario del muro que cada concepto de la casa comparte legítimamente con la prosa (sinónimos, no familias) */
const _CLAVES_DEL_CONCEPTO = {
  "contribucion no capturada": ["contribucion", "brecha"], "brecha por precio y costo": ["brecha", "costo"], "brecha al benchmark": ["brecha", "margen"],
  "capital frenado": ["capital", "frenado"], "capital inmovilizado": ["capital", "frenado"], "capital": ["capital"], "dias de inventario": ["cobertura"], "cobertura (doh)": ["cobertura"],
  "markup sobre costo": ["markup", "costo"], "markup promedio": ["markup", "costo"], "peso del costo": ["costo"], "unidades vendidas": ["unidades", "ventas"],
  "ventas del ano anterior": ["ventas"], "variacion vs ano anterior": ["variacion", "ventas"], "yoy": ["variacion", "ventas"], "crecimiento": ["variacion", "ventas"],
  "carga comercial alta": ["carga"], "carga comercial": ["carga"], "nivel de carga declarado": ["carga"], "benchmark de margen": ["margen"],
};
/* el postfijo y el prefijo de una cifra terminan en puntuación, en un conector o en una cláusula nueva */
const _CORTE_JUNTO = /[,;:()—–·]|\s-\s|\.\s|\s+y\s+|\s+en\s+|\s+contra\s+|\s+vs\.?\s+|\s+que\s+|\s+pero\s+|\s+aunque\s+|\s+eso\s+/;
/* las palabras PROPIAS de un concepto de la casa que la prosa usa sin nombrar la métrica: «$1,6M no capturado», «el mayor problema de margen»,
 * «el exceso» de carga — valen como la métrica declarada (y no abren otra: «el mayor margen» sigue siendo margen) */
const _PALABRAS_PROPIAS = {
  "contribucion no capturada": /\bno\s+captur\w*|\bsin\s+capturar\b|\bsobre\s+la\s+mesa\b|\bproblema\s+de\s+margen\b|\barrastre\s+de\s+margen\b|\bmargen\s+(?:que\s+)?ced\w*|\bced\w*\s+margen\b|\bmargen\s+(?:no\s+capturad\w*|perdid\w*|que\s+se\s+(?:va|pierde|escapa))|\bdej[a-z]*\s+(?:de\s+(?:ganar|capturar)|en\s+el\s+camino)\b/,
  "carga comercial alta": /\bexces[oa]s?\b|\bsobrecarga\b/,
  "nivel de carga declarado": /\bnivel\b|\breferencia\b/,
  "benchmark de margen": /\bbenchmark\b|\breferencia\b/,
  "margen": /\bbenchmark\b/,
  "saldo vencido": /\bdeben?\b|\bdeuda\b|\badeud\w*/,   // «debe casi el doble que Falabella»: lo vencido también se debe
};
/* los NOMBRES de concepto que la prosa usa enteros (dos o más palabras, o un término inequívoco): si el fragmento nombra uno, ese es su concepto */
const _NOMBRES_DE_CONCEPTO = ["brecha por precio y costo", "precio y costo", "contribucion no capturada", "no capturada", "sin capturar", "capital frenado", "capital inmovilizado", "capital detenido", "capital parado", "saldo vencido", "saldo pendiente", "dias de inventario", "dias sin venta", "dias de atraso", "dias de mora", "dias vencido", "markup", "peso del costo", "unidades en stock", "unidades vendidas", "benchmark de margen", "nivel de carga", "nivel de referencia", "carga comercial alta", "exceso de carga", "brecha al benchmark", "margen promedio", "valor en juego"];
function _conceptosNombrados(texto, soloPegadoAlFinal = false) {
  const out = [];
  for (const n of _NOMBRES_DE_CONCEPTO) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    /* antes de la cifra solo vale el nombre PEGADO a ella («brecha por precio y costo de $4.4M», «carga comercial alta: $655K»), no el de otra cifra («…no capturada y $655K») */
    const re = soloPegadoAlFinal ? new RegExp("(?<![a-z])" + esc + "\\s*(?:de|del|es|son|era|fue|en|a|al|queda\\s+en|llega\\s+a|sube\\s+a|baja\\s+a|est[aá]\\s+en|:|\\()?\\s*$") : new RegExp("(?<![a-z])" + esc + "(?![a-z])");
    if (re.test(texto)) for (const c of conceptosDe(n)) if (!out.includes(c)) out.push(c);
  }
  return out;
}
const _esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function _entidadesEn(texto, nombres) {
  const t = normalizar(texto);
  const out = [];
  for (const n of nombres) {
    const nn = normalizar(n); if (!nn || nn.length < 2) continue;
    const re = new RegExp("(?<![a-z0-9])" + _esc(nn) + "(?![a-z0-9])", "g"); let m;
    while ((m = re.exec(t))) out.push({ nombre: nn, pos: m.index, fin: m.index + nn.length });
  }
  /* un nombre contenido en otro más largo («LG» dentro de «LG-DRYER8KG») no cuenta */
  return out.filter((e) => !out.some((o) => o !== e && o.pos <= e.pos && o.fin >= e.fin && o.nombre.length > e.nombre.length)).sort((x, y) => x.pos - y.pos);
}
/* la entidad más cercana a una posición dentro de la oración (la más próxima; a igual distancia, la que está antes) */
function _masCercana(entidades, pos, fin, oracionN = "", ejeDe = null) {
  /* «$2,5M de Lider», «$52K en Jumbo»: la entidad pegada después con «de»/«en» es la dueña — salvo una bodega tras «en» («en Antofagasta» es un lugar) */
  const tras = oracionN.slice(fin, fin + 40);
  const mDe = /^\s*(?:,\s*)?(de|del|en)\s+/.exec(tras);
  if (mDe) { const e = entidades.find((x) => x.pos === fin + mDe[0].length || (x.pos > fin && x.pos <= fin + mDe[0].length + 1)); if (e && !(mDe[1] === "en" && typeof ejeDe === "function" && ejeDe(e.nombre) === "bodega")) return e; }
  /* dentro de un paréntesis, el dueño es quien va justo antes del «(»: «MAK-COMP-AIR ($8K, 190 días, en Antofagasta)» */
  const abre = oracionN.lastIndexOf("(", pos), cierra = oracionN.lastIndexOf(")", pos);
  const dentro = abre >= 0 ? oracionN.slice(abre + 1, pos) : "";
  /* «la de Falabella (8.6 pp contra 8.1 pp)»: la primera cifra de un paréntesis comparativo es del sujeto de la oración, no de la entidad de antes */
  if (abre >= 0 && abre > cierra) { const cierraSig = oracionN.indexOf(")", fin); const todo = oracionN.slice(abre + 1, cierraSig < 0 ? oracionN.length : cierraSig); const cmp = /\b(?:contra|vs\.?|frente a)\b/.exec(todo); if (cmp && pos - (abre + 1) < cmp.index) return null; }
  if (abre >= 0 && abre > cierra && !/\b(?:es|era|esta|estan|son|fue|tiene|tienen|nivel|referencia|benchmark|umbral)\b/.test(dentro)) { const antesDelParentesis = entidades.filter((e) => e.fin <= abre); if (antesDelParentesis.length && abre - antesDelParentesis[antesDelParentesis.length - 1].fin <= 3) return antesDelParentesis[antesDelParentesis.length - 1]; }
  /* la cláusula de la cifra: entre ; : — ( ) o viñetas */
  const iniC = Math.max(...[";", ":", "—", "(", ")", "•", "·"].map((c) => oracionN.lastIndexOf(c, pos)), -1) + 1;
  let finC = Math.min(...[";", ":", "—", "(", ")", "•", "·"].map((c) => { const i = oracionN.indexOf(c, fin); return i < 0 ? Infinity : i; }));
  if (!Number.isFinite(finC)) finC = oracionN.length;
  const enClausula = entidades.filter((e) => e.pos >= iniC && e.fin <= finC);
  /* una cláusula coordinada entre la entidad y la cifra («MAK-COMP-AIR, y el capital frenado suma $33K», «Lider y su margen es 21%») cambia de sujeto */
  const antes = enClausula.filter((e) => e.fin <= pos && !/(?:,\s*(?:y|e|pero|aunque|mientras)\s+|\s+(?:y|e)\s+(?:el|la|los|las|su|sus|tu|tus|un|una|ese|esa|este|esta)\s+|,\s+(?:el|la|los|las|su|sus|tu|tus)\s+)/.test(oracionN.slice(e.fin, pos)) && !/\d[\d.,]*\s?(?:[kmb%]|pp|d)?\s+(?:de|del|sobre)\s+(?:los\s+|las\s+|un\s+total\s+de\s+)?$/.test(oracionN.slice(e.fin, pos)));   // «$4.6M de $12.6M»: la segunda es el todo
  if (antes.length) return antes[antes.length - 1];
  const despues = enClausula.filter((e) => e.pos >= fin);
  /* después de la cifra solo cuenta si viene pegada («22,0% de margen tiene Lider» no; «$4,6M vencidos de Lider» sí) — a ≤ 12 caracteres */
  /* «22% vs 24% de Jumbo»: si entre la cifra y la entidad de después hay otra cifra o un comparador, la entidad es de la otra cifra */
  /* «$4,6M vencidos de Lider», «22,0% de margen tiene Lider»: hasta 30 caracteres sin otra cifra, coma ni conector («y», «contra», «con», «que»…) */
  if (despues.length && despues[0].pos - fin <= 30 && !/\d|,|\b(?:vs\.?|contra|frente a|con|y|entre|para|que|pero|aunque|mientras|donde|como)\b|\bse\s+[a-záéíóúñ]+\s+en\s+|\b(?:completa|alcanza|cruza|termina|queda|cae|entra|llega|aparece|concentra)\s+en\s+/.test(oracionN.slice(fin, despues[0].pos))) return despues[0];   // «se completa en Mercado Libre»: un lugar, no el dueño
  return null;
}
/* la posición de una cifra (por su canon) dentro de la oración normalizada */
function _posDeCifra(oracionN, v, fragN = "", sujetoN = null) {
  if (!v || !v.texto) return -1;
  let t = _dec(normalizar(v.texto)).replace(/\s+/g, " ");
  if (oracionN.indexOf(t) < 0 && v.raw != null) { const figs = parseFigures(oracionN); const f = figs.find((x) => Math.abs(x.raw - v.raw) < 1e-9 && (x.unit === v.unidad || (/^(?:pct|pp)$/.test(x.unit) && /^(?:pct|pp)$/.test(v.unidad)))); if (f) t = _dec(normalizar(f.text)); }
  /* la ocurrencia que cuenta: la del fragmento declarado («Lider $1,5M» no es el «(+$1,5M)» de Falabella); si no, la más cercana al sujeto; si no, la primera */
  if (fragN) { const fp = oracionN.indexOf(fragN); const ci = fragN.indexOf(t); if (fp >= 0 && ci >= 0) return fp + ci; }
  const ocurrencias = []; let i = -1; while ((i = oracionN.indexOf(t, i + 1)) >= 0) ocurrencias.push(i);
  if (!ocurrencias.length) return -1;
  if (ocurrencias.length > 1 && sujetoN) { const js = []; let j = -1; while ((j = oracionN.indexOf(sujetoN, j + 1)) >= 0) js.push(j); if (js.length) { let mejor = ocurrencias[0], d = Infinity; for (const o of ocurrencias) for (const jj of js) { const dist = Math.abs(o - jj); if (dist < d) { d = dist; mejor = o; } } return mejor; } }
  return ocurrencias[0];
}
const _sujetoDecl = (a) => (typeof a.sujeto === "string" && a.sujeto !== "negocio" ? normalizar(a.sujeto) : null);
export function consistencia(prosa, afirmaciones, { nombres = [], ejeDe = null } = {}) {
  const s = String(prosa || "");
  const out = [];
  const norm = normalizarAfirmaciones(afirmaciones);
  const nombresLimpios = (nombres || []).filter((n) => typeof n === "string" && n.trim());
  for (const { afirmacion: a } of norm) {
    if (!a.texto) continue;
    const u = ubicarFragmento(s, a.texto, { nombres: nombresLimpios });
    if (!u) { out.push({ id: a.id, motivo: `declaracion-ajena: el fragmento «${a.texto.slice(0, 60)}» no está en la respuesta`, texto: a.texto }); continue; }
    if (!FACTUALES.has(a.tipo)) continue;
    /* la oración de la prosa donde cae el fragmento (sobre el texto original) */
    const posOrig = Math.min(s.length - 1, u.ini);
    const ini = Math.max(s.lastIndexOf(". ", posOrig), s.lastIndexOf("\n", posOrig), 0);
    let fin = s.indexOf(". ", posOrig + Math.max(1, a.texto.length)); if (fin < 0) fin = s.length;
    const finLinea = s.indexOf("\n", posOrig + 1); if (finLinea >= 0 && finLinea < fin) fin = finLinea;   // una viñeta es su propia oración
    const oracion = s.slice(ini, fin);
    const oracionN = _dec(normalizar(oracion)).replace(/\s+/g, " ");
    const fragN = _dec(normalizar(a.texto)).replace(/\s+/g, " ");
    const entidades = _entidadesEn(oracion, nombresLimpios);
    const sujetoDecl = _sujetoDecl(a);
    const vsDecl = a.relacion && a.relacion.vs && typeof a.relacion.vs.sujeto === "string" && a.relacion.vs.sujeto !== "negocio" ? normalizar(a.relacion.vs.sujeto) : null;
    const valores = [a.valor, a.variacion && a.variacion.valor, a.relacion && a.relacion.valor].filter((v) => v && v.canon);
    /* (a) la cifra declarada tiene que estar en la frase (misma cifra: el canon), si la frase trae cifras */
    if (valores.length) {
      /* las cifras de la oración, también las dichas EN PALABRAS («ocho días», «cinco puntos», «dos millones») */
      const cifras = [..._cifrasDe(oracion), ..._cifrasDe(a.texto), ...puntosDeAfirmacion(oracion).filter((p) => p.enPalabras && p.canon).map((p) => ({ canon: String(p.canon).replace(/\$/g, ""), raw: p.raw, unit: p.unit }))];
      const enFrase = new Set(cifras.map((f) => f.canon));
      for (const v of valores) {
        const dos = parseFigures(String(v.texto || "")).map((x) => x.canon.replace(/\$/g, ""));
        if (dos.length >= 2 && dos.some((k) => enFrase.has(k))) continue;
        const c = String(v.canon).replace(/\$/g, "");
        const signoEnPalabras = Number.isFinite(v.raw) && v.raw < 0 && (_VERBO_DIRECCION.test(oracion) || /\b(?:menos|ca[ií]da|baja|negativ|p[eé]rdida|retroceso|cay[oó])\b/i.test(oracion));
        const mismoRaw = cifras.some((f) => Number.isFinite(v.raw) && (Math.abs(f.raw - v.raw) < 1e-9 || (signoEnPalabras && Math.abs(Math.abs(f.raw) - Math.abs(v.raw)) < 1e-9)) && (f.unit === v.unidad || (/^(?:pct|pp)$/.test(f.unit) && /^(?:pct|pp)$/.test(v.unidad)) || f.unit === "count" || v.unidad === "count"));
        if (enFrase.size && !enFrase.has(c) && !mismoRaw) out.push({ id: a.id, motivo: `declaracion-inconsistente: declaraste ${v.texto} y la frase «${a.texto.slice(0, 60)}» no la trae`, texto: a.texto });
      }
    }
    /* (a′) el dueño por cercanía: la cifra es de la cuenta más cercana en la frase */
    if (entidades.length && (a.tipo === "cifra" || a.tipo === "variacion") && a.valor && a.valor.texto) {
      const p = _posDeCifra(oracionN, a.valor, fragN, sujetoDecl);
      if (p >= 0) {
        const cerca = _masCercana(entidades, p, p + String(a.valor.texto).length, oracionN, ejeDe);
        /* «el resto está en Antofagasta con MAK-COMP-AIR ($8K)»: una bodega y un SKU nombrados en la misma oración pueden compartir la cifra */
        const comparten = cerca && sujetoDecl && typeof ejeDe === "function" && oracionN.includes(sujetoDecl) && (() => { const e1 = ejeDe(cerca.nombre), e2 = ejeDe(sujetoDecl); return (e1 === "bodega" && e2 === "sku") || (e1 === "sku" && e2 === "bodega"); })();
        if (cerca && sujetoDecl && cerca.nombre !== sujetoDecl && !sujetoDecl.includes(cerca.nombre) && !cerca.nombre.includes(sujetoDecl) && !comparten) out.push({ id: a.id, motivo: `declaracion-inconsistente: la cifra ${a.valor.texto} va junto a ${cerca.nombre} en la frase y la declaración dice ${a.sujeto}`, texto: a.texto });
        /* una referencia o un partitivo junto a la cuenta («sobre el nivel de 3,5%», «$25K de los $33K frenados») no es una cifra de la cuenta */
        const antesDeLaCifra = oracionN.slice(Math.max(0, p - 40), p);
        const referencia = /(?:\b(?:nivel|benchmark|referencia|umbral|techo|piso|contra|frente\s+a|vs\.?|sobre\s+el|bajo\s+el|encima\s+de|debajo\s+de|de\s+los|de\s+las|del\s+total|total\s+de|sobre)\s*(?:de\s+|del\s+|al\s+)?(?:(?:es|era|esta\s+en|se\s+fijo\s+en|queda\s+en|:)\s*)?|,\s*(?:de|del)\s+)$/.test(antesDeLaCifra);   // «, de $4.9M»: el todo del que la cifra anterior es parte
        if (cerca && !sujetoDecl && a.sujeto === "negocio" && !referencia) out.push({ id: a.id, motivo: `declaracion-inconsistente: la cifra ${a.valor.texto} va junto a ${cerca.nombre} en la frase y la declaración la atribuye al negocio`, texto: a.texto });
      }
    }
    if (entidades.length >= 2 && a.tipo === "relacion" && a.valor && a.valor.texto) {
      const figsV = parseFigures(String(a.valor.texto)).map((x) => ({ x, i: String(a.valor.texto).indexOf(x.text) })).sort((x, y) => x.i - y.i).map((x) => x.x);
      if (figsV.length === 2) {
        const pA = _posDeCifra(oracionN, { texto: figsV[0].text, raw: figsV[0].raw, unidad: figsV[0].unit }, fragN, sujetoDecl), pB = _posDeCifra(oracionN, { texto: figsV[1].text, raw: figsV[1].raw, unidad: figsV[1].unit }, fragN, vsDecl);
        const cA = pA >= 0 ? _masCercana(entidades, pA, pA + figsV[0].text.length, oracionN, ejeDe) : null, cB = pB >= 0 ? _masCercana(entidades, pB, pB + figsV[1].text.length, oracionN, ejeDe) : null;
        if (cA && sujetoDecl && cA.nombre !== sujetoDecl && !sujetoDecl.includes(cA.nombre)) out.push({ id: a.id, motivo: `declaracion-inconsistente: en la frase ${figsV[0].text} va junto a ${cA.nombre}, no a ${a.sujeto}`, texto: a.texto });
        if (cB && vsDecl && cB.nombre !== vsDecl && !vsDecl.includes(cB.nombre)) out.push({ id: a.id, motivo: `declaracion-inconsistente: en la frase ${figsV[1].text} va junto a ${cB.nombre}, no a ${a.relacion.vs.sujeto}`, texto: a.texto });
      }
    }
    /* (b) el sujeto de la cláusula no puede ser OTRA entidad del tenant que la declarada — sin ventana anterior ni atajo de comparación */
    if (sujetoDecl && nombresLimpios.length) {
      let c = null;
      try { c = leerClausula(oracion, Math.max(0, Math.min(oracion.length - 1, posOrig - ini)), { nombres: nombresLimpios }); } catch { c = null; }
      const alInicio = nombresLimpios.find((n) => fragN.startsWith(normalizar(n) + " "));
      const sujetoClausula = c && c.sujeto && c.sujeto.nombre ? normalizar(c.sujeto.nombre) : alInicio ? normalizar(alInicio) : null;
      const nombradoEnTexto = fragN.includes(sujetoDecl) || oracionN.includes(sujetoDecl);
      const esVs = vsDecl && sujetoClausula === vsDecl;
      /* «Falabella solo le gana en contribución no capturada ($1,6M contra $1,5M)»: la segunda cifra de un «A contra B» es del otro lado, que
       * puede venir nombrado en la oración anterior (la única ventana hacia atrás que queda) */
      const anterior = _dec(normalizar(s.slice(Math.max(0, ini - 220), ini))).replace(/\s+/g, " ");
      const segundoDeContra = a.tipo === "cifra" && a.valor && a.valor.texto && (() => { const m = /([$\d.,]+\s?(?:[kmb%]|pp|d[ií]as|d)?)\s+(?:contra|vs\.?|frente\s+a)\s+([$\d.,]+\s?(?:[kmb%]|pp|d[ií]as|d)?)/i.exec(oracionN); return !!m && _dec(normalizar(a.valor.texto)) === m[2].trim() && anterior.includes(sujetoDecl); })();
      if (segundoDeContra) { /* consistente: el otro lado implícito */ } else
      if (sujetoClausula && sujetoClausula !== sujetoDecl && !nombradoEnTexto && !esVs && !sujetoDecl.includes(sujetoClausula) && !sujetoClausula.includes(sujetoDecl)) {
        out.push({ id: a.id, motivo: `declaracion-inconsistente: la frase habla de ${c && c.sujeto && c.sujeto.nombre ? c.sujeto.nombre : alInicio} y la declaración dice ${a.sujeto}`, texto: a.texto });
      }
    }
    /* (c) la métrica: las palabras de métrica junto a la cifra, después las del fragmento, después las de la oración */
    /* una participación («Participación», «Peso en la venta», «% del total») nombra su base («el 54.6% de la venta»): no se contrasta por métrica */
    const esParticipacion = /participaci|peso\s+(?:en|de)\s+la|%\s+del\s+total|cuota|concentraci|acumulad/i.test(String(a.metrica || ""));
    if (a.metrica && !esParticipacion) {
      const recuperadoEnDinero = /\brecuper\w*\s*\(?\s*\$|\$[\d.,]+\s?[kmb]?\s+(?:de\s+)?(?:contribuci[oó]n\s+)?recuper\w*/i.test(fragN) && !/\brecuper\w*\s*\(?\s*[\d.,]+\s?%|\d[\d.,]*\s?%\s+recuper\w*/i.test(fragN);
      const limpia = (set) => [...set].filter((k) => k !== "participacion" && k !== "variacion" && !(k === "recuperado" && recuperadoEnDinero));
      /* el POSTFIJO de la cifra: «22,0% de carga comercial», «$4,6M vencidos», «269 días de atraso» — hasta 30 caracteres, sin cruzar una coma o un paréntesis */
      let postfijo = [], prefijo = [], junto = "", conceptoAntes = "", conceptoTras = "";   // el postfijo se lee CON la cifra: «58d de inventario» es cobertura, «$4,6M vencidos» es vencido
      if (a.valor && a.valor.texto) { const p = _posDeCifra(oracionN, a.valor, fragN, sujetoDecl); if (p >= 0) { const largo = _dec(normalizar(a.valor.texto)).length; const tras = oracionN.slice(p, p + largo + 30).split(_CORTE_JUNTO)[0] || ""; const antes = oracionN.slice(Math.max(0, p - 30), p).split(_CORTE_JUNTO).pop() || ""; postfijo = limpia(metricasEn(tras)); prefijo = limpia(metricasEn(antes)); junto = antes + " " + tras; conceptoAntes = (oracionN.slice(Math.max(0, p - 40), p).split(/[,;:()—·]|\d/).pop() || "").replace(/precio\s*[\/-]\s*costo/g, "precio y costo"); conceptoTras = (oracionN.slice(p + largo, p + largo + 45).split(/[,;:()—·]|\d|\s+con\s+|\b(?:uno?|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|veinti\w+|dieci\w+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien(?:to)?|medio|media)\b/)[0] || "").replace(/precio\s*[\/-]\s*costo/g, "precio y costo"); } }
      const enFrag = limpia(metricasEn(a.texto));
      /* un fragmento con VARIAS cifras («LG-DRYER8KG ($14K, 165 días de cobertura, rotación 1x)») reparte sus métricas entre ellas: solo cuentan las
       * palabras pegadas a la cifra declarada */
      const cifrasDelFragmento = _cifrasDe(a.texto).filter((c) => c.unit !== "count").length;   // «brecha de 5,9 puntos» también es una cifra
      const variasCifras = a.valor && a.valor.texto && cifrasDelFragmento >= 2;
      /* «Falabella la supera SOLO en contribución sin capturar» declara lo implicado en los otros ejes; «más severo en TODOS los ejes de mora» cubre
       * cada métrica del dominio; y un orden sin cifra sobre un fragmento con varias cifras («le sigue de cerca (251 días, 35% recuperado)») no se
       * juzga por métrica — su verdad la juzga el verificador */
      const implicado = (a.tipo === "orden" || a.tipo === "relacion") && (/\b(?:solo|s[oó]lo|[uú]nicamente|salvo|excepto)\s+(?:en|por)\b|\btodos?\s+los\s+ejes\b|\ben\s+todos?\b/.test(fragN) || (!(a.valor && a.valor.texto) && cifrasDelFragmento >= 2));
      const enFrase = implicado ? [] : [...new Set(variasCifras ? [...prefijo, ...postfijo] : [...enFrag, ...postfijo])];
      const propias = _PALABRAS_PROPIAS[normalizar(a.metrica).split(/\s*[:·]\s*/)[0].trim()] || conceptosDe(normalizar(a.metrica).split(/\s*[:·]\s*/)[0].trim()).map((c) => _PALABRAS_PROPIAS[c]).find(Boolean) || null;
      /* la frase que NOMBRA otro concepto de la casa («$1.6M de brecha por precio y costo» declarado como contribución no capturada; «$19.4M sin capturar»
       * declarado como venta) es inconsistente aunque comparta palabras del muro con la métrica declarada */
      let nombraOtro = false;
      { const cabeza0 = normalizar(a.metrica).split(/\s*[:·]\s*/)[0].trim(); const declC = new Set([cabeza0, ...conceptosDe(cabeza0)]); const nombrados = conceptosDe(cabeza0).length && a.valor && a.valor.texto ? [...new Set([..._conceptosNombrados(conceptoTras), ..._conceptosNombrados(conceptoAntes, true)])] : []; const compatibles = (nombrados.includes("capital inmovilizado") && declC.has("capital frenado")) || (nombrados.includes("capital frenado") && declC.has("capital inmovilizado"));   // frenado ⊂ inmovilizado: se nombran uno por otro
      if (nombrados.length && !compatibles && !nombrados.some((c) => declC.has(c))) { nombraOtro = true; out.push({ id: a.id, motivo: `declaracion-inconsistente: la frase «${a.texto.slice(0, 60)}» nombra «${nombrados[0]}» y la declaración dice «${a.metrica}»`, texto: a.texto }); } }
      if (!nombraOtro && enFrase.length && !(propias && (propias.test(fragN) || propias.test(junto)))) {
        const cabezaMetrica = normalizar(a.metrica).split(/\s*[:·]\s*/)[0].trim();
        const decl = new Set([...metricasEn(cabezaMetrica)].filter((k) => k !== "participacion"));
        for (const c of conceptosDe(cabezaMetrica)) { for (const k of metricasEn(c)) decl.add(k); for (const k of (_CLAVES_DEL_CONCEPTO[c] || [])) decl.add(k); }
        for (const k of (_CLAVES_DEL_CONCEPTO[cabezaMetrica] || [])) decl.add(k);
        const cruza = decl.size === 0 || enFrase.some((k) => decl.has(k)) || ((decl.has("variacion") || decl.has("ventas")) && _VERBO_DIRECCION.test(a.texto)) || (a.tipo === "variacion" && enFrase.every((k) => k === "ventas" || k === "variacion"));
        if (!cruza) out.push({ id: a.id, motivo: `declaracion-inconsistente: la frase «${a.texto.slice(0, 60)}» habla de ${enFrase.join("/")} y la declaración dice «${a.metrica}»`, texto: a.texto });
      }
    }
    /* (d) la dirección dicha en la prosa contra la declarada */
    if (a.tipo === "orden" && a.orden && /^(?:mayor|menor)$/.test(String(a.orden.direccion)) && !_SUP_INVERSO.test(fragN) && !/\b(?:no|ni|nunca|tampoco)\s+(?:es|era|fue|son|sea|resulta|queda)?\s*(?:el|la|los|las|quien)?\s*(?:que\s+)?(?:m[aá]s|menos|mayor|menor)/.test(fragN)) {
      const fragOrd = fragN.replace(/\bde\s+(?:mayor|menor|m[aá]s|menos)\s+a\s+(?:mayor|menor|m[aá]s|menos)\b/g, " ");   // «de mayor a menor» ordena la lista, no dice quién es el mayor
      const menos0 = _SUP_MENOS.test(fragOrd), mas0 = _SUP_MAS.test(fragOrd);
      const menos = menos0 && !mas0, mas = mas0 && !menos0;   // con las dos direcciones en el fragmento no se contrasta
      if ((a.orden.direccion === "mayor" && menos) || (a.orden.direccion === "menor" && mas)) out.push({ id: a.id, motivo: `declaracion-inconsistente: la frase dice «${a.texto.slice(0, 50)}» (${menos ? "el que menos" : "el que más"}) y la declaración pone dirección ${a.orden.direccion}`, texto: a.texto });
    }
    if (a.tipo === "relacion" && a.relacion && /^(?:mayor|menor)$/.test(String(a.relacion.forma))) {
      const menor = _CMP_MENOR.test(fragN), mayor = !menor && _CMP_MAYOR.test(fragN);
      if ((a.relacion.forma === "mayor" && menor) || (a.relacion.forma === "menor" && mayor)) out.push({ id: a.id, motivo: `declaracion-inconsistente: la frase compara «${a.texto.slice(0, 50)}» (${menor ? "menor" : "mayor"}) y la declaración pone forma ${a.relacion.forma}`, texto: a.texto });
      /* «X supera a Y»: el que va antes del comparador es el sujeto */
      if ((mayor || menor) && entidades.length >= 2 && sujetoDecl && vsDecl) {
        const m = (mayor ? _CMP_MAYOR : _CMP_MENOR).exec(oracionN);
        if (m) { const antes = entidades.filter((e) => e.fin <= m.index), despues = entidades.filter((e) => e.pos >= m.index + m[0].length); const eA = antes[antes.length - 1], eB = despues[0]; if (eA && eB && eA.nombre === vsDecl && eB.nombre === sujetoDecl) out.push({ id: a.id, motivo: `declaracion-inconsistente: en la frase ${eA.nombre} ${m[0]} ${eB.nombre}; la declaración pone los lados al revés`, texto: a.texto }); }
      }
    }
    /* la negación DENTRO del fragmento: «Lider no está bajo el benchmark» no es «menor»; «no es la que más vende» no es un orden; «no crece» no es
     * «sube» (la negación de la dirección contraria —«no cae» declarado sube— sí es compatible) */
    {
      const fragLimpio = fragN.replace(/\b(?:que|quienes|donde|cuando)\s+(?:no|ni|sin)\b[^,]*/g, "").replace(/\bno\s+captur\w*/g, "").replace(/\bsin\s+(?:venta|vencid\w*|saldo|mora|capturar)\b/g, "");
      const mNeg = /\b(?:no|ni|nunca|jam[aá]s|tampoco|ya\s+no)\s+(?:(?:est[aá]n?|es|son|era|eran|fue|queda|quedan|llega|llegan|tiene|tienen|se|le|les|lo|la|los|las)\s+){0,3}([a-záéíóúñ]+(?:\s+(?:el|la|los|las|de|del|al|a|en|que)\s+[a-záéíóúñ]+){0,3})/.exec(fragLimpio);
      if (mNeg && a.tipo !== "cifra") {
        const negado = mNeg[1];
        if (a.tipo === "relacion" && a.relacion && /^(?:mayor|menor)$/.test(String(a.relacion.forma))) {
          const dirNeg = /\b(?:bajo|debajo|menor|menos|inferior)\b/.test(negado) ? "menor" : /\b(?:sobre|encima|mayor|m[aá]s|supera|superior|arriba)\b/.test(negado) ? "mayor" : null;
          if (dirNeg && dirNeg === a.relacion.forma) out.push({ id: a.id, motivo: `declaracion-inconsistente: la frase niega «${negado.slice(0, 40)}» y la declaración pone forma ${a.relacion.forma}`, texto: a.texto });
        }
        if (a.tipo === "orden" && a.orden && (_SUP_MAS.test(negado) || _SUP_MENOS.test(negado) || /\b(?:primer|[uú]ltim|encabeza|lidera|cierra)/.test(negado))) out.push({ id: a.id, motivo: `declaracion-inconsistente: la frase niega el orden («no ${negado.slice(0, 40)}») y la declaración lo afirma`, texto: a.texto });
        if (a.tipo === "variacion" && a.variacion && /^(?:sube|baja)$/.test(String(a.variacion.direccion))) {
          const dirNeg = _VAR_BAJA.test(negado) ? "baja" : _VAR_SUBE.test(negado) ? "sube" : null;
          if (dirNeg && dirNeg === a.variacion.direccion) out.push({ id: a.id, motivo: `declaracion-inconsistente: la frase niega «${negado.slice(0, 40)}» y la declaración pone dirección ${a.variacion.direccion}`, texto: a.texto });
        }
        if (a.tipo === "estado" && a.estado && a.estado.estado && /inmoviliz|deten|parad|frenad|sobrestock|quiebre|san[oa]|cr[ií]tic/.test(negado)) out.push({ id: a.id, motivo: `declaracion-inconsistente: la frase niega el estado («no ${negado.slice(0, 40)}») y la declaración lo afirma`, texto: a.texto });
      }
    }
    if (a.tipo === "variacion" && a.variacion && /^(?:sube|baja)$/.test(String(a.variacion.direccion))) {
      const negV = /\b(?:no|ni|nunca|tampoco|ya\s+no)\s+(?:se\s+|te\s+|le\s+|les\s+|nos\s+)?(?:est[aá]n?\s+|viene\s+|vienen\s+|sigue\s+|siguen\s+|va\s+|van\s+|parece\s+|parecen\s+|puede\s+|pueden\s+|ha\s+|han\s+)?[a-záéíóúñ]+/.exec(fragN);
      const fragSinNeg = negV ? fragN.replace(negV[0], " ") : fragN;   // el verbo negado no dice la dirección afirmada
      const baja0 = _VAR_BAJA.test(fragSinNeg), sube0 = _VAR_SUBE.test(fragSinNeg);
      const baja = baja0 && !sube0, sube = sube0 && !baja0;   // «Lider sube, Ripley cae» en un solo fragmento: no se contrasta
      if ((a.variacion.direccion === "sube" && baja) || (a.variacion.direccion === "baja" && sube)) out.push({ id: a.id, motivo: `declaracion-inconsistente: la frase dice «${a.texto.slice(0, 50)}» (${baja ? "baja" : "sube"}) y la declaración pone dirección ${a.variacion.direccion}`, texto: a.texto });
    }
    if (a.tipo === "estado" && a.estado && a.estado.estado) {
      const dicho = estadoCanon(a.estado.estado);
      const enFrag = [...new Set([...fragN.matchAll(/inmoviliz\w*|deten\w*|parad\w*|frenad\w*|sobrestock|quiebre|san[oa]s?\b|cr[ií]tic\w*/g)].map((m) => estadoCanon(m[0])))].filter((e) => _ESTADOS_CANON.has(e));
      if (enFrag.length && !enFrag.some((e) => _ESTADOS_COMPATIBLES(dicho, e))) out.push({ id: a.id, motivo: `declaracion-inconsistente: la frase dice «${enFrag.join("/")}» y la declaración pone el estado «${a.estado.estado}»`, texto: a.texto });
    }
    if (a.tipo === "conteo" && a.conteo && a.conteo.predicado) {
      const pred = normalizar(a.conteo.predicado);
      /* «sobre el benchmark» contra «bajo el benchmark» chocan; «bajo el benchmark» (el universo) y «sobre el nivel» (el predicado) no */
      const dirs = (t) => [...t.matchAll(/\b(sobre|encima|superan?|bajo|debajo)\b[^.]{0,12}?\b(benchmark|nivel|umbral|referencia|piso|techo)\b/g)].map((m) => ({ dir: /^(?:sobre|encima|super)/.test(m[1]) ? "sobre" : "bajo", ref: m[2] === "referencia" ? "nivel" : m[2] }));
      const choque = dirs(fragN).some((x) => dirs(pred).some((y) => x.ref === y.ref && x.dir !== y.dir));
      if (choque) out.push({ id: a.id, motivo: `declaracion-inconsistente: la frase cuenta «${a.texto.slice(0, 50)}» y el predicado declarado es «${a.conteo.predicado}»`, texto: a.texto });
    }
    /* (f) la negación o la distancia sobre el hecho declarado */
    if (a.tipo === "cifra" || a.tipo === "variacion" || a.tipo === "orden" || a.tipo === "estado") {
      const p = a.valor && a.valor.texto ? _posDeCifra(oracionN, a.valor, fragN, sujetoDecl) : oracionN.indexOf(fragN.slice(0, 30));
      const desde = p >= 0 ? p : 0;
      const clausula = oracionN.slice(0, desde).split(/[,;:—()·]/).pop() || "";
      const limpia = clausula.replace(/\b(?:que|quienes|donde|cuando)\s+(?:no|ni|sin)\b[^,]*/g, "").replace(/\bno\s+captur\w*/g, "").replace(/\bsin\s+(?:venta|vencid\w*|saldo|mora|capturar)\b/g, "");
      const articulo = /(?:^|[^a-z])(?:los|las|el|la|es[oa]s?|est[oa]s?)\s*$/.test(limpia);
      const negadaAntes = !articulo && _NEG_CLAUSULA.test(limpia) && !/\b(?:nadie|ning[uú]n[ao]?)\b[^.]{0,30}$/.test(limpia);
      const trasCifra = p >= 0 ? oracionN.slice(p + String((a.valor && a.valor.texto) || "").length, p + 60) : "";
      const trasLimpio = trasCifra.replace(/^(\s*)no\s+(?:captur|cobrad|recuperad|vendid|facturad|abonad|pagad)\w*/, "$1");
      const negadaDespues = a.tipo === "cifra" && /^\s*(?:,\s*)?(?:[a-záéíóúñ]+\s+){0,3}(?:(?:pero\s+)?(?:bastante|mucho)\s+menos\b|(?:no|ni)\s+(?:es|son|era|fue|corresponde|llega|alcanza|refleja|representa|coincide|cierra|cuadra|aplica)\b(?!\s+(?:poc[oa]|menor|trivial|casual|cualquier|nada|un\s+detalle|broma|para\s+menos|de\s+extra[ñn]ar|raro|sorpresa|novedad|poca\s+cosa|ninguna|ning[uú]n))|^\s*(?:no|ni)\b)/.test(trasLimpio);
      if (negadaAntes || negadaDespues) out.push({ id: a.id, motivo: `declaracion-inconsistente: la frase niega o aleja lo declarado («${limpia.slice(-40).trim()}${negadaDespues ? " … " + trasCifra.slice(0, 20).trim() : ""}»)`, texto: a.texto });
    }
  }
  return out;
}
/* ── LA ASISTENCIA DE IDENTIDAD (fase 4, etapa B · owner 2026-09-16: «que todo hecho relevante que se diga quede cubierto por el Notario») ──
 * La casa declara por el modelo SOLO lo mecánico: una cifra de la prosa sin declarar cuyo canon existe en UNA sola fig de la evidencia
 * (con dueño o del negocio), o una cifra que cae dentro de una afirmación declarada de otro tipo con UN sujeto y UNA métrica (hereda
 * ambos). La afirmación asistida pasa por el mismo verificador (tiene que salir VERDADERA) y por la misma consistencia (el sujeto y la
 * métrica de la oración no pueden contradecirla); si no, no se asiste y la omisión queda para el modelo. Lo semántico —órdenes,
 * relaciones, conteos, variaciones, estados, grupos— jamás se asiste. */
const _ASISTIBLES = new Set(["cifra", "significado-no-declarado:cifra"]);
function _oracionCon(s, pos, fin) {
  const ini = Math.max(s.lastIndexOf(". ", pos), s.lastIndexOf("\n", pos), 0);
  let f = s.indexOf(". ", fin); if (f < 0) f = s.length;
  let o = s.slice(ini, f).replace(/^[.\s]+/, "").trim();
  if (o.length > 80) { const c = pos - ini; const a = Math.max(0, Math.min(c - 40, o.length - 80)); o = o.slice(a, a + 80).trim(); }
  return o;
}
function asistirIdentidad(s, declaradas, omisionesLista, ctxVerif, nombres) {
  const puntos = puntosDeAfirmacion(s);
  const I = ctxVerif.indice || null;
  const figs = I ? I.figs : [];
  const vistos = new Set();
  const candidatas = [];
  for (const o of omisionesLista) {
    if (!_ASISTIBLES.has(o.clase)) continue;
    const p = puntos.find((x) => x.pos === o.pos && x.clase === "cifra");
    if (!p || p.suelto || p.negado || !p.canon) continue;
    const span = menosAscii(p.span).trim();
    const texto = _oracionCon(s, p.pos, p.fin);
    let a = null, via = "";
    /* (1) la evidencia identifica la cifra: una sola fig con ese canon */
    { const mismas = figs.filter((g) => g.canon && String(g.canon).replace(/\$/g, "") === p.canon); const labels = [...new Set(mismas.map((g) => g.label))]; if (labels.length === 1) { const g = mismas[0]; a = { tipo: "cifra", sujeto: g.entidad || "negocio", metrica: g.concepto, valor: span, texto }; via = `una sola fig con ese canon: ${g.label}`; } }
    /* (2) dentro de una afirmación de otro tipo con un solo sujeto y una métrica: hereda ambos */
    if (!a && o.clase === "significado-no-declarado:cifra") {
      /* dentro de una RELACIÓN «A contra B» con dos valores: la cifra que coincide con B es del otro lado (relacion.vs), la de A del sujeto */
      for (const d of declaradas) {
        if (!d || String(d.tipo).toLowerCase() !== "relacion" || !d.texto || typeof d.sujeto !== "string" || !d.metrica || !d.relacion) continue;
        const u = ubicarFragmento(s, d.texto, { nombres }); if (!u || p.pos < u.ini || p.fin > u.fin) continue;
        const vt = menosAscii(String(d.valor || ""));
        const figsV = parseFigures(vt).map((x) => ({ x, i: vt.indexOf(x.text) })).sort((x, y) => x.i - y.i).map((x) => x.x);
        if (figsV.length !== 2) continue;
        const vs = typeof d.relacion.vs === "string" ? d.relacion.vs : d.relacion.vs && typeof d.relacion.vs === "object" && typeof d.relacion.vs.sujeto === "string" ? d.relacion.vs.sujeto : null;
        const metricaVs = d.relacion.vs && typeof d.relacion.vs === "object" && d.relacion.vs.metrica ? d.relacion.vs.metrica : d.metrica;
        if (figsV[1].canon.replace(/\$/g, "") === p.canon && vs) { a = { tipo: "cifra", sujeto: vs, metrica: metricaVs, valor: span, texto }; via = "el otro lado de la relación que la contiene (segunda cifra del valor)"; break; }
        if (figsV[0].canon.replace(/\$/g, "") === p.canon) { a = { tipo: "cifra", sujeto: d.sujeto, metrica: d.metrica, valor: span, texto }; via = "el sujeto de la relación que la contiene (primera cifra del valor)"; break; }
      }
    }
    if (!a && o.clase === "significado-no-declarado:cifra") {
      /* dentro de una afirmación de otro tipo con un solo sujeto y una métrica: hereda ambos */
      const dueña = declaradas.filter((d) => d && d.texto && FACTUALES.has(String(d.tipo).toLowerCase()) && String(d.tipo).toLowerCase() !== "cifra" && String(d.tipo).toLowerCase() !== "relacion" && typeof d.sujeto === "string" && d.metrica && (() => { const u = ubicarFragmento(s, d.texto, { nombres }); return u && p.pos >= u.ini && p.fin <= u.fin; })());
      const sujetos = [...new Set(dueña.map((d) => d.sujeto))], metricas = [...new Set(dueña.map((d) => d.metrica))];
      if (sujetos.length === 1 && metricas.length === 1) { a = { tipo: "cifra", sujeto: sujetos[0], metrica: metricas[0], valor: span, texto }; via = `hereda sujeto y métrica de la afirmación (${String(dueña[0].tipo)}) que la contiene`; }
    }
    if (!a) continue;
    const clave = `${a.sujeto}|${a.metrica}|${p.canon}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    candidatas.push({ ...a, _asistida: via });
  }
  if (!candidatas.length) return { nuevas: [], asistidas: [], veredictos: [] };
  /* el mismo verificador y la misma consistencia que para el modelo: solo entra lo VERDADERO y consistente */
  const R = verificarAfirmaciones(candidatas, ctxVerif);
  const canonicas = Array.isArray(R.afirmaciones) ? R.afirmaciones : candidatas;
  const nuevas = [], asistidas = [], veredictos = [];
  canonicas.forEach((a, i) => {
    const v = R.veredictos[i];
    if (!v || v.veredicto !== "verdadera") return;
    const inc = consistencia(s, [a], { nombres, ejeDe: (n) => { try { const r = I && typeof I.resolverEntidad === "function" ? I.resolverEntidad(n) : null; return r ? r.eje : null; } catch { return null; } } });
    if (inc.length) return;
    nuevas.push(a); veredictos.push(v);
    asistidas.push({ valor: a.valor && typeof a.valor === "object" ? a.valor.texto : a.valor, sujeto: typeof a.sujeto === "string" ? a.sujeto : "", metrica: a.metrica, via: a._asistida || "", evidencia: v.evidencia });
  });
  return { nuevas, asistidas, veredictos };
}

/** juzgarDeclaracion(prosa, afirmaciones, ctx) → { ok, violations: [{kind, detail, texto}], veredictos, omisiones, medidas }
 *  ctx: { indice | figs+datoProyectado+ejesDelTenant, nombres: [entidades del tenant], sitio, derivada: bool } */
export function juzgarDeclaracion(prosa, afirmaciones, ctx = {}) {
  /* el bloque [[CALCULO]] es una declaración para el muro, no prosa: no se le buscan afirmaciones (sus resultados autorizados llegan en ctx.calculos) */
  const s = extraerCalculos(String(prosa || "")).limpio;
  const violations = [];
  const nombres = Array.isArray(ctx.nombres) ? ctx.nombres : [];
  const puntos = puntosDeAfirmacion(s);
  const afirmados = puntos.filter((p) => !p.negado).length;
  /* 4 · sin declaración: solo cuenta si la prosa afirma algo */
  if (afirmaciones == null) {
    const medidas = { declaradas: 0, factuales: 0, verdaderas: 0, falsas: 0, noVerificables: 0, selladas: 0, inconsistentes: 0, puntos: afirmados, cubiertos: 0, omitidos: afirmados, sinDeclaracion: true };
    if (!afirmados) return { ok: true, violations: [], veredictos: [], omisiones: [], medidas };
    violations.push({ kind: "sin-declaracion", detail: `sin-declaracion: tu respuesta afirma hechos (${afirmados} cifras, órdenes o relaciones) y no trae el bloque <<AFIRMACIONES>> … <<FIN>>: declara cada afirmación de hecho con su tipo, sujeto, métrica, valor/orden, universo y período, y su fragmento literal.`, texto: "" });
    return { ok: false, violations, veredictos: [], omisiones: [], medidas };
  }
  /* 1 · veredictos — y la forma canónica (fase 4): el verificador resuelve la forma y devuelve la lista con la que se juzga todo lo demás */
  const { veredictos, resumen, afirmaciones: canonicas } = verificarAfirmaciones(afirmaciones, { ...(ctx.indice ? { indice: ctx.indice } : { figs: ctx.figs, datoProyectado: ctx.datoProyectado, ejesDelTenant: ctx.ejesDelTenant }), calculos: Array.isArray(ctx.calculos) ? ctx.calculos : [] });
  const declaradas = Array.isArray(canonicas) ? canonicas : afirmaciones;
  /* 2 · consistencia (lo derivado de las figs por el propio peldaño no se contrasta consigo mismo) */
  const ejeDe = (n) => { try { const I = ctx.indice; const r = I && typeof I.resolverEntidad === "function" ? I.resolverEntidad(n) : null; return r ? r.eje : null; } catch { return null; } };
  const incons = ctx.derivada ? [] : consistencia(s, declaradas, { nombres, ejeDe });
  for (const x of incons) violations.push({ kind: /ajena/.test(x.motivo) ? "declaracion-ajena" : "declaracion-inconsistente", detail: x.motivo, texto: x.texto, id: x.id });
  for (const v of veredictos) {
    if (v.veredicto === "falsa") violations.push({ kind: "afirmacion-falsa", detail: `afirmacion-falsa: declaraste «${v.texto.slice(0, 70)}» (${_resumenDe(v, declaradas)}) y es FALSA: ${v.motivo}${v.verdad ? ` · La boleta: ${v.verdad}` : ""}. Corrige esa frase con la cifra o el orden de la boleta, o quítala.`, texto: v.texto, id: v.id });
    else if (v.veredicto === "no-verificable") violations.push({ kind: /lectura-encubre-hecho/.test(v.motivo) ? "lectura-encubre-hecho" : "afirmacion-no-verificable", detail: /lectura-encubre-hecho/.test(v.motivo) ? `${v.motivo}.` : `afirmacion-no-verificable: «${v.texto.slice(0, 70)}» no se puede verificar: ${v.motivo}. Sin evidencia en tus resultados no se sirve: quítala, o dila como lectura con sello y sin la cifra ni el orden.`, texto: v.texto, id: v.id });
  }
  /* 3 · omisiones (sobre la lista canónica: un grupo partido en cifras cubre cada cifra) — y la asistencia de identidad, si el sitio la
   *     admite (ctx.asistir): lo mecánico lo declara la casa, verificado y consistente; lo semántico queda como omisión para el modelo */
  let O = omisiones(s, declaradas, { nombres });
  let asistidas = [];
  let todasLasDeclaradas = declaradas;
  if (ctx.asistir && !ctx.derivada && O.omisiones.length) {
    const A = asistirIdentidad(s, declaradas, O.omisiones, { ...(ctx.indice ? { indice: ctx.indice } : { figs: ctx.figs, datoProyectado: ctx.datoProyectado, ejesDelTenant: ctx.ejesDelTenant }), calculos: Array.isArray(ctx.calculos) ? ctx.calculos : [] }, nombres);
    if (A.nuevas.length) {
      todasLasDeclaradas = [...declaradas, ...A.nuevas.map((a, k) => ({ ...a, id: a.id || `asistida${k + 1}` }))];
      asistidas = A.asistidas;
      for (const v of A.veredictos) veredictos.push({ ...v, asistida: true });
      O = omisiones(s, todasLasDeclaradas, { nombres });
    }
  }
  for (const o of O.omisiones) violations.push({ kind: "afirmacion-no-declarada", detail: `afirmacion-no-declarada: «${o.span}» ${o.clase.startsWith("hecho-como-lectura") ? "está declarado solo como lectura y es un hecho" : o.clase.startsWith("significado") ? `es ${o.clase.split(":")[1]} y no está declarado como tal` : "no está declarado"}: decláralo (con su tipo, sujeto, métrica, universo y período) o quítalo.`, texto: o.span, clase: o.clase });
  const medidas = {
    declaradas: veredictos.length, factuales: veredictos.filter((v) => FACTUALES.has(v.tipo)).length,
    verdaderas: resumen.verdaderas + asistidas.length, falsas: resumen.falsas, noVerificables: resumen.noVerificables, selladas: resumen.selladas,
    inconsistentes: incons.length, puntos: O.afirmados, cubiertos: O.cubiertos, omitidos: O.omisiones.length, sinDeclaracion: false, derivada: !!ctx.derivada,
    asistidas: asistidas.length,
  };
  return { ok: violations.length === 0, violations, veredictos, omisiones: O.omisiones, medidas, afirmaciones: todasLasDeclaradas, asistidas };
}

function _resumenDe(v, afirmaciones) {
  const a = (Array.isArray(afirmaciones) ? afirmaciones : []).find((x, i) => String(x.id || `a${i + 1}`) === v.id) || {};
  if (v.resuelta && v.resuelta.length) return _resumenBase(a, v) + ` · resuelta: ${v.resuelta.join("; ")}`;
  return _resumenBase(a, v);
}
function _resumenBase(a, v) {
  const s = Array.isArray(a.sujeto) ? a.sujeto.join(", ") : a.sujeto && typeof a.sujeto === "object" ? a.sujeto.descripcion : a.sujeto;
  return [v.tipo, s, a.metrica, a.valor && (typeof a.valor === "object" ? a.valor.texto : a.valor), a.orden && `orden ${a.orden.forma}${a.orden.k ? " " + a.orden.k : ""}${a.orden.vs ? " vs " + a.orden.vs : ""}`, a.universo].filter(Boolean).join(" · ");
}

/** los kinds del muro que el verificador REEMPLAZA (quedan como detectores; no dictan veredicto) */
export const CHEQUEOS_DE_HECHO = new Set([
  "cifra-no-autorizada", "cifra-de-boleta-sin-dueno", "cifra-de-dato-sin-dueno", "cifra-calculada-mal-atribuida", "calculo-no-verificable",
  "entidad-mal-atribuida", "metrica-mal-atribuida", "total-mal-atribuido", "total-sin-declarar", "total-no-reconcilia", "alcance-promovido",
  "superlativo-no-sostenido", "ranking-no-sostenido", "ranking-sin-cola", "extremo-sin-sustento", "comparacion-no-sostenida", "relacion-contradictoria",
  "estado-no-declarado", "conteo-no-autorizado", "conteo-de-lista-falso", "cifra-de-grupo-mal-repartida", "nivel-financiero-no-autorizado", "temporal-sin-variacion",
  /* del contrato del agente */
  "atributo-mal-asociado", "relacion-en-palabras-no-cierra", "subtotal-de-otro-universo", "variacion-no-medida", "cuenta-derivada-no-cierra",
]);
