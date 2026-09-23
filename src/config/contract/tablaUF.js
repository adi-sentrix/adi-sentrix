/* === config/contract/tablaUF.js · LA UF POR PERÍODO · PIEZA DE DATOS, NUNCA UNA LLAMADA (owner 2026-09-23) ====
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
 * TAREA 1 del encargo «bandas de tamaño y siembra de la taxonomía» (`_ADI_PERFIL_VOCABULARIOS_PROPUESTA.md` §3).
 * Textual del owner: «la clasificación oficial está definida en UF, por lo que ADI debe usar la referencia
 * oficial correspondiente al período para mantenerla vigente, pero el usuario trabaja y ve pesos.»
 *
 * ⚠️ ESTO ES UNA TABLA ESCRITA Y FIRMADA. Consultar la UF en línea en tiempo de ejecución tendría dos defectos
 * que la propuesta señala explícitamente: (1) la misma pregunta daría bandas de tamaño distintas según el día
 * en que se hiciera —la banda dejaría de ser determinística—, y (2) sería una llamada de red en el corazón
 * determinístico de ADI, exactamente lo que CLAUDE.md §3 prohíbe sin autorización de gasto que la NOMBRE. Por
 * eso este módulo NO IMPORTA NADA de red, de `fetch`, de un gateway ni de un cliente HTTP — es una tabla de
 * datos pura, del mismo tipo que `ausencias.js` o la tabla de bandas de `bandaTamano.js`. El candado
 * `_uf_offline_gate` (ver `_entrega_gate.mjs`) verifica esto leyendo el TEXTO FUENTE del archivo: si algún día
 * alguien agrega un `import` de red acá, el candado se enciende.
 *
 * CÓMO SE LEE ESTA TABLA: una fila por (moneda, período — "aaaa-mm", el mismo grano que ya usa el resto del
 * producto para el período declarado — ver `motorKpi.js:periodoActual`). SOLO la UF de Chile tiene tabla hoy:
 * es la única moneda para la que la clasificación de tamaño está definida (la propuesta, §3: «la clasificación
 * es chilena»). Agregar una fila de un período nuevo es cosa de minutos, y CADA fila lleva su propia procedencia
 * — no hay un valor "por defecto" que se herede solo.
 *
 * SIN INTERPOLACIÓN NI ESTIMACIÓN. Si el período declarado no tiene una fila exacta en esta tabla, `ufDelPeriodo`
 * devuelve `null` — nunca redondea al mes más cercano ni reutiliza el valor de otro período. Eso es lo que
 * mantiene la banda auditable: cada banda que ADI entregó se puede rastrear a una fila firmada, nunca a una
 * conjetura.
 *
 * ── CORRECCIÓN DEL OWNER (2026-09-23): «no quiero mi firma sobre una UF aproximada o derivada» ──────────────
 * La fila original de esta tabla (período 2026-09) sembraba un valor DERIVADO — el cociente de los tres pares
 * pesos/UF que el owner ya había aprobado para los umbrales ($98MM/2.400 UF, etc., ≈ $41.000). Esa fila nunca
 * fue una lectura de la serie oficial, y el propio comentario que la sembró lo decía así: «no es una lectura de
 * la serie oficial del Banco Central de Chile». El owner la corrigió, textual: «Sustituye los $41.000 por el
 * valor oficial de UF correspondiente al período que usemos, con fuente SII/Banco Central... La UF oficial debe
 * quedar respaldada por su fuente y fecha; no como una cifra estimada a mi nombre.»
 *
 * QUÉ CAMBIÓ: la fila de abajo (período 2025-12 — ver `data/tenants/demo.js`, tarea «el período real del demo»,
 * misma fecha) reemplaza esa fila derivada por una LECTURA DIRECTA de la serie oficial del SII, con su URL y su
 * fecha exacta. `grado` pasa de "referencia" a "oficial": ya no es una cifra que alguien tuvo que aprobar, es un
 * valor publicado que cualquiera puede volver a consultar en la misma fuente.
 *
 * DE QUIÉN ES LA FIRMA AHORA (ver `adi-referencia-de-quien` / la corrección textual de arriba): el campo `firma`
 * de la fila NUNCA vuelve a decir que el owner aprobó un NÚMERO. Dice que el owner aprobó USAR esta FUENTE — el
 * número y la fecha los pone el SII, no jc. Si mañana alguien necesita otro período, el candado `_uf_firma_gate`
 * (`_entrega_gate.mjs` §17) se enciende si una fila nueva vuelve a redactar la firma como si el owner hubiera
 * calculado o propuesto la cifra: la firma solo puede aprobar la FUENTE.
 */

/** El vocabulario de procedencia de una pieza de conocimiento — el mismo patrón que ya usan `ausencias.js` y
 *  la tabla de bandas: fuente, fecha en que se firmó, vigencia declarada, quién firma y el grado de certeza. Un
 *  valor "referencia" NUNCA se sirve como si fuera "oficial" sin que el motivo lo diga con todas las letras. */
export const GRADOS_DE_LA_UF = ["oficial", "referencia"];

/* ── LA TABLA ─────────────────────────────────────────────────────────────────────────────────────────────
 * Una sola fila hoy: el período que resultó ser el período real del archivo de demostración («2025-12» — ver
 * `data/tenants/demo.js:TENANT_DEMO.hechos.parametros.periodo_actual` y su comentario, con la evidencia del
 * propio archivo). El valor es una LECTURA DIRECTA de la serie oficial del Servicio de Impuestos Internos, no
 * un cálculo ni una interpolación: UF al 31 de diciembre de 2025 = $39.727,96.
 *
 * EQUIVALENTES EN PESOS DE LOS UMBRALES CON ESTA UF — PRESENTACIÓN, NUNCA EL UMBRAL. El umbral vivo y sellado
 * está en UF (`bandaTamano.js:UMBRALES_UF` — 2.400 · 25.000 · 100.000 UF, sin tocar). Estos pesos son lo que esos
 * mismos umbrales VALEN hoy, con ESTA fila de UF, solo para que quien lea el archivo no tenga que hacer la
 * cuenta — si mañana cambia la fila de UF, estos pesos cambian con ella, el umbral en UF no:
 *   · Micro   hasta 2.400 UF   ≈ 2.400   × 39.727,96 = $95.347.104
 *   · Pequeña hasta 25.000 UF  ≈ 25.000  × 39.727,96 = $993.199.000
 *   · Mediana hasta 100.000 UF ≈ 100.000 × 39.727,96 = $3.972.796.000
 *   (el archivo de demostración vende ≈$100.000.000/año ≈ 2.517,1 UF — un 4,9% sobre el corte de Micro, cae en
 *   Pequeña; ver la sonda de `_entrega_gate.mjs` §17c y el informe de esta tarea). */
export const TABLA_UF = [
  {
    moneda: "CLP",
    periodo: "2025-12",              // "aaaa-mm", el mismo grano que `motorKpi.js` usa para el período declarado
    valor: 39727.96,                 // CLP por 1 UF — SII, valor oficial al 31-dic-2025, sin redondear
    fuente: "Servicio de Impuestos Internos de Chile (SII) — serie oficial de la UF, " +
      "https://www.sii.cl/valores_y_fechas/uf/uf2025.htm",
    fecha: "2025-12-31",             // la fecha que el SII publica para este valor — no la fecha en que se copió acá
    vigencia: "período 2025-12 solamente. La UF real cambia cada día del mes; esta fila NO se extiende a otros " +
      "períodos ni se usa para interpolar — un período sin su propia fila no tiene UF aplicable (ver `ufDelPeriodo`)",
    // ⚠️ LA FIRMA APRUEBA LA FUENTE, NO EL NÚMERO (owner 2026-09-23, textual arriba en la cabecera del archivo).
    firma: "jc (owner, jc.navsil@gmail.com) aprobó usar la fuente oficial (SII) para esta fila — el valor y la " +
      "fecha los publica el SII, no son una cifra propuesta ni calculada por el owner; verificado contra " +
      "sii.cl/valores_y_fechas/uf/uf2025.htm el 2026-09-23",
    grado: "oficial",
  },
];

/** ufDelPeriodo(periodo, moneda) → { valor, fila } | null
 *  Búsqueda EXACTA, sin redondeo ni interpolación. `periodo` en formato "aaaa-mm" (se acepta "aaaa-mm-dd" y se
 *  recorta a los primeros 7 caracteres, el mismo criterio que `motorKpi.js:periodoActual`). Sin match, `null` —
 *  la ausencia de fila ES la respuesta, nunca un valor aproximado. */
export function ufDelPeriodo(periodo, moneda = "CLP") {
  const p = typeof periodo === "string" ? periodo.slice(0, 7) : null;
  const m = typeof moneda === "string" ? moneda.toUpperCase() : null;
  if (!p || !/^\d{4}-\d{2}$/.test(p) || !m) return null;
  const fila = TABLA_UF.find((f) => f.moneda === m && f.periodo === p);
  return fila ? { valor: fila.valor, fila } : null;
}
