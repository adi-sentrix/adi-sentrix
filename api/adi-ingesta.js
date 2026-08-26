/* === api/adi-ingesta.js · Vercel serverless · EL ARCHIVO QUE SUBE EL USUARIO (v1.4 · 2026-08-25) ===
 * Entrypoint de POST /api/adi-ingesta → gatewayFetch (handleIngesta). Lee un .xlsx en base64, lo valida, arma
 * el dataset y lo devuelve junto con la preview y las alarmas de plausibilidad. NO activa nada: eso lo decide
 * la pantalla, después de que el usuario confirme.
 *
 * ⚠️ RUNTIME NODE, NO EDGE, y esta vez no es por tiempo sino por capacidad: leer un .xlsx exige descomprimir con
 * node:zlib, y el edge no lo tiene. Tampoco lo tiene el navegador — por eso el archivo se procesa acá.
 *
 * NO GASTA. Todo el camino es determinístico: cero llamadas al modelo.
 * FIRMA CLÁSICA (req, res), NO web · mismo adaptador que adi-narrate-c: el runtime node invoca con
 * (IncomingMessage, ServerResponse) y req.url llega RELATIVA, así que se arma el Request web real acá y
 * gatewayFetch queda intacto como único dueño de la lógica. */
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
    try { console.log(`[adi-ingesta] ERROR wrapper: ${String(e && e.message).slice(0, 200)}`); } catch { /* sin console */ }
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "gateway no disponible" }));
  }
}
