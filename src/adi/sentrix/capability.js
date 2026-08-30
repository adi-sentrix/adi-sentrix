/* === adi/sentrix/capability.js · Etapa 5 · Sentrix S1 · capa de disponibilidad DATA-DRIVEN ===
 * Lee el dataset y declara qué SOSTIENE — nunca asume, detecta. Es la columna vertebral future-proof:
 * con el demo data hoy, con el Excel del cliente mañana (esquema parcial). El motor de Sentrix renderiza
 * SOLO lo que esto declara presente; lo que no, lo bloquea honesto (la regla madre, en la capa visual).
 *
 * Disciplina: el demo data se trata como "el primer dataset subido". Si esto lo lee bien, lee igual un
 * Excel a medio llenar — la magia del onboarding sale gratis de acá, no es un parche al final. */
import { ventasMensuales } from "../../data/baseKpis.js";
import { historialMargen, clientesMargen, clientesVentas, marcasMargen, sfamiliasMargen, skuInventario } from "../../data/demoData.js";
import { skusMargen } from "../../data/skusMargen.js";

// ¿la serie mensual de una entidad tiene variación REAL (no sintética/plana)? ≥2 valores distintos = real.
function _hasRealMonthlyVariation(series, field) {
  if (!Array.isArray(series) || series.length < 2) return false;
  const vals = series.map(p => p && p[field]).filter(v => v != null).map(Number);
  return new Set(vals).size > 1;
}

/* ── LA SERIE QUE SALE DEL ARCHIVO DEL CLIENTE (owner 2026-08-30) ──────────────────────────────────────────────
 * Segundo camino para encender la película por entidad, y NO relaja el primero: lo endurece.
 *
 * EL PRIMERO (arriba) pregunta si el margen varía mes a mes, y es la forma de cazar un histórico modelado: el del
 * dataset de fábrica es plano en 22% los doce meses, así que se bloquea — y se sigue bloqueando, tal cual pidió el
 * owner («si no reconcilia con la cifra oficial, ADI hace bien en no usarlo. No bajamos esa guardia»).
 *
 * ⚠️ PERO «¿VARÍA EL MARGEN?» ES UN PROXY, Y SOBRE DATO REAL SE ROMPE POR LOS DOS LADOS. Medido con el pack de la
 * plantilla: una sola cuenta «variaba», de 26.3% a 26.2% — un decimal de redondeo — y eso bastaba para encender la
 * película de TODO el dataset. Al revés también: un negocio que vende siempre lo mismo con el mismo margen tiene
 * una serie perfectamente real que el proxy declararía sintética.
 *
 * LO QUE SE EXIGE EN CAMBIO, que es lo que el owner pidió textual («solo si esa serie viene de dato real
 * reconciliado»), y son dos hechos verificables, no un indicio:
 *   1 · cada punto declara EL PERÍODO del que se sumó — un histórico modelado no lo trae porque no lo tiene;
 *   2 · el punto del período informado CIERRA EXACTO con la cifra oficial de esa entidad, la que el resto del
 *       producto muestra. Es la prueba que el histórico de fábrica no pasa: sus doce meses suman $18.8M contra
 *       una venta oficial de $19.4M.
 * Sin las dos, no se enciende. */
export const esSerieDelArchivo = (serie) =>
  Array.isArray(serie) && serie.length > 0 &&
  serie.every((p) => p && typeof p.periodo === "string" && /^\d{4}-\d{2}$/.test(p.periodo));

/** ¿Este dataset trae series salidas del archivo del cliente? Distingue el pack de una planilla del histórico
 *  modelado del dataset de fábrica, y es lo que permite que un «no tengo esa entidad» sea un no y no un sí ajeno. */
const _hayAlgunaSerieDelArchivo = () =>
  Object.values(historialMargen || {}).some((s) => esSerieDelArchivo(s));

/** La venta oficial de cada entidad en el período informado — la MISMA que muestran la Mesa y el cuadro.
 *  Cuenta → `clientesVentas.actual` (decisión D8 del owner). Marca, familia y SKU → la venta de su tabla. */
function _ventaOficialPorEntidad() {
  const m = new Map();
  for (const c of clientesVentas || []) m.set(c.nombre, c.actual);
  for (const t of [marcasMargen, sfamiliasMargen, skusMargen]) for (const x of t || []) m.set(x.nombre, x.venta);
  return m;
}

/** ¿La serie de ESTA entidad es dato real reconciliado? Devuelve el veredicto y el porqué, para que quien
 *  declina pueda decirlo con nombre en vez de un «no tengo esa serie» a secas. */
export function serieRealDe(nombre) {
  const serie = historialMargen && historialMargen[nombre];
  if (!Array.isArray(serie) || !serie.length) return { real: false, motivo: "sin-serie", n: 0 };
  if (!esSerieDelArchivo(serie)) return { real: false, motivo: "sin-periodo", n: serie.length };
  const oficial = _ventaOficialPorEntidad().get(nombre);
  if (typeof oficial !== "number") return { real: false, motivo: "sin-cifra-oficial", n: serie.length };
  if (!serie.some((p) => p.venta === oficial)) return { real: false, motivo: "no-reconcilia", n: serie.length };
  return { real: true, motivo: null, n: serie.length, periodos: serie.map((p) => p.periodo) };
}

// Declara qué ejes/cruces sostiene el dato CARGADO. Honesto por construcción: detecta, no promete.
export function datasetCapability() {
  // histórico GLOBAL real: ventas 12 meses + año anterior (baseKpis) → sí.
  const globalMonthly = Array.isArray(ventasMensuales) && ventasMensuales.length >= 12;

  // histórico POR ENTIDAD real: hoy historialMargen es SINTÉTICO (margen plano, ventas lerp) → debe dar false.
  //   Cuando el cliente suba un Excel con histórico real (margen que varía mes a mes) → dará true SOLO,
  //   sin tocar código: la película por entidad se enciende sola. Ese es el punto.
  //   Con la ingesta de planilla eso ya pasa: la serie sale de las filas del archivo y se enciende por el segundo
  //   camino (`serieRealDe`), que exige período declarado + cierre exacto con la cifra oficial — nunca por un
  //   decimal de diferencia entre dos meses.
  let perEntityMonthly = false;
  try {
    const nombres = Object.keys(historialMargen || {});
    perEntityMonthly = nombres.some((n) => {
      const s = historialMargen[n];
      // una película necesita al menos dos meses; un solo punto es una cifra, no una evolución
      if (esSerieDelArchivo(s)) return s.length >= 2 && serieRealDe(n).real;
      return _hasRealMonthlyVariation(s, "margen");
    });
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
    /* ⚠️ SE MIDE LA ENTIDAD QUE SE PREGUNTÓ, no el dataset entero. Con el histórico modelado daba igual —todas
     * las entidades estaban en la misma situación—, pero con dato real del cliente no: una cuenta puede tener sus
     * meses cargados y la de al lado haber vendido sólo en un período anterior. Declarar «se puede» porque OTRA
     * entidad tiene serie es prometer sobre el vecino. El motivo también sale por entidad, para que quien declina
     * pueda decir cuál es el límite en vez de un «no tengo esa serie» a secas. */
    const propia = serieRealDe(entity);
    if (propia.real && propia.n >= 2) perEntity = { status: "show", scope: "entity", confidence: "high", origen: "archivo" };
    else if (propia.real) perEntity = { status: "blocked", reason: `de ${entity} hay un solo período cargado: una cifra, no una evolución` };
    else if (propia.motivo === "no-reconcilia") perEntity = { status: "blocked", reason: `la serie mensual de ${entity} no cierra con su venta del período: son dos cifras del mismo negocio y no se sirve ninguna` };
    /* ⚠️ EN UN DATASET DEL ARCHIVO, «no tengo la serie de esta entidad» es un NO, no un «sí» prestado del vecino.
     * Sin esta rama, preguntar por una cuenta que este negocio no tiene devolvía `show` —porque OTRAS entidades
     * del pack sí tienen serie— y ADI habría prometido una película que no existe. */
    else if (propia.motivo === "sin-serie" && _hayAlgunaSerieDelArchivo()) perEntity = { status: "blocked", reason: `no hay serie mensual de ${entity} en el dato de esta empresa` };
    else perEntity = cap.history.perEntity
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
