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
 *  [10] PROTECCIONES · el claim no roba turnos ajenos · "olvidá todo" (criteria) también limpia el P&L */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_plge.js"), out = path.join(root, "_plgb.mjs");
fs.writeFileSync(entry, [
  'export { answerConversational, updateMemoria } from "./src/adi/conversation.js";',
  'export { coerceFloor, coerceSpec } from "./src/adi/coerceChain.js";',
  'export { buildPnlCascade, activePnl, setPnlLines, clearPnl, resetPnlDraft, pnlDraft, detectPnlIntent, composePnl, pnlSimAsk, pnlDisponibilidad, pnlEjesDisponibles, detectPnlEllipsis, pnlScope } from "./src/adi/pnl.js";',
  'export { buildMesaResultado, pnlMesaLink, pnlExportData } from "./src/adi/sentrix/mesaResultado.js";',
  'export { guardAgainstBoleta } from "./src/adi/boleta.js";',
  'export { METRICS } from "./src/config/contract/metricRegistry.js";',
  'export { ENTITIES } from "./src/config/contract/entityRegistry.js";',
  'export { buildDisponibleMenu } from "./src/adi/llm/capabilities.js";',
  'export { chartForEvidence } from "./src/adi/sentrix/chartSpec.js";',
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
ok(r4 && /^Sellado\./.test(r4.text) && activePnl().length === 3, "'sí' sella (el claim gana al followup_accept) · 3 líneas persistidas");
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
ok(rNegSello && /^Sellado\./.test(rNegSello.text) && activePnl().length === 2, "sellar igual funciona (declara, no bloquea)");
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
const BANNED = /\b(plata|dormid[oa]s?|guita|palancas?|vara)\b/i;
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
ok(rScF && rScF.text.startsWith(`El P&L de Falabella con tu estructura declarada:\n· Ingreso: ${_moneyK(eFal.ventaK)}`), "«P&L de Falabella» abre con SU ingreso, una cifra por línea (regla de formato)", rScF && rScF.text.slice(0, 80));
ok(rScF.text.includes(_moneyK(eFal.resultadoK)) && rScF.text.includes(_moneyK(eFal.contribK)) && rScF.text.includes(_moneyK(eFal.cargaK)), "la cascada scoped cita venta/contribución/carga DE Falabella (costo derivado)");
const rScCP = go("dame el P&L de Cuidado Personal", false);
ok(rScCP && rScCP.text.includes(`El P&L de Cuidado Personal`) && rScCP.text.includes(_moneyK(eCP.resultadoK)), "«P&L de Cuidado Personal» (familia) responde con las cifras del grupo");
const rEntCP = go("¿Cuánto deja Cuidado Personal después de gastos?", false);
ok(rEntCP && rEntCP.text.startsWith(`Después de gastos, Cuidado Personal deja ${_moneyK(eCP.resultadoK)}`), "resultado_entidad ahora resuelve entidades de CUALQUIER eje disponible");
const rMak = go("P&L de Makita", false);
ok(rMak && /no lo puedo armar con rigor/.test(rMak.text) && /ser[ií]a inventar/.test(rMak.text) && !/prorrateados .*=/.test(rMak.text), "entidad del contrato SIN venta desglosada (Makita) → honesto, JAMÁS prorratea");
const rTabF = go("P&L por familia", false);
ok(rTabF && _cFam.porEntidad.every((x) => rTabF.text.includes(x.nombre)) && rTabF.text.includes(_moneyK(_cFam.resultadoK)), "la tabla por familia lista TODAS las familias y ancla el resultado del negocio");
ok(/suman exacto el resultado del negocio/.test(rTabF.text), "la tabla DECLARA la coherencia Σ == negocio");
const rTabC = go("P&L por cliente", false);
ok(rTabC && /…y \d+ más que suman/.test(rTabC.text), "la tabla por cliente (13) recorta honesto: top + resto que SUMA exacto");
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
const sNoPisa = CS("¿y el de Jumbo?", S({ operation: "dive", entity: "Jumbo", dimension: "cliente", turn_type: "new_query" }), true, null);
ok(sNoPisa.operation === "dive", "la herencia NO pisa una clasificación resuelta del LLM (dive de otro hilo sigue siendo dive)");
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
  ok(rEsp && /Armemos tus nuevos supuestos/.test(rEsp.text) && /qué % le pongo a cada línea esta vez/.test(rEsp.text)
    && pnlDraft() && pnlDraft().stage === "pcts" && pnlDraft().lines.every((l) => l.pct === null),
    `re-arme «${qEsp}» → guía los % de esta vez (draft pcts con TUS líneas)`, rEsp && `[${rEsp.route}] ${rEsp.text.slice(0, 60)}`);
  resetPnlDraft();
}
// …y el rearme completa el MISMO camino: % en orden → sello → una verdad nueva
void go("quiero nuevos prorrateos");
const rReP = go("2, 1, 1.5");
ok(rReP && /¿Lo sello\?/.test(rReP.text), "re-arme: «2, 1, 1.5» → propuesta de sello (mismo camino)");
const rReS = go("sí");
ok(rReS && /^Sellado\./.test(rReS.text) && activePnl().find((l) => l.nombre === "Logística").pct === 2, "re-arme sellado: los % nuevos son la verdad");
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
ok(rPd0 && /Te muestro dónde está el dinero/.test(rPd0.text) && /me falta un dato tuyo: tus gastos/.test(rPd0.text) && /\n· Venta del año: /.test(rPd0.text), "sin P&L: la historia LLANA una cifra por línea + la GUÍA de supuestos", rPd0 && rPd0.text.slice(0, 80));
ok(pnlDraft() && pnlDraft().stage === "gastos", "…y el flujo guiado queda ABIERTO (el próximo mensaje con gastos fluye)");
const rPd1 = go("administrativos, logística 3% y promotores 2%");
ok(rPd1 && /Anotado/.test(rPd1.text), "los gastos nombrados tras la pregunta clave SIGUEN el flujo (guía real)");
const rPd2 = go("administrativos al 1%");
ok(rPd2 && /¿Lo sello\?/.test(rPd2.text), "…% completados → propuesta de sello");
ok(/Sellado/.test((go("sí") || {}).text || ""), "…y sella: la conversación de la pregunta clave termina en P&L armado");
const rPd3 = go("¿dónde estoy perdiendo dinero?", false);
const cPd = buildPnlCascade("bonanza");
ok(rPd3 && /^Tu dinero, de punta a punta/.test(rPd3.text) && rPd3.text.includes(_moneyK(cPd.resultadoK)) && rPd3.text.includes(_moneyK(cPd.ingresoK)), "con P&L: la historia de punta a punta con el resultado exacto");
ok(guardAgainstBoleta(rPd3.text, rPd3.evidence.boleta).ok, "guard pregunta clave: cifras == boleta");
for (const s2 of (rPd3.suggestions || [])) { const cs5 = CF(s2, false, null); ok(!!cs5, `chip de la historia reclama: «${s2}»`); }
const rChip1 = AC({ schemaVersion: 1, turn_type: "pnl_setup", pnl: { action: "perdiendo" } }, {}, { scenario: "bonanza" });
ok(rChip1 && /^Tu dinero, de punta a punta/.test(rChip1.text), "chip «¿Cómo viene el P&L de mi negocio?» (enlatado) → la historia");
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

console.log(`\n── _pnl_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
