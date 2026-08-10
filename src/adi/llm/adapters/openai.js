/* === src/adi/llm/adapters/openai.js · ADI Core · Paso 5 · ADAPTER OpenAI ===
 * Mismo contrato de adapter que Anthropic: recibe entradas NEUTRALES de ADI (system=contractMenu, tool neutral, text,
 * model) y devuelve el SPEC. Traduce la tool neutral al formato de OpenAI (function calling · tool_choice forzado) y
 * mapea el usage a la forma común del harness. NO define métricas/entidades/verdad — eso es de ADI (contrato).
 *
 * Esto PRUEBA la regla de oro: cambiar de proveedor = cambiar SOLO el adapter. El spec, el contrato, answerADIFromSpec,
 * el number-guard y los tests no se tocan. CERO imports de módulos de producto (owner 2026-07-29, capa de rol
 * conversacional: "el adaptador solo debe recibir el contrato, el contexto y la boleta, y devolver una narración
 * estructurada — no pongas lógica de producto dentro del adaptador"): si `system` no llega, FALLA fuerte en vez de
 * narrar en silencio con una voz genérica ajena al contrato vigente — gatewayCore SIEMPRE lo provee.
 */

const BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const ENDPOINT = BASE + "/chat/completions";
// TIMEOUT (owner 2026-07-29, rendimiento/multiempresa): sin esto, un proveedor colgado bloqueaba el request
// indefinidamente — bajo carga con muchos tenants eso agota conexiones/workers. Default 25s (bajo el límite típico
// de función serverless), configurable por env sin tocar código.
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 25000;

// _rateLimitError(status, bodyText, headers) → Error con `.code="rate_limited"` (+ `.retryAfterMs` si el proveedor
// lo informó) cuando status===429 — owner 2026-08-03, investigación cruzada de los 5 gates de Arquitectura C:
// antes un 429 era un Error genérico INDISTINGUIBLE de un timeout o un 500, así que el caller (answerViaOracle.js)
// no podía backoffear específicamente ante rate-limit real. NO decide reintentos ni modelo acá (el adapter solo
// habla con el proveedor) — solo etiqueta la señal para que el loop de reintento la consuma.
function _rateLimitError(status, bodyText, headers) {
  const err = new Error(`HTTP ${status}: ${bodyText.slice(0, 240)}`);
  if (status === 429) {
    err.code = "rate_limited";
    const ra = headers && typeof headers.get === "function" ? headers.get("retry-after") : null;
    if (ra != null) { const ms = Number(ra) * 1000; if (Number.isFinite(ms) && ms > 0) err.retryAfterMs = ms; }
  }
  return err;
}

async function _call(body) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("falta OPENAI_API_KEY");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": "Bearer " + key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw _rateLimitError(res.status, await res.text(), res.headers);
    return await res.json();
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`timeout tras ${TIMEOUT_MS}ms esperando a OpenAI`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// OpenAI devuelve usage {prompt_tokens, completion_tokens} → lo mapeamos a la forma común {input_tokens, output_tokens}
// cachedTokens (owner 2026-08-03, Fase 0 instrumentación/eficiencia de Mini): OpenAI expone
// usage.prompt_tokens_details.cached_tokens (tokens del prompt servidos desde el cache del proveedor, más baratos)
// pero antes se descartaba acá mismo al armar la forma común — sin esto, ningún medidor de tokens/costo podía saber
// cuánto del prompt YA estaba cacheado. Campo NUEVO, aditivo — null (no 0) si el proveedor no lo informó, para no
// fingir "cero cacheado" cuando en realidad no hay dato.
const _usage = (u) => (u ? {
  input_tokens: u.prompt_tokens || 0,
  output_tokens: u.completion_tokens || 0,
  cachedTokens: (u.prompt_tokens_details && typeof u.prompt_tokens_details.cached_tokens === "number") ? u.prompt_tokens_details.cached_tokens : null,
} : null);

// FAMILIA gpt-5.x/gpt-5.6.x (router owner 2026-08-02, verificado con probes en vivo — ver _model_comparison.mjs):
// tres diferencias de API frente a gpt-4o-mini, confirmadas por 400 real antes de arreglarlas:
//   1. max_tokens → RECHAZADO ("Unsupported parameter... Use 'max_completion_tokens' instead").
//   2. temperature → RECHAZADO si no es el default (ya no lo seteamos acá, no toca).
//   3. tool_choice forzado (function calling) exige reasoning_effort:"none" en /v1/chat/completions, o 400 apuntando
//      a /v1/responses. Solo aplica a PARSE (donde SIEMPRE forzamos tool_choice) — NARRATE mantiene el reasoning
//      por defecto de cada modelo (así se midió en el benchmark, es el comportamiento real de producción).
const _isReasoningFamily = (model) => /^gpt-5/i.test(model || "");

export const openaiAdapter = {
  name: "openai",
  keyEnv: "OPENAI_API_KEY",
  isAvailable() { return !!process.env.OPENAI_API_KEY; },

  // texto → spec · función forzada (JSON garantizado por el schema). Traduce la tool NEUTRAL de ADI a function.parameters.
  async parse(text, { system, tool, model }) {
    const reasoning = _isReasoningFamily(model);
    const body = {
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: text }],
      tools: [{ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.schema } }],
      tool_choice: { type: "function", function: { name: tool.name } },
    };
    body[reasoning ? "max_completion_tokens" : "max_tokens"] = reasoning ? 2048 : 1024;
    if (reasoning) body.reasoning_effort = "none";   // requisito de la API para tool_choice forzado en esta familia
    const data = await _call(body);
    const call = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.tool_calls && data.choices[0].message.tool_calls[0];
    if (!call) throw new Error("sin tool_call en la respuesta");
    let spec;
    try { spec = JSON.parse(call.function.arguments); }
    catch (e) { throw new Error("JSON inválido del tool_call: " + e.message); }
    // MODELO EFECTIVO (owner 2026-08-10, cierre de la certificación live · MISMO tratamiento que anthropic.js): el
    // que se PIDE y el que RESPONDE no son la misma cadena — OpenAI resuelve "gpt-4o-mini" a una versión fechada,
    // y para medir costo importa el que respondió. Campo aditivo, provider-neutral.
    return { spec, usage: _usage(data.usage), model: data.model || null };
  },

  // output validado → narración · el system (el CONTRATO) lo elige y arma gatewayCore/el módulo de prompt · el
  // adapter NUNCA decide ni sustituye esa voz — no cambia cifras
  async narrate(validatedOutput, { model, system }) {
    if (!system) throw new Error("narrate() sin system: el contrato debe venir armado del caller, el adapter no define uno propio");
    const reasoning = _isReasoningFamily(model);
    const body = {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(validatedOutput) },
      ],
    };
    body[reasoning ? "max_completion_tokens" : "max_tokens"] = reasoning ? 2048 : 1024;
    const data = await _call(body);
    const txt = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    return { text: txt, usage: _usage(data.usage), model: data.model || null };   // modelo EFECTIVO · ver parse()
  },
};
