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
import { menosAscii } from "./afirmacion.js";
import { metricasEn } from "../oracle/guardC.js";
import { normalizar, normalizarAfirmaciones } from "./afirmacion.js";

/* una RECOMENDACIÓN («resolvería LG-DRYER8KG primero», «yo miraría primero a Lider») ordena acciones, no entidades en una métrica */
const _RECOMIENDA = /\b(?:yo|resolver[ií]a|mirar[ií]a|atacar[ií]a|priorizar[ií]a|empezar[ií]a|ir[ií]a|cerrar[ií]a|negociar[ií]a|liberar[ií]a|cobrar[ií]a|revisar[ií]a|recomiendo|sugiero|conviene|deber[ií]a|habr[ií]a\s+que|hay\s+que|lo\s+primero|primero\s+(?:a|con|por|hay)|prioridad|ir\s+primero|van?\s+primero|raz[oó]n\s+de\s+ir|pondr[ií]a|pondr[eé]|el\s+foco)\b/i;
/* una OFERTA: lo que se propone abrir después («si quieres, te abro…», «¿te abro…?», «puedo abrirte…», «cuando digas»); no afirma */
const _OFERTA = /(?:^|[.\n]\s*)(?:¿\s*)?(?:si\s+(?:quieres|prefieres|te\s+sirve),?\s+te\s+(?:abro|bajo|cruzo|separo|muestro)|¿?\s*te\s+abro\b|puedo\s+abrirte\b|te\s+puedo\s+abrir\b|¿?\s*quieres\s+que\s+(?:te\s+)?(?:abra|baje|cruce|separe|muestre)|cuando\s+digas\b|cuando\s+quieras\b)/i;
const _NEGACION = /\b(?:no|sin|ni|nada|ning[uú]n[oa]?|tampoco|imposible|no\s+hay|no\s+se\s+puede|no\s+puedo|no\s+podemos|no\s+sabemos|no\s+permite|no\s+alcanza\s+para|antes\s+de\s+decir|para\s+decir\s+si)\b/i;
const _ORDEN_RE = /\b(?:(?:el|la|los|las|quien|quienes)\s+(?:[a-záéíóúñ0-9]+\s+){0,2}que\s+(?:[a-záéíóúñ]+\s+)?(?:m[aá]s|menos)\b|(?:es|son|est[aá]n?|queda|quedan)\s+(?:m[aá]s|menos)\s+que\b|(?:el|la|los|las|quien|quienes)\s+(?:m[aá]s|menos)\b|m[aá]s\s+(?:alt[oa]s?|baj[oa]s?|grandes?|pequeñ[oa]s?|graves?|pesad[oa]s?|caros?|barat[oa]s?|lent[oa]s?|r[aá]pid[oa]s?|larg[oa]s?|cort[oa]s?|fuertes?|d[eé]bil(?:es)?|deteriorad[oa]s?|comprometid[oa]s?|delicad[oa]s?|urgentes?|leves?|severa?s?|profund[oa]s?)|(?:vende|aporta|debe|acumula|contribuye|factura|margina|rota|pesa|concentra|tiene|compra|mueve|deja|arrastra)\s+(?:m[aá]s|menos)\s+[a-záéíóúñ]+(?!\s+que)|(?:mayor|menor|peor|mejor)(?:es)?\b|con\s+(?:m[aá]s|menos)\s+[a-záéíóúñ]+|m[aá]s\s+(?:delgad[oa]s?|lejos|cerca|arriba|abajo|pegad[oa]s?)|(?:m[aá]s|menos)\s+[a-záéíóúñ]+\s+que\s+[A-ZÁÉÍÓÚ][a-záéíóúñ]*|(?:vende|aporta|debe|acumula|contribuye|factura|margina|rota|pesa|concentra|tiene|compra|mueve)\s+(?:m[aá]s|menos)\s+que\b|primer[oa]?s?\b|segund[oa]s?\b|tercer[oa]?s?\b|cuart[oa]s?\b|quint[oa]s?\b|sext[oa]s?\b|s[eé]ptim[oa]s?\b|octav[oa]s?\b|noven[oa]s?\b|d[eé]cim[oa]s?\b|[uú]ltim[oa]s?\b|encabeza|lidera\b|se\s+lleva\s+la\s+palma|por\s+delante\s+de|por\s+encima\s+de|por\s+debajo\s+de|supera\s+(?:al?|en)\b|superan\s+(?:al?|en)\b|nadie\s+(?:supera|vende|aporta|debe|acumula|tiene)|ning[uú]n[ao]?\s+[a-záéíóúñ]+\s+(?:supera|vende|aporta|debe|acumula|tiene|llega)|top\s*\d|ranking|en\s+este\s+orden|el\s+orden\s+(?:es|queda)|por\s+orden\s+de|de\s+mayor\s+a\s+menor|de\s+menor\s+a\s+mayor|concentra\s+el\s+mayor|la\s+mayor\s+parte|a\s+la\s+cabeza|al\s+frente|en\s+la\s+cola|cierra\s+la\s+lista|solo\s+detr[aá]s\s+de|detr[aá]s\s+de)\b/gi;
const _RELACION_RE = /(?:\b|(?=[$\d]))(?:(?:el|al|del)\s+doble|dobla|duplica|triplica|cuadruplica|(?:el\s+|del\s+)?triple|(?:la\s+)?mitad|(?:un\s+)?tercio|(?:un\s+)?cuarto\s+de|(?:\d+(?:[.,]\d+)?|dos|tres|cuatro|cinco|seis|diez)\s*(?:veces|x)\b|(?:de|De)\s+cada\s+(?:\d+|dos|tres|cuatro|cinco|diez)\b|casi\s+(?:igual|tanto|lo\s+mismo)|igual\s+que|tanto\s+como|equivale\s+a|\d+(?:[.,]\d+)?\s?%\s+(?:de|del)\s+(?:la|el|los|las|su|sus|ese|esa|toda|todo|lo)\b|(?:m[aá]s|menos)\s+que\s+[A-ZÁÉÍÓÚ]|[$\d][\d.,]*\s?(?:[KMB%]|pp|d[ií]as|d)?\s+contra\s+\$?[\d.,]+|(?:bajo|sobre|por\s+encima\s+de|por\s+debajo\s+de|lejos\s+de|cerca\s+de)l?\s+(?:el\s+|la\s+)?(?:benchmark|referencia|piso|nivel))/g;
const _GRUPO_RE = /\b(?:(?:\d+|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece)\s+(?:de\s+(?:las?|los|esas?|esos|ellas|ellos)\s+)?(?:\d+\s+)?(?:cuentas?|clientes?|skus?|sku|bodegas?|marcas?|familias?|referencias?|productos?)\b|\d+\s+de\s+(?:las?\s+|los\s+)?\d+\b|entre\s+(?:las|los)\s+(?:\d+|dos|tres|cuatro|cinco)\b(?!\s+(?:n[uú]meros?|cifras?|precios?|valores?|columnas?|montos?|puntos?|lados?|casos?|extremos?|meses|a[ñn]os|per[ií]odos?|escenarios?|caminos?|hip[oó]tesis|lecturas?|opciones?|alternativas?|se[ñn]ales|riesgos?|focos?|mundos?|universos?))|(?:las|los)\s+(?:dos|tres|cuatro|cinco|seis|ocho)\s+(?:grandes|cuentas|clientes|sku|skus|que|más|mayores|motores|primer[oa]s|restantes)\b|ese\s+(?:mismo\s+)?grupo|en\s+conjunto|entre\s+(?:ambas|ambos|las\s+dos|los\s+dos|las\s+tres|los\s+tres)\b(?!\s+(?:n[uú]meros?|cifras?|precios?|valores?|columnas?|montos?|puntos?|lados?|casos?|extremos?|meses|a[ñn]os|per[ií]odos?|escenarios?|caminos?|hip[oó]tesis|lecturas?|opciones?|alternativas?|se[ñn]ales|riesgos?|focos?|mundos?|universos?))|(?:suman|totalizan|acumulan)\s+(?:entre\s+)?(?:las|los|ambas|ambos|un|el|la)?)/gi;
const _VARIACION_RE = /\b(?:crec(?:e|en|i[oó]|ieron|iendo)|ca(?:e|en|y[oó]|yeron|yendo)|sub(?:e|en|i[oó]|ieron|iendo)|baj(?:a|an|ó|aron|ando)(?![a-záéíóúñ])|se\s+deterior(?:a|an|[oó]|aron)|mejor(?:a|an|[oó]|aron)|empeor(?:a|an|[oó]|aron)|retroced(?:e|en|i[oó]|ieron)|avanz(?:a|an|[oó]|aron)|aument(?:a|an|[oó]|aron)|disminu(?:ye|yen|y[oó]|yeron)|descend(?:i[oó]|ieron)|se\s+redu(?:jo|jeron|ce|cen)|se\s+contra(?:jo|jeron|e|en)|se\s+desplom(?:a|an|[oó]|aron)|repunt(?:a|an|[oó]|aron)|(?:vend(?:e|es|en|iendo|emos|i[oó]|ieron)|factur(?:a|an|ando|[oó]))\s+m[aá]s(?!\s+(?:que|de\b|del\b|unidades|a\b|en\b))|variaci[oó]n|YoY|interanual|respecto\s+(?:al|del)\s+a[ñn]o|vs\.?\s+a[ñn]o|a[ñn]o\s+anterior|a[ñn]o\s+pasado|dólares\s+nuevos|pierde\s+\$|gana\s+\$)(?![a-záéíóúñ])/gi;
const _ESTADO_RE = /(?<!capital\s)(?<!del\s)(?<!el\s)(?<!de\s)(?<!d[ií]as\s)\b(?:inmoviliz[a-záéíóúñ]*|frenad[oa]s?|detenid[oa]s?|parad[oa]s?|bloquead[oa]s?|estancad[oa]s?|sobrestock|sobre\s+stock|riesgo\s+de\s+quiebre|capital\s+sano|sin\s+venta|sin\s+movimiento|sin\s+(?:saldo\s+)?vencido|sin\s+mora|por\s+vencer)\b/gi;
const _UNIDADES_RE = /\b(\d{1,3}(?:[.,]\d{3})+|\d+)\s+(?:unidades|cuentas|clientes|skus?|bodegas|marcas)\b/gi;

const _NOMBRE_DE_VARIACION = /^(?:variaci|yoy|interanual|respecto|vs|a[ñn]o|d[oó]lares)/i;
const _DIRECCION_RE = /\b(?:crec|ca(?:e|en|y)|sub(?:e|en|i)|baj(?:a|an|ó|aron|ando)|deterior|mejor|empeor|retroced|avanz|aument|disminu|descend|redu|contra(?:jo|e|en)|desplom|repunt|pierde|gana|vend(?:e|en|i)[a-z]*\s+m[aá]s|m[aá]s\s+que|menos\s+que|expan|impuls|empuj|frena|estable|igual)/i;
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
  /* una cifra con artículo definido o demostrativo («no te recuperan LOS $4.7M de contribución», «no alcanza ESE $1.6M») está presupuesta: la
   * negación cae sobre el verbo, la cifra se afirma igual */
  if (/(?:^|[^a-záéíóúñ])(?:los|las|el|la|es[oa]s?|est[oa]s?|aquell[oa]s?)\s+$/i.test(antes)) return false;
  const clausula = (antes.split(/[.;:—()]/).pop() || "").replace(/\b(?:que|quienes|donde|cuando)\s+(?:no|ni|sin)\b[^,]*/gi, "").replace(/\bno\s+captur[a-záéíóúñ]*/gi, "");
  if (/\b(?:nadie|ning[uú]n[ao]?)\b[^.]{0,30}$/i.test(clausula)) return false;
  return _NEGACION.test(clausula);
}
const _PALABRA_NUM_VALOR = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20 };
/* un número pelado o en palabras es una cifra cuando la oración lo ata a algo contable o medible («llegan a 190», «son 8 de 13», «son cinco de ocho») */
const _NUMERO_SUELTO_RE = /(?<![\d.,$%\w-])(\d{1,3}(?:\.\d{3})+|\d+)(?![.,]\d)(?![\d.,]*\s*(?:%|pp|d\b|x\b|M\b|K\b|d[ií]as?\b|unidades\b|cuentas?\b|clientes?\b|skus?\b|bodegas?\b|marcas?\b|puntos?\b|veces\b|meses\b|mes\b|semanas?\b|a[ñn]os?\b|trimestres?\b))\b/g;   // «0.3» no trae un 0; «12 meses» es un horizonte
/* «son tres», «hay cinco cuentas», «de los ocho» (partición) y «de tres cuentas» son números; «de una factura» es un artículo */
const _PALABRA_NUM_RE = /\b(?:(?:son|suman|llegan\s+a|de\s+cada|hay|quedan|totalizan)\s+(?:las\s+|los\s+)?(?:uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)\b(?!\s+(?:veces|dominios|lentes|cosas|movimientos|pasos|ejes|frentes|preguntas|razones|puntos|riesgos?|focos|se[ñn]ales|bloques|cap[ií]tulos|temas|lecturas))|\bde\s+(?:las|los)\s+(?:uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)\b(?!\s+(?:veces|dominios|lentes|cosas|movimientos|pasos|ejes|frentes|preguntas|razones|puntos|riesgos?|focos|se[ñn]ales|bloques|cap[ií]tulos|temas|lecturas))|\bde\s+(?:uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)\s+(?=cuentas?\b|clientes?\b|skus?\b|bodegas?\b|marcas?\b))/gi;
const _PALABRA_NUM_DE = /(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)\s*$/i;
const _PUNTOS_PP_RE = /(\d+(?:[.,]\d+)?)\s+puntos?\b/gi;
/* «1 · Contribución…» / «2) …» al inicio de línea es el orden de la lista, no una cifra; «dos riesgos» / «los tres focos» cuentan la estructura de la
 * propia respuesta (no hay entidad de la evidencia detrás) */
const _ENUMERADOR = /(?:^|\n)\s*\d{1,2}\s*[·.)]/;
const _ESTRUCTURA = /^\s+(?:riesgos?|focos?|frentes?|lentes?|dominios?|se[ñn]al(?:es)?|puntos?\s+(?:de\s+atenci[oó]n|clave)|bloques?|cap[ií]tulos?|pasos?|movimientos?|ejes?|preguntas?|razones?|cosas?|temas?|lecturas?|tensi(?:o|ó)n(?:es)?|alertas?|avisos?|hallazgos?|hip[oó]tesis|motivos?|causas?|efectos?|diferencias?|mundos?|caminos?|opciones?|alternativas?|escenarios?|caras?|formas?|maneras?|niveles?)\b/i;
const _ATA_CIFRA = /\b(?:d[ií]as|unidades|cuentas?|clientes?|skus?|bodegas?|marcas?|de\s+\d+|de\s+(?:ocho|trece|diez|cinco)|llegan\s+a|son\b|suman|rota|rotaci[oó]n|cobertura|inventario|vencid|margen|venta|contribuci|carga|brecha|markup|capital|saldo|frenad|puestos?|lugar|posici[oó]n)/i;

/** posicionDeCifra(s, texto, desde) → la posición de la cifra como TOKEN (no dentro de otra: «8d» no está en «58d»), o -1 */
export function posicionDeCifra(s, texto, desde = 0) {
  /* un borde es otro dígito o un separador decimal pegado a un dígito («8d» no está en «58d», «$1» no está en «$1,5M»); el punto
   * final de la oración («5,4%.») no es borde */
  const re = new RegExp("(?<![\\d$%])(?<!\\d[.,])" + String(texto).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?!\\d|[.,]\\d)", "g");
  re.lastIndex = Math.max(0, desde);
  const m = re.exec(s);
  return m ? m.index : -1;
}
/** puntosDeAfirmacion(texto) → [{clase, pos, fin, span, negado}] · los lugares de la prosa donde hay algo que afirmar */
export function puntosDeAfirmacion(texto) {
  const s = menosAscii(String(texto || ""));   // mismo largo: las posiciones valen sobre el original
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
  /* la moneda sin símbolo («330K», «34.5M»): dinero con su escala, si parseFigures no lo leyó ya (con «$») */
  { const rx = /(?<![\d.,$%\w-])([+-]?\d+(?:[.,]\d+)?)\s?([KMB])(?![a-záéíóúñ0-9])/g; let m; while ((m = rx.exec(s))) { if (out.some((p) => p.clase === "cifra" && m.index >= p.pos && m.index + m[0].length <= p.fin)) continue; const raw = parseFloat(m[1].replace(",", ".")) * ({ K: 1e3, M: 1e6, B: 1e9 })[m[2].toUpperCase()]; out.push({ clase: "cifra", pos: m.index, fin: m.index + m[0].length, span: m[0], negado: _negado(s, m.index), unit: "money", raw, canon: `money:${m[1].replace("+", "")}${m[2].toUpperCase()}` }); } }
  /* los números pelados y en palabras: solo atados a algo contable o medible en su oración, y nunca dentro de una cifra ya leída */
  const cubiertoPorCifra = (pos, fin) => out.some((p) => p.clase === "cifra" && pos >= p.pos && fin <= p.fin);
  { const rx = _NUMERO_SUELTO_RE; rx.lastIndex = 0; let m; while ((m = rx.exec(s))) { const fin = m.index + m[0].length; if (cubiertoPorCifra(m.index, fin)) continue; if (_ENUMERADOR.test(s.slice(Math.max(0, m.index - 2), fin + 3))) continue; if (_ESTRUCTURA.test(s.slice(fin, fin + 24))) continue; const o = oracionDe(m.index); if (!_ATA_CIFRA.test(o)) continue; if (/^(?:19|20)\d\d$/.test(m[1])) continue; const raw = parseInt(m[1].replace(/\./g, ""), 10); out.push({ clase: "cifra", pos: m.index, fin, span: m[0], negado: _negado(s, m.index), unit: "count", raw, canon: `count:${raw}`, suelto: true }); } }
  { const rx = _PALABRA_NUM_RE; rx.lastIndex = 0; let m; while ((m = rx.exec(s))) { const mw = _PALABRA_NUM_DE.exec(m[0]); if (!mw) continue; const w = mw[1].toLowerCase(); const raw = _PALABRA_NUM_VALOR[w]; const pos = m.index + m[0].lastIndexOf(mw[1]); if (raw === 1 && !/^\s+(?:cuentas?|clientes?|skus?|bodegas?|marcas?|sola|solo|de\s+(?:las|los)\b)/i.test(s.slice(pos + mw[1].length, pos + mw[1].length + 20))) continue; if (/\b(?:cu[aá]l(?:es)?|cualquiera|alguna|ninguna)\s+de\s+(?:las|los)\s*$/i.test(s.slice(Math.max(0, pos - 24), pos))) continue; if (_ESTRUCTURA.test(s.slice(pos + mw[1].length, pos + mw[1].length + 24))) continue; out.push({ clase: "cifra", pos, fin: pos + mw[1].length, span: mw[1], negado: _negado(s, pos), unit: "count", raw, canon: `count:${raw}`, suelto: true }); } }
  re(_ORDEN_RE, "orden");
  for (const p of out) if (p.clase === "orden" && /^m[aá]s\s+(?:r[aá]pid|lent)/i.test(p.span)) p.clase = "variacion";   // «más rápido» es ritmo: sube o baja, no un puesto
  re(_RELACION_RE, "relacion");
  /* «te sale caro dos veces» es un modismo: «k veces» es relación solo con un marcador comparativo al lado («vale/es/pesa … dos veces», «dos veces más/que/el») */
  for (let k = out.length - 1; k >= 0; k--) { const p = out[k]; if (p.clase !== "relacion" || !/\b(?:\d+(?:[.,]\d+)?|dos|tres|cuatro|cinco|seis|diez)\s*(?:veces|x)\b/i.test(p.span)) continue; const antes = s.slice(Math.max(0, p.pos - 40), p.pos), tras = s.slice(p.fin, p.fin + 24); if (!/\b(?:es|son|vale|valen|pesa|pesan|vende|venden|supera|superan|equivale|representa|casi|m[aá]s de|menos de|unas?|hasta|de|multiplica|rota|rotan|factura|deja|dejan|cuesta|cuestan)\s*$/i.test(antes) && !/^\s*(?:m[aá]s|menos|que|el|la|lo|su|sus|mayor|menor|superior|inferior|lo que|por encima|por debajo)\b/i.test(tras)) out.splice(k, 1); }
  re(_GRUPO_RE, "grupo");
  re(_VARIACION_RE, "variacion");
  re(_ESTADO_RE, "estado");
  /* un orden o una variación sin métrica en su oración es una opinión («el riesgo más grave», «mejora la conversación»): no cuenta */
  /* el NOMBRE de un corte entre guillemets («el corte «Más de 90 días»», «el tramo «0-30 días»») es un rótulo que se nombra, no un hecho */
  const rotulosDeCorte = [];
  { const rx = /\b(?:corte|tramo|rango|banda|columna|fila|r[oó]tulo|etiqueta)\s+«([^»]{1,60})»/gi; let m; while ((m = rx.exec(s))) rotulosDeCorte.push([m.index + m[0].indexOf("«"), m.index + m[0].length]); }
  const enRotuloDeCorte = (p) => rotulosDeCorte.some(([i, j]) => p.pos >= i && p.fin <= j);
  /* un verbo de dirección dentro de un SUPERLATIVO («la carga más baja del año», «el más alto») es el orden, no una variación */
  const ordenes = out.filter((p) => p.clase === "orden");
  const dentroDeOrden = (p) => ordenes.some((o) => p.pos >= o.pos && p.fin <= o.fin && (o.fin - o.pos) > (p.fin - p.pos));
  /* una PREGUNTA al dueño con opciones («¿Qué hiciste distinto: mejor mezcla, menos descuento, o un cliente que compró más caro?») pide
   * contexto, no afirma: sus superlativos, relaciones y direcciones no son puntos si la pregunta no trae cifra */
  const enPreguntaConOpciones = (p) => { const o = oracionDe(p.pos).trim(); return /^¿/.test(o) && /\?$/.test(o) && /(?:,|;)\s+o\s+|\s+o\s+(?:un|una|el|la|fue|hubo)\b/i.test(o) && !parseFigures(o).length && !/\b\d+\s+(?:cuentas?|clientes?|skus?|bodegas?|marcas?)\b/i.test(o); };
  const filtrados = out.filter((p) => {
    if (enRotuloDeCorte(p)) return false;
    if (p.clase === "variacion" && dentroDeOrden(p)) return false;
    if ((p.clase === "orden" || p.clase === "relacion" || p.clase === "variacion" || p.clase === "estado") && enPreguntaConOpciones(p)) return false;
    /* un estado dentro de una OFERTA sin cifra («te abro qué parte está frenada y en qué SKU») es lo que se propone abrir, no un hecho */
    if (p.clase === "estado") { const o = oracionDe(p.pos); if (_OFERTA.test(o) && !parseFigures(o).length && !new RegExp(_UNIDADES_RE.source, "i").test(o)) return false; }
    if (p.clase === "orden" || p.clase === "variacion" || p.clase === "relacion") {
      const o = oracionDe(p.pos);
      /* hace falta una métrica de la boleta (no «crecimiento» ni «participación» a secas), una cifra o un conteo en la oración */
      const nombresPropios = (o.match(/(?<![.!?]\s)(?<!^)\b[A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:-[A-Z0-9]+)*\b|\b[A-Z]{2,4}-[A-Z0-9-]{3,}\b/g) || []).length;
      const conMetrica = [...metricasEn(o)].some((k) => k !== "variacion" && k !== "participacion") || /\brota[a-záéíóúñ]*\b|\bd[ií]as\b|\bunidades\b|\bcapital\b|\bbenchmark\b|\breferencia\b|\bpiso\b/i.test(o) || nombresPropios >= 2;
      if (!(conMetrica || parseFigures(o).length > 0 || /\b\d+\s+(?:cuentas?|clientes?|skus?|bodegas?|marcas?)\b/i.test(o))) return false;
      /* el NOMBRE de una variación («Variación vs año anterior en $», «venta contra el año anterior») afirma solo si su cláusula trae una cifra o
       * una dirección; «también tengo Variación vs año anterior en $» enumera un rótulo */
      if (p.clase === "variacion" && _NOMBRE_DE_VARIACION.test(p.span)) {
        const ini = Math.max(s.lastIndexOf("·", p.pos), s.lastIndexOf(";", p.pos), s.lastIndexOf("—", p.pos), s.lastIndexOf(":", p.pos), s.lastIndexOf("\n", p.pos), s.lastIndexOf(", ", p.pos), s.lastIndexOf(". ", p.pos), s.lastIndexOf("(", p.pos), 0);
        const finC = [s.indexOf("·", p.fin), s.indexOf(";", p.fin), s.indexOf("—", p.fin), s.indexOf("\n", p.fin), s.indexOf(". ", p.fin), s.indexOf(", ", p.fin), s.indexOf(")", p.fin)].filter((x) => x >= 0);
        const clausula = s.slice(ini, finC.length ? Math.min(...finC) : s.length);
        if (!(parseFigures(clausula).length || _DIRECCION_RE.test(clausula) || /[+−-]\s*\$?\d/.test(clausula))) return false;
      }
      /* …y un VERBO de variación afirma solo si su cláusula nombra una métrica de la boleta o trae una cifra: «de lo que mejora la calidad
       * del mix» es interpretación aunque la oración entera nombre «venta» */
      if (p.clase === "variacion" && !_NOMBRE_DE_VARIACION.test(p.span)) {
        const ini = Math.max(s.lastIndexOf("·", p.pos), s.lastIndexOf(";", p.pos), s.lastIndexOf("—", p.pos), s.lastIndexOf(":", p.pos), s.lastIndexOf("\n", p.pos), s.lastIndexOf(", ", p.pos), s.lastIndexOf(". ", p.pos), s.lastIndexOf(" de lo que ", p.pos), s.lastIndexOf(" que ", p.pos), 0);
        const finC = [s.indexOf("·", p.fin), s.indexOf(";", p.fin), s.indexOf("—", p.fin), s.indexOf("\n", p.fin), s.indexOf(". ", p.fin), s.indexOf(", ", p.fin), s.indexOf(" de lo que ", p.fin)].filter((x) => x >= 0);
        const clausula = s.slice(ini, finC.length ? Math.min(...finC) : s.length);
        const conMetricaC = [...metricasEn(clausula)].some((k) => k !== "variacion" && k !== "participacion") || /\brota[a-záéíóúñ]*\b|\bd[ií]as\b|\bunidades\b|\bcapital\b|\bbenchmark\b|\breferencia\b|\bpiso\b|\bvencid|\bsaldo\b|\bstock\b|\bnegocio\b|\bcartera\b|\bempresa\b|\bcompa[ñn][ií]a\b|\bcuentas?\b|\bclientes?\b|\bskus?\b/i.test(clausula);   // el negocio, la cartera o las cuentas como sujeto
        const _COMUNES = /^(?:La|El|Los|Las|Un|Una|Unos|Unas|Est[aá]s?|Est[eo]s?|Es[aeo]s?|Hay|Y|O|Si|Pero|Ahora|Tu|Tus|Su|Sus|Sobre|Con|Sin|En|De|Del|Al|Es|Son|Yo|No|Ni|Lo|Que|D[oó]nde|Qui[eé]n(?:es)?|Cu[aá]ndo|C[oó]mo|Aunque|Porque|Mientras|Tras|Entre|Para|Por|Hasta|Desde|Ah[ií]|As[ií]|M[aá]s|Menos|Mi|Mis|Total|Ese|Esa|Cada|Todo|Toda|Todos|Todas|Nada|Nadie|Ninguna?|Alg[uú]n|Alguna|Ya|Solo|S[oó]lo|Hoy|Vale|Ojo|Luego|Antes|Despu[eé]s|Cuando|Entonces)$/;
        const nombresC = (clausula.match(/\b[A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:-[A-Z0-9]+)*\b|\b[A-Z]{2,4}-[A-Z0-9-]{3,}\b/g) || []).filter((w) => !_COMUNES.test(w)).length;
        if (!(conMetricaC || parseFigures(clausula).length > 0 || nombresC >= 1)) return false;
        /* dentro de una condicional («si tu lista quedó baja», «si el costo subió») es una hipótesis, no un hecho */
        if (/(?:^|[\s,;:(])si\s+(?!no\b)(?:tu|el|la|los|las|su|sus|un|una|es[eo]s?|est[eo]s?)?\s*[^,;:]{0,40}$/i.test(clausula.slice(0, Math.max(0, p.pos - ini)))) return false;
      }
      /* «resolvería LG-DRYER8KG primero», «yo miraría primero a Lider»: el orden de una acción recomendada, no un ranking */
      if (p.clase === "orden" && /^(?:primer|segund|tercer|[uú]ltim)/i.test(p.span) && _RECOMIENDA.test(o)) return false;
      /* un ordinal ordena cuando va con lo ordenado: «segunda cuenta en crecimiento», «va tercero», «el segundo mayor»; «y una quinta» no */
      if (p.clase === "orden" && /^(?:primer|segund|tercer|cuart|quint|sext|s[eé]ptim|octav|noven|d[eé]cim)/i.test(p.span)) {
        const tras = s.slice(p.fin, p.fin + 30), antes = s.slice(Math.max(0, p.pos - 25), p.pos);
        if (_ESTRUCTURA.test(tras)) return false;   // «La primera señal», «el segundo riesgo»: la estructura de la respuesta, no un puesto
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
function _ubicar(prosaN, mapa, fragmento, desde = 0) {
  const f = normalizar(fragmento);
  if (!f) return null;
  let i = prosaN.indexOf(f, desde);
  if (i < 0 && desde > 0) return null;
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
  /* un fragmento que aparece más de una vez en la prosa (el cierre del cruce repetido por el inventario) es la misma afirmación: cubre todas */
  const _todas = (texto) => { const out = []; let r = _ubicar(prosaN, mapa, texto); const fN = normalizar(texto); let desde = r ? prosaN.indexOf(fN) + fN.length : -1; while (r) { out.push(r); if (desde < 0) break; r = _ubicar(prosaN, mapa, texto, desde); if (r) desde = prosaN.indexOf(fN, desde) + fN.length; } return out; };
  const decl = normalizarAfirmaciones(afirmaciones).map(({ afirmacion: a }) => { const rangos = _todas(a.texto); return { a, rango: rangos[0] || null, rangos }; });
  const canonDeclarados = new Set();
  const canonColas = new Set();   // lo que cubre SOLO una cola «(y N más)»: el universo del orden menos los listados, el conteo menos sus enumerados
  const canonK = new Set();   // la k de cada top-k declarado: «separar en tres cuentas» después de listar las tres
  for (const { a } of decl) {
    if (a.tipo === "lectura") continue;
    for (const v of [a.valor, a.variacion && a.variacion.valor, a.relacion && a.relacion.valor]) if (v && v.canon) canonDeclarados.add(String(v.canon).replace(/\$/g, ""));
    if (a.conteo && Number.isFinite(a.conteo.n)) canonDeclarados.add(`count:${a.conteo.n}`);
    if (a.conteo && Number.isFinite(a.conteo.m)) canonDeclarados.add(`count:${a.conteo.m}`);
    if (a.grupo && Number.isFinite(a.grupo.n)) canonDeclarados.add(`count:${a.grupo.n}`);
    /* la cola de una lista («(y N más)») es el universo del orden top-k menos los listados, o el conteo menos sus enumerados: queda
     * declarada por ellos (el verificador exige el universo completo para el orden y cuenta el predicado para el conteo) */
    if (a.tipo === "orden" && a.orden && a.orden.forma === "topk") { const k = Number.isFinite(a.orden.k) ? a.orden.k : Array.isArray(a.sujeto) ? a.sujeto.length : 0; if (k > 1) canonK.add(`count:${k}`); const U = /\b(\d+)\b/.exec(String(a.universo || "")); if (k > 0 && U && Number(U[1]) > k) canonColas.add(`count:${Number(U[1]) - k}`); }
    if (a.tipo === "conteo" && a.conteo && Number.isFinite(a.conteo.n) && Array.isArray(a.sujeto) && a.sujeto.length > 0 && a.sujeto.length < a.conteo.n) canonColas.add(`count:${a.conteo.n - a.sujeto.length}`);
  }
  const _METRICA_DE_VARIACION = /yoy|variaci|crecim|ca[ií]da|vs\s+a[ñn]o\s+anterior|contra\s+el\s+a[ñn]o\s+anterior/i;
  const out = { puntos: puntos.length, cubiertos: 0, negados: 0, omisiones: [], cobertura: 1 };
  let afirmados = 0;
  for (const p of puntos) {
    if (p.negado) { out.negados++; continue; }
    afirmados++;
    const envuelven = decl.filter(({ rangos }) => rangos.some((rango) => p.pos >= rango[0] - 3 && p.fin <= rango[1] + 3));
    /* una cifra se cubre DECLARÁNDOLA (mismo canon en el valor de alguna afirmación de hecho); un orden que la envuelve sin declararla no la cubre */
    const esCola = /\by\s*$/i.test(s.slice(Math.max(0, p.pos - 4), p.pos)) && /^\s*(?:[a-záéíóúñ]+\s+)?m[aá]s\b/i.test(s.slice(p.fin, p.fin + 24));
    const numeroDelOrden = p.unit === "count" && Number.isFinite(p.raw) && envuelven.some(({ a }) => a.tipo === "orden" && ((a.orden && a.orden.k === p.raw) || new RegExp("\\b" + p.raw + "\\b").test(String(a.universo || ""))));   // «los 3 que más pesan», «1º de 13»
    /* «separar en tres cuentas» después de listar las tres: un grupo dicho en PALABRAS (no en dígitos) cuyo tamaño es la k de un top-k declarado */
    const _nGrupo = (() => { const m = /^(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/i.exec(String(p.span)); return m ? _PALABRA_NUM_VALOR[m[1].toLowerCase()] : null; })();
    const mencionDeGrupo = (p.clase === "grupo" || (p.clase === "cifra" && p.suelto)) && _nGrupo != null && /\b(?:cuentas?|clientes?|skus?|bodegas?|marcas?)\b/i.test(s.slice(p.pos, p.fin + 12)) && canonK.has(`count:${_nGrupo}`);
    /* la cola de una lista con viñetas o numerada: los ítems listados justo arriba son la k; un conteo que envuelve la cola la cubre si n − k = N */
    const colaDeLista = esCola && p.canon && (() => {
      const iniLinea = s.lastIndexOf("\n", p.pos) + 1;
      const previas = s.slice(0, iniLinea).split("\n"); let k = 0;
      for (let j = previas.length - 1; j >= 0; j--) { const l = previas[j]; if (/^\s*$/.test(l)) { if (k) break; continue; } if (/^\s*(?:[-•·*]|\d{1,2}[.)])\s/.test(l)) k++; else break; }
      return k > 0 && envuelven.some(({ a }) => a.tipo === "conteo" && a.conteo && Number.isFinite(a.conteo.n) && `count:${a.conteo.n - k}` === p.canon);
    })();
    /* una relación multiplicativa («4.9x», «dos veces», «el doble») solo la cubre una relación declarada (o una cifra con ese canon de razón) */
    const esRazon = p.clase === "relacion" && /^(?:\d+(?:[.,]\d+)?\s*(?:veces|x)\b|(?:dos|tres|cuatro|cinco|seis|diez)\s+veces|(?:el|al|del)?\s*doble|dobla|duplica|triplica|cuadruplica|(?:el\s+|del\s+)?triple|(?:la\s+)?mitad|(?:un\s+)?tercio)/i.test(String(p.span).trim());
    if (esRazon) {
      const razonDeclarada = envuelven.some(({ a }) => a.tipo === "relacion") || (p.canon && canonDeclarados.has(p.canon)) || [...envuelven].some(({ a }) => a.valor && a.valor.unidad === "ratio");
      if (razonDeclarada) { out.cubiertos++; continue; }
      out.omisiones.push({ clase: envuelven.length ? "significado-no-declarado:relacion" : "relacion", span: p.span, pos: p.pos, motivo: `«${p.span}» es una relación (una razón) y no está declarada como tal` });
      continue;
    }
    /* «las acciones subieron a 5.5% contra 4.5% del año»: una relación mayor/menor que envuelve el verbo de dirección es ese hecho */
    const relacionDirigida = p.clase === "variacion" && envuelven.some(({ a }) => a.tipo === "relacion" && a.relacion && /^(?:mayor|menor)$/.test(String(a.relacion.forma)));
    const cubre = numeroDelOrden || mencionDeGrupo || colaDeLista || relacionDirigida || (esCola && p.canon && canonColas.has(p.canon)) || (p.clase === "cifra" ? (p.canon && canonDeclarados.has(p.canon)) : envuelven.some(({ a }) => _CUBRE[p.clase].has(a.tipo) || (p.clase === "variacion" && a.tipo === "orden" && _METRICA_DE_VARIACION.test(String(a.metrica || "")))));   // «quién empuja el crecimiento» es un orden por la variación
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
