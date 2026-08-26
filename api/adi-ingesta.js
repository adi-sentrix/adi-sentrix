/* === api/adi-ingesta.js · Vercel serverless · EL ARCHIVO QUE SUBE EL USUARIO (v1.4 · 2026-08-26) =============
 * POST /api/adi-ingesta → handleIngesta. Lee un .xlsx en base64, lo valida, arma el dataset y lo devuelve junto
 * con la preview y las alarmas de plausibilidad. NO activa nada: eso lo decide la pantalla, tras confirmar.
 *
 * ⚠️ RUNTIME NODE, NO EDGE: leer un .xlsx exige descomprimir con `node:zlib`, y el edge no lo tiene. Tampoco el
 * navegador — por eso el archivo se procesa acá y no en el cliente.
 *
 * ⚠️ LLAMA AL HANDLER DIRECTO, SIN PASAR POR `gatewayFetch`, y esto NO es un atajo: es la corrección de un
 * defecto que costó tres builds rotos y dejó producción en la versión anterior (2026-08-26). Montar esta ruta en
 * el router compartido hacía que los CINCO endpoints edge del repo —que importan ese archivo— arrastraran
 * `node:zlib`, y Vercel no puede empaquetar eso para el edge. El build fallaba entero mientras los 177 gates
 * seguían verdes, porque ningún gate empaquetaba para edge. Ahora hay uno (`_edge_bundle_gate`).
 * Este endpoint es node puro y no necesita router: una sola ruta, un solo handler.
 *
 * NO GASTA. Todo el camino es determinístico: cero llamadas al modelo.
 * FIRMA CLÁSICA (req, res): el runtime node invoca con (IncomingMessage, ServerResponse). */
import { handleIngesta } from "../src/ingesta/handleIngesta.server.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ ok: false, motivo: "usá POST" }));
    }
    // Vercel puede haber parseado el body (req.body); si no, se lee el stream crudo.
    let body;
    if (req.body !== undefined) {
      body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    } else {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    }
    const out = await handleIngesta(body || {});
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store, max-age=0");
    res.end(JSON.stringify(out));
  } catch (e) {
    /* Nunca un FUNCTION_INVOCATION_FAILED al cliente: la pantalla sabe leer {ok:false, motivo} y lo muestra
     * como un rechazo con explicación. El detalle va SOLO al log del server. */
    try { console.log(`[adi-ingesta] ERROR: ${String(e && e.message).slice(0, 200)}`); } catch { /* sin console */ }
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, motivo: "no se pudo procesar el archivo" }));
  }
}
