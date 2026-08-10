/* === src/adi/oracle/sentrixEvidence.js · ARQUITECTURA C · SENTRIX ES LA EVIDENCIA (owner 2026-07-28) ===
 * "Lo que debes conectar es lo que dice ADI con lo que muestra Sentrix... de esa forma ADI explica y Sentrix
 * muestra la evidencia." Hoy answerViaOracle devolvía un evidence MÍNIMO {boleta,oracle,intent,scope,plan} → el
 * panel de Sentrix NUNCA se movía con las respuestas de C (quedaba en lo que mostraba el turno anterior o en blanco).
 *
 * El arreglo es CONECTAR, no reconstruir: cada composeSpec* que envuelve toolRegistry YA emite un `evidence`
 * panel-ready (lens/margin/ventas/contribucion/inventory/findings/pairs/tablaM…) — es el MISMO objeto que usa el
 * pipeline determinístico, y `_pack()` ya lo guarda en `facts` (para que el LLM razone). Acá se FUSIONA eso mismo
 * para el cliente (aditivo, cero cambio de lo que ve el narrador) y, si el turno resolvió una entidad cliente/SKU,
 * se agrega la LECTURA premium (hero + evolutivo) con el MISMO signal-builder que usa "cómo está Falabella" en el
 * pipeline viejo — ese `reading` NUNCA se expone al narrador (vive solo en el evidence de salida): agregar más
 * números a la vista del LLM aumentaría el riesgo de una cifra no-autorizada; el panel no necesita pasar por el guard.
 */
import { buildReadingFromSignals, buildSkuMarginSignals, buildClientContribSignals } from "../sentrix/reading.js";
import { benchmarkOf, getBenchmarkOverride } from "../../config/businessPolicy.js";
import { rawRecordFor, guessDimension, fieldLabel } from "./entityRecord.js";
import { datasetCapability, temporalCapability, entityExplorable } from "../sentrix/capability.js";
import { buildMarginReceipt, buildCapitalReceipt } from "../sentrix/kpis.js";
import { buildMesaEstado, buildAccionFrom } from "../sentrix/mesa.js";
import { addressFromEvidence, formatAddress } from "../sentrix/address.js";   // dirección canónica ADI↔Sentrix (owner 2026-08-09) · puro, sin UI
import { PERIODO_MIXTO_ETIQUETA } from "../../config/contract/figureType.js";   // la etiqueta corta del marco mixto (decisión 5)

// _mergeFacts(results) → un solo objeto con los facts panel-ready de TODAS las calls del plan (last-wins en claves
// repetidas — normalmente no colisionan, cada tool aporta las suyas). defineConcept no aporta nada visual; no rompe nada.
function _mergeFacts(results) {
  let out = {};
  for (const r of results || []) {
    if (r && r.facts && typeof r.facts === "object") out = { ...out, ...r.facts };
  }
  return out;
}

// _entityReading(results, scenario) → la lectura premium de UNA entidad (hero+evolutivo), SOLO si algún call resolvió
// una entidad de eje cliente/SKU (entityProfile/entityRecord dejan `entidad`+`entityType` en sus facts) y existe el
// signal-builder para ese eje (marca/familia/bodega no tienen aún un "dive" general → sin reading, no peor que hoy).
function _entityReading(results, scenario) {
  for (const r of results || []) {
    const f = r && r.facts;
    if (!f || !f.entidad || !f.entityType) continue;
    if (f.entityType === "sku") {
      const s = buildSkuMarginSignals(f.entidad);
      const rd = s && buildReadingFromSignals(s);
      if (rd) return rd;
    }
    if (f.entityType === "cliente" || f.entityType === "client") {
      const s = buildClientContribSignals(f.entidad, scenario);
      const rd = s && buildReadingFromSignals(s);
      if (rd) return rd;
    }
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * evidenceSpec (owner 2026-07-31, "ADI asesora; Sentrix demuestra") — vista DETERMINÍSTICA y ADITIVA sobre este
 * mismo `evidence`, NUNCA una tercera fuente de verdad: cada campo deriva EXCLUSIVAMENTE de {plan, results, figs,
 * scenario} (los mismos 4 argumentos de buildOracleEvidence) — jamás de `narration` (prohibido parsear prosa: la
 * regla madre es que Sentrix muestre la MISMA boleta/benchmark/periodo/alcance/política que autorizó la respuesta,
 * no que la re-derive). Todo campo es INDEPENDIENTEMENTE NULLABLE: su ausencia es una señal honesta ("este turno
 * no tuvo con qué calcularlo"), nunca se rellena con un valor adivinado. Puro · sin I/O propio (los importes que
 * toca — businessPolicy/capability/kpis/mesa — son ellos mismos puros/client-side, mismo criterio que el resto del
 * oráculo). El shape exacto (todos los campos reales) queda documentado en el reporte de esta construcción, para
 * que el agente de "vistas adaptativas" lo consuma sin adivinar.
 * ══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

// ── turnId · hash determinístico de {intent, mode, calls, scope, scenario, canon de figs} (FNV-1a 32-bit) — NO un
// contador de turno (buildOracleEvidence no recibe ninguno de los 4 args fijos): mismo plan+figs+scenario → mismo
// turnId, siempre (misma garantía de pureza byte-exacta que ya exige ledger.js/toolRunner.js). Sirve para que un
// consumidor (ej. "vistas adaptativas") deduplique/cachee sin depender de un reloj ni de un contador externo.
// EXPORTADA (owner 2026-08-09, Contrato de Concordancia ADI↔Sentrix): viewContext.js:viewContextKey hashea la
// identidad del contexto de pantalla con ESTA MISMA función — un solo hash en el repo, nunca dos que puedan
// divergir. El alias privado se conserva para no tocar los usos internos de este archivo.
export function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}
const _fnv1a = fnv1a;
function _turnId(plan, figs, scenario) {
  const seed = JSON.stringify({
    intent: (plan && plan.intent) || null,
    mode: (plan && plan.mode) || null,
    calls: (plan && Array.isArray(plan.calls)) ? plan.calls.map((c) => c && c.tool) : [],
    scope: (plan && plan.scope) || null,
    scenario: scenario || null,
    canon: (figs || []).map((f) => f && f.canon),
  });
  return `t_${_fnv1a(seed)}`;
}

// ── claim · {text, type} — type deriva de plan.mode (el MISMO enum de MODE_KEYS/conversationalContract.js, una
// sola verdad, nunca un campo nuevo que el LLM deba emitir); text usa plan.rationale ("en una frase, por qué este
// plan" — planPrompt.js: es dato de la Pasada 1/PLAN, NUNCA la prosa narrada de la Pasada 2) con un fallback
// estructural (scope+intent) cuando el plan no trae rationale. null si no hubo plan (turnos bypass: aceptación
// huérfana, retorno ambiguo, supuestos_faltantes — ver answerViaOracle.js `_composedBypassResult`).
function _claimText(plan, scopeInfo) {
  if (plan && typeof plan.rationale === "string" && plan.rationale.trim()) return plan.rationale.trim();
  const who = scopeInfo.entityLabel ? `sobre ${scopeInfo.entityLabel}` : "de alcance global";
  return `Consulta ${who} (${(plan && plan.intent) || "answer"}).`;
}
function _claimSpec(plan, scopeInfo) {
  if (!plan) return null;
  return { text: _claimText(plan, scopeInfo), type: plan.mode || null };
}

// ── scope · {entityType, entityLabel, dimension} — de plan.scope (level="entity"|"global" · entities[], el MISMO
// contrato que planPrompt.js ya le exige al LLM). `dimension` preferí el eje REAL que usaron las calls
// (args.dimension — lo que el motor efectivamente corrió) sobre guessDimension (que solo adivina del nombre) —
// ambos deberían coincidir siempre que el plan esté bien formado; si no hay ninguno, null (honesto).
// FALLBACK a `args.filters` (planPrompt.js: "el inventario de la bodega Santiago" → inventoryStatus con
// filters:{bodega:"Santiago"}, SIN `dimension` — bodega/marca/familia/cliente viajan como filtro, no como eje
// nombrado, en varias tools) — sin esto, un turno de bodega SIEMPRE resolvía dimension=null (guessDimension no
// cubre el eje bodega) y formula/reference/sources quedaban muertos para ese caso, real y frecuente.
const _FILTER_AXES = ["bodega", "marca", "familia", "cliente"];
function _dimensionFromCalls(calls) {
  const arr = Array.isArray(calls) ? calls : [];
  const withDim = arr.find((x) => x && x.args && x.args.dimension);
  if (withDim) return withDim.args.dimension;
  for (const c of arr) {
    const filters = c && c.args && c.args.filters;
    if (!filters || typeof filters !== "object") continue;
    const axis = _FILTER_AXES.find((k) => filters[k] != null);
    if (axis) return axis;
  }
  return null;
}
// _dimensionFromResults(results) → el eje REAL que una call devolvió en `facts.entityType`/`facts.dimension`
// (POST-ejecución, después de que el motor se autocorrija — "Sodimac es cliente, no marca", mecanismo ya
// documentado en entityProfile/entityRecord de toolRegistry.js) — se PREFIERE sobre `args.dimension`
// (pre-ejecución, lo que el LLM adivinó ANTES de correr) para una entidad puntual (integridad #1-quinquies,
// auditoría adversarial 2026-07-31, CONFIRMADO en vivo: "¿Cuál es el margen de Mercado Libre?" → el plan pidió
// dimension:"marca", el motor se autocorrigió a "cliente" (correcto, ASÍ narró ADI) pero evidenceSpec.scope se
// quedaba con "marca" —el argumento viejo, sin corregir— → rawRecordFor("marca","Mercado Libre") fallaba →
// reference:null, un falso "sin referencia" para un turno que SÍ tenía una vara real y correcta).
function _dimensionFromResults(results) {
  for (const r of results || []) {
    const f = r && r.facts;
    if (!f) continue;
    if (typeof f.entityType === "string" && f.entityType) return f.entityType;
    if (typeof f.dimension === "string" && f.dimension) return f.dimension;
  }
  return null;
}
function _scopeSpec(plan, calls, results) {
  const scope = plan && plan.scope;
  if (!scope) return { entityType: null, entityLabel: null, dimension: null };
  if (scope.level === "global") return { entityType: "cartera", entityLabel: null, dimension: null };
  const entities = Array.isArray(scope.entities) ? scope.entities.filter(Boolean) : [];
  if (!entities.length) return { entityType: null, entityLabel: null, dimension: null };
  const single = entities.length === 1 ? entities[0] : null;
  const dimension = (single && _dimensionFromResults(results)) || _dimensionFromCalls(calls) || (single ? guessDimension(single) : null) || null;
  return { entityType: dimension, entityLabel: entities.join(", "), dimension };
}

// ── periodHuman · el MISMO string que toolRunner.js (_stampPeriodo) ya estampa en facts.periodo/marco_temporal.periodo
// (año cerrado / foto de inventario a hoy / lo que trend declare) — clave NUEVA acá porque `evidence.periodo` YA está
// ocupada por el id del escenario (ver el `periodo: scenario` de abajo, no se toca). Se toma la PRIMERA call que lo
// trajo (normalmente todas las calls de un turno comparten familia de período; si difieren, el guard/ensurePeriodoDeclared
// ya declara ambas en la narración — acá alcanza con la primera para el propósito de evidenceSpec).
function _periodHuman(results) {
  for (const r of results || []) {
    const f = r && r.facts;
    if (!f) continue;
    // MARCO MIXTO (owner 2026-08-09, decisión 5): desde que el período sale de la naturaleza de cada cifra, un
    // resultado puede declarar los DOS marcos, y su `facts.periodo` es una frase larga escrita para INSTRUIR al
    // narrador. Acá la evidencia MUESTRA el marco: va la etiqueta corta, no el párrafo.
    if (Array.isArray(f.periodos) && f.periodos.length > 1) return PERIODO_MIXTO_ETIQUETA;
    if (typeof f.periodo === "string" && f.periodo) return f.periodo;
    if (f.marco_temporal && typeof f.marco_temporal.periodo === "string" && f.marco_temporal.periodo) return f.marco_temporal.periodo;
  }
  return null;
}

// ── reference · {value, source, rememberedFrom} — LA CIFRA de referencia (benchmark) que autorizó el juicio del
// turno, vía businessPolicy.benchmarkOf() — el MISMO punto único que ya respeta `_benchmarkOverride` (el mecanismo
// real de "memoria de criterio" del owner, C.2). Esto es exactamente lo que kpis.js NO hace hoy (hallazgo de
// integridad #1: lee `cm.benchmark`/`sku.benchmark` crudo) — evidenceSpec.reference es la fuente CORRECTA para que
// un consumidor (Sentrix/vistas adaptativas) muestre la MISMA vara que autorizó la respuesta de ADI, sin
// recalcular. Acotado a los ejes que tienen benchmark de margen en el dato (cliente/sku/marca/familia) — bodega
// no tiene ese concepto (capital/rotación en su lugar), no se fuerza un valor sin sentido ahí.
const _MARGIN_DIMS = new Set(["cliente", "sku", "marca", "familia"]);
function _referenceSpec(scopeInfo) {
  const { entityType, entityLabel } = scopeInfo;
  const isGlobal = entityType === "cartera";
  if (!isGlobal && (!entityType || !entityLabel || entityLabel.includes(",") || !_MARGIN_DIMS.has(entityType))) return null;
  let rec = null;
  if (!isGlobal) {
    try { rec = rawRecordFor(entityType, entityLabel); } catch { rec = null; }
    if (!rec) return null;   // entidad no reconocida en el dato → no se fuerza nada (honesto)
  }
  let value = null;
  try { value = benchmarkOf(rec); } catch { value = null; }
  if (typeof value !== "number" || !isFinite(value)) return null;
  const overrideActive = getBenchmarkOverride() != null;
  const source = overrideActive ? "criterio_usuario" : (rec && typeof rec.benchmark === "number") ? "benchmark_fila" : "benchmark_cartera";
  const rememberedFrom = overrideActive ? "memoria de criterio del usuario (override activo en businessPolicy · C.2)" : null;
  return { value, source, rememberedFrom };
}

// ── sources · {availability, confianza} — capability.js EXPUESTO por primera vez acá (hoy solo conectado a la ruta
// legacy, buildSentrixBoleta). Reuso VERBATIM lo que capability.js ya calcula (cero shape nuevo, cero duplicar la
// lógica data-driven de disponibilidad): entityExplorable()/temporalCapability() para una entidad puntual resuelta,
// datasetCapability()/temporalCapability({}) para alcance global o multi-entidad.
// _CAP_DIM · capability.js (heredado del pipeline LEGACY de Sentrix — kpis.js/capability.js) nombra el eje cliente
// "client" (inglés); el resto del oráculo (entityRecord.js/toolRegistry.js/guessDimension, de donde sale
// `scopeInfo.entityType` acá arriba) lo nombra "cliente" (español) — DOS convenciones reales en este código, no un
// typo. Sin traducir, entityExplorable("cliente", …) no matchea ningún branch de capability.js y devuelve
// listas vacías (silencioso, sin error) — se traduce SOLO en el borde de esta llamada; evidenceSpec.scope se queda
// en la convención del oráculo (no se homogeniza el resto del código, fuera de alcance de esta ronda).
const _CAP_DIM = { cliente: "client" };
function _sourcesSpec(scopeInfo) {
  const { entityType, entityLabel } = scopeInfo;
  try {
    if (entityType && entityType !== "cartera" && entityLabel && !entityLabel.includes(",")) {
      const capType = _CAP_DIM[entityType] || entityType;
      const availability = entityExplorable(capType, entityLabel);
      const temp = temporalCapability({ entityType: capType, entity: entityLabel, metric: null });
      return { availability, confianza: temp.perEntity || temp.global || null };
    }
    const availability = datasetCapability();
    const temp = temporalCapability({});
    return { availability, confianza: temp.global || null };
  } catch { return null; }
}

// ── grade · "probado" | "indicado" | "abierto" | null — heurística DETERMINÍSTICA (jamás un campo que el LLM
// emita), documentada acá EXACTO (el owner puede querer ajustarla, pero tiene que ser predecible):
//   1. sin plan (turno bypass) → null (no hay claim que graduar).
//   2. mode="clarify", o cero figs autorizadas este turno → "abierto" (no hay con qué respaldar la afirmación).
//   3. `unsupported` (coverage de alguna call del plan) no vacío → "abierto" — CONSERVADOR a propósito: hoy no
//      distinguimos si el faltante toca la métrica CENTRAL o una call auxiliar del mismo plan; ante la duda, se
//      declara abierto antes que probado de más (ver nota para el integrador en el reporte de este turno).
//   4. mode="simulacion" O alguna call del plan usó una tool simulate* → "indicado" (supuesto, nunca hecho
//      consumado — mismo principio que guardC._graduationViolation). El chequeo por TOOL (no solo por `mode`) es
//      owner 2026-07-31, CONFIRMADO en vivo con LLM real (integrador, verificación de conversación larga): un
//      turno de simulación genuino ("si subo el precio a Lider un 8%...") llegó con plan.mode="default" (el LLM
//      no siempre elige mode="simulacion" aunque el propio plan.intent lo diga y llame simulateGeneral) — sin
//      este chequeo adicional, grade daba "probado" para un SUPUESTO, exactamente la sobre-confianza que la
//      auditoría adversarial (hallazgo de grade) ya había cazado por otra vía. El nombre de la tool es la señal
//      determinística de código, no depende de que el LLM clasifique bien el modo conversacional.
//   5. scope global (0 entidades nombradas) → "probado" si hay al menos una fig con source="actual" (no hay una
//      entidad puntual central que exigir). Scope con 1+ entidades nombradas (incluida una comparación) → "probado"
//      exige que CADA entidad nombrada tenga SU PROPIA fig source="actual" — no basta con que UNA de las dos
//      entidades de una comparación tenga dato real (integridad #1-ter, auditoría adversarial 2026-07-31,
//      CONFIRMADO en vivo: "Compara el margen de Falabella contra el de Comercial Fantasma SPA" —inexistente—
//      daba grade:"probado" porque `central=null` con 2 entidades hacía que CUALQUIER fig "actual" alcanzara,
//      aunque fuera solo de Falabella; ADI narró honestamente que a la segunda le faltaba dato, pero evidenceSpec
//      certificaba la comparación completa como probada).
//   6. cualquier otro caso con figs presentes (falta la fig "actual" de alguna entidad nombrada) → "indicado".
function _computeGrade(plan, figs, unsupported) {
  if (!plan) return null;
  if (plan.mode === "clarify") return "abierto";
  if (!Array.isArray(figs) || !figs.length) return "abierto";
  if (Array.isArray(unsupported) && unsupported.length) return "abierto";
  const calls = Array.isArray(plan.calls) ? plan.calls : [];
  const isSimCall = calls.some((c) => c && typeof c.tool === "string" && c.tool.toLowerCase().startsWith("simulate"));
  if (plan.mode === "simulacion" || isSimCall) return "indicado";
  const entities = plan.scope && Array.isArray(plan.scope.entities) ? plan.scope.entities.filter(Boolean) : [];
  const hasActualCentral = entities.length
    ? entities.every((ent) => figs.some((f) => f && f.source === "actual" && String(f.label || "").includes(ent)))
    : figs.some((f) => f && f.source === "actual");
  return hasActualCentral ? "probado" : "indicado";
}

// ── assumptions · [{variable, delta, unit}] | null — de `facts.assumptions` (toolRegistry.js/simulateGeneral, la
// ESTRUCTURACIÓN del mismo supuesto que hoy solo vive en prosa dentro de `fig.context`). `variable` usa el label
// humano de entityRecord.js (fieldLabel) cuando existe, si no el campo crudo tal cual.
function _assumptionsFrom(results) {
  const out = [];
  for (const r of results || []) {
    const a = r && r.facts && Array.isArray(r.facts.assumptions) ? r.facts.assumptions : null;
    if (!a) continue;
    for (const it of a) {
      if (!it || typeof it.delta !== "number") continue;
      out.push({ variable: fieldLabel(it.campo) || it.campo || null, delta: it.delta, unit: "pct" });
    }
  }
  return out.length ? out : null;
}

// ── formula · fig[] estructurada (label/usd/pct/sign/source/tone) — REUSA buildMarginReceipt/buildCapitalReceipt
// de kpis.js (mismo vocabulario `lines[]` que YA generaliza margen/cliente y capital/bodega, "UN componente los
// renderiza ambos" según su propio comentario) — SOLO `.lines` (la cascada venta−costo−carga=margen /
// capital=sano+inmovilizado), NUNCA `.comparison` (ese campo lee `cm.benchmark`/`sku.benchmark` CRUDO — el hallazgo
// de integridad #1 — evidenceSpec.reference ya cubre esa cifra correctamente vía benchmarkOf(), no se propaga el bug).
// ventas/contribución quedan SIN generalizar en esta ronda (no hay receipt builder hoy para esos ejes) — formula
// da null ahí, señal honesta, no un intento a medias.
const _FORMULA_BUILDERS = {
  cliente: (entity, scenario) => { const r = buildMarginReceipt(entity, scenario); return r ? r.lines : null; },
  bodega: (entity, scenario) => { const r = buildCapitalReceipt(entity, scenario); return r ? r.lines : null; },
};
function _formulaFrom(scopeInfo, scenario) {
  const { entityType, entityLabel } = scopeInfo;
  if (!entityType || !entityLabel || entityLabel.includes(",")) return null;
  const builder = _FORMULA_BUILDERS[entityType];
  if (!builder) return null;
  try { return builder(entityLabel, scenario) || null; } catch { return null; }
}

// ── _scopedFindings(results) → facts.findings de la PRIMERA call del plan que los trajo (diagnose filtrado por
// el plan, ej. {filters:{cliente:"Ripley"}}) — ya vienen acotados a lo que el plan efectivamente pidió, entidad
// puntual o portafolio según haya sido el filtro. Compartido por _factorsFrom y _actionFrom (misma fuente, nunca
// dos cuentas) — ver nota de integridad #1-bis en _actionFrom.
function _scopedFindings(results) {
  for (const r of results || []) {
    const f = r && r.facts && Array.isArray(r.facts.findings) ? r.facts.findings : null;
    if (f && f.length) return f;
  }
  return null;
}
// _isSingleEntityScope(scopeInfo) → true cuando el scope del plan nombra EXACTAMENTE una entidad (no global, no
// una comparación multi-entidad) — el gate que decide si es seguro caer al foco top del PORTAFOLIO completo
// (mesa.js) o si eso mezclaría el $ de una entidad ajena bajo el turno de esta.
function _isSingleEntityScope(scopeInfo) {
  return !!(scopeInfo && scopeInfo.entityLabel && !scopeInfo.entityLabel.includes(","));
}

// ── factors · de `facts.findings` (diagnose — detector/subtotal_usd/items, ya panel-ready) si el plan lo trajo; si
// no, y el turno es mode="decision" CON SCOPE GLOBAL/multi-entidad (nunca una entidad puntual sin findings propios
// — integridad #1-bis, ver _actionFrom), cae a `mesa.accion` (buildMesaEstado) como factor único — MISMA fuente
// que `action` de abajo, reusada tal cual (nunca una segunda cuenta).
function _factorsFrom(results, plan, scenario, scopeInfo) {
  const scoped = _scopedFindings(results);
  if (scoped) return scoped;
  if (plan && plan.mode === "decision" && !_isSingleEntityScope(scopeInfo)) {
    try {
      const m = buildMesaEstado(scenario);
      if (m && m.accion) return [{ detector: null, texto: m.accion.detalle || null, usdFmt: m.accion.usdFmt || null }];
    } catch { /* sin mesa → sin factors, honesto */ }
  }
  return null;
}

// ── action · {text, askLabel, impact} | null — cuando el turno es mode="decision". INTEGRIDAD #1-bis (auditoría
// adversarial 2026-07-31, CONFIRMADO en vivo): la versión original llamaba buildMesaEstado(scenario) —el foco TOP
// DE TODO EL PORTAFOLIO— sin mirar el scope del plan. Pregunta sobre Ripley → factors correctos de Ripley, pero
// action = "Recuperar el margen que cede Falabella" ($4.9M) — una entidad y cifra AJENAS, mismo evidenceSpec,
// mismo turno. Fix: cuando el scope nombra UNA entidad puntual, la acción sale de buildAccionFrom() (mesa.js,
// factorizada) sobre el foco top de LOS FINDINGS DE ESA ENTIDAD (results[].facts.findings — MISMA fuente que
// _factorsFrom, la que ya prueba que el plan filtró correctamente) — nunca del portafolio completo. Si esta
// entidad no trajo findings propios (el plan no corrió diagnose filtrado), sin acción — honesto, nunca la ajena.
// Solo cuando el scope es GLOBAL/multi-entidad (sin una entidad puntual que podamos mezclar) cae al foco top del
// portafolio, que es exactamente lo que ese caso pide.
function _actionFrom(plan, scenario, results, scopeInfo) {
  if (!plan || plan.mode !== "decision") return null;
  if (_isSingleEntityScope(scopeInfo)) {
    const scoped = _scopedFindings(results);
    if (!scoped || !scoped.length) return null;   // sin foco propio de ESTA entidad → sin acción, nunca la ajena
    const built = buildAccionFrom(scoped[0]);
    if (!built) return null;
    return { text: built.titulo || null, askLabel: built.askLabel || null, impact: built.usdFmt || null };
  }
  try {
    const m = buildMesaEstado(scenario);
    const a = m && m.accion;
    if (!a) return null;
    return { text: a.titulo || null, askLabel: a.askLabel || null, impact: a.usdFmt || null };
  } catch { return null; }
}

// buildEvidenceSpec({ plan, results, figs, scenario, unsupported }) → el evidenceSpec de ESTE turno (o null si no
// hubo plan — turnos bypass). Ver el bloque de comentario grande arriba para el contrato completo.
function buildEvidenceSpec({ plan, results, figs, scenario, unsupported }) {
  if (!plan) return null;
  const calls = Array.isArray(plan.calls) ? plan.calls : [];
  const scopeInfo = _scopeSpec(plan, calls, results);
  return {
    version: 1,
    turnId: _turnId(plan, figs, scenario),
    claim: _claimSpec(plan, scopeInfo),
    periodHuman: _periodHuman(results),
    scope: scopeInfo,
    metrics: figs,                                    // = evidence.boleta, MISMA referencia (no una copia)
    formula: _formulaFrom(scopeInfo, scenario),
    reference: _referenceSpec(scopeInfo),
    factors: _factorsFrom(results, plan, scenario, scopeInfo),
    action: _actionFrom(plan, scenario, results, scopeInfo),
    assumptions: _assumptionsFrom(results),
    grade: _computeGrade(plan, figs, unsupported),
    missing: Array.isArray(unsupported) ? unsupported : [],
    sources: _sourcesSpec(scopeInfo),
    traceability: (figs || []).map((f) => (f && f.origin) || null),
  };
}

// buildOracleEvidence({ plan, results, figs, scenario, unsupported }) → el evidence que ve el CLIENTE (Sentrix).
// Aditivo: conserva boleta/oracle/intent/scope/plan (compatibles con lo que ya devolvía el seam) + los facts
// panel-ready + la lectura + evidenceSpec (vista determinística adicional, ver el bloque de arriba). `unsupported`
// es OPCIONAL (default []) — compat con los callers existentes que aún no lo pasan (ej. el bypass de
// answerViaOracle.js con plan:null, donde de todos modos no hay plan → evidenceSpec sale null).
export function buildOracleEvidence({ plan, results, figs, scenario, unsupported = [] }) {
  const merged = _mergeFacts(results);
  const reading = _entityReading(results, scenario);
  const calls = Array.isArray(plan && plan.calls) ? plan.calls : [];
  // PERFIL ÚNICO (owner 2026-08-06): "perfil/avance/estado de X" → tool entityProfile (planPrompt.js lo documenta
  // exacto: "cómo viene el margen de Falabella" → entityProfile). Mismo marcador `_profileRequest` que el pipeline
  // legacy (answerADI.js/clientDive.js) — clientMesaLink (SentrixPanel.jsx) lo lee igual sin importar qué pipeline
  // respondió. Gated a `reading` truthy: sin lectura de contribución no hay Ficha que mostrar (mismo criterio que
  // el legacy).
  const isProfileRequest = reading && calls.some((c) => c && c.tool === "entityProfile");
  const spec = buildEvidenceSpec({ plan, results, figs, scenario, unsupported });
  // ── LA DIRECCIÓN CANÓNICA (owner 2026-08-09 · Contrato de Concordancia ADI ↔ Sentrix) ────────────────────────
  // `address` es el puntero —nunca un payload— a la pieza de Sentrix que DEMUESTRA lo que este turno afirma:
  // `sentrix://<vista>/<seccion>/<slug>?eje=…&entidad=…`. Se deriva de reglas determinísticas sobre el plan y el
  // evidenceSpec (nunca de la prosa de la respuesta) y la traducción tool→componente sale del propio manifiesto de
  // vistas, no de una tabla hardcodeada. Con ella, "Ver evidencia en Sentrix" abre la vista, la sección, la entidad
  // y el filtro EXACTOS; sin ella (tool sin componente declarado) el panel cae a su ruteo de siempre.
  const base = {
    ...merged,
    ...(reading ? { reading } : {}),
    ...(isProfileRequest ? { _profileRequest: true } : {}),
    boleta: figs,
    periodo: scenario,
    oracle: true,
    intent: (plan && plan.intent) || null,
    scope: (plan && plan.scope) || null,
    plan: { intent: (plan && plan.intent) || null, calls: calls.map((c) => c.tool) },
    evidenceSpec: spec,
  };
  let address = null;
  try { address = formatAddress(addressFromEvidence(base, { plan, scenario })); } catch { address = null; }
  if (address) {
    base.address = address;
    if (base.evidenceSpec) base.evidenceSpec = { ...base.evidenceSpec, address };
  }
  return base;
}
