/* === scripts/medicion-anfitrion/arnes.mjs · EL ARNÉS DE LA MEDICIÓN CON ANFITRIÓN (cierre de la Etapa 2) ═════════════
 * Diseño `_ADI_DISENO_MEDICION_ANFITRION.md` §4 y §8. Un anfitrión (un modelo capaz con SOLO las cuatro acciones de ADI) conversa
 * con una persona simulada por el corpus del autor ciego, hilo a hilo, con cortes, retomas y datos que cambian; el arnés guarda
 * el transcrito completo y, al final, el rastreo determinista + el informe. Dos vías:
 *
 *   --via=cli   ENSAYO con la suscripción del owner: `claude -p` endurecido (ver `anfitrion-cli.mjs`) + chequeo de limpieza.
 *               Sin gasto de API (se le quitan al hijo todas las credenciales de API) · tope en LLAMADAS (--tope-llamadas).
 *   --via=api   MEDICIÓN OFICIAL por la Messages API (`cliente-api.mjs`) con `claude-sonnet-5-5`: `ADI_EXIGIR_CONTADOR=1` +
 *               contador propio con TOPE DURO en US$ revisado ANTES de cada llamada (`contador.mjs`). Techos de la autorización
 *               del owner: US$ 40 por corrida y US$ 80 en total. El juez (otra familia) va detrás de `--juez` y cuenta en el mismo tope.
 *
 *   --tipo=ensayo|oficial   el ensayo es SIEMPRE cli; la oficial es SIEMPRE api (el ensayo NO tiene API autorizada)
 *   --solo-imprimir         muestra el comando de `claude -p` y los archivos que armaría, SIN ejecutar nada
 *
 *   --brazo=A|B   el BRAZO del A/B (`_ADI_DISENO_ALCANCE_DE_LO_ENTREGADO.md` §6.2): A = la entrega de hoy (ADI_ALCANCE_ESTRUCTURAL=0) · B = alcance estructural (=1, por defecto). La variable va SOLO al
 *                 entorno del servidor de ADI (bloque `env` del --mcp-config en la vía cli; el `env` de la puerta en la vía api) y se QUITA del entorno del anfitrión. Una corrida es de UN brazo: no se mezclan.
 *   --serie-ab=<nombre> --brazo=A|B --repeticion=1|2   el experimento pareado: el MISMO corpus sellado, cuatro corridas (A·1, A·2, B·1, B·2). La primera quema el sello y deja `SERIE-AB.json` junto a él;
 *                 las demás lo abren sin --reanudar solo si son de ESA serie y ESE corpus, no son la quinta y el código no cambió (ver `serie-ab.mjs`). Fuera de una serie, un corpus usado no se abre.
 *
 * NADA de este archivo corre solo: lo lanza una persona (el supervisor). El candado `_medicion_anfitrion_gate.mjs` lo ejercita con
 * un anfitrión simulado (transporte falso / `claude-falso.mjs`), sin red.
 *
 *   node scripts/medicion-anfitrion/arnes.mjs --via=cli --tipo=ensayo --catalogo=<corpus.json> --sello=<SELLO.json> \
 *        --modelo=claude-sonnet-5-5 --salida=<dir> --tope-llamadas=900 [--hilo=A01,B02] [--solo-imprimir] [--reanudar]
 *   node scripts/medicion-anfitrion/arnes.mjs --via=api --tipo=oficial --catalogo=<corpus.json> --sello=<SELLO.json> \
 *        --modelo=claude-sonnet-5-5 --salida=<dir> --tope-usd=40 [--tope-total-usd=80 --libro-gasto=<f>] [--juez] [--reanudar]     (ADI_EXIGIR_CONTADOR=1) */
import * as fs from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { leerCorpus, validarCorpus, verificarSello, quemarSello } from "./sellar.mjs";
import { crearEstadoInicial, cambiarVersion, abrirAlmacen } from "./almacen-medicion.mjs";
import { crearPuertaMcp } from "./mcp-puerta.mjs";
import { INSTRUCCION_DE_SISTEMA, PREAMBULO_DE_RETOMA, textoDelTurno, huellaDeInstruccion, huellaDeHerramientas, huellaDelPreambulo, herramientasParaApi, sha256 } from "./instruccion.mjs";
import { crearContador, PRECIOS, TECHO_AUTORIZADO, leerLibroDeGasto, anotarEnLibro, peorCasoUsd } from "./contador.mjs";
import { crearClienteApi } from "./cliente-api.mjs";
import { armarComandoCli, formatearComando, localizarClaude, versionDelCli, carpetaAislada, crearCarpetaDeTrabajo, abrirSesionCli, analizarTurnoStream, lineasNuevasDeBitacora, entornoDelCli } from "./anfitrion-cli.mjs";
import { chequearLimpieza } from "./limpieza.mjs";
import { escribirInforme } from "./informe.mjs";
import { juzgarTurno, juezPorOpenAi, MODELO_DEL_JUEZ, huellaDelJuez } from "./juez.mjs";
import { VARIABLE_DEL_BRAZO, BRAZO_POR_DEFECTO, normalizarBrazo, valorDelBrazo, descripcionDelBrazo } from "./brazo.mjs";
import { REPETICIONES_VALIDAS, rutaDeLaSerie, leerSerie, nuevaSerie, autorizarCorrida, registrarCorrida, marcaDeLaSerie } from "./serie-ab.mjs";
import { abrirCorridaMedida } from "../../src/adi/llm/corridaMedida.js";
import { exigirContador } from "../../src/adi/llm/exigirContador.js";
import { emit } from "../../src/adi/llm/telemetry.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");
export const MAX_RONDAS_POR_TURNO = 8;

/* ── argumentos ───────────────────────────────────────────────────────────────────────────────────────────────── */
export function parsearArgs(argv) {
  const a = {};
  for (const x of argv) { if (!x.startsWith("--")) continue; const [k, ...r] = x.slice(2).split("="); a[k] = r.length ? r.join("=") : true; }
  return a;
}

/** validarArgs(a, env) → errores[] · TODO lo que se puede rechazar SIN leer el catálogo (y sin gastar). */
export function validarArgs(a, env) {
  const e = [];
  const via = a.via, tipo = a.tipo || "ensayo";
  if (!["api", "cli"].includes(via)) e.push("falta --via=cli|api");
  if (!["ensayo", "oficial"].includes(tipo)) e.push("--tipo debe ser ensayo|oficial");
  if (tipo === "ensayo" && via === "api") e.push("el ENSAYO no tiene API autorizada: va por --via=cli (la suscripción). La API es solo para las dos mediciones oficiales");
  if (tipo === "oficial" && via === "cli") e.push("las mediciones OFICIALES van por --via=api (decisión del owner 2026-10-05: lo que se sella tiene que ser repetible y verificable)");
  if (!a["solo-imprimir"]) {
    for (const k of ["catalogo", "modelo", "salida"]) if (!a[k] || a[k] === true) e.push(`falta --${k}`);
  }
  if (via === "api") {
    if (!(Number(a["tope-usd"]) > 0)) e.push("falta --tope-usd (el tope duro en US$ es obligatorio y no tiene valor por defecto)");
    else if (Number(a["tope-usd"]) > TECHO_AUTORIZADO.porCorridaUsd) e.push(`--tope-usd ${a["tope-usd"]} supera lo autorizado por el owner (US$ ${TECHO_AUTORIZADO.porCorridaUsd} por corrida)`);
    if (String(env.ADI_EXIGIR_CONTADOR) !== "1") e.push("la vía api exige ADI_EXIGIR_CONTADOR=1 en el entorno del arnés (sin contador no hay gasto)");
    if (!(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN)) e.push("no hay proveedor configurado (ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN): la vía api no puede llamar al modelo");
    if (a.modelo && a.modelo !== true && !Object.prototype.hasOwnProperty.call(PRECIOS, a.modelo)) e.push(`el modelo «${a.modelo}» no tiene precio en el contador: un modelo sin precio no se puede acotar ni medir`);
  }
  if (a.brazo !== undefined && normalizarBrazo(a.brazo) == null) e.push("--brazo debe ser A o B (A = la entrega de hoy, B = alcance estructural; por defecto B)");
  if (a["serie-ab"] !== undefined) {
    if (a["serie-ab"] === true || !String(a["serie-ab"]).trim()) e.push("--serie-ab necesita un nombre (--serie-ab=<nombre>)");
    if (normalizarBrazo(a.brazo) == null) e.push("--serie-ab exige --brazo=A|B explícito (en una serie cada celda se declara; el valor por defecto no vale)");
    if (!REPETICIONES_VALIDAS.includes(Number(a.repeticion))) e.push("--serie-ab exige --repeticion=1|2");
    if (!a["solo-imprimir"] && (!a.sello || a.sello === true)) e.push("--serie-ab exige --sello=<SELLO.json> (la serie vive junto al sello del corpus)");
  } else if (a.repeticion !== undefined) e.push("--repeticion solo existe dentro de una serie A/B (--serie-ab=<nombre>)");
  if (via === "cli" && !a["solo-imprimir"] && !(Number(a["tope-llamadas"]) > 0)) e.push("falta --tope-llamadas (en la vía cli el freno es de llamadas, no de dólares; es obligatorio)");
  return e;
}

/** huellaDelCodigo() → sha256 de todo el código que puede cambiar lo medido: `src/` y los .mjs del arnés (NO su salida). */
export function huellaDelCodigo() {
  const h = createHash("sha256");
  const walk = (d, recursivo, filtro) => {
    for (const n of fs.readdirSync(d).sort()) {
      if (n === "node_modules") continue;
      const p = join(d, n); const st = fs.statSync(p);
      if (st.isDirectory()) { if (recursivo) walk(p, recursivo, filtro); }
      else if (filtro.test(n)) { h.update(relative(RAIZ, p).replace(/\\/g, "/")); h.update(fs.readFileSync(p)); }
    }
  };
  walk(join(RAIZ, "src"), true, /\.(m?js|jsx)$/);
  walk(AQUI, false, /\.mjs$/);
  return h.digest("hex");
}

/* ── --solo-imprimir ──────────────────────────────────────────────────────────────────────────────────────────── */
export function imprimirEnsayo(a, deps = {}) {
  const env = deps.env || process.env;
  const claudeBin = a["claude-bin"] || localizarClaude({ env });
  const modelo = a.modelo && a.modelo !== true ? a.modelo : "<modelo>";
  const salida = a.salida && a.salida !== true ? a.salida : "<salida>";
  const cmd = armarComandoCli({
    claudeBin, modelo, dirTrabajo: "<carpeta-de-trabajo-vacia-fuera-del-repo>", rutaMcpConfig: `${salida}/sesiones/<hilo>_s<k>/mcp-config.json`,
    rutaSystemPrompt: `${salida}/sesiones/<hilo>_s<k>/system-prompt.txt`, modoPrompt: a["prompt-modo"] === "archivo" ? "archivo" : "texto", restringido: Boolean(a.restringido), conservarBaseUrl: Boolean(a["conservar-base-url"]),
    baseEnv: env, brazo: normalizarBrazo(a.brazo) || BRAZO_POR_DEFECTO, mcp: { arranque: `${salida}/sesiones/<hilo>_s<k>/arranque.json`, estado: `${salida}/sesiones/<hilo>_s<k>/estado-in.json`, empresa: "<demo|rioclaro>", salidaEstado: `${salida}/sesiones/<hilo>_s<k>/estado-out.json`, bitacora: `${salida}/sesiones/<hilo>_s<k>/bitacora.jsonl` },
  });
  const L = [];
  L.push("── ENSAYO (vía cli) · LO QUE EL ARNÉS EJECUTARÍA — NO SE EJECUTÓ NADA ──");
  L.push("", "1) por CADA SESIÓN de CADA hilo (un corte = un proceso nuevo, sin contexto), en la carpeta de trabajo vacía:", "", formatearComando(cmd));
  L.push("", "   (cada turno de la persona entra por stdin, uno por línea:)", '   {"type":"user","message":{"role":"user","content":[{"type":"text","text":"<turno de la persona>"}]}}');
  L.push("", "2) el --mcp-config de la sesión:", JSON.stringify(cmd.mcpConfig, null, 2));
  L.push("", "3) instrucción de sistema (congelada, hash " + huellaDeInstruccion().slice(0, 16) + "…):", `   ${INSTRUCCION_DE_SISTEMA}`);
  L.push("", "4) tras un corte, el primer turno de la sesión lleva ESTE preámbulo (hash " + huellaDelPreambulo().slice(0, 16) + "…):", `   ${PREAMBULO_DE_RETOMA}`);
  L.push("", `5) variables QUITADAS del entorno del hijo (para que use la suscripción y no gaste API): ${cmd.quitadas.length ? cmd.quitadas.join(", ") : "(ninguna estaba presente)"}`);
  L.push("   puestas (best-effort, el chequeo de limpieza es la garantía): " + ["CLAUDE_CODE_DISABLE_AUTO_MEMORY", "DISABLE_AUTOUPDATER", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "CLAUDE_CODE_DISABLE_CLAUDE_MDS"].join(", "));
  L.push("", "6) chequeo de limpieza (limpieza.mjs): si el stream muestra CUALQUIER herramienta o instrucción ajena a las 4 acciones de ADI, la corrida se ANULA. Única excepción (observación, no anula): el nombre de una acción de ADI sin su prefijo que el CLI rechazó sin ejecutar.");
  L.push("   ⚠️ `--system-prompt-file` NO figura en `claude --help` 2.1.286 (solo `--system-prompt`): por eso el comando usa `--system-prompt` con el texto. `--prompt-modo=archivo` lo cambia.");
  const brazoImp = normalizarBrazo(a.brazo) || BRAZO_POR_DEFECTO;
  L.push("", `7) BRAZO del A/B: ${brazoImp}${normalizarBrazo(a.brazo) ? "" : " (por defecto)"} → ${VARIABLE_DEL_BRAZO}=${valorDelBrazo(brazoImp)} SOLO en el \`env\` del servidor «adi» del --mcp-config (el entorno del anfitrión no lo lleva)${a["serie-ab"] ? ` · serie A/B «${a["serie-ab"]}», repetición ${a.repeticion}` : ""}`);
  L.push(`   claude: ${claudeBin}${deps.version ? ` · versión ${deps.version}` : ""}`);
  return { codigo: 0, comando: formatearComando(cmd), cmd, texto: L.join("\n") };
}

/* ── piezas comunes ───────────────────────────────────────────────────────────────────────────────────────────── */
function planearUnidades(hilos) {
  const vistos = new Set(); const unidades = [];
  for (const h of hilos) {
    if (vistos.has(h.id)) continue;
    if (h.grupo) { const g = hilos.filter((x) => x.grupo === h.grupo); g.forEach((x) => vistos.add(x.id)); unidades.push({ hilos: g, grupo: h.grupo }); }
    else { vistos.add(h.id); unidades.push({ hilos: [h], grupo: null }); }
  }
  return unidades;
}
const _convIdDe = (resultado) => (resultado && (resultado.conversacionId || (resultado.continuidad && resultado.continuidad.conversacionId))) || null;
const _suma = (a, b) => { for (const k of Object.keys(b)) a[k] = (a[k] || 0) + (Number(b[k]) || 0); return a; };
const _escribir = (ruta, obj) => { fs.mkdirSync(dirname(ruta), { recursive: true }); fs.writeFileSync(ruta, typeof obj === "string" ? obj : JSON.stringify(obj, null, 2)); };
const _turnosDe = (h) => h.sesiones.reduce((s, x) => s + x.turnos.length, 0);

async function _huellas(ent, empresaId, convId) {
  if (!convId) return null;
  try { return await ent.leerHuellas(empresaId, convId); } catch { return null; }
}

/* ── VÍA API ──────────────────────────────────────────────────────────────────────────────────────────────────── */
async function turnoApi(S, ctx) {
  const { h } = S;
  const ses = h.sesiones[S.sesIdx];
  const def = ses.turnos[S.turnoIdx];
  const textoEnviado = textoDelTurno({ persona: def.persona, conversacionIdPrevia: S.turnoIdx === 0 && S.sesIdx > 0 ? S.convId : null });
  S.messages.push({ role: "user", content: textoEnviado });
  const llamadas = [], textos = [], uso = {}, cuerpos = [];
  let nModelo = 0, costo = 0, cierre = "ok", motivo = null, modeloEfectivo = null;
  for (let ronda = 0; ronda < MAX_RONDAS_POR_TURNO; ronda++) {
    const r = await ctx.cliente.llamar({ system: INSTRUCCION_DE_SISTEMA, tools: ctx.tools, messages: S.messages });
    if (!r.ok) { cierre = r.parado ? "tope" : "error_api"; motivo = r.motivo; break; }
    nModelo += 1; costo += r.costoUsd || 0; cuerpos.push(r.cuerpoHash); modeloEfectivo = r.modeloEfectivo;
    if (r.uso) _suma(uso, { input_tokens: r.uso.input_tokens, output_tokens: r.uso.output_tokens, cache_read_input_tokens: r.uso.cache_read_input_tokens, cache_creation_input_tokens: r.uso.cache_creation_input_tokens });
    S.messages.push({ role: "assistant", content: r.content });
    for (const b of r.content) if (b.type === "text" && b.text.trim()) textos.push(b.text);
    const usos = r.content.filter((b) => b.type === "tool_use");
    if (!usos.length) { if (r.stop_reason === "max_tokens") cierre = "max_tokens"; break; }
    const resultados = [];
    for (const u of usos) {
      const t0 = Date.now();
      const x = await S.puerta.llamarHerramienta(u.name, u.input || {});
      llamadas.push({ herramienta: u.name, args: u.input || {}, resultado: x.resultado, ms: Date.now() - t0 });
      const cid = _convIdDe(x.resultado); if (cid) S.convId = cid;
      resultados.push({ type: "tool_result", tool_use_id: u.id, content: x.content[0].text, ...(x.isError ? { is_error: true } : {}) });
    }
    S.messages.push({ role: "user", content: resultados });
    if (ronda === MAX_RONDAS_POR_TURNO - 1) { cierre = "max_rondas"; motivo = "el anfitrión no cerró el turno en el máximo de rondas de herramientas"; }
  }
  return {
    sesion: S.sesIdx + 1, turno: S.turnoIdx + 1, persona: def.persona, textoEnviado, espera: def.espera,
    llamadas, texto: textos.join("\n\n"), textoFinal: textos[textos.length - 1] || "", uso, llamadasAlModelo: nModelo, costoUsd: Number(costo.toFixed(6)),
    conversacionId: S.convId, huellas: cierre === "tope" || cierre === "error_api" ? null : await _huellas(S.ent, h.empresa, S.convId),
    cierre, motivo, brazo: ctx.brazo || null, hashes: { modelo: modeloEfectivo, instruccion: huellaDeInstruccion(), herramientas: huellaDeHerramientas(), cuerpos },
  };
}

async function abrirSesionApi(S, ctx, estadoJson) {
  S.ent = await abrirAlmacen({ estadoJson });
  S.puerta = crearPuertaMcp({ almacen: S.ent, empresaId: S.h.empresa, alcanceEstructural: ctx.brazo ? valorDelBrazo(ctx.brazo) : null });
  S.messages = [];
}

async function correrUnidadApi(unidad, ctx) {
  const estados = Object.fromEntries(unidad.hilos.map((h) => [h.empresa, h.sesiones[0].version]));
  let estado = crearEstadoInicial({ versiones: estados });
  // una unidad de grupo comparte UN almacén y UNA puerta (los hilos de empresas distintas corren intercalados en el MISMO proceso)
  const compartido = unidad.grupo ? await abrirAlmacen({ estadoJson: estado }) : null;
  const S = unidad.hilos.map((h) => ({ h, sesIdx: 0, turnoIdx: 0, convId: null, messages: [], ent: compartido, puerta: null, turnos: [], hecho: false, cortes: [] }));
  for (const s of S) {
    if (compartido) s.puerta = crearPuertaMcp({ almacen: compartido, empresaId: s.h.empresa, alcanceEstructural: ctx.brazo ? valorDelBrazo(ctx.brazo) : null });
    else await abrirSesionApi(s, ctx, estado);
  }
  while (S.some((s) => !s.hecho)) {
    for (const s of S) {
      if (s.hecho) continue;
      const t = await turnoApi(s, ctx);
      s.turnos.push(t);
      ctx.turnosHechos += t.cierre === "tope" || t.cierre === "error_api" ? 0 : 1;
      if (t.cierre === "tope") { ctx.parada = { motivo: "tope_alcanzado", detalle: t.motivo }; s.incompleto = true; s.hecho = true; continue; }
      if (t.cierre === "error_api") { s.incompleto = true; s.hecho = true; s.error = t.motivo; continue; }
      s.turnoIdx += 1;
      if (s.turnoIdx >= s.h.sesiones[s.sesIdx].turnos.length) {
        if (s.sesIdx + 1 >= s.h.sesiones.length) { s.hecho = true; continue; }
        // ── EL CORTE: contexto nuevo del anfitrión, misma empresa, otra versión de carga si el hilo lo pide
        const corteJson = s.ent.exportar();
        _escribir(join(ctx.salida, "estados", `${s.h.id}_corte${s.sesIdx + 1}.json`), corteJson);
        const sig = s.h.sesiones[s.sesIdx + 1];
        const actual = JSON.parse(corteJson).tenants.find((x) => x.id === s.h.empresa);
        estado = actual && actual.version !== sig.version ? cambiarVersion(corteJson, { empresaId: s.h.empresa, version: sig.version }) : corteJson;
        s.sesIdx += 1; s.turnoIdx = 0;
        await abrirSesionApi(s, ctx, estado);
      }
    }
    if (ctx.parada) break;
  }
  return S;
}

/** contrastarArranque(ctx, ruta, hilo, sesion) → { ok, motivo? } · el servidor de ADI dejó su arranque: el brazo que vio TIENE que ser el de la corrida (si no, A y B se mezclarían sin que nadie lo notara). Se anota en ctx.servidores. */
function contrastarArranque(ctx, ruta, hilo, sesion) {
  if (!ctx.brazo) return { ok: true };
  let arr = null;
  try { arr = JSON.parse(fs.readFileSync(ruta, "utf8")); } catch { arr = null; }
  const esperado = valorDelBrazo(ctx.brazo);
  if (!ctx.servidores.some((x) => x.hilo === hilo && x.sesion === sesion)) ctx.servidores.push({ hilo, sesion, esperado, visto: arr ? arr[VARIABLE_DEL_BRAZO] ?? null : "(sin arranque.json)", ok: Boolean(arr) && arr[VARIABLE_DEL_BRAZO] === esperado });
  if (!arr) return { ok: false, motivo: `el servidor de ADI no dejó su arranque (${ruta}): no se puede probar que el brazo ${ctx.brazo} llegó` };
  if (arr[VARIABLE_DEL_BRAZO] !== esperado) return { ok: false, motivo: `el servidor de ADI vio ${VARIABLE_DEL_BRAZO}=${JSON.stringify(arr[VARIABLE_DEL_BRAZO])} y la corrida es del brazo ${ctx.brazo} (=${esperado}): los brazos se habrían mezclado` };
  return { ok: true };
}
/** En la vía api la puerta corre EN el proceso del arnés: además de su `env`, la variable se pone en process.env mientras dura la corrida (y se restaura), por si el servidor la lee de ahí. El anfitrión api no tiene entorno. */
function conBrazoEnElProceso(brazo, f) {
  if (!brazo) return f();
  const previo = process.env[VARIABLE_DEL_BRAZO];
  process.env[VARIABLE_DEL_BRAZO] = valorDelBrazo(brazo);
  const volver = () => { if (previo === undefined) delete process.env[VARIABLE_DEL_BRAZO]; else process.env[VARIABLE_DEL_BRAZO] = previo; };
  let r; try { r = f(); } catch (e) { volver(); throw e; }
  return Promise.resolve(r).then((x) => { volver(); return x; }, (e) => { volver(); throw e; });
}

/* ── VÍA CLI ──────────────────────────────────────────────────────────────────────────────────────────────────── */
async function correrHiloCli(h, ctx) {
  const S = { h, convId: null, turnos: [], incompleto: false, hecho: false, anulado: false };
  let estadoJson = crearEstadoInicial({ versiones: { [h.empresa]: h.sesiones[0].version } });
  for (let si = 0; si < h.sesiones.length; si++) {
    const ses = h.sesiones[si];
    if (si > 0) {
      const actual = JSON.parse(estadoJson).tenants.find((x) => x.id === h.empresa);
      if (actual && actual.version !== ses.version) estadoJson = cambiarVersion(estadoJson, { empresaId: h.empresa, version: ses.version });
    }
    const dirSes = join(ctx.salida, "sesiones", `${h.id}_s${si + 1}`);
    fs.mkdirSync(dirSes, { recursive: true });
    const rutaIn = join(dirSes, "estado-in.json"), rutaOut = join(dirSes, "estado-out.json"), rutaBit = join(dirSes, "bitacora.jsonl"), rutaStream = join(dirSes, "stream.jsonl");
    _escribir(rutaIn, estadoJson);
    const dirTrabajo = crearCarpetaDeTrabajo(ctx.baseTrabajo);
    const aisl = (ctx.carpetaAislada || carpetaAislada)(dirTrabajo);
    if (!aisl.aislada) { S.incompleto = true; S.error = `carpeta de trabajo NO aislada (hay CLAUDE.md o .claude en ella o sobre ella): ${aisl.problemas.join(", ")}`; ctx.parada = { motivo: "carpeta_no_aislada", detalle: S.error }; return S; }
    const rutaMcp = join(dirSes, "mcp-config.json"), rutaPrompt = join(dirSes, "system-prompt.txt");
    _escribir(rutaPrompt, INSTRUCCION_DE_SISTEMA);
    const rutaArranque = join(dirSes, "arranque.json");
    const cmd = armarComandoCli({ claudeBin: ctx.claudeBin, modelo: ctx.modelo, dirTrabajo, rutaMcpConfig: rutaMcp, rutaSystemPrompt: rutaPrompt, modoPrompt: ctx.modoPrompt, restringido: ctx.restringido, conservarBaseUrl: ctx.conservarBaseUrl, baseEnv: ctx.env, brazo: ctx.brazo || null, mcp: { estado: rutaIn, empresa: h.empresa, salidaEstado: rutaOut, bitacora: rutaBit, arranque: rutaArranque } });
    _escribir(rutaMcp, cmd.mcpConfig);
    _escribir(join(dirSes, "comando.txt"), formatearComando(cmd));
    const proc = abrirSesionCli({ cmd, bitacora: rutaBit, rutaStream, timeoutTurnoMs: ctx.timeoutTurnoMs });
    let bitN = 0;
    for (let ti = 0; ti < ses.turnos.length; ti++) {
      if (ctx.llamadasModelo >= ctx.topeLlamadas) { ctx.parada = { motivo: "tope_alcanzado", detalle: `tope de ${ctx.topeLlamadas} llamadas al modelo` }; S.incompleto = true; break; }
      const def = ses.turnos[ti];
      const textoEnviado = textoDelTurno({ persona: def.persona, conversacionIdPrevia: ti === 0 && si > 0 ? S.convId : null });
      const r = await proc.turno(textoEnviado);
      const an = analizarTurnoStream(r.eventos);
      const { lineas, total } = lineasNuevasDeBitacora(rutaBit, bitN); bitN = total;
      const llamadas = lineas.map((l) => ({ herramienta: l.herramienta, args: l.args, resultado: l.resultado }));
      for (const l of llamadas) { const cid = _convIdDe(l.resultado); if (cid) S.convId = cid; }
      ctx.llamadasModelo += an.llamadasAlModelo; _suma(ctx.tokens, an.uso);
      if (ctx.turnosHechos === 0 && si === 0 && ti === 0) ctx.residuos = { streamPrimerTurnoSha256: sha256(JSON.stringify(r.eventos)), init: (proc.eventos().find((e) => e.type === "system" && e.subtype === "init") || null) };
      let huellas = null;
      if (S.convId && fs.existsSync(rutaOut)) { try { const e2 = await abrirAlmacen({ estadoJson: fs.readFileSync(rutaOut, "utf8") }); huellas = await _huellas(e2, h.empresa, S.convId); } catch { huellas = null; } }
      const cierre = r.timeout ? "timeout" : r.cerro ? "proceso_terminado" : an.terminoBien ? "ok" : "error_cli";
      S.turnos.push({ sesion: si + 1, turno: ti + 1, persona: def.persona, textoEnviado, espera: def.espera, llamadas, texto: an.texto, textoFinal: an.textoFinal, uso: an.uso, llamadasAlModelo: an.llamadasAlModelo, costoUsd: null, conversacionId: S.convId, huellas, cierre, motivo: r.motivo || null, brazo: ctx.brazo || null, hashes: { modelo: ctx.modelo, instruccion: huellaDeInstruccion(), herramientas: huellaDeHerramientas(), cuerpos: [] } });
      ctx.turnosHechos += 1;
      if (cierre !== "ok") { S.incompleto = true; S.error = `turno ${si + 1}.${ti + 1}: ${cierre}`; break; }
      if (ti === 0) { const b = contrastarArranque(ctx, rutaArranque, h.id, si + 1); if (!b.ok) { S.incompleto = true; S.error = b.motivo; ctx.parada = { motivo: "brazo_no_llego_al_servidor", detalle: b.motivo }; break; } }
      // limpieza TEMPRANA: ante la primera infracción no se gasta ni un turno más de la suscripción
      if (!chequearLimpieza({ eventos: proc.eventos(), enviados: proc.enviados(), modelo: ctx.modelo, dirTrabajo }).limpia) { S.incompleto = true; S.error = "el chequeo de limpieza falló: se corta la sesión"; break; }
    }
    const cierreProc = await proc.cerrar();
    if (!ctx.parada) { const b = contrastarArranque(ctx, rutaArranque, h.id, si + 1); if (!b.ok) { S.incompleto = true; S.error = b.motivo; ctx.parada = { motivo: "brazo_no_llego_al_servidor", detalle: b.motivo }; } }
    // ── EL CHEQUEO DE LIMPIEZA: una sola infracción ANULA la corrida
    const lim = chequearLimpieza({ eventos: proc.eventos(), enviados: proc.enviados(), modelo: ctx.modelo, dirTrabajo });
    ctx.limpieza.push({ hilo: h.id, sesion: si + 1, limpia: lim.limpia, hallazgos: lim.hallazgos, observaciones: lim.observaciones || [] });
    if (!ctx.residuos && lim.residuos) ctx.residuos = { init: lim.residuos };
    _escribir(join(dirSes, "limpieza.json"), { ...lim, salidaDelProceso: cierreProc });
    if (!lim.limpia) { S.anulado = true; S.incompleto = true; ctx.parada = { motivo: "anulada_por_limpieza", hallazgos: lim.hallazgos }; return S; }
    if (S.incompleto) return S;
    const salida = fs.existsSync(rutaOut) ? fs.readFileSync(rutaOut, "utf8") : estadoJson;
    _escribir(join(ctx.salida, "estados", `${h.id}_corte${si + 1}.json`), salida);
    estadoJson = salida;
  }
  S.hecho = true;
  return S;
}

/* ── el transcrito de un hilo en disco ────────────────────────────────────────────────────────────────────────── */
function guardarHilo(ctx, S) {
  const h = S.h;
  const transcrito = {
    hiloId: h.id, forma: h.forma, empresa: h.empresa, grupo: h.grupo || null, brazo: ctx.brazo || null, anulado: Boolean(S.anulado), incompleto: Boolean(S.incompleto), error: S.error || null,
    sesiones: h.sesiones.map((s, i) => ({ n: i + 1, version: s.version, turnos: s.turnos.length })),
    turnos: S.turnos,
  };
  _escribir(join(ctx.salida, "transcritos", `${h.id}.json`), transcrito);
  return transcrito;
}

/* ── LA CORRIDA ───────────────────────────────────────────────────────────────────────────────────────────────── */
/** ejecutarArnes(argv, deps) → { codigo, errores?, salida?, informe?, cierre? }
 *   deps: { env, escribir, leerCorpus, transporte, claudeBin, ahora, esperar, baseTrabajo, llamarJuez, carpetaAislada } (todo inyectable para el candado) */
export async function ejecutarArnes(argv, deps = {}) {
  const env = deps.env || process.env;
  const out = deps.escribir || ((m) => console.log(m));
  const a = parsearArgs(argv);
  const ahora = deps.ahora || (() => new Date().toISOString());

  // ── 1 · TODO lo que se puede rechazar sin leer el catálogo (sin proveedor → falla ANTES de abrir el corpus)
  const errores = validarArgs(a, env);
  if (errores.length) { for (const m of errores) out(`✗ ${m}`); return { codigo: 2, errores }; }
  if (a["solo-imprimir"]) {
    if (a.via !== "cli") { out("✗ --solo-imprimir es del ensayo (--via=cli)"); return { codigo: 2, errores: ["--solo-imprimir es del ensayo"] }; }
    const r = imprimirEnsayo(a, { ...deps, env }); out(r.texto); return r;
  }
  const via = a.via, tipo = a.tipo || "ensayo", modelo = a.modelo, salida = a.salida;

  // ── 1b · EL BRAZO (A/B): una corrida es de UN brazo
  const brazoPedido = normalizarBrazo(a.brazo);
  const enSerie = a["serie-ab"] !== undefined;
  const serieNombre = enSerie ? String(a["serie-ab"]) : null;
  const rutaManifiestoPrevio = join(salida, "manifiesto.json");
  const manifiestoPrevio = fs.existsSync(rutaManifiestoPrevio) ? JSON.parse(fs.readFileSync(rutaManifiestoPrevio, "utf8")) : null;
  const brazoPrevio = manifiestoPrevio && manifiestoPrevio.brazo ? manifiestoPrevio.brazo.id : null;
  /* reanudar una corrida ANTERIOR al A/B (sin brazo en el manifiesto) conserva su servidor como estaba: no se le inventa un brazo */
  const brazo = a.reanudar && manifiestoPrevio ? (!manifiestoPrevio.brazo ? null : (brazoPedido || brazoPrevio)) : (brazoPedido || BRAZO_POR_DEFECTO);
  if (manifiestoPrevio && brazoPrevio && brazo && brazoPrevio !== brazo) { const m = a.reanudar ? `no se puede reanudar una corrida del brazo ${brazoPrevio} con el brazo ${brazo}: los brazos no se mezclan en una corrida` : `la carpeta de salida ya tiene una corrida del brazo ${brazoPrevio}; usá otra --salida para el brazo ${brazo} (los brazos no se mezclan en una corrida)`; out(`✗ ${m}`); return { codigo: 3, errores: [m] }; }
  if (!a.reanudar && manifiestoPrevio && fs.existsSync(join(salida, "transcritos")) && fs.readdirSync(join(salida, "transcritos")).length) { /* una carpeta con una corrida previa: sus transcritos se mezclarían con los de esta */ const m = `la carpeta de salida ya tiene una corrida (${manifiestoPrevio.corridaId}); usá otra --salida o --reanudar`; if (enSerie) { out(`✗ ${m}`); return { codigo: 3, errores: [m] }; } }
  const codigoHuella = (deps.huellaDelCodigo || huellaDelCodigo)();

  // ── 2 · el corpus: huella, formato, quemado
  const rutaSello = a.sello && a.sello !== true ? a.sello : null;
  const { corpus, sha256: shaCorpus } = (deps.leerCorpus || leerCorpus)(a.catalogo);
  const v = validarCorpus(corpus);
  if (!v.ok) { out(`✗ el corpus no cumple el formato:\n  - ${v.errores.slice(0, 15).join("\n  - ")}`); return { codigo: 2, errores: v.errores }; }
  let sello = { ok: null, motivo: "sin sello (solo se admite en un corpus de juguete)" };
  if (rutaSello) {
    sello = verificarSello({ corpus: a.catalogo, sello: rutaSello });
    if (!sello.ok) { out(`✗ ${sello.motivo}`); return { codigo: 3, errores: [sello.motivo] }; }
    if (enSerie) {
      /* LA SERIE A/B: la primera corrida quema el sello y crea SERIE-AB.json; las siguientes lo abren solo si son de ESA serie y ESE corpus (serie-ab.mjs) */
      const rutaSerie = rutaDeLaSerie(rutaSello), serie = leerSerie(rutaSerie);
      if (!serie) {
        if (sello.sello.leido) { const m = `el corpus ${corpus.corpusId} ya fue LEÍDO (quemado el ${sello.sello.leidoEn}) y no hay serie A/B «${serieNombre}» que lo abra: un catálogo usado no se vuelve a abrir`; out(`✗ ${m}`); return { codigo: 4, errores: [m] }; }
        if (a.reanudar) { const m = `no hay serie A/B «${serieNombre}» para este corpus: no hay nada que reanudar`; out(`✗ ${m}`); return { codigo: 4, errores: [m] }; }
      } else {
        const aut = autorizarCorrida({ serie, nombre: serieNombre, brazo: brazoPedido, repeticion: Number(a.repeticion), corpusSha256: shaCorpus, sello: sello.sello, codigoSha256: codigoHuella, reanudar: Boolean(a.reanudar) });
        if (!aut.ok) { out(`✗ serie A/B: ${aut.motivo}`); return { codigo: 4, errores: [aut.motivo] }; }
      }
    } else if (sello.sello.leido && !a.reanudar) { const m = `el corpus ${corpus.corpusId} ya fue LEÍDO (quemado el ${sello.sello.leidoEn}): un catálogo usado no se vuelve a abrir. Para continuar una corrida interrumpida usá --reanudar`; out(`✗ ${m}`); return { codigo: 4, errores: [m] }; }
  } else if (!corpus.juguete) { const m = "el corpus no es de juguete y no trae --sello: un catálogo sin sello no se corre"; out(`✗ ${m}`); return { codigo: 3, errores: [m] }; }
  let serieAb = null;      // { ruta, serie, brazo, repeticion } · se anota la celda cuando el manifiesto ya tiene corridaId
  if (rutaSello && enSerie) {
    const rutaSerie = rutaDeLaSerie(rutaSello);
    let serie = leerSerie(rutaSerie);
    if (!serie) {
      quemarSello({ sello: rutaSello, por: marcaDeLaSerie(serieNombre), ahora });
      serie = nuevaSerie({ nombre: serieNombre, corpusId: corpus.corpusId, corpusSha256: shaCorpus, codigoSha256: codigoHuella, ahora });
    }
    serieAb = { ruta: rutaSerie, serie, brazo: brazoPedido, repeticion: Number(a.repeticion) };
  } else if (rutaSello && !a.reanudar) quemarSello({ sello: rutaSello, por: `arnes ${via} ${tipo}`, ahora });

  // ── 3 · la salida, el manifiesto
  fs.mkdirSync(salida, { recursive: true });
  const rutaManifiesto = join(salida, "manifiesto.json");
  let manifiesto;
  if (a.reanudar && fs.existsSync(rutaManifiesto)) {
    manifiesto = JSON.parse(fs.readFileSync(rutaManifiesto, "utf8"));
    if (manifiesto.corpus.sha256 !== shaCorpus) { out("✗ no se puede reanudar: el corpus no es el de la corrida original"); return { codigo: 3, errores: ["corpus distinto"] }; }
    if (manifiesto.hashes.codigo !== codigoHuella) { out("✗ no se puede reanudar: el CÓDIGO cambió desde que empezó la corrida (una corrección de código entre dos mitades invalida)"); return { codigo: 3, errores: ["código distinto"] }; }
    if (manifiesto.modelo !== modelo || manifiesto.via !== via) { out("✗ no se puede reanudar con otro modelo u otra vía"); return { codigo: 3, errores: ["modelo o vía distintos"] }; }
  } else {
    const claudeBin = via === "cli" ? (deps.claudeBin || a["claude-bin"] || localizarClaude({ env })) : null;
    manifiesto = {
      corridaId: `${corpus.corpusId}-${via}-${brazo ? brazo + (serieAb ? serieAb.repeticion : "") + "-" : ""}${ahora().replace(/[^0-9]/g, "").slice(0, 14)}`, tipo, via, modelo, iniciadaEn: ahora(),
      brazo: brazo ? descripcionDelBrazo(brazo, { porDefecto: !brazoPedido }) : null,
      serieAb: serieAb ? { nombre: serieNombre, brazo: serieAb.brazo, repeticion: serieAb.repeticion, corpusSha256: shaCorpus } : null,
      corpus: { corpusId: corpus.corpusId, sha256: shaCorpus, juguete: corpus.juguete, hilos: v.resumen.hilos, turnos: v.resumen.turnos },
      sello: rutaSello ? { ok: true, sha256: sello.sha256, selladoEn: sello.sello.selladoEn } : { ok: null, motivo: sello.motivo },
      hashes: { instruccion: huellaDeInstruccion(), herramientas: huellaDeHerramientas(), preambulo: huellaDelPreambulo(), codigo: codigoHuella, juez: a.juez ? huellaDelJuez() : null },
      cli: via === "cli" ? { bin: claudeBin, version: deps.versionCli !== undefined ? deps.versionCli : versionDelCli(claudeBin) } : null,
      api: via === "api" ? { topeUsd: Number(a["tope-usd"]), topeTotalUsd: a["tope-total-usd"] ? Number(a["tope-total-usd"]) : TECHO_AUTORIZADO.totalUsd, thinking: a.thinking || "off", maxTokens: Number(a["max-tokens"]) || 4096 } : null,
      topeLlamadas: via === "cli" ? Number(a["tope-llamadas"]) : null,
      banderas: { ADI_ENTREGA: "true", ADI_COMPLEMENTO: "true", ADI_MEMORIA_DURABLE: "true", nota: "solo en el proceso de la puerta (mcp-adi / puerta en proceso); ADI_CONOCIMIENTO queda como está en dev" },
      almacen: "doble de Supabase en memoria (aislado), estado exportado/importado en cada corte; ninguna base real",
      limites: "Ninguna vía es el anfitrión real (Claude.ai / ChatGPT tienen su propio prompt de sistema). Se mide la verdad de la prosa de un modelo capaz apoyado en las Entregas de ADI.",
    };
    _escribir(rutaManifiesto, manifiesto);
  }
  if (serieAb) registrarCorrida(serieAb.ruta, serieAb.serie, { brazo: serieAb.brazo, repeticion: serieAb.repeticion, corridaId: manifiesto.corridaId, salida, ahora });

  // ── 4 · lo que se va a correr
  let hilos = corpus.hilos;
  if (a.hilo && a.hilo !== true) { const ids = new Set(String(a.hilo).split(",")); hilos = hilos.filter((h) => ids.has(h.id)); }
  const yaHechos = new Set(a.reanudar && fs.existsSync(join(salida, "transcritos")) ? fs.readdirSync(join(salida, "transcritos")).map((f) => JSON.parse(fs.readFileSync(join(salida, "transcritos", f), "utf8"))).filter((t) => !t.incompleto && !t.anulado).map((t) => t.hiloId) : []);
  const unidades = planearUnidades(hilos).filter((u) => !u.hilos.every((h) => yaHechos.has(h.id)));
  const turnosPlaneados = hilos.reduce((s, h) => s + _turnosDe(h), 0);
  const turnosPrevios = hilos.filter((h) => yaHechos.has(h.id)).reduce((s, h) => s + _turnosDe(h), 0);
  out(`corrida ${manifiesto.corridaId} · ${via}/${tipo}${brazo ? ` · brazo ${brazo}${serieAb ? ` (serie «${serieNombre}» ${serieAb.brazo}·${serieAb.repeticion})` : ""}` : ""} · ${hilos.length} hilos · ${turnosPlaneados} turnos${yaHechos.size ? ` (${yaHechos.size} hilos ya hechos)` : ""}`);

  const ctx = { salida, modelo, turnosHechos: turnosPrevios, parada: null, limpieza: [], tokens: {}, llamadasModelo: 0, residuos: null, env, brazo, servidores: [] };
  const previo = a.reanudar && fs.existsSync(join(salida, "consumo-parcial.json")) ? JSON.parse(fs.readFileSync(join(salida, "consumo-parcial.json"), "utf8")) : null;
  let contador = null, corridaMedida = null;
  const transcritos = [];

  if (via === "api") {
    const libro = leerLibroDeGasto(a["libro-gasto"] && a["libro-gasto"] !== true ? a["libro-gasto"] : null);
    contador = crearContador({ topeUsd: Number(a["tope-usd"]), topeTotalUsd: a["tope-total-usd"] ? Number(a["tope-total-usd"]) : null, gastadoPrevioUsd: libro.totalUsd - (previo ? previo.costoUSD : 0), previo });
    corridaMedida = abrirCorridaMedida({ ruta: join(salida, "consumo.jsonl"), fs });
    if (!corridaMedida.instalacion.instalado) { out(`✗ no se pudo instalar el contador de telemetría: ${corridaMedida.instalacion.motivo}`); return { codigo: 5, errores: [corridaMedida.instalacion.motivo] }; }
    ctx.cliente = crearClienteApi({ modelo, env, transporte: deps.transporte || null, contador, exigir: () => exigirContador({ env }), telemetria: emit, maxTokens: manifiesto.api.maxTokens, thinking: manifiesto.api.thinking, esperar: deps.esperar || undefined });
    ctx.tools = herramientasParaApi();
    await conBrazoEnElProceso(brazo, async () => {
      for (const u of unidades) {
        const S = await correrUnidadApi(u, ctx);
        for (const s of S) transcritos.push(guardarHilo(ctx, s));
        _escribir(join(salida, "consumo-parcial.json"), contador.resumen());
        if (ctx.parada) break;
      }
    });
  } else {
    ctx.claudeBin = deps.claudeBin || a["claude-bin"] || manifiesto.cli.bin;
    ctx.topeLlamadas = Number(a["tope-llamadas"]);
    ctx.baseTrabajo = deps.baseTrabajo || null;
    ctx.modoPrompt = a["prompt-modo"] === "archivo" ? "archivo" : "texto";
    ctx.restringido = Boolean(a.restringido);
    ctx.conservarBaseUrl = Boolean(a["conservar-base-url"]);
    ctx.timeoutTurnoMs = deps.timeoutTurnoMs || 300000;
    ctx.carpetaAislada = deps.carpetaAislada || null;
    if (previo) { ctx.llamadasModelo = previo.llamadasModelo || 0; ctx.tokens = previo.tokens || {}; }
    for (const u of unidades) {
      for (const h of u.hilos) {
        const S = await correrHiloCli(h, ctx);
        transcritos.push(guardarHilo(ctx, S));
        _escribir(join(salida, "consumo-parcial.json"), { llamadasModelo: ctx.llamadasModelo, tokens: ctx.tokens });
        if (ctx.parada) break;
      }
      if (ctx.parada) break;
    }
  }

  // ── 5 · el juez (solo vía api y solo con --juez): dentro del MISMO tope duro
  let juez = null;
  if (via === "api" && a.juez && !(ctx.parada && ctx.parada.motivo !== "tope_alcanzado")) {
    const llamarJuez = deps.llamarJuez || await juezPorOpenAi({ modelo: MODELO_DEL_JUEZ });
    juez = { modelo: MODELO_DEL_JUEZ, promptSha256: huellaDelJuez(), turnos: {} };
    outer: for (const t of transcritos) {
      const previas = [];
      for (const turno of t.turnos) {
        const entrada = JSON.stringify({ persona: turno.persona, prosa: turno.texto, llamadas: turno.llamadas });
        const r = await juzgarTurno({ turno, llamadasPrevias: previas, llamarJuez, contador, modelo: MODELO_DEL_JUEZ, peorCaso: peorCasoUsd({ modelo: MODELO_DEL_JUEZ, caracteres: entrada.length + 4000, maxTokens: 2048 }) });
        if (r.parado) { juez.parcial = true; juez.motivoParcial = r.motivo; break outer; }
        juez.turnos[`${t.hiloId}|${turno.sesion}|${turno.turno}`] = r;
        previas.push(...(turno.llamadas || []));
      }
    }
    _escribir(join(salida, "juez.json"), juez);
  }

  // ── 6 · el cierre de la corrida
  const consumo = via === "api" ? contador.resumen() : { llamadasAlModelo: ctx.llamadasModelo, tokens: ctx.tokens, topeLlamadas: ctx.topeLlamadas, sinConteoPct: 0, modelosSinPrecio: [], nota: "vía cli: la suscripción no tiene dólares por llamada; los tokens salen del stream" };
  if (corridaMedida) { const _warn = console.warn; console.warn = () => {}; try { corridaMedida.cerrar(); } finally { console.warn = _warn; } }   // (la tabla de precios del repo no conoce `claude-sonnet-5-5` y avisa: acá es ruido, el informe lo declara)
  const motivo = ctx.parada ? ctx.parada.motivo : (transcritos.some((t) => t.incompleto) ? "incompleta" : "completa");
  const cierre = {
    motivo, detalle: ctx.parada || null, turnosPlaneados, turnosHechos: ctx.turnosHechos, hilosHechos: transcritos.filter((t) => !t.incompleto).length + yaHechos.size,
    hallazgos: ctx.parada && ctx.parada.hallazgos ? ctx.parada.hallazgos : undefined, consumo, limpieza: ctx.limpieza, residuos: ctx.residuos || null,
    brazo: brazo ? { id: brazo, valor: valorDelBrazo(brazo), variable: VARIABLE_DEL_BRAZO } : null, serieAb: serieAb ? { nombre: serieNombre, brazo: serieAb.brazo, repeticion: serieAb.repeticion } : null, servidores: ctx.servidores,
    codigoHuellaFinal: (deps.huellaDelCodigo || huellaDelCodigo)(), terminadaEn: ahora(), reanudada: Boolean(a.reanudar),
  };
  _escribir(join(salida, "corrida.json"), cierre);
  if (via === "api" && a["libro-gasto"] && a["libro-gasto"] !== true) anotarEnLibro(a["libro-gasto"], { corridaId: manifiesto.corridaId, usd: contador.gastadoUsd() - (previo ? previo.costoUSD : 0), llamadas: contador.resumen().llamadas, cierre: motivo });

  // ── 7 · el informe (rastreo determinista + juez + lista de casos para el supervisor)
  const { informe, rutaMd } = escribirInforme(salida);
  out(`\ncorrida terminada · ${motivo} · ${ctx.turnosHechos}/${turnosPlaneados} turnos · ${via === "api" ? `US$ ${contador.gastadoUsd().toFixed(4)} de tope US$ ${contador.topeEfectivoUsd}` : `${ctx.llamadasModelo} llamadas al modelo`}`);
  out(`veredicto: ${informe.veredicto} — ${informe.porQue}\ninforme: ${rutaMd}`);
  return { codigo: informe.invalidaciones.length || motivo === "anulada_por_limpieza" ? 1 : 0, salida, informe, cierre };
}

// CLI
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  ejecutarArnes(process.argv.slice(2)).then((r) => process.exit(r.codigo || 0)).catch((e) => { console.error(`✗ ${e && e.stack ? e.stack : e}`); process.exit(1); });
}
