/* === src/adi/llm/devGateway.js · ADI Core · Paso 5 · GATEWAY LLM (DEV · plugin de Vite) ===
 * WRAPPER delgado del gateway para el dev-server de Vite. La lógica REAL de los dos pasos (texto→spec · output→narración)
 * vive en gatewayCore.js (platform-neutral · UNA fuente de verdad, compartida con el server de prod y el handler serverless).
 * SOLO server-side · la key del .env (el browser NUNCA la ve). Con ADI_LLM_ENABLED=false el cliente ni lo llama (demo byte-exacta).
 * Reversible: sacar el plugin de vite.config = como si no existiera.
 */
import fs from "fs";
import { handleSpec, handleNarrate } from "./gatewayCore.js";

// carga el .env local a process.env (server-side, SOLO dev) · la key vive acá, jamás en el cliente ni en logs.
// En prod las env vars las setea la plataforma (no hay .env) → el server de prod NO usa esto.
function loadDotenv() {
  try {
    for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
      const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* sin .env · el gateway devuelve error y el cliente cae al piso determinístico */ }
}

export function adiGatewayPlugin() {
  return {
    name: "adi-llm-gateway",
    configureServer(server) {
      loadDotenv();

      // monta un POST que parsea el body JSON, llama al handler compartido (gatewayCore) y responde JSON.
      const mount = (path, handler) => server.middlewares.use(path, (req, res, next) => {
        if (req.method !== "POST") return next();
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", async () => {
          const send = (obj) => { res.statusCode = 200; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(obj)); };
          try { send(await handler(JSON.parse(body || "{}"))); }
          catch (e) { console.log(`[adi-gateway] ERROR ${path}: ${String(e && e.message).slice(0, 140)}`); send({ ok: false, error: String(e && e.message) }); }
        });
      });

      mount("/api/adi-spec", handleSpec);       // LLM #1 · texto → spec
      mount("/api/adi-narrate", handleNarrate); // LLM #2 · output validado → narración

      const provider = process.env.LLM_PROVIDER || "anthropic";
      console.log(`[adi-gateway dev] montado · /api/adi-spec + /api/adi-narrate · provider=${provider} (key del .env · server-side · lógica en gatewayCore)`);
    },
  };
}
