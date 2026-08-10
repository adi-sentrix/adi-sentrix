/* === _entity_label_convention_gate.mjs · GATE de la convención de label "Entidad · Concepto" (boleta.js fig()) ===
 * Regla madre (boleta.js · narratePromptC.js `_groupByEntity`/`_needsTableFormat` · comentario owner 2026-08-02 en
 * composeSpecMargin): TODA figura de boleta que compara/lista entidades sigue "Entidad · Concepto" — el PRIMER
 * trozo (antes de " · ") es el NOMBRE REAL de la entidad (bodega/cliente/SKU/marca/familia del dataset), el
 * segundo el concepto (Margen, Carga, Stock…). El bug YA se cazó y arregló una vez en composeSpecMargin (commit
 * b395e72, memoria "ADI refuerzo formato narrativo"): "antes era `${dimension} · ${entidad} margen`" (ej.
 * "cliente · Lider margen") — el prefijo de DIMENSIÓN en vez del nombre de la entidad rompía cualquier detector
 * que agrupe cifras por entidad (_needsTableFormat) y además el LLM a veces copiaba el label crudo a una tabla.
 * Esa auditoría tocó SOLO composeSpecMargin (`figMargin`, línea ~814) — este gate barre los otros 4 composers
 * spec-driven (Inventory/Ventas/Contribución/Diagnose) por si el MISMO patrón quedó sin corregir en algún foco
 * que esa pasada no miró.
 *
 * Método: sin mocks del composer — import directo de las 5 funciones reales, args realistas (mismo estilo que
 * los gates hermanos _table_format_gate.mjs/_oracle_mechanism_gate.mjs), y una `_groupByEntity` REIMPLEMENTADA acá
 * mismo (a propósito: este gate no debe importar la de narratePromptC.js — si comparte código con lo que audita,
 * un bug en esa función quedaría ciego a sí mismo). Contra cada boleta corren DOS asserts complementarios:
 *   (A) ningún primer-trozo es EXACTO (case/acento-insensitive) a un rótulo de dimensión genérico conocido —
 *       Bodega/SKU/Cliente/Familia/Inventario/Causa/Margen/Venta/Stock/Contribución/Carga/Recuperable/Liberable.
 *   (B) 2+ primeros-trozos DISTINTOS son nombres reales del dataset — cross-check directo contra demoData.js/
 *       skusMargen.js (la MISMA fuente que cargan los composers vía specRetrieval.js), no una lista inventada.
 * Si (A) o (B) fallan, el log imprime el grupo/label EXACTO ofensor — no hay que adivinar cuál.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { composeSpecInventory, composeSpecMargin, composeSpecVentas, composeSpecContribucion, composeSpecDiagnose } from "./src/adi/specRetrieval.js";
import { clientesVentas, marcasVentas, sfamiliasVentas, skuInventario } from "./src/data/demoData.js";
import { skusMargen } from "./src/data/skusMargen.js";

const SC = "actual";
let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; return cond; };

// ── normalización (mismo criterio que `_norm` de specRetrieval.js/entityRecord.js: minúscula + sin acentos) ──
const _norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// ── el rótulo de dimensión GENÉRICO que NUNCA debe ser el primer trozo (síntoma directo del bug reportado) ──
const GENERIC_DIMENSION_LABELS = new Set(
  ["Bodega", "SKU", "Cliente", "Familia", "Inventario", "Causa", "Margen", "Venta", "Stock", "Contribución", "Carga", "Recuperable", "Liberable"].map(_norm)
);

// ── ground truth: nombres REALES del dataset demo — misma fuente que cargan los composers (specRetrieval.js
// importa estos mismos módulos), cero lista inventada a mano ──
const KNOWN_ENTITIES = new Set();
for (const r of clientesVentas)  if (r && r.nombre) KNOWN_ENTITIES.add(_norm(r.nombre));
for (const r of marcasVentas)    if (r && r.nombre) KNOWN_ENTITIES.add(_norm(r.nombre));
for (const r of sfamiliasVentas) if (r && r.nombre) KNOWN_ENTITIES.add(_norm(r.nombre));
for (const r of skuInventario)   { if (r && r.bodega) KNOWN_ENTITIES.add(_norm(r.bodega)); if (r && r.sku) KNOWN_ENTITIES.add(_norm(r.sku)); }
for (const r of skusMargen)      if (r && r.nombre) KNOWN_ENTITIES.add(_norm(r.nombre));
console.log(`(setup) ${KNOWN_ENTITIES.size} nombres reales de entidad cargados del dataset demo (cliente/marca/familia/bodega/sku)\n`);

// ── _groupByEntity: REIMPLEMENTACIÓN LOCAL (ver header) del helper de narratePromptC.js — separa cada label de
// boleta por " · ", el primer trozo es la entidad, el resto es el concepto. Labels sin " · " (subtotales de
// cartera tipo "Contribución total") quedan fuera del alcance: no son una figura "Entidad · Concepto".
function _groupByEntity(boleta) {
  const byEntity = new Map();
  if (!Array.isArray(boleta)) return byEntity;
  for (const f of boleta) {
    const label = (f && f.label) || "";
    const idx = label.indexOf(" · ");
    if (idx < 0) continue;
    const entidad = label.slice(0, idx).trim();
    const concepto = label.slice(idx + 3).trim();
    if (!byEntity.has(entidad)) byEntity.set(entidad, []);
    byEntity.get(entidad).push(concepto);
  }
  return byEntity;
}

// ── el assert central: dado un composer YA LLAMADO, verifica la convención sobre su boleta ──
function _checkConvention(composerLabel, result) {
  console.log(`── ${composerLabel} ──`);
  const hasBoleta = !!(result && result.evidence && Array.isArray(result.evidence.boleta));
  ok(hasBoleta, `${composerLabel}: devuelve evidence.boleta`);
  if (!hasBoleta) { console.log(); return; }
  const bol = result.evidence.boleta;
  ok(bol.length >= 2, `${composerLabel}: boleta trae 2+ figs (trae ${bol.length})`);

  const groups = _groupByEntity(bol);
  const groupKeys = [...groups.keys()];
  console.log(`  grupos (entidad→conceptos): ${groupKeys.map((k) => `"${k}"→[${groups.get(k).join(", ")}]`).join("  ·  ") || "(ninguno con separador ' · ')"}`);

  // (A) ningún primer-trozo es un rótulo de dimensión genérico
  const badKeys = groupKeys.filter((k) => GENERIC_DIMENSION_LABELS.has(_norm(k)));
  ok(badKeys.length === 0, `${composerLabel}: ningún label usa un rótulo de dimensión genérico como entidad`);
  for (const bk of badKeys) {
    const offending = bol.filter((f) => f && typeof f.label === "string" && f.label.startsWith(`${bk} · `));
    console.log(`    ✗ BUG — entidad="${bk}" (rótulo de dimensión genérico, no un nombre real) en: ${offending.map((f) => `"${f.label}"`).join(", ")}`);
  }

  // (B) 2+ entidades DISTINTAS y REALES (cross-check contra el dataset) como primer trozo
  const realKeys = groupKeys.filter((k) => KNOWN_ENTITIES.has(_norm(k)));
  ok(realKeys.length >= 2, `${composerLabel}: 2+ entidades reales distintas reconocidas como primer trozo (encontradas: ${realKeys.join(", ") || "ninguna"})`);
  if (realKeys.length < 2) {
    const unrecognized = groupKeys.filter((k) => !realKeys.includes(k));
    console.log(`    ✗ primeros-trozo NO reconocidos como entidad real del dataset: ${unrecognized.map((k) => `"${k}"`).join(", ") || "(ninguno)"}`);
  }
  console.log();
}

console.log("######## 1 · composeSpecInventory ########");
_checkConvention('composeSpecInventory({focus:"top_sellers"})', composeSpecInventory({ scenario: SC, focus: "top_sellers" }));
_checkConvention('composeSpecInventory({} → focus:"frenado" default)', composeSpecInventory({ scenario: SC }));

console.log("######## 2 · composeSpecMargin ########");
_checkConvention('composeSpecMargin({focus:"bajo_benchmark", dimension:"cliente"})', composeSpecMargin({ scenario: SC, focus: "bajo_benchmark", dimension: "cliente" }));
_checkConvention('composeSpecMargin({focus:"stock_bajo_margen"})', composeSpecMargin({ scenario: SC, focus: "stock_bajo_margen" }));

console.log("######## 3 · composeSpecVentas ########");
_checkConvention('composeSpecVentas({} → dimension:"cliente" default)', composeSpecVentas({ scenario: SC }));
_checkConvention('composeSpecVentas({focus:"rank_venta", dimension:"sku"})', composeSpecVentas({ scenario: SC, focus: "rank_venta", dimension: "sku" }));

console.log("######## 4 · composeSpecContribucion ########");
_checkConvention('composeSpecContribucion({} → focus:"rank" default)', composeSpecContribucion({ scenario: SC }));
_checkConvention('composeSpecContribucion({focus:"alta_venta_baja_contribucion"})', composeSpecContribucion({ scenario: SC, focus: "alta_venta_baja_contribucion" }));
_checkConvention('composeSpecContribucion({focus:"no_capturada"})', composeSpecContribucion({ scenario: SC, focus: "no_capturada" }));

console.log("######## 5 · composeSpecDiagnose ########");
_checkConvention('composeSpecDiagnose({}) — focos comerciales+capital', composeSpecDiagnose({ scenario: SC }));

console.log(`── _entity_label_convention_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
