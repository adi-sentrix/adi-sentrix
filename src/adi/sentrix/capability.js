/* === adi/sentrix/capability.js · Etapa 5 · Sentrix S1 · capa de disponibilidad DATA-DRIVEN ===
 * Lee el dataset y declara qué SOSTIENE — nunca asume, detecta. Es la columna vertebral future-proof:
 * con el demo data hoy, con el Excel del cliente mañana (esquema parcial). El motor de Sentrix renderiza
 * SOLO lo que esto declara presente; lo que no, lo bloquea honesto (la regla madre, en la capa visual).
 *
 * Disciplina: el demo data se trata como "el primer dataset subido". Si esto lo lee bien, lee igual un
 * Excel a medio llenar — la magia del onboarding sale gratis de acá, no es un parche al final. */
import { ventasMensuales } from "../../data/baseKpis.js";
import { historialMargen, clientesMargen, skuInventario } from "../../data/demoData.js";
import { skusMargen } from "../../data/skusMargen.js";

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

// ── peers comparables del MISMO tipo (del dataset cargado · reales) ──
function _peersFor(entityType, entidad) {
  let names = [];
  if (entityType === "sku") names = skusMargen.map((x) => x.nombre);
  else if (entityType === "client") names = clientesMargen.map((x) => x.nombre);
  else if (entityType === "bodega") names = [...new Set((skuInventario || []).map((x) => x.bodega))];
  return names.filter((n) => n && n !== entidad);
}

// métricas que ESTE tipo de entidad tiene en el dato (honesto · existen en el registro).
function _metricsFor(entityType) {
  if (entityType === "sku") return ["margen", "contribucion"];
  if (entityType === "client") return ["margen", "contribucion", "ventas", "carga"];
  if (entityType === "bodega") return ["capital", "rotacion", "doh"];
  return [];
}

// ── EXPLORABLE · §7 del doc · declara qué se puede explorar desde ESTA entidad, DATA-DRIVEN + HONESTO.
// Lo que el dato sostiene se ofrece; lo que necesita granularidad que no existe (cruce a entidad relacionada)
// se BLOQUEA con razón (regla madre · Ejemplo 5 Situación B). El motor de Sentrix (paso 3) lo consume; el LLM
// (v2) mapea voz → estas mismas operaciones. NO hardcodea pantallas por entidad: deriva del dataset.
export function entityExplorable(entityType, entidad) {
  const cap = datasetCapability();
  const blocked = [];
  if (!cap.crosses.atomic) {
    // el cruce a entidad relacionada (quién compra / qué le vendo) necesita transacciones atómicas.
    if (entityType === "sku") blocked.push({ view: "clientes que compran este SKU", reason: "no existe granularidad atómica SKU×cliente en los datos" });
    if (entityType === "client") blocked.push({ view: "productos que le vendo a este cliente", reason: "no existe granularidad atómica cliente×SKU en los datos" });
  }
  return {
    entityType: entityType || null,
    compare: _peersFor(entityType, entidad),    // comparar con un par del mismo tipo (real)
    metrics: _metricsFor(entityType),           // cambiar de métrica (lo que el tipo tiene en el dato)
    blocked,                                     // vistas bloqueadas honestas (con razón)
    historyPerEntity: cap.history.perEntity,     // ¿la película por entidad está disponible? (hoy false · sintético)
  };
}
