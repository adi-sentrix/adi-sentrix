/* === src/adi/sentrix/mesaFlujo.js · LA CARA «FLUJO COMERCIAL» ================================================
 *
 * QUÉ CONTESTA, con las palabras del owner (2026-08-27): «mostrar la venta del cliente, abonos y saldo
 * pendiente, de esa forma se puede controlar si es que a algún cliente se le da crédito». O sea: de todo lo que
 * vendiste, cuánto entró de verdad en caja, cuánto falta, y quién te está financiando con tu propia plata.
 *
 * ⚠️ NO ES CONTABILIDAD, y la distinción importa para no prometer de más. Acá no hay asientos, ni IVA, ni
 * cuentas por cobrar en el sentido contable. Hay una sola pregunta: la venta que este producto ya conoce,
 * ¿está cobrada o no? Todo lo demás sale de eso.
 *
 * ⚠️ ESTE MÓDULO HACE TODA LA ARITMÉTICA. La vista no suma, no divide y no redondea: recibe cifras ya
 * formateadas y las pinta. Es la misma regla que gobierna `resumenComercial`, `mesaCapital` y `mesaResultado`,
 * y existe porque una cuenta hecha en el JSX es una cuenta que ningún gate puede revisar.
 *
 * ⚠️ LAS FACTURAS SE DERIVAN, NO SE ESCRIBEN. En el demo, la venta de cada cliente se parte en facturas a
 * partir de tres números declarados (ver `flujoComercial` en tenants/demo.js). La razón no es comodidad: la
 * suma de las facturas de un cliente TIENE que ser su venta, exacta, porque esa venta ya se muestra en otras
 * tres caras. Escribir facturas a mano habría abierto la puerta a dos cifras distintas para la misma venta —
 * y el escenario (bonanza · tensión · crisis) las habría despegado igual. Derivadas, cuadran siempre.
 *   EN UN CLIENTE REAL NADA DE ESTO SE DERIVA: el folio viene en la hoja de Ventas, los días de crédito son un
 *   atributo del cliente y los abonos son su propia hoja con fecha y folio. Ver `plantilla.js`.
 *
 * ⚠️ LA FECHA DE CORTE ES DECLARADA, NO ES «HOY». Si la antigüedad se midiera contra el reloj, «vencido hace
 * 36 días» cambiaría cada mañana y la misma pregunta daría dos respuestas distintas en dos días distintos.
 * Todo se mide contra `flujoComercial.fechaCorte`, y la pantalla la dice. */

import { applyScenarioToClientesMargen } from "../../engine/scenarios.js";
import { flujoComercial } from "../../data/demoData.js";

const _r1 = (v) => Math.round(v * 10) / 10;
const _money = (v) => {
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`;
  return `${s}$${Math.round(a)}`;
};
/* el dataset trabaja en miles ($K), igual que venta/contribución del resto de la Mesa */
const _mK = (vK) => _money(vK * 1000);
const _pct = (parte, todo) => (todo > 0 ? _r1((parte / todo) * 100) : 0);

const _DIA = 86400000;
const _fecha = (iso) => new Date(`${iso}T00:00:00Z`);
const _mas = (d, dias) => new Date(d.getTime() + dias * _DIA);
const _iso = (d) => d.toISOString().slice(0, 10);
const _MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const _dLegible = (d) => `${d.getUTCDate()} ${_MES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

/* CUÁNTAS FACTURAS TIENE UN CLIENTE · por tamaño, no al azar: un cliente grande te compra más veces al año.
 * Es una escalera declarada y no una fórmula continua para que el número sea legible y reproducible.
 * ⚠️ Y TIENEN QUE CUBRIR EL AÑO ENTERO. La primera versión las puso cada 30 días: con seis facturas, la venta
 * de un cliente entraba toda en los últimos cinco meses y el gráfico de caja quedaba con siete meses en cero,
 * contradiciendo a la propia cabecera que dice "venta del período". El paso se calcula sobre 350 días. */
const _nFacturas = (ventaK) => (ventaK >= 10000 ? 12 : ventaK >= 4000 ? 8 : 6);
const _paso = (n) => Math.max(1, Math.floor(350 / n));

/** Las facturas de UN cliente, derivadas de su venta. La última absorbe el redondeo: la suma cierra exacta. */
function _facturasDe(nombre, ventaK, params, corte) {
  const n = _nFacturas(ventaK);
  /* PESOS EN RAMPA · las facturas recientes son más grandes, que es la curva que el negocio ya tiene en su
     historial mensual. Sin la rampa, todas iguales, el gráfico de caja saldría plano y mentiría. */
  const pesos = Array.from({ length: n }, (_, k) => n - k);   // k=0 es la MÁS NUEVA
  const total = pesos.reduce((a, b) => a + b, 0);
  const paso = _paso(n);
  const out = [];
  let acumulado = 0;
  for (let k = 0; k < n; k++) {
    const fecha = _mas(corte, -(k * paso + 10));
    const esUltima = k === n - 1;
    const montoK = esUltima ? _r1(ventaK - acumulado) : _r1((ventaK * pesos[k]) / total);
    acumulado = _r1(acumulado + montoK);
    out.push({
      numero: `F-${String(nombre).slice(0, 3).toUpperCase()}-${String(n - k).padStart(3, "0")}`,
      cliente: nombre,
      fecha, fechaIso: _iso(fecha), fechaFmt: _dLegible(fecha),
      montoK,
      vencimiento: _mas(fecha, params.diasCredito),
    });
  }
  /* de la más VIEJA a la más nueva: es el orden en que se cobra y en que se lee una antigüedad */
  return out.reverse().map((f) => ({ ...f, vencIso: _iso(f.vencimiento), vencFmt: _dLegible(f.vencimiento) }));
}

/** Los abonos de un cliente, de la factura más vieja a la más nueva.
 *
 * ⚠️ DOS REGLAS, Y LAS DOS TIENEN QUE VALER — costó una pasada entenderlo. La primera versión dejaba que
 * mandaran solo las fechas, y entonces `pctAbonado` no servía para nada: el % cobrado salía igual para todos
 * los clientes con el mismo plazo, y la cara perdía justo el caso que existe para mostrar.
 *
 *   1) LA FECHA MANDA sobre CUÁNDO. Un abono ocurre en vencimiento + retraso. Si ese día cae después del
 *      corte, todavía no ocurrió: esa factura no está pagada, aunque sea vieja.
 *   2) EL TOPE MANDA sobre CUÁNTO. `pctAbonado` es un TECHO, no un objetivo. En 1.00 significa «este cliente
 *      te paga todo, tarde o temprano» y quien decide es la fecha. Por debajo de 1 significa «este cliente
 *      además te está debiendo de atrás», y ahí aparecen las facturas viejas vencidas — el cliente al que le
 *      diste crédito y no lo está devolviendo, que es exactamente lo que el owner quiere poder ver.
 *
 * Con las dos, el % recuperado de la pantalla es una CONSECUENCIA de las fechas y del techo, no un número
 * escrito a mano. */
function _abonosDe(facturas, ventaK, params, corte) {
  let presupuesto = _r1(ventaK * params.pctAbonado);
  const abonos = [];
  /* ⚠️ EN QUÉ ORDEN PAGA, Y POR QUÉ NO ES EL MISMO PARA TODOS — esto costó una segunda pasada. Pagando
     siempre de la más vieja a la más nueva, al cliente con techo le quedaban sin pagar las facturas NUEVAS,
     que todavía no vencieron: aparecía «por vencer» y en la pantalla se veía sano. Justo al revés de lo que
     es. La deuda de un cliente que no te devuelve el crédito es VIEJA, no nueva.
       · techo 1.00 → paga de la más VIEJA a la más nueva. Es el cobro normal.
       · techo < 1  → paga de la más NUEVA hacia atrás, y lo que no alcanza a cubrir queda sin pagar del lado
         viejo. Es lo que hace de verdad el que te está financiando con tu plata: paga lo justo para seguir
         comprando y deja atrás lo de antes. Así la antigüedad que muestra la pantalla es real. */
  const orden = params.pctAbonado >= 1 ? facturas : [...facturas].reverse();
  for (const f of orden) {
    if (presupuesto <= 0.05) break;
    const cuando = _mas(f.vencimiento, params.retrasoPago);
    if (cuando.getTime() > corte.getTime()) continue;
    const montoK = _r1(Math.min(f.montoK, presupuesto));
    presupuesto = _r1(presupuesto - montoK);
    abonos.push({ factura: f.numero, cliente: f.cliente, fecha: cuando, fechaIso: _iso(cuando), fechaFmt: _dLegible(cuando), montoK });
  }
  return abonos;
}

/** buildMesaFlujo(scenario) → la cara entera, ya formateada. */
export function buildMesaFlujo(scenario = "actual") {
  const D = flujoComercial;
  if (!D || !D.fechaCorte || !D.clientes) return null;
  const corte = _fecha(D.fechaCorte);
  const base = applyScenarioToClientesMargen(scenario) || [];

  const facturas = [], abonos = [], filas = [];
  for (const c of base) {
    const params = D.clientes[c.nombre];
    /* SIN PARÁMETROS DECLARADOS, EL CLIENTE NO ENTRA — no se le inventa un plazo de crédito. Se declara abajo
       en `alcance`, que es lo que la pantalla muestra en vez de disimularlo. */
    if (!params) continue;
    const ventaK = Number(c.venta) || 0;
    if (ventaK <= 0) continue;

    const fs = _facturasDe(c.nombre, ventaK, params, corte);
    const abs = _abonosDe(fs, ventaK, params, corte);
    facturas.push(...fs); abonos.push(...abs);

    const pagado = {};
    for (const a of abs) pagado[a.factura] = _r1((pagado[a.factura] || 0) + a.montoK);

    let abonadoK = 0, saldoK = 0, vencidoK = 0, diasMax = 0, masVieja = null;
    for (const f of fs) {
      const ab = pagado[f.numero] || 0;
      const saldo = _r1(f.montoK - ab);
      abonadoK = _r1(abonadoK + ab);
      if (saldo > 0.05) {
        saldoK = _r1(saldoK + saldo);
        const dias = Math.round((corte.getTime() - f.vencimiento.getTime()) / _DIA);
        if (dias > 0) {
          vencidoK = _r1(vencidoK + saldo);
          if (dias > diasMax) { diasMax = dias; masVieja = f; }
        }
      }
    }
    filas.push({
      key: c.nombre, nombre: c.nombre,
      ventaK, ventaFmt: _mK(ventaK),
      abonadoK, abonadoFmt: _mK(abonadoK),
      saldoK, saldoFmt: _mK(saldoK),
      vencidoK, vencidoFmt: vencidoK > 0 ? _mK(vencidoK) : null,
      recuperadoPct: _pct(abonadoK, ventaK), recuperadoFmt: `${_pct(abonadoK, ventaK)}%`,
      diasCredito: params.diasCredito,
      diasVencido: diasMax,
      /* EL ESTADO NO ES UNA OPINIÓN: sale de comparar el vencimiento contra la fecha de corte declarada. */
      estado: saldoK <= 0.05 ? "al_dia" : vencidoK > 0 ? "vencido" : "por_vencer",
      facturaMasVieja: masVieja ? { numero: masVieja.numero, vencFmt: masVieja.vencFmt } : null,
      ask: `¿Cómo viene el cobro de ${c.nombre}?`,
    });
  }
  if (!filas.length) return null;

  filas.sort((a, b) => b.vencidoK - a.vencidoK || b.saldoK - a.saldoK);

  const ventaK = _r1(filas.reduce((s, f) => s + f.ventaK, 0));
  const abonadoK = _r1(filas.reduce((s, f) => s + f.abonadoK, 0));
  const saldoK = _r1(filas.reduce((s, f) => s + f.saldoK, 0));
  const vencidoK = _r1(filas.reduce((s, f) => s + f.vencidoK, 0));

  /* LA CAJA, MES A MES · doce meses que terminan en el corte. El eje no se inventa: se recorre hacia atrás
     desde el mes del corte, así que el último punto SIEMPRE es el mes que la pantalla declara. */
  const meses = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(Date.UTC(corte.getUTCFullYear(), corte.getUTCMonth() - k, 1));
    meses.push({ y: d.getUTCFullYear(), m: d.getUTCMonth(), label: _MES[d.getUTCMonth()], montoK: 0 });
  }
  const idx = new Map(meses.map((x, i) => [`${x.y}-${x.m}`, i]));
  for (const a of abonos) {
    const i = idx.get(`${a.fecha.getUTCFullYear()}-${a.fecha.getUTCMonth()}`);
    if (i != null) meses[i].montoK = _r1(meses[i].montoK + a.montoK);
  }
  /* ⚠️ SE RECORTAN LOS MESES SIN COBRO DEL PRINCIPIO, y no es cosmética. El primer abono no puede ocurrir
     antes de que venza la primera factura del período: con plazos de 30 a 60 días más el retraso, los primeros
     dos o tres meses de la ventana no tienen NINGÚN cobro de este período —los cobros que les tocarían son de
     ventas anteriores, que este dato no tiene—. Dibujarlos en cero diría que no se cobró nada esos meses, que
     es falso: lo que pasa es que no lo sabemos. Se muestran los meses que el período sí puede explicar. */
  while (meses.length > 2 && meses[0].montoK <= 0.05) meses.shift();
  const pico = meses.reduce((a, b) => (b.montoK > a.montoK ? b : a), meses[0]);
  const valle = meses.reduce((a, b) => (b.montoK < a.montoK ? b : a), meses[0]);
  /* ⚠️ EL TOTAL SE CALCULA UNA VEZ, y el % de cada mes SALE DE ACÁ, no de la pantalla. El tooltip del gráfico
     muestra qué parte de la caja del período trajo cada mes; esa división vive en este módulo con el resto de la
     aritmética. La regla de esta cara es que la vista no calcula nada — es lo que permite que el gate compruebe
     las cifras sin abrir un componente, y lo que impide que el mismo número salga distinto en dos lugares. */
  const cajaTotalK = _r1(meses.reduce((s, x) => s + x.montoK, 0));
  const caja = {
    meses: meses.map((x) => ({ ...x, fmt: _mK(x.montoK), pctFmt: `${_pct(x.montoK, cajaTotalK)}%`,
      /* el mes CON SU AÑO: la ventana cruza el cambio de año, y «ene» solo no dice cuál. */
      periodo: `${x.label} ${x.y}` })),
    maxK: pico.montoK,
    totalK: cajaTotalK,
    totalFmt: _mK(cajaTotalK),
    picoLabel: pico.label, picoFmt: _mK(pico.montoK),
    valleLabel: valle.label, valleFmt: _mK(valle.montoK),
    ask: "¿Cómo viene mi entrada de caja mes a mes?",
  };

  const conParams = filas.length, delDato = base.length;
  return {
    scenario,
    fechaCorte: D.fechaCorte,
    fechaCorteFmt: _dLegible(corte),
    kpis: [
      { key: "venta",      label: "Venta del período", valor: _mK(ventaK), pie: `${conParams} clientes`,
        ask: "¿Cuánto vendí en el período?" },
      { key: "abonado",    label: "Abonado",           valor: _mK(abonadoK), pie: `${_pct(abonadoK, ventaK)}% de la venta`,
        ask: "¿Cuánto me han pagado mis clientes?" },
      { key: "saldo",      label: "Saldo pendiente",   valor: _mK(saldoK), pie: `${_pct(saldoK, ventaK)}% de la venta`,
        ask: "¿Cuánto me deben mis clientes?" },
      { key: "vencido",    label: "Saldo vencido",     valor: _mK(vencidoK), pie: `${_pct(vencidoK, saldoK)}% del saldo`,
        ask: "¿Qué saldo tengo vencido?" },
    ],
    filas,
    facturas,
    abonos,
    caja,
    /* EL ALCANCE, DECLARADO · si algún cliente del dato no tiene plazo de crédito declarado, queda fuera y se
       dice. Nunca se le pone un plazo por defecto: sería inventar el dato que esta cara existe para mostrar. */
    alcance: conParams === delDato
      ? `Los ${conParams} clientes del período, al ${_dLegible(corte)}.`
      : `${conParams} de ${delDato} clientes, al ${_dLegible(corte)} — el resto no tiene plazo de crédito declarado.`,
    completo: conParams === delDato,
  };
}

export default buildMesaFlujo;
