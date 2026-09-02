/* === scripts/gates-offline.mjs · `npm run gates:offline` (owner 2026-08-07 · cerrojo 2026-08-09) ======
 * La suite DETERMINÍSTICA: corre solo los gates que no tocan la red, con la red FÍSICAMENTE bloqueada y SIN
 * ninguna credencial de proveedor en el entorno de los hijos. Cero llamadas al gateway, cero llamadas al
 * proveedor, cero créditos. Es el runner que hay que usar bajo una instrucción de "no gastes créditos" —
 * `npm run gates` NO sirve para eso (ver el aviso de su propio archivo).
 *
 * TRES CANDADOS, no uno:
 *   1. ESTÁTICO (scripts/clasificarGates.mjs) · cada `_*_gate.mjs` se lee y se clasifica LIVE si menciona un marcador de red. Los LIVE
 *      NO SE CORREN — se listan explícitamente al final. Nada se omite en silencio: si un gate queda afuera, el
 *      reporte dice cuál y por qué marcador.
 *   2. DE CREDENCIAL (acá + scripts/offline-guard.mjs) · los hijos se spawnean con el entorno LIMPIO: ninguna
 *      variable que sea credencial de proveedor viaja al proceso (ver scripts/provider-keys.mjs). Un proceso sin
 *      credencial no puede gastar aunque su código lo intente.
 *   3. DE RUNTIME (scripts/offline-guard.mjs) · los que SÍ se corren van con `--import` del candado, que mata el
 *      proceso (exit 97) ante cualquier fetch/http/https/net/dns, y aborta (exit 98) si detecta una credencial
 *      viva. Es el que atrapa la red TRANSITIVA: un gate que parece limpio pero importa un módulo que llama al
 *      gateway. El scan clasifica; el candado garantiza.
 *
 * POR QUÉ EL TRIPLE CANDADO: el scan estático solo ve el archivo del gate, no su árbol de imports. Confiar solo en
 * él fue exactamente el error que costó créditos la primera vez ("no hay OPENAI_API_KEY local, entonces no gasta"
 * — falso: el gateway desplegado tiene la key server-side). Y limpiar el entorno solo tampoco alcanza: 41 de los
 * 140 gates de la raíz SE AUTOCARGAN el `.env` del disco en su primera línea, así que se re-hidratan la credencial
 * ellos mismos — por eso el candado de runtime además rechaza la escritura y sirve `.env` sin credenciales. Un
 * gate mal clasificado acá no gasta nada: muere en el candado.
 *
 * SALIDA · exit 0 solo si TODOS los offline pasaron y NINGUNO tocó la red.
 *   exit 1  → algún gate offline falló (fallo real de producto)
 *   exit 2  → algún gate clasificado offline INTENTÓ salir a la red (clasificación mal hecha — hay que arreglarla)
 *   exit 3  → el entorno limpio NO quedó limpio: se aborta antes de correr nada (nunca debería pasar)
 *   exit 98 (de un hijo) → el candado detectó una credencial viva dentro del proceso
 */
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { limpiarEntorno, credencialesVisibles } from "./provider-keys.mjs";
import { clasificarGates } from "./clasificarGates.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// `--import` exige un ESPECIFICADOR, no una ruta: en Windows `C:\...\guard.mjs` NO es una URL válida y Node sale
// con error antes de correr el gate (se veía como "todos los gates fallan en 0.1s"). pathToFileURL lo resuelve.
const GUARD = pathToFileURL(join(ROOT, "scripts", "offline-guard.mjs")).href;

// ── EL ENTORNO QUE VIAJA A LOS HIJOS · sin una sola credencial de proveedor.
const { env: ENV_LIMPIO, barridas: BARRIDAS } = limpiarEntorno(process.env);

// ── LA CLASIFICACIÓN (candado 1) vive en scripts/clasificarGates.mjs — extraída SIN CAMBIAR UNA COMA
// (owner 2026-09-01: «siempre que no cambie su conducta») para que el candado de gates ausentes
// (`_gates_en_la_corrida_gate.mjs`) consulte LA MISMA clasificación en vez de copiarla. Los marcadores de red,
// los dos escapes (@inspeccion-estatica · @inyeccion-simulada) y sus condiciones están ahí, con sus porqués.
const { archivos, offline, live } = clasificarGates(ROOT);

function runOne(file) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const p = spawn(process.execPath, ["--import", GUARD, file], { cwd: ROOT, stdio: "inherit", env: ENV_LIMPIO });
    p.on("close", (code) => resolve({ file, code, ms: Date.now() - t0 }));
    p.on("error", () => resolve({ file, code: 1, ms: Date.now() - t0 }));
  });
}

console.log(`── npm run gates:offline · ${archivos.length} gates en la raíz → ${offline.length} OFFLINE · ${live.length} LIVE (no se corren) ──`);
console.log(`   red bloqueada por scripts/offline-guard.mjs · cualquier intento mata el gate con exit 97`);
console.log(`   entorno de los hijos SIN credenciales · ${BARRIDAS.length} variable(s) barrida(s)${BARRIDAS.length ? ": " + BARRIDAS.join(", ") : ""}\n`);

// El entorno limpio se comprueba, no se declara: si quedó una credencial adentro, no se corre nada.
const _fuga = credencialesVisibles(ENV_LIMPIO);
if (_fuga.length) {
  console.error(`\n✗ EL ENTORNO LIMPIO NO QUEDÓ LIMPIO · siguen adentro: ${_fuga.join(", ")}`);
  console.error(`  No se corre ningún gate: un hijo con credencial puede gastar. Arreglá scripts/provider-keys.mjs.`);
  process.exit(3);
}

const results = [];
for (const f of offline) {
  console.log(`\n▶ ${f}`);
  results.push(await runOne(f));
}

const red = results.filter((r) => r.code === 97);
const fuga = results.filter((r) => r.code === 98);
const fails = results.filter((r) => r.code !== 0 && r.code !== 97 && r.code !== 98);

console.log(`\n\n════ RESUMEN · npm run gates:offline ════`);
for (const r of results) console.log(`  ${r.code === 0 ? "✓" : r.code === 97 ? "⚡" : r.code === 98 ? "🔑" : "✗"} ${r.file} (${(r.ms / 1000).toFixed(1)}s)${r.code === 97 ? "  ← INTENTÓ SALIR A LA RED" : r.code === 98 ? "  ← CREDENCIAL VIVA EN EL PROCESO" : ""}`);

console.log(`\n── NO CORRIDOS · ${live.length} gates clasificados LIVE (hacen llamadas reales = pagadas) ──`);
for (const l of live) console.log(`  · ${l.file}  [${l.motivo}]`);
console.log(`   Para correrlos hace falta crédito real y autorización explícita: \`npm run gates\`.`);

console.log(`\n${results.length - fails.length - red.length - fuga.length} PASS · ${fails.length} FAIL · ${red.length} TOCARON LA RED · ${fuga.length} CON CREDENCIAL VIVA (de ${results.length} offline)`);
if (red.length) {
  console.log(`\n⚡ CLASIFICACIÓN MAL HECHA: los de arriba están en la lista offline pero salen a la red (probablemente`);
  console.log(`   por un import transitivo). Agregá su marcador a LIVE en este archivo. No gastaron nada: el candado`);
  console.log(`   los mató antes de abrir el socket.`);
}
if (fuga.length) {
  console.log(`\n🔑 FUGA DE CREDENCIAL: un hijo vio una credencial de proveedor viva. El barrido de este runner o el de`);
  console.log(`   scripts/provider-keys.mjs se quedó corto. No corras \`npm run gates\` hasta cerrarlo.`);
}
process.exit(red.length || fuga.length ? 2 : fails.length ? 1 : 0);
