/* === src/adi/llm/adapters/anthropic.js · ADI Core · Paso 5 v1 · ADAPTER Anthropic ===
 * Un adapter SOLO sabe hablarle a su proveedor. Recibe entradas NEUTRALES de ADI (system=contractMenu, tool neutral,
 * text, model) y devuelve el SPEC. NO define métricas, entidades, disponibilidad, cálculos, bloqueos ni verdad del dato
 * — todo eso es de ADI (contrato). Si mañana cambiamos de proveedor, se cambia el adapter; el spec/contrato no.
 *
 * parse(text, {system, tool, model})        → { spec, usage }
 * narrate(validatedOutput, {model, system})  → { text, usage }   (system lo arma el caller: el CONTRATO, nunca el adapter)
 *
 * CERO imports de módulos de producto (owner 2026-07-29, capa de rol conversacional: "el adaptador solo debe recibir
 * el contrato, el contexto y la boleta, y devolver una narración estructurada"): si `system` no llega, FALLA fuerte
 * en vez de narrar en silencio con una voz genérica ajena al contrato vigente — gatewayCore SIEMPRE lo provee.
 */

// Única importación, y no es de producto · misma que openai.js: distinguir "contestó sin tool_use" de "esto ni
// siquiera es una respuesta del proveedor" (owner 2026-08-13). Módulo puro, sin red, sin estado.
import { sobreAjeno, errorDeRespuesta } from "../respuestaProveedor.js";

const BASE = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");
const ENDPOINT = BASE + "/v1/messages";
const VERSION = "2023-06-01";
// TIMEOUT (owner 2026-07-29, rendimiento/multiempresa): mismo criterio que el adapter de OpenAI — sin esto, un
// proveedor colgado bloqueaba el request indefinidamente, agotando conexiones bajo carga multi-tenant.
/* DEFAULT 90s, no 25s (owner 2026-08-14, tercera vez que este número muerde). MEDIDO: Sonnet narrando un turno
 * rico tarda 20-27s y con reparación pasa de 50s; con 25s de tope, el turno moría y —peor— moría EN SILENCIO,
 * cayendo al camino de respaldo sin que nadie viera por qué. Producción ya declara 90s por env, pero el DEFAULT
 * era una trampa para todo entorno que no lo declare (el servidor de desarrollo, un gate, una corrida nueva):
 * `process.env` se lee AL CARGAR el módulo, así que un `.env` que se cargue después no lo corrige.
 * Es un TOPE, no una espera: una respuesta rápida sigue siendo rápida. */
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 90000;

// LÍMITE DE SALIDA de narrate() (owner 2026-08-13, preparación Anthropic): una respuesta larga real de ADI mide
// ~1.200 chars ≈ 300 tokens, pero un turno con tabla comparada queda pegado al techo de 1024 — y un corte del
// proveedor a mitad de tabla es una respuesta rota que además quema un reintento entero.
// 2048 → 3072 (cierre del espejo Anthropic 2026-08-13, hallazgo 2 — MEDIDO sobre los transcripts
// `_cert_espejo_anthropic.*.json`, Sonnet como narrador): la mejor respuesta del espejo (F4, «¿qué opinas de mi
// negocio?») llegó al usuario CORTADA a mitad de frase — «…contribución no capturada ($1.6M» — con el envoltorio
// de marcos pegado al muñón. Ningún recorte del MOTOR corta a mitad de oración (truncateToBriefBudget corta por
// oración; los strips borran oraciones/líneas/bloques enteros): el único corte a mitad de token es el max_tokens
// del proveedor. Los textos FINALES de Sonnet en el espejo miden hasta 1.633 chars visibles (G4) — y el crudo del
// narrador es más largo que lo visible (marcos [[...]], bloques descartados, tablas completas que los strips
// podan), así que un turno rico de Sonnet SÍ alcanza 2048 de salida cruda. 3072 da ~50% de aire sin regalar
// presupuesto (max_tokens es un TOPE, no un gasto: solo se paga lo generado). El de parse() NO se toca:
// un tool_use de PLAN es un JSON acotado y 1024 le sobra. Se lee por llamada (no al importar, como TIMEOUT_MS)
// para que el override por deploy no dependa del orden de carga del módulo.
const _narrateMaxTokens = () => Number(process.env.LLM_NARRATE_MAX_TOKENS) || 3072;

// _rateLimitError · MISMA convención que src/adi/llm/adapters/openai.js (owner 2026-08-03, investigación cruzada de
// los 5 gates de Arquitectura C): `.code="rate_limited"` (+ `.retryAfterMs`) cuando status===429, para que
// answerViaOracle.js pueda backoffear específicamente ante rate-limit real, sea cual sea el proveedor activo.
function _rateLimitError(status, bodyText, headers) {
  const err = new Error(`HTTP ${status}: ${bodyText.slice(0, 240)}`);
  if (status === 429) {
    err.code = "rate_limited";
    const ra = headers && typeof headers.get === "function" ? headers.get("retry-after") : null;
    if (ra != null) { const ms = Number(ra) * 1000; if (Number.isFinite(ms) && ms > 0) err.retryAfterMs = ms; }
  }
  return err;
}

// cachedTokens (owner 2026-08-03, Fase 0 instrumentación/eficiencia de Mini — MISMO tratamiento que openai.js):
// Anthropic expone cache_read_input_tokens en el usage crudo (tokens del prompt servidos desde el cache del
// proveedor, vía cache_control ephemeral que este adapter YA setea en parse()/narrate() más abajo) — se preserva
// TODO el objeto usage original (ningún campo existente cambia) y se agrega `cachedTokens` normalizado al MISMO
// nombre que usa el adapter de OpenAI, para que el medidor de tokens/costo sea provider-neutral. null (no 0) si el
// campo no vino — nunca se inventa "cero cacheado" cuando el proveedor simplemente no lo informó.
function _usage(u) {
  if (!u) return null;
  const cachedTokens = typeof u.cache_read_input_tokens === "number" ? u.cache_read_input_tokens : null;
  return { ...u, cachedTokens };
}

// ── SYSTEM SEGMENTADO · dónde va el corte del caché (owner 2026-08-10, cierre de la certificación live) ────────
// `system` puede llegar como STRING (todo lo existente, sin cambios) o como ARRAY de segmentos
// `[{text, cache:true|false}, …]`. Con string, el comportamiento es byte-idéntico al de siempre: un bloque con
// `cache_control`. Con array, el `cache_control` va SOLO en el último segmento marcado `cache` — que es donde de
// verdad termina el texto estable.
//
// POR QUÉ IMPORTA: el caché de prefijo de Anthropic exige coincidencia EXACTA hasta el punto de corte. Mandando
// todo en un bloque, el corte quedaba después de la memoria de sesión y del escenario, así que un turno con
// nombre guardado —o con contexto de pantalla— perdía los 7.617 tokens fijos ENTEROS. El texto estable estaba;
// estaba del lado equivocado del corte. Acá no se recorta nada: sólo se mueve el corte a donde corresponde.
// La jerarquía del proveedor es tools → system → messages, así que un corte al final del system fijo también
// cachea el schema de la tool (~925 tokens más) sin pedir nada extra.
function _systemBlocks(system) {
  if (typeof system === "string") return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
  const segs = (Array.isArray(system) ? system : []).filter((s) => s && typeof s.text === "string" && s.text.length);
  if (!segs.length) return null;
  let ultimoCacheable = -1;
  segs.forEach((s, i) => { if (s.cache) ultimoCacheable = i; });
  return segs.map((s, i) => (i === ultimoCacheable
    ? { type: "text", text: s.text, cache_control: { type: "ephemeral" } }
    : { type: "text", text: s.text }));
}

// ── CUERPOS PUROS, EXPORTADOS (owner 2026-08-13, preparación Anthropic) ─────────────────────────────────────────
// Construir el request y enviarlo son dos responsabilidades: la construcción es verificable OFFLINE (un probe la
// ejercita sin credencial y sin red, y compara el objeto byte a byte), el envío no. Mismo criterio que sacar la
// decisión de proveedor a providerConfig.js: lo que no se puede ejercer sin gastar, se aísla de lo que sí.
// parse()/narrate() llaman a estas mismas funciones — no hay un segundo cuerpo que se desincronice.
export function buildParseBody(text, { system, tool, model }) {
  return {
    model, max_tokens: 1024,
    system: _systemBlocks(system),
    tools: [{ name: tool.name, description: tool.description, input_schema: tool.schema }],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content: text }],
  };
}
// _mensajesNaturales(validatedOutput) → los messages del MODO NATURAL, o null para todo lo demás (owner
// 2026-08-14, camino natural): cuando el payload declara `modoNatural` con `mensajes` (el hilo {role, content}),
// el hilo viaja como messages REALES del proveedor en vez del payload serializado en un único mensaje de usuario.
// Solo roles user/assistant, solo content de texto no vacío (el proveedor rechaza un content en blanco) y el
// último turno debe ser del usuario. Cualquier caller sin `modoNatural` queda BYTE-IDÉNTICO a siempre.
function _mensajesNaturales(validatedOutput) {
  if (!validatedOutput || validatedOutput.modoNatural !== true || !Array.isArray(validatedOutput.mensajes)) return null;
  const msgs = validatedOutput.mensajes
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));
  return msgs.length && msgs[msgs.length - 1].role === "user" ? msgs : null;
}
export function buildNarrateBody(validatedOutput, { model, system }) {
  const mensajes = _mensajesNaturales(validatedOutput);
  return {
    model, max_tokens: _narrateMaxTokens(),
    system: _systemBlocks(system),
    messages: mensajes || [{ role: "user", content: JSON.stringify(validatedOutput) }],
  };
}

async function _call(body) {
  // Usa la conexión DEL ENTORNO si existe (ANTHROPIC_BASE_URL = proxy que inyecta auth · Claude Code/SDK).
  // Si hay key/token explícitos en env, se agregan. La key NUNCA se imprime en logs.
  const headers = { "content-type": "application/json", "anthropic-version": VERSION };
  if (process.env.ANTHROPIC_API_KEY) headers["x-api-key"] = process.env.ANTHROPIC_API_KEY;
  if (process.env.ANTHROPIC_AUTH_TOKEN) headers["authorization"] = "Bearer " + process.env.ANTHROPIC_AUTH_TOKEN;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) throw _rateLimitError(res.status, await res.text(), res.headers);
    return await res.json();
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`timeout tras ${TIMEOUT_MS}ms esperando a Anthropic`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const anthropicAdapter = {
  name: "anthropic",
  keyEnv: "ANTHROPIC_API_KEY",
  // hay conexión SOLO si el entorno da una credencial usable (key o token). El base URL solo cambia el endpoint,
  // no autentica: api.anthropic.com público exige x-api-key. Sin exponer valores.
  isAvailable() { return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN); },

  // texto → spec · fuerza la tool (JSON garantizado). Traduce la tool NEUTRAL de ADI al formato Anthropic (input_schema).
  // PROMPT CACHING (mejora 9 · 2026-07-26): el system (contractMenu ~3.5k tokens) + la tool son un prefijo FIJO entre
  // llamadas — cache_control lo marca reutilizable (TTL ~5 min) → menor latencia por turno en conversación. Lo variable
  // (pregunta + contexto) viaja en el mensaje de usuario, FUERA del caché. OpenAI cachea prefijos >1k tokens solo.
  async parse(text, { system, tool, model }) {
    const data = await _call(buildParseBody(text, { system, tool, model }));
    const tu = (data.content || []).find((b) => b.type === "tool_use");
    // MISMO TRATO QUE openai.js (owner 2026-08-13): el agujero era idéntico acá — un objeto que no viene del
    // proveedor se reportaba como "sin tool_use", o sea señalando al adaptador. Ver respuestaProveedor.js.
    if (!tu) throw errorDeRespuesta(data, { proveedor: "anthropic", esperado: "tool_use" });
    // MODELO EFECTIVO (owner 2026-08-10, cierre de la certificación live): el que se PIDE y el que RESPONDE no son
    // la misma cadena — el proveedor resuelve el alias a una versión concreta, y para medir costo importa el que
    // respondió. Se devolvía solo el pedido, así que las 11 llamadas de la corrida quedaron con el modelo en "?".
    // Campo aditivo: quien no lo lea recibe exactamente lo mismo que antes.
    return { spec: tu.input, usage: _usage(data.usage), model: data.model || null };
  },

  // output validado → narración (reformula sin cambiar cifras · el number-guard lo verifica aparte, en ADI)
  // mismo caching que parse: el system del narrador (~2k tokens) es prefijo fijo · el output validado va fuera del caché
  async narrate(validatedOutput, { model, system }) {
    if (!system) throw new Error("narrate() sin system: el contrato debe venir armado del caller, el adapter no define uno propio");
    const data = await _call(buildNarrateBody(validatedOutput, { model, system }));
    // narrar tampoco puede fingir éxito con un objeto ajeno · ver el bloque equivalente en openai.js: un
    // contenido vacío de una respuesta REAL sigue devolviendo "" igual que siempre.
    const ajeno = sobreAjeno(data, "anthropic");
    if (ajeno) throw ajeno;
    const txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    // `stop` es el MOTIVO DE CORTE del proveedor (owner 2026-08-21): con una respuesta vacía es lo único que
    // distingue un corte por límite de tokens de un fin de turno normal o de una negativa. Se copia tal cual.
    return { text: txt, usage: _usage(data.usage), model: data.model || null, stop: data.stop_reason || null };   // modelo EFECTIVO · ver parse()
  },
};
