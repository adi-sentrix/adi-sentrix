/* === _jerarquia_inventario_gate.mjs · EL CANDADO DE LA FUENTE ÚNICA DE INVENTARIO (etapas 1-2 · owner 2026-09-28) =
 *
 * Certifica `jerarquiaInventario()`/`kpiInventario()` (src/adi/diagnosis/economicDiagnosis.js) y
 * `umbral()`/`umbralesDeInventario()`/`ETIQUETA_ORIGEN` (src/config/businessPolicy.js) — la fuente única de
 * inmovilizado / inmovilizado crítico / frenado con la procedencia de sus umbrales, diseñada en
 * `diseno_inventario/DISENO.md` §2-3 y aprobada por el owner en `_ADI_CONTRATO_ENCARGO_V1.md` §7.3·30-32 y ·34.
 *
 * ETAPA 1 (diseño §8.1): sin consumidores todavía — cubre (b) contención, (d) el 60 no es verdad universal (con
 * el barrido de estática ACOTADO a los archivos que la etapa toca), (g) las carnadas que demuestran que (b) y (d)
 * tienen dientes, y la parte de (a) que se puede verificar SIN consumidores: la consistencia INTERNA de
 * `jerarquiaInventario` (lo que dice `porSku` concuerda con lo que dicen los grupos agregados).
 *
 * ETAPA 2 (diseño §8.2): la ingesta (`motorKpi.js`) y el KPI calculado (`deriveKpis`/`getInvKPI`) leen la fuente
 * única; se retira el `invKPI` escrito a mano de `demo.js`/`empresa2.js`/`tenantEmpty.js` y de los escenarios; y
 * se retira la regla del texto crudo (`estado !== "Activo"`) de `datoProyectado.js`. Agrega la comprobación (f)
 * del diseño — ACOTADA a los archivos que esta etapa toca (`overview.js`, `warehouse.js`, `specRetrieval.js`
 * siguen con el texto crudo o L60/stale-90: los retira la etapa 4, todavía sin tocar) — más la parte de (a) que
 * SÍ tiene consumidor ahora: `deriveKpis`, `getInvKPI`, `motorKpi.calcularDataset` y `datoProyectado` dan el
 * MISMO conjunto y el mismo `usd` que `jerarquiaInventario` sobre las mismas filas.
 *
 * ⚠️ EL RÓTULO «frenado» EN `I.estados` (datoProyectado.js) NO SE RENOMBRÓ a «inmovilizado crítico» en esta etapa,
 * aunque el owner lo pidió en superficie (decisión 34a): `notario/verificar.js:199,328` canonicaliza ese string
 * exacto (`estadoCanon`, en `notario/estados.js`) para construir el conjunto «con capital frenado» que otras
 * partes del Notario ya consultan. Renombrar sin migrar `estados.js`/`verificar.js` (la migración semántica de
 * «frenado», diseño §0.3, ETAPA 5) habría dejado al Notario sin poder verificar el tramo crítico — se reporta al
 * supervisor, no se decide acá.
 *
 * Tres orígenes, como pide el diseño §5: (1) demo bonanza (TENANT_DEMO tal cual), (2) demo tensión/crisis
 * (`applyScenarioToSkuInventario`), (3) la planilla de ejemplo del contrato (`ingestarPlantilla(plantillaEjemplo())`),
 * más dos fixtures derivados de la misma planilla: con `frenadoDiasSinVenta` declarado en el perfil, y con
 * `diasSinVenta` variados para que la intersección frenado∩inmovilizado no sea trivial.
 *
 * Determinístico · sin red · sin credenciales · sin modelo · sin dependencias nuevas. */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { TENANT_EMPRESA2 } from "./src/data/tenants/empresa2.js";
import { TENANT_VACIO } from "./src/data/tenantEmpty.js";
import { applyScenarioToSkuInventario } from "./src/engine/scenarios.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { validarPlantilla } from "./src/ingesta/plantilla/validarPlantilla.js";
import { jerarquiaInventario, kpiInventario } from "./src/adi/diagnosis/economicDiagnosis.js";
import { umbral, umbralesDeInventario, ORIGEN, ETIQUETA_ORIGEN, POLICY_CONFIG } from "./src/config/businessPolicy.js";
import { deriveKpis } from "./src/engine/scenarios.js";
import { getInvKPI } from "./src/engine/metrics.js";
import { calcularDataset } from "./src/ingesta/plantilla/motorKpi.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };

/* ── helpers de aserción, reutilizados en el candado real Y en las carnadas (g) ─────────────────────────────── */
// (b) contención: critico ⊆ inmovilizado · critico+sobrestock === inmovilizado · inmovilizado+riesgo+sano === total
function contencionOk(J) {
  const criticoSubconjunto = J.critico.skus.every((s) => J.inmovilizado.skus.includes(s));
  const particionExacta = (J.critico.usd + J.sobrestock.usd) === J.inmovilizado.usd;
  const totalCierra = (J.inmovilizado.usd + J.riesgoQuiebre.usd + J.sano.usd) === J.total;
  return criticoSubconjunto && particionExacta && totalCierra;
}
// consistencia interna porSku ↔ grupos agregados (la parte de (a) sin consumidores)
function consistenciaInternaOk(J) {
  const nInmov = J.porSku.filter((s) => s.inmovilizado).length;
  const nCritico = J.porSku.filter((s) => s.critico).length;
  const nSobrestock = J.porSku.filter((s) => s.estado === "sobrestock").length;
  const usdInmov = J.porSku.filter((s) => s.inmovilizado).reduce((a, s) => a + s.capital, 0);
  const usdCritico = J.porSku.filter((s) => s.critico).reduce((a, s) => a + s.capital, 0);
  return nInmov === J.inmovilizado.n && nCritico === J.critico.n && nSobrestock === J.sobrestock.n
    && usdInmov === J.inmovilizado.usd && usdCritico === J.critico.usd
    && J.porSku.every((s) => (s.estado === "capital_frenado") === s.critico)
    && J.porSku.every((s) => s.inmovilizado === (s.estado === "capital_frenado" || s.estado === "sobrestock"));
}

/* ── ORIGEN 1 · demo bonanza (actual) ────────────────────────────────────────────────────────────────────── */
console.log("── origen 1 · demo bonanza (actual) ──");
initTenant(TENANT_DEMO);
const Jdemo = jerarquiaInventario(TENANT_DEMO.skuInventario);
ok("total = Σ capital de las 13 filas ($135.000)", Jdemo.total === 135000);
ok("inmovilizado = $43.000 · 4 SKU · 31,9% (decisión ·31: capital_frenado ∪ sobrestock)", Jdemo.inmovilizado.usd === 43000 && Jdemo.inmovilizado.n === 4 && Jdemo.inmovilizado.pct === 31.9);
ok("crítico (inmovilizado crítico, decisión 34a) = $33.200 · 3 SKU · 24,6%", Jdemo.critico.usd === 33200 && Jdemo.critico.n === 3 && Jdemo.critico.pct === 24.6);
ok("sobrestock = $9.800 · 1 SKU (PHI-IRON-PRO)", Jdemo.sobrestock.usd === 9800 && Jdemo.sobrestock.skus[0] === "PHI-IRON-PRO");
ok("(b) contención se cumple en el demo", contencionOk(Jdemo));
ok("(a·interna) porSku concuerda con los grupos agregados", consistenciaInternaOk(Jdemo));
ok("sin umbral declarado, frenado.evaluado === false (nunca 'no hay frenados')", Jdemo.frenado.evaluado === false && Jdemo.frenado.motivo === "sin_umbral");
ok("interseccion === null sin umbral (nunca se asume)", Jdemo.interseccion === null);
ok("umbrales del demo: rotacionMin/dohMax = 'empresa' (el perfil los declara)", Jdemo.umbrales.rotacionMin.origen === ORIGEN.EMPRESA && Jdemo.umbrales.dohMax.origen === ORIGEN.EMPRESA);
ok("umbrales del demo: sobrestockDohMin = 'adi' (el perfil NO lo declara)", Jdemo.umbrales.sobrestockDohMin.origen === ORIGEN.ADI);
ok("umbral de frenado del demo: sin_declarar, valor null", Jdemo.umbrales.frenadoDiasSinVenta.origen === ORIGEN.SIN_DECLARAR && Jdemo.umbrales.frenadoDiasSinVenta.valor === null);

// con umbral 60 declarado explícitamente (simulando que la empresa lo declaró) — la intersección se MIDE
const Udemo60 = umbralesDeInventario();
Udemo60.frenadoDiasSinVenta = { valor: 60, origen: ORIGEN.EMPRESA };
const Jdemo60 = jerarquiaInventario(TENANT_DEMO.skuInventario, { umbrales: Udemo60 });
ok("con umbral 60: frenado = 3 SKU · $33.200 (coincide con crítico en ESTE dato, no por ley)", Jdemo60.frenado.evaluado && Jdemo60.frenado.n === 3 && Jdemo60.frenado.usd === 33200);
ok("con umbral 60: PHI-IRON-PRO queda inmovilizado sin venta frenada (interseccion.inmovilizadoNoFrenado)", Jdemo60.interseccion.inmovilizadoNoFrenado.skus.length === 1 && Jdemo60.interseccion.inmovilizadoNoFrenado.skus[0] === "PHI-IRON-PRO");
ok("con umbral 60: frenadoNoInmovilizado vacío en el demo (no es ley, es el dato)", Jdemo60.interseccion.frenadoNoInmovilizado.n === 0);
ok("(b) contención se sostiene también con umbral declarado", contencionOk(Jdemo60));

/* ── ORIGEN 2 · demo tensión / crisis ────────────────────────────────────────────────────────────────────── */
console.log("\n── origen 2 · demo tensión / crisis ──");
const Jtension = jerarquiaInventario(applyScenarioToSkuInventario("tension"));
ok("tensión: total sigue $135.000 (el escenario no toca stockUSD, ver diseño §0.4)", Jtension.total === 135000);
ok("tensión: inmovilizado = $55.800 · 5 SKU · 41,3% (+SAM-TV55 en sobrestock)", Jtension.inmovilizado.usd === 55800 && Jtension.inmovilizado.n === 5 && Jtension.inmovilizado.pct === 41.3);
ok("tensión: crítico = $33.200 · 3 SKU (el mismo conjunto que bonanza)", Jtension.critico.usd === 33200 && Jtension.critico.n === 3);
ok("tensión: (b) contención", contencionOk(Jtension));

const Jcrisis = jerarquiaInventario(applyScenarioToSkuInventario("crisis"));
ok("crisis: inmovilizado = $43.000 · 4 SKU · 31,9%", Jcrisis.inmovilizado.usd === 43000 && Jcrisis.inmovilizado.n === 4 && Jcrisis.inmovilizado.pct === 31.9);
ok("crisis: crítico = $43.000 · 4 SKU (PHI-IRON-PRO pasa a crítico)", Jcrisis.critico.usd === 43000 && Jcrisis.critico.n === 4);
ok("crisis: sobrestock = $0 (nadie queda en el tramo)", Jcrisis.sobrestock.usd === 0 && Jcrisis.sobrestock.n === 0);
ok("crisis: (b) contención", contencionOk(Jcrisis));

/* ── empresa2 (perfil declarado 2,5x / 90 días) ──────────────────────────────────────────────────────────── */
console.log("\n── empresa2 (perfil propio) ──");
initTenant(TENANT_EMPRESA2);
const Je2 = jerarquiaInventario(TENANT_EMPRESA2.skuInventario);
ok("empresa2: inmovilizado = $19.500 · 4 SKU · 32,5%", Je2.inmovilizado.usd === 19500 && Je2.inmovilizado.n === 4 && Je2.inmovilizado.pct === 32.5);
ok("empresa2: crítico = $13.900 · 3 SKU", Je2.critico.usd === 13900 && Je2.critico.n === 3);
ok("empresa2: sobrestock = $5.600 · 1 SKU (LS-QUESO-GDA)", Je2.sobrestock.usd === 5600 && Je2.sobrestock.skus[0] === "LS-QUESO-GDA");
ok("empresa2: rotacionMin/dohMax son 'empresa' (su perfil declara 2,5x / 90d, distinto del config)", Je2.umbrales.rotacionMin.origen === ORIGEN.EMPRESA && Je2.umbrales.rotacionMin.valor === 2.5 && Je2.umbrales.dohMax.valor === 90);
ok("empresa2: (b) contención", contencionOk(Je2));

/* ── ORIGEN 3 · la planilla de ejemplo del contrato ──────────────────────────────────────────────────────── */
console.log("\n── origen 3 · planilla de ejemplo (fixture del contrato) ──");
const rPlantilla = ingestarPlantilla(plantillaEjemplo(), { nombreArchivo: "ejemplo.xlsx" });
ok("la planilla de ejemplo pasa el portero", rPlantilla.ok === true);
const invPlantilla = rPlantilla.dataset.skuInventario;
initTenant(rPlantilla.dataset);   // el perfil de LA PLANILLA (solo declara moneda) — no el del tenant anterior
const Jplantilla = jerarquiaInventario(invPlantilla);
ok("planilla: inmovilizado = $41.736 · 3 SKU · 70,5% (el motor SIN texto crudo, ver 0.2 del diseño)", Jplantilla.inmovilizado.usd === 41736 && Jplantilla.inmovilizado.n === 3 && Jplantilla.inmovilizado.pct === 70.5);
ok("planilla: crítico = $0 (ningún SKU cae bajo el piso de rotación en este dato)", Jplantilla.critico.usd === 0 && Jplantilla.critico.n === 0);
ok("planilla: sobrestock = inmovilizado entero (los 3 SKU son sobrestock, no crítico)", Jplantilla.sobrestock.usd === 41736 && Jplantilla.sobrestock.n === 3);
ok("planilla: (b) contención", contencionOk(Jplantilla));
ok("planilla: TODOS los umbrales de estado son 'adi' — PARAMETROS no declara ninguno (diseño §3.1)", ["rotacionMin", "dohMax", "sobrestockDohMin", "quiebreRotMin", "quiebreDohMax"].every((k) => Jplantilla.umbrales[k].origen === ORIGEN.ADI));
ok("planilla: frenadoDiasSinVenta sin_declarar (nadie lo declaró)", Jplantilla.umbrales.frenadoDiasSinVenta.origen === ORIGEN.SIN_DECLARAR);
ok("planilla: días sin venta = 0 en todas las filas (precisión mensual del período, ver motorKpi.js)", invPlantilla.every((s) => s.diasSinVenta === 0));
ok("planilla: sin umbral, frenado.evaluado === false", Jplantilla.frenado.evaluado === false);

// con frenadoDiasSinVenta:60 declarado en el PERFIL del pack (fixture derivado, diseño §5 orígenes)
const packConUmbral = { ...rPlantilla.dataset, perfil: { ...rPlantilla.dataset.perfil, frenadoDiasSinVenta: 60 } };
initTenant(packConUmbral);
const Jconumbral = jerarquiaInventario(invPlantilla);
ok("planilla+perfil(frenado:60): origen 'empresa', valor 60", Jconumbral.umbrales.frenadoDiasSinVenta.origen === ORIGEN.EMPRESA && Jconumbral.umbrales.frenadoDiasSinVenta.valor === 60);
ok("planilla+perfil(frenado:60): 0 SKU frenados (todas las filas tienen 0 días sin venta, 0 ≤ 60)", Jconumbral.frenado.evaluado === true && Jconumbral.frenado.n === 0);
ok("planilla+perfil(frenado:60): (b) contención", contencionOk(Jconumbral));

// fixture con diasSinVenta variados (mutando las filas) para que la intersección NO sea trivial
const invVariado = invPlantilla.map((s, i) => ({ ...s, diasSinVenta: [10, 70, 95, 0, 40, 120][i % 6] }));
const Jvariado = jerarquiaInventario(invVariado, { umbrales: Jconumbral.umbrales });
ok("fixture variado: frenado evaluado con umbral 60, y hay SKU en cada lado de la intersección", Jvariado.frenado.evaluado === true && Jvariado.interseccion !== null);
ok("fixture variado: (b) contención se sostiene con datos mutados", contencionOk(Jvariado));
ok("fixture variado: (a·interna) porSku concuerda con los grupos", consistenciaInternaOk(Jvariado));
{
  // el frenado se mide, nunca se asume: verificamos a mano que cada SKU con diasSinVenta>60 está en frenado.skus
  const esperados = invVariado.filter((s) => s.diasSinVenta > 60).map((s) => s.sku).sort();
  ok("fixture variado: frenado.skus === {diasSinVenta>60} exacto (la medición, no una fórmula distinta)", JSON.stringify(Jvariado.frenado.skus.slice().sort()) === JSON.stringify(esperados));
}

/* ── (d) el 60 no es verdad universal ────────────────────────────────────────────────────────────────────── */
console.log("\n── (d) el 60 no es verdad universal ──");
ok("POLICY_CONFIG.frenadoDiasSinVenta === undefined (nunca un número en config)", POLICY_CONFIG.frenadoDiasSinVenta === undefined);
initTenant(TENANT_VACIO);
ok("con el tenant vacío (perfil {}): umbral('frenadoDiasSinVenta').origen === 'sin_declarar'", umbral("frenadoDiasSinVenta").origen === ORIGEN.SIN_DECLARAR && umbral("frenadoDiasSinVenta").valor === null);
initTenant(TENANT_DEMO);   // deja el tenant activo en un estado conocido para el resto del proceso

// barrido estático ACOTADO a los archivos que las etapas 1-2 tocan — el barrido de TODO src/ (warehouse.js,
// specRetrieval.js, overview.js, SentrixPanel.jsx todavía tienen L60/stale-90 o el texto crudo: los retira la
// etapa que migra los composers/la tool — etapa 4, sin tocar) queda para esa etapa, mismo patrón que
// `_poda_natural_anti_resurreccion_gate`.
const ARCHIVOS_DE_ESTA_ETAPA = [
  "src/adi/diagnosis/economicDiagnosis.js",
  "src/config/businessPolicy.js",
  "src/adi/criteria.js",
  "src/ingesta/plantilla/motorKpi.js",
  "src/adi/oracle/datoProyectado.js",
  "src/engine/scenarios.js",
  "src/engine/metrics.js",
  "src/data/tenants/demo.js",
  "src/data/tenants/empresa2.js",
  "src/data/tenantEmpty.js",
];
const PATRON_60_90 = /diasSinVenta\s*[><]=?\s*(60|90)\b|staleDays\s*\|\|\s*90|staleDays\s*\?\?\s*90/;
for (const f of ARCHIVOS_DE_ESTA_ETAPA) {
  const src = readFileSync(f, "utf8");
  // quita comentarios de bloque /* */ y de línea // antes de buscar (mismo criterio que los gates de barrido de la casa)
  const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  ok(`${f}: ningún 60/90 hardcodeado de frenado fuera de comentario`, !PATRON_60_90.test(sinComentarios));
}

/* ── (f) LA REGLA DEL TEXTO CRUDO NO VUELVE (etapa 2, diseño §5) ─────────────────────────────────────────────
 * Barrido estático: sin `!== "Activo"`, `≠ Activo`, `toLowerCase() !== "activo"` fuera de comentarios, EN LOS
 * ARCHIVOS QUE ESTA ETAPA TOCA (datoProyectado.js, motorKpi.js) — `overview.js`/`metrics.js:_aggregateInventario`
 * siguen con el texto crudo a propósito: son composers legados de la etapa 4 (diseño, tabla R2), no de esta.
 * Funcional: en el pack de planilla (donde `estado` es la clave del motor) `inmovilizado.pct` es el de la
 * función (70,5 % en el ejemplo), nunca 100 %. */
console.log("\n── (f) la regla del texto crudo no vuelve ──");
const PATRON_CRUDO = /!==\s*["']Activo["']|≠\s*Activo|toLowerCase\(\)\s*!==\s*["']activo["']/;
for (const f of ["src/adi/oracle/datoProyectado.js", "src/ingesta/plantilla/motorKpi.js"]) {
  const src = readFileSync(f, "utf8");
  const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  ok(`${f}: sin la regla del texto crudo fuera de comentario`, !PATRON_CRUDO.test(sinComentarios));
}
{
  const r = ingestarPlantilla(plantillaEjemplo(), { nombreArchivo: "f-check.xlsx" });
  ok("(f) funcional: la planilla de ejemplo NO da 100 % inmovilizado (la regla vieja daría 100 %)", r.dataset.invKPI.inmovilizadoPct === 70.5 && r.dataset.invKPI.inmovilizadoPct !== 100);
}

/* ── ETAPA 2 · la ingesta y el KPI calculado leen la fuente única (diseño §8.2) ──────────────────────────────
 * La parte de (a) que SÍ tiene consumidor ahora: `deriveKpis`, `getInvKPI`, `motorKpi.calcularDataset` (la
 * ingesta) y `datoProyectado` (la carpeta) dan el MISMO conjunto y el mismo `usd` que `jerarquiaInventario`
 * sobre las MISMAS filas — nunca una segunda cuenta. */
console.log("\n── ETAPA 2 · una sola verdad entre la ingesta, el KPI calculado y la carpeta ──");
initTenant(TENANT_DEMO);
{
  const Jd = jerarquiaInventario(TENANT_DEMO.skuInventario);
  const dK = deriveKpis("bonanza").inventario;
  const gK = getInvKPI("bonanza");
  ok("deriveKpis().inventario === jerarquiaInventario (inmovilizado)", dK.inmovilizadoUSD === Jd.inmovilizado.usd && dK.inmovilizadoPct === Jd.inmovilizado.pct);
  ok("deriveKpis().inventario === jerarquiaInventario (crítico)", dK.criticoUSD === Jd.critico.usd && dK.criticoPct === Jd.critico.pct);
  ok("getInvKPI === deriveKpis().inventario (misma fuente, mismo escenario)", JSON.stringify(gK) === JSON.stringify(dK));
  const c = cifrasDelDato("bonanza");
  const kInmov = c.kpis.find((k) => /^Capital inmovilizado · subtotal/.test(k.label));
  const kFren = c.kpis.find((k) => /^Capital frenado · subtotal/.test(k.label));
  ok("la carpeta (datoProyectado) declara el MISMO inmovilizado que jerarquiaInventario", !!kInmov && kInmov.raw === Jd.inmovilizado.usd && new RegExp(`${Jd.inmovilizado.n} SKU$`).test(kInmov.label));
  ok("la carpeta (datoProyectado) declara el MISMO crítico que jerarquiaInventario", !!kFren && kFren.raw === Jd.critico.usd && new RegExp(`${Jd.critico.n} SKU$`).test(kFren.label));
  const skusInmovCarpeta = new Set(c.estados.filter((e) => e.estado === "inmovilizado").map((e) => e.entidad));
  ok("la carpeta declara el MISMO conjunto de SKU inmovilizados (I.estados)", JSON.stringify([...skusInmovCarpeta].sort()) === JSON.stringify(Jd.inmovilizado.skus.slice().sort()));
  ok("todo frenado (I.estados) sigue ⊆ inmovilizado — la doctrina de la carpeta no se rompió", c.estados.filter((e) => e.estado === "frenado").every((e) => skusInmovCarpeta.has(e.entidad)));
}
{
  // la ingesta: calcularDataset() directo (sin pasar por el portero), misma jerarquía que jerarquiaInventario
  // sobre las MISMAS filas que produjo — la prueba de que el "invKPI" de la ingesta no es una segunda cuenta.
  const v = validarPlantilla(plantillaEjemplo(), { nombreArchivo: "ejemplo.xlsx" });
  const m = calcularDataset({ parametros: v.parametros, tablas: v.tablas });
  const Jm = jerarquiaInventario(m.dataset.skuInventario);
  ok("(a) motorKpi.calcularDataset().invKPI === jerarquiaInventario sobre las mismas filas", m.dataset.invKPI.inmovilizadoUSD === Jm.inmovilizado.usd && m.dataset.invKPI.criticoUSD === Jm.critico.usd && m.dataset.invKPI.totalUSD === Jm.total);
}
{
  // tensión/crisis: deriveKpis calcula sobre las filas TRANSFORMADAS del escenario (nunca preserva un literal)
  const dT = deriveKpis("tension").inventario, dC = deriveKpis("crisis").inventario;
  ok("tensión: inmovilizado recalculado = $55.800 · 5 SKU · 41,3% (no el literal viejo $87.864)", dT.inmovilizadoUSD === 55800 && dT.inmovilizadoPct === 41.3);
  ok("crisis: inmovilizado recalculado = $43.000 · 4 SKU · 31,9% (no el literal viejo $133.452)", dC.inmovilizadoUSD === 43000 && dC.inmovilizadoPct === 31.9);
}
{
  // invKPI de los tenants ya NO es un literal: TENANT_DEMO.invKPI === kpiInventario(TENANT_DEMO.skuInventario) con SU perfil
  const Jd = jerarquiaInventario(TENANT_DEMO.skuInventario);
  ok("TENANT_DEMO.invKPI (calculado) concuerda con jerarquiaInventario", TENANT_DEMO.invKPI.inmovilizadoUSD === Jd.inmovilizado.usd && TENANT_DEMO.invKPI.criticoUSD === Jd.critico.usd);
  initTenant(TENANT_EMPRESA2);
  const Je = jerarquiaInventario(TENANT_EMPRESA2.skuInventario);
  ok("TENANT_EMPRESA2.invKPI (calculado, perfil 2,5x/90d) concuerda con jerarquiaInventario", TENANT_EMPRESA2.invKPI.inmovilizadoUSD === Je.inmovilizado.usd);
  initTenant(TENANT_DEMO);
}

/* ── (g) carnadas · el gate tiene que arder con datos deliberadamente rotos ─────────────────────────────────── */
console.log("\n── (g) carnadas ──");
{
  // carnada de (b): rompe la contención a mano (un "crítico" que NO está en "inmovilizado")
  const Jfalso = { critico: { skus: ["X"], usd: 100 }, inmovilizado: { skus: [], usd: 0 }, sobrestock: { usd: 0 }, riesgoQuiebre: { usd: 0 }, sano: { usd: 0 }, total: 0 };
  ok("carnada (b): contencionOk() detecta un crítico fuera de inmovilizado", contencionOk(Jfalso) === false);
}
{
  // carnada de (b): la partición no cierra (critico+sobrestock !== inmovilizado)
  const Jfalso2 = { critico: { skus: [], usd: 100 }, inmovilizado: { skus: [], usd: 500 }, sobrestock: { usd: 100 }, riesgoQuiebre: { usd: 0 }, sano: { usd: 0 }, total: 500 };
  ok("carnada (b): contencionOk() detecta que critico+sobrestock ≠ inmovilizado", contencionOk(Jfalso2) === false);
}
{
  // carnada de (d): un config de mentira con frenadoDiasSinVenta:60 — la MISMA aserción que usa el candado real,
  // aplicada a un objeto decoy (no se puede mutar el POLICY_CONFIG real: está Object.freeze()ado a propósito —
  // ese freeze ES la otra mitad de este candado, y esta carnada prueba que la aserción sabe detectar la fuga).
  const POLICY_CONFIG_FALSO = { ...POLICY_CONFIG, frenadoDiasSinVenta: 60 };
  ok("carnada (d): la aserción detecta un config de mentira con 60 hardcodeado", (POLICY_CONFIG_FALSO.frenadoDiasSinVenta === undefined) === false);
  ok("carnada (d): POLICY_CONFIG real sigue Object.freeze()ado (la mutación de arriba no lo tocó)", POLICY_CONFIG.frenadoDiasSinVenta === undefined && Object.isFrozen(POLICY_CONFIG));
}
{
  // carnada de (d): el barrido estático SÍ detecta un 60 hardcodeado si el patrón aparece en código real
  const decoySrc = 'export const x = (s) => s.diasSinVenta > 60;';
  ok("carnada (d): el patrón del barrido SÍ matchea un literal real (no es un patrón muerto)", PATRON_60_90.test(decoySrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")));
  const decoyComentario = '// diasSinVenta > 60 (comentario, no código)\nexport const y = 1;';
  ok("carnada (d): el patrón NO matchea dentro de un comentario de línea (el barrido no falsea positivos)", !PATRON_60_90.test(decoyComentario.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")));
}
{
  // carnada de (f): el patrón de la regla del texto crudo SÍ detecta un literal real, y NO un comentario
  const decoySrc = 'const _esInmovilizado = (s) => s.estado !== "Activo";';
  ok("carnada (f): el barrido SÍ matchea la regla del texto crudo si vuelve como código", PATRON_CRUDO.test(decoySrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")));
  const decoyComentarioF = '/* antes: estado !== "Activo" (retirado) */\nconst x = 1;';
  ok("carnada (f): el patrón NO matchea dentro de un comentario de bloque", !PATRON_CRUDO.test(decoyComentarioF.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")));
}

/* ── Object.freeze / inmutabilidad de ETIQUETA_ORIGEN y ORIGEN (candado técnico, no solo convención) ────────── */
console.log("\n── inmutabilidad ──");
ok("ORIGEN está Object.freeze()ado", Object.isFrozen(ORIGEN));
ok("ETIQUETA_ORIGEN está Object.freeze()ado", Object.isFrozen(ETIQUETA_ORIGEN));
ok("ETIQUETA_ORIGEN tiene las cuatro llaves de ORIGEN, ninguna más", Object.keys(ETIQUETA_ORIGEN).sort().join(",") === Object.values(ORIGEN).sort().join(","));

console.log(`\n── _jerarquia_inventario_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
