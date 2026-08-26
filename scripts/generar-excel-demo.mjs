/* === scripts/generar-excel-demo.mjs · EL EXCEL SINTÉTICO, HECHO DEL DATO DEL DEMO (vía 2 · paso 1) ============
 *
 * Escribe un `.xlsx` de verdad —ZIP + XML, sin ninguna dependencia— a partir del tenant demo. Sirve para dos cosas:
 *   1. tener un archivo con el que probar la ingesta **sin pedirle nada a ningún cliente** (la regla del paso 1:
 *      solo dato demo o sintético), y
 *   2. hacer posible la prueba del ESPEJO: si el archivo sale del demo y la ingesta lo devuelve igual, entonces
 *      leer y normalizar no perdió ni deformó nada. Un ida y vuelta que cierra vale más que veinte asserts sueltos.
 *
 * A PROPÓSITO NO ES UN VOLCADO FIEL. Los encabezados están escritos como los escribiría una persona —«Cliente»,
 * «Venta del mes», «Stock valorizado»— justamente para ejercitar el mapeo por sinónimo declarado, y una columna
 * («Observaciones») no existe en el contrato para que el mapeo tenga algo que reportar como sin resolver. Un
 * fixture que calca los nombres internos probaría el camino que nunca ocurre.
 *
 * Uso:  node scripts/generar-excel-demo.mjs [destino.xlsx]
 * Determinístico · sin red · sin modelo.
 */
import { writeFileSync } from "node:fs";
// el escritor de .xlsx vive en src/ (lo usa la plantilla oficial, que es código de producto): una sola copia.
import { construirXlsx } from "../src/ingesta/escribirLibro.js";
import { TENANT_DEMO } from "../src/data/tenants/demo.js";

/* ── las tres hojas, con encabezados «de persona» ─────────────────────────────────────────────────────────── */
export function hojasDelDemo(tenant = TENANT_DEMO) {
  const cv = tenant.clientesVentas, cm = tenant.clientesMargen, si = tenant.skuInventario, sm = tenant.skusMargen;
  const margenPorNombre = new Map(cm.map((r) => [r.nombre, r]));

  const clientes = [
    ["Cliente", "Canal", "Marca", "Familia", "Venta del mes", "Periodo anterior", "Presupuesto", "Cantidad", "Cantidad anterior", "Rebate %", "Observaciones"],
    ...cv.map((r) => {
      const m = margenPorNombre.get(r.nombre) || {};
      return [r.nombre, r.canal ?? null, m.marca ?? null, m.sfamilia ?? null, r.actual, r.anterior, r.presupuesto, r.unidades, r.unidadesAnt, r.pctRebate, null];
    }),
  ];

  const margen = [
    ["Cuenta", "Marca", "Familia", "Ventas", "Costo de venta", "Rebates", "Utilidad bruta", "Rebate %", "Margen %", "Referencia", "Cantidad", "Costo unitario", "Precio lista"],
    ...cm.map((r) => [r.nombre, r.marca, r.sfamilia, r.venta, r.costo, r.rebates, r.contribucion, r.pctRebate, r.margen, r.benchmark, r.unidades, r.costoMedio, r.precioLista]),
  ];

  const inventario = [
    ["Código SKU", "Bodega", "Marca", "Familia", "Stock valorizado", "Stock unidades", "Rotación", "Días de inventario", "Cobertura días", "Margen %", "Días sin venta", "Vendido mes", "Venta diaria", "Estado", "Semáforo"],
    ...si.map((r) => [r.sku, r.bodega, r.marca, r.sfamilia, r.stockUSD, r.stockUnd, r.rotacion, r.doh, r.cobertura, r.margenPct, r.diasSinVenta, r.vendidoMes, r.ventaDiaria, r.estado, r.alerta]),
  ];

  const productos = [
    ["Producto", "Marca", "Familia", "Ventas", "Costo de venta", "Rebates", "Utilidad bruta", "Rebate %", "Margen %", "Referencia", "Cantidad", "Costo unitario", "Precio lista"],
    ...sm.map((r) => [r.nombre, r.marca, r.sfamilia, r.venta, r.costo, r.rebates, r.contribucion, r.pctRebate, r.margen, r.benchmark, r.unidades, r.costoMedio, r.precioLista]),
  ];

  return [
    { nombre: "Clientes", filas: clientes },
    { nombre: "Margen por cuenta", filas: margen },
    { nombre: "Inventario", filas: inventario },
    { nombre: "Productos", filas: productos },
  ];
}

/** El `.xlsx` sintético como Buffer — lo usa el gate sin escribir a disco. */
export const excelDemoBuffer = (tenant = TENANT_DEMO) => construirXlsx(hojasDelDemo(tenant));

// Ejecutado directamente: escribe el archivo (para mirarlo en Excel de verdad).
if (process.argv[1] && process.argv[1].endsWith("generar-excel-demo.mjs")) {
  const destino = process.argv[2] || "_ejemplo_ingesta_demo.xlsx";
  const buf = excelDemoBuffer();
  writeFileSync(destino, buf);
  console.log(`✅ ${destino} · ${(buf.length / 1024).toFixed(1)} KB · ${hojasDelDemo().length} hojas, hechas del tenant demo`);
}
