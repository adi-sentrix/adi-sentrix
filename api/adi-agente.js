/* === api/adi-agente.js · Vercel serverless · ADI AGENTE · una ronda del bucle (F2 · 2026-08-30) ===============
 * Entrypoint de Vercel para POST /api/adi-agente → gatewayFetch (handleAgente). La key vive en el env del
 * server · NUNCA VITE_*. Detrás de la bandera ADI_AGENTE (hoy APAGADA): sin bandera, nadie llama esta ruta.
 *
 * RUNTIME NODE, NO EDGE — por las DOS razones ya pagadas por narrate-c: (1) el modo libre puede tardar lo que
 * tarda una narración rica y el edge exige empezar a responder en 25s; (2) FIRMA CLÁSICA (req, res) porque este
 * runtime invoca con (IncomingMessage, ServerResponse) y `req.url` llega RELATIVA — el adaptador arma el
 * Request web real y vuelca el Response, gatewayFetch queda intacto (mismo wrapper que adi-narrate-c.js, y la
 * lección de `adi-edge-vs-node-bundle`: 3 builds rotos por colgar imports de node en un endpoint edge). */
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
    // Nunca un FUNCTION_INVOCATION_FAILED al cliente: contrato JSON {ok:false} y el cliente cae al camino natural.
    try { console.log(`[adi-agente] ERROR wrapper: ${String(e && e.message).slice(0, 200)}`); } catch { /* sin console */ }
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "gateway no disponible" }));
  }
}
