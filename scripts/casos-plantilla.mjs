/* === scripts/casos-plantilla.mjs · escribe los tres casos de prueba (v1 · 2026-08-23) ===
 * Se GENERAN del contrato, igual que la plantilla: un .xlsx guardado a mano se desincroniza.
 *   node scripts/casos-plantilla.mjs [carpeta]
 * Después, cada uno se mira con:  npm run plantilla:leer -- <archivo>
 */
import { writeFileSync } from "node:fs";
import { CASOS } from "../src/ingesta/plantilla/casosPrueba.js";

const dir = process.argv[2] || ".";
for (const c of CASOS) {
  const bytes = c.construir();
  const ruta = `${dir}/${c.archivo}`;
  writeFileSync(ruta, bytes);
  console.log(`✅ ${ruta.padEnd(52)} ${(bytes.length / 1024).toFixed(1).padStart(5)} KB · ${c.titulo}`);
  console.log(`   ${c.que}`);
}
