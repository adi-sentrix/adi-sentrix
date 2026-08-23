/* === scripts/leer-plantilla.mjs · PROBAR UNA PLANTILLA LLENA, SIN UI Y SIN RED (v1 · 2026-08-23) ===
 *
 * Cierra el circuito de la vía 2 antes de que exista pantalla: bajar la plantilla → llenarla → ver EXACTAMENTE
 * lo que vería el usuario al subirla. Sin esto, la plantilla solo se puede probar desde los gates, que corren
 * contra el ejemplo sintético; el día que alguien la llene distinto no hay forma de mirarlo sin escribir código.
 *
 *   node scripts/leer-plantilla.mjs <archivo.xlsx|csv> [--dataset salida.json]
 *
 * Sale 1 si el archivo quedó bloqueado, para que se pueda encadenar. Lee del disco y nada más: sin red, sin
 * credenciales, sin modelo. El archivo que se le pase es del usuario y no se copia a ningún lado.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { ingestarPlantilla, previewPlantillaEnTexto } from "../src/ingesta/plantilla/ingestarPlantilla.js";

const args = process.argv.slice(2);
const ruta = args.find((a) => !a.startsWith("--"));
const iDs = args.indexOf("--dataset");
const salida = iDs >= 0 ? args[iDs + 1] : null;

if (!ruta) {
  console.error("uso: node scripts/leer-plantilla.mjs <archivo.xlsx|csv> [--dataset salida.json]");
  process.exit(2);
}

let bytes;
try { bytes = readFileSync(ruta); }
catch (e) { console.error(`✗ no pude abrir "${ruta}": ${e.code === "ENOENT" ? "no existe" : e.message}`); process.exit(2); }

const { ok, dataset, preview } = ingestarPlantilla(bytes, { nombreArchivo: basename(ruta) });
console.log(previewPlantillaEnTexto(preview));

if (ok && salida) {
  writeFileSync(salida, JSON.stringify(dataset, null, 2));
  console.log(`\n→ dataset escrito en ${salida}`);
}
process.exit(ok ? 0 : 1);
