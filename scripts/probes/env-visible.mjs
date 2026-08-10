/* sonda del cerrojo · ¿QUÉ CREDENCIALES VE este proceso? Recibe por argv los nombres que el gate envenenó en el
 * entorno del padre. Imprime una sola línea JSON:
 *   { visibles: [...],  directas: { NOMBRE: true|false },  nieto: [...] }
 * `directas` es la lectura cruda `process.env[NOMBRE]` (por si el barrido tapa la enumeración pero no el get).
 * `nieto` es lo que ve un proceso spawneado desde acá: si la credencial se propaga un nivel más, se propaga a todos. */
import { spawnSync } from "node:child_process";
import { credencialesVisibles } from "../provider-keys.mjs";

const nombres = process.argv.slice(2);
const directas = {};
for (const n of nombres) directas[n] = process.env[n] != null && process.env[n] !== "";

const r = spawnSync(process.execPath, ["-p", `JSON.stringify(${JSON.stringify(nombres)}.filter((n) => process.env[n] != null && process.env[n] !== ""))`], { encoding: "utf8" });
let nieto = ["<no se pudo medir>"];
try { nieto = JSON.parse(String(r.stdout).trim()); } catch { /* queda el marcador */ }

console.log(JSON.stringify({ visibles: credencialesVisibles(process.env), directas, nieto }));
