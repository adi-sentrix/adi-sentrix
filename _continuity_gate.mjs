/* === _continuity_gate.mjs · GATE de CONTINUIDAD DE ALCANCE ("la mesa viva" · owner 2026-07-06) ===
 * Un follow-up DEÍCTICO ("y de esos, ¿cuáles…?") debe HEREDAR el conjunto que ADI acaba de nombrar y re-lensarlo, no
 * responder standalone. Prueba el camino real end-to-end: coerceSpec detecta el deíctico → answerConversational hereda
 * last.entityList como entityScope → el composer FILTRA por nombre. Verificaciones data-independientes (intersección exacta,
 * subconjunto, y control negativo de que un follow-up NO deíctico no scopea). Protege que la continuidad no se degrade. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, `_coe.tmp${process.pid}.js`), out = path.join(root, `_cob.tmp${process.pid}.mjs`);
fs.writeFileSync(entry, [
  'export { coerceSpec } from "./src/adi/coerceChain.js";',
  'export { answerConversational } from "./src/adi/conversation.js";',
  'export { composePnl, resetPnlDraft, detectPnlIntent, pnlDraft } from "./src/adi/pnl.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { coerceSpec: C, answerConversational: AC, composePnl: CP, resetPnlDraft: RPD, detectPnlIntent: DPI, pnlDraft: PD } = M;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
const base = (q) => ({ schemaVersion: 1, operation: "overview", metric: "ventas", dimension: "cliente" });
const run = (q, ctx, hasLast) => { const s = C(q, base(q), !!hasLast); let r; try { r = AC(s, ctx || {}, {}); } catch (e) { r = { text: "THROW:" + e.message, _spec: s }; } r._spec = s; return r; };
const names = (arr) => (arr || []).map((x) => x && (x.nombre != null ? x.nombre : x.sku)).filter(Boolean);
const setEq = (a, b) => { const A = new Set(a), B = new Set(b); return A.size === B.size && [...A].every((x) => B.has(x)); };
const subset = (a, b) => { const B = new Set(b); return a.every((x) => B.has(x)); };

console.log("── A · contribución(concentración) → «de esos, ¿cuáles bajo el margen mínimo?» (el cruce estrella) ──");
// turno 1: quién sostiene la contribución (nombra el bloque 80/20)
const t1a = run("¿quién sostiene mi contribución?", {}, false);
const S = (t1a.evidence && t1a.evidence.entityList && t1a.evidence.entityList.entities) || [];
ok("turno1 rutea a contribución/concentración", t1a._spec.operation === "contribucion" && t1a._spec.focus === "concentracion");
ok("turno1 EMITE entityList (dim cliente · = corte 80/20)", t1a.evidence && t1a.evidence.entityList && t1a.evidence.entityList.dimension === "cliente" && S.length > 0 && S.length === t1a.evidence.contribucion.panel.cutoff);
// turno 2 deíctico: hereda el bloque y lo filtra a margen
const q2 = "y de esos, ¿cuáles quedan bajo el margen mínimo?";
const t2s = run(q2, { lastEvidence: t1a.evidence }, true);   // scoped (hay última evidencia)
const t2u = run(q2, {}, false);                               // unscoped (sin contexto)
ok("turno2 marca _deictic + rutea a margen", t2s._spec._deictic === true && t2s._spec.operation === "margin");
const belowS = names(t2s.evidence && t2s.evidence.margin && t2s.evidence.margin.below);
const belowU = names(t2u.evidence && t2u.evidence.margin && t2u.evidence.margin.below);
const expected = belowU.filter((n) => S.includes(n));
ok("scoped ⊆ el bloque heredado (no nombra a nadie de afuera)", subset(belowS, S));
ok("scoped = (unscoped ∩ heredado) EXACTO (filtró justo lo correcto)", setEq(belowS, expected));
// el recorte se prueba en el UNIVERSO de filas del panel (below puede coincidir si todos los bajo-margen ya estaban en el 80/20)
const panelSlen = ((t2s.evidence && t2s.evidence.margin && t2s.evidence.margin.panel && t2s.evidence.margin.panel.rows) || []).length;
const panelUlen = ((t2u.evidence && t2u.evidence.margin && t2u.evidence.margin.panel && t2u.evidence.margin.panel.rows) || []).length;
ok("scoping real: el universo del panel se recorta al bloque heredado", panelSlen > 0 && panelSlen < panelUlen && panelSlen === S.length);

console.log("\n── B · margen(bajo_benchmark) → «de esos, ¿de dónde sacan la contribución?» ──");
const t1b = run("¿quiénes están bajo el margen mínimo?", {}, false);
const Sb = (t1b.evidence && t1b.evidence.entityList && t1b.evidence.entityList.entities) || [];
ok("turno1 rutea a margen/bajo_benchmark + emite entityList", t1b._spec.operation === "margin" && Sb.length > 0);
const t2b = run("y de esos, ¿de dónde sacan su contribución?", { lastEvidence: t1b.evidence }, true);
ok("turno2 _deictic + rutea a contribución/origen", t2b._spec._deictic === true && t2b._spec.operation === "contribucion");
const panelB = names(t2b.evidence && t2b.evidence.contribucion && t2b.evidence.contribucion.panel && t2b.evidence.contribucion.panel.rows);
ok("el panel scopeado SÓLO contiene entidades del bloque heredado", panelB.length > 0 && subset(panelB, Sb));

console.log("\n── C · control negativo · un follow-up NO deíctico NO scopea (responde toda la cartera) ──");
const t2n = run("¿quiénes están bajo el margen mínimo?", { lastEvidence: t1a.evidence }, true);   // hay contexto, pero SIN palabra deíctica
ok("sin deíctico → NO _deictic (aunque haya última evidencia)", !t2n._spec._deictic);
const belowN = names(t2n.evidence && t2n.evidence.margin && t2n.evidence.margin.below);
ok("sin deíctico → mismo below que unscoped (no heredó alcance)", setEq(belowN, belowU));

console.log("\n── D · detección deíctica robusta (varios fraseos) + ruteo del dominio intacto ──");
const dcases = [
  ["de esos, ¿cuánto me aportan?", "contribucion"],
  ["de esas cuentas, ¿cuál vende más?", "ventas"],
  ["y de esos cuáles están bajo el margen", "margin"],
  ["entre esos, ¿quién sostiene la contribución?", "contribucion"],
  ["de esos que caen, ¿cuánto cayeron vs el año pasado?", "ventas"],
  ["esos mismos, ¿cómo vienen vs el año anterior?", "ventas"],
];
for (const [q, dom] of dcases) {
  const s = C(q, base(q), true);
  ok(`[${s.operation}${s._deictic ? "·deíctico" : ""}] ${q.slice(0, 42)}…`, s._deictic === true && s.operation === dom);
}

console.log("\n── F · cadena de 3 TURNOS cruzando dominios · inventario → margen@sku → contribución@sku ──");
const f1 = run("¿qué SKU están frenados?", {}, false);
const F = (f1.evidence && f1.evidence.entityList) || {};
ok("turno1 inventario/frenado emite entityList dimension sku", f1._spec.operation === "inventory" && F.dimension === "sku" && (F.entities || []).length > 0);
const f2 = run("y de esos, ¿cuáles tienen mal margen?", { lastEvidence: f1.evidence }, true);
const f2rows = names(f2.evidence && f2.evidence.margin && f2.evidence.margin.panel && f2.evidence.margin.panel.rows);
ok("turno2 margen@sku scopeado a los SKU heredados", f2._spec.operation === "margin" && f2rows.length > 0 && subset(f2rows, F.entities));
ok("turno2 re-emite entityList dimension sku (el fix de _finalize·dimension)", f2.evidence && f2.evidence.entityList && f2.evidence.entityList.dimension === "sku");
ok("turno2 VOZ: reconoce el alcance heredado («De los que veníamos mirando»)", /De los que veníamos mirando/.test(f2.text || ""));
const f3 = run("y de esos, ¿cuánto me aportan a la contribución?", { lastEvidence: f2.evidence }, true);
const f3rows = names(f3.evidence && f3.evidence.contribucion && f3.evidence.contribucion.panel && f3.evidence.contribucion.panel.rows);
ok("turno3 contribución@sku sigue scopeada a la MISMA cadena", f3._spec.operation === "contribucion" && f3rows.length > 0 && subset(f3rows, F.entities));
ok("turno1 (sin herencia) NO lleva la marca de voz", !/De los que veníamos mirando/.test(f1.text || ""));

console.log("\n── G · VENTAS como destino del alcance (los focos que leían fuentes crudas) ──");
// margen(below · clientes) → "de esos, ¿quiénes redujeron su compra?" (caida_clientes scopeada)
const g1 = run("y de esos, ¿quiénes redujeron su compra?", { lastEvidence: t1b.evidence }, true);
const g1rows = names(g1.evidence && g1.evidence.ventas && g1.evidence.ventas.panel && g1.evidence.ventas.panel.rows);
ok("caida_clientes scopeada al bloque heredado", g1._spec.operation === "ventas" && g1._spec._deictic === true && g1rows.length > 0 && subset(g1rows, Sb));
// margen(below) → "de esos, ¿cómo vamos contra el presupuesto?" (vs_presupuesto con TOTAL del subconjunto)
const g2 = run("y de esos, ¿cómo vamos contra el presupuesto?", { lastEvidence: t1b.evidence }, true);
const g2rows = names(g2.evidence && g2.evidence.ventas && g2.evidence.ventas.panel && g2.evidence.ventas.panel.rows);
const g2bol = (g2.evidence && g2.evidence.boleta) || [];
ok("vs_presupuesto scopeado (desglose ⊆ heredado)", g2._spec.operation === "ventas" && g2rows.length > 0 && subset(g2rows, Sb));
ok("vs_presupuesto scopeado usa el TOTAL del grupo (no la KPI de cartera)", g2bol.some((f) => /Venta del grupo/.test(f.label)));
// inventario(3 SKU) → "de esos, ¿cuál es el que más se vende?" (rank_venta scopeado)
const g3 = run("de esos, ¿cuál es el que más se vende?", { lastEvidence: f1.evidence }, true);
const g3rows = names(g3.evidence && g3.evidence.ventas && g3.evidence.ventas.panel && g3.evidence.ventas.panel.rows);
ok("rank_venta scopeado a los SKU heredados", g3._spec.operation === "ventas" && g3rows.length > 0 && g3rows.length <= F.entities.length && subset(g3rows, F.entities));

console.log("\n── H · INVENTARIO como destino del alcance (cierra los 4 dominios) ──");
// margen@sku (los 3 heredados de la cadena F) → "de esos, ¿alguno sigue frenado en bodega?"
const h1 = run("y de esos, ¿alguno sigue frenado en bodega?", { lastEvidence: f2.evidence }, true);
const h1sku = ((h1.evidence && h1.evidence.inventory && h1.evidence.inventory.bySku) || []).map((x) => x.sku);
ok("inventory scopeado a los SKU heredados", h1._spec.operation === "inventory" && h1._spec._deictic === true && h1sku.length > 0 && subset(h1sku, F.entities));
ok("inventory scopeado lleva la marca de voz", /De los que veníamos mirando/.test(h1.text || ""));

console.log("\n── I · ACEPTACIÓN («sí» pelado ejecuta la oferta) + blindaje anti-leak (bug del owner 2026-07-07) ──");
// tras un COMPARE, "sí" → el dive CAUSAL de la cuenta floja (la que pierde margen — la que la oferta proponía trabajar)
const cmpEv = AC({ schemaVersion: 1, operation: "compare", metric: "margen", dimension: "cliente", comparison: { dimension: "cliente", entities: ["Falabella", "Lider"] }, turn_type: "new_query" }, {}, {}).evidence;
const si1 = run("sí", { lastEvidence: cmpEv }, true);
ok("«sí» tras compare → turn_type followup_accept", si1._spec.turn_type === "followup_accept");
ok("…y ejecuta el DIVE CAUSAL del que pierde margen (Lider 21.5 < Falabella 22)", /Lider/.test(si1.text) && /\*\*Por qué está donde está:\*\*/.test(si1.text) && !/No sé hacer|followup/.test(si1.text));
// tras una lectura de dominio, "dale" → profundiza la primera entidad nombrada
const mEv = AC({ schemaVersion: 1, operation: "margin", metric: "margen", dimension: "cliente", focus: "bajo_benchmark", turn_type: "new_query" }, {}, {}).evidence;
const si2 = run("dale", { lastEvidence: mEv }, true);
ok("«dale» tras margen → dive de la primera nombrada (con su capa causal)", si2._spec.turn_type === "followup_accept" && /\*\*Por qué (está donde está|gana):\*\*/.test(si2.text));
ok("«sí» SIN contexto NO es aceptación (no hay oferta que ejecutar)", C("sí", base("sí"), false).turn_type !== "followup_accept");
ok("una pregunta larga que empieza con «sí» NO es aceptación", C("sí pero mostrame el margen de los clientes primero", base(""), true).turn_type !== "followup_accept");
// BLINDAJE · el LLM pone un turn_type en OPERATION → se migra de campo (nunca el degrade con enum interno)
const leak1 = AC({ schemaVersion: 1, operation: "followup_compare", metric: "margen", dimension: "cliente", comparison: { entities: ["Falabella"] }, turn_type: "new_query" }, { lastEvidence: mEv }, {});
ok("operation:'followup_compare' → se trata como turn_type (no degrada)", !/No sé hacer|overview, rank|followup_compare/.test(leak1.text));
// NO-LEAK · una operación basura degrada en VOCABULARIO DE PRODUCTO (sin el enum interno)
const leak2 = AC({ schemaVersion: 1, operation: "hacer_magia", metric: "margen", dimension: "cliente", turn_type: "new_query" }, {}, {});
ok("degrade de operación desconocida SIN vocabulario interno (enum/turn_types)", !/overview, rank|followup|schemaVersion/.test(leak2.text) && /profundizar|diagnosticar/i.test(leak2.text));

console.log("\n── J · DEÍCTICO DE UI («compará estos dos» mirando la Mesa · owner 2026-07-08) ──");
const uiSel = { mesaSel: ["Falabella", "Lider"], mesaDim: "cliente" };
const j1 = C("compará estos dos", base(""), false, uiSel);
ok("«compará estos dos» + selección de la Mesa → compare con ESAS entidades", j1.operation === "compare" && j1.comparison.entities[0] === "Falabella" && j1.comparison.entities[1] === "Lider");
const j2 = AC(j1, {}, {});
ok("…y ejecuta la comparación real (con perfil y causas)", /Falabella/.test(j2.text) && /Lider/.test(j2.text) && /\*\*El perfil:\*\*/.test(j2.text));
ok("«compará estos dos» SIN selección → NO inventa referente (cae a la cadena normal)", (() => { const s = C("compará estos dos", base(""), false, { mesaSel: [] }); return !(s.comparison && s.comparison.entities && s.comparison.entities.length === 2); })());
ok("selección de SKU → compara por el eje de la Mesa", (() => { const s = C("compará esos dos", base(""), false, { mesaSel: ["LG-DRYER8KG", "BOS-SANDER"], mesaDim: "sku" }); return s.operation === "compare" && s.comparison.dimension === "sku"; })());
ok("una pregunta normal con la Mesa abierta NO se secuestra", C("¿quiénes están bajo el margen mínimo?", base(""), false, uiSel).operation === "margin");
ok("«dame un resumen del negocio» → el diagnóstico ejecutivo (no un ranking suelto)", C("ahora dame un resumen del negocio", base(""), true).operation === "diagnose");
ok("«¿cómo está mi negocio?» → diagnose", C("¿cómo está mi negocio?", base(""), false).operation === "diagnose");

console.log("\n── E · el deíctico NO dispara sin contexto (hasLast=false) ni con genéricos ──");
ok("sin última evidencia (hasLast=false) → NO _deictic", !C("de esos, ¿cuáles bajo margen?", base(""), false)._deictic);
ok("«de los clientes» (genérico, no referencial) → NO _deictic", !C("dame el margen de los clientes", base(""), true)._deictic);

console.log("\n── K · REGRESIÓN P&L (owner 2026-07-26 · «no quiero que por el P&L se hayan echado a perder otras cosas»):");
console.log("       el claim pnl quedó GOLOSO tras el flujo guiado — 3 continuidades rotas por PRECEDENCIA ──");
const SCN = "bonanza";
// evidencia de hilo margen (lista · Lider primero) y de hilo contribución (top clientes) para los deícticos
const kMarg = AC({ schemaVersion: 1, operation: "margin", metric: "margen", dimension: "cliente", focus: "bajo_benchmark", turn_type: "new_query" }, {}, { scenario: SCN }).evidence;
const kContrib = AC({ schemaVersion: 1, operation: "contribucion", metric: "contribucion", dimension: "cliente", focus: "concentracion", turn_type: "new_query" }, {}, { scenario: SCN }).evidence;
const kEL = (kMarg.entityList && kMarg.entityList.entities) || [];

// #1 · «¿qué hago con el primero?» tras un hilo con lista + un draft de gastos LEAKED abierto (la «perdiendo»
// sin líneas lo deja en etapa gastos) → NO debe caer en pnl_setup/draft_help; recommend anclado a Lider.
RPD(); CP({ action: "perdiendo" }, {}, { scenario: SCN });   // abre el draft gastos (condición del hilo real)
ok("#1a · con draft abierto, detectPnlIntent(«qué hago con el primero») aún dice draft_help (por eso el coerce debe cederle)",
  DPI("¿qué hago con el primero?") && DPI("¿qué hago con el primero?").action === "draft_help" && PD() && PD().stage === "gastos");
const k1spec = C("¿qué hago con el primero?", { schemaVersion: 1, operation: "clarification_needed", turn_type: "followup_recommendation" }, true);
const k1 = AC(k1spec, { lastEvidence: kMarg }, { scenario: SCN });
ok("#1b · el coerce marca _focoAccion (ordinal 1) y NO deja ganar al claim pnl", k1spec._focoAccion && k1spec._focoAccion.ordinal === 1 && k1spec.turn_type !== "pnl_setup");
ok("#1c · rutea a recommend anclado a la ENTIDAD del hilo (Lider), NO a pnl_setup/«Los gastos que manejes tú»",
  k1.route === "recommend_action" && /Lider/.test(k1.text || "") && !/pnl_setup/.test(String(k1.route)) && !/Los gastos que manejes/.test(k1.text || ""));
// el spec CRUDO que el LLM tiende a emitir (op pnl_setup en OPERATION) tampoco debe robar el hilo de acción
const k1raw = AC(C("¿qué hago con el primero?", { schemaVersion: 1, operation: "pnl_setup", turn_type: "new_query" }, true), { lastEvidence: kMarg }, { scenario: SCN });
ok("#1d · aun con el LLM emitiendo operation:pnl_setup, el follow-up de acción se ancla a Lider", k1raw.route === "recommend_action" && /Lider/.test(k1raw.text || ""));
// control: «qué hago» PELADO (sin referencia al hilo) DENTRO del flujo sigue siendo la guía del draft (no se rompe el flujo)
RPD(); CP({ action: "perdiendo" }, {}, { scenario: SCN });
const k1bare = AC(C("¿qué hago?", { schemaVersion: 1, operation: "clarification_needed", turn_type: "followup_recommendation" }, false), {}, { scenario: SCN });
ok("#1e · «qué hago» pelado (draft abierto, sin referencia) SIGUE siendo draft_help — el flujo P&L no se rompe",
  k1bare.route === "pnl_setup" && /Los gastos que manejes/.test(k1bare.text || ""));

// #2 · «¿cuánto vender para que Falabella deje $500K?» con draft LEAKED + sin líneas → honesto RETENIENDO la
// entidad; JAMÁS una lectura de ventas genérica.
RPD(); CP({ action: "perdiendo" }, {}, { scenario: SCN });   // draft gastos abierto
const k2spec = C("¿cuánto tendría que vender para que Falabella deje $500K?", { schemaVersion: 1, operation: "ventas", metric: "ventas", dimension: "cliente", turn_type: "new_query" }, false);
const k2 = AC(k2spec, {}, { scenario: SCN });
ok("#2a · el claim pnl reclama la meta scopeada (no la enmascara el draft) → turn_type pnl_setup", k2spec.turn_type === "pnl_setup" && k2spec.pnl && k2spec.pnl.action === "meta_venta" && k2spec.pnl.entidad === "Falabella");
ok("#2b · responde HONESTO reteniendo la entidad (nombra Falabella + pide las líneas), NO un overview de ventas",
  k2.route === "pnl_reading" && /Falabella/.test(k2.text || "") && /l[ií]neas de gasto/.test(k2.text || "") && !/crecimiento|impulsores|La Polar/.test(k2.text || ""));

// #3 · «de esos, ¿cuánto margen ceden?» tras nombrar el conjunto — el LLM tiende a followup_explain (o le pega
// otro dominio del hilo): debe RE-LENSAR el entityList a margen, no un followup_explain HUECO.
RPD();
const k3EL = (kContrib.entityList && kContrib.entityList.entities) || [];
for (const [lbl, spec] of [
  ["LLM followup_explain + op null", { schemaVersion: 1, operation: null, turn_type: "followup_explain" }],
  ["LLM followup_explain + op contribucion (dominio equivocado)", { schemaVersion: 1, operation: "contribucion", metric: "contribucion", dimension: "cliente", turn_type: "followup_explain" }],
  ["LLM margin + filters:{marca} ALUCINADO (el vacío del full-run)", { schemaVersion: 1, operation: "margin", metric: "margen", dimension: "cliente", turn_type: "followup_explain", filters: { marca: "Samsung" } }],
]) {
  const s3 = C("de esos, ¿cuánto margen ceden?", spec, true);
  const r3 = AC(s3, { lastEvidence: kContrib }, { scenario: SCN });
  const rows = ((r3.evidence && r3.evidence.margin && r3.evidence.margin.panel && r3.evidence.margin.panel.rows) || []).map((x) => x && x.nombre).filter(Boolean);
  ok(`#3 · [${lbl}] re-deriva a margin + _deictic + new_query (no explain hueco)`, s3.operation === "margin" && s3._deictic === true && s3.turn_type === "new_query");
  ok(`#3 · [${lbl}] scopea el margen al conjunto heredado (⊆) · NO explain/blocked/empty`,
    r3.route === "qi_retrieval" && rows.length > 0 && subset(rows, k3EL) && /De los que veníamos mirando/.test(r3.text || ""));
}

console.log(`\n── _continuity_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
