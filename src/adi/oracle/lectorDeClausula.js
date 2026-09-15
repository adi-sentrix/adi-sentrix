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
/* la coordinación de NOMBRES admite la disyunción («Falabella o Lider … 22.0% y 21.5%» reparte por orden igual; candado de la constitución P4,
 * 2026-09-14); la de CIFRAS no: «estado 90d o 120d» es una alternativa entre dos valores, no un par repartido (candado del roce de universos) */
export const SEP_COORD = "(?:,\\s*|\\s+(?:[yeou]|contra|vs\\.?|frente a)\\s+)";   // «x y y» · «x o y» · «x contra y» · «x vs y»
export const SEP_COORD_CIFRAS = "(?:,\\s*|\\s+(?:[ye]|contra|vs\\.?|frente a)\\s+)";   // el puente entre dos cifras coordinadas, sin «o»
const _CIFRA_PEGADA = "(?:\\s+[+\\-]?[$€£]?\\d[\\d.,]*\\s?(?:[kmb]|%|pp|d(?:ias?)?|x)?)?";   // «Lider $17.8M,» · «Easy (270 días),»: la cifra pegada al nombre no rompe la lista
const _PUENTE_COORD = new RegExp("^(?:\\s*\\([^()]*\\))*" + _CIFRA_PEGADA + "\\s*" + SEP_COORD + "(?:\\s*\\([^()]*\\))*\\s*$", "u");   // « ($19K) y » · «, » · « contra » — nada más entre dos nombres coordinados
const _PUENTE_CIERRA = new RegExp("^(?:\\s*\\([^()]*\\))*" + _CIFRA_PEGADA + "\\s+[yeou]\\s+(?:\\s*\\([^()]*\\))*\\s*$", "u");   // el puente que CIERRA una lista: «A, B y C»
export function coordinadasContiguas(tramoN, nombresRe) {
  const ents = entidadesConPosicion(tramoN, nombresRe);
  let i = ents.length - 1;
  while (i > 0 && _PUENTE_COORD.test(tramoN.slice(ents[i - 1].pos + ents[i - 1].nombre.length, ents[i].pos))) i--;
  return ents.slice(i).map((e) => e.nombre);
}
/* ── TODAS LAS CORRIDAS COORDINADAS DE UN TRAMO (owner 2026-09-14, la cifra de un grupo es del grupo completo) ────
 * `coordinadasContiguas` devuelve SOLO la corrida que termina en el último nombre. Para leer el REFERENTE de un pronombre
 * de grupo («ese mismo grupo», «estos cuatro», «su») hace falta la última LISTA del párrafo —dos o más nombres
 * coordinados—, esté o no al final: «Falabella, Lider, Jumbo y Sodimac están bajo el benchmark … Las acciones comerciales
 * se están comiendo contribución ahí. Ese mismo grupo tiene markup promedio 41.4%» → la lista es la de cuatro. Devuelve
 * cada corrida maximal, con su posición de inicio y de fin (relativa al tramo) y si cierra con «y»/«e». Un nombre
 * suelto es una corrida de largo 1: quien lea el referente decide si le alcanza (para un pronombre de grupo, no).
 * …y se leen con TODAS las ocurrencias de cada nombre, no solo la última (el orden en todas sus formas, 2026-09-14): «Falabella, Lider y Jumbo
 * empujan el crecimiento. De los tres, JUMBO tiene el margen más bajo» — con la última ocurrencia de Jumbo (la del sujeto) la lista de tres
 * quedaba en dos y «de los tres» no resolvía a nadie. Lo demás del lector sigue usando la última (`entidadesConPosicion`). */
function _entidadesTodas(tramoN, nombresRe) {
  const out = [];
  for (const re of nombresRe || []) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m;
    while ((m = g.exec(tramoN))) {
      const nombre = m[0].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      out.push({ nombre, pos: m.index + m[0].indexOf(nombre) });
      if (!m[0].length) g.lastIndex++;
    }
  }
  const lista = out.sort((a, b) => a.pos - b.pos);
  return lista.filter((e, i) => !lista.some((o, j) => j !== i && o.nombre.length > e.nombre.length && o.pos <= e.pos && e.pos < o.pos + o.nombre.length));
}
export function listasCoordinadas(tramoN, nombresRe) {
  const ents = _entidadesTodas(tramoN, nombresRe);
  const out = [];
  let i = 0;
  while (i < ents.length) {
    let j = i;
    while (j + 1 < ents.length && _PUENTE_COORD.test(tramoN.slice(ents[j].pos + ents[j].nombre.length, ents[j + 1].pos))) j++;
    const u = ents[j], v = j > i ? ents[j - 1] : null;
    out.push({ nombres: ents.slice(i, j + 1).map((e) => e.nombre), ini: ents[i].pos, fin: u.pos + u.nombre.length,
      items: ents.slice(i, j + 1).map((e) => ({ nombre: e.nombre, ini: e.pos, fin: e.pos + e.nombre.length })),
      cerrada: !!v && _PUENTE_CIERRA.test(tramoN.slice(v.pos + v.nombre.length, u.pos)) });
    i = j + 1;
  }
  return out;
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
/** el texto normalizado con SOLO los paréntesis en blanco (misma longitud) — los incisos entre rayas se conservan: «Los tres motores
 *  más grandes —Falabella, Lider y Jumbo— están bajo el benchmark (22%, 21.5% y 24%)» reparte por esa lista (owner 2026-09-14) */
export function blanquearParentesis(texto) {
  const Nn = normalizar(texto).replace(/\*/g, " ");
  return _blanquear(Nn, _parentesis(enmascararNumeros(Nn)));
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
/* …y los marcadores de CONTRASTE también son la comparada (owner 2026-09-14, atribución y significado — fp-comparaciones 5): «el caso
 * opuesto a Lider», «la antítesis de Lider», «no así Lider», «al revés que Lider», «en contraste con Lider», «lo contrario de Lider»,
 * «fuera de Lider», «después de Lider», «salvo Lider», «excepto Lider»: la entidad nombrada es el otro lado, y el sujeto es quien viene
 * antes (o quien sigue: «Fuera de Lider, el mayor vencido es el de Falabella»). NO entran «junto con», «seguido de», «tras»: ahí la
 * entidad que sigue trae su propia cifra pegada («seguido de Jumbo ($4.2M)») y es dueña de ella. */
const _COMPARADA = /(?:^|[^\p{L}]|(?=[,(]))(?:[,(]\s*no|(?:mas|menos|mayor(?:es)?|menor(?:es)?|peor(?:es)?|mejor(?:es)?|igual|distint[oa]s?|diferentes?|antes|despues)(?:[^.;:—–]{0,60}?)(?<!(?:mientras|ya|sino|dado|puesto|por lo|hasta|para|antes de|despues de))\s+que|contra|frente a|versus|vs\.?|respecto (?:a|de)|comparad[oa]s? con|a diferencia de|(?:el|la) (?:caso )?(?:opuest[oa]|contrari[oa]|antitesis|reves|inversa?) (?:a|de|que)|no asi|y no|al reves que|en contraste con|contrasta con|(?:el|la) (?:espejo|opuesto|reverso) de|fuera de|despues de|salvo|excepto|aparte de|detras de|delante de|por (?:encima|debajo) de|(?:super|gan|aventaj|igual|rebas|adelant|desplaz|dobl|duplic|triplic)[a-z]*\s+al?|(?:la mitad|el doble|el triple|un tercio|la tercera parte|un cuarto|[a-z]+ veces)\s+(?:de\s+)?(?:lo\s+)?que(?:\s+\p{L}+){0,2}|(?:la mitad|el doble|el triple|un tercio|la tercera parte|un cuarto|[a-z]+ veces)\s+(?:de|del)(?:\s+\p{L}+){0,3}\s+de)\s+(?:(?:el|la|los|las|un|una|unos|unas)\s+)?(?:[+\-]?[$€£]?\d[\d.,]*\s?(?:[kmb]|%|pp|d(?:ias?)?|x)?\s+(?:de|del)\s+)?(?:(?:el|la|los|las|un|una|su|sus|al|del)\s+)?(?:de\s+)?$/iu;
/* …y la comparada puede venir DETRÁS de su cifra: «Lider vende $17.8M contra $19.4M de Falabella, y aporta $3.8M contra $4.3M» — Falabella
 * es la comparada (la aposición «$19.4M de Falabella» va tras «contra»), no el sujeto de «$3.8M»; medido en el playbook de contradicción
 * de métricas (owner 2026-09-14). El tramo opcional «<cifra> de» entre el conector y el nombre lo admite. */
const _esComparada = (texto, pos) => _COMPARADA.test(texto.slice(Math.max(0, pos - 80), pos));
/** ¿la posición es la COMPARADA de su cláusula? («… que el de los sanos (markup 41.4% contra 57.3%)»: el 57.3% va tras «contra»,
 *  y «los sanos» tras «que el de» — los dos son el otro lado de la comparación). Sobre texto NORMALIZADO (`normalizar`). Lo
 *  usa el chequeo de grupos para emparejar cada referencia con SU cifra: la que no es comparada con la que no es comparada. */
export function esComparada(textoN, pos) { return _esComparada(String(textoN == null ? "" : textoN), Math.max(0, Number(pos) || 0)); }
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
/* ── EL PRONOMBRE DE OBJETO Y LAS ANÁFORAS (owner 2026-09-14, atribución y significado) ─────────────────────────────────────
 * «Falabella LO supera ($4.3M contra $4.2M)»: el «lo» es la otra entidad de la oración (Jumbo), y el par «contra» es (sujeto, objeto).
 * Solo con un verbo de comparación detrás: «la venta», «lo frenado» son artículo y nominalización, no pronombre.
 * «SU carga», «ESTE ÚLTIMO», «LA SEGUNDA», «AMBAS», «LOS DOS» y el sujeto elidido («Margina 21.5%») se resuelven con el referente:
 * el posesivo y el elidido, con la última entidad nombrada antes (la cláusula anterior de la misma oración, o las oraciones previas
 * del párrafo saltando las que tampoco nombran a nadie — el elidido sostenido); «la primera / la segunda / el primero…», contra la
 * última lista coordinada del párrafo; «este último», contra la última entidad nombrada; «ambas / los dos / las dos / los tres»,
 * contra la lista entera (un grupo: la cifra tiene que ser de TODAS). */
const _PRONOMBRE_OBJETO = /(?:^|[^\p{L}])(?:lo|la|le|los|las)\s+(?:super|gan|igual|sigu|aventaj|dobl|duplic|alcanz|empat|rebas|adelant|desplaz|pas|encabez|supera)[a-z]*(?=[^\p{L}]|$)/u;
const _VERBO_STEMS = "tien|deb|est[aá]n?|son|es|sum|recuper|llev|concentr|dej|vend|crec|cae|cay|acumul|pes|compart|coincid|margin|pag|arrastr|qued|carg|rot|cubr|supera|gan|pierd|sub|baj|retroced|avanz|factur|aport|mantien|registr|muestr|present|alcanz|lleg|inmoviliz|cobr|abon|adeud|ocup|encabez|lider|mueve|mov|va|van|sigue|siguen|empat|cierr|abre|aparec|figur|entra|entran|debe|deben|tarda|tardan|recib|repres";
/* …y el PRONOMBRE SUJETO «ella / ellas / ellos» seguido de un verbo («Falabella es la cuenta más grande. Ella vende $17.8M»): la misma anáfora que el
 * posesivo, resuelta con el antecedente (owner 2026-09-14). «él» queda fuera a propósito: sin tilde (el texto se normaliza) es el artículo. */
const _ANAFORA_POSESIVA = new RegExp("(?:^|[^\\p{L}])(?:su|sus)\\s+\\p{L}|(?:^|[^\\p{L}])(?:es[ea]|est[ea]|dich[oa]|aquel(?:la)?|el\\s+mismo|la\\s+misma)\\s+(?:cliente|cuenta|sku|producto|articulo|item|bodega|marca|familia|canal)(?=[^\\p{L}]|$)|(?:^|[^\\p{L}])(?:ella|ellas|ellos)\\s+(?:tambien\\s+|solo\\s+|ya\\s+|no\\s+|apenas\\s+)?(?:" + _VERBO_STEMS + ")[a-z]*(?![\\p{L}])", "u");
/* «la segunda CARGA más alta», «las dos ROTACIONES más bajas»: varios temas verbales son también sustantivos de métrica (carga, rotación,
 * cobranza, recuperación, pago, aporte), y seguidos de «más/menos + adjetivo de magnitud» son el sustantivo de un superlativo, no el
 * verbo de un sujeto anafórico — medido en el conjunto adversarial (fp-prosa P-parrafo: «Sodimac … y la segunda carga más alta (5.4%)»
 * leía «la segunda» como ordinal sin lista y condenaba la cifra). «la segunda debe más vencido» sigue siendo anáfora: «vencido» no es
 * un adjetivo de magnitud. */
const _NO_COMPARATIVO_ADJETIVAL = "(?!\\s+(?:mas|menos)\\s+(?:alt|baj|grand|chic|pequen|larg|cort|fuert|debil|delgad|grues|elevad|reducid|pesad|liger|rapid|lent|car[ao]|barat|sever|urgent|grav|lejan|cercan|tard|tempran|profund|ampli|estrech|anch|extens|brev)[a-z]*(?![\\p{L}]))";
const _ANAFORA_ORDINAL = new RegExp("(?:^|[^\\p{L}])(?:el|la|los|las)\\s+(primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|ultim[oa])(?=\\s*(?:[,;:—–.)]|$)|\\s+(?:tambien\\s+|solo\\s+|ya\\s+|no\\s+|apenas\\s+)?(?:" + _VERBO_STEMS + ")[a-z]*(?![\\p{L}])" + _NO_COMPARATIVO_ADJETIVAL + ")", "u");
const _ANAFORA_ULTIMO = /(?:^|[^\p{L}])(?:est[ea]|aquel(?:la)?)\s+ultim[oa](?=[^\p{L}]|$)/u;
const _ANAFORA_RESTO = /(?:^|[^\p{L}])(?:l[oa]s\s+dem[aá]s|l[oa]s\s+otr[oa]s|el\s+resto)(?=[^\p{L}]|$)/u;   // «las demás con vencido están en 8 días»: el complemento de la lista
const _ANAFORA_GRUPO = new RegExp("(?:^|[^\\p{L}])(?:amb[oa]s|(?:los|las)\\s+(?:dos|tres|cuatro|cinco)(?=\\s*(?:[,;:—–]|$)|\\s+(?:tien|deb|est[aá]n|son|sum|recuper|llev|concentr|dej|vend|crec|cae|acumul|pes|compart|coincid|margin|pag|arrastr|qued|carg|rot|cubr)[a-z]*(?![\\p{L}])" + _NO_COMPARATIVO_ADJETIVAL + "))(?=[^\\p{L}]|$)", "u");
const _ORDINAL_IDX = { primer: 0, primero: 0, primera: 0, segundo: 1, segunda: 1, tercer: 2, tercero: 2, tercera: 2, cuarto: 3, cuarta: 3, quinto: 4, quinta: 4 };
/* el sujeto ELIDIDO: la cláusula arranca con un VERBO (o con un adverbio y luego el verbo), sin sustantivo ni nombre delante de la
 * posición («Margina 21.5%», «Debe $4.6M vencidos», «Y aun así vende menos que Falabella», «Tiene el peor margen (21.5%)»). Los
 * verbos son los de la prosa de la casa —una lista, como el vocabulario de métricas—: una cláusula que arranca con un artículo o
 * un sustantivo («La carga más alta es 5.5%») NO es un elidido, es una cifra suelta, y se sigue tratando como tal. */
const _ELIDIDO = /^[\s*_«"'¿¡]*(?:(?:y|pero|aunque|ademas|tambien|aun asi|asi|hoy|ya|solo|apenas|sin embargo|en cambio|por eso|no|ni|tampoco|ahi|alli|ademas)\s*,?\s+|(?:en|con|por|para|desde|entre|sobre|ante)\s+(?:\p{L}+\s*){0,3},\s*){0,3}(?:tien|deb|margin|vend|llev|recuper|acumul|concentr|dej|crec|cae|cay|pag|arrastr|sum|pierd|gan|qued|(?:es|son|era|fue)(?=\s)|sub|baj|retroced|avanz|cierr|factur|aport|pes|super|sigu|mantien|registr|muestr|present|alcanz|lleg|inmoviliz|rot|carg|cobr|abon|adeud|rind|gener|produc|muev|represent|ocup|encabez|lider|mov|cubr|mejor|empeor|reduc|aument|se\s+\p{L}+)[a-z]*(?=[^\p{L}]|$)/u;
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
/* (g) la COMPARADA explícita («supera a Falabella», «peor que Falabella», «el caso opuesto a Lider»), (h) el PRONOMBRE DE OBJETO
 *     («Falabella lo supera») y la ANÁFORA del sujeto (posesivo · ordinal · «este último» · grupo · elidido), más el ANTECEDENTE
 *     (la última entidad nombrada antes, saltando oraciones sin nadie) y la LISTA PREVIA (la última coordinada del párrafo) —
 *     owner 2026-09-14, atribución y significado: con esto el par «x contra y» se lee como (sujeto, comparada/objeto) y el
 *     posesivo sin antecedente se juzga como cifra sin dueño. */
export function leerClausula(texto, pos, { nombres = [], nombresRe = null } = {}) {
  const t = String(texto == null ? "" : texto);
  const p = Math.max(0, Math.min(Number(pos) || 0, t.length));
  /* DOS PLANOS DE LA MISMA LONGITUD: el enmascarado (dígitos → «#») decide los cortes —el punto decimal no es fin de oración—;
   * el normalizado SIN enmascarar es donde se buscan los nombres, porque un nombre puede llevar dígitos («LG-DRYER8KG»,
   * medido: con la máscara, «lg-dryer#kg» no casaba con su regex y el sujeto de «$14K» salía vacío). */
  /* el ÉNFASIS de markdown no es texto: «**SAM-REF500L** y **LG-WASH11KG** … ($2.4M y $2.9M)» (final vivo del cruce) es la misma
   * coordinación que sin negritas — los asteriscos pasan a espacio (misma longitud) y el puente «y» vuelve a unir los dos nombres */
  const Nn = normalizar(t).replace(/\*/g, " ");
  const M = enmascararNumeros(Nn).replace(/(?<![\p{L}])vs\.(?=\s)/gu, "vs ");   // «+7.5% vs. año anterior»: la abreviatura no cierra la cláusula
  const parentesis = _parentesis(M);
  const pares = [...parentesis, ..._rayasPareadas(_blanquear(M, parentesis))].sort((u, v) => u[0] - v[0]);   // paréntesis + incisos entre rayas
  const res = Array.isArray(nombresRe) ? nombresRe : compilarNombres(nombres);
  const dentro = pares.filter(([a, b]) => a < p && p < b).sort((x, y) => (x[1] - x[0]) - (y[1] - y[0]))[0] || null;
  /* ── UN PARÉNTESIS DENTRO DE UN INCISO (owner 2026-09-14, atribución y significado) ─────────────────────────────────────────
   * «Los cinco SKU que más contribuyen —PHI-SHAVER9 ($3.4M), LG-WASH11KG ($2.9M)…—: ninguno tiene capital frenado»: la cifra vive en
   * un paréntesis que vive en un inciso entre rayas. Blanqueando TODOS los incisos, el nivel superior perdía «PHI-SHAVER9» y el sujeto
   * de «$3.4M» salía vacío (la unión de significados del turno la condenaba). Los incisos que CONTIENEN la posición son su propio
   * texto: se blanquean solo los que la dejan fuera y el más interno (el que se lee aparte como `dentro`); la raya que abre el inciso
   * sigue cortando la cláusula, así el contenedor del paréntesis es «PHI-SHAVER9 » y no la oración entera. */
  const paresAjenos = pares.filter((pr) => pr === dentro || !(pr[0] < p && p < pr[1]));
  const plano = _blanquear(M, paresAjenos);                 // el nivel superior para CORTAR, visto desde la posición
  const planoN = _blanquear(Nn, paresAjenos);               // el nivel superior para NOMBRAR, visto desde la posición
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
  /* la comparada, y la coordinada CON «y» a una comparada («que Lider y Sodimac», «a diferencia de Lider y Falabella»), no son sujeto;
   * la coma sola no coordina acá: en «Frente a Falabella, Lider recupera menos» Lider es el sujeto */
  const _sinComparadas = (texto_, ents) => {
    const comp = new Set();
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i], prev = ents[i - 1];
      if (_esComparada(texto_, e.pos) || (prev && comp.has(prev.nombre) && _PUENTE_CIERRA.test(texto_.slice(prev.pos + prev.nombre.length, e.pos)))) comp.add(e.nombre);
    }
    return ents.filter((e) => !comp.has(e.nombre));
  };
  const propias = _sinComparadas(textoSujeto, entidadesEn(textoSujeto, tramoSujeto[0], tramoSujeto[1]));
  let sujeto = propias.length ? { nombre: propias[propias.length - 1].nombre, pos: (dentro ? interiorBase : 0) + propias[propias.length - 1].pos } : null;
  const sujetoPropio = !!sujeto;
  if (!sujeto) {
    const hasta = dentro ? dentro[0] : clausula.ini;
    const previas = _sinComparadas(planoN, entidadesEn(planoN, oIni, Math.max(oIni, hasta)));
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
  /* (c) el referente: hacia atrás en el párrafo, saltando las oraciones que no nombran a nadie (el sujeto elidido sostenido:
   * «Lider concentra el riesgo. Tiene el peor margen (21.5%). Tiene el mayor vencido ($4.6M). Lleva 269 días de atraso. Y aun así
   * vende menos que Falabella ($17.8M contra $19.4M)» — cuatro oraciones después, el sujeto sigue siendo Lider). Tope: seis
   * oraciones. `referente` excluye a las entidades de la oración actual (es el OTRO, para un pronombre de objeto);
   * `antecedente` es la última entidad nombrada antes, esté o no en la oración actual (para el posesivo y el elidido). */
  let referente = null, antecedente = null, listaPrevia = null;
  const oracionesPrevias = [];
  {
    const parIni = Math.max(0, t.lastIndexOf("\n\n", Math.max(0, oIni - 1)));
    const actuales = new Set(entidadesEn(planoN, oIni, oFin).map((e) => e.nombre));
    let cursor = parIni;
    const g = new RegExp(_FIN_ORACION.source, "gu");
    g.lastIndex = parIni;
    let m;
    while ((m = g.exec(plano)) && m.index < oIni) { oracionesPrevias.push([cursor, m.index]); cursor = m.index + m[0].length; if (!m[0].length) g.lastIndex++; }
    const conLetras = oracionesPrevias.filter(([a, b]) => /\p{L}/u.test(plano.slice(a, b)));
    let saltadas = 0;
    for (const [ini, fin] of conLetras.slice(-6).reverse()) {
      const ents = entidadesEn(planoN, ini, fin);
      if (!ents.length) { saltadas++; continue; }
      if (!antecedente) antecedente = { nombre: ents[ents.length - 1].nombre, pos: ents[ents.length - 1].pos, nombrados: ents.map((e) => e.nombre), oracion: { ini, fin }, saltadas };
      const cand = ents.filter((e) => !actuales.has(e.nombre));
      if (cand.length && !referente) referente = { nombre: cand[cand.length - 1].nombre, pos: cand[cand.length - 1].pos, candidatos: cand.map((e) => e.nombre), nombrados: ents.map((e) => e.nombre), oracion: { ini, fin }, saltadas };
      if (antecedente && referente) break;
      /* la oración previa solo nombra a los de la actual: el antecedente ya está, pero el OTRO (el referente de un pronombre de objeto)
       * puede estar más atrás — se sigue buscando hasta el tope */
    }
    /* la última LISTA coordinada (dos o más nombres) del párrafo antes de la posición — dentro de la oración actual también:
     * «Falabella y Lider: la primera vende más ($19.4M contra $17.8M), la segunda debe más vencido ($4.6M contra $2.5M)» */
    const listas = listasCoordinadas(Nn.slice(parIni, anclaSup), res).filter((l) => l.nombres.length >= 2);   // con los paréntesis: «(Falabella, Lider, Jumbo)» es la lista del sujeto
    if (listas.length) { const l = listas[listas.length - 1]; listaPrevia = { nombres: l.nombres, ini: parIni + l.ini, fin: parIni + l.fin, cerrada: l.cerrada }; }
  }
  /* (g) la comparada EXPLÍCITA de la cláusula (o del contenedor, para un paréntesis): la última entidad que va tras un conector de
   * comparación antes de la posición («Lider supera a Falabella…», «peor que Falabella», «frente a Lider», «el caso opuesto a Lider») */
  let comparada = null;
  {
    const desde = dentro ? (contenedor ? contenedor.ini : oIni) : clausula.ini, hasta = dentro ? dentro[0] : p;
    const comps = entidadesEn(planoN, desde, Math.max(desde, hasta)).filter((e) => _esComparada(planoN, e.pos) || /(?:^|[^\p{L}])(?:supera(?:n)?|gana(?:n)?|aventaja(?:n)?|iguala(?:n)?|rebasa(?:n)?|desplaza(?:n)?|adelanta(?:n)?)\s+a\s+(?:(?:el|la|los|las)\s+)?$/iu.test(planoN.slice(Math.max(0, e.pos - 30), e.pos)));
    if (comps.length) comparada = { nombre: comps[comps.length - 1].nombre, pos: comps[comps.length - 1].pos };
  }
  /* (h) el pronombre de objeto y las anáforas del sujeto, leídos en la cabeza de la cláusula (para un paréntesis, en el contenedor) */
  /* el prefijo de la oración hasta la posición (paréntesis en blanco): las anáforas y el elidido se leen ahí, porque el sujeto elidido o el
   * pronombre pueden vivir en la cláusula anterior de la misma oración («Es más grave que Falabella en los dos frentes: 8.6 pp de brecha») */
  const cabezaN = dentro ? planoN.slice(oIni, dentro[0]) + " " + cabeza : planoN.slice(oIni, p);
  const _propiasPrefijo = _sinComparadas(planoN, entidadesEn(planoN, oIni, dentro ? dentro[0] : p));
  const _mPron = _PRONOMBRE_OBJETO.exec(cabezaN);
  const pronombreObjeto = !!_mPron;
  const objetoPrimero = !!_mPron && /\bsigu/u.test(_mPron[0]);   // «Falabella LA SIGUE (8.6 pp contra 8.1 pp)»: el par es (objeto, sujeto)
  let anafora = null;
  {
    let mo = null;
    for (const mm of cabezaN.matchAll(new RegExp(_ANAFORA_ORDINAL.source, "gu"))) mo = mm;   // el último ordinal antes de la posición
    if (_ANAFORA_RESTO.test(cabezaN)) anafora = { tipo: "resto" };
    else if (_ANAFORA_GRUPO.test(cabezaN)) anafora = { tipo: "grupo" };
    else if (_ANAFORA_ULTIMO.test(cabezaN)) anafora = { tipo: "ultimo" };
    else if (mo && mo[1] in _ORDINAL_IDX) anafora = { tipo: "ordinal", indice: _ORDINAL_IDX[mo[1]] };
    else if (mo && /^ultim/.test(mo[1])) anafora = { tipo: "ultimo" };
    else if (_ANAFORA_POSESIVA.test(cabezaN)) anafora = { tipo: "posesivo", plural: /(?:^|[^\p{L}])sus\s/u.test(cabezaN) };
    else if (!_propiasPrefijo.length && (_ELIDIDO.test(cabezaN.replace(/^\s+/, "")) || (!dentro && _ELIDIDO.test(cabeza)) || (dentro && contenedor && _ELIDIDO.test(contenedor.texto)))) anafora = { tipo: "elidido" };
  }
  /* (e) la negación, dentro de la cláusula */
  const negada = _negada(cabeza);
  const determinante = _DETERMINANTE.test(cabeza);
  return { oracion: { ini: oIni, fin: oFin }, clausula, enParentesis: !!dentro, apertura: dentro ? dentro[0] : -1, contenedor, rotulo, primerToken, sujeto, sujetoPropio, coordinadas, listaCerrada, referente, antecedente, listaPrevia, comparada, pronombreObjeto, objetoPrimero, anafora, negada, determinante, plano: planoN };
}

/** ¿la posición está bajo negación dentro de su cláusula? (ver (e)) */
export function bajoNegacion(texto, pos) { return leerClausula(texto, pos).negada; }
/** ¿el sustantivo en `pos` lleva determinante delante, dentro de su cláusula? («la carga baja» verbo · «carga baja» adjetivo) */
export function conDeterminante(texto, pos) { return leerClausula(texto, pos).determinante; }
