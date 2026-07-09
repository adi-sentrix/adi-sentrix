/* === _matrix_sweep.mjs · MAPA DE COBERTURA (plan "que no vuelva a pasar" · owner 2026-07-09) ===
 * FASE 1 (determinística): enumera el espacio métrica × dimensión × forma DESDE el contrato y ejecuta cada celda
 * contra el seam (answerADIFromSpec · sin LLM). Clasifica:
 *   OK        → responde con dato
 *   DECLARADO → degrade honesto (límite declarado — correcto SI el dato no existe)
 *   ROTA      → el contrato declara la combinación pero el seam degrada (receta rota/faltante)
 *   ERROR     → executor-error / texto vacío / error crudo (no debe existir — el fuzz lo cubre)
 * Output: _matrix_gate.json + resumen por consola. La FASE 2 (fraseos reales vía LLM) se corre aparte. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_mge.js"), out = path.join(root, "_mgb.mjs");
fs.writeFileSync(entry, [
  'export { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";',
  'export { METRICS } from "./src/config/contract/metricRegistry.js";',
  'export { ENTITIES } from "./src/config/contract/entityRegistry.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }
const { answerADIFromSpec: A, METRICS, ENTITIES } = M;

const REP = {
  cliente: ["Falabella", "Lider"], marca: ["Samsung", "LG"], familia: ["Cuidado Personal", "Línea Blanca"],
  sku: ["SAM-TV55", "LG-WASH11KG"], bodega: ["Santiago", "Valparaíso"],
};
const FILTRO = { cliente: { marca: "Samsung" }, sku: { marca: "Samsung" }, marca: { familia: "Cuidado Personal" }, familia: { marca: "Philips" }, bodega: { familia: "Línea Blanca" } };

const S = (o) => ({ schemaVersion: 1, scenario: "actual", ...o });
const DEGRADE_RE = /^(No tengo|No veo|No te puedo|No encuentro|Esa vista todav[ií]a|En [A-ZÁÉÍÓÚ])/;
const RAW_RE = /Cannot read|TypeError|undefined is not/;

function clasifica(r, declarada) {
  const t = (r && r.text) || "";
  if (!t.trim() || RAW_RE.test(t) || (r.route || "").includes("executor-error")) return "ERROR";
  const degrada = /^spec_blocked_/.test(r.route || "") || DEGRADE_RE.test(t.trim());
  if (degrada) return declarada ? "ROTA" : "DECLARADO";
  return "OK";
}

const rows = [];
const dims = Object.keys(ENTITIES);
for (const [mk, m] of Object.entries(METRICS)) {
  for (const dim of dims) {
    const declarada = !!(m.sourceByAxis && m.sourceByAxis[dim]);
    const celdas = [
      { forma: "overview", spec: S({ operation: "overview", metric: mk, dimension: dim }) },
      { forma: "rank", spec: S({ operation: "rank", metric: mk, dimension: dim, limit: 3 }) },
      { forma: "dive", spec: S({ operation: "dive", metric: mk, dimension: dim, entity: (REP[dim] || [])[0] }) },
      { forma: "compare", spec: S({ operation: "compare", metric: mk, dimension: dim, comparison: { dimension: dim, entities: REP[dim] || [] } }) },
      { forma: "filtro", spec: S({ operation: "overview", metric: mk, dimension: dim, filters: FILTRO[dim] }) },
    ];
    for (const c of celdas) {
      let cls, route = null, gist = "";
      try { const r = A(c.spec, {}, {}); cls = clasifica(r, declarada); route = r.route; gist = (r.text || "").replace(/\s+/g, " ").slice(0, 100); }
      catch (e) { cls = "ERROR"; gist = String(e && e.message).slice(0, 80); }
      rows.push({ metric: mk, dim, forma: c.forma, declarada, cls, route, gist });
    }
  }
}
fs.writeFileSync("_matrix_gate.json", JSON.stringify(rows, null, 1));

const tot = { OK: 0, DECLARADO: 0, ROTA: 0, ERROR: 0 };
rows.forEach((r) => tot[r.cls]++);
console.log(`── MAPA DE COBERTURA · ${rows.length} celdas (${Object.keys(METRICS).length} métricas × ${dims.length} dimensiones × 5 formas) ──`);
console.log(`   OK ${tot.OK} · DECLARADO ${tot.DECLARADO} · ROTA ${tot.ROTA} · ERROR ${tot.ERROR}\n`);
if (tot.ERROR) { console.log("✗ ERRORES:"); rows.filter((r) => r.cls === "ERROR").forEach((r) => console.log(`   ${r.metric}@${r.dim}·${r.forma} → ${r.gist}`)); }
console.log("── ROTAS (el contrato declara y el seam degrada — recetas por construir/arreglar) ──");
const rotas = rows.filter((r) => r.cls === "ROTA");
for (const r of rotas) console.log(`   ${r.metric}@${r.dim} · ${r.forma} → [${r.route}] ${r.gist.slice(0, 70)}`);
console.log(`\n(${rotas.length} rotas · detalle completo en _matrix_gate.json)`);
process.exit((tot.ROTA || tot.ERROR) ? 1 : 0);
