/* === src/adi/oracle/conversationScope.js · ARQUITECTURA C · CONTINUIDAD CONVERSACIONAL UNIVERSAL — Etapa 1/3 ===
 * owner (pedido "continuidad conversacional universal", 2026-08-03): ADI debe recordar sobre qué se está
 * trabajando y resolver referencias naturales ("estos SKU", "esos clientes", "los dos peores", "haz lo mismo con
 * X") SIN volver a preguntar lo que ya sabe — transversal a cliente/SKU/marca/familia/bodega/canal/período/
 * ranking/comparación/diagnóstico/simulación, no un parche para un caso puntual.
 *
 * REGLA DURA DE FIDELIDAD (la más importante, nunca se relaja): toda resolución de referencia acá SOLO lee
 * ConversationScopeEntry.entities — que a su vez SOLO se deriva de `result.boleta` (resultado ESTRUCTURADO de una
 * tool-call, ver buildEntityList) — JAMÁS de `narration`/prosa del narrador. La prosa es para el humano, nunca la
 * fuente de verdad del estado (un LLM puede parafrasear/resumir de formas no parseables con seguridad).
 *
 * Funciones PURAS (sin LLM, sin I/O) — mismo patrón arquitectónico que dialogueState.js, orquestadas por
 * answerViaOracle.js. NO reemplaza dialogueState.js (mem.lastOffer/mem.recentSubjects siguen vivos, sin cambios de
 * comportamiento en Etapa 1 — ver el comentario "CONSOLIDACIÓN — QUÉ QUEDA PARA ETAPA 2/3" al final del archivo):
 * esto es la capa NUEVA, canónica, aditiva — construida para que Etapa 2 (contratos de tool + entityScope
 * multi-entidad) y Etapa 3 (scenarioIntent.js multi-eje + retiro de mem.pendingSimulation) tengan una base real
 * sobre la que pararse, sin tener que re-descubrir nada de lo de acá.
 *
 * ── ConversationScopeEntry ──────────────────────────────────────────────────────────────────────────────────────
 *   turno       number|null            = history.length del turno que lo estableció (misma convención que
 *                                         recentSubjects/lastOffer hoy)
 *   dimension   "cliente"|"sku"|"marca"|"familia"|"bodega"|"canal"|"cartera"|null
 *                                       "cartera" = plan.scope.level="global" explícito (negocio entero);
 *                                       null = aún no se estableció ningún eje en la conversación
 *   entities    string[]               0..N nombres CANÓNICOS, SIEMPRE de un resultado estructurado de ESTE turno
 *   selection   {orden,subset}|null    orden = el string YA SELLADO por la tool (facts.orden/ordenA/ordenB)
 *   periodo     string|null            el mismo string que toolRunner.js/trend ya producen
 *   filtros     object|null            mismo shape que args.filters de las tools
 *   metrica     string|null            best-effort (ver comentario en updateConversationScope) — NO autoridad
 *   operacion   string|null            = plan.intent de este turno
 *   modo        string|null            = plan.mode ya coercido
 *   tool        string|null            tool dominante del turno (calls[0].tool)
 *   origen      {callId, boletaLabels} trazabilidad mínima (nunca un puntero vivo a `results`)
 *   supuestos   array                  reservado — Etapa 3 (simulate multi-entidad) lo puebla
 *   faltantes   string[]               reservado — Etapa 3
 *   ofertaPendiente object|null        reservado — Etapa 2/3 (hoy sigue viviendo en mem.lastOffer)
 *   tenant      {tenantId,dataSnapshotId}|null   copiado AL ESCRIBIR, nunca recalculado
 *
 * mem.conversationScope = { version: 1, current: ConversationScopeEntry|null, history: ConversationScopeEntry[] }
 * (history: tope 3, más-reciente-primero, nunca incluye a `current`)
 */
import { guessDimension } from "./entityRecord.js";

const _AXES = new Set(["sku", "cliente", "marca", "familia"]);

export function emptyConversationScope() {
  return { version: 1, current: null, history: [] };
}

// ── buildEntityList(toolName, result) → {dimension, entities, orden} | null ────────────────────────────────────
// MECANISMO UNIVERSAL: los labels de boleta de las tools de lectura/diagnóstico/simulación siguen la convención
// "<entidad> · <label>" (verificado por lectura directa: simulateGeneral/toolRegistry.js "${entity} · Venta
// actual", entityRecord.js _formatRecord "${entity} · ${label}", specRetrieval.js composeSpecInventory
// "${s.sku} · Capital detenido"/composeSpecMargin lever "${row.nombre} · Medida cerrar brecha", entityRecord.js
// buildTension "${x.e} · ${m.l}"). Extrae el prefijo antes de " · " de cada fig de `result.boleta` (NUNCA de
// `result.facts` crudo — facts puede traer listas SIN el tope que la tool realmente autorizó a narrar, ej.
// facts.inventory.bySku es la lista COMPLETA sin cap mientras boleta trae solo el top-3/4 ya sellado — usar facts
// capturaría entidades que el narrador nunca nombró, rompiendo "los N EXACTOS" del caso obligatorio), dedupea
// preservando orden, y descarta cualquier candidato para el que guessDimension() devuelva null (filtra
// automáticamente labels que no son entidades reales: "Benchmark de margen", "Resto (3 de 8)", "Estado del
// inventario: …", "Medida · liberar X y Y" — ninguno de esos matchea un nombre real del dato).
//
// RESOLUCIÓN DE DIMENSIÓN (hallazgo empírico 2026-08-03, ver openRisks del diseño — "antes de confiar en este
// mecanismo universalmente, correr un chequeo determinístico contra varios composers"; se corrió contra
// inventoryStatus/marginRead/salesRead/contributionRead/diagnose/entityProfile/entityRecord/simulateCarga/
// simulateCapital/simulateGeneral/compareEntities/gridTable/tensionRead/queryMetric con datos reales del demo):
//   1. Si `facts.entityType` es un eje válido (sku/cliente/marca/familia) → se usa tal cual — es la declaración
//      EXPLÍCITA de la tool (entityRecord/entityProfile/gridTable/tensionRead/compareEntities YA lo estampan).
//   2. Si no, y la tool NO está en `_AMBIGUOUS_DIMENSION_TOOLS`, `facts.dimension` (si es un eje válido) — vale
//      para marginRead/salesRead/contributionRead/diagnose/simulateCarga/simulateGeneral/queryMetric: ahí
//      `dimension` SÍ describe el eje de las entidades nombradas en la boleta.
//   3. Si no (inventoryStatus: `facts.dimension` describe el eje de AGRUPACIÓN de la narrativa — "Por bodega:"/
//      "Por familia:" — NO el eje de las entidades puntuales, que casi siempre son SKU; confirmado en vivo: para
//      "capital inmovilizado" default, la boleta trae 2 familias ANTES que los 3 SKU reales) → fallback de
//      MAYORÍA entre los candidatos con dimensión válida, empate roto por el grupo que aparece MÁS TARDE en la
//      boleta (el detalle puntual —lo que casi siempre importa para "estos X"— tiende a listarse al final: total
//      → agregados por bodega/familia → detalle por entidad).
// LÍMITE CONOCIDO (no resuelto acá, documentado): `diagnose`/`executiveSummary` son estructuralmente
// MULTI-dimensión (comercial por cliente + capital por SKU en la MISMA boleta) — el fallback de mayoría no separa
// ambos grupos, elige uno. Generalizar diagnose a un contrato multi-eje es Etapa 2 (toolContracts.js), fuera de
// alcance acá; mientras tanto, una referencia tipo "esos SKU" después de un `diagnose` puede resolver mal si el
// diagnose trajo más entidades de cliente que de SKU. bodega/canal NUNCA resuelven (guessDimension no los cubre
// hoy, ver entityRecord.js — mismo límite que el resto del motor).
const _AMBIGUOUS_DIMENSION_TOOLS = new Set(["inventoryStatus"]);

export function buildEntityList(toolName, result) {
  if (!result || !Array.isArray(result.boleta) || !result.boleta.length) return null;
  const facts = (result.facts && typeof result.facts === "object") ? result.facts : {};
  const seen = new Set();
  const candidates = [];
  for (const f of result.boleta) {
    if (!f || typeof f.label !== "string") continue;
    const sepIdx = f.label.indexOf(" · ");
    const name = (sepIdx === -1 ? f.label : f.label.slice(0, sepIdx)).trim();
    if (!name || seen.has(name)) continue;
    const dim = guessDimension(name);
    if (!dim) continue;   // no es una entidad real del dato — descartado (Benchmark/Resto/Estado/Medida/…)
    seen.add(name);
    candidates.push({ name, dim });
  }
  if (!candidates.length) return null;

  let dimension = null;
  if (_AXES.has(facts.entityType)) dimension = facts.entityType;
  else if (!_AMBIGUOUS_DIMENSION_TOOLS.has(toolName) && _AXES.has(facts.dimension)) dimension = facts.dimension;
  if (!dimension) {
    const counts = new Map(), lastIdx = new Map();
    candidates.forEach((c, i) => { counts.set(c.dim, (counts.get(c.dim) || 0) + 1); lastIdx.set(c.dim, i); });
    let best = null;
    for (const [dim, count] of counts) {
      if (!best || count > best.count || (count === best.count && lastIdx.get(dim) > lastIdx.get(best.dim))) best = { dim, count };
    }
    dimension = best.dim;
  }

  const entities = candidates.filter((c) => c.dim === dimension).map((c) => c.name);
  if (!entities.length) return null;
  const orden = facts.orden || facts.ordenA || facts.ordenB || null;
  return { dimension, entities, orden };
}

// ── updateConversationScope(scopePrev, {plan, calls, results, turno, requestContext}) → {version,current,history}
// Corre en el MISMO punto donde hoy corre updateRecentSubjects (dialogueState.js), después de runPlan.
export function updateConversationScope(scopePrev, { plan, calls, results, turno, requestContext } = {}) {
  const prev = (scopePrev && typeof scopePrev === "object") ? scopePrev : emptyConversationScope();
  const history = Array.isArray(prev.history) ? prev.history.slice(0, 3) : [];
  const tenant = (requestContext && requestContext.tenantId)
    ? { tenantId: requestContext.tenantId, dataSnapshotId: requestContext.dataSnapshotId || null }
    : (prev.current && prev.current.tenant) || null;

  // CAMBIO REAL DE TEMA — disparador ÚNICO (a propósito, para no inventar un segundo clasificador difuso):
  // plan.scope.level==="global" es la señal EXPLÍCITA que PLAN ya emite por doctrina existente (planPrompt.js,
  // "REGLA DE ALCANCE" — sin tocar el prompt) cuando el usuario dice "el negocio"/"en general"/"la cartera". Es el
  // ÚNICO punto donde `current` se retira a `history`; en cualquier otro turno `current` simplemente se
  // sobrescribe (mismo comportamiento LRU que recentSubjects ya tiene hoy).
  if (plan && plan.scope && plan.scope.level === "global") {
    const nextHistory = prev.current ? [prev.current, ...history].slice(0, 3) : history;
    const cartera = {
      turno: turno == null ? null : turno, dimension: "cartera", entities: [],
      selection: null, periodo: null, filtros: null, metrica: null,
      operacion: (plan && plan.intent) || null, modo: (plan && plan.mode) || null,
      tool: (Array.isArray(calls) && calls[0] && calls[0].tool) || null,
      origen: { callId: null, boletaLabels: [] },
      supuestos: [], faltantes: [], ofertaPendiente: null, tenant,
    };
    return { version: 1, current: cartera, history: nextHistory };
  }

  const arr = Array.isArray(results) ? results : [];
  let built = null, builtFrom = null;
  for (const r of arr) {
    const b = buildEntityList(r && r.tool, r);
    if (b && b.entities.length) { built = b; builtFrom = r; break; }   // primer resultado con entidades reales
  }
  const planEntities = (plan && plan.scope && Array.isArray(plan.scope.entities)) ? plan.scope.entities.filter(Boolean) : [];
  const entities = built ? built.entities : planEntities.filter((e) => guessDimension(e));
  // sin entidades nuevas que nombrar (declinó / respuesta agregada sin entidad puntual / intent=define-ack) → NO
  // pisa el scope anterior con uno vacío — conserva `current`/`history` tal cual (mismo criterio que "mejor nada
  // que un pendiente roto" en dialogueState.js: perder memoria por una consulta que no trajo nada nuevo sería peor
  // que simplemente no actualizar).
  if (!entities.length) return { version: 1, current: prev.current || null, history };

  const dimension = built ? built.dimension : guessDimension(entities[0]);
  const dominant = Array.isArray(calls) && calls[0];
  const periodoHallado = arr.map((r) => r && r.facts && r.facts.periodo).find(Boolean) || null;
  const ordenHallado = (built && built.orden) || null;
  const filtrosDominante = (dominant && dominant.args && dominant.args.filters && typeof dominant.args.filters === "object" && !Array.isArray(dominant.args.filters)) ? dominant.args.filters : null;
  // metrica: best-effort (token del vocabulario compartido, cuando la call lo declara explícito) — NUNCA autoridad
  // para el resolver de referencias (que solo lee dimension/entities/selection); solo trazabilidad para consumo
  // futuro (Etapa 2/3, ej. reconstruir un pendingSimulation con la métrica ya conocida).
  const metricaDominante = (dominant && dominant.args && (dominant.args.metric || dominant.args.metricA || dominant.args.sortBy)) || null;

  const current = {
    turno: turno == null ? null : turno,
    dimension: dimension || null,
    entities,
    selection: ordenHallado ? { orden: ordenHallado, subset: { kind: "top", n: entities.length || null } } : null,
    periodo: periodoHallado,
    filtros: filtrosDominante,
    metrica: metricaDominante,
    operacion: (plan && plan.intent) || null,
    modo: (plan && plan.mode) || null,
    tool: (dominant && dominant.tool) || null,
    origen: {
      callId: (builtFrom && builtFrom.callId) || (arr[0] && arr[0].callId) || null,
      boletaLabels: (builtFrom && Array.isArray(builtFrom.boleta)) ? builtFrom.boleta.slice(0, 8).map((f) => f.label) : [],
    },
    supuestos: [],
    faltantes: [],
    ofertaPendiente: null,
    tenant,
  };
  return { version: 1, current, history };
}

// ── validateScopeTenant(scopeRoot, requestContext) → {ok, reason?} ──────────────────────────────────────────────
// Mismo shape {ok,reason} que assertTenantContext (requestContext.js) — no inventa una segunda convención. Si el
// tenant del scope guardado no coincide con el tenant ACTIVO de este turno, el scope se descarta ENTERO (nunca
// reuso parcial) — ver resolveConversationReference, que usa esto como guard de entrada.
export function validateScopeTenant(scopeRoot, requestContext) {
  const entry = (scopeRoot && scopeRoot.current) || (scopeRoot && Array.isArray(scopeRoot.history) && scopeRoot.history[0]) || null;
  if (!entry || !entry.tenant) return { ok: true };   // nada que validar (scope vacío/sin tenant registrado)
  if (!requestContext || typeof requestContext !== "object" || !requestContext.tenantId) {
    return { ok: false, reason: "sin requestContext — no se puede validar el tenant del scope conversacional" };
  }
  if (entry.tenant.tenantId !== requestContext.tenantId) {
    return { ok: false, reason: `el scope conversacional pertenece al tenant "${entry.tenant.tenantId}" pero el turno actual es del tenant "${requestContext.tenantId}" — se descarta, nunca se mezcla dato entre empresas` };
  }
  return { ok: true };
}

// ── resolveOrdinalReference(text, current) → {kind:"resolved", entities} | null ─────────────────────────────────
// "el primero"/"los dos primeros"/"el último"/"los peores"/"los mejores" — recorta `current.entities` (YA en el
// orden que la tool selló, ver `current.selection.orden`) SIN re-derivar el ranking. Solo lee `current` (NUNCA
// `history` — un ordinal es sobre el tema QUE ESTÁ vigente, no sobre uno anterior). Devuelve null cuando el texto
// no trae ningún patrón ordinal reconocible (el llamador sigue con la resolución deíctica normal).
const _NUM_WORDS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
const _ORD_N_RE = /\blos?\s+(dos|tres|cuatro|cinco|\d+)\b/i;
const _ORD_PRIMERO_RE = /\bel\s+primero\b|\bla\s+primera\b|\blos?\s+primeros?\b/i;
const _ORD_ULTIMO_RE = /\bel\s+[uú]ltimo\b|\bla\s+[uú]ltima\b|\blos?\s+[uú]ltimos?\b/i;
const _ORD_PEOR_RE = /\bpeor(?:es)?\b/i;
const _ORD_MEJOR_RE = /\bmejor(?:es)?\b/i;
function _ordN(text) {
  const m = _ORD_N_RE.exec(text);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  return _NUM_WORDS[raw] || parseInt(raw, 10) || null;
}
export function resolveOrdinalReference(text, current) {
  const t = String(text || "");
  if (!current || !Array.isArray(current.entities) || !current.entities.length) return null;
  const entities = current.entities;
  const n = _ordN(t);

  if (_ORD_PRIMERO_RE.test(t)) return { kind: "resolved", entities: entities.slice(0, n || 1) };
  if (_ORD_ULTIMO_RE.test(t)) return { kind: "resolved", entities: entities.slice(-(n || 1)) };

  // dirección YA SELLADA por la tool (current.selection.orden), NUNCA re-derivada — sin ella, "peor/mejor" es
  // ambiguo (no sabemos si el ranking mostrado es ascendente o descendente) y se deja pasar (null).
  const ordenTxt = current.selection && typeof current.selection.orden === "string" ? current.selection.orden : null;
  if (_ORD_PEOR_RE.test(t) || _ORD_MEJOR_RE.test(t)) {
    if (!ordenTxt) return null;
    const asc = /ascendente/i.test(ordenTxt);
    const wantsWorst = _ORD_PEOR_RE.test(t);
    // ascendente = de menor a mayor (el primero de la lista YA es el más bajo) · descendente = de mayor a menor
    // (el ÚLTIMO de la lista mostrada es el más bajo de los mostrados).
    const takeFromStart = wantsWorst ? asc : !asc;
    const k = n || 1;
    return takeFromStart ? { kind: "resolved", entities: entities.slice(0, k) } : { kind: "resolved", entities: entities.slice(-k) };
  }
  if (n) return { kind: "resolved", entities: entities.slice(0, n) };   // "los dos"/"los 3" sin calificador → cardinalidad simple
  return null;
}

// ── resolveConversationReference(text, plan, scopePrev, requestContext) ─────────────────────────────────────────
//   → {kind:"resolved", entities, dimension} | {kind:"ambiguous", options} | {kind:"none"}
// Se invoca DESDE answerViaOracle.js, en la MISMA cadena que _coerceEntityScopedFilters/_coerceTensionArgs — solo
// cuando el plan vino de una llamada REAL a PLAN (no de un plan sintético ya resuelto por otro bypass, ver
// answerViaOracle.js:_coerceConversationScope).
// exportado (Etapa 3, owner 2026-08-03) — scenarioIntent.js lo reusa para su arm "future_multi" (ver el comentario
// de cabecera de ese archivo): UNA sola fuente de verdad del patrón deíctico plural, nunca 2 regex que puedan
// divergir (mismo principio que ZERO_EXPLICIT_RE, compartido entre scenarioIntent.js y answerViaOracle.js).
export const DEICTIC_PLURAL_RE = /\best[oa]s\b|\bes[oa]s\b|\bell[oa]s\b|\blos?\s+mismos?\b/i;
const _DEICTIC_PLURAL_RE = DEICTIC_PLURAL_RE;
// _RECALL_MARK_RE — SOLO con esta marca explícita se consulta `history` además de `current` (ver el comentario
// largo más abajo, "por qué history NO entra en el caso común"). Sin ella, un "estos/esos" plano SOLO mira
// `current` — nunca resucita un tema abandonado por un cambio de tema real.
const _RECALL_MARK_RE = /\bde\s+antes\b|\bde\s+nuevo\b|\botra\s+vez\b|\banterior(?:es)?\b|\bque\s+ten[ií]amos\b/i;
const _DIM_HINT = [
  [/\bskus?\b/i, "sku"],
  [/\bclientes?\b/i, "cliente"],
  [/\bmarcas?\b/i, "marca"],
  [/\bfamilias?\b/i, "familia"],
];
function _dimHint(text) {
  for (const [re, dim] of _DIM_HINT) if (re.test(text)) return dim;
  return null;
}
function _dedupeGroups(groups) {
  const seen = new Set();
  const out = [];
  for (const g of groups) {
    const key = `${g.dimension}::${g.entities.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}

// _looksLikeReference(text) → true si el texto trae CUALQUIER marcador que este módulo reconoce como una
// referencia conversacional inequívoca (deíctico plural u ordinal/superlativo) — usado SOLO para distinguir un
// rechazo EXPLÍCITO (composeReferenceDecline: "sí había una referencia, no la puedo honrar") de un "none" mudo
// (no había nada que este módulo debiera resolver este turno, PLAN sigue con su criterio normal).
function _looksLikeReference(t) {
  return _DEICTIC_PLURAL_RE.test(t) || _ORD_PRIMERO_RE.test(t) || _ORD_ULTIMO_RE.test(t) || _ORD_PEOR_RE.test(t) || _ORD_MEJOR_RE.test(t) || !!_ordN(t);
}

// _uiSignalsGroup(uiSignals) → {dimension,entities}|null — Etapa 3 (owner 2026-08-03): "chips, tablas, filas de
// Sentrix... deben pasar TODAS por el MISMO mecanismo de contexto (nunca un camino paralelo para UI vs texto)".
// uiSignals.mesaSel (selección de checkboxes en la Mesa, ver SentrixPanel.jsx/uiSignals.js) hoy SOLO alimenta la
// ruta LEGACY (coerceChain.js) — un camino paralelo real: con el oráculo ON, "comparalos" tras seleccionar 2 filas
// en la Mesa no llegaba a esta resolución. Se trata como UN CANDIDATO MÁS del pool (mismas 4 reglas: cada entidad
// se REVALIDA con guessDimension — nunca se confía ciegamente en lo que viajó de la UI — y el eje declarado por la
// Mesa, si vino, se usa solo como HINT, no como autoridad). NUNCA reemplaza `current`/`history`: si ambos existen a
// la vez y no coinciden, es ambigüedad real (ver `pool` más abajo), nunca un silencioso "gana la UI".
function _uiSignalsGroup(uiSignals) {
  if (!uiSignals || !Array.isArray(uiSignals.mesaSel)) return null;
  const raw = uiSignals.mesaSel.filter((e) => typeof e === "string" && e);
  if (raw.length < 2) return null;
  const dims = raw.map((e) => guessDimension(e));
  const dimension = (typeof uiSignals.mesaDim === "string" && _AXES.has(uiSignals.mesaDim)) ? uiSignals.mesaDim : dims.find(Boolean) || null;
  if (!dimension) return null;
  const entities = raw.filter((e, i) => dims[i] === dimension);   // revalidación: solo las que SÍ pertenecen a ese eje
  return entities.length >= 2 ? { dimension, entities } : null;
}

export function resolveConversationReference(text, plan, scopePrev, requestContext, uiSignals) {
  const t = String(text || "");
  const tenantCheck = validateScopeTenant(scopePrev, requestContext);

  const level = plan && plan.scope && plan.scope.level;
  if (level === "global") return { kind: "none" };   // el cambio de tema lo maneja updateConversationScope, nada que resolver acá

  const named = (plan && plan.scope && Array.isArray(plan.scope.entities)) ? plan.scope.entities.filter(Boolean) : [];
  if ((level === "entity" || level === "list") && named.length && named.every((e) => !!guessDimension(e))) {
    return { kind: "none" };   // PLAN ya lo resolvió bien por comprensión — nada que forzar
  }

  // TENANT — el scope guardado es de OTRO tenant: se descarta ENTERO (nunca reuso parcial). Si el texto de todos
  // modos trae una referencia inequívoca, es un RECHAZO EXPLÍCITO (nunca inventa/cruza tenant en silencio); si el
  // texto no traía ninguna referencia de todos modos, no hay nada que declarar — "none" simple.
  if (!tenantCheck.ok) return _looksLikeReference(t) ? { kind: "decline", reason: "otro_tenant" } : { kind: "none" };

  const safePrev = scopePrev || emptyConversationScope();
  const current = safePrev.current;

  // ORDINAL/SUPERLATIVO ("el primero", "los dos peores") — solo sobre `current`, nunca `history`.
  const ordinal = resolveOrdinalReference(t, current);
  if (ordinal) {
    const revalidated = ordinal.entities.filter((e) => guessDimension(e) === current.dimension);
    return revalidated.length ? { kind: "resolved", entities: revalidated, dimension: current.dimension } : { kind: "decline", reason: "sin_referente" };
  }

  const isDeictic = _DEICTIC_PLURAL_RE.test(t);
  if (!isDeictic) return { kind: "none" };   // sin marcador deíctico ni ordinal → nada inequívoco que resolver acá

  // POR QUÉ history NO entra en el caso común: un "estos/esos" PLANO se refiere al tema QUE ESTÁ vigente — dejar
  // que mire `history` también arriesgaría resucitar un tema que un cambio de tema real (plan.scope.level=global)
  // ya retiró a `history` a propósito ("cambio real de tema no hereda nada"). Solo cuando el texto AGREGA una
  // marca de recuerdo explícita ("esos clientes DE ANTES", "los mismos que ANTES") se habilita `history` como
  // candidato — ahí sí puede haber 2+ lecturas igual de válidas (current vs. una entrada de history de la MISMA
  // dimensión) → ambigüedad real, nunca se adivina (ver composeReferenceAmbiguity).
  const wantsRecall = _RECALL_MARK_RE.test(t);
  const historyList = Array.isArray(safePrev.history) ? safePrev.history : [];
  // uiGroup (Etapa 3) — SIEMPRE candidato disponible (no depende de `wantsRecall`: la selección de la Mesa es
  // estado VIVO de la pantalla, no un tema conversacional "de antes" que haya que recordar explícitamente).
  const uiGroup = _uiSignalsGroup(uiSignals);
  const basePool = wantsRecall ? [current, ...historyList, uiGroup] : [current, uiGroup];
  const pool = basePool.filter((g) => g && Array.isArray(g.entities) && g.entities.length && g.dimension && g.dimension !== "cartera");
  if (!pool.length) return { kind: "none" };   // no había NADA estructurado que referenciar — no es un rechazo, es "no aplica"

  const hint = _dimHint(t);
  const filtered = hint ? pool.filter((g) => g.dimension === hint) : pool;
  if (!filtered.length) return { kind: "decline", reason: "sin_referente" };   // SÍ había scope, pero de otra dimensión — rechazo explícito, no silencio

  // AMBIGÜEDAD REAL: 2+ grupos DISTINTOS sobreviven el filtro — incluso con `hint` puesto (el hint solo acota la
  // DIMENSIÓN, "cliente" vs "sku"; con 2+ grupos de la MISMA dimensión —current Y una entrada de history, ambas
  // de clientes— sigue habiendo 2 lecturas igual de válidas de CUÁLES clientes). Con un único candidato (el caso
  // común: solo `current` calza, o hint+wantsRecall dejan un solo grupo) no hay nada que preguntar.
  let chosen;
  if (filtered.length > 1) {
    const distinct = _dedupeGroups(filtered);
    if (distinct.length > 1) return { kind: "ambiguous", options: distinct };
    chosen = distinct[0];
  } else {
    chosen = filtered[0];
  }
  const revalidated = chosen.entities.filter((e) => guessDimension(e) === chosen.dimension);
  if (!revalidated.length) return { kind: "decline", reason: "sin_referente" };   // el escenario/tenant cambió a mitad de sesión — nunca fuerza una interpretación rota
  return { kind: "resolved", entities: revalidated, dimension: chosen.dimension };
}

// ── composeReferenceAmbiguity/composeReferenceDecline — bypasean el narrador libre (mismo patrón que
// composeSubjectAmbiguity/composeOrphanAcceptance de dialogueState.js): nunca una pregunta genérica tipo "¿para
// qué cliente?" — siempre nombra las alternativas CONCRETAS que ya existen en el scope estructurado.
export function composeReferenceAmbiguity(options) {
  const groups = (Array.isArray(options) ? options : []).filter((g) => g && Array.isArray(g.entities) && g.entities.length);
  if (groups.length < 2) return `No tengo claro a qué te referís — decime la entidad o el grupo concreto y sigo.`;
  const partes = groups.map((g) => `${g.entities.join(", ")}${g.dimension ? ` (${g.dimension})` : ""}`);
  return `Tengo más de un grupo reciente que podría ser: ${partes.join(" — o — ")}. ¿A cuál te referís?`;
}

export function composeReferenceDecline(reason) {
  const r = String(reason || "").trim();
  if (r === "otro_tenant") return `Esa referencia es de otra empresa/conversación — no puedo reusarla acá. Decime a qué entidad te referís.`;
  if (r === "sin_referente") return `No tengo un grupo de entidades reciente al que eso pueda referirse — decime a cuáles te referís.`;
  return `No puedo resolver esa referencia con lo que tengo — decime a qué entidad o grupo te referís.`;
}

/* ── CONSOLIDACIÓN — QUÉ QUEDA PARA ETAPA 2/3 (documentado a propósito, para que el próximo agente no lo
 * re-descubra) ──────────────────────────────────────────────────────────────────────────────────────────────────
 * Elección DELIBERADA de Etapa 1: mem.lastOffer/mem.recentSubjects (dialogueState.js) NO se retiran ni se re-
 * apuntan a leer conversationScope.current/.history — siguen funcionando EXACTAMENTE como hoy, cero cambio de
 * comportamiento en esos dos mecanismos. conversationScope se construye y se guarda ADITIVAMENTE (mem.conversation
 * Scope, junto a mem.lastOffer/mem.recentSubjects, no en reemplazo). Motivo: el diseño original ofrece este camino
 * explícitamente ("retirar mem.recentSubjects/mem.lastOffer como keys — O DEJARLAS COMO ALIAS DE LECTURA
 * TEMPORAL") y es el de MENOR riesgo de regresión sobre ~30 gates/mecanismos que hoy dependen de esas dos keys
 * (MECHANISM_TABLE, isVagueOffer, isExhaustedMechanismOffer, _coerceMode vía recentSubjectsPrev[0].mode, etc.) —
 * ninguno de ellos se tocó.
 * Pendiente para Etapa 2/3 (staging plan original, sin cambios): portar resolveSubjectRecall/composeSubjectAmbig
 * uity a leer scopePrev.history; mover extractOffer/isVagueOffer/isExhaustedMechanismOffer a leer/escribir
 * conversationScope.current.ofertaPendiente; retirar mem.pendingSimulation en favor de
 * conversationScope.current.{supuestos,faltantes}; toolContracts.js + entityScope multi-entidad (Etapa 2);
 * scenarioIntent.js multi-eje + el arm "future_multi" que hace que el CASO OBLIGATORIO completo (3 turnos, "¿Qué
 * pasa si subo 3% el precio de estos SKU?" → pregunta SOLO por volumen, nunca por cliente) cierre de punta a
 * punta (Etapa 3) — Etapa 1 deja `plan.scope.entities` correctamente resuelto a los 3 SKU estructurados
 * (resolveConversationReference), pero la pregunta de "¿para qué cliente...?" hoy la dispara scenarioIntent.js
 * (detectScenarioIntent → kind:"no_entity", ver answerViaOracle.js líneas ~681-712) — ese código NO se tocó en
 * Etapa 1 a propósito (es la doctrina/mecanismo que Etapa 3 tiene que generalizar, no un wiring mecánico).
 */
