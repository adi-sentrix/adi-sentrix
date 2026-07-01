// === HARNESS · brick 6 · EVIDENCIA ENRIQUECIDA · el RECIBO FRÍO (buildMarginReceipt) ===
import { buildMarginReceipt, buildMarginDecomposition } from "./src/adi/sentrix/kpis.js";
import { applyScenarioToClientesMargen } from "./src/engine/scenarios.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("✅", m); } else { fail++; console.log("🚨", m); } };

console.log("── EL RECIBO CIERRA · venta − costo − carga = margen (Lider · bonanza) ──");
const r = buildMarginReceipt("Lider", "bonanza");
ok(r != null, "recibo existe para Lider·margen");
const [venta, costo, carga, margen] = r.lines;
ok(venta.pct === 100 && venta.sign === "", "línea 1 = Ventas netas (100%)");
ok(Math.abs((costo.usd + carga.usd + margen.usd) - venta.usd) < 0.01, `columna $ cierra: costo+carga+margen (${(costo.usd+carga.usd+margen.usd).toFixed(1)}) == venta (${venta.usd})`);
ok(Math.abs((costo.pct + carga.pct + margen.pct) - 100) < 0.001, `columna % cierra: costo+carga+margen == 100 (${costo.pct}+${carga.pct}+${margen.pct})`);
ok(margen.sign === "=" && margen.strong === true, "la línea Margen es el total (= · strong)");

console.log("\n── TRAZABILIDAD · consistente con la brecha (mismo buildMarginDecomposition) ──");
const d = buildMarginDecomposition("Lider", "bonanza");
ok(margen.pct === d.margen, `margen del recibo ${margen.pct}% == margen de la brecha ${d.margen}%`);
ok(costo.pct === d.costoPct && carga.pct === d.cargaPct, `costo%/carga% del recibo == brecha (${d.costoPct}/${d.cargaPct})`);

console.log("\n── FUENTES · cada línea declara su origen (ERP / derivado) ──");
ok(r.lines.every((l) => l.source && l.source.length > 3), "las 4 líneas tienen fuente");
ok(/ERP/.test(costo.source) && /derivado/i.test(margen.source), "costo cita ERP · margen dice derivado");

console.log("\n── COMPARACIÓN · vs promedio interno + vs benchmark ──");
const cm = applyScenarioToClientesMargen("bonanza").find((c) => c.nombre === "Lider");
ok(r.comparison.benchmark === cm.benchmark, `benchmark ${r.comparison.benchmark} == dato ${cm.benchmark}`);
ok(r.comparison.gapBench === Math.round((d.margen - cm.benchmark) * 10) / 10, `gap vs benchmark = ${r.comparison.gapBench}pp`);
ok(r.comparison.gapProm < 0, `Lider bajo el promedio interno (${r.comparison.gapProm}pp)`);

console.log("\n── CONFIANZA ──");
ok(r.confianza.level === "Alta" && /cierra/.test(r.confianza.reason), "confianza Alta · razón = la cuenta cierra");

console.log("\n── LÍMITES HONESTOS · derivados de capability (no hardcodeados) ──");
ok(r.limites.length === 2, `2 límites (histórico por entidad + cruce cliente×SKU) · encontrados ${r.limites.length}`);
ok(r.limites.some((t) => /hist[oó]rico/i.test(t)), "límite del histórico por cliente (sintético)");
ok(r.limites.some((t) => /atómica cliente×SKU|atomica cliente×SKU/i.test(t)), "límite del cruce cliente×SKU (sin granularidad atómica)");

console.log("\n── GENERICIDAD · no aplica fuera de cliente·margen → null (honesto) ──");
ok(buildMarginReceipt("NoExiste", "bonanza") === null, "cliente inexistente → null");

console.log("\n════════════════════════════════════════════════════");
console.log(`GATES: ${pass}/${pass + fail} · ${fail === 0 ? "TODOS VERDES" : "HAY ROJOS"}`);
process.exit(fail === 0 ? 0 : 1);
