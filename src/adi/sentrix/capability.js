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

// ── TEMPORAL · la regla del evolutivo (honestidad aplicada al tiempo · owner 2026-06-30) ──
// Existe serie real para ese eje → muestra evolución; no hay serie real para ese cruce → bloquea honesto.
// Hoy: global ventas REAL (se muestra) · por entidad SINTÉTICO (se bloquea · se enciende solo con histórico real).
const _tipoES = { sku: "SKU", client: "cliente", bodega: "bodega", marca: "marca", brand: "marca" };
export function temporalCapability(opts = {}) {
  const { metric, entityType, entity } = opts;
  const cap = datasetCapability();
  const global = cap.history.global
    ? { status: "show", scope: "global", metric: "ventas", confidence: "high" }
    : { status: "blocked", reason: "no hay serie mensual global en el dato" };
  let perEntity = null;
  if (entityType && entity) {
    perEntity = cap.history.perEntity
      ? { status: "show", scope: "entity", confidence: "high" }
      : { status: "blocked", reason: `el histórico por ${_tipoES[entityType] || "entidad"} es sintético (${metric || "esa métrica"} no varía mes a mes) — no hay serie real para afirmar una evolución` };
  }
  return { global, perEntity };
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

// ── TRANSFERIR STOCK ENTRE BODEGAS · ¿el dato permite siquiera EVALUARLO? (owner 2026-08-09, decisión 13) ──────
// Mover stock de una bodega a otra sólo se puede evaluar si el MISMO SKU vive en más de una: sin eso no hay dos
// colocaciones que comparar, y "transferir" es una recomendación sin objeto — el usuario no puede ejecutarla ni
// nosotros comprobarla. Hoy ningún SKU está en dos bodegas, así que la recomendación se retira; pero se retira POR
// EL DATO, no a mano: esto CUENTA sobre las mismas filas que la cara está pintando (las del escenario activo), y el
// día que un SKU aparezca en dos bodegas `evaluable` se enciende solo y la recomendación vuelve sin tocar código.
//
// UNA SOLA CUENTA PARA TODAS LAS SUPERFICIES. La cara Capital (`mesaCapital.limitaciones`), el ring de bodega
// (`control.js`) y la lectura ejecutiva (`reading.js`) preguntan ACÁ. Tres implementaciones del mismo hecho es
// exactamente cómo se llega a que una superficie recomiende lo que la otra declara inevaluable.
//   rows = las filas de inventario YA transformadas por el escenario (`applyScenarioToSkuInventario`). El escenario
//   no reasigna bodegas, pero se recibe igual para que ninguna superficie cuente sobre un dato distinto del que
//   muestra. Sin `rows`, cae al inventario base del tenant.
export function transferenciaCapability(rows = null) {
  const inv = Array.isArray(rows) && rows.length ? rows : (skuInventario || []);
  const porSku = new Map();
  for (const x of inv) {
    if (!x || !x.sku || !x.bodega) continue;
    if (!porSku.has(x.sku)) porSku.set(x.sku, new Set());
    porSku.get(x.sku).add(x.bodega);
  }
  const multi = [...porSku.values()].filter((b) => b.size > 1).length;
  const bodegas = new Set(inv.map((x) => x && x.bodega).filter(Boolean));
  return {
    evaluable: multi > 0,
    skusMultiBodega: multi,
    skus: porSku.size,
    bodegas: bodegas.size,
    // LOS NOMBRES, no sólo la cuenta (owner 2026-08-09, decisión 13 · segunda mitad): quien tiene que impedir la
    // recomendación necesita saber ENTRE QUÉ ubicaciones se estaría proponiendo el movimiento, y ese catálogo tiene
    // que salir del dato —nunca de una lista escrita en el guard, que sería un nombre de tenant hardcodeado. Lo
    // consume `guardC` (chequeo 18) vía el `limite_transferencia` que declara `inventoryStatus`. Aditivo: `bodegas`
    // sigue siendo la cuenta que ya leen la cara Capital, el ring y la lectura ejecutiva.
    bodegasNombres: [...bodegas].sort(),
    // el texto que la vista muestra cuando declara el límite. Se conserva palabra por palabra el que la cara
    // Capital ya declaraba: es el que el owner selló y el que `_mesa_capital_gate` verifica.
    motivo: multi > 0
      ? `${multi} SKU están en más de una bodega: ahí sí se puede comparar su colocación.`
      : "Transferir entre bodegas no se puede evaluar: cada SKU aparece en una sola.",
    // QUÉ INFORMACIÓN FALTA (owner 2026-08-10, certificación live · defecto C1) — `motivo` dice que no se puede
    // evaluar; no decía QUÉ haría falta para poder. Declinar sin nombrar el faltante deja al que decide sin saber
    // si el límite es del dato o del producto, y es la mitad que el owner reclamó ("decirlo y explicar qué
    // información falta"). Sale de la MISMA cuenta, así que no puede desincronizarse: si mañana un SKU aparece en
    // dos bodegas, `evaluable` se enciende y este campo desaparece con él.
    faltante: multi > 0
      ? null
      : "el mismo SKU con existencias en la bodega de origen Y en la de destino: sin dos colocaciones del mismo producto no hay nada que comparar",
  };
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
