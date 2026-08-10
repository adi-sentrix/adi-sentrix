/* === scripts/gates-offline.mjs · `npm run gates:offline` (owner 2026-08-07 · cerrojo 2026-08-09) ======
 * La suite DETERMINÍSTICA: corre solo los gates que no tocan la red, con la red FÍSICAMENTE bloqueada y SIN
 * ninguna credencial de proveedor en el entorno de los hijos. Cero llamadas al gateway, cero llamadas al
 * proveedor, cero créditos. Es el runner que hay que usar bajo una instrucción de "no gastes créditos" —
 * `npm run gates` NO sirve para eso (ver el aviso de su propio archivo).
 *
 * TRES CANDADOS, no uno:
 *   1. ESTÁTICO (acá) · cada `_*_gate.mjs` se lee y se clasifica LIVE si menciona un marcador de red. Los LIVE
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
import { readdirSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { limpiarEntorno, credencialesVisibles } from "./provider-keys.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// `--import` exige un ESPECIFICADOR, no una ruta: en Windows `C:\...\guard.mjs` NO es una URL válida y Node sale
// con error antes de correr el gate (se veía como "todos los gates fallan en 0.1s"). pathToFileURL lo resuelve.
const GUARD = pathToFileURL(join(ROOT, "scripts", "offline-guard.mjs")).href;

// ── EL ENTORNO QUE VIAJA A LOS HIJOS · sin una sola credencial de proveedor.
const { env: ENV_LIMPIO, barridas: BARRIDAS } = limpiarEntorno(process.env);

// ── marcadores de red. Cada uno es una forma REAL de salir a internet desde un gate de este repo.
// `handlePlan`/`handleNarrateC` son funciones LOCALES del gateway, pero las dos terminan llamando al proveedor:
// mencionarlas es señal suficiente de que el gate es live. El candado de runtime igual las atraparía.
const LIVE = [
  [/\bfetch\s*\(/, "fetch("],
  [/\bhandlePlan\b/, "handlePlan"],
  [/\bhandleNarrateC\b/, "handleNarrateC"],
  [/\bhandleNarrate\b/, "handleNarrate"],
  [/gatewayCore/, "gatewayCore"],
  // CUALQUIER endpoint del gateway, no solo plan/narrate (owner 2026-08-09): antes esto decía `adi-(plan|narrate)`
  // y dejaba pasar como offline a los gates que tocan `/api/adi-spec` y `/api/adi-access` — y `adi-spec` es
  // exactamente la ruta por la que la UI pide una lectura al LLM. Ver el reporte del cerrojo.
  [/\/api\/adi-[a-z0-9-]+/i, "endpoint /api/adi-*"],
  [/\bgatewayFetch\b|\bdevGateway\b/, "gateway (gatewayFetch/devGateway)"],
  [/adiai\.cl|vercel\.app/, "dominio desplegado"],
  [/api\.openai\.com|OPENAI_API_KEY/, "proveedor/credencial (OpenAI)"],
  [/api\.anthropic\.com|ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN/, "proveedor/credencial (Anthropic)"],
  [/\bopenaiAdapter\b|\banthropicAdapter\b|adapters\/(openai|anthropic)/, "adapter de proveedor"],
  [/node:https|node:http\b|require\(["']https?["']\)/, "cliente http crudo"],
  [/from\s+["'](node-fetch|axios|undici)["']|require\(["'](node-fetch|axios|undici)["']\)/, "cliente http de librería"],
  [/callPlan|callNarrate/, "callPlan/callNarrate (inyección del oráculo)"],
];

// NO es marcador: que un gate se autocargue el `.env`. 41 gates lo hacen y la mayoría son determinísticos —
// marcarlos LIVE perdería cobertura real sin ganar seguridad, porque el candado de runtime ya les sirve el `.env`
// sin credenciales y les rechaza la escritura. Se neutraliza, no se excluye.

const archivos = readdirSync(ROOT).filter((f) => /^_.*_gate\.mjs$/.test(f)).sort();
const offline = [], live = [];
for (const f of archivos) {
  let src = "";
  try { src = readFileSync(join(ROOT, f), "utf8"); } catch { /* ilegible → tratarlo como live, nunca correrlo a ciegas */ live.push({ file: f, motivo: "no se pudo leer" }); continue; }
  const hit = LIVE.find(([re]) => re.test(src));
  // INSPECCIÓN ESTÁTICA (owner 2026-08-10) · escape ESTRECHO y por archivo, nunca una relajación global del
  // clasificador. Un gate que LEE código fuente como texto (para certificar que el cableado existe) menciona
  // inevitablemente los símbolos del gateway y queda marcado LIVE — y un gate que no corre no certifica nada.
  // Las tres condiciones son acumulativas y se verifican acá, no se confía en la declaración:
  //   (a) declara el marcador en su cabecera,  (b) NO importa nada del gateway ni del adapter,
  //   (c) NO invoca a nadie: ni fetch, ni handlePlan/handleNarrateC, ni callPlan/callNarrate.
  // El candado de RUNTIME sigue aplicándose igual (--import offline-guard): si este escape se usara mal, el
  // proceso muere con exit 97 antes de tocar la red. Esto solo devuelve el gate a la suite; no lo desprotege.
  const declara = /@inspeccion-estatica/.test(src);
  const importaGateway = /^\s*import[^\n]*from\s+["'][^"']*(gatewayCore|providerAdapter|adapters\/)/m.test(src);
  const invoca = /\b(handlePlan|handleNarrateC|handleNarrate|callPlan|callNarrate)\s*\(/.test(src) || /\bfetch\s*\(/.test(src);
  if (hit && declara && !importaGateway && !invoca) { offline.push(f); continue; }
  if (hit) live.push({ file: f, motivo: hit[1] });
  else offline.push(f);
}

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
