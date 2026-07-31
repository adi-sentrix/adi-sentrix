/* === _pnl_gate.mjs · GATE DEL P&L COMERCIAL (owner 2026-07-15: "sí, parte por p&l") ===
 * Lockea el territorio nuevo completo, determinístico y sin key:
 *   [1] FLUJO GUIADO multi-turno por la cadena REAL (coerceFloor → answerConversational · la forma del piso)
 *   [2] LA CASCADA CIERRA EXACTO (ingreso − costo − carga − Σgastos == resultado · Σ entidades == total ·
 *       margen bruto == contribución + carga) — en los 3 escenarios
 *   [3] COHERENCIA card == apertura (la cara Resultado y las lecturas de composePnl cuentan LO MISMO, byte-igual)
 *   [4] GUARDS · toda lectura self-consistente con su boleta (ninguna cifra fuera de boleta)
 *   [5] EDICIÓN conversacional (cambiar/sacar/agregar · rango inválido honesto · una verdad)
 *   [6] CORDURA HONESTA · resultado negativo se DECLARA antes de sellar (y se puede sellar igual — nunca bloquea)
 *   [7] EMPTY STATE · sin P&L la cara lo dice y el prefill del CTA reclama el flujo
 *   [8] PROMESAS PROPIAS · toda ask/sugerencia que el P&L emite responde por la cadena (0 rotas)
 *   [9] REGISTRO ejecutivo en todo texto emitido (plata/dormido/guita/palanca/vara prohibidos)
 *  [10] PROTECCIONES · el claim no roba turnos ajenos · "olvidá todo" (criteria) también limpia el P&L
 *  [29] F4 · LA VOZ DEL P&L: las LECTURAS declaran kind "pnl" (narrables · el det queda como PISO con sus 3
 *       movimientos) · las ADMINISTRATIVAS del flujo siguen verbatim kind "criteria" · la boleta autoriza el
 *       universo completo (texto + tabla) · guard-reject → cae al piso byte-igual · directiva del narrador */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_plge.js"), out = path.join(root, "_plgb.mjs");
fs.writeFileSync(entry, [
  'export { answerConversational, updateMemoria } from "./src/adi/conversation.js";',
  'export { coerceFloor, coerceSpec } from "./src/adi/coerceChain.js";',
  'export { buildPnlCascade, activePnl, setPnlLines, clearPnl, resetPnlDraft, pnlDraft, detectPnlIntent, composePnl, pnlSimAsk, pnlDisponibilidad, pnlEjesDisponibles, detectPnlEllipsis, pnlScope, editPnlLine, removePnlLine, addPnlLine, pnlExplain, pnlRecommend, ensurePnlNarration } from "./src/adi/pnl.js";',
  'export { buildMesaResultado, pnlMesaLink, pnlExportData } from "./src/adi/sentrix/mesaResultado.js";',
  'export { guardAgainstBoleta } from "./src/adi/boleta.js";',
  'export { composeSpecDiagnose } from "./src/adi/specRetrieval.js";',
  'export { METRICS } from "./src/config/contract/metricRegistry.js";',
  'export { ENTITIES } from "./src/config/contract/entityRegistry.js";',
  'export { buildDisponibleMenu } from "./src/adi/llm/capabilities.js";',
  'export { chartForEvidence } from "./src/adi/sentrix/chartSpec.js";',
  'export { shouldNarrate, pickNarratedText } from "./src/adi/llm/numberGuard.js";',
  'export { buildNarrateSystem } from "./src/adi/llm/narratePrompt.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }
const { answerConversational: AC, coerceFloor: CF, coerceSpec: CS, buildPnlCascade, activePnl, setPnlLines, clearPnl, resetPnlDraft, pnlDraft, composePnl, pnlSimAsk, buildMesaResultado, guardAgainstBoleta } = M;

let pass = 0, fail = 0;
const ok = (cond, label, detail = "") => { if (cond) { pass++; console.log(`  ✓ ${label}`); } else { fail++; console.log(`  ✗ ${label}${detail ? " — " + detail : ""}`); } };
const S = (o) => ({ schemaVersion: 1, scenario: "actual", operation: "clarification_needed", metric: null, dimension: null, ...o });
const go = (q, hasLast = true) => { const s = CF(q, hasLast, null); return s ? AC(s, {}, { scenario: "bonanza" }) : null; };
const _money = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };
const _moneyK = (vK) => _money(vK * 1000);

console.log("[1] FLUJO GUIADO · multi-turno por la cadena real (forma piso)");
clearPnl(); resetPnlDraft();
const r1 = go("Armemos mi P&L", false);
ok(r1 && /¿Qué gastos quieres considerar\? Nómbralos como los manejas tú/.test(r1.text), "start → la pregunta del owner, verbatim");
ok(pnlDraft() && pnlDraft().stage === "gastos", "draft abierto en etapa gastos");
const r2 = go("administrativos, logística y marketing");
ok(r2 && /¿Qué %/.test(r2.text) && pnlDraft().stage === "pcts", "lista LIBRE anotada → pide los %");
ok(pnlDraft().lines.map((l) => l.nombre).join("·") === "Administrativos·Logística·Marketing", "las líneas son LAS DEL USUARIO (dinámicas, no catálogo)");
const r3 = go("1, 3, 1.5");
ok(r3 && /Queda así, sobre la venta/.test(r3.text) && /¿Lo sello\?/.test(r3.text), "resumen tipo boleta + oferta de sello");
ok(/· Ingreso: .*\n· Costo: .*\n· Carga comercial: .*\n· Gastos declarados: .*\n· \*\*Resultado comercial: /.test(r3.text), "la propuesta muestra la cascada UNA CIFRA POR LÍNEA (regla de formato del owner)");
ok(/Queda así, sobre la venta:\n· /.test(r3.text) && /· Gastos totales: /.test(r3.text), "las líneas del usuario también van una por línea con su %");
const r4 = go("sí");
ok(r4 && /^Sellado — /.test(r4.text) && activePnl().length === 3, "'sí' sella (el claim gana al followup_accept) · 3 líneas persistidas");
ok(activePnl().every((l) => l.origen === "supuesto_declarado"), "cada línea guarda origen supuesto_declarado (C.3 reemplaza línea a línea)");
ok(pnlDraft() === null, "el draft se cierra al sellar");

console.log("[2] LA CASCADA CIERRA EXACTO (3 escenarios)");
for (const sc of ["bonanza", "tension", "crisis"]) {
  const c = buildPnlCascade(sc);
  ok(Math.abs((c.ingresoK - c.costoK - c.cargaK - c.totalGastosK) - c.resultadoK) < 1e-9, `${sc}: ingreso − costo − carga − Σgastos == resultado (exacto)`);
  ok(Math.abs(c.porEntidad.reduce((a, e) => a + e.resultadoK, 0) - c.resultadoK) < 1e-6, `${sc}: Σ resultado por entidad == resultado total`);
  ok(Math.abs((c.contribK + c.cargaK) - c.margenBrutoK) < 1e-9 && Math.abs((c.contribK - c.totalGastosK) - c.resultadoK) < 1e-9, `${sc}: margen bruto == contribución + carga · resultado == contribución − gastos`);
  ok(c.gastos.every((g) => Math.abs(g.usdK - (c.ingresoK * g.pct) / 100) < 1e-9), `${sc}: cada gasto == pct × ingreso (v1 % sobre la venta)`);
}

console.log("[3] COHERENCIA · card == apertura (la cara y la lectura cuentan LO MISMO)");
const mr = buildMesaResultado("bonanza");
const rRes = composePnl({ action: "resultado" }, null, { scenario: "bonanza" });
ok(mr.defined && rRes.text.startsWith(`Tu resultado comercial: ${mr.resultado.usdFmt}`), `la lectura ABRE con la cifra de la card (${mr.resultado.usdFmt})`, rRes.text.slice(0, 60));
ok(mr.lectura.includes(mr.resultado.usdFmt) && mr.lectura.includes(mr.resultado.pctFmt), "la lectura de la cara ancla la misma cifra y el mismo %");
const rowRes = mr.cascada.find((r) => r.key === "resultado");
ok(rowRes && rowRes.usdFmt === mr.resultado.usdFmt && rowRes.pctFmt === mr.resultado.pctFmt, "la fila Resultado de la cascada == la card");
const cB = buildPnlCascade("bonanza");
ok(mr.cascada.find((r) => r.key === "contribucion").usdFmt === _moneyK(cB.contribK), "la fila Contribución de la cascada == la cifra del motor");
const topG = cB.gastos.slice().sort((a, b) => b.usdK - a.usdK)[0];
const rPeso = composePnl({ action: "peso" }, null, { scenario: "bonanza" });
ok(mr.foco && mr.foco.usdFmt === _moneyK(topG.usdK) && rPeso.text.includes(_moneyK(topG.usdK)) && rPeso.text.includes(topG.nombre.toLowerCase()), "el foco 02 (card) y la lectura de peso nombran LA MISMA línea con EL MISMO $");
const rowFal = mr.cuadro.rows.find((r) => r.name === "Falabella");
const rEnt = composePnl({ action: "resultado_entidad", entidad: "Falabella" }, null, { scenario: "bonanza" });
ok(rowFal && rEnt.text.startsWith(`Después de gastos, Falabella deja ${_moneyK(rowFal.resultado)}`), "la fila del cuadro por entidad == la apertura de su lectura");
ok(Math.abs(mr.cuadro.total.resultado - cB.resultadoK) < 1e-6, "el Total del cuadro == el resultado de la cascada");
ok(mr.cascada.filter((r) => r.kind === "supuesto").length === cB.lines.length && mr.cascada.filter((r) => r.kind === "probado").length === 5, "graduación: 5 pasos probados + N líneas supuesto declarado");
ok(mr.cascada.filter((r) => r.kind === "supuesto").every((r) => /supuesto declarado · \d/.test(r.nota)), "cada línea del usuario lleva su nota 'supuesto declarado · N%'");

console.log("[4] GUARDS · toda lectura self-consistente con su boleta");
for (const [tag, r] of [["resultado", rRes], ["peso", rPeso], ["entidad", rEnt],
  ["simulate", go(pnlSimAsk(topG))],
  ["meta", go("¿Cuánto tengo que vender para ganar $18M después de gastos?")],
  ["recall", go("¿Qué gastos tengo configurados?")]]) {
  const g = r && r.evidence && Array.isArray(r.evidence.boleta) ? guardAgainstBoleta(r.text, r.evidence.boleta) : { ok: false, reason: "sin boleta" };
  ok(g.ok, `${tag}: cifras == boleta`, g.reason);
}

console.log("[5] EDICIÓN conversacional · una verdad");
const rEd = go("cambia logística a 2%");
ok(rEd && activePnl().find((l) => l.nombre === "Logística").pct === 2 && rEd.text.includes(_moneyK(buildPnlCascade("bonanza").resultadoK)), "cambiar % recalcula y cita el resultado nuevo");
const rBad = go("cambia logística a 80%");
ok(rBad && /no me cierra/.test(rBad.text) && activePnl().find((l) => l.nombre === "Logística").pct === 2, "% fuera de rango → honesto, no guarda");
const rAdd = go("agrega bodegaje 1%");
ok(rAdd && activePnl().some((l) => l.nombre === "Bodegaje"), "agregar línea nueva conversando");
const rDel = go("saca bodegaje");
ok(rDel && !activePnl().some((l) => l.nombre === "Bodegaje"), "sacar línea conversando");
ok(go("Saca marketing del P&L") && !activePnl().some((l) => l.nombre === "Marketing"), "el botón 'sacar' del panel de criterio responde");

console.log("[6] CORDURA HONESTA · resultado negativo declarado, nunca bloqueado en silencio");
clearPnl(); resetPnlDraft();
go("armemos mi p&l", false);
const rNeg = go("administrativos 20%, logística 12%");
ok(rNeg && /cordura|negativo/i.test(rNeg.text) && /¿Los revisamos\?/.test(rNeg.text) && /¿Lo sello\?/.test(rNeg.text), "Σ% absurdo → ADI lo declara ANTES de sellar y deja elegir");
const rNegSello = go("séllalo");
ok(rNegSello && /^Sellado — /.test(rNegSello.text) && activePnl().length === 2, "sellar igual funciona (declara, no bloquea)");
const mrNeg = buildMesaResultado("bonanza");
ok(mrNeg.alerta && /negativo/i.test(mrNeg.alerta.linea) && mrNeg.resultado.negativo, "la cara declara el resultado negativo arriba (cordura visible)");

console.log("[7] EMPTY STATE · sin P&L la cara ofrece armarlo");
clearPnl(); resetPnlDraft();
const mrEmpty = buildMesaResultado("bonanza");
ok(mrEmpty.defined === false && /Todavía no armamos tu P&L/.test(mrEmpty.empty.titulo), "cara vacía honesta");
ok(mrEmpty.empty.prefill === "Armemos mi P&L", "el CTA prefilla el flujo guiado");
const sPre = CF(mrEmpty.empty.prefill, false, null);
ok(sPre && sPre.turn_type === "pnl_setup", "el prefill RECLAMA el flujo por la cadena (promesa del empty state)");
resetPnlDraft();
const rSinPnl = go("¿Cómo queda mi resultado comercial?", false);
ok(rSinPnl && /no hay resultado después de gastos que afirmar|todavía no tengo tus líneas/i.test(rSinPnl.text) && /¿Armamos tu P&L ahora\?/.test(rSinPnl.text), "lectura sin P&L → honesta + ofrece el flujo");
ok(CF("¿Armamos tu P&L ahora?", true, null) && CF("¿Armamos tu P&L ahora?", true, null).turn_type === "pnl_setup", "esa oferta también es una promesa que reclama");
resetPnlDraft();

console.log("[8] PROMESAS PROPIAS · toda ask/sugerencia del P&L responde (0 rotas)");
setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }]);
const mrP = buildMesaResultado("bonanza");
const ROTA_RE = /^(No tengo a |No te puedo atribuir|No encuentro |Esa vista todav[ií]a|No supe c[oó]mo|Se me trab[oó])/;
const promesas = new Map();
const put = (ask, tag) => { if (ask && !promesas.has(ask)) promesas.set(ask, tag); };
for (const r of mrP.cascada) put(r.ask, `cascada:${r.key}`);
if (mrP.foco) put(mrP.foco.ask, "foco");
if (mrP.accion) put(mrP.accion.ask, "accion");
for (const s2 of mrP.simulaciones) put(s2.ask, `ysi:${s2.key}`);
for (const r of mrP.cuadro.rows) put(r.ask, `cuadro:${r.name}`);
for (const r of [composePnl({ action: "resultado" }, null, { scenario: "bonanza" }), composePnl({ action: "peso" }, null, { scenario: "bonanza" }), composePnl({ action: "recall" }, null, { scenario: "bonanza" })])
  for (const s2 of (r.suggestions || [])) put(s2, "sugerencia");
let rotas = 0;
for (const [texto, tag] of promesas) {
  let motivo = null;
  try {
    const cs = CF(texto, false, null);
    if (!cs) motivo = "coerceFloor null (caería al parse regex)";
    else {
      const r = AC(cs, {}, { scenario: "bonanza" });
      const t = (r && r.text) || "";
      if (!t.trim() || /^spec_blocked_/.test(r.route || "") || ROTA_RE.test(t.trim())) motivo = `[${r && r.route}] ${t.slice(0, 70)}`;
    }
  } catch (e) { motivo = "THROW " + String(e && e.message).slice(0, 60); }
  if (motivo) { rotas++; console.log(`    ✗ promesa ROTA «${texto}» (${tag}) → ${motivo}`); }
}
ok(rotas === 0, `${promesas.size} promesas del P&L cumplen por la cadena (asks de la cara + sugerencias)`);

console.log("[9] REGISTRO ejecutivo en todo texto emitido");
const BANNED = /\b(plata|dormid[oa]s?|guita|palancas?|vara|apr[ei]et\w*)\b/i;   // + apretar/aprieta (owner 2026-07-26: "poco ejecutivo")
let sucios = 0;
const scan = (tag, t) => { if (typeof t === "string" && BANNED.test(t)) { sucios++; console.log(`    ✗ registro roto en ${tag}: «${t.match(BANNED)[0]}»`); } };
for (const a of ["start", "recall", "resultado", "peso"]) { const r = composePnl({ action: a }, null, { scenario: "bonanza" }); scan(`composePnl:${a}`, r.text); for (const s2 of (r.suggestions || [])) scan(`composePnl:${a}·sug`, s2); }
scan("simulate", composePnl({ action: "simulate_line", nombre: "Logística", pct: 2 }, null, { scenario: "bonanza" }).text);
scan("entidad", composePnl({ action: "resultado_entidad", entidad: "Falabella" }, null, { scenario: "bonanza" }).text);
scan("meta", composePnl({ action: "meta_venta", targetK: 18000 }, null, { scenario: "bonanza" }).text);
const mrR = buildMesaResultado("bonanza");
scan("cara:lectura", mrR.lectura);
for (const r of mrR.cascada) { scan(`cara:${r.key}`, r.label); scan(`cara:${r.key}·def`, r.def); scan(`cara:${r.key}·nota`, r.nota || ""); scan(`cara:${r.key}·ask`, r.ask); }
if (mrR.foco) scan("cara:foco", mrR.foco.label);
if (mrR.accion) { scan("cara:accion", mrR.accion.titulo); scan("cara:accion·det", mrR.accion.detalle); }
for (const s2 of mrR.simulaciones) scan(`cara:ysi:${s2.key}`, s2.texto);
clearPnl();
const mrE = buildMesaResultado("bonanza");
scan("cara:empty", mrE.empty.texto); scan("cara:empty·titulo", mrE.empty.titulo);
ok(sucios === 0, "cero plata/dormido/guita/palanca/vara en lo emitido por el P&L");

console.log("[10] PROTECCIONES · el claim no roba turnos ajenos · 'olvidá todo' limpia también el P&L");
clearPnl(); resetPnlDraft();
ok(CS("margen por cliente", S({}), false, null).turn_type !== "pnl_setup", "'margen por cliente' no es del P&L");
ok(CS("¿qué pasa si las ventas suben 3%?", S({}), false, null).operation === "simulate", "el simulate genérico sigue siendo del proyector");
ok(CS("olvidá el margen mínimo", S({}), false, null).turn_type === "apply_criteria", "el forget de criterio sigue siendo de criteria");
ok(CS("¿analizamos las campañas de marketing?", S({}), false, null).turn_type === "meta_question", "sin flujo activo, 'campañas de marketing' sigue siendo fuera-de-dato");
setPnlLines([{ nombre: "Logística", pct: 3 }]);
const rTodo = AC(S({ turn_type: "apply_criteria", criteria: { action: "forget", key: "todo" } }), {}, {});
ok(activePnl().length === 0 && /P&L/.test(rTodo.text), "'olvidá todo' (criteria) también limpia el P&L y lo dice");
setPnlLines([{ nombre: "Logística", pct: 3 }]);
const rRecall = AC(S({ turn_type: "apply_criteria", criteria: { action: "recall" } }), {}, {});
ok(/P&L comercial: logística 3%/.test(rRecall.text) && Array.isArray(rRecall.evidence.pnlList) && rRecall.evidence.pnlList.length === 1, "'¿qué sabés de mi negocio?' cuenta también el P&L (texto + pnlList al panel)");
clearPnl(); resetPnlDraft();

/* ══ PASE 2 (owner 2026-07-25) · P&L POR ALCANCE + CONEXIÓN TOTAL ("nada al azar") ══ */
const { pnlDisponibilidad, pnlEjesDisponibles, detectPnlEllipsis, pnlScope, updateMemoria, METRICS, ENTITIES, buildDisponibleMenu, chartForEvidence, pnlMesaLink } = M;
const _norm2 = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

console.log("[11] DISPONIBILIDAD data-driven == contrato (nada hardcodeado)");
const disp = pnlDisponibilidad();
const dOf = (e) => disp.find((d) => d.eje === e);
ok(disp.length === Object.keys(ENTITIES).length, "la disponibilidad barre TODOS los ejes del contrato");
for (const d of disp) {
  const declara = (METRICS.ventas.axes || []).includes(d.eje) && (METRICS.contribucion.axes || []).includes(d.eje);
  if (!declara) ok(!d.available && /venta desglosada/.test(d.motivo), `${d.eje}: sin venta+contribución en el contrato → NO disponible con motivo honesto`, d.motivo);
}
ok(dOf("cliente") && dOf("cliente").available, "cliente (la base) disponible");
ok(dOf("familia") && dOf("familia").available && dOf("marca") && dOf("marca").available, "familia y marca disponibles (la base trae el desglose)");
ok(dOf("bodega") && !dOf("bodega").available && /no tengo la venta desglosada por bodega/.test(dOf("bodega").motivo), "bodega NO disponible — el motivo es la palabra del owner");
ok(dOf("sku") && !dOf("sku").available, "sku NO disponible (el contrato declara venta@sku pero la base del P&L no baja ahí — la cobertura manda)");
ok(/P&L/.test(buildDisponibleMenu()) && /bodega NO|sin venta desglosada/i.test(buildDisponibleMenu()), "el universo DISPONIBLE del narrador declara el alcance del P&L (una verdad)");

console.log("[12] ALCANCES · Σ eje == negocio EXACTO · cada entidad cierra (3 escenarios × ejes disponibles)");
setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }]);
for (const sc of ["bonanza", "tension", "crisis"]) {
  for (const d of pnlEjesDisponibles()) {
    const c = buildPnlCascade(sc, null, { dimension: d.eje });
    ok(Math.abs(c.porEntidad.reduce((a, e) => a + e.resultadoK, 0) - c.resultadoK) < 1e-6, `${sc}/${d.eje}: Σ resultado de las entidades == resultado del negocio`);
    ok(c.porEntidad.every((e) => Math.abs((e.ventaK - e.costoK - e.cargaK - e.gastoK) - e.resultadoK) < 1e-9), `${sc}/${d.eje}: la cascada de CADA entidad cierra exacto`);
    ok(Math.abs(c.porEntidad.reduce((a, e) => a + e.ventaK, 0) - c.ingresoK) < 1e-6 && Math.abs(c.porEntidad.reduce((a, e) => a + e.cargaK, 0) - c.cargaK) < 1e-6, `${sc}/${d.eje}: Σ venta y Σ carga cierran con el negocio (mismas anclas)`);
  }
}

console.log("[13] LECTURAS SCOPED · abren con las cifras del alcance · guard limpio · sin cobertura = honesto");
const _cCli = buildPnlCascade("bonanza"), _cFam = buildPnlCascade("bonanza", null, { dimension: "familia" });
const eFal = _cCli.porEntidad.find((x) => x.nombre === "Falabella"), eCP = _cFam.porEntidad.find((x) => x.nombre === "Cuidado Personal");
const rScF = go("P&L de Falabella", false);
ok(rScF && rScF.text.startsWith(`**El P&L de Falabella: te deja ${_moneyK(eFal.resultadoK)} al año**`), "«P&L de Falabella» abre con LA HISTORIA: qué te deja (historia primero, owner 2026-07-26)", rScF && rScF.text.slice(0, 80));
const tScF = rScF.evidence.tablaM;
ok(tScF && tScF.rows.some((r) => r.label === "Ingreso" && r.values[0] === _moneyK(eFal.ventaK)) && tScF.rows.some((r) => r.label === "Contribución" && r.values[0] === _moneyK(eFal.contribK)) && tScF.rows.some((r) => r.label === "Carga comercial" && r.values[0] === `− ${_moneyK(eFal.cargaK)}`), "la cascada scoped viaja EN LA TABLA con venta/contribución/carga DE Falabella (costo derivado)");
const rScCP = go("dame el P&L de Cuidado Personal", false);
ok(rScCP && rScCP.text.includes(`El P&L de Cuidado Personal`) && rScCP.text.includes(_moneyK(eCP.resultadoK)), "«P&L de Cuidado Personal» (familia) responde con las cifras del grupo");
const rEntCP = go("¿Cuánto deja Cuidado Personal después de gastos?", false);
ok(rEntCP && rEntCP.text.startsWith(`Después de gastos, Cuidado Personal deja ${_moneyK(eCP.resultadoK)}`), "resultado_entidad ahora resuelve entidades de CUALQUIER eje disponible");
const rMak = go("P&L de Makita", false);
ok(rMak && /no lo puedo armar con rigor/.test(rMak.text) && /ser[ií]a inventar/.test(rMak.text) && !/prorrateados .*=/.test(rMak.text), "entidad del contrato SIN venta desglosada (Makita) → honesto, JAMÁS prorratea");
const rTabF = go("P&L por familia", false);
ok(rTabF && _cFam.porEntidad.every((x) => rTabF.evidence.tablaM.rows.some((r) => r.label === x.nombre)) && rTabF.text.includes(_moneyK(_cFam.resultadoK)), "el P&L por familia lista TODAS las familias EN LA TABLA y el texto ancla el resultado del negocio");
ok(/suman exacto el resultado del negocio/.test(rTabF.text), "la tabla DECLARA la coherencia Σ == negocio");
const rTabC = go("P&L por cliente", false);
ok(rTabC && rTabC.evidence.tablaM.rows.some((r) => /^…y \d+ más$/.test(r.label)), "la tabla por cliente (13) recorta honesto: top + fila resto que SUMA exacto");
const _restoFig = rTabC.evidence.boleta.find((f) => f.label === "Resto · resultado");
ok(!!_restoFig, "el resto recortado viaja en boleta (toda cifra autorizada)");
for (const [tag, r] of [["scoped Falabella", rScF], ["scoped CP", rScCP], ["tabla familia", rTabF], ["tabla cliente", rTabC], ["tabla marca", go("P&L por marca", false)],
  ["meta scoped", go("¿cuánto vender en Falabella para que me deje $500K después de gastos?", false)],
  ["sim scoped", go("¿qué pasa si bajas logística a 1.5% en Falabella?", false)]]) {
  const g = r && r.evidence && Array.isArray(r.evidence.boleta) ? guardAgainstBoleta(r.text, r.evidence.boleta) : { ok: false, reason: "sin boleta" };
  ok(g.ok, `guard ${tag}: cifras == boleta`, g.reason);
}

console.log("[14] REDIRECT honesto · el eje imposible dice DÓNDE SÍ · chips gate-proven");
const rPv = go("quiero el P&L por punto de venta", false);
ok(rPv && /El P&L por punto de venta no lo puedo armar — no tengo la venta desglosada por bodega/.test(rPv.text), "redirect punto de venta: la frase del owner, data-driven", rPv && rPv.text.slice(0, 100));
ok(/S[ií] puedo d[aá]rtelo por .*negocio/.test(rPv.text) && /¿Cu[aá]l te sirve\?/.test(rPv.text), "el redirect nombra dónde SÍ y cierra con la oferta");
const rSku = go("muéstrame el P&L por SKU", false);
ok(rSku && /no lo puedo armar/.test(rSku.text) && /no baja desglosada a SKU/.test(rSku.text), "P&L por SKU → honesto (la muestra no es el desglose de la venta)");
for (const s2 of (rPv.suggestions || [])) {
  const cs = CF(s2, false, null);
  const r2 = cs ? AC(cs, {}, { scenario: "bonanza" }) : null;
  ok(!!(r2 && String(r2.text || "").trim() && !/^(No tengo a |No encuentro )/.test(r2.text)), `chip del redirect responde: «${s2}»`, r2 && r2.text.slice(0, 60));
}

console.log("[15] CONEXIÓN TOTAL · herencia · volver · recuerda · deixis · memoria · sin robar turnos");
void go("P&L de Falabella", false);
const rHer = go("¿y el de Ripley?");
const eRip = _cCli.porEntidad.find((x) => x.nombre === "Ripley");
ok(rHer && rHer.text.includes("El P&L de Ripley") && rHer.text.includes(_moneyK(eRip.resultadoK)), "«¿y el de Ripley?» hereda la operación con la entidad nueva (piso)");
ok(pnlScope() && pnlScope().entity === "Ripley", "el alcance del hilo quedó en Ripley");
// operation="margin" (clasificación CONCRETA y fuerte de otro dominio) SIGUE ganando siempre — la herencia P&L
// nunca pisa una clasificación resuelta y específica del LLM.
const sNoPisa = CS("¿y el de Jumbo?", S({ operation: "margin", metric: "margen", entity: "Jumbo", dimension: "cliente", turn_type: "new_query" }), true, null);
ok(sNoPisa.operation === "margin", "la herencia NO pisa una clasificación CONCRETA resuelta del LLM (margin de otro hilo sigue siendo margin)");
// EXCEPCIÓN "dive" (owner 2026-07-31, fix de auditoría integral, defecto "P&L del pipeline antiguo"): a diferencia
// de "margin" arriba, "dive" es la clasificación GENÉRICA de LLM#1 (no distingue dominio) — medido con el LLM real,
// un "¿y el de X?" tras una lectura P&L a veces clasifica "dive" por error y el turno perdía el dominio P&L entero
// (reproducido 1/3 corridas idénticas). Con el hilo P&L vivo, "dive" YA NO se trata como "resuelto": la red de
// continuidad P&L gana. Este es el comportamiento CORREGIDO — antes de este fix, esta aserción esperaba "dive"
// (el mismo bug que el hallazgo reprodujo), ver _pnl_dive_precedencia_gate.mjs para el gate dedicado del fix.
const sPisaDive = CS("¿y el de Jumbo?", S({ operation: "dive", entity: "Jumbo", dimension: "cliente", turn_type: "new_query" }), true, null);
ok(sPisaDive.turn_type === "pnl_setup" && sPisaDive.pnl && sPisaDive.pnl.entidad === "Jumbo", `"dive" (clasificación genérica) SÍ cede a la continuidad P&L con el hilo vivo — obtuvo ${JSON.stringify(sPisaDive)}`);
const rVol = go("volvamos al P&L");
ok(rVol && /^Retomo tu P&L donde lo dejamos — Ripley\./.test(rVol.text), "«volvamos al P&L» retoma el ÚLTIMO alcance con su preámbulo");
const rRec = go("recuerda lo anterior");
ok(rRec && /Retomo tu P&L donde lo dejamos — Ripley\./.test(rRec.text), "«recuerda lo anterior» (piso, con hilo P&L vivo) también retoma");
const rDx = AC(S({ turn_type: "pnl_setup", pnl: { action: "resultado_deixis" } }), { lastEvidence: { entityList: { entities: ["Ripley", "La Polar"], dimension: "cliente" } } }, { scenario: "bonanza" });
ok(rDx && /^De los que veníamos mirando, después de gastos: Ripley deja /.test(rDx.text) && !/Falabella/.test(rDx.text), "deixis «de esos» hereda EXACTAMENTE el conjunto nombrado (voz C.1)");
const rDxSku = AC(S({ turn_type: "pnl_setup", pnl: { action: "resultado_deixis" } }), { lastEvidence: { entityList: { entities: ["SAM-TV55"], dimension: "sku" } } }, { scenario: "bonanza" });
ok(rDxSku && /el P&L no baja/.test(rDxSku.text) && /S[ií] puedo/.test(rDxSku.text), "deixis sobre un eje sin venta desglosada (SKU) → honesto + dónde SÍ");
const sDxTxt = CF("de esos, ¿cuánto me dejan después de gastos?", true, null);
ok(sDxTxt && sDxTxt.turn_type === "pnl_setup" && sDxTxt.pnl.action === "resultado_deixis", "la red del piso detecta la deixis P&L en el texto");
ok(rScF.evidence.followup === false && rScF.evidence.entidad === "Falabella" && rScF.evidence.entityType === "cliente", "la lectura scoped emite evidencia ACCIONABLE (entidad+eje → lastEvidence/memoria)");
ok(rTabF.evidence.followup === false && rTabF.evidence.entityList && rTabF.evidence.entityList.entities.length === _cFam.porEntidad.length, "la tabla emite entityList (el «de esos…» siguiente hereda el conjunto)");
const memF = updateMemoria(null, rScF);
ok(memF.entidad && memF.entidad.nombre === "Falabella" && memF.entidad.eje === "cliente", "updateMemoria captura la entidad del P&L (nombre+eje de la MISMA fuente)");
const rEd2 = go("cambia logística a 2.5%");
ok(rEd2 && rEd2.evidence.followup === true, "la edición sigue siendo administrativa (followup) — NO pisa la última lectura del hilo");
void go("cambia logística a 3%");
const rSimD = (() => { void go("P&L de Cuidado Personal", false); return go("¿y si en esa familia bajo logística a 2%?"); })();
ok(rSimD && /solo en Cuidado Personal/.test(rSimD.text) && /declara log[ií]stica global/.test(rSimD.text), "proyección deíctica scoped: local + declara el límite (la línea es global)");
const rSimM = go("¿y si en esa marca bajo logística a 2%?");
ok(rSimM && /¿En cuál\?/.test(rSimM.text), "sustantivo deíctico que NO calza con el eje del alcance → clarifica (jamás adivina)");
const rMeta = go("¿cuánto vender en Falabella para que me deje $500K después de gastos?");
ok(rMeta && rMeta.text.startsWith("Para que Falabella te deje $500K después de gastos, su venta tiene que llegar a "), "meta scoped: explicativo llano (su venta tiene que llegar a)");
ok(/¿Por qué esa cifra\?/.test(rMeta.text) && /Este cálculo no asegura que esa venta ocurra/.test(rMeta.text), "meta: por qué esa cifra + qué no asegura, sin jerga");
for (const s2 of (rMeta.suggestions || [])) {
  const cs3 = CF(s2, false, null);
  ok(!!cs3 && cs3.turn_type === "pnl_setup", `chip de la meta reclama: «${s2}»`);
}
// BLINDAJE pnl-en-operation (sweep LLM 2026-07-25): el LLM #1 pone "pnl_setup" en OPERATION → el turno ES del
// P&L (jamás spec_blocked) — y el rescate elíptico NO lo lee como "op resuelta".
const rBlind = AC(CS("recuerda lo anterior", S({ operation: "pnl_setup", turn_type: "followup_explain" }), true, null), {}, { scenario: "bonanza" });
ok(rBlind && !/^spec_blocked/.test(rBlind.route || "") && /Retomo tu P&L donde lo dejamos/.test(rBlind.text), "operation:'pnl_setup' del LLM + «recuerda lo anterior» → retoma (ni bloqueo ni robo)");
const sEjeEl = CS("muéstramelo por familia", S({ operation: "pnl_setup" }), true, null);
ok(sEjeEl.turn_type === "pnl_setup" && sEjeEl.pnl && sEjeEl.pnl.action === "tabla_eje" && sEjeEl.pnl.eje === "familia", "«muéstramelo por familia» (elíptico, hilo vivo) → la tabla del eje");
// RE-ARME GUIADO (owner en vivo 2026-07-25: «quiero nuevos prorrateos» caía en una lectura de ventas — "es el
// mismo camino dicho de una manera diferente, y ADI debe guiar"): la intención de rehacer, con CUALQUIER
// palabra, reabre el flujo en la etapa de % con las líneas del usuario — y el camino termina en sello.
for (const qEsp of ["quiero nuevos prorrateos", "cambiemos los porcentajes", "usemos otros supuestos", "rehagamos los gastos"]) {
  resetPnlDraft(); void go("P&L de Falabella", false);   // hilo vivo — el rearme no depende de él pero convive
  const rEsp = go(qEsp);
  ok(rEsp && /Armemos tus nuevos supuestos/.test(rEsp.text) && /qué porcentaje le pongo a cada línea esta vez/.test(rEsp.text)
    && pnlDraft() && pnlDraft().stage === "pcts" && pnlDraft().lines.every((l) => l.pct === null),
    `re-arme «${qEsp}» → guía los % de esta vez (draft pcts con TUS líneas)`, rEsp && `[${rEsp.route}] ${rEsp.text.slice(0, 60)}`);
  resetPnlDraft();
}
// …y el rearme completa el MISMO camino: % en orden → sello → una verdad nueva
void go("quiero nuevos prorrateos");
const rReP = go("2, 1, 1.5");
ok(rReP && /¿Lo sello\?/.test(rReP.text), "re-arme: «2, 1, 1.5» → propuesta de sello (mismo camino)");
const rReS = go("sí");
ok(rReS && /^Sellado — /.test(rReS.text) && activePnl().find((l) => l.nombre === "Logística").pct === 2, "re-arme sellado: los % nuevos son la verdad");
// …o una ESTRUCTURA nueva a mitad del rearme (lista ≥2 reemplaza las líneas)
void go("quiero otros prorrateos");
const rReL = go("seguros, fletes y comisiones");
ok(rReL && /¿Qué %/.test(rReL.text) && pnlDraft().lines.map((l) => l.nombre).join("·") === "Seguros·Fletes·Comisiones", "re-arme: lista nueva de gastos reemplaza las líneas y pide sus %");
const rReC = go("cancela");
ok(rReC && /no guardé nada/.test(rReC.text) && activePnl().find((l) => l.nombre === "Logística").pct === 2, "cancelar el rearme deja el P&L vigente intacto");
ok(go("olvida los prorrateos") && activePnl().length === 0, "«olvida los prorrateos» → forget del P&L (mismo espejo)");
setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }]);
// PROYECCIÓN DE VENTA (owner 2026-07-25: "si vendiera X cuánto me quedaría — el real a un lado y el proyectado
// al lado, manteniendo el margen del cliente"): monto de venta ($, sin %) → escala lineal honesta.
void go("P&L de Falabella", false);
const rProy = go("¿y si Falabella vendiera $25M, cuánto me queda con estos gastos?");
const eFalP = buildPnlCascade("bonanza").porEntidad.find((x) => x.nombre === "Falabella");
const resProy = (eFalP.contribK * (25000 / eFalP.ventaK)) - (25000 * buildPnlCascade("bonanza").sumPct / 100);
ok(rProy && /^\*\*¿Qué significa\?\*\*/.test(rProy.text) && rProy.text.includes(`deja un resultado de ${_moneyK(eFalP.resultadoK)}`) && rProy.text.includes(`el resultado subiría a ${_moneyK(resProy)}`), "proyección: el explicativo LLANO del owner con las cifras exactas (hoy vende → si aumenta → subiría)", rProy && rProy.text.slice(0, 90));
ok(/no asegura que esa venta ocurra/.test(rProy.text) && /Tampoco considera cambios en los productos vendidos, los precios o el comportamiento de los clientes/.test(rProy.text) && /\*\*Pregunta clave:\*\*/.test(rProy.text), "el alcance del cálculo en lenguaje del usuario + la pregunta clave (sin jerga)");
// LA TABLA (mockup del owner "así debería verse en el orden"): data estructurada en la evidencia + despacho a la UI
const tb = rProy.evidence.proyeccion;
ok(tb && tb.titulo === "Falabella — Real hoy vs. proyectado" && Array.isArray(tb.rows) && tb.rows.length === 8
  && tb.rows.map((r) => r.label.split(" ·")[0]).join("|") === "Ingreso|Costo|Margen bruto|Carga comercial|Contribución|Gastos declarados|Resultado|Resultado sobre venta",
  "la evidencia lleva LA TABLA en el orden de la cascada (Concepto · Real hoy · Proyectado)");
ok(tb.rows[0].a === _moneyK(eFalP.ventaK) && tb.rows[0].b === _moneyK(25000) && tb.rows[6].a === _moneyK(eFalP.resultadoK) && tb.rows[6].b === _moneyK(resProy), "las columnas Real/Proyectado citan la única verdad (Ingreso y Resultado exactos)");
const cs2p = chartForEvidence(rProy.evidence);
ok(cs2p && cs2p.tipo === "tabla_comparada" && cs2p.tabla === tb, "chartForEvidence despacha la tabla comparada a la UI (InlineChart la renderiza)");
ok((() => { const g = guardAgainstBoleta(rProy.text, rProy.evidence.boleta); return g.ok; })(), "guard proyección: cifras == boleta");
const rProyD = go("¿y si vendiera $25M?");
ok(rProyD && /Hoy Falabella vende /.test(rProyD.text) && rProyD.text.includes("$25.0M"), "«¿y si vendiera $25M?» sin nombre hereda el alcance vivo (Falabella)");
const rProyN = go("¿y si el negocio vendiera $120M, cuánto me queda?");
ok(rProyN && /Hoy el negocio vende /.test(rProyN.text) && rProyN.text.includes("$120.0M"), "«el negocio» fuerza la proyección global");
const rProyB = go("¿y si Falabella vendiera $10M?");
ok(rProyB && /el resultado bajaría a /.test(rProyB.text) && /si la venta cae/.test(rProyB.text), "proyección a la baja: el explicativo cambia de dirección honesto");
ok(CS("¿qué pasa si las ventas suben 3%?", S({}), false, null).operation === "simulate", "el proyector genérico de % sigue intacto (la proyección de venta exige MONTO)");
for (const s2 of (rProy.suggestions || [])) {
  const cs2 = CF(s2, false, null);
  ok(!!cs2 && cs2.turn_type === "pnl_setup", `chip de la proyección reclama: «${s2}»`);
}
const rBlind2 = AC(S({ operation: "pnl_setup", turn_type: "followup_change_dimension", pnl: { dimension: "familia" } }), {}, { scenario: "bonanza" });
ok(rBlind2 && !/^spec_blocked/.test(rBlind2.route || "") && /Tu P&L por familia/.test(rBlind2.text), "operation pnl_* + turn_type espurio + pnl.dimension → la tabla resuelve por composePnl");
clearPnl(); resetPnlDraft();
ok(detectPnlEllipsis("¿y el de Ripley?") === null, "sin hilo P&L vivo la elipsis NO reclama (el turno sigue su curso)");
setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }]);
ok(CS("margen por cliente", S({}), false, null).operation === "margin", "«margen por cliente» sigue siendo del margen (el alcance no roba)");
ok(CS("¿quiénes son mis principales clientes por venta?", S({}), false, null).operation === "rank", "«principales clientes por venta» sigue siendo el ranking (A2)");

console.log("[16] CARA RESULTADO pase 2 · selector de eje · cascada scopeable · promesas nuevas 0 rotas");
const mrCli = buildMesaResultado("bonanza"), mrFam = buildMesaResultado("bonanza", "familia"), mrMar = buildMesaResultado("bonanza", "marca");
ok(mrCli.cuadro.eje === "cliente" && mrCli.cuadro.colLabel === "Cliente" && mrCli.cuadro.n === _cCli.porEntidad.length, "default: el cuadro por cliente intacto");
ok(mrCli.cuadro.ejes.map((x) => x.key).join(",") === pnlEjesDisponibles().map((d) => d.eje).join(","), "el selector ofrece EXACTAMENTE los ejes disponibles (bodega/sku no aparecen)");
ok(mrFam.cuadro.n === _cFam.porEntidad.length && mrFam.cuadro.colLabel === "Familia", "cuadro por familia: sus 4 filas con su etiqueta");
for (const mr2 of [mrCli, mrFam, mrMar]) ok(Math.abs(mr2.cuadro.total.resultado - _cCli.resultadoK) < 1e-6, `Total del cuadro (${mr2.cuadro.eje}) == resultado del negocio`);
ok(buildMesaResultado("bonanza", "bodega").cuadro.eje === "cliente", "pedir un eje NO disponible cae al primario (nunca una tabla vacía)");
const mrFoco = buildMesaResultado("bonanza", "familia", { eje: "familia", nombre: "Cuidado Personal" });
ok(mrFoco.alcance && mrFoco.alcance.nombre === "Cuidado Personal" && /^P&L de Cuidado Personal: de /.test(mrFoco.lectura), "cascadaFoco: la cascada cuenta ESA entidad con su lectura");
const rowResF = mrFoco.cascada.find((r) => r.key === "resultado");
const rowCPq = mrFoco.cuadro.rows.find((r) => r.name === "Cuidado Personal");
ok(rowResF && rowResF.usdFmt === _moneyK(rowCPq.resultado), "la fila Resultado de la cascada scoped == la fila del cuadro (una verdad)");
ok(mrFoco.resultado.usdFmt === mrCli.resultado.usdFmt, "la card global (resultado del negocio) queda INTACTA con el foco puesto");
ok(buildMesaResultado("bonanza", "familia", { eje: "familia", nombre: "NoExiste" }).alcance === null, "foco inexistente → cascada global (sin crash)");
// promesas del pase 2: los asks de los cuadros por eje + la cascada scoped + sugerencias de las lecturas nuevas
const prom2 = new Map();
const put2 = (a2, tag) => { if (a2 && !prom2.has(a2)) prom2.set(a2, tag); };
for (const [mr2, tag] of [[mrFam, "cuadro:familia"], [mrMar, "cuadro:marca"], [mrFoco, "cascadaFoco"]]) {
  for (const r2 of mr2.cuadro.rows) put2(r2.ask, `${tag}·fila:${r2.name}`);
  for (const r2 of mr2.cascada) put2(r2.ask, `${tag}·casc:${r2.key}`);
  if (mr2.alcance) put2(mr2.alcance.ask, `${tag}·alcance`);
}
for (const r2 of [rScF, rTabF, rTabC, rPv, rMak, rDxSku]) for (const s2 of (r2.suggestions || [])) put2(s2, "sugerencia");
let rotas2 = 0;
for (const [texto, tag] of prom2) {
  let motivo = null;
  try {
    const cs = CF(texto, false, null);
    if (!cs) motivo = "coerceFloor null";
    else {
      const r2 = AC(cs, {}, { scenario: "bonanza" });
      const t2 = (r2 && r2.text) || "";
      if (!t2.trim() || /^spec_blocked_/.test(r2.route || "") || ROTA_RE.test(t2.trim())) motivo = `[${r2 && r2.route}] ${t2.slice(0, 70)}`;
    }
  } catch (e) { motivo = "THROW " + String(e && e.message).slice(0, 60); }
  if (motivo) { rotas2++; console.log(`    ✗ promesa ROTA «${texto}» (${tag}) → ${motivo}`); }
}
ok(rotas2 === 0, `${prom2.size} promesas del pase 2 cumplen por la cadena (cuadros por eje + cascada scoped + sugerencias)`);
// registro ejecutivo en lo NUEVO emitido
let sucios2 = 0;
const scan2 = (tag, t2) => { if (typeof t2 === "string" && BANNED.test(t2)) { sucios2++; console.log(`    ✗ registro roto en ${tag}: «${t2.match(BANNED)[0]}»`); } };
for (const [tag, r2] of [["scoped", rScF], ["tabla familia", rTabF], ["tabla cliente", rTabC], ["redirect", rPv], ["makita", rMak], ["deixis", rDx], ["volver", rVol], ["sim deictic", rSimD], ["meta scoped", rMeta]])
  if (r2) { scan2(tag, r2.text); for (const s2 of (r2.suggestions || [])) scan2(`${tag}·sug`, s2); }
for (const r2 of mrFoco.cascada) { scan2(`caraFoco:${r2.key}`, r2.label); scan2(`caraFoco:${r2.key}·def`, r2.def); }
scan2("caraFoco:lectura", mrFoco.lectura);
ok(sucios2 === 0, "registro ejecutivo limpio en todo lo nuevo del pase 2");
clearPnl(); resetPnlDraft();

console.log("[18] SEGUIMIENTO P&L-aware · explica simple · decisiones · real-o-supuesto · cambia la venta");
setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }]);
const rBase18 = go("P&L de Falabella", false);
const _eF18 = buildPnlCascade("bonanza").porEntidad.find((x) => x.nombre === "Falabella");
const rEx18 = AC(S({ turn_type: "followup_explain" }), { lastEvidence: rBase18.evidence }, { scenario: "bonanza" });
ok(rEx18 && /^Te lo cuento simple\. Falabella vendió /.test(rEx18.text) && rEx18.text.includes(_moneyK(_eF18.resultadoK)), "«explícame esto más sencillo» sobre el P&L → LA MISMA cascada en llano (no el porqué de margen)", rEx18 && rEx18.text.slice(0, 80));
ok(/La parte firme llega hasta la contribución/.test(rEx18.text) && /los porcentajes que me diste/.test(rEx18.text), "el explica-simple mantiene la graduación (firme vs declarado) sin jerga");
ok(guardAgainstBoleta(rEx18.text, rEx18.evidence.boleta).ok, "guard explica-simple: cifras == boleta");
const rRec18 = AC(S({ turn_type: "followup_recommendation" }), { lastEvidence: rBase18.evidence }, { scenario: "bonanza" });
ok(rRec18 && /las decisiones a la mano/.test(rRec18.text) && !/No tengo una lectura reciente/.test(rRec18.text), "«¿qué decisiones tomo?» sobre el P&L → decisiones DEL P&L (jamás needLast)", rRec18 && rRec18.text.slice(0, 80));
ok(/1\. Revisar la línea que más pesa/.test(rRec18.text) && /2\. Decidir dónde empujar la venta/.test(rRec18.text) && /3\. Fijar una meta concreta/.test(rRec18.text), "las 3 decisiones: línea top · dónde empujar · meta");
ok(guardAgainstBoleta(rRec18.text, rRec18.evidence.boleta).ok, "guard decisiones: cifras == boleta");
for (const s2 of (rRec18.suggestions || [])) {
  const cs4 = CF(s2, false, null);
  ok(!!cs4 && cs4.turn_type === "pnl_setup", `chip de decisiones reclama: «${s2}»`);
}
const rMq18 = AC(S({ turn_type: "meta_question", meta: "real_o_supuesto" }), { lastEvidence: rBase18.evidence }, { scenario: "bonanza" });
ok(rMq18 && /conviven los dos/.test(rMq18.text) && /porcentajes que declaraste/.test(rMq18.text) && /firme hasta la contribución/.test(rMq18.text), "«¿es real o supuesto?» sobre el P&L → respuesta GRADUADA (ni 'es real' ni 'es supuesto' secos)");
const rMq18b = AC(S({ turn_type: "meta_question", meta: "real_o_supuesto" }), {}, { scenario: "bonanza" });
ok(rMq18b && /Es dato real de tu cartera/.test(rMq18b.text), "sin hilo P&L el meta clásico queda INTACTO");
const rCv18 = go("cambia la venta de Falabella a $25M");
ok(rCv18 && /¿Qué significa\?/.test(rCv18.text) && /Hoy Falabella vende/.test(rCv18.text), "«cambia la venta de X a $25M» → la proyección (cambiar un dato = usar otra venta)");
clearPnl(); resetPnlDraft();

console.log("[19] CRUCES · la lente RESULTADO en el multi-análisis (P&L × margen/capital/ventas)");
setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }]);
const sMulti19 = CS("margen y resultado comercial de Cuidado Personal", S({}), false, null);
ok(sMulti19.turn_type === "multi_analysis" && sMulti19.multi && sMulti19.multi.metrics.includes("resultado"), "la enumeración de lentes va al MULTI — el claim P&L no roba el cruce");
const rM19 = AC(sMulti19, {}, { scenario: "bonanza" });
const eCP19 = buildPnlCascade("bonanza", null, { dimension: "familia" }).porEntidad.find((x) => x.nombre === "Cuidado Personal");
ok(/\*\*Resultado después de gastos\*\*/.test(rM19.text) && rM19.text.includes(_moneyK(eCP19.resultadoK)), "la sección resultado cita las cifras del ALCANCE (familia resuelta por el canon)", rM19.text.slice(0, 90));
ok(/\*\*Margen\*\*/.test(rM19.text), "la otra lente vive en la MISMA respuesta (secciones · boletas mergeadas)");
const rM19b = AC(CS("resultado y capital de los SKU", S({}), false, null), {}, { scenario: "bonanza" });
ok(rM19b && /\*\*Resultado después de gastos\*\*/.test(rM19b.text) && /\*\*Capital en inventario\*\*/.test(rM19b.text), "resultado × capital: el dinero que queda Y el dinero atrapado, en una respuesta");
ok(CS("¿cómo queda mi resultado comercial?", S({}), false, null).turn_type === "pnl_setup", "una sola lente sigue siendo del P&L (el multi no roba el single)");
clearPnl(); resetPnlDraft();
const rM19c = AC(CS("margen y resultado de Falabella", S({}), false, null), {}, { scenario: "bonanza" });
ok(rM19c && /Resultado después de gastos/.test(rM19c.text) && /¿Armamos tu P&L ahora\?/i.test(rM19c.text), "sin P&L armado la sección resultado OFRECE armarlo (ownership, no silencio)");

console.log("[20] TABLA COMPARADA universal · el ANTES|AHORA de la edición (dos columnas de números = tabla)");
clearPnl(); resetPnlDraft();   // [19] cierra con la oferta de armarlo (draft abierto) — esta sección parte limpia
setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }]);
const _p20 = (v) => `${String(Math.round(v * 10) / 10)}%`;
const c20a = buildPnlCascade("bonanza");
const rEd20 = go("cambia marketing a 2%");
const c20b = buildPnlCascade("bonanza");
const tb20 = rEd20 && rEd20.evidence && rEd20.evidence.tabla;
ok(tb20 && tb20.titulo === "Marketing — antes vs. ahora" && tb20.cols.join("|") === "Antes|Ahora" && tb20.rows.length === 5
  && tb20.rows.map((r) => r.label).join("|") === "Línea · Marketing|Gastos declarados · % sobre venta|Gastos declarados|Resultado comercial|Resultado sobre venta",
  "edit_set emite LA TABLA ANTES|AHORA estructurada en la evidencia (línea · gastos % y $ · resultado $ y %)", tb20 && JSON.stringify(tb20.rows.map((r) => r.label)));
ok(tb20 && tb20.rows[0].a === "1.5%" && tb20.rows[0].b === "2%" && tb20.rows[0].strong === true, "la línea editada: % vigente → % nuevo");
ok(tb20 && tb20.rows[1].a === _p20(c20a.sumPct) && tb20.rows[1].b === _p20(c20b.sumPct) && tb20.rows[2].a === _moneyK(c20a.totalGastosK) && tb20.rows[2].b === _moneyK(c20b.totalGastosK), "gastos declarados antes/ahora == la única verdad (% y $)");
ok(tb20 && tb20.rows[3].a === _moneyK(c20a.resultadoK) && tb20.rows[3].b === _moneyK(c20b.resultadoK) && tb20.rows[3].resultado === true && tb20.rows[4].pct === true, "resultado antes/ahora exacto · fila destacada · % muted");
ok(tb20 && typeof tb20.nota === "string" && tb20.nota.length > 0, "la tabla de edición declara su supuesto al pie (nota data-driven)");
ok(rEd20.evidence.followup === true, "la edición SIGUE siendo administrativa (followup:true — NO pisa la última lectura)");
const cs20 = chartForEvidence(rEd20.evidence);
ok(cs20 && cs20.tipo === "tabla_comparada" && cs20.tabla === tb20, "chartForEvidence despacha el ANTES|AHORA aun con followup:true (el dispatch va antes del guard)");
ok(guardAgainstBoleta(rEd20.text, rEd20.evidence.boleta).ok, "guard edit_set: cifras del texto == boleta (con las cifras del ANTES adentro)");
const rAdd20 = go("agrega bodegaje 1%");
const tbA20 = rAdd20 && rAdd20.evidence && rAdd20.evidence.tabla;
ok(tbA20 && tbA20.rows[0].a === "—" && tbA20.rows[0].b === "1%" && tbA20.rows[3].a !== tbA20.rows[3].b, "edit_add: la línea nueva entra como — → 1% y el resultado se mueve");
const rDel20 = go("saca bodegaje");
const tbD20 = rDel20 && rDel20.evidence && rDel20.evidence.tabla;
ok(tbD20 && tbD20.rows[0].a === "1%" && tbD20.rows[0].b === "—" && rDel20.evidence.followup === true, "edit_remove: la línea sale como 1% → — (misma tabla, followup administrativo)");
ok(tb && typeof tb.nota === "string" && /proyectado = tu P&L real a esa venta/.test(tb.nota), "la nota de la VENTA PROYECTADA ahora viaja EN su tabla (data-driven, no hardcodeada en la UI)");
// registro ejecutivo en lo nuevo emitido por las tablas (labels · títulos · notas)
let sucios20 = 0;
for (const tt of [tb20, tbA20, tbD20]) if (tt) for (const s of [tt.titulo, tt.nota, ...tt.rows.map((r) => r.label)]) if (typeof s === "string" && BANNED.test(s)) { sucios20++; console.log(`    ✗ registro roto en tabla: «${s.match(BANNED)[0]}»`); }
ok(sucios20 === 0, "registro ejecutivo limpio en las tablas ANTES|AHORA");
clearPnl(); resetPnlDraft();

console.log("[21] PREGUNTAS CLAVE DEL INICIO · la historia del P&L + ADI guía los supuestos en el chat");
clearPnl(); resetPnlDraft();
const rPd0 = go("¿dónde estoy perdiendo dinero?", false);
ok(rPd0 && /Te muestro dónde está el dinero/.test(rPd0.text) && /me falta un dato tuyo: tus gastos/.test(rPd0.text) && rPd0.evidence.tablaM && rPd0.evidence.tablaM.rows[0].label === "Venta del año", "sin P&L: la historia LLANA + la cuenta parcial EN LA TABLA + la GUÍA de supuestos", rPd0 && rPd0.text.slice(0, 80));
ok(pnlDraft() && pnlDraft().stage === "gastos", "…y el flujo guiado queda ABIERTO (el próximo mensaje con gastos fluye)");
const rPd1 = go("administrativos, logística 3% y promotores 2%");
ok(rPd1 && /Anotado/.test(rPd1.text), "los gastos nombrados tras la pregunta clave SIGUEN el flujo (guía real)");
const rPd2 = go("administrativos al 1%");
ok(rPd2 && /¿Lo sello\?/.test(rPd2.text), "…% completados → propuesta de sello");
ok(/Sellado/.test((go("sí") || {}).text || ""), "…y sella: la conversación de la pregunta clave termina en P&L armado");
const rPd3 = go("¿dónde estoy perdiendo dinero?", false);
const cPd = buildPnlCascade("bonanza");
ok(rPd3 && /^\*\*Te quedan /.test(rPd3.text) && rPd3.text.includes(_moneyK(cPd.resultadoK)) && rPd3.evidence.tablaM.rows.some((r) => r.label === "Ingreso" && r.values[0] === _moneyK(cPd.ingresoK)), "con P&L: la historia abre con lo que TE QUEDA y la cascada completa va en la tabla");
ok(guardAgainstBoleta(rPd3.text, rPd3.evidence.boleta).ok, "guard pregunta clave: cifras == boleta");
for (const s2 of (rPd3.suggestions || [])) { const cs5 = CF(s2, false, null); ok(!!cs5, `chip de la historia reclama: «${s2}»`); }
const rChip1 = AC({ schemaVersion: 1, turn_type: "pnl_setup", pnl: { action: "perdiendo" } }, {}, { scenario: "bonanza" });
ok(rChip1 && /^\*\*Te quedan /.test(rChip1.text), "chip «¿Cómo viene el P&L de mi negocio?» (enlatado) → la historia");
const rChip2 = AC({ schemaVersion: 1, turn_type: "pnl_setup", pnl: { action: "resultado" } }, {}, { scenario: "bonanza" });
ok(rChip2 && /^Tu resultado comercial:/.test(rChip2.text), "chip «¿Cuánto me queda después de gastos?» (enlatado) → el resultado");
const rChipD = AC({ schemaVersion: 1, scenario: "actual", filters: {}, operation: "diagnose", dimension: "cliente", metric: "contribucion" }, {}, { scenario: "bonanza" });
ok(rChipD && !/^spec_blocked/.test(rChipD.route || "") && String(rChipD.text || "").length > 0, "los specs de operación enlatados siguen válidos por answerConversational (submitSpec)");
const sTyped21 = CS("¿cómo viene el p&l de mi negocio?", S({}), false, null);
ok(sTyped21.pnl && sTyped21.pnl.action === "perdiendo", "tipeado «¿cómo viene el p&l de mi negocio?» → la misma historia");
clearPnl(); resetPnlDraft();
void go("¿Cómo queda mi resultado comercial?", false);
ok(pnlDraft() && pnlDraft().stage === "gastos", "toda lectura sin P&L abre la guía (sinPnl → draft gastos)");
const rHelp21 = go("¿Armamos tu P&L ahora?");
ok(rHelp21 && /nombres son tuyos|Nómbralos/.test(rHelp21.text), "«¿armamos tu P&L ahora?» DENTRO del flujo → re-guía (draft_help · espejo)");
clearPnl(); resetPnlDraft();
setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }]);
const sPdM = CS("¿dónde estoy perdiendo margen?", S({}), false, null);
ok(sPdM.turn_type !== "pnl_setup", "«perdiendo MARGEN» no es del P&L (el margen conserva su dominio)");
// ACUSE EN EL FLUJO (owner cazó en vivo 2026-07-26: «ok. que necesitas» tras abrir la guía → fallback narrado
// genérico, hilo perdido): dentro del flujo, el acuse re-guía la etapa — JAMÁS suelta.
clearPnl(); resetPnlDraft();
void go("¿dónde estoy perdiendo dinero?", false);   // abre la guía (etapa gastos)
const rAck1 = go("ok. que necesitas");
ok(rAck1 && /nombres son tuyos|Nómbralos/.test(rAck1.text) && pnlDraft() && pnlDraft().stage === "gastos", "«ok. que necesitas» (sin signo de pregunta) → re-guía los gastos, no suelta el hilo", rAck1 && `[${rAck1.route}] ${rAck1.text.slice(0, 60)}`);
const rAck2 = go("sí");
ok(rAck2 && /nombres son tuyos|Nómbralos/.test(rAck2.text), "«sí» pelado en la etapa gastos → re-guía (no followup_accept)");
void go("seguros, fletes y comisiones");
const rAck3 = go("ok");
ok(rAck3 && /me falta el %|Seguimos con tu P&L/.test(rAck3.text) && pnlDraft().stage === "pcts", "«ok» en la etapa de % → re-pregunta los % pendientes");
void go("2, 1, 1.5");
const rAck4 = go("listo");
ok(rAck4 && /^Sellado — /.test(rAck4.text), "«listo» en la etapa de sello → SELLA (el acuse de cierre afirma, no re-guía)");
clearPnl(); resetPnlDraft();

console.log("[22] DEEP-LINK · «Ampliar en Sentrix» de una respuesta P&L → la Mesa en la cara Resultado con SU alcance");
clearPnl(); resetPnlDraft();
setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }]);
const rSc22 = go("P&L de Falabella", false);
const lk22 = pnlMesaLink(rSc22.evidence);
ok(lk22 && lk22.cara === "resultado" && lk22.eje === "cliente" && lk22.foco && lk22.foco.nombre === "Falabella" && lk22.foco.eje === "cliente",
  "lectura scoped → link a la cara Resultado con la entidad en foco (eje cliente)", JSON.stringify(lk22));
const mrL22 = buildMesaResultado("bonanza", lk22.eje, lk22.foco);
ok(mrL22.alcance && mrL22.alcance.nombre === "Falabella" && mrL22.cuadro.eje === "cliente", "…y la Mesa abre ESA cascada (alcance == la entidad de la respuesta)");
ok(mrL22.cascada.find((r) => r.key === "resultado").usdFmt === _moneyK(buildPnlCascade("bonanza", null, { dimension: "cliente" }).porEntidad.find((x) => x.nombre === "Falabella").resultadoK),
  "la fila Resultado de la cascada deep-linkeada == la cifra de la lectura (una verdad)");
const rTab22 = go("P&L por familia", false);
const lkT22 = pnlMesaLink(rTab22.evidence);
ok(lkT22 && lkT22.eje === "familia" && lkT22.foco === null, "tabla del eje → link al cuadro por familia SIN foco (el conjunto, no una fila)");
ok(buildMesaResultado("bonanza", lkT22.eje, lkT22.foco).cuadro.eje === "familia", "…y el cuadro de la Mesa abre en ese eje");
const rEd22 = go("cambia marketing a 2%");
const lkE22 = pnlMesaLink(rEd22.evidence);
ok(lkE22 && lkE22.cara === "resultado" && lkE22.foco === null, "la edición (followup:true + tabla ANTES|AHORA) también deep-linkea — cara Resultado global");
ok(pnlMesaLink(null) === null && pnlMesaLink({}) === null && pnlMesaLink({ pairs: [{ label: "Ventas" }], compareA: "A", compareB: "B" }) === null && pnlMesaLink({ lens: "mesa", periodo: "bonanza" }) === null,
  "evidencia NO-P&L (compare · mesa del header · nula) → null: los paneles clásicos intactos");
const mrBad22 = buildMesaResultado("bonanza", "cliente", { eje: "cliente", nombre: "NoExiste SA" });
ok(mrBad22.defined && !mrBad22.alcance && mrBad22.cascada.find((r) => r.key === "resultado"), "entidad desconocida en el link → cascada global (jamás una vista rota)");
clearPnl(); resetPnlDraft();

console.log("[23] EXPORT/COPIAR de la cara Resultado (mejora 8 · lo que se ve sale a Excel, una verdad)");
clearPnl(); resetPnlDraft();
const { pnlExportData } = M;
ok(pnlExportData("bonanza") === null, "sin P&L sellado no hay export (null honesto)");
setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }]);
const ex = pnlExportData("bonanza");
const mrX = buildMesaResultado("bonanza");
ok(ex && ex.tsv.startsWith("P&L comercial · el negocio completo") && ex.filename === "pnl-comercial-cliente.csv", "cabecera con el alcance + filename por eje", ex && ex.filename);
const filas = ex.tsv.split("\n");
const filaFal = filas.find((l) => l.startsWith("Falabella\t"));
const rowFalX = mrX.cuadro.rows.find((r) => r.name === "Falabella");
ok(filaFal && filaFal.split("\t")[1] === String(Math.round(rowFalX.venta * 1000)) && filaFal.split("\t")[5] === String(Math.round(rowFalX.resultado * 1000)), "la fila exportada == el cuadro (USD crudos, sumables)");
const filaTot = filas.find((l) => l.startsWith("Total\t"));
ok(filaTot && filaTot.split("\t")[5] === String(Math.round(mrX.cuadro.total.resultado * 1000)), "el Total exportado == el resultado del negocio");
ok(mrX.cascada.every((r) => ex.tsv.includes(r.usdFmt)) && /supuesto declarado/.test(ex.tsv) && /Hasta la contribución todo es dato del negocio/.test(ex.tsv), "la cascada viaja con su graduación declarada (honestidad en el archivo)");
const exF = pnlExportData("bonanza", "familia", { eje: "familia", nombre: "Cuidado Personal" });
ok(exF && /alcance: Cuidado Personal/.test(exF.tsv) && exF.filename === "pnl-comercial-cuidado-personal.csv" && /Familia\t/.test(exF.tsv), "export scoped: exporta LO QUE SE VE (foco + eje familia)");
const exCsv = ex.csv.split("\n").find((l) => l.startsWith("Falabella,"));
ok(!!exCsv && exCsv.split(",").length === 7, "el CSV separa las 7 columnas del cuadro");
ok(!BANNED.test(ex.tsv) && !BANNED.test(exF.tsv), "registro ejecutivo también en el archivo exportado");
clearPnl(); resetPnlDraft();

/* ══ LOS 3 GAPS DEL SELLO (owner 2026-07-26 verbatim: "cuando me dice lo sello, debería darme el análisis como
 * lo tenemos en contrato, y en Sentrix permitirme verlo ordenado y con los supuestos con opción de cambiarlos") ══ */
const { editPnlLine, removePnlLine, addPnlLine, pnlExplain, pnlRecommend } = M;

console.log("[24] EL SELLO ENTREGA EL ANÁLISIS · acuse de una línea + la lectura completa (una verdad)");
clearPnl(); resetPnlDraft();
void go("armemos mi p&l", false);
void go("logística, marketing y promotores");
void go("3, 1.5, 2");
const rSello24 = go("sí");
const rRes24 = composePnl({ action: "resultado" }, null, { scenario: "bonanza" });
ok(rSello24 && /^Sellado — /.test(rSello24.text) && rSello24.text.split("\n")[0].length < 160, "acuse de UNA línea al inicio («Sellado — …»)", rSello24 && rSello24.text.split("\n")[0]);
ok(rSello24 && rSello24.text.endsWith(rRes24.text), "…y de ahí EL ANÁLISIS COMPLETO, byte-igual a «¿cómo queda mi resultado comercial?» (sin pedir «muéstramelo» aparte)");
// migrado 2026-07-26 (fix del sello): la simulación sugerida vive en los chips; el texto cierra en DECISIÓN
ok(rSello24.evidence.tablaM && rSello24.evidence.tablaM.rows.some((r) => r.label === "Resultado comercial" && r.strong) && /De cada \$100 de venta/.test(rSello24.text) && /Dónde actuar primero: /.test(rSello24.text) && /¿Partimos por /.test(rSello24.text), "el sello trae la cascada EN LA TABLA + el porqué con drivers + la acción priorizada y el cierre en decisión — el contrato entero");
ok(/Hasta la contribución es dato probado; los gastos son supuestos declarados/.test(rSello24.text), "la graduación (probado vs supuesto declarado) viaja en el propio sello");
ok(guardAgainstBoleta(rSello24.text, rSello24.evidence.boleta).ok, "guard sello: cifras == boleta", guardAgainstBoleta(rSello24.text, rSello24.evidence.boleta).reason);
ok(rSello24.evidence.followup === false && rSello24.evidence.pnl === true, "el sello emite evidencia ACCIONABLE (threadea el hilo como toda lectura)");
// los chips del sello ahora incluyen los frentes del detector (carga/margen) — resuelven por la cadena, no
// necesariamente como pnl_setup (la ask de carga es del foco de carga: correcto, es el puente al detector)
for (const s2 of (rSello24.suggestions || [])) {
  const cs6 = CF(s2, false, null);
  const r6 = cs6 ? AC(cs6, {}, { scenario: "bonanza" }) : null;
  ok(!!(r6 && String(r6.text || "").trim() && !/^spec_blocked_/.test(r6.route || "") && !ROTA_RE.test(r6.text.trim())), `chip del sello responde por la cadena: «${s2}»`, r6 && `[${r6.route}] ${String(r6.text || "").slice(0, 60)}`);
}

console.log("[25] TODA LECTURA P&L lleva evidencia con lens → deep-link a la cara Resultado");
setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }]); resetPnlDraft();
const SC25 = { scenario: "bonanza" };
const lecturas25 = [
  ["sello", rSello24],
  ["resultado", composePnl({ action: "resultado" }, null, SC25)],
  ["perdiendo", composePnl({ action: "perdiendo" }, null, SC25)],
  ["peso", composePnl({ action: "peso" }, null, SC25)],
  ["scoped", composePnl({ action: "resultado_scoped", entidad: "Falabella", eje: "cliente", covered: true }, null, SC25)],
  ["tabla_eje", composePnl({ action: "tabla_eje", eje: "familia" }, null, SC25)],
  ["entidad", composePnl({ action: "resultado_entidad", entidad: "Falabella" }, null, SC25)],
  ["deixis", composePnl({ action: "resultado_deixis", _entities: { entities: ["Ripley", "La Polar"], dimension: "cliente" }, _explicit: true }, null, SC25)],
  ["proyección", composePnl({ action: "proyeccion_venta", ventaK: 120000, negocio: true }, null, SC25)],
  ["simulate global", composePnl({ action: "simulate_line", nombre: "Logística", pct: 2 }, null, SC25)],
  ["simulate scoped", composePnl({ action: "simulate_line", nombre: "Logística", pct: 2, entidad: "Falabella", eje: "cliente" }, null, SC25)],
  ["meta global", composePnl({ action: "meta_venta", targetK: 18000 }, null, SC25)],
  ["meta scoped", composePnl({ action: "meta_venta", targetK: 500, entidad: "Falabella", eje: "cliente" }, null, SC25)],
  ["explica simple", pnlExplain({ pnl: true, entidad: "Falabella", entityType: "cliente" }, null, SC25)],
  ["decisiones", pnlRecommend({ pnl: true }, null, SC25)],
];
for (const [tag25, r25] of lecturas25) {
  const lk25 = r25 && pnlMesaLink(r25.evidence);
  ok(!!lk25 && lk25.cara === "resultado", `lectura «${tag25}» → deep-link a la cara Resultado`, r25 ? JSON.stringify(r25.evidence && { followup: r25.evidence.followup, pnl: r25.evidence.pnl }) : "sin respuesta");
}
const lkSc25 = pnlMesaLink(composePnl({ action: "resultado_scoped", entidad: "Falabella", eje: "cliente", covered: true }, null, SC25).evidence);
ok(lkSc25 && lkSc25.foco && lkSc25.foco.nombre === "Falabella" && lkSc25.eje === "cliente", "…y la scoped viaja con SU foco (la Mesa abre en esa entidad)");
const lkTb25 = pnlMesaLink(composePnl({ action: "tabla_eje", eje: "familia" }, null, SC25).evidence);
ok(lkTb25 && lkTb25.eje === "familia" && lkTb25.foco === null, "…y la tabla con SU eje (el cuadro abre por familia, sin foco)");

console.log("[26] EDITAR DESDE LA CARA == EDITAR POR CHAT · misma primitiva, criterio byte-igual");
const base26 = [{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }];
setPnlLines(base26); resetPnlDraft();
void go("cambia logística a 2%");
const chatSet26 = JSON.stringify(activePnl());
setPnlLines(base26);
const rE26 = editPnlLine("Logística", 2);
ok(rE26.ok && rE26.prev === 3 && JSON.stringify(activePnl()) === chatSet26, "editar el % desde la cara deja el criterio BYTE-IGUAL al del chat");
ok(editPnlLine("Logística", "2,5").ok && activePnl().find((l) => l.nombre === "Logística").pct === 2.5, "el input acepta coma decimal (2,5 → 2.5)");
setPnlLines(base26);
void go("saca marketing");
const chatDel26 = JSON.stringify(activePnl());
setPnlLines(base26);
ok(removePnlLine("Marketing").ok && JSON.stringify(activePnl()) === chatDel26, "sacar desde la cara == sacar por chat (byte-igual)");
setPnlLines(base26);
void go("agrega bodegaje 1%");
const chatAdd26 = JSON.stringify(activePnl());
setPnlLines(base26);
ok(addPnlLine("bodegaje", "1").ok && JSON.stringify(activePnl()) === chatAdd26, "agregar desde la cara == agregar por chat (byte-igual, mismo _cap)");
setPnlLines(base26);
ok(!editPnlLine("Logística", 80).ok && activePnl().find((l) => l.nombre === "Logística").pct === 3, "% fuera de rango desde la cara → NO guarda (mismo guard del chat)");
ok(!editPnlLine("Inexistente", 2).ok && !removePnlLine("Inexistente").ok, "línea inexistente → honesto, sin efecto");
ok(!addPnlLine("ventas", 2).ok && !addPnlLine("Logística", 2).ok && activePnl().length === 3, "métrica del dato y duplicada rechazadas (mismas reglas del chat)");
setPnlLines([{ nombre: "Única", pct: 2 }]);
const rDel26 = removePnlLine("Única");
ok(rDel26.ok && rDel26.vacio === true && activePnl().length === 0, "sacar la última línea vacía el P&L (mismo clearPnl del chat)");
setPnlLines(base26);
const mr26 = buildMesaResultado("bonanza");
ok(mr26.cascada.filter((r) => r.kind === "supuesto").every((r) => r.edit && typeof r.edit.nombre === "string" && typeof r.edit.pct === "number"), "cada línea supuesto de la cascada lleva su `edit` (el contrato de la UI)");
const mrF26 = buildMesaResultado("bonanza", "cliente", { eje: "cliente", nombre: "Falabella" });
ok(mrF26.alcance && mrF26.cascada.filter((r) => r.kind === "supuesto").every((r) => r.edit && r.edit.pct > 0), "…también en la cascada scopeada (el % editado es el criterio global)");
// registro ejecutivo en lo nuevo del sello
let sucios26 = 0;
for (const [tag26, t26] of [["sello", rSello24.text], ...(rSello24.suggestions || []).map((s) => ["sello·sug", s])])
  if (typeof t26 === "string" && BANNED.test(t26)) { sucios26++; console.log(`    ✗ registro roto en ${tag26}: «${t26.match(BANNED)[0]}»`); }
ok(sucios26 === 0, "registro ejecutivo limpio en el sello nuevo");
clearPnl(); resetPnlDraft();

console.log("[27] HISTORIA PRIMERO (owner 2026-07-26: 'ADI cuenta la historia; Sentrix muestra el dato') · la cascada viaja en la TABLA");
setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }]); resetPnlDraft();
const c27 = buildPnlCascade("bonanza");
const r27res = composePnl({ action: "resultado" }, null, { scenario: "bonanza" });
const r27per = composePnl({ action: "perdiendo" }, null, { scenario: "bonanza" });
const r27sc = composePnl({ action: "resultado_scoped", entidad: "Falabella", eje: "cliente", covered: true }, null, { scenario: "bonanza" });
const r27tab = composePnl({ action: "tabla_eje", eje: "familia" }, null, { scenario: "bonanza" });
const r27ex = pnlExplain({ pnl: true }, null, { scenario: "bonanza" });
// (a) el TEXTO ya no enumera la cascada — narra qué significa y decide (regla madre)
for (const [tag27, r27] of [["resultado", r27res], ["perdiendo", r27per], ["scoped", r27sc]])
  ok(!/\n· (Ingreso|Venta del año):/.test(r27.text), `«${tag27}»: la enumeración de la cascada SALIÓ del texto (historia, no dato)`);
ok(/queda contigo después del costo, la carga comercial y tus gastos declarados/.test(r27res.text), "«resultado» narra QUÉ SIGNIFICA la cifra (asesor, en llano)");
// migrado 2026-07-26 (fix del sello): el cierre vago «¿Bajamos a un frente?» murió — ahora decide entre frentes con $
ok(/^\*\*Te quedan /.test(r27per.text) && /¿Partimos por /.test(r27per.text), "«perdiendo» abre con lo que te queda y cierra en la decisión ejecutiva del contrato");
// (b) la cascada completa viaja ESTRUCTURADA y el despachador la manda a la UI (tabla_matriz)
for (const [tag27, r27] of [["resultado", r27res], ["perdiendo", r27per], ["scoped", r27sc], ["tabla_eje", r27tab], ["explica", r27ex]]) {
  const cs27 = chartForEvidence(r27.evidence);
  ok(!!cs27 && cs27.tipo === "tabla_matriz" && cs27.tabla === r27.evidence.tablaM, `«${tag27}» despacha SU tabla a la UI (tabla_matriz)`);
}
const tm27 = r27res.evidence.tablaM;
ok(tm27.head === "Concepto" && tm27.rows.map((r) => r.label).join("|") === `Ingreso|Costo|Margen bruto|Carga comercial|Contribución|${c27.lines.map((l) => l.nombre).join("|")}|Resultado comercial|Resultado sobre venta`, "la tabla trae la cascada ENTERA en orden (una verdad)", tm27.rows.map((r) => r.label).join("|"));
ok(tm27.rows.find((r) => r.label === "Ingreso").values[0] === _moneyK(c27.ingresoK) && tm27.rows.find((r) => r.label === "Resultado comercial").values[0] === _moneyK(c27.resultadoK) && tm27.rows.find((r) => r.label === "Resultado comercial").strong === true, "las celdas citan la única verdad · Resultado destacado");
ok(c27.lines.every((l) => { const r = tm27.rows.find((x) => x.label === l.nombre); return r && /^supuesto (declarado|del perfil) · \d/.test(r.nota || ""); }), "GRADUACIÓN en la tabla: cada gasto lleva su nota de supuesto (mismo lenguaje de la cara)");
ok(typeof tm27.nota === "string" && /probado hasta la contribución/.test(tm27.nota) && /cierra exacto/.test(tm27.nota), "la tabla declara su graduación al pie");
// (c) el sello viaja con LA MISMA tabla (una verdad con la lectura)
ok(JSON.stringify(rSello24.evidence.tablaM ? Object.keys(rSello24.evidence.tablaM) : null) === JSON.stringify(Object.keys(tm27)), "el sello lleva la misma estructura de tabla que la lectura");
// (d) tabla por eje: filas EN LA TABLA con Total == negocio (Σ exacto visible)
const tE27 = r27tab.evidence.tablaM;
const tot27 = tE27.rows.find((r) => r.label === "Total");
ok(tE27.head === "Familia" && tE27.cols.join("|") === "Venta|Gastos|Resultado|Res. %" && tot27 && tot27.strong && tot27.values[2] === _moneyK(c27.resultadoK), "el cuadro por familia: columnas claras + Total == resultado del negocio");
// (e) la cascada scoped ancla las cifras DE la entidad (mismas anclas del motor)
const eF27 = buildPnlCascade("bonanza", null, { dimension: "cliente" }).porEntidad.find((x) => x.nombre === "Falabella");
ok(r27sc.evidence.tablaM.rows.find((r) => r.label === "Resultado comercial").values[0] === _moneyK(eF27.resultadoK), "la tabla scoped == la cifra de la entidad (una verdad)");
// (f) el mes a mes (mejora 7) queda intacto: una tablaM sin campos nuevos despacha igual
ok(chartForEvidence({ tablaM: { titulo: "Mes a mes", cols: ["2026"], rows: [{ label: "Ene", values: ["$1K"] }] } }).tipo === "tabla_matriz", "la tabla matriz clásica (mes a mes) despacha byte-igual (extensión aditiva)");
// (g) registro ejecutivo en lo nuevo (textos + labels y notas de las tablas)
let sucios27 = 0;
const scan27 = (tag, t) => { if (typeof t === "string" && BANNED.test(t)) { sucios27++; console.log(`    ✗ registro roto en ${tag}: «${t.match(BANNED)[0]}»`); } };
for (const [tag27, r27] of [["resultado", r27res], ["perdiendo", r27per], ["scoped", r27sc], ["tabla_eje", r27tab]]) {
  scan27(tag27, r27.text);
  const t27 = r27.evidence.tablaM;
  if (t27) { scan27(`${tag27}·titulo`, t27.titulo); scan27(`${tag27}·nota`, t27.nota); for (const r of t27.rows) { scan27(`${tag27}·row`, r.label); scan27(`${tag27}·rownota`, r.nota || ""); } }
}
ok(sucios27 === 0, "registro ejecutivo limpio en la historia y las tablas");
clearPnl(); resetPnlDraft();

/* ══ [28] EL SELLO DEL CONTRATO EN TODA LECTURA P&L (auditoría del owner 2026-07-26: el movimiento 2 había
 * desaparecido y el 3 no priorizaba · cierre vago vetado) — LO PERMANENTE: ninguna sesión futura puede romper
 * la estructura sin romper este gate. Por lectura (global y scoped) × 3 escenarios:
 *   mov 1 · abre con SU cifra (== la card / la fila del cuadro)
 *   mov 2 · el porqué con los DRIVERS de la cascada («de cada $100…», valores exactos) + graduación
 *   mov 3 · la acción PRIORIZADA por $ (la mayor entre detector carga · detector margen · línea dominante,
 *           recomputada acá de la MISMA fuente) + el cierre en decisión («¿Partimos por…?»)
 *   + registro ejecutivo limpio + guard boleta + toda ask emitida responde por la cadena. ══ */
console.log("[28] SELLO DEL CONTRATO en toda lectura P&L · 3 movimientos + priorización + registro + guard (×3 escenarios)");
const { composeSpecDiagnose } = M;
const _p1 = (v) => String(Math.round(v * 10) / 10);
const _d100g = (v) => `$${_p1(Math.abs(v))}`;
const RE_M2G = /¿Qué explica ese resultado\? De cada \$100 de venta/;
const RE_M2E = /De cada \$100 que factura/;
const RE_CIERRE = /¿Partimos por /;
const asks28 = new Map();   // ask → { tag, sc } (dedupe global · cada una se prueba EN EL ESCENARIO que la emitió)
const put28 = (r, tag, sc) => { for (const s of (r.suggestions || [])) if (s && !asks28.has(s)) asks28.set(s, { tag, sc }); };
for (const sc of ["bonanza", "tension", "crisis"]) {
  setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }]); resetPnlDraft();
  const c28 = buildPnlCascade(sc);
  const mr28 = buildMesaResultado(sc);
  const F28 = (() => { try { const d = composeSpecDiagnose({ filters: {}, scenario: sc }); return (d && d.evidence && d.evidence.findings) || []; } catch { return []; } })();
  const cg28 = F28.find((f) => f.detector === "carga") || null, mg28 = F28.find((f) => f.detector === "margen") || null;
  const top28 = c28.gastos.slice().sort((x, y) => y.usdK - x.usdK)[0];
  const maxUsd28 = Math.max(cg28 ? cg28.subtotal_usd : 0, mg28 ? mg28.subtotal_usd : 0, top28.usdK * 1000);
  // ── GLOBAL · resultado + perdiendo (el sello == resultado byte-igual, [24] lo cubre) ──
  for (const [tag, r] of [["resultado", composePnl({ action: "resultado" }, null, { scenario: sc })], ["perdiendo", composePnl({ action: "perdiendo" }, null, { scenario: sc })]]) {
    const t = r.text;
    ok(tag === "resultado" ? t.startsWith(`Tu resultado comercial: ${mr28.resultado.usdFmt}`) : t.startsWith(`**Te quedan ${_moneyK(c28.resultadoK)}`), `${sc}/${tag} · mov 1: abre con la cifra de la card`, t.slice(0, 60));
    const drivers = [_d100g((c28.costoK / c28.ingresoK) * 100), _d100g((c28.cargaK / c28.ingresoK) * 100), _d100g(c28.sumPct)];
    ok(RE_M2G.test(t) && drivers.every((d) => t.includes(d)), `${sc}/${tag} · mov 2: el porqué con LOS DRIVERS exactos de la cascada (${drivers.join(" · ")})`, t.slice(0, 200));
    ok(/dato probado/.test(t) && /supuestos declarados/.test(t), `${sc}/${tag} · mov 2: graduación presente (probado vs supuesto)`);
    ok(/Dónde actuar primero: /.test(t) && RE_CIERRE.test(t), `${sc}/${tag} · mov 3: acción primero + cierre en decisión`);
    const cierre28 = t.split("\n").pop();
    ok(cierre28.includes(`(${_money(maxUsd28)})`), `${sc}/${tag} · mov 3: la decisión cita EL FRENTE MAYOR (${_money(maxUsd28)}) — priorización por $`, cierre28);
    const g28 = guardAgainstBoleta(t, r.evidence.boleta);
    ok(g28.ok, `${sc}/${tag} · guard: cifras == boleta`, g28.reason);
    ok(!BANNED.test(t), `${sc}/${tag} · registro ejecutivo limpio`, (t.match(BANNED) || [])[0]);
    put28(r, `${sc}/${tag}`, sc);
  }
  // ── SCOPED · TODA cuenta de la base + una familia (el sello proporcional: su cifra · sus drivers · SU acción) ──
  const ents28 = [...c28.porEntidad.map((e) => ({ e, eje: "cliente" })),
    ...buildPnlCascade(sc, null, { dimension: "familia" }).porEntidad.slice(0, 1).map((e) => ({ e, eje: "familia" }))];
  for (const { e, eje } of ents28) {
    const r = composePnl({ action: "resultado_scoped", entidad: e.nombre, eje, covered: true }, null, { scenario: sc });
    const t = r.text;
    ok(t.startsWith(`**El P&L de ${e.nombre}: te deja ${_moneyK(e.resultadoK)} al año**`), `${sc}/scoped ${e.nombre} · mov 1: abre con SU cifra`, t.slice(0, 70));
    ok(RE_M2E.test(t) && t.includes(_d100g((e.costoK / e.ventaK) * 100)) && t.includes(_d100g((e.cargaK / e.ventaK) * 100)), `${sc}/scoped ${e.nombre} · mov 2: sus drivers exactos (por qué rinde distinto al promedio)`);
    ok(/dato probado/.test(t) && /prorrateados/.test(t), `${sc}/scoped ${e.nombre} · mov 2: graduación del prorrateo`);
    ok(new RegExp(`Dónde actuar en ${e.nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: `).test(t) && RE_CIERRE.test(t), `${sc}/scoped ${e.nombre} · mov 3: la acción de ESA cuenta + cierre en decisión`);
    // priorización de la cuenta: el $ citado en el cierre es el MAYOR entre sus detectores y su línea dominante
    const it28 = (det) => { const f = F28.find((x) => x.detector === det); const it = f && eje === "cliente" && f.items.find((i) => i.entidad === e.nombre); return it ? it.usd : 0; };
    const maxE28 = Math.max(it28("carga"), it28("margen"), (e.ventaK * top28.pct / 100) * 1000);
    ok(t.includes(`¿Partimos por ahí (${_money(maxE28)})`), `${sc}/scoped ${e.nombre} · mov 3: prioriza por $ (${_money(maxE28)})`, t.split("\n").pop());
    const gE28 = guardAgainstBoleta(t, r.evidence.boleta);
    ok(gE28.ok, `${sc}/scoped ${e.nombre} · guard: cifras == boleta`, gE28.reason);
    ok(!BANNED.test(t), `${sc}/scoped ${e.nombre} · registro limpio`, (t.match(BANNED) || [])[0]);
    put28(r, `${sc}/scoped-${e.nombre}`, sc);
  }
  // ── ENTIDAD (la forma corta «¿cuánto deja X?») · mismo sello proporcional ──
  for (const [ent28, eje28] of [["Falabella", "cliente"], ["Cuidado Personal", "familia"]]) {
    const r = composePnl({ action: "resultado_entidad", entidad: ent28, eje: eje28 }, null, { scenario: sc });
    const t = r.text;
    ok(new RegExp(`^Después de gastos, ${ent28} deja `).test(t) && RE_M2E.test(t) && /Dónde actuar en /.test(t) && RE_CIERRE.test(t), `${sc}/entidad ${ent28}: los 3 movimientos en la forma corta`, t.slice(0, 80));
    const gN28 = guardAgainstBoleta(t, r.evidence.boleta);
    ok(gN28.ok && !BANNED.test(t), `${sc}/entidad ${ent28}: guard + registro`, gN28.reason || (t.match(BANNED) || [])[0]);
    put28(r, `${sc}/entidad-${ent28}`, sc);
  }
}
// ── toda ask emitida por las lecturas del sello RESPONDE por la cadena, en SU escenario (0 rotas) ──
let rotas28 = 0;
for (const [texto, { tag, sc }] of asks28) {
  let motivo = null;
  try {
    const cs = CF(texto, false, null);
    if (!cs) motivo = "coerceFloor null";
    else {
      const r = AC(cs, {}, { scenario: sc });
      const t = (r && r.text) || "";
      if (!t.trim() || /^spec_blocked_/.test(r.route || "") || ROTA_RE.test(t.trim())) motivo = `[${r && r.route}] ${t.slice(0, 70)}`;
    }
  } catch (e) { motivo = "THROW " + String(e && e.message).slice(0, 60); }
  if (motivo) { rotas28++; console.log(`    ✗ ask ROTA «${texto}» (${tag}) → ${motivo}`); }
}
ok(rotas28 === 0, `${asks28.size} asks emitidas por las lecturas del sello responden por la cadena (0 rotas)`);
clearPnl(); resetPnlDraft();

console.log("[29] F4 · LA VOZ DEL P&L (lecturas narrables kind 'pnl' · piso det intacto · administrativas verbatim)");
{
  const { shouldNarrate: SN29, pickNarratedText: PN29, buildNarrateSystem: BNS29 } = M;
  clearPnl(); resetPnlDraft();
  setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }]);
  // ── el texto plano de una tablaM (labels + valores + notas) para probar cobertura de boleta ──
  const tablaTxt = (tm) => !tm ? "" : [tm.titulo, tm.nota, ...(tm.rows || []).flatMap((r) => [r.label, r.nota, ...(r.values || []), r.a, r.b])].filter(Boolean).join(" · ");
  // ── LAS LECTURAS: kind "pnl" narrable · boleta cubre texto Y tabla · guard-reject cae al piso byte-igual ──
  const LECTURAS29 = [
    ["resultado global", () => composePnl({ action: "resultado" }, null, { scenario: "bonanza" })],
    ["perdiendo (la historia)", () => composePnl({ action: "perdiendo" }, null, { scenario: "bonanza" })],
    ["scoped cliente", () => composePnl({ action: "resultado_scoped", entidad: "Falabella", eje: "cliente", covered: true }, null, { scenario: "bonanza" })],
    ["scoped familia", () => composePnl({ action: "resultado_scoped", entidad: "Cuidado Personal", eje: "familia", covered: true }, null, { scenario: "tension" })],
    ["tabla por eje", () => composePnl({ action: "tabla_eje", eje: "familia" }, null, { scenario: "bonanza" })],
    ["deixis (conjunto)", () => composePnl({ action: "resultado_deixis", _entities: { entities: ["Falabella", "Ripley"], dimension: "cliente" }, _explicit: true }, null, { scenario: "bonanza" })],
    ["entidad (forma corta)", () => composePnl({ action: "resultado_entidad", entidad: "Jumbo", eje: "cliente" }, null, { scenario: "bonanza" })],
    ["peso de líneas", () => composePnl({ action: "peso" }, null, { scenario: "bonanza" })],
  ];
  for (const [tag, mk] of LECTURAS29) {
    const r = mk();
    ok(r.evidence && r.evidence.kind === "pnl" && r.evidence.pnl === true && r.evidence.followup === false,
      `${tag}: kind "pnl" narrable (pnl:true · followup:false — threading intacto)`, r.evidence && r.evidence.kind);
    ok(SN29(r) === true, `${tag}: shouldNarrate la deja pasar (sin tocar numberGuard.js)`);
    const gT = guardAgainstBoleta(tablaTxt(r.evidence.tablaM), r.evidence.boleta);
    ok(gT.unauthorized.length === 0, `${tag}: la boleta cubre el UNIVERSO de la tabla renderizada (0 fuera)`, gT.unauthorized.join(","));
    const pOK = PN29(r, r.text);
    ok(pOK.narrated === true, `${tag}: el propio piso pasa la cadena de guards (boleta completa · self-consistente)`, pOK.reason);
    const pBad = PN29(r, "Con estos supuestos el resultado que te queda es $999.9B al año.");
    ok(pBad.narrated === false && pBad.text === r.text, `${tag}: guard-reject → sale EL PISO determinístico byte-igual (la red)`);
  }
  // el análisis post-sello también narra (draft completo → sello → kind "pnl")
  clearPnl(); resetPnlDraft();
  const s1 = go("Armemos mi P&L", false); void s1;
  go("logística 3%, marketing 1.5%");
  const rSello = go("sí");
  ok(rSello && /^Sellado — /.test(rSello.text) && rSello.evidence.kind === "pnl" && SN29(rSello) === true,
    "el análisis post-sello narra (kind 'pnl') y el acuse 'Sellado —' sigue en el piso");
  const pSello = PN29(rSello, rSello.text);
  ok(pSello.narrated === true, "post-sello: el piso pasa su propia boleta (self-consistente)", pSello.reason);
  // ── LA DIRECTIVA: el system del narrador para kind "pnl" trae el arco del sello + la doctrina ──
  const sys29 = BNS29(rSello.evidence);
  ok(/ESTRUCTURA DEL P&L COMERCIAL/.test(sys29) && /supuesto declarado/.test(sys29) && /dato probado/.test(sys29),
    "directiva P&L: arco del sello + graduación probado/supuesto declarada INNEGOCIABLE");
  ok(/tablaM/.test(sys29) && /NO la recites/.test(sys29), "directiva P&L: la tabla renderizada NO se recita (la historia es del narrador)");
  ok(/Sellado/.test(sys29) && /REGISTRO FORMAL/.test(sys29), "directiva P&L: el sello se confirma · registro formal");
  ok(!BANNED.test(""), "sanity BANNED");   // el registro de lo EMITIDO lo barren [9]/[28]; la directiva es prompt, no emisión
  // ── EL POST-CHECK DE FRASES (F4 · la doctrina en código, no en prompt — patrón "El perfil"/"El año") ──
  const { ensurePnlNarration: EPN29 } = M;
  const rL29 = composePnl({ action: "resultado" }, null, { scenario: "bonanza" });
  const eG = EPN29("Te quedan $18.5M al año — buen resultado.", rL29.text, rL29.evidence);
  ok(/dato probado/.test(eG) && /supuestos declarados por ti/.test(eG), "post-check: narración SIN graduación → la frase de doctrina se appendea (sin cifras nuevas)");
  const yaOK = "Te quedan $18.5M — hasta la contribución es dato probado y los gastos son supuestos declarados. ¿Partimos por ahí?";
  ok(EPN29(yaOK, rL29.text, rL29.evidence) === yaOK, "post-check: narración que YA declara graduación y cierra preguntando queda intacta");
  const sinQ = EPN29("Te quedan $18.5M y los gastos son supuestos declarados por ti.", rL29.text, rL29.evidence);
  const qDet29 = rL29.text.trim().match(/[^\n]*\?\s*$/)[0].trim();
  ok(sinQ.endsWith(qDet29), "post-check (c): narración sin pregunta final → la DECISIÓN del piso se appendea (cierre del contrato)");
  ok(EPN29("Texto libre.", rL29.text, { kind: "criteria" }) === "Texto libre.", "post-check: fuera del territorio P&L no toca nada");
  const ePerfil = EPN29("Te quedan $11.9M.", "x", { kind: "pnl", tablaM: { rows: [1] }, pnlList: [{ nombre: "Logística", pct: 3, origen: "perfil_empresa" }] });
  ok(/supuestos del perfil de tu empresa/.test(ePerfil), "post-check: con líneas del perfil (lectura con tablaM), la variante honesta del perfil");
  // GUÍA sin tablaM (ya armado / recall): la graduación NO se fuerza (no es una lectura de la cascada)
  const eGuia = EPN29("Tu P&L ya está armado y te deja $20.5M.", "x", { kind: "pnl", pnlList: [{ nombre: "Logística", pct: 3, origen: "supuesto_declarado" }] });
  ok(!/dato probado/.test(eGuia), "post-check: una GUÍA (sin tablaM) no fuerza la graduación de lectura");
  ok(EPN29("Tu resultado quedó firme y los supuestos miden.", rSello.text, rSello.evidence).startsWith("Sellado — "),
    "post-check: narración del sello que no lo confirma → el acuse del piso ANTEPUESTO");
  ok(!EPN29("Sellado quedó tu P&L — tus supuestos ya miden.", rSello.text, rSello.evidence).startsWith("Sellado — tus gastos"),
    "post-check: narración que SÍ confirma el sello no se duplica");
  // ── LAS GUÍAS: administrativas que CONDUCEN (ya armado / recall / forget-con-resultado) → kind "pnl" NARRABLE
  // (el LLM les da voz, el guard cuida las cifras) · followup:true (no threadean) · pnl:true (botón a la Mesa) ──
  clearPnl(); resetPnlDraft();
  setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }]);
  const GUIA29 = [
    ["start (ya armado)", () => composePnl({ action: "start" }, null, { scenario: "bonanza" })],
    ["recall", () => composePnl({ action: "recall" }, null, { scenario: "bonanza" })],
    ["forget (con perfil/resultado)", () => { setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }]); return composePnl({ action: "forget" }, null, { scenario: "bonanza" }); }],
  ];
  for (const [tag, mk] of GUIA29) {
    const r = mk();
    ok(r && r.evidence && r.evidence.kind === "pnl" && r.evidence.followup === true && r.evidence.pnl === true && SN29(r) === true,
      `guía «${tag}»: kind "pnl" NARRABLE (followup:true · pnl:true · no threadea)`, r && r.evidence && `${r.evidence.kind}/fu=${r.evidence.followup}`);
    // el propio piso pasa la cadena de guards (boleta cubre sus cifras · self-consistente)
    const p = PN29(r, r.text);
    ok(p.narrated === true, `guía «${tag}»: el piso pasa sus propios guards`, p.reason);
  }
  // ── LAS ADMINISTRATIVAS/ECO: siguen verbatim kind "criteria" (cada palabra es eco/instrucción exacta) ──
  clearPnl(); resetPnlDraft();
  setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }]);
  const ADMIN29 = [
    ["edit_set", () => composePnl({ action: "edit_set", nombre: "Logística", pct: 2 }, null, { scenario: "bonanza" })],
    ["rearmar", () => { const r = composePnl({ action: "rearmar" }, null, { scenario: "bonanza" }); resetPnlDraft(); return r; }],
    ["simulate de línea", () => composePnl({ action: "simulate_line", nombre: "Marketing", pct: 1 }, null, { scenario: "bonanza" })],
    ["proyección de venta", () => composePnl({ action: "proyeccion_venta", ventaK: 120000, negocio: true }, null, { scenario: "bonanza" })],
    ["meta de venta", () => composePnl({ action: "meta_venta", targetK: 2000 }, null, { scenario: "bonanza" })],
    ["explain P&L-aware", () => pnlExplain({ pnl: true }, null, { scenario: "bonanza" })],
    ["recommend P&L-aware", () => pnlRecommend({ pnl: true }, null, { scenario: "bonanza" })],
    ["redirect eje imposible", () => composePnl({ action: "tabla_eje", eje: "bodega" }, null, { scenario: "bonanza" })],
    ["scoped sin cobertura (Makita)", () => composePnl({ action: "resultado_scoped", entidad: "Makita", eje: "marca", covered: false }, null, { scenario: "bonanza" })],
    ["scoped_missing", () => composePnl({ action: "scoped_missing", pedido: "Walmart" }, null, { scenario: "bonanza" })],
  ];
  for (const [tag, mk] of ADMIN29) {
    const r = mk();
    ok(r && r.evidence && r.evidence.kind === "criteria" && SN29(r) === false,
      `admin/eco «${tag}»: sigue VERBATIM kind "criteria" (shouldNarrate false)`, r && r.evidence && r.evidence.kind);
  }
  // el flujo guiado completo también (gastos → % → boleta del sello: cada eco es del usuario)
  clearPnl(); resetPnlDraft();
  const f1 = go("Armemos mi P&L", false);
  const f2 = go("administrativos, fletes");
  const f3 = go("1, 2");
  ok([f1, f2, f3].every((r) => r && r.evidence.kind === "criteria" && SN29(r) === false),
    "el flujo guiado punta a punta (¿qué gastos? → % → ¿lo sello?) sigue verbatim");
  clearPnl(); resetPnlDraft();
}

console.log("[30] EL CONTRATO DEL P&L · guía, no menú de comandos (owner 2026-07-26: «ADI iba a guiar»)");
{
  const { shouldNarrate: SN30 } = M;
  // NINGUNA respuesta del P&L LISTA comandos-sintaxis entre comillas en el texto: se barre todo el territorio.
  // Un «comando» = comillas angulares con un verbo de mutación adentro («cambia…» «saca…» «agrega…» «olvida…»
  // «armemos…» «séllalo»). Los format-hints de re-pregunta ya no usan esa forma; los chips llevan los pasos.
  const CMD_RE = /[«"']\s*(cambia|saca|sacá|quita|agrega|agregá|añade|olvida|olvidá|borra|arma|armemos|armamos|sella|séllalo|prueba|baja|bajá|sube|subí)\b[^»"']*[»"']/i;
  const casos30 = [];
  clearPnl(); resetPnlDraft();
  setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 2.5 }]);
  const push30 = (tag, r) => casos30.push([tag, r]);
  push30("ya armado", composePnl({ action: "start" }, null, { scenario: "bonanza" }));
  push30("recall", composePnl({ action: "recall" }, null, { scenario: "bonanza" }));
  push30("rearmar", (() => { const r = composePnl({ action: "rearmar" }, null, { scenario: "bonanza" }); resetPnlDraft(); return r; })());
  push30("draft_stay", (() => { composePnl({ action: "rearmar" }, null, { scenario: "bonanza" }); const r = composePnl({ action: "draft_stay" }, null, { scenario: "bonanza" }); resetPnlDraft(); return r; })());
  push30("edit_reask", composePnl({ action: "edit_reask", nombre: "Logística" }, null, { scenario: "bonanza" }));
  push30("edit_add_nopct", composePnl({ action: "edit_add_nopct", nombre: "Fletes" }, null, { scenario: "bonanza" }));
  push30("simulate línea", composePnl({ action: "simulate_line", nombre: "Logística", pct: 2 }, null, { scenario: "bonanza" }));
  push30("fallback (acción desconocida)", composePnl({ action: "____nada" }, null, { scenario: "bonanza" }));
  push30("cordura negativo", (() => { setPnlLines([{ nombre: "Logística", pct: 30 }, { nombre: "Marketing", pct: 25 }]); resetPnlDraft(); const r0 = go("Armemos mi P&L", false); void r0; const r = go("logística 30%, marketing 25%"); return r; })());
  for (const [tag, r] of casos30) {
    const t = (r && r.text) || "";
    ok(!CMD_RE.test(t), `contrato «${tag}»: cero comandos-sintaxis entre comillas en el texto`, (t.match(CMD_RE) || [])[0]);
  }
  // forget con P&L declarado → guía (chip «Armemos mi P&L», no comando en el texto)
  setPnlLines([{ nombre: "Logística", pct: 3 }]);
  const rF30 = composePnl({ action: "forget" }, null, { scenario: "bonanza" });
  ok(!CMD_RE.test(rF30.text) && Array.isArray(rF30.suggestions) && rF30.suggestions.includes("Armemos mi P&L"),
    "contrato «forget»: el próximo paso viaja como CHIP, no como comando en el texto", rF30.text.slice(0, 80));
  clearPnl(); resetPnlDraft();
}

console.log(`\n── _pnl_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
