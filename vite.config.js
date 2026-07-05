import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { adiGatewayPlugin } from "./src/adi/llm/devGateway.js";   // Paso 5 · gateway LLM dev (server-side · key del .env)

// Vite mínimo · monta ADISentric (App.jsx) · cero cambio de motor o shell.
// + gateway LLM (Paso 5): endpoint POST /api/adi-spec · SOLO activo cuando el cliente lo llama (ADI_LLM_ENABLED ON).
export default defineConfig(({ mode }) => {
  // Modo LLM del cliente DESDE EL ENTORNO (build-time) · VITE_ADI_LLM_ENABLED / VITE_ADI_LLM_NARRATE_ENABLED.
  // Booleanos NO secretos (por eso VITE_) · la KEY jamás va acá (vive server-side en OPENAI_API_KEY).
  // Se inyectan como globals __ADI_LLM_*__; voiceFlags.js los lee con guard `typeof` → en Node (gates) cae al piso demo.
  const env = loadEnv(mode, process.cwd(), "");            // "" = toma VITE_* de .env y de process.env (Vercel)
  const llmEnabled = env.VITE_ADI_LLM_ENABLED === "true";           // default false si no existe la env var
  const llmNarrate = env.VITE_ADI_LLM_NARRATE_ENABLED !== "false";  // default true salvo "false" explícito
  // Perfil de ejecución (build-time · floor/demo/prod/dev) → global __ADI_PROFILE__ que lee flagProfile.js.
  // Default: `dev` en dev-server (npm run dev) · `floor` en build sin VITE_ADI_PROFILE (seguro: sin features). Ortogonal al LLM.
  const profile = env.VITE_ADI_PROFILE || (mode === "development" ? "dev" : "floor");
  return {
    plugins: [react(), adiGatewayPlugin()],
    define: {
      __ADI_LLM_ENABLED__: JSON.stringify(llmEnabled),
      __ADI_LLM_NARRATE_ENABLED__: JSON.stringify(llmNarrate),
      __ADI_PROFILE__: JSON.stringify(profile),
    },
    server: { port: 5173, host: true, open: false },
  };
});
