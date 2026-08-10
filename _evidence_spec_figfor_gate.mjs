/* === _evidence_spec_figfor_gate.mjs · evidenceSpec · GATE DE RECONCILIACIÓN (owner 2026-07-31) ===
 * REGLA CENTRAL: "ADI asesora; Sentrix demuestra" — Sentrix (el Recibo Frío/tira de datos de kpis.js) debe mostrar
 * la MISMA vara que autorizó la respuesta de ADI (businessPolicy.benchmarkOf(), el ÚNICO punto que respeta
 * `_benchmarkOverride` — la memoria de criterio real, C.2). Este es el gate que previene DIRECTAMENTE que el
 * defecto de integridad #1 (kpis.js leyendo `cm.benchmark`/`sku.benchmark` CRUDO en vez de benchmarkOf()) vuelva a
 * aparecer: activa un override REAL (vía setBenchmarkOverride(), el mecanismo del repo — no un mock) y confirma,
 * para 3 entidades reales de 3 ejes distintos (cliente/SKU/marca), que:
 *
 *   1. kpis.js (buildEntityKPIs → _clientKPIs/_skuKPIs/_marcaKPIs, la tira "Diagnóstico") muestra el MISMO
 *      benchmark que businessPolicy.benchmarkOf() para el registro crudo de esa entidad.
 *   2. buildMarginReceipt() (el "Recibo Frío" de cliente) muestra el MISMO benchmark en su `.comparison`.
 *   3. evidenceSpec.reference (sentrixEvidence.js, la vista que consumirá "Sentrix es la evidencia") coincide con
 *      los dos anteriores — los TRES caminos convergen en UNA sola cifra para el mismo turno/entidad.
 *   4. figFor(figs, entidad, "Margen") (boleta.js) — la lectura SANCIONADA de una cifra ya citada — encuentra UNA
 *      fig para entidad+métrica y esa fig NUNCA es accidentalmente el benchmark (chequeo estructural). El valor
 *      EXACTO que figFor debe devolver para el eje "sku" tiene un residual conocido — ver
 *      `_entity_record_margen_duplicado_gate.mjs` (entityRecord.js emite DOS figs "Margen" conflictivas para SKU,
 *      22% de skuInventario.margenPct vs 22.5% de skusMargen.margen — hallazgo nuevo de ESTA construcción, gate
 *      dedicado aparte para no diluir la señal de reconciliación de benchmark que es el foco de ESTE archivo).
 *
 * Se corre CON override activo (28%) y SIN override (default, benchmark de fila 30.1%) — ambos casos deben
 * reconciliar. PURO · sin LLM · sin red. Restaura el override a null al finalizar (no debe arrastrar a otros gates).
 */
import fs from "fs";
import { setBenchmarkOverride, getBenchmarkOverride, benchmarkOf } from "./src/config/businessPolicy.js";
import { buildEntityKPIs, buildMarginReceipt } from "./src/adi/sentrix/kpis.js";
import { rawRecordFor } from "./src/adi/oracle/entityRecord.js";
import { figFor } from "./src/adi/boleta.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
import { buildOracleEvidence } from "./src/adi/oracle/sentrixEvidence.js";

let pass = 0; const fails = [];
const ok = (cond, label, extra) => { if (cond) pass++; else fails.push({ label, extra }); console.log(`  ${cond ? "✓" : "✗"} ${label}`); };
const near = (a, b, eps = 0.05) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) < eps;

// ── extractores del benchmark MOSTRADO en cada panel (parsean el string ya formateado, tal como lo vería el usuario) ──
function benchFromClientKPIs(rows) {
  const r = rows.find((x) => x.label === "vs benchmark");
  const m = r && String(r.sub || "").match(/bench\s+([\d.]+)%/);
  return m ? parseFloat(m[1]) : null;
}
function benchFromSkuOrMarcaKPIs(rows) {
  const r = rows.find((x) => x.label === "Benchmark");
  const m = r && String(r.value || "").match(/([\d.]+)%/);
  return m ? parseFloat(m[1]) : null;
}
function benchFromMarginReceipt(receipt) {
  // la etiqueta era "Benchmark industria" hasta el contrato de vocabulario de la vara (owner 2026-08-09): la vara
  // que resuelve `benchmarkOf` es INTERNA (criterio del usuario / dato del tenant / POLICY), nunca sectorial.
  const line = receipt && receipt.comparison && receipt.comparison.find((c) => c.label === "Tu benchmark");
  const m = line && String(line.base || "").match(/([\d.]+)%/);
  return m ? parseFloat(m[1]) : null;
}

console.log("\n═══ evidenceSpec · GATE DE RECONCILIACIÓN (kpis.js ↔ businessPolicy.benchmarkOf ↔ evidenceSpec.reference) ═══\n");

const CASES = [
  { dim: "cliente", entity: "Falabella", kpiType: "client" },
  { dim: "sku", entity: "SAM-REF500L", kpiType: "sku" },
  { dim: "marca", entity: "Samsung", kpiType: "marca" },
];
const SCENARIOS = [
  { label: "SIN override (default → benchmark de fila)", override: null },
  { label: "CON override activo 28% (criterio del usuario, C.2)", override: 28 },
];

try {
  for (const { label, override } of SCENARIOS) {
    console.log(`── ${label} ──`);
    setBenchmarkOverride(override);
    ok(getBenchmarkOverride() === override, `setBenchmarkOverride(${override}) activo (mecanismo real, no mock)`);

    for (const { dim, entity, kpiType } of CASES) {
      console.log(`  · ${dim} · ${entity}`);
      const rec = rawRecordFor(dim, entity);
      ok(!!rec, `${entity}: registro crudo resuelto (rawRecordFor)`);
      const expected = benchmarkOf(rec);
      ok(typeof expected === "number" && isFinite(expected), `${entity}: businessPolicy.benchmarkOf() devuelve un número (${expected})`);

      // 1 · kpis.js (tira de Diagnóstico)
      const kpiRows = buildEntityKPIs(kpiType, entity, "actual");
      const shown = dim === "cliente" ? benchFromClientKPIs(kpiRows) : benchFromSkuOrMarcaKPIs(kpiRows);
      ok(near(shown, expected), `${entity}: kpis.js muestra benchmark=${shown}% === businessPolicy.benchmarkOf()=${expected}%`, { shown, expected, override });

      // 2 · buildMarginReceipt (Recibo Frío) — solo cliente (bodega no tiene concepto de benchmark, sku/marca no tienen receipt builder hoy)
      if (dim === "cliente") {
        const receipt = buildMarginReceipt(entity, "actual");
        const shownReceipt = benchFromMarginReceipt(receipt);
        ok(near(shownReceipt, expected), `${entity}: buildMarginReceipt().comparison muestra benchmark=${shownReceipt}% === benchmarkOf()=${expected}%`, { shownReceipt, expected });
      }

      // 3 · evidenceSpec.reference (misma vara vista desde "Sentrix es la evidencia")
      const plan = {
        intent: "answer", mode: "default", rationale: `el margen de ${entity}`,
        scope: { level: "entity", entities: [entity] },
        calls: [{ tool: "entityRecord", args: { dimension: dim, entity } }],
      };
      const { ledger, results, unsupported } = runPlan({ intent: plan.intent, calls: plan.calls }, { scenario: "actual" });
      const figs = ledgerBoleta(ledger);
      const evidence = buildOracleEvidence({ plan, results, figs, scenario: "actual", unsupported });
      const es = evidence.evidenceSpec;
      ok(!!es && es.reference && near(es.reference.value, expected), `${entity}: evidenceSpec.reference.value=${es && es.reference && es.reference.value}% === benchmarkOf()=${expected}%`, es && es.reference);
      if (override != null) {
        ok(es && es.reference && es.reference.source === "criterio_usuario", `${entity}: evidenceSpec.reference.source === 'criterio_usuario' (override activo)`, es && es.reference);
      }

      // 4 · figFor — lectura sancionada de la cifra YA citada · chequeo ESTRUCTURAL (encuentra algo, y ese algo
      // nunca es accidentalmente el benchmark) — el valor EXACTO para el eje "sku" tiene un residual conocido
      // documentado aparte (ver cabecera del archivo), no se assertea acá para no mezclar las dos señales.
      const fMargen = figFor(figs, entity, "Margen");
      ok(!!fMargen, `${entity}: figFor(figs, '${entity}', 'Margen') encuentra la fig ya citada`, fMargen);
      if (fMargen) {
        const shownMargen = parseFloat(String(fMargen.value).replace("%", ""));
        ok(!near(shownMargen, expected, 0.01) || near(rec.margen, expected, 0.01), `${entity}: figFor no devuelve accidentalmente el benchmark (${shownMargen}% vs benchmark ${expected}%)`, { shownMargen, expected });
      }
    }
    console.log("");
  }
} finally {
  setBenchmarkOverride(null);   // limpieza — no debe arrastrar a otros gates del runner (`npm run gates` corre ~89 archivos)
  ok(getBenchmarkOverride() === null, "limpieza: override restaurado a null al finalizar (no arrastra a otros gates)");
}

const summary = { total: pass + fails.length, pass, fails };
fs.writeFileSync("_evidence_spec_figfor_gate.json", JSON.stringify(summary, null, 2));
console.log(`\n${pass}/${pass + fails.length} chequeos correctos${fails.length ? " · FALLAS: " + JSON.stringify(fails, null, 1) : " ✓"}`);
console.log("→ _evidence_spec_figfor_gate.json");
process.exit(fails.length ? 1 : 0);
