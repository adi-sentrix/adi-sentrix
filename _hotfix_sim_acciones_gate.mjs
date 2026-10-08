/* === _hotfix_sim_acciones_gate.mjs · HOTFIX v2.31.1 · simulateGeneral y las ACCIONES COMERCIALES (owner 2026-10-09) ===
 * EL DEFECTO (producción v2.31): con modelo de costo `variable_total`, `simulateGeneral` calculaba
 *     contribución = venta − costo
 * ignorando las acciones comerciales (rebates). En el eje CLIENTE el costo guardado ya las incluye, pero en marca /
 * familia / SKU el costo NO las incluye (contribución publicada = venta − costo − acciones). Resultado: contribución
 * y margen simulados falsos y, peor, un «Margen actual» que no era el que el resto del producto publica (Samsung:
 * 28,6 % simulado contra 24,2 % publicado, en la base cruda del demo).
 *
 * LA REGLA (owner 2026-10-09): las acciones comerciales se derivan de la identidad de la propia fila,
 *     acciones = venta − costo − contribución(fila)
 * y, si cambia el precio, conservan su % de la venta (escalan con la venta); el volumen escala venta, costo y acciones
 * por igual. No existe en main ninguna declaración de acciones como MONTO FIJO: rige solo la regla del %.
 *
 * Qué prueba (determinístico, sin LLM, sin red, sin leer `.env`):
 *   1. «Margen actual» == margen publicado (entityRecord + marginRead + fila cruda) — cliente, marca, familia, SKU,
 *      en los 4 mundos de escenario, con pares precio/volumen 0/+x, x/0, ±.
 *   2. Identidad venta = costo + acciones + contribución, en el actual y en el supuesto.
 *   3. acciones/venta constante ante el cambio de precio (y de volumen).
 *   4. Cuenta a mano de Samsung +5 % de precio, desde las filas crudas literales (31.600 / 22.574 / 1.383).
 *   5. Camino del usuario: `setCostModelOverride` sobre un tenant SIN modelo declarado (empresa2).
 *   6. Control: en el eje cliente (acciones = 0) el resultado es el de siempre, byte a byte.
 */
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { rawRecordFor } from "./src/adi/oracle/entityRecord.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { TENANT_EMPRESA2 } from "./src/data/tenants/empresa2.js";
import { setCostModelOverride, costModelOf } from "./src/config/businessPolicy.js";
import { SOURCES } from "./src/config/contract/sourceManifest.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };
const near = (a, b, tol) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol;
const { simulateGeneral, entityRecord, marginRead } = TOOLS;
const F = (boleta, label) => boleta.find((f) => f.label === label);
const sim = (dimension, entity, precio, volumen, scenario) => simulateGeneral({
  dimension, entity, scenario,
  variableA: { campo: "precioLista", delta_pct: precio },
  variableB: { campo: "unidades", delta_pct: volumen },
});

// el mundo del escenario: `actual` es la base cruda (la que usan los demás gates de simulate), los otros tres son los
// ids declarados en SCENARIO_TRANSFORMS del demo. Las acciones comerciales viven DISTINTO en cada uno (en la base
// cruda marca/familia traen el costo SIN rebates; en bonanza/tensión/crisis el transform los mete en el costo; el
// SKU es scenario-blind y nunca los trae): por eso el gate recorre los cuatro, no uno.
const ESCENARIOS = ["actual", "bonanza", "tension", "crisis"];
const PARES = [[5, 0], [0, -10], [0, 8], [5, -10], [-8, 12], [10, 10], [-5, -5], [1, 0], [0, -1], [20, -20]];   // 0/+x, x/0, ± y mixtos
const ENTIDADES = [
  ["cliente", "Falabella"], ["cliente", "Lider"],
  ["marca", "Samsung"], ["marca", "LG"],
  ["familia", "Electrodomésticos"], ["familia", "Línea Blanca"],
  ["sku", "SAM-TV55"], ["sku", "LG-DRYER8KG"], ["sku", "MAK-COMP-AIR"],
];

initTenant(TENANT_DEMO);
console.log("── 0 · fixture · el demo declara costModel variable_total ──");
ok(costModelOf() && costModelOf().tipo === "variable_total", "demo: costModelOf() = variable_total");

console.log("\n── 1-3 · «Margen actual» publicado · identidad venta = costo + acciones + contribución · acciones/venta constante ──");
{
  let casos = 0, malos = [];
  const mal = (k) => { if (malos.length < 12) malos.push(k); };
  for (const sc of ESCENARIOS) {
    for (const [dim, ent] of ENTIDADES) {
      const rec = rawRecordFor(dim, ent, sc);
      if (!rec || typeof rec.venta !== "number" || typeof rec.costo !== "number" || typeof rec.contribucion !== "number") { mal(`${sc}/${dim}/${ent}: fila cruda incompleta`); continue; }
      // el margen que el producto PUBLICA para esta entidad: la fila (margen), entityRecord (fig «Margen») y marginRead
      const er = entityRecord({ dimension: dim, entity: ent, scenario: sc });
      const figER = er && er.boleta && F(er.boleta, `${ent} · Margen`);
      const mr = marginRead({ dimension: dim, scenario: sc });
      const figMR = mr && mr.boleta && F(mr.boleta, `${ent} · Margen`);
      const publicados = [rec.margen, figER && figER.raw, figMR && figMR.raw].filter((x) => typeof x === "number");
      const publicado = rec.margen;
      if (!publicados.every((x) => near(x, publicado, 0.05))) mal(`${sc}/${dim}/${ent}: el producto publica márgenes distintos entre sí ${JSON.stringify(publicados)}`);
      const acc0 = rec.venta - rec.costo - rec.contribucion;   // acciones comerciales implícitas en la fila, en miles
      for (const [p, v] of PARES) {
        casos++;
        const r = sim(dim, ent, p, v, sc);
        if (!r.coverage.supported) { mal(`${sc}/${dim}/${ent} ${p}/${v}: no soportado ${r.coverage.reason}`); continue; }
        const tag = `${sc}/${dim}/${ent} precio ${p}% vol ${v}%`;
        const vA = F(r.boleta, `${ent} · Venta actual`), vN = F(r.boleta, `${ent} · Venta supuesta`);
        const cA = F(r.boleta, `${ent} · Costo actual`), cN = F(r.boleta, `${ent} · Costo supuesto`);
        const kA = F(r.boleta, `${ent} · Contribución actual`), kN = F(r.boleta, `${ent} · Contribución supuesta`);
        const mA = F(r.boleta, `${ent} · Margen actual`), mN = F(r.boleta, `${ent} · Margen supuesto`);
        if (![vA, vN, cA, cN, kA, kN, mA, mN].every(Boolean)) { mal(`${tag}: faltan figs`); continue; }
        const esc = vA.raw / rec.venta;   // escala de la moneda del pack (K → 1000)
        // 1 · «Margen actual» == el margen publicado
        if (!near(mA.raw, publicado, 0.05)) mal(`${tag}: «Margen actual» ${mA.raw}% ≠ publicado ${publicado}%`);
        // y la contribución actual es la PUBLICADA (no venta − costo)
        if (!near(kA.raw / esc, rec.contribucion, 0.5)) mal(`${tag}: «Contribución actual» ${kA.raw / esc} ≠ publicada ${rec.contribucion}`);
        // 2 · identidad: acciones implícitas de la boleta (venta − costo − contribución), actual y supuesto
        const aA = (vA.raw - cA.raw - kA.raw) / esc, aN = (vN.raw - cN.raw - kN.raw) / esc;
        if (!near(aA, acc0, 0.5)) mal(`${tag}: acciones implícitas actuales ${aA.toFixed(1)} ≠ derivadas de la fila ${acc0.toFixed(1)}`);
        // 3 · acciones/venta constante: las acciones escalan con la venta (precio × volumen)
        if (!near(aN / (vN.raw / esc), aA / (vA.raw / esc), 1e-9 + 1e-6)) mal(`${tag}: acciones/venta cambió ${(aA / (vA.raw / esc) * 100).toFixed(4)}% → ${(aN / (vN.raw / esc) * 100).toFixed(4)}%`);
        // cuenta a mano desde las filas crudas
        const fp = 1 + p / 100, fv = 1 + v / 100;
        const kMano = rec.venta * fp * fv - rec.costo * fv - acc0 * fp * fv;
        if (!near(kN.raw / esc, kMano, 0.5)) mal(`${tag}: contribución supuesta ${kN.raw / esc} ≠ a mano ${kMano}`);
        const mMano = +((kMano / (rec.venta * fp * fv)) * 100).toFixed(1);
        if (!near(mN.raw, mMano, 0.051)) mal(`${tag}: margen supuesto ${mN.raw}% ≠ a mano ${mMano}%`);
        // el costo sigue escalando SOLO con el volumen
        if (!near(cN.raw / esc, rec.costo * fv, 0.5)) mal(`${tag}: costo supuesto ${cN.raw / esc} ≠ costo × volumen ${rec.costo * fv}`);
      }
    }
  }
  ok(casos === ESCENARIOS.length * ENTIDADES.length * PARES.length, `se recorrieron ${casos} simulaciones (4 escenarios × 9 entidades × 10 pares precio/volumen)`);
  ok(malos.length === 0, `margen actual publicado + identidad + acciones/venta constante + cuenta a mano en TODAS${malos.length ? " — FALLAN: " + JSON.stringify(malos, null, 1) : ""}`);
}

console.log("\n── 4 · Samsung +5 % de precio, cuenta a mano desde las filas crudas LITERALES del demo ──");
{
  // base cruda («actual»): venta 31.600 · costo 22.574 (SIN rebates) · rebates 1.383 · contribución 7.643 (miles)
  const rA = sim("marca", "Samsung", 5, 0, "actual");
  const vN = 31600 * 1.05, acc = 1383 * 1.05, kN = vN - 22574 - acc;   // = 9.153,85
  const mN = +((kN / vN) * 100).toFixed(1);                            // = 27,6 %
  ok(near(F(rA.boleta, "Samsung · Contribución supuesta").raw, kN * 1000, 1), `base cruda: contribución supuesta = ${kN.toFixed(2)}K (venta 33.180 − costo 22.574 − acciones 1.452,15) — obtuvo ${F(rA.boleta, "Samsung · Contribución supuesta").raw / 1000}K`);
  ok(F(rA.boleta, "Samsung · Margen actual").raw === 24.2, `base cruda: «Margen actual» de Samsung = 24,2 % (el publicado), no 28,6 % — obtuvo ${F(rA.boleta, "Samsung · Margen actual").raw}%`);
  ok(F(rA.boleta, "Samsung · Margen supuesto").raw === mN, `base cruda: «Margen supuesto» = ${mN} % — obtuvo ${F(rA.boleta, "Samsung · Margen supuesto").raw}%`);
  // bonanza: ahí el transform ya metió los rebates en el costo (acciones = 0): venta 33.158 · costo 25.134 · contribución 8.024
  const rB = sim("marca", "Samsung", 5, 0, "bonanza");
  const kB = 33158 * 1.05 - 25134;
  ok(near(F(rB.boleta, "Samsung · Contribución supuesta").raw, kB * 1000, 1), `bonanza: contribución supuesta = ${kB.toFixed(2)}K — obtuvo ${F(rB.boleta, "Samsung · Contribución supuesta").raw / 1000}K`);
  ok(F(rB.boleta, "Samsung · Margen actual").raw === 24.2, "bonanza: «Margen actual» de Samsung = 24,2 %");
  // SKU (scenario-blind, costo sin rebates en TODOS los mundos): SAM-TV55 venta 13.300 · costo 10.241 · rebates 599 · contrib 2.460
  const rS = sim("sku", "SAM-TV55", 5, 0, "bonanza");
  const kS = 13300 * 1.05 - 10241 - 599 * 1.05;   // 3.095,05
  ok(near(F(rS.boleta, "SAM-TV55 · Contribución supuesta").raw, kS * 1000, 1), `SKU SAM-TV55 +5 %: contribución supuesta = ${kS.toFixed(2)}K — obtuvo ${F(rS.boleta, "SAM-TV55 · Contribución supuesta").raw / 1000}K`);
  ok(F(rS.boleta, "SAM-TV55 · Margen actual").raw === 18.5, `SKU SAM-TV55: «Margen actual» = 18,5 % (el publicado) — obtuvo ${F(rS.boleta, "SAM-TV55 · Margen actual").raw}%`);
}

console.log("\n── 5 · fórmula auditable de la fig lo dice ──");
{
  const r = sim("marca", "Samsung", 5, -10, "actual");
  const f = F(r.boleta, "Samsung · Contribución supuesta");
  ok(f && /acciones comerciales/i.test(f.formula) && /venta supuesta/.test(f.formula) && /costo supuesto/.test(f.formula), `la fórmula de «Contribución supuesta» nombra las acciones comerciales — "${f && f.formula}"`);
  ok(r.boleta.length === 10, `la boleta sigue siendo de EXACTAMENTE 10 figs (sin figs nuevas) — obtuvo ${r.boleta.length}`);
  ok(r.boleta.every((x) => x.source === "actual" || (x.source === "computed" && typeof x.formula === "string" && x.formula.length)), "toda cifra computed trae su fórmula");
}

console.log("\n── 6 · control · eje cliente (acciones = 0): idéntico a venta − costo, como siempre ──");
{
  let malos = [];
  for (const sc of ESCENARIOS) for (const ent of ["Falabella", "Lider"]) for (const [p, v] of PARES) {
    const rec = rawRecordFor("cliente", ent, sc);
    const r = sim("cliente", ent, p, v, sc);
    const kViejo = rec.venta * (1 + p / 100) * (1 + v / 100) - rec.costo * (1 + v / 100);
    if (!near(F(r.boleta, `${ent} · Contribución supuesta`).raw / 1000, kViejo, 0.5)) malos.push(`${sc}/${ent} ${p}/${v}`);
    if (!near(F(r.boleta, `${ent} · Margen actual`).raw, +(((rec.venta - rec.costo) / rec.venta) * 100).toFixed(1), 0.001)) malos.push(`${sc}/${ent} margen actual`);
  }
  ok(malos.length === 0, `cliente: contribución y margen idénticos a la cuenta anterior en los 4 mundos${malos.length ? " — " + JSON.stringify(malos) : ""}`);
}

console.log("\n── 7 · camino del usuario · setCostModelOverride sobre un tenant SIN modelo (empresa2) ──");
{
  initTenant(TENANT_EMPRESA2);
  ok(costModelOf() == null, "empresa2: sin modelo declarado");
  setCostModelOverride({ tipo: "variable_total" });
  ok(costModelOf() && costModelOf().tipo === "variable_total", "override del usuario activo");
  const marcas = (SOURCES.marcasMargen.load() || []).map((r) => r.nombre).slice(0, 2);
  const fams = (SOURCES.sfamiliasMargen.load() || []).map((r) => r.nombre).slice(0, 2);
  const skus = (SOURCES.skusMargen.load() || []).map((r) => r.nombre).slice(0, 3);
  const cli = (SOURCES.clientesMargen.load() || []).map((r) => r.nombre).slice(0, 2);
  const lista = [...cli.map((e) => ["cliente", e]), ...marcas.map((e) => ["marca", e]), ...fams.map((e) => ["familia", e]), ...skus.map((e) => ["sku", e])];
  ok(lista.length >= 6, `empresa2: ${lista.length} entidades para recorrer`);
  const malos = []; let n = 0;
  for (const sc of ["actual", "bonanza"]) for (const [dim, ent] of lista) for (const [p, v] of [[5, 0], [0, -10], [5, -10], [-8, 12]]) {
    const rec = rawRecordFor(dim, ent, sc);
    if (!rec || typeof rec.venta !== "number" || typeof rec.costo !== "number" || typeof rec.contribucion !== "number") continue;
    const r = sim(dim, ent, p, v, sc);
    if (!r.coverage.supported) { malos.push(`${sc}/${dim}/${ent}: no soportado`); continue; }
    n++;
    const vA = F(r.boleta, `${ent} · Venta actual`), cA = F(r.boleta, `${ent} · Costo actual`), kA = F(r.boleta, `${ent} · Contribución actual`);
    const vN = F(r.boleta, `${ent} · Venta supuesta`), cN = F(r.boleta, `${ent} · Costo supuesto`), kN = F(r.boleta, `${ent} · Contribución supuesta`);
    const esc = vA.raw / rec.venta;
    if (!near(F(r.boleta, `${ent} · Margen actual`).raw, rec.margen, 0.06)) malos.push(`${sc}/${dim}/${ent}: margen actual ${F(r.boleta, `${ent} · Margen actual`).raw} ≠ publicado ${rec.margen}`);
    const aA = (vA.raw - cA.raw - kA.raw) / esc, aN = (vN.raw - cN.raw - kN.raw) / esc;
    if (!near(aN / (vN.raw / esc), aA / (vA.raw / esc), 1e-6)) malos.push(`${sc}/${dim}/${ent}: acciones/venta no constante`);
  }
  ok(n > 0 && malos.length === 0, `empresa2 + override: ${n} simulaciones coherentes con el margen publicado${malos.length ? " — " + JSON.stringify(malos.slice(0, 8)) : ""}`);
  setCostModelOverride(null);
  initTenant(TENANT_DEMO);
}

console.log(`\n${pass} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
