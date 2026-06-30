// === HARNESS · paso 4 · LA HISTORIA (evolutivo) · trazabilidad + honestidad ===
// (1) cada cifra del evolutivo == recálculo independiente desde ventasMensuales (regla madre).
// (2) la regla temporal: global REAL → show · por entidad SINTÉTICO → bloqueo honesto.
import { buildGlobalEvolution } from "./src/adi/sentrix/temporal.js";
import { temporalCapability } from "./src/adi/sentrix/capability.js";
import { ventasMensuales } from "./src/data/baseKpis.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("✅", m); } else { fail++; console.log("🚨", m); } };

// — recálculo independiente desde el dato crudo —
const A = ventasMensuales.map(m => m.actual), AN = ventasMensuales.map(m => m.anterior), PP = ventasMensuales.map(m => m.presupuesto), MES = ventasMensuales.map(m => m.mes);
const sum = a => a.reduce((x, y) => x + y, 0);
const max = Math.max(...A), min = Math.min(...A);
let dd = { d: 0, mes: null }, gg = { d: 0, mes: null };
for (let i = 1; i < A.length; i++) { const d = A[i] - A[i - 1]; if (d < dd.d) dd = { d, mes: MES[i] }; if (d > gg.d) gg = { d, mes: MES[i] }; }
const totAct = sum(A), totAnt = sum(AN), totPpto = sum(PP);
const r1 = n => Math.round(n * 10) / 10;
const vsAnt = r1((totAct - totAnt) / totAnt * 100), vsPpto = r1((totAct - totPpto) / totPpto * 100);

console.log("── TRAZABILIDAD · evolutivo global vs recálculo crudo ──");
const ev = buildGlobalEvolution();
ok(ev.max === max && ev.maxMes === MES[A.indexOf(max)], `máx ${ev.max} (${ev.maxMes}) == ${max}`);
ok(ev.min === min && ev.minMes === MES[A.indexOf(min)], `mín ${ev.min} (${ev.minMes}) == ${min}`);
ok(ev.drop.delta === dd.d && ev.drop.mes === dd.mes, `mayor caída ${ev.drop.delta} (${ev.drop.mes}) == ${dd.d} (${dd.mes})`);
ok(ev.growth.delta === gg.d && ev.growth.mes === gg.mes, `mayor crecimiento ${ev.growth.delta} (${ev.growth.mes}) == ${gg.d} (${gg.mes})`);
ok(ev.totAct === totAct && ev.totAnt === totAnt && ev.totPpto === totPpto, `totales ${ev.totAct}/${ev.totAnt}/${ev.totPpto} == ${totAct}/${totAnt}/${totPpto}`);
ok(ev.vsPresupuesto === vsPpto && ev.vsAnterior === vsAnt, `vs ppto ${ev.vsPresupuesto}% · vs año ant ${ev.vsAnterior}% == ${vsPpto}%/${vsAnt}%`);
ok(ev.n === 12 && ev.nSeq === 24 && ev.seq24.length === 24, `serie 12 meses + 24 secuenciales (año ant + actual)`);
ok(ev.confidence === "high" && ev.scope === "global" && ev.metric === "ventas", `global · ventas · alta confianza`);

console.log("\n── HONESTIDAD · la regla temporal ──");
const tc = temporalCapability({ metric: "margen", entityType: "client", entity: "Lider" });
ok(tc.global.status === "show", `global → SHOW (ventas real)`);
ok(tc.perEntity.status === "blocked" && /sint[eé]tico/i.test(tc.perEntity.reason), `cliente por entidad → BLOCKED honesto: "${tc.perEntity.reason}"`);
const tcS = temporalCapability({ metric: "margen", entityType: "sku", entity: "BOS-SANDER" });
ok(tcS.perEntity.status === "blocked", `SKU por entidad → BLOCKED honesto`);
const tcG = temporalCapability();
ok(tcG.global.status === "show" && tcG.perEntity === null, `sin entidad → solo global (sin bloqueo espurio)`);

console.log("\n" + "═".repeat(52));
console.log(`GATES: ${pass}/${pass + fail}` + (fail ? " · 🚨 HAY ROJOS" : " · TODOS VERDES"));
process.exit(fail ? 1 : 0);
