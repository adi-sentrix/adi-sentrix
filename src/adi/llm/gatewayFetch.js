/* === src/adi/llm/gatewayFetch.js · GATEWAY LLM · handler WEB-ESTÁNDAR (Request → Response) ===
 * Entrypoint UNIVERSAL para producción. La Fetch API (Request/Response) la hablan Node 18+, Vercel, Netlify,
 * Cloudflare Workers, Deno y Bun → cualquier plataforma envuelve esto en 2-3 líneas (ver DEPLOY.md).
 * Enruta POST /api/adi-spec y /api/adi-narrate a los handlers platform-neutral (gatewayCore).
 * NO toca el motor · la key vive en el env del server. Errores → {ok:false} y el cliente degrada al piso.
 */
import { GATEWAY_ROUTES } from "./gatewayCore.js";

const _json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

// gatewayFetch(request, env) → Response · `env` opcional (para runtimes tipo Cloudflare que pasan el env al handler)
export async function gatewayFetch(request, env) {
  const url = new URL(request.url);
  const handler = GATEWAY_ROUTES[url.pathname];
  if (!handler) return _json({ ok: false, error: "ruta desconocida" }, 404);
  if (request.method !== "POST") return _json({ ok: false, error: "usá POST" }, 405);
  let body;
  try { body = await request.json(); } catch { body = {}; }
  try { return _json(await handler(body, env)); }
  catch (e) {
    // El detalle del error puede traer el cuerpo de error del proveedor (modelo/cuota/organización) → NUNCA al cliente.
    // Va SOLO al log del server (Vercel/host lo captura); el cliente recibe un mensaje genérico y cae al piso determinístico.
    try { console.log(`[adi-gateway] ERROR ${url.pathname}: ${String(e && e.message).slice(0, 200)}`); } catch { /* runtime sin console */ }
    return _json({ ok: false, error: "gateway no disponible" });
  }
}
