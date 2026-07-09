/* === _routing_gate.mjs · GATE de RUTEO end-to-end (barrido de robustez · owner 2026-07-06) ===
 * Corre fraseos COLOQUIALES (Chile) por la cadena real coerceSpec y verifica que ruteen al dominio+foco correcto, sin caer
 * al genérico. Nace del barrido de 130 fraseos (22% → 88% OK tras endurecer los detectores). Acá se lockean los casos
 * NO ambiguos + los bugs que el barrido cazó (compare-hijack "vs el año pasado" · "SKU frenados" · "ajustar precios" ·
 * "80% de cuántos" · "plata pegada en stock" · SIM_PCT con "30%"/"80%"). Protege que el ruteo no se degrade. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_roe.js"), out = path.join(root, "_rob.mjs");
fs.writeFileSync(entry, ['export { coerceSpec } from "./src/adi/coerceChain.js";', 'export { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";'].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { coerceSpec: C, answerADIFromSpec: A } = M;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
const GENERIC = /3 focos donde se te va|Diagn[oó]stico · (base real|escenario)/;
const base = (q) => { const cmp = /\b(compar|versus|vs\.?)\b|\bcontra\s/i.test(q); return { schemaVersion: 1, operation: cmp ? "compare" : "overview", metric: "ventas", dimension: "cliente", ...(cmp ? { comparison: { entities: ["Lider"] } } : {}) }; };
// [pregunta coloquial, dominioEsperado, focoEsperado(o null=cualquiera dentro del dominio)]
const CASES = [
  // inventario
  ["oye, cuánta plata tengo dormida en el bodegón que no se mueve?", "inventory", null],
  ["qué se me va a cortar pronto que tengo que reponer ya", "inventory", "quiebre"],
  ["qué tengo que pedir altiro antes que se me acabe", "inventory", "quiebre"],
  ["en qué tengo demasiado stock, más de lo que necesito", "inventory", "sobrestock"],
  ["muéstrame lo que tengo sobrado en bodega", "inventory", "sobrestock"],
  ["qué llevo meses sin vender, productos que no salen", "inventory", "stale"],
  ["qué SKU están frenados?", "inventory", "frenado"],
  ["qué productos liquido este mes", "inventory", null],
  // margen
  ["quiénes me están quedando abajo del margen que debería sacar?", "margin", "bajo_benchmark"],
  ["que productos estan por debajo del 30% de margen?", "margin", "bajo_benchmark"],
  ["el margen bajo es porque estoy vendiendo muy barato?", "margin", "causa_precio"],
  ["aca el costo se me disparo y por eso quedo poco margen?", "margin", "causa_costo"],
  ["a quien le puedo subir el precio sin que se me arranque", "margin", "subir_precio"],
  ["dame los candidatos para meterle mano al precio", "margin", "subir_precio"],
  ["donde hay espacio para ajustar precios hacia arriba", "margin", "subir_precio"],
  ["que joyitas de buen margen no le estoy vendiendo a nadie", "margin", "alto_margen_subpenetrado"],
  ["cuanto me chupan los rebates y los descuentos que doy", "margin", "palancas"],
  ["donde se me va el margen en cargas, fletes y esas cosas", "margin", "palancas"],
  // ventas
  ["¿Cómo vamos contra el presupuesto este mes?", "ventas", "vs_presupuesto"],
  ["¿Estamos vendiendo más que el año pasado o menos?", "ventas", "vs_anterior"],
  ["¿cómo va la venta vs el año pasado?", "ventas", "vs_anterior"],
  ["La variación que traigo, ¿es por volumen o por precio?", "ventas", "descomposicion_vol_precio"],
  ["¿A cuánto me está saliendo el ticket promedio?", "ventas", "precio_realizado"],
  ["¿Qué familias de producto pesan más en la venta?", "ventas", "mix_familia"],
  ["¿Cuáles son los productos que más me venden?", "ventas", "rank_venta"],
  ["¿Cómo va la venta desglosada por sucursal?", "ventas", null],
  // contribución
  ["¿Quién sostiene mi contribución?", "contribucion", "concentracion"],
  ["oye, cuantos clientes me estan bancando casi toda la plata?", "contribucion", "concentracion"],
  ["el ochenta por ciento de lo que me queda viene de cuantos?", "contribucion", "concentracion"],
  ["cuanta plata deje sobre la mesa que pude haber ganado?", "contribucion", "no_capturada"],
  ["hazme el ranking de los que mas me aportan", "contribucion", "rank"],
  ["quien me pone mas plata en el bolsillo al final del dia?", "contribucion", "rank"],
  // compare (control · NO deben irse a un dominio de foco)
  ["compará Falabella vs Lider", "compare", null],
  ["Falabella vs Lider", "compare", null],
];

console.log("── ruteo coloquial · dominio+foco correcto, nunca genérico ──");
let genericCount = 0;
for (const [q, dom, foc] of CASES) {
  const s = C(q, base(q), false);
  let r; try { r = A(s, {}, {}); } catch (e) { r = { text: "THROW:" + e.message }; }
  const txt = (r && (r.text || r.opener)) || "";
  const gen = GENERIC.test(txt); if (gen) genericCount++;
  const domOk = s.operation === dom;
  const focOk = foc == null || s.focus === foc || s.gap === foc.replace(/^gap:/, "");
  ok(`[${s.operation}/${s.focus || s.gap || "-"}] ${domOk ? "" : "DOM≠" + dom + " "}${focOk ? "" : "FOC≠" + foc + " "}${gen ? "GEN " : ""}${q.slice(0, 40)}…`, domOk && focOk && !gen);
}

console.log("\n── checks madre ──");
ok("NINGÚN fraseo cae al diagnóstico genérico de 3 focos", genericCount === 0);
ok("compare-hijack · 'vs el año pasado' NO pide comparar-vs-entidad (va a ventas)", C("¿cómo va la venta vs el año pasado?", base("¿cómo va la venta vs el año pasado?"), false).operation === "ventas");
ok("compare-hijack · 'compárame la venta con el año pasado' → ventas (no compare de entidades)", C("compárame la venta con el año pasado", { schemaVersion: 1, operation: "compare", metric: "ventas", dimension: "cliente", comparison: { entities: ["X"] } }, false).operation === "ventas");
ok("SIM_PCT · '30% de margen' NO es simulación (rutea a margen)", C("qué productos estan por debajo del 30% de margen", base(""), false).operation === "margin");
ok("SIM_PCT · '80% de la contribución' NO es simulación (rutea a contribución)", C("en cuántos clientes está el 80% de mi contribución", base(""), false).operation === "contribucion");
ok("SANEO · filtro-ruido del LLM ({margen:'mínimo'}) se descarta al coercer (no degrada)", (() => { const s = C("¿quiénes están bajo el margen mínimo?", { ...base(""), filters: { margen: "mínimo" } }, false); return s.operation === "margin" && (!s.filters || !s.filters.margen); })());
ok("SANEO · un filtro REAL (cliente) sobrevive al coercer", (() => { const s = C("¿cómo viene el margen de la cartera?", { ...base(""), filters: { cliente: "Lider" } }, false); return s.operation === "margin" && s.filters && s.filters.cliente === "Lider"; })());
// sweep de calidad 2026-07-09 · panorama pelado + entidad-pronombre del LLM
ok("PANORAMA · '¿cómo vengo?' → diagnose (no dive sin entidad)", C("¿cómo vengo?", { schemaVersion: 1, operation: "dive", metric: "margen", dimension: "cliente", entity: null }, false).operation === "diagnose");
ok("PANORAMA · 'cómo vamos' → diagnose", C("cómo vamos", { schemaVersion: 1, operation: "dive", metric: "margen", dimension: "cliente", entity: "tú" }, false).operation === "diagnose");
ok("PRONOMBRE · entity 'tú' del LLM se anula (el seam repregunta, no degrada raro)", (() => { const s = C("¿cómo viene ese tema?", { schemaVersion: 1, operation: "dive", metric: "margen", dimension: "cliente", entity: "tú" }, false); return s.entity == null; })());
ok("PRONOMBRE · entidad REAL no se toca", (() => { const s = C("profundiza en Jumbo", { schemaVersion: 1, operation: "dive", metric: "margen", dimension: "cliente", entity: "Jumbo" }, false); return s.entity === "Jumbo"; })());
// saludo/ayuda (primera impresión · sweep simple 2026-07-09): pelados → bienvenida meta, no lectura random
ok("SALUDO · 'hola' → meta saludo (bienvenida determinística)", (() => { const s = C("hola", base(""), false); return s.turn_type === "meta_question" && s.meta === "saludo"; })());
ok("SALUDO · 'ayuda' → meta saludo", (() => { const s = C("ayuda", base(""), false); return s.turn_type === "meta_question" && s.meta === "saludo"; })());
ok("SALUDO · 'hola, cómo viene el margen' NO es saludo pelado (rutea a margen)", C("hola, cómo viene el margen", base(""), false).operation === "margin");
// crash en PROD 2026-07-09 · filters:null explícito del LLM (default {} no aplica con null → "null (reading 'marca')")
ok("FILTERS:NULL · coerceSpec lo normaliza a undefined", (() => { const s = C("ventas", { schemaVersion: 1, operation: "overview", metric: "ventas", dimension: "cliente", entity: null, filters: null }, false); return s.filters === undefined; })());
ok("FILTERS:NULL · el spec EJECUTA la lectura (no executor-error, no crash)", (() => { const s = C("ventas", { schemaVersion: 1, operation: "overview", metric: "ventas", dimension: "cliente", entity: null, filters: null }, false); const r = A(s, {}, { scenario: "bonanza" }); return r.route !== "spec_blocked_executor-error" && /vs el año anterior/.test(r.text || ""); })());
ok("EXECUTOR-ERROR · el texto al usuario NO trae el mensaje crudo de JS", (() => { const r = A({ schemaVersion: 1, operation: "ventas", metric: "ventas", dimension: "cliente", focus: "vs_anterior", filters: { get marca() { throw new Error("boom interno"); } } }, {}, { scenario: "bonanza" }); return !/boom interno|Cannot read/.test(r.text || ""); })());

console.log(`\n── _routing_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
