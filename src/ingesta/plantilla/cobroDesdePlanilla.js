/* === ingesta/plantilla/cobroDesdePlanilla.js · DE LAS DOS HOJAS AL COBRO (owner 2026-08-30) ============
 *
 * QUÉ HACE. Junta la hoja `Ventas` y la hoja `Abonos` en las tres cifras que la cara Flujo Comercial necesita:
 * **vendido a crédito · abonado · saldo pendiente**. Y nada más que eso.
 *
 * ⚠️ EL VENCIDO NO SE CALCULA ACÁ, Y NO ES UN OLVIDO. Para saber si un saldo está vencido hace falta el PLAZO
 * DE PAGO, que es una política del negocio y todavía no se ingresa en ninguna parte. El owner separó el
 * trabajo explícitamente: «primero cobrado/pendiente desde Abonos; luego vencido cuando exista plazo». Así que
 * el saldo se informa y el vencido se DECLARA COMO NO CALCULABLE — que es la regla de la casa: lo que no se
 * puede, se dice. Inventar un plazo de 30 días habría sido la alternativa cómoda y falsa.
 *
 * ⚠️ SOLO ENTRA LA VENTA A CRÉDITO, y ese fue el aporte del owner: «puede resultar que no es toda porque pagó
 * al contado». Una venta de contado no genera deuda: incluirla infla el pendiente y le inventa al cliente una
 * mora que no tiene. Sin `condición` declarada se asume CONTADO — no se supone que hubo crédito.
 *
 * ⚠️ LA NOTA DE CRÉDITO RESTA, Y SU MONTO SE ESCRIBE POSITIVO. El signo lo decide el tipo de documento, no el
 * usuario: pedirle que escriba negativos es pedirle que se equivoque, y un negativo en un documento que ya
 * resta se descuenta dos veces. Un monto negativo en una nota de crédito se declara como contradicción.
 *
 * NADA SE DESCARTA EN SILENCIO. Un abono contra un folio que no existe, un cliente que no coincide con el de
 * su factura, un folio pagado de más: los tres se informan como avisos y NO se suman. Es lo que pasa siempre
 * cuando alguien exporta ventas de un período y abonos de otro.
 */

const _r1 = (v) => Math.round(v * 10) / 10;
const _norm = (s) => String(s == null ? "" : s).trim().toLowerCase();

/** ¿Este documento resta en vez de sumar? Lo decide el tipo, nunca el signo del monto. */
const esNotaDeCredito = (tipoDoc) => /nota\s*de\s*cr[eé]dito|^nc$/i.test(String(tipoDoc || "").trim());

/** ¿Esta venta genera deuda? Solo si el negocio declaró que fue a crédito. Vacío = contado. */
const esCredito = (condicion) => /^cr[eé]dito$/i.test(String(condicion || "").trim());

/* cobroDesdePlanilla({ ventas, abonos, fechaCorte }) → { facturas, abonos, avisos, origen } | null
 *
 * Devuelve `null` cuando no hay nada que mostrar —ninguna venta a crédito— para que quien llame no dibuje una
 * cara vacía. Las cifras van en las MISMAS unidades que la hoja: el resto del pack ya las trata así. */
export function cobroDesdePlanilla({ ventas = [], abonos = [], fechaCorte = null } = {}) {
  const avisos = [];

  /* ── 1 · LAS FACTURAS · las líneas de un mismo folio son UN documento ──────────────────────────────── */
  const porFolio = new Map();
  let sinFolio = 0, sinCondicion = 0;
  for (const v of ventas) {
    const folio = String(v.folio == null ? "" : v.folio).trim();
    if (!folio) { sinFolio++; continue; }
    if (!esCredito(v.condicion)) { if (!v.condicion) sinCondicion++; continue; }

    const monto = Number(v.venta) || 0;
    if (esNotaDeCredito(v.tipoDoc) && monto < 0) {
      avisos.push({ tipo: "nota-de-credito-negativa", folio,
        detalle: `el folio ${folio} es una nota de crédito con monto negativo: el tipo de documento ya resta, así que el monto se escribe positivo. Esa fila no se suma.` });
      continue;
    }
    const firmado = esNotaDeCredito(v.tipoDoc) ? -Math.abs(monto) : monto;

    const f = porFolio.get(folio) || { folio, cliente: v.cliente, fecha: v.fecha, montoK: 0, lineas: 0, clientes: new Set() };
    f.montoK = _r1(f.montoK + firmado);
    f.lineas += 1;
    f.clientes.add(_norm(v.cliente));
    /* La fecha del documento es la MÁS TEMPRANA de sus líneas: si el usuario fechó distinto dentro de la misma
     * factura, la deuda nace cuando nació la primera, no cuando terminó de tipear. */
    if (v.fecha && (!f.fecha || v.fecha < f.fecha)) f.fecha = v.fecha;
    porFolio.set(folio, f);
  }

  /* ⚠️ UN FOLIO CON DOS CLIENTES ES UNA CONTRADICCIÓN, no algo que se resuelva eligiendo uno. Es el mismo
   * criterio con que el validador trata un SKU con dos marcas. */
  for (const f of porFolio.values()) {
    if (f.clientes.size > 1) {
      avisos.push({ tipo: "folio-con-dos-clientes", folio: f.folio,
        detalle: `el folio ${f.folio} aparece con ${f.clientes.size} clientes distintos: no se puede saber de quién es la deuda, así que ese documento queda fuera.` });
    }
  }
  const facturas = [...porFolio.values()].filter((f) => f.clientes.size === 1).map(({ clientes, ...f }) => f);

  if (sinCondicion > 0) {
    avisos.push({ tipo: "condicion-sin-declarar", filas: sinCondicion,
      detalle: `${sinCondicion} filas de venta no declaran condición: se toman como contado y no cuentan como deuda. Si fueron a crédito, escribí «crédito» en esa columna.` });
  }
  if (sinFolio > 0) {
    avisos.push({ tipo: "venta-sin-folio", filas: sinFolio,
      detalle: `${sinFolio} filas de venta no traen folio y no se pueden agrupar en un documento.` });
  }

  /* ── 2 · LOS ABONOS · contra un folio que tiene que existir ────────────────────────────────────────── */
  const indice = new Map(facturas.map((f) => [f.folio, f]));
  const buenos = [];
  let huerfanos = 0;
  for (const a of abonos) {
    const folio = String(a.folio == null ? "" : a.folio).trim();
    const f = indice.get(folio);
    if (!f) { huerfanos++; continue; }
    if (a.cliente && _norm(a.cliente) !== _norm(f.cliente)) {
      avisos.push({ tipo: "abono-de-otro-cliente", folio,
        detalle: `un abono dice «${a.cliente}» pero el folio ${folio} es de «${f.cliente}»: puede estar imputado a la factura equivocada. No se suma.` });
      continue;
    }
    buenos.push({ folio, cliente: f.cliente, fecha: a.fecha, montoK: Number(a.monto) || 0 });
  }
  if (huerfanos > 0) {
    avisos.push({ tipo: "abono-sin-factura", filas: huerfanos,
      detalle: `${huerfanos} abonos no cruzan con ninguna factura a crédito de la hoja Ventas: no se suman. Pasa cuando las ventas y los abonos son de períodos distintos.` });
  }

  /* ── 3 · PAGADO DE MÁS · se declara, no se deja en negativo ────────────────────────────────────────── */
  const pagadoPorFolio = new Map();
  for (const a of buenos) pagadoPorFolio.set(a.folio, _r1((pagadoPorFolio.get(a.folio) || 0) + a.montoK));
  for (const f of facturas) {
    const pagado = pagadoPorFolio.get(f.folio) || 0;
    if (pagado - f.montoK > 0.05) {
      avisos.push({ tipo: "abonado-mayor-que-facturado", folio: f.folio,
        detalle: `el folio ${f.folio} tiene más abonos que monto facturado. Puede ser un error de tipeo o una nota de crédito que falta cargar; el saldo de ese documento queda en cero, no en negativo.` });
    }
  }

  if (!facturas.length) return null;

  return {
    origen: "planilla",
    fechaCorte: fechaCorte || null,
    facturas,
    abonos: buenos,
    /* ⚠️ SIN PLAZO NO HAY VENCIDO, y viaja declarado para que la pantalla lo diga en vez de mostrar un cero.
     * Un cero acá significaría «no debe nada vencido», que es una afirmación que nadie puede sostener. */
    diasCredito: null,
    avisos,
  };
}
