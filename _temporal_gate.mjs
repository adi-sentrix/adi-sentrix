/* === _temporal_gate.mjs · GATE DE TIEMPO/TRAYECTORIA (mejora 7 · owner 2026-07-25/26) ===
 * "Dame las ventas por mes y por clientes en una tabla… espero que ADI diga la historia y al ver en Sentrix esté
 * todo como debe estar" + "cuando alguien pida el mes a mes, o el primer Q o lo que sea, debe estar disponible".
 * Lockea, determinístico y sin key:
 *   [1] PERIODO · el parse español (mes a mes · Q1-Q4/primer Q · semestres · rangos · un mes · sin señal → null)
 *   [2] UNA VERDAD CON SENTRIX · el mes a mes cita LA MISMA serie del evolutivo (totales == KPI/dato del período)
 *   [3] PERIODOS AGREGADOS · Q1 = Σ de sus 3 meses, exacto (jamás prorrateo)
 *   [4] LA MATRIZ · meses × clientes (top + Resto + Total exactos · entityList para el «de esos…»)
 *   [5] LÍMITES DECLARADOS · resultado anual · inventario foto de hoy · canal sin mes — declaran y redirigen
 *   [6] PROTECCIONES · simulate/P&L/lecturas sin periodo intactos · chips del espejo reclaman · guard == boleta
 *   [7] REGISTRO ejecutivo + despacho a la UI (tabla_matriz) */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, `_tge.tmp${process.pid}.js`), out = path.join(root, `_tgb.tmp${process.pid}.mjs`);
fs.writeFileSync(entry, [
  'export { detectPeriodo, composeSpecTemporal } from "./src/adi/composers/temporalTable.js";',
  'export { coerceFloor, coerceSpec } from "./src/adi/coerceChain.js";',
  'export { answerConversational } from "./src/adi/conversation.js";',
  'export { chartForEvidence } from "./src/adi/sentrix/chartSpec.js";',
  'export { buildGlobalEvolution, buildEntityEvolutionComparado } from "./src/adi/sentrix/temporal.js";',
  'export { guardAgainstBoleta } from "./src/adi/boleta.js";',
  'export { setPnlLines, clearPnl, resetPnlDraft } from "./src/adi/pnl.js";',
  'export { clientesVentas } from "./src/data/demoData.js";',
  'export { ventasKPI } from "./src/data/baseKpis.js";',
  'export { buildSpecTool } from "./src/adi/llm/specTool.js";',
  'export { buildContractMenu } from "./src/adi/llm/contractMenu.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }
const { detectPeriodo: DP, coerceFloor: CF, answerConversational: AC, chartForEvidence: CH, buildGlobalEvolution, buildEntityEvolutionComparado, guardAgainstBoleta, clearPnl, resetPnlDraft, clientesVentas, ventasKPI } = M;

let pass = 0, fail = 0;
const ok = (cond, label, detail = "") => { if (cond) { pass++; console.log(`  ✓ ${label}`); } else { fail++; console.log(`  ✗ ${label}${detail ? " — " + detail : ""}`); } };
const go = (q) => { const s = CF(q, false, null); return s ? AC(s, {}, { scenario: "bonanza" }) : null; };
const _money = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };
const _mK = (vK) => _money(vK * 1000);
const BANNED = /\b(plata|dormid[oa]s?|guita|palancas?|vara)\b/i;
clearPnl(); resetPnlDraft();

console.log("[1] PERIODO · el parse español");
for (const [q, esp] of [
  ["ventas mes a mes", "mes_a_mes"], ["dame las ventas por mes", "mes_a_mes"], ["ventas mensuales", "mes_a_mes"],
  ["ventas del primer trimestre", "0-2"], ["el Q2", "3-5"], ["ventas del primer Q", "0-2"], ["trimestre 3", "6-8"],
  ["primer semestre", "0-5"], ["segundo semestre", "6-11"], ["de enero a marzo", "0-2"], ["entre abril y junio", "3-5"],
  ["ventas de marzo", "2-2"], ["¿cómo está Falabella?", null], ["margen por cliente", null], ["dame el margen", null],
]) {
  const p = DP(q);
  const got = !p ? null : p.tipo === "mes_a_mes" ? "mes_a_mes" : `${p.desde}-${p.hasta}`;
  ok(got === esp, `«${q}» → ${esp === null ? "sin periodo" : esp}`, `got ${got}`);
}

console.log("[2] UNA VERDAD CON SENTRIX · global mes a mes == el evolutivo");
const g = buildGlobalEvolution();
const r1 = go("¿cómo vienen las ventas mes a mes?");
ok(r1 && r1.route === "qi_retrieval" && r1.text.includes(_mK(g.totAct)), "la venta del año cita el total del evolutivo/KPI", r1 && r1.text.slice(0, 80));
ok(r1 && r1.text.includes(`Mejor mes: ${g.maxMes}`) && r1.text.includes(`Mes más bajo: ${g.minMes}`), "mejor/peor mes == el análisis del evolutivo");
const c1 = r1 && CH(r1.evidence);
ok(c1 && c1.tipo === "tabla_matriz" && c1.tabla.cols.join("|") === "Este año|Año anterior|Presupuesto" && c1.tabla.rows.length === 13, "tabla_matriz: 12 meses + Total · tres columnas del dato real");
ok(c1 && c1.tabla.rows[0].values[0] === _mK(g.actual[0]) && c1.tabla.rows[11].values[0] === _mK(g.actual[11]), "cada fila == la serie del evolutivo (byte-igual)");
ok(r1 && guardAgainstBoleta(r1.text, r1.evidence.boleta).ok, "guard global: cifras == boleta");
ok(Number(ventasKPI.totalActual) === g.totAct, "el ancla del evolutivo sigue siendo el KPI (una verdad)");

console.log("[3] PERIODOS AGREGADOS · Q1 exacto (Σ de sus meses)");
const r2 = go("¿cómo vino la venta del primer trimestre?");
const q1 = g.actual.slice(0, 3).reduce((a, b) => a + b, 0);
ok(r2 && r2.text.includes(_mK(q1)), "Q1 == Ene+Feb+Mar de la misma serie, exacto", r2 && r2.text.slice(0, 70));
const c2 = r2 && CH(r2.evidence);
ok(c2 && c2.tipo === "tabla_matriz" && c2.tabla.rows.length === 4, "la tabla del Q1: sus 3 meses + Total");
ok(r2 && guardAgainstBoleta(r2.text, r2.evidence.boleta).ok, "guard Q1: cifras == boleta");

console.log("[4] LA MATRIZ · meses × clientes (el pedido verbatim del owner)");
const r3 = go("dame las ventas por mes y por clientes en una tabla");
const c3 = r3 && CH(r3.evidence);
ok(c3 && c3.tipo === "tabla_matriz" && c3.tabla.cols.length === 6 && c3.tabla.cols[5] === "Total" && c3.tabla.cols[4] === "Resto", "matriz: top 4 clientes + Resto + Total");
const filaT = c3 && c3.tabla.rows[c3.tabla.rows.length - 1];
const fal = clientesVentas.find((x) => x.nombre === "Falabella");
ok(filaT && filaT.strong && filaT.values[0] === _mK(fal.actual), "el Total de Falabella == clientesVentas.actual (ancla del período)");
const totNeg = clientesVentas.reduce((a, x) => a + x.actual, 0);
ok(filaT && filaT.values[5] === _mK(totNeg), "el Total del negocio == Σ clientes, exacto (jamás prorrateo)");
ok(r3 && r3.evidence.entityList && r3.evidence.entityList.entities.length === 4 && r3.evidence.entityList.dimension === "cliente", "entityList: el «de esos…» siguiente hereda los top");
ok(r3 && guardAgainstBoleta(r3.text, r3.evidence.boleta).ok, "guard matriz: cifras == boleta");
const r4 = go("ventas de Falabella mes a mes");
const eF = buildEntityEvolutionComparado("Falabella", "venta");
ok(r4 && /Falabella/.test(r4.text) && r4.text.includes(_mK(eF.serie.reduce((a, b) => a + b, 0))), "una entidad: la serie anclada de la Ficha (total == dato del período)");
const c4 = r4 && CH(r4.evidence);
ok(c4 && c4.tabla.cols.join("|") === "Este año|Año anterior", "entidad con año anterior declarado → dos columnas");

console.log("[5] LÍMITES DECLARADOS · responder donde alcanza, declarar donde no");
const r5 = go("¿cómo viene el resultado mes a mes?");
ok(r5 && r5.route === "temporal_declarado" && /porcentajes sobre la venta anual/.test(r5.text) && /Mes a mes sí tengo la venta/.test(r5.text), "resultado mensual → límite declarado + dónde SÍ", r5 && `[${r5.route}]`);
ok(r5 && r5.evidence && r5.evidence.followup === true, "la declaración es administrativa (no pisa la lectura)");
const r6 = go("ventas por mes y por canal");
ok(r6 && r6.route === "temporal_declarado" && /por canal no está desglosado/.test(r6.text), "canal mensual → declarado + redirección");
const r7 = go("capital mes a mes");
ok(r7 && r7.route === "temporal_declarado" && /foto de hoy/.test(r7.text), "inventario mensual → declarado (foto de hoy)");

console.log("[6] PROTECCIONES · nadie roba · el espejo reclama");
ok((CF("¿qué pasa si las ventas suben 3% cada mes?", false, null) || {}).operation === "simulate", "el «cada mes» de un ¿qué pasa si…? NO roba el simulate");
ok((CF("¿cuánto me queda después de gastos?", false, null) || {}).turn_type === "pnl_setup", "el P&L conserva su dominio (sin periodo)");
ok((CF("margen por cliente", false, null) || {}).operation !== "temporal", "una lectura sin periodo NO es temporal");
for (const r of [r1, r2, r3, r4, r5, r6, r7]) for (const s of ((r && r.suggestions) || [])) {
  const sc = CF(s, false, null);
  ok(!!sc, `chip del espejo reclama: «${s}»`);
}

console.log("[7b] CIERRE DE LA DIRECTIVA · enseñanza LLM + deep-link a la Mesa");
const _tool = M.buildSpecTool();
ok(_tool.schema.properties.operation.enum.includes("temporal"), "specTool: el LLM #1 puede emitir operation temporal (fraseos libres sin la red)");
ok(/temporal.*mes a mes|MES A MES/i.test(M.buildContractMenu()), "contractMenu enseña la operación temporal con sus formas y límites");
ok(r1 && r1.evidence.lens === "temporal" && r3 && r3.evidence.lens === "temporal", "la evidencia temporal declara su lens (SentrixPanel la despacha a LA MESA — la película del año)");

console.log("[7] REGISTRO ejecutivo en todo lo emitido");
let sucios = 0;
for (const r of [r1, r2, r3, r4, r5, r6, r7]) if (r && BANNED.test(r.text)) { sucios++; console.log(`    ✗ «${r.text.match(BANNED)[0]}»`); }
for (const c of [c1, c2, c3, c4]) if (c) for (const s of [c.tabla.titulo, c.tabla.nota, ...c.tabla.cols]) if (typeof s === "string" && BANNED.test(s)) { sucios++; console.log(`    ✗ tabla: «${s.match(BANNED)[0]}»`); }
ok(sucios === 0, "0 palabras del registro viejo (plata/dormido/guita/palanca/vara)");

console.log(`\n── _temporal_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
