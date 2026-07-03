import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { adiGatewayPlugin } from "./src/adi/llm/devGateway.js";   // Paso 5 · gateway LLM dev (server-side · key del .env)

// Vite mínimo · monta ADISentric (App.jsx) · cero cambio de motor o shell.
// + gateway LLM (Paso 5): endpoint POST /api/adi-spec · SOLO activo cuando el cliente lo llama (ADI_LLM_ENABLED ON).
export default defineConfig({
  plugins: [react(), adiGatewayPlugin()],
  server: { port: 5173, host: true, open: false },
});
