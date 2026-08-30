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

/* === src/main.jsx · entry de la app (Fase 6 · Vite) ===
/* ── LA SUPERFICIE DE ADI · UNA SOLA, Y ES LA PIZARRA (owner 2026-08-27) ─────────────────────────────────────
 * «La UX ya está definida y aprobada. Deja de tratar los interruptores como exploración. Consolidar la
 * experiencia elegida como comportamiento normal de la app.»
 *
 * ACÁ VIVÍAN TRES SUPERFICIES detrás de `?papel`: la pizarra sin parámetro, la hoja blanca con `=1` y el
 * diseño viejo COMPLETO con `=0` —con su burbuja, su titular largo y su pulso—. Tenía sentido mientras se
 * decidía: era la promesa de que nada se movía hasta que el owner mirara. Ya miró y ya eligió, así que las
 * otras dos dejaron de ser una red de seguridad para pasar a ser dos productos dormidos que había que
 * mantener vivos en la cabeza de cualquiera que tocara el chat.
 *
 * ⚠️ LO QUE NO SE FUE ES EL TABLERO, y la distinción importa: sigue entero como `T`, la paleta de TODO LO
 * QUE MIDE —Sentrix, los gráficos, los semáforos, los sellos—. Eso nunca fue una variante, es la mitad del
 * diseño: «a la izquierda se conversa, a la derecha se mide». Lo que se retiró es el tablero como SUPERFICIE
 * DE CONVERSACIÓN, que es otra cosa.
 *
 * Se aplica ACÁ, antes de montar React, para que el primer render ya salga con su superficie y no se vea un
 * parpadeo. */
try { aplicarTema("pizarra"); } catch { /* sin window (SSR o prueba): queda el defecto del módulo */ }

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
