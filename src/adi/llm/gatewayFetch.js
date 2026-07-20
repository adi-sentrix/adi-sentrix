/* === src/adi/llm/gatewayFetch.js · GATEWAY LLM · handler WEB-ESTÁNDAR (Request → Response) ===
 * Entrypoint UNIVERSAL para producción. La Fetch API (Request/Response) la hablan Node 18+, Vercel, Netlify,
 * Cloudflare Workers, Deno y Bun → cualquier plataforma envuelve esto en 2-3 líneas (ver DEPLOY.md).
 * Enruta POST /api/adi-spec y /api/adi-narrate a los handlers platform-neutral (gatewayCore).
 * NO toca el motor · la key vive en el env del server. Errores → {ok:false} y el cliente degrada al piso.
 */
import { GATEWAY_ROUTES } from "./gatewayCore.js";

const _json = (obj, status = 200, extraHeaders = null) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...(extraHeaders || {}) } });

// ── RATE LIMIT DEL BORDE para op:mint (auditoría 2026-07-14 · el MEDIO) ────────────────────────────────────────
// Ventana deslizante EN ESTE WRAPPER (que sí ve el request/IP) — jamás en handleAccess: la lógica pura la llama
// _access_gate.mjs sin request y se rompería (gate-safe por diseño). Es defensa en profundidad: la barrera
// primaria es la entropía de ADI_ADMIN_KEY (rotada a 32 bytes); esto encarece el bruteforce online barato y el
// abuso de costo. Estado por-isolate (se resetea en cold start): suficiente contra ráfagas, documentado y asumido.
const MINT_WINDOW_MS = 10 * 60 * 1000;   // ventana de 10 minutos
const MINT_MAX_PER_IP = 5;               // 5 intentos de mint por IP por ventana (el owner mintea de a uno)
const MINT_MAX_GLOBAL = 30;              // techo global del isolate por ventana (paranoia barata anti-botnet)
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

const _clientIp = (request) =>
  (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
  request.headers.get("x-real-ip") || "sin-ip";

// gatewayFetch(request, env) → Response · `env` opcional (para runtimes tipo Cloudflare que pasan el env al handler)
export async function gatewayFetch(request, env) {
  const url = new URL(request.url);
  const handler = GATEWAY_ROUTES[url.pathname];
  if (!handler) return _json({ ok: false, error: "ruta desconocida" }, 404);
  if (request.method !== "POST") return _json({ ok: false, error: "usá POST" }, 405);
  let body;
  try { body = await request.json(); } catch { body = {}; }
  // solo op:mint pasa por el limitador (check/status quedan libres — el flujo del invitado no se toca)
  if (url.pathname === "/api/adi-access" && body && body.op === "mint" && _mintLimited(_clientIp(request))) {
    return _json({ ok: false, error: "demasiados intentos — espera unos minutos y prueba de nuevo" }, 429, { "retry-after": "600" });
  }
  try { return _json(await handler(body, env)); }
  catch (e) {
    // El detalle del error puede traer el cuerpo de error del proveedor (modelo/cuota/organización) → NUNCA al cliente.
    // Va SOLO al log del server (Vercel/host lo captura); el cliente recibe un mensaje genérico y cae al piso determinístico.
    try { console.log(`[adi-gateway] ERROR ${url.pathname}: ${String(e && e.message).slice(0, 200)}`); } catch { /* runtime sin console */ }
    return _json({ ok: false, error: "gateway no disponible" });
  }
}
