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
  composeSpecComposicion, composeSpecClientCapital,
} from "../specRetrieval.js";
import { getTenantData } from "../../data/tenantStore.js";
import { factorComercialDe } from "../../config/contract/figureType.js";
/* el dato comercial ALMACENADO → $ crudos con la escala QUE EL PACK DECLARA (owner 2026-08-30, barrido
 * A·maquinaria): el ×1000 fijo de las figs inflaba mil veces la boleta de un pack de planilla. Con el
 * demo (declara «K») es la identidad de siempre, byte a byte. */
const _fxT = () => factorComercialDe(getTenantData());
import { resolveGlossary } from "../sentrix/glossary.js";   // definiciones AUTORIZADas (antídoto al "inventa algo") · resuelve slug, etiqueta de pantalla y frase libre
import { fig, parseFigures, parseNumeroLocalizado } from "../boleta.js";
// LA CALCULADORA (AMPLITUD F2, owner 2026-08-13 · decisión D1: catálogo CERRADO ampliable, jamás fórmula libre):
// la aritmética vive en calculoCatalogo.js (puro); acá solo se RESUELVEN los insumos por referencia contra el
// dato del tenant y se empaqueta la boleta con la fórmula declarada. universoDe le pone a cada insumo su
// universo (figureType, la única autoridad) para que el catálogo pueda declinar el cruce prohibido.
import { ejecutarCalculo, OPERACIONES_CALCULO, formatearCanon } from "./calculoCatalogo.js";
import { universoDe } from "../../config/contract/figureType.js";
import { compradoresSku } from "../../data/clienteSkuMatrix.js";
import { resolveCanonical } from "./entityIndex.js";               // el nombre que el usuario escribió → el del dato   // la transpuesta de la matriz cliente×SKU (E4.t3)
import { clientCapitalRelacion } from "../specRetrieval.js";      // ¿el cruce está OBSERVADO o es afinidad modelada? · una sola verdad                                    // cifra autorizada (para inyectar el benchmark en el perfil)
import { POLICY, costModelOf, benchmarkOf } from "../../config/businessPolicy.js";  // la VARA (benchmark de margen) para anclar el juicio + el modelo de costo declarado (#56)
import { buildEntityRecord, buildGrid, buildTension, guessDimension, guessDimensionDetallado, rawRecordFor, REFERENCIA_CAMPO, fieldLabel } from "./entityRecord.js";  // la FILA COMPLETA de una entidad + LA GRILLA (top-N × columnas) + LA TENSIÓN (cruce de 2 métricas del mismo eje) + a qué eje pertenece un nombre (con sus colisiones · decisión 8) + la vara autorizada por campo
import { composeSpecTemporal, detectPeriodo } from "../composers/temporalTable.js";  // LA SERIE MENSUAL (evolutivo · misma verdad que Sentrix · honestidad declarada)
import { buildGlobalEvolution, buildGlobalEvolutionAnclada } from "../sentrix/temporal.js";                       // la curva REAL del negocio (para el marco temporal y la dirección ya calculada)
import { concentracion } from "../diagnosis/economicDiagnosis.js";                   // 80/20 · la MISMA función del detector de concentración de Sentrix
// TRANSFERIR ENTRE BODEGAS (decisión 13): la ÚNICA cuenta de "¿se puede evaluar mover stock?" — la misma que
// consultan la cara Capital, el ring de bodega y la lectura ejecutiva. ADI la lee de acá, nunca la recalcula.
import { transferenciaCapability } from "../sentrix/capability.js";
import { applyScenarioToSkuInventario, deriveKpis } from "../../engine/scenarios.js";   // las filas de inventario del escenario ACTIVO (las mismas que pinta la cara) + los KPIs del negocio (los agregados de la Mesa — la calculadora los referencia, jamás los re-suma)
import { SOURCES } from "../../config/contract/sourceManifest.js";                   // carga scenario-aware de clientesVentas/clientesMargen (posición en cartera)
import { METRICS } from "../../config/contract/metricRegistry.js";                   // el vocabulario DECLARADO de ejes (decisión 8): la única lista, no se escribe una segunda
// EL P&L (decisión 3): `composePnl` es el contrato sellado del resultado y `buildPnlCascade` la cuenta que lo
// sostiene; `pnlDefined`/`pnlDisponibilidad`/`pnlEjesDisponibles`/`pnlEntidadCanon` son su disponibilidad
// data-driven y su canon de alcance. `pnlRead` (abajo) los ENVUELVE — no reimplementa ni una suma.
import { composePnl, buildPnlCascade, pnlDefined, pnlDisponibilidad, pnlEjesDisponibles, pnlEntidadCanon } from "../pnl.js";
import { simboloMoneda } from "../../config/moneda.js";

const _loadSrc = (source, scenario) => { const s = SOURCES[source]; if (!s) return []; return (typeof s.scenarioLoad === "function" ? s.scenarioLoad(scenario) : s.load()) || []; };

// ── $ EN MILES → $ FORMATEADO (la trampa de escala · owner "el motor le entrega la sábana, sin trampas") ──────────
// Las tablas comerciales del dato guardan el dinero en MILES (venta: 17000 = $17.0M). El LLM leía ese crudo en los
// facts y escribía "$17,000" — mal por 1000×. El guard lo bloqueaba (bien) → C se abstenía (la clase de abstención $
// que arrastrábamos). FIX EN LA FUENTE: el motor entrega el dinero YA FORMATEADO, así el LLM no puede equivocar la
// escala y la cifra formateada queda autorizada por enrichFromFacts. Las claves son las mismas del mapa de entityRecord
// (venta/costo/contribución/rebate/presupuesto/anterior/actual = miles); stockUSD/precioLista/costoMedio son crudas y
// NO se tocan; `usd` tampoco (ya lo maneja el enricher). PURO: clona, no muta la evidence del composer.
const _MONEY_K = /^(venta|ventas|ventaAnt|costo|costos|contribucion|contribucionAnt|rebates|rebate|presupuesto|anterior|actual)$/;
const _moneyK = (vK) => { const v = vK * _fxT(), a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}${simboloMoneda()}${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}${simboloMoneda()}${Math.round(a / 1e3)}K`; return `${s}${simboloMoneda()}${Math.round(a)}`; };
const _moneyRaw = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}${simboloMoneda()}${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}${simboloMoneda()}${Math.round(a / 1e3)}K`; return `${s}${simboloMoneda()}${Math.round(a)}`; };
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

// ── EJE QUE LA TOOL NO ABRE (owner 2026-08-09, decisión 8) ───────────────────────────────────────────────────────
// EL DEFECTO QUE CIERRA, medido: los composers comerciales resuelven su eje con un fallback SILENCIOSO
// (`const dim = _MLBL[dimension] ? dimension : "cliente"`, specRetrieval.js). Pedirles el eje `bodega` —las
// sucursales, que en este dato son bodegas de inventario y no tienen venta ni presupuesto propios— devolvía el
// ranking de CUENTAS con `supported: true`: «Por local, ¿quién queda bajo el plan?» se contestaba con Lider,
// Falabella y Jumbo. Cifras reales contestando otra pregunta, sin una sola violación numérica que lo delate. La
// decisión 8 es textual: «si una tool no soporta bodega, familia, SKU, cliente u otro eje, debe DECLINAR
// explícitamente. Nunca devolver filas de otro eje con supported:true».
//
// CÓMO SE DETECTA SIN ESCRIBIR UNA SEGUNDA LISTA DE EJES. Acá no hay ninguna tabla a mano de qué eje sirve cada
// tool: eso sería una segunda verdad esperando desalinearse del composer. Se leen DOS señales que ya existen:
//   (a) LO QUE EL COMPOSER DECLARA · `facts.dimension` es el eje que de verdad sirvió (el `dim` de DESPUÉS del
//       fallback). Si difiere del que el plan pidió, el fallback actuó.
//   (b) DE QUIÉN SON LAS FILAS · los sujetos de la boleta pasados por `guessDimensionDetallado` — el mismo
//       resolvedor data-driven que ya usan `entityProfile`/`entityRecord`/`trend` para autocorregir el eje. Si
//       ninguna entidad reconocible de la respuesta pertenece al eje pedido, las filas son de otro eje aunque el
//       composer haya declarado el nombre correcto (el pivot interno de `vs_anterior` por SKU es exactamente ese
//       caso: declara `sku` y devuelve clientes).
// Cualquiera de las dos alcanza para declinar. El día que un composer sume un eje de verdad, las dos señales lo
// acompañan solas.
//
// NO SE APLICA a la rama `gap` (el "hueco honesto"): ahí el pivot a otro eje es DELIBERADO y viaja declarado en
// `facts.<lente>.focus = "gap:…"` con su `gapLabel`, así que el narrador ya sabe que está mirando lo más cercano.
// EL NOMBRE DEL EJE, NO SU ORTOGRAFÍA. El plan lo escribe en lenguaje natural y llega en plural o con mayúscula
// ("clientes", "SKU", "Familias"). Eso nunca fue un eje distinto, pero los composers indexan su mapa de ejes con
// la clave exacta en minúscula: `_MLBL["SKU"]` es `undefined` y caían al mismo fallback silencioso que `bodega` —
// «el margen por SKU» se contestaba con el ranking de CUENTAS. Se canoniza contra el vocabulario DECLARADO de
// ejes (`metricRegistry.METRICS[*].axes`, la única lista de ejes del contrato: no se escribe una segunda acá) y
// se le pasa al composer la forma que sí entiende. Lo que después de canonizar sigue sin ser un eje del
// contrato —"vendedor", "proveedor"— viaja tal cual y termina declinando, que es lo correcto.
const _EJES_DECLARADOS = [...new Set(Object.values(METRICS).flatMap((m) => (m && m.axes) || []))];
const _normEje = (x) => String(x == null ? "" : x).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
function _ejeCanon(x) {
  const n = _normEje(x);
  if (!n) return "";
  for (const e of _EJES_DECLARADOS) { const c = _normEje(e); if (n === c || n === `${c}s` || n === `${c}es`) return c; }
  return n;   // no es un eje declarado → se conserva tal cual (y la guarda de abajo lo declina)
}
const _ejesDe = (nombre) => {
  const d = guessDimensionDetallado(nombre);
  if (d && Array.isArray(d.opciones) && d.opciones.length) return d.opciones.map((o) => _ejeCanon(o.dimension));
  return d && d.dimension ? [_ejeCanon(d.dimension)] : [];
};
// → true (sirvió el eje pedido) · false (sirvió otro) · null (ninguna entidad reconocible: no se puede juzgar)
function _filasDelEje(pedido, boleta) {
  const eje = _ejeCanon(pedido);
  const sujetos = [...new Set((boleta || []).map((f) => String((f && f.label) || "").split(" · ")[0].trim()).filter(Boolean))];
  let reconocibles = 0;
  for (const s of sujetos) {
    const ejes = _ejesDe(s);
    if (!ejes.length) continue;          // benchmark, medida, totales… no son entidades: no informan
    reconocibles++;
    if (ejes.includes(eje)) return true;
  }
  return reconocibles === 0 ? null : false;
}
// _ejeNoAbierto(pedido, res) → la cobertura de declinación, o null si el eje pedido sí es el que se sirvió.
function _ejeNoAbierto(pedido, res, alternativas = []) {
  const eje = _ejeCanon(pedido);
  if (!eje) return null;                                             // el plan no pidió eje → nada que verificar
  if (!res || !res.coverage || res.coverage.supported !== true) return null;
  const declarado = res.facts && typeof res.facts.dimension === "string" ? res.facts.dimension : null;
  const porDeclaracion = !!declarado && _ejeCanon(declarado) !== eje;
  const porFilas = _filasDelEje(eje, res.boleta) === false;
  if (!porDeclaracion && !porFilas) return null;
  return {
    supported: false, eje, ejeServido: declarado || null,
    reason: `no puedo abrir esta lectura por '${eje}': el dato no baja a ese eje${declarado && declarado !== eje ? ` y la cuenta se serviría por '${declarado}', que son otras filas` : " y las filas que quedan son de otro eje"} — devolverlas como si fueran de '${eje}' sería contestar otra pregunta`,
    alternativas,
  };
}

// queryMetric · ranking/lista de una métrica × un eje (ventas por cliente, margen por marca…). entityScope (Etapa 2,
// owner 2026-08-03, continuidad conversacional universal): forwarding mecánico a composeSpecRetrieval — "de esos
// SKU, ¿cuál vendió más?" acota el ranking al subconjunto en vez de traer el eje entero.
// ALIAS DE ENTRADA · «cobertura» → `doh` (owner 2026-08-10). La métrica interna duplicada `cobertura` se eliminó
// (era un redondeo de `doh` que difería hasta 28 días en un mismo SKU), pero eliminarla dejó DECLINANDO una palabra
// que el usuario usa todos los días. La regla del owner es explícita: se puede borrar la métrica, no la comprensión.
// Esto NO reintroduce el campo: normaliza la palabra de entrada a la única verdad canónica, que en pantalla se
// llama «Días de inventario». Es el mismo criterio que el vocabulario de qiRetrieval (`cobertura: [cobertura, doh]`).
const _METRIC_ALIAS = { cobertura: "doh", "dias de inventario": "doh", "días de inventario": "doh", "dias inv": "doh", "días inv": "doh" };
const _canonMetric = (m) => {
  const k = String(m == null ? "" : m).trim().toLowerCase();
  return _METRIC_ALIAS[k] || m;
};

function queryMetric({ metric: _metric, dimension, filters = {}, scenario, limit = null, sort = null, entityScope = null } = {}) {
  const metric = _canonMetric(_metric);
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
    const rawRec = rawRecordFor(dim, entity, scenario);
    const bench = benchmarkOf(rawRec);
    if (typeof bench === "number" && isFinite(bench)) {
      // «compara», no «compará» (voseo) · y el `context` de la fig va en registro: «la referencia declarada», no
      // «la vara» — el context viaja al prompt como texto autorizado y a la evidencia del panel de Sentrix, que
      // lo pinta. «referencia declarada» es la MISMA clase de concepto (`_vocabulario_vara_gate` la reconoce como
      // palabra de vara, no de promedio), así que nada cambia de significado: cambia la palabra que se lee.
      r.facts = { ...r.facts, benchmarkMargen: `${bench}%`, nota: "compara el margen contra el benchmark antes de calificarlo" };
      r.boleta = [...r.boleta, fig("Benchmark de margen", `${bench}%`, { unit: "pct", context: "la referencia declarada" })];
      // BRECHA de margen (benchmark − margen) autorizada: el "por qué cede margen" la narra naturalmente (evita abstención).
      const mM = Array.isArray(r.facts.metrics) && r.facts.metrics.find((m) => /margen/i.test(m.label || "") && typeof m.value === "number");
      if (mM && mM.value < bench) {
        const gap = +(bench - mM.value).toFixed(1);
        r.facts = { ...r.facts, brechaMargen: `${gap}%` };
        r.boleta = [...r.boleta, fig(`${entity} · brecha de margen`, `${gap}%`, { unit: "pct", context: "benchmark − margen" })];
      }
      // EXCESO DE ACCIONES COMERCIALES ($) — owner 2026-08-07, "no atribuya el $ a TODA la brecha de margen,
      // sino únicamente al exceso comprobado de acciones comerciales": MISMO cálculo que el detector de
      // diagnose (_diagComercial, specRetrieval.js — "carga comercial alta": (carga−target)/100 × venta) —
      // se autoriza acá TAMBIÉN para que el perfil de un cliente lo pueda citar sin una call aparte a
      // diagnose. Es DISTINTA de la contribución no capturada (brecha total de margen vs benchmark) — el
      // narrador tiene la instrucción explícita de no confundirlas (narratePromptC.js, "NO CONFUNDAS EL
      // MECANISMO CON EL TOTAL").
      const cargaM = Array.isArray(r.facts.metrics) && r.facts.metrics.find((m) => /carga comercial/i.test(m.label || "") && typeof m.value === "number");
      const ventaM = Array.isArray(r.facts.metrics) && r.facts.metrics.find((m) => /^ventas$/i.test(m.label || "") && typeof m.value === "number");
      if (cargaM && ventaM && cargaM.value > POLICY.targetCarga) {
        const excesoUsd = Math.round(((cargaM.value - POLICY.targetCarga) / 100) * ventaM.value * _fxT());
        r.facts = { ...r.facts, excesoAccionesComerciales: _moneyRaw(excesoUsd), targetCarga: `${POLICY.targetCarga}%` };
        r.boleta = [...r.boleta,
          fig("Meta de carga comercial", `${POLICY.targetCarga}%`, { unit: "pct", context: "tu target" }),
          fig(`${entity} · exceso de acciones comerciales`, _moneyRaw(excesoUsd), { unit: "money", raw: excesoUsd, mandatory: true, context: "carga actual − tu meta, aplicado a la venta — SOLO el exceso comprobado, no la brecha total de margen" }),
        ];
      }
    }
    // TICKET PROMEDIO (owner 2026-08-07, Ficha Ejecutiva real, "Ticket promedio" es el nombre pedido
    // explícitamente aunque no sea un ticket transaccional real — no hay nº de operaciones en el dato, lo que
    // hay es venta ÷ unidades = precio realizado; mismo override de nombre que ya usó el mockup aprobado).
    // SOLO cliente: `unidades` solo existe en clientesVentas.
    if (dim === "cliente") {
      const rawRec = rawRecordFor(dim, entity, scenario);
      const ventaK = rawRec && (typeof rawRec.venta === "number" ? rawRec.venta : rawRec.actual);
      if (rawRec && typeof rawRec.unidades === "number" && rawRec.unidades > 0 && typeof ventaK === "number") {
        const ticket = Math.round((ventaK * _fxT()) / rawRec.unidades);
        r.facts = { ...r.facts, ticketPromedio: _moneyRaw(ticket) };
        r.boleta = [...r.boleta, fig(`${entity} · Ticket promedio`, _moneyRaw(ticket), { unit: "money", raw: ticket, context: "precio promedio realizado (venta ÷ unidades) — no es un ticket transaccional real, el dato no trae número de operaciones" })];
      }
      // POSICIÓN EN LA CARTERA (owner 2026-08-07, Ficha Ejecutiva real, "posición del cliente dentro de la
      // cartera"): ranking por venta + si cae en el bloque 80/20 (concentracion(), la MISMA función del
      // detector de Sentrix) + ranking de margen desde el más rezagado — todo cross-cliente, no del cliente
      // solo, así que se computa acá con el universo completo en vez de depender de otra tool.
      const allVentas = _loadSrc("clientesVentas", scenario).map((c) => ({ nombre: c.nombre, valor: c.actual }));
      const rankV = [...allVentas].sort((a, b) => b.valor - a.valor);
      const rank = rankV.findIndex((c) => c.nombre === entity) + 1;
      if (rank > 0 && allVentas.length) {
        const conc = concentracion(allVentas, 0.8);
        const enBloque8020 = conc.entidades.some((e) => e.nombre === entity);
        const allMargen = _loadSrc("clientesMargen", scenario).filter((c) => c.tipo === "cliente" && typeof c.margen === "number");
        const rankM = [...allMargen].sort((a, b) => a.margen - b.margen);   // ascendente: el más rezagado primero
        const rankMargen = rankM.findIndex((c) => c.nombre === entity) + 1;
        r.facts = { ...r.facts, posicionCartera: {
          rankingVenta: rank, totalClientes: rankV.length,
          enBloque8020, reglaConcentracion: conc.regla,
          rankingMargenDesdeAbajo: rankMargen > 0 ? rankMargen : null, totalConMargen: rankM.length,
        } };
        r.boleta = [...r.boleta,
          fig(`${entity} · ranking por venta`, `${rank}º de ${rankV.length}`, { unit: "rank", raw: rank, context: "posición en la cartera por venta" }),
          ...(rankMargen > 0 ? [fig(`${entity} · ranking de margen desde el más rezagado`, `${rankMargen}º de ${rankM.length}`, { unit: "rank", raw: rankMargen, context: "1º = el margen más bajo de la cartera" })] : []),
        ];
      }
    }
  }
  return r;
}

// entityComposicion · CÓMO SE COMPONE la compra de UN cliente por familia — venta/contribución/margen (owner
// 2026-08-07, "familias que más compran, productos — ese es el juego de Sentrix, ADI muestra el resolutivo"):
// reusa la MISMA matriz cliente×SKU del Pareto de Sentrix. Solo eje cliente.
// BRECHA por familia, TODAS (owner 2026-08-07, hallazgo en vivo — _probe_guardc_diag.mjs): sin esto, el
// narrador RESTA benchmark−margen por su cuenta para la tabla ("Brecha" por familia, la instrucción FORMATO
// "TABLA DE MARGEN: sumá SIEMPRE una columna Brecha" de narratePromptC.js dispara sobre esta tabla también) —
// una resta de 2 cifras autorizadas que en teoría el guard permite, pero en la práctica guardC la rechazó
// (cifra-no-autorizada) porque el benchmark autorizado no está atado a NINGUNA familia — el turno completo
// degradaba a la tabla cruda de la reparación determinística. Autorizar solo la de la familia top no alcanzó: el narrador
// arma la tabla de las 4 familias igual (la instrucción FORMATO es "siempre", no "si podés") — así que se
// autorizan las 4, mismo patrón que entityProfile (arriba): el motor calcula la brecha, no el LLM.
function entityComposicion({ dimension, entity, scenario } = {}) {
  const r = _pack(composeSpecComposicion({ dimension, entity, scenario }), `no tengo composición por familia para '${entity}' en el eje '${dimension}'`);
  if (r.coverage && r.coverage.supported && r.facts.composicion && Array.isArray(r.facts.composicion.familias) && r.facts.composicion.familias.length) {
    const rawRec = rawRecordFor(dimension, entity, scenario);
    const bench = benchmarkOf(rawRec);
    if (typeof bench === "number" && isFinite(bench)) {
      r.facts = { ...r.facts, benchmarkMargen: `${bench}%` };
      r.boleta = [...r.boleta, fig("Benchmark de margen", `${bench}%`, { unit: "pct", context: "la referencia declarada" })];   // registro: ver la nota de entityProfile
      r.facts.composicion.familias.forEach((f, i) => {
        if (typeof f.margen !== "number") return;
        const gap = Math.round((bench - f.margen) * 10) / 10;
        r.boleta.push(fig(`${entity} · ${f.nombre} · brecha`, `${gap}pp`, { unit: "pp", raw: gap, context: `composición de ${entity} por familia — benchmark − margen de ${f.nombre}`, mandatory: i === 0 }));
      });
    }
  }
  return r;
}

// entityCapitalLigado · inventario inmovilizado cruzado contra el surtido del cliente (owner 2026-08-07, "capital
// ligado a su mix — deberían aparecer el valorizado y unidades, incluso la bodega"): mismo criterio de
// inmovilizado del detector de capital. Solo eje cliente.
//
// DECISIÓN 9 (owner 2026-08-09, hallazgo J): esta tool devolvía el MISMO subtotal y los MISMOS SKU —
// byte-idénticos— para las 13 cuentas, porque el "mix" del cliente sale de una matriz de afinidad modelada que
// alcanza TODOS los SKU con inventario. Era el inventario global con el nombre de un cliente encima. Ahora el
// composer mide la relación primero (`clientCapitalRelacion`) y, cuando no existe, DECLINA con la razón medida:
// `coverage.supported=false` + `coverage.relacion` + `coverage.reason` verificable — cero afirmación
// cliente-específica. El narrador ya sabe qué hacer con una tool que declina (doctrina HONESTIDAD).
function entityCapitalLigado({ dimension, entity, scenario } = {}) {
  const r = composeSpecClientCapital({ dimension, entity, scenario });
  if (r && r.unsupported) {
    return {
      facts: null, boleta: [],
      coverage: { supported: false, relacion: r.relacion, reason: r.reason, alternativas: Array.isArray(r.alternativas) ? r.alternativas : [], cobertura: r.cobertura || null },
    };
  }
  return _pack(r, `no hay capital inmovilizado en el surtido de ${entity}`);
}

/* clientesPorSku · LA TRANSPUESTA DE LA MATRIZ CLIENTE×SKU (owner 2026-08-12, E4.t3) ═════════════════════════════
 * EL CASO MEDIDO: «Para esos SKU, ¿qué clientes podrían comprarlos? Separa lo probado de la afinidad indicada.»
 * ADI contestó «No tengo el detalle cruzado por SKU» — con la boleta VACÍA, cero figs. Y el detalle SÍ existe:
 * `compradoresSku()` vive en data/clienteSkuMatrix.js desde el 2026-07-10 y devuelve exactamente eso. No era una
 * limitación del dato: la capacidad no estaba expuesta como tool, así que el planificador no tenía cómo pedirla y
 * el narrador, sin nada en la boleta, hizo lo único honesto que podía hacer — declinar. El defecto está aguas
 * arriba del texto, y por eso se corrige acá y no en el prompt.
 *
 * EL SELLO NO ES OPINABLE, Y NO SE ELIGE ACÁ. La matriz cierra EXACTO por cliente y PROPORCIONAL por SKU (IPF
 * determinístico sobre una afinidad modelada: marca dominante > familia > cola). Leerla por SKU es entonces
 * `derivada_no_reconciliada`, que el contrato de tipos ya mapea a `indicado`. Es la decisión que el owner aprobó
 * —«la matriz cliente×SKU es una inferencia autorizada, con estatus INDICADO»— y sale del MISMO lugar que
 * gradúa cualquier otra cifra, no de una excepción para esta tool.
 * SI EL DATASET REGISTRARA LA VENTA ATÓMICA cliente×SKU, la misma relación pasaría a `observada` y el sello a
 * `probado`. Eso lo mide `clientCapitalRelacion`, la misma función que usa el composer de capital ligado: una
 * sola verdad sobre si el cruce está observado o estimado, nunca un criterio paralelo.
 *
 * LO QUE ESTA TOOL NO HACE, y es la mitad del encargo: no atribuye a ninguna cuenta ni un peso de INVENTARIO. Las
 * celdas que devuelve son de VENTA o CONTRIBUCIÓN —el flujo que la matriz reparte—, nunca stock valorizado. Colgar
 * capital inmovilizado del nombre de un cliente es justo el error que la decisión 9 bloqueó en `entityCapitalLigado`
 * (devolvía el inventario del negocio con el nombre de una cuenta encima), y exponer la transpuesta no puede
 * reabrirlo por la puerta de atrás. */
const _mKsku = (v) => `${(Math.round(v / 100) / 10).toFixed(1)}M`;
function clientesPorSku({ entities, entity, entityScope, metric = "ventas", topN = 5, scenario } = {}) {
  const pedidos = [...new Set([
    ...(Array.isArray(entities) ? entities : []),
    ...(Array.isArray(entityScope) ? entityScope : []),
    entity,
  ].filter(Boolean))];
  if (!pedidos.length) return { facts: null, boleta: [], coverage: { supported: false, reason: "no se indicó de qué SKU" } };

  const met = metric === "contribucion" || metric === "contribución" ? "contribucion" : "ventas";
  const metLbl = met === "contribucion" ? "contribución" : "venta";
  // la relación se MIDE una vez, con la función del composer de capital: decide sello, no lo decide esta tool.
  const rel = clientCapitalRelacion({ entity: pedidos[0], scenario });
  const observada = rel && rel.atomico === true;
  const verificabilidad = observada ? "lectura_directa" : "derivada_no_reconciliada";

  const boleta = [];
  const resueltos = [], faltantes = [];
  const detalle = {};
  for (const sku of pedidos) {
    const canon = resolveCanonical("sku", sku) || sku;
    const filas = compradoresSku(canon, met);
    if (!filas || !filas.length) { faltantes.push(sku); continue; }
    resueltos.push(canon);
    const top = filas.slice(0, Math.max(1, topN));
    const totalSku = filas.reduce((a, r) => a + r.value, 0) || 1;
    /* LA PARTICIPACIÓN SE EMITE SELLADA, NO SE DEJA COSECHAR (medido en el gate de este cruce). Puesta como número
     * suelto dentro de `facts`, el ledger la levantaba sola y la sellaba `probado`: un porcentaje que sale de la
     * MISMA estimación de afinidad quedaba presentado como hecho, justo al lado de la cifra de la que deriva —que
     * sí iba `indicado`—. Ahora se emite explícita con la misma verificabilidad, y en `facts` viaja YA FORMATEADA,
     * para que no quede ningún número desnudo que el sello no acompañe. */
    detalle[canon] = top.map((r) => ({ cliente: r.name, participacion: `${(Math.round((r.value / totalSku) * 1000) / 10).toFixed(1)}%` }));
    for (const r of top) {
      const pct = Math.round((r.value / totalSku) * 1000) / 10;
      boleta.push(fig(`${r.name} · ${canon}`, _mKsku(r.value), {
        unit: "money", raw: r.value * _fxT(), source: "computed",
        context: `${metLbl} asociada por afinidad de surtido`,
        verificabilidad,

        // LA RAZÓN DEL SELLO, ESPECÍFICA. Sin esto `fig()` la deriva genérica ("es un supuesto del motor") y el

        // narrador recibe un estatus sin saber DE QUÉ es estimación. Es el campo que el contrato ya transporta al

        // claim (`estatusRazon`), así que decirlo bien acá lo pone en el prompt sin plomería nueva.

        verificabilidadRazon: "el dato no registra qué SKU se le vendió a cada cuenta: el reparto cliente×SKU es una afinidad de surtido estimada, no una venta observada",
      }));
      boleta.push(fig(`${r.name} · ${canon} · participación`, `${pct.toFixed(1)}%`, {
        unit: "pct", raw: pct, source: "computed",
        context: `participación estimada en la ${metLbl} del SKU, por afinidad de surtido`,
        verificabilidad,

        // LA RAZÓN DEL SELLO, ESPECÍFICA. Sin esto `fig()` la deriva genérica ("es un supuesto del motor") y el

        // narrador recibe un estatus sin saber DE QUÉ es estimación. Es el campo que el contrato ya transporta al

        // claim (`estatusRazon`), así que decirlo bien acá lo pone en el prompt sin plomería nueva.

        verificabilidadRazon: "el dato no registra qué SKU se le vendió a cada cuenta: el reparto cliente×SKU es una afinidad de surtido estimada, no una venta observada",
      }));
    }
  }
  if (!boleta.length) {
    return {
      facts: null, boleta: [],
      coverage: { supported: false, reason: `no encuentro esos SKU en la matriz de surtido: ${faltantes.join(", ")}`, cobertura: { pedidos: pedidos.length, resueltos, faltantes } },
    };
  }
  return {
    facts: {
      lens: "clientes_por_sku", metrica: metLbl, detalle,
      // LA GRADACIÓN VIAJA ESTRUCTURADA, no como una advertencia que el narrador puede omitir al redactar.
      estatus: observada ? "probado" : "indicado",
      relacion: observada ? "observada" : "afinidad_modelada",
      lo_probado: observada
        ? "el dato registra qué SKU se le vendió a cada cuenta"
        : `el dato NO registra qué SKU se le vende a cada cuenta: lo probado es la ${metLbl} total de cada cuenta y la de cada SKU por separado`,
      lo_indicado: observada ? null
        : "el reparto cliente×SKU es una estimación de afinidad de surtido (marca dominante, luego familia); cierra exacto por cuenta y proporcional por SKU",
      advertencia_de_sujeto: "estas cifras son de venta/contribución asociada, NUNCA inventario atribuido a una cuenta",
    },
    boleta,
    coverage: { supported: true, figCount: boleta.length, cobertura: { pedidos: pedidos.length, resueltos, faltantes } },
  };
}

// entityRecord · LA FILA COMPLETA de una entidad: TODAS sus columnas reales del dato (unidades, valor de inventario,
// rotación, cobertura, días sin venta, estado, ventas, margen, contribución, rebate, precio…). Para preguntas
// concretas de campo ("unidades del SKU X", "el rebate de Falabella", "todo de LG-DRYER8KG"). El LLM lee lo que
// necesita y calcula si hace falta. Cada columna-cifra va autorizada → no inventa.
function entityRecord({ dimension, entity, scenario } = {}) {
  let dim = dimension;
  let r = buildEntityRecord(dim, entity, scenario);
  // AUTO-CORRECCIÓN DE EJE · mismo mecanismo que entityProfile (ver su comentario arriba): el plan puede acertar
  // la entidad y errar el eje ("Sodimac" con dimension:"marca") — reintentá con guessDimension antes de declinar.
  if (!r && entity != null) {
    const guessed = guessDimension(entity);
    if (guessed && guessed !== dim) { dim = guessed; r = buildEntityRecord(dim, entity, scenario); }
  }
  if (!r) return { facts: null, boleta: [], coverage: { supported: false, reason: `no encuentro '${entity}' en el eje '${dimension}'` } };
  // REFERENCIA AUTORIZADA por campo (owner "piensa bien" 2026-07-29, contrato de lectura mínima): si esta fila
  // trae un campo con vara declarada (margen/carga/rotación/cobertura), autorizamos TAMBIÉN esa vara real —
  // benchmarkOf/POLICY, la MISMA que ya usan diagnose/marginRead/mechanisms.js — para que cualquier narración
  // (determinística o libre) pueda citarla sin que el guard la rechace. Nunca un promedio de cartera inventado.
  const rawRec = rawRecordFor(dim, entity, scenario);
  let boleta = r.boleta;
  if (rawRec) for (const [token, refDef] of Object.entries(REFERENCIA_CAMPO)) {
    const lbl = fieldLabel(token);
    if (lbl == null || r.facts[lbl] == null) continue;   // esta fila no trae ese campo → sin vara que autorizar
    const refValue = refDef.getRef(rawRec);
    if (typeof refValue !== "number" || !isFinite(refValue)) continue;
    if (boleta.some((f) => f.label === refDef.label)) continue;
    boleta = [...boleta, fig(refDef.label, refDef.fmt(refValue), { unit: refDef.unit, context: "referencia declarada" })];   // registro: ver la nota de entityProfile
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
function tensionRead({ dimension, metricA = "contribucion", metricB = "stockUSD", limit = 10, dirA = "desc", dirB = "desc", entityScope = null, scenario } = {}) {
  const r = buildTension(dimension, { metricA, metricB, limit, dirA, dirB, entityScope, scenario });
  if (!r) return { facts: null, boleta: [], coverage: { supported: false, reason: `no puedo cruzar esas dos métricas por '${dimension}'` } };
  if (r.unsupported) return { facts: null, boleta: [], coverage: { supported: false, reason: r.unsupported } };
  return { facts: { ...r.facts, lens: "cuadro", entityType: dimension }, boleta: r.boleta, coverage: { supported: true, figCount: r.boleta.length } };
}

// gridTable · LA GRILLA: los top-N de una dimensión (cliente/sku/marca/familia) con TODAS sus columnas, para que el
// LLM arme una TABLA multi-columna. sortBy = por qué campo rankear (venta/contribucion/stockUSD/rotacion/margen…).
// Ej: "los 5 mejores SKU con ventas, costo medio, precio y margen de contribución" → {dimension:"sku",sortBy:"venta",limit:5}.
// entityScope (Etapa 2, owner 2026-08-03): forwarding mecánico a buildGrid — "de esos clientes, armame la tabla"
// acota la grilla al subconjunto en vez de traer el top-N del eje entero.
// `scenario` (owner 2026-08-09, decisión 4): `runPlan` ya inyectaba el escenario del turno en TODA call — esta tool
// simplemente no lo declaraba, así que lo descartaba en silencio y contestaba el dato base mirara el usuario lo que
// mirara. Ahora viaja hasta `_sources` (entityRecord.js), que lo resuelve con el MISMO `scenarioLoad` del contrato.
function gridTable({ dimension, sortBy = null, dir = "desc", limit = 20, entityScope = null, scenario } = {}) {
  const r = buildGrid(dimension, { sortBy, dir, limit, entityScope, scenario });
  if (!r) return { facts: null, boleta: [], coverage: { supported: false, reason: `no puedo armar la grilla del eje '${dimension}'` } };
  // ORDEN PEDIDO POR UNA COLUMNA QUE ESE EJE NO TIENE (owner 2026-08-10): `buildGrid` ahora DECLINA en vez de
  // servir la lista sin ordenar con el sello «descendente por X» puesto — mismo contrato `unsupported` que ya usa
  // `buildTension`. Degradar honesto acá vale más que una tabla cuyo orden sellado la propia columna desmiente.
  if (r.unsupported) return { facts: null, boleta: [], coverage: { supported: false, eje: dimension, reason: r.unsupported } };
  // DECISIÓN 8 · una grilla VACÍA no es una respuesta: `buildGrid` devuelve `{count:0, totalCount:0, rows:[]}` para
  // un eje que no tiene columnas propias en el dato (bodega, canal) y esto salía `supported:true` con cero cifras —
  // un turno que dice que puede y no trae nada. `totalCount` es la cuenta ANTES de cualquier alcance, así que
  // distingue "el eje no existe" de "el filtro dejó cero filas", que sí es una respuesta legítima.
  if (r.facts && r.facts.totalCount === 0) {
    return { facts: null, boleta: [], coverage: { supported: false, eje: dimension,
      reason: `no tengo una grilla por '${dimension}': ese eje no trae columnas propias en el dato — armarla con filas de otro eje sería contestar otra pregunta`,
      alternativas: ["la grilla por cliente", "la grilla por SKU"] } };
  }
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
  return _tagBodegaConflation(_pack(composeSpecResumenEjecutivo({ scenario }), "no puedo armar el resumen con este dato"));
}

// inventoryStatus · estado de inventario (capital detenido / frenado / cobertura). `focus` = el estado que interesa.
// _umbralDiasPedido(texto) → el corte de días que la PREGUNTA pide, si lo pide («más de 90 días», «hace 90 días»,
// «90 días sin venta») — la mitad honesta del encargo «umbral del usuario» (2026-08-13). Marcadores enumerados,
// nunca un número suelto: «90 días» pelado sin comparador ni «sin venta/parado» al lado no dispara nada.
const _UMBRAL_DIAS_CMP = /(?:m[aá]s\s+de|menos\s+de|desde\s+hace|hace\s+ya|hace|\+)\s*(\d{1,4})\s*d[ií]as?/i;
const _UMBRAL_DIAS_SUFIJO = /(\d{1,4})\s*\+?\s*d[ií]as?\s+(?:sin\b|parad|deten|inmoviliz|frenad|o\s+m[aá]s)/i;
function _umbralDiasPedido(texto) {
  const t = String(texto || "");
  const m = _UMBRAL_DIAS_CMP.exec(t) || _UMBRAL_DIAS_SUFIJO.exec(t);
  return m ? parseInt(m[1], 10) : null;
}
function inventoryStatus({ filters = {}, scenario, focus = "frenado", staleDays = null, entityScope = null, limit = null, _preguntaUsuario = null } = {}) {
  const x = _crossGuard(filters, _SCOPE_KEYS); if (x) return _crossFail(x);
  const r = _pack(composeSpecInventory({ filters: _isObj(filters) ? filters : {}, scenario, focus, staleDays, entityScope, limit }),
    "no hay señal de inventario para estos filtros");
  // `contrapunta` es OTRO estado del inventario (ej. riesgo de quiebre), INDEPENDIENTE del capital detenido — la clave
  // no lo decía y el LLM la leía como la CAUSA del capital frenado (y mezclaba sus familias con las de los SKU detenidos).
  const inv = r.facts && r.facts.inventory;
  if (inv && inv.contrapunta) {
    const { contrapunta, ...resto } = inv;
    r.facts = { ...r.facts, inventory: { ...resto, otro_estado_del_inventario: {
      // la nota viaja al prompt y el narrador la ecoa con sus palabras: si nombra el concepto con la palabra
      // vetada, la vetada es la que tiende a salir. Mismo concepto, registro correcto.
      ...contrapunta, nota: "estado INDEPENDIENTE del capital inmovilizado — no es su causa, y sus familias no son las de los SKU inmovilizados",
    } } };
  }
  // TRANSFERIR ENTRE BODEGAS (owner 2026-08-09, decisión 13): la respuesta natural a "tenés capital detenido en
  // Valparaíso" es "moverlo a donde se vende", y el dato no permite ni evaluarla — ningún SKU está en más de una
  // bodega, así que no hay dos colocaciones que comparar. Sentrix ya retiró la recomendación de sus tres
  // superficies (cara Capital · ring de bodega · lectura ejecutiva); ADI la recibía igual, porque la respuesta trae
  // el capital PARTIDO POR BODEGA y nada declaraba el límite. Se declara acá, leyendo la MISMA cuenta
  // (`transferenciaCapability`) sobre las MISMAS filas que la cara está pintando — nunca una segunda
  // implementación del hecho. `evaluable:true` (el día que un SKU aparezca en dos bodegas) hace que esto
  // desaparezca solo y la recomendación vuelva sin tocar código.
  if (r.coverage && r.coverage.supported) {
    const cap = transferenciaCapability(applyScenarioToSkuInventario(scenario));
    // LA NOTA DICE LAS TRES COSAS (owner 2026-08-10, certificación live · defecto C1). Antes decía una sola —"no
    // propongas transferir"— y por eso la respuesta podía quedarse en el diagnóstico sin contestar la decisión, o
    // contestarla de más ("no es posible mover el stock"). El límite es de EVALUACIÓN, no de posibilidad: mover
    // stock puede ser perfectamente posible en la bodega real; lo que este dato no permite es comprobar que
    // convenga. Y el registro vigente es "capital inmovilizado" (nunca "detenido", ver CLAUDE.md §4).
    if (!cap.evaluable) r.facts = { ...r.facts, limite_transferencia: { ...cap, nota: "si el usuario pregunta por mover, transferir o redistribuir stock entre bodegas, CONTESTÁ la decisión declinándola de forma explícita, y en la PRIMERA frase: no se puede EVALUAR esa transferencia con este dato (no es que sea imposible moverlo — es que no hay con qué comprobar que convenga). Decí qué información falta, que es " + cap.faltante + ". Nunca atribuyas el límite a «la herramienta» ni a «el sistema»: es el dato el que no alcanza. La medida que SÍ está sostenida sobre el capital inmovilizado es liquidar o rotar donde ya está" } };
  }
  /* ── REGLA DE HONESTIDAD DEL UMBRAL (encargo «umbral del usuario», 2026-08-13 — hallazgo VIVO del owner) ─────
   * MEDIDO: «¿cuánto capital tengo inmovilizado en inventario parado hace más de 90 días?» cayó a esta tool con
   * el foco por estados, y el total del criterio INTERNO ($33K: capital_frenado por rotación/DOH — BOS-SANDER
   * con 68 días adentro) salió presentado como si fuera «>90 días» (real con diasSinVenta>90: 2 SKU ≈ $22K).
   * La regla: cuando la pregunta (o el arg staleDays) trae un umbral numérico de días que ESTE foco no aplica,
   * la tool lo DECLARA en facts — y la declaración viaja OBLIGATORIA a la narración por su backstop
   * (ensureUmbralDeclarado, narratePromptC.js — la misma familia doctrina+garantía que la transferencia C1).
   * El foco `stale` SÍ aplica el umbral (composeSpecInventory filtra por diasSinVenta) → ahí no hay nada que
   * declarar. La declaración cita el número SOLO cuando viene de la pregunta (eco autorizado por el muro); un
   * staleDays de arg sin rastro en la pregunta se declara sin el número — jamás una cifra que el eco no cubre. */
  if (r.coverage && r.coverage.supported && focus !== "stale") {
    const diasPregunta = _umbralDiasPedido(_preguntaUsuario);
    const diasArg = typeof staleDays === "number" && staleDays > 0 ? staleDays : null;
    if (diasPregunta != null || diasArg != null) {
      const corte = diasPregunta != null ? `del corte de ${diasPregunta} días que pediste` : "del corte de días que pediste";
      r.facts = { ...r.facts, umbral_no_aplicado: {
        ...(diasPregunta != null ? { dias: diasPregunta } : {}), ...(diasArg != null ? { diasArg } : {}),
        // `declaracion` está DISEÑADA para citarse textual en la primera frase de la narración: es texto de
        // pantalla, no una instrucción. Va en registro — «lo inmovilizado», nunca «lo detenido» (CLAUDE.md §4).
        declaracion: `Ojo con el criterio: estas cifras salen del estado del inventario según tu política (lo inmovilizado por rotación y días de inventario), no ${corte} — ese umbral no está aplicado a estos montos.`,
        nota: `la pregunta pide un corte por días sin venta y ESTA lectura no lo aplica: su criterio son los ESTADOS del motor (rotación/días de inventario contra la política del negocio). DECLARALO en la primera frase y NUNCA presentes estos totales como si fueran el corte por días del usuario.`,
      } };
    }
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
  const dim = _ejeCanon(dimension) || dimension;   // "SKU"/"clientes" → el eje que el composer sí indexa
  const raw = composeSpecMargin({ filters: _isObj(filters) ? filters : {}, scenario, focus, dimension: dim, negativo, pct, gap, entityScope });
  const r = _pack(raw, `no hay lectura de margen para el eje '${dimension}' con estos filtros`);
  // DECISIÓN 8 · el eje que el composer no abre se DECLINA (nunca las filas de otro eje). La rama `gap` queda fuera:
  // ahí el pivot es deliberado y viaja declarado en `facts.margin.focus`.
  if (!gap) { const no = _ejeNoAbierto(dim, r, ["el margen por cliente", "el margen por familia", "el margen por marca"]); if (no) return _crossFail(no); }
  if (dim !== "cliente" && r.coverage && r.coverage.supported) {
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
  const dim = _ejeCanon(dimension) || dimension;   // "SKU"/"clientes" → el eje que el composer sí indexa
  const r = _pack(composeSpecVentas({ filters: _isObj(filters) ? filters : {}, scenario, focus, dimension: dim, gap, pivotFocus, entityScope }),
    `no hay lectura de ventas para el eje '${dimension}' con estos filtros`);
  // DECISIÓN 8 · dos formas del mismo defecto quedan cerradas acá: el eje inexistente (`bodega` → el composer caía
  // a `cliente`) y el pivot INTERNO que conserva el nombre del eje pedido (`vs_anterior` por SKU declara `sku` y
  // devuelve clientes, porque por SKU no hay año anterior — la aclaración vivía en el `opener`, que `_pack` no
  // entrega al oráculo). La rama `gap` queda fuera: su pivot viaja declarado en `facts.ventas.focus`/`gapLabel`.
  if (!gap) { const no = _ejeNoAbierto(dim, r, ["la venta por cliente", "la venta por familia", "la venta por marca"]); if (no) return _crossFail(no); }
  return r;
}

// contributionRead · lectura de contribución por eje (ranking · no capturada · por entidad).
function contributionRead({ filters = {}, scenario, focus = "rank", dimension = "cliente", entity = null, entityScope = null } = {}) {
  const x = _crossGuard(filters, _SCOPE_KEYS); if (x) return _crossFail(x);
  const dim = _ejeCanon(dimension) || dimension;   // "SKU"/"clientes" → el eje que el composer sí indexa
  const r = _pack(composeSpecContribucion({ filters: _isObj(filters) ? filters : {}, scenario, focus, dimension: dim, entity, entityScope }),
    `no hay lectura de contribución para el eje '${dimension}' con estos filtros`);
  // DECISIÓN 8 · mismo criterio que marginRead/salesRead (este composer comparte el fallback silencioso a `cliente`).
  const no = _ejeNoAbierto(dim, r, ["la contribución por cliente", "la contribución por familia", "la contribución por marca"]);
  return no ? _crossFail(no) : r;
}

// simulate · "¿y si…?" sobre una métrica × eje con un transform (supuesto → efecto). El guard exige graduación (Fase 2).
function simulate({ metric, dimension, filters = {}, transform } = {}) {
  return _pack(composeSpecSimulate({ metric, dimension, filters, transform }),
    "no puedo simular esa combinación métrica/eje/supuesto");
}

// simulateCarga · simulación sobre la carga comercial. DOS modos, uno solo por call:
//   · sin `delta_pp` → el de siempre: llevar la carga al target de POLICY (el que corre en producción).
//   · con `delta_pp` → el movimiento EN PUNTOS que el usuario declaró («reduce en 2 puntos» → -2), y el efecto
//     sobre el margen de cada cuenta contra el benchmark. `delta_pp` NO se infiere ni se completa: si el usuario
//     no lo dijo, no viaja (answerViaOracle.js lo despoja determinísticamente — ver _coerceDeltaCargaDeclarado).
// entityScope (Etapa 2, owner 2026-08-04): forwarding mecánico a composeSpecSimulateCarga — mismo mecanismo que
// simulateCosto (abajo), acota la simulación al subconjunto pedido en vez de correr sobre el eje comercial entero.
function simulateCarga({ filters = {}, scenario, entityScope = null, delta_pp = null } = {}) {
  const r = composeSpecSimulateCarga({ filters, scenario, entityScope, deltaPp: delta_pp });
  // mismo patrón que simulateCosto: `unsupported` es un decline CON MOTIVO (el string va a pantalla y al prompt),
  // distinto del null de "no hay dato" que _pack traduce con su razón genérica.
  if (r && r.unsupported) return { facts: null, boleta: [], coverage: { supported: false, reason: r.unsupported } };
  return _pack(r, "no hay carga recuperable para simular");
}

// simulateCapital · simulación específica de liberar capital detenido.
// entityScope (Etapa 2, owner 2026-08-04): forwarding mecánico a composeSpecSimulateCapital — mismo mecanismo.
function simulateCapital({ filters = {}, scenario, entityScope = null } = {}) {
  // `coverage.reason` NO es un log: cuando la tool no trae dato, ESTE string es el que el turno sirve a pantalla
  // (composeNoData) y el que el prompt le entrega al narrador como la razón a citar. Va en registro: «inmovilizado».
  return _pack(composeSpecSimulateCapital({ filters, scenario, entityScope }), "no hay capital inmovilizado para liberar");
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
      return { facts: null, boleta: [], coverage: { supported: false, reason: `un ${v.pct > 0 ? "+" : ""}${v.pct}% de ${label} ya no es un supuesto operable — prueba un rango realista (entre ±1% y ±${_SIM_DELTA_MAX}%) y lo corro sobre el dato real` } };
    }
  }
  let dim = dimension || "cliente";
  let raw = rawRecordFor(dim, entity, scenario);
  if (!raw && entity != null) {
    const guessed = guessDimension(entity);
    if (guessed && guessed !== dim) { dim = guessed; raw = rawRecordFor(dim, entity, scenario); }
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
    fig(`${entity} · Venta actual`, _moneyK(ventaActual), { unit: "money", raw: ventaActual * _fxT(), source: "actual", context: _ctx }),
    fig(`${entity} · Venta supuesta`, _moneyK(ventaNueva), { unit: "money", raw: ventaNueva * _fxT(), mandatory: true, source: "computed", formula: _fVenta, context: _ctx }),
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
      fig(`${entity} · Costo actual`, _moneyK(costoActual), { unit: "money", raw: costoActual * _fxT(), source: "actual", context: _ctx }),
      fig(`${entity} · Costo supuesto`, _moneyK(costoNuevo), { unit: "money", raw: costoNuevo * _fxT(), source: "computed", formula: `costo × (1${volumenVar.pct >= 0 ? "+" : ""}${volumenVar.pct}%)`, context: _ctx }),
      fig(`${entity} · Contribución actual`, _moneyK(contribActual), { unit: "money", raw: contribActual * _fxT(), source: "actual", context: _ctx }),
      fig(`${entity} · Contribución supuesta`, _moneyK(contribNueva), { unit: "money", raw: contribNueva * _fxT(), mandatory: true, source: "computed", formula: "venta supuesta − costo supuesto", context: _ctx }),
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

// ── pnlRead · EL RESULTADO DEL NEGOCIO (owner 2026-08-09 · decisión 3 · hallazgo L) ─────────────────────────────
// LA CONFUSIÓN QUE MATA. Sin esta tool, "¿cuál es el resultado del negocio después de gastos?" caía al oráculo sin
// ninguna tool de P&L y se contestaba con la CONTRIBUCIÓN. Contribución y resultado son DOS NIVELES DISTINTOS de la
// misma cascada: la contribución es lo que queda ANTES de los gastos declarados, el resultado lo que queda DESPUÉS.
// Servir una por la otra no es un matiz de vocabulario — es responder otra pregunta con una cifra real.
//
// ENVUELVE, NO RECALCULA. `composePnl` (pnl.js) ya es el contrato: emite la cascada sellada (ingreso − costo −
// carga − gastos == resultado, exacto por construcción) con TODA su boleta autorizada, y `buildPnlCascade` es la
// MISMA función de la que se sirven la cara Resultado y el cuadro por entidad. Acá no hay una segunda aritmética:
// se llama al composer, se le quita la presentación (opener/suggestions) y se empaqueta como {facts, boleta,
// coverage} igual que `_pack` hace con los demás. La cifra que devuelve esta tool es, byte a byte, la que muestra
// Sentrix en la cara Resultado.
//
// POR QUÉ NO SE LLAMA A composePnl SIN LÍNEAS. Sin P&L declarado, `composePnl` responde con la GUÍA del flujo — y
// para eso ABRE un draft en el módulo (`sinPnl()`: `_draft = {stage:"gastos"}`). Una tool del oráculo es pura por
// contrato y no puede dejar al usuario a mitad de un flujo conversacional que nadie pidió. Con P&L sin declarar,
// esta tool DECLINA honesto (decisión 8) y el narrador guía; el flujo guiado lo abre la ruta conversacional, que es
// la que sabe conducirlo.
// EJES: `pnlDisponibilidad()` es data-driven (un eje entra si la base del P&L trae la venta desglosada hacia él).
// SKU/bodega/canal NO están: la tool declina con el motivo DECLARADO por el propio contrato, nunca prorratea sobre
// un eje sin venta (decisión 8: si una tool no soporta un eje, lo dice — jamás devuelve filas de otro).
function pnlRead({ focus = "resultado", entity = null, dimension = null, scenario } = {}) {
  const _no = (reason, alternativas = []) => ({ facts: null, boleta: [], coverage: { supported: false, reason, ...(alternativas.length ? { alternativas } : {}) } });
  if (!pnlDefined()) {
    return _no("el P&L no está declarado para este negocio: sin las líneas de gasto (y su % sobre la venta) la cuenta llega hasta la CONTRIBUCIÓN y no hay resultado después de gastos que afirmar. La contribución NO es el resultado.",
      ["la contribución del negocio (el nivel que sí está cerrado)", "declarar las líneas de gasto para abrir el resultado"]);
  }
  // ALCANCE. `entity` gana sobre `dimension` (es el pedido más específico). El nombre se resuelve contra el canon
  // REAL del P&L —el mismo resolvedor del flujo conversacional—, nunca contra el fraseo del plan.
  let pi = null, dim = null;
  if (entity != null && String(entity).trim()) {
    const c = pnlEntidadCanon(entity);
    if (!c) return _no(`no encuentro a '${entity}' entre las entidades que el P&L puede alcanzar`, pnlEjesDisponibles().map((d) => `el P&L por ${d.label.sing}`));
    if (!c.covered) {
      const d = pnlDisponibilidad().find((x) => x.eje === c.eje);
      return _no(`${c.nombre} existe, pero ${(d && d.motivo) || `la venta del P&L no baja desglosada a ${c.eje}`} — prorratear sobre un eje sin venta desglosada inventaría la cifra`, pnlEjesDisponibles().map((x) => `el P&L por ${x.label.sing}`));
    }
    pi = { action: "resultado_scoped", entidad: c.nombre, eje: c.eje, covered: true };
    dim = c.eje;
  } else if (dimension != null && String(dimension).trim()) {
    const d = pnlDisponibilidad().find((x) => x.eje === dimension);
    if (!d) return _no(`'${dimension}' no es un eje del negocio`, pnlEjesDisponibles().map((x) => `el P&L por ${x.label.sing}`));
    if (!d.available) return _no(`${d.motivo} — el P&L no se puede abrir por ${d.label.sing} sin inventar el prorrateo`, pnlEjesDisponibles().map((x) => `el P&L por ${x.label.sing}`));
    pi = { action: "tabla_eje", eje: dimension };
    dim = dimension;
  } else if (focus === "linea" || focus === "peso" || focus === "gastos") {
    pi = { action: "peso" };
  } else {
    pi = { action: "resultado" };
  }
  const r = composePnl(pi, null, { scenario });
  const ev = (r && r.evidence) || {};
  const boleta = Array.isArray(ev.boleta) ? ev.boleta : [];
  if (!boleta.length) return _no("el P&L no pudo armarse con estos parámetros");
  // LOS NIVELES, explícitos. `buildPnlCascade` es la MISMA función que acaba de correr adentro del composer (pura,
  // mismo escenario, mismas líneas ⇒ mismas cifras): acá se lee para poder DECLARAR el nivel de cada peldaño, que
  // es justo lo que faltaba para que "contribución" y "resultado" dejaran de ser intercambiables.
  // `buildPnlCascade` normaliza el eje base por sí sola (opts.dimension === _BASE_EJE cae al mismo camino), así que
  // el eje se le pasa tal cual: quién es el eje base lo decide el DATO en pnl.js, no un nombre escrito acá.
  const c = buildPnlCascade(scenario, null, dim ? { dimension: dim } : null);
  const _p1 = (v) => `${Math.round(v * 10) / 10}%`;
  // ── LA CASCADA DEL ALCANCE QUE SE PIDIÓ, no la del negocio (defecto real, medido) ─────────────────────────────
  // Con `entity`, la boleta que devuelve el composer es la de ESA entidad ("Resultado · Falabella $3.0M") pero los
  // `facts` describían la cascada del NEGOCIO: el narrador leía «Contribución $25.0M · Resultado del negocio
  // $18.5M» como respuesta a «¿cuánto me deja Falabella después de gastos?» — una cifra real contestando otra
  // pregunta, exactamente el modo de falla que esta tool existe para cerrar, y encima con 6 de esas 8 cifras FUERA
  // de la boleta de ese turno (sin autorizar: el guard las habría rechazado). `porEntidad` es la MISMA cuenta que
  // ya emitió el composer —no hay aritmética nueva— y cada valor coincide byte a byte con su fila de la boleta.
  const ent = pi.action === "resultado_scoped" ? (c.porEntidad || []).find((x) => x.nombre === pi.entidad) || null : null;
  const cascadaNegocio = {
    Ingreso: _moneyK(c.ingresoK), Costo: _moneyK(c.costoK), "Margen bruto": _moneyK(c.margenBrutoK),
    "Carga comercial": _moneyK(c.cargaK), Contribución: _moneyK(c.contribK),
    "Gastos declarados": _moneyK(c.totalGastosK), "Resultado del negocio": _moneyK(c.resultadoK),
    "Resultado sobre la venta": _p1(c.resultadoPct),
  };
  const cascadaEntidad = ent && {
    [`Ingreso · ${ent.nombre}`]: _moneyK(ent.ventaK), [`Costo · ${ent.nombre}`]: _moneyK(ent.costoK),
    [`Margen bruto · ${ent.nombre}`]: _moneyK(ent.margenBrutoK), [`Carga comercial · ${ent.nombre}`]: _moneyK(ent.cargaK),
    [`Contribución · ${ent.nombre}`]: _moneyK(ent.contribK), [`Gastos prorrateados · ${ent.nombre}`]: _moneyK(ent.gastoK),
    [`Resultado · ${ent.nombre}`]: _moneyK(ent.resultadoK), [`Resultado % · ${ent.nombre}`]: _p1(ent.resultadoPct),
  };
  // el ancla del negocio en el turno scopeado se limita a las DOS cifras que la boleta de ese turno sí autoriza
  // (el resultado del negocio y su %) — cualquier otra sería una cifra que el narrador no puede afirmar.
  const facts = {
    pnl: true,                       // SENTRIX ES LA EVIDENCIA: abre la cara Resultado (address.js, rama evidence.pnl)
    alcance: pi.action === "resultado_scoped" ? pi.entidad : "negocio",
    ...(pi.action === "resultado_scoped" ? { entidad: pi.entidad } : {}),
    dimension: dim || "negocio",
    periodo: "año cerrado — los 12 meses ya ocurrieron",
    nivel_respondido: pi.action === "peso" ? "gastos_declarados" : "resultado_final",
    // scopeado sin fila (no debería ocurrir: el canon y `porEntidad` salen de la misma base) → NO se cae a la
    // cascada del negocio, que sería otra vez la cifra equivocada; se declara sólo lo que la boleta autoriza.
    ...(cascadaEntidad ? { cascada: cascadaEntidad } : pi.action === "resultado_scoped" ? {} : { cascada: cascadaNegocio }),
    ...(pi.action === "resultado_scoped" ? { contexto_negocio: { "Resultado del negocio": _moneyK(c.resultadoK), "Resultado % · negocio": _p1(c.resultadoPct) } } : {}),
    // los gastos del alcance pedido: mismo % declarado, aplicado a la venta de ESA entidad (la cifra que la
    // boleta ya trae como "Gasto · <línea> · <entidad>"), nunca el monto del negocio dentro de un turno scopeado.
    supuestos: c.gastos.map((g) => ({
      linea: g.nombre, supuesto: _p1(g.pct), origen: g.origen,
      ...(ent ? { monto: _moneyK((ent.ventaK * g.pct) / 100) } : pi.action === "resultado_scoped" ? {} : { monto: _moneyK(g.usdK) }),
    })),
    // LA DISTINCIÓN, dicha sin una sola cifra (para que no dependa de que el narrador la derive ni agregue una
    // cifra al universo autorizado): son dos peldaños, no dos nombres del mismo.
    nota_nivel: "«contribución» y «resultado» son DOS niveles distintos de esta misma cascada: la contribución es lo que queda ANTES de los gastos declarados; el resultado del negocio es lo que queda DESPUÉS. Si la pregunta dice resultado, utilidad, estado de resultados o «después de gastos», la respuesta es el RESULTADO — nunca la contribución.",
    graduacion: "hasta la contribución el dato es probado (venta y margen del período); los gastos son supuestos declarados por el usuario como % sobre la venta, así que el resultado y su % son INDICADOS y se mueven con esos supuestos.",
    ...(ev.tablaM ? { tablaM: ev.tablaM } : {}),
    ...(ev.entityList ? { entityList: ev.entityList } : {}),
  };
  return { facts, boleta, coverage: { supported: true, figCount: boleta.length, nivel: facts.nivel_respondido } };
}

/* ── calcular · LA CALCULADORA DE CATÁLOGO CERRADO (AMPLITUD F2, owner 2026-08-13, decisión D1) ─────────────────
 * «El LLM propone, el motor calcula, el muro sella»: el planificador pide una cuenta EXPLÍCITA por su nombre de
 * catálogo, con los insumos POR REFERENCIA (entidad·métrica del dato, o cifra del usuario CON su procedencia —
 * jamás números sueltos sin origen), y el motor la ejecuta con la fórmula declarada. La aritmética y las reglas
 * duras (unidades verificadas · universos que no reconcilian · catálogo cerrado) viven en calculoCatalogo.js.
 *
 * SELLOS (los existentes de figureType, ningún sello nuevo):
 *   · resultado derivado de datos del motor → source:"computed" → verificabilidad `derivada_no_reconciliada`
 *     → sello INDICADO (el mismo camino que las figs "computed" de simulateGeneral/simulateCosto);
 *   · con una cifra del usuario adentro → además `facts.conCifraDeUsuario`, que ensureHypothesisFraming
 *     (narratePromptC.js) lee para garantizar el marco de escenario/hipótesis — el mismo marco que simulate*.
 *
 * DECLINA HONESTO (cada una con su razón): operación fuera del catálogo · insumo inexistente en el dato ·
 * cifra del usuario sin procedencia · unidades incompatibles · cruce de los dos universos (nombrando la regla). */
// métrica del PLAN → campo del registro crudo (los MISMOS tokens del catálogo de tools: ventas/margen/…)
const _CALC_NORM = (x) => String(x == null ? "" : x).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const _CALC_CAMPO = {
  ventas: "venta", venta: "venta", margen: "margen", contribucion: "contribucion", costo: "costo",
  acciones: "rebates", rebates: "rebates", rebate: "rebates", carga: "pctRebate", pctrebate: "pctRebate",
  capital: "stockUSD", stockusd: "stockUSD", rotacion: "rotacion", doh: "doh", cobertura: "doh",
  "dias de inventario": "doh", preciolista: "precioLista", "precio de lista": "precioLista",
  costomedio: "costoMedio", "costo medio": "costoMedio", unidades: "unidades", benchmark: "benchmark",
  anterior: "anterior", "ano anterior": "anterior", "venta anterior": "anterior", presupuesto: "presupuesto",
};
// unidad y escala de cada campo — espeja la F-table de entityRecord.js (k:true = almacenado en MILES de $).
const _CALC_UNIT = {
  venta: { u: "money", k: true }, contribucion: { u: "money", k: true }, costo: { u: "money", k: true },
  rebates: { u: "money", k: true }, anterior: { u: "money", k: true }, presupuesto: { u: "money", k: true },
  stockUSD: { u: "money" }, precioLista: { u: "money" }, costoMedio: { u: "money" },
  margen: { u: "pct" }, pctRebate: { u: "pct" }, benchmark: { u: "pct" },
  rotacion: { u: "ratio" }, doh: { u: "days" }, unidades: { u: "count" },
};
const _CALC_NEGOCIO = new Set(["negocio", "el negocio", "cartera", "la cartera", "total", "global"]);
// la cifra LIBRE del usuario («25%», «$2M», «4 puntos de margen», «8,3%») — mismas normalizaciones acotadas que
// cifrasDelUsuario (narrationContract): puntos→pp, millones/mil→M/K, $ implícito. Un número pelado queda "count"
// (un factor de regla de tres). El PARSER es el de la boleta (parseFigures) — jamás un segundo.
function _cifraLibre(texto) {
  const t = String(texto || "").trim().replace(/puntos?\s+porcentuales?|puntos?\s+de\s+(?:margen|brecha|carga)|\bpuntos?\b/gi, "pp");
  for (const v of [t, t.replace(/\s*millones?\b/i, "M").replace(/\s*mil\b/i, "K"), simboloMoneda() + t.replace(/\s*millones?\b/i, "M").replace(/\s*mil\b/i, "K").replace(/^\$\s?/, "")]) {
    const p = parseFigures(v);
    if (p.length) return p[0];
  }
  const m = /-?\d+(?:[.,]\d+)?/.exec(t);
  if (m) { const n = parseNumeroLocalizado(m[0]); if (Number.isFinite(n)) return { raw: n, unit: "count", text: m[0] }; }
  return null;
}
// _resolverInsumoCalc(spec, scenario) → { ok, insumo:{raw,unit,universo,label,value,origen,procedencia?} } | { ok:false, razon }
function _resolverInsumoCalc(spec, scenario) {
  // los reasons de esta función también son texto de pantalla (composeNoDataMessage los cita verbatim): palabras
  // de usuario, sin JSON, sin tokens de código, sin voseo — misma regla que _razonCalcEnPalabras (abajo).
  if (!spec || typeof spec !== "object") return { ok: false, razon: "cada cifra del cálculo es una referencia: una entidad con su métrica del dato, o tu propia cifra con su origen declarado" };
  // ── cifra del usuario, SIEMPRE con su procedencia (regla 1 del catálogo) ──
  if (spec.usuario != null) {
    const texto = String(spec.usuario).trim();
    const f = _cifraLibre(texto);
    if (!f) return { ok: false, razon: `no encuentro una cifra en «${texto}» — pásame el número con su unidad (%, $, puntos)` };
    const procedencia = texto.replace(f.text, " ").replace(/\s+/g, " ").trim();
    if (procedencia.replace(/[^\p{L}\p{N}]/gu, "").length < 3) {
      return { ok: false, razon: "una cifra tuya entra al cálculo solo con su procedencia — dime de dónde sale (una noticia, tu meta, un supuesto) y la uso como escenario" };
    }
    return { ok: true, insumo: { raw: f.raw, unit: f.unit, universo: null, label: `Cifra del usuario · ${f.text}`, value: formatearCanon(f.raw, f.unit), origen: "usuario", procedencia } };
  }
  // ── referencia al dato: entidad·métrica (o la métrica del negocio entero) ──
  const campo = _CALC_CAMPO[_CALC_NORM(spec.metrica)];
  if (!campo) return { ok: false, razon: `no reconozco «${spec.metrica}» como una métrica del dato — puedo operar ventas, margen, contribución, costo, acciones comerciales, carga, capital en inventario, rotación, días de inventario, precio de lista, costo medio, unidades y benchmark` };
  const meta = _CALC_UNIT[campo];
  const entidad = spec.entidad != null ? String(spec.entidad).trim() : "";
  if (!entidad || _CALC_NEGOCIO.has(_CALC_NORM(entidad))) {
    // el negocio entero: deriveKpis — los MISMOS agregados de la Mesa, nunca una re-suma propia.
    const k = deriveKpis(scenario);
    const disp = { venta: { raw: k.ventas.totalActual * _fxT(), unit: "money" }, anterior: { raw: k.ventas.totalAnterior * _fxT(), unit: "money" }, presupuesto: { raw: k.ventas.totalPresupuesto * _fxT(), unit: "money" }, contribucion: { raw: k.margen.totalUSD * _fxT(), unit: "money" }, margen: { raw: k.margen.pct, unit: "pct" }, benchmark: { raw: k.margen.benchmark, unit: "pct" } };
    const v = disp[campo];
    if (!v || !Number.isFinite(v.raw)) return { ok: false, razon: `«${spec.metrica}» no está como agregado del negocio entero — nombra la entidad puntual y lo busco en su registro` };
    const label = `Negocio · ${fieldLabel(campo) || campo}`;
    return { ok: true, insumo: { raw: v.raw, unit: v.unit, universo: universoDe(label, v.unit), label, value: formatearCanon(v.raw, v.unit), origen: "motor" } };
  }
  let dim = spec.dimension || guessDimension(entidad) || "cliente";
  let rec = rawRecordFor(dim, entidad, scenario);
  if (!rec) { const g = guessDimension(entidad); if (g && g !== dim) { dim = g; rec = rawRecordFor(dim, entidad, scenario); } }
  if (!rec) return { ok: false, razon: `no encuentro '${entidad}' en el dato` };
  const crudo = campo === "benchmark" ? benchmarkOf(rec) : rec[campo];
  if (typeof crudo !== "number" || !Number.isFinite(crudo)) return { ok: false, razon: `«${entidad}» no tiene «${spec.metrica}» en su registro — esa medida no existe en su eje del dato` };
  const raw = meta.k ? crudo * _fxT() : crudo;
  const label = `${rec.nombre || entidad} · ${fieldLabel(campo) || campo}`;
  return { ok: true, insumo: { raw, unit: meta.u, universo: universoDe(label, meta.u), label, value: formatearCanon(raw, meta.u), origen: "motor" } };
}
const _CALC_ETIQ = { suma: "Suma", resta: "Diferencia", variacion: "Variación", participacion: "Participación", brecha: "Brecha", escalado: "Proyección", delta: "Variación en $", proyectado: "Proyección", margen_actual: "Margen actual", contribucion_objetivo: "Contribución objetivo", contribucion_faltante: "Contribución faltante" };
/* ── LAS RAZONES DE LA CALCULADORA HABLAN EN PALABRAS DE USUARIO (cierre de la cert amplia 2026-08-13, hallazgo 3) ─
 * MEDIDO EN VIVO (hilo E turno 5): «'escalar' necesita exactamente 2 insumos (llegaron 1) — un monto $ …» salió
 * VERBATIM a pantalla — nombre de operación entre comillas, conteo de aridad, vocabulario de contrato. La MISMA
 * familia del Paso 2 (la excusa interna del glosario): coverage.reason ES texto de pantalla (composeNoDataMessage
 * lo cita literal), así que se escribe para el usuario. REGLA VERIFICABLE (probe + gate): sin identificadores con
 * guion bajo (/\w_\w/), sin nombres de operación del catálogo, sin la palabra «insumos». Las razones internas de
 * calculoCatalogo.js quedan INTACTAS (precisas, con su `regla`) — la tool las traduce en la frontera, igual que
 * defineConcept des-tokeniza antes de citar. Las declinaciones legítimas (unidades, universos) conservan su
 * honestidad: se dice QUÉ no opera y QUÉ hace falta, solo que en palabras. */
const _CALC_QUE_FALTA = {
  suma: "para sumar necesito exactamente las dos cifras a operar — dime cuáles dos junto",
  resta: "para restar necesito exactamente las dos cifras a operar — dime cuál le resto a cuál",
  variacion_pct: "para medir esa variación necesito el punto de partida y el de llegada — ¿entre qué dos montos la calculo?",
  participacion: "para calcular esa participación necesito la parte y el total — ¿qué mido sobre qué?",
  brecha_pp: "para medir esa brecha necesito las dos tasas a comparar — ¿cuál comparo contra cuál?",
  escalar: "para proyectar ese aumento necesito saber sobre qué monto aplicarlo — ¿la venta total del negocio?",
  variacion_aplicada: "para proyectar ese cambio necesito el monto base y el porcentaje a aplicar — ¿sobre qué monto lo aplico? ¿la venta total del negocio?",
  margen_objetivo: "para calcular qué falta hasta esa meta necesito la entidad (su venta y su contribución) y la tasa objetivo con su origen — ¿de qué entidad hablamos?",
};
const _CALC_ACEPTA = {
  suma: "dos cifras de la MISMA unidad — $ con $, puntos con puntos, unidades con unidades; una tasa (%) no se junta con un monto",
  resta: "dos cifras de la MISMA unidad — $ con $, puntos con puntos; una tasa (%) no se descuenta de un monto",
  variacion_pct: "dos montos de la MISMA unidad ($ con $, o unidades con unidades)",
  participacion: "dos montos de la MISMA unidad y del mismo universo",
  brecha_pp: "dos tasas (%) — la diferencia sale en puntos",
  escalar: "un monto en $ (lo que vale una unidad o un punto) y un factor en puntos o unidades — no una tasa %",
  variacion_aplicada: "un monto en $ y la variación en % a aplicarle",
  margen_objetivo: "la venta ($) y la contribución ($) de la entidad, más la tasa objetivo (%)",
};
const _CALC_UNIT_PALABRA = { money: "un monto en $", pct: "una tasa en %", pp: "puntos", count: "unidades", ratio: "veces", days: "días" };
const _CALC_CATALOGO_EN_PALABRAS = "esa cuenta no está en mi catálogo de cálculo — puedo sumar y restar montos, medir variaciones y participaciones, brechas en puntos, proyectar un cambio porcentual y calcular qué falta para llegar a un margen objetivo. No ejecuto fórmulas libres; dime cuál de esas necesitas y sobre qué cifras.";
function _razonCalcEnPalabras(res, operacion, resueltos) {
  if (!res || !res.regla) return _CALC_CATALOGO_EN_PALABRAS;
  if (res.regla === "catalogo-cerrado") return _CALC_CATALOGO_EN_PALABRAS;
  if (res.regla === "aridad") return _CALC_QUE_FALTA[operacion] || "me faltan cifras para esa cuenta — dime sobre cuáles la hago";
  if (res.regla === "unidades-incompatibles") {
    const llegaron = (resueltos || []).map((i) => _CALC_UNIT_PALABRA[i.unit] || i.unit).join(" y ");
    const acepta = _CALC_ACEPTA[operacion] || "cifras compatibles entre sí";
    return `esa cuenta no opera con lo que llegó (${llegaron}): necesita ${acepta} — no convierto unidades en silencio`;
  }
  if (res.regla === "insumo-invalido") return "cada cifra entra al cálculo con su valor y su unidad declarados — así como llegó no la puedo usar; dime la cifra con su unidad ($, %, unidades)";
  return res.razon;   // universos-no-reconcilian: ya nombra la regla y su razón medida en palabras (el gate la fija)
}
/* ── suma_filtrada · FILTRAR + SUMAR CON EL UMBRAL DEL USUARIO (encargo «umbral del usuario», 2026-08-13) ───────
 * El hallazgo VIVO del owner: «¿cuánto capital tengo inmovilizado en inventario parado hace más de 90 días?» cayó
 * a inventoryStatus y el total del criterio INTERNO del motor ($33K, estados por rotación/DOH) salió presentado
 * como si fuera el umbral pedido — con diasSinVenta>90 el total real son 2 SKU ≈ $22K. Esta rama es la capacidad
 * que faltaba: sumar un campo MONETARIO de las filas de UN universo cuyo OTRO campo cumple el umbral del usuario.
 *
 * LAS REGLAS DE LA RAMA (las del encargo, verificables por gate):
 *   a · CAMPOS POR REFERENCIA DECLARADA — el registro de abajo es la única puerta: capital en inventario como
 *       campo a sumar; días sin venta / días de inventario / rotación como campo del umbral. Todos del MISMO
 *       universo (inventario por SKU) — un campo del universo comercial (venta, margen…) declina NOMBRANDO que
 *       los dos universos no reconcilian, jamás cruza en silencio (la reconciliación de F2 sigue mandando).
 *   b · EL CRITERIO COMPLETO ES PARTE DEL RESULTADO — la fórmula del total declara el umbral Y las filas que lo
 *       componen («$22.0K = capital en inventario de los 2 SKU con más de 90 días sin venta: …»); cada fila entra
 *       a la boleta con su monto y su valor del campo filtrado. Un total filtrado sin sus filas es un top-N sin
 *       cola. El umbral mismo entra como cifra sellada (es del usuario: se declara, no se verifica contra el dato).
 * Las razones de declinación son texto de pantalla: palabras de usuario, sin nombres de operación ni tokens de
 * código (la misma regla de _razonCalcEnPalabras). */
const _SF_CAMPO_SUMA = {
  capital: { campo: "stockUSD", label: "Capital en inventario" },
  "capital en inventario": { campo: "stockUSD", label: "Capital en inventario" },
  stock: { campo: "stockUSD", label: "Capital en inventario" }, inventario: { campo: "stockUSD", label: "Capital en inventario" },
};
const _SF_CAMPO_UMBRAL = {
  "dias sin venta": { campo: "diasSinVenta", u: "days", enPalabras: "días sin venta" },
  diassinventa: { campo: "diasSinVenta", u: "days", enPalabras: "días sin venta" },
  "sin venta": { campo: "diasSinVenta", u: "days", enPalabras: "días sin venta" },
  doh: { campo: "doh", u: "days", enPalabras: "días de inventario" },
  "dias de inventario": { campo: "doh", u: "days", enPalabras: "días de inventario" },
  cobertura: { campo: "doh", u: "days", enPalabras: "días de inventario" },
  rotacion: { campo: "rotacion", u: "ratio", enPalabras: "rotación" },
};
const _SF_OPS = {
  ">": { f: (a, b) => a > b, palabra: "más de" }, ">=": { f: (a, b) => a >= b, palabra: "al menos" },
  "<": { f: (a, b) => a < b, palabra: "menos de" }, "<=": { f: (a, b) => a <= b, palabra: "hasta" },
};
const _SF_OP_ALIAS = { "mas de": ">", "mayor a": ">", "mayor que": ">", sobre: ">", "menos de": "<", "menor a": "<", "menor que": "<", bajo: "<", "al menos": ">=", desde: ">=", hasta: "<=", "como mucho": "<=" };
const _SF_LISTA = "puedo sumar el capital en inventario de los SKU filtrando por días sin venta, días de inventario o rotación, con el corte que me digas (más de 90 días, rotación bajo 1, etc.)";
function _calcSumaFiltrada({ insumos, umbral, scenario, _no }) {
  const u = umbral && typeof umbral === "object" ? umbral : {};
  const campoTxt = _CALC_NORM((Array.isArray(insumos) && insumos[0] && insumos[0].metrica) || u.suma || "");
  const umbralTxt = _CALC_NORM(u.metrica || u.campo || "");
  if (!campoTxt || !umbralTxt) return _no(`para ese total filtrado necesito el campo a sumar y el umbral con su corte — ${_SF_LISTA}`);
  const suma = _SF_CAMPO_SUMA[campoTxt];
  const filtro = _SF_CAMPO_UMBRAL[umbralTxt];
  if (!suma || !filtro) {
    // ¿el campo que no calza es del universo COMERCIAL? entonces la razón es la regla de universos, no un hueco.
    const comercial = _CALC_CAMPO[!suma ? campoTxt : umbralTxt];
    if (comercial && ["venta", "margen", "contribucion", "costo", "rebates", "pctRebate", "anterior", "presupuesto", "benchmark", "unidades", "precioLista", "costoMedio"].includes(comercial)) {
      return _no(`no puedo cruzar la venta comercial con el inventario en un mismo total filtrado: los dos universos no reconcilian (la venta viene en miles de $ y el inventario en dólares crudos, con unidades que difieren por SKU) — ${_SF_LISTA}`);
    }
    return _no(`no reconozco ese campo por fila del inventario — ${_SF_LISTA}`);
  }
  const opKey = _SF_OPS[String(u.operador || u.op || "").trim()] ? String(u.operador || u.op).trim() : _SF_OP_ALIAS[_CALC_NORM(u.operador || u.op || "")];
  const cmp = _SF_OPS[opKey];
  const valor = Number(u.valor);
  if (!cmp || !Number.isFinite(valor)) return _no("me falta el corte del umbral — dime el número y su dirección (más de / menos de / al menos / hasta)");
  const vTxt = filtro.u === "ratio" ? `${valor}x` : String(valor);
  const enPalabras = filtro.campo === "rotacion"
    ? (opKey === ">" || opKey === ">=" ? `rotación sobre ${vTxt}` : `rotación bajo ${vTxt}`)
    : `${cmp.palabra} ${vTxt} ${filtro.enPalabras}`;
  const rows = applyScenarioToSkuInventario(scenario) || [];
  const filas = rows
    .filter((r) => typeof r[filtro.campo] === "number" && typeof r[suma.campo] === "number" && cmp.f(r[filtro.campo], valor))
    .map((r) => ({ entidad: r.sku, monto: r[suma.campo], criterio: r[filtro.campo] }))
    .sort((a, b) => b.monto - a.monto);
  // el label del criterio NO nombra la métrica del filtro a propósito: «sin venta» en un label le daría dueño
  // de MÉTRICA «ventas» al eco del umbral (chequeo 9) y una narración legítima que diga «más de 90 días» al lado
  // de un monto de capital se marcaría sola. El criterio completo viaja en context, formula y facts.
  const boleta = [fig(`Criterio del filtro · umbral pedido`, formatearCanon(valor, filtro.u), {
    unit: filtro.u, raw: valor, sello: "indicado",
    verificabilidadRazon: "umbral aportado por el usuario — es su criterio de corte, se declara y se aplica, no se verifica contra el dato",
    context: `el umbral del filtro: ${enPalabras}`,
  })];
  if (!filas.length) {
    boleta.push(fig(`SKU con ${enPalabras} · ${suma.label} total`, formatearCanon(0, "money"), {
      unit: "money", raw: 0, mandatory: true, source: "computed", formula: `$0 = ningún SKU cumple ${enPalabras}`, context: "suma con el umbral del usuario",
    }));
    return { facts: { es_calculo: true, operacion: "suma_filtrada", criterio: { campo: filtro.enPalabras, operador: opKey, valor, en_palabras: enPalabras }, campo_sumado: suma.label, filas: [], total: { value: formatearCanon(0, "money"), formula: `$0 = ningún SKU cumple ${enPalabras}` }, nota_criterio: "ningún SKU cumple el criterio pedido — decílo tal cual, con el criterio completo" }, boleta, coverage: { supported: true, figCount: boleta.length } };
  }
  // la suma corre por el CATÁLOGO (una fila filtrada = un insumo) — jamás una segunda aritmética acá.
  const res = ejecutarCalculo("suma_filtrada", filas.map((f) => ({ raw: f.monto, unit: "money", universo: universoDe(`${f.entidad} · ${suma.label}`, "money"), label: `${f.entidad} · ${suma.label}`, origen: "motor" })));
  if (!res.ok) return _no(_razonCalcEnPalabras(res, "suma_filtrada", []));
  const total = res.resultados[0];
  // top-N + Resto (el patrón de todo top-N del producto): el detalle muestra hasta 8 filas, el resto agrupado
  // reconcilia con el total — jamás filas que suman menos que el total mostrado.
  const detalle = filas.slice(0, 8);
  const resto = filas.slice(8);
  for (const f of detalle) {
    boleta.push(fig(`${f.entidad} · ${suma.label}`, formatearCanon(f.monto, "money"), { unit: "money", raw: f.monto, context: `cumple ${enPalabras}` }));
    boleta.push(fig(`${f.entidad} · ${filtro.enPalabras.charAt(0).toUpperCase() + filtro.enPalabras.slice(1)}`, formatearCanon(f.criterio, filtro.u), { unit: filtro.u, raw: f.criterio, context: `criterio del filtro: ${enPalabras}` }));
  }
  if (resto.length) {
    const restoUsd = resto.reduce((a, f) => a + f.monto, 0);
    boleta.push(fig(`Resto (${resto.length} de ${filas.length}) · ${suma.label}`, formatearCanon(restoUsd, "money"), { unit: "money", raw: restoUsd, context: `cumplen ${enPalabras}` }));
  }
  const partesFormula = detalle.slice(0, 4).map((f) => `${f.entidad} (${formatearCanon(f.monto, "money")}, ${filtro.campo === "rotacion" ? `rotación ${formatearCanon(f.criterio, filtro.u)}` : `${f.criterio} ${filtro.enPalabras}`})`);
  const masAlla = filas.length > 4 ? ` + … y ${filas.length - 4} más (${formatearCanon(filas.slice(4).reduce((a, f) => a + f.monto, 0), "money")})` : "";
  const formula = `${total.value} = ${suma.label.toLowerCase()} de los ${filas.length} SKU con ${enPalabras}: ${partesFormula.join(" + ")}${masAlla}`;
  boleta.push(fig(`SKU con ${enPalabras} · ${suma.label} total`, total.value, {
    unit: "money", raw: total.raw, mandatory: true, source: "computed", formula, context: "suma con el umbral del usuario",
  }));
  const facts = {
    es_calculo: true, operacion: "suma_filtrada",
    criterio: { campo: filtro.enPalabras, operador: opKey, valor, en_palabras: enPalabras },
    campo_sumado: suma.label,
    filas: filas.map((f) => ({ entidad: f.entidad, monto: formatearCanon(f.monto, "money"), [filtro.campo === "rotacion" ? "rotacion" : "dias"]: formatearCanon(f.criterio, filtro.u) })),
    total: { value: total.value, formula },
    formula,
    nota_criterio: "el total vale SOLO bajo ese criterio: al citarlo, decláralo COMPLETO y con sus filas («" + total.value + " en los " + filas.length + " SKU con " + enPalabras + "») — nunca lo presentes como el total de otro criterio ni como el capital inmovilizado del motor",
    nota_formula: "la fórmula del total está declarada — si preguntan de dónde sale la cifra, citala tal cual",
  };
  return { facts, boleta, coverage: { supported: true, figCount: boleta.length } };
}
function calcular({ operacion, insumos, objetivo, umbral, scenario } = {}) {
  const _no = (reason) => ({ facts: null, boleta: [], coverage: { supported: false, reason } });
  const opNombre = String(operacion || "").trim();
  // suma_filtrada resuelve sus filas contra el dato (filtro + suma) — rama propia, ANTES del flujo de referencias
  // uno-a-uno: acá un insumo no es una cifra sino el CAMPO a sumar, y el umbral no es un operando sino el filtro.
  if (opNombre === "suma_filtrada") return _calcSumaFiltrada({ insumos, umbral, scenario, _no });
  const op = OPERACIONES_CALCULO[opNombre];
  // margen_objetivo azucarado: UN insumo {entidad} se expande a su venta + contribución (los dos montos que la
  // cuenta necesita), y `objetivo` es el tercer insumo (la tasa — del usuario con procedencia, o el benchmark).
  let specs = Array.isArray(insumos) ? [...insumos] : [];
  if (operacion === "margen_objetivo") {
    if (specs.length === 1 && specs[0] && specs[0].entidad != null && specs[0].metrica == null && specs[0].usuario == null) {
      const e = specs[0].entidad;
      specs = [{ entidad: e, metrica: "ventas" }, { entidad: e, metrica: "contribucion" }];
    }
    if (objetivo != null && specs.length < op.aridad) specs.push(objetivo);
  }
  if (specs.length > 4) return _no("máximo 4 cifras por cálculo — descompón la cuenta en pasos");
  const resueltos = [];
  for (const s of specs) {
    const r = _resolverInsumoCalc(s, scenario);
    if (!r.ok) return _no(r.razon);
    resueltos.push(r.insumo);
  }
  let res = op ? ejecutarCalculo(operacion, resueltos) : { ok: false, regla: "catalogo-cerrado" };
  let operacionEjecutada = opNombre;
  let insumosFinales = resueltos;
  /* ── RESCATE DETERMINÍSTICO ACOTADO (hallazgo 3 · E5, medido en vivo): la operación pedida no calza, pero los
   * args nombran UN monto del dato y UNA tasa del usuario (con su procedencia) — la única lectura inequívoca es
   * «aplicale ese % a ese monto» (variacion_aplicada), sellada como hipótesis igual que siempre (la tasa del
   * usuario dispara conCifraDeUsuario → ensureHypothesisFraming). El pool del rescate incluye `objetivo` (el
   * canal donde el plan medido dejó el «10%»), que NUNCA entra a la ejecución principal de otra operación — solo
   * al rescate: ejecutar una suma con un operando que el plan no articuló sería una cuenta inventada.
   * RED ANGOSTA: la tasa tiene que ser DEL USUARIO (una tasa del dato — margen, carga — NO se rescata: «venta ×
   * margen» disfrazado es justo lo que escalar cierra a propósito); un cruce de universos no se rescata
   * (honestidad dura); con más de un monto posible se declina PREGUNTANDO sobre cuál aplicar (el patrón
   * supuestos_faltantes: la razón ES la pregunta). Un pedido genuinamente ambiguo sigue declinando. */
  if (!res.ok && res.regla !== "universos-no-reconcilian" && operacion !== "margen_objetivo") {
    const pool = [...resueltos];
    if (objetivo != null) { const r = _resolverInsumoCalc(objetivo, scenario); if (r.ok) pool.push(r.insumo); }
    const montos = pool.filter((i) => i.unit === "money" && i.origen === "motor");
    const tasasUsuario = pool.filter((i) => i.unit === "pct" && i.origen === "usuario");
    if (montos.length === 1 && tasasUsuario.length === 1 && pool.length === 2) {
      const rescate = ejecutarCalculo("variacion_aplicada", [montos[0], tasasUsuario[0]]);
      if (rescate.ok) { res = rescate; operacionEjecutada = "variacion_aplicada"; insumosFinales = [montos[0], tasasUsuario[0]]; }
    } else if (montos.length > 1 && tasasUsuario.length === 1) {
      return _no("veo más de un monto posible para aplicar ese porcentaje — dime sobre cuál lo aplico");
    }
  }
  if (!res.ok) return _no(_razonCalcEnPalabras(res, opNombre, resueltos));
  const conCifraDeUsuario = insumosFinales.some((i) => i.origen === "usuario");
  // el SUJETO del cálculo: la entidad que los insumos del motor comparten (o "Cálculo" si no hay una sola).
  const entes = [...new Set(insumosFinales.filter((i) => i.origen === "motor").map((i) => String(i.label).split(" · ")[0]))];
  const sujeto = entes.length === 1 ? entes[0] : "Cálculo";
  const principal = res.resultados[res.resultados.length - 1];   // la última es la respuesta (faltante en margen_objetivo)
  const boleta = [];
  for (const i of insumosFinales) {
    boleta.push(i.origen === "usuario"
      ? fig(i.label, i.value, { unit: i.unit, raw: i.raw, sello: "indicado", verificabilidadRazon: `cifra aportada por el usuario (procedencia: ${i.procedencia}) — no es un dato del motor y no se puede verificar contra el dato`, context: `insumo del usuario para ${operacionEjecutada}: «${i.procedencia}»` })
      : fig(i.label, i.value, { unit: i.unit, raw: i.raw, source: "actual", context: `insumo de ${operacionEjecutada}` }));
  }
  for (const r of res.resultados) {
    boleta.push(fig(`${sujeto} · ${_CALC_ETIQ[r.clave] || r.clave}`, r.value, {
      unit: r.unit, raw: r.raw, mandatory: r === principal, source: "computed", formula: r.formula,
      context: conCifraDeUsuario ? `calculado por el motor sobre un supuesto del usuario (${operacionEjecutada})` : `calculado por el motor (${operacionEjecutada})`,
    }));
  }
  const facts = {
    es_calculo: true, operacion: operacionEjecutada,
    ...(operacionEjecutada !== opNombre ? { operacionPedida: opNombre, nota_rescate: "la operación pedida por el plan no calzaba con las cifras; el motor resolvió la única lectura inequívoca (aplicar el % del usuario al monto nombrado) — el supuesto sigue siendo del usuario" } : {}),
    insumos: insumosFinales.map((i) => ({ label: i.label, value: i.value, origen: i.origen, ...(i.procedencia ? { procedencia: i.procedencia } : {}) })),
    resultados: Object.fromEntries(res.resultados.map((r) => [r.clave, { value: r.value, formula: r.formula }])),
    formula: principal.formula,
    conCifraDeUsuario,
    nota_formula: "la fórmula de cada resultado está declarada — si preguntan de dónde sale la cifra, citala tal cual",
    ...(conCifraDeUsuario ? { marco_hipotesis: "una de las cifras la aportó el usuario: el resultado es una PROYECCIÓN sobre ese supuesto, no un dato medido — narralo como hipótesis, con la procedencia declarada" } : {}),
  };
  return { facts, boleta, coverage: { supported: true, figCount: boleta.length } };
}

// defineConcept · definición AUTORIZADA de un concepto del negocio (del glosario curado). Antídoto al "inventa algo":
// la definición NO la improvisa el LLM, viene del dato. Devuelve texto (sin cifras). El narrador la dice en su voz
// SIN cambiar el significado (ver narratePromptC). `concept` = el término o la frase del usuario.
// COBERTURA DE ETIQUETAS DE PANTALLA (owner 2026-08-09, decisión 10 · hallazgo K): la resolución ya no es
// "slug exacto o expresión regular" —30 de 39 etiquetas visibles declinaban con eso, incluidas las dos que el
// owner renombró—, sino la escalera completa de `resolveGlossary`: slug → etiqueta declarada (índice DERIVADO del
// manifiesto de vistas y del registro de métricas) → frase libre → null honesto. Lo que no tiene entrada sigue
// declinando: el defecto que se cierra acá es el inverso —contestar la definición de OTRO concepto—, y por eso
// "margen bruto" y "margen de contribución" ahora resuelven a dos entradas distintas.
// LA ESCALERA DE RESOLUCIÓN (owner 2026-08-13, caso real medido en prod: el PLAN emitió `bajo_benchmark` —un token
// interno con guion bajo— y resolveGlossary lo declinaba, mientras «bajo benchmark» y la frase textual del usuario
// SÍ resolvían). La doctrina del PLAN pide "el concepto tal como lo nombra el usuario"; el modelo a veces desobedece
// y normaliza. El motor tolera esa desobediencia en vez de perder una definición que existe. En orden, parando en el
// primer hit — y el orden importa:
//   (a) el concept del plan tal cual (como siempre);
//   (b) el concept con "_"→" " — el token interno leído como palabras («bajo_benchmark» → «bajo benchmark»);
//   (c) la frase literal del usuario (`_preguntaUsuario`, la inyecta runPlan SOLO para esta tool). Va ÚLTIMA a
//       propósito: una frase entera pasa por CONCEPT_MATCHERS (regex por orden), y si nombra DOS conceptos («qué es
//       la carga y el rebate») resuelve al primero por orden de matcher, no necesariamente al que el usuario quiso —
//       el concept del plan, aunque venga sucio, es la señal más específica y por eso gana;
//   (d) null → declina HONESTO, como siempre: un concepto sin entrada curada sigue declinando — inventar es el
//       defecto que el glosario existe para cerrar, así que acá no hay fuzzy matching ni fallback al LLM.
function defineConcept({ concept, _preguntaUsuario } = {}) {
  const term = String(concept || "");
  const enPalabras = term.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  const pregunta = String(_preguntaUsuario || "").trim();
  const d = resolveGlossary(term)
    || (enPalabras && enPalabras !== term ? resolveGlossary(enPalabras) : null)
    || (pregunta ? resolveGlossary(pregunta) : null);
  // LA EXCUSA CITA PALABRAS DEL USUARIO, NUNCA EL TOKEN. Este reason sale a pantalla VERBATIM por
  // composeNoDataMessage (narrationBlocks.js): con el token crudo, el usuario leyó «'bajo_benchmark'» — código.
  // Regla dura y verificable por gate: el reason JAMÁS contiene un identificador con guion bajo (/\w_\w/). Se cita
  // el término ya des-tokenizado; si el plan no trajo concepto, la frase del usuario (también des-tokenizada, por
  // si el usuario mismo escribió el token); y si no hay ninguna de las dos, un genérico sin identificadores.
  if (!d) {
    const citado = enPalabras || pregunta.replace(/_/g, " ").replace(/\s+/g, " ").trim() || "ese concepto";
    return { facts: null, boleta: [], coverage: { supported: false, reason: `no tengo una definición curada para «${citado}»` } };
  }
  return {
    facts: { concepto: d.aka, definicion: d.def, ...(d.distingue ? { distingue: d.distingue } : {}), es_definicion: true },
    boleta: [], coverage: { supported: true, fuente: d.fuente },
  };
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

function trend({ metric = "ventas", dimension = null, entity = null, period = null, periodo = null, scenario } = {}) {
  // SENTRIX ES LA EVIDENCIA (owner 2026-07-28): aunque la tool DECLINE (esa métrica no tiene mensual), si ya sabemos
  // de qué entidad/eje se hablaba, el panel debe poder abrir SU cuadro — no quedarse sin nada. dimension explícito
  // gana; si solo vino `entity`, lo inferimos (trend no exige dimension cuando hay entity).
  const dimGuess = dimension || (entity ? guessDimension(entity) : null);
  const _evScope = { ...(dimGuess ? { entityType: dimGuess, dimension: dimGuess, lens: "cuadro" } : {}), ...(entity ? { entidad: entity } : {}) };
  const praw = period == null ? "" : String(period);
  if (_FUTURO.test(praw))
    return { facts: { limite_temporal: _FUTURO_TXT, ..._evScope }, boleta: [], coverage: { supported: false, reason: _FUTURO_TXT, alternativas: ["la venta mes a mes hasta el cierre", "el ritmo de crecimiento del año"] } };
  const p = periodo || (praw ? detectPeriodo(praw) : null);
  const r = composeSpecTemporal({ metric, dimension, entity, periodo: p, scenario });
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

  const g = buildGlobalEvolutionAnclada(scenario) || buildGlobalEvolution();
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
  entityComposicion, entityCapitalLigado, clientesPorSku, pnlRead, calcular,
};

// toolNames() → los nombres registrados (base del catálogo que verá el LLM en la Pasada 1 · Fase 3).
export function toolNames() {
  return Object.keys(TOOLS);
}
