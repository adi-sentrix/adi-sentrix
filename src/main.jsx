/* === src/main.jsx · entry de la app (Fase 6 · Vite) ===
 * Monta <App/> (ADISentric shell). No toca motor ni shell · solo bootstrap de React.
 *
 * VÍA 1 (2026-08-20) · ACÁ ESTABA LA MITAD DE LA FUGA. Este archivo importaba `TENANTS` —el registro COMPLETO de
 * empresas— para poder activar `?tenant=empresa2` en desarrollo. El import vivía dentro de un `if (import.meta.env.DEV)`
 * y por eso parecía inofensivo, pero se construyó el bundle de producción y las FILAS de la segunda empresa estaban
 * adentro igual (`NevadaFoods`, 9 veces, con ventas y márgenes): el tree-shaking se llevó el objeto de cabecera, no
 * el dato. Ya no se importa ningún tenant acá.
 *
 * AHORA: se PIDE el dato antes de montar. `cargarTenant()` llama a `/api/adi-data`, el servidor resuelve la empresa
 * desde la sesión firmada, y recién entonces se pinta. Si no hay dato (sin sesión, sesión vencida, servidor caído)
 * se monta igual: `App` ya sabe mostrar la puerta de acceso, y lo hace sobre la forma vacía — nunca sobre el dato
 * de otra empresa. `?tenant=` sigue existiendo en desarrollo, pero pasó a ser una SOLICITUD: la honra el servidor
 * solo con ADI_DEV_TENANT_SWITCH=true, y en producción no hace nada.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App.jsx";
import { cargarTenant } from "./data/tenantClient.js";
import { aplicarTema } from "./ui/theme.js";

/* ── «PAPEL Y TABLERO» · ENCENDIDO POR DEFECTO (owner 2026-08-26) ─────────────────────────────────────────────
 * Nació apagado, detrás de `?papel=1`, mientras se decidía. El owner lo vio y lo encendió: «subeloooo». Desde
 * ahora el papel es LA app y el tablero queda detrás de `?papel=0`, que es la vuelta atrás sin tocar una línea
 * — la misma que valía antes, dada vuelta.
 *
 * ⚠️ EL DEFECTO DEL MÓDULO SIGUE SIENDO EL TABLERO, y no es un descuido: `theme.js` se evalúa en tablero, así
 * que todo lo que importe `C` fuera del navegador —los gates, cualquier prueba— sigue viendo la paleta de
 * siempre y el sello que la compara no se mueve. Lo que cambia es qué aplica ESTE archivo al arrancar la app.
 *
 * Se aplica ACÁ, antes de montar React, para que el primer render ya salga con la superficie correcta y no se
 * vea un parpadeo de negro a papel. */
try {
  if (new URLSearchParams(window.location.search).get("papel") !== "0") aplicarTema("papel");
} catch { /* sin window (SSR o prueba): queda el tablero, que es el defecto del módulo */ }

const root = createRoot(document.getElementById("root"));

// En desarrollo se puede SOLICITAR otra empresa; decide el servidor. En el build de producción esto es `null`.
const _solicitado = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get("tenant")
  : null;

// Se pinta después del intento — con dato si la sesión lo autoriza, o con la forma vacía y la puerta de acceso.
// `.catch` no puede faltar: una promesa rota acá dejaría la pantalla en blanco para siempre.
cargarTenant({ tenantSolicitado: _solicitado })
  .catch(() => null)
  .then(() => root.render(<App />));
