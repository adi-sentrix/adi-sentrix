/* === _criteria_gate.mjs · GATE de la MEMORIA DE CRITERIO (V5 · Frente C.2 · owner 2026-07-07) ===
 * "Recordá que mi margen mínimo es 28%" → ADI mide con LA VARA DEL OWNER en todas las lecturas, palancas y diagnósticos
 * (una verdad vía POLICY/benchmarkOf), lo persiste (localStorage, guarded) y lo muestra/borra por panel + chat.
 * Lockea: (1) detección set/recall/forget/propose SIN robar preguntas de lectura ni ser robada por el coerce de margen ·
 * (2) UNA VERDAD: el 28% aparece en la lectura, la palanca y el diagnose recalculan · (3) "olvidá" RESTAURA byte-igual ·
 * (4) fuera de rango → honesto, no guarda · (5) propose nunca guarda solo (regla del owner) · (6) headless-safe. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_cre.js"), out = path.join(root, "_crb.mjs");
fs.writeFileSync(entry, [
  'export { coerceSpec } from "./src/adi/coerceChain.js";',
  'export { answerConversational } from "./src/adi/conversation.js";',
  'export { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";',
  'export { detectCriteriaIntent, activeCriteria } from "./src/adi/criteria.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { coerceSpec: C, answerConversational: AC, answerADIFromSpec: A, detectCriteriaIntent: D, activeCriteria: ACT } = M;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
const base = { schemaVersion: 1, operation: "overview", metric: "ventas", dimension: "cliente" };
const run = (q) => { const s = C(q, { ...base }, false); const r = AC(s, {}, {}); r._spec = s; return r; };
const margin = () => A({ schemaVersion: 1, operation: "margin", metric: "margen", dimension: "cliente", focus: "bajo_benchmark" }, {}, {});
const diagTotal = () => { const d = A({ schemaVersion: 1, operation: "diagnose", metric: "margen", dimension: "cliente" }, {}, {}); const f = (d.evidence.boleta || []).find((x) => /Contribución no capturada · subtotal/.test(x.label)); return f ? f.raw : 0; };

console.log("── detección · ni roba ni es robada ──");
ok("«recordá que mi margen mínimo es 28%» → set (no lo roba el coerce de margen)", (() => { const s = C("recordá que mi margen mínimo es 28%", { ...base }, false); return s.turn_type === "apply_criteria" && s.criteria.action === "set" && s.criteria.key === "margen_minimo" && s.criteria.value === 28; })());
ok("«¿quiénes están bajo el margen mínimo?» → margen (NO criterio: es lectura)", C("¿quiénes están bajo el margen mínimo?", { ...base }, false).operation === "margin");
ok("«productos por debajo del 30% de margen» → margen (número sin frase de criterio)", C("que productos estan por debajo del 30% de margen?", { ...base }, false).operation === "margin");
ok("«¿qué recordás?» → recall", D("¿qué recordás?") && D("¿qué recordás?").action === "recall");
ok("«olvidá el margen mínimo» → forget puntual", (() => { const d = D("olvidá el margen mínimo"); return d && d.action === "forget" && d.key === "margen_minimo"; })());
ok("«para mí el margen mínimo es 28» → propose (no guarda solo)", (() => { const d = D("para mí el margen mínimo es 28"); return d && d.action === "propose" && d.value === 28; })());
ok("«recordá que mi target de carga es 3%» → set target_carga", (() => { const d = D("recordá que mi target de carga es 3%"); return d && d.action === "set" && d.key === "target_carga" && d.value === 3; })());

console.log("\n── UNA VERDAD · la vara del owner mueve lectura, palanca y diagnose ──");
const before = margin();
const diagBefore = diagTotal();
ok("baseline: la lectura mide contra 30.1%", /30\.1%/.test(before.text));
const setR = run("recordá que mi margen mínimo es 28%");
ok("set confirma con antes/después (28% ← 30.1%)", /28%|28\.0%/.test(setR.text) && /30\.1%/.test(setR.text) && setR._spec.turn_type === "apply_criteria");
ok("set emite el panel de criterio (criteriaList + boleta)", Array.isArray(setR.evidence.criteriaList) && setR.evidence.criteriaList.length === 1);
const after = margin();
ok("la lectura de margen ahora mide contra 28.0% (ni rastro del 30.1%)", /28\.0%/.test(after.text) && !/30\.1%/.test(after.text));
const diagAfter = diagTotal();
ok("el diagnose recalcula con la vara nueva (28 < 30.1 → menos brecha material)", diagAfter > 0 && diagAfter < diagBefore);
const recallR = run("¿qué recordás?");
ok("recall lista el criterio con su estándar", /Margen mínimo/.test(recallR.text) && /28/.test(recallR.text) && /30\.1/.test(recallR.text));

console.log("\n── FORGET restaura byte-igual · rango honesto · propose no guarda ──");
const forgetR = run("olvidá el margen mínimo");
ok("forget confirma la vuelta al estándar", /est[aá]ndar/i.test(forgetR.text));
const restored = margin();
ok("la lectura restaurada es BYTE-IGUAL a la de antes del criterio", restored.text === before.text);
ok("y el diagnose vuelve exacto", diagTotal() === diagBefore);
const badR = run("recordá que mi margen mínimo es 90%");
ok("fuera de rango (90%) → honesto, no guarda", /entre 5% y 60%/.test(badR.text) && ACT().length === 0);
const propR = run("para mí el margen mínimo es 28");
ok("propose pregunta y NO guarda (chip con la frase exacta)", /No lo guardo sin tu OK/i.test(propR.text) && ACT().length === 0 && Array.isArray(propR.suggestions) && /record[aá]/i.test(propR.suggestions[0]));
ok("headless sin localStorage: todo lo anterior corrió sin crashear", true);

console.log(`\n── _criteria_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
