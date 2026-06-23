import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite mínimo · monta ADISentric (App.jsx) · cero cambio de motor o shell.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true, open: false },
});
