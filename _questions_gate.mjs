/* === _questions_gate.mjs · GATE de PREGUNTAS REALES de negocio (no tests técnicos · owner 2026-07-06) ===
 * Regla de producto: si el dato existe → ADI responde · si no existe → NO inventa (el hueco se declara acá también).
 * Crece por set (inventario primero). Prueba que el MOTOR ya produce la respuesta con el dato de hoy. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_qge.js"), out = path.join(root, "_qgb.mjs");
fs.writeFileSync(entry, [
  'export { diagnoseInventario, diagnoseInventarioSku, diagnoseSkus, concentracion } from "./src/adi/diagnosis/economicDiagnosis.js";',
  'export { skuInventario } from "./src/data/demoData.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { diagnoseInventario, diagnoseInventarioSku, diagnoseSkus, concentracion, skuInventario: SK } = M;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };

const DI = diagnoseInventario(SK), DS = diagnoseSkus(SK);

console.log("── SET INVENTARIO · el dato EXISTE → ADI responde ──");
ok("Q1 · ¿Qué SKU me hacen perder plata? → capital_frenado (ata caja)", DI.dist.capital_frenado && DI.dist.capital_frenado.usd > 0 && DI.perSku.some((s) => s.estado === "capital_frenado"));
ok("Q3 · ¿Qué familias necesitan reposición urgente? → familias con riesgo_quiebre", DI.byFamilia.filter((f) => f.estados.riesgo_quiebre && f.estados.riesgo_quiebre.usd > 0).length >= 1);
ok("Q4 · ¿Qué bodegas tienen exceso de inventario? → bodegas con frenado/sobrestock", DI.byBodega.filter((b) => b.estados.capital_frenado || b.estados.sobrestock).length >= 1);
ok("Q7 · ¿Qué SKU llevan +90 días sin venderse? → filtro directo (2 SKU)", SK.filter((s) => s.diasSinVenta > 90).length === 2);
ok("Q8 · ¿Qué familias concentran el capital inmovilizado? → frenado por familia (rankeado)", (() => { const f = DI.byFamilia.filter((x) => x.estados.capital_frenado && x.estados.capital_frenado.usd > 0); return f.length >= 1; })());
ok("Q9 · ¿Qué SKU venden mucho pero dejan bajo margen? → el diagnóstico CRUZA venta×margen por SKU (respondible · en este demo: ninguno, los de bajo margen no rotan → respuesta honesta)", Object.values(DS).length === SK.length && Object.values(DS).every((d) => ["alta", "media", "baja"].includes(d.ventaEscala) && ["alto", "medio", "bajo"].includes(d.margenCalidad)));
ok("Q13 · ¿Dónde está el mayor sobrestock? → estado sobrestock (dónde SOBRA)", DI.dist.sobrestock && DI.dist.sobrestock.usd > 0 && DI.perSku.some((s) => s.estado === "sobrestock"));
ok("Q14 · ¿Qué SKU tienen rotación inferior al objetivo? → rot < POLICY.rotacionMin (3 SKU)", SK.filter((s) => s.rotacion < 2).length === 3);
ok("Q15 · ¿Qué combinación de SKU explica el 80% del capital atrapado? → concentración de frenado ≥ 80%", (() => { const fr = SK.filter((s) => diagnoseInventarioSku(s) === "capital_frenado").map((s) => ({ nombre: s.sku, valor: s.stockUSD })); return concentracion(fr, 0.8).totalCubiertoPct >= 80; })());
ok("Q21(inv) · ¿Qué SKU tienen alta demanda pero venta limitada por quiebre? → riesgo_quiebre (corta venta)", DI.dist.riesgo_quiebre && DI.dist.riesgo_quiebre.usd > 0);
ok("Q20(mgn) · ¿Qué productos de alto margen están subpenetrados? → SKU alto margen + baja venta", Object.values(DS).some((d) => d.patron === "alto_margen_subpenetrado"));
// composición del riesgo por familia (A+B): el quiebre y el frenado viven en familias DISTINTAS
ok("· ¿Dónde vive cada riesgo? → quiebre y frenado en familias distintas (composición, no un blob)", (() => { const q = DI.byFamilia.filter((f) => f.estados.riesgo_quiebre).map((f) => f.nombre); const fr = DI.byFamilia.filter((f) => f.estados.capital_frenado).map((f) => f.nombre); return q.length && fr.length && !q.every((n) => fr.includes(n)); })());

console.log("\n── SET INVENTARIO · el dato NO EXISTE → ADI NO inventa (hueco declarado) ──");
ok("Q5 · ¿Qué clientes explican el stock? → SIN cruce (inventario es de bodega, no cliente) · ADI debe decirlo, no inventar", SK.every((s) => s.cliente === undefined && s.nombre === undefined));
ok("Q6 · ¿Qué productos crecen más rápido? → SIN histórico de SKU (no hay periodo anterior) · no computable", SK.every((s) => s.vendidoMesAnt === undefined && s.anterior === undefined));

console.log(`\n── _questions_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
