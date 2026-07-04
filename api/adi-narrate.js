/* === api/adi-narrate.js · Vercel serverless · LLM #2 (output validado → narración) ===
 * Entrypoint de Vercel para POST /api/adi-narrate. Idéntico a adi-spec.js: `gatewayFetch` rutea por
 * `pathname` (/api/adi-narrate → handleNarrate). Una sola lógica; acá sólo el wrapper de plataforma.
 * La key vive en OPENAI_API_KEY (server-side) · NUNCA VITE_*. Runtime `edge` (gateway fetch-puro).
 */
import { gatewayFetch } from "../src/adi/llm/gatewayFetch.js";

export const config = { runtime: "edge" };

export default function handler(request) {
  return gatewayFetch(request);
}
