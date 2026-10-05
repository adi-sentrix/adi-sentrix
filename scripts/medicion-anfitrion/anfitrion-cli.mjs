/* === scripts/medicion-anfitrion/anfitrion-cli.mjs · LA VÍA A: `claude -p` ENDURECIDO CON LA SUSCRIPCIÓN DEL OWNER ═════
 * Diseño §4 «Vía A». Hechos verificados contra `claude --help` 2.1.286: `--bare` NO lee el login de la suscripción
 * («Anthropic auth is strictly ANTHROPIC_API_KEY or apiKeyHelper»), así que se usa `claude -p` SIN `--bare`, endurecido:
 *
 *   --system-prompt <instrucción mínima congelada>        (reemplaza TODO el prompt de sistema; hash en el informe)
 *   --tools ""                                            (ninguna herramienta propia de Claude Code)
 *   --mcp-config <json> --strict-mcp-config               (SOLO el servidor `adi`: la puerta servida en local)
 *   --allowedTools mcp__adi__… (las cuatro) · --permission-prompts none   (las cuatro se aprueban; nada más puede pedir permiso)
 *   --setting-sources project                             (sin el nivel de usuario: ni ~/.claude/settings ni su memoria)
 *   --disable-slash-commands                              (sin skills)
 *   --no-session-persistence · --model <fijo> · --input-format stream-json --output-format stream-json --verbose
 *   carpeta de trabajo VACÍA, FUERA del repo y de cualquier carpeta con CLAUDE.md o .claude
 *
 * UNA SESIÓN = UN PROCESO `claude -p` con entrada `stream-json` (los turnos de la persona se le mandan por stdin, uno tras
 * otro, y el contexto vive en el proceso: `--no-session-persistence` impide reanudar desde disco, así que un CORTE es matar
 * el proceso y lanzar uno nuevo). El servidor MCP (`mcp-adi.mjs`) lo lanza el propio `claude` según el `--mcp-config`.
 * EL ENTORNO del hijo se limpia de toda credencial de API (si no, `claude` gastaría API en vez de usar la suscripción).
 *
 * LO QUE EL CLI NO DEJA QUITAR (declarado en el informe): los system reminders de Claude Code. El `chequeo de limpieza`
 * (`limpieza.mjs`) lee el stream y ANULA la corrida si entró cualquier herramienta o instrucción ajena a las cuatro acciones. */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, appendFileSync, mkdtempSync } from "node:fs";
import { join, dirname, resolve, parse as parsePath } from "node:path";
import { tmpdir, homedir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { INSTRUCCION_DE_SISTEMA, nombresMcpDelCli, NOMBRE_DEL_SERVIDOR_MCP } from "./instruccion.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RUTA_MCP_ADI = join(AQUI, "mcp-adi.mjs");
const GUARDA_OFFLINE = pathToFileURL(join(AQUI, "..", "offline-guard.mjs")).href;

/* ── el entorno del hijo: sin credencial de API; con el ruido del CLI apagado hasta donde se puede ────────────────── */
const _CREDENCIALES_DE_API = /^(ANTHROPIC_(API_KEY|AUTH_TOKEN|BASE_URL|MODEL|SMALL_FAST_MODEL)|OPENAI_|AZURE_OPENAI|GEMINI_|GOOGLE_API_KEY|AWS_|CLAUDE_CODE_USE_(BEDROCK|VERTEX|FOUNDRY)|CLAUDE_CODE_API_KEY_HELPER|LLM_)/i;
export function entornoDelCli(base = process.env, { conservarBaseUrl = false } = {}) {
  const env = {};
  const quitadas = [];
  for (const [k, v] of Object.entries(base)) { if (_CREDENCIALES_DE_API.test(k) && !(conservarBaseUrl && k === "ANTHROPIC_BASE_URL")) quitadas.push(k); else env[k] = v; }
  // best-effort (no todas existen en todas las versiones): el chequeo de limpieza es la garantía, no estas variables
  Object.assign(env, { CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1", DISABLE_AUTOUPDATER: "1", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1", CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1" });
  return { env, quitadas };
}

/* ── ¿dónde está `claude`? (en esta máquina NO está en el PATH: lo trae la app de escritorio) ─────────────────────── */
export function localizarClaude({ env = process.env, existe = existsSync, listar = (d) => readdirSync(d) } = {}) {
  if (env.CLAUDE_BIN && existe(env.CLAUDE_BIN)) return env.CLAUDE_BIN;
  const appdata = env.APPDATA || (env.USERPROFILE ? join(env.USERPROFILE, "AppData", "Roaming") : null);
  if (appdata) {
    const raiz = join(appdata, "Claude", "claude-code");
    try {
      const versiones = listar(raiz).filter((v) => /^\d+\.\d+\.\d+/.test(v)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).reverse();
      for (const v of versiones) for (const sub of listar(join(raiz, v))) { const exe = join(raiz, v, sub, "claude.exe"); if (existe(exe)) return exe; }
    } catch { /* sin la app de escritorio */ }
  }
  return "claude";    // el PATH
}
export function versionDelCli(bin) {
  try { return String(execFileSync(...(_comoEjecutable(bin, ["--version"])), { encoding: "utf8", timeout: 20000 })).trim(); } catch (e) { return null; }
}
function _comoEjecutable(bin, args) { return /\.(mjs|js|cjs)$/i.test(bin) ? [process.execPath, [bin, ...args]] : [bin, args]; }

/* ── la carpeta de trabajo: vacía y sin CLAUDE.md ni .claude en ella ni en NINGÚN ancestro ───────────────────────── */
/* El `.claude` de la CASA del usuario (`~/.claude`) es el nivel «usuario»: lo acotan `--setting-sources project` y las variables del entorno, y
 * lo vigila el chequeo de limpieza sobre el stream; no se le puede pedir al owner que lo mueva. Cualquier OTRO `.claude`, y todo CLAUDE.md, en la
 * carpeta o en un ancestro sí es proyecto y rompe el aislamiento. */
export function carpetaAislada(dir, { existe = existsSync, casa = homedir() } = {}) {
  const problemas = [];
  let d = resolve(dir);
  const raiz = parsePath(d).root;
  for (;;) {
    for (const marca of ["CLAUDE.md", "CLAUDE.local.md", ".claude"]) { if (marca === ".claude" && casa && resolve(d).toLowerCase() === resolve(casa).toLowerCase()) continue; if (existe(join(d, marca))) problemas.push(join(d, marca)); }
    if (d === raiz) break;
    d = dirname(d);
  }
  return { aislada: problemas.length === 0, problemas };
}
export function crearCarpetaDeTrabajo(base = null) {
  const raiz = base || tmpdir();
  mkdirSync(raiz, { recursive: true });
  return mkdtempSync(join(raiz, "adi-anfitrion-"));
}

/** armarComandoCli({...}) → { bin, args, cwd, env, mcpConfig, systemPrompt } · PURO (no escribe ni lanza nada). */
export function armarComandoCli({ claudeBin = "claude", modelo, dirTrabajo, rutaMcpConfig, rutaSystemPrompt = null, modoPrompt = "texto", restringido = false, settingSources = "project", baseEnv = process.env, conservarBaseUrl = false, mcp }) {
  if (!modelo) throw new Error("armarComandoCli: falta --modelo (el modelo es fijo en toda la corrida)");
  const permitidas = nombresMcpDelCli();
  const args = [
    "-p",
    "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
    "--model", modelo,
    modoPrompt === "archivo" ? "--system-prompt-file" : "--system-prompt", modoPrompt === "archivo" ? rutaSystemPrompt : INSTRUCCION_DE_SISTEMA,
    "--tools", "",
    "--mcp-config", rutaMcpConfig, "--strict-mcp-config",
    "--allowedTools", permitidas.join(","),
    "--permission-prompts", "none",
    "--setting-sources", settingSources,
    "--disable-slash-commands",
    "--no-session-persistence",
  ];
  if (restringido) args.push("--restricted");
  const { env, quitadas } = entornoDelCli(baseEnv, { conservarBaseUrl });
  const [bin, argv] = _comoEjecutable(claudeBin, args);
  const mcpConfig = { mcpServers: { [NOMBRE_DEL_SERVIDOR_MCP]: { type: "stdio", command: process.execPath, args: ["--import", GUARDA_OFFLINE, RUTA_MCP_ADI, `--estado=${mcp.estado}`, `--empresa=${mcp.empresa}`, `--salida-estado=${mcp.salidaEstado}`, `--bitacora=${mcp.bitacora}`], env: {} } } };
  return { bin, args: argv, cwd: dirTrabajo, env, quitadas, mcpConfig, systemPrompt: INSTRUCCION_DE_SISTEMA };
}

/** formatearComando(cmd) → texto copiable (PowerShell/bash) para `--solo-imprimir`. */
export function formatearComando(cmd) {
  const q = (s) => (s === "" ? '""' : /[\s"'$`&|<>(){};]/.test(s) ? `"${String(s).replace(/"/g, '\\"')}"` : s);
  return [cmd.bin, ...cmd.args].map(q).join(" ");
}

/* ── el análisis de un turno a partir de los eventos stream-json ──────────────────────────────────────────────────── */
export function analizarTurnoStream(eventos) {
  const mensajes = new Map();       // message.id → { bloques[], usage }
  const orden = [];
  const resultados = [];
  let result = null;
  for (const e of eventos) {
    if (!e || typeof e !== "object") continue;
    if (e.type === "assistant" && e.message) {
      const id = e.message.id || `anon${orden.length}`;
      if (!mensajes.has(id)) { mensajes.set(id, { bloques: [], usage: null }); orden.push(id); }
      const m = mensajes.get(id);
      for (const b of (Array.isArray(e.message.content) ? e.message.content : [])) m.bloques.push(b);
      if (e.message.usage) m.usage = e.message.usage;
    } else if (e.type === "user" && e.message && Array.isArray(e.message.content)) {
      for (const b of e.message.content) if (b && b.type === "tool_result") resultados.push(b);
    } else if (e.type === "result") result = e;
  }
  const textos = [], usos = [], llamadasHerramienta = [];
  for (const id of orden) {
    const m = mensajes.get(id);
    for (const b of m.bloques) {
      if (b.type === "text" && String(b.text || "").trim()) textos.push(b.text);
      if (b.type === "tool_use") llamadasHerramienta.push({ nombre: b.name, args: b.input || {}, id: b.id });
    }
    if (m.usage) usos.push(m.usage);
  }
  const suma = (k) => usos.reduce((s, u) => s + (Number(u[k]) || 0), 0);
  return {
    texto: textos.join("\n\n"),
    textoFinal: result && typeof result.result === "string" && result.result.trim() ? result.result : (textos[textos.length - 1] || ""),
    llamadasHerramienta,
    llamadasAlModelo: orden.length,
    uso: { input_tokens: suma("input_tokens"), output_tokens: suma("output_tokens"), cache_read_input_tokens: suma("cache_read_input_tokens"), cache_creation_input_tokens: suma("cache_creation_input_tokens") },
    result: result ? { subtype: result.subtype || null, is_error: Boolean(result.is_error), num_turns: result.num_turns ?? null, total_cost_usd: result.total_cost_usd ?? null, duration_ms: result.duration_ms ?? null } : null,
    terminoBien: Boolean(result) && !result.is_error,
  };
}

/** abrirSesionCli({ cmd, bitacora, rutaStream, timeoutTurnoMs }) → { turno(texto), cerrar(), eventos, enviados, pid }
 * Lanza el proceso `claude -p` de ESTA sesión y le va mandando los turnos por stdin (stream-json). */
export function abrirSesionCli({ cmd, bitacora, rutaStream, timeoutTurnoMs = 300000, maxLlamadasPorTurno = 16 }) {
  mkdirSync(dirname(bitacora), { recursive: true });
  mkdirSync(cmd.cwd, { recursive: true });
  const proc = spawn(cmd.bin, cmd.args, { cwd: cmd.cwd, env: cmd.env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const todos = [];                         // todos los eventos de la sesión (para el chequeo de limpieza)
  let pendiente = [];                       // eventos del turno en curso
  let resolverTurno = null;
  let buffer = "";
  let errores = "";
  let cerrado = false, salida = null;
  const enviados = [];
  proc.stdout.setEncoding("utf8");
  proc.stdout.on("data", (chunk) => {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf("\n")) >= 0) {
      const linea = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1);
      if (!linea) continue;
      let ev; try { ev = JSON.parse(linea); } catch { continue; }
      todos.push(ev); pendiente.push(ev);
      try { appendFileSync(rutaStream, linea + "\n"); } catch { /* el stream crudo es evidencia, no control de flujo */ }
      if (ev.type === "result" && resolverTurno) { const r = resolverTurno; resolverTurno = null; r({ eventos: pendiente }); pendiente = []; }
    }
  });
  proc.stderr.setEncoding("utf8");
  proc.stderr.on("data", (c) => { errores += c; });
  proc.on("close", (codigo) => { cerrado = true; salida = codigo; if (resolverTurno) { const r = resolverTurno; resolverTurno = null; r({ eventos: pendiente, cerro: true }); } });
  proc.on("error", (e) => { cerrado = true; errores += `\n[spawn] ${e.message}`; if (resolverTurno) { const r = resolverTurno; resolverTurno = null; r({ eventos: pendiente, cerro: true }); } });

  function turno(texto) {
    return new Promise((res) => {
      if (cerrado) { res({ eventos: [], cerro: true, motivo: "el proceso del anfitrión ya terminó" }); return; }
      enviados.push(texto);
      pendiente = [];
      const timer = setTimeout(() => { if (resolverTurno) { const r = resolverTurno; resolverTurno = null; try { proc.kill(); } catch { /* ya terminó */ } r({ eventos: pendiente, timeout: true }); } }, timeoutTurnoMs);
      resolverTurno = (x) => { clearTimeout(timer); res(x); };
      proc.stdin.write(JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text: texto }] } }) + "\n");
    });
  }
  async function cerrar() {
    if (!cerrado) { try { proc.stdin.end(); } catch { /* ya cerrado */ } await new Promise((r) => { const t = setTimeout(() => { try { proc.kill(); } catch { /* */ } r(); }, 8000); proc.on("close", () => { clearTimeout(t); r(); }); }); }
    return { codigo: salida, stderr: errores.slice(-2000) };
  }
  return { turno, cerrar, eventos: () => todos, enviados: () => enviados, pid: proc.pid, maxLlamadasPorTurno };
}

/** lineasNuevasDeBitacora(ruta, desde) → { lineas[], total } · lo que la puerta atendió desde la línea `desde` (exacto: el rastreo lee de acá). */
export function lineasNuevasDeBitacora(ruta, desde = 0) {
  if (!existsSync(ruta)) return { lineas: [], total: 0 };
  const todas = readFileSync(ruta, "utf8").split("\n").filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  return { lineas: todas.slice(desde), total: todas.length };
}
