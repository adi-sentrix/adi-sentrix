/* === _gates_offline_gate.mjs · CERTIFICA EL CANDADO DE RED (owner 2026-08-07) ========================
 * El runner `npm run gates:offline` es una GARANTÍA de que no se gastan créditos. Una garantía que nadie
 * verifica es una promesa: esto la verifica.
 *   [1] El candado MATA (exit 97) ante fetch, https.request y net.connect — las tres salidas reales.
 *   [2] El candado NO rompe un proceso que no toca la red (cero falsos positivos).
 *   [3] El clasificador estático marca LIVE lo que llama al gateway y NO marca lo determinístico.
 *   [4] `npm run gates:offline` existe en package.json y apunta al runner.
 *   [5] `npm run gates` lleva el aviso de que gasta créditos (el incidente que originó todo esto).
 *
 * NOTA sobre el fixture: la llamada de prueba se escribe `globalThis["fet"+"ch"]` a propósito. Si este archivo
 * contuviera ese nombre entero pegado a un paréntesis de apertura, el clasificador de gates-offline.mjs lo
 * marcaría LIVE y este gate nunca correría en la suite offline — que es exactamente donde tiene que correr. (Esta
 * misma frase lo decía con el literal adentro, y por eso durante meses se marcó a sí misma.) La indirección es
 * del FIXTURE, no del candado.
 *
 * @inspeccion-estatica — Y SIN EMBARGO NO CORRÍA (hallazgo 2026-08-10). La indirección tapaba el literal, pero los
 * fixtures nombran `app.adiai.cl` y `api.openai.com` —tienen que nombrarlos: son los destinos que el candado debe
 * bloquear— y ESO lo marcaba LIVE igual. O sea que el gate que certifica el candado antigasto era el único que
 * nadie corría, y se le había quedado una aserción desactualizada sin que se notara. Cumple las tres condiciones
 * del escape: declara el marcador, no importa el gateway ni un adapter, y no invoca a nadie (sus sondas viajan
 * como TEXTO a procesos hijos que corren CON el candado y mueren en 97, que es precisamente lo que mide).
 *
 * Cero red (el fixture muere antes de abrir el socket), cero LLM. `node _gates_offline_gate.mjs`
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
// EL CLASIFICADOR REAL (extraído a su archivo el 2026-09-01, autorización del owner: «siempre que no cambie su
// conducta»). Antes este gate REPLICABA la clasificación con regex propios porque la lógica vivía encerrada en
// el runner; una réplica puede divergir del original sin que nadie se entere. Ahora se ejercita LA función que
// el runner usa — y la sección [3c] la muta para probar que clasificar mal un LIVE como offline pone algo ROJO.
import { clasificarFuente } from "./scripts/clasificarGates.mjs";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const ROOT = process.cwd();
const GUARD = pathToFileURL(join(ROOT, "scripts", "offline-guard.mjs")).href;
const tmp = mkdtempSync(join(tmpdir(), "adi-offline-"));

function correrBajoCandado(codigo) {
  const f = join(tmp, `probe-${Math.abs(codigo.length * 7919)}.mjs`);
  writeFileSync(f, codigo, "utf8");
  const r = spawnSync(process.execPath, ["--import", GUARD, f], { cwd: ROOT, encoding: "utf8" });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

H("[1] EL CANDADO MATA · las tres salidas reales a la red");
{
  const F = 'await globalThis["fet"+"ch"]("https://app.adiai.cl/api/adi-plan-c");';
  const r1 = correrBajoCandado(F);
  ok(r1.code === 97, `fetch al gateway desplegado → exit 97 (obtuvo ${r1.code})`);
  ok(/RED BLOQUEADA/.test(r1.out) && /app\.adiai\.cl/.test(r1.out), "el mensaje nombra el destino bloqueado (diagnosticable)");

  const r2 = correrBajoCandado('const h = await import("node:https"); h.default.request({ hostname: "api.openai.com" });');
  ok(r2.code === 97, `https.request al proveedor → exit 97 (obtuvo ${r2.code})`);

  const r3 = correrBajoCandado('const n = await import("node:net"); new n.default.Socket().connect(443, "api.openai.com");');
  ok(r3.code === 97, `net.Socket.connect crudo → exit 97 · el piso, tapa cualquier librería (obtuvo ${r3.code})`);

  const r4 = correrBajoCandado('const d = await import("node:dns"); d.default.lookup("api.openai.com", () => {});');
  ok(r4.code === 97, `dns.lookup → exit 97 · falla ANTES del socket (obtuvo ${r4.code})`);
}

H("[2] SIN FALSOS POSITIVOS · un proceso que no toca la red corre normal");
{
  const r = correrBajoCandado('import { readFileSync } from "node:fs"; readFileSync("package.json", "utf8"); console.log("ok");');
  ok(r.code === 0 && /ok/.test(r.out), `leer archivos, importar módulos y computar sigue funcionando (exit ${r.code})`);
  const r2 = correrBajoCandado('console.log("marca=" + process.env.ADI_OFFLINE_GATES);');
  ok(/marca=1/.test(r2.out), "el proceso queda marcado ADI_OFFLINE_GATES=1 (informativo, nunca un bypass)");
}

H("[3] CLASIFICADOR ESTÁTICO · qué corre y qué NO");
{
  // Desde 2026-09-01 el clasificador vive en scripts/clasificarGates.mjs (extraído SIN cambiar la lógica, para
  // que el candado de gates ausentes consulte la misma clasificación). Los marcadores se buscan en ESE texto —
  // el mismo check, re-apuntado al archivo donde el marcador vive ahora; el cableado runner→clasificador se
  // verifica en [4] para que esto nunca vigile un archivo muerto.
  // Se busca el TEXTO FUENTE del marcador tal como está escrito (son regex: llevan `\.` escapado), no el string
  // interpretado — por eso la comparación es sobre fragmentos literales inequívocos, sin puntos.
  const clasif = readFileSync(join(ROOT, "scripts", "clasificarGates.mjs"), "utf8");
  for (const marca of ["handlePlan", "handleNarrateC", "gatewayCore", "callPlan", "adiai", "vercel", "openai", "OPENAI_API_KEY"]) {
    ok(clasif.includes(marca), `el clasificador vigila \`${marca}\``);
  }
  // la clasificación real, sobre gates que existen en disco — y con la FUNCIÓN real, no una réplica: la réplica
  // que vivía acá podía divergir del clasificador sin que nadie lo note (existía solo porque la lógica estaba
  // encerrada en el runner). Si el clasificador dejara de marcar lo que llama al gateway, ESTE check muerde.
  const live = "_oracle_plan_gate.mjs", det = "_narration_contract_gate.mjs";
  const srcLive = readFileSync(join(ROOT, live), "utf8");
  const srcDet = readFileSync(join(ROOT, det), "utf8");
  ok(clasificarFuente(srcLive).tipo === "live", `${live} se clasifica LIVE (llama al gateway) → NO se corre en offline`);
  ok(clasificarFuente(srcDet).tipo === "offline", `${det} se clasifica OFFLINE (determinístico puro) → SÍ se corre`);
}

H("[3b] LOS DOS ESCAPES · devuelven gates a la suite SIN desproteger nada (owner 2026-08-10)");
{
  const clasif = readFileSync(join(ROOT, "scripts", "clasificarGates.mjs"), "utf8");
  ok(/@inspeccion-estatica/.test(clasif) && /@inyeccion-simulada/.test(clasif), "el clasificador declara los DOS marcadores de escape");
  // los escapes se ejercitan con la FUNCIÓN real (antes: una réplica local, único recurso mientras la lógica
  // vivía encerrada en el runner — una réplica verde con el original roto era posible; ahora no).
  const clasifica = (src) => clasificarFuente(src).tipo;
  const gateReal = readFileSync(join(ROOT, "_reparacion_pipeline_gate.mjs"), "utf8");
  ok(clasifica(gateReal) === "offline", "un gate que declara @inyeccion-simulada y cumple las 4 condiciones vuelve a la suite");
  // LAS CONDICIONES NO SON DECORATIVAS: cada una, rota por separado, devuelve el gate a LIVE.
  ok(clasifica(gateReal.replace("@inyeccion-simulada", "inyeccion")) === "live", "sin la declaración → LIVE");
  ok(clasifica(`import { handlePlan } from "../src/adi/llm/gatewayCore.js";\n` + gateReal) === "live", "declarándolo pero importando el gateway → LIVE igual");
  ok(clasifica(`import { x } from "./src/ui/ChatADI.jsx";\n` + gateReal) === "live", "declarándolo pero importando src/ui (donde viven los fetchers reales) → LIVE igual");
  // el fixture se arma partido, por la MISMA razón que el de la sección [1]: si este archivo contuviera el
  // literal, se clasificaría a sí mismo LIVE y dejaría de correr, que es justo lo que estamos corrigiendo.
  ok(clasifica(gateReal + "\nawait fet" + "ch(\"https://x\");") === "live", "declarándolo pero con una salida cruda → LIVE igual");
  // y el candado de runtime sigue siendo la garantía real, no el scan: un gate que declare el marcador y ADEMÁS
  // intente salir a la red muere igual, con el runner saliendo en 2 (clasificación mal hecha, nunca gasto).
  const r = correrBajoCandado('/* @inyeccion-simulada */ await globalThis["fet"+"ch"]("https://api.openai.com/v1/x");');
  ok(r.code === 97, `el marcador NO desactiva el candado: sigue muriendo en 97 (obtuvo ${r.code})`);
}

H("[3c] LA CARNADA DE CONDUCTA · mutar el clasificador para clasificar mal un LIVE como offline → algo ROJO");
{
  // La conducta que el owner exige intacta («debe seguir impidiendo gasto accidental»), probada y no prometida:
  // se muta el clasificador REAL de las dos formas en que puede empezar a mentir, y se muestra qué check muerde
  // en cada una. Si alguna mutación no fuera cazada por nada, el candado sería una promesa.
  const original = readFileSync(join(ROOT, "scripts", "clasificarGates.mjs"), "utf8");
  const importar = async (src) => {
    const f = join(tmp, `clasif-mut-${Math.abs(src.length * 31)}.mjs`);
    writeFileSync(f, src, "utf8");
    return import(pathToFileURL(f).href);
  };
  // un fuente LIVE cuya ÚNICA señal es la credencial del proveedor — con ella borrada, no queda nada que lo marque
  const fixtureCredencial = "const k = process.env.OPENAI_API_KEY;\n";
  ok(clasificarFuente(fixtureCredencial).tipo === "live", "CONTROL · el fixture con la credencial del proveedor clasifica LIVE con el clasificador real");

  // MUTACIÓN 1 · borrar un marcador (la línea de la credencial OpenAI desaparece de la lista)
  const sinMarcador = original.split("\n").filter((l) => !l.includes("OPENAI_API_KEY")).join("\n");
  ok(sinMarcador !== original, "mutación 1 aplicada: la línea del marcador de OpenAI ya no está");
  const m1 = await importar(sinMarcador);
  ok(m1.clasificarFuente(fixtureCredencial).tipo === "offline", "…y con ella el LIVE clasifica offline: la mutación MIENTE de verdad (no es una carnada muerta)");
  ok(!sinMarcador.includes("OPENAI_API_KEY"), "★ y el check de texto de [3] la caza: `el clasificador vigila OPENAI_API_KEY` daría ✗ sobre este fuente");

  // MUTACIÓN 2 · invertir la decisión (todo hit termina en offline; los marcadores siguen TODOS en el texto,
  // así que los checks de texto no la ven — la caza el check SEMÁNTICO de [3], que ejercita la función real)
  const invertido = original.replace('return { tipo: "live", motivo: hit[1] };', 'return { tipo: "offline" };');
  ok(invertido !== original, "mutación 2 aplicada: la rama live devuelve offline");
  const m2 = await importar(invertido);
  ok(m2.clasificarFuente(readFileSync(join(ROOT, "_oracle_plan_gate.mjs"), "utf8")).tipo === "offline"
    && clasificarFuente(readFileSync(join(ROOT, "_oracle_plan_gate.mjs"), "utf8")).tipo === "live",
    "★ el gate que llama al gateway pasa a «offline» con la mutación y sigue «live» con el real: el check `_oracle_plan_gate.mjs se clasifica LIVE` de [3] daría ✗");
  // y aunque TODO el scan mintiera, el gasto sigue impedido: el candado de runtime mata en 97 ([1]) y el runner
  // sale en 2 denunciando la clasificación ([4]) — el scan clasifica; el candado garantiza.
}

H("[4] EL RUNNER EXISTE Y ESTÁ CABLEADO");
{
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  ok(pkg.scripts && pkg.scripts["gates:offline"] === "node scripts/gates-offline.mjs", `npm run gates:offline → ${pkg.scripts && pkg.scripts["gates:offline"]}`);
  const runner = readFileSync(join(ROOT, "scripts", "gates-offline.mjs"), "utf8");
  ok(/offline-guard\.mjs/.test(runner) && /--import/.test(runner), "el runner arma cada gate CON el candado (`--import`), no confía solo en el scan");
  // el cableado que sostiene los checks [3]/[3b]/[3c]: si el runner clasificara con OTRA copia, este gate
  // certificaría un archivo que nadie usa. Se exige el import del clasificador extraído y que no quede réplica.
  ok(/from\s+["']\.\/clasificarGates\.mjs["']/.test(runner) && /clasificarGates\(ROOT\)/.test(runner),
    "el runner clasifica importando ./clasificarGates.mjs — el MISMO módulo que este gate ejercita");
  ok(!/const\s+LIVE\s*=\s*\[/.test(runner), "y no conserva una copia local de los marcadores (una copia diverge sin avisar)");
  ok(/pathToFileURL/.test(runner), "usa pathToFileURL: en Windows una ruta absoluta cruda no es un especificador válido para --import");
  // ASERCIÓN CORREGIDA (owner 2026-08-10): esperaba `process.exit(red.length ? 2` y el runner dice
  // `red.length || fuga.length ? 2` desde que se sumó la detección de credencial viva. La conducta siempre fue
  // correcta; la que estaba desactualizada era esta línea. Nadie lo vio porque ESTE gate no corría en la suite
  // (se clasificaba LIVE por una URL de fixture) — la prueba más nítida de que un gate que no corre no garantiza.
  ok(/process\.exit\(red\.length \|\| fuga\.length \? 2/.test(runner), "exit 2 si un gate 'offline' tocó la red o vio una credencial — la clasificación mal hecha NO pasa desapercibida");
  ok(/NO CORRIDOS/.test(runner), "lista explícitamente los gates que NO corrió (nunca truncado en silencio)");
}

H("[5] EL AVISO EN `npm run gates` · el incidente que originó esto");
{
  const full = readFileSync(join(ROOT, "scripts", "run-gates.mjs"), "utf8");
  ok(/GASTA CR[ÉE]DITOS/i.test(full), "run-gates.mjs advierte que gasta créditos reales");
  ok(/gates:offline/.test(full), "…y apunta a gates:offline como la alternativa correcta");
  ok(/server-side|gateway/i.test(full), "…y explica POR QUÉ: la key vive en el gateway desplegado, no en el env local");
}

rmSync(tmp, { recursive: true, force: true });
console.log(`\n── _gates_offline_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
