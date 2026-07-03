/* === src/adi/llm/devGateway.js · ADI Core · Paso 5 · GATEWAY LLM (dev · plugin de Vite) ===
 * SOLO server-side. Traduce texto → spec con el adapter (tiene la key del .env · el browser NUNCA la ve).
 * Es el "LLM gateway" del diseño v1: el cliente postea POST /api/adi-spec {text} → responde {spec}. El motor ADI
 * corre en el CLIENTE (answerADIFromSpec local). NO toca el motor sellado. Con ADI_LLM_ENABLED=false el cliente ni
 * lo llama (demo byte-exacta). Reversible: sacar el plugin de vite.config = como si no existiera.
 */
import fs from "fs";
import { buildContractMenu } from "./contractMenu.js";
import { buildSpecTool } from "./specTool.js";
import { getAdapter } from "./providerAdapter.js";

// carga el .env local a process.env (server-side) · la key vive acá, jamás en el cliente ni en logs
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
      const provider = process.env.LLM_PROVIDER || "anthropic";
      const model = process.env.LLM_MODEL_PARSE || process.env.OPENAI_MODEL || process.env.ANTHROPIC_MODEL || "gpt-4o-mini";
      server.middlewares.use("/api/adi-spec", (req, res, next) => {
        if (req.method !== "POST") return next();
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", async () => {
          const send = (obj) => { res.statusCode = 200; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(obj)); };
          try {
            const { text } = JSON.parse(body || "{}");
            if (!text || typeof text !== "string") return send({ ok: false, error: "sin texto" });
            const adapter = getAdapter(provider);
            const { spec, usage } = await adapter.parse(text, { system: buildContractMenu(), tool: buildSpecTool(), model });
            console.log(`[adi-gateway] "${text.slice(0, 48)}" -> ${spec.operation}/${spec.metric}@${spec.dimension} (${provider}/${model})`);
            send({ ok: true, spec, usage });
          } catch (e) {
            console.log(`[adi-gateway] ERROR: ${String(e && e.message).slice(0, 140)}`);
            send({ ok: false, error: String(e && e.message) });
          }
        });
      });
      console.log(`[adi-gateway] montado en POST /api/adi-spec · provider=${provider} · model=${model} (key del .env · server-side)`);
    },
  };
}
