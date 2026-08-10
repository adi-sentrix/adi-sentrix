/* === _tabla_estructurada_gate.mjs · REQUISITO 5 · "pase quirúrgico de confiabilidad" (owner 2026-07-29) ===
 * "Las respuestas multi-entidad + multi-métrica deben renderizarse como tabla estructurada, sin depender del
 * narrador." Lockea: (1) DETERMINÍSTICO — chartForEvidence(gridTable) produce tabla_matriz con columnas
 * NUMÉRICAS únicamente (nunca Nombre/Tipo/Marca/Familia/Canal), tope de 5, encabezada por el campo ordenado;
 * (2) DETERMINÍSTICO — chartForEvidence(tensionRead) produce tabla_matriz de 2 columnas con "—" honesto donde
 * una entidad no aparece en un ranking; (3) reusa MiniTablaMatriz (mismo componente del mes a mes, CERO UI nueva);
 * (4) 1 sola entidad (no hay "multi") → NO produce esta tabla (deja el camino normal); (5) esto es INDEPENDIENTE
 * del narrador: el spec se arma solo de `evidence`, nunca del texto de la Pasada 2.
 */
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { buildOracleEvidence } from "./src/adi/oracle/sentrixEvidence.js";
import { chartForEvidence } from "./src/adi/sentrix/chartSpec.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

const evOf = (calls, results) => buildOracleEvidence({ plan: { intent: "answer", calls }, results, figs: [], scenario: "actual" });

console.log("── 1 · DETERMINÍSTICO — chartForEvidence(gridTable) → tabla_matriz, solo columnas numéricas, tope 5 ──");
{
  const g = runPlan({ intent: "grid", calls: [{ tool: "gridTable", args: { dimension: "cliente", sortBy: "venta", limit: 5 } }] }, { scenario: "actual" });
  const spec = chartForEvidence(evOf(g.trace.calls, g.results));
  ok(!!spec && spec.tipo === "tabla_matriz", `tipo="tabla_matriz" (obtuvo "${spec && spec.tipo}")`);
  ok(!!spec && spec.tabla.cols.length <= 5, `≤5 columnas (obtuvo ${spec && spec.tabla.cols.length})`);
  ok(!!spec && spec.tabla.cols[0] === "Ventas", `la columna del campo ordenado ("Ventas") va primero (obtuvo "${spec && spec.tabla.cols[0]}")`);
  const TEXT = ["Nombre", "Tipo", "Marca", "Familia", "Canal", "SKU", "Bodega", "Estado", "Alerta"];
  ok(!!spec && !spec.tabla.cols.some((c) => TEXT.includes(c)), "NINGUNA columna de texto/atributo (Nombre/Tipo/Marca/Familia/Canal…) — solo métricas");
  ok(!!spec && spec.tabla.rows.length === 5 && spec.tabla.rows[0].label === "Falabella", `5 filas, la primera "Falabella" (obtuvo "${spec && spec.tabla.rows[0] && spec.tabla.rows[0].label}")`);
  ok(!!spec && /5 de 13/.test(spec.tabla.nota || ""), `nota declara el recorte ("5 de 13") — "${spec && spec.tabla.nota}"`);
}

console.log("\n── 2 · DETERMINÍSTICO — chartForEvidence(tensionRead) → tabla_matriz de 2 columnas, '—' honesto ──");
{
  const t = runPlan({ intent: "tension", calls: [{ tool: "tensionRead", args: { dimension: "sku" } }] }, { scenario: "actual" });
  const spec = chartForEvidence(evOf(t.trace.calls, t.results));
  ok(!!spec && spec.tipo === "tabla_matriz", `tipo="tabla_matriz" (obtuvo "${spec && spec.tipo}")`);
  ok(!!spec && spec.tabla.cols.length === 2, `exactamente 2 columnas (una por métrica cruzada), obtuvo ${spec && spec.tabla.cols.length}`);
  ok(!!spec && spec.tabla.rows.some((r) => r.values.includes("—")), "al menos una fila con '—' honesto (entidad que no está en AMBOS rankings)");
}

console.log("\n── 3 · reusa MiniTablaMatriz — mismo shape {cols, rows:[{label,values}], nota?} que el mes a mes ──");
{
  const g = runPlan({ intent: "grid", calls: [{ tool: "gridTable", args: { dimension: "sku", limit: 3 } }] }, { scenario: "actual" });
  const spec = chartForEvidence(evOf(g.trace.calls, g.results));
  ok(!!spec && Array.isArray(spec.tabla.cols) && Array.isArray(spec.tabla.rows) && spec.tabla.rows.every((r) => typeof r.label === "string" && Array.isArray(r.values)), "shape {cols[], rows:[{label, values[]}]} — el MISMO que ya renderiza MiniTablaMatriz, cero componente UI nuevo");
}

console.log("\n── 4 · 1 sola entidad → NO produce esta tabla (no hay 'multi' que estructurar acá) ──");
{
  const rec = runPlan({ intent: "record", calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] }, { scenario: "actual" });
  const spec = chartForEvidence(evOf(rec.trace.calls, rec.results));
  ok(spec === null || spec.tipo !== "tabla_matriz" || (spec.tabla.rows || []).length < 2, "entityRecord de 1 entidad no dispara la grilla multi-entidad");
}

console.log("\n── 5 · el spec es 100% independiente del narrador (se arma SOLO de evidence, sin tocar texto) ──");
{
  const g = runPlan({ intent: "grid", calls: [{ tool: "gridTable", args: { dimension: "cliente", sortBy: "venta", limit: 5 } }] }, { scenario: "actual" });
  const ev = evOf(g.trace.calls, g.results);
  const spec1 = chartForEvidence(ev);
  const spec2 = chartForEvidence(ev);   // misma evidencia, sin pasar ningún texto narrado — byte-igual por construcción
  ok(JSON.stringify(spec1) === JSON.stringify(spec2), "chartForEvidence(evidence) es puro — mismo input, mismo spec, sin depender de qué dijo el narrador");
  ok(chartForEvidence.length === 1, "chartForEvidence recibe UN solo argumento (evidence) — no puede leer el texto narrado aunque quisiera");
}

console.log(`\n── _tabla_estructurada_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
