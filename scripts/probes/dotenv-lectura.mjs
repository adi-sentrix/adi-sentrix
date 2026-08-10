/* sonda del cerrojo · ¿SE PUEDE SACAR LA CREDENCIAL DEL DISCO? Lee el archivo que le pasan por argv por los tres
 * caminos que usa este repo (readFileSync con encoding, readFileSync a Buffer, fs.promises.readFile) y reporta,
 * para cada uno, qué VARIABLES quedaron declaradas en el texto servido. Bajo el candado, ninguna credencial.
 * Imprime una línea JSON: { sync: [...], buffer: [...], promesa: [...] } — solo NOMBRES, nunca valores. */
import fs from "node:fs";

const ruta = process.argv[2];
const nombresDe = (texto) =>
  String(texto).split(/\r?\n/)
    .map((l) => (l.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/) || [])[1])
    .filter(Boolean);

const sync = nombresDe(fs.readFileSync(ruta, "utf8"));
const buffer = nombresDe(fs.readFileSync(ruta).toString("utf8"));
const promesa = nombresDe((await fs.promises.readFile(ruta)).toString("utf8"));

console.log(JSON.stringify({ sync, buffer, promesa }));
