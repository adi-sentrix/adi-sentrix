/* === _ventas_focus_gate.mjs · GATE end-to-end del FOCO de ventas ("la pregunta manda el foco" · owner 2026-07-06) ===
 * Las 25 preguntas del set de ventas, camino completo: (1) el coerce (detectVentasFocus → si cede, detectInventoryFocus)
 * elige el foco/hueco o rutea a inventario · (2) answerADIFromSpec produce la respuesta. Check MADRE: NINGUNA cae al
 * "diagnóstico genérico de 3 focos"; los focos lideran con lo específico; los huecos avisan honesto; Q20/Q21 van a
 * inventario (no al genérico ni a compare); Q7 avisa el hueco de serie mensual (no cae en compare-necesita-2-entidades). */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_vge.js"), out = path.join(root, "_vgb.mjs");
fs.writeFileSync(entry, [
  'export { detectVentasFocus } from "./src/adi/ventasFocus.js";',
  'export { detectInventoryFocus } from "./src/adi/inventoryFocus.js";',
  'export { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { detectVentasFocus: FV, detectInventoryFocus: FI, answerADIFromSpec: A } = M;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
const GENERIC = /3 focos donde se pierde|Diagn[oó]stico · (base real|escenario)/;
// coerce (replica el orden de la cadena: ventas primero; si cede, inventario)
function coerce(q) {
  const v = FV(q);
  if (v.isVentas) return { tag: v.gap ? "ventas:gap:" + v.gap : "ventas:" + v.focus, spec: { schemaVersion: 1, scenario: "actual", operation: "ventas", metric: "ventas", dimension: v.dimension || "cliente", focus: v.focus, gap: v.gap, pivotFocus: v.pivotFocus } };
  const inv = FI(q);
  if (inv.isInventory) return { tag: "inventory:" + inv.focus, spec: { schemaVersion: 1, scenario: "actual", operation: "inventory", metric: "capital", dimension: inv.dimension || "bodega", focus: inv.focus, staleDays: inv.staleDays } };
  return { tag: "overview", spec: { schemaVersion: 1, scenario: "actual", operation: "overview", metric: "ventas", dimension: "cliente" } };
}
const ans = (q) => { const { tag, spec } = coerce(q); const r = A(spec, {}, {}); return { tag, txt: (r && (r.text || r.opener)) || "" }; };

// [pregunta, tag esperado, [regex que DEBE contener]]
const CASES = [
  ["¿Cómo va la venta real versus el presupuesto del período?", "ventas:vs_presupuesto", [/\+3\.1% sobre presupuesto/i, /\$100\.0M vs \$97\.0M/]],
  ["¿Qué clientes, sucursales, canales o familias explican la mayor desviación contra presupuesto?", "ventas:vs_presupuesto", [/sobre presupuesto/i, /Falabella/]],
  ["¿Qué parte de la brecha contra presupuesto viene por menor volumen, menor precio promedio o menor frecuencia de compra?", "ventas:descomposicion_vol_precio", [/volumen y precio/i, /m[aá]s unidades/i, /frecuencia (no la tengo|de compra)/i]],
  ["¿Cómo va la venta versus el mismo período del año anterior?", "ventas:vs_anterior", [/\+7\.6% vs el año anterior/i]],
  ["¿Qué clientes, SKU, familias o sucursales explican el crecimiento versus año anterior?", "ventas:explica_yoy", [/vs el año anterior/i, /Lider/]],
  ["¿Qué clientes, SKU, familias o sucursales explican la caída versus año anterior?", "ventas:explica_yoy", [/vs el año anterior/i]],
  ["¿Cómo va la venta versus el mes anterior o período inmediatamente anterior?", "ventas:gap:sin_serie_mensual", [/MES anterior/i, /No lo invento/i]],
  ["¿La variación de ventas viene por más unidades vendidas, mayor precio promedio o cambio de mix?", "ventas:descomposicion_vol_precio", [/volumen y precio/i]],
  ["¿Qué sucursales o puntos de venta están sobre presupuesto y cuáles están bajo presupuesto?", "ventas:gap:sin_sucursal", [/SUCURSAL/i, /No lo invento/i]],
  ["¿Qué sucursales venden menos que el año anterior pese a tener stock disponible?", "ventas:gap:sin_sucursal", [/SUCURSAL/i, /No lo invento/i]],
  ["¿Qué sucursales tienen crecimiento real y cuáles solo crecen por efecto precio?", "ventas:gap:sin_sucursal", [/SUCURSAL/i]],
  ["¿Qué sucursales tienen caída por menor tráfico, menor ticket promedio o menor conversión?", "ventas:gap:sin_sucursal", [/SUCURSAL/i]],
  ["¿Cómo evoluciona el ticket promedio por sucursal, canal, cliente y vendedor?", "ventas:precio_realizado", [/no tengo ticket promedio real/i, /precio promedio realizado/i]],
  ["¿Qué sucursales tienen alto tráfico o volumen de transacciones, pero bajo ticket promedio?", "ventas:gap:sin_sucursal", [/SUCURSAL/i]],
  ["¿Qué clientes o puntos de venta aumentaron ticket promedio versus el año anterior?", "ventas:precio_realizado", [/ticket promedio real/i, /precio promedio realizado/i]],
  ["¿Qué clientes o sucursales compran con menor frecuencia que antes?", "ventas:gap:sin_frecuencia", [/FRECUENCIA/i, /No lo invento/i]],
  ["¿Qué clientes activos dejaron de comprar o redujeron fuertemente su compra?", "ventas:caida_clientes", [/retroceden vs el año anterior/i, /La Polar/]],
  ["¿Qué clientes nuevos aportaron venta relevante y cuánto explican del crecimiento?", "ventas:explica_yoy", [/vs el año anterior/i]],
  ["¿Qué SKU generan mayor venta y cómo comparan contra presupuesto y año anterior?", "ventas:rank_venta", [/SKU que m[aá]s venden/i, /SAM-TV55/, /no tengo presupuesto ni año anterior POR SKU/i]],
  ["¿Qué SKU tienen caída de venta pese a tener stock suficiente?", "inventory:frenado", [/capital inmovilizado|frenad/i]],
  ["¿Qué SKU tienen alta demanda, pero la venta está limitada por quiebres o baja disponibilidad?", "inventory:quiebre", [/reposici[oó]n|riesgo de quiebre|se van a cortar/i]],
  ["¿Qué familias están ganando o perdiendo participación dentro del mix de ventas?", "ventas:mix_familia", [/mix de ventas/i, /participaci[oó]n/i]],
  ["¿Qué familias están bajo presupuesto y qué SKU explican esa desviación?", "ventas:vs_presupuesto", [/sobre presupuesto/i, /agregado de los clientes/i]],
  ["¿Qué canales venden más, pero están deteriorando ticket promedio, frecuencia o mix?", "ventas:descomposicion_vol_precio", [/volumen y precio/i]],
  ["¿Qué combinación sucursal-cliente-SKU-familia explica la mayor oportunidad de recuperación de ventas?", "ventas:caida_clientes", [/retroceden|recuperaci[oó]n/i, /La Polar/]],
];

console.log("── las 25 preguntas de ventas · responden LO ESPECÍFICO / avisan honesto (nunca el genérico) ──");
let noneGeneric = true;
CASES.forEach(([q, tag, must], i) => {
  const { tag: got, txt } = ans(q);
  const tagOk = got === tag, notGen = !GENERIC.test(txt), contentOk = must.every((re) => re.test(txt));
  if (!notGen) noneGeneric = false;
  ok(`Q${i + 1} [${got}] ${tagOk ? "" : "TAG≠" + tag + " "}${notGen ? "" : "GENERIC "}${contentOk ? "responde" : "FALTA-MARCADOR"} · ${q.slice(0, 40)}…`, tagOk && notGen && contentOk);
});

console.log("\n── checks madre ──");
ok("MADRE · NINGUNA de las 25 cae al diagnóstico genérico de 3 focos", noneGeneric);
ok("Q20/Q21 (stock/quiebre) → INVENTARIO (no ventas, no genérico)", coerce("¿Qué SKU tienen caída de venta pese a tener stock suficiente?").tag.startsWith("inventory") && coerce("¿Qué SKU tienen alta demanda, pero la venta está limitada por quiebres o baja disponibilidad?").tag.startsWith("inventory"));
ok("Q7 (mes anterior) → hueco de serie mensual (NO cae en compare-necesita-2-entidades)", (() => { const { txt } = ans("¿Cómo va la venta versus el mes anterior o período inmediatamente anterior?"); return /serie mensual/i.test(txt) && !/necesito exactamente dos entidades/i.test(txt); })());
ok("NO hijack · 'capital inmovilizado' NO es ventas (cede a inventario)", FV("¿dónde está mi capital inmovilizado?").isVentas === false);
ok("NO hijack · 'bajo margen mínimo' NO es ventas", FV("¿Qué clientes están bajo margen mínimo?").isVentas === false);
ok("NO hijack · simulación 'si vendo 10% más' NO es lectura de ventas", FV("¿qué pasa si vendo 10% más?").isVentas === false);

console.log(`\n── _ventas_focus_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
