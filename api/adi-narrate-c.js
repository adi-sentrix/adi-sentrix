/* === api/adi-narrate-c.js · Vercel serverless · ARQUITECTURA C · Pasada 2 (NARRAR) ===
 * Entrypoint de Vercel para POST /api/adi-narrate-c → gatewayFetch (handleNarrateC). La key vive en el env
 * del server · NUNCA VITE_*.
 * Runtime NODE, no edge (2026-08-14): el edge exige que la respuesta EMPIECE en 25s y este handler responde
 * de una sola vez al final — Sonnet en turnos ricos tarda 20-25s+ y la plataforma cortaba la función aunque
 * LLM_TIMEOUT_MS estuviera en 90s. El tope real del runtime node vive en vercel.json (functions.maxDuration).
 * FIRMA CLÁSICA (req, res), NO web (2026-08-14, FUNCTION_INVOCATION_FAILED medido en prod): este runtime
 * invoca el handler con (IncomingMessage, ServerResponse); pasarle eso a gatewayFetch revienta en
 * `new URL(request.url)` porque req.url llega RELATIVA. Este adaptador arma el Request web real y vuelca el
 * Response al res — gatewayFetch queda intacto y sigue siendo el único dueño de la lógica. */
import { gatewayFetch } from "../src/adi/llm/gatewayFetch.js";

export default async function handler(req, res) {
  try {
    const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost").split(",")[0].trim();
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v === undefined) continue;
      headers.set(k, Array.isArray(v) ? v.join(", ") : String(v));
    }
    // Vercel puede haber consumido y parseado el body (req.body); si no, se lee el stream crudo.
    let body;
    if (req.body !== undefined) {
      body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    } else {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      body = Buffer.concat(chunks).toString("utf8");
    }
    const request = new Request(`${proto}://${host}${req.url}`, {
      method: req.method,
      headers,
      ...(req.method === "GET" || req.method === "HEAD" ? {} : { body }),
    });
    const response = await gatewayFetch(request);
    res.statusCode = response.status;
    for (const [k, v] of response.headers.entries()) res.setHeader(k, v);
    res.end(await response.text());
  } catch (e) {
    // Nunca un FUNCTION_INVOCATION_FAILED al cliente: el contrato del gateway es JSON {ok:false} y el
    // cliente degrada al piso. El detalle va SOLO al log del server (puede traer el error del proveedor).
    try { console.log(`[adi-narrate-c] ERROR wrapper: ${String(e && e.message).slice(0, 200)}`); } catch { /* sin console */ }
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "gateway no disponible" }));
  }
}
