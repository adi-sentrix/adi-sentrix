/* scripts/aplicar-migracion-staging.mjs · aplica UNA migración en la base de STAGING, y en ninguna otra.
 *
 * Uso (cwd = raíz del repo):
 *   node scripts/aplicar-migracion-staging.mjs db/migraciones/015_memoria_empresa_y_conversacion.sql --ensayo
 *   node scripts/aplicar-migracion-staging.mjs db/migraciones/015_memoria_empresa_y_conversacion.sql --aplicar
 *
 * CANDADOS (owner 2026-10-03, «nunca tocar producción»):
 *   1. La cadena de conexión sale SOLO de `.env.staging-db` (fuera del repo), nunca del `.env` ni del entorno.
 *   2. Debe contener el código del proyecto de staging; si no, el script se niega antes de conectar.
 *   3. Ya conectado, comprueba la identidad de la base: las empresas deben ser exactamente las de staging (demo y prueba);
 *      si aparece cualquier otra, se niega (la base de producción tiene otras empresas).
 *   4. La migración corre en UNA transacción. `--ensayo` la ejecuta entera y la DESHACE al final (prueba sin cambios);
 *      `--aplicar` la confirma. Sin uno de los dos, no corre.
 *   5. Nunca imprime la cadena de conexión ni la contraseña.
 * No es un gate: sale a la red (a la base de staging) y por eso no está en `gates:offline`. No llama a ningún LLM. */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const STAGING_REF = "krngsfvtxchqhjwlkvve";
const EMPRESAS_DE_STAGING = ["demo", "prueba"];
const raiz = process.cwd();
const [archivo, modo] = process.argv.slice(2);
const fallar = (m) => { console.error(`✗ ${m}`); process.exit(1); };

if (!archivo || !["--ensayo", "--aplicar"].includes(modo)) fallar("uso: node scripts/aplicar-migracion-staging.mjs <db/migraciones/NNN_x.sql> --ensayo|--aplicar");
const ruta = path.resolve(raiz, archivo);
if (!ruta.startsWith(path.resolve(raiz, "db/migraciones") + path.sep) || !/^\d{3}_.*\.sql$/.test(path.basename(ruta))) fallar("solo se aplican archivos de db/migraciones/NNN_*.sql");
if (!fs.existsSync(ruta)) fallar(`no existe ${archivo}`);

const envPath = path.resolve(raiz, ".env.staging-db");
if (!fs.existsSync(envPath)) fallar("falta .env.staging-db");
const linea = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find((l) => l.startsWith("STAGING_DB_URL="));
const url = linea ? linea.slice("STAGING_DB_URL=".length).trim().replace(/^"|"$/g, "") : "";
if (!url) fallar("STAGING_DB_URL está vacío en .env.staging-db");
if (!url.includes(STAGING_REF)) fallar(`la cadena de conexión NO es del proyecto de staging (${STAGING_REF}). No se conecta.`);
if (/\[YOUR-PASSWORD\]|YOUR-PASSWORD/i.test(url)) fallar("la cadena todavía tiene el marcador [YOUR-PASSWORD]: reemplázalo por la contraseña");

const sql = fs.readFileSync(ruta, "utf8");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 120000 });
await client.connect().catch((e) => fallar(`no se pudo conectar: ${e.message.replace(/postgres(ql)?:\/\/[^\s]+/g, "<conexión>")}`));
try {
  const { rows } = await client.query("select id from public.tenants order by id");
  const ids = rows.map((r) => r.id);
  const ajenas = ids.filter((id) => !EMPRESAS_DE_STAGING.includes(id));
  console.log(`base: ${STAGING_REF} · empresas: ${ids.join(", ") || "(ninguna)"}`);
  if (ajenas.length) fallar(`hay empresas que no son de staging (${ajenas.join(", ")}). ¿Es producción? No se aplica nada.`);
  if (EMPRESAS_DE_STAGING.some((id) => !ids.includes(id))) fallar(`faltan empresas de staging (se esperan exactamente: ${EMPRESAS_DE_STAGING.join(", ")}). No se aplica nada.`);
  console.log(`${modo === "--ensayo" ? "ENSAYO (se deshace al final)" : "APLICAR"} · ${path.basename(ruta)} · ${sql.split(/\r?\n/).length} líneas`);
  await client.query("begin");
  try {
    await client.query(sql);
  } catch (e) {
    await client.query("rollback");
    fallar(`la migración falló y se deshizo entera · ${e.code || ""} ${e.message}${e.where ? ` · ${String(e.where).split("\n")[0]}` : ""}`);
  }
  if (modo === "--ensayo") { await client.query("rollback"); console.log("✓ ENSAYO OK: la migración corre entera sin errores. Se deshizo; la base queda igual."); }
  else { await client.query("commit"); console.log("✓ APLICADA y confirmada."); }
} finally {
  await client.end();
}
