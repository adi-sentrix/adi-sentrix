/* === _agente_adapter_gate.mjs · EL CABLE DEL MODO LIBRE (F2 · owner 2026-08-30) ===============================
 *
 * Lo que este candado exige del cable, sin llamar a ningún proveedor (fixtures + frenos):
 *   1 · el cuerpo del MODO LIBRE declara las herramientas SIN tool_choice — forzarla lo convertiría en parse;
 *   2 · la respuesta del proveedor se traduce al contrato del bucle: tool_use (uno o varios, en paralelo) →
 *       pedidos · texto → texto — en los DOS adapters;
 *   3 · handleAgente frena TIPADO antes de gastar: sin mensajes, sin system, sin herramientas, sin config;
 *   4 · la telemetría acepta la etapa «agente» (un gasto del bucle jamás queda ciego);
 *   5 · el catálogo se deriva del contrato (26 herramientas: las 24 del registro + las 2 del agente),
 *       alfabético y DETERMINÍSTICO byte a byte;
 *   6 · el system del agente es fijo byte a byte por tenant+escenario (el prefijo cacheable).
 *
 * ⚠️ CARNADAS (sección 7). OFFLINE · @inspeccion-estatica: este gate NO importa el gateway ni los adapters —
 * la traducción pura vive en respuestaProveedor.js — la única dep permitida de un adapter (se ejerce behavioral) y los CUERPOS de los adapters y del
 * handler se inspeccionan POR TEXTO, la misma disciplina de los guardianes del gateway. La conducta de los
 * frenos la ejercen esos guardianes (AGENTE registrado en su META); el candado de red sigue siendo el piso.
 * `node --import ./scripts/offline-guard.mjs _agente_adapter_gate.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { parseAgenteAnthropic as parseA, parseAgenteOpenai as parseO } from "./src/adi/llm/respuestaProveedor.js";
import { desdeRespuesta, ETAPAS } from "./src/adi/llm/telemetry.js";
import { catalogoAgente } from "./src/adi/agente/catalogoAgente.js";
import { sistemaDelAgente } from "./src/adi/agente/sistemaAgente.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);
initTenant(TENANT_DEMO);

const MENSAJES = [{ role: "user", content: "cuánto me compró riachuelo el último mes" }];
const CATALOGO = catalogoAgente();

/* ═══ 1 · EL CUERPO DEL MODO LIBRE ════════════════════════════════════════════════════════════════════════════ */
H("1 · las herramientas van declaradas, JAMÁS forzadas (cuerpos de los adapters, por texto)");
const SRC_A = fs.readFileSync("./src/adi/llm/adapters/anthropic.js", "utf8").replace(/\r\n/g, "\n");
const SRC_O = fs.readFileSync("./src/adi/llm/adapters/openai.js", "utf8").replace(/\r\n/g, "\n");
const _cuerpoDe = (src, nombre) => {
  const i = src.indexOf(nombre);
  return i < 0 ? "" : src.slice(i, src.indexOf("\n}", i) + 2);
};
const _sinComentarios = (t) => t.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
{
  const cuerpoA = _cuerpoDe(SRC_A, "export function buildAgenteBody");
  ok(cuerpoA.length > 200, "anthropic: buildAgenteBody existe");
  ok(cuerpoA.includes("tools: (Array.isArray(tools)"), "anthropic: declara el catálogo completo en tools");
  ok(!/tool_choice/.test(_sinComentarios(cuerpoA)), "anthropic: SIN tool_choice fuera de comentarios — el modelo elige, ese es el punto");
  ok(cuerpoA.includes('role === "user"'), "anthropic: garantiza el último turno del usuario");
  const cuerpoO = _cuerpoDe(SRC_O, "export function buildAgenteBody");
  ok(cuerpoO.length > 200 && !/tool_choice/.test(_sinComentarios(cuerpoO)), "openai: ídem, function calling libre");
  ok(cuerpoO.includes('role: "system"'), "openai: el system viaja como primer mensaje");
  ok(SRC_A.includes("parseAgenteAnthropic as parseRespuestaAgente") && SRC_O.includes("parseAgenteOpenai as parseRespuestaAgente"),
    "los DOS adapters delegan la traducción a respuestaProveedor — una sola, jamás dos que diverjan");
}

/* ═══ 2 · LA TRADUCCIÓN DE RESPUESTAS ═════════════════════════════════════════════════════════════════════════ */
H("2 · tool_use → pedidos (también en paralelo) · texto → texto");
{
  const dosTools = parseA({ content: [
    { type: "tool_use", id: "t1", name: "serieEntidad", input: { entity: "Falabella" } },
    { type: "tool_use", id: "t2", name: "salesRead", input: {} },
  ] });
  ok(dosTools.tipo === "herramientas" && dosTools.pedidos.length === 2 && dosTools.pedidos[0].tool === "serieEntidad",
    "anthropic: dos tool_use en paralelo → dos pedidos", JSON.stringify(dosTools.pedidos));
  const texto = parseA({ content: [{ type: "text", text: "La lectura del período es esta." }] });
  ok(texto.tipo === "texto" && /lectura del período/.test(texto.texto), "anthropic: texto → texto");
  const oTools = parseO({ choices: [{ message: { tool_calls: [
    { function: { name: "trend", arguments: "{}" } },
    { function: { name: "queryMetric", arguments: "{\"metric\":\"ventas\",\"dimension\":\"cliente\"}" } },
  ] } }] });
  ok(oTools.tipo === "herramientas" && oTools.pedidos.length === 2 && oTools.pedidos[1].args.metric === "ventas",
    "openai: tool_calls → pedidos con args parseados");
  const oTexto = parseO({ choices: [{ message: { content: "Texto plano." } }] });
  ok(oTexto.tipo === "texto" && oTexto.texto === "Texto plano.", "openai: texto → texto");
  const oRoto = parseO({ choices: [{ message: { tool_calls: [{ function: { name: "x", arguments: "{no-json" } }] } }] });
  ok(oRoto.pedidos[0].args && typeof oRoto.pedidos[0].args === "object", "openai: args ilegibles caen a {} — jamás revientan la ronda");
}

/* ═══ 3 · LOS FRENOS DE handleAgente — POR TEXTO, como los guardianes ═════════════════════════════════════════
 * Importar gatewayCore sacaría este gate de la suite offline (regla estática del runner, con razón: 43 gates
 * cargan el .env). Los frenos y la emisión de handleAgente ya los inspeccionan POR TEXTO los tres guardianes
 * (_gateway_causa_emision · _consumo_sin_conteo · _proveedor_declarado — AGENTE registrado en su META). Acá se
 * exige solo lo local: que el handler exista, montado, con sus frenos propios visibles en el fuente. */
H("3 · handleAgente existe, montado y con frenos (inspección por texto — la conducta la ejercen los guardianes)");
{
  const SRC = fs.readFileSync("./src/adi/llm/gatewayCore.js", "utf8").replace(/\r\n/g, "\n");
  ok(SRC.includes("export async function handleAgente("), "el handler existe");
  ok(SRC.includes('"/api/adi-agente": handleAgente'), "y está montado en las rutas del gateway");
  for (const freno of ["agente sin mensajes", "agente sin system", "agente sin herramientas"])
    ok(SRC.includes(freno), `freno propio: «${freno}»`);
  ok(SRC.includes('paso === "herramientas" ? modelPlanTier : narrateModel'),
    "las rondas de herramientas van al tier de PLAN y el cierre al de NARRAR — el reparto de modelos del F1");
}

/* ═══ 4 · LA TELEMETRÍA VE AL AGENTE ══════════════════════════════════════════════════════════════════════════ */
H("4 · la etapa «agente» existe — el gasto del bucle no queda ciego");
{
  ok(ETAPAS.includes("agente"), "la etapa está en el vocabulario cerrado");
  const ev = desdeRespuesta({ traceId: "t", proveedor: "anthropic", modelo: "claude-haiku-4-5", etapa: "agente",
    intento: 0, latencia_ms: 10, respuesta: { ok: true }, ruta_deterministica: false, salioAlProveedor: true });
  ok(ev.etapa === "agente", "y desdeRespuesta la conserva en vez de anularla", String(ev.etapa));
}

/* ═══ 5 · EL CATÁLOGO, DERIVADO Y DETERMINÍSTICO ══════════════════════════════════════════════════════════════ */
H("5 · el catálogo sale del contrato y no se mueve");
{
  const caja = cajaDelAgente(TOOLS);
  ok(CATALOGO.length === Object.keys(caja).length, `una entrada por herramienta ejecutable (${CATALOGO.length})`);
  ok(CATALOGO.every((t) => caja[t.name]), "todo lo catalogado se puede ejecutar — nada fantasma");
  const nombres = CATALOGO.map((t) => t.name);
  ok(nombres.includes("serieEntidad") && nombres.includes("registrarSupuesto"), "las dos herramientas del agente están");
  ok(JSON.stringify(nombres) === JSON.stringify([...nombres].sort((a, b) => a.localeCompare(b, "es"))), "orden alfabético fijo");
  ok(JSON.stringify(catalogoAgente()) === JSON.stringify(CATALOGO), "dos generaciones → byte a byte idénticas");
  const serie = CATALOGO.find((t) => t.name === "serieEntidad");
  ok(serie.input_schema.required.includes("entity"), "serieEntidad exige `entity` en su schema");
}

/* ═══ 6 · EL SYSTEM FIJO ══════════════════════════════════════════════════════════════════════════════════════ */
H("6 · el system del agente es un prefijo estable");
{
  const s1 = sistemaDelAgente("actual").fijo, s2 = sistemaDelAgente("actual").fijo;
  ok(s1 === s2, "dos generaciones → byte a byte idénticas (el caché del proveedor depende de esto)");
  ok(/INVARIANTES/.test(s1) && /MAPA DEL DATO/.test(s1), "trae las invariantes y el mapa");
  ok(s1.length / 3.7 < 4000, `y es chico (${Math.round(s1.length / 3.7)} tok — el fijo del natural mide ~6.6K)`);
}

/* ═══ 7 · CARNADAS ════════════════════════════════════════════════════════════════════════════════════════════ */
H("7 · CARNADA · el candado se prueba con el defecto adentro");
{
  const tmp = [];
  let nCarnada = 0;
  const mutar = (rel, reemplazos) => {
    const abs = path.join(process.cwd(), rel);
    let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    for (const [de, a] of reemplazos) {
      const antes = txt;
      txt = txt.replace(de, a);
      if (txt === antes) return { error: `la carnada no encontró qué mutar en ${rel}` };
    }
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}_${++nCarnada}.js`);
    fs.writeFileSync(destino, txt);
    tmp.push(destino);
    return { url: pathToFileURL(destino).href };
  };
  const carnada = async (nombre, rel, reemplazos, prueba) => {
    const m = mutar(rel, reemplazos);
    if (m.error) return ok(false, `carnada «${nombre}»`, m.error);
    let cazada = false, detalle = "";
    try { cazada = await prueba(await import(m.url)); }
    catch (e) { detalle = `la copia mutada ni siquiera carga: ${e.message}`; }
    ok(cazada, `carnada «${nombre}» → el chequeo se pone ROJO`, detalle || "el defecto pasó DESAPERCIBIDO");
  };

  // (a) el modo libre con la herramienta FORZADA — deja de ser libre
  await carnada("anthropic con tool_choice forzado", "src/adi/llm/adapters/anthropic.js",
    [[/    \/\/ SIN tool_choice: forzarla convertiría el modo libre en el modo parse — el modelo elige, ese es el punto\.\n/,
      '    tool_choice: { type: "tool", name: (Array.isArray(tools) && tools[0] && tools[0].name) || "x" },\n']],
    async (Mut) => "tool_choice" in Mut.buildAgenteBody({ mensajes: MENSAJES, system: "S", tools: CATALOGO, model: "m" }));

  // (b) el parser que ignora los tool_calls — todo sería texto y el bucle jamás ejecutaría nada
  await carnada("el parser ignorando tool_calls", "src/adi/llm/respuestaProveedor.js",
    [[/  const calls = \(msg && msg\.tool_calls\) \|\| \[\];\n  if \(calls\.length\) \{/, "  const calls = [];\n  if (calls.length) {"]],
    async (Mut) => {
      const r = Mut.parseAgenteOpenai({ choices: [{ message: { tool_calls: [{ function: { name: "trend", arguments: "{}" } }] } }] });
      return r.tipo !== "herramientas";
    });

  // (c) el catálogo sin las herramientas del agente — el cerebro no podría pedir la serie
  await carnada("catálogo sin las herramientas nuevas", "src/adi/agente/catalogoAgente.js",
    [[/const todos = \{ \.\.\.TOOL_CONTRACTS, \.\.\.CONTRATOS_AGENTE \};/, "const todos = { ...TOOL_CONTRACTS };"]],
    async (Mut) => !Mut.catalogoAgente().some((t) => t.name === "serieEntidad"));

  // (d) la etapa «agente» borrada de la telemetría — el gasto del bucle quedaría ciego
  await carnada("telemetría sin la etapa agente", "src/adi/llm/telemetry.js",
    [[/export const ETAPAS = \["plan", "narrar", "deterministica", "agente"\];/, 'export const ETAPAS = ["plan", "narrar", "deterministica"];']],
    async (Mut) => {
      const ev = Mut.desdeRespuesta({ traceId: "t", proveedor: "anthropic", modelo: "m", etapa: "agente",
        intento: 0, latencia_ms: 1, respuesta: { ok: true }, ruta_deterministica: false, salioAlProveedor: true });
      return ev.etapa !== "agente";
    });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

console.log(`\n── _agente_adapter_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
