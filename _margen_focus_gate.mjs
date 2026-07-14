/* === _margen_focus_gate.mjs · GATE end-to-end del FOCO de margen ("la pregunta manda el foco" · owner 2026-07-06) ===
 * Cada test es una PREGUNTA real del set de margen/contribución → recorre el camino completo: (1) detectMarginFocus (el
 * cerebro del coerce) elige la punta o marca el hueco · (2) answerADIFromSpec ejecuta y produce la RESPUESTA. Cierra el
 * hallazgo del smoke en vivo: 23/25 caían al "diagnóstico genérico de 3 focos" (respondían otra pregunta). El check MADRE:
 * NINGUNA respuesta cae al genérico; las 18 respondibles lideran con lo específico; las 7 avisan honesto + pivot. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_mge.js"), out = path.join(root, "_mgb.mjs");
fs.writeFileSync(entry, [
  'export { detectMarginFocus } from "./src/adi/marginFocus.js";',
  'export { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { detectMarginFocus: F, answerADIFromSpec: A } = M;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
// coerce (replica _coerceMargin) + answer
const answer = (q) => {
  const m = F(q);
  const spec = { schemaVersion: 1, scenario: "actual", operation: "margin", metric: "margen", dimension: m.dimension || "cliente", focus: m.focus, gap: m.gap, negativo: m.negativo, pct: m.pct };
  const r = A(spec, {}, {});
  return { m, txt: (r && (r.text || r.opener)) || "" };
};
const GENERIC = /3 focos donde se pierde|Diagn[oó]stico · (base real|escenario)/;   // el marcador de la trampa

// [pregunta, foco/gap esperado, [regex que DEBE contener]]
const CASES = [
  ["¿Qué clientes venden mucho, pero dejan bajo margen?", "focus:alto_volumen_bajo_margen", [/m[aá]s venden y peor margen/i, /Falabella/, /benchmark 30\.1/]],
  ["¿Qué SKU venden mucho, pero dejan bajo margen?", "focus:alto_volumen_bajo_margen", [/m[aá]s venden y peor margen/i, /SAM-TV55/]],
  ["¿Qué familias venden mucho, pero dejan bajo margen?", "focus:alto_volumen_bajo_margen", [/Las familias que m[aá]s venden/i, /Electrodom/]],
  ["¿Qué clientes tienen margen negativo?", "focus:bajo_benchmark(neg)", [/Ninguno tiene margen negativo/i, /Lider/, /No te invento/i]],
  ["¿Qué SKU tienen margen negativo?", "focus:bajo_benchmark(neg)", [/Ninguno tiene margen negativo/i, /MAK-COMP-AIR/]],
  ["¿Qué familias concentran SKU de margen negativo?", "focus:bajo_benchmark(neg)", [/Ninguno tiene margen negativo/i]],
  ["¿Qué productos están bajo margen mínimo?", "focus:bajo_benchmark", [/bajo el margen m[ií]nimo/i, /12 de 13/]],
  ["¿Qué clientes están bajo margen mínimo?", "focus:bajo_benchmark", [/bajo el margen m[ií]nimo/i, /8 de 13/]],
  ["¿Qué porcentaje de la venta está bajo margen mínimo?", "focus:bajo_benchmark(pct)", [/de la venta.*bajo el margen m[ií]nimo/i, /%/]],
  ["¿Qué SKU explican la mayor caída de margen?", "gap:caida", [/No te puedo medir la CA[IÍ]DA/i, /No lo invento/i, /Lo m[aá]s cercano/i]],
  ["¿Qué clientes explican la mayor caída de margen?", "gap:caida", [/CA[IÍ]DA/i, /Lo m[aá]s cercano/i]],
  ["¿Qué familias explican la mayor caída de margen?", "gap:caida", [/CA[IÍ]DA/i, /4 de 4 familias/]],
  ["¿Qué SKU tienen margen bajo por precio insuficiente?", "focus:causa_precio", [/por el PRECIO/i, /markup/i, /MAK-COMP-AIR/]],
  ["¿Qué SKU tienen margen bajo por costo alto?", "focus:causa_costo", [/por el COSTO/i, /costo se lleva|costo es el/i]],
  ["¿Qué productos tienen costo creciente y precio estancado?", "gap:sin_serie", [/serie temporal de costo y precio/i, /No lo invento/i]],
  ["¿Qué clientes deberían revisar lista de precios?", "focus:causa_precio", [/por el PRECIO/i, /markup/i]],
  ["¿Qué productos deberían subir precio?", "focus:subir_precio", [/Candidatos a subir precio/i, /elasticidad/i]],
  ["¿Qué proveedores están presionando más el margen?", "gap:proveedor", [/proveedor/i, /MARCAS/i, /Samsung|LG|Philips|Bosch/]],
  ["¿Qué mix cliente-SKU genera peor margen?", "gap:mix_cliente_sku", [/matriz transaccional cliente×SKU/i, /No lo invento/i]],
  ["¿Qué productos de alto margen están subpenetrados?", "focus:alto_margen_subpenetrado", [/alto margen y baja penetraci[oó]n/i, /MAK-SAW18V/]],
  ["¿Qué bodegas tienen alto stock en productos de bajo margen?", "focus:stock_bajo_margen", [/stock parado en productos de bajo margen/i, /Santiago/]],
  ["¿Qué canales generan volumen con bajo margen?", "focus:alto_volumen_bajo_margen", [/m[aá]s venden y peor margen/i, /Retail/]],
  ["¿Qué vendedores venden más, pero reducen margen?", "gap:vendedor", [/vendedor/i, /No lo invento/i, /Lo m[aá]s cercano/i]],
  ["¿Qué acciones comerciales deterioran más el margen?", "focus:palancas", [/que m[aá]s consume margen/i, /Carga\/rebates/i]],
  ["¿Qué decisiones permitirían recuperar margen sin sacrificar demasiado volumen?", "focus:palancas", [/que m[aá]s consume margen/i, /volumen-safe|sin resignar volumen/i]],
];

console.log("── (1) detectMarginFocus + answerADIFromSpec · las 25 responden LO ESPECÍFICO (nunca el genérico de 3 focos) ──");
let noneGeneric = true;
CASES.forEach(([q, tag, must], i) => {
  const { m, txt } = answer(q);
  const gotTag = m.gap ? ("gap:" + m.gap) : ("focus:" + m.focus + (m.negativo ? "(neg)" : m.pct ? "(pct)" : ""));
  const tagOk = gotTag === tag;
  const notGeneric = !GENERIC.test(txt);
  if (!notGeneric) noneGeneric = false;
  const contentOk = must.every((re) => re.test(txt));
  ok(`Q${i + 1} [${gotTag}] ${tagOk ? "" : "TAG≠" + tag + " "}${notGeneric ? "" : "GENERIC "}${contentOk ? "responde" : "FALTA-MARCADOR"} · ${q.slice(0, 42)}…`, tagOk && notGeneric && contentOk);
});

console.log("\n── (2) checks madre ──");
ok("MADRE · NINGUNA de las 25 cae al diagnóstico genérico de 3 focos", noneGeneric);
ok("18 respondibles lideran con foco específico · 7 huecos avisan honesto (No lo invento + Lo más cercano)", (() => {
  let real = 0, gaps = 0;
  for (const [q] of CASES) { const { m, txt } = answer(q); if (m.gap) { gaps++; if (!/No lo invento/i.test(txt) || !/Lo m[aá]s cercano/i.test(txt)) return false; } else { real++; } }
  return real === 18 && gaps === 7;
})());
// no hijack de rutas legítimas
ok("NO hijack · '¿dónde estoy perdiendo dinero?' NO es margen (sigue siendo diagnose)", F("¿dónde estoy perdiendo dinero?").isMargin === false);
ok("NO hijack · 'capital inmovilizado' NO es margen", F("¿dónde está mi capital inmovilizado?").isMargin === false);
ok("NO hijack · simulación 'subí el margen 2 puntos' NO es lectura de margen", F("¿qué pasa si subo el margen 2%?").isMargin === false);

console.log(`\n── _margen_focus_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
