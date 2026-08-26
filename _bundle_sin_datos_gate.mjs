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

/* ── el texto sobre el que se buscan literales ──────────────────────────────────────────────────────────────
 * LA PRUEBA AUTORITATIVA ES EL GRAFO QUE ESTE GATE CONSTRUYE RECIÉN, no un archivo que quedó en el disco. El
 * `dist/` publicado se suma como evidencia ADICIONAL solo si está AL DÍA.
 *
 * ⚠️ POR QUÉ SE MIRA LA FECHA (owner 2026-08-22). Antes se leía `dist/` «si existe», sin preguntar de cuándo era.
 * Eso ya dio un ROJO FALSO —un `dist/` de nueve días atrás mostró una fuga que el arreglo ya había cerrado— y
 * costó un diagnóstico equivocado. Pero el peligro serio es el otro: si alguien construyó `dist/` ANTES de
 * introducir una fuga, el gate lee el artefacto viejo, no encuentra nada y **pasa en VERDE**. Un candado de
 * seguridad que puede dar verde leyendo evidencia caducada es peor que no tenerlo, porque enseña a confiar.
 * Regla del owner, textual: «no quiero verdes basados en artefactos viejos».
 * Caducado NO es un fallo del gate —no construir antes de correr la suite es normal— pero se DICE, y el
 * artefacto se descarta: la evidencia se ignora, nunca se degrada en silencio. */
const textoEsbuild = build.outputFiles.map((f) => f.text).join("\n");
const distDir = path.join(ROOT, "dist", "assets");
const _masNuevo = (dir) => {
  let max = 0;
  const rec = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) rec(p); else { const m = fs.statSync(p).mtimeMs; if (m > max) max = m; } } };
  try { rec(dir); } catch { return 0; }
  return max;
};
const existeDist = fs.existsSync(distDir);
const edadDist = existeDist ? _masNuevo(distDir) : 0;
const edadSrc = _masNuevo(path.join(ROOT, "src"));
const distCaducado = existeDist && edadDist < edadSrc;
const hayDist = existeDist && !distCaducado;
const textoDist = hayDist
  ? fs.readdirSync(distDir).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(distDir, f), "utf8")).join("\n")
  : "";
const FUENTES = [["grafo esbuild (recién construido)", textoEsbuild], ...(hayDist ? [["dist/ publicado", textoDist]] : [])];
if (!existeDist) console.log("  · nota: no hay dist/ — se revisa el grafo fresco, que es la prueba autoritativa. Con `npm run build` antes, se revisan los dos.");
else if (distCaducado) console.log(`  · ⚠️ EVIDENCIA CADUCADA: dist/ es MAS VIEJO que src/ (${new Date(edadDist).toISOString().slice(0, 16).replace("T", " ")} contra ${new Date(edadSrc).toISOString().slice(0, 16).replace("T", " ")}) — se DESCARTA. Un verde apoyado en un artefacto viejo no prueba nada. Corre "npm run build" para volver a sumarlo.`);

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
/* LO QUE EL PISO DE 4 DEJA AFUERA, dicho en voz alta. El piso es correcto (ver arriba), pero vuelve el conteo
 * ILEGIBLE si no se sabe contra cuántos se está midiendo: el demo tiene 13 cuentas y `ABC` mide 3 caracteres, así
 * que el máximo que este candado puede llegar a medir son 12 — y mientras el techo de clientes fue 13, la
 * comparación `medido ≤ 13` NO PODÍA fallar nunca. Un candado que no puede ponerse rojo se lee como uno verde.
 * No se baja el piso (bajarlo trae falsas alarmas y eso es peor); se IMPRIME el descarte, para que el techo se
 * fije siempre contra el máximo medible y no contra el total del dataset. */
const descartadosDe = (t) => {
  const corto = (arr) => (arr || []).filter((s) => typeof s === "string" && s.trim().length > 0 && s.trim().length < 4);
  return {
    skus: corto((t.skuInventario || []).map((r) => r.sku)),
    marcas: corto(t.MARCAS_ALL || []),
    clientes: corto((t.clientesVentas || []).map((r) => r.nombre)),
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

/* EL INVENTARIO. No es una lista de excepciones: es un TRINQUETE. Cada número tiene dueño conocido y es trabajo
 * pendiente declarado, no una coincidencia. Si alguno SUBE, es dato nuevo filtrándose y el gate se pone rojo.
 *
 * MEDIDO 2026-08-20 (cuando nació este candado): skus 1 · marcas 0 · clientes 13.
 *   · clientes → `CLIENT_NAMES` (routerData) y el mapa de alias (detectors): las 13 cuentas del demo escritas a
 *     mano en código de producto, más ~10 apariciones sueltas en composers, ejemplos y textos de pantalla.
 *   · skus → `SAM-REF500L` en el ejemplo de una pregunta de desambiguación ("¿De qué SKU…? p. ej. …").
 *
 * APRETADO 2026-08-21 · autorización del owner (fases A+B+C, prompts fuera): skus 0 · marcas 0 · clientes 1.
 * Se des-hardcodearon 15 archivos: el vocabulario de entrada del router sale del dato (`clientesVentas` + los
 * alias y ambigüedades que el negocio declara en su dataset), y los composers/pantallas eligen las cuentas que
 * nombran por CRITERIO (la más grande, la de más carga, la de más contribución bajo la vara) en vez de por
 * nombre. Ver `_dehardcodeo_entidades_gate.mjs`, que prueba lo mismo desde el lado del comportamiento.
 *
 * EL 1 QUE QUEDA, con dueño: `Falabella` dentro de `src/adi/oracle/narratePromptC.js` — un hallazgo de producción
 * citado textual en el PROMPT de narración. Los prompts de ADI son contrato del owner (CLAUDE.md §3: no se tocan
 * sin autorización que los nombre) y quedaron explícitamente FUERA de esta autorización. Hay otros cuatro
 * archivos de prompt con nombres del demo (`naturalPrompt`, `planPrompt`, `narratePrompt`,
 * `conversationalContract`) que hoy NO son alcanzables desde el navegador: no cuentan acá, pero son el mismo
 * pendiente. Bajar este 1 a 0 exige autorización aparte.
 *
 * Cuando eso pase, hay que bajar el techo acá mismo: un trinquete que no se aprieta deja de ser un trinquete. */
const TECHO_DEMO = { skus: 0, marcas: 0, clientes: 1 };
const Ld = literalesDe(TENANTS.demo);
const Dd = descartadosDe(TENANTS.demo);
for (const k of ["skus", "marcas", "clientes"]) {
  const fuera = Dd[k];
  console.log(`  · ${k}: se miden ${Ld[k].length}${fuera.length ? ` · ${fuera.length} fuera del piso de 4 (${fuera.join(", ")}) → el máximo medible es ${Ld[k].length}, y el techo se fija contra ESE número` : ""}`);
  // Un techo por encima del máximo medible es un candado que no puede ponerse rojo: eso se atrapa acá.
  ok(TECHO_DEMO[k] <= Ld[k].length, `[demo] el techo de ${k} (${TECHO_DEMO[k]}) es alcanzable — puede fallar si algo sube`,
    TECHO_DEMO[k] > Ld[k].length ? `el techo ${TECHO_DEMO[k]} está por encima del máximo medible (${Ld[k].length}): la comparación de abajo NUNCA podría fallar. Bajalo.` : "");
}
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
  // EL VOCABULARIO DE ENTRADA DEL ROUTER (des-hardcodeo 2026-08-21) · también es estado derivado del dato, y por
  // no estar en esta lista pasó desapercibido que `EntityRegistry` se armaba en tiempo de import: con la vía 1
  // quedaba VACÍO para siempre, en silencio y sin error, y ADI dejaba de resolver ids de entidad a su nombre.
  'export { CLIENT_NAMES, EntityRegistry } from "./src/config/routerData.js";',
  'export { CLIENT_KEYWORDS, CLIENT_NAME_MAP, _AMBIGUOUS_CLIENT_KW } from "./src/adi/detectors.js";',
  'export { CONCEPT_ONTOLOGY } from "./src/config/ontology.js";',
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
  // SIN EMPRESA, ADI NO RECONOCE CUENTAS. Es lo correcto y no es un detalle: un vocabulario poblado en el arranque
  // solo puede venir de una lista escrita a mano, o sea de las cuentas de OTRO negocio.
  ok(Array.isArray(M.CLIENT_NAMES) && M.CLIENT_NAMES.length === 0, "el vocabulario de cliente del router arranca vacío (no reconoce cuentas de nadie)",
    `arrancó con: ${JSON.stringify((M.CLIENT_NAMES || []).slice(0, 6))}`);
  ok(Array.isArray(M.CLIENT_KEYWORDS) && M.CLIENT_KEYWORDS.length === 0, "el canon de keywords/alias arranca vacío");
  ok(M.EntityRegistry && M.EntityRegistry.meta && M.EntityRegistry.meta.total_entities === 0, "el índice de entidades arranca vacío");
  // y ahora el camino real: entra el dato y todo se re-arma
  M.initTenant(M.TENANT_DEMO);
  ok(M.tenantCargado() === true, "después de initTenant, el store declara que hay dato");
  ok(M.clientesVentas.length > 0, `initTenant re-armó las fachadas (${M.clientesVentas.length} clientes)`);
  ok(Array.isArray(M.KNOWN_ENTITIES) && M.KNOWN_ENTITIES.length > 0, `los derivados se re-armaron (${(M.KNOWN_ENTITIES || []).length} entidades conocidas)`);
  ok(M.CLIENT_NAMES.length === M.clientesVentas.length, `el vocabulario del router se re-armó y trae TODAS las cuentas (${M.CLIENT_NAMES.length})`,
    `CLIENT_NAMES=${M.CLIENT_NAMES.length} vs clientesVentas=${M.clientesVentas.length} → alguna cuenta quedaría sin reconocer`);
  ok(M.CLIENT_KEYWORDS.length >= M.clientesVentas.length, `el canon de keywords se re-armó (${M.CLIENT_KEYWORDS.length} formas para ${M.clientesVentas.length} cuentas)`);
  ok(M.EntityRegistry.meta.total_entities > 0, `el índice de entidades se re-armó (${M.EntityRegistry.meta.total_entities} entidades)`);
  // el «sin <cuenta>» de conditional_loss también sale del dato: una cuenta declarada, un patrón
  const _sig = M.CONCEPT_ONTOLOGY.conditional_loss.signals.find((s) => s.type === "conditional_marker");
  const _sinCuenta = (_sig ? _sig.patterns : []).filter((p) => p.startsWith("sin "));
  ok(_sinCuenta.length === M.clientesVentas.length, `«sin <cuenta>» cubre las ${M.clientesVentas.length} cuentas del negocio, no tres elegidas a mano (${_sinCuenta.length})`);
}
try { fs.unlinkSync(entry); } catch { /* */ }
try { fs.unlinkSync(out); } catch { /* */ }

console.log(`\n${FAIL === 0 ? "✅" : "❌"} _bundle_sin_datos_gate · ${PASS} ok · ${FAIL} fallas`);
process.exit(FAIL === 0 ? 0 : 1);
