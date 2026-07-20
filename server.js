/* === server.js · SERVER de PRODUCCIÓN mínimo · sirve el build (dist/) + el gateway LLM ===
 * DEPLOY-READY sin plataforma: `npm run build && npm start` corre ADI en cualquier host Node 18+ (Render/Railway/Fly/VPS/Docker).
 * La key vive en el env del SERVER (LLM_PROVIDER, LLM_MODEL_*, OPENAI_API_KEY/ANTHROPIC_API_KEY) · JAMÁS en el bundle.
 * Reusa el MISMO handler web-estándar que usarían Vercel/Netlify/Cloudflare (gatewayFetch) → una sola lógica. NO toca el motor.
 * Cero dependencias (node:http nativo). Ver DEPLOY.md para envolverlo en funciones serverless.
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { gatewayFetch } from "./src/adi/llm/gatewayFetch.js";

const PORT = process.env.PORT || 8080;
const DIST = path.resolve("dist");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png",
  ".jpg": "image/jpeg", ".woff2": "font/woff2", ".woff": "font/woff", ".map": "application/json",
};

// Headers de seguridad · paridad con vercel.json (Vercel los sirve allá; esto cubre el self-host de DEPLOY.md).
// El CSP está tuneado contra el build real: script-src 'self' (un solo módulo, sin inline ni eval) · style-src
// 'unsafe-inline' + Google Fonts (estilos inline de React + @import) · connect-src 'self' (los /api/* son same-origin).
const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);   // en TODA respuesta (api · estático · 403/404/500)
  try {
    // ── API · el gateway LLM (envolvemos el req de node en un Request web-estándar) ──
    if (req.url.startsWith("/api/")) {
      let body = ""; for await (const c of req) body += c;
      const request = new Request("http://local" + req.url, {
        method: req.method,
        headers: { "content-type": req.headers["content-type"] || "application/json" },
        body: (req.method === "POST" && body) ? body : undefined,
      });
      const resp = await gatewayFetch(request, process.env);
      res.statusCode = resp.status;
      res.setHeader("content-type", resp.headers.get("content-type") || "application/json");
      res.end(await resp.text());
      return;
    }
    // ── estático (SPA) · sirve el archivo pedido · fallback a index.html ──
    let rel = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = path.join(DIST, rel);
    if (!file.startsWith(DIST)) { res.statusCode = 403; res.end("forbidden"); return; }   // anti path-traversal
    if (rel === "/" || !path.extname(rel) || !existsSync(file)) file = path.join(DIST, "index.html");
    if (!existsSync(file)) { res.statusCode = 404; res.end("build no encontrado · corré `npm run build` primero"); return; }
    const data = await readFile(file);
    res.setHeader("content-type", MIME[path.extname(file)] || "application/octet-stream");
    res.end(data);
  } catch (e) {
    res.statusCode = 500; res.end("error interno");
    console.log(`[adi-server] ERROR ${req.url}: ${String(e && e.message).slice(0, 160)}`);
  }
});

server.listen(PORT, () => console.log(`ADI en http://localhost:${PORT} · gateway /api/adi-spec + /api/adi-narrate · key del env (server-side · provider=${process.env.LLM_PROVIDER || "anthropic"})`));
