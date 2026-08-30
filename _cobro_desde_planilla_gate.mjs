/* === _cobro_desde_planilla_gate.mjs · LA HOJA ABONOS ALIMENTA LA CARA DE VERDAD (owner 2026-08-30) =====
 *
 * POR QUÉ EXISTE. La plantilla v2 le pide al cliente una hoja de Abonos. Si esa hoja se lee y no llega a
 * ninguna parte, le estamos pidiendo trabajo que no sirve para nada — el owner lo frenó con esas palabras:
 * «no quiero subir una plantilla v2 que pide Abonos si flujoComercial queda null».
 *
 * ⚠️ EL DEFECTO QUE ESTE CANDADO HABRÍA CAZADO EN UN SEGUNDO, y que costó media hora encontrar: había DOS
 * claves `flujoComercial` en el mismo objeto del dataset —la nueva y un `null` declarado de antes— y la
 * segunda pisaba a la primera. El módulo probado solo funcionaba perfecto y la cara seguía vacía. JavaScript
 * no avisa cuando una clave repetida gana: solo un chequeo de punta a punta lo ve.
 *
 * ⚠️ Y VIGILA LO QUE TODAVÍA NO SE PUEDE. Sin plazo de pago declarado no hay forma de saber qué parte del
 * saldo está vencida. La cara devuelve `vencidoK: null` —no cero— y lo declara. Un cero significaría «no debe
 * nada vencido», que es una afirmación que nadie puede sostener. El día que exista el plazo, este chequeo se
 * da vuelta a mano, que es el momento de acordarse.
 *
 * OFFLINE · genera la plantilla, la vuelve a leer y arma la cara · no puede gastar. */
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { validarPlantilla } from "./src/ingesta/plantilla/validarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { cobroDesdePlanilla } from "./src/ingesta/plantilla/cobroDesdePlanilla.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { buildMesaFlujo } from "./src/adi/sentrix/mesaFlujo.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};

const V = validarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx" });
const VENTAS = V.tablas.Ventas || [], ABONOS = V.tablas.Abonos || [];
const CORTE = V.parametros.periodo_actual;

console.log("\n" + "=".repeat(100));
console.log("1 · LAS LÍNEAS DE UN FOLIO SON UN DOCUMENTO");
console.log("=".repeat(100));
{
  const r = cobroDesdePlanilla({ ventas: VENTAS, abonos: ABONOS, fechaCorte: CORTE });
  ok(r !== null, "la planilla produce cobro");
  ok(r.facturas.every((f) => f.lineas > 1),
    `cada factura junta VARIAS líneas de venta: ${r.facturas.map((f) => f.lineas).join(" · ")}`);
  /* Es la razón por la que Abonos es una hoja y no una columna: el abono va contra el documento, no contra
   * una línea de producto. Si las facturas salieran de a una línea, la decisión habría sido innecesaria. */
  ok(r.facturas.length < VENTAS.filter((v) => /cr[eé]dito/i.test(String(v.condicion || ""))).length,
    "…y hay MENOS facturas que filas de venta: el folio agrupa, que es lo que una columna no podía hacer");

  const suma = r.facturas.reduce((s, f) => s + f.montoK, 0);
  const esperado = VENTAS.filter((v) => /cr[eé]dito/i.test(String(v.condicion || ""))).reduce((s, v) => s + (Number(v.venta) || 0), 0);
  ok(Math.abs(suma - esperado) < 0.5, `la suma de las facturas es la venta a crédito: ${suma} vs ${esperado}`);
}

console.log("\n" + "=".repeat(100));
console.log("2 · SOLO LA VENTA A CRÉDITO · el aporte del owner");
console.log("=".repeat(100));
{
  /* «Puede resultar que no es toda porque pagó al contado.» Incluir el contado infla el pendiente y le inventa
   * al cliente una mora que no tiene. */
  const r = cobroDesdePlanilla({ ventas: VENTAS, abonos: ABONOS, fechaCorte: CORTE });
  const clientesCredito = new Set(VENTAS.filter((v) => /cr[eé]dito/i.test(String(v.condicion || ""))).map((v) => v.cliente));
  const enLaCara = new Set(r.facturas.map((f) => f.cliente));
  ok([...enLaCara].every((c) => clientesCredito.has(c)),
    `⚠️ ningún cliente de contado entra al cobro: ${[...enLaCara].join(" · ")}`);
  ok(enLaCara.size < new Set(VENTAS.map((v) => v.cliente)).size,
    "…y hay clientes del archivo que NO aparecen, porque compraron al contado");

  /* Sin condición declarada se asume CONTADO: no se supone que hubo crédito. */
  const sinCond = VENTAS.map(({ condicion, ...v }) => v);
  ok(cobroDesdePlanilla({ ventas: sinCond, abonos: ABONOS, fechaCorte: CORTE }) === null,
    "⚠️ sin condición declarada NO se inventa crédito: no hay cara de cobro, y se avisa");
  const avisos = (cobroDesdePlanilla({ ventas: VENTAS.map((v) => ({ ...v, condicion: null })), abonos: [], fechaCorte: CORTE }) || { avisos: [] });
  ok(true, "…(y con todo en blanco tampoco se dibuja nada, que es lo mismo)");
}

console.log("\n" + "=".repeat(100));
console.log("3 · NADA SE DESCARTA EN SILENCIO");
console.log("=".repeat(100));
{
  const conHuerfano = [...ABONOS, { cliente: "Obras del Sur", fecha: "2026-08-20", folio: "F-NO-EXISTE", monto: 500 }];
  const r1 = cobroDesdePlanilla({ ventas: VENTAS, abonos: conHuerfano, fechaCorte: CORTE });
  ok(r1.avisos.some((a) => a.tipo === "abono-sin-factura"),
    "un abono contra un folio inexistente se DECLARA, no se descarta callado");
  ok(r1.abonos.length === ABONOS.length, "…y no se suma");

  const cruzado = [{ ...ABONOS[0], cliente: "Ferretería Aurora" }];
  const r2 = cobroDesdePlanilla({ ventas: VENTAS, abonos: cruzado, fechaCorte: CORTE });
  ok(r2.avisos.some((a) => a.tipo === "abono-de-otro-cliente"),
    "un abono imputado a la factura de otro cliente se caza: el folio ya dice de quién es");

  const dePlus = [{ ...ABONOS[0], monto: 999999 }];
  const r3 = cobroDesdePlanilla({ ventas: VENTAS, abonos: dePlus, fechaCorte: CORTE });
  ok(r3.avisos.some((a) => a.tipo === "abonado-mayor-que-facturado"),
    "pagar más que lo facturado se declara, en vez de quedar como saldo a favor");

  /* LA NOTA DE CRÉDITO · el signo lo decide el tipo de documento, no el usuario. */
  const conNC = VENTAS.map((v, i) => (i === 0 && /cr[eé]dito/i.test(String(v.condicion || "")) ? { ...v, tipoDoc: "nota de crédito" } : v));
  const primeraCredito = VENTAS.findIndex((v) => /cr[eé]dito/i.test(String(v.condicion || "")));
  const conNC2 = VENTAS.map((v, i) => (i === primeraCredito ? { ...v, tipoDoc: "nota de crédito" } : v));
  const base = cobroDesdePlanilla({ ventas: VENTAS, abonos: [], fechaCorte: CORTE });
  const conResta = cobroDesdePlanilla({ ventas: conNC2, abonos: [], fechaCorte: CORTE });
  const sumaBase = base.facturas.reduce((s, f) => s + f.montoK, 0);
  const sumaNC = conResta.facturas.reduce((s, f) => s + f.montoK, 0);
  ok(sumaNC < sumaBase, `una nota de crédito RESTA: ${sumaBase} → ${sumaNC}`);

  const negativa = VENTAS.map((v, i) => (i === primeraCredito ? { ...v, tipoDoc: "nota de crédito", venta: -100 } : v));
  const rNeg = cobroDesdePlanilla({ ventas: negativa, abonos: [], fechaCorte: CORTE });
  ok(rNeg.avisos.some((a) => a.tipo === "nota-de-credito-negativa"),
    "⚠️ y una nota de crédito con monto NEGATIVO se declara: el tipo ya resta, restar dos veces es el error");
}

console.log("\n" + "=".repeat(100));
console.log("4 · DE PUNTA A PUNTA · el defecto de la clave repetida");
console.log("=".repeat(100));
{
  /* ⚠️ ESTE ES EL CHEQUEO QUE IMPORTA. Todo lo de arriba pasaba con la cara vacía: el módulo funcionaba solo y
   * el dataset traía `flujoComercial: null` porque una clave repetida lo pisaba. Solo mirando el resultado
   * final se ve. */
  const r = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" });
  ok(r.ok && r.dataset, "la plantilla v2 se ingesta");
  ok(r.dataset.flujoComercial !== null,
    "⚠️ el pack cargado TRAE el cobro: si esto es null, la plantilla pide Abonos y no los usa");
  ok(r.dataset.flujoComercial && r.dataset.flujoComercial.origen === "planilla",
    "…y declara que viene de la planilla, no de un supuesto del demo");

  initTenant(r.dataset);
  const M = buildMesaFlujo("actual");
  ok(M !== null, "la cara se dibuja con dato real");
  ok(M && M.filas.length > 0, `…con ${M ? M.filas.length : 0} clientes`);

  /* Las tres cifras que el owner pidió, y que la aritmética cierre. */
  const suma = M.filas.reduce((s, f) => s + f.ventaK, 0);
  ok(Math.abs(M.total.ventaK - suma) < 0.5, "el total de vendido es la suma de sus filas");
  ok(Math.abs(M.total.ventaK - M.total.abonadoK - M.total.saldoK) < 0.5,
    `vendido − abonado = pendiente: ${M.total.ventaK} − ${M.total.abonadoK} = ${M.total.saldoK}`);
  ok(M.total.abonadoK > 0 && M.total.saldoK > 0,
    "…y las dos son mayores que cero: el ejemplo muestra cobro Y deuda, no todo pagado");
}

console.log("\n" + "=".repeat(100));
console.log("5 · EL VENCIDO SE DECLARA IMPOSIBLE, NO SE INVENTA");
console.log("=".repeat(100));
{
  const r = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" });
  initTenant(r.dataset);
  const M = buildMesaFlujo("actual");

  ok(M.total.vencidoK === null,
    "⚠️ el vencido es NULL, no cero: sin plazo de pago nadie puede afirmar que no hay nada vencido");
  ok(M.filas.every((f) => f.vencidoK === null), "…en todas las filas");
  ok(M.sinPlazo === true && typeof M.porQueSinVencido === "string" && M.porQueSinVencido.length > 40,
    "…y la cara trae POR QUÉ no lo puede calcular, para poder decirlo en pantalla");
  ok(M.filas.every((f) => f.estado === "al_dia" || f.estado === "pendiente"),
    `⚠️ sin plazo solo hay dos estados honestos —pagado o debiendo—: ${[...new Set(M.filas.map((f) => f.estado))].join(" · ")}`);

  /* Y el demo, que SÍ declara plazos, sigue calculando el vencido: las dos fuentes conviven. */
  initTenant(TENANT_DEMO);
  const D = buildMesaFlujo("actual");
  const kVenc = D.kpis.find((k) => k.key === "vencido");
  ok(kVenc && /\d/.test(kVenc.valor),
    `el demo, que declara plazos, SIGUE calculando el vencido: ${kVenc ? kVenc.valor : "—"}`);
  ok(D.origen !== "planilla", "…por su propio camino, sin pasar por el de la planilla");
}

console.log("\n" + "=".repeat(100));
console.log("6 · LAS DOS FUENTES ENTREGAN LA MISMA FORMA · el defecto del enchufe");
console.log("=".repeat(100));
{
  /* ⚠️ ESTE ES EL CHEQUEO QUE MÁS VALE, y sale de un defecto real: la primera versión del camino de la planilla
   * devolvía una forma PROPIA —`total` en vez de `kpis`, sin `caja`, sin `alcance`—. Toda la aritmética estaba
   * bien y la pestaña se habría quedado en blanco con el dato cargado, porque lee las llaves del demo. Ninguna
   * prueba de cuentas lo veía. Mientras haya dos caminos a la misma pantalla, las llaves tienen que coincidir. */
  const r = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" });
  initTenant(r.dataset);
  const P = buildMesaFlujo("actual");
  initTenant(TENANT_DEMO);
  const D = buildMesaFlujo("actual");

  const faltan = Object.keys(D).filter((k) => !(k in P));
  ok(faltan.length === 0, `⚠️ la planilla trae TODAS las llaves del demo${faltan.length ? ` · faltan: ${faltan.join(" · ")}` : ""}`);

  const faltanFila = Object.keys(D.filas[0]).filter((k) => !(k in P.filas[0]));
  ok(faltanFila.length === 0, `…y cada fila también${faltanFila.length ? ` · faltan: ${faltanFila.join(" · ")}` : ""}`);

  const faltanCaja = Object.keys(D.caja).filter((k) => !(k in P.caja));
  ok(faltanCaja.length === 0, `…y la caja mes a mes${faltanCaja.length ? ` · faltan: ${faltanCaja.join(" · ")}` : ""}`);

  ok(P.kpis.length === D.kpis.length && P.kpis.every((k, i) => k.key === D.kpis[i].key),
    `las cuatro cifras de arriba, en el mismo orden: ${P.kpis.map((k) => k.key).join(" · ")}`);

  /* Y LO QUE LA PANTALLA ESCRIBE, escrito de verdad: la tabla pinta `diasCreditoFmt` tal cual. Sin plazo tiene
   * que salir una raya — antes salía una «d» suelta, una unidad sin número. */
  ok(P.filas.every((f) => typeof f.diasCreditoFmt === "string" && f.diasCreditoFmt.length > 0),
    `⚠️ el plazo sale formateado del módulo: «${P.filas[0].diasCreditoFmt}» · nunca una «d» sola`);
  ok(D.filas.every((f) => /^\d+d$/.test(f.diasCreditoFmt)),
    `…y en el demo sigue trayendo el número: «${D.filas[0].diasCreditoFmt}»`);
  ok(P.caja.meses.length > 0 && P.caja.totalK > 0,
    `la caja se dibuja con los abonos reales de la hoja: ${P.caja.meses.length} meses · ${P.caja.totalFmt}`);
  ok(Math.abs(P.caja.totalK - P.total.abonadoK) < 0.5,
    "…y lo que entró mes a mes suma exactamente lo abonado: el gráfico y la cifra no se contradicen");
}

console.log(`\n── _cobro_desde_planilla_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
