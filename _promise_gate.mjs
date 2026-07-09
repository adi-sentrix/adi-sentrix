/* === _promise_gate.mjs · GATE DE PROMESAS (owner 2026-07-09: "ADI no puede recomendar algo que no tiene") ===
 * Toda SUGERENCIA que ADI emite es una promesa: al clickearla, DEBE responder — jamás "no tengo eso".
 * Método: (1) COSECHA — corre una batería representativa (matriz de specs + focos de dominio + diagnose/dive/compare)
 * y junta cada r.suggestions con la evidencia del turno que lo emitió; (2) PRUEBA — cada sugerencia se re-entra por
 * la cadena real (coerceSpec con un spec NEUTRO — el peor caso del LLM — + answerConversational con el contexto del
 * turno emisor); (3) VEREDICTO — falla si alguna promete y degrada (spec_blocked_* · "No tengo a…" · executor-error).
 * Clarificación se tolera (pregunta de vuelta ≠ promesa rota) pero se reporta. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_pge.js"), out = path.join(root, "_pgb.mjs");
fs.writeFileSync(entry, [
  'export { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";',
  'export { answerConversational } from "./src/adi/conversation.js";',
  'export { coerceSpec } from "./src/adi/coerceChain.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }
const { answerADIFromSpec: A, answerConversational: AC, coerceSpec: C } = M;

const S = (o) => ({ schemaVersion: 1, scenario: "actual", ...o });

// ── 1 · COSECHA · batería representativa (respuestas reales → sus sugerencias) ──
const EMISORES = [];
const METS = ["ventas", "margen", "contribucion", "costo", "carga", "capital", "rotacion", "doh"];
const DIMS = ["cliente", "sku", "marca", "familia", "bodega"];
for (const m of METS) for (const d of DIMS) {
  EMISORES.push(S({ operation: "overview", metric: m, dimension: d }));
  EMISORES.push(S({ operation: "rank", metric: m, dimension: d, limit: 3 }));
}
EMISORES.push(S({ operation: "diagnose", metric: "contribucion", dimension: "cliente" }));
EMISORES.push(S({ operation: "dive", metric: "margen", dimension: "cliente", entity: "Falabella" }));
EMISORES.push(S({ operation: "dive", metric: null, dimension: "sku", entity: "SAM-REF500L" }));
EMISORES.push(S({ operation: "compare", metric: "margen", dimension: "cliente", comparison: { dimension: "cliente", entities: ["Falabella", "Lider"] } }));
for (const f of ["vs_anterior", "vs_presupuesto", "descomposicion_vol_precio", "caida_clientes", "rank_venta"]) EMISORES.push(S({ operation: "ventas", metric: "ventas", dimension: "cliente", focus: f }));
for (const f of ["bajo_benchmark", "palancas", "subir_precio", "causa_precio", "causa_costo", "alto_volumen_bajo_margen"]) EMISORES.push(S({ operation: "margin", metric: "margen", dimension: "cliente", focus: f }));
for (const f of ["concentracion", "no_capturada"]) EMISORES.push(S({ operation: "contribucion", metric: "contribucion", dimension: "cliente", focus: f }));
for (const f of ["frenado", "quiebre", "sobrestock", "top_sellers", "mas_vendidos_mes"]) EMISORES.push(S({ operation: "inventory", metric: "capital", dimension: "sku", focus: f }));

const promesas = new Map();   // texto → { deCtx (lastEvidence del emisor), emisor }
for (const spec of EMISORES) {
  let r; try { r = A(spec, {}, {}); } catch { continue; }
  if (!r || !Array.isArray(r.suggestions)) continue;
  const lastEv = r.evidence && !r.evidence.followup ? r.evidence : null;
  for (const s of r.suggestions) {
    if (typeof s === "string" && s.trim() && !promesas.has(s)) promesas.set(s, { lastEv, emisor: `${spec.operation}${spec.focus ? ":" + spec.focus : ""}@${spec.dimension}` });
  }
}
// + el redirect FUERA-DE-DATO (owner 2026-07-09: "campañas de marketing" → convierte a palancas): sus chips
// también son promesas — se cosechan del composeMeta real vía la ruta conversacional.
try {
  const rMeta = AC(S({ turn_type: "meta_question", meta: "fuera_de_dato" }), {}, {});
  if (rMeta && Array.isArray(rMeta.suggestions))
    for (const s of rMeta.suggestions) if (typeof s === "string" && s.trim() && !promesas.has(s)) promesas.set(s, { lastEv: null, emisor: "meta:fuera_de_dato" });
} catch { /* */ }

// ── 2 · PRUEBA · cada promesa se re-entra por la cadena con TRES formas del LLM (neutro · nulo-clarify ·
// compare-basura — la forma exacta que rompió "¿es por volumen o por precio?" el 2026-07-09). La red
// determinística debe rescatar la promesa SEA CUAL SEA la clasificación del traductor. ──
const SHAPES = [
  ["neutro", () => S({ operation: "overview", metric: "ventas", dimension: "cliente", entity: null, filters: null })],
  ["clarify", () => S({ operation: "clarification_needed", metric: null, dimension: null, entity: null, filters: null })],
  ["cmp-basura", () => S({ operation: "compare", metric: "ventas", dimension: "cliente", comparison: { dimension: "cliente", entities: ["x", "y"] } })],
];
const ROTA_RE = /^(No tengo a |No te puedo atribuir|No encuentro |Esa vista todav[ií]a|No supe c[oó]mo|Se me trab[oó])/;
let pass = 0; const rotas = [], clarifs = [];
for (const [texto, meta] of promesas) {
  let rota = null, clarifico = false;
  for (const [shapeName, mk] of SHAPES) {
    let r;
    try { r = AC(C(texto, mk(), !!meta.lastEv, null), { lastEvidence: meta.lastEv }, { scenario: "bonanza" }); }
    catch (e) { rota = { shapeName, motivo: "THROW " + String(e && e.message).slice(0, 60) }; break; }
    const t = (r && r.text) || "";
    if (!t.trim() || /^spec_blocked_/.test(r.route || "") || ROTA_RE.test(t.trim())) { rota = { shapeName, motivo: `[${r.route}] ${t.slice(0, 80)}` }; break; }
    if (r.route === "clarification_needed") clarifico = true;
  }
  if (rota) rotas.push({ texto, emisor: meta.emisor, motivo: `(forma ${rota.shapeName}) ${rota.motivo}` });
  else { pass++; if (clarifico) clarifs.push({ texto, emisor: meta.emisor }); }
}

console.log(`── _promise_gate: ${promesas.size} promesas cosechadas de ${EMISORES.length} respuestas ──`);
console.log(`   CUMPLIDAS ${pass - clarifs.length} · CLARIFICAN ${clarifs.length} (toleradas) · ROTAS ${rotas.length}\n`);
if (clarifs.length) { console.log("~ clarifican (revisar a futuro):"); clarifs.forEach((c) => console.log(`   «${c.texto}» (de ${c.emisor})`)); console.log(""); }
if (rotas.length) { console.log("✗ PROMESAS ROTAS:"); rotas.forEach((c) => console.log(`   «${c.texto}» (de ${c.emisor}) → ${c.motivo}`)); }
process.exit(rotas.length ? 1 : 0);
