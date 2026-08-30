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
import { simboloMoneda } from "../../config/moneda.js";

const _r1 = (v) => Math.round(v * 10) / 10;
/* ⚠️ EL SÍMBOLO SALE DE LA MONEDA DECLARADA, NO SE ESCRIBE A MANO (2026-08-30). Este formateador nació con un
 * «$» fijo, dos versiones después de que la 2.3 lo sacara de los otros 32 archivos. Con un negocio en euros,
 * esta pestaña habría mostrado «$» mientras el resto de la app muestra «€»: dos monedas en la misma pantalla.
 *
 * Cambia el SÍMBOLO y nada más. El redondeo y la abreviación quedan idénticos a propósito: el notario compara
 * verbatim la cifra del texto contra la de la boleta, y tocar la escala lo haría vetar cifras correctas. */
const _money = (v) => {
  const a = Math.abs(v), s = v < 0 ? "-" : "", sim = simboloMoneda();
  if (a >= 1e6) return `${s}${sim}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}${sim}${Math.round(a / 1e3)}K`;
  return `${s}${sim}${Math.round(a)}`;
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
/* buildDesdePlanilla(D) → la misma cara, pero con FACTURAS REALES (owner 2026-08-30).
 *
 * ⚠️ LAS DOS FUENTES NO SE PARECEN, Y ESO ES CORRECTO. El demo declara tres parámetros por cliente y las
 * facturas se DERIVAN de su venta; una planilla real trae los documentos de verdad, con su folio. Forzar una
 * sola forma habría significado inventarle parámetros al cliente real o inventarle folios al demo. Cada fuente
 * entra como es y las dos terminan en la misma fila de pantalla.
 *
 * ⚠️ ACÁ NO HAY VENCIDO. Sin plazo de pago declarado no se puede saber si un saldo está vencido, y el plazo
 * todavía no se ingresa en ninguna parte. Se devuelve `vencidoK: null` —no cero— para que la pantalla pueda
 * decir que no lo sabe. Un cero significaría «no debe nada vencido», que es una afirmación que nadie sostiene.
 *
 * ⚠️ Y DEVUELVE EXACTAMENTE LAS MISMAS LLAVES QUE EL DEMO, aunque las cuentas de adentro sean otras. La primera
 * versión de esta función inventó una forma propia —`total` en vez de `kpis`, sin `caja`, sin `alcance`— y la
 * pestaña, que lee las del demo, se habría quedado en blanco con el dato cargado: ninguna prueba de aritmética
 * lo veía, porque las cuentas estaban bien. Lo que fallaba era el enchufe. Por eso el candado compara las dos
 * formas llave por llave: mientras haya dos caminos hacia la misma pantalla, tienen que entregar lo mismo. */
function buildDesdePlanilla(D) {
  const corte = D.fechaCorte ? _fecha(D.fechaCorte) : null;
  const pagado = new Map();
  for (const a of D.abonos) pagado.set(a.folio, _r1((pagado.get(a.folio) || 0) + a.montoK));

  const porCliente = new Map();
  for (const f of D.facturas) {
    const c = porCliente.get(f.cliente) || { nombre: f.cliente, ventaK: 0, abonadoK: 0, saldoK: 0, docs: 0 };
    /* El abono no puede superar a su factura: lo que sobra ya se declaró como aviso en la ingesta, y dejarlo
     * restar acá convertiría un error de carga en un «saldo a favor» que nadie declaró. */
    const ab = Math.min(pagado.get(f.folio) || 0, f.montoK);
    c.ventaK = _r1(c.ventaK + f.montoK);
    c.abonadoK = _r1(c.abonadoK + ab);
    c.saldoK = _r1(c.saldoK + Math.max(0, _r1(f.montoK - ab)));
    c.docs += 1;
    porCliente.set(f.cliente, c);
  }

  const filas = [...porCliente.values()]
    .filter((c) => c.ventaK > 0)
    .map((c) => ({
      key: c.nombre, nombre: c.nombre,
      ventaK: c.ventaK, ventaFmt: _mK(c.ventaK),
      abonadoK: c.abonadoK, abonadoFmt: _mK(c.abonadoK),
      saldoK: c.saldoK, saldoFmt: _mK(c.saldoK),
      vencidoK: null, vencidoFmt: null,
      recuperadoPct: _pct(c.abonadoK, c.ventaK), recuperadoFmt: `${_pct(c.abonadoK, c.ventaK)}%`,
      /* ⚠️ EL PLAZO VIAJA FORMATEADO, y no es un capricho de estilo. La tabla escribía `{f.diasCredito}d`, así
       * que sin plazo declarado la celda mostraba una «d» suelta — una unidad sin número. Formatear acá es
       * además la regla de la casa: la vista pinta, el módulo calcula y rotula. */
      diasCredito: null, diasCreditoFmt: "—",
      diasVencido: null, diasVencidoFmt: "—",
      documentos: c.docs,
      /* SIN PLAZO SOLO HAY DOS ESTADOS HONESTOS: pagado o debiendo. «Vencido» y «por vencer» exigen saber
       * cuándo había que pagar, y eso todavía nadie lo declaró. */
      estado: c.saldoK <= 0.05 ? "al_dia" : "pendiente",
      facturaMasVieja: null,
      ask: `¿Cómo viene el cobro de ${c.nombre}?`,
    }))
    .sort((a, b) => b.saldoK - a.saldoK);

  if (!filas.length) return null;

  const ventaK = _r1(filas.reduce((s, f) => s + f.ventaK, 0));
  const abonadoK = _r1(filas.reduce((s, f) => s + f.abonadoK, 0));
  const saldoK = _r1(filas.reduce((s, f) => s + f.saldoK, 0));

  /* LA CAJA, MES A MES · con los abonos REALES de la hoja. Misma ventana de doce meses que termina en el corte,
     mismo recorte de los meses del principio sin cobro: si el negocio subió ventas de julio y agosto, los meses
     anteriores no tienen abonos que explicar y dibujarlos en cero diría que no se cobró nada, que es falso. */
  const meses = [];
  for (let k = 11; k >= 0 && corte; k--) {
    const d = new Date(Date.UTC(corte.getUTCFullYear(), corte.getUTCMonth() - k, 1));
    meses.push({ y: d.getUTCFullYear(), m: d.getUTCMonth(), label: _MES[d.getUTCMonth()], montoK: 0 });
  }
  const idx = new Map(meses.map((x, i) => [`${x.y}-${x.m}`, i]));
  const abonosFecha = [];
  for (const a of D.abonos) {
    const cuando = a.fecha ? _fecha(a.fecha) : null;
    if (!cuando || Number.isNaN(cuando.getTime())) continue;
    abonosFecha.push({ factura: a.folio, cliente: a.cliente, fecha: cuando, fechaIso: _iso(cuando), fechaFmt: _dLegible(cuando), montoK: a.montoK });
    const i = idx.get(`${cuando.getUTCFullYear()}-${cuando.getUTCMonth()}`);
    if (i != null) meses[i].montoK = _r1(meses[i].montoK + a.montoK);
  }
  while (meses.length > 2 && meses[0].montoK <= 0.05) meses.shift();
  const pico = meses.length ? meses.reduce((a, b) => (b.montoK > a.montoK ? b : a), meses[0]) : { label: "—", montoK: 0 };
  const valle = meses.length ? meses.reduce((a, b) => (b.montoK < a.montoK ? b : a), meses[0]) : { label: "—", montoK: 0 };
  const cajaTotalK = _r1(meses.reduce((s, x) => s + x.montoK, 0));
  const caja = {
    meses: meses.map((x) => ({ ...x, fmt: _mK(x.montoK), pctFmt: `${_pct(x.montoK, cajaTotalK)}%`, periodo: `${x.label} ${x.y}` })),
    maxK: pico.montoK,
    totalK: cajaTotalK,
    totalFmt: _mK(cajaTotalK),
    picoLabel: pico.label, picoFmt: _mK(pico.montoK),
    valleLabel: valle.label, valleFmt: _mK(valle.montoK),
    ask: "¿Cómo viene mi entrada de caja mes a mes?",
  };

  const docs = D.facturas.length;
  return {
    origen: "planilla",
    scenario: "actual",
    fechaCorte: D.fechaCorte || null,
    fechaCorteFmt: corte ? _dLegible(corte) : null,
    /* LAS MISMAS CUATRO CIFRAS DE ARRIBA QUE EL DEMO, en el mismo orden y con las mismas llaves — la cuarta es
       la que cambia: en vez de un monto vencido lleva una raya, porque no hay plazo con qué calcularlo. Mostrar
       «$0» ahí sería la mentira más barata de toda esta cara. */
    kpis: [
      { key: "venta",   label: "Venta a crédito del período", valor: _mK(ventaK), pie: `${filas.length} clientes · ${docs} documentos`,
        ask: "¿Cuánto vendí a crédito en el período?" },
      { key: "abonado", label: "Abonado", valor: _mK(abonadoK), pie: `${_pct(abonadoK, ventaK)}% de la venta a crédito`,
        ask: "¿Cuánto me han pagado mis clientes?" },
      { key: "saldo",   label: "Saldo pendiente", valor: _mK(saldoK), pie: `${_pct(saldoK, ventaK)}% de la venta a crédito`,
        ask: "¿Cuánto me deben mis clientes?" },
      { key: "vencido", label: "Saldo vencido", valor: "—", pie: "sin plazo de pago declarado",
        ask: "¿Por qué no puedo ver el saldo vencido?" },
    ],
    filas,
    facturas: D.facturas.map((f) => ({ numero: f.folio, cliente: f.cliente, fechaIso: f.fecha, montoK: f.montoK, lineas: f.lineas })),
    abonos: abonosFecha,
    caja,
    /* EL ALCANCE · dice de dónde salió cada cosa y qué no alcanza, que es lo que la pantalla muestra debajo de
       las cifras. Nombra la venta a crédito a propósito: el resto se pagó al contado y no es deuda de nadie. */
    alcance: `${filas.length} clientes con venta a crédito, ${docs} documentos, al ${corte ? _dLegible(corte) : "cierre del período"}. Las ventas de contado no entran: no generan deuda.`,
    completo: false,
    total: {
      ventaK, ventaFmt: _mK(ventaK),
      abonadoK, abonadoFmt: _mK(abonadoK),
      saldoK, saldoFmt: _mK(saldoK),
      vencidoK: null, vencidoFmt: null,
      recuperadoPct: _pct(abonadoK, ventaK), recuperadoFmt: `${_pct(abonadoK, ventaK)}%`,
    },
    /* ⚠️ LO QUE ESTA CARA TODAVÍA NO PUEDE, DECLARADO PARA QUE LA PANTALLA LO DIGA. Es la mitad del trabajo
     * que el owner separó a propósito: primero cobrado y pendiente, después vencido. */
    sinPlazo: true,
    porQueSinVencido: "Para saber qué parte del saldo está vencida hace falta el plazo de pago, y todavía no está declarado. Lo que sí se puede afirmar es cuánto se vendió a crédito, cuánto entró y cuánto falta.",
    avisos: D.avisos || [],
  };
}

export function buildMesaFlujo(scenario = "actual") {
  const D = flujoComercial;
  if (!D || !D.fechaCorte) return null;
  /* Una planilla real trae `facturas`; el demo trae `clientes` con sus parámetros. */
  if (Array.isArray(D.facturas)) return buildDesdePlanilla(D);
  if (!D.clientes) return null;
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
      /* el plazo va también FORMATEADO: la tabla ya no le pega la unidad a mano, porque el camino de la
         planilla no tiene plazo que mostrar y le quedaba una «d» sola en la celda. */
      diasCredito: params.diasCredito, diasCreditoFmt: `${params.diasCredito}d`,
      diasVencido: diasMax, diasVencidoFmt: diasMax > 0 ? diasMax + "d" : "—",
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
