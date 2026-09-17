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
import { ubicarFragmento } from "./ubicar.js";   // fase 4: el fragmento declarado se ubica con tolerancia (el mismo ubicador del juez)
import { menosAscii } from "./afirmacion.js";
import { metricasEn } from "./evidencia.js";   // el del muro + las métricas derivadas de la proyección
import { normalizar, normalizarAfirmaciones } from "./afirmacion.js";
import { estadoCanon, ESTADOS_CANON, ESTADO_PROSA_SRC, ESTADO_NOMBRADO_SRC, estadosCompatibles, complementoDe, estadoDeLaCasa } from "./estados.js";
import { duenosEstructurales } from "./estructura.js";   // tablas, listas y encabezados: el dueño de un punto antes que el de su oración

/* una RECOMENDACIÓN («resolvería LG-DRYER8KG primero», «yo miraría primero a Lider») ordena acciones, no entidades en una métrica */
const _RECOMIENDA = /\b(?:yo|resolver[ií]a|mirar[ií]a|atacar[ií]a|priorizar[ií]a|empezar[ií]a|ir[ií]a|cerrar[ií]a|negociar[ií]a|liberar[ií]a|cobrar[ií]a|revisar[ií]a|recomiendo|sugiero|conviene|deber[ií]a|habr[ií]a\s+que|hay\s+que|lo\s+primero|primero\s+(?:a|con|por|hay)|prioridad|ir\s+primero|van?\s+primero|raz[oó]n\s+de\s+ir|pondr[ií]a|pondr[eé]|el\s+foco)\b/i;
/* una OFERTA: lo que se propone abrir después («si quieres, te abro…», «¿te abro…?», «puedo abrirte…», «cuando digas»); no afirma */
const _OFERTA = /(?:^|[.\n]\s*)(?:¿\s*)?(?:si\s+(?:quieres|prefieres|te\s+sirve),?\s+te\s+(?:abro|bajo|cruzo|separo|muestro)|¿?\s*te\s+abro\b|puedo\s+abrirte\b|te\s+puedo\s+abrir\b|¿?\s*quieres\s+que\s+(?:te\s+)?(?:abra|baje|cruce|separe|muestre)|cuando\s+digas\b|cuando\s+quieras\b)/i;
const _NEGACION = /\b(?:no|sin|ni|nada|ning[uú]n[oa]?|tampoco|imposible|no\s+hay|no\s+se\s+puede|no\s+puedo|no\s+podemos|no\s+sabemos|no\s+permite|no\s+alcanza\s+para|antes\s+de\s+decir|para\s+decir\s+si)\b/i;
/* la negación EPISTÉMICA («no hay serie para decir si cae», «sin evidencia de que crezca», «no puedo decir si…») exime a un orden o una variación;
 * la negación FACTUAL («no crece», «no es la que más vende») los afirma con signo cambiado: siguen siendo hechos que declarar */
const _NEG_EPISTEMICA = /\b(?:no\s+hay|no\s+se\s+puede|no\s+puedo|no\s+podemos|no\s+sabemos|no\s+s[eé]\b|no\s+permite|no\s+alcanza\s+para|antes\s+de\s+decir|para\s+decir\s+si|sin\s+(?:evidencia|serie|datos?|historial|base|informaci[oó]n)|no\s+consta|no\s+tengo|no\s+tenemos|falta(?:n)?\s+(?:datos?|serie|evidencia|historial)|imposible\s+(?:saber|decir)|no\s+(?:lo\s+)?(?:puedo|podr[ií]a)\s+(?:afirmar|confirmar|decir)|no\s+se\s+(?:puede|sabe))\b/i;
const _ORDEN_RE = /\b(?:(?:queda|quedan|va|van|est[aá]n?)\s+a\s+la\s+zaga\s+de|a\s+la\s+zaga\s+de|se\s+queda(?:n)?\s+cort[oa]s?\s+frente\s+a|le\s+saca(?:n)?\s+ventaja\s+a|lleva(?:n)?\s+la\s+delantera|supera(?:n)?\s+(?:con\s+[a-záéíóúñ]+\s+)?a\b|aventaja(?:n)?\s+a|le\s+gana(?:n)?\s+a|adelanta(?:n)?\s+a|sobrepasa(?:n)?\s+a|rebasa(?:n)?\s+a|deja(?:n)?\s+atr[aá]s\s+a|manda(?:n)?\s+en|por\s+sobre\s+(?:el\s+|la\s+)?[A-ZÁÉÍÓÚ]|completa(?:n)?\s+el\s+podio|(?:va|van|est[aá]n?|queda|quedan|sigue|siguen)\s+en\s+cabeza|en\s+cabeza\s+(?:de|del|por|con)\b|cierra(?:n)?\s+(?:la\s+)?(?:tabla|lista|el\s+ranking|el\s+listado)|al\s+fondo\s+de\s+la\s+(?:tabla|lista)|en\s+el\s+podio|escolta\s+a\b|(?:vienen?|van?|quedan?|est[aá]n?)\s+(?:justo\s+)?detr[aá]s\b|(?:le|les)\s+siguen?\b|siguen?\s+(?:en\s+la\s+lista|en\s+el\s+ranking|en\s+el\s+orden)|seguid[oa]s?\s+(?:de|por)\b|a\s+continuaci[oó]n\s+(?:va|van|viene|vienen|est[aá]n?)|(?:en|el|la)\s+segundo\s+lugar|(?:el|la|los|las|quien|quienes)\s+(?:[a-záéíóúñ0-9]+\s+){0,2}que\s+(?:[a-záéíóúñ]+\s+)?(?:m[aá]s|menos)\b|(?:es|son|est[aá]n?|queda|quedan)\s+(?:m[aá]s|menos)\s+que\b|(?:el|la|los|las|quien|quienes)\s+(?:m[aá]s|menos)\b|m[aá]s\s+(?:alt[oa]s?|baj[oa]s?|grandes?|pequeñ[oa]s?|graves?|pesad[oa]s?|caros?|barat[oa]s?|lent[oa]s?|r[aá]pid[oa]s?|larg[oa]s?|cort[oa]s?|fuertes?|d[eé]bil(?:es)?|deteriorad[oa]s?|comprometid[oa]s?|delicad[oa]s?|urgentes?|leves?|severa?s?|profund[oa]s?|moros[oa]s?|atrasad[oa]s?|rezagad[oa]s?|rentables?|endeudad[oa]s?|vendid[oa]s?|cargad[oa]s?|concentrad[oa]s?|frenad[oa]s?|inmovilizad[oa]s?|cr[ií]tic[oa]s?|expuest[oa]s?|riesgos[oa]s?|vencid[oa]s?|castigad[oa]s?|afectad[oa]s?|golpead[oa]s?|s[oó]lid[oa]s?|san[oa]s?|holgad[oa]s?|ajustad[oa]s?|estrech[oa]s?|amplios?|relevantes?|importantes?|significativ[oa]s?|material(?:es)?|valios[oa]s?|productiv[oa]s?|eficientes?|activ[oa]s?|din[aá]mic[oa]s?|estables?|puntual(?:es)?|cumplidor(?:es|a|as)?|complicad[oa]s?|problem[aá]tic[oa]s?|conflictiv[oa]s?)|(?:vende|aporta|debe|acumula|contribuye|factura|margina|rota|pesa|concentra|tiene|compra|mueve|deja|arrastra)\s+(?:m[aá]s|menos)\s+[a-záéíóúñ]+(?!\s+que)|(?:mayor|menor|peor|mejor)(?:es)?\b|con\s+(?:m[aá]s|menos)\s+[a-záéíóúñ]+|m[aá]s\s+(?:delgad[oa]s?|lejos|cerca|arriba|abajo|pegad[oa]s?)|(?:m[aá]s|menos)\s+[a-záéíóúñ]+\s+que\s+[A-ZÁÉÍÓÚ][a-záéíóúñ]*|(?:vende|aporta|debe|acumula|contribuye|factura|margina|rota|pesa|concentra|tiene|compra|mueve)\s+(?:m[aá]s|menos)\s+que\b|primer[oa]?s?\b|segund[oa]s?\b|tercer[oa]?s?\b|cuart[oa]s?\b|quint[oa]s?\b|sext[oa]s?\b|s[eé]ptim[oa]s?\b|octav[oa]s?\b|noven[oa]s?\b|d[eé]cim[oa]s?\b|[uú]ltim[oa]s?\b|encabeza|lidera\b|se\s+lleva\s+la\s+palma|por\s+delante\s+de|por\s+encima\s+de|por\s+debajo\s+de|supera\s+(?:al?|en)\b|superan\s+(?:al?|en)\b|nadie\s+(?:supera|vende|aporta|debe|acumula|tiene)|ning[uú]n[ao]?\s+[a-záéíóúñ]+\s+(?:supera|vende|aporta|debe|acumula|tiene|llega)|top\s*\d|ranking|en\s+este\s+orden|el\s+orden\s+(?:es|queda)|por\s+orden\s+de|de\s+mayor\s+a\s+menor|de\s+menor\s+a\s+mayor|concentra\s+el\s+mayor|la\s+mayor\s+parte|a\s+la\s+cabeza|al\s+frente|en\s+la\s+cola|cierra\s+la\s+lista|solo\s+detr[aá]s\s+de|detr[aá]s\s+de)\b/gi;
const _RELACION_RE = /(?:\b|(?=[$\d]))(?:el\s+grueso\s+de|la\s+mayor\s+parte\s+de|pr[aá]cticamente\s+tod[oa]|casi\s+tod[oa]\s+(?:est[aá]|se|el|la|lo)|(?:una\s+|la\s+)?(?:quinta|cuarta|tercera|sexta|s[eé]ptima|octava|d[eé]cima)\s+parte|(?:dos|tres|cuatro)\s+(?:tercios|cuartos|quintos|d[eé]cimos)|un\s+d[eé]cimo|(?:una|dos|tres|cuatro|cinco|\d+)\s+vueltas?\s+(?:al\s+a[ñn]o|por\s+a[ñn]o|anuales)|,\s+como\s+[A-ZÁÉÍÓÚ][\wÁÉÍÓÚáéíóúñ-]+|al\s+igual\s+que\s+[A-ZÁÉÍÓÚ]|igual\s+que\s+[A-ZÁÉÍÓÚ]|(?:el|la|los|las)\s+mism[oa]s?\s+[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)?\s+que\s+[A-ZÁÉÍÓÚ]|igual\s+de\s+[a-záéíóúñ]+\s+que\s+[A-ZÁÉÍÓÚ]|tan\s+[a-záéíóúñ]+\s+como\s+[A-ZÁÉÍÓÚ]|a\s+la\s+par\s+(?:de|con)|lo\s+mismo\s+que|otro\s+tanto|(?:el|al|del)\s+doble|dobla|duplica|triplica|cuadruplica|(?:el\s+|del\s+)?triple|(?:la\s+)?mitad|(?:un\s+)?tercio|(?:un\s+)?cuarto\s+de|(?:\d+(?:[.,]\d+)?|dos|tres|cuatro|cinco|seis|diez)\s*(?:veces|x)\b|(?:de|De)\s+cada\s+(?:\d+|dos|tres|cuatro|cinco|diez)\b|casi\s+(?:igual|tanto|lo\s+mismo)|igual\s+que|tanto\s+como|equivale\s+a|\d+(?:[.,]\d+)?\s?%\s+(?:de|del)\s+(?:la|el|los|las|su|sus|ese|esa|toda|todo|lo)\b|(?:m[aá]s|menos)\s+que\s+[A-ZÁÉÍÓÚ]|[$\d][\d.,]*\s?(?:[KMB%]|pp|d[ií]as|d)?\s+contra\s+\$?[\d.,]+|(?:bajo|sobre|por\s+encima\s+de|por\s+debajo\s+de|lejos\s+de|cerca\s+de)l?\s+(?:el\s+|la\s+)?(?:benchmark|referencia|piso|nivel))/g;
const _GRUPO_RE = /\b(?:tod[oa]s\s+(?:las|los)\s+(?:cuentas|clientes|skus?|marcas|familias|bodegas)(?:\s+(?:salvo|menos|excepto)\s+\S+)?|ninguna?\s+(?:cuenta|cliente|sku|marca|familia|bodega)\b|(?:\d+|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece)\s+(?:de\s+(?:las?|los|esas?|esos|ellas|ellos)\s+)?(?:\d+\s+)?(?:cuentas?|clientes?|skus?|sku|bodegas?|marcas?|familias?|referencias?|productos?)\b|\d+\s+de\s+(?:las?\s+|los\s+)?\d+\b|entre\s+(?:las|los)\s+(?:\d+|dos|tres|cuatro|cinco)\b(?!\s+(?:n[uú]meros?|cifras?|precios?|valores?|columnas?|montos?|puntos?|lados?|casos?|extremos?|meses|a[ñn]os|per[ií]odos?|escenarios?|caminos?|hip[oó]tesis|lecturas?|opciones?|alternativas?|se[ñn]ales|riesgos?|focos?|mundos?|universos?))|(?:las|los)\s+(?:dos|tres|cuatro|cinco|seis|ocho)\s+(?:grandes|cuentas|clientes|sku|skus|que|más|mayores|motores|primer[oa]s|restantes)\b|ese\s+(?:mismo\s+)?grupo|en\s+conjunto|entre\s+(?:ambas|ambos|las\s+dos|los\s+dos|las\s+tres|los\s+tres)\b(?!\s+(?:n[uú]meros?|cifras?|precios?|valores?|columnas?|montos?|puntos?|lados?|casos?|extremos?|meses|a[ñn]os|per[ií]odos?|escenarios?|caminos?|hip[oó]tesis|lecturas?|opciones?|alternativas?|se[ñn]ales|riesgos?|focos?|mundos?|universos?))|(?:suman|totalizan|acumulan)\s+(?:entre\s+)?(?:las|los|ambas|ambos|un|el|la)?)/gi;
const _VARIACION_RE = /\b(?:va(?:n)?\s+en\s+picada|en\s+picada|se\s+hund(?:e|en|i[oó]|ieron)|se\s+derrumb(?:a|an|[oó]|aron)|merm(?:a|an|[oó]|aron)|afloj(?:a|an|[oó]|aron)|se\s+enfr[ií](?:a|an|[oó]|aron)|se\s+dispar(?:a|an|[oó]|aron)|despeg(?:a|an|[oó]|aron)|crec(?:e|en|i[oó]|ieron|iendo)|ca(?:e|en|y[oó]|yeron|yendo)|sub(?:e|en|i[oó]|ieron|iendo)|baj(?:a|an|ó|aron|ando)(?![a-záéíóúñ])|se\s+deterior(?:a|an|[oó]|aron)|mejor(?:a|an|[oó]|aron)|empeor(?:a|an|[oó]|aron)|retroced(?:e|en|i[oó]|ieron)|avanz(?:a|an|[oó]|aron)|aument(?:a|an|[oó]|aron)|disminu(?:ye|yen|y[oó]|yeron)|descend(?:i[oó]|ieron)|se\s+redu(?:jo|jeron|ce|cen)|se\s+contra(?:jo|jeron|e|en)|se\s+desplom(?:a|an|[oó]|aron)|repunt(?:a|an|[oó]|aron)|(?:vend(?:e|es|en|iendo|emos|i[oó]|ieron)|factur(?:a|an|ando|[oó]))\s+m[aá]s(?!\s+(?:que|de\b|del\b|unidades|a\b|en\b))|variaci[oó]n|YoY|interanual|respecto\s+(?:al|del)\s+a[ñn]o|vs\.?\s+a[ñn]o|a[ñn]o\s+anterior|a[ñn]o\s+pasado|dólares\s+nuevos|pierde\s+\$|gana\s+\$)(?![a-záéíóúñ])/gi;
const _ESTADO_RE = new RegExp("(?<!capital\\s)(?<!del\\s)(?<!el\\s)(?<!de\\s)(?<!d[ií]as\\s)(?<!m[aá]s\\s)(?<!menos\\s)(?<![a-záéíóúñ])(?:" + ESTADO_PROSA_SRC + ")(?![a-záéíóúñ])", "gi");   // bordes por letra, no `\\b`: tras «regularizó» no hay borde `\\w`   // los estados de la casa (estados.js), reconocidos en la prosa
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
  estado: new Set(["estado"]),   // una cifra, un conteo o un grupo lo cubren solo si su métrica o predicado nombra ESE estado (ver _estadoCubierto)
};
const _ESTADOS_DE_LA_CASA = ESTADOS_CANON;
/* ── la envoltura por SIGNIFICADO: un orden/relación cubre el superlativo de su cláusula si habla de la misma métrica y del mismo sujeto ── */
const _CLAVES_IGNORADAS = new Set(["participacion", "variacion"]);
const _clavesDe = (t) => new Set([...metricasEn(normalizar(String(t || "")))].filter((k) => !_CLAVES_IGNORADAS.has(k)));
/* la cláusula del punto: desde el corte anterior ([.;:] o una coordinación « y » / «, ») hasta el siguiente */
function _clausulaDelPunto(s, p) {
  const antes = s.slice(0, p.pos), despues = s.slice(p.fin);
  const ultimo = (str, re) => { let m, last = -1; const g = new RegExp(re.source, "gi"); while ((m = g.exec(str))) { last = m.index + m[0].length - 1; if (!m[0].length) g.lastIndex++; } return last; };
  const ia = Math.max(ultimo(antes, /[.;:—()]\s?/), ultimo(antes, /\s(?:y|e|pero|mientras|aunque)\s/), ultimo(antes, /,\s/));
  const md = /[.;:—()]|\s+(?:y|e|pero|mientras|aunque)\s+|,\s+/i.exec(despues);
  return s.slice(ia >= 0 ? ia + 1 : 0, p.fin + (md ? md.index : despues.length));
}
/* las claves de cobranza se confunden en la prosa («debe» es pendiente y también vencido): compatibles entre sí */
const _COBRANZA = new Set(["pendiente", "vencido", "abonado", "porvencer"]);
/* la brecha en dinero de la casa: «contribución no capturada» / «brecha por precio y costo» se dicen «brecha», «arrastre de margen», «margen cedido» */
const _ES_BRECHA_EN_DINERO = (metrica) => /no\s+capturad|sin\s+capturar|brecha\s+por\s+precio|brecha\s+en\s+\$|brecha\s+de\s+contribuci/.test(normalizar(String(metrica || "")));
/* las palabras pegadas al superlativo: hasta dos antes y tres después, sin cruzar un corte de cláusula */
function _ventanaDelSuperlativo(s, p) {
  const antes = s.slice(Math.max(0, p.pos - 40), p.pos).split(/[.;:,—()]/).pop() || "";
  const despues = (s.slice(p.fin, p.fin + 50).split(/[.;:,—()]|\s+(?:y|e|pero|mientras|aunque)\s+/)[0] || "");
  const DET = /^(?:el|la|los|las|un|una|unos|unas|su|sus|tu|tus|mi|mis|cada|de|del|al|a|en|con|por|para|que|quien|quienes|es|son|esta|estan|lo|ese|esa|eso|esos|esas|este|esto|estos|estas|aquel|aquella|aquellos|aquellas|dicho|dicha)$/i;
  const w1 = antes.trim().split(/\s+/).filter((w) => w && !DET.test(w)).slice(-1).join(" ");
  const palabras = despues.trim().split(/\s+/).filter(Boolean);
  let k = 0; while (k < palabras.length && DET.test(palabras[k])) k++;
  const primera = palabras[k] || "";
  const w2 = /^(?:d[ií]as?|puntos?|pp|unidades|meses|semanas|veces)$/i.test(primera) ? palabras.slice(k, k + 3).join(" ") : primera;
  return `${w1} ${p.span} ${w2}`;
}
function _metricaCompatible(s, p, a) {
  const clausula = _ventanaDelSuperlativo(s, p);
  /* un comparador contra una REFERENCIA de la casa («por debajo de esa referencia», «bajo el benchmark», «sobre el nivel») habla de la métrica de
   * la referencia, no del verbo de la cláusula («12 SKU venden por debajo del benchmark» es margen): no se contrasta por claves */
  if (/\b(?:benchmark|referencia|nivel\s+(?:de\s+carga|declarado)|piso|techo|umbral)\b/.test(normalizar(clausula))) return true;
  const kp = _clavesDe(clausula);
  const ka = _clavesDe(a.metrica);
  if (!kp.size || !ka.size) return true;
  if ([...kp].some((k) => ka.has(k))) return true;
  if ([...kp].every((k) => _COBRANZA.has(k)) && [...ka].some((k) => _COBRANZA.has(k))) return true;
  /* «más pegado al costo» es el markup (precio de lista sobre costo) */
  if (ka.has("markup") && [...kp].every((k) => k === "costo" || k === "markup")) return true;
  /* «el mayor arrastre de margen», «la mayor brecha individual ($1,6M sin capturar)», «quienes más margen ceden» ↔ «Contribución no capturada» */
  if (_ES_BRECHA_EN_DINERO(a.metrica) && [...kp].every((k) => k === "brecha" || k === "margen" || k === "contribucion")) return true;
  if ((ka.has("brecha") || _ES_BRECHA_EN_DINERO(a.metrica)) && /sin\s+capturar|no\s+capturad|arrastre|ceden?|cedid/.test(normalizar(clausula))) return true;
  return false;
}
/* «fuera de los que más venden», «entre los que más pesan», «de los 3 que más cargan»: el superlativo tras una preposición nombra un GRUPO */
const _esGrupoTrasPreposicion = (s, p) => /(?:\b(?:entre|de|del|fuera\s+de|dentro\s+de|con|sin|a|para|por|contra|frente\s+a)\s+(?:(?:los|las|el|la|quienes|es[oa]s|est[oa]s)\s+)?(?:\d+\s+)?)$/i.test(s.slice(Math.max(0, p.pos - 24), p.pos));
function _sujetoCompatible(s, p, a, nombres) {
  if (_esGrupoTrasPreposicion(s, p)) return true;
  const sujetos = Array.isArray(p.sujetos) ? p.sujetos : (p.sujetos = _sujetosDelPunto(s, p, nombres));
  if (!sujetos.length) return true;
  const decl = [];
  const mete = (x) => { if (typeof x === "string") decl.push(normalizar(x)); else if (Array.isArray(x)) x.forEach(mete); else if (x && typeof x === "object" && typeof x.sujeto === "string") decl.push(normalizar(x.sujeto)); };
  mete(a.sujeto); if (a.relacion) mete(a.relacion.vs); if (a.orden && a.orden.vs) mete(a.orden.vs);
  if (!decl.length) return true;   // un sujeto descrito («las 5 cuentas materiales»): no se restringe por nombre
  return sujetos.some((x) => decl.some((y) => y === x || y.includes(x) || x.includes(y)));
}
/* las palabras de variación de un predicado: las mismas formas que detectan un punto de variación en la prosa, más el nombre de la variación
 * («bajo el benchmark» no es una variación: es una relación con la referencia) */
const _VAR_PALABRAS = new RegExp("(?:" + _VARIACION_RE.source + ")|variaci|yoy|vs\\s+a[ñn]o\\s+anterior|contra\\s+el\\s+a[ñn]o\\s+anterior|vs\\s+(?:presupuesto|ppto)", "i");
function _cubrePorClase(p, a, s, nombres) {
  if (p.clase === "variacion") {
    /* «6 de los que caen», «quienes caen tienen el precio más pegado al costo»: el nombre del grupo de la casa (los clientes bajo el benchmark) */
    if (/(?:los|las|quienes|el\s+grupo\s+de\s+los)\s+que\s*$/i.test(s.slice(Math.max(0, p.pos - 24), p.pos)) && a.tipo !== "lectura") {
      const t = normalizar([a.universo && (Array.isArray(a.universo) ? a.universo.join(" ") : a.universo), a.conteo && a.conteo.predicado, a.sujeto && typeof a.sujeto === "object" ? a.sujeto.descripcion : "", a.metrica].filter(Boolean).join(" "));
      if (/benchmark|\bcaen\b|\bcaida\b|los que caen|quienes caen/.test(t)) return true;
    }
    /* «cae» / «caen» sin métrica pegada = «está bajo el benchmark» (el verbo de la casa): lo cubre la declaración que nombra el benchmark */
    if (/^ca(?:e|en|ida|yo|yeron)$/i.test(normalizar(p.span)) && a.tipo !== "lectura" && !/^(?:cae|caen|cay[oó]|cayeron)\s+(?:en|de)\s+(?:la\s+|el\s+|las\s+|los\s+)?[a-záéíóúñ]/i.test(s.slice(p.pos, p.fin + 20))) {
      const t = normalizar([a.universo && (Array.isArray(a.universo) ? a.universo.join(" ") : a.universo), a.conteo && a.conteo.predicado, a.sujeto && typeof a.sujeto === "object" ? a.sujeto.descripcion : "", a.metrica].filter(Boolean).join(" "));
      if (/benchmark/.test(t)) return true;
    }
    if (a.tipo === "orden") return _METRICA_DE_VARIACION_G.test(String(a.metrica || ""));
    if (!_CUBRE.variacion.has(a.tipo)) return false;
    if (a.tipo === "variacion") return true;
    if (_VAR_PALABRAS.test(normalizar([a.conteo && a.conteo.predicado, a.universo, a.metrica, a.sujeto && typeof a.sujeto === "object" ? a.sujeto.descripcion : ""].filter(Boolean).join(" ")))) return true;
    /* «Tottus y Mercado Libre (12,3 %) caen sin que…» declarado como conteo de ESOS sujetos: la variación sin métrica dicha es el papel del conteo */
    const ventana = s.slice(Math.max(0, p.pos - 30), p.fin + 16).replace(/^[^s]*s/, "");   // el verbo y su objeto inmediato («caen en venta»), no la subordinada («sin que la carga…»)
    return !_clavesDe(ventana).size && Array.isArray(a.sujeto) && a.sujeto.length > 0 && _sujetoCompatible(s, p, a, nombres);
  }
  if (p.clase === "orden") {
    if (!_CUBRE.orden.has(a.tipo)) return false;
    /* el superlativo dicho como GRUPO tras una preposición («entre los que más venden», «fuera de los que más contribuyen», «de los 3 que más
     * cargan») nombra un conjunto —su métrica va en la propia frase—, no afirma un orden del sujeto: lo cubre cualquier orden o relación que lo envuelva */
    if (_esGrupoTrasPreposicion(s, p)) return true;
    return _metricaCompatible(s, p, a) && _sujetoCompatible(s, p, a, nombres);
  }
  return _CUBRE[p.clase].has(a.tipo);
}
const _METRICA_DE_VARIACION_G = /yoy|variaci|crecim|ca[ií]da|vs\s+a[ñn]o\s+anterior|contra\s+el\s+a[ñn]o\s+anterior/i;
/* «$14K de capital frenado» cubre el punto «frenado» de su oración, no «riesgo de quiebre»; «3 SKU con capital frenado» tampoco cubre «capital sano» */
const _ESTADO_LO_CUBRE = (dicho, declarado) => dicho === declarado || (dicho === "inmovilizado" && (declarado === "frenado" || declarado === "sobrestock"));
/* el estado canónico de un punto: el dicho, o su contrario si la prosa lo niega («no está al día» = «en mora») */
const _estadoDelPunto = (p) => { const d = estadoCanon(p.span); if (p.negadoEstado) { const c = complementoDe(d); return c || d; } return d; };
function _estadoCubierto(span, a, p = null) {
  const d = p ? _estadoDelPunto(p) : estadoCanon(span);
  if (a.tipo === "estado") {
    if (!_ESTADOS_DE_LA_CASA.has(d)) return true;
    const decl = a.estado && a.estado.estado ? estadoCanon(a.estado.estado) : "";
    if (!_ESTADO_LO_CUBRE(d, decl)) return false;
    /* los DUEÑOS del punto («SAM-REF500L y PHI-IRON-PRO están en riesgo»): la declaración tiene que nombrar a cada uno (sujeto o lista) */
    if (p && Array.isArray(p.sujetos) && p.sujetos.length) { const decl0 = Array.isArray(a.sujeto) ? a.sujeto.map(normalizar) : typeof a.sujeto === "string" ? [normalizar(a.sujeto)] : []; return p.sujetos.every((x) => decl0.some((y) => y === x || y.includes(x) || x.includes(y))); }
    return true;
  }
  if (!(a.tipo === "cifra" || a.tipo === "conteo" || a.tipo === "grupo" || a.tipo === "orden" || a.tipo === "relacion")) return false;
  const dicho = estadoCanon(span);
  /* el estado como UNIVERSO o BASE de la declaración («entre las cuentas sin mora», «de lo frenado en Valparaíso») también lo nombra */
  const baseTexto = a.base ? (typeof a.base === "object" ? a.base.texto : a.base) : "";
  const universoTexto = typeof a.universo === "string" ? a.universo : Array.isArray(a.universo) ? a.universo.join(" ") : "";
  const descripcion = a.sujeto && typeof a.sujeto === "object" ? a.sujeto.descripcion : "";
  const textoDecl = normalizar([a.tipo === "orden" || a.tipo === "relacion" ? "" : a.metrica, a.conteo && a.conteo.predicado, a.estado && a.estado.estado, universoTexto, baseTexto, descripcion, a.tipo === "cifra" ? "" : a.metrica].filter(Boolean).join(" "));
  if (!textoDecl) return false;
  if (_ESTADOS_DE_LA_CASA.has(dicho)) { const enDecl = [...textoDecl.matchAll(new RegExp(ESTADO_NOMBRADO_SRC, "g"))].map((m) => estadoCanon(m[0])); return enDecl.includes(dicho) || (dicho === "inmovilizado" && enDecl.some((e) => e === "frenado" || e === "sobrestock")); }
  /* «sin venta», «sin movimiento», «sin vencido», «por vencer»: la métrica o el predicado tienen que decirlo */
  const clave = normalizar(span).replace(/^sin\s+/, "").replace(/^por\s+/, "");
  return textoDecl.includes(clave);
}

/* la negación que cuenta es la de la cláusula del punto; NO cuentan: la de una subordinada relativa («los que no llegan al benchmark son 8»),
 * el nombre de una métrica («contribución no capturada»), ni una negación universal que en realidad es un superlativo («nadie vende más
 * que Falabella», «ninguna cuenta supera a Jumbo») */
function _negado(s, pos) {
  const antes = s.slice(Math.max(0, pos - 60), pos);
  /* una cifra con artículo definido o demostrativo («no te recuperan LOS $4.7M de contribución», «no alcanza ESE $1.6M») está presupuesta: la
   * negación cae sobre el verbo, la cifra se afirma igual */
  if (/(?:^|[^a-záéíóúñ])(?:los|las|el|la|es[oa]s?|est[oa]s?|aquell[oa]s?)\s+$/i.test(antes)) return false;
  const clausula = (antes.split(/[.;:—()]/).pop() || "").replace(/\b(?:que|quienes|donde|cuando)\s+(?:no|ni|sin)\b[^,]*/gi, "").replace(/\bno\s+captur[a-záéíóúñ]*/gi, "");
  /* la doble negación afirma: «No es que Lider no deje 22,0 %», «no es cierto que no…», «no sin» */
  if (/\bno\s+(?:es|era)\s+(?:que|cierto\s+que|verdad\s+que)\b[^.]{0,40}\bno\b/i.test(clausula) || /\bno\s+sin\b/i.test(clausula)) return false;
  if (/\b(?:nadie|ning[uú]n[ao]?)\b[^.]{0,30}$/i.test(clausula)) return false;
  return _NEGACION.test(clausula);
}
const _PALABRA_NUM_VALOR = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20 };
/* un número pelado o en palabras es una cifra cuando la oración lo ata a algo contable o medible («llegan a 190», «son 8 de 13», «son cinco de ocho») */
/* la duración dicha como HECHO (no como horizonte): «desde hace 6 meses», «lleva 3 semanas sin pagar», «acumula 2 años de atraso», «6 meses en mora» */
const _DURACION_HECHO_RE = /\b(?:desde\s+hace|hace(?:\s+ya)?|lleva(?:n)?(?:\s+ya)?|acumula(?:n)?|arrastra(?:n)?|suma(?:n)?|carga(?:n)?\s+con)\s+(\d+)\s+(meses|mes|semanas?|a[ñn]os?|trimestres?)\b|\b(\d+)\s+(meses|mes|semanas?|a[ñn]os?|trimestres?)\s+(?:sin\s+(?:pagar|abonar|comprar|vender|moverse|movimiento|rotar)|de\s+(?:atraso|mora|retraso|deuda|antig[üu]edad)|vencid[oa]s?|atrasad[oa]s?|en\s+mora|impag[oa]s?)\b/gi;
const _NUMERO_SUELTO_RE = /(?<![\d.,$%\w-])(\d{1,3}(?:\.\d{3})+|\d+)(?![.,]\d)(?![\d.,]*\s*(?:%|pp|d\b|x\b|M\b|K\b|d[ií]as?\b|unidades\b|cuentas?\b|clientes?\b|skus?\b|bodegas?\b|marcas?\b|puntos?\b|veces\b|meses\b|mes\b|semanas?\b|a[ñn]os?\b|trimestres?\b))\b/g;   // «0.3» no trae un 0; «12 meses» es un horizonte
/* «son tres», «hay cinco cuentas», «de los ocho» (partición) y «de tres cuentas» son números; «de una factura» es un artículo */
const _PALABRA_NUM_RE = /\b(?:(?:son|suman|llegan\s+a|de\s+cada|hay|quedan|totalizan)\s+(?:las\s+|los\s+)?(?:uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)\b(?!\s+(?:veces|dominios|lentes|cosas|movimientos|pasos|ejes|frentes|preguntas|razones|puntos|riesgos?|focos|se[ñn]ales|bloques|cap[ií]tulos|temas|lecturas))|\bde\s+(?:las|los)\s+(?:uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)\b(?!\s+(?:veces|dominios|lentes|cosas|movimientos|pasos|ejes|frentes|preguntas|razones|puntos|riesgos?|focos|se[ñn]ales|bloques|cap[ií]tulos|temas|lecturas))|\bde\s+(?:uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)\s+(?=cuentas?\b|clientes?\b|skus?\b|bodegas?\b|marcas?\b))/gi;
/* las cifras en palabras: número (en palabras o con coma decimal) + unidad («por ciento», «puntos», «millones», «mil», «dólares», «año de atraso»),
 * o un número en palabras con «más»/«menos» («Easy, diez más») */
const _NUMS_PALABRA = { cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, medio: 0.5, media: 0.5 };
const _NUM_PAL = "(?:(?:cien|ciento|doscient[oa]s|trescient[oa]s|cuatrocient[oa]s|quinient[oa]s|seiscient[oa]s|setecient[oa]s|ochocient[oa]s|novecient[oa]s)(?:\\s+(?:(?:treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)(?:\\s+y\\s+(?:un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve))?|veinti(?:un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)|dieci(?:seis|siete|ocho|nueve)|veinte|quince|catorce|trece|doce|once|diez|nueve|ocho|siete|seis|cinco|cuatro|tres|dos|uno|un|una))?|(?:treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)(?:\\s+y\\s+(?:un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve))?|veinti(?:un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)|dieci(?:seis|siete|ocho|nueve)|cien(?:to)?|veinte|quince|catorce|trece|doce|once|diez|nueve|ocho|siete|seis|cinco|cuatro|tres|dos|un|uno|una|medio|media)";
const _CIFRA_EN_PALABRAS_SRC = "(?:\\b(?:casi|apenas|unos?|unas?|cerca\\s+de|alrededor\\s+de|m[aá]s\\s+de|menos\\s+de|sobre|poco\\s+m[aá]s\\s+de|poco\\s+menos\\s+de)\\s+)?(?:\\b" + _NUM_PAL + "\\b|(?<![\\d.,$])\\d+(?:[.,]\\d+)?(?![\\d.,]*\\s*(?:%|[KMB]\\b)))\\s+(?:por\\s+ciento|puntos?(?:\\s+porcentuales)?|mill[oó]n(?:es)?(?:\\s+y\\s+medio)?(?:\\s+(?:[a-záéíóúñ]+\\s+)?mil)?(?:\\s+de\\s+(?:d[oó]lares|pesos))?|mil(?:\\s+(?:d[oó]lares|pesos|millones|unidades))?|d[oó]lares|vueltas?(?=\\s+(?:al\\s+a[ñn]o|por\\s+a[ñn]o|anuales))|d[ií]as?|a[ñn]os?(?=\\s+(?:de\\s+)?(?:atraso|mora|retraso|vencid[oa]s?|sin\\s+venta|de\\s+inventario|de\\s+cobertura))|meses(?=\\s+(?:de\\s+)?(?:atraso|mora|retraso|vencid[oa]s?|sin\\s+venta|de\\s+inventario|de\\s+cobertura)))\\b|(?<=,\\s|;\\s|\\by\\s)\\b" + _NUM_PAL + "\\s+(?:m[aá]s|menos)\\b";
function _cifraEnPalabras(m) {
  const t = normalizar(m[0]);
  const num = (() => { const d = /(?<![a-z])(\d+(?:[.,]\d+)?)/.exec(t); if (d) return parseFloat(d[1].replace(",", ".")); const w = new RegExp(_NUM_PAL).exec(t); if (!w) return null; const partes = w[0].split(/\s+(?:y\s+)?/); let v = 0; for (const p of partes) { if (_NUMS_PALABRA[p] == null) return null; v += _NUMS_PALABRA[p]; } return v; })();
  if (num == null || !Number.isFinite(num)) return null;
  /* «un millón y medio», «un millón seiscientos mil» */
  if (/mill[oó]n(?:es)?\s+y\s+medio/.test(t)) return { unit: "money", raw: (num + 0.5) * 1e6, canon: (parseFigures(`$${num + 0.5}M`)[0] || { canon: `money:${num + 0.5}M` }).canon.replace(/\$/g, "") };
  { const mm = /mill[oó]n(?:es)?\s+(.+?)\s+mil\b/.exec(t); if (mm) { const w = new RegExp("^" + _NUM_PAL + "$").test(mm[1]) ? mm[1].split(/\s+(?:y\s+)?/).reduce((acc, p) => acc + (_NUMS_PALABRA[p] || 0), 0) : null; if (w) { const raw = num * 1e6 + w * 1e3; const f = parseFigures(`$${Math.round(raw)}`)[0]; return { unit: "money", raw, canon: f ? f.canon.replace(/\$/g, "") : `money:${raw}` }; } } }
  if (/\bvueltas?\b/.test(t)) { const f = parseFigures(`${num}x`)[0]; return { unit: "ratio", raw: num, canon: f ? f.canon.replace(/\$/g, "") : `ratio:${num}x` }; }
  if (/por ciento/.test(t)) return { unit: "pct", raw: num, canon: `pct:${num}%` };
  if (/\bpuntos?\b/.test(t)) return num === 1 && !/\d/.test(t) && !/porcentual/.test(t) ? null : { unit: "pp", raw: num, canon: `pp:${num}pp` };   // «en un punto» es un aspecto, no 1 pp
  if (/millon/.test(t)) { const raw = num * 1e6; const f = parseFigures(`$${num}M`)[0]; return { unit: "money", raw, canon: f ? f.canon.replace(/\$/g, "") : `money:${num}M` }; }
  if (/\bmil\b/.test(t)) { const raw = num * 1e3; if (/unidades/.test(t)) return { unit: "count", raw, canon: `count:${raw}` }; const f = parseFigures(`$${num}K`)[0]; return { unit: "money", raw, canon: f ? f.canon.replace(/\$/g, "") : `money:${num}K` }; }
  if (/d[oó]lares/.test(t)) { const f = parseFigures(`$${num}`)[0]; return { unit: "money", raw: num, canon: f ? f.canon.replace(/\$/g, "") : `money:${num}` }; }
  if (/\ba[ñn]os?\b/.test(t)) return { unit: "days", raw: Math.round(num * 365), canon: `days:${Math.round(num * 365)}d` };
  if (/\bmeses\b/.test(t)) return { unit: "days", raw: Math.round(num * 30), canon: `days:${Math.round(num * 30)}d` };
  if (/d[ií]as?/.test(t)) return num === 1 ? null : { unit: "days", raw: num, canon: `days:${num}d` };   // «de un día para otro» es un modismo
  return { unit: "count", raw: num, canon: `count:${num}` };   // «diez más»
}
const _PALABRA_NUM_DE = /(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)\s*$/i;
const _PUNTOS_PP_RE = /(\d+(?:[.,]\d+)?)\s+puntos?\b/gi;
/* «1 · Contribución…» / «2) …» al inicio de línea es el orden de la lista, no una cifra; «dos riesgos» / «los tres focos» cuentan la estructura de la
 * propia respuesta (no hay entidad de la evidencia detrás) */
const _ENUMERADOR = /(?:^|\n)\s*\d{1,2}\s*[·.)]/;
/* «al 31 de agosto», «corte 31 ago 2026»: el día de una fecha no es una cifra */
const _DIA_DE_FECHA = /^\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)\b/i;
/* el punto que cierra una oración: «. » que no sea una abreviatura («vs. año», «aprox. 5», «p.ej. Lider»); con `conLinea`, también el fin de línea */
const _ABREVIATURA = /(?:\bvs|\baprox|\bp\.\s?ej|\bsr|\bsra|\bdr|\bn[uú]m|\bcap|\bp[aá]g)$/i;
function _finDeOracion(s, desde, conLinea = false) {
  let i = s.indexOf(". ", desde);
  while (i >= 0 && _ABREVIATURA.test(s.slice(Math.max(0, i - 8), i))) i = s.indexOf(". ", i + 1);
  if (conLinea) { const l = s.indexOf("\n", desde); if (l >= 0 && (i < 0 || l < i)) i = l; }
  return i;
}
function _iniDeOracion(s, pos) {
  let i = s.lastIndexOf(". ", pos);
  while (i >= 0 && _ABREVIATURA.test(s.slice(Math.max(0, i - 8), i))) i = s.lastIndexOf(". ", i - 1);
  return Math.max(i, s.lastIndexOf("\n", pos), 0);
}
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
/* D · «Falabella deja 22,0 %; también Lider» · «, y Lider también» · «Lider, ídem» · «Lider está en la misma cifra» · «Lider, lo mismo»: la entidad hereda la
 * cifra anterior de la oración (o de la anterior). Se resuelve en omisiones (necesita los nombres): ver _puntosDeElipsis */
const _ELIPSIS_ANTES = /(?:[;,.]|\by)\s*(?:y\s+)?(?:tambi[eé]n|igual(?:mente)?|lo\s+mismo|otro\s+tanto)\s+$/i;
const _ELIPSIS_DESPUES = /^\s*(?:,\s*)?(?:tambi[eé]n|[ií]dem|igual(?:mente)?|lo\s+mismo|otro\s+tanto|est[aá]\s+en\s+la\s+misma\s+cifra|est[aá]\s+en\s+lo\s+mismo|(?:deja|tiene|debe|vende|acumula|arrastra|queda|margina|paga|factura|aporta)\s+(?:lo\s+mismo|otro\s+tanto|igual|la\s+misma\s+cifra))(?=\s*[.,;:]|\s*$)/i;
function _puntosDeElipsis(s, puntos, nombres) {
  const out = [];
  if (!nombres || !nombres.length) return out;
  const cifras = puntos.filter((p) => p.clase === "cifra" && p.canon && !p.suelto).sort((x, y) => x.pos - y.pos);
  if (!cifras.length) return out;
  for (const { alias, nombre } of _aliasDe(nombres)) {
    const re = new RegExp("(?<![a-z0-9])" + alias.replace(/[.*+?^$()|[\]\\]/g, "\\$&") + "(?![a-z0-9])", "gi");
    let m;
    while ((m = re.exec(s))) {
      const antes = s.slice(Math.max(0, m.index - 24), m.index), despues = s.slice(m.index + m[0].length, m.index + m[0].length + 40);
      if (!_ELIPSIS_ANTES.test(antes) && !_ELIPSIS_DESPUES.test(despues)) continue;
      /* la cifra anterior más cercana en la misma oración o en la anterior (a ≤ 160 caracteres) */
      const prev = [...cifras].reverse().find((c) => c.fin <= m.index && m.index - c.fin <= 160 && !/\n\s*\n/.test(s.slice(c.fin, m.index)));
      if (!prev) continue;
      if (cifras.some((c) => c.pos > m.index && c.pos - m.index <= 40 && !/[.;]/.test(s.slice(m.index, c.pos)))) continue;   // trae su propia cifra
      out.push({ clase: "cifra", pos: m.index, fin: m.index + m[0].length, span: s.slice(m.index, m.index + m[0].length), negado: _negado(s, m.index), unit: prev.unit, raw: prev.raw, canon: prev.canon, elipsis: true, duenoElipsis: normalizar(nombre) });
    }
  }
  return out;
}
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
  /* un orden o una variación quedan eximidos solo por una negación EPISTÉMICA en su cláusula; una negación factual los afirma con signo cambiado */
  const negadoEpistemico = (pos) => { const cl = s.slice(Math.max(0, pos - 80), pos).split(/[.;:—()]/).pop() || ""; return _NEG_EPISTEMICA.test(cl) || /\bno\s+(?:es|son|era|eran|fue|parece|parecen)\s+(?:un|una|unos|unas|el|la|los|las)\b[^,;]{0,40}$/i.test(cl) || /\b(?:qui[eé]n|qui[eé]nes|cu[aá]l|cu[aá]les|si|cu[aá]nto|cu[aá]ntos|d[oó]nde)\s+(?:[a-záéíóúñ]+\s+){0,2}$/i.test(cl); };   // «quién vende más», «si el margen cae»: una pregunta indirecta no afirma   // «no es un cliente chico creciendo rápido»: la negación copular describe un sustantivo, no afirma la variación
  const re = (rx, clase, extra = null) => { rx.lastIndex = 0; let m; while ((m = rx.exec(s))) { const p = { clase, pos: m.index, fin: m.index + m[0].length, span: m[0], negado: clase === "relacion" ? false : clase === "orden" || clase === "variacion" ? negadoEpistemico(m.index) : _negado(s, m.index) }; if (extra) Object.assign(p, extra(m)); out.push(p); } };
  const oracionDe = (pos) => { const ini = _iniDeOracion(s, pos); let fin = _finDeOracion(s, pos, true); if (fin < 0) fin = s.length; return s.slice(ini, fin); };
  re(_UNIDADES_RE, "cifra", (m) => ({ unit: "count", raw: parseInt(m[1].replace(/[.,]/g, ""), 10), canon: `count:${parseInt(m[1].replace(/[.,]/g, ""), 10)}` }));
  re(_PUNTOS_PP_RE, "cifra", (m) => { const raw = parseFloat(m[1].replace(",", ".")); return { unit: "pp", raw, canon: `pp:${raw}pp` }; });
  /* la moneda sin símbolo («330K», «34.5M»): dinero con su escala, si parseFigures no lo leyó ya (con «$») */
  { const rx = /(?<![\d.,$%\w-])([+-]?\d+(?:[.,]\d+)?)\s?([KMB])(?![a-záéíóúñ0-9])/g; let m; while ((m = rx.exec(s))) { if (out.some((p) => p.clase === "cifra" && m.index >= p.pos && m.index + m[0].length <= p.fin)) continue; const raw = parseFloat(m[1].replace(",", ".")) * ({ K: 1e3, M: 1e6, B: 1e9 })[m[2].toUpperCase()]; out.push({ clase: "cifra", pos: m.index, fin: m.index + m[0].length, span: m[0], negado: _negado(s, m.index), unit: "money", raw, canon: `money:${m[1].replace("+", "")}${m[2].toUpperCase()}` }); } }
  /* una CIFRA EN PALABRAS con su unidad («veintiocho por ciento», «casi dos millones», «veinte mil dólares», «siete puntos», «1,9 millones»,
   * «casi un año de atraso», «medio millón», «diez más») es un punto de afirmación como cualquier cifra (ronda adversarial 2026-09-16) */
  { const rx = new RegExp(_CIFRA_EN_PALABRAS_SRC, "gi"); let m; while ((m = rx.exec(s))) { const fin = m.index + m[0].length; if (out.some((p) => p.clase === "cifra" && ((m.index >= p.pos && m.index < p.fin) || (p.pos >= m.index && p.pos < fin)))) continue; const c = _cifraEnPalabras(m); if (!c) continue; out.push({ clase: "cifra", pos: m.index, fin, span: m[0], negado: _negado(s, m.index), unit: c.unit, raw: c.raw, canon: c.canon, enPalabras: true }); } }
  /* los números pelados y en palabras: solo atados a algo contable o medible en su oración, y nunca dentro de una cifra ya leída */
  const cubiertoPorCifra = (pos, fin) => out.some((p) => p.clase === "cifra" && pos >= p.pos && fin <= p.fin);
  { const rx = _DURACION_HECHO_RE; rx.lastIndex = 0; let m; while ((m = rx.exec(s))) { const n = m[1] || m[3], u = m[2] || m[4]; const pos = m.index + m[0].indexOf(n); const fin = pos + n.length + 1 + u.length; if (cubiertoPorCifra(pos, fin)) continue; const raw = parseInt(n, 10); out.push({ clase: "cifra", pos, fin, span: s.slice(pos, fin), negado: _negado(s, m.index), unit: "count", raw, canon: `count:${raw}`, suelto: true, duracion: u }); } }
  { const rx = _NUMERO_SUELTO_RE; rx.lastIndex = 0; let m; while ((m = rx.exec(s))) { const fin = m.index + m[0].length; if (cubiertoPorCifra(m.index, fin)) continue; if (_ENUMERADOR.test(s.slice(Math.max(0, m.index - 2), fin + 3))) continue; if (_ESTRUCTURA.test(s.slice(fin, fin + 24))) continue; const o = oracionDe(m.index); if (!_ATA_CIFRA.test(o)) continue; if (/^(?:19|20)\d\d$/.test(m[1])) continue; if (_DIA_DE_FECHA.test(s.slice(fin, fin + 16))) continue; const raw = parseInt(m[1].replace(/\./g, ""), 10); out.push({ clase: "cifra", pos: m.index, fin, span: m[0], negado: _negado(s, m.index), unit: "count", raw, canon: `count:${raw}`, suelto: true }); } }
  { const rx = _PALABRA_NUM_RE; rx.lastIndex = 0; let m; while ((m = rx.exec(s))) { const mw = _PALABRA_NUM_DE.exec(m[0]); if (!mw) continue; const w = mw[1].toLowerCase(); const raw = _PALABRA_NUM_VALOR[w]; const pos = m.index + m[0].lastIndexOf(mw[1]); if (raw === 1 && !/^\s+(?:cuentas?|clientes?|skus?|bodegas?|marcas?|sola|solo|de\s+(?:las|los)\b)/i.test(s.slice(pos + mw[1].length, pos + mw[1].length + 20))) continue; if (/\b(?:cu[aá]l(?:es)?|cualquiera|alguna|ninguna)\s+de\s+(?:las|los)\s*$/i.test(s.slice(Math.max(0, pos - 24), pos))) continue; if (_ESTRUCTURA.test(s.slice(pos + mw[1].length, pos + mw[1].length + 24))) continue; out.push({ clase: "cifra", pos, fin: pos + mw[1].length, span: mw[1], negado: _negado(s, pos), unit: "count", raw, canon: `count:${raw}`, suelto: true }); } }
  re(_ORDEN_RE, "orden");
  for (const p of out) if (p.clase === "orden" && /^m[aá]s\s+(?:r[aá]pid|lent)/i.test(p.span)) p.clase = "variacion";   // «más rápido» es ritmo: sube o baja, no un puesto
  re(_RELACION_RE, "relacion");
  /* «te sale caro dos veces» es un modismo: «k veces» es relación solo con un marcador comparativo al lado («vale/es/pesa … dos veces», «dos veces más/que/el») */
  for (let k = out.length - 1; k >= 0; k--) { const p = out[k]; if (p.clase !== "relacion" || !/\b(?:\d+(?:[.,]\d+)?|dos|tres|cuatro|cinco|seis|diez)\s*(?:veces|x)\b/i.test(p.span)) continue; const antes = s.slice(Math.max(0, p.pos - 40), p.pos), tras = s.slice(p.fin, p.fin + 24); if (!/\b(?:es|son|vale|valen|pesa|pesan|vende|venden|supera|superan|equivale|representa|casi|m[aá]s de|menos de|unas?|hasta|de|multiplica|rota|rotan|factura|deja|dejan|cuesta|cuestan)\s*$/i.test(antes) && !/^\s*(?:m[aá]s|menos|que|el|la|lo|su|sus|mayor|menor|superior|inferior|lo que|por encima|por debajo)\b/i.test(tras)) out.splice(k, 1); }
  re(_GRUPO_RE, "grupo");
  { const rx = _VARIACION_RE; rx.lastIndex = 0; let m; while ((m = rx.exec(s))) { if (/^\s+(?:bajo|por\s+debajo\s+de|debajo\s+de|sobre|por\s+encima\s+de|encima\s+de)\s+(?:tu|su|el|la|los|las|del|de)\b/i.test(s.slice(m.index + m[0].length, m.index + m[0].length + 24))) continue; out.push({ clase: "variacion", pos: m.index, fin: m.index + m[0].length, span: m[0], negado: negadoEpistemico(m.index) }); } }
  re(_ESTADO_RE, "estado", (m) => { const neg = _negado(s, m.index); const canon = estadoCanon(m[0]); const comp = neg ? complementoDe(canon) : null; return comp ? { negado: false, negadoEstado: true, estadoCanonico: comp } : { estadoCanonico: canon }; });
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
    /* «el negocio está sano en crecimiento» es una figura, no el estado «capital sano» de la Mesa Capital: «sano» es estado solo con inventario en la oración */
    if (p.clase === "estado" && /san[oa]s?$/i.test(String(p.span).trim()) && !/\b(?:capital|stock|inventario|skus?|bodegas?|cobertura|rotaci[oó]n)\b/i.test(oracionDe(p.pos)) && !/\b[A-Z]{2,4}-[A-Z0-9-]{3,}\b/.test(oracionDe(p.pos))) return false;
    if (p.clase === "orden" || p.clase === "variacion" || p.clase === "relacion") {
      const o = oracionDe(p.pos);
      /* hace falta una métrica de la boleta (no «crecimiento» ni «participación» a secas), una cifra o un conteo en la oración */
      const nombresPropios = (o.match(/(?<![.!?]\s)(?<!^)\b[A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:-[A-Z0-9]+)*\b|\b[A-Z]{2,4}-[A-Z0-9-]{3,}\b/g) || []).length;
      const conMetrica = [...metricasEn(o)].some((k) => k !== "variacion" && k !== "participacion") || /\brota[a-záéíóúñ]*\b|\bd[ií]as\b|\bunidades\b|\bcapital\b|\bbenchmark\b|\breferencia\b|\bpiso\b|\bsin\s+capturar\b|\bno\s+capturad|\bcontribuci|\bmarkup\b|\bcobertura\b/i.test(o) || nombresPropios >= 2;
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
/* la k de una razón dicha en palabras («el doble» → 2, «la mitad» → 0.5, «una quinta parte» → 0.2, «tres veces» → 3) */
function _kDeRazon(span) {
  const t = normalizar(span);
  if (/doble|duplica|dobla/.test(t)) return 2; if (/triple|triplica/.test(t)) return 3; if (/cuadruplica/.test(t)) return 4; if (/mitad/.test(t)) return 0.5; if (/tercio|tercera parte/.test(t)) return 1 / 3;
  if (/cuarto|cuarta parte/.test(t)) return 0.25; if (/quinta parte|quinto/.test(t)) return 0.2; if (/sexta parte/.test(t)) return 1 / 6; if (/octava parte/.test(t)) return 0.125; if (/decima parte|decimo/.test(t)) return 0.1;
  const m = /(\d+(?:[.,]\d+)?|dos|tres|cuatro|cinco|seis|diez)\s*(?:veces|x)\b/.exec(t); if (m) return _NUMS_PALABRA[m[1]] ?? parseFloat(m[1].replace(",", "."));
  const f = /(dos|tres|cuatro)\s+(tercios|cuartos|quintos|decimos)/.exec(t); if (f) return _NUMS_PALABRA[f[1]] / ({ tercios: 3, cuartos: 4, quintos: 5, decimos: 10 })[f[2]];
  return null;
}
/* la relación declarada cierra con la k dicha: veces/fracción/parte con k (o k en %) igual; la mitad también como «parte 50%» */
function _kCompatible(rel, kDicha) {
  let k = Number.isFinite(rel.k) ? rel.k : null;
  if (k != null && k > 1 && /^(?:fraccion|parte)$/.test(String(rel.forma))) k = k / 100;
  if (k == null) return false;
  const inv = 1 / kDicha;
  return Math.abs(k - kDicha) <= 0.02 * Math.max(1, kDicha) || Math.abs(k - inv) <= 0.02 * Math.max(1, inv);
}
/* el ordinal de un punto de orden: «segunda» → 2, «tercer» → 3, «2.º» → 2; «primer» → 1; null si no es ordinal */
function _ordinalDe(span) {
  const t = normalizar(span);
  const d = /^(?:la\s+|el\s+|los\s+|las\s+)?(\d{1,2})\s*[.º°ª]/.exec(t); if (d) return parseInt(d[1], 10);
  const m = /^(?:la\s+|el\s+|los\s+|las\s+)?(primer|segund|tercer|cuart|quint|sext|septim|octav|noven|decim)/.exec(t); if (!m) return null;
  return ({ primer: 1, segund: 2, tercer: 3, cuart: 4, quint: 5, sext: 6, septim: 7, octav: 8, noven: 9, decim: 10 })[m[1]];
}
/* un punto de relación con dirección («bajo/sobre el benchmark», «más que…», «igual que») lo cubre una relación; un conteo/grupo/cifra solo si su
 * predicado o universo dice la misma dirección y la misma referencia; un orden comparativo solo a un comparador */
/* los pares (dirección, referencia) que dice un texto declarado: «bajo el benchmark», «carga sobre el nivel de referencia», y la semántica de la casa —
 * «brecha al benchmark» / «brecha de margen» es estar BAJO el benchmark; «carga comercial alta», «exceso de carga», «brecha por carga», «carga excedida»
 * es estar SOBRE el nivel declarado */
function _paresDeRelacion(texto) {
  const pares = [];
  const rx = /\b(bajo|debajo|inferior(?:es)?|menor(?:es)?|por\s+debajo|sobre|encima|superior(?:es)?|mayor(?:es)?|superan?|exceden?|por\s+encima|arriba)\b(?:\s+(?:de|del|al|a|el|la|los|las|su|un|una))*\s+(benchmark|nivel|umbral|referencia|piso|techo)\b/g;
  let m; while ((m = rx.exec(texto))) pares.push({ dir: /^(?:bajo|debajo|inferior|menor|por\s+debajo)/.test(m[1]) ? "bajo" : "sobre", ref: m[2] === "referencia" ? "nivel" : m[2] });
  if (/\bbrecha\s+(?:al|de|del|contra\s+el|frente\s+al|con\s+el)\s+benchmark\b|\bbrecha\s+de\s+margen\b|\bpp\s+bajo\b/.test(texto)) pares.push({ dir: "bajo", ref: "benchmark" });
  if (/\bcarga\s+(?:comercial\s+)?(?:alta|excedida|excesiva|en\s+exceso)\b|\bexceso\s+de\s+carga\b|\bbrecha\s+(?:de|por)\s+carga\b|\befecto\s+de\s+carga\b|\bcarga\s+comercial\s+sobre\b/.test(texto)) pares.push({ dir: "sobre", ref: "nivel" });
  return pares;
}
function _relacionCubierta(p, a, s = "") {
  if (a.tipo === "relacion") return true;
  const t = normalizar(p.span);
  const dir = /\b(?:bajo|debajo|inferior|menos|menor|lejos\s+de|a\s+la\s+zaga)\b/.test(t) ? "bajo" : /\b(?:sobre|encima|superior|m[aá]s|mayor|supera)\b/.test(t) ? "sobre" : null;
  const ref = /benchmark/.test(t) ? "benchmark" : /nivel|referencia\s+de\s+carga|umbral/.test(t) ? "nivel" : /piso/.test(t) ? "piso" : null;
  /* «equivale a $4.9M» introduce una cifra (la cubre la cifra que la envuelve); «como Lider», «igual que» solo por relación */
  if (/equivale\s+a$/.test(t) && s && /^\s*(?:unos\s+|casi\s+|cerca\s+de\s+|aprox\.?\s+)?[$]?\d/.test(s.slice(p.fin, p.fin + 24))) return /^(?:cifra|grupo|variacion|conteo)$/.test(a.tipo);
  const igualdad = /\b(?:igual|como\s+[a-z]+|a\s+la\s+par|lo\s+mismo|otro\s+tanto|equivale)\b/.test(t);   // «, como Lider»: solo una relación declarada lo cubre
  if (igualdad) return false;
  const texto = normalizar([a.conteo && a.conteo.predicado, a.universo, a.metrica, a.sujeto && typeof a.sujeto === "object" ? a.sujeto.descripcion : ""].filter(Boolean).join(" · "));
  if (a.tipo === "conteo" || a.tipo === "grupo" || a.tipo === "cifra") {
    if (!dir && !ref) return _CUBRE.relacion.has(a.tipo);
    const pares = _paresDeRelacion(texto);
    if (pares.some((q) => (!dir || q.dir === dir) && (!ref || q.ref === ref))) return true;
    /* «$655K de carga comercial por sobre el nivel declarado»: la relación es el POSTFIJO de la propia cifra (entre el valor y la relación solo va
     * el nombre de su métrica) — es lo que esa cifra es, y su métrica declarada nombra lo mismo («carga…») */
    if (a.tipo === "cifra" && a.valor && a.valor.texto && s) {
      const antes = s.slice(Math.max(0, p.pos - 70), p.pos);
      const iv = antes.lastIndexOf(String(a.valor.texto).trim());
      if (iv >= 0) {
        const entre = normalizar(antes.slice(iv + String(a.valor.texto).trim().length));
        const cabeza = normalizar(String(a.metrica || "")).split(/[\s(·:]+/).filter((w) => w.length >= 4)[0];
        if (/^(?:de|en)\s+[a-záéíóúñ ]{0,40}?(?:por\s+)?$/.test(entre) && cabeza && entre.includes(cabeza)) return true;
      }
    }
    return false;
  }
  /* el UNIVERSO de un orden que dice la misma dirección y referencia («los 3 que más cargan, entre las 8 cuentas bajo el benchmark») cubre la relación */
  if (a.tipo === "orden" && (dir || ref) && _paresDeRelacion(normalizar(String(a.universo || ""))).some((q) => (!dir || q.dir === dir) && (!ref || q.ref === ref))) return true;
  /* un orden COMPARATIVO cubre un comparador («más que», «supera», «a la zaga de») y la distancia comparada («más lejos de la referencia», «más cerca del benchmark») */
  if (a.tipo === "orden") return !!(a.orden && (a.orden.forma === "comparativo" || a.orden.vs) && (/\b(?:m[aá]s\s+que|menos\s+que|supera|por\s+encima|por\s+debajo|aventaja|a\s+la\s+zaga|adelanta|le\s+gana)\b/.test(t) || (/\b(?:lejos|cerca)\s+de/.test(t) && /\b(?:m[aá]s|menos)\s*$/.test(normalizar(s.slice(Math.max(0, p.pos - 8), p.pos))))));
  return false;
}
/* el dueño de una cifra en su oración: la entidad del tenant más cercana ANTES de la cifra dentro de su cláusula, o la pegada después con «de»/«en»;
 * sin nombres, o sin entidad en la cláusula, no hay dueño (la cobertura por canon no se restringe) */
/* los nombres del tenant y sus formas parciales («Polar» por La Polar, «ML» / «MercadoLibre» por Mercado Libre): [{alias, nombre}] */
function _aliasDe(nombres) {
  const out = [];
  const vistos = new Map();
  for (const n of nombres) { const nn = normalizar(n); if (!nn || nn.length < 2) continue; out.push({ alias: nn, nombre: nn }); const partes = nn.split(/\s+/); if (partes.length >= 2) { const ult = partes[partes.length - 1]; if (ult.length >= 4 && !/^(?:libre|norte|sur|centro|del|de|la|el)$/.test(ult)) { vistos.set(ult, (vistos.get(ult) || 0) + 1); out.push({ alias: ult, nombre: nn, parcial: true }); } out.push({ alias: partes.join(""), nombre: nn, parcial: true }); out.push({ alias: partes.map((x) => x[0]).join(""), nombre: nn, parcial: true, sigla: true }); } }
  return out.filter((x) => !(x.parcial && !x.sigla && x.alias.length < 4) && !(x.parcial && vistos.get(x.alias) > 1));   // un apellido compartido no identifica
}
/* _oracionDelPunto(s, p, nombres) → { ini, fin, oracion (normalizada sin recortar, con los incisos borrados), pos, finP, largos0 (todas las entidades),
 * largos (sin las de referencia) } — lo que comparten el dueño de una cifra y los sujetos de un estado */
/* la entidad que es REFERENCIA de una comparación o secuencia no es dueña de la cifra: «más que X», «contra X», «después de X», «le sigue a X»,
 * «seguido de X», «escolta a X», «salvo X» — UNA definición para presencia y el juez */
export const REFERIDA_RE = /(?<![a-záéíóúñ])(?:m[aá]s\s+(?:[a-záéíóúñ]+\s+)?que|menos\s+(?:[a-záéíóúñ]+\s+)?que|mayor(?:es)?\s+que|menor(?:es)?\s+que|mejor(?:es)?\s+que|peor(?:es)?\s+que|igual\s+que|tanto\s+como|tan\s+[a-záéíóúñ]+\s+como|(?:supera|aventaja|adelanta|rebasa|sobrepasa)n?\s+a|contra|vs\.?|frente\s+a|respecto\s+(?:de|a|al)|comparad[oa]s?\s+con|a\s+diferencia\s+de|despu[eé]s\s+de|detr[aá]s\s+de|tras|(?:le|les)\s+siguen?\s+a|siguen?\s+a|seguid[oa]s?\s+(?:de|por)|escoltan?\s+a|por\s+delante\s+de|excepto|salvo|aparte\s+de|adem[aá]s\s+de|sin\s+contar|fuera\s+de|por\s+encima\s+de|por\s+debajo\s+de|delante\s+de)\s+(?:(?:el|la|los|las|a|de|del)\s+)*$/;
function _oracionDelPunto(s, p, nombres) {
  const ini = _iniDeOracion(s, p.pos);
  let fin = _finDeOracion(s, p.fin, true); if (fin < 0) fin = s.length;
  /* los incisos «— … —» y «, y no X,» no son dueños: se borran (mismo largo, para no mover posiciones) */
  const borrar = (txt, re) => txt.replace(re, (m) => " ".repeat(m.length));
  /* normalizada SIN recortar: la posición de la cifra es la del prefijo normalizado igual (con `normalizar`, que recorta, quedaba un espacio antes) */
  const normSinRecorte = (t) => String(t == null ? "" : t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
  let oracion = normSinRecorte(s.slice(ini, fin));
  const pos = normSinRecorte(s.slice(ini, p.pos)).length, finP = pos + normSinRecorte(String(p.span)).length;
  oracion = borrar(oracion, /—[^—]{1,80}—/g);
  /* «Lider (tu segunda cuenta en venta) deja 22,0 %»: el paréntesis pegado a una entidad es su aposición; para un punto de afuera se borra */
  oracion = oracion.replace(/\(([^()]{1,80})\)/g, (m, inner, off) => { if (pos >= off && pos < off + m.length) return m; const antesP = oracion.slice(0, off); return /[a-z0-9](?:[a-z0-9 -]{0,30})\s?$/.test(antesP) && _aliasDe(nombres).some(({ alias }) => new RegExp(alias.replace(/[.*+?^$()|[\]\\]/g, "\\$&") + "\\s*$").test(antesP)) ? " ".repeat(m.length) : m; });
  oracion = borrar(oracion, /,?\s*(?:y|e|pero)\s+no\s+[a-z0-9][^,;:]{0,40}?(?=,|\s+(?:deja|tiene|debe|vende|acumula|arrastra|queda|es|son|est[aá]))/g);
  oracion = borrar(oracion, /\bno\s+[a-z][a-z0-9 -]{1,30}?\s+sino\s+/g);
  const ents = [];
  for (const { alias, nombre, sigla } of _aliasDe(nombres)) { const re = new RegExp((sigla ? "(?<![a-z0-9])" : "(?<![a-z0-9])") + alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![a-z0-9])", "g"); let m; while ((m = re.exec(oracion))) { if (sigla && !s.slice(ini, fin).includes(alias.toUpperCase())) continue; ents.push({ nombre, pos: m.index, fin: m.index + alias.length }); } }
  const largos0 = ents.filter((e) => !ents.some((o) => o !== e && o.pos <= e.pos && o.fin >= e.fin && (o.fin - o.pos) > (e.fin - e.pos))).sort((x, y) => x.pos - y.pos);
  /* la entidad que es REFERENCIA no es dueña de nada: tras un comparador («más severo que Falabella», «contra Lider», «frente a Jumbo») o una
   * exclusión («después de Jumbo y Falabella», «salvo Ripley», «sin contar Easy») — y la coordinada con ella («después de Jumbo y Falabella») */
  const _REFERIDA = REFERIDA_RE;
  const referida = (e, profundidad = 0) => {
    const antesE = oracion.slice(Math.max(0, e.pos - 40), e.pos);
    if (_REFERIDA.test(antesE) && !(/seguid[oa]s?\s+(?:de|por)\s+(?:(?:el|la|los|las)\s+)?$/.test(antesE) && /^\s+con\s+(?:unos\s+|casi\s+|apenas\s+|solo\s+)?[$\d]|^\s*\(\s*[$\d]|^\s*:\s*[$\d]/.test(oracion.slice(e.fin, e.fin + 40)))) return true;   // la continuación de una lista con cifra propia («seguido de Valparaíso con $39K») es dueña de la suya
    const mCoord = /(?:,|\s+y|\s+e|\s+o|\s+ni)\s+$/.exec(antesE);
    if (mCoord && profundidad < 4 && (!/^,/.test(mCoord[0]) || /^\s*(?:,|\s+(?:y|e|o|ni)\s)/.test(oracion.slice(e.fin)))) { const prev = largos0.filter((o) => o.fin <= e.pos - mCoord[0].length + 1).pop(); if (prev && e.pos - prev.fin <= mCoord[0].length + 1) return referida(prev, profundidad + 1); }   // «Igual que Falabella, Sodimac lleva…»: la coma no coordina si no sigue una lista
    return false;
  };
  const largos = largos0.filter((e) => !referida(e));
  return { ini, fin, oracion, pos, finP, largos0, largos };
}
/* _sujetosDelPunto(s, p, nombres) → los dueños de un punto de estado u orden: la corrida de entidades coordinadas («X, Y y Z») que termina justo
 * antes del punto en su cláusula («SAM-REF500L y PHI-IRON-PRO están en riesgo de quiebre» → las dos); sin entidad antes, las que vienen pegadas
 * después («Están al día Jumbo y Mercado Libre»); sin ninguna, [] (la cobertura no se restringe por dueño) */
function _sujetosDelPunto(s, p, nombres, { objetos = false } = {}) {
  if (!nombres || !nombres.length) return [];
  const r = _sujetosDelPunto0(s, p, nombres);
  return objetos ? r : [...new Set(r.map((e) => e.nombre))];
}
function _sujetosDelPunto0(s, p, nombres) {
  const { oracion, pos, finP, largos } = _oracionDelPunto(s, p, nombres);
  const coord = /^\s*(?:,|\s*(?:y|e|o|ni|como|junto\s+(?:con|a)|as[ií]\s+como|y\s+tambi[eé]n|al\s+igual\s+que)\s+|,\s*(?:y|e|o|ni|as[ií]\s+como|junto\s+(?:con|a)|al\s+igual\s+que)\s+)\s*,?\s*$/;
  const antes = largos.filter((e) => e.fin <= pos).sort((x, y) => x.pos - y.pos);
  if (antes.length) {
    /* del último hacia atrás, mientras lo que separa a dos entidades sea solo una coordinación */
    const run = [antes[antes.length - 1]];
    for (let i = antes.length - 2; i >= 0; i--) { const entre = oracion.slice(antes[i].fin, run[0].pos); if (coord.test(entre)) run.unshift(antes[i]); else break; }
    /* entre la corrida y el punto no puede haber OTRA cláusula con sujeto propio (un «;», un «:» o un punto): «Lider debe $4,6M; Falabella está al día» */
    const tramo = oracion.slice(run[run.length - 1].fin, pos);
    /* «Tanto Lider como Falabella»: el «tanto» de apertura confirma la corrida; entre la corrida y el punto no puede haber otra cláusula */
    if (!/[;:]|\.(?!\d)/.test(tramo)) return run;   // el punto decimal («8.6 pp») no cierra la cláusula
    const ultimo = antes[antes.length - 1]; if (!/[;:]|\.(?!\d)/.test(oracion.slice(ultimo.fin, pos))) return [ultimo];
  }
  const despues = largos.filter((e) => e.pos >= finP && e.pos - finP <= 40 && !/[;:]|\.(?!\d)/.test(oracion.slice(finP, e.pos))).sort((x, y) => x.pos - y.pos);
  if (despues.length) { const run = [despues[0]]; for (let i = 1; i < despues.length; i++) { const entre = oracion.slice(run[run.length - 1].fin, despues[i].pos); if (coord.test(entre)) run.push(despues[i]); else break; } return run; }
  return [];
}
/* A · la lista DISTRIBUTIVA: «Lider y Falabella deben $4,6M y $2,5M» — con tantas cifras coordinadas como entidades, la k-ésima es de la k-ésima */
const _CIF_SRC = "[$]?\\d[\\d.,]*\\s?(?:[kmb%]|pp|d|dias)?";
function _indiceDistributivo(oracion, pos, n, desde) {
  const re = new RegExp("(" + _CIF_SRC + ")(?:\\s*,\\s*(" + _CIF_SRC + "))*\\s+(?:y|e)\\s+(" + _CIF_SRC + ")", "g");
  re.lastIndex = Math.max(0, desde);
  let m;
  while ((m = re.exec(oracion))) {
    const lista = [...m[0].matchAll(new RegExp(_CIF_SRC, "g"))].map((x) => m.index + x.index);
    if (pos >= m.index && pos < m.index + m[0].length) { const k = lista.findIndex((x) => x === pos || (pos > x && pos < x + 12 && !lista.some((y) => y > x && y <= pos))); return lista.length === n && k >= 0 ? k : null; }
    if (m.index > pos) break;
  }
  return null;
}
/* A · los dueños de una cifra: la corrida coordinada que la precede; con lista distributiva, solo el k-ésimo */
function _duenosCoordinados(s, p, nombres, dueno0) {
  if (!dueno0) return null;
  const run = _sujetosDelPunto(s, p, nombres, { objetos: true });
  if (run.length < 2 || !run.some((e) => e.nombre === dueno0)) return null;
  const { oracion, pos } = _oracionDelPunto(s, p, nombres);
  const k = _indiceDistributivo(oracion, pos, run.length, run[run.length - 1].fin);
  if (k != null) return { distributivo: run[k].nombre };
  return { todos: run.map((e) => e.nombre) };
}
/* «el 55 % de lo frenado en Valparaíso», «el 41 % del capital de Línea Blanca»: la entidad que cierra una expresión de BASE tras la cifra no es su dueña */
const _BASE_TRAS_RE = /^\s*(?:,\s*)?(?:de|del|sobre)\s+(?:lo|la|el|los|las|su|sus|todo\s+el|toda\s+la)\s+[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2}\s+(?:en|de|del)\s+$/;
function _duenoDelPunto(s, p, nombres, ejeDe = null, tramos = null) {
  if (!nombres || !nombres.length) return null;
  if (p.elipsis && p.duenoElipsis) return p.duenoElipsis;
  /* LA ESTRUCTURA MANDA: la celda de una tabla, la sub-viñeta de una entidad o la línea bajo un encabezado «Lider:» tienen dueño estructural */
  if (Array.isArray(tramos) && tramos.length) { const t = tramos.find((x) => x.dueno && p.pos >= x.ini && p.pos < x.fin); if (t) return normalizar(t.dueno); }
  const { ini, oracion, pos, finP, largos } = _oracionDelPunto(s, p, nombres);
  if (!largos.length) {
    /* anáfora: «esa cuenta», «este cliente», «ella» al inicio → la última entidad de la oración anterior */
    if (/^\s*[.\s]*(?:esa|esta|dicha|aquella|la|el)\s+(?:cuenta|cliente|marca|familia|bodega|sku|referencia)\b|^\s*[.\s]*(?:ella|el|este|esta|ese|esa)\s+(?:deja|tiene|debe|vende|acumula|arrastra|queda|es|son|est[aá]|lleva|margina|paga|factura)/i.test(oracion)) {
      const prev = s.slice(Math.max(0, ini - 300), ini); const prevN = normalizar(prev); let ult = null;
      for (const { alias, nombre } of _aliasDe(nombres)) { let m; const re = new RegExp("(?<![a-z0-9])" + alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![a-z0-9])", "g"); while ((m = re.exec(prevN))) if (!ult || m.index > ult.pos) ult = { pos: m.index, nombre }; }
      return ult ? ult.nombre : null;
    }
    return null;
  }
  /* una referencia («sobre el nivel de 3,5%», «contra el benchmark de 30,1%») o un total («de los $12.6M», «$33K en total», «del total de $135K») no es de ninguna cuenta */
  if (_esReferencia(oracion, pos, finP)) return null;
  /* una sola entidad en la oración: es la dueña (venga antes o después) si entre ella y la cifra no hay coma, coordinación ni separador de cláusula */
  const unicas = [...new Set(largos.map((e) => e.nombre))];
  /* …ni un lugar donde algo ocurre («el 80% de tu venta se completa en Mercado Libre», «el corte cae en Ripley»): ahí la entidad no es dueña */
  if (unicas.length === 1) { const e = largos[0]; const entre = e.fin <= pos ? oracion.slice(e.fin, pos) : oracion.slice(finP, e.pos); if (!/[;:—()•·,]|\s(?:y|e|pero|aunque|mientras|ni)\s|\bse\s+[a-záéíóúñ]+\s+(?:en|a)\s|\b(?:completa|alcanza|cruza|termina|queda|cae|entra|llega|aparece|concentra|est[aá])\s+en\s/.test(entre) && !(e.pos > finP && _BASE_TRAS_RE.test(entre))) return unicas[0]; }
  /* «respectivamente»: la k-ésima cifra de la lista es de la k-ésima entidad — la lista va tras el adverbio («dejan, respectivamente: 21,5% y 22,0%»)
   * o justo antes («($4.3M, $4.2M y $3.8M respectivamente)»); una cifra fuera de esa lista no entra en el reparto */
  if (/respectivamente/.test(oracion)) {
    const iR = oracion.indexOf("respectivamente");
    const CIF = "[$]?\\d[\\d.,]*\\s?(?:[kmb%]|pp|d)?";
    let lista = null;
    const mTras = new RegExp("^\\s*[:,]?\\s*(" + CIF + "(?:\\s*(?:,|y|e)\\s*" + CIF + ")*)").exec(oracion.slice(iR + 15));
    if (mTras) lista = { ini: iR + 15 + mTras[0].indexOf(mTras[1]), texto: mTras[1] };
    else { const mAntes = new RegExp("(" + CIF + "(?:\\s*(?:,|y|e)\\s*" + CIF + ")*)\\s*,?\\s*$").exec(oracion.slice(0, iR)); if (mAntes) lista = { ini: mAntes.index, texto: mAntes[1] }; }
    if (lista) { const cifras = [...lista.texto.matchAll(new RegExp(CIF, "g"))].map((m) => lista.ini + m.index); const k = cifras.indexOf(pos); const base = largos.filter((e) => e.fin <= lista.ini).slice(-cifras.length); if (k >= 0 && base.length === cifras.length && base[k]) return base[k].nombre; }
  }
  /* «$4,6M vencidos: Falabella» / «22,0%: ese es el margen de Lider»: la entidad tras los dos puntos que cierran la cláusula de la cifra es la dueña */
  { const iDos = oracion.indexOf(":", finP); if (iDos >= 0 && !/[;:—()•·,]/.test(oracion.slice(finP, iDos))) { const e = largos.find((x) => x.pos > iDos && /^\s*(?:(?:es|era|ese|esa|este|esta|el|la|lo)\s+(?:es\s+)?(?:el\s+|la\s+)?(?:[a-záéíóúñ]+\s+){0,3}(?:de\s+)?)?$/.test(oracion.slice(iDos + 1, x.pos)) && /^\s*(?:[.,;]|$)/.test(oracion.slice(x.fin, x.fin + 3))); if (e) return e.nombre; } }
  const tras = oracion.slice(finP, finP + 40);
  /* «el 55 % de lo frenado en Valparaíso», «el 41 % del capital de Línea Blanca»: la entidad cierra una expresión de BASE, no es dueña */
  const enBase = (e) => e.pos > finP && _BASE_TRAS_RE.test(oracion.slice(finP, e.pos));
  const mDe = /^\s*(?:,\s*)?(?:de|del|en)\s+/.exec(tras);
  if (mDe) { const e = largos.find((x) => x.pos >= finP + mDe[0].length - 1 && x.pos <= finP + mDe[0].length + 1); if (e) return e.nombre; }
  /* C · «Los $4,6M más viejos del vencido, la deuda de Falabella, son el foco» / «$4,6M vencidos, todos de Falabella»: la aposición nombra al dueño */
  { const AP = /^[^,;:.]{0,40},\s*(?:(?:la|el|los|las|tod[oa]s?|es\s+decir|o\s+sea)\s+)?(?:[a-záéíóúñ]+\s+){0,3}(?:de|del)\s+$/; const e = largos.find((x) => x.pos > finP && x.pos - finP <= 70 && AP.test(oracion.slice(finP, x.pos)) && /^\s*[,.;]/.test(oracion.slice(x.fin, x.fin + 2))); if (e) return e.nombre; }
  /* E · «Lider y Falabella: la segunda debe $4,6M» — el ordinal apunta a la lista que precede a los dos puntos */
  { const mOrd = /(?:^|[:;.])\s*(?:la|el)\s+(primer[ao]|segund[ao]|tercer[ao]|cuart[ao]|quint[ao]|[uú]ltim[ao])\b[^,;:.]{0,40}$/.exec(oracion.slice(0, pos));
    if (mOrd) { const iDos = oracion.lastIndexOf(":", pos); const lista = largos.filter((e) => e.fin <= (iDos >= 0 ? iDos : pos)).slice(-6); if (lista.length >= 2) { const idx = ({ primer: 0, segund: 1, tercer: 2, cuart: 3, quint: 4 })[mOrd[1].slice(0, mOrd[1].length - 1)]; const e = /ultim/.test(mOrd[1]) ? lista[lista.length - 1] : lista[idx]; if (e) return e.nombre; } } }
  const SEP = [";", ":", "—", "(", ")", "•", "·", "→"];
  const iniC = Math.max(...SEP.map((c) => oracion.lastIndexOf(c, pos)), -1) + 1;
  /* G · «Lider deja 21,5 % de margen, menos que Falabella; la contribución no capturada es $1,6M»: la cláusula continuada sin entidad, con un sujeto
   * de métrica, es del sujeto de la cláusula anterior (la primera entidad no referida de esa cláusula) */
  if (iniC > 0 && oracion[iniC - 1] === ";" && !largos.some((e) => e.pos >= iniC && e.fin <= pos) && /^\s*(?:y\s+|pero\s+)?(?:su|sus|la|el|los|las)\s+[a-záéíóúñ ]{3,40}?\s+(?:es|son|queda|quedan|llega|llegan|suma|suman|alcanza|alcanzan|fue|fueron|est[aá]|est[aá]n)\s+(?:de\s+|a\s+|en\s+)?$/.test(oracion.slice(iniC, pos))) {
    const iniPrev = Math.max(...SEP.map((c) => oracion.lastIndexOf(c, iniC - 2)), -1) + 1;
    const prev = largos.filter((e) => e.pos >= iniPrev && e.fin <= iniC - 1);
    if (prev.length) return prev[0].nombre;
  }
  let finC = Math.min(...SEP.map((c) => { const i = oracion.indexOf(c, finP); return i < 0 ? Infinity : i; })); if (!Number.isFinite(finC)) finC = oracion.length;
  /* «Entidad:», «Entidad —», «Entidad ·» justo antes del separador que abre la cláusula de la cifra: la cabeza es la dueña */
  { const cabeza = largos.filter((e) => e.fin <= pos && /^\s*(?:[:—·(]|-\s)\s*$/.test(oracion.slice(e.fin, iniC)) && !/(?:,|\s+(?:y|e|o|ni|con|entre|sin))\s+$/.test(oracion.slice(Math.max(0, e.pos - 8), e.pos))); if (cabeza.length && !largos.some((e) => e.pos >= iniC && e.fin <= pos)) return cabeza[cabeza.length - 1].nombre; }
  const antes = largos.filter((e) => e.pos >= iniC && e.fin <= pos && !/(?:,\s*(?:y|e|pero|aunque)\s+|\s+(?:y|e)\s+(?:el|la|los|las|su|sus|tu|tus)\s+)/.test(oracion.slice(e.fin, pos)) && !/\d[\d.,]*\s?(?:[kmb%]|pp|d)?\s+(?:de|del|sobre)\s+(?:los\s+|las\s+)?$/.test(oracion.slice(e.fin, pos)));
  /* «LG-DRYER8KG está frenado en Valparaíso con $14K»: la bodega dicha como lugar («en …») no es dueña si antes va otra entidad en la cláusula */
  const antesSinLugar = antes.filter((e) => !(typeof ejeDe === "function" && ejeDe(e.nombre) === "bodega" && /\b(?:en|desde|hacia)\s+(?:la\s+bodega\s+)?$/.test(oracion.slice(Math.max(0, e.pos - 14), e.pos)) && antes.some((o) => o !== e && ejeDe(o.nombre) !== "bodega")));
  if (antesSinLugar.length) return antesSinLugar[antesSinLugar.length - 1].nombre;
  const despues = largos.filter((e) => e.pos >= finP && !enBase(e) && e.fin <= finC && e.pos - finP <= 30 && !/\d|,|\b(?:vs\.?|contra|frente a|con|y|entre|para|que|por)\b|\bse\s+[a-záéíóúñ]+\s+en\s+/.test(oracion.slice(finP, e.pos)));
  if (despues.length) return despues[0].nombre;
  /* «Con 24,0% de margen, Sodimac tampoco…»: la cifra abre la oración y la entidad viene tras la coma */
  if (/^\s*[.\s]*(?:con|a|al|en)\s+(?:un\s+|una\s+|el\s+|la\s+)?$/.test(oracion.slice(0, pos))) { const tras = largos.filter((e) => e.pos >= finP && !/\d/.test(oracion.slice(finP, e.pos)) && /^[^,]{0,25},\s*$/.test(oracion.slice(finP, e.pos))); if (tras.length) return tras[0].nombre; }
  /* «… $1,4M de brecha por precio y costo en Jumbo.»: «en/de/para <entidad>» al final de la cláusula, sin otra cifra en medio */
  { const cola = largos.filter((e) => e.pos >= finP && !enBase(e) && e.fin <= finC && !/[\d,]/.test(oracion.slice(finP, e.pos)) && /(?:^|\s)(?:en|de|del|para)\s*$/.test(oracion.slice(finP, e.pos)) && !/\bse\s+[a-záéíóúñ]+\s+(?:en|a)\s*$|\b(?:completa|alcanza|cruza|termina|queda|cae|entra|llega|aparece|concentra|est[aá])\s+en\s*$/.test(oracion.slice(finP, e.pos)) && /^\s*[.;:,)]?\s*$/.test(oracion.slice(e.fin, finC))); if (cola.length) return cola[0].nombre; }   // «se completa en Mercado Libre»: un lugar, no el dueño
  return null;
}
/* la cifra es una REFERENCIA o un TOTAL, no la cifra de una cuenta: «sobre el nivel de 3,5%», «contra el benchmark de 30,1%», «de los $12.6M vencidos»,
 * «$33K en total», «del total de $135K», «$33K sobre $135K de capital total» */
function _esReferencia(oracion, pos, finP) {
  const antes = oracion.slice(Math.max(0, pos - 40), pos), despues = oracion.slice(finP, finP + 40);
  if (/(?:nivel|benchmark|referencia|umbral|piso|techo|de\s+los|de\s+las|del\s+total|total\s+de|un\s+total\s+de|en\s+total|,\s*de|contra|frente\s+a|vs\.?|sobre)\s*(?:de\s+|del\s+|es\s+|era\s+|:\s*|\(\s*)?(?:de\s+)?(?:el\s+|la\s+|los\s+|las\s+|un\s+|una\s+)?$/.test(antes)) return true;
  /* «3,5% declarado», «30,1% de referencia», «$33K en total» — no «5.0 pp bajo el benchmark» (eso es una brecha con dirección, de quien la tiene) */
  if (/^\s*(?!(?:bajo|sobre|encima|debajo|contra|frente|vs)\b)(?:[a-záéíóúñ]+\s+)?(?:en\s+total|del\s+total|totales?|declarad[oa]s?|de\s+referencia)\b/.test(despues)) return true;
  return false;
}
/* «(8.6 pp contra 8.1 pp)»: la segunda cifra es del otro lado (`vs`) de la afirmación que la envuelve; si ninguna lo nombra, no hay dueño que restrinja */
function _duenoDelSegundoLado(s, p, envuelven) {
  const antes = normalizar(s.slice(Math.max(0, p.pos - 40), p.pos));
  if (!/(?:contra|vs\.?|frente a)\s*$/.test(antes)) return undefined;
  for (const { a } of envuelven) { const vs = (a.relacion && a.relacion.vs && a.relacion.vs.sujeto) || (a.orden && a.orden.vs); if (typeof vs === "string" && vs && vs !== "negocio") return normalizar(vs); }
  return null;
}
export function omisiones(texto, afirmaciones, { nombres = [], ejeDe = null } = {}) {
  const s = String(texto || "");
  const puntos = puntosDeAfirmacion(s);
  /* D · la elipsis del predicado («; también Lider») es un punto de cifra con dueño propio */
  { const extra = _puntosDeElipsis(s, puntos, nombres); if (extra.length) { puntos.push(...extra); puntos.sort((x, y) => x.pos - y.pos); } }
  const tramosEstructura = (() => { try { return duenosEstructurales(s, nombres); } catch { return []; } })();
  const { prosaN, mapa } = _normalizarConMapa(s);
  /* un fragmento que aparece más de una vez en la prosa (el cierre del cruce repetido por el inventario) es la misma afirmación: cubre todas.
   * La PRIMERA ubicación admite toda la tolerancia del ubicador; las repeticiones solo la literal (o sin marcas): una segunda ubicación
   * «asistida» tapaba otra oración con las mismas cifras y escondía la afirmación de al lado (medido: 595 → 577 quitadas detectadas). */
  const _todas = (texto) => { const out = []; let desde = 0; for (let k = 0; k < 12; k++) { const u = ubicarFragmento(s, texto, { desde }); if (!u) break; if (k > 0 && !/^(?:literal|sin-marcas)$/.test(u.modo)) break; out.push([u.ini, u.fin]); if (u.fin <= desde) break; desde = u.fin; } if (!out.length) { const r = _ubicar(prosaN, mapa, texto); if (r) out.push(r); } return out; };
  const decl = normalizarAfirmaciones(afirmaciones).map(({ afirmacion: a }) => { const rangos = _todas(a.texto); return { a, rango: rangos[0] || null, rangos }; });
  const canonDeclarados = new Set();
  const canonesPorDecl = [];   // [{a, canones}] · para la cobertura por canon CON dueño
  const canonColas = new Set();   // lo que cubre SOLO una cola «(y N más)»: el universo del orden menos los listados, el conteo menos sus enumerados
  const canonK = new Set();   // la k de cada top-k declarado: «separar en tres cuentas» después de listar las tres
  for (const { a } of decl) {
    if (a.tipo === "lectura") continue;
    const cs = []; for (const v of [a.valor, a.variacion && a.variacion.valor, a.relacion && a.relacion.valor]) if (v && v.canon) { canonDeclarados.add(String(v.canon).replace(/\$/g, "")); cs.push(String(v.canon).replace(/\$/g, "")); }
    canonesPorDecl.push({ a, canones: cs });
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
    /* un fragmento que cruza el punto final envuelve solo su primera oración; y para una cifra, la declaración que la envuelve tiene que ser
     * compatible con el DUEÑO de la cifra en su oración (un fragmento repetido «debe $2.5M vencidos» no cubre el de Tottus con la de Falabella) */
    /* la cabecera de una tabla no afirma nada («| SKU | Frenado | Días sin venta |»): sus palabras no son puntos */
    if (tramosEstructura.some((t) => t.tipo === "cabecera" && p.pos >= t.ini && p.pos < t.fin)) continue;
    let dueno0 = p.clase === "cifra" && p.canon ? _duenoDelPunto(s, p, nombres, ejeDe, tramosEstructura) : null;
    /* A · sujeto COORDINADO: con una sola cifra, todos son dueños («Lider junto con Falabella dejan 22,0 %»); con lista distributiva, el k-ésimo */
    let duenosTodos = null;
    if (dueno0) { const dc = _duenosCoordinados(s, p, nombres, dueno0); if (dc && dc.distributivo) dueno0 = dc.distributivo; else if (dc && dc.todos) duenosTodos = dc.todos; }
    if (p.clase === "estado" && !p.sujetos) p.sujetos = _sujetosDelPunto(s, p, nombres);
    const compatibleConDueno = (a) => !dueno0 || typeof a.sujeto !== "string" || normalizar(a.sujeto) === dueno0 || normalizar(a.sujeto).includes(dueno0) || dueno0.includes(normalizar(a.sujeto)) || (a.relacion && a.relacion.vs && typeof a.relacion.vs.sujeto === "string" && normalizar(a.relacion.vs.sujeto) === dueno0) || (a.orden && typeof a.orden.vs === "string" && normalizar(a.orden.vs) === dueno0) || (Array.isArray(a.sujeto) && a.sujeto.some((x) => normalizar(x) === dueno0));
    /* el fragmento envuelve lo que su rango cubre («Falabella · cliente. Venta del período: $19.4M — 1º de 13» es UN fragmento con un punto adentro);
     * lo que cruza a la cifra de OTRA cuenta lo frena el dueño («Falabella deja 22,0% de margen. Lider deja 22,0% también»: el segundo es de Lider) */
    const envuelven = decl.filter(({ rangos, a }) => rangos.some((rango) => p.pos >= rango[0] - 3 && p.fin <= rango[1] + 3) && (p.clase !== "cifra" || compatibleConDueno(a)));
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
      /* la razón la cubre una relación con ESA k («el doble» → 2; «la mitad», «una quinta parte» → 0.5, 0.2; «tres veces» → 3) — un «mayor» no cubre «el triple» */
      const kDicha = _kDeRazon(p.span);
      const razonDeclarada = envuelven.some(({ a }) => a.tipo === "relacion" && a.relacion && (kDicha == null || _kCompatible(a.relacion, kDicha))) || (p.canon && canonDeclarados.has(p.canon)) || [...envuelven].some(({ a }) => a.valor && a.valor.unidad === "ratio" && (kDicha == null || Math.abs(a.valor.raw - kDicha) < 0.01));
      if (razonDeclarada) { out.cubiertos++; continue; }
      out.omisiones.push({ clase: envuelven.length ? "significado-no-declarado:relacion" : "relacion", span: p.span, pos: p.pos, motivo: `«${p.span}» es una relación (una razón) y no está declarada como tal` });
      continue;
    }
    /* «las acciones subieron a 5.5% contra 4.5% del año»: una relación mayor/menor que envuelve el verbo de dirección es ese hecho */
    const relacionDirigida = p.clase === "variacion" && envuelven.some(({ a }) => a.tipo === "relacion" && a.relacion && /^(?:mayor|menor)$/.test(String(a.relacion.forma)));
    /* una cifra queda cubierta por su canon solo por una declaración que la ENVUELVE o cuyo sujeto es compatible con el DUEÑO de la cifra en su
     * oración («Lider deja 22,0%» no la cubre «Falabella … 22,0%»); los canones de conteos y grupos no tienen dueño */
    const cubiertaPorCanon = p.clase === "cifra" && p.canon && (() => {
      if (!canonDeclarados.has(p.canon)) return false;
      const conCanon = canonesPorDecl.filter(({ canones }) => canones.includes(p.canon));
      if (!conCanon.length) {
        /* el n/m de un conteo o grupo (count:n) cubre el entero que cuenta a la casa («6 cuentas», «6 de las 13», «13 clientes») o el que cae en su
         * propio fragmento; no un entero cualquiera con otro sustantivo («6 facturas», «6 meses») */
        if (p.unit !== "count") return true;
        /* el eco sin unidad de una cifra declarada CON unidad en su propio fragmento («269 días de atraso contra apenas 8» con «8 días» declarado) */
        if (envuelven.some(({ a }) => [a.valor, a.variacion && a.variacion.valor, a.relacion && a.relacion.valor].some((v) => v && Number.isFinite(v.raw) && v.raw === p.raw && v.unidad !== "count"))) return true;
        const tras = s.slice(p.fin, p.fin + 40);
        const cuentaLaCasa = /\b(?:cuentas?|clientes?|skus?|sku|bodegas?|marcas?|familias?|referencias?|productos?|entidades)\b/i.test(p.span) || /^\s*(?:de\s+(?:las?|los|tus|sus|esas?|esos|ellas|ellos)\b|(?:de\s+)?(?:cuentas?|clientes?|skus?|sku|bodegas?|marcas?|familias?|referencias?|productos?|entidades|filas?|casos?)\b)/i.test(tras) || /(?:cuentas?|clientes?|skus?|sku|bodegas?|marcas?|familias?)\s*$/i.test(s.slice(Math.max(0, p.pos - 14), p.pos));
        if (cuentaLaCasa) return true;
        if (envuelven.some(({ a }) => (a.conteo && (a.conteo.n === p.raw || a.conteo.m === p.raw)) || (a.grupo && a.grupo.n === p.raw))) return true;
        /* «de los 12 bajo el benchmark», «esos 6», «los 3»: el entero restate un conteo o grupo declarado en otra oración */
        const restate = /(?:^|\s)(?:de\s+|entre\s+|sobre\s+)?(?:los|las|esos|esas|estos|estas|aquellos|aquellas)\s*$/i.test(s.slice(Math.max(0, p.pos - 12), p.pos));
        return restate && decl.some(({ a }) => (a.conteo && (a.conteo.n === p.raw || a.conteo.m === p.raw)) || (a.grupo && a.grupo.n === p.raw));
      }
      /* A · los dueños COORDINADOS van antes que la envoltura: «Lider junto con Falabella dejan 22,0 %» declarado solo para Falabella deja a Lider sin declarar */
      if (duenosTodos && duenosTodos.length > 1) {
        const cubreA0 = (d) => conCanon.some(({ a }) => (Array.isArray(a.sujeto) ? a.sujeto.some((x) => normalizar(x) === d || normalizar(x).includes(d) || d.includes(normalizar(x))) : typeof a.sujeto !== "string") || (typeof a.sujeto === "string" && (normalizar(a.sujeto) === d || normalizar(a.sujeto).includes(d) || d.includes(normalizar(a.sujeto)))) || (a.relacion && a.relacion.vs && typeof a.relacion.vs.sujeto === "string" && normalizar(a.relacion.vs.sujeto) === d));
        const sinDeclarar = duenosTodos.filter((d) => !cubreA0(d));
        if (sinDeclarar.length) { p.duenoSinDeclarar = sinDeclarar[0]; return false; }
        return true;
      }
      if (conCanon.some(({ a }) => envuelven.some((d) => d.a === a))) return true;
      const segundo = _duenoDelSegundoLado(s, p, envuelven);
      const dueno = segundo === undefined ? _duenoDelPunto(s, p, nombres, ejeDe, tramosEstructura) : segundo;
      if (!dueno) return true;
      /* A · cada dueño coordinado tiene que estar declarado con esa cifra (un sujeto en lista también cuenta) */
      const cubreA = (d) => conCanon.some(({ a }) => (Array.isArray(a.sujeto) ? a.sujeto.some((x) => normalizar(x) === d || normalizar(x).includes(d) || d.includes(normalizar(x))) : typeof a.sujeto !== "string") || (typeof a.sujeto === "string" && (normalizar(a.sujeto) === d || normalizar(a.sujeto).includes(d) || d.includes(normalizar(a.sujeto)))) || (a.relacion && a.relacion.vs && typeof a.relacion.vs.sujeto === "string" && normalizar(a.relacion.vs.sujeto) === d));
      if (duenosTodos && duenosTodos.length > 1) { const sinDeclarar = duenosTodos.filter((d) => !cubreA(d)); if (sinDeclarar.length) { p.duenoSinDeclarar = sinDeclarar[0]; return false; } return true; }
      /* una declaración del NEGOCIO no cubre la cifra que la prosa pone a una cuenta («Lider: 5.0 pp bajo el benchmark» con el 5.0 pp del negocio) */
      return conCanon.some(({ a }) => typeof a.sujeto !== "string" || normalizar(a.sujeto) === dueno || normalizar(a.sujeto).includes(dueno) || dueno.includes(normalizar(a.sujeto)) || (a.relacion && a.relacion.vs && typeof a.relacion.vs.sujeto === "string" && normalizar(a.relacion.vs.sujeto) === dueno));
    })();
    /* un ORDINAL («la segunda», «tercer») lo cubre solo un orden con ESE puesto (o el primero, cualquier máximo/mínimo) */
    const ordinal = p.clase === "orden" ? _ordinalDe(p.span) : null;
    /* «el primero» también es «el mayor / el que más» (cualquier extremo o comparativo lo cubre, y una relación mayor/menor —«ese sale del inventario y
     * el primero de la venta» es anafórico—); «la segunda», «tercer» solo con ESE puesto */
    const ordinalCubierto = ordinal == null ? null : envuelven.some(({ a }) => (a.tipo === "orden" && a.orden && (ordinal === 1 ? /^(?:max|min|puesto|topk|comparativo)$/.test(String(a.orden.forma)) && (a.orden.forma !== "puesto" || a.orden.k === 1) : (a.orden.forma === "puesto" && a.orden.k === ordinal))) || (ordinal === 1 && a.tipo === "relacion" && a.relacion && /^(?:mayor|menor)$/.test(String(a.relacion.forma))));
    /* «de los 12 bajo el benchmark» en otra oración: la relación restate un conteo declarado (su n pegado antes, misma dirección y referencia) */
    const conteoRestatado = (p) => decl.some(({ a }) => (a.tipo === "conteo" || a.tipo === "grupo") && Number.isFinite(a.conteo && a.conteo.n) && new RegExp("(?<![\\d.,])" + a.conteo.n + "\\s+(?:[a-záéíóúñ]+\\s+){0,2}$", "i").test(s.slice(Math.max(0, p.pos - 24), p.pos)) && _relacionCubierta(p, a, s));
    const cubre = numeroDelOrden || mencionDeGrupo || colaDeLista || relacionDirigida || (esCola && p.canon && canonColas.has(p.canon)) || (p.clase === "cifra" ? cubiertaPorCanon : p.clase === "estado" ? envuelven.some(({ a }) => _estadoCubierto(p.span, a, p)) : p.clase === "relacion" ? (envuelven.some(({ a }) => _relacionCubierta(p, a, s)) || conteoRestatado(p)) : ordinalCubierto != null ? ordinalCubierto : envuelven.some(({ a }) => _cubrePorClase(p, a, s, nombres)));   // por significado: misma métrica y mismo sujeto (ver _cubrePorClase); «quién empuja el crecimiento» es un orden por la variación
    if (cubre) { out.cubiertos++; continue; }
    const soloLectura = envuelven.length && envuelven.every(({ a }) => a.tipo === "lectura");
    const otroTipo = envuelven.length && !soloLectura;
    out.omisiones.push({ clase: p.duenoSinDeclarar ? "cifra" : soloLectura ? "hecho-como-lectura" : otroTipo ? `significado-no-declarado:${p.clase}` : p.clase, span: p.span, pos: p.pos, motivo: p.duenoSinDeclarar ? `«${p.span}» también es de ${p.duenoSinDeclarar} (sujeto coordinado) y no está declarada para esa cuenta` : soloLectura ? `«${p.span}» está declarado solo como lectura` : otroTipo ? `«${p.span}» (${p.clase}) cae en una afirmación de tipo ${[...new Set(envuelven.map(({ a }) => a.tipo))].join("/")}` : `«${p.span}» (${p.clase}) no cae en ninguna afirmación declarada` });
  }
  out.cobertura = afirmados ? out.cubiertos / afirmados : 1;
  out.afirmados = afirmados;
  out.sinUbicar = decl.filter(({ rango, a }) => !rango && a.texto).map(({ a }) => a.id);
  return out;
}
export { _CLASES as CLASES_DE_PUNTO };
