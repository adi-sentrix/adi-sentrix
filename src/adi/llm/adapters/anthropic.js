/* === src/adi/llm/adapters/anthropic.js · ADI Core · Paso 5 v1 · ADAPTER Anthropic ===
 * Un adapter SOLO sabe hablarle a su proveedor. Recibe entradas NEUTRALES de ADI (system=contractMenu, tool neutral,
 * text, model) y devuelve el SPEC. NO define métricas, entidades, disponibilidad, cálculos, bloqueos ni verdad del dato
 * — todo eso es de ADI (contrato). Si mañana cambiamos de proveedor, se cambia el adapter; el spec/contrato no.
 *
 * parse(text, {system, tool, model})     → { spec, usage }
 * narrate(validatedOutput, {model})      → { text, usage }   (no se usa en el experimento v1 · queda listo)
 */
const BASE = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");
const ENDPOINT = BASE + "/v1/messages";
const VERSION = "2023-06-01";

async function _call(body) {
  // Usa la conexión DEL ENTORNO si existe (ANTHROPIC_BASE_URL = proxy que inyecta auth · Claude Code/SDK).
  // Si hay key/token explícitos en env, se agregan. La key NUNCA se imprime en logs.
  const headers = { "content-type": "application/json", "anthropic-version": VERSION };
  if (process.env.ANTHROPIC_API_KEY) headers["x-api-key"] = process.env.ANTHROPIC_API_KEY;
  if (process.env.ANTHROPIC_AUTH_TOKEN) headers["authorization"] = "Bearer " + process.env.ANTHROPIC_AUTH_TOKEN;
  const res = await fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 240)}`);
  return res.json();
}

export const anthropicAdapter = {
  name: "anthropic",
  keyEnv: "ANTHROPIC_API_KEY",
  // hay conexión SOLO si el entorno da una credencial usable (key o token). El base URL solo cambia el endpoint,
  // no autentica: api.anthropic.com público exige x-api-key. Sin exponer valores.
  isAvailable() { return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN); },

  // texto → spec · fuerza la tool (JSON garantizado). Traduce la tool NEUTRAL de ADI al formato Anthropic (input_schema).
  async parse(text, { system, tool, model }) {
    const data = await _call({
      model, max_tokens: 1024, system,
      tools: [{ name: tool.name, description: tool.description, input_schema: tool.schema }],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content: text }],
    });
    const tu = (data.content || []).find((b) => b.type === "tool_use");
    if (!tu) throw new Error("sin tool_use en la respuesta");
    return { spec: tu.input, usage: data.usage || null };
  },

  // output validado → narración (reformula sin cambiar cifras · el number-guard lo verifica aparte, en ADI)
  async narrate(validatedOutput, { model }) {
    const data = await _call({
      model, max_tokens: 1024,
      system: "Reformulá la respuesta de ADI (campo `text`) en español, más conversacional y ejecutiva, manteniendo la voz decidida de ADI (lectura, porqué, palanca). REGLAS DURAS sobre las cifras: (1) copiá cada número EXACTAMENTE como aparece, CON su unidad ($, K, M, %, x, días); (2) NO cambies la escala (nunca conviertas M a K ni % a puntos); (3) NO derives, calcules ni inventes NINGÚN número nuevo: prohibido inventar ratios, múltiplos ('N veces'), diferencias ni porcentajes que no estén ya en el texto; (4) no omitas ninguna cifra. FORMATO: prosa en párrafos; SIN columnas, SIN tablas ASCII, un solo espacio entre palabras. Devolvé SOLO la reformulación, sin preámbulos.",
      messages: [{ role: "user", content: JSON.stringify(validatedOutput) }],
    });
    const txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return { text: txt, usage: data.usage || null };
  },
};
