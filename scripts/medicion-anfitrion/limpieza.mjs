/* === scripts/medicion-anfitrion/limpieza.mjs · EL CHEQUEO DE LIMPIEZA DE LA VÍA CLI (anula la corrida) ═════════════
 * La vía A (`claude -p` sin `--bare`, porque `--bare` no lee la suscripción) deja residuos que el CLI no deja quitar:
 * los system reminders de Claude Code y lo que cargue el nivel de usuario. Lo que SÍ se puede hacer es DETECTAR si
 * entró algo ajeno a las cuatro acciones de ADI, y si entró, ANULAR la corrida: lo que se mide es la prosa de un anfitrión
 * que solo tiene a ADI, no la de un agente de código con herramientas y memoria.
 *
 * Es una función PURA sobre los eventos `stream-json` de la sesión (nunca llama a nadie). Una corrida está LIMPIA cuando:
 *   1 · las herramientas que declara el `init` son EXACTAMENTE las cuatro de ADI (`mcp__adi__*`) — ni `Bash`, ni `Read`,
 *       ni `ToolSearch`, ni nada más;
 *   2 · el único servidor MCP conectado es `adi`;
 *   3 · no hay skills, agentes ni plugins cargados (son instrucciones ajenas);
 *   4 · ningún `tool_use` del modelo llama a algo que no sea una de las cuatro acciones;
 *   5 · ningún mensaje de usuario trae texto que el arnés no mandó (system reminders, CLAUDE.md, memoria, hooks);
 *   6 · ningún evento de hook;
 *   7 · la carpeta de trabajo es la carpeta VACÍA del arnés;
 *   8 · el modelo del `init` es el pedido (un cambio de modelo invalida).
 * Cada hallazgo dice qué regla rompió y con qué evidencia. Una sola infracción anula la corrida. */
import { nombresMcpDelCli } from "./instruccion.mjs";

const _blocks = (m) => (m && Array.isArray(m.content) ? m.content : (m && typeof m.content === "string" ? [{ type: "text", text: m.content }] : []));
const _AJENO = /<system-reminder>|claudeMd|CLAUDE\.md|# auto memory|MEMORY\.md|<command-name>|<local-command|skill listing|The following skills are available/i;

/** chequearLimpieza({ eventos, enviados, modelo, dirTrabajo }) → { limpia, hallazgos[], residuos }
 *   enviados: los textos de usuario que el ARNÉS mandó en la sesión (lo único permitido como texto de usuario) */
export function chequearLimpieza({ eventos = [], enviados = [], modelo = null, dirTrabajo = null } = {}) {
  const hallazgos = [];
  const h = (regla, detalle) => hallazgos.push({ regla, detalle });
  const permitidas = new Set(nombresMcpDelCli());
  const enviadosSet = new Set(enviados.map((t) => String(t).trim()));
  const init = eventos.find((e) => e && e.type === "system" && e.subtype === "init");

  if (!init) h("sin_init", "la sesión no trajo el evento `system/init`: no se puede verificar qué herramientas tenía el anfitrión");
  else {
    const tools = Array.isArray(init.tools) ? init.tools.map((t) => (typeof t === "string" ? t : t && t.name)) : [];
    const ajenas = tools.filter((t) => !permitidas.has(t));
    const faltan = [...permitidas].filter((t) => !tools.includes(t));
    if (ajenas.length) h("herramienta_ajena_en_init", `el anfitrión tenía herramientas que no son de ADI: ${ajenas.join(", ")}`);
    if (faltan.length) h("herramienta_de_adi_ausente", `faltan acciones de ADI en el init: ${faltan.join(", ")}`);
    const servidores = Array.isArray(init.mcp_servers) ? init.mcp_servers : [];
    const otros = servidores.filter((s) => (s && s.name) !== "adi");
    if (otros.length) h("servidor_mcp_ajeno", `servidores MCP que no son ADI: ${otros.map((s) => s.name).join(", ")}`);
    const adi = servidores.find((s) => s && s.name === "adi");
    if (!adi) h("adi_no_conectado", "el servidor MCP «adi» no figura en el init");
    else if (adi.status && adi.status !== "connected") h("adi_no_conectado", `el servidor «adi» quedó en estado «${adi.status}»`);
    for (const campo of ["skills", "agents", "plugins"]) {
      const v = init[campo];
      const lista = Array.isArray(v) ? v : [];
      if (lista.length) h("instruccion_ajena_en_init", `el init trae ${campo} cargados: ${lista.map((x) => (typeof x === "string" ? x : x && (x.name || x.id))).slice(0, 8).join(", ")}`);
    }
    if (dirTrabajo && init.cwd && String(init.cwd).replace(/[\\/]+$/, "").toLowerCase() !== String(dirTrabajo).replace(/[\\/]+$/, "").toLowerCase()) h("carpeta_distinta", `la carpeta de trabajo del anfitrión es ${init.cwd}, no la vacía del arnés (${dirTrabajo})`);
    // el ensayo va por la SUSCRIPCIÓN del owner: si el CLI declara que autentica con una API key, estaría gastando API (no autorizada)
    if (init.apiKeySource && /ANTHROPIC_API_KEY|apiKeyHelper|api[_ -]?key|\benv\b/i.test(String(init.apiKeySource))) h("gasto_por_api", `el CLI autentica con «${init.apiKeySource}»: el ensayo va por la suscripción, no por API`);
    if (modelo && init.model &&!String(init.model).toLowerCase().includes(String(modelo).toLowerCase().replace(/^claude-/, ""))) h("modelo_distinto", `el init declara el modelo «${init.model}», no «${modelo}»`);
  }

  for (const e of eventos) {
    if (!e || typeof e !== "object") continue;
    if (e.type === "system" && /^hook/i.test(String(e.subtype || ""))) h("hook", `evento de hook en la sesión (${e.subtype})`);
    if (e.type === "assistant") {
      for (const b of _blocks(e.message)) {
        if (b.type === "tool_use" && !permitidas.has(b.name)) h("tool_use_ajeno", `el modelo llamó a «${b.name}», que no es una acción de ADI`);
        if (b.type === "text" && _AJENO.test(String(b.text || ""))) h("texto_ajeno_en_respuesta", "la respuesta del modelo cita instrucciones ajenas (reminders / CLAUDE.md / memoria)");
      }
    }
    if (e.type === "user") {
      for (const b of _blocks(e.message)) {
        if (b.type === "text") {
          const t = String(b.text || "").trim();
          if (_AJENO.test(t)) h("instruccion_ajena", `un mensaje de usuario trae texto ajeno al arnés: «${t.slice(0, 90).replace(/\s+/g, " ")}…»`);
          else if (enviados.length && !enviadosSet.has(t)) h("texto_de_usuario_no_enviado", `un mensaje de usuario trae texto que el arnés no mandó: «${t.slice(0, 90).replace(/\s+/g, " ")}…»`);
        }
        if (b.type === "tool_result" && _AJENO.test(typeof b.content === "string" ? b.content : JSON.stringify(b.content || ""))) h("instruccion_ajena", "un resultado de herramienta trae texto de reminders o de CLAUDE.md");
      }
    }
  }
  // sin duplicados exactos (un mismo hallazgo repetido por cada turno no agrega información)
  const vistos = new Set(); const unicos = [];
  for (const x of hallazgos) { const k = `${x.regla}|${x.detalle}`; if (!vistos.has(k)) { vistos.add(k); unicos.push(x); } }
  return { limpia: unicos.length === 0, hallazgos: unicos, residuos: init ? { herramientas: init.tools || [], mcp_servers: init.mcp_servers || [], slash_commands: init.slash_commands || [], cwd: init.cwd || null, model: init.model || null, permissionMode: init.permissionMode || null, claude_code_version: init.claude_code_version || null, apiKeySource: init.apiKeySource || null } : null };
}
