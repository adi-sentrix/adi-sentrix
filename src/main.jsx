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

/* ── «PAPEL Y TABLERO» · detrás de un interruptor (owner 2026-08-26) ──────────────────────────────────────────
 * El rediseño entero vive detrás de `?papel=1`, el mismo patrón que `?historial=1` y `?barra=…`. Sin el
 * parámetro la app queda EXACTAMENTE como está hoy: el tema arranca en tablero y ningún token cambia — hay un
 * gate que lo comprueba comparando la paleta contra la versión anterior, token por token.
 * Se aplica ACÁ, antes de montar React, para que el primer render ya salga con la superficie correcta y no se
 * vea un parpadeo de negro a papel. */
try {
  if (new URLSearchParams(window.location.search).get("papel") === "1") aplicarTema("papel");
} catch { /* sin window (SSR o prueba): queda el tablero, que es el estado por defecto */ }

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
