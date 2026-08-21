/* === _bundle_sin_datos_gate.mjs · EL DATO DE UNA EMPRESA NO VIAJA AL NAVEGADOR DE OTRA (vía 1 · 2026-08-20) ===
 *
 * EL DEFECTO QUE ESTE CANDADO CIERRA, medido antes de existir. Se construyó el bundle de producción y se buscaron
 * literales adentro: `NevadaFoods` —una marca que SOLO existe en `src/data/tenants/empresa2.js`— aparecía **9
 * veces**, con sus ventas y sus márgenes. `Falabella` 30 · `SAM-TV55` 4. El objeto de cabecera `TENANT_EMPRESA2`
 * sí lo eliminaba el tree-shaking (`Distribuidora Andina` daba 0), y esa media verdad era justamente lo que hacía
 * ver seguro el `if (import.meta.env.DEV)` de `main.jsx`: borraba el nombre de la empresa y dejaba sus FILAS.
 * Con datasets ficticios era tolerable. Con el archivo de un cliente real, no.
 *
 * POR QUÉ UN GATE Y NO UNA REGLA ESCRITA. La fuga no se introdujo por descuido: se introdujo por un import que
 * PARECÍA condicionado. Cualquiera puede volver a escribirlo —un `import` de conveniencia en un módulo del
 * navegador— y nadie lo vería hasta que un cliente real esté adentro. Una regla no frena un import; un candado sí.
 *
 * CUATRO PARTES, de la más estructural a la más literal:
 *   [A] GRAFO · ningún módulo de `src/data/tenants/` ni ningún `*.server.*` es alcanzable desde `src/main.jsx`.
 *       Es la prueba exacta —no busca texto, mira el grafo de módulos— y es la que no se puede esquivar.
 *   [B] FUGA ENTRE EMPRESAS · de todo tenant que NO sea el demo, CERO literales en el bundle. Tolerancia cero:
 *       acá no hay ejemplos escritos a mano que expliquen una coincidencia.
 *   [C] RESIDUO DEL DEMO, DECLARADO Y CON TRINQUETE · el demo sí deja nombres, y no por el dataset: son ejemplos y
 *       alias escritos a mano en código de producto (ver el inventario abajo). No se ocultan con una lista de
 *       excepciones: se CUENTAN, y el gate se pone rojo si el número CRECE. Solo puede bajar.
 *   [D] ARRANQUE VACÍO · el motor se importa con el store en la forma vacía y NO explota. Es el riesgo que la vía 1
 *       declaró de antemano: las fachadas leen el dato en tiempo de import, y entre el arranque y `initTenant` hay
 *       un instante sin dato.
 *
 * Determinístico · sin red · sin credenciales · sin modelo.
 */
import esbuild from "esbuild";
import { pathToFileURL } from "url";
import path from "path";
import fs from "fs";
import { TENANTS } from "./src/data/tenants/index.js";

const ROOT = process.cwd();
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ FALLO: " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t + "\n" + "─".repeat(Math.min(100, t.length)));

const DEFINE = { __ADI_LLM_ENABLED__: "false", __ADI_NARRATE__: "false", __ADI_LLM_NARRATE_ENABLED__: "false", __ADI_PROFILE__: '"floor"' };

/* ── [A] EL GRAFO DEL NAVEGADOR ────────────────────────────────────────────────────────────────────────────── */
H("[A] GRAFO · qué módulos son alcanzables desde el entry del navegador");

// `minify: true` NO es cosmético: sin minificar, el bundle conserva los COMENTARIOS del código fuente, y este repo
// menciona SKU y clientes del demo en decenas de comentarios explicativos. Medido: sin minificar daban 5 SKU y 1
// marca «presentes» que no son dato — son prosa. Minificado se compara contra lo mismo que se publica.
const build = await esbuild.build({
  entryPoints: ["src/main.jsx"], bundle: true, write: false, metafile: true, minify: true,
  format: "esm", platform: "browser", loader: { ".js": "jsx" }, define: DEFINE, logLevel: "silent",
});
const inputs = Object.keys(build.metafile.inputs).map((p) => p.replace(/\\/g, "/"));
const tenantsEnGrafo = inputs.filter((p) => /(^|\/)src\/data\/tenants\//.test(p));
const serverEnGrafo = inputs.filter((p) => /\.server\./.test(p));

ok(inputs.length > 50, `el grafo se construyó (${inputs.length} módulos)`);
ok(tenantsEnGrafo.length === 0, "ningún dataset de tenant es alcanzable desde el navegador",
  tenantsEnGrafo.length ? `alcanzables: ${tenantsEnGrafo.join(" · ")}\n      → alguien volvió a importar un tenant desde código de cliente. Ese import es la fuga.` : "");
ok(serverEnGrafo.length === 0, "ningún módulo *.server.* es alcanzable desde el navegador",
  serverEnGrafo.length ? `alcanzables: ${serverEnGrafo.join(" · ")}\n      → tenantService.server.js importa el registro COMPLETO: si entra al grafo, entran todas las empresas.` : "");

/* ── el texto sobre el que se buscan literales: el bundle de esbuild siempre, y el `dist/` real si existe ──── */
const textoEsbuild = build.outputFiles.map((f) => f.text).join("\n");
const distDir = path.join(ROOT, "dist", "assets");
const hayDist = fs.existsSync(distDir);
const textoDist = hayDist
  ? fs.readdirSync(distDir).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(distDir, f), "utf8")).join("\n")
  : "";
const FUENTES = [["grafo esbuild", textoEsbuild], ...(hayDist ? [["dist/ publicado", textoDist]] : [])];
if (!hayDist) console.log("  · nota: no hay dist/ — se revisa solo el bundle de esbuild. Con `npm run build` antes, se revisan los dos.");

/* Los literales de un tenant, sacados del propio dataset (nada de listas escritas a mano acá).
 * PISO DE 4 CARACTERES, y no es una comodidad: buscar por subcadena en código MINIFICADO convierte cualquier
 * literal corto en ruido. Medido acá mismo: la marca `LG` del demo daba «presente» en el bundle de esbuild porque
 * esas dos letras caen dentro de identificadores minificados cualesquiera — una falsa alarma que habría enseñado a
 * ignorar este candado, que es la peor cosa que le puede pasar a un candado. Un literal de 3 caracteres o menos no
 * es evidencia de que viajó un dataset; los de 4+ (`SAM-TV55`, `NevadaFoods`, `Falabella`) sí lo son. */
const literalesDe = (t) => {
  const util = (arr) => arr.filter((s) => typeof s === "string" && s.trim().length >= 4);
  return {
    skus: util((t.skuInventario || []).map((r) => r.sku)),
    marcas: util(t.MARCAS_ALL || []),
    clientes: util((t.clientesVentas || []).map((r) => r.nombre)),
  };
};
const presentes = (arr, texto) => arr.filter((s) => s && texto.includes(s));

/* ── [B] FUGA ENTRE EMPRESAS · tolerancia cero ─────────────────────────────────────────────────────────────── */
H("[B] FUGA ENTRE EMPRESAS · de un tenant que no es el activo no puede quedar NADA");

for (const [id, t] of Object.entries(TENANTS)) {
  if (id === "demo") continue;   // el demo tiene su propia parte, con inventario declarado
  const L = literalesDe(t);
  for (const [fuente, texto] of FUENTES) {
    const hit = [...presentes(L.skus, texto), ...presentes(L.marcas, texto), ...presentes(L.clientes, texto)];
    ok(hit.length === 0, `[${id}] cero literales en ${fuente} (${L.skus.length} SKU · ${L.marcas.length} marcas · ${L.clientes.length} clientes revisados)`,
      hit.length ? `presentes: ${hit.slice(0, 8).join(", ")}${hit.length > 8 ? ` …(+${hit.length - 8})` : ""}\n      → ESTA es la fuga que el candado existe para atrapar.` : "");
  }
}

/* ── [C] RESIDUO DEL DEMO · declarado, con trinquete ───────────────────────────────────────────────────────── */
H("[C] RESIDUO DEL DEMO · nombres que quedan por ejemplos y alias escritos a mano (no por el dataset)");

/* EL INVENTARIO, medido el 2026-08-20 sobre el build real. No es una lista de excepciones: es un TRINQUETE.
 * Cada número tiene dueño conocido y es trabajo pendiente declarado, no una coincidencia:
 *   · clientes 13/13 → `CLIENT_NAMES` en `src/config/routerData.js`: los 13 clientes del demo escritos a mano en
 *     config del router. Con un cliente real, ADI reconocería los nombres del demo y no los suyos.
 *   · skus 1/13 → `SAM-REF500L` en el ejemplo de una pregunta de desambiguación ("¿De qué SKU…? p. ej. …").
 *   · marcas 0/5 → limpio.
 * Si alguno SUBE, es dato nuevo filtrándose y el gate se pone rojo. Cuando se des-hardcodeen, estos bajan a 0 y
 * hay que bajar el techo acá mismo: un trinquete que no se aprieta deja de ser un trinquete. */
const TECHO_DEMO = { skus: 1, marcas: 0, clientes: 13 };
const Ld = literalesDe(TENANTS.demo);
for (const [fuente, texto] of FUENTES) {
  const medido = { skus: presentes(Ld.skus, texto).length, marcas: presentes(Ld.marcas, texto).length, clientes: presentes(Ld.clientes, texto).length };
  for (const k of ["skus", "marcas", "clientes"]) {
    ok(medido[k] <= TECHO_DEMO[k], `[demo] ${k} en ${fuente}: ${medido[k]} ≤ techo ${TECHO_DEMO[k]}`,
      medido[k] > TECHO_DEMO[k] ? `subió de ${TECHO_DEMO[k]} a ${medido[k]} → entró dato del demo al bundle. Encontrá el import nuevo.` : "");
  }
}

/* ── [D] ARRANQUE VACÍO ────────────────────────────────────────────────────────────────────────────────────── */
H("[D] ARRANQUE VACÍO · el motor se importa sin dato y no explota");

const entry = path.join(ROOT, `_bsd.tmp${process.pid}.js`);
const out = path.join(ROOT, `_bsdb.tmp${process.pid}.mjs`);
fs.writeFileSync(entry, [
  // los módulos que DERIVAN estado del dato en tiempo de import — los que se romperían si la forma vacía no alcanzara
  'export { getTenantData, tenantCargado, initTenant } from "./src/data/tenantStore.js";',
  'export { clientesVentas, clientesMargen, skuInventario } from "./src/data/demoData.js";',
  'export { skusMargen } from "./src/data/skusMargen.js";',
  'export { ventasKPI, margenKPI, invKPI } from "./src/data/baseKpis.js";',
  'export { SUPERFAMILIAS, MARCAS_ALL, SUCURSALES } from "./src/data/catalogs.js";',
  'export { SCENARIO_TRANSFORMS } from "./src/config/scenarios.js";',
  'export { POLICY, tenantPolicyDefault } from "./src/config/businessPolicy.js";',
  'export { KNOWN_ENTITIES } from "./src/ui/theme.js";',
  'export { composicionCliente } from "./src/data/clienteSkuMatrix.js";',   // su matriz se ARMA en import (IPF)
  'export { TENANT_DEMO } from "./src/data/tenants/demo.js";',
].join("\n"), "utf8");

let M = null, explotó = null;
try {
  await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", define: DEFINE, logLevel: "silent" });
  M = await import(pathToFileURL(out).href + "?t=" + process.pid);
} catch (e) { explotó = (e && e.message) || String(e); }

ok(!explotó, "importar el motor con el store vacío no lanza", explotó ? `lanzó: ${String(explotó).slice(0, 200)}` : "");
if (M) {
  ok(M.tenantCargado() === false, "arranca declarando que TODAVÍA no hay dato (tenantCargado() === false)");
  ok(Array.isArray(M.clientesVentas) && M.clientesVentas.length === 0, "las fachadas arrancan vacías, no con dato de nadie");
  ok(M.getTenantData().id === null, "el id del tenant de arranque es null (no se hace pasar por el demo)");
  ok(typeof M.tenantPolicyDefault("benchmark") === "number", "sin perfil, la vara cae limpio al config (no queda inventada)");
  // y ahora el camino real: entra el dato y todo se re-arma
  M.initTenant(M.TENANT_DEMO);
  ok(M.tenantCargado() === true, "después de initTenant, el store declara que hay dato");
  ok(M.clientesVentas.length > 0, `initTenant re-armó las fachadas (${M.clientesVentas.length} clientes)`);
  ok(Array.isArray(M.KNOWN_ENTITIES) && M.KNOWN_ENTITIES.length > 0, `los derivados se re-armaron (${(M.KNOWN_ENTITIES || []).length} entidades conocidas)`);
}
try { fs.unlinkSync(entry); } catch { /* */ }
try { fs.unlinkSync(out); } catch { /* */ }

console.log(`\n${FAIL === 0 ? "✅" : "❌"} _bundle_sin_datos_gate · ${PASS} ok · ${FAIL} fallas`);
process.exit(FAIL === 0 ? 0 : 1);
