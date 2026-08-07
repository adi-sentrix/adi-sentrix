/* === scripts/gates-offline.mjs · `npm run gates:offline` (owner 2026-08-07) ==========================
 * La suite DETERMINÍSTICA: corre solo los gates que no tocan la red, con la red FÍSICAMENTE bloqueada.
 * Cero llamadas al gateway, cero llamadas al proveedor, cero créditos. Es el runner que hay que usar bajo una
 * instrucción de "no gastes créditos" — `npm run gates` NO sirve para eso (ver el aviso de su propio archivo).
 *
 * DOS CANDADOS, no uno:
 *   1. ESTÁTICO (acá) · cada `_*_gate.mjs` se lee y se clasifica LIVE si menciona un marcador de red. Los LIVE
 *      NO SE CORREN — se listan explícitamente al final. Nada se omite en silencio: si un gate queda afuera, el
 *      reporte dice cuál y por qué marcador.
 *   2. DE RUNTIME (scripts/offline-guard.mjs) · los que SÍ se corren van con `--import` del candado, que mata el
 *      proceso (exit 97) ante cualquier fetch/http/https/net/dns. Es el que atrapa la red TRANSITIVA: un gate que
 *      parece limpio pero importa un módulo que llama al gateway. El scan clasifica; el candado garantiza.
 *
 * POR QUÉ EL DOBLE CANDADO: el scan estático solo ve el archivo del gate, no su árbol de imports. Confiar solo en
 * él fue exactamente el error que costó créditos ("no hay OPENAI_API_KEY local, entonces no gasta" — falso: el
 * gateway desplegado tiene la key server-side). Un gate mal clasificado acá no gasta nada: muere en el candado.
 *
 * SALIDA · exit 0 solo si TODOS los offline pasaron y NINGUNO tocó la red.
 *   exit 1  → algún gate offline falló (fallo real de producto)
 *   exit 2  → algún gate clasificado offline INTENTÓ salir a la red (clasificación mal hecha — hay que arreglarla)
 */
import { readdirSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// `--import` exige un ESPECIFICADOR, no una ruta: en Windows `C:\...\guard.mjs` NO es una URL válida y Node sale
// con error antes de correr el gate (se veía como "todos los gates fallan en 0.1s"). pathToFileURL lo resuelve.
const GUARD = pathToFileURL(join(ROOT, "scripts", "offline-guard.mjs")).href;

// ── marcadores de red. Cada uno es una forma REAL de salir a internet desde un gate de este repo.
// `handlePlan`/`handleNarrateC` son funciones LOCALES del gateway, pero las dos terminan llamando al proveedor:
// mencionarlas es señal suficiente de que el gate es live. El candado de runtime igual las atraparía.
const LIVE = [
  [/\bfetch\s*\(/, "fetch("],
  [/\bhandlePlan\b/, "handlePlan"],
  [/\bhandleNarrateC\b/, "handleNarrateC"],
  [/\bhandleNarrate\b/, "handleNarrate"],
  [/gatewayCore/, "gatewayCore"],
  [/\/api\/adi-(plan|narrate)/, "endpoint /api/adi-*"],
  [/adiai\.cl|vercel\.app/, "dominio desplegado"],
  [/api\.openai\.com|OPENAI_API_KEY/, "proveedor/credencial"],
  [/node:https|node:http\b|require\(["']https?["']\)/, "cliente http crudo"],
  [/callPlan|callNarrate/, "callPlan/callNarrate (inyección del oráculo)"],
];

const archivos = readdirSync(ROOT).filter((f) => /^_.*_gate\.mjs$/.test(f)).sort();
const offline = [], live = [];
for (const f of archivos) {
  let src = "";
  try { src = readFileSync(join(ROOT, f), "utf8"); } catch { /* ilegible → tratarlo como live, nunca correrlo a ciegas */ live.push({ file: f, motivo: "no se pudo leer" }); continue; }
  const hit = LIVE.find(([re]) => re.test(src));
  if (hit) live.push({ file: f, motivo: hit[1] });
  else offline.push(f);
}

function runOne(file) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const p = spawn(process.execPath, ["--import", GUARD, file], { cwd: ROOT, stdio: "inherit" });
    p.on("close", (code) => resolve({ file, code, ms: Date.now() - t0 }));
    p.on("error", () => resolve({ file, code: 1, ms: Date.now() - t0 }));
  });
}

console.log(`── npm run gates:offline · ${archivos.length} gates en la raíz → ${offline.length} OFFLINE · ${live.length} LIVE (no se corren) ──`);
console.log(`   red bloqueada por scripts/offline-guard.mjs · cualquier intento mata el gate con exit 97\n`);

const results = [];
for (const f of offline) {
  console.log(`\n▶ ${f}`);
  results.push(await runOne(f));
}

const red = results.filter((r) => r.code === 97);
const fails = results.filter((r) => r.code !== 0 && r.code !== 97);

console.log(`\n\n════ RESUMEN · npm run gates:offline ════`);
for (const r of results) console.log(`  ${r.code === 0 ? "✓" : r.code === 97 ? "⚡" : "✗"} ${r.file} (${(r.ms / 1000).toFixed(1)}s)${r.code === 97 ? "  ← INTENTÓ SALIR A LA RED" : ""}`);

console.log(`\n── NO CORRIDOS · ${live.length} gates clasificados LIVE (hacen llamadas reales = pagadas) ──`);
for (const l of live) console.log(`  · ${l.file}  [${l.motivo}]`);
console.log(`   Para correrlos hace falta crédito real y autorización explícita: \`npm run gates\`.`);

console.log(`\n${results.length - fails.length - red.length} PASS · ${fails.length} FAIL · ${red.length} TOCARON LA RED (de ${results.length} offline)`);
if (red.length) {
  console.log(`\n⚡ CLASIFICACIÓN MAL HECHA: los de arriba están en la lista offline pero salen a la red (probablemente`);
  console.log(`   por un import transitivo). Agregá su marcador a LIVE en este archivo. No gastaron nada: el candado`);
  console.log(`   los mató antes de abrir el socket.`);
}
process.exit(red.length ? 2 : fails.length ? 1 : 0);
