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
const root = process.cwd(); const entry = path.join(root, `_rge.tmp${process.pid}.js`), out = path.join(root, `_rgb.tmp${process.pid}.mjs`);
fs.writeFileSync(entry, [
  'export { initTenant } from "./src/data/tenantStore.js";',
  'export { TENANT_DEMO } from "./src/data/tenants/demo.js";',
  'export { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";',
  'export { answerConversational } from "./src/adi/conversation.js";',
  'export { composeSpecSimulate, buildResumenEjecutivo } from "./src/adi/specRetrieval.js";',
  'export { buildMesaEstado, buildWatchlistEstado } from "./src/adi/sentrix/mesa.js";',
  'export { buildCuadroMando } from "./src/adi/sentrix/cuadro.js";',
  'export { buildMesaCapital, buildCuadroCapital, CAPITAL_ESTADOS } from "./src/adi/sentrix/mesaCapital.js";',
  'export { buildControlRing } from "./src/adi/sentrix/control.js";',
  'export { METRIC_DEFS } from "./src/adi/sentrix/glossary.js";',
  'export { buildDisponibleMenu } from "./src/adi/llm/capabilities.js";',
  'export { composePnl, setPnlLines, clearPnl, resetPnlDraft, pnlExplain, pnlRecommend } from "./src/adi/pnl.js";',
  'export { buildMesaResultado } from "./src/adi/sentrix/mesaResultado.js";',
  'export { stripLanguageLeaks, detectVoseo } from "./src/adi/llm/voiceGuard.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
M.initTenant(M.TENANT_DEMO);
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }
const { answerADIFromSpec: A, answerConversational: AC, composeSpecSimulate, buildResumenEjecutivo, buildMesaEstado, buildWatchlistEstado, buildCuadroMando, buildControlRing, METRIC_DEFS, buildDisponibleMenu, buildMesaCapital, buildCuadroCapital, CAPITAL_ESTADOS, composePnl, setPnlLines, clearPnl, resetPnlDraft, pnlExplain, pnlRecommend, buildMesaResultado, stripLanguageLeaks, detectVoseo } = M;

// + palanca (owner 2026-07-14: "esa palabra no se usa") · + apretar/aprieta (owner 2026-07-26: "poco ejecutivo")
// + detenido/detenida (owner 2026-08-15, autorizando la pasada de registro): «No quiero que el producto sugiera
//   "detenido" en ninguna superficie visible si ya definimos "inmovilizado" como término correcto». Hasta hoy la
//   palabra estaba prohibida en CLAUDE.md §4 pero NO en este barrido, así que se filtró por 30 sitios —un chip
//   llegó a pantalla— sin que ningún gate se pusiera rojo. El VERBO no entra («el SKU se detuvo hace 94 días» es
//   legítimo y sigue en el corpus limpio): lo que se veta es el adjetivo/participio que nombra el capital.
// + vara/varas (owner 2026-08-15, el pase siguiente): estaba en la lista de CLAUDE.md §4 desde el principio y
//   tampoco la barría nadie más que `_mesa_capital_gate`, y solo en la cara Capital. Sobrevivió en 5 sitios
//   visibles —el tip del chat entre ellos—. `\b` la separa de «varado»/«varios»; el stripper de voz ya la
//   reescribe en lo narrado, así que este barrido cubre la otra mitad: el texto FIJO.
const BANNED = /\b(plata|dormid[oa]s?|guita|palancas?|apr[ei]et\w*|detenid[oa]s?|varas?)\b/i;

// ── VOSEO · LA MITAD QUE ESTE GATE NO MIRABA (owner 2026-08-10, certificación live · defecto 4) ────────────────
// EL HUECO, textual del owner: "el _registro_gate no lo cazó porque busca VOCABULARIO PROHIBIDO, no FORMAS
// VERBALES". `BANNED` es una lista de sustantivos y de un verbo puntual; «querés», «podés», «decime» y «mirá» no
// están en ninguna lista, así que pasaban los 86 gates con todo en verde mientras el producto hablaba en un
// dialecto que no es el suyo. El registro es "formal LatAm, sin chilenismos" (CLAUDE.md): eso es tuteo neutro.
//
// EL CIERRE ES UN LOOKAHEAD UNICODE, NO `\b`: `\b` es ASCII y no cierra después de vocal acentuada, así que
// «comenzá»/«mirá»/«considerá» se escapaban del propio detector. Es la misma trampa que progressiveDisclosure.js
// ya documenta dos veces; acá se evita de entrada.
//
// LAS FORMAS AMBIGUAS QUEDAN FUERA, a propósito y con el mismo criterio que el resto de la suite (falso negativo
// antes que falso positivo): los imperativos en -í («pedí», «elegí», «seguí») coinciden con el pretérito de
// primera persona, y las formas en -ás sin tilde son tuteo correcto. Se listan las inequívocas.
// LA TILDE ES OBLIGATORIA donde la forma SIN tilde es tuteo correcto («necesitas», «sabes», «haces», «vendes»,
// «debes») o tercera persona («hace», «pone», «entrega»). Sin ese cuidado el gate marca prosa correcta, que es
// peor que no marcar nada: un gate que da falsos positivos se termina desactivando.
// ⚠ LA LISTA YA NO VIVE ACÁ (owner 2026-08-14). Estaba enumerada en este archivo, otra en `_registro_boleta_gate` y
// una tercera en `voiceGuard._VOSEO` — tres copias del mismo vocabulario, las tres incompletas y ninguna con las
// mismas entradas. Por ese desfase la captura del owner («…¿…familia querés simular este escenario?») salió a
// producción con los dos gates en VERDE. Ahora la fuente es UNA, `detectVoseo` de `voiceGuard` (la autoridad de
// voseo del repo, donde también vive el stripper de runtime), y sumar una forma es tocar un solo archivo.

/* ── EL RESIDUAL DEL CAMINO LEGADO, DECLARADO Y CONTADO (owner 2026-08-14) ─────────────────────────────────────
 * Al pasar este gate al detector completo apareció UN texto en voseo que NO se corrige en este pase: vive en
 * `src/adi/contracts/contractCloser.js` y su único importador es `answerADIFromSpec.js`, o sea el seam LEGADO —
 * el que se migra aparte, por decisión de producto (ver `_INFORME_PODA_2A/2B`). Corregirlo acá sería tocar el
 * camino que el encargo excluye, y dejarlo sin declarar sería esconderlo.
 * SE DECLARA POR SU TEXTO, no por archivo ni línea: así una redacción nueva no hereda la exención. Y el tamaño de
 * la lista se verifica al cierre — si alguien suma un voseo legado más, este gate se pone rojo igual. */
const LEGADO_VOSEO_DECLARADO = [
  "recuperás margen sin resignar venta",   // contracts/contractCloser.js · palanca de carga · sólo answerADIFromSpec
];
let legadoVistos = 0;

let pass = 0, fail = 0; const rotos = [];
const check = (origen, texto) => {
  if (typeof texto !== "string" || !texto.trim()) return;
  const m = texto.match(BANNED);
  const v = m ? null : detectVoseo(texto);
  if (m) { fail++; rotos.push({ origen, palabra: m[0], gist: texto.replace(/\s+/g, " ").slice(Math.max(0, m.index - 40), m.index + 40) }); }
  else if (v) {
    if (LEGADO_VOSEO_DECLARADO.some((d) => texto.includes(d))) { legadoVistos++; pass++; return; }
    const i = texto.indexOf(v); fail++; rotos.push({ origen: `${origen} · voseo`, palabra: v, gist: texto.replace(/\s+/g, " ").slice(Math.max(0, i - 40), i + 40) });
  }
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
    const hard = t.match(/\b(plata|dormid[oa]s?|guita|detenid[oa]s?|varas?)\b/i);
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
for (const f of ["frenado", "quiebre", "sobrestock", "top_sellers", "mas_vendidos_mes", "estado"]) SPECS.push(S({ operation: "inventory", metric: "capital", dimension: "sku", focus: f }));
SPECS.push(S({ operation: "inventory", metric: "capital", dimension: "sku", focus: "estado", filters: { bodega: "Concepción" } }));
SPECS.push(S({ operation: "inventory", metric: "capital", dimension: "sku", focus: "stale", staleDays: 90 }));
SPECS.push(S({ operation: "inventory", metric: "capital", dimension: "bodega", focus: "frenado" }));
SPECS.push(S({ operation: "inventory", metric: "capital", dimension: "sku", focus: "frenado", filters: { bodega: "Concepción" } }));
SPECS.push(S({ operation: "table", metric: "ventas", dimension: "cliente", transform: { kind: "assumption", op: "delta", value: 3, unit: "pct", base: "real" } }));
SPECS.push(S({ operation: "table", metric: "capital", dimension: "bodega", transform: { kind: "assumption", op: "delta", value: -10, unit: "pct", base: "real" } }));
// SIMULATE (S1/S2/S3 · 2026-07-15): la operación con contrato + las acciones específicas + el recommend meta-aware
SPECS.push(S({ operation: "simulate", metric: "ventas", dimension: "cliente", transform: { kind: "assumption", op: "delta", value: 3, unit: "pct", base: "real" } }));
SPECS.push(S({ operation: "simulate", metric: "carga", dimension: "cliente", simAction: "carga_target" }));
SPECS.push(S({ operation: "simulate", metric: "carga", dimension: "cliente", simAction: "carga_target", filters: { cliente: "Falabella" } }));
SPECS.push(S({ operation: "simulate", metric: "capital", dimension: "sku", simAction: "liberar_capital" }));
SPECS.push(S({ operation: "recommend", metric: "ventas", dimension: "cliente", goal: { pct: 3, dir: "subir" } }));
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
// MESA 2.0 (owner 2026-07-14) · todo lo que la Mesa emite (líneas de estado · acción priorizada · "qué cambió" ·
// sus preguntas) va en registro ejecutivo — por los 3 escenarios (los textos nombran entidades del dato).
for (const sc of ["bonanza", "tension", "crisis"]) {
  const m2 = buildMesaEstado(sc);
  for (const [k, e] of Object.entries(m2.estados || {})) { check(`mesa2 · ${k} línea (${sc})`, e.linea); check(`mesa2 · ${k} ask (${sc})`, e.ask); }
  if (m2.accion) { check(`mesa2 · acción (${sc})`, `${m2.accion.titulo}. ${m2.accion.detalle}`); check(`mesa2 · acción ask (${sc})`, m2.accion.ask); }
  for (const c of (m2.cambios || [])) { check(`mesa2 · cambio ${c.key} (${sc})`, c.texto); check(`mesa2 · cambio ask ${c.key} (${sc})`, c.ask); }
  // SIMULATE S4 · el bloque "¿Y si…?" (texto + ask) también va en registro ejecutivo.
  for (const s of (m2.simulaciones || [])) { check(`mesa2 · ysi ${s.key} (${sc})`, s.texto); check(`mesa2 · ysi ask ${s.key} (${sc})`, s.ask); }
  // PASE 2 · EN ALERTA + WATCHLIST: la línea del contador y cada seguido (sub + ask) van en registro ejecutivo —
  // instanciados para TODAS las filas de los 4 ejes (los textos nombran entidades del dato).
  if (m2.alertas) { check(`mesa2 · alertas línea (${sc})`, m2.alertas.linea); check(`mesa2 · alertas ask (${sc})`, m2.alertas.ask); }
  for (const d of ["cliente", "sku", "marca", "bodega"]) {
    const wl = buildWatchlistEstado(buildCuadroMando(d, sc).rows.map((r) => ({ dim: d, name: r.name })), sc);
    for (const it of (wl.items || [])) { check(`mesa2 · watch ${d}·${it.nombre} sub (${sc})`, it.sub); if (it.ask) check(`mesa2 · watch ${d}·${it.nombre} ask (${sc})`, it.ask); }
  }
  // PASE 1 CUADRO 2.0 · la microlectura del detector y la pregunta del chip Acción de CADA fila (4 ejes — los
  // textos nombran entidades del dato) también van en registro ejecutivo.
  for (const d of ["cliente", "sku", "marca", "bodega"]) {
    const cmg = buildCuadroMando(d, sc);
    for (const r of (cmg.rows || [])) {
      if (r.lectura) check(`cuadro · ${d}·${r.name} lectura (${sc})`, r.lectura);
      if (r.accionAsk) check(`cuadro · ${d}·${r.name} ask (${sc})`, r.accionAsk);
    }
  }
  // CARA CAPITAL (owner 2026-07-15) · todo lo que la cara emite (lectura del mapa, tramos, KPIs, focos, listas
  // repongo/liquido, "¿y si…?", pata de inventario, filas del cuadro de capital) va en registro ejecutivo.
  const mc = buildMesaCapital(sc);
  check(`mesacap · mapa lectura (${sc})`, mc.mapa.lectura);
  for (const t of mc.mapa.tramos) { check(`mesacap · tramo ${t.key} label (${sc})`, t.label); check(`mesacap · tramo ${t.key} ask (${sc})`, t.ask); }
  for (const k of mc.kpis) { check(`mesacap · kpi ${k.key} línea (${sc})`, `${k.label}. ${k.linea}`); check(`mesacap · kpi ${k.key} ask (${sc})`, k.ask); }
  for (const f of mc.focos) { check(`mesacap · foco ${f.key} (${sc})`, f.label); check(`mesacap · foco ${f.key} ask (${sc})`, f.ask); }
  for (const [lista, tag] of [[mc.reponer, "reponer"], [mc.liquidar, "liquidar"]]) {
    check(`mesacap · ${tag} titulo (${sc})`, lista.titulo); check(`mesacap · ${tag} ask (${sc})`, lista.ask);
    // el criterio y la acción del grupo también son superficie (owner 2026-08-08: la acción subió al encabezado)
    check(`mesacap · ${tag} criterio (${sc})`, lista.criterio); check(`mesacap · ${tag} acción (${sc})`, lista.accion);
    for (const it of lista.filas) { check(`mesacap · ${tag} ${it.sku} línea (${sc})`, it.linea); check(`mesacap · ${tag} ${it.sku} ask (${sc})`, it.ask); }
  }
  // el veredicto, los cortes y las limitaciones son texto nuevo de la cara: van al mismo registro
  check(`mesacap · veredicto titular (${sc})`, mc.veredicto.titular);
  check(`mesacap · veredicto soporte (${sc})`, mc.veredicto.soporte);
  if (mc.veredicto.cierre) check(`mesacap · veredicto cierre (${sc})`, mc.veredicto.cierre);
  check(`mesacap · cortes nota (${sc})`, mc.cortes.nota);
  (mc.limitaciones || []).forEach((t, i) => check(`mesacap · limitación ${i} (${sc})`, t));
  for (const s of mc.simulaciones) { check(`mesacap · ysi ${s.key} (${sc})`, s.texto); check(`mesacap · ysi ${s.key} ask (${sc})`, s.ask); }
  check(`mesacap · alertas línea (${sc})`, mc.alertas.linea); check(`mesacap · alertas ask (${sc})`, mc.alertas.ask);
  for (const eje of ["sku", "bodega"]) {
    const ccg = buildCuadroCapital(eje, sc);
    for (const r of (ccg.rows || [])) {
      check(`cuadrocap · ${eje}·${r.name} estado (${sc})`, r.estadoLabel);
      if (r.lectura) check(`cuadrocap · ${eje}·${r.name} lectura (${sc})`, r.lectura);
      if (r.accionAsk) check(`cuadrocap · ${eje}·${r.name} ask (${sc})`, r.accionAsk);
    }
  }
}
// los rótulos y definiciones de los ESTADOS del capital (la voz del "i" y de la columna Estado) — una sola vez
for (const [k, e] of Object.entries(CAPITAL_ESTADOS)) { check(`mesacap · estado ${k} label`, e.label); check(`mesacap · estado ${k} def`, e.def); check(`mesacap · estado ${k} ask`, e.ask); }
// P&L COMERCIAL (owner 2026-07-15) · el flujo guiado, las lecturas y la cara Resultado en registro ejecutivo
setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }]);
for (const a of ["start", "recall", "resultado", "peso", "perdiendo"]) checkResp(`pnl · ${a}`, composePnl({ action: a }, null, { scenario: "bonanza" }));
checkResp("pnl · simulate", composePnl({ action: "simulate_line", nombre: "Logística", pct: 2 }, null, { scenario: "bonanza" }));
checkResp("pnl · entidad", composePnl({ action: "resultado_entidad", entidad: "Falabella" }, null, { scenario: "bonanza" }));
checkResp("pnl · meta", composePnl({ action: "meta_venta", targetK: 18000 }, null, { scenario: "bonanza" }));
// PASE 2 (owner 2026-07-25) · el alcance en registro ejecutivo: scoped · tabla · redirect · deixis · sin cobertura
checkResp("pnl · scoped", composePnl({ action: "resultado_scoped", entidad: "Falabella", eje: "cliente", covered: true }, null, { scenario: "bonanza" }));
checkResp("pnl · scoped familia", composePnl({ action: "resultado_scoped", entidad: "Cuidado Personal", eje: "familia", covered: true }, null, { scenario: "bonanza" }));
checkResp("pnl · sin cobertura", composePnl({ action: "resultado_scoped", entidad: "Makita", eje: "marca", covered: false }, null, { scenario: "bonanza" }));
for (const eje of ["cliente", "familia", "marca"]) checkResp(`pnl · tabla ${eje}`, composePnl({ action: "tabla_eje", eje }, null, { scenario: "bonanza" }));
checkResp("pnl · redirect bodega", composePnl({ action: "tabla_eje", eje: "bodega", pedido: "punto de venta" }, null, { scenario: "bonanza" }));
checkResp("pnl · deixis", composePnl({ action: "resultado_deixis" }, { last: { entityList: { entities: ["Ripley", "La Polar"], dimension: "cliente" } } }, { scenario: "bonanza" }));
checkResp("pnl · sim scoped", composePnl({ action: "simulate_line", nombre: "Logística", pct: 2, entidad: "Falabella", eje: "cliente" }, null, { scenario: "bonanza" }));
checkResp("pnl · meta scoped", composePnl({ action: "meta_venta", targetK: 500, entidad: "Falabella", eje: "cliente" }, null, { scenario: "bonanza" }));
// pase 2b: el rearme guiado (abre draft → se limpia) y la venta proyectada (real vs proyectado)
checkResp("pnl · rearmar", composePnl({ action: "rearmar" }, null, { scenario: "bonanza" }));
resetPnlDraft();
checkResp("pnl · proyección venta", composePnl({ action: "proyeccion_venta", ventaK: 25000, entidad: "Falabella", eje: "cliente" }, null, { scenario: "bonanza" }));
checkResp("pnl · proyección negocio", composePnl({ action: "proyeccion_venta", ventaK: 120000, negocio: true }, null, { scenario: "bonanza" }));
checkResp("pnl · explica simple", pnlExplain({ pnl: true, entidad: "Falabella", entityType: "cliente" }, null, { scenario: "bonanza" }));
checkResp("pnl · decisiones", pnlRecommend({ pnl: true }, null, { scenario: "bonanza" }));
const mrg = buildMesaResultado("bonanza");
check("cara resultado · lectura", mrg.lectura);
for (const r of mrg.cascada) { check(`cara resultado · ${r.key}`, `${r.label}. ${r.def || ""} ${r.nota || ""}`); check(`cara resultado · ${r.key} ask`, r.ask); }
if (mrg.foco) check("cara resultado · foco", mrg.foco.label);
if (mrg.accion) check("cara resultado · accion", `${mrg.accion.titulo}. ${mrg.accion.detalle}`);
for (const s of mrg.simulaciones) { check(`cara resultado · ysi ${s.key}`, s.texto); check(`cara resultado · ysi ${s.key} ask`, s.ask); }
// PASE 2 · la cara con selector de eje + cascada scopeada también en registro ejecutivo
const mrgF = buildMesaResultado("bonanza", "familia", { eje: "familia", nombre: "Cuidado Personal" });
check("cara resultado · lectura scoped", mrgF.lectura);
for (const r of mrgF.cascada) { check(`cara resultado foco · ${r.key}`, `${r.label}. ${r.def || ""} ${r.nota || ""}`); check(`cara resultado foco · ${r.key} ask`, r.ask); }
for (const e of mrgF.cuadro.ejes) check(`cara resultado · selector ${e.key}`, e.label);
clearPnl();
const mre = buildMesaResultado("bonanza");
check("cara resultado · empty", `${mre.empty.titulo}. ${mre.empty.texto} ${mre.empty.cta}`);
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

/* UNA PALABRA DE CÓDIGO NO ES UNA PALABRA DE PANTALLA (owner 2026-08-15, al sumar «vara» al barrido).
 * El barrido estático es un regex sobre el archivo entero, así que no distingue la prosa de un identificador —
 * y la cara Capital tiene `it.vara`, `r.vara` y un `const varas = …` que son ESTADO, no texto: el semáforo de
 * cada fila. Marcarlos sería un rojo falso, y un rojo falso manda a perseguir un fantasma.
 * Se descartan SOLO las cuatro formas que en JavaScript no pueden ser prosa, y cada una está acotada para no
 * tapar un texto de verdad — en particular, «vara:» se perdona únicamente cuando abre una clave de objeto
 * (viene detrás de `{` o `,`), nunca cuando cierra una frase como «fija tu vara: …», que es justo el defecto
 * que este barrido acaba de cazar. */
function esIdentificador(src, m) {
  const antes = src.slice(0, m.index), despues = src.slice(m.index + m[0].length);
  if (antes.endsWith(".")) return true;                                  // it.vara · r.vara
  if (/^\.[A-Za-z_$]/.test(despues)) return true;                        // varas.map · varas.length
  if (/^\s*=[^=]/.test(despues) && /\b(const|let|var)\s+$/.test(antes)) return true;   // const varas = …
  if (/^\s*:/.test(despues) && /[{,]\s*$/.test(antes)) return true;      // { vara: … }
  return false;
}
// GuiaInicio.jsx entra al barrido (owner 2026-08-07): la guía de inicio es de las PRIMERAS palabras que lee un
// usuario nuevo — si el registro se rompe, se rompe en la peor pantalla posible.
for (const f of ["src/ui/SentrixPanel.jsx", "src/ui/ChatADI.jsx", "src/ui/InlineChart.jsx", "src/ui/GuiaInicio.jsx", "src/ui/App.jsx"]) {
  // LA CLAVE INTERNA NO ES SUPERFICIE. El KPI del capital se llama `detenido` por dentro desde antes de que la
  // palabra se prohibiera, y esa llave empareja el módulo con el componente del manifiesto: renombrarla es tocar
  // LÓGICA, no texto, y el owner acotó esta pasada a lo visible (2026-08-15). El rótulo que sí se lee ya dice
  // «Capital inmovilizado» y lo fija `_mesa_capital_gate`. Se exime la línea EXACTA del emparejamiento, nada más.
  const src = stripComments(fs.readFileSync(path.join(root, f), "utf8"))
    .replace(/\["detenido",\s*"capital\/01\/kpi-inmovilizado"\]/g, '["__clave_interna__", "capital/01/kpi-inmovilizado"]');
  let m, re = new RegExp(BANNED.source, "gi"), n = 0;
  while ((m = re.exec(src))) {
    if (esIdentificador(src, m)) continue;
    n++; fail++; rotos.push({ origen: `estático · ${f}`, palabra: m[0], gist: src.slice(Math.max(0, m.index - 50), m.index + 40).replace(/\s+/g, " ") });
  }
  // el MISMO barrido para las formas verbales (owner 2026-08-10): la UI es donde el registro se lee primero.
  // Por `detectVoseo` (una sola lista, ver arriba) y no por un regex propio: se corta el archivo en oraciones para
  // no perder la ubicación del hallazgo, que es lo único que el regex global daba de más.
  for (const frag of src.split(/(?<=[.!?;:>}])\s+|\n+/)) {
    const v = detectVoseo(frag);
    if (v) { n++; fail++; rotos.push({ origen: `estático · ${f} · voseo`, palabra: v, gist: frag.replace(/\s+/g, " ").slice(0, 90) }); }
  }
  if (!n) pass++;
}

// ── (3) RUNTIME · GARANTÍA SOBRE LA NARRACIÓN VIVA (owner 2026-07-26: "apretado" se coló NARRADO en vivo) ──
// Los frentes (1)/(2) lockean el texto DETERMINÍSTICO; faltaba atar la NARRACIÓN del LLM al MISMO set. stripLanguageLeaks
// corre en _narrateResult sobre la voz viva del narrador → toda palabra de BANNED que suelte debe salir NEUTRALIZADA.
// Se prueba contra el MISMO BANNED de este gate (UNA fuente): si mañana se suma una palabra a BANNED, este check la exige
// también sobre el camino LLM. Narración con palabra vetada → 0 BANNED · idempotente · registro correcto queda byte-igual.
const NARRADAS = [
  "El margen de Falabella viene apretado este trimestre.",
  "Las cuentas grandes están apretadas frente al benchmark.",
  "La categoría quedó apretada tras el descuento.",
  "Los precios se ven apretados contra el costo.",
  "El costo viene apretando el margen en Lider.",
  "Conviene apretar la carga comercial de las cuentas top.",
  "El costo aprieta la contribución de Falabella.",
  "Los descuentos aprietan el resultado del mes.",
  "Tienes capital dormido en la bodega de Valparaíso.",
  "Hay mercadería dormida hace más de 90 días.",
  "Varios SKU quedaron dormidos sin rotación.",
  "Quedan referencias dormidas sin salida.",
  "La plata inmovilizada en inventario es alta.",
  "Esa plata se libera rebajando el stock crítico.",
  // VOSEO NARRADO (owner 2026-08-10): el narrador redacta libre y los prompts que lo guían están en voseo, así que
  // lo imita — «Comenzá revisando…» salió en vivo, en la corrida de certificación. Mismo trato que el registro:
  // el prompt pide, `stripLanguageLeaks` garantiza. Se prueba contra el MISMO detector que el resto (una fuente).
  "Si querés, decime qué necesitás y contame lo que buscás.",
  "Comenzá revisando el margen y considerá bajar la carga.",
  "Podés fijar tu benchmark cuando quieras; sos vos quien decide.",
  "Hacé la tabla, poné el filtro y andá al detalle por bodega.",
  "Tenés capital inmovilizado en Valparaíso; mirá el 80/20.",
  "¿Preferís que arme el ranking completo, o seguís con estas dos cuentas?",
];
for (const t of NARRADAS) {
  const out1 = stripLanguageLeaks(t);
  const mb = out1.match(BANNED);
  const m = mb ? mb[0] : detectVoseo(out1);
  if (m) { fail++; rotos.push({ origen: "voiceGuard · narración viva", palabra: m, gist: `«${t}» → «${out1}»` }); }
  else pass++;
  const out2 = stripLanguageLeaks(out1);   // idempotencia: segunda pasada = igual
  if (out2 !== out1) { fail++; rotos.push({ origen: "voiceGuard · idempotencia", palabra: "≠", gist: `«${out1}» → «${out2}»` }); }
  else pass++;
}
// registro ejecutivo YA correcto (incluye las réplicas ajustado/caja) → byte-idéntico (el stripper no lo toca)
// GATE MOVIDO 2026-08-13 (cierre de la cert amplia, hallazgo 4a) — ANÁLISIS GARANTÍA-VS-FORMATO: la muestra
// «capital detenido» era FORMATO con el registro viejo — CLAUDE.md §4 fija «inmovilizado», y el barrido nuevo del
// bigrama la reescribe (correcto). La muestra limpia pasa a la forma en registro; el verbo sobre un SKU («se
// detuvo», legítimo por H3 de la certificación) entra como muestra limpia nueva para fijar que NO se toca.
const LIMPIAS = [
  "El margen ajustado obliga a actuar sobre el precio realizado.",
  "El capital inmovilizado en Valparaíso se libera con una rebaja puntual.",
  "El SKU se detuvo hace 94 días y sigue detenido en góndola.",
  "La caja inmovilizada suma un monto relevante en inventario.",
  "Falabella cede margen por carga comercial alta; conviene revisar cuenta por cuenta.",
  // TUTEO YA CORRECTO → el barrido de voseo no lo toca. Incluye las trampas reales: el futuro de tuteo termina
  // en -ás igual que el presente voseante («verás», «podrás»), y hay terceras personas que son homógrafas de un
  // imperativo voseante sin tilde («el motor hace», «pone», «la entrega»). Ninguna puede reescribirse.
  "Verás que podrás recuperar el margen; además jamás estuvo tan atrás del benchmark.",
  "El motor hace la tabla y pone el filtro; la entrega del informe llega hoy.",
  "Considera el margen: la suma baja y el arma comercial es el precio. Estás bajo tu benchmark.",
  "Si quieres, dime qué necesitas y cuéntame lo que buscas.",
];
for (const t of LIMPIAS) {
  const out1 = stripLanguageLeaks(t);
  if (out1 !== t) { fail++; rotos.push({ origen: "voiceGuard · limpio alterado", palabra: "≠", gist: `«${t}» → «${out1}»` }); }
  else pass++;
}

// LA EXENCIÓN DEL LEGADO NO PUEDE CRECER NI QUEDAR HUÉRFANA. Si el texto declarado ya no se emite (porque se
// migró el seam), este check avisa que la entrada se puede borrar; si alguien agrega otro voseo al camino legado,
// no entra por esta puerta — no está en la lista y cae como cualquier otro.
if (legadoVistos === 0) {
  fail++;
  rotos.push({ origen: "exención del legado", palabra: "huérfana",
    gist: `LEGADO_VOSEO_DECLARADO tiene ${LEGADO_VOSEO_DECLARADO.length} entrada(s) y ninguna se emitió: si el seam legado ya se migró, borrá la lista` });
} else pass++;

// mismo contador que el resto del gate: un lavado que falla es «registro viejo emitido», no una categoría aparte
const okv = (c, m, dado) => { if (c) { pass++; console.log(`  ✓ ${m}`); } else { fail++; rotos.push({ origen: "lavador de voseo", palabra: m, gist: String(dado || "") }); console.log(`  ✗ ${m}`); } };
console.log("\n── LAS CINCO POSICIONES DE ORDEN, no solo la que probaba el gate ──");
/* «resolvé» LLEGÓ A PANTALLA (Examen 5, re-medición del resumen ejecutivo, 2026-08-21): «Antes de tocar precios
 * […], RESOLVÉ qué hacer con estos dos SKU». El verbo ESTABA cubierto —es uno de los diez gateados a posición de
 * orden— pero la POSICIÓN no: un candado de afuera (`(?<![\p{L}])`) exigía que el carácter anterior a toda la
 * apertura no fuera letra, y en una oración real la puntuación va PEGADA a la palabra de antes. Sobrevivían solo
 * el arranque del texto y los cinco conectores enumerados — justo la forma que el gate ejercitaba, y por eso
 * pasaba en verde mientras los diez quedaban sin lavar en la prosa de verdad. Se prueban LAS CINCO. */
for (const [donde, texto, esperado] of [
  ["arranque del texto",  "Resolvé el margen de venta.",                       "Resuelve el margen de venta."],
  ["conector",            "Primero resolvé el margen de venta.",               "Primero resuelve el margen de venta."],
  ["tras punto",          "El caso es claro. Resolvé el margen de venta.",     "El caso es claro. Resuelve el margen de venta."],
  ["tras punto y coma",   "El caso es claro; resolvé el margen de venta.",     "El caso es claro; resuelve el margen de venta."],
  ["tras COMA (el real)", "Antes de tocar precios, resolvé el margen de venta.", "Antes de tocar precios, resuelve el margen de venta."],
]) okv(stripLanguageLeaks(texto) === esperado, `posición «${donde}»: el voseo se lava y la mayúscula se respeta`, stripLanguageLeaks(texto));
/* Y NO SE AFLOJÓ NADA MÁS. La coma entró a las POSICIONES, no a los verbos: los diez siguen exigiendo contexto de
 * orden, y `_NO_ES_PASADO` los sigue frenando ante una marca de pasado o un sujeto de primera persona — que es
 * donde chocarían con el pretérito y romperían una oración correcta. */
for (const sano of ["Yo resolví eso ayer.", "El motor resuelve la cuenta sola.", "Ayer, vendé las unidades que quedaban.", "Con eso resolvé el margen."])
  okv(stripLanguageLeaks(sano) === sano, `no toca prosa correcta: «${sano}»`, stripLanguageLeaks(sano));

/* ═══ LA ESCOBA POR PATRÓN · toda superficie que compone texto, barrida sin lista (owner 2026-09-04) ═════════
 * EL DEFECTO QUE LO PIDE: `rolesCartera` nació el 2026-09-04 diciendo «bajo la vara» en tres de sus campos y en
 * su prosa, y NINGÚN gate ardió — porque este barría una LISTA ENUMERADA de módulos y el nuevo no estaba en
 * ella. Es la clase de siempre: la escoba que hay que acordarse de extender no barre lo que nace mañana.
 * AHORA SE BARRE POR RUTA: todo `.js` bajo las superficies que componen texto de usuario (las caras de Sentrix
 * y los entregables de los playbooks). Un módulo nuevo ahí nace barrido, sin tocar este gate.
 *
 * QUÉ QUEDA FUERA, DECLARADO POR CONCEPTO (no por archivo — una excepción por archivo se pudre igual que la
 * lista): (1) los literales que son REGEX DE DETECCIÓN, donde la palabra está para ENTENDER al usuario que la
 * escribe («cuánta plata tengo dormida»), que es lo contrario de emitirla; (2) los SELECTORES y rutas internas,
 * que no son prosa; (3) los prompts al MODELO, que viven fuera de estas rutas y ya tienen su propio lavado
 * (stripLanguageLeaks) más el barrido runtime de arriba. */
{
  const RAICES_SUPERFICIE = ["src/adi/sentrix", "src/adi/agente/playbooks"];
  const _arch = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const q = path.join(dir, e.name);
      if (e.isDirectory()) _arch(q, out);
      else if (/\.jsx?$/.test(e.name) && !/\.carnada/.test(e.name)) out.push(q);
    }
    return out;
  };
  const _sinComentarios = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => {
    const i = l.indexOf("//");
    if (i < 0) return l;
    const antes = l.slice(0, i);
    return (antes.match(/["'`]/g) || []).length % 2 === 0 ? antes : l;
  }).join("\n");
  /* (3ª exención por concepto) LOS ALIAS DE ENTRADA DEL GLOSARIO no son prosa emitida: son la lista de cómo el
   * usuario PUEDE nombrar un concepto, para reconocerlo cuando lo escribe. Lo resolvió el owner el 2026-08-15
   * sobre esta misma palabra: «vara» queda como alias de entrada y desaparece de todo lo visible. Se recortan
   * los arrays `etiquetas: [...]` antes de mirar los literales — entender no es emitir, igual que un regex. */
  const _sinAliasDeEntrada = (src) => src.replace(/etiquetas\s*:\s*\[[^\]]*\]/g, "etiquetas: []");
  const _literales = (src) => _sinAliasDeEntrada(src).match(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g) || [];
  const ES_REGEX = (l) => /\\b|\\s|\(\?:|\$\{_FIN\}|\[[a-záéíóú]/.test(l);
  const ES_SELECTOR = (l) => /\[key=|kpis\[|\.js|\//.test(l);
  /* (4ª y 5ª exención, del mismo espíritu) LO QUE HAY DENTRO DE `${…}` ES CÓDIGO, no prosa: `${gapVara}` es un
   * nombre de variable y la línea que lo usa dice «pp bajo tu benchmark», que es registro correcto. Y un
   * literal de UNA SOLA PALABRA sin espacios es un identificador (una clave de estado como "detenido"), no una
   * oración: la prosa ejecutiva de este producto nunca es una palabra suelta. */
  const _sinInterpolaciones = (l) => l.replace(/\$\{[^}]*\}/g, "·");
  const ES_IDENTIFICADOR = (l) => !/\s/.test(l.slice(1, -1).trim());
  let barridos = 0; const sucios = [];
  for (const raiz of RAICES_SUPERFICIE) {
    for (const f of _arch(path.join(root, raiz))) {
      barridos++;
      for (const lit of _literales(_sinComentarios(fs.readFileSync(f, "utf8")))) {
        const limpio = _sinInterpolaciones(lit);
        if (!BANNED.test(limpio) || ES_REGEX(limpio) || ES_SELECTOR(limpio) || ES_IDENTIFICADOR(limpio)) continue;
        sucios.push(`${path.relative(root, f).replace(/\\/g, "/")}: ${lit.slice(0, 80)}`);
      }
    }
  }
  okv(barridos >= 15, `la escoba por patrón barre ${barridos} módulos de superficie — por ruta, sin lista que actualizar`);
  okv(sucios.length === 0, "★ ninguna superficie emite registro viejo, y una superficie NUEVA nace barrida", sucios.slice(0, 6).join(" | "));
  /* ── LOS SELLOS, EN VOZ DE NEGOCIO (owner 2026-09-05) ────────────────────────────────────────────────────
   * Vio «PROBADO/ABIERTO/INDICADO» en mayúsculas y los leyó como lo que son: etiquetas de nuestro vocabulario.
   * El SELLO se queda (regla 1, la proporcionalidad se declara siempre); la ETIQUETA no sale a pantalla — se
   * dice en la lengua del negocio («esto está medido» · «el patrón apunta ahí, sin prueba todavía» · «el dato
   * no lo prueba, queda abierto»). La doctrina interna los sigue nombrando: es vocabulario nuestro. */
  {
    /* se caza la ETIQUETA, no la palabra: el glosario explica los tres sellos como CONCEPTOS y eso es
     * legítimo (ahí se está definiendo el vocabulario, no rotulando una línea al gerente). La forma que el
     * owner rechazó es la de rótulo — «· ABIERTO:» / «— PROBADO:» pegado a la afirmación. */
    const SELLO_EN_CAPS = /[·—–-]\s*(?:PROBADO|INDICADO|ABIERTO)\s*[:·]/;
    const sellosSueltos = [];
    for (const raiz of RAICES_SUPERFICIE) {
      for (const f of _arch(path.join(root, raiz))) {
        for (const lit of _literales(_sinComentarios(fs.readFileSync(f, "utf8")))) {
          if (SELLO_EN_CAPS.test(_sinInterpolaciones(lit))) sellosSueltos.push(`${path.relative(root, f).replace(/\\/g, "/")}: ${lit.slice(0, 70)}`);
        }
      }
    }
    okv(sellosSueltos.length === 0,
      "★ ningún composer emite el sello en MAYÚSCULAS: el sello se dice, la etiqueta se queda adentro",
      sellosSueltos.slice(0, 4).join(" | "));
    okv(SELLO_EN_CAPS.test("- mix · ABIERTO: el dato no cruza cliente con familia"),
      "★ carnada: la forma vieja del sello la caza este chequeo — si vuelve a pantalla, arde");
  }

  /* CARNADA · el texto con que nació `rolesCartera`: la escoba tiene que verlo. */
  const carnada = 'const REGLAS = [{ titulo: "sobre la vara", regla: "margen bajo la vara" }];';
  const cazada = _literales(carnada).some((l) => BANNED.test(l) && !ES_REGEX(l) && !ES_SELECTOR(l));
  okv(cazada, "★ carnada: «sobre la vara» —el texto con que nació rolesCartera— lo caza la escoba: si mañana nace otra superficie así, arde");
}

console.log(`── _registro_gate: ${pass} textos limpios · ${fail} con registro viejo ──`);
if (legadoVistos) console.log(`   · ${legadoVistos} emisión(es) del residual de voseo DECLARADO del camino legado (contractCloser, migra con answerADIFromSpec)`);

if (rotos.length) { console.log("✗ REGISTRO VIEJO EMITIDO:"); rotos.forEach((r) => console.log(`   [${r.origen}] «${r.palabra}» …${r.gist}…`)); }
process.exit(fail ? 1 : 0);
