/* === src/adi/llm/providerAdapter.js · ADI Core · Paso 5 v1 · INTERFAZ + REGISTRY provider-neutral ===
 * REGLA DE ORO (owner): ADI NO depende de Anthropic. ADI depende de un contrato interno:
 *   input: texto + contractMenu   →   output: spec canónico v1
 * El proveedor LLM es SOLO un adapter que intenta producir ese spec. El proveedor NUNCA define métricas, entidades,
 * disponibilidad, cálculos, bloqueos ni verdad del dato — eso lo define ADI por contrato (Paso 3+4).
 *
 * INTERFAZ del adapter:
 *   name:   string
 *   keyEnv: string                                   // env var de su API key (para chequear disponibilidad)
 *   parse(text, {system, tool, model})   → { spec, usage }
 *   narrate(validatedOutput, {model})    → { text, usage }
 *
 * Cambiar de proveedor = cambiar el adapter (y su traducción de tool/schema). El spec, el contrato,
 * answerADIFromSpec, el number-guard y los tests NO se tocan.
 *
 * VARIABLES (env): LLM_PROVIDER · LLM_MODEL_PARSE · LLM_MODEL_NARRATE · LLM_PARSE_ENABLED · LLM_NARRATE_ENABLED. */
import { anthropicAdapter } from "./adapters/anthropic.js";
import { openaiAdapter } from "./adapters/openai.js";

// stub honesto: declara la forma, no finge capacidad. Implementar = escribir parse/narrate para ese proveedor.
const _stub = (name, keyEnv) => ({
  name, keyEnv,
  parse() { throw new Error(`adapter "${name}" no implementado todavía (provider-neutral: agregá parse/narrate en src/adi/llm/adapters/${name}.js)`); },
  narrate() { throw new Error(`adapter "${name}" no implementado todavía`); },
});

export const ADAPTERS = {
  anthropic: anthropicAdapter,
  openai: openaiAdapter,                      // implementado (Paso 5 · prueba viva de provider-neutralidad)
  gemini: _stub("gemini", "GEMINI_API_KEY"),
  local: _stub("local", "LOCAL_MODEL_URL"),
};

export function getAdapter(provider) {
  const a = ADAPTERS[provider];
  if (!a) throw new Error(`LLM_PROVIDER desconocido: "${provider}" · disponibles: ${Object.keys(ADAPTERS).join(", ")}`);
  return a;
}
