/* === _chart_gate.mjs · GATE del gráfico en la respuesta (I1 · owner 2026-07-09) ===
 * chartForEvidence es DETERMINÍSTICO: la evidencia real del seam elige la plantilla (el LLM no participa).
 * Lockea: pareto para contribución · evolutivo para ventas · barras para ranking/overview del contrato ·
 * NULL para degrades/saludos/follow-ups (nunca un gráfico pegado a una repregunta o a un límite declarado). */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_cge.js"), out = path.join(root, "_cgb.mjs");
fs.writeFileSync(entry, [
  'export { chartForEvidence } from "./src/adi/sentrix/chartSpec.js";',
  'export { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }
const { chartForEvidence: CH, answerADIFromSpec: A } = M;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
const S = (o) => ({ schemaVersion: 1, scenario: "actual", ...o });

const rVen = A(S({ operation: "ventas", metric: "ventas", dimension: "cliente", focus: "vs_anterior" }), {}, {});
ok("ventas vs anterior (por cliente) → MOVERS divergentes: responde LO PREGUNTADO por entidad (owner 2026-07-09)", (() => { const c = CH(rVen.evidence); return c && c.tipo === "movers" && c.panel.rows.length >= 2 && c.panel.rows.every((r) => typeof r.pos === "boolean" && r.valFmt); })());
ok("ventas SIN desglose por entidad → EVOLUTIVO global (12 meses)", (() => { const c = CH({ lens: "ventas", ventas: { focus: "global", panel: null }, boleta: [] }); return c && c.tipo === "evolutivo"; })());

const rCon = A(S({ operation: "contribucion", metric: "contribucion", dimension: "cliente", focus: "concentracion" }), {}, {});
ok("contribución concentración → PARETO con corte real", (() => { const c = CH(rCon.evidence); return c && c.tipo === "pareto" && c.panel.cutoff > 0 && c.panel.rows.length >= 3 && typeof c.panel.rows[0].acum === "number"; })());

const rCosto = A(S({ operation: "overview", metric: "costo", dimension: "cliente" }), {}, {});
ok("overview del contrato (costo@cliente) → BARRAS con filas de una verdad", (() => { const c = CH(rCosto.evidence); return c && c.tipo === "barras" && c.rows.length >= 2 && c.rows[0].fmt && /costo/i.test(c.titulo); })());

const rRank = A(S({ operation: "rank", metric: "margen", dimension: "marca", limit: 3, sort: { dir: "desc" } }), {}, {});
ok("rank del contrato (margen@marca) → BARRAS", (() => { const c = CH(rRank.evidence); return c && c.tipo === "barras"; })());

const rDiag = A(S({ operation: "diagnose", metric: "contribucion", dimension: "cliente" }), {}, {});
ok("diagnose → sin gráfico en I1 (sus focos ya viven en el panel)", CH(rDiag.evidence) == null);

const rDeg = A(S({ operation: "overview", metric: "rotacion", dimension: "marca" }), {}, {});
ok("límite declarado (rotación@marca) → sin gráfico (nunca graficar un degrade)", CH(rDeg.evidence) == null);

// TABLA COMPARADA universal (mejora 4 · 2026-07-26 · regla: dos columnas de números = tabla, siempre)
const rCmp = A(S({ operation: "compare", metric: "ventas", dimension: "cliente", comparison: { entities: ["Falabella", "Ripley"], dimension: "cliente" } }), {}, {});
ok("compare A vs B → TABLA COMPARADA métrica por métrica (evidence.pairs de una verdad)", (() => {
  const c = CH(rCmp.evidence);
  return c && c.tipo === "tabla_comparada" && c.tabla.cols.join("|") === "Falabella|Ripley" && c.tabla.rows.length >= 2
    && c.tabla.rows.every((r) => r.label && typeof r.a === "string" && typeof r.b === "string") && c.titulo === "Falabella vs. Ripley";
})());
ok("compare con un lado sin nombre → sin tabla (nunca una cabecera rota)", CH({ pairs: [{ label: "Ventas", aFmt: "$1M", bFmt: "$2M" }, { label: "Margen", aFmt: "20%", bFmt: "25%" }], compareA: "A" }) == null);
ok("el ANTES|AHORA de una edición (followup:true + tabla) SÍ se despacha — el dispatch va antes del guard", (() => {
  const c = CH({ followup: true, kind: "criteria", tabla: { titulo: "Marketing — antes vs. ahora", cols: ["Antes", "Ahora"], rows: [{ label: "Línea · Marketing", a: "1.5%", b: "2%" }] } });
  return c && c.tipo === "tabla_comparada" && c.tabla.cols.join("|") === "Antes|Ahora";
})());

ok("saludo/criteria (followup) → sin gráfico", CH({ kind: "saludo", followup: true, boleta: [] }) == null && CH({ kind: "criteria", followup: true, boleta: [] }) == null);
ok("evidencia nula/vacía → sin gráfico (sin crash)", CH(null) == null && CH({}) == null && CH({ rows: [] }) == null);
ok("barras se recortan a 8 filas (compacto)", (() => { const c = CH({ rows: Array.from({ length: 13 }, (_, i) => ({ name: "E" + i, value: 13 - i, fmt: String(13 - i) })), metricLabel: "Ventas", dimLabel: "cliente", unit: "money", polarity: "higherIsBetter" }); return c && c.rows.length === 8; })());

console.log(`\n── _chart_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
