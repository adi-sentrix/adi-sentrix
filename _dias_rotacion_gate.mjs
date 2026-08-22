/* === _dias_rotacion_gate.mjs · INFORMADO MANDA, CALCULADO RELLENA (owner 2026-08-22) ==========================
 * LA REGLA, textual: «Si días de inventario o rotación vienen informados por el origen, se usan como dato
 * operativo declarado. Si no vienen informados, ADI los calcula con fórmula declarada. En ambos casos debe quedar
 * declarada la procedencia: informado o calculado. Nunca debe haber dos verdades para la misma fila.»
 *
 * QUÉ DESTRABA. Estas dos métricas eran dato primario SIN fórmula, y eso dejaba la cara Capital imposible de armar
 * desde un archivo que solo trae hechos: el diagnóstico (inmovilizado · sobrestock · riesgo de quiebre · el estado
 * de cada SKU) se decide comparando estas dos contra los umbrales del negocio.
 *
 * ⚠️ LA FÓRMULA SE DECLARA, NO SE INFIERE, y está medido por qué: sobre los 13 SKU del dato de referencia,
 * `stock ÷ venta diaria` reproduce el `doh` declarado en 2 de 13, y `365 ÷ doh` reproduce la `rotacion` declarada
 * en 0 de 13. Los valores del demo están puestos a mano. Por eso este gate NO comprueba que la fórmula reproduzca
 * el demo —no lo haría—: comprueba que el demo NO SE MUEVA, que es cosa distinta y es la que el owner pidió.
 *
 * OFFLINE · módulo puro + el dato de referencia · no puede gastar. */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
import { resolverDiasYRotacion, textoProcedencia, FORMULA_DIAS, FORMULA_ROTACION } from "./src/adi/sentrix/diasYRotacion.js";
import { skuInventario } from "./src/data/demoData.js";
import { METRICS } from "./src/config/contract/metricRegistry.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};

console.log("=".repeat(100));
console.log("1 · EL DATO DE REFERENCIA NO SE MUEVE · era la condición del owner para elegir esta regla");
console.log("=".repeat(100));
{
  const distintos = [];
  let informados = 0;
  for (const s of skuInventario) {
    const r = resolverDiasYRotacion(s, { unidadesPeriodo: s.vendidoMes });
    if (r.dias.procedencia === "informado" && r.rotacion.procedencia === "informado") informados++;
    if (r.dias.valor !== s.doh || r.rotacion.valor !== s.rotacion) distintos.push(`${s.sku}: ${r.dias.valor}/${s.doh} · ${r.rotacion.valor}/${s.rotacion}`);
  }
  ok(distintos.length === 0, `los ${skuInventario.length} SKU salen IDÉNTICOS a lo declarado`, distintos.slice(0, 3).join(" | "));
  ok(informados === skuInventario.length, `y los ${informados} marcados «informado»: el demo no pasa a calcularse por la ventana de atrás`);
}

console.log("\n" + "=".repeat(100));
console.log("2 · UNA PLANILLA SIN KPI · el usuario no calcula nada y Capital igual se puede armar");
console.log("=".repeat(100));
{
  // lo que sube alguien que solo informó hechos: stock y unidades vendidas. Ni días ni rotación.
  const fila = { sku: "ACME-01", bodega: "Central", stockUnd: 90, stockUSD: 12000 };
  const r = resolverDiasYRotacion(fila, { unidadesPeriodo: 60, diasPeriodo: 30 });
  ok(r.dias.valor === 45, `días = 90 ÷ (60 ÷ 30) = 45 (${r.dias.valor})`);
  ok(r.dias.procedencia === "calculado", "…marcado «calculado»");
  ok(r.dias.formula === FORMULA_DIAS, "…y la fórmula viaja con el valor, no hay que ir a buscarla");
  ok(r.rotacion.valor === 8.1, `rotación = 365 ÷ 45 = 8.1 (${r.rotacion.valor})`);
  ok(r.rotacion.procedencia === "calculado" && r.rotacion.formula === FORMULA_ROTACION, "…ídem la rotación");
  // el mismo hecho puede venir por la hoja de inventario en vez de por la de ventas: es el MISMO hecho
  const porHoja = resolverDiasYRotacion({ stockUnd: 90, vendidoMes: 60 });
  ok(porHoja.dias.valor === 45, "y da lo mismo si las unidades vienen de la hoja Inventario («vendido en el mes»)");
}

console.log("\n" + "=".repeat(100));
console.log("3 · UNA SOLA VERDAD POR FILA · la rotación sale de LOS MISMOS días, no de otros");
console.log("=".repeat(100));
{
  /* El caso que rompe una implementación ingenua: los días vienen informados y la rotación no. Si la rotación se
   * recalculara aparte desde el stock, la fila diría dos cosas distintas del mismo inventario. */
  const r = resolverDiasYRotacion({ doh: 50, stockUnd: 90 }, { unidadesPeriodo: 60 });
  ok(r.dias.valor === 50 && r.dias.procedencia === "informado", "los días informados se respetan (50)");
  ok(r.rotacion.valor === 7.3, `y la rotación se deriva de ESOS 50 días: 365 ÷ 50 = 7.3 (${r.rotacion.valor})`);
  ok(r.rotacion.valor !== 8.1, "…NO de los 45 que habría dado calcular los días por separado");
}

console.log("\n" + "=".repeat(100));
console.log("4 · SIN DENOMINADOR NO HAY MEDICIÓN · se declara el hueco en vez de inventar un número");
console.log("=".repeat(100));
for (const [caso, fila, opts] of [
  ["sin venta en el período", { stockUnd: 90 }, { unidadesPeriodo: 0 }],
  ["sin unidades informadas", { stockUnd: 90 }, {}],
  ["sin stock", { vendidoMes: 60 }, {}],
  ["fila vacía", {}, {}],
]) {
  const r = resolverDiasYRotacion(fila, opts);
  ok(r.dias.valor === null && r.dias.procedencia === "sin dato", `${caso} → días «sin dato», nunca un cero que parezca medición`);
  ok(r.rotacion.valor === null, `${caso} → y la rotación tampoco se inventa`);
}

console.log("\n" + "=".repeat(100));
console.log("5 · LA PROCEDENCIA SE PUEDE DECLARAR EN PANTALLA sin que cada superficie invente su redacción");
console.log("=".repeat(100));
{
  const inf = resolverDiasYRotacion({ doh: 17 });
  const cal = resolverDiasYRotacion({ stockUnd: 90 }, { unidadesPeriodo: 60 });
  ok(/informado por tu sistema/.test(textoProcedencia(inf.dias)), `informado → «${textoProcedencia(inf.dias)}»`);
  ok(/calculado por ADI/.test(textoProcedencia(cal.dias)) && textoProcedencia(cal.dias).includes("stock en unidades"),
    "calculado → dice que lo calculó ADI Y con qué cuenta");
  ok(textoProcedencia(resolverDiasYRotacion({}).dias) === "sin dato", "sin dato → lo dice, no lo esconde");
}

console.log("\n" + "=".repeat(100));
console.log("6 · EL CONTRATO LO DECLARA · la fórmula no vive solo en el código que la aplica");
console.log("=".repeat(100));
ok(METRICS.doh.formulaSiFalta === "stockUnd / (unidades_del_periodo / dias_del_periodo)",
  `el contrato declara la cuenta de los días (${METRICS.doh.formulaSiFalta})`);
ok(METRICS.rotacion.formulaSiFalta === "365 / dias_de_inventario",
  `y la de la rotación (${METRICS.rotacion.formulaSiFalta})`);
ok(METRICS.doh.formula === null && METRICS.rotacion.formula === null,
  "y `formula` SIGUE en null: el valor almacenado no cierra con ninguna cuenta (2 de 13 y 0 de 13) — declararla ahí sería una verificación que el dato no pasa");

console.log(`\n── _dias_rotacion_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
