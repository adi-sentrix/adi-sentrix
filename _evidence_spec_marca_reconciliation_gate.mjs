/* === _evidence_spec_marca_reconciliation_gate.mjs · marca · 3 caminos aritméticos, RECONCILIADOS ===
 * Historia: nació como residual CONOCIDO documentado a propósito (brief original: "escribí el gate igual... y
 * reportalo con claridad al integrador — no lo silencies ni lo escondas ajustando el gate para que pase").
 * Owner 2026-08-03: "Toma ahora el único residual real de la suite... corrige la reconciliación... no relajes el
 * gate para hacerlo pasar." CERRADO — las 18 aserciones de abajo (D1-D4) están INTACTAS, byte-a-byte, desde el
 * hallazgo original; lo que cambió es el CÓDIGO que miden, no el gate.
 *
 * REGLA CENTRAL en juego: "ADI asesora; Sentrix demuestra" — Sentrix debe mostrar la MISMA cifra para la MISMA
 * entidad en el MISMO turno, sin importar qué panel/composer la calcule.
 *
 * HALLAZGO ORIGINAL (más severo de lo que sugiere una lectura superficial — medido en dólares NORMALIZADOS abajo,
 * no en los números crudos tal cual aparecen en cada tabla, que usaban DOS CONVENCIONES DE ESCALA DISTINTAS):
 *   · marcasMargen/marcasVentas (`entityRecord.js` F-table: `venta`/`contribucion` con `k:true`) guardan el
 *     valor en MILES de dólares — 31600 significa $31.6M (misma convención que clientesMargen/clientesVentas).
 *   · skusMargen (`kpis.js._marcaKPIs`, agregación Σ por marca — ANTES del fix) guardaba el valor en dólares
 *     CRUDOS — 31600 significa $31,600 (misma convención que skuInventario).
 *   Ambas tablas daban casualmente "el mismo número" (31600) para Samsung/ventas, pero en DOS ESCALAS distintas
 *   → el panel "Diagnóstico" de Sentrix (kpis.js) mostraba literalmente "$31.6K" en ventas de marca Samsung
 *   mientras que `entityRecord` y el Cuadro/Pareto (marcasMargen) mostraban "$31.6M" para la MISMA marca — un
 *   factor ~1000x, no un redondeo.
 *
 * LOS 3+1 CAMINOS (medidos en vivo abajo contra el dataset demo real, normalizados a USD real):
 *   1. TABLA `marcasMargen` (estática, escala "miles", scenario-BLIND por diseño — igual que entityRecord.js lee
 *      clientesMargen siempre en "actual", ver comentario ahí). Consumida por: `entityRecord` tool del oráculo,
 *      concentration.js `_contribRows` (Pareto de contribución), cuadro.js `_marcas`, router.js `_brandRow`.
 *   2. `applyScenarioToMarcasMargen` (engine/scenarios.js, NUEVO 2026-08-03) — venta reconciliada contra
 *      `applyScenarioToMarcasVentas` (single source, mismo patrón D8 de clientesVentas/clientesMargen),
 *      contribución re-derivada de esa venta × margen% (cierra siempre, responde al escenario). Consumida por:
 *      kpis.js `_marcaKPIs` (la tira "Diagnóstico" que el usuario VE en el panel de Sentrix) — antes reagregaba
 *      skusMargen (raw $, scenario-blind); control.js `_marcaStats`/`_marcaRing` (la lente Control) sigue
 *      pendiente de la misma migración si en el futuro se detecta la misma divergencia ahí (no testeado en
 *      este gate — fuera de las 4 dimensiones D1-D4 que mide).
 *   3. `applyScenarioToMarcasVentas` (preexistente, escala "miles", SCENARIO-AWARE) — solo para VENTAS.
 *      Consumida por: concentration.js `_rows` (Pareto de ventas) Y AHORA TAMBIÉN camino 2 (arriba).
 *
 * PURO · sin LLM · sin red · determinístico.
 */
import fs from "fs";
import { buildEntityKPIs } from "./src/adi/sentrix/kpis.js";
import { buildConcentration } from "./src/adi/sentrix/concentration.js";
import { rawRecordFor } from "./src/adi/oracle/entityRecord.js";
import { skusMargen } from "./src/data/skusMargen.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);

let pass = 0; const fails = [];
const ok = (cond, label, extra) => { if (cond) pass++; else fails.push({ label, extra }); console.log(`  ${cond ? "✓" : "✗"} ${label}`); };
const numFromFmt = (s) => { const m = String(s).match(/(-?[\d.]+)\s*([KMB]?)/i); if (!m) return null; let v = parseFloat(m[1]); const u = m[2].toUpperCase(); if (u === "K") v *= 1e3; else if (u === "M") v *= 1e6; else if (u === "B") v *= 1e9; return v; };
const usdFmt = (v) => v == null ? "—" : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${Math.round(v / 1e3)}K`;

console.log("\n═══ RESIDUAL CONOCIDO · marca: 3 caminos aritméticos NO reconciliados (normalizado a USD real) ═══\n");

const MARCAS = ["Samsung", "LG", "Philips"];
const SCENARIOS = ["actual", "bonanza", "crisis"];

// ── extractores · TODOS normalizados a USD REAL (no a los dígitos crudos de cada tabla) ───────────────────────────
// camino 1 · marcasMargen (escala "miles" — k:true en entityRecord.js F-table → ×1000 para USD real)
function camino1(marca) {
  const rec = rawRecordFor("marca", marca);
  if (!rec) return null;
  return { venta_usd: rec.venta * 1000, contribucion_usd: rec.contribucion * 1000, margen_pct: rec.margen };
}
// camino 1b · concentration.js (mismas tablas que camino 1 → misma escala "miles")
function camino1b(marca, scenario) {
  const contrib = buildConcentration("marca", scenario, "contribucion").bars.find((x) => x.name === marca);
  return { contribucion_usd: contrib ? contrib.value * 1000 : null };
}
// camino 2 · kpis.js._marcaKPIs vía buildEntityKPIs("marca",...) — parsea el STRING YA FORMATEADO que ve el
// usuario (unit-aware: "$31.6K" → 31600, NO asumir "miles" a ciegas — así el diff reportado es el REAL, el que
// el usuario efectivamente lee en el panel).
function camino2(marca, scenario) {
  const rows = buildEntityKPIs("marca", marca, scenario);
  const venta = rows.find((x) => x.label === "Ventas");
  const contrib = rows.find((x) => x.label === "Contribución");
  const margen = rows.find((x) => x.label === "Margen");
  return { venta_usd: venta ? numFromFmt(venta.value) : null, contribucion_usd: contrib ? numFromFmt(contrib.value) : null, margen_pct: margen ? numFromFmt(margen.value) : null };
}
// camino 3 · concentration.js Pareto de VENTAS (marcasVentas escenario-ajustado — misma escala "miles" que camino 1)
function camino3(marca, scenario) {
  const bar = buildConcentration("marca", scenario, "ventas").bars.find((x) => x.name === marca);
  return { venta_usd: bar ? bar.value * 1000 : null };
}

const detalle = [];
for (const marca of MARCAS) {
  console.log(`── ${marca} ──`);
  const c1 = camino1(marca);
  console.log(`  camino 1 (marcasMargen/entityRecord, escala "miles") · venta=${usdFmt(c1.venta_usd)} · contribución=${usdFmt(c1.contribucion_usd)} · margen=${c1.margen_pct}%`);
  for (const s of SCENARIOS) {
    const c1b = camino1b(marca, s);
    const c2 = camino2(marca, s);
    const c3 = camino3(marca, s);
    console.log(`  [${s}] c1b contrib.Pareto=${usdFmt(c1b.contribucion_usd)} · c2 (kpis.js, el panel que VE el usuario) venta=${usdFmt(c2.venta_usd)} contrib=${usdFmt(c2.contribucion_usd)} margen=${c2.margen_pct}% · c3 (ventas ajustada por escenario)=${usdFmt(c3.venta_usd)}`);
    detalle.push({ marca, scenario: s, camino1: c1, camino1b: c1b, camino2: c2, camino3: c3 });
  }
  console.log("");
}

// ── D1 · ESCALA: venta/contribución camino1 (entityRecord, "$M") vs camino2 (kpis.js panel, "$K") — la MISMA
// entidad en el MISMO turno muestra magnitudes ~1000x distintas, no solo un número distinto ──────────────────────
console.log("── D1 · ESCALA — camino1 (entityRecord/Cuadro, escala millones) vs camino2 (panel kpis.js, escala miles) ──");
for (const marca of MARCAS) {
  const c1 = camino1(marca);
  const c2 = camino2(marca, "actual");
  const ratioVenta = c1.venta_usd && c2.venta_usd ? c1.venta_usd / c2.venta_usd : null;
  const ratioContrib = c1.contribucion_usd && c2.contribucion_usd ? c1.contribucion_usd / c2.contribucion_usd : null;
  ok(ratioVenta != null && Math.abs(ratioVenta - 1) < 0.05, `${marca}: venta camino1(${usdFmt(c1.venta_usd)}) === camino2(${usdFmt(c2.venta_usd)}) — hoy la razón es ${ratioVenta ? ratioVenta.toFixed(0) + "x" : "?"} (¡debería ser 1x!)`, { c1, c2 });
  ok(ratioContrib != null && Math.abs(ratioContrib - 1) < 0.05, `${marca}: contribución camino1(${usdFmt(c1.contribucion_usd)}) === camino2(${usdFmt(c2.contribucion_usd)}) — hoy la razón es ${ratioContrib ? ratioContrib.toFixed(0) + "x" : "?"} (¡debería ser 1x!)`, { c1, c2 });
}

// ── D2 · margen (%, mismo tipo de unidad en ambos caminos — comparable directo, sin problema de escala) ──────────
console.log("\n── D2 · margen % · camino1 (marcasMargen) vs camino2 (skusMargen agregado) — deberían coincidir ──");
for (const marca of MARCAS) {
  const c1 = camino1(marca);
  const c2 = camino2(marca, "actual");
  const diffPct = c1.margen_pct != null && c2.margen_pct != null ? Math.abs(c1.margen_pct - c2.margen_pct) : null;
  ok(diffPct != null && diffPct < 0.1, `${marca}: margen camino1(${c1.margen_pct}%) === camino2(${c2.margen_pct}%) — diff=${diffPct != null ? diffPct.toFixed(1) : "?"}pp`, { c1, c2 });
}

// ── D3 · kpis.js (buildEntityKPIs → _marcaKPIs) ignora el escenario por completo para marca ────────────────────────
console.log("\n── D3 · kpis.js/_marcaKPIs debería responder al escenario activo (como sí lo hace para cliente) ──");
for (const marca of MARCAS) {
  const act = camino2(marca, "actual");
  const bon = camino2(marca, "bonanza");
  const igual = JSON.stringify(act) === JSON.stringify(bon);
  ok(!igual, `${marca}: kpis.js/_marcaKPIs cambia entre escenario 'actual' y 'bonanza' (hoy: byte-igual — _marcaKPIs no recibe/usa ningún ajustador de escenario)`, { act, bon });
}

// ── D4 · ventas bajo escenario activo: camino2 (estática) vs camino3 (ajustada) — deberían coincidir ──────────────
console.log("\n── D4 · ventas bajo escenario activo: camino2 (estática, panel kpis.js) vs camino3 (ajustada por escenario) ──");
for (const marca of MARCAS) {
  for (const s of ["bonanza", "crisis"]) {
    const c2 = camino2(marca, s);
    const c3 = camino3(marca, s);
    const diff = c2.venta_usd != null && c3.venta_usd != null ? Math.abs(c2.venta_usd - c3.venta_usd) : null;
    ok(diff != null && diff < 1000, `${marca} [${s}]: ventas camino2(${usdFmt(c2.venta_usd)}, no ajusta escenario) === camino3(${usdFmt(c3.venta_usd)}, sí ajusta) — diff=${usdFmt(diff)}`, { c2, c3 });
  }
}

console.log("\n── causa raíz ORIGINAL (histórico — CERRADO 2026-08-03, ver docblock arriba) ──");
console.log('  1. ESCALA: entityRecord.js F-table marca `venta`/`contribucion` con `k:true` (miles de USD, igual que');
console.log('     clientesMargen) vs skusMargen (kpis.js._marcaKPIs, ANTES del fix) en USD crudo — mismo dígito');
console.log('     "31600", dos magnitudes reales ~1000x distintas.');
console.log('  2. marcasMargen (tabla estática) vs ΣskusMargen filtrado por marca eran DOS fuentes de dato');
console.log('     independientes — kpis.js ahora lee `applyScenarioToMarcasMargen` (misma fuente que entityRecord).');
console.log('  3. kpis.js._marcaKPIs(name) no recibía `scenario` desde buildEntityKPIs — corregido: recibe y usa `s`.');
console.log('  4. Precedente CLIENTE (D8, owner 2026-07-29): clientesVentas.actual como única fuente de venta,');
console.log('     contribución/margen re-derivados desde ahí — el MISMO patrón se aplicó acá a marca (2026-08-03):');
console.log('     `applyScenarioToMarcasMargen` (engine/scenarios.js, nuevo) reconcilia venta contra');
console.log('     `applyScenarioToMarcasVentas` (preexistente) + re-deriva contribución = venta × margen%.');

const summary = { total: pass + fails.length, pass, fails, detalle };
fs.writeFileSync("_evidence_spec_marca_reconciliation_gate.json", JSON.stringify(summary, null, 2));
console.log(`\n${pass}/${pass + fails.length} chequeos correctos${fails.length ? ` · ${fails.length} divergencias reales — NO cerrado` : " ✓ — reconciliación CERRADA"}`);
console.log("→ _evidence_spec_marca_reconciliation_gate.json");
process.exit(fails.length ? 1 : 0);
