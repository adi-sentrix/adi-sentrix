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
  // ── diagnóstico de inventario (owner 2026-07-06 · umbrales configurables) · salud de las DOS puntas: sobra y falta ──
  quiebreRotMin: 6,         // riesgo de quiebre: rotación ALTA (≥) …
  quiebreDohMax: 20,        // … y cobertura BAJA (DOH ≤ días) → se va a quedar sin stock
  sobrestockDohMin: 60,     // sobrestock: DOH entre esto y dohMax (vende, pero cobertura excesiva)
  quiebreMaterialUsd: 20000,// materialidad de la alerta de quiebre: $ mínimo para no secuestrar la respuesta con ruido
  quiebreMaterialPct: 5,    // … o % del capital del foco
};

// ── CRITERIO DEL OWNER (C.2 · 2026-07-07) · "mi piso de margen es 28%, no el estándar" ──────────────────────────────
// El usuario puede fijar SU vara ("recordá que mi margen mínimo es 28%") → override del benchmark en el PUNTO ÚNICO:
// pisa tanto el fallback de POLICY como el benchmark embebido por-fila (las filas del demo traen 30.1 — sin esto, mutar
// POLICY no alcanzaría). null = sin criterio → precedencia original intacta (byte-exacto · los gates corren en default).
let _benchmarkOverride = null;
export const setBenchmarkOverride = (v) => { _benchmarkOverride = (typeof v === "number" && isFinite(v)) ? v : null; };
export const getBenchmarkOverride = () => _benchmarkOverride;

// helper: el benchmark de una entidad — el CRITERIO del usuario manda; si no hay, el dato por-fila; si no, POLICY.
export const benchmarkOf = (entity) => (_benchmarkOverride != null ? _benchmarkOverride : (entity && typeof entity.benchmark === "number" ? entity.benchmark : POLICY.benchmark));
