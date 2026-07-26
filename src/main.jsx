/* === src/main.jsx · entry de la app (Fase 6 · Vite) ===
 * Monta <App/> (ADISentric shell). No toca motor ni shell · solo bootstrap de React.
 * F1 multiempresa (2026-07-26): en DEV, ?tenant=empresa2 activa un tenant del registro ANTES de montar la app
 * (validación multiempresa en browser). En build de prod este bloque no existe (import.meta.env.DEV). */
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App.jsx";
import { initTenant } from "./data/tenantStore.js";
import { TENANTS } from "./data/tenants/index.js";

if (import.meta.env.DEV) {
  const t = new URLSearchParams(window.location.search).get("tenant");
  if (t && TENANTS[t]) initTenant(TENANTS[t]);
}

createRoot(document.getElementById("root")).render(<App />);
