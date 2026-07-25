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
  'export { buildMesaResultado } from "./src/adi/sentrix/mesaResultado.js";',
  'export { guardAgainstBoleta } from "./src/adi/boleta.js";',
  'export { METRICS } from "./src/config/contract/metricRegistry.js";',
  'export { ENTITIES } from "./src/config/contract/entityRegistry.js";',
  'export { buildDisponibleMenu } from "./src/adi/llm/capabilities.js";',
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
ok(/ingreso .* − costo .* − carga comercial .* − gastos .* = resultado comercial/.test(r3.text), "la propuesta muestra la cascada compacta");
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
const { pnlDisponibilidad, pnlEjesDisponibles, detectPnlEllipsis, pnlScope, updateMemoria, METRICS, ENTITIES, buildDisponibleMenu } = M;
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
ok(rScF && rScF.text.startsWith(`El P&L de Falabella con tu estructura declarada: ingreso ${_moneyK(eFal.ventaK)}`), "«P&L de Falabella» abre con SU ingreso (ancla del alcance)", rScF && rScF.text.slice(0, 80));
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
ok(rMeta && rMeta.text.startsWith("Para que Falabella te deje $500K después de gastos necesita vender "), "meta scoped: la cuenta sobre el % de la entidad");
// BLINDAJE pnl-en-operation (sweep LLM 2026-07-25): el LLM #1 pone "pnl_setup" en OPERATION → el turno ES del
// P&L (jamás spec_blocked) — y el rescate elíptico NO lo lee como "op resuelta".
const rBlind = AC(CS("recuerda lo anterior", S({ operation: "pnl_setup", turn_type: "followup_explain" }), true, null), {}, { scenario: "bonanza" });
ok(rBlind && !/^spec_blocked/.test(rBlind.route || "") && /Retomo tu P&L donde lo dejamos/.test(rBlind.text), "operation:'pnl_setup' del LLM + «recuerda lo anterior» → retoma (ni bloqueo ni robo)");
const sEjeEl = CS("muéstramelo por familia", S({ operation: "pnl_setup" }), true, null);
ok(sEjeEl.turn_type === "pnl_setup" && sEjeEl.pnl && sEjeEl.pnl.action === "tabla_eje" && sEjeEl.pnl.eje === "familia", "«muéstramelo por familia» (elíptico, hilo vivo) → la tabla del eje");
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

console.log(`\n── _pnl_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
