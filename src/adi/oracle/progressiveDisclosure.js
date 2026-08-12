/* === src/adi/oracle/progressiveDisclosure.js · DIVULGACIÓN PROGRESIVA (owner 2026-08-07) =============
 * LA REGLA: ante una consulta GENERAL de una entidad ("Falabella", "perfil de Falabella", "¿cómo va
 * Falabella?"), ADI responde QUÉ PASA, POR QUÉ y QUÉ HACER PRIMERO — sin tablas de detalle. El detalle vive en la
 * Ficha de Sentrix, y la respuesta cierra con el enlace, no con la tabla.
 * Las tablas TEMPORALES aparecen SOLO si el usuario las pidió: "mes a mes", "evolución", "tendencia",
 * "comparación por período" o su equivalente semántico.
 *
 * DÓNDE SE RESUELVE — y por qué acá y no en la UI. Esconder la tabla en la interfaz no ahorra NADA: el costo ya se
 * pagó cuando la serie viajó al LLM. Esto corre ANTES del BATCH: las tools de detalle NO SE LLAMAN, así que sus
 * cifras nunca existen, nunca entran al ledger y nunca llegan al narrador. Medido sobre el turno real
 * "perfil de Falabella" (eje cliente): 134 cifras autorizadas → 16. La composición sola aportaba 85.
 *
 * QUÉ ES DETALLE Y QUÉ NO (el criterio, no una lista de tools):
 *   · DETALLE  · lo que se lee fila por fila: la serie mes a mes (13 filas), la composición por familia/SKU
 *                (85 cifras), el desglose SKU por SKU del capital. Eso es la Ficha.
 *   · LECTURA  · lo que responde qué pasa / por qué / qué hacer primero: las métricas de cabecera, la brecha
 *                contra la referencia, la palanca cuantificada y SU monto, el subtotal de capital y el SKU
 *                puntual que lo encabeza (la prioridad concreta NO es una tabla — es una frase con un número).
 *
 * APLICA A LOS CUATRO EJES (cliente, familia, marca, sku): el criterio es la FORMA de la consulta, no el eje.
 * Puro, sin estado, sin red — gate-testable como el resto de los detectores de este directorio.
 */
// ÚNICA dependencia de este módulo, y a propósito una HOJA: viewManifest.js no importa nada, así que este archivo
// sigue siendo consumible por conversationScope.js / narrationContract.js / answerViaOracle.js sin ningún riesgo de
// ciclo (ver la nota de DEICTIC_COMPONENT_RE, más abajo). Se importa el NOMBRE de la cara —no se copia— para que
// ADI nunca la llame distinto de como la llama la pantalla.
import { VISTA_LABEL } from "../sentrix/viewManifest.js";
// SEGUNDA dependencia, y también una HOJA (responsePreference.js no importa nada): el vocabulario de la REDUCCIÓN
// de forma —"solo la conclusión", "en una línea"— pertenece al módulo de la PREFERENCIA, que es el dueño del eje
// `detailLevel`. Acá se lo CONSULTA para decidir la forma del turno, nunca se lo reimplementa: es la misma
// frontera que este archivo ya declara para `pref` más abajo ("acá se la CONSULTA, nunca se la reimplementa").
// SE CONSULTA `pideReduccionDeLargo`, NO `pideReduccionDeForma` — y la diferencia es el defecto que se corrige acá
// (revisión adversarial 2026-08-11): la familia de REGISTRO ("al grano", "sin rodeos", "hablame directo") corrige
// el TONO, no la forma de presentación. Un PRESUPUESTO de largo ("en una línea") o un RECORTE a la conclusión sí
// son incompatibles con doce filas; "andá al grano: dame el top 10 de clientes" NO lo es —era `auto` y prohibirle
// la tabla al narrador es negarle al usuario una forma que nadie prohibió—. Ver responsePreference.js.
import { pideReduccionDeLargo } from "./responsePreference.js";

// ── ¿PIDIÓ LA SERIE TEMPORAL? ──────────────────────────────────────────────────────────────────────────────────
// No es una lista cerrada de frases: son las FAMILIAS de pedido temporal que el producto reconoce. Cubre la forma
// canónica ("mes a mes"), la nominal ("evolución", "tendencia", "trayectoria", "histórico", "serie"), la
// comparativa por período ("contra el año pasado", "vs el trimestre", "mes contra mes") y la coloquial
// ("cómo viene", "cómo venía", "en qué meses"). Un pedido temporal SIEMPRE nombra el tiempo de alguna de estas
// formas — si no lo nombra, no lo pidió, y ahí es donde entra la regla.
const _TEMPORAL = [
  /\bmes a mes\b|\bmes por mes\b|\bmes contra mes\b/i,
  /\bevoluci[oó]n\b|\bevolutivo\b|\btendencia\b|\btrayectoria\b|\bhist[oó]ric[oa]\b|\bserie\b/i,
  /\b(por|entre|contra|vs\.?)\s+(mes|meses|per[ií]odos?|trimestres?|semestres?|a[ñn]os?)\b/i,
  /\bcomparaci[oó]n\s+(por|entre)\s+(per[ií]odo|mes|trimestre|a[ñn]o)/i,
  /\b(mensual(?:es|mente)?|trimestral(?:es)?|interanual(?:es)?|estacional(?:idad)?)\b/i,
  /\b(a lo largo del|durante el|en el transcurso del)\s+(a[ñn]o|per[ií]odo|trimestre)\b/i,
  // «CÓMO VIENE» NO ES UNA PETICIÓN DE SERIE POR SÍ SOLA (owner 2026-08-11, residual del defecto 8).
  // «¿Cómo viene Falabella?» es una consulta GENERAL sobre la entidad —qué pasa, por qué, qué hacer primero— y
  // esta línea la convertía en un pedido de detalle temporal, que aguas arriba fuerza `tabla`. Medido: el turno
  // resolvía `outputForm=tabla` y `tablePolicy=required`, así que una pregunta ejecutiva recibía una tabla y una
  // respuesta en prosa se rechazaba con `tabla-faltante`.
  // LA DISTINCIÓN ES EL COMPLEMENTO, no el verbo: «cómo viene EL AÑO» sí pide una serie; «cómo viene FALABELLA»
  // no. Por eso `viene/venía/vino` ahora exige una unidad de tiempo cerca.
  // `evolucionó` y `se movió` se quedan SIN condición: son verbos de trayectoria: preguntan por el movimiento en
  // el tiempo aunque el complemento sea una entidad («¿cómo evolucionó Falabella?» sí es la serie).
  /\bc[oó]mo (?:evolucion[oó]|se movi[oó])\b/i,
  /\bc[oó]mo (?:viene|ven[ií]a|vino)\b[^.?!¿]{0,40}?\b(?:mes(?:es)?|trimestres?|semestres?|a[ñn]os?|per[ií]odos?|semanas?|d[ií]as?)\b/i,
  /\b(qu[eé]|cu[aá]l(?:es)?)\s+mes(?:es)?\b|\bmejor mes\b|\bpeor mes\b/i,
  // OJO sin `\b` inicial: en JavaScript `\b` es ASCII, así que NO reconoce la "ú" — con `\b[uú]ltimos` la frase
  // "últimos 6 meses" NO matcheaba (cazado en la prueba del detector). Mismo cuidado en el bloque de desglose.
  /[uú]ltimos?\s+(?:\d+\s+)?(?:meses|trimestres|a[ñn]os)/i,
  /\b(a[ñn]o (?:anterior|pasado)|mismo per[ií]odo)\b/i,
];
export function pideDetalleTemporal(text) {
  const t = String(text || "");
  return _TEMPORAL.some((re) => re.test(t));
}

// ── ¿PIDIÓ EL DESGLOSE? ────────────────────────────────────────────────────────────────────────────────────────
// La composición por familia/SKU y el desglose del capital SKU por SKU son la Ficha. Solo viajan si se piden.
const _DESGLOSE = [
  // sin `\b` de cierre donde la palabra puede terminar en vocal acentuada ("desglosá", "abrí"): `\b` es ASCII y
  // no cierra después de "á"/"í", así que esas formas imperativas —las que un usuario escribe de verdad— fallaban.
  /\bcomposici[oó]n|\bdesglos|\bdetalle\b|\bdetallad|\babrir\b|\babr[íi]/i,
  /\bqu[eé]\s+(?:productos?|sku|familias?|marcas?|categor[ií]as?)\b/i,
  /\bpor\s+(?:familia|sku|producto|categor[ií]a|marca)\b/i,
  /\bqu[eé]\s+(?:me\s+)?(?:compra|vende|lleva)\b/i,
  /\bmix\b|\bcanasta\b/i,
];
export function pideDetalleComposicion(text) {
  const t = String(text || "");
  return _DESGLOSE.some((re) => re.test(t));
}

// ── ¿ES UNA CONSULTA GENERAL DE ENTIDAD? ───────────────────────────────────────────────────────────────────────
// La señal es del PLAN, no del texto: el turno resolvió `entityProfile` para UNA entidad. Ese es exactamente el
// turno "contame de X" — el plan ya hizo la comprensión, acá no se vuelve a adivinar. Si el usuario pidió una
// métrica puntual el plan resuelve queryMetric/marginRead, no entityProfile, y esta regla no toca ese turno.
export function esConsultaGeneralDeEntidad(plan) {
  const calls = plan && Array.isArray(plan.calls) ? plan.calls : [];
  const ep = calls.find((c) => c && c.tool === "entityProfile");
  if (!ep) return null;
  const entity = ep.entity || (ep.args && ep.args.entity) || null;
  const dimension = ep.dimension || (ep.args && ep.args.dimension) || null;
  return entity ? { entity, dimension } : null;
}

// ── LA PODA · ANTES DEL BATCH ──────────────────────────────────────────────────────────────────────────────────
// Devuelve el plan sin las llamadas de DETALLE que el usuario no pidió, y la lista de lo que se podó (para que la
// respuesta pueda ofrecer la Ficha con honestidad: "esto está en la Ficha", no "no lo tengo").
// NUNCA poda si el usuario lo pidió, ni si el plan no es una consulta general de entidad.
export function podarPlanProgresivo(plan, text) {
  const general = esConsultaGeneralDeEntidad(plan);
  if (!general) return { plan, podado: [] };
  const quiereTemporal = pideDetalleTemporal(text);
  const quiereDesglose = pideDetalleComposicion(text);
  if (quiereTemporal && quiereDesglose) return { plan, podado: [] };
  const podado = [];
  const calls = plan.calls.filter((c) => {
    if (!c) return false;
    if (!quiereTemporal && c.tool === "trend") { podado.push("evolución mes a mes"); return false; }
    if (!quiereDesglose && c.tool === "entityComposicion") { podado.push("composición por familia y producto"); return false; }
    return true;
  });
  return { plan: { ...plan, calls }, podado, entidad: general.entity, eje: general.dimension };
}

// ── LA PODA · DESPUÉS DEL BATCH (cinturón y tirantes) ──────────────────────────────────────────────────────────
// El capital ligado NO se poda entero: su SUBTOTAL y el SKU que lo encabeza son el "qué hacer primero" (una frase
// con un número, no una tabla). Lo que se poda es el resto del desglose SKU por SKU — 9 cifras que solo se leen
// en la Ficha. Esto corre sobre el LEDGER, no sobre el texto: las cifras podadas dejan de estar autorizadas, así
// que el narrador no puede citarlas ni aunque quisiera (guardC las rechaza).
const _CAPITAL_DETALLE = /·\s*(unidades detenidas|d[ií]as sin venta)\s*$/i;
export function podarLedgerProgresivo(figs, { quiereDesglose = false } = {}) {
  const lista = Array.isArray(figs) ? figs : [];
  if (quiereDesglose) return { figs: lista, podadas: 0 };
  // se conserva el subtotal y el capital de CADA SKU (la prioridad se nombra con su monto); se van las columnas
  // que solo tienen sentido leídas en tabla.
  const out = lista.filter((f) => !(f && _CAPITAL_DETALLE.test(String(f.label || ""))));
  return { figs: out, podadas: lista.length - out.length };
}

// ── LO QUE LA RESPUESTA DEBE DECIR EN VEZ DE LA TABLA ──────────────────────────────────────────────────────────
// Instrucción de NIVEL DE TURNO: solo viaja cuando de verdad se podó algo. Nombra la Ficha como el lugar del
// detalle (no como una promesa vaga de "puedo profundizar"), y prohíbe explícitamente reconstruir la tabla.
// ══ POLÍTICA DE PRESENTACIÓN (owner 2026-08-07) ════════════════════════════════════════════════════════════════
// NO es un booleano global "tablas sí / tablas no". La tabla es una decisión de PRESENTACIÓN del turno, y tiene
// tres estados — el guard valida EL QUE SE DECIDIÓ, no una prohibición general:
//   · forbidden  consulta general de perfil ("Falabella"): el detalle no viajó, tabular lo que queda sería
//                reconstruirlo con MENOS información que la Ficha. Se bloquea la tabla.
//   · required   el usuario pidió explícitamente una tabla, la serie mes a mes o un desglose tabular. Acá la
//                tabla es OBLIGATORIA: responder en prosa una pregunta que pidió tabla también es incumplir.
//   · auto       el resto — comparaciones y listados donde la tabla mejora la lectura. Decide el narrador con
//                los detectores de forma que ya existían (_needsTableFormat); el guard no juzga.
// Pedido EXPLÍCITO de tabla. Se escribe de DOS maneras, y hasta acá sólo se reconocía una:
//   (a) LA FORMA COMO COMPLEMENTO · el usuario nombra el formato de salida ("en una tabla", "tabulá", "en formato
//       tabla", "en columnas"). Es lo que este detector cubría desde el principio.
//   (b) LA TABLA COMO OBJETO PEDIDO · el usuario pide la tabla misma ("dame la tabla completa de Falabella",
//       "mostrame la tabla", "quiero ver la tabla"). Medido sobre el caso del owner: «Dame la tabla completa de
//       Falabella» caía en (a)=false, el plan resolvía `entityProfile` (consulta general de entidad), la poda
//       progresiva llenaba `podado` y `resolveTablePolicy` devolvía **forbidden** — así que guardC BLOQUEABA con
//       `tabla-no-autorizada` exactamente la tabla que se había pedido con todas las letras. Peor: la forma más
//       vaga del mismo pedido, «dame el DETALLE completo de Falabella», sí daba `required` por `pideDetalle-
//       Composicion` — el producto premiaba la palabra imprecisa y castigaba la precisa.
//
// POR QUÉ (b) EXIGE VERBO DE ENTREGA + ARTÍCULO, y no alcanza con nombrar "tabla": «explicame esta tabla» /
// «qué mide esa tabla» son DEIXIS —el usuario habla DE la tabla que ya tiene en pantalla, no pide una— y forzarles
// `required` obligaría a tabular una respuesta que pidió explicación. El demostrativo las separa del pedido: con
// artículo ("la/una/toda la") es un pedido, con demostrativo ("esta/esa") es una referencia. La segunda forma
// admitida es la frase NOMINAL sola al inicio del mensaje ("la tabla completa de Falabella"), que es un pedido
// escrito sin verbo y no puede ser deixis por la misma razón.
// OJO CON EL `\b` DE CIERRE — es ASCII y NO cierra después de una vocal acentuada, la misma trampa que este archivo
// ya documenta en `_TEMPORAL` y en `_DESGLOSE`. Con el `\b` global al final del grupo, «tabulá el margen por
// cliente» NO matcheaba (sí «tabula», sin tilde): la forma imperativa que un usuario escribe de verdad era la única
// que se escapaba. Cada alternativa cierra ahora por su cuenta, y la que puede terminar en tilde no cierra.
/* «EN LA TABLA DE SIEMPRE» TAMBIÉN PIDE UNA TABLA (owner 2026-08-12, cazado por `_forma_manda_sobre_el_alcance`).
 * Acá decía `en (?:una )?tabla`: reconocía el artículo INDETERMINADO y no el determinado. Mientras el alcance
 * restringido tabulaba siempre el hueco no se notaba —el turno salía en tabla por el camino del alcance, no por
 * haberla pedido—, pero desde que la forma del fallback se respeta, quien la nombra con «la» recibía una oración.
 * EL ARTÍCULO DETERMINADO NO ALCANZA, Y ABRIRLO A SECAS ROMPE LA OTRA MITAD. Medido: con `en la tabla` suelto,
 * «¿Por qué el mismo mes muestra otra cifra en la tabla?» pasaba a pedir tabla — y no pide ninguna: habla de una
 * que ya está en pantalla. La diferencia no es el artículo, es si hay MARCA DE CONTINUIDAD («de siempre», «la
 * misma», «de arriba»): eso convierte la mención en una orden de entrega. Sin esa marca, «en la tabla» es un
 * complemento locativo de un verbo descriptivo, y ahí no hay pedido que atender. */
const _PIDE_TABLA = /\b(?:en (?:una )?tabla\b|en (?:la|esa) misma tabla\b|en la tabla de (?:siempre|arriba|antes)\b|en formato tabla\b|tabulad[oa]\b|tabul[aá]\w*|en columnas\b|como tabla\b|arm[aá]\w* una tabla\b|una tabla con\b)/i;
const _PIDE_TABLA_OBJETO = /\b(?:d[aá]me|entr[eé]g[aá]me|mostr[aá]me|mu[eé]strame|ens[eé][nñ][aá]me|p[aá]s[aá]me|tr[aá][eé]me|m[aá]nd[aá]me|quiero|querr[íi]a|necesito|me gustar[íi]a)(?:\s+(?:ver|tener|obtener|revisar))?\s+(?:toda\s+la|todas?\s+las|la|una|las|el)\s+tablas?\b/i;
// La forma nominal se acota con el relativo: «la tabla QUE estoy viendo, qué dice» abre una subordinada y es
// deixis, no pedido. Sin ese corte, empezar la frase por "la tabla" bastaba para forzar `required`.
const _PIDE_TABLA_NOMINAL = /^\s*(?:la|una|las)\s+tablas?\b(?!\s+que\b)/i;
// «HACEME UN CUADRO», «ARMÁ UNA PLANILLA» · el verbo de CONSTRUCCIÓN desambigua el sustantivo polisémico
// (owner 2026-08-11). `cuadro` a secas vive en `_TABLA_N_PARTE` porque puede nombrar una PARTE del contenido
// («sin el cuadro de resumen») o un objeto del negocio; pero pedido con un verbo de construir/entregar es
// inequívocamente una petición de presentación tabular, y era la única de las formas que el owner enumeró que
// no se reconocía. Se exige el verbo PEGADO al sustantivo: sin él, `cuadro` sigue siendo ambiguo.
// SÓLO MODO DE ORDEN, con enumeración CERRADA. La primera versión usaba `arm[aá]\w*` abierto y matcheaba
// «no me ARMASTE el cuadro que te pedí» —un RECLAMO en indicativo pasado— convirtiéndolo en un pedido de tabla:
// exactamente la trampa de modo que este archivo ya documenta para el verbo `tabular`, reintroducida por mí al
// cerrar el residual. El indicativo habla de lo que ADI hizo; sólo el imperativo/subjuntivo/infinitivo es orden.
// …Y NO PUEDE ESTAR NEGADO. «No me armes la tabla» es una PROHIBICIÓN, y si este patrón la lee como pedido
// positivo, el paso 2 de `prohibeFormaTabular` la exonera y la orden del usuario se pierde. La negación puede
// traer clítico en el medio («no me armes», «no nos hagas»), así que el corte cubre las dos formas.
const _PIDE_TABLA_CONSTRUIR = /(?<!\bno\s)(?<!\bno\s(?:me|nos)\s)\b(?:haz|hac[eé]|hag[aá]s?|hagan|arm[aá]|arme|armes|armen|armar|constru[íi]|construye|construir|prepar[aá]|prepare|prepares|preparar|gener[aá]|genere|generes|generar|dib[uú]ja|dibuje|dibujar)(?:me|nos)?\s+(?:un|una|el|la)\s+(?:cuadro|planilla|grilla|matriz|tabla)\b/i;
export function pideTablaExplicita(text) {
  const t = String(text || "");
  return _PIDE_TABLA.test(t) || _PIDE_TABLA_OBJETO.test(t) || _PIDE_TABLA_NOMINAL.test(t) || _PIDE_TABLA_CONSTRUIR.test(t);
}

/* ══ PROHIBICIÓN DE FORMA · el eje dejó de ser monótono-positivo (defecto D8, 2026-08-11) ═══════════════════════
 * HASTA ACÁ TODA SEÑAL PODÍA AGREGAR UNA OBLIGACIÓN DE FORMA Y NINGUNA PODÍA QUITARLA: los tres disparadores de
 * `required` son positivos y `forbidden` sólo podía nacer de `podado` (la poda de divulgación progresiva). Es decir:
 * el usuario NO TENÍA NINGUNA FORMA DE PROHIBIR UNA TABLA. Y el daño venía en DOS GRADOS, los dos medidos en vivo:
 *   (a) cuando la negación arrastra un disparador positivo pegado —«explicalo sin repetir la tabla del peor mes»
 *       lleva "peor mes", que es _TEMPORAL— la política salía `required`, guardC bloqueaba con `tabla-faltante`
 *       la prosa OBEDIENTE y la reparación determinística INYECTABA la tabla prohibida. Cuanto más claro el
 *       usuario, más seguro el incumplimiento.
 *   (b) cuando la negación viene sola —«nada de tablas, contame qué está pasando»— salía `auto`: la prohibición
 *       simplemente se evaporaba y ni siquiera viajaba `instruccion_sin_tabla` al narrador.
 * Los dos grados salen del MISMO agujero, así que se cierran con la misma regla: un pedido de forma del usuario
 * puede decir que NO, y cuando lo dice, gana.
 *
 * LA NEGACIÓN SE RESUELVE CONTRA EL SUSTANTIVO DE FORMA, NUNCA CONTRA LA ORACIÓN. Es lo único que impide caer al
 * lado opuesto del mismo defecto: «dame la tabla mes a mes, sin el diagnóstico», «la tabla completa, sin
 * recomendación» y «no te pedí ventas, te pedí contribución» niegan el CONTENIDO —no la forma— y tienen que seguir
 * resolviendo `required`/lo que corresponda. Por eso cada alternativa de acá abajo exige que el objeto negado sea
 * la tabla / el cuadro / las columnas: no alcanza con que la frase tenga un "sin" o un "no".
 *
 * ══ Y EL SUSTANTIVO SOLO NO ALCANZA: NEGAR UNA PARTE NO ES NEGAR LA FORMA (revisión adversarial 2026-08-11) ══════
 * La primera versión de este bloque metía `columnas`, `cuadros` y `matriz` en la MISMA lista que `tabla`, y con la
 * precedencia absoluta de `resolveTablePolicy` eso hacía que NEGAR UNA COLUMNA MATARA LA TABLA ENTERA. Medido
 * end-to-end: «Dame la tabla mes a mes, sin la columna de unidades» resolvía `forbidden`, al narrador le llegaba
 * `instruccion_sin_tabla=true` y guardC rechazaba con `tabla-no-autorizada` la tabla que el turno pedía con todas
 * las letras. Es el defecto del owner 2026-08-07 —«si el usuario pidió la tabla, la pidió»— reintroducido por el
 * lado opuesto, y un falso positivo así hace más daño que el agujero que vinimos a tapar.
 *
 * LA CAUSA es que esos tres sustantivos son POLISÉMICOS: nombran la FORMA («evitá las columnas, quiero leerlo de
 * corrido») y también UNA PARTE DEL CONTENIDO de una tabla («sin la columna de unidades», «sin el cuadro de resumen
 * final», «sin la matriz de correlación»). Lo mismo pasa con la rama de PROSA: «explicámelo en palabras simples» no
 * prohíbe nada, y un turno que pide LAS DOS FORMAS no puede perder la que pidió explícitamente.
 *
 * LA REGLA, y es UNA sola para los dos casos:
 *   · NEGACIÓN DEL VERBO `tabular` EN MODO DE ORDEN (imperativo/subjuntivo/infinitivo: «no me tabules nada»,
 *     «sin tabular») → es una ORDEN sobre la forma y GANA SIEMPRE, incluso con un disparador positivo pegado.
 *
 *     ⚠️ EL SUSTANTIVO INEQUÍVOCO NEGADO YA NO ESTÁ ACÁ (owner 2026-08-11, tercera pasada). «sin la tabla»,
 *     «nada de tablas», «sin planillas», «nada de cuadritos» NO prohíben: resuelven `required` si el turno trae
 *     un disparador positivo y `auto` si no. «Explicalo sin repetir la tabla: cuál fue el peor mes» RECIBE UNA
 *     TABLA — es un defecto conocido y ABIERTO (E3.t3 de la certificación), no un descuido. La razón completa
 *     está donde se retiró, en `_PROHIBE_FORMA`: la lista producía 14 falsos positivos medidos contra tablas
 *     que el usuario RECLAMABA porque faltaron. Este párrafo decía lo contrario hasta hoy, y esa mentira es
 *     justo la que dejó envejecer en silencio a dos gates que seguían certificando la conducta vieja.
 *   · NEGACIÓN DE UN SUSTANTIVO POLISÉMICO, o MENCIÓN POSITIVA DE LA FORMA OPUESTA (la prosa) → sólo prohíbe si el
 *     MISMO turno no pidió la tabla/el detalle en positivo. Si lo pidió, lo negado es una PARTE (o lo pedido son
 *     LAS DOS formas) y la tabla se entrega igual.
 * La asimetría es deliberada y es la doctrina de la casa: ante duda, FALSO NEGATIVO antes que falso positivo. Que
 * se escape una prohibición ambigua cuesta un turno de más; bloquear una tabla pedida rompe un turno que funciona.
 */
// INEQUÍVOCOS · sólo pueden nombrar la forma de presentación. Un "cuadrito" es siempre una tabla chica, nunca una
// parte del contenido; por eso el diminutivo va acá y `cuadro` a secas no.
const _TABLA_N_FORMA = "(?:tablas?|tablitas?|planillas?|grillas?|cuadrit[oa]s?|formato\\s+(?:de\\s+)?tabla\\w*|formato\\s+tabular)";
// POLISÉMICOS · nombran la forma Y una parte del contenido de una tabla. Ver el bloque de arriba.
// `matriz|matrices` ESTUVO ACÁ Y SE SACÓ (revisión adversarial 2026-08-11) · el guard de polisemia del paso 2 sólo
// salva el turno si hay un disparador POSITIVO de tabla en el mismo mensaje; sin él, «matriz» negada prohibía. Pero
// la polisemia de esta palabra no es la que se había previsto: además de nombrar la forma HACIA ADENTRO (una parte
// de una tabla) nombra HACIA AFUERA objetos del negocio que no tienen NADA que ver con la presentación — «la
// matriz» es la CASA MATRIZ frente a las filiales, y «matriz de riesgo / FODA / BCG» es un documento. MEDIDO:
// «Dame las ventas de las filiales, sin la matriz.» → forbidden (base 2b062cc: `auto`) y guardC devolvía
// `tabla-no-autorizada` sobre una lista de filiales que el narrador tabularía; idem «Dame el consolidado sin la
// matriz de riesgo del área legal.». Cerrarlo con un contexto de forma exigiría decidir cuál de los dos sentidos
// quiso el usuario, y ANTE AMBIGÜEDAD ESTE EJE SE ABSTIENE: se pierde la prohibición «sin matrices, contámelo» —un
// turno de más— y se recupera todo turno del negocio que nombra la matriz. La doctrina de la casa manda: que se
// escape una prohibición borrosa cuesta un turno; bloquear una respuesta correcta rompe uno que funciona.
const _TABLA_N_PARTE = "(?:cuadros?|columnas?)";
// determinantes admitidos ENTRE el operador de negación y el sustantivo de forma. Es una lista cerrada a propósito:
// con un `\w+` genérico, «sin el diagnóstico de la tabla» pasaría a leerse como prohibición de la tabla.
const _DET = "(?:(?:otra|otras|una|un|la|las|el|los|esa|esas|ese|esos|esta|estas|ninguna|ning[uú]n|toda\\s+la|todas\\s+las|m[aá]s|tu|esa\\s+misma|la\\s+misma)\\s+)*";
// LOS VERBOS DE ENTREGA, EN ENUMERACIÓN CERRADA Y SEPARADOS POR MODO (revisión adversarial 2026-08-11).
// ANTES ERA `\w+` ABIERTO —`arm\w+`, `us\w+`, `inclu\w+`, `copi\w+`, `repit\w+`, `muestr\w+`— y eso matchea el
// INDICATIVO, presente y pasado, que NO es una orden: es un RECLAMO de que la tabla FALTÓ («No me armaste la tabla
// mes a mes, ¿la podés hacer?», «No usaste la tabla que te pasé») o un PEDIDO CORTÉS en negativo («¿No me armas la
// tabla mes a mes?»). Y como estas familias se aplican sobre `_TABLA_N_FORMA` —la clase INEQUÍVOCA—, caían en el
// paso 1 de `prohibeFormaTabular`, que gana SIEMPRE: el guard de polisemia del paso 2 ni las veía. MEDIDO
// end-to-end: `tablePolicy=forbidden`, contrato sellado forbidden, `instruccion_sin_tabla=true` al narrador y
// guardC devolviendo `tabla-no-autorizada` CONTRA LA TABLA QUE EL USUARIO ESTABA RECLAMANDO PORQUE FALTÓ. En la
// base 2b062cc esos mismos turnos daban `required`. Es exactamente la regla que ya estaba escrita treinta líneas
// más abajo para el verbo `tabular` —«el indicativo pasado habla de lo que ADI hizo; sólo el imperativo/subjuntivo/
// infinitivo es una orden»— aplicada al otro lugar donde valía, que era donde faltaba.
// EL CORTE ES GRAMATICAL, NO UNA LISTA DE FRASES, y por eso cierra la clase entera y no los turnos medidos:
//   · en español el imperativo NEGADO se conjuga en SUBJUNTIVO («no me armes», nunca «no me armá»), así que detrás
//     de un «no …» sólo el subjuntivo puede ser una orden;
//   · detrás de «sin», «olvidate de», «dejá de», «ni se te ocurra» y «no vuelvas a» va el INFINITIVO.
// Ningún otro modo puede ser una orden, así que ningún otro modo entra. Dos grupos, y cada familia usa el que su
// propia sintaxis admite. NO USAR `\b` DE CIERRE: es ASCII y no cierra tras vocal acentuada (la trampa que este
// archivo ya documenta en `_TEMPORAL` y `_DESGLOSE`); acá cierra el `\s+`/`(?:me|nos)` que viene después.
const _VE_INF = "(?:armar|poner|mostrar|repetir|usar|hacer|incluir|copiar|pegar|desplegar|dar)";
const _VE_SUBJ = "(?:arm(?:es|és|emos|en|e)|pong(?:as|ás|amos|an|a)|muestr(?:es|en|e)|mostr(?:és|emos)|repit(?:as|ás|amos|an|a)|us(?:es|és|emos|en|e)|hag(?:as|ás|amos|an|a)|incluy(?:as|ás|amos|an|a)|copi(?:es|és|emos|en|e)|pegu(?:es|és|emos|en|e)|despliegu(?:es|en|e)|desplegu(?:és|emos)|d(?:és|es|emos|eis|en|é))";
// LAS FAMILIAS DE NEGACIÓN, parametrizadas por la clase de sustantivo: son las MISMAS construcciones sintácticas
// para las dos clases — lo único que cambia es cuánto pesa el resultado. Una sola definición, dos aplicaciones.
const _negaciones = (N) => [
  // «sin tabla», «sin la tabla», «sin tablas», «sin repetir la tabla», «sin volver a armar el cuadro», «sin columnas»
  new RegExp(`\\bsin\\s+(?:(?:volver\\s+a\\s+)?${_VE_INF}\\s+)?${_DET}${N}`, "i"),
  // «nada de tablas», «basta de tablas», «olvidate de armar una tabla», «dejá de armarme cuadros»
  new RegExp(`\\b(?:nada|basta)\\s+de\\s+${_DET}${N}`, "i"),
  new RegExp(`\\b(?:olv[ií]date|olvidate|olvidese|dej[aá]|deja|dejemos|dejate)\\s+de\\s+(?:${_VE_INF}(?:me|nos)?\\s+)?${_DET}${N}`, "i"),
  // «dejá la tabla de lado», «dejemos el cuadro afuera» — el complemento va DESPUÉS del sustantivo, así que la
  // familia de arriba (que espera «dejá DE …») no la ve.
  new RegExp(`\\b(?:dej[aá]|deja|dejemos|dejen)\\s+${_DET}${N}\\s+(?:de\\s+lado|a\\s+un\\s+lado|afuera|fuera)\\b`, "i"),
  // «no me armes ninguna tabla», «no repitas la tabla», «no vuelvas a mostrar el cuadro». SUBJUNTIVO detrás del
  // «no» (el imperativo negado del español) e INFINITIVO detrás de «no vuelvas A». El indicativo NO entra: «no me
  // armaste la tabla» / «¿no me armas la tabla?» es el usuario RECLAMÁNDOLA, no prohibiéndola.
  new RegExp(`\\bno\\s+(?:me\\s+|nos\\s+|se\\s+)?(?:la\\s+|las\\s+|lo\\s+)?(?:(?:vuelvas?|volv[aá]s)\\s+a\\s+${_VE_INF}|${_VE_SUBJ})(?:me|nos)?\\s+${_DET}${N}`, "i"),
  // «no quiero la tabla», «no necesito ninguna tabla»
  new RegExp(`\\bno\\s+(?:me\\s+)?(?:quiero|quiere|queremos|querr[ií]a|necesito|necesitamos|pidas)\\s+${_DET}${N}`, "i"),
  // «no hace falta la tabla», «no hacen falta cuadros»
  new RegExp(`\\bno\\s+(?:me\\s+|nos\\s+)?(?:hace|hacen)\\s+falta\\s+${_DET}${N}`, "i"),
  // «ni se te ocurra darme una tabla», «ni una tabla»
  new RegExp(`\\bni\\s+(?:se\\s+te\\s+ocurra\\s+${_VE_INF}(?:me|nos)?\\s+)?${_DET}${N}`, "i"),
  // «evitá la tabla», «evita las columnas»
  new RegExp(`\\bevit[aáe]\\w*\\s+${_DET}${N}`, "i"),
];
const _PROHIBE_FORMA = [
  // ── RETIRADO (owner 2026-08-11, tercera pasada de la certificación) ────────────────────────────────────────
  // Acá vivía `..._negaciones(_TABLA_N_FORMA)`: las nueve familias de negación aplicadas al sustantivo INEQUÍVOCO.
  // Se retiró porque producía 14 falsos positivos MEDIDOS de la peor clase posible: `tabla-no-autorizada` contra
  // una tabla que el usuario estaba RECLAMANDO porque faltó. «Me quedé sin la tabla mes a mes, ¿la rehacés?»,
  // «No llegó ni la tabla, ¿me la mandás?», «No quiero la tabla resumida, quiero la completa» — las tres pedían
  // la tabla y se quedaban sin ninguna. En 2b062cc las cuatro primeras resolvían `required`.
  //
  // POR QUÉ NO ALCANZA CON MOVERLO AL PASO 3 (probado, no supuesto): el paso 2 sólo exonera al turno que ADEMÁS
  // pide la tabla en positivo, y `pidePresentacionTabular` reconoce el pedido en 6 de esos 14 — «Nos quedamos sin
  // la tabla del trimestre, ¿la podés mandar?» no lo trae. Los otros 8 seguirían prohibidos sin haberlo pedido.
  // El detector positivo tendría que reconocer el reclamo (interrogativo negativo, enclítico «dámela», «la
  // necesito») ANTES de que esta lista pueda volver; hasta entonces, la forma segura de esta regla no existe.
  //
  // LO QUE SE PIERDE, dicho sin adornos: «Explicalo sin repetir la tabla» y «Nada de tablas, contame qué pasa»
  // vuelven a resolver como en la base, o sea sin prohibir. Es un defecto REAL de la certificación (E3.t3) que
  // queda ABIERTO. Se prefiere así: que ADI muestre una tabla de más es un defecto de forma; que se niegue a
  // mostrar la que le piden es un turno que el usuario no puede completar. Falso negativo antes que falso
  // positivo — la doctrina de este repo, aplicada contra el propio fix.
  //
  // EL VERBO NEGADO · «no me tabules nada», «respondeme en formato narrativo, no tabular». Es la misma orden sin
  // sustantivo, y era el peor sub-disparo medido: `_PIDE_TABLA` matcheaba `tabul[aá]\w*` DENTRO de «no tabular», así
  // que el turno que decía "no tabular" terminaba resolviendo `required` — obligado a tabular.
  // SÓLO formas IMPERATIVAS / SUBJUNTIVAS / INFINITIVAS. Con `tabul\w*` genérico, «¿por qué no tabulaste el mes a
  // mes?» —un RECLAMO de que faltó la tabla— se leía como prohibición y le negaba al usuario justo lo que pedía.
  // El indicativo pasado habla de lo que ADI hizo; sólo el imperativo/subjuntivo/infinitivo es una orden.
  /\bno\s+(?:me\s+|nos\s+|se\s+|lo\s+|la\s+|los\s+|las\s+)*tabul(?:es|[eé]s|e|en|emos|ar)\b/i,
  /\b(?:sin|nada\s+de|evit[aáe]\w*)\s+tabular\b/i,
];
const _PROHIBE_PARTE = _negaciones(_TABLA_N_PARTE);
// LA FORMA OPUESTA NOMBRADA EN POSITIVO: pedir prosa es, por sí solo, pedir que no haya tabla. Pero SÓLO por sí
// solo — si el turno además pide la tabla, pidió las dos cosas y no prohibió ninguna (ver la regla de arriba).
// «EN PALABRAS» ES REGISTRO, NO FORMA (owner 2026-08-11, hallazgo del verificador final). Las alternativas
// `\ben\s+palabras\b` y `\bcon\s+palabras\b` sueltas convertían en `forbidden` un pedido de SIMPLIFICAR, no de
// dejar de tabular. Medido end-to-end: «Dame el top 10 de clientes, explicado en palabras simples» destruía la
// tabla del ranking y la reemplazaba por una línea de prosa de UNA entidad; 10 redacciones de la misma familia
// («decímelo en palabras sencillas», «traducilo en palabras simples para el directorio») daban las 10 forbidden.
// En 2b062cc las tres eran `auto` y la tabla sobrevivía — o sea que esto era capacidad NUEVA que rompía turnos.
// El guard de polisemia del paso 2 no las salva porque `pidePresentacionTabular` no reconoce «top 10» como
// pedido tabular. Ahora «palabras» sólo prohíbe con marca de EXCLUSIVIDAD explícita («sólo en palabras»,
// «únicamente con palabras»), que es cuando el usuario sí está eligiendo una forma sobre la otra.
const _PIDE_PROSA = /\ben\s+prosa\b|\btexto\s+corrido\b|\bs[oó]lo\s+texto\b|(?<![a-záéíóúñ])(?:s[oó]lo|solamente|[uú]nicamente|nada\s+m[aá]s\s+que)\s+(?:en\s+|con\s+)?palabras\b|\bhabl[aá]ndolo\b|\b(?:prefiero|preferir[ií]a|prefiera)\s+(?:la\s+)?prosa\b|\b(?:en\s+)?formato\s+narrativ\w+|\ben\s+forma\s+narrativa\b/i;

// pidePresentacionTabular(text) → true si el turno pide EN POSITIVO la tabla o el detalle que se entrega tabulado.
// Es el mismo trío que produce `required` en `resolveTablePolicy`; se nombra una vez para que la regla de polisemia
// y la precedencia no puedan divergir.
export function pidePresentacionTabular(text) {
  const t = String(text || "");
  return pideTablaExplicita(t) || pideDetalleTemporal(t) || pideDetalleComposicion(t);
}

/* ── LA PROHIBICIÓN INEQUÍVOCA · el escalón 1 de la precedencia (owner 2026-08-11) ─────────────────────────────
 * Distingue una ORDEN sobre la respuesta de ahora («explicalo sin repetir la tabla») de un RECLAMO sobre la
 * respuesta de antes («me dejaste sin la tabla que te pedí»). Las dos niegan el sustantivo; sólo una prohíbe.
 * LA MARCA ES EL TIEMPO Y EL MODO, no la frase: un reclamo habla en indicativo pasado de lo que ADI hizo
 * («dejaste», «diste», «llegó», «aparecieron», «mandaste», «pediste»); una orden viene en imperativo, o como
 * «nada de X», o acompañada de un pedido POSITIVO de la otra forma («contame», «explicame», «decime»).
 * ANTE LA DUDA NO PROHÍBE: devuelve false y el turno cae a `auto`, donde el PLAN —que sí entiende que hay una
 * solicitud vigente— declara la forma. Un respaldo determinístico que adivina de más le niega al usuario lo que
 * pidió; uno que adivina de menos sólo delega. */
const _RECLAMO_PASADO = /\b(?:dejaste|diste|dieron|lleg[oó]|lleg[aá]ron|vino|vinieron|aparecier?on?|mandaste|pasaste|mostraste|armaste|inclu[ií]ste|copiaste|repetiste|ped[ií]|qued[eé]|quedamos|qued[oó])\b/i;
const _PIDE_LA_OTRA_FORMA = /\b(?:cont[aá]me|cu[eé]ntame|explic[aá]\w*|expl[ií]came|dec[ií]me|dime|resum[ií]\w*|narr[aá]\w*|describ[ií]\w*|hablame|h[aá]blame)\b/i;
const _NADA_DE_TABLA = new RegExp(`\\bnada\\s+de\\s+${_TABLA_N_FORMA}`, "i");
// «sin tabla» / «sin tablas» / «sin planillas» como DIRECTIVA. El determinante lo excluye a propósito: «sin LA
// tabla» describe una ausencia («me quedé sin la tabla»), mientras que «sin tabla» pelado es una instrucción
// sobre la forma. Es la misma distinción que hace el español, no una convención de este archivo.
const _SIN_TABLA_DIRECTIVO = new RegExp(`\\bsin\\s+${_TABLA_N_FORMA}`, "i");
export function prohibeFormaTabularInequivoco(text) {
  const t = String(text || "");
  // (a) órdenes que no admiten otra lectura: «nada de tablas», el verbo negado en modo de orden, pedir prosa.
  if (_NADA_DE_TABLA.test(t)) return true;
  if (_PROHIBE_FORMA.some((re) => re.test(t))) return true;
  if (_PIDE_PROSA.test(t) && !pideTablaExplicita(t)) return true;
  // (b) negación del sustantivo inequívoco ACOMPAÑADA de un pedido de la otra forma, y sin marca de reclamo.
  //     «Explicalo sin repetir la tabla» entra; «me dejaste sin la tabla que te pedí» no.
  if (_negaciones(_TABLA_N_FORMA).some((re) => re.test(t)) && _PIDE_LA_OTRA_FORMA.test(t) && !_RECLAMO_PASADO.test(t)) return true;
  // (c) «SIN TABLA» A SECAS ES UNA ORDEN (regla 2 del owner: «sin tabla, nada de tablas o equivalente → prosa,
  //     nunca tabla»). No necesita que el turno pida además la otra forma: «dame solo las cifras, sin tabla» ya
  //     dijo todo lo que hay que saber. Lo único que la desactiva es la marca de RECLAMO —«me quedé sin la
  //     tabla», «me dejaste sin la tabla que te pedí»—, donde «sin» describe lo que faltó, no lo que se prohíbe.
  if (_SIN_TABLA_DIRECTIVO.test(t) && !_RECLAMO_PASADO.test(t)) return true;
  return false;
}

// prohibeFormaTabular(text) → true si el turno PROHÍBE la forma tabular (o pide su opuesto, la prosa).
export function prohibeFormaTabular(text) {
  const t = String(text || "");
  // 1 · negación de un sustantivo INEQUÍVOCO de forma: es una orden y gana siempre.
  if (_PROHIBE_FORMA.some((re) => re.test(t))) return true;
  // 2 · si el turno pidió la tabla en positivo, lo que quede negado abajo es una PARTE del contenido —o el turno
  //     pidió las DOS formas—. En los dos casos la tabla se entrega: negar una columna no mata la tabla.
  if (pidePresentacionTabular(t)) return false;
  // 3 · sin pedido positivo que la contradiga, la negación de un polisémico y el pedido de prosa sí prohíben.
  return _PROHIBE_PARTE.some((re) => re.test(t)) || _PIDE_PROSA.test(t);
}

// ── CONTINUIDAD DE FORMA · "mantené el formato" es una anáfora, no una frase ────────────────────────────────────
// La política se recalculaba de cero en cada turno, así que "mantené el formato" / "igual que antes" / "en el mismo
// cuadro" eran LITERALMENTE inexpresables: no había ningún parámetro por el que la decisión del turno anterior
// pudiera entrar. Medido: pedirle a ADI que mantuviera la tabla del turno previo devolvió prosa.
// SE DETECTA EN DOS PIEZAS SEPARADAS —un verbo de continuidad EN CUALQUIER PARTE del mensaje y un sustantivo de
// forma EN CUALQUIER PARTE— y no como una frase pegada, porque el pedido real casi nunca viene pegado: «mantené el
// período y EL FORMATO» tiene otro complemento en el medio, y un detector de frase contigua no lo ve.
// LOS DOS CAMINOS NO SON EL MISMO, y confundirlos era el defecto (revisión adversarial 2026-08-11):
//   · VERBO DE CONTINUIDAD ("mantené", "conservá", "seguí con", "igual que antes") + sustantivo de forma en
//     cualquier parte. El verbo YA es inequívoco, así que la distancia no importa.
//   · "MISMO/MISMA" es otra cosa: solo, es un adjetivo cualquiera del español y aparece en preguntas que no piden
//     ninguna continuidad. La primera versión lo aceptaba SUELTO y en cualquier parte, así que «¿Por qué el mismo
//     MES muestra otra cifra en la TABLA?» daba true — dos palabras sin ninguna relación sintáctica entre sí. Acá
//     se exige ADYACENCIA: "mismo" tiene que estar pegado al sustantivo de forma ("el mismo cuadro", "la misma
//     vista"). Hoy esto no hace daño porque nadie cablea `politicaPrevia`; el día que se cablee, heredar la forma
//     de un turno anterior sin que el usuario la pidiera es exactamente el falso positivo que no queremos.
// Y DOS CORTES DE DEIXIS, los mismos que ya usa `_PIDE_TABLA_NOMINAL` unas líneas más arriba:
//   · relativo pegado → «es la misma tabla QUE vimos ayer» habla DE la tabla, no pide conservarla.
//   · cópula delante → «¿es la misma vista?» es una pregunta sobre lo que ya está en pantalla.
// (`\bconserv` sin cierre: con `\bconserv\w+`, la forma imperativa REAL —«conservá»— no matcheaba, porque `\w`
//  es ASCII y no cubre la "á". Misma trampa que este archivo documenta en `_TEMPORAL` y `_DESGLOSE`.)
const _CONTINUIDAD_V = /\bmant[eé]n\w*|\bmanten[eé]\w*|\bconserv|\bsegu[ií]\w*\s+(?:con|igual)|\bdej[aá]\w*\s+igual|\bigual\s+(?:que|a)\s+(?:antes|el\s+anterior|la\s+anterior|reci[eé]n)/i;
const _CONTINUIDAD_N = /\bformato\b|\bpresentaci[oó]n\b|\bestructura\b|\bforma\s+de\s+(?:la\s+)?respuesta\b|\bvista\b|\bcuadro\b|\btabla\b/i;
const _CONTINUIDAD_MISMO = /\bmism[oa]\s+(?:formato|presentaci[oó]n|estructura|vista|cuadro|tabla|planilla|grilla|forma)\b(?!\s+que\b)/i;
const _DEIXIS_COPULA = /\b(?:es|son|era|eran|ser[áa]|fue|fueron)\s+(?:la|el|las|los)?\s*mism[oa]s?\b/i;
export function pideMantenerLaForma(text) {
  const t = String(text || "");
  if (_CONTINUIDAD_V.test(t) && _CONTINUIDAD_N.test(t)) return true;
  if (_DEIXIS_COPULA.test(t)) return false;
  return _CONTINUIDAD_MISMO.test(t);
}

// resolveTablePolicy({text, podado, politicaPrevia}) → "forbidden" | "required" | "auto"
// PRECEDENCIA, de arriba hacia abajo. Lo que cambió y lo que NO:
//   1. PROHIBICIÓN DEL USUARIO · gana sobre todo, incluso sobre un disparador positivo co-ocurrente. Es la mitad
//      que faltaba del eje (ver el bloque de arriba).
//   2. PEDIDO EXPLÍCITO DEL USUARIO · `required`. INTACTO respecto del fix del owner 2026-08-07: sigue ganando
//      sobre el `forbidden` de la PODA — "si el usuario pidió la tabla, la pidió", y se le tabula lo que hay. Lo
//      que se invirtió NO es esa precedencia: es que ahora existe un `forbidden` que NO viene de la poda sino de
//      una orden del usuario, y una orden del usuario no puede perder contra la inferencia del motor.
//   3. CONTINUIDAD · "mantené el formato" hereda la decisión REAL del turno anterior (required/forbidden). Un
//      `auto` previo no se hereda: `auto` significa que nadie decidió nada, no hay forma que conservar.
//   4. REDUCCIÓN DE LARGO · "solo la conclusión", "en una línea" (vocabulario de responsePreference.js). Una
//      respuesta de una línea no se entrega en doce filas: pedir menos y recibir una tabla es el mismo
//      incumplimiento de forma que los de arriba, visto desde el largo. OJO: es `pideReduccionDeLargo`, NO
//      `pideReduccionDeForma` — la familia de REGISTRO ("al grano", "sin rodeos") corrige el TONO y no dice nada
//      sobre tabular; prohibirle la tabla a «andá al grano: dame el top 10 de clientes» era negarle al usuario una
//      forma que nadie prohibió. El registro sigue bajando `detailLevel` por su propio eje (responsePreference.js).
//   5. PODA · el detalle no viajó; tabular lo que queda sería reconstruirlo peor que la Ficha.
/* ══ FORMA DE SALIDA · EL CONTRATO, NO LAS FRASES (owner 2026-08-11, defecto 8 de la certificación) ═══════════
 * LAS CUATRO DIRECCIONES MEDIDAS, y las cuatro fallaron por el mismo motivo: la forma se adivinaba leyendo el
 * texto con detectores, y un detector es una lista de frases que siempre se queda corta.
 *   · «mantené el formato» (venía una tabla)   → prosa
 *   · «explicalo sin repetir la tabla»          → una tabla, y ni una línea de explicación
 *   · «ahora solo la conclusión, nada más»      → una tabla de clientes, y encima de otro tema
 *   · «hablame directo y sin rodeos»            → doce filas sin una sola frase
 * AHORA LA DECLARA EL PLAN (`pref.outputForm`, turn-local) y los detectores quedan de RESPALDO: si el plan no
 * dice nada, se sigue infiriendo como hasta hoy, pero cuando dice, MANDA. Un contrato que el modelo llena es
 * auditable; una regex es una apuesta.
 * `detailLevel` y `outputForm` son EJES DISTINTOS: «directo» reduce el detalle y NO puede borrar una tabla que el
 * usuario pidió expresamente — ese era el caso «directo + tabla» que rompía las dos reglas a la vez. */
export const OUTPUT_FORMS = ["auto", "tabla", "prosa", "solo_conclusion"];
export function resolveOutputForm({ plan = null, text = "", politicaPrevia = null } = {}) {
  const declarada = plan && plan.pref && plan.pref.outputForm;
  if (OUTPUT_FORMS.includes(declarada) && declarada !== "auto") return declarada;
  // RESPALDO DETERMINÍSTICO · sólo cuando el plan no declaró nada. Reusa los detectores que ya existen; no se
  // inventa un segundo criterio ni una segunda lista de frases.
  const t = String(text || "");
  /* LA PRECEDENCIA APROBADA (owner 2026-08-11, decisión de producto del defecto 3). En este orden:
   *  1. PROHIBICIÓN INEQUÍVOCA de tabla → prosa. Es la instrucción explícita del turno y le gana a todo: a la
   *     herramienta, al formato anterior y a cualquier disparador implícito de contenido.
   *  2. PEDIDO EXPLÍCITO de tabla → tabla («en una tabla», «hazme un cuadro»). Pedir tabla Y explicación cae acá:
   *     es tabla CON interpretación, que la garantiza el renderer.
   *  3. REDUCCIÓN DE LARGO → sólo la conclusión.
   *  4. PEDIDO IMPLÍCITO (una serie mes a mes, un desglose) → tabla. Es una SUGERENCIA de presentación, no una
   *     instrucción: por eso va después de la prohibición y nunca la vence. «cuál fue el peor mes» no obliga.
   * EL RESPALDO ES CONSERVADOR, y ésa es la diferencia con la versión anterior: ante una negación AMBIGUA —un
   * reclamo como «me dejaste sin la tabla que te pedí», que niega el sustantivo sin prohibir nada— NO resuelve
   * prosa: cae a `auto` y deja decidir al PLAN, que es quien entiende que hay una solicitud vigente. Detectar
   * reclamos con patrones era el camino equivocado: cada frase nueva pedía otro patrón. */
  if (prohibeFormaTabularInequivoco(t)) return "prosa";
  if (pideTablaExplicita(t)) return "tabla";
  if (pideReduccionDeLargo(t)) return "solo_conclusion";
  // 4. EL PEDIDO IMPLÍCITO NO OBLIGA (regla 6 del owner). Una serie mes a mes o un desglose SUGIEREN tabla, y esa
  //    sugerencia sigue viva donde corresponde —`resolveTablePolicy`, que es la política de presentación—, pero no
  //    fija la FORMA del turno: «¿cuál fue el peor mes?» es una pregunta puntual que se contesta en una línea.
  //    Acá se devuelve `auto` y decide el motor con todo el contexto, que es más de lo que ve un detector.
  // CONTINUIDAD EXPLÍCITA, nunca arrastre: sólo si el turno PIDE mantener la forma. Una forma no se hereda sola —
  // ese era el otro medio defecto: la corrección de formato de un turno contaminaba el siguiente.
  if (politicaPrevia && pideMantenerLaForma(t)) return politicaPrevia;
  return "auto";
}

export function resolveTablePolicy({ text = "", podado = [], politicaPrevia = null } = {}) {
  if (prohibeFormaTabular(text)) return "forbidden";
  if (pidePresentacionTabular(text)) return "required";
  if ((politicaPrevia === "required" || politicaPrevia === "forbidden") && pideMantenerLaForma(text)) return politicaPrevia;
  if (pideReduccionDeLargo(text)) return "forbidden";
  if (podado.length) return "forbidden";
  return "auto";
}

// ── SALIDA DETERMINÍSTICA EN PROSA · sin otra llamada al LLM ───────────────────────────────────────────────────
// Si el narrador arma una tabla donde no está permitida, NO se reintenta: reintentar cuesta otra llamada y el
// problema no es de suerte, es de forma. Se compone la respuesta desde los claims YA autorizados, en prosa, con
// el mismo arco qué pasa / por qué / qué hacer primero. Cada cifra sale VERBATIM del claim, así que este texto
// pasa guardC por construcción — no hay ninguna cifra que no estuviera autorizada.
// Respeta la Regla de Proporcionalidad: nombra "tu benchmark" (nunca sectorial), dice "una causa comprobada"
// (nunca "la principal"), y no afirma rentabilidad.
const _M = (claims, re) => claims.find((c) => c && re.test(String(c.metrica || "")));
const _cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : s);
export function composeProsaEjecutiva(claims, { entidad = null, hayDetalleEnFicha = true } = {}) {
  const cs = (Array.isArray(claims) ? claims : []).filter(Boolean);
  const dueño = entidad || (cs.find((c) => c.sujetoTipo === "entidad") || {}).entidad || null;
  if (!dueño) return null;
  const míos = cs.filter((c) => c.entidad === dueño);
  if (!míos.length) return null;
  const ventas = _M(míos, /^ventas?\b/i), margen = _M(míos, /^margen$/i), contrib = _M(míos, /^contribuci[oó]n$/i);
  const rank = _M(míos, /^ranking por venta$/i), brecha = _M(míos, /brecha de margen/i);
  const bench = _M(cs, /^benchmark de margen$/i);
  const palanca = míos.find((c) => c.coberturaCausal === "parcial" && c.explica);
  const capital = míos.find((c) => /capital detenido/i.test(String(c.metrica || "")) && /subtotal/i.test(String(c.metrica || "")));

  const p = [];
  // QUÉ PASA
  const qué = [];
  if (ventas) qué.push(`${dueño} vendió ${ventas.valor}`);
  if (rank) qué.push(`y está ${rank.valor} por venta`);
  if (qué.length) p.push(_cap(qué.join(" ")) + ".");
  else if (contrib) p.push(`${dueño} aporta ${contrib.valor} de contribución.`);
  // POR QUÉ
  if (margen && bench && brecha) p.push(`Su margen es ${margen.valor}, ${brecha.valor} de brecha contra tu benchmark de ${bench.valor}.`);
  else if (margen) p.push(`Su margen es ${margen.valor}.`);
  // QUÉ HACER PRIMERO — la prioridad es una frase con su monto, nunca una tabla
  if (palanca) {
    const resto = palanca.explica.fraccion
      ? ` Explica ${palanca.explica.monto} de ${palanca.explica.universo} (${palanca.explica.fraccion}); el resto permanece abierto.`
      : " Es una parte comprobada; el resto de la brecha permanece abierto.";
    // artículo: las métricas de palanca son sustantivos ("exceso de acciones comerciales", "capital detenido") —
    // sin "el/la" la frase queda agramatical ("es exceso de acciones comerciales").
    const m = String(palanca.metrica).toLowerCase();
    const art = /^(brecha|carga|meta|contribuci)/.test(m) ? "la" : "el";
    p.push(`Una causa comprobada es ${art} ${m}: ${palanca.valor}.${resto}`);
  }
  if (capital) p.push(`Además tienes ${capital.valor} de capital detenido en el inventario del mix que le vendes — es capital de tu negocio, no de ${dueño}.`);
  if (!p.length) return null;
  if (hayDetalleEnFicha) p.push(`El detalle está en la ficha de ${dueño} en Sentrix.`);
  return p.join(" ");
}

export function buildDisclosureInstruction({ podado = [], entidad = null } = {}) {
  if (!podado.length) return "";
  const quien = entidad ? `de ${entidad}` : "de esta entidad";
  return `DIVULGACIÓN PROGRESIVA — esta es una consulta GENERAL ${quien}: respondé QUÉ PASA, POR QUÉ y QUÉ HACER PRIMERO, en prosa ejecutiva. NO armes ninguna tabla: no tenés autorizado el detalle (${podado.join(" · ")}) porque el usuario no lo pidió, y ese detalle vive en la Ficha de Sentrix. La prioridad SÍ se nombra concreta y con su monto (eso es una frase, no una tabla). Cerrá ofreciendo la Ficha —"Ver ficha en Sentrix"— para el detalle, nunca prometiendo que "podés profundizar" sin decir dónde. Si el usuario después pide la evolución, el mes a mes o la composición, ahí sí se la traés.`;
}

/* ══ CONTRATO DE RESPUESTA PROPORCIONAL (owner · Contrato de Concordancia ADI ↔ Sentrix) ═══════════════════════════
 * "Por defecto las tres reglas (1 qué pasa / 2 por qué, distinguiendo PROBADO-INDICADO-ABIERTO / 3 qué hacer
 *  primero con una sugerencia concreta). Una pregunta puntual NO se convierte en informe: primero responde directo,
 *  después solo la interpretación necesaria. Si pide 'solo el dato' o equivalente semántico: dato, período y
 *  alcance, nada más. Para 'explicame este gráfico': qué mide, cuál es su universo, qué patrón importa, qué sabemos
 *  de su causa y qué conviene revisar primero."
 *
 * POR QUÉ VIVE ACÁ Y NO EN UN MÓDULO NUEVO. La FORMA de la respuesta ya se decidía en este archivo (resolveTablePolicy
 * es exactamente eso: una decisión de presentación del turno, con tres estados, sellada en el contrato y validada por
 * el guard). La forma proporcional es la MISMA clase de decisión, un eje más — no un segundo contrato de respuesta,
 * no una segunda preferencia. `pref` (responsePreference.js) sigue siendo la ÚNICA fuente de "solo el dato"/"solo la
 * acción" y de su detección: acá se la CONSULTA, nunca se la reimplementa.
 *
 * LA FRONTERA CON pref, para que no haya dos verdades:
 *   · pref  = lo que el USUARIO pidió sobre cómo recibir la respuesta (data_only/action_only/results_only/brief).
 *             Detectado por comprensión en PLAN (buildPrefDoctrine) + la red determinística (_coercePref).
 *   · shape = la PROPORCIÓN que le corresponde a este turno cuando el usuario NO pidió nada especial: puntual,
 *             explicar un componente de Sentrix, o el arco completo. Se deriva del texto + el plan + el ViewContext.
 * Cuando pref dice algo, pref GANA — shape ni siquiera opina (ver resolveAnswerShape, precedencia 1).
 *
 * PURO · SIN ESTADO · SIN LLM · gate-testable, igual que el resto de este archivo.
 */

// LAS CUATRO FORMAS. `null` NO es una forma: es "este turno no agrega ninguna instrucción de forma" (porque ya la
// gobierna otro contrato — la preferencia de respuesta o el modo clarify, que reemplaza el arco entero).
export const ANSWER_SHAPES = ["solo_dato", "explicar_componente", "puntual", "tres_reglas"];

// ── DEIXIS DE COMPONENTE · UNA sola definición, acá ────────────────────────────────────────────────────────────
// "este gráfico", "esa barra", "ese punto", "los de arriba", "este número", "acá". Apunta a lo que el usuario tiene
// EN PANTALLA — es un eje DISTINTO de la deixis de ENTIDAD ("estos clientes", "esos SKU"), que vive en
// conversationScope.js con su propio motor de resolución. Las DOS puntas que la necesitan (la forma de la respuesta,
// acá; la resolución de referencias, conversationScope.js) importan ESTA — nunca declaran una segunda.
// Vive en este archivo, y no en conversationScope.js, por una razón de dependencias: este módulo es PURO y su única
// importación es un módulo HOJA (viewManifest.js, que no importa nada), así que puede ser consumido por
// conversationScope.js, narrationContract.js y answerViaOracle.js sin ningún riesgo de ciclo. Al revés no era
// cierto — y por eso cualquier import que se agregue acá tiene que seguir siendo de una hoja.
// OJO CON `\b` Y LOS ACENTOS (mismo cuidado ya documentado arriba en _TEMPORAL/_DESGLOSE): en JavaScript `\b` es
// ASCII, así que NO cierra después de "á" — `\bac[aá]\b` no reconoce "acá" (el caso real que se escribe). Se cierra
// con una lookahead negativa de letra (acentuadas incluidas) en vez de `\b`.
// OJO CON EL PLURAL MASCULINO: `est[ae]s?` NO reconoce "estos"/"esos" (les falta la "o") — cazado por la prueba del
// detector con "esos números", que es exactamente como se escribe. La clase correcta es `[aeo]`.
export const DEICTIC_COMPONENT_RE = new RegExp([
  // "este/esta/estos/estas + <pieza de pantalla>"
  "\\best[aeo]s?\\s+(?:gr[aá]fic|tabl|vist|pantall|secci[oó]n|kpi|card|tarjet|barra|l[ií]nea|curva|columna|cuadro|panel|bloque|lectura|cifra|n[uú]mero|dato|punto|fila|celda|indicador|serie)",
  // "ese/esa/esos/esas + <pieza de pantalla>" (el punto de una serie, la barra del pareto, la fila de la tabla)
  "\\bes[aeo]s?\\s+(?:gr[aá]fic|tabl|punt|barr|fil|celda|dato|l[ií]nea|columna|curva|kpi|cifra|n[uú]mero|cuadro|bloque|indicador|serie)",
  // posicional sobre lo que se ve
  "\\b(?:los|las)\\s+de\\s+arriba\\b",
  "\\b(?:el|la)\\s+(?:primer[ao]|[uú]ltim[ao])\\s+(?:de\\s+)?(?:la\\s+)?(?:tabla|lista|columna|serie)\\b",
  // "acá", "lo que estoy viendo", "en pantalla"
  "\\bac[aá](?![a-z\\u00e0-\\u00ff])",
  "\\blo\\s+que\\s+(?:estoy\\s+)?(?:veo|viendo|aparece)\\b",
  "\\ben\\s+pantalla\\b",
  // EL PRONOMBRE PELADO — "explicame esto", "¿por qué pasó esto?", "¿y esto?". Es la PRIMERA forma que el owner
  // enumeró ("debe entender «esto», «ese gráfico», «los de arriba»…") y la que faltaba: las alternativas de arriba
  // exigen todas un sustantivo de pantalla detrás del demostrativo, así que "esto" a secas —que es exactamente
  // como se escribe cuando ya se está señalando algo— no resolvía nada. Cazado por la prueba de deixis del gate
  // de concordancia semántica, con las tres formas reales.
  // NEUTRO ESTRICTO, y ese es todo el candado: la lookahead de letra hace que "esto"/"eso" NO matcheen dentro de
  // "estos"/"esos" (que son deixis de ENTIDAD y tienen su propio motor en conversationScope.js) ni de "estoy",
  // y el \b inicial evita "peso"/"esposo". El neutro en español no puede referirse a una entidad con nombre —
  // sólo a una cosa señalada—, así que apuntar a la pieza en pantalla es la única lectura posible.
  // Ningún consumidor se dispara solo con esto: `resolveAnswerShape` exige ADEMÁS un ViewContext vivo y un verbo
  // de explicación, y `resolveComponentReference` exige el ViewContext. Sin pantalla declarada, "esto" sigue
  // siendo irresoluble — que es lo correcto.
  "\\b(?:esto|eso)(?![a-z\\u00e0-\\u00ff])",
].join("|"), "i");

// ── LOS CUATRO VERBOS QUE SEPARAN LAS FORMAS ───────────────────────────────────────────────────────────────────
// Explicar un componente ("qué mide esto"), pedir la causa ("por qué pasó"), pedir la acción ("qué hago") y pedir el
// panorama ("resumen"). No son listas cerradas de frases: son las FAMILIAS que el producto ya reconoce en su propia
// doctrina de modos (conversationalContract.js) — acá solo se las lee para dimensionar la respuesta, nunca para
// elegir el modo (eso lo sigue haciendo PLAN por comprensión).
// EL MISMO CUIDADO DE ACENTOS, otra vez y en el lugar que más dolía: `\bpor\s+qu[eé]\b` NO reconoce "por qué" —
// "é" no es carácter de palabra para `\b` (ASCII), así que el cierre nunca ocurre y la causa quedaba sin detectar.
// Cazado por la prueba del detector: "¿por qué cayó el margen?" se clasificaba como pregunta PUNTUAL, es decir
// exactamente el turno que MÁS necesita el arco completo. Se cierra con lookahead de letra, nunca con `\b`.
const _FINP = "(?![a-z\\u00e0-\\u00ff])";   // fin de palabra REAL (tolera la vocal acentuada final)
const _EXPLICA_RE = /\bexplic\w*|\bqu[eé]\s+(?:significa|quiere\s+decir|mide|muestra|representa|refleja|es\b)|\bc[oó]mo\s+(?:se\s+)?(?:lee|leo|interpret\w*)\b|\bqu[eé]\s+me\s+(?:dice|est[aá]\s+diciendo)\b/i;
const _CAUSA_RE = new RegExp(`\\bpor\\s+qu[eé]${_FINP}|\\bporqu[eé]${_FINP}|\\ba\\s+qu[eé]\\s+se\\s+debe\\b|\\bqu[eé]\\s+(?:lo\\s+)?(?:explica|caus\\w*|provoc\\w*|origin\\w*)\\b|\\bmotivo\\b|\\bra[zs][oó]n\\s+de\\b`, "i");
const _ACCION_RE = /\bqu[eé]\s+(?:hago|hacemos|hacer|deber[ií]a|conviene|prioriz\w*|recomend\w*|recomiend\w*|sigue)\b|\bpor\s+d[oó]nde\s+(?:empiezo|arranco|parto|empezar)\b|\bcu[aá]l\s+(?:ataco|prioriz\w*|primero)\b|\bplan\s+de\s+acci[oó]n\b|\bqu[eé]\s+revis\w*\s+primero\b/i;
const _PANORAMA_RE = /\bresumen\b|\bpanorama\b|\bdiagn[oó]stico\b|\bc[oó]mo\s+(?:viene|va|est[aá])\s+(?:el\s+)?(?:negocio|la\s+empresa|todo)\b|\bfoto\s+completa\b|\bcontame\s+(?:de|del|sobre)\b|\bperfil\s+de\b/i;

// Interrogativa real o pedido directo de un dato. La forma "puntual" exige UNA de las dos — un enunciado suelto
// ("el margen de Falabella viene raro") no es una pregunta puntual, es material de diagnóstico.
const _PREGUNTA_RE = new RegExp(`^\\s*[¿?]|\\?\\s*$|^\\s*(?:cu[aá]nt|cu[aá]l|qui[eé]n|d[oó]nde|cu[aá]ndo|qu[eé]${_FINP})`, "i");
const _PEDIDO_DATO_RE = /^\s*(?:dame|d[ae]me|decime|dime|mostrame|mu[eé]strame|traeme|tr[aá]eme|pasame|p[aá]same|quiero\s+(?:saber|ver)|necesito\s+(?:saber|ver))\b/i;

// esPreguntaPuntual({text, plan}) → true si el turno es UNA pregunta concreta sobre UNA cosa, sin pedir causa,
// acción, panorama ni detalle. La señal es doble y las dos tienen que dar: la FORMA del texto (pregunta o pedido de
// dato) y lo que el PLAN resolvió (modo default — es decir, ninguno de los 6 modos con contrato propio — con pocas
// llamadas y sin un perfil/resumen de por medio). El plan ya hizo la comprensión; acá no se vuelve a adivinar.
export function esPreguntaPuntual({ text = "", plan = null } = {}) {
  const t = String(text || "");
  if (!t.trim()) return false;
  if (_CAUSA_RE.test(t) || _ACCION_RE.test(t) || _PANORAMA_RE.test(t)) return false;
  // pedir la serie, el desglose o una tabla es pedir DETALLE: eso tiene su propia forma (tabla obligatoria), y una
  // respuesta "directa y corta" ahí sería incumplir lo que se pidió.
  if (pideDetalleTemporal(t) || pideDetalleComposicion(t) || pideTablaExplicita(t)) return false;
  if (!(_PREGUNTA_RE.test(t) || _PEDIDO_DATO_RE.test(t))) return false;
  const modo = (plan && plan.mode) || "default";
  if (modo !== "default") return false;   // los otros 6 modos YA tienen su propio contrato de forma
  const calls = (plan && Array.isArray(plan.calls)) ? plan.calls.filter(Boolean) : [];
  if (calls.some((c) => c.tool === "entityProfile" || c.tool === "executiveSummary")) return false;
  return calls.length <= 2;
}

// ── LA DECISIÓN · un solo lugar, con precedencia explícita ─────────────────────────────────────────────────────
// resolveAnswerShape({text, plan, viewContext, pref}) → "solo_dato" | "explicar_componente" | "puntual" |
//                                                       "tres_reglas" | null
//   1. pref.contentScope ≠ "full" GANA SIEMPRE. data_only/results_only → "solo_dato". action_only → null: su
//      dispatch ya existe entero (buildPrefDispatch + blockInstructionFor, responsePreference.js) y duplicarlo acá
//      sería exactamente la segunda verdad que el contrato prohíbe.
//   2. modo clarify → null: su contrato REEMPLAZA el arco completo (conversationalContract.js), no se le superpone
//      ninguna forma.
//   3. hay ViewContext + deixis de componente + verbo de explicación → "explicar_componente".
//   4. pregunta puntual → "puntual" (directo primero, interpretación mínima después).
//   5. resto → "tres_reglas" (el default que fijó el owner).
export function resolveAnswerShape({ text = "", plan = null, viewContext = null, pref = null } = {}) {
  const alcance = (pref && pref.contentScope) || "full";
  if (alcance === "data_only" || alcance === "results_only") return "solo_dato";
  if (alcance === "action_only") return null;
  if (plan && plan.mode === "clarify") return null;
  const t = String(text || "");
  if (viewContext && DEICTIC_COMPONENT_RE.test(t) && _EXPLICA_RE.test(t)) return "explicar_componente";
  if (esPreguntaPuntual({ text: t, plan })) return "puntual";
  return "tres_reglas";
}

// ── LA GRADUACIÓN, ATADA A ESTE TURNO (no doctrina genérica) ───────────────────────────────────────────────────
// El owner: "el POR QUÉ distingue PROBADO / INDICADO / ABIERTO". Esa gradación YA existe como criterio en el system
// prompt, pero ahí es genérica: no sabe QUÉ cifras de ESTE turno son medición directa y cuáles son una cuenta del
// motor. El sello sí lo sabe — `claim.estatus` sale del fig (formula/source), nunca del texto. Esto lo pone delante
// del narrador en el momento en que escribe, nombrando las métricas concretas.
// PAYLOAD MÍNIMO (mismo principio que nivel_aclaracion/preferencia_respuesta): si TODO el turno es probado y no hay
// ninguna pregunta abierta, no hay nada que graduar → cadena vacía → la clave ni aparece.
const _MAX_METRICAS_GRADUACION = 4;
function _metricasPorEstatus(claims, estatus) {
  const out = [];
  for (const c of (Array.isArray(claims) ? claims : [])) {
    if (!c || c.estatus !== estatus || !c.metrica) continue;
    if (!out.includes(c.metrica)) out.push(c.metrica);
    if (out.length >= _MAX_METRICAS_GRADUACION) break;
  }
  return out;
}
export function buildGraduacionInstruction(claims = [], preguntasAbiertas = []) {
  const indicadas = _metricasPorEstatus(claims, "indicado");
  const probadas = _metricasPorEstatus(claims, "probado");
  const abiertas = (Array.isArray(preguntasAbiertas) ? preguntasAbiertas : []).filter(Boolean);
  if (!indicadas.length && !abiertas.length) return "";   // nada que graduar: todo es medición directa
  const partes = [];
  if (probadas.length) partes.push(`PROBADO (medición directa, se afirma): ${probadas.join(" · ")}.`);
  if (indicadas.length) partes.push(`INDICADO (cuenta del motor sobre el dato, se dice como señal y nunca como hecho ya realizado): ${indicadas.join(" · ")}.`);
  if (abiertas.length) partes.push(`ABIERTO${abiertas[0] && abiertas[0].motivo ? ` (${abiertas[0].motivo})` : ""}: declaralo como límite y ofrecé lo que sí podés traer, nunca lo completes con una causa que el dato no da.`);
  return `EL POR QUÉ VA GRADUADO CON LO DE ESTE TURNO — ${partes.join(" ")} No hace falta escribir las etiquetas literales: lo que no puede fallar es que una cuenta del motor no se narre como medición.`;
}

// ── LAS INSTRUCCIONES DE FORMA, UNA POR CADA FORMA QUE SE DESVÍA DEL DEFAULT ───────────────────────────────────
// PUNTUAL: el pedido explícito del owner — "primero responde directo, después solo la interpretación necesaria".
const PUNTUAL_INSTRUCTION = "FORMA DE ESTA RESPUESTA — PREGUNTA PUNTUAL, NO UN INFORME. Abrí con la RESPUESTA a lo que se preguntó: el dato con su unidad, su entidad y su período, en la PRIMERA oración. Recién después, y SOLO si aporta algo que el dato no dice solo, sumá una frase de lectura (la comparación contra la referencia, o qué mirar). Está PROHIBIDO desplegar el arco completo acá: nada de panorama, nada de recorrer otras entidades que no se preguntaron, nada de cerrar con un plan de acción de varios frentes. Si la respuesta entera entra en dos oraciones, que sean dos oraciones — no la estires para que parezca un análisis.";

// SOLO EL DATO: la instrucción NO se compone acá a propósito. El alcance data_only/results_only ya tiene su
// enforcement completo y estructural en responsePreference.js (blockInstructionFor/buildPrefDispatch) y en
// answerViaOracle.js, donde estos dos alcances ni siquiera invocan al narrador — la respuesta se COMPONE desde la
// boleta. Escribir acá una segunda instrucción para lo mismo sería la duplicación que el contrato prohíbe. Lo que
// SÍ faltaba de "dato, período y alcance" era el ALCANCE, y eso se resuelve donde se compone: buildAlcanceLine.
export function buildAlcanceLine(scope) {
  if (!scope || typeof scope !== "object") return "";
  const partes = [];
  const ents = Array.isArray(scope.entidades) ? scope.entidades.filter(Boolean) : [];
  if (ents.length === 1) partes.push(String(ents[0]));
  else if (ents.length > 1) partes.push(ents.slice(0, 3).map(String).join(", ") + (ents.length > 3 ? " y las demás cuentas del pedido" : ""));
  else if (scope.eje) partes.push(`todo el eje ${scope.eje}`);
  else partes.push("el negocio completo");
  if (ents.length && scope.eje) partes.push(`eje ${scope.eje}`);
  const filtros = (scope.filtros && typeof scope.filtros === "object") ? Object.entries(scope.filtros) : [];
  for (const [k, v] of filtros) if (v != null && v !== "") partes.push(`${k}: ${v}`);
  // sin conteos ni cifras: es una declaración de alcance, no un dato más (y así nunca introduce un número que el
  // guard no tenga autorizado).
  return `Alcance: ${partes.join(" · ")}.`;
}

// EXPLICAR UN COMPONENTE: los cinco movimientos que pidió el owner, compuestos DESDE el ViewContext. El contexto
// dice QUÉ está mirando el usuario — nunca cuánto vale nada: las cifras siguen saliendo de cifras_autorizadas.
// Duck-typed a propósito: lee los campos del ViewContext que existan y omite los que no. Así vale igual con el
// contexto sellado completo y con uno parcial, y nunca rompe el turno por un campo ausente.
// El nombre de la cara sale del MANIFIESTO (`VISTA_LABEL`, importado arriba), no de una copia local: una segunda
// tabla acá —aunque hoy fuera idéntica— haría que algún día ADI nombre la cara distinto de como la nombra Sentrix,
// que es exactamente la contradicción que este frente existe para cerrar.
// `_TIPO_LABEL` SÍ es de acá: `TIPOS` declara los tipos válidos, pero no su forma de decirlos en una oración.
const _TIPO_LABEL = {
  vista: "la vista completa", veredicto: "una lectura ejecutiva", kpi: "un indicador de cabecera", tabla: "una tabla",
  serie: "una serie de tiempo", barra: "un gráfico de barras", lista: "una lista", tira: "una tira de reconciliación",
};
export function buildComponentExplainInstruction(viewContext, claims = []) {
  const vc = viewContext && typeof viewContext === "object" ? viewContext : null;
  const vista = vc && vc.vista ? (VISTA_LABEL[vc.vista] || String(vc.vista)) : null;
  const tipo = vc && vc.tipo ? (_TIPO_LABEL[vc.tipo] || String(vc.tipo)) : null;
  const donde = vc ? [vista, vc.seccion ? `sección ${vc.seccion}` : null, vc.componentId || null].filter(Boolean).join(" › ") : null;

  const mide = [];
  if (vc && vc.metrica) mide.push(String(vc.metrica));
  if (vc && vc.eje) mide.push(`por ${vc.eje}`);
  if (vc && vc.periodo) mide.push(`en el período: ${vc.periodo}`);
  if (vc && vc.escenario) mide.push(`escenario ${vc.escenario}`);

  const uni = vc && vc.universo && typeof vc.universo === "object" ? vc.universo : null;
  const universo = uni ? [uni.label || uni.kind || null, uni.cierraCon ? `cierra con ${uni.cierraCon}` : null].filter(Boolean).join(" — ") : null;

  const sello = vc && vc.estatus ? String(vc.estatus) : null;
  // EL LÍMITE DECLARADO, no sólo la divergencia (owner 2026-08-09, decisión 11). Antes esta línea sólo se inyectaba
  // cuando el componente declaraba una divergencia numérica; un componente cuya cifra NO EXISTE en la evidencia
  // declarada (`unsupported` — el pie que ninguna tool entrega, la partición que nadie produce) no decía nada, y el
  // silencio se leía como "todo cierra". Ahora entra el límite de los dos estados que no son `reconciled`, y sólo
  // de esos: repetirle al modelo la razón de una cifra que SÍ cierra es ruido que no cambia ninguna respuesta.
  const _conc = vc && vc.concordancia && typeof vc.concordancia === "object" ? vc.concordancia : null;
  const divergencia = _conc && _conc.estado !== "reconciled" && _conc.razon ? String(_conc.razon) : null;
  const comparacion = vc && vc.comparacion ? String(vc.comparacion) : null;

  const pasos = [
    `(1) QUÉ MIDE — ${mide.length ? mide.join(", ") : "la métrica que muestra ese componente, con su unidad"}${tipo ? `; el componente es ${tipo}` : ""}.`,
    `(2) CUÁL ES SU UNIVERSO — ${universo || "sobre qué conjunto está calculado (todo el negocio, un grupo, una selección) y contra qué cierra"}${comparacion ? `. La comparación que muestra es contra ${comparacion}` : ""}.`,
    "(3) QUÉ PATRÓN IMPORTA — lo que de verdad hay que leer ahí, usando SOLO las cifras autorizadas de este turno (el máximo, el mínimo, la concentración, la brecha). Si una cifra no está autorizada, no la nombres.",
    `(4) QUÉ SABEMOS DE SU CAUSA — graduado${sello ? ` (el sello de este componente es «${sello}»)` : ""}: si el dato la prueba, afirmala; si es una señal, decila como señal; si no se cierra con este dato, declaralo abierto y decí qué haría falta.${divergencia ? ` LÍMITE DECLARADO de este componente: ${divergencia} — nombralo en vez de tapar la diferencia.` : ""}`,
    "(5) QUÉ CONVIENE REVISAR PRIMERO — una sola cosa, concreta, con su cifra si la tenés autorizada.",
  ];

  return `FORMA DE ESTA RESPUESTA — EXPLICAR LO QUE EL USUARIO TIENE EN PANTALLA${donde ? ` (${donde})` : ""}. Está mirando ESE componente y pide que se lo expliques, así que la respuesta recorre estos cinco movimientos, en PROSA corrida y sin rótulos ni numeración visible:\n  ${pasos.join("\n  ")}\nEL CONTEXTO DE PANTALLA NO TRAE CIFRAS y nunca las inventes desde él: dice QUÉ está mirando el usuario, no cuánto vale. Toda cifra sigue saliendo de cifras_autorizadas, verbatim. Y no describas la interfaz ("el gráfico tiene tres series de colores"): explicá el NEGOCIO que ese componente mide.`;
}

// buildAnswerShapeInstruction(shape, {viewContext, claims, preguntasAbiertas}) → la instrucción de NIVEL DE TURNO,
// o "" cuando la forma no necesita decir nada nuevo. Devolver "" es una decisión, no un olvido:
//   · "tres_reglas"  el arco de 3 movimientos YA es la doctrina del system (LA ESTRUCTURA, narratePromptC.js).
//                    Repetirlo en el payload sería pagar tokens por nada. Lo único que SÍ se agrega es la
//                    graduación atada a las cifras de este turno, y solo si hay algo que graduar.
//   · "solo_dato"    su enforcement es estructural (ver arriba): el narrador ni se invoca.
//   · null           otro contrato ya gobierna la forma (preferencia de respuesta o clarify).
export function buildAnswerShapeInstruction(shape, { viewContext = null, claims = [], preguntasAbiertas = [] } = {}) {
  if (shape === "explicar_componente") {
    const explicar = buildComponentExplainInstruction(viewContext, claims);
    const grad = buildGraduacionInstruction(claims, preguntasAbiertas);
    return grad ? `${explicar}\n${grad}` : explicar;
  }
  if (shape === "puntual") return PUNTUAL_INSTRUCTION;
  if (shape === "tres_reglas") return buildGraduacionInstruction(claims, preguntasAbiertas);
  return "";
}
