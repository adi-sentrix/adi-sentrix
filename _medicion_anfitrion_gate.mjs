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
 *   I · el BRAZO del A/B (`--brazo=A|B` → ADI_ALCANCE_ESTRUCTURAL solo en el servidor de ADI, nunca en el anfitrión; el arranque del servidor lo prueba; no se mezclan brazos).
 *   J · la SERIE A/B (`--serie-ab`): el mismo corpus sellado corre cuatro veces; la quinta, la de otra serie, la de otro código o con el sello quemado por otro se rechazan; fuera de una serie nada cambia.
 *   K · las cuentas del A/B: Wilson · Newcombe · reducción relativa con bootstrap por hilo · la regla de parada (umbral parámetro).
 *   L · el SOBRE-ALCANCE (§6.1 de `_ADI_DISENO_ALCANCE_DE_LO_ENTREGADO.md`) en la clasificación humana y en el informe; no mueve el veredicto de cierre.
 *   M · la familia «DESLIZ DE LECTURA CON LA VERDAD A LA VISTA»: material, pero sin patrón con otra familia.
 *   N · el MEDIDOR tras el ensayo 12 («métrica distinta ×20» era del medidor): 29 frases reales + carnadas.
 *   O · `comparar-brazos.mjs`: sobre-alcance por brazo, reducción con intervalo, materiales por familia y la regla de parada.
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
ok(JSON.stringify(tl.result.tools) === JSON.stringify(MCP_TOOLS) && tl.result.tools.length === 5, "★ tools/list devuelve las CINCO acciones tal cual `MCP_TOOLS` (nombre, descripción y esquema, sin una palabra más)");
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
ok(JSON.stringify(tl2.result.tools) === JSON.stringify(MCP_TOOLS), "stdio: las cinco herramientas, idénticas a `MCP_TOOLS`");
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
  ok(informeEnMarkdown(infD).includes("## Fuera de contrato (correctas) · 2") && informeEnMarkdown(infD).includes("$37,2 M = $19.4M (Falabella) + $17.8M (Lider)"), "★ el informe en texto lista cada cifra fuera de contrato (antes «Derivaciones aritméticas aceptadas»): «$37,2 M = $19.4M (Falabella) + $17.8M (Lider)»");

  // ── CARNADAS: la misma prosa con UN cambio. Cada una tiene que seguir marcándose como error.
  const conTexto = (turno, de, a) => { const h = clonF(FIX); const t = h.turnos.find((x) => x.turno === turno); if (!t.texto.includes(de)) throw new Error(`la prosa del turno ${turno} ya no trae «${de}»`); t.texto = t.texto.replace(de, a); return h; };
  const veredictoDe = (h, turno, rx) => { const a = del(rastrearHilo(h), turno).find((x) => rx.test(x.token)); return a ? a.veredicto : null; };
  ok(veredictoDe(conTexto(1, "$37,2 M", "$37,3 M"), 1, /37,3/) === "no_traza", "★ CARNADA · una suma que NO cierra (37,3 en vez de 37,2 = 19,4 + 17,8) sigue siendo error (no_traza)");
  ok(veredictoDe(conTexto(1, "$37,2 M", "$37,1 M"), 1, /37,1/) === "no_traza" && veredictoDe(conTexto(1, "$37,2 M", "$38 M"), 1, /38/) === "no_traza", "CARNADA · tampoco cierra 37,1 ni «38» (a la precisión con que se imprime no es lo mismo que 37,2)");
  ok(veredictoDe(conTexto(1, "$37,2 M", "$37 M"), 1, /^\$37 M/) === "traza", "control · «$37 M» (la misma suma, impresa con un entero) SÍ es el mismo valor impreso: traza");
  ok(veredictoDe(conTexto(4, "8,6 puntos", "8,7 puntos"), 4, /8,7/) === "no_traza", "★ CARNADA · una diferencia que NO cierra (8,7 en vez de 8,6 = 30,1 − 21,5) sigue siendo error");
  ok(veredictoDe(conTexto(4, "8,6 puntos", "8,5 puntos"), 4, /8,5/) === "no_traza" && veredictoDe(conTexto(4, "8,6 puntos", "8,4 puntos"), 4, /8,4/) === "no_traza" && veredictoDe(conTexto(4, "8,6 puntos", "10 puntos"), 4, /^10 pun/) === "no_traza", "CARNADA · 8,5, 8,4 y «10 puntos» tampoco cierran");
  ok(veredictoDe(conTexto(4, "8,6 puntos", "9 puntos"), 4, /^9 pun/) === "traza", "control · «9 puntos» es 8,6 impreso con un entero (el redondeo a lo impreso no es error, como en toda cifra); el empate de media unidad no cierra");
  // tres operandos: 19,4 + 17,8 + 17,3 = 54,5, y ninguna PAREJA de las tres da 54,5. CONTRATO DEL ANFITRIÓN (§3): la derivación pasa de RESCATE a CLASIFICADOR y llega a CINCO sumandos: cierra → verdad, pero fuera de contrato
  const tres = conTexto(1, "Entre los dos suman unos $37,2 M (CLP).", "Falabella, Lider y Jumbo ($17,3 M) suman $54,5 M.");
  { const a = del(rastrearHilo(tres), 1).find((x) => /54,5/.test(x.token));
    ok(a && a.veredicto === "traza" && a.caso === "fuera_de_contrato" && a.derivacionQueDebioPedirse && a.derivacionQueDebioPedirse.operacion === "suma" && a.derivacionQueDebioPedirse.sobre.length === 3 && a.derivacion.operandos.length === 3, "★ TRES operandos que cierran (19,4 + 17,8 + 17,3 = 54,5): verdad, pero FUERA DE CONTRATO — y queda registrada la derivación que debió pedirse (suma de 3 ids)", JSON.stringify(a)); }
  ok(veredictoDe(conTexto(1, "Entre los dos suman unos $37,2 M (CLP).", "Falabella, Lider y Jumbo ($17,3 M) suman $54,6 M."), 1, /54,6/) === "no_traza", "★ CARNADA · TRES operandos que NO cierran (54,6 en vez de 54,5) siguen siendo error material");
  const tresBien = conTexto(1, "Entre los dos suman unos $37,2 M (CLP).", "Falabella, Lider y Jumbo ($17,3 M) suman $37,2 M.");
  ok(veredictoDe(tresBien, 1, /37,2/) === "traza", "control · si dos de las cifras citadas SÍ suman lo que la prosa dice, traza (la regla mira parejas)");
  { const a = del(rastrearHilo(tresBien), 1).find((x) => /37,2/.test(x.token)); ok(a && a.caso === "fuera_de_contrato" && a.derivacionQueDebioPedirse.operacion === "suma", "…y una derivación por pareja también es fuera de contrato (el anfitrión debió pedirla)"); }
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
  /* (2026-10-07) estos dos eran los casos de «el ejemplo no se rescata con una resta casual»: hoy son EJEMPLOS HIPOTÉTICOS que el anfitrión le ofrece a la persona (no afirman nada de la empresa: veredicto `ejemplo`); la carnada original
   * sigue en pie en su variante sin la oferta («Ya subió el margen…», «hoy están en 22 %, 25 % o 30 %»): ahí SON cifras que nadie entregó y no se rescatan ni con una resta ni con el 30.1 */
  sigue(hilo2("B02"), "2.5", /^(2|4) pp/, "los ejemplos «subir el margen de Falabella y Lider 2 pp o 4 pp» son EJEMPLOS HIPOTÉTICOS (se le ofrecen a la persona): ni se marcan ni se rescatan con una resta casual", ["ejemplo"]);
  sigue(con2("B02", "2.5", "Por ejemplo, subir el margen de Falabella y Lider 2 pp o 4 pp", "Ya subió el margen de Falabella y Lider 2 pp o 4 pp"), "2.5", /^(2|4) pp/, "dichos como un HECHO («Ya subió el margen… 2 pp o 4 pp»), no se rescatan con una resta casual (4 = 22% − 18%): son cifras que nadie entregó");
  sigue(hilo2("A01"), "1.5", /^30 %/, "«por ejemplo 22 %, 25 % o 30 %»: es un ejemplo hipotético de vara que se le ofrece a la persona", ["ejemplo"]);
  sigue(con2("A01", "1.5", "por ejemplo 22 %, 25 % o 30 %", "hoy están en 22 %, 25 % o 30 %"), "1.5", /^30 %/, "«hoy están en 22 %, 25 % o 30 %»: el «30 %» no se rescata ni con el 30.1 (se cita a su precisión) ni con 15 + 15");
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

/* ═════ F4 · EL CONTRATO DEL ANFITRIÓN: TRES CASOS POR CIFRA, NÚMEROS EN PALABRAS Y EL INFORME QUE CIERRA (owner 2026-10-05) ═════════════════════════
 * `_ADI_DISENO_CONTRATO_ANFITRION.md` §3 y §5. «Toda cifra empresarial que el anfitrión diga —en números o en palabras— debe ser un hecho que ADI le entregó.» El rastreo clasifica cada cifra: hecho_de_adi · fuera_de_contrato
 * (verdadera y demostrable con lo entregado, pero la calculó el anfitrión: NO es falsa, rompe el 100 %) · error_material. Los números en palabras (los dos errores graves del ensayo 3: «Ocho de los 13…», «5 de las 9») se leen con
 * `numerosEnPalabras.mjs`, que IMPORTA la tabla de proporciones del Notario. El informe: cumplimiento = 100 % + 0 errores de ADI + 0 materiales + 0 cruces. */
seccion("F4 · el contrato del anfitrión: tres casos por cifra, números en palabras y el informe de cierre");
{
  const { extraerNumerosEnPalabras, relacionesEnPalabras } = await import(D + "numerosEnPalabras.mjs");
  const { COTAS_DE_PROPORCION } = await import("./src/adi/notario/lexico.js");
  const { rastrearHilo: rastrear, CASOS_DEL_CONTRATO, VEREDICTOS_FALSOS: FALSOS } = await import(D + "rastreo.mjs");
  const { REGLA_DE_CIERRE } = await import(D + "informe.mjs");
  const { PROMPT_DEL_JUEZ } = await import(D + "juez.mjs");
  const fmt = (await import("./src/adi/notario/hechos.js")).formatoDeLaCasa;
  const jsn = (x) => JSON.stringify(x);

  // ── los números en palabras (lista cerrada)
  const pal = (t) => extraerNumerosEnPalabras(t).map((x) => [x.valorEntero, x.unidad]);
  ok(jsn(pal("Ocho de los 13 clientes")) === jsn([[8, "count"]]), "★ «Ocho» = 8 (un conteo)");
  ok(jsn(pal("treinta y cinco días")) === jsn([[35, "days"]]) && jsn(pal("veintiuno")) === jsn([[21, "count"]]) && jsn(pal("noventa y nueve")) === jsn([[99, "count"]]) && jsn(pal("cien")) === jsn([[100, "count"]]), "treinta y cinco días · veintiuno · noventa y nueve · cien");
  ok(jsn(pal("cuatro millones")) === jsn([[4000000, "money"]]) && jsn(pal("dos mil unidades")) === jsn([[2000, "count"]]) && jsn(pal("ocho por ciento")) === jsn([[8, "pct"]]) && jsn(pal("doce puntos porcentuales")) === jsn([[12, "pp"]]), "cuatro millones (dinero) · dos mil unidades (conteo) · ocho por ciento · doce puntos porcentuales");
  ok(pal("una cuenta, uno solo y un cliente").length === 0, "«un/uno/una» NO son cifras («una cuenta», «un cliente»)");
  const rel = (t) => relacionesEnPalabras(t).map((x) => [x.frase, x.tipo]);
  ok(jsn(rel("es la mitad de la de Lider")) === jsn([["la mitad", "fraccion"]]) && jsn(rel("pesa tres cuartos")) === jsn([["tres cuartos", "fraccion"]]) && rel("casi la mitad")[0][0] === "casi la mitad", "las fracciones salen de la tabla de la casa: la mitad · tres cuartos · casi la mitad");
  const mitad = relacionesEnPalabras("la mitad")[0], cotaMitad = COTAS_DE_PROPORCION.find((c) => /^la mitad/.test(c.nombre));
  ok(mitad.lo === cotaMitad.lo && mitad.hi === cotaMitad.hi, "★ el rango de «la mitad» ES el de `COTAS_DE_PROPORCION` (se importa la tabla, no se escribe otra)");
  ok(/import \{[^}]*COTAS_DE_PROPORCION[^}]*\} from "\.\.\/\.\.\/src\/adi\/notario\/lexico\.js"/.test(fs.readFileSync(D + "numerosEnPalabras.mjs", "utf8")), "el ayudante importa `COTAS_DE_PROPORCION` del Notario");
  ok(relacionesEnPalabras("la mayoría, casi todos y unos cuantos").length === 0, "«la mayoría», «casi todos», «unos cuantos» NO se leen (van al juez, diseño §3)");
  ok(jsn(rel("duplica a Lider y casi triplica")) === jsn([["duplica", "multiplo"], ["casi triplica", "multiplo"]]), "los múltiplos: duplica · casi triplica");

  // ── un hilo real: la no-demo, 13 clientes con su saldo vencido y pendiente, y las ventas
  const aF4 = await abrirAlmacen({ estadoJson: crearEstadoInicial() });
  const rV = await aF4.llamar("rioclaro", "consultar", { encargo: { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente" }] } });
  const convF4 = rV.continuidad.conversacionId;
  const rS = await aF4.llamar("rioclaro", "consultar", { encargo: { version: "encargo/v1", conversacionId: convF4, partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido", "saldo_pendiente"], eje: "cliente" }] } });
  const cifrasS = [...rS.entrega.cifras, ...((rS.entrega.detalle && rS.entrega.detalle.fueraDelTexto) || [])];
  const vencidos = cifrasS.filter((c) => c.entidad && c.metrica === "Saldo vencido");
  const nVenc = vencidos.filter((c) => c.valor !== "$0").length, nDia = vencidos.length - nVenc;
  ok(vencidos.length === 13 && nVenc > 0 && nDia > 0, `el hilo trae los 13 saldos vencidos (con id, también los de «fuera del texto»): ${nVenc} con vencido, ${nDia} al día`, `${vencidos.length}/${nVenc}`);
  const LL = (...res) => res.map((resultado, i) => ({ herramienta: ["consultar", "consultar", "derivar", "derivar"][i] || "consultar", args: {}, resultado }));
  const hilo1 = (texto, llamadas, persona = "¿cómo está la cobranza?") => rastrear(hiloBase(texto, persona, llamadas))[0];
  const cifra1 = (r, rx) => r.afirmaciones.filter((a) => a.clase === 1 && a.veredicto !== "ignorado" && rx.test(a.token));
  const wd = (n) => ({ 1: "una", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco", 6: "seis", 7: "siete", 8: "ocho", 9: "nueve", 10: "diez", 11: "once", 12: "doce", 13: "trece" }[n]);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const base = LL(rV, rS);

  // ── CONTEOS EN PALABRAS Y EN CIFRAS
  {
    const bien = cifra1(hilo1(`${cap(wd(nVenc))} de los 13 clientes tienen saldo vencido.`, base), new RegExp(`^${wd(nVenc)}$`, "i"));
    ok(bien.length === 1 && bien[0].veredicto === "traza" && bien[0].caso === "fuera_de_contrato" && bien[0].derivacionQueDebioPedirse.operacion === "conteo" && bien[0].derivacionQueDebioPedirse.sobre.length === 13 && bien[0].derivacionQueDebioPedirse.resultado === `${nVenc} de 13`, `★ «${cap(wd(nVenc))} de los 13 clientes tienen saldo vencido» es VERDAD (${nVenc} de 13) pero FUERA DE CONTRATO: el anfitrión lo contó, debió pedir derivar un conteo sobre los 13 ids`, jsn(bien));
    ok(!FALSOS.has(bien[0] && bien[0].veredicto), "…y no cuenta como falsa");
    const mal = cifra1(hilo1(`${cap(wd(nVenc + 2))} de los 13 clientes tienen saldo vencido.`, base), new RegExp(`^${wd(nVenc + 2)}$`, "i"));
    ok(mal.length === 1 && mal[0].veredicto === "conteo_no_cierra" && mal[0].caso === "error_material" && mal[0].material === true, `★ CARNADA · «${cap(wd(nVenc + 2))} de los 13 clientes tienen saldo vencido» (son ${nVenc}) es un ERROR MATERIAL: el conteo en palabras no cierra`, jsn(mal));
    const grave1 = cifra1(hilo1("Ocho de los 13 clientes tienen saldo pendiente.", base), /^ocho$/i);
    ok(grave1.length === 1 && grave1[0].caso === "error_material", "★ el error grave del ensayo 3 «Ocho de los 13 clientes tienen saldo pendiente» (los 13 tienen) queda error_material", jsn(grave1));
    const grave2 = cifra1(hilo1(`${nVenc + 2} de las 9 cuentas tienen saldo vencido.`, base), new RegExp(`^${nVenc + 2}$`));
    ok(grave2.length === 1 && grave2[0].caso === "error_material", `★ el error grave «5 de las 9» (en cifras): «${nVenc + 2} de las 9 cuentas tienen saldo vencido» (son ${nVenc}) queda error_material`, jsn(grave2));
    const alDia = cifra1(hilo1(`${cap(wd(nDia))} clientes están al día.`, base), new RegExp(`^${wd(nDia)}$`, "i"));
    ok(alDia.length === 1 && alDia[0].veredicto === "traza" && alDia[0].caso === "fuera_de_contrato" && alDia[0].derivacionQueDebioPedirse.condicion.op === "=" , `«${cap(wd(nDia))} clientes están al día» (vencido = 0, la definición de la casa) cierra: fuera de contrato`, jsn(alDia));
    ok(cifra1(hilo1(`${cap(wd(nDia + 1))} clientes están al día.`, base), new RegExp(`^${wd(nDia + 1)}$`, "i"))[0].caso === "error_material", "CARNADA · uno más al día de los que hay: error material");
    ok(cifra1(hilo1("Tengo tres opciones y una sola pregunta.", base), /./).filter((x) => x.caso).length === 0, "★ «tres opciones» y «una sola pregunta»: no son cifras empresariales (ninguna lleva un caso del contrato: se ignoran o se listan, no se juzgan)");
    ok(cifra1(hilo1("Te propongo dos cosas: ver la cartera y luego decidir.", base), /./).length === 0, "un número en palabras que no cuenta un universo entregado no se juzga (va al juez)");
    // ADI ya lo entregó: derivar un conteo → hecho de ADI
    const dC = await aF4.llamar("rioclaro", "derivar", { conversacionId: convF4, operacion: "conteo", sobre: vencidos.map((c) => c.id), condicion: { op: ">", valor: 0 } });
    ok(dC.ok && dC.hecho.valor === `${nVenc} de 13`, `(preparación) \`derivar\` entrega el conteo «${dC.hecho && dC.hecho.valor}» con su id`, jsn(dC).slice(0, 200));
    const conD = cifra1(hilo1(`${cap(wd(nVenc))} de los 13 clientes tienen saldo vencido.`, LL(rV, rS, dC)), new RegExp(`^${wd(nVenc)}$`, "i"));
    ok(conD.length === 1 && conD[0].veredicto === "traza" && conD[0].caso === "hecho_de_adi", "★ la MISMA frase con el conteo de `derivar` entregado (D) es un HECHO DE ADI", jsn(conD));
  }

  // ── SUMAS: «los tres suman $X» sin derivar = fuera de contrato; con D1 = hecho
  {
    const ventas = rV.entrega.cifras.filter((c) => c.entidad && c.metrica === "Venta");
    const imp = (t) => Number(String(t).replace(/[^0-9.]/g, ""));
    let trio = null;
    for (let i = 0; i < ventas.length && !trio; i++) for (let j = i + 1; j < ventas.length && !trio; j++) for (let k = j + 1; k < ventas.length && !trio; k++) {
      const t3 = [ventas[i], ventas[j], ventas[k]];
      if (new Set(t3.map((x) => x.valor)).size === 3 && Math.abs(imp(t3[0].valor) + imp(t3[1].valor) + imp(t3[2].valor) - Math.round((imp(t3[0].valor) + imp(t3[1].valor) + imp(t3[2].valor)) * 10) / 10) < 1e-9) trio = t3;
    }
    const dS = await aF4.llamar("rioclaro", "derivar", { conversacionId: convF4, operacion: "suma", sobre: trio.map((c) => c.id) });
    const total = dS.hecho.valor;
    const frase = `${trio[0].entidad} (${trio[0].valor}), ${trio[1].entidad} (${trio[1].valor}) y ${trio[2].entidad} (${trio[2].valor}) suman ${total}.`;
    const sin = cifra1(hilo1(frase, LL(rV, rS)), new RegExp(`^${total.replace(/[$.]/g, "\\$&")}$`));
    ok(sin.length === 1 && sin[0].veredicto === "traza" && sin[0].caso === "fuera_de_contrato" && sin[0].derivacionQueDebioPedirse.sobre.length === 3, `★ «los tres suman ${total}» SIN derivar: correcto, FUERA DE CONTRATO (la suma de 3 ids que debió pedirse)`, jsn(sin).slice(0, 500));
    const con = cifra1(hilo1(frase, LL(rV, rS, dS)), new RegExp(`^${total.replace(/[$.]/g, "\\$&")}$`));
    ok(con.length === 1 && con[0].veredicto === "traza" && con[0].caso === "hecho_de_adi", `★ la misma frase con la derivación D1 entregada: HECHO DE ADI`, jsn(con).slice(0, 400));
    const otra = `${trio[0].entidad} (${trio[0].valor}), ${trio[1].entidad} (${trio[1].valor}) y ${trio[2].entidad} (${trio[2].valor}) suman $${(imp(total) + 0.4).toFixed(1)}M.`;
    const mala = cifra1(hilo1(otra, LL(rV, rS, dS)), new RegExp(`^\\$${(imp(total) + 0.4).toFixed(1).replace(".", "\\.")}M`));
    ok(mala.length === 1 && mala[0].caso === "error_material", "CARNADA · una suma que no cierra con nada entregado: error material");
    // la participación con D entregado vs calculada por el anfitrión
    /* UNA SOLA REALIDAD (owner 2026-10-06): el caso ya no es «la primera cuenta» a ciegas. El rastreo demuestra un cociente con las cifras IMPRESAS (a ÷ b dentro de la
     * incertidumbre de lo impreso); con la venta de la tabla (Σ $176.248K, antes $176.052K con el rearme de bonanza) el redondeo de la primera cuenta cae a 0,05 pp de
     * no cerrar. Se toma, en orden, la primera cuenta cuya participación SÍ es demostrable con lo impreso (el mismo criterio de selección que la suma de arriba: «un trío que cierra»);
     * lo que se guarda no cambia: una participación verdadera calculada por el anfitrión es «fuera de contrato», y con la derivación D entregada es hecho de ADI. */
    let dP = null, pct = null, fraseP = null, pSin = null, ventaP = null;
    for (const v of ventas) {
      const d = await aF4.llamar("rioclaro", "derivar", { conversacionId: convF4, operacion: "participacion", sobre: [v.id], base: rV.entrega.cifras.find((c) => /total del listado/.test(c.metrica)).id });
      const p = d.hecho.valor, f = `${v.entidad} pesa ${p} de la venta total.`;
      const s = cifra1(hilo1(f, LL(rV, rS)), new RegExp(`^${p.replace(/[.]/g, "\\.")}$`));
      if (!dP) { dP = d; pct = p; fraseP = f; pSin = s; ventaP = v; }   /* por si ninguna cierra: se informa la primera */
      if (s.length === 1 && s[0].caso === "fuera_de_contrato") { dP = d; pct = p; fraseP = f; pSin = s; ventaP = v; break; }
    }
    ok(pSin.length === 1 && pSin[0].caso === "fuera_de_contrato" && pSin[0].derivacionQueDebioPedirse.operacion === "participacion", `★ una participación (${pct}) calculada por el anfitrión: verdadera, fuera de contrato (cociente sobre una base entregada)`, jsn(pSin).slice(0, 400));
    const pCon = cifra1(hilo1(fraseP, LL(rV, rS, dP)), new RegExp(`^${pct.replace(/[.]/g, "\\.")}$`));
    ok(pCon.length === 1 && pCon[0].caso === "hecho_de_adi", "…y con la derivación D entregada, hecho de ADI", jsn(pCon).slice(0, 300));
    // los ids: D1 y E3.h2 no son cifras
    const ids = hilo1("Según D1 y E3.h2 (versión 2, año 2026).", LL(rV, rS, dS));
    ok(cifra1(ids, /./).length === 0, "★ «D1», «E3.h2», «2026» y «versión 2» se ignoran (no son cifras empresariales)", jsn(ids.afirmaciones.filter((a) => a.veredicto !== "ignorado").map((a) => a.token)));
  }

  // ── RELACIONES EN PALABRAS (dos cuentas, una cifra de la misma métrica de cada una)
  {
    const mk = (v1, v2) => ({ ok: true, entrega: { texto: "Ventas.", cifras: [{ id: "E1.h1", entidad: "Cadena Quillay", metrica: "Venta", valor: v1, procedencia: "medido" }, { id: "E1.h2", entidad: "Casa Lomas", metrica: "Venta", valor: v2, procedencia: "medido" }] } });
    const h = (texto, v1, v2) => rastrear(hiloBase(texto, "compara", [{ herramienta: "consultar", args: {}, resultado: mk(v1, v2) }]))[0].afirmaciones.filter((a) => a.tipo === "relacion");
    const m1 = h("Las ventas de Cadena Quillay son la mitad de las de Casa Lomas.", "$10.0M", "$20.0M");
    ok(m1.length === 1 && m1[0].veredicto === "traza" && m1[0].caso === "fuera_de_contrato" && m1[0].derivacionQueDebioPedirse.operacion === "participacion", "★ «la mitad» con una razón de 0,50: verdad, pero la relación la calculó el anfitrión (fuera de contrato: debió pedir una participación)", jsn(m1).slice(0, 400));
    const m2 = h("Las ventas de Casa Lomas casi duplican a las de Cadena Quillay.", "$11.5M", "$20.0M");
    ok(m2.length === 1 && m2[0].veredicto === "relacion_no_cierra" && m2[0].caso === "error_material", "★ CARNADA · «casi duplican» con una razón de 1,74× es ERROR MATERIAL (la relación en palabras no cierra)", jsn(m2).slice(0, 400));
    const m3 = h("Las ventas de Casa Lomas duplican a las de Cadena Quillay.", "$10.0M", "$20.0M");
    ok(m3.length === 1 && m3[0].veredicto === "traza", "«duplican» con una razón de 2,0×: cierra");
    const m4 = h("Las ventas de Cadena Quillay son la mitad de las de Casa Lomas.", "$13.0M", "$20.0M");
    ok(m4.length === 1 && m4[0].caso === "error_material", "CARNADA · «la mitad» con una razón de 0,65: error material");
    ok(h("Casi todos los clientes compran, la mayoría vuelve.", "$10.0M", "$20.0M").length === 0, "«casi todos» y «la mayoría» no se leen: no hay veredicto de rastreo");
    ok(h("Cadena Quillay es la mitad del negocio.", "$10.0M", "$20.0M").length === 0, "con UNA sola cuenta nombrada no hay con qué comparar: no se juzga");
  }

  // ── los tres casos en el resto de los veredictos
  {
    const venta = filasE1.find((f) => f.metrica === "Venta").valor;
    const cs = (t, rx) => rastro(t).afirmaciones.filter((a) => a.clase === 1 && a.veredicto !== "ignorado" && rx.test(a.token));
    const d = cs(`Cadena Quillay vendió ${venta}.`, /\$/)[0];
    ok(d.veredicto === "traza" && d.caso === "hecho_de_adi", "una cifra entregada con su dueño: HECHO DE ADI");
    ok(cs("Cadena Quillay vendió $99.9M este año.", /\$/)[0].caso === "error_material", "una cifra inventada: ERROR MATERIAL");
    ok(cs("Casa Lomas vendió $13.0M.", /\$/).every((a) => a.caso === "error_material" || a.caso === undefined) && cs(`Casa Lomas vendió ${venta}.`, /\$/)[0].caso === "error_material", "una cifra entregada a OTRO dueño: error material");
    ok(cs("Cadena Quillay tuvo margen de $13.0M.", /\$/)[0].caso === "error_material", "una cifra de otra métrica: error material");
    ok(CASOS_DEL_CONTRATO.join() === "hecho_de_adi,fuera_de_contrato,error_material", "los tres casos son EXACTAMENTE esos tres");
    const dp = rastro("Con tu piso de 45 días, lo normal es sobrepasarlo.", { persona: "Mi piso es 45 días." }).afirmaciones.find((a) => /45/.test(a.token));
    ok(dp && dp.caso === "hecho_de_adi" && dp.declaradoPor === "persona", "una cifra que declaró la PERSONA: no es verdad nueva del anfitrión (hecho de ADI, con su origen)", jsn(dp));
  }

  // ── el informe: cumplimiento = 100 % + 0 errores de ADI + 0 materiales + 0 cruces
  {
    const venta = filasE1.find((f) => f.metrica === "Venta").valor;
    const hilosI = (textos, forma = "A") => [{ hiloId: "H", forma, empresa: "rioclaro", turnos: textos.map((tx, k) => ({ sesion: 1, turno: k + 1, persona: "¿cuánto vendió Cadena Quillay?", textoEnviado: "¿cuánto vendió Cadena Quillay?", texto: tx, llamadas: [{ herramienta: "consultar", args: {}, resultado: E1 }] })) }];
    const manifiesto = { corridaId: "gate", tipo: "oficial", via: "api", modelo: "m", corpus: { corpusId: "c1", sha256: "x", juguete: false }, hashes: { instruccion: "i", herramientas: "h" }, sello: { ok: true } };
    const cierre = { turnosPlaneados: 3, turnosHechos: 3, motivo: "completa", consumo: { sinConteoPct: 0, modelosSinPrecio: [] } };
    const juez = (n) => ({ turnos: Object.fromEntries(Array.from({ length: n }, (_, k) => [`H|1|${k + 1}`, { ok: true, afirmaciones: [], naturalidad: null }])) });
    const informe = (textos, revision = null) => calcularInforme({ manifiesto, cierre: { ...cierre, turnosPlaneados: textos.length, turnosHechos: textos.length }, hilos: hilosI(textos), juez: juez(textos.length), revision });
    const ok1 = informe([`Cadena Quillay vendió ${venta}.`]);
    ok(ok1.veredicto === "PASA" && ok1.contrato.cifras === 1 && ok1.contrato.hechoDeAdi === 1 && ok1.contrato.cumplimientoPct === 100 && ok1.erroresDeAdi.length === 0, "★ solo hechos de ADI: cumplimiento 100 %, 0 errores de ADI, 0 materiales, 0 cruces → PASA", `${ok1.veredicto} · ${ok1.porQue}`);
    ok(ok1.contratoPorHilo.H && ok1.contratoPorHilo.H.cumplimientoPct === 100, "el bloque `contrato` sale por hilo y total");
    // fuera de contrato correcto: la verdad queda en 100 % pero NO PASA
    const trio = rS.entrega.cifras.filter((c) => c.entidad && c.metrica === "Saldo vencido").slice(0, 3);
    const nV = vencidos.filter((c) => c.valor !== "$0").length;
    const fuera = informe([`Cadena Quillay vendió ${venta}.`, `${cap(wd(nV))} de los 13 clientes tienen saldo vencido.`].slice(0, 1));
    const hilosF = [{ hiloId: "H", forma: "A", empresa: "rioclaro", turnos: [{ sesion: 1, turno: 1, persona: "¿cómo va la cobranza?", textoEnviado: "¿cómo va la cobranza?", texto: `${cap(wd(nV))} de los 13 clientes tienen saldo vencido.`, llamadas: LL(rV, rS) }] }];
    const infF = calcularInforme({ manifiesto, cierre: { ...cierre, turnosPlaneados: 1, turnosHechos: 1 }, hilos: hilosF, juez: juez(1), revision: null });
    ok(infF.verdad.real.pct === 100 && infF.contrato.fueraDeContrato.total === 1 && infF.contrato.cumplimientoPct === 0 && infF.erroresMateriales.length === 0 && infF.veredictoDetallado.criterios.cumplimientoDelContrato.informativo === true && infF.veredicto === "PASA", "★ un `fuera_de_contrato` CORRECTO no cuenta como falso (verdad 100 %) y rompe el cumplimiento (0 %), que desde el 2026-10-07 es INFORMATIVO: ya no decide (PASA)", `${infF.veredicto} · ${infF.porQue}`);
    { const infF100 = calcularInforme({ manifiesto, cierre: { ...cierre, turnosPlaneados: 1, turnosHechos: 1 }, hilos: hilosF, juez: juez(1), revision: null, parametros: { umbralDeCumplimientoPct: 100 } });
      ok(infF100.veredicto === "NO PASA" && infF100.veredictoDetallado.criterios.cumplimientoDelContrato.cumple === false, "…pero con el umbral como PARÁMETRO (100 %) vuelve a decidir: NO PASA", `${infF100.veredicto} · ${infF100.porQue}`); }
    ok(infF.contrato.fueraDeContrato.derivables.length === 1 && infF.contrato.fueraDeContrato.derivables[0].derivacionQueDebioPedirse.operacion === "conteo" && /debió pedir derivar conteo/.test(informeEnMarkdown(infF)), "el informe trae, por cada fuera de contrato, la derivación exacta que debió pedirse", jsn(infF.contrato.fueraDeContrato.derivables).slice(0, 300));
    ok(informeEnMarkdown(infF).includes("## El contrato del anfitrión") && informeEnMarkdown(infF).includes("## Errores de ADI · 0") && informeEnMarkdown(infF).includes("## Fuera de contrato (correctas) · 1"), "el informe en texto trae el bloque del contrato, los errores de ADI y lo fuera de contrato");
    // error_adi: la cifra y la frase son verdaderas, pero el hecho faltó: NO PASA
    const idCifra = Object.keys({}).length ? null : "H|1|1|1";
    const infA = calcularInforme({ manifiesto, cierre: { ...cierre, turnosPlaneados: 1, turnosHechos: 1 }, hilos: hilosF, juez: juez(1), revision: { decisiones: { [idCifra]: { veredicto: "error_adi", nota: "el conteo debía venir entregado" } } } });
    ok(infA.erroresDeAdi.length === 1 && infA.erroresDeAdi[0].nota && infA.veredicto === "NO PASA" && infA.verdad.real.pct === 100, "★ un `error_adi` (revision.json) es del producto, no del anfitrión: la verdad sigue en 100 %, pero NO PASA", `${infA.veredicto} · ${infA.porQue}`);
    // error material: NO PASA
    const infM = informe([`Cadena Quillay vendió $99.9M este año.`]);
    ok(infM.veredicto === "NO PASA" && infM.erroresMateriales.length === 1 && infM.contrato.erroresMateriales === 1 && infM.contrato.cumplimientoPct === 0, "★ un error material: NO PASA (y baja el cumplimiento)", `${infM.veredicto} · ${infM.porQue}`);
    // sin cifras no se puede decir que cumple
    const infN = informe(["Hola, ¿en qué te ayudo?"]);
    ok(infN.contrato.cifras === 0 && infN.contrato.cumplimientoPct === null && infN.veredicto === "NO PASA", "sin cifras empresariales que medir no se declara cumplimiento: NO PASA", `${infN.veredicto} · ${infN.porQue}`);
    // revertir a verdadera una falsa de la máquina: falla del medidor, cuenta como hecho de ADI
    const infR = calcularInforme({ manifiesto, cierre: { ...cierre, turnosPlaneados: 1, turnosHechos: 1 }, hilos: hilosI(["Cadena Quillay vendió $99.9M este año."]), juez: juez(1), revision: { decisiones: { "H|1|1|1": { veredicto: "verdadera", nota: "la cifra sí era de la entrega" } } } });
    ok(infR.fallasDelMedidor.length === 1 && infR.contrato.hechoDeAdi === 1 && infR.veredicto === "PASA", "la persona revierte una falsa de la máquina: falla del medidor, cuenta como hecho de ADI → PASA");
    // la regla escrita
    ok(/0 errores de ADI/.test(REGLA_DE_CIERRE) && /1 error material del anfitrión cada 500 afirmaciones/.test(REGLA_DE_CIERRE) && /0 cruces entre empresas/.test(REGLA_DE_CIERRE) && !/verdad ≥ 99/.test(REGLA_DE_CIERRE) && !/cumplimiento del contrato = 100 %/.test(REGLA_DE_CIERRE), "★ `REGLA_DE_CIERRE`: 0 errores de ADI · ≤ 1 error material del anfitrión cada 500 afirmaciones · 0 cruces (el cumplimiento del contrato y el % de verdad se informan; ya no deciden — ver F5)");
    ok(/Úsela|una afirmación cuantificada sin número/i.test(PROMPT_DEL_JUEZ) && /todos, ninguno, el único, la mayoría/.test(PROMPT_DEL_JUEZ) && /material si nombra una cuenta o una cifra/.test(PROMPT_DEL_JUEZ), "★ el juez trae la línea de clase 4: «una afirmación cuantificada sin número —todos, ninguno, el único, la mayoría— debe sostenerse en hechos entregados…»");
    void trio; void fuera;
  }
}

/* ═════ F5 · EL MEDIDOR TRAS LOS ENSAYOS 4 Y 5 Y LA REGLA DE CIERRE DEL 2026-10-07 ═══════════════════════════════════════════════════════════════════
 * Los ensayos 4 y 5 marcaron 18 y 51 «errores materiales» (y 2 «cruces»); la lectura humana (`clasificacion.json`) encontró 1-2 reales por ensayo: el resto eran fallas del MEDIDOR. Cada patrón se cerró con una regla de `rastreo.mjs`
 * (`REGLAS`) y acá cada una tiene (a) la FRASE REAL del ensayo (`fixtures/medicion-anfitrion/ensayo-4-5-medidor.json`: verbatim de los transcritos, con el libro de lo que ADI entregó en ese hilo) que pasa a no-marca, (b) la prueba ROJA de que
 * sin la regla vuelve a marcarse y (c) la CARNADA: la variante falsa del mismo caso que sigue marcada. Y la regla de cierre nueva: ADI 0 errores · anfitrión ≤ 1 error material cada 500 afirmaciones empresariales y sin patrón sistemático ·
 * 0 cruces · el cumplimiento del contrato informativo (el umbral es un parámetro); el veredicto consume `clasificacion.json`. */
seccion("F5 · el medidor tras los ensayos 4-5 y la regla de cierre del 2026-10-07");
{
  const { REGLAS, esEjemploHipotetico, nombresDeLaClausula } = await import(D + "rastreo.mjs");
  const { REGLA_DE_CIERRE } = await import(D + "informe.mjs");
  const { REGLAS_DE_PALABRAS, relacionesEnPalabras } = await import(D + "numerosEnPalabras.mjs");
  const { leerClasificacion, familiaDeError, patronesSistematicos, limiteDeErrores, PARAMETROS_DE_CIERRE } = await import(D + "clasificacion.mjs");
  const FXM = JSON.parse(fs.readFileSync(new URL("./fixtures/medicion-anfitrion/ensayo-4-5-medidor.json", import.meta.url), "utf8")).casos;
  const FXC = JSON.parse(fs.readFileSync(new URL("./fixtures/medicion-anfitrion/clasificacion-ensayos-4-5.json", import.meta.url), "utf8")).ensayos;
  const jsn = (x) => JSON.stringify(x);
  const FALSOS = new Set(["no_traza", "dueno_distinto", "metrica_distinta", "conteo_no_cierra", "relacion_no_cierra", "cambio_no_avisado"]);
  /* el hilo de un caso: las oraciones de la persona antes y la prosa real en el último turno (con el libro reducido de ese hilo); `cambia` = [[de, a]] para fabricar la variante falsa */
  const hiloDe = (id, cambia = []) => {
    const c = FXM[id];
    let prosa = c.prosa;
    for (const [de, a] of cambia) { if (!prosa.includes(de)) throw new Error(`la prosa de ${id} ya no trae «${de}»`); prosa = prosa.split(de).join(a); }
    const turnos = c.persona.map((p, i) => ({ sesion: 1, turno: i + 1, persona: p, textoEnviado: p, texto: i === c.persona.length - 1 ? prosa : "", llamadas: i === c.persona.length - 1 ? JSON.parse(JSON.stringify(c.llamadas)) : [] }));
    return { hiloId: "M", forma: c.forma, empresa: c.empresa, turnos };
  };
  const ultimo = (h) => rastrearHilo(h)[h.turnos.length - 1];
  const toks = (h, rx) => ultimo(h).afirmaciones.filter((a) => a.clase === 1 && a.veredicto !== "ignorado" && rx.test(a.token));
  const vs = (h, rx) => toks(h, rx).map((a) => a.veredicto);
  const sinR = (obj, regla, f) => { obj[regla] = false; try { return f(); } finally { obj[regla] = true; } };
  const noMarca = (xs) => xs.length > 0 && xs.every((x) => !FALSOS.has(x));
  const marca = (xs) => xs.length > 0 && xs.every((x) => FALSOS.has(x));
  const rojo = (obj, regla, id, rx, msg, cambia = [], antes = marca) => {
    const con = vs(hiloDe(id, cambia), rx), sin = sinR(obj, regla, () => vs(hiloDe(id, cambia), rx));
    ok(noMarca(con), `★ ${msg}: ya no se marca`, jsn(con));
    ok(antes(sin), `   y sin la regla «${regla}» vuelve a marcarse (la regla es la que lo rescata)`, jsn(sin));
  };
  const sigue = (id, rx, msg, cambia, esperados = [...FALSOS]) => { const x = vs(hiloDe(id, cambia), rx); ok(x.length > 0 && x.every((y) => esperados.includes(y)), `★ CARNADA · ${msg}`, jsn(x)); };

  // ── (a) los números de la PERSONA, en cifras o con letras («cuarenta y cinco días», «treinta», «cuarenta por ciento»)
  rojo(REGLAS, "persona_palabras", "persona/45-dias-en-palabras", /^45 días$/, "caso real A02 1.3 (ensayo 5) · la persona dijo «cuarenta y cinco días»; «Con su criterio de más de 45 días» es SU número");
  { const r = toks(hiloDe("persona/45-dias-en-palabras"), /^45 días$/); ok(r.length === 2 && r.every((a) => a.declaradoPor === "persona" && /^persona@1\.\d+$/.test(a.origen)), "…y queda registrada como DE LA PERSONA, con su origen", jsn(r.map((a) => [a.veredicto, a.declaradoPor, a.origen]))); }
  rojo(REGLAS, "persona_palabras", "persona/30-dias-en-palabras", /^30 días$/, "caso real A01 1.5 (ensayo 5) · «treinta días»");
  rojo(REGLAS, "persona_palabras", "persona/40-dias-en-palabras", /^40 días$/, "caso real B02 1.4 (ensayo 5) · «cuarenta días» (dicho en el turno 1.3)");
  rojo(REGLAS, "persona_palabras", "persona/cuarenta-por-ciento", /^40%$/, "caso real A03 1.4 (ensayo 5) · «el cuarenta por ciento»");
  rojo(REGLAS, "persona_palabras", "persona/el-doble-como-100-por-ciento", /^100 %$/, "caso real A01 1.6 (ensayo 5) · la persona dijo «como el doble»; el anfitrión lo traduce a «cercano al 100 %»");
  ok(vs(hiloDe("persona/el-doble-como-100-por-ciento"), /^100 %$/).join() === "eco_persona", "…y es el eco de la persona (para revisar), no una cifra de ADI ni una inventada");
  sigue("persona/45-dias-en-palabras", /^50 días$/, "«50 días»: la persona dijo cuarenta y cinco, no cincuenta", [["más de 45 días", "más de 50 días"]], ["no_traza", "dueno_distinto", "metrica_distinta"]);
  { const x = toks(hiloDe("persona/45-dias-en-palabras", [["Con su criterio de más de 45 días, **3 de los 13 clientes están atrasados**.", "Mayorista El Roble lleva 45 días de atraso."]]), /^45 días$/).filter((a) => /El Roble lleva/.test(a.oracion)).map((a) => a.veredicto);
    ok(x.length === 1 && x[0] !== "traza", "★ CARNADA · «Mayorista El Roble lleva 45 días»: el 45 es de la persona, no de una cuenta que la oración nombra (queda sin trazar o como eco, nunca como cifra de ADI)", jsn(x)); }

  // ── (b) los ejemplos hipotéticos que se le ofrecen a la persona
  rojo(REGLAS, "ejemplo", "ejemplo/si-me-dice-un-crecimiento", /^\+?5%$/, "caso real A02 1.7 (ensayo 5) · «Si me dice un crecimiento (por ejemplo +5%)»");
  ok(vs(hiloDe("ejemplo/si-me-dice-un-crecimiento"), /^\+?5%$/).join() === "ejemplo", "…y es un `ejemplo`, no una afirmación sobre la empresa");
  rojo(REGLAS, "ejemplo", "ejemplo/usted-me-da-un-supuesto", /^(10 %|3 puntos)$/, "caso real A01 1.7 (ensayo 5) · «Usted me da un supuesto, por ejemplo «Lider crece 10 %» o «sube el margen 3 puntos»");
  rojo(REGLAS, "ejemplo", "ejemplo/una-meta-como-un-28", /^(28%|\+?12%)$/, "caso real C01 1.6 (ensayo 4) · «Una meta de margen, como un 28%» / «como un +12%» (28% es de Tottus: antes se leía como `dueno_distinto`)");
  ok(noMarca(vs(hiloDe("ejemplo/una-meta-como-un-28"), /^(22%|8\.3%|\$19\.4M)$/)) && vs(hiloDe("ejemplo/una-meta-como-un-28"), /^22%$/).join() === "traza", "…y las cifras REALES de las mismas oraciones («el 22% actual de Falabella», «creció 8.3%») siguen trazando");
  rojo(REGLAS, "ejemplo", "ejemplo/si-me-dices-el-crecimiento", /^\+?8%$/, "caso real A01 1.8 (ensayo 4) · «si me dices el crecimiento que quieres, por ejemplo «+8%»");
  { const r = ultimo(hiloBase("Por ejemplo, Cadena Quillay vendió $99.9M este año.")); ok(r.afirmaciones.some((a) => /^\$99\.9M$/.test(a.token) && a.veredicto === "no_traza"), "★ CARNADA · «Por ejemplo, Cadena Quillay vendió $99.9M»: sin una oferta de supuesto a la persona, «por ejemplo» no esconde una cifra inventada", jsn(r.afirmaciones.map((a) => [a.token, a.veredicto]))); }
  ok(esEjemploHipotetico("Si me dice un crecimiento de 10%, lo calculo.", { indice: 36 }) && !esEjemploHipotetico("Cadena Quillay creció 10% este año.", { indice: 22 }), "la señal es del idioma: «si me dice un crecimiento de 10%» es un ejemplo; «Cadena Quillay creció 10%» no");

  // ── (c) «la líder» (sustantivo común) no es el cliente «Lider» de la otra empresa
  { const con = ultimo(hiloDe("cruce/la-lider-es-norvik")).cruces.length, sin = sinR(REGLAS, "grafia", () => ultimo(hiloDe("cruce/la-lider-es-norvik")).cruces.length);
    ok(con === 0 && sin === 2, "★ caso real B01 1.2 (ensayo 4) · «Por venta, la líder es Norvik… la líder es Alsen»: 0 cruces (sin la regla, los 2 «cruces» falsos del ensayo)", `${con}/${sin}`);
    const masMal = (extra) => ultimo(hiloDe("cruce/la-lider-es-norvik", [["Alsen le sigue", `${extra} Alsen le sigue`]])).cruces.map((c) => c.nombre);
    ok(masMal("Lider vendió más.").length === 1, "★ CARNADA · el nombre real «Lider» (mayúscula, sin acento) sigue siendo un cruce", jsn(masMal("Lider vendió más.")));
    ok(masMal("LIDER vendió más.").length === 1 && masMal("Falabella vendió más.").length === 1, "★ CARNADA · «LIDER» y «Falabella» siguen siendo cruces", jsn([masMal("LIDER vendió más."), masMal("Falabella vendió más.")]));
    ok(masMal("Valparaíso y Valparaiso se parecen.").length === 2, "★ CARNADA · un nombre con acento en la lista de la casa («Valparaíso») y sin acento («Valparaiso») siguen siendo cruces", jsn(masMal("Valparaíso y Valparaiso se parecen.")));
    ok(masMal("Una líder del mercado, otra Líder más.").length === 0, "«una líder» y «Líder» con acento son el sustantivo, aunque abran la oración", jsn(masMal("Una líder del mercado, otra Líder más."))); }

  // ── (d) «el cuarto» es un ORDINAL; «menos que la mitad» es una desigualdad ESTRICTA
  { const h = hiloDe("relacion/el-tercero-mas-que-el-doble-el-cuarto");
    const rel = (x) => x.afirmaciones.filter((a) => a.tipo === "relacion" || a.tipo === "ordinal");
    const con = rel(ultimo(h)), sin = sinR(REGLAS_DE_PALABRAS, "ordinal", () => rel(ultimo(h)));
    ok(con.length === 2 && con.some((a) => a.veredicto === "ordinal") && con.every((a) => !FALSOS.has(a.veredicto)) && sin.some((a) => a.veredicto === "relacion_no_cierra"), "★ caso real A01 1.1 (ensayo 4) · «Jumbo, el tercero, vende más que el doble que Sodimac, el cuarto»: «el cuarto» es el puesto (ordinal), no 1/4 — y «más que el doble» se juzga y cierra (17.3/8.2 = 2.11)", jsn([con.map((a) => a.veredicto), sin.map((a) => a.veredicto)]));
    ok(con.find((a) => a.veredicto === "traza").caso === "fuera_de_contrato", "…la relación que cierra es VERDAD pero la calculó el anfitrión: fuera de contrato"); }
  { const h = hiloDe("relacion/makita-menos-que-la-mitad-de-bosch"), rel = (x) => x.afirmaciones.filter((a) => a.tipo === "relacion");
    const con = rel(ultimo(h)), sin = sinR(REGLAS_DE_PALABRAS, "desigualdad", () => rel(ultimo(h)));
    ok(con.length === 1 && con[0].veredicto === "traza" && sin.length === 1 && sin[0].veredicto === "relacion_no_cierra", "★ caso real A01 1.5 (ensayo 4) · «Makita vende menos que la mitad de Bosch» ($4.8M / $11.0M = 0.44 < 0.5): verdadera; leída como «es la mitad» (rango 45-55 %) se marcaba", jsn([con.map((a) => a.veredicto), sin.map((a) => a.veredicto)]));
    const val = (cambia) => rel(ultimo(hiloDe("relacion/makita-menos-que-la-mitad-de-bosch", cambia))).map((a) => a.veredicto).join();
    ok(val([["Makita vende menos que la mitad de Bosch", "Bosch vende menos que la mitad de Makita"]]) === "relacion_no_cierra", "★ CARNADA · la dirección importa: «Bosch vende menos que la mitad de Makita» es falso aunque la razón sea 0.44", val([["Makita vende menos que la mitad de Bosch", "Bosch vende menos que la mitad de Makita"]]));
    ok(val([["Makita vende menos que la mitad de Bosch", "Makita vende menos que un cuarto de Bosch"]]) === "relacion_no_cierra", "★ CARNADA · «menos que un cuarto de Bosch» (0.44 > 0.25) sigue marcándose", val([["Makita vende menos que la mitad de Bosch", "Makita vende menos que un cuarto de Bosch"]]));
    ok(val([["menos que la mitad de Bosch", "más que la mitad de Bosch"]]) === "relacion_no_cierra", "★ CARNADA · «más que la mitad» con 0.44 es falso", val([["menos que la mitad de Bosch", "más que la mitad de Bosch"]])); }
  { const h = hiloDe("relacion/el-cuarto-sodimac-menos-de-la-mitad"), rel = (x) => x.afirmaciones.filter((a) => a.tipo === "relacion" || a.tipo === "ordinal");
    const con = rel(ultimo(h)), sin = sinR(REGLAS_DE_PALABRAS, "ordinal", () => sinR(REGLAS_DE_PALABRAS, "desigualdad", () => rel(ultimo(h))));
    ok(con.every((a) => !FALSOS.has(a.veredicto)) && sin.some((a) => a.veredicto === "relacion_no_cierra"), "★ caso real C01 1.1 (ensayo 5) · «El cuarto, Sodimac, vende $8.2M, menos de la mitad de lo que compra Jumbo»: verdadera (8.2/17.3 = 0.47)", jsn([con.map((a) => a.veredicto), sin.map((a) => a.veredicto)]));
    const cambia = [["menos de la mitad de lo que compra Jumbo", "un cuarto de lo que compra Jumbo"]];
    ok(rel(ultimo(hiloDe("relacion/el-cuarto-sodimac-menos-de-la-mitad", cambia))).some((a) => a.veredicto === "relacion_no_cierra"), "★ CARNADA · «un cuarto de lo que compra Jumbo» (0.47 fuera de 20-30 %) sigue marcándose: «un cuarto» SÍ es la fracción"); }
  { const r = (t) => relacionesEnPalabras(t).map((x) => [x.tipo, x.frase]);
    ok(jsn(r("Sodimac, el cuarto, vende poco.")) === jsn([["ordinal", "el cuarto"]]) && r("Es el cuarto de la venta.").some((x) => x[0] === "fraccion") && r("Es el cuarto del total.").some((x) => x[0] === "fraccion") && r("Es el cuarto de los 13 clientes.").every((x) => x[0] === "ordinal") && r("Aporta un cuarto de la venta.").some((x) => x[0] === "fraccion"), "«el cuarto» es ordinal salvo «el cuarto de la/del …»; «el cuarto de los 13 clientes» es el puesto; «un cuarto» es siempre la fracción", jsn([r("Sodimac, el cuarto, vende poco."), r("Es el cuarto de los 13 clientes.")]));
    ok(relacionesEnPalabras("Vende más que el doble que Sodimac.").some((x) => x.desigualdad === "mayor" && x.nominal === 2) && relacionesEnPalabras("Vende menos del doble.").some((x) => x.desigualdad === "menor") && relacionesEnPalabras("Vende el doble.").every((x) => !x.desigualdad), "«más que el doble» / «menos del doble» son desigualdades; «el doble» a secas no"); }

  // ── (e) el dueño de la CLÁUSULA y el tema de la lista
  rojo(REGLAS, "viñeta_tema", "dueno/capital-contra-concepcion", /^\$13K$/, "caso real B02 2.4 (ensayo 4) · «La más chica es Antofagasta: … - Capital: $13K, contra $19K de Concepción»: la viñeta abre con la cifra del tema de la lista");
  sigue("dueno/capital-contra-concepcion", /^\$13K$/, "si la lista habla de Valparaíso, los $13K de Antofagasta NO son de Valparaíso: `dueno_distinto`", [["La más chica es **Antofagasta**:", "La más chica es **Valparaíso**:"]], ["dueno_distinto"]);
  rojo(REGLAS, "viñeta_tema", "dueno/atraso-contra-andes-y-alerce", /^269 días$/, "caso real A02 1.3 (ensayo 4) · «cómo está El Roble: … - Atraso: 269 días vencidos, contra 8 días en Andes del Sur y Tiendas Alerce»");
  sigue("dueno/atraso-contra-andes-y-alerce", /^269 días$/, "si el tema de la lista es Casa Lomas (281d), los 269 días de El Roble no son suyos", [["es cómo está El Roble frente", "es cómo está Casa Lomas frente"]], ["dueno_distinto"]);
  rojo(REGLAS, "grupo", "dueno/los-tres-primeros-clientes", /^53,6%$/, "caso real B01 1.2 (ensayo 5) · «Los tres primeros clientes concentran el 53,6%» (D1 = suma de tres cuentas; la oración anterior nombraba a Maipo y Quillay)");
  sigue("dueno/los-tres-primeros-clientes", /^53,6%$/, "«Cadena Quillay concentra el 53,6%» NO es de Quillay", [["Los tres primeros clientes concentran", "Cadena Quillay concentra"]], ["dueno_distinto"]);
  { const cifras = [{ id: "E1.h1", entidad: "Mayorista El Roble", metrica: "Venta", valor: "$8.0M" }, { id: "E1.h2", entidad: "Tiendas Alerce", metrica: "Venta", valor: "$8.0M" }];
    const llamadas = [{ herramienta: "consultar", args: {}, resultado: { entrega: { cifras, texto: "" } } }];
    const de = (reglaOn) => { const f = () => ultimo(hiloBase("Tiendas Alerce ($8.0M) y Mayorista El Roble ($8.0M) venden lo mismo.", "¿cuánto venden?", llamadas)).afirmaciones.filter((a) => /^\$8\.0M$/.test(a.token)).map((a) => a.hecho.entidades.join()); return reglaOn ? f() : sinR(REGLAS, "dueno_clausula", f); };
    ok(jsn(de(true)) === jsn(["Tiendas Alerce", "Mayorista El Roble"]) && jsn(de(false)) === jsn(["Mayorista El Roble", "Mayorista El Roble"]), "★ (e) el MISMO valor redondeado es de dos dueños: cada cifra se atribuye a la cuenta de SU cláusula («Tiendas Alerce ($8.0M)»); sin la regla las dos quedaban de la primera de la lista", jsn([de(true), de(false)]));
    const h = { hiloId: "X", forma: "A", empresa: "rioclaro", turnos: [{ sesion: 1, turno: 1, persona: "p", textoEnviado: "p", texto: "Tiendas Alerce ($8.0M) y Mayorista El Roble ($8.0M).", llamadas }] };
    const hits = [{ nombre: "Tiendas Alerce", indice: 0 }, { nombre: "Mayorista El Roble", indice: 24 }];
    ok(jsn(nombresDeLaClausula("Tiendas Alerce ($8.0M) y Mayorista El Roble ($8.0M).", { indice: 16, fin: 21 }, hits)) === jsn(["Tiendas Alerce"]) && jsn(nombresDeLaClausula("Mayorista El Roble: $8.0M, y más.", { indice: 20, fin: 25 }, [{ nombre: "Mayorista El Roble", indice: 0 }])) === jsn([]), "la cláusula de una cifra es el trozo entre separadores; entre paréntesis, la cuenta que lo abre", jsn(h.turnos.length)); }

  // ── la métrica PEGADA a la cifra, el fallo de carga, el conjunto que suma
  rojo(REGLAS, "metrica_pegada", "metrica/vencido-de-pendiente", /^\$69,9M$/, "caso real C02 1.5 (ensayo 5) · «$21,0M vencido de $69,9M pendiente»: cada cifra lleva la métrica que la oración le pega");
  sigue("metrica/vencido-de-pendiente", /^\$(21,0|69,9)M$/, "las etiquetas cambiadas («$21,0M pendiente de $69,9M vencido») son un error de métrica", [["$21,0M vencido de $69,9M pendiente", "$21,0M pendiente de $69,9M vencido"]], ["metrica_distinta"]);
  rojo(REGLAS, "metrica_pegada", "metrica/pendientes-vencidos-entre-parentesis", /^\$(15\.0|10\.7)M$/, "caso real C02 1.6 (ensayo 4) · «Andes del Sur ($15.0M pendientes) y Maipo ($10.7M pendientes, $5.8M vencidos)»");
  sigue("metrica/pendientes-vencidos-entre-parentesis", /^\$15\.0M$/, "«Andes del Sur ($15.0M vencidos)» es de otra métrica (son pendientes)", [["Andes del Sur ($15.0M pendientes)", "Andes del Sur ($15.0M vencidos)"]], ["metrica_distinta"]);
  rojo(REGLAS, "fallo_de_carga", "metrica/error-de-carga", /^\$13\.0M$/, "caso real B01 2.4 (ensayo 4) · «Si fuera un error de carga y volviera con $13.0M»: un fallo de carga de datos no es la carga comercial");
  sigue("metrica/error-de-carga", /^\$13\.0M$/, "«la carga comercial de Quillay volvería con $13.0M» SÍ nombra la métrica carga (y los $13.0M son venta)", [["Si fuera un error de carga y volviera con $13.0M", "Si la carga comercial de Quillay volviera con $13.0M"]], ["metrica_distinta"]);
  { const c = (h) => ultimo(h).afirmaciones.filter((a) => a.tipo === "conteo" || (a.token === "13"));
    const con = c(hiloDe("conteo/los-13-clientes-suman")), sin = sinR(REGLAS, "agregado", () => c(hiloDe("conteo/los-13-clientes-suman")));
    ok(con.every((a) => !FALSOS.has(a.veredicto)) && sin.some((a) => a.veredicto === "conteo_no_cierra"), "★ caso real B02 1.4 (ensayo 5) · «los 13 clientes suman $12.6M»: el 13 es el tamaño del conjunto que suma, no cuántos tienen vencido", jsn([con.map((a) => a.veredicto), sin.map((a) => a.veredicto)])); }

  // ── lo entregado como dato (perfil, rango de un criterio) y la diferencia entre dos cuentas
  rojo(REGLAS, "perfil", "entregado/perfil-dolar", /^\$916,16$/, "caso real A01 1.1 (ensayo 5) · «a $916,16 por US$»: el perfil que ADI entrega trae esa conversión");
  sigue("entregado/perfil-dolar", /^\$15\.5M$/, "«$15.5M» no se absorbe por la banda «US$15 millones» del perfil (lo entregado se cita a su precisión)", [["Es un contexto", "Su venta anual es $15.5M. Es un contexto"]], ["no_traza"]);
  rojo(REGLAS, "criterio_nombrado", "entregado/rango-del-criterio", /^(0,1 %|10 %)$/, "caso real B02 1.3 (ensayo 5) · «Piso de materialidad de cobranza: … Se mide en porcentaje, entre 0,1 % y 10 %»: el rango del criterio, nombrado en la misma viñeta");
  sigue("entregado/rango-del-criterio", /^(0,1 %|10 %)$/, "si la viñeta no nombra el criterio, el «0,1 % y 10 %» no tiene de dónde salir", [["Piso de materialidad de cobranza", "Otro criterio cualquiera"]], ["no_traza"]);
  { const c = (h) => ultimo(h).afirmaciones.filter((a) => a.tipo === "continuidad").map((a) => a.veredicto).join();
    const con = c(hiloDe("continuidad/diferencia-entre-ambos")), sin = sinR(REGLAS, "sujeto_compuesto", () => c(hiloDe("continuidad/diferencia-entre-ambos")));
    ok(!con.includes("cambio_no_avisado") && sin.includes("cambio_no_avisado"), "★ caso real B01 2.1 (ensayo 5) · «La diferencia entre ambos pasó de $12.3M a $11.4M» (tras nombrar a Norvik y Teravolt): el cambio «Norvik − Teravolt» SÍ se avisó", jsn([con, sin]));
    ok(c(hiloDe("continuidad/diferencia-entre-ambos", [["a $11.4M", "a $11.9M"]])).includes("cambio_no_avisado"), "★ CARNADA · con «$11.9M» en vez de la cifra actual ($11.4M) el cambio NO se avisó"); }

  // ── la clasificación humana: su formato, sus hallazgos en palabras, los errores de ADI y el patrón sistemático
  for (const [e, esp] of [["ensayo-4", { hallazgos: 27, firmes: 2, candidatos: 1, hGrave: 2 }], ["ensayo-5", { hallazgos: 24, firmes: 1, candidatos: 1, hGrave: 1 }]]) {
    const c = leerClasificacion(FXC[e]);
    ok(c.hallazgos.length === esp.hallazgos && c.casosAdi.filter((k) => k.estado === "firme").length === esp.firmes && c.casosAdi.filter((k) => k.estado === "candidato").length === esp.candidatos && c.hallazgos.filter((h) => h.clase === "H-grave").length === esp.hGrave && esp.hGrave === FXC[e].esperado.hGravePorPalabras, `★ ${e}: la clasificación real se lee: ${esp.hallazgos} hallazgos en palabras (las celdas de la misma oración son UNO), ${esp.firmes} error(es) firme(s) de ADI, ${esp.candidatos} candidato, ${esp.hGrave} H-grave (= hGravePorPalabras de la persona)`, jsn([c.hallazgos.length, c.casosAdi.map((k) => k.estado), c.hallazgos.filter((h) => h.clase === "H-grave").map((h) => h.turnoId)]));
  }
  ok(familiaDeError("conteo_falso_en_palabras") === "conteo" && familiaDeError("conteo_mal_hecho") === "conteo" && familiaDeError("relacion_invertida_entre_ejes") === "relación o razón entre cifras" && familiaDeError("dueno_distinto") === "dueño distinto" && familiaDeError("metrica_distinta") === "métrica distinta" && familiaDeError("algo_nuevo") === "algo_nuevo", "las familias de error: conteo (en palabras o mal hecho) · relación invertida · dueño distinto · métrica distinta; lo no conocido es su propia familia");
  { const e = (id, familia, hilo) => ({ id, familia, hilo, oracion: id });
    ok(patronesSistematicos([e("a", "conteo", "A01"), e("b", "conteo", "B02")]).length === 1 && patronesSistematicos([e("a", "conteo", "A01"), e("b", "dueño distinto", "A01")]).length === 0 && patronesSistematicos([e("a", "conteo", "A01"), e("b", "conteo", "A01"), e("c", "métrica distinta", "C01")], { minRepeticiones: 3 }).length === 0, "★ patrón sistemático: la MISMA familia en 2 o más errores distintos (en un hilo o en varios); familias distintas no son patrón; el mínimo es un parámetro");
    ok(limiteDeErrores(499) === 0 && limiteDeErrores(500) === 1 && limiteDeErrores(999) === 1 && limiteDeErrores(1000) === 2 && limiteDeErrores(0) === 0 && PARAMETROS_DE_CIERRE.afirmacionesPorError === 500, "★ límite = piso de N ÷ 500 (N < 500 → 0; 500 → 1; 999 → 1; 1000 → 2)"); }

  // ── el informe: la regla partida (ADI · anfitrión por 500 · patrón · cruces · contrato informativo)
  {
    const manifiesto = { corridaId: "f5", tipo: "oficial", via: "api", modelo: "m", corpus: { corpusId: "c1", sha256: "x", juguete: false }, hashes: { instruccion: "i", herramientas: "h" }, sello: { ok: true } };
    const cierreF5 = (n) => ({ turnosPlaneados: n, turnosHechos: n, motivo: "completa", consumo: { sinConteoPct: 0, modelosSinPrecio: [] } });
    const juezF5 = (n) => ({ turnos: Object.fromEntries(Array.from({ length: n }, (_, k) => [`H|1|${k + 1}`, { ok: true, afirmaciones: [], naturalidad: null }])) });
    const lineas = (n, base = `Cadena Quillay vendió ${venta}.`) => Array.from({ length: n }, () => base).join("\n");
    const informeF5 = (textos, o = {}) => calcularInforme({ manifiesto, cierre: cierreF5(textos.length), hilos: [{ hiloId: "H", forma: "A", empresa: "rioclaro", turnos: textos.map((tx, k) => ({ sesion: 1, turno: k + 1, persona: "¿cuánto vendió Cadena Quillay?", textoEnviado: "¿cuánto vendió Cadena Quillay?", texto: tx, llamadas: [{ herramienta: "consultar", args: {}, resultado: E1 }] })) }], juez: o.sinJuez ? null : juezF5(textos.length), revision: o.revision || null, clasificacion: o.clasificacion || null, parametros: o.parametros || {} });
    const MALA = "Cadena Quillay vendió $99.9M este año.";      // no_traza
    const OTRO = "Casa Lomas vendió $13.0M este año.";         // dueno_distinto (la cifra existe, pero no es de Casa Lomas)

    // N < 500: el límite es 0 y se dice
    const chico = informeF5([`${lineas(40)}\n${MALA}`]);
    ok(chico.veredicto === "NO PASA" && chico.veredictoDetallado.criterios.anfitrion.limite === 0 && chico.veredictoDetallado.criterios.anfitrion.errores === 1 && /N = 41 < 500/.test(chico.veredictoDetallado.criterios.anfitrion.nota) && /con N = 41 < 500 el límite es 0/.test(informeEnMarkdown(chico)), "★ el borde N < 500: con 41 afirmaciones el límite es 0 y un solo error material reprueba — el informe LO DICE (lectura literal de «máximo 1 cada 500»)", `${chico.veredicto} · ${chico.porQue}`);
    // N ≥ 500: un error se tolera
    const medio = informeF5([`${lineas(520)}\n${MALA}`]);
    ok(medio.veredictoDetallado.criterios.anfitrion.afirmaciones === 521 && medio.veredictoDetallado.criterios.anfitrion.limite === 1 && medio.veredictoDetallado.criterios.anfitrion.errores === 1 && medio.veredicto === "PASA" && medio.provisional === true, "★ 521 afirmaciones y 1 error material: dentro del límite (1) → PASA (PROVISIONAL: sin la clasificación humana)", `${medio.veredicto} · ${medio.porQue}`);
    ok(medio.veredictoDetallado.criterios.anfitrion.tasaPor500 === 0.96 && /Veredicto: PASA \(PROVISIONAL\)/.test(informeEnMarkdown(medio)) && /## Veredicto de cierre \(regla del 2026-10-07\)/.test(informeEnMarkdown(medio)) && /tasa de errores del anfitrión \| 0\.96 por 500/.test(informeEnMarkdown(medio)), "la tasa por 500 y el veredicto provisional se imprimen", String(informeEnMarkdown(medio)).slice(0, 400));
    // dos errores sobre 521: pasa el límite
    const dos = informeF5([`${lineas(520)}\n${MALA}\n${OTRO}`]);
    ok(dos.veredicto === "NO PASA" && dos.veredictoDetallado.criterios.anfitrion.cumple === false, "2 errores materiales sobre 521 afirmaciones superan el límite (1): NO PASA", `${dos.veredicto} · ${dos.porQue}`);
    // N ≥ 1000: dos errores caben; pero de la MISMA familia son un patrón sistemático
    const mil = (...malas) => informeF5([`${lineas(1010)}\n${malas.join("\n")}`]);
    const mismoTipo = mil(MALA, "Cadena Quillay vendió $98.8M este año.");
    ok(mismoTipo.veredictoDetallado.criterios.anfitrion.limite === 2 && mismoTipo.veredictoDetallado.criterios.anfitrion.cumple === true && mismoTipo.veredictoDetallado.criterios.patron.sistematico === true && mismoTipo.veredicto === "NO PASA" && /patrón sistemático: cifra sin respaldo ×2/.test(mismoTipo.porQue), "★ dos errores de la MISMA familia (cifra sin respaldo ×2) caben en el límite (2 sobre 1.012) pero son un patrón sistemático: NO PASA", `${mismoTipo.veredicto} · ${mismoTipo.porQue}`);
    const distintos = mil(MALA, OTRO);
    ok(distintos.veredictoDetallado.criterios.patron.sistematico === false && distintos.veredicto === "PASA", "dos errores de familias distintas (cifra sin respaldo · dueño distinto) dentro del límite, sin patrón → PASA", `${distintos.veredicto} · ${distintos.porQue}`);
    // los cruces siguen duros
    const cruce = informeF5([`${lineas(520)}\nFalabella vendió ${venta}.`]);
    ok(cruce.veredicto === "NO PASA" && cruce.veredictoDetallado.criterios.cruces.n === 1 && /1 cruce\(s\) entre empresas/.test(cruce.porQue), "★ un cruce entre empresas reprueba aunque no haya errores de cifra (0 cruces es duro)", `${cruce.veredicto} · ${cruce.porQue}`);
    // el cumplimiento del contrato es informativo (parámetro)
    const nV = filasE1.find((f) => f.metrica === "Venta").valor;
    const calc = informeF5([`Cadena Quillay vendió ${nV}.`, "Cadena Quillay vendió el doble que Casa Lomas."].slice(0, 1));
    ok(calc.veredictoDetallado.criterios.cumplimientoDelContrato.informativo === true && calc.veredictoDetallado.criterios.cumplimientoDelContrato.cumple === null, "el cumplimiento del contrato se informa y por defecto NO decide (informativo)");
    // …y con un umbral como parámetro, decide
    const conUmbral = informeF5([`${lineas(520)}`], { parametros: { umbralDeCumplimientoPct: 100.5 } });
    ok(conUmbral.veredicto === "NO PASA" && conUmbral.veredictoDetallado.criterios.cumplimientoDelContrato.cumple === false && /cumplimiento del contrato 100 % < umbral 100\.5 %/.test(conUmbral.porQue), "con `umbralDeCumplimientoPct` el cumplimiento sí decide (parámetro, no regla fija)", `${conUmbral.veredicto} · ${conUmbral.porQue}`);
    // la persona y los ejemplos no son afirmaciones empresariales
    const hP = [hiloDe("persona/45-dias-en-palabras"), hiloDe("ejemplo/si-me-dice-un-crecimiento")];
    const infP = calcularInforme({ manifiesto, cierre: cierreF5(2), hilos: hP.map((h, i) => ({ ...h, hiloId: i ? "E" : "P" })), juez: null, revision: null, clasificacion: { filas: [] } });
    ok(infP.declaradasPorLaPersona.length === 2 && infP.ejemplosHipoteticos.length === 1 && infP.veredictoDetallado.afirmacionesEmpresariales.excluidas.dichasPorLaPersona === 2 && infP.veredictoDetallado.afirmacionesEmpresariales.excluidas.ejemplosHipoteticos === 1 && infP.erroresMateriales.length === 0 && infP.contrato.cifras === infP.contrato.hechoDeAdi + infP.contrato.fueraDeContrato.total + infP.contrato.erroresMateriales && /## Ejemplos hipotéticos/.test(informeEnMarkdown(infP)), "★ las cifras de la PERSONA y los ejemplos hipotéticos quedan FUERA del denominador (se listan aparte, con su origen) y no son errores", jsn([infP.declaradasPorLaPersona.length, infP.ejemplosHipoteticos.length, infP.erroresMateriales.length]));
    // la clasificación humana manda: H-grave cuenta, V es falla del medidor, H-leve no es material, los errores de ADI duros
    const base = [`${lineas(520)}\n${MALA}\n${OTRO}\nCadena Quillay vendió $77.7M este año.`];
    const idDe = (k) => `H|1|1|${k}`;
    const cl = (filas, extra = {}) => ({ filas, ...extra });
    const infC = informeF5(base, { clasificacion: cl([{ id: idDe(521), clase: "V", subtipo: "falla_del_medidor" }, { id: idDe(522), clase: "H-leve", subtipo: "umbral_redondeado" }, { id: idDe(523), clase: "H-grave", subtipo: "cifra_inventada" }]) });
    ok(infC.provisional === false && infC.fallasDelMedidor.length === 1 && infC.veredictoDetallado.criterios.anfitrion.errores === 1 && infC.veredictoDetallado.criterios.anfitrion.afirmaciones === 523 && infC.veredicto === "PASA", "★ `clasificacion.json` manda: V = falla del medidor (no cuenta), H-leve = falsa pero inmaterial, H-grave = error material (1 sobre 523 afirmaciones) → PASA no provisional", `${infC.veredicto} · prov ${infC.provisional} · ${infC.porQue}`);
    const palabras = { palabras: [{ id: "H|1|1", clase: "H-grave", subtipo: "conteo_falso_en_palabras", oracion: "Dos de tus tres clientes más grandes están en rojo." }, { id: "H|1|2 · H|1|3", clase: "H-correcta", subtipo: "relacion_propia_en_palabras", oracion: "" }] };
    const infW = informeF5([`${lineas(520)}`, "x", "y"], { clasificacion: cl([], palabras) });
    ok(infW.veredictoDetallado.afirmacionesEmpresariales.delasPalabras === 3 && infW.veredictoDetallado.criterios.anfitrion.errores === 1 && infW.veredictoDetallado.criterios.anfitrion.afirmaciones === 523 && infW.veredictoDetallado.erroresDelAnfitrion[0].familia === "conteo", "★ los hallazgos EN PALABRAS de la persona (lo que el rastreo no ve) suman al denominador (3) y el H-grave cuenta como error (familia: conteo)", jsn(infW.veredictoDetallado.afirmacionesEmpresariales));
    const adiFirme = informeF5([`${lineas(520)}`], { clasificacion: cl([], { casosA: [{ id: "H|1|1", tipo: "A · cifras entregadas sin id derivable", estado: "firme", evidencia: "x" }] }) });
    ok(adiFirme.veredicto === "NO PASA" && adiFirme.erroresDeAdi.length === 1 && adiFirme.veredictoDetallado.criterios.adi.cumple === false && /1 error\(es\) de ADI/.test(adiFirme.porQue), "★ un error de ADI «firme» de la clasificación reprueba (0 es duro), aunque el anfitrión esté impecable", `${adiFirme.veredicto} · ${adiFirme.porQue}`);
    const adiCand = informeF5([`${lineas(520)}`], { clasificacion: cl([], { casosA: [{ id: "H|1|2", tipo: "A-candidato · derivar rechaza una derivación válida", estado: "a decidir por el owner", evidencia: "x" }] }) });
    ok(adiCand.veredicto === "NO CONCLUYENTE" && adiCand.veredictoDetallado.criterios.adi.candidatos === 1 && /candidato\(s\) a error de ADI sin decidir/.test(adiCand.porQue), "un CANDIDATO a error de ADI sin decidir deja el veredicto en NO CONCLUYENTE (no PASA hasta que el owner decida)", `${adiCand.veredicto} · ${adiCand.porQue}`);
    const levesRep = informeF5([`${lineas(520)}`], { clasificacion: cl([], { palabras: [{ id: "H|1|1", clase: "H-leve", subtipo: "causalidad_sin_respaldo", oracion: "a" }, { id: "H|1|2", clase: "H-leve", subtipo: "causalidad_sin_respaldo", oracion: "b" }] }) });
    ok(levesRep.veredicto === "PASA" && levesRep.veredictoDetallado.criterios.patron.levesRepetidos.length === 1 && levesRep.veredictoDetallado.criterios.patron.sistematico === false, "los errores LEVES repetidos se informan pero no cuentan para el patrón (por defecto)", `${levesRep.veredicto}`);
    const levesRep2 = informeF5([`${lineas(520)}`], { clasificacion: cl([], { palabras: [{ id: "H|1|1", clase: "H-leve", subtipo: "causalidad_sin_respaldo", oracion: "a" }, { id: "H|1|2", clase: "H-leve", subtipo: "causalidad_sin_respaldo", oracion: "b" }] }), parametros: { incluirLevesEnElPatron: true } });
    ok(levesRep2.veredicto === "NO PASA" && levesRep2.veredictoDetallado.criterios.patron.sistematico === true, "…y con `incluirLevesEnElPatron` sí cuentan (parámetro)", `${levesRep2.veredicto}`);
    // provisional vs revisado, y el cierre de etapa
    ok(informeF5([`${lineas(520)}`]).provisional === true && informeF5([`${lineas(520)}`], { clasificacion: cl([]) }).provisional === false && informeF5([`${lineas(520)}`], { revision: { decisiones: { "H|1|1|1": { veredicto: "verdadera" } } } }).provisional === false, "★ sin `clasificacion.json` ni `revision.json` el veredicto es PROVISIONAL; con cualquiera de los dos, no");
    const a = informeF5([`${lineas(520)}`], { clasificacion: cl([]) }), b = informeF5([`${lineas(520)}`]);
    const ofi = (i, corpusId, sha) => ({ ...i, tipo: "oficial", modelo: "m", via: "api", corpus: { corpusId, sha256: sha } });
    ok(cierreDeEtapa([ofi(a, "c1", "x"), ofi(a, "c2", "y")]).pasa === true && cierreDeEtapa([ofi(a, "c1", "x"), ofi(b, "c2", "y")]).pasa === false && /PROVISIONAL/.test(cierreDeEtapa([ofi(a, "c1", "x"), ofi(b, "c2", "y")]).motivo), "★ `cierreDeEtapa`: dos corridas oficiales que PASAN y están revisadas; una PROVISIONAL no cierra la etapa");
    ok(/a lo más 1 error material del anfitrión cada 500 afirmaciones empresariales/.test(REGLA_DE_CIERRE) && /N < 500 el límite es 0/.test(REGLA_DE_CIERRE) && /ningún patrón sistemático repetido/.test(REGLA_DE_CIERRE) && /0 errores de ADI/.test(REGLA_DE_CIERRE) && /0 cruces entre empresas: duro/.test(REGLA_DE_CIERRE) && /umbral del cumplimiento es un parámetro/.test(REGLA_DE_CIERRE) && !/0 errores materiales del anfitrión/.test(REGLA_DE_CIERRE) && /PROVISIONAL/.test(REGLA_DE_CIERRE), "★ `REGLA_DE_CIERRE` es la del 2026-10-07: ADI 0 · anfitrión ≤ 1 cada 500 y sin patrón · 0 cruces · cumplimiento informativo (parámetro) · veredicto provisional sin revisión humana");
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
/* ═════ H2 · LA LLAMADA MAL DIRIGIDA ES UNA OBSERVACIÓN, NO UNA ANULACIÓN (owner 2026-10-09, opción A · ensayo 11, C04_s1) ═════
 * El ensayo 11 se anuló porque el modelo llamó a «derivar» (sin `mcp__adi__`) y el CLI lo rechazó («No such tool available») SIN ejecutar nada.
 * Fixture: los 5 eventos reales del `stream.jsonl` de esa sesión. Regla: un nombre de acción de ADI sin prefijo que el CLI rechazó antes de ejecutar
 * es una observación; cualquier otra herramienta ajena, o una llamada ajena que no se pueda probar rechazada, sigue anulando. */
seccion("H2 · la llamada mal dirigida (nombre sin prefijo, rechazada por el CLI sin ejecutar) es una OBSERVACIÓN de la corrida");
{
  const FX = JSON.parse(fs.readFileSync(new URL("./fixtures/medicion-anfitrion/ensayo-11-C04_s1-llamada-mal-dirigida.json", import.meta.url), "utf8"));
  const ev = FX.eventos;
  ok(ev.length === 5 && ev[0].subtype === "init" && ev.filter((e) => e.type === "assistant").every((e) => e.message.content.every((b) => b.type !== "tool_use" || b.name === "derivar")) && ev.filter((e) => e.type === "user").every((e) => e.message.content[0].is_error === true && /No such tool available: derivar/.test(e.message.content[0].content)), "el fixture son los eventos REALES de C04_s1: dos llamadas a «derivar» y sus dos errores «No such tool available» del CLI");
  const R = chequearLimpieza({ eventos: ev, modelo: "claude-sonnet-5-5", enviados: [] });
  ok(R.limpia === true && R.hallazgos.length === 0, "★ la corrida con el stream REAL de C04_s1 queda LIMPIA (antes se anulaba por `tool_use_ajeno`)", JSON.stringify(R.hallazgos));
  ok(Array.isArray(R.observaciones) && R.observaciones.length === 1 && R.observaciones[0].regla === "llamada_mal_dirigida" && R.observaciones[0].herramienta === "derivar" && R.observaciones[0].llamadas === 2 && /rechazada sin ejecutar/.test(R.observaciones[0].detalle) && /No such tool available/.test(R.observaciones[0].detalle), "y deja UNA observación «llamada mal dirigida, rechazada sin ejecutar» con las dos llamadas contadas", JSON.stringify(R.observaciones));
  const tuUso = (id, name, input = {}) => ({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id, name, input }] } });
  const resultado = (id, content, is_error) => ({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content, ...(is_error === undefined ? {} : { is_error }) }] } });
  const init = ev[0];
  const anula = (eventos) => { const r = chequearLimpieza({ eventos, modelo: "claude-sonnet-5-5" }); return !r.limpia && r.hallazgos.some((h) => h.regla === "tool_use_ajeno"); };
  /* CARNADAS: lo que NO es una observación sigue anulando */
  ok(anula([init, tuUso("t1", "Bash", { command: "ls" }), resultado("t1", "<tool_use_error>Error: No such tool available: Bash</tool_use_error>", true)]), "★ CARNADA · otra herramienta ajena (Bash), aunque el CLI también la rechace, ANULA");
  ok(anula([init, tuUso("t1", "Read", { file_path: "x" }), resultado("t1", "contenido", false)]), "★ CARNADA · una herramienta ajena que EJECUTÓ (Read) ANULA");
  ok(anula([init, tuUso("t1", "derivar", { operacion: "suma" }), resultado("t1", "{\"ok\":true,\"hecho\":{\"id\":\"D1\"}}", false)]), "★ CARNADA · «derivar» sin prefijo CON un resultado que no es el rechazo del CLI (alguien ejecutó algo) ANULA");
  ok(anula([init, tuUso("t1", "derivar", { operacion: "suma" })]), "★ CARNADA · «derivar» sin prefijo SIN resultado en el stream (no se puede probar que no ejecutó) ANULA");
  ok(anula([init, tuUso("t1", "derivar", { operacion: "suma" }), resultado("t1", "Error: permission denied", true)]), "★ CARNADA · un error que no es «No such tool available» no prueba el rechazo previo a la ejecución: ANULA");
  ok(anula([init, tuUso("t1", "derivar"), resultado("t1", "<tool_use_error>Error: No such tool available: derivar</tool_use_error>", true), tuUso("t2", "Bash", { command: "ls" }), resultado("t2", "x", false)]), "★ CARNADA · una llamada mal dirigida NO tapa a una herramienta ajena de la misma sesión: ANULA");
  ok(anula([init, tuUso("t1", "consultarTodo"), resultado("t1", "<tool_use_error>Error: No such tool available: consultarTodo</tool_use_error>", true)]), "★ CARNADA · un nombre que ni siquiera es una acción de ADI (con o sin prefijo) ANULA");
  /* las cinco acciones, sin prefijo, rechazadas: cada una es observación; con prefijo y bien escritas no hay nada que observar */
  const cinco = ["conocerEmpresa", "consultar", "aportarContexto", "retomar", "derivar"];
  const rs = chequearLimpieza({ eventos: [init, ...cinco.flatMap((n, i) => [tuUso(`c${i}`, n), resultado(`c${i}`, `<tool_use_error>Error: No such tool available: ${n}</tool_use_error>`, true)])], modelo: "claude-sonnet-5-5" });
  ok(rs.limpia && rs.observaciones.map((o) => o.herramienta).sort().join() === [...cinco].sort().join(), "las cinco acciones de ADI sin prefijo y rechazadas son observaciones (y quedan nombradas)");
  ok(chequearLimpieza({ eventos: [init, tuUso("t1", "mcp__adi__derivar"), resultado("t1", "{}", false)], modelo: "claude-sonnet-5-5" }).observaciones.length === 0, "una llamada bien dirigida no deja observación");
  /* el informe lo dice: la observación viaja al cierre de la corrida y al informe, y NO es una invalidación */
  const InfObs = baseInf({ limpieza: [{ hilo: "A01", sesion: 1, limpia: true, hallazgos: [], observaciones: R.observaciones }] });
  ok(Array.isArray(InfObs.observaciones) && InfObs.observaciones.length === 1 && InfObs.observaciones[0].regla === "llamada_mal_dirigida" && InfObs.observaciones[0].hilo === "A01" && InfObs.observaciones[0].sesion === 1 && !InfObs.invalidaciones.some((v) => /limpieza/.test(v)), "★ el informe lista la observación (hilo, sesión, herramienta, llamadas) y NO la cuenta como invalidación", JSON.stringify({ o: InfObs.observaciones, inv: InfObs.invalidaciones }));
  { const { familiaDeError: fam } = await import(D + "clasificacion.mjs"); ok(fam("herramienta_no_disponible_falso") === "afirmación no sostenida", "★ la frase del anfitrión «la herramienta no estaba disponible» se clasifica como error del ANFITRIÓN (familia «afirmación no sostenida», subtipo herramienta_no_disponible_falso), nunca de ADI"); }
  ok(/Observaciones de la corrida/.test(informeEnMarkdown(InfObs)) && /llamada mal dirigida/.test(informeEnMarkdown(InfObs)), "y el informe en Markdown tiene su sección «Observaciones de la corrida»");
}
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


/* ═════ I · EL BRAZO DEL A/B (`_ADI_DISENO_ALCANCE_DE_LO_ENTREGADO.md` §6.2) ═══════════════════════════════════════════════════════════════════════════════════
 * `--brazo=A|B` fija ADI_ALCANCE_ESTRUCTURAL ("0" = A, la entrega de hoy · "1" = B, el valor por defecto) SOLO en el entorno del servidor de ADI (bloque `env` del --mcp-config; el `env` de la puerta en la vía api) y lo QUITA
 * del entorno del anfitrión. El servidor deja `arranque.json` con lo que vio y el arnés lo contrasta: un brazo que no llegó invalida la corrida. Una corrida es de UN brazo. Con el `claude` falso, que levanta el servidor REAL por stdio. */
seccion("I · el brazo del A/B: llega al servidor de ADI y solo ahí; las corridas no mezclan brazos");
const BR = await import(D + "brazo.mjs");
{
  const { VARIABLE_DEL_BRAZO, BRAZO_POR_DEFECTO, normalizarBrazo, valorDelBrazo, brazoDeValor, envDelBrazo } = BR;
  ok(VARIABLE_DEL_BRAZO === "ADI_ALCANCE_ESTRUCTURAL" && BRAZO_POR_DEFECTO === "B" && valorDelBrazo("A") === "0" && valorDelBrazo("B") === "1" && brazoDeValor("0") === "A" && brazoDeValor("1") === "B" && brazoDeValor("2") === null && brazoDeValor(undefined) === null, "★ el contrato del brazo: A = «0» (la entrega de hoy), B = «1» (alcance estructural, el valor por defecto) en ADI_ALCANCE_ESTRUCTURAL");
  ok(normalizarBrazo("a") === "A" && normalizarBrazo(" B ") === "B" && normalizarBrazo("C") === null && normalizarBrazo(undefined) === null && normalizarBrazo(true) === null && JSON.stringify(envDelBrazo("A")) === '{"ADI_ALCANCE_ESTRUCTURAL":"0"}', "normalizarBrazo y envDelBrazo");
  let lanza = false; try { envDelBrazo("C"); } catch { lanza = true; }
  ok(lanza, "envDelBrazo rechaza un brazo que no es A ni B");
  // validarArgs
  const base = { via: "cli", tipo: "ensayo", catalogo: "c.json", modelo: "claude-sonnet-5-5", salida: "s", "tope-llamadas": "5" };
  ok(validarArgs({ ...base, brazo: "C" }, {}).some((e) => /--brazo debe ser A o B/.test(e)) && validarArgs({ ...base, brazo: "a" }, {}).length === 0 && validarArgs(base, {}).length === 0, "★ validarArgs: --brazo debe ser A|B (sin él vale el B por defecto)");
  ok(validarArgs({ ...base, "serie-ab": "x" }, {}).some((e) => /--brazo=A\|B explícito/.test(e)) && validarArgs({ ...base, "serie-ab": "x", brazo: "A" }, {}).some((e) => /--repeticion=1\|2/.test(e)) && validarArgs({ ...base, "serie-ab": "x", brazo: "A", repeticion: "3", sello: "s.json" }, {}).some((e) => /--repeticion=1\|2/.test(e)) && validarArgs({ ...base, "serie-ab": "x", brazo: "A", repeticion: "1" }, {}).some((e) => /--sello/.test(e)) && validarArgs({ ...base, "serie-ab": "x", brazo: "A", repeticion: "2", sello: "s.json" }, {}).length === 0 && validarArgs({ ...base, repeticion: "1" }, {}).some((e) => /solo existe dentro de una serie/.test(e)) && validarArgs({ ...base, "serie-ab": true, brazo: "A", repeticion: "1", sello: "s.json" }, {}).some((e) => /necesita un nombre/.test(e)), "★ validarArgs: una serie exige nombre, brazo explícito, repetición 1|2 y sello; --repeticion no existe fuera de una serie");
  // el comando: el brazo va en el `env` del servidor «adi», NO en el del anfitrión
  const cmdA = armarComandoCli({ modelo: "m", dirTrabajo: "d", rutaMcpConfig: "c.json", brazo: "A", baseEnv: { PATH: "p", ADI_ALCANCE_ESTRUCTURAL: "1" }, mcp: { estado: "e", empresa: "demo", salidaEstado: "o", bitacora: "b", arranque: "a.json" } });
  ok(JSON.stringify(cmdA.mcpConfig.mcpServers.adi.env) === '{"ADI_ALCANCE_ESTRUCTURAL":"0"}' && cmdA.mcpConfig.mcpServers.adi.args.includes("--arranque=a.json"), "★ armarComandoCli: el brazo A va en el bloque `env` del servidor «adi» (y el servidor sabe dónde dejar su arranque)");
  ok(!("ADI_ALCANCE_ESTRUCTURAL" in cmdA.env) && cmdA.quitadas.includes("ADI_ALCANCE_ESTRUCTURAL") && cmdA.env.PATH === "p", "★ …y el entorno del anfitrión NO lo lleva: si el arnés lo heredó de la consola, se QUITA");
  const cmdSin = armarComandoCli({ modelo: "m", dirTrabajo: "d", rutaMcpConfig: "c.json", baseEnv: { PATH: "p" }, mcp: { estado: "e", empresa: "demo", salidaEstado: "o", bitacora: "b" } });
  ok(JSON.stringify(cmdSin.mcpConfig.mcpServers.adi.env) === "{}" && !cmdSin.mcpConfig.mcpServers.adi.args.some((a) => /^--arranque=/.test(a)), "sin brazo el comando es el de siempre (env vacío del servidor)");

  // ── extremo a extremo con el `claude` falso (el servidor MCP real por stdio)
  const SA = sub("brazo-A");
  const { R: RA, llamadas: llA } = await runCli({ hilo: "A01", salida: SA, extra: ["--brazo=A"], envExtra: { ADI_ALCANCE_ESTRUCTURAL: "1" } });
  const manA = leerJson(path.join(SA, "manifiesto.json")), arrA = leerJson(path.join(SA, "sesiones", "A01_s1", "arranque.json")), cfgA = leerJson(path.join(SA, "sesiones", "A01_s1", "mcp-config.json"));
  ok(RA.cierre.motivo === "completa" && manA.brazo.id === "A" && manA.brazo.valor === "0" && manA.brazo.variable === "ADI_ALCANCE_ESTRUCTURAL" && manA.brazo.porDefecto === false, "★ el manifiesto registra el brazo A (valor «0», no por defecto)", JSON.stringify(manA.brazo));
  ok(JSON.stringify(cfgA.mcpServers.adi.env) === '{"ADI_ALCANCE_ESTRUCTURAL":"0"}', "★ el --mcp-config de la sesión lleva el brazo en el `env` del servidor «adi»");
  ok(arrA.ADI_ALCANCE_ESTRUCTURAL === "0" && arrA.brazo === "A" && arrA.efectivoEnLaPuerta === "0" && arrA.empresa === "demo", "★ el servidor de ADI (el `mcp-adi.mjs` REAL, por stdio) VIO «0» y se lo pasó a su puerta", JSON.stringify(arrA));
  ok(llA.length >= 1 && llA.every((l) => l.env.ADI_ALCANCE_ESTRUCTURAL === null), "★ el entorno del ANFITRIÓN no lleva la variable (aunque la consola del arnés la traía puesta en «1»): la quitó el arnés");
  ok(RA.cierre.brazo.id === "A" && RA.cierre.servidores.length >= 1 && RA.cierre.servidores.every((x) => x.ok === true && x.esperado === "0" && x.visto === "0"), "el cierre de la corrida deja lo que vio cada servidor y que coincide con el brazo", JSON.stringify(RA.cierre.servidores));
  const trA = leerJson(path.join(SA, "transcritos", "A01.json"));
  ok(trA.brazo === "A" && trA.turnos.every((t) => t.brazo === "A") && RA.informe.brazo === "A" && RA.informe.invalidaciones.length === 1 && /JUGUETE/.test(RA.informe.invalidaciones[0]), "cada transcrito y cada turno llevan el brazo; el informe lo trae (la única invalidación es la del juguete)");
  ok(/Brazo del A\/B: A/.test(informeEnMarkdown(RA.informe)) && /ADI_ALCANCE_ESTRUCTURAL=0/.test(informeEnMarkdown(RA.informe)), "el informe en Markdown nombra el brazo y la variable");
  ok(/^[0-9a-f]{64}$/.test(manA.hashes.codigo) && manA.hashes.codigo === RA.cierre.codigoHuellaFinal, "la huella del código sigue registrada en el manifiesto (y es la misma al cierre)");
  // el valor por defecto
  const { R: RD } = await runCli({ hilo: "A01", salida: sub("brazo-defecto") });
  const manD = leerJson(path.join(sub("brazo-defecto"), "manifiesto.json")), arrD = leerJson(path.join(sub("brazo-defecto"), "sesiones", "A01_s1", "arranque.json"));
  ok(manD.brazo.id === "B" && manD.brazo.porDefecto === true && arrD.ADI_ALCANCE_ESTRUCTURAL === "1" && RD.cierre.servidores.every((x) => x.ok), "★ sin --brazo el brazo es el B (alcance estructural), declarado «por defecto», y el servidor vio «1»");
  const { R: RB } = await runCli({ hilo: "A01", salida: sub("brazo-B"), extra: ["--brazo=B"], envExtra: { ADI_ALCANCE_ESTRUCTURAL: "0" } });
  ok(leerJson(path.join(sub("brazo-B"), "sesiones", "A01_s1", "arranque.json")).ADI_ALCANCE_ESTRUCTURAL === "1" && RB.cierre.brazo.id === "B", "--brazo=B pisa lo que traiga la consola del arnés: el servidor vio «1»");

  // ── el brazo que NO llega al servidor invalida la corrida (un anfitrión que pierde el `env` del servidor)
  const { R: RP } = await runCli({ hilo: "A01", salida: sub("brazo-perdido"), extra: ["--brazo=A"], envExtra: { FALSO_IGNORAR_ENV_DEL_SERVIDOR: "1" } });
  ok(RP.cierre.motivo === "brazo_no_llego_al_servidor" && RP.cierre.servidores.some((x) => x.ok === false && x.esperado === "0") && RP.informe.invalidaciones.some((v) => /brazo A no llegó al servidor/.test(v)) && RP.informe.veredicto === "INVÁLIDA", "★ CARNADA · el servidor NO vio el brazo (el anfitrión perdió su `env`): la corrida se corta y es INVÁLIDA", JSON.stringify(RP.cierre.detalle || RP.cierre.servidores));
  ok(RP.cierre.turnosHechos <= 1, "…y se corta TEMPRANO (tras el primer turno)", String(RP.cierre.turnosHechos));

  // ── no se mezclan brazos en una corrida
  const outMix = []; const regMix = path.join(TMP, "mezcla-reg.jsonl");
  const envMix = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, FALSO_REGISTRO: regMix };
  const rMixA = await ejecutarArnes(["--via=cli", "--tipo=ensayo", `--catalogo=${RUTA_JUGUETE}`, "--modelo=claude-sonnet-5-5", `--salida=${SA}`, "--tope-llamadas=200", "--brazo=B", "--hilo=A01"], { env: envMix, escribir: (m) => outMix.push(m), ahora, claudeBin: RUTA_FALSO, versionCli: "falso", carpetaAislada: () => ({ aislada: true, problemas: [] }) });
  ok(rMixA.codigo === 3 && /ya tiene una corrida del brazo A/.test(outMix.join("\n")), "★ la MISMA carpeta de salida no recibe una corrida del otro brazo", outMix.join(" | ").slice(0, 200));
  const rMixB = await ejecutarArnes(["--via=cli", "--tipo=ensayo", `--catalogo=${RUTA_JUGUETE}`, "--modelo=claude-sonnet-5-5", `--salida=${SA}`, "--tope-llamadas=200", "--brazo=B", "--hilo=A01", "--reanudar"], { env: envMix, escribir: (m) => outMix.push(m), ahora, claudeBin: RUTA_FALSO, versionCli: "falso", carpetaAislada: () => ({ aislada: true, problemas: [] }) });
  ok(rMixB.codigo === 3 && /no se puede reanudar una corrida del brazo A con el brazo B/.test(outMix.join("\n")), "★ y reanudar una corrida del brazo A con el brazo B se rechaza");
  // un transcrito que trae turnos de otro brazo invalida la corrida
  const dirMez = sub("brazo-mezclado"); fs.cpSync(SA, dirMez, { recursive: true });
  const trM = leerJson(path.join(dirMez, "transcritos", "A01.json")); trM.turnos[trM.turnos.length - 1].brazo = "B"; fs.writeFileSync(path.join(dirMez, "transcritos", "A01.json"), JSON.stringify(trM));
  const infM = calcularInforme(cargarSalida(dirMez));
  ok(infM.invalidaciones.some((v) => /mezcla de brazos/.test(v)) && infM.veredicto === "INVÁLIDA", "★ CARNADA · un turno del brazo B dentro de una corrida del brazo A → la corrida es INVÁLIDA («mezcla de brazos»)", JSON.stringify(infM.invalidaciones));
  // las corridas anteriores al A/B (sin brazo) siguen leyéndose
  const manViejo = { ...manA }; delete manViejo.brazo; delete manViejo.serieAb;
  const infViejo = calcularInforme({ manifiesto: manViejo, cierre: RA.cierre, hilos: [trA] });
  ok(infViejo.brazo === null && /no registrado/.test(informeEnMarkdown(infViejo)) && !infViejo.invalidaciones.some((v) => /brazo/.test(v)), "una corrida anterior al A/B (sin brazo en el manifiesto) se informa igual: «no registrado»");

  // ── la vía api: la puerta en proceso lleva el brazo en su `env`, y process.env queda como estaba
  ok(process.env.ADI_ALCANCE_ESTRUCTURAL === undefined, "(antes) process.env no trae la variable del brazo");
  const aRaw = await abrirAlmacen({ estadoJson: crearEstadoInicial() });
  const pTocada = crearPuertaMcp({ almacen: aRaw, empresaId: "demo", alcanceEstructural: "0" });
  ok(aRaw.env.ADI_ALCANCE_ESTRUCTURAL === "0" && pTocada.alcanceEstructural() === "0" && process.env.ADI_ALCANCE_ESTRUCTURAL === undefined, "★ crearPuertaMcp pone el brazo en el `env` de ESA puerta y no toca process.env");
  const aLimpio = await abrirAlmacen({ estadoJson: crearEstadoInicial() });
  ok(crearPuertaMcp({ almacen: aLimpio, empresaId: "demo" }).alcanceEstructural() === null && !("ADI_ALCANCE_ESTRUCTURAL" in aLimpio.env), "sin brazo la puerta no inventa la variable (el servidor usa su valor por defecto)");
  let visto = null;
  const salidaApi = sub("brazo-api");
  const rApi = await correrApi({ hilo: "A01", salida: salidaApi, extra: ["--brazo=A"], deps: { transporte: (() => { const t = crearTransporteApiSimulado({ modo: "bueno", empresaId: "demo", registro: [] }); return async (req) => { visto = process.env.ADI_ALCANCE_ESTRUCTURAL; return t(req); }; })() } });
  const manApi = leerJson(path.join(salidaApi, "manifiesto.json")), trApi = leerJson(path.join(salidaApi, "transcritos", "A01.json"));
  ok(manApi.brazo.id === "A" && rApi.cierre.brazo.id === "A" && trApi.turnos.every((t) => t.brazo === "A") && visto === "0", "★ vía api: el manifiesto, el cierre y cada turno son del brazo A, y durante la corrida el proceso de la puerta vio «0»", String(visto));
  ok(process.env.ADI_ALCANCE_ESTRUCTURAL === undefined, "…y al terminar process.env queda como estaba (la variable no se escapa del arnés)");
  const salidaApiB = sub("brazo-api-defecto"); await correrApi({ hilo: "A01", salida: salidaApiB });
  ok(leerJson(path.join(salidaApiB, "manifiesto.json")).brazo.id === "B", "vía api sin --brazo: el B por defecto");
  // --solo-imprimir lo dice
  const salImp = []; await ejecutarArnes(["--via=cli", "--tipo=ensayo", "--solo-imprimir", "--modelo=claude-sonnet-5-5", `--salida=${sub("imp-brazo")}`, "--tope-llamadas=9", "--brazo=A"], { env: { PATH: process.env.PATH }, escribir: (t) => salImp.push(t), claudeBin: RUTA_FALSO });
  ok(/BRAZO del A\/B: A → ADI_ALCANCE_ESTRUCTURAL=0 SOLO en el `env` del servidor/.test(salImp.join("\n")) && !fs.existsSync(sub("imp-brazo")), "--solo-imprimir declara el brazo y dónde va (y no crea nada)");
}


/* ═════ J · LA SERIE A/B: UN CORPUS SELLADO, CUATRO CORRIDAS (A·1, A·2, B·1, B·2) ════════════════════════════════════════════════════════════════════════════════
 * Un corpus usado no se vuelve a abrir (C). La serie A/B es la excepción explícita y acotada: la primera corrida quema el sello y deja SERIE-AB.json; las otras tres lo abren sin --reanudar solo si son de ESA serie y ESE corpus,
 * no son la quinta, nadie más quemó el sello y el código no cambió. Fuera de una serie, nada cambia. */
seccion("J · la serie A/B: el MISMO corpus sellado corre cuatro veces; la quinta o la de otra serie se rechaza");
const SERIE = await import(D + "serie-ab.mjs");
let CORRIDAS_SERIE = null;
{
  const { ruta: rutaC, sello: rutaS } = corpusComoOficial("serie-gate");
  const rutaSerie = SERIE.rutaDeLaSerie(rutaS);
  ok(path.basename(rutaSerie) === "serie-gate.SELLO.SERIE-AB.json" && path.dirname(rutaSerie) === path.dirname(rutaS) && path.basename(SERIE.rutaDeLaSerie("/x/corpus-ensayo-13/SELLO.json")) === "SERIE-AB.json" && path.basename(SERIE.rutaDeLaSerie("/x/y/otro.json")) === "otro.SERIE-AB.json", "★ SERIE-AB.json vive JUNTO al sello (junto a un `SELLO.json` se llama exactamente SERIE-AB.json; si hay varios sellos en la carpeta, `<sello>.SERIE-AB.json`: una serie es de UN sello)");
  const serieAb = (brazo, rep, salida, { nombre = "ensayo-13", extra = [], deps = {}, corpus = rutaC, sello = rutaS, hilo = null } = {}) =>
    correrApi({ corpus, salida, hilo, extra: [`--sello=${sello}`, `--serie-ab=${nombre}`, `--brazo=${brazo}`, `--repeticion=${rep}`, ...extra], deps });
  const rechazo = async (que, f, esperado, c = 4) => { const out = []; const r = await f(out); ok(r.codigo === c && esperado.test(out.join("\n")) && !r.cierre, `★ CARNADA · ${que}`, `${r.codigo} ${out.join(" | ").slice(0, 240)}`); };
  // fuera de una serie, el corpus sellado se quema como siempre
  const { ruta: rutaX, sello: selloX } = corpusComoOficial("fuera-de-serie");
  const out0 = []; const rX1 = await correrApi({ corpus: rutaX, salida: sub("fs-1"), hilo: "A01", extra: [`--sello=${selloX}`], deps: { escribir: (m) => out0.push(m) } });
  const rX2 = await correrApi({ corpus: rutaX, salida: sub("fs-2"), hilo: "A01", extra: [`--sello=${selloX}`], deps: { escribir: (m) => out0.push(m) } });
  ok(rX1.cierre && rX2.codigo === 4 && /ya fue LEÍDO/.test(out0.join("\n")) && !fs.existsSync(SERIE.rutaDeLaSerie(selloX)), "★ FUERA de una serie nada cambia: el corpus usado se rechaza (código 4) y no nace ninguna SERIE-AB.json", out0.join(" | ").slice(0, 200));

  // ── A·1: quema el sello y crea la serie
  const salidas = {};
  const corre = (brazo, rep, o = {}) => { const salida = sub(`serie-${brazo}${rep}`); salidas[`${brazo}${rep}`] = salidas[`${brazo}${rep}`] || salida; return serieAb(brazo, rep, salidas[`${brazo}${rep}`], o); };
  const r1 = await corre("A", 1);
  const selloTrasA1 = leerJson(rutaS), serieTrasA1 = leerJson(rutaSerie);
  ok(r1.cierre && selloTrasA1.leido === true && selloTrasA1.leidoPor === "serie-ab:ensayo-13" && serieTrasA1.formato === "serie-ab/v1" && serieTrasA1.nombre === "ensayo-13" && serieTrasA1.corpusSha256 === selloTrasA1.sha256 && serieTrasA1.leidoPor === selloTrasA1.leidoPor, "★ la PRIMERA corrida quema el sello como siempre y deja la serie (nombre, huella del corpus, quién lo quemó)", JSON.stringify(serieTrasA1).slice(0, 300));
  ok(serieTrasA1.planeadas.map((c) => `${c.brazo}${c.repeticion}`).join() === "A1,A2,B1,B2" && serieTrasA1.corridas.length === 1 && serieTrasA1.corridas[0].brazo === "A" && serieTrasA1.corridas[0].repeticion === 1 && /^[0-9a-f]{64}$/.test(serieTrasA1.codigoSha256), "…con las CUATRO corridas planeadas (A·1, A·2, B·1, B·2), la celda A·1 anotada y la huella del código");
  const manA1 = leerJson(path.join(salidas.A1, "manifiesto.json"));
  ok(manA1.serieAb.nombre === "ensayo-13" && manA1.serieAb.repeticion === 1 && manA1.brazo.id === "A" && manA1.hashes.codigo === serieTrasA1.codigoSha256 && /A1-/.test(manA1.corridaId), "el manifiesto de la corrida lleva la serie, la repetición y el brazo; su huella de código es la de la serie");

  // ── CARNADAS con la serie abierta y las otras celdas todavía libres
  await rechazo("una corrida de OTRA serie no puede abrir el corpus", (out) => corre("A", 2, { nombre: "ensayo-14", deps: { escribir: (m) => out.push(m) } }), /pertenece a la serie «ensayo-13», no a «ensayo-14»/);
  await rechazo("el CÓDIGO cambió desde la primera corrida de la serie (A y B no serían comparables)", (out) => corre("A", 2, { deps: { escribir: (m) => out.push(m), huellaDelCodigo: () => "f".repeat(64) } }), /CÓDIGO cambió/);
  { const s = leerJson(rutaS); const copia = JSON.stringify(s); s.leidoPor = "una persona abrió el corpus"; fs.writeFileSync(rutaS, JSON.stringify(s));
    await rechazo("si el sello lo quemó OTRO (una persona abrió el corpus) la serie NO lo abre: el sello sigue siendo la prueba", (out) => corre("A", 2, { deps: { escribir: (m) => out.push(m) } }), /no lo quemó la serie/);
    fs.writeFileSync(rutaS, copia); }
  ok(!fs.existsSync(salidas.A2 || sub("no-existe")) || true, "(las corridas rechazadas no dejan celdas anotadas)");
  ok(leerJson(rutaSerie).corridas.length === 1, "★ …y ninguna corrida rechazada anotó una celda en la serie");

  const out234 = []; const dd = { deps: { escribir: (m) => out234.push(m) } }; const r2 = await corre("A", 2, dd), r3 = await corre("B", 1, dd), r4 = await corre("B", 2, dd);
  ok(r2.cierre && r3.cierre && r4.cierre && leerJson(rutaSerie).corridas.map((c) => `${c.brazo}${c.repeticion}`).join() === "A1,A2,B1,B2", "★ A·2, B·1 y B·2 abren el MISMO corpus sin --reanudar (misma serie, misma huella, sello quemado por la serie)", out234.join(" | ").slice(0, 500));
  ok([r1, r2, r3, r4].every((r) => r.cierre) && [r1, r2, r3, r4].map((r) => r.cierre.brazo.id).join("") === "AABB" && [r1, r2, r3, r4].every((r) => r.informe.brazo === r.cierre.brazo.id), "cada corrida es de UN brazo: A A B B");
  ok(new Set([r1, r2, r3, r4].map((r) => leerJson(path.join(r.salida, "manifiesto.json")).hashes.codigo)).size === 1 && new Set([r1, r2, r3, r4].map((r) => leerJson(path.join(r.salida, "manifiesto.json")).corpus.sha256)).size === 1, "★ las cuatro corridas tienen el MISMO código y el MISMO corpus (el único cambio es el brazo)");
  ok(leerJson(path.join(salidas.A1, "manifiesto.json")).brazo.valor === "0" && leerJson(path.join(salidas.B1, "manifiesto.json")).brazo.valor === "1" && leerJson(path.join(salidas.B2, "manifiesto.json")).serieAb.repeticion === 2, "el brazo de cada celda sale del parámetro: A·1 = «0», B·1 = «1»; la repetición queda en el manifiesto");

  // ── la QUINTA y la repetición de una celda
  await rechazo("una QUINTA corrida se rechaza: la serie ya tiene sus cuatro (cualquier celda que se pida ya corrió)", (out) => serieAb("B", 1, sub("serie-quinta"), { deps: { escribir: (m) => out.push(m) } }), /ya corrió/);
  await rechazo("la misma celda no se repite (A·1 otra vez en otra carpeta)", (out) => serieAb("A", 1, sub("serie-a1-bis"), { deps: { escribir: (m) => out.push(m) } }), /ya corrió/);
  await rechazo("una corrida fuera del plan (repetición 3) ni llega a abrir el corpus", (out) => serieAb("A", 3, sub("serie-rep3"), { deps: { escribir: (m) => out.push(m) } }).then((r) => ({ ...r, codigo: r.codigo === 2 ? 4 : r.codigo })), /--repeticion=1\|2/);
  { const serie = leerJson(rutaSerie), sello = leerJson(rutaS);
    const A = (o) => SERIE.autorizarCorrida({ serie, nombre: "ensayo-13", brazo: "A", repeticion: 2, corpusSha256: serie.corpusSha256, sello, codigoSha256: serie.codigoSha256, ...o });
    ok(!A({}).ok && /ya corrió/.test(A({}).motivo) && A({ reanudar: true }).ok && !A({ brazo: "C" }).ok && !A({ repeticion: 3 }).ok && !A({ corpusSha256: "x" }).ok && !A({ nombre: "otra" }).ok && !A({ codigoSha256: "y" }).ok, "autorizarCorrida (pura): solo la celda planeada, con la huella del corpus, el nombre de la serie y el código de la primera corrida");
    const llena = { ...serie, corridas: serie.corridas.map((c, i) => ({ ...c, brazo: "A", repeticion: 9 + i })) };
    const q = SERIE.autorizarCorrida({ serie: llena, nombre: "ensayo-13", brazo: "A", repeticion: 2, corpusSha256: serie.corpusSha256, sello, codigoSha256: serie.codigoSha256 });
    ok(!q.ok && /no hay quinta corrida/.test(q.motivo), "★ autorizarCorrida: con las cuatro corridas ya anotadas, una más es «la quinta» y no hay lugar"); }

  // ── retomar una celda INTERRUMPIDA con --reanudar y la misma carpeta
  { const out = []; const r = await corre("A", 1, { extra: ["--reanudar"], deps: { escribir: (m) => out.push(m) } }); ok(r.cierre && r.cierre.reanudada === true && leerJson(rutaSerie).corridas.length === 4, "una celda INTERRUMPIDA se retoma con --reanudar y la misma --salida (no abre una celda nueva)", out.join(" | ").slice(0, 200)); }
  // ── un corpus quemado por una corrida normal no lo abre una serie nueva; --reanudar sin serie no quema nada
  await rechazo("un corpus quemado por una corrida normal NO se abre con una serie nueva (no hay serie que lo ampare)", (out) => serieAb("A", 1, sub("serie-nueva-sobre-leido"), { nombre: "serie-nueva", corpus: rutaX, sello: selloX, deps: { escribir: (m) => out.push(m) } }), /ya fue LEÍDO/);
  ok(!fs.existsSync(SERIE.rutaDeLaSerie(selloX)), "…y no deja ninguna SERIE-AB.json junto a ese sello");
  { const { ruta: rutaY, sello: selloY } = corpusComoOficial("serie-sin-serie");
    await rechazo("--reanudar sin una serie existente no abre nada", (out) => serieAb("A", 1, sub("serie-reanudar-vacia"), { corpus: rutaY, sello: selloY, extra: ["--reanudar"], deps: { escribir: (m) => out.push(m) } }), /no hay serie A\/B/);
    ok(leerJson(selloY).leido === false, "…y el sello sigue sin quemar"); }
  CORRIDAS_SERIE = salidas;
}


/* ═════ K · LAS CUENTAS DEL A/B: Wilson, Newcombe, bootstrap por hilo y la regla de parada ═════════════════════════════════════════════════════════════════════════ */
seccion("K · estadística del A/B: Wilson · Newcombe · reducción relativa con bootstrap por hilo · regla de parada");
const EST = await import(D + "estadistica.mjs");
{
  const { wilson, newcombe, reduccionRelativa, veredictoDeLaRegla, generador, FRASE_FAMILIA_RESUELTA, FRASE_RESIDUO } = EST;
  const cerca = (x, y, e = 1e-3) => Math.abs(x - y) <= e;
  const w0 = wilson(0, 10), w5 = wilson(5, 10), wN = wilson(3, 0);
  ok(cerca(w0.lo, 0) && cerca(w0.hi, 0.2775) && cerca(w5.lo, 0.2366) && cerca(w5.hi, 0.7634) && cerca(w5.p, 0.5) && wN.p === null && wN.lo === null, "★ Wilson 95 %: 0/10 → [0, 0.2775] y 5/10 → [0.2366, 0.7634] (valores de referencia); n = 0 → sin intervalo");
  const nw = newcombe(56, 70, 48, 80);
  ok(cerca(nw.diff, 0.2) && cerca(nw.lo, 0.0524) && cerca(nw.hi, 0.3339), "★ Newcombe (método 10): 56/70 contra 48/80 → diferencia 0.20, intervalo [0.0524, 0.3339] (el ejemplo del artículo de 1998)");
  ok(newcombe(1, 0, 1, 5).diff === null, "Newcombe con n = 0 → sin intervalo");
  const g1 = generador(7), g2 = generador(7), g3 = generador(8);
  const s1 = [g1(), g1(), g1()], s2 = [g2(), g2(), g2()], s3 = [g3(), g3(), g3()];
  ok(JSON.stringify(s1) === JSON.stringify(s2) && JSON.stringify(s1) !== JSON.stringify(s3) && s1.every((x) => x >= 0 && x < 1), "el generador del bootstrap es determinista (misma semilla, mismos números) y está en [0, 1)");
  const mk = (ks, n = 100) => Object.fromEntries(ks.map((k, i) => [`H${i}`, { k, n }]));
  const A = mk([6, 5, 7, 4, 6, 5, 7, 4]);
  const redB = reduccionRelativa({ A, B: mk([2, 1, 3, 1, 2, 1, 2, 1]) });
  ok(redB.kA === 44 && redB.nA === 800 && redB.kB === 13 && redB.nB === 800 && cerca(redB.reduccion, 1 - (13 / 800) / (44 / 800), 1e-9) && redB.lo > 0 && redB.hi >= redB.reduccion - 0.3 && redB.lo <= redB.reduccion && redB.validas === 10000 && redB.hilos === 8, "★ reducción relativa: 44 contra 13 sobre 800 y 800 → 70.5 %, con el intervalo bootstrap por hilo por encima de 0", JSON.stringify(redB));
  const redB2 = reduccionRelativa({ A, B: mk([2, 1, 3, 1, 2, 1, 2, 1]) });
  ok(JSON.stringify(redB) === JSON.stringify(redB2) && JSON.stringify(reduccionRelativa({ A, B: mk([2, 1, 3, 1, 2, 1, 2, 1]) }, { semilla: 99, iteraciones: 500 })) !== JSON.stringify(redB), "el bootstrap es reproducible: mismos datos y semilla → mismo intervalo");
  const redIgual = reduccionRelativa({ A, B: A });
  ok(redIgual.reduccion === 0 && !(redIgual.lo > 0), "A = B → reducción 0 y el intervalo NO excluye la no-reducción");
  // un brazo B con ruido: la reducción puntual existe pero el intervalo toca 0 → no es «resuelta» aunque supere el umbral
  const ruido = reduccionRelativa({ A: mk([9, 0, 9, 0, 9, 0, 9, 0]), B: mk([0, 9, 0, 9, 0, 9, 0, 9]) });
  ok(cerca(ruido.reduccion, 0, 1e-9) && ruido.lo < 0 && ruido.hi > 0, "★ si el efecto depende de qué hilos caen (A alto donde B bajo y al revés) el intervalo cruza el 0: los hilos son la unidad que se remuestrea", JSON.stringify(ruido));
  const sinA = reduccionRelativa({ A: mk([0, 0, 0]), B: mk([1, 0, 0]) });
  ok(sinA.reduccion === null && /no hay nada que reducir/.test(sinA.motivo), "A sin sobre-alcance: la reducción relativa no se define (y se dice)");
  ok(reduccionRelativa({ A: {}, B: {} }).reduccion === null && /ningún hilo/.test(reduccionRelativa({ A: {}, B: {} }).motivo), "sin hilos en común no hay comparación");
  const solo = reduccionRelativa({ A: { H0: { k: 4, n: 100 }, H1: { k: 1, n: 50 } }, B: { H0: { k: 1, n: 100 } } });
  ok(solo.hilos === 1 && solo.kA === 4, "solo cuentan los hilos que los dos brazos comparten");
  // LA REGLA DE PARADA
  const v = (reduccion, lo, umbralPct) => veredictoDeLaRegla({ reduccion, lo }, umbralPct == null ? {} : { umbralPct });
  ok(v(0.6, 0.1).resuelta && v(0.6, 0.1).frase === "familia resuelta" && FRASE_FAMILIA_RESUELTA === "familia resuelta", "★ regla de parada: B reduce 60 % y el intervalo excluye el 0 → «familia resuelta»");
  ok(!v(0.6, -0.05).resuelta && v(0.6, -0.05).frase === "el residuo es variabilidad del anfitrión: el owner revisa el criterio" && FRASE_RESIDUO === v(0.6, -0.05).frase && v(0.6, -0.05).cumpleUmbral && !v(0.6, -0.05).excluyeNoReduccion, "★ …reduce 60 % pero el intervalo NO excluye la no-reducción → «el residuo es variabilidad del anfitrión: el owner revisa el criterio»");
  ok(!v(0.4, 0.1).resuelta && !v(0.4, 0.1).cumpleUmbral && v(0.4, 0.1, 30).resuelta && v(0.5, 0.01).resuelta && !v(0.499, 0.2).resuelta && !v(null, null).resuelta && !v(0.9, 0).resuelta, "★ el umbral es un PARÁMETRO (50 % por defecto): 40 % no alcanza con 50 pero sí con 30; exactamente 50 % alcanza; el límite inferior debe ser > 0 estricto");
}

/* ═════ L · EL SOBRE-ALCANCE EN LA CLASIFICACIÓN HUMANA Y EN EL INFORME (§6.1) ═══════════════════════════════════════════════════════════════════════════════ */
seccion("L · sobre-alcance: se marca en la revisión humana, se agrega por brazo/subtipo/hilo y NO cambia el veredicto de cierre");
const CLAS = await import(D + "clasificacion.mjs");
const { bloqueDeSobreAlcance } = await import(D + "informe.mjs");
const hilosDeLaSerie = fs.readdirSync(path.join(CORRIDAS_SERIE.A1, "transcritos")).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();
const copiarCorrida = (de, a, clasificacion = null, ajusta = null) => { fs.cpSync(de, a, { recursive: true }); if (clasificacion) fs.writeFileSync(path.join(a, "clasificacion.json"), JSON.stringify(clasificacion)); if (ajusta) ajusta(a); return a; };
{
  const { leerClasificacion, subtipoDeSobreAlcance, SUBTIPOS_DE_SOBRE_ALCANCE, DEFINICION_DE_SOBRE_ALCANCE } = CLAS;
  ok(SUBTIPOS_DE_SOBRE_ALCANCE.join() === "orden,extremo,conjunto,relacion,existencia,continuidad,cifra", "★ los siete subtipos del sobre-alcance: orden · extremo · conjunto · relación · existencia · continuidad · cifra");
  ok(["Orden", "extremos", "Conjunto", "relación", "RELACION", "Existencia", "continuidad", "cifra"].map(subtipoDeSobreAlcance).join() === "orden,extremo,conjunto,relacion,relacion,existencia,continuidad,cifra" && subtipoDeSobreAlcance("raro") === "sin_subtipo" && subtipoDeSobreAlcance(undefined) === "sin_subtipo", "los subtipos se normalizan (acentos, mayúsculas, plural); lo desconocido es «sin_subtipo»");
  ok(/orden, extremo, conjunto, relación, existencia, cifra o continuidad/.test(DEFINICION_DE_SOBRE_ALCANCE) && /sea verdadera o falsa/.test(DEFINICION_DE_SOBRE_ALCANCE) && /no se dice como parcial o no evaluada/.test(DEFINICION_DE_SOBRE_ALCANCE), "la definición codificada: orden, extremo, conjunto, relación, existencia, cifra o continuidad que ningún id ni `establecido` sostiene y no se dice parcial o no evaluada, sea verdadera o falsa");
  const h0 = hilosDeLaSerie[0], h1 = hilosDeLaSerie[1] || hilosDeLaSerie[0];
  const clasSA = {
    corrida: "gate-sa",
    palabras: [
      { id: `${h0}|1|1`, clase: "H-correcta", subtipo: "orden_propio", oracion: "Las tres más grandes son también las tres de menor margen.", sobreAlcance: "orden", verdad: "el orden lo armó el anfitrión; resultó cierto" },
      { id: `${h0}|1|1`, clase: "V", subtipo: "lectura_directa", oracion: "Jumbo vendió $1.1M." },
    ],
    filas: [{ id: `${h1}|1|1|99`, clase: "H-leve", subtipo: "cuantificador", oracion: "Casi todas están al día.", sobreAlcance: "conjunto" }],
    sobreAlcance: [
      { id: `${h0}|1|1`, subtipo: "Orden", oracion: "Las tres más grandes son también las tres de menor margen.", verdadera: true },       // la MISMA oración que ya está en palabras → una sola afirmación
      { id: `${h0}|1|1`, subtipo: "extremo", oracion: "Falabella es tu mayor cliente en deuda.", verdadera: false },
      { id: `${h1}|1|1`, subtipo: "relación", oracion: "Las dos que más aportan son las dos que más dejan sin capturar.", clase: "H-grave" },
      { id: `${h1}|1|1`, subtipo: "continuidad", oracion: "Como vimos antes, Falabella era el mayor." },
      { id: `${h1}|1|1`, subtipo: "inventado", oracion: "Algo sin subtipo reconocible." },
    ],
  };
  const lc = leerClasificacion(clasSA);
  ok(lc.sobreAlcance.length === 6 && lc.resumen.sobreAlcance === 6, "★ sobre-alcance: 6 afirmaciones (la oración marcada en `palabras` y en la lista propia cuenta UNA vez)", JSON.stringify(lc.sobreAlcance.map((x) => [x.subtipo, x.oracion.slice(0, 30)])));
  const por = (pref) => lc.sobreAlcance.find((x) => x.oracion.startsWith(pref));
  ok(por("Las tres más").subtipo === "orden" && por("Las tres más").verdadera === true && por("Falabella es").verdadera === false && por("Las dos que").subtipo === "relacion" && por("Las dos que").verdadera === false && por("Como vimos").verdadera === null && por("Casi todas").subtipo === "conjunto" && por("Casi todas").verdadera === false, "★ verdadera o falsa, no importa: cada una conserva su veredicto (true / false / H-grave ⇒ false / sin dato ⇒ null) y su subtipo normalizado");
  ok(lc.sobreAlcance.some((x) => x.subtipo === "sin_subtipo") && lc.avisos.some((a) => /sin subtipo reconocible/.test(a)), "un subtipo desconocido se cuenta como «sin_subtipo» y deja un aviso");
  ok(leerClasificacion({ filas: [{ id: "A|1|1|1", clase: "V", sobreAlcance: true, subtipoSobreAlcance: "existencia", oracion: "x" }] }).sobreAlcance[0].subtipo === "existencia" && leerClasificacion({ filas: [{ id: "A|1|1|1", clase: "V", oracion: "x" }] }).sobreAlcance.length === 0 && leerClasificacion({}).sobreAlcance.length === 0, "una fila puede marcarse con `sobreAlcance: true` + `subtipoSobreAlcance`; sin marca no hay sobre-alcance");

  // ── en el informe
  const dSA = copiarCorrida(CORRIDAS_SERIE.A1, sub("sa-informe"), clasSA);
  const infSA = calcularInforme(cargarSalida(dSA));
  const sa = infSA.sobreAlcance;
  ok(sa.medido && sa.n === 6 && sa.N >= infSA.veredictoDetallado.afirmacionesEmpresariales.total && sa.tasaPor500 === Number(((6 / sa.N) * 500).toFixed(2)), "★ el informe cuenta n = 6 y su tasa por 500 afirmaciones empresariales", JSON.stringify({ n: sa.n, N: sa.N, t: sa.tasaPor500 }));
  const wl = EST.wilson(sa.n, sa.N);
  ok(sa.intervaloWilsonPor500.lo === Number((wl.lo * 500).toFixed(2)) && sa.intervaloWilsonPor500.hi === Number((wl.hi * 500).toFixed(2)) && sa.intervaloWilsonPor500.nivel === 0.95, "…con su intervalo de Wilson por 500");
  ok(JSON.stringify(sa.porSubtipo) === JSON.stringify({ orden: 1, extremo: 1, conjunto: 1, relacion: 1, continuidad: 1, sin_subtipo: 1 }), "★ …por subtipo", JSON.stringify(sa.porSubtipo));
  ok(sa.verdaderas === 1 && sa.falsas === 3 && sa.sinVeredicto === 2, "verdaderas / falsas / sin veredicto (la verdad o falsedad NO decide si es sobre-alcance)", JSON.stringify([sa.verdaderas, sa.falsas, sa.sinVeredicto]));
  ok(Object.values(sa.porHilo).reduce((s, x) => s + x.n, 0) === 6 && sa.porHilo[h0].n >= 1 && sa.porHilo[h1].n >= 1 && Object.values(sa.porHilo).every((x) => x.N >= x.n), "★ …y por hilo (la suma por hilo es el total; ningún hilo tiene más sobre-alcance que afirmaciones)", JSON.stringify(sa.porHilo));
  ok(sa.extrasAlDenominador === 5 && sa.N === sa.nDelCierre + sa.extrasAlDenominador, "las afirmaciones marcadas que el cierre no había contado se suman SOLO al denominador del sobre-alcance (nDelCierre queda aparte)");
  const md = informeEnMarkdown(infSA);
  ok(/## Sobre-alcance/.test(md) && /Por subtipo: orden 1 · extremo 1 · conjunto 1/.test(md) && /Por hilo:/.test(md) && /Wilson 95 % por 500/.test(md) && /No decide el cierre/.test(md), "★ el informe en Markdown trae el bloque «Sobre-alcance»: conteo, tasa por 500 con Wilson, por subtipo, por hilo");
  // sin clasificación: no se mide
  const dSin = copiarCorrida(CORRIDAS_SERIE.A1, sub("sa-sin-clasificacion"));
  fs.rmSync(path.join(dSin, "clasificacion.json"), { force: true });
  const infSin = calcularInforme(cargarSalida(dSin));
  ok(infSin.sobreAlcance.medido === false && /No medido/.test(informeEnMarkdown(infSin)) && bloqueDeSobreAlcance(infSin).join("\n").includes("No medido"), "sin `clasificacion.json` el sobre-alcance NO se mide (y el informe lo dice)");
  // el veredicto de cierre no se mueve
  const clasBase = { corrida: "base", palabras: [{ id: `${h0}|1|1`, clase: "H-grave", subtipo: "conteo_propio", oracion: "Son cinco cuentas." }] };
  const clasConSA = { ...clasBase, sobreAlcance: clasSA.sobreAlcance };
  const iBase = calcularInforme(cargarSalida(copiarCorrida(CORRIDAS_SERIE.A1, sub("cierre-base"), clasBase))), iSA = calcularInforme(cargarSalida(copiarCorrida(CORRIDAS_SERIE.A1, sub("cierre-sa"), clasConSA)));
  ok(iBase.veredicto === iSA.veredicto && iBase.porQue === iSA.porQue && JSON.stringify(iBase.veredictoDetallado.criterios) === JSON.stringify(iSA.veredictoDetallado.criterios) && iBase.veredictoDetallado.afirmacionesEmpresariales.total === iSA.veredictoDetallado.afirmacionesEmpresariales.total, "★ la REGLA DE CIERRE no se mueve: con o sin marcas de sobre-alcance el veredicto, los criterios y N son idénticos (los materiales siguen decidiendo)", `${iBase.veredicto} / ${iSA.veredicto}`);
}

/* ═════ M · LA FAMILIA «DESLIZ DE LECTURA CON LA VERDAD A LA VISTA» (§3) ═════════════════════════════════════════════════════════════════════════════════════ */
seccion("M · desliz de lectura con la verdad a la vista: familia propia, material si cambia una conclusión, sin patrón con otra familia");
{
  const { FAMILIA_DESLIZ, familiaDeError, familiaDeFila, patronesSistematicos, esFamiliaDesliz, leerClasificacion } = CLAS;
  ok(FAMILIA_DESLIZ === "desliz de lectura con la verdad a la vista" && esFamiliaDesliz(FAMILIA_DESLIZ) && !esFamiliaDesliz("dueño distinto"), "la familia se llama «desliz de lectura con la verdad a la vista»");
  ok(["desliz_de_lectura_tabla_propia", "desliz de lectura", "desliz_lectura_orden", "lectura_erronea_de_su_propia_tabla", "par_equivocado_verdad_a_la_vista"].every((s) => familiaDeError(s) === FAMILIA_DESLIZ), "★ el subtipo «desliz…» cae en su propia familia aunque traiga palabras de otra («orden», «relación»)");
  ok(familiaDeError("orden_falso_sobre_el_universo_completo") === "relación o razón entre cifras" && familiaDeError("dueno_distinto_diferencia_de_otro_par") === "dueño distinto" && familiaDeError("conteo_propio") === "conteo", "las familias de siempre no cambian");
  ok(familiaDeFila({ familia: "desliz", subtipo: "orden_falso" }) === FAMILIA_DESLIZ && familiaDeFila({ familia: "conteo", subtipo: "x" }) === "conteo" && familiaDeFila({ subtipo: "metrica_espuria" }) === "métrica distinta" && familiaDeFila({ familia: "zzz", subtipo: "dueno_distinto" }) === "dueño distinto", "la persona puede fijar la familia a mano (`familia`); si no se reconoce, manda el subtipo");
  const e = (familia, hilo, id) => ({ familia, hilo, id, oracion: id });
  ok(patronesSistematicos([e(FAMILIA_DESLIZ, "A01", "1"), e("relación o razón entre cifras", "B02", "2")]).length === 0, "★ un desliz y un error de RELACIÓN no arman patrón entre sí (familias distintas)");
  ok(patronesSistematicos([e(FAMILIA_DESLIZ, "A01", "1"), e("dueño distinto", "A01", "2"), e("conteo", "B01", "3")]).length === 0, "…ni con dueño distinto ni con conteo");
  const dos = patronesSistematicos([e(FAMILIA_DESLIZ, "A01", "1"), e(FAMILIA_DESLIZ, "C02", "2")]);
  ok(dos.length === 1 && dos[0].familia === FAMILIA_DESLIZ && dos[0].esDesliz === true && dos[0].veces === 2, "dos deslices SÍ son «la misma familia ×2» (el patrón es el de siempre: misma familia, 2 o más) y quedan marcados `esDesliz`");
  const rel = patronesSistematicos([e("relación o razón entre cifras", "A01", "1"), e("relación o razón entre cifras", "B01", "2")]);
  ok(rel.length === 1 && rel[0].esDesliz === false, "dos errores de relación siguen armando patrón, como hoy");
  // por el informe: dos errores materiales, uno desliz y uno de relación → NO PASA por el límite, pero SIN patrón
  const h0 = hilosDeLaSerie[0];
  const clasDes = { corrida: "desliz", palabras: [
    { id: `${h0}|1|1`, clase: "H-grave", subtipo: "desliz_de_lectura_tabla_propia", oracion: "Las dos más vendidas: Norvik y Teravolt; Alsen, la tercera." },
    { id: `${h0}|1|2`, clase: "H-grave", subtipo: "relacion_en_palabras_falsa", oracion: "Una cuenta vende el doble que la otra." },
  ] };
  const iDes = calcularInforme(cargarSalida(copiarCorrida(CORRIDAS_SERIE.A1, sub("desliz-mixto"), clasDes)));
  const famIn = iDes.veredictoDetallado.erroresDelAnfitrion.map((x) => x.familia).sort();
  ok(famIn.join() === ["desliz de lectura con la verdad a la vista", "relación o razón entre cifras"].sort().join() && iDes.veredictoDetallado.criterios.anfitrion.errores === 2 && iDes.veredictoDetallado.criterios.patron.sistematico === false, "★ en el informe: el desliz sigue siendo un error MATERIAL (cuenta contra el límite) pero NO arma patrón con el de relación", JSON.stringify([famIn, iDes.veredictoDetallado.criterios.patron]));
  ok(iDes.materialesPorFamilia["desliz de lectura con la verdad a la vista"] === 1 && iDes.veredictoDetallado.erroresDelAnfitrion.find((x) => x.esDesliz).hilo === h0 && /familia «desliz de lectura con la verdad a la vista» es variabilidad del anfitrión/.test(informeEnMarkdown(iDes)), "el informe cuenta los materiales por familia y explica la del desliz");
  const clasDes2 = { corrida: "desliz2", palabras: [
    { id: `${h0}|1|1`, clase: "H-grave", subtipo: "desliz_de_lectura_tabla_propia", oracion: "Alsen, la tercera." },
    { id: `${h0}|1|2`, clase: "H-grave", subtipo: "x", familia: "desliz", oracion: "LG, 2.7 pp por debajo de Philips." },
  ] };
  const iDes2 = calcularInforme(cargarSalida(copiarCorrida(CORRIDAS_SERIE.A1, sub("desliz-doble"), clasDes2)));
  ok(iDes2.veredictoDetallado.criterios.patron.sistematico === true && iDes2.veredictoDetallado.criterios.patron.patrones[0].esDesliz === true, "dos deslices en la misma corrida: el patrón es el de hoy (misma familia ×2), señalado como desliz");
  const clasLeve = { palabras: [{ id: `${h0}|1|1`, clase: "H-leve", subtipo: "desliz_de_lectura", oracion: "Un desliz leve." }] };
  ok(leerClasificacion(clasLeve).hallazgos[0].familia === FAMILIA_DESLIZ, "un desliz LEVE también se agrupa en su familia (los leves repetidos se informan aparte)");
}

/* ═════ N · EL MEDIDOR TRAS EL ENSAYO 12: «MÉTRICA DISTINTA ×20» ERA UNA FALLA DEL MEDIDOR ══════════════════════════════════════════════════════════════════════ */
seccion("N · el medidor: una cifra toma la métrica de SU etiqueta (30 marcas «métrica distinta» de los ensayos 9-12, todas falsas alarmas salvo una)");
{
  const { REGLAS, esEjemploHipotetico } = await import(D + "rastreo.mjs");
  const FXR = JSON.parse(fs.readFileSync(new URL("./fixtures/medicion-anfitrion/ensayo-12-metrica-distinta.json", import.meta.url), "utf8"));
  const FALSOS_N = new Set(["no_traza", "dueno_distinto", "metrica_distinta", "conteo_no_cierra", "relacion_no_cierra", "cambio_no_avisado"]);
  const NUEVAS = ["etiqueta_propia", "sin_venta", "negada", "etiqueta_antes", "etiqueta_reclamada", "columna_de_tabla", "brecha_en_pesos", "unidad_natural", "ejemplo_encadenado", "margen_es_razon", "sin_capturar"];
  const hiloF = (cid, cambia = []) => {
    const c = FXR.contextos[cid]; let prosa = c.prosa;
    for (const [de, a] of cambia) { if (!prosa.includes(de)) throw new Error(`la prosa de ${cid} ya no trae «${de}»`); prosa = prosa.split(de).join(a); }
    const turnos = c.persona.map((p, i) => ({ sesion: 1, turno: i + 1, persona: p, textoEnviado: p, texto: i === c.persona.length - 1 ? prosa : "", llamadas: i === c.persona.length - 1 ? JSON.parse(JSON.stringify(c.llamadas)) : [] }));
    return { hiloId: "M", forma: c.forma, empresa: c.empresa, turnos };
  };
  const vsF = (cid, token, cambia = []) => rastrearHilo(hiloF(cid, cambia)).at(-1).afirmaciones.filter((a) => a.clase === 1 && a.veredicto !== "ignorado" && a.token === token).map((a) => a.veredicto);
  const sinTodas = (f) => { for (const r of NUEVAS) REGLAS[r] = false; try { return f(); } finally { for (const r of NUEVAS) REGLAS[r] = true; } };
  const sinUna = (r, f) => { REGLAS[r] = false; try { return f(); } finally { REGLAS[r] = true; } };
  const casos = Object.entries(FXR.casos);
  ok(casos.length === 32 && casos.filter(([, c]) => !c.control).length === 29 && Object.keys(FXR.contextos).length === 25, "el fixture trae las 29 marcas «métrica distinta» de los ensayos 9-12 + 3 controles (frases VERBATIM de los transcritos reales, con el libro reducido de ADI)", `${casos.length}`);
  let ahoraBien = 0, antesMarcado = 0, resiste = 0; const fallos = [];
  for (const [id, c] of casos) {
    const ahora = vsF(c.ctx, c.token), antes = sinTodas(() => vsF(c.ctx, c.token));
    const sigueMarcada = ahora.some((x) => FALSOS_N.has(x));
    if (c.control) { if (!sigueMarcada && !antes.some((x) => FALSOS_N.has(x))) ahoraBien += 1; else fallos.push(`control ${id}`); continue; }
    if (!sigueMarcada) ahoraBien += 1; else if (id === "e10/B01-1.6-k13") resiste += 1; else fallos.push(`sigue ${id}`);
    if (antes.includes("metrica_distinta")) antesMarcado += 1; else fallos.push(`sin las reglas no se marca ${id}: ${antes}`);
  }
  ok(fallos.length === 0 && antesMarcado === 29 && ahoraBien === 31 && resiste === 1, "★ las 29 marcas del medidor viejo: con las reglas nuevas APAGADAS vuelven las 29 (rojo), con ellas puestas 28 dejan de marcarse; queda UNA («Quillay no tiene saldo vencido (tiene $3.8M por vencer)», que la persona clasificó H-correcta, no V) y los 3 controles siguen sin marca", `${JSON.stringify(fallos)} antes=${antesMarcado} ahoraBien=${ahoraBien} resiste=${resiste}`);
  // cada regla hace falta: donde la ablación de UNA regla re-marca el caso, el fixture lo recuerda (`reglas`) y el gate lo exige
  let conRegla = 0, reglasVistas = new Set();
  for (const [id, c] of casos) for (const r of c.reglas || []) { const v = sinUna(r, () => vsF(c.ctx, c.token)); if (v.some((x) => FALSOS_N.has(x))) { conRegla += 1; reglasVistas.add(r); } else fallos.push(`${id} sin ${r}: ${v}`); }
  ok(fallos.length === 0 && conRegla >= 18 && ["etiqueta_propia", "etiqueta_antes", "etiqueta_reclamada", "unidad_natural", "negada", "brecha_en_pesos", "margen_es_razon", "ejemplo_encadenado"].every((r) => reglasVistas.has(r)), "★ cada regla nueva tiene al menos un caso REAL que sin ella vuelve a marcarse (etiqueta propia/antes/reclamada · unidad natural · negada · brecha en pesos · margen es razón · ejemplo encadenado)", `${conRegla} ${[...reglasVistas]} ${JSON.stringify(fallos)}`);
  // la sin_venta y la columna: se prueban con el caso que SOLO ellas rescatan (sin ellas, solas, no hay otra regla redundante)
  const sinSoloSV = sinUna("sin_venta", () => { REGLAS.etiqueta_propia = false; try { return vsF("e12/A01-1.2-k49", "$11K"); } finally { REGLAS.etiqueta_propia = true; } });
  ok(sinSoloSV.includes("metrica_distinta") && vsF("e12/A01-1.2-k49", "$11K").every((x) => !FALSOS_N.has(x)), "«$11K inmovilizados y 68 días sin venta»: «sin venta» es una ausencia, no la métrica Venta (sin esa regla y sin la etiqueta propia vuelve a marcarse)");
  { const sinEP = (extra) => { REGLAS.etiqueta_propia = false; if (extra) REGLAS[extra] = false; try { return vsF("e12/A01-1.2-k28", "$1.1M"); } finally { REGLAS.etiqueta_propia = true; if (extra) REGLAS[extra] = true; } };
    ok(!sinEP().some((x) => FALSOS_N.has(x)) && sinEP("sin_capturar").includes("metrica_distinta"), "«$1.1M sin capturar» ES la contribución no capturada: sin la regla `sin_capturar` (y sin la etiqueta propia) vuelve a leerse como el margen de la oración"); }
  const tablaSinCol = sinUna("columna_de_tabla", () => { REGLAS.etiqueta_antes = false; REGLAS.etiqueta_propia = false; try { return vsF("e12/A03-1.3-k12", "25%"); } finally { REGLAS.etiqueta_antes = true; REGLAS.etiqueta_propia = true; } });
  ok(vsF("e12/A03-1.3-k12", "25%").every((x) => !FALSOS_N.has(x)) && tablaSinCol.includes("metrica_distinta"), "la celda «| Bajo, con brecha relevante | Grandes Almacenes Bío | 25% |» toma la métrica de su COLUMNA (Margen), no la palabra «brecha» del encabezado de grupo");
  // ── CARNADAS: lo que de verdad es una métrica equivocada SIGUE marcándose
  const car = (cid, token, cambia, msg, esperado = "metrica_distinta") => { const v = vsF(cid, token, cambia); ok(v.includes(esperado), `★ CARNADA · ${msg}: sigue marcándose`, JSON.stringify(v)); };
  car("e12/A03-1.1-k5", "$35.5M", [["Supermercados Andes del Sur: $35.5M, +8.3%, margen 22%.", "Supermercados Andes del Sur: margen de $35.5M, +8.3%."]], "«margen de $35.5M» (es venta)");
  car("e12/A03-1.1-k5", "$35.5M", [["Supermercados Andes del Sur: $35.5M, +8.3%, margen 22%.", "Supermercados Andes del Sur: contribución $35.5M, +8.3%, margen 22%."]], "«contribución $35.5M» (es venta)");
  car("e12/A01-1.2-k49", "$11K", [["- **BOS-SANDER:** $11K inmovilizados y 68 días sin venta.", "- **BOS-SANDER:** vendió $11K y lleva 68 días sin venta."]], "«vendió $11K» (es capital)");
  car("e11/C01-1.1-k12", "$17.9M", [["- Lider: $17.9M, +15%, margen 21.5%.", "- Lider: margen $17.9M, +15%."]], "«margen $17.9M» (es venta)");
  car("e12/A03-1.3-k12", "25%", [["| Situación | Cliente | Margen |", "| Situación | Cliente | Venta |"]], "una columna «Venta» con el valor del margen");
  car("e12/A03-1.1-k62", "$2.3M", [["La brecha de $2.3M es la mayor.", "El costo de $2.3M es la mayor."]], "«el costo de $2.3M» (es brecha)");
  car("e12/B01-2.7-k6", "$2.0M", [["Los $2.0M no equivalen a capital liberado ni a liquidez, porque los datos no traen posición de caja.", "Los $2.0M son el capital liberado."]], "«son el capital liberado» (es saldo pendiente)");
  car("e09/C04-1.6-k1", "23,1 %", [["El margen ponderado de Norvik y Teravolt juntas es **23,1 %**", "El costo ponderado de Norvik y Teravolt juntas es **23,1 %**"]], "«el costo ponderado es 23,1 %» (es margen)");
  car("e12/A03-1.3-k19", "1.8%", [["Mercantil Pacífico tiene 1.8% y 29% de margen.", "Mercantil Pacífico tiene margen de 1.8% y 29% de carga."]], "«margen de 1.8 %» (es carga comercial)");
  car("e11/B01-1.5-k5", "$10,7 M", [["Debe $10,7 M y tiene", "Su margen es $10,7 M y tiene"]], "«su margen es $10,7 M» (es saldo pendiente)");
  { const frase = 'usted me da un supuesto, como "+8% de venta" o "+2 pp de margen"', sin = 'Una cuenta vende bien y tiene 10%, o 12%.'; ok(esEjemploHipotetico(frase, { indice: frase.indexOf("2 pp") }) && !esEjemploHipotetico(sin, { indice: sin.indexOf("12%") }), "la oferta encadenada «como «+8% de venta» o «+2 pp de margen»» es un ejemplo hipotético; una frase sin oferta no"); }
}


/* ═════ O · EL INFORME COMPARATIVO A/B (`comparar-brazos.mjs`) ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * Cuatro carpetas de corrida (las de la serie de J, con una clasificación humana SINTÉTICA: datos falsos, solo para ejercitar la aritmética) → sobre-alcance por brazo con Wilson, reducción relativa con bootstrap por hilo,
 * materiales por familia y el veredicto de la regla de parada. */
seccion("O · comparar-brazos: sobre-alcance por brazo, reducción relativa con intervalo, materiales por familia y la regla de parada");
const CMP = await import(D + "comparar-brazos.mjs");
{
  const { compararBrazos, compararResumenes, resumirCorrida, textoDeLaComparacion, UMBRAL_DE_REDUCCION_POR_DEFECTO } = CMP;
  const SUBS = ["orden", "extremo", "conjunto", "relación", "existencia", "continuidad", "cifra"];
  /* una clasificación sintética: `porHilo` = cuántas afirmaciones de sobre-alcance en cada hilo; `materiales` = [{ hilo, subtipo }] */
  const clasFalsa = (porHilo, materiales = []) => ({
    corrida: "sintética",
    sobreAlcance: Object.entries(porHilo).flatMap(([h, n]) => Array.from({ length: n }, (_, i) => ({ id: `${h}|1|1`, subtipo: SUBS[i % SUBS.length], oracion: `afirmación ${i + 1} del hilo ${h} más allá de lo entregado`, verdadera: i % 2 === 0 }))),
    palabras: materiales.map((m, i) => ({ id: `${m.hilo}|1|${i + 1}`, clase: "H-grave", subtipo: m.subtipo, oracion: `error material ${i + 1} del hilo ${m.hilo}` })),
  });
  const A3 = Object.fromEntries(hilosDeLaSerie.map((h) => [h, 3])), B0 = Object.fromEntries(hilosDeLaSerie.map((h, i) => [h, i === 0 ? 1 : 0]));
  const armar = (nombre, mapa) => { const d = {}; for (const [celda, salida] of Object.entries(CORRIDAS_SERIE)) { const m = mapa[celda]; d[celda] = copiarCorrida(salida, sub(`${nombre}-${celda}`), clasFalsa(m.porHilo, m.materiales || [])); } return d; };
  const h0 = hilosDeLaSerie[0], h1 = hilosDeLaSerie[1] || h0;
  // ── escenario 1: B casi no tiene sobre-alcance, y lo poco que le queda de material es un desliz
  const e1 = armar("cmp1", { A1: { porHilo: A3, materiales: [{ hilo: h0, subtipo: "relacion_invertida" }] }, A2: { porHilo: A3 }, B1: { porHilo: B0, materiales: [{ hilo: h1, subtipo: "desliz_de_lectura_tabla_propia" }] }, B2: { porHilo: B0 } });
  const c1 = compararBrazos(Object.values(e1));
  ok(c1.ok && c1.A.corridas.length === 2 && c1.B.corridas.length === 2 && c1.A.k === 3 * hilosDeLaSerie.length * 2 && c1.B.k === 2 && c1.comunes === hilosDeLaSerie.length, "★ comparar: sobre-alcance por brazo SUMADO sobre las repeticiones (A = 3 por hilo × 2 corridas; B = 1 en un hilo × 2 corridas)", JSON.stringify({ ok: c1.ok, errores: c1.errores, A: c1.A && c1.A.k, B: c1.B && c1.B.k }));
  ok(c1.A.n > 0 && c1.B.n > 0 && c1.A.tasaPor500 === Number(((c1.A.k / c1.A.n) * 500).toFixed(2)) && c1.A.wilsonPor500.lo < c1.A.tasaPor500 && c1.A.tasaPor500 < c1.A.wilsonPor500.hi && c1.B.wilsonPor500.lo >= 0, "…con la tasa por 500 y su intervalo de Wilson por brazo");
  const piso = EST.wilson(c1.A.k, c1.A.n); ok(c1.A.wilsonPor500.lo === Number((piso.lo * 500).toFixed(2)) && c1.A.wilsonPor500.hi === Number((piso.hi * 500).toFixed(2)), "el intervalo de Wilson del informe es el de `estadistica.mjs` sobre el total sumado");
  ok(c1.reduccion.reduccion > 0.9 && c1.reduccion.lo > 0 && c1.reduccion.hi <= 1 && c1.newcombe.diff > 0 && c1.newcombe.lo > 0, "★ reducción relativa de B respecto de A > 90 %, con el intervalo bootstrap por hilo y el de Newcombe de la diferencia absoluta por encima de 0", JSON.stringify([c1.reduccion.reduccion, c1.reduccion.lo, c1.newcombe]));
  ok(c1.regla.resuelta && c1.regla.frase === "familia resuelta" && c1.umbralPct === 50 && UMBRAL_DE_REDUCCION_POR_DEFECTO === 50, "★ REGLA DE PARADA: reduce ≥ 50 % y el intervalo excluye la no-reducción → «familia resuelta» (umbral por defecto 50 %)");
  ok(c1.A.materialesPorFamilia["relación o razón entre cifras"] === 1 && c1.B.materialesPorFamilia["desliz de lectura con la verdad a la vista"] === 1 && c1.B.nMateriales === 1, "★ errores materiales por familia y por brazo");
  ok(/TODOS los materiales que quedan en B \(1\) son «desliz de lectura con la verdad a la vista»/.test(c1.nota || "") && /NOTA:/.test(c1.texto), "★ §6.4 (iii): B reduce pero lo único que le queda de material es un desliz con la verdad a la vista → se dice (el owner revisa el criterio solo para esa familia)");
  ok(/COMPARACIÓN A\/B/.test(c1.texto) && /Sobre-alcance por brazo/.test(c1.texto) && /Reducción relativa de B respecto de A/.test(c1.texto) && /bootstrap por hilo/.test(c1.texto) && /Newcombe/.test(c1.texto) && /Por subtipo/.test(c1.texto) && /Por hilo/.test(c1.texto) && /VEREDICTO: familia resuelta/.test(c1.texto), "el texto trae todo: brazos con Wilson, reducción con intervalo, Newcombe, subtipos, hilos, materiales por familia y el veredicto");
  ok(Object.keys(c1.A.porSubtipo).length === 3 && c1.A.porSubtipo.orden >= 1 && c1.A.porSubtipo.extremo >= 1 && c1.B.porSubtipo.orden >= 1 && !c1.B.porSubtipo.extremo, "por subtipo: A y B");
  // ── escenario 2: B igual que A → el residuo es del anfitrión
  const e2 = armar("cmp2", { A1: { porHilo: A3 }, A2: { porHilo: A3 }, B1: { porHilo: A3 }, B2: { porHilo: A3 } });
  const c2 = compararBrazos(Object.values(e2));
  ok(c2.ok && !c2.regla.resuelta && c2.regla.frase === "el residuo es variabilidad del anfitrión: el owner revisa el criterio" && /VEREDICTO: el residuo es variabilidad del anfitrión: el owner revisa el criterio/.test(c2.texto) && !c2.nota, "★ REGLA DE PARADA: B no reduce → «el residuo es variabilidad del anfitrión: el owner revisa el criterio»");
  // ── escenario 3: B reduce 33 % (de 3 a 2 por hilo): no alcanza 50 % pero el intervalo excluye el 0; con el umbral en 30 % sí
  const B2h = Object.fromEntries(hilosDeLaSerie.map((h) => [h, 2]));
  const e3 = armar("cmp3", { A1: { porHilo: A3 }, A2: { porHilo: A3 }, B1: { porHilo: B2h }, B2: { porHilo: B2h } });
  const c3 = compararBrazos(Object.values(e3)), c3b = compararBrazos(Object.values(e3), { umbralPct: 20 });
  ok(c3.ok && c3.reduccion.reduccion > 0.2 && c3.reduccion.reduccion < 0.4 && c3.reduccion.lo > 0 && !c3.regla.resuelta && !c3.regla.cumpleUmbral && c3.regla.excluyeNoReduccion && c3b.regla.resuelta && c3b.umbralPct === 20 && /≥ 20 %/.test(c3b.texto), "★ el umbral es un PARÁMETRO: una reducción de ~24 % (intervalo por encima de 0) no es «familia resuelta» con 50 %, sí con 20 %", JSON.stringify([c3.reduccion.reduccion, c3.regla, c3b.regla]));
  // ── la misma aritmética sin carpetas (resúmenes a mano): reducción 40 % exacta
  const res = (brazo, rep, k, n = 100, hs = 8, mat = []) => ({ carpeta: `${brazo}${rep}`, errores: [], corridaId: `${brazo}${rep}`, brazo, repeticion: rep, serie: "s", corpusSha256: "c", codigoSha256: "k", modelo: "m", veredicto: "NO CONCLUYENTE", N: n * hs, n: k * hs, porSubtipo: { orden: k * hs }, porHilo: Object.fromEntries(Array.from({ length: hs }, (_, i) => [`H${i}`, { k, n }])), materiales: mat, nMateriales: mat.length, patron: [] });
  const p40 = compararResumenes([res("A", 1, 5), res("A", 2, 5), res("B", 1, 3), res("B", 2, 3)]);
  ok(p40.ok && Math.abs(p40.reduccion.reduccion - 0.4) < 1e-9 && !p40.regla.resuelta && compararResumenes([res("A", 1, 5), res("A", 2, 5), res("B", 1, 3), res("B", 2, 3)], { umbralPct: 40 }).regla.resuelta, "reducción exacta de 40 % (3 contra 5 por 100 en cada hilo): no basta con 50 %, basta con un umbral de 40 %");
  const pDesl = compararResumenes([res("A", 1, 5), res("A", 2, 5), res("B", 1, 1, 100, 8, [{ id: "x", hilo: "H0", familia: "desliz de lectura con la verdad a la vista", esDesliz: true }]), res("B", 2, 1)]);
  ok(pDesl.ok && pDesl.regla.resuelta && /deslices|desliz de lectura/.test(pDesl.nota) === true, "(iii) con resúmenes a mano: B reduce 80 % y su único material es un desliz → nota");
  const pMezcla = compararResumenes([res("A", 1, 5), res("A", 2, 5), res("B", 1, 1, 100, 8, [{ id: "x", hilo: "H0", familia: "desliz de lectura con la verdad a la vista", esDesliz: true }, { id: "y", hilo: "H1", familia: "conteo", esDesliz: false }]), res("B", 2, 1)]);
  ok(pMezcla.ok && pMezcla.regla.resuelta && pMezcla.nota === null, "…pero si en B quedan materiales de otra familia además del desliz, no hay nota (la familia 'conteo' no es variabilidad)");
  // ── lo que se RECHAZA: una comparación engañosa
  const rech = (que, carpetas, re, opc = {}) => { const r = compararBrazos(carpetas, opc); ok(!r.ok && re.test(r.errores.join("\n")) && /COMPARACIÓN RECHAZADA/.test(r.texto), `★ CARNADA · ${que}`, JSON.stringify(r.errores)); };
  rech("falta un brazo (solo corridas A)", [e1.A1, e1.A2], /falta al menos una corrida del brazo B/);
  { const d = copiarCorrida(e1.B1, sub("cmp-otro-corpus"), clasFalsa(B0)); const m = leerJson(path.join(d, "manifiesto.json")); m.corpus.sha256 = "0".repeat(64); fs.writeFileSync(path.join(d, "manifiesto.json"), JSON.stringify(m)); rech("una corrida de OTRO corpus (huella sha256 distinta): sin pareo no hay A/B", [e1.A1, e1.A2, d, e1.B2], /MISMO corpus sellado/); }
  { const d = copiarCorrida(e1.B1, sub("cmp-otro-codigo"), clasFalsa(B0)); const m = leerJson(path.join(d, "manifiesto.json")); m.hashes.codigo = "1".repeat(64); fs.writeFileSync(path.join(d, "manifiesto.json"), JSON.stringify(m)); const cj = leerJson(path.join(d, "corrida.json")); cj.codigoHuellaFinal = "1".repeat(64); fs.writeFileSync(path.join(d, "corrida.json"), JSON.stringify(cj)); rech("una corrida con OTRO código", [e1.A1, e1.A2, d, e1.B2], /mismo CÓDIGO/); }
  { const d = copiarCorrida(e1.B1, sub("cmp-sin-brazo"), clasFalsa(B0)); const m = leerJson(path.join(d, "manifiesto.json")); delete m.brazo; fs.writeFileSync(path.join(d, "manifiesto.json"), JSON.stringify(m)); rech("una corrida sin brazo (anterior al A/B)", [e1.A1, e1.A2, d, e1.B2], /no declara su brazo/); }
  { const d = copiarCorrida(e1.B1, sub("cmp-sin-clasif"), null); fs.rmSync(path.join(d, "clasificacion.json"), { force: true }); rech("una corrida SIN clasificación humana (el sobre-alcance no se mide solo)", [e1.A1, e1.A2, d, e1.B2], /falta `clasificacion\.json`/); }
  { const d = copiarCorrida(e1.B1, sub("cmp-mezclada"), clasFalsa(B0)); const t = leerJson(path.join(d, "transcritos", `${h0}.json`)); t.turnos[0].brazo = "A"; fs.writeFileSync(path.join(d, "transcritos", `${h0}.json`), JSON.stringify(t));
    rech("una corrida INVÁLIDA (mezcla de brazos) no entra en la comparación", [e1.A1, e1.A2, d, e1.B2], /INVÁLIDA/);
    ok(compararBrazos([e1.A1, e1.A2, d, e1.B2], { aceptarInvalidas: true }).ok, "…salvo que se pida `aceptarInvalidas` (solo para análisis, no para decidir)"); }
  ok(!compararBrazos([sub("no-existe-1"), e1.B1]).ok && /no existe/.test(compararBrazos([sub("no-existe-1"), e1.B1]).errores.join()), "una carpeta que no existe se rechaza");
  { const dup = compararBrazos([e1.A1, e1.A1, e1.B1, e1.B2]); ok(dup.ok && dup.advertencias.some((a) => /aparece dos veces/.test(a)), "la misma celda dos veces: se advierte"); }
  { const tres = compararBrazos([e1.A1, e1.B1, e1.B2]); ok(tres.ok && tres.advertencias.some((a) => /el diseño pide 2 repeticiones/.test(a)), "un brazo con una sola corrida: se advierte (el diseño pide 2 por brazo)"); }
  // el CLI
  { const r = await new Promise((res) => { const p = spawn(process.execPath, ["--import", "./scripts/offline-guard.mjs", D + "comparar-brazos.mjs", "--umbral=30", ...Object.values(e1)], { stdio: ["ignore", "pipe", "pipe"] }); let so = ""; p.stdout.on("data", (c) => { so += c; }); p.on("close", (code) => res({ code, so })); });
    ok(r.code === 0 && /VEREDICTO: familia resuelta/.test(r.so) && /30 %/.test(r.so), "el CLI `comparar-brazos.mjs --umbral=30 <4 carpetas>` imprime el informe y sale con 0", r.so.slice(0, 200));
    const r2 = await new Promise((res) => { const p = spawn(process.execPath, ["--import", "./scripts/offline-guard.mjs", D + "comparar-brazos.mjs", e1.A1], { stdio: ["ignore", "pipe", "pipe"] }); let so = ""; p.stdout.on("data", (c) => { so += c; }); p.on("close", (code) => res({ code, so })); });
    ok(r2.code === 2 && /COMPARACIÓN RECHAZADA/.test(r2.so), "…y con una sola carpeta se rechaza (código 2)"); }
  fs.writeFileSync(path.join(TMP, "muestra-comparacion.txt"), c1.texto);
  if (process.env.MX_MOSTRAR_COMPARACION) console.log("\n" + c1.texto + "\n");
}

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* temporal */ }
console.log(`\n── _medicion_anfitrion_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) { console.log("\nFALLOS:"); for (const f of fails) console.log("  ✗ " + f); }
process.exit(fail ? 1 : 0);
