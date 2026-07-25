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
  'export { answerConversational } from "./src/adi/conversation.js";',
  'export { coerceFloor, coerceSpec } from "./src/adi/coerceChain.js";',
  'export { buildPnlCascade, activePnl, setPnlLines, clearPnl, resetPnlDraft, pnlDraft, detectPnlIntent, composePnl, pnlSimAsk } from "./src/adi/pnl.js";',
  'export { buildMesaResultado } from "./src/adi/sentrix/mesaResultado.js";',
  'export { guardAgainstBoleta } from "./src/adi/boleta.js";',
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

console.log(`\n── _pnl_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
