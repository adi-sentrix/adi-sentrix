import { catalogoAgente } from "./catalogoAgente.js";   // R8 · los identificadores internos jamás van a pantalla (lazy: nada se deriva al importarse)
import { atributoMalAsociado, relacionEnPalabrasNoCierra } from "./atributosYRelaciones.js";   // el atributo (bodega/marca/familia/canal) y la relación dicha en palabras, contra el dato (owner 2026-09-14)
import { esEncargoCompuesto, partesDelEncargo, coberturaDelEncargo, dominiosDelEncargo } from "./partesDelEncargo.js";
import { leerClausula, compilarNombres } from "../oracle/lectorDeClausula.js";   // el sujeto, la cláusula y el referente se leen por estructura, no por cercanía (owner 2026-09-14)
import { metricasEn } from "../oracle/guardC.js";   // el vocabulario de métricas del muro: el continente dicho en palabras («Del vencido total, …») se resuelve con las mismas claves (owner 2026-09-14, universos)
import { reconcilian } from "../../config/contract/figureType.js";   // dos totales de universos que no reconcilian no se contienen (owner 2026-09-14, universos)
import { prioridadIntegradaCambiada, criterioDeLaPregunta, coincidenciaComoRazon } from "./prioridadIntegrada.js";   // la prioridad: el criterio del usuario manda; sin criterio, la ejecutiva con el criterio declarado (owner 2026-09-14)   // las partes de un encargo, por dominio: el ensamblador compone la misma lista que acá se cobra (owner 2026-09-14)
export { esEncargoCompuesto };   // re-exportado sin cambiar: registro.js y el ensamblador lo toman de acá
/* === src/adi/agente/contratoAgente.js · LA LETRA DEL CONTRATO Y SU VETO MECÁNICO (F3 · owner 2026-08-30) =====
 *
 * DOS PIEZAS, deliberadamente juntas (la letra y su candado se leen en la misma página):
 *
 *   1 · LA LETRA — los PRINCIPIOS del agente en estilo Code: frases cortas, imperativas, cero prosa. El owner
 *       pidió el arco como PRINCIPIO (no como plantilla) y una sección de FORMA con el mismo estilo. La
 *       invariante nueva va acá con su palabra textual: «ese qué hacer debe ser SUGERENCIAS para que no se
 *       malinterprete, las decisiones son del usuario y él debe evaluarlas».
 *
 *   2 · EL VETO — `vetosDeContrato(texto)`: chequeos MECÁNICOS (el juez no opina: compara — la regla del
 *       notario, aplicada a un juez NUEVO que vive FUERA de guardC: el notario no se toca, este juez se le
 *       SUMA en el bucle). Pocas reglas, calibradas contra el corpus de exámenes (cero gasto): un veto que
 *       dispara sobre textos ya aceptados es un falso positivo, y se afina ANTES de gastar una llamada.
 *
 * PURO · determinístico · sin red. La letra es BYTE-ESTABLE (prefijo cacheable del proveedor). */

/* ── LA LETRA · principios estilo Code (F3) ─────────────────────────────────────────────────────────────────── */
export const PRINCIPIOS_ARCO = [
  "Qué pasa → por qué y dónde → qué se puede hacer. En ese orden, y solo hasta donde la pregunta lo pide.",
  "El «qué hacer» se OFRECE con su cifra — jamás se ordena. Las decisiones son del usuario y él debe evaluarlas.",
  "El cierre ENTREGA la decisión («si quieres, lo vemos por X»), nunca la da por tomada («procede con X»).",
].map((s) => `- ${s}`).join("\n");

export const PRINCIPIOS_FORMA = [
  "Conclusión primero; el detalle después.",
  "Frases cortas. Cero relleno.",
  "Cada cifra con su dueño y su período.",
  "Tabla solo cuando piden lista o comparación de varios; si no, prosa.",
  "El nombre del usuario se respeta si lo declaró; el REGISTRO no se negocia — formal siempre, lo llamen como lo llamen.",
].map((s) => `- ${s}`).join("\n");

/* ── [9] DEL EXAMEN 1 (2026-08-31) · RUTEO Y CÁLCULO — los tres desvíos medidos, cerrados en la letra ──────────
 * T21 mapeó «proyecta +4%» a executiveSummary y perdió la proyección $103.9M/+$4.0M que el natural ganó con
 * etiqueta · T23 recibió «corrígelo antes de calcular» (cálculo PRE-AUTORIZADO) y frenó con otra pregunta —
 * el natural corrigió Y calculó $744K · T22 ofreció un cruce cliente×bodega que el dato no sostiene. */
export const PRINCIPIOS_RUTEO = [
  "Una proyección pedida («proyecta +4%», «qué pasa si sube X») va por las herramientas de simulación — jamás por el resumen ejecutivo.",
  "Si el usuario pre-autoriza el cálculo bajo un supuesto declarado («corrígelo antes de calcular»), ejecuta el cálculo ETIQUETADO con la interpretación declarada y ofrece el recálculo alternativo — no frenes con otra pregunta.",
  "El menú de una aclaración solo ofrece cortes que el dato sostiene — una opción incumplible es una promesa falsa.",
  // P1 de la corrida 4 (owner, textual): «Si digo "mi venta" con un supuesto de crecimiento/proyección, toma
  // por defecto la venta total del negocio, salvo que el contexto indique otra entidad».
  "«Mi venta» con un supuesto de crecimiento o proyección es la venta TOTAL del negocio: ese es el default y no se pregunta. Solo si el contexto nombra otra entidad, esa manda.",
  "Al aclarar una ambigüedad, plantéala en palabras o con una cifra verificada — nunca con un ejemplo numérico inventado sobre una entidad real.",
].map((s) => `- ${s}`).join("\n");

/* ── EL VETO MECÁNICO · vetosDeContrato(texto) → [{ regla, multa }] ─────────────────────────────────────────────
 * REGLAS POCAS Y CIEGAS. Cada una con su carnada en el gate y su pasada de calibración contra los exámenes.
 * Lo que NO se veta, a propósito: el condicional de oferta («Renegociaría primero…», «Profundizaría por…»)
 * y la pregunta de cierre («¿Arrancamos por ahí?») — esa ES la forma correcta de sugerir. */

// El cierre que ORDENA: el último párrafo arranca con un imperativo de ejecución dirigido al usuario.
// Verbos acotados a ejecución de negocio (no se vetan «mira», «considera», «recuerda» — ofrecen, no ordenan).
/* ⚠️ EL FIN DE PALABRA, CUANDO LA PALABRA TERMINA EN VOCAL ACENTUADA (cazado 2026-08-31 al calibrar el registro
 * coloquial). En JavaScript `\b` se define sobre `\w` = [A-Za-z0-9_]: entre «á» y un espacio NO hay frontera,
 * así que un patrón que termina en `[aá]\b` no matchea la forma acentuada. Medido sobre este mismo juez:
 * «Ejecutá la baja de carga», «Renegociá la carga de Falabella», «Liquidá los SKU frenados» e «Implementá el
 * ajuste» pasaban SIN MULTA — el cierre imperativo que el owner blindó estaba ciego justo en las formas
 * rioplatenses, que son las que este usuario ve. `_FIN` es el fin de palabra que sí cuenta las vocales
 * acentuadas y la ñ; va en todo patrón que pueda terminar en una. */
const _FIN = "(?![a-záéíóúüñ])";
/* ── LA ORDEN AL EQUIPO (batería en vivo de la Etapa 4, T4 — owner 2026-09-11) ─────────────────────────────
 * «Explícamelo para el equipo comercial» → el cerebro cerró con «Arranquen por Falabella.»: la misma orden de
 * siempre, en PLURAL y dirigida a la gente del dueño — que es justo la forma que sale cuando la respuesta es
 * para un equipo, y el molde de ese lector dice «sin órdenes». La ley no cambia («ADI asesora, no gestiona»);
 * estaba ciega a la segunda persona del plural y a la familia «arranca / empieza / partí por», que ordena por
 * dónde entrar. Las conversacionales («díganme», «cuéntenme») siguen fuera; «arrancamos por ahí?» es pregunta. */
const _ORDEN_AL_EQUIPO = "arranquen|empiecen|partan|prioricen|renegocien|ejecuten|implementen|liquiden|apliquen|lancen|corten|convoquen|exijan|llamen a|hablen con|si[eé]ntense con|suban (?:el|los|la|las)|bajen (?:el|los|la|las)";
const _IMPERATIVO_EJECUCION = new RegExp(`^(procede|proced[eé]|ejecut[aá]|implement[aá]|renegoci[aá]|liquid[aá]|aplic[aá]|lanz[aá]|corta|cort[aá]|sub[ií] (el|los|la|las)|baj[aá] (el|los|la|las)|arranc[aá] por|empez[aá] por|empieza por|part[ií] por|${_ORDEN_AL_EQUIPO})${_FIN}`, "i");
// La decisión dada por tomada, en cualquier parte del texto — la carnada NOMBRADA por el owner.
/* ── EL IMPERATIVO EN CUALQUIER PARTE DE LA PROSA (owner 2026-09-10) ────────────────────────────────────────
 * «siéntate con Falabella y revisa sus acciones» salió en pantalla A MITAD de un párrafo — y la regla del
 * cierre no lo veía porque solo juzga el último. La ley es la de siempre («ofrece, no ordena»; ADI asesora,
 * no gestiona) aplicada a toda la prosa. Dos cuidados, los dos ya pagados en esta casa: el verbo se ANCLA al
 * arranque de la cláusula (imperativo y tercera persona se escriben igual — «la lista CORTA» no ordena
 * cortar), y los imperativos CONVERSACIONALES quedan fuera: «dime», «cuéntame», «avísame» son la manera
 * normal de pedirle contexto al dueño. Se vetan los de EJECUCIÓN de negocio. */
const _PROSA_IMPERATIVA = /(?:^|[.;:—]\s*|\by\s+)(?:si[eé]ntate|sentate|renegoci[aá]|ejecut[aá]|implement[aá]|liquid[aá]|aplic[aá]|lanz[aá]|proced[eé]|convoc[aá]|exig[ií]|llam[aá] a|habl[aá] con)(?![\wáéíóúñ]*r\b)/im;
/* …y la misma regla en plural, anclada igual (regex aparte para que la carnada del gate siga vaciando la literal) */
const _PROSA_ORDEN_AL_EQUIPO = new RegExp(`(?:^|[.;:—]\\s*|\\by\\s+)(?:${_ORDEN_AL_EQUIPO})${_FIN}`, "im");

const _DECISION_TOMADA = /\b(procede con|proced[eé] con|avanz[aá] con la ejecuci[oó]n|queda decidido|ya est[aá] decidido|debes ejecutar|ten[eé]s que ejecutar)\b/i;

/* ── LA INTENCIÓN NO SE LEE EN EL DATO (owner 2026-09-10, revisando su prueba de continuidad) ───────────────
 * SU FRASE, textual: «el dato puede no respaldar esa hipótesis, pero no debería inferir intención gerencial».
 * LO QUE SALIÓ EN SU PANTALLA: «Volumen a margen bajo como apuesta deliberada — descartado por el dato».
 * El defecto es fino y por eso hay que nombrarlo bien: el dato SÍ puede descartar un patrón (que la carga
 * esté dentro del nivel, que el margen bajo venga de precio y no de rebate). Lo que NO puede es dictaminar si
 * alguien lo hizo A PROPÓSITO. «Deliberada» describe una cabeza, no una fila; una planilla no ve intenciones,
 * y presentarla como algo que el dato confirma o descarta le da al dueño una conclusión sobre su propia
 * gente con cara de medición.
 * ⚠️ Y NO VETA PREGUNTAR POR LA INTENCIÓN, que es justo el método del porqué de la casa (medir · marcar la
 * hipótesis · preguntarle al dueño): «¿es una apuesta tuya de rotación o se les fue de las manos?» es la
 * pregunta correcta y sale limpia. Tampoco veta el condicional que razona («si fuera estrategia de rotación,
 * esperaría…») ni declarar el límite («el dato no dice si fue deliberado»), que es exactamente lo que se
 * quiere. Se veta el DICTAMEN: la intención afirmada, confirmada o descartada como hallazgo.
 * Misma disciplina que el cerrojo anti-causa-inventada: la regla que muerde prosa buena se termina apagando. */
const _INTENCION = "(?:deliberad[ao]s?|intencional(?:es)?|a prop[oó]sito|adrede|premeditad[ao]s?|consciente(?:s)?|apuesta deliberada)";
const _DICTAMEN = "(?:descartad[ao]s?|descarta|confirmad[ao]s?|confirma|probad[ao]s?|demostrad[ao]s?|queda claro|es evidente)";
/* la cláusula donde vive la palabra: se corta por puntuación fuerte y salto de línea, que es el alcance real
 * de una afirmación en prosa. Sin acotar, un «?» tres oraciones después absolvía un dictamen. */
const _CLAUSULA_DE = (texto, idx) => {
  const desde = Math.max(0, texto.lastIndexOf("\n", idx) + 1);
  const ini = Math.max(desde, ...[".", ";", "!", "?"].map((p) => texto.lastIndexOf(p, idx) + 1));
  const finRel = texto.slice(idx).search(/[.;!?\n]/);
  return texto.slice(ini, finRel < 0 ? texto.length : idx + finRel + 1);
};
/* las formas que ABSUELVEN, porque son las que la casa quiere: preguntar, condicionar y declarar el límite */
/* las absoluciones, con las formas de la CASA («Lo que el dato no sabe: si ese volumen … fue una decisión tuya» es el
 * límite declarado del corpus objetivo del owner — se lee entero: «el dato no sabe» y «si ese/esa/eso…») */
/* + LA PREGUNTA ABIERTA DEL MODELO (prompt de gerente, 2026-09-13 — mismo falso positivo en dos corridas): «Queda
 * abierto si el volumen en Falabella y Jumbo es una apuesta deliberada de rotación o una fuga que se dejó crecer;
 * esa respuesta la tiene el negocio, no el dato» ardía por «es una apuesta deliberada»: la subordinada arranca en
 * «si el volumen» (no en «si eso/ese») y «queda abierto» no estaba en la lista. Es la conducta correcta, verbatim:
 * el límite declarado y la pregunta devuelta al dueño. Entran «si el/la/los/las/un/una…», «queda/sigue/está
 * abierto», «no está cerrado» y «esa respuesta la tiene el negocio/dueño». */
const _PREGUNTA_O_LIMITE = /\?|\bsi (?:fuera|fuese|es|era|fue|resulta|hubiera|hubiese|viene|ese|esa|eso|este|esta|esto|el|la|los|las|un|una)\b|\bsuponiendo\b|\bno (?:puedo|podr[ií]a) (?:saber|afirmar|decir|confirmar)\b|\bno me consta\b|\bel dato no (?:lo |la )?(?:dice|declara|trae|mide|ve|sabe|registra|distingue|separa|puede)\b|\bno s[eé] si\b|\beso no est[aá] en el dato\b|\bdependiendo de\b|\bpuede ser\b|\bpodr[ií]a ser\b|\b(?:queda|sigue|est[aá]) abiert[oa]\b|\bno est[aá] cerrad[oa]\b|\b(?:esa|esta|la) respuesta la tiene el (?:negocio|due[ñn]o)\b/i;
/* ⚠️ Y UNA CUARTA, que casi me cuesta un falso positivo en prosa que YA estaba bien: EL CONTRASTE. El composer
 * de margen escribe «separar qué parte de la carga fue deliberada y qué parte se descontroló» y «la carga
 * deliberada de la que no lo fue» — frases que dicen exactamente lo contrario de un dictamen: declaran que la
 * intención está SIN determinar y que justamente hay que distinguirla. Un patrón que solo mirara «fue
 * deliberada» las mataba, y habría apagado la regla entera el día que alguien se cansara de la multa. */
const _CONTRASTE = /\bqu[eé] parte\b|\bde la que no lo fue\b|\bde lo que no lo fue\b|\bde la que (?:se )?(?:escap|descontrol)|\bo (?:se )?(?:descontrol|escap)|\bo qu[eé] parte\b|\bdistinguir\b|\bseparar\b/i;
const _RE_INTENCION = new RegExp(_INTENCION, "gi");
/* ⚠️ EL SUSTANTIVO INTERMEDIO ES UNA LISTA CERRADA, y la calibración explicó por qué: «es una decisión
 * deliberada» tiene que arder y «es una lectura consciente de que faltan datos» NO —ahí «consciente» describe
 * a ADI, no una intención ajena—. Una palabra comodín entre el artículo y el adjetivo cazaba las dos. */
/* ⚠️ EL PLURAL SE ESCRIBE ENTERO, no con una «s» pegada: «decisión» hace «decisiones», no «decisions» — y con
 * el sufijo ingenuo «Son decisiones deliberadas, no descuidos» salía limpia. Es la prima hermana de la trampa
 * del plural que ya costó una métrica entera en el respaldo («Ventas» vs «Venta»). */
const _COSA_DECIDIDA = "(?:decisi[oó]n(?:es)?|pol[ií]ticas?|apuestas?|estrategias?|jugadas?|movidas?|elecci[oó]n(?:es)?|maniobras?)";
const _RE_DICTAMEN = new RegExp(`${_DICTAMEN}|\\b(?:es|fue|son|fueron|hay|hubo)\\s+(?:una?s?\\s+)?(?:${_COSA_DECIDIDA}\\s+)?(?:${_INTENCION})`, "i");
/* LA INTENCIÓN NEGADA TAMBIÉN ES DICTAMEN (batería en vivo de la Etapa 4, corrida 3 — 2026-09-11): «no es que
 * vendan barato por estrategia de volumen» salió limpia porque no lleva ninguna palabra de intención — pero negar
 * que fue estrategia es leer la misma cabeza que afirmarlo. Formas cerradas: «no es que … por estrategia/apuesta/
 * decisión» y «no es/fue una estrategia tuya · de volumen · comercial». «¿es una apuesta tuya?» sigue siendo
 * pregunta; «si es estrategia o fuga» sigue siendo condición. */
const _RE_INTENCION_NEGADA = new RegExp(`\\bno (?:es|fue|era) que [^.;:\\n]{0,50}?\\bpor (?:${_COSA_DECIDIDA})\\b|\\bno (?:es|fue|era|son|fueron) (?:una?s?\\s+)?(?:${_COSA_DECIDIDA})\\s+(?:tuya|suya|de volumen|comercial|de precio|de rotaci[oó]n)\\b`, "i");
/* LA INTENCIÓN NOMINAL (owner 2026-09-12, batería compuesta · «natural»): «es fuga, NO APUESTA de volumen» pasó
 * porque no lleva verbo ni adjetivo de intención — el sustantivo solo ya dictamina. Dos formas cerradas más, y
 * nada más: la contrastiva («…, no apuesta/estrategia/decisión…» tras coma, raya o dos puntos) y la nominal
 * afirmada con calificador («es una apuesta de volumen · tuya · comercial»). Siguen absueltas la pregunta, el
 * condicional, el límite declarado y el contraste, exactamente como antes. */
const _NOMBRE_INTENCION = "(?:apuestas?|estrategias?|decisi[oó]n(?:es)?|jugadas?|movidas?)";
const _CALIF_INTENCION = "(?:de volumen|tuya|suya|comercial|de precio|de rotaci[oó]n|deliberada|consciente|gerencial)";
const _RE_INTENCION_NOMINAL = new RegExp(`[,—:]\\s*no (?:una |la |las |unas )?${_NOMBRE_INTENCION}(?:\\s+${_CALIF_INTENCION})?(?![\\wáéíóúñ])|\\b(?:es|son|fue|fueron|era|eran)\\s+(?:una?s?\\s+)?${_NOMBRE_INTENCION}\\s+${_CALIF_INTENCION}(?![\\wáéíóúñ])`, "i");
function _intencionDictaminada(texto) {
  const t = String(texto || "");
  let m;
  _RE_INTENCION.lastIndex = 0;
  while ((m = _RE_INTENCION.exec(t)) !== null) {
    const cl = _CLAUSULA_DE(t, m.index);
    if (_PREGUNTA_O_LIMITE.test(cl) || _CONTRASTE.test(cl)) continue;   // preguntar, condicionar, declarar el límite o contrastar es lo correcto
    if (_RE_DICTAMEN.test(cl)) return m[0];             // afirmada, confirmada o descartada: eso es dictamen
  }
  for (const re of [_RE_INTENCION_NEGADA, _RE_INTENCION_NOMINAL]) {
    const n = re.exec(t);
    if (!n) continue;
    const cl = _CLAUSULA_DE(t, n.index);
    if (!_PREGUNTA_O_LIMITE.test(cl) && !_CONTRASTE.test(cl)) return n[0].trim();
  }
  return null;
}

/* ── R8 DEL EXAMEN 1 (2026-08-31) · EL LÉXICO DE SUPERFICIE, VETADO CIEGO ───────────────────────────────────────
 * Lo MEDIDO en pantalla: «escenario» (T25, replicado T26 — criterio BINARIO del examen: cero escenario, colapso
 * del eje) · «tensión» en 5 turnos (vocabulario interno que además coincide con un nombre de mundo) · «la
 * herramienta de histórico por entidad está bloqueada» (el instrumento expuesto, T9-T12/T19) · «tirarte la
 * cifra» (registro coloquial, T9/T19) · «precioLista/unidades … variableB» (el error de contrato de una tool,
 * VERBATIM en T2). El narrador natural ya prohíbe este léxico en su prompt; el cierre del agente necesita el
 * MISMO piso — y acá es un VETO del juez ciego, no una esperanza del prompt: multa → reparación → si reincide,
 * escalera. La palabra en un texto del USUARIO no pasa por acá (esto juzga SOLO la salida del agente). */
/* SE EXPORTA para que el barredor de RÓTULOS (`_registro_boleta_gate` [1c]) juzgue con ESTA misma regla y no con
 * una copia. La lección ya está escrita dos veces en este repo —tres listas de voseo incompletas, dos nombres para
 * la referencia de carga— y volvió a costar: `lexico-meta` multaba «meta»/«target» en la PROSA mientras el motor
 * publicaba el rótulo «Meta de carga comercial», que el cerebro puede citar textual. Una regla, un archivo. */
export const _LEXICO_SUPERFICIE = [
  { re: /\bescenarios?\b/i, regla: "lexico-escenario",
    multa: "«escenario» no existe en pantalla (colapso del eje): di «supuesto» para lo que el usuario plantea y «proyección» para lo que calculas sobre él." },
  /* ⚠️ «META» SOBRE EL BENCHMARK O LA CARGA (owner en producción, 2026-09-05: el cerebro re-fraseó «contra
   * una meta de 3.5%» dos veces — el piso determinístico estaba limpio, la palabra la puso la prosa viva).
   * La regla es VIEJA y dura: benchmark ≠ meta, «las metas las fija el cliente, no nosotros» (CLAUDE.md §4)
   * y la procedencia de agosto («no quiero que la referencia general parezca una meta del cliente»). El
   * barredor del registro barre NUESTROS composers; este cerrojo cubre la prosa del cerebro, que era el
   * agujero. La regla veta NUESTRA atribución, no las palabras del usuario: si ÉL nombró su meta en la
   * pregunta, citarla es legítimo (salvoSi sobre el hecho del turno, jamás sobre el texto juzgado). */
  /* la ventana de oración admite el punto DECIMAL («4.4%» cortaba `[^.\n]` y la regla no veía la frase del
   * owner — la misma trampa que guardC documenta con sus cifras enmascaradas): punto solo entre dígitos. */
  { re: /\b(?:meta|target)s?\b(?:[^.\n]|(?<=\d)\.(?=\d)){0,60}\b(?:benchmark|carga(?:\s+comercial)?|margen m[ií]nimo|rebate)|\b(?:benchmark|carga comercial|nivel de carga)\b(?:[^.\n]|(?<=\d)\.(?=\d)){0,60}\b(?:meta|target)s?\b/i,
    regla: "lexico-meta",
    salvoSi: (ctx) => /\bmetas?\b|\btargets?\b/i.test(String((ctx && ctx.pregunta) || "")),
    multa: "«meta»/«target» sobre el benchmark o la carga atribuye al cliente una meta que no fijó — las metas las fija el cliente, no nosotros. Di «benchmark declarado» o «tu nivel de carga comercial declarado»; «meta» solo citando la que el usuario nombró." },
  { re: /\btensi[oó]n\b/i, regla: "lexico-tension",
    multa: "«tensión» es vocabulario interno (y coincide con un nombre de mundo): en pantalla se dice «brecha contra el benchmark» o la palabra del dato que corresponda." },
  /* ⚠️ ACOTADO A USOS-INSTRUMENTO: en el pack de ferretería «Herramientas» es una FAMILIA del dato real —
   * vetar la palabra pelada haría que la reparación reescriba un nombre de entidad (la lección de
   * _sanitizeScenario). Se vetan el artículo singular («la/esta herramienta…») y los atributos internos
   * («herramienta bloqueada/interna/del sistema»); «la familia Herramientas» pasa limpia. */
  /* ⚠️ ESTA REGLA LE PROHIBÍA DECIR LA VERDAD (T5 de la certificación, 2026-09-01). El usuario pidió simular
   * «reducir 2 puntos porcentuales las acciones comerciales»; el motor NO tiene ese eje y lo declaró —
   * `coverage.supported: false · "no puedo simular esa combinación métrica/eje/supuesto"`. El cerebro declinó
   * honesto («no puedo simular esa combinación con la herramienta… el sistema no la traduce como un eje
   * único») y esta regla lo vetó dos veces, hasta tirar el turno a la escalera.
   *
   * La regla nació para otro caso y sigue haciendo falta ahí: cuando el límite es DEL DATO —el histórico no
   * reconcilia— culpar al instrumento es esconder el motivo real. Pero cuando el motor DECLARÓ que no soporta
   * lo pedido, el límite ES del instrumento, y prohibir nombrarlo obliga a inventar una excusa sobre el dato.
   *
   * EL CORTE NO SE HACE LEYENDO EL TEXTO —este juez es ciego a propósito— sino con un HECHO del turno:
   * `limiteDeHerramienta` lo pone el bucle cuando `motivosNoSoportado` trae algo, o sea cuando el motor mismo
   * dijo que no llega. Sin ese hecho, la regla se aplica igual que siempre. */
  { re: /\b(?:la|una|esa|esta|otra|cada|mi|tu) herramientas?\b|\bherramientas? (?:internas?|bloqueadas?|del sistema|de hist[oó]rico)\b/i, regla: "lexico-herramienta",
    salvoSi: (ctx) => ctx && ctx.limiteDeHerramienta === true,
    multa: "no expongas el instrumento: el límite se formula sobre el DATO («el histórico por entidad no reconcilia con la cifra oficial»), jamás sobre «la herramienta» ni su estado." },
  /* ⚠️ EL MAPA ES NUESTRO, NO SUYO (T6 de la certificación, 2026-09-01). Salió a pantalla: «El mapa declara:
   * "SERIES: mensual GLOBAL real (12 meses — herramienta trend). Por entidad: BLOQUEADA (histórico de muestra,
   * no reconcilia — se declina)."». El usuario no sabe qué es «el mapa»: es el documento de instrucción que
   * viaja en el system. Misma familia que `headlineSub` —jerga nuestra en la pantalla del usuario— pero otra
   * forma, así que `identificador-interno` no la ve: no hay camelCase, hay una CITA del instructivo.
   * El límite se dice con el dato («no hay serie mensual por cliente que reconcilie»), no leyendo el manual
   * en voz alta. Acotado a nombrar el mapa como fuente y a sus etiquetas de estado — no a la palabra suelta. */
  { re: /\bel mapa (?:declara|dice|indica|señala|marca)\b|\bseg[uú]n el mapa\b|\bmapa del dato\b|\bBLOQUEADA \(/i, regla: "cita-del-mapa",
    multa: "no cites el mapa: es el instructivo interno, no algo que el usuario pueda ver. Di el límite con las palabras del DATO («no hay serie mensual por cliente que reconcilie con la cifra oficial») y ofrece lo que sí está." },
  { re: /\btirar(?:te|me|les?|los?|las?)?\b|\btires?\b|\btiro\b/i, regla: "lexico-tirar",
    multa: "registro formal: «tirar» una cifra no — di «traerte», «entregarte» o «servirte» la cifra." },

  /* ── EL REGISTRO NO SE NEGOCIA POR PREFERENCIA DEL USUARIO (owner 2026-08-31) ────────────────────────────────
   * LO MEDIDO en la corrida 3, sobre lo VISIBLE (no sobre borradores): el apodo persistió, pero le arrastró el
   * registro a la conversación entera — «wachin, acá está lo que mueve aguja:» (T9) · «acá está:» (T11) ·
   * «acá está claro:» (T12) · «acá está, corregido:» (T15) · «acá está verificado:» (T18) · «acá está el
   * impacto…» (T23) · «acá está lo que mueve aguja sin tocar precio:» (T26). Siete turnos con la apertura y
   * dos con la muletilla, todos a PANTALLA.
   * LA PALABRA DEL OWNER: «no quiero que use esas cosas, que use el NOMBRE de usuario… ahora es ejecutivo».
   * EL NOMBRE ESTÁ EXENTO Y ES DELIBERADO: «wachin, la cartera promedia 25,1%…» pasa limpio — el trato no es
   * una fuga, el tono sí. Lo que se veta es la apertura de relleno y la muletilla, no a quién le habla.
   * La lista crece con lo que se MIDE en un examen, nunca con lo que se imagina: estas dos familias salen de
   * los nueve casos de arriba y no aparecen ni una vez en el corpus de exámenes del camino natural. */
  { re: new RegExp(`\\b(?:ac[aá]|aqu[ií])\\s+(?:est[aá]s?|van?|ten[eé]s|tienes|lo ten[eé]s|te (?:va|dejo|paso))${_FIN}`, "i"), regla: "registro-coloquial",
    multa: "apertura coloquial: «acá está…» no es registro ejecutivo. Abre con la conclusión y su cifra («la cartera promedia 25,1% contra un benchmark de 30,1%»). El nombre con el que te pidieron que trates al usuario SÍ va — lo que sobra es el relleno." },
  { re: /\bmueve\s+(?:la\s+)?aguja\b/i, regla: "registro-coloquial",
    multa: "muletilla coloquial: «lo que mueve aguja» no es registro ejecutivo. Di qué es, con su cifra («los tres clientes que concentran $4,3M de contribución no capturada»)." },
  /* ⚠️ DOS FUGAS VISTAS EN PANTALLA (owner 2026-09-10, prueba local que cayó al oráculo): la prosa viva dijo
   * «la cuenta del motor apunta a…» DOS veces —tripa del sistema hablándole al dueño— y «el mandato es
   * puntual» —lenguaje de ejecución: ADI asesora, no gestiona—. Van al lexicón COMPARTIDO: la ley es una
   * sola para los dos caminos. */
  { re: /\b(?:la )?cuenta del motor\b/i, regla: "lexico-cuenta-del-motor",
    multa: "«la cuenta del motor» es tripa del sistema: en pantalla se dice «lo medido» o «los números» — el dueño no tiene por qué saber que hay un motor." },
  { re: /\bmandatos?\b/i, regla: "lexico-mandato",
    multa: "«mandato» es lenguaje de ejecución y ADI asesora, no gestiona: se dice «lo que conviene llevarle» o «la propuesta» — la decisión es del usuario." },
  /* ── LA VOZ DE MOTOR (Etapa 3, owner 2026-09-11): «el mecanismo debe estar detrás; el criterio, delante».
   * Medido en los pisos determinísticos del propio producto: «el motor detecta $4.9M», «dónde lo localiza el
   * motor». Y las formas que el owner listó: «según el procedimiento», «la regla me dice». ADI no se describe
   * a sí mismo al decir una cifra: la dice. Se veta el MOTOR COMO SUJETO de un verbo de medición, y las
   * apelaciones a la regla o al procedimiento como autoridad — no la palabra «motor» suelta (un «motor de
   * crecimiento» es lenguaje de negocio). */
  /* «CAPITAL RECUPERABLE» POR CONTRIBUCIÓN (owner 2026-09-13): en esta casa «capital» es el inventario inmovilizado
   * (la cara Capital); lo que se recupera de la carga comercial es contribución o margen. El modelo escribió «$655K
   * … capital recuperable con renegociación»: dos mundos con una palabra. Solo cuando la frase habla de carga,
   * acciones comerciales, contribución o margen — «capital recuperable» sobre inventario sigue siendo legítimo. */
  { re: /\bcapital\s+recuperable\b(?=[^.;\n]{0,80}\b(?:carga|acciones comerciales|renegociaci[oó]n|contribuci[oó]n|margen)\b)|\b(?:carga|acciones comerciales|contribuci[oó]n|margen)\b[^.;\n]{0,80}\bcapital\s+recuperable\b|\brecuperar\s+capital\b(?=[^.;\n]{0,60}\b(?:carga|acciones comerciales|renegociaci[oó]n)\b)/i, regla: "lexico-capital-por-contribucion",
    multa: "llamas «capital» a lo que se recupera de la carga comercial: eso es CONTRIBUCIÓN (o margen). «Capital» en esta casa es el inventario inmovilizado. Di «contribución recuperable»." },
  /* ⚠️ el verbo de sistema es OBLIGATORIO (encargo en vivo, 2026-09-14): con el grupo opcional, «el motor de ventas está
   * sano» y «los tres motores del crecimiento» —metáforas normales de negocio— ardían como voz de sistema, y un borrador
   * correcto y completo cayó al respaldo. Regla del owner: «una metáfora normal de negocio como "motor de ventas" o
   * "motores del crecimiento" no debe tratarse como voz interna del sistema». Lo que sigue ardiendo: «el motor detecta»,
   * «que el motor…», «según el procedimiento/la regla/el motor», «la regla me dice». */
  { re: /\b(?:el|del|al) motor\s+(?:detecta|localiza|calcula|sella|marca|mide|usa|publica|dice|no (?:recomputa|publica))\b|\bque el motor\b(?!\s+de(?:l)?\s)|\bseg[uú]n (?:el|la) (?:procedimiento|regla|motor|playbook)\b|\bla regla (?:me )?dice\b|\bel procedimiento (?:me )?(?:dice|indica|manda)\b/i, regla: "lexico-voz-de-motor",
    multa: "hablas del motor, la regla o el procedimiento como si fueran quien responde («el motor detecta», «según el procedimiento»): el mecanismo va detrás y el criterio delante. Di la cifra y su lectura como asesor — «hay $X sin capturar», «lo que veo es…» — sin describirte a ti mismo." },
];
/* Los IDENTIFICADORES INTERNOS (nombres de tools y de campos de contrato) jamás van a pantalla — el catálogo es
 * la fuente (lazy y memoizado: nada se deriva al importarse) más los campos que el examen vio fugarse. Una tool
 * nueva entra al veto SOLA (la lista se construye del catálogo vivo, no de una copia). */
const _CAMPOS_INTERNOS = ["precioLista", "variableA", "variableB", "entityScope", "staleDays"];
let _reInternos = null;
function _internosRe() {
  if (_reInternos) return _reInternos;
  /* SOLO identificadores camelCase (una mayúscula después del primer carácter): un nombre de tool que es
   * palabra castellana corriente («calcular», «trend») no distingue jerga de prosa — vetarlo cazaba «Sí se
   * puede calcular» del corpus aceptado (calibración R8). Lo que se fuga reconocible es el camelCase:
   * inventoryStatus, precioLista, serieEntidad, variableB. */
  const nombres = [...new Set([...catalogoAgente().map((t) => t.name), ..._CAMPOS_INTERNOS])]
    .filter((n) => /[A-Z]/.test(n.slice(1)));
  _reInternos = new RegExp(`\\b(${nombres.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`);
  return _reInternos;
}

/* ⚠️ LA LISTA NO PUEDE ANTICIPAR EL CAMPO QUE TODAVÍA NO SE FUGÓ (medido en la certificación, 2026-09-01):
 * `headlineSub` salió a la pantalla del usuario y este juez no lo vio, porque miraba una lista cerrada —los
 * nombres de tools más cinco campos a mano— cuando la intención escrita arriba era otra: «lo que se fuga
 * reconocible es el camelCase». Otra vez la forma en lugar del concepto, esta vez en versión lista blanca.
 * Ahora se mide el camelCase DE VERDAD, y la lista queda como refuerzo para lo que no lo es.
 *
 * DOS MINÚSCULAS ANTES DE LA MAYÚSCULA, a propósito: deja fuera las marcas reales que empiezan con una letra
 * suelta —iPhone, eBay, iPad— que son nombres del mundo, no del motor. Calibrado contra el corpus completo de
 * exámenes: 77 respuestas a pantalla, un solo hallazgo (`headlineSub`, 4 veces) y cero falsos positivos;
 * iPhone · eBay · iPad · WhatsApp · PowerPoint · McKinsey · YoY pasan todos. Y una entidad del tenant nunca se
 * multa: si el negocio se llama así, es su nombre, no jerga nuestra. */
const _CAMELCASE = /\b([a-z]{2,}[a-z0-9]*[A-Z][A-Za-z0-9]*)\b/;
export function esIdentificadorInterno(palabra, entidades = []) {
  const p = String(palabra || "");
  if (!_CAMELCASE.test(p)) return false;
  return !entidades.some((e) => String(e || "").toLowerCase() === p.toLowerCase());
}

/* P1 DE LA CORRIDA 4 · «MI VENTA» CON SUPUESTO = LA VENTA TOTAL DEL NEGOCIO ─────────────────────────────────
 * Palabra del owner (textual): «Si digo "mi venta" con un supuesto de crecimiento/proyección, toma por defecto
 * la venta total del negocio, salvo que el contexto indique otra entidad». Medido en la corrida 4, dos turnos
 * verdes que no respondieron nada: T8 «ponele que el año que viene crezco 3%: cuánto sería mi venta?» →
 * «¿Global o Por cliente? ¿Cuál es tu supuesto?» · T21 «Con ESE TOTAL ANUAL, proyecta 12 meses con +4%» → la
 * misma pregunta, con el contexto ya nombrando la entidad en la propia frase del usuario.
 * LA REGLA ES CIEGA Y CONSERVADORA: multa solo cuando la pregunta pide una proyección, NO nombra ninguna
 * entidad del tenant, y la respuesta le devuelve al usuario la elección de entidad. Si la pregunta nombra una
 * entidad, el default no aplica y no se juzga: «esa manda», como dijo el owner. */
/* EXPORTADOS (2026-09-01): el playbook «proyección declarada» decide CON ESTOS MISMOS tres si una pregunta pide
 * una proyección sobre la venta. Si tuviera los suyos, el juez P1 y el playbook podrían discrepar sobre la
 * misma frase — uno multando y el otro sin activarse. Un detector, dos usos. */
/* ⚠️ AMPLIADO POR ORDEN DEL OWNER (2026-09-02, textual: «Amplía el detector de proyección para cubrir esta
 * forma exacta: "Si crezco 3% los próximos 12 meses, ¿cuánto vendería?"») — y se amplía el CONCEPTO, no una
 * lista de frases. La estructura que esto reconoce: un CONDICIONAL DE CAMBIO sobre el negocio (el lema
 * «crecer» completo — la versión vieja no veía «crezco»: la alternación cubría crece/crecés/crecimiento y el
 * presente de primera persona lleva -zc-; más «si subo/subimos/aumento/aumentamos», «si cae/caigo», «si
 * bajas/bajamos» — nunca «si bajo», homógrafo de la preposición: «¿quién queda bajo el plan?») o una PREGUNTA
 * POR LA VENTA FUTURA («cuánto vendería», «a cuánto llego»). La tasa la exige `_CIFRA_SUPUESTO` al lado y la
 * métrica ajena la corta `_OTRA_MEDIDA`: este regex solo. El pasado queda AFUERA a propósito («crecí 3% el año
 * pasado» es historia, no hipótesis): crecier(a|as|an) entra, «crecieron»/«crecí» no. */
export const _PIDE_PROYECCION = /\bproyect|\bcrec(?:e|és|es|imiento|er|iendo)|\bcrezc|\bcrecier(?:a|as|an)\b|\bsi (?:sub(?:e|o|en|imos)|aument(?:a|o|an|amos)|baj(?:a|as|an|amos)|ca(?:e|en|igo|emos))\b|pon[eé]le que|qu[eé] pasa si|\bvender[ií]a|\ba cu[aá]nto lleg/i;
/* ⚠️ SIN `\b` DESPUÉS DEL «%» — la misma trampa de `_FIN`, y me mordió por segunda vez el mismo día. `\b` se
 * define sobre [A-Za-z0-9_]: entre «%» y «:» (o un espacio) NO hay frontera, así que `/\d%\b/` no matchea
 * «crezco 3%:» ni «+4% y dime». El «%» ya delimita solo; el `\b` queda SOLO donde la palabra termina en letra
 * («pp»). REGLA DE LA CASA: un `\b` después de un carácter que no es [A-Za-z0-9_] —%, $, á, ñ— no existe. */
export const _CIFRA_SUPUESTO = /\d[\d.,]*\s*(?:%|pp\b)/;
/* ⚠️ ACÁ MEDÍA LA FORMA Y NO EL CONCEPTO — el defecto lo encontré en mi propio candado (corrida de
 * certificación, 2026-09-01). La versión vieja era una lista de cuatro frases copiadas de los textos de la
 * corrida 4 («global … por cliente», «sobre cuál entidad», «qué entidad», «cuál es tu supuesto»). El cerebro
 * cambió la redacción a «si es sobre tu venta total … o si lo aplico a una entidad específica: confirma» y el
 * candado dejó de verlo: 0 vetos sobre un turno que hacía exactamente lo que la regla prohíbe. Arreglé el
 * CASO, no la CLASE — el mismo error que vengo cazando en otros lados (van diez de esta familia).
 *
 * EL CONCEPTO, que no se esquiva cambiando palabras: si pidió una proyección con su supuesto y no nombró
 * ninguna entidad, la respuesta TIENE QUE TRAER LA CIFRA PROYECTADA. Da igual cómo esté redactada: sin cifra
 * de plata no proyectó, y devolverle la elección es la única razón por la que un turno así se queda sin cifra.
 * Para esquivar esta regla hay que dar la cifra — que es justamente lo que la regla pide.
 *
 * HUECO CONOCIDO, a propósito: una respuesta que NO proyecta pero menciona cualquier otro monto pasa (medido:
 * el turno 4 de la certificación, que falló por otra causa y trae «+$2.3M»). Se prefiere multar de menos:
 * un candado con falsos positivos se desactiva solo. */
const _CIFRA_DE_PLATA = /\$\s?\d[\d.,]*\s?[KMB]?\b/;
/* EL DEFAULT DEL OWNER ES SOBRE LA VENTA, y solo sobre ella: «si digo MI VENTA con un supuesto de
 * crecimiento/proyección…». Si la pregunta pone el supuesto sobre OTRA medida —«ponele que riachuelo tiene 30%
 * de MARGEN, qué hacemos»— no hay default que aplicar y la regla no se asoma. Sin esto, mi versión nueva
 * multaba esa pregunta y tumbaba la refutación del supuesto al genérico: lo cazó el gate del bucle (R4b), no
 * yo. Una regla más ancha que su motivo rompe cosas que andaban. */
export const _OTRA_MEDIDA = /\bmarg[eé]n|\brentabilidad|\brotaci[oó]n|\bcapital|\bstock|\binventario|\bcosto|\bprecio|\bcontribuci[oó]n|\bcarga\b/i;

/* ── EL REGISTRO ES UNA SOLA LEY PARA LOS DOS CAMINOS (owner 2026-09-10) ────────────────────────────────────
 * «La red de respaldo no puede convertirse en un segundo ADI. Puede ser un segundo camino de entrega, pero no
 * un segundo cerebro.» La prueba local lo midió: el oráculo —con un muro sin estas reglas— dijo «tu meta de
 * 3.5%», dio órdenes y habló de «la cuenta del motor». Este juez reúne las reglas de REGISTRO que no dependen
 * del contrato del agente (léxico de superficie + imperativos + decisión por tomada) para que el oráculo las
 * aplique con la MISMA letra: una regla, un archivo. vetosDeContrato lo invoca, así que el agente queda
 * idéntico; el oráculo lo suma en su propio juez. */
export function vetosDeRegistro(texto, contexto = {}) {
  if (typeof texto !== "string" || !texto.trim()) return [];
  const v = [];
  const parrafos = texto.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const cierre = parrafos.length ? parrafos[parrafos.length - 1] : "";
  // el cierre se juzga línea a línea (una lista final de acciones imperativas también es un cierre que ordena)
  const lineasCierre = cierre.split("\n").map((l) => l.replace(/^[-·•\d.)\s]+/, "").trim()).filter(Boolean);
  if (lineasCierre.some((l) => _IMPERATIVO_EJECUCION.test(l))) {
    v.push({ regla: "cierre-imperativo", multa: "el cierre ORDENA una ejecución — el qué hacer se ofrece con su cifra y la decisión se le entrega al usuario, jamás se da por tomada. Reescribe el cierre como oferta (condicional o pregunta)." });
  }
  if (_PROSA_IMPERATIVA.test(texto)) {
    v.push({ regla: "prosa-imperativa", multa: "ordenas una ejecución en medio de la prosa («siéntate con…», «renegocia…») — ADI asesora, no gestiona: dilo como lo que TÚ harías o como oferta («yo me sentaría con…», «la conversación es renegociar…»), y la decisión queda del lado del usuario." });
  } else if (_PROSA_ORDEN_AL_EQUIPO.test(texto)) {
    v.push({ regla: "prosa-imperativa", multa: "le das una orden al equipo («arranquen por…», «renegocien…») — ADI asesora, no gestiona, y a un equipo se le explica por dónde entraría y por qué, no se le manda: «yo entraría por…», «la conversación con X es…». La decisión queda del lado del usuario." });
  }
  if (_DECISION_TOMADA.test(texto)) {
    v.push({ regla: "decision-por-tomada", multa: "das una decisión por tomada («procede con…») — las decisiones son del usuario y él debe evaluarlas. Preséntala como sugerencia con su cifra." });
  }
  const _int = _intencionDictaminada(texto);
  if (_int) {
    v.push({ regla: "intencion-inferida", multa: `dictaminas una intención: «${_int}». El dato puede descartar un PATRÓN —que la carga esté dentro del nivel, que el margen venga del precio y no del rebate— pero no puede decir si alguien lo hizo a propósito: eso vive en una cabeza, no en una fila. Describe el patrón que sí mediste, y si la intención importa, PREGÚNTASELA al dueño («¿fue una apuesta tuya de rotación o se les fue de las manos?»); preguntar está bien, dictaminar no.` });
  }
  for (const L of _LEXICO_SUPERFICIE) {
    // `salvoSi` es la excepción DECLARADA de una regla, evaluada contra un HECHO del turno — jamás contra el
    // texto (ver `lexico-herramienta`). Sin `salvoSi`, la regla se comporta exactamente como siempre.
    if (typeof L.salvoSi === "function" && L.salvoSi(contexto)) continue;
    if (L.re.test(texto)) v.push({ regla: L.regla, multa: L.multa });
  }
  /* ══ CUATRO GARANTÍAS TRANSVERSALES DEL PRODUCTO (owner 2026-09-13) ═════════════════════════════════════════════
   * No son excepciones del prompt de gerente: rigen en toda respuesta donde aparezca la situación, por los dos caminos
   * (el agente y el oráculo pasan por `vetosDeRegistro` con la boleta del turno).
   *   1 · EVOLUCIÓN TEMPORAL SOLO CON EVIDENCIA TEMPORAL — «cae», «sube», «se deteriora», «calidad deteriorada», «se
   *       diluye»: decir que una métrica se movió en el tiempo exige que la boleta traiga la variación o la serie de
   *       ESA métrica. Estar bajo el benchmark no es deteriorarse. Sujetos: cualquier métrica de la casa.
   *   2 · brecha contra referencia ≠ pérdida realizada y 3 · naturaleza económica de cada cifra: viven en el muro
   *       (guardC, `_naturalezaCambiada`), porque cuelgan del TIPO de la fig.
   *   4 · COMPARACIONES SOLO ENTRE MÉTRICAS EQUIVALENTES Y DISPONIBLES — el par de métricas distintas lo cobra el muro
   *       (`comparacion-de-metricas-distintas`); acá se cobra la comparación SIN cifras de los dos lados: «el markup de
   *       los que caen está más pegado al costo que el de los sanos» solo vale con el markup de cada lado en la oración.
   * «Erosión por acciones comerciales» es el nombre de un papel; «los que caen bajo el benchmark» es «están por debajo»;
   * una SIMULACIÓN («la venta baja frente a lo actual», con supuesto declarado) mide justamente subidas y bajadas. */
  const _figsCtx = Array.isArray(contexto.figs) && contexto.figs.length ? contexto.figs : null;   // sin boleta (reformular re-dice un texto aprobado) no hay contra qué medir
  const _esSimulacion = !!_figsCtx && _figsCtx.some((f) => /supuest[oa]s?|proyectad|simulad|escenario|recuperable/i.test(String(f.label || "")) || f.source === "user_supuesto");
  if (_figsCtx && !_esSimulacion) {
    const _labels = _figsCtx.map((f) => String(f.label || ""));
    const _reVar = /variaci|vs\.?\s+a[ñn]o|a[ñn]o anterior|YoY|crecimiento|interanual|per[ií]odo anterior|tendencia|mes a mes|mensual|serie|m[ií]nimo|m[aá]ximo/i;
    const _reMes = /^(?:Ene(?:ro)?|Feb(?:rero)?|Mar(?:zo)?|Abr(?:il)?|May(?:o)?|Jun(?:io)?|Jul(?:io)?|Ago(?:sto)?|Sep(?:tiembre)?|Oct(?:ubre)?|Nov(?:iembre)?|Dic(?:iembre)?)\s*(?:\d{2,4})?$/i;   // un MES como rótulo entero («Feb», «Mar 2026»): «Margen» empieza por «Mar» y no es marzo
    /* la FAMILIA de cada sujeto: con qué rótulos de la boleta se prueba que su variación está medida */
    const _familia = (met) => {
      const s = met.toLowerCase().replace(/ó/g, "o").replace(/á/g, "a");
      if (/^venta|^factura/.test(s)) return { re: /ventas?|vendid|factur/i, panel: true };   // los paneles «vs año anterior»/YoY son de venta
      if (/^margen|^rentabilidad|^calidad/.test(s)) return { re: /m[aá]rgen|rentabilidad/i, serie: true };
      if (/^contribu/.test(s)) return { re: /contribuci/i };
      if (/^carga|^rebate|^acciones/.test(s)) return { re: /carga|acciones comerciales|rebate/i };
      if (/^rotaci/.test(s)) return { re: /rotaci/i };
      if (/^capital|^inventario|^stock/.test(s)) return { re: /capital|inventario|stock/i };
      if (/^precio|^markup/.test(s)) return { re: /precio|markup/i };
      if (/^costo/.test(s)) return { re: /costo/i };
      if (/^resultado/.test(s)) return { re: /resultado/i };
      return { re: new RegExp(s.slice(0, 5), "i") };
    };
    const _medida = (met) => {
      const F = _familia(met);
      if (F.panel && _labels.some((l) => _reVar.test(l))) return true;
      return _labels.some((l) => (F.re.test(l) && _reVar.test(l)) || (F.serie && _reMes.test(l)));
    };
    const _SUJETO = "(margen|ventas?|facturaci[oó]n|contribuci[oó]n|carga(?:\\s+comercial)?|rebates?|acciones comerciales|rotaci[oó]n|capital|inventario|stock|precios?(?:\\s+de\\s+lista)?|markup|costos?|resultado|rentabilidad)";
    const _VARIA = new RegExp(`(?<![\\wáéíóúñ])${_SUJETO}(?![\\wáéíóúñ])(?:\\s+(?:promedio|bruto|neto|de la cartera|del negocio|total|del per[ií]odo|de lista|medio))?\\s+(?:se\\s+)?(cae|cay[oó]|caen|baja|bajó|bajan|retrocede|retrocedi[oó]|se desploma|viene cayendo|se deteriora|se deterioró|sube|subi[oó]|suben|crece|creci[oó]|crecen|mejora|mejoró|empeora|empeoró|repunta|se recupera)(?![\\wáéíóúñ])(?!\\s+(?:bajo|por debajo|debajo|de(?:l)?\\s+(?:benchmark|referencia|piso|vara|nivel)))`, "gi");
    /* la HIPÓTESIS y la PREGUNTA no afirman («si el costo subió», «no puedo separar si…», «¿bajó el precio?») — la ley cobra la
     * afirmación de un movimiento, jamás el razonamiento sobre uno posible */
    const _CONDICIONAL = /(?:^|[\s(—-])(?:si|o si|si es que|quiz[aá]s?|tal vez|puede que|acaso|aunque|salvo que)\s+(?:el\s+|la\s+|tu\s+|su\s+|los\s+|las\s+|ese\s+|esa\s+)?$/i;
    const _oracionDe = (i) => { const a = texto.lastIndexOf("\n", i), b = texto.slice(0, i).search(/[.!?](?!\d)[^.!?]*$/); const ini = Math.max(a, b) + 1; const fin = texto.slice(i).search(/[.!?\n]/); return texto.slice(ini, fin < 0 ? texto.length : i + fin + 1); };
    let m;
    while ((m = _VARIA.exec(texto))) {   // TODAS las apariciones: «la venta crece» (medida) no exime a «el margen cae» (no medida)
      if (_medida(m[1])) continue;
      const antes = texto.slice(Math.max(0, m.index - 40), m.index);
      /* «el patrón de carga baja está ahí» (prueba 1, tercera corrida viva · 2026-09-14): «baja» es ADJETIVO —carga baja, no la
       * carga baja—. El verbo lleva el sujeto con artículo o posesivo delante («la carga baja», «su margen baja»); sin él, es
       * el nivel («de carga baja», «con carga baja»). Solo para «baja», la única forma ambigua de la lista. */
      if (/^baja$/i.test(m[2]) && !leerClausula(texto, m.index).determinante) continue;   // el determinante se lee dentro de la cláusula (lector de cláusula, owner 2026-09-14)
      const oracion = _oracionDe(m.index);
      if (_CONDICIONAL.test(antes) || /[¿?]/.test(oracion) || /\bno (?:puedo|s[eé]|podr[ií]a) (?:saber|separar|decir|distinguir|afirmar)\b|\bhip[oó]tesis\b|\bpodr[ií]a (?:haber|estar|ser)\b/i.test(oracion)) continue;
      v.push({ regla: "variacion-no-medida", multa: `dices que ${m[1].toLowerCase()} «${m[2]}» y este turno no midió ninguna variación de esa métrica (no hay «${m[1].toLowerCase()} vs año anterior» ni su serie en la boleta): lo medido es su nivel contra la referencia. Di «está en X, bajo el benchmark», no que cae o sube.` });
      break;
    }
    /* ── LA GANANCIA COMPARADA (owner 2026-09-13, corrida 5 del prompt de gerente) ─────────────────────────────────
     * Lo que salió: «El negocio está vendiendo más, no ganando más». Ganar más, menos o lo mismo —y que el negocio
     * mejore o empeore— es una comparación EN EL TIEMPO de la contribución, el resultado o el margen. Con la venta
     * medida contra el año anterior y el margen medido solo contra el benchmark, lo que se sabe es que vende más y
     * que el margen está bajo la referencia: si gana más no está medido. La afirmación vale con la variación (o la
     * serie) de contribución, resultado o margen en la boleta. No se cobra la pregunta, la hipótesis («si realmente
     * estamos mejorando») ni la comparación entre cuentas («ganamos más con A que con B»), que no es temporal. */
    const _GANANCIA = /(?<![\wáéíóúñ])(?:(?:no|tampoco|ni|sin)\s+)?(?:(?:est[aá](?:s|n|mos|y)?\s+|se\s+est[aá]n?\s+|sigue(?:s|n)?\s+|seguimos\s+|venimos\s+|viene(?:s|n)?\s+)?ganando|ganamos|ganan|ganas|gana|gan[oó]|ganaron|ganaste|se\s+gana|est[aá](?:s|n|mos|y)?\s+(?:mejorando|empeorando)|mejoramos|empeoramos|(?:el\s+)?negocio\s+(?:no\s+)?(?:mejora|mejor[oó]|empeora|empeor[oó]|va\s+(?:mejor|peor))|(?:m[aá]s|menos|mayor|menor)\s+(?:ganancia|utilidad)|(?:ganancia|utilidad)\s+(?:mayor|menor|m[aá]s\s+alta|m[aá]s\s+baja))(\s+(?:m[aá]s|menos|lo\s+mismo|igual|mejor|peor))?(?![\wáéíóúñ])/gi;
    const _HIPOTESIS_ANTES = /(?:^|[\s(—–-])(?:si|o si|si es que|quiz[aá]s?|tal vez|puede que|acaso|aunque|salvo que|saber si|s[eé] si|confirmar si|ver si|de si)\s+(?:(?:realmente|de verdad|en verdad|efectivamente|solo|s[oó]lo|el negocio|la empresa|ustedes|nosotros|el|la|tu|su|los|las|ese|esa|esto|eso)\s+){0,3}$/i;
    const _ganMedida = () => _medida("contribución") || _medida("resultado") || _medida("margen");
    let mg;
    while ((mg = _GANANCIA.exec(texto))) {
      const dicho = mg[0];
      if (/gan/i.test(dicho) && !/ganancia|utilidad/i.test(dicho) && !mg[1]) continue;   // «ganamos $X» no compara: se cobra «ganamos MÁS / MENOS / lo mismo»
      const despues = texto.slice(mg.index + dicho.length, mg.index + dicho.length + 60);
      if (/^\s+que\s+(?!(?:el\s+|en\s+|hace\s+)?(?:a[ñn]o|per[ií]odo|mes|trimestre|antes|anterior|\d{4}))/i.test(despues) || /^\s+(?:con|en)\s+[A-ZÁÉÍÓÚ]/.test(despues)) continue;   // «ganamos más QUE con Ripley»: entre cuentas, no en el tiempo
      const antes = texto.slice(Math.max(0, mg.index - 60), mg.index);
      const oracion = _oracionDe(mg.index);
      if (_HIPOTESIS_ANTES.test(antes) || /[¿?]/.test(oracion) || /\bno (?:puedo|s[eé]|podr[ií]a|se puede|podemos) (?:saber|separar|decir|distinguir|afirmar|confirmar)\b|\bhip[oó]tesis\b|\bno est[aá] medid[oa]\b|\bno se sabe\b/i.test(oracion)) continue;
      if (_ganMedida()) break;
      v.push({ regla: "ganancia-no-comparada", multa: `dices «${dicho.trim()}» y este turno no midió ninguna variación de contribución, resultado ni margen (no hay «contribución vs año anterior» ni su serie en la boleta): lo medido es que la venta crece y que el margen está bajo el benchmark. Di «vendes más; si ganas más no se puede saber con este dato: no hay comparación histórica de margen ni de contribución», no que ganas más, menos o lo mismo.` });
      break;
    }
    /* ── «SE DETERIORÓ» CON CUALQUIER SUJETO (owner 2026-09-13, corrida 5) ─────────────────────────────────────────
     * Lo que salió: «…estrategia deliberada o negociación que se deterioró». Deteriorarse es un movimiento en el
     * tiempo, y eso vale para cualquier sujeto —margen, calidad, negociación, relación, cuenta—: sin la variación o
     * la serie de ESO en la boleta, no se dice. Tampoco como hipótesis ni como alternativa: la palabra afirma el
     * movimiento igual (el owner la cobró justo dentro de un «es si … o …»). Lo que hay es un NIVEL: «una negociación
     * que quedó bajo la referencia». Pasa solo la negación («no hay deterioro medido», «sin deterioro»). */
    const _DETERIOR = /(?<![\wáéíóúñ])(?:se\s+(?:ha\s+|han\s+|hab[ií]a\s+|est[aá]n?\s+|fue\s+|fueron\s+|viene\s+|vienen\s+)?deterior(?:a|an|[oó]|aron|ando|ado|ada|ados|adas)|deterior(?:o|os|ad[oa]s?)|deteriorarse|en\s+deterioro)(?![\wáéíóúñ])/gi;
    const _SUJETO_DET = new RegExp(`${_SUJETO}|calidad(?:\\s+de\\s+(?:la\\s+)?venta)?`, "gi");
    const _sujetoCerca = (i, fin) => {
      let ult = null, mm;
      _SUJETO_DET.lastIndex = 0;
      const atras = texto.slice(Math.max(0, i - 45), i);
      while ((mm = _SUJETO_DET.exec(atras))) ult = mm[0];
      if (ult) return ult;
      const ad = new RegExp(`^\\s*(?:de|del|en)\\s+(?:la\\s+|el\\s+|su\\s+|tu\\s+|esa\\s+|ese\\s+)?(${_SUJETO}|calidad)`, "i").exec(texto.slice(fin, fin + 45));
      return ad ? ad[1] : null;
    };
    let mdg = null, sujDet = null, mm2;
    while ((mm2 = _DETERIOR.exec(texto))) {
      if (/(?:no|ni|sin|tampoco|nunca|jam[aá]s)\s+(?:[\wáéíóúñ]+\s+){0,6}$/i.test(texto.slice(Math.max(0, mm2.index - 70), mm2.index))) continue;   // «no hay deterioro medido», «sin deterioro»
      const suj = _sujetoCerca(mm2.index, mm2.index + mm2[0].length);
      if (suj && _medida(suj)) continue;
      mdg = mm2; sujDet = suj; break;
    }
    if (mdg) {
      v.push({ regla: "deterioro-no-medido", multa: `«${mdg[0]}» afirma que algo EMPEORÓ en el tiempo${sujDet ? ` (${sujDet.toLowerCase()})` : ""}, y este turno no midió ninguna variación de eso: lo que hay es su NIVEL contra la referencia. Di el nivel («quedó bajo la referencia», «cede condiciones»), no el movimiento — y tampoco como hipótesis o alternativa: «se deterioró» afirma el movimiento igual.` });
    }
    /* el deterioro dicho con otras palabras («se diluye la calidad», «cada vez menos margen», «ha caído el margen») */
    const _DETERIORO = /(?<![\wáéíóúñ])(?:se\s+diluye\s+la\s+calidad|(?:el\s+)?(?:margen|precio|resultado|rentabilidad)\s+(?:se\s+diluye|viene\s+(?:cayendo|bajando|empeorando)|empeora)|cada\s+vez\s+(?:menos\s+(?:margen|rentable)|peor\s+margen)|ha\s+(?:ca[ií]do|bajado|empeorado)\s+(?:el\s+)?(?:margen|precio|rentabilidad)|(?:margen|precio|rentabilidad)\s+ha\s+(?:ca[ií]do|bajado|empeorado))(?![\wáéíóúñ])/i;
    const md = mdg ? null : _DETERIORO.exec(texto);
    if (md && !_medida(/precio/i.test(md[0]) ? "precio" : /resultado/i.test(md[0]) ? "resultado" : "margen")) {
      v.push({ regla: "deterioro-no-medido", multa: `«${md[0]}» afirma que algo EMPEORÓ en el tiempo, y este turno no midió ninguna variación de esa métrica: lo medido es su nivel contra el benchmark, que no es lo mismo que deteriorarse. Di «crece la venta y el margen está bajo el benchmark», sin «deterioro» ni «se diluye».` });
    }
  }
  /* ── 4 · LA COMPARACIÓN LLEVA SUS DOS LADOS ──────────────────────────────────────────────────────────────────────
   * (a) markup / precio de lista de los que caen contra los sanos: la boleta de rolesCartera publica el markup de los sanos
   *     y los dos promedios; la afirmación vale solo con una cifra de cada lado en la misma oración. Sin cifras de los
   *     sanos en la boleta, no se dice — ni en el cuerpo ni en el cierre.
   * (b) en general: una comparación de una métrica entre dos lados nombrados («A tiene más margen que B», «los grandes
   *     ceden más carga que el resto») sin UNA cifra en la oración es una comparación sin dato. */
  if (_figsCtx) {
    const _CLAIM_MK = /(?<![\wáéíóúñ])(?:markup|precio de lista|pegad[oa]s? al costo|ajustad[oa]s?)[^.;\n]{0,90}(?:que|frente a|contra|vs\.?|versus)\s+(?:(?:el|la|los|las|de)\s+){0,3}(?:(?:clientes?\s+|cuentas?\s+)?sanos?|resto\s+de\s+la\s+cartera|los\s+que\s+(?:superan|cumplen|est[aá]n\s+sobre)|(?:clientes?|cuentas?)\s+sobre\s+el\s+benchmark)(?![\wáéíóúñ])|(?<![\wáéíóúñ])(?:sanos|resto\s+de\s+la\s+cartera)[^.;\n]{0,60}(?:markup|precio de lista)[^.;\n]{0,40}m[aá]s\s+(?:alt[oa]|holgad[oa]|amplio|lejos del costo)(?![\wáéíóúñ])/i;
    const _CIFRA = /\$\s?[\d.,]+\s?[KMB]?|[\d.,]+\s*%|[\d.,]+\s*(?:pp|x)(?![\wáéíóúñ])/;
    const _COMPARA_LADOS = /(?<![\wáéíóúñ])(?:m[aá]s|menos|mayor|menor|superior|inferior|peor|mejor)(?:es)?\s+(?:margen|carga(?:\s+comercial)?|contribuci[oó]n|venta|ventas|rotaci[oó]n|markup|precio|costo|rentabilidad)?[^.;\n]{0,50}?\s(?:que|frente a|contra)\s+(?:(?:el|la|los|las|de)\s+){0,3}(?:sanos|resto|dem[aá]s|otr[oa]s|grandes|chic[oa]s|peque[ñn][oa]s|cartera|[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)/;
    for (const oracion of texto.split(/(?<=[.!?])\s+|\n+/)) {
      if (_CLAIM_MK.test(oracion)) {
        const sanosMk = _figsCtx.filter((f) => /Markup promedio · sanos/i.test(String(f.label || "")) || (/Markup sobre costo/i.test(String(f.label || "")) && /sano/i.test(String(f.context || "")))).map((f) => String(f.text || f.value || "").trim()).filter(Boolean);
        const caenMk = _figsCtx.filter((f) => /Markup promedio · los que caen/i.test(String(f.label || "")) || (/Markup sobre costo/i.test(String(f.label || "")) && !/sano/i.test(String(f.context || "")))).map((f) => String(f.text || f.value || "").trim()).filter(Boolean);
        if (!sanosMk.length) {
          v.push({ regla: "markup-sin-el-otro-lado", multa: "comparas el markup (precio de lista) de los que caen con el de los sanos y la boleta de este turno NO trae el markup de los sanos: esa comparación no se puede afirmar — quítala del cuerpo y del cierre, o di solo lo que sí está medido." });
          break;
        }
        const citaSano = sanosMk.some((x) => oracion.includes(x)), citaCaen = caenMk.some((x) => oracion.includes(x));
        if (!citaSano || !citaCaen) {
          v.push({ regla: "markup-sin-el-otro-lado", multa: `comparas el markup de los que caen con el de los sanos sin citar los dos lados en la misma oración: la boleta trae «Markup promedio · los que caen» y «Markup promedio · sanos» (${caenMk[0] || "?"} contra ${sanosMk[0] || "?"}) — cítalos, o no compares.` });
          break;
        }
        continue;
      }
      /* ── LA COMPARACIÓN ENTRE DOS CUENTAS SE VERIFICA, NO SE PROHÍBE (owner 2026-09-14, el orden en todas sus formas) ─────────────────
       * Medido en el conjunto adversarial: esta regla vetaba «Falabella deja más contribución que Lider» (verdad) y dejaba pasar «Lider vende
       * más que Falabella» (falso): prohibir no es responder. Cuando los dos lados son ENTIDADES nombradas y la métrica tiene ranking
       * declarado (margen, carga, contribución, ventas, rotación), el muro la verifica contra el ranking (`comparacion-no-sostenida` en
       * guardC), con o sin cifras. Acá queda lo que no tiene ranking contra el cual medirse: un lado que es un GRUPO («los sanos», «el resto»,
       * «los grandes») o una métrica sin ranking (markup, precio, costo, rentabilidad). */
      const _LADO_GRUPO = /(?:que|frente a|contra)\s+(?:(?:el|la|los|las|de)\s+){0,3}(?:sanos|resto|dem[aá]s|otr[oa]s|grandes|chic[oa]s|peque[ñn][oa]s|cartera)(?![\wáéíóúñ])/i;
      const _SIN_RANKING = /(?<![\wáéíóúñ])(?:markup|precio|costo|rentabilidad)(?![\wáéíóúñ])/i;
      if (_COMPARA_LADOS.test(oracion) && !_CIFRA.test(oracion) && (_LADO_GRUPO.test(oracion) || _SIN_RANKING.test(oracion)) && /(?<![\wáéíóúñ])(?:margen|carga|contribuci[oó]n|ventas?|rotaci[oó]n|markup|precio|costo|rentabilidad)(?![\wáéíóúñ])/i.test(oracion)) {
        v.push({ regla: "comparacion-sin-cifras", multa: `comparas dos lados sobre una métrica («${oracion.trim().slice(0, 90)}…») sin una sola cifra en la oración: una comparación ejecutiva lleva la cifra de cada lado, de la boleta — o no se hace.` });
        break;
      }
    }
  }
  const _mec = _mecanismoSinSello(texto, contexto.huellas);
  if (_mec) v.push({ regla: "mecanismo-sin-sello", multa: _mec });
  const _jer = _jerarquiaCausalSinMedida(texto, contexto.figs);
  if (_jer) v.push({ regla: "jerarquia-causal-sin-medida", multa: _jer });
  const _sub = _subtotalDeOtroUniverso(texto, contexto.figs);
  if (_sub) v.push({ regla: "subtotal-de-otro-universo", multa: _sub });
  const _pyc = _precioYCostoSeparados(texto, contexto.figs);
  if (_pyc) v.push({ regla: "precio-y-costo-no-se-separan", multa: _pyc });
  const _cta = _cuentaDerivada(texto, contexto.figs);
  if (_cta) v.push({ regla: "cuenta-derivada-no-cierra", multa: _cta });
  /* ── EL ESTÁNDAR DEL 2026-09-14 (corrida en vivo del cruce): una cifra correcta no puede quedar asociada a un atributo
   * incorrecto (bodega, marca, familia, canal), y una relación dicha en palabras («cuatro veces», «la mitad») tiene que
   * cerrar con las cifras que la rodean. Viven en atributosYRelaciones.js; acá solo se cobran. */
  const _atr = (() => { try { return atributoMalAsociado(texto); } catch { return null; } })();
  if (_atr) v.push({ regla: "atributo-mal-asociado", multa: _atr });
  const _rel = (() => { try { return relacionEnPalabrasNoCierra(texto, contexto.figs); } catch { return null; } })();   // con la boleta: la fracción de un todo y el par sin cifras se verifican contra el dato (owner 2026-09-14)
  if (_rel) v.push({ regla: "relacion-en-palabras-no-cierra", multa: _rel });
  /* ── LA COBERTURA DEL ENCARGO (owner 2026-09-14, la prueba real en producción v2.28) ───────────────────────────
   * «si el usuario pide Comercial + Inventario + Cobranza, la respuesta final debe cubrir Comercial + Inventario +
   * Cobranza, tanto si responde el modelo como si termina en respaldo» · «en un encargo múltiple, "foco" significa
   * ordenar y jerarquizar, no eliminar dominios pedidos». Las partes son las de partesDelEncargo.js —las mismas que
   * el ensamblador compone—; una parte se cubre atendiéndola con el dato o declarándola en una línea. Se cobra al
   * cerebro y al ensamblador (los dos caminos, la misma cobertura); a los peldaños de abajo no, porque son el
   * último recurso: quitarles la respuesta parcial dejaría al usuario sin nada. Una pregunta simple no es un
   * encargo: sin dos partes pedidas esta regla no existe. */
  const _sitioEc = contexto.sitio || "";
  if (!_sitioEc || _sitioEc === "cierre" || _sitioEc === "reparacion" || _sitioEc === "poda" || _sitioEc === "encargo-compuesto") {
    const _partes = (() => { try { return partesDelEncargo(contexto.pregunta); } catch { return []; } })();
    if (_partes.length >= 2) {
      const _faltan = coberturaDelEncargo(texto, _partes);
      if (_faltan.length) {
        v.push({ regla: "parte-del-encargo-omitida", multa: `el encargo pidió ${_partes.length} cosas y la respuesta deja fuera ${_faltan.length}: ${_faltan.map((p) => `«${p.nombre}»`).join(" · ")}. En un encargo múltiple el foco ordena y jerarquiza, no elimina una parte pedida: cubre cada una con lo que la boleta trae (o di en una línea que ese dato no está), en una sola lectura, y cierra con la prioridad común.` });
      }
      /* LA PRIORIDAD INTEGRADA ES DEL PROCEDIMIENTO (owner 2026-09-14): materialidad + severidad + urgencia, señal por señal —
       * el cerebro la explica, no la cambia. Solo cuando el encargo pidió la prioridad y la boleta trae las señales. */
      if ((_partes.some((p) => p.clave === "primero") || dominiosDelEncargo(_partes).length >= 2) && Array.isArray(contexto.figs) && contexto.figs.length) {   // con varios dominios, siempre (owner 2026-09-14)
        const _pc = (() => { try { return prioridadIntegradaCambiada(texto, contexto.figs, dominiosDelEncargo(_partes), criterioDeLaPregunta(contexto.pregunta) || {}); } catch { return null; } })();
        if (_pc) v.push({ regla: "prioridad-integrada-cambiada", multa: _pc });
        /* LA COINCIDENCIA AGRAVA, NO DECIDE (owner 2026-09-14): «coincide en dos dominios» no es razón suficiente para ir primero */
        const _cc = (() => { try { return coincidenciaComoRazon(texto); } catch { return null; } })();
        if (_cc) v.push({ regla: "coincidencia-como-razon", multa: _cc });
      }
    }
  }
  return v;
}

/* ── EL MECANISMO SIN SU SELLO (owner 2026-09-11, batería compuesta · «comercial») ─────────────────────────
 * Lo que salió: «En los cinco, el mecanismo medido es carga comercial/rebate — no costo estructural. Tottus y
 * Mercado Libre… ahí el mecanismo es costo, no carga.» El motor de papeles ya dice qué mecanismo está PROBADO,
 * cuál INDICADO y cuál ABIERTO (las huellas de `rolesCartera`); afirmar como hecho uno indicado o abierto —o
 * negarlo como hecho— es causalidad sin respaldo con tono seguro, y el juez del porqué solo miraba «porque /
 * se debe a». La regla lee las huellas del turno (el caller las pasa; sin huellas, calla) y multa la afirmación
 * sin marca. Pasan: la hipótesis marcada, la pregunta, el límite declarado y las alternativas («precio o mix»). */
const _MECANISMO_LEXICO = [
  [/\bcostos?\b|\bprecio de lista\b|\bmarkup\b|\bprecios?\b/i, /precio de lista pegado al costo/i, "costo/precio"],
  [/\bmix\b|\bsurtido\b/i, /\bmix\b/i, "mix"],
  [/\bvolumen\b/i, /volumen a margen bajo/i, "volumen"],
  [/\bcarga\b|acciones comerciales|\brebates?\b|\bdescuentos?\b/i, /acciones comerciales sobre el nivel/i, "carga comercial"],
];
/* la afirmación CAPTURA el mecanismo que afirma o niega: se juzga ese, no cualquier mecanismo nombrado de paso en
 * la misma oración («…ceden margen por acciones comerciales — o sea buena parte de lo que el volumen…» nombra
 * el precio de paso y afirma la carga, que está probada). */
const _MECANISMO_PALABRA = "(costos?|precio de lista|precios?|markup|mix|surtido|volumen|carga comercial|carga|acciones comerciales|rebates?|descuentos?)";
/* ⚠️ SOLO LA AFIRMACIÓN CAUSAL, no cualquier «es X» / «no X» (calibrado contra los composers de la casa): «el foco
 * de la semana es la condición, no el volumen» habla del FOCO, y «lo que el volumen cuesta no es precio de lista,
 * es condición negociada» está anclado al conteo probado de la misma oración. Se cobra (a) el marco explícito
 * —«el mecanismo es X», «viene de X», «se explica por X», «se debe a X», «es un problema/tema de X», «es por X»—
 * y (b) dentro de una oración que ya habla del mecanismo, la causa, el patrón o la tesis, también la negación
 * «…, no X» / «, no a X ni a Y». */
const _MARCO_CAUSAL = /\bel mecanismo\b|\bla causa\b|\bse explica\b|\bse debe\b|\bviene (?:de|del)\b|\bapunta (?:a|al)\b|\bel patr[oó]n\b|\bla tesis\b|\bel origen\b|\bel problema\b|\bla explicaci[oó]n\b|\bexplica(?:n|do)?\b|\bdetr[aá]s\b|\bdescart|\bpor qu[eé] (?:pasa|ocurre)\b/i;
const _AFIRMA_MECANISMO = new RegExp(`\\b(?:el mecanismo (?:medido |real |de fondo )?(?:es|son|no es)|se explica por|se debe (?:a|al)|viene (?:de|del)|es por|es (?:un |una )?(?:tema|problema|cosa|cuesti[oó]n) de)\\s+(?:el |la |los |las )?${_MECANISMO_PALABRA}(?: estructural| comercial)?(?![\\wáéíóúñ])`, "gi");
/* LA NEGACIÓN ES UN DESCARTE (owner 2026-09-13, corrida 5 del prompt de gerente): «el patrón apunta a carga comercial,
 * no a precio de lista ni a mix» descartó como hecho un mecanismo INDICADO (el precio: markup más bajo en los que
 * caen) y uno ABIERTO (el mix: el dato no cruza cliente con familia). «ADI debe conservar siempre la diferencia
 * entre lo descartado, lo indicado, lo abierto y lo que realmente cambió en el tiempo.» Formas: «no es precio»,
 * «no viene de precio», «, no a precio de lista», «ni a mix», «no por costo», y el descarte explícito («descarta el
 * mix», «el precio no es el problema», «el mix no explica»). «No solo precio» no descarta, y «sin carga alta ni
 * volumen» describe la huella de una cuenta (lo que NO tiene), no descarta el mecanismo. */
const _NIEGA_MECANISMO = new RegExp(`(?<![\\wáéíóúñ])(?:no|tampoco|(?<!(?<![\\wáéíóúñ])sin\\s+[^,;.:]{0,40})ni)(?:\\s+(?:es|son|era|fue|viene\\s+de|vienen\\s+de|hay|est[aá]\\s+en|pasa\\s+por|se\\s+explica\\s+por|se\\s+debe\\s+(?:a|al)))?(?!\\s+(?:solo|s[oó]lo|[uú]nicamente|solamente|necesariamente|siempre|tanto|parece|parecen|tan\\s))\\s+(?:a |al |de |del |por |en )?(?:un |una |el |la |los |las )?(?:tema |problema |cosa |cuesti[oó]n |efecto |asunto )?(?:de |del )?${_MECANISMO_PALABRA}(?: estructural| comercial)?(?![\\wáéíóúñ])`, "gi");
const _DESCARTA_MECANISMO = new RegExp(`(?<![\\wáéíóúñ])(?:(?:se\\s+|queda\\s+|quedan\\s+|podemos\\s+|puedo\\s+|hay\\s+que\\s+|para\\s+)?descart(?:a|an|o|amos|ar|ado|ada|ados|adas)\\s+(?:el |la |los |las |un |una )?(?:tema |problema )?(?:de |del )?${_MECANISMO_PALABRA}|(?:el |la |los |las )?${_MECANISMO_PALABRA}(?:\\s+(?:y|ni|o)\\s+(?:el |la )?${_MECANISMO_PALABRA})?\\s+(?:queda(?:n)?\\s+|est[aá](?:n)?\\s+|fue(?:ron)?\\s+)?descartad[oa]s?|(?:el |la |los |las )?${_MECANISMO_PALABRA}(?:\\s+(?:y|ni|o)\\s+(?:el |la )?${_MECANISMO_PALABRA})?\\s+no\\s+(?:es|son)\\s+(?:el|la|un|una)\\s+(?:problema|causa|mecanismo|explicaci[oó]n|tema|raz[oó]n|factor|origen|driver)|(?:el |la |los |las )?${_MECANISMO_PALABRA}(?:\\s+(?:y|ni|o)\\s+(?:el |la )?${_MECANISMO_PALABRA})?\\s+no\\s+(?:explica|explican|pesa|pesan|juega|juegan|influye|influyen|cuenta|cuentan|est[aá]n?\\s+detr[aá]s|entra|entran))(?![\\wáéíóúñ])`, "gi");
/* LA ATRIBUCIÓN DICHA DE PASO (owner 2026-09-13, corrida 6): «sosteniendo contribución con mejor costo relativo» explica el
 * margen de los sanos por el costo, y el dato solo demuestra que están sobre el benchmark. «Gracias a», «debido a»,
 * «producto de» y «por / con + mejor·menor·mayor·bajo·alto + mecanismo» son causa sin marco explícito: valen solo con el
 * mecanismo PROBADO; lo demás se describe sin agregarle la causa. «Con carga sobre el nivel» (sin calificativo) describe
 * la huella medida y no entra. */
const _ATRIBUYE_MECANISMO = new RegExp(`(?<![\\wáéíóúñ])(?:(?:gracias a|debido a|producto de|a causa de|a ra[ií]z de|por efecto de|de la mano de)\\s+(?:un |una |su |sus |el |la |los |las )?(?:mejor(?:es)?\\s+|peor(?:es)?\\s+|menor(?:es)?\\s+|mayor(?:es)?\\s+|buen[oa]s?\\s+|baj[oa]s?\\s+|alt[oa]s?\\s+)?|(?:por|con)\\s+(?:un |una |su |sus |el |la |los |las )?(?:mejor(?:es)?|peor(?:es)?|menor(?:es)?|mayor(?:es)?|buen[oa]s?|baj[oa]s?|alt[oa]s?|m[aá]s\\s+(?:baj[oa]s?|alt[oa]s?|barat[oa]s?|car[oa]s?))\\s+)${_MECANISMO_PALABRA}(?:\\s+relativ[oa]s?|\\s+unitari[oa]s?|\\s+comercial|\\s+estructural)?(?![\\wáéíóúñ])|(?<![\\wáéíóúñ])(?:por|con)\\s+(?:un |una |su |sus |el |la |los |las )?${_MECANISMO_PALABRA}(?:\\s+relativ[oa]s?|\\s+unitari[oa]s?|\\s+comercial)?\\s+(?:m[aá]s\\s+(?:baj[oa]s?|alt[oa]s?|barat[oa]s?|car[oa]s?)|mejor(?:es)?|peor(?:es)?|menor(?:es)?|mayor(?:es)?)(?![\\wáéíóúñ])`, "gi");
const _ALTERNATIVA = /\b(?:costos?|precio(?: de lista)?|mix|volumen|carga)\b[^.;\n]{0,40}\bo\b[^.;\n]{0,40}\b(?:costos?|precio(?: de lista)?|mix|volumen|carga)\b/i;
const _MARCA_SELLO = /\b(?:puede|pueden|podr[ií]a(?:n)?|quiz[aá]s?|tal vez|probablemente|posiblemente|hip[oó]tesis|sospecho|apunta|indicio|patr[oó]n|sin prueba|queda abierto|no lo prueba|no est[aá] (?:medid|probad|demostrad)[oa]s?|indicad[oa]|abiert[oa]|parece|parecen|pareciera|parecer[ií]a)\b|\bsi (?:viene|vienen|fuera|fuese|es|era|resulta)\b|\bel dato no (?:lo |la |los |las )?(?:dice|declara|trae|mide|ve|prueba|separa|cruza|distingue)\b/i;
/* la marca que vale para una NEGACIÓN es la de su propia cláusula: «apunta a carga, no a precio» lleva la marca en la
 * afirmación y deja la negación seca. Absuelven la duda sobre el descarte («no parece precio», «no necesariamente»,
 * «no se puede descartar») y el límite de dato («no hay precio de lista por cliente en la planilla»). */
const _MARCA_NEGACION = /\b(?:puede|pueden|podr[ií]a(?:n)?|quiz[aá]s?|tal vez|probablemente|posiblemente|hip[oó]tesis|sospecho|parece|parecen|pareciera|parecer[ií]a|necesariamente|del todo|por completo|sin prueba|no est[aá] (?:medid|probad|demostrad)[oa]s?|no lo prueba|no (?:puedo|podemos|se puede|puede|permite) (?:descartar|afirmar|separar|saber|probar)|permite descartar)\b/i;
const _LIMITE_DE_DATO = /\b(?:dato|datos|planilla|columna|campo|cruce|cruza|medid[oa]|medir|serie|informaci[oó]n|por cliente)\b/i;
const _clausulaDe = (oracion, i, fin) => {
  const a = oracion.slice(0, i).search(/[,;:—–][^,;:—–]*$/);
  const b = oracion.slice(fin).search(/[,;:—–]/);
  return oracion.slice(a < 0 ? 0 : a + 1, b < 0 ? oracion.length : fin + b);
};
function _mecanismoSinSello(texto, huellas) {
  const H = Array.isArray(huellas) ? huellas.filter((h) => h && h.mecanismo && h.sello) : [];
  if (!H.length) return null;
  const _huellaDe = (palabra) => {
    const entrada = _MECANISMO_LEXICO.find(([lex]) => lex.test(palabra));
    if (!entrada) return null;
    const [, huellaRe, nombre] = entrada;
    const h = H.find((x) => huellaRe.test(String(x.mecanismo)));
    return h ? { h, nombre } : null;
  };
  for (const oracion of String(texto).split(/(?<=[.!?])\s+|\n+/)) {
    if (/[¿?]/.test(oracion) || _PREGUNTA_O_LIMITE.test(oracion)) continue;
    /* (a) la AFIRMACIÓN: una marca en cualquier parte de la oración la cubre («puede ser…», «el patrón apunta a…») */
    if (!_MARCA_SELLO.test(oracion) && !_ALTERNATIVA.test(oracion)) {
      _AFIRMA_MECANISMO.lastIndex = 0;
      let m;
      while ((m = _AFIRMA_MECANISMO.exec(oracion)) !== null) {
        if (/(?:^|[^\wáéíóúñ])(?:no|ni|tampoco)\s+$/i.test(oracion.slice(Math.max(0, m.index - 12), m.index))) continue;   // «no es un tema de precio» es una negación: la juzga (b)
        const e = _huellaDe(m[1]);
        if (!e || e.h.sello === "probado") continue;
        return `afirmas como hecho que el mecanismo es «${e.nombre}» («${oracion.trim().slice(0, 90)}»), y en este dato ese mecanismo está ${e.h.sello.toUpperCase()}: ${e.h.porque || "no hay prueba"}. Dilo con su sello —«el patrón apunta a…», «queda abierto»— o como hipótesis; afirmarlo o negarlo como hecho es causalidad sin respaldo.`;
      }
      _ATRIBUYE_MECANISMO.lastIndex = 0;
      while ((m = _ATRIBUYE_MECANISMO.exec(oracion)) !== null) {
        if (/(?:^|[^\wáéíóúñ])(?:no|ni|tampoco)\s+$/i.test(oracion.slice(Math.max(0, m.index - 12), m.index))) continue;
        const e = _huellaDe(m.slice(1).find(Boolean) || "");
        if (!e || e.h.sello === "probado") continue;
        return `explicas un resultado por «${m[0].trim()}» («${oracion.trim().slice(0, 90)}»), y en este dato ese mecanismo está ${e.h.sello.toUpperCase()}: ${e.h.porque || "no hay prueba"}. Describe lo demostrado —el nivel, la brecha, el conteo— sin agregarle la causa: la causa se afirma solo con el mecanismo PROBADO.`;
      }
    }
    /* (b) el DESCARTE: cada negación se juzga por SU cláusula. Negar un mecanismo PROBADO para una cuenta puntual
     * («en Tottus no es carga») sigue pasando —eso lo decide el papel de esa cuenta—, y un patrón que se buscó y no
     * está (huella medible, ausente) el dato sí lo descarta. Lo INDICADO y lo que no se puede medir, no. */
    const negs = [];
    for (const re of (_MARCO_CAUSAL.test(oracion) ? [_NIEGA_MECANISMO, _DESCARTA_MECANISMO] : [_DESCARTA_MECANISMO])) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(oracion)) !== null) negs.push({ i: m.index, fin: m.index + m[0].length, dicho: m[0], palabras: m.slice(1).filter(Boolean) });
    }
    for (const n of negs) {
      const cl = _clausulaDe(oracion, n.i, n.fin);
      if (_MARCA_NEGACION.test(cl) || _PREGUNTA_O_LIMITE.test(cl) || _LIMITE_DE_DATO.test(cl)) continue;
      for (const palabra of n.palabras) {
        const e = _huellaDe(palabra);
        if (!e) continue;
        const { h, nombre } = e;
        if (h.sello === "probado" || h.sello === "descartado") continue;
        const medible = h.medible !== undefined ? !!h.medible : !h.falta;
        if (h.sello === "abierto" && medible && h.presente === false) continue;
        return `descartas como hecho el mecanismo «${nombre}» («${n.dicho.trim()}», en «${oracion.trim().slice(0, 90)}»), y en este dato ese mecanismo está ${h.sello.toUpperCase()}: ${h.porque || "no hay prueba"}. Lo descartado, lo indicado y lo abierto no se mezclan: nombra el mecanismo probado y deja a los otros con su sello («precio de lista indicado, mix abierto»), sin negarlos.`;
      }
    }
  }
  return null;
}

/* ── LA JERARQUÍA CAUSAL SIN MEDIDA (owner 2026-09-13, corrida 6 del prompt de gerente) ─────────────────────
 * Lo que salió: «La causa dominante y probada es exceso de carga comercial». Lo probado es que el mecanismo EXISTE
 * (su huella: 6 de los que caen con la carga sobre el nivel), no que explique la mayor parte del efecto. «Dominante»,
 * «principal», «sobre todo», «la mayor parte», «pesa más» ORDENAN las causas, y ese orden exige la parte del efecto
 * medida (una descomposición en la boleta: efecto carga contra efecto costo, en pp o %). Sin ella se describe lo
 * demostrado —«un mecanismo probado», «la huella más clara»— sin jerarquía. Pasan la pregunta, la hipótesis marcada,
 * la negación, y el peso entre CUENTAS («impulsado sobre todo por Lider y Jumbo»: eso sí es una cifra). No depende
 * de las huellas: ordenar causas sin medida es falso en cualquier turno. */
const _JERARQUIA = "(?:dominante|principal(?:es)?|central|de fondo|primari[oa]|n[uú]mero uno|de mayor peso|m[aá]s importante|m[aá]s relevante|de m[aá]s peso|secundari[oa]|marginal)";
const _CAUSA_PALABRA = "(?:causa|mecanismo|factor|driver|motivo|explicaci[oó]n|origen|palanca|raz[oó]n)";
const _RE_JERARQUIA = [
  new RegExp(`(?<![\\wáéíóúñ])(?:la |el |los |las |un |una )?${_CAUSA_PALABRA}s?\\s+(?:m[aá]s\\s+)?${_JERARQUIA}(?![\\wáéíóúñ])`, "gi"),   // «la causa dominante», «el mecanismo principal», «factor de mayor peso»
  new RegExp(`(?<![\\wáéíóúñ])(?:la |el |los |las )?(?:principal(?:es)?|primer[oa]?|mayor|gran)\\s+${_CAUSA_PALABRA}s?(?![\\wáéíóúñ])`, "gi"),   // «la principal causa», «el primer mecanismo»
  new RegExp(`(?<![\\wáéíóúñ])(?:principalmente|sobre todo|fundamentalmente|esencialmente|mayoritariamente|en (?:su )?mayor(?:[ií]a| parte| medida)|b[aá]sicamente|ante todo)\\s+(?:por|de|desde|en|es|son|viene de|se explica por)?\\s*(?:la |el |las |los |un |una |su |sus )?(?:exceso de |problema de |tema de )?${_MECANISMO_PALABRA}(?![\\wáéíóúñ])`, "gi"),   // «principalmente por acciones comerciales»
  new RegExp(`(?<![\\wáéíóúñ])(?:la |el )?${_MECANISMO_PALABRA}[^.;:,]{0,30}?\\s+(?:explica|explican|se lleva|se llevan|concentra|concentran|representa|representan)\\s+(?:la mayor parte|el grueso|casi tod[oa]|la mayor[ií]a|lo principal|buena parte|gran parte|m[aá]s de la mitad)(?![\\wáéíóúñ])`, "gi"),   // «la carga explica la mayor parte de la brecha»
  new RegExp(`(?<![\\wáéíóúñ])(?:la mayor parte|el grueso|buena parte|gran parte|casi tod[oa]|m[aá]s de la mitad)\\s+(?:de |del )(?:la |el |esa |ese |esta |este )?(?:brecha|efecto|resultado|problema|ca[ií]da|diferencia|contribuci[oó]n no capturada)[^.;:]{0,25}?\\s+(?:es|son|viene del?|vienen del?|se explica por(?: el| la)?|est[aá] en(?: el| la)?|la explica|lo explica)\\s+(?:la |el |las |los |un |una )?(?:exceso de )?${_MECANISMO_PALABRA}(?![\\wáéíóúñ])`, "gi"),   // «la mayor parte de la brecha viene de la carga / del costo»
  new RegExp(`(?<![\\wáéíóúñ])lo que m[aá]s (?:pesa|importa|explica|cuenta|manda)\\s+(?:es|son)\\s+(?:la |el |las |los )?(?:exceso de )?${_MECANISMO_PALABRA}(?![\\wáéíóúñ])`, "gi"),   // «lo que más pesa es la carga»
  new RegExp(`(?<![\\wáéíóúñ])(?:la |el |las |los )?${_MECANISMO_PALABRA}\\s+(?:pesa|pesan|importa|importan|cuenta|cuentan|manda|mandan)\\s+m[aá]s(?![\\wáéíóúñ])`, "gi"),   // «la carga pesa más (que el precio)»
];
/* la jerarquía SÍ se dice cuando la parte del efecto está medida y citada: «efecto carga −1.0 pp contra efecto costo −0.5 pp» */
/* …y EN DINERO (owner 2026-09-13): con la brecha partida en la boleta, «precio/costo pesa más: $4.4M contra $588K» es una
 * jerarquía MEDIDA — las dos partes de un mismo universo, citadas. La forma «de los $4.9M, $588K …» también. */
const _MEDIDA_DE_PESO = /(?:efecto|aporte|peso|parte)\s+(?:de\s+)?(?:la\s+|el\s+|del\s+)?(?:carga|costo|precio|volumen|mix|acciones)[^.;]{0,30}?\d+(?:[.,]\d+)?\s*(?:pp|%)|\d+(?:[.,]\d+)?\s*(?:pp|%)\s+(?:de la|del|de los|de las)\s+(?:brecha|efecto|ca[ií]da|diferencia|total|resultado)|\d+(?:[.,]\d+)?\s*(?:pp|%)\s+(?:contra|frente a|versus|vs\.?)\s+[^.;]{0,20}?\d+(?:[.,]\d+)?\s*(?:pp|%)|\$\s?\d+(?:[.,]\d+)?\s?[KMB]?\s+(?:contra|frente a|versus|vs\.?)\s+[^.;]{0,30}?\$\s?\d+(?:[.,]\d+)?\s?[KMB]?|\$\s?\d+(?:[.,]\d+)?\s?[KMB]?[^.;]{0,40}?\b(?:de los|de las|del|dentro de los|de es[oa]s?)\s+\$\s?\d+(?:[.,]\d+)?\s?[KMB]?|\bde (?:los|las|es[oa]s?)\s+\$\s?\d+(?:[.,]\d+)?\s?[KMB]?[^.;]{0,60}?\$\s?\d+(?:[.,]\d+)?\s?[KMB]?/i;
const _sinParentesis = (s) => String(s).replace(/—[^—]*—/g, " ").replace(/\([^)]*\)/g, " ");
function _jerarquiaCausalSinMedida(texto, figs = null) {
  /* la partición medida, si viaja en la boleta: los dos subtotales del mismo universo (carga · precio y costo) */
  const _particion = (() => {
    if (!Array.isArray(figs)) return null;
    const c = figs.find((f) => /^Carga comercial alta · subtotal · \d+ cuentas materiales/i.test(String(f && f.label || "")));
    const r = figs.find((f) => /^Brecha por precio y costo · subtotal · \d+ cuentas materiales/i.test(String(f && f.label || "")));
    return c && r ? `${c.label} = ${c.text || c.value} · ${r.label} = ${r.text || r.value}` : null;
  })();
  for (const oracion0 of String(texto).split(/(?<=[.!?])\s+|\n+/)) {
    if (/[¿?]/.test(oracion0) || _PREGUNTA_O_LIMITE.test(oracion0) || _MEDIDA_DE_PESO.test(oracion0)) continue;
    const oracion = _sinParentesis(oracion0);
    for (const re of _RE_JERARQUIA) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(oracion)) !== null) {
        const cl = _clausulaDe(oracion, m.index, m.index + m[0].length);
        if (_MARCA_NEGACION.test(cl) || _MARCA_SELLO.test(cl)) continue;   // «no parece la causa principal», «podría ser el mecanismo principal»
        if (/(?:no|ni|tampoco|sin|nunca)\s+(?:[\wáéíóúñ]+\s+){0,3}$/i.test(oracion.slice(Math.max(0, m.index - 40), m.index))) continue;   // «no es la causa principal»
        return _particion
          ? `«${m[0].trim()}» ordena las causas —jerarquía causal— sin citar la parte medida. La partición SÍ está en la boleta (${_particion}): cita las dos cifras en la misma oración y ahí sí puedes decir cuál pesa más — como componente conjunto «precio y costo», que el dato no separa. Lo probado es que el mecanismo EXISTE (su huella); su peso es esa cifra, no un adjetivo.`
          : `«${m[0].trim()}» ordena las causas —jerarquía causal— y este turno no midió qué parte del efecto explica cada mecanismo: lo probado es que el mecanismo EXISTE (su huella), no que sea el dominante ni el principal. Describe lo demostrado —«un mecanismo probado», «la huella más clara»— sin «dominante», «principal» ni «sobre todo», salvo con la parte del efecto medida en la boleta (efecto carga contra efecto costo, en pp).`;
      }
    }
  }
  return null;
}

/* ── UNIVERSOS CONSISTENTES: LA RELACIÓN ENTRE SUBTOTALES (owner 2026-09-13, sobre la corrida en vivo) ─────────────
 * Lo que salió: «La contribución no capturada de las 5 cuentas materiales suma $4.9M … De eso, $655K es contribución
 * cedida en acciones comerciales». Las dos cifras son ciertas y el muro las autorizó; lo falso era la RELACIÓN: los $655K
 * son la carga sobre el nivel en las 6 cuentas que la exceden (Easy, sana, incluida) — no viven dentro de los $4.9M. La
 * parte que sí vive ahí es otro subtotal ($588K, «· 5 cuentas materiales»). La ley: «una cifra solo puede presentarse
 * como parte de otra si realmente pertenece a su universo», transversal a cualquier par de subtotales.
 *
 * CÓMO SE SABE EL UNIVERSO: por el rótulo. Un subtotal es «<concepto> · subtotal[ · <universo>]» (o «<concepto> total»,
 * el negocio entero); una cifra de cuenta es «<cuenta> · <concepto>». Y (la contenida) cabe en X (el continente) si:
 *   (a) Y es un subtotal con EXACTAMENTE el mismo universo declarado (la brecha partida: carga y precio/costo «· 5 cuentas
 *       materiales (de 8…)» dentro de la contribución no capturada «· 5 cuentas materiales (de 8…)»);
 *   (b) Y es la cifra de una cuenta del MISMO concepto que X (Falabella · Contribución no capturada dentro del subtotal
 *       de contribución no capturada): la cuenta es miembro porque tiene su fila;
 *   (c) Y es la cifra de una cuenta de OTRO concepto, pero esa cuenta tiene su fila del concepto de X y ese otro concepto
 *       tiene subtotal en el mismo universo (Falabella · Carga comercial alta dentro de los $4.9M: es la parte de carga de
 *       una cuenta material);
 *   (d) X es la cifra de una cuenta: Y tiene que ser de la MISMA cuenta.
 * Cualquier otra cosa —dos universos distintos, un subtotal sin universo dentro de otro, un total del negocio dentro de un
 * recorte— arde, nombrando el universo real de cada uno y, si existe, la cifra que sí cabe. La forma que se juzga es la
 * de contención («de eso», «de ellos», «de los cuales», «dentro de esa brecha», «$Y de los $X»); una cifra dicha APARTE
 * («además, $655K…») no es una relación y no se toca. */
const _MARCA_CONTIENE = /(?<![\wáéíóúñ])(?:de es[oa]s?|de ell[oa]s|de los cuales|de las cuales|de ese (?:total|subtotal|monto)|de esa (?:cifra|brecha|suma|contribuci[oó]n)|dentro de (?:es[oa]s?|ell[oa]s|los|las|esa brecha|ese (?:total|subtotal|monto)|la brecha|el subtotal))(?![\wáéíóúñ])/gi;
const _MONTO_RE = /\$\s?\d+(?:[.,]\d+)?\s?[KMB]?(?![\wáéíóúñ%])/g;
const _partesDe = (label) => String(label || "").split("·").map((x) => x.trim()).filter(Boolean);
/* la ficha de una fig: subtotal (concepto + universo), total del negocio (concepto), o cuenta (entidad + concepto) */
/* ── LA FICHA LLEVA SU GRUPO Y SU UNIVERSO DE TIPO, Y UN CONCEPTO SOLO ES UN TOTAL (owner 2026-09-14, grupos, conteos, universos e
 * inventos — el conjunto adversarial): «De los $25.0M de contribución, $19.4M son de Falabella» pasaba porque «Contribución = $25.0M» no
 * lleva «· total» y no tenía ficha (y sin ficha no se juzgaba); «Del capital de $135K, $12.6M ya están vencidos» pasaba porque dos totales
 * «siempre se contienen». Ahora: un rótulo de UN segmento que no es el nombre de una cuenta es el total de ese concepto; la ficha trae
 * el grupo declarado por el emisor (`grupo.entidades`) —para que un subtotal quepa en el subtotal del mismo concepto que lo contiene
 * («$588K de las cinco materiales dentro de los $655K de las seis»)— y el universo del tipo (`tipo.universo`), para que un total de
 * inventario no contenga uno de cobranza. */
const _entMemo = new WeakMap();   // las entidades de la boleta, una vez por boleta
const _entidadesDeFigs = (figs) => {
  if (!Array.isArray(figs)) return new Set();
  if (!_entMemo.has(figs)) _entMemo.set(figs, new Set(figs.map((g) => _partesDe(String((g && g.label) || ""))).filter((p) => p.length === 2 && !/^(?:total|subtotal)$/i.test(p[1])).map((p) => p[0].toLowerCase())));
  return _entMemo.get(figs);
};
const _normE = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
function _fichaDeFig(f, figs) {
  const L = String((f && f.label) || "");
  const p = _partesDe(L);
  const grupo = f && f.grupo && Array.isArray(f.grupo.entidades) && f.grupo.entidades.length ? new Set(f.grupo.entidades.map(_normE)) : null;
  const universoTipo = f && f.tipo && typeof f.tipo.universo === "string" ? f.tipo.universo : null;
  if (p.length >= 2 && /^subtotal$/i.test(p[1])) return { tipo: "subtotal", concepto: p[0].toLowerCase(), universo: p.slice(2).join(" · ").toLowerCase() || "", label: L, grupo, universoTipo };
  if (p.length === 1 && /\btotal\b/i.test(p[0])) return { tipo: "total", concepto: p[0].replace(/\s*total\s*/i, " ").trim().toLowerCase(), universo: "negocio", label: L, grupo, universoTipo };
  if (p.length === 2 && /^(?:total|subtotal)$/i.test(p[1])) return { tipo: "total", concepto: p[0].toLowerCase(), universo: "negocio", label: L, grupo, universoTipo };
  if (p.length === 2) return { tipo: "cuenta", entidad: p[0].toLowerCase(), concepto: p[1].toLowerCase(), label: L, grupo, universoTipo };
  /* un solo segmento con métrica reconocible que no es una cuenta («Contribución», «Ventas del período», «Estado del inventario: capital frenado») */
  /* …sin dígitos ni recortes en el rótulo: «Resto de Contribución (3 de 13)», «Medida · …», «headline» no son el total de nada */
  if (p.length === 1 && metricasEn(p[0]).size && !/\d|^(?:resto|medida|umbral|headline)/i.test(p[0]) && !_entidadesDeFigs(figs).has(p[0].toLowerCase())) return { tipo: "total", concepto: p[0].toLowerCase(), universo: "negocio", label: L, grupo, universoTipo };
  return null;
}
function _figsDelMonto(texto, figs) {
  /* cada monto del texto → las figs money con ese valor formateado (puede haber varias: el mismo $194K en dos rótulos) */
  const out = [];
  let m;
  _MONTO_RE.lastIndex = 0;
  while ((m = _MONTO_RE.exec(texto))) {
    const v = m[0].replace(/\s+/g, "");
    const match = figs.filter((f) => f && f.unit === "money" && String(f.text || f.value || "").replace(/\s+/g, "") === v);
    out.push({ idx: m.index, fin: m.index + m[0].length, valor: v, figs: match });
  }
  return out;
}
/* un concepto OPACO del rótulo («Valor», «Monto», «Cifra»): no dice qué es la cifra, así que no puede contradecir a nadie */
const _CONCEPTO_OPACO = /^(?:valor|monto|cifra|importe|total|dato)$/i;
/* el prefijo común vale cuando lo que sobra es un marco («ventas del período» ⊃ «venta», «venta (flujo)»), no un calificador que cambia el concepto
 * («contribución no capturada» NO es parte de «contribución»: la brecha es una estimación; «carga comercial alta» no es «carga comercial») */
const _extraDeMarco = (largo, corto) => !/\b(?:no|sin|brecha|alta|excedid|frenad|san[oa]|riesgo|sobrestock|inmoviliz)\b/i.test(largo.slice(corto.length));
const _mismoConcepto = (a, b) => a === b || (a.startsWith(b) && _extraDeMarco(a, b)) || (b.startsWith(a) && _extraDeMarco(b, a)) || _CONCEPTO_OPACO.test(a) || _CONCEPTO_OPACO.test(b);
/* el subconjunto declarado: el grupo de Y dentro del grupo de X (los emisores publican `grupo.entidades`) */
const _grupoDentro = (fy, fx) => !!(fy.grupo && fx.grupo && fy.grupo.size <= fx.grupo.size && [...fy.grupo].every((e) => fx.grupo.has(e)));
/* dos universos de TIPO que no reconcilian (inventario contra venta/cobranza): ninguna cifra de uno es parte de una del otro */
const _universosDivergen = (fy, fx) => !!(fy.universoTipo && fx.universoTipo && fy.universoTipo !== fx.universoTipo && reconcilian(fy.universoTipo, fx.universoTipo).estado === "divergent");
function _cabeEn(fy, fx, figs) {
  if (!fy || !fx) return true;   // sin ficha no se juzga (criterio nítido: falso negativo antes que falso positivo)
  const hay = (ent, concepto) => figs.some((g) => { const c = _fichaDeFig(g, figs); return c && c.tipo === "cuenta" && c.entidad === ent && c.concepto === concepto; });
  const haySubtotal = (concepto, universo) => figs.some((g) => { const c = _fichaDeFig(g, figs); return c && c.tipo === "subtotal" && c.concepto === concepto && c.universo === universo; });
  if (fx.tipo === "subtotal") {
    /* (a) el mismo universo, o el MISMO CONCEPTO con el grupo de Y dentro del grupo de X («$588K de las cinco materiales» dentro de
     * «$655K de las seis sobre el nivel»: el emisor declara los dos grupos y uno contiene al otro — owner 2026-09-14) */
    if (fy.tipo === "subtotal") return (fy.universo === fx.universo && fy.universo !== "") || (fy.concepto === fx.concepto && _grupoDentro(fy, fx));   // (a)
    /* (b) la cuenta con la misma métrica dentro del subtotal; (c) con otra métrica, solo si esa cuenta tiene el concepto del subtotal y su
     * métrica tiene subtotal en el mismo universo; …y la cuenta que el GRUPO del subtotal declara como miembro, con concepto igual u opaco
     * («$67K a Easy» dentro de los $655K de las seis, con «Easy · Monto»: el rótulo no dice qué es, el grupo dice que Easy está adentro) */
    if (fy.tipo === "cuenta") {
      if (fx.grupo && fx.grupo.has(_normE(fy.entidad)) && _mismoConcepto(fy.concepto, fx.concepto)) return true;
      return fy.concepto === fx.concepto ? hay(fy.entidad, fx.concepto)                                  // (b)
        : (hay(fy.entidad, fx.concepto) && haySubtotal(fy.concepto, fx.universo));                       // (c)
    }
    return false;   // un total del negocio no cabe en un recorte
  }
  if (fx.tipo === "total") {
    if (fy.tipo === "cuenta") return _mismoConcepto(fy.concepto, fx.concepto);
    if (fy.tipo === "subtotal") return fy.concepto === fx.concepto || _CONCEPTO_OPACO.test(fy.concepto);   // «$4.9M no capturados» NO son parte de la «Contribución» ($25.0M): la brecha es una estimación, otro universo (candado del contrato)
    /* un total dentro de otro total («de lo pendiente, lo vencido»): la jerarquía entre conceptos es del dominio, no del rótulo — salvo que
     * los TIPOS declaren universos que no reconcilian («Del capital de $135K, $12.6M ya están vencidos»: inventario contra cobranza) */
    return !_universosDivergen(fy, fx);
  }
  if (fx.tipo === "cuenta") return fy.tipo === "cuenta" && fy.entidad === fx.entidad;                    // (d)
  return true;
}
function _subtotalDeOtroUniverso(texto, figs) {
  if (!Array.isArray(figs) || !figs.length) return null;
  const t = String(texto || "");
  const montos = _figsDelMonto(t, figs);
  if (!montos.length) return null;
  const pares = [];
  /* LA CONTENIDA VA PEGADA A LA MARCA (owner 2026-09-14, grupos, conteos, universos e inventos — fp-listas P8): «Dos frenados están en
   * Valparaíso ($25K de esa bodega) y uno en Antofagasta ($8K)» leía «de esa» como continente de los $8K de la cláusula siguiente: el «de
   * esa» de «$25K de esa bodega» va seguido de un sustantivo, no de una cifra. La parte tiene que seguir a la marca (con una coma, un
   * artículo, un matiz —«solo», «casi la mitad»— o un paréntesis entre medio), nunca un sustantivo ni otra cláusula. */
  const _PUENTE_A_LA_PARTE = /^[\s,]*(?:(?:solo|s[oó]lo|apenas|unos|unas|casi|cerca de|alrededor de|m[aá]s de|menos de|el|la|los|las|un|una|otros|otras|hay|son|est[aá]n|ya|la mitad|un tercio|dos tercios|tres cuartos|la mayor parte|el grueso|la mitad de|poco m[aá]s de|poco menos de)\s*){0,4}\(?\s*$/i;
  /* forma 1: «$X … de eso / de los cuales … $Y» (el continente antes de la marca, la contenida después) */
  let m;
  _MARCA_CONTIENE.lastIndex = 0;
  while ((m = _MARCA_CONTIENE.exec(t))) {
    const previos = [...montos].reverse().filter((x) => x.fin <= m.index && m.index - x.fin <= 220);
    const esAgregado = (x) => x.figs.some((g) => { const c = _fichaDeFig(g, figs); return c && (c.tipo === "subtotal" || c.tipo === "total"); });
    /* «…Easy $2.0M. De eso, $12.6M…»: el «eso» es el total dicho antes, no el último ítem de la lista. El continente es el
     * agregado más cercano hacia atrás; una cifra de cuenta solo cuenta si no hay agregado y está en la MISMA oración. */
    /* …salvo la cifra de SU CLÁUSULA (prueba 1, tercera corrida viva · 2026-09-14): «Lider: $9.8M de saldo pendiente, de eso
     * $4.6M vencidos» — el continente era el $135K del inventario, a 200 caracteres y un párrafo de distancia, y no el $9.8M de al
     * lado. El «eso» apunta a la última cifra dicha en la MISMA CLÁUSULA (lector de cláusula, owner 2026-09-14: cortada por
     * punto, punto y coma, dos puntos, raya y salto de línea; un paréntesis es otra cláusula). La lista del composer
     * («Easy $2.0M⏎De eso, $12.6M…») cambia de línea y «De eso, $588K…» abre oración: ahí sigue mandando el agregado dicho antes. */
    const agregado = previos.find(esAgregado);
    const cuentaMisma = previos[0] && !/[.!?]\s/.test(t.slice(previos[0].fin, m.index)) ? previos[0] : null;
    const _L = leerClausula(t, m.index);
    const pegada = previos.find((x) => x.idx >= _L.clausula.ini && x.fin <= m.index) || null;
    const antes = pegada || agregado || cuentaMisma || null;
    const finMarca = m.index + m[0].length;
    /* «$25K de esos $33K», «$588K dentro de los $655K»: la marca plural seguida de la cifra es la forma 2 (el continente va DESPUÉS) */
    if (/(?:de es[oa]s|dentro de l[oa]s)$/i.test(m[0]) && /^\s*\$/.test(t.slice(finMarca, finMarca + 4))) continue;
    const despues = montos.find((x) => x.idx >= finMarca && x.idx - finMarca <= 60 && _PUENTE_A_LA_PARTE.test(t.slice(finMarca, x.idx)));
    if (antes && despues) pares.push({ x: antes, y: despues, marca: m[0] });
  }
  /* forma 2: «$Y de los $X» / «$Y dentro de los $X» / «$Y sobre los $X» */
  for (let i = 0; i + 1 < montos.length; i++) {
    const y = montos[i], x = montos[i + 1];
    const entre = t.slice(y.fin, x.idx);
    if (entre.length <= 45 && /^\s*(?:[^.;\n$]{0,25}?)\b(?:de los|de las|del|dentro de los|dentro de las|sobre los|sobre las|de un total de|de esos|de esas)\s*$/i.test(entre)) pares.push({ x, y, marca: entre.trim() });
  }
  /* forma 3: la oración abre con el continente — «De la contribución total de $X, $Y no se capturan» · «De los $X de Falabella, $Y es carga» */
  const _nombresCuenta = compilarNombres([...new Set(figs.map((g) => _fichaDeFig(g, figs)).filter((c) => c && c.tipo === "cuenta" && c.entidad).map((c) => c.entidad))]);
  const _nombrada = (z) => { const L = leerClausula(t, z.idx, { nombresRe: _nombresCuenta }); return !!(L.sujetoPropio && L.sujeto && z.figs.some((g) => { const c = _fichaDeFig(g, figs); return c && c.tipo === "cuenta" && String(c.entidad).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() === L.sujeto.nombre; })); };   // el sujeto propio de la cifra, en su cláusula, es su propia cuenta (lector de cláusula)
  /* la ENUMERACIÓN de partes («De los $12.6M vencidos, $4.6M son de Lider y $5.1M de Jumbo»): cada cifra que sigue a la primera parte
   * unida por coma o «y» —sin «que», «con», «contra», un paréntesis ni otra cláusula entre medio— es otra parte del mismo continente
   * (owner 2026-09-14, universos: el $5.1M es el PENDIENTE de Jumbo, no un vencido, y antes no se juzgaba) */
  const _partesSiguientes = (y, finOracion) => {
    const out = [];
    let ultimo = y;
    for (const z of montos) {
      if (z.idx <= ultimo.idx || z.idx >= finOracion) continue;
      const entre = t.slice(ultimo.fin, z.idx);
      if (!/^[^.;:()—–$\n]{0,45}$/.test(entre) || /(?<![\wáéíóúñ])(?:que|con|contra|frente|vs|versus|sobre|entre|hasta|desde|por|menos|salvo|excepto)(?![\wáéíóúñ])/i.test(entre) || !/(?:,|\s(?:y|e))\s*(?:\S+\s+){0,3}$/i.test(entre)) break;
      out.push(z);
      ultimo = z;
    }
    return out;
  };
  for (const o of t.split(/(?<=[.!?])\s+|\n+/)) {
    const m3 = /^\s*(?:De|Del|De la|De los|De las)\b[^$.;\n]{0,50}?(\$\s?\d+(?:[.,]\d+)?\s?[KMB]?)[^$.;\n]{0,40}?,\s*[^$.;\n]{0,25}?(\$\s?\d+(?:[.,]\d+)?\s?[KMB]?)/.exec(o);
    if (!m3) continue;
    const base = t.indexOf(o);
    const x = montos.find((z) => z.idx === base + m3.index + m3[0].indexOf(m3[1])), y = montos.find((z) => z.idx === base + m3.index + m3[0].lastIndexOf(m3[2]));
    if (!x || !y || x === y) continue;
    /* «De los 5 SKU que más venden (SAM-TV55 $13.3M, LG-WASH11KG $12.4M, …)» (prueba 1, tercera corrida viva · 2026-09-14): la
     * oración abre con «De los», pero las dos cifras son una ENUMERACIÓN, cada una con su dueño pegado delante — nadie dijo que
     * $12.4M sea parte de $13.3M. Una cifra precedida por el nombre de su propia cuenta no es un continente ni una contenida. */
    if (_nombrada(x) && _nombrada(y)) continue;
    pares.push({ x, y, marca: o.trim().slice(0, 20) + "…" });
    for (const z of _partesSiguientes(y, base + o.length)) pares.push({ x, y: z, marca: o.trim().slice(0, 20) + "…" });
  }
  /* forma 4: el continente dicho EN PALABRAS, sin cifra — «Del vencido total, $33K corresponden a inventario sin rotar», «Del saldo
   * vencido, $4.6M están en Lider» (owner 2026-09-14, universos): el concepto del continente se lee con el vocabulario del muro y la
   * parte tiene que ser de ese concepto (o de un rótulo opaco). Solo cuando el concepto es reconocible y la parte tiene ficha. */
  const _partesEnPalabras = [];
  for (const o of t.split(/(?<=[.!?])\s+|\n+/)) {
    const m4 = /^\s*(?:De|Del|De la|De los|De las)\s+((?:[^$.;,\n\d]){3,60}?),\s*(?:[^$.;\n]{0,25}?)(\$\s?\d+(?:[.,]\d+)?\s?[KMB]?)/.exec(o);
    if (!m4) continue;
    /* «De esa brecha, $588K corresponde a carga excedida»: el demostrativo remite a una cifra dicha antes — eso lo juzga la forma 1 con esa cifra;
     * acá solo el continente nombrado por su concepto («Del vencido total», «De la contribución») */
    if (/^\s*(?:es[aeo]s?|est[aeo]s?|aquel(?:la|los|las)?|dich[oa]s?|ell[oa]s|mism[oa]s?)\b/i.test(m4[1]) || /\b(?:es[aeo]s?|est[aeo]s?|dich[oa]s?)\s+\p{L}+\s*$/iu.test(m4[1])) continue;
    const claves = metricasEn(m4[1]);
    if (!claves.size) continue;
    const base = t.indexOf(o);
    const y = montos.find((z) => z.idx === base + m4.index + m4[0].lastIndexOf(m4[2]));
    if (!y || !y.figs.length) continue;
    _partesEnPalabras.push({ y, continente: m4[1].trim(), claves, finOracion: base + o.length });
  }
  /* forma 5: la SUMA EN PALABRAS de dos universos — «Entre el vencido de Lider ($4.6M) y el capital frenado ($33K), hay $4.6M inmovilizados»,
   * «el vencido ($4.6M) y el frenado ($33K) suman $4.6M» (owner 2026-09-14, universos): dos montos de universos que no reconcilian nunca van
   * juntos; la suma dicha entre los dos es la relación prohibida aunque la cifra resultante coincida con una real */
  {
    const M = "(\\$\\s?\\d+(?:[.,]\\d+)?\\s?[KMB]?)";
    const re5 = new RegExp(`(?:entre\\s+[^$.;\\n]{0,50}?${M}\\)?[^$.;\\n]{0,30}?\\s+y\\s+[^$.;\\n]{0,50}?${M}\\)?[^$.;\\n]{0,10}?,?\\s*(?:hay|suman|son|totalizan|dan|acumulan|juntan|llegan a|hacen)\\s+[^$.;\\n]{0,20}?${M}|${M}\\)?[^$.;\\n]{0,40}?\\s+(?:y|m[aá]s)\\s+[^$.;\\n]{0,50}?${M}\\)?[^$.;\\n]{0,10}?\\s+(?:suman|totalizan|dan|acumulan|juntan|hacen)\\s+[^$.;\\n]{0,20}?${M})`, "giu");
    let m5;
    while ((m5 = re5.exec(t))) {
      const [a, b, c] = m5[1] ? [m5[1], m5[2], m5[3]] : [m5[4], m5[5], m5[6]];
      const enTramo = montos.filter((z) => z.idx >= m5.index && z.idx < m5.index + m5[0].length);
      const fa = enTramo.find((z) => z.valor === a), fb = enTramo.find((z) => z.valor === b);
      if (!fa || !fb || !fa.figs.length || !fb.figs.length) continue;
      const fichasA = fa.figs.map((g) => _fichaDeFig(g, figs)).filter(Boolean), fichasB = fb.figs.map((g) => _fichaDeFig(g, figs)).filter(Boolean);
      if (!fichasA.length || !fichasB.length) continue;
      if (fichasA.some((x) => fichasB.some((y) => !_universosDivergen(x, y)))) continue;   // alguna combinación es del mismo universo (o sin universo declarado): no se juzga acá
      const ux = fichasA[0], uy = fichasB[0];
      return `sumas «${a}» (${ux.label}) con «${b}» (${uy.label}) para llegar a «${c}»: son dos universos que no reconcilian (${ux.universoTipo} y ${uy.universoTipo}) y dos montos de universos distintos nunca van juntos — di cada uno con su universo y no los sumes.`;
    }
  }
  const _NEGADA = /(?<![\wáéíóúñ])no\s+(?:es|son|est[aá]n?|forma[n]?\s+parte|vive[n]?|cabe[n]?|pertenece[n]?|entra[n]?)(?![\wáéíóúñ])/i;
  for (const par of pares) {
    if (!par.x.figs.length || !par.y.figs.length) continue;   // una cifra no autorizada la cobra el muro; acá se juzga la relación entre autorizadas
    const lo = Math.min(par.x.fin, par.y.fin), hi = Math.max(par.x.idx, par.y.idx);
    if (_NEGADA.test(t.slice(lo, hi))) continue;   // «no es parte de los $4.9M»: negar la relación es justo lo que se pide
    /* con varias figs por valor, la relación vale si ALGUNA combinación cabe (el mismo $194K es «Falabella · Carga comercial alta» en dos rótulos).
     * Se juzgan las fichas que EXISTEN: una fig sin ficha no absuelve a las demás («Estado del inventario: capital frenado = $33K» dejaba pasar
     * «De los $33K frenados, $4.6M están vencidos en Lider» — owner 2026-09-14); sin ninguna ficha de un lado, no se juzga. */
    const fichasX = par.x.figs.map((g) => _fichaDeFig(g, figs)).filter(Boolean), fichasY = par.y.figs.map((g) => _fichaDeFig(g, figs)).filter(Boolean);
    if (!fichasX.length || !fichasY.length) continue;
    const cabe = fichasX.some((fx) => fichasY.some((fy) => _cabeEn(fy, fx, figs)));
    if (cabe) continue;
    const _prefiere = (fichas) => fichas.find((c) => c.tipo === "subtotal") || fichas.find((c) => c.tipo === "total") || fichas[0] || null;
    const fx = _prefiere(fichasX), fy = _prefiere(fichasY);
    if (!fx || !fy) continue;
    const universoDe = (f) => (f.tipo === "subtotal" ? `de ${f.universo || "un universo sin declarar"}` : f.tipo === "total" ? "del negocio entero" : `de la cuenta ${f.entidad}`);
    /* la cifra que SÍ cabe, si existe: el subtotal del concepto de Y en el universo de X */
    const alternativa = fx.tipo === "subtotal" && fy.tipo === "subtotal"
      ? figs.find((g) => { const c = _fichaDeFig(g, figs); return c && c.tipo === "subtotal" && c.concepto === fy.concepto && c.universo === fx.universo; }) : null;
    return `presentas «${par.y.valor}» (${fy.label}) como parte de «${par.x.valor}» (${fx.label}) —«${par.marca.trim()}»— y no pertenece a ese universo: ${par.x.valor} es ${universoDe(fx)} y ${par.y.valor} es ${universoDe(fy)}. ${alternativa ? `La parte que sí cabe es «${alternativa.label} = ${alternativa.text || alternativa.value}».` : "Preséntalas aparte, cada una con su universo."} Una cifra solo es parte de otra si pertenece a su mismo universo.`;
  }
  for (const p of _partesEnPalabras) {
    const partes = [p.y, ..._partesSiguientes(p.y, p.finOracion)];
    for (const y of partes) {
      if (!y.figs.length) continue;
      const fichas = y.figs.map((g) => _fichaDeFig(g, figs)).filter(Boolean);
      if (!fichas.length) continue;
      if (_NEGADA.test(t.slice(p.y.idx - 40 > 0 ? p.y.idx - 40 : 0, y.idx))) continue;
      /* cabe si alguna ficha de la parte comparte una clave con el continente, o su concepto es opaco */
      const cabe = fichas.some((c) => _CONCEPTO_OPACO.test(c.concepto) || [...metricasEn(c.concepto)].some((k) => p.claves.has(k)));
      if (cabe) continue;
      const fy = fichas.find((c) => c.tipo === "cuenta") || fichas[0];
      return `presentas «${y.valor}» (${fy.label}) como parte de «${p.continente}» y no es de ese concepto: ${y.valor} es ${fy.tipo === "cuenta" ? `${fy.concepto} de la cuenta ${fy.entidad}` : fy.concepto}. Una cifra solo es parte de otra si pertenece a su mismo universo — nombra la parte que sí lo es o preséntalas aparte.`;
    }
  }
  return null;
}

/* ── PRECIO Y COSTO NO SE SEPARAN (owner 2026-09-13) ──────────────────────────────────────────────────────────────
 * «Precio/costo puede dominar como componente conjunto si está medido; ADI no debe separar cuánto corresponde a precio y
 * cuánto a costo si esa separación no existe.» La cifra «Brecha por precio y costo» es un resto conjunto: narrarla como
 * «$4.4M de precio de lista» o «$4.4M por costo» le inventa una separación que el dato no tiene. */
function _precioYCostoSeparados(texto, figs) {
  if (!Array.isArray(figs) || !figs.length) return null;
  const t = String(texto || "");
  const conjuntas = figs.filter((f) => f && f.unit === "money" && /precio y costo/i.test(String(f.label || "")));
  if (!conjuntas.length) return null;
  for (const f of conjuntas) {
    const v = String(f.text || f.value || "").replace(/\s+/g, "");
    if (!v) continue;
    let i = -1;
    while ((i = t.indexOf(v, i + 1)) >= 0) {
      const ventana = t.slice(Math.max(0, i - 70), Math.min(t.length, i + v.length + 70));
      const dicePrecio = /\bprecio/i.test(ventana), diceCosto = /\bcosto/i.test(ventana);
      if (dicePrecio !== diceCosto && (/(?:de|del|por|en|es|son|corresponde[n]? al?|viene[n]? del?|explica[n]?|atribuible[s]? al?)\s+(?:el |la |un |una |su |tu )?(?:precio|costo)/i.test(ventana) || /(?:precio|costo)\s*(?:de lista\s*)?:\s*\$/i.test(ventana))) {
        return `«${v}» es «${f.label}»: un resto CONJUNTO de precio de lista y costo, que este dato no separa — narrarlo como ${dicePrecio ? "precio" : "costo"} solo le inventa una separación. Di «precio y costo» (o «precio/costo»), y si hace falta explica que el dato no los distingue.`;
      }
    }
  }
  return null;
}

/* ── LA CUENTA DERIVADA QUE NO CIERRA (owner 2026-09-11, batería compuesta · «comercial») ──────────────────
 * Lo que salió: «$4.9M de contribución no capturada en el año — casi un punto de venta anual completo». La
 * venta del período es $99.9M: son casi CINCO puntos. Una equivalencia («N puntos de venta», «X% de Y») es una
 * cuenta, y toda cuenta se verifica contra la boleta del turno: si la base no está en la boleta, la
 * equivalencia no se puede sostener y no va; si está y no cierra, se multa con el número correcto. */
const _NUM_PALABRA = { medio: 0.5, media: 0.5, un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
const _MONTO = /\$\s?(\d+(?:[.,]\d+)?)\s?([KMB])?(?![\wáéíóúñ%])/gi;
const _montoNum = (s) => { const m = /\$\s?(\d+(?:[.,]\d+)?)\s?([KMB])?/i.exec(s); if (!m) return NaN; return Number(m[1].replace(",", ".")) * ({ K: 1e3, M: 1e6, B: 1e9 }[(m[2] || "").toUpperCase()] || 1); };
const _PUNTOS_DE_VENTA = /\b(?:casi|cerca de|m[aá]s de|menos de|alrededor de|apenas|unos?|equivale a|representa|es)?\s*(medio|media|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d+(?:[.,]\d+)?)\s+puntos?(?:\s+porcentuales?)?\s+(?:de|del|sobre)\s+(?:la\s+|las\s+|tu\s+)?(?:venta|ventas|facturaci[oó]n)\b/i;
/* la proporción se cobra solo en su forma EXPLÍCITA —«A de los B … (es|vive|representa) el N%»—: entre B y el
 * porcentaje no puede haber un «que» (una relativa cambia de sujeto: «$25K de los $48K QUE concentran el 80%»
 * habla del 80% de los $48K, no de $25K/$48K — corpus aceptado del examen 2) */
const _PCT_DE = /(\$\s?\d+(?:[.,]\d+)?\s?[KMB]?)\b[^.;\n]{0,40}?\b(?:de|del|de los|de las|sobre)\s+(?:los\s+|las\s+)?(\$\s?\d+(?:[.,]\d+)?\s?[KMB]?)\b((?:(?!\bque\b)[^.;\n]){0,60}?)\b(\d+(?:[.,]\d+)?)\s*%/i;
function _cuentaDerivada(texto, figs) {
  const F = Array.isArray(figs) ? figs : [];
  for (const oracion of String(texto).split(/(?<=[.!?])\s+|\n+/)) {
    const pv = _PUNTOS_DE_VENTA.exec(oracion);
    if (pv) {
      const montos = [...oracion.matchAll(_MONTO)].map((m) => _montoNum(m[0])).filter((n) => Number.isFinite(n) && n > 0);
      if (montos.length) {
        const declarado = _NUM_PALABRA[pv[1].toLowerCase()] ?? Number(pv[1].replace(",", "."));
        const base = F.find((f) => /^Ventas? del per[ií]odo$/i.test(String(f && f.label)) && Number.isFinite(f.raw) && f.raw > 0);
        if (!base) return `dices «${pv[0].trim()}» sobre ${montos.length === 1 ? "un monto" : "montos"} de esta respuesta, y la venta total no está en la evidencia de este turno: una equivalencia es una cuenta, y sin la base en la boleta no se puede sostener. Quita la equivalencia o léela primero.`;
        const puntos = (100 * montos[0]) / base.raw;
        if (Math.abs(puntos - declarado) > Math.max(0.6, 0.25 * puntos)) return `dices «${pv[0].trim()}» y no cierra: ${_fmtMonto(montos[0])} sobre ${base.text || base.value} de venta son ${puntos.toFixed(1)} puntos, no ${declarado}. La equivalencia se calcula, no se estima.`;
      }
    }
    const pd = _PCT_DE.exec(oracion);
    if (pd) {
      const a = _montoNum(pd[1]), b = _montoNum(pd[2]), pct = Number(pd[4].replace(",", "."));
      if (Number.isFinite(a) && Number.isFinite(b) && b > 0 && Number.isFinite(pct)) {
        const real = (100 * a) / b;
        if (Math.abs(real - pct) > 2) return `dices que ${pd[1].trim()} sobre ${pd[2].trim()} es ${pct}% y la cuenta da ${real.toFixed(0)}%. Una proporción se calcula con las dos cifras de la boleta, no se estima.`;
      }
    }
  }
  return null;
}
const _fmtMonto = (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n}`);

export function vetosDeContrato(texto, contexto = {}) {
  if (typeof texto !== "string" || !texto.trim()) return [];
  const v = [];

  const _q = String(contexto.pregunta || "");
  if (_q && _PIDE_PROYECCION.test(_q) && _CIFRA_SUPUESTO.test(_q) && !_OTRA_MEDIDA.test(_q) && !_CIFRA_DE_PLATA.test(texto)) {
    const _ents = Array.isArray(contexto.entidades) ? contexto.entidades : [];
    /* «esa manda» (owner): la entidad cuenta aunque el usuario escriba solo una parte de su nombre —«riachuelo»
     * por «Depósito Riachuelo»—, que es como se la nombra de verdad. Solo palabras largas: un token corto
     * apartaría la regla por casualidad. */
    const _tokens = (e) => String(e).split(/\s+/).filter((p) => p.length >= 5).concat([String(e)]);
    const nombraEntidad = _ents.some((e) => _tokens(e).some((p) =>
      new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(_q)));
    if (!nombraEntidad) {
      v.push({ regla: "proyeccion-sin-default",
        multa: "no le devuelvas la elección: cuando pide una proyección sobre «su» venta sin nombrar una entidad, el default es la VENTA TOTAL DEL NEGOCIO. Proyecta sobre el total, dilo («proyección sobre la venta total del negocio»), y ofrece el corte por cliente como alternativa si lo quiere." });
    }
  }
  v.push(...vetosDeRegistro(texto, contexto));
  const mInterno = texto.match(_internosRe());
  const _entsTexto = Array.isArray(contexto.entidades) ? contexto.entidades : [];
  const mCamel = texto.match(new RegExp(_CAMELCASE.source, "g"));
  const camelFugado = (mCamel || []).find((p) => esIdentificadorInterno(p, _entsTexto));
  const fugado = (mInterno && mInterno[1]) || camelFugado || null;
  if (fugado) {
    v.push({ regla: "identificador-interno", multa: `«${fugado}» es un nombre interno del sistema y no va a pantalla: describe la lectura o el límite en palabras del negocio.` });
  }
  /* ── UN CONJUNTO, UN ORDEN (owner 2026-09-11) ────────────────────────────────────────────────────────────
   * LO QUE SALIÓ EN SU PANTALLA: la prosa enumeró «Falabella, Lider, Jumbo y Sodimac» y la tabla de la misma
   * respuesta abría con Lider. Dos herramientas, dos órdenes sellados, los dos en una respuesta — y «el primero»
   * quedó ambiguo dentro de la propia respuesta: el humano leyó la tabla, el modelo su prosa. Cada orden era
   * correcto por separado; juntos son dos verdades. Se cobra SOLO la ENUMERACIÓN explícita («A, B, C y D» con
   * tres o más nombres del índice) cuyo orden contradice al de las filas de la tabla de la misma respuesta;
   * nombrar cuentas sueltas en la prosa, en cualquier orden, sigue siendo libre. */
  const dosOrdenes = _dosOrdenes(texto, _entsTexto);
  if (dosOrdenes) {
    v.push({ regla: "dos-ordenes", multa: `enumeras «${dosOrdenes.prosa.join(", ")}» y la tabla de la misma respuesta los muestra como «${dosOrdenes.tabla.join(", ")}». Un conjunto se presenta en UN orden: si el usuario dice «el primero», tiene que haber uno solo. Enumera en el orden de la tabla, o no enumeres.` });
  }
  /* la forma se juzga al cerebro, no a los peldaños: cierre, reparación y la poda de ese mismo texto */
  if (contexto.sitio === "cierre" || contexto.sitio === "reparacion" || contexto.sitio === "poda") v.push(...vetosDeFormato(texto, contexto));
  return v;
}

/* ── LA DENSIDAD EJECUTIVA (owner 2026-09-11, tras la batería en vivo de la Etapa 4) ────────────────────────
 * «Quiero cerrar esto como experiencia premium, no solamente como respuesta correcta.» Su regla, textual: la
 * densidad ejecutiva, no la brevedad por brevedad — tesis → evidencia mínima → criterio o siguiente paso. Y con
 * criterio CONTEXTUAL: si el usuario no pidió detalle, sin subtítulos, sin bloques largos, sin listas extensas;
 * una lista solo cuando ordena información o la pidieron; negrita para una conclusión puntual, no un informe
 * lleno de encabezados. Lo que salió en su batería: «¿Cómo va?» en 380 palabras con tres subtítulos en negrita,
 * el porqué en ~520 con cinco, y «¿qué harías primero?» volcando una lista de 8 clientes que nadie pidió.
 * NO se mide un número de palabras (su condición: un tope rígido deteriora la calidad): se mide la FORMA. La
 * mecánica es la de siempre —el veto da UNA oportunidad de reescribir (la reparación) y, si vuelve a incumplir,
 * responde el procedimiento determinístico, que ya habla bien—. Se juzga al cerebro, no a los peldaños. */
const _PIDE_DETALLE = /\bdetalle|\bdetallad|\bdesgl[oó]s|\ba fondo\b|\bcomplet[oa]\b|\buno por uno\b|\bcuenta por cuenta\b|\bcliente por cliente\b|\bsku por sku\b|\bpara el analista\b|\bcon todo\b|\bpaso a paso\b|\bm[aá]s (?:largo|extenso)\b|\bexti[eé]ndete\b|\bexpl[aá]yate\b/i;
const _PIDE_LISTA = /\bcu[aá]l(?:es)?\b|\bqui[eé]n(?:es)?\b|\bqu[eé] (?:clientes|cuentas|sku|productos|bodegas|familias|canales)\b|\branking\b|\btop\b|\blos (?:\d+|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b|\btod[oa]s\b|\bcada\b|\blista\b|\bl[ií]stame\b|\btabla\b|\ben vi[ñn]etas\b|\benum[eé]ra/i;
/* EL ENCARGO COMPUESTO ES UNA SOLICITUD DE PROFUNDIDAD (owner 2026-09-11): `esEncargoCompuesto` se movió SIN CAMBIAR UNA
 * COMA a partesDelEncargo.js (la hoja que comparten el ensamblador y este contrato) y acá se re-exporta. */
export const pideDetalle = (pregunta) => _PIDE_DETALLE.test(String(pregunta || "")) || esEncargoCompuesto(pregunta);
export const pideLista = (pregunta) => _PIDE_LISTA.test(String(pregunta || ""));
const _ES_ITEM = /^\s*(?:[-·•*]|\d{1,2}[.)])\s+/;
/* un encabezado: «# Título», una línea que es SOLO un rótulo en negrita, o un rótulo en negrita que abre la
 * línea y se cierra con dos puntos («**Qué haría primero:** partiría por…»). La negrita en medio de una frase
 * («la cuenta es **Falabella**») no es encabezado: es énfasis, y una conclusión puntual puede llevarlo. */
const _ES_ENCABEZADO = (l) => /^\s*#{1,6}\s/.test(l)
  || /^\s*(?:[-·•*]\s+|\d{1,2}[.)]\s+)?\*\*[^*\n]{2,100}\*\*\s*:?\s*$/.test(l)
  || /^\s*(?:[-·•*]\s+|\d{1,2}[.)]\s+)?\*\*[^*\n]{2,100}(?::\*\*|\*\*\s*:)/.test(l);
export const TOPE_ITEMS_SIN_PEDIR = 5;    // una lista de más de cinco ítems que nadie pidió es un informe
export const TOPE_PALABRAS_BLOQUE = 120;  // un solo párrafo de más de ciento veinte palabras es una pared
export function vetosDeFormato(texto, { pregunta = "" } = {}) {
  const t = String(texto || "");
  if (!t.trim()) return [];
  const q = String(pregunta || "");
  if (pideDetalle(q)) return [];                      // pidió detalle: los subtítulos y las listas son suyos
  const lineas = t.split(/\r?\n/);
  const motivos = [];
  /* una conclusión puntual en negrita pasa; dos rótulos ya son un informe. Cuando SÍ pidieron una lista
   * («los 3 riesgos y las 3 acciones»), dos secciones tituladas son la estructura que ordena — se toleran. */
  const lista = pideLista(q);
  const encabezados = lineas.filter(_ES_ENCABEZADO).length;
  if (encabezados > (lista ? 2 : 1)) motivos.push(`${encabezados} subtítulos`);
  const items = lineas.filter((l) => _ES_ITEM.test(l)).length;
  if (items > TOPE_ITEMS_SIN_PEDIR && !lista) motivos.push(`una lista de ${items} ítems que nadie pidió`);
  const largo = lineas.map((l) => (_ES_ITEM.test(l) || /^\s*\|/.test(l)) ? 0 : l.trim().split(/\s+/).filter(Boolean).length).find((n) => n > TOPE_PALABRAS_BLOQUE);
  if (largo) motivos.push(`un bloque de ${largo} palabras`);
  if (!motivos.length) return [];
  return [{ regla: "formato-de-informe",
    multa: `esto tiene forma de informe y nadie pidió detalle: ${motivos.join(" · ")}. La forma es densidad ejecutiva: la tesis en una frase, la evidencia mínima que la sostiene (una cifra, una vez) y el criterio o siguiente paso, en prosa. Sin subtítulos; una lista solo si ordena información o la pidieron; negrita, a lo sumo, para una conclusión puntual. El detalle se ofrece, no se despliega. Mismas cifras, misma conclusión.` }];
}

const _reNombreCont = (n) => new RegExp(`(?:^|[^\\wáéíóúñ])${String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\wáéíóúñ])`, "i");
function _dosOrdenes(texto, entidades) {
  const ents = (Array.isArray(entidades) ? entidades : []).filter(Boolean);
  if (ents.length < 3) return null;
  const lineas = String(texto).split(/\r?\n/);
  const filas = lineas.filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:|-]+\|?\s*$/.test(l));
  if (!filas.length) return null;
  const tabla = [];
  for (const f of filas) { const e = ents.find((n) => _reNombreCont(n).test(f)); if (e && !tabla.includes(e)) tabla.push(e); }
  if (tabla.length < 3) return null;
  /* la enumeración: «A, B, C y D» — nombres del índice separados por coma y cerrados con «y» */
  const prosa = lineas.filter((l) => !/^\s*\|/.test(l)).join("\n");
  const enumRe = /((?:[^,.\n;:]{2,60},\s*){2,}[^,.\n;:]{2,60}\s+y\s+[^,.\n;:]{2,60})/g;
  let m;
  while ((m = enumRe.exec(prosa)) !== null) {
    const partes = m[1].split(/,\s*|\s+y\s+/).map((s) => s.trim());
    /* cada parte ABRE con un nombre del índice («Sodimac explican la mayor parte» cuenta: el último ítem
     * arrastra el resto de la oración); una parte que no abre con nombre no es un ítem de la enumeración */
    const alInicio = (p) => ents.find((n) => new RegExp(`^${String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\wáéíóúñ])`, "i").test(p));
    const nombres = partes.map(alInicio).filter(Boolean);
    if (nombres.length < 3 || nombres.length !== partes.length) continue;
    if (!nombres.every((n) => tabla.includes(n))) continue;
    const enTabla = tabla.filter((n) => nombres.includes(n));
    if (enTabla.join("|") !== nombres.join("|")) return { prosa: nombres, tabla: enTabla };
  }
  return null;
}
