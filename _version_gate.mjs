/* === _version_gate.mjs · EL CANDADO DEL VERSIONADO (owner 2026-08-16) =========================================
 * POR QUÉ EXISTE. El esquema de versiones ya se intentó una vez y se abandonó: `v1.0-demo-privada` quedó 533
 * commits atrás de su propio producto, y preguntarle a producción qué versión corría devolvía un código de
 * commit. No falló la idea — falló la disciplina de ponerle número a cada despliegue.
 *
 * LA REGLA DEL OWNER, textual: «cada vez que diga "deployalo", el deploy debe salir con número de versión, tag
 * en repo, /api/version actualizado y nota corta». Este gate hace que esa regla no dependa de acordarse:
 *   1. el número declarado tiene FORMA de versión (N.M) y el desplegado también;
 *   2. el número declarado TIENE SU NOTA escrita en `_VERSIONES.md` — subir el número sin escribir qué trae
 *      pone el gate en rojo, que es exactamente lo que faltó la vez pasada;
 *   3. la versión DESPLEGADA también tiene su nota, y no va por delante de la declarada;
 *   4. `/api/version` sirve el número desde la ÚNICA fuente, no desde un literal suyo — dos literales divergen;
 *   5. no hay dos notas para el mismo número.
 *
 * LO QUE NO VERIFICA, y se declara: que el tag exista en el repo. El tag se crea EN EL DEPLOY, así que exigirlo
 * mientras la versión está en `dev` pondría el gate rojo por hacer las cosas bien. El tag se comprueba a mano
 * contra `git tag` en el momento del deploy, junto con la nota.
 *
 * OFFLINE · CERO GASTO: lee dos archivos del repo y nada más. */
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import { ADI_VERSION, ADI_VERSION_DESPLEGADA } from "./src/config/version.js";

const root = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};

const notas = fs.readFileSync(path.join(root, "_VERSIONES.md"), "utf8");
const apiSrc = fs.readFileSync(path.join(root, "api", "version.js"), "utf8");
const FORMATO = /^\d+\.\d+$/;
const _tieneNota = (v) => new RegExp(`^##\\s+${v.replace(".", "\\.")}\\s`, "m").test(notas);

console.log("═".repeat(100));
console.log("EL VERSIONADO · número · nota · fuente única");
console.log("═".repeat(100));

ok(FORMATO.test(ADI_VERSION), `la versión declarada tiene forma de versión: «${ADI_VERSION}»`);
ok(FORMATO.test(ADI_VERSION_DESPLEGADA), `y la desplegada también: «${ADI_VERSION_DESPLEGADA}»`);

ok(_tieneNota(ADI_VERSION), `la versión declarada ${ADI_VERSION} TIENE su nota en _VERSIONES.md`,
  "subir el número sin escribir qué trae es lo que hizo que el esquema anterior se abandonara");
ok(_tieneNota(ADI_VERSION_DESPLEGADA), `la versión desplegada ${ADI_VERSION_DESPLEGADA} también tiene su nota`);

// la desplegada no puede ir POR DELANTE de la declarada: sería decir que producción tiene algo que la rama no
const _num = (v) => v.split(".").map(Number);
const [dM, dm] = _num(ADI_VERSION), [pM, pm] = _num(ADI_VERSION_DESPLEGADA);
ok(pM < dM || (pM === dM && pm <= dm),
  `la desplegada (${ADI_VERSION_DESPLEGADA}) no va por delante de la declarada (${ADI_VERSION})`);

// UNA SOLA FUENTE: el endpoint importa el número, no lo escribe. Dos literales divergen — es la regla de la casa.
ok(/import\s*\{[^}]*ADI_VERSION[^}]*\}\s*from\s*"\.\.\/src\/config\/version\.js"/.test(apiSrc),
  "/api/version importa el número de la fuente única");
ok(/version:\s*ADI_VERSION\b/.test(apiSrc), "…y lo sirve desde ahí, sin escribir un segundo literal");
ok(!/version:\s*["'`]\d+\.\d+["'`]/.test(apiSrc), "…y no hay ningún número de versión escrito a mano en el endpoint");

// una nota por número, sin duplicados
const declaradas = [...notas.matchAll(/^##\s+(\d+\.\d+)\s/gm)].map((m) => m[1]);
ok(declaradas.length === new Set(declaradas).size,
  `no hay dos notas para el mismo número (${declaradas.join(" · ") || "ninguna"})`);
ok(declaradas.length >= 1, "hay al menos una versión con nota escrita");

// la línea legacy no puede volver a llamarse 1.0: era el defecto que el owner pidió cerrar
ok(!/v1\.0-demo-privada`?\s*—\s*\*legacy/i.test(notas) || /v0\.1-demo-privada/.test(notas),
  "la demo vieja quedó como v0.1, no como un segundo «1.0»");

console.log(`\n── _version_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
