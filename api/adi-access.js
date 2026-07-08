/* === api/adi-access.js · Vercel serverless · ACCESO DEMO PRIVADA (status/check/mint) ===
 * Mismo patrón que adi-spec/adi-narrate: `gatewayFetch` rutea por pathname → handleAccess (gatewayCore).
 * Secrets del server: ADI_TOKEN_SECRET (firma los códigos) · ADI_ADMIN_KEY (autoriza emitir) — NUNCA VITE_*.
 */
import { gatewayFetch } from "../src/adi/llm/gatewayFetch.js";

export const config = { runtime: "edge" };

export default function handler(request) {
  return gatewayFetch(request);
}
