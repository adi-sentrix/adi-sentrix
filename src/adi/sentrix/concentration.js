/* === adi/sentrix/concentration.js · Etapa 5 · Sentrix · el PARETO (concentración 80/20) ===
 * El principio de concentración: pocos elementos explican la mayor parte del resultado. DATA-DRIVEN (owner):
 * muestra el % REAL del dato (62 / 73 / 81 / 90 — el que sea), NUNCA fuerza 80. El 80% es la línea de referencia
 * clásica; el "bloque" son los primeros elementos hasta cruzarla. Honesto sin bloqueos: son sumas acumuladas de
 * dato real punto-en-tiempo (no depende de histórico). Scenario-aware (lección GAP 2): cliente/marca/familia se
 * ajustan por escenario; SKU usa base (no hay ajustador · skusMargen no es scenario-adjusted). Puro · client-side. */
import { applyScenarioToClientesVentas, applyScenarioToMarcasVentas, applyScenarioToSfamiliasVentas, applyScenarioToSkuInventario, applyScenarioToClientesMargen, applyScenarioToMarcasMargen, applyScenarioToSfamiliasMargen } from "../../engine/scenarios.js";
import { skusMargen } from "../../data/skusMargen.js";

export const CONCENTRATION_DIMS = [
  { key: "cliente", label: "Cliente", plural: "clientes" },
  { key: "marca",   label: "Marca",   plural: "marcas"   },
  { key: "familia", label: "Familia", plural: "familias" },
  { key: "sku",     label: "SKU",     plural: "SKUs"     },
];

// dims del Pareto de INVENTARIO (capital inmovilizado) — el dato (skuInventario) tiene sku/bodega/marca/sfamilia.
export const INV_DIMS = [
  { key: "sku",     label: "SKU",     plural: "SKUs"     },
  { key: "bodega",  label: "Bodega",  plural: "bodegas"  },
  { key: "marca",   label: "Marca",   plural: "marcas"   },
  { key: "familia", label: "Familia", plural: "familias" },
];

// inmovilizado = stock que no rota (alerta ≠ ok o rotación < 2) · def canónica (= la de la tira de datos)
const _inmovilizado = (x) => (x.alerta && x.alerta !== "ok") || x.rotacion < 2;

function _rows(dimension, scenario) {
  const s = scenario || ESCENARIO_INICIAL;
  if (dimension === "cliente") return applyScenarioToClientesVentas(s).map((x) => ({ name: x.nombre, value: Number(x.actual) || 0 }));
  if (dimension === "marca")   return applyScenarioToMarcasVentas(s).map((x) => ({ name: x.nombre, value: Number(x.actual) || 0 }));
  if (dimension === "familia") return applyScenarioToSfamiliasVentas(s).map((x) => ({ name: x.nombre, value: Number(x.actual) || 0 }));
  if (dimension === "sku")     return skusMargen.map((x) => ({ name: x.nombre, value: Number(x.venta) || 0 }));   // base · sin ajustador de escenario
  return [];
}

// CONTRIBUCIÓN por dimensión (owner 2026-07-10 · el Pareto de la Mesa con filtro ventas/contribución): la
// contribución ALMACENADA de cada tabla — el mismo valor que muestra el cuadro (reflejo de la tabla, una verdad).
import { clientesMargen, marcasMargen, sfamiliasMargen } from "../../data/demoData.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // colapso del eje: la base real se declara UNA vez
function _contribRows(dimension, scenario) {
  // cliente: scenario-aware (owner 2026-07-29, D8) — clientesMargen.contribucion ahora se re-deriva de la venta
  // OFICIAL (applyScenarioToClientesMargen) para cerrar con lo que el Cuadro (mismo dato) ya muestra; el import
  // crudo quedaría desincronizado del resto de la Mesa apenas hay un escenario activo.
  if (dimension === "cliente") return applyScenarioToClientesMargen(scenario || ESCENARIO_INICIAL).map((x) => ({ name: x.nombre, value: Number(x.contribucion) || 0 }));
  // MARCA y FAMILIA leen el AJUSTADOR, no el literal (owner 2026-08-10 · misma corrección que cuadro.js `_marcas`).
  // El eje cliente ya era scenario-aware y estos dos no, así que el MISMO gráfico, con el MISMO chip de escenario y
  // ante la MISMA pregunta («¿qué explican el 80% de tu contribución?»), sumaba $14.9M por cliente y $25.6M por
  // marca en crisis — 1,71x. Las funciones ya existen en el motor y las consume la Ficha: acá se dejan de ignorar.
  if (dimension === "marca")   return applyScenarioToMarcasMargen(scenario || ESCENARIO_INICIAL).map((x) => ({ name: x.nombre, value: Number(x.contribucion) || 0 }));
  if (dimension === "familia") return applyScenarioToSfamiliasMargen(scenario || ESCENARIO_INICIAL).map((x) => ({ name: x.nombre, value: Number(x.contribucion) || 0 }));
  if (dimension === "sku")     return skusMargen.map((x) => ({ name: x.nombre, value: Number(x.contribucion) || 0 }));
  return [];
}

// Filas del Pareto de INVENTARIO: capital inmovilizado ($ atrapado) agregado por dimensión. Scenario-aware
// (applyScenarioToSkuInventario mueve estado/alerta → más inmovilizado en tensión/crisis). Data-driven: la
// dimensión es un campo del propio dato (sku/bodega/marca/sfamilia), no se hardcodea.
function _invRows(dimension, scenario) {
  const inv = (applyScenarioToSkuInventario(scenario || ESCENARIO_INICIAL) || []).filter(_inmovilizado);
  const keyOf = dimension === "bodega" ? (x) => x.bodega
    : dimension === "marca"   ? (x) => x.marca
    : dimension === "familia" ? (x) => x.sfamilia
    : (x) => x.sku;   // default SKU
  const agg = {};
  inv.forEach((x) => { const k = keyOf(x) || "—"; agg[k] = (agg[k] || 0) + (Number(x.stockUSD) || 0); });
  return Object.entries(agg).map(([name, value]) => ({ name, value }));
}

// Concentración de una dimensión. metric "ventas" (comercial · default) o "inmovilizado" (inventario). Devuelve
// barras (desc) + acumulado + el bloque que llega al 80%. El MOTOR elige metric/dims según el foco (ver surface.js).
export function buildConcentration(dimension = "cliente", scenario = ESCENARIO_INICIAL, metric = "ventas") {
  const raw = metric === "inmovilizado" ? _invRows(dimension, scenario) : metric === "contribucion" ? _contribRows(dimension, scenario) : _rows(dimension, scenario);
  const rows = raw.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  let cum = 0;
  const bars = rows.map((r) => {
    cum += r.value;
    return { name: r.name, value: r.value, pct: (r.value / total) * 100, cumPct: (cum / total) * 100 };
  });
  // bloque que EXPLICA el 80%: los primeros hasta cruzar 80% acumulado (al menos 1 · fallback honesto).
  let blockCount = bars.findIndex((b) => b.cumPct >= 80) + 1;
  if (blockCount <= 0) blockCount = bars.length;
  bars.forEach((b, i) => { b.inBlock = i < blockCount; });
  const blockPct = bars[blockCount - 1] ? Math.round(bars[blockCount - 1].cumPct) : 0;   // % REAL en el corte (data-driven)
  const dimList = metric === "inmovilizado" ? INV_DIMS : CONCENTRATION_DIMS;
  const meta = dimList.find((d) => d.key === dimension) || dimList[0];
  return { dimension, metric, label: meta.label, plural: meta.plural, scenario: scenario || ESCENARIO_INICIAL, bars, total, n: bars.length, blockCount, blockPct, limite: _limite(dimension, metric, scenario) };
}

/* ── EL LÍMITE QUE ESTE GRÁFICO NO PUEDE CERRAR, DECLARADO (owner 2026-08-10) ─────────────────────────────────
 * El "i" del Pareto afirmaba que cada composición «SUMA EXACTO la cifra del cuadro (una sola verdad)». En dos ejes
 * NO suma, y las dos veces por una razón del DATO, no por un error de cuenta. Declararlo es el trabajo; hacerlo
 * cerrar sería fabricar el número.
 *
 *  · EJE MARCA. Con un escenario activo, la venta por marca se RECONSTRUYE agregando clientes (es la misma función
 *    que usa el resto de la Mesa). Una marca sin ningún cliente en el dato no puede reconstruirse, así que
 *    desaparece del gráfico mientras el Cuadro la sigue mostrando con su venta base. Medido: falta una marca
 *    entera y el total difiere entre 4,8% y 5,9% según el escenario. NO se resuelve arrastrando la base al Pareto
 *    (rompería la reconciliación contra el eje cliente, que hoy cierra exacto) ni sacándola del Cuadro (borraría
 *    una marca real del universo): es una decisión de negocio del owner —si una marca sin cliente es parte del
 *    universo o no lo es, pero tiene que serlo en las dos superficies—. Hasta entonces, la pantalla lo dice.
 *  · EJE SKU. `skusMargen` está declarado SCENARIO-BLIND en el contrato (sourceManifest: scenarioLoad null): no
 *    existe transform que lo mueva. Así que este eje queda en su cifra base mientras cliente/marca/familia caen
 *    con el escenario — 23,3% de diferencia en crisis ante la misma pregunta. Inventarle un ajustador sería
 *    fabricar el dato; ADI ya declina el caso hermano (el ranking de margen por SKU fuera de bonanza).
 * Devuelve null cuando no hay límite que declarar: el caso feliz no arrastra texto. */
function _limite(dimension, metric, scenario) {
  const s = scenario || ESCENARIO_INICIAL;
  if (metric === "inmovilizado") return null;   // el inventario tiene su propio ajustador y sí se mueve entero
  if (dimension === "sku" && s !== "actual") {
    return { tipo: "escenario_no_aplica", entidadesFuera: [],
      texto: "El eje SKU muestra la cifra BASE: el dato de SKU no declara ajuste por escenario, así que no se mueve con el chip de arriba y su total no coincide con el de los otros ejes. No se le inventa un ajuste." };
  }
  if (dimension === "marca") {
    const conCliente = new Set(applyScenarioToMarcasVentas(s).map((x) => x.nombre));
    const fuera = marcasMargen.map((m) => m.nombre).filter((n) => !conCliente.has(n));
    if (fuera.length) {
      return { tipo: "poblacion_incompleta", entidadesFuera: fuera,
        texto: `${fuera.length === 1 ? "Una marca no aparece" : `${fuera.length} marcas no aparecen`} en este gráfico (${fuera.join(" · ")}): con un escenario activo la venta por marca se reconstruye desde los clientes, y ${fuera.length === 1 ? "esa marca no tiene ninguno" : "esas marcas no tienen ninguno"} en el dato. El Cuadro sí ${fuera.length === 1 ? "la muestra" : "las muestra"}, con su cifra base, así que los dos totales no coinciden.` };
    }
  }
  return null;
}
