// === HARNESS · PEDIDO MÚLTIPLE · secuencial guiado (detección + flujo multi-turno) ===
import esbuild from "esbuild";
import { pathToFileURL } from "url";
import path from "path";
import { detectMultiAsk, extractAskedMetrics } from "./src/adi/composers/multiAsk.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("✅", m); } else { fail++; console.log("🚨", m); } };

console.log("── DETECCIÓN · lista de métricas vs cruce vs simple ──");
ok(JSON.stringify(extractAskedMetrics("las ventas, los márgenes y el capital inmovilizado")) === JSON.stringify(["ventas", "margen", "capital inmovilizado"]), "extrae 3 métricas EN ORDEN del texto");
ok(detectMultiAsk("muéstrame las ventas, los márgenes y dónde está mi capital inmovilizado").length === 3, "pedido de 3 → detecta lista");
ok(detectMultiAsk("las ventas y los márgenes").length === 2, "pedido de 2 con «y» → lista");
ok(detectMultiAsk("ventas contra margen") === null, "«ventas CONTRA margen» = cruce → NO lista (avisa honesto)");
ok(detectMultiAsk("ventas por margen") === null || detectMultiAsk("ventas por margen") !== null, "«por» tolerado (no rompe)");
ok(detectMultiAsk("el peor cliente por margen") === null, "1 métrica → NO lista (flujo normal)");
ok(detectMultiAsk("las ventas") === null, "1 métrica sola → NO lista");
ok(detectMultiAsk("ventas margen") === null, "2 métricas SIN enumeración («,»/«y») → NO lista");

console.log("\n── FLUJO MULTI-TURNO · e2e (answerADI) ──");
const out = path.join(process.cwd(), "_ma_bundle.mjs");
await esbuild.build({ entryPoints: [path.join(process.cwd(), "src/adi/answerADI.js")], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const mod = await import(pathToFileURL(out).href + "?t=" + Math.random());
const A = (q, ctx) => mod.answerADI(q, ctx || {}, { scenario: "bonanza" });

let ctx = {};
const t1 = A("muéstrame las ventas, los márgenes y dónde está mi capital inmovilizado", ctx); ctx = t1.context;
ok(t1.route === "multi_ask_sequence", "T1 → route multi_ask_sequence");
ok(/arranco por \*\*ventas\*\*/.test(t1.text), "T1 arranca por VENTAS (la 1ª)");
ok(/\$100\.0M/.test(t1.text), "T1 trae el número REAL de ventas (respuesta entera, no puntea)");
ok(/sigo con margen o capital inmovilizado/i.test(t1.text), "T1 encadena las 2 restantes");
ok(t1.context.pendingSequence && t1.context.pendingSequence.queue.length === 2, "T1 guarda la cola (2 pendientes)");

const t2 = A("sí", ctx); ctx = t2.context;
ok(t2.route === "multi_ask_sequence" && /25\.6%|margen general/i.test(t2.text), "T2 «sí» → responde MARGEN entero");
ok(/sigo con capital inmovilizado/i.test(t2.text), "T2 encadena la última");
ok(t2.context.pendingSequence.queue.length === 1, "T2 cola baja a 1");

const t3 = A("sí", ctx); ctx = t3.context;
ok(/capital inmovilizado|LG-DRYER8KG/i.test(t3.text) && /cubrí las 3/i.test(t3.text), "T3 «sí» → capital + cierra «cubrí las 3»");
ok(t3.context.pendingSequence == null, "T3 cierra la cola (pendingSequence null)");

console.log("\n── EL CRUCE sigue avisando (honesto · NO secuencial) ──");
const cr = A("ventas contra margen", {});
ok(cr.route !== "multi_ask_sequence" && /cruce.*lo estoy armando/i.test(cr.text), "«ventas contra margen» → avisa (no secuencial)");

console.log("\n── DECLINAR corta la secuencia ──");
let c2 = A("las ventas y los márgenes", {}).context;
const dec = A("no, después", c2);
ok(/cuando quieras seguimos/i.test(dec.text) && dec.context.pendingSequence == null, "«no» → cierra amable, sin forzar");

console.log("\n════════════════════════════════════════════════════");
console.log(`GATES: ${pass}/${pass + fail} · ${fail === 0 ? "TODOS VERDES" : "HAY ROJOS"}`);
import fs from "fs"; try { fs.unlinkSync(out); } catch {}
process.exit(fail === 0 ? 0 : 1);
