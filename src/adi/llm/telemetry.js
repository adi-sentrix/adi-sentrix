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
const CAMPOS = ["traceId", "proveedor", "modelo", "etapa", "intento", "resultado", "reasonCode",
  "tokens_in", "tokens_out", "latencia_ms", "ruta_deterministica"];

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

const _entero = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null);

export function _limpio(ev = {}) {
  const o = {};
  for (const k of CAMPOS) if (ev[k] !== undefined) o[k] = ev[k];
  o.reasonCode = aReasonCode(o.reasonCode);
  o.tokens_in = _entero(o.tokens_in);
  o.tokens_out = _entero(o.tokens_out);
  o.latencia_ms = _entero(o.latencia_ms);
  o.intento = _entero(o.intento);
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

/** Traduce lo que devuelve el gateway a los nueve campos, sin que el gateway tenga que saber de telemetría. */
export function desdeRespuesta({ traceId, proveedor, modelo, etapa, intento, latencia_ms, respuesta, motivo, ruta_deterministica }) {
  const r = respuesta || {};
  const u = r.usage || r.tokens || {};
  let resultado = "ok";
  if (r.ok === false) resultado = r.error === "rate_limited" ? "rate_limited" : "error";
  else if (motivo) resultado = "rechazado";
  return _limpio({
    traceId, proveedor, modelo: modelo || r.modelUsed || null, etapa, intento,
    resultado, reasonCode: aReasonCode(motivo || r.reason || r.error || null),
    tokens_in: u.prompt_tokens ?? u.input_tokens ?? null,
    tokens_out: u.completion_tokens ?? u.output_tokens ?? null,
    latencia_ms, ruta_deterministica,
  });
}
