/* === src/adi/specRetrieval.js · ADI Core · Paso 5 · PRODUCTOR SPEC-DRIVEN (retrieval/ranking genérico) ===
 * Ejecuta métrica × dimensión × filtros desde el SPEC, sin sintetizar texto ni reusar el parser NL (los productores
 * text-based del motor siguen intactos para el camino determinístico). Es DATA-DRIVEN del CONTRATO: lee
 * METRICS[metric].sourceByAxis[dimension] {source, field, agg} → carga la fuente vía el sourceManifest (scenario-aware
 * si lo declara) → agrupa (eje group-by) o lista (por-fila) → agrega (sum/avg) → formatea. Sirve para INVENTARIO
 * (capital/rotación/DOH por bodega/sku) Y para AGREGADOS comerciales (rank margen/contribución/ventas por marca/familia).
 * SOLO importa el CONTRATO · NO toca el motor sellado. Combinación no declarada → null → el seam degrada honesto.
 */
import { METRICS } from "../config/contract/metricRegistry.js";
import { ENTITIES } from "../config/contract/entityRegistry.js";
import { SOURCES } from "../config/contract/sourceManifest.js";
import { guessDimension } from "./oracle/entityRecord.js";   // Etapa 1 (owner 2026-08-04): resuelve el EJE de un entityScope heredado (bodega/canal vs nombre/sku) — ver _scopeRows
import { POLICY, benchmarkOf } from "../config/businessPolicy.js";   // umbrales de política (UNA verdad) para el diagnose
import { fig } from "./boleta.js";   // BOLETA de cifras autorizadas (primera clase · emitida por el composer · la valida el guard)
import { diagnoseInventario, diagnoseClientes, diagnoseSkus, concentracion } from "./diagnosis/economicDiagnosis.js";   // motor: 4 puntas inventario + patrón económico cliente/SKU + concentración 80/20 · UNA verdad
import { clientesVentas as _cVentas, marcasVentas as _mVentas, sfamiliasVentas as _fVentas, historialMargen as _histM } from "../data/demoData.js";   // ventas con YoY+ppto (marca/familia NO están en el contrato → carga directa) + historial mensual (el año de cada cuenta)
import { buildCompareEvolution as _cmpEvolution } from "./sentrix/temporal.js";   // las dos curvas del año (tendencia × estacionalidad real) para el causal temporal del compare
import { detectVirtuousException } from "./proactive.js";   // gancho opcional del diagnóstico (fuera la muletilla · owner 2026-07-09)
import { deriveBusinessThesis } from "./composers/thesis.js";
import { skusMargen as _skusM } from "../data/skusMargen.js";   // SKU: venta+unidades (sin anterior/ppto)
import { ventasKPI as _vKPI } from "../data/baseKpis.js";       // totales de cartera BASE (100K vs 92.9K vs 97K) — sólo como red si deriveKpis no resuelve
// LAS MISMAS TRANSFORMACIONES QUE CONSUME SENTRIX (owner 2026-08-09, decisión 4) — no una segunda copia:
// `applyScenarioToMarcasVentas` es literalmente la que llama `sentrix/cuadro.js:_marcas`, y `deriveKpis` la que ya
// usa `composers/simulation.js`. clientesVentas/clientesMargen siguen entrando por el contrato (`_load`).
import { applyScenarioToMarcasVentas, applyScenarioToSfamiliasVentas } from "../engine/scenarios.js";
import { getVentasKPI } from "../engine/metrics.js";   // el MISMO total del escenario que lee la card de ventas de la Mesa (sentrix/mesa.js) — decisión owner 2026-07-15: card y ADI, una verdad
import { composicionCliente, composicionClientePorFamilia } from "../data/clienteSkuMatrix.js";   // matriz cliente×SKU (la MISMA que usa el Pareto de Sentrix — cierra exacto con el cuadro)
import { datasetCapability } from "./sentrix/capability.js";   // LA declaración canónica de qué cruces sostiene el dato cargado (crosses.atomic) — la misma que ya bloquea "productos que le vendo a este cliente" en entityExplorable
import { headlineTotal } from "./sentrix/headline.js";   // los TOTALES DE CABECERA (decisión 6): la MISMA fuente oficial que pinta la card, nunca la suma del ranking

// carga la fuente vía el CONTRATO: scenarioLoad (scenario-aware) si el manifest lo declara, si no el load base.
function _load(source, scenario) {
  const s = SOURCES[source];
  if (!s) return [];
  if (typeof s.scenarioLoad === "function") return s.scenarioLoad(scenario) || [];
  return (typeof s.load === "function" && s.load()) || [];
}
// carga la BASE REAL de una fuente (SIEMPRE .load() · el dato "actual" que ve el usuario · SIN motor de escenarios).
// Las simulaciones (supuestos) se aplican SOBRE esto; nunca se invoca scenarioLoad ni bonanza/tensión/crisis.
function _loadReal(source) {
  const s = SOURCES[source];
  return (s && typeof s.load === "function" && s.load()) || [];
}

const _money = (v) => {
  const a = Math.abs(v), s = v < 0 ? "-" : "";   // signo ANTES del $ ("-$6K", no "$-6K")
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`;
  return `${s}$${Math.round(a)}`;
};
// escala del contrato: money(K) = valor en MILES de $ → a dólares reales antes de formatear (money(raw) = $ crudo)
const _fmt = (v, unit, scale) => (unit === "money" ? _money(scale === "K" ? v * 1000 : v) : unit === "pct" ? `${v}%` : unit === "ratio" ? `${v.toFixed(1)}x` : unit === "days" ? `${Math.round(v)}d` : String(v));
// _rawC(v, unit, scale) → el `raw` de la boleta EN DÓLARES, la misma escala que ya muestra `_fmt` (owner 2026-08-09,
// decisión 1: la escala se declara, no se adivina). El resto del motor emite `raw: x * 1000` para los montos en
// miles; estos dos composers pasaban `x.value` CRUDO, así que la MISMA cifra viajaba como 4275 desde queryMetric y
// como 4275000 desde contributionRead. `_isCalc` (guardC) hace aritmética con esos `raw` para autorizar cálculos:
// con las dos escalas en el mismo pool, 4275 + 3839 = 8114 autorizaba «$8K» para una suma que vale $8.1M — un
// error de ×1000 cruzando el muro con las dos cifras de origen reales. Medido antes del arreglo y cerrado por
// `_verif_raw_falsa2`. Sólo toca `money`: el resto de las unidades no tiene escala que normalizar.
const _rawC = (v, unit, scale) => (unit === "money" && scale === "K" ? v * 1000 : v);

/* ── LA CIFRA DE CABECERA · la MISMA que muestra la card, no la suma del ranking ─────────────────────────────
 * (owner 2026-08-09, decisión 6 · hallazgo E)
 * `_figHeadline(metrica, eje, escenario)` → la fig del total oficial, o null si ese corte no tiene cabecera
 * declarada. Toda la verdad numérica vive en `sentrix/headline.js` (que es el builder de la pantalla); acá sólo se
 * formatea y se declara. Tres cosas importan y por eso están explícitas:
 *   · `mandatory: false` — autoriza la cifra sin obligar al narrador a decirla. La misma convención con la que
 *     `contributionRead` ya emite "Contribución total", que es el único total que el oráculo tenía bien.
 *   · el `raw` viene en dólares desde `headline.js` (la escala del universo ya aplicada), igual que `_rawC`.
 *   · `universo`, `periodo`, `entidad`, `fuente` y `formula` viajan DECLARADOS: una cifra sin dueño ni marco es
 *     justo lo que la decisión 1 prohíbe, y un total del negocio es la cifra más fácil de citar sin sujeto.
 * Un ranking ACOTADO (filtros, entityScope o limit) NO lleva cabecera: el total del negocio al lado de un
 * subconjunto sería un dato correcto respondiendo otra pregunta — que es el modo de falla que este frente caza. */
function _figHeadline(metrica, eje, scenario, { acotado = false } = {}) {
  if (acotado) return null;
  const h = headlineTotal(metrica, eje, scenario);
  if (!h) return null;
  const valor = h.unidad === "money" ? _money(h.raw) : h.unidad === "pct" ? `${_p1(h.valor)}%` : h.unidad === "ratio" ? `${h.valor.toFixed(1)}x` : String(h.valor);
  return fig(h.label, valor, {
    unit: h.unidad, raw: h.raw, mandatory: false, context: `${h.sujeto} · cifra de cabecera`,
    universo: h.universo, periodo: h.periodo, escenario: scenario || null,
    entidad: h.sujeto, dimension: eje, fuente: h.fuente, formula: h.formula,
  });
}

// composeSpecRetrieval({metric, dimension, filters, scenario, limit, sort, entityScope}) → {opener, evidence} | null
// entityScope (Etapa 2, owner 2026-08-03, continuidad conversacional universal — generalización mecánica del MISMO
// parámetro que ya usan inventoryStatus/marginRead/salesRead/contributionRead vía _scopeRows): "de esos SKU, ¿cuál
// vende más?" acota el ranking al subconjunto nombrado ANTES de ordenar/recortar a `limit`, en vez de traer el
// ranking del eje entero. Fallback SUAVE: si el subconjunto no intersecta ninguna fila del eje (cruce de dimensión/
// tenant stale), se ignora y sigue con el eje completo — nunca una respuesta vacía por un alcance incompatible.
export function composeSpecRetrieval({ metric, dimension, filters = {}, scenario, limit = null, sort = null, entityScope = null }) {
  const m = METRICS[metric];
  const sba = m && m.sourceByAxis && m.sourceByAxis[dimension];
  if (!sba) return null;                                    // métrica@eje no declarada → no soportada (seam degrada)
  const ent = ENTITIES[dimension];
  if (!ent) return null;

  let rows = _load(sba.source, scenario);
  if (!Array.isArray(rows) || !rows.length) return null;
  if (filters.marca)   rows = rows.filter((r) => r && r.marca === filters.marca);
  if (filters.familia) rows = rows.filter((r) => r && r.sfamilia === filters.familia);
  if (filters.bodega)  rows = rows.filter((r) => r && r.bodega === filters.bodega);
  if (!rows.length) return null;

  const field = sba.field;
  let result;
  if (ent.isGroupBy) {
    // eje de agrupación (bodega/canal): agrupar por el keyField y agregar (sum · avg según el contrato).
    // groupVia (eje canal · 2026-07-26): la etiqueta de grupo puede venir de OTRA fuente por join declarado
    // (clientesMargen no trae canal — el canon nombre↔canal vive en clientesVentas · agregación exacta).
    const via = sba.groupVia ? new Map(_load(sba.groupVia.source, scenario).map((r) => [String(r[sba.groupVia.key]), r[sba.groupVia.field]])) : null;
    const srcKey = (SOURCES[sba.source] && SOURCES[sba.source].keyField) || "nombre";
    const groups = {};
    for (const r of rows) { const k = via ? via.get(String(r[srcKey])) : r[ent.keyField]; if (k == null) continue; (groups[k] = groups[k] || []).push(r); }
    const agg = sba.agg || "sum";
    result = Object.entries(groups).map(([name, grp]) => {
      const vals = grp.map((r) => r[field]).filter((v) => typeof v === "number");
      const sum = vals.reduce((a, b) => a + b, 0);
      return { name, value: agg === "avg" ? (vals.length ? sum / vals.length : 0) : sum };
    });
  } else {
    // eje por-fila (sku): el nombre viene del keyField de la fuente (skuInventario → "sku")
    const nameField = (SOURCES[sba.source] && SOURCES[sba.source].keyField) || "sku";
    result = rows.map((r) => ({ name: r[nameField], value: r[field] })).filter((x) => typeof x.value === "number");
  }
  if (!result.length) return null;

  // entityScope (Etapa 2) — se aplica DESPUÉS de armar `result` (name/value ya resueltos, mismo `name` para ejes
  // group-by como para ejes por-fila): mismo fallback suave que _scopeRows (specRetrieval.js) — si el subconjunto
  // no matchea ninguna fila (cruce de dimensión, ej. entityScope de SKU sobre dimension="cliente"), se ignora.
  if (entityScope && Array.isArray(entityScope.entities) && entityScope.entities.length) {
    const set = new Set(entityScope.entities.map(String));
    const scoped = result.filter((x) => set.has(String(x.name)));
    if (scoped.length) result = scoped;
  }

  const dir = sort && sort.dir === "asc" ? "asc" : "desc";
  result.sort((a, b) => (dir === "asc" ? a.value - b.value : b.value - a.value));
  if (limit && limit > 0) result = result.slice(0, limit);
  // ORDEN SELLADO por la tool (owner 2026-08-03, MISMO patrón que composeSpecMargin/commit 9184ec0): el criterio con
  // que este ranking YA ordenó sus filas (arriba) viaja en `facts.orden` para que guardC verifique DIRECTO contra la
  // tabla final, sin depender de que el narrador lo repita en prosa. Un único criterio, sin ambigüedad de columna
  // (queryMetric siempre rankea UNA sola métrica) — el caso más simple y más seguro de sellar.
  const orden = `${dir === "asc" ? "ascendente" : "descendente"} por ${m.label}`;

  const _sc = m.scale && m.scale[dimension];
  const outRows = result.map((x) => ({ name: x.name, value: x.value, fmt: _fmt(x.value, m.unit, _sc) }));
  const lines = outRows.map((x) => `${x.name}: ${x.fmt}`).join(" · ");
  const filt = [filters.marca, filters.familia, filters.bodega].filter(Boolean).join("/");
  const opener = `${m.label} por ${ent.label.sing}${filt ? ` (${filt})` : ""} · escenario ${scenario}.\n\n${lines}`;
  // BOLETA (primera clase): cada fila del ranking es una cifra autorizada · value == x.fmt del texto (una sola verdad)
  const _bctx = `${m.label} por ${ent.label.sing}${filt ? ` (${filt})` : ""}`;
  const bol = outRows.map((x) => fig(`${x.name} · ${m.label}`, x.fmt, { unit: m.unit, raw: _rawC(x.value, m.unit, _sc), context: _bctx }));
  // …y la CIFRA DE CABECERA del mismo corte, cuando el producto la muestra (decisión 6): sin esto, la pantalla
  // afirma un total y la evidencia que ella misma declara sólo trae el ranking — ADI no puede contrastar su propia
  // cabecera. Va al final, igual que "Contribución total" en contributionRead, y sólo sobre el eje completo.
  const _headline = _figHeadline(metric, dimension, scenario, { acotado: !!filt || !!limit || !!(entityScope && entityScope.entities && entityScope.entities.length) });
  if (_headline) bol.push(_headline);
  return {
    opener,
    suggestions: null,
    sentrixAction: null,
    // evidence enriquecida (Fase 2 · contratos): `rows` estructuradas (nombre + valor + formato) para que el CLOSER lea
    // el PATRÓN (líder/cola/polaridad) sin recomputar ni introducir cifras. El texto sigue mostrando formateado ("$64K").
    evidence: { entityType: dimension, dimension, metrica: metric, lens: "cuadro", orden, boleta: bol,
      rows: outRows, metricLabel: m.label, unit: m.unit, polarity: m.polarity, dimLabel: ent.label.sing, sortDir: dir },
  };
}

// métricas que aplican a un eje (con sourceByAxis declarado) · base de dive/compare
function _metricsFor(dimension) {
  return Object.entries(METRICS).filter(([, m]) => (m.axes || []).includes(dimension) && m.sourceByAxis && m.sourceByAxis[dimension]);
}
// valor de una entidad para una métrica en un eje (busca la fila por el keyField de la fuente) · null si no está.
// EJES GROUP-BY (bodega/canal · 2026-07-26): la "entidad" es un GRUPO de filas — se AGREGA según el contrato
// (sum · avg), jamás la primera fila (antes devolvía null por buscar el nombre del grupo en el keyField de la
// fuente). groupVia: la etiqueta de grupo viene de otra fuente por join declarado (canal vive en clientesVentas).
function _entityValue(name, m, dimension, scenario) {
  const sba = m.sourceByAxis[dimension];
  const src = SOURCES[sba.source];
  if (!src) return null;
  const rows = _load(sba.source, scenario);
  const ent = ENTITIES[dimension];
  if (ent && ent.isGroupBy) {
    const via = sba.groupVia ? new Map(_load(sba.groupVia.source, scenario).map((r) => [String(r[sba.groupVia.key]), r[sba.groupVia.field]])) : null;
    const vals = rows
      .filter((r) => String(via ? via.get(String(r[src.keyField])) : r[ent.keyField]) === String(name))
      .map((r) => r[sba.field]).filter((v) => typeof v === "number");
    if (!vals.length) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return (sba.agg || "sum") === "avg" ? sum / vals.length : sum;
  }
  const row = rows.find((r) => String(r[src.keyField]) === String(name));
  return row && typeof row[sba.field] === "number" ? row[sba.field] : null;
}

// sampleEntities(dimension, n, scenario) → hasta n nombres reales del eje (data-driven · para repreguntas de comparación
// con opciones concretas · nada hardcodeado). Excluye duplicados; primeros del source. Vacío si el eje no existe.
export function sampleEntities(dimension, n = 3, scenario = "actual") {
  const ent = ENTITIES[dimension]; if (!ent) return [];
  const src = SOURCES[ent.source]; if (!src) return [];
  const seen = [];
  for (const r of _load(ent.source, scenario)) {
    const name = r[src.keyField];
    if (name && !seen.includes(name)) seen.push(name);
    if (seen.length >= n) break;
  }
  return seen;
}

// composeSpecDive({dimension, entity, scenario}) → perfil de UNA entidad (todas sus métricas del contrato) | null (no está)
export function composeSpecDive({ dimension, entity, scenario }) {
  const ent = ENTITIES[dimension];
  if (!ent || !entity) return null;
  const lines = [], metrics = [];
  for (const [, m] of _metricsFor(dimension)) {
    const v = _entityValue(entity, m, dimension, scenario);
    if (v != null) {
      const fmt = _fmt(v, m.unit, m.scale && m.scale[dimension]);
      lines.push(`${m.label}: ${fmt}`);
      // `raw` normalizado a dólares (ver _rawC); `value` se conserva CRUDO porque `metrics` viaja a los facts y el
      // closer lo lee con la escala declarada de la métrica — cambiarlo movería lo que el narrador ve.
      metrics.push({ label: m.label, value: v, raw: _rawC(v, m.unit, m.scale && m.scale[dimension]), fmt, unit: m.unit, polarity: m.polarity });   // Fase 2b · para que el closer lea la TENSIÓN
    }
  }
  if (!lines.length) return null;                          // entidad no encontrada en ningún source → el seam degrada honesto
  const opener = `${entity} (${ent.label.sing}) · escenario ${scenario}.\n\n${lines.join(" · ")}`;
  // BOLETA (primera clase): cada métrica del perfil es una cifra autorizada · value == fmt del texto (una sola verdad)
  const bol = metrics.map((mm) => fig(`${entity} · ${mm.label}`, mm.fmt, { unit: mm.unit, raw: mm.raw, context: `${entity} (${ent.label.sing})` }));
  return { opener, suggestions: null, sentrixAction: null, evidence: { entidad: entity, entityType: dimension, dimension, lens: "cuadro", metrics, boleta: bol } };
}

// composeSpecComposicion({dimension, entity}) → cómo se compone la venta/contribución/margen de UN cliente por
// familia (owner 2026-08-07, "familias que más compran... coloca todos los datos, ADI muestra el resolutivo"):
// reusa la MISMA matriz cliente×SKU de Sentrix (composicionClientePorFamilia, clienteSkuMatrix.js — cierra
// exacto con el cuadro) para que el narrador nombre la familia con más peso Y su margen — el ingrediente que le
// faltaba al mecanismo agregado (carga/rebate) para explicar DÓNDE pesa la brecha. SOLO eje cliente — marca/
// familia/SKU no tienen "de qué se compone" en este sentido. LÍMITE HONESTO: la matriz cliente×SKU no varía por
// escenario (bonanza/tensión/crisis) — es la MISMA base que ya muestra el Pareto de Sentrix en cualquier
// escenario (limitación heredada del dato de demo, no nueva de esta función).
export function composeSpecComposicion({ dimension, entity, scenario = "actual" }) {
  if (dimension !== "cliente" || !entity) return null;
  const porVenta = composicionClientePorFamilia(entity, "ventas");
  const porContrib = composicionClientePorFamilia(entity, "contribucion");
  if (!porVenta || !porVenta.length) return null;
  const totalV = porVenta.reduce((s, r) => s + r.value, 0);
  // UNIDADES + ROTACIÓN (owner 2026-08-07, "conecta con la parte de SKU inmovilizados"): la rotación por SKU sale
  // del MISMO inventario scenario-aware que usa el detector de capital detenido (entityCapitalLigado) — así el
  // número que ves en la composición explica por qué un SKU aparece inmovilizado abajo. Las UNIDADES por SKU son
  // el reparto de las unidades TOTALES del cliente (clientesVentas.unidades) por la MISMA proporción de venta que
  // ya usa la matriz para el $ — cierran con el total del cliente (una sola verdad), no un conteo aparte.
  const _invRows = _load("skuInventario", scenario);
  const _rotBySku = new Map(_invRows.map((r) => [r.sku, typeof r.rotacion === "number" ? r.rotacion : null]));
  const _cliRow = _load("clientesVentas", scenario).find((c) => c.nombre === entity);
  const _cliUnits = _cliRow && typeof _cliRow.unidades === "number" ? _cliRow.unidades : null;
  // COMPOSICIÓN POR SKU (owner 2026-08-07, Ficha Ejecutiva real: "participación, venta, contribución y margen"
  // también a nivel SKU, no solo familia) — mismo cierre exacto que `familias` arriba (misma matriz cliente×SKU,
  // composicionCliente en vez de composicionClientePorFamilia), margen por SKU sale de `skusMargen` (el margen es
  // propiedad del SKU, no varía por quién lo compra, en este modelo de dato — igual que el margen de familia SÍ
  // varía porque es el mix ponderado de los SKU que cada cliente elige).
  const skuVenta = composicionCliente(entity, "ventas");
  const skuContrib = composicionCliente(entity, "contribucion");
  const totalSV = skuVenta.reduce((s, r) => s + r.value, 0);
  const skus = skuVenta.map((s) => {
    const c = skuContrib.find((x) => x.name === s.name);
    const contribucion = c ? c.value : 0;
    const m = _skusM.find((x) => x.nombre === s.name);
    const rotacion = _rotBySku.has(s.name) ? _rotBySku.get(s.name) : null;
    const unidades = (_cliUnits != null && totalSV) ? Math.round((_cliUnits * s.value) / totalSV) : null;
    return { nombre: s.name, venta: s.value, contribucion, margen: typeof m?.margen === "number" ? m.margen : (s.value ? Math.round((contribucion / s.value) * 1000) / 10 : null), sfamilia: m ? m.sfamilia : null, share: totalSV ? Math.round((s.value / totalSV) * 1000) / 10 : null, unidades, rotacion };
  }).sort((a, b) => b.venta - a.venta);
  // familia: unidades = suma de sus SKU (cierra con el reparto por SKU) · rotación = promedio ponderado por venta
  // de la rotación de sus SKU (resumen honesto de "qué tan rápido rota esta familia", no un número inventado).
  const _famAgg = (fam) => {
    const rows = skus.filter((s) => s.sfamilia === fam);
    const uni = rows.some((r) => typeof r.unidades === "number") ? rows.reduce((a, r) => a + (r.unidades || 0), 0) : null;
    const withRot = rows.filter((r) => typeof r.rotacion === "number" && r.venta > 0);
    const den = withRot.reduce((a, r) => a + r.venta, 0);
    const rot = den ? Math.round((withRot.reduce((a, r) => a + r.rotacion * r.venta, 0) / den) * 10) / 10 : null;
    return { unidades: uni, rotacion: rot };
  };
  const familias = porVenta.map((f) => {
    const c = porContrib.find((x) => x.name === f.name);
    const contribucion = c ? c.value : 0;
    const agg = _famAgg(f.name);
    return { nombre: f.name, venta: f.value, contribucion, margen: f.value ? Math.round((contribucion / f.value) * 1000) / 10 : null, share: totalV ? Math.round((f.value / totalV) * 1000) / 10 : null, unidades: agg.unidades, rotacion: agg.rotacion };
  }).sort((a, b) => b.venta - a.venta);
  const lines = familias.map((f) => `${f.nombre}: ${f.share}% de su venta, margen ${f.margen}%`);
  const opener = `Cómo se compone la compra de ${entity} por familia (venta/contribución/margen):\n\n${lines.join(" · ")}`;
  // BOLETA LIVIANA (owner 2026-08-07, hallazgo en vivo: con las ~50 cifras de un perfil completo — entityProfile+
  // trend+composición+capital — el narrador a veces degrada a volcar TODA la boleta en una tabla cruda, sin prosa):
  // el detalle completo (venta/contribución/margen) SOLO para la familia dominante (la que importa para el
  // hallazgo del mix, ver la doctrina de arriba) — el resto de familias autorizan solo su participación, liviano
  // pero suficiente si el narrador necesita citarlas.
  const bol = [];
  familias.forEach((f, i) => {
    bol.push(fig(`${entity} · ${f.nombre} · participación`, `${f.share}%`, { unit: "pct", raw: f.share, context: `composición de ${entity} por familia`, mandatory: i === 0 }));
    if (i === 0) {
      bol.push(fig(`${entity} · ${f.nombre} · venta`, _fmt(f.venta, "money", "K"), { unit: "money", raw: f.venta * 1000, context: `composición de ${entity} por familia` }));
      bol.push(fig(`${entity} · ${f.nombre} · contribución`, _fmt(f.contribucion, "money", "K"), { unit: "money", raw: f.contribucion * 1000, context: `composición de ${entity} por familia` }));
      bol.push(fig(`${entity} · ${f.nombre} · margen`, `${f.margen}%`, { unit: "pct", raw: f.margen, context: `composición de ${entity} por familia`, mandatory: true }));
    }
  });
  return {
    opener, suggestions: null, sentrixAction: null,
    evidence: { entidad: entity, entityType: "cliente", dimension: "cliente", lens: "cuadro", composicion: { familias, skus }, boleta: bol },
  };
}

// ── LA RELACIÓN CLIENTE×SKU, ANTES DE AFIRMAR NADA (owner 2026-08-09, decisión 9 · hallazgo J) ──────────────────
// clientCapitalRelacion({entity, scenario}) → de qué naturaleza es el vínculo entre ESTE cliente y los SKU con
// inventario, medido sobre el dato cargado. Tres estados explícitos (decisión 11: nada devuelve `null` mudo
// cuando hay una divergencia conocida — se declara con razón verificable):
//
//   · "observada"           el dato registra QUÉ SKU le vendés a cada cliente (transacciones atómicas). El cruce
//                           es una lectura: la cifra puede sellarse como el resto de las lecturas.
//   · "afinidad_modelada"   no hay transacciones atómicas, pero la estimación de afinidad SÍ ACOTA: el mix de
//                           este cliente deja fuera parte del inventario. La cifra existe, pero es una
//                           INFERENCIA MODELADA → sello `indicado`, y nunca capital PERTENECIENTE al cliente.
//   · "unsupported"         no hay transacciones atómicas Y la estimación no acota nada: el mix abarca TODOS los
//                           SKU con inventario, los mismos para cualquier cuenta. El cruce devolvería el
//                           inventario COMPLETO del negocio con el nombre de un cliente encima. Medido en el
//                           tenant demo: la tool servía el mismo subtotal y los mismos SKU, byte-idénticos, para
//                           las 13 cuentas. Acá NO se afirma nada del cliente — se declina con la razón.
//
// `crosses.atomic` es la MISMA declaración canónica que ya bloquea la vista "productos que le vendo a este
// cliente" en `sentrix/capability.js:entityExplorable` — este composer dejó de contradecirla. Y la cobertura se
// MIDE contra el dato (cuántos SKU con inventario quedan dentro del mix), no se asume: si mañana el ERP trae la
// matriz real, el estado cambia solo, sin tocar esta función.
export function clientCapitalRelacion({ entity, scenario = "actual" } = {}) {
  const base = { entidad: entity || null, skusInventario: 0, skusEnMix: 0, atomico: false };
  if (!entity) return { ...base, estado: "unsupported", relacion: "sin_entidad", razon: "no se indicó de qué cliente" };
  const atomico = !!(datasetCapability().crosses && datasetCapability().crosses.atomic);
  const kSF = _sf("capital", "sku");
  const src = kSF && SOURCES[kSF.source];
  if (!kSF || !src) return { ...base, atomico, estado: "unsupported", relacion: "sin_fuente", razon: "el contrato no declara una fuente de inventario por SKU" };
  const inv = _load(kSF.source, scenario);
  const universo = new Set(inv.map((r) => String(r[src.keyField])));
  const mix = composicionCliente(entity, "ventas");
  if (!mix || !mix.length) return { ...base, atomico, skusInventario: universo.size, estado: "unsupported", relacion: "sin_mix", razon: `no encuentro el surtido de ${entity} en el dato` };
  const mixSet = new Set(mix.map((r) => String(r.name)));
  const dentro = [...universo].filter((s) => mixSet.has(s));
  const medido = { ...base, atomico, skusInventario: universo.size, skusEnMix: dentro.length };
  if (atomico) return { ...medido, estado: "observada", relacion: "observada", razon: "el dato registra qué SKU se le vendió a cada cliente" };
  if (dentro.length >= universo.size) {
    return {
      ...medido, estado: "unsupported", relacion: "sin_relacion",
      razon: `el dato no registra qué SKU le vendes a cada cliente: la relación cliente×SKU es una estimación de afinidad, y para ${entity} abarca los ${universo.size} SKU con inventario — los mismos que para cualquier otra cuenta. Cruzar el inventario contra ese surtido devolvería el inventario completo del negocio con el nombre de un cliente encima, no capital atribuible a ${entity}`,
      alternativas: ["el capital inmovilizado del negocio, por bodega y por antigüedad"],
    };
  }
  return {
    ...medido, estado: "afinidad_modelada", relacion: "afinidad_modelada",
    razon: `el dato no registra qué SKU le vendes a cada cliente: la relación es una estimación de afinidad que asocia ${dentro.length} de los ${universo.size} SKU con inventario al surtido de ${entity}`,
  };
}

// composeSpecClientCapital({dimension, entity, scenario}) → inventario inmovilizado, cruzado contra el surtido del
// cliente (owner 2026-08-07, "capital ligado a su mix... deberían aparecer el valorizado y unidades, incluso
// la bodega"): MISMO criterio de "detenido" que el detector de capital (rotación bajo tu mínimo o cobertura
// sobre tu máximo, POLICY — una sola vara para todo ADI). No invoca el detector comercial (a diferencia de
// composeSpecDiagnose con entityScope de SKU, que sin querer corre el foco comercial SIN acotar — un scope de SKU
// no intersecta filas por cliente — así que este composer recalcula el criterio de capital directo, sin ese
// efecto secundario).
//
// DECISIÓN 9 (owner 2026-08-09): antes de cruzar nada, se consulta `clientCapitalRelacion`. Si el vínculo no
// existe en el dato, esto DECLINA con la razón medida — devuelve `{unsupported:true, ...}`, no una cifra con el
// nombre de un cliente encima. Si el vínculo es una AFINIDAD MODELADA, la cifra sale pero sellada `indicado` y
// con el sujeto correcto: el inventario es del NEGOCIO, el cliente es solo la asociación estimada. Null (sin
// afirmación) si ningún SKU alcanzado está inmovilizado — honesto, nada que reportar.
export function composeSpecClientCapital({ dimension, entity, scenario }) {
  if (dimension !== "cliente" || !entity) return null;
  const rel = clientCapitalRelacion({ entity, scenario });
  if (rel.estado === "unsupported") {
    return { unsupported: true, relacion: rel.relacion, reason: rel.razon, alternativas: rel.alternativas || [], cobertura: rel };
  }
  const skuRows = composicionCliente(entity, "ventas");
  if (!skuRows || !skuRows.length) return null;
  const skuSet = new Set(skuRows.map((r) => r.name));
  const kSF = _sf("capital", "sku"), rSF = _sf("rotacion", "sku"), dSF = _sf("doh", "sku");
  if (!kSF || !rSF || !dSF) return null;
  const src = SOURCES[kSF.source]; if (!src) return null;
  const rows = _load(kSF.source, scenario).filter((r) => skuSet.has(r[src.keyField]));
  const items = [];
  for (const r of rows) {
    const cap = r[kSF.field], rot = r[rSF.field], doh = r[dSF.field]; if (typeof cap !== "number") continue;
    const dormido = (typeof rot === "number" && rot < POLICY.rotacionMin) || (typeof doh === "number" && doh > POLICY.dohMax);
    if (!dormido) continue;
    items.push({ sku: r[src.keyField], usd: cap, bodega: r.bodega, unidades: r.stockUnd, diasSinVenta: r.diasSinVenta, critico: r.alerta === "crit" });
  }
  if (!items.length) return null;
  items.sort((a, b) => b.usd - a.usd);
  const subtotal = items.reduce((s, it) => s + it.usd, 0);
  const observada = rel.estado === "observada";
  // EL SUJETO DE LA CIFRA (decisión 7): con relación OBSERVADA el cliente califica el surtido ("productos que le
  // vendés a X"); con afinidad MODELADA ni siquiera eso — el sujeto es TU inventario y el cliente es una
  // asociación estimada. En los dos casos el capital es del negocio, nunca del cliente.
  const sujeto = observada ? `productos que le vendes a ${entity}` : `SKU asociados al surtido de ${entity} por afinidad estimada`;
  const sello = observada ? undefined : "indicado";
  const lines = items.map((it) => `${it.sku} (${it.bodega}): ${_money(it.usd)}${typeof it.unidades === "number" ? `, ${it.unidades} unidades` : ""}${typeof it.diasSinVenta === "number" ? `, ${it.diasSinVenta}d sin venta` : ""}${it.critico ? " · crítico" : ""}`);
  const opener = `De los ${sujeto}, ${items.length} ${items.length === 1 ? "está" : "están"} con capital inmovilizado en tu inventario (${_money(subtotal)} entre ${items.length === 1 ? "ese" : "todos"}):\n\n${lines.join("\n")}`;
  const _ctx = `capital inmovilizado del negocio en ${sujeto} — es inventario tuyo, no de ${entity}`;
  const _figOpts = (extra) => ({ periodo: "hoy", universo: "inventario", dimension: "sku", ...(sello ? { sello } : {}), ...extra });
  const bol = [fig(`Inventario · capital inmovilizado en ${sujeto} · subtotal`, _money(subtotal), _figOpts({ unit: "money", raw: subtotal, mandatory: true, context: _ctx, entidad: null }))];
  items.forEach((it) => {
    bol.push(fig(`${it.sku} · capital inmovilizado`, _money(it.usd), _figOpts({ unit: "money", raw: it.usd, context: _ctx })));
    if (typeof it.unidades === "number") bol.push(fig(`${it.sku} · unidades inmovilizadas`, `${it.unidades}`, _figOpts({ unit: "unit", raw: it.unidades, context: _ctx })));
    if (typeof it.diasSinVenta === "number") bol.push(fig(`${it.sku} · días sin venta`, `${it.diasSinVenta}d`, _figOpts({ unit: "days", raw: it.diasSinVenta, context: _ctx })));
  });
  return {
    opener, suggestions: null, sentrixAction: null,
    evidence: {
      entidad: entity, entityType: "cliente", dimension: "cliente", lens: "cuadro",
      capitalLigado: { subtotal, items, relacion: rel.relacion, sujeto, propiedad: "negocio", nota: rel.razon },
      boleta: bol,
    },
  };
}

// comparePairs(dimension, entities, scenario) → pairs A vs B (métrica por métrica) + participación (share de ventas) para
// el PANEL COMPARATIVO de Sentrix. null si falta una entidad (→ el texto del motor degrada honesto, sin panel roto).
export function comparePairs(dimension, entities, scenario = "actual") {
  const ent = ENTITIES[dimension];
  if (!ent || !Array.isArray(entities) || entities.length !== 2) return null;
  const [a, b] = entities; const pairs = []; let aAny = false, bAny = false;
  for (const [, m] of _metricsFor(dimension)) {
    const va = _entityValue(a, m, dimension, scenario), vb = _entityValue(b, m, dimension, scenario);
    if (va != null) aAny = true; if (vb != null) bAny = true;
    if (va == null && vb == null) continue;
    const _sc = m.scale && m.scale[dimension];
    pairs.push({ label: m.label, aFmt: va == null ? "—" : _fmt(va, m.unit, _sc), bFmt: vb == null ? "—" : _fmt(vb, m.unit, _sc), aVal: va, bVal: vb, unit: m.unit, polarity: m.polarity });
  }
  if (!aAny || !bAny || !pairs.length) return null;   // una entidad ausente → sin panel comparativo
  // participación (share de ventas) = señal de ESCALA · se computa contra el total del eje
  const vm = METRICS.ventas, vsba = vm && vm.sourceByAxis && vm.sourceByAxis[dimension];
  if (vsba) {
    const rows = _load(vsba.source, scenario);
    const total = rows.reduce((s, r) => s + (typeof r[vsba.field] === "number" ? r[vsba.field] : 0), 0);
    const av = _entityValue(a, vm, dimension, scenario), bv = _entityValue(b, vm, dimension, scenario);
    if (total > 0 && av != null && bv != null)
      pairs.unshift({ label: "Participación", aFmt: (av / total * 100).toFixed(1) + "%", bFmt: (bv / total * 100).toFixed(1) + "%", aVal: +(av / total * 100).toFixed(1), bVal: +(bv / total * 100).toFixed(1), unit: "pct", polarity: "higher" });
  }
  return { a, b, pairs };
}

// composeSpecCompare({dimension, entities:[a,b], scenario}) → dos entidades lado a lado, métrica por métrica | null
export function composeSpecCompare({ dimension, entities, scenario }) {
  const ent = ENTITIES[dimension];
  if (!ent || !Array.isArray(entities) || entities.length !== 2) return null;
  const [a, b] = entities;
  const lines = [], pairs = [];
  for (const [, m] of _metricsFor(dimension)) {
    const va = _entityValue(a, m, dimension, scenario), vb = _entityValue(b, m, dimension, scenario);
    if (va == null && vb == null) continue;
    const _sc = m.scale && m.scale[dimension];
    const aFmt = va == null ? "—" : _fmt(va, m.unit, _sc), bFmt = vb == null ? "—" : _fmt(vb, m.unit, _sc);
    lines.push(`${m.label}: ${a} ${aFmt} vs ${b} ${bFmt}`);
    pairs.push({ label: m.label, aFmt, bFmt, aVal: va, bVal: vb, unit: m.unit, polarity: m.polarity });   // Fase 2b · para leer la DIFERENCIA PRINCIPAL
  }
  if (!lines.length) return null;                          // ninguna de las dos entidades encontrada → el seam degrada honesto
  const opener = `${a} vs ${b} (${ent.label.sing}) · escenario ${scenario}.\n\n${lines.join("\n")}`;
  // BOLETA (primera clase): cada lado de cada métrica es una cifra autorizada · value == el fmt del texto (una sola verdad)
  const _ctx = `${a} vs ${b}`;
  const bol = [];
  for (const p of pairs) {
    if (p.aFmt !== "—") bol.push(fig(`${a} · ${p.label}`, p.aFmt, { unit: p.unit, raw: p.aVal, mandatory: true, context: _ctx }));
    if (p.bFmt !== "—") bol.push(fig(`${b} · ${p.label}`, p.bFmt, { unit: p.unit, raw: p.bVal, mandatory: true, context: _ctx }));
  }
  return { opener, suggestions: null, sentrixAction: null, evidence: { entidad: a, entityB: b, entityType: dimension, dimension, lens: "cuadro", pairs, boleta: bol } };
}

/* ── composeSpecDiagnose · ADI Core · motor DIAGNOSE (¿dónde se pierde/inmoviliza plata?) ──────────────
 * Lo que separa a ADI del BI clásico: un barrido DATA-DRIVEN de detectores sobre el dato del contrato —
 * cambia cuando cambia el dato, NADA hardcodeado (sobrevive el swap a un ERP real).
 * Reglas cerradas (owner 2026-07-03):
 *   · margen  → "contribución no capturada" = venta×benchmark/100 − contribución  (= brecha de margen en $)
 *   · carga   → carga comercial sobre el target FIJO 3.5% (POLICY.targetCarga) · recuperable = (carga−target)/100 × venta
 *   · capital → dormido por umbral NUMÉRICO: rotación < POLICY.rotacionMin  ó  doh > POLICY.dohMax
 * Multiplicador de ventas = clientesVentas.actual (canónico del contrato · byte-consistente con mechanisms/thesis) vía join.
 * Guardrail scenario-aware: los detectores comerciales corren SOLO sobre CLIENTE (scenario-aware) · capital sobre SKU
 * (margen/carga @sku/@marca son base-only → NO se tocan acá). Umbrales SIEMPRE desde POLICY (nunca literales) → el
 * diagnose no puede citar un target distinto al resto de ADI. Sin focos materiales → null (el seam degrada honesto). */
const _DIAG_FLOOR_USD = 50000;   // piso de materialidad de focos comerciales ($ · evita el ruido de clientes chicos)
// gate del detector de margen (pp bajo benchmark · = gate quality-growth del motor) · vive en POLICY (una verdad
// con el semáforo de la Mesa) — LECTURA VIVA (F2 multiempresa: el perfil del tenant la re-resuelve en initTenant;
// capturarla en import la dejaba stale al cambiar de empresa)
const _DIAG_MARGIN_GAP = () => POLICY.margenBrechaMaterial;
const _DIAG_TOPN = 5;

// fuente+campo declarados por el CONTRATO para una métrica@eje (si el ERP remapea la fuente, el diagnose la sigue)
function _sf(metric, dim) { const m = METRICS[metric]; return (m && m.sourceByAxis && m.sourceByAxis[dim]) || null; }

// _norm/_eqNorm (owner 2026-07-31, hallazgo por lectura de código, auditoría integral): la normalización de
// nombres (typos/acentos) era INCONSISTENTE entre rutas — entityRecord.js (resolveEntity)/temporal.js
// (resolveEntityName) YA normalizan case+acento antes de comparar, pero acá la comparación era EXACTA
// (String===String) — "santiago"/"Sodimac " (minúscula o con acento distinto al del dato) fallaba en silencio y la
// tool declinaba "no hay señal" pese a que el dato SÍ existe. Mismo patrón `_norm` YA establecido en esas otras capas
// (duplicado a propósito, ver sus comentarios: capas distintas del pipeline, no vale acoplarlas por 1 línea).
const _norm = (s) => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const _eqNorm = (a, b) => a != null && b != null && _norm(a) === _norm(b);

// acota el barrido a una marca/familia/bodega/cliente (los `filters` del spec) y, si viene, al ENTITYSCOPE heredado de un
// follow-up deíctico ("de esos…"): un set de nombres/SKU de la última evidencia. Si el set NO intersecta (cruce de dimensión),
// se ignora y devuelve las filas del filtro (nunca vacía por un alcance incompatible → la respuesta general en vez de mentir).
// BODEGA/CANAL (Etapa 1, owner 2026-08-04): antes el match SOLO comparaba contra r.nombre/r.sku — un entityScope de
// bodega/canal (ej. "esas bodegas" resuelto por conversationScope.js) nunca intersectaba nada, así que el fallback
// suave de arriba lo IGNORABA EN SILENCIO — el blocker real del cierre (bodega/canal ya "resolvían" como entidad
// conversacional desde el fix de entityRecord.js/conversationScope.js, pero el filtro downstream no los aplicaba).
// `axis` se resuelve UNA vez con guessDimension (misma fuente de verdad que conversationScope.js) sobre el primer
// nombre del scope — nunca se adivina por qué campo trae la fila (fuentes sin ese eje, ej. skusMargen sin bodega,
// simplemente no matchean y caen al fallback suave, honesto).
function _scopeRows(rows, filters, entityScope) {
  if (filters.marca)   rows = rows.filter((r) => r && _eqNorm(r.marca, filters.marca));
  if (filters.familia) rows = rows.filter((r) => r && _eqNorm(r.sfamilia, filters.familia));
  if (filters.bodega)  rows = rows.filter((r) => r && _eqNorm(r.bodega, filters.bodega));
  if (filters.cliente) rows = rows.filter((r) => r && _eqNorm(r.nombre, filters.cliente));
  if (entityScope && Array.isArray(entityScope.entities) && entityScope.entities.length) {
    const set = new Set(entityScope.entities.map((s) => String(s)));
    const axis = guessDimension(entityScope.entities[0]);
    const groupField = axis === "bodega" ? "bodega" : axis === "canal" ? "canal" : null;
    const scoped = rows.filter((r) => r && (set.has(String(r.nombre != null ? r.nombre : r.sku)) || (groupField && r[groupField] != null && set.has(String(r[groupField])))));
    if (scoped.length) rows = scoped;
  }
  return rows;
}

// detectores comerciales (CLIENTE · scenario-aware): contribución no capturada + carga comercial alta
// entityScope (Etapa 2, owner 2026-08-04): forwarding mecánico a _scopeRows — "de esos clientes, ¿dónde
// diagnosticamos?" acota el barrido comercial al subconjunto (antes ignoraba cualquier alcance heredado). Un
// entityScope de SKU (eje de _diagCapital, no de este detector) NO intersecta r.nombre/r.marca/r.sfamilia/r.bodega
// → el fallback suave de _scopeRows lo ignora y el foco comercial sigue intacto (mismo criterio ya usado por
// bodega/canal en Etapa 1: cruce de dimensión = alcance incompatible = se ignora, nunca se fuerza).
function _diagComercial(filters, scenario, entityScope) {
  const vSF = _sf("ventas", "cliente"), mSF = _sf("margen", "cliente"), cSF = _sf("contribucion", "cliente"), gSF = _sf("carga", "cliente");
  if (!vSF || !mSF || !cSF || !gSF) return [];
  const ventas = _load(vSF.source, scenario), margen = _scopeRows(_load(mSF.source, scenario), filters, entityScope);
  if (!ventas.length || !margen.length) return [];
  const vKey = (SOURCES[vSF.source] && SOURCES[vSF.source].keyField) || "nombre";
  const mKey = (SOURCES[mSF.source] && SOURCES[mSF.source].keyField) || "nombre";
  const vBy = {}; for (const r of ventas) vBy[r[vKey]] = r;                    // join por keyField (nombre)
  const contrib = [], carga = [];
  for (const r of margen) {
    const v = vBy[r[mKey]]; if (!v) continue;
    const actual = v[vSF.field]; if (typeof actual !== "number") continue;    // ventas canónicas (K)
    const bmk = benchmarkOf(r), mg = r[mSF.field], cb = r[cSF.field], cg = r[gSF.field];
    // contribución no capturada = venta×benchmark/100 − contribución (K→$) · gate: ≥4pp bajo benchmark y ≥ piso
    if (typeof mg === "number" && typeof cb === "number" && (bmk - mg) >= _DIAG_MARGIN_GAP()) {
      const usd = Math.round(((actual * bmk / 100) - cb) * 1000);
      if (usd >= _DIAG_FLOOR_USD) contrib.push({ entidad: r[mKey], usd, gap: +(bmk - mg).toFixed(1) });
    }
    // carga comercial alta = (carga − target)/100 × venta (K→$) · gate: sobre target y ≥ piso
    if (typeof cg === "number" && cg > POLICY.targetCarga) {
      const usd = Math.round(((cg - POLICY.targetCarga) / 100) * actual * 1000);
      if (usd >= _DIAG_FLOOR_USD) carga.push({ entidad: r[mKey], usd, gap: +(cg - POLICY.targetCarga).toFixed(1) });
    }
  }
  const out = [];
  if (carga.length)   out.push(_diagFoco("carga", "Carga comercial alta", carga));
  if (contrib.length) out.push(_diagFoco("margen", "Contribución no capturada", contrib));
  return out;
}

// detector de inventario (SKU · scenario-aware): capital dormido (umbral numérico · portable a ERP real)
// entityScope (Etapa 2, owner 2026-08-04): forwarding mecánico a _scopeRows — "de esos SKU, ¿cuánto capital
// tienen dormido?" acota el barrido de capital al subconjunto. Un entityScope de cliente (eje de _diagComercial,
// no de este detector) no matchea r.sku/r.nombre de la fuente de capital → fallback suave, foco capital intacto.
function _diagCapital(filters, scenario, entityScope) {
  const kSF = _sf("capital", "sku"), rSF = _sf("rotacion", "sku"), dSF = _sf("doh", "sku");
  if (!kSF || !rSF || !dSF) return [];
  const rows = _scopeRows(_load(kSF.source, scenario), filters, entityScope);
  if (!rows.length) return [];
  const key = (SOURCES[kSF.source] && SOURCES[kSF.source].keyField) || "sku";
  const items = [];
  for (const r of rows) {
    const cap = r[kSF.field], rot = r[rSF.field], doh = r[dSF.field]; if (typeof cap !== "number") continue;
    const dormido = (typeof rot === "number" && rot < POLICY.rotacionMin) || (typeof doh === "number" && doh > POLICY.dohMax);
    if (!dormido) continue;
    items.push({ entidad: r[key], usd: cap, critico: r.alerta === "crit", bodega: r.bodega });   // stockUSD = $ crudo
  }
  return items.length ? [_diagFoco("capital", "Capital detenido", items)] : [];
}

// arma un foco: ordena sus items por $, subtotal, top-N (para el texto) e items completos (para Sentrix)
function _diagFoco(detector, titulo, items) {
  items.sort((a, b) => b.usd - a.usd);
  return { detector, titulo, subtotal: items.reduce((s, it) => s + it.usd, 0), count: items.length, top: items.slice(0, _DIAG_TOPN), items };
}

// composeSpecDiagnose({filters, scenario, entityScope}) → focos rankeados por $ (contribución/carga/capital) | null
// entityScope (Etapa 2, owner 2026-08-04, generalización multi-entidad diagnose/simulateCarga/simulateCapital):
// forwardeado a AMBOS detectores — cada uno lo aplica sobre SU propio eje (cliente/sku) vía _scopeRows, y el
// fallback suave YA establecido (Etapa 1) hace que un scope de un solo eje deje el foco del OTRO eje intacto (ver
// comentarios de _diagComercial/_diagCapital arriba) — nunca fan-out, es FILTRADO: ambos detectores siguen
// recorriendo su eje en un pase y agregando por foco, solo que acotado al subconjunto pedido.
export function composeSpecDiagnose({ filters = {}, scenario, focus, entityScope = null } = {}) {
  // RESUMEN EJECUTIVO (owner 2026-07-10): "no es un ranking — es la lectura completa" → su propio composer (5 movimientos)
  if (focus === "resumen_ejecutivo") return composeSpecResumenEjecutivo({ scenario });
  const focos = [..._diagComercial(filters, scenario, entityScope), ..._diagCapital(filters, scenario, entityScope)];
  if (!focos.length) return null;                                             // sin focos materiales → el seam degrada honesto
  focos.sort((a, b) => b.subtotal - a.subtotal);
  const scope = [filters.marca, filters.familia, filters.bodega, filters.cliente].filter(Boolean).join("/");
  const header = `Diagnóstico${scope ? ` · ${scope}` : ""} · escenario ${scenario}. Miré tus datos y encontré ${focos.length} ${focos.length === 1 ? "foco" : "focos"} donde se pierde margen o se inmoviliza capital:`;
  // opener: una línea por foco · TODAS las cifras formateadas (el number-guard toma las cifras del texto, no de un crudo)
  const blocks = focos.map((f) => {
    if (f.detector === "capital") {
      const crit = f.top.filter((i) => i.critico).length;
      const top = f.top.slice(0, 3).map((it) => `${it.entidad} ${_money(it.usd)}`).join(", ");
      return `• ${f.titulo}: ${_money(f.subtotal)} en ${f.count} SKU sin rotar${crit ? ` (${crit} crítico${crit > 1 ? "s" : ""})` : ""} · ${top}`;
    }
    const top = f.top.slice(0, 3).map((it) => `${it.entidad} ${_money(it.usd)}`).join(", ");
    return `• ${f.titulo}: ${_money(f.subtotal)} · top: ${top}`;
  }).join("\n");
  // GUÍA conversacional: el próximo paso sale del foco (top entidad detectada) · NADA fijo
  const suggestions = focos.map((f) => {
    const e = f.top[0] && f.top[0].entidad;
    if (f.detector === "carga")   return e ? `Cómo recupero la carga de ${e}` : null;
    if (f.detector === "margen")  return e ? `Por qué ${e} cede margen` : null;
    if (f.detector === "capital") return "El capital detenido en detalle";
    return null;
  }).filter(Boolean);
  // BOLETA (primera clase): subtotales (obligatorios) + top-3 por foco · value == el _money del texto (una sola verdad)
  const _ctx = `diagnóstico${scope ? ` · ${scope}` : ""}`;
  const bol = [];
  for (const f of focos) {
    bol.push(fig(`${f.titulo} · subtotal`, _money(f.subtotal), { unit: "money", raw: f.subtotal, mandatory: true, context: _ctx }));
    for (const it of f.top.slice(0, 3)) bol.push(fig(`${it.entidad} · ${f.titulo}`, _money(it.usd), { unit: "money", raw: it.usd, mandatory: false, context: _ctx }));
  }
  // GANCHO OPCIONAL (owner 2026-07-09: fuera la muletilla — "si el LLM interpreta el dato, debe decir la realidad"):
  // la excepción virtuosa (cuenta que crece a contramano con carga baja · calculada, no enlatada) viaja AUTORIZADA
  // en la boleta SOLO acá (el diagnóstico es su lugar); el narrador decide si viene al caso. Sin filtros (es cartera).
  if (!scope) {
    try {
      const _vx = detectVirtuousException(scenario, deriveBusinessThesis(scenario));
      if (_vx && _vx.evidencia) {
        const _ve = _vx.evidencia;
        if (_ve.variacion != null) bol.push(fig(`${_vx.cuenta} · crecimiento`, `${_ve.variacion}%`, { unit: "pct", raw: _ve.variacion, mandatory: false, gancho: true, context: "cuenta que crece a contramano — mencionala solo si viene al caso" }));
        if (_ve.pctRebate != null) bol.push(fig(`${_vx.cuenta} · carga`, `${_ve.pctRebate}%`, { unit: "pct", raw: _ve.pctRebate, mandatory: false, gancho: true, context: "una de las cargas más bajas de la cartera — gancho opcional" }));
      }
    } catch { /* detector legacy sin datos → silencio */ }
  }
  // ORDEN SELLADO por la tool (owner 2026-08-03, MISMO patrón que composeSpecMargin/commit 9184ec0) — SOLO el foco
  // DOMINANTE (focos[0], ya ordenado por subtotal desc arriba, la línea que abre la respuesta): diagnose puede traer
  // 2-3 focos SIMULTÁNEOS (carga/margen/capital), cada uno con su PROPIA lista de entidades y su PROPIO $ — un
  // narrador a veces los funde en UNA tabla multi-columna (una fila por entidad, una columna por foco, ej. "|
  // Cliente | Contribución no capturada | Carga comercial alta |", visto en vivo). Sellar el criterio de MÁS de un
  // foco a la vez arriesgaría un falso positivo: la tabla suele quedar ordenada por el foco PRINCIPAL, así que la(s)
  // columna(s) restante(s) no tienen por qué salir monótonas por sí solas — eso NO es una violación real, solo dos
  // rankings distintos comparten filas. Sellando solo el foco dominante (el mismo que encabeza el texto) cerramos el
  // caso más frecuente y más seguro sin ese riesgo.
  const orden = `descendente por ${focos[0].titulo}`;
  return {
    opener: `${header}\n\n${blocks}`,
    suggestions: suggestions.length ? suggestions : null,
    sentrixAction: null,
    // findings per-item para Sentrix (la boleta/panel los consume · lens diagnostico) · $ ya calculado del dato · + boleta (LLM #2)
    evidence: { lens: "diagnostico", metrica: "diagnose", dimension: "cliente", orden, boleta: bol,
      findings: focos.map((f) => ({ detector: f.detector, titulo: f.titulo, subtotal_usd: f.subtotal,
        // `critico` se emite SIEMPRE que el concepto aplique (los items de capital lo traen como booleano), nunca
        // solo-si-true: ausente se leía como "no sé" y el narrador llenaba el hueco ("todos con valores críticos").
        items: f.items.map((it) => ({ entidad: it.entidad, usd: it.usd, ...(it.bodega ? { bodega: it.bodega } : {}), ...("critico" in it ? { critico: !!it.critico } : {}) })) })) },
  };
}

/* ── composeSpecResumenEjecutivo · EL RESUMEN EJECUTIVO (definición del owner 2026-07-10) ────────────────────
 * "No es un ranking: es una lectura completa de desempeño, margen, pérdidas, causas y recuperación." CINCO
 * movimientos — (1) cómo estamos ganando · (2) cómo se comporta el margen · (3) dónde perdemos · (4) por qué ·
 * (5) cómo recuperamos — TODO reusado (KPIs de cartera · concentración del MOTOR · focos del diagnose): una
 * verdad, cero cálculo nuevo. El narrador recibe kind "resumen_ejecutivo" + el arco como directiva (formato
 * madre: "Estamos ganando por X, pero el margen se comporta así. Perdemos en Y por Z. La primera acción es A,
 * con impacto B."). El det floor ya cuenta esa historia con etiquetas de negocio. */
export function composeSpecResumenEjecutivo({ scenario } = {}) {
  const cv = _load("clientesVentas", scenario), cm = _load("clientesMargen", scenario);
  if (!cv.length || !cm.length) return null;
  const _s = (a, f) => a.reduce((s, r) => s + (typeof r[f] === "number" ? r[f] : 0), 0);
  const ventasK = _s(cv, "actual"), antK = _s(cv, "anterior"), ventaBaseK = _s(cm, "venta"), contribK = _s(cm, "contribucion");
  const margenProm = ventaBaseK ? +((contribK / ventaBaseK) * 100).toFixed(1) : 0;
  const varPct = antK ? +(((ventasK - antK) / antK) * 100).toFixed(1) : null;
  const bench = benchmarkOf(null);
  // (1) quién sostiene: concentración del MOTOR (80/20 real) + top contribución
  const conV = concentracion(cv.map((r) => ({ nombre: r.nombre, valor: Number(r.actual) || 0 })), 0.8);
  const topC = cm.slice().sort((a, b) => b.contribucion - a.contribucion).slice(0, 3);
  // (2) el margen de la cartera: los grandes y su margen · cuántos bajo la vara · dónde vive el margen sano
  const grandes = cm.slice().sort((a, b) => b.venta - a.venta).slice(0, 3);
  const bajoVara = cm.filter((r) => r.margen < (typeof r.benchmark === "number" ? r.benchmark : bench));
  const sanos = cm.slice().sort((a, b) => b.margen - a.margen).slice(0, 2);
  // (3)(4)(5) las fugas, sus causas y la palanca: los focos del diagnose (una verdad)
  const diag = composeSpecDiagnose({ filters: {}, scenario });
  const F = (diag && diag.evidence && diag.evidence.findings) || [];
  const by = (d) => F.find((x) => x.detector === d);
  const mg = by("margen"), cg = by("carga"), cap = by("capital");
  const cgTopRow = cg && cg.items[0] ? cm.find((r) => r.nombre === cg.items[0].entidad) : null;

  // (3) CÓMO ganamos: la COMPOSICIÓN — bloque de volumen (top-3 por venta) vs el resto de la cartera (calidad):
  // contribución y margen ponderado de cada bloque, todo derivado de las mismas filas (una verdad).
  const gNames = new Set(grandes.map((r) => r.nombre));
  const resto = cm.filter((r) => !gNames.has(r.nombre));
  const cGr = _s(grandes, "contribucion"), vGr = _s(grandes, "venta");
  const cRe = _s(resto, "contribucion"), vRe = _s(resto, "venta");
  const pctGr = contribK ? Math.round((cGr / contribK) * 100) : 0, pctRe = contribK ? 100 - Math.round((cGr / contribK) * 100) : 0;
  const mGr = vGr ? +((cGr / vGr) * 100).toFixed(1) : 0, mRe = vRe ? +((cRe / vRe) * 100).toFixed(1) : 0;

  const b1 = `**Foto general:** vendiste ${_money(ventasK * 1000)}${varPct != null ? ` (${varPct >= 0 ? "+" : ""}${varPct}% vs el año anterior)` : ""}, generaste ${_money(contribK * 1000)} de contribución y cerraste con ${margenProm}% de margen — cartera de ${cm.length} clientes, ${F.length ? `${F.length} ${F.length === 1 ? "foco" : "focos"} de fuga abiertos` : "sin fugas materiales"}.`;
  const b2 = `**Dónde estamos ganando:** la venta la sostienen ${conV.cantidadEntidades} de ${cv.length} clientes (${conV.totalCubiertoPct}%); la contribución la lideran ${topC.map((r) => `${r.nombre} (${_money(r.contribucion * 1000)})`).join(", ")}.`;
  const b3 = `**Cómo estamos ganando:** no es solo volumen — los tres grandes (${grandes.map((r) => r.nombre).join(", ")}) ponen el ${pctGr}% de la contribución con margen ${mGr}%; el resto de la cartera pone el ${pctRe}% con margen ${mRe}%. ${mRe > mGr ? "La calidad vive en las cuentas medianas: el mix es lo que sostiene el margen." : "El volumen de los grandes también trae la calidad."}`;
  const b4 = `**Cómo se comporta el margen:** el promedio (${margenProm}%) ${margenProm < bench ? "corre bajo" : "está sobre"} tu piso (${bench}%). Los que más venden dejan menos: ${grandes.map((r) => `${r.nombre} ${r.margen}%`).join(", ")} — ${bajoVara.length} de ${cm.length} clientes están bajo la vara. El margen sano vive en ${sanos.map((r) => `${r.nombre} (${r.margen}%)`).join(" y ")}: la cartera crece, pero parte del margen se diluye en los grandes.`;
  const fugas = [];
  if (mg) fugas.push(`${_money(mg.subtotal_usd)} de contribución no capturada vs benchmark (top: ${mg.items.slice(0, 3).map((i) => `${i.entidad} ${_money(i.usd)}`).join(", ")})`);
  if (cg) fugas.push(`${_money(cg.subtotal_usd)} de carga comercial sobre el target`);
  if (cap) fugas.push(`${_money(cap.subtotal_usd)} de capital detenido en ${cap.items.length} SKU`);
  const b5 = fugas.length
    ? `**Dónde estamos perdiendo:** ${fugas.join(" · ")}.`
    : `**Dónde estamos perdiendo:** sin fugas materiales en este corte — todo sobre benchmark y con el capital rotando.`;
  const causas = [];
  if (mg) causas.push("la contribución se escapa porque los grandes venden bajo el piso (precio/mix, no un costo puntual)");
  if (cg) causas.push(`la carga corre sobre el target de ${POLICY.targetCarga}% (rebates y descuentos${cgTopRow ? ` — ${cgTopRow.nombre} carga ${cgTopRow.pctRebate}%` : ""})`);
  if (cap) causas.push("el capital está detenido en SKU que no rotan");
  const b6 = causas.length ? `**Por qué está pasando:** ${causas.join("; ")}.` : "";
  const f1 = F[0], f2 = F[1];
  // (7) recuperación con IMPACTO CUANTIFICADO por acción (el ejemplo del owner: "bajar de 4.5% a 3.5% recupera ~$194K")
  const cargaDetalle = cg && cg.items[0] && cgTopRow
    ? `bajar la carga de ${cg.items[0].entidad} (${cgTopRow.pctRebate}%) al target (${POLICY.targetCarga}%) recupera ${_money(cg.items[0].usd)} al año`
    : null;
  let b7 = "";
  if (f1) {
    const acc = f1.detector === "carga"
      ? (cargaDetalle || "renegociar la carga comercial — recuperás margen sin resignar venta")
      : f1.detector === "margen"
        ? `revisar precio y mix de ${f1.items[0] ? f1.items[0].entidad : "los grandes"}${f1.items[0] ? ` (${_money(f1.items[0].usd)} en juego de los ${_money(f1.subtotal_usd)})` : ""}`
        : "liberar los SKU sin rotar (liquidación puntual)";
    const despues = f2
      ? (f2.detector === "carga" && cargaDetalle ? `; después la carga: ${cargaDetalle} (${_money(f2.subtotal_usd)} el total)` : `; después revisa ${f2.titulo.toLowerCase()} (${_money(f2.subtotal_usd)})`)
      : "";
    b7 = `**Cómo recuperamos:** primero ${acc}${despues}.`;
  }
  // (8) la PRÓXIMA DECISIÓN: el cierre ejecutivo (pregunta accionable desde los dos focos que más pesan)
  const _dec = (f) => !f ? null
    : f.detector === "margen" ? `recuperar margen en ${f.items[0] ? f.items[0].entidad : "los grandes"}`
    : f.detector === "carga" ? "renegociar la carga comercial"
    : "liberar el capital inmovilizado";
  const d1 = _dec(f1), d2 = _dec(f2);
  const b8 = d1 ? `**Próxima decisión:** ¿partimos por ${d1}${d2 ? ` o por ${d2}` : ""}?` : "";
  const opener = [b1, b2, b3, b4, b5, b6, b7, b8].filter(Boolean).join("\n\n");
  // BOLETA rica: el núcleo obligatorio (KPIs + subtotales de foco vía la boleta del diagnose) + el resto autorizado
  const bol = [
    fig("Ventas del período", _money(ventasK * 1000), { unit: "money", raw: ventasK * 1000, mandatory: true, context: "resumen ejecutivo" }),
    fig("Contribución", _money(contribK * 1000), { unit: "money", raw: contribK * 1000, mandatory: true, context: "resumen ejecutivo" }),
    fig("Margen promedio", `${margenProm}%`, { unit: "pct", raw: margenProm, mandatory: true, context: "resumen ejecutivo" }),
    fig("Piso de margen", `${bench}%`, { unit: "pct", raw: bench, mandatory: false, context: "la vara" }),
    fig("Target de carga", `${POLICY.targetCarga}%`, { unit: "pct", raw: POLICY.targetCarga, mandatory: false, context: "la vara" }),
  ];
  if (varPct != null) bol.push(fig("Ventas vs año anterior", `${varPct >= 0 ? "+" : ""}${varPct}%`, { unit: "pct", raw: varPct, mandatory: false, context: "resumen ejecutivo" }));
  for (const r of topC) bol.push(fig(`${r.nombre} · Contribución`, _money(r.contribucion * 1000), { unit: "money", raw: r.contribucion * 1000, mandatory: false, context: "quién sostiene" }));
  for (const r of grandes) bol.push(fig(`${r.nombre} · Margen`, `${r.margen}%`, { unit: "pct", raw: r.margen, mandatory: false, context: "los grandes" }));
  for (const r of sanos) bol.push(fig(`${r.nombre} · Margen`, `${r.margen}%`, { unit: "pct", raw: r.margen, mandatory: false, context: "margen sano" }));
  if (cgTopRow) bol.push(fig(`${cgTopRow.nombre} · Carga`, `${cgTopRow.pctRebate}%`, { unit: "pct", raw: cgTopRow.pctRebate, mandatory: false, context: "causa de carga" }));
  // la COMPOSICIÓN (cómo ganamos): los bloques volumen vs calidad, autorizados
  bol.push(fig("Contribución de los grandes", `${pctGr}%`, { unit: "pct", raw: pctGr, mandatory: false, context: "composición" }));
  bol.push(fig("Contribución del resto", `${pctRe}%`, { unit: "pct", raw: pctRe, mandatory: false, context: "composición" }));
  bol.push(fig("Margen de los grandes", `${mGr}%`, { unit: "pct", raw: mGr, mandatory: false, context: "composición" }));
  bol.push(fig("Margen del resto", `${mRe}%`, { unit: "pct", raw: mRe, mandatory: false, context: "composición" }));
  if (diag && diag.evidence && Array.isArray(diag.evidence.boleta)) bol.push(...diag.evidence.boleta);
  return {
    opener,
    suggestions: (diag && diag.suggestions) || null,
    sentrixAction: null,
    evidence: { lens: "diagnostico", metrica: "diagnose", dimension: "cliente", kind: "resumen_ejecutivo", boleta: bol, findings: F },
  };
}

/* ── composeSpecInventory · FOCO INVENTARIO (owner 2026-07-06: "la pregunta manda el foco") ──────────────────
 * La pregunta elige LA PUNTA que lidera la respuesta (mismo motor sellado diagnoseInventario · UNA verdad):
 *   · frenado    → capital inmovilizado ("¿dónde está mi capital dormido?")   · plata atrapada
 *   · quiebre    → reposición urgente   ("¿qué reponer?, ¿qué se corta?")     · venta que se pierde por falta de stock
 *   · sobrestock → exceso               ("¿dónde sobra inventario?")           · cobertura excesiva
 *   · stale      → sin rotación N días  ("¿qué SKU llevan +90 días parados?")  · filtro por díasSinVenta
 * Cada foco: lectura → por bodega/familia → por SKU → por qué (umbrales POLICY) → qué hacer → CONTRApunta honesta (la otra
 * punta material, "no es lo único"). Boleta rica: las 4 puntas siempre autorizadas. Data-driven de skuInventario; el
 * `focus`/`staleDays` los infiere el cliente del texto (safety-net) o el LLM. null → el seam degrada honesto. */
const _ESTADO_LABEL = { capital_frenado: "capital detenido", riesgo_quiebre: "riesgo de quiebre", sobrestock: "sobrestock", capital_sano: "capital sano" };
const _ESTADO_ORDEN = ["capital_frenado", "riesgo_quiebre", "sobrestock", "capital_sano"];
const _FOCUS_ESTADO = { frenado: "capital_frenado", quiebre: "riesgo_quiebre", sobrestock: "sobrestock" };
const _ESTADO_COLOR = { capital_frenado: "amber", riesgo_quiebre: "red", sobrestock: "cyan", capital_sano: "green" };
// SKU de un estado (map a la forma del panel) · agrupaciones por bodega/familia (share del total del FOCO)
const _skusOf = (D, est, critById) => D.perSku.filter((s) => s.estado === est)
  .map((s) => ({ sku: s.sku, usd: s.capital, doh: s.doh, rotacion: s.rotacion, bodega: s.bodega || "—", familia: s.familia, diasSinVenta: s.diasSinVenta, critico: !!critById[s.sku] }))
  .sort((a, b) => b.usd - a.usd);
// _reconcilePercents(rows, total) → rows + .pct ENTERO cuya SUMA siempre cierra en 100 (si total>0) — método del
// MAYOR RESTO (Hamilton/Hare): redondeo hacia abajo para todas las filas, y el déficit hasta 100 se reparte de a 1
// punto a quienes más resto perdieron al truncar. Owner 2026-08-02: "el porcentaje debe reconciliar con el total
// mostrado y cerrar en 100% considerando redondeos" — un Math.round independiente por fila NO lo garantiza (ej. 3
// filas de 33.3% redondean a 33+33+33=99, o 4 filas de 12.5%/37.5%/25%/25% pueden dar 101 según el caso).
export function _reconcilePercents(rows, total) {
  if (!(total > 0) || !rows.length) return rows.map((r) => ({ ...r, pct: 0 }));
  const withFloor = rows.map((r) => { const raw = (r.usd / total) * 100; return { ...r, pct: Math.floor(raw), _resto: raw - Math.floor(raw) }; });
  let deficit = 100 - withFloor.reduce((s, r) => s + r.pct, 0);
  const byResto = withFloor.slice().sort((a, b) => b._resto - a._resto);
  for (let i = 0; i < byResto.length && deficit > 0; i++, deficit--) byResto[i].pct += 1;
  return withFloor.map(({ _resto, ...r }) => r);
}
const _groupBy = (skus, field, total) => { const m = {}; for (const s of skus) m[s[field]] = (m[s[field]] || 0) + s.usd; const rows = Object.entries(m).map(([nombre, usd]) => ({ nombre, usd })).sort((a, b) => b.usd - a.usd); return _reconcilePercents(rows, total); };
// la punta más material DISTINTA del foco → el cierre honesto ("no es lo único")
function _contrapunta(D, focusEst) {
  if (focusEst !== "riesgo_quiebre" && D.quiebreMaterial && D.dist.riesgo_quiebre && D.dist.riesgo_quiebre.usd > 0) {
    const dd = D.dist.riesgo_quiebre;
    return { estado: "riesgo_quiebre", label: "riesgo de quiebre", usd: dd.usd, pct: dd.pct, count: dd.count, color: "red", familias: _groupBy(D.perSku.filter((s) => s.estado === "riesgo_quiebre").map((s) => ({ usd: s.capital, familia: s.sfamilia || s.familia })), "familia", dd.usd) };
  }
  if (focusEst !== "capital_frenado" && D.dist.capital_frenado && D.dist.capital_frenado.usd > 0) {
    const dd = D.dist.capital_frenado;
    return { estado: "capital_frenado", label: "capital detenido", usd: dd.usd, pct: dd.pct, count: dd.count, color: "amber", familias: _groupBy(D.perSku.filter((s) => s.estado === "capital_frenado").map((s) => ({ usd: s.capital, familia: s.sfamilia || s.familia })), "familia", dd.usd) };
  }
  return null;
}

export function composeSpecInventory({ filters = {}, scenario, focus = "frenado", staleDays = null, entityScope = null, limit = null } = {}) {
  const kSF = _sf("capital", "sku"), rSF = _sf("rotacion", "sku"), dSF = _sf("doh", "sku");
  if (!kSF || !rSF || !dSF) return null;
  const rows = _scopeRows(_load(kSF.source, scenario), filters, entityScope);   // "de esos SKU, ¿cuáles frenados?" respeta el alcance heredado
  if (!rows.length) return null;
  const key = (SOURCES[kSF.source] && SOURCES[kSF.source].keyField) || "sku";
  // ── CRUCE ranking×inventario (owner 2026-07-09: "inventario disponible de los 5 principales SKU de ventas" caía
  // en el foco default de capital frenado — respuesta coherente pero de OTRA pregunta). Los top-N vendedores CON su
  // stock: venta (skusMargen) × inventario (skuInventario) unidos por SKU. La lectura usa el ESTADO del motor
  // (Activo/Lento/90d…), no umbrales nuevos — una verdad. ──
  if (focus === "top_sellers") {
    const N = Math.min(Math.max(Number(limit) || 5, 3), 10);
    const ventaRows = _scopeRows([..._skusM], filters, entityScope).sort((a, b) => (b.venta || 0) - (a.venta || 0)).slice(0, N);
    if (!ventaRows.length) return null;
    const invBy = {}; for (const r of rows) invBy[r[key]] = r;
    const lines = [], bol = [], alertas = [];
    for (const s of ventaRows) {
      const iv = invBy[s.nombre];
      if (!iv) { lines.push(`• ${s.nombre}: vende ${_money(s.venta * 1000)} — sin registro de inventario en este dataset.`); continue; }
      const flag = iv.alerta === "crit" ? " · CRÍTICO" : (iv.estado && iv.estado !== "Activo" ? ` · ${iv.estado}` : "");
      lines.push(`• ${s.nombre}: vende ${_money(s.venta * 1000)} — stock ${iv.stockUnd} unidades (${_money(iv.stockUSD)}), ${Math.round(iv.doh)} días de inventario${flag}`);
      bol.push(fig(`${s.nombre} · Venta`, _money(s.venta * 1000), { unit: "money", raw: s.venta * 1000, mandatory: false, context: "top vendedores × inventario" }));
      bol.push(fig(`${s.nombre} · Stock`, _money(iv.stockUSD), { unit: "money", raw: iv.stockUSD, mandatory: false, context: "top vendedores × inventario" }));
      if (iv.alerta !== "ok" || (iv.estado && iv.estado !== "Activo")) alertas.push({ sku: s.nombre, estado: iv.estado, doh: Math.round(iv.doh) });
    }
    const lectura = alertas.length
      ? `Ojo acá: ${alertas.map((a) => `${a.sku} está ${a.estado} (${a.doh} días de inventario para lo que vende)`).join(" · ")} — cuando tu producto de mayor venta se frena, el capital queda detenido justo donde más pesa.`
      : `Los ${ventaRows.length} tienen stock sano para su ritmo de venta — sin quiebres ni frenos a la vista.`;
    return {
      opener: `Tus ${ventaRows.length} SKU que más venden, con su inventario disponible:\n\n${lines.join("\n")}\n\n${lectura}`,
      suggestions: ["¿Qué SKU está en riesgo de quiebre?", "El capital detenido en detalle", "Margen por SKU"],
      sentrixAction: null,
      evidence: { metrica: "ventas", dimension: "sku", boleta: bol },
    };
  }
  // ── LOS MÁS VENDIDOS DEL MES (invitado en prod 2026-07-09: "los 5 SKU más vendidos en el último mes" respondía
  // el AÑO sin declarar el cambio de período — y el movimiento del mes SÍ existe en unidades). Honesto: unidades
  // reales del mes + stock actual; el corte en $ mensual por SKU se declara como límite (ERP). ──
  if (focus === "mas_vendidos_mes") {
    const N = Math.min(Math.max(Number(limit) || 5, 3), 10);
    const byMes = rows.filter((r) => typeof r.vendidoMes === "number").sort((a, b) => b.vendidoMes - a.vendidoMes).slice(0, N);
    if (!byMes.length) return null;
    const lines = [], bol = [];
    for (const r of byMes) {
      lines.push(`• ${r[key]}: ${r.vendidoMes} unidades vendidas el último mes — stock ${r.stockUnd} unidades (${_money(r.stockUSD)}), ${Math.round(r.doh)} días de inventario`);
      bol.push(fig(`${r[key]} · Vendido en el mes`, String(r.vendidoMes), { unit: "count", raw: r.vendidoMes, mandatory: false, context: "más vendidos del mes (unidades)" }));
      bol.push(fig(`${r[key]} · Stock`, _money(r.stockUSD), { unit: "money", raw: r.stockUSD, mandatory: false, context: "más vendidos del mes" }));
    }
    return {
      opener: `Tus ${byMes.length} SKU más vendidos del último mes (movimiento real, en unidades):\n\n${lines.join("\n")}\n\nEl corte en $ del mes por SKU se enciende con el histórico del ERP — no lo estimo. Lo que SÍ tengo completo es la venta anual por SKU en $, si te sirve ese ángulo.`,
      suggestions: ["Los SKU que más venden en el año", "¿Qué SKU está en riesgo de quiebre?", "Margen por SKU"],
      sentrixAction: null,
      evidence: { metrica: "ventas", dimension: "sku", boleta: bol },
    };
  }
  // DIAGNÓSTICO COMPLETO por el motor sellado (las 4 puntas + por bodega + por familia + materialidad) · UNA verdad.
  const D = diagnoseInventario(rows, { capitalField: kSF.field });
  const critById = {}; for (const r of rows) critById[r[key]] = r.alerta === "crit";
  const P = POLICY;
  // ── ESTADO GENERAL · la foto completa (auditoría de asks 2026-07-15: "Ver todo el inventario" — el tramo VERDE
  // del mapa del capital — abría con el capital detenido; el usuario pidió TODO): total → cómo se reparte en las
  // 4 puntas del motor (suman exacto) → lo sano declarado → qué mirar primero. Misma verdad (D.dist · POLICY). ──
  if (focus === "estado") {
    const _ORDEN_E = ["capital_sano", "riesgo_quiebre", "sobrestock", "capital_frenado"];
    const _LBL_E = { capital_sano: "rotando en rango", riesgo_quiebre: "en riesgo de quiebre", sobrestock: "en sobrestock", capital_frenado: "detenido" };
    const dd = (e) => D.dist[e] || { usd: 0, count: 0, pct: 0 };
    const partes = _ORDEN_E.filter((e) => dd(e).usd > 0).map((e) => `${_money(dd(e).usd)} ${_LBL_E[e]} (${dd(e).count} SKU)`);
    const sano = dd("capital_sano"), fren = dd("capital_frenado"), quie = dd("riesgo_quiebre"), sobre = dd("sobrestock");
    const scName = filters.bodega || filters.familia || filters.marca || null;
    const lines = [
      `${scName ? `En ${scName} tienes` : "Tienes"} ${_money(D.total)} de capital en inventario (${rows.length} SKU): ${partes.join(" · ")}.`,
      sano.usd ? `**Lo que trabaja:** ${_money(sano.usd)} (${sano.pct}%) rota dentro de tu benchmark (rotación sobre ${P.rotacionMin}x y cobertura bajo ${P.dohMax} días).` : "",
      fren.usd ? `**Lo primero:** ${_money(fren.usd)} detenidos en ${fren.count} SKU sin rotación — liberarlos devuelve ese capital a caja.` : "",
      quie.usd ? `**Lo urgente:** ${_money(quie.usd)} en ${quie.count} SKU con riesgo de quiebre — rotan rápido y la cobertura no alcanza hasta la próxima compra; reponer antes del corte.` : "",
      sobre.usd ? `**Para ajustar:** ${_money(sobre.usd)} en sobrestock — venden, pero con más cobertura de la necesaria; frenar la próxima compra drena el exceso.` : "",
      !fren.usd && !quie.usd ? `Sin capital detenido ni quiebres a la vista — el inventario corre sano.` : "",
    ];
    const bolE = [fig("Capital en inventario · total", _money(D.total), { unit: "money", raw: D.total, mandatory: true, context: "estado del inventario" })];
    for (const e of _ORDEN_E) if (dd(e).usd > 0) bolE.push(fig(`Estado del inventario: ${_ESTADO_LABEL[e]}`, _money(dd(e).usd), { unit: "money", raw: dd(e).usd, mandatory: false, context: "estado del inventario" }));
    return {
      opener: lines.filter(Boolean).join("\n\n"),
      suggestions: [fren.usd ? "¿Dónde está detenido mi capital?" : null, quie.usd ? "¿Qué reponer por quiebre?" : null, "Los SKU que más venden en el año"].filter(Boolean),
      sentrixAction: null,
      evidence: { lens: "inventory", metrica: "capital", dimension: "sku", boleta: bolE },
    };
  }
  // ── despacho por FOCO → arma el bloque narrativo (lede + partes + contrapunta) ──
  let B;
  if (focus === "stale") {
    const th = typeof staleDays === "number" && staleDays > 0 ? staleDays : 90;
    const skus = D.perSku.filter((s) => typeof s.diasSinVenta === "number" && s.diasSinVenta > th)
      .map((s) => ({ sku: s.sku, usd: s.capital, doh: s.doh, rotacion: s.rotacion, bodega: s.bodega || "—", familia: s.familia, diasSinVenta: s.diasSinVenta, critico: !!critById[s.sku] }))
      .sort((a, b) => b.diasSinVenta - a.diasSinVenta);
    if (!skus.length) return null;
    const total = skus.reduce((a, s) => a + s.usd, 0), byBod = _groupBy(skus, "bodega", total);
    B = {
      focusEst: "capital_frenado", color: "amber", title: `Sin rotación · SKU parados +${th}d`, ctx: `SKU sin venta ${th}+ días`, total, skus, byBod, dim: "sku",
      lines: [
        `Hay ${skus.length} SKU sin una sola venta en más de ${th} días — ${_money(total)} de capital parado: ${skus.slice(0, 4).map((s) => `${s.sku} (${s.diasSinVenta}d)`).join(" · ")}.`,
        byBod.length > 1 ? `Por bodega: ${byBod.map((b) => `${b.nombre} ${_money(b.usd)}`).join(" · ")}.` : "",
        `**Por qué:** ${th}+ días sin salida — cambió el precio, la ubicación o la demanda. Es el capital más frío del inventario: no rota y no da señales de que vaya a rotar.`,
        `**Qué hacer:** revisa precio o reasignación de ${skus.slice(0, 2).map((s) => s.sku).join(" y ")}; si no se mueven, liquidá para recuperar ese capital antes de que envejezca más.`,
      ],
      suggestions: ["Qué SKU libero primero", "Ver todo el inventario"],
    };
  } else {
    const est = _FOCUS_ESTADO[focus] || "capital_frenado";
    const skus = _skusOf(D, est, critById);
    // EL MONTO AUNQUE NO HAYA DETENIDO (revisión de contrato de la Mesa 2026-07-14: «¿Cuánto capital tengo en
    // Concepción?» respondía "no veo capital detenido" SIN el monto): con alcance declarado (bodega/familia/
    // marca/cliente), la pregunta pide el ESTADO del capital de ese alcance — se responde el total y su salud
    // contra la vara (las puntas del motor, una verdad), no solo el vacío. Sin alcance, el vacío global sigue
    // degradando honesto en el seam.
    if (!skus.length && est === "capital_frenado") {
      const _scName = filters.bodega || filters.familia || filters.marca || filters.cliente;
      if (_scName) {
        const totalCap = rows.reduce((a, r) => a + (typeof r[kSF.field] === "number" ? r[kSF.field] : 0), 0);
        const puntas = [];
        if (D.dist.riesgo_quiebre && D.dist.riesgo_quiebre.usd) puntas.push(`${_money(D.dist.riesgo_quiebre.usd)} en riesgo de quiebre (rota rápido y la cobertura no alcanza)`);
        if (D.dist.sobrestock && D.dist.sobrestock.usd) puntas.push(`${_money(D.dist.sobrestock.usd)} en sobrestock (rota, pero con más cobertura de la necesaria)`);
        const bol2 = [fig(`${_scName} · Capital`, _money(totalCap), { unit: "money", raw: totalCap, mandatory: true, context: `capital en ${_scName}` })];
        for (const p2 of [["riesgo_quiebre", "En riesgo de quiebre"], ["sobrestock", "Sobrestock"]])
          if (D.dist[p2[0]] && D.dist[p2[0]].usd) bol2.push(fig(`${_scName} · ${p2[1]}`, _money(D.dist[p2[0]].usd), { unit: "money", raw: D.dist[p2[0]].usd, mandatory: false, context: `capital en ${_scName}` }));
        return {
          // redacción sin ambigüedad (auditoría de asks 2026-07-15: "nada detenido según tu vara (rotación bajo 2x…)"
          // se leía como si ESA fuera la razón — el narrador llegó a invertir el criterio) + benchmark, no vara.
          opener: `En ${_scName} tienes ${_money(totalCap)} de capital en inventario (${rows.length} SKU) y nada detenido: todo rota dentro de tu benchmark (detenido sería rotación bajo ${P.rotacionMin}x o cobertura sobre ${P.dohMax} días).` +
            (puntas.length ? `\n\n**Ojo igual:** ${puntas.join(" · ")} — no es capital detenido, pero conviene mirarlo.` : `\n\nSin señales de quiebre ni sobrestock en ese alcance.`),
          suggestions: ["¿Qué SKU está en riesgo de quiebre?", "Ver todo el inventario"],
          sentrixAction: null,
          evidence: { lens: "inventory", metrica: "capital", dimension: filters.bodega ? "bodega" : "sku", entidad: _scName, boleta: bol2 },
        };
      }
    }
    if (!skus.length) return null;
    const dd = D.dist[est] || { usd: 0, pct: 0, count: 0 };
    const total = dd.usd, byBod = _groupBy(skus, "bodega", total), byFam = _groupBy(skus, "familia", total);
    const topB = byBod[0], crit = skus.filter((s) => s.critico);
    const skuList = skus.slice(0, 4).map((r) => `${r.sku} ${_money(r.usd)} (${r.doh}d DOH, rotación ${r.rotacion}x)`).join(" · ");
    if (est === "riesgo_quiebre") {   // reposición urgente — la venta que se pierde por falta de stock
      B = {
        focusEst: est, color: "red", title: "Riesgo de quiebre · qué reponer ya", ctx: "riesgo de quiebre", total, skus, byBod, byFam, dim: "familia",
        lines: [
          `Necesitan reposición ${_money(total)} en ${skus.length} SKU que se van a cortar${byFam.length ? ` — sobre todo en ${byFam[0].nombre} (${_money(byFam[0].usd)})${byFam[1] ? ` y ${byFam[1].nombre} (${_money(byFam[1].usd)})` : ""}` : ""}.`,
          byBod.length > 1 ? `Por bodega: ${byBod.map((b) => `${b.nombre} ${_money(b.usd)}`).join(" · ")}.` : "",
          `Los SKU al límite: ${skuList}.`,
          `**Por qué:** rotación alta (≥${P.quiebreRotMin}x) con cobertura corta (DOH ≤ ${P.quiebreDohMax}d) — venden bien pero el stock no alcanza hasta la próxima compra.`,
          `**Qué hacer:** reponé ${skus.slice(0, 2).map((s) => s.sku).join(" y ")} ya. Es venta que estás por perder por falta de producto, no capital detenido — el costo de no hacerlo es la venta que no ocurre.`,
        ],
        suggestions: ["Qué SKU detenidos libero", "Ver todo el inventario"],
      };
    } else if (est === "sobrestock") {   // exceso — cobertura excesiva, plata inmovilizada de más
      B = {
        focusEst: est, color: "cyan", title: "Sobrestock · dónde sobra inventario", ctx: "sobrestock", total, skus, byBod, byFam, dim: "bodega",
        lines: [
          `Tienes ${_money(total)} en ${skus.length} SKU con sobrestock — venden, pero la cobertura es excesiva (DOH entre ${P.sobrestockDohMin} y ${P.dohMax}d)${topB ? `. Se concentra en ${topB.nombre} (${_money(topB.usd)})` : ""}.`,
          byBod.length > 1 ? `Por bodega: ${byBod.map((b) => `${b.nombre} ${_money(b.usd)}`).join(" · ")}.` : "",
          `Los SKU con más cobertura: ${skuList}.`,
          `**Por qué:** rotan dentro de rango, pero tienes más meses de stock de los necesarios. Es capital inmovilizado de más — no está detenido como el que no rota, pero podría estar trabajando.`,
          `**Qué hacer:** frená la próxima compra de ${skus.slice(0, 2).map((s) => s.sku).join(" y ")} y deja que la venta drene el exceso. No hace falta liquidar; sí ajustar la reposición.`,
        ],
        suggestions: ["Qué SKU están detenidos", "Qué reponer por quiebre"],
      };
    } else {   // frenado (default) — capital inmovilizado, plata atrapada
      // COHERENCIA (owner 2026-07-15): el "arrancá por" y el "cuánto vale" hablan del MISMO par de SKU — antes la
      // recomendación nombraba los críticos (LG+MAK) y el $ cuantificaba los 2 de más capital (LG+BOS): dos grupos
      // distintos en una misma respuesta, y el narrador los fundía ("los que más retienen" — falso). El arranque son
      // los críticos si los hay (la razón se declara: rotación más baja y más días sin venta), si no los de más capital.
      const arranque = crit.length ? crit.slice(0, 2) : skus.slice(0, 2);
      B = {
        focusEst: est, color: "amber", title: "Capital inmovilizado · dónde está detenido tu capital", ctx: "capital inmovilizado", total, skus, byBod, byFam, dim: "bodega", arranque,
        lines: [
          `Tienes ${_money(total)} de capital inmovilizado en ${skus.length} SKU sin rotar. Se concentra en ${topB.nombre} (${_money(topB.usd)}, ${topB.pct}%).`,
          `Por bodega: ${byBod.map((b) => `${b.nombre} ${_money(b.usd)}`).join(" · ")}.`,
          byFam.length ? `Por familia lo carga ${byFam[0].nombre} (${_money(byFam[0].usd)})${byFam[1] ? ` y ${byFam[1].nombre} (${_money(byFam[1].usd)})` : ""}.` : "",
          `Los SKU que lo explican: ${skuList}.`,
          `**Por qué:** dejaron de rotar — rotación bajo ${P.rotacionMin}x o DOH sobre ${P.dohMax}d. Es stock que no sale y deja el capital detenido.`,
          `**Qué hacer:** arranca por ${arranque.map((r) => r.sku).join(" y ")} (${crit.length ? "los críticos: la rotación más baja y más días sin venta" : "los de más capital detenido"}) — liquidación o reasignación libera ese capital para SKU que sí rotan; después revisa la reposición para no repetirlo.`,
        ],
        suggestions: ["Por qué el capital está detenido", "Qué SKU libero primero"],
      };
    }
  }
  // ── CUÁNTO VALE (asesor): liberar el MISMO par del "arrancá por" = $ que vuelve a caja (suma directa de su
  // capital · grupos que cierran: el $ cuantifica exactamente los SKU que la recomendación nombra) ──
  let lever2 = null;
  if (B.focusEst === "capital_frenado" && B.skus.length >= 1) {
    const t2 = (B.arranque && B.arranque.length ? B.arranque : B.skus.slice(0, 2));
    lever2 = { skus: t2.map((s) => s.sku), usd: t2.reduce((a, s) => a + s.usd, 0) };
    B.lines.push(`**Cuánto vale:** liberar ${lever2.skus.join(" y ")} devuelve ${_money(lever2.usd)} a caja — capital que hoy no trabaja.`);
  }
  // ── CONTRApunta honesta: la otra punta material (sin esto la respuesta es media historia) ──
  const cp = _contrapunta(D, B.focusEst);
  if (cp) B.lines.push(`**No es lo único — hay otra punta:** ${_money(cp.usd)} (${cp.pct}% del inventario) en ${cp.label}${cp.familias && cp.familias.length ? `, sobre todo en ${cp.familias[0].nombre}` : ""} — ${cp.estado === "riesgo_quiebre" ? "SKU que rotan rápido con poca cobertura y se van a cortar" : "SKU que no rotan y retienen el capital"}. Es capital mal repartido: sobra donde no vende y falta donde sí.`);
  // ── boleta rica: total del foco + grupos + SKU + LAS 4 PUNTAS autorizadas (narración selectiva · el guard no deja inventar otra) ──
  const estados = _ESTADO_ORDEN.filter((e) => D.dist[e]).map((e) => ({ estado: e, label: _ESTADO_LABEL[e], usd: D.dist[e].usd, pct: D.dist[e].pct, count: D.dist[e].count }));
  const bol = [fig(`${B.title.split(" ·")[0]} · total`, _money(B.total), { unit: "money", raw: B.total, mandatory: true, context: B.ctx })];
  // % DEL TOTAL (owner 2026-08-02: "cifra autorizada y determinística... nunca por el narrador") — byBod YA viene
  // reconciliado a 100% (_groupBy → _reconcilePercents). Cada bodega expone Capital Y % como cifras AUTORIZADAS
  // separadas: el narrador cita números ya calculados, no divide él mismo (numberGuard rechaza si inventa otro).
  // Con SOLO 1 bodega el % sería 100% siempre — trivial, no informativo, y (hallazgo en vivo) invitaba al narrador
  // a armar una "tabla" de una sola fila pese a instruccion_tabla/instruccion_columnas_capital pidiendo lo contrario
  // ("si solo existe una entidad... no fuerces una tabla"). Solución estructural, no de prompt: si hay 1 sola
  // bodega, esa entidad NO tiene 2do concepto (solo Capital, sin %) → _needsTableFormat ya no puede confundirse.
  // EL CONCEPTO DE LA ETIQUETA ES EL DEL FOCO, NO SIEMPRE "Capital detenido" (owner 2026-08-09, certificación de
  // la pregunta «los quiebres próximos son $36K, ¿en qué SKU?»). Acá vivía el literal `· Capital detenido` para
  // TODOS los focos, así que con focus:"quiebre" el ledger emitía «Santiago · Capital detenido $30K» — y en el
  // MISMO ledger convivía «Estado del inventario: capital detenido $33K». Dos dueños distintos bajo las mismas
  // palabras: medido sobre el dato, Santiago tiene $0 de capital detenido (los tres SKU frenados están en
  // Valparaíso y Antofagasta) y $30K en riesgo de quiebre. La frase «Santiago tiene $30K de capital detenido»
  // es FALSA y pasaba guardC entera — el canon `money:$30K` está autorizado y el binding semántico lee la
  // ETIQUETA, así que la etiqueta equivocada autorizaba la afirmación equivocada. El concepto sale ahora del
  // estado que el foco realmente está mirando (`_ESTADO_LABEL`, la MISMA fuente que ya nombra las 4 puntas —
  // no un segundo diccionario). Para `frenado`/`stale` (focusEst "capital_frenado") el resultado es
  // BYTE-IDÉNTICO al anterior: "Capital detenido".
  const _CONCEPTO = _ESTADO_LABEL[B.focusEst] || "capital detenido";
  const _CONCEPTO_LBL = _CONCEPTO.charAt(0).toUpperCase() + _CONCEPTO.slice(1);
  const _bodMultiple = (B.byBod || []).length >= 2;
  for (const b of (B.byBod || [])) {
    bol.push(fig(`${b.nombre} · ${_CONCEPTO_LBL}`, _money(b.usd), { unit: "money", raw: b.usd, mandatory: false, context: B.ctx }));
    if (_bodMultiple) bol.push(fig(`${b.nombre} · % del total`, `${b.pct}%`, { unit: "pct", raw: b.pct, mandatory: false, source: "computed", formula: "capital de la bodega / total del foco × 100 (reconciliado a 100%)", context: B.ctx }));
  }
  for (const f of (B.byFam || []).slice(0, 3)) bol.push(fig(`${f.nombre} · Familia`, _money(f.usd), { unit: "money", raw: f.usd, mandatory: false, context: B.ctx }));
  // SKU: top-4 + Resto (si hay más de 4) — mismo patrón que buildGrid (entityRecord.js, "pase quirúrgico de
  // confiabilidad" owner 2026-07-29: "en todo top-N, informa 'N de total' y cuantifica el resto") — así el % SIEMPRE
  // reconcilia con el total MOSTRADO (B.total), no solo con la suma de los 4 nombrados, que sería parcial y engañoso.
  const _skuTop = B.skus.slice(0, 4);
  const _skuRestoCount = B.skus.length - _skuTop.length;
  const _skuRows = _skuTop.map((s) => ({ nombre: s.sku, usd: s.usd }));
  if (_skuRestoCount > 0) _skuRows.push({ nombre: `Resto (${_skuRestoCount} de ${B.skus.length})`, usd: B.skus.slice(4).reduce((a, s) => a + s.usd, 0) });
  const _skuMultiple = _skuRows.length >= 2;   // mismo candado estructural que _bodMultiple arriba
  for (const s of _reconcilePercents(_skuRows, B.total)) {
    bol.push(fig(`${s.nombre} · ${_CONCEPTO_LBL}`, _money(s.usd), { unit: "money", raw: s.usd, mandatory: false, context: B.ctx }));
    if (_skuMultiple) bol.push(fig(`${s.nombre} · % del total`, `${s.pct}%`, { unit: "pct", raw: s.pct, mandatory: false, source: "computed", formula: "capital del SKU (o del resto agrupado) / total del foco × 100 (reconciliado a 100%)", context: B.ctx }));
  }
  for (const e of estados) bol.push(fig(`Estado del inventario: ${e.label}`, _money(e.usd), { unit: "money", raw: e.usd, mandatory: false, context: "distribución de inventario" }));
  if (lever2) bol.push(fig(`Medida · liberar ${lever2.skus.join(" y ")}`, _money(lever2.usd), { unit: "money", raw: lever2.usd, mandatory: true, source: "computed", formula: "Σ capital top 2", context: "cuánto vale la medida" }));
  return {
    opener: B.lines.filter(Boolean).join("\n\n"),
    suggestions: B.suggestions,
    sentrixAction: null,
    evidence: { lens: "inventory", metrica: "capital", dimension: B.dim, boleta: bol,
      inventory: { title: B.title, focus, focusColor: B.color, total: B.total,
        byBodega: (B.byBod || []).map((b) => ({ bodega: b.nombre, usd: b.usd, pct: b.pct })),
        bySku: B.skus.map((r) => ({ sku: r.sku, usd: r.usd, doh: r.doh, rotacion: r.rotacion, bodega: r.bodega, diasSinVenta: r.diasSinVenta, critico: r.critico })),
        totalInventario: D.total, estados, contrapunta: cp } },
  };
}

/* ── composeSpecMargin · FOCO MARGEN (owner 2026-07-06 · "la pregunta manda el foco") ────────────────────────
 * Rompe la trampa que el smoke en vivo encontró: el LLM colapsaba TODA pregunta de margen a diagnose → el "genérico de 3
 * focos" (23/25 · respondía otra pregunta). Acá la PREGUNTA elige el foco y el motor responde LO ESPECÍFICO con el dato
 * disponible; si el dato no existe (gap), avisa honesto y ofrece la lente más cercana (nunca el genérico). Reusa
 * diagnoseClientes/diagnoseSkus (patrón económico, gate-probado) + benchmark (POLICY 30.1) + descomposición precio/costo
 * (precioLista/costoMedio) + carga/rebates. Boleta rica (cifras autorizadas). Data-driven vía el contrato (_sf+_load). */
const _p1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const _benchOf = benchmarkOf;   // C.2 · UNA verdad: respeta el CRITERIO del owner (override) → fila → POLICY (antes duplicaba la lógica sin el override)
const _markup = (r) => (r && r.precioLista > 0 ? (r.precioLista - r.costoMedio) / r.precioLista * 100 : null);   // markup sobre lista (%)
const _costShare = (r) => (r && r.precioLista > 0 ? r.costoMedio / r.precioLista * 100 : null);                  // costo como % de la lista
const _mVenta = (v) => _money(v * 1000);   // venta/contribucion en MILES -> $ real (escala del contrato · consistente con ventas y el resumen ejecutivo · NO para stockUSD, que es crudo)
// panel de Sentrix para margen: cada entidad vs la línea de benchmark (la "calidad de la venta" de un vistazo) + descomposición precio/costo
const _MFOCUS_TITLE = { bajo_benchmark: "Margen vs benchmark", alto_volumen_bajo_margen: "Volumen vs margen", causa_precio: "Margen · el precio no da", causa_costo: "Margen · el costo aprieta", subir_precio: "Candidatos a subir precio", alto_margen_subpenetrado: "Alto margen subpenetrado", palancas: "Consumo de margen" };
function _marginPanel(rows, bench, focus) {
  const rr = (rows || []).filter((r) => typeof r.margen === "number")
    .map((r) => {
      const below = r.margen < _benchOf(r);
      // MECANISMO DOMINANTE (turno 9 del veredicto de 18 turnos, owner 2026-07-29 — "diagnostica costo, recomienda
      // precio, sin conectarlos"): solo para entidades BAJO benchmark (sin brecha no hay mecanismo que explicar).
      // MISMO criterio que el detector "carga alta" de _diagComercial (pctRebate > POLICY.targetCarga) — UNA
      // verdad, no una segunda fórmula inventada acá. Si la carga/rebate ya está sobre el target, ESE es el
      // mecanismo que explica la brecha; si no, por eliminación es la relación costo/precio (costo estructural).
      // Antes el narrador tenía que ADIVINAR entre costo/precio/rebate mirando columnas sueltas sin jerarquía.
      const mecanismo = below && typeof r.pctRebate === "number" ? (r.pctRebate > POLICY.targetCarga ? "carga comercial/rebate" : "costo estructural") : null;
      return { nombre: r.nombre || r.sku, margen: r.margen, venta: typeof r.venta === "number" ? r.venta : null, markup: _markup(r), costShare: _costShare(r), below, mecanismo };
    })
    .sort((a, b) => a.margen - b.margen);
  return { title: _MFOCUS_TITLE[focus] || "Margen", bench, focus, showDecomp: focus === "causa_precio" || focus === "causa_costo" || focus === "subir_precio", rows: rr, belowCount: rr.filter((x) => x.below).length, total: rr.length };
}
const _MLBL = { cliente: { s: "cliente", p: "clientes", art: "Los" }, sku: { s: "SKU", p: "SKU", art: "Los" }, familia: { s: "familia", p: "familias", art: "Las" }, marca: { s: "marca", p: "marcas", art: "Las" }, canal: { s: "canal", p: "canales", art: "Los" } };
const _mNombre = (r) => r.nombre || r.sku;
// margen por CANAL (no hay eje contractual · join clientesMargen × clientesVentas.canal · promedio ponderado por venta)
function _marginByCanal(scenario) {
  const mSf = _sf("margen", "cliente"), vSf = _sf("ventas", "cliente");
  if (!mSf || !vSf) return [];
  const mRows = (_load(mSf.source, scenario) || []).filter(Boolean), vRows = (_load(vSf.source, scenario) || []).filter(Boolean);
  const canalBy = {}; for (const v of vRows) canalBy[v.nombre] = v.canal || "—";
  const g = {};
  for (const r of mRows) { const k = canalBy[r.nombre] || "—"; const gg = (g[k] = g[k] || { nombre: k, venta: 0, contribucion: 0, _mw: 0 }); gg.venta += r.venta || 0; gg.contribucion += r.contribucion || 0; gg._mw += (r.margen || 0) * (r.venta || 0); }
  return Object.values(g).map((x) => ({ nombre: x.nombre, venta: x.venta, contribucion: x.contribucion, margen: x.venta ? +(x._mw / x.venta).toFixed(1) : 0, benchmark: POLICY.benchmark }));
}
function _marginRows(dim, scenario) {
  if (dim === "canal") return _marginByCanal(scenario);
  const sf = _sf("margen", dim);
  if (!sf) return [];
  return (_load(sf.source, scenario) || []).filter(Boolean);
}

/* ── PALANCA CUANTIFICADA (asesor · owner 2026-07-06 · Frente A): ponerle $ a cada consejo ────────────────────
 * UNA VERDAD: el "cuánto vale" reusa los DETECTORES del diagnóstico (_diagComercial · mismas cuentas y mismos gates de
 * materialidad ≥4pp / ≥piso $) — el mismo número del resumen ejecutivo y del diagnose, no una segunda fórmula.
 * Para ejes sin detector (sku/marca/familia) el valor es el de 1pp de margen sobre la venta (venta K × 1% × 1000). */
function _leverFoco(scenario, detector, entityScope) {
  const focos = _diagComercial({}, scenario);
  let f = focos.find((x) => x.detector === detector);
  if (!f || !f.items.length) return null;
  if (entityScope && Array.isArray(entityScope.entities) && entityScope.entities.length) {   // "de esos…" → la palanca del subconjunto
    const set = new Set(entityScope.entities.map(String));
    const items = f.items.filter((it) => set.has(String(it.entidad)));
    if (!items.length) return null;
    f = { ...f, items, count: items.length, top: items.slice(0, _DIAG_TOPN), subtotal: items.reduce((s, it) => s + it.usd, 0) };
  }
  return f;
}
const _pp1 = (r) => (r && typeof r.venta === "number" && r.venta > 0 ? Math.round(r.venta * 10) : null);   // 1pp de margen en $ (venta K × 1000 × 1%)
const _figLever = (label, usd, formula, mandatory = false) => fig(label, _money(usd), { unit: "money", raw: usd, mandatory, source: "computed", formula, context: "cuánto vale la medida" });

export function composeSpecMargin({ filters = {}, scenario, focus = "bajo_benchmark", dimension = "cliente", negativo = false, pct = false, gap = null, entityScope = null } = {}) {
  const dim = _MLBL[dimension] ? dimension : "cliente";
  const L = _MLBL[dim];
  let rows = _scopeRows(_marginRows(dim, scenario), filters, entityScope);
  if (!rows.length) return null;
  const bench = _benchOf(rows[0]);
  const totVenta = rows.reduce((a, r) => a + (r.venta || 0), 0);
  const below = rows.filter((r) => typeof r.margen === "number" && r.margen < _benchOf(r)).sort((a, b) => (_benchOf(b) - b.margen) - (_benchOf(a) - a.margen));
  const _gap = (r) => +(_benchOf(r) - r.margen).toFixed(1);
  const _lo = (n) => rows.slice().sort((a, b) => a.margen - b.margen).slice(0, n);
  const _ctx = "margen";
  let lines = [], suggestions = [], bol = [];
  // ORDEN SELLADO por la tool (owner 2026-08-03, "sella facts.orden para marginRead" — pendiente documentado en
  // memoria desde el pase quirúrgico 2026-07-29): mismo patrón que buildGrid/buildTension (entityRecord.js) — el
  // criterio + dirección que la RAMA de foco ya usa (y ya promete en sus `lines`) viaja en `facts.orden` (o
  // `ordenA`/`ordenB` cuando el foco arma DOS rankings independientes, como `palancas`) para que guardC verifique
  // DIRECTO contra la tabla final, sin depender de que el narrador lo repita en prosa. `null` = este foco no arma
  // un ranking clasificable (ej. el pivot de "huecos honestos", 3 candidatos sin promesa de orden).
  let orden = null, ordena = null, ordenB = null;
  // convención de label "Entidad · Concepto" (owner 2026-08-02, hallazgo de auditoría en vivo): antes era
  // "${dimension} · ${entidad} margen" (ej. "cliente · Lider margen") — el prefijo de DIMENSIÓN en vez del nombre
  // de la entidad rompía cualquier detector que agrupe cifras por entidad (_needsTableFormat, narratePromptC.js) y
  // además el LLM a veces copiaba el label crudo tal cual a una tabla ("| Concepto | Valor | cliente · Lider margen
  // | 21.5% |" — un hallazgo separado, pero la misma causa). `label` (1er párametro) queda sin usar — vestigial.
  const figMargin = (_label, r) => fig(`${_mNombre(r)} · Margen`, `${_p1(r.margen)}%`, { unit: "pct", raw: r.margen, mandatory: false, context: _ctx });
  const pushMarginFigs = (list) => { for (const r of list.slice(0, 5)) bol.push(figMargin("", r)); };

  // ── HUECOS honestos (el dato no existe → avisar + pivot a la lente más cercana · NUNCA el genérico) ──
  if (gap) {
    const lo = _lo(3), pivotList = (below.length ? below : lo).slice(0, 3);
    const pivotTxt = pivotList.map((r) => `${_mNombre(r)} ${_p1(r.margen)}%`).join(" · ");
    const GAP = {
      caida: { falta: `margen del período anterior por ${L.s}`, no: `medir la CAÍDA de margen (necesito dos períodos y sólo tengo el actual)`, ofrece: `el NIVEL de margen vs el benchmark ${_p1(bench)}% HOY` },
      sin_serie: { falta: `serie temporal de costo y precio por SKU`, no: `ver "costo creciente / precio estancado" (necesito al menos dos períodos)`, ofrece: `qué SKU tienen el margen más presionado HOY (precio pegado al costo)` },
      proveedor: { falta: `el eje "proveedor" (tengo marca, no proveedor upstream)`, no: `atribuir la presión de margen a un proveedor`, ofrece: `qué MARCAS presionan más el margen (aprox. línea de suministro)` },
      mix_cliente_sku: { falta: `la matriz transaccional cliente×SKU (qué SKU compra cada cliente)`, no: `cruzar cliente×SKU para el peor mix`, ofrece: `los SKU de peor margen por separado (el cruce por cliente no existe en los datos)` },
      vendedor: { falta: `la dimensión "vendedor" (no está en los datos)`, no: `atribuir margen a un vendedor`, ofrece: `qué clientes venden mucho y comprimen el margen (alto volumen, bajo margen)` },
    }[gap];
    lines = [
      `No te puedo ${GAP.no}: falta ${GAP.falta}. No lo invento.`,
      `Lo más cercano que SÍ tengo es ${GAP.ofrece}: ${pivotTxt}${below.length ? ` — ${below.length} de ${rows.length} ${L.p} bajo el benchmark ${_p1(bench)}%` : ""}.`,
      `¿Quieres que arranque por ahí?`,
    ];
    pushMarginFigs(pivotList);
    suggestions = [gap === "proveedor" ? "Margen por marca" : gap === "mix_cliente_sku" ? "Peor SKU por margen" : `${L.p} bajo el benchmark`, "Acciones para recuperar margen"];
    return { opener: lines.filter(Boolean).join("\n\n"), suggestions, sentrixAction: null, evidence: { lens: "margin", metrica: "margen", dimension: dim, boleta: bol, margin: { focus: "gap:" + gap, bench, panel: _marginPanel(rows, bench, "bajo_benchmark"), below: below.map((r) => ({ nombre: _mNombre(r), margen: r.margen })) } } };
  }

  // ── FOCOS reales ──
  if (focus === "alto_volumen_bajo_margen") {
    const ranked = rows.slice().sort((a, b) => (b.venta || 0) - (a.venta || 0));
    const hits = ranked.filter((r) => r.margen < _benchOf(r)).slice(0, 4);
    const lead = hits.length ? hits : ranked.slice(0, 3);
    orden = "descendente por Ventas";
    lines = [
      `${L.art} ${L.p} que más venden y peor margen dejan: ${lead.map((r) => `${_mNombre(r)} (${_mVenta(r.venta)} a ${_p1(r.margen)}%)`).join(" · ")}.`,
      `${_mNombre(lead[0])} es el caso más caro: factura ${_mVenta(lead[0].venta)} pero a ${_p1(lead[0].margen)}% — ${_p1(_gap(lead[0]))}pp bajo el benchmark ${_p1(bench)}%. Cada punto de margen ahí vale mucho por el volumen.`,
      `**Por qué importa:** el volumen amplifica el margen bajo — es donde una corrección chica de precio o rebate rinde más en $.`,
      `**Qué hacer:** priorizá ${lead.slice(0, 2).map(_mNombre).join(" y ")} para revisar lista/rebate; ahí está la mayor recuperación por punto.`,
    ];
    if (_pp1(lead[0])) {
      lines.push(`**Cuánto vale:** 1pp de margen en ${_mNombre(lead[0])} son +${_money(_pp1(lead[0]))} al año — por eso va primero.`);
      bol.push(_figLever(`${_mNombre(lead[0])} · Medida 1pp`, _pp1(lead[0]), "venta × 1%", true));
    }
    pushMarginFigs(lead);
    suggestions = ["Es por precio o por costo", "Acciones para recuperar margen"];
  } else if (focus === "bajo_benchmark") {
    // antes SIN ordenar (preservaba el orden crudo de la fuente, un accidente de archivo, no una clasificación real)
    // — "la clasificación... deben calcularse determinísticamente" (owner 2026-08-03): peor margen (más negativo)
    // primero, mismo criterio "peor primero" que el resto de los focos de este composer.
    const negatives = rows.filter((r) => r.margen < 0).sort((a, b) => a.margen - b.margen);
    if (pct) {
      orden = "descendente por Brecha";
      const vBelow = below.reduce((a, r) => a + (r.venta || 0), 0), share = totVenta ? vBelow / totVenta * 100 : 0;
      lines = [
        `El ${_p1(share)}% de la venta (${_mVenta(vBelow)} de ${_mVenta(totVenta)}) está bajo el margen mínimo de ${_p1(bench)}%.`,
        `Lo cargan ${below.slice(0, 3).map((r) => `${_mNombre(r)} (${_p1(r.margen)}%)`).join(" · ")} — ${below.length} de ${rows.length} ${L.p} por debajo.`,
        `**Qué hacer:** ese tramo es el que más mueve el margen de cartera; arranca por los de mayor venta bajo el piso.`,
      ];
      pushMarginFigs(below);
    } else if (negativo) {
      if (!negatives.length) {
        orden = "descendente por Brecha";
        const piso = _lo(1)[0];
        lines = [
          `Ninguno tiene margen negativo — el piso es ${_mNombre(piso)} con ${_p1(piso.margen)}%. No te invento una alarma que no existe.`,
          `Lo que SÍ está bajo el mínimo de ${_p1(bench)}% son ${below.length} de ${rows.length} ${L.p}: ${below.slice(0, 4).map((r) => `${_mNombre(r)} (${_p1(r.margen)}%, ${_p1(_gap(r))}pp)`).join(" · ")}.`,
          `**Qué hacer:** el problema no es pérdida directa, es margen delgado — el foco son esos ${L.p} bajo el piso.`,
        ];
        pushMarginFigs(below);
      } else {
        orden = "ascendente por Margen";
        lines = [`${negatives.length} ${L.p} con margen negativo: ${negatives.map((r) => `${_mNombre(r)} (${_p1(r.margen)}%)`).join(" · ")}. Es valor que se pierde en cada venta — máxima prioridad.`];
        pushMarginFigs(negatives);
      }
    } else {
      // COMPLETO Y GRADUADO (owner 2026-07-15): si son 8, los 8 tienen nombre o camino (nada de 5-de-8 sin ruta) ·
      // la CAUSA se declara con su grado — la brecha y su $ están PROBADOS; el porqué (precio/costo/carga) queda
      // ABIERTO desde esta vista, con la oferta explícita de confirmarlo.
      orden = "descendente por Brecha";
      const listedM = below.slice(0, 5), restM = below.slice(5);
      lines = [
        `${below.length} de ${rows.length} ${L.p} están bajo el margen mínimo de ${_p1(bench)}%: ${listedM.map((r) => `${_mNombre(r)} ${_p1(r.margen)}% (${_p1(_gap(r))}pp)`).join(" · ")}.`,
        restM.length ? `Completan la lista ${restM.map((r) => `${_mNombre(r)} ${_p1(r.margen)}% (${_p1(_gap(r))}pp)`).join(" · ")} — los ${below.length} completos, con su semáforo, están en el cuadro de la Mesa.` : "",
        `El más lejos del piso es ${_mNombre(below[0])} a ${_p1(below[0].margen)}% (${_p1(_gap(below[0]))}pp bajo el benchmark).`,
        `**La causa, graduada:** lo probado en el dato es la brecha y su $; si pega por precio, por costo o por carga queda abierto desde esta vista — pedime «¿Es por precio o por costo?» y lo confirmo por ${L.s}.`,
        `**Qué hacer:** rankeados por brecha, esos son los que más margen recuperan si corregís precio o costo.`,
      ];
      pushMarginFigs(below);
    }
    // CUÁNTO VALE (asesor): cliente → la cuenta gated del diagnóstico (una verdad) · otros ejes → 1pp sobre la venta del peor.
    // El scope de la palanca respeta TAMBIÉN filters.cliente (una lectura de UN cliente no muestra la palanca de cartera).
    const _lvScope = entityScope || (filters.cliente ? { entities: [filters.cliente] } : null);
    const lever = dim === "cliente" ? _leverFoco(scenario, "margen", _lvScope) : null;
    if (lever && lever.top.length) {
      // PUENTE de cuentas (coherencia): cuando el corte material (≥ brecha material) es MENOR que los bajo el piso,
      // la relación se dice explícita — "de los 8, estos 5" — para que ningún lector (ni el narrador) funda los grupos.
      lines.push(lever.count === below.length
        ? `**Cuánto vale:** si los ${lever.count} que están materialmente bajo el piso llegan al benchmark, son +${_money(lever.subtotal)} de contribución al año — el que más paga es ${lever.top[0].entidad} (+${_money(lever.top[0].usd)}).`
        : `**Cuánto vale:** de los ${below.length} bajo el piso, los ${lever.count} con brecha material (${_DIAG_MARGIN_GAP()} pp o más) concentran el valor: si llegan al benchmark son +${_money(lever.subtotal)} de contribución al año — el que más paga es ${lever.top[0].entidad} (+${_money(lever.top[0].usd)}).`);
      bol.push(_figLever("Medida · cerrar brecha al piso", lever.subtotal, "Σ venta × benchmark − contribución (≥4pp · ≥ piso)", true));
      bol.push(_figLever(`${lever.top[0].entidad} · Valor en juego`, lever.top[0].usd, "venta × benchmark − contribución"));
    } else if (below.length && _pp1(below[0])) {
      lines.push(`**Cuánto vale:** un solo punto de margen en ${_mNombre(below[0])} son +${_money(_pp1(below[0]))} al año.`);
      bol.push(_figLever(`${_mNombre(below[0])} · Medida 1pp`, _pp1(below[0]), "venta × 1%", true));
    }
    suggestions = ["Es por precio o por costo", "Cuánta venta está bajo el mínimo"];
  } else if (focus === "causa_precio" || focus === "causa_costo") {
    const cand = below.filter((r) => _markup(r) != null);
    const src = cand.length ? cand : rows.filter((r) => _markup(r) != null);
    if (!src.length) return null;
    if (focus === "causa_precio") {
      const byThin = src.slice().sort((a, b) => _markup(a) - _markup(b)).slice(0, 4);   // markup más fino = precio no da
      orden = "ascendente por Markup";
      lines = [
        `Estos ${L.p} ceden margen por el PRECIO: la lista está pegada al costo. ${byThin.map((r) => `${_mNombre(r)} (markup ${_p1(_markup(r))}%)`).join(" · ")}.`,
        `${_mNombre(byThin[0])} deja apenas ${_p1(_markup(byThin[0]))}% de markup sobre lista vs el ${_p1(bench)}% de referencia — el precio no alcanza a cubrir el margen objetivo.`,
        `**Qué hacer:** la medida es la lista de precios, no el costo. Subir lista en ${byThin.slice(0, 2).map(_mNombre).join(" y ")} recupera margen directo (si la demanda aguanta).`,
      ];
      if (_pp1(byThin[0])) {
        lines.push(`**Cuánto vale:** recuperar 1pp vía precio en ${_mNombre(byThin[0])} son +${_money(_pp1(byThin[0]))} al año.`);
        bol.push(_figLever(`${_mNombre(byThin[0])} · Medida 1pp`, _pp1(byThin[0]), "venta × 1%", true));
      }
      pushMarginFigs(byThin);
      suggestions = ["Cuáles ceden por costo", "Candidatos a subir precio"];
    } else {
      const byCost = src.slice().sort((a, b) => _costShare(b) - _costShare(a)).slice(0, 4);   // costo se lleva más del precio
      orden = "descendente por Costo";
      lines = [
        `Estos ${L.p} ceden margen por el COSTO: se lleva la mayor parte del precio de lista. ${byCost.map((r) => `${_mNombre(r)} (costo ${Math.round(_costShare(r))}% de la lista)`).join(" · ")}.`,
        `En ${_mNombre(byCost[0])} el costo es el ${Math.round(_costShare(byCost[0]))}% de la lista — queda poco para el margen aunque el precio esté en regla.`,
        `**Qué hacer:** la medida acá es la compra/costo, no el precio. Negociar costo en ${byCost.slice(0, 2).map(_mNombre).join(" y ")} es lo que mueve el margen.`,
      ];
      if (_pp1(byCost[0])) {
        lines.push(`**Cuánto vale:** recuperar 1pp vía costo en ${_mNombre(byCost[0])} son +${_money(_pp1(byCost[0]))} al año.`);
        bol.push(_figLever(`${_mNombre(byCost[0])} · Medida 1pp`, _pp1(byCost[0]), "venta × 1%", true));
      }
      pushMarginFigs(byCost);
      suggestions = ["Cuáles ceden por precio", "Acciones para recuperar margen"];
    }
  } else if (focus === "subir_precio") {
    const src = rows.filter((r) => _markup(r) != null);
    const uMed = src.map((r) => r.unidades || 0).sort((a, b) => a - b)[Math.floor(src.length / 2)] || 0;
    const cand = src.filter((r) => r.margen < _benchOf(r) && (r.unidades || 0) >= uMed).sort((a, b) => _markup(a) - _markup(b)).slice(0, 4);
    const lead = cand.length ? cand : src.filter((r) => r.margen < _benchOf(r)).slice(0, 3);
    if (!lead.length) return null;
    orden = "ascendente por Markup";
    lines = [
      `Candidatos a subir precio (margen bajo + demanda que aguanta): ${lead.map((r) => `${_mNombre(r)} (${r.unidades || "—"}u a ${_p1(r.margen)}%, markup ${_p1(_markup(r))}%)`).join(" · ")}.`,
      `${_mNombre(lead[0])} vende ${lead[0].unidades || "—"}u con markup de sólo ${_p1(_markup(lead[0]))}% — hay espacio de lista sin que el volumen sea frágil.`,
      `**Ojo:** son candidatos por SEÑAL (margen bajo + volumen sano), no una prueba de elasticidad. Conviene testear una corrección chica antes de mover todo.`,
    ];
    if (_pp1(lead[0])) {
      lines.push(`**Cuánto vale:** cada punto de precio en ${_mNombre(lead[0])} vale +${_money(_pp1(lead[0]))} al año${lead[1] && _pp1(lead[1]) ? `; en ${_mNombre(lead[1])}, +${_money(_pp1(lead[1]))}` : ""} — corrección chica, valor directo.`);
      bol.push(_figLever(`${_mNombre(lead[0])} · Medida 1pp`, _pp1(lead[0]), "venta × 1%", true));
      if (lead[1] && _pp1(lead[1])) bol.push(_figLever(`${_mNombre(lead[1])} · Medida 1pp`, _pp1(lead[1]), "venta × 1%"));
    }
    pushMarginFigs(lead);
    suggestions = ["Es por precio o por costo", "Productos de alto margen subpenetrados"];
  } else if (focus === "alto_margen_subpenetrado") {
    const ds = diagnoseSkus(rows, { salesField: "venta", marginField: "margen" });
    let sub = rows.filter((r) => ds[_mNombre(r)] && ds[_mNombre(r)].patron === "alto_margen_subpenetrado");
    if (!sub.length) sub = rows.filter((r) => r.margen >= bench).sort((a, b) => (a.venta || 0) - (b.venta || 0)).slice(0, 4);
    sub = sub.sort((a, b) => b.margen - a.margen).slice(0, 4);
    orden = "descendente por Margen";
    lines = [
      `Productos de alto margen y baja penetración (upside si ganan distribución): ${sub.map((r) => `${_mNombre(r)} (${_p1(r.margen)}% margen, sólo ${_mVenta(r.venta)})`).join(" · ")}.`,
      `${_mNombre(sub[0])} rinde ${_p1(sub[0].margen)}% pero factura poco — cada peso extra de venta acá entra a margen alto.`,
      `**Qué hacer:** empujar volumen/distribución en estos rinde más que defender los de bajo margen. Es crecer donde ya ganas bien.`,
    ];
    pushMarginFigs(sub);
    suggestions = ["Candidatos a subir precio", "Los que más venden y peor margen"];
  } else if (focus === "stock_bajo_margen") {
    const kSf = _sf("capital", "sku");
    const skus = kSf ? (_load(kSf.source, scenario) || []).filter(Boolean) : [];
    const lowM = skus.filter((s) => typeof s.margenPct === "number" && s.margenPct < POLICY.benchmark);
    if (!lowM.length) return null;
    const bMap = {};
    for (const s of lowM) { const k = s.bodega || "—"; (bMap[k] = bMap[k] || { bodega: k, usd: 0, skus: [] }); bMap[k].usd += s.stockUSD || 0; bMap[k].skus.push(s); }
    const byBod = Object.values(bMap).sort((a, b) => b.usd - a.usd);
    const topB = byBod[0], topSk = lowM.slice().sort((a, b) => (b.stockUSD || 0) - (a.stockUSD || 0)).slice(0, 3);
    lines = [
      `Las bodegas con más stock parado en productos de bajo margen: ${byBod.slice(0, 3).map((b) => `${b.bodega} (${_money(b.usd)})`).join(" · ")}.`,
      `${topB.bodega} concentra ${_money(topB.usd)} en SKU de margen bajo — ${topSk.map((s) => `${s.sku} (${_p1(s.margenPct)}%, ${_money(s.stockUSD)})`).join(" · ")}.`,
      `**Por qué duele doble:** es capital inmovilizado Y de baja rentabilidad — si rota, deja poco; si no rota, ata caja sin premio.`,
      `**Qué hacer:** son los primeros candidatos a liquidar o dejar de reponer — bajo margen no justifica ocupar capital.`,
    ];
    for (const s of topSk) bol.push(fig(`${s.sku} · Capital`, _money(s.stockUSD), { unit: "money", raw: s.stockUSD, mandatory: false, context: "stock en bajo margen" }));
    suggestions = ["Qué SKU libero primero", "Los de bajo margen por costo o precio"];
    return { opener: lines.filter(Boolean).join("\n\n"), suggestions, sentrixAction: null, evidence: { lens: "margin", metrica: "margen", dimension: "bodega", orden: "descendente por Capital", boleta: bol, margin: { focus, panel: _marginPanel(lowM.map((s) => ({ nombre: s.sku, margen: s.margenPct })), POLICY.benchmark, "bajo_benchmark"), byBodega: byBod.map((b) => ({ bodega: b.bodega, usd: b.usd })) } } };
  } else if (focus === "palancas") {
    const target = POLICY.targetCarga;
    const cargaHigh = rows.filter((r) => typeof r.pctRebate === "number" && r.pctRebate > target).sort((a, b) => b.pctRebate - a.pctRebate).slice(0, 4);
    const thinPrice = rows.filter((r) => _markup(r) != null && r.margen < _benchOf(r)).sort((a, b) => _markup(a) - _markup(b)).slice(0, 3);
    // DOS rankings independientes en el mismo foco (carga/rebates + precio de lista) → ordenA/ordenB, mismo patrón
    // dual que buildTension (entityRecord.js) ya usa para sus dos métricas cruzadas.
    if (cargaHigh.length) ordena = "descendente por Carga";
    if (thinPrice.length) ordenB = "ascendente por Markup";
    // CUÁNTO VALE (misma cuenta del detector de carga del diagnóstico · una verdad) — y LIDERA la respuesta:
    // "¿cuánto me come la carga?" se contesta con el $ primero, el ranking después (invitado en prod 2026-07-09).
    const cargaLever = dim === "cliente" ? _leverFoco(scenario, "carga", entityScope || (filters.cliente ? { entities: [filters.cliente] } : null)) : null;
    lines = [
      cargaLever && cargaLever.top.length
        ? `**Cuánto vale:** la carga sobre el target retiene ${_money(cargaLever.subtotal)} de margen al año — llevarla al ${_p1(target)}% lo libera; solo ${cargaLever.top[0].entidad} devuelve +${_money(cargaLever.top[0].usd)}.`
        : "",
      `Lo que más consume margen, en orden:`,
      `**1 · Carga/rebates** — ${cargaHigh.length ? `${cargaHigh.map((r) => `${_mNombre(r)} (${_p1(r.pctRebate)}%)`).join(" · ")} están sobre el target de ${_p1(target)}%` : `todos dentro del target de ${_p1(target)}%`}. Es margen que se entrega en descuento; recortable donde el poder de negociación lo permite.`,
      thinPrice.length ? `**2 · Precio de lista** — ${thinPrice.map((r) => `${_mNombre(r)} (markup ${_p1(_markup(r))}%)`).join(" · ")}: la lista está pegada al costo, subir precio recupera margen directo.` : "",
      `**Qué hacer (volumen-safe):** arranca por la carga de los ${L.p} con más poder de compra tuyo y por la lista donde la demanda aguanta — así recuperás margen sin resignar volumen.`,
    ];
    for (const r of cargaHigh) bol.push(fig(`${_mNombre(r)} · Carga`, `${_p1(r.pctRebate)}%`, { unit: "pct", raw: r.pctRebate, mandatory: false, context: "carga comercial" }));
    if (cargaLever && cargaLever.top.length) {
      bol.push(_figLever("Medida · carga al target", cargaLever.subtotal, "Σ (carga − target) × venta (≥ piso)", true));
      bol.push(_figLever(`${cargaLever.top[0].entidad} · Carga recuperable`, cargaLever.top[0].usd, "(carga − target) × venta"));
    }
    suggestions = ["Los que más venden y peor margen", "Es por precio o por costo"];
  } else {
    return null;
  }

  // ── boleta: contexto de cartera + benchmark (cifras autorizadas) ──
  // mandatory SOLO si la propia lectura cita el benchmark (si no, el guard mataría narraciones que — correctamente — no
  // lo nombran: el bug del foco palancas que caía al piso por "omitir" el 30.1% que su texto nunca dijo).
  bol.push(fig("Benchmark de margen", `${_p1(bench)}%`, { unit: "pct", raw: bench, mandatory: lines.join(" ").includes(`${_p1(bench)}%`), context: _ctx }));
  bol.push(fig(`${L.p} bajo el benchmark`, String(below.length), { unit: "count", raw: below.length, mandatory: false, context: _ctx }));
  // EL MARGEN DEL NEGOCIO, la cifra de la card (owner 2026-08-09, decisión 6 · hallazgo E). Esta tool entregaba las
  // BRECHAS por cliente y la VARA, pero nunca el margen ponderado de la cartera — que es exactamente lo que la
  // cabecera "Margen promedio" muestra. Sin él, ADI tenía autorizada la vara (30,1%) y ninguna de las dos cifras
  // que el usuario está mirando. Sólo sobre el eje completo y sin filtros: el margen del negocio al lado de un
  // subconjunto respondería otra pregunta.
  const _headline = _figHeadline("margen", dim, scenario, { acotado: !!(filters.marca || filters.familia || filters.bodega) || !!(entityScope && entityScope.entities && entityScope.entities.length) });
  if (_headline) bol.push(_headline);
  return {
    opener: lines.filter(Boolean).join("\n\n"),
    suggestions,
    sentrixAction: null,
    evidence: { lens: "margin", metrica: "margen", dimension: dim,
      ...(orden ? { orden } : {}), ...(ordena ? { ordena } : {}), ...(ordenB ? { ordenB } : {}), boleta: bol,
      margin: { focus, bench, dimension: dim, panel: _marginPanel(rows, bench, focus), below: below.map((r) => ({ nombre: _mNombre(r), margen: r.margen, venta: r.venta, gap: _gap(r) })) } },
  };
}

/* ── composeSpecVentas · FOCO VENTAS (owner 2026-07-06 · "la pregunta manda el foco") ────────────────────────
 * Tercer composer focus-aware. El set de ventas es el más HUECO-pesado (no hay sucursal, transacciones, serie mensual, flag
 * de nuevo). Cada foco responde lo específico con el dato disponible; los huecos avisan honesto + pivotan a la lente más
 * cercana (nunca el genérico). Fuentes: clientesVentas (YoY+ppto), marcas/sfamiliasVentas (YoY), skusMargen (venta),
 * baseKpis (totales). Escalas ambiguas (precio realizado, descomposición) se dan en % (invariante); los $ vía _money. */
const _pctChg = (a, b) => (b ? (a - b) / b * 100 : 0);
const _sgnp = (v) => (v >= 0 ? "+" : "");
const _VLBL = { cliente: { s: "cliente", p: "clientes", art: "Los" }, sku: { s: "SKU", p: "SKU", art: "Los" }, familia: { s: "familia", p: "familias", art: "Las" }, marca: { s: "marca", p: "marcas", art: "Las" }, canal: { s: "canal", p: "canales", art: "Los" } };
// EL ESCENARIO ENTRA POR EL CONTRATO (owner 2026-08-09, decisión 4 · hallazgo B). Estas cuatro funciones leían los
// imports CRUDOS (`_cVentas`/`_mVentas`/`_fVentas`), así que `composeSpecVentas` RECIBÍA `scenario` y lo tiraba:
// salesRead contestaba $100.0M en bonanza, tensión y crisis mientras la pantalla mostraba $99.9M / $92.8M / $81.1M.
// La corrección NO agrega una segunda transformación: `_load` delega en el `scenarioLoad` que sourceManifest declara
// —el mismo `applyScenarioToClientesVentas` que consume Sentrix— y marca/familia usan las agregaciones del propio
// motor (`applyScenarioToMarcasVentas`/`applyScenarioToSfamiliasVentas`, las MISMAS que llama `cuadro.js`).
// `skusMargen` sigue literal: el manifiesto lo declara scenario-blind.
function _ventasByCanal(scenario) {
  const g = {};
  for (const r of _load("clientesVentas", scenario)) { const k = r.canal || "—"; const gg = (g[k] = g[k] || { nombre: k, actual: 0, anterior: 0, unidades: 0, unidadesAnt: 0, presupuesto: 0 }); gg.actual += r.actual || 0; gg.anterior += r.anterior || 0; gg.unidades += r.unidades || 0; gg.unidadesAnt += r.unidadesAnt || 0; gg.presupuesto += r.presupuesto || 0; }
  return Object.values(g);
}
function _ventasRows(dim, scenario) {
  if (dim === "marca") return applyScenarioToMarcasVentas(scenario) || _mVentas;
  if (dim === "familia") return applyScenarioToSfamiliasVentas(scenario) || _fVentas;
  if (dim === "canal") return _ventasByCanal(scenario);
  if (dim === "sku") return _skusM.map((s) => ({ nombre: s.nombre, actual: s.venta, unidades: s.unidades, marca: s.marca, sfamilia: s.sfamilia }));   // sin anterior/ppto
  return _load("clientesVentas", scenario);
}
// presupuesto sólo existe por CLIENTE → para marca/familia/canal se hace ROLL-UP de clientesVentas por ese eje (agregado honesto)
function _pptoByDim(dim, scenario) {
  const cv = _load("clientesVentas", scenario);
  if (dim === "cliente") return cv.map((r) => ({ nombre: r.nombre, actual: r.actual, presupuesto: r.presupuesto }));
  const key = dim === "familia" ? "sfamilia" : dim === "marca" ? "marca" : dim === "canal" ? "canal" : null;
  if (!key) return [];   // sku → sin ppto
  const g = {};
  for (const r of cv) { const k = r[key] || "—"; const gg = (g[k] = g[k] || { nombre: k, actual: 0, presupuesto: 0 }); gg.actual += r.actual || 0; gg.presupuesto += r.presupuesto || 0; }
  return Object.values(g);
}
// bloque de un foco REAL → { lines, suggestions, bol } · reusable como pivot de un hueco
function _ventasFocusBlock(focus, dim, filters, entityScope, scenario) {
  const L = _VLBL[dim] || _VLBL.cliente;
  // TOTALES DEL ESCENARIO, no del literal base (hallazgo B, segunda mitad). `_vKPI` es el KPI de `baseKpis.js`:
  // FIJO — 100.000 en bonanza, en tensión y en crisis. Por eso salesRead contestaba $100.0M mientras la pantalla
  // mostraba $92.8M / $81.1M: un error de hasta 23%.
  //
  // POR QUÉ `getVentasKPI` Y NO `deriveKpis`. Son DOS totales distintos, los dos scenario-aware, separados por el
  // ~0,1% que el propio dataset arrastra entre `ventasKPI` y Σ`clientesVentas` (99.999 vs 99.887 en bonanza):
  //   · `getVentasKPI(null, null, scenario)` es EXACTAMENTE la llamada que hace `sentrix/mesa.js` para la card de
  //     ventas. El owner ya decidió el 2026-07-15 que esa card y la respuesta que abre su click son UNA verdad.
  //   · `deriveKpis(scenario)` suma las filas transformadas — el total de la cara Comercial.
  // Se elige la primera porque es la que ADI ya tenía comprometida por decisión del owner; el 0,1% contra la fila
  // Total de la cartera queda DECLARADO en el manifiesto, no escondido. Cuál de los dos es "la venta oficial" es
  // decisión del owner, no de este paso (ver el residual reportado).
  const _kpi = getVentasKPI(null, null, scenario) || _vKPI;
  let rows = _scopeRows(_ventasRows(dim, scenario), filters, entityScope);
  if (!rows.length) return null;
  const _m = (v) => _money(v * 1000);   // ventas en MILES → $ real (escala del contrato · el total de cartera es ~$100M · consistente con el resumen ejecutivo)
  const bol = [];

  if (focus === "vs_presupuesto") {
    // el TOTAL viene de la KPI autoritativa (100K vs 97K = +3.1%); el desglose por eje = roll-up de clientesVentas.
    // Con ENTITYSCOPE ("de esos, ¿cómo van contra el plan?") el total honesto es el del SUBCONJUNTO (roll-up), no la KPI.
    const allP = _pptoByDim(dim, scenario);
    const rowsP = _scopeRows(allP, {}, entityScope);
    const scoped = rowsP.length > 0 && rowsP.length < allP.length;
    const totA = scoped ? rowsP.reduce((a, r) => a + (r.actual || 0), 0) : _kpi.totalActual;
    const totP = scoped ? rowsP.reduce((a, r) => a + (r.presupuesto || 0), 0) : _kpi.totalPresupuesto;
    const tp = _pctChg(totA, totP);
    const totLine = `La venta va ${_sgnp(tp)}${_p1(tp)}% ${tp >= 0 ? "sobre" : "bajo"} presupuesto (${_m(totA)} vs ${_m(totP)}).`;
    if (!rowsP.length) {   // sku → sin ppto propio
      return { lines: [`${totLine} Por ${L.s} no tengo presupuesto propio — sólo por cliente (y al total). El desglose de cumplimiento por ${L.s} no es posible.`, `Por cliente sí puedo mostrarte quién se despega del plan.`], suggestions: ["Desviación vs presupuesto por cliente", "Cómo vamos vs el año anterior"], bol: [fig("Venta total", _m(_kpi.totalActual), { unit: "money", raw: _kpi.totalActual * 1000, mandatory: true, context: "vs presupuesto" }), fig("Presupuesto total", _m(_kpi.totalPresupuesto), { unit: "money", raw: _kpi.totalPresupuesto * 1000, mandatory: false, context: "vs presupuesto" })] };
    }
    const withDev = rowsP.map((r) => ({ ...r, dev: (r.actual || 0) - r.presupuesto, devp: _pctChg(r.actual || 0, r.presupuesto) })).sort((a, b) => b.dev - a.dev);
    const over = withDev.filter((r) => r.dev > 0), under = withDev.filter((r) => r.dev < 0).sort((a, b) => a.dev - b.dev);
    const short = Math.abs(under.reduce((a, r) => a + r.dev, 0));   // lo que falta al plan (K) — la palanca del período
    const lines = [
      `${totLine}${dim !== "cliente" ? ` Por ${L.s} el presupuesto es un agregado de los clientes.` : ""}`,
      over.length ? `Los que más se despegan sobre plan: ${over.slice(0, 3).map((r) => `${r.nombre} (${_sgnp(r.dev)}${_m(r.dev)}, ${_sgnp(r.devp)}${_p1(r.devp)}%)`).join(" · ")}.` : "",
      under.length ? `Los que quedan cortos${under.length > 3 ? ` (${under.length} en total — estos 3 son los que más pesan)` : ""}: ${under.slice(0, 3).map((r) => `${r.nombre} (${_m(r.dev)}, ${_p1(r.devp)}%)`).join(" · ")}.` : `Ningún ${L.s} quedó bajo presupuesto.`,
      under.length ? `**Cuánto vale:** cerrar lo que falta al plan vale +${_m(short)} este período — el que más pesa es ${under[0].nombre} (${_m(under[0].dev)}).` : "",
      `**Qué hacer:** el foco de recuperación son los que quedan cortos; los de arriba marcan qué está funcionando.`,
    ];
    if (under.length) bol.push(fig("Medida · cerrar el plan", _m(short), { unit: "money", raw: short * 1000, mandatory: true, source: "computed", formula: "Σ déficit vs presupuesto", context: "cuánto vale la medida" }));
    for (const r of [...over.slice(0, 3), ...under.slice(0, 2)]) bol.push(fig(`${r.nombre} · vs ppto`, `${_sgnp(r.dev)}${_m(r.dev)}`, { unit: "money", raw: r.dev * 1000, mandatory: false, context: "vs presupuesto" }));
    bol.push(fig(scoped ? "Venta del grupo" : "Venta total", _m(totA), { unit: "money", raw: totA * 1000, mandatory: true, context: "vs presupuesto" }));
    bol.push(fig(scoped ? "Presupuesto del grupo" : "Presupuesto total", _m(totP), { unit: "money", raw: totP * 1000, mandatory: false, context: "vs presupuesto" }));
    const panel = { kind: "movers", title: "Vs presupuesto", headline: `${_sgnp(tp)}${_p1(tp)}%`, headlineSub: `${_m(totA)} vs ${_m(totP)}`, rows: withDev.map((r) => ({ nombre: r.nombre, val: r.dev, valFmt: `${_sgnp(r.dev)}${_m(r.dev)}`, pct: +r.devp.toFixed(1), pos: r.dev >= 0 })) };
    return { lines, suggestions: ["Cómo vamos vs el año anterior", "Es por volumen o por precio"], bol, panel };
  }

  if (focus === "vs_anterior" || focus === "explica_yoy") {
    let useRows = rows, note = "", LL = L;
    // MISMO CRITERIO QUE `vs_presupuesto` (arriba, owner 2026-07-15): sin alcance acotado el titular del NEGOCIO es
    // el KPI del escenario —la misma cifra que la card de ventas de la Mesa—, no la Σ de las filas, que difiere
    // ~0,1% por el desajuste que el dataset arrastra entre `ventasKPI` y `clientesVentas`. Con "de esos clientes…"
    // el total honesto vuelve a ser el del SUBCONJUNTO, sumando sus filas. Antes esto no hacía falta porque las
    // filas eran las CRUDAS y sumaban 100.000 por casualidad; con el escenario aplicado ya no coinciden.
    const _todasY = _ventasRows(dim, scenario);
    let _scopedY = rows.length > 0 && rows.length < _todasY.length;
    if (!rows.some((r) => typeof r.anterior === "number")) { useRows = _load("clientesVentas", scenario); LL = _VLBL.cliente; note = `Por ${L.s} no tengo el año anterior (sólo venta actual) — te lo doy por cliente, que es el eje con YoY.`; _scopedY = false; }   // sku → pivot al eje cliente COMPLETO
    const conA = useRows.filter((r) => typeof r.anterior === "number");
    const mov = conA.map((r) => ({ nombre: r.nombre, d: (r.actual || 0) - (r.anterior || 0), p: _pctChg(r.actual || 0, r.anterior || 0) }));
    const up = mov.filter((r) => r.d > 0).sort((a, b) => b.d - a.d), down = mov.filter((r) => r.d < 0).sort((a, b) => a.d - b.d);
    const _totFilas = conA.reduce((a, r) => a + (r.actual || 0), 0), _totAntFilas = conA.reduce((a, r) => a + (r.anterior || 0), 0);
    const tot = !_scopedY && typeof _kpi.totalActual === "number" ? _kpi.totalActual : _totFilas;
    const totAnt = !_scopedY && typeof _kpi.totalAnterior === "number" ? _kpi.totalAnterior : _totAntFilas;
    const tp = _pctChg(tot, totAnt);
    const lines = [
      note,
      `La venta va ${_sgnp(tp)}${_p1(tp)}% vs el año anterior (${_m(tot)} vs ${_m(totAnt)}, ${_sgnp(tot - totAnt)}${_m(tot - totAnt)}).`,
      up.length ? `Traccionan el crecimiento: ${up.slice(0, 4).map((r) => `${r.nombre} (${_sgnp(r.d)}${_m(r.d)})`).join(" · ")}.` : "",
      down.length ? `Restan: ${down.slice(0, 4).map((r) => `${r.nombre} (${_m(r.d)})`).join(" · ")}.` : `Ningún ${LL.s} cae vs el año anterior.`,
      `**Qué hacer:** el neto es positivo, pero los que restan son la fuga a mirar — recuperarlos suma directo.`,
    ];
    for (const r of [...up.slice(0, 3), ...down.slice(0, 2)]) bol.push(fig(`${r.nombre} · YoY`, `${_sgnp(r.d)}${_m(r.d)}`, { unit: "money", raw: r.d * 1000, mandatory: false, context: "vs año anterior" }));
    const panel = { kind: "movers", title: "Vs año anterior", headline: `${_sgnp(tp)}${_p1(tp)}%`, headlineSub: `${_m(tot)} vs ${_m(totAnt)}`, rows: mov.map((r) => ({ nombre: r.nombre, val: r.d, valFmt: `${_sgnp(r.d)}${_m(r.d)}`, pct: +r.p.toFixed(1), pos: r.d >= 0 })).sort((a, b) => b.val - a.val) };
    return { lines, suggestions: ["Es por volumen o por precio", "Quiénes redujeron su compra"], bol, panel };
  }

  if (focus === "descomposicion_vol_precio") {
    const conA = rows.filter((r) => typeof r.anterior === "number" && typeof r.unidadesAnt === "number");
    if (!conA.length) return { lines: [`Por ${L.s} no tengo unidades del año anterior — la descomposición volumen/precio la puedo dar por cliente, marca o familia.`], suggestions: ["Descomposición por cliente", "Crecimiento YoY"], bol: [] };
    const sV = conA.reduce((a, r) => a + (r.actual || 0), 0), sVA = conA.reduce((a, r) => a + (r.anterior || 0), 0);
    const sU = conA.reduce((a, r) => a + (r.unidades || 0), 0), sUA = conA.reduce((a, r) => a + (r.unidadesAnt || 0), 0);
    const volp = _pctChg(sU, sUA), pNow = sU ? sV / sU : 0, pAnt = sUA ? sVA / sUA : 0, prip = _pctChg(pNow, pAnt), totp = _pctChg(sV, sVA);
    const perc = conA.map((r) => ({ nombre: r.nombre, vol: _pctChg(r.unidades || 0, r.unidadesAnt || 0), pri: _pctChg((r.unidades ? r.actual / r.unidades : 0), (r.unidadesAnt ? r.anterior / r.unidadesAnt : 0)) }));
    const volLed = perc.slice().sort((a, b) => b.vol - a.vol)[0], priLed = perc.slice().sort((a, b) => b.pri - a.pri)[0];
    const lines = [
      `El ${_sgnp(totp)}${_p1(totp)}% de crecimiento se parte en volumen y precio: **más unidades ${_sgnp(volp)}${_p1(volp)}%** y **mejor precio realizado ${_sgnp(prip)}${_p1(prip)}%**.`,
      `Del lado volumen empuja ${volLed.nombre} (${_sgnp(volLed.vol)}${_p1(volLed.vol)}% en unidades); del lado precio, ${priLed.nombre} (${_sgnp(priLed.pri)}${_p1(priLed.pri)}% de precio realizado).`,
      `Nota: "precio realizado" = venta/unidades (no es un ticket ni una lista de precios). El efecto MIX entre familias se ve por familia; la **frecuencia de compra no la tengo** (no hay transacciones).`,
      `**Qué hacer:** si el crecimiento es más volumen que precio, es sano (ganas mercado); si fuera casi todo precio, habría que revisar si es sostenible.`,
    ];
    bol.push(fig("Crecimiento total YoY", `${_sgnp(totp)}${_p1(totp)}%`, { unit: "pct", raw: +totp.toFixed(1), mandatory: true, context: "descomposición" }));
    bol.push(fig("Efecto volumen", `${_sgnp(volp)}${_p1(volp)}%`, { unit: "pct", raw: +volp.toFixed(1), mandatory: false, context: "descomposición" }));
    bol.push(fig("Efecto precio realizado", `${_sgnp(prip)}${_p1(prip)}%`, { unit: "pct", raw: +prip.toFixed(1), mandatory: false, context: "descomposición" }));
    const panel = { kind: "decomp", title: "Volumen vs precio", totp: +totp.toFixed(1), volp: +volp.toFixed(1), prip: +prip.toFixed(1), volLed: volLed.nombre, priLed: priLed.nombre };
    return { lines, suggestions: ["Quiénes traccionan el crecimiento", "Participación de familias en el mix"], bol, panel };
  }

  if (focus === "caida_clientes") {
    const conA = _scopeRows(_load("clientesVentas", scenario), {}, entityScope).filter((r) => typeof r.anterior === "number");   // "de esos, ¿cuáles se cayeron?" respeta el alcance heredado
    const down = conA.map((r) => ({ nombre: r.nombre, d: (r.actual || 0) - (r.anterior || 0), p: _pctChg(r.actual || 0, r.anterior || 0), du: (r.unidades || 0) - (r.unidadesAnt || 0) })).filter((r) => r.d < 0).sort((a, b) => a.d - b.d);
    if (!down.length) return { lines: [`Ningún cliente redujo su compra vs el año anterior — todos crecen o se mantienen. No te invento una fuga que no existe.`], suggestions: ["Crecimiento YoY por cliente", "Cómo vamos vs presupuesto"], bol: [] };
    const lines = [
      `Los clientes que retroceden vs el año anterior: ${down.slice(0, 4).map((r) => `${r.nombre} (${_m(r.d)}, ${_p1(r.p)}%)`).join(" · ")}.`,
      `El más marcado es ${down[0].nombre} (${_m(down[0].d)}, ${_p1(down[0].p)}%${down[0].du < 0 ? `, ${down[0].du}u menos` : ""}). Ninguno dejó de comprar del todo, pero estos son los que se enfrían.`,
      `Nota: no tengo flag de "cliente activo/nuevo" ni frecuencia de compra (no hay transacciones) — esto es caída de venta YoY, la señal más cercana a "dejar de comprar".`,
      `**Qué hacer:** la mayor oportunidad de recuperación está justo acá — recuperar a estos clientes vale ${_m(Math.abs(down.slice(0, 4).reduce((a, r) => a + r.d, 0)))}.`,
    ];
    for (const r of down.slice(0, 4)) bol.push(fig(`${r.nombre} · YoY`, `${_m(r.d)}`, { unit: "money", raw: r.d * 1000, mandatory: false, context: "caída YoY" }));
    const panel = { kind: "movers", title: "Clientes que retroceden", headlineSub: "vs el año anterior", rows: down.map((r) => ({ nombre: r.nombre, val: r.d, valFmt: _m(r.d), pct: +r.p.toFixed(1), pos: false })) };
    // ORDEN SELLADO (owner 2026-08-03): UNA sola dirección acá (solo "caen", nunca mezclado con los que suben) — el
    // peor primero, en magnitud $ (el guard lee el monto SIN signo, ver _toNumOrder en guardC.js) — seguro de sellar.
    return { lines, suggestions: ["Crecimiento YoY por cliente", "Es por volumen o por precio"], bol, panel, orden: "descendente por YoY" };
  }

  if (focus === "precio_realizado") {
    const conU = rows.filter((r) => r.unidades > 0);
    if (!conU.length) return null;
    const withP = conU.map((r) => ({ nombre: r.nombre, pNow: r.actual / r.unidades, yoy: (typeof r.anterior === "number" && r.unidadesAnt) ? _pctChg(r.actual / r.unidades, r.anterior / r.unidadesAnt) : null }));
    const up = withP.filter((r) => r.yoy != null).sort((a, b) => b.yoy - a.yoy);
    const lines = [
      `**Ojo — no tengo ticket promedio real** (necesita nº de transacciones, y no hay pedidos en los datos). Lo más cercano es el **precio promedio realizado** (venta/unidades), que no es lo mismo.`,
      up.length ? `Por ${L.s}, quién subió más su precio realizado vs el año anterior: ${up.slice(0, 3).map((r) => `${r.nombre} (${_sgnp(r.yoy)}${_p1(r.yoy)}%)`).join(" · ")}.` : `Precio realizado por ${L.s}: ${withP.slice(0, 3).map((r) => r.nombre).join(" · ")}.`,
      `Tampoco tengo sucursal ni vendedor, así que el corte por esos ejes no es posible. Frecuencia y tráfico requieren transacciones (no existen).`,
    ];
    for (const r of up.slice(0, 3)) if (r.yoy != null) bol.push(fig(`${r.nombre} · precio realizado YoY`, `${_sgnp(r.yoy)}${_p1(r.yoy)}%`, { unit: "pct", raw: +r.yoy.toFixed(1), mandatory: false, context: "precio realizado" }));
    const panel = { kind: "movers", title: "Precio realizado YoY (proxy, no es ticket)", pctMode: true, rows: up.filter((r) => r.yoy != null).map((r) => ({ nombre: r.nombre, val: r.yoy, valFmt: `${_sgnp(r.yoy)}${_p1(r.yoy)}%`, pos: r.yoy >= 0 })) };
    return { lines, suggestions: ["Es por volumen o por precio", "Crecimiento YoY por cliente"], bol, panel };
  }

  if (focus === "mix_familia") {
    const rowsF = _scopeRows(_ventasRows("familia", scenario), {}, entityScope).filter((r) => typeof r.anterior === "number");   // scope heredado (sólo intersecta si lo heredado son familias)
    const tot = rowsF.reduce((a, r) => a + (r.actual || 0), 0), totA0 = rowsF.reduce((a, r) => a + (r.anterior || 0), 0);
    const mix = rowsF.map((r) => ({ nombre: r.nombre, sNow: tot ? (r.actual || 0) / tot * 100 : 0, sAnt: totA0 ? (r.anterior || 0) / totA0 * 100 : 0 })).map((r) => ({ ...r, dpp: r.sNow - r.sAnt })).sort((a, b) => b.dpp - a.dpp);
    const gan = mix[0], per = mix[mix.length - 1];
    const lines = [
      `En el mix de ventas, ${gan.nombre} gana participación (${_p1(gan.sAnt)}% → ${_p1(gan.sNow)}%, ${_sgnp(gan.dpp)}${_p1(gan.dpp)}pp) y ${per.nombre} pierde (${_p1(per.sAnt)}% → ${_p1(per.sNow)}%, ${_p1(per.dpp)}pp).`,
      `Participación actual: ${mix.slice().sort((a, b) => b.sNow - a.sNow).map((r) => `${r.nombre} ${_p1(r.sNow)}%`).join(" · ")}.`,
      `**Qué mirar:** quién gana peso del mix marca hacia dónde se mueve la demanda — útil para reponer y negociar donde estás creciendo.`,
    ];
    for (const r of mix) bol.push(fig(`${r.nombre} · share`, `${_p1(r.sNow)}%`, { unit: "pct", raw: +r.sNow.toFixed(1), mandatory: false, context: "mix de ventas" }));
    const panel = { kind: "mix", title: "Mix de ventas · participación", rows: mix.slice().sort((a, b) => b.sNow - a.sNow).map((r) => ({ nombre: r.nombre, sNow: +r.sNow.toFixed(1), sAnt: +r.sAnt.toFixed(1), dpp: +r.dpp.toFixed(1) })) };
    // ORDEN SELLADO (owner 2026-08-03): la LISTA que de verdad se narra ("Participación actual: …") va ordenada por
    // sNow (share actual, siempre positivo) — NO por dpp (la variación, que sí puede cruzar de signo, ver gan/per
    // arriba, mencionados sueltos, no como ranking completo) — se sella el criterio de la lista real, no el de `mix`.
    return { lines, suggestions: ["Crecimiento YoY por familia", "Es por volumen o por precio"], bol, panel, orden: "descendente por participación" };
  }

  if (focus === "concentracion") {
    // EL 80/20 DE LA VENTA (owner 2026-07-15: el botón del gráfico de la Mesa pregunta EXACTAMENTE lo que muestra —
    // antes contribución secuestraba la pregunta y respondía OTRA cifra que la del gráfico). concentracion() del
    // MOTOR sobre las mismas filas del eje (la MISMA llamada del 80/20 de la Mesa · una verdad). Grupos que cierran.
    const rowsC = rows.filter((r) => typeof r.actual === "number" && r.actual > 0).map((r) => ({ nombre: r.nombre, valor: r.actual }));
    if (rowsC.length < 2) return null;
    const con = concentracion(rowsC, 0.8);
    const totV = rowsC.reduce((s, r) => s + r.valor, 0) || 1;
    const restN = rowsC.length - con.cantidadEntidades, restPct = +(100 - con.totalCubiertoPct).toFixed(1);
    const cab = con.entidades.slice(0, 4).map((e) => `${e.nombre} (${_p1(e.participacionPct)}%)`).join(" · ");
    const lines = [
      `El ${_p1(con.totalCubiertoPct)}% de tu venta lo explican ${con.cantidadEntidades} de ${rowsC.length} ${L.p}${con.entidades.length > 4 ? `, encabezados por ${cab} — el bloque completo está en el panel` : `: ${cab}`}.`,
      restN > 0 ? `El resto (${restN} ${L.p}) aporta el ${_p1(restPct)}% de la venta.` : "",
      `**Qué significa:** ${con.cantidadEntidades <= rowsC.length / 2 ? `tu venta está concentrada en pocas cuentas — cuidar a ${con.cantidadEntidades === 1 ? "esa cuenta" : `esos ${con.cantidadEntidades}`} es prioridad: perder una pega directo en la venta` : "tu venta está bastante repartida — el riesgo por cuenta es menor"}.`,
    ];
    for (const e of con.entidades.slice(0, 5)) bol.push(fig(`${e.nombre} · venta`, _m(e.valor), { unit: "money", raw: e.valor * 1000, mandatory: false, context: "concentración de venta" }));
    bol.push(fig("Venta total", _m(totV), { unit: "money", raw: totV * 1000, mandatory: false, context: "concentración de venta" }));
    let accC = 0;
    const prows = rowsC.slice().sort((a, b) => b.valor - a.valor).map((r) => { accC += r.valor; return { nombre: r.nombre, valFmt: _m(r.valor), part: +(r.valor / totV * 100).toFixed(1), acum: +(accC / totV * 100).toFixed(1) }; });
    const panel = { kind: "pareto", title: "Quién explica la venta", totalPct: con.totalCubiertoPct, cutoff: con.cantidadEntidades, of: rowsC.length, rows: prows };
    // ORDEN SELLADO (owner 2026-08-03): ranking único de venta (todas positivas, sin cruce de signo) — seguro de sellar.
    return { lines, suggestions: [`Profundiza en ${con.entidades[0].nombre}`, "¿En cuántos clientes se concentra mi contribución?"], bol, panel, orden: "descendente por venta" };
  }

  if (focus === "rank_venta") {
    // EL ALCANCE VIAJA (auditoría de asks 2026-07-15: «¿Cuáles son los SKU que más venden de Samsung?» — chip del
    // cuadro de marcas — respondía TODOS los SKU en silencio: el scope estaba hardcodeado a {}). skusMargen trae
    // marca y familia por fila → el filtro del spec aplica; el rótulo declara el alcance (nunca global disfrazado).
    const ranked = _scopeRows(_skusM.slice(), filters || {}, entityScope).sort((a, b) => (b.venta || 0) - (a.venta || 0));   // "de esos SKU, ¿cuál vende más?" respeta el alcance
    if (!ranked.length) return null;
    const _scLbl = (filters && (filters.marca || filters.familia)) ? ` de ${filters.marca || filters.familia}` : "";
    const lines = [
      `Los SKU que más venden${_scLbl}: ${ranked.slice(0, 5).map((s) => `${s.nombre} (${_m(s.venta)})`).join(" · ")}.`,
      ranked[1] ? `${ranked[0].nombre} lidera con ${_m(ranked[0].venta)}, seguido de ${ranked[1].nombre} (${_m(ranked[1].venta)}).` : `${ranked[0].nombre} lidera con ${_m(ranked[0].venta)}.`,
      `**Ojo:** no tengo presupuesto ni año anterior POR SKU (sólo por cliente/marca/familia), así que no puedo comparar cada SKU contra plan ni contra el año pasado — eso te lo doy a nivel cliente o familia.`,
    ];
    for (const s of ranked.slice(0, 5)) bol.push(fig(`${s.nombre} · venta`, _m(s.venta), { unit: "money", raw: s.venta * 1000, mandatory: false, context: `ranking de venta${_scLbl}` }));
    const panel = { kind: "rank", title: `SKU por venta${_scLbl}`, rows: ranked.slice(0, 8).map((s) => ({ nombre: s.nombre, val: s.venta, valFmt: _m(s.venta) })) };
    // ORDEN SELLADO (owner 2026-08-03): ranking único de venta — mismo criterio que "concentracion" arriba.
    return { lines, suggestions: ["Venta vs año anterior por familia", "Los SKU de alto margen subpenetrados"], bol, panel, orden: "descendente por venta" };
  }
  return null;
}

const _VGAP = {
  sin_sucursal: { no: "cortar la venta por SUCURSAL / punto de venta", falta: "datos de venta por sucursal (sólo existe el catálogo de sucursales, sin ventas asociadas)" },
  sin_serie_mensual: { no: "comparar contra el MES anterior", falta: "serie mensual (el único período previo que tengo es el AÑO anterior, no el mes)" },
  sin_frecuencia: { no: "medir la FRECUENCIA de compra", falta: "pedidos/transacciones (sin ellos no hay cuántas veces compra cada cliente)" },
  sin_ticket: { no: "dar el TICKET promedio, el tráfico o la conversión", falta: "transacciones (el ticket real necesita nº de operaciones; lo que hay es venta/unidades = precio realizado)" },
};

export function composeSpecVentas({ filters = {}, scenario, focus = "vs_anterior", dimension = "cliente", gap = null, pivotFocus = null, entityScope = null } = {}) {
  const dim = _VLBL[dimension] ? dimension : "cliente";
  if (gap) {
    const g = _VGAP[gap] || _VGAP.sin_sucursal;
    const pf = pivotFocus || (gap === "sin_frecuencia" ? "caida_clientes" : gap === "sin_ticket" ? "precio_realizado" : gap === "sin_serie_mensual" ? "vs_anterior" : "vs_anterior");
    const pivotDim = pf === "mix_familia" ? "familia" : pf === "rank_venta" ? "sku" : "cliente";
    const block = _ventasFocusBlock(pf, pivotDim, {}, null, scenario) || { lines: [`Puedo mostrarte la venta vs el año anterior por cliente.`], suggestions: [], bol: [] };
    const lines = [
      `No te puedo ${g.no}: falta ${g.falta}. No lo invento.`,
      `Lo más cercano que SÍ tengo:`,
      ...block.lines,
    ];
    return { opener: lines.filter(Boolean).join("\n\n"), suggestions: block.suggestions.length ? block.suggestions : ["Cómo vamos vs el año anterior", "Cómo vamos vs presupuesto"], sentrixAction: null,
      evidence: { lens: "ventas", metrica: "ventas", dimension: pivotDim, ...(block.orden ? { orden: block.orden } : {}), boleta: block.bol, ventas: { focus: "gap:" + gap, pivot: pf, gapLabel: g.no, panel: block.panel || null } } };
  }
  const block = _ventasFocusBlock(focus, dim, filters, entityScope, scenario);
  if (!block) return null;
  // ORDEN SELLADO (owner 2026-08-03, MISMO patrón que composeSpecMargin/commit 9184ec0): _ventasFocusBlock declara
  // `orden` SOLO en los focos de un único criterio sin cruce de signo (rank_venta/concentracion/mix_familia/
  // caida_clientes) — vs_anterior/vs_presupuesto/precio_realizado quedan sin sellar a propósito: mezclan entidades
  // que suben y que bajan (o cruzan de signo) en la MISMA lista, y el guard lee el monto/pct SIN signo (ver
  // _toNumOrder en guardC.js) — declarar un único "descendente"/"ascendente" ahí arriesgaría un falso positivo en
  // la transición de signo, no una garantía real.
  return { opener: block.lines.filter(Boolean).join("\n\n"), suggestions: block.suggestions, sentrixAction: null,
    evidence: { lens: "ventas", metrica: "ventas", dimension: dim, ...(block.orden ? { orden: block.orden } : {}), boleta: block.bol, ventas: { focus, dimension: dim, panel: block.panel || null } } };
}

/* ── composeSpecContribucion · FOCO CONTRIBUCIÓN (owner 2026-07-06 · "la pregunta manda el foco") ────────────
 * 4º dominio. Contribución = el $ que aporta cada entidad (distinto del margen %). Conceptos propios: concentración 80/20
 * (quién la sostiene), origen (volumen vs calidad · reusa origenContribucion del motor), no capturada (gap vs benchmark ≈
 * el $4.9M del resumen), alta-venta-baja-contribución. Reusa _marginRows (mismas fuentes) + diagnoseClientes + concentracion.
 * Escala ×1000 (_mVenta) consistente con el resumen. Corre ANTES de margen/ventas (evita que "venta"/"margen" lo secuestren). */
const _ORIGEN_TXT = { volumen: "del VOLUMEN — es una cuenta grande, pero con margen bajo el promedio (valor por tamaño, no por calidad)", calidad: "de la CALIDAD — buen margen, aunque no sea la cuenta más grande", mix_balanceado: "de un mix equilibrado — buen tamaño y buen margen a la vez", bajo_impacto: "de poco — ni el volumen ni el margen la sostienen" };

export function composeSpecContribucion({ filters = {}, scenario, focus = "rank", dimension = "cliente", entity = null, entityScope = null } = {}) {
  const dim = _MLBL[dimension] ? dimension : "cliente";
  const L = _MLBL[dim];
  const rows = _scopeRows(_marginRows(dim, scenario), filters, entityScope).filter((r) => typeof r.contribucion === "number");
  if (!rows.length) return null;
  const bench = _benchOf(rows[0]);
  const totC = rows.reduce((a, r) => a + (r.contribucion || 0), 0) || 1;
  const _ctx = "contribución";
  const dc = dim === "cliente" ? diagnoseClientes(_load("clientesVentas", scenario), _marginRows("cliente", scenario)) : {};
  const _share = (c) => +(c / totC * 100).toFixed(1);
  let lines = [], suggestions = [], bol = [], panel = null;
  // ORDEN SELLADO por la tool (owner 2026-08-03, MISMO patrón que composeSpecMargin/commit 9184ec0) — SOLO en los
  // focos de UN SOLO criterio/lista (concentracion/no_capturada/rank: un único ranking de "Contribución", sin
  // ambigüedad de columna). "origen" NO arma una tabla rankeada (compara 1-2 categorías, no filas de entidades) y
  // "alta_venta_baja_contribucion" cruza DOS listas de entidades DISJUNTAS por métricas DISTINTAS (venta/margen) que
  // un narrador podría fusionar en una sola tabla — sellar ambas a la vez arriesga un falso positivo si esa tabla
  // fusionada no queda monótona en ninguna de las dos columnas por separado; se deja sin sellar (mismo criterio
  // conservador que vs_anterior/vs_presupuesto en composeSpecVentas, más abajo).
  let orden = null;

  if (focus === "concentracion") {
    orden = "descendente por Contribución";
    const con = concentracion(rows.map((r) => ({ nombre: _mNombre(r), valor: r.contribucion })), 0.8);
    const restN = rows.length - con.cantidadEntidades, restPct = +(100 - con.totalCubiertoPct).toFixed(1);
    const sorted = rows.slice().sort((a, b) => b.contribucion - a.contribucion);
    let acc = 0; const prows = sorted.map((r) => { acc += r.contribucion; return { nombre: _mNombre(r), valFmt: _mVenta(r.contribucion), part: _share(r.contribucion), acum: +(acc / totC * 100).toFixed(1) }; });
    lines = [
      // grupos que cierran: si el bloque tiene más entidades que las nombradas, el corte se declara ("encabezados por")
      `El ${_p1(con.totalCubiertoPct)}% de tu contribución la sostienen ${con.cantidadEntidades} de ${rows.length} ${L.p}${con.entidades.length > 4 ? `, encabezados por ${con.entidades.slice(0, 4).map((e) => `${e.nombre} (${_p1(e.participacionPct)}%)`).join(" · ")} — el bloque completo está en el panel` : `: ${con.entidades.slice(0, 4).map((e) => `${e.nombre} (${_p1(e.participacionPct)}%)`).join(" · ")}`}.`,
      restN > 0 ? `El resto (${restN} ${L.p}) aporta apenas el ${_p1(restPct)}%.` : "",
      `**Qué significa:** tu contribución está ${con.cantidadEntidades <= rows.length / 2 ? "concentrada en pocas cuentas" : "bastante repartida"} — cuidar a esas ${con.cantidadEntidades} es prioridad, perder una pega directo en la contribución.`,
    ];
    for (const e of con.entidades.slice(0, 5)) bol.push(fig(`${e.nombre} · Contribución`, _mVenta(e.valor), { unit: "money", raw: e.valor * 1000, mandatory: false, context: _ctx }));
    panel = { kind: "pareto", title: "Quién sostiene la contribución", totalPct: con.totalCubiertoPct, cutoff: con.cantidadEntidades, of: rows.length, rows: prows };
    suggestions = ["De dónde viene esa contribución", "Cuánta contribución no capturo"];
  } else if (focus === "no_capturada") {
    orden = "descendente por Contribución no capturada";
    // MISMA verdad que el diagnóstico (el $ de la card de la Mesa): venta×benchmark/100 − contribución, con los gates
    // de materialidad (≥4pp bajo benchmark · ≥ piso $). COHERENCIA (owner 2026-07-15): la venta se carga por el
    // CONTRATO scenario-aware — igual que _diagComercial — porque antes mezclaba venta base con margen del escenario
    // y abría con OTRA cifra ($5.0M) que la card y el diagnose ($4.9M). Cliente-level (donde vive el gap).
    const vSF2 = _sf("ventas", "cliente");
    const vRows = vSF2 ? _load(vSF2.source, scenario) : [];
    const vBy = {}; for (const v of vRows) vBy[v.nombre] = v;
    const mRows = _scopeRows(_marginRows("cliente", scenario), {}, entityScope);
    const withGap = [], bajoBench = [];
    for (const r of mRows) {
      const v = vBy[r.nombre]; if (!v || typeof v[vSF2.field] !== "number") continue;
      const bmk = _benchOf(r), mg = r.margen, cb = r.contribucion;
      if (typeof mg !== "number" || typeof cb !== "number") continue;
      const usdTodos = Math.round(((v[vSF2.field] * bmk / 100) - cb) * 1000);
      // EL UNIVERSO SE CUENTA ANTES DE LOS DOS FILTROS. `withGap` descarta por brecha mínima (_DIAG_MARGIN_GAP)
      // Y por piso de materialidad (_DIAG_FLOOR_USD); cualquiera de los dos deja cuentas afuera, así que contar
      // después de uno solo vuelve a mentir sobre la cobertura — que es el defecto que esto viene a cerrar.
      if (bmk - mg > 0 && usdTodos > 0) bajoBench.push({ nombre: r.nombre, gap: usdTodos });
      if ((bmk - mg) < _DIAG_MARGIN_GAP()) continue;
      const usd = usdTodos;
      if (usd >= _DIAG_FLOOR_USD) withGap.push({ nombre: r.nombre, gap: usd, margen: mg });
    }
    withGap.sort((a, b) => b.gap - a.gap);
    const totalGap = withGap.reduce((a, r) => a + r.gap, 0);
    // LA COBERTURA SE DECLARA, NO SE SUPONE. Si el piso no dejó a nadie afuera, la cifra ES el total y se rotula
    // así; si dejó a alguien, es un SUBTOTAL y la etiqueta lleva su universo pegado, para que el muro (guardC,
    // chequeo de alcance) pueda impedir que el narrador la promueva a total del eje.
    const _filtrado = bajoBench.length > withGap.length;
    const _sufijoGap = _filtrado
      ? `· subtotal · ${withGap.length} de ${bajoBench.length} cuentas bajo el benchmark (las materiales)`
      : "· total";
    // GRUPOS QUE CIERRAN: si se nombran N, son N y su suma ES la cifra del grupo — con más de _DIAG_TOPN, el corte
    // se declara y el camino al resto queda dicho (el cuadro de la Mesa), nunca una lista que no suma lo anunciado.
    const listedG = withGap.slice(0, _DIAG_TOPN);
    lines = [
      `Estás dejando ${_money(totalGap)} de contribución sobre la mesa: es lo que sumarías si los ${withGap.length} clientes materiales que hoy están bajo el benchmark (${_p1(bench)}%) llegaran al piso.`,
      listedG.length === withGap.length
        ? `Los ${withGap.length}, de mayor a menor: ${listedG.map((r) => `${r.nombre} (${_money(r.gap)}, margen ${_p1(r.margen)}%)`).join(" · ")} — esa lista completa suma el total de arriba.`
        : `Los ${listedG.length} que más dejan: ${listedG.map((r) => `${r.nombre} (${_money(r.gap)}, margen ${_p1(r.margen)}%)`).join(" · ")} — los ${withGap.length} completos están en el cuadro de la Mesa.`,
      `**Por qué:** es la brecha entre lo que vendes y lo que rinde — no es una pérdida contable, es contribución que el margen delgado te deja capturar.`,
      `**Qué hacer:** cada punto de margen recuperado en los de mayor venta es la medida más directa sobre este valor.`,
    ];
    // LA COBERTURA VIAJA COMO ESTRUCTURA, NO COMO SUFIJO (owner 2026-08-11). El sufijo de la etiqueta es para el
    // humano; el muro necesita un campo que no dependa de cómo se redactó el label — una etiqueta nueva («· 5
    // cuentas materiales») dejaría al chequeo ciego sin que nadie se entere. `cobertura` es esa verdad.
    bol.push(fig(`Contribución no capturada ${_sufijoGap}`, _money(totalGap), {
      unit: "money", raw: totalGap, mandatory: true, context: _ctx,
      cobertura: { alcance: _filtrado ? "subtotal" : "total", n: withGap.length, m: bajoBench.length, universo: "cuentas bajo el benchmark" },
    }));
    // LOS CONTEOS QUE EL EMISOR DECLARA SON CIFRAS AUTORIZADAS. Sin esto, «las 5 cuentas materiales» —la lectura
    // CORRECTA del subtotal— se rechazaba con `conteo-no-autorizado`: el muro exige que todo número esté en la
    // boleta y el emisor nombraba el recorte sin autorizarlo. No se relaja el chequeo; se autoriza el dato.
    bol.push(fig("Cuentas bajo el benchmark", String(bajoBench.length), { unit: "count", raw: bajoBench.length, context: _ctx }));
    if (_filtrado) bol.push(fig("Cuentas materiales bajo el benchmark", String(withGap.length), { unit: "count", raw: withGap.length, context: _ctx }));
    for (const r of listedG) bol.push(fig(`${r.nombre} · no capturada`, _money(r.gap), { unit: "money", raw: r.gap, mandatory: false, context: _ctx }));
    panel = { kind: "gap", title: "Contribución no capturada", headline: _money(totalGap), rows: withGap.map((r) => ({ nombre: r.nombre, val: r.gap, valFmt: _money(r.gap) })) };
    suggestions = ["Quién sostiene la contribución", "Es por precio o por costo"];
  } else if (focus === "origen") {
    if (entity && dc[entity]) {
      const d = dc[entity], r = rows.find((x) => _mNombre(x) === entity);
      lines = [
        `La contribución de ${entity}${r ? ` (${_mVenta(r.contribucion)}, ${_share(r.contribucion)}% del total)` : ""} viene ${_ORIGEN_TXT[d.origenContribucion] || "de una mezcla de factores"}.`,
        `${d.razon}`,
        `**Qué mirar:** ${d.origenContribucion === "volumen" ? "crece por tamaño, no por rentabilidad — subir su margen aunque sea un punto rinde mucho por el volumen que mueve" : d.origenContribucion === "calidad" ? "aporta por calidad de venta — el upside está en ganarle volumen sin resignar ese margen" : "conviene sostener el equilibrio y empujar donde haya espacio"}.`,
      ];
      if (r) bol.push(fig(`${entity} · Contribución`, _mVenta(r.contribucion), { unit: "money", raw: r.contribucion * 1000, mandatory: true, context: _ctx }));
      panel = { kind: "rank", title: `Contribución · contexto de ${entity}`, rows: rows.slice().sort((a, b) => b.contribucion - a.contribucion).slice(0, 8).map((x) => ({ nombre: _mNombre(x), val: x.contribucion, valFmt: _mVenta(x.contribucion), hi: _mNombre(x) === entity })) };
    } else {
      const byO = {}; for (const r of rows) { const d = dc[_mNombre(r)]; if (d) { (byO[d.origenContribucion] = byO[d.origenContribucion] || { c: 0, names: [] }); byO[d.origenContribucion].c += r.contribucion; byO[d.origenContribucion].names.push(_mNombre(r)); } }
      const ord = Object.entries(byO).sort((a, b) => b[1].c - a[1].c);
      const dom = ord[0];
      lines = [
        `Tu contribución viene sobre todo ${_ORIGEN_TXT[dom[0]] ? _ORIGEN_TXT[dom[0]].split(" — ")[0] : "del volumen"}: ${dom[1].names.slice(0, 3).join(", ")} pesan ${_mVenta(dom[1].c)} (${_share(dom[1].c)}%).`,
        ord[1] ? `Del lado ${ord[1][0] === "calidad" ? "de la calidad (margen alto)" : ord[1][0]}: ${ord[1][1].names.slice(0, 3).join(", ")} (${_mVenta(ord[1][1].c)}).` : "",
        `**Qué mirar:** si la contribución depende del volumen (cuentas grandes, margen bajo), es más frágil — un punto de margen ahí es lo que más rinde.`,
      ];
      panel = { kind: "rank", title: "Contribución por cliente", rows: rows.slice().sort((a, b) => b.contribucion - a.contribucion).slice(0, 8).map((x) => ({ nombre: _mNombre(x), val: x.contribucion, valFmt: _mVenta(x.contribucion) })) };
    }
    suggestions = ["Quién sostiene la contribución", "Cuánta contribución no capturo"];
  } else if (focus === "alta_venta_baja_contribucion") {
    const wd = rows.map((r) => ({ nombre: _mNombre(r), venta: r.venta, contribucion: r.contribucion, margen: r.margen, patron: dc[_mNombre(r)] && dc[_mNombre(r)].patron }));
    const altoVol = wd.filter((r) => r.patron === "alto_volumen_bajo_margen").sort((a, b) => (b.venta || 0) - (a.venta || 0));
    const buenM = wd.filter((r) => r.patron === "buen_margen_baja_contribucion").sort((a, b) => (b.margen || 0) - (a.margen || 0));
    const lead = altoVol.length ? altoVol : wd.slice().sort((a, b) => (b.venta || 0) - (a.venta || 0)).filter((r) => _share(r.contribucion) < 100 / rows.length).slice(0, 3);
    lines = [
      `Venden mucho pero su contribución no acompaña el tamaño: ${lead.slice(0, 3).map((r) => `${r.nombre} (${_mVenta(r.venta)} de venta, ${_mVenta(r.contribucion)} de contribución a ${_p1(r.margen)}%)`).join(" · ")}.`,
      lead[0] ? `${lead[0].nombre} es el caso más caro: factura mucho pero a margen ${_p1(lead[0].margen)}%, así que aporta menos valor del que su volumen sugiere.` : "",
      buenM.length ? `Del otro lado, ${buenM.slice(0, 2).map((r) => `${r.nombre} (${_p1(r.margen)}% margen)`).join(" y ")} tienen buen margen pero aportan poco — por tamaño chico, no por calidad.` : "",
      `**Qué hacer:** en los de alto volumen y bajo margen, un punto de margen es lo que más rinde; en los de buen margen y poco tamaño, el upside es ganarles volumen.`,
    ];
    for (const r of lead.slice(0, 3)) bol.push(fig(`${r.nombre} · Contribución`, _mVenta(r.contribucion), { unit: "money", raw: r.contribucion * 1000, mandatory: false, context: _ctx }));
    panel = { kind: "rank", title: "Venta vs contribución", rows: wd.slice().sort((a, b) => (b.venta || 0) - (a.venta || 0)).slice(0, 8).map((r) => ({ nombre: r.nombre, val: r.contribucion, valFmt: _mVenta(r.contribucion), sub: `${_p1(r.margen)}%` })) };
    suggestions = ["De dónde viene la contribución", "Cuánta contribución no capturo"];
  } else {   // rank
    orden = "descendente por Contribución";
    const sorted = rows.slice().sort((a, b) => b.contribucion - a.contribucion);
    // el ALCANCE se declara (auditoría de asks 2026-07-15): «Top SKU por contribución de Samsung» filtrado debe
    // decir "de Samsung" — los % son sobre el total de ESE alcance, nunca un global disfrazado.
    const _scLbl = (filters && (filters.marca || filters.familia || filters.bodega || filters.cliente)) ? ` de ${filters.marca || filters.familia || filters.bodega || filters.cliente}` : "";
    lines = [
      `Los ${L.p} que más aportan a la contribución${_scLbl}: ${sorted.slice(0, 5).map((r) => `${_mNombre(r)} (${_mVenta(r.contribucion)}, ${_share(r.contribucion)}%)`).join(" · ")}.`,
      `Entre los primeros ${Math.min(3, sorted.length)} juntan ${_mVenta(sorted.slice(0, 3).reduce((a, r) => a + r.contribucion, 0))} de los ${_mVenta(totC)} totales.`,
      `**Qué mirar:** son las cuentas que hay que blindar; si quieres ver qué tan concentrada está, mira el 80/20.`,
    ];
    for (const r of sorted.slice(0, 5)) bol.push(fig(`${_mNombre(r)} · Contribución`, _mVenta(r.contribucion), { unit: "money", raw: r.contribucion * 1000, mandatory: false, context: _ctx }));
    panel = { kind: "rank", title: `Contribución por ${L.s}`, rows: sorted.slice(0, 8).map((r) => ({ nombre: _mNombre(r), val: r.contribucion, valFmt: _mVenta(r.contribucion) })) };
    suggestions = ["Quién sostiene la contribución", "De dónde viene la contribución"];
  }

  // LA CONTRIBUCIÓN TOTAL, CON SU DUEÑO (owner 2026-08-09, decisión 6 + 7). Este era el ÚNICO total de cabecera que
  // el oráculo ya devolvía bien — y viajaba sin declarar de quién es, de qué universo ni de qué período: la cifra
  // más citable del turno era también la más fácil de atribuir mal. Cuando el corte tiene cabecera declarada sale
  // por el camino canónico (la misma fuente oficial que pinta la card); si el ranking está ACOTADO —otro eje, un
  // filtro, un alcance heredado— ese total es el del SUBCONJUNTO y sigue por el camino de siempre, porque el total
  // del negocio ahí respondería otra pregunta.
  const _headlineC = _figHeadline("contribucion", dim, scenario, { acotado: !!(filters.marca || filters.familia || filters.bodega || filters.cliente) || !!(entityScope && entityScope.entities && entityScope.entities.length) });
  bol.push(_headlineC || fig("Contribución total", _mVenta(totC), { unit: "money", raw: totC * 1000, mandatory: false, context: _ctx }));
  return {
    opener: lines.filter(Boolean).join("\n\n"),
    suggestions,
    sentrixAction: null,
    evidence: { lens: "contribucion", metrica: "contribucion", dimension: dim, ...(orden ? { orden } : {}), boleta: bol, contribucion: { focus, dimension: dim, panel } },
  };
}

/* ── compareCauses · la CAPA CAUSAL del compare (owner 2026-07-07: "un controller senior da causas, no lee datos") ──
 * El composer del motor (sellado) entrega la lectura estructurada de A vs B; esta capa agrega LO QUE FALTABA para la
 * historia: POR QUÉ ocurre la brecha (costo vs carga, del mismo dato), DÓNDE está la plata (la no-capturada GATED de
 * cada uno — misma cuenta del diagnose, una verdad) y LA DECISIÓN (la palanca compartida + por cuál empezar y cuánto
 * vale el punto). Se APPENDEA en el seam — el motor no se toca. Cliente-only (los ejes con estructura precio/costo). */
export function compareCauses(a, b, scenario, dim = "cliente") {
  const rows = _marginRows(dim, scenario);
  const rA = rows.find((r) => _mNombre(r) === a), rB = rows.find((r) => _mNombre(r) === b);
  if (!rA || !rB || typeof rA.margen !== "number" || typeof rB.margen !== "number") return null;
  const bench = _benchOf(rA);
  const costo = (r) => (_costShare(r) != null ? +_costShare(r).toFixed(1) : null);
  const cA = costo(rA), cB = costo(rB);
  const gA = typeof rA.pctRebate === "number" ? rA.pctRebate : null, gB = typeof rB.pctRebate === "number" ? rB.pctRebate : null;
  const bol = [], lines = [];
  // POR QUÉ OCURRE · la brecha de margen se descompone en costo vs carga (mismo dato del que salen los %)
  const dCosto = cA != null && cB != null ? Math.abs(cA - cB) : 0;
  const dCarga = gA != null && gB != null ? Math.abs(gA - gB) : 0;
  const lever = dCosto >= dCarga ? "estructura de costo" : "carga comercial";
  if (cA != null && cB != null) {
    lines.push(`**Por qué ocurre:** la diferencia de margen viene de la ${lever === "estructura de costo" ? `ESTRUCTURA DE COSTO — a ${a} el costo se le lleva el ${_p1(cA)}% del precio de lista y a ${b} el ${_p1(cB)}%` : `CARGA COMERCIAL — ${a} entrega ${_p1(gA)}% en rebates/descuentos y ${b} ${_p1(gB)}%`}; ${lever === "estructura de costo" ? `la carga casi no separa (${_p1(gA)}% vs ${_p1(gB)}%)` : `el costo casi no separa (${_p1(cA)}% vs ${_p1(cB)}%)`}.`);
    bol.push(fig(`${a} · Costo/lista`, `${_p1(cA)}%`, { unit: "pct", raw: cA, mandatory: false, source: "computed", formula: "costoMedio / precioLista", context: "causa de la brecha" }));
    bol.push(fig(`${b} · Costo/lista`, `${_p1(cB)}%`, { unit: "pct", raw: cB, mandatory: false, source: "computed", formula: "costoMedio / precioLista", context: "causa de la brecha" }));
  }
  // DÓNDE ESTÁ TU PLATA · cliente: la no-capturada GATED de cada uno (misma cuenta del diagnose · una verdad) + el valor
  // del punto. Otros ejes (marca/familia): SIN detector gated → la plata visible honesta es el valor del punto (venta×1%).
  const foco = dim === "cliente" ? _leverFoco(scenario, "margen", { entities: [a, b] }) : null;
  const items = (foco && foco.items) || [];
  const iA = items.find((x) => x.entidad === a), iB = items.find((x) => x.entidad === b);
  const p1A = _pp1(rA), p1B = _pp1(rB);
  let hasPlata = false;
  if (iA || iB) {
    const parts = [];
    if (iA) { parts.push(`con ${a} estás dejando ${_money(iA.usd)} al año sobre la mesa (margen ${_p1(rA.margen)}% vs tu piso ${_p1(bench)}%)`); bol.push(_figLever(`${a} · Valor en juego`, iA.usd, "venta × benchmark − contribución")); }
    if (iB) { parts.push(`con ${b}, ${_money(iB.usd)}`); bol.push(_figLever(`${b} · Valor en juego`, iB.usd, "venta × benchmark − contribución")); }
    lines.push(`**Dónde está el valor:** ${parts.join("; ")}.${p1A && p1B ? ` Cada punto de margen recuperado vale +${_money(p1A)}/año en ${a} y +${_money(p1B)} en ${b}.` : ""}`);
    if (p1A) bol.push(_figLever(`${a} · Medida 1pp`, p1A, "venta × 1%"));
    if (p1B) bol.push(_figLever(`${b} · Medida 1pp`, p1B, "venta × 1%"));
    hasPlata = true;
  } else if ((rA.margen < bench || rB.margen < bench) && p1A && p1B) {
    lines.push(`**Dónde está el valor:** ${a} captura ${_p1(rA.margen)}% y ${b} ${_p1(rB.margen)}% contra tu piso de ${_p1(bench)}% — cada punto de margen vale +${_money(p1A)}/año en ${a} y +${_money(p1B)} en ${b}.`);
    bol.push(_figLever(`${a} · Medida 1pp`, p1A, "venta × 1%"));
    bol.push(_figLever(`${b} · Medida 1pp`, p1B, "venta × 1%"));
    hasPlata = true;
  } else if (rA.margen >= bench && rB.margen >= bench) {
    lines.push(`**Dónde está el valor:** los dos capturan sobre tu piso de ${_p1(bench)}% — acá no se pierde, se defiende: el riesgo es ceder margen para crecer volumen.`);
  }
  // LA DECISIÓN · la palanca y por dónde empezar (más venta = cada punto rinde más)
  const first = (rA.venta || 0) >= (rB.venta || 0) ? a : b;
  if (hasPlata) lines.push(`**La decisión:** la medida ${dCosto >= dCarga ? "de los dos es la misma — negociar costo/lista" : "es la carga — revisar rebates y condiciones"}. Empieza por ${first}: mueve más venta, cada punto recuperado rinde más.`);
  // EL AÑO, MES A MES (owner 2026-07-08: "al profundizar, que diga el porqué — si fue costos, si fue acciones, cuándo
  // subieron"): la curva del año de cada uno (la MISMA que dibuja la película: tendencia del historial × estacionalidad
  // real) + lo que se movió DEBAJO en el año — acciones de precios, costo medio, ticket — del mismo historial. Solo si
  // la serie mensual existe (cliente/marca/familia/SKU); sin historial (bodega) la sección no aparece — honesto.
  const filmCmp = _cmpEvolution(a, b, "venta");
  if (filmCmp) {
    const dPct = (x0, x1) => (x0 ? +(((x1 - x0) / x0) * 100).toFixed(1) : null);
    const yearOf = (E) => {
      const H = _histM[E.name] || [];
      const f = H[0], l = H[H.length - 1];
      let s = `${E.name} hace su mejor mes en ${E.maxMes} (${_money(E.max * 1000)}) y el más flojo en ${E.minMes} (${_money(E.min * 1000)})`;
      const drivers = [];
      if (f && l && typeof f.rebates === "number" && typeof l.rebates === "number") {
        const d = dPct(f.rebates, l.rebates);
        if (d != null) {
          drivers.push(`las acciones de precios ${d >= 0 ? "suben" : "bajan"} de ${_money(f.rebates * 1000)} a ${_money(l.rebates * 1000)} al mes${d > 0 ? " empujando la temporada alta" : ""}`);
          bol.push(fig(`${E.name} · Acciones de precios (inicio)`, _money(f.rebates * 1000), { unit: "money", raw: f.rebates * 1000, mandatory: false, source: "historial", formula: "rebates mensuales (Ene)", context: "el año, mes a mes" }));
          bol.push(fig(`${E.name} · Acciones de precios (cierre)`, _money(l.rebates * 1000), { unit: "money", raw: l.rebates * 1000, mandatory: false, source: "historial", formula: "rebates mensuales (Dic)", context: "el año, mes a mes" }));
        }
      }
      if (f && l && typeof f.costoMedio === "number" && typeof l.costoMedio === "number") {
        const d = dPct(f.costoMedio, l.costoMedio);
        if (d != null && d !== 0) drivers.push(`el costo medio ${d < 0 ? "baja" : "sube"} ${Math.abs(d)}% en el año`);
      }
      if (f && l && typeof f.ticket === "number" && typeof l.ticket === "number") {
        const d = dPct(f.ticket, l.ticket);
        if (d != null && d !== 0) drivers.push(`el ticket ${d >= 0 ? "sube" : "baja"} ${Math.abs(d)}%`);
      }
      if (drivers.length) s += `; detrás del año: ${drivers.join(", ")}`;
      bol.push(fig(`${E.name} · Mejor mes`, _money(E.max * 1000), { unit: "money", raw: E.max * 1000, mandatory: false, source: "historial", formula: "tendencia del historial × estacionalidad global", context: `mes ${E.maxMes}` }));
      bol.push(fig(`${E.name} · Mes más flojo`, _money(E.min * 1000), { unit: "money", raw: E.min * 1000, mandatory: false, source: "historial", formula: "tendencia del historial × estacionalidad global", context: `mes ${E.minMes}` }));
      return s + ".";
    };
    const eA = filmCmp.a, eB = filmCmp.b;
    const shared = eA.growth.mes && eA.growth.mes === eB.growth.mes && eA.drop.mes && eA.drop.mes === eB.drop.mes
      ? ` La subida fuerte de los dos llega ${eA.growth.from}→${eA.growth.mes} y el freno ${eA.drop.from}→${eA.drop.mes} — la estacionalidad de tu negocio los mueve a ambos.`
      : "";
    lines.push(`**El año, mes a mes:** ${yearOf(eA)} ${yearOf(eB)}${shared}`);
  }
  // EL PERFIL (owner 2026-07-08 · "que ADI lea el gráfico, no solo la tabla"): la película de las dos líneas — quién
  // parte arriba, dónde se cruzan, desde qué estación cambia el ganador y qué variable lo explica. MISMO dato y MISMA
  // semántica que el Perfil comparado de la Mesa (arriba = mejor · carga/costo invertidos). Abre el bloque causal.
  const stations = [
    { l: "ventas", va: rA.venta, vb: rB.venta, hi: true },
    { l: "contribución", va: rA.contribucion, vb: rB.contribucion, hi: true },
    { l: "margen", va: rA.margen, vb: rB.margen, hi: true },
    gA != null && gB != null ? { l: "carga", va: gA, vb: gB, hi: false } : null,
    cA != null && cB != null ? { l: "costo", va: cA, vb: cB, hi: false } : null,
  ].filter((s) => s && typeof s.va === "number" && typeof s.vb === "number");
  const wins = stations.map((s) => (s.va === s.vb ? null : (s.hi ? s.va > s.vb : s.va < s.vb) ? a : b));
  const seqIdx = wins.map((w, i) => ({ w, i })).filter((x) => x.w);
  if (seqIdx.length >= 2 && stations.length >= 3) {
    const lead = seqIdx[0].w, otherName = lead === a ? b : a;
    const nA = wins.filter((w) => w === a).length, nB = wins.filter((w) => w === b).length;
    const flips = [];
    for (let k = 1; k < seqIdx.length; k++) if (seqIdx[k].w !== seqIdx[k - 1].w) flips.push(seqIdx[k].i);
    const stationsOf = (who) => stations.filter((_, i) => wins[i] === who).map((s) => s.l);
    const score = ` ${a} gana ${nA} estaciones · ${b} ${nB} de ${stations.length}.`;
    let peli;
    if (!flips.length) {
      peli = `${lead} domina el perfil de punta a punta — la línea de ${otherName} nunca lo cruza.${score}`;
    } else if (Math.min(nA, nB) === 1) {
      const quiebre = stationsOf(nA < nB ? a : b)[0];
      peli = `${lead} parte arriba y domina casi todo el perfil; el ÚNICO quiebre es ${quiebre.toUpperCase()}, donde la línea de ${nA < nB ? a : b} lo cruza — ahí vive su única ventaja.${score}`;
    } else {
      const cierre = seqIdx[seqIdx.length - 1].w;
      peli = `${lead} parte arriba (${stationsOf(lead).slice(0, 2).join(" y ")}); las líneas se cruzan en ${stations[flips[0]].l.toUpperCase()} y de ahí manda ${cierre} (${stationsOf(cierre).join(", ")}). El cambio lo explica la ${lever}.${score}`;
    }
    lines.unshift(`**El perfil:** ${peli}`);
  }
  if (!lines.length) return null;
  return { lines, bol };
}

/* ── diveCauses · la CAPA CAUSAL del DIVE de cliente (owner 2026-07-07 · mismo principio que compareCauses) ──────────
 * "Profundiza en X" del motor entrega el perfil; esta capa agrega la HISTORIA del controller para UNA cuenta:
 * POR QUÉ está donde está (la brecha al piso DESCOMPUESTA en pp: cuánto se va en carga sobre target y cuánto en la
 * estructura precio/costo — aritmética del mismo dato) · DÓNDE está la plata (no-capturada y carga GATED de esa cuenta,
 * las cuentas del diagnose · una verdad) · LA DECISIÓN (la palanca dominante + el valor del punto). Cliente-only. */
export function diveCauses(entity, scenario) {
  const rows = _marginRows("cliente", scenario);
  const r = rows.find((x) => _mNombre(x) === entity);
  if (!r || typeof r.margen !== "number") return null;
  const bench = _benchOf(r), gap = +(bench - r.margen).toFixed(1);
  const lines = [], bol = [];
  const cShare = _costShare(r) != null ? +_costShare(r).toFixed(1) : null;
  const p1v = _pp1(r);
  if (gap > 0) {
    // POR QUÉ · la brecha al piso, partida en pp (carga sobre target + estructura precio/costo — mismo dato, pura aritmética)
    const cargaExc = typeof r.pctRebate === "number" ? +Math.max(0, r.pctRebate - POLICY.targetCarga).toFixed(1) : 0;
    const resto = +(gap - cargaExc).toFixed(1);
    lines.push(`**Por qué está donde está:** a ${entity} le faltan ${_p1(gap)}pp para tu piso de ${_p1(bench)}%. De esos, ${cargaExc > 0 ? `${_p1(cargaExc)}pp se van en carga sobre el target (${_p1(r.pctRebate)}% vs ${_p1(POLICY.targetCarga)}%) y ` : ""}${_p1(resto)}pp vienen de la estructura precio/costo${cShare != null ? ` — el costo se lleva el ${_p1(cShare)}% del precio de lista` : ""}.`);
    bol.push(fig(`Causa · brecha al piso`, `${_p1(gap)}pp`, { unit: "pp", raw: gap, mandatory: false, source: "computed", formula: "benchmark − margen", context: "causa" }));
    if (cargaExc > 0) bol.push(fig(`Causa · carga sobre target`, `${_p1(cargaExc)}pp`, { unit: "pp", raw: cargaExc, mandatory: false, source: "computed", formula: "carga − target", context: "causa" }));
    bol.push(fig(`Causa · precio/costo`, `${_p1(resto)}pp`, { unit: "pp", raw: resto, mandatory: false, source: "computed", formula: "brecha − exceso de carga", context: "causa" }));
    // DÓNDE ESTÁ TU PLATA · las cuentas GATED del diagnose para ESTA cuenta (una verdad)
    const fm = _leverFoco(scenario, "margen", { entities: [entity] });
    const fc = _leverFoco(scenario, "carga", { entities: [entity] });
    const im = fm && fm.items.find((x) => x.entidad === entity), ic = fc && fc.items.find((x) => x.entidad === entity);
    const parts = [];
    if (im) { parts.push(`${_money(im.usd)} al año de contribución sobre la mesa si llega a tu piso`); bol.push(_figLever(`${entity} · Valor en juego`, im.usd, "venta × benchmark − contribución")); }
    if (ic) { parts.push(`${_money(ic.usd)} recuperables llevando la carga al target`); bol.push(_figLever(`${entity} · Carga recuperable`, ic.usd, "(carga − target) × venta")); }
    if (p1v) { parts.push(`cada punto de margen vale +${_money(p1v)}/año`); bol.push(_figLever(`${entity} · Medida 1pp`, p1v, "venta × 1%")); }
    if (parts.length) lines.push(`**Dónde está el valor:** ${parts.join(" · ")}.`);
    // LA DECISIÓN · la palanca dominante en pp
    lines.push(`**La decisión:** ${cargaExc >= resto ? `la carga es la medida dominante — renegociar rebates/condiciones es lo primero` : `la medida dominante es precio/costo — revisar lista y costo de compra rinde más que tocar la carga`}; después medí el punto recuperado contra ${p1v ? `los +${_money(p1v)} que vale` : "su valor anual"}.`);
  } else {
    // sobre el piso: la historia es DEFENDER (y si la carga igual está sobre target, es plata recuperable extra)
    const fc = _leverFoco(scenario, "carga", { entities: [entity] });
    const ic = fc && fc.items.find((x) => x.entidad === entity);
    lines.push(`**Por qué gana:** ${entity} captura ${_p1(r.margen)}% — ${_p1(Math.abs(gap))}pp SOBRE tu piso de ${_p1(bench)}%. Acá no se pierde: se defiende ese margen mientras crece.`);
    if (ic) { lines.push(`**Valor extra igual disponible:** su carga está sobre el target — ${_money(ic.usd)} al año recuperables sin tocar el precio.`); bol.push(_figLever(`${entity} · Carga recuperable`, ic.usd, "(carga − target) × venta")); }
    lines.push(`**La decisión:** cuidala — es de las cuentas que sostienen tu contribución; el riesgo real es cederle margen para crecer volumen.`);
  }
  return { lines, bol };
}

/* ── composeSpecSimulate · SIMULACIÓN = un SUPUESTO aplicado sobre el dato REAL (base única = real) ─────────────
 * NO es un escenario del negocio (nada de bonanza/tensión/crisis · no invoca el motor de escenarios). Lee la base real
 * (_loadReal), aplica el transform explícito, y arma la tabla ACTUAL vs SUPUESTO vs Δ con FÓRMULA por celda. La boleta
 * marca cada cifra: actual = source:"actual" · supuesto/Δ = source:"computed" + formula (auditable). Fuera de la allow-list
 * (o transform no soportado) → null → el seam degrada honesto ("puedo leer X actual, pero ese supuesto no está habilitado"). */
// métricas que admiten un supuesto delta-% (NIVELES monetarios que escalan linealmente · NO tasas/ratios: margen/rotación/DOH)
const _SIMULABLE_DELTA_PCT = new Set(["ventas", "contribucion", "capital"]);
const _sgn = (v) => (v >= 0 ? "+" : "");

// ── VEREDICTO DE CALIDAD (B · owner 2026-07-06): juzga el BLOQUE 80% contra DOS niveles — promedio INTERNO (cartera,
//    siempre disponible) + benchmark DECLARADO (POLICY · NUNCA inventado). Graduado: coinciden → fuerte · difieren →
//    mixto. Si no hay cruce/benchmark → "sin_benchmark" honesto. El LLM NO juzga: ADI calcula, el LLM narra.
//    Cruce por métrica: ventas/contribución → margen · capital → rotación (ambos higherIsBetter). ────────────────────
const _QUALITY_CROSS = { ventas: "margen", contribucion: "margen", capital: "rotacion" };

// mapa entidad→valor del cruce (reusa el patrón de composeSpecSimulate: group-by con agg, o por-fila)
function _crossByEntity(crossMetric, dimension) {
  const cm = METRICS[crossMetric], sba = cm && cm.sourceByAxis && cm.sourceByAxis[dimension], ent = ENTITIES[dimension];
  if (!sba || !ent) return null;
  const rows = _loadReal(sba.source);
  if (!Array.isArray(rows) || !rows.length) return null;
  const field = sba.field, map = {};
  if (ent.isGroupBy) {
    const groups = {};
    for (const r of rows) { const k = r[ent.keyField]; if (k == null) continue; (groups[k] = groups[k] || []).push(r); }
    const agg = sba.agg || "avg";
    for (const [name, grp] of Object.entries(groups)) {
      const vals = grp.map((r) => r[field]).filter((v) => typeof v === "number"), sum = vals.reduce((a, b) => a + b, 0);
      map[name] = agg === "sum" ? sum : (vals.length ? sum / vals.length : 0);
    }
  } else {
    const nameField = (SOURCES[sba.source] && SOURCES[sba.source].keyField) || "sku";
    for (const r of rows) { if (typeof r[field] === "number") map[r[nameField]] = r[field]; }
  }
  return map;
}

export function computeQualityVerdict({ metric, dimension, items, blockCount } = {}) {
  const _none = (reason) => ({ verdict: "sin_benchmark", basis: null, explanation: reason });
  const crossMetric = _QUALITY_CROSS[metric];
  if (!crossMetric) return _none("No puedo juzgar la calidad de este supuesto con el dato disponible.");
  const cm = METRICS[crossMetric], cross = _crossByEntity(crossMetric, dimension);
  if (!cross || !Object.keys(cross).length) return _none(`No tengo ${cm.label.toLowerCase()} por ${(ENTITIES[dimension] && ENTITIES[dimension].label.sing) || dimension} para juzgar la calidad.`);
  const wavg = (arr) => { let sw = 0, s = 0; for (const it of arr) { const cv = cross[it.name]; if (typeof cv !== "number") continue; const w = Math.abs(it.actual) || 0; s += cv * w; sw += w; } return sw ? s / sw : null; };
  const blockVal = wavg((items || []).slice(0, blockCount || 0)), internalAvg = wavg(items || []);
  if (blockVal == null || internalAvg == null) return _none(`No puedo cruzar ${cm.label.toLowerCase()} con este bloque.`);
  const declared = crossMetric === "margen" ? POLICY.benchmark : crossMetric === "rotacion" ? POLICY.rotacionMin : null;
  const aboveInternal = blockVal >= internalAvg, aboveDeclared = declared != null ? blockVal >= declared : aboveInternal;
  const verdict = (aboveInternal && aboveDeclared) ? "buena_captura" : (!aboveInternal && !aboveDeclared) ? "captura_debil" : "mixta";
  const u = cm.unit, f = (v) => u === "pct" ? `${v.toFixed(1)}%` : u === "ratio" ? `${v.toFixed(1)}x` : String(Math.round(v));
  const bF = f(blockVal), iF = f(internalAvg), dF = declared != null ? f(declared) : null;
  let explanation;
  if (crossMetric === "margen") {
    explanation = verdict === "buena_captura" ? `El bloque captura buen margen: ${bF} vs ${iF} de la cartera (benchmark ${dF}). Crecer ahí rinde.`
      : verdict === "captura_debil" ? `El bloque está por debajo en margen: ${bF} vs ${iF} de la cartera (benchmark ${dF}). Crecer ahí suma volumen, no rentabilidad.`
      : `Captura media: ${bF} de margen — ${aboveInternal ? "sobre" : "bajo"} el promedio de cartera (${iF}) pero ${aboveDeclared ? "sobre" : "bajo"} el benchmark (${dF}). Conviene mirar antes de empujar.`;
  } else {
    explanation = verdict === "buena_captura" ? `El bloque rota sano: ${bF} vs ${iF} (mínimo ${dF}). Liberar ahí suelta capital sano.`
      : verdict === "captura_debil" ? `El bloque rota lento: ${bF} vs ${iF} (mínimo ${dF}). Mover ese stock no libera capital real.`
      : `Rotación intermedia: ${bF} vs ${iF} (mínimo ${dF}). Mirar caso a caso antes de mover.`;
  }
  return { verdict, basis: declared != null ? "both" : "internal_avg", crossMetric, crossLabel: cm.label, blockValue: blockVal, blockValueFmt: bF, internalAvg, internalAvgFmt: iF, declared, declaredFmt: dF, aboveInternal, aboveDeclared, explanation };
}

export function composeSpecSimulate({ metric, dimension, filters = {}, transform } = {}) {
  // allow-list v1: solo delta +/-X% sobre métricas de nivel. Lo demás → null → degrade honesto.
  if (!transform || transform.op !== "delta" || transform.unit !== "pct" || !_SIMULABLE_DELTA_PCT.has(metric)) return null;
  const m = METRICS[metric];
  const sba = m && m.sourceByAxis && m.sourceByAxis[dimension];
  const ent = ENTITIES[dimension];
  if (!sba || !ent) return null;

  let rows = _loadReal(sba.source);                       // BASE REAL · sin escenario
  if (!Array.isArray(rows) || !rows.length) return null;
  if (filters.marca)   rows = rows.filter((r) => r && r.marca === filters.marca);
  if (filters.familia) rows = rows.filter((r) => r && r.sfamilia === filters.familia);
  if (filters.bodega)  rows = rows.filter((r) => r && r.bodega === filters.bodega);
  if (!rows.length) return null;

  const field = sba.field;
  let actual;
  if (ent.isGroupBy) {
    const groups = {};
    for (const r of rows) { const k = r[ent.keyField]; if (k == null) continue; (groups[k] = groups[k] || []).push(r); }
    const agg = sba.agg || "sum";
    actual = Object.entries(groups).map(([name, grp]) => {
      const vals = grp.map((r) => r[field]).filter((v) => typeof v === "number");
      const sum = vals.reduce((a, b) => a + b, 0);
      return { name, value: agg === "avg" ? (vals.length ? sum / vals.length : 0) : sum };
    });
  } else {
    const nameField = (SOURCES[sba.source] && SOURCES[sba.source].keyField) || "sku";
    actual = rows.map((r) => ({ name: r[nameField], value: r[field] })).filter((x) => typeof x.value === "number");
  }
  if (!actual.length) return null;
  actual.sort((a, b) => b.value - a.value);

  const pct = transform.value, factor = 1 + pct / 100;    // ej. +3% → 1.03
  const _sc = m.scale && m.scale[dimension];
  const _f = (v) => _fmt(v, m.unit, _sc);                 // MISMO formateador que el texto determinístico
  const items = actual.map((x) => {
    const supuesto = x.value * factor, delta = supuesto - x.value;
    return { name: x.name, actual: x.value, supuesto, delta, aFmt: _f(x.value), sFmt: _f(supuesto), dFmt: _f(delta) };
  });
  const totA = items.reduce((s, it) => s + it.actual, 0), totS = totA * factor, totD = totS - totA;

  // ── CONCENTRACIÓN DEL IMPACTO (80/20) · reusa el PRINCIPIO del Pareto (sentrix/concentration.js): orden desc por Δ +
  //    acumulado + bloque hasta cruzar el 80%. Para un delta PAREJO, Δ_i ∝ actual_i → la concentración del impacto ES la
  //    de la estructura actual (el supuesto la AMPLIFICA) · % REAL, nunca forzado a 80 (honesto, data-driven). ──────────
  const impSorted = items.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const impTot = impSorted.reduce((s, it) => s + Math.abs(it.delta), 0) || 1;
  let _cum = 0;
  const bars = impSorted.map((it) => {
    _cum += Math.abs(it.delta);
    return { name: it.name, value: Math.abs(it.delta), dFmt: it.dFmt, pct: Math.round((Math.abs(it.delta) / impTot) * 100), cumPct: (_cum / impTot) * 100 };
  });
  let blockCount = bars.findIndex((b) => b.cumPct >= 80) + 1;
  if (blockCount <= 0) blockCount = bars.length;
  bars.forEach((b, i) => { b.inBlock = i < blockCount; });
  const blockPct = bars[blockCount - 1] ? Math.round(bars[blockCount - 1].cumPct) : 0;   // % REAL en el corte
  const nEnt = bars.length;
  const single = nEnt === 1;
  const concentrated = !single && blockCount <= Math.ceil(nEnt / 2);   // una minoría explica la mayoría
  const _plural = ent.label.plural || `${ent.label.sing}s`;
  const _fem = new Set(["marca", "familia", "bodega"]).has(dimension);   // concordancia de género (premium · sin "olor a prototipo")
  const _esos = _fem ? "esas" : "esos";

  // ── HISTORIA EJECUTIVA FLUIDA (owner 2026-07-06): SIN títulos visibles. La estructura (qué cambia → dónde se concentra →
  //    qué riesgo → qué haría) ordena el razonamiento INTERNAMENTE; el usuario ve UN texto corrido. Sentrix muestra la tabla.
  const _absTotD = Math.abs(totD), _impPct = Math.abs(pct);   // impacto % = |pct| (delta parejo · consistente con el %)
  const _verb = totD >= 0 ? "suma" : "resta";
  const filt = [filters.marca, filters.familia, filters.bodega].filter(Boolean).join("/");
  const _art = { ventas: "las", contribucion: "la", capital: "el" }[metric] || "el";   // artículo del sustantivo métrica
  const _cambio = metric === "capital" ? "movimiento" : (pct >= 0 ? "crecimiento" : "ajuste");
  const _k = concentrated ? "block" : "spread";
  // Riesgo/Qué-hacer CONDICIONALES por métrica × (bloque concentrado / repartido), como PROSA (no computa calidad · eso es B).
  const _RISK = {
    ventas:       { block: `Si ${_esos} ${_plural} capturan margen, el crecimiento tiene potencia; si solo agregan volumen, puede agrandar una captura débil.`, spread: "Si el crecimiento cae donde hay margen, suma; si solo agrega volumen, agranda una captura débil sin mejorar la calidad." },
    contribucion: { block: "Si ese bloque sostiene su margen, subir la contribución rinde; si no, es aporte sin rentabilidad.",                                  spread: "Si el aporte viene con margen, rinde; si no, es más contribución sin rentabilidad." },
    capital:      { block: `Si ${_esos} ${_plural} son stock que rota, liberar suelta capital sano; si es stock lento, moverlo no libera nada real.`,             spread: "Si el stock que se mueve rota, libera capital sano; si es lento, no libera nada real." },
  };
  const _ACTION = {
    ventas:       { block: "Antes de empujar la cartera completa, revisaría ese bloque contra margen, contribución y carga comercial, y recién ahí decidiría dónde crecer.", spread: "Antes de empujar parejo, cruzaría el crecimiento contra margen, contribución y carga comercial y empujaría donde la captura sea sana." },
    contribucion: { block: "Revisaría ese bloque contra margen y participación, y priorizaría donde el margen acompañe.",                                                    spread: "Cruzaría el aporte contra margen y participación y priorizaría donde rinda." },
    capital:      { block: "Cruzaría ese bloque contra DOH y rotación, y liberaría primero lo que rota sano.",                                                              spread: "Cruzaría el stock contra DOH y rotación y liberaría primero lo que rota sano." },
  };
  const _riskT = (_RISK[metric] || _RISK.ventas)[_k];
  const _actionT = (_ACTION[metric] || _ACTION.ventas)[_k];
  const _reading = single ? `El supuesto recae sobre una sola ${ent.label.sing}.`
    : concentrated ? "El supuesto amplifica la estructura actual."
    : `El supuesto reparte el impacto entre ${nEnt} ${_plural}.`;
  // VEREDICTO DE CALIDAD (B · increment 2): cruza el bloque 80% con margen/rotación · reemplaza el riesgo CONDICIONAL por
  // el veredicto COMPUTADO (ADI ya juzgó). Si no hay cruce/benchmark (sin_benchmark) o el impacto está repartido → cae al
  // framing condicional (no hay bloque nítido que juzgar). El LLM NO juzga: ADI calcula, el LLM narra desde la boleta.
  const quality = computeQualityVerdict({ metric, dimension, items, blockCount });
  const _qOk = concentrated && quality && quality.verdict && quality.verdict !== "sin_benchmark";
  let _verdictS = "", _verdictA = "";
  if (_qOk) {
    const bF = quality.blockValueFmt, iF = quality.internalAvgFmt, dF = quality.declaredFmt, aI = quality.aboveInternal, aD = quality.aboveDeclared;
    if (quality.crossMetric === "margen") {
      _verdictS = quality.verdict === "buena_captura" ? `Y ese bloque captura buen margen —${bF} contra ${dF} del benchmark—, así que el crecimiento rinde.`
        : quality.verdict === "captura_debil" ? `Pero ese bloque captura poco margen —${bF} contra ${dF} del benchmark—, así que crecer ahí suma volumen, no rentabilidad.`
        : `Ese bloque captura margen medio —${bF}, ${aI ? "sobre" : "bajo"} la cartera (${iF}) pero ${aD ? "sobre" : "bajo"} el benchmark (${dF})—, así que conviene mirar caso a caso.`;
      _verdictA = quality.verdict === "buena_captura" ? "Priorizaría crecer ahí, donde el valor efectivamente se captura."
        : quality.verdict === "captura_debil" ? "Antes de empujar parejo, priorizaría dónde el margen acompaña." : "Empujaría selectivo, donde el margen acompañe.";
    } else {
      _verdictS = quality.verdict === "buena_captura" ? `Y ese bloque rota sano —${bF} contra un mínimo de ${dF}—, así que liberar ahí suelta capital real.`
        : quality.verdict === "captura_debil" ? `Pero ese bloque rota lento —${bF} contra un mínimo de ${dF}—, así que mover ese stock no libera capital real.`
        : `Ese bloque rota a ${bF} —${aI ? "sobre" : "bajo"} el promedio (${iF}), sobre el mínimo (${dF})—, así que conviene mirar caso a caso.`;
      _verdictA = quality.verdict === "buena_captura" ? "Priorizaría liberar ese capital."
        : quality.verdict === "captura_debil" ? "Antes de moverlo, destrabaría la rotación." : "Liberaría selectivo, donde rote sano.";
    }
  }
  // HISTORIA · texto corrido, SIN headers (qué cambia · dónde se concentra · VEREDICTO/riesgo · qué haría) · producto
  const _s1 = `Un ${_sgn(pct)}${pct}% lleva ${_art} ${m.label.toLowerCase()}${filt ? ` (${filt})` : ""} de ${_f(totA)} a ${_f(totS)} y ${_verb} ${_f(_absTotD)} sobre el dato real.`;
  const _s2 = single
    ? `El supuesto recae sobre una sola ${ent.label.sing}, así que el impacto es directo.`
    : concentrated
    ? `El punto no es solo el ${_cambio}: el impacto se concentra en ${blockCount} ${_plural} que explican el ${blockPct}%, así que el supuesto amplifica la estructura actual del negocio.`
    : `El supuesto no se apoya en un bloque: reparte el impacto entre ${nEnt} ${_plural}, así que acompaña al tamaño de cada ${ent.label.sing} más que a una parte puntual.`;
  const opener = single ? `${_s1} ${_s2}`
    : _qOk ? `${_s1} ${_s2} ${_verdictS} ${_verdictA}`
    : `${_s1} ${_s2} ${_riskT} ${_actionT}`;

  // BOLETA ESTRUCTURAL · SOLO cifras de estructura (impacto total + concentración). SIN per-entidad → el guard del LLM #2
  // (guardAgainstBoleta) bloquea CUALQUIER cifra por entidad → la enumeración es IMPOSIBLE, no solo desaconsejada. El
  // detalle fila-por-fila vive en evidence.projection (la mesa de Sentrix), auditable, fuera del alcance de la narración.
  const _ctx = `supuesto ${m.label} ${_sgn(pct)}${pct}% sobre el dato real`;
  const bol = [];
  // Supuesto % (owner 2026-08-04, GAP 3 consolidación Parte 2): el % del supuesto EN SÍ (con signo, ej. "-3%") no
  // tenía su PROPIA fig autorizada — solo vivía dentro del texto libre de `_ctx`. Bajo data_only/results_only,
  // composeFromLedger (narrationBlocks.js) declara ese `_ctx` como la línea "Supuesto: …" (requisito del owner:
  // "nunca ocultes el supuesto usado") — sin esta fig, guardC podía rechazar esa cifra por "no autorizada" en un
  // dataset con pocas figs "pct" (verificado con un pool sintético sin ninguna resta/suma que reproduzca el %, ver
  // la sección "GAP 3 · pool adversarial" de _response_contract_parte2_gate.mjs, local no commiteado) — funcionaba
  // por COINCIDENCIA en datasets ricos (14+ figs pct), nunca por construcción. Mismo patrón que "Meta %" en
  // computeGoalAnchor (abajo), que YA hacía esto bien.
  bol.push(fig("Supuesto %", `${_sgn(pct)}${pct}%`, { unit: "pct", raw: pct, context: _ctx, source: "computed", formula: "% del supuesto pedido, aplicado sobre el dato real" }));
  // total actual/supuesto AUTORIZADAS (no mandatory) → NARRATE ON puede usar el before/after sin que el guard obligue a citarlas
  bol.push(fig("Total · actual",       _f(totA),      { unit: m.unit, raw: totA,     context: _ctx, source: "actual" }));
  bol.push(fig("Total · supuesto",     _f(totS),      { unit: m.unit, raw: totS,     context: _ctx, source: "computed", formula: `total actual × ${factor}` }));
  // MANDATORY: impacto total + (bloque 80/20 cuando concentra) → la tesis SIEMPRE los cita. Impacto % AUTORIZADO (no
  // obligatorio): la lectura premium se centra en $ impacto y concentración, no siempre repite el % del supuesto.
  bol.push(fig("Impacto absoluto",     _f(_absTotD),  { unit: m.unit, raw: _absTotD, mandatory: true, context: _ctx, source: "computed", formula: "|supuesto − actual|" }));
  bol.push(fig("Impacto %",            `${_impPct}%`, { unit: "pct",  raw: _impPct,  context: _ctx, source: "computed", formula: "impacto / total actual" }));
  if (concentrated) bol.push(fig("Concentración · bloque", `${blockPct}%`, { unit: "pct", raw: blockPct, mandatory: true, context: _ctx, source: "computed", formula: `${blockCount} ${_plural} acumulan el ${blockPct}% del Δ` }));
  // CALIDAD (B) · autoriza las cifras del veredicto (margen/rotación del bloque · promedio de cartera · benchmark declarado)
  // → la narración puede citarlas y el chip de Sentrix las respalda (misma fuente · coherencia por construcción).
  if (_qOk) {
    const _qu = METRICS[quality.crossMetric].unit;
    bol.push(fig(`Calidad · ${quality.crossLabel.toLowerCase()} del bloque`, quality.blockValueFmt, { unit: _qu, raw: quality.blockValue, context: _ctx, source: "computed", formula: "promedio ponderado del bloque 80%" }));
    bol.push(fig("Calidad · promedio de cartera",  quality.internalAvgFmt, { unit: _qu, raw: quality.internalAvg, context: _ctx, source: "computed", formula: "promedio ponderado de la cartera" }));
    if (quality.declaredFmt != null) bol.push(fig("Calidad · benchmark declarado", quality.declaredFmt, { unit: _qu, raw: quality.declared, context: _ctx, source: "actual", formula: "POLICY (no inventado)" }));
  }

  return {
    opener, suggestions: null, sentrixAction: null,
    evidence: { entityType: dimension, dimension, metrica: metric, metricLabel: m.label, dimLabel: ent.label.sing,
      lens: "cuadro", boleta: bol, factor,
      transform: { op: "delta", value: pct, unit: "pct", base: "real" },
      // projection ENRIQUECIDA (formateados + fórmula) para que Sentrix renderice la tabla sin recomputar
      projection: items.map((it) => ({ name: it.name, actual: it.actual, supuesto: it.supuesto, delta: it.delta,
        aFmt: it.aFmt, sFmt: it.sFmt, dFmt: it.dFmt, formula: `${it.aFmt} × ${factor}` })),
      total: { actual: totA, supuesto: totS, delta: totD, aFmt: _f(totA), sFmt: _f(totS), dFmt: _f(totD) },
      // 80/20 DEL IMPACTO (para el panel Sentrix · barras + acumulado + bloque) + la lectura estructural
      concentration: { bars, blockCount, blockPct, n: nEnt, concentrated, single, impactTotal: impTot, impactTotalFmt: _f(_absTotD) },
      structural: { reading: _reading, risk: _riskT, action: _actionT, concentrated, blockCount, blockPct, plural: _plural },
      // VEREDICTO DE CALIDAD (B) · cruza el bloque 80% con margen/rotación vs promedio interno + benchmark declarado
      quality_verdict: quality },
  };
}

/* ── SIMULATE S2 (owner 2026-07-14 "sí, continúa") · el supuesto sobre una ACCIÓN específica ─────────────────────
 * "¿Qué pasa si llevo la carga al target?" / "¿y si libero el capital detenido?" — acá el supuesto NO es un %:
 * es LA acción que el detector ya cuantificó. Reusa composeSpecDiagnose (una verdad · cero cálculo nuevo) y presenta
 * el $ como PROYECCIÓN con honestidad dura: el efecto directo es cálculo probado por el dato; la reacción del
 * mercado (volumen · precio de salida) NO está en el dato y queda declarada abierta. Los campos source/formula/
 * context de la boleta (reservados para simulate desde [[adi-llm-premium-boleta]]) se usan acá: cifra auditable. */
// entityScope (Etapa 2, owner 2026-08-04): forwarding mecánico a composeSpecDiagnose — "de esos clientes, ¿y si
// bajamos la carga al target?" acota la simulación al subconjunto (antes ignoraba cualquier alcance heredado,
// igual que el resto de las tools pre-Etapa-2). RIESGO DE COPY aceptado (documentado, no funcional): cuando la
// única entidad llega vía entityScope (no vía filters.cliente), la frase "Dónde pega" cae a la variante de lista
// en vez de nombrar la entidad — mismo dato correcto, prosa menos personalizada.
export function composeSpecSimulateCarga({ filters = {}, scenario, entityScope = null } = {}) {
  const diag = composeSpecDiagnose({ filters, scenario, entityScope });
  const F = (diag && diag.evidence && diag.evidence.findings) || [];
  const cg = F.find((f) => f.detector === "carga");
  if (!cg || !cg.items.length) return null;   // carga en/bajo target en ese alcance → el seam declara el límite honesto
  const cliente = filters.cliente || null;
  const top = cg.items.slice(0, 3), t0 = cg.items[0];
  const _ctx = `supuesto: carga comercial → target (${POLICY.targetCarga}%) sobre el dato real`;
  const supuesto = `**El supuesto:** llevar la carga comercial${cliente ? ` de ${cliente}` : ""} a tu target (${POLICY.targetCarga}%). Es una proyección sobre el dato real, no un dato observado.`;
  const efecto = `**El efecto directo:** ${_money(cg.subtotal_usd)} al año vuelven al margen — el cálculo es (carga actual − target) × venta, cuenta por cuenta.`;
  const dondePega = cliente
    ? `**Dónde pega:** en ${cliente} — hoy su carga corre sobre el target y ese valor se va en condiciones y descuentos.`
    : `**Dónde pega:** ${top.map((it) => `${it.entidad} ${_money(it.usd)}`).join(" · ")}${cg.items.length > top.length ? " — y el resto de las cuentas sobre el target completa el total" : ""}.`;
  const limite = `**El límite:** que esa carga corre sobre tu target está probado por el dato, y el monto es cálculo directo. Lo que el dato NO predice es la reacción del volumen: renegociar condiciones puede presionar la venta — ese riesgo queda abierto y se decide cuenta por cuenta.`;
  const decision = `**La decisión:** ${cliente ? `¿lo bajamos a plan con ${cliente}?` : `¿armamos el plan cuenta por cuenta, empezando por ${t0.entidad}?`}`;
  const bol = [
    fig("Target de carga", `${POLICY.targetCarga}%`, { unit: "pct", raw: POLICY.targetCarga, source: "actual", formula: "tu vara (POLICY · no inventado)", context: _ctx }),
    fig("Recuperable · total", _money(cg.subtotal_usd), { unit: "money", raw: cg.subtotal_usd, mandatory: true, source: "computed", formula: "(carga − target) × venta · suma de las cuentas sobre el target", context: _ctx }),
  ];
  for (const it of top) bol.push(fig(`${it.entidad} · Recuperable`, _money(it.usd), { unit: "money", raw: it.usd, source: "computed", formula: `(carga de ${it.entidad} − target) × su venta`, context: _ctx }));
  return {
    opener: [supuesto, efecto, dondePega, limite, decision].join("\n\n"),
    suggestions: [`Cómo recupero la carga de ${cliente || t0.entidad}`],
    sentrixAction: null,
    evidence: { lens: "diagnostico", metrica: "carga", dimension: "cliente", boleta: bol, findings: [cg],
      simulate: { action: "carga_target", target: POLICY.targetCarga }, ...(cliente ? { entidad: cliente } : {}) },
  };
}

// entityScope (Etapa 2, owner 2026-08-04): forwarding mecánico a composeSpecDiagnose — "de esos SKU, ¿y si
// liberamos el capital detenido?" acota la simulación al subconjunto. Mismo riesgo de copy aceptado que
// composeSpecSimulateCarga (arriba): entityScope no alimenta la frase personalizada "Dónde pega", solo filters.bodega.
export function composeSpecSimulateCapital({ filters = {}, scenario, entityScope = null } = {}) {
  const diag = composeSpecDiagnose({ filters, scenario, entityScope });
  const F = (diag && diag.evidence && diag.evidence.findings) || [];
  const cap = F.find((f) => f.detector === "capital");
  if (!cap || !cap.items.length) return null;   // sin capital detenido material → el seam declara el límite honesto
  const top = cap.items.slice(0, 3);
  const _ctx = "supuesto: liberar el capital detenido (dato real)";
  const bodega = filters.bodega || null;
  const supuesto = `**El supuesto:** liberar el capital detenido${bodega ? ` en ${bodega}` : ""}. Es una proyección sobre el dato real, no un dato observado.`;
  const efecto = `**El efecto directo:** vuelven ${_money(cap.subtotal_usd)} de caja — hoy están inmovilizados en ${cap.items.length} SKU que no rotan según tu vara (rotación bajo ${POLICY.rotacionMin}x o más de ${POLICY.dohMax} días).`;
  const dondePega = `**Dónde pega:** ${top.map((it) => `${it.entidad} ${_money(it.usd)}`).join(" · ")}${cap.items.length > top.length ? " — y el resto de los SKU detenidos completa el total" : ""}.`;
  const limite = `**El límite:** qué está detenido y cuánto vale está probado por el dato. Lo que el dato NO fija es el precio real de salida: mover o liquidar stock suele ser a descuento — ese margen queda abierto.`;
  const decision = "**La decisión:** ¿lo bajamos a lista — qué liquidar y qué reubicar primero?";
  const bol = [
    fig("Liberable · total", _money(cap.subtotal_usd), { unit: "money", raw: cap.subtotal_usd, mandatory: true, source: "computed", formula: "suma del capital de los SKU bajo tu vara de rotación", context: _ctx }),
    fig("Rotación mínima", `${POLICY.rotacionMin.toFixed(1)}x`, { unit: "ratio", raw: POLICY.rotacionMin, source: "actual", formula: "tu vara (POLICY · no inventado)", context: _ctx }),
    fig("Cobertura máxima", `${POLICY.dohMax}d`, { unit: "days", raw: POLICY.dohMax, source: "actual", formula: "tu vara (POLICY · no inventado)", context: _ctx }),
  ];
  for (const it of top) bol.push(fig(`${it.entidad} · Liberable`, _money(it.usd), { unit: "money", raw: it.usd, source: "computed", formula: `capital detenido de ${it.entidad}`, context: _ctx }));
  return {
    opener: [supuesto, efecto, dondePega, limite, decision].join("\n\n"),
    suggestions: ["El capital detenido en detalle"],
    sentrixAction: null,
    evidence: { lens: "diagnostico", metrica: "capital", dimension: "sku", boleta: bol, findings: [cap],
      simulate: { action: "liberar_capital" } },
  };
}

/* ── composeSpecSimulateCosto · SIMULACIÓN DE COSTO MEDIO (turno 10 del veredicto de 18 turnos, owner 2026-07-29):
 * "¿y si bajo el costo medio de mis peores SKU un 3%?" — capacidad AUSENTE hasta esta pasada: composeSpecSimulate
 * (genérico, arriba) solo soporta un delta-% LINEAL sobre NIVELES (_SIMULABLE_DELTA_PCT: ventas/contribución/
 * capital); "costo" no escala linealmente sobre el nivel pedido — afecta margen/contribución de forma derivada
 * (venta − costo − rebates), igual que Carga/Capital ya son composers DEDICADOS y no pasan por el genérico. Reusa
 * _marginRows/_benchOf/_scopeRows/_mNombre/_MLBL (MISMA fuente que marginRead/diveCauses — una verdad, cero fuente
 * nueva). SIN TOPE por fila (lección D9 · turno 6 de esta misma auditoría: un tope deja las filas 4+ sin cifra
 * autorizada y el LLM las inventa) — es aritmética barata sobre filas ya traídas, no trae más datos.
 * Fórmula (por fila, un solo camino contable, auditable): costoS = costoA × (1+pct/100); dCosto = costoS − costoA;
 * contribS = contribA − dCosto (costo baja → contribución sube en la MISMA magnitud, rebates/venta constantes);
 * margenS = contribS / venta × 100. Devuelve null (coverage=false honesto) si no hay filas con costo/venta/
 * contribución numéricos en el eje/filtro pedido — mismo patrón que el resto de composeSpecSimulate*. */
// entityScope (Etapa 2, owner 2026-08-03, continuidad conversacional universal): antes esta función pasaba `null`
// HARDCODEADO como 3er arg de `_scopeRows` — CUALQUIER alcance heredado ("de esos SKU, ¿y si bajo el costo medio
// 3%?") se ignoraba en silencio y la simulación corría sobre TODO el eje/filtro. Ahora se forwardea igual que
// composeSpecMargin/Ventas/Contribucion/Inventory (mismo parámetro, mismo mecanismo, cero código nuevo en _scopeRows).
export function composeSpecSimulateCosto({ dimension = "sku", filters = {}, pct, scope = "bajo_benchmark", scenario, entityScope = null } = {}) {
  if (!Number.isFinite(pct)) return null;
  // GUARD DE ABSURDOS (hallazgo del re-barrido de 17 turnos, owner 2026-07-29): sin tope, un pct grande (ej. -150%)
  // deja costoSupuesto NEGATIVO y un margen de >100% narrado como recomendación real, con guardC en verde (la
  // aritmética es internamente consistente, el problema es que el SUPUESTO en sí no es operable). MISMO criterio
  // que el guard de absurdos ya establecido para el `simulate` genérico (answerADIFromSpec.js: 0% no mueve nada,
  // más de ±50% deja de ser un supuesto operable) — UNA sola convención de "rango realista" en todo el producto.
  if (pct === 0) return { unsupported: "Un 0% deja el costo igual — no hay supuesto que proyectar. Dime un porcentaje con dirección (\"¿y si bajo el costo medio 3%?\") y lo corro sobre el dato real." };
  if (Math.abs(pct) > 50) return { unsupported: `Un ${pct > 0 ? "+" : ""}${pct}% ya no es un supuesto operable sobre el costo: a esa escala el costo se vuelve negativo o el negocio cambia por completo, y el dato actual deja de ser una base válida para proyectar. Prueba un rango realista (entre ±1% y ±50%) y lo corro sobre el dato real.` };
  const dim = _MLBL[dimension] ? dimension : "sku";
  const L = _MLBL[dim];
  const rows = _scopeRows(_marginRows(dim, scenario), filters, entityScope)
    .filter((r) => typeof r.costo === "number" && typeof r.venta === "number" && r.venta > 0 && typeof r.contribucion === "number");
  if (!rows.length) return null;
  const candidatos = scope === "all" ? rows : rows.filter((r) => typeof r.margen === "number" && r.margen < _benchOf(r));
  if (!candidatos.length) return null;

  const factor = 1 + pct / 100;
  const items = candidatos.map((r) => {
    const costoS = r.costo * factor;
    const dCosto = costoS - r.costo;                                       // negativo si el costo baja
    const contribS = r.contribucion - dCosto;
    const margenS = r.venta ? +((contribS / r.venta) * 100).toFixed(1) : null;
    return { name: _mNombre(r), costoA: r.costo, costoS, contribA: r.contribucion, contribS,
      dContrib: contribS - r.contribucion, margenA: r.margen, margenS, venta: r.venta };
  });
  const totCostoA = items.reduce((s, it) => s + it.costoA, 0);
  const totCostoS = items.reduce((s, it) => s + it.costoS, 0);
  const totContribA = items.reduce((s, it) => s + it.contribA, 0);
  const totContribS = items.reduce((s, it) => s + it.contribS, 0);
  const totVenta = items.reduce((s, it) => s + it.venta, 0);
  const margenPromA = totVenta ? +((totContribA / totVenta) * 100).toFixed(1) : null;
  const margenPromS = totVenta ? +((totContribS / totVenta) * 100).toFixed(1) : null;
  const totDContrib = totContribS - totContribA;

  // concentración 80/20 sobre |Δcontribución| — MISMO principio que composeSpecSimulate (arriba, línea ~1626)
  const impSorted = items.slice().sort((a, b) => Math.abs(b.dContrib) - Math.abs(a.dContrib));
  const impTot = impSorted.reduce((s, it) => s + Math.abs(it.dContrib), 0) || 1;
  let _cum = 0;
  const bars = impSorted.map((it) => { _cum += Math.abs(it.dContrib); return { name: it.name, value: Math.abs(it.dContrib), pct: Math.round((Math.abs(it.dContrib) / impTot) * 100), cumPct: (_cum / impTot) * 100 }; });
  let blockCount = bars.findIndex((b) => b.cumPct >= 80) + 1;
  if (blockCount <= 0) blockCount = bars.length;
  const blockPct = bars[blockCount - 1] ? Math.round(bars[blockCount - 1].cumPct) : 0;
  const nEnt = items.length;
  const single = nEnt === 1;
  const concentrated = !single && blockCount <= Math.ceil(nEnt / 2);
  const _plural = L.p, _sing = L.s;

  const _ctx = `supuesto: costo medio ${_sgn(pct)}${pct}% sobre ${scope === "all" ? `todos los ${_plural}` : `los ${_plural} bajo benchmark`} (dato real)`;
  // dirección: costo BAJA (pct<0) → contribución SUBE ("recuperando"); costo SUBE (pct>0) → contribución BAJA
  // ("cediendo") — el framing tenía un bug real: usaba |Δ| y "recuperando" SIEMPRE, aunque el supuesto fuera
  // subir el costo (contribución cayendo) — el texto decía "recuperando" sobre una PÉRDIDA (verificado en repro).
  const _dSube = totDContrib >= 0;
  const _verboImpacto = _dSube ? "recuperando" : "cediendo";
  const _verboBloque = _dSube ? "de la recuperación" : "de la caída";
  const opener = `${pct < 0 ? "Bajar" : "Subir"} el costo medio un ${Math.abs(pct)}% en ${nEnt} ${_plural}${scope === "bajo_benchmark" ? " bajo benchmark" : ""} mueve el margen promedio de ${margenPromA}% a ${margenPromS}%, ${_verboImpacto} ${_money(Math.abs(totDContrib) * 1000)} de contribución. ${single ? `El supuesto recae sobre un solo ${_sing}.` : concentrated ? `El impacto se concentra en ${blockCount} ${_plural} que explican el ${blockPct}% ${_verboBloque}.` : `El impacto se reparte entre los ${nEnt} ${_plural}.`} El cálculo es la mecánica contable (costo → contribución → margen); si el proveedor acepta ${pct < 0 ? "bajar" : "subir"} costo, o si cambia calidad/volumen de compra, queda fuera del dato — esa negociación real se decide caso a caso.`;

  const bol = [
    // Supuesto % (owner 2026-08-04, GAP 3 consolidación Parte 2) — MISMA razón que composeSpecSimulate (arriba):
    // el % del supuesto (con signo) no tenía fig propia, solo vivía en `_ctx`; sin esta fig, la línea "Supuesto: …"
    // que composeFromLedger declara bajo data_only/results_only dependía de que el pool de figs "pct" reprodujera
    // el número por resta/suma — cierto en datasets ricos, falso en un pool chico. Ver la sección "GAP 3 · pool
    // adversarial" de _response_contract_parte2_gate.mjs (local, no commiteado).
    fig("Supuesto %", `${_sgn(pct)}${pct}%`, { unit: "pct", raw: pct, context: _ctx, source: "computed", formula: "% del supuesto pedido, aplicado sobre el dato real" }),
    fig("Total · costo actual", _money(totCostoA * 1000), { unit: "money", raw: totCostoA * 1000, source: "actual", context: _ctx }),
    fig("Total · costo supuesto", _money(totCostoS * 1000), { unit: "money", raw: totCostoS * 1000, source: "computed", formula: `costo × (1${_sgn(pct)}${pct}%)`, context: _ctx }),
    fig("Total · contribución actual", _money(totContribA * 1000), { unit: "money", raw: totContribA * 1000, source: "actual", context: _ctx }),
    fig("Total · contribución supuesta", _money(totContribS * 1000), { unit: "money", raw: totContribS * 1000, mandatory: true, source: "computed", formula: "contribución + (costo actual − costo supuesto)", context: _ctx }),
    fig("Impacto · contribución", _money(Math.abs(totDContrib) * 1000), { unit: "money", raw: Math.abs(totDContrib) * 1000, mandatory: true, source: "computed", formula: "Σ costo_i × (−pct%)", context: _ctx }),
    fig("Margen promedio · actual", `${margenPromA}%`, { unit: "pct", raw: margenPromA, source: "actual", context: _ctx }),
    fig("Margen promedio · nuevo", `${margenPromS}%`, { unit: "pct", raw: margenPromS, mandatory: true, source: "computed", formula: "contribución supuesta / venta × 100, ponderado", context: _ctx }),
  ];
  if (concentrated) bol.push(fig("Concentración · bloque", `${blockPct}%`, { unit: "pct", raw: blockPct, mandatory: true, source: "computed", formula: `${blockCount} ${_plural} acumulan el ${blockPct}% del Δ`, context: _ctx }));
  // SIN TOPE por fila (lección D9) — cada candidata trae su costo/margen actual-vs-nuevo YA autorizado
  for (const it of items) {
    bol.push(fig(`${it.name} · Costo actual`, _money(it.costoA * 1000), { unit: "money", raw: it.costoA * 1000, source: "actual", context: _ctx }));
    bol.push(fig(`${it.name} · Costo supuesto`, _money(it.costoS * 1000), { unit: "money", raw: it.costoS * 1000, source: "computed", formula: `costo × (1${_sgn(pct)}${pct}%)`, context: _ctx }));
    if (it.margenS != null) bol.push(fig(`${it.name} · Margen nuevo`, `${it.margenS}%`, { unit: "pct", raw: it.margenS, source: "computed", formula: "(contribución + Δcosto) / venta × 100", context: _ctx }));
    bol.push(fig(`${it.name} · Δ contribución`, _money(Math.abs(it.dContrib) * 1000), { unit: "money", raw: Math.abs(it.dContrib) * 1000, source: "computed", formula: `costo × (${_sgn(pct)}${pct}%)`, context: _ctx }));
  }

  return {
    opener,
    suggestions: [`Bajá el costo con los ${_plural} de mayor impacto`],
    sentrixAction: null,
    evidence: { lens: "cuadro", entityType: dim, dimension: dim, metrica: "costo", boleta: bol,
      transform: { op: "delta", value: pct, unit: "pct", base: "real", metric: "costo" },
      projection: items.map((it) => ({ name: it.name, costoActual: it.costoA, costoSupuesto: it.costoS, margenActual: it.margenA, margenNuevo: it.margenS, dContrib: it.dContrib })),
      total: { costoActual: totCostoA, costoSupuesto: totCostoS, contribActual: totContribA, contribSupuesto: totContribS, margenPromActual: margenPromA, margenPromNuevo: margenPromS },
      concentration: { bars, blockCount, blockPct, n: nEnt, concentrated, single },
    },
  };
}

/* ── SIMULATE S3 · computeGoalAnchor (recommend META-AWARE) ──────────────────────────────────────────────────────
 * La pregunta-objetivo trae un % ("subir un 3% las ventas") → el ancla convierte la meta en $ SOBRE EL DATO
 * ("3% de $100.0M = $3.0M al año") para que el recommend la contraste con los caminos de los detectores.
 * + el camino de TRACCIÓN: la cuenta que más sube vs el año anterior (dato real · sin predicción).
 * Devuelve { pct, dir, metaUsd, metaFmt, baseFmt, baseLabel, metricLabel, phrase, mover, bol } — todo autorizado. */
export function computeGoalAnchor(metric, pct, dir, scenario) {
  const p = Math.abs(Number(pct));
  if (!p || !Number.isFinite(p)) return null;
  const m = METRICS[metric];
  if (!m) return null;
  const _sum = (rows, f) => rows.reduce((s, r) => s + (typeof r[f] === "number" ? r[f] : 0), 0);
  const _sf2 = (met, dim) => (METRICS[met] && METRICS[met].sourceByAxis && METRICS[met].sourceByAxis[dim]) || null;
  let baseUsd = null, baseLabel = null;
  if (metric === "ventas") {
    const s = _sf2("ventas", "cliente"); if (!s) return null;
    baseUsd = _sum(_load(s.source, scenario), s.field) * 1000; baseLabel = "tus ventas actuales";
  } else if (metric === "contribucion") {
    const s = _sf2("contribucion", "cliente"); if (!s) return null;
    baseUsd = _sum(_load(s.source, scenario), s.field) * 1000; baseLabel = "tu contribución actual";
  } else if (metric === "margen") {
    const s = _sf2("margen", "cliente"); if (!s) return null;
    baseUsd = _sum(_load(s.source, scenario), "venta") * 1000; baseLabel = "tu venta base";
  } else if (metric === "capital") {
    const s = _sf2("capital", "sku"); if (!s) return null;
    baseUsd = _sum(_load(s.source, scenario), s.field); baseLabel = "tu capital en inventario";
  } else return null;
  if (!baseUsd) return null;
  const metaUsd = Math.round((baseUsd * p) / 100);
  const metaFmt = _money(metaUsd), baseFmt = _money(baseUsd);
  const _art = { ventas: "las", contribucion: "la", capital: "el", margen: "el" }[metric] || "el";
  const phrase = metric === "margen"
    ? `subir el margen un ${p}% vale ${metaFmt} al año sobre ${baseLabel} (${baseFmt})`
    : metric === "capital"
    ? `bajar el capital un ${p}% libera ${metaFmt} de caja — sobre ${baseFmt} inmovilizados hoy`
    : `${dir === "bajar" ? "bajar" : "subir"} ${_art} ${m.label.toLowerCase()} un ${p}% son ${metaFmt} al año — sobre ${baseFmt} de ${baseLabel}`;
  // TRACCIÓN: la cuenta que YA crece (actual vs anterior del dato real · nada de predicción)
  let mover = null;
  const vs = _sf2("ventas", "cliente");
  if (vs) {
    const movers = _load(vs.source, scenario)
      .filter((r) => typeof r.actual === "number" && typeof r.anterior === "number" && r.anterior > 0)
      .map((r) => ({ nombre: r.nombre, usd: (r.actual - r.anterior) * 1000 }))
      .filter((x) => x.usd > 0)
      .sort((a, b) => b.usd - a.usd);
    if (movers.length) mover = { nombre: movers[0].nombre, usd: movers[0].usd, usdFmt: _money(movers[0].usd) };
  }
  const _ctx = `meta del usuario: ${m.label.toLowerCase()} ${dir === "bajar" ? "-" : "+"}${p}% · anclada al dato real`;
  const bol = [
    fig(`Meta · ${m.label} ${p}%`, metaFmt, { unit: "money", raw: metaUsd, mandatory: true, source: "computed", formula: `${baseFmt} × ${p}%`, context: _ctx }),
    fig(`Base · ${m.label}`, baseFmt, { unit: "money", raw: baseUsd, source: "actual", context: _ctx }),
    fig("Meta %", `${p}%`, { unit: "pct", raw: p, source: "computed", context: _ctx }),
  ];
  if (mover) bol.push(fig(`Ya crece · ${mover.nombre}`, mover.usdFmt, { unit: "money", raw: mover.usd, source: "actual", formula: "venta actual − venta del año anterior", context: "la cuenta que más sube vs el año anterior (dato real)" }));
  return { pct: p, dir: dir === "bajar" ? "bajar" : "subir", metaUsd, metaFmt, baseUsd, baseFmt, baseLabel, metricLabel: m.label, phrase, mover, bol };
}

/* ── composeFollowupRecommendation · FOLLOW-UP EJECUTIVO sobre la última evidencia (owner 2026-07-06) ─────────────────
 * "dime qué hacemos" DESPUÉS de una simulación → recomendación desde la última evidence.transform (NO re-parsea eje/métrica).
 * Determinística · reusa las cifras/estructura ya computadas (pct + bloque 80/20) · misma boleta estructural (guard duro:
 * no inventa, no enumera, no lenguaje de escenario). Decisión primero → por qué → condición → siguiente paso. */
export function composeFollowupRecommendation(evidence) {
  if (!evidence || !evidence.transform || evidence.transform.op !== "delta") return null;
  const t = evidence.transform, st = evidence.structural || {}, con = evidence.concentration || {};
  const pct = t.value, sgn = pct >= 0 ? "+" : "";
  const metric = evidence.metrica, mLabel = String(evidence.metricLabel || metric || "").toLowerCase();
  const plural = st.plural || con.plural || `${evidence.dimLabel || "entidades"}`;
  const blockCount = con.blockCount || st.blockCount || 0, blockPct = con.blockPct || st.blockPct || 0;
  const concentrated = con.concentrated != null ? con.concentrated : !!st.concentrated;
  const _fem = new Set(["marca", "familia", "bodega"]).has(evidence.dimension);
  const _esos = _fem ? "esas" : "esos";
  const crosses = metric === "capital" ? "DOH, rotación y bodega"
    : metric === "contribucion" ? "margen, participación y costo"
    : "margen, contribución y carga comercial";
  const cond = metric === "capital" ? "Si ese capital rota sano, conviene liberarlo; si es stock lento, primero destrabar la rotación."
    : metric === "contribucion" ? "Si ese bloque sostiene su margen, priorizar ahí; si no, revisar precio y costo antes de escalar."
    : "Si ese bloque captura margen, priorizar crecimiento ahí; si solo suma volumen, corregir condiciones, costo o carga comercial antes de vender más.";
  const lead = concentrated
    ? `No empujaría el ${sgn}${pct}% a toda la cartera a ciegas. El impacto se concentra: ${blockCount} ${plural} explican el ${blockPct}%, así que la acción es revisar ese bloque antes de activar crecimiento general.`
    : `No empujaría el ${sgn}${pct}% a ciegas. El impacto está repartido, así que la acción es validar dónde el ${mLabel} es rentable antes de activarlo.`;
  const next = concentrated
    ? `El siguiente paso es cruzar ${_esos} ${blockCount} ${plural} contra ${crosses}.`
    : `El siguiente paso es cruzar el ${mLabel} contra ${crosses} y ver dónde conviene empujar.`;
  const opener = `${lead} ${cond} ${next}`;

  const _ctx = `recomendación sobre supuesto ${mLabel} ${sgn}${pct}%`;
  const bol = [];
  bol.push(fig("Supuesto %", `${Math.abs(pct)}%`, { unit: "pct", raw: Math.abs(pct), context: _ctx, source: "computed", formula: "supuesto aplicado sobre el dato real" }));
  if (concentrated) bol.push(fig("Concentración · bloque", `${blockPct}%`, { unit: "pct", raw: blockPct, mandatory: true, context: _ctx, source: "computed", formula: `${blockCount} ${plural} acumulan el ${blockPct}%` }));
  return {
    text: opener, suggestions: null, sentrixAction: null,   // `text` (shape finalizado que consume la UI · NO `opener`)
    // followup:true → narrate usa el prompt de RECOMENDACIÓN · transform → guard scoped (scrub escenario) · SIN projection/lens
    // (no reabre panel ni muestra botón) · SIN cifras por entidad (enumeración imposible). Lleva structural+concentration
    // para que un explain/meta encadenado siga teniendo el porqué a mano.
    evidence: { followup: true, transform: t, boleta: bol, metrica: metric, metricLabel: evidence.metricLabel, dimLabel: evidence.dimLabel, dimension: evidence.dimension, structural: st, concentration: con },
    route: "followup_recommendation",
  };
}

/* ── buildResumenEjecutivo · la LECTURA del negocio para el INICIO (KPIs + una línea) · data-driven, reusa el diagnose ──
 * KPIs de contexto (ventas/margen/contribución/capital) del dato del escenario + una LECTURA generada de los focos del
 * diagnose (el MISMO motor). Todo se recalcula cuando cambia el dato/escenario. NADA hardcodeado, NADA de texto fijo. */
export function buildResumenEjecutivo(scenario) {
  const cv = _load("clientesVentas", scenario), cm = _load("clientesMargen", scenario), inv = _load("skuInventario", scenario);
  const _sum = (arr, f) => arr.reduce((s, r) => s + (typeof r[f] === "number" ? r[f] : 0), 0);
  const ventasK = _sum(cv, "actual"), ventaBaseK = _sum(cm, "venta"), contribK = _sum(cm, "contribucion"), capital = _sum(inv, "stockUSD");
  const margenProm = ventaBaseK ? (contribK / ventaBaseK) * 100 : 0;
  // `key` (Mesa 2.0 · aditivo): el semáforo de la Mesa (buildMesaEstado) se une por key, no por label ni orden.
  const kpis = [
    { key: "ventas",       label: "Ventas del período",    value: _money(ventasK * 1000) },
    { key: "margen",       label: "Margen promedio",       value: `${margenProm.toFixed(1)}%` },
    { key: "contribucion", label: "Contribución",          value: _money(contribK * 1000) },
    { key: "capital",      label: "Capital en inventario", value: _money(capital) },
  ];
  // LECTURA: sale de los focos del diagnose (mismo motor · data-driven) · si no hay fugas materiales, lo dice honesto
  const diag = composeSpecDiagnose({ filters: {}, scenario });
  let lectura = "Todo lo que veo está sobre su benchmark y con el capital rotando — sin fugas materiales por ahora.";
  const F = diag && diag.evidence && diag.evidence.findings;
  // APERTURA PROACTIVA (asesor · Frente A.3): los focos también salen ESTRUCTURADOS (detector + $ + entidad) para que el
  // hero los vuelva BOTONES de arranque ("¿por cuál empezamos?") — mismos subtotales del diagnose (una verdad, cero recalculo).
  const focos = [];
  if (F && F.length) {
    const by = (d) => F.find((x) => x.detector === d);
    const mg = by("margen"), cg = by("carga"), cap = by("capital"), parts = [];
    if (mg && mg.items[0]) { parts.push(`${_money(mg.subtotal_usd)} de contribución no capturada vs benchmark (arranca por ${mg.items[0].entidad})`); focos.push({ detector: "margen", usd: mg.subtotal_usd, usdFmt: _money(mg.subtotal_usd), label: "sobre la mesa en margen", entidad: mg.items[0].entidad }); }
    if (cg) { parts.push(`${_money(cg.subtotal_usd)} recuperable en carga comercial`); focos.push({ detector: "carga", usd: cg.subtotal_usd, usdFmt: _money(cg.subtotal_usd), label: "recuperable en carga", entidad: cg.items[0] && cg.items[0].entidad }); }
    if (cap) { parts.push(`${_money(cap.subtotal_usd)} de capital detenido en ${cap.items.length} SKU`); focos.push({ detector: "capital", usd: cap.subtotal_usd, usdFmt: _money(cap.subtotal_usd), label: `detenido en ${cap.items.length} SKU`, entidad: null }); }
    lectura = `${F.length} ${F.length === 1 ? "foco" : "focos"} donde se pierde margen o se inmoviliza capital: ${parts.join(" · ")}. ¿Por cuál empezamos?`;
  }
  return { kpis, lectura, focos };
}
