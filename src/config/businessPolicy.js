/* === config/businessPolicy.js · POLÍTICA DE NEGOCIO · UNA fuente de verdad ===
 * Hardening pre-lanzamiento (2026-07-02): los umbrales que ADI CITA al usuario (benchmark de margen, mejor práctica
 * y target de carga comercial) estaban re-declarados como literales en 8+ composers (crossDomain/thesis/mechanisms/
 * contribution/…). Eso era "dos verdades": si el owner movía un umbral, había que cazarlo en cada archivo y uno se
 * olvidaba → dos respuestas citando targets distintos. Ahora vive acá, UNA vez.
 *
 * REGLA DE PRECEDENCIA: el DATO manda. `benchmark` es el FALLBACK para cuando una fila del dataset no trae su propio
 * `benchmark` — siempre preferir `fila.benchmark ?? POLICY.benchmark`. Hoy todas las filas traen 30.1, así que el
 * resultado es byte-idéntico; el cambio protege el "ADI no inventa" contra el drift del día que una fila lleve otro.
 *
 * Es también el PRIMER LADRILLO de la capa de datos declarativa: el lugar donde mañana se declara la política sin
 * tocar el motor. */
export const POLICY = {
  benchmark: 30.1,          // margen benchmark de cartera (%) · FALLBACK · el dato lo trae por-fila
  bestPracticeCarga: 3.0,   // mejor práctica interna de carga comercial (%)
  targetCarga: 3.5,         // target operativo de carga comercial (%)
  rotacionMin: 2,           // diagnose · piso de rotación (x): por debajo, el stock se considera dormido (numérico · portable a ERP real)
  dohMax: 120,              // diagnose · techo de cobertura (días): por encima, el stock se considera dormido
};

// helper: el benchmark de una entidad, respetando el dato por-fila (el dato manda · POLICY es el piso).
export const benchmarkOf = (entity) => (entity && typeof entity.benchmark === "number" ? entity.benchmark : POLICY.benchmark);
