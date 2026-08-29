/* === _flujo_comercial_gate.mjs · LA CARA DEL COBRO, PROBADA EN EL DATO (owner 2026-08-27) ====================
 *
 * QUÉ CUIDA. El owner pidió esta cara para una cosa concreta: «controlar si es que a algún cliente se le da
 * crédito». Todo lo que sigue existe para que esa frase siga siendo verdad cuando alguien toque el módulo.
 *
 * LAS CUATRO PROMESAS QUE SE PRUEBAN ACÁ:
 *   [1] LA SUMA CIERRA. Las facturas de un cliente suman SU venta, y abonado + saldo también. Si esto se rompe,
 *       el producto tendría dos cifras distintas para la misma venta — que es lo que no se permite.
 *   [2] LA ANTIGÜEDAD ES REPRODUCIBLE. Todo se mide contra una fecha de corte DECLARADA, nunca contra el reloj.
 *       Dos corridas del mismo escenario dan exactamente lo mismo, hoy y en tres meses.
 *   [3] EL MOROSO SE VE MOROSO. El cliente al que le diste crédito y no lo devuelve tiene deuda VIEJA, no
 *       nueva. Es la razón de ser de la cara y es lo primero que se rompió mientras se construía.
 *   [4] LA CARA NO CONCLUYE. Sentrix muestra, ADI concluye (owner: «las recomendaciones no van»).
 *
 * OFFLINE · dato y lectura de fuentes · no puede gastar. */
import { readFileSync } from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
const { buildMesaFlujo } = await import("./src/adi/sentrix/mesaFlujo.js");
const { HOJAS } = await import("./src/config/contract/plantilla.js");

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};
const H = (t) => console.log("\n" + "=".repeat(100) + "\n" + t + "\n" + "=".repeat(100));
const leer = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };
const ESCENARIOS = ["actual", "bonanza", "tension", "crisis"];

H("1 · LA SUMA CIERRA · en los cuatro escenarios, no solo en el que se miró al construir");
for (const scn of ESCENARIOS) {
  const F = buildMesaFlujo(scn);
  ok(!!F, `${scn}: la cara se construye`);
  if (!F) continue;
  /* venta = abonado + saldo, cliente por cliente. Es la identidad de la que cuelga todo lo demás. */
  const rotas = F.filas.filter((f) => Math.abs(f.ventaK - (f.abonadoK + f.saldoK)) > 0.15);
  ok(rotas.length === 0, `${scn}: venta = abonado + saldo en los ${F.filas.length} clientes`,
    rotas.map((f) => `${f.nombre}: ${f.ventaK} ≠ ${f.abonadoK}+${f.saldoK}`).join(" · "));
  /* y las facturas de cada cliente suman su venta: es lo que impide que existan DOS ventas para el mismo cliente */
  const porCliente = {};
  for (const f of F.facturas) porCliente[f.cliente] = (porCliente[f.cliente] || 0) + f.montoK;
  const desalineadas = F.filas.filter((f) => Math.abs((porCliente[f.nombre] || 0) - f.ventaK) > 0.15);
  ok(desalineadas.length === 0, `${scn}: las facturas de cada cliente suman su venta, exacta`,
    desalineadas.map((f) => `${f.nombre}: facturas ${porCliente[f.nombre]} vs venta ${f.ventaK}`).join(" · "));
  /* el vencido nunca puede superar al saldo: sería deber más de lo que se debe */
  const imposibles = F.filas.filter((f) => f.vencidoK > f.saldoK + 0.15);
  ok(imposibles.length === 0, `${scn}: el vencido nunca supera al saldo`, imposibles.map((f) => f.nombre).join(" · "));
  /* la caja mensual suma el abonado del período: el gráfico y el KPI cuentan lo mismo */
  const kAbonado = F.kpis.find((k) => k.key === "abonado");
  ok(F.caja.totalFmt === kAbonado.valor,
    `${scn}: la caja mes a mes suma exactamente el abonado de cabecera (${F.caja.totalFmt})`);
}

H("2 · LA ANTIGÜEDAD ES REPRODUCIBLE · se mide contra una fecha declarada, nunca contra el reloj");
{
  const a = buildMesaFlujo("actual"), b = buildMesaFlujo("actual");
  ok(JSON.stringify(a.filas) === JSON.stringify(b.filas),
    "dos corridas del mismo escenario dan filas idénticas");
  ok(a.fechaCorte === TENANT_DEMO.flujoComercial.fechaCorte,
    `la fecha de corte es la DECLARADA por el tenant (${a.fechaCorte})`);
  const src = leer("./src/adi/sentrix/mesaFlujo.js");
  /* ⚠️ LA CARNADA MÁS IMPORTANTE DE ESTE GATE. Si alguien reemplaza la fecha declarada por el reloj del
   * sistema, todo lo de arriba sigue en verde —las sumas cierran igual— pero "vencido hace 269 días" cambiaría
   * cada mañana y la misma pregunta daría dos respuestas distintas en dos días distintos. Se prueba en la
   * FUENTE porque es lo único que lo caza antes de que pase. */
  ok(!/new Date\(\s*\)/.test(src) && !/Date\.now\(\)/.test(src),
    "el módulo NO consulta el reloj: ni new Date() sin argumento ni Date.now()");
  ok(a.fechaCorteFmt && a.alcance.includes(a.fechaCorteFmt),
    `y la cara declara al usuario a qué fecha está mirando (${a.fechaCorteFmt})`);
}

H("3 · EL MOROSO SE VE MOROSO · la razón de ser de la cara");
{
  const F = buildMesaFlujo("actual");
  const D = TENANT_DEMO.flujoComercial.clientes;
  /* Los clientes con TECHO por debajo de 1 son los que deben de atrás. Su deuda tiene que ser VIEJA. */
  const conTecho = Object.keys(D).filter((n) => D[n].pctAbonado < 1);
  ok(conTecho.length > 0, `el demo declara ${conTecho.length} clientes que deben de atrás — sin ellos la cara no prueba nada`);
  const morosos = F.filas.filter((f) => conTecho.includes(f.nombre));
  ok(morosos.every((f) => f.estado === "vencido"),
    "todos ellos aparecen VENCIDOS, no «por vencer»",
    morosos.filter((f) => f.estado !== "vencido").map((f) => `${f.nombre}: ${f.estado}`).join(" · "));
  /* ⚠️ ESTA ES LA LÍNEA QUE HABRÍA CAZADO EL DEFECTO. Al construir la cara, el cobro se aplicaba SIEMPRE de la
   * factura más vieja a la más nueva, y entonces al cliente con techo le quedaban sin pagar las facturas
   * NUEVAS: salía «por vencer» y en pantalla se veía sano. Justo al revés de lo que es. La deuda de quien no
   * te devuelve el crédito es vieja, y 90 días es el umbral desde el que eso deja de ser un atraso y pasa a
   * ser un problema. */
  ok(morosos.every((f) => f.diasVencido >= 90),
    "y su deuda es VIEJA (90 días o más), que es lo que la distingue de un atraso normal",
    morosos.map((f) => `${f.nombre}: ${f.diasVencido}d`).join(" · "));
  /* el que paga todo y a tiempo no puede tener deuda vieja */
  const sanos = F.filas.filter((f) => D[f.nombre] && D[f.nombre].pctAbonado >= 1);
  ok(sanos.every((f) => f.diasVencido < 90),
    "y el que paga todo NO tiene deuda vieja: como mucho, el atraso que declara su retraso de pago",
    sanos.filter((f) => f.diasVencido >= 90).map((f) => `${f.nombre}: ${f.diasVencido}d`).join(" · "));
  /* la tabla llega ordenada por lo que hay que mirar primero, sin decirlo con palabras */
  const ordenado = F.filas.every((f, i) => i === 0 || F.filas[i - 1].vencidoK >= f.vencidoK);
  ok(ordenado, "la tabla llega ordenada por saldo vencido: el orden ES la prioridad, sin recomendar nada");
}

H("4 · LA CARA MUESTRA, NO CONCLUYE · y no calcula");
{
  const panel = leer("./src/ui/SentrixPanel.jsx");
  const i = panel.indexOf("function MesaFlujoCara");
  const j = panel.indexOf("function MesaPanel", i);
  ok(i > 0 && j > i, "la cara existe en el panel");
  const cara = panel.slice(i, j);
  /* ⚠️ SIN RECOMENDACIÓN (owner 2026-08-27: «las recomendaciones no van, eso ya lo tenemos con ADI, ese es su
   * labor»). La maqueta que trajo el owner tenía un recuadro de RECOMENDACIÓN y otro de QUÉ MIRAR PRIMERO;
   * ninguno de los dos entró, y esta línea es lo que impide que vuelvan por la ventana. */
  ok(!/[Rr]ecomendaci[óo]n|[Pp]rioriza |deber[íi]as |te conviene/.test(cara),
    "no hay recuadro de recomendación ni prosa que aconseje");
  /* ⚠️ CERO ARITMÉTICA EN LA VISTA. Todo llega hecho del módulo; si acá aparece una división o un toFixed, es
   * que una cuenta se escapó al JSX, donde ningún gate la puede revisar. */
  ok(!/\.toFixed\(|Math\.round\(/.test(cara.replace(/const _[A-Za-z]+ = \d+/g, "")),
    "la vista no redondea ni formatea cifras: eso vive en el módulo");
  /* el interruptor: sin él, la cara no existe */
  ok(/_FLUJO_ON/.test(panel) && /get\("flujo"\) === "1"/.test(panel),
    "la cara vive detrás de `?flujo=1`: sin el parámetro, la app no se mueve");
  ok(/cara === "flujo" && _FLUJO_ON/.test(panel),
    "…y la rama que la pinta lo vuelve a exigir, no alcanza con la pestaña");
}

H("5 · LA PLANTILLA PIDE LO QUE ESTA CARA NECESITA · y no rompe la que el cliente ya llenó");
{
  const ventas = HOJAS.find((h) => h.nombre === "Ventas");
  const abonos = HOJAS.find((h) => h.nombre === "Abonos");
  ok(!!abonos, "la hoja de Abonos está en el contrato");
  ok(abonos && abonos.obligatoria === false,
    "…y es OPCIONAL: un archivo llenado antes, sin ella, sigue validando igual");
  ok(abonos && ["fecha", "factura", "monto"].every((c) => abonos.columnas.some((x) => x.campo === c && x.obligatoria)),
    "…con fecha, folio y monto obligatorios — sin fecha no hay caja, sin folio no hay antigüedad");
  const ultimas = ventas.columnas.slice(-2).map((c) => c.campo);
  ok(ultimas.includes("factura") && ultimas.includes("diasCredito"),
    `las dos columnas nuevas de Ventas van AL FINAL (${ultimas.join(" · ")}): meterlas en el medio corre de lugar a las demás y rompe los archivos ya llenados`);
  ok(ventas.columnas.filter((c) => ["factura", "diasCredito"].includes(c.campo)).every((c) => !c.obligatoria),
    "…y las dos son opcionales");
  /* ⚠️ EL VENCIMIENTO NO SE PIDE COMO FECHA. Una factura tiene varias líneas y una fecha repetida en cada una
   * puede contradecirse a sí misma. Se pide el PLAZO, que es un número por cliente. */
  ok(!ventas.columnas.some((c) => /vencimiento/i.test(c.campo)),
    "el vencimiento NO se pide como columna: se deriva del plazo del cliente, que no puede contradecirse");
}

console.log(`\n── _flujo_comercial_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
