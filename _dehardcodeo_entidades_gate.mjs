/* === _dehardcodeo_entidades_gate.mjs · ADI NOMBRA LAS CUENTAS DE QUIEN PAGA (2026-08-21) =====================
 *
 * EL DEFECTO QUE ESTE CANDADO CIERRA, medido antes de existir. `_bundle_sin_datos_gate` [C] contaba nombres del
 * demo en el bundle publicado y daba 13 clientes y 1 SKU. Ese conteo era el SÍNTOMA; la enfermedad era otra: las
 * cuentas del tenant demo estaban escritas a mano en CÓDIGO DE PRODUCTO, no en un dataset. Dos listas en
 * `config/routerData.js` y `adi/detectors.js` eran el vocabulario de entrada del router —lo que ADI RECONOCE
 * cuando el usuario escribe— y una docena de composers nombraban «Falabella», «Lider» o «Jumbo» dentro de sus
 * textos, de sus sugerencias y hasta de sus LOOKUPS (`find(c => c.nombre === "Falabella")`).
 *
 * CON EL ARCHIVO DE UN CLIENTE REAL eso no era un detalle cosmético, era correctitud:
 *   · ADI reconocía «Falabella» y NO las cuentas de la empresa que está mirando;
 *   · la respuesta a «no encontré esa cuenta» ofrecía tres cuentas que tampoco existen;
 *   · la palanca prioritaria de `fuga_distribuida` se resolvía por un lookup por NOMBRE: sin una cuenta llamada
 *     Falabella, la recomendación no se emitía nunca;
 *   · `overview` reventaba con TypeError al leer `ml.nombre` de un `find` que daba undefined.
 *
 * POR QUÉ UN GATE APARTE DEL DE BUNDLE. Contar literales prueba que el nombre ya no VIAJA; no prueba que ADI
 * entienda a la empresa nueva. Un `CLIENT_NAMES = []` bajaría el conteo a cero y rompería el producto entero.
 * Acá se prueba lo otro: con el demo activo el vocabulario es BYTE-IDÉNTICO al que estaba escrito a mano (nada
 * se perdió), y con otra empresa activa es el de ESA empresa y no queda ni rastro de la anterior.
 *
 * CUATRO PARTES:
 *   [A] ARRANQUE VACÍO · sin empresa, ADI no reconoce ninguna cuenta. Un vocabulario poblado en el arranque solo
 *       puede venir de una lista a mano, o sea de las cuentas de otro negocio.
 *   [B] DEMO · byte-idéntico a las listas que se borraron, incluido el ORDEN (que es precedencia de match).
 *   [C] OTRA EMPRESA · el vocabulario cambia entero y no hereda nada: ni nombres, ni alias, ni ambigüedades.
 *   [D] LO QUE ADI ESCRIBE · con otra empresa activa, ningún texto ni sugerencia nombra una cuenta del demo.
 *
 * Determinístico · sin red · sin credenciales · sin modelo.
 */
import esbuild from "esbuild";
import { pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const ROOT = process.cwd();
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ FALLO: " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t + "\n" + "─".repeat(Math.min(100, t.length)));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const DEFINE = { __ADI_LLM_ENABLED__: "false", __ADI_NARRATE__: "false", __ADI_LLM_NARRATE_ENABLED__: "false", __ADI_PROFILE__: '"floor"' };

/* Una sola instancia del store para todo el gate: si cada import trajera su propia copia, `initTenant` de un lado
 * no se vería del otro y las comparaciones medirían dos mundos distintos. Por eso se bundlea un entry único. */
const entry = path.join(ROOT, `_dhe.tmp${process.pid}.js`);
const out = path.join(ROOT, `_dheb.tmp${process.pid}.mjs`);
fs.writeFileSync(entry, [
  'export { initTenant, tenantCargado } from "./src/data/tenantStore.js";',
  'export { TENANT_DEMO } from "./src/data/tenants/demo.js";',
  'export { TENANT_EMPRESA2 } from "./src/data/tenants/empresa2.js";',
  'export { clientesVentas, clientesMargen } from "./src/data/demoData.js";',
  'export { CLIENT_NAMES, EntityRegistry } from "./src/config/routerData.js";',
  'export { CLIENT_KEYWORDS, CLIENT_NAME_MAP, _AMBIGUOUS_CLIENT_KW, detectClientInText } from "./src/adi/detectors.js";',
  'export { detectAllClientsInText } from "./src/adi/router.js";',
  'export { CONCEPT_ONTOLOGY } from "./src/config/ontology.js";',
  'export { getClientDeepDive } from "./src/adi/composers/clientDive.js";',
  'export { composeClientMetricFollowUp } from "./src/adi/composers/followups.js";',
  'export { composeModuleOverview, composeModuleOverviewV2 } from "./src/adi/composers/overview.js";',
  'export { extractMarginSimulation, extractGrowthSimulation, extractPriceSimulation } from "./src/adi/composers/simulation.js";',
  'export { composeSpecTemporal } from "./src/adi/composers/temporalTable.js";',
].join("\n"), "utf8");

let M = null, explotó = null;
try {
  await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", loader: { ".js": "jsx" }, define: DEFINE, logLevel: "silent" });
  M = await import(pathToFileURL(out).href + "?t=" + process.pid);
} catch (e) { explotó = (e && e.message) || String(e); }
const limpiar = () => { try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ } };
if (!M) {
  console.log("  ✗ FALLO: el motor no se pudo importar\n      " + String(explotó).slice(0, 300));
  limpiar();
  process.exit(1);
}

/* ── [A] ARRANQUE VACÍO ────────────────────────────────────────────────────────────────────────────────────── */
H("[A] SIN EMPRESA · ADI no reconoce ninguna cuenta");

ok(M.tenantCargado() === false, "el store arranca sin dato (vía 1)");
ok(eq(M.CLIENT_NAMES, []), "CLIENT_NAMES arranca vacío", `arrancó con ${JSON.stringify(M.CLIENT_NAMES.slice(0, 6))}`);
ok(eq(M.CLIENT_KEYWORDS, []), "el canon de keywords/alias arranca vacío", `arrancó con ${JSON.stringify(M.CLIENT_KEYWORDS.slice(0, 6))}`);
ok(M.EntityRegistry.meta.total_entities === 0, "el índice de entidades arranca vacío",
  `arrancó con ${M.EntityRegistry.meta.total_entities} → se está armando en tiempo de import y va a quedar congelado`);
ok(M.detectClientInText("como viene Falabella") === null, "sin empresa, ADI no reconoce NINGÚN nombre de cuenta");

/* ── [B] DEMO · byte-idéntico a lo que estaba escrito a mano ───────────────────────────────────────────────── */
H("[B] DEMO · el vocabulario derivado es IDÉNTICO al que se borró (nada se perdió en el camino)");

/* Estos tres literales son la FOTO de lo que había escrito a mano en routerData.js y detectors.js antes del
 * des-hardcodeo. No son un hardcodeo nuevo: son la vara contra la que se mide que la derivación no cambió el
 * comportamiento del router para el tenant que ya estaba en producción. El ORDEN es parte de la vara — el
 * detector devuelve el PRIMER match, así que reordenar la lista cambia a qué cuenta resuelve un texto ambiguo. */
const NAMES_ANTES = ["Falabella", "Lider", "Jumbo", "Sodimac", "Tottus", "Paris", "Mercado Libre", "Ripley", "Easy", "La Polar", "Hites", "ABC", "Unimarc"];
const KW_ANTES = ["falabella", "lider", "jumbo", "sodimac", "tottus", "paris", "mercado libre", "mercadolibre", "ripley", "easy", "la polar", "lapolar", "hites", "abc", "unimarc"];
const MAP_ANTES = { "falabella": "Falabella", "lider": "Lider", "jumbo": "Jumbo", "sodimac": "Sodimac", "tottus": "Tottus", "paris": "Paris", "mercado libre": "Mercado Libre", "mercadolibre": "Mercado Libre", "ripley": "Ripley", "easy": "Easy", "la polar": "La Polar", "lapolar": "La Polar", "hites": "Hites", "abc": "ABC", "unimarc": "Unimarc" };

M.initTenant(M.TENANT_DEMO);
ok(eq(M.CLIENT_NAMES, NAMES_ANTES), `CLIENT_NAMES idéntico, incluido el orden (${M.CLIENT_NAMES.length})`, JSON.stringify(M.CLIENT_NAMES));
ok(eq(M.CLIENT_KEYWORDS, KW_ANTES), `el canon de keywords idéntico, incluido el orden (${M.CLIENT_KEYWORDS.length})`, JSON.stringify(M.CLIENT_KEYWORDS));
ok(eq(M.CLIENT_NAME_MAP, MAP_ANTES), "el mapa alias→canónico idéntico", JSON.stringify(M.CLIENT_NAME_MAP));
ok(eq([...M._AMBIGUOUS_CLIENT_KW].sort(), ["abc", "easy", "paris"]), "las keywords ambiguas idénticas — ahora DECLARADAS por el negocio (clientesAmbiguos)", JSON.stringify([...M._AMBIGUOUS_CLIENT_KW]));

/* Los alias pegados son el caso que la derivación SOLA no cubre: partir «Mercado Libre» da "mercado libre",
 * "mercado" y "libre", nunca "mercadolibre". Sin declararlos, ADI habría PERDIDO vocabulario que ya tenía. */
ok(M.detectClientInText("cuanto vendio mercadolibre") === "Mercado Libre", "«mercadolibre» pegado sigue resolviendo a Mercado Libre (alias declarado)");
ok(M.detectClientInText("y lapolar?") === "La Polar", "«lapolar» pegado sigue resolviendo a La Polar (alias declarado)");
ok(M.detectClientInText("el abc del margen", { strict: true }) === null, "strict: «el abc del margen» NO es el cliente ABC (ambigüedad declarada)");
ok(M.detectClientInText("el margen de abc", { strict: true }) === "ABC", "strict: «el margen de abc» SÍ es el cliente ABC (el conector manda)");
ok(eq(M.detectAllClientsInText("compara falabella con lider"), ["Falabella", "Lider"]), "el orden de aparición en el texto se sigue respetando");

const sigDemo = M.CONCEPT_ONTOLOGY.conditional_loss.signals.find((s) => s.type === "conditional_marker").patterns;
const sinDemo = sigDemo.filter((p) => p.startsWith("sin "));
ok(sinDemo.length === M.clientesVentas.length, `«sin <cuenta>» cubre las ${M.clientesVentas.length} cuentas (antes eran 3 elegidas a mano: falabella, lider, jumbo)`, JSON.stringify(sinDemo));
ok(["sin falabella", "sin lider", "sin jumbo"].every((p) => sinDemo.includes(p)), "…y las tres que ya estaban siguen estando (no se perdió nada)");
ok(sinDemo.includes("sin sodimac") && sinDemo.includes("sin unimarc"), "…y ahora también las 10 que el escrito-a-mano dejaba afuera");

/* ── [C] OTRA EMPRESA · cero herencia ──────────────────────────────────────────────────────────────────────── */
H("[C] OTRA EMPRESA · el vocabulario es el suyo, y del anterior no queda nada");

M.initTenant(M.TENANT_EMPRESA2);
const NOMBRES_DEMO = NAMES_ANTES.filter((n) => n.length >= 4);
ok(M.CLIENT_NAMES.length === M.clientesVentas.length && M.CLIENT_NAMES.length > 0,
  `CLIENT_NAMES trae las ${M.CLIENT_NAMES.length} cuentas de esta empresa`, JSON.stringify(M.CLIENT_NAMES));
ok(!NOMBRES_DEMO.some((n) => M.CLIENT_NAMES.includes(n)), "…y ni una sola del demo");
ok(!NOMBRES_DEMO.some((n) => M.CLIENT_KEYWORDS.includes(n.toLowerCase())), "el canon de keywords tampoco hereda nada del demo");
ok(eq([...M._AMBIGUOUS_CLIENT_KW], []), "sin ambigüedades declaradas, el set queda vacío (no hereda «abc/easy/paris»)");
ok(M.detectClientInText("como viene Falabella") === null, "ADI ya NO reconoce Falabella — es la cuenta de otra empresa");
ok(M.detectClientInText("como viene Comercial Aconcagua") === "Comercial Aconcagua", "y SÍ reconoce las cuentas de ESTA empresa");
ok(M.EntityRegistry.meta.total_entities > 0 && !M.EntityRegistry.index.by_canonical_name["Falabella"], "el índice de entidades se re-armó y no conserva las del demo");
const sig2 = M.CONCEPT_ONTOLOGY.conditional_loss.signals.find((s) => s.type === "conditional_marker").patterns;
ok(!sig2.includes("sin falabella") && sig2.some((p) => p.startsWith("sin ")), "«sin <cuenta>» también se re-armó con las cuentas nuevas", JSON.stringify(sig2.filter((p) => p.startsWith("sin ")).slice(0, 4)));

/* ── [D] LO QUE ADI ESCRIBE ────────────────────────────────────────────────────────────────────────────────── */
H("[D] LO QUE ADI ESCRIBE · con otra empresa activa, ningún texto nombra una cuenta del demo");

/* Se ejercitan las salidas que ANTES traían nombres escritos a mano: el fallback de «no tengo esa cuenta» (que es
 * donde peor duele: el usuario está pidiendo saber qué cuentas SÍ existen), las sugerencias de los composers, las
 * preguntas de precisión de las simulaciones y el mensaje de límite de la tabla temporal. Se junta TODO el texto
 * y se busca cualquier nombre del demo adentro. Un solo hit acá es el defecto entero de vuelta. */
const textos = [];
const juntar = (x) => {
  if (!x) return;
  if (typeof x === "string") { textos.push(x); return; }
  if (Array.isArray(x)) { x.forEach(juntar); return; }
  if (typeof x === "object") { for (const v of Object.values(x)) juntar(v); }
};

juntar(M.getClientDeepDive("Cuenta Que No Existe", "bonanza"));
juntar(M.getClientDeepDive(M.CLIENT_NAMES[0], "bonanza"));
juntar(M.composeClientMetricFollowUp("Cuenta Que No Existe", "margen", "bonanza", "margenes"));
juntar(M.composeClientMetricFollowUp(M.CLIENT_NAMES[0], "margen", "bonanza", "margenes"));
for (const mod of ["ventas", "margenes", "inventario"]) {
  for (const esc of ["bonanza", "tension", "crisis"]) {
    juntar(M.composeModuleOverview(esc, mod));
    juntar(M.composeModuleOverviewV2(esc, mod));
  }
}
juntar(M.extractMarginSimulation("bajemos la carga comercial", "bonanza"));
juntar(M.extractGrowthSimulation("y si crece 5%", "bonanza"));
juntar(M.extractPriceSimulation("y si subo el precio 2%", "bonanza"));
juntar(M.composeSpecTemporal({ metric: "margen", dimension: "cliente" }));

const cuerpo = textos.join(" \n ");
const filtrados = NOMBRES_DEMO.filter((n) => cuerpo.includes(n));
ok(cuerpo.length > 500, `se ejercitaron las salidas y produjeron texto (${cuerpo.length} caracteres · ${textos.length} campos)`);
ok(filtrados.length === 0, "ninguna salida nombra una cuenta del demo",
  filtrados.length ? `aparecen: ${filtrados.join(", ")}\n      → un composer volvió a escribir un nombre a mano. Ese literal es el defecto.` : "");

/* Y la contracara, que es la que prueba que no se resolvió vaciando todo: las salidas SÍ nombran cuentas — las
 * de esta empresa. Un producto mudo también pasaría el test de arriba, y sería peor que el defecto original. */
const propias = M.CLIENT_NAMES.filter((n) => n.length >= 4 && cuerpo.includes(n));
ok(propias.length > 0, `…y sí nombran las de esta empresa (${propias.length}: ${propias.slice(0, 5).join(", ")})`,
  "ninguna salida nombró una cuenta propia → el des-hardcodeo dejó los textos mudos, que no es lo que se pidió");

M.initTenant(M.TENANT_DEMO);   // dejar el proceso como lo encontró
limpiar();
console.log(`\n${FAIL === 0 ? "✅" : "❌"} _dehardcodeo_entidades_gate · ${PASS} ok · ${FAIL} fallas`);
process.exit(FAIL === 0 ? 0 : 1);
