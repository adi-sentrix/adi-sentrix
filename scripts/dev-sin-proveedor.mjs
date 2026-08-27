/* === scripts/dev-sin-proveedor.mjs · LA APP EN VIVO, SIN POSIBILIDAD DE GASTAR ========================
 *
 * PARA QUÉ. Probar el camino real de la carga —subir, ver la preview, confirmar, recargar— contra Supabase
 * de verdad. Eso exige levantar la app con las variables reales de la base… y el `.env` de la raíz también
 * tiene la credencial del proveedor. Un click desafortunado en el chat, con esa credencial en el proceso,
 * gasta dinero real.
 *
 * ⚠️ POR ESO ESTE ARRANQUE NO PIDE CUIDADO: LO HACE IMPOSIBLE. Es la regla de la casa aplicada a sí misma —
 * «impedir el consumo técnicamente, no por instrucción». Una regla escrita no frena un gasto; un cerrojo sí.
 *
 * QUÉ SACA: toda credencial de proveedor, por nombre o por forma del valor (`scripts/provider-keys.mjs` es
 * quien sabe reconocerlas). Sin ellas el gateway no puede llamar a nadie, aunque el código lo intente.
 *
 * QUÉ DEJA: las tres de Supabase, que no son credenciales de proveedor y son justamente lo que hay que probar.
 *
 * QUÉ INVENTA: `ADI_TOKEN_SECRET` con un valor de PRUEBA, local y descartable. Hace falta armado —sin puerta
 * la sesión cae al demo y la carga no se guarda, que es la regla de `persistirCarga`— pero el secreto real no
 * tiene por qué entrar acá. Los códigos que se emitan con este valor no sirven en ningún otro lado.
 *
 * IMPRIME LOS NOMBRES DE LO QUE SACÓ Y LO QUE DEJÓ, nunca los valores: la afirmación «no puede gastar» tiene
 * que poder comprobarse mirando, no creyéndole a este comentario.
 *
 * CÓMO SE CORRE:  npm run build  &&  node scripts/dev-sin-proveedor.mjs
 */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { esCredencial } from "./provider-keys.mjs";

/** El secreto de la puerta para esta sesión de prueba. Local, descartable y a la vista a propósito.
 *  Se exporta para que quien emita un código de prueba use ESTE valor y no una copia que pueda divergir. */
export const SECRETO_DE_PRUEBA = "adi-prueba-local-no-sirve-en-produccion";

/* ⚠️ NADA DE LO DE ABAJO CORRE AL IMPORTAR ESTE ARCHIVO. Sin esta guarda, pedirle la constante de arriba
 * LEVANTABA UN SERVIDOR — pasó de verdad y colgó el proceso que solo quería emitir un código. Un módulo con
 * efectos al importarse es una mina: el que lo pisa no estaba haciendo nada raro. */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) arrancar();

function arrancar() {
const env = { ...process.env };

// el `.env` de la raíz, para tomar las de Supabase
try {
  for (const ln of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* sin .env */ }

// ── EL CERROJO ────────────────────────────────────────────────────────────────────────────────────────
const fuera = [];
for (const [k, v] of Object.entries(env)) {
  if (k.startsWith("SUPABASE_")) continue;              // lo que venimos a probar
  if (esCredencial(k, v)) { delete env[k]; fuera.push(k); }
}
env.ADI_TOKEN_SECRET = SECRETO_DE_PRUEBA;               // la puerta, con un secreto de mentira
delete env.LLM_PROVIDER;                                // sin proveedor declarado el gateway no elige por su cuenta

const dentro = Object.keys(env).filter((k) => k.startsWith("SUPABASE_"));

console.log("\n════ ADI EN LOCAL · SIN CREDENCIAL DE PROVEEDOR ════");
console.log(`  fuera (${fuera.length}): ${fuera.join(" · ") || "ninguna"}`);
console.log(`  dentro: ${dentro.join(" · ") || "ninguna variable de Supabase — la carga NO va a guardar"}`);
console.log(`  la puerta usa un secreto de prueba, no el real`);
console.log("");

spawn(process.execPath, ["server.js"], { env, stdio: "inherit" });
}
