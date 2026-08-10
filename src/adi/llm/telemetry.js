/* TELEMETRÍA MÍNIMA DEL GATEWAY · provider-neutral (owner 2026-08-10) ==================================
 *
 * POR QUÉ EXISTE: durante la certificación se gastaron llamadas pagadas y NO se pudo saber cuántas, con qué
 * modelo, ni por qué reintentaron — el gateway no emitía una sola señal. Sin esto, "hubo un reintento" no
 * permite distinguir un rechazo del guard (defecto real del producto) de un 429 del proveedor (ruido de red).
 *
 * QUÉ NO ES: no cambia ninguna decisión. `emit` no lanza nunca, no bloquea, y con el sink apagado (el default)
 * no hace absolutamente nada. La lógica de ADI queda intacta: esto observa, no participa.
 *
 * LOS NUEVE CAMPOS que el owner pidió, y NADA más:
 *   traceId · proveedor · modelo · etapa (plan|narrar|deterministica) · intento · resultado
 *   · motivo (rechazo o reintento) · tokens_in/tokens_out · latencia_ms · ruta_deterministica
 *
 * PROHIBIDO EN DISCO (requisito del owner): prompts, respuestas, nombres de entidad, cifras y argumentos de
 * tool. `_limpio()` es un candado real, no una convención: descarta cualquier clave fuera de la lista blanca y
 * redacta los dígitos del motivo, que es el único campo de texto libre que sobrevive.
 */

export const ETAPAS = ["plan", "narrar", "deterministica"];
export const RESULTADOS = ["ok", "rechazado", "error", "rate_limited", "bloqueado"];

// Lista blanca. Lo que no está acá NO sale. (El candado, no la buena intención.)
// TRES CAMPOS NUEVOS (owner 2026-08-10, cierre de la certificación live):
//   · tools              — las tools REALMENTE EJECUTADAS en el turno. Ver `setToolsDeclaradas`: se validan contra
//                          el registro del motor y lo que no está declarado NO sale. Un nombre de tool es
//                          vocabulario NUESTRO, cerrado — nunca puede ser un dato del cliente.
//   · tokens_in_cache    — cuántos tokens de entrada sirvió el CACHÉ del proveedor.
//   · tokens_in_fresh    — cuántos se pagaron completos. Se deriva, no se pide: tokens_in − tokens_in_cache.
// Las 11 llamadas de la certificación registraron el modelo como "?" y ningún dato de caché ni de tools. Sin eso,
// "hubo un reintento" y "el prompt es caro" son afirmaciones que nadie puede verificar (ver CLAUDE.md §3).
const CAMPOS = ["traceId", "proveedor", "modelo", "etapa", "intento", "resultado", "reasonCode",
  "tokens_in", "tokens_in_cache", "tokens_in_fresh", "tokens_out", "latencia_ms", "ruta_deterministica", "tools"];

// CERO TEXTO LIBRE (owner 2026-08-10). La versión anterior guardaba un `motivo` redactado, y el owner cazó el
// hueco: redactar los dígitos no impide que un nombre de entidad viaje dentro del motivo del guard. Ahora el
// único campo de causa es un CÓDIGO de una lista cerrada. Lo que no está en la lista es `unknown`: nunca el
// texto original. Un enum no puede filtrar datos del cliente, por definición.
export const REASON_CODES = ["rate_limited", "network_error", "invalid_plan", "empty_redirect",
  "guard_rejected", "provider_error", "unknown"];

// Traduce el texto que produce el motor a un código. NO persiste nada del texto: solo decide cuál de los siete.
const _MAPA = [
  [/rate.?limit|429|demasiadas solicitudes/i, "rate_limited"],
  [/red\/gateway|network|timeout|ECONN|fetch failed/i, "network_error"],
  [/plan inválido|sin intent|JSON|malformad/i, "invalid_plan"],
  [/redirect sin calls/i, "empty_redirect"],
  [/guard|cifra-no-autorizada|entidad|sujeto|procedencia|nivel-financiero|causa-sobredimensionada|tabla-/i, "guard_rejected"],
  [/provider|adapter|proveedor/i, "provider_error"],
];
export function aReasonCode(x) {
  if (x == null || x === "") return null;
  if (REASON_CODES.includes(x)) return x;
  const s = String(x);
  for (const [re, code] of _MAPA) if (re.test(s)) return code;
  return "unknown";
}

// ── LAS TOOLS SON UNA LISTA CERRADA, IGUAL QUE reasonCode (owner 2026-08-10) ──────────────────────────────────
// El owner fue explícito: "sin datos del cliente — la causa viaja como código de lista cerrada, nunca texto
// libre". Los nombres de tool cumplen esa misma condición (son vocabulario nuestro, finito y declarado), así que
// entran con el MISMO candado, no con una excepción: se validan contra el registro REAL del motor.
//
// SE REGISTRAN, NO SE COPIAN. Escribir acá la lista de tools sería una segunda fuente que se desincroniza con
// toolRegistry.js a la primera tool nueva — y una lista desactualizada descarta en silencio justo lo que se quería
// medir. El motor declara su registro con `setToolsDeclaradas` (mismo patrón que `setSink`: el host decide, este
// módulo no adivina). FALLA CERRADA: sin registro, `tools` no sale. Nunca al revés.
let _toolsOk = null;
export function setToolsDeclaradas(nombres) {
  _toolsOk = Array.isArray(nombres) && nombres.length ? new Set(nombres.map(String)) : null;
}
export function getToolsDeclaradas() { return _toolsOk ? [..._toolsOk] : []; }
function _tools(v) {
  if (!Array.isArray(v) || !_toolsOk) return null;
  const out = v.map(String).filter((t) => _toolsOk.has(t));
  return out.length ? out : null;
}

// `null` NO ES CERO (defecto previo, cazado al sumar el campo de caché — owner 2026-08-10). `Number(null)` es 0 y
// `Number.isFinite(0)` es true, así que un campo explícitamente nulo salía a disco como **0 tokens**: exactamente
// el "cero fingido" que este módulo declara no hacer, y el que haría creer que una llamada sin `usage` no costó
// nada. Ausencia de dato y valor cero son afirmaciones distintas; el candado tiene que distinguirlas.
const _entero = (v) => (v == null || v === "" ? null : (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null));

export function _limpio(ev = {}) {
  const o = {};
  for (const k of CAMPOS) if (ev[k] !== undefined) o[k] = ev[k];
  o.reasonCode = aReasonCode(o.reasonCode);
  o.tokens_in = _entero(o.tokens_in);
  o.tokens_in_cache = _entero(o.tokens_in_cache);
  o.tokens_out = _entero(o.tokens_out);
  o.latencia_ms = _entero(o.latencia_ms);
  o.intento = _entero(o.intento);
  o.tools = _tools(o.tools);
  // `tokens_in_fresh` se DERIVA, nunca se acepta de afuera: lo que el proveedor informa son dos cifras (el total y
  // la parte cacheada) y la tercera es una resta. Aceptarla como campo propio permitiría que llegara un valor que
  // no cierra con las otras dos. null (no 0) si falta cualquiera de las dos: no se finge "cero cacheado".
  o.tokens_in_fresh = (o.tokens_in != null && o.tokens_in_cache != null) ? Math.max(0, o.tokens_in - o.tokens_in_cache) : null;
  o.ruta_deterministica = o.ruta_deterministica == null ? null : !!o.ruta_deterministica;
  if (o.etapa != null && !ETAPAS.includes(o.etapa)) o.etapa = null;
  if (o.resultado != null && !RESULTADOS.includes(o.resultado)) o.resultado = null;
  return o;
}

/** traceId opaco: no deriva del texto ni del tenant, así que no filtra nada por sí mismo. */
export function nuevoTraceId(semilla = null) {
  const base = semilla != null ? String(semilla) : Math.random().toString(36).slice(2) + Date.now().toString(36);
  let h = 5381;
  for (let i = 0; i < base.length; i++) h = ((h * 33) ^ base.charCodeAt(i)) >>> 0;
  return "t" + h.toString(36).padStart(7, "0");
}

let _sink = null;
/** Apagado por defecto. El host decide dónde escribe; el gateway nunca elige un destino. */
export function setSink(fn) { _sink = typeof fn === "function" ? fn : null; }
export function getSink() { return _sink; }

/** Nunca lanza: un fallo de telemetría jamás puede tumbar un turno del producto. */
export function emit(ev) {
  if (!_sink) return null;
  let limpio = null;
  try { limpio = _limpio(ev); _sink(limpio); } catch { /* silencio deliberado */ }
  return limpio;
}

/** Traduce lo que devuelve el gateway a los campos declarados, sin que el gateway tenga que saber de telemetría. */
export function desdeRespuesta({ traceId, proveedor, modelo, etapa, intento, latencia_ms, respuesta, motivo, ruta_deterministica, tools }) {
  const r = respuesta || {};
  const u = r.usage || r.tokens || {};
  let resultado = "ok";
  if (r.ok === false) resultado = r.error === "rate_limited" ? "rate_limited" : "error";
  else if (motivo) resultado = "rechazado";
  return _limpio({
    // EL MODELO EFECTIVO PRIMERO, el pedido después (owner 2026-08-10). Lo que se pide y lo que responde no son la
    // misma cadena: el proveedor resuelve alias a una versión concreta ("gpt-4o-mini" → "gpt-4o-mini-2024-07-18"),
    // y para medir costo importa el que respondió. `r.modelo` lo trae el adapter desde la respuesta cruda; si el
    // proveedor no lo informó se cae al pedido, que sigue siendo mejor que el "?" con que salieron las 11 llamadas.
    traceId, proveedor, modelo: r.modelo || modelo || r.modelUsed || null, etapa, intento,
    resultado, reasonCode: aReasonCode(motivo || r.reason || r.error || null),
    tokens_in: u.prompt_tokens ?? u.input_tokens ?? null,
    // los DOS adapters ya normalizaban `cachedTokens` desde 2026-08-03 (Fase 0 de eficiencia) y acá se descartaba:
    // el dato estaba medido y no llegaba a ninguna parte. Es justo el que dice si el caché de prompt está pegando.
    tokens_in_cache: u.cachedTokens ?? null,
    tokens_out: u.completion_tokens ?? u.output_tokens ?? null,
    latencia_ms, ruta_deterministica, tools,
  });
}
