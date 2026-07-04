/* === api/adi-spec.js · Vercel serverless · LLM #1 (texto → spec canónica) ===
 * Entrypoint de Vercel para POST /api/adi-spec. Reusa el handler web-estándar `gatewayFetch`
 * (UNA sola lógica compartida con dev/Vite y server.js) — acá sólo lo envolvemos. `gatewayFetch`
 * rutea por `pathname`, así que este archivo y adi-narrate.js son idénticos salvo la ruta que les
 * asigna Vercel (nombre del archivo → ruta).
 *
 * · La key vive en OPENAI_API_KEY (Environment Variables del proyecto Vercel · server-side) · NUNCA VITE_*.
 * · Runtime `edge`: el gateway es fetch puro (sin APIs Node) → corre en el edge sin shims. No toca el motor.
 * · Si falta la key / el LLM falla → gatewayFetch responde {ok:false} y el cliente degrada al piso determinístico.
 */
import { gatewayFetch } from "../src/adi/llm/gatewayFetch.js";

export const config = { runtime: "edge" };

export default function handler(request) {
  return gatewayFetch(request);   // env → process.env (Vercel inyecta las Environment Variables)
}
