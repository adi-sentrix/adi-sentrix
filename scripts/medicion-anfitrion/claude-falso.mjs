/* === scripts/medicion-anfitrion/claude-falso.mjs · UN `claude` FALSO PARA EL CANDADO (0 red, 0 LLM, 0 suscripción) ═════
 * Se pasa al arnés con `--claude-bin=<este archivo>` y habla como `claude -p --input-format stream-json --output-format
 * stream-json`: valida las banderas que el arnés DEBE pasar (si falta una, sale con error — así el candado prueba el comando
 * endurecido), levanta de verdad el servidor MCP del `--mcp-config` (el `mcp-adi.mjs` real, por stdio), emite `system/init`,
 * y por cada mensaje de usuario corre la política simulada (`anfitrion-simulado.mjs`) llamando a las herramientas POR MCP.
 * Variables (solo del candado):
 *   FALSO_MODO          bueno | inventa | cruza | reescribe | dueno | calla_cambio
 *   FALSO_CONTAMINAR    bash (herramienta ajena en el init) · tool_use_ajeno · reminder · skills · otro_servidor · hook
 *   FALSO_REGISTRO      archivo donde anota los argumentos que recibió (para que el candado los lea) */
import { spawn } from "node:child_process";
import { readFileSync, appendFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { siguiente } from "./anfitrion-simulado.mjs";

const argv = process.argv.slice(2);
if (process.env.FALSO_REGISTRO) appendFileSync(process.env.FALSO_REGISTRO, JSON.stringify({ argv, cwd: process.cwd(), env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? "(presente)" : null, OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "(presente)" : null } }) + "\n");
const val = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const tiene = (n) => argv.includes(n);

if (tiene("--bare")) { console.error("claude-falso: --bare no lee el login de la suscripción (exige ANTHROPIC_API_KEY)"); process.exit(3); }
const faltan = [];
if (!tiene("-p")) faltan.push("-p");
if (val("--output-format") !== "stream-json") faltan.push("--output-format stream-json");
if (val("--input-format") !== "stream-json") faltan.push("--input-format stream-json");
if (!tiene("--verbose")) faltan.push("--verbose");
if (!tiene("--strict-mcp-config")) faltan.push("--strict-mcp-config");
if (!tiene("--mcp-config")) faltan.push("--mcp-config");
if (!tiene("--tools") || val("--tools") !== "") faltan.push('--tools ""');
if (!tiene("--setting-sources")) faltan.push("--setting-sources");
if (!tiene("--no-session-persistence")) faltan.push("--no-session-persistence");
if (!tiene("--disable-slash-commands")) faltan.push("--disable-slash-commands");
if (!tiene("--system-prompt") && !tiene("--system-prompt-file")) faltan.push("--system-prompt");
if (!val("--model")) faltan.push("--model");
if (!val("--allowedTools") || !/mcp__adi__consultar/.test(val("--allowedTools"))) faltan.push("--allowedTools mcp__adi__…");
if (faltan.length) { console.error(`claude-falso: faltan banderas del comando endurecido: ${faltan.join(" · ")}`); process.exit(2); }

const config = JSON.parse(readFileSync(val("--mcp-config"), "utf8"));
const srv = config.mcpServers.adi;
const empresaId = (srv.args.find((a) => a.startsWith("--empresa=")) || "").slice(10);
const hijo = spawn(srv.command, srv.args, { stdio: ["pipe", "pipe", "inherit"], env: { ...process.env, ...(srv.env || {}) } });
const pendientes = new Map();
let nid = 0, buf = "";
hijo.stdout.setEncoding("utf8");
hijo.stdout.on("data", (c) => { buf += c; let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!l) continue; const m = JSON.parse(l); const r = pendientes.get(m.id); if (r) { pendientes.delete(m.id); r(m); } } });
const rpc = (method, params) => new Promise((res) => { nid += 1; pendientes.set(nid, res); hijo.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: nid, method, params }) + "\n"); });
const salir = (c = 0) => { try { hijo.stdin.end(); } catch { /* */ } setTimeout(() => process.exit(c), 50); };

const emit = (o) => process.stdout.write(JSON.stringify(o) + "\n");
await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "claude-falso", version: "0" } });
hijo.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
const lista = (await rpc("tools/list", {})).result.tools.map((t) => `mcp__adi__${t.name}`);

const cont = process.env.FALSO_CONTAMINAR || "";
const init = { type: "system", subtype: "init", cwd: process.cwd(), session_id: "sesion-falsa", tools: cont === "bash" ? ["Bash", ...lista] : lista, mcp_servers: [{ name: "adi", status: "connected" }, ...(cont === "otro_servidor" ? [{ name: "otro", status: "connected" }] : [])], model: val("--model"), permissionMode: "default", slash_commands: ["compact"], apiKeySource: process.env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY" : "none", claude_code_version: "falso-0.0.0", skills: cont === "skills" ? ["frontend-design"] : [], agents: [], plugins: [] };
emit(init);
if (cont === "hook") emit({ type: "system", subtype: "hook_started", hook_name: "SessionStart" });
if (cont === "reminder") emit({ type: "user", message: { role: "user", content: [{ type: "text", text: "<system-reminder>As you answer the user's questions, you can use the following context: CLAUDE.md …</system-reminder>" }] } });

let nmsg = 0;
const historial = [];
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
let cola = Promise.resolve();
rl.on("line", (linea) => {
  if (!linea.trim()) return;
  cola = cola.then(async () => {
    const msg = JSON.parse(linea);
    const persona = (msg.message.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const delTurno = [];
    for (let ronda = 0; ronda < 8; ronda++) {
      const s = siguiente({ modo: process.env.FALSO_MODO || "bueno", empresaId, persona, historialDelHilo: historial, resultadosDelTurno: delTurno });
      nmsg += 1;
      const usage = { input_tokens: 40 + ronda, output_tokens: 90, cache_read_input_tokens: 300, cache_creation_input_tokens: ronda ? 0 : 500 };
      if (s.llamadas) {
        const bloques = s.llamadas.map((l, k) => ({ type: "tool_use", id: `tu_${nmsg}_${k}`, name: cont === "tool_use_ajeno" ? "Bash" : `mcp__adi__${l.nombre}`, input: l.args }));
        emit({ type: "assistant", message: { id: `m_${nmsg}`, role: "assistant", content: bloques, usage } });
        const resultados = [];
        for (let k = 0; k < s.llamadas.length; k++) {
          const l = s.llamadas[k];
          const r = await rpc("tools/call", { name: l.nombre, arguments: l.args });
          const resultado = JSON.parse(r.result.content[0].text);
          delTurno.push({ herramienta: l.nombre, args: l.args, resultado });
          resultados.push({ type: "tool_result", tool_use_id: bloques[k].id, content: r.result.content[0].text });
        }
        emit({ type: "user", message: { role: "user", content: resultados } });
        continue;
      }
      emit({ type: "assistant", message: { id: `m_${nmsg}`, role: "assistant", content: [{ type: "text", text: s.texto }], usage } });
      emit({ type: "result", subtype: "success", is_error: false, result: s.texto, num_turns: ronda + 1, total_cost_usd: 0, duration_ms: 10, usage });
      break;
    }
    historial.push(...delTurno);
  });
});
rl.on("close", () => { cola.then(() => salir(0)); });
