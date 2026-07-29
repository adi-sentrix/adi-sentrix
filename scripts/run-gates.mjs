/* === scripts/run-gates.mjs · `npm run gates` · corre la suite COMPLETA de gates del repo ===
 * owner "pase quirúrgico de confiabilidad" 2026-07-29, requisito 6: "agrega un `npm run gates` que ejecute la
 * suite completa". Un gate = cualquier archivo `_*_gate.mjs` en la raíz del repo — la convención YA establecida:
 * cada pieza de producto que se blindó dejó su propio gate permanente en disco (nunca se commitea el gate en sí,
 * ver convención de este repo). Este RUNNER sí se commitea (orquesta, no reemplaza ningún gate) — así "la suite
 * completa" no depende de que alguien recuerde la lista a mano; agregar un gate nuevo = que su nombre matchee
 * `_*_gate.mjs` y ya lo corre esta suite, sin tocar este archivo de nuevo.
 *
 * SECUENCIAL a propósito (no paralelo): varios gates llaman al LLM real — correr los 60+ a la vez satura rate
 * limits de forma impredecible según la máquina/proveedor. Esto es una corrida DE FONDO/CI, no un chequeo rápido:
 * varios gates individuales hacen cientos de llamadas reales — puede tardar bastante. Exit 1 si algo falló.
 *
 * PAUSA entre gates (hallazgo real corriendo la suite completa por primera vez, 2026-07-29): incluso SECUENCIAL,
 * 65 archivos con varios "SMOKE LLM REAL" cada uno agotan el rate limit real del proveedor (TPM) en tandas
 * seguidas — HTTP 429 en cascada, no un bug de ningún gate individual. Una pausa fija entre archivos (no una
 * espera larga, solo aire entre ráfagas) reduce el amontonamiento sin volver la corrida completa impráctica.
 * BEST-EFFORT, no una garantía dura: un gate que dispare cientos de llamadas SEGUIDAS puede seguir topando el
 * límite por sí solo — eso ya es harina de ESE gate, no de este runner.
 */
import { readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const gates = readdirSync(ROOT).filter((f) => /^_.*_gate\.mjs$/.test(f)).sort();
const PAUSE_MS = Number(process.env.GATES_PAUSE_MS) || 5000;

function runOne(file) {
  return new Promise((resolve) => {
    const start = Date.now();
    const p = spawn(process.execPath, [file], { cwd: ROOT, stdio: "inherit" });
    p.on("close", (code) => resolve({ file, code, ms: Date.now() - start }));
    p.on("error", () => resolve({ file, code: 1, ms: Date.now() - start }));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`── npm run gates · ${gates.length} archivos _*_gate.mjs en la raíz (pausa ${PAUSE_MS}ms entre cada uno) ──`);
const results = [];
for (const file of gates) {
  console.log(`\n▶ ${file}`);
  results.push(await runOne(file));
  if (PAUSE_MS > 0) await sleep(PAUSE_MS);
}

const fails = results.filter((r) => r.code !== 0);
console.log(`\n\n════ RESUMEN · npm run gates ════`);
for (const r of results) console.log(`  ${r.code === 0 ? "✓" : "✗"} ${r.file} (${(r.ms / 1000).toFixed(1)}s)`);
console.log(`\n${results.length - fails.length} PASS · ${fails.length} FAIL (de ${results.length})`);
process.exit(fails.length ? 1 : 0);
