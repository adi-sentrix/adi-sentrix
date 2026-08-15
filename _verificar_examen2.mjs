/* Verificación del Examen 2 contra la carpeta — los cuatro puntos que pidió el owner. OFFLINE, cero costo. */
import fs from "node:fs";
import { proyectarDatoNegocio, cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
const S = JSON.parse(fs.readFileSync("_examen_estado.json", "utf8"));
const T = S.turnos.map((t) => t.visible);
const est = cifrasDelDato(ESCENARIO_INICIAL).estados || [];
const FREN = new Set(est.filter((e) => e.estado === "frenado").map((e) => e.entidad));
const INMOV = new Set(est.filter((e) => e.estado === "inmovilizado").map((e) => e.entidad));
const dato = proyectarDatoNegocio(ESCENARIO_INICIAL);
const filas = new Map();
for (const l of dato.split("\n")) {
  const m = l.match(/- ([A-Z0-9-]+) \(bodega [^)]+\) — Capital \$(\d+)K.*?Rotación ([\d.]+)x.*?margen de inventario ([\d.]+)%/);
  if (m) filas.set(m[1], { cap: +m[2], rot: m[3] + "x", mar: m[4] + "%" });
}
const P = (b) => (b ? "✅" : "🔴");
console.log(`── VERIFICACIÓN · escenario ${ESCENARIO_INICIAL} · declarados: ${FREN.size} frenados, ${INMOV.size} inmovilizados\n`);

console.log("1 · INMOVILIZADO ≠ FRENADO");
console.log(`  ${P(/5 SKU inmovilizados/i.test(T[0]) && /3 (?:están )?frenados/i.test(T[0]))} Q1 separa las dos categorías con sus conteos (5 y 3)`);
console.log(`  ${P(/\$56K/.test(T[0]) && /\$33K/.test(T[0]))} …y con sus dos montos ($56K amplio · $33K crítico)`);
const malFrenado = [...INMOV].filter((s) => !FREN.has(s)).filter((s) => T.some((t) => new RegExp(`${s}[^.\\n;]{0,60}frenad`, "i").test(t)));
console.log(`  ${P(malFrenado.length === 0)} ningún SKU inmovilizado-no-crítico llamado «frenado»${malFrenado.length ? " — " + malFrenado.join(", ") : ""}`);

console.log("\n2 · UNIVERSOS");
const cruce = T.filter((t) => /margen de inventario[^.\n;]{0,80}benchmark/i.test(t) || /benchmark[^.\n;]{0,80}margen de inventario/i.test(t));
console.log(`  ${P(cruce.length === 0)} ninguna comparación de margen de inventario contra el benchmark comercial`);
const bare = T.filter((t) => /\bmargen\b(?!\s+(?:de\s+)?(?:inventario|venta|ventas|comercial))[^.\n;]{0,20}\d/i.test(t));
console.log(`  ${P(bare.length === 0)} ninguna cifra de margen sin decir de qué universo (${bare.length} turnos con «margen» a secas)`);

console.log("\n3 · RANKING · alcance declarado");
const q4 = T[3] || "";
const nFilas = (q4.match(/^- [A-Z]{2,4}-/gm) || []).length;
console.log(`  ${P(/completo/i.test(q4))} Q4 declara que el ranking es completo`);
console.log(`  ${P(nFilas >= 12)} …y muestra ${nFilas} de ${filas.size} SKU`);
let malas = 0;
for (const l of q4.split("\n")) {
  const m = l.match(/^- ([A-Z0-9-]+) — Rotación ([\d.]+x) · margen inventario ([\d.]+%)/);
  if (!m) continue;
  const r = filas.get(m[1]);
  if (!r || r.rot !== m[2] || r.mar !== m[3]) { malas++; console.log(`     🔴 ${m[1]}: dijo ${m[2]}/${m[3]} · dato ${r ? r.rot + "/" + r.mar : "(no existe)"}`); }
}
console.log(`  ${P(malas === 0)} …y cada fila coincide con el dato`);

console.log("\n4 · VENTA PERDIDA");
const q5 = T[4] || "";
console.log(`  ${P(/no puedo estimar|sin inventar/i.test(q5))} Q5 declara que no puede estimar el impacto`);
console.log(`  ${P(/no una proyección|no tengo cómo sostener|nunca una venta registrada/i.test(q5))} …y separa lo que el dato soporta de lo que sería especulación`);
console.log(`  ${P(!/venta perdida (?:sería|es|de \$)/i.test(q5))} …sin poner una cifra de venta perdida`);
