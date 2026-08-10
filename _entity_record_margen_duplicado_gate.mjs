/* === _entity_record_margen_duplicado_gate.mjs · RESIDUAL CONOCIDO (hallazgo nuevo, 2026-07-31) ===
 * Hallado construyendo `_evidence_spec_figfor_gate.mjs` (gates de reconciliación/trazabilidad de evidenceSpec) —
 * NO es el defecto de integridad #1 (kpis.js/benchmarkOf, YA arreglado y verificado, ver ese gate) — es uno
 * DISTINTO, en `src/adi/oracle/entityRecord.js`, en la ruta "el Excel completo" que usa `entityRecord` (la tool
 * oráculo que arma el evidenceSpec.formula/scope para consultas puntuales).
 *
 * EL DEFECTO: para el eje "sku", `_sources("sku")` trae DOS tablas: `skuInventario` (key `sku`) PRIMERO, luego
 * `skusMargen` (key `nombre`). Ambas tienen una columna de margen, pero con NOMBRES DE CAMPO DISTINTOS —
 * `skuInventario.margenPct` vs `skusMargen.margen` — así que `_rawRecord`'s merge (que solo evita colisión cuando
 * la MISMA key ya está poblada) las conserva a AMBAS en el registro crudo. La tabla `F` (metadata de columnas)
 * mapea las DOS al MISMO label humano ("Margen") — así que `_formatRecord` empuja DOS figs con el label EXACTO
 * "<SKU> · Margen" pero valores DIFERENTES a la boleta, sin ningún dedup por label (solo hay un `seenCanon`/`seenVerb`
 * en `ensureBoletaCoversText`, que no se usa acá).
 *
 * POR QUÉ IMPORTA (trazabilidad): `figFor(figs, entidad, metrica)` (boleta.js) es "la ÚNICA forma sancionada de leer
 * un valor ya citado" — devuelve el PRIMER match. Con dos figs "Margen" conflictivas, cuál gana depende del ORDEN
 * de iteración de `Object.entries(rec)` (hoy: skuInventario.margenPct gana, PRIMERA fuente en `_sources`) — un
 * consumidor de evidenceSpec/figFor para un SKU puede terminar citando 22% (skuInventario, un dato REDONDEADO de
 * la vista de inventario) cuando kpis.js/_skuKPIs (la tira "Diagnóstico" que el usuario ve) y buildEntityKPIs
 * ambos usan `skusMargen.margen` = 22.5% (la fuente comercial completa: venta/costo/rebates/contribución) — misma
 * clase de bug que el hallazgo de integridad #1 (dos números para la misma entidad, mismo turno), en OTRO archivo.
 *
 * ALCANCE MEDIDO (13/13 SKUs del dataset demo — cada uno tiene AMBOS campos, así que el defecto es SISTÉMICO en
 * esta ruta, no un caso raro): ver el detalle impreso abajo, corrido en vivo contra el dato real.
 *
 * ESTADO: ARREGLADO (owner 2026-08-10, barrido de ambigüedad de términos). El gate nació FALLANDO a propósito y
 * hoy pasa porque se cerró la causa raíz, no porque se hayan relajado las aserciones (siguen idénticas):
 *   1. `F["margenPct"]` dejó de declarar la etiqueta «Margen» y ahora declara «Margen de inventario» — los dos
 *      campos miden universos distintos (tasa_comercial vs tasa_inventario) y NO reconcilian por declaración, así
 *      que se DISTINGUEN por nombre en vez de taparse. La boleta ya puede traer los dos sin contradecirse.
 *   2. `figFor` (boleta.js) resuelve primero por igualdad EXACTA de segmento y sólo después por `includes` — si no,
 *      pedir "Margen" seguía devolviendo «· Margen de inventario», que aparece primero por orden de fuentes.
 * Este gate queda como CANDADO: si alguien vuelve a declarar dos campos bajo la misma etiqueta, o revierte el
 * orden de match de figFor, vuelve a fallar. PURO · sin LLM · sin red · determinístico.
 */
import fs from "fs";
import { buildEntityRecord } from "./src/adi/oracle/entityRecord.js";
import { skusMargen } from "./src/data/skusMargen.js";
import { figFor } from "./src/adi/boleta.js";

let pass = 0; const fails = [];
const ok = (cond, label, extra) => { if (cond) pass++; else fails.push({ label, extra }); console.log(`  ${cond ? "✓" : "✗"} ${label}`); };

console.log("\n═══ RESIDUAL CONOCIDO · entityRecord.js emite 'Margen' duplicado/conflictivo para SKU ═══\n");

const rows = [];
for (const sku of skusMargen) {
  const r = buildEntityRecord("sku", sku.nombre);
  const margenFigs = (r && r.boleta || []).filter((f) => f.label === `${sku.nombre} · Margen`);
  const values = margenFigs.map((f) => f.value);
  const fromFigFor = figFor(r.boleta, sku.nombre, "Margen");
  rows.push({
    sku: sku.nombre,
    nFigsMargen: margenFigs.length,
    valores: values,
    skusMargen_margen: `${sku.margen}%`,
    figFor_devuelve: fromFigFor ? fromFigFor.value : null,
    figFor_coincide_con_skusMargen: fromFigFor ? fromFigFor.value === `${sku.margen}%` : null,
  });
}

console.log("── detalle por SKU (13/13 del dataset demo) ──");
for (const r of rows) {
  console.log(`  ${r.sku}: ${r.nFigsMargen} fig(s) "Margen" en boleta = [${r.valores.join(", ")}] · skusMargen.margen=${r.skusMargen_margen} · figFor()→${r.figFor_devuelve} · ${r.figFor_coincide_con_skusMargen ? "OK" : "✗ DIVERGE"}`);
}

const conDuplicado = rows.filter((r) => r.nFigsMargen > 1);
const conDivergencia = rows.filter((r) => r.figFor_coincide_con_skusMargen === false);

console.log(`\n── medición ──`);
console.log(`  SKUs con boleta duplicada ("Margen" aparece 2+ veces): ${conDuplicado.length}/${rows.length}`);
console.log(`  SKUs donde figFor() devuelve un valor DISTINTO al que muestra kpis.js/_skuKPIs (skusMargen.margen): ${conDivergencia.length}/${rows.length}`);

// las aserciones EXPRESAN el comportamiento CORRECTO deseado (mismo criterio que la vara del proyecto: una sola
// cifra de margen por entidad, y figFor debe coincidir con lo que kpis.js ya muestra) — quedan FALLANDO hoy a
// propósito, documentando el estado real del código, NO se relajan para que el gate "pase".
ok(conDuplicado.length === 0, "ningún SKU debería tener 2+ figs 'Margen' conflictivas en su entityRecord (hoy: SÍ las tiene — ver detalle arriba)", conDuplicado.map((r) => r.sku));
ok(conDivergencia.length === 0, "figFor(figs, sku, 'Margen') debería coincidir SIEMPRE con skusMargen.margen (la fuente que usa kpis.js) — hoy diverge en los SKUs listados arriba", conDivergencia.map((r) => r.sku));

console.log(`\n── causa raíz (CERRADA · 2026-08-10) ──`);
console.log(`  ERA: F["margen"] (skusMargen · universo comercial) y F["margenPct"] (skuInventario · foto de hoy)`);
console.log(`  declaraban AMBOS label:"Margen", y _sources("sku") recorre skuInventario ANTES que skusMargen.`);
console.log(`  ES: cada campo tiene etiqueta propia ("Margen" / "Margen de inventario") y figFor resuelve por`);
console.log(`  igualdad EXACTA antes que por includes. Los dos universos NO se reconciliaron — se distinguieron.`);

const summary = { total: pass + fails.length, pass, fails, detalle: rows };
fs.writeFileSync("_entity_record_margen_duplicado_gate.json", JSON.stringify(summary, null, 2));
console.log(`\n${pass}/${pass + fails.length} chequeos correctos${fails.length ? " · RESIDUAL CONOCIDO, ver detalle arriba" : " ✓"}`);
console.log("→ _entity_record_margen_duplicado_gate.json");
process.exit(fails.length ? 1 : 0);
