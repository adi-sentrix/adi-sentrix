/* === scripts/guion-continuidad-hijo.mjs · EL «DESPUÉS» DEL REINICIO REAL (Etapa 2, bloque 1) ═══════════════════════
 * Lo lanza `_guardado_durable_gate.mjs` como un PROCESO NUEVO de Node (otro pid, ninguna variable ni módulo en
 * común con el que corrió la primera mitad del guion): carga el estado del doble de la base desde un archivo y corre
 * SOLO la fase «después» (retomar + conocerEmpresa + huellas). Lo único que sobrevivió al reinicio es lo que está en
 * el archivo — es decir, la base. Escribe su resultado como JSON en `--salida`. Cero red (se lanza con el candado de
 * red heredado de quien lo invoca).
 *   uso: node --import ./scripts/offline-guard.mjs scripts/guion-continuidad-hijo.mjs --estado=<f> --antes=<f> --salida=<f> */
import { readFileSync, writeFileSync } from "node:fs";
import { faseDespues } from "./guion-continuidad.mjs";
import { armarEntornoDoble, EMPRESAS_DEL_GUION } from "./guion-continuidad-doble.mjs";

const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const ESTADO = arg("estado"), ANTES = arg("antes"), SALIDA = arg("salida");
if (!ESTADO || !ANTES || !SALIDA) { console.error("faltan --estado, --antes o --salida"); process.exit(2); }

const ent = await armarEntornoDoble({ estadoJson: readFileSync(ESTADO, "utf8") });
const antes = JSON.parse(readFileSync(ANTES, "utf8"));
const despues = await faseDespues({ llamar: ent.llamar, empresas: EMPRESAS_DEL_GUION, antes, leerHuellas: ent.leerHuellas });
writeFileSync(SALIDA, JSON.stringify({ pid: process.pid, despues }));
