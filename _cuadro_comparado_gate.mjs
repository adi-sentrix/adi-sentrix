/* === _cuadro_comparado_gate.mjs · GATE DEL GRÁFICO COMPARADO (Cuadro 2.0 · pase 1b · owner 2026-07-15) ===
 * El gráfico de fila del cuadro compara este año vs el anterior, HONESTO por entidad. Lockea:
 *   (1) ANCLA EXACTA: donde el eje declara `anterior` (clientesVentas · marcasVentas), la serie del año anterior
 *       suma EXACTO ese total — una verdad con los movers y el 80/20 (nunca el ÷1.081 uniforme del historial);
 *   (2) HONESTIDAD: sin total declarado NO se fabrica — contribución y margen sin ghost, SKUs sin ghost (skusMargen
 *       no trae `anterior`), bodega sin serie;
 *   (3) EL ACTUAL INTACTO: la serie de este año del comparado es byte-igual a buildEntityEvolution (la de la Ficha);
 *   (4) LA HISTORIA REAL SE CONSERVA: Ripley cayó vs el año anterior → su ghost queda ARRIBA del actual (el ÷1.081
 *       uniforme lo habría dibujado abajo — la mentira que este gate caza). */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_ccge.js"), out = path.join(root, "_ccgb.mjs");
fs.writeFileSync(entry, [
  'export { buildEntityEvolution, buildEntityEvolutionComparado, buildNegocioEvolution } from "./src/adi/sentrix/temporal.js";',
  'export { clientesVentas, marcasVentas, clientesMargen } from "./src/data/demoData.js";',
  'export { skusMargen } from "./src/data/skusMargen.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
const sum = (a) => a.reduce((x, y) => x + y, 0);

console.log("── (1) ancla exacta del año anterior (una verdad con los movers) ──");
for (const [tabla, nombreEje] of [[M.clientesVentas, "clientes"], [M.marcasVentas, "marcas"]]) {
  let con = 0, bad = 0;
  for (const e of tabla) {
    const cmp = M.buildEntityEvolutionComparado(e.nombre, "venta");
    if (!cmp || !cmp.anterior) { bad++; console.log(`    ✗ ${e.nombre}: sin ghost pese a anterior declarado (${e.anterior})`); continue; }
    con++;
    if (sum(cmp.anterior.serie) !== e.anterior) { bad++; console.log(`    ✗ ${e.nombre}: ghost suma ${sum(cmp.anterior.serie)} ≠ ${e.anterior}`); }
    if (cmp.anterior.serie.length !== cmp.n) { bad++; console.log(`    ✗ ${e.nombre}: largo del ghost ≠ n`); }
  }
  ok(`${nombreEje}: ${con}/${tabla.length} con ghost anclado EXACTO al anterior del eje`, con === tabla.length && bad === 0);
}

console.log("── (2) honestidad: sin ancla declarada NO se fabrica ──");
const conGhostContrib = M.clientesVentas.filter((e) => { const c = M.buildEntityEvolutionComparado(e.nombre, "contribucion"); return c && c.anterior; });
ok("contribución: 0 ghosts (el contribucionAnt del historial es ÷1.081 uniforme — contradiría el YoY real)", conGhostContrib.length === 0);
const conGhostMargen = M.clientesVentas.filter((e) => { const c = M.buildEntityEvolutionComparado(e.nombre, "margen"); return c && c.anterior; });
ok("margen: 0 ghosts (sin margen del año anterior declarado por entidad)", conGhostMargen.length === 0);
const skuGhosts = M.skusMargen.filter((s) => { const c = M.buildEntityEvolutionComparado(s.nombre, "venta"); return c && c.anterior; });
const skuConCurva = M.skusMargen.filter((s) => { const c = M.buildEntityEvolutionComparado(s.nombre, "venta"); return c && c.n >= 2; });
ok(`SKU: curva actual sí (${skuConCurva.length}/${M.skusMargen.length}) · ghost no (skusMargen no declara anterior)`, skuConCurva.length === M.skusMargen.length && skuGhosts.length === 0);
ok("bodega: sin serie mensual → sin gráfico (como hoy)", M.buildEntityEvolutionComparado("Santiago", "venta") == null);

console.log("── (3) el actual del comparado = la serie de la Ficha, byte-igual ──");
let mism = 0, comparadas = 0;
for (const nombre of ["Falabella", "Ripley", "Samsung", "SAM-TV55"]) {
  for (const met of ["venta", "contribucion", "margen"]) {
    const a = M.buildEntityEvolution(nombre, met), b = M.buildEntityEvolutionComparado(nombre, met);
    if (!a !== !b) { mism++; console.log(`    ✗ ${nombre}/${met}: existencia distinta`); continue; }
    if (!a) continue;
    comparadas++;
    if (JSON.stringify(a.serie) !== JSON.stringify(b.serie) || JSON.stringify(a.meses) !== JSON.stringify(b.meses)) { mism++; console.log(`    ✗ ${nombre}/${met}: serie del actual difiere`); }
  }
}
ok(`${comparadas} series actuales byte-iguales a buildEntityEvolution`, comparadas >= 10 && mism === 0);

console.log("── (4) la historia real se conserva (el caso que el ÷1.081 mentía) ──");
const rip = M.buildEntityEvolutionComparado("Ripley", "venta");
const ripEje = M.clientesVentas.find((e) => e.nombre === "Ripley");
ok("Ripley cayó YoY → su ghost suma MÁS que el actual (queda arriba, la caída se ve)", !!rip && !!rip.anterior && sum(rip.anterior.serie) > sum(rip.serie) && ripEje.anterior > ripEje.actual);
const fal = M.buildEntityEvolutionComparado("Falabella", "venta");
ok("Falabella creció YoY → su ghost suma MENOS que el actual", !!fal && !!fal.anterior && sum(fal.anterior.serie) < sum(fal.serie));

console.log("── (5) EL NEGOCIO (pase 1d): la suma del eje cierra con la fila Total de la tabla ──");
const negV = M.buildNegocioEvolution("cliente", "venta");
const totalEjeV = sum(M.clientesVentas.map((e) => e.actual));
ok(`negocio·venta (clientes): la serie suma EXACTO el Total del eje (${totalEjeV})`, !!negV && sum(negV.serie) === totalEjeV);
const totalEjeAnt = sum(M.clientesVentas.map((e) => e.anterior));
ok(`negocio·venta: el ghost suma EXACTO el anterior del eje (${totalEjeAnt} — el KPI anual)`, !!negV && !!negV.anterior && sum(negV.anterior.serie) === totalEjeAnt && negV.anterior.total === totalEjeAnt);
const negC = M.buildNegocioEvolution("cliente", "contribucion");
const totalEjeC = sum(M.clientesMargen.map((c) => c.contribucion));
ok(`negocio·contribución: suma EXACTO el Total del eje (${totalEjeC}) · sin ghost (honesto)`, !!negC && sum(negC.serie) === totalEjeC && !negC.anterior);
const negM = M.buildNegocioEvolution("cliente", "margen");
const wAgg = negM ? negM.serie.reduce((s, m, i) => s + m * negV.serie[i], 0) / Math.max(sum(negV.serie), 1) : null;
ok("negocio·margen: mensual = ΣC÷ΣV y el agregado pondera al margen del Total (<0.15pp) · sin ghost", !!negM && Math.abs(wAgg - (totalEjeC / totalEjeV) * 100) < 0.15 && !negM.anterior);
const negSku = M.buildNegocioEvolution("sku", "venta");
ok("negocio·SKU: curva sí · ghost no (los SKU no declaran anterior — la suma parcial mentiría)", !!negSku && negSku.n === 12 && !negSku.anterior);
ok("negocio·bodega: sin serie → sin gráfico", M.buildNegocioEvolution("bodega", "venta") == null);

console.log(`\n── _cuadro_comparado_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
