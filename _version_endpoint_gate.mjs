/* === _version_endpoint_gate.mjs · EL ENDPOINT DE VERSIÓN (owner 2026-08-12) ===========================
 * @inspeccion-estatica — lee `api/version.js` como texto además de ejecutarlo. No importa el gateway, no
 * invoca a nadie y no sale a la red; el candado de runtime se le aplica igual que a todos.
 *
 * Nació porque no había forma de saber qué commit corre en producción del lado server. Este gate cuida las
 * dos cosas que lo hacen confiable: que responda EXACTAMENTE la metadata acordada, y que NO pueda gastar.
 *   [1] LA FORMA · los siete campos del owner, ni uno más.
 *   [2] NO PUEDE GASTAR · sin gateway, sin proveedor, sin fetch. Es estructural, no una promesa.
 *   [3] SIN DATOS DEL CLIENTE · ni tenant, ni negocio, ni motor.
 *   [4] SIN HORA FALSA · la hora de la request NO es la del despliegue, y no se publica como si lo fuera.
 *   [5] SIN CACHÉ · una respuesta cacheada declararía el commit anterior: el engaño que vino a evitar.
 *   [6] AGUANTA SIN ENTORNO · sin variables de Vercel responde `null`, no rompe ni inventa.
 * Cero red, cero LLM. `npm run gates:offline`
 */
import { readFileSync } from "fs";
import handler, { config } from "./api/version.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
// Se escanea el CÓDIGO, no los comentarios: el encabezado del endpoint nombra `gatewayFetch` y `new Date()`
// justamente para explicar que NO los usa, y un barrido ingenuo lee esa explicación como si fuera el defecto.
const _CRUDO = readFileSync("./api/version.js", "utf8");
const SRC = _CRUDO.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leer = async () => JSON.parse(await handler().text());

H("[1] LA FORMA · los siete campos acordados, ni uno más");
{
  const b = await leer();
  const esperados = ["ok", "service", "version", "commit", "branch", "env", "profile", "deploymentId"];
  for (const k of esperados) ok(k in b, `devuelve \`${k}\``);
  ok(Object.keys(b).length === esperados.length, `y NADA más — ${Object.keys(b).join(", ")}`);
  ok(b.ok === true && b.service === "adi", `ok=true · service="adi" — ${b.ok}/${b.service}`);
  ok(b.profile === "prod" || typeof b.profile === "string", `profile cae a "prod" cuando no hay variable — ${b.profile}`);
  ok(config && config.runtime === "edge", "declara runtime edge, igual que los otros endpoints");
}

H("[2] NO PUEDE GASTAR · es estructural, no una promesa");
{
  ok(!/gatewayFetch|gatewayCore|handlePlan|handleNarrate/.test(SRC), "no importa nada del gateway");
  ok(!/\bfetch\s*\(|node:https?|axios|undici/.test(SRC), "no sale a la red por ningún camino");
  ok(!/openai|anthropic|adapter/i.test(SRC), "no conoce ningún proveedor");
  /* UN SOLO IMPORT PERMITIDO, y verificado hasta el fondo (owner 2026-08-16). La invariante real de este bloque
   * es «por acá no se cuela nada que pueda gastar», no «cero imports». El número de versión tiene que salir de
   * UNA fuente —dos literales divergen, es la regla de la casa— así que se permite importar
   * `src/config/version.js` Y SE COMPRUEBA que ese módulo sea hoja pura: si algún día importa algo, este gate se
   * pone rojo antes de que la dependencia llegue al endpoint. */
  const imports = SRC.match(/^\s*import\s[^\n]*/gm) || [];
  ok(imports.length <= 1, `a lo sumo UN import (${imports.length}): ${imports.join(" · ").slice(0, 120)}`);
  ok(imports.every((l) => /from\s*"\.\.\/src\/config\/version\.js"/.test(l)),
    "…y si lo hay, es SOLO la fuente única del número de versión");
  if (imports.length) {
    const verSrc = readFileSync(new URL("./src/config/version.js", import.meta.url), "utf8");
    ok(!/^\s*(import|require)\s/m.test(verSrc),
      "…y esa fuente no importa nada a su vez: la cadena termina ahí, no puede arrastrar al gateway");
  }
}

H("[3] SIN DATOS DEL CLIENTE");
{
  const b = await leer();
  const s = JSON.stringify(b);
  ok(!/tenant|cliente|sku|bodega|margen|venta/i.test(s), `la respuesta no trae nada del negocio — ${s}`);
  ok(!/TENANT|ADI_ADMIN_KEY|ADI_TOKEN_SECRET|API_KEY/.test(SRC), "no lee tenant ni ninguna credencial");
  ok(!/request|req\b/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, "")), "ni siquiera recibe la request: no puede leer cabeceras, cuerpo ni IP");
}

H("[4] SIN HORA FALSA · la hora de la request no es la del despliegue");
{
  ok(!/new Date\(|Date\.now\(/.test(SRC), "no publica una hora que no sea la real del despliegue");
  const b = await leer();
  ok(!("deployedAt" in b) && !("fecha" in b) && !("timestamp" in b), "y no hay campo de fecha que pueda leerse mal");
}

H("[5] SIN CACHÉ · una respuesta vieja declararía el commit anterior");
{
  const r = handler();
  ok(/no-store/.test(r.headers.get("Cache-Control") || ""), `Cache-Control no-store — "${r.headers.get("Cache-Control")}"`);
  ok(/application\/json/.test(r.headers.get("Content-Type") || ""), "responde JSON declarado");
  ok(r.status === 200, `status 200 — ${r.status}`);
}

H("[6] AGUANTA SIN ENTORNO · responde null, no rompe ni inventa");
{
  const guardados = {};
  for (const k of ["VERCEL_GIT_COMMIT_SHA", "VERCEL_GIT_COMMIT_REF", "VERCEL_ENV", "VERCEL_DEPLOYMENT_ID", "VITE_ADI_PROFILE"]) {
    guardados[k] = process.env[k]; delete process.env[k];
  }
  const vacio = await leer();
  ok(vacio.commit === null && vacio.branch === null && vacio.env === null && vacio.deploymentId === null,
    `sin variables, los cuatro campos son null — ${JSON.stringify({ c: vacio.commit, b: vacio.branch, e: vacio.env, d: vacio.deploymentId })}`);
  ok(vacio.ok === true && vacio.profile === "prod", "y el endpoint sigue respondiendo 200: no se cae en local");

  process.env.VERCEL_GIT_COMMIT_SHA = "89648e9aabbccddeeff00112233445566778899";
  const conSha = await leer();
  ok(conSha.commit === "89648e9", `el SHA se corta a 7 — ${conSha.commit}`);
  ok(conSha.commit.length === 7, "nunca sale el SHA completo");

  for (const [k, v] of Object.entries(guardados)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
}

console.log(`\n── ENDPOINT DE VERSIÓN · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
