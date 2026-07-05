/* === src/adi/llm/adapters/openai.js · ADI Core · Paso 5 · ADAPTER OpenAI ===
 * Mismo contrato de adapter que Anthropic: recibe entradas NEUTRALES de ADI (system=contractMenu, tool neutral, text,
 * model) y devuelve el SPEC. Traduce la tool neutral al formato de OpenAI (function calling · tool_choice forzado) y
 * mapea el usage a la forma común del harness. NO define métricas/entidades/verdad — eso es de ADI (contrato).
 *
 * Esto PRUEBA la regla de oro: cambiar de proveedor = cambiar SOLO el adapter. El spec, el contrato, answerADIFromSpec,
 * el number-guard y los tests no se tocan.
 */
const BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const ENDPOINT = BASE + "/chat/completions";

async function _call(body) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("falta OPENAI_API_KEY");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": "Bearer " + key },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 240)}`);
  return res.json();
}

// OpenAI devuelve usage {prompt_tokens, completion_tokens} → lo mapeamos a la forma común {input_tokens, output_tokens}
const _usage = (u) => (u ? { input_tokens: u.prompt_tokens || 0, output_tokens: u.completion_tokens || 0 } : null);

export const openaiAdapter = {
  name: "openai",
  keyEnv: "OPENAI_API_KEY",
  isAvailable() { return !!process.env.OPENAI_API_KEY; },

  // texto → spec · función forzada (JSON garantizado por el schema). Traduce la tool NEUTRAL de ADI a function.parameters.
  async parse(text, { system, tool, model }) {
    const data = await _call({
      model, max_tokens: 1024,
      messages: [{ role: "system", content: system }, { role: "user", content: text }],
      tools: [{ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.schema } }],
      tool_choice: { type: "function", function: { name: tool.name } },
    });
    const call = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.tool_calls && data.choices[0].message.tool_calls[0];
    if (!call) throw new Error("sin tool_call en la respuesta");
    let spec;
    try { spec = JSON.parse(call.function.arguments); }
    catch (e) { throw new Error("JSON inválido del tool_call: " + e.message); }
    return { spec, usage: _usage(data.usage) };
  },

  // output validado → narración (no se usa en el experimento v1 · queda listo · regla: no cambia cifras)
  async narrate(validatedOutput, { model }) {
    const data = await _call({
      model, max_tokens: 1024,
      messages: [
        { role: "system", content: "Reformulá la respuesta de ADI (campo `text`) en español, más conversacional y ejecutiva, manteniendo la voz decidida de ADI (lectura, porqué, palanca). REGLAS DURAS sobre las cifras: (1) copiá cada número EXACTAMENTE como aparece, CON su unidad ($, K, M, %, x, días); (2) NO cambies la escala (nunca conviertas M a K ni % a puntos); (3) NO derives, calcules ni inventes NINGÚN número nuevo: prohibido inventar ratios, múltiplos ('N veces'), diferencias ni porcentajes que no estén ya en el texto; (4) no omitas ninguna cifra. FORMATO: prosa en párrafos; SIN columnas, SIN tablas ASCII, un solo espacio entre palabras. Devolvé SOLO la reformulación, sin preámbulos." },
        { role: "user", content: JSON.stringify(validatedOutput) },
      ],
    });
    const txt = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    return { text: txt, usage: _usage(data.usage) };
  },
};
