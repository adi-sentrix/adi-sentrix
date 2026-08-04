/* === src/adi/oracle/toolRegistry.js · ARQUITECTURA C · CATÁLOGO DE TOOLS-ORÁCULO ===
 * Fase 1 (aún en sombra). Una tool-oráculo es una función PURA  args → { facts, boleta, coverage }:
 *   · facts    datos estructurados para que el LLM RAZONE (filas, métricas, focos) — NO prosa.
 *   · boleta   fig[] · las cifras AUTORIZADAS de esta call (primera clase · byte-igual a la del composer).
 *   · coverage { supported, reason? } · qué pudo traer y qué NO (el LLM lo LEE y redirige honesto).
 *
 * Re-expone los composeSpec* del motor sellado QUITÁNDOLES opener/suggestions/sentrixAction: el MISMO cálculo
 * verificado, empaquetado como dato que el LLM consulta. NO recalcula, NO toca el motor. Verificado byte-igual
 * (boleta) contra cada composer por `_oracle_fase1_gate.mjs`, en varios escenarios.
 *
 * COLAPSAR EL `focus`: hoy un detector regex (marginFocus.js…) decide el foco desde la query. Acá el foco es un ARG
 * del plan → la decisión pasa del regex al LLM. `diagnose` ya es rico por diseño (devuelve TODOS los focos en una
 * call). NO importado por el pipeline vivo en Fase 1 (sigue en sombra).
 */
import {
  composeSpecRetrieval, composeSpecDive, composeSpecCompare, composeSpecDiagnose,
  composeSpecResumenEjecutivo, composeSpecInventory, composeSpecMargin, composeSpecVentas,
  composeSpecContribucion, composeSpecSimulate, composeSpecSimulateCarga, composeSpecSimulateCapital, composeSpecSimulateCosto,
} from "../specRetrieval.js";
import { CONCEPT_DEFS, matchConcept } from "../sentrix/glossary.js";   // definiciones AUTORIZADas (antídoto al "inventa algo")
import { fig } from "../boleta.js";                                    // cifra autorizada (para inyectar el benchmark en el perfil)
import { POLICY, costModelOf, benchmarkOf } from "../../config/businessPolicy.js";  // la VARA (benchmark de margen) para anclar el juicio + el modelo de costo declarado (#56)
import { buildEntityRecord, buildGrid, buildTension, guessDimension, rawRecordFor, REFERENCIA_CAMPO, fieldLabel } from "./entityRecord.js";  // la FILA COMPLETA de una entidad + LA GRILLA (top-N × columnas) + LA TENSIÓN (cruce de 2 métricas del mismo eje) + a qué eje pertenece un nombre + la vara autorizada por campo
import { composeSpecTemporal, detectPeriodo } from "../composers/temporalTable.js";  // LA SERIE MENSUAL (evolutivo · misma verdad que Sentrix · honestidad declarada)
import { buildGlobalEvolution } from "../sentrix/temporal.js";                       // la curva REAL del negocio (para el marco temporal y la dirección ya calculada)

// ── $ EN MILES → $ FORMATEADO (la trampa de escala · owner "el motor le entrega la sábana, sin trampas") ──────────
// Las tablas comerciales del dato guardan el dinero en MILES (venta: 17000 = $17.0M). El LLM leía ese crudo en los
// facts y escribía "$17,000" — mal por 1000×. El guard lo bloqueaba (bien) → C se abstenía (la clase de abstención $
// que arrastrábamos). FIX EN LA FUENTE: el motor entrega el dinero YA FORMATEADO, así el LLM no puede equivocar la
// escala y la cifra formateada queda autorizada por enrichFromFacts. Las claves son las mismas del mapa de entityRecord
// (venta/costo/contribución/rebate/presupuesto/anterior/actual = miles); stockUSD/precioLista/costoMedio son crudas y
// NO se tocan; `usd` tampoco (ya lo maneja el enricher). PURO: clona, no muta la evidence del composer.
const _MONEY_K = /^(venta|ventas|ventaAnt|costo|costos|contribucion|contribucionAnt|rebates|rebate|presupuesto|anterior|actual)$/;
const _moneyK = (vK) => { const v = vK * 1000, a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };
const _moneyRaw = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };
function _fmtMoneyFacts(node) {
  if (Array.isArray(node)) return node.map(_fmtMoneyFacts);
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = (typeof v === "number" && Number.isFinite(v) && _MONEY_K.test(k)) ? _moneyK(v) : _fmtMoneyFacts(v);
    }
    return out;
  }
  return node;
}

// _pack(composerResult, reasonIfNull) → contrato uniforme {facts, boleta, coverage}. facts = evidence SIN la boleta
// (que va aparte) ni el ruido de presentación. coverage.supported=false cuando el composer degrada honesto (null).
function _pack(r, reasonIfNull = "no soportado o sin datos para estos parámetros") {
  if (!r || !r.evidence) return { facts: null, boleta: [], coverage: { supported: false, reason: reasonIfNull } };
  const ev = r.evidence;
  const { boleta, lens, ...rest } = ev;   // lens es ruteo de UI, no dato — fuera de facts
  const facts = _fmtMoneyFacts(rest);     // el $ en miles llega formateado (sin trampa de escala)
  return { facts: { lens, ...facts }, boleta: Array.isArray(boleta) ? boleta : [], coverage: { supported: true, figCount: Array.isArray(boleta) ? boleta.length : 0 } };
}

// ── EL CATÁLOGO ─────────────────────────────────────────────────────────────────────────────────────────────────
// Cada tool declara sus args (los que el LLM pondrá en el plan) y forwardea al composer. Los args internos
// (entityScope, gap, pivotFocus, negativo, pct, staleDays) se forwardean si vienen, para no perder capacidad.

// ── GUARD DE CRUCE IMPOSIBLE (owner 2026-07-28: "el determinístico mata todo, el LLM debe guiar") ────────────────
// Los composers solo aplican filtros conocidos (_scopeRows: marca/familia/bodega/cliente · queryMetric: sin cliente).
// Si el plan pide un filtro que NO existe (ej. "qué cliente compra el SKU X" → filtro SKU), el composer lo IGNORABA y
// devolvía el total como si fuera la respuesta (cifras reales, PREGUNTA equivocada). Acá lo detectamos → coverage=false
// honesto → el narrador GUÍA. `allowed` = las keys que ESE composer sí aplica. Empty/null NO dispara (no es un cruce).
const _SCOPE_KEYS = ["marca", "familia", "bodega", "cliente"];
const _isObj = (f) => f && typeof f === "object" && !Array.isArray(f);
function _crossGuard(filters, allowed) {
  if (filters == null) return null;
  if (!_isObj(filters)) return String(filters).trim()
    ? { supported: false, cross: true, reason: "no tengo ese cruce — esa granularidad no está en el dato", alternativas: [] } : null;
  const bad = Object.keys(filters).filter((k) => filters[k] != null && filters[k] !== "" && !allowed.includes(k));
  return bad.length
    ? { supported: false, cross: true, reason: `no tengo el detalle cruzado por ${bad.join("/")} — esa granularidad no está en el dato`, alternativas: [] } : null;
}
const _crossFail = (cov) => ({ facts: null, boleta: [], coverage: cov });

// queryMetric · ranking/lista de una métrica × un eje (ventas por cliente, margen por marca…). entityScope (Etapa 2,
// owner 2026-08-03, continuidad conversacional universal): forwarding mecánico a composeSpecRetrieval — "de esos
// SKU, ¿cuál vendió más?" acota el ranking al subconjunto en vez de traer el eje entero.
function queryMetric({ metric, dimension, filters = {}, scenario, limit = null, sort = null, entityScope = null } = {}) {
  // REDIRECT A ENTIDAD PUNTUAL (owner "unidades vendidas por Falabella" 2026-07-29, hallazgo en vivo): si el plan
  // filtra el EJE por SÍ MISMO (dimension:"cliente", filters:{cliente:"Falabella"}) en realidad pidió LA FILA de
  // una entidad concreta, no un ranking — es el mismo error de tool que "el costo medio de Sodimac" con
  // entityProfile/dimension errada, versión queryMetric. composeSpecRetrieval NO filtra por cliente (ranking≠fila
  // puntual — ver comentario abajo) y el crossGuard rechazaría esto honesto pero FALSO ("no tengo ese cruce")
  // aunque el dato SÍ existe: solo que en la fila completa. Mismo dato, mejor tool — entityRecord la trae entera
  // (incluye 'unidades', el campo que motivó este fix) y además se autocorrige de eje si hiciera falta.
  if (_isObj(filters) && filters[dimension] != null && filters[dimension] !== "") {
    return entityRecord({ dimension, entity: filters[dimension] });
  }
  const x = _crossGuard(filters, ["marca", "familia", "bodega"]);   // el retrieval NO filtra por cliente
  if (x) { x.alternativas = [`${metric} por ${dimension}`]; return _crossFail(x); }
  return _pack(composeSpecRetrieval({ metric, dimension, filters: _isObj(filters) ? filters : {}, scenario, limit, sort, entityScope }),
    `la métrica '${metric}' no está declarada para el eje '${dimension}'`);
}

// entityProfile · perfil de UNA entidad: todas sus métricas del contrato (el "quién es" de un cliente/marca/SKU).
// Inyecta el BENCHMARK de margen (la vara) para que el narrador NO adule un margen que está bajo el estándar.
function entityProfile({ dimension, entity, scenario } = {}) {
  let dim = dimension;
  let raw = composeSpecDive({ dimension: dim, entity, scenario });
  // AUTO-CORRECCIÓN DE EJE (owner "Sodimac es cliente, no marca" 2026-07-29, hallazgo en vivo): el nombre de una
  // entidad NO revela su tipo por el fraseo de la pregunta — "el costo medio de X" no dice si X es cliente, marca
  // o SKU, y el plan a veces adivina mal el `dimension` aunque haya entendido bien A QUÉ entidad se refería. Si el
  // eje declarado no la encuentra, reintentá con guessDimension — el MISMO mecanismo data-driven que ya usa
  // `trend` para inferir el eje desde el nombre — antes de declinar. El motor se autocorrige; no depende de que el
  // prompt adivine bien un dato que el LLM del plan no tiene forma de conocer de antemano.
  if (!raw && entity != null) {
    const guessed = guessDimension(entity);
    if (guessed && guessed !== dim) { dim = guessed; raw = composeSpecDive({ dimension: dim, entity, scenario }); }
  }
  const r = _pack(raw, `no encuentro a '${entity}' en el eje '${dimension}'`);
  // INTEGRIDAD #1 (auditoría adversarial 2026-07-31, CONFIRMADO en vivo): esto leía POLICY.benchmark CRUDO — ni
  // el benchmark por-fila del dato, ni sobre todo el `_benchmarkOverride` del usuario (C.2, "mi margen mínimo es
  // 28%") — así que con un criterio activo ADI narraba la vara vieja mientras kpis.js/evidenceSpec.reference ya
  // mostraban la correcta, MISMA entidad, MISMO turno. benchmarkOf(rawRec) es el ÚNICO punto que respeta la
  // precedencia real (criterio > fila > POLICY) — el mismo que ya usa REFERENCIA_CAMPO.margen (entityRecord.js).
  if (r.coverage && r.coverage.supported) {
    const rawRec = rawRecordFor(dim, entity);
    const bench = benchmarkOf(rawRec);
    if (typeof bench === "number" && isFinite(bench)) {
      r.facts = { ...r.facts, benchmarkMargen: `${bench}%`, nota: "compará el margen contra el benchmark antes de calificarlo" };
      r.boleta = [...r.boleta, fig("Benchmark de margen", `${bench}%`, { unit: "pct", context: "la vara" })];
      // BRECHA de margen (benchmark − margen) autorizada: el "por qué cede margen" la narra naturalmente (evita abstención).
      const mM = Array.isArray(r.facts.metrics) && r.facts.metrics.find((m) => /margen/i.test(m.label || "") && typeof m.value === "number");
      if (mM && mM.value < bench) {
        const gap = +(bench - mM.value).toFixed(1);
        r.facts = { ...r.facts, brechaMargen: `${gap}%` };
        r.boleta = [...r.boleta, fig(`${entity} · brecha de margen`, `${gap}%`, { unit: "pct", context: "benchmark − margen" })];
      }
    }
  }
  return r;
}

// entityRecord · LA FILA COMPLETA de una entidad: TODAS sus columnas reales del dato (unidades, valor de inventario,
// rotación, cobertura, días sin venta, estado, ventas, margen, contribución, rebate, precio…). Para preguntas
// concretas de campo ("unidades del SKU X", "el rebate de Falabella", "todo de LG-DRYER8KG"). El LLM lee lo que
// necesita y calcula si hace falta. Cada columna-cifra va autorizada → no inventa.
function entityRecord({ dimension, entity } = {}) {
  let dim = dimension;
  let r = buildEntityRecord(dim, entity);
  // AUTO-CORRECCIÓN DE EJE · mismo mecanismo que entityProfile (ver su comentario arriba): el plan puede acertar
  // la entidad y errar el eje ("Sodimac" con dimension:"marca") — reintentá con guessDimension antes de declinar.
  if (!r && entity != null) {
    const guessed = guessDimension(entity);
    if (guessed && guessed !== dim) { dim = guessed; r = buildEntityRecord(dim, entity); }
  }
  if (!r) return { facts: null, boleta: [], coverage: { supported: false, reason: `no encuentro '${entity}' en el eje '${dimension}'` } };
  // REFERENCIA AUTORIZADA por campo (owner "piensa bien" 2026-07-29, contrato de lectura mínima): si esta fila
  // trae un campo con vara declarada (margen/carga/rotación/cobertura), autorizamos TAMBIÉN esa vara real —
  // benchmarkOf/POLICY, la MISMA que ya usan diagnose/marginRead/mechanisms.js — para que cualquier narración
  // (determinística o libre) pueda citarla sin que el guard la rechace. Nunca un promedio de cartera inventado.
  const rawRec = rawRecordFor(dim, entity);
  let boleta = r.boleta;
  if (rawRec) for (const [token, refDef] of Object.entries(REFERENCIA_CAMPO)) {
    const lbl = fieldLabel(token);
    if (lbl == null || r.facts[lbl] == null) continue;   // esta fila no trae ese campo → sin vara que autorizar
    const refValue = refDef.getRef(rawRec);
    if (typeof refValue !== "number" || !isFinite(refValue)) continue;
    if (boleta.some((f) => f.label === refDef.label)) continue;
    boleta = [...boleta, fig(refDef.label, refDef.fmt(refValue), { unit: refDef.unit, context: "vara" })];
  }
  // lens:"cuadro" · SENTRIX ES LA EVIDENCIA (owner 2026-07-28): sin esto el panel no tenía forma de saber qué mostrar
  // para esta tool propia (las demás heredan `lens` de su composer wrapeado) → el ranking de ${dimension} se abre con
  // esta entidad ya nombrada en la boleta (el punto celeste del espejo la marca). Mismo patrón que usa `_pack`.
  return { facts: { ...r.facts, lens: "cuadro" }, boleta, coverage: { supported: true, figCount: boleta.length } };
}

// tensionRead · TENSIÓN sostener-vs-consumir (turno 14 del veredicto de 18 turnos): cruza DOS métricas del MISMO
// eje (ej. contribución vs capital de los SKU) y devuelve el top-N de cada una YA CRUZADO (quién aparece en ambos
// rankings, quién solo en uno) — antes esto disparaba 2 tool-calls de EJES DISTINTOS que el narrador mezclaba sin
// declarar el mismatch. Si el eje no tiene ambas columnas (cliente/marca/familia no tienen capital), degrada
// HONESTO con la razón exacta (no hay tabla puente eje↔SKU en el dato) — nunca inventa el cruce.
// entityScope (Etapa 2, owner 2026-08-03): forwarding mecánico a buildTension — "de esos SKU, ¿quién sostiene
// contribución vs consume capital?" cruza solo el subconjunto en vez del eje entero.
function tensionRead({ dimension, metricA = "contribucion", metricB = "stockUSD", limit = 10, dirA = "desc", dirB = "desc", entityScope = null } = {}) {
  const r = buildTension(dimension, { metricA, metricB, limit, dirA, dirB, entityScope });
  if (!r) return { facts: null, boleta: [], coverage: { supported: false, reason: `no puedo cruzar esas dos métricas por '${dimension}'` } };
  if (r.unsupported) return { facts: null, boleta: [], coverage: { supported: false, reason: r.unsupported } };
  return { facts: { ...r.facts, lens: "cuadro", entityType: dimension }, boleta: r.boleta, coverage: { supported: true, figCount: r.boleta.length } };
}

// gridTable · LA GRILLA: los top-N de una dimensión (cliente/sku/marca/familia) con TODAS sus columnas, para que el
// LLM arme una TABLA multi-columna. sortBy = por qué campo rankear (venta/contribucion/stockUSD/rotacion/margen…).
// Ej: "los 5 mejores SKU con ventas, costo medio, precio y margen de contribución" → {dimension:"sku",sortBy:"venta",limit:5}.
// entityScope (Etapa 2, owner 2026-08-03): forwarding mecánico a buildGrid — "de esos clientes, armame la tabla"
// acota la grilla al subconjunto en vez de traer el top-N del eje entero.
function gridTable({ dimension, sortBy = null, dir = "desc", limit = 20, entityScope = null } = {}) {
  const r = buildGrid(dimension, { sortBy, dir, limit, entityScope });
  if (!r) return { facts: null, boleta: [], coverage: { supported: false, reason: `no puedo armar la grilla del eje '${dimension}'` } };
  // lens:"cuadro" + entityType (SENTRIX ES LA EVIDENCIA): abre el Cuadro de mando en ESTE eje — las filas que ADI
  // acaba de nombrar en la tabla quedan marcadas (espejo vía boleta), en vez de dejar el panel en lo que mostraba antes.
  return { facts: { ...r.facts, lens: "cuadro", entityType: dimension }, boleta: r.boleta, coverage: { supported: true, figCount: r.boleta.length, rowCount: r.facts.count } };
}

// compareEntities · dos entidades lado a lado, métrica por métrica (+ participación).
function compareEntities({ dimension, entities, scenario } = {}) {
  return _pack(composeSpecCompare({ dimension, entities, scenario }),
    `necesito dos entidades del eje '${dimension}' que existan en el dato`);
}

// _tagBodegaConflation(r) → notaBodega en el foco "capital" (owner 2026-07-31, hallazgo EN VIVO, certificación
// integral): cada item YA trae su propia bodega correcta (`_diagCapital`, specRetrieval.js) — pero medido en vivo,
// al nombrar 2+ SKU críticos juntos el narrador a veces colapsa ambos a UNA sola bodega ("LG-DRYER8KG y MAK-COMP-AIR
// en Valparaíso", cuando MAK-COMP-AIR está en Antofagasta) — reproducido 2/3 en la misma conversación, en TANTO
// diagnose como executiveSummary (mismo `findings` shape, mismo riesgo). Mismo patrón que `otro_estado_del_inventario`
// en inventoryStatus (abajo): una nota explícita en facts que hace la distinción imposible de perder, en vez de
// confiar en que el LLM la derive de items[].bodega. Solo aparece si de verdad hay MÁS de una bodega — no ensucia
// el caso simple (compartida por defecto en la mayoría de escenarios/tenants).
function _tagBodegaConflation(r) {
  const cap = r.facts && Array.isArray(r.facts.findings) && r.facts.findings.find((f) => f && f.detector === "capital");
  if (cap && Array.isArray(cap.items)) {
    const bodegas = new Set(cap.items.map((it) => it.bodega).filter(Boolean));
    if (bodegas.size > 1) {
      cap.notaBodega = `cada SKU tiene SU PROPIA bodega, NO una compartida: ${cap.items.map((it) => `${it.entidad}→${it.bodega || "sin bodega"}`).join(", ")}`;
    }
  }
  return r;
}

// diagnose · RICO por diseño: barre TODOS los detectores (contribución no capturada · carga alta · capital detenido)
// y los rankea por $. `focus:"resumen_ejecutivo"` deriva al resumen de 5 movimientos.
// TOLERANTE a un filtro NO-objeto (owner "de los clientes con bajo margen, cuál corregir primero": el plan a veces
// manda un STRING libre tipo "contribucion no capturada" en vez de un eje — diagnose es la vista panorámica, y
// degradar a "todo el negocio" (silencioso) sirve más que rechazar el turno entero. Una KEY de objeto inválida
// (ej. {state:"x"}) sí sigue rechazando — ahí hay un intento deliberado de cruce que de verdad no existe.
// entityScope (Etapa 2, owner 2026-08-04): forwarding mecánico a composeSpecDiagnose — "de esos clientes, ¿dónde
// perdemos plata?" ahora acota el barrido al subconjunto (antes CONSCIENTEMENTE no generalizado — ver toolContracts.js).
function diagnose({ filters = {}, scenario, focus = null, entityScope = null } = {}) {
  const f = _isObj(filters) ? filters : {};
  const x = _crossGuard(f, _SCOPE_KEYS); if (x) return _crossFail(x);
  return _tagBodegaConflation(_pack(composeSpecDiagnose({ filters: f, scenario, focus, entityScope }),
    "no hay focos materiales de pérdida/inmovilización con estos filtros"));
}

// executiveSummary · la lectura completa de 5 movimientos (cómo ganás · margen · dónde perdés · por qué · recuperación).
function executiveSummary({ scenario } = {}) {
  return _tagBodegaConflation(_pack(composeSpecResumenEjecutivo({ scenario }), "no puedo armar el resumen en este escenario"));
}

// inventoryStatus · estado de inventario (capital detenido / frenado / cobertura). `focus` = el estado que interesa.
function inventoryStatus({ filters = {}, scenario, focus = "frenado", staleDays = null, entityScope = null, limit = null } = {}) {
  const x = _crossGuard(filters, _SCOPE_KEYS); if (x) return _crossFail(x);
  const r = _pack(composeSpecInventory({ filters: _isObj(filters) ? filters : {}, scenario, focus, staleDays, entityScope, limit }),
    "no hay señal de inventario para estos filtros");
  // `contrapunta` es OTRO estado del inventario (ej. riesgo de quiebre), INDEPENDIENTE del capital detenido — la clave
  // no lo decía y el LLM la leía como la CAUSA del capital frenado (y mezclaba sus familias con las de los SKU detenidos).
  const inv = r.facts && r.facts.inventory;
  if (inv && inv.contrapunta) {
    const { contrapunta, ...resto } = inv;
    r.facts = { ...r.facts, inventory: { ...resto, otro_estado_del_inventario: {
      ...contrapunta, nota: "estado INDEPENDIENTE del capital detenido — no es su causa, y sus familias no son las de los SKU detenidos",
    } } };
  }
  return r;
}

// marginRead · lectura de margen por eje (bajo benchmark · negativos · brecha). `focus`/`dimension`/`gap` = del plan.
// MEDIDA POR ENTIDAD (owner "cuánto valor se podría recuperar" sobre VARIOS SKU — auditoría en vivo 2026-07-28, D9):
// el composer sellado solo calcula el "cuánto vale cerrar la brecha" (_leverFoco) para dimension:"cliente" — en
// marca/familia/sku el narrador se quedaba con el peor de todos y, al pedirle el valor de VARIOS, inventaba la
// multiplicación (brecha% × venta) por su cuenta, que el guard bloqueaba (correcto) y el turno se perdía. FIX
// ADITIVO (no toca el composer ni sus gates): por CADA entidad bajo benchmark agregamos DOS cifras más, ya
// autorizadas, con la MISMA fórmula que el motor usa para clientes (`_leverFoco`: "Σ venta × benchmark − contribución"):
// (a) "Medida · cerrar brecha en X" = venta × (benchmark − margen) — la recuperación TOTAL si llega al piso (lo que
// pide "cuánto se podría recuperar"); (b) "Medida · 1pp en X" = venta × 1% — la unidad, para dimensionar una mejora parcial.
// SIN TOPE (owner "gate de orden" 2026-07-28: un tope de 5 dejaba a las entidades 6+ SIN cifra autorizada — cuando el
// narrador armaba una tabla de 6-8 filas, la última quedaba sin "Medida" y la inventaba, mal — ej. "$7.6M" fabricado
// para un SKU fuera del tope). Es aritmética simple sobre filas ya traídas, sin costo de traer más datos.
function marginRead({ filters = {}, scenario, focus = "bajo_benchmark", dimension = "cliente", negativo = false, pct = false, gap = null, entityScope = null } = {}) {
  const x = _crossGuard(filters, _SCOPE_KEYS); if (x) return _crossFail(x);
  const raw = composeSpecMargin({ filters: _isObj(filters) ? filters : {}, scenario, focus, dimension, negativo, pct, gap, entityScope });
  const r = _pack(raw, `no hay lectura de margen para el eje '${dimension}' con estos filtros`);
  if (dimension !== "cliente" && r.coverage && r.coverage.supported) {
    const panel = raw && raw.evidence && raw.evidence.margin && raw.evidence.margin.panel;
    const rows = panel && panel.rows;
    const bench = panel && typeof panel.bench === "number" ? panel.bench : null;
    if (Array.isArray(rows)) {
      const seen = new Set(r.boleta.map((f) => f.label));
      const add = (label, usd) => { if (usd > 0 && !seen.has(label)) { seen.add(label); r.boleta.push(fig(label, _moneyRaw(usd), { unit: "money", raw: usd, source: "computed", formula: "venta × (benchmark − margen)", context: "cuánto vale la medida" })); } };
      for (const row of rows.filter((x) => x.below && typeof x.venta === "number")) {
        if (bench != null && typeof row.margen === "number") add(`${row.nombre} · Medida cerrar brecha`, Math.round(row.venta * 10 * (bench - row.margen)));
        const pp1 = Math.round(row.venta * 10);   // venta (miles) × 1000 × 1% = venta × 10 (misma fórmula que _pp1 del composer)
        if (pp1 > 0) { const label = `${row.nombre} · Medida 1pp`; if (!seen.has(label)) { seen.add(label); r.boleta.push(fig(label, _moneyRaw(pp1), { unit: "money", raw: pp1, source: "computed", formula: "venta × 1%", context: "cuánto vale la medida" })); } }
      }
    }
  }
  return r;
}

// salesRead · lectura de ventas por eje (vs período anterior · pivot · brecha).
function salesRead({ filters = {}, scenario, focus = "vs_anterior", dimension = "cliente", gap = null, pivotFocus = null, entityScope = null } = {}) {
  const x = _crossGuard(filters, _SCOPE_KEYS); if (x) return _crossFail(x);
  return _pack(composeSpecVentas({ filters: _isObj(filters) ? filters : {}, scenario, focus, dimension, gap, pivotFocus, entityScope }),
    `no hay lectura de ventas para el eje '${dimension}' con estos filtros`);
}

// contributionRead · lectura de contribución por eje (ranking · no capturada · por entidad).
function contributionRead({ filters = {}, scenario, focus = "rank", dimension = "cliente", entity = null, entityScope = null } = {}) {
  const x = _crossGuard(filters, _SCOPE_KEYS); if (x) return _crossFail(x);
  return _pack(composeSpecContribucion({ filters: _isObj(filters) ? filters : {}, scenario, focus, dimension, entity, entityScope }),
    `no hay lectura de contribución para el eje '${dimension}' con estos filtros`);
}

// simulate · "¿y si…?" sobre una métrica × eje con un transform (supuesto → efecto). El guard exige graduación (Fase 2).
function simulate({ metric, dimension, filters = {}, transform } = {}) {
  return _pack(composeSpecSimulate({ metric, dimension, filters, transform }),
    "no puedo simular esa combinación métrica/eje/supuesto");
}

// simulateCarga · simulación específica de bajar la carga comercial al target.
// entityScope (Etapa 2, owner 2026-08-04): forwarding mecánico a composeSpecSimulateCarga — mismo mecanismo que
// simulateCosto (abajo), acota la simulación al subconjunto pedido en vez de correr sobre el eje comercial entero.
function simulateCarga({ filters = {}, scenario, entityScope = null } = {}) {
  return _pack(composeSpecSimulateCarga({ filters, scenario, entityScope }), "no hay carga recuperable para simular");
}

// simulateCapital · simulación específica de liberar capital detenido.
// entityScope (Etapa 2, owner 2026-08-04): forwarding mecánico a composeSpecSimulateCapital — mismo mecanismo.
function simulateCapital({ filters = {}, scenario, entityScope = null } = {}) {
  return _pack(composeSpecSimulateCapital({ filters, scenario, entityScope }), "no hay capital detenido para liberar");
}

// simulateCosto · simulación específica de bajar/subir el costo medio (turno 10 del veredicto de 18 turnos):
// "¿y si bajo el costo medio de mis peores SKU un 3%?" — antes AUSENTE (composeSpecSimulate genérico no cubre
// costo, no escala linealmente sobre el nivel pedido). Mismo estilo simple que simulateCarga/Capital (args planos,
// sin transform anidado): la evidencia en vivo mostró que el planner no arma el `transform` del tool genérico ni
// para las métricas que SÍ soporta — necesita un tool con nombre propio y ejemplo en prosa, igual que Carga/Capital.
// entityScope (Etapa 2, owner 2026-08-03): forwarding mecánico a composeSpecSimulateCosto — "de esos SKU, ¿y si
// bajo el costo medio 3%?" acota la simulación al subconjunto (antes ignoraba cualquier alcance heredado).
function simulateCosto({ dimension = "sku", filters = {}, pct, scope = "bajo_benchmark", scenario, entityScope = null } = {}) {
  const r = composeSpecSimulateCosto({ dimension, filters, pct, scope, scenario, entityScope });
  if (r && r.unsupported) return { facts: null, boleta: [], coverage: { supported: false, reason: r.unsupported } };
  return _pack(r, `no hay ${scope === "all" ? "" : "SKU bajo benchmark "}para simular costo con estos filtros`);
}

// ── simulateGeneral · "simulate v2" (owner 2026-07-31, #56) ────────────────────────────────────────────────────
// Brecha que las tools simulate* de arriba NO cubren: cada una mueve UNA palanca sobre TODO un eje (carga/capital/
// costo). Esta cubre "si subo 5% el precio a Falabella pero pierdo 10% de volumen, ¿me conviene?" — DOS variables
// covariando sobre UNA entidad puntual. NO es un evaluador de expresiones abierto: 2 SLOTS FIJOS (precio, volumen),
// nombrados por su campo del F table (precioLista/unidades) — nada de un array abierto, ni acá ni en el primer
// vertical (dimension="cliente" fijo). `request_clarification` (input incompleto: solo UNA variable) se resuelve
// en el PLAN, ANTES de esta call — ver `supuestos_faltantes` en planPrompt.js/answerViaOracle.js; si llegás acá,
// las 2 variables YA están completas.
//
// COMPOSICIÓN MULTIPLICATIVA, no aditiva (el riesgo real de este motor, ver adi-simulate-v2-motor-escenarios.md):
// ventaNueva = ventaActual × (1+Δprecio%) × (1+Δvolumen%) — precio y volumen se MULTIPLICAN sobre la venta
// AUTORIZADA, nunca se reconstruyen desde precioLista×unidades (verificado contra el dato real: esa identidad NO
// se sostiene exacta — difiere ~3-11% del venta/costo oficiales — usarla introduciría un error de base).
//
// MODELO DE COSTO (costModelOf(), businessPolicy.js): costo/margen/contribución SOLO si el tenant declaró
// "variable_total" (costo escala 1:1 con volumen, NUNCA con precio — subir precio no cambia el costo unitario ni
// las unidades vendidas, eso ya lo captura el delta de volumen que el usuario declaró aparte). Ventas SIEMPRE se
// calcula (aritmética pura, no depende del modelo de costo). Sin modelo autorizado: degrade HONESTO a solo-ventas,
// silencioso (NUNCA interrumpe con una pregunta — dos mecanismos de "incompleto" distintos, ver el diseño) — el
// narrador tiene la obligación de NUNCA concluir "conviene/no conviene" con eso solo (narratePromptC.js + guardC).
const _SIM_DELTA_MAX = 50;   // mismo rango operable que simulateCosto (±50%) — arriba deja de ser un supuesto realista
function _simVar(v) {
  if (!v || typeof v !== "object") return null;
  const campo = String(v.campo || "");
  const role = campo === "precioLista" ? "precio" : campo === "unidades" ? "volumen" : null;
  const pct = Number(v.delta_pct);
  if (!role || !Number.isFinite(pct)) return null;
  return { role, pct, campo };
}
function simulateGeneral({ dimension = "cliente", entity, variableA, variableB, scenario } = {}) {
  const a = _simVar(variableA), b = _simVar(variableB);
  if (!a || !b || a.role === b.role) {
    return { facts: null, boleta: [], coverage: { supported: false, reason: "necesito exactamente 2 variables distintas — precio (precioLista) y volumen (unidades), cada una con su % de cambio" } };
  }
  const [precioVar, volumenVar] = a.role === "precio" ? [a, b] : [b, a];
  if (precioVar.pct === 0 && volumenVar.pct === 0) {
    return { facts: null, boleta: [], coverage: { supported: false, reason: "0% en ambas variables no mueve nada — no hay supuesto que proyectar" } };
  }
  for (const [label, v] of [["precio", precioVar], ["volumen", volumenVar]]) {
    if (Math.abs(v.pct) > _SIM_DELTA_MAX) {
      return { facts: null, boleta: [], coverage: { supported: false, reason: `un ${v.pct > 0 ? "+" : ""}${v.pct}% de ${label} ya no es un supuesto operable — probá un rango realista (entre ±1% y ±${_SIM_DELTA_MAX}%) y lo corro sobre el dato real` } };
    }
  }
  let dim = dimension || "cliente";
  let raw = rawRecordFor(dim, entity);
  if (!raw && entity != null) {
    const guessed = guessDimension(entity);
    if (guessed && guessed !== dim) { dim = guessed; raw = rawRecordFor(dim, entity); }
  }
  if (!raw || typeof raw.venta !== "number") {
    return { facts: null, boleta: [], coverage: { supported: false, reason: `no encuentro '${entity}' en el eje '${dimension}'` } };
  }

  const factorPrecio = 1 + precioVar.pct / 100;
  const factorVolumen = 1 + volumenVar.pct / 100;
  const ventaActual = raw.venta, ventaNueva = ventaActual * factorPrecio * factorVolumen;
  const _ctx = `supuesto: precio ${precioVar.pct > 0 ? "+" : ""}${precioVar.pct}% · volumen ${volumenVar.pct > 0 ? "+" : ""}${volumenVar.pct}% sobre ${entity} (dato real)`;
  const _fVenta = `venta × (1${precioVar.pct >= 0 ? "+" : ""}${precioVar.pct}%) × (1${volumenVar.pct >= 0 ? "+" : ""}${volumenVar.pct}%)`;

  // OJO: NO uses claves que matcheen /pct/i acá (ej. "precioPct") — enrichFromFacts (ledger.js) camina `facts`
  // recursivamente y auto-autoriza CUALQUIER número cuya CLAVE matchee ese patrón como fig "% suelto", generando
  // cifras fantasma sin la entidad correcta en el label (bug real cazado en este mismo desarrollo). El supuesto YA
  // viaja legible en el `context` de cada fig de la boleta — no hace falta duplicarlo acá con un nombre riesgoso.
  const facts = { entidad: entity, dimension: dim, deltaPrecio: precioVar.pct, deltaVolumen: volumenVar.pct, ventaActual: _moneyK(ventaActual), ventaNueva: _moneyK(ventaNueva) };
  // assumptions ESTRUCTURADAS (owner 2026-07-31, evidenceSpec) — el `_ctx` de arriba ya trae el supuesto en PROSA
  // (para el fig.context); esto es la MISMA información, {campo, delta} por variable, para que sentrixEvidence.js
  // la levante sin re-parsear el string. OJO (mismo landmine que el comentario de arriba, no alcanza con anidarlo
  // bajo `assumptions`: enrichFromFacts camina TODO `facts` recursivamente sin importar el contenedor, mira cada
  // clave HOJA) — la clave se llama `delta`, NUNCA `delta_pct`/`deltaPct`/similar: cualquier clave que matchee
  // /pct/i quedaría auto-autorizada como un "%" suelto sin la entidad correcta en el label (el bug que ese
  // comentario ya documentó). `delta` no matchea ningún patrón de `_KEYUNIT` → no genera fig fantasma.
  facts.assumptions = [
    { campo: precioVar.campo, delta: precioVar.pct },
    { campo: volumenVar.campo, delta: volumenVar.pct },
  ];
  // Precio/Volumen propuesto COMO FIG DE LA BOLETA (owner 2026-07-31, hallazgo EN VIVO, certificación integral) —
  // sin esto, el % del supuesto (8%, -2%…) SOLO vivía en `facts`/`context`, nunca como una cifra autorizada
  // propiamente dicha. guardC SÍ deja citar una cifra que el usuario nombró en SU PROPIA pregunta (parseFigures del
  // texto de ESTE turno) — pero en un flujo de 2 turnos (precio en el turno 1, volumen en el turno 2, ver
  // mem.pendingSimulation en answerViaOracle.js) el texto de CADA turno individual solo contiene UNA de las dos
  // cifras. Reproducido en vivo: el narrador, correctamente, necesita nombrar AMBOS supuestos para que la
  // simulación se entienda ("si subís el precio a Lider un 8%...") — guardC rechazaba "8%" por no-autorizada en el
  // turno donde solo se contestó el volumen, los 3 intentos se agotaban, y C ABSTENÍA ENTERO (caía al pipeline
  // viejo, que no entiende nada de esto). Estas 2 figs cierran el hueco de raíz, para CUALQUIER camino (1 turno o
  // 2) — no dependen de qué texto haya dicho el usuario en qué turno.
  const boleta = [
    fig(`${entity} · Venta actual`, _moneyK(ventaActual), { unit: "money", raw: ventaActual * 1000, source: "actual", context: _ctx }),
    fig(`${entity} · Venta supuesta`, _moneyK(ventaNueva), { unit: "money", raw: ventaNueva * 1000, mandatory: true, source: "computed", formula: _fVenta, context: _ctx }),
    // SIN "+" manual en positivos (owner, hallazgo en el propio testing de este fix): boleta.js._fmtC formatea
    // pct como `${raw}%` sin signo forzado — un value="+8%" acá generaría canon "pct:+8%", que NUNCA matchea el
    // canon "pct:8%" que parseFigures deriva de la narración real ("un 8%", nunca "un +8%"). Mismo formato que
    // TODO el resto de figs pct de este archivo (Margen actual/supuesto, más abajo) — ninguna fuerza el "+".
    fig(`${entity} · Precio propuesto`, `${precioVar.pct}%`, { unit: "pct", raw: precioVar.pct, source: "actual", context: _ctx }),
    fig(`${entity} · Volumen propuesto`, `${volumenVar.pct}%`, { unit: "pct", raw: volumenVar.pct, source: "actual", context: _ctx }),
  ];

  const costModel = costModelOf();
  if (costModel && costModel.tipo === "variable_total" && typeof raw.costo === "number") {
    // costo escala SOLO con volumen (variable_total) — el precio no mueve el costo unitario ni las unidades.
    const costoActual = raw.costo, costoNuevo = costoActual * factorVolumen;
    const contribActual = ventaActual - costoActual, contribNueva = ventaNueva - costoNuevo;
    const margenActual = ventaActual ? +((contribActual / ventaActual) * 100).toFixed(1) : null;
    const margenNuevo = ventaNueva ? +((contribNueva / ventaNueva) * 100).toFixed(1) : null;
    facts.costModelAutorizado = true;
    facts.costoActual = _moneyK(costoActual); facts.costoNuevo = _moneyK(costoNuevo);
    facts.contribucionActual = _moneyK(contribActual); facts.contribucionNueva = _moneyK(contribNueva);
    facts.margenActual = `${margenActual}%`; facts.margenNuevo = `${margenNuevo}%`;
    boleta.push(
      fig(`${entity} · Costo actual`, _moneyK(costoActual), { unit: "money", raw: costoActual * 1000, source: "actual", context: _ctx }),
      fig(`${entity} · Costo supuesto`, _moneyK(costoNuevo), { unit: "money", raw: costoNuevo * 1000, source: "computed", formula: `costo × (1${volumenVar.pct >= 0 ? "+" : ""}${volumenVar.pct}%)`, context: _ctx }),
      fig(`${entity} · Contribución actual`, _moneyK(contribActual), { unit: "money", raw: contribActual * 1000, source: "actual", context: _ctx }),
      fig(`${entity} · Contribución supuesta`, _moneyK(contribNueva), { unit: "money", raw: contribNueva * 1000, mandatory: true, source: "computed", formula: "venta supuesta − costo supuesto", context: _ctx }),
      fig(`${entity} · Margen actual`, `${margenActual}%`, { unit: "pct", raw: margenActual, source: "actual", context: _ctx }),
      fig(`${entity} · Margen supuesto`, `${margenNuevo}%`, { unit: "pct", raw: margenNuevo, mandatory: true, source: "computed", formula: "contribución supuesta / venta supuesta × 100", context: _ctx }),
    );
  } else {
    // degrade HONESTO, silencioso (owner: "nunca interrumpe con una pregunta, limita el alcance y sigue") — solo
    // ventas queda autorizado; costo/margen/contribución NO se calculan (ni se ponen en boleta) porque el tenant
    // no declaró cómo se comporta su costo. narratePromptC.js/guardC impiden que esto se lea como "conviene".
    facts.costModelAutorizado = false;
    facts.limitacion = "el modelo de costo no está autorizado para este negocio — el cálculo se limita a ventas; no alcanza para concluir impacto en margen, contribución, ni si conviene o no";
  }
  return { facts, boleta, coverage: { supported: true, figCount: boleta.length } };
}

// defineConcept · definición AUTORIZADA de un concepto del negocio (del glosario curado). Antídoto al "inventa algo":
// la definición NO la improvisa el LLM, viene del dato. Devuelve texto (sin cifras). El narrador la dice en su voz
// SIN cambiar el significado (ver narratePromptC). `concept` = el término o la frase del usuario.
function defineConcept({ concept } = {}) {
  const term = String(concept || "");
  const slug = CONCEPT_DEFS[term] ? term : matchConcept(term);
  const d = slug && CONCEPT_DEFS[slug];
  if (!d) return { facts: null, boleta: [], coverage: { supported: false, reason: `no tengo una definición curada para '${term}'` } };
  return { facts: { concepto: d.aka, definicion: d.def, distingue: d.distingue, es_definicion: true }, boleta: [], coverage: { supported: true } };
}

// trend · LA SERIE MENSUAL (el evolutivo) — mes a mes / mensual / evolución / un mes / Q1-Q4 / semestre / rango. Envuelve
// composeSpecTemporal (misma verdad que el evolutivo de Sentrix · el total del año cierra EXACTO con el período). HONESTO
// POR CONSTRUCCIÓN: el dato mensual REAL es VENTA y CONTRIBUCIÓN (global · por entidad · por eje); lo que NO se sostiene
// mensual lo DECLARA y guía (resultado/P&L mensual = gastos son % anual · inventario = foto de hoy · canal sin desglose ·
// margen en MATRIZ por eje = %s que no se suman → margen mes a mes va por-entidad o del-negocio). period = string libre
// ("mes a mes", "Q1", "primer semestre", "marzo", "de enero a marzo") → detectPeriodo lo parsea; sin period = mes a mes.
// FUTURO: el dato es un año CERRADO — no hay serie a futuro. Si el period que manda el plan trae la frase temporal del
// usuario y esa frase apunta adelante ("el mes que viene", "próximos 3 meses", "lo que viene"), la tool lo DECLARA en vez
// de devolver el año histórico como si fuera un pronóstico (la auditoría lo cazó: narraba noviembre como venta futura).
const _FUTURO = /\b(mes|semana|trimestre|semestre|a[nñ]o)\s+(que\s+viene|entrante|pr[oó]xim\w+)|\bpr[oó]xim\w+\s+\d*\s*(mes|semana|trimestre|semestre|a[nñ]o)|\bque\s+viene\b|\bvenider\w+|\bpron[oó]stic\w+|\bproyect\w+\s+(a|para|los|las)?\s*futur|\ba\s+futuro\b|\bvoy\s+a\s+vender\b|\bva\s+a\s+vender\b/i;
const _FUTURO_TXT = "El dato llega hasta el cierre del año; no tengo serie a futuro, así que no puedo pronosticar. Sí puedo mostrarte cómo viene la venta mes a mes hasta el cierre y a qué ritmo venías creciendo — desde ahí armamos el objetivo.";

function trend({ metric = "ventas", dimension = null, entity = null, period = null, periodo = null } = {}) {
  // SENTRIX ES LA EVIDENCIA (owner 2026-07-28): aunque la tool DECLINE (esa métrica no tiene mensual), si ya sabemos
  // de qué entidad/eje se hablaba, el panel debe poder abrir SU cuadro — no quedarse sin nada. dimension explícito
  // gana; si solo vino `entity`, lo inferimos (trend no exige dimension cuando hay entity).
  const dimGuess = dimension || (entity ? guessDimension(entity) : null);
  const _evScope = { ...(dimGuess ? { entityType: dimGuess, dimension: dimGuess, lens: "cuadro" } : {}), ...(entity ? { entidad: entity } : {}) };
  const praw = period == null ? "" : String(period);
  if (_FUTURO.test(praw))
    return { facts: { limite_temporal: _FUTURO_TXT, ..._evScope }, boleta: [], coverage: { supported: false, reason: _FUTURO_TXT, alternativas: ["la venta mes a mes hasta el cierre", "el ritmo de crecimiento del año"] } };
  const p = periodo || (praw ? detectPeriodo(praw) : null);
  const r = composeSpecTemporal({ metric, dimension, entity, periodo: p });
  // límite declarado (resultado/inventario/canal/margen-matriz) → coverage=false CON el texto honesto + alternativas → el narrador GUÍA
  if (r && r.reason === "declarada")
    return { facts: { limite_temporal: r.texto, ..._evScope }, boleta: [], coverage: { supported: false, reason: r.texto, alternativas: Array.isArray(r.sugerencias) ? r.sugerencias : [] } };
  const out = _pack(r, "no tengo la serie mensual para esos parámetros (mes a mes tengo venta y contribución · global, por entidad o por eje)");
  if (!out.coverage || !out.coverage.supported) {
    // métrica no reconocida por el composer (ej. "costo": composeSpecTemporal devuelve null, no {reason:"declarada"})
    // → igual sabíamos la entidad/eje del pedido → que el panel pueda abrir SU cuadro en vez de quedar sin nada.
    if (Object.keys(_evScope).length) out.facts = { ..._evScope, ...(out.facts || {}) };
    return out;
  }
  if (dimGuess && !out.facts.entityType) out.facts = { ...out.facts, entityType: dimGuess };

  const g = buildGlobalEvolution();
  const meses = (g && Array.isArray(g.meses)) ? g.meses : [];
  // MARCO TEMPORAL: sin esto el narrador no sabe que el año está CERRADO y recetaba acciones sobre meses ya pasados
  // ("aprovechá la campaña de noviembre") o trataba un mes del histórico como si fuera el presente.
  out.facts = { ...out.facts, marco_temporal: {
    ultimo_mes_con_dato: meses.length ? meses[meses.length - 1] : null,
    periodo: "año cerrado — los 12 meses ya ocurrieron",
    hay_datos_a_futuro: false,
    nota: "no propongas acciones sobre un mes que ya está en la tabla; la acción va sobre el próximo período",
  } };

  // DIRECCIÓN YA CALCULADA POR EL MOTOR (la auditoría cazó una lectura INVERTIDA: Q1 superó el presupuesto y se narró
  // como incumplimiento). El composer la calcula, pero vive en su `opener` y _pack lo descarta → el narrador quedaba
  // comparando tres cifras sueltas a mano. Acá la entregamos resuelta, sobre las MISMAS sumas que muestra la tabla.
  const esGlobalVenta = !dimension && !entity && /^(ventas?|venta)$/i.test(String(metric));
  if (esGlobalVenta && g && Array.isArray(g.actual)) {
    const sl = (a) => (p && p.tipo === "rango" ? a.slice(p.desde, p.hasta + 1) : a);
    const S = (a) => a.reduce((x, y) => x + y, 0);
    const act = S(sl(g.actual)), ant = S(sl(g.anterior)), ppto = S(sl(g.presupuesto));
    const pc = (a, b) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);
    const dA = pc(act, ant), dP = pc(act, ppto);
    out.facts.comparacion = {
      ...(dA == null ? {} : { vs_anio_anterior: `${dA >= 0 ? "+" : ""}${dA}%`, direccion_vs_anio_anterior: dA >= 0 ? "CRECE contra el año anterior" : "CAE contra el año anterior" }),
      ...(dP == null ? {} : { vs_presupuesto: `${dP >= 0 ? "+" : ""}${dP}%`, direccion_vs_presupuesto: dP >= 0 ? "SUPERA el presupuesto" : "queda BAJO el presupuesto" }),
      nota: "la dirección ya está resuelta acá — copiala, no la recalcules",
    };
  }
  return out;
}

// TOOLS · el registro. La clave es el nombre que el LLM usa en el plan ({ tool: "marginRead", args: {...} }).
export const TOOLS = {
  queryMetric, entityProfile, entityRecord, gridTable, tensionRead, compareEntities, diagnose, executiveSummary,
  inventoryStatus, marginRead, salesRead, contributionRead, trend,
  simulate, simulateCarga, simulateCapital, simulateCosto, simulateGeneral, defineConcept,
};

// toolNames() → los nombres registrados (base del catálogo que verá el LLM en la Pasada 1 · Fase 3).
export function toolNames() {
  return Object.keys(TOOLS);
}
