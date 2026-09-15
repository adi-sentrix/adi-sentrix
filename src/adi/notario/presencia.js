/* === src/adi/notario/presencia.js · EL DETECTOR DE PRESENCIA: LO QUE LA PROSA AFIRMA Y NO FUE DECLARADO (fase 1 · owner 2026-09-15) ═
 * «Una afirmación relevante omitida debe detectarse y medirse.» El verificador (verificar.js) solo juzga lo DECLARADO; la puerta a mentir
 * por omisión la cierra este detector: recorre la prosa buscando PUNTOS DE AFIRMACIÓN —una cifra, un marcador de orden, una relación en
 * palabras, un grupo o conteo, un verbo de variación, un estado— y exige que cada punto quede cubierto por una afirmación declarada del
 * tipo que corresponde a su significado. Lo no cubierto es una OMISIÓN, con su clase, y se mide.
 *
 * Es el papel nuevo de los chequeos viejos del Notario: acá solo importa el RECALL (encontrar que hay algo que afirmar); la imprecisión de
 * leer la prosa no cuesta un veto, cuesta pedirle al modelo «declara o quita». Por eso las reglas son simples y amplias.
 *
 * Dos matices para no fabricar omisiones: (1) un punto bajo NEGACIÓN («no hay serie para decir si el margen cae», «sin evidencia de que
 * crezca») no es una afirmación de hecho — se marca `negado` y no cuenta como omisión; (2) una cifra queda cubierta también si alguna
 * afirmación la declara como valor (mismo canon), aunque el fragmento declarado no la envuelva.
 * Y el candado del owner: una LECTURA nunca cubre un punto de hecho («lectura no puede usarse para transformar un hecho verificable en
 * opinión»): un hecho declarado solo como lectura es una omisión de clase `hecho-como-lectura`.
 * Puro: sin I/O, sin dato. */
import { parseFigures } from "../boleta.js";
import { metricasEn } from "../oracle/guardC.js";
import { normalizar, normalizarAfirmaciones } from "./afirmacion.js";

/* una RECOMENDACIÓN («resolvería LG-DRYER8KG primero», «yo miraría primero a Lider») ordena acciones, no entidades en una métrica */
const _RECOMIENDA = /\b(?:yo|resolver[ií]a|mirar[ií]a|atacar[ií]a|priorizar[ií]a|empezar[ií]a|ir[ií]a|cerrar[ií]a|negociar[ií]a|liberar[ií]a|cobrar[ií]a|revisar[ií]a|recomiendo|sugiero|conviene|deber[ií]a|habr[ií]a\s+que|hay\s+que|lo\s+primero|primero\s+(?:a|con|por|hay)|prioridad|ir\s+primero|van?\s+primero|raz[oó]n\s+de\s+ir|pondr[ií]a|pondr[eé]|el\s+foco)\b/i;
const _NEGACION = /\b(?:no|sin|ni|nada|ning[uú]n[oa]?|tampoco|imposible|no\s+hay|no\s+se\s+puede|no\s+puedo|no\s+podemos|no\s+sabemos|no\s+permite|no\s+alcanza\s+para|antes\s+de\s+decir|para\s+decir\s+si)\b/i;
const _ORDEN_RE = /\b(?:(?:el|la|los|las|quien|quienes)\s+(?:[a-záéíóúñ0-9]+\s+){0,2}que\s+(?:[a-záéíóúñ]+\s+)?(?:m[aá]s|menos)\b|(?:es|son|est[aá]n?|queda|quedan)\s+(?:m[aá]s|menos)\s+que\b|(?:el|la|los|las|quien|quienes)\s+(?:m[aá]s|menos)\b|m[aá]s\s+(?:alt[oa]s?|baj[oa]s?|grandes?|pequeñ[oa]s?|graves?|pesad[oa]s?|caros?|barat[oa]s?|lent[oa]s?|r[aá]pid[oa]s?|larg[oa]s?|cort[oa]s?|fuertes?|d[eé]bil(?:es)?|deteriorad[oa]s?|comprometid[oa]s?|delicad[oa]s?|urgentes?|leves?|severa?s?|profund[oa]s?)|(?:vende|aporta|debe|acumula|contribuye|factura|margina|rota|pesa|concentra|tiene|compra|mueve|deja|arrastra)\s+(?:m[aá]s|menos)\s+[a-záéíóúñ]+(?!\s+que)|(?:mayor|menor|peor|mejor)(?:es)?\b|con\s+(?:m[aá]s|menos)\s+[a-záéíóúñ]+|m[aá]s\s+(?:delgad[oa]s?|lejos|cerca|arriba|abajo|pegad[oa]s?)|(?:m[aá]s|menos)\s+[a-záéíóúñ]+\s+que\s+[A-ZÁÉÍÓÚ][a-záéíóúñ]*|(?:vende|aporta|debe|acumula|contribuye|factura|margina|rota|pesa|concentra|tiene|compra|mueve)\s+(?:m[aá]s|menos)\s+que\b|primer[oa]?s?\b|segund[oa]s?\b|tercer[oa]?s?\b|cuart[oa]s?\b|quint[oa]s?\b|sext[oa]s?\b|s[eé]ptim[oa]s?\b|octav[oa]s?\b|noven[oa]s?\b|d[eé]cim[oa]s?\b|[uú]ltim[oa]s?\b|encabeza|lidera\b|se\s+lleva\s+la\s+palma|por\s+delante\s+de|por\s+encima\s+de|por\s+debajo\s+de|supera\s+(?:al?|en)\b|superan\s+(?:al?|en)\b|nadie\s+(?:supera|vende|aporta|debe|acumula|tiene)|ning[uú]n[ao]?\s+[a-záéíóúñ]+\s+(?:supera|vende|aporta|debe|acumula|tiene|llega)|top\s*\d|ranking|en\s+este\s+orden|el\s+orden\s+(?:es|queda)|por\s+orden\s+de|de\s+mayor\s+a\s+menor|de\s+menor\s+a\s+mayor|concentra\s+el\s+mayor|la\s+mayor\s+parte|a\s+la\s+cabeza|al\s+frente|en\s+la\s+cola|cierra\s+la\s+lista|solo\s+detr[aá]s\s+de|detr[aá]s\s+de)\b/gi;
const _RELACION_RE = /(?:\b|(?=[$\d]))(?:(?:el|al|del)\s+doble|dobla|duplica|triplica|cuadruplica|(?:el\s+|del\s+)?triple|(?:la\s+)?mitad|(?:un\s+)?tercio|(?:un\s+)?cuarto\s+de|(?:\d+(?:[.,]\d+)?|dos|tres|cuatro|cinco|seis|diez)\s*(?:veces|x)\b|(?:de|De)\s+cada\s+(?:\d+|dos|tres|cuatro|cinco|diez)\b|casi\s+(?:igual|tanto|lo\s+mismo)|igual\s+que|tanto\s+como|equivale\s+a|\d+(?:[.,]\d+)?\s?%\s+(?:de|del)\s+(?:la|el|los|las|su|sus|ese|esa|toda|todo|lo)\b|(?:m[aá]s|menos)\s+que\s+[A-ZÁÉÍÓÚ]|[$\d][\d.,]*\s?(?:[KMB%]|pp|d[ií]as|d)?\s+contra\s+\$?[\d.,]+|(?:bajo|sobre|por\s+encima\s+de|por\s+debajo\s+de|lejos\s+de|cerca\s+de)l?\s+(?:el\s+|la\s+)?(?:benchmark|referencia|piso|nivel))/g;
const _GRUPO_RE = /\b(?:(?:\d+|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece)\s+(?:de\s+(?:las?|los|esas?|esos|ellas|ellos)\s+)?(?:\d+\s+)?(?:cuentas?|clientes?|skus?|sku|bodegas?|marcas?|familias?|referencias?|productos?)\b|\d+\s+de\s+(?:las?\s+|los\s+)?\d+\b|entre\s+(?:las|los)\s+(?:\d+|dos|tres|cuatro|cinco)\b|(?:las|los)\s+(?:dos|tres|cuatro|cinco|seis|ocho)\s+(?:grandes|cuentas|clientes|sku|skus|que|más|mayores|motores|primer[oa]s|restantes)\b|ese\s+(?:mismo\s+)?grupo|en\s+conjunto|entre\s+(?:ambas|ambos|las\s+dos|los\s+dos|las\s+tres|los\s+tres)|(?:suman|totalizan|acumulan)\s+(?:entre\s+)?(?:las|los|ambas|ambos|un|el|la)?)/gi;
const _VARIACION_RE = /\b(?:crec(?:e|en|i[oó]|ieron|iendo)|ca(?:e|en|y[oó]|yeron|yendo)|sub(?:e|en|i[oó]|ieron|iendo)|baj(?:a|an|ó|aron|ando)(?![a-záéíóúñ])|se\s+deterior(?:a|an|[oó]|aron)|mejor(?:a|an|[oó]|aron)|empeor(?:a|an|[oó]|aron)|retroced(?:e|en|i[oó]|ieron)|avanz(?:a|an|[oó]|aron)|aument(?:a|an|[oó]|aron)|disminu(?:ye|yen|y[oó]|yeron)|descend(?:i[oó]|ieron)|se\s+redu(?:jo|jeron|ce|cen)|se\s+contra(?:jo|jeron|e|en)|se\s+desplom(?:a|an|[oó]|aron)|repunt(?:a|an|[oó]|aron)|(?:vend(?:e|es|en|iendo|emos|i[oó]|ieron)|factur(?:a|an|ando|[oó]))\s+m[aá]s(?!\s+(?:que|de\b|del\b|unidades|a\b|en\b))|variaci[oó]n|YoY|interanual|respecto\s+(?:al|del)\s+a[ñn]o|vs\.?\s+a[ñn]o|a[ñn]o\s+anterior|a[ñn]o\s+pasado|dólares\s+nuevos|pierde\s+\$|gana\s+\$)(?![a-záéíóúñ])/gi;
const _ESTADO_RE = /(?<!capital\s)(?<!del\s)(?<!el\s)(?<!de\s)\b(?:inmoviliz[a-záéíóúñ]*|frenad[oa]s?|detenid[oa]s?|parad[oa]s?|bloquead[oa]s?|estancad[oa]s?|sobrestock|sobre\s+stock|riesgo\s+de\s+quiebre|capital\s+sano|sin\s+venta|sin\s+movimiento|sin\s+(?:saldo\s+)?vencido|sin\s+mora|por\s+vencer)\b/gi;
const _UNIDADES_RE = /\b(\d{1,3}(?:[.,]\d{3})+|\d+)\s+(?:unidades|cuentas|clientes|skus?|bodegas|marcas)\b/gi;

const _CLASES = ["cifra", "orden", "relacion", "grupo", "variacion", "estado"];
/* qué tipos declarados cubren cada clase de punto (una lectura no cubre hechos) */
const _CUBRE = {
  cifra: new Set(["cifra", "grupo", "conteo", "variacion", "relacion", "orden"]),
  orden: new Set(["orden", "relacion"]),
  relacion: new Set(["relacion", "grupo", "cifra", "conteo", "orden"]),   // «bajo el benchmark» dentro de un conteo o un grupo es su predicado
  grupo: new Set(["grupo", "conteo", "cifra", "orden"]),
  variacion: new Set(["variacion", "grupo", "conteo"]),   // «los que caen» es el papel de la casa: un grupo o un conteo lo declara
  estado: new Set(["estado", "conteo", "cifra"]),
};

/* la negación que cuenta es la de la cláusula del punto; NO cuentan: la de una subordinada relativa («los que no llegan al benchmark son 8»),
 * el nombre de una métrica («contribución no capturada»), ni una negación universal que en realidad es un superlativo («nadie vende más
 * que Falabella», «ninguna cuenta supera a Jumbo») */
function _negado(s, pos) {
  const antes = s.slice(Math.max(0, pos - 60), pos);
  const clausula = (antes.split(/[.;:—()]/).pop() || "").replace(/\b(?:que|quienes|donde|cuando)\s+(?:no|ni|sin)\b[^,]*/gi, "").replace(/\bno\s+captur[a-záéíóúñ]*/gi, "");
  if (/\b(?:nadie|ning[uú]n[ao]?)\b[^.]{0,30}$/i.test(clausula)) return false;
  return _NEGACION.test(clausula);
}
const _PALABRA_NUM = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20 };
/* un número pelado o en palabras es una cifra cuando la oración lo ata a algo contable o medible («llegan a 190», «son 8 de 13», «son cinco de ocho») */
const _NUMERO_SUELTO_RE = /(?<![\d.,$%\w-])(\d{1,3}(?:\.\d{3})+|\d+)(?![\d.,]*\s*(?:%|pp|d\b|x\b|M\b|K\b|d[ií]as?\b|unidades\b|cuentas?\b|clientes?\b|skus?\b|bodegas?\b|marcas?\b|puntos?\b|veces\b))\b/g;
const _PALABRA_NUM_RE = /\b(?:son|suman|llegan\s+a|de\s+cada|hay|quedan|totalizan|de)\s+(?:las\s+|los\s+)?(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)\b(?!\s+(?:veces|dominios|lentes|cosas|movimientos|pasos|ejes|frentes|preguntas|razones|puntos))/gi;
const _PUNTOS_PP_RE = /(\d+(?:[.,]\d+)?)\s+puntos?\b/gi;
const _ATA_CIFRA = /\b(?:d[ií]as|unidades|cuentas?|clientes?|skus?|bodegas?|marcas?|de\s+\d+|de\s+(?:ocho|trece|diez|cinco)|llegan\s+a|son\b|suman|rota|rotaci[oó]n|cobertura|inventario|vencid|margen|venta|contribuci|carga|brecha|markup|capital|saldo|frenad|puestos?|lugar|posici[oó]n)/i;

/** posicionDeCifra(s, texto, desde) → la posición de la cifra como TOKEN (no dentro de otra: «8d» no está en «58d»), o -1 */
export function posicionDeCifra(s, texto, desde = 0) {
  const re = new RegExp("(?<![\\d.,$%])" + String(texto).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\d.,]|\\d)", "g");
  re.lastIndex = Math.max(0, desde);
  const m = re.exec(s);
  return m ? m.index : -1;
}
/** puntosDeAfirmacion(texto) → [{clase, pos, fin, span, negado}] · los lugares de la prosa donde hay algo que afirmar */
export function puntosDeAfirmacion(texto) {
  const s = String(texto || "");
  const out = [];
  const usados = new Map();   // texto de la cifra → última posición usada (cifras repetidas)
  for (const f of parseFigures(s)) {
    const desde = usados.has(f.text) ? usados.get(f.text) + 1 : 0;
    let pos = posicionDeCifra(s, f.text, desde);
    if (pos < 0) pos = posicionDeCifra(s, f.text, 0);
    if (pos < 0) continue;
    usados.set(f.text, pos);
    out.push({ clase: "cifra", pos, fin: pos + f.text.length, span: f.text, negado: _negado(s, pos), unit: f.unit, raw: f.raw, canon: f.canon.replace(/\$/g, "") });
  }
  /* una relación negada («no llega ni a la mitad») sigue siendo una relación que afirmar: la negación no la exime */
  const re = (rx, clase, extra = null) => { rx.lastIndex = 0; let m; while ((m = rx.exec(s))) { const p = { clase, pos: m.index, fin: m.index + m[0].length, span: m[0], negado: clase === "relacion" ? false : _negado(s, m.index) }; if (extra) Object.assign(p, extra(m)); out.push(p); } };
  const oracionDe = (pos) => { const ini = Math.max(s.lastIndexOf(". ", pos), s.lastIndexOf("\n", pos), 0); let fin = s.indexOf(". ", pos); if (fin < 0) fin = s.length; return s.slice(ini, fin); };
  re(_UNIDADES_RE, "cifra", (m) => ({ unit: "count", raw: parseInt(m[1].replace(/[.,]/g, ""), 10), canon: `count:${parseInt(m[1].replace(/[.,]/g, ""), 10)}` }));
  re(_PUNTOS_PP_RE, "cifra", (m) => { const raw = parseFloat(m[1].replace(",", ".")); return { unit: "pp", raw, canon: `pp:${raw}pp` }; });
  /* los números pelados y en palabras: solo atados a algo contable o medible en su oración, y nunca dentro de una cifra ya leída */
  const cubiertoPorCifra = (pos, fin) => out.some((p) => p.clase === "cifra" && pos >= p.pos && fin <= p.fin);
  { const rx = _NUMERO_SUELTO_RE; rx.lastIndex = 0; let m; while ((m = rx.exec(s))) { const fin = m.index + m[0].length; if (cubiertoPorCifra(m.index, fin)) continue; const o = oracionDe(m.index); if (!_ATA_CIFRA.test(o)) continue; if (/^(?:19|20)\d\d$/.test(m[1])) continue; const raw = parseInt(m[1].replace(/\./g, ""), 10); out.push({ clase: "cifra", pos: m.index, fin, span: m[0], negado: _negado(s, m.index), unit: "count", raw, canon: `count:${raw}`, suelto: true }); } }
  { const rx = _PALABRA_NUM_RE; rx.lastIndex = 0; let m; while ((m = rx.exec(s))) { const w = m[1].toLowerCase(); const raw = _PALABRA_NUM[w]; const pos = m.index + m[0].lastIndexOf(m[1]); out.push({ clase: "cifra", pos, fin: pos + m[1].length, span: m[1], negado: _negado(s, pos), unit: "count", raw, canon: `count:${raw}`, suelto: true }); } }
  re(_ORDEN_RE, "orden");
  re(_RELACION_RE, "relacion");
  re(_GRUPO_RE, "grupo");
  re(_VARIACION_RE, "variacion");
  re(_ESTADO_RE, "estado");
  /* un orden o una variación sin métrica en su oración es una opinión («el riesgo más grave», «mejora la conversación»): no cuenta */
  const filtrados = out.filter((p) => {
    if (p.clase === "orden" || p.clase === "variacion" || p.clase === "relacion") {
      const o = oracionDe(p.pos);
      /* hace falta una métrica de la boleta (no «crecimiento» ni «participación» a secas), una cifra o un conteo en la oración */
      const nombresPropios = (o.match(/(?<![.!?]\s)(?<!^)\b[A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:-[A-Z0-9]+)*\b|\b[A-Z]{2,4}-[A-Z0-9-]{3,}\b/g) || []).length;
      const conMetrica = [...metricasEn(o)].some((k) => k !== "variacion" && k !== "participacion") || /\brota[a-záéíóúñ]*\b|\bd[ií]as\b|\bunidades\b|\bcapital\b|\bbenchmark\b|\breferencia\b|\bpiso\b/i.test(o) || nombresPropios >= 2;
      if (!(conMetrica || parseFigures(o).length > 0 || /\b\d+\s+(?:cuentas?|clientes?|skus?|bodegas?|marcas?)\b/i.test(o))) return false;
      /* «resolvería LG-DRYER8KG primero», «yo miraría primero a Lider»: el orden de una acción recomendada, no un ranking */
      if (p.clase === "orden" && /^(?:primer|segund|tercer|[uú]ltim)/i.test(p.span) && _RECOMIENDA.test(o)) return false;
      /* un ordinal ordena cuando va con lo ordenado: «segunda cuenta en crecimiento», «va tercero», «el segundo mayor»; «y una quinta» no */
      if (p.clase === "orden" && /^(?:primer|segund|tercer|cuart|quint|sext|s[eé]ptim|octav|noven|d[eé]cim)/i.test(p.span)) {
        const tras = s.slice(p.fin, p.fin + 30), antes = s.slice(Math.max(0, p.pos - 25), p.pos);
        if (!/^\s*(?:mayor|menor|peor|mejor|m[aá]s|menos|cuenta|cliente|sku|lugar|puesto|posici[oó]n|en\s|de\s|del\s|por\s)/i.test(tras) && !/(?:va|van|queda|quedan|est[aá]n?|ocupa|ocupan|el|la|los|las|es|son)\s*$/i.test(antes)) return false;
      }
    }
    return true;
  });
  filtrados.sort((a, b) => a.pos - b.pos || (a.clase === "cifra" ? 1 : -1));
  /* dos puntos sobre el mismo tramo («8 clientes» es cifra y grupo): queda el de clase más específica, con el canon de la cifra */
  const unicos = [];
  for (const p of filtrados) { const prev = unicos[unicos.length - 1]; if (prev && prev.pos === p.pos && prev.fin === p.fin) { if (prev.clase === "cifra" && p.clase !== "cifra") { Object.assign(p, { canon: prev.canon, raw: prev.raw, unit: prev.unit }); unicos[unicos.length - 1] = p; } else if (p.clase === "cifra") Object.assign(prev, { canon: p.canon, raw: p.raw, unit: p.unit }); continue; } unicos.push(p); }
  return unicos;
}

/* _ubicar(prosa, fragmento) → [ini, fin] del fragmento declarado dentro de la prosa (normalizando espacios y tildes; si no está entero,
 * por su primer tramo de 40 caracteres), o null */
function _ubicar(prosaN, mapa, fragmento) {
  const f = normalizar(fragmento);
  if (!f) return null;
  let i = prosaN.indexOf(f);
  if (i < 0 && f.length > 40) { const cab = f.slice(0, 40); i = prosaN.indexOf(cab); if (i >= 0) return [mapa[i], mapa[Math.min(i + f.length, mapa.length - 1)]]; }
  if (i < 0) { const cola = f.slice(-40); const j = prosaN.indexOf(cola); if (j >= 0) return [mapa[Math.max(0, j - (f.length - 40))], mapa[Math.min(j + cola.length, mapa.length - 1)]]; }
  if (i < 0) return null;
  return [mapa[i], mapa[Math.min(i + f.length, mapa.length - 1)]];
}
/* normalización de la prosa con un mapa de posiciones normalizadas → originales */
function _normalizarConMapa(s) {
  const out = [], mapa = [];
  let prevEspacio = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/\s/.test(ch)) { if (prevEspacio) continue; prevEspacio = true; out.push(" "); mapa.push(i); continue; }
    prevEspacio = false;
    for (const c of ch) { out.push(c); mapa.push(i); }
  }
  mapa.push(s.length);
  return { prosaN: out.join(""), mapa };
}

/** omisiones(texto, afirmaciones) → { puntos, cubiertos, omisiones: [{clase, span, pos, motivo}], negados, cobertura }
 *  cobertura = puntos cubiertos / puntos afirmados (los negados no cuentan) */
export function omisiones(texto, afirmaciones) {
  const s = String(texto || "");
  const puntos = puntosDeAfirmacion(s);
  const { prosaN, mapa } = _normalizarConMapa(s);
  const decl = normalizarAfirmaciones(afirmaciones).map(({ afirmacion: a }) => ({ a, rango: _ubicar(prosaN, mapa, a.texto) }));
  const canonDeclarados = new Set();
  for (const { a } of decl) {
    if (a.tipo === "lectura") continue;
    for (const v of [a.valor, a.variacion && a.variacion.valor, a.relacion && a.relacion.valor]) if (v && v.canon) canonDeclarados.add(String(v.canon).replace(/\$/g, ""));
    if (a.conteo && Number.isFinite(a.conteo.n)) canonDeclarados.add(`count:${a.conteo.n}`);
    if (a.conteo && Number.isFinite(a.conteo.m)) canonDeclarados.add(`count:${a.conteo.m}`);
    if (a.grupo && Number.isFinite(a.grupo.n)) canonDeclarados.add(`count:${a.grupo.n}`);
  }
  const out = { puntos: puntos.length, cubiertos: 0, negados: 0, omisiones: [], cobertura: 1 };
  let afirmados = 0;
  for (const p of puntos) {
    if (p.negado) { out.negados++; continue; }
    afirmados++;
    const envuelven = decl.filter(({ rango }) => rango && p.pos >= rango[0] - 3 && p.fin <= rango[1] + 3);
    /* una cifra se cubre DECLARÁNDOLA (mismo canon en el valor de alguna afirmación de hecho); un orden que la envuelve sin declararla no la cubre */
    const cubre = p.clase === "cifra" ? (p.canon && canonDeclarados.has(p.canon)) : envuelven.some(({ a }) => _CUBRE[p.clase].has(a.tipo));
    if (cubre) { out.cubiertos++; continue; }
    const soloLectura = envuelven.length && envuelven.every(({ a }) => a.tipo === "lectura");
    const otroTipo = envuelven.length && !soloLectura;
    out.omisiones.push({ clase: soloLectura ? "hecho-como-lectura" : otroTipo ? `significado-no-declarado:${p.clase}` : p.clase, span: p.span, pos: p.pos, motivo: soloLectura ? `«${p.span}» está declarado solo como lectura` : otroTipo ? `«${p.span}» (${p.clase}) cae en una afirmación de tipo ${[...new Set(envuelven.map(({ a }) => a.tipo))].join("/")}` : `«${p.span}» (${p.clase}) no cae en ninguna afirmación declarada` });
  }
  out.cobertura = afirmados ? out.cubiertos / afirmados : 1;
  out.afirmados = afirmados;
  out.sinUbicar = decl.filter(({ rango, a }) => !rango && a.texto).map(({ a }) => a.id);
  return out;
}
export { _CLASES as CLASES_DE_PUNTO };
