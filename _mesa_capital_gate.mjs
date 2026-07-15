/* === _mesa_capital_gate.mjs · GATE DE LA CARA CAPITAL (owner 2026-07-15 "ok, veamos cómo queda") ===
 * La segunda cara de la Mesa cuenta EL MISMO dato del motor — este gate lo verifica contra un ORÁCULO independiente
 * (diagnoseInventario + el detector de capital del diagnose) por los 3 escenarios:
 *   (1) el MAPA suma EXACTO: tramos == total del motor == total del cuadro (sku y bodega) — ni un peso fabricado;
 *   (2) "En juego $" == el subtotal del detector de capital del diagnose (una verdad con la Mesa/cuadro comercial);
 *   (3) REPONER ⊆ riesgo_quiebre del motor · LIQUIDAR ⊆ capital_frenado (las listas no inventan candidatos);
 *   (4) anti-BI: todo tramo/KPI/foco/línea/chip lleva su pregunta (no hay elemento mudo);
 *   (5) honestidad: "Qué cambió" NO existe (sin historial de stock no se fabrica) · microlectura SOLO con señal;
 *   (6) lenguaje FORMAL en superficie: "vara" no se emite (benchmark) · registro ejecutivo limpio;
 *   (7) la pata de inventario del "En alerta" cuenta los MISMOS críticos del dato.
 * Corre sin key (determinístico) · La cara comercial NO se toca acá (sus gates ya la cubren). */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_mcge.js"), out = path.join(root, "_mcgb.mjs");
fs.writeFileSync(entry, [
  'export { buildMesaCapital, buildCuadroCapital, CAPITAL_ESTADOS } from "./src/adi/sentrix/mesaCapital.js";',
  'export { diagnoseInventario } from "./src/adi/diagnosis/economicDiagnosis.js";',
  'export { applyScenarioToSkuInventario } from "./src/engine/scenarios.js";',
  'export { composeSpecDiagnose } from "./src/adi/specRetrieval.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }
const { buildMesaCapital, buildCuadroCapital, CAPITAL_ESTADOS, diagnoseInventario, applyScenarioToSkuInventario, composeSpecDiagnose } = M;

let pass = 0, fail = 0; const rotos = [];
const ok = (cond, tag, detail) => { if (cond) pass++; else { fail++; rotos.push({ tag, detail: detail || "" }); } };
const INFORMAL = /\b(vara|plata|dormid[oa]s?|guita|palancas?|flojo)\b/i;   // formal en superficie (benchmark, no vara — adi-lenguaje-formal)

for (const sc of ["bonanza", "tension", "crisis"]) {
  const mc = buildMesaCapital(sc);
  const inv = applyScenarioToSkuInventario(sc) || [];
  const D = diagnoseInventario(inv, {});   // el ORÁCULO: el mismo motor, llamado aparte

  // (1) el mapa suma EXACTO el total del motor · los tramos no fabrican ni pierden un peso
  const sumTramos = mc.mapa.tramos.reduce((a, t) => a + t.usd, 0);
  ok(sumTramos === D.total && mc.mapa.totalUsd === D.total, `mapa-suma@${sc}`, `tramos ${sumTramos} vs motor ${D.total}`);
  for (const t of mc.mapa.tramos) {
    const d = D.dist[t.key];
    ok(!!d && d.usd === t.usd && d.count === t.n, `tramo-${t.key}@${sc}`, `usd ${t.usd} vs ${d && d.usd} · n ${t.n} vs ${d && d.count}`);
  }
  const cSku = buildCuadroCapital("sku", sc), cBod = buildCuadroCapital("bodega", sc);
  ok(cSku.total.capital === D.total && cBod.total.capital === D.total, `cuadro-total@${sc}`, `sku ${cSku.total.capital} · bodega ${cBod.total.capital} vs motor ${D.total}`);

  // (2) "En juego $" == el subtotal del detector de capital del diagnose (una verdad)
  const diag = composeSpecDiagnose({ filters: {}, scenario: sc });
  const capF = diag && diag.evidence && diag.evidence.findings ? diag.evidence.findings.find((f) => f.detector === "capital") : null;
  const detSubtotal = capF ? capF.subtotal_usd : 0;
  const ejSku = cSku.rows.reduce((a, r) => a + (r.enJuego || 0), 0);
  const ejBod = cBod.rows.reduce((a, r) => a + (r.enJuego || 0), 0);
  ok(ejSku === detSubtotal && ejBod === detSubtotal, `enjuego@${sc}`, `sku ${ejSku} · bodega ${ejBod} vs detector ${detSubtotal}`);
  const frenadoTramo = mc.mapa.tramos.find((t) => t.key === "capital_frenado");
  ok((frenadoTramo ? frenadoTramo.usd : 0) === detSubtotal, `detenido-una-verdad@${sc}`, `tramo ${frenadoTramo && frenadoTramo.usd} vs detector ${detSubtotal}`);

  // (3) las listas no inventan candidatos: reponer ⊆ riesgo_quiebre · liquidar ⊆ capital_frenado (del motor)
  const estadoDe = {}; for (const s of D.perSku) estadoDe[s.sku] = s.estado;
  for (const it of mc.reponer.items) ok(estadoDe[it.sku] === "riesgo_quiebre", `reponer-${it.sku}@${sc}`, `estado ${estadoDe[it.sku]}`);
  for (const it of mc.liquidar.items) ok(estadoDe[it.sku] === "capital_frenado", `liquidar-${it.sku}@${sc}`, `estado ${estadoDe[it.sku]}`);

  // (4) anti-BI: nada mudo — todo lo ofrecido lleva su pregunta
  for (const t of mc.mapa.tramos) ok(typeof t.ask === "string" && t.ask.trim().length > 0, `ask-tramo-${t.key}@${sc}`);
  for (const k of mc.kpis) ok(typeof k.ask === "string" && k.ask.trim().length > 0, `ask-kpi-${k.key}@${sc}`);
  for (const f of mc.focos) ok(typeof f.ask === "string" && f.ask.trim().length > 0, `ask-foco-${f.key}@${sc}`);
  for (const [lista, tag] of [[mc.reponer, "reponer"], [mc.liquidar, "liquidar"]]) {
    if (lista.items.length) ok(typeof lista.ask === "string" && lista.ask.trim().length > 0, `ask-${tag}@${sc}`);
    for (const it of lista.items) ok(typeof it.ask === "string" && it.ask.trim().length > 0, `ask-${tag}-${it.sku}@${sc}`);
  }
  for (const s of mc.simulaciones) ok(typeof s.ask === "string" && s.ask.trim().length > 0, `ask-ysi-${s.key}@${sc}`);
  for (const r of [...cSku.rows, ...cBod.rows]) ok(typeof r.accionAsk === "string" && r.accionAsk.trim().length > 0, `ask-chip-${r.name}@${sc}`);

  // (5) honestidad: sin historial de stock NO hay "qué cambió" · microlectura SOLO con señal (alert)
  ok(mc.cambios === undefined, `sin-que-cambio@${sc}`, "la cara no fabrica movimiento sin historial de stock");
  for (const r of cSku.rows) ok(!r.lectura || r.alert, `microlectura-${r.name}@${sc}`, "lectura sin señal del detector");

  // (6) lenguaje formal + registro ejecutivo en TODO texto emitido por la cara
  const textos = [
    mc.mapa.lectura,
    ...mc.mapa.tramos.map((t) => `${t.label} ${t.ask}`),
    ...mc.kpis.map((k) => `${k.label} ${k.linea} ${k.ask}`),
    ...mc.focos.map((f) => `${f.label} ${f.ask}`),
    ...mc.reponer.items.map((i) => i.linea), ...mc.liquidar.items.map((i) => i.linea),
    ...mc.simulaciones.map((s) => s.texto),
    mc.alertas.linea,
    ...cSku.rows.map((r) => `${r.estadoLabel} ${r.lectura || ""} ${r.accion}`),
    ...cBod.rows.map((r) => `${r.estadoLabel} ${r.lectura || ""} ${r.accion}`),
  ];
  for (const t of textos) {
    const m = String(t || "").match(INFORMAL);
    ok(!m, `registro@${sc}`, m ? `«${m[0]}» en «${String(t).slice(0, 70)}»` : "");
  }

  // (7) la pata de inventario del "En alerta" cuenta los MISMOS críticos del dato (frenado + alerta crit)
  const critOracle = D.perSku.filter((s) => s.estado === "capital_frenado").filter((s) => { const r = inv.find((x) => x.sku === s.sku); return r && r.alerta === "crit"; }).length;
  ok(mc.alertas.n === critOracle, `alertas-criticos@${sc}`, `pata ${mc.alertas.n} vs dato ${critOracle}`);
  ok(mc.alertas.usd === detSubtotal, `alertas-usd@${sc}`, `pata ${mc.alertas.usd} vs detector ${detSubtotal}`);
}

// los rótulos/definiciones de los estados también van formales (una sola vez — no dependen del escenario)
for (const [k, e] of Object.entries(CAPITAL_ESTADOS)) {
  const m = `${e.label} ${e.def} ${e.ask}`.match(INFORMAL);
  ok(!m, `registro-estado-${k}`, m ? `«${m[0]}»` : "");
}

console.log(`── _mesa_capital_gate: ${pass} verificaciones · ${fail} rotas ──`);
if (rotos.length) { console.log("✗ ROTAS:"); rotos.forEach((r) => console.log(`   [${r.tag}] ${r.detail}`)); }
process.exit(fail ? 1 : 0);
