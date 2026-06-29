/* === adi/sentrix/capability.js · Etapa 5 · Sentrix S1 · capa de disponibilidad DATA-DRIVEN ===
 * Lee el dataset y declara qué SOSTIENE — nunca asume, detecta. Es la columna vertebral future-proof:
 * con el demo data hoy, con el Excel del cliente mañana (esquema parcial). El motor de Sentrix renderiza
 * SOLO lo que esto declara presente; lo que no, lo bloquea honesto (la regla madre, en la capa visual).
 *
 * Disciplina: el demo data se trata como "el primer dataset subido". Si esto lo lee bien, lee igual un
 * Excel a medio llenar — la magia del onboarding sale gratis de acá, no es un parche al final. */
import { ventasMensuales } from "../../data/baseKpis.js";
import { historialMargen } from "../../data/demoData.js";

// ¿la serie mensual de una entidad tiene variación REAL (no sintética/plana)? ≥2 valores distintos = real.
function _hasRealMonthlyVariation(series, field) {
  if (!Array.isArray(series) || series.length < 2) return false;
  const vals = series.map(p => p && p[field]).filter(v => v != null).map(Number);
  return new Set(vals).size > 1;
}

// Declara qué ejes/cruces sostiene el dato CARGADO. Honesto por construcción: detecta, no promete.
export function datasetCapability() {
  // histórico GLOBAL real: ventas 12 meses + año anterior (baseKpis) → sí.
  const globalMonthly = Array.isArray(ventasMensuales) && ventasMensuales.length >= 12;

  // histórico POR ENTIDAD real: hoy historialMargen es SINTÉTICO (margen plano, ventas lerp) → debe dar false.
  //   Cuando el cliente suba un Excel con histórico real (margen que varía mes a mes) → dará true SOLO,
  //   sin tocar código: la película por entidad se enciende sola. Ese es el punto.
  let perEntityMonthly = false;
  try {
    const series = Object.values(historialMargen || {});
    perEntityMonthly = series.some(s => _hasRealMonthlyVariation(s, "margen"));
  } catch { perEntityMonthly = false; }

  return {
    history: { global: globalMonthly, perEntity: perEntityMonthly, scenario: true },
    // cruces atómicos (cliente×sku×marca×fecha): hoy el dato está pre-agregado → false (Ejemplo 5 · Situación B).
    //   futuro: el Excel del cliente con hoja de transacciones → true → cruces pasan a Situación A (buildable).
    crosses: { atomic: false },
  };
}
