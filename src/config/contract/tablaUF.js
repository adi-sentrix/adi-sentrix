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
 * conjetura. */

/** El vocabulario de procedencia de una pieza de conocimiento — el mismo patrón que ya usan `ausencias.js` y
 *  la tabla de bandas: fuente, fecha en que se firmó, vigencia declarada, quién firma y el grado de certeza. Un
 *  valor "referencia" NUNCA se sirve como si fuera "oficial" sin que el motivo lo diga con todas las letras. */
export const GRADOS_DE_LA_UF = ["oficial", "referencia"];

/* ── LA TABLA ─────────────────────────────────────────────────────────────────────────────────────────────
 * Una sola fila hoy: el período de esta tarea (2026-09), sembrado con el equivalente que se desprende de las
 * cifras que el owner ya aprobó para los umbrales en pesos (`_ADI_PERFIL_VOCABULARIOS_PROPUESTA.md` §3, tabla
 * del owner 2026-09-23: «$98 MM ≈ 2.400 UF · $1.025 MM ≈ 25.000 UF · $4.100 MM ≈ 100.000 UF»). Los tres cocientes
 * dan ~$41.000 — el mismo número que el owner escribió textual: «UF ≈ $41.000 al 2026-09-23».
 *
 * ⚠️ ES UN VALOR DE REFERENCIA, NO EL VALOR OFICIAL DIARIO DE LA UF (`grado: "referencia"`). El valor oficial de
 * la UF lo publica el Banco Central de Chile y cambia cada día del mes (indexado a la inflación del mes
 * anterior). Antes de un piloto con datos reales, esta fila tiene que reemplazarse — o acompañarse — con la
 * serie oficial correspondiente a cada período que un cliente declare. Mientras tanto, un período sin fila acá
 * simplemente no tiene banda (falla cerrado, ver `bandaTamano.js`): no hay número inventado que lo disimule. */
export const TABLA_UF = [
  {
    moneda: "CLP",
    periodo: "2026-09",              // "aaaa-mm", el mismo grano que `motorKpi.js` usa para el período declarado
    valor: 41000,                    // CLP por 1 UF
    fuente: "cifra de referencia derivada de los umbrales en pesos que el owner aprobó junto con los umbrales en UF " +
      "el 2026-09-23 ($98MM/2.400 UF · $1.025MM/25.000 UF · $4.100MM/100.000 UF) — no es una lectura de la serie " +
      "oficial del Banco Central de Chile",
    fecha: "2026-09-23",             // cuándo se firmó esta fila
    vigencia: "período 2026-09 solamente. La UF real cambia cada día del mes; esta fila NO se extiende a otros " +
      "períodos ni se usa para interpolar — un período sin su propia fila no tiene UF aplicable (ver `ufDelPeriodo`)",
    firma: "jc (owner, jc.navsil@gmail.com) — valor de referencia para destrabar esta tarea, no el valor oficial",
    grado: "referencia",
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
