/* === scripts/medicion-anfitrion/mcp-puerta.mjs · LA PUERTA DEL COMPLEMENTO COMO SERVIDOR MCP (el núcleo, sin transporte) ═
 * Envuelve `manejarPuerta` (`src/adi/capacidad/puerta.js`) —la MISMA puerta de producción, con sus cuatro acciones, su
 * token HMAC y su memoria durable— para que la use un anfitrión de la medición. Solo es TRANSPORTE: no toca `src/`, no
 * agrega herramientas, no cambia una palabra de `MCP_TOOLS` (nombre, descripción y esquema salen tal cual de la puerta;
 * las cabeceras `CABECERA_DE_USO`/`CABECERA_DE_RETOMAR` viajan DENTRO de los resultados, como en producción).
 *
 *   crearPuertaMcp({ almacen, empresaId, bitacora?, rutaEstado? }) →
 *     manejarMensaje(msg)  → respuesta JSON-RPC | null (las notificaciones no responden) · lo que habla el stdio de `mcp-adi.mjs`
 *     llamarHerramienta(nombre, args) → { content, isError, resultado }  · lo que llama el arnés por la vía api (en el mismo proceso)
 *     herramientas()       → MCP_TOOLS tal cual
 *
 * BANDERAS (decisión del owner: encendidas SOLO en el proceso de la puerta, nunca en `.env` ni en producción):
 * ADI_COMPLEMENTO y ADI_MEMORIA_DURABLE las trae el entorno del almacén (`armarEntornoDoble`); acá se agrega ADI_ENTREGA.
 * Cada llamada sale con una IP distinta (el rate limit de la puerta es por IP) — como un anfitrión real con muchos usuarios. */
import { appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { MCP_TOOLS } from "../../src/adi/capacidad/puerta.js";

export const BANDERAS_DE_LA_PUERTA = Object.freeze({ ADI_ENTREGA: "true", ADI_COMPLEMENTO: "true", ADI_MEMORIA_DURABLE: "true" });
export const VERSION_DEL_PROTOCOLO = "2024-11-05";

export function crearPuertaMcp({ almacen, empresaId, bitacora = null, rutaEstado = null, base = "http://puerta.local/mcp" }) {
  if (!almacen || !almacen.manejarPuerta) throw new Error("crearPuertaMcp: falta el almacén (abrirAlmacen)");
  if (!almacen.codigos || !almacen.codigos[empresaId]) throw new Error(`crearPuertaMcp: la empresa «${empresaId}» no está en el almacén`);
  // las banderas viven en el env de ESTA puerta (el objeto que recibe manejarPuerta), no en process.env del anfitrión
  Object.assign(almacen.env, BANDERAS_DE_LA_PUERTA);
  const nombres = new Set(MCP_TOOLS.map((t) => t.name));
  let k = 0, n = 0;

  function _anotar(linea) {
    if (!bitacora) return;
    mkdirSync(dirname(bitacora), { recursive: true });
    appendFileSync(bitacora, JSON.stringify(linea) + "\n");
  }
  function _guardarEstado() { if (rutaEstado) { mkdirSync(dirname(rutaEstado), { recursive: true }); writeFileSync(rutaEstado, almacen.exportar()); } }

  async function _rpc(method, params) {
    k += 1; n += 1;
    const req = new Request(base, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${almacen.codigos[empresaId]}`, "x-real-ip": `10.${(k >> 8) & 255}.${k & 255}.9` },
      body: JSON.stringify({ jsonrpc: "2.0", id: n, method, params }),
    });
    const res = await almacen.manejarPuerta(req, almacen.env, { cliente: almacen.cliente, transporte: almacen.db.transporte });
    if (res.status !== 200) return { error: { code: -32000, message: `la puerta respondió ${res.status}: ${(await res.text()).slice(0, 200)}` } };
    return await res.json();
  }

  async function llamarHerramienta(nombre, args = {}) {
    if (!nombres.has(nombre)) return { content: [{ type: "text", text: JSON.stringify({ ok: false, motivo: `herramienta desconocida: «${nombre}»` }) }], isError: true, resultado: { ok: false, motivo: "herramienta desconocida" } };
    const j = await _rpc("tools/call", { name: nombre, arguments: args || {} });
    let content, isError, resultado;
    if (j.error) { resultado = { ok: false, motivo: j.error.message }; content = [{ type: "text", text: JSON.stringify(resultado) }]; isError = true; }
    else { content = j.result.content; isError = Boolean(j.result.isError); try { resultado = JSON.parse(content[0].text); } catch { resultado = null; } }
    _anotar({ empresaId, herramienta: nombre, args: args || {}, resultado });
    _guardarEstado();
    return { content, isError, resultado };
  }

  async function manejarMensaje(msg) {
    if (!msg || typeof msg !== "object") return null;
    const { id, method, params } = msg;
    const esNotificacion = id === undefined || id === null;
    if (method === "initialize") {
      return { jsonrpc: "2.0", id, result: { protocolVersion: (params && params.protocolVersion) || VERSION_DEL_PROTOCOLO, capabilities: { tools: {} }, serverInfo: { name: "adi", version: "medicion-anfitrion/v1" } } };
    }
    if (esNotificacion) return null;                       // notifications/initialized, notifications/cancelled…
    if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
    if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } };
    if (method === "tools/call") {
      const r = await llamarHerramienta(params && params.name, params && params.arguments);
      return { jsonrpc: "2.0", id, result: { content: r.content, isError: r.isError } };
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `método no soportado: «${method}»` } };
  }

  return { manejarMensaje, llamarHerramienta, herramientas: () => MCP_TOOLS, empresaId, llamadas: () => n };
}
