/* === src/adi/oracle/answerViaOracle.js · ARQUITECTURA C · Fase 3 · EL SEAM DE INTEGRACIÓN ===
 * Corre el ciclo COMPLETO de C (PLAN→BATCH→NARRAR bajo guardC) y devuelve un resultado COMPATIBLE con el pipeline
 * vivo ({text, route, evidence}). Detrás del flag ADI_ORACLE_ENABLED; si C se abstiene (plan falla / guard rechaza)
 * devuelve null → el llamador CAE a la ruta vieja (fallback intacto). Reversible: flag OFF = como si no existiera.
 *
 * callPlan/callNarrate son INYECTADOS: headless usan el adapter directo (oráculo/gates), el cliente usa fetch al
 * gateway (la key vive server-side). El motor, la boleta y guardC son los mismos; esto solo los orquesta.
 */
import { applyMemoryUpdate } from "./persona.js";
import { runPlan } from "./toolRunner.js";
import { ledgerBoleta } from "./ledger.js";
import { guardC, extractMechanismRows, periodosEsperados, ensurePeriodoDeclared, ensureCountAuthorized } from "./guardC.js";
import { stripFiller, normalizeFigures, ensureHypothesisFraming, ensureClarifyClosingQuestion, stripSingleRowTables, stripRedundantTemporalTable } from "./narratePromptC.js";
import { stripLanguageLeaks, stripOutOfDataOffers } from "../llm/voiceGuard.js";   // GARANTÍA runtime de registro (owner 2026-07-14/26: "palanca" y demás slang NO van — hoy solo corría en la ruta vieja, C quedaba sin la red) · stripOutOfDataOffers (owner 2026-08-03, Fase 3 eficiencia de Mini): MISMA garantía de "nunca ofrezcas data que no existe" — antes SOLO corría en la ruta legacy, cero ocurrencias en la ruta oráculo real
import { buildOracleEvidence } from "./sentrixEvidence.js";  // SENTRIX ES LA EVIDENCIA (owner 2026-07-28): el panel debe reflejar lo que C acaba de narrar
import { MODE_KEYS } from "./conversationalContract.js";
import { CONTENT_SCOPES, DETAIL_LEVELS } from "./responsePreference.js";
import { parseBlocks, renderFromBlocks, composeFromLedger, composeNoDataMessage, hasForbiddenContent, stripAllMarks, truncateToBriefBudget } from "./narrationBlocks.js";
import { isAcceptance, extractOffer, updateRecentSubjects, needsOrientacion, buildOrientacionInstruction, composeOrphanAcceptance, resolveSubjectRecall, composeSubjectAmbiguity, isVagueOffer, composeVagueOfferAcceptance, isExhaustedMechanismOffer, composeExhaustedMechanismAcceptance, matchEllipticEntity, getLastOffer, getRecentSubjects } from "./dialogueState.js";
// CONTINUIDAD CONVERSACIONAL UNIVERSAL (Etapa 1/3, owner 2026-08-03) — conversationScope.js es la capa canónica.
// Etapa 4 (owner 2026-08-04, "lastOffer/recentSubjects como vistas derivadas") cerró la consolidación que Etapa 1
// dejó pendiente por bajo riesgo: mem.lastOffer/mem.recentSubjects (dialogueState.js) ya NO son una segunda fuente
// mantenida en paralelo — getLastOffer/getRecentSubjects (importados arriba) las CALCULAN leyendo
// mem.conversationScope, con mem.lastOffer/mem.recentSubjects "pelados" como shim de compatibilidad para
// fixtures viejos. withOfertaPendiente (abajo) es el ÚNICO punto que escribe el lado canónico — ver el comentario
// "CONSOLIDACIÓN — ESTADO AL CIERRE DE ETAPA 4" al final de conversationScope.js para el detalle completo.
import { emptyConversationScope, updateConversationScope, resolveConversationReference, composeReferenceAmbiguity, composeReferenceDecline, withOfertaPendiente } from "./conversationScope.js";
// CONTINUIDAD CONVERSACIONAL UNIVERSAL · Etapa 2 (owner 2026-08-03) — toolContracts.js declara, POR TOOL, si admite
// una lista de entidades (y cómo: entityScope nativo · lista de cardinalidad fija · fan-out a N calls) o si genuina-
// mente NO admite varias a la vez (decline + oferta de correrlas por separado, nunca cambia de eje en silencio).
// applyMultiEntityScope es el ÚNICO punto que puebla args.entityScope/args.entities/expande calls por esto — ver su
// comentario de cabecera en toolContracts.js.
// applySingleEntityScope (Etapa 3, owner 2026-08-03) — el hermano N=1 de applyMultiEntityScope: cubre las tools que
// applyMultiEntityScope solo alcanzaba con 2+ entidades (entityProfile/entityRecord/trend/gridTable/tensionRead/
// inventoryStatus) para el caso de UNA sola entidad resuelta por conversationScope.js (ej. "profundiza en el
// primero") — ver su comentario de cabecera en toolContracts.js para el hallazgo completo.
import { applyMultiEntityScope, applySingleEntityScope } from "./toolContracts.js";
import { assertTenantContext } from "./requestContext.js";
import { fieldLabel, rawRecordFor, REFERENCIA_CAMPO, REFERENCIA_ANTERIOR, guessDimension } from "./entityRecord.js";
import { detectScenarioIntent, extractSignedPct, extractScenarioVariable, ZERO_EXPLICIT_RE } from "./scenarioIntent.js";
import { detectCriteriaIntent } from "../criteria.js";   // C.2 memoria de criterio (owner 2026-07-31, fix adi-oraculo-criterio-no-invocado): la ruta oráculo nunca la corría
import { composeCriteria } from "../conversation.js";     // UNA VERDAD: reusa la MISMA composición (setCriterion/forgetCriterion) de la ruta legacy, nunca la reimplementa acá

// ── BACKOFF ante RATE-LIMIT real (owner 2026-08-03, investigación cruzada de los 5 gates de Arquitectura C:
// clarify_mode/multimodo/provider_certification/plan/tension) — hallazgo transversal CONFIRMADO en vivo, múltiples
// corridas: el proveedor (OpenAI, TPM por modelo) devuelve HTTP 429 con frecuencia bajo carga concurrente, y NINGÚN
// adapter/loop de este archivo esperaba nada antes del siguiente intento — 3 reintentos casi instantáneos contra el
// MISMO minuto de cupo agotado garantizan repetir el mismo 429 las 3 veces. Los adapters (openai.js/anthropic.js)
// ahora marcan `err.code = "rate_limited"` (+ `err.retryAfterMs` si el proveedor lo informó) — acá solo se consume
// esa señal para esperar un poco ANTES del siguiente intento. NO decide el modelo (eso sigue siendo 100% de
// chooseModel/attempt, ver modelRouter.js) — solo demora el turno del MISMO loop de reintento ya existente, dándole
// al siguiente tier (mini→terra→sol, con presupuesto de TPM SEPARADO por modelo) una chance real de no repetir el
// mismo rechazo. Tope duro (2s) para no exceder presupuestos de función serverless por acumular esperas.
function _sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
const _RATE_LIMIT_BACKOFF_MS = 1500;
function _rateLimitBackoffMs(err) {
  if (!err || err.code !== "rate_limited") return 0;
  const ra = Number(err.retryAfterMs);
  return Number.isFinite(ra) && ra > 0 ? Math.min(ra, 2000) : _RATE_LIMIT_BACKOFF_MS;
}

// ── CONTADOR DE MODELO ≠ CONTADOR DE BACKOFF (owner 2026-08-03, investigación cruzada de los 5 gates de
// Arquitectura C — hallazgo de MAYOR impacto en USD del inventario: terra+sol miden 93-96.6% del costo extra de
// turnos escalados) — hasta acá, el loop de reintento usaba el MISMO `attempt` (índice del for) para dos cosas
// DISTINTAS: (1) decidir el backoff ante rate_limited (arriba) y (2) el valor que viaja a callPlan/callNarrate y que
// el gateway usa en chooseModel(attempt) para escalar mini→terra→sol (ver modelRouter.js/gatewayCore.js). Un 429
// real es SATURACIÓN DE CUPO — nada que ver con que el modelo actual "no esté rindiendo" — pero pagaba el mismo
// precio que un rechazo real de contenido: escalada a un modelo 13-50x más caro. Acá se separan: `modelAttempt` es
// un contador INDEPENDIENTE (arranca en 0, igual que antes) que SOLO avanza ante una señal de CALIDAD del modelo —
// nunca ante un 429 ni ante ningún otro error de infraestructura (timeout, gateway caído). El índice del for sigue
// gobernando el PRESUPUESTO de reintentos (3 intentos, sin cambios) y el `attempt` de planAttemptTrace/
// narrateAttemptTrace (telemetría, sin cambios) — SOLO el valor enviado a callPlan/callNarrate (lo que decide el
// tier) pasa a ser `modelAttempt`.
//
// _isPlanContentError(e) → true si la EXCEPCIÓN de callPlan es un rechazo de CONTENIDO (JSON inválido del tool_call
// / sin tool_call-tool_use en la respuesta — ver adapters/openai.js·anthropic.js) — la ÚNICA clase de excepción de
// PLAN que indica que el modelo no está rindiendo con el schema forzado. Cualquier otra excepción (429, timeout,
// "gateway no disponible", error de red genérico) es infraestructura → NUNCA escala el tier.
const _PLAN_CONTENT_ERROR_RE = /JSON inv[aá]lido|sin tool_call en la respuesta|sin tool_use en la respuesta/i;
function _isPlanContentError(e) {
  return !!(e && typeof e.message === "string" && _PLAN_CONTENT_ERROR_RE.test(e.message));
}

// ── VOCABULARIO NATURAL DE tensionRead (owner 2026-07-29, hallazgo en vivo): "cruza rotación con contribución"
// (la forma que el catálogo de planPrompt.js ya sabía reconocer) funciona, pero "¿quién sostiene la contribución y
// quién tiene menor margen/deja menos margen/consume margen?" — la forma NATURAL en que alguien realmente pregunta
// esto — el LLM la reconocía como "tensión" (elegía la tool bien) pero sustituía silenciosamente la métrica pedida
// (margen) por el default (capital), respondiendo una pregunta distinta a la que se hizo. FIX DE MOTOR (no solo
// prompt): un extractor determinístico corre sobre el TEXTO CRUDO de la pregunta y, si encuentra 2 tokens de
// métrica DISTINTOS mencionados explícitamente, los IMPONE sobre metricA/metricB de cualquier call a tensionRead
// del plan — sin importar qué haya elegido el LLM. Solo toca calls que el LLM YA enrutó a tensionRead (no decide
// por su cuenta que algo "es" una pregunta de tensión — esa decisión sigue siendo del plan), así que no hay riesgo
// de secuestrar un turno que no lo era.
const _TENSION_METRIC_MAP = [
  [/\bcontribuci[oó]n(?:es)?\b/i, "contribucion"],
  [/\bmargen(?:es)?\b/i, "margen"],
  [/\bcapital\b|\binventario\b|\bstock\b/i, "stockUSD"],
  [/\brotaci[oó]n\b/i, "rotacion"],
  [/\bcobertura\b|\bdoh\b/i, "doh"],
  [/\bcosto\s+medio\b/i, "costoMedio"],
  [/\bcostos?\b(?!\s+medio)/i, "costo"],
  [/\bprecio(?:s)?\s+de\s+lista\b/i, "precioLista"],
  [/\bventas?\b/i, "venta"],
  [/\bunidades\b/i, "unidades"],
  [/\brebates?\b|\bpct\s*rebate\b/i, "pctRebate"],
];
// DIRECCIÓN por métrica (owner 2026-07-29, hallazgo en vivo, 2ª vuelta): "quién CEDE más margen" pide el margen más
// BAJO primero (el peor), no el más alto — sin esto, la métrica salía CORRECTA pero el ranking mostraba a los de
// MEJOR margen (justo lo opuesto). Se mira una ventana local alrededor de CADA mención de métrica: si el verbo/
// calificador más cercano es de la familia "cede/pierde/deja de/menor/más bajo/peor" → ascendente (el más bajo
// primero); si no (sostiene/aporta/genera/consume/tiene más/mayor) → descendente (el más alto primero, default).
const _TENSION_DIR_LOW_RE = /\b(cede[n]?|pierde[n]?|deja[n]?\s+de|resta[n]?|menor(?:es)?|m[aá]s\s+bajo[s]?|peor(?:es)?|menos\b)\b/i;
const _DIR_WINDOW = 40;
function _extractTensionMetrics(text) {
  const t = String(text || "");
  const raw = [];
  for (const [re, token] of _TENSION_METRIC_MAP) {
    const m = re.exec(t);
    if (m && !raw.some((f) => f.token === token)) raw.push({ token, idx: m.index, end: m.index + m[0].length });
  }
  raw.sort((a, b) => a.idx - b.idx);
  // ventana SOLO HACIA ATRÁS, acotada por el fin de la métrica ANTERIOR (bug real cazado en vivo: una ventana
  // simétrica ±40 se comía el verbo de la SIGUIENTE cláusula — "sostiene la contribución del negocio y quién
  // CEDE más margen": el "cede" quedaba dentro de la ventana de "contribución" por pura cercanía lineal, aunque
  // en español el verbo SIEMPRE precede a la métrica que rige ("cede margen", nunca "margen cede") — mirando
  // solo hacia atrás y cortando en la métrica previa, cada verbo queda pegado a SU propia métrica, no a la ajena.
  return raw.map((f, i) => {
    const prevEnd = i > 0 ? raw[i - 1].end : 0;
    const lo = Math.max(0, f.idx - _DIR_WINDOW, prevEnd);
    const win = t.slice(lo, f.idx);
    return { token: f.token, idx: f.idx, dir: _TENSION_DIR_LOW_RE.test(win) ? "asc" : "desc" };
  });
}
// ESTRUCTURA de tensión SIN la palabra "tensión"/"cruza" (2ª forma natural encontrada en vivo): "¿quién sostiene la
// contribución del negocio y quién cede más margen?" — el plan reconoce CADA mitad por separado (contributionRead
// + marginRead, dos lecturas fragmentadas) en vez de UNA lectura cruzada — nunca llega a elegir tensionRead, así
// que la corrección de arriba (que solo AJUSTA una call ya elegida) no tiene nada que corregir. Acá se detecta la
// FORMA del pedido —dos lados contrastados, uno "sostiene" y otro "consume/cede"— y si aparece con 2 métricas
// distintas, se REEMPLAZA el plan fragmentado por la ÚNICA call que responde lo que en realidad se pidió.
const _TENSION_CONTRAST_RE = /\by\b|\bpero\b|\bmientras\s+que\b|\bvs\.?\b|\bversus\b/i;
const _TENSION_SUSTAIN_RE = /\b(sostiene[n]?|aporta[n]?|genera[n]?|sustenta[n]?)\b/i;
const _TENSION_DRAIN_RE = /\b(consume[n]?|cede[n]?|dejan?|resta[n]?|frena[n]?)\b/i;
function _hasTensionStructure(text) {
  const t = String(text || "");
  return _TENSION_CONTRAST_RE.test(t) && _TENSION_SUSTAIN_RE.test(t) && _TENSION_DRAIN_RE.test(t);
}
function _coerceTensionArgs(text, calls) {
  const arr = Array.isArray(calls) ? calls : [];
  const tokens = _extractTensionMetrics(text);
  if (arr.some((c) => c && c.tool === "tensionRead")) {
    if (tokens.length < 2) return arr;   // sin 2 métricas nombradas con claridad → no toca nada, el plan decide
    const [a, b] = tokens;
    let seenTension = false;
    return arr
      .map((c) => (c && c.tool === "tensionRead")
        ? { ...c, args: { ...(c.args || {}), metricA: a.token, metricB: b.token, dirA: a.dir, dirB: b.dir } } : c)
      // DEDUPE (hallazgo en vivo): el plan a veces emite tensionRead REPETIDA por cada dimensión posible
      // (cliente/marca/familia/sku) "por las dudas" — el narrador terminaba mezclando resultados de ejes
      // distintos (ej. citaba una entidad de "marca" como si fuera cliente). Nos quedamos con la PRIMERA
      // (la que el plan puso primero, típicamente la más relevante al alcance de la pregunta) y descartamos el resto.
      .filter((c) => { if (!c || c.tool !== "tensionRead") return true; if (seenTension) return false; seenTension = true; return true; });
  }
  // sin tensionRead en el plan: ¿el TEXTO tiene la estructura de una tensión igual? (sostiene X ... y/pero ... cede Y)
  if (tokens.length >= 2 && _hasTensionStructure(text)) {
    const [a, b] = tokens;
    const conDim = arr.find((c) => c && c.args && c.args.dimension);
    const dimension = (conDim && conDim.args.dimension) || "sku";
    return [{ tool: "tensionRead", args: { dimension, metricA: a.token, metricB: b.token, dirA: a.dir, dirB: b.dir } }];
  }
  return arr;
}

// ── ENTIDAD PUNTUAL → FILTRO OBLIGADO (owner 2026-07-31, auditoría integral) — el catálogo de planPrompt.js YA
// prohíbe explícitamente mandar una entidad puntual nombrada a una tool de ranking SIN filtro para queryMetric
// ("el margen de Y" es su ejemplo textual de lo que nunca debe pasar) pero esa prohibición no estaba generalizada
// a marginRead/contributionRead/diagnose: la Pasada 1 (PLAN) elige intermitentemente estas tools SIN el filtro que
// las acota a la entidad nombrada — y composeSpecContribucion (focus="rank", su default) IGNORA ESTRUCTURALMENTE
// el parámetro `entity`, así que cualquier plan que pase {dimension,entity} sin filters a contributionRead queda
// GARANTIZADO a traer la cartera completa, sin depender del sampling del LLM (marginRead/diagnose no tienen
// concepto de `entity` en absoluto — solo `filters` los acota, y sin filtro simplemente barren TODO el negocio).
// Efecto real medido: cifras agregadas de TODA la cartera atribuidas por error a una sola entidad nombrada.
//
// Backstop DETERMINÍSTICO (mismo principio que el resto de _coerce* de este archivo — solo para el patrón
// genuinamente inequívoco): si plan.scope.level="entity" con EXACTAMENTE 1 entidad nombrada (2+ es comparación/
// lista, terreno de compareEntities/diagnose sin acotar — no se toca acá) y la call es una de estas tools,
// forzamos el filtro (o el redirect ya existente de queryMetric) ANTES de ejecutar — reemplaza CUALQUIER `filters`
// que haya traído el plan (inválido, con la clave equivocada, o ausente) por el único filtro correcto: el eje real
// de esa entidad en el dato (guessDimension — mismo mecanismo data-driven que ya usan entityRecord/entityProfile,
// NUNCA una lista de regex nueva) → esa entidad. Si guessDimension no la reconoce (nombre no existe en el dato),
// no se fuerza nada — la tool declina honesto como siempre, sin inventar un eje.
// simulateCarga/simulateCapital/simulateCosto/simulateGeneral (owner 2026-08-03, auditoría de eficiencia de Mini):
// MISMO leak que marginRead/contributionRead/diagnose — simulateCarga/simulateCapital/simulateCosto también toman
// `filters` (ver toolRegistry.js) y, sin filtro, corren sobre TODO el negocio; si el plan las elige para una entidad
// puntual nombrada sin pasar el filtro, el resultado agregado de la cartera completa queda atribuido por error a esa
// única entidad — confirmado como leak real de datos de otras entidades, no solo desperdicio de tokens. Se agregan
// al MISMO set con el MISMO tratamiento (simulateGeneral ya exige su propio `entity`/`dimension` — nunca corre
// global — así que para ella este backstop es inerte pero inofensivo, no un caso especial nuevo).
const _ENTITY_FILTER_TOOLS = new Set(["marginRead", "contributionRead", "diagnose", "queryMetric", "simulateCarga", "simulateCapital", "simulateCosto", "simulateGeneral"]);
function _coerceEntityScopedFilters(plan, calls) {
  const arr = Array.isArray(calls) ? calls : [];
  if (!plan || !plan.scope || plan.scope.level !== "entity") return arr;
  const entities = Array.isArray(plan.scope.entities) ? plan.scope.entities.filter(Boolean) : [];
  if (entities.length !== 1) return arr;   // 2+ entidades: comparación/lista, terreno de compareEntities — no se toca
  const entity = entities[0];
  const axis = guessDimension(entity);
  if (!axis) return arr;   // nombre no reconocido en el dato → no se fuerza nada, la tool declina honesto como siempre
  return arr.map((c) => {
    if (!c || !_ENTITY_FILTER_TOOLS.has(c.tool)) return c;
    const args = (c.args && typeof c.args === "object" && !Array.isArray(c.args)) ? c.args : {};
    if (args.filters && typeof args.filters === "object" && !Array.isArray(args.filters) && args.filters[axis] === entity && Object.keys(args.filters).length === 1) return c;   // ya viene bien acotado, no-op
    const newArgs = c.tool === "queryMetric" ? { ...args, dimension: axis, filters: { [axis]: entity } } : { ...args, filters: { [axis]: entity } };
    return { ...c, args: newArgs };
  });
}

// ── RUTA DETERMINÍSTICA · consulta simple entidad+métrica (owner "pase quirúrgico de confiabilidad" 2026-07-29,
// requisito 1) — "¿cuál es el margen de Falabella?" no necesita que un LLM narre libre: el motor YA tiene la cifra
// exacta, autorizada, con su período. Saltea la Pasada 2 (narrar) ENTERA para este caso puntual — cero chance de
// decline/alucinación/variance en la forma MÁS simple y más frecuente de pregunta. Todo lo demás (rankings,
// diagnósticos, multi-entidad, "por qué", "qué hago") sigue por el narrador de siempre — esto NO reemplaza la
// Pasada 2, solo la evita en el caso más angosto y más seguro de saltear.
// Detección 100% DETERMINÍSTICA de plan+resultados (nunca del juicio del LLM sobre su propia respuesta):
//   · intent=answer · scope.level=entity con EXACTAMENTE 1 entidad (plan.scope, ver planPrompt.js)
//   · UNA sola call, a entityRecord (el único tool que devuelve una FILA completa direccionable por campo)
//   · resultado soportado (coverage.supported=true — la entidad/eje existió)
//   · EXACTAMENTE 1 métrica nombrada en el TEXTO CRUDO de la pregunta (reusa _extractTensionMetrics, ya probado
//     para tensionRead) — 0 métricas = pide el registro completo (mejor servido por el narrador); 2+ = comparación
//     o cruce (también mejor servido por el narrador, que puede tejer la relación entre ambas).
// _SNAPSHOT_TOKENS (owner 2026-07-31, hallazgo en vivo, "Inventario y capital inmovilizado") — toolRunner.js
// (_PERIODO_HOY/_stampPeriodo) solo reconoce 'inventoryStatus' como tool de "foto a hoy"; cuando la MISMA pregunta
// de negocio (capital inmovilizado / valor de inventario / rotación) se resuelve para un SKU puntual vía
// entityRecord (porque inventoryStatus no filtra por SKU), el período quedaba estampado "año cerrado" — inconsistente
// y engañoso para un concepto que es una foto del stock a hoy, no un acumulado anual. entityRecord trae una FILA
// MIXTA (campos anuales como venta/margen JUNTO a campos de foto como stock/rotación/DOH) — un solo `res.facts.periodo`
// por tool no puede ser correcto para ambos a la vez. Acá, en la ruta determinística de UN SOLO CAMPO (donde el
// token exacto que se va a narrar YA se conoce), el criterio deriva del CAMPO pedido, no de la tool que respondió:
// si el token es un campo de INVENTARIO/FOTO (stock, rotación, cobertura), el período es "hoy" sin importar que la
// tool haya sido entityRecord y no inventoryStatus.
const _SNAPSHOT_TOKENS = new Set(["stockUSD", "rotacion", "doh"]);
const _PERIODO_HOY_TXT = "foto de inventario a hoy — no es un promedio anual";   // mismo texto canónico que toolRunner.js

function _simpleEntityMetric(q, plan, calls, results) {
  if (!plan || plan.intent !== "answer") return null;
  if (!plan.scope || plan.scope.level !== "entity" || !Array.isArray(plan.scope.entities) || plan.scope.entities.length !== 1) return null;
  if (!Array.isArray(calls) || calls.length !== 1 || !calls[0] || calls[0].tool !== "entityRecord") return null;
  if (!Array.isArray(results) || results.length !== 1) return null;
  const r = results[0];
  if (!r || !r.coverage || r.coverage.supported !== true || !r.facts) return null;
  const tokens = _extractTensionMetrics(q);
  if (tokens.length !== 1) return null;
  const token = tokens[0].token;
  const label = fieldLabel(token);
  if (!label || r.facts[label] == null) return null;   // el campo no está en ESTE registro → cede al narrador, no inventa
  const entity = r.facts.entidad || plan.scope.entities[0];
  if (!entity) return null;
  const dimension = calls[0].args && calls[0].args.dimension;
  const rec = dimension ? rawRecordFor(dimension, entity) : null;
  const rawValue = rec && typeof rec[token] === "number" ? rec[token] : null;
  const periodo = _SNAPSHOT_TOKENS.has(token) ? _PERIODO_HOY_TXT : (r.facts.periodo || null);
  return { entity, label, token, value: r.facts[label], periodo, rec, rawValue };
}

// ── LECTURA MÍNIMA para la ruta determinística (owner "piensa bien, estás de acuerdo con esta respuesta?"
// 2026-07-29) — CONTRATO PERMANENTE para TODA respuesta puntual, no una excepción del rebate:
//   1. oración NATURAL con entidad y período (nunca la forma telegráfica "Entidad · Etiqueta: valor").
//   2. una lectura mínima SOLO si existe una referencia AUTORIZADA y comparable para ESA métrica.
//   3. cada métrica declara SU referencia válida (REFERENCIA_CAMPO/REFERENCIA_ANTERIOR en entityRecord.js —
//      benchmark/target/piso/techo YA establecidos en esta app, o período anterior por fila) — NUNCA un
//      promedio de cartera genérico inventado para la ocasión.
//   4. la referencia sale del MISMO registro/misma POLICY → mismo alcance y período, automático por construcción.
//   5. "significativo" es un umbral FIJO por métrica (ver REFERENCIA_CAMPO/REFERENCIA_ANTERIOR), nunca juicio del LLM.
//   6. sin referencia válida → dato limpio + oferta de análisis, nunca se fabrica una lectura.
//   7. "solo dame el dato" desactiva la lectura aunque exista referencia.
//   8. MISMA voz que la narración libre — oración ejecutiva, sin jerga, sin dramatizar (no dice "bien"/"mal",
//      solo la relación factual "por encima/por debajo de").
// GENERALIZACIÓN (owner 2026-07-29, "preferencia de respuesta estructurada y neutral al proveedor, separada del
// modo conversacional"): el requisito 7 de arriba ERA su propio regex de ruta (_SOLO_DATO_RE) — ahora es un caso
// particular de `pref.contentScope==="data_only"` (ver responsePreference.js + _coercePref más abajo), el MISMO eje
// que consume la Pasada 2 (narratePromptC.js). Una sola preferencia, dos rutas, ninguna colección de regex propia
// por ruta — _rutaDeterministica recibe `pref` YA RESUELTO (turno > sesión > default), no vuelve a clasificar nada.
const _METRICA_ORACION = {
  contribucion: { articulo: "la", plural: false, sustantivo: "contribución" },
  margen:       { articulo: "el", plural: false, sustantivo: "margen" },
  stockUSD:     { articulo: "el", plural: false, sustantivo: "valor de inventario" },
  rotacion:     { articulo: "la", plural: false, sustantivo: "rotación" },
  doh:          { articulo: "la", plural: false, sustantivo: "cobertura" },
  costoMedio:   { articulo: "el", plural: false, sustantivo: "costo medio" },
  costo:        { articulo: "el", plural: false, sustantivo: "costo" },
  precioLista:  { articulo: "el", plural: false, sustantivo: "precio de lista" },
  venta:        { articulo: "la", plural: false, sustantivo: "venta" },
  unidades:     { articulo: "las", plural: true, sustantivo: "unidades vendidas" },
  pctRebate:    { articulo: "el", plural: false, sustantivo: "rebate" },
};
// _lecturaMinima(token, rec, rawValue) → la frase de lectura, o null si NO hay referencia autorizada para este
// campo (el caller degrada a "dato limpio + oferta", nunca inventa una comparación).
function _lecturaMinima(token, rec, rawValue) {
  const vara = REFERENCIA_CAMPO[token];
  if (vara) {
    const refValue = vara.getRef(rec || {});
    if (typeof refValue === "number" && isFinite(refValue)) {
      const diff = rawValue - refValue;
      const sig = vara.umbralRel != null ? (refValue !== 0 && Math.abs(diff) / Math.abs(refValue) >= vara.umbralRel) : Math.abs(diff) >= vara.umbral;
      const relacion = diff > 0 ? "por encima de" : diff < 0 ? "por debajo de" : "igual a";
      const refTxt = `${vara.frase} de ${vara.fmt(refValue)}`;
      return sig ? `Está ${relacion} ${refTxt}.` : `Está en línea con ${refTxt}.`;
    }
  }
  const ant = REFERENCIA_ANTERIOR[token];
  if (ant && rec && typeof rec[ant.campo] === "number" && rec[ant.campo] !== 0) {
    const refValue = rec[ant.campo];
    const diff = rawValue - refValue;
    const rel = Math.abs(diff) / Math.abs(refValue);
    if (rel < ant.umbralRel) return "Se mantiene estable respecto al año anterior.";
    const pct = Math.round(rel * 1000) / 10;
    return `${diff > 0 ? "Creció" : "Cayó"} ${pct}% respecto al año anterior.`;
  }
  return null;   // sin referencia autorizada — el caller ofrece análisis, no inventa una lectura
}

function _rutaDeterministica(pref, { entity, label, token, value, periodo, rec, rawValue }) {
  const m = _METRICA_ORACION[token] || { articulo: "el", plural: false, sustantivo: label.toLowerCase() };
  const verbo = m.plural ? "son" : "es";
  const art = m.articulo.charAt(0).toUpperCase() + m.articulo.slice(1);
  const periodoTxt = periodo ? (/a[nñ]o cerrado/i.test(periodo) ? "en el año cerrado" : /foto.*hoy/i.test(periodo) ? "a la fecha de hoy" : null) : null;
  const oracion = `${art} ${m.sustantivo} de ${entity} ${verbo} ${value}${periodoTxt ? `, ${periodoTxt}` : ""}.`;
  if (pref.contentScope === "data_only") return oracion;   // requisito 7 generalizado: el usuario pidió SOLO el dato — se respeta, sin análisis
  if (typeof rawValue !== "number") return oracion;   // defensivo: sin crudo para comparar, no debería pasar
  const lectura = _lecturaMinima(token, rec, rawValue);
  if (lectura) return `${oracion} ${lectura}`;
  // brief: la oferta de análisis es contexto NO indispensable — se recorta. standard: se ofrece, como siempre.
  return pref.detailLevel === "brief" ? oracion : `${oracion} Si querés, puedo analizarlo con más detalle.`;
}

// ── MODO CONVERSACIONAL · capa de rol operativa (Fase 1: default|clarify · Fase 2: + diagnostico/decision/
// simulacion/seguimiento/evidencia — owner 2026-07-29: "no quiero un parche para 'no entendí'... quiero un sistema
// sofisticado pero controlado") — `mode` es un EJE DISTINTO de `intent`: intent decide QUÉ DATO pedir, mode decide
// CÓMO NARRARLO (un "qué significa X" es intent=define + mode=clarify a la vez). El enum vive en
// conversationalContract.js (fuente ÚNICA versionada, compartida con planPrompt.js/narratePromptC.js). El plan YA
// puede elegir cualquier mode por comprensión (ver planPrompt.js) — esto de acá es el PISO determinístico SOLO
// para clarify: frases INEQUÍVOCAS de confusión lo fuerzan sin depender de que el LLM lo note esa vez (mismo
// criterio que _coerceTensionArgs arriba). Si el texto NO matchea, se respeta CUALQUIER mode válido que el LLM ya
// eligió (nunca se lo saca — solo se agrega clarify por encima cuando corresponde).
// (2 bugs reales cazados probando la regex antes de wirearla: "explíc" con acento no matcheaba el stem "explic"
// literal — \w no cubre acentos; y "no entiendo" (presente) no matcheaba, solo "no entendí" (pasado)).
// (BUG real cazado en esta pasada — Fase 2: la versión de Fase 1 colapsaba CUALQUIER mode que no fuera "clarify" a
// "default", lo que habría descartado en silencio diagnostico/decision/simulacion/seguimiento/evidencia apenas se
// agregaron al enum — ahora preserva cualquier mode VÁLIDO del plan, no solo clarify.)
const _CLARIFY_RE = /\b(no\s+(?:te\s+)?entiend\w*|no\s+entend[ií]\w*|no comprendo|no logro entender|no me qued[oó] claro|no me queda claro|expl[ií]c\w*.{0,20}?\b(?:f[aá]cil|simple|sencill\w*)|en palabras (?:m[aá]s\s+)?simples|m[aá]s simple\b|qu[eé] significa|qu[eé] quiere decir|a qu[eé] te refer[ií]s)/i;
// _SEGUIMIENTO_RE (owner 2026-07-31, hallazgo en vivo, "Orientación, aclaración y continuidad") — reforzar SOLO la
// doctrina de conversationalContract.js (whenToUse de "seguimiento") NO alcanzó: medido con el LLM real, "Dale,
// cuéntame un poco más de eso." tras un turno de resumen ejecutivo clasificó mode=diagnostico en 4/4 corridas pese
// a la doctrina ya reforzada con ejemplos calcados de esta misma frase — un caso de "sistemáticamente mal pese a
// doctrina clara" (mismo bar que ya cruzó _CLARIFY_RE). Backstop DETERMINÍSTICO angosto, mismo patrón que
// _CLARIFY_RE: un marcador de continuación/acuerdo (dale/bueno/ok/va/listo) + un verbo de "seguir contando" en la
// MISMA frase — SOLO cuando YA hay hilo previo (sin hilo, "dale, cuéntame de X" no continúa nada, PLAN decide
// libre). Nunca compite con isAcceptance (esa bypasea PLAN entero para "dale" A SECAS, un caso distinto).
const _SEGUIMIENTO_MARKER_RE = /\b(dale|bueno|ok(?:ay)?|va|listo|de\s+una)\b/i;
const _SEGUIMIENTO_VERB_RE = /\bcu[eé]ntame\b|\bcont[aá]me\b|\bsegu[ií]\b|\bprofundiza\b|\bdame\s+m[aá]s\b|\bm[aá]s\s+detalle\b|\bexplica(?:me)?\s+m[aá]s\b/i;
// _isGlobalInventoryStatusCall (owner 2026-08-02, hallazgo en vivo): "cuánto/dónde tengo capital inmovilizado"
// clasificó mode=default en una redacción y mode=diagnostico en otra CASI IDÉNTICA — mismo tool (inventoryStatus
// sin filtro), mismos datos, pero cada modo narra distinto (diagnostico cuenta la historia completa; default da
// "el dato claro" y corta) — la MISMA pregunta de negocio termina con una profundidad muy distinta según cómo se
// formule. planPrompt.js YA describe esta tool como "DIAGNÓSTICO de inventario... es la respuesta completa a
// 'dónde tengo capital inmovilizado'" — el LLM no lo aplica de forma confiable (mismo bar que _SEGUIMIENTO_MARKER_RE
// arriba: sistemáticamente inconsistente pese a doctrina clara). Acotado a la llamada GLOBAL (sin filters): una
// bodega/marca puntual ya es un dato más específico, ahí sí queda a criterio del LLM.
function _isGlobalInventoryStatusCall(plan) {
  const calls = Array.isArray(plan && plan.calls) ? plan.calls : [];
  if (calls.length !== 1 || !calls[0] || calls[0].tool !== "inventoryStatus") return false;
  const filters = calls[0].args && calls[0].args.filters;
  return !filters || typeof filters !== "object" || Object.keys(filters).length === 0;
}
// _ELLIPTIC_ENTITY (owner 2026-08-03, defecto "herencia de modo/intención en turnos elípticos tipo 'Y Lider?'") —
// mismo patrón/precedencia que _CLARIFY_RE y _SEGUIMIENTO_MARKER_RE arriba: red angosta, SOLO fuerza ante un texto
// inequívoco. Medido en vivo (~9 corridas de 2 turnos): la resolución de ENTIDAD/SCOPE nunca falla para este
// patrón (el LLM lee el nombre propio directo del texto corto sin necesitar memoria) — el defecto real es
// específicamente `mode`, que sin este backstop queda 100% a criterio del LLM de PLAN de ESTE turno (inconsistente:
// ej. "¿Qué recomendás para Falabella?" mode=decision → "¿Y Sodimac?" cayó a mode=default, perdiendo profundidad).
// Deliberadamente NO toca scope/calls/tool — PLAN sigue resolviendo libremente QUÉ tool llamar con la entidad
// nueva (la tarea lo permite explícitamente; no hay evidencia empírica de que forzar el mismo tool sea necesario).
// requiere `hasThread` (sin hilo previo, "¿Y Lider?" no hereda nada — PLAN decide libre, como cualquier turno
// inicial) Y que recentSubjectsPrev[0] tenga un `mode` threadeado (turnos previos a este fix no lo traen; el
// backstop simplemente no aplica ahí, cae al comportamiento de siempre — no rompe memoria vieja).
function _coerceMode(text, plan, hasThread, recentSubjectsPrev) {
  const t = String(text || "");
  if (_CLARIFY_RE.test(t)) return "clarify";
  if (hasThread && _SEGUIMIENTO_MARKER_RE.test(t) && _SEGUIMIENTO_VERB_RE.test(t)) return "seguimiento";
  const prevTop = Array.isArray(recentSubjectsPrev) && recentSubjectsPrev[0];
  if (hasThread && prevTop && prevTop.mode && MODE_KEYS.includes(prevTop.mode) && matchEllipticEntity(t)) return prevTop.mode;
  const mode = plan && MODE_KEYS.includes(plan.mode) ? plan.mode : "default";
  if (mode === "default" && _isGlobalInventoryStatusCall(plan)) return "diagnostico";
  return mode;
}

// ── PREFERENCIA DE RESPUESTA · coerción determinística (owner 2026-07-29: "el PLAN debe detectarla y devolverla
// estructurada. Usa coerción determinística únicamente como red para instrucciones explícitas, no como mecanismo
// principal") — MISMO patrón y MISMA precedencia que _coerceMode arriba: el LLM (plan.pref) es el mecanismo
// PRINCIPAL (entiende cualquier paráfrasis); estas regexes son la RED que fuerza el valor SOLO ante frases
// inequívocas, igual de angostas que _CLARIFY_RE — nunca al revés (nunca "adivinan" una preferencia ambigua que el
// LLM ya haya decidido no marcar). _PREF_DATA_ONLY_RE es un SUPERSET literal del viejo _SOLO_DATO_RE retirado
// arriba — mismo comportamiento para las frases que YA estaban probadas, más "solo cifras/KPIs/números" (requisito
// del owner: "resumen ejecutivo... solo cifras").
// s[oó]lo (owner 2026-07-31, hallazgo en vivo): "\bsolo\b" NUNCA matcheaba la variante acentuada "sólo" (ortografía
// tradicional española, uso muy común) — confirmado por test de regex aislado, 100% determinístico, sin LLM
// involucrado. Las 4 regex de preferencia (data_only/action_only/results_only/"solo esta vez") se amplían acá.
// AMPLIACIÓN (owner 2026-08-04, consolidación Parte 2): probadas las 13 frases exactas del owner contra las regex de
// arriba, 9/13 no matcheaban ninguna ("solo dame el dato", "dime únicamente las ventas", "sin explicación", "directo
// al número", "cuánto fue y punto", "no me recomiendes", "no me des contexto", "solo el resultado", "solo la
// tabla") — confirmado con script de regex aislado, 100% determinístico, sin LLM. Se agregan como alternativas NUEVAS
// (nunca se retira ninguna existente) con el MISMO estilo angosto ya usado en el archivo (palabra ASCII pegada al
// \b, la vocal acentuada siempre en el INTERIOR de la alternativa — nunca como primer carácter tras un \b, porque
// \w en JS regex no incluye vocales acentuadas y esa combinación NUNCA matchea la ortografía con tilde real, ej.
// "únicamente" — verificado con test aislado). "y punto" lleva lookahead a puntuación/fin-de-frase para no
// confundirse con "punto de venta" (falso positivo real detectado en la ronda de negativos).
const _PREF_DATA_ONLY_RE = /\bs[oó]lo\s+(?:el\s+|la\s+|los\s+|las\s+)?(?:dato|datos|n[uú]mero|n[uú]meros|cifras?|kpis?|tabla|resultados?)\b|\bs[oó]lo\s+dame\b|\bdame\s+s[oó]lo\b|\b(?:dame|dime|mu[eé]strame|quiero|necesito)\s+[uú]nicamente\b|\bsin\s+an[aá]lisis\b|\bsin\s+interpretaci[oó]n\b|\bsin\s+explicaci[oó]n\b|\bnada\s+m[aá]s\b|\by\s+punto\b(?=[.!?]|\s*$)|\bdirecto\s+al\s+(?:n[uú]mero|dato|resultado|cifra)\b|\bno\s+me\s+recomiendes\b|\bno\s+me\s+des\s+contexto\b/i;
const _PREF_ACTION_ONLY_RE = /\bs[oó]lo\s+la\s+acci[oó]n\b|\bsin\s+(?:el\s+)?diagn[oó]stico\b|\band[aá]\s+al\s+grano\b|\bdirecto\s+a\s+la\s+acci[oó]n\b|\bsin\s+repetir\s+el\s+diagn[oó]stico\b/i;
// "resultados"/"sin recomendación" SOLO se leen como results_only dentro de una SIMULACIÓN (mode="simulacion") —
// fuera de ese contexto "sin recomendación" es ambiguo (una decisión SIN recomendación no tiene mucho sentido) y se
// deja al criterio del LLM (plan.pref), no se fuerza por red. "solo el resultado" (owner 2026-08-04): el artículo
// "el" faltaba junto a "los" — agregado. "no me recomiendes" (owner 2026-08-04): mismo tratamiento dual que "sin
// análisis" arriba — dentro de simulación matchea acá (results_only), fuera de simulación cae a _PREF_DATA_ONLY_RE.
const _PREF_RESULTS_ONLY_SIM_RE = /\bs[oó]lo\s+(?:el\s+|los\s+)?resultados?\b|\bsin\s+recomendaci[oó]n\b|\bsin\s+an[aá]lisis\b|\bno\s+me\s+recomiendes\b/i;
const _PREF_BRIEF_RE = /\bresponde?(?:me)?\s+breve\b|\bs[eé]\s+breve\b|\brespuesta\s+corta\b|\bmuy\s+resumido\b|\bcorto\s+y\s+concreto\b|\bresum[ií]me\b/i;
// _PREF_DIRECTO_RE/_PREF_STANDARD_RE (owner 2026-07-31, hallazgo "memoria-directo"): antes, "háblame más directo"
// llenaba memoryUpdate.verbosidad — una SEGUNDA fuente de verdad para lo mismo que ya resuelve detailLevel, y
// encima el LLM no la clasificaba de forma confiable (0-1/3 en el gate). Retirada del schema (planPrompt.js) y de
// mem.preferencias (persona.js) — estas dos frases son las ÚNICAS que quedan, mapeadas DIRECTO a responsePref, sin
// estado paralelo. A diferencia de _PREF_BRIEF_RE (persist queda a criterio del LLM/marcadores explícitos), estas
// dos SÍ persisten por defecto — es una corrección de REGISTRO general ("así hablame de ahora en más"), del mismo
// tipo que "trátame de usted" (que también persiste siempre) — no un pedido sobre el contenido de este turno.
const _PREF_DIRECTO_RE = /\bh[aá]blame\s+(?:m[aá]s\s+)?directo\b|\bs[eé]\s+(?:m[aá]s\s+)?directo\b|\bsin\s+rodeos\b|\bmenos\s+detalle\b/i;
const _PREF_STANDARD_RE = /\bexpl[ií]came?(?:lo)?\s+con\s+m[aá]s\s+detalle\b|\bs[eé]\s+(?:m[aá]s\s+)?explicativ[oa]\b/i;
// _PREF_RESET_RE · "volver a lo normal" CANCELA la preferencia de sesión SIEMPRE, sin condición (owner 2026-07-29,
// corrigiendo una lectura previa de este mismo mecanismo: "'Volver a lo normal' debe cancelar la preferencia
// persistente de la sesión. No debe volver a breve en el turno siguiente.") — fija los valores (full/standard) Y
// persist=true en el mismo paso; ver más abajo. Un "solo esta vez" EXPLÍCITO en la misma frase sigue ganando (regla
// general: ese marcador siempre acota a un turno, incluso sobre un reset) vía _PREF_ONE_TURN_RE, que se evalúa último.
const _PREF_RESET_RE = /\b(?:an[aá]lisis|respuesta)\s+completo?a?\b|\bvolv[eé]\s+a\s+lo\s+normal\b|\bya\s+no\s+(?:necesito|hace\s+falta|quiero)\s+que\s+sea\s+breve\b|\bcomo\s+antes\b/i;
const _PREF_PERSIST_RE = /\bdesde\s+ahora\b|\bde\s+ahora\s+en\s+adelante\b|\ba\s+partir\s+de\s+ahora\b|\bsiempre\s+respond[eé]me?\b|\ben\s+adelante\b/i;
const _PREF_ONE_TURN_RE = /\bs[oó]lo\s+esta\s+vez\b|\bpor\s+esta\s+vez\b|\bs[oó]lo\s+por\s+ahora\b|\bahora\s+s[oó]lo\b/i;

// _WANTS_PERFIL_RE (owner 2026-08-06, "lectura ejecutiva") — pedido EXPLÍCITO del perfil/avance/estado/resumen de
// una entidad (no solo "cómo está X" de pasada, ver _trend_vs_puntual_gate.mjs: esa frase sigue siendo
// entityProfile-solo). Usada por el backstop determinístico de abajo (cerca de `const calls = plan.calls`).
const _WANTS_PERFIL_RE = /\b(perfil|avance|resumen)\b|\bestado\b/i;

// _coercePref(text, plan) → { contentScope, detailLevel, persist } | null (null = ninguna señal este turno, ni del
// LLM ni de la red — el llamador cae a la preferencia de SESIÓN si había una, o al default). `plan.pref` (si el LLM
// lo llenó) se respeta tal cual salvo que una frase de la red la contradiga de forma inequívoca — la red SIEMPRE
// puede forzar (igual que _coerceMode fuerza "clarify"), nunca al revés.
function _coercePref(text, plan) {
  const t = String(text || "");
  const llmPref = (plan && plan.pref && typeof plan.pref === "object") ? plan.pref : {};
  let contentScope = CONTENT_SCOPES.includes(llmPref.contentScope) ? llmPref.contentScope : null;
  let detailLevel = DETAIL_LEVELS.includes(llmPref.detailLevel) ? llmPref.detailLevel : null;
  let persist = llmPref.persist === true;
  const isSim = plan && plan.mode === "simulacion";

  // "volver a lo normal" SIEMPRE cancela la sesión (owner 2026-07-29) — fija los valores Y persist=true juntos.
  if (_PREF_RESET_RE.test(t)) {
    contentScope = "full"; detailLevel = "standard"; persist = true;
  } else {
    if (_PREF_ACTION_ONLY_RE.test(t)) contentScope = "action_only";
    else if (isSim && _PREF_RESULTS_ONLY_SIM_RE.test(t)) contentScope = "results_only";
    else if (_PREF_DATA_ONLY_RE.test(t)) contentScope = "data_only";
    if (_PREF_BRIEF_RE.test(t)) detailLevel = "brief";
    if (_PREF_DIRECTO_RE.test(t)) { detailLevel = "brief"; persist = true; }
    if (_PREF_STANDARD_RE.test(t)) { detailLevel = "standard"; persist = true; }
  }
  if (_PREF_PERSIST_RE.test(t)) persist = true;
  if (_PREF_ONE_TURN_RE.test(t)) persist = false;   // marcador explícito de "esta vez" siempre gana sobre persist

  if (contentScope == null && detailLevel == null) return null;   // sin señal este turno → el llamador usa sesión/default
  return { contentScope, detailLevel, persist };
}

// _silentZeroSupuestoFaltante (owner 2026-07-31, hallazgo EN VIVO, #56 "simulate v2") — el doctrine de planPrompt.js
// pide explícitamente NO asumir 0% en la variable que el usuario no nombró y usar supuestos_faltantes en su lugar
// — medido en vivo que el LLM a veces lo hace igual (sesgo general a "contestar" antes que "preguntar"): "si le
// subo el precio a Falabella 5%, ¿me conviene?" (SIN mencionar volumen) volvió con variableB.delta_pct=0 puesto en
// silencio, sin supuestos_faltantes. RED determinística (mismo patrón que el resto de _coerce*): si una call a
// simulateGeneral trae una variable en delta_pct===0 Y el texto crudo NO menciona un "0%"/"sin cambio" explícito
// para esa variable, tratalo como si hubiera faltado — nunca confía en que el LLM se acuerde de preguntar solo.
// ZERO_EXPLICIT_RE (importado de scenarioIntent.js — 2026-07-31: una sola fuente de verdad compartida con el
// detector de intención de escenario, en vez de dos regex casi-idénticas que podían divergir).
function _silentZeroSupuestoFaltante(text, calls) {
  const call = Array.isArray(calls) ? calls.find((c) => c && c.tool === "simulateGeneral" && c.args) : null;
  if (!call) return null;
  const zeroVar = [call.args.variableA, call.args.variableB].find((v) => v && v.delta_pct === 0);
  if (!zeroVar) return null;
  if (ZERO_EXPLICIT_RE.test(String(text || ""))) return null;   // el usuario SÍ dijo "0%"/"sin cambio" — respetalo, no es un faltante
  // OJO: sin ningún número acá — "0%" en el texto sería una cifra sin autorizar y guardC rechazaría la PROPIA
  // pregunta de aclaración (bug real cazado en el propio testing de este fix).
  const pregunta = zeroVar.campo === "precioLista" ? "¿cuánto esperás que cambie el precio?" : "¿cuánto esperás que cambie el volumen o las unidades vendidas?";
  return [`${pregunta} No quiero asumir que se mantiene sin cambios, sin que me lo confirmes.`];
}

// _hasCompleteSimulateVars (owner 2026-07-31, hallazgo EN VIVO, certificación integral) — reproducido 1/4 con el
// window real de historia (8 mensajes, incluyendo una simulación ANTERIOR de otra entidad): el usuario contesta
// exactamente la variable que el propio turno anterior pidió ("el volumen baja 2%"), el plan arma `calls` PERFECTO
// (variableA y variableB con su delta_pct correcto) — pero el mismo plan, confundido por el ruido de la simulación
// previa todavía en la ventana, ADEMÁS marca `supuestos_faltantes` con una pregunta sobre una variable que YA está
// completa. Como el chequeo de abajo confía en `plan.supuestos_faltantes` sin cruzarlo contra `calls`, esa pregunta
// STALE pisaba el cálculo ya correcto y el turno nunca cerraba. Si AMBAS variables ya están completas y ninguna es
// 0 (el 0 sigue siendo cosa de `_silentZeroSupuestoFaltante`, no de acá), la corrida ya tiene lo que necesita —
// cualquier supuestos_faltantes de esta call puntual es contradictorio y se ignora.
function _hasCompleteSimulateVars(calls) {
  const call = Array.isArray(calls) ? calls.find((c) => c && c.tool === "simulateGeneral" && c.args) : null;
  if (!call) return false;
  const a = call.args.variableA, b = call.args.variableB;
  return !!(a && typeof a.delta_pct === "number" && a.delta_pct !== 0 && b && typeof b.delta_pct === "number" && b.delta_pct !== 0);
}

// ── mem.pendingSimulation (owner 2026-07-31, certificación integral, riesgo residual #2 de simulate v2) ──
// El fix de _hasCompleteSimulateVars de arriba resuelve el caso en que el plan ARMA `calls` bien pese a marcar un
// supuestos_faltantes stale — pero medido en vivo, un turno de confusión ADICIONAL puede hacer que el plan pierda
// el hilo POR COMPLETO (respondió sobre "carga comercial" de Lider en vez de continuar la simulación precio+volumen
// pedida). Causa raíz: no había NINGÚN estado estructurado de "simulación pendiente" — a diferencia de lastOffer,
// el motor confiaba en que PLAN re-derive entidad+variables+campo-faltante del texto crudo de los últimos 8
// mensajes (buildPlanUserMessage, planPrompt.js) en CADA turno. Con dos simulaciones recientes en esa ventana
// (explorar escenarios de 2 clientes distintos — uso realista) eso es frágil. Este mecanismo resuelve el turno
// SIGUIENTE de forma determinística, sin volver a pedirle a PLAN que reconstruya nada — mismo principio que
// priorOffer.tool más abajo (bypasea PLAN ENTERO cuando no hay nada que el LLM deba decidir).
//
// extractSignedPct/ZERO_EXPLICIT_RE ahora importados de scenarioIntent.js (2026-07-31: una sola fuente de verdad
// compartida con el detector de intención de escenario — antes vivían duplicados acá y en el detector nuevo, con
// riesgo real de divergir, ej. el fix de "cambios" plural o "mantén" solo hubiera quedado en uno de los dos).

// _buildPendingSimulation(text, plan) → {dimension,entity,entities,known:{campo,delta_pct},missingCampo} | null —
// se arma cuando supuestos_faltantes disparó para una simulación de 2 variables (ver planPrompt.js: ese campo es
// SOLO para esto). Preferí `plan.calls` si YA trae 1+ simulateGeneral con una variable no-cero (el camino
// silent-zero-backstop la clasificó estructuralmente — más confiable que re-parsear texto); si `calls` viene
// vacío (el camino LIMPIO — el diseño pide dejarlo así), extraé la variable nombrada del texto de ESTE turno
// (frase corta y puntual, no la ventana de 8 mensajes que confunde a PLAN) vía extractScenarioVariable.
// GENERALIZACIÓN (Etapa 3, owner 2026-08-03, continuidad conversacional universal): antes solo leía la PRIMERA
// call de `calls` y hardcodeaba dimension="cliente" — con Etapa 2 (toolContracts.js), un scope de 2+ entidades
// (ej. "estos SKU") ya llega acá como N calls DISTINTAS a simulateGeneral (una por entidad, fan-out de
// applyMultiEntityScope), cada una con la MISMA variable conocida y la MISMA variable faltante — recolectar
// SOLO la primera perdía las demás entidades del pendiente (hallazgo documentado en el diseño de Etapa 2,
// openIssuesForNextStage #5). `entity` (singular) sobrevive como alias = entities[0] — compatibilidad hacia
// atrás con cualquier lector existente de ese campo (ninguno hoy, pero es gratis mantenerlo).
function _buildPendingSimulation(text, plan) {
  const calls = (plan && Array.isArray(plan.calls)) ? plan.calls : [];
  const simCalls = calls.filter((c) => c && c.tool === "simulateGeneral" && c.args);
  let known = null, dimension = null;
  const entities = [];
  for (const c of simCalls) {
    if (typeof c.args.entity === "string" && c.args.entity && !entities.includes(c.args.entity)) entities.push(c.args.entity);
    if (!dimension && typeof c.args.dimension === "string" && c.args.dimension) dimension = c.args.dimension;
    if (!known) {
      const vars = [c.args.variableA, c.args.variableB].filter(Boolean);
      known = vars.find((v) => v && typeof v.delta_pct === "number" && v.delta_pct !== 0 && (v.campo === "precioLista" || v.campo === "unidades")) || null;
    }
  }
  if (!known) known = extractScenarioVariable(text);
  if (!entities.length && plan && plan.scope && (plan.scope.level === "entity" || plan.scope.level === "list") && Array.isArray(plan.scope.entities)) {
    for (const e of plan.scope.entities) if (typeof e === "string" && e && !entities.includes(e)) entities.push(e);
  }
  if (!dimension) dimension = (plan && plan.scope && typeof plan.scope.dimension === "string" && plan.scope.dimension) || (entities[0] && guessDimension(entities[0])) || null;
  if (!known || !entities.length) return null;   // sin entidad o sin variable nombrada clara → no se arma (mejor nada que un pendiente roto)
  const missingCampo = known.campo === "precioLista" ? "unidades" : "precioLista";
  return { dimension: dimension || "cliente", entity: entities[0], entities, known: { campo: known.campo, delta_pct: known.delta_pct }, missingCampo };
}

// _resolvePendingSimulation(text, pending) → {variableA,variableB} | null — intenta resolver la respuesta del
// usuario contra la simulación pendiente. DISTINCIÓN explícita (owner, punto 2 del pedido de certificación):
// "0%"/"sin cambio"/"no cambia"/"queda igual"/"se mantiene"/"mantén" → delta_pct=0 LEGÍTIMO (el usuario respondió,
// y la respuesta es cero). Un número con signo/verbo direccional → ese valor. CUALQUIER OTRA COSA (no numérico,
// cambio de tema, "no sé") → null — el turno NO contestó la pregunta pendiente, nunca se asume 0 por defecto acá.
// `pending.entities` (Etapa 3) es la forma CANÓNICA — `pending.entity` sobrevive como alias singular (ver
// _buildPendingSimulation arriba); acepta cualquiera de los dos para no romper un pendiente viejo persistido.
function _resolvePendingSimulation(text, pending) {
  const hasEntity = !!(pending && (pending.entity || (Array.isArray(pending.entities) && pending.entities.length)));
  if (!pending || !pending.missingCampo || !pending.known || !hasEntity) return null;
  const t = String(text || "");
  let missingDelta;
  if (ZERO_EXPLICIT_RE.test(t)) missingDelta = 0;
  else {
    const pct = extractSignedPct(t);
    if (!pct) return null;   // no resuelve → el llamador abandona el pendiente, nunca fuerza una interpretación
    missingDelta = pct.delta_pct;
  }
  const missingVar = { campo: pending.missingCampo, delta_pct: missingDelta };
  const knownVar = pending.known;
  return knownVar.campo === "precioLista" ? { variableA: knownVar, variableB: missingVar } : { variableA: missingVar, variableB: knownVar };
}

// _composedBypassResult(text, mem, recentNarrationsPrev, scenario) → { r, mem } | null (null SOLO si guardC rechaza
// el mensaje fijo — no debería pasar nunca con prosa sin cifras/entidades, pero nunca se asume). Empaquetado
// compartido por los bypasses que NUNCA llegan a invocar PLAN/BATCH/NARRAR (owner 2026-07-31, cierre de #48:
// aceptación huérfana + retorno ambiguo a temas recientes) — mismo shape que el return final de answerViaOracle.
// lastOffer siempre queda null (ninguna de las dos preguntas ofrece una continuación estructurada que replicar);
// recentSubjects se hereda sin tocar (no se resolvió ninguna entidad nueva este turno).
function _composedBypassResult(text, mem, recentNarrationsPrev, scenario) {
  const mechanismMemory = (mem && typeof mem.mechanismByEntity === "object" && mem.mechanismByEntity) || {};
  const g = guardC(text, { ledger: { figs: [] }, results: [], trace: null, question: "", mechanismMemory, sealedOrders: [] });
  if (!g.ok) return null;
  // pendingSimulation SIEMPRE se limpia acá por defecto (owner 2026-07-31): ninguno de estos bypasses (aceptación
  // huérfana, retorno ambiguo) continúa una simulación pendiente — el caller de supuestos_faltantes (el ÚNICO que
  // SÍ arma una nueva) la restaura explícito después de llamar a esta función.
  let mem2 = { ...mem, lastOffer: null, pendingSimulation: null, recentNarrations: [text, ...recentNarrationsPrev].slice(0, 2) };
  // Etapa 4 (owner 2026-08-04) — SYNC del lado canónico: lastOffer=null tiene que reflejarse TAMBIÉN en
  // conversationScope.current.ofertaPendiente, o el turno SIGUIENTE (getLastOffer) leería el valor STALE de un
  // turno anterior (fromScope gana por precedencia sobre el shim mem.lastOffer — ver dialogueState.js) y un "sí"
  // ejecutaría una oferta que este bypass ya invalidó. No-op si no hay conversationScope/current que limpiar.
  if (mem2.conversationScope) mem2 = { ...mem2, conversationScope: withOfertaPendiente(mem2.conversationScope, null) };
  return {
    r: {
      text,
      route: "oracle",
      evidence: buildOracleEvidence({ plan: null, results: [], figs: [], scenario }),
      deterministic: true,
      suggestions: null,
      sentrixAction: null,
    },
    mem: mem2,
  };
}

// answerViaOracle({ text, history, mem, scenario, callPlan, callNarrate, maxCalls, uiSignals }) → { r, mem } | null
//   r   = { text, route:"oracle", evidence:{boleta,...} }  (compatible con _turnFromResult)
//   mem = la memoria de interacción ACTUALIZADA (el llamador la persiste en el context del hilo)
// `uiSignals` (Etapa 3, owner 2026-08-03, continuidad conversacional universal) — OPCIONAL, mismo shape que
// getUISignals() (src/adi/uiSignals.js): "chips, tablas, filas de Sentrix y preguntas escritas a mano deben pasar
// TODAS por el MISMO mecanismo de contexto (nunca un camino paralelo para UI vs texto)" — hallazgo real: la
// selección de checkboxes de la Mesa (uiSignals.mesaSel) hoy SOLO alimentaba coerceChain.js (ruta legacy); con el
// oráculo ON, "comparalos" tras seleccionar 2 filas nunca veía esa selección. Se pasa tal cual a
// resolveConversationReference (conversationScope.js) como UN CANDIDATO MÁS del pool — mismas 4 reglas de
// validación que cualquier otra fuente (tenant/existencia/dimensión/ambigüedad), nunca un atajo que las salte.
export async function answerViaOracle({ text, history = [], mem = {}, scenario = "actual", callPlan, callNarrate, maxCalls = 6, requestContext = null, uiSignals = null } = {}) {
  if (typeof callPlan !== "function" || typeof callNarrate !== "function") return null;
  const q = (text || "").trim();
  if (!q) return null;
  // GUARD DE TENANT (owner 2026-07-29, multiempresa): `requestContext` es OPCIONAL para no romper compatibilidad
  // con los ~30 gates/callers existentes que todavía no lo pasan — pero SI viene, se valida ANTES de tocar el
  // motor. tenantStore.js guarda el tenant activo en una variable global de módulo (correcto para el modelo hoy:
  // el motor corre client-side, un browser tab = un proceso = un tenant a la vez) — este guard es la red si algún
  // caller alguna vez queda con un tenantId STALE (ej. el usuario cambió de empresa a mitad de una llamada en
  // vuelo): abstención limpia, nunca calcular con el dato de la empresa equivocada.
  if (requestContext) {
    const t = assertTenantContext(requestContext);
    if (!t.ok) { console.error(`[answerViaOracle] abstención por tenant mismatch: ${t.reason}`); return null; }
  }

  // ── RUTA DE ACEPTACIÓN ESTRUCTURADA (owner 2026-07-30, Fase 3: "que 'sí' ejecute exactamente lo ofrecido, no que
  // lo reinterprete") — bypasea la Pasada 1 (PLAN) igual que _rutaDeterministica bypasea la Pasada 2: cuando la
  // oferta guardada YA trae tool+args derivados (el caso limpio "profundizá en esto mismo" — ver extractOffer en
  // dialogueState.js), no hay nada que el LLM deba decidir; reconstruir el mismo plan a mano sería reinterpretar
  // lo que ya se ofreció, exactamente lo que se pidió evitar. Si la oferta NO trae tool (proponía un ángulo nuevo,
  // requiere criterio real), NO se bypasea: PLAN corre normal, pero con la oferta como contexto explícito
  // (mem.lastOffer, vía renderInteractionMemory — ver persona.js) en vez de tener que releer hilo_reciente crudo.
  // Etapa 4 (owner 2026-08-04): getLastOffer/getRecentSubjects (dialogueState.js) leen conversationScope.current.
  // ofertaPendiente/conversationScope.recentSubjects PRIMERO (el lado canónico, escrito por withOfertaPendiente/
  // el dual-write de recentSubjects más abajo) y caen a mem.lastOffer/mem.recentSubjects SOLO si el scope no trae
  // nada — mismo VALOR que antes en cualquier turno real (dual-write nunca deja que las 2 fuentes diverjan).
  const priorOffer = getLastOffer(mem);
  const recentSubjectsPrev = getRecentSubjects(mem);
  const recentNarrationsPrev = Array.isArray(mem && mem.recentNarrations) ? mem.recentNarrations : [];
  // conversationScope (Etapa 1, ver conversationScope.js) — leído ACÁ, ANTES de PLAN, mismo principio que
  // priorOffer/recentSubjectsPrev arriba: el estado del turno ANTERIOR es lo único que puede autorizar una
  // resolución determinística de referencia en ESTE turno.
  const conversationScopePrev = (mem && mem.conversationScope && typeof mem.conversationScope === "object") ? mem.conversationScope : emptyConversationScope();
  // pendingSimulation (ver el bloque grande junto a _hasCompleteSimulateVars): intenta resolver la respuesta de
  // ESTE turno contra la simulación de 2 variables que quedó pendiente. resolvedPendingSim==null → o no había
  // pendiente, o el texto no la contesta (cambio de tema, "no sé") — el llamador ABANDONA el pendiente (nunca lo
  // fuerza) y PLAN corre normal más abajo, como si nunca hubiera existido.
  const pendingSimulationPrev = (mem && mem.pendingSimulation && typeof mem.pendingSimulation === "object") ? mem.pendingSimulation : null;
  const resolvedPendingSim = pendingSimulationPrev ? _resolvePendingSimulation(q, pendingSimulationPrev) : null;

  // ── MEMORIA DE CRITERIO (owner 2026-07-07 C.2 · fix 2026-07-31 [[adi-oraculo-criterio-no-invocado]]) — "recordá
  // que mi margen mínimo es 25%" nunca invocaba setCriterion/setBenchmarkOverride por esta ruta: PLAN corría normal,
  // el LLM narraba una confirmación amable citando el número que el PROPIO usuario nombró (autorizado por guardC
  // vía el eco del texto de la pregunta, no por el mecanismo real) y el override JAMÁS se seteaba — reproducido en
  // vivo antes de este fix. Mismo principio que el resto de bypasses de este archivo: corre PRIMERO, ANTES de PLAN,
  // y CORTA la cadena (mismo lugar que ocupa en coerceChain.js, la ruta legacy). detectCriteriaIntent/composeCriteria
  // son la MISMA red y la MISMA composición que ya usa la ruta legacy — UNA VERDAD, nunca se reimplementan acá.
  // A DIFERENCIA de _composedBypassResult, esto NO pasa por guardC: la confirmación es administrativa/verbatim con
  // cifras que el usuario nombró en su propio pedido (nunca autorizadas por ledger/figs, que acá vendrían vacíos) —
  // el MISMO motivo por el que pickNarratedText (numberGuard.js) salta el narrador para evidence.kind==="criteria"
  // en la ruta legacy. Pasar esto por guardC lo rechazaría como "cifra-no-autorizada" y el bypass fallaría en
  // silencio, reproduciendo una variante del mismo bug que esto arregla.
  const criteriaIntent = detectCriteriaIntent(q);
  if (criteriaIntent) {
    const cr = composeCriteria(criteriaIntent);
    let mem2 = { ...mem, lastOffer: null, pendingSimulation: null, recentNarrations: [cr.text, ...recentNarrationsPrev].slice(0, 2) };
    // Etapa 4 (owner 2026-08-04) — mismo SYNC que _composedBypassResult: lastOffer=null también limpia el lado
    // canónico, para que getLastOffer no resucite una oferta ya invalidada por este bypass.
    if (mem2.conversationScope) mem2 = { ...mem2, conversationScope: withOfertaPendiente(mem2.conversationScope, null) };
    return {
      r: {
        text: cr.text,
        route: "oracle",
        evidence: cr.evidence,
        deterministic: true,
        suggestions: cr.suggestions || null,
        sentrixAction: cr.sentrixAction || null,
      },
      mem: mem2,
    };
  }

  // ── ACEPTACIÓN HUÉRFANA (owner 2026-07-31, cierre de #48) — "sí"/"dale" SIN ninguna oferta activa: "no debe
  // repetir la respuesta anterior; debe pedir una precisión breve o mostrar las opciones vigentes." Medido en vivo
  // (adi-fase3-orientacion-inicial.md): dejarlo en manos del narrador producía una respuesta casi idéntica a la
  // anterior — exactamente lo que esto cierra. Bypasea PLAN/BATCH/NARRAR ENTERO, nunca narra libre (mismo principio
  // de garantía-por-construcción que data_only/results_only): si guardC rechazara el mensaje fijo (no debería, es
  // prosa sin cifras ni entidades), cae de largo a PLAN normal en vez de abstenerse en silencio.
  if (isAcceptance(q) && !priorOffer) {
    const composed = composeOrphanAcceptance(recentSubjectsPrev);
    const out = _composedBypassResult(composed, mem, recentNarrationsPrev, scenario);
    if (out) return out;
  }

  // ── MECANISMO YA AGOTADO (owner 2026-08-01, hallazgo en vivo de 3er orden — aceptar la MISMA oferta "¿profundice
  // por SKU?" una 2da vez, tras simulateCarga ya haber corrido, repetía la MISMA simulación y la MISMA oferta —
  // loop). Corre ANTES del chequeo de oferta vaga (más específico: reconoce que YA se corrió algo, no que nunca
  // hubo mecanismo). Ver dialogueState.js:isExhaustedMechanismOffer.
  if (isAcceptance(q) && priorOffer && isExhaustedMechanismOffer(priorOffer)) {
    const composed = composeExhaustedMechanismAcceptance(priorOffer);
    const out = _composedBypassResult(composed, mem, recentNarrationsPrev, scenario);
    if (out) return out;
  }

  // ── OFERTA VAGA ACEPTADA (owner 2026-08-01, hallazgo en vivo: "me dio la misma respuesta") — priorOffer EXISTE
  // pero sin tool capturado (la oferta no era "profundizá en esto mismo", era del tipo "explorar condiciones/
  // alternativas/negociación" — sin mecanismo que lo cumpla, ver dialogueState.js:isVagueOffer). Sin este corte,
  // "sí" caía de largo a PLAN normal, que sin nada nuevo que decidir volvía a llamar la MISMA tool y el narrador
  // solo podía reformular. Corta ANTES de PLAN, igual que el resto de bypasses de esta sección.
  if (isAcceptance(q) && priorOffer && isVagueOffer(priorOffer)) {
    const composed = composeVagueOfferAcceptance(priorOffer);
    const out = _composedBypassResult(composed, mem, recentNarrationsPrev, scenario);
    if (out) return out;
  }

  // ── RETORNO A TEMAS RECIENTES — resolución posicional determinística (owner 2026-07-31, cierre de #48) ──
  // "volvamos a lo de Falabella" (nombra la entidad) ya lo resuelve PLAN por comprensión, esto es SOLO para
  // referencias POSICIONALES ("lo anterior"/"el primer tema"). Ver dialogueState.js para el detalle de índices.
  const subjectRecall = resolveSubjectRecall(q, recentSubjectsPrev);
  if (subjectRecall && subjectRecall.kind === "ambiguous") {
    const composed = composeSubjectAmbiguity(subjectRecall.options);
    const out = _composedBypassResult(composed, mem, recentNarrationsPrev, scenario);
    if (out) return out;
  }

  // ── COERCIÓN DE INTENCIÓN DE ESCENARIO (owner 2026-07-31, certificación integral, 2 fallas reales de ENTRADA a
  // simulate v2) ── "Sube 8% el precio de Lider" (imperativo, sin "¿me conviene?") nunca llamaba a simulateGeneral
  // — PLAN lo leía como pedido de análisis/decisión y respondía con margen/benchmark, sin pedir el volumen. Y una
  // consulta puntual sobre Jumbo perdió el alcance, produciendo una simulación de CARTERA COMPLETA. "Que el motor
  // funcione después de reformular no basta. El primer intento natural debe llegar al flujo correcto" (owner).
  // Ver scenarioIntent.js para el detector — acá SOLO se consume su veredicto. Corre SOLO si esta misma respuesta
  // no acaba de resolver una simulación YA pendiente (resolvedPendingSim): si el turno actual SÍ la resolvió, esa
  // toma precedencia entera, sin tocar nada de esto.
  if (!resolvedPendingSim) {
    // scopeCurrent (Etapa 3, ver scenarioIntent.js): el MISMO conversationScope.current que Etapa 1 ya resuelve
    // para deícticos de lectura — acá se lo pasamos al detector para que "estos SKU"/"esos clientes" también
    // resuelva ANTES de simular, no solo para leer. detectScenarioIntent es puro (nunca muta esto).
    const scenarioIntent = detectScenarioIntent(q, conversationScopePrev.current);
    // "no_entity": campo+% inequívoco, pero NINGUNA entidad conocida nombrada EN ESTE TEXTO ni resoluble vía
    // conversationScope (scenarioIntent.js ya lo intentó — ver "future_multi" abajo) — nunca se asume cartera
    // completa en silencio (la falla #2, invertida: sin entidad tampoco se adivina, se pregunta). PERO (owner
    // 2026-07-31, hallazgo en vivo): esto opera SOLO sobre el texto crudo del turno actual, nunca sobre history/
    // pendingSimulation — mem.pendingSimulation ya se limpió (sobrevive un único turno) si hubo un tema de por
    // medio, así que un retorno ELÍPTICO a una simulación cuya entidad quedó establecida turnos atrás (interrumpida
    // por un desvío de tema) perdía el contexto acá, preguntando algo que el usuario ya había contestado. Antes de
    // preguntar genérico, consultamos mem.recentSubjects (Fase 3, sobrevive varios turnos, a diferencia de
    // pendingSimulation): si hay un sujeto reciente recuperable, dejamos pasar el turno a PLAN — el motor YA
    // demostró resolver este tipo de elipsis por comprensión cuando se le da la oportunidad — en vez de cortar con
    // una pregunta que ignora el hilo. GENERALIZACIÓN (Etapa 3): simulateGeneral ya soporta cliente/sku/marca/
    // familia (toolContracts.js) — el filtro `dimension==="cliente"` de acá era un residuo de simulate v1, ya
    // stale; se amplía a cualquiera de los 4 ejes que el motor realmente soporta.
    if (scenarioIntent.kind === "no_entity") {
      const recoverable = recentSubjectsPrev.find((s) => s && s.entidad && (s.dimension == null || ["cliente", "sku", "marca", "familia"].includes(s.dimension)));
      if (!recoverable) {
        const out = _composedBypassResult("¿Sobre qué cliente, SKU, marca o familia querés simular este escenario?", mem, recentNarrationsPrev, scenario);
        if (out) return out;
      }
    }
    // "future": campo+% inequívoco Y una entidad conocida — la falla #1 (nunca entraba a simulateGeneral) y la
    // falla #2 (alcance perdido) son estructuralmente imposibles acá: la entidad la puso este detector determinístico,
    // nunca el LLM. Arma pendingSimulation directo (mismo shape que el camino existente) y pregunta SOLO lo que falta.
    if (scenarioIntent.kind === "future") {
      const { entity, dimension, variable } = scenarioIntent;
      const missingCampo = variable.campo === "precioLista" ? "unidades" : "precioLista";
      const pregunta = missingCampo === "precioLista" ? "¿cuánto esperás que cambie el precio?" : "¿cuánto esperás que cambie el volumen o las unidades vendidas?";
      const out = _composedBypassResult(`${pregunta} No quiero asumir que se mantiene sin cambios, sin que me lo confirmes.`, mem, recentNarrationsPrev, scenario);
      if (out) {
        out.mem = { ...out.mem, pendingSimulation: { dimension: dimension || "cliente", entity, entities: [entity], known: variable, missingCampo } };
        return out;
      }
    }
    // "future_multi" (Etapa 3, owner 2026-08-03 — CASO OBLIGATORIO: "¿Qué pasa si subo 3% el precio de estos SKU?"
    // tras un turno que ya estableció 3 SKU puntuales) — campo+% inequívoco, NINGUNA entidad nombrada en el texto,
    // pero un deíctico plural inequívoco Y un conversationScope.current ESTRUCTURADO (nunca prosa) con 1+
    // entidades — scenarioIntent.js ya hizo el match; acá SOLO se arma pendingSimulation con las N entidades y se
    // pregunta EXACTAMENTE lo mismo que en "future" (SOLO la variable faltante — nunca cliente, nunca una por
    // entidad: "preguntar SOLO por el supuesto realmente faltante", pedido explícito del owner).
    if (scenarioIntent.kind === "future_multi") {
      const { entities, dimension, variable } = scenarioIntent;
      const missingCampo = variable.campo === "precioLista" ? "unidades" : "precioLista";
      const pregunta = missingCampo === "precioLista" ? "¿cuánto esperás que cambie el precio?" : "¿cuánto esperás que cambie el volumen o las unidades vendidas?";
      const out = _composedBypassResult(`${pregunta} No quiero asumir que se mantiene sin cambios, sin que me lo confirmes.`, mem, recentNarrationsPrev, scenario);
      if (out) {
        out.mem = { ...out.mem, pendingSimulation: { dimension: dimension || "cliente", entity: entities[0], entities, known: variable, missingCampo } };
        return out;
      }
    }
    // "historical"/"none": nunca se activa una simulación — "historical" es una LECTURA del dato ya ocurrido
    // ("el precio subió 8%"), "none" es cualquier otro turno normal (incluye el caso YA cubierto por PLAN: precio
    // Y volumen mencionados en la misma frase). plan sigue null, cae de largo a PLAN normal sin tocar nada.
  }

  // pendingEntities (Etapa 3): forma canónica plural — `pendingSimulationPrev.entities`, con `.entity` (singular,
  // pendientes viejos persistidos antes de Etapa 3) como fallback. 1 entidad → scope.level="entity" (BYTE-IGUAL al
  // comportamiento anterior a Etapa 3, ver el call único con `entity` puesto). 2+ → scope.level="list": el call
  // ÚNICO (sin `entity`) deja que el backstop de Etapa 2 (applyMultiEntityScope, más abajo) haga el fan-out a N
  // calls — mismo mecanismo ya probado para "de esos SKU, armame la tabla", ahora también para simular.
  const pendingEntities = pendingSimulationPrev
    ? ((Array.isArray(pendingSimulationPrev.entities) && pendingSimulationPrev.entities.length) ? pendingSimulationPrev.entities : (pendingSimulationPrev.entity ? [pendingSimulationPrev.entity] : []))
    : [];
  let plan = (priorOffer && priorOffer.tool && isAcceptance(q))
    ? { intent: "answer", mode: "seguimiento", rationale: "oferta aceptada (ejecución estructurada)", scope: priorOffer.entidad ? { level: "entity", entities: [priorOffer.entidad] } : { level: "global" }, calls: [{ tool: priorOffer.tool, args: priorOffer.args || {} }] }
    : (subjectRecall && subjectRecall.kind === "resolved")
    ? { intent: "answer", mode: "seguimiento", rationale: "retorno a tema reciente (referencia posicional)", scope: { level: "entity", entities: [subjectRecall.subject.entidad] }, calls: [{ tool: "entityProfile", args: { dimension: subjectRecall.subject.dimension || "cliente", entity: subjectRecall.subject.entidad } }] }
    : (resolvedPendingSim && pendingEntities.length > 1)
    ? { intent: "answer", mode: "simulacion", rationale: "simulación pendiente resuelta (variable faltante contestada, múltiples entidades)", scope: { level: "list", entities: pendingEntities, dimension: pendingSimulationPrev.dimension }, calls: [{ tool: "simulateGeneral", args: { dimension: pendingSimulationPrev.dimension, ...resolvedPendingSim } }] }
    : (resolvedPendingSim && pendingEntities.length === 1)
    ? { intent: "answer", mode: "simulacion", rationale: "simulación pendiente resuelta (variable faltante contestada)", scope: { level: "entity", entities: pendingEntities }, calls: [{ tool: "simulateGeneral", args: { dimension: pendingSimulationPrev.dimension, entity: pendingEntities[0], ...resolvedPendingSim } }] }
    : null;
  // conversationScope (Etapa 1) solo interviene sobre un plan REAL de PLAN — los planes sintéticos de arriba
  // (oferta aceptada / retorno posicional / simulación pendiente) ya resolvieron su propio scope de forma
  // determinística por otros mecanismos ya probados (dialogueState.js) — no se les superpone un segundo criterio.
  const planWasSynthetic = !!plan;

  // ── PASADA 1 · PLAN (con reintentos · 3 intentos máx, MISMO patrón que el retry de NARRAR más abajo) ── se salta
  // ENTERA cuando la ruta de aceptación de arriba ya resolvió el plan.
  // hallazgo del re-barrido de 17 turnos (owner 2026-07-29): a diferencia de NARRAR, el plan NO reintentaba — un
  // JSON malformado del tool_call (el adapter de OpenAI tira "JSON inválido del tool_call: …", ver
  // src/adi/llm/adapters/openai.js) tumbaba el turno ENTERO al fallback en el primer intento, sin darle a C ni una
  // segunda chance. La mayoría de estos fallos son variance de sampling del LLM (el MISMO tool_choice forzado sobre
  // el MISMO schema casi siempre da JSON válido al reintentar) — reintentar recupera la mayoría sin debilitar nada:
  // el plan sigue validado por el schema forzado, y si los 3 intentos fallan, C se abstiene igual que antes.
  // planAttemptTrace (owner 2026-08-02, router de modelo — ver modelRouter.js): registro liviano de cada intento,
  // NO decide nada acá (el router server-side decide el modelo por `attempt` en handlePlan) — solo queda observable
  // por turno junto con el resto de la telemetría de ruteo (ver `routing` en ChatADI.jsx).
  // `usage` (owner 2026-08-03, Fase 0 instrumentación/eficiencia de Mini): antes NINGUNA entrada del trace guardaba
  // tokens, ni siquiera el intento que SÍ tuvo éxito — imposible medir costo real por intento/turno desde acá. Lectura
  // DEFENSIVA (`p && p.usage`, nunca inventa 0): el contrato de callPlan (ver comentario de imports, arriba) devuelve
  // el plan PELADO (mismo shape que hoy, byte-exacto — no se toca para no romper los ~30 gates/callers existentes que
  // ya lo consumen así); si algún caller decide en el futuro adjuntar `.usage` al plan devuelto (ej. ChatADI.jsx
  // podría hacerlo con una propiedad no-enumerable, invisible a JSON.stringify/spread, para no filtrar nada al
  // payload de NARRAR), esta lectura ya lo capturaría sin más cambios acá. Sin ese cableado, queda `null` — honesto,
  // nunca un cero fingido — no es una promesa de que HOY viaje, es la plomería lista para cuando viaje.
  const planAttemptTrace = [];
  if (!plan) {
    let modelAttempt = 0;   // ver "CONTADOR DE MODELO ≠ CONTADOR DE BACKOFF" arriba — NUNCA avanza ante un 429/error de infra
    for (let attempt = 0; attempt < 3; attempt++) {
      let p;
      try { p = await callPlan({ text: q, history, mem, scenario, requestContext, attempt: modelAttempt }); }
      catch (e) {
        const rateLimited = e && e.code === "rate_limited";
        planAttemptTrace.push({ attempt, ok: false, reason: rateLimited ? "rate_limited (429)" : "error de red/gateway", usage: null });
        const wait = _rateLimitBackoffMs(e);
        if (wait) await _sleep(wait);
        if (!rateLimited && _isPlanContentError(e)) modelAttempt++;   // JSON inválido/sin tool_call → SÍ es calidad, escala
        continue;
      }
      if (!p || !p.intent) { planAttemptTrace.push({ attempt, ok: false, reason: "plan inválido/sin intent", usage: (p && p.usage) || null }); modelAttempt++; continue; }
      // BACKSTOP · calls vacío en un redirect (owner 2026-07-31, hallazgo en vivo, auditoría integral) —
      // planPrompt.js ya prohíbe esto EXPLÍCITAMENTE ("no dejes calls vacío: replanteá y traé el dato bueno"), pero
      // medido en ~1/3 de las corridas el LLM lo deja vacío igual. Sin ninguna cifra autorizada, NARRATE a veces
      // redacta con placeholders sin rellenar ("...un potencial de $X...") — guardC ya los bloquea aparte (ver
      // _placeholderSinRellenar en guardC.js), pero es mejor evitar el turno roto ANTES: tratamos esto como un
      // intento fallido y reintentamos (mismo presupuesto de 3, no uno extra) — casi siempre el reintento SÍ
      // puebla calls (variance de sampling). Si los 3 intentos insisten en calls vacío, seguimos con el ÚLTIMO
      // plan de todos modos (nunca null acá) — el resto del pipeline (guardC + la reparación de full scope) sigue
      // siendo la red de seguridad si NARRATE igual redacta algo roto.
      plan = p;
      if (p.intent === "redirect" && !(Array.isArray(p.calls) && p.calls.length)) { planAttemptTrace.push({ attempt, ok: false, reason: "redirect sin calls", usage: (p && p.usage) || null }); modelAttempt++; continue; }
      planAttemptTrace.push({ attempt, ok: true, usage: (p && p.usage) || null });
      break;
    }
    if (!plan) return null;
  }

  // ── CONTINUIDAD CONVERSACIONAL UNIVERSAL (Etapa 1, ver conversationScope.js) ── backstop DETERMINÍSTICO, mismo
  // principio y misma precedencia que el resto de _coerce* de este archivo: PLAN es el mecanismo PRINCIPAL (puede
  // interpretar la expresión libre), esto SOLO corrige el patrón inequívoco cuando PLAN se quedó sin nada resoluble
  // en scope.entities (o el texto trae un deíctico/ordinal que PLAN no tiene forma de resolver sin este dato
  // estructurado). Corre ANTES del batch — si la referencia es ambigua o rechazable, corta acá, igual que la
  // aceptación huérfana/retorno ambiguo de arriba (nunca gasta un batch/narración sobre una referencia sin resolver).
  if (!planWasSynthetic) {
    const scopeRef = resolveConversationReference(q, plan, conversationScopePrev, requestContext, uiSignals);
    if (scopeRef.kind === "ambiguous") {
      const composed = composeReferenceAmbiguity(scopeRef.options);
      const out = _composedBypassResult(composed, mem, recentNarrationsPrev, scenario);
      if (out) return out;
    } else if (scopeRef.kind === "decline") {
      const composed = composeReferenceDecline(scopeRef.reason);
      const out = _composedBypassResult(composed, mem, recentNarrationsPrev, scenario);
      if (out) return out;
    } else if (scopeRef.kind === "resolved") {
      plan = { ...plan, scope: { level: scopeRef.entities.length > 1 ? "list" : "entity", entities: scopeRef.entities } };
    }
  }

  // `calls` puede faltar en intent=ack/define (el modelo lo omite cuando no pide datos) → default [] (NO es abstención).
  // OJO: `plan` se REEMPLAZA (no solo la variable local `calls`) — buildNarrateUserMessageC recibe `plan` completo
  // más abajo, y si solo corregíamos la variable suelta, el narrador seguía viendo plan.calls SIN corregir (bug real
  // cazado en el propio testing de este fix: el batch corría bien pero el narrador quedaba desincronizado del dato).
  const hasThread = (Array.isArray(history) && history.length > 0) || recentNarrationsPrev.length > 0 || !!priorOffer;
  plan = { ...plan, calls: _coerceEntityScopedFilters(plan, _coerceTensionArgs(q, Array.isArray(plan.calls) ? plan.calls : [])), mode: _coerceMode(q, plan, hasThread, recentSubjectsPrev) };
  // CONTINUIDAD CONVERSACIONAL UNIVERSAL · Etapa 3 (ver toolContracts.js:applySingleEntityScope) — corre DESPUÉS de
  // _coerceEntityScopedFilters (arriba, sin tocar) para cubrir las tools que ese mecanismo pre-Etapa-3 no alcanza
  // (entityProfile/entityRecord/trend/gridTable/tensionRead/inventoryStatus) cuando el scope ya trae EXACTAMENTE 1
  // entidad resuelta (por PLAN o por conversationScope Etapa 1, ej. "profundiza en el primero") — nunca pisa una
  // call que _coerceEntityScopedFilters ya dejó bien acotada.
  plan = { ...plan, calls: applySingleEntityScope(plan, plan.calls) };

  // ── CONTINUIDAD CONVERSACIONAL UNIVERSAL · Etapa 2 (ver toolContracts.js) ── backstop DETERMINÍSTICO, mismo
  // principio y misma precedencia que el resto de _coerce*/bypasses de este archivo: corre SOLO cuando el scope
  // (ya resuelto arriba, por PLAN mismo o por conversationScope Etapa 1) trae 2+ entidades (plan.scope.level="list")
  // — el caso de 0-1 entidad sigue exactamente igual que antes (_coerceEntityScopedFilters arriba, sin cambios).
  // Puebla args.entityScope/args.entities o expande a N calls SEGÚN EL CONTRATO de cada tool — nunca fuerza una
  // tool que genuinamente no admite una lista: ahí CORTA acá mismo (igual que ambiguous/decline arriba), con una
  // pregunta que EXPLICA y OFRECE una alternativa concreta, nunca cambia de eje/entidad en silencio.
  if (plan.scope && plan.scope.level === "list" && Array.isArray(plan.scope.entities) && plan.scope.entities.length > 1) {
    const multiScope = applyMultiEntityScope(plan, plan.calls, maxCalls);
    if (multiScope.decline) {
      const out = _composedBypassResult(multiScope.decline, mem, recentNarrationsPrev, scenario);
      if (out) return out;
    } else if (Array.isArray(multiScope.calls)) {
      plan = { ...plan, calls: multiScope.calls };
    }
  }
  // ── LECTURA EJECUTIVA · perfil/avance/estado/resumen de UNA entidad (owner 2026-08-06/07) ── backstop
  // DETERMINÍSTICO, mismo principio que el resto de _coerce*/bypasses de este archivo: planPrompt.js
  // (entityProfile) YA pide sumar trend{dimension,entity} sin period cuando el usuario pide EXPLÍCITAMENTE el
  // perfil de una entidad — medido en vivo (_probe_perfil_ejecutivo_live.mjs, 2/2 corridas) que el LLM no lo
  // hace, se queda en entityProfile solo (el mismo patrón de "el LLM no siempre seguía la doctrina sola" que
  // motivó el resto de estos backstops). Si el texto trae la palabra Y el plan ya resolvió entityProfile para
  // una entidad pero no trae trend de esa MISMA entidad, se agrega acá — mismo dimension/entity que
  // entityProfile YA resolvió (nunca adivina un eje nuevo), sin period (la foto completa del año: mejor/peor
  // mes + variación, lo que a la lectura ejecutiva le faltaba).
  // COMPOSICIÓN + CAPITAL LIGADO (owner 2026-08-07, "familias que más compran, productos... capital ligado a su
  // mix"): SOLO eje cliente (entityComposicion/entityCapitalLigado no soportan otro eje, ver specRetrieval.js) —
  // mismo criterio "agregá lo que falta, sin pisar lo que el plan ya trajo" que trend arriba.
  if (_WANTS_PERFIL_RE.test(String(q || "")) && Array.isArray(plan.calls)) {
    const epCall = plan.calls.find((c) => c && c.tool === "entityProfile");
    const dimension = epCall && (epCall.dimension || (epCall.args && epCall.args.dimension));
    const entity = epCall && (epCall.entity || (epCall.args && epCall.args.entity));
    if (epCall && entity) {
      let extra = [];
      const hasTrend = plan.calls.some((c) => c && c.tool === "trend" && (c.entity || (c.args && c.args.entity)) === entity);
      if (!hasTrend) extra.push({ tool: "trend", args: { dimension: dimension || "cliente", entity } });
      if (dimension === "cliente" || !dimension) {
        const hasComposicion = plan.calls.some((c) => c && c.tool === "entityComposicion" && (c.entity || (c.args && c.args.entity)) === entity);
        if (!hasComposicion) extra.push({ tool: "entityComposicion", args: { dimension: "cliente", entity } });
        const hasCapitalLigado = plan.calls.some((c) => c && c.tool === "entityCapitalLigado" && (c.entity || (c.args && c.args.entity)) === entity);
        if (!hasCapitalLigado) extra.push({ tool: "entityCapitalLigado", args: { dimension: "cliente", entity } });
      }
      const room = Math.max(0, maxCalls - plan.calls.length);
      if (room > 0 && extra.length) plan = { ...plan, calls: [...plan.calls, ...extra.slice(0, room)] };
    }
  }
  const calls = plan.calls;

  // ── supuestos_faltantes → request_clarification (owner 2026-07-31, #56 "simulate v2") ── PLAN detectó un pedido
  // de simulación de 2 variables con UNA sola nombrada (ver planPrompt.js) — esto corta ANTES del batch, sin tocar
  // el dato, mismo principio de garantía-por-construcción que la aceptación huérfana/retorno ambiguo de arriba:
  // nunca se narra libre una pregunta de aclaración (el LLM podría inventar qué falta o asumir 0% en silencio).
  // ver _silentZeroSupuestoFaltante arriba: red determinística para cuando el LLM, en vez de usar
  // supuestos_faltantes, asume 0% en silencio en la variable que el usuario no nombró — hallazgo EN VIVO, no
  // hipotético. El LLM manda (mecanismo principal); esto es SOLO la red, igual que el resto de _coerce* del archivo.
  const supuestosFaltantes = _hasCompleteSimulateVars(calls)
    ? null
    : (Array.isArray(plan.supuestos_faltantes) && plan.supuestos_faltantes.length)
    ? plan.supuestos_faltantes
    : _silentZeroSupuestoFaltante(q, calls);
  if (supuestosFaltantes && supuestosFaltantes.length) {
    // el texto lo redacta el LLM del PLAN (o la red, si el LLM asumió 0% en silencio) — no una prosa fija
    // nuestra, así que pasa por el MISMO lavado de registro que la Pasada 2 (nunca "plata"/"dormido"/relleno),
    // aunque nunca llegue a invocar al narrador libre.
    const composed = stripFiller(stripLanguageLeaks(supuestosFaltantes.join(" ")));
    const out = _composedBypassResult(composed, mem, recentNarrationsPrev, scenario);
    if (out) {
      // mem.pendingSimulation: guarda la variable YA conocida + cuál falta, para que el turno SIGUIENTE la
      // resuelva determinísticamente (ver el bloque grande más arriba) en vez de depender de que PLAN reconstruya
      // entidad+variables del texto crudo de la ventana de historia. _composedBypassResult ya la limpia por
      // defecto — acá la restauramos SOLO si se pudo armar (si no, queda null, comportamiento sin cambios).
      out.mem = { ...out.mem, pendingSimulation: _buildPendingSimulation(q, plan) };
      return out;
    }
  }

  // mecanismo dominante por entidad ESTABLECIDO en turnos ANTERIORES (owner 2026-07-29, residual 3: "si un turno ya
  // estableció mecanismo dominante por entidad, el siguiente no debe recomendar otro sin evidencia nueva o sin
  // explicitar el cambio"). Se lee del `mem` ORIGINAL, ANTES de applyMemoryUpdate — ese helper reconstruye su
  // salida desde una lista fija de campos (identidad/preferencias/contexto/estado) y NO preserva claves ajenas,
  // así que leer de `mem2` perdería mechanismByEntity en cualquier turno donde el LLM además emita un memoryUpdate.
  const mechanismMemory = (mem && typeof mem.mechanismByEntity === "object" && mem.mechanismByEntity) || {};
  // NIVEL DE ACLARACIÓN (Fase 2, capa de rol conversacional): cuenta turnos CONSECUTIVOS en mode=clarify — si el
  // usuario sigue confundido después de la primera simplificación, el contrato de clarify escala a "cero cifras +
  // ejemplo concreto" (ver conversationalContract.js). Se lee del `mem` ORIGINAL por la MISMA razón que
  // mechanismMemory (applyMemoryUpdate no preserva claves ajenas). Se resetea a 0 en cualquier turno que NO sea
  // clarify — la próxima vez que el usuario pida aclaración, empieza de nuevo en nivel 1, no sigue escalando.
  const clarifyStreakPrev = (mem && typeof mem.clarifyStreak === "number") ? mem.clarifyStreak : 0;
  const clarifyStreakNow = plan.mode === "clarify" ? clarifyStreakPrev + 1 : 0;
  plan = { ...plan, clarifyStreak: clarifyStreakNow };

  // PREFERENCIA DE RESPUESTA (owner 2026-07-29: eje DISTINTO de `mode` — ver responsePreference.js). Se lee la
  // preferencia de SESIÓN del `mem` ORIGINAL (misma razón que mechanismMemory/clarifyStreak arriba: applyMemoryUpdate
  // no preserva claves ajenas). `turnPref` es SOLO lo que este turno pidió (LLM + red determinística de arriba) — si
  // es null, este turno no dijo nada de formato y hereda la sesión. `pref` (efectivo) = turno > sesión > default;
  // NUNCA se escribe en mem2 salvo que el turno pida persist=true (requisito "no arrastres accidentalmente data_only
  // al turno siguiente" — el default es no-contaminación, la sesión solo cambia cuando se lo piden explícitamente).
  const sessionPrefPrev = (mem && mem.responsePref && typeof mem.responsePref === "object") ? mem.responsePref : null;
  const turnPref = _coercePref(q, plan);
  const pref = {
    contentScope: (turnPref && turnPref.contentScope) || (sessionPrefPrev && sessionPrefPrev.contentScope) || "full",
    detailLevel: (turnPref && turnPref.detailLevel) || (sessionPrefPrev && sessionPrefPrev.detailLevel) || "standard",
  };

  // memoria de interacción (trato/identidad) — se aplica ANTES de narrar
  let mem2 = plan.memoryUpdate ? applyMemoryUpdate(mem, plan.memoryUpdate) : mem;
  // se lo devolvemos explícito a mem2 (no solo a las variables de arriba): mem2 es lo que ve el NARRADOR (mem: mem2
  // más abajo, durante los 3 intentos) — sin esto, un turno con memoryUpdate hacía que el narrador narrara SIN saber
  // qué mecanismo/nivel de aclaración ya estaba establecido, aunque guardC sí lo chequeara bien por separado.
  if (Object.keys(mechanismMemory).length) mem2 = { ...mem2, mechanismByEntity: mechanismMemory };
  mem2 = { ...mem2, clarifyStreak: clarifyStreakNow };
  // pendingSimulation SIEMPRE se limpia acá, por defecto (mismo motivo que mechanismByEntity/clarifyStreak arriba:
  // applyMemoryUpdate no preserva claves ajenas cuando el LLM además emite un memoryUpdate) — este turno YA la
  // consumió (resolvedPendingSim la resolvió, ver el plan sintético de arriba) o la abandonó (el texto no la
  // contestaba) — en NINGÚN caso de los que llegan hasta acá corresponde que sobreviva al turno siguiente.
  mem2 = { ...mem2, pendingSimulation: null };
  if (sessionPrefPrev) mem2 = { ...mem2, responsePref: sessionPrefPrev };   // sobrevive applyMemoryUpdate, igual que mechanismByEntity
  if (turnPref && turnPref.persist) mem2 = { ...mem2, responsePref: { contentScope: pref.contentScope, detailLevel: pref.detailLevel } };
  // Fase 3 (owner 2026-07-30): lastOffer/recentSubjects sobreviven applyMemoryUpdate por la MISMA razón de arriba —
  // si no, el narrador (mem: mem2 en el loop de abajo) perdería de vista la oferta/temas recientes en CUALQUIER
  // turno donde el LLM además emita un memoryUpdate, una inconsistencia dependiente de un codepath ajeno. Ambos se
  // sobrescriben con el valor FRESCO de este turno más abajo (lastOffer siempre recalculado, nunca heredado).
  // Etapa 4: estos 2 campos son el shim que getLastOffer/getRecentSubjects (dialogueState.js) leen cuando el lado
  // canónico (conversationScope) todavía NO tiene el valor fresco de ESTE turno — para lastOffer, ese es
  // exactamente el caso durante la Pasada 2/NARRAR de más abajo (conversationScopeNow.current.ofertaPendiente
  // recién se escribe DESPUÉS de que `narration` exista, ver el bloque junto a lastOfferNow) — priorOffer acá
  // sigue siendo el valor CORRECTO para ese instante (la oferta del turno ANTERIOR, que es lo que NARRATE debe
  // conocer), no un dato viejo que haya que descartar.
  if (priorOffer) mem2 = { ...mem2, lastOffer: priorOffer };
  if (recentSubjectsPrev.length) mem2 = { ...mem2, recentSubjects: recentSubjectsPrev };
  // conversationScope (Etapa 1) — misma reinyección defensiva que lastOffer/recentSubjects arriba (redundante con
  // el fix de applyMemoryUpdate en persona.js, pero se deja por consistencia/robustez ante un futuro revert de ese
  // fix). Se sobrescribe con el valor FRESCO de este turno más abajo, junto a recentSubjectsNow.
  if (conversationScopePrev.current || conversationScopePrev.history.length) mem2 = { ...mem2, conversationScope: conversationScopePrev };

  // ── BATCH DETERMINÍSTICO ──
  // `unsupported` (owner 2026-07-31, evidenceSpec) — runPlan YA lo arma (coverage/unsupported por call) pero antes
  // se descartaba acá mismo, al desestructurar solo {ledger,results,trace}: buildOracleEvidence (más abajo) nunca
  // podía saber qué faltó. Se hila hasta el evidence del turno como `evidenceSpec.missing` — CERO cambio de
  // comportamiento del turno (el LLM/guard no lo consumen), solo deja de tirarse un dato que el motor ya calculó.
  const { ledger, results, trace, unsupported } = runPlan({ intent: plan.intent, calls }, { scenario, maxCalls });
  const figs = ledgerBoleta(ledger);

  // temas recientes (Fase 3) — se deriva DESPUÉS de que plan.scope ya está resuelto (por comprensión, como
  // siempre); señal para el LLM, nunca autoridad (ver dialogueState.js). No depende de `results`, pero vive acá,
  // junto al resto del estado post-plan que sobrevive hasta el return final.
  const recentSubjectsNow = updateRecentSubjects(recentSubjectsPrev, plan, calls, history.length);
  mem2 = { ...mem2, recentSubjects: recentSubjectsNow };   // shim de compatibilidad (Etapa 4) — ver dialogueState.js:getRecentSubjects
  // conversationScope (Etapa 1) — MISMO punto de derivación que recentSubjectsNow (post-batch, plan.scope YA
  // resuelto): a diferencia de recentSubjects (señal para el LLM), conversationScope SÍ es la fuente de verdad que
  // resolveConversationReference lee el turno SIGUIENTE — por eso se deriva de `results` (boleta estructurada),
  // nunca de la prosa que NARRAR todavía no escribió a esta altura.
  const conversationScopeNow = updateConversationScope(conversationScopePrev, { plan, calls, results, turno: history.length, requestContext });
  // Etapa 4 (owner 2026-08-04) — dual-write: recentSubjectsNow se escribe TAMBIÉN como key hermana física dentro
  // de conversationScope (root.recentSubjects, ver el comentario de ConversationScopeEntry en conversationScope.js)
  // en el MISMO instante que el shim de arriba — nunca 2 fuentes que puedan divergir. Se computa ANTES de NARRAR
  // (a diferencia de ofertaPendiente/lastOffer, que solo existen DESPUÉS de que la narración exista), así que acá
  // sí queda correctamente poblado para la lectura mid-turno de NARRATE (getRecentSubjects vía persona.js).
  mem2 = { ...mem2, conversationScope: { ...conversationScopeNow, recentSubjects: recentSubjectsNow } };

  // sellos para el guard (requisitos 3 y 4, pase quirúrgico 2026-07-29) — SIEMPRE del resultado real del batch, no
  // dependen de qué tool haya corrido (generaliza a cualquier plan futuro sin tocar este bloque de nuevo).
  const periodos = periodosEsperados(results);
  const sealedOrders = [];
  for (const r of results) {
    if (r && r.facts) {
      if (r.facts.orden) sealedOrders.push(r.facts.orden);
      if (r.facts.ordenA) sealedOrders.push(r.facts.ordenA);
      if (r.facts.ordenB) sealedOrders.push(r.facts.ordenB);
    }
  }

  // ── RUTA DETERMINÍSTICA (requisito 1) — se intenta ANTES de gastar la llamada de narrar; si no aplica o el
  // propio guard no la valida (indicaría un bug de construcción, nunca variance de LLM — reintentar con el MISMO
  // texto siempre daría el mismo resultado), cae de largo a la Pasada 2 de siempre, sin penalidad.
  let narration = null;
  let deterministic = false;
  let narrationRepaired = false;
  const simple = _simpleEntityMetric(q, plan, calls, results);
  if (simple) {
    const detRaw = pref.detailLevel === "brief" ? truncateToBriefBudget(_rutaDeterministica(pref, simple)) : _rutaDeterministica(pref, simple);
    // periodosEsperados(results) refleja el período estampado POR TOOL (toolRunner.js: entityRecord → "año
    // cerrado" siempre) — pero `simple.periodo` puede haber sido corregido POR CAMPO (ver _SNAPSHOT_TOKENS arriba:
    // stockUSD/rotación/DOH de un SKU son una FOTO a hoy, no un acumulado anual, aunque la tool sea entityRecord).
    // Usar el `periodos` genérico acá agregaría una cláusula "(Datos del año cerrado.)" CONTRADICTORIA al lado de
    // la oración que ya dice "a la fecha de hoy" — derivamos la familia esperada del MISMO periodo ya resuelto
    // para esta cita puntual, no del genérico de toda la tool-call.
    const periodosSimple = /a[nñ]o cerrado/i.test(simple.periodo || "") ? ["anual"] : /foto.*hoy/i.test(simple.periodo || "") ? ["hoy"] : periodos;
    const det = ensurePeriodoDeclared(detRaw, periodosSimple);
    if (guardC(det, { ledger, results, trace, question: q, mechanismMemory, sealedOrders }).ok) { narration = det; deterministic = true; }
  }

  // ── data_only / results_only: GARANTÍA POR CONSTRUCCIÓN, SIN EXCEPCIÓN (owner 2026-07-29, residuales 2 y 3) ──
  // "[[DATOS]] Ventas: $100M. Te recomiendo renegociar con Falabella." — una etiqueta correcta no garantiza que el
  // CONTENIDO adentro sea del tipo correcto; el renderer de bloques por sí solo NO cierra ese hueco. La única forma
  // de que "no puede pasar" sea LITERALMENTE cierta para estos dos alcances es no darle al narrador NINGUNA
  // oportunidad de escribir prosa libre, en NINGÚN caso: Pasada 2 NUNCA se invoca acá — cero superficie lingüística.
  // Se resuelve ACÁ, siempre, sin caer más abajo al loop de narrar (esa condición lo excluye explícitamente):
  //   1. composeFromLedger — hay figs autorizadas → las compone en tabla.
  //   2. composeNoDataMessage — la boleta vino vacía (tool declinó, o el turno no trajo datos) → antes esto cedía
  //      al narrador libre como última red (el residual 3: "bajo data_only o results_only, nunca debe volver al
  //      narrador libre"); ahora responde determinísticamente que no hay información autorizada suficiente,
  //      citando la razón REAL si algún tool ya la declaró, y cierra pidiendo la precisión que falta — nunca
  //      inventa, nunca se abstiene en silencio.
  if (!narration && (pref.contentScope === "data_only" || pref.contentScope === "results_only")) {
    const composed = composeFromLedger(figs, pref.contentScope) || composeNoDataMessage(results);
    const c = ensurePeriodoDeclared(composed, periodos);
    if (guardC(c, { ledger, results, trace, question: q, mechanismMemory, sealedOrders }).ok) { narration = c; narrationRepaired = true; }
  }

  // ── ORIENTACIÓN INICIAL MID-CONVERSACIÓN (Fase 3, la tarea que la nombra) — disparador DETERMINÍSTICO (mismo
  // principio que _coerceMode/_coercePref: red angosta para frases inequívocas, nunca el mecanismo principal).
  // Se computa ACÁ, no antes: necesita clarifyStreakNow (ya resuelto arriba) y recentSubjectsNow (recién derivado
  // post-BATCH) — su único consumidor es el payload de NARRAR, vive pegado a ese uso (mismo criterio que `simple`
  // más arriba, pegado a la ruta determinística).
  const orientacionReason = needsOrientacion(q, clarifyStreakNow);
  const instruccionOrientacion = buildOrientacionInstruction(orientacionReason, recentSubjectsNow);

  // ── PASADA 2 · NARRAR (con DOS reintentos · 3 intentos máx) ── alcanza SOLO full y action_only: data_only/
  // results_only YA se resolvieron arriba, SIEMPRE (con datos o sin ellos) — la condición de abajo los excluye
  // explícitamente para que "nunca invoca al narrador" sea cierto también en el caso límite de boleta vacía.
  // Un rechazo del guard suele ser VARIANCE del LLM (una cifra derivada, una atribución yuxtapuesta). Re-muestrear
  // recupera la mayoría de esos turnos SIN debilitar el muro (el guard valida cada intento igual). El 2º reintento
  // solo se dispara cuando los dos primeros fallaron —los casos difíciles (temporal por entidad, cruces)— donde
  // recuperar una respuesta LIMPIA de C vale más que caer al fallback. Solo si los TRES fallan, C se abstiene.
  // narrateAttemptTrace (owner 2026-08-02, router de modelo — ver modelRouter.js): registro liviano del veredicto
  // de guardC por intento — el router server-side (handleNarrateC) escala de modelo cuando el turno vuelve a pasar
  // por acá, precisamente PORQUE guardC rechazó el intento anterior. Esto es lo que hace observable ese "resultado
  // del guard" por turno (ver `routing` en ChatADI.jsx, que lo cruza con modelo/latencia/costo del fetch).
  // `usage` (owner 2026-08-03, Fase 0 instrumentación/eficiencia de Mini): a diferencia de PLAN (`p` es un objeto,
  // ver arriba), el contrato de callNarrate devuelve la narración PELADA como STRING (`typeof n !== "string"` se
  // valida más abajo) — un primitivo no puede cargar una propiedad `.usage`. Capturar tokens acá de verdad exigiría
  // cambiar esa firma (string → {text,usage}) en los ~30 gates/callers existentes que hoy la consumen como string —
  // eso es una ruptura de contrato real, fuera del alcance "riesgo cero" de esta fase. Se deja `usage: null` en cada
  // entrada (honesto, no un cero fingido) para que el SHAPE del trace sea uniforme con planAttemptTrace; la telemetría
  // real de NARRAR (que SÍ existe, ver `usage` en la respuesta de handleNarrateC) hoy solo es observable vía
  // `routingTrace`/`_onRouted` en ChatADI.jsx, no vía este trace — cambiar eso es una decisión de contrato del owner.
  const narrateAttemptTrace = [];
  // bestDegraded (owner 2026-08-03, cierre de la investigación de repetición — ver guardC.js/_repetitionVerbatim):
  // guarda la ÚLTIMA narración que pasó guardC (ok=true) pero salió marcada `degraded` (repite un tramo verbatim de
  // 8+ palabras de una narración propia reciente) — NUNCA se acepta de inmediato (el loop sigue reintentando, dando
  // a la escalada de modelo mini→terra→sol una chance real de producir algo fresco), pero si los 3 intentos quedan
  // TODOS degradados, usar la mejor disponible es preferible a caer a la reparación genérica de más abajo (que
  // reemplazaría una respuesta VÁLIDA — guardC ya la validó igual que cualquier otra — por un "no tengo información"
  // peor, solo porque no logró variar la redacción en las 3 ventanas de reintento disponibles).
  let bestDegraded = null;
  let narrationDegraded = false;
  let modelAttempt = 0;   // ver "CONTADOR DE MODELO ≠ CONTADOR DE BACKOFF" (arriba, junto a _rateLimitBackoffMs) — NUNCA avanza ante un 429/error de infra
  if (!narration && pref.contentScope !== "data_only" && pref.contentScope !== "results_only") for (let attempt = 0; attempt < 3; attempt++) {
    let n;
    // hallazgo de auditoría (owner 2026-08-02, router de modelo): un `return null` acá aborta el TURNO ENTERO al
    // primer error de red — antes del router, los 3 intentos eran SIEMPRE el mismo modelo, así que un error acá
    // era casi siempre sistémico (sin sentido reintentar). Con el router, el intento 1/2 escala a un modelo NUEVO
    // (terra/sol) nunca antes ejercitado por tráfico real de NARRAR — un modelo mal configurado, sin cupo, o con un
    // hiccup transitorio en ESE intento específico no debe tirar el turno completo: reintenta (mismo presupuesto de
    // 3, mismo patrón que el loop de PLAN arriba) y, si los 3 fallan, cae a la reparación controlada de más abajo
    // (nunca abstención silenciosa) en vez de perder el turno entero por un solo intento fallido.
    try { n = await callNarrate({ text: q, plan, results, ledgerFigs: figs, mem: mem2, history, requestContext, pref, instruccionOrientacion, attempt: modelAttempt }); }
    catch (e) {
      narrateAttemptTrace.push({ attempt, guardOk: null, reason: "error de red/gateway: " + (e && e.message), usage: null });
      const wait = _rateLimitBackoffMs(e);
      if (wait) await _sleep(wait);
      // TIER: NARRAR no tiene un "JSON inválido" propio (devuelve texto plano, no un tool_call) — cualquier
      // excepción acá (429 u otro error de red/gateway) es SIEMPRE infraestructura, nunca escala el tier.
      continue;
    }
    if (!n || typeof n !== "string" || !n.trim()) { narrateAttemptTrace.push({ attempt, guardOk: null, reason: "sin narración utilizable", usage: null }); modelAttempt++; continue; }
    n = normalizeFigures(n, figs);   // cifras en forma canónica limpia ($4.9M, no $4,943,664)
    n = stripLanguageLeaks(n);       // registro ejecutivo neutro (palanca→acción, plata→caja…) · GARANTÍA sobre lo que el prompt ya pide
    n = stripOutOfDataOffers(n);     // nunca ofrecer/mencionar data que no existe (campañas/marketing/…) — mismo patrón que la ruta legacy, ver voiceGuard.js
    n = stripFiller(n);              // banda prohibida de cierres-relleno (backstop del prompt)
    n = stripSingleRowTables(n, q);  // "1 entidad → prosa, nunca tabla" — SALVO que el usuario haya pedido tabla explícitamente (ver narratePromptC.js)
    n = stripRedundantTemporalTable(n, results);   // trend YA renderiza su propia tarjeta con la matriz — nunca dos tablas mes a mes (owner 2026-08-05, ver narratePromptC.js)
    // action_only: DOBLE candado (data_only/results_only ya no llegan acá, ver arriba). (1) el renderer descarta
    // cualquier bloque que no sea [[ACCION]] — sigue valiendo, cierra la fuga original. (2) hasForbiddenContent
    // valida el CONTENIDO del bloque permitido — si coló lenguaje de causa/interpretación o de siguiente-paso
    // DENTRO de [[ACCION]] (el hueco que el owner cazó, generalizado a este alcance), el intento se DESCARTA
    // ENTERO acá y reintenta — nunca se edita a mano un texto que ya mezcló categorías.
    if (pref.contentScope === "action_only") {
      const parsed = parseBlocks(n);
      if (!parsed || !parsed.accion) { narrateAttemptTrace.push({ attempt, guardOk: null, reason: "action_only sin bloque [[ACCION]]", usage: null }); modelAttempt++; continue; }
      const rendered = renderFromBlocks(parsed, "action_only");
      if (!rendered || hasForbiddenContent(rendered, "action_only")) { narrateAttemptTrace.push({ attempt, guardOk: null, reason: "action_only con contenido prohibido", usage: null }); modelAttempt++; continue; }
      n = rendered;
    }
    // BREVEDAD ESTRUCTURAL (owner 2026-07-31, certificación integral, riesgo residual #1) — a diferencia de
    // contentScope (bloques con enforcement duro), detailLevel="brief" era SOLO doctrina de prosa: medido en vivo,
    // 2 turnos consecutivos con brief+persist activo no mostraron ninguna compresión real. ANTES de declarar el
    // período (para que la cláusula de período se sume DESPUÉS del corte y nunca quede amputada — ver
    // ensurePeriodoDeclared abajo), el texto se trunca al presupuesto si lo excede — no es un reintento (nunca
    // falla): el resultado NO PUEDE exceder el presupuesto, sin importar qué haya escrito el narrador.
    if (pref.detailLevel === "brief") n = truncateToBriefBudget(n);
    n = ensureHypothesisFraming(n, plan.mode, results);   // requisito SIMULACIÓN: garantía determinística (ver narratePromptC.js)
    n = ensurePeriodoDeclared(n, periodos);   // requisito 3: garantía determinística, no depende de que el LLM se acuerde
    n = ensureClarifyClosingQuestion(n, plan.mode);   // requisito CLARIFY: va DESPUÉS del período para quedar al final de verdad
    // BACKSTOP · conteo-no-autorizado (owner 2026-08-03, auditoría de eficiencia de Mini — ver guardC.js): corrige
    // ANTES de llegar al guard el caso más frecuente (el narrador enumera N ítems pero dice un número distinto) —
    // nunca inventa un conteo nuevo, solo reconcilia contra lo YA autorizado. El bloqueo real sigue intacto para
    // cualquier caso que esto no pueda corregir con certeza.
    n = ensureCountAuthorized(n, ledger, results);
    if (!n.trim()) { narrateAttemptTrace.push({ attempt, guardOk: null, reason: "narración vacía tras backstops", usage: null }); modelAttempt++; continue; }
    const gVerdict = guardC(n, { ledger, results, trace, question: q, mechanismMemory, sealedOrders, recentNarrations: recentNarrationsPrev, mode: plan.mode });
    narrateAttemptTrace.push({ attempt, guardOk: gVerdict.ok, reason: gVerdict.ok ? (gVerdict.degraded ? `degradado:${gVerdict.advisories.some((a) => a.kind === "orden-decision-tabla-primero") ? "tabla-antes-de-accion" : "repeticion-verbatim"} (reintenta con escalada, no bloquea)` : null) : gVerdict.verdict, usage: null });
    if (gVerdict.ok && !gVerdict.degraded) { narration = n; break; }
    // TIER: acá SÍ corresponde escalar — guardC rechazó el contenido (rechazo real) o lo marcó `degraded`
    // (repetición) — las DOS señales que el owner nombró explícitamente como indicio real de que el modelo actual
    // no está rindiendo (a diferencia de un 429/timeout, que es infraestructura y nunca escala, ver arriba).
    modelAttempt++;
    if (gVerdict.ok && gVerdict.degraded) { bestDegraded = n; continue; }
  }
  // ningún intento logró una redacción FRESCA (no repetida) pero al menos uno fue válido-aunque-repetido → usarla
  // es estrictamente mejor que la reparación genérica de más abajo (ver el comentario junto a `bestDegraded`).
  if (!narration && bestDegraded) { narration = bestDegraded; narrationDegraded = true; }
  // REPARACIÓN CONTROLADA (owner: "nunca fallback genérico") — data_only/results_only ya se resolvieron arriba,
  // siempre, con o sin datos (nunca caen en este loop, ver la condición de arriba) — acá solo llegan full/action_only.
  // ORIGEN (owner 2026-07-31, #56 "simulate v2", variante c): si ESTE turno trae un simulateGeneral degradado
  // (costModelAutorizado:false) y el narrador insistió en "conviene" los 3 intentos (guardC lo rechazó siempre),
  // full scope reparaba desde la boleta — componer una tabla de figs autorizadas es SIEMPRE seguro (no puede
  // accidentalmente decir "conviene", son solo las cifras ya autorizadas).
  // GENERALIZACIÓN (owner 2026-07-31, hallazgo en vivo, auditoría integral): restringir la reparación de full SOLO
  // al caso simDegradado dejaba SIN NINGÚN camino de reparación a cualquier otro modo/turno donde guardC rechaza
  // los 3 intentos por otra razón (ej. modo=decision citando una cifra de cartera mal atribuida; modo=clarify
  // alucinando una cifra del turno anterior) — answerViaOracle devolvía null, es decir SILENCIO TOTAL, el peor
  // resultado posible de cara al usuario (peor que una tabla de cifras autorizadas sin la prosa ejecutiva). El
  // mismo argumento de seguridad que ya vale para simDegradado (componer desde figs YA autorizadas nunca puede
  // inventar ni prometer de más) vale IGUAL para cualquier otro rechazo de full scope — se generaliza la condición.
  if (!narration && (pref.contentScope === "action_only" || pref.contentScope === "full")) {
    const composed = composeFromLedger(figs, pref.contentScope === "action_only" ? "action_only" : "full") || composeNoDataMessage(results);
    let c = ensurePeriodoDeclared(composed, periodos);
    // requisitos SIMULACIÓN/CLARIFY (ver narratePromptC.js): la reparación cae acá cuando el narrador libre agotó
    // los 3 intentos — el turno sigue siendo mode=simulacion/clarify, así que la garantía tiene que valer IGUAL.
    // Solo en full: action_only tiene su PROPIO contrato estricto (nunca prosa fuera del bloque [[ACCION]]) y estas
    // oraciones de resguardo violarían eso — no se aplican ahí.
    if (pref.contentScope === "full") { c = ensureHypothesisFraming(c, plan.mode, results); c = ensureClarifyClosingQuestion(c, plan.mode); }
    if (guardC(c, { ledger, results, trace, question: q, mechanismMemory, sealedOrders }).ok) { narration = c; narrationRepaired = true; }
  }
  if (!narration) return null;   // ni narrar ni reparar desde la boleta autorizada funcionó → C se abstiene (fallback a la ruta vieja)

  // ── OFERTA DE SEGUIMIENTO + REPETICIÓN (Fase 3) — lastOffer SIEMPRE recalculada desde CERO (nunca heredada, ver
  // dialogueState.js): esto es lo que hace que cambio de tema/rechazo/ejecución invaliden la oferta anterior SIN
  // código especial — la narración de ESTE turno simplemente produce (o no) su propia oferta fresca. extractOffer
  // ya filtra por contentScope="full" internamente (data_only/action_only/results_only nunca ofrecen seguimiento).
  const lastOfferNow = extractOffer(narration, { plan, calls, pref, turno: history.length });
  narration = stripAllMarks(narration);   // ninguna marca [[...]] llega al usuario bajo full (no-op si no hay ninguna)
  mem2 = { ...mem2, lastOffer: lastOfferNow || null, recentNarrations: [narration, ...recentNarrationsPrev].slice(0, 2) };   // shim de compatibilidad (Etapa 4) — ver dialogueState.js:getLastOffer
  // Etapa 4 (owner 2026-08-04) — dual-write del lado canónico: recién ACÁ existe `narration` (extractOffer solo
  // puede correr después de que el texto final existe — a diferencia de recentSubjects, que se deriva ANTES de
  // NARRAR), así que conversationScope.current.ofertaPendiente se escribe recién en este punto, no en el bloque de
  // arriba junto a conversationScopeNow. No-op si no hay `current` (conversación sin ninguna entidad establecida
  // todavía) — mismo criterio que el resto de sitios que llaman withOfertaPendiente.
  if (mem2.conversationScope) mem2 = { ...mem2, conversationScope: withOfertaPendiente(mem2.conversationScope, lastOfferNow || null) };

  // graba el mecanismo dominante de ESTE turno (si lo hay) para que el PRÓXIMO turno pueda chequear contra él —
  // solo entidades vistas este turno se actualizan; el resto de mechanismMemory persiste tal cual.
  const freshMechRows = extractMechanismRows(results);
  if (freshMechRows.length) {
    const merged = { ...mechanismMemory };
    for (const { nombre, mecanismo } of freshMechRows) merged[nombre] = mecanismo;
    mem2 = { ...mem2, mechanismByEntity: merged };
  }

  return {
    r: {
      text: narration,
      route: "oracle",
      evidence: buildOracleEvidence({ plan, results, figs, scenario, unsupported }),
      // trazabilidad multiempresa (owner 2026-07-29): qué tenant/snapshot/esquema respondió este turno — nunca se
      // manda al LLM (no es parte del contrato conversacional), solo viaja en la evidencia para auditoría/debug.
      ...(requestContext ? { requestContext: { tenantId: requestContext.tenantId, dataSnapshotId: requestContext.dataSnapshotId, conversationId: requestContext.conversationId, schemaVersion: requestContext.schemaVersion } } : {}),
      // marca de la ruta determinística (requisito 1, pase quirúrgico 2026-07-29): la Pasada 2 (LLM) NO corrió este
      // turno — solo debug/telemetría, nunca condiciona el motor ni el guard.
      ...(deterministic ? { deterministic: true } : {}),
      // marca de la reparación controlada (owner 2026-07-29, residual de contentScope): la Pasada 2 SÍ corrió (a
      // diferencia de `deterministic`) pero ninguno de los 3 intentos cumplió el formato de bloques o el guard —
      // el texto final salió de composeFromLedger, no del narrador libre. Solo debug/telemetría.
      ...(narrationRepaired ? { narrationRepaired: true } : {}),
      // marca de degradación por repetición (owner 2026-08-03): los 3 intentos de NARRAR quedaron marcados
      // `degraded` (tramo verbatim de 8+ palabras contra una narración propia reciente) — se usó el último de
      // todos modos (ver `bestDegraded` arriba) en vez de reparar desde la boleta. Solo debug/telemetría.
      ...(narrationDegraded ? { narrationDegraded: true } : {}),
      // retryTrace (owner 2026-08-02, router de modelo — ver modelRouter.js): reintentos + veredicto de guardC por
      // intento, SOLO debug/telemetría (nunca condiciona el motor). Se cruza en ChatADI.jsx con el modelo/latencia/
      // costo real de cada intento (capturado en el fetch) para dejar el ruteo observable por turno completo.
      ...((planAttemptTrace.length || narrateAttemptTrace.length) ? { retryTrace: { plan: planAttemptTrace, narrate: narrateAttemptTrace } } : {}),
      suggestions: null,
      sentrixAction: null,
    },
    mem: mem2,
  };
}
