/* === _conexion_gate.mjs · GATE DE CONEXIÓN (owner 2026-07-10: "deben quedar todos conectados — fijate bien") ===
 * Toda cifra visible debe cerrar con las demás vistas de la misma entidad. Lockea:
 *   (1) las SERIES mensuales de la Ficha cierran EXACTO con el dato del período (venta · contribución · acciones)
 *       y el margen derivado (c÷v) pondera al margen del período;
 *   (2) la MATRIZ cliente×SKU cierra EXACTO por cliente (venta y contribución del cuadro, al peso) — la composición
 *       que muestra el Pareto de la Ficha ES la del cuadro. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_cge.js"), out = path.join(root, "_cgb.mjs");
fs.writeFileSync(entry, [
  'export { buildEntityEvolution } from "./src/adi/sentrix/temporal.js";',
  'export { composicionCliente, compradoresSku, _matrixMarginals } from "./src/data/clienteSkuMatrix.js";',
  'export { clientesMargen, clientesVentas, marcasMargen, sfamiliasMargen } from "./src/data/demoData.js";',
  'export { skusMargen } from "./src/data/skusMargen.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
const sum = (a) => a.reduce((x, y) => x + y, 0);

console.log("── (1) series de la Ficha ancladas al período ──");
const period = new Map();
for (const c of M.clientesMargen) { const cv = M.clientesVentas.find((x) => x.nombre === c.nombre); period.set(c.nombre, { venta: cv ? cv.actual : c.venta, contrib: c.contribucion, margen: c.margen, acciones: c.rebates }); }
for (const x of M.marcasMargen) period.set(x.nombre, { venta: x.venta, contrib: x.contribucion, margen: x.margen, acciones: x.rebates });
for (const f of M.sfamiliasMargen) period.set(f.nombre, { venta: f.venta, contrib: f.contribucion, margen: f.margen, acciones: f.rebates });
for (const s of M.skusMargen) period.set(s.nombre, { venta: s.venta, contrib: s.contribucion, margen: s.margen, acciones: s.rebates });
let series = 0, seriesBad = 0;
for (const [nombre, p] of period) {
  const V = M.buildEntityEvolution(nombre, "venta");
  if (!V) continue;
  series++;
  const C2 = M.buildEntityEvolution(nombre, "contribucion"), Mg = M.buildEntityEvolution(nombre, "margen"), A = M.buildEntityEvolution(nombre, "acciones");
  const eV = p.venta != null ? sum(V.serie) - p.venta : 0;
  const eC = C2 && p.contrib != null ? sum(C2.serie) - p.contrib : 0;
  const wM = Mg ? Mg.serie.reduce((s, m, i) => s + m * V.serie[i], 0) / Math.max(sum(V.serie), 1) : null;
  const eM = wM != null && p.margen != null ? Math.abs(wM - p.margen) : 0;
  const eA = A && p.acciones != null ? sum(A.serie) - p.acciones : 0;
  if (eV !== 0 || eC !== 0 || eM > 0.15 || eA !== 0) { seriesBad++; console.log(`    ✗ ${nombre}: dV=${eV} dC=${eC} dM=${eM.toFixed(2)}pp dA=${eA}`); }
}
ok(`las 4 series de ${series} entidades cierran con el período (venta/contrib/acciones exactas · margen <0.15pp)`, series > 20 && seriesBad === 0);

console.log("── (2) matriz cliente×SKU · el Pareto de la Ficha ES el cuadro ──");
const marg = M._matrixMarginals();
ok("por CLIENTE cierra EXACTO en venta (13/13)", marg.every((m) => m.ventaM === m.venta));
ok("por CLIENTE cierra EXACTO en contribución (13/13)", marg.every((m) => m.contribM === m.contribucion));
const abc = M.composicionCliente("ABC", "ventas");
ok("composición de ABC: filas > 1, ordenadas desc, suman su venta del cuadro", Array.isArray(abc) && abc.length > 1 && abc.every((r, i) => i === 0 || r.value <= abc[i - 1].value) && sum(abc.map((r) => r.value)) === period.get("ABC").venta);
const abcC = M.composicionCliente("ABC", "contribucion");
ok("composición de ABC en contribución: suma su contribución del cuadro", sum(abcC.map((r) => r.value)) === period.get("ABC").contrib);
const afinidad = abc[0] && M.skusMargen.find((s) => s.nombre === abc[0].name);
ok("afinidad real: el SKU top de ABC es de su marca dominante (LG)", !!afinidad && afinidad.marca === "LG");
const buyers = M.compradoresSku("SAM-TV55", "ventas");
ok("transpuesta: compradores de SAM-TV55 > 1 y Falabella (marca Samsung) lidera", Array.isArray(buyers) && buyers.length > 1 && buyers[0].name === "Falabella");
const totalMatriz = sum(marg.map((m) => m.ventaM));
ok("el total de la matriz = la venta total de clientes del cuadro", totalMatriz === sum(marg.map((m) => m.venta)));

console.log(`\n── _conexion_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
