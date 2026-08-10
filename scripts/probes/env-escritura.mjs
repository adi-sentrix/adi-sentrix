/* sonda del cerrojo · REPRODUCE EL MECANISMO DEL INCIDENTE. 41 gates de la raíz arrancan con un auto-cargador que
 * parsea `.env` y escribe cada variable en `process.env`. Esta sonda hace exactamente eso —escribe credenciales a
 * mano en `process.env`— y reporta si quedaron escritas y si un proceso hijo las hereda. Bajo el candado las dos
 * respuestas tienen que ser "no": el Proxy de `process.env` rechaza la escritura en silencio.
 * Imprime una línea JSON: { escritas: {NOMBRE: true|false}, visibles: [...], nieto: [...] } */
import { spawnSync } from "node:child_process";
import { credencialesVisibles } from "../provider-keys.mjs";

const nombres = process.argv.slice(2);
const escritas = {};
for (const n of nombres) {
  process.env[n] = "sk-INYECTADA-POR-LA-SONDA";                    // esto es lo que hace el auto-cargador de .env
  escritas[n] = process.env[n] != null && process.env[n] !== "";
}

const r = spawnSync(process.execPath, ["-p", `JSON.stringify(${JSON.stringify(nombres)}.filter((n) => process.env[n] != null && process.env[n] !== ""))`], { encoding: "utf8" });
let nieto = ["<no se pudo medir>"];
try { nieto = JSON.parse(String(r.stdout).trim()); } catch { /* queda el marcador */ }

console.log(JSON.stringify({ escritas, visibles: credencialesVisibles(process.env), nieto }));
