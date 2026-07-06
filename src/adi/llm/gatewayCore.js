/* === src/adi/llm/gatewayCore.js · GATEWAY LLM · handlers PLATFORM-NEUTRAL (una sola fuente de verdad) ===
 * La lógica de los DOS pasos del LLM, SIN acoplarse a Vite ni a ninguna plataforma:
 *   · handleSpec    · LLM #1 · texto → spec canónico (adapter.parse)
 *   · handleNarrate · LLM #2 · output validado → narración (adapter.narrate)
 * Cada entorno (dev Vite · server Node · función serverless) es un WRAPPER delgado que llama a estos handlers.
 *
 * REGLA: la key vive en el env del SERVER (process.env) · JAMÁS en el cliente ni en el bundle. El motor ADI y el
 * number-guard corren en el CLIENTE (answerADIFromSpec + pickNarratedText local) → este gateway sólo habla con el
 * proveedor. NO toca el motor sellado. Si algo falla → {ok:false} y el cliente degrada al piso determinístico.
 */
import { buildContractMenu, buildParseUserMessage } from "./contractMenu.js";
import { buildSpecTool } from "./specTool.js";
import { buildNarrateSystem } from "./narratePrompt.js";
import { getAdapter } from "./providerAdapter.js";

// config del proveedor desde el env (en dev el .env se carga a process.env · en prod lo setea la plataforma).
// `env` inyectable para runtimes que no exponen process.env global (ej. Cloudflare Workers) · default process.env.
function _config(env) {
  const e = env || (typeof process !== "undefined" ? process.env : {}) || {};
  const provider = e.LLM_PROVIDER || "anthropic";
  const model = e.LLM_MODEL_PARSE || e.OPENAI_MODEL || e.ANTHROPIC_MODEL || "gpt-4o-mini";
  const narrateModel = e.LLM_MODEL_NARRATE || model;
  return { provider, model, narrateModel };
}

// LLM #1 · texto (+ contexto de conversación) → spec · devuelve {ok, spec, usage} | {ok:false, error}
// El `context` (conversationContext · turnos + última evidencia) viaja al LLM #1 vía buildParseUserMessage → clasifica
// turn_type y resuelve referencias. El motor/seam sigue validando; el contexto NO habilita saltar guards.
export async function handleSpec({ text, context } = {}, env) {
  if (!text || typeof text !== "string") return { ok: false, error: "sin texto" };
  const { provider, model } = _config(env);
  const userMessage = buildParseUserMessage(context, text);
  const { spec, usage } = await getAdapter(provider).parse(userMessage, { system: buildContractMenu(), tool: buildSpecTool(), model });
  return { ok: true, spec, usage };
}

// LLM #2 · output validado → narración · el number-guard corre en el CLIENTE (si falla → texto determinístico)
export async function handleNarrate({ text, evidence } = {}, env) {
  if (!text || typeof text !== "string") return { ok: false, error: "sin texto" };
  const { provider, narrateModel } = _config(env);
  const system = buildNarrateSystem(evidence);   // general vs simulación (evidence.transform) · provider-neutral
  const { text: narration, usage } = await getAdapter(provider).narrate({ text, evidence }, { model: narrateModel, system });
  return { ok: true, narration, usage };
}

// path → handler (para los wrappers que enrutan por URL)
export const GATEWAY_ROUTES = {
  "/api/adi-spec": handleSpec,
  "/api/adi-narrate": handleNarrate,
};
