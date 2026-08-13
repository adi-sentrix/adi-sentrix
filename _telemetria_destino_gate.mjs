/* === _telemetria_destino_gate.mjs · EL DESTINO REAL DE LA TELEMETRÍA, CERTIFICADO ============================
 * @inspeccion-estatica — además de ejercitar el sink con un FS inyectado, este gate LEE `server.js` como texto
 * para certificar que el destino está CABLEADO en el host donde corre el gateway. Menciona los símbolos del
 * gateway por eso; no lo importa, no invoca nada y no abre un socket.
 *
 * POR QUÉ: la certificación pagada anterior gastó y no se pudo saber cuántas llamadas fueron, con qué modelo ni
 * por qué reintentaron — la telemetría medía y no escribía en ningún lado. Encender el destino es precondición
 * del §9 del contrato. Un destino que nadie certifica es la misma promesa que ya falló una vez.
 *
 * CERO RED, CERO LLM, CERO CRÉDITO: se escribe sobre un FS de mentira y sobre un archivo temporal real.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import * as fsReal from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crearSinkArchivo, instalarTelemetria, telemetriaInstalada, _soloDeclarado, TELEMETRIA_MAX_BYTES } from "./src/adi/llm/telemetrySink.js";
import { emit, setSink, setToolsDeclaradas, CAMPOS_TELEMETRIA, desdeRespuesta, nuevoTraceId } from "./src/adi/llm/telemetry.js";
import { toolNames } from "./src/adi/oracle/toolRegistry.js";

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log(`  OK  ${n}`); } else { fail++; console.log(`FAIL  ${n}${d ? " — " + d : ""}`); } };
const section = (t) => console.log(`\n== ${t} ==`);
const tmp = mkdtempSync(join(tmpdir(), "adi-telem-"));

// ── FS de mentira: deja ver rotación y fallos de escritura sin depender del disco real.
function fsFalso({ fallaEnAppend = false } = {}) {
  const files = new Map();
  return {
    files,
    appendFileSync(ruta, txt) { if (fallaEnAppend) { const e = new Error("EACCES"); e.code = "EACCES"; throw e; } files.set(ruta, (files.get(ruta) || "") + txt); },
    statSync(ruta) { if (!files.has(ruta)) { const e = new Error("ENOENT"); e.code = "ENOENT"; throw e; } return { size: files.get(ruta).length }; },
    renameSync(a, b) { files.set(b, files.get(a) || ""); files.delete(a); },
  };
}

section("1 · ESCRIBE, Y ESCRIBE JSONL (una línea, un evento)");
{
  const fs = fsFalso();
  const { sink, estadisticas } = crearSinkArchivo("/t/telemetria.jsonl", { fs });
  sink({ traceId: "t1", proveedor: "x", etapa: "plan", intento: 0, resultado: "ok", tokens_in: 8886, tokens_out: 120 });
  sink({ traceId: "t2", etapa: "narrar", intento: 1, resultado: "rechazado", reasonCode: "guard_rejected" });
  const lineas = (fs.files.get("/t/telemetria.jsonl") || "").trim().split("\n");
  ok("una línea por evento", lineas.length === 2, JSON.stringify(lineas));
  ok("cada línea es un objeto JSON válido", lineas.every((l) => { try { return typeof JSON.parse(l) === "object"; } catch { return false; } }));
  ok("los campos llegan intactos", JSON.parse(lineas[0]).tokens_in === 8886 && JSON.parse(lineas[1]).reasonCode === "guard_rejected");
  ok("las estadísticas declaran lo escrito", estadisticas().escritos === 2 && estadisticas().descartados === 0);
}

section("2 · EL SEGUNDO CANDADO · nada fuera de la lista blanca llega al disco");
{
  const fs = fsFalso();
  const { sink } = crearSinkArchivo("/t/t.jsonl", { fs });
  // un caller que se saltea `emit` e intenta escribir contenido del cliente DIRECTO contra el sink.
  sink({
    traceId: "t9", etapa: "plan", resultado: "ok",
    pregunta: "¿cuánto vende Falabella?", narracion: "Falabella vende $19.4M",
    entidad: "Falabella", cifra: "$19.4M", args: { cliente: "Falabella" }, prompt: "system…",
  });
  const linea = fs.files.get("/t/t.jsonl") || "";
  for (const prohibido of ["Falabella", "19.4M", "pregunta", "narracion", "entidad", "cifra", "args", "prompt"]) {
    ok(`«${prohibido}» NO llega al disco`, !linea.includes(prohibido), linea);
  }
  ok("y sí llega lo declarado", /"traceId":"t9"/.test(linea) && /"etapa":"plan"/.test(linea));
  const claves = Object.keys(JSON.parse(linea.trim()));
  ok("todas las claves escritas están en la lista blanca", claves.every((k) => CAMPOS_TELEMETRIA.includes(k)), claves.join(","));
  // 15 desde el 2026-08-13: entró `consumo` (¿la llamada salió al proveedor y volvió sin conteo de tokens?).
  ok("la lista blanca es UNA sola (el sink la importa, no la copia)", CAMPOS_TELEMETRIA.length === 15 && Object.isFrozen(CAMPOS_TELEMETRIA));
}

section("3 · NUNCA LANZA · un fallo de disco no puede tumbar un turno");
{
  const fs = fsFalso({ fallaEnAppend: true });
  const { sink, estadisticas } = crearSinkArchivo("/t/t.jsonl", { fs });
  let tiro = false;
  try { sink({ traceId: "t1", etapa: "plan" }); } catch { tiro = true; }
  ok("un EACCES no se propaga", !tiro);
  ok("…y el descarte queda contado, no escondido", estadisticas().descartados === 1 && estadisticas().escritos === 0);
  // y por la puerta real: `emit` nunca lanza, aunque el sink sea hostil.
  setSink(() => { throw new Error("sink hostil"); });
  let tiro2 = false;
  try { emit({ traceId: "t", etapa: "plan" }); } catch { tiro2 = true; }
  ok("emit() tampoco propaga un sink que lanza", !tiro2);
  setSink(null);
}

section("4 · TOPE DE TAMAÑO · el instrumento no llena el disco del server");
{
  const fs = fsFalso();
  const { sink, estadisticas } = crearSinkArchivo("/t/t.jsonl", { fs, maxBytes: 200 });
  for (let i = 0; i < 20; i++) sink({ traceId: `t${i}`, etapa: "plan", resultado: "ok", tokens_in: 8886 });
  ok("rota al superar el tope", estadisticas().rotaciones >= 1, JSON.stringify(estadisticas()));
  ok("conserva una generación anterior (.1)", fs.files.has("/t/t.jsonl.1"));
  ok("el archivo vivo queda por debajo del tope", (fs.files.get("/t/t.jsonl") || "").length <= 200 + 120);
  ok(`el tope por defecto es holgado para una corrida entera (${TELEMETRIA_MAX_BYTES / 1024 / 1024} MB)`, TELEMETRIA_MAX_BYTES >= 1024 * 1024);
}

section("5 · APAGADO POR DEFECTO · encenderlo es una decisión explícita");
{
  setSink(null);
  ok("sin destino declarado no se instala nada", instalarTelemetria({ ruta: null, fs: fsReal }).instalado === false);
  ok("…y emit() sigue siendo un no-op exacto", emit({ traceId: "t", etapa: "plan" }) === null && !telemetriaInstalada());
  const r = instalarTelemetria({ ruta: "/no/existe/jamas/t.jsonl", fs: fsFalso({ fallaEnAppend: true }) });
  ok("FALLA CERRADA: si el destino no es escribible, NO se instala", r.instalado === false && /no escribible/.test(r.motivo), JSON.stringify(r));
  ok("…y lo dice, en vez de fingir que quedó encendida", !!r.motivo);
}

section("6 · PERSISTENTE DE VERDAD · sobrevive al proceso");
{
  const ruta = join(tmp, "telemetria.jsonl");
  const r = instalarTelemetria({ ruta, tools: toolNames(), fs: fsReal });
  ok("se instala contra un disco real", r.instalado === true, JSON.stringify(r));
  ok("queda instalado en el módulo de telemetría", telemetriaInstalada());
  // el camino REAL del gateway: desdeRespuesta → _limpio → emit → sink → disco.
  emit(desdeRespuesta({
    traceId: nuevoTraceId("semilla-fija"), proveedor: "anthropic", modelo: "claude-x", etapa: "plan", intento: 0,
    latencia_ms: 1234, ruta_deterministica: false, tools: ["marginRead", "pnlRead"],
    respuesta: { ok: true, modelo: "claude-x-2026", usage: { input_tokens: 8886, output_tokens: 140, cachedTokens: 8542 } },
  }));
  ok("el archivo existe en disco después de emitir", existsSync(ruta));
  const contenido = readFileSync(ruta, "utf8").trim();
  const ev = JSON.parse(contenido.split("\n").pop());
  ok("registra el modelo que RESPONDIÓ, no el pedido", ev.modelo === "claude-x-2026", JSON.stringify(ev));
  ok("registra tokens de entrada, salida y caché", ev.tokens_in === 8886 && ev.tokens_out === 140 && ev.tokens_in_cache === 8542);
  ok("deriva tokens_in_fresh por resta (no lo acepta de afuera)", ev.tokens_in_fresh === 8886 - 8542);
  ok("registra la latencia y la etapa", ev.latencia_ms === 1234 && ev.etapa === "plan");
  ok("registra las tools REALES del registro del motor", Array.isArray(ev.tools) && ev.tools.includes("marginRead"));
  ok("una tool inventada NO sobrevive al registro", (() => {
    setToolsDeclaradas(toolNames());
    const limpio = emit({ traceId: "t", etapa: "plan", tools: ["marginRead", "tool_inventada"] });
    return limpio && limpio.tools.length === 1 && limpio.tools[0] === "marginRead";
  })());
  // PERSISTENCIA: se lee desde un descriptor nuevo, como lo haría otro proceso después de la corrida.
  const releido = readFileSync(ruta, "utf8");
  ok("otro lector encuentra los eventos ya escritos (sobrevive al proceso)", releido.split("\n").filter(Boolean).length >= 2);
  ok("y NADA del cliente quedó en el archivo", !/Falabella|Lider|\$1[0-9]\.[0-9]M/.test(releido));
  setSink(null);
}

section("7 · CABLEADO EN EL HOST DONDE CORRE EL GATEWAY");
{
  const SERVER = readFileSync("./server.js", "utf8");
  ok("server.js instala el destino al arrancar", /instalarTelemetria\(\{/.test(SERVER));
  ok("…leyendo la ruta del entorno, nunca una ruta inventada acá", /ADI_TELEMETRY_FILE/.test(SERVER));
  ok("…declarando las tools desde el registro REAL del motor", /toolNames\(\)/.test(SERVER));
  ok("…y diciendo en el arranque si quedó encendida o por qué no", /telemetría APAGADA/.test(SERVER) && /telemetría →/.test(SERVER));
  const SINK = readFileSync("./src/adi/llm/telemetrySink.js", "utf8");
  ok("el módulo declara el límite de serverless en vez de fingir persistencia", /efímero|efimero/.test(SINK) && /falla cerrada/i.test(SINK));
}

rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} OK · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
