/* === src/adi/agente/formaConversacional.js · LA FORMA DE LA PREGUNTA MANDA (owner 2026-09-09) ================
 *
 * LA REGLA, palabra del owner, textual: «Antes de construir rutas nuevas, necesitamos que las puertas actuales
 * cedan cuando la pregunta es conversacional. Si la pregunta tiene forma de comparación, hipótesis, recuerdo,
 * decisión, acción o contradicción, no puede ser secuestrada por ficha de cliente ni por margen general. La
 * ficha de cliente solo debe ganar cuando el usuario pide realmente la ficha o el detalle de ese cliente.
 * Margen general solo debe ganar cuando la pregunta es de margen general, no cuando margen aparece dentro de
 * una comparación o tradeoff.»
 *
 * QUÉ CIERRA, medido en producción y reproducido offline. Tras un click en «Que ADI lo explique», durante ocho
 * turnos, TRES preguntas completamente distintas recibían la MISMA respuesta, palabra por palabra:
 *     «¿miro La Polar o Falabella?»              → «Falabella: venta $19.4M… ¿hubo un quiebre de stock?»
 *     «¿es cierto que Falabella me deja menos?»  → «Falabella: venta $19.4M… ¿hubo un quiebre de stock?»
 *     «recuerda que Falabella es apuesta mía»    → «Falabella: venta $19.4M… ¿hubo un quiebre de stock?»
 * La última lo delata entero: el usuario DECLARA algo suyo y recibe una ficha preguntándole por el stock.
 *
 * LA RAÍZ: ningún detector miraba la FORMA de la pregunta. Miraban léxico —«¿nombra una fila?», «¿dice
 * margen?»— y con eso se quedaban con el turno. Un censo de nueve rutas conversacionales encontró el mismo
 * mecanismo en siete de ellas: no faltaban rutas, sobraban dos puertas que se tragaban la conversación.
 *
 * ⚠️ ESTE MÓDULO NO RESPONDE NADA. Solo dice qué FORMA tiene la pregunta, para que las puertas que hoy
 * secuestran cedan el turno. Construir cada ruta es un trabajo aparte, y el owner lo ordenó así a propósito:
 * primero que dejen de responder mal, después que respondan bien.
 *
 * PURO · determinístico · sin estado · cero llamadas. */

const _FIN = "(?![\\wáéíóúñ])";

/* ── (1) COMPARAR ALTERNATIVAS · «¿miro A o B?» · «¿qué es más urgente, X o Y?» · «¿vendo más o protejo margen?»
 * La marca es la DISYUNTIVA con dos opciones, no la palabra «o» suelta («ventas o margen» sí; «el margen o su
 * evolución» también, y está bien que ceda: es una elección igual). Se exige una señal de elección —una
 * pregunta con «o» entre dos tramos cortos, «entre X e Y», «cuál primero», «más urgente», «vs»— para no
 * quedarse con toda frase que use la conjunción. */
const _COMPARAR = new RegExp([
  `\\bentre\\b[^.?!\\n]{2,40}\\by\\b`,
  `\\bcu[aá]l\\b[^.?!\\n]{0,30}\\bprimero${_FIN}`,
  `\\bqu[eé] es m[aá]s (?:urgente|importante|grave|prioritario|rentable)${_FIN}`,
  `\\bm[aá]s (?:urgente|importante|prioritario)\\b[^.?!\\n]{0,20},`,
  `\\bversus${_FIN}|\\bvs\\.?${_FIN}`,
  `\\bqu[eé] conviene m[aá]s${_FIN}`,
  `\\bprefier(?:o|es)\\b[^.?!\\n]{0,30}\\bo\\b`,
  /* la disyuntiva de dos tramos: «¿miro A o B?» · «¿vendo más o protejo margen?» — con «?» o con verbo delante.
   * ⚠️ LOS VERBOS DE ACCIÓN COMERCIAL entraron después, y los trajo el owner: «¿renegocio Falabella o recupero
   * La Polar?» no activaba nada, y es la disyuntiva más útil de las cuatro —dos caminos DISTINTOS sobre dos
   * cuentas distintas, cada uno con su precio—. La lista es cerrada a propósito: un patrón que aceptara
   * cualquier verbo terminado en «o» se llevaría media conversación. */
  `\\b(?:miro|reviso|abro|ataco|priorizo|empiezo por|vendo|protejo|subo|bajo|voy|renegocio|recupero|ajusto|cierro|corto|mantengo|entro|invierto|cobro|repongo|freno|suelto|dejo|arranco|parto)\\b[^.?!\\n]{1,40}\\bo\\b[^.?!\\n]{1,40}`,
].join("|"), "i");

/* ── (2) VALIDAR UNA HIPÓTESIS DEL USUARIO · él propone, ADI contrasta ─────────────────────────────────────── */
const _HIPOTESIS = new RegExp([
  `\\bcreo que\\b`, `\\bme parece que\\b`, `\\bsospecho que\\b`, `\\bintuyo que\\b`, `\\bser[aá] que\\b`,
  `\\bes(?:to|o)? (?:es )?(?:cierto|verdad)${_FIN}`, `\\bes cierto que\\b`, `\\bes verdad que\\b`,
  `\\bestoy en lo (?:correcto|cierto)${_FIN}`, `\\btengo raz[oó]n${_FIN}`, `\\bme equivoco${_FIN}`,
  `\\bt[uú] qu[eé] (?:ves|opinas|dices|piensas)${_FIN}`, `\\bconfirma(?:me)?${_FIN}`,
  `\\bmi (?:hip[oó]tesis|teor[ií]a|lectura) es\\b`, `\\bpuede ser que\\b`,
].join("|"), "i");

/* ── (3) RECORDAR / DECLARAR · el usuario aporta contexto suyo, no pregunta nada ──────────────────────────── */
const _RECUERDO = new RegExp([
  `\\brecuerda que\\b`, `\\bten (?:en cuenta|presente) que\\b`, `\\bya (?:te )?(?:dije|sabes|conté|comenté) que\\b`,
  `\\bte (?:dije|conté|comenté|expliqué) que\\b`, `\\banota que\\b`, `\\bqu[eé]date con que\\b`,
  `\\bpara que sepas${_FIN}`, `\\bconsidera que\\b`, `\\beso cambia\\b`, `\\bcon eso en mente${_FIN}`,
].join("|"), "i");

/* ── (4) DESAFIAR UNA DECISIÓN · pide juicio sobre lo que el dueño está haciendo ──────────────────────────── */
const _DECISION = new RegExp([
  `\\bestoy (?:tomando|haciendo)\\b[^.?!\\n]{0,30}\\b(?:mala|buena|bien|mal)\\b`,
  `\\bme conviene${_FIN}`, `\\bconviene (?:seguir|mantener|dejar|cambiar)\\b`,
  `\\bhago bien${_FIN}`, `\\bhice bien${_FIN}`, `\\bestoy (?:haciendo|yendo) bien${_FIN}`,
  `\\bdeber[ií]a (?:seguir|dejar|cambiar|mantener|subir|bajar|priorizar)\\b`,
  `\\bes (?:una )?(?:mala|buena) (?:decisi[oó]n|idea)${_FIN}`,
  `\\bvale la pena\\b[^.?!\\n]{0,30}\\?`,
  `\\bqu[eé] opinas de (?:mi|lo que)\\b`,
  /* CONCEDER ALGO A UNA CUENTA — «¿le doy más descuento a X?», «¿le bajo el precio?». Lo destapó la ruta de
   * desafiar decisiones: es la decisión que el dueño toma más seguido y no la veía ninguna forma. Se pide el
   * OBJETO comercial explícito para no llevarse «¿qué le digo al equipo?», que es plan de acción. */
  `\\ble (?:doy|damos|subo|subimos|bajo|bajamos|cedo|cedemos|mejoro|mejoramos)\\b[^.?!\\n]{0,25}\\b(?:descuento|precio|rebate|condiciones|plazo|cr[eé]dito)\\b`,
].join("|"), "i");

/* ── (5) PLAN DE ACCIÓN · pide pasos, no diagnóstico ──────────────────────────────────────────────────────── */
const _ACCION = new RegExp([
  `\\bqu[eé] hago${_FIN}`, `\\bqu[eé] hacemos${_FIN}`, `\\bqu[eé] har[ií]as${_FIN}`,
  `\\bqu[eé] (?:le )?digo (?:a|al)\\b`, `\\bqu[eé] (?:reviso|miro|ataco|hago) (?:primero|primera|esta semana|mañana|hoy)\\b`,
  `\\bdame (?:los|las|el|un)\\b[^.?!\\n]{0,20}\\bpasos?${_FIN}`, `\\bpor d[oó]nde (?:empiezo|arranco|parto)${_FIN}`,
  `\\bplan de acci[oó]n${_FIN}`, `\\bqu[eé] le llevo\\b`, `\\bc[oó]mo lo (?:ataco|abordo|trabajo)${_FIN}`,
].join("|"), "i");

/* ── (6) CONTRADICCIÓN APARENTE · dos métricas que parecen no cerrar ──────────────────────────────────────── */
const _CONTRADICCION = new RegExp([
  /* «vendo más pero gano menos» · «vende menos pero aporta más» — el «pero» entre dos direcciones opuestas */
  /* ⚠️ LAS MAGNITUDES TAMBIÉN SON DIRECCIONES, y sin ellas dos de las cinco frases del owner no activaban nada
   * (medido): «deuda ALTA pero POCO vencido» e «inventario bajo en monto pero ALTO en días». El «pero» entre
   * dos magnitudes opuestas es la misma forma que entre dos verbos; pedir sólo verbos dejaba fuera justo las
   * contradicciones de cobranza e inventario, que son las que el dueño no puede resolver mirando una tabla. */
  `\\b(?:m[aá]s|menos|sub[eií]|baj[aoó]|crec[eií]|cae|cay[oó]|alt[oa]s?|baj[oa]s?|poc[oa]s?|much[oa]s?|lent[oa]s?|r[aá]pid[oa]s?)\\b[^.?!\\n]{0,40}\\bpero\\b[^.?!\\n]{0,40}\\b(?:m[aá]s|menos|sub[eií]|baj[aoó]|crec[eií]|cae|cay[oó]|igual|alt[oa]s?|baj[oa]s?|poc[oa]s?|much[oa]s?|lent[oa]s?|r[aá]pid[oa]s?)\\b`,
  `\\bc[oó]mo se entiende${_FIN}`, `\\bno me (?:cuadra|calza|cierra)${_FIN}`, `\\bno cierra${_FIN}`,
  /* ⚠️ `${_FIN}` y no `\b`: tras la «í» de «así» el `\b` de JS no existe — la trampa de la casa, tercera vez
   * que muerde. La medición lo cazó: «¿por qué tengo caja y aun así estoy apretado?» no activaba nada. */
  `\\baun as[ií]${_FIN}`, `\\by sin embargo\\b`, `\\bal mismo tiempo\\b[^.?!\\n]{0,30}\\?`,
  `\\bc[oó]mo puede ser que\\b`,
].join("|"), "i");

/* ── (7) DEFENDER EL PROPIO CRITERIO · «¿por qué dices…?» · «¿por qué mirarías…?» · «¿en qué te basas?» ──────
 * ES LA FORMA QUE DISPARÓ TODO ESTO. El owner recibió una lectura ejecutiva correcta y preguntó «¿Por qué
 * mirarías La Polar si solo pesa 2.9% de la venta?» y «¿Por qué dices que Jumbo convierte mejor cada peso
 * vendido?». Las dos veces ADI salió a buscar otra cosa —la procedencia del 2.9%, la ficha de Jumbo— cuando
 * LAS DOS RAZONES ESTABAN EN SU PROPIO TEXTO del turno anterior («tiene el margen más alto entre las que caen,
 * 34.0%» · «la razón está en el margen: 24.0% contra 21.5%»).
 * No es un porqué del NEGOCIO: es el usuario cuestionando el criterio del asesor. Un asesor que afirma algo
 * tiene que poder sostenerlo sin ir a buscar dato nuevo. Acá solo se DETECTA para que las puertas cedan;
 * responderla bien es la ruta que el owner puso primera en la lista. */
const _JUSTIFICAR = new RegExp([
  `\\bpor\\s?qu[eé]\\s+(?:me\\s+)?(?:dices|dice|afirmas|afirma|crees|cree|sostienes|sostiene|planteas|propones|recomiendas|sugieres)${_FIN}`,
  `\\bpor\\s?qu[eé]\\s+(?:mirar[ií]as|priorizar[ií]as|empezar[ií]as|revisar[ií]as|atacar[ií]as|elegir[ií]as|partir[ií]as)${_FIN}`,
  `\\ben qu[eé] te bas(?:as|aste)${_FIN}`, `\\bqu[eé] te hace (?:decir|pensar|creer)${_FIN}`,
  `\\bc[oó]mo sabes que\\b`, `\\bde d[oó]nde sacas que\\b`, `\\bqu[eé] te lleva a\\b`,
  `\\bpor\\s?qu[eé]\\s+(?:esa|esa es la|tu)\\s+(?:prioridad|recomendaci[oó]n|conclusi[oó]n|lectura)${_FIN}`,
].join("|"), "i");

const _FORMAS = [
  ["justificar", _JUSTIFICAR],
  ["comparar", _COMPARAR], ["hipotesis", _HIPOTESIS], ["recuerdo", _RECUERDO],
  ["decision", _DECISION], ["accion", _ACCION], ["contradiccion", _CONTRADICCION],
];

/* ── PEDIR UNA LISTA NO ES PREGUNTAR POR UNA CONTRADICCIÓN ─────────────────────────────────────────────────
 * ⚠️ ESTO LO PAGÓ LA CERTIFICACIÓN CONGELADA. Al ampliar la forma «contradicción» con las magnitudes —para
 * que entraran «deuda ALTA pero POCO vencido» e «inventario bajo pero ALTO en días»— el patrón empezó a caer
 * también sobre «Dime cuáles son los clientes que venden MUCHO pero están BAJO el benchmark», que es un
 * turno congelado y NO es una contradicción: es una lista con dos condiciones. El usuario no pregunta cómo
 * conviven las dos cosas, pide los nombres que cumplen ambas.
 * La diferencia es la forma del pedido, no el «pero»: quien pide una lista abre con «dime cuáles», «dame»,
 * «muéstrame», «quiénes». Se excluye SOLO de la contradicción — un pedido de lista sí puede ser, por ejemplo,
 * un plan de acción («dame los tres pasos»), y ahí la forma es correcta. */
const _PIDE_LISTA = new RegExp([
  `\\b(?:dime|dame|mu[eé]strame|list[aá]me|ens[eé]ñame)\\b[^.?!\\n]{0,20}\\b(?:cu[aá]l(?:es)?|qui[eé]n(?:es)?|los|las)\\b`,
  `\\b(?:cu[aá]les|qui[eé]nes) son\\b`, `\\bqu[eé] clientes\\b`, `\\blista de\\b`, `\\bran?king\\b`,
].join("|"), "i");

/** la FORMA conversacional de la pregunta, o null si es una lectura corriente.
 *  Devuelve la primera que coincide — el orden es el del owner, y una pregunta rara vez es dos cosas. */
/* la contradicción EXPLÍCITA: una oración con la forma «más … pero … menos» que no sea, ella misma, un pedido
 * de lista. Se mira por oración a propósito: en un encargo compuesto la lista puede pedirse en OTRA oración
 * («…qué clientes están detrás…») sin que la contradicción que abre el mensaje deje de serlo. */
function _contradiccionExplicita(q) {
  return String(q).split(/(?<=[.;!?])\s+/).some((o) => _CONTRADICCION.test(o) && !_PIDE_LISTA.test(o));
}

export function formaConversacional(pregunta) {
  const q = String(pregunta || "");
  if (!q.trim()) return null;
  for (const [nombre, re] of _FORMAS) {
    if (!re.test(q)) continue;
    if (nombre === "contradiccion" && !_contradiccionExplicita(q)) continue;
    /* LA CONTRADICCIÓN EXPLÍCITA PREVALECE SOBRE LA HIPÓTESIS (owner 2026-09-11): «Estoy vendiendo más pero
     * siento que gano menos. Quiero que confirmes si es cierto…» se iba a «hipótesis» por «si es cierto», y el
     * contenido principal es una contradicción económica que la casa ya sabe investigar (vendo más–gano menos).
     * Su regla: «confirmes si es cierto» no secuestra el turno cuando el mensaje expresa la contradicción
     * explícita —«más … pero … menos»—. Solo ese cruce cambia; una hipótesis sin «pero» sigue siendo hipótesis. */
    if (nombre === "hipotesis" && _contradiccionExplicita(q)) return "contradiccion";
    return nombre;
  }
  return null;
}

/** ¿esta pregunta NO puede ser tomada por una puerta que responde otra cosa? — la regla del owner en una línea */
export function esConversacional(pregunta) { return formaConversacional(pregunta) !== null; }

/* ── LO QUE SÍ ES PEDIR UNA FICHA ─────────────────────────────────────────────────────────────────────────────
 * «La ficha de cliente solo debe ganar cuando el usuario pide realmente la ficha o el detalle de ese cliente.»
 * Esto es lo contrario del detector de arriba: la señal EXPLÍCITA de que quiere el cuadro de esa cuenta. Vive
 * acá y no en el playbook para que la regla del owner se lea en un solo lugar. */
const _PIDE_LA_FICHA = new RegExp([
  `\\bficha${_FIN}`, `\\bcuadro de\\b`, `\\bperfil${_FIN}`, `\\bdetalle de\\b`, `\\bdatos de\\b`,
  `\\bh[aá]blame de\\b`, `\\bcu[eé]ntame de\\b`, `\\bmu[eé]strame\\b`, `\\brev[ií]same\\b`,
  `\\bc[oó]mo (?:viene|va|est[aá]|anda)\\b`, `\\bqu[eé] (?:pasa|tal) con\\b`, `\\bqu[eé] onda\\b`,
  `\\bdame (?:todo|los datos|el detalle|el cuadro)\\b`, `\\babr(?:e|imos|ir)\\b`,
].join("|"), "i");
/** ¿el usuario está pidiendo DE VERDAD la ficha o el detalle de esa cuenta? */
export function pideLaFicha(pregunta) { return _PIDE_LA_FICHA.test(String(pregunta || "")); }
