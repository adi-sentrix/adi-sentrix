/* === _edge_bundle_gate.mjs · LO QUE CORRE EN EDGE TIENE QUE PODER EMPAQUETARSE PARA EDGE (2026-08-26) ========
 *
 * EL DEFECTO QUE ESTE GATE EXISTE PARA IMPEDIR, y es el más caro del proyecto hasta hoy porque no produjo ningún
 * síntoma local: al montar `/api/adi-ingesta` en `gatewayFetch`, los CINCO endpoints que corren en runtime EDGE
 * pasaron a importar —de forma transitiva— `node:zlib`, que el edge no puede empaquetar. Vercel falló el build
 * ENTERO en tres commits seguidos. Producción se quedó sirviendo la versión anterior.
 *
 * ⚠️ Y LOS 177 GATES ESTABAN VERDES. Ninguno empaquetaba para edge: `vite build` compila la APP, no las
 * funciones de `api/`, y el runtime de Node importa `node:zlib` sin chistar. Todo lo que se probaba pasaba; lo
 * único que fallaba era lo que nadie probaba. Un verde que no cubre el camino real es peor que un rojo.
 *
 * QUÉ HACE: empaqueta de verdad cada endpoint que declara `runtime: "edge"`, con las condiciones del edge, y
 * exige cero errores. No lee imports con una expresión regular —eso no ve las dependencias transitivas, que son
 * justo las que rompieron esto—: construye el grafo completo, igual que la plataforma.
 *
 * @inspeccion-estatica · nombra los endpoints del gateway para poder empaquetarlos, pero no importa el gateway
 * ni ningún adapter, y no invoca a nadie. esbuild trabaja en disco, no en la red.
 *
 * OFFLINE · esbuild local · no puede gastar. */
import { readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { build } from "esbuild";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};

/* Las condiciones con las que la plataforma resuelve un módulo en el edge. `platform: browser` es lo que hace
 * que un `node:*` builtin NO se resuelva — que es exactamente el fallo que hay que reproducir acá. */
const COMO_EL_EDGE = {
  bundle: true, format: "esm", platform: "browser",
  conditions: ["edge-light", "worker", "browser"],
  write: false, logLevel: "silent",
};

async function empaqueta(entrada, opciones = COMO_EL_EDGE) {
  try { await build({ entryPoints: [entrada], ...opciones }); return { ok: true, errores: [] }; }
  catch (e) {
    const errores = (e && e.errors ? e.errors : []).map((x) =>
      `${(x.location && x.location.file) || "?"}: ${x.text}`);
    return { ok: false, errores: errores.length ? errores : [String((e && e.message) || e).slice(0, 200)] };
  }
}

const ENDPOINTS = readdirSync("./api").filter((f) => f.endsWith(".js")).sort();
const esEdge = (f) => /runtime:\s*["']edge["']/.test(readFileSync(`./api/${f}`, "utf8"));
const edge = ENDPOINTS.filter(esEdge);
const node = ENDPOINTS.filter((f) => !esEdge(f));

console.log("=".repeat(100));
console.log("1 · LA CARNADA PRIMERO · si esta comprobación no puede ponerse roja, no comprueba nada");
console.log("=".repeat(100));
{
  /* Se fabrica un endpoint edge con exactamente el defecto que rompió el deploy y se exige que el gate lo cace.
   * Sin esto, un `build()` mal configurado que nunca falla dejaría pasar el mismo error otra vez — que es la
   * historia de este repo: cinco veces un chequeo mío estuvo verde y ciego. */
  const cebo = "./_cebo_edge_temporal.mjs";
  writeFileSync(cebo, 'import { inflateRawSync } from "node:zlib";\nexport default () => inflateRawSync;\n');
  const r = await empaqueta(cebo);
  try { unlinkSync(cebo); } catch { /* si no se puede borrar, no cambia el veredicto */ }
  ok(!r.ok, "un módulo con `node:zlib` NO empaqueta para edge — el gate lo detecta");
  ok(r.errores.some((x) => /node:zlib/.test(x)), `…y dice cuál es el módulo culpable: «${r.errores[0]}»`);
}

console.log("\n" + "=".repeat(100));
console.log("2 · CADA ENDPOINT EDGE, EMPAQUETADO DE VERDAD · grafo completo, no una lectura de imports");
console.log("=".repeat(100));
ok(edge.length > 0, `hay ${edge.length} endpoints en runtime edge: ${edge.join(" · ")}`);
for (const f of edge) {
  const r = await empaqueta(`./api/${f}`);
  ok(r.ok, `${f} empaqueta para edge`, r.errores.slice(0, 2).join(" | "));
}

console.log("\n" + "=".repeat(100));
console.log("3 · LOS DE NODE SIGUEN SIENDO DE NODE · y por eso pueden usar zlib sin romper nada");
console.log("=".repeat(100));
ok(node.length > 0, `hay ${node.length} endpoints en runtime node: ${node.join(" · ")}`);
for (const f of node) {
  const r = await empaqueta(`./api/${f}`, { ...COMO_EL_EDGE, platform: "node", conditions: ["node"], external: ["node:*"] });
  ok(r.ok, `${f} empaqueta para node`, r.errores.slice(0, 2).join(" | "));
}

console.log("\n" + "=".repeat(100));
console.log("4 · EL REPARTO QUE HACE QUE ESTO NO VUELVA A PASAR");
console.log("=".repeat(100));
{
  /* La regla concreta: el router compartido lo importan los cinco endpoints edge, así que nada que dependa de
   * un módulo de Node puede entrar ahí. La ingesta llama a su handler directo. */
  /* ⚠️ SE MIRAN LOS IMPORTS, NO LAS MENCIONES, y la primera versión de este gate se equivocó justo acá: buscaba
   * la palabra en el archivo y se ponía roja con el COMENTARIO que explica por qué esa palabra no se usa. Un
   * chequeo que lee prosa mide la prosa. Lo que importa es el grafo de dependencias, y eso son los imports. */
  const IMPORTA_NODE = /^\s*import[^\n]*from\s*["']node:/m;
  const IMPORTA_ROUTER = /^\s*import[^\n]*from\s*["'][^"']*gatewayFetch\.js["']/m;
  const router = readFileSync("./src/adi/llm/gatewayFetch.js", "utf8");
  ok(!/handleIngesta\b(?![^\n]*NO SE MONTA)/.test(router.replace(/\/\*[^]*?\*\//g, "")),
    "la ingesta NO está montada en el router compartido");
  ok(!IMPORTA_NODE.test(router), "…y el router no IMPORTA ningún módulo de Node");
  const ep = readFileSync("./api/adi-ingesta.js", "utf8");
  ok(/handleIngesta/.test(ep) && !IMPORTA_ROUTER.test(ep),
    "el endpoint de ingesta llama a su handler directo, sin importar el router");
  ok(!/runtime:\s*["']edge["']/.test(ep), "…y no declara edge: necesita Node para descomprimir");
  const srv = readFileSync("./server.js", "utf8");
  ok(/adi-ingesta/.test(srv) && /handleIngesta/.test(srv),
    "y el servidor local sirve la MISMA ruta por el MISMO camino: si divergen, local deja de probar producción");
}

console.log(`\n── _edge_bundle_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
