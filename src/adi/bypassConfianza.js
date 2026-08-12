/* === src/adi/bypassConfianza.js · CUÁNDO NO HACE FALTA PAGAR (owner 2026-08-12) ========================
 *
 * EL HALLAZGO QUE LO ORIGINA, medido: siete de siete preguntas típicas ya tienen respuesta COMPLETA sin llamar
 * al modelo — `coerceFloor` entiende la pregunta y `answerADIFromSpec` produce entre 500 y 1.800 caracteres de
 * lectura real. Pero el oráculo llama al planificador ANTES de descubrirlo: la ruta determinística vive después
 * del pago. Se paga por preguntas que el motor ya sabía contestar.
 *
 * QUÉ HACE ESTE MÓDULO: decide si el spec del coercer es lo bastante confiable como para responder SIN pagar.
 * No responde nada: solo dice sí o no. La respuesta la arma el motor de siempre.
 *
 * LA REGLA MADRE ES LA ASIMETRÍA DEL ERROR:
 *   · pagar de más cuando no hacía falta cuesta unos centavos;
 *   · contestar con seguridad la pregunta equivocada rompe la confianza en el producto.
 * Por eso ante CUALQUIER duda devuelve `false` y el turno sigue por el camino de siempre. Un bypass que atrapa
 * el 70% de los turnos y nunca se equivoca vale más que uno que atrapa el 95% y a veces contesta otra cosa.
 *
 * LA TRAMPA QUE CASI SE COLA, y por eso existe la regla 3: «el margen de Falabella» devuelve `entity: null` con
 * `focus: "bajo_benchmark"` — o sea el RANKING de la cartera, no Falabella. La respuesta sale bien formada,
 * con cifras correctas, y no es la pregunta. Sin la regla 3, el bypass habría servido eso con total aplomo.
 */

/* ¿El usuario NOMBRA una entidad puntual? Si la nombra, el spec TIENE que haberla resuelto.
 * LA PRIMERA VERSIÓN SOLO MIRABA DESPUÉS DE «de», y su propio gate la cazó: «¿cuánto vende Lider?» pasaba el
 * bypass con `entity:null`, así que se habría contestado con la lectura de ventas de toda la cartera en vez de
 * la de Lider. La forma en que se nombra una cuenta no es una preposición: es una MAYÚSCULA en mitad de la
 * frase. La inicial no cuenta —«¿Qué clientes…», «¿Dónde tengo…»— porque ahí la mayúscula es ortografía, no
 * un nombre propio. Y un SKU se reconoce por su forma (LG-DRYER8KG), que no depende de mayúscula inicial. */
const _NOMBRA_ENTIDAD_RE = /[a-záéíóúñ,)\d]\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.\-]{2,}|\b[A-Z]{2,}-[A-Z0-9]/;
/** Turnos que dependen del contexto anterior: nunca se resuelven mirando solo esta frase. */
const _DEPENDE_DEL_HILO_RE = /^\s*(?:y\s|pero\s|entonces\s|ah[íi]\s|eso|esos|esas|estos|estas|ese|esa|el\s+anterior|los\s+de\s+arriba|el\s+primero|el\s+[úu]ltimo)\b|\btambi[eé]n\b/i;

/**
 * ¿Se puede responder este turno sin gastar una llamada?
 * @param {string} texto  lo que escribió el usuario
 * @param {Object} spec   lo que devolvió `coerceFloor(texto)` — puede ser null
 * @param {Object} ctx    { hayHistoria, hayOfertaPendiente, clarifyStreak }
 * @returns {{ok:boolean, motivo:string}}  `ok:false` siempre trae el motivo, para poder medir por qué NO entra
 */
export function puedeResponderSinPagar(texto, spec, ctx = {}) {
  const t = String(texto || "").trim();
  const no = (motivo) => ({ ok: false, motivo });

  // 1 · SIN SPEC NO HAY NADA QUE EVALUAR. El coercer ya devuelve null para lo conversacional —«no entiendo»,
  //     «¿y Lider?», «sí, dale», «no, me refería a Sodimac»—, que es exactamente la frontera correcta.
  if (!spec || typeof spec !== "object") return no("el coercer no entendió la pregunta");

  // 2 · NO ES UNA PREGUNTA DE DATOS. Un saludo o una meta-pregunta no se contestan con una lectura del negocio.
  if (spec.turn_type && spec.turn_type !== "new_query") return no(`turn_type ${spec.turn_type}`);
  if (spec.meta) return no(`meta: ${spec.meta}`);

  // 3 · SI NOMBRÓ UNA ENTIDAD, EL SPEC TIENE QUE TRAERLA. Ésta es la regla que evita el error caro: sin ella,
  //     «el margen de Falabella» se contesta con el ranking de la cartera — bien formado, cifras correctas, y
  //     otra pregunta. Medido: ese spec devuelve entity:null y focus bajo_benchmark.
  if (_NOMBRA_ENTIDAD_RE.test(t) && !spec.entity) return no("nombra una entidad que el spec no resolvió");

  // 4 · EL SPEC TIENE QUE SER OPERABLE. Una operación sin métrica ni dimensión —«¿qué me recomendás?»— no es
  //     una lectura: es una conversación, y ahí el modelo aporta lo que el motor no.
  if (!spec.operation) return no("sin operación");
  if (!spec.metric && !spec.dimension && !spec.focus) return no("operación sin métrica, eje ni foco");

  // 5 · EL HILO MANDA SOBRE LA FRASE. Un turno que arranca con «y…», «eso», «los de arriba» se entiende con lo
  //     anterior, no solo. Aunque el coercer devuelva un spec, acá el contexto decide y eso es del planificador.
  if (_DEPENDE_DEL_HILO_RE.test(t)) return no("depende del turno anterior");

  // 6 · UNA ACLARACIÓN EN CURSO NO SE ATAJA. Si el turno pasado pidió precisión, esta respuesta la está dando y
  //     hay que leerla en contexto (ver `debeResponderSinRepreguntar` en dialogueState.js).
  if (Number(ctx.clarifyStreak) > 0) return no("hay una aclaración en curso");

  // 7 · UNA OFERTA PENDIENTE CAMBIA EL SENTIDO. «sí» o «el segundo» significan algo distinto con una oferta viva.
  if (ctx.hayOfertaPendiente) return no("hay una oferta pendiente");

  return { ok: true, motivo: "spec completo y sin dependencia del hilo" };
}
