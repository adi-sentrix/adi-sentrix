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

/* ── LA SUPERFICIE DE ADI · HOY ES LA PIZARRA (owner 2026-08-27) ──────────────────────────────────────────────
 * TRES SUPERFICIES, UN SOLO INTERRUPTOR, y el orden en que aparecieron cuenta la historia:
 *   · sin parámetro → PIZARRA. Gris oscuro y frío. Es lo que ve cualquiera que entre.
 *   · `?papel=1`      → PAPEL. La hoja blanca, que fue LA app entre el 26 y el 27 de agosto.
 *   · `?papel=0`      → TABLERO. El diseño viejo COMPLETO — no sólo el color: vuelve la burbuja de ADI, el
 *                     titular largo y el pulso. Es la vuelta atrás sin tocar una línea.
 *
 * POR QUÉ SE MOVIÓ: «el contraste blanco y negro es un poco pesado para la vista». El salto de la hoja al
 * tablero era de 19,2 a 1 y caía en el medio de la pantalla. En pizarra queda en 1,10 a 1, y los dos lados se
 * separan con un filete de luz en vez de con un tajo. Ver `TEMA_PIZARRA` en theme.js.
 *
 * ⚠️ EL PARÁMETRO SIGUE LLAMÁNDOSE `papel` a propósito, aunque ya no sea la superficie por defecto: es el que
 * está escrito en los gates y el que el owner tiene en el dedo. Renombrarlo no compraba nada y rompía las dos.
 *
 * ⚠️ EL DEFECTO DEL MÓDULO SIGUE SIENDO EL TABLERO, y no es un descuido: `theme.js` se evalúa en tablero, así
 * que todo lo que importe `C` fuera del navegador —los gates, cualquier prueba— sigue viendo la paleta de
 * siempre y el sello que la compara no se mueve. Lo que cambia es qué aplica ESTE archivo al arrancar la app.
 *
 * Se aplica ACÁ, antes de montar React, para que el primer render ya salga con la superficie correcta y no se
 * vea un parpadeo de negro a papel. */
try {
  const _sup = new URLSearchParams(window.location.search).get("papel");
  if (_sup === "1") aplicarTema("papel");
  else if (_sup !== "0") aplicarTema("pizarra");
} catch { /* sin window (SSR o prueba): queda el tablero, que es el defecto del módulo */ }

const root = createRoot(document.getElementById("root"));

// En desarrollo se puede SOLICITAR otra empresa; decide el servidor. En el build de producción esto es `null`.
const _solicitado = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get("tenant")
  : null;

// Se pinta después del intento — con dato si la sesión lo autoriza, o con la forma vacía y la puerta de acceso.
// `.catch` no puede faltar: una promesa rota acá dejaría la pantalla en blanco para siempre.
/* ── ?flujo=demo · ABRIR EL NEGOCIO DE DEMOSTRACIÓN (owner 2026-08-27) ───────────────────────────────────────
 * PARA QUÉ: la cara de Flujo Comercial necesita datos de cobro, y una empresa real que todavía no los cargó ve
 * —correctamente— un recuadro vacío. Para poder decidir el diseño hace falta verla con cifras.
 *
 * ⚠️ POR QUÉ SE PIDE AL SERVIDOR Y NO SE ESCRIBE UN EJEMPLO EN EL CÓDIGO. Era lo primero que uno intenta, y está
 * prohibido con candado: `_bundle_sin_datos_gate` exige que ningún módulo de `src/data/tenants/` sea alcanzable
 * desde este archivo, y además CUENTA los literales del demo que quedan en el bundle y se pone rojo si el número
 * crece. Un ejemplo escrito a mano acá sería exactamente la fuga que ese candado existe para cerrar. El servidor
 * ya sabe entregar el demo por su propia puerta (`op: "demo"`), así que el dato llega por donde corresponde y el
 * navegador no carga nada que no le hayan dado.
 *
 * ⚠️ CAMBIA LA EMPRESA ENTERA, no solo esa cara: las cinco pestañas muestran el negocio de demostración. Es lo
 * honesto —no se puede mezclar el cobro de un negocio con la venta de otro— y por eso la cara lo dice con una
 * banda arriba, sin letra chica. */
const _flujoParam = (() => { try { return new URLSearchParams(window.location.search).get("flujo"); } catch { return null; } })();

cargarTenant(_flujoParam === "demo" ? { op: "demo" } : { tenantSolicitado: _solicitado })
  .catch(() => null)
  .then(() => root.render(<App />));
