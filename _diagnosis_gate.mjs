/* === _diagnosis_gate.mjs · GATE del motor de DIAGNÓSTICOS calculados por ADI ===
 * Lockea que ADI calcula el diagnóstico económico (cliente) y el de inventario (SKU) determinista, contra el dato real:
 * patrón · origen · escala/calidad/impacto · estados de inventario · distribución · materialidad del quiebre. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_dge.js"), out = path.join(root, "_dgb.mjs");
fs.writeFileSync(entry, [
  'export { diagnoseClientes, diagnoseInventario, diagnoseInventarioSku } from "./src/adi/diagnosis/economicDiagnosis.js";',
  'export { clientesVentas, clientesMargen, skuInventario } from "./src/data/demoData.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { diagnoseClientes, diagnoseInventario, diagnoseInventarioSku, clientesVentas, clientesMargen, skuInventario } = M;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };

const DC = diagnoseClientes(clientesVentas, clientesMargen);
// ── CLIENTE · patrones/origen validados con el dato real ──
ok("1 · Falabella → alto_volumen_bajo_margen · origen volumen (#1 ventas, margen bajo)", DC.Falabella.patron === "alto_volumen_bajo_margen" && DC.Falabella.origenContribucion === "volumen" && DC.Falabella.ventasEscala === "alta" && DC.Falabella.margenCalidad === "bajo");
ok("2 · Falabella · razon cita rankings reales (#1 ventas · #12 de 13 margen)", /#1 en ventas/.test(DC.Falabella.razon) && /#12 de 13/.test(DC.Falabella.razon));
ok("3 · La Polar → buen_margen_baja_contribucion · origen calidad (margen alto, plata baja)", DC["La Polar"].patron === "buen_margen_baja_contribucion" && DC["La Polar"].origenContribucion === "calidad" && DC["La Polar"].margenCalidad === "alto");
ok("4 · Tottus → cuenta_sana_para_escalar · mix_balanceado", DC.Tottus.patron === "cuenta_sana_para_escalar" && DC.Tottus.origenContribucion === "mix_balanceado");
ok("5 · Paris → volumen_medio_margen_presionado (fallback accionable · no 'mixto')", DC.Paris.patron === "volumen_medio_margen_presionado");
ok("6 · esta cartera NO tiene cliente_estrella (ADI no inventa una que no existe · volumen↔margen en tensión)", !Object.values(DC).some((d) => d.patron === "cliente_estrella"));
ok("7 · etiquetaNarrativa deriva del patrón (ADI la genera · el LLM la narra)", DC.Falabella.etiquetaNarrativa === "volumen grande con bajo margen");
ok("8 · margenCalidad graduado vs promedio interno Y benchmark declarado (no solo ranking)", DC.Falabella.benchmark === 30.1 && DC.Falabella.promedioMargen > 0 && DC["La Polar"].margenCalidad === "alto" && DC.Falabella.margenCalidad === "bajo");

// ── INVENTARIO · estados (las dos puntas) validados con el dato real ──
const byId = {}; for (const s of skuInventario) byId[s.sku] = s;
ok("9 · LG-DRYER8KG → capital_frenado (rot 1.0 / DOH 165 · ata caja)", diagnoseInventarioSku(byId["LG-DRYER8KG"]) === "capital_frenado");
ok("10 · SAM-REF500L → riesgo_quiebre (rot 9.8 / DOH 17 · corta venta)", diagnoseInventarioSku(byId["SAM-REF500L"]) === "riesgo_quiebre");
ok("11 · PHI-IRON-PRO → sobrestock (DOH 95 · vende pero cobertura excesiva)", diagnoseInventarioSku(byId["PHI-IRON-PRO"]) === "sobrestock");
ok("12 · LG-WASH11KG → capital_sano (rota bien, DOH normal)", diagnoseInventarioSku(byId["LG-WASH11KG"]) === "capital_sano");

const DI = diagnoseInventario(skuInventario);
ok("13 · distribución cubre las 4 puntas (sano/quiebre/frenado/sobrestock)", DI.dist.capital_sano && DI.dist.riesgo_quiebre && DI.dist.capital_frenado && DI.dist.sobrestock);
ok("14 · quiebre es MATERIAL en esta cartera (~27% · no es ruido)", DI.quiebreMaterial === true && DI.dist.riesgo_quiebre.pct >= 20);
ok("15 · distribución suma ~100% del capital", Math.abs(Object.values(DI.dist).reduce((a, d) => a + d.pct, 0) - 100) <= 2);

// ── MATERIALIDAD · un quiebre CHICO e irrelevante NO secuestra (owner) ──
const tiny = [
  { sku: "S1", bodega: "X", stockUSD: 200000, rotacion: 5, doh: 40 }, { sku: "S2", bodega: "X", stockUSD: 180000, rotacion: 5, doh: 40 },
  { sku: "S3", bodega: "X", stockUSD: 150000, rotacion: 5, doh: 40 }, { sku: "S4", bodega: "X", stockUSD: 120000, rotacion: 5, doh: 40 },
  { sku: "MINI-QUIEBRE", bodega: "X", stockUSD: 300, rotacion: 9, doh: 10 },  // quiebre ínfimo · <$ · <% · no top-3 por capital
];
ok("16 · quiebre chico (<$20k · <5% · no top-3 por capital) → NO material (no secuestra la respuesta)", diagnoseInventario(tiny).quiebreMaterial === false);

console.log(`\n── _diagnosis_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
