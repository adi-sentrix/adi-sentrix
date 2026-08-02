/* === src/adi/llm/modelRouter.js · ROUTER DETERMINÍSTICO de modelo por turno (owner 2026-08-02) ===
 * ORIGEN: comparación empírica de gpt-4o-mini vs gpt-5.6-terra vs gpt-5.6-sol contra el pipeline REAL de
 * producción (answerViaOracle, _model_comparison.mjs, no committeado — herramienta de investigación). Hallazgo
 * clave: el gap de calidad que el estudio encontró en simulación/clarify (T5/T6) se cerró GRATIS a nivel de motor
 * (ver ensureHypothesisFraming/ensureClarifyClosingQuestion en narratePromptC.js) — con ese fix, gpt-4o-mini quedó
 * en 91% de calidad estructural, sin ninguna falla sistemática por MODO. Por eso este router NO rutea por modo/
 * contrato de forma estática (no hay evidencia real de que terra/sol mejoren un modo específico hoy) — rutea por
 * REINTENTO: mini es el piso (barato, rápido, ya garantizado por el motor); si guardC/el schema rechaza esa
 * respuesta, el SIGUIENTE intento escala a un modelo más capaz antes de gastar el presupuesto de reintentos en el
 * mismo modelo que ya falló. Esto es EXACTAMENTE "reserva Sol como escalamiento cuando otro modelo falle los
 * controles" (owner) — medido: mini necesitó más reintentos de NARRAR que terra, que necesitó más que sol
 * (10 vs 8 vs 7 llamadas de NARRAR sobre 6 turnos, mismo hilo, mismo pipeline).
 *
 * REGLA DE ORO: el LLM NUNCA elige su propio modelo — esta función es la ÚNICA decisión, es pura (mismos inputs,
 * mismo output), y vive en el gateway (gatewayCore.js la llama desde handlePlan/handleNarrateC). No hay arquitectura
 * paralela: es el mismo `model` que YA viajaba a getAdapter(provider).parse/narrate, solo que ahora lo resuelve
 * esta función en vez de una sola constante de env.
 *
 * ALCANCE: solo aplica cuando provider="openai" (la familia mini/terra/sol) — otros proveedores (anthropic, stubs)
 * siguen exactamente su config estática de siempre, sin tocar. Kill-switch LLM_ROUTER_ENABLED="false" (mismo
 * patrón que ADI_MINT_ENABLED en gatewayCore.js) por si hace falta apagarlo sin revertir código.
 */
const DEFAULT_TIER2 = "gpt-5.6-terra";
const DEFAULT_TIER3 = "gpt-5.6-sol";

function _env(env) {
  return env || (typeof process !== "undefined" ? process.env : {}) || {};
}

// chooseModel({ provider, tier1, attempt, step, mode, env }) → { model, tier, reason } | null
//   null = el router NO aplica (proveedor distinto de openai, o apagado) — el caller usa su modelo estático de siempre.
//   tier1: el modelo YA resuelto por la config estática de siempre (LLM_MODEL_PARSE/NARRATE) — es el modelo de
//   intento 0, así que hoy (attempt=0, sin cambios de env) el comportamiento es BYTE-IGUAL al actual.
export function chooseModel({ provider, tier1, attempt = 0, step, mode, env } = {}) {
  const e = _env(env);
  if (provider !== "openai") return null;
  if (String(e.LLM_ROUTER_ENABLED) === "false") return null;
  const tier2 = e.LLM_MODEL_TIER2 || DEFAULT_TIER2;
  const tier3 = e.LLM_MODEL_TIER3 || DEFAULT_TIER3;
  // CLAMP (hallazgo de auditoría 2026-08-02): `attempt` viaja en el body de una request HTTP — nunca confíes en un
  // número crudo de un caller externo. Sin esto, un attempt=999 igual resolvía tier3 (no revienta), pero acotarlo
  // acá deja el contrato explícito: NUNCA hay un tier 4+, sin importar qué mande el caller.
  const a = Math.min(Math.max(Number(attempt) || 0, 0), 2);
  const modeTag = mode ? `, modo=${mode}` : "";
  if (a <= 0) return { model: tier1, tier: 1, reason: `tier1:base (${step}, intento 1${modeTag})` };
  if (a === 1) return { model: tier2, tier: 2, reason: `tier2:reintento tras rechazo (${step}, intento 2${modeTag})` };
  return { model: tier3, tier: 3, reason: `tier3:reintento final tras 2 rechazos (${step}, intento ${a + 1}${modeTag})` };
}
