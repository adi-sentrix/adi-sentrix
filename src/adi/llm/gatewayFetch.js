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
  catch (e) { return _json({ ok: false, error: String(e && e.message) }); }   // el cliente cae al piso determinístico
}
