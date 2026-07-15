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
  'export { buildMesaEstado, buildWatchlistEstado } from "./src/adi/sentrix/mesa.js";',
  'export { buildCuadroMando } from "./src/adi/sentrix/cuadro.js";',
  'export { buildMesaCapital, buildCuadroCapital } from "./src/adi/sentrix/mesaCapital.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }
const { answerADIFromSpec: A, answerConversational: AC, coerceSpec: C, buildMesaEstado: MB, buildWatchlistEstado: WB, buildCuadroMando: CMB, buildMesaCapital: MCB, buildCuadroCapital: CCB } = M;

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
// SIMULATE (S1/S2 · 2026-07-15): las sugerencias de las proyecciones también son promesas
EMISORES.push(S({ operation: "simulate", metric: "ventas", dimension: "cliente", transform: { kind: "assumption", op: "delta", value: 3, unit: "pct", base: "real" } }));
EMISORES.push(S({ operation: "simulate", metric: "carga", dimension: "cliente", simAction: "carga_target" }));
EMISORES.push(S({ operation: "simulate", metric: "capital", dimension: "sku", simAction: "liberar_capital" }));

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
// + PROMESAS DE LA UI (owner 2026-07-10: cada gráfico de la Ficha lleva su botón "que ADI lo explique" — esas
// preguntas TAMBIÉN son promesas: deben contar la historia de contratos, jamás degradar). Instanciadas con
// entidades reales de cada eje (cliente · marca · SKU) — si un botón deja de responder, este gate lo caza.
for (const s of [
  "¿En cuántos clientes se concentra mi contribución?",
  "¿En cuántas marcas se concentra mi contribución?",
  "¿En cuántos SKU se concentra mi contribución?",
  "Profundiza en Falabella", "Profundiza en Samsung", "Profundiza en SAM-TV55",
  "¿De dónde saca Falabella su contribución?", "¿De dónde saca SAM-TV55 su contribución?",
  "¿Por qué Falabella cede margen?", "¿Por qué SAM-TV55 cede margen?",
  // Pareto reflejo de la tabla (owner 2026-07-10): negocio por métrica + composición de marca/familia por SKU
  "¿Quiénes son mis principales clientes por venta?",
  "¿Cuáles son mis principales marcas por venta?",
  "¿Cuáles son los SKU que más venden?",
  "¿Cuáles son los SKU que más venden de Samsung?",
  "Top SKU por contribución de Samsung",
  // composición de cliente/SKU (matriz 2026-07-10): ADI cuenta TODO de la entidad en ventas y contribución (multi C.1)
  "¿Cómo está ABC en ventas y contribución?",
  "¿Cómo está SAM-TV55 en ventas y contribución?",
]) if (!promesas.has(s)) promesas.set(s, { lastEv: null, emisor: "ui:ficha" });
// + PROMESAS DE LA MESA 2.0 (owner 2026-07-14 · sello + semáforo contra la vara + "qué cambió"): las preguntas que
// la Mesa ofrece se cosechan del MÓDULO REAL (buildMesaEstado) por escenario — si el dato mueve la entidad nombrada,
// el gate prueba la pregunta que la UI de verdad va a disparar. + las fijas: los focos (_MESA_FOCO_ASK, en prod
// desde la Mesa 1.0, ahora lockeadas) y el semáforo del cuadro por eje (cede-margen instanciada por dimensión).
for (const sc of ["bonanza", "tension", "crisis"]) {
  let me; try { me = MB(sc); } catch { continue; }
  for (const [k, e] of Object.entries(me.estados || {})) if (e && e.ask && !promesas.has(e.ask)) promesas.set(e.ask, { lastEv: null, emisor: `mesa2:estado-${k}@${sc}` });
  if (me.accion && me.accion.ask && !promesas.has(me.accion.ask)) promesas.set(me.accion.ask, { lastEv: null, emisor: `mesa2:plan@${sc}` });
  for (const c of (me.cambios || [])) if (c.ask && !promesas.has(c.ask)) promesas.set(c.ask, { lastEv: null, emisor: `mesa2:cambio-${c.key}@${sc}` });
  // SIMULATE S4 · los asks del bloque "¿Y si…?" son promesas: cada uno debe correr la proyección real, jamás degradar.
  for (const s2 of (me.simulaciones || [])) if (s2.ask && !promesas.has(s2.ask)) promesas.set(s2.ask, { lastEv: null, emisor: `mesa2:ysi-${s2.key}@${sc}` });
  // PASE 2 · EN ALERTA (la ask del bloque) + WATCHLIST: cualquier fila de cualquier eje es seguible → la ask de
  // cada seguido se instancia DATA-DRIVEN para TODAS las filas de los 4 ejes del cuadro (× 3 escenarios).
  if (me.alertas && me.alertas.ask && !promesas.has(me.alertas.ask)) promesas.set(me.alertas.ask, { lastEv: null, emisor: `mesa2:alertas@${sc}` });
  for (const d of ["cliente", "sku", "marca", "bodega"]) {
    let wl; try { wl = WB(CMB(d, sc).rows.map((r) => ({ dim: d, name: r.name })), sc); } catch { continue; }
    for (const it of (wl.items || [])) if (it.ask && !promesas.has(it.ask)) promesas.set(it.ask, { lastEv: null, emisor: `mesa2:watch-${d}@${sc}` });
  }
  // PASE 1 CUADRO 2.0 (owner 2026-07-15) · el chip Acción de CADA fila es una promesa: se cosecha DATA-DRIVEN de
  // las filas reales del cuadro (4 ejes × 3 escenarios) — si el dato mueve una acción o una entidad, el gate prueba
  // la pregunta que el chip de verdad va a disparar.
  for (const d of ["cliente", "sku", "marca", "bodega"]) {
    let cmq; try { cmq = CMB(d, sc); } catch { continue; }
    for (const r of (cmq.rows || [])) if (r.accionAsk && !promesas.has(r.accionAsk)) promesas.set(r.accionAsk, { lastEv: null, emisor: `cuadro:accion-${d}@${sc}` });
  }
  // CARA CAPITAL (owner 2026-07-15) · TODO lo que la cara ofrece es promesa: tramos del mapa, KPIs, focos, listas
  // repongo/liquido (block + por línea), "¿y si…?", la pata de inventario del "En alerta" y el chip Acción / Estado
  // de cada fila del cuadro de capital (2 ejes) — cosechado DATA-DRIVEN del módulo real × 3 escenarios.
  let mc; try { mc = MCB(sc); } catch { mc = null; }
  if (mc) {
    const put = (ask, tag) => { if (ask && !promesas.has(ask)) promesas.set(ask, { lastEv: null, emisor: `mesacap:${tag}@${sc}` }); };
    for (const t of (mc.mapa && mc.mapa.tramos) || []) put(t.ask, `tramo-${t.key}`);
    for (const k of mc.kpis || []) put(k.ask, `kpi-${k.key}`);
    for (const f of mc.focos || []) put(f.ask, `foco-${f.key}`);
    for (const [lista, tag] of [[mc.reponer, "reponer"], [mc.liquidar, "liquidar"]]) {
      if (!lista) continue;
      put(lista.ask, tag);
      for (const it of lista.items || []) put(it.ask, `${tag}-item`);
    }
    for (const s2 of mc.simulaciones || []) put(s2.ask, `ysi-${s2.key}`);
    if (mc.alertas) put(mc.alertas.ask, "alertas");
  }
  for (const eje of ["sku", "bodega"]) {
    let ccq; try { ccq = CCB(eje, sc); } catch { continue; }
    for (const r of (ccq.rows || [])) if (r.accionAsk && !promesas.has(r.accionAsk)) promesas.set(r.accionAsk, { lastEv: null, emisor: `cuadrocap:accion-${eje}@${sc}` });
  }
}
for (const s of [
  "¿Quiénes están bajo el margen mínimo?",
  "¿Cuánta carga comercial puedo recuperar?",
  "¿Dónde está detenido mi capital?",
  "¿Por qué Samsung cede margen?",
]) if (!promesas.has(s)) promesas.set(s, { lastEv: null, emisor: "ui:mesa2" });

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
