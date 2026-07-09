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
ok("ventas vs anterior → EVOLUTIVO (12 meses · misma verdad que Sentrix)", (() => { const c = CH(rVen.evidence); return c && c.tipo === "evolutivo"; })());

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

ok("saludo/criteria (followup) → sin gráfico", CH({ kind: "saludo", followup: true, boleta: [] }) == null && CH({ kind: "criteria", followup: true, boleta: [] }) == null);
ok("evidencia nula/vacía → sin gráfico (sin crash)", CH(null) == null && CH({}) == null && CH({ rows: [] }) == null);
ok("barras se recortan a 8 filas (compacto)", (() => { const c = CH({ rows: Array.from({ length: 13 }, (_, i) => ({ name: "E" + i, value: 13 - i, fmt: String(13 - i) })), metricLabel: "Ventas", dimLabel: "cliente", unit: "money", polarity: "higherIsBetter" }); return c && c.rows.length === 8; })());

console.log(`\n── _chart_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
