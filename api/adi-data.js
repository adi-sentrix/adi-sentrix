/* === api/adi-data.js · Vercel serverless · EL DATO DE UNA SOLA EMPRESA (vía 1 · 2026-08-20) ===
 * Mismo patrón que adi-plan/adi-narrate/adi-access: `gatewayFetch` rutea por `pathname` (/api/adi-data →
 * handleData). Una sola lógica; acá solo el envoltorio de plataforma.
 *
 * QUÉ CAMBIA EN EL PRODUCTO: hasta hoy el navegador se descargaba el dato de TODAS las empresas dentro del
 * bundle y la app elegía cuál pintar. Desde acá, el navegador no recibe ninguno: pide el suyo, y el servidor
 * decide cuál es a partir de la sesión firmada (ver src/data/tenantService.server.js). El secret que verifica esa
 * sesión es ADI_TOKEN_SECRET, server-side · NUNCA VITE_*. Runtime `edge`, como el resto.
 */
import { gatewayFetch } from "../src/adi/llm/gatewayFetch.js";

export const config = { runtime: "edge" };

export default function handler(request) {
  return gatewayFetch(request);
}
