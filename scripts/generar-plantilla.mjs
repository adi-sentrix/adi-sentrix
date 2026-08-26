/* === scripts/generar-plantilla.mjs · escribe la plantilla oficial y su ejemplo (v0 · 2026-08-22) ===
 * Los dos archivos se GENERAN del contrato (config/contract/plantilla.js). No se versionan: un .xlsx
 * guardado a mano se desincroniza del validador en la primera semana y el cliente termina llenando un
 * archivo que el sistema rechaza. Determinístico · sin red · sin dependencias.
 *   node scripts/generar-plantilla.mjs [carpeta]
 */
import { writeFileSync } from "node:fs";
import { plantillaVacia, plantillaEjemplo } from "../src/ingesta/plantilla/generarPlantilla.js";
import { PLANTILLA_VERSION } from "../src/config/contract/plantilla.js";

const dir = process.argv[2] || ".";
const uno = `${dir}/Plantilla_ADI_${PLANTILLA_VERSION}.xlsx`;
const dos = `${dir}/Plantilla_ADI_${PLANTILLA_VERSION}_ejemplo.xlsx`;
const a = plantillaVacia(), b = plantillaEjemplo();
writeFileSync(uno, a); writeFileSync(dos, b);
console.log(`✅ ${uno}          ${(a.length / 1024).toFixed(1)} KB · vacía, lista para llenar`);
console.log(`✅ ${dos}   ${(b.length / 1024).toFixed(1)} KB · con datos sintéticos que cubren todos los casos`);
