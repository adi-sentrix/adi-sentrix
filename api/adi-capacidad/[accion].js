/* === api/adi-capacidad/[accion].js · Vercel serverless · LA PUERTA DEL COMPLEMENTO (MCP + OpenAPI) ═════════════
 * Ruta dinámica de Vercel: `/api/adi-capacidad/mcp` (JSON-RPC 2.0, MCP) · `/api/adi-capacidad/conocer-empresa` ·
 * `/api/adi-capacidad/consultar` · `/api/adi-capacidad/aportar-contexto` · `/api/adi-capacidad/retomar` (REST
 * simple, para un GPT con Actions) · `/api/adi-capacidad/openapi.json` (GET, sin bearer: el contrato público).
 * Un solo archivo dinámico en vez de cinco rutas fijas — el patrón de `api/adi-spec.js`: acá solo se ENVUELVE
 * `manejarPuerta(request, env)`, que vive en `src/` y hace todo el trabajo real (identidad, tenant, despacho).
 *
 * Runtime `edge` — CERO `node:*` en toda la cadena de imports de `puerta.js` (verificado, ver su cabecera): igual
 * que `api/adi-data.js`/`api/adi-spec.js`, y la MISMA lección de `adi-edge-vs-node-bundle` (memoria del proyecto):
 * un import de Node colgado acá rompería el build de los otros endpoints edge si algún día compartieran módulo,
 * así que esta puerta NO importa nada de `src/ingesta/handleIngesta.server.js` ni de ningún cliente xlsx.
 *
 * LA PUERTA NO GASTA: no llama a ningún modelo ni al gateway (`src/adi/llm/gatewayCore.js` no aparece en su
 * cadena de imports) — verifica identidad, resuelve el tenant del token y ejecuta una de las cuatro acciones
 * deterministas de `capacidad/acciones.js`. */
import { manejarPuerta } from "../../src/adi/capacidad/puerta.js";

export const config = { runtime: "edge" };

export default function handler(request) {
  return manejarPuerta(request, process.env);
}
