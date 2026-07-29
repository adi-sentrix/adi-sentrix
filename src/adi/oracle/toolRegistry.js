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
import { POLICY } from "../../config/businessPolicy.js";               // la VARA (benchmark de margen) para anclar el juicio
import { buildEntityRecord, buildGrid, buildTension, guessDimension } from "./entityRecord.js";  // la FILA COMPLETA de una entidad + LA GRILLA (top-N × columnas) + LA TENSIÓN (cruce de 2 métricas del mismo eje) + a qué eje pertenece un nombre
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

// queryMetric · ranking/lista de una métrica × un eje (ventas por cliente, margen por marca…).
function queryMetric({ metric, dimension, filters = {}, scenario, limit = null, sort = null } = {}) {
  const x = _crossGuard(filters, ["marca", "familia", "bodega"]);   // el retrieval NO filtra por cliente
  if (x) { x.alternativas = [`${metric} por ${dimension}`]; return _crossFail(x); }
  return _pack(composeSpecRetrieval({ metric, dimension, filters: _isObj(filters) ? filters : {}, scenario, limit, sort }),
    `la métrica '${metric}' no está declarada para el eje '${dimension}'`);
}

// entityProfile · perfil de UNA entidad: todas sus métricas del contrato (el "quién es" de un cliente/marca/SKU).
// Inyecta el BENCHMARK de margen (la vara) para que el narrador NO adule un margen que está bajo el estándar.
function entityProfile({ dimension, entity, scenario } = {}) {
  const r = _pack(composeSpecDive({ dimension, entity, scenario }),
    `no encuentro a '${entity}' en el eje '${dimension}'`);
  if (r.coverage && r.coverage.supported && POLICY && typeof POLICY.benchmark === "number") {
    r.facts = { ...r.facts, benchmarkMargen: `${POLICY.benchmark}%`, nota: "compará el margen contra el benchmark antes de calificarlo" };
    r.boleta = [...r.boleta, fig("Benchmark de margen", `${POLICY.benchmark}%`, { unit: "pct", context: "la vara" })];
    // BRECHA de margen (benchmark − margen) autorizada: el "por qué cede margen" la narra naturalmente (evita abstención).
    const mM = Array.isArray(r.facts.metrics) && r.facts.metrics.find((m) => /margen/i.test(m.label || "") && typeof m.value === "number");
    if (mM && mM.value < POLICY.benchmark) {
      const gap = +(POLICY.benchmark - mM.value).toFixed(1);
      r.facts = { ...r.facts, brechaMargen: `${gap}%` };
      r.boleta = [...r.boleta, fig(`${entity} · brecha de margen`, `${gap}%`, { unit: "pct", context: "benchmark − margen" })];
    }
  }
  return r;
}

// entityRecord · LA FILA COMPLETA de una entidad: TODAS sus columnas reales del dato (unidades, valor de inventario,
// rotación, cobertura, días sin venta, estado, ventas, margen, contribución, rebate, precio…). Para preguntas
// concretas de campo ("unidades del SKU X", "el rebate de Falabella", "todo de LG-DRYER8KG"). El LLM lee lo que
// necesita y calcula si hace falta. Cada columna-cifra va autorizada → no inventa.
function entityRecord({ dimension, entity } = {}) {
  const r = buildEntityRecord(dimension, entity);
  if (!r) return { facts: null, boleta: [], coverage: { supported: false, reason: `no encuentro '${entity}' en el eje '${dimension}'` } };
  // lens:"cuadro" · SENTRIX ES LA EVIDENCIA (owner 2026-07-28): sin esto el panel no tenía forma de saber qué mostrar
  // para esta tool propia (las demás heredan `lens` de su composer wrapeado) → el ranking de ${dimension} se abre con
  // esta entidad ya nombrada en la boleta (el punto celeste del espejo la marca). Mismo patrón que usa `_pack`.
  return { facts: { ...r.facts, lens: "cuadro" }, boleta: r.boleta, coverage: { supported: true, figCount: r.boleta.length } };
}

// tensionRead · TENSIÓN sostener-vs-consumir (turno 14 del veredicto de 18 turnos): cruza DOS métricas del MISMO
// eje (ej. contribución vs capital de los SKU) y devuelve el top-N de cada una YA CRUZADO (quién aparece en ambos
// rankings, quién solo en uno) — antes esto disparaba 2 tool-calls de EJES DISTINTOS que el narrador mezclaba sin
// declarar el mismatch. Si el eje no tiene ambas columnas (cliente/marca/familia no tienen capital), degrada
// HONESTO con la razón exacta (no hay tabla puente eje↔SKU en el dato) — nunca inventa el cruce.
function tensionRead({ dimension, metricA = "contribucion", metricB = "stockUSD", limit = 10, dirA = "desc", dirB = "desc" } = {}) {
  const r = buildTension(dimension, { metricA, metricB, limit, dirA, dirB });
  if (!r) return { facts: null, boleta: [], coverage: { supported: false, reason: `no puedo cruzar esas dos métricas por '${dimension}'` } };
  if (r.unsupported) return { facts: null, boleta: [], coverage: { supported: false, reason: r.unsupported } };
  return { facts: { ...r.facts, lens: "cuadro", entityType: dimension }, boleta: r.boleta, coverage: { supported: true, figCount: r.boleta.length } };
}

// gridTable · LA GRILLA: los top-N de una dimensión (cliente/sku/marca/familia) con TODAS sus columnas, para que el
// LLM arme una TABLA multi-columna. sortBy = por qué campo rankear (venta/contribucion/stockUSD/rotacion/margen…).
// Ej: "los 5 mejores SKU con ventas, costo medio, precio y margen de contribución" → {dimension:"sku",sortBy:"venta",limit:5}.
function gridTable({ dimension, sortBy = null, dir = "desc", limit = 20 } = {}) {
  const r = buildGrid(dimension, { sortBy, dir, limit });
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

// diagnose · RICO por diseño: barre TODOS los detectores (contribución no capturada · carga alta · capital detenido)
// y los rankea por $. `focus:"resumen_ejecutivo"` deriva al resumen de 5 movimientos.
// TOLERANTE a un filtro NO-objeto (owner "de los clientes con bajo margen, cuál corregir primero": el plan a veces
// manda un STRING libre tipo "contribucion no capturada" en vez de un eje — diagnose es la vista panorámica, y
// degradar a "todo el negocio" (silencioso) sirve más que rechazar el turno entero. Una KEY de objeto inválida
// (ej. {state:"x"}) sí sigue rechazando — ahí hay un intento deliberado de cruce que de verdad no existe.
function diagnose({ filters = {}, scenario, focus = null } = {}) {
  const f = _isObj(filters) ? filters : {};
  const x = _crossGuard(f, _SCOPE_KEYS); if (x) return _crossFail(x);
  return _pack(composeSpecDiagnose({ filters: f, scenario, focus }),
    "no hay focos materiales de pérdida/inmovilización con estos filtros");
}

// executiveSummary · la lectura completa de 5 movimientos (cómo ganás · margen · dónde perdés · por qué · recuperación).
function executiveSummary({ scenario } = {}) {
  return _pack(composeSpecResumenEjecutivo({ scenario }), "no puedo armar el resumen en este escenario");
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
        if (bench != null && typeof row.margen === "number") add(`Medida · cerrar brecha en ${row.nombre}`, Math.round(row.venta * 10 * (bench - row.margen)));
        const pp1 = Math.round(row.venta * 10);   // venta (miles) × 1000 × 1% = venta × 10 (misma fórmula que _pp1 del composer)
        if (pp1 > 0) { const label = `Medida · 1pp en ${row.nombre}`; if (!seen.has(label)) { seen.add(label); r.boleta.push(fig(label, _moneyRaw(pp1), { unit: "money", raw: pp1, source: "computed", formula: "venta × 1%", context: "cuánto vale la medida" })); } }
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
function simulateCarga({ filters = {}, scenario } = {}) {
  return _pack(composeSpecSimulateCarga({ filters, scenario }), "no hay carga recuperable para simular");
}

// simulateCapital · simulación específica de liberar capital detenido.
function simulateCapital({ filters = {}, scenario } = {}) {
  return _pack(composeSpecSimulateCapital({ filters, scenario }), "no hay capital detenido para liberar");
}

// simulateCosto · simulación específica de bajar/subir el costo medio (turno 10 del veredicto de 18 turnos):
// "¿y si bajo el costo medio de mis peores SKU un 3%?" — antes AUSENTE (composeSpecSimulate genérico no cubre
// costo, no escala linealmente sobre el nivel pedido). Mismo estilo simple que simulateCarga/Capital (args planos,
// sin transform anidado): la evidencia en vivo mostró que el planner no arma el `transform` del tool genérico ni
// para las métricas que SÍ soporta — necesita un tool con nombre propio y ejemplo en prosa, igual que Carga/Capital.
function simulateCosto({ dimension = "sku", filters = {}, pct, scope = "bajo_benchmark", scenario } = {}) {
  const r = composeSpecSimulateCosto({ dimension, filters, pct, scope, scenario });
  if (r && r.unsupported) return { facts: null, boleta: [], coverage: { supported: false, reason: r.unsupported } };
  return _pack(r, `no hay ${scope === "all" ? "" : "SKU bajo benchmark "}para simular costo con estos filtros`);
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
  simulate, simulateCarga, simulateCapital, simulateCosto, defineConcept,
};

// toolNames() → los nombres registrados (base del catálogo que verá el LLM en la Pasada 1 · Fase 3).
export function toolNames() {
  return Object.keys(TOOLS);
}
