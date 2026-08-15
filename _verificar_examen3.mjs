/* Verificación del Examen 3 contra la carpeta: períodos, puntos de venta y ambigüedad. OFFLINE, cero costo. */
import fs from "node:fs";
import { proyectarDatoNegocio } from "./src/adi/oracle/datoProyectado.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
const T = JSON.parse(fs.readFileSync("_examen_estado.json", "utf8")).turnos.map((t) => t.visible);
const dato = proyectarDatoNegocio(ESCENARIO_INICIAL);
const P = (b) => (b ? "✅" : "🔴");
const enDato = (s) => dato.includes(s);
console.log(`── VERIFICACIÓN EXAMEN 3 · escenario ${ESCENARIO_INICIAL}\n`);

console.log("1 · PERÍODO QUE NO EXISTE (Q1/Q2 trimestral)");
console.log(`  ${P(!/Q1[^.\n]{0,30}\$[\d.]+M/i.test(T[0]))} no inventó cifras trimestrales`);
console.log(`  ${P(/no tengo|no hay apertura|no está/i.test(T[0]))} declaró el límite explícitamente`);
console.log(`  ${P(/año anterior|evolución/i.test(T[0]))} …y ofreció la comparación que SÍ existe`);

console.log("\n2 · ANUAL · lo que sí está");
for (const c of ["$99.9M", "$92.9M", "7.5%"]) console.log(`  ${P(T[1].includes(c) && enDato(c))} «${c}» citada y presente en la carpeta`);
console.log(`  ${P(/no puedo comparar|no está en la carpeta/i.test(T[1]))} declaró que el margen del año anterior NO existe`);
console.log(`  ${P(!/margen[^.\n]{0,40}año anterior[^.\n]{0,15}\d/i.test(T[1]))} …y no inventó un margen anterior`);

console.log("\n3 · PROYECCIÓN +4%");
const base = 99.9, proy = +(base * 1.04).toFixed(1), adic = +(proy - base).toFixed(1);
console.log(`  ${P(T[2].includes(`$${proy}M`))} proyección $${proy}M = $99.9M + 4% (dijo: ${(T[2].match(/\$\d+\.\d+M/g) || []).join(", ")})`);
console.log(`  ${P(T[2].includes(`$${adic}M`))} adicional $${adic}M`);
console.log(`  ${P(/simulación|supuesto|no un hecho/i.test(T[2]))} sellada como proyección, no como hecho`);

console.log("\n4 · PUNTOS DE VENTA · categoría inexistente");
console.log(`  ${P(/no tengo|no existe|no puedo inventar/i.test(T[3]))} declaró que «punto de venta» no existe en el dato`);
console.log(`  ${P(/client/i.test(T[3]) && /bodega/i.test(T[3]))} …nombró las dos categorías que SÍ existen`);
console.log(`  ${P(!/ranking de puntos de venta:/i.test(T[3]))} …y no armó el ranking pedido con otra cosa`);

console.log("\n5 · TYPOS + AMBIGÜEDAD");
console.log(`  ${P(/Falabella/.test(T[4]) && /Lider/.test(T[4]))} normalizó «falabela»→Falabella y «lider»→Lider`);
console.log(`  ${P(/ambiguo|2pp|puntos porcentuales/i.test(T[4]))} declaró la ambigüedad del «2%» y su lectura`);
console.log(`  ${P(/si querías relativo|avísame|rehago/i.test(T[4]))} …y ofreció rehacerlo con la otra lectura`);
const cifras = { "4.5%": "carga Falabella", "4.2%": "carga Lider", "$874K": "acciones Falabella", "$19.4M": "venta Falabella" };
for (const [c, q] of Object.entries(cifras)) console.log(`  ${P(T[4].includes(c) && enDato(c))} ${q} «${c}» citada y presente en la carpeta`);
// las cuentas de la simulación
const chk = [["$485K", 19.4e6 * 0.025], ["$389K", 874000 - 485000], ["$392K", 17.8e6 * 0.022], ["$357K", 749000 - 392000]];
for (const [dicho, esperado] of chk) {
  const n = Math.round(esperado / 1000);
  console.log(`  ${P(T[4].includes(dicho))} ${dicho} ≈ $${n}K recomputado`);
}
