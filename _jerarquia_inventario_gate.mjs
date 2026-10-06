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
 * ETAPA 3 (diseño §8.3, `_ADI_CONTRATO_ENCARGO_V1.md` §7.3·34c): la Mesa Capital y la pantalla leen la fuente
 * única. Agrega la comprobación (e) del diseño PARA LA PANTALLA (`buildMesaCapital`, `src/adi/sentrix/mesaCapital.js`):
 *   · los mismos SKU y montos que `jerarquiaInventario`/`kpiInventario` en la pestaña "Capital inmovilizado"
 *     (`drill.detenido`) y en "Días sin venta" (`diasSinVenta`);
 *   · cada veredicto que depende de un umbral lleva su ORIGEN (una de las cuatro `ETIQUETA_ORIGEN`), en la
 *     definición de cada tramo y en el cruce de "Días sin venta";
 *   · SIN umbral declarado, ninguna fila de "Días sin venta" se marca «Frenada» (el candado (c), ahora también
 *     para la pantalla);
 *   · los HECHOS de "Días sin venta" (unidades vendidas, "última venta") salen de CAMPOS DEL DATO
 *     (`vendidoMes`/`diasSinVenta` del inventario), nunca de un texto armado a mano — se releen los campos crudos
 *     y se comparan byte a byte contra lo que la vista emite.
 * El estándar es SEMÁNTICO (decisión ·34d): no se barre una lista de palabras prohibidas, se comprueba la
 * ESTRUCTURA (mismos conjuntos, misma procedencia, mismos campos de origen). */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { TENANT_EMPRESA2 } from "./src/data/tenants/empresa2.js";
import { TENANT_VACIO } from "./src/data/tenantEmpty.js";
import { applyScenarioToSkuInventario } from "./src/engine/scenarios.js";
/* UNA SOLA REALIDAD (owner 2026-10-06): «tensión» y «crisis» ya no son escenarios del motor — son MUNDOS DE PRUEBA que el gate construye
 * con un insumo explícito (filas perturbadas, scripts/mundos-de-prueba.mjs), con la misma aritmética de siempre. Las propiedades que se
 * guardan (jerarquía, contención, la pantalla sigue a la fuente) se prueban en el mundo de fábrica y en esos dos negocios distintos. */
import { inventarioTension, inventarioCrisis } from "./scripts/mundos-de-prueba.mjs";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { validarPlantilla } from "./src/ingesta/plantilla/validarPlantilla.js";
import { jerarquiaInventario, kpiInventario } from "./src/adi/diagnosis/economicDiagnosis.js";
import { umbral, umbralesDeInventario, ORIGEN, ETIQUETA_ORIGEN, POLICY_CONFIG, setCriterioOverride } from "./src/config/businessPolicy.js";
import { deriveKpis } from "./src/engine/scenarios.js";
import { getInvKPI } from "./src/engine/metrics.js";
import { calcularDataset } from "./src/ingesta/plantilla/motorKpi.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { buildMesaCapital } from "./src/adi/sentrix/mesaCapital.js";
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
const Jtension = jerarquiaInventario(inventarioTension(TENANT_DEMO.skuInventario));
ok("tensión: total sigue $135.000 (el escenario no toca stockUSD, ver diseño §0.4)", Jtension.total === 135000);
ok("tensión: inmovilizado = $55.800 · 5 SKU · 41,3% (+SAM-TV55 en sobrestock)", Jtension.inmovilizado.usd === 55800 && Jtension.inmovilizado.n === 5 && Jtension.inmovilizado.pct === 41.3);
ok("tensión: crítico = $33.200 · 3 SKU (el mismo conjunto que bonanza)", Jtension.critico.usd === 33200 && Jtension.critico.n === 3);
ok("tensión: (b) contención", contencionOk(Jtension));

const Jcrisis = jerarquiaInventario(inventarioCrisis(TENANT_DEMO.skuInventario));
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
  // RENOMBRE (owner 2026-09-28, §7.3·30-34, etapa 5): «Capital frenado · subtotal» → «Capital inmovilizado crítico · subtotal».
  const kFren = c.kpis.find((k) => /^Capital inmovilizado cr[ií]tico · subtotal/.test(k.label));
  ok("la carpeta (datoProyectado) declara el MISMO inmovilizado que jerarquiaInventario", !!kInmov && kInmov.raw === Jd.inmovilizado.usd && new RegExp(`${Jd.inmovilizado.n} SKU$`).test(kInmov.label));
  ok("la carpeta (datoProyectado) declara el MISMO crítico que jerarquiaInventario", !!kFren && kFren.raw === Jd.critico.usd && new RegExp(`${Jd.critico.n} SKU$`).test(kFren.label));
  const skusInmovCarpeta = new Set(c.estados.filter((e) => e.estado === "inmovilizado").map((e) => e.entidad));
  ok("la carpeta declara el MISMO conjunto de SKU inmovilizados (I.estados)", JSON.stringify([...skusInmovCarpeta].sort()) === JSON.stringify(Jd.inmovilizado.skus.slice().sort()));
  // MIGRACIÓN (owner 2026-09-28, §7.3·30-34, etapa 5): canon «frenado» → «inmovilizado critico».
  ok("todo inmovilizado crítico (I.estados) sigue ⊆ inmovilizado — la doctrina de la carpeta no se rompió", c.estados.filter((e) => e.estado === "inmovilizado critico").every((e) => skusInmovCarpeta.has(e.entidad)));
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
  // tensión/crisis (mundos de prueba): el KPI se CALCULA sobre las filas del mundo (nunca preserva un literal) — deriveKpis sobre el tenant con esas filas
  const _kpiDe = (filas) => { initTenant({ ...TENANT_DEMO, skuInventario: filas }); const k = deriveKpis("bonanza").inventario; initTenant(TENANT_DEMO); return k; };
  const dT = _kpiDe(inventarioTension(TENANT_DEMO.skuInventario)), dC = _kpiDe(inventarioCrisis(TENANT_DEMO.skuInventario));
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
/* §7.3·58 (bloque 3, procedencia): ORIGEN suma «documental» (lo que dice un archivo que no es la plantilla oficial). Ese origen NUNCA lo devuelve `umbral()` (lo pendiente no se usa y lo confirmado pasa a «empresa» con su rastro): su frase lleva el nombre
 * del documento y la escribe `etiquetaDeProcedencia`, no la tabla fija. La tabla sigue cubriendo los CUATRO orígenes que `umbral()` puede devolver, ninguno más. */
ok("ETIQUETA_ORIGEN tiene las cuatro llaves de ORIGEN que umbral() puede devolver (empresa, adi, consulta, sin_declarar), ninguna más", Object.keys(ETIQUETA_ORIGEN).sort().join(",") === Object.values(ORIGEN).filter((o) => o !== ORIGEN.DOCUMENTAL).sort().join(",") && ORIGEN.DOCUMENTAL === "documental" && !Object.prototype.hasOwnProperty.call(ETIQUETA_ORIGEN, ORIGEN.DOCUMENTAL));

/* ── ETAPA 3 (e) · LA PANTALLA lee la fuente única, con procedencia, y sin marcar «frenado» sin umbral ────────
 * `buildMesaCapital()` (mesaCapital.js) es la única entrada de la cara Capital. Se compara SU salida contra
 * `jerarquiaInventario()`/`kpiInventario()` llamadas aparte con las MISMAS filas — un oráculo independiente del
 * builder, mismo patrón que usa `_mesa_capital_gate.mjs`. */
console.log("\n── ETAPA 3 (e) · la pantalla usa la fuente única, con procedencia ──");
initTenant(TENANT_DEMO);
const _MUNDOS_E = { bonanza: TENANT_DEMO, tension: { ...TENANT_DEMO, skuInventario: inventarioTension(TENANT_DEMO.skuInventario) }, crisis: { ...TENANT_DEMO, skuInventario: inventarioCrisis(TENANT_DEMO.skuInventario) } };
for (const sc of ["bonanza", "tension", "crisis"]) {
  initTenant(_MUNDOS_E[sc]);   /* el negocio de este caso: la pantalla lee SU inventario (insumo explícito, no un escenario del motor) */
  const inv = applyScenarioToSkuInventario("bonanza") || [];
  const J = jerarquiaInventario(inv);
  const K = kpiInventario(inv);
  const mc = buildMesaCapital("bonanza");

  // (e·1) MISMOS SKU Y MONTOS · la pestaña "Capital inmovilizado" (drill.detenido) es el universo ∪ de J
  const skuDrill = mc.drill.detenido.filas.map((f) => f.sku).sort();
  ok(`pestaña "Capital inmovilizado": mismos SKU que J.inmovilizado @${sc}`,
    JSON.stringify(skuDrill) === JSON.stringify(J.inmovilizado.skus.slice().sort()));
  ok(`pestaña "Capital inmovilizado": mismo $ que J.inmovilizado (suma de filas) @${sc}`,
    mc.drill.detenido.filas.reduce((a, f) => a + f.usd, 0) === J.inmovilizado.usd && mc.drill.detenido.n === J.inmovilizado.n);
  ok(`pestaña "Capital inmovilizado": el subtotal crítico declarado === J.critico @${sc}`,
    mc.drill.detenido.criticoN === J.critico.n && mc.drill.detenido.filas.filter((f) => f.situacion === "Crítico").reduce((a, f) => a + f.usd, 0) === J.critico.usd);
  // (e·1b) el KPI de la card y `cap.jerarquia` (expuesto por el módulo) concuerdan con el MISMO J — el KPI y el
  // total de la pestaña usan LA MISMA cadena formateada (una sola verdad entre las dos superficies)
  const kpiDet = mc.kpis.find((k) => k.key === "detenido");
  ok(`KPI "Capital inmovilizado" y la pestaña muestran el MISMO $ formateado @${sc}`, kpiDet.value === mc.drill.detenido.totalFmt);
  ok(`cap.jerarquia expuesto === J (mismos SKU/usd para inmovilizado/crítico/sobrestock) @${sc}`,
    JSON.stringify(mc.jerarquia.inmovilizado.skus.slice().sort()) === JSON.stringify(J.inmovilizado.skus.slice().sort())
    && mc.jerarquia.inmovilizado.usd === J.inmovilizado.usd && mc.jerarquia.critico.usd === J.critico.usd);
  // (e·2) "Días sin venta": mismos SKU/monto que J.inmovilizado/J.critico, fila por fila
  const dsv = mc.diasSinVenta;
  ok(`"Días sin venta": mismos SKU que el inventario completo @${sc}`, dsv.filas.length === inv.length && dsv.totalUsd === J.total);
  const byJ2 = {}; for (const s of J.porSku) byJ2[s.sku] = s;
  ok(`"Días sin venta": inmovilizado/crítico por fila === J.porSku @${sc}`,
    dsv.filas.every((f) => byJ2[f.sku].inmovilizado === f.inmovilizado && byJ2[f.sku].critico === f.critico));

  // (e·3) CADA VEREDICTO LLEVA SU ORIGEN · los tramos (def) y "Días sin venta" (procedenciaInmovilizado) citan
  // una de las cuatro ETIQUETA_ORIGEN — nunca un umbral sin decir de dónde viene (§7.3·32b)
  const ETQ = Object.values(ETIQUETA_ORIGEN);
  const tCritico = mc.mapa.tramos.find((t) => t.key === "capital_frenado");
  ok(`el tramo "inmovilizado crítico" declara su origen en la def @${sc}`, !!tCritico && ETQ.some((e) => tCritico.def.includes(e)));
  ok(`"Días sin venta" declara la procedencia del criterio de inmovilizado @${sc}`, ETQ.some((e) => dsv.procedenciaInmovilizado.includes(e)));
  ok(`el KPI "Capital inmovilizado" (linea) no promete procedencia sin declararla en el criterio del tramo @${sc}`,
    typeof dsv.procedenciaInmovilizado === "string" && dsv.procedenciaInmovilizado.length > 0);

  // (e·4) SIN UMBRAL, NINGUNA MARCA «FRENADO» EN LA PANTALLA (candado (c) del diseño, ahora también en
  // `buildMesaCapital`): en el demo nadie declara `frenadoDiasSinVenta`, así que J.frenado.evaluado === false y
  // ninguna fila de "Días sin venta" ni columna "Venta" de la pestaña puede decir "Frenada".
  ok(`sin umbral declarado, J.frenado.evaluado === false @${sc}`, J.frenado.evaluado === false);
  ok(`sin umbral, ninguna fila de "Días sin venta" dice "Frenada" @${sc}`, dsv.filas.every((f) => f.frenado !== "Frenada"));
  ok(`sin umbral, la pestaña "Capital inmovilizado" NO trae columna "Venta" @${sc}`,
    !mc.drill.detenido.columnas.some((c) => c.key === "venta"));
  ok(`sin umbral, la nota de "Días sin venta" abre la conversación (nunca "no hay frenados") @${sc}`,
    typeof dsv.notaUmbral === "string" && !/no hay/i.test(dsv.notaUmbral) && typeof dsv.askUmbral === "string" && dsv.askUmbral.length > 0);
}
initTenant(TENANT_DEMO);   /* vuelve el negocio de fábrica para el resto del gate */

// con umbral declarado (perfil de la empresa, C.2): la pestaña SÍ trae la columna "Venta" y "Días sin venta"
// marca "Frenada" solo donde el hecho lo sostiene — el veredicto se mide, nunca se asume
{
  setCriterioOverride("frenadoDiasSinVenta", 60);
  const inv = applyScenarioToSkuInventario("bonanza") || [];
  const J = jerarquiaInventario(inv);
  const mc = buildMesaCapital("bonanza");
  ok("con umbral declarado, J.frenado.evaluado === true", J.frenado.evaluado === true);
  ok("con umbral, la pestaña SÍ trae la columna \"Venta\"", mc.drill.detenido.columnas.some((c) => c.key === "venta"));
  const frenadosEnVista = new Set(mc.diasSinVenta.filas.filter((f) => f.frenado === "Frenada").map((f) => f.sku));
  ok("con umbral, \"Frenada\" en la vista === J.frenado.skus exacto", JSON.stringify([...frenadosEnVista].sort()) === JSON.stringify(J.frenado.skus.slice().sort()));
  ok("con umbral, el total de frenado de la vista concuerda con J.frenado", mc.diasSinVenta.frenado.usd === J.frenado.usd && mc.diasSinVenta.frenado.n === J.frenado.n);
  ok("con umbral, la vista declara la procedencia del umbral", mc.diasSinVenta.frenado.procedencia === ETIQUETA_ORIGEN[J.frenado.umbral.origen]);
  setCriterioOverride("frenadoDiasSinVenta", undefined);
}

/* ── ETAPA 3 (e) · LOS HECHOS DE LA VISTA SALEN DE CAMPOS DEL DATO, no de texto armado a mano ─────────────────
 * Se relee el inventario CRUDO (`skuInventario`, con `vendidoMes`/`diasSinVenta` tal como los trae el archivo) y
 * se compara, fila por fila, contra lo que "Días sin venta" emite: el hecho declarado tiene que salir de esos dos
 * campos, nunca de un string inventado. Es el estándar SEMÁNTICO del diseño (·34d): no se barre una lista de
 * palabras, se verifica que la ESTRUCTURA (número de unidades, "hace Nd"/"hoy") sea la que el dato trae. */
console.log("\n── ETAPA 3 (e) · los hechos de \"Días sin venta\" salen de campos del dato ──");
{
  const inv = applyScenarioToSkuInventario("bonanza") || [];
  const mc = buildMesaCapital("bonanza");
  const bySku = {}; for (const r of inv) bySku[r.sku] = r;
  for (const f of mc.diasSinVenta.filas) {
    const r = bySku[f.sku];
    ok(`"Días sin venta" · ${f.sku}: diasSinVenta === el campo crudo del dato`, f.diasSinVenta === (typeof r.diasSinVenta === "number" ? r.diasSinVenta : null));
    ok(`"Días sin venta" · ${f.sku}: vendidoMes === el campo crudo del dato`, f.vendidoMes === (typeof r.vendidoMes === "number" ? r.vendidoMes : null));
    // la fecha de "última venta" es SIEMPRE derivada de `diasSinVenta` (hoy / hace Nd) — nunca un calendario
    // inventado, porque el dato no trae fecha de calendario (solo el relativo)
    const esperado = typeof r.diasSinVenta !== "number" ? "sin dato" : r.diasSinVenta === 0 ? "hoy" : `hace ${r.diasSinVenta}d`;
    ok(`"Días sin venta" · ${f.sku}: "última venta" sale de diasSinVenta, no de texto a mano`, f.ultimaVentaTexto === esperado);
  }
  // sin ventas en el período: la frase exacta, para TODAS las filas con vendidoMes === 0 (nunca una variante).
  // Ningún SKU del demo trae `vendidoMes: 0` de fábrica, así que se muta UNA fila (fixture derivado, mismo
  // patrón que usa `_jerarquia_inventario_gate` para el resto de sus carnadas) para no dejar la rama sin probar.
  const tenantMutado = { ...TENANT_DEMO, skuInventario: TENANT_DEMO.skuInventario.map((s, i) => i === 0 ? { ...s, vendidoMes: 0 } : s) };
  initTenant(tenantMutado);
  const mcMutado = buildMesaCapital("bonanza");
  const filaMutada = mcMutado.diasSinVenta.filas.find((f) => f.sku === TENANT_DEMO.skuInventario[0].sku);
  ok('con vendidoMes:0, la fila dice exactamente "Sin ventas registradas en el período."',
    !!filaMutada && filaMutada.vendidoMes === 0 && filaMutada.texto === "Sin ventas registradas en el período.");
  initTenant(TENANT_DEMO);   // deja el tenant activo en un estado conocido para el resto del proceso
}

console.log(`\n── _jerarquia_inventario_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
