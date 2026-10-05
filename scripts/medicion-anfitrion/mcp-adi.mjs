/* === scripts/medicion-anfitrion/mcp-adi.mjs · LA PUERTA DE LAS CUATRO ACCIONES, COMO SERVIDOR MCP POR STDIO ═══════
 * Lo lanza el anfitrión (`claude -p --mcp-config …`) como proceso hijo y habla JSON-RPC por líneas (el transporte stdio de
 * MCP). Carga el estado del almacén AISLADO (doble en memoria) desde un archivo, atiende `initialize` · `tools/list` ·
 * `tools/call` con `manejarPuerta`, y después de CADA llamada exporta el estado (el corte de la sesión lo recoge de ahí) y
 * anota la bitácora (el rastreo determinista lee de ahí las Entregas EXACTAS que vio el anfitrión).
 *
 *   node scripts/medicion-anfitrion/mcp-adi.mjs --estado=<f> --empresa=<id> --salida-estado=<f> --bitacora=<f.jsonl>
 *
 * LAS BANDERAS (ADI_ENTREGA · ADI_COMPLEMENTO · ADI_MEMORIA_DURABLE) se encienden SOLO en este proceso (más abajo). Cero
 * red: el almacén es el doble en memoria; no hay variable real de Supabase ni de proveedor en este proceso. */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { abrirAlmacen } from "./almacen-medicion.mjs";
import { crearPuertaMcp, BANDERAS_DE_LA_PUERTA } from "./mcp-puerta.mjs";

for (const [k, v] of Object.entries(BANDERAS_DE_LA_PUERTA)) process.env[k] = v;      // SOLO en este proceso

const _arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const ESTADO = _arg("estado"), EMPRESA = _arg("empresa"), SALIDA_ESTADO = _arg("salida-estado"), BITACORA = _arg("bitacora");
if (!ESTADO || !EMPRESA) { console.error("mcp-adi: faltan --estado y --empresa"); process.exit(2); }

const almacen = await abrirAlmacen({ estadoJson: readFileSync(ESTADO, "utf8") });
const puerta = crearPuertaMcp({ almacen, empresaId: EMPRESA, bitacora: BITACORA, rutaEstado: SALIDA_ESTADO });

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
let cola = Promise.resolve();                     // las líneas se atienden EN ORDEN (una llamada no pisa a la anterior)
rl.on("line", (linea) => {
  if (!linea.trim()) return;
  cola = cola.then(async () => {
    let msg;
    try { msg = JSON.parse(linea); } catch { process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido" } }) + "\n"); return; }
    try {
      const r = await puerta.manejarMensaje(msg);
      if (r) process.stdout.write(JSON.stringify(r) + "\n");
    } catch (e) {
      console.error(`mcp-adi: ${String(e && e.message).slice(0, 200)}`);
      if (msg && msg.id != null) process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: "error interno de la puerta" } }) + "\n");
    }
  });
});
rl.on("close", () => { cola.then(() => process.exit(0)); });
