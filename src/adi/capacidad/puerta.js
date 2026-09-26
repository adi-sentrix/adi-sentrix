/* === src/adi/capacidad/puerta.js · LA PUERTA DEL COMPLEMENTO — MCP + OpenAPI (Etapa 3, corte 8, owner 2026-09-25)
 * `_ADI_DISENO_FLUJO_V2.md` §E + el encargo de esta pieza: un servidor MCP por HTTP (JSON-RPC: `initialize` ·
 * `tools/list` · `tools/call`) y un OpenAPI equivalente para GPT Actions, LOS DOS sobre las mismas cuatro
 * acciones (`capacidad/acciones.js`) y el MISMO pase HMAC que ya existe (`llm/accessToken.js`).
 *
 * IDENTIDAD (leyes del owner, textuales):
 *   · «el tenant sale del token, nunca de un argumento» — este archivo verifica el bearer, resuelve el tenant CON
 *     `tenantService.server.js:handleData` (la misma pieza que ya usa `/api/adi-data`) y ese es el ÚNICO tenant
 *     que las acciones ven. Si la llamada trae un campo `tenant`/`tenantId`/`empresa` en sus argumentos, JAMÁS se
 *     lee para resolver — se declara ignorado en la respuesta (`advertencias`).
 *   · sin token o con token inválido → rechazo (401), antes de tocar la bandera o el cuerpo del pedido.
 *   · rate limit con el patrón existente (`llm/gatewayFetch.js:_mintLimited` — ventana + techo por IP, más un
 *     techo global de isolate; ver `_limitado` abajo, la MISMA forma, aplicada a TODA llamada de la puerta y no
 *     solo a `op:mint`).
 *
 * LA PUERTA NO LLAMA A NINGÚN MODELO (ley del owner: «cero gasto por diseño»): no importa `gatewayCore.js` ni
 * ningún adapter de proveedor — la comprensión del lenguaje ya la hizo el LLM ANFITRIÓN antes de llamar acá; esta
 * pieza solo verifica identidad, resuelve el tenant y ejecuta una de las cuatro acciones deterministas.
 *
 * RUNTIME: sin `node:*` en la cadena de imports (verificado — `acciones.js`/`catalogo.js`/`tenantService.server.js`
 * y todo lo que importan, cero `node:` transitivo), así que esta puerta corre en `edge` como el resto del
 * gateway (`api/adi-data.js`, `api/adi-spec.js`) — el envoltorio de `api/` lo declara.
 *
 * DOS TRANSPORTES, UN SOLO DESPACHO (`_despachar`, más abajo):
 *   1. JSON-RPC 2.0 (MCP) — el cuerpo trae `jsonrpc`. `tools/call` despacha por `params.name`.
 *   2. REST simple para GPT Actions (el OpenAPI de `construirOpenApi`) — un POST por acción, cuerpo = los
 *      argumentos de la acción tal cual (sin sobre JSON-RPC), en la ruta `/api/adi-capacidad/<accion-en-kebab>`.
 *   `GET /api/adi-capacidad/openapi.json` sirve el documento OpenAPI — sin bearer: es el contrato público que un
 *   GPT necesita LEER antes de poder llamar con su token; ninguna acción real corre sin bearer, esto solo
 *   describe la forma. */
import { crearAcciones } from "./acciones.js";
import { crearAlmacenEnMemoria } from "../continuidad/almacen.js";
import { handleData } from "../../data/tenantService.server.js";
import { verifyAccessCode } from "../llm/accessToken.js";

const _json = (obj, status = 200, extraHeaders = null) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...(extraHeaders || {}) } });

/* ── LA CONTINUIDAD, COMPARTIDA POR PROCESO (corte 9, owner 2026-09-26) — el MISMO patrón que el rate limit de
 * más abajo (`_golpesPorIp`/`_golpesGlobal`, módulo-level): una instancia por isolate, no una por request — si
 * cada llamada creara su propio almacén, `aportarContexto`/`retomar` jamás encontrarían la conversación de la
 * llamada anterior dentro del MISMO proceso (best-effort por instancia, la misma advertencia que ya deja escrita
 * el rate limit: no es una persistencia durable — eso es `crearAlmacenSupabase`, el día que la migración 015 se
 * aplique). `crearAcciones` recibe este almacén siempre, nunca uno nuevo por pedido. */
const _almacenDelProceso = crearAlmacenEnMemoria();
const _acciones = crearAcciones({ continuidad: _almacenDelProceso });

/* ── LA BANDERA (apagada por defecto) ────────────────────────────────────────────────────────────────────────── */
const _flagEncendida = (env) => String((env && env.ADI_COMPLEMENTO) || "").trim() === "true";

/* ── RATE LIMIT — MISMO PATRÓN que `gatewayFetch.js:_mintLimited` (auditoría 2026-07-14), aplicado a TODA llamada
 * de esta puerta (no solo a una operación puntual): ventana de 10 minutos, techo por IP y techo global del
 * isolate. BEST-EFFORT POR INSTANCIA, no control durable — la misma advertencia que ya deja escrita ese archivo. */
const _VENTANA_MS = 10 * 60 * 1000;
const _TOPE_POR_IP = 30;      // una sesión real hace pocas llamadas por turno; 30/10min es holgado para uso legítimo
const _TOPE_GLOBAL = 300;
const _golpesPorIp = new Map();
let _golpesGlobal = [];
function _limitado(clave, now = Date.now()) {
  const corte = now - _VENTANA_MS;
  _golpesGlobal = _golpesGlobal.filter((t) => t > corte);
  const mios = (_golpesPorIp.get(clave) || []).filter((t) => t > corte);
  if (mios.length >= _TOPE_POR_IP || _golpesGlobal.length >= _TOPE_GLOBAL) { _golpesPorIp.set(clave, mios); return true; }
  mios.push(now);
  _golpesPorIp.set(clave, mios);
  _golpesGlobal.push(now);
  if (_golpesPorIp.size > 500) for (const [k, v] of _golpesPorIp) if (!v.some((t) => t > corte)) _golpesPorIp.delete(k);
  return false;
}
/* clave del limitador: IP confiable si el runtime la expone (`x-real-ip`, la misma que usa `gatewayFetch.js` vía
 * `@vercel/functions:ipAddress`); si no hay IP (gate, dev), se cae al propio código de acceso — nunca a una clave
 * compartida "sin-ip" que castigaría a todo el mundo por igual. */
function _claveDeLimite(request, code) {
  try {
    const xri = request.headers.get("x-real-ip");
    if (xri) return `ip:${xri}`;
  } catch { /* headers no disponibles (gate con objeto plano) */ }
  return `token:${String(code || "").slice(0, 24)}`;
}

/* ── IDENTIDAD ────────────────────────────────────────────────────────────────────────────────────────────────── */
function _bearerDe(request) {
  const h = (typeof request.headers?.get === "function") ? request.headers.get("authorization") : null;
  const m = /^Bearer\s+(.+)$/i.exec(String(h || "").trim());
  return m ? m[1].trim() : null;
}

/** resolverTenantDesdeElToken(code, env) → { ok:true, tenant:{id,nombre,dataset,version,sello} } | { ok:false, motivo }
 *  Reusa `tenantService.server.js:handleData` — LA MISMA función que ya usa `/api/adi-data` para servir el pack de
 *  una sesión firmada — así que la puerta y la app hablan la misma verdad sobre "de qué empresa es esta sesión". */
async function resolverTenantDesdeElToken(code, env) {
  if (!code) return { ok: false, motivo: "sin sesión: falta el bearer" };
  const r = await handleData({ access: code, tenantSolicitado: null }, env);
  if (!r.ok) return { ok: false, motivo: r.motivo || "sesión inválida o vencida" };
  if (!r.dataset) {
    return { ok: false, motivo: r.sinDatos ? "esta empresa todavía no cargó datos" : "sin dato activo para esta sesión" };
  }
  return { ok: true, tenant: { id: r.tenantId, nombre: r.nombre || null, dataset: r.dataset, version: r.version || null, sello: r.sello || null } };
}

/* ── LOS CUATRO ARGUMENTOS QUE NUNCA SE LEEN PARA RESOLVER TENANT (se ignoran y se declaran) ────────────────────
 * Un LLM puede, por su cuenta, agregar `tenant`/`tenantId`/`empresa`/`company` al cuerpo de una llamada (lo vio en
 * otra API, o lo infiere del contexto). Acá se DETECTA y se declara — nunca se usa. */
const _CLAVES_TENANT_A_IGNORAR = ["tenant", "tenantId", "empresa", "company", "org", "organizacion"];
function _declararTenantIgnorado(args) {
  if (!args || typeof args !== "object") return { limpio: args, ignorado: [] };
  const ignorado = _CLAVES_TENANT_A_IGNORAR.filter((k) => Object.prototype.hasOwnProperty.call(args, k));
  if (!ignorado.length) return { limpio: args, ignorado: [] };
  const limpio = { ...args };
  for (const k of ignorado) delete limpio[k];
  return { limpio, ignorado };
}

/* ── LAS CUATRO HERRAMIENTAS — nombre, descripción y esquema JSON. El vocabulario es de NEGOCIO (temas, encargo,
 * conversación), nunca de mecanismo interno (ningún nombre de tool del Core, ningún "fig", ningún "boleta"). ── */
export const MCP_TOOLS = [
  {
    name: "conocerEmpresa",
    description: "ADI es el asesor de negocio de esta empresa: conoce sus datos, verifica cada cifra y responde cualquier consulta soportada por lo que calcula. Llame esta herramienta PRIMERO en la conversación para conocer la empresa activa (su perfil, el período de sus datos, la moneda) y el catálogo completo de lo que ADI puede calcular hoy — temas, conceptos, ejes, cierres soportados, lo que NO calcula (con el motivo) y los criterios de prioridad disponibles.",
    inputSchema: {
      type: "object",
      properties: { conversacionId: { type: ["string", "null"], description: "Si ya existe una conversación con ADI, su id (para recuperar lo ya aportado). Omítalo para empezar de cero." } },
      additionalProperties: false,
    },
  },
  {
    name: "consultar",
    description: "Responde CUALQUIER encargo soportado por el catálogo (ver conocerEmpresa): una cifra, una lectura del negocio, una decisión priorizada, una comparación entre dos entidades del mismo eje, una simulación con un supuesto declarado, o la definición de un concepto. El encargo es un objeto tipado (Encargo v1) — nunca una pregunta en texto libre: usted ya interpretó lo que el usuario pidió; esta herramienta calcula y verifica, no interpreta.",
    inputSchema: {
      type: "object",
      properties: {
        encargo: {
          type: "object",
          description: "Encargo v1 (ver _ADI_CONTRATO_ENCARGO_V1.md): { version:'encargo/v1', partes:[{id,tema,cierre,conceptos?,entidades?,eje?,universo?,periodo?,concepto?,supuestos?}], criterio?, supuestos?, premisas?, usar?, profundidad?, conversacionId? }.",
          properties: { version: { type: "string", const: "encargo/v1" }, partes: { type: "array", minItems: 1 } },
          required: ["version", "partes"],
        },
      },
      required: ["encargo"],
      additionalProperties: false,
    },
  },
  {
    name: "aportarContexto",
    description: "Registra lo que el usuario declaró por su cuenta — su perfil (sector, tipo de producto, país, modelo comercial), un criterio propio, un hecho de negocio, o un dato extraído de un documento que el usuario compartió. NUNCA se usa para cifras que ADI ya calcula: eso se pide con consultar. Un aporte que choca con un dato medido queda declarado, no reemplaza lo medido.",
    inputSchema: {
      type: "object",
      properties: {
        conversacionId: { type: ["string", "null"] },
        aportes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              clase: { type: "string", enum: ["perfil", "criterio", "hecho", "documento"] },
              concepto: { type: "string", description: "Qué se está declarando (ej. 'sector', 'benchmark propio', el nombre del hecho)." },
              entidad: { type: ["string", "null"] },
              periodo: { type: ["string", "null"] },
              valor: {},
              unidad: { type: ["string", "null"] },
              documento: { type: ["object", "null"], description: "Solo clase 'documento': {nombre, tipo, fecha?, parte}." },
              parte: { type: ["string", "null"], description: "La cita corta dentro del documento (ej. 'cláusula 4 / p. 3'), nunca el documento entero." },
            },
            required: ["clase", "concepto", "valor"],
          },
          default: [],
        },
        confirmar: { type: "array", items: { type: "string" }, description: "Ids de aportes previos (pendientes) que el usuario acaba de confirmar.", default: [] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "retomar",
    description: "Recupera el estado de una conversación anterior con ADI por su conversacionId: lo ya aportado y el estado vigente. Úsela cuando el usuario retoma un hilo previo.",
    inputSchema: {
      type: "object",
      properties: { conversacionId: { type: "string" } },
      required: ["conversacionId"],
      additionalProperties: false,
    },
  },
];

const _NOMBRES_DE_HERRAMIENTA = new Set(MCP_TOOLS.map((t) => t.name));

/* ── EL DESPACHO — un solo lugar, para los dos transportes ───────────────────────────────────────────────────── */
async function _despachar(nombreAccion, argsCrudos, { tenant, acciones }) {
  if (!_NOMBRES_DE_HERRAMIENTA.has(nombreAccion)) {
    return { ok: false, motivo: `acción desconocida: "${nombreAccion}"`, disponibles: [..._NOMBRES_DE_HERRAMIENTA] };
  }
  const { limpio, ignorado } = _declararTenantIgnorado(argsCrudos || {});
  const advertencias = ignorado.length ? [`se ignoró el/los argumento(s) ${ignorado.join(", ")}: el tenant de esta sesión sale del token, nunca de la llamada.`] : [];

  let salida;
  if (nombreAccion === "conocerEmpresa") salida = acciones.conocerEmpresa({ tenant, conversacionId: limpio.conversacionId ?? null });
  else if (nombreAccion === "consultar") salida = acciones.consultar({ tenant, encargo: limpio.encargo });
  else if (nombreAccion === "aportarContexto") salida = acciones.aportarContexto({ tenant, conversacionId: limpio.conversacionId ?? null, aportes: limpio.aportes || [], confirmar: limpio.confirmar || [] });
  else salida = acciones.retomar({ tenant, conversacionId: limpio.conversacionId });

  if (!advertencias.length) return salida;
  return { ...salida, advertencias: [...(salida.advertencias || []), ...advertencias] };
}

/* ── TRANSPORTE 1 · MCP JSON-RPC 2.0 ─────────────────────────────────────────────────────────────────────────── */
function _rpcOk(id, result) { return { jsonrpc: "2.0", id: id ?? null, result }; }
function _rpcError(id, code, message) { return { jsonrpc: "2.0", id: id ?? null, error: { code, message } }; }

async function _manejarJsonRpc(cuerpo, ctx) {
  const { id, method, params } = cuerpo || {};
  if (method === "initialize") {
    return _rpcOk(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "adi-capacidad", version: "capacidad/v1" },
    });
  }
  if (method === "tools/list") {
    return _rpcOk(id, { tools: MCP_TOOLS });
  }
  if (method === "tools/call") {
    const nombre = params && params.name;
    const args = (params && params.arguments) || {};
    if (!_NOMBRES_DE_HERRAMIENTA.has(nombre)) return _rpcError(id, -32602, `herramienta desconocida: "${nombre}"`);
    const salida = await _despachar(nombre, args, ctx);
    return _rpcOk(id, { content: [{ type: "text", text: JSON.stringify(salida) }], isError: salida && salida.ok === false });
  }
  return _rpcError(id, -32601, `método no soportado: "${method}"`);
}

/* ── TRANSPORTE 2 · REST simple para GPT Actions (una acción por ruta, cuerpo = argumentos tal cual) ────────────── */
const _RUTA_A_ACCION = {
  "conocer-empresa": "conocerEmpresa",
  "consultar": "consultar",
  "aportar-contexto": "aportarContexto",
  "retomar": "retomar",
};

/** construirOpenApi(baseUrl) → el documento OpenAPI 3.1, equivalente a `MCP_TOOLS`, para un GPT con Actions. */
export function construirOpenApi(baseUrl = "https://app.adiai.cl") {
  const paths = {};
  for (const tool of MCP_TOOLS) {
    const ruta = Object.entries(_RUTA_A_ACCION).find(([, accion]) => accion === tool.name)[0];
    paths[`/api/adi-capacidad/${ruta}`] = {
      post: {
        operationId: tool.name,
        summary: tool.description.split(".")[0],
        description: tool.description,
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: tool.inputSchema } } },
        responses: {
          200: { description: "Resultado de la acción (siempre 200; el campo \"ok\" declara éxito o rechazo).", content: { "application/json": { schema: { type: "object" } } } },
          401: { description: "Sin sesión válida (bearer ausente o inválido)." },
          429: { description: "Demasiadas llamadas — reintente más tarde." },
        },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "ADI · la capacidad del Complemento",
      version: "capacidad/v1",
      description: "ADI es el asesor de negocio de esta empresa: conoce sus datos, verifica cada cifra y responde cualquier consulta soportada por lo que calcula. Cuatro operaciones — nunca mecanismos internos.",
    },
    servers: [{ url: baseUrl }],
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", description: "El código de acceso de la sesión (el mismo pase de la demo/producto). El tenant sale de ahí, nunca de un campo del cuerpo." } },
    },
  };
}

/* ── EL MANEJADOR ÚNICO ──────────────────────────────────────────────────────────────────────────────────────── */
/** manejarPuerta(request, env) → Response. `request` es un `Request` Web-estándar (Node 18+/edge); `env` trae
 *  `ADI_COMPLEMENTO` y `ADI_TOKEN_SECRET` (inyectable, igual que `handleData(body, env)` — nunca lee
 *  `process.env` directo, así un gate le pasa un env de fixture sin tocar el proceso real). */
export async function manejarPuerta(request, env) {
  if (!_flagEncendida(env)) {
    return _json({ ok: false, disponible: false, motivo: "el Complemento está deshabilitado en este entorno (bandera ADI_COMPLEMENTO apagada)." }, 200);
  }

  let url;
  try { url = new URL(request.url); } catch { url = null; }
  const pathname = (url && url.pathname) || "";

  // `openapi.json` es el contrato PÚBLICO — sin bearer: un GPT lo lee antes de tener sesión.
  if (request.method === "GET" && /\/openapi\.json$/.test(pathname)) {
    const base = url ? `${url.protocol}//${url.host}` : "https://app.adiai.cl";
    return _json(construirOpenApi(base), 200);
  }

  if (request.method !== "POST") return _json({ ok: false, motivo: "usá POST" }, 405);

  const code = _bearerDe(request);
  const clave = _claveDeLimite(request, code);
  if (_limitado(clave)) return _json({ ok: false, motivo: "demasiadas llamadas — espera unos minutos y prueba de nuevo" }, 429, { "retry-after": "600" });

  const resTenant = await resolverTenantDesdeElToken(code, env);
  if (!resTenant.ok) return _json({ ok: false, motivo: resTenant.motivo }, 401);

  let cuerpo;
  try { cuerpo = await request.json(); } catch { cuerpo = {}; }

  const ctx = { tenant: resTenant.tenant, acciones: _acciones };

  try {
    if (cuerpo && cuerpo.jsonrpc) {
      const respuesta = await _manejarJsonRpc(cuerpo, ctx);
      return _json(respuesta, 200);
    }
    // REST simple: la ruta manda la acción (GPT Actions); si no hay ruta reconocida, el cuerpo puede traer
    // `accion` explícita (compatibilidad de prueba / clientes que no versionan por ruta).
    const segmentos = pathname.split("/").filter(Boolean);
    const ultimo = segmentos[segmentos.length - 1] || "";
    const accionPorRuta = _RUTA_A_ACCION[ultimo] || null;
    const accion = accionPorRuta || cuerpo.accion;
    if (!accion) return _json({ ok: false, motivo: "falta indicar la acción (por ruta o por el campo \"accion\")" }, 400);
    const salida = await _despachar(accion, cuerpo.args || cuerpo, ctx);
    return _json(salida, 200);
  } catch (e) {
    try { console.log(`[adi-capacidad] ERROR: ${String(e && e.message).slice(0, 200)}`); } catch { /* sin console */ }
    return _json({ ok: false, motivo: "la puerta no pudo procesar el pedido" }, 200);
  }
}
