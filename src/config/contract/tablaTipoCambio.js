/* === config/contract/tablaTipoCambio.js · EL TIPO DE CAMBIO POR PERÍODO · PIEZA DE DATOS, NUNCA UNA LLAMADA (owner 2026-10-05) ===
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
 * BLOQUE «TAMAÑO GENERAL DE ADI» (Etapa 2). Decisión del owner (2026-10-05): el tamaño en ADI es un criterio
 * general y regional de ADI para el contexto de Knowledge —NO una clasificación legal ni una medición financiera de
 * precisión—, por ventas anuales en US$. Para pasar la venta anual de la moneda del negocio a US$ se usa el
 * **promedio MENSUAL oficial del tipo de cambio del mes de cierre del período declarado, publicado tal cual** (sin
 * calcular promedios propios); si no hay un tipo de cambio oficial válido para esa moneda y período, NO se clasifica y
 * se dice por qué (falla cerrado: nunca el mes vecino, nunca interpolación). Moneda USD → factor 1, sin tabla.
 *
 * ⚠️ ESTO ES UNA TABLA ESCRITA Y FIRMADA, del mismo tipo que `tablaUF.js`: este módulo NO IMPORTA NADA de red (ni
 * `fetch`, ni un gateway, ni un cliente HTTP). Consultar el tipo de cambio en línea en tiempo de ejecución haría que
 * la misma pregunta diera bandas distintas según el día (la banda dejaría de ser determinística) y metería una
 * llamada de red en el corazón determinístico de ADI. El gate `_tamano_general_gate` lee el TEXTO de este archivo y
 * se enciende si aparece una palabra de red.
 *
 * CÓMO SE LEE: una fila por (moneda, período «aaaa-mm» —el mismo grano que `motorKpi.js` usa para el período
 * declarado—). Hoy SOLO hay filas de CLP (dólar observado, Servicio de Impuestos Internos). Otra moneda no tiene
 * filas y por eso no clasifica: no tenerlas ES la respuesta, no un caso pendiente de programar. Agregar un mes es
 * agregar su fila (valor tal cual lo publica la fuente, URL, firma de la fuente): CADA fila lleva su propia
 * procedencia; no hay valor «por defecto» que se herede solo.
 *
 * FUENTE DE LAS FILAS SEMBRADAS (2026-10-05): SII, «Dólar Observado», promedio mensual:
 *   https://www.sii.cl/valores_y_fechas/dolar/dolar2025.htm   (enero a diciembre de 2025)
 *   https://www.sii.cl/valores_y_fechas/dolar/dolar2026.htm   (enero a septiembre de 2026)
 * Los valores se extrajeron con un parser de la página («Promedio <Mes>: $X» de cada mes) y se contrastaron con la
 * fila «Promedio» de la tabla resumen de la misma página: coinciden los 21. No se calculó ningún promedio propio
 * (el promedio de las celdas diarias coincide con el publicado, pero el valor sembrado es el publicado, tal cual).
 * Octubre de 2026 NO se siembra: el mes no ha cerrado (la página trae un promedio parcial de un solo día).
 *
 * SIN INTERPOLACIÓN NI ESTIMACIÓN. Un período sin fila exacta devuelve `null`: la ausencia de fila ES la respuesta,
 * nunca un valor aproximado, ni el del mes anterior o siguiente.
 *
 * DE QUIÉN ES LA FIRMA: el campo `firma` aprueba la FUENTE (usar el promedio mensual oficial del dólar observado del
 * SII), nunca un número: el valor y el mes los pone el SII (misma ley que `tablaUF.js`, owner 2026-09-23: «no quiero
 * mi firma sobre una cifra aproximada o derivada»). */

/** Grados de certeza de una fila (mismo vocabulario que `tablaUF.js`). Un «referencia» nunca se sirve como «oficial». */
export const GRADOS_DEL_TIPO_DE_CAMBIO = ["oficial", "referencia"];

/** Lo que cada fila declara de sí misma (una sola redacción, escrita aquí y no repetida a mano en cada fila). */
const MEDIDA = "promedio mensual del dólar observado (pesos por 1 US$), publicado por la fuente — no calculado por ADI";
const FIRMA = "jc (owner) aprobó el 2026-10-05 usar el promedio mensual oficial del dólar observado publicado por el SII " +
  "(bloque tamaño general, opción A); verificado contra sii.cl el 2026-10-05";

/** Los valores TAL CUAL los publica el SII: [período «aaaa-mm», CLP por 1 US$]. */
const VALORES_CLP_POR_USD = [
  ["2025-01", 1000.76],
  ["2025-02", 956.62],
  ["2025-03", 932.55],
  ["2025-04", 961.96],
  ["2025-05", 941.01],
  ["2025-06", 938.04],
  ["2025-07", 951.55],
  ["2025-08", 966.3],
  ["2025-09", 960.37],
  ["2025-10", 953.97],
  ["2025-11", 935.7],
  ["2025-12", 916.16],
  ["2026-01", 883.97],
  ["2026-02", 862.02],
  ["2026-03", 909.89],
  ["2026-04", 897.89],
  ["2026-05", 897.64],
  ["2026-06", 903.38],
  ["2026-07", 930.97],
  ["2026-08", 917.66],
  ["2026-09", 947.27],
];

/** fila(moneda, periodo, valor) → la fila completa, con TODOS sus campos de procedencia (nunca un campo heredado). */
function fila(moneda, periodo, valor) {
  const anio = periodo.slice(0, 4);
  return Object.freeze({
    moneda,
    periodo,                         // el mes del promedio, «aaaa-mm»
    valor,                           // CLP por 1 US$, sin redondear ni recalcular
    unidad: `${moneda} por 1 USD`,
    medida: MEDIDA,
    fuente: "Servicio de Impuestos Internos de Chile (SII) — Dólar Observado, promedio mensual, " +
      `https://www.sii.cl/valores_y_fechas/dolar/dolar${anio}.htm`,
    fecha: periodo,                  // el mes que la fuente publica para este promedio
    verificado: "2026-10-05",        // el día en que se contrastó contra la fuente
    vigencia: `mes ${periodo} solamente. Esta fila NO se extiende a otros meses ni se usa para interpolar: un período ` +
      "sin su propia fila no tiene tipo de cambio aplicable (ver `tipoCambioDelPeriodo`)",
    firma: FIRMA,                    // ⚠️ aprueba la FUENTE, no el número
    grado: "oficial",
  });
}

/* ── LA TABLA ─────────────────────────────────────────────────────────────────────────────────────────────── */
export const TABLA_TIPO_CAMBIO = Object.freeze(VALORES_CLP_POR_USD.map(([periodo, valor]) => fila("CLP", periodo, valor)));


/** tipoCambioDelPeriodo(periodo, moneda) → { valor, fila } | null
 *  Búsqueda EXACTA, sin redondeo ni interpolación. `periodo` en formato «aaaa-mm» (se acepta «aaaa-mm-dd» y se
 *  recorta a los primeros 7 caracteres, el mismo criterio que `motorKpi.js:periodoActual`). Sin fila, `null`:
 *  nunca el mes vecino. La moneda USD no tiene tabla (factor 1: la resuelve quien convierte, no esta tabla). */
export function tipoCambioDelPeriodo(periodo, moneda = "CLP") {
  const p = typeof periodo === "string" ? periodo.slice(0, 7) : null;
  const m = typeof moneda === "string" ? moneda.toUpperCase() : null;
  if (!p || !/^\d{4}-\d{2}$/.test(p) || !m) return null;
  const f = TABLA_TIPO_CAMBIO.find((x) => x.moneda === m && x.periodo === p);
  return f ? { valor: f.valor, fila: f } : null;
}

/** monedasConTipoDeCambio() → las monedas que tienen al menos una fila (hoy, solo «CLP»). */
export function monedasConTipoDeCambio() {
  return [...new Set(TABLA_TIPO_CAMBIO.map((f) => f.moneda))];
}
