/* === _oracle_venta_d8_gate.mjs · GATE DE UNA-SOLA-VERDAD DE VENTA POR CLIENTE (D8) ===
 * owner 2026-07-29: "ADI debe tener una sola verdad oficial de ventas por cliente. clientesVentas es la fuente
 * oficial (cuadra con el total del negocio/P&L, Σ=$100.0M) — clientesMargen (Σ.venta=$95.2M, un número DISTINTO
 * para el MISMO cliente) deja de ser fuente independiente de venta; solo aporta margen/costo/contribución."
 * Fix real: `applyScenarioToClientesMargen` (engine/scenarios.js) — antes SOLO reconciliaba venta contra
 * clientesVentas cuando había un transform de escenario Y ese cliente tenía entrada en él; el escenario "actual"
 * (default de producción, sin transform) devolvía clientesMargen CRUDO sin tocar. Ahora reconcilia SIEMPRE, y
 * contribución/costo se re-derivan de esa venta oficial × el margen% (que se preserva tal cual clientesMargen lo
 * declara) — probado en vivo que NO rescalar contribución rompe el P&L (los gastos, %×venta, suben mientras la
 * contribución que los financia queda fija, apretando el resultado ~1pp sin ninguna razón de negocio real).
 * entityRecord.js (oráculo, bypassea el motor de escenarios con imports crudos) tiene su propio fix: `_sources`
 * ahora usa la función reconciliada para "cliente" + dedupe del alias venta/actual en `_rawRecord` (antes emitía
 * DOS fig() con el mismo label "· Ventas" y valores distintos — cualquiera de los dos quedaba autorizado).
 * Este gate prueba los 3 chequeos que pidió el owner sobre MÚLTIPLES consumidores reales (no solo la función raíz):
 * engine/scenarios.js (la fuente), toolRegistry.js vía runPlan (marginRead/entityRecord/gridTable — los tools del
 * oráculo), entityRecord.js directo, specRetrieval.js (composeSpecMargin, el composer viejo que respalda marginRead),
 * y pnl.js (buildPnlCascade, la cascada completa). */
import { clientesVentas } from "./src/data/demoData.js";
import { applyScenarioToClientesMargen } from "./src/engine/scenarios.js";
import { buildEntityRecord, buildGrid } from "./src/adi/oracle/entityRecord.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { composeSpecMargin } from "./src/adi/specRetrieval.js";
import { buildPnlCascade } from "./src/adi/pnl.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

const OFICIAL = new Map(clientesVentas.map((c) => [c.nombre, c.actual]));
const TOTAL_OFICIAL = clientesVentas.reduce((s, c) => s + c.actual, 0);
// parser laxo "$19.4M"/"$833K" → número en MILES (K, la escala del dato interno) — solo para comparar razonablemente
// cerca (± redondeo de un decimal en millones) contra el oficial, no para recomputar cifras.
function _toK(txt) {
  const m = /\$(-?[\d.,]+)\s*(M|K)?/.exec(String(txt || ""));
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  if (m[2] === "M") return n * 1000;
  if (m[2] === "K") return n;
  return n / 1000;
}
const _closeK = (a, b, tolK = 60) => a != null && b != null && Math.abs(a - b) <= tolK;   // ±$60K = redondeo de "$X.XM"
// composeSpecMargin (el composer CRUDO, sin pasar por _pack/_fmtMoneyFacts) da `venta` como NÚMERO ya en miles —
// las tools del oráculo (marginRead/entityRecord/gridTable) lo dan como STRING formateado ("$19.4M"). Acepta ambos.
const _asK = (v) => (typeof v === "number" ? v : _toK(v));

console.log("── 1 · engine/scenarios.js — la fuente raíz: venta reconciliada, para TODOS los clientes, en el escenario 'actual' (default de producción) ──");
{
  const rows = applyScenarioToClientesMargen("actual");
  ok(rows.length === clientesVentas.length, `misma cantidad de clientes que clientesVentas (${rows.length})`);
  let mism = 0;
  for (const r of rows) if (OFICIAL.get(r.nombre) !== r.venta) mism++;
  ok(mism === 0, `0 clientes con venta≠oficial (de ${rows.length}) — antes TODOS los 13 diferían`);
  const total = rows.reduce((s, r) => s + r.venta, 0);
  ok(total === TOTAL_OFICIAL, `Σvⓔnta reconciliada = $${total}K == total oficial $${TOTAL_OFICIAL}K`);
  // margen% se preserva (no es parte de "venta", pero confirma que el fix no tocó de más)
  const fal = rows.find((r) => r.nombre === "Falabella");
  ok(fal.margen === 22.0, `margen% de Falabella SIN tocar (22.0%) — obtuvo ${fal.margen}`);
}

console.log("\n── 2 · engine/scenarios.js — también reconcilia en escenarios simulados (bonanza/tension/crisis), no solo 'actual' ──");
{
  for (const scn of ["bonanza", "tension", "crisis"]) {
    const rows = applyScenarioToClientesMargen(scn);
    const ventasScn = (await import("./src/engine/scenarios.js")).applyScenarioToClientesVentas(scn);
    const officialScn = new Map(ventasScn.map((c) => [c.nombre, c.actual]));
    let mism = 0;
    for (const r of rows) if (officialScn.get(r.nombre) !== r.venta) mism++;
    ok(mism === 0, `escenario '${scn}': 0 clientes con venta≠oficial-del-escenario (de ${rows.length})`);
  }
}

console.log("\n── 3 · specRetrieval.js — composeSpecMargin (respalda el tool marginRead) cita la venta oficial por cliente ──");
{
  const r = composeSpecMargin({ scenario: "actual", dimension: "cliente", focus: "bajo_benchmark" });
  const rows = r.evidence.margin.panel.rows;
  ok(rows.length > 0, `hay filas de margen por cliente (${rows.length})`);
  let mism = 0;
  for (const row of rows) {
    const oficialK = OFICIAL.get(row.nombre);
    const citadaK = _asK(row.venta);
    if (!_closeK(oficialK, citadaK)) { mism++; console.log(`    MISMATCH ${row.nombre}: cita ${row.venta} (~${citadaK}K) vs oficial ${oficialK}K`); }
  }
  ok(mism === 0, `0 filas donde marginRead cite una venta que no sea la oficial (de ${rows.length})`);
}

console.log("\n── 4 · toolRegistry.js vía runPlan — marginRead/entityRecord/gridTable (los TOOLS reales que ve el LLM) citan la venta oficial ──");
{
  const { results: r1 } = runPlan({ intent: "answer", calls: [{ tool: "marginRead", args: { dimension: "cliente" } }] }, { scenario: "actual" });
  const rowsM = r1[0].facts.margin.panel.rows;
  let mismM = 0;
  for (const row of rowsM) { const o = OFICIAL.get(row.nombre), c = _toK(row.venta); if (!_closeK(o, c)) mismM++; }
  ok(mismM === 0, `marginRead (tool): 0/${rowsM.length} filas con venta≠oficial`);

  const { results: r2 } = runPlan({ intent: "answer", calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] }, { scenario: "actual" });
  const ventasFal = _toK(r2[0].facts.Ventas);
  ok(_closeK(ventasFal, OFICIAL.get("Falabella")), `entityRecord (tool) · Falabella: Ventas=${r2[0].facts.Ventas} == oficial $${OFICIAL.get("Falabella")}K`);

  const { results: r3 } = runPlan({ intent: "answer", calls: [{ tool: "gridTable", args: { dimension: "cliente", limit: 20 } }] }, { scenario: "actual" });
  const rowsG = r3[0].facts.rows;
  ok(rowsG.length === clientesVentas.length, `gridTable (tool): trae los ${rowsG.length} clientes`);
  let mismG = 0;
  for (const row of rowsG) { const o = OFICIAL.get(row.entidad), c = _toK(row.Ventas); if (!_closeK(o, c)) mismG++; }
  ok(mismG === 0, `gridTable (tool): 0/${rowsG.length} filas con venta≠oficial`);
}

console.log("\n── 5 · entityRecord.js directo — buildEntityRecord/buildGrid citan la venta oficial y NO duplican el fig() 'Ventas' ──");
{
  // COLAPSO DEL EJE (C5, 2026-08-30): estas llamadas OMITÍAN el escenario y viajaban gratis en el default de
  // conveniencia (`= "actual"`); al unificarse los defaults a la base real declarada, la omisión mezclaba mundos
  // con las demás secciones (que ya pasaban "actual" explícito). La regla del propio gate: UNA voz = UN mundo,
  // declarado — así que el mundo va explícito, no heredado de un default.
  for (const nombre of ["Falabella", "Lider", "Unimarc"]) {
    const rec = buildEntityRecord("cliente", nombre, "actual");
    const cK = _toK(rec.facts.Ventas);
    ok(_closeK(cK, OFICIAL.get(nombre)), `buildEntityRecord(${nombre}).facts.Ventas=${rec.facts.Ventas} == oficial $${OFICIAL.get(nombre)}K`);
    const figsVentas = rec.boleta.filter((f) => f.label === `${nombre} · Ventas`);
    ok(figsVentas.length === 1, `boleta trae EXACTAMENTE 1 fig() "${nombre} · Ventas" (de venta+actual duplicados) — obtuvo ${figsVentas.length}`);
  }
  const grid = buildGrid("cliente", { scenario: "actual" });
  ok(grid.facts.sortBy === "venta", "gridTable default sortBy sigue siendo 'venta' (ahora ya reconciliado)");
  let mismGrid = 0;
  for (const row of grid.facts.rows) { const o = OFICIAL.get(row.entidad), c = _toK(row.Ventas); if (!_closeK(o, c)) mismGrid++; }
  ok(mismGrid === 0, `buildGrid: 0/${grid.facts.rows.length} filas con venta≠oficial`);
}

console.log("\n── 6 · pnl.js — buildPnlCascade: el Ingreso total y cada fila por cliente usan la venta oficial (D8 mencionado explícito: 'P&L no debe mostrar bases incompatibles') ──");
{
  const c = buildPnlCascade("actual");
  ok(c.ingresoK === TOTAL_OFICIAL, `ingresoK=$${c.ingresoK}K == total oficial $${TOTAL_OFICIAL}K (antes daba $95.2M)`);
  let mism = 0;
  for (const e of c.porEntidad) { if (OFICIAL.has(e.nombre) && OFICIAL.get(e.nombre) !== e.ventaK) mism++; }
  ok(mism === 0, `porEntidad: 0/${c.porEntidad.length} filas con ventaK≠oficial`);
  // coherencia interna: el % de resultado con un gasto declarado NO debe cambiar solo porque cambió la escala de
  // venta (contribución escala igual que los gastos, ambos %×venta oficial) — control anti-regresión del hallazgo
  // real de este mismo desarrollo (dejar contribución sin tocar apretaba el resultado ~1pp de la nada).
  const conGasto = buildPnlCascade("actual", [{ nombre: "Logística", pct: 10, origen: "supuesto_declarado" }]);
  const resultadoEsperadoAprox = 15.06;   // el mismo % que daba ANTES del fix (con la base $95.2M) — debe seguir igual
  ok(Math.abs(conGasto.resultadoPct - resultadoEsperadoAprox) < 0.05, `resultado% con un gasto del 10% se mantiene ~${resultadoEsperadoAprox}% (obtuvo ${conGasto.resultadoPct.toFixed(2)}%) — NO se aprieta por la reconciliación de venta`);
}

console.log("\n── 7 · GATE #1 (dos ventas distintas) — cruzar TODOS los consumidores anteriores entre sí, cliente por cliente ──");
{
  const engineRows = applyScenarioToClientesMargen("actual");
  const { results: rM } = runPlan({ intent: "answer", calls: [{ tool: "marginRead", args: { dimension: "cliente" } }] }, { scenario: "actual" });
  const marginRows = rM[0].facts.margin.panel.rows;
  const pnl = buildPnlCascade("actual");
  let contradicciones = 0;
  for (const nombre of clientesVentas.map((c) => c.nombre)) {
    const vals = new Set();
    vals.add(engineRows.find((r) => r.nombre === nombre)?.venta);
    const mr = marginRows.find((r) => r.nombre === nombre);
    if (mr) vals.add(_asK(mr.venta));
    const pe = pnl.porEntidad.find((r) => r.nombre === nombre);
    if (pe) vals.add(pe.ventaK);
    const rec = buildEntityRecord("cliente", nombre, "actual");   // mundo explícito (C5 — ver sección 5)
    vals.add(_toK(rec.facts.Ventas));
    // todas las lecturas deben caer dentro de ±60K entre sí (redondeo de "$X.XM"), nunca una diferencia real
    const arr = [...vals];
    const maxDiff = Math.max(...arr) - Math.min(...arr);
    if (maxDiff > 60) { contradicciones++; console.log(`    CONTRADICCIÓN ${nombre}: ${arr.join(" vs ")}`); }
  }
  ok(contradicciones === 0, `0 clientes con 2+ ventas DISTINTAS entre engine/marginRead/pnl/entityRecord (de ${clientesVentas.length})`);
}

/* ── 8 · UNA SOLA CONTRIBUCIÓN (el corte del fast-path · decisión constitucional del chat principal, 2026-08-30) ──
 * EL DEFECTO QUE CIERRA: contribution.js tenía un atajo «bonanza sirve la base almacenada» que se creía
 * identidad y NO LO ERA — desde el fix D8, applyScenarioToClientesMargen reconcilia la venta con la OFICIAL en
 * TODOS los mundos, así que el atajo servía filas PRE-reconciliación: el usuario podía leer $23.85M en el
 * ranking y $25.06M en la Mesa para LA MISMA contribución (Falabella $4.07M vs $4.3M, los 13 clientes, ~5%).
 * LA PROPIEDAD: el ranking y la Mesa del MISMO mundo derivan de LA MISMA Σ — D8 vigilada transversalmente. */
console.log("\n── 8 · UNA SOLA CONTRIBUCIÓN — ranking y Mesa derivan de la MISMA Σ reconciliada ──");
{
  const { composeClientContributionRanking } = await import("./src/adi/composers/contribution.js");
  const { buildResumenComercial } = await import("./src/adi/sentrix/resumenComercial.js");
  const MUNDO = "bonanza";   // el mundo SERVIDO (la base declarada de la app)
  const S = applyScenarioToClientesMargen(MUNDO).filter((c) => c && c.tipo === "cliente")
    .reduce((s, c) => s + (c.contribucion || 0), 0);   // la Σ D8-reconciliada, en miles
  const enRanking = `$${(S / 1000).toFixed(2)}M`;       // el formato del ranking (2 decimales)
  const enMesa = `$${(S * 1000 / 1e6).toFixed(1)}M`;    // el formato de la Mesa (_M · 1 decimal)
  const cr = composeClientContributionRanking(MUNDO);
  ok((cr.opener || "").includes(`aportan ${enRanking} de contribución`),
    `el ranking dice la Σ reconciliada (${enRanking}) — no la base pre-D8`);
  const kv = Object.fromEntries(buildResumenComercial(MUNDO).kpis.map((k) => [k.key, k.valor]));
  ok(kv.contribucion === enMesa,
    `la Mesa dice LA MISMA Σ (${enMesa}) — dos formatos, un solo crudo (${S} miles)`);

  // CARNADA · el atajo pre-reconciliación resucitado, verbatim → el ranking se separa de la Σ → ROJO
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const abs = path.join(process.cwd(), "src/adi/composers/contribution.js");
  let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
  const VIVO = "const source = applyScenarioToClientesMargen(scenarioId);";
  const MUERTO = 'const source = scenarioId === "bonanza" ? clientesMargen : applyScenarioToClientesMargen(scenarioId);';
  if (!txt.includes(VIVO)) { ok(false, "carnada «atajo resucitado» — no encontré la línea viva para mutar"); }
  else {
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}_d8.js`);
    fs.writeFileSync(destino, txt.replace(VIVO, MUERTO));
    try {
      const Mut = await import(pathToFileURL(destino).href);
      const crMut = Mut.composeClientContributionRanking(MUNDO);
      ok(!(crMut.opener || "").includes(`aportan ${enRanking} de contribución`),
        "carnada «atajo pre-D8 resucitado» → el chequeo se pone ROJO (el ranking se separa de la Σ)");
    } catch (e) { ok(false, "carnada «atajo resucitado»", String(e.message).slice(0, 100)); }
    try { fs.unlinkSync(destino); } catch { /* */ }
  }
}

console.log(`\n── _oracle_venta_d8_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
