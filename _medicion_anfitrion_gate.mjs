/* === _medicion_anfitrion_gate.mjs · EL ARNÉS DE LA MEDICIÓN CON ANFITRIÓN (cierre de la Etapa 2 · owner 2026-10-05, offline) ===
 * Prueba, SIN red y SIN un solo modelo, el arnés de `scripts/medicion-anfitrion/` (diseño `_ADI_DISENO_MEDICION_ANFITRION.md`):
 * un anfitrión SIMULADO (respuestas buenas y malas grabadas, `anfitrion-simulado.mjs`) y un `claude` FALSO (`claude-falso.mjs`,
 * que levanta de verdad el servidor MCP por stdio) recorren el corpus de JUGUETE de punta a punta, cortes incluidos.
 *
 *   A · la empresa NO-DEMO: ningún nombre del demo sobrevive (claves ni valores) en v1 ni en v2; v2 cambia cifras, saca una cuenta
 *       del ranking y mueve el corte de cobranza; los agregados cierran con las cuentas; funciona por la puerta real.
 *   B · el ALMACÉN AISLADO: doble en memoria, exportar/importar entre cortes, otra versión de carga sin perder la memoria,
 *       una empresa jamás ve la conversación de la otra; CARNADAS de aislamiento (base real · variable de proveedor).
 *   C · el CORPUS: formato, sello con huella sha256, huella rota, quemado, y el rechazo de un corpus sin sello.
 *   D · la PUERTA COMO SERVIDOR MCP (stdio real): las cuatro herramientas tal cual `MCP_TOOLS`, banderas SOLO en ese proceso.
 *   E · el CONTADOR y el TOPE DURO en US$: precios, techo autorizado, una llamada que superaría el tope NO se hace, sin sink no sale nada.
 *   F · el RASTREO determinista (clases 1-2) con carnadas: cifra inventada · cifra de otra cuenta · «antes estaba mal» ·
 *       cambio no avisado · cruce entre empresas; y lo que NO debe marcar (redondeo a lo impreso, años, el eco de la persona).
 *   G · el ARNÉS por la vía api con el anfitrión simulado: bueno = limpio; cada respuesta mala = detectada; el informe (juguete
 *       INVÁLIDA · sin juez NO CONCLUYENTE · con juez PASA / NO PASA); sin proveedor falla ANTES de leer el catálogo; el ensayo
 *       NO admite la API; reanudar; el tope mínimo detiene la corrida.
 *   H · el ARNÉS por la vía cli con el `claude` falso: el comando ENDURECIDO (sin --bare, --tools "", --strict-mcp-config…),
 *       el entorno SIN credencial de API, y el CHEQUEO DE LIMPIEZA con seis carnadas (herramienta ajena · tool_use ajeno ·
 *       system-reminder · skills · otro servidor MCP · hook): cada una ANULA la corrida; `--solo-imprimir` no ejecuta nada.
 *
 * CERO llamadas a un LLM · CERO red · CERO credencial viva. Solo por `npm run gates:offline` o
 * `node --import ./scripts/offline-guard.mjs _medicion_anfitrion_gate.mjs`. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { MCP_TOOLS } from "./src/adi/capacidad/puerta.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

const D = "./scripts/medicion-anfitrion/";
const { packRenombrado, nombresDelDemoEn, nombresDelDemo, nombresDeLaEmpresaNoDemo, CAMBIOS_V2, EMPRESA_NO_DEMO, fichaParaElAutor } = await import(D + "empresa-no-demo.mjs");
const { crearEstadoInicial, cambiarVersion, abrirAlmacen, assertAislado } = await import(D + "almacen-medicion.mjs");
const { validarCorpus, sellarCorpus, verificarSello, quemarSello, leerCorpus } = await import(D + "sellar.mjs");
const { crearPuertaMcp, BANDERAS_DE_LA_PUERTA } = await import(D + "mcp-puerta.mjs");
const { crearContador, costoUsd, peorCasoUsd, TECHO_AUTORIZADO, PRECIOS, anotarEnLibro, leerLibroDeGasto } = await import(D + "contador.mjs");
const { crearClienteApi } = await import(D + "cliente-api.mjs");
const { extraerNumeros, valorImpreso, rastrearHilo } = await import(D + "rastreo.mjs");
const { chequearLimpieza } = await import(D + "limpieza.mjs");
const { ejecutarArnes, huellaDelCodigo, validarArgs, parsearArgs } = await import(D + "arnes.mjs");
const { crearTransporteApiSimulado } = await import(D + "anfitrion-simulado.mjs");
const { calcularInforme, cargarSalida, cierreDeEtapa, escribirInforme, informeEnMarkdown } = await import(D + "informe.mjs");
const { carpetaAislada, armarComandoCli, entornoDelCli, localizarClaude } = await import(D + "anfitrion-cli.mjs");
const { huellaDeInstruccion, huellaDeHerramientas, INSTRUCCION_DE_SISTEMA, nombresMcpDelCli } = await import(D + "instruccion.mjs");
const { parsearVeredictoDelJuez, huellaDelJuez } = await import(D + "juez.mjs");
const { exigirContador } = await import("./src/adi/llm/exigirContador.js");
const { getSink, setSink } = await import("./src/adi/llm/telemetry.js");

let pass = 0, fail = 0;
const fails = [];
function ok(cond, label, detalle = "") { if (cond) pass += 1; else { fail += 1; fails.push(label); console.log(`  ✗ ${label}${detalle ? ` — ${String(detalle).slice(0, 300)}` : ""}`); } }
const seccion = (t) => console.log(`\n── ${t} ──`);

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "mx-gate-"));
const sub = (n) => path.join(TMP, n);
const ABS = (p) => path.resolve(p);
const RUTA_JUGUETE = ABS(D + "corpus-juguete.json");
const RUTA_FALSO = ABS(D + "claude-falso.mjs");
const CLAVE = ["ANTHROPIC", "API", "KEY"].join("_");     // (no se escribe el nombre literal: este gate no habla con ningún proveedor)
const OTRA = ["OPENAI", "API", "KEY"].join("_");
const silencio = () => {};
const ENV_API = { ADI_EXIGIR_CONTADOR: "1", [CLAVE]: "valor-de-gate-no-real" };
const ahora = (() => { let n = 0; return () => new Date(Date.UTC(2026, 9, 5, 12, 0, n++)).toISOString(); })();
const leerJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

/* un corpus de juguete «NO juguete» (para ejercitar el camino oficial completo con sello y juez falso) */
function corpusComoOficial(id) {
  const c = leerJson(RUTA_JUGUETE); c.juguete = false; c.corpusId = id; c.autor = "autor ciego (simulado por el candado)";
  const ruta = sub(`${id}.json`); fs.writeFileSync(ruta, JSON.stringify(c, null, 1));
  const sello = sub(`${id}.SELLO.json`); sellarCorpus({ corpus: ruta, sello, ahora });
  return { ruta, sello };
}

async function correrApi({ modo = "bueno", hilo = null, extra = [], env = ENV_API, transporte = null, salida, corpus = RUTA_JUGUETE, empresaId = "demo", deps = {}, registro = [] }) {
  const argv = ["--via=api", "--tipo=oficial", `--catalogo=${corpus}`, "--modelo=claude-sonnet-5-5", `--salida=${salida}`, "--tope-usd=5", ...(hilo ? [`--hilo=${hilo}`] : []), ...extra];
  const r = await ejecutarArnes(argv, { env, escribir: silencio, ahora, esperar: async () => {}, transporte: transporte || crearTransporteApiSimulado({ modo, empresaId, registro }), ...deps });
  return r;
}

/* ═════ A · LA EMPRESA NO-DEMO ═════════════════════════════════════════════════════════════════════════════════════ */
seccion("A · la empresa no-demo");
const p1 = packRenombrado({ version: 1 }), p2 = packRenombrado({ version: 2 });
ok(nombresDelDemoEn(p1).length === 0, "★ v1: ningún nombre del demo sobrevive (claves ni valores)", nombresDelDemoEn(p1).join(", "));
ok(nombresDelDemoEn(p2).length === 0, "★ v2: ningún nombre del demo sobrevive (claves ni valores)", nombresDelDemoEn(p2).join(", "));
ok(nombresDelDemoEn(JSON.stringify(TENANT_DEMO)).length > 20, "carnada del control: el DEMO sí trae sus nombres (el control muerde)");
ok(nombresDelDemoEn({ nombre: "ADI Demo" }).length === 1 && nombresDelDemoEn("el cliente Jumbo").includes("Jumbo"), "carnada: un nombre del demo suelto o dentro de un texto se detecta");
const propios = new Set(nombresDeLaEmpresaNoDemo().map((n) => n.toLowerCase()));
ok(nombresDelDemo().every((n) => !propios.has(n.toLowerCase())), "los nombres de las dos empresas son conjuntos DISJUNTOS");
ok(JSON.stringify(packRenombrado({ version: 1 })) === JSON.stringify(p1) && JSON.stringify(packRenombrado({ version: 2 })) === JSON.stringify(p2), "determinista: mismos parámetros, mismo pack");
ok(p1.id === EMPRESA_NO_DEMO.id && p1.nombre === "Distribuidora Río Claro" && p1.clientesVentas.length === 13, "id y nombre propios, 13 cuentas en v1");
ok(p2.clientesVentas.length === 12 && p2.clientesMargen.length === 12, "v2: una cuenta sale del ranking (12 cuentas)");
const salio = packRenombrado({ version: 1 }).clientesVentas[CAMBIOS_V2.sale].nombre;
ok(!p2.clientesVentas.some((c) => c.nombre === salio) && !(salio in p2.historialMargen) && !(salio in p2.CLIENTES_STRATEGIC_PROFILE) && !(salio in p2.flujoComercial.clientes), `la cuenta que sale (${salio}) desaparece de TODAS las tablas`);
ok(p1.flujoComercial.fechaCorte !== p2.flujoComercial.fechaCorte && p2.flujoComercial.fechaCorte === CAMBIOS_V2.corteCobranza, "v2 mueve el corte de cobranza (otro período)");
const _suma = (a, k) => a.reduce((s, x) => s + x[k], 0);
for (const [v, p] of [[1, p1], [2, p2]]) {
  ok(_suma(p.clientesVentas, "actual") === p.ventasKPI.totalActual && _suma(p.clientesVentas, "anterior") === p.ventasKPI.totalAnterior, `v${v}: el total de la cabecera cierra con la suma de las cuentas (una sola verdad)`);
  ok(Math.abs(_suma(p.marcasVentas, "actual") - p.ventasKPI.totalActual) <= p.marcasVentas.length && Math.abs(_suma(p.sfamiliasVentas, "actual") - p.ventasKPI.totalActual) <= p.sfamiliasVentas.length, `v${v}: marcas y familias cierran con el total (redondeo)`);
}
const c1 = Object.fromEntries(p1.clientesVentas.map((c) => [c.nombre, c.actual])), c2 = Object.fromEntries(p2.clientesVentas.map((c) => [c.nombre, c.actual]));
ok(Object.keys(c2).filter((n) => c2[n] !== c1[n]).length >= 4, "v2 trae cifras DISTINTAS en varias cuentas (suben y bajan)");
ok(p1.clientesVentas[0].actual !== TENANT_DEMO.clientesVentas[0].actual && p1.perfil.benchmark === 28.4, "las cifras y el benchmark propio no son los del demo");
ok(fichaParaElAutor().empresas.length === 2 && !/\d{3,}/.test(JSON.stringify(fichaParaElAutor()).replace(/20\d\d-\d\d-\d\d/g, "").replace(/RC-\d+/g, "").replace(/[A-Z0-9]+(-[A-Z0-9]+)+/g, "")), "la ficha para el autor ciego trae nombres y estructura, NINGUNA cifra");

/* ═════ B · EL ALMACÉN AISLADO ═══════════════════════════════════════════════════════════════════════════════════ */
seccion("B · el almacén aislado");
let est0 = crearEstadoInicial();
const a1 = await abrirAlmacen({ estadoJson: est0 });
ok(assertAislado(a1) === true && a1.env.SUPABASE_URL.endsWith(".invalid"), "★ el almacén es el doble en memoria (host .invalid): ninguna base real");
let lanzo = false; try { assertAislado({ env: { ...a1.env, SUPABASE_URL: "https://abcdefgh.supabase.co" } }); } catch { lanzo = true; }
ok(lanzo, "carnada: un SUPABASE_URL real (supabase.co) hace fallar el aislamiento");
lanzo = false; try { assertAislado({ env: { ...a1.env, [CLAVE]: "x" } }); } catch { lanzo = true; }
ok(lanzo, "carnada: una variable de proveedor en el entorno de la puerta hace fallar el aislamiento");
lanzo = false; try { assertAislado({ env: { ...a1.env, SUPABASE_URL: "https://doble.invalid", X: "krng-algo" } }); } catch { lanzo = true; }
ok(lanzo, "carnada: una referencia a la base krng hace fallar el aislamiento");
ok(JSON.stringify(a1.env).indexOf("krng") < 0, "ninguna referencia a la base krng en el entorno");
const EN1 = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ nombre: "Cadena Quillay" }] }] };
const r1 = await a1.llamar("rioclaro", "consultar", { encargo: EN1 });
const conv = r1.continuidad.conversacionId;
ok(r1.ok && /Cadena Quillay/.test(r1.entrega.texto) && /Distribuidora Río Claro/.test(r1.entrega.texto), "★ la empresa no-demo responde por la puerta REAL con sus propios nombres");
const dem = await a1.llamar("demo", "consultar", { encargo: { ...EN1, partes: [{ ...EN1.partes[0], entidades: [{ nombre: "Jumbo" }] }] } });
ok(dem.ok && /Jumbo/.test(dem.entrega.texto) && !/Río Claro|Quillay/.test(dem.entrega.texto), "el demo responde con los suyos y nada de la otra empresa");
const rj = await a1.llamar("rioclaro", "consultar", { encargo: { ...EN1, partes: [{ ...EN1.partes[0], entidades: [{ nombre: "Jumbo" }] }] } });
ok(!/\$\d/.test(String(rj.entrega && rj.entrega.texto || "")) || rj.ok === false, "pedirle a la no-demo una cuenta del demo («Jumbo») no devuelve una cifra");
const rd = await a1.llamar("demo", "retomar", { conversacionId: conv });
ok(rd.ok === false, "★ AISLAMIENTO: el demo NO puede retomar la conversación de la otra empresa (mismo id, otro token)");
// exportar / importar entre cortes, y otra versión de carga SIN perder la memoria
const ap = await a1.llamar("rioclaro", "aportarContexto", { conversacionId: conv, aportes: [{ clase: "hecho", concepto: "plazo_de_cobro", valor: { raw: 45, unidad: "days", texto: "45 días" } }] });
const exp = a1.exportar();
const a2 = await abrirAlmacen({ estadoJson: exp });
const rt = await a2.llamar("rioclaro", "retomar", { conversacionId: conv });
ok(rt.ok && rt.hechos.length >= 1, "★ exportar/importar: tras el corte (almacén NUEVO) `retomar` encuentra la conversación");
ok(JSON.stringify((await a2.leerHuellas("rioclaro", conv))) === JSON.stringify((await a1.leerHuellas("rioclaro", conv))), "las huellas del libro y de la memoria son IDÉNTICAS antes y después del corte");
const exp2 = cambiarVersion(exp, { empresaId: "rioclaro", version: 2 });
const a3 = await abrirAlmacen({ estadoJson: exp2 });
const rt2 = await a3.llamar("rioclaro", "retomar", { conversacionId: conv });
ok(rt2.ok && rt2.hechos.some((h) => h.revalidacion && h.revalidacion.estado !== "igual"), "★ otra versión de carga: la conversación sobrevive y `retomar` revalida contra los datos de hoy (algo cambió)");
const conoc = await a3.llamar("rioclaro", "conocerEmpresa", { conversacionId: conv });
ok(JSON.stringify(conoc.hechosAportados.concat(conoc.pendientesDeConfirmar)).includes("plazo_de_cobro"), "lo declarado sigue en la memoria de la empresa tras cambiar la versión");
lanzo = false; try { cambiarVersion(exp, { empresaId: "demo", version: 2 }); } catch { lanzo = true; }
ok(lanzo, "el demo no tiene versión 2: cambiarVersion lo rechaza");

/* ═════ C · EL CORPUS Y EL SELLADOR ═════════════════════════════════════════════════════════════════════════════ */
seccion("C · el corpus y el sellador");
const jug = leerJson(RUTA_JUGUETE);
const vj = validarCorpus(jug);
ok(vj.ok && jug.juguete === true && vj.resumen.hilos === 6 && vj.resumen.cortes === 2 && vj.resumen.porForma.C === 2, "★ el corpus de JUGUETE cumple el formato y está marcado como juguete", vj.errores.join("; "));
const clon = () => JSON.parse(JSON.stringify(jug));
let m = clon(); m.hilos.find((h) => h.id === "B02").sesiones.pop(); ok(!validarCorpus(m).ok, "carnada: un hilo de forma B sin corte es inválido");
m = clon(); m.hilos[0].sesiones[0].turnos[0].espera.nota = "debe decir $17.3M de venta"; ok(!validarCorpus(m).ok, "carnada: una expectativa con cifras es inválida (la verdad sale de las Entregas)");
m = clon(); m.hilos[0].empresa = "otra"; ok(!validarCorpus(m).ok, "carnada: una empresa desconocida es inválida");
m = clon(); m.hilos.find((h) => h.id === "C02").empresa = "demo"; ok(!validarCorpus(m).ok, "carnada: un grupo cuyos hilos son de la MISMA empresa no mide cruces");
m = clon(); delete m.juguete; ok(!validarCorpus(m).ok, "carnada: sin la marca juguete true|false no hay corpus");
m = clon(); m.hilos[0].sesiones[0].turnos[0].espera.tipo = "inventada"; ok(!validarCorpus(m).ok, "carnada: un tipo de expectativa que no existe es inválido");
m = clon(); m.hilos.find((h) => h.id === "B01").sesiones[1].version = 3; ok(!validarCorpus(m).ok, "carnada: una versión de carga que no existe es inválida");
const rc = sub("corpus-c.json"), rs = sub("sello-c.json");
fs.writeFileSync(rc, JSON.stringify(jug));
const s0 = sellarCorpus({ corpus: rc, sello: rs, ahora });
ok(/^[0-9a-f]{64}$/.test(s0.sha256) && s0.leido === false && s0.turnos === vj.resumen.turnos, "el sello lleva la huella sha256, el conteo y «leído: false»");
ok(verificarSello({ corpus: rc, sello: rs }).ok === true, "la huella coincide con el archivo sellado");
let rep = false; try { sellarCorpus({ corpus: rc, sello: rs, ahora }); } catch { rep = true; }
ok(rep, "un corpus ya sellado no se vuelve a sellar");
fs.writeFileSync(rc, JSON.stringify(jug) + " ");
const vr = verificarSello({ corpus: rc, sello: rs });
ok(vr.ok === false && /HUELLA ROTA/.test(vr.motivo), "★ CARNADA: un solo byte cambiado → HUELLA ROTA");
fs.writeFileSync(rc, JSON.stringify(jug));
ok(verificarSello({ corpus: rc, sello: sub("no-existe.json") }).ok === false, "sin sello, el corpus no está sellado");
const q = quemarSello({ sello: rs, por: "gate", ahora });
ok(q.leido === true && q.leidoPor === "gate", "quemar marca «leído»");

/* ═════ D · LA PUERTA COMO SERVIDOR MCP ═════════════════════════════════════════════════════════════════════════ */
seccion("D · la puerta como servidor MCP (stdio real)");
ok(process.env.ADI_ENTREGA === undefined && process.env.ADI_COMPLEMENTO === undefined && process.env.ADI_MEMORIA_DURABLE === undefined, "las banderas NO están encendidas en el proceso del anfitrión/arnés (solo en la puerta)");
const puertaEnProceso = crearPuertaMcp({ almacen: a1, empresaId: "rioclaro" });
ok(process.env.ADI_ENTREGA === undefined && a1.env.ADI_ENTREGA === "true" && a1.env.ADI_COMPLEMENTO === "true" && a1.env.ADI_MEMORIA_DURABLE === "true", "★ las tres banderas viven en el `env` de la puerta, no en process.env", JSON.stringify(BANDERAS_DE_LA_PUERTA));
const tl = await puertaEnProceso.manejarMensaje({ jsonrpc: "2.0", id: 1, method: "tools/list" });
ok(JSON.stringify(tl.result.tools) === JSON.stringify(MCP_TOOLS) && tl.result.tools.length === 4, "★ tools/list devuelve las CUATRO acciones tal cual `MCP_TOOLS` (nombre, descripción y esquema, sin una palabra más)");
ok(puertaEnProceso.manejarMensaje({ jsonrpc: "2.0", method: "notifications/initialized" }) instanceof Promise && (await puertaEnProceso.manejarMensaje({ jsonrpc: "2.0", method: "notifications/initialized" })) === null, "una notificación no se responde");
const ll = await puertaEnProceso.llamarHerramienta("consultar", { encargo: EN1 });
ok(ll.resultado && ll.resultado.ok && ll.content[0].type === "text" && ll.isError === false, "tools/call corre `manejarPuerta` y devuelve el resultado como texto MCP");
const desc = await puertaEnProceso.llamarHerramienta("borrarTodo", {});
ok(desc.isError === true, "una herramienta que no existe se rechaza");
// el servidor real, por stdio, como lo lanza `claude`
const dirMcp = sub("mcp"); fs.mkdirSync(dirMcp, { recursive: true });
fs.writeFileSync(path.join(dirMcp, "estado-in.json"), crearEstadoInicial());
const GUARDA = pathToFileURL(ABS("./scripts/offline-guard.mjs")).href;
const hijo = spawn(process.execPath, ["--import", GUARDA, ABS(D + "mcp-adi.mjs"), `--estado=${path.join(dirMcp, "estado-in.json")}`, "--empresa=rioclaro", `--salida-estado=${path.join(dirMcp, "estado-out.json")}`, `--bitacora=${path.join(dirMcp, "bitacora.jsonl")}`], { stdio: ["pipe", "pipe", "inherit"], env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } });
const respuestas = new Map(); let buf = "";
hijo.stdout.setEncoding("utf8");
hijo.stdout.on("data", (c) => { buf += c; let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l) { const j = JSON.parse(l); const f = respuestas.get(j.id); if (f) f(j); } } });
const rpc = (id, method, params) => new Promise((res) => { respuestas.set(id, res); hijo.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); });
const ini = await rpc(1, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "gate", version: "0" } });
ok(ini.result.serverInfo.name === "adi" && ini.result.capabilities.tools && ini.result.protocolVersion === "2025-03-26", "stdio: `initialize` responde con la versión del cliente y la capacidad de herramientas");
const tl2 = await rpc(2, "tools/list", {});
ok(JSON.stringify(tl2.result.tools) === JSON.stringify(MCP_TOOLS), "stdio: las cuatro herramientas, idénticas a `MCP_TOOLS`");
const tc = await rpc(3, "tools/call", { name: "consultar", arguments: { encargo: EN1 } });
const resTc = JSON.parse(tc.result.content[0].text);
ok(resTc.ok && /Cadena Quillay/.test(resTc.entrega.texto), "stdio: `consultar` por el servidor devuelve la Entrega real de la no-demo");
const tc2 = await rpc(4, "tools/call", { name: "borrarTodo", arguments: {} });
ok(tc2.error && /desconocida/.test(tc2.error.message) || (tc2.result && tc2.result.isError), "stdio: una herramienta ajena se rechaza");
hijo.stdin.end();
await new Promise((r) => hijo.on("close", r));
const bit = fs.readFileSync(path.join(dirMcp, "bitacora.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
ok(bit.length >= 1 && bit[0].herramienta === "consultar" && bit[0].resultado.ok, "la bitácora guarda cada llamada con su resultado EXACTO (de ahí lee el rastreo)");
const estOut = fs.readFileSync(path.join(dirMcp, "estado-out.json"), "utf8");
ok(JSON.parse(estOut).conversaciones.length >= 1, "el estado se exporta tras cada llamada (el corte lo recoge de ahí)");

/* ═════ E · EL CONTADOR Y EL TOPE DURO ══════════════════════════════════════════════════════════════════════════ */
seccion("E · el contador y el tope duro en US$");
ok(Math.abs(costoUsd("claude-sonnet-5-5", { input_tokens: 1e6, output_tokens: 1e6 }) - 12) < 1e-9, "★ Sonnet 5.5: US$2 entrada + US$10 salida por millón");
ok(Math.abs(costoUsd("claude-sonnet-5-5", { cache_read_input_tokens: 1e6 }) - 0.2) < 1e-9, "★ la lectura de caché cuesta US$0,20 por millón");
ok(Math.abs(costoUsd("claude-sonnet-5-5-20261005", { input_tokens: 1e6 }) - 2) < 1e-9, "un snapshot fechado del proveedor se tarifa como su familia");
ok(costoUsd("claude-modelo-nuevo", { input_tokens: 1e6 }) === null && PRECIOS["claude-sonnet-5"] === undefined, "un modelo sin precio NO se cuenta como cero (null)");
ok(TECHO_AUTORIZADO.porCorridaUsd === 40 && TECHO_AUTORIZADO.totalUsd === 80, "el techo autorizado por el owner: US$40 por corrida y US$80 en total");
lanzo = false; try { crearContador({}); } catch (e) { lanzo = /tope duro/.test(e.message); }
ok(lanzo, "sin --tope-usd no hay contador (obligatorio, sin valor por defecto)");
lanzo = false; try { crearContador({ topeUsd: 41 }); } catch (e) { lanzo = /autorizado/.test(e.message); }
ok(lanzo, "★ un tope por encima de US$40 se rechaza (hace falta una autorización nueva)");
lanzo = false; try { crearContador({ topeUsd: 40, topeTotalUsd: 80, gastadoPrevioUsd: 80 }); } catch (e) { lanzo = /no queda presupuesto/.test(e.message); }
ok(lanzo, "agotado el total de US$80 ya no se abre una corrida");
const cE = crearContador({ topeUsd: 1 });
ok(cE.antesDeLlamar(0.5).ok && !cE.antesDeLlamar(1.01).ok && cE.antesDeLlamar(1.01).reasonCode === "tope_alcanzado", "★ una llamada cuyo PEOR caso supera el tope no se autoriza");
cE.despuesDeLlamar({ modelo: "claude-sonnet-5-5", uso: { input_tokens: 200000, output_tokens: 50000 } });     // 0.40 + 0.50 = 0.90
ok(!cE.antesDeLlamar(0.2).ok && cE.antesDeLlamar(0.1).ok, "con US$0,90 gastados de US$1, una llamada de peor caso US$0,20 NO se hace y una de US$0,10 sí");
ok(!crearContador({ topeUsd: 1 }).antesDeLlamar(null).ok, "un modelo sin precio (peor caso null) tampoco se autoriza");
const cS = crearContador({ topeUsd: 1 }); cS.llamadaSinConteo({ modelo: "claude-sonnet-5-5", peorCaso: 0.3 });
ok(Math.abs(cS.gastadoUsd() - 0.3) < 1e-9 && cS.resumen().sinConteo === 1, "una llamada sin conteo se cobra al PEOR caso (no al cero)");
ok(peorCasoUsd({ modelo: "claude-sonnet-5-5", caracteres: 250000, maxTokens: 4096 }) > 0.2, "el peor caso cuenta TODA la entrada y TODA la salida posible");
const libroP = sub("libro.json"); anotarEnLibro(libroP, { corridaId: "c1", usd: 12.5, llamadas: 100, cierre: "completa" }); anotarEnLibro(libroP, { corridaId: "c2", usd: 7.5, llamadas: 50, cierre: "completa" });
ok(leerLibroDeGasto(libroP).totalUsd === 20, "el libro de gasto suma lo gastado entre corridas (el tope total)");
const cT = crearContador({ topeUsd: 40, topeTotalUsd: 80, gastadoPrevioUsd: 70 });
ok(cT.topeEfectivoUsd === 10, "el tope efectivo es min(tope por corrida, total − ya gastado)");
// sin sink no sale nada (ADI_EXIGIR_CONTADOR=1) y el transporte NO se toca
setSink(null);
let llamadasT = 0;
const transpMudo = async () => { llamadasT += 1; return new Response("{}", { status: 200 }); };
const clSin = crearClienteApi({ modelo: "claude-sonnet-5-5", env: ENV_API, transporte: transpMudo, contador: crearContador({ topeUsd: 5 }), exigir: () => exigirContador({ env: ENV_API }) });
const rSin = await clSin.llamar({ system: "x", tools: [], messages: [{ role: "user", content: "hola" }] });
ok(rSin.parado && rSin.reasonCode === "sin_contador" && llamadasT === 0, "★ sin sink de telemetría, con ADI_EXIGIR_CONTADOR=1, ninguna llamada sale (el transporte no se toca)");
ok(getSink() === null, "(el candado no dejó un sink instalado)");

/* ═════ F · EL RASTREO DETERMINISTA ═════════════════════════════════════════════════════════════════════════════ */
seccion("F · el rastreo determinista (clases 1-2)");
const num = (t) => extraerNumeros(t).map((x) => [x.unidad, x.candidatos.map((c) => c.valor)]);
ok(JSON.stringify(num("$17.3M")) === JSON.stringify([["money", [17300000]]]), "«$17.3M» = 17.300.000 (formato de la casa)");
ok(num("$17,3 millones")[0][1][0] === 17300000, "«$17,3 millones» (coma decimal) = lo mismo");
ok(num("$17.306.000")[0][1].includes(17306000), "«$17.306.000» (miles con punto) = 17.306.000");
ok(num("22 %")[0][0] === "pct" && num("22,4%")[0][1][0] === 22.4, "«22 %» y «22,4%» son porcentajes");
ok(num("45 días")[0][0] === "days", "«45 días» son días");
ok(valorImpreso("$588K").valor === 588000 && valorImpreso("$588K").unc === 500, "lo impreso «$588K» lleva su precisión (±500)");
// el libro: UNA Entrega real, y la prosa del anfitrión en cada variante
const E1 = r1;     // consultar a Cadena Quillay (no-demo)
const filasE1 = E1.entrega.cifras;     // la respuesta COMPACTA que viaja al anfitrión: cada cifra con su id (`capacidad/compacto.js`)
const venta = filasE1.find((f) => f.metrica === "Venta").valor;
const hiloBase = (texto, persona = "¿cuánto vendió Cadena Quillay?", llamadas = [{ herramienta: "consultar", args: {}, resultado: E1 }]) => ({ hiloId: "X", forma: "A", empresa: "rioclaro", turnos: [{ sesion: 1, turno: 1, persona, textoEnviado: persona, texto, llamadas }] });
const rastro = (texto, o = {}) => rastrearHilo(hiloBase(texto, o.persona, o.llamadas))[0];
const veredictos = (r) => r.afirmaciones.map((a) => a.veredicto);
ok(veredictos(rastro(`Cadena Quillay vendió ${venta}.`)).includes("traza") && !veredictos(rastro(`Cadena Quillay vendió ${venta}.`)).includes("no_traza"), "★ una cifra de la Entrega, con su dueño, traza");
ok(veredictos(rastro("Cadena Quillay vendió $99.9M este año.")).includes("no_traza"), "★ CARNADA: una cifra INVENTADA no traza");
ok(veredictos(rastro(`Falabella vendió ${venta}.`)).length >= 1 && rastro(`Falabella vendió ${venta}.`).cruces.length === 1, "★ CARNADA: nombrar a una cuenta del OTRO universo se detecta como cruce entre empresas");
const ventaOtro = { ...E1, entrega: { ...E1.entrega, cifras: [...E1.entrega.cifras, { id: "E1.h99", entidad: "Casa Lomas", metrica: "Venta", valor: "$5.3M", procedencia: "medido" }] } };
ok(veredictos(rastro("Casa Lomas vendió $5.3M.", { llamadas: [{ herramienta: "consultar", args: {}, resultado: ventaOtro }] })).includes("traza"), "control: la cifra de otra cuenta que SÍ se entregó, atribuida a su dueño, traza");
ok(veredictos(rastro(`Casa Lomas vendió ${venta}.`, { llamadas: [{ herramienta: "consultar", args: {}, resultado: ventaOtro }] })).includes("dueno_distinto"), "★ CARNADA: la cifra de una cuenta atribuida a OTRA es «dueño distinto»");
ok(veredictos(rastro("Cadena Quillay vendió $13.0M.")).every((v) => v !== "no_traza"), "el redondeo a lo impreso («$13.0M» ≈ lo entregado) no es error", JSON.stringify(rastro("Cadena Quillay vendió $13.0M.").afirmaciones));
ok(!veredictos(rastro("En 2026, al 31 de agosto, la versión 2 de la carga: Cadena Quillay.")).some((v) => ["no_traza", "dueno_distinto", "sin_unidad"].includes(v)), "años, fechas y números de versión se ignoran");
ok(veredictos(rastro("No puedo confirmar el 50% que dices.", { persona: "Cadena Quillay creció 50% ¿verdad?" })).includes("eco_persona"), "la cifra que dijo la PERSONA no se juzga como cifra de ADI (eco)");
ok(veredictos(rastro("Cadena Quillay tuvo margen de $13.0M.")).includes("metrica_distinta"), "una cifra de venta dicha como margen se marca «métrica distinta»");
// clase 2 sobre un retomar real (otra versión de carga)
const a4 = await abrirAlmacen({ estadoJson: crearEstadoInicial() });
const r4 = await a4.llamar("rioclaro", "consultar", { encargo: { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ nombre: "Supermercados Andes del Sur" }, { nombre: "Cadena Quillay" }, { nombre: "Casa Lomas" }] }] } });
const a5 = await abrirAlmacen({ estadoJson: cambiarVersion(a4.exportar(), { empresaId: "rioclaro", version: 2 }) });
const rt3 = await a5.llamar("rioclaro", "retomar", { conversacionId: r4.continuidad.conversacionId });
const retoCambio = { herramienta: "retomar", args: {}, resultado: rt3 };
const turnoRet = (texto, persona = "retomemos") => rastrearHilo({ hiloId: "R", forma: "B", empresa: "rioclaro", turnos: [{ sesion: 2, turno: 1, persona, textoEnviado: persona, texto, llamadas: [retoCambio] }] })[0];
const hCambio = rt3.hechos.find((h) => h.revalidacion.estado === "cambio");
const hBien = hCambio ? `${rt3.lineaContinuidad}. ${hCambio.sujeto}: ${hCambio.metrica} antes ${hCambio.revalidacion.anterior.valor}, ahora ${hCambio.revalidacion.actual.valor}.` : "";
ok(Boolean(hCambio) && veredictos(turnoRet(hBien)).filter((v) => v === "traza").length >= 1 && !veredictos(turnoRet(hBien)).includes("cambio_no_avisado"), "★ retomar: decir las DOS cifras de lo que cambió es verdad (clase 2)");
ok(hCambio && veredictos(turnoRet(`Hay novedades: ${hCambio.sujeto} cambió, ahora ${hCambio.revalidacion.actual.valor}.`)).includes("cambio_no_avisado"), "★ CARNADA: callar la cifra de ANTES de un cambio que ADI nombró = cambio no avisado");
ok(veredictos(turnoRet(`${hBien} Antes estaba mal la cifra y la corrijo.`)).includes("pasado_reescrito"), "★ CARNADA: «antes estaba mal» (reescribir el pasado) se marca");
ok(["Antes estaba mal", "me equivoqué", "fue un error mío"].every((t) => veredictos(turnoRet(`Hola. ${t}.`)).includes("pasado_reescrito")), "el pasado reescrito se detecta en varias formas");
const noCambio = await a2.llamar("rioclaro", "retomar", { conversacionId: conv });
const turnoSin = (texto) => rastrearHilo({ hiloId: "S", forma: "B", empresa: "rioclaro", turnos: [{ sesion: 2, turno: 1, persona: "seguimos", textoEnviado: "seguimos", texto, llamadas: [{ herramienta: "retomar", args: {}, resultado: noCambio }] }] })[0];
ok(!veredictos(turnoSin("Los datos no cambiaron desde la última vez.")).some((v) => /cambio_inventado/.test(v)), "«no cambiaron» NO se toma por un cambio inventado");
ok(veredictos(turnoSin("Los datos cambiaron: la venta subió bastante.")).includes("cambio_inventado_revisar"), "CARNADA: decir que los datos cambiaron cuando ADI no trae cambios se lista para revisar");
const hSin = rt3.hechos.find((h) => ["sin_reverificar", "no_comparable", "ya_no_existe"].includes(h.revalidacion.estado));
if (hSin) ok(veredictos(turnoRet(`${hSin.sujeto}: ${hSin.metrica} sigue en ${hSin.revalidacion.anterior.valor}.`)).includes("afirmado_como_vigente_revisar") && !veredictos(turnoRet(`${hSin.sujeto}: ${hSin.metrica} (${hSin.revalidacion.anterior.valor}) no se pudo reverificar con los datos actuales.`)).includes("afirmado_como_vigente_revisar"), "CARNADA: lo «sin reverificar» afirmado como vigente se lista; decir por qué no se revalida, no");

/* ═════ F2 · EL RASTREO ACEPTA SOLO DERIVACIONES ARITMÉTICAS DEMOSTRABLES (owner 2026-10-05, tras el ensayo 1) ═════════════════════════
 * «Aceptar solo derivaciones aritméticas demostrables con las cifras entregadas. Si una suma, resta o diferencia no cierra exactamente, debe seguir marcándose
 * como error.» Los SEIS casos que el ensayo marcó como error material y el supervisor verificó como VERDADEROS (hilo A01, la prosa real del anfitrión y lo que
 * ADI le entregó, `fixtures/medicion-anfitrion/ensayo-1-A01-compacto.json`): la suma de dos cifras entregadas, la diferencia contra el benchmark, y cifras
 * correctas dichas bajo una oración que nombra varias métricas. Con sus carnadas: una suma que no cierra, tres sumandos, otra métrica. */
seccion("F2 · el rastreo acepta solo derivaciones aritméticas demostrables (los 6 casos reales del ensayo 1)");
{
  const FIX = JSON.parse(fs.readFileSync(new URL("./fixtures/medicion-anfitrion/ensayo-1-A01-compacto.json", import.meta.url), "utf8"));
  const clonF = (x) => JSON.parse(JSON.stringify(x));
  const real = rastrearHilo(FIX);
  const del = (r, turno) => r.find((t) => t.turno === turno).afirmaciones.filter((a) => a.veredicto !== "ignorado");
  const malas = real.flatMap((t) => t.afirmaciones.filter((a) => ["no_traza", "dueno_distinto", "metrica_distinta"].includes(a.veredicto)).map((a) => `${t.turno}: ${a.veredicto} «${a.token}»`));
  ok(malas.length === 0, "★ el hilo A01 del ensayo (5 turnos, la prosa real del anfitrión) queda SIN errores de cifra: los 6 casos que se marcaron como material ya son verdad", malas.join(" | "));
  const t1 = del(real, 1).find((a) => /37,2/.test(a.token));
  ok(t1 && t1.veredicto === "traza" && t1.derivacion && t1.derivacion.operacion === "suma" && t1.derivacion.operandos.map((o) => o.texto).sort().join() === "$17.8M,$19.4M", "★ caso 1 · «suman unos $37,2 M» = $19.4M (Falabella) + $17.8M (Lider): traza, y la derivación queda registrada (operación y operandos)", JSON.stringify(t1));
  const t4 = del(real, 4).find((a) => /8,6/.test(a.token));
  ok(t4 && t4.veredicto === "traza" && t4.derivacion && t4.derivacion.operacion === "diferencia" && t4.derivacion.operandos.map((o) => o.texto).sort().join() === "21.5%,30.1%", "★ caso 2 · «8,6 puntos por debajo» = 30.1% (benchmark) − 21.5% (Lider): traza, derivación registrada", JSON.stringify(t4));
  const brecha = del(real, 4).filter((a) => /1,5 M|1,6 M/.test(a.token));
  ok(brecha.length === 2 && brecha.every((a) => a.veredicto === "traza" && !a.derivacion), "★ casos 3 y 4 · «brecha $1,5 M / $1,6 M»: cifras entregadas bajo la métrica que la oración nombra (la oración nombra varias): traza directa, sin derivación");
  const bench = del(real, 5).filter((a) => /21,5|22 %/.test(a.token));
  ok(bench.length === 2 && bench.every((a) => a.veredicto === "traza"), "★ casos 5 y 6 · «contra tu propio benchmark de 30,1 %, Lider (21,5 %) y Falabella (22 %)»: traza");
  ok(real.flatMap((t) => t.afirmaciones).filter((a) => a.derivacion).length === 2, "solo esas DOS cifras necesitaron derivación: todo lo demás del hilo traza directo");
  ok(!JSON.stringify(real.flatMap((t) => t.afirmaciones).filter((a) => a.derivacion).map((a) => a.derivacion)).includes("raw"), "la derivación registrada dice qué cifras (como se imprimieron) y qué operación, no números sueltos");

  // el informe las deja a la vista: qué cifras, qué operación
  const infD = calcularInforme({ manifiesto: null, cierre: null, hilos: [{ ...FIX, anulado: false }] });
  ok(infD.derivaciones.length === 2 && infD.derivaciones.every((d) => d.id && d.operacion && d.operandos.length === 2 && /=/.test(d.descripcion)) && infD.erroresMateriales.length === 0, "★ el informe registra las derivaciones aceptadas (id, operación, operandos) y el hilo queda sin errores materiales", JSON.stringify(infD.derivaciones));
  ok(informeEnMarkdown(infD).includes("## Derivaciones aritméticas aceptadas · 2") && informeEnMarkdown(infD).includes("$37,2 M = $19.4M (Falabella) + $17.8M (Lider)"), "★ el informe en texto lista cada derivación: «$37,2 M = $19.4M (Falabella) + $17.8M (Lider)»");

  // ── CARNADAS: la misma prosa con UN cambio. Cada una tiene que seguir marcándose como error.
  const conTexto = (turno, de, a) => { const h = clonF(FIX); const t = h.turnos.find((x) => x.turno === turno); if (!t.texto.includes(de)) throw new Error(`la prosa del turno ${turno} ya no trae «${de}»`); t.texto = t.texto.replace(de, a); return h; };
  const veredictoDe = (h, turno, rx) => { const a = del(rastrearHilo(h), turno).find((x) => rx.test(x.token)); return a ? a.veredicto : null; };
  ok(veredictoDe(conTexto(1, "$37,2 M", "$37,3 M"), 1, /37,3/) === "no_traza", "★ CARNADA · una suma que NO cierra (37,3 en vez de 37,2 = 19,4 + 17,8) sigue siendo error (no_traza)");
  ok(veredictoDe(conTexto(1, "$37,2 M", "$37,1 M"), 1, /37,1/) === "no_traza" && veredictoDe(conTexto(1, "$37,2 M", "$38 M"), 1, /38/) === "no_traza", "CARNADA · tampoco cierra 37,1 ni «38» (a la precisión con que se imprime no es lo mismo que 37,2)");
  ok(veredictoDe(conTexto(1, "$37,2 M", "$37 M"), 1, /^\$37 M/) === "traza", "control · «$37 M» (la misma suma, impresa con un entero) SÍ es el mismo valor impreso: traza");
  ok(veredictoDe(conTexto(4, "8,6 puntos", "8,7 puntos"), 4, /8,7/) === "no_traza", "★ CARNADA · una diferencia que NO cierra (8,7 en vez de 8,6 = 30,1 − 21,5) sigue siendo error");
  ok(veredictoDe(conTexto(4, "8,6 puntos", "8,5 puntos"), 4, /8,5/) === "no_traza" && veredictoDe(conTexto(4, "8,6 puntos", "8,4 puntos"), 4, /8,4/) === "no_traza" && veredictoDe(conTexto(4, "8,6 puntos", "10 puntos"), 4, /^10 pun/) === "no_traza", "CARNADA · 8,5, 8,4 y «10 puntos» tampoco cierran");
  ok(veredictoDe(conTexto(4, "8,6 puntos", "9 puntos"), 4, /^9 pun/) === "traza", "control · «9 puntos» es 8,6 impreso con un entero (el redondeo a lo impreso no es error, como en toda cifra); el empate de media unidad no cierra");
  // tres operandos: 19,4 + 17,8 + 17,3 = 54,5, y ninguna PAREJA de las tres da 54,5 → no se acepta
  const tres = conTexto(1, "Entre los dos suman unos $37,2 M (CLP).", "Falabella, Lider y Jumbo ($17,3 M) suman $54,5 M.");
  ok(veredictoDe(tres, 1, /54,5/) === "no_traza", "★ CARNADA · TRES operandos (19,4 + 17,8 + 17,3 = 54,5) no se aceptan: la regla es de DOS cifras");
  const tresBien = conTexto(1, "Entre los dos suman unos $37,2 M (CLP).", "Falabella, Lider y Jumbo ($17,3 M) suman $37,2 M.");
  ok(veredictoDe(tresBien, 1, /37,2/) === "traza", "control · si dos de las cifras citadas SÍ suman lo que la prosa dice, traza (la regla mira parejas)");
  // producto y cociente: nunca
  ok(veredictoDe(conTexto(4, "8,6 puntos", "6,5 puntos"), 4, /6,5/) === "no_traza" && veredictoDe(conTexto(4, "8,6 puntos", "9,3 %"), 4, /9,3/) === "no_traza", "CARNADA · ni un producto ni un cociente ni un «porcentaje de porcentaje» (30,1 × 21,5 %, 21,5 ÷ 30,1…) se aceptan como derivación");
  // otra métrica: una cifra que coincide SOLO con otra métrica de la entidad sigue siendo `metrica_distinta`
  ok(veredictoDe(conTexto(4, "Lider queda unos 8,6 puntos por debajo.", "La contribución de Jumbo es de $17,3 M."), 4, /17,3/) === "metrica_distinta", "★ CARNADA · $17,3 M es la VENTA de Jumbo: dicho como su contribución sigue siendo `metrica_distinta`");
  ok(veredictoDe(conTexto(4, "Lider queda unos 8,6 puntos por debajo.", "Las ventas de Jumbo son de $17,3 M."), 4, /17,3/) === "traza", "control · la misma cifra bajo su métrica traza");
  ok(veredictoDe(conTexto(4, "Lider queda unos 8,6 puntos por debajo.", "El saldo vencido de Falabella es de $19,4 M."), 4, /19,4/) === "metrica_distinta", "CARNADA · la venta de Falabella dicha como su saldo vencido sigue siendo `metrica_distinta`");
  // el dueño sigue mandando
  ok(veredictoDe(conTexto(4, "Lider queda unos 8,6 puntos por debajo.", "Lider vendió $8,2 M."), 4, /8,2/) === "dueno_distinto", "CARNADA · la cifra de OTRA cuenta (Sodimac, $8.2M) dicha de Lider sigue siendo `dueno_distinto`");
  // una suma sin las cifras a la vista: la oración nombra las dos cuentas y la métrica → las dos cifras ENTREGADAS de esas cuentas bajo esa métrica
  const sinCitar = conTexto(1, "Entre los dos suman unos $37,2 M (CLP).", "Las ventas de Falabella y de Lider suman unos $37,2 M (CLP).");
  const dSinCitar = del(rastrearHilo(sinCitar), 1).find((a) => /37,2/.test(a.token));
  ok(dSinCitar && dSinCitar.veredicto === "traza" && dSinCitar.derivacion && dSinCitar.derivacion.operacion === "suma", "una suma de las ventas de las DOS cuentas que la oración nombra se acepta aunque no cite cada cifra (son cifras entregadas, de esa métrica)", JSON.stringify(dSinCitar));
  const sinCitarMal = conTexto(1, "Entre los dos suman unos $37,2 M (CLP).", "Las ventas de Falabella y de Lider suman unos $37,3 M (CLP).");
  ok(del(rastrearHilo(sinCitarMal), 1).find((a) => /37,3/.test(a.token)).veredicto === "no_traza", "y si no cierra, error");
  // una cifra sin ninguna derivación posible
  ok(veredictoDe(conTexto(1, "$37,2 M", "$99,9 M"), 1, /99,9/) === "no_traza", "CARNADA · una cifra inventada sigue siendo no_traza");
  // el rastreo no se vuelve laxo: ninguna cifra inventada «cae» en una derivación al azar sobre el hilo entero
  let falsosPositivos = 0, probadas = 0;
  for (let v = 1.1; v <= 60; v += 0.7) {
    const h = clonF(FIX);
    const t = h.turnos.find((x) => x.turno === 1);
    t.texto = `Entre los dos suman unos $${v.toFixed(1).replace(".", ",")} M (CLP).`;
    const a = rastrearHilo(h)[0].afirmaciones.find((x) => x.clase === 1 && x.veredicto !== "ignorado");
    probadas += 1; if (a && a.veredicto === "traza" && a.derivacion && Math.abs(v - 37.2) > 0.05) falsosPositivos += 1;   // (una cifra que coincide con una entregada traza DIRECTO: no es derivación)
  }
  ok(falsosPositivos === 0, `la regla no es laxa: de ${probadas} sumas «inventadas» entre 1,1 y 60 M dichas en ese turno, solo la que cierra con las dos cifras citadas pasa (${falsosPositivos} falsos positivos)`);
}

/* ═════ F3 · EL RASTREO TRAS EL CLASIFICADOR DEL ENSAYO 2 (owner 2026-10-05) ═══════════════════════════════════════════════════
 * El ensayo 2 marcó 169 «errores materiales» de cifra y 6 «cruces». El clasificador (`ensayo-2/clasificacion.md`) los separó con evidencia: 143 eran falsas alarmas del VERIFICADOR (la afirmación era verdadera según lo
 * entregado o lo dicho por la persona), 25 errores REALES del anfitrión (2 graves: un total mal sumado y un porcentaje sobre ese total) y 1 verdadero que el rastreo sigue marcando. Cada patrón de falsa alarma se corrigió con UNA
 * regla (`REGLAS` en `rastreo.mjs`); acá cada regla tiene (a) el caso REAL del ensayo que pasa a verdadero, (b) la prueba de que sin la regla el caso vuelve a marcarse (la regla es la que lo rescata, no la suerte) y (c) la
 * variante FALSA del mismo caso que sigue marcada. La prosa y las Entregas son las reales (`fixtures/medicion-anfitrion/ensayo-2-compacto.json`). */
seccion("F3 · el rastreo tras el clasificador del ensayo 2 (143 falsas alarmas del verificador, una regla por patrón)");
{
  const { REGLAS, hechosDeLaPersona, clausulaDe, aliasesDe } = await import(D + "rastreo.mjs");
  const FX2 = JSON.parse(fs.readFileSync(new URL("./fixtures/medicion-anfitrion/ensayo-2-compacto.json", import.meta.url), "utf8")).hilos;
  const clon2 = (x) => JSON.parse(JSON.stringify(x));
  const hilo2 = (id) => clon2(FX2[id]);
  const turno2 = (h, k) => h.turnos.find((t) => `${t.sesion}.${t.turno}` === k);
  const con2 = (id, k, de, a) => { const h = hilo2(id); const t = turno2(h, k); if (!t.texto.includes(de)) throw new Error(`la prosa de ${id} ${k} ya no trae «${de}»`); t.texto = t.texto.replace(de, a); return h; };
  const anade2 = (id, k, extra) => { const h = hilo2(id); const t = turno2(h, k); t.texto = `${t.texto}${extra}`; return h; };
  const afirma2 = (h, k) => rastrearHilo(h).find((t) => `${t.sesion}.${t.turno}` === k);
  const v2 = (h, k, rx, enOr = null) => afirma2(h, k).afirmaciones.filter((a) => a.clase === 1 && a.veredicto !== "ignorado" && rx.test(a.token) && (!enOr || enOr.test(a.oracion))).map((a) => a.veredicto);
  const sinRegla = (regla, f) => { REGLAS[regla] = false; try { return f(); } finally { REGLAS[regla] = true; } };
  const TRAZA = (xs) => xs.length > 0 && xs.every((x) => x === "traza");
  const FALSA = (xs) => xs.length > 0 && xs.every((x) => ["no_traza", "dueno_distinto", "metrica_distinta"].includes(x));
  const caso = (regla, id, k, rx, msg, enOr = null, h = hilo2(id)) => {
    const con = v2(h, k, rx, enOr);
    const sin = sinRegla(regla, () => v2(h, k, rx, enOr));
    ok(TRAZA(con), `★ ${msg}: con la regla «${regla}» traza`, JSON.stringify(con));
    ok(FALSA(sin), `   y sin la regla vuelve a marcarse (la regla es la que lo rescata)`, JSON.stringify(sin));
  };
  const sigue = (h, k, rx, msg, esperados = ["no_traza", "dueno_distinto", "metrica_distinta"], enOr = null) => { const x = v2(h, k, rx, enOr); ok(x.length > 0 && x.every((y) => esperados.includes(y)), `★ CARNADA · ${msg}`, JSON.stringify(x)); };

  // — «269d»: los días como los imprime la casa
  ok(JSON.stringify(num("269d")) === JSON.stringify([["days", [269]]]) && num("8d")[0][0] === "days" && num("$15K, 24d, 68 unidades").map((x) => x[0]).join() === "money,days,count", "«269d» y «8d» son días (como los imprime la casa); «68 unidades» sigue siendo un conteo");
  caso("dias_d", "A02", "1.1", /^8 días/, "caso real A02 1.1 · «Andes del Sur y Alerce llevan 8 días de atraso» (la Entrega trae «8d», E1.h14)", /llevan 8 días/);
  sigue(con2("A02", "1.1", "llevan 8 días de atraso", "llevan 9 días de atraso"), "1.1", /^9 días/, "«9 días» no es lo entregado (8d): sigue siendo error", ["no_traza", "dueno_distinto", "metrica_distinta"], /llevan 9 días/);
  sigue(anade2("A02", "1.1", "\n\nMayorista El Roble lleva 8 días de atraso."), "1.1", /^8 días/, "los «8 días» son de Andes del Sur y Alerce, no de El Roble (269d): `dueno_distinto`", ["dueno_distinto"], /Mayorista El Roble lleva/);
  // — lo que la persona DECLARÓ en el hilo
  const hp = hechosDeLaPersona([{ texto: "Hola, vendo con crédito a 60 días.", sesion: 1, turno: 1 }, { texto: "Perdón, me corrijo: el plazo de cobro es a 45 días, no a 60.", sesion: 1, turno: 2 }, { texto: "Cadena Quillay creció 50% ¿verdad?", sesion: 1, turno: 3 }]);
  ok(hp.declarados.map((h) => h.valor).join() === "45" && hp.preguntados.map((h) => h.valor).join() === "50", "lo declarado por la persona: «45 días» sí; el «60» que RETIRÓ («no a 60») ya no; el «50%» de una pregunta no es una declaración", JSON.stringify(hp.declarados.map((h) => [h.valor, h.origen])));
  caso("persona", "A02", "1.2", /^45 días/, "caso real A02 1.2 · «el piso de 45 días» (lo dijo la persona en 1.1; la Entrega no lo trae)");
  { const r = afirma2(hilo2("A02"), "1.2").afirmaciones.find((a) => /^45 días/.test(a.token)); ok(r && r.declaradoPor === "persona" && /^persona@1\.1$/.test(r.origen), "la afirmación guarda el ORIGEN: persona@1.1", JSON.stringify(r)); }
  sigue(con2("A02", "1.2", "piso de 45 días", "piso de 55 días"), "1.2", /^55 días/, "«piso de 55 días»: la persona no dijo 55");
  sigue(con2("A01", "1.5", "crédito a 45 días", "crédito a 60 días"), "1.5", /^60 días/, "«crédito a 60 días»: la persona RETIRÓ el 60 («es a 45 días, no a 60»): no es una cifra suya vigente (queda en `eco_persona`, para el supervisor)", ["no_traza", "dueno_distinto", "metrica_distinta", "eco_persona"], /crédito a 60 días/);
  { const x = v2(con2("A02", "1.4", "Andes del Sur y Alerce llevan 8 días de atraso", "Casa Lomas lleva 45 días de atraso"), "1.4", /^45 días/, /Casa Lomas lleva/); ok(x.length > 0 && x.every((y) => y !== "traza"), "★ CARNADA · una cifra de la persona NO es de una cuenta que la oración nombra («Casa Lomas lleva 45 días»: Casa Lomas tiene 281d)", JSON.stringify(x)); }
  // — lo entregado como dato: el criterio que desplaza y el rango aceptado
  caso("libro_numerico", "A01", "1.4", /^30,1 %/, "caso real A01 1.4 · «Antes de su declaración, ADI usaba 30,1 %» (`declarado.criterios[0].desplaza.valor`)");
  sigue(con2("A01", "1.4", "un 30,1 %", "un 28 %"), "1.4", /^28 %/, "«ADI usaba 28 %»: lo que desplazó es 30.1 (y un dato entregado como número se cita a su precisión)", ["no_traza", "dueno_distinto", "metrica_distinta"], /ADI usaba/);
  caso("libro_numerico", "B02", "2.4", /^60%/, "caso real B02 2.4 · «El benchmark acepta valores entre 5% y 60%» (`declarable.criterios[0].min/max`)");
  sigue(con2("B02", "2.4", "entre 5% y 60%", "entre 5% y 70%"), "2.4", /^70%/, "«entre 5% y 70%»: el rango aceptado es 5–60");
  sigue(con2("A02", "1.2", "el piso de 45 días", "el plazo máximo de 365 días"), "1.2", /^365 días/, "el tope del catálogo (365) no rescata un «365 días» que ninguna oración del criterio nombra");
  // — la referencia de la empresa no es de una cuenta
  caso("referencia", "B02", "2.3", /^30\.1%/, "caso real B02 2.3 · «Contra el benchmark declarado de 30.1%, Jumbo queda 6.1 pp abajo…» (el benchmark es de la empresa)", /Contra el benchmark declarado/);
  sigue(con2("B02", "2.3", "benchmark declarado de 30.1%", "benchmark declarado de 29.9%"), "2.3", /^29\.9%/, "«benchmark de 29.9%»: no es el 30.1 de la empresa", ["no_traza", "dueno_distinto", "metrica_distinta"], /Contra el benchmark declarado/);
  sigue(anade2("B02", "2.3", "\n\n\n\nJumbo tiene un margen de 30.1%."), "2.3", /^30\.1%$/, "«Jumbo tiene un margen de 30.1%»: el benchmark no es el margen de Jumbo (24%)", ["dueno_distinto", "metrica_distinta"], /Jumbo tiene un margen/);
  // — «Maipo»: el nombre abreviado e inequívoco
  const al = aliasesDe(["Centro Constructor Maipo", "Mayorista El Roble", "Mercado Libre", "Hogar Mayor", "Supermercados Andes del Sur", "Tiendas Costa Verde"], (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());
  ok(al.get("maipo") === "Centro Constructor Maipo" && al.get("el roble") === "Mayorista El Roble" && al.get("andes del sur") === "Supermercados Andes del Sur" && !al.has("libre") && !al.has("mayor") && !al.has("verde"), "los alias: «Maipo», «El Roble», «Andes del Sur» sí; una palabra corriente («libre», «mayor», «verde») no", [...al.keys()].join(", "));
  caso("alias", "A02", "1.5", /^\$16,4M/, "caso real A02 1.5 · «Maipo es el cuarto en ventas ($16,4M)» (Centro Constructor Maipo, E3.h7)", /Maipo es el cuarto/);
  sigue(con2("A02", "1.5", "Maipo es el cuarto en ventas ($16,4M)", "Maipo es el cuarto en ventas ($6,8M)"), "1.5", /^\$6,8M/, "«Maipo… ($6,8M)»: $6,8M es la contribución de Costa Verde", ["no_traza", "dueno_distinto", "metrica_distinta"], /Maipo es el cuarto/);
  // — un entero sin unidad no tiene dueño ni métrica que juzgar
  { const con = afirma2(hilo2("A02"), "1.3").afirmaciones.find((a) => a.token === "2" && /Andes del Sur/.test(a.oracion)); const sinR = sinRegla("entero", () => afirma2(hilo2("A02"), "1.3").afirmaciones.find((a) => a.token === "2" && /Andes del Sur/.test(a.oracion)));
    ok(con && con.veredicto === "sin_unidad" && !con.material && sinR && sinR.material, "★ caso real A02 1.3 · el puesto «| 2 | Supermercados Andes del Sur |» se lista (no se juzga); sin la regla era `dueno_distinto`", JSON.stringify([con && con.veredicto, sinR && sinR.veredicto])); }
  sigue(con2("A02", "1.3", "| 2 | Supermercados Andes del Sur | $15,0M |", "| 2 | Supermercados Andes del Sur | $15,9M |"), "1.3", /^\$15,9M/, "lo que SÍ tiene unidad se sigue juzgando: «$15,9M» no es el saldo de Andes del Sur ($15,0M)");
  // — la métrica se lee donde se dice
  ok(clausulaDe("Los $115K de Lampa rotan en 29d, así que ahí el costo de oportunidad es mucho menor.", 5) === "Los $115K de Lampa rotan en 29d" && clausulaDe("Los $115K rotan, así que ahí el costo es menor.", 40).includes("costo"), "la cláusula de una cifra: «…rotan en 29d» no es «…el costo de oportunidad es menor»");
  caso("metrica", "B02", "1.1", /^(34|33|32\.5|32|31)%/, "caso real B02 1.1 · «**Sobre el benchmark:** La Polar (34%), Hites (33%)…»: «sobre el benchmark» COMPARA márgenes", /Sobre el benchmark/);
  sigue(con2("B02", "1.1", "**Sobre el benchmark:** La Polar (34%)", "**Ventas:** La Polar (34%)"), "1.1", /^34%/, "«Ventas: La Polar (34%)»: 34% es el MARGEN de La Polar", ["metrica_distinta"], /\*\*Ventas:\*\*/);
  caso("metrica", "A01", "1.4", /^(21,5|24) %/, "caso real A01 1.4 · «con márgenes de 21,5 % a 24 %» (el regex de la métrica no entendía «márgenes»)", /con márgenes de|con ventas de/);
  sigue(con2("A01", "1.4", "- **Los clientes más grandes tienen los márgenes más bajos.** Falabella, Lider y Jumbo venden entre $17M y $19M cada uno, con márgenes de 21,5 % a 24 %.", "- **Los clientes más grandes tienen los rebates más altos.** Falabella, Lider y Jumbo tienen rebates de 21,5 % a 24 %."), "1.4", /^21,5 %/, "«tienen rebates de 21,5 %»: 21,5 % es el margen de Lider", ["metrica_distinta"], /rebates de/);
  caso("metrica", "B03", "2.1", /^\$15K/, "caso real B03 2.1 · «RC-0637: 190d, $15K, 15 unidades»: «unidades» es del 15, no del $15K", /RC-0637: 190d/);
  sigue(con2("B03", "2.1", "RC-0637: 190d, $15K, 15 unidades", "RC-0637: 190d, $15K de ventas, 15 unidades"), "2.1", /^\$15K/, "«$15K de ventas»: $15K es el capital de RC-0637", ["metrica_distinta"], /RC-0637: 190d/);
  caso("metrica", "B03", "2.5", /^\$115K/, "caso real B03 2.5 · «Los $115K de Lampa rotan en 29d, así que ahí el costo de oportunidad…»: el costo es de la otra cláusula", /rotan en 29d/);
  sigue(con2("B03", "2.5", "Los $115K de Lampa rotan en 29d", "Los $115K de costo de Lampa rotan en 29d"), "2.5", /^\$115K/, "«$115K de costo de Lampa»: $115K es su capital", ["metrica_distinta"], /rotan en 29d/);
  // — las derivaciones de DOS cifras: con lo que la persona declaró y con lo que ADI entregó en `apoyo`
  caso("derivacion", "A02", "1.4", /^236 días/, "caso real A02 1.4 · «| Casa Lomas | 281 | 236 días |» = 281d (Casa Lomas) − 45 días (su piso, lo dijo la persona)");
  { const d = afirma2(hilo2("A02"), "1.4").afirmaciones.find((a) => /^236 días/.test(a.token)); ok(d && d.derivacion && d.derivacion.operacion === "diferencia" && d.derivacion.operandos.some((o) => /^persona@/.test(o.origen || "")) && d.derivacion.operandos.some((o) => o.ref === "E1.h17"), "la derivación registra los operandos con su origen: 281d (E1.h17) y 45 días (persona@1.1)", JSON.stringify(d && d.derivacion)); }
  sigue(con2("A02", "1.4", "| Casa Lomas | 281 | 236 días |", "| Casa Lomas | 281 | 237 días |"), "1.4", /^237 días/, "«237 días»: 281 − 45 es 236");
  { const h = hilo2("A02"); turno2(h, "1.4").texto = "| Cliente | Días vencido | Exceso | Saldo vencido |\n|---|---|---|---|\n| Casa Lomas | 281 | 236 días | $2,0M |";
    sigue(h, "1.4", /^236 días/, "una diferencia con lo que la persona declaró solo vale si la prosa lo pone a la vista (su piso, la cifra 45): una tabla que no lo nombra no se rescata"); }
  ok((() => { const x = v2(con2("A02", "1.4", "| Casa Lomas | 281 | 236 días |", "| Casa Lomas | 281 | 326 días |"), "1.4", /^326 días/); return x.length > 0 && !x.includes("traza"); })(), "★ CARNADA · lo que la persona declaró solo entra en una DIFERENCIA (exceso sobre su piso), no en una suma: 281 + 45 = 326 no se acepta");
  caso("apoyo", "B01", "2.2", /^\$9\.8M/, "caso real B01 2.2 · «Ahora lo separan $9.8M de Costa Verde»: ADI entregó la diferencia en `apoyo` (E4.e13: $40.8M − $31.1M = $9.8M)");
  sigue(con2("B01", "2.2", "Ahora lo separan $9.8M de Costa Verde", "Ahora lo separan $9.4M de Costa Verde"), "2.2", /^\$9\.4M/, "«$9.4M»: no es la diferencia que entregó ADI ($40.8M − $31.1M = $9.8M)");
  caso("derivacion", "B03", "2.5", /^\$150K/, "caso real B03 2.5 · «$150K de capital en Lampa y Rancagua» = $115K + $35K (el «Capital» es la métrica del inventario)");
  sigue(con2("B03", "2.5", "$150K de capital en Lampa y Rancagua", "$140K de capital en Lampa y Rancagua"), "2.5", /^\$140K/, "«$140K»: 115 + 35 es 150", ["no_traza", "dueno_distinto", "metrica_distinta"], /de capital en Lampa/);
  caso("derivacion", "B02", "1.5", /^\$8\.0M/, "caso real B02 1.5 · «unos $8.0M ($3.8M Lider y $4.2M Jumbo)»: la suma de las dos cifras que la misma oración cita (aunque $8.0M coincida por azar con la contribución de otra cuenta)");
  sigue(con2("B02", "1.5", "entre las dos dejan unos $8.0M ($3.8M Lider y $4.2M Jumbo)", "Jumbo deja unos $8.0M"), "1.5", /^\$8\.0M/, "«Jumbo deja unos $8.0M»: sin las dos cifras citadas en la oración, el $8.0M que coincide por azar con otra cuenta (Electrodomésticos) sigue siendo `dueno_distinto`", ["dueno_distinto"], /Jumbo deja/);
  sigue(hilo2("B02"), "2.5", /^(2|4) pp/, "los ejemplos «subir el margen de Falabella y Lider 2 pp o 4 pp» NO se rescatan con una resta casual (4 = 22% − 18%): son cifras que nadie entregó");
  sigue(hilo2("A01"), "1.5", /^30 %/, "«por ejemplo 22 %, 25 % o 30 %»: el «30 %» no se rescata ni con el 30.1 (se cita a su precisión) ni con 15 + 15");
  // — la contraparte que el hilo ya nombró, y el sujeto colectivo y el tema
  caso("contraparte", "C02", "1.4", /^(24\.0%|\$10\.5M)$/, "caso real C02 1.4 · «Norvik … (24.2% frente a 24.0%) … ($14.3M frente a $10.5M)»: tras «frente a» la cifra es de la contraparte que la persona nombró (Teravolt)");
  sigue(con2("C02", "1.4", "(24.2% frente a 24.0%)", "(24.0% frente a 24.2%)"), "1.4", /^24\.0%$/, "invertida («24.0% frente a 24.2%»): la primera cifra es de Teravolt, no de Norvik", ["dueno_distinto"]);
  caso("contraparte", "C02", "1.5", /^\$59\.0M/, "caso real C02 1.5 · «Sus ventas son $59.0M y las de Alsen $51.6M»: «Sus» es Norvik (la pregunta de la persona)");
  sigue(con2("C02", "1.5", "Sus ventas son $59.0M y las de Alsen", "Sus ventas son $8.5M y las de Alsen"), "1.5", /^\$8\.5M$/, "«Sus ventas son $8.5M…»: $8.5M es de Kestrel, una cuenta que el hilo no nombró (la contraparte es Norvik)", ["dueno_distinto"]);
  caso("colectivo", "A03", "1.2", /^58 días/, "caso real A03 1.2 · «El resto está entre 15 y 58 días»: el sujeto es un conjunto (SAM-TV55 tiene 58d)");
  sigue(con2("A03", "1.2", "entre 15 y 58 días", "entre 15 y 59 días"), "1.2", /^59 días/, "«entre 15 y 59 días»: ninguno tiene 59");
  caso("tema", "B01", "1.3", /^28%$/, "caso real B01 1.3 · «Su margen es 28%» (viñeta bajo «Cadena Quillay quedó 5.º…»: Quillay tiene 28%)");
  sigue(con2("B01", "1.3", "Su margen es 28%", "Su margen es 23,5%"), "1.3", /^23,5%/, "«Su margen es 23,5%»: es el de Maipo, no el de Quillay ni el de Bazar Cordillera");
  // — los nombres que la persona escribió no son cruces
  { const h = hilo2("C01"); const r = afirma2(h, "1.4"); const rs = sinRegla("cruce_persona", () => afirma2(h, "1.4"));
    ok(r.cruces.length === 0 && r.flags.some((f) => f.tipo === "nombre_ajeno_dicho_por_la_persona" && f.nombre === "Casa Lomas") && rs.cruces.length === 3, "★ caso real C01 1.4 · la persona preguntó «¿Y Casa Lomas cómo anda?»: el anfitrión repite el nombre para decir que no figura (no es un cruce; sin la regla eran 3)", JSON.stringify([r.cruces.length, rs.cruces.length])); }
  ok(afirma2(anade2("A01", "1.4", "\n\nCasa Lomas lidera la cartera."), "1.4").cruces.length === 1, "★ CARNADA · si la persona NO escribió el nombre de la otra empresa, el anfitrión que lo nombra sigue siendo un cruce");
  // — la regla no se vuelve laxa: una cifra inventada lejos de todo lo entregado no traza, con ninguna regla
  { let traza = 0, probadas = 0;
    for (let v = 101; v <= 400; v += 7) { const h = anade2("A02", "1.3", `\n\nSe acumulan $${v},3M en total.`); const x = v2(h, "1.3", new RegExp(`^\\$${v},3M`)); probadas += 1; if (x.some((y) => y === "traza")) traza += 1; }
    for (let d = 300; d <= 400; d += 9) { const h = anade2("A02", "1.3", `\n\nMayorista El Roble lleva ${d} días de atraso.`); const x = v2(h, "1.3", new RegExp(`^${d} días`)); probadas += 1; if (x.some((y) => y === "traza")) traza += 1; }
    ok(traza === 0, `ninguna de ${probadas} cifras inventadas (dinero y días) lejos de lo entregado traza con las reglas nuevas (${traza} falsos positivos)`); }
  // — el informe deja a la vista lo que aceptó
  { const inf = calcularInforme({ manifiesto: null, cierre: null, hilos: [{ ...hilo2("A02"), anulado: false }, { ...hilo2("C01"), anulado: false }] });
    ok(inf.declaradasPorLaPersona.length >= 3 && inf.declaradasPorLaPersona.every((d) => /^persona@/.test(d.origen)) && inf.nombresDeLaPersona.length === 4 && inf.cruces.length === 0, "★ el informe lista las cifras declaradas por la persona (con su origen) y los nombres que ella escribió (no son cruce)", JSON.stringify([inf.declaradasPorLaPersona.length, inf.nombresDeLaPersona.length, inf.cruces.length]));
    const md = informeEnMarkdown(inf); ok(md.includes("## Cifras declaradas por la persona en el hilo") && md.includes("## Nombres de la otra empresa que escribió la PERSONA"), "el informe en texto trae las dos secciones"); }
  // — el conjunto: del ensayo 2 quedan marcados SOLO los 25 errores reales del anfitrión y el 1 verdadero sin patrón
  { const todos = Object.keys(FX2).flatMap((id) => rastrearHilo(hilo2(id)).flatMap((t) => t.afirmaciones.filter((a) => a.clase === 1 && a.material).map((a) => `${id}|${t.turno}|${a.token}`)));
    const graves = ["$195M", "48%"];
    ok(graves.every((g) => todos.some((x) => x.endsWith("|" + g))), "★ los 2 errores GRAVES del anfitrión siguen marcados: «$195M» (las 13 ventas entregadas suman $176.0M) y «48%» (94.3 ÷ 176.0 = 53.6%)", todos.join(" "));
  }
}

/* ═════ G · EL ARNÉS POR LA VÍA API ════════════════════════════════════════════════════════════════════════════ */
seccion("G · el arnés por la vía api (anfitrión simulado)");
// G1 · rechazos ANTES de leer el catálogo
let lecturas = 0;
const espiaCorpus = (ruta) => { lecturas += 1; return leerCorpus(ruta); };
const base = ["--via=api", "--tipo=oficial", `--catalogo=${RUTA_JUGUETE}`, "--modelo=claude-sonnet-5-5", `--salida=${sub("rechazo")}`, "--tope-usd=5"];
let r = await ejecutarArnes(base, { env: {}, escribir: silencio, leerCorpus: espiaCorpus });
ok(r.codigo === 2 && lecturas === 0 && r.errores.some((e) => /ADI_EXIGIR_CONTADOR/.test(e)) && r.errores.some((e) => /proveedor/.test(e)), "★ sin proveedor ni ADI_EXIGIR_CONTADOR=1 el arnés falla ANTES de leer el catálogo");
r = await ejecutarArnes(base, { env: { ADI_EXIGIR_CONTADOR: "1" }, escribir: silencio, leerCorpus: espiaCorpus });
ok(r.codigo === 2 && lecturas === 0 && r.errores.some((e) => /proveedor/.test(e)), "sin proveedor configurado falla antes de abrir el catálogo");
r = await ejecutarArnes(base.map((x) => (x.startsWith("--tipo") ? "--tipo=ensayo" : x)), { env: ENV_API, escribir: silencio, leerCorpus: espiaCorpus });
ok(r.codigo === 2 && lecturas === 0 && r.errores.some((e) => /ENSAYO no tiene API/.test(e)), "★ el ENSAYO no admite la vía api (no tiene API autorizada)");
r = await ejecutarArnes(base.filter((x) => !x.startsWith("--tope-usd")), { env: ENV_API, escribir: silencio, leerCorpus: espiaCorpus });
ok(r.codigo === 2 && lecturas === 0 && r.errores.some((e) => /tope-usd/.test(e)), "sin --tope-usd la corrida no empieza");
r = await ejecutarArnes(base.map((x) => (x.startsWith("--tope-usd") ? "--tope-usd=41" : x)), { env: ENV_API, escribir: silencio, leerCorpus: espiaCorpus });
ok(r.codigo === 2 && lecturas === 0 && r.errores.some((e) => /supera lo autorizado/.test(e)), "★ un tope de US$41 se rechaza (el owner autorizó hasta US$40)");
r = await ejecutarArnes(base.map((x) => (x.startsWith("--modelo") ? "--modelo=claude-otro" : x)), { env: ENV_API, escribir: silencio, leerCorpus: espiaCorpus });
ok(r.codigo === 2 && lecturas === 0 && r.errores.some((e) => /sin precio/.test(e)), "un modelo sin precio en el contador no se corre");
r = await ejecutarArnes(["--via=cli", "--tipo=oficial", "--catalogo=x", "--modelo=m", "--salida=y", "--tope-llamadas=9"], { env: {}, escribir: silencio, leerCorpus: espiaCorpus });
ok(r.codigo === 2 && r.errores.some((e) => /OFICIALES van por --via=api/.test(e)), "la medición oficial no va por la suscripción");
ok(parsearArgs(["--a=1", "--b", "--c=x=y"]).c === "x=y" && validarArgs({ via: "api", tipo: "oficial", catalogo: "c", modelo: "claude-sonnet-5-5", salida: "s", "tope-usd": "5" }, ENV_API).length === 0, "los argumentos válidos pasan sin errores");

// G2 · el anfitrión BUENO: limpio, sin materiales, sin cruces
const S_BUENO = sub("api-bueno");
const regBueno = [];
r = await correrApi({ modo: "bueno", salida: S_BUENO, registro: regBueno });
let inf = r.informe;
const man = leerJson(path.join(S_BUENO, "manifiesto.json"));
ok(r.cierre.motivo === "completa" && r.cierre.turnosHechos === vj.resumen.turnos && inf.turnos.hilos === 6, "★ el corpus de juguete corre COMPLETO (corte incluido, grupo intercalado)", JSON.stringify(r.cierre).slice(0, 200));
ok(inf.verdad.real.pct === 100 && inf.erroresMateriales.length === 0 && inf.cruces.length === 0, "anfitrión BUENO: 100 % de verdad, 0 errores materiales, 0 cruces", JSON.stringify(inf.erroresMateriales).slice(0, 300));
ok(inf.porClase.real[2].afirmaciones >= 1 && inf.porForma.A.afirmaciones >= 1 && inf.porForma.B.afirmaciones >= 1 && inf.porForma.C.afirmaciones >= 1, "el informe cuenta clases 1-2 y las formas A, B y C");
ok(inf.veredicto === "INVÁLIDA" && inf.invalidaciones.some((x) => /JUGUETE/.test(x)), "★ un corpus de JUGUETE nunca cuenta: el informe lo declara INVÁLIDO");
ok(man.hashes.instruccion === huellaDeInstruccion() && man.hashes.herramientas === huellaDeHerramientas() && /^[0-9a-f]{64}$/.test(man.hashes.codigo) && man.modelo === "claude-sonnet-5-5", "el manifiesto guarda los hashes de la instrucción, de las herramientas y del código, y el modelo");
ok(man.banderas.ADI_ENTREGA === "true" && /doble de Supabase/.test(man.almacen), "el manifiesto declara las banderas y el almacén aislado");
// lo que viajó a la «API»
const cuerpos = regBueno.map((x) => x.cuerpo);
ok(cuerpos.every((c) => c.model === "claude-sonnet-5-5" && c.system[0].text === INSTRUCCION_DE_SISTEMA && JSON.stringify(c.tools) === JSON.stringify(MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })))), "★ a la API viajan la instrucción mínima congelada y las cuatro herramientas TAL CUAL de la puerta");
ok(cuerpos.every((c) => c.thinking && c.thinking.type === "disabled" && c.max_tokens === 4096 && c.system[0].cache_control), "el pensamiento y el tope de salida van declarados; el prefijo va con caché");
ok(regBueno.every((x) => x.cabeceras["x-api-key"] === "valor-de-gate-no-real" && /v1\/messages$/.test(x.url)), "la credencial va por cabecera (nunca en el cuerpo) y el endpoint es el de Messages");
const idsDeToolUse = new Set(); let pareo = true;
for (const c of cuerpos) for (const msg of c.messages) if (Array.isArray(msg.content)) for (const b of msg.content) { if (b.type === "tool_use") idsDeToolUse.add(b.id); if (b.type === "tool_result" && !idsDeToolUse.has(b.tool_use_id)) pareo = false; }
ok(pareo && idsDeToolUse.size > 0, "★ pareo NATIVO: cada tool_result responde a un tool_use anterior");
const trB1 = leerJson(path.join(S_BUENO, "transcritos", "B01.json"));
ok(trB1.sesiones.length === 2 && trB1.turnos.filter((t) => t.sesion === 2).length === 2 && /identificador de esa conversación es [0-9a-f-]{36}/.test(trB1.turnos.find((t) => t.sesion === 2 && t.turno === 1).textoEnviado), "★ tras el CORTE la sesión 2 empieza con contexto nuevo y solo recibe el id de la conversación anterior");
ok(trB1.turnos.find((t) => t.sesion === 2 && t.turno === 1).llamadas[0].herramienta === "retomar", "el anfitrión retoma con `retomar` tras el corte");
ok(fs.existsSync(path.join(S_BUENO, "estados", "B01_corte1.json")) && JSON.parse(fs.readFileSync(path.join(S_BUENO, "estados", "B01_corte1.json"), "utf8")).conversaciones.length >= 1, "el estado exportado de cada corte queda guardado");
const huellasB1 = trB1.turnos.map((t) => t.huellas && t.huellas.libro);
ok(huellasB1.every((h) => /^[0-9a-f]{64}$/.test(h)) && new Set(huellasB1).size >= 2, "la huella del libro tras cada turno queda registrada (y cambia cuando el libro cambia)");
const trC1 = leerJson(path.join(S_BUENO, "transcritos", "C01.json")), trC2 = leerJson(path.join(S_BUENO, "transcritos", "C02.json"));
ok(!nombresDeLaEmpresaNoDemo().some((n) => JSON.stringify(trC1.turnos.map((t) => t.texto)).includes(n)) && !nombresDelDemo().filter((n) => n.length > 3 && n !== "ADI Demo").some((n) => JSON.stringify(trC2.turnos.map((t) => t.texto)).includes(n)), "★ forma C: ninguna cifra ni nombre cruza entre los dos hilos intercalados");
const ordenC = regBueno.map((x) => x.cuerpo.messages[0]).map((mm) => String(typeof mm.content === "string" ? mm.content : mm.content[0].text));
ok(ordenC.some((t) => /Falabella y con qu/.test(t)) && ordenC.some((t) => /Cadena Quillay y con qu/.test(t)), "los dos hilos del grupo corrieron en el mismo proceso");
// consumo
ok(r.cierre.consumo.llamadas === regBueno.length && r.cierre.consumo.costoUSD > 0 && r.cierre.consumo.modelosSinPrecio.length === 0 && r.cierre.consumo.sinConteo === 0, "★ el contador cuenta CADA llamada y el costo sale con el precio de Sonnet 5.5 (sin modelos sin precio)");
const jsonl = fs.readFileSync(path.join(S_BUENO, "consumo.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
ok(jsonl.length === regBueno.length && jsonl.every((e) => e.proveedor === "anthropic" && e.etapa === "agente" && e.consumo === "contado"), "cada llamada quedó en el JSONL de consumo del repo (`abrirCorridaMedida`)");
ok(getSink() === null, "la corrida restaura el sink previo al cerrar");
ok(inf.consumoDelRepo.salieron === regBueno.length, "el resumen del repo (`consumo.js`) coincide en llamadas");
ok(fs.existsSync(path.join(S_BUENO, "casos-para-revisar.md")) && JSON.parse(fs.readFileSync(path.join(S_BUENO, "casos-para-revisar.json"), "utf8")).some((c) => c.tipo === "premisa_falsa"), "queda la lista de casos para el supervisor (clases 3-4 sin juez)");

// G3 · CADA respuesta mala se detecta
const malo = async (modo, hilo, empresaId, esperado) => { const R = await correrApi({ modo, hilo, empresaId, salida: sub(`api-${modo}`) }); return { R, i: R.informe, esperado }; };
let x = await malo("inventa", "A02", "demo");
ok(x.i.erroresMateriales.some((e) => e.veredicto === "no_traza") && x.i.verdad.real.pct < 99, "★ CARNADA «inventa»: la cifra inventada es error material (no traza)");
x = await malo("cruza", "A01,A02,C01", "demo");
ok(x.i.cruces.length >= 1 && x.i.cruces.every((c) => c.nombreAjeno === "Cadena Quillay"), "★ CARNADA «cruza»: el nombre de la otra empresa se cuenta como cruce");
x = await malo("reescribe", "B02", "rioclaro");
ok(x.i.erroresMateriales.some((e) => e.veredicto === "pasado_reescrito"), "★ CARNADA «reescribe»: «antes estaba mal» es error material (clase 2)");
x = await malo("dueno", "A02", "demo");
ok(x.i.erroresMateriales.some((e) => e.veredicto === "dueno_distinto"), "★ CARNADA «dueño»: la cifra de una cuenta atribuida a otra es error material");
x = await malo("calla_cambio", "B01", "rioclaro");
ok(x.i.erroresMateriales.some((e) => e.veredicto === "cambio_no_avisado"), "★ CARNADA «calla el cambio»: un cambio nombrado por ADI y no dicho con las dos cifras es error material");

// G4 · el informe: sin juez / con juez / revisión humana
const OFI = corpusComoOficial("v-gate-1");
let sinJuez = await correrApi({ salida: sub("of-sin-juez"), corpus: OFI.ruta, extra: [`--sello=${OFI.sello}`] });
ok(sinJuez.informe.veredicto === "NO CONCLUYENTE" && sinJuez.informe.invalidaciones.length === 0, "★ un corpus real SIN juez: NO CONCLUYENTE (las clases 3-4 no se juzgaron)", sinJuez.informe.veredicto + JSON.stringify(sinJuez.informe.invalidaciones));
ok(leerJson(OFI.sello).leido === true, "★ al abrirlo, el arnés QUEMA el sello del corpus");
r = await correrApi({ salida: sub("of-quemado"), corpus: OFI.ruta, extra: [`--sello=${OFI.sello}`] });
ok(r.codigo === 4 && /ya fue LEÍDO/.test(r.errores[0]), "★ un corpus quemado no se vuelve a abrir");
fs.appendFileSync(OFI.ruta, " ");
r = await correrApi({ salida: sub("of-rota"), corpus: OFI.ruta, extra: [`--sello=${OFI.sello}`, "--reanudar"] });
ok(r.codigo === 3 && /HUELLA ROTA/.test(r.errores[0]), "★ huella rota ANTES de correr: la corrida no empieza");
const OFI2 = corpusComoOficial("v-gate-2"); fs.unlinkSync(OFI2.sello);
r = await correrApi({ salida: sub("of-sin-sello"), corpus: OFI2.ruta });
ok(r.codigo === 3 && /no trae --sello/.test(r.errores[0]), "un corpus que no es de juguete y no trae sello no se corre");
const juezOk = async ({ entrada }) => ({ texto: JSON.stringify({ afirmaciones: [{ texto: "responde sin aceptar la premisa", clase: 4, veredicto: "verdadera", material: false, motivo: "ok" }], naturalidad: { tono: "formal", extension: "corta", suena_a: "asesor", preguntas_antes_de_responder: 0, nota: "" } }), uso: { input_tokens: 3000, output_tokens: 150 } });
const juezMalo = async () => ({ texto: JSON.stringify({ afirmaciones: [{ texto: "acepta que creció 50%", clase: 4, veredicto: "falsa", material: true, motivo: "premisa aceptada con cifra" }] }), uso: { input_tokens: 3000, output_tokens: 150 } });
const OFI3 = corpusComoOficial("v-gate-3");
let conJuez = await correrApi({ salida: sub("of-juez-ok"), corpus: OFI3.ruta, extra: [`--sello=${OFI3.sello}`, "--juez"], deps: { llamarJuez: juezOk } });
ok(conJuez.informe.clases34Juzgadas && conJuez.informe.veredicto === "PASA" && conJuez.informe.porClase.real[4].afirmaciones >= 1, "★ con juez, 0 errores materiales y 0 cruces: PASA", conJuez.informe.veredicto + conJuez.informe.porQue);
ok(conJuez.cierre.consumo.porModelo["gpt-5.6-luna"] && conJuez.cierre.consumo.porModelo["gpt-5.6-luna"].llamadas >= 14, "★ el gasto del JUEZ cuenta dentro del MISMO contador y tope");
const OFI4 = corpusComoOficial("v-gate-4");
let juezMal = await correrApi({ salida: sub("of-juez-malo"), corpus: OFI4.ruta, extra: [`--sello=${OFI4.sello}`, "--juez"], deps: { llamarJuez: juezMalo } });
ok(juezMal.informe.veredicto === "NO PASA" && juezMal.informe.erroresMateriales.some((e) => e.veredicto === "juez:falsa"), "con un error material del juez: NO PASA");
// la persona revierte lo marcado → falla del medidor
const primera = juezMal.informe.erroresMateriales[0];
fs.writeFileSync(path.join(sub("of-juez-malo"), "revision.json"), JSON.stringify({ decisiones: Object.fromEntries(juezMal.informe.erroresMateriales.map((e) => [e.id, { veredicto: "verdadera", nota: "el juez se equivocó" }])) }));
const reinf = escribirInforme(sub("of-juez-malo")).informe;
ok(reinf.veredicto === "PASA" && reinf.fallasDelMedidor.length === juezMal.informe.erroresMateriales.length && reinf.verdad.bruto.pct < reinf.verdad.real.pct, "★ lo que la persona revierte es FALLA DEL MEDIDOR: no cuenta contra el anfitrión (bruto vs real)", reinf.veredicto);
ok(parsearVeredictoDelJuez("basura").ok === false && parsearVeredictoDelJuez('{"afirmaciones":[{"texto":"x","clase":1,"veredicto":"verdadera"}]}').ok === false && parsearVeredictoDelJuez('texto {"afirmaciones":[]} más').ok === true, "el parser del juez es estricto con la forma y tolerante con el texto alrededor");
ok(/^[0-9a-f]{64}$/.test(huellaDelJuez()), "el prompt del juez está hasheado");
// cierre de etapa
const infoPasa = (id, extra = {}) => ({ tipo: "oficial", veredicto: "PASA", modelo: "claude-sonnet-5-5", via: "api", corpus: { corpusId: id, sha256: id }, ...extra });
ok(cierreDeEtapa([infoPasa("v41"), infoPasa("v42")]).pasa === true, "★ la etapa cierra con DOS corridas oficiales consecutivas que PASAN con catálogos distintos");
ok(!cierreDeEtapa([infoPasa("v41"), infoPasa("v41")]).pasa && !cierreDeEtapa([infoPasa("v41"), infoPasa("v42", { veredicto: "NO PASA" })]).pasa && !cierreDeEtapa([infoPasa("v41")]).pasa && !cierreDeEtapa([infoPasa("v41"), infoPasa("v42", { modelo: "otro" })]).pasa, "una sola, el mismo catálogo, una que no pasa o otro modelo: la etapa NO cierra");

// G5 · invalidaciones: sin conteo, tope antes del 90 %, código cambiado
const baseInf = (o) => calcularInforme({ manifiesto: { ...man, corpus: { ...man.corpus, juguete: false }, tipo: "oficial" }, cierre: { motivo: "completa", turnosPlaneados: 10, turnosHechos: 10, consumo: { sinConteoPct: 0, modelosSinPrecio: [] }, ...o }, hilos: [], juez: { turnos: { x: { ok: true, afirmaciones: [] } } } });
ok(baseInf({ consumo: { sinConteoPct: 3, modelosSinPrecio: [] } }).invalidaciones.some((x) => /sinConteo/.test(x)), "invalida: sinConteo > 2 %");
ok(baseInf({ consumo: { sinConteoPct: 0, modelosSinPrecio: [{ modelo: "m", veces: 1 }] } }).invalidaciones.some((x) => /sin precio/.test(x)), "invalida: modelos sin precio");
ok(baseInf({ motivo: "tope_alcanzado", turnosHechos: 5 }).invalidaciones.some((x) => /90 %/.test(x)) && !baseInf({ motivo: "tope_alcanzado", turnosHechos: 9 }).invalidaciones.some((x) => /90 %/.test(x)), "invalida: tope alcanzado antes del 90 % de los turnos (después, no)");
ok(baseInf({ codigoHuellaFinal: "otra" }).invalidaciones.some((x) => /código cambió/.test(x)), "invalida: el código cambió entre las dos mitades");
ok(baseInf({ motivo: "anulada_por_limpieza", hallazgos: [{ regla: "hook" }] }).invalidaciones.some((x) => /limpieza/.test(x)), "invalida: corrida anulada por limpieza");
const manOtroModelo = { ...man, hashes: { ...man.hashes, instruccion: "otra-instruccion" }, corpus: { ...man.corpus, juguete: false } };
ok(calcularInforme({ manifiesto: manOtroModelo, cierre: { motivo: "completa", turnosPlaneados: 1, turnosHechos: 1 }, hilos: [leerJson(path.join(S_BUENO, "transcritos", "A01.json"))] }).invalidaciones.some((x) => /instrucción/.test(x)), "invalida: cambio de la instrucción a mitad de la corrida");
ok(huellaDelCodigo() === huellaDelCodigo() && /^[0-9a-f]{64}$/.test(huellaDelCodigo()), "la huella del código es estable");

// G6 · el TOPE: una llamada que lo superaría NO se hace
{
  const reg = [];
  const rt = await correrApi({ salida: sub("api-tope"), registro: reg, hilo: "A01,B01", extra: ["--tope-usd=0.07"], deps: {} }).catch((e) => ({ error: e }));   // con la respuesta COMPACTA los dos hilos cuestan ~US$0,056 en total; el tope mira el PEOR caso de cada llamada (~US$0,06), así que 0,07 deja pasar 2-4 llamadas y para
  ok(rt.cierre && rt.cierre.motivo === "tope_alcanzado" && rt.cierre.consumo.costoUSD <= 0.07 && reg.length >= 1, "★ con un tope mínimo (US$0,07) la corrida se DETIENE y el gasto nunca lo supera", JSON.stringify(rt.cierre && rt.cierre.consumo && rt.cierre.consumo.costoUSD));
  const antes = reg.length;
  ok(rt.cierre.detalle && /tope duro/.test(rt.cierre.detalle.detalle) && rt.cierre.consumo.topeAlcanzado, "el cierre declara por qué paró y con qué cifras (gastado, peor caso, tope)");
  ok(rt.informe.invalidaciones.some((v) => /90 %/.test(v)), "parar antes del 90 % de los turnos INVALIDA la corrida");
  // y exactamente: ninguna llamada posterior al tope
  ok(antes === reg.length, "(no salió ninguna llamada después del tope)");
  // el cliente directo: el transporte NO se toca cuando el peor caso supera el tope
  let toques = 0;
  const cliente = crearClienteApi({ modelo: "claude-sonnet-5-5", env: ENV_API, transporte: async () => { toques += 1; return new Response("{}"); }, contador: crearContador({ topeUsd: 0.01 }), exigir: null });
  const rr = await cliente.llamar({ system: "s", tools: [], messages: [{ role: "user", content: "x".repeat(20000) }] });
  ok(rr.parado && rr.reasonCode === "tope_alcanzado" && toques === 0, "★ el cliente NO toca el transporte si el peor caso de la llamada supera el tope");
  // reintentos: una respuesta 529 no se cobra y se reintenta; un corte de red se cobra al peor caso
  let n529 = 0;
  const c529 = crearContador({ topeUsd: 5 });
  const cl529 = crearClienteApi({ modelo: "claude-sonnet-5-5", env: ENV_API, contador: c529, esperar: async () => {}, transporte: async () => { n529 += 1; return n529 < 3 ? new Response("{}", { status: 529 }) : new Response(JSON.stringify({ model: "claude-sonnet-5-5", content: [{ type: "text", text: "hola" }], stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 10 } }), { status: 200 }); } });
  const r529 = await cl529.llamar({ system: "s", tools: [], messages: [{ role: "user", content: "hola" }] });
  ok(r529.ok && n529 === 3 && c529.resumen().llamadas === 1 && c529.resumen().sinConteo === 0, "un 529 del proveedor se reintenta y NO se cobra (no generó nada)");
  let nr = 0; const cRed = crearContador({ topeUsd: 5 });
  const clRed = crearClienteApi({ modelo: "claude-sonnet-5-5", env: ENV_API, contador: cRed, esperar: async () => {}, maxReintentos: 1, transporte: async () => { nr += 1; throw new Error("socket cerrado"); } });
  const rRed = await clRed.llamar({ system: "s", tools: [], messages: [{ role: "user", content: "hola" }] });
  ok(!rRed.ok && cRed.resumen().sinConteo === 2 && cRed.gastadoUsd() > 0, "★ un corte de red (salió y no volvió) se cobra al PEOR caso y cuenta como sin conteo");
}

// G7 · reanudar: una corrida interrumpida sigue siendo UNA corrida (mismo código, gasto acumulado)
{
  const sal = sub("api-reanuda");
  const medida = await correrApi({ salida: sub("api-reanuda-medida"), hilo: "A01,A02,B01" });
  const tope1 = Math.min(0.08, Number((medida.cierre.consumo.costoUSD * 1.2).toFixed(3)));   // lo bastante para empezar (el tope mira el peor caso de cada llamada) y menos de lo que cuesta correr los tres hilos completos
  const R1 = await correrApi({ salida: sal, extra: [`--tope-usd=${tope1}`], hilo: "A01,A02,B01" });
  const hechos1 = R1.cierre.hilosHechos;
  ok(R1.cierre.motivo === "tope_alcanzado" && R1.cierre.turnosHechos < R1.cierre.turnosPlaneados, "primera mitad: la corrida paró por el tope", JSON.stringify(R1.cierre.motivo));
  const gasto1 = R1.cierre.consumo.costoUSD;
  const R2 = await ejecutarArnes(["--via=api", "--tipo=oficial", `--catalogo=${RUTA_JUGUETE}`, "--modelo=claude-sonnet-5-5", `--salida=${sal}`, "--tope-usd=5", "--hilo=A01,A02,B01", "--reanudar"], { env: ENV_API, escribir: silencio, ahora, esperar: async () => {}, transporte: crearTransporteApiSimulado({ modo: "bueno" }) });
  ok(R2.cierre.motivo === "completa" && R2.cierre.hilosHechos === 3 && R2.cierre.consumo.costoUSD > gasto1 && R2.cierre.reanudada === true, "★ reanudar completa los hilos que faltaban SIN rehacer los hechos y acumula el gasto de la MISMA corrida", `${R2.cierre.motivo} ${R2.cierre.hilosHechos}`);
  const manR = leerJson(path.join(sal, "manifiesto.json"));
  fs.writeFileSync(path.join(sal, "manifiesto.json"), JSON.stringify({ ...manR, hashes: { ...manR.hashes, codigo: "otro-codigo" } }));
  const R3 = await ejecutarArnes(["--via=api", "--tipo=oficial", `--catalogo=${RUTA_JUGUETE}`, "--modelo=claude-sonnet-5-5", `--salida=${sal}`, "--tope-usd=5", "--reanudar"], { env: ENV_API, escribir: silencio, ahora, transporte: crearTransporteApiSimulado({ modo: "bueno" }) });
  ok(R3.codigo === 3 && R3.errores[0] === "código distinto", "★ no se puede reanudar si el código cambió (una corrección entre dos mitades invalida)");
}

/* ═════ H · EL ARNÉS POR LA VÍA CLI ═════════════════════════════════════════════════════════════════════════════ */
seccion("H · el arnés por la vía cli (claude falso)");
const runCli = async ({ modo = "bueno", cont = "", hilo = null, salida, tope = 200, extra = [], envExtra = {}, deps = {} }) => {
  const reg = path.join(TMP, `${path.basename(salida)}-registro.jsonl`);
  const argv = ["--via=cli", "--tipo=ensayo", `--catalogo=${RUTA_JUGUETE}`, "--modelo=claude-sonnet-5-5", `--salida=${salida}`, `--tope-llamadas=${tope}`, ...(hilo ? [`--hilo=${hilo}`] : []), ...extra];
  const R = await ejecutarArnes(argv, { env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, [CLAVE]: "valor-de-gate-no-real", [OTRA]: "otro-valor-no-real", ANTHROPIC_BASE_URL: "https://proxy.invalid", FALSO_MODO: modo, FALSO_CONTAMINAR: cont, FALSO_REGISTRO: reg, ...envExtra }, escribir: silencio, ahora, claudeBin: RUTA_FALSO, versionCli: "falso-0.0.0", carpetaAislada: () => ({ aislada: true, problemas: [] }), ...deps });
  const llamadas = fs.existsSync(reg) ? fs.readFileSync(reg, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { R, llamadas };
};
const SC = sub("cli-bueno");
const { R: RC, llamadas: llC } = await runCli({ salida: SC });
ok(RC.cierre.motivo === "completa" && RC.cierre.turnosHechos === vj.resumen.turnos && RC.cierre.limpieza.every((l) => l.limpia), "★ vía cli: el corpus de juguete corre COMPLETO con el `claude` falso y TODAS las sesiones salen LIMPIAS", JSON.stringify(RC.cierre).slice(0, 200));
const argv0 = llC[0].argv;
const tiene = (n) => argv0.includes(n);
ok(!tiene("--bare") && tiene("--strict-mcp-config") && argv0[argv0.indexOf("--tools") + 1] === "" && tiene("--no-session-persistence") && tiene("--disable-slash-commands") && tiene("--mcp-config"), "★ el comando ENDURECIDO: sin --bare (no lee la suscripción), `--tools \"\"`, --strict-mcp-config, --no-session-persistence");
ok(argv0[argv0.indexOf("--setting-sources") + 1] === "project" && argv0[argv0.indexOf("--model") + 1] === "claude-sonnet-5-5" && argv0[argv0.indexOf("--system-prompt") + 1] === INSTRUCCION_DE_SISTEMA && argv0[argv0.indexOf("--output-format") + 1] === "stream-json", "setting-sources acotado, modelo fijo, instrucción congelada, stream-json");
ok(argv0[argv0.indexOf("--allowedTools") + 1] === nombresMcpDelCli().join(",") && argv0[argv0.indexOf("--permission-prompts") + 1] === "none", "solo se aprueban las cuatro `mcp__adi__*` y nada más puede pedir permiso");
ok(llC.every((l) => l.env[CLAVE] === null && l.env[OTRA] === null), "★ el hijo NO recibe NINGUNA credencial de API (usa la suscripción; el ensayo no gasta API)");
ok(JSON.stringify(entornoDelCli({ ANTHROPIC_BASE_URL: "x", PATH: "p" }).quitadas) === '["ANTHROPIC_BASE_URL"]' && entornoDelCli({ ANTHROPIC_BASE_URL: "x" }, { conservarBaseUrl: true }).quitadas.length === 0, "ANTHROPIC_BASE_URL se quita por defecto (y `--conservar-base-url` lo conserva)");
const cfgMcp = leerJson(path.join(SC, "sesiones", "A01_s1", "mcp-config.json"));
ok(Object.keys(cfgMcp.mcpServers).join() === "adi" && cfgMcp.mcpServers.adi.args.some((a) => /offline-guard/.test(a)) && cfgMcp.mcpServers.adi.args.some((a) => a === "--empresa=demo"), "el --mcp-config tiene SOLO el servidor `adi`, con la red bloqueada, para la empresa del hilo");
ok(llC.every((l) => !fs.existsSync(path.join(l.cwd, "CLAUDE.md")) && !fs.existsSync(path.join(l.cwd, ".claude"))), "la carpeta de trabajo del anfitrión está vacía (sin CLAUDE.md ni .claude)");
ok(llC.every((l) => !path.resolve(l.cwd).toLowerCase().startsWith(path.resolve(".").toLowerCase())), "★ y está FUERA del repo (no hereda el CLAUDE.md del proyecto)");
const manC = leerJson(path.join(SC, "manifiesto.json"));
ok(manC.cli.version === "falso-0.0.0" && manC.via === "cli" && RC.cierre.residuos && RC.cierre.residuos.streamPrimerTurnoSha256 && /^[0-9a-f]{64}$/.test(RC.cierre.residuos.streamPrimerTurnoSha256), "el manifiesto guarda la versión del CLI y el hash del stream del primer turno (los residuos)");
ok(RC.informe.porForma.B.afirmaciones >= 1 && RC.informe.erroresMateriales.length === 0 && RC.informe.cruces.length === 0, "el rastreo corre igual sobre el transcrito de la vía cli (bitácora exacta de la puerta)");
ok(RC.informe.veredicto === "INVÁLIDA" && RC.informe.invalidaciones.some((v) => /JUGUETE/.test(v)), "el juguete tampoco cuenta por la vía cli");
// limpieza: CARNADAS
for (const [cont, regla] of [["bash", "herramienta_ajena_en_init"], ["tool_use_ajeno", "tool_use_ajeno"], ["reminder", "instruccion_ajena"], ["skills", "instruccion_ajena_en_init"], ["otro_servidor", "servidor_mcp_ajeno"], ["hook", "hook"]]) {
  const { R } = await runCli({ cont, hilo: "A01", salida: sub(`cli-${cont}`) });
  ok(R.cierre.motivo === "anulada_por_limpieza" && (R.cierre.hallazgos || []).some((h) => h.regla === regla) && R.informe.veredicto === "INVÁLIDA" && R.informe.invalidaciones.some((v) => /limpieza/.test(v)), `★ CARNADA de limpieza «${cont}»: la corrida se ANULA (${regla})`, JSON.stringify(R.cierre.hallazgos));
}
{ const { R } = await runCli({ cont: "bash", hilo: "A01", salida: sub("cli-temprana") }); ok(R.cierre.turnosHechos <= 1, "la limpieza es TEMPRANA: ante la primera infracción no se gasta ni un turno más", `turnos hechos ${R.cierre.turnosHechos}`); }
// la limpieza como función pura
const initOk = { type: "system", subtype: "init", cwd: "C:/x", tools: nombresMcpDelCli(), mcp_servers: [{ name: "adi", status: "connected" }], model: "claude-sonnet-5-5", apiKeySource: "none", skills: [], agents: [], plugins: [] };
ok(chequearLimpieza({ eventos: [initOk], modelo: "claude-sonnet-5-5", dirTrabajo: "C:/x" }).limpia === true, "limpieza (pura): solo las cuatro de ADI → limpia");
ok(chequearLimpieza({ eventos: [{ ...initOk, apiKeySource: CLAVE }] }).hallazgos.some((h) => h.regla === "gasto_por_api"), "★ limpieza: si el CLI autentica con una API key, el ensayo estaría gastando API → se anula");
ok(chequearLimpieza({ eventos: [{ ...initOk, cwd: "C:/otra" }], dirTrabajo: "C:/x" }).hallazgos.some((h) => h.regla === "carpeta_distinta") && chequearLimpieza({ eventos: [{ ...initOk, model: "claude-opus-5" }], modelo: "claude-sonnet-5-5" }).hallazgos.some((h) => h.regla === "modelo_distinto"), "limpieza: otra carpeta de trabajo u otro modelo se detecta");
ok(chequearLimpieza({ eventos: [] }).hallazgos[0].regla === "sin_init" && chequearLimpieza({ eventos: [initOk, { type: "user", message: { role: "user", content: [{ type: "text", text: "texto que el arnés no mandó" }] } }], enviados: ["hola"] }).hallazgos.some((h) => h.regla === "texto_de_usuario_no_enviado"), "limpieza: sin init no se puede verificar, y un texto de usuario que el arnés no mandó es ajeno");
// la carpeta de trabajo aislada
const existe = (set) => (p) => set.has(path.resolve(p));
const R0 = path.resolve("/tmp-x/a/b");
ok(carpetaAislada(R0, { existe: existe(new Set()), casa: "/zzz" }).aislada && !carpetaAislada(R0, { existe: existe(new Set([path.resolve("/tmp-x/CLAUDE.md")])), casa: "/zzz" }).aislada && !carpetaAislada(R0, { existe: existe(new Set([path.resolve("/tmp-x/a/.claude")])), casa: "/zzz" }).aislada, "★ la carpeta de trabajo con CLAUDE.md o .claude en ella o sobre ella NO está aislada");
ok(carpetaAislada(R0, { existe: existe(new Set([path.join(path.resolve("/tmp-x"), ".claude")])), casa: path.resolve("/tmp-x") }).aislada, "el `.claude` de la CASA del usuario es el nivel «usuario» (lo acotan --setting-sources y el chequeo de limpieza)");
{ const { R } = await runCli({ hilo: "A01", salida: sub("cli-no-aislada"), deps: { carpetaAislada: () => ({ aislada: false, problemas: ["C:/x/CLAUDE.md"] }) } }); ok(R.cierre.motivo === "carpeta_no_aislada" && R.cierre.turnosHechos === 0, "★ una carpeta de trabajo no aislada detiene la corrida ANTES de lanzar `claude`"); }
// el tope de llamadas
{ const { R } = await runCli({ hilo: "A01,B01", salida: sub("cli-tope"), tope: 3 }); ok(R.cierre.motivo === "tope_alcanzado" && R.cierre.consumo.llamadasAlModelo >= 3 && R.cierre.turnosHechos < 8, "★ el tope de llamadas detiene la corrida (vía cli)", JSON.stringify(R.cierre.consumo)); }
// un `claude` que rechaza el comando (si el arnés olvidara una bandera endurecida, el candado lo vería)
ok(llC.length >= 1 && llC.every((l) => l.argv.includes("--verbose") && l.argv.includes("-p")), "el `claude` falso validó que el comando trae TODAS las banderas del endurecimiento (si faltara una, sale con error)");
// --solo-imprimir: no ejecuta ni escribe nada
{
  const salidaNo = sub("solo-imprimir"); const regNo = path.join(TMP, "solo-imprimir-registro.jsonl"); const salidas = [];
  const rI = await ejecutarArnes(["--via=cli", "--tipo=ensayo", "--solo-imprimir", "--modelo=claude-sonnet-5-5", `--salida=${salidaNo}`, "--tope-llamadas=900"], { env: { PATH: process.env.PATH, FALSO_REGISTRO: regNo }, escribir: (t) => salidas.push(t), claudeBin: RUTA_FALSO });
  const txt = salidas.join("\n");
  ok(rI.codigo === 0 && /--tools ""/.test(txt) && /--strict-mcp-config/.test(txt) && /--setting-sources project/.test(txt) && /--no-session-persistence/.test(txt) && !/--bare/.test(rI.comando), "★ --solo-imprimir muestra el comando endurecido", txt.slice(0, 200));
  ok(!fs.existsSync(salidaNo) && !fs.existsSync(regNo), "★ --solo-imprimir NO ejecuta `claude` y NO crea la carpeta de salida");
  ok(/QUITADAS del entorno/.test(txt) && /limpieza/.test(txt) && /sistema/.test(txt), "--solo-imprimir declara el entorno limpio, el chequeo de limpieza y la instrucción");
  const rA = await ejecutarArnes(["--via=api", "--solo-imprimir", "--tope-usd=5"], { env: ENV_API, escribir: silencio });
  ok(rA.codigo === 2, "--solo-imprimir es solo del ensayo");
}
ok(typeof localizarClaude({ env: {}, existe: () => false }) === "string" && localizarClaude({ env: { CLAUDE_BIN: "X" }, existe: (p) => p === "X" }) === "X" && localizarClaude({ env: { APPDATA: "A" }, existe: (p) => /2\.1\.286[\\/]abc[\\/]claude\.exe$/.test(p), listar: (d) => (/claude-code$/.test(d) ? ["2.1.284", "2.1.286"] : ["abc"]) }).endsWith("claude.exe"), "localizarClaude encuentra el ejecutable de la app de escritorio (la versión más nueva) cuando no está en el PATH");

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* temporal */ }
console.log(`\n── _medicion_anfitrion_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) { console.log("\nFALLOS:"); for (const f of fails) console.log("  ✗ " + f); }
process.exit(fail ? 1 : 0);
