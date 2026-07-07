/* === _continuity_gate.mjs · GATE de CONTINUIDAD DE ALCANCE ("la mesa viva" · owner 2026-07-06) ===
 * Un follow-up DEÍCTICO ("y de esos, ¿cuáles…?") debe HEREDAR el conjunto que ADI acaba de nombrar y re-lensarlo, no
 * responder standalone. Prueba el camino real end-to-end: coerceSpec detecta el deíctico → answerConversational hereda
 * last.entityList como entityScope → el composer FILTRA por nombre. Verificaciones data-independientes (intersección exacta,
 * subconjunto, y control negativo de que un follow-up NO deíctico no scopea). Protege que la continuidad no se degrade. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_coe.js"), out = path.join(root, "_cob.mjs");
fs.writeFileSync(entry, [
  'export { coerceSpec } from "./src/adi/coerceChain.js";',
  'export { answerConversational } from "./src/adi/conversation.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { coerceSpec: C, answerConversational: AC } = M;

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

console.log("\n── E · el deíctico NO dispara sin contexto (hasLast=false) ni con genéricos ──");
ok("sin última evidencia (hasLast=false) → NO _deictic", !C("de esos, ¿cuáles bajo margen?", base(""), false)._deictic);
ok("«de los clientes» (genérico, no referencial) → NO _deictic", !C("dame el margen de los clientes", base(""), true)._deictic);

console.log(`\n── _continuity_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
