/* === _contribucion_focus_gate.mjs · GATE end-to-end del FOCO de contribución (4º dominio · owner 2026-07-06) ===
 * Las preguntas de contribución, camino completo: detectContribucionFocus → answerADIFromSpec. Cierra el review en vivo
 * (caían al genérico o se las robaban ventas/margen). Check MADRE: ninguna cae al genérico; los conceptos propios de
 * contribución (concentración 80/20 · origen volumen-vs-calidad · no capturada · alta-venta-baja-contribución) responden. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_cge2.js"), out = path.join(root, "_cgb2.mjs");
fs.writeFileSync(entry, [
  'export { detectContribucionFocus } from "./src/adi/contribucionFocus.js";',
  'export { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { detectContribucionFocus: F, answerADIFromSpec: A } = M;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
const GENERIC = /3 focos donde se te va|Diagn[oó]stico · (base real|escenario)/;
const answer = (q) => {
  const c = F(q);
  const spec = { schemaVersion: 1, scenario: "actual", operation: "contribucion", metric: "contribucion", dimension: c.dimension || "cliente", focus: c.focus, entity: c.entity };
  const r = A(spec, {}, {});
  return { tag: c.focus, txt: (r && (r.text || r.opener)) || "" };
};

const CASES = [
  ["¿Quién sostiene mi contribución?", "concentracion", [/de tu contribución la sostienen 8 de 13/i, /Falabella \(17\.1%\)/]],
  ["¿Qué clientes concentran la mayor parte de la contribución?", "concentracion", [/sostienen 8 de 13/i]],
  ["¿De dónde viene la contribución de Falabella, de volumen o de margen?", "origen", [/contribución de Falabella/i, /VOLUMEN/, /#1 en ventas/i]],
  ["¿Qué clientes aportan mucha venta pero poca contribución?", "alta_venta_baja_contribucion", [/no acompaña el tamaño/i, /Falabella/]],
  ["¿Cuánta contribución no estoy capturando?", "no_capturada", [/sobre la mesa/i, /bajo el benchmark/i, /Falabella/]],
  ["¿Qué familias aportan más a la contribución?", "rank", [/aportan a la contribución/i, /Electrodom/]],
  ["¿En cuántos clientes está el 80% de mi contribución?", "concentracion", [/8 de 13/]],
  ["¿Qué clientes tienen buen margen pero baja contribución?", "alta_venta_baja_contribucion", [/no acompaña el tamaño/i]],
  ["¿Qué SKU aportan más contribución?", "rank", [/aportan a la contribución/i, /PHI-SHAVER9/]],
];

console.log("── las preguntas de contribución responden SU concepto (nunca el genérico) ──");
let noneGeneric = true;
CASES.forEach(([q, tag, must], i) => {
  const { tag: got, txt } = answer(q);
  const tagOk = got === tag, notGen = !GENERIC.test(txt), contentOk = must.every((re) => re.test(txt));
  if (!notGen) noneGeneric = false;
  ok(`Q${i + 1} [${got}] ${tagOk ? "" : "TAG≠" + tag + " "}${notGen ? "" : "GENERIC "}${contentOk ? "responde" : "FALTA-MARCADOR"} · ${q.slice(0, 42)}…`, tagOk && notGen && contentOk);
});

console.log("\n── checks madre ──");
ok("MADRE · NINGUNA cae al diagnóstico genérico de 3 focos", noneGeneric);
ok("concentración = el 80/20 real (82% en 8 de 13 · matchea el motor)", /82\.0% .* 8 de 13/i.test(answer("¿Quién sostiene mi contribución?").txt));
ok("no capturada usa los gates de materialidad (mismo método que el resumen)", /clientes materiales/i.test(answer("¿Cuánta contribución no estoy capturando?").txt));
// no hijack de otros dominios
ok("NO hijack · 'bajo margen mínimo' NO es contribución", F("¿Qué clientes están bajo margen mínimo?").isContrib === false);
ok("NO hijack · 'vs el presupuesto' NO es contribución", F("¿Cómo vamos vs el presupuesto?").isContrib === false);
ok("NO hijack · 'capital inmovilizado' NO es contribución", F("¿dónde está mi capital inmovilizado?").isContrib === false);
ok("NO hijack · simulación 'subo precios 3%' NO es lectura de contribución", F("¿qué pasa con la contribución si subo precios 3%?").isContrib === false);
// robustez del cruce (smoke transversal 2026-07-06): "saca" + entidad en posición de sujeto + "volumen o DE margen"
ok("cruce · 'Falabella … de dónde saca su contribución, de volumen o de margen' → origen + entidad Falabella", (() => { const r = F("Falabella aparece grande en ventas. ¿De dónde saca su contribución, de volumen o de margen?"); return r.isContrib && r.focus === "origen" && r.entity === "Falabella"; })());
ok("cruce · entidad de dos palabras 'de Mercado Libre' → origen + entidad Mercado Libre", (() => { const r = F("¿De dónde viene la contribución de Mercado Libre?"); return r.isContrib && r.focus === "origen" && r.entity === "Mercado Libre"; })());

console.log(`\n── _contribucion_focus_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
