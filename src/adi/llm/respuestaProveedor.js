/* === src/adi/llm/respuestaProveedor.js · ¿ESTO ES UNA RESPUESTA DEL PROVEEDOR? (owner 2026-08-13) ===========
 *
 * EL DÍA QUE COSTÓ UNA CORRIDA. Las 12 puertas de una corrida viva devolvieron el mismo error —"sin tool_call en
 * la respuesta"— y ese mensaje mandó a revisar el adaptador durante horas. El adaptador estaba SANO: un
 * interceptor de prueba había reemplazado el `fetch` global y devolvía `{ok:true}` a toda ruta que no reconocía.
 * O sea que al adaptador nunca le llegó una respuesta del proveedor: le llegó un objeto de otro programa. El
 * mensaje describía la única causa que el adaptador sabía nombrar, y esa causa era la equivocada.
 *
 * LAS TRES SON DISTINTAS, y hasta hoy las tres decían lo mismo:
 *   1. NO ES UNA RESPUESTA DEL PROVEEDOR — no trae un solo campo del sobre. Un interceptor, un proxy, un mock,
 *      un endpoint equivocado o una página de error parseada como JSON. El problema NO está en el adaptador.
 *   2. EL PROVEEDOR DEVOLVIÓ UN ERROR EN EL CUERPO — sobre válido con `error` adentro, y HTTP 200 (pasa: cuota,
 *      organización, modelo inexistente). El problema es de la cuenta o del pedido, no del formato.
 *   3. CONTESTÓ, PERO SIN LO QUE SE LE PIDIÓ — sobre real y completo, sin tool_call/tool_use. Acá SÍ contestó el
 *      proveedor (y cobró): el modelo redactó prosa en vez de llamar a la tool, o la respuesta salió truncada.
 *
 * SE FALLA HACIA EL STATUS QUO. Ante la duda, un objeto se trata COMO respuesta del proveedor (caso 3, el mensaje
 * de siempre): un falso "no es una respuesta del proveedor" mandaría a buscar un interceptor que no existe, que
 * es el error caro que este módulo viene a evitar. Por eso la lista de marcadores es amplia a propósito: alcanza
 * UNO solo para considerarlo un sobre.
 *
 * QUÉ NO HACE: no habla con nadie, no importa nada, no decide reintentos y no toca el `usage`. Recibe un objeto
 * ya parseado y devuelve un Error o null. Por eso un gate offline puede inyectarle la respuesta malformada sin
 * abrir un socket — los adaptadores no se pueden importar desde la suite offline (el clasificador los marca LIVE).
 *
 * PRIVACIDAD: el mensaje puede nombrar las CLAVES del objeto recibido (nunca sus valores) y los códigos que el
 * proveedor usa para tipificar su error. Es vocabulario de máquina y va SOLO al log del server, igual que el
 * cuerpo de error del proveedor que el gateway ya loguea ahí. A la telemetría de disco no llega el texto: llega
 * su reasonCode, que es de lista cerrada (ver telemetry.js).
 */

// Campos que sólo existen en el sobre de una respuesta de chat (OpenAI y Anthropic). Alcanza UNO para que el
// objeto cuente como respuesta del proveedor. NO está `ok`: ése es justo el campo del interceptor que engañó.
export const MARCADORES_DE_SOBRE = Object.freeze([
  "choices", "content", "usage", "model", "object", "id", "error",       // comunes / OpenAI
  "stop_reason", "role", "created", "system_fingerprint", "service_tier", // Anthropic / OpenAI
]);

/** ¿El objeto trae al menos un campo del sobre de una respuesta de chat? (ante la duda: sí — ver la cabecera) */
export function pareceRespuestaDelProveedor(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  return MARCADORES_DE_SOBRE.some((k) => k in data);
}

// Hasta 6 claves, recortadas: sirven para reconocer al intruso de un vistazo ("claves: ok") sin volcar un objeto
// entero al log. NUNCA los valores.
const _claves = (data) => {
  if (!data || typeof data !== "object") return "";
  const k = Object.keys(data);
  return k.slice(0, 6).map((x) => String(x).slice(0, 24)).join(", ") + (k.length > 6 ? `, +${k.length - 6}` : "");
};

// El tipo de lo que llegó, cuando ni siquiera es un objeto útil (un string de HTML, null, un array…). Un array
// NO se describe como "un objeto sin campos del sobre" aunque `typeof` diga object: decir qué llegó de verdad
// es la mitad del arreglo, y "llegó un array" ubica el problema al instante.
const _tipo = (data) => (data === null ? "null" : Array.isArray(data) ? "un array" : `un ${typeof data}`);

// EL MENSAJE TIENE QUE DECIR «PROVEEDOR», y no sólo su nombre (owner 2026-08-13, hallazgo del propio gate). El
// gateway tipa la causa traduciendo el TEXTO del error con `aReasonCode`, y esa traducción reconoce la palabra
// "proveedor". Con el mensaje plano de antes —"sin tool_call en la respuesta"— las 12 puertas de la corrida
// quedaron registradas como `unknown`: el error existía y el registro no sabía de qué clase era.
const _quien = (p) => (p ? `el proveedor (${p})` : "el proveedor");

/* sobreAjeno(data, proveedor) → Error | null
 * Devuelve un Error SÓLO en los casos 1 y 2 (no es una respuesta del proveedor · el proveedor devolvió un error
 * en el cuerpo). Devuelve null si el objeto es un sobre normal: ahí manda el adaptador, que sabe qué esperaba.
 * Es la puerta que un caller puede poner ANTES de leer un campo, para no fingir éxito con un objeto que no
 * entiende — el defecto que hizo perder una corrida entera. */
export function sobreAjeno(data, proveedor = null) {
  if (!pareceRespuestaDelProveedor(data)) {
    const detalle = data && typeof data === "object" && !Array.isArray(data)
      ? `un objeto sin ningún campo del sobre (claves: ${_claves(data)})` : _tipo(data);
    const err = new Error(`${_quien(proveedor)} no mandó esto: llegó ${detalle}. ` +
      `Sospechar de un interceptor o un mock en el camino, no del adaptador.`);
    err.code = "respuesta_ajena";
    return err;
  }
  if (data.error) {
    const e = data.error;
    const tipo = e && typeof e === "object" ? String(e.type || e.code || "sin tipo").slice(0, 40) : String(e).slice(0, 40);
    const err = new Error(`${_quien(proveedor)} devolvió un error en el cuerpo (tipo: ${tipo}): no hay respuesta que usar.`);
    err.code = "error_en_cuerpo";
    return err;
  }
  return null;
}

/* errorDeRespuesta(data, { proveedor, esperado }) → Error
 * El error que lanza un adaptador cuando no encuentra lo que pidió. Si el objeto ni siquiera era del proveedor,
 * lo dice; si el proveedor contestó de verdad y le faltó la llamada a la tool, lo dice distinto y aporta el
 * `finish_reason`/`stop_reason`, que es lo que separa "el modelo prefirió redactar" de "la respuesta se truncó". */
export function errorDeRespuesta(data, { proveedor = null, esperado = "tool_call" } = {}) {
  const ajeno = sobreAjeno(data, proveedor);
  if (ajeno) return ajeno;
  const corte = (data.choices && data.choices[0] && data.choices[0].finish_reason) || data.stop_reason || null;
  const err = new Error(`${_quien(proveedor)} contestó sin ${esperado} en la respuesta` +
    (corte ? ` (corte: ${String(corte).slice(0, 24)})` : "") + ". La llamada salió y pudo facturarse.");
  err.code = `sin_${esperado}`;
  return err;
}
