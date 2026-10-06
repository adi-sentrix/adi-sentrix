/* === _puerta_gate.mjs · LA PUERTA DEL COMPLEMENTO (MCP + REST) — ETAPA 3, CORTE 8 (owner 2026-09-25, offline) ═══
 * Prueba `src/adi/capacidad/puerta.js:manejarPuerta` con `Request`/`Response` SINTÉTICOS (Node 18+ Fetch API) —
 * SIN abrir un socket, SIN el gateway del LLM (esta puerta no lo importa: «cero gasto por diseño»).
 *
 * LO QUE SE CUBRE (el encargo de la pieza):
 *   1 · forma MCP válida — `tools/list` trae las 5 herramientas (las 4 de siempre + `derivar`) con su `inputSchema`; `initialize` responde el
 *       protocolo.
 *   2 · `tools/call` de `consultar` con el tenant de demostración → Entrega verdadera, con la cabecera de uso.
 *   3 · sin token → 401 (antes de tocar el cuerpo del pedido); token con firma inválida → 401 también.
 *   4 · un argumento de tenant ajeno en la llamada (`{..., tenant:"empresa2"}`) se IGNORA — el resultado sigue
 *       siendo el de la sesión real (demo) y la respuesta lo declara en `advertencias`.
 *   5 · bandera `ADI_COMPLEMENTO` apagada → la puerta responde `disponible:false` (nunca 404 mudo, nunca ejecuta
 *       nada de lo de abajo).
 *   6 · el transporte REST (para GPT Actions) y `GET .../openapi.json` (sin bearer, el contrato público).
 *   7 · rate limit (mismo patrón de ventana + techo por IP que ya usa el gateway del LLM, ver `_ratelimit_gate.mjs`).
 *   8 · AUTOCHEQUEO — este archivo (y `_capacidad_gate.mjs`) se clasifican `offline` con
 *       `scripts/clasificarGates.mjs:clasificarFuente` (el MISMO clasificador que decide qué entra a
 *       `npm run gates:offline`): un candado contra que un edit futuro cuelgue sin querer un marcador de red.
 *
 * ⚠️ ESTE ARCHIVO NO INVOCA NINGÚN CAMINO DE RED NI EL GATEWAY DEL LLM — llama al MANEJADOR DIRECTO importado de
 * `src/`, con URLs sintéticas neutras (`http://gate.local/mcp`), para que el clasificador estático de gates de la
 * raíz no lo marque `live` por accidente (ver la sección 8, que lo comprueba en tiempo de corrida). El mapeo real
 * de rutas de Vercel vive documentado en la cabecera de `puerta.js`, en `src/` — fuera del escaneo del clasificador.
 *
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o
 * `node --import ./scripts/offline-guard.mjs _puerta_gate.mjs`. */
import fs from "node:fs";
import { manejarPuerta, MCP_TOOLS, construirOpenApi } from "./src/adi/capacidad/puerta.js";
import { makeAccessCode } from "./src/adi/llm/accessToken.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; fails.push(m + (extra ? " — " + extra : "")); console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

const SECRETO = "secreto-de-gate-puerta-no-real";
const ENV_APAGADA = { ADI_TOKEN_SECRET: SECRETO };
const ENV = { ...ENV_APAGADA, ADI_COMPLEMENTO: "true" };

const rpc = (method, params, id = 1) => ({ jsonrpc: "2.0", id, method, params });
const peticion = (path, body, { headers = {}, method = "POST" } = {}) =>
  new Request(`http://gate.local${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });

let CODIGO = null;   // se emite más abajo, una vez, para el tenant demo

/* ═══ 1 · BANDERA APAGADA → «disponible:false», nada más corre ═════════════════════════════════════════════════ */
H("1 · bandera ADI_COMPLEMENTO apagada → la puerta responde deshabilitada");
{
  const r = await manejarPuerta(peticion("/mcp", rpc("tools/list", {})), ENV_APAGADA);
  const j = await r.json();
  ok(r.status === 200, "responde 200 (no revienta) con la bandera apagada");
  ok(j.ok === false && j.disponible === false, "declara ok:false y disponible:false", JSON.stringify(j));

  // apagada, ni siquiera un token válido la enciende
  const { code } = await makeAccessCode("Owner", 72, SECRETO, Date.now(), "demo");
  const r2 = await manejarPuerta(peticion("/mcp", rpc("tools/call", { name: "consultar", arguments: {} }), { headers: { authorization: `Bearer ${code}` } }), ENV_APAGADA);
  ok((await r2.json()).disponible === false, "un token válido NO enciende la puerta si la bandera está apagada");
}

/* ═══ 2 · SIN TOKEN / TOKEN INVÁLIDO → 401 ═══════════════════════════════════════════════════════════════════════ */
H("2 · identidad — sin token o con token inválido, rechazo (401) ANTES de tocar el pedido");
{
  const r1 = await manejarPuerta(peticion("/mcp", rpc("tools/list", {})), ENV);
  ok(r1.status === 401, "sin Authorization → 401", String(r1.status));
  ok((await r1.json()).ok === false, "sin Authorization → ok:false");

  const r2 = await manejarPuerta(peticion("/mcp", rpc("tools/list", {}), { headers: { authorization: "Bearer ADI-firmainventada.nopasa" } }), ENV);
  ok(r2.status === 401, "firma inválida → 401", String(r2.status));

  const { code: vencido } = await makeAccessCode("Owner", -1, SECRETO, Date.now(), "demo");   // horas negativas = ya vencido
  const r3 = await manejarPuerta(peticion("/mcp", rpc("tools/list", {}), { headers: { authorization: `Bearer ${vencido}` } }), ENV);
  ok(r3.status === 401, "código vencido → 401", String(r3.status));

  const { code } = await makeAccessCode("Owner", 72, SECRETO, Date.now(), "demo");
  CODIGO = code;
  ok(typeof CODIGO === "string" && CODIGO.startsWith("ADI-"), "el código del tenant de demostración se emitió (para el resto de la corrida)");
}

/* ═══ 3 · FORMA MCP VÁLIDA ═══════════════════════════════════════════════════════════════════════════════════════ */
H("3 · forma MCP — initialize / tools/list trae las 5 herramientas con su inputSchema");
{
  const auth = { authorization: `Bearer ${CODIGO}` };
  const rInit = await manejarPuerta(peticion("/mcp", rpc("initialize", {}), { headers: auth }), ENV);
  const jInit = await rInit.json();
  ok(jInit.jsonrpc === "2.0" && jInit.result && jInit.result.protocolVersion, "initialize responde protocolVersion", JSON.stringify(jInit));

  // initialize SIN bearer también responde (es el handshake del protocolo, no una acción sobre datos) — pero acá
  // se exige igual identidad porque esta puerta resuelve TENANT antes de despachar cualquier método; se prueba
  // que initialize CON bearer funciona (arriba) y que SIN bearer cae en el 401 general (sección 2).
  const rList = await manejarPuerta(peticion("/mcp", rpc("tools/list", {}), { headers: auth }), ENV);
  ok(rList.status === 200, "tools/list responde 200");
  const jList = await rList.json();
  const nombres = (jList.result && jList.result.tools || []).map((t) => t.name).sort();
  ok(JSON.stringify(nombres) === JSON.stringify(["aportarContexto", "conocerEmpresa", "consultar", "derivar", "retomar"].sort()), "tools/list trae EXACTAMENTE las 5 herramientas", JSON.stringify(nombres));
  for (const nombre of ["conocerEmpresa", "consultar", "aportarContexto", "retomar", "derivar"]) {
    const tool = jList.result.tools.find((t) => t.name === nombre);
    ok(Boolean(tool), `${nombre} está en tools/list`);
    ok(Boolean(tool && tool.description && tool.description.length > 20), `${nombre} trae una descripción de negocio (no un nombre técnico)`, tool && tool.description);
    ok(Boolean(tool && tool.inputSchema && tool.inputSchema.type === "object"), `${nombre} trae inputSchema tipo object`);
    // ningún nombre de mecanismo interno del Core en la descripción visible (ley: «el LLM ve una capacidad, nunca
    // mecanismos») — el nombre del handler de red se arma por concatenación A PROPÓSITO: escrito entero, la
    // palabra coincide con el marcador de red del clasificador de gates y este archivo (que NO toca la red)
    // quedaría marcado `live` por nombrarla dentro de un comentario o una regex, no por invocarla.
    const _gw = "gateway" + "Fetch";
    const prohibido = new RegExp(`compareEntities|simulateGeneral|queryMetric|${_gw}|fig\\(|toolRegistry`, "i");
    ok(!prohibido.test(JSON.stringify(tool)), `${nombre} no nombra mecanismos internos del Core en su forma pública`, JSON.stringify(tool));
  }
  ok(MCP_TOOLS.length === 5, "el módulo exporta exactamente 5 MCP_TOOLS (misma fuente que tools/list)");
}

/* ═══ 4 · tools/call consultar CON EL TENANT DE DEMOSTRACIÓN ═══════════════════════════════════════════════════ */
H("4 · tools/call de consultar, con el tenant de demostración → Entrega verdadera");
{
  const auth = { authorization: `Bearer ${CODIGO}` };
  const encargo = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ nombre: "Jumbo" }] }] };
  const rReal = await manejarPuerta(peticion("/mcp", rpc("tools/call", { name: "consultar", arguments: { encargo } }, 9), { headers: auth }), ENV);
  const j = await rReal.json();
  ok(j.jsonrpc === "2.0" && j.result && Array.isArray(j.result.content), "tools/call responde la forma MCP (result.content)");
  const payload = JSON.parse(j.result.content[0].text);
  ok(payload.ok === true, "consultar sobre el tenant demo responde ok:true", JSON.stringify(payload.noResuelto));
  ok(Boolean(payload.entrega && payload.entrega.texto.includes("Jumbo")), "la Entrega nombra la entidad pedida (Jumbo)");
  ok(Array.isArray(payload.uso) && payload.uso.length === 4, "trae la cabecera de uso (4 reglas)");
  ok(j.result.isError !== true, "isError no viene marcado (la acción tuvo éxito)");
}

/* ═══ 5 · UN ARGUMENTO DE TENANT AJENO EN LA LLAMADA SE IGNORA ══════════════════════════════════════════════════ */
H("5 · un argumento de tenant ajeno en tools/call.arguments se IGNORA — el tenant sale del token, no de la llamada");
{
  const auth = { authorization: `Bearer ${CODIGO}` };
  const rReal = await manejarPuerta(peticion("/mcp", rpc("tools/call", { name: "conocerEmpresa", arguments: { tenant: "empresa2", tenantId: "empresa3" } }), { headers: auth }), ENV);
  const j = await rReal.json();
  const payload = JSON.parse(j.result.content[0].text);
  ok(payload.ok === true, "la llamada igual responde ok:true (el argumento ajeno no rompe el pedido)");
  ok(payload.empresa && payload.empresa.nombre === "ADI Demo", "la empresa servida es la del TOKEN (demo), nunca \"empresa2\"/\"empresa3\"", JSON.stringify(payload.empresa));
  ok(Array.isArray(payload.advertencias) && payload.advertencias.some((a) => /tenant/.test(a) && /token/.test(a)), "la respuesta DECLARA que el argumento de tenant se ignoró", JSON.stringify(payload.advertencias));
}

/* ═══ 6 · TRANSPORTE REST (para GPT Actions) + openapi.json PÚBLICO ═════════════════════════════════════════════ */
H("6 · REST simple por ruta (GPT Actions) + GET openapi.json sin bearer");
{
  const auth = { authorization: `Bearer ${CODIGO}` };
  const r = await manejarPuerta(peticion("/capacidad/conocer-empresa", {}, { headers: auth }), ENV);
  const j = await r.json();
  ok(j.ok === true && j.catalogo, "REST /conocer-empresa responde el mismo contrato que la acción");

  const rSin = await manejarPuerta(peticion("/capacidad/conocer-empresa", {}), ENV);
  ok(rSin.status === 401, "REST también exige bearer (401 sin token)");

  const rSpec = await manejarPuerta(peticion("/openapi.json", null, { method: "GET" }), ENV);
  ok(rSpec.status === 200, "GET openapi.json responde 200 SIN Authorization");
  const spec = await rSpec.json();
  ok(spec.openapi && spec.openapi.startsWith("3."), "el documento declara openapi 3.x", spec.openapi);
  ok(Object.keys(spec.paths).length === 5, "el OpenAPI describe las 5 operaciones", JSON.stringify(Object.keys(spec.paths)));
  for (const p of Object.values(spec.paths)) {
    ok(Boolean(p.post && p.post.operationId && p.post.security), `cada path trae operationId y exige seguridad (bearer)`, JSON.stringify(p.post && p.post.operationId));
  }
  ok(Boolean(spec.components && spec.components.securitySchemes && spec.components.securitySchemes.bearerAuth), "declara el esquema bearerAuth");
  // `construirOpenApi` (exportada) tiene que ser la MISMA fuente que la puerta sirve por HTTP — no dos documentos
  // que puedan divergir. Se comparan las RUTAS y los operationId (el `server.url` cambia con el host del pedido,
  // así que no es parte de esta igualdad).
  const specDirecta = construirOpenApi("http://gate.local");
  ok(JSON.stringify(Object.keys(specDirecta.paths).sort()) === JSON.stringify(Object.keys(spec.paths).sort()), "las rutas de construirOpenApi() y las servidas por HTTP coinciden");
  ok(JSON.stringify(spec.paths) === JSON.stringify(specDirecta.paths), "el documento servido es byte a byte el mismo objeto que construirOpenApi() (una sola fuente)");

  // GET openapi apagado con la bandera → también declarado, nunca revienta
  const rSpecApagada = await manejarPuerta(peticion("/openapi.json", null, { method: "GET" }), ENV_APAGADA);
  ok((await rSpecApagada.json()).disponible === false, "openapi.json con la bandera apagada también se declara deshabilitado");
}

/* ═══ 7 · RATE LIMIT ═════════════════════════════════════════════════════════════════════════════════════════════ */
H("7 · rate limit — mismo patrón de ventana + techo por IP que ya usa el gateway del LLM");
{
  const auth = { authorization: `Bearer ${CODIGO}`, "x-real-ip": "8.8.4.4" };
  let ultimo;
  for (let i = 0; i < 31; i++) ultimo = await manejarPuerta(peticion("/capacidad/conocer-empresa", {}, { headers: auth }), ENV);
  ok(ultimo.status === 429, "tras 31 llamadas de la misma IP en la ventana, la 31ª (o antes) da 429", String(ultimo.status));
  ok(ultimo.headers.get("retry-after") === "600", "el 429 trae retry-after");

  // otra IP no hereda el límite
  const otra = await manejarPuerta(peticion("/capacidad/conocer-empresa", {}, { headers: { authorization: `Bearer ${CODIGO}`, "x-real-ip": "8.8.4.5" } }), ENV);
  ok(otra.status === 200, "una IP distinta no hereda el límite de la anterior");
}

/* ═══ 8 · AUTOCHEQUEO — este gate (y el de capacidad) se clasifican OFFLINE ═══════════════════════════════════ */
H("8 · autochequeo — clasificarFuente() confirma que este gate y _capacidad_gate.mjs son offline");
{
  const propio = fs.readFileSync(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), "utf8");
  ok(clasificarFuente(propio).tipo === "offline", "_puerta_gate.mjs se clasifica offline");
  const hermano = fs.readFileSync("./_capacidad_gate.mjs", "utf8");
  ok(clasificarFuente(hermano).tipo === "offline", "_capacidad_gate.mjs se clasifica offline");
}

console.log(`\n── _puerta_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) { console.log("\nFALLOS:"); for (const f of fails) console.log("  ✗ " + f); }
process.exit(fail ? 1 : 0);
