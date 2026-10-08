/* === config/contract/assumptionRegistry.js · CONTRATO DE DATOS · Paso 4 (seam del spec) ===
 * EL VOCABULARIO DE `spec.assumption`. Cuando el spec es scenario:"simulation", trae un supuesto {type, value, unit}.
 * Este registro DECLARA qué supuestos existen, qué unidad es válida por tipo, y qué MÉTRICA perturba cada uno — para que
 * el LLM no invente tipos de supuesto y ADI los valide con la misma maquinaria que valida métricas/ejes.
 *
 * ESTADO HOY (honesto): la simulación PARAMÉTRICA (recomputar la superficie con una métrica perturbada) todavía NO tiene
 * productor en el motor. Este registro valida la FORMA del supuesto; la EJECUCIÓN de scenario:"simulation" degrada honesto
 * en el seam hasta que exista el productor de simulación. Aditivo: no toca el motor sellado.
 *
 * EXTENSIBILIDAD: un supuesto nuevo (ej. "fx" para tipo de cambio) entra como una entrada más acá → el LLM lo puede
 * emitir y ADI validarlo, sin tocar el motor.
 *
 * `perturbs`: la clave de metricRegistry que el supuesto mueve (documenta el modelo mental · null = libre/custom).
 * `units`: unidades válidas para ese tipo. `sign`: "pos" | "neg" | "any" (hoy todos "any" · value negativo = caída). */
export const ASSUMPTIONS = {
  growth:    { label: "Crecimiento de ventas", perturbs: "ventas", units: ["pct", "money"], sign: "any" },
  price:     { label: "Cambio de precio",      perturbs: "ventas", units: ["pct"],          sign: "any" },  // el precio fluye a ventas vía precioLista
  margin:    { label: "Cambio de margen",      perturbs: "margen", units: ["pct"],          sign: "any" },  // puntos porcentuales
  inventory: { label: "Cambio de inventario",  perturbs: "doh",    units: ["days", "pct"],  sign: "any" },
  custom:    { label: "Supuesto libre",        perturbs: null,     units: ["pct", "money", "days"], sign: "any" },
  /* ── ADITIVO (owner 2026-09-25, `_ADI_CONTRATO_ENCARGO_V1.md` §3.5 y §7.1 — «el productor sale del tipo, nunca
   * de la cita»): antes, «bajar la carga 1 pp» o «cambiar el costo» solo cabían como `custom` (perturbs null),
   * así que el Encargo no podía tipar el supuesto y el validador dependía de LEER `Supuesto.cita` — justo lo que
   * la ley `adi-no-desviarse-deterministico` prohíbe. Ninguno de los cinco tipos existentes cambia: es una entrada
   * más por tipo, igual que el resto de este registro. */
  carga:     { label: "Cambio de carga comercial", perturbs: "carga", units: ["pp"],  sign: "any" },   // puntos porcentuales · productor: simularSupuestos (comercial · negocio y cada eje)
  costo:     { label: "Cambio de costo",           perturbs: "costo", units: ["pct"], sign: "any" },   // % sobre el costo de los productos (sin acciones comerciales) · productor: simularSupuestos (comercial · negocio y cada eje)
};

// helper: ¿es válida la FORMA del supuesto? → {ok} o {ok:false, reason, offer}. null = sin supuesto (scenario "actual").
export function assumptionValid(a) {
  if (a == null) return { ok: true };
  const def = ASSUMPTIONS[a.type];
  if (!def) return { ok: false, reason: `tipo de supuesto desconocido: "${a.type}"`, offer: Object.keys(ASSUMPTIONS) };
  if (typeof a.value !== "number" || !Number.isFinite(a.value)) return { ok: false, reason: "el supuesto necesita un `value` numérico", offer: [] };
  if (!def.units.includes(a.unit)) return { ok: false, reason: `unidad inválida para "${a.type}": "${a.unit}"`, offer: def.units };
  return { ok: true };
}
