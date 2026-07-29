/* === api/adi-plan.js · Vercel serverless · ARQUITECTURA C · Pasada 1 (PLAN) ===
 * Entrypoint de Vercel para POST /api/adi-plan. Idéntico a adi-narrate.js/adi-spec.js: `gatewayFetch` rutea por
 * `pathname` (/api/adi-plan → handlePlan). Una sola lógica; acá sólo el wrapper de plataforma.
 * La key vive en OPENAI_API_KEY (server-side) · NUNCA VITE_*. Runtime `edge` (gateway fetch-puro).
 */
import { gatewayFetch } from "../src/adi/llm/gatewayFetch.js";

export const config = { runtime: "edge" };

export default function handler(request) {
  return gatewayFetch(request);
}
