/* === _registro_gate.mjs · GATE DE REGISTRO EJECUTIVO (owner 2026-07-14: "ADI no debe ocupar palabras como
 * dormido, plata, nada de eso — siempre responde como un ejecutivo") ===
 * Ninguna respuesta EMITIDA por la capa nuestra (seam · contratos · focos · sentrix · conversacional · UI) contiene
 * \b(plata|dormid[oa]s?|guita)\b. Dos frentes:
 *   (1) RUNTIME · batería representativa por el seam real + composers conversacionales + rings/glosario de Sentrix
 *       → texto + sugerencias limpias. Los DETECTORES (ontology/routerData/focus) quedan FUERA: entienden al usuario
 *       coloquial a propósito. El motor sellado (floor byte-exact) también queda fuera — en prod corre narrado (P6).
 *   (2) ESTÁTICO · los .jsx de UI (textos que React emite directo) sin comentarios → limpios.
 * Nace con el SELLO EJECUTIVO ([[adi-sello-ejecutivo]]) · corre sin key (determinístico). */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_rge.js"), out = path.join(root, "_rgb.mjs");
fs.writeFileSync(entry, [
  'export { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";',
  'export { answerConversational } from "./src/adi/conversation.js";',
  'export { composeSpecSimulate, buildResumenEjecutivo } from "./src/adi/specRetrieval.js";',
  'export { buildControlRing } from "./src/adi/sentrix/control.js";',
  'export { METRIC_DEFS } from "./src/adi/sentrix/glossary.js";',
  'export { buildDisponibleMenu } from "./src/adi/llm/capabilities.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }
const { answerADIFromSpec: A, answerConversational: AC, composeSpecSimulate, buildResumenEjecutivo, buildControlRing, METRIC_DEFS, buildDisponibleMenu } = M;

const BANNED = /\b(plata|dormid[oa]s?|guita|palancas?)\b/i;   // + palanca (owner 2026-07-14: "esa palabra no se usa")
let pass = 0, fail = 0; const rotos = [];
const check = (origen, texto) => {
  if (typeof texto !== "string" || !texto.trim()) return;
  const m = texto.match(BANNED);
  if (m) { fail++; rotos.push({ origen, palabra: m[0], gist: texto.replace(/\s+/g, " ").slice(Math.max(0, m.index - 40), m.index + 40) }); }
  else pass++;
};
// PISO SELLADO (paridad byte-exact del oráculo · triage [39]): las rutas RICAS del motor todavía dicen "palanca";
// no se tocan — en prod corren SIEMPRE narradas y el prompt (P6) prohíbe el eco. La palabra 'palanca' se exime SOLO
// en esas rutas; plata/dormido/guita NO se eximen en ninguna.
const SEALED_ROUTES = /^(client_dive|client_comparison|comparison|compare_|cross_domain|qi_compare)/;
const checkResp = (origen, r) => {
  if (!r) return;
  const sealed = SEALED_ROUTES.test(r.route || "");
  const t = r.text || r.opener || "";
  if (sealed) {
    const hard = t.match(/\b(plata|dormid[oa]s?|guita)\b/i);
    if (hard) { fail++; rotos.push({ origen: `${origen} [${r.route}]`, palabra: hard[0], gist: t.replace(/\s+/g, " ").slice(Math.max(0, hard.index - 40), hard.index + 40) }); }
    else pass++;
  } else check(`${origen} [${r.route || "-"}]`, t);
  for (const s of (r.suggestions || [])) check(`${origen} · sugerencia`, s);
};

// ── (1a) RUNTIME · batería por el seam (misma cobertura del gate de promesas + resumen + simulate) ──
const S = (o) => ({ schemaVersion: 1, scenario: "actual", ...o });
const SPECS = [];
const METS = ["ventas", "margen", "contribucion", "costo", "carga", "capital", "rotacion", "doh"];
const DIMS = ["cliente", "sku", "marca", "familia", "bodega"];
for (const m of METS) for (const d of DIMS) {
  SPECS.push(S({ operation: "overview", metric: m, dimension: d }));
  SPECS.push(S({ operation: "rank", metric: m, dimension: d, limit: 3 }));
}
SPECS.push(S({ operation: "diagnose", metric: "contribucion", dimension: "cliente" }));
SPECS.push(S({ operation: "diagnose", metric: "contribucion", dimension: "cliente", filters: { marca: "Samsung" } }));
SPECS.push(S({ operation: "diagnose", metric: "contribucion", dimension: "cliente", focus: "resumen_ejecutivo" }));
SPECS.push(S({ operation: "dive", metric: "margen", dimension: "cliente", entity: "Falabella" }));
SPECS.push(S({ operation: "dive", metric: null, dimension: "sku", entity: "SAM-REF500L" }));
SPECS.push(S({ operation: "compare", metric: "margen", dimension: "cliente", comparison: { dimension: "cliente", entities: ["Falabella", "Lider"] } }));
SPECS.push(S({ operation: "compare", metric: "margen", dimension: "marca", comparison: { dimension: "marca", entities: ["Samsung", "LG"] } }));
SPECS.push(S({ operation: "why", metric: "margen", dimension: "cliente", entity: "Falabella" }));
SPECS.push(S({ operation: "recommend", metric: "margen", dimension: "cliente" }));
for (const f of ["vs_anterior", "vs_presupuesto", "descomposicion_vol_precio", "caida_clientes", "rank_venta", "precio_realizado", "mix_familia"]) SPECS.push(S({ operation: "ventas", metric: "ventas", dimension: "cliente", focus: f }));
for (const f of ["bajo_benchmark", "palancas", "subir_precio", "causa_precio", "causa_costo", "alto_margen_subpenetrado", "alto_volumen_bajo_margen", "stock_bajo_margen"]) SPECS.push(S({ operation: "margin", metric: "margen", dimension: "cliente", focus: f }));
for (const f of ["concentracion", "no_capturada", "origen", "alta_venta_baja_contribucion", "rank"]) SPECS.push(S({ operation: "contribucion", metric: "contribucion", dimension: "cliente", focus: f }));
for (const f of ["frenado", "quiebre", "sobrestock", "top_sellers", "mas_vendidos_mes"]) SPECS.push(S({ operation: "inventory", metric: "capital", dimension: "sku", focus: f }));
SPECS.push(S({ operation: "inventory", metric: "capital", dimension: "sku", focus: "stale", staleDays: 90 }));
SPECS.push(S({ operation: "inventory", metric: "capital", dimension: "bodega", focus: "frenado" }));
SPECS.push(S({ operation: "inventory", metric: "capital", dimension: "sku", focus: "frenado", filters: { bodega: "Concepción" } }));
SPECS.push(S({ operation: "table", metric: "ventas", dimension: "cliente", transform: { kind: "assumption", op: "delta", value: 3, unit: "pct", base: "real" } }));
SPECS.push(S({ operation: "table", metric: "capital", dimension: "bodega", transform: { kind: "assumption", op: "delta", value: -10, unit: "pct", base: "real" } }));
for (const spec of SPECS) {
  let r; try { r = A(spec, {}, { scenario: "bonanza" }); } catch (e) { fail++; rotos.push({ origen: `${spec.operation}:${spec.focus || spec.metric}@${spec.dimension}`, palabra: "THROW", gist: String(e && e.message).slice(0, 70) }); continue; }
  checkResp(`${spec.operation}${spec.focus ? ":" + spec.focus : ""}@${spec.dimension}`, r);
}

// ── (1b) RUNTIME · composers conversacionales (explain/meta/recommendation sobre evidencia representativa) ──
const LAST_SIM = composeSpecSimulate({ metric: "ventas", dimension: "cliente", filters: {}, transform: { kind: "assumption", op: "delta", value: 3, unit: "pct", base: "real" } }).evidence;
const LAST_INV = { inventory: { total: 33200, byBodega: [{ bodega: "Valparaíso", usd: 24800, pct: 75 }], bySku: [{ sku: "LG-DRYER8KG", usd: 13600, doh: 165, rotacion: 1, critico: true }, { sku: "BOS-SANDER", usd: 11200, doh: 115, rotacion: 1.6, critico: false }] } };
const LAST_DIAG = { findings: [{ detector: "carga", titulo: "Carga comercial alta", subtotal_usd: 655000, items: [{ entidad: "Falabella", usd: 194000 }] }, { detector: "capital", titulo: "Capital detenido", subtotal_usd: 33200, items: [{ entidad: "LG-DRYER8KG", usd: 13600 }] }] };
checkResp("conv · recommendation", AC(S({ turn_type: "followup_recommendation" }), { lastEvidence: LAST_SIM }, {}));
checkResp("conv · explain inventario", AC(S({ turn_type: "followup_explain" }), { lastEvidence: LAST_INV }, {}));
checkResp("conv · explain diagnose", AC(S({ turn_type: "followup_explain" }), { lastEvidence: LAST_DIAG }, {}));
checkResp("conv · meta fuera_de_dato", AC(S({ turn_type: "meta_question", meta: "fuera_de_dato" }), {}, {}));
checkResp("conv · meta real_o_supuesto", AC(S({ turn_type: "meta_question", meta: "real_o_supuesto" }), { lastEvidence: LAST_SIM }, {}));

// ── (1c) RUNTIME · Sentrix (Mesa/lentes) + glosario + universo DISPONIBLE del narrador ──
const res = buildResumenEjecutivo("bonanza");
check("resumen · lectura", res.lectura);
for (const f of (res.focos || [])) check("resumen · foco label", f.label);
for (const [k, v] of Object.entries(METRIC_DEFS)) check(`glosario · ${k}`, v);
check("narrador · DISPONIBLE", buildDisponibleMenu());
for (const [tipo, foco] of [["client", "Falabella"], ["sku", "SAM-TV55"], ["marca", "Samsung"], ["bodega", "Valparaíso"]]) {
  const ring = buildControlRing(tipo, foco, "bonanza");
  if (!ring) continue;
  check(`ring ${tipo} · framing`, `${ring.framingVerb || ""} ${ring.leverLabel || ""}`);
  for (const c of (ring.columns || [])) check(`ring ${tipo} · columna`, c.label);
  for (const r of (ring.rows || [])) if (r.note) check(`ring ${tipo} · note`, r.note);
}

// ── (2) ESTÁTICO · UI .jsx (textos que React emite directo) sin comentarios ──
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
for (const f of ["src/ui/SentrixPanel.jsx", "src/ui/ChatADI.jsx", "src/ui/InlineChart.jsx"]) {
  const src = stripComments(fs.readFileSync(path.join(root, f), "utf8"));
  let m, re = new RegExp(BANNED.source, "gi"), n = 0;
  while ((m = re.exec(src))) { n++; fail++; rotos.push({ origen: `estático · ${f}`, palabra: m[0], gist: src.slice(Math.max(0, m.index - 50), m.index + 40).replace(/\s+/g, " ") }); }
  if (!n) pass++;
}

console.log(`── _registro_gate: ${pass} textos limpios · ${fail} con registro viejo ──`);
if (rotos.length) { console.log("✗ REGISTRO VIEJO EMITIDO:"); rotos.forEach((r) => console.log(`   [${r.origen}] «${r.palabra}» …${r.gist}…`)); }
process.exit(fail ? 1 : 0);
