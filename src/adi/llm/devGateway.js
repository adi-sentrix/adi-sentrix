/* === src/adi/llm/devGateway.js · ADI Core · Paso 5 · GATEWAY LLM (dev · plugin de Vite) ===
 * SOLO server-side. Dos pasos, ambos con la key del .env (el browser NUNCA la ve):
 *   · POST /api/adi-spec     · LLM #1 · texto → spec (adapter.parse)
 *   · POST /api/adi-narrate  · LLM #2 · output validado → narración (adapter.narrate)
 * El motor ADI y el number-guard corren en el CLIENTE (answerADIFromSpec + pickNarratedText local). Este gateway solo
 * habla con el proveedor. NO toca el motor sellado. Con ADI_LLM_ENABLED=false el cliente ni lo llama (demo byte-exacta).
 * Reversible: sacar el plugin de vite.config = como si no existiera.
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
      const narrateModel = process.env.LLM_MODEL_NARRATE || model;

      // helper: monta un POST que parsea el body JSON y responde JSON (errores → {ok:false} · el cliente degrada)
      const post = (path, handler) => server.middlewares.use(path, (req, res, next) => {
        if (req.method !== "POST") return next();
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", async () => {
          const send = (obj) => { res.statusCode = 200; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(obj)); };
          try { await handler(JSON.parse(body || "{}"), send); }
          catch (e) { console.log(`[adi-gateway] ERROR ${path}: ${String(e && e.message).slice(0, 140)}`); send({ ok: false, error: String(e && e.message) }); }
        });
      });

      // LLM #1 · texto → spec
      post("/api/adi-spec", async ({ text }, send) => {
        if (!text || typeof text !== "string") return send({ ok: false, error: "sin texto" });
        const { spec, usage } = await getAdapter(provider).parse(text, { system: buildContractMenu(), tool: buildSpecTool(), model });
        console.log(`[adi-gateway] spec  "${text.slice(0, 40)}" -> ${spec.operation}/${spec.metric}@${spec.dimension}`);
        send({ ok: true, spec, usage });
      });

      // LLM #2 · output validado → narración (el number-guard corre en el CLIENTE · si falla → texto determinístico)
      post("/api/adi-narrate", async ({ text, evidence }, send) => {
        if (!text || typeof text !== "string") return send({ ok: false, error: "sin texto" });
        const { text: narration, usage } = await getAdapter(provider).narrate({ text, evidence }, { model: narrateModel });
        console.log(`[adi-gateway] narra "${text.slice(0, 34)}" -> "${String(narration).slice(0, 40)}..."`);
        send({ ok: true, narration, usage });
      });

      console.log(`[adi-gateway] montado · /api/adi-spec + /api/adi-narrate · provider=${provider} · parse=${model} · narrate=${narrateModel} (key del .env · server-side)`);
    },
  };
}
