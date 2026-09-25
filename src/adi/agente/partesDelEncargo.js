/* === src/adi/agente/partesDelEncargo.js · LAS PARTES DE UN ENCARGO, POR DOMINIO (owner 2026-09-14) ==============
 *
 * EL CASO REAL (producción v2.28, la prueba del owner): «Mira ventas, contribución, margen, unidades, inventario y
 * cobranza juntos. Dime qué clientes o SKU están empujando el crecimiento, cuáles están deteriorando el resultado, si
 * estoy acumulando stock donde no corresponde, si alguno de mis principales clientes también representa riesgo de
 * cobranza y dónde pondrías el foco primero. Separa qué puedes demostrar, qué solo está indicado y qué todavía no
 * sabes.» — y la respuesta fue solo margen/contribución. El routing detectó los tres dominios y el cerebro recibió
 * toda la evidencia; el modelo cayó y el ensamblador del encargo compuesto (v2.27) solo conocía partes COMERCIALES:
 * reconoció 2 de las 7 cosas pedidas y ninguna de inventario ni de cobranza. Ninguna ley verificaba la cobertura.
 *
 * LA GARANTÍA TRANSVERSAL, textual del owner:
 *   1. «cobertura: si el usuario pide Comercial + Inventario + Cobranza, la respuesta final debe cubrir Comercial +
 *      Inventario + Cobranza, tanto si responde el modelo como si termina en respaldo»;
 *   2. «el foco no puede borrar partes explícitas del encargo: en una pregunta simple está bien responder
 *      selectivamente; en un encargo múltiple, "foco" significa ordenar y jerarquizar, no eliminar dominios pedidos»;
 *   3. «una sola lectura: no quiero tres miniinformes pegados. La respuesta debe relacionar los dominios cuando
 *      existan claves válidas y terminar con una conclusión/prioridad común»;
 *   4. «degradación segura: si el modelo cae, el respaldo puede ser menos elegante, pero nunca menos completo
 *      respecto de lo que pidió el usuario».
 *
 * ESTE MÓDULO ES LA HOJA: el léxico cerrado de las partes (las seis comerciales de siempre y las de dominio nuevas),
 * con la pregunta canónica que cada una sabe responder, su dominio y las marcas con las que se verifica que una
 * respuesta la CUBRE. No importa playbooks ni contratos, a propósito: lo leen el ensamblador (que compone) y el
 * contrato (que cobra), y los dos tienen que ver EXACTAMENTE las mismas partes — una regla, un archivo.
 * `esEncargoCompuesto` vive acá por la misma razón (antes en contratoAgente, que ahora lo re-exporta sin cambiarlo).
 *
 * `encargoDe` (owner 2026-09-24, diseño aprobado `encargo_natural_diseno.md`): el reconocedor de arriba (conteo
 * de palabras e interrogativas) reconocía 1 de 20 encargos naturales fuera de muestra — «mírame ventas e
 * inventario» o «¿qué me preocupa más, margen o cobranza?» son encargos reales y no los veía. La corrección
 * separa TRES decisiones que antes iban pegadas: COBERTURA (¿cuántos temas? — los dominios de `dominiosDe`, el
 * registro único de `config/contract/dominios.js`), PROFUNDIDAD (¿cuánto detalle? — `_PIDE_PROFUNDIDAD`, nunca
 * por tener dos temas) y CIERRE (¿cómo cierra? — `cierreDeLaPregunta`, en `prioridadIntegrada.js`, junto a
 * `CRITERIOS`). `esEncargoCompuesto` pasa a ser la UNIÓN del reconocedor viejo (nadie pierde lo que ya tenía) con
 * `encargoDe(q).esEncargo` (lo nuevo, para las formas naturales cortas): un OR estrictamente aditivo — ninguna
 * pregunta que hoy es encargo deja de serlo. */
import { sinPresentacionPosterior, destinatarioDe } from "./reformular.js";
import { dominiosDe } from "./contratoDeDominios.js";
import { cierreDeLaPregunta } from "./prioridadIntegrada.js";
import { formaConversacional } from "./formaConversacional.js";
import { axisEntityNames } from "../oracle/entityIndex.js";
import { idsActivos } from "../../config/contract/dominios.js";

const _FIN = "(?![\\wáéíóúñ])";

/* ── EL ENCARGO COMPUESTO ES UNA SOLICITUD DE PROFUNDIDAD (owner 2026-09-11) ──────────────────────────────
 * «Dime cómo va, qué está explicando el resultado, qué clientes presionan, qué puedes demostrar y qué harías
 * primero» enumera lo que quiere saber: ya está pidiendo ese detalle. Con «el detalle se ofrece, no se
 * despliega» el modelo respondería de menos. Se cuenta la enumeración: tres o más preguntas parciales en un
 * mensaje largo. Las interrogativas con tilde valen en cualquier parte; sin tilde, solo al arranque de una
 * cláusula («, que…» «y que…» «¿que…»), para que un «que» conjunción no cuente.
 * ⚠️ ESTE RECONOCEDOR YA NO ES LA PUERTA DE LA COBERTURA (owner 2026-09-24): sigue vivo como SEGUNDO camino —
 * `esEncargoCompuesto` = esto OR `encargoDe(q).esEncargo` — para que ningún encargo largo ya certificado
 * (`_certificacion_congelada_gate`, las baterías de `_densidad_ejecutiva_gate`/`_cobertura_del_encargo_gate`)
 * cambie de resultado. El camino nuevo, basado en dominios + cierre, es el que generaliza. */
/* ⚠️ sin `\b` tras la tilde: «qué\b» no encuentra «qué » nunca (la trampa de siempre de esta casa) — los bordes
 * se escriben con las clases que sí conocen la tilde y la ñ */
const _INTERROGATIVA = /(?<![\wáéíóúñ])por qu[eé](?![\wáéíóúñ])|(?<![\wáéíóúñ])(?:qué|cuál(?:es)?|cuánt[oa]s?|quién(?:es)?|cómo|dónde|cuándo)(?![\wáéíóúñ])|(?:^|[,;:¿]\s*|(?<![\wáéíóúñ])y\s+)(?:que|cual(?:es)?|cuant[oa]s?|quien(?:es)?|como|donde|cuando)(?![\wáéíóúñ])|(?<![\wáéíóúñ])si (?:es|era|fue|son|hay|viene|vienen|est[aá]n?|conviene|se debe)(?![\wáéíóúñ])/gi;
function _esEncargoPorConteo(pregunta) {
  const q = String(pregunta || "");
  if (q.trim().split(/\s+/).length < 12) return false;
  return (q.match(_INTERROGATIVA) || []).length >= 3;
}
/* LA LECTURA EJECUTIVA DE LOS DATOS (owner 2026-09-14, prueba 2): «Hazme una lectura ejecutiva de estos datos. Dime qué debería
 * preocuparme más y dónde pondrías el foco primero» no enumera tres preguntas, pero pide el negocio ENTERO: es un encargo
 * de todos los dominios que el dato trae, con la foto, el inventario, la cobranza y la prioridad. Léxico cerrado, y acotado
 * a la lectura de LOS DATOS («lectura/resumen/síntesis ejecutiva», «estos datos», «mis datos»); «el negocio completo» sigue
 * siendo la foto comercial de la 2.27. */
export const _EJECUTIVA = /\b(?:lectura|resumen|s[ií]ntesis|visi[oó]n|panorama|foto)\s+(?:ejecutiv[oa]\s+)?(?:de|sobre)\s+(?:estos|mis|todos los|los|tus)\s+datos\b/i;   // «lectura ejecutiva de estos datos» — no «con los datos» de paso (el prompt de gerente lo dice) ni «resumen ejecutivo de negocio» (la foto de la 2.27)
export function esLecturaEjecutiva(pregunta) { return _EJECUTIVA.test(String(pregunta || "")); }

/* ── PROFUNDIDAD: la misma marca que `contratoAgente.js:_PIDE_DETALLE`, duplicada A PROPÓSITO (owner 2026-09-24)
 * ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * Importar `contratoAgente.js` acá crearía un SEGUNDO ciclo de módulos (contratoAgente.js YA importa de este
 * archivo) sobre uno que ya existe con `contratoDeDominios.js` — dos ciclos en el mismo módulo hoja es más
 * frágil que una lista de palabras repetida una vez, documentada, con el mismo texto. Si una crece, la otra
 * tiene que crecer con ella: están una junto a la otra a propósito. */
const _PIDE_PROFUNDIDAD = /\bdetalle|\bdetallad|\bdesgl[oó]s|\ba fondo\b|\bcomplet[oa]\b|\buno por uno\b|\bcuenta por cuenta\b|\bcliente por cliente\b|\bsku por sku\b|\bpara el analista\b|\bcon todo\b|\bpaso a paso\b|\bm[aá]s (?:largo|extenso)\b|\bexti[eé]ndete\b|\bexpl[aá]yate\b|\b(?:separ[ao]|dime|dinos|dec[ií]me)\b[^.?!\n]{0,25}\bqu[eé] (?:puedes|podr[ií]as|se puede)\s+demostrar\b/i;

/* ── EL NEGOCIO ENTERO, SIN NOMBRAR NINGÚN DOMINIO (owner 2026-09-24, set de diseño v1: q02/r02/r03) ────────────
 * «dime cómo estamos en general, quiero un resumen de todo el negocio…», «dame los 3 riesgos para el directorio»
 * piden el negocio ENTERO sin decir «ventas»/«inventario»/«cobranza» — `dominiosDe` (léxico puro) no tiene nada
 * que encender. Léxico CERRADO y ACOTADO a la forma ejecutiva de pedir la cartera completa (no es
 * `esLecturaEjecutiva`/`_EJECUTIVA` de `contratoDeDominios.js`, que exige terminar en «…datos» y a propósito NO
 * cubre «el negocio completo» —la foto comercial de la 2.27, ver `_prioridad_integrada_gate.mjs` §11—: este es
 * un mecanismo LOCAL, sin tocar ese regex compartido). Si `dominiosDe` ya encontró ≥ 2 temas, esto no agrega
 * nada (nunca RESTA un tema que el léxico sí encontró). */
const _NEGOCIO_ENTERO = /\bresumen (?:de|para) (?:todo el negocio|el directorio|directorio)\b|\bpara (?:el|la) directorio\b|\briesgos? (?:principales )?(?:del negocio|para el directorio)\b|\bc[oó]mo estamos en general\b|\btodo el negocio\b/i;

const _norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
/** el sujeto (una cuenta nombrada) de la pregunta, o null — NO decide si es encargo (esa es la corrección de
 *  diseño del v1: «cuenta nombrada ⇒ simple» es falso), solo lo acota. */
function _sujetoDeLaPregunta(pregunta) {
  try {
    const qn = _norm(pregunta);
    const nombre = axisEntityNames("cliente").find((e) => e && String(e).length >= 3 && qn.includes(_norm(e)));
    return nombre || null;
  } catch { return null; }
}

/**
 * encargoDe(pregunta, ctx) → { sujeto, dominios, ausentes, cierre, profundidad, esEncargo, lector } | null
 *   TRES DECISIONES SEPARADAS (owner 2026-09-24):
 *   · COBERTURA — `dominios`/`ausentes` de `dominiosDe(q)` (el registro único): cuántos TEMAS nombra la pregunta.
 *   · PROFUNDIDAD — "larga" solo si `_PIDE_PROFUNDIDAD` (nunca por tener dos temas: cubrir de más es CORTO).
 *   · CIERRE — "decision" | "lectura" | "cifra" (`cierreDeLaPregunta`, prioridadIntegrada.js).
 *   `esEncargo` = ≥ 2 temas (dominios activos + dominios ausentes, ej. comercial + tesorería) Y cierre ≠ "cifra".
 *   Una cifra o una relación puntual por tema («¿cuánto vendió Lider y cuánto me debe?») sigue SIMPLE aunque
 *   nombre dos o tres dominios y una cuenta — el sujeto acota, no decide (la corrección de diseño del set v1). */
export function encargoDe(pregunta, ctx = {}) {
  const q = sinPresentacionPosterior(String(pregunta || ""));
  if (!q.trim()) return null;
  let dom = { dominios: [], eje: null, ausentes: [] };
  try { dom = dominiosDe(q) || dom; } catch { /* dom ya es el vacío */ }
  let dominios = Array.isArray(dom.dominios) ? dom.dominios : [];
  const ausentes = Array.isArray(dom.ausentes) ? dom.ausentes : [];
  /* «todo el negocio», sin nombrar ningún dominio: solo SUMA (nunca resta lo que el léxico ya encontró) */
  if (dominios.length < 2 && _NEGOCIO_ENTERO.test(q)) dominios = idsActivos();
  let cierre = "cifra";
  try { cierre = cierreDeLaPregunta(q) || "cifra"; } catch { cierre = "cifra"; }
  const temas = [...new Set([...dominios, ...ausentes])];
  /* LA DISYUNTIVA ENTRE TEMAS ES DECISIÓN, EN CUALQUIER REDACCIÓN (coordinador, ronda 7, 2026-09-24): «¿ataco
   * el margen o el capital frenado?» no lleva ninguna palabra de `_CIERRE_DECISION` (prioridadIntegrada.js) —
   * el reconocimiento sale del REGISTRO (`dominiosDe` ya encontró ≥ 2 temas, arriba) + la FORMA ya certificada
   * de comparación (`formaConversacional(q) === "comparar"`, la misma marca que usa `compararAlternativas.js`
   * para «¿A o B?»): nunca una lista de frases nueva. Solo sube el cierre cuando el LÉXICO DEL REGISTRO ya
   * encontró ≥ 2 temas — así «¿renegocio Sodimac o recupero Ripley?» (0 temas: son cuentas, no dominios) sigue
   * sin encargo, y esa disyuntiva sigue siendo de `compararAlternativas.js`, no de acá. Estrictamente aditivo:
   * nunca BAJA un cierre que ya era "decision"/"lectura" por su propio léxico.
   * ⚠️ MEDIDO (regresión real, `_agente_playbooks_gate`): «cuánto vendí a crédito vs contado» también es
   * `formaConversacional === "comparar"` (por «vs», otra rama de ese detector) y también nombra 2 temas —pero
   * NO es una decisión, es un DESGLOSE («cuánto» + «vs»), y subirle el cierre le robaba el turno al playbook de
   * cobranza. La disyuntiva de DECISIÓN de la casa siempre se dice con «o» —los cuatro ejemplos del coordinador
   * la llevan: «…margen O cobranza», «…margen O el capital», «…caja O cobranza», «…capital frenado O la
   * cobranza»—; «vs»/«entre X y Y» son la forma de COMPARAR un desglose, no de decidir. Se exige el «o». */
  if (cierre === "cifra" && temas.length >= 2 && /\bo\b/i.test(q) && formaConversacional(q) === "comparar") cierre = "decision";
  const esEncargo = temas.length >= 2 && cierre !== "cifra";
  const profundidad = _PIDE_PROFUNDIDAD.test(q) ? "larga" : "corta";
  const sujeto = _sujetoDeLaPregunta(q);
  let lector = null;
  try { lector = destinatarioDe(q) || null; } catch { lector = null; }
  return { sujeto, dominios, ausentes, cierre, profundidad, esEncargo, lector };
}

/** esEncargoCompuesto(q) = el reconocedor de siempre (conteo) OR `encargoDe(q).esEncargo` (dominios + cierre) —
 *  una unión estrictamente aditiva: ninguna pregunta que hoy es encargo deja de serlo. */
export function esEncargoCompuesto(pregunta) {
  if (_esEncargoPorConteo(pregunta)) return true;
  try { const e = encargoDe(pregunta); return !!(e && e.esEncargo); } catch { return false; }
}

/* ── LAS PARTES, en el orden lógico de la casa ───────────────────────────────────────────────────────────────────
 * qué pasa → si es cierto → quién empuja y quién cae → por qué → quiénes → el cruce por SKU → el inventario → la
 * cobranza → qué está demostrado → qué haría primero. Cada parte: su léxico (jamás comprensión), la pregunta canónica
 * que su procedimiento ya sabe responder, el DOMINIO al que pertenece, y `cubre`: las marcas con las que se verifica
 * que una respuesta la atendió. `y` (opcional) es una segunda condición sobre la pregunta entera: el cruce por SKU
 * solo es parte pedida si además se pidió inventario. */
export const PARTES = [
  { clave: "foto", nombre: "la foto del negocio", playbook: "resumen-del-negocio", pregunta: "¿Cómo va el negocio?", dominio: "comercial",
    re: new RegExp([`\\bc[oó]mo (?:va|viene|vamos|venimos|est[aá]|anda|andamos) (?:el |mi )?negocio${_FIN}`, `\\bnegocio (?:completo|entero)${_FIN}`, `\\bmira el negocio${_FIN}`,
      `\\bqu[eé] est[aá] bien${_FIN}`, `\\bqu[eé] (?:te )?preocupa${_FIN}`, `\\bla foto${_FIN}`, `\\bpanorama${_FIN}`, `\\bqui[eé]n(?:es)? sostiene(?:n)? (?:la |las )?ventas?${_FIN}`,
      /* «si ese crecimiento realmente está siendo sano» (producción 2026-09-14): la calidad del crecimiento es la foto */
      `\\bcrecimiento[^.?!\\n]{0,40}\\b(?:sano|saludable|de calidad)${_FIN}`, `\\bvendiendo m[aá]s[^.?!\\n]{0,60}\\b(?:sano|saludable|de calidad)${_FIN}`].join("|"), "i"),
    cubre: /\bcrec|\bventa|\bcontribuci|\bmargen/i },
  { clave: "veredicto", nombre: "si es cierto", playbook: "contradiccion-de-metricas", pregunta: null, dominio: "comercial",   // la pregunta es la contradicción misma, tal como la dijo
    re: /\b(?:m[aá]s|menos|sub[eií]|baj[aoó]|crec[eií]|cae|cay[oó])\b[^.?!\n]{0,40}\bpero\b[^.?!\n]{0,40}\b(?:m[aá]s|menos|sub[eií]|baj[aoó]|crec[eií]|cae|cay[oó])\b/i,
    cubre: /\bmargen|\bcontribuci|\bventa/i },
  { clave: "crecimiento", nombre: "quiénes empujan el crecimiento y quiénes caen", playbook: "crecimiento", pregunta: "¿Qué clientes están empujando el crecimiento y cuáles cayeron?", dominio: "comercial",
    re: new RegExp([`\\bempuj(?:a|an|ando|e|en) (?:el |las |la )?(?:crecimiento|ventas?)${_FIN}`, `\\bqui[eé]n(?:es)? (?:sostiene|sostienen|explica|explican|lidera|lideran|tira|tiran|mueve|mueven) (?:el |la )?crecimiento${_FIN}`,
      `\\b(?:clientes?|cuentas?|sku|productos?) (?:que )?(?:m[aá]s )?crec(?:e|en|i[oó]|ieron)${_FIN}`, `\\bcu[aá]les crecen${_FIN}`, `\\bqu[eé] (?:clientes|cuentas|sku|productos) (?:est[aá]n )?creciendo${_FIN}`,
      `\\bqui[eé]n(?:es)? crec(?:e|en|i[oó]|ieron)${_FIN}`, `\\bd[oó]nde (?:est[aá]|viene) el crecimiento${_FIN}`].join("|"), "i"),
    cubre: /\bcrec|a[ñn]o anterior|\bempuj|\+\$\d/i },
  /* «unidades» va dentro de Comercial (owner 2026-09-14); cuando el encargo las nombra, son una parte pedida */
  { clave: "unidades", nombre: "las unidades vendidas", playbook: "unidades", pregunta: "¿Qué cliente compra más unidades?", dominio: "comercial",
    re: new RegExp(`\\bunidades?${_FIN}|\\bvolumen (?:vendido|de venta)${_FIN}`, "i"),
    cubre: /\bunidades/i },
  { clave: "porque", nombre: "el porqué", playbook: "margen-en-riesgo", pregunta: "¿Por qué está pasando?", dominio: "comercial",
    re: new RegExp([`\\bpor qu[eé]${_FIN}`, `\\bqu[eé] (?:est[aá] )?explic(?:a|ando)${_FIN}`, `\\ba qu[eé] se debe${_FIN}`, `\\bqu[eé] hay detr[aá]s${_FIN}`, `\\bde d[oó]nde viene${_FIN}`,
      `\\bsi viene de${_FIN}`, `\\bprecio, costo, mix${_FIN}`, `\\bla causa${_FIN}`, `\\bqu[eé] lo explica${_FIN}`].join("|"), "i"),
    cubre: /\bcarga|\bprecio|\bcosto|\bmix\b|\bmecanismo|\bpor qu[eé]|\bse debe|\bexplic/i },
  { clave: "quienes", nombre: "quiénes lo explican", playbook: "margen-en-riesgo", pregunta: "¿cómo viene mi margen?", dominio: "comercial",
    re: new RegExp([`\\bqu[eé] clientes${_FIN}`, `\\bqu[eé] cuentas${_FIN}`, `\\bcu[aá]les (?:clientes|cuentas)${_FIN}`, `\\bqui[eé]n(?:es)? (?:destruye|presiona|explica|pesa|est[aá]n? detr[aá]s|se lleva|deteriora|erosiona)`,
      `\\bcu[aá]nto (?:dinero |plata )?(?:est[aá]|hay) en juego${_FIN}`, `\\bd[oó]nde est[aá] la mayor recuperaci[oó]n${_FIN}`, `\\bqui[eé]n(?:es)? (?:sostiene|sostienen) (?:el )?margen${_FIN}`,
      `\\bcu[aá]les (?:est[aá]n )?deteriora(?:n|ndo)${_FIN}`].join("|"), "i"),
    cubre: /\bmargen|\bcontribuci|\bcliente|\bcuenta/i },
  { clave: "cruce-sku", nombre: "los SKU: venta y contribución frente a su inventario", playbook: "cruce-por-sku", pregunta: "¿Qué SKU dejan contribución pero tienen capital frenado?", dominio: "inventario",
    re: new RegExp(`\\bskus?${_FIN}|\\bproductos que (?:m[aá]s )?vend`, "i"), y: /\binventario|\bstock|\bcapital (?:frenado|inmovilizado|detenido|parado)|\bd[ií]as de inventario|\brotaci[oó]n/i,
    cubre: /\bSKU\b|\b[A-Z]{2,4}-[A-Z0-9]{2,}(?:-[A-Z0-9]+)*\b/ },
  { clave: "inventario", nombre: "el inventario: dónde hay capital frenado", playbook: "inventario-inmovilizado", pregunta: "¿Dónde tengo capital frenado en inventario?", dominio: "inventario",
    re: new RegExp([`\\bacumulando (?:stock|inventario)${_FIN}`, `\\bstock (?:donde|que) no (?:corresponde|rota|se mueve)${_FIN}`, `\\bsobre ?stock${_FIN}`, `\\bexceso de (?:stock|inventario)${_FIN}`,
      `\\bcapital (?:frenado|inmovilizado|detenido|parado)${_FIN}`, `\\binventarios?${_FIN}`, `\\bstock${_FIN}`, `\\bd[ií]as de inventario${_FIN}`, `\\brotaci[oó]n${_FIN}`].join("|"), "i"),
    cubre: /\binventario|\bstock|\bfrenad|\binmoviliz|\bd[ií]as de inventario|\bsobrestock|\bquiebre/i },
  { clave: "cobranza", nombre: "la cobranza: quién debe y qué está vencido", playbook: "cobranza", pregunta: "¿Quiénes me deben más y qué está vencido?", dominio: "cobranza",
    re: new RegExp([`\\bcobranzas?${_FIN}`, `\\bme deben?${_FIN}`, `\\bvencid[oa]s?${_FIN}`, `\\bsaldos? pendientes?${_FIN}`, `\\bpor cobrar${_FIN}`, `\\bcartera vencida${_FIN}`, `\\bmorosidad${_FIN}`,
      `\\briesgo de (?:cobro|cobranza|pago|no pago)${_FIN}`, `\\bcuentas por cobrar${_FIN}`, `\\bdeudas?${_FIN}`].join("|"), "i"),
    cubre: /\bcobranza|\bvencid|\bsaldo|\bpor cobrar|\bdeuda|\bdeben?\b|\babonad|\bcobr/i },
  { clave: "sello", nombre: "qué está demostrado", playbook: "margen-en-riesgo", pregunta: "¿Qué parte de eso puedes demostrar y qué parte no?", dominio: "comercial",
    re: new RegExp([`\\bqu[eé] (?:parte )?(?:puedes|pod[eé]s|podr[ií]as) (?:demostrar|probar)`, `\\bqu[eé] (?:est[aá]|tienes) (?:probado|demostrado)`, `\\bqu[eé] es hip[oó]tesis`,
      `\\bqu[eé] (?:informaci[oó]n|datos?) (?:te )?falta`, `\\bqu[eé] (?:te )?falta${_FIN}`, `\\bqu[eé] no puedes (?:probar|demostrar)`].join("|"), "i"),
    cubre: /\bdemostr|\bprobad|\bmedid|\bindicad|\babiert|\bhip[oó]tesis|\bno (?:lo )?s[eé]\b|\bno est[aá] en (?:este|el) dato|\bqueda(?:n)? abiert/i },
  { clave: "primero", nombre: "qué haría primero", playbook: "margen-en-riesgo", pregunta: "¿Qué harías primero?", dominio: "comercial",
    re: new RegExp([`\\bqu[eé] har[ií]as primero`, `\\bd[oó]nde actuar[ií]as`, `\\bpor d[oó]nde (?:empezar|entrar|partir|arrancar)`, `\\bqu[eé] (?:tres |dos |\\d+ )?cuentas (?:revisar[ií]as|atacar[ií]as|abrir[ií]as|mirar[ií]as)`,
      `\\bqu[eé] hacer primero`, `\\bprioridad${_FIN}`, `\\bqu[eé] har[ií]a primero`,
      /* «dónde pondrías el foco primero» (producción 2026-09-14) y sus formas */
      `\\bd[oó]nde (?:pondr[ií]as|pones|pondr[ií]a) (?:el |tu )?(?:foco|esfuerzo|energ[ií]a|atenci[oó]n)`, `\\b(?:el )?foco primero${_FIN}`, `\\bqu[eé] priorizar(?:[ií]as)?${_FIN}`, `\\bprioriza(?:r)?${_FIN}`,
      `\\bqu[eé] (?:atacar|abordar|resolver)(?:[ií]as)? primero`, `\\bpor d[oó]nde partir[ií]as${_FIN}`,
      /* las formas naturales de pedir la misma decisión (owner 2026-09-14, segundo prompt de producción): «mayor riesgo», «qué
       * debería preocuparme», «qué es prioritario», «qué es lo más grave», «qué merece atención primero» */
      `\\b(?:el |mi |tu )?mayor riesgo${_FIN}`, `\\bd[oó]nde (?:est[aá]|tengo) (?:hoy )?(?:el )?(?:mayor )?riesgo${_FIN}`, `\\bdeber[ií]a (?:preocuparme|preocuparte|preocupar(?:le|nos)?)${_FIN}`,
      `\\bqu[eé] (?:me|te|nos) preocupa${_FIN}`, `\\bprioritari[oa]s?${_FIN}`, `\\blo m[aá]s grave${_FIN}`, `\\bmerecen? (?:m[aá]s )?atenci[oó]n(?: primero)?${_FIN}`,
      `\\bqu[eé] (?:cliente|cuenta|sku|producto)s? (?:o (?:cliente|cuenta|sku|producto)s? )?(?:deber[ií]a|tendr[ií]a que|hay que) (?:mirar|atender|revisar|abrir) primero`].join("|"), "i"),
    cubre: /\bprimero\b|\bprioridad|\bfoco\b|\bempezar[ií]a|\bpartir[ií]a|\bentrar[ií]a|\barrancar[ií]a|\bprimer (?:paso|movimiento)/i },
];

/** las partes PEDIDAS, en el orden de la casa — [] si no es un encargo compuesto o pide menos de dos */
export function partesDelEncargo(pregunta) {
  const q = sinPresentacionPosterior(String(pregunta || ""));
  const ejecutiva = esLecturaEjecutiva(q);
  if (!esEncargoCompuesto(q) && !ejecutiva) return [];
  /* en la lectura ejecutiva de los datos entran la foto, el inventario y la cobranza aunque no se nombren: el negocio entero */
  const pedidas = new Set(ejecutiva ? ["foto", "inventario", "cobranza"] : []);
  const partes = PARTES.filter((p) => pedidas.has(p.clave) || (p.re.test(q) && (!p.y || p.y.test(q)))).map((p) => ({ ...p, pregunta: p.pregunta || q }));
  return partes.length >= 2 ? partes : [];
}

/** los dominios que el encargo pide, por sus partes, en orden fijo */
export function dominiosDelEncargo(partes) {
  const d = new Set((partes || []).map((p) => p.dominio));
  return ["comercial", "inventario", "cobranza"].filter((x) => d.has(x));
}

const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** las partes que la respuesta NO cubre. Una parte se cubre atendiéndola con el dato o declarándola en una línea
 *  («Sobre la cobranza… no pude armar la lectura…»): declinar honestamente es cubrir; desaparecer, no. */
export function coberturaDelEncargo(texto, partes) {
  const t = String(texto || "");
  return (partes || []).filter((p) => !(p.cubre && p.cubre.test(t)) && !new RegExp(`\\bSobre ${_esc(p.nombre)}`, "i").test(t));
}
