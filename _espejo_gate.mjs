/* === _espejo_gate.mjs · GATE DEL ESPEJO (owner 2026-07-25 · nace de dos cazas en vivo: «quiero nuevos
 * prorrateos» y «cambia logística a otro %») ===
 * REGLA: TODO vocabulario que ADI emite debe entrar por la red de vuelta — si ADI sugiere una frase entre
 * «guillemets», esa frase tiene que RECLAMAR cuando el usuario la escribe (en el estado del flujo donde ADI
 * la ofreció). Este gate lo hace SISTEMÁTICO: corre las respuestas representativas del territorio, cosecha
 * cada «frase» emitida y la prueba por la cadena real (coerceFloor) en TRES estados: P&L sellado · flujo en
 * etapa gastos · flujo en etapa % (rearme). Una frase pasa si reclama en alguno.
 * v1: territorio P&L (donde nació la regla). Crecer por familia: sumar respuestas al corpus, no reestructurar.
 * Determinístico · sin key. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_ege.js"), out = path.join(root, "_egb.mjs");
fs.writeFileSync(entry, [
  'export { coerceFloor } from "./src/adi/coerceChain.js";',
  'export { composePnl, pnlExplain, pnlRecommend, setPnlLines, clearPnl, resetPnlDraft, pnlDraft, buildPnlCascade } from "./src/adi/pnl.js";',
  'export { buildMesaResultado } from "./src/adi/sentrix/mesaResultado.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }
const { coerceFloor: CF, composePnl, pnlExplain, pnlRecommend, setPnlLines, clearPnl, resetPnlDraft, buildMesaResultado } = M;

const LINES = [{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }];
const SC = { scenario: "bonanza" };
const sealed = () => { clearPnl(); resetPnlDraft(); setPnlLines(LINES.map((l) => ({ ...l }))); };
const draftGastos = () => { clearPnl(); resetPnlDraft(); composePnl({ action: "start" }, null, SC); };            // flujo fresco → etapa gastos
const draftPcts = () => { sealed(); composePnl({ action: "rearmar" }, null, SC); };                               // rearme → etapa %
const draftOtra = () => { draftGastos(); composePnl({ action: "draft_gastos", lines: [{ nombre: "Seguros", pct: null }, { nombre: "Fletes", pct: 2 }] }, null, SC); };   // etapa % con OTRA estructura (la del corpus)

// ── 1 · CORPUS · las respuestas representativas del territorio P&L (todas las voces que el usuario VE) ──
const corpus = [];
const emit = (tag, r) => { if (r && typeof r.text === "string") corpus.push([tag, r.text]); };
sealed();
const ctxDeixis = { last: { entityList: { entities: ["Ripley", "La Polar"], dimension: "cliente" } } };
emit("start-con-lineas", composePnl({ action: "start" }, null, SC));
emit("recall", composePnl({ action: "recall" }, null, SC));
emit("resultado", composePnl({ action: "resultado" }, null, SC));
emit("peso", composePnl({ action: "peso" }, null, SC));
emit("edit_set", composePnl({ action: "edit_set", nombre: "Logística", pct: 2.5 }, null, SC)); sealed();
emit("edit_reask", composePnl({ action: "edit_reask", nombre: "Logística" }, null, SC));
emit("edit_add_nopct", composePnl({ action: "edit_add_nopct", nombre: "Bodegaje" }, null, SC));
emit("edit_remove", composePnl({ action: "edit_remove", nombre: "Promotores" }, null, SC)); sealed();
emit("simulate_line", composePnl({ action: "simulate_line", nombre: "Logística", pct: 2 }, null, SC));
emit("sim_scoped", composePnl({ action: "simulate_line", nombre: "Logística", pct: 2, entidad: "Falabella", eje: "cliente" }, null, SC));
emit("resultado_entidad", composePnl({ action: "resultado_entidad", entidad: "Falabella" }, null, SC));
emit("resultado_scoped", composePnl({ action: "resultado_scoped", entidad: "Falabella", eje: "cliente", covered: true }, null, SC));
emit("scoped_familia", composePnl({ action: "resultado_scoped", entidad: "Cuidado Personal", eje: "familia", covered: true }, null, SC));
emit("sin_cobertura", composePnl({ action: "resultado_scoped", entidad: "Makita", eje: "marca", covered: false }, null, SC));
emit("scoped_missing", composePnl({ action: "scoped_missing", pedido: "Walmart" }, null, SC));
for (const eje of ["cliente", "familia", "marca"]) emit(`tabla_${eje}`, composePnl({ action: "tabla_eje", eje }, null, SC));
emit("redirect", composePnl({ action: "tabla_eje", eje: "bodega", pedido: "punto de venta" }, null, SC));
emit("deixis", composePnl({ action: "resultado_deixis" }, ctxDeixis, SC));
emit("deixis_sin_set", composePnl({ action: "resultado_deixis" }, {}, SC));
emit("volver", composePnl({ action: "volver" }, null, SC));
emit("meta_global", composePnl({ action: "meta_venta", targetK: 25000 }, null, SC));
emit("meta_scoped", composePnl({ action: "meta_venta", targetK: 500, entidad: "Falabella", eje: "cliente" }, null, SC));
emit("proyeccion", composePnl({ action: "proyeccion_venta", ventaK: 25000, entidad: "Falabella", eje: "cliente" }, null, SC));
emit("proyeccion_negocio", composePnl({ action: "proyeccion_venta", ventaK: 120000, negocio: true }, null, SC));
emit("explica", pnlExplain({ pnl: true, entidad: "Falabella", entityType: "cliente" }, null, SC));
emit("decisiones", pnlRecommend({ pnl: true }, null, SC));
emit("desconocida", composePnl({ action: "zzz" }, null, SC));
// el flujo guiado (draft) — sus voces también emiten frases
clearPnl(); resetPnlDraft();
emit("start-fresco", composePnl({ action: "start" }, null, SC));
emit("draft_help", composePnl({ action: "draft_help" }, null, SC));
emit("draft_gastos", composePnl({ action: "draft_gastos", lines: [{ nombre: "Seguros", pct: null }, { nombre: "Fletes", pct: 2 }] }, null, SC));
emit("draft_stay", composePnl({ action: "draft_stay" }, null, SC));
emit("draft_cancel", composePnl({ action: "draft_cancel" }, null, SC));
sealed(); resetPnlDraft();
emit("rearmar", composePnl({ action: "rearmar" }, null, SC)); resetPnlDraft();
emit("forget", composePnl({ action: "forget" }, null, SC));           // deja el P&L vacío
emit("sin_pnl", composePnl({ action: "resultado" }, null, SC));
emit("forget_vacio", composePnl({ action: "forget" }, null, SC));
sealed();
const mrE = (clearPnl(), resetPnlDraft(), buildMesaResultado("bonanza"));
if (mrE && mrE.empty) corpus.push(["cara_empty", `${mrE.empty.texto} «${mrE.empty.prefill}»`]);
sealed();

// ── 2 · COSECHA · toda «frase» emitida (dedupe) ──
const frases = new Map();
for (const [tag, text] of corpus)
  for (const m of text.matchAll(/«([^«»\n]{3,90})»/g)) { const f = m[1].trim(); if (!frases.has(f)) frases.set(f, tag); }

// ── 3 · PRUEBA · cada frase reclama por la cadena en ALGÚN estado del flujo (sellado · gastos · %) ──
// EXCUSADAS: frases descriptivas que NO son instrucciones (hoy ninguna — agregar solo con justificación escrita).
const EXCUSADAS = new Set([]);
let pass = 0, fail = 0;
const claims = (q) => { try { const s = CF(q, true, null); return !!s; } catch { return false; } };
for (const [frase, origen] of frases) {
  if (EXCUSADAS.has(frase)) { pass++; continue; }
  let okc = false, estado = "";
  sealed(); if (claims(frase)) { okc = true; estado = "sellado"; }
  if (!okc) { draftGastos(); if (claims(frase)) { okc = true; estado = "gastos"; } resetPnlDraft(); }
  if (!okc) { draftPcts(); if (claims(frase)) { okc = true; estado = "pcts"; } resetPnlDraft(); }
  if (!okc) { draftOtra(); if (claims(frase)) { okc = true; estado = "pcts-otra"; } resetPnlDraft(); }
  if (okc) { pass++; console.log(`  ✓ «${frase}» reclama (${estado}) [${origen}]`); }
  else { fail++; console.log(`  ✗ ESPEJO ROTO «${frase}» — emitida en [${origen}] y NO reclama en ningún estado`); }
}
clearPnl(); resetPnlDraft();
console.log(`\n── _espejo_gate: ${pass} frases emitidas que reclaman · ${fail} espejos rotos (de ${frases.size}) ──`);
process.exit(fail ? 1 : 0);
