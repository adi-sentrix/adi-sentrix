/* === adi/sentrix/diasYRotacion.js · DÍAS DE INVENTARIO Y ROTACIÓN · informado manda, calculado rellena =========
 *
 * LA REGLA, textual del owner (2026-08-22):
 *   «Si días de inventario o rotación vienen informados por el origen, se usan como dato operativo declarado.
 *    Si no vienen informados, ADI los calcula con fórmula declarada. En ambos casos debe quedar declarada la
 *    procedencia: informado o calculado. Nunca debe haber dos verdades para la misma fila.»
 *
 * POR QUÉ HACÍA FALTA, y está medido. Hasta hoy estas dos métricas eran dato primario SIN fórmula: el contrato
 * decía `formula: null` y CLAUDE.md §4 lo dejaba escrito — «los días son un valor declarado, no una cuenta». Eso
 * dejaba la cara Capital imposible de armar desde un archivo que solo trae hechos, porque el diagnóstico
 * (inmovilizado · sobrestock · riesgo de quiebre · el estado de cada SKU) se decide comparando estas dos contra
 * los umbrales del negocio.
 *
 * ⚠️ Y NO SE PODÍA «DESCUBRIR» LA FÓRMULA MIRANDO EL DATO DE REFERENCIA, porque ahí no hay ninguna. Medido sobre
 * los 13 SKU: `stock ÷ venta diaria` reproduce el `doh` declarado en 2 de 13, y `365 ÷ doh` reproduce la
 * `rotacion` declarada en 0 de 13. Los valores del demo están puestos a mano y no derivan de su propio stock ni
 * de su propia venta. Por eso la fórmula se DECLARA (es una definición de negocio) en vez de inferirse.
 *
 * QUÉ RESUELVE ESTA REGLA, y es la razón de que sea «informado manda» y no «la fórmula siempre»:
 *   · un ERP que ya publica su métrica la sigue mandando y ADI la respeta — no le discute el número a su sistema;
 *   · una planilla simple no tiene que pedir NINGÚN KPI a mano: alcanza con stock y unidades vendidas;
 *   · el dato de referencia no se mueve. Con «la fórmula siempre», SAM-TV55 pasaba de 58 días a 22 y dejaba de
 *     ser «Lento» — cambia lo que la Mesa muestra y lo que ADI dice, y arrastra los gates y el corpus de exámenes.
 *     El owner priorizó compatibilidad y avance; la pureza queda para una regeneración futura del demo.
 *
 * «NUNCA DOS VERDADES PARA LA MISMA FILA» se cumple así: cada métrica sale con UN valor y UNA procedencia. Y
 * cuando los días vienen informados y la rotación no, la rotación se deriva de ESOS días —no de unos calculados
 * aparte—, para que las dos cifras de la fila hablen del mismo stock.
 *
 * Si el origen manda las dos y no son consistentes entre sí, se respetan las dos como vienen: son dos hechos que
 * declaró el sistema de origen, y corregirle uno con el otro sería inventar. (Pasa en el dato de referencia:
 * doh 17 con rotación 9.8, cuando 365÷17 daría 21.5.)
 *
 * PURO · sin estado · sin red · no lee el store: recibe la fila y el período ya resueltos por quien los tiene.
 */

/** Los días del período por defecto. Un mes comercial: la unidad en la que se informa la venta. */
export const DIAS_PERIODO_DEFECTO = 30;

/** El año comercial con el que se anualiza la rotación. */
export const DIAS_ANIO = 365;

/* LAS FÓRMULAS, EN PALABRAS — las mismas que declara el contrato (`metricRegistry`, `formulaSiFalta`). Viven acá
 * como texto para que la procedencia pueda mostrarse sin que nadie la reescriba a mano en una pantalla. */
export const FORMULA_DIAS = "stock en unidades ÷ (unidades vendidas del período ÷ días del período)";
export const FORMULA_ROTACION = "365 ÷ días de inventario";

const _num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const _r1 = (n) => Math.round(n * 10) / 10;

/* La venta del período en unidades puede venir de dos lados y son el MISMO hecho con dos nombres: `vendidoMes` en
 * la hoja de inventario, o la suma de `unidades` de las filas de venta de ese SKU. Quien llama elige cuál tiene;
 * acá se acepta cualquiera de las dos en vez de obligar a normalizar antes. */
function _unidadesDelPeriodo(fila, unidadesPeriodo) {
  const explicito = _num(unidadesPeriodo);
  if (explicito !== null) return explicito;
  return _num(fila && fila.vendidoMes);
}

/**
 * resolverDiasYRotacion(fila, { unidadesPeriodo, diasPeriodo }) →
 *   { dias: {valor, procedencia, formula}, rotacion: {valor, procedencia, formula} }
 *
 * `procedencia` es siempre uno de: "informado" · "calculado" · "sin dato".
 * Un valor null SIEMPRE viene con procedencia "sin dato": nunca un cero que parezca una medición.
 */
export function resolverDiasYRotacion(fila, { unidadesPeriodo = null, diasPeriodo = DIAS_PERIODO_DEFECTO } = {}) {
  const f = fila && typeof fila === "object" ? fila : {};
  const dp = _num(diasPeriodo) && diasPeriodo > 0 ? diasPeriodo : DIAS_PERIODO_DEFECTO;

  // ── DÍAS ─────────────────────────────────────────────────────────────────────────────────────────────────
  let dias;
  const dohInformado = _num(f.doh);
  if (dohInformado !== null && dohInformado >= 0) {
    dias = { valor: dohInformado, procedencia: "informado", formula: null };
  } else {
    const stock = _num(f.stockUnd);
    const und = _unidadesDelPeriodo(f, unidadesPeriodo);
    // sin venta en el período no hay ritmo contra el cual medir la duración del stock: se declara el hueco.
    // Devolver "infinito" o un número enorme sería inventar una medición donde no hay denominador.
    dias = (stock !== null && und !== null && und > 0)
      ? { valor: _r1(stock / (und / dp)), procedencia: "calculado", formula: FORMULA_DIAS }
      : { valor: null, procedencia: "sin dato", formula: null };
  }

  // ── ROTACIÓN ─────────────────────────────────────────────────────────────────────────────────────────────
  let rotacion;
  const rotInformada = _num(f.rotacion);
  if (rotInformada !== null && rotInformada >= 0) {
    rotacion = { valor: rotInformada, procedencia: "informado", formula: null };
  } else if (dias.valor !== null && dias.valor > 0) {
    // SE DERIVA DE LOS DÍAS QUE YA RESOLVIMOS, informados o calculados: si se recalculara aparte, la fila podría
    // terminar diciendo dos cosas distintas del mismo stock. Esa es la regla de «una sola verdad por fila».
    rotacion = { valor: _r1(DIAS_ANIO / dias.valor), procedencia: "calculado", formula: FORMULA_ROTACION };
  } else {
    rotacion = { valor: null, procedencia: "sin dato", formula: null };
  }

  return { dias, rotacion };
}

/** Texto corto de procedencia, para declararla en pantalla sin que cada superficie invente su redacción. */
export function textoProcedencia(resuelto) {
  if (!resuelto || resuelto.procedencia === "sin dato") return "sin dato";
  if (resuelto.procedencia === "informado") return "informado por tu sistema";
  return `calculado por ADI (${resuelto.formula})`;
}
