/* === _consumo_gate.mjs · EL CONTADOR DE CONSUMO, CERTIFICADO (owner 2026-09-25, ETAPA 0) ======================
 * POR QUÉ EXISTE. CLAUDE.md §3: «el repo NO registra consumo… ninguna afirmación de costo es verificable hoy».
 * La ley de esta etapa: NINGÚN GASTO EN MODELOS SIN CONTADOR FUNCIONANDO ANTES. Este gate certifica las tres
 * piezas que hacen eso posible:
 *   [1] EL AGREGADOR (`consumo.js`) · eventos sintéticos → agregación EXACTA por proveedor·modelo·etapa.
 *   [2] SIN CONTEO NO ES CERO · una llamada que salió y volvió sin tokens se cuenta APARTE, nunca en el total.
 *   [3] MODELO SIN PRECIO SE DECLARA · nunca se suma como $0 ni desaparece del resumen.
 *   [4] EL CANDADO OPT-IN (`exigirContador.js`) · sin la variable, nada cambia; con la variable y SIN sink,
 *       rechaza ANTES de "salir" (proveedor SIMULADO — este gate no importa el gateway ni ningún adapter, así
 *       que queda offline por diseño, no por escape); con sink, deja pasar.
 *   [5] ABRIR/CERRAR UNA CORRIDA (`corridaMedida.js`) · instala, agrega al cerrar, restaura el sink previo.
 *
 * QUÉ QUEDÓ AFUERA A PROPÓSITO, y por qué (ver el reporte al supervisor): el «punto único por donde salen las
 * llamadas» que pidió el encargo no es uno solo en el archivo del gateway platform-neutral — son CINCO manejadores
 * distintos (uno por pasada: spec, narración clásica, plan, narración-C, agente), cada uno con su propio marcador
 * de cruce pegado a su propio llamado al adaptador del proveedor. Cablear `exigirContador()` ahí es cirugía sobre
 * el gateway de producción cinco veces; este gate certifica el candado LISTO PARA esa cirugía, pero no la hace ni
 * la importa — el «proveedor simulado» de la sección [4] es una función LOCAL de este archivo. Nombrar el gateway
 * real (su archivo, sus funciones o su import) sacaría este gate de la suite offline por el clasificador estático
 * del repo — y un gate que no corre no certifica nada.
 *
 * OFFLINE · CERO RED: importa módulos puros (`consumo.js`, `exigirContador.js`, `corridaMedida.js`,
 * `telemetry.js`, `telemetrySink.js`, `modelPricing.js`) y usa un `fs` FALSO (inyectado) más un directorio
 * temporal real de `node:os` — ningún fetch, ningún proveedor, ningún adapter.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import * as fsReal from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resumenDeCorrida } from "./src/adi/llm/consumo.js";
import { exigirContador, contadorExigido, ADI_EXIGIR_CONTADOR_VAR, SIN_CONTADOR_REASON } from "./src/adi/llm/exigirContador.js";
import { abrirCorridaMedida } from "./src/adi/llm/corridaMedida.js";
import { emit, setSink, getSink, REASON_CODES } from "./src/adi/llm/telemetry.js";
import { MODEL_PRICING } from "./src/adi/llm/modelPricing.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const cerca = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const cap = () => { const a = []; setSink((e) => a.push(e)); return a; };

H("[1] EL AGREGADOR · eventos sintéticos → agregación EXACTA por proveedor·modelo·etapa");
{
  const eventos = cap();
  // dos llamadas del mismo grupo (anthropic·claude-sonnet-5·narrar), una con caché, una sin — precio real de
  // MODEL_PRICING (no se inventa acá: se lee de la tabla, para que un cambio de tarifa no desincronice el gate).
  const p = MODEL_PRICING["claude-sonnet-5"];
  ok(!!p, "la tabla de precios trae claude-sonnet-5 (si esto falla, el resto de la sección no es comparable)");
  emit({ traceId: "a1", proveedor: "anthropic", modelo: "claude-sonnet-5", etapa: "narrar", intento: 0, resultado: "ok",
    tokens_in: 1_000_000, tokens_in_cache: 400_000, tokens_out: 200_000, consumo: "contado" });
  emit({ traceId: "a2", proveedor: "anthropic", modelo: "claude-sonnet-5", etapa: "narrar", intento: 1, resultado: "ok",
    tokens_in: 500_000, tokens_in_cache: 0, tokens_out: 100_000, consumo: "contado" });
  // un tercer grupo distinto (otro proveedor, otro modelo, otra etapa)
  emit({ traceId: "b1", proveedor: "openai", modelo: "gpt-4o-mini", etapa: "plan", intento: 0, resultado: "ok",
    tokens_in: 800, tokens_out: 100, consumo: "contado" });
  setSink(null);
  ok(eventos.length === 3, `los tres eventos se capturaron (${eventos.length})`);

  const r = resumenDeCorrida(eventos);
  ok(r.eventos === 3 && r.salieron === 3 && r.noSalieron === 0, `3 eventos, 3 salieron, 0 no-salieron — ${JSON.stringify({ e: r.eventos, s: r.salieron, ns: r.noSalieron })}`);
  ok(r.porGrupo.length === 2, `dos grupos distintos (proveedor·modelo·etapa) — ${r.porGrupo.length}`);
  const gA = r.porGrupo.find((g) => g.modelo === "claude-sonnet-5");
  const gB = r.porGrupo.find((g) => g.modelo === "gpt-4o-mini");
  ok(!!gA && gA.llamadas === 2, `el grupo de claude-sonnet-5 junta las 2 llamadas — ${gA && gA.llamadas}`);
  ok(gA.tokens_in === 1_500_000, `tokens_in sumados exacto — ${gA.tokens_in}`);
  ok(gA.tokens_in_cache === 400_000, `tokens_in_cache sumado exacto — ${gA.tokens_in_cache}`);
  ok(gA.tokens_in_fresh === 1_100_000, `tokens_in_fresh (derivado por telemetry.js, no recalculado acá) sumado exacto — ${gA.tokens_in_fresh}`);
  ok(gA.tokens_out === 300_000, `tokens_out sumado exacto — ${gA.tokens_out}`);
  const costoEsperadoA = (1_000_000 / 1e6) * p.in + (200_000 / 1e6) * p.out + (500_000 / 1e6) * p.in + (100_000 / 1e6) * p.out;
  ok(cerca(gA.costoUSD, costoEsperadoA), `costoUSD del grupo = suma de costoLlamadaUSD por evento — ${gA.costoUSD} vs ${costoEsperadoA}`);
  ok(!!gB && gB.llamadas === 1, "el grupo de gpt-4o-mini queda aparte, con su propia llamada");
  ok(cerca(r.costoUSD, gA.costoUSD + gB.costoUSD), `el costo TOTAL es la suma de los grupos, sin un tercer cálculo — ${r.costoUSD}`);
  ok(r.reintentos.total === 1 && r.reintentos.porEtapa.narrar === 1, `el evento con intento:1 cuenta como reintento, en SU etapa — ${JSON.stringify(r.reintentos)}`);
  ok(r.resultados.ok === 3, `los tres resultados quedan tipados — ${JSON.stringify(r.resultados)}`);
}

H("[2] SIN CONTEO NO ES CERO · una llamada que salió y volvió sin tokens se cuenta APARTE");
{
  const eventos = cap();
  emit({ traceId: "c1", proveedor: "anthropic", modelo: "claude-haiku-4-5", etapa: "plan", intento: 0, resultado: "ok", consumo: "contado" });
  setSink(null);
  ok(eventos[0].consumo === "sin_conteo", `telemetry.js ya lo tipó "sin_conteo" (el caller no puede mentir) — ${eventos[0].consumo}`);
  const antes = resumenDeCorrida([]).costoUSD;
  const r = resumenDeCorrida(eventos);
  ok(r.salieron === 1, "la llamada SÍ cuenta como salida (pudo facturarse)");
  ok(r.sinConteo.total === 1, `y queda en el contador de "sin conteo", separado — ${r.sinConteo.total}`);
  ok(r.sinConteo.detalle[0].traceId === "c1", "…con el detalle de cuál fue, no solo el número");
  const gC = r.porGrupo.find((g) => g.modelo === "claude-haiku-4-5");
  ok(!!gC && gC.llamadas === 1 && gC.sinConteo === 1, "el grupo también la cuenta como sinConteo, no como una llamada muda");
  ok(gC.tokens_in === 0 && gC.tokens_out === 0 && gC.costoUSD === 0, "…y NO se le atribuyen tokens ni costo — 0 real, no 0 por descuido");
  ok(r.costoUSD === antes, `el costo total NO se movió: una llamada sin conteo nunca se suma como $0 disfrazado de dato — ${r.costoUSD}`);
}

H("[3] MODELO SIN PRECIO · se declara, nunca se suma como $0 ni desaparece");
{
  const eventos = cap();
  emit({ traceId: "d1", proveedor: "openai", modelo: "gpt-9-inventado", etapa: "plan", intento: 0, resultado: "ok",
    tokens_in: 1000, tokens_out: 200, consumo: "contado" });
  setSink(null);
  ok(!("gpt-9-inventado" in MODEL_PRICING), "el modelo de la prueba NO está en la tabla real (si lo estuviera, no probaría nada)");
  const r = resumenDeCorrida(eventos);
  ok(r.salieron === 1, "la llamada cuenta como salida igual");
  ok(r.modelosSinPrecio.length === 1 && r.modelosSinPrecio[0].modelo === "gpt-9-inventado" && r.modelosSinPrecio[0].veces === 1,
    `el modelo sin precio queda DECLARADO, con cuántas veces — ${JSON.stringify(r.modelosSinPrecio)}`);
  ok(r.costoUSD === 0, "…y el total de costo NO lo suma como cero silencioso: queda en 0 porque no hay OTRA llamada tarifable, no porque éste costó $0");
  const gD = r.porGrupo.find((g) => g.modelo === "gpt-9-inventado");
  ok(!!gD && gD.llamadas === 1 && gD.costoUSD === 0, "el grupo existe (la llamada no desaparece del resumen), con costoUSD en 0 explícito");
}

H("[4] EL CANDADO OPT-IN · con la variable apagada nada cambia; encendida, rechaza sin sink y deja pasar con sink");
{
  // "proveedor simulado", LOCAL a este gate — nunca getAdapter() ni el gateway real (ver la cabecera del archivo).
  let vecesLlamado = 0;
  const proveedorSimulado = async () => { vecesLlamado++; return { ok: true, texto: "narración simulada" }; };
  async function llamadaSimulada(env) {
    const c = exigirContador({ env });
    if (!c.ok) return { ok: false, reasonCode: c.reasonCode, mensaje: c.mensaje };
    const salida = await proveedorSimulado();
    return { ok: true, ...salida };
  }

  ok(REASON_CODES.includes(SIN_CONTADOR_REASON), `"${SIN_CONTADOR_REASON}" está en la lista cerrada de telemetry.js, una sola declaración — ${REASON_CODES.join(" · ")}`);

  // 4a · variable AUSENTE, sin sink: nada cambia respecto de hoy — la llamada sale igual.
  setSink(null);
  vecesLlamado = 0;
  {
    const r = await llamadaSimulada({});
    ok(r.ok === true && vecesLlamado === 1, "sin ADI_EXIGIR_CONTADOR: la llamada sale igual que hoy, aunque no haya sink");
  }

  // 4b · variable EN "true" (forma incorrecta): sigue sin exigir — UNA sola forma válida, "1".
  vecesLlamado = 0;
  {
    ok(!contadorExigido({ [ADI_EXIGIR_CONTADOR_VAR]: "true" }), `"true" NO activa el candado — solo "1" (evita el apagón por typo)`);
    const r = await llamadaSimulada({ [ADI_EXIGIR_CONTADOR_VAR]: "true" });
    ok(r.ok === true && vecesLlamado === 1, "…y por lo tanto la llamada sigue saliendo sin sink");
  }

  // 4c · variable ENCENDIDA ("1"), SIN sink: rechaza ANTES de "salir" — el proveedor simulado NO se llama.
  setSink(null);
  vecesLlamado = 0;
  {
    ok(contadorExigido({ [ADI_EXIGIR_CONTADOR_VAR]: "1" }), "\"1\" sí activa el candado");
    const r = await llamadaSimulada({ [ADI_EXIGIR_CONTADOR_VAR]: "1" });
    ok(r.ok === false && r.reasonCode === SIN_CONTADOR_REASON, `rechazada con el código cerrado — ${JSON.stringify(r)}`);
    ok(vecesLlamado === 0, "…y el proveedor simulado NUNCA se llegó a invocar: el freno es ANTES de salir, no después");
  }

  // 4d · variable ENCENDIDA, CON sink instalado: deja pasar.
  setSink(() => {});
  vecesLlamado = 0;
  {
    const r = await llamadaSimulada({ [ADI_EXIGIR_CONTADOR_VAR]: "1" });
    ok(r.ok === true && vecesLlamado === 1, "con un sink instalado, la misma llamada sale normalmente");
  }
  setSink(null);

  // 4e · exigirContador es PURO: no instala nada, no llama a nadie — solo lee env + getSink().
  {
    const antes = getSink();
    exigirContador({ env: { [ADI_EXIGIR_CONTADOR_VAR]: "1" } });
    ok(getSink() === antes, "exigirContador() no toca el sink: solo lo consulta");
  }
}

H("[5] ABRIR/CERRAR UNA CORRIDA MEDIDA · instala, agrega al cerrar, restaura el sink previo");
{
  function fsFalso() {
    const files = new Map();
    return {
      files,
      appendFileSync(ruta, txt) { files.set(ruta, (files.get(ruta) || "") + txt); },
      readFileSync(ruta, enc) { if (!files.has(ruta)) { const e = new Error("ENOENT"); e.code = "ENOENT"; throw e; } return files.get(ruta); },
      statSync(ruta) { if (!files.has(ruta)) { const e = new Error("ENOENT"); e.code = "ENOENT"; throw e; } return { size: files.get(ruta).length }; },
      renameSync(a, b) { files.set(b, files.get(a) || ""); files.delete(a); },
    };
  }

  // 5a · sin destino declarado: no instala nada, cerrar() no revienta y declara que no pudo agregar de verdad.
  setSink(null);
  {
    const { instalacion, cerrar } = abrirCorridaMedida({ ruta: null, fs: fsFalso() });
    ok(instalacion.instalado === false, "sin ruta, no se instala — mismo contrato que instalarTelemetria()");
    const cierre = cerrar();
    ok(cierre.agregado === false && cierre.resumen.eventos === 0, "cerrar() sobre una corrida que nunca abrió: resumen vacío, DECLARADO como no-agregado, no fingido");
  }

  // 5b · corrida real: se abre, se emite durante la corrida, se cierra y el resumen coincide con lo emitido.
  const fs1 = fsFalso();
  const sinkPrevio = () => {};
  setSink(sinkPrevio);
  {
    const { instalacion, cerrar } = abrirCorridaMedida({ ruta: "/corrida/telemetria.jsonl", fs: fs1 });
    ok(instalacion.instalado === true, `la corrida se instala contra el archivo — ${JSON.stringify(instalacion)}`);
    ok(getSink() !== sinkPrevio, "…y el sink activo YA NO es el que había antes de abrir");
    emit({ traceId: "e1", proveedor: "anthropic", modelo: "claude-sonnet-5", etapa: "narrar", intento: 0, resultado: "ok",
      tokens_in: 1000, tokens_out: 200, consumo: "contado" });
    emit({ traceId: "e2", proveedor: "anthropic", modelo: "claude-sonnet-5", etapa: "narrar", intento: 0, resultado: "rechazado" });
    const cierre = cerrar();
    ok(cierre.agregado === true, "esta vez SÍ pudo releer y agregar");
    ok(cierre.resumen.eventos === 2, `el resumen ve los DOS eventos emitidos durante la corrida — ${cierre.resumen.eventos}`);
    ok(cierre.resumen.salieron === 1, "solo el que tenía consumo:\"contado\" cuenta como salida; el rechazado no");
    ok(getSink() === sinkPrevio, "cerrar() RESTAURA el sink que había antes de abrir — no es un efecto global permanente");
  }

  // 5c · round-trip contra disco REAL (no el fs falso) — la misma función que usa scripts/resumenConsumo.mjs.
  const tmp = mkdtempSync(join(tmpdir(), "adi-consumo-"));
  const ruta = join(tmp, "corrida.jsonl");
  setSink(null);
  {
    const { instalacion, cerrar } = abrirCorridaMedida({ ruta, fs: fsReal });
    ok(instalacion.instalado === true, "se instala contra un archivo real");
    emit({ traceId: "f1", proveedor: "openai", modelo: "gpt-4o-mini", etapa: "plan", intento: 0, resultado: "ok",
      tokens_in: 500, tokens_out: 50, consumo: "contado" });
    ok(existsSync(ruta), "el archivo existe en disco mientras la corrida está abierta");
    const cierre = cerrar();
    ok(cierre.agregado === true && cierre.resumen.eventos === 1, "el releído real coincide con lo emitido");
    ok(getSink() === null, "cerrar() restauró el sink previo (null, como estaba antes de este bloque)");
    // el mismo archivo, releído por separado (lo que hace el CLI): otra prueba de que persiste.
    const releido = readFileSync(ruta, "utf8").trim().split("\n").filter(Boolean);
    ok(releido.length === 1, "el JSONL sobrevive al cierre — es lo que lee scripts/resumenConsumo.mjs después");
  }
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n── _consumo_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL === 0 ? 0 : 1);
