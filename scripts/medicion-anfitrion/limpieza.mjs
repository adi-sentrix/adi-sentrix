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
 *   4 · ningún `tool_use` del modelo llama a algo que no sea una de las cuatro acciones — SALVO UNA EXCEPCIÓN DECLARADA (owner 2026-10-09, opción A, ensayo 11):
 *       el nombre de una acción de ADI SIN el prefijo del servidor («derivar» en vez de «mcp__adi__derivar») que el CLI rechazó ANTES de ejecutarla
 *       (el `tool_result` de ese `tool_use` es un error «No such tool available») no ejecutó ninguna herramienta ni alteró ningún dato: se registra como
 *       OBSERVACIÓN de la corrida («llamada mal dirigida, rechazada sin ejecutar»), no la anula. Cualquier OTRA herramienta ajena (Bash, Read…) o cualquier
 *       llamada ajena que no se pueda probar rechazada (sin su error en el stream, o ejecutada) sigue anulándola. El anfitrión que después le diga a la persona
 *       que la herramienta «no estaba disponible» comete un error SUYO (no de ADI): la revisión humana lo clasifica como tal (`_ADI_DISENO_MEDICION_ANFITRION.md` §6);
 *   5 · ningún mensaje de usuario trae texto que el arnés no mandó (system reminders, CLAUDE.md, memoria, hooks);
 *   6 · ningún evento de hook;
 *   7 · la carpeta de trabajo es la carpeta VACÍA del arnés;
 *   8 · el modelo del `init` es el pedido (un cambio de modelo invalida).
 * Cada hallazgo dice qué regla rompió y con qué evidencia. Una sola infracción anula la corrida. Las OBSERVACIONES (`observaciones[]`) no anulan: se informan. */
import { nombresMcpDelCli } from "./instruccion.mjs";

const _blocks = (m) => (m && Array.isArray(m.content) ? m.content : (m && typeof m.content === "string" ? [{ type: "text", text: m.content }] : []));
const _AJENO = /<system-reminder>|claudeMd|CLAUDE\.md|# auto memory|MEMORY\.md|<command-name>|<local-command|skill listing|The following skills are available/i;

/** chequearLimpieza({ eventos, enviados, modelo, dirTrabajo }) → { limpia, hallazgos[], residuos }
 *   enviados: los textos de usuario que el ARNÉS mandó en la sesión (lo único permitido como texto de usuario) */
/* residuo declarado por el owner (2026-10-05): plugins incluidos en el CLI que no aportan herramientas, comandos ni habilidades */
export const RESIDUO_ACEPTADO = Object.freeze(["cc-plugin-agents-md", "cc-plugin-plugin-authoring"]);
export const AGENTES_ACEPTADOS = Object.freeze(["claude", "Explore", "general-purpose", "Plan", "statusline-setup"]);
const _NOMBRE_RESIDUO = /agents-md|plugin-authoring|"subagent_type"|"name":"(Agent|Task)"|statusline-setup|general-purpose/i;
/* el nombre desnudo de cada acción de ADI («derivar» para `mcp__adi__derivar`): lo único que puede ser una llamada mal dirigida (y no una herramienta ajena) */
const _PREFIJO = "mcp__adi__";
const _RECHAZO_DEL_CLI = /No such tool available/i;
export function chequearLimpieza({ eventos = [], enviados = [], modelo = null, dirTrabajo = null } = {}) {
  const hallazgos = [];
  const observaciones = [];
  const desnudas = new Set(nombresMcpDelCli().map((n) => n.slice(_PREFIJO.length)));
  /* los `tool_result` por id: con ellos se prueba que una llamada con nombre desnudo fue RECHAZADA por el CLI antes de ejecutarse */
  const resultados = new Map();
  for (const e of eventos) if (e && e.type === "user") for (const b of _blocks(e.message)) if (b && b.type === "tool_result" && b.tool_use_id) resultados.set(b.tool_use_id, b);
  const rechazadaSinEjecutar = (b) => {
    if (!desnudas.has(b.name)) return false;
    const r = resultados.get(b.id);
    return Boolean(r && r.is_error === true && _RECHAZO_DEL_CLI.test(typeof r.content === "string" ? r.content : JSON.stringify(r.content || "")));
  };
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
      let lista = Array.isArray(v) ? v : [];
      /* RESIDUO DECLARADO (owner 2026-10-05): los dos plugins que el CLI trae incluidos («@builtin») se aceptan SOLO mientras no
       * aporten herramientas, comandos ni habilidades. Si el init trae cualquier herramienta que no sea de ADI, algún comando o
       * alguna habilidad, o si cualquiera de los dos aparece en la sesión (ver `_NOMBRE_RESIDUO` abajo), la corrida se anula. */
      if (campo === "plugins") {
        const sinAporte = (init.tools || []).every((t) => String(t).startsWith("mcp__adi__"))   /* los agentes internos se juzgan aparte (AGENTES_ACEPTADOS) */
          && !(Array.isArray(init.slash_commands) && init.slash_commands.length)
          && !(Array.isArray(init.skills) && init.skills.length);
        lista = lista.filter((x) => !(sinAporte && x && RESIDUO_ACEPTADO.includes(x.name) && /@builtin$/.test(String(x.source || ""))));
      }
      /* RESIDUO DECLARADO (owner 2026-10-05): los agentes internos que el CLI lista se aceptan SOLO si no hay herramienta para
       * invocarlos (el init no trae más herramientas que las de ADI). Si alguno interviene en la sesión, `residuo_intervino` anula. */
      if (campo === "agents") {
        const sinHerramientaDeAgentes = (init.tools || []).every((t) => String(t).startsWith("mcp__adi__"));
        lista = lista.filter((x) => !(sinHerramientaDeAgentes && AGENTES_ACEPTADOS.includes(typeof x === "string" ? x : x && x.name)));
      }
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
    /* el residuo declarado NO puede intervenir: cualquier evento posterior al init que lo nombre anula la corrida */
    if (!(e.type === "system" && e.subtype === "init") && _NOMBRE_RESIDUO.test(JSON.stringify(e))) h("residuo_intervino", "un plugin incluido aceptado como residuo (agents-md / plugin-authoring) aparece en la sesión: la corrida se anula");
    if (e.type === "assistant") {
      for (const b of _blocks(e.message)) {
        if (b.type === "tool_use" && !permitidas.has(b.name)) {
          if (rechazadaSinEjecutar(b)) observaciones.push({ regla: "llamada_mal_dirigida", herramienta: b.name, detalle: `el modelo llamó a «${b.name}» sin el prefijo del servidor (${_PREFIJO}${b.name}): el CLI la rechazó antes de ejecutarla («No such tool available») — llamada mal dirigida, rechazada sin ejecutar; no se ejecutó ninguna herramienta ni se alteró ningún dato` });
          else h("tool_use_ajeno", `el modelo llamó a «${b.name}», que no es una acción de ADI`);
        }
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
  /* las observaciones no anulan; se cuentan por herramienta (una entrada por nombre, con cuántas llamadas fueron) */
  const porHerramienta = new Map();
  for (const o of observaciones) { const k = `${o.regla}|${o.herramienta}`; const x = porHerramienta.get(k); if (x) x.llamadas += 1; else porHerramienta.set(k, { ...o, llamadas: 1 }); }
  return { limpia: unicos.length === 0, hallazgos: unicos, observaciones: [...porHerramienta.values()], residuos: init ? { herramientas: init.tools || [], mcp_servers: init.mcp_servers || [], slash_commands: init.slash_commands || [], cwd: init.cwd || null, model: init.model || null, permissionMode: init.permissionMode || null, claude_code_version: init.claude_code_version || null, apiKeySource: init.apiKeySource || null } : null };
}
