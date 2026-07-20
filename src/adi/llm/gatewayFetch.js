/* === src/adi/llm/gatewayFetch.js · GATEWAY LLM · handler WEB-ESTÁNDAR (Request → Response) ===
 * Entrypoint UNIVERSAL para producción. La Fetch API (Request/Response) la hablan Node 18+, Vercel, Netlify,
 * Cloudflare Workers, Deno y Bun → cualquier plataforma envuelve esto en 2-3 líneas (ver DEPLOY.md).
 * Enruta POST /api/adi-spec y /api/adi-narrate a los handlers platform-neutral (gatewayCore).
 * NO toca el motor · la key vive en el env del server. Errores → {ok:false} y el cliente degrada al piso.
 */
import { GATEWAY_ROUTES } from "./gatewayCore.js";
import { ipAddress } from "@vercel/functions";

const _json = (obj, status = 200, extraHeaders = null) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...(extraHeaders || {}) } });

// ── RATE LIMIT DE op:mint (auditoría 2026-07-14 · el MEDIO) ────────────────────────────────────────────────────
// ⚠️ BEST-EFFORT POR INSTANCIA, NO CONTROL GLOBAL. Este contador vive en memoria del isolate: Vercel corre y
// recicla múltiples instancias, así que "5/IP" y el techo global NO son garantías a nivel aplicación — un atacante
// distribuido entre isolates los supera. Es DEFENSA ADICIONAL (blunt de ráfagas dentro de un isolate, costo cero),
// NUNCA el control principal. El control real que cierra el MEDIO es (a) la entropía del ADI_ADMIN_KEY ya rotado a
// 32 bytes y (b) un limitador durable pendiente de decisión del owner (Vercel WAF requiere plan Pro · alternativa
// Upstash Redis). Va en el WRAPPER (que ve el request), jamás en handleAccess: _access_gate.mjs lo llama sin request.
const MINT_WINDOW_MS = 10 * 60 * 1000;   // ventana de 10 minutos
const MINT_MAX_PER_IP = 5;               // 5 intentos de mint por IP por ventana (el owner mintea de a uno)
const MINT_MAX_GLOBAL = 30;              // techo del isolate por ventana (blunt anti-ráfaga, NO global de app)
const _mintHits = new Map();             // ip → [timestamps dentro de la ventana]
let _mintGlobal = [];

function _mintLimited(ip, now = Date.now()) {
  const cut = now - MINT_WINDOW_MS;
  _mintGlobal = _mintGlobal.filter((t) => t > cut);
  const mine = (_mintHits.get(ip) || []).filter((t) => t > cut);
  if (mine.length >= MINT_MAX_PER_IP || _mintGlobal.length >= MINT_MAX_GLOBAL) { _mintHits.set(ip, mine); return true; }
  mine.push(now);
  _mintHits.set(ip, mine);
  _mintGlobal.push(now);
  if (_mintHits.size > 500) {            // poda para no crecer sin techo en isolates longevos
    for (const [k, v] of _mintHits) if (!v.some((t) => t > cut)) _mintHits.delete(k);
  }
  return false;
}

// IP CONFIABLE: ipAddress() de @vercel/functions lee `x-real-ip`, que Vercel setea con la IP real del cliente y
// SOBRESCRIBE si el cliente la falsifica. NO usar x-forwarded-for split[0]: Vercel solo lo ANEXA → el primer valor
// es controlable por el atacante (rotaría IPs falsas y saltaría el límite). Sin IP confiable → no se limita (no se
// castiga a todos bajo una misma clave "sin-ip", que sería un auto-DoS).
const _clientIp = (request) => { try { return ipAddress(request) || null; } catch { return null; } };

// gatewayFetch(request, env) → Response · `env` opcional (para runtimes tipo Cloudflare que pasan el env al handler)
export async function gatewayFetch(request, env) {
  const url = new URL(request.url);
  const handler = GATEWAY_ROUTES[url.pathname];
  if (!handler) return _json({ ok: false, error: "ruta desconocida" }, 404);
  if (request.method !== "POST") return _json({ ok: false, error: "usá POST" }, 405);
  let body;
  try { body = await request.json(); } catch { body = {}; }
  // solo op:mint pasa por el limitador (check/status quedan libres — el flujo del invitado no se toca)
  if (url.pathname === "/api/adi-access" && body && body.op === "mint") {
    const ip = _clientIp(request);
    if (ip && _mintLimited(ip)) {
      return _json({ ok: false, error: "demasiados intentos — espera unos minutos y prueba de nuevo" }, 429, { "retry-after": "600" });
    }
  }
  try { return _json(await handler(body, env)); }
  catch (e) {
    // El detalle del error puede traer el cuerpo de error del proveedor (modelo/cuota/organización) → NUNCA al cliente.
    // Va SOLO al log del server (Vercel/host lo captura); el cliente recibe un mensaje genérico y cae al piso determinístico.
    try { console.log(`[adi-gateway] ERROR ${url.pathname}: ${String(e && e.message).slice(0, 200)}`); } catch { /* runtime sin console */ }
    return _json({ ok: false, error: "gateway no disponible" });
  }
}
