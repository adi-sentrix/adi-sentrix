/* === src/adi/llm/modelPricing.js · precios verificados por modelo (USD por 1M tokens) ===
 * Única fuente de precio para el router (modelRouter.js) y para la telemetría de costo por turno (ChatADI.jsx).
 * Verificado 2026-08-02 (2 fuentes independientes, cloudzero.com + benchlm.ai, coinciden exacto) — mismo
 * _model_comparison.mjs que midió calidad/latencia/costo real contra el pipeline de producción.
 */
export const MODEL_PRICING = {
  "gpt-4o-mini": { in: 0.15, out: 0.60 },
  "gpt-5.6-luna": { in: 0.20, out: 1.20 },
  "gpt-5.6-terra": { in: 2.00, out: 12.00 },
  "gpt-5.6-sol": { in: 5.00, out: 30.00 },
};

// estimateCostUSD(model, usage) → número | null (modelo sin precio conocido, o sin usage — nunca inventa un precio)
export function estimateCostUSD(model, usage) {
  const p = MODEL_PRICING[model];
  if (!p || !usage) return null;
  return ((usage.input_tokens || 0) / 1e6) * p.in + ((usage.output_tokens || 0) / 1e6) * p.out;
}
