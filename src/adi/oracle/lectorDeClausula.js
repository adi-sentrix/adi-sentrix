/* === src/adi/oracle/lectorDeClausula.js · EL LECTOR DE CLÁUSULA (owner 2026-09-14) ═══════════════════════════════
 *
 * LA RAÍZ COMÚN DE LOS 17 FALSOS POSITIVOS MEDIDOS (auditoría del Notario sobre los 12 borradores reales de las seis
 * corridas vivas, `_AUDITORIA_NOTARIO_2026-09-14.md`): cada chequeo de atribución del muro decidía «de quién es esta
 * cifra / quién reclama este extremo / a qué se refiere esta palabra» con ventanas de ±90 caracteres, el nombre más
 * cercano y listas de palabras — cruzando cláusulas, paréntesis, dos puntos y párrafos. Cada cierre agregaba una
 * excepción local a un chequeo, y el siguiente borrador traía otra forma. Palabra del owner: «no quiero más parches
 * frase por frase; cada cierre ataca la familia de error completa». La familia es UNA: la estructura de la frase. Este
 * módulo es el único lector de esa estructura, y todos los chequeos de atribución (muro y contrato) leen de acá.
 *
 * QUÉ DEVUELVE `leerClausula(texto, pos, { nombres | nombresRe })` para una posición del texto (una cifra, un marcador
 * de extremo, una palabra):
 *   (a) la CLÁUSULA que contiene la posición — cortada por «.», «;», «:», «—»/«–» (rayas, y « - » con espacios), saltos
 *       de línea (viñetas incluidas) y signos de cierre. Un paréntesis es una cláusula aparte —y un inciso entre dos rayas
 *       también («Lider — tu segunda cuenta — tiene $4.6M», ver _rayasPareadas)—: la posición adentro lee solo su
 *       contenido; la cláusula que lo contiene se lee SIN su contenido (el inciso queda en blanco, con la misma longitud,
 *       así ninguna posición se corre).
 *         · «lo que más vende: LG-DRYER8KG ($14K frenados, 165 días de cobertura, en Valparaíso), BOS-SANDER (…)»
 *           → la cláusula de «$14K» es «$14K frenados, 165 días de cobertura, en Valparaíso» y «vende» NO pertenece
 *           a ella (está del otro lado de los dos puntos y fuera del paréntesis). P1·3, falso positivo vigente.
 *   (b) el SUJETO: la última entidad real nombrada ANTES de la posición dentro de la cláusula, ignorando nombres dentro
 *       de paréntesis y nombres del otro lado de unos dos puntos, y saltando la COMPARADA («peor que Falabella»,
 *       «contra Falabella»: es el objeto de la comparación, no el sujeto). Si la cláusula no tiene sujeto propio, el de
 *       la cláusula anterior de la misma oración (para un paréntesis: la cláusula que lo contiene, leída hasta el «(»).
 *         · «Lider pesa más: 8.6 pp de brecha (peor que Falabella), $4.6M vencidos … y 269 días de atraso» → el sujeto
 *           de «269 d» es Lider: el paréntesis no le quita la oración (P2·3, cerrado a mano; acá por estructura).
 *         · «Lider: $9.8M de saldo pendiente, de eso $4.6M vencidos» → sujeto de «$9.8M» = Lider (cláusula anterior).
 *         · «lo que más vende: LG-DRYER8KG ($14K frenados…)» → sujeto de «$14K» = LG-DRYER8KG (la cláusula que
 *           contiene el paréntesis, leída hasta el «(»), no «vende».
 *   (c) el REFERENTE de un pronombre de objeto o de un sujeto elidido («la supera», «su brecha», «Es más grave que…»):
 *       la última entidad de hasta dos oraciones atrás (mismo párrafo) que no esté en la oración actual, con la lista de
 *       las entidades de esa oración (`nombrados`) para que un chequeo que CONDENA exija antecedente único.
 *         · «iría por Lider. La razón es la severidad: su brecha … que la de Falabella (…). Falabella solo la supera en
 *           un punto ($1.6M contra $1.5M)» → el «la» es Lider, dos oraciones atrás (P2·3).
 *   (d) las LISTAS coordinadas contiguas que terminan en el sujeto («A, B y C», «A ($x) y B ($y)») — la corrida de
 *       `coordinadasContiguas`, que vivía en guardC y ahora vive acá — y si la lista está CERRADA con «y»/«e» (un sujeto
 *       plural coordinado: «Falabella, Jumbo y Lider concentran la mayor contribución» es un grupo, no un reclamante).
 *         · «Después de Jumbo y Sodimac, Lider concentra la mayor contribución» → la corrida termina en Lider pero el
 *           último puente es una coma: NO es lista cerrada, el reclamante es Lider (candado del Examen 4).
 *   (e) si la posición está bajo NEGACIÓN dentro de la cláusula: un «no / ni / tampoco / nunca / jamás / sin» antes de
 *       la posición, en la misma cláusula, sin un «sino / pero / aunque / mientras» entre medio y a ≤ 8 palabras.
 *         · «no porque coincidir en dos dominios lo decida solo, sino porque en cada uno pesa más» → «coincidir» está
 *           negado; lo que sigue a «sino» NO lo está («no porque pese más, sino porque coincide en dos dominios» afirma
 *           la coincidencia como razón, y se cobra). P2·3.
 *   (f) el RÓTULO: si la cláusula abre con «:» o una raya y la posición es su primer token («El margen: $655K — …»,
 *       «Lider: $9.8M»), la cláusula anterior es el rótulo de la posición y la describe (`rotulo`); para una posición
 *       dentro de un paréntesis, `contenedor` es la cláusula que lo contiene, leída hasta el «(» («carga de Jumbo (3.8%)»).
 *
 * PURO Y SIN DEPENDENCIAS DEL MURO: recibe las entidades como lista de nombres (o como regex ya compiladas con
 * `compilarNombres`) — no sabe de tenants, boletas ni rankings. Normaliza el texto SIN cambiar su longitud (acentos
 * fuera, minúsculas, dígitos enmascarados con «#»), así cada posición que devuelve es una posición del texto original.
 * Lo que NO hace, a propósito: no decide nada. Devuelve la estructura; cada chequeo sigue aplicando su propia ley. */

const _MARCA = /[\u0300-\u036f]/;
/** normaliza CONSERVANDO LA LONGITUD: sin acentos, en minúsculas; un acento suelto (texto ya descompuesto) deja un
 *  espacio en su lugar. Las posiciones del texto normalizado son las del original — la garantía que todo lo demás usa. */
export function normalizar(texto) {
  let out = "";
  for (const ch of String(texto == null ? "" : texto)) {
    let base = "";
    for (const c of ch.normalize("NFD")) if (!_MARCA.test(c)) base += c;
    if (!base) base = " ";
    const low = base.toLowerCase();
    out += low.length === ch.length ? low : base.length === ch.length ? base : ch;
  }
  return out;
}
/** cada número («4.9», «1.194», «2026») pasa a «#» de la misma longitud: el punto decimal y el separador de miles dejan
 *  de parecer un fin de oración (el mismo patrón que `_maskFigures` en el muro, sin depender de la boleta). */
export function enmascararNumeros(texto) {
  return String(texto == null ? "" : texto).replace(/\d+(?:[.,]\d+)*/g, (m) => "#".repeat(m.length));
}
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** las regex de nombre con frontera Unicode, sobre texto NORMALIZADO — la misma forma que compila el muro para sus
 *  dueños (`_duenosDeBoleta`), para que un chequeo pueda pasarle las suyas sin recompilar. Acepta regex ya hechas. */
export function compilarNombres(nombres) {
  const out = [];
  for (const n of Array.isArray(nombres) ? nombres : []) {
    if (n instanceof RegExp) { out.push(n); continue; }
    const nn = normalizar(String(n == null ? "" : n).trim());
    if (nn.length >= 2) out.push(new RegExp(`(?:^|[^\\p{L}\\p{N}])${_esc(nn)}(?:[^\\p{L}\\p{N}]|$)`, "u"));
  }
  return out;
}

/* ── LAS ENTIDADES DE UN TRAMO, Y LA COORDINACIÓN (venían de guardC; el muro las importa de acá) ─────────────────
 * `entidadesConPosicion(tramoN, nombresRe)`: las entidades reales que nombra un tramo (normalizado), con la posición de su
 * última aparición, en el orden en que aparecen; un nombre contenido en otro más largo en la misma posición no cuenta dos
 * veces. `coordinadasContiguas`: SOLO las entidades coordinadas entre sí — la última corrida de nombres unidos por coma,
 * «y», «contra», «vs» o «frente a», admitiendo una cifra entre paréntesis pegada al nombre («SAM-REF500L ($19K) y
 * LG-WASH11KG ($15K)»). FALSO POSITIVO MEDIDO que la definió (prueba 1 de la v2.31): «Falabella es la mayor brecha de
 * contribución sin capturar ($1.6M), y Lider es la cuenta con peores indicadores de cobranza (…) y la mayor distancia al
 * benchmark de margen (8.6 pp contra 8.1 pp de Falabella)» — Falabella y Lider son los sujetos de DOS cláusulas, no una
 * lista coordinada; el par «8.6 pp contra 8.1 pp» no se reparte entre ellas por orden. */
export function entidadesConPosicion(tramoN, nombresRe) {
  const vistas = new Map();
  for (const re of nombresRe || []) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m;
    while ((m = g.exec(tramoN))) {
      const nombre = m[0].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      vistas.set(nombre, m.index + m[0].indexOf(nombre));
      if (!m[0].length) g.lastIndex++;
    }
  }
  const lista = [...vistas.entries()].sort((a, b) => a[1] - b[1]);
  return lista.filter(([nombre, pos], i) => !lista.some(([o, p], j) => j !== i && o.length > nombre.length && p <= pos && pos < p + o.length)).map(([nombre, pos]) => ({ nombre, pos }));
}
export const SEP_COORD = "(?:,\\s*|\\s+(?:[ye]|contra|vs\\.?|frente a)\\s+)";   // «x y y» · «x contra y» · «x vs y»
const _PUENTE_COORD = new RegExp("^(?:\\s*\\([^()]*\\))*\\s*" + SEP_COORD + "(?:\\s*\\([^()]*\\))*\\s*$", "u");   // « ($19K) y » · «, » · « contra » — nada más entre dos nombres coordinados
const _PUENTE_CIERRA = /^(?:\s*\([^()]*\))*\s+[ye]\s+(?:\s*\([^()]*\))*\s*$/u;   // el puente que CIERRA una lista: «A, B y C»
export function coordinadasContiguas(tramoN, nombresRe) {
  const ents = entidadesConPosicion(tramoN, nombresRe);
  let i = ents.length - 1;
  while (i > 0 && _PUENTE_COORD.test(tramoN.slice(ents[i - 1].pos + ents[i - 1].nombre.length, ents[i].pos))) i--;
  return ents.slice(i).map((e) => e.nombre);
}

/* ── LA ESTRUCTURA ─────────────────────────────────────────────────────────────────────────────────────────────── */
const _FIN_ORACION = /[.!?…\n]/g;
const _FIN_CLAUSULA = /[.!?…\n;:—–]|(?<=\s)-(?=\s)/g;
/** los paréntesis bien formados del texto, como pares [abre, cierra] (anidados incluidos; uno sin cerrar es texto) */
function _parentesis(m) {
  const pares = [], pila = [];
  for (let i = 0; i < m.length; i++) {
    if (m[i] === "(") pila.push(i);
    else if (m[i] === ")" && pila.length) pares.push([pila.pop(), i]);
  }
  return pares.sort((a, b) => a[0] - b[0]);
}
/* ── EL INCISO ENTRE RAYAS ES UN PARÉNTESIS (medido al cablear el lector, 2026-09-14) ───────────────────────────────
 * «Entre Lider y Falabella —que son las dos cuentas más grandes del canal retail y las que más pesan…—, la distancia al
 * benchmark es 8.6 pp contra 8.1 pp»: el demo declara el canal «Retail», así que el inciso nombra una entidad; leído como
 * cláusula anterior, «retail» salía sujeto de «8.6 pp» y el muro condenaba una frase correcta (el viejo la pasaba solo
 * porque la ventana de 90 caracteres no llegaba a verlo). En español dos rayas encierran un inciso exactamente como un
 * paréntesis: «Lider — tu segunda cuenta en crecimiento — tiene $4.6M vencidos», «—no una cifra del dato—», «El negocio
 * crece —$99.9M, +7.5%— pero…». Se parean de a dos DENTRO de la oración, y solo si el tramo encerrado no lleva «;» ni «:»
 * (eso es una lista de cláusulas, no un inciso) y la raya de cierre no abre una cifra («Lider — $4.6M, Falabella — $2.5M»
 * son dos rótulos con raya, y ahí cada raya sigue siendo un corte). Una raya sola sigue cortando la cláusula. */
const _RAYA = /[—–]/g;
function _rayasPareadas(planoP) {
  const pares = [];
  const g = new RegExp(_FIN_ORACION.source, "gu");
  let ini = 0, m;
  const oraciones = [];
  while ((m = g.exec(planoP))) { oraciones.push([ini, m.index]); ini = m.index + m[0].length; if (!m[0].length) g.lastIndex++; }
  oraciones.push([ini, planoP.length]);
  for (const [a, b] of oraciones) {
    const rayas = [];
    const r = new RegExp(_RAYA.source, "gu");
    r.lastIndex = a;
    let mr;
    while ((mr = r.exec(planoP)) && mr.index < b) rayas.push(mr.index);
    for (let i = 0; i + 1 < rayas.length;) {
      const [x, y] = [rayas[i], rayas[i + 1]];
      const entre = planoP.slice(x + 1, y);
      const cierraConCifra = /^[\s*_]*[$+\-]?#/.test(planoP.slice(y + 1, y + 8));
      if (entre.length <= 200 && !/[;:]/.test(entre) && !cierraConCifra) { pares.push([x, y]); i += 2; } else i += 1;
    }
  }
  return pares;
}
/** deja en blanco (espacios, misma longitud) los tramos dados de un texto */
function _blanquear(m, tramos) {
  if (!tramos.length) return m;
  const arr = m.split("");
  for (const [a, b] of tramos) for (let i = a; i <= b && i < arr.length; i++) arr[i] = " ";
  return arr.join("");
}
/** el segmento de [ini, fin) que contiene `pos`, cortado por `re`; devuelve [a, b, abre, abreIdx]: `abre` es el delimitador
 *  que lo abrió (null si empieza en `ini`). */
function _segmento(plano, ini, fin, pos, re) {
  let a = ini, b = fin, abre = null, abreIdx = -1;
  const g = new RegExp(re.source, "gu");
  g.lastIndex = ini;
  let m;
  while ((m = g.exec(plano)) && m.index < fin) {
    if (m.index < pos) { a = m.index + m[0].length; abre = m[0]; abreIdx = m.index; }
    else { b = m.index; break; }
    if (!m[0].length) g.lastIndex++;
  }
  return [a, b, abre, abreIdx];
}
/* la COMPARADA no es el sujeto: «peor que Falabella», «mayor que la de Falabella», «contra Falabella», «frente a Lider». El «que»
 * SOLO cuenta con un comparativo delante (más/menos/mayor/menor/peor/mejor/igual… que): «mientras que Lider vende $19.4M», «ya que
 * Lider…», «porque Lider…» son conjunciones y Lider es el sujeto (candado medido: «mientras que Lider vende $19.4M» tiene que arder). */
const _COMPARADA = /(?:^|[^\p{L}])(?:(?:mas|menos|mayor(?:es)?|menor(?:es)?|peor(?:es)?|mejor(?:es)?|igual|distint[oa]s?|diferentes?|antes|despues)(?:[^.;:—–]{0,30}?)\s+que|contra|frente a|versus|vs\.?|respecto (?:a|de)|comparad[oa]s? con|a diferencia de)\s+(?:(?:el|la|los|las|un|una|su|sus)\s+(?:de\s+)?)?$/iu;
const _esComparada = (texto, pos) => _COMPARADA.test(texto.slice(Math.max(0, pos - 40), pos));
/* la NEGACIÓN y lo que la rompe (ver (e) arriba) */
const _NEGACION = /(?:^|[^\p{L}])(no|ni|tampoco|nunca|jamas|sin|nadie|nada)(?=[^\p{L}]|$)/gu;
const _ROMPE_NEGACION = /(?:^|[^\p{L}])(?:sino|pero|aunque|mientras)(?=[^\p{L}]|$)/u;
const _ALCANCE_NEGACION = 8;   // palabras: «no porque coincidir en dos dominios lo decida solo» son seis
function _negada(tramo) {
  let ultimo = -1, m;
  _NEGACION.lastIndex = 0;
  while ((m = _NEGACION.exec(tramo))) ultimo = m.index + m[0].length - m[1].length;
  if (ultimo < 0) return false;
  const entre = tramo.slice(ultimo);
  if (_ROMPE_NEGACION.test(entre)) return false;
  return entre.trim().split(/\s+/).filter(Boolean).length <= _ALCANCE_NEGACION + 1;
}
/* la posición es el PRIMER TOKEN de su cláusula: solo espacio, énfasis, signo o hasta dos palabras cortas antes («: $655K»,
 * «: solo $655K», «— la más alta») */
const _PRIMER_TOKEN = /^[\s*_«"'¿¡$+\-]*(?:\p{L}+\s+){0,2}[\s*_«"'$+\-]*$/u;
/* el sujeto lleva determinante («la carga baja», «su margen baja», «esa carga baja», con una palabra opcional entre medio) */
const _DETERMINANTE = /(?:^|[^\p{L}])(?:el|la|los|las|un|una|su|sus|tu|tus|mi|mis|es[aet]|est[aet]|es[oa]s|est[oa]s|nuestr[oa]s?|del|al)\s+(?:\p{L}+\s+)?$/u;

/**
 * leerClausula(texto, pos, { nombres, nombresRe }) → la estructura alrededor de `pos` (ver la cabecera).
 * @returns {{
 *   oracion:{ini:number,fin:number}, clausula:{ini:number,fin:number,texto:string,abre:string|null},
 *   enParentesis:boolean, apertura:number, contenedor:{ini:number,fin:number,texto:string}|null,
 *   rotulo:{ini:number,fin:number,texto:string}|null, primerToken:boolean,
 *   sujeto:{nombre:string,pos:number}|null, sujetoPropio:boolean,
 *   coordinadas:string[], listaCerrada:boolean,
 *   referente:{nombre:string,pos:number,candidatos:string[],nombrados:string[],oracion:{ini:number,fin:number}}|null,
 *   negada:boolean, determinante:boolean, plano:string   // plano: el texto normalizado con los paréntesis en blanco (misma longitud)
 * }}
 */
export function leerClausula(texto, pos, { nombres = [], nombresRe = null } = {}) {
  const t = String(texto == null ? "" : texto);
  const p = Math.max(0, Math.min(Number(pos) || 0, t.length));
  /* DOS PLANOS DE LA MISMA LONGITUD: el enmascarado (dígitos → «#») decide los cortes —el punto decimal no es fin de oración—;
   * el normalizado SIN enmascarar es donde se buscan los nombres, porque un nombre puede llevar dígitos («LG-DRYER8KG»,
   * medido: con la máscara, «lg-dryer#kg» no casaba con su regex y el sujeto de «$14K» salía vacío). */
  /* el ÉNFASIS de markdown no es texto: «**SAM-REF500L** y **LG-WASH11KG** … ($2.4M y $2.9M)» (final vivo del cruce) es la misma
   * coordinación que sin negritas — los asteriscos pasan a espacio (misma longitud) y el puente «y» vuelve a unir los dos nombres */
  const Nn = normalizar(t).replace(/\*/g, " ");
  const M = enmascararNumeros(Nn);
  const parentesis = _parentesis(M);
  const pares = [...parentesis, ..._rayasPareadas(_blanquear(M, parentesis))].sort((u, v) => u[0] - v[0]);   // paréntesis + incisos entre rayas
  const plano = _blanquear(M, pares);                       // el nivel superior para CORTAR: sin el contenido de ningún inciso
  const planoN = _blanquear(Nn, pares);                     // el nivel superior para NOMBRAR
  const res = Array.isArray(nombresRe) ? nombresRe : compilarNombres(nombres);
  const dentro = pares.filter(([a, b]) => a < p && p < b).sort((x, y) => (x[1] - x[0]) - (y[1] - y[0]))[0] || null;
  const anclaSup = dentro ? dentro[0] : p;                  // la posición que representa a `pos` en el nivel superior
  const [oIni, oFin] = _segmento(plano, 0, plano.length, anclaSup, _FIN_ORACION);
  const entidadesEn = (texto_, ini, fin) => entidadesConPosicion(texto_.slice(ini, fin), res).map((e) => ({ nombre: e.nombre, pos: ini + e.pos }));

  let clausula, contenedor = null, interiorN = null, interiorBase = 0, cabeza, tramoSujeto, textoSujeto;
  if (dentro) {
    const [a, b] = dentro;
    interiorBase = a + 1;
    const anidados = pares.filter(([x, y]) => x > a && y < b).map(([x, y]) => [x - interiorBase, y - interiorBase]);
    const interior = _blanquear(M.slice(a + 1, b), anidados);
    interiorN = _blanquear(Nn.slice(a + 1, b), anidados);
    const [ci, cf, abre] = _segmento(interior, 0, interior.length, p - interiorBase, _FIN_CLAUSULA);
    clausula = { ini: interiorBase + ci, fin: interiorBase + cf, texto: interiorN.slice(ci, cf), abre };
    const [pi, pf] = _segmento(plano, oIni, oFin, a, _FIN_CLAUSULA);
    contenedor = { ini: pi, fin: Math.min(pf, a), texto: planoN.slice(pi, Math.min(pf, a)) };
    cabeza = interiorN.slice(ci, p - interiorBase);
    textoSujeto = interiorN; tramoSujeto = [ci, p - interiorBase];
  } else {
    const [ci, cf, abre, abreIdx] = _segmento(plano, oIni, oFin, p, _FIN_CLAUSULA);
    clausula = { ini: ci, fin: cf, texto: planoN.slice(ci, cf), abre };
    cabeza = planoN.slice(ci, p);
    textoSujeto = planoN; tramoSujeto = [ci, p];
    if (abreIdx > oIni) {
      const [ri, rf] = _segmento(plano, oIni, oFin, abreIdx - 1, _FIN_CLAUSULA);
      clausula.rotuloPrevio = { ini: ri, fin: Math.min(rf, abreIdx), texto: planoN.slice(ri, Math.min(rf, abreIdx)) };
    }
  }
  const primerToken = _PRIMER_TOKEN.test(cabeza);
  const rotulo = !dentro && primerToken && clausula.rotuloPrevio && /^[:—–-]$/.test(String(clausula.abre || "")) ? clausula.rotuloPrevio : null;
  delete clausula.rotuloPrevio;

  /* (b) el sujeto */
  const propias = entidadesEn(textoSujeto, tramoSujeto[0], tramoSujeto[1]).filter((e) => !_esComparada(textoSujeto, e.pos));
  let sujeto = propias.length ? { nombre: propias[propias.length - 1].nombre, pos: (dentro ? interiorBase : 0) + propias[propias.length - 1].pos } : null;
  const sujetoPropio = !!sujeto;
  if (!sujeto) {
    const hasta = dentro ? dentro[0] : clausula.ini;
    const previas = entidadesEn(planoN, oIni, Math.max(oIni, hasta)).filter((e) => !_esComparada(planoN, e.pos));
    if (previas.length) sujeto = { nombre: previas[previas.length - 1].nombre, pos: previas[previas.length - 1].pos };
  }
  /* (d) la coordinación que termina en el sujeto propio */
  const tramoN = textoSujeto.slice(tramoSujeto[0], tramoSujeto[1]);
  const entsTramo = entidadesConPosicion(tramoN, res);
  const coordinadas = sujetoPropio ? coordinadasContiguas(tramoN, res) : [];
  let listaCerrada = false;
  if (coordinadas.length >= 2) {
    const u = entsTramo[entsTramo.length - 1], v = entsTramo[entsTramo.length - 2];
    listaCerrada = !!(u && v) && _PUENTE_CIERRA.test(tramoN.slice(v.pos + v.nombre.length, u.pos));
  }
  /* (c) el referente: hasta dos oraciones atrás, mismo párrafo */
  let referente = null;
  {
    const parIni = Math.max(0, t.lastIndexOf("\n\n", Math.max(0, oIni - 1)));
    const actuales = new Set(entidadesEn(planoN, oIni, oFin).map((e) => e.nombre));
    const previas = [];
    let cursor = parIni;
    const g = new RegExp(_FIN_ORACION.source, "gu");
    g.lastIndex = parIni;
    let m;
    while ((m = g.exec(plano)) && m.index < oIni) { previas.push([cursor, m.index]); cursor = m.index + m[0].length; if (!m[0].length) g.lastIndex++; }
    for (const [ini, fin] of previas.filter(([a, b]) => /\p{L}/u.test(plano.slice(a, b))).slice(-2).reverse()) {
      const ents = entidadesEn(planoN, ini, fin);
      if (!ents.length) continue;
      const cand = ents.filter((e) => !actuales.has(e.nombre));
      if (!cand.length) continue;
      referente = { nombre: cand[cand.length - 1].nombre, pos: cand[cand.length - 1].pos, candidatos: cand.map((e) => e.nombre), nombrados: ents.map((e) => e.nombre), oracion: { ini, fin } };
      break;
    }
  }
  /* (e) la negación, dentro de la cláusula */
  const negada = _negada(cabeza);
  const determinante = _DETERMINANTE.test(cabeza);
  return { oracion: { ini: oIni, fin: oFin }, clausula, enParentesis: !!dentro, apertura: dentro ? dentro[0] : -1, contenedor, rotulo, primerToken, sujeto, sujetoPropio, coordinadas, listaCerrada, referente, negada, determinante, plano: planoN };
}

/** ¿la posición está bajo negación dentro de su cláusula? (ver (e)) */
export function bajoNegacion(texto, pos) { return leerClausula(texto, pos).negada; }
/** ¿el sustantivo en `pos` lleva determinante delante, dentro de su cláusula? («la carga baja» verbo · «carga baja» adjetivo) */
export function conDeterminante(texto, pos) { return leerClausula(texto, pos).determinante; }
