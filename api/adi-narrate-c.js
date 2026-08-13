/* === api/adi-narrate-c.js · Vercel serverless · ARQUITECTURA C · Pasada 2 (NARRAR) ===
 * Entrypoint de Vercel para POST /api/adi-narrate-c. Idéntico a adi-narrate.js/adi-spec.js: `gatewayFetch` rutea
 * por `pathname` (/api/adi-narrate-c → handleNarrateC). Una sola lógica; acá sólo el wrapper de plataforma.
 * La key vive en el env del server · NUNCA VITE_*.
 * Runtime NODE, no edge (2026-08-14, hallazgo en vivo con Anthropic): el runtime edge exige que la respuesta
 * EMPIECE a salir en 25s, y este handler responde de una sola vez al final — Sonnet en turnos ricos tarda más,
 * Vercel cortaba la función y el cliente caía al piso determinístico aunque LLM_TIMEOUT_MS estuviera en 90s.
 * El tope de duración del runtime node se declara en vercel.json (functions.maxDuration), no acá.
 */
import { gatewayFetch } from "../src/adi/llm/gatewayFetch.js";

export default function handler(request) {
  return gatewayFetch(request);
}
