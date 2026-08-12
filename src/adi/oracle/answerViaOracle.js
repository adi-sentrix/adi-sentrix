/* === src/adi/oracle/answerViaOracle.js · ARQUITECTURA C · Fase 3 · EL SEAM DE INTEGRACIÓN ===
 * Corre el ciclo COMPLETO de C (PLAN→BATCH→NARRAR bajo guardC) y devuelve un resultado COMPATIBLE con el pipeline
 * vivo ({text, route, evidence}). Detrás del flag ADI_ORACLE_ENABLED; si C se abstiene (plan falla / guard rechaza)
 * devuelve null → el llamador CAE a la ruta vieja (fallback intacto). Reversible: flag OFF = como si no existiera.
 *
 * callPlan/callNarrate son INYECTADOS: headless usan el adapter directo (oráculo/gates), el cliente usa fetch al
 * gateway (la key vive server-side). El motor, la boleta y guardC son los mismos; esto solo los orquesta.
 */
import { applyMemoryUpdate } from "./persona.js";
import { resolverReferencia, REFERENCIA_ANAFORA_RE } from "../../config/businessPolicy.js";
import { runPlan } from "./toolRunner.js";
import { emit as emitTelemetria, nuevoTraceId, getToolsDeclaradas } from "../llm/telemetry.js";   // observación pura: mide, no decide (owner 2026-08-10)
import { ledgerBoleta } from "./ledger.js";
import { guardC, extractMechanismRows, periodosEsperados, ensurePeriodoDeclared, ensureCountAuthorized } from "./guardC.js";
import { stripFiller, normalizeFigures, ensureHypothesisFraming, ensureClarifyClosingQuestion, stripSingleRowTables, stripRedundantTemporalTable, stripPerfilCompletoTable, gradeIndicatedClaims, ensureTransferenciaDeclarada, markUserProvenance } from "./narratePromptC.js";
import { buildClaims, sealScopeContract, buildReparacion } from "./narrationContract.js";   // CONTRATO v2 · Fase 4: los claims sellados salen en la respuesta · v1.2: la reparación sellada, la MISMA que ve el narrador
import { normalizeResponse, deriveMemoriaLegacy } from "../responseContract.js";
import { podarPlanProgresivo, podarLedgerProgresivo, buildDisclosureInstruction, pideDetalleComposicion, pidePresentacionTabular, composeProsaEjecutiva, resolveTablePolicy, resolveOutputForm, resolveAnswerShape, buildAlcanceLine, DEICTIC_COMPONENT_RE } from "./progressiveDisclosure.js";   // divulgación progresiva (el detalle vive en la Ficha, se poda ANTES del batch) + contrato de respuesta proporcional (la FORMA del turno) + la deixis de componente
import { stripLanguageLeaks, stripOutOfDataOffers } from "../llm/voiceGuard.js";   // GARANTÍA runtime de registro (owner 2026-07-14/26: "palanca" y demás slang NO van — hoy solo corría en la ruta vieja, C quedaba sin la red) · stripOutOfDataOffers (owner 2026-08-03, Fase 3 eficiencia de Mini): MISMA garantía de "nunca ofrezcas data que no existe" — antes SOLO corría en la ruta legacy, cero ocurrencias en la ruta oráculo real
import { buildOracleEvidence } from "./sentrixEvidence.js";  // SENTRIX ES LA EVIDENCIA (owner 2026-07-28): el panel debe reflejar lo que C acaba de narrar
import { parseAddress, buildSentrixActionFromAddress } from "../sentrix/address.js";   // CTA de la respuesta → la dirección EXACTA que la respalda (owner 2026-08-09)
import { MODE_KEYS, normalizeReparacion, coerceVocabularioPlan } from "./conversationalContract.js";
import { axisEntityNames } from "./entityIndex.js";   // el catálogo REAL del tenant — nunca una lista de nombres a mano
import { CONTENT_SCOPES, DETAIL_LEVELS, pideDatoPelado } from "./responsePreference.js";
import { parseBlocks, renderFromBlocks, composeFromLedger, composeFromTextualEvidence, composeNoDataMessage, hasForbiddenContent, stripAllMarks, truncateToBriefBudget } from "./narrationBlocks.js";
import { isAcceptance, extractOffer, updateRecentSubjects, needsOrientacion, buildOrientacionInstruction, composeOrphanAcceptance, resolveSubjectRecall, composeSubjectAmbiguity, isVagueOffer, composeVagueOfferAcceptance, isExhaustedMechanismOffer, composeExhaustedMechanismAcceptance, matchEllipticEntity, getLastOffer, getRecentSubjects } from "./dialogueState.js";
// CONTINUIDAD CONVERSACIONAL UNIVERSAL (Etapa 1/3, owner 2026-08-03) — conversationScope.js es la capa canónica.
// Etapa 4 (owner 2026-08-04, "lastOffer/recentSubjects como vistas derivadas") cerró la consolidación que Etapa 1
// dejó pendiente por bajo riesgo: mem.lastOffer/mem.recentSubjects (dialogueState.js) ya NO son una segunda fuente
// mantenida en paralelo — getLastOffer/getRecentSubjects (importados arriba) las CALCULAN leyendo
// mem.conversationScope, con mem.lastOffer/mem.recentSubjects "pelados" como shim de compatibilidad para
// fixtures viejos. withOfertaPendiente (abajo) es el ÚNICO punto que escribe el lado canónico — ver el comentario
// "CONSOLIDACIÓN — ESTADO AL CIERRE DE ETAPA 4" al final de conversationScope.js para el detalle completo.
import { emptyConversationScope, updateConversationScope, resolveConversationReference, composeReferenceAmbiguity, composeReferenceDecline, withOfertaPendiente, resolveComponentReference, DEICTIC_PLURAL_RE,
  applyRepairToScope, composePrecisionQuestion, withSupuestoUsuario, inferirCorrige,
  // LA SIMULACIÓN PENDIENTE · CICLO DE VIDA POR ESTADO (owner 2026-08-11) — el pendiente muere cuando se resuelve,
  // se reemplaza, una corrección lo invalida o se le acaba el plazo; NUNCA porque pasó un turno. Las reglas viven
  // en conversationScope.js (el hogar del resto del ciclo de vida del contexto); acá solo se decide CUÁNDO
  // aplicarlas — ver el comentario de cabecera de ese bloque para el defecto medido y el porqué del TTL.
  nacePendingSimulation, pendingSimulationVigente, envejecerPendingSimulation, repararPendingSimulation, fusionarPendientes, pendienteDesdeEscenario } from "./conversationScope.js";
// CONTRATO DE CONCORDANCIA ADI ↔ SENTRIX (owner 2026-08-09) — el CONTEXTO DE PANTALLA. Este archivo es el único
// punto del oráculo que lo orquesta: lo SELLA al entrar (nunca confía en lo que llegó de la UI), lo INVALIDA cuando
// cambia la pantalla o el tema, lo proyecta como UNA LÍNEA para PLAN, lo usa como backstop determinístico del
// alcance, y lo persiste como key hermana de conversationScope. Ni una cifra viaja por acá: la evidencia se la
// sigue pidiendo PLAN a las tools (ver viewContext.js para la frontera completa).
import { sealViewContext, invalidateViewContext, viewContextEntry, projectViewContextForPlan, projectViewContextForCoercion } from "./viewContext.js";
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
import { figFor } from "../boleta.js";                              // la ÚNICA lectura sancionada de una fig ya autorizada
import { PERIODO_TXT, reconcilian, UNIVERSOS } from "../../config/contract/figureType.js";  // las dos frases canónicas del marco temporal + qué universo reconcilia con cuál (la MISMA declaración que usa guardC)
import { detectScenarioIntent, extractSignedPct, extractScenarioVariable, ZERO_EXPLICIT_RE } from "./scenarioIntent.js";
import { detectCriteriaIntent } from "../criteria.js";   // C.2 memoria de criterio (owner 2026-07-31, fix adi-oraculo-criterio-no-invocado): la ruta oráculo nunca la corría
import { composeCriteria } from "../conversation.js";     // UNA VERDAD: reusa la MISMA composición (setCriterion/forgetCriterion) de la ruta legacy, nunca la reimplementa acá
import { pnlOraclePlan } from "../pnl.js";                // decisión 3 · el plan determinístico del RESULTADO (P&L) — evita que "resultado" se conteste con la CONTRIBUCIÓN
import { clientCapitalRelacion } from "../specRetrieval.js";   // decisión 9 · ¿el dato sostiene la relación cliente×SKU? (la MISMA medición que usa el composer, nunca un criterio paralelo)

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
/* _esSinCredito(err) → ¿el proveedor rechazó por FALTA DE CRÉDITO, no por rate limit? (owner 2026-08-11, defecto 1)
 * Se lee del código que ya etiqueta el adapter (`billing_exhausted` / `fatal`), no del texto del mensaje: el
 * mensaje lo escribe el proveedor y cambia sin avisar. El respaldo por texto existe sólo para un adapter que
 * todavía no etiquete —falla ABIERTA hacia el comportamiento viejo, nunca al revés—. */
export function _esSinCredito(err) {
  if (!err) return false;
  if (err.code === "billing_exhausted" || err.fatal === true) return true;
  return /insufficient_quota|no credits remaining|exceeded your current quota|billing_not_active/i.test(String(err.message || ""));
}

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
// FORMAS VERBALES, NO SOLO SUSTANTIVOS (owner 2026-08-10, certificación live · defecto C2). Esta tabla era
// SUSTANTIVA pura: reconocía "ventas" pero no "vende". Consecuencia medida en vivo con «¿cuánto VENDE SAM-TV55 y
// cuánto stock tiene?»: el extractor encontró UNA sola métrica (stock), la ruta determinística creyó que era una
// pregunta puntual de una métrica y contestó SOLO el inventario — la venta no se declinó, se perdió en silencio,
// que es peor. El hueco no era del caso: era del léxico. Un usuario pregunta con verbos («cuánto vende»,
// «cuánto cuesta», «cuánto rota», «cuánto contribuye») al menos tan seguido como con sustantivos, y las dos
// formas tienen que llegar al mismo token. Se agregan las conjugaciones, no la frase probada.
const _TENSION_METRIC_MAP = [
  [/\bcontribuci[oó]n(?:es)?\b|\bcontribu[yií]\w*\b/i, "contribucion"],
  [/\bmargen(?:es)?\b|\bmargina\w*\b/i, "margen"],
  [/\bcapital\b|\binventario\b|\bstock\b/i, "stockUSD"],
  [/\brotaci[oó]n\b|\brot[aá]\w*\b/i, "rotacion"],
  [/\bcobertura\b|\bdoh\b/i, "doh"],
  [/\bcosto\s+medio\b/i, "costoMedio"],
  [/\bcostos?\b(?!\s+medio)|\bcuesta\w*\b|\bcuestan\b/i, "costo"],
  [/\bprecio(?:s)?\s+de\s+lista\b/i, "precioLista"],
  [/\bventas?\b|\bvend[eií]\w*\b|\bvendemos\b/i, "venta"],
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
/* ── EL CTA DE LA RESPUESTA · «Ver … en Sentrix» (owner 2026-08-09) ────────────────────────────────────────────
 * Se compone de la DIRECCIÓN que `buildOracleEvidence` ya dejó en la evidencia (address.js, determinística sobre
 * el plan y el evidenceSpec). Tres garantías: (1) sin dirección resoluble devuelve null y no se pinta botón;
 * (2) la etiqueta sale de la dirección, así que dice a dónde lleva de verdad ("Ver la ficha de X en Sentrix", no
 * "Ver en Sentrix"); (3) el payload no transporta cifras — es un puntero, y las cifras siguen saliendo de las
 * tools cuando el panel se abre. */
function _sentrixActionDe(evidence) {
  try {
    const addr = parseAddress(evidence && evidence.address);
    if (!addr) return null;
    return buildSentrixActionFromAddress(addr, { moduleChip: null });
  } catch { return null; }
}

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

// ── CONTEXTO DE PANTALLA → ALCANCE (owner 2026-08-09, Contrato de Concordancia ADI ↔ Sentrix) ──────────────────
// _coerceViewScope(plan, vcProj, text, maxCalls) → plan' — backstop DETERMINÍSTICO, en la MISMA cadena y con la
// MISMA precedencia que _coerceEntityScopedFilters/applySingleEntityScope: PLAN es el mecanismo principal (entiende
// la expresión libre y ahora VE la línea de contexto de pantalla), y esto SOLO cubre el patrón inequívoco que el
// LLM no puede resolver solo — "explicame este gráfico" / "cuáles de estos clientes" con el panel abierto.
//
// LAS TRES CONDICIONES, todas obligatorias (nunca pisa un plan que ya resolvió bien):
//   a) hay contexto de pantalla proyectado (el usuario estaba mirando algo);
//   b) el texto trae un deíctico de COMPONENTE o de entidades — sin deíctico, el turno se sostiene solo y no hay
//      nada que anclar (una pregunta autónoma con el panel abierto sigue siendo una pregunta autónoma);
//   c) PLAN no resolvió nada concreto: scope sin entidades utilizables y NO global (si dijo "el negocio", el
//      contexto ya se descartó antes de llegar acá — ver invalidateViewContext).
//
// QUÉ HACE, en este orden:
//   1. ALCANCE — si la pantalla declara entidades seleccionadas, las fija en plan.scope (una → "entity", varias →
//      "list", que río abajo recoge applySingleEntityScope/applyMultiEntityScope, sin mecanismo nuevo). Si en vez
//      de entidades declara un FILTRO (el camino O(1): 300 clientes viajan como criterio, nunca como lista), se
//      inyecta en args.filters de las tools que lo aceptan — el MISMO conjunto _ENTITY_FILTER_TOOLS de arriba.
//   2. EVIDENCIA — si el plan quedó SIN calls (el caso típico de "explicame este gráfico": el LLM entiende que hay
//      que explicar pero no sabe qué pedir), se siembran las calls que el MANIFIESTO declara para ese componente.
//      Eso es exactamente "el PLAN pide la evidencia a las tools en vez de recibir tablas": la pantalla dice QUÉ
//      componente es, el manifiesto dice con qué tools se demuestra, y el motor las corre. Si el componente no
//      tiene contraparte en el oráculo, `evidencia` viene vacío y NO se siembra nada — la respuesta declarará el
//      límite (vcProj.sinTool), nunca contestará con la cifra de otra aritmética creyendo que es la misma.
function _coerceViewScope(plan, vcProj, text, maxCalls = 6, compRef = null) {
  if (!plan || !vcProj) return plan;
  const t = String(text || "");
  // apunta al COMPONENTE ("explicame este gráfico") vs. apunta a las ENTIDADES ("cuáles de estos clientes"). La
  // primera la resuelve resolveComponentReference (conversationScope.js) contra el contexto sellado; la segunda es
  // el deíctico plural de siempre. Sin ninguna de las dos, el turno se sostiene solo y acá no se toca nada.
  const apuntaAlComponente = !!(compRef && compRef.kind === "resolved");
  if (!apuntaAlComponente && !DEICTIC_PLURAL_RE.test(t)) return plan;
  const scope = plan.scope || null;
  if (scope && scope.level === "global") return plan;   // el usuario cambió de tema — la pantalla no manda
  const yaResueltas = (scope && Array.isArray(scope.entities)) ? scope.entities.filter((e) => e && guessDimension(e)) : [];
  if (yaResueltas.length) return plan;   // PLAN ya ancló entidades reales: no se le superpone un segundo criterio

  let out = plan;
  const entidades = Array.isArray(vcProj.entidades) ? vcProj.entidades.filter((e) => e && guessDimension(e)) : [];
  if (entidades.length) {
    out = { ...out, scope: { ...(scope || {}), level: entidades.length > 1 ? "list" : "entity", entities: entidades } };
  } else {
    const filtros = (vcProj.filtros && typeof vcProj.filtros === "object") ? vcProj.filtros : {};
    const keys = Object.keys(filtros);
    if (keys.length) {
      const calls = Array.isArray(out.calls) ? out.calls : [];
      out = { ...out, calls: calls.map((c) => {
        if (!c || !_ENTITY_FILTER_TOOLS.has(c.tool)) return c;
        const args = (c.args && typeof c.args === "object" && !Array.isArray(c.args)) ? c.args : {};
        if (args.filters && typeof args.filters === "object" && Object.keys(args.filters).length) return c;   // el plan ya acotó: no se pisa
        return { ...c, args: { ...args, filters: { ...filtros } } };
      }) };
    }
  }

  // 2 · siembra de evidencia SOLO si el plan quedó vacío. Nunca agrega calls a un plan que ya pidió algo: el
  // usuario preguntó una cosa, no dos, y duplicar el batch sería pagar tokens por una lectura que nadie pidió.
  const callsActuales = Array.isArray(out.calls) ? out.calls.filter(Boolean) : [];
  if (apuntaAlComponente && !callsActuales.length && Array.isArray(vcProj.evidencia) && vcProj.evidencia.length) {
    const room = Math.max(0, Number(maxCalls) || 6);
    const sembradas = vcProj.evidencia
      .filter((e) => e && e.tool)
      .slice(0, room)
      // EL `focus` ES PARTE DE LA CALL, NO UNA ANOTACIÓN (corrección 2026-08-09, pase de regresión). El manifiesto
      // lo declara como campo hermano de `args` porque el índice inverso tool→componente lo indexa aparte, pero al
      // SEMBRAR la call tiene que viajar DENTRO de args: es el argumento con el que la tool decide de qué subconjunto
      // habla. Sin esto, "explicá este gráfico" sobre el Pareto sembraba salesRead con su focus default
      // ("vs_anterior") en vez de "concentracion", y sobre el KPI de quiebres traía capital detenido — la respuesta
      // correcta a OTRA pregunta, con cifras reales y por eso invisible para los guards de cifras.
      // `args.focus` explícito gana: si el manifiesto ya lo puso adentro, no se pisa.
      .map((e) => {
        const args = { ...(e.args || {}) };
        if (e.focus && !args.focus) args.focus = e.focus;
        return { tool: e.tool, args };
      });
    if (sembradas.length) out = { ...out, calls: sembradas, intent: out.intent === "ack" ? "answer" : out.intent };
  }
  return out;
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
//   · AL MENOS 1 métrica nombrada en el TEXTO CRUDO de la pregunta (reusa _extractTensionMetrics, ya probado para
//     tensionRead) — 0 métricas = pide el registro completo (mejor servido por el narrador).
//
// VARIAS MÉTRICAS EN UNA PREGUNTA (owner 2026-08-10, certificación live · defecto C2). Antes esto exigía
// EXACTAMENTE 1 y cedía al narrador con 2+. Medido en vivo, «¿cuánto vende SAM-TV55 y cuánto stock tiene?» no llegó
// a ceder: el extractor sólo veía UNA métrica (ver la tabla de arriba), así que esta ruta contestó el inventario y
// la venta desapareció sin declinarse. Con el léxico arreglado el turno tendría 2 métricas y se iría al narrador —
// pero eso deja a la suerte del muestreo justo lo que el owner marcó como obligatorio: "debió entregar las DOS y
// declarar por qué no se comparan". Acá se entregan las dos por construcción, gratis y sin una llamada.
//   · Se responde SOLO si TODAS las métricas nombradas están en esta fila. Si falta alguna, se cede al narrador
//     entero — media respuesta determinística sería el mismo defecto con otro disfraz.
//   · La relación entre universos NO se decide acá: la declara `reconcilian` (config/contract/figureType.js), la
//     misma función con la que el guard bloquea el cruce. Una segunda opinión sobre qué reconcilia con qué es
//     exactamente cómo se llega a que el motor afirme lo que el muro prohíbe.
// EL PERÍODO DE LA CITA PUNTUAL SALE DEL TIPO DE ESA CIFRA (owner 2026-07-31, hallazgo en vivo "Inventario y
// capital inmovilizado"; owner 2026-08-09, decisión 5). Cuando la MISMA pregunta de negocio (capital inmovilizado /
// valor de inventario / rotación) se resuelve para un SKU puntual vía entityRecord (porque inventoryStatus no
// filtra por SKU), el período quedaba estampado "año cerrado" — engañoso para un concepto que es una foto del
// stock a hoy. entityRecord trae una FILA MIXTA (venta y margen del año cerrado JUNTO a stock, rotación y días de
// inventario de la foto de hoy), así que `facts.periodo` —que ahora declara los DOS marcos— no puede ser el marco
// de UNA cita puntual. Acá el token exacto que se va a narrar YA se conoce, así que se lee el marco de SU PROPIA
// fig: el que el contrato ya le puso al tiparla (`figureType.UNIVERSOS[universo].periodo`).
// Esto reemplaza un `_SNAPSHOT_TOKENS = new Set(["stockUSD","rotacion","doh"])` escrito a mano acá: era la MISMA
// regla que el contrato ya declaraba, mantenida en paralelo. Con el tipo, además, cubre sola los campos que esa
// lista no nombraba (cobertura, días sin venta, % del inventario) sin agregarle una línea.
// Un CONTEO no declara marco propio (hereda el de lo que cuenta: "Unidades vendidas" es del año cerrado,
// "Unidades en stock" de la foto) → ahí cae al marco que declara el resultado completo, como antes.

// EXPORTADAS PARA QUE UN GATE OFFLINE LAS PUEDA MEDIR (owner 2026-08-10, defecto C2 — mismo criterio con el que
// `periodoDeclarado` se exportó desde guardC.js: un gate que mantiene su propia copia de la regla se desincroniza
// y termina certificando otra cosa). Las dos son PURAS: no llaman al proveedor, así que el gate que las use sigue
// siendo offline. `_simpleEntityMetric`/`_rutaDeterministica` conservan su nombre interno; esto solo las publica.
export function simpleEntityMetric(q, plan, calls, results) { return _simpleEntityMetric(q, plan, calls, results); }
export function rutaDeterministica(pref, simple) { return _rutaDeterministica(pref, simple); }

function _simpleEntityMetric(q, plan, calls, results) {
  if (!plan || plan.intent !== "answer") return null;
  if (!plan.scope || plan.scope.level !== "entity" || !Array.isArray(plan.scope.entities) || plan.scope.entities.length !== 1) return null;
  if (!Array.isArray(calls) || calls.length !== 1 || !calls[0] || calls[0].tool !== "entityRecord") return null;
  if (!Array.isArray(results) || results.length !== 1) return null;
  const r = results[0];
  if (!r || !r.coverage || r.coverage.supported !== true || !r.facts) return null;
  const tokens = _extractTensionMetrics(q);
  if (!tokens.length) return null;
  const entity = r.facts.entidad || plan.scope.entities[0];
  if (!entity) return null;
  const dimension = calls[0].args && calls[0].args.dimension;
  const rec = dimension ? rawRecordFor(dimension, entity) : null;
  const campos = [];
  for (const { token } of tokens) {
    const label = fieldLabel(token);
    if (!label || r.facts[label] == null) return null;   // el campo no está en ESTE registro → cede al narrador ENTERO, no contesta a medias
    const figCampo = figFor(r.boleta || [], entity, label);           // la fig EXACTA que se va a citar
    const famCampo = figCampo && figCampo.tipo ? figCampo.tipo.periodo : null;   // "hoy" | "anual" | null (conteo)
    campos.push({
      label, token, value: r.facts[label],
      periodo: (famCampo && PERIODO_TXT[famCampo]) || r.facts.periodo || null,
      universo: (figCampo && figCampo.tipo && figCampo.tipo.universo) || null,
      rawValue: rec && typeof rec[token] === "number" ? rec[token] : null,
    });
  }
  // el primero conserva la forma de siempre (label/token/value/periodo/rawValue en la raíz) para no cambiarle el
  // contrato a `periodosSimple` ni a los ~30 callers/gates que ya lo leen así; `campos` es aditivo.
  return { entity, rec, campos, ...campos[0] };
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

const _periodoTxt = (periodo) => (periodo ? (/a[nñ]o cerrado/i.test(periodo) ? "en el año cerrado" : /foto.*hoy/i.test(periodo) ? "a la fecha de hoy" : null) : null);
function _oracionCampo(entity, { label, token, value, periodo }) {
  const m = _METRICA_ORACION[token] || { articulo: "el", plural: false, sustantivo: label.toLowerCase() };
  const art = m.articulo.charAt(0).toUpperCase() + m.articulo.slice(1);
  const p = _periodoTxt(periodo);
  return `${art} ${m.sustantivo} de ${entity} ${m.plural ? "son" : "es"} ${value}${p ? `, ${p}` : ""}.`;
}
// _lineaUniversos(campos) → la frase que DECLARA por qué dos cifras del turno no se comparan, o null.
// EL VEREDICTO NO SE DECIDE ACÁ: lo da `reconcilian` (config/contract/figureType.js), la MISMA función con la que
// guardC bloquea el cruce. Una segunda opinión sobre qué reconcilia con qué es exactamente cómo se llega a que el
// motor afirme lo que el muro prohíbe.
// LA FRASE SE COMPONE DE LAS PROPIEDADES DECLARADAS, NO DEL `razon` DEL CONTRATO. Ese texto está escrito para
// quien lee el contrato y trae CIFRAS ("×1000 de diferencia", "entre 4x y 35x") que este turno no tiene
// autorizadas — el guard lo bloqueó, con razón, la primera vez que se intentó pegarlo tal cual. Acá se dicen las
// MISMAS diferencias sin un solo número: escala, marco temporal y unidad salen de `UNIVERSOS[x]`, así que la
// afirmación sigue siendo del contrato y no hay ninguna cifra que autorizar.
// Va en ORACIÓN APARTE de las dos citas, para que ninguna construcción relacional las ate (ver _cruceDeUniversos).
const _Y = (s) => (/^[ií]/i.test(String(s || "")) ? "e" : "y");   // «venta comercial» E «inventario»
function _lineaUniversos(campos) {
  for (let i = 0; i < campos.length; i++) for (let j = i + 1; j < campos.length; j++) {
    const a = campos[i], b = campos[j];
    if (!a.universo || !b.universo || a.universo === b.universo) continue;
    if (reconcilian(a.universo, b.universo).estado !== "divergent") continue;
    const A = UNIVERSOS[a.universo], B = UNIVERSOS[b.universo];
    const motivos = [];
    if (A.unidad !== B.unidad) motivos.push("miden unidades distintas");
    if (A.escala !== B.escala) motivos.push("se almacenan en escalas distintas");
    if (A.periodo !== B.periodo) motivos.push("cubren marcos temporales distintos");
    return `Las dos cifras no se comparan entre sí: «${A.etiqueta}» ${_Y(B.etiqueta)} «${B.etiqueta}» son universos distintos${motivos.length ? ` —${motivos.join(" y ")}—` : ""}, así que ninguna operación entre ellas cierra sobre este dato.`;
  }
  return null;
}
function _rutaDeterministica(pref, simple) {
  const { entity, rec } = simple;
  const campos = Array.isArray(simple.campos) && simple.campos.length ? simple.campos : [simple];
  const oraciones = campos.map((c) => _oracionCampo(entity, c));
  // LAS DOS CIFRAS Y POR QUÉ NO SE COMPARAN (owner 2026-08-10, defecto C2): evitar el cruce estuvo BIEN, omitir una
  // de las dos estuvo mal. La declaración va incluso bajo data_only: no es análisis, es el marco sin el cual la
  // cifra pelada se puede leer mal — el mismo criterio con el que "solo el dato" ya incluye período y alcance.
  const universos = campos.length > 1 ? _lineaUniversos(campos) : null;
  const base = oraciones.join(" ") + (universos ? ` ${universos}` : "");
  if (pref.contentScope === "data_only") return base;   // requisito 7 generalizado: el usuario pidió SOLO el dato — se respeta, sin análisis
  // la lectura mínima es de UNA métrica contra SU vara declarada: con varias, cada una trae la suya si la tiene.
  const lecturas = campos.map((c) => (typeof c.rawValue === "number" ? _lecturaMinima(c.token, rec, c.rawValue) : null)).filter(Boolean);
  if (lecturas.length) return `${base} ${lecturas.join(" ")}`;
  // brief: la oferta de análisis es contexto NO indispensable — se recorta. standard: se ofrece, como siempre.
  return pref.detailLevel === "brief" ? base : `${base} Si quieres, puedo analizarlo con más detalle.`;
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
// AMPLIACIÓN RETIRADA · REVERTIDA A LA BASE 2b062cc (owner 2026-08-11, segunda revisión adversarial) ─────────────
// El 2026-08-11 esta regex se había ampliado a `(?:volv[eé]|vuelv[ae]|volver|volvamos)\s+al?\s+…normal` para
// enganchar "Ahora vuelve al nivel normal" como salida de emergencia. ERA UN FALSO POSITIVO, y de la peor clase.
// MEDIDO (3 turnos, árbol con la ampliación vs base): t1 "Desde ahora dame solo los datos." → contentScope
// data_only. t2 "¿La demanda vuelve al nivel normal este trimestre?" → la ampliación lo leía como una instrucción
// de formato, reseteaba a {full, standard} CON persist=true y soltaba al narrador libre 3 veces en un turno que
// estaba bajo garantía por construcción; t3 "¿Cómo viene Samsung?" seguía en full — EL RESETEO ERA PERMANENTE y
// nadie se lo dijo al usuario. 4/4 redacciones corrientes de retail lo disparaban ("¿El stock de Samsung vuelve al
// nivel normal después de la promo?", "¿Cuándo vuelve al nivel normal la rotación de Línea Blanca?", "¿La venta
// vuelve al nivel normal en marzo?"). En la base 2b062cc las cuatro son inocuas.
//
// POR QUÉ SE REVIERTE EN VEZ DE AFINARSE: "vuelve al nivel normal" es LITERALMENTE la misma cadena en la
// instrucción ("Ahora vuelve al nivel normal") y en la pregunta de negocio ("¿La demanda vuelve al nivel normal?").
// Separarlas exige decidir el MODO del verbo — imperativo vs indicativo — a partir de si hay o no un sujeto de
// negocio delante, y eso es inferencia sintáctica, no una regla que falle cerrada. La doctrina del archivo es
// ANTE AMBIGÜEDAD, ABSTENERSE: dejar pasar un pedido de reset que el usuario tendrá que repetir con otras palabras
// es barato; borrarle en silencio y para siempre una preferencia que pidió explícitamente, no. Lo que se pierde
// está declarado como límite: "Ahora vuelve al nivel normal." y "Volvamos al modo normal." NO resetean (el usuario
// sigue teniendo "Volvé a lo normal.", "análisis completo" y "como antes"), y la cara opuesta —las preguntas de
// negocio que NO deben resetear— queda gateada en _definicion_alcance_restringido_gate.mjs para que ninguna
// reapertura futura de esta regex vuelva a romperlas sin que un gate lo grite.
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
// LA PERSISTENCIA ES POR EJE (owner 2026-08-11, causa secundaria de D4) ────────────────────────────────────────
// `persist` era UNO SOLO para los dos ejes, y eso convertía una corrección de REGISTRO en una restricción de
// CONTENIDO permanente. Medido: "Hablame directo y sin rodeos" — que por doctrina fija detailLevel y nada más —
// encendía `persist`, y el 1504 congelaba en la sesión TAMBIÉN el `contentScope` que el LLM había inferido para
// ESE turno. Resultado: una frase sobre CÓMO hablar dejaba al usuario atrapado en "solo el dato" para el resto de
// la conversación, sin haberlo pedido nunca. La regla correcta: una frase de registro autoriza persistir el
// registro; el alcance del contenido sólo persiste cuando algo habla del alcance ("desde ahora dame solo los
// datos") o cuando el propio planificador lo declara. `persist` se conserva como salida derivada (persistScope ||
// persistDetail) para que ningún lector externo cambie de significado.
// _cifrasEnLinea(figs) → las MISMAS cifras autorizadas que compone la tabla de composeFromLedger, sin la tabla.
// NO es un segundo compositor de la respuesta: no elige, no ordena, no resume y no agrega ni una palabra propia —
// recorre la MISMA lista de figs, con el MISMO tope de 12, y escribe label y value VERBATIM. Por eso pasa guardC
// por la misma razón que la tabla: cada cifra ya estaba autorizada por el ledger. Existe sólo para el turno de
// alcance restringido cuyo usuario prohibió la forma tabular; devuelve null si no hay ninguna fig, para que el
// caller siga con la cadena de siempre.
function _cifrasEnLinea(figs) {
  const list = Array.isArray(figs) ? figs.filter((f) => f && typeof f.label === "string" && f.value != null) : [];
  if (!list.length) return null;
  return `${list.slice(0, 12).map((f) => `${f.label}: ${f.value}`).join(" · ")}.`;
}

/* ── UNA REDUCCIÓN DE FORMA NO FIJA EL ALCANCE (owner 2026-08-11) ────────────────────────────────────────────────
 * MEDIDO: «Ahora solo la conclusión, nada más» y «Resumilo en una frase, sin explicación» devolvían una TABLA de
 * doce filas. La cadena era: `_PREF_DATA_ONLY_RE` matchea por «nada más» / «sin explicación» → contentScope
 * data_only → la rama de garantía por construcción resuelve el turno ENTERO desde composeFromLedger, que es una
 * tabla. El usuario pidió MENOS respuesta y recibió la forma más larga que el motor sabe emitir.
 *
 * LA FRONTERA, y es la misma que la doctrina de PLAN ya declara en responsePreference.js: el ALCANCE lo fija sólo
 * lo que el turno nombra EN POSITIVO como la cosa pedida («solo el dato», «solo las cifras», «solo la tabla»). Una
 * restricción puramente NEGATIVA («nada más», «sin explicación») no nombra ningún dato: es reducción, y la
 * reducción vive en el otro eje. Hasta hoy la mitad determinística de esa regla no existía — estaba sólo en el
 * texto del prompt, así que valía cuando el LLM la obedecía y no valía cuando la red regex forzaba el valor.
 *
 * POR QUÉ ES TAN ANGOSTO (y por qué no se toca `_PREF_DATA_ONLY_RE`): sólo se DENIEGA data_only cuando se dan las
 * DOS condiciones a la vez — el turno pide una forma incompatible con una tabla Y no nombra ningún dato en
 * positivo. «dame un resumen ejecutivo, nada más» no pide ninguna reducción de forma y sigue siendo data_only,
 * igual que las 13 frases del owner; «dame solo las cifras en una tabla» nombra el dato Y la tabla, y sigue siendo
 * data_only. La regex se deja intacta a propósito: es el vocabulario de «solo el dato», y sigue siendo correcta —
 * lo que faltaba era la precedencia entre los dos ejes, no otra lista de frases.
 *
 * LA SEÑAL DE FORMA SE PIDE PRESTADA, NO SE COPIA: `resolveTablePolicy` con la poda VACÍA es la decisión del
 * usuario aislada de la inferencia del motor, y vive en progressiveDisclosure.js junto al resto del vocabulario de
 * forma. Reescribir acá una lista de frases de reducción sería la segunda fuente de verdad que este mismo fix
 * existe para no tener. */
function _laFormaPedidaExcluyeLaTabla(t) {
  try { return resolveTablePolicy({ text: t, podado: [] }) === "forbidden"; }
  catch { return false; }   // lectura defensiva: un detector de forma jamás puede tumbar el turno
}
function _reduccionDeFormaSinDatoNombrado(t) {
  return _laFormaPedidaExcluyeLaTabla(t) && !pideDatoPelado(t);
}

function _coercePref(text, plan) {
  const t = String(text || "");
  const llmPref = (plan && plan.pref && typeof plan.pref === "object") ? plan.pref : {};
  let contentScope = CONTENT_SCOPES.includes(llmPref.contentScope) ? llmPref.contentScope : null;
  let detailLevel = DETAIL_LEVELS.includes(llmPref.detailLevel) ? llmPref.detailLevel : null;
  // el planificador habla de la preferencia ENTERA: si él declara persistencia, abarca los dos ejes.
  let persistScope = llmPref.persist === true;
  let persistDetail = llmPref.persist === true;
  const isSim = plan && plan.mode === "simulacion";

  // "volver a lo normal" SIEMPRE cancela la sesión (owner 2026-07-29) — fija los DOS ejes y los persiste juntos:
  // un reset que dejara vivo cualquiera de los dos no sería un reset.
  if (_PREF_RESET_RE.test(t)) {
    contentScope = "full"; detailLevel = "standard"; persistScope = true; persistDetail = true;
  } else {
    if (_PREF_ACTION_ONLY_RE.test(t)) contentScope = "action_only";
    else if (isSim && _PREF_RESULTS_ONLY_SIM_RE.test(t)) contentScope = "results_only";
    else if (_PREF_DATA_ONLY_RE.test(t) && !_reduccionDeFormaSinDatoNombrado(t)) contentScope = "data_only";
    if (_PREF_BRIEF_RE.test(t)) detailLevel = "brief";
    // REGISTRO, NO ALCANCE: estas dos frases dicen cómo hablarle a la persona de ahora en más. Persisten el eje
    // que corrigen y NINGÚN otro — ver el bloque de arriba para lo que costaba no distinguirlos.
    if (_PREF_DIRECTO_RE.test(t)) { detailLevel = "brief"; persistDetail = true; }
    if (_PREF_STANDARD_RE.test(t)) { detailLevel = "standard"; persistDetail = true; }
  }
  // "desde ahora"/"en adelante" SÍ es una instrucción sobre la sesión entera: abarca los dos ejes, como antes.
  if (_PREF_PERSIST_RE.test(t)) { persistScope = true; persistDetail = true; }
  if (_PREF_ONE_TURN_RE.test(t)) { persistScope = false; persistDetail = false; }   // "esta vez" siempre gana

  if (contentScope == null && detailLevel == null) return null;   // sin señal este turno → el llamador usa sesión/default
  return { contentScope, detailLevel, persistScope, persistDetail, persist: persistScope || persistDetail };
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

/* ══ EL GUARD DE PERTINENCIA · LA SEGUNDA MITAD DE LA REGLA DEL PENDIENTE (owner 2026-08-11) ═══════════════════
 * EL DEFECTO QUE CIERRA (medido, con atribución contra el árbol base): el ciclo de vida por estado le dio al
 * pendiente 3 turnos de vida en vez de 1, pero el criterio que decide si un turno lo está CONTESTANDO se quedó
 * como estaba — "trae un % con dirección y no nombra otra entidad conocida". Con 1 turno de vida eso era casi
 * inalcanzable; con 3, es un camino normal de conversación. Repro exacto: t1 «Sube 7% el precio de Samsung» ·
 * t2 «¿Qué margen tiene Sodimac?» · t3 «y si el costo de flete sube 4%, ¿cambia algo?» → el motor ejecutaba
 * simulateGeneral(Samsung · precio +7% · unidades +4%) e imprimía una tabla sellada de cifras que el usuario no
 * pidió. Preguntó por el flete y le contestaron una simulación de Samsung. Eso es FABRICAR un supuesto ajeno y
 * atribuirlo a una entidad vieja — la misma clase de daño que el guard de entidad de más abajo existe para cerrar,
 * reabierta por otro lado. El TTL acota CUÁNTO dura el pendiente; no impide que dispare mientras dura.
 *
 * LA REGLA: no alcanza con que el turno NO contradiga al pendiente. Hace falta evidencia POSITIVA de que lo está
 * contestando, y sólo hay dos formas de tenerla:
 *   (a) el turno NOMBRA la variable que falta — «el volumen baja 2%», «las unidades caen 6%», «el precio sube 5%»;
 *   (b) el turno es una RESPUESTA PELADA — «baja 3%», «que suba un 5%», «no cambia»: el porcentaje y su dirección
 *       y nada más. Una respuesta pelada sólo puede referirse a la pregunta abierta, porque no nombra ningún otro
 *       sujeto del que pudiera estar hablando.
 * Cualquier otra cosa —un % que viaja pegado a OTRO sustantivo (costo, flete, margen, competencia…)— es un turno
 * nuevo, no una respuesta, y el pendiente sigue esperando (no se abandona: sigue vivo con un turno menos, ver el
 * ciclo de vida en conversationScope.js). Falso negativo antes que falso positivo: si acá no resolvemos, PLAN
 * corre normal y el usuario recibe la respuesta a lo que preguntó; si resolvemos de más, recibe una tabla de
 * cifras sobre un supuesto que nunca dio.
 *
 * (b) SE DECIDE POR LISTA BLANCA, NO POR LISTA NEGRA. Una lista de "otras métricas" es imposible de completar
 * (hoy flete, mañana bonificación, pasado tipo de cambio) y falla ABIERTA — justo del lado caro. La lista blanca
 * es el vocabulario CERRADO con el que se contesta un porcentaje: conectores, determinantes, verbos de variación
 * y el número. Si sobra una sola palabra de contenido, el turno no es una respuesta pelada. Falla CERRADA.
 *
 * ══ LA RAMA (a) TAMBIÉN FALLA CERRADA (owner 2026-08-11, segunda revisión adversarial) ═══════════════════════
 * LA GRIETA MEDIDA: la rama (a) era `_VOCAB_FALTANTE[missing].test(t)` — CONTIENE la palabra, sin importar de
 * QUIÉN sea el precio o la cantidad. Eso protegía la frase certificada («el COSTO de flete sube 4%») y no la
 * clase: la MISMA conversación con «el PRECIO del flete» volvía a imprimir la tabla sellada de once filas de
 * Samsung con un supuesto que el usuario nunca dio. 9/9 secuestros medidos con un solo sustantivo de distancia:
 * precio del flete (también a t+2, con un paréntesis en el medio), tarifa de flete, precio del combustible,
 * precio del dólar, precios de la competencia, cantidad de clientes activos, cantidad de días de stock, volumen
 * de importaciones del país. La rama (b) fallaba cerrada; la rama (a), abierta — y era la mitad que el repro
 * certificado ejercita.
 *
 * EL CIERRE, Y ES LA MISMA REGLA DE (b), NO UNA SEGUNDA: nombrar la variable que falta no alcanza; el turno tiene
 * que ser una respuesta pelada UNA VEZ QUE SE LE SACA ESE NOMBRE. Se borran del texto (1) el vocabulario de la
 * variable faltante y (2) los nombres de las entidades DEL PROPIO pendiente — hablar de la entidad que ya está
 * en la mesa no introduce ningún sujeto nuevo—, y lo que queda tiene que pasar por la MISMA lista blanca cerrada
 * de (b). «el volumen baja 2%» → «el baja 2%» → pelada, resuelve. «el precio del FLETE sube 4%» → «el del flete
 * sube 4%» → sobra "flete", NO resuelve. No hay lista negra de métricas ajenas en ninguna parte: cualquier
 * sustantivo que no sea la variable faltante ni la entidad del pendiente frena el turno, se llame flete,
 * combustible, dólar, competencia, clientes activos, días de stock o importaciones. Falla CERRADA por
 * construcción, igual que (b).
 *
 * SINÓNIMOS DE VOLUMEN (misma pasada): el residual medido mostró SIETE respuestas legítimas que se perdían por
 * contestar con un sinónimo fuera de la lista — «las ventas caen 3%», «la demanda baja 4%», «se vende 5% menos»,
 * «vendemos 3% menos», «salida 4% menor», «la rotación baja 3%», «que las ventas suban 2%». Todas contestan
 * literalmente la pregunta que ADI hizo («¿cuánto esperás que cambie el volumen o las unidades vendidas?»). Se
 * agregan al vocabulario de `unidades`. Ampliar el vocabulario YA NO ensancha la superficie de secuestro, porque
 * la rama (a) dejó de ser "contiene la palabra": «las ventas de la competencia caen 3%» sigue frenado por
 * "competencia" exactamente igual que antes. Ése es el punto del rediseño — el vocabulario puede crecer con los
 * sinónimos reales del usuario sin que crezca el riesgo. */
const _VOCAB_FALTANTE = {
  precioLista: /\bprecios?\b|\blista\s+de\s+precios\b|\btarifas?\b|\bpvp\b|\bprecio\s+de\s+lista\b/i,
  unidades: /\bunidad(?:es)?\b|\bvol[uú]men(?:es)?\b|\bcantidad(?:es)?\b|\bpiezas?\b|\bventas?\b|\bdemanda\b|\brotaci[oó]n\b|\bsalida\b|\bvend[eo]\b|\bvenden\b|\bvendemos\b|\bvendidas?\b|\bvendidos?\b/i,
};
// LA MISMA alternancia, global y con las frases largas primero, para PODAR el nombre de la variable del texto
// antes de exigirle la lista blanca. El motor de regex recorre posiciones de izquierda a derecha, así que
// "lista de precios" se consume entero al llegar a "lista" y nunca se parte en "precios" suelto.
const _VOCAB_FALTANTE_PODA = {
  precioLista: /\blista\s+de\s+precios\b|\bprecio\s+de\s+lista\b|\bprecios?\b|\btarifas?\b|\bpvp\b/gi,
  unidades: /\bunidad(?:es)?\b|\bvol[uú]men(?:es)?\b|\bcantidad(?:es)?\b|\bpiezas?\b|\bventas?\b|\bdemanda\b|\brotaci[oó]n\b|\bsalida\b|\bvend[eo]\b|\bvenden\b|\bvendemos\b|\bvendidas?\b|\bvendidos?\b/gi,
};
// el vocabulario con el que se contesta "¿cuánto esperás que cambie X?" y NADA más. Sin acentos: el tokenizador
// los quita antes de comparar, así una sola entrada cubre "más"/"mas" y "mantén"/"manten".
const _PELADA_OK = new Set([
  // conectores, determinantes, muletillas
  "y", "o", "u", "si", "que", "un", "una", "unos", "unas", "el", "la", "los", "las", "de", "del", "al", "a", "en",
  "con", "por", "para", "mas", "menos", "como", "sobre", "cerca", "casi", "aprox", "aproximadamente", "solo", "solo",
  "apenas", "tal", "vez", "quiza", "quizas", "digamos", "pongamos", "supongamos", "asumi", "asumamos", "ok", "dale",
  "bueno", "creo", "diria", "pone", "poneme", "ponele", "ahi", "eso", "esa", "ese", "algo", "nada", "no", "ni",
  "sin", "se", "le", "les", "lo", "me", "mi", "es", "sea", "ser", "esta", "va", "van", "ira", "iran",
  // pronombres y modales SIN contenido (medidos: «yo diría 3% menos» se perdía por el "yo"). Cada uno de éstos es
  // vocabulario vacío — no nombra ningún sujeto ni ninguna métrica —, así que no ensancha la superficie de riesgo.
  "yo", "te", "nos", "ya", "capaz", "seria", "serian", "podria", "podrian", "andaria", "calculo",
  // verbos de ESTIMACIÓN y comparativos puros (medidos en el residual: «estimo 3% menos de volumen» y
  // «salida 4% menor» se perdían por "estimo" y por "menor"). Ninguno nombra un sujeto ni una métrica.
  "estimo", "estimamos", "estimaria", "estimariamos", "menor", "menores", "mayor", "mayores",
  // verbos y sustantivos de VARIACIÓN (la respuesta misma)
  "sube", "suba", "suban", "suben", "subir", "subo", "subiendo", "subiria", "subirian",
  "baja", "baje", "bajen", "bajan", "bajar", "bajo", "bajando", "bajaria", "bajarian",
  "cae", "caen", "caiga", "caigan", "caer", "cayendo", "caeria", "caerian",
  "crece", "crecen", "crezca", "crezcan", "crecer", "creceria",
  "aumenta", "aumenten", "aumente", "aumentan", "aumentar", "aumento",
  "disminuye", "disminuya", "disminuyan", "disminuir", "reduce", "reduzca", "reducir", "recorta", "recorte",
  "cambia", "cambie", "cambien", "cambian", "cambiar", "cambio", "cambios",
  "mantiene", "mantienen", "mantenga", "mantengan", "mantener", "manten", "mantene", "queda", "quedan", "quede",
  "igual", "iguales", "mismo", "misma", "estable", "plano", "planas",
  "punto", "puntos", "ciento", "porciento", "pp", "porcentual", "porcentuales",
]);
const _SOLO_NUM_RE = /^[+\-−–]?\d+(?:[.,]\d+)?%?$/;
function _esRespuestaPelada(t) {
  const tokens = String(t || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // sin diacríticos: "más"→"mas", "mantén"→"manten"
    .toLowerCase()
    .replace(/[¿?¡!.,;:()"'`]/g, " ")
    .split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  return tokens.every((w) => _SOLO_NUM_RE.test(w) || _PELADA_OK.has(w));
}
// _contestaElSupuestoFaltante(text, missingCampo, propias) → ¿hay evidencia POSITIVA de que este turno contesta la
// pregunta que quedó abierta? Es lo único que autoriza a resolver el pendiente sin pasar por PLAN.
// `propias` = nombres (en minúscula) de las entidades DEL PENDIENTE. Se podan junto con el nombre de la variable
// porque no introducen ningún sujeto nuevo: la entidad ya está en la mesa desde el turno que abrió el pendiente
// («el volumen de Samsung baja 2%» contesta tan derecho como «el volumen baja 2%»). Cualquier OTRA entidad ya
// fue rechazada antes de llegar acá, por el chequeo de índice del llamador.
function _contestaElSupuestoFaltante(t, missingCampo, propias) {
  const s = String(t || "");
  const propio = _VOCAB_FALTANTE[missingCampo];
  if (propio && propio.test(s)) {
    // (a) nombra la variable que falta — y NADA MÁS que ella: se la poda y lo que queda tiene que ser pelado.
    const poda = _VOCAB_FALTANTE_PODA[missingCampo];
    let resto = poda ? s.replace(poda, " ") : s;
    for (const nombre of (propias instanceof Set ? propias : [])) {
      if (!nombre) continue;
      resto = resto.replace(new RegExp(`\\b${String(nombre).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ");
    }
    if (_esRespuestaPelada(resto)) return true;
  }
  return _esRespuestaPelada(s);                // (b) el porcentaje y su dirección, nada más
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
  // SI EL TURNO NOMBRA OTRA ENTIDAD, NO ESTÁ CONTESTANDO: ESTÁ CORRIGIENDO (Contrato v1.2 §1, owner 2026-08-10).
  // Este resolver solo miraba el porcentaje, así que "no, era Lider — bajá 5% las unidades" resolvía la simulación
  // pendiente de FALABELLA con cifras reales: el plan sintético se arma sin pasar por PLAN, la corrección nunca
  // existe para el motor, y ADI simula la entidad equivocada. Se abandona el pendiente y PLAN corre normal, que
  // es lo que este mismo mecanismo ya hace ante cualquier otra respuesta que no conteste la pregunta.
  const propias = new Set([pending.entity, ...(Array.isArray(pending.entities) ? pending.entities : [])].filter(Boolean).map((e) => String(e).toLowerCase()));
  // el índice se construye perezoso y depende del tenant activo: si no está disponible, esto no puede tumbar el
  // turno — se cae al comportamiento de siempre (falso negativo antes que un error), igual que el resto de las
  // lecturas defensivas de este archivo.
  try {
    for (const eje of ["cliente", "sku", "marca", "familia"]) {
      for (const nombre of axisEntityNames(eje)) {
        if (propias.has(String(nombre).toLowerCase())) continue;
        if (new RegExp(`\\b${String(nombre).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(t)) return null;
      }
    }
  } catch { /* sin índice disponible: no se juzga */ }
  // …Y SI NO HAY EVIDENCIA POSITIVA DE QUE ESTÁ CONTESTANDO, TAMPOCO ESTÁ CONTESTANDO (ver el bloque de arriba).
  // Esta línea es la que impide el pendiente ZOMBI mientras el pendiente VIVE — el TTL sólo acota cuánto vive.
  if (!_contestaElSupuestoFaltante(t, pending.missingCampo, propias)) return null;
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

/* ══ LA CAUSA DEL RECHAZO DETERMINÍSTICO · UN CÓDIGO, JAMÁS UN TEXTO (owner 2026-08-11) ════════════════════════
 * El emisor de telemetría del batch decía "rechazado" y dejaba `reasonCode` en null: la corrida medida tiene 10
 * eventos así, y un rechazo sin causa no se puede contar ni corregir. La causa YA existía en el turno —
 * `unsupported`, que runPlan devuelve junto al ledger— pero nadie la hilaba hasta el evento.
 *
 * POR QUÉ NO SE PASA `unsupported[].reason` TAL CUAL, que sería lo cómodo: esas razones son PROSA del motor y
 * nombran entidades del cliente («margen y rotación no se miden juntas por cliente…», «"Falabella" no existe en
 * ese eje»). El candado de telemetry.js es explícito — la causa viaja como código de LISTA CERRADA, nunca texto
 * libre — y mandar la frase para que `aReasonCode` la clasifique allá sería confiar en que un regex de siete
 * entradas no se equivoque con nuestra propia prosa (una razón que diga "entidad" saldría clasificada como
 * `guard_rejected`, que es falso). Se clasifica ACÁ, contra el REGISTRO REAL de tools (`getToolsDeclaradas`, la
 * misma lista cerrada que telemetry.js ya usa para validar el campo `tools`, poblada por toolRunner.js al cargar),
 * y sale un literal del enum. El texto de `reason` nunca se lee ni cruza el límite del módulo. Registrar en vez de
 * copiar: una lista de tools escrita acá se desincronizaría con toolRegistry.js a la primera tool nueva.
 *
 * EL LÍMITE, declarado y no disimulado: REASON_CODES no tiene ningún código para "las tools corrieron y el dato
 * no cubre lo que se preguntó", que es la causa MÁS FRECUENTE acá. Inventar un código exige editar telemetry.js
 * (otro dueño), así que ese caso sale como `unknown` — que es exactamente lo que el contrato de ese módulo manda
 * hacer con lo que no está en la lista. Es una mejora honesta sobre `null` (el evento ya no miente diciendo que no
 * hubo causa), no la clasificación completa. */
function _causaDeterministica(calls, unsupported) {
  const u = Array.isArray(unsupported) ? unsupported : [];
  // el plan no dejó NINGUNA call ejecutable: no hay evidencia porque no se pidió ninguna.
  if (!Array.isArray(calls) || !calls.length) return "invalid_plan";
  // el plan nombró una tool que el motor no tiene. FALLA ABIERTA a propósito: sin registro disponible no se
  // afirma que la tool sea inválida — se cae a `unknown`, nunca a una acusación que no se puede sostener.
  const declaradas = getToolsDeclaradas();
  if (declaradas.length) {
    const conocidas = new Set(declaradas);
    if (u.some((x) => x && !conocidas.has(String(x.tool)))) return "invalid_plan";
  }
  return "unknown";
}

// ── EL ABANDONO EXPLÍCITO (owner 2026-08-11, cierre de D3) ──────────────────────────────────────────────────────
// Con el pendiente muriendo por ESTADO y no por calendario, hace falta la puerta de salida que antes daba el
// calendario: si el usuario dice que lo deje, se deja. Red DETERMINÍSTICA angosta, con la misma disciplina que el
// resto de las regex de este archivo (_CLARIFY_RE/_PREF_*): sólo frases inequívocas de descarte, nunca una
// negación cualquiera ("no" a secas es una respuesta, no un abandono) ni un cambio de tema (ese NO abandona nada:
// es exactamente el caso que este fix existe para preservar).
// AMPLIACIÓN (owner 2026-08-11, hallazgo de la revisión adversarial): la puerta de salida no enganchaba con dos
// redacciones evidentes — «Descartá esa simulación.» y «Ya no me interesa ese escenario.» dejaban el pendiente
// VIVO. Se agregan con la MISMA disciplina angosta: el verbo exige su objeto (un pronombre o el sustantivo del
// escenario), nunca suelto — «descartá los SKU sin venta» es una instrucción sobre el DATO y no puede leerse como
// un abandono; el objeto obligatorio es lo único que separa las dos cosas.
const _ABANDONA_PENDIENTE_RE = /\bolvid[aá](?:lo|te\s+de\s+eso|emos)?\b|\bolvida\s+eso\b|\bd[eé]jalo\b|\bdej[aá]\s+(?:eso|el\s+escenario)\b|\bno\s+importa\b|\bcancel[aá](?:lo|\s+eso)?\b|\bmej[oó]r\s+no\b|\bdescart[aá](?:lo|\s+(?:eso|es[ae]\s+(?:escenario|simulaci[oó]n|supuesto)))\b|\bya\s+no\s+me\s+interesa\b/i;

// _preguntaPorFaltante(missingCampo) → la pregunta EXACTA por el supuesto que falta. UNA sola redacción para los
// tres puntos que la emiten (el arm "future", el arm "future_multi" y la red de 0% silencioso): tres copias del
// mismo string son tres oportunidades de que diverjan, y el texto de esta pregunta es parte del contrato con el
// usuario — es lo que el turno siguiente tiene que poder contestar.
function _preguntaPorFaltante(missingCampo) {
  return missingCampo === "precioLista" ? "¿cuánto esperás que cambie el precio?" : "¿cuánto esperás que cambie el volumen o las unidades vendidas?";
}
// _recordatorioPendiente(pending) — la respuesta a una aceptación ("dale") cuando NO hay oferta que ejecutar pero
// SÍ hay una simulación esperando un supuesto. Cierra el turno AUTOCONTRADICTORIO que la certificación cazó: ADI
// destruía el pendiente y en el mismo acto contestaba "no tengo un contexto previo para saber a qué te referís",
// un turno después de haber hecho ella misma la pregunta abierta. Sin cifras y sin nombrar entidades (mismo
// criterio que el resto de los textos de bypass): lo único que aporta es volver a pedir lo que falta.
function _recordatorioPendiente(pending) {
  return `Sigo esperando un supuesto para cerrar la simulación que empezamos: ${_preguntaPorFaltante(pending.missingCampo)}`;
}

// _composedBypassResult(text, mem, recentNarrationsPrev, scenario) → { r, mem } | null (null SOLO si guardC rechaza
// el mensaje fijo — no debería pasar nunca con prosa sin cifras/entidades, pero nunca se asume). Empaquetado
// compartido por los bypasses que NUNCA llegan a invocar PLAN/BATCH/NARRAR (owner 2026-07-31, cierre de #48:
// aceptación huérfana + retorno ambiguo a temas recientes) — mismo shape que el return final de answerViaOracle.
// lastOffer siempre queda null (ninguna de las dos preguntas ofrece una continuación estructurada que replicar);
// recentSubjects se hereda sin tocar (no se resolvió ninguna entidad nueva este turno).
// ── REPARACIÓN CONTEXTUAL · Contrato Conversacional v1.2 (owner 2026-08-10) ────────────────────────────────────
// Lectores DEFENSIVOS del objeto `reparacion` que emite PLAN. Nunca asumen que viene: el 99% de los turnos no lo
// trae, y un objeto mal formado del LLM no puede cambiar el comportamiento de un turno normal.
const _reparacionDe = (plan) => normalizeReparacion(plan);
// AMBIGUA = el usuario señaló un error sin decir cuál (§4). Se exige `corrige` VACÍO además del flag: si el plan
// dice a la vez "es ambigua" y "corrigió la entidad", se contradice — y ante la contradicción vale lo resuelto
// (hay algo concreto que corregir), nunca la pregunta, que dejaría al usuario contestando lo que ya contestó.
function _esReparacionAmbigua(plan) {
  const r = _reparacionDe(plan);
  return !!(r && r.ambigua);   // `ambigua` YA viene reconciliada por el normalizador: acá no se re-decide nada
}
// La otra mitad —una corrección RESUELTA, la que SÍ sabe qué cambió— no necesita un predicado acá: el guard le
// exige evidencia leyendo la reparación SELLADA (guardC.js, chequeo 20) y el estado invalida lo incompatible
// leyendo `corrige`. Un segundo criterio en este archivo sería una tercera lectura del mismo objeto.

function _composedBypassResult(text, mem, recentNarrationsPrev, scenario, conservaContexto = false) {
  const mechanismMemory = (mem && typeof mem.mechanismByEntity === "object" && mem.mechanismByEntity) || {};
  const g = guardC(text, { ledger: { figs: [] }, results: [], trace: null, question: "", mechanismMemory, sealedOrders: [] });
  if (!g.ok) return null;
  // `conservaContexto` (Contrato v1.2 §4, owner 2026-08-10) — SOLO la pregunta de precisión de una corrección
  // ambigua. El contrato es explícito: "mientras no tenga esa respuesta, NO modifica el contexto ni vuelve a
  // calcular". Los bypasses de siempre (aceptación huérfana, retorno ambiguo) SÍ deben limpiar la oferta —el
  // usuario ya intentó ejecutarla— así que el default no cambia y ningún caller existente se entera.
  if (conservaContexto) {
    return {
      r: normalizeResponse({
        text, route: "oracle",
        evidence: buildOracleEvidence({ plan: null, results: [], figs: [], scenario }),
        deterministic: true, claims: [], suggestions: null, sentrixAction: null,
      }),
      mem: { ...mem, recentNarrations: [text, ...recentNarrationsPrev].slice(0, 2) },
    };
  }
  // pendingSimulation SOBREVIVE estos bypasses, un turno más viejo (owner 2026-08-11, corrigiendo la regla de
  // 2026-07-31 que la limpiaba acá SIEMPRE). Ninguno de estos bypasses CONTESTA la simulación pendiente — pero
  // ninguno la abandona tampoco: pedir una precisión, guardar un criterio o aceptar algo huérfano son paréntesis,
  // no renuncias. Borrarla acá era destruir el contexto EN EL MISMO ACTO en que se pide precisión sobre él, y el
  // usuario no tenía forma de volver. Lo que sí gasta es plazo: el TTL corre igual, así que un pendiente olvidado
  // muere solo. El caller de supuestos_faltantes/escenario (los ÚNICOS que arman uno nuevo) lo sobreescribe
  // explícito después de llamar a esta función, igual que antes.
  let mem2 = { ...mem, lastOffer: null, pendingSimulation: envejecerPendingSimulation(mem && mem.pendingSimulation), recentNarrations: [text, ...recentNarrationsPrev].slice(0, 2) };
  // Etapa 4 (owner 2026-08-04) — SYNC del lado canónico: lastOffer=null tiene que reflejarse TAMBIÉN en
  // conversationScope.current.ofertaPendiente, o el turno SIGUIENTE (getLastOffer) leería el valor STALE de un
  // turno anterior (fromScope gana por precedencia sobre el shim mem.lastOffer — ver dialogueState.js) y un "sí"
  // ejecutaría una oferta que este bypass ya invalidó. No-op si no hay conversationScope/current que limpiar.
  if (mem2.conversationScope) mem2 = { ...mem2, conversationScope: withOfertaPendiente(mem2.conversationScope, null) };
  return {
    r: normalizeResponse({
      text,
      route: "oracle",
      evidence: buildOracleEvidence({ plan: null, results: [], figs: [], scenario }),
      deterministic: true,
      claims: [],   // estos bypasses corren con la boleta VACÍA a propósito (ver guardC arriba): no hay nada que afirmar
      suggestions: null,
      sentrixAction: null,
    }),
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
// `viewContext` (owner 2026-08-09, Contrato de Concordancia ADI ↔ Sentrix) — OPCIONAL, el CONTEXTO DE PANTALLA del
// turno (ver viewContext.js). Dos entradas, una sola verdad: el argumento explícito (caller headless/gates) o
// `uiSignals.viewContext`, que es como llega desde la UI — el hook de Sentrix lo publica con setUISignal, así que
// ADI lo recibe AUNQUE el usuario haya escrito a mano sin pulsar ningún CTA (requisito 2 del owner). No se
// construye acá ni se adivina: si no viene, el turno se comporta exactamente como hoy.
export async function answerViaOracle({ text, history = [], mem = {}, scenario = "actual", callPlan, callNarrate, maxCalls = 6, requestContext = null, uiSignals = null, viewContext = null } = {}) {
  if (typeof callPlan !== "function" || typeof callNarrate !== "function") return null;
  const q = (text || "").trim();
  if (!q) return null;
  // SELLADO AL ENTRAR — el contexto llega de la UI, así que NO se le cree nada hasta que valide: sealViewContext
  // lo verifica contra ENTITIES/METRICS/SURFACE/el manifiesto, aplica el candado O(1) y lo congela. Un contexto
  // inválido devuelve null y el turno sigue exactamente como hoy (nunca rompe, nunca se usa a medias).
  const vistaFresca = sealViewContext(viewContext || (uiSignals && uiSignals.viewContext) || null);
  // lo que quedó del turno anterior (key hermana de mem.conversationScope, escrita al final de este mismo archivo).
  const vistaPrev = (mem && mem.viewContext && typeof mem.viewContext === "object") ? mem.viewContext : null;
  // `vistaCtx` es el contexto VIGENTE para este turno. Arranca con la invalidación que se puede evaluar ANTES de
  // PLAN (tenant + TTL); después de PLAN se recalcula con la regla de cambio de tema (scope.level="global"), que
  // es la única que necesita el plan para decidirse. Ver invalidateViewContext.
  let vistaCtx = invalidateViewContext(vistaPrev, vistaFresca, { plan: null, requestContext, turno: Array.isArray(history) ? history.length : 0 });
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
  // `let` y no `const` (Contrato v1.2 · reparación contextual, owner 2026-08-10): estos tres son EL CONTEXTO DEL
  // TURNO ANTERIOR, y una corrección puede dejar parte de él sin efecto. Se leen acá tal cual —los bypasses de
  // más abajo (aceptación huérfana, retorno posicional) corren ANTES del plan y tienen que ver el estado real— y
  // se REEMPLAZAN por su versión reparada en un único punto, apenas el plan declara qué corrigió el usuario. Sin
  // eso, el narrador seguía recibiendo la oferta y los temas de la entidad equivocada (ver applyRepairToScope).
  let priorOffer = getLastOffer(mem);
  let recentSubjectsPrev = getRecentSubjects(mem);
  // EL MODO DEL HILO NO ES CONTEXTO DE LA ENTIDAD CORREGIDA (owner 2026-08-10, revisión de la sección 8).
  // _coerceMode hereda el modo del sujeto más reciente ante una elipsis; si lee la lista YA reparada, corregir
  // "no, era Lider" después de "¿qué recomendás para Falabella?" pierde el mode=decision y el usuario recibe un
  // dato pelado cuando seguía pidiendo una recomendación. Se conserva la lista original SOLO para esa inferencia:
  // cómo veníamos hablando no es una propiedad de la entidad que se corrigió.
  const recentSubjectsParaModo = recentSubjectsPrev;
  const recentNarrationsPrev = Array.isArray(mem && mem.recentNarrations) ? mem.recentNarrations : [];
  // conversationScope (Etapa 1, ver conversationScope.js) — leído ACÁ, ANTES de PLAN, mismo principio que
  // priorOffer/recentSubjectsPrev arriba: el estado del turno ANTERIOR es lo único que puede autorizar una
  // resolución determinística de referencia en ESTE turno.
  let conversationScopePrev = (mem && mem.conversationScope && typeof mem.conversationScope === "object") ? mem.conversationScope : emptyConversationScope();
  // pendingSimulation (ver el bloque grande junto a _hasCompleteSimulateVars): intenta resolver la respuesta de
  // ESTE turno contra la simulación de 2 variables que quedó pendiente. resolvedPendingSim==null → o no había
  // pendiente, o el texto no la contesta (cambio de tema, "no sé") — el turno NO la resuelve y PLAN corre normal
  // más abajo. OJO (owner 2026-08-11): "no la resuelve" YA NO significa "la borra" — ver el ciclo de vida por
  // estado en conversationScope.js. Acá se juzga el pendiente UNA sola vez, y el resultado se escribe de vuelta en
  // `mem` para que TODO lo que sigue (los bypasses, el payload de PLAN/NARRAR, la memoria del turno) vea el MISMO
  // pendiente ya juzgado — un pendiente vencido o abandonado no puede seguir vivo en un rincón del turno.
  const pendingSimulationPrev = _ABANDONA_PENDIENTE_RE.test(q)
    ? null   // el usuario lo descartó con todas las letras: se abandona acá, antes de que nadie más lo mire
    : pendingSimulationVigente(mem && mem.pendingSimulation);
  if (pendingSimulationPrev !== ((mem && mem.pendingSimulation) || null)) mem = { ...(mem || {}), pendingSimulation: pendingSimulationPrev };
  // EL TURNO QUE DECLARA SU PROPIO ESCENARIO NO ESTÁ CONTESTANDO EL PENDIENTE (owner 2026-08-11). "Sube 8% el
  // precio de Sodimac" trae campo+% Y entidad: es un escenario nuevo (o una corrección del mismo), no la respuesta
  // a "¿cuánto cambia el volumen?". Sin esta distinción, con el pendiente vivo, _resolvePendingSimulation le
  // asignaría ese 8% a la variable FALTANTE (el volumen) — el usuario diría "precio" y el motor entendería
  // "volumen". Se resuelve con el MISMO detector determinístico que ya gobierna la entrada a simulate v2, nunca
  // con una segunda lectura del texto: si el turno declara escenario, va por la vía de fusión de más abajo.
  const scenarioIntent = detectScenarioIntent(q, conversationScopePrev.current);
  const declaraEscenarioPropio = scenarioIntent.kind === "future" || scenarioIntent.kind === "future_multi";
  // fusión con el pendiente vivo — la REGLA DE PRECEDENCIA (misma entidad → completar/actualizar · otra entidad →
  // reemplazar), que es lo que impide que el pendiente se re-arme DEGRADADO perdiendo el supuesto ya aportado.
  const fusionEscenario = (pendingSimulationPrev && declaraEscenarioPropio)
    ? fusionarPendientes(pendingSimulationPrev, pendienteDesdeEscenario(scenarioIntent))
    : null;
  const resolvedPendingSim = (fusionEscenario && fusionEscenario.accion === "completa")
    ? fusionEscenario.vars   // el turno aportó justo la variable que faltaba: la simulación ya está completa
    : (pendingSimulationPrev && !declaraEscenarioPropio) ? _resolvePendingSimulation(q, pendingSimulationPrev) : null;

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
    // pendingSimulation SOBREVIVE (owner 2026-08-11, mismo cambio que en _composedBypassResult): fijar un criterio
    // ("recordá que mi margen mínimo es 25%") ni siquiera es un cambio de tema — es una preferencia, y no tiene
    // nada que decir sobre la simulación que quedó a medio armar. Borrarla acá era el caso más absurdo de los
    // tres: cero llamadas al proveedor, cero relación con el escenario, y el pendiente igual moría.
    let mem2 = { ...mem, lastOffer: null, pendingSimulation: envejecerPendingSimulation(pendingSimulationPrev), recentNarrations: [cr.text, ...recentNarrationsPrev].slice(0, 2) };
    // Etapa 4 (owner 2026-08-04) — mismo SYNC que _composedBypassResult: lastOffer=null también limpia el lado
    // canónico, para que getLastOffer no resucite una oferta ya invalidada por este bypass.
    if (mem2.conversationScope) mem2 = { ...mem2, conversationScope: withOfertaPendiente(mem2.conversationScope, null) };
    return {
      r: normalizeResponse({
        text: cr.text,
        route: "oracle",
        evidence: cr.evidence,
        deterministic: true,
        claims: [],   // confirmación administrativa: las cifras son las que el usuario nombró, no hay boleta que afirmar
        suggestions: cr.suggestions || null,
        sentrixAction: cr.sentrixAction || null,
      }),
      mem: mem2,
    };
  }

  // ── ACEPTACIÓN HUÉRFANA (owner 2026-07-31, cierre de #48) — "sí"/"dale" SIN ninguna oferta activa: "no debe
  // repetir la respuesta anterior; debe pedir una precisión breve o mostrar las opciones vigentes." Medido en vivo
  // (adi-fase3-orientacion-inicial.md): dejarlo en manos del narrador producía una respuesta casi idéntica a la
  // anterior — exactamente lo que esto cierra. Bypasea PLAN/BATCH/NARRAR ENTERO, nunca narra libre (mismo principio
  // de garantía-por-construcción que data_only/results_only): si guardC rechazara el mensaje fijo (no debería, es
  // prosa sin cifras ni entidades), cae de largo a PLAN normal en vez de abstenerse en silencio.
  // NO ES HUÉRFANA SI ADI DEJÓ UNA PREGUNTA ABIERTA (owner 2026-08-11, turno autocontradictorio de la
  // certificación): con una simulación esperando un supuesto, "dale" no cae en el vacío — el contexto previo
  // EXISTE y es de ADI misma. Contestar "no tengo un contexto previo para saber a qué te referís" mientras se
  // borra ese mismo contexto es la única respuesta que no puede ser cierta. Se le recuerda qué falta, que es lo
  // que "dale" no alcanza a contestar (no es una respuesta al supuesto: es un sí a nada concreto).
  if (isAcceptance(q) && !priorOffer) {
    const composed = pendingSimulationPrev ? _recordatorioPendiente(pendingSimulationPrev) : composeOrphanAcceptance(recentSubjectsPrev);
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
    // scenarioIntent (Etapa 3, ver scenarioIntent.js) YA está resuelto arriba, con el MISMO conversationScope.
    // current que Etapa 1 usa para deícticos de lectura — se calcula una sola vez por turno porque ahora también
    // gobierna la fusión con el pendiente vivo (ver `fusionEscenario`), y dos llamadas al mismo detector puro
    // serían dos lugares donde el turno podría leerse distinto a sí mismo.
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
    // EL PENDIENTE VIVO NO SE PISA, SE FUSIONA (owner 2026-08-11): si ya había una simulación esperando un
    // supuesto sobre la MISMA entidad, este turno la ACTUALIZA (re-declaró el mismo supuesto con otro número) en
    // vez de re-armarla desde cero — que era la degradación medida: el pendiente de Sodimac con precio +8% quedaba
    // reemplazado por uno con volumen 0%, y el +8% que el usuario había dado desaparecía sin que nadie lo dijera.
    // El caso "completa" (aportó justo la variable que faltaba) ni llega acá: `resolvedPendingSim` ya lo reclamó
    // arriba y este bloque entero está gateado por él.
    if (scenarioIntent.kind === "future") {
      const { entity, dimension, variable } = scenarioIntent;
      const nuevo = { dimension: dimension || "cliente", entity, entities: [entity], known: variable, missingCampo: variable.campo === "precioLista" ? "unidades" : "precioLista" };
      const fusionado = (fusionEscenario && fusionEscenario.pending) || nacePendingSimulation(nuevo);
      const out = _composedBypassResult(`${_preguntaPorFaltante(fusionado.missingCampo)} No quiero asumir que se mantiene sin cambios, sin que me lo confirmes.`, mem, recentNarrationsPrev, scenario);
      if (out) {
        out.mem = { ...out.mem, pendingSimulation: fusionado };
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
      const nuevo = { dimension: dimension || "cliente", entity: entities[0], entities, known: variable, missingCampo: variable.campo === "precioLista" ? "unidades" : "precioLista" };
      const fusionado = (fusionEscenario && fusionEscenario.pending) || nacePendingSimulation(nuevo);
      const out = _composedBypassResult(`${_preguntaPorFaltante(fusionado.missingCampo)} No quiero asumir que se mantiene sin cambios, sin que me lo confirmes.`, mem, recentNarrationsPrev, scenario);
      if (out) {
        out.mem = { ...out.mem, pendingSimulation: fusionado };
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
    // ── EL RESULTADO DEL NEGOCIO (owner 2026-08-09 · decisión 3 · hallazgo L) ────────────────────────────────
    // ÚLTIMA rama de la cadena a propósito: sólo entra cuando ninguna de las de arriba reclamó el turno, así que
    // ni la aceptación de una oferta, ni el retorno posicional, ni una simulación pendiente cambian de comporta-
    // miento. Lo que cierra: "¿cuál es el resultado del negocio después de gastos?" (y estado de resultados /
    // utilidad / P&L) no las reclama `detectPnlIntent` —la red del flujo guiado, que sigue intacta— así que
    // llegaban acá, PLAN elegía contributionRead y ADI contestaba la CONTRIBUCIÓN como si fuera el resultado:
    // dos niveles financieros distintos, cifra real, pregunta equivocada. Con el lenguaje inequívoco el plan lo
    // arma el motor (mismo principio que los tres bypasses de arriba: lo determinístico no se le delega al LLM) y
    // PLAN ni se invoca; con lenguaje ambiguo `pnlOraclePlan` devuelve null y PLAN decide normal — `pnlRead` ya
    // está en su catálogo. La lectura la resuelve `composePnl`, el contrato de siempre: una sola verdad.
    : pnlOraclePlan(q)
    || null;
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
  // COERCIONES DEL VOCABULARIO DEL PLAN (owner 2026-08-10): valores fuera de enum que el motor reparó o descartó.
  // Vocabulario CERRADO nuestro (nombres de campo y de enum), nunca texto del usuario — viaja en retryTrace, que
  // es el canal de observación que ya existe. Sin esto, el modelo puede inventar un valor y nadie se entera hasta
  // que alguien paga una certificación para descubrirlo.
  const planCoerciones = [];
  // CONTEXTO DE PANTALLA → PLAN (owner 2026-08-09): UNA LÍNEA de ≤240 caracteres, sin una sola cifra de negocio.
  // Es TODO lo que el LLM ve de Sentrix — nunca la salida del builder, nunca filas, nunca series, nunca el objeto.
  // Con eso alcanza para que "explicame este gráfico" tenga referente y para que PLAN pida a las tools la evidencia
  // de ESA métrica, ESE eje y ESE período. `null` cuando no hay panel abierto → el mensaje de PLAN queda
  // byte-idéntico al de siempre (ver planPrompt.js:buildPlanUserMessage, tercer argumento opcional).
  const vistaLinea = projectViewContextForPlan(vistaCtx);
  if (!plan) {
    let modelAttempt = 0;   // ver "CONTADOR DE MODELO ≠ CONTADOR DE BACKOFF" arriba — NUNCA avanza ante un 429/error de infra
    for (let attempt = 0; attempt < 3; attempt++) {
      let p;   // , no const: la coerción de vocabulario lo reemplaza por una copia corregida
      try { p = await callPlan({ text: q, history, mem, scenario, requestContext, vistaLinea, attempt: modelAttempt }); }
      catch (e) {
        // FALTA DE CRÉDITO: NI SE REINTENTA NI SE ESCALA (owner 2026-08-11, defecto 1). Esperar no lo arregla y
        // subir de modelo lo encarece: la única conducta correcta es cortar el turno y dejar que el caller detenga
        // la corrida. Se propaga con su código para que el arnés lo registre como `billing_exhausted` y no lo
        // confunda con el ruido de red — 26 turnos de la certificación final quedaron marcados como fallidos
        // cuando en realidad nunca llegaron a ejecutarse.
        if (_esSinCredito(e)) { planAttemptTrace.push({ attempt, ok: false, reason: "billing_exhausted (sin crédito)", usage: null }); throw e; }
        const rateLimited = e && e.code === "rate_limited";
        planAttemptTrace.push({ attempt, ok: false, reason: rateLimited ? "rate_limited (429)" : "error de red/gateway", usage: null });
        const wait = _rateLimitBackoffMs(e);
        if (wait) await _sleep(wait);
        if (!rateLimited && _isPlanContentError(e)) modelAttempt++;   // JSON inválido/sin tool_call → SÍ es calidad, escala
        continue;
      }
      if (!p || !p.intent) { planAttemptTrace.push({ attempt, ok: false, reason: "plan inválido/sin intent", usage: (p && p.usage) || null }); modelAttempt++; continue; }
      // ── COERCIÓN DEL VOCABULARIO (owner 2026-08-10, hallazgo de la 2ª corrida pagada) ─────────────────────────
      // Corre ACÁ, antes que nada: antes del backstop de redirect-sin-calls (que juzga el intent), antes de
      // normalizeReparacion (que lo exige) y antes de cualquier coerción de este archivo. `tool_choice` forzado
      // garantiza JSON válido contra el schema; NO garantiza que el modelo respete un enum. Se comprobó pagando:
      // emitió `intent:"correccion"` con la reparación perfectamente armada al lado, y el motor la tiró entera.
      // La coerción es POR TIPO (ver normalizeIntent) y conserva íntegros `ambigua`, `pregunta`, `corrige` y
      // `calls`: repara el vocabulario, nunca el contenido.
      // UN SOLO PUNTO: migra la clase que el modelo escribió en `intent` a `reparacion.tipo` (medido tres veces
      // en vivo: los dos campos son vecinos y describen cosas distintas) y después coerciona `intent` por la tabla
      // canónica. Lo declarado manda sobre lo deducido, y el contenido sale íntegro.
      const _cv = coerceVocabularioPlan(p);
      if (_cv.coerciones.length) planCoerciones.push(..._cv.coerciones);
      p = _cv.plan;
      // MODO fuera del enum: no se coerciona acá (eso lo hace _coerceMode más abajo, con el contexto del turno),
      // pero se DECLARA — un vocabulario inventado que se descarta en silencio es cómo se llega a pagar una
      // certificación para descubrirlo.
      if (p.mode != null && !MODE_KEYS.includes(p.mode)) planCoerciones.push(`mode-invalido(${String(p.mode).slice(0, 24)})`);
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
      // EXCEPCIÓN · LA CORRECCIÓN AMBIGUA (Contrato v1.2 §4.1, owner 2026-08-10). Un redirect sin calls dejó de ser
      // siempre un plan roto: cuando el usuario dice que algo está mal SIN decir qué, la respuesta CORRECTA es una
      // sola pregunta de precisión, sin datos y sin recalcular nada — y un plan que hace exactamente eso llega acá
      // con `calls` vacío. Sin esta excepción el backstop lo descartaba, escalaba de modelo y pagaba hasta tres
      // llamadas de PLAN por turno para terminar, en el mejor caso, en el mismo lugar. El backstop original sigue
      // intacto para todo lo demás, que es lo que de verdad medía: un redirect RESUELTO que se olvidó de las calls.
      if (p.intent === "redirect" && !(Array.isArray(p.calls) && p.calls.length) && !_esReparacionAmbigua(p)) { planAttemptTrace.push({ attempt, ok: false, reason: "redirect sin calls", usage: (p && p.usage) || null }); modelAttempt++; continue; }
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
  // ── CONTEXTO DE PANTALLA · INVALIDACIÓN DEFINITIVA DEL TURNO (owner 2026-08-09) ─────────────────────────────
  // Recién ACÁ existe el plan, y con él la única señal de CAMBIO REAL DE TEMA que este motor reconoce
  // (scope.level="global", la misma que ya usa updateConversationScope — no se inventa un segundo clasificador).
  // Si el usuario dijo "el negocio"/"en general", el contexto anterior NO puede contaminar nada: se descarta acá,
  // y con eso desaparece de la deixis, del backstop de alcance, del payload de NARRAR y de la memoria del turno.
  vistaCtx = invalidateViewContext(vistaPrev, vistaFresca, { plan, requestContext, turno: Array.isArray(history) ? history.length : 0 });
  // vcProj: la proyección ESTRUCTURAL para el motor (entidades/filtros/evidencia declarada). Nunca va al prompt.
  const vcProj = projectViewContextForCoercion(vistaCtx);
  // referencia de COMPONENTE ("explicame este gráfico") — solo LOCALIZA la pieza; no trae ni una cifra. Su
  // consumidor es la forma de la respuesta (resolveAnswerShape más abajo) y el backstop de alcance de acá.
  const compRef = resolveComponentReference(q, vistaCtx);

  // ── REPARACIÓN CONTEXTUAL · Contrato Conversacional v1.2 (owner 2026-08-10) ──────────────────────────────────
  // EL PUNTO ÚNICO. Corre acá, apenas el plan existe y ANTES de todo lo que consume el contexto anterior (la
  // resolución de referencias, el batch, la memoria que ve el narrador): es lo que hace que "conservar solo lo
  // compatible" sea una propiedad del estado y no una esperanza del prompt.
  //
  // (a) CORRECCIÓN AMBIGUA (§4) → una sola pregunta de precisión y se corta acá: sin batch, sin narrador, sin
  //     tocar el contexto. Mismo mecanismo de corte que supuestos_faltantes ya usaba para la simulación
  //     incompleta — no se inventa un camino nuevo para preguntar. La pregunta la redacta PLAN con el contexto
  //     del turno; composePrecisionQuestion es la red determinística para cuando no la trae.
  // (b) CORRECCIÓN RESUELTA → se apaga del estado canónico lo que dejó de ser compatible y se reemplazan los tres
  //     portadores del contexto anterior. La oferta es el caso que más se notaba: sin esto, el narrador de un
  //     turno que corrige "no, era Lider" seguía leyendo en su memoria "tu última oferta fue … (sobre Falabella)"
  //     y "temas recientes: Falabella" — la combinación silenciosa que §1 prohíbe.
  // (c) DESACUERDO / DATO APORTADO → NO invalidan nada (applyRepairToScope los devuelve tal cual): el alcance no
  //     cambió. Lo que cambia es cómo se narra, y eso viaja sellado en el contrato de narración.
  // LA REPARACIÓN TAMBIÉN LLEGA A LAS RUTAS QUE NO CONSULTAN A PLAN (owner 2026-08-10, cierre general — la que se
  // notaba era la lectura determinística del P&L). Ahí `plan.reparacion` no puede existir: el objeto lo emite PLAN
  // y PLAN no corrió. `inferirCorrige` no mira el texto del usuario ni agrega una llamada: compara el alcance
  // canónico del turno anterior contra el que este plan resolvió y nombra qué campos del contrato cambiaron. Si no
  // cambió nada devuelve vacío y la ruta determinística queda idéntica — una consulta normal no paga ni cambia.
  // Se hace ANTES del batch, en el mismo punto donde el resto de la reparación se aplica, para que la invalidación
  // llegue a la memoria que ve el narrador y no solo al estado que se persiste.
  let _reparacion = _reparacionDe(plan);
  // ── EL RESPALDO ESTRUCTURAL (owner 2026-08-10, tras la primera corrida pagada) ────────────────────────────────
  // LA CERTIFICACIÓN LO CAZÓ EN LA PRIMERA SONDA: el planificador respondió bien —trajo las calls, el batch corrió,
  // el guard no rechazó nada— pero NO emitió el objeto `reparacion`. Era un campo opcional del esquema, así que
  // toda la conducta del contrato colgaba de que el modelo se acordara de llenarlo. Ahora el esquema lo exige
  // (y admite `null`), y además el motor tiene un respaldo por si igual llega vacío.
  //
  // NO MIRA EL TEXTO. `inferirCorrige` compara DOS ESTRUCTURAS —el alcance canónico anterior contra el que este
  // plan resolvió— y nombra qué campos del contrato cambiaron. Es el patrón de siempre acá: el modelo es el
  // mecanismo principal, el respaldo determinístico cubre lo que omite.
  //
  // DÓNDE PUEDE ACTIVARSE, y es angosto a propósito:
  //   · con `intent="redirect"` y sin reparación declarada — el turno DICE que reencauza pero no dice qué;
  //   · con un plan SINTÉTICO (rutas que no consultan al planificador, donde nadie pudo declararla).
  // DÓNDE NO: en una consulta normal (`intent="answer"` no sintético, ni siquiera se evalúa), en un desacuerdo o
  // en un dato aportado (ahí `_reparacion` YA existe con su tipo, así que este bloque no corre), y en un cambio
  // de tema, que llega como `answer` y por lo tanto tampoco.
  //
  // SI LA DIFERENCIA NO ALCANZA, ES AMBIGUA. Un redirect sin reparación declarada Y sin ningún cambio estructural
  // que leer significa que el usuario reencauzó algo que no podemos ver: adivinar ahí sería exactamente lo que §1
  // prohíbe. Se trata como corrección ambigua — una sola pregunta de precisión, sin recalcular y sin narrar.
  const _puedeInferir = !_reparacion && (planWasSynthetic || plan.intent === "redirect");
  if (_puedeInferir) {
    const _inferido = inferirCorrige(conversationScopePrev, plan);
    // ¿LAS CALLS REPETIRÍAN EL ALCANCE VIGENTE? (owner 2026-08-11, defecto 9 de la certificación).
    // El caso medido: turno 2 «no, quiero verlo para Falabella», turno 3 «eso está mal» → el planificador emitió
    // `{intent:"redirect", calls:["pnlRead"]}` SIN `reparacion`. `inferirCorrige` leyó la AUSENCIA de entidad como
    // un cambio estructural —de Falabella a nadie— y el motor la trató como corrección resuelta: ejecutó pnlRead y
    // adivinó qué estaba mal en vez de preguntar. Pero un plan que vuelve a la MISMA tool con el MISMO alcance no
    // corrigió nada: repetiría el turno que el usuario acaba de decir que está mal, y pagarlo es pagar por
    // repetirse. La condición se evalúa sobre la ESTRUCTURA del plan, nunca sobre el texto del usuario: acá no se
    // detecta ninguna frase, se compara alcance contra alcance.
    const _prevTool = (conversationScopePrev && conversationScopePrev.current && conversationScopePrev.current.tool) || null;
    const _callsRepiten = Array.isArray(plan.calls) && plan.calls.length > 0 && _prevTool
      && plan.calls.every((c) => c && c.tool === _prevTool)
      // y no introducen sujeto nuevo: si el plan nombra una entidad o dimensión que el alcance vigente no tenía,
      // ES un cambio de tema legítimo y tiene que seguir de largo como hasta hoy.
      && !plan.calls.some((c) => {
        const a = (c && c.args) || {};
        const ent = a.entity || a.entidad || null;
        const prevEnt = (conversationScopePrev.current.entities || [])[0] || null;
        return (ent && ent !== prevEnt) || (a.dimension && a.dimension !== conversationScopePrev.current.dimension);
      });
    if (_inferido.length && !_callsRepiten) {
      _reparacion = { tipo: "correccion", corrige: _inferido, ambigua: false, pregunta: null, dato: null, aceptado: false, inferida: true };
    } else if (plan.intent === "redirect" && !planWasSynthetic) {
      _reparacion = { tipo: "correccion", corrige: [], ambigua: true, pregunta: null, dato: null, aceptado: false, inferida: true };
    }
  }
  // `calls` VACÍO ADEMÁS DEL FLAG (owner 2026-08-10, revisión de la sección 8): si el plan se declara ambiguo pero
  // trajo calls, se contradice igual que cuando declara `corrige` — y descartar un batch bueno para preguntar algo
  // le cuesta al usuario un turno entero. Ante la contradicción vale siempre lo RESPONDIBLE.
  // DOS CAMINOS A LA PREGUNTA DE PRECISIÓN, y la diferencia importa:
  //   · DECLARADA por el planificador → se exige `calls` vacío. Si trajo calls se contradice, y ante la
  //     contradicción vale lo respondible: descartar un batch bueno le cuesta un turno entero al usuario.
  //   · INFERIDA por el motor (redirect sin reparación y sin ningún cambio estructural) → se corta AUNQUE haya
  //     calls, y no es la misma decisión: acá el motor SABE que el alcance no cambió, así que esas calls
  //     reproducirían el turno que el usuario acaba de decir que está mal. Ejecutarlas es pagar por repetirse.
  //   · DECLARADA CON SU PREGUNTA ESCRITA → manda la ambigüedad y las calls se descartan (owner 2026-08-10, tras
  //     la 4ª corrida). La regla anterior decía "ante la contradicción vale lo respondible", y se midió lo que
  //     costaba: el planificador declaró `ambigua`, escribió la pregunta Y trajo calls, el motor prefirió las
  //     calls, y el turno gastó CUATRO llamadas —con dos rechazos del guard y una escalada al modelo más caro—
  //     para responder donde §4 manda preguntar ("mientras no tenga esa respuesta, no vuelve a calcular").
  //     Una declaración de ambigüedad CON la pregunta ya redactada es una señal mucho más fuerte que unas calls
  //     sueltas: son dos campos coherentes entre sí contra uno que las contradice.
  const _repAmbigua = !!(_reparacion && _reparacion.ambigua);
  const _preguntaValida = !!(_reparacion && typeof _reparacion.pregunta === "string" && _reparacion.pregunta.includes("?"));
  const _sinCalls = !(Array.isArray(plan.calls) && plan.calls.length);
  const _cortaPorAmbigua = _repAmbigua && (_sinCalls || _preguntaValida || _reparacion.inferida === true);
  if (!planWasSynthetic && _cortaPorAmbigua) {
    // stripLanguageLeaks (owner 2026-08-10, defecto 4 de la certificación live): la pregunta la REDACTA el LLM y
    // los prompts que lo guían están escritos en voseo — sin esto sale «decime cuál» en un producto cuyo registro
    // es tuteo neutro. Es la MISMA garantía de runtime que ya se le aplica a toda narración libre; acá se extiende
    // al único texto nuevo que el LLM escribe fuera del loop de NARRAR. No es una capa: es la función que existe.
    const pregunta = stripLanguageLeaks(composePrecisionQuestion(conversationScopePrev, _reparacion));
    // DOS CANDIDATAS, NUNCA UN SILENCIO (owner 2026-08-10): la pregunta que redacta el LLM puede citar la cifra en
    // disputa («¿el $13.3M que te mostré, o el período?») y este bypass corre con la boleta vacía, así que guardC
    // la rechaza como cifra no autorizada y devolvía null — el turno seguía de largo y el usuario recibía "no
    // tengo información" en vez de la pregunta. La red es la versión determinística, que no cita ninguna cifra.
    const _propia = composePrecisionQuestion(conversationScopePrev, null);
    for (const candidata of [pregunta, stripLanguageLeaks(_propia)]) {
      const out = _composedBypassResult(candidata, mem, recentNarrationsPrev, scenario, true);
      // LA TRAZA VIAJA TAMBIÉN POR ACÁ (owner 2026-08-10): este corte devuelve su propia respuesta, así que sin
      // esto una corrección ambigua perdía el registro de lo que pasó — incluidas las coerciones de vocabulario,
      // que son justo lo que hay que poder ver cuando el modelo emite algo fuera de enum. Un turno que se corta
      // es el que más necesita dejar rastro, no el que menos.
      if (out) {
        if (planAttemptTrace.length || planCoerciones.length) {
          out.r = { ...out.r, retryTrace: { plan: planAttemptTrace, narrate: [], ...(planCoerciones.length ? { coerciones: planCoerciones } : {}) } };
        }
        return out;
      }
    }
  }
  // sin `!planWasSynthetic`: la INVALIDACIÓN vale igual venga la reparación declarada por PLAN o inferida de la
  // estructura. Lo que sigue reservado al plan real es el corte por ambigüedad de arriba — un plan sintético no
  // puede ser ambiguo, porque nadie interpretó nada.
  if (_reparacion) {
    if (Array.isArray(_reparacion.corrigeDescartado) && _reparacion.corrigeDescartado.length) {
      planCoerciones.push(`corrige-descartado(${_reparacion.corrigeDescartado.join("+")})`);
    }
    const scopeReparado = applyRepairToScope(conversationScopePrev, _reparacion);
    if (scopeReparado !== conversationScopePrev) {
      // las entidades que la reparación dejó sin efecto, leídas del ANTES vs. el DESPUÉS del propio estado.
      const _antes = (conversationScopePrev.current && conversationScopePrev.current.entities) || [];
      const _despues = new Set((scopeReparado.current && scopeReparado.current.entities) || []);
      const _retiradas = _antes.filter((e) => !_despues.has(e));
      conversationScopePrev = scopeReparado;
      // el SHIM también se filtra (defecto real): con una `mem` persistida antes del dual-write de Etapa 4 el
      // scope no trae `recentSubjects`, se caía a la lista sin filtrar y la entidad corregida seguía viva como
      // "tema reciente" — el canal exacto que §7 cierra.
      recentSubjectsPrev = Array.isArray(scopeReparado.recentSubjects)
        ? scopeReparado.recentSubjects
        : recentSubjectsPrev.filter((s) => !(s && _retiradas.includes(s.entidad)));
      // la oferta muere con la evidencia que la sostenía (§3.6): si `ofertaPendiente` no sobrevivió a esta
      // corrección, tampoco puede sobrevivir el shim `mem.lastOffer` — son dual-write de lo mismo (Etapa 4), y
      // dejar uno vivo reabriría la divergencia que ese dual-write existe para impedir.
      if (!(scopeReparado.current && scopeReparado.current.ofertaPendiente)) priorOffer = null;
    }
  }

  if (!planWasSynthetic) {
    const scopeRef = resolveConversationReference(q, plan, conversationScopePrev, requestContext, uiSignals, vistaCtx);
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
    } else if (scopeRef.kind === "resolved-scope") {
      // EL CAMINO O(1): la referencia se resolvió a un CRITERIO, no a una lista de nombres ("cuáles de estos
      // clientes" sobre 300 filas). Viaja como args.filters de las tools que lo aceptan — NUNCA como
      // scope.entities, que obligaría a materializar los 300 nombres que el contrato prohíbe transportar.
      const f = scopeRef.filtros && typeof scopeRef.filtros === "object" ? scopeRef.filtros : null;
      if (f && Object.keys(f).length) {
        plan = { ...plan, calls: (Array.isArray(plan.calls) ? plan.calls : []).map((c) => {
          if (!c || !_ENTITY_FILTER_TOOLS.has(c.tool)) return c;
          const args = (c.args && typeof c.args === "object" && !Array.isArray(c.args)) ? c.args : {};
          if (args.filters && typeof args.filters === "object" && Object.keys(args.filters).length) return c;
          return { ...c, args: { ...args, filters: { ...f } } };
        }) };
      }
    }
  }

  // `calls` puede faltar en intent=ack/define (el modelo lo omite cuando no pide datos) → default [] (NO es abstención).
  // OJO: `plan` se REEMPLAZA (no solo la variable local `calls`) — buildNarrateUserMessageC recibe `plan` completo
  // más abajo, y si solo corregíamos la variable suelta, el narrador seguía viendo plan.calls SIN corregir (bug real
  // cazado en el propio testing de este fix: el batch corría bien pero el narrador quedaba desincronizado del dato).
  const hasThread = (Array.isArray(history) && history.length > 0) || recentNarrationsPrev.length > 0 || !!priorOffer;
  plan = { ...plan, calls: _coerceEntityScopedFilters(plan, _coerceTensionArgs(q, Array.isArray(plan.calls) ? plan.calls : [])), mode: _coerceMode(q, plan, hasThread, recentSubjectsParaModo) };
  // CONTEXTO DE PANTALLA → ALCANCE Y EVIDENCIA (owner 2026-08-09, ver _coerceViewScope arriba). Corre ACÁ, entre
  // _coerceEntityScopedFilters y applySingleEntityScope, a propósito: lo que este backstop fija en plan.scope lo
  // recogen después las dos etapas de entityScope que ya existen (N=1 y N>1) sin ningún mecanismo nuevo, y lo que
  // siembra en plan.calls entra al batch como cualquier otra call. Es inerte en todo turno sin panel abierto.
  if (!planWasSynthetic && vcProj) plan = _coerceViewScope(plan, vcProj, q, maxCalls, compRef);
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
        // CAPITAL LIGADO · sólo si el dato sostiene la relación cliente×SKU (owner 2026-08-09, decisión 9): con
        // el tenant demo esa relación es una afinidad modelada que alcanza TODO el inventario, así que la tool
        // declina — agregarla igual gastaba un slot del plan en una call que no puede responder. La medición es
        // la MISMA que usa el composer (clientCapitalRelacion), nunca un criterio paralelo.
        const hasCapitalLigado = plan.calls.some((c) => c && c.tool === "entityCapitalLigado" && (c.entity || (c.args && c.args.entity)) === entity);
        if (!hasCapitalLigado && clientCapitalRelacion({ entity, scenario }).estado !== "unsupported") {
          extra.push({ tool: "entityCapitalLigado", args: { dimension: "cliente", entity } });
        }
      }
      const room = Math.max(0, maxCalls - plan.calls.length);
      if (room > 0 && extra.length) plan = { ...plan, calls: [...plan.calls, ...extra.slice(0, room)] };
    }
  }
  // ── DIVULGACIÓN PROGRESIVA (owner 2026-08-07) ────────────────────────────────────────────────────────────────
  // Corre DESPUÉS del backstop de arriba a propósito: así poda tanto lo que el backstop agregó como lo que el
  // propio PLAN pidió — un solo punto de decisión, no dos criterios que se puedan separar. Y corre ANTES de
  // runPlan, que es lo que hace que esto AHORRE de verdad: la tool de detalle no se ejecuta, sus cifras nunca
  // existen y nunca llegan al narrador. Esconder la tabla en la UI no ahorraría un solo token.
  const _disclosure = podarPlanProgresivo(plan, q);
  plan = _disclosure.plan;
  // `let` (owner 2026-08-11): la fusión con la simulación pendiente puede completar el plan de este turno —
  // ver el bloque de supuestos_faltantes justo abajo. Nadie más lo reasigna.
  let calls = plan.calls;

  // ── supuestos_faltantes → request_clarification (owner 2026-07-31, #56 "simulate v2") ── PLAN detectó un pedido
  // de simulación de 2 variables con UNA sola nombrada (ver planPrompt.js) — esto corta ANTES del batch, sin tocar
  // el dato, mismo principio de garantía-por-construcción que la aceptación huérfana/retorno ambiguo de arriba:
  // nunca se narra libre una pregunta de aclaración (el LLM podría inventar qué falta o asumir 0% en silencio).
  // ver _silentZeroSupuestoFaltante arriba: red determinística para cuando el LLM, en vez de usar
  // supuestos_faltantes, asume 0% en silencio en la variable que el usuario no nombró — hallazgo EN VIVO, no
  // hipotético. El LLM manda (mecanismo principal); esto es SOLO la red, igual que el resto de _coerce* del archivo.
  let referenciaResuelta = null;
  let supuestosFaltantes = _hasCompleteSimulateVars(calls)
    ? null
    : (Array.isArray(plan.supuestos_faltantes) && plan.supuestos_faltantes.length)
    ? plan.supuestos_faltantes
    : _silentZeroSupuestoFaltante(q, calls);
  /* ── «A LA META» NO SE PREGUNTA: SE RESUELVE (owner 2026-08-11, defecto 6 de la certificación final) ──────────
   * MEDIDO (E1.t4): «Si llevo sus acciones comerciales a la meta, ¿cuánto recupero?» → ADI preguntó «¿cuánto
   * esperas que disminuyan las acciones comerciales (en $)?». La meta está declarada en la política de la empresa
   * (`targetCarga`, 3,5%): preguntarla es hacerle repetir al usuario algo que su propia empresa ya definió, y en
   * un turno donde además había dicho explícitamente «a la meta».
   * EL VALOR SALE DE `POLICY`, NUNCA DEL TEXTO. `resolverReferencia` mapea métrica→referencia con un vocabulario
   * cerrado y devuelve null si hay varias o ninguna — ahí sí se pregunta, que es la conducta correcta.
   * NO PISA AL USUARIO: si el turno trae un supuesto explícito, `_hasCompleteSimulateVars` ya dio null arriba y
   * este bloque no corre. El supuesto del usuario siempre gana; esto sólo cubre el hueco que dejaba la anáfora. */
  if (supuestosFaltantes && supuestosFaltantes.length && REFERENCIA_ANAFORA_RE.test(q)) {
    const ref = resolverReferencia({ texto: q });
    if (ref) {
      referenciaResuelta = ref;   // viaja al narrador y a la boleta: la cifra es de la política, no del narrador
      supuestosFaltantes = null;  // hay valor autorizado → no se pregunta
    }
  }
  // ── NO SE PREGUNTA DOS VECES LO MISMO (owner 2026-08-11, la otra mitad de D3) ─────────────────────────────────
  // El arm "future" de arriba cubre el turno cuyo texto declara escenario de forma INEQUÍVOCA (el detector
  // determinístico). Este es su gemelo del lado del planificador: cuando PLAN pide el supuesto que falta teniendo
  // una simulación pendiente VIVA de la MISMA entidad que ya aportaba la OTRA variable, entre los dos turnos están
  // los dos supuestos — preguntar de nuevo sería pedirle al usuario un dato que ya dio. Se completa el plan acá,
  // ANTES del batch, con el MISMO shape sintético que usa la resolución del pendiente (una sola forma de armar una
  // simulación de dos variables en todo el archivo), y el turno sigue de largo: batch, narrador y guard normales.
  // Es angosto por construcción: exige pendiente vivo + entidades idénticas + campos complementarios.
  let pendienteCompletado = false;
  if (supuestosFaltantes && supuestosFaltantes.length && pendingSimulationPrev && !resolvedPendingSim) {
    const fus = fusionarPendientes(pendingSimulationPrev, _buildPendingSimulation(q, plan));
    if (fus.accion === "completa") {
      const ents = (Array.isArray(fus.pending.entities) && fus.pending.entities.length) ? fus.pending.entities : [fus.pending.entity];
      plan = { ...plan, mode: "simulacion",
        scope: { level: ents.length > 1 ? "list" : "entity", entities: ents, ...(fus.pending.dimension ? { dimension: fus.pending.dimension } : {}) },
        calls: [{ tool: "simulateGeneral", args: { dimension: fus.pending.dimension, ...(ents.length > 1 ? {} : { entity: ents[0] }), ...fus.vars } }] };
      calls = plan.calls;
      pendienteCompletado = true;
    }
  }
  if (supuestosFaltantes && supuestosFaltantes.length && !pendienteCompletado) {
    // el texto lo redacta el LLM del PLAN (o la red, si el LLM asumió 0% en silencio) — no una prosa fija
    // nuestra, así que pasa por el MISMO lavado de registro que la Pasada 2 (nunca "plata"/"dormido"/relleno),
    // aunque nunca llegue a invocar al narrador libre.
    const composed = stripFiller(stripLanguageLeaks(supuestosFaltantes.join(" ")));
    const out = _composedBypassResult(composed, mem, recentNarrationsPrev, scenario);
    if (out) {
      // mem.pendingSimulation: guarda la variable YA conocida + cuál falta, para que el turno SIGUIENTE la
      // resuelva determinísticamente (ver el bloque grande más arriba) en vez de depender de que PLAN reconstruya
      // entidad+variables del texto crudo de la ventana de historia. LA PRECEDENCIA la decide fusionarPendientes
      // (conversationScope.js), nunca este punto: misma entidad → se actualiza el supuesto sin perder el viejo;
      // otra entidad → se reemplaza; sin nada nuevo que armar → sobrevive el que había, un turno más viejo.
      const fus = fusionarPendientes(pendingSimulationPrev, _buildPendingSimulation(q, plan));
      out.mem = { ...out.mem, pendingSimulation: fus.accion === "conserva" ? envejecerPendingSimulation(fus.pending) : fus.pending };
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
  // ── LA SIMULACIÓN PENDIENTE MUERE POR ESTADO, NO POR CALENDARIO (owner 2026-08-11) ────────────────────────────
  // Acá vivía la regla que causaba el defecto: `pendingSimulation: null`, incondicional, con el argumento de que
  // "este turno ya la consumió o la abandonó". La segunda mitad era falsa — un turno que no contesta la pregunta
  // tampoco la abandona: cambiar de tema, pedir una aclaración o guardar un criterio son paréntesis. Medido: el
  // usuario volvía con el supuesto que faltaba y ADI le preguntaba de nuevo el precio que él ya había dado.
  // Las cuatro razones por las que ahora muere, en orden de precedencia:
  //   1. SE RESOLVIÓ — este turno contestó el supuesto (o lo completó fusionando) y la simulación ya corrió.
  //   2. UNA CORRECCIÓN LO INVALIDÓ — §1 del Contrato v1.2: "no, era Jumbo" lo reescribe hacia la entidad
  //      corregida (el supuesto que el usuario ya dio sigue siendo suyo) o lo mata si el alcance dejó de ser
  //      puntual. Se lee del MISMO objeto `_reparacion` que ya invalidó oferta y temas recientes, nunca de una
  //      segunda lectura del texto.
  //   3. SE LE ACABÓ EL PLAZO — el TTL corre en cada turno que no lo resuelve; ver conversationScope.js.
  //   4. (fuera de acá) SE REEMPLAZÓ o el usuario lo descartó explícito — ver fusionarPendientes y
  //      _ABANDONA_PENDIENTE_RE, ambos resueltos antes de llegar a este punto.
  // Sigue reinyectándose en `mem2` por el mismo motivo que mechanismByEntity/clarifyStreak: applyMemoryUpdate no
  // puede ser la que decida el ciclo de vida de una clave que no administra.
  mem2 = { ...mem2, pendingSimulation: (resolvedPendingSim || pendienteCompletado)
    ? null
    : envejecerPendingSimulation(repararPendingSimulation(pendingSimulationPrev, _reparacion, plan)) };
  if (sessionPrefPrev) mem2 = { ...mem2, responsePref: sessionPrefPrev };   // sobrevive applyMemoryUpdate, igual que mechanismByEntity
  // SE PERSISTE SÓLO EL EJE QUE EL TURNO AUTORIZÓ (owner 2026-08-11, ver _coercePref): el eje no autorizado
  // conserva lo que la sesión ya tenía — nunca se arrastra a la sesión un valor que este turno resolvió para sí
  // mismo. Sin esto, "hablame directo" (registro) congelaba el alcance del contenido de todos los turnos que
  // siguieran, y el usuario quedaba encerrado en "solo el dato" sin haberlo pedido.
  if (turnPref && (turnPref.persistScope || turnPref.persistDetail)) {
    mem2 = { ...mem2, responsePref: {
      contentScope: turnPref.persistScope ? pref.contentScope : ((sessionPrefPrev && sessionPrefPrev.contentScope) || "full"),
      detailLevel: turnPref.persistDetail ? pref.detailLevel : ((sessionPrefPrev && sessionPrefPrev.detailLevel) || "standard"),
    } };
  }
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
  // SE ESCRIBE SIEMPRE, no solo cuando hay oferta (Contrato v1.2, owner 2026-08-10): `priorOffer` ya sale de
  // getLastOffer, así que en cualquier turno normal este valor es EXACTAMENTE el que había — byte por byte lo
  // mismo que hacía el `if`. La diferencia aparece en el único caso donde importa: cuando una corrección invalidó
  // la oferta, `priorOffer` quedó en null y el `if` dejaba viva la del turno anterior en `mem.lastOffer`, que es
  // justo el shim que getLastOffer lee cuando el scope canónico no trae nada. La oferta cancelada volvía sola.
  mem2 = { ...mem2, lastOffer: priorOffer || null };
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
  // ── TELEMETRÍA · LAS TOOLS REALMENTE EJECUTADAS (owner 2026-08-10, cierre de la certificación live) ───────────
  // El gateway sólo ve las DOS llamadas al proveedor; el batch corre acá, del lado del cliente, así que este es el
  // único punto que sabe qué tools se ejecutaron de verdad — y no es lo mismo que lo que pidió el plan: los
  // backstops de este archivo corrigen args, deduplican y hasta reemplazan calls antes de ejecutar. La corrida de
  // certificación no pudo decir qué tools corrieron porque nadie lo emitía. Etapa "deterministica" (ya declarada
  // en telemetry.js) porque no hay proveedor de por medio: el batch es puro y gratis.
  // OBSERVACIÓN PURA: con el sink apagado —el default— no hace absolutamente nada, y `emit` nunca lanza.
  // LA CAUSA VIAJA CON EL RECHAZO (owner 2026-08-11, residual del frente de instrumentación). Este emisor armaba
  // `resultado: "rechazado"` y NO pasaba motivo — son los 10 eventos «rechazado con la causa en NULL» de la corrida
  // medida, y el dato que faltaba estaba a ocho líneas de acá: `unsupported`, que runPlan ya calcula. Un rechazo sin
  // causa no se puede contar ni corregir; con causa, sí. Ver `_causaDeterministica` para por qué es un CÓDIGO.
  const _rechazado = !results.some((r) => r && r.coverage && r.coverage.supported === true);
  emitTelemetria({
    traceId: nuevoTraceId(), etapa: "deterministica", intento: 0, ruta_deterministica: true,
    resultado: _rechazado ? "rechazado" : "ok",
    ...(_rechazado ? { reasonCode: _causaDeterministica(calls, unsupported) } : {}),
    tools: results.map((r) => r && r.tool).filter(Boolean),
  });
  // DIVULGACIÓN PROGRESIVA · segunda poda, sobre el LEDGER: del capital ligado se conserva el subtotal y el monto
  // de cada SKU (con eso se nombra la prioridad concreta), y se van las columnas que solo se leen en tabla
  // (unidades detenidas · días sin venta). Podadas del ledger = NO autorizadas: guardC las rechaza si el narrador
  // las intentara igual. El detalle completo sigue en la Ficha.
  const _podaLedger = podarLedgerProgresivo(ledgerBoleta(ledger), { quiereDesglose: !_disclosure.podado.length || pideDetalleComposicion(q) });
  const figs = _podaLedger.figs;

  // temas recientes (Fase 3) — se deriva DESPUÉS de que plan.scope ya está resuelto (por comprensión, como
  // siempre); señal para el LLM, nunca autoridad (ver dialogueState.js). No depende de `results`, pero vive acá,
  // junto al resto del estado post-plan que sobrevive hasta el return final.
  const recentSubjectsNow = updateRecentSubjects(recentSubjectsPrev, plan, calls, history.length);
  mem2 = { ...mem2, recentSubjects: recentSubjectsNow };   // shim de compatibilidad (Etapa 4) — ver dialogueState.js:getRecentSubjects
  // conversationScope (Etapa 1) — MISMO punto de derivación que recentSubjectsNow (post-batch, plan.scope YA
  // resuelto): a diferencia de recentSubjects (señal para el LLM), conversationScope SÍ es la fuente de verdad que
  // resolveConversationReference lee el turno SIGUIENTE — por eso se deriva de `results` (boleta estructurada),
  // nunca de la prosa que NARRAR todavía no escribió a esta altura.
  let conversationScopeNow = updateConversationScope(conversationScopePrev, { plan, calls, results, turno: history.length, requestContext });
  // ── EL TERCER UNIVERSO · la cifra del usuario aceptada como supuesto (Contrato v1.2 §5.1, owner 2026-08-10) ──
  // Se guarda SOLO cuando el usuario la autorizó en ESTE turno. Una cifra suya sin autorizar no es un supuesto
  // vivo: es una discrepancia que se muestra y se pregunta — guardarla igual sería exactamente lo que §5 prohíbe,
  // dejar que su número entre al sistema por afirmarlo. Vive en el campo `supuestos` que ConversationScopeEntry ya
  // reservaba desde el diseño original: ni una memoria nueva, ni una key paralela.
  if (_reparacion && _reparacion.tipo === "dato_usuario" && _reparacion.aceptado === true && _reparacion.dato) {
    conversationScopeNow = withSupuestoUsuario(conversationScopeNow, _reparacion.dato, history.length);
  }
  // Etapa 4 (owner 2026-08-04) — dual-write: recentSubjectsNow se escribe TAMBIÉN como key hermana física dentro
  // de conversationScope (root.recentSubjects, ver el comentario de ConversationScopeEntry en conversationScope.js)
  // en el MISMO instante que el shim de arriba — nunca 2 fuentes que puedan divergir. Se computa ANTES de NARRAR
  // (a diferencia de ofertaPendiente/lastOffer, que solo existen DESPUÉS de que la narración exista), así que acá
  // sí queda correctamente poblado para la lectura mid-turno de NARRATE (getRecentSubjects vía persona.js).
  mem2 = { ...mem2, conversationScope: { ...conversationScopeNow, recentSubjects: recentSubjectsNow } };
  // CONTEXTO DE PANTALLA · MEMORIA DEL TURNO (owner 2026-08-09) — key HERMANA de conversationScope, escrita en el
  // MISMO punto y con la misma convención de `turno` (history.length), nunca una memoria paralela con su propio
  // ciclo de vida. Guarda el contexto YA invalidado de este turno: si el usuario cambió de tema (scope global),
  // `vistaCtx` es null y acá se persiste null — el turno siguiente arranca sin nada que heredar, que es
  // exactamente lo que impide la contaminación. Si no cambió, el turno siguiente puede reusarlo por
  // VIEW_CONTEXT_TTL_TURNOS aunque el usuario haya cerrado el panel.
  mem2 = { ...mem2, viewContext: viewContextEntry(vistaCtx, history.length) };
  // REPARACIÓN SELLADA (Contrato v1.2, owner 2026-08-10) — se compone UNA vez, acá, con el MISMO builder que usa
  // el contrato de narración: el guard y el prompt tienen que juzgar exactamente el mismo objeto. Dos
  // construcciones paralelas serían la forma más fácil de llegar a que el narrador cumpla una regla y el candado
  // le cobre otra (el mismo defecto que ya se pagó con tablePolicy). Se compone DESPUÉS de escribir el scope
  // fresco en mem2 porque los supuestos vivos del usuario salen de ahí. Null en cualquier turno normal.
  const reparacionSellada = buildReparacion({ plan, mem: mem2, reparacion: _reparacion });

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
    // UNA FAMILIA POR CAMPO CITADO (owner 2026-08-10, defecto C2): con dos métricas de universos distintos, el
    // marco de la PRIMERA no es el marco de la respuesta — «vende $X (año cerrado)» y «stock $Y (foto de hoy)»
    // conviven en el mismo texto y los DOS tienen que quedar declarados, como ya exige el corpus de aceptación.
    const _famDe = (p) => (/a[nñ]o cerrado/i.test(p || "") ? "anual" : /foto.*hoy/i.test(p || "") ? "hoy" : null);
    const _fams = [...new Set((simple.campos || [simple]).map((c) => _famDe(c.periodo)))];
    const periodosSimple = _fams.every(Boolean) && _fams.length ? ["anual", "hoy"].filter((f) => _fams.includes(f)) : periodos;
    const det = ensureTransferenciaDeclarada(ensurePeriodoDeclared(detRaw, periodosSimple), results, q);
    if (guardC(det, { ledger, results, trace, question: q, mechanismMemory, sealedOrders, reparacion: reparacionSellada, contentScope: pref.contentScope }).ok) { narration = det; deterministic = true; }
  }

  // POLÍTICA DE PRESENTACIÓN DEL TURNO (owner 2026-08-07): TRES estados, no un booleano global.
  //   forbidden · perfil general — el detalle no viajó; tabular lo que queda sería reconstruirlo peor que la Ficha
  //   required  · pidió tabla / mes a mes / desglose — responder eso en prosa también es incumplir
  //   auto      · el resto — deciden los detectores de forma del prompt; el guard no juzga
  // No es una sugerencia: viaja sellada en el contrato (politicaExtension.tablePolicy) y guardC valida LA
  // DECIDIDA. `required` gana sobre `forbidden`: si el usuario pidió la tabla, se le tabula lo que haya.
  // SE RESUELVE ACÁ, ANTES DE LA RAMA data_only/results_only (owner 2026-08-11, corrigiendo el ORDEN). Vivía 30
  // líneas más abajo, junto a su único consumidor (el payload de NARRAR) — y ese orden hacía la política INERTE
  // para toda la familia de turnos de alcance restringido: la rama de abajo resuelve la narración ENTERA desde
  // composeFromLedger (una tabla) y ya no se vuelve a mirar quién decidió la forma. La política de forma no puede
  // computarse DESPUÉS de que la forma ya se emitió. No depende de nada que se derive más abajo: sólo del texto
  // del turno y de la poda, los dos resueltos antes del batch.
  const tablePolicy = resolveTablePolicy({ text: q, podado: _disclosure.podado });
  // LA ORDEN DEL USUARIO, AISLADA DE LA INFERENCIA DEL MOTOR: la misma función con la poda VACÍA. Una `forbidden`
  // que viene de la PODA es una inferencia nuestra (el detalle no viajó) y no autoriza a cambiarle la forma a un
  // turno de dato; una que viene del TEXTO es una orden, y las órdenes se cumplen.
  // CINTURÓN CONTRA EL FALSO POSITIVO AJENO: además se exige que el turno no haya pedido la tabla con todas las
  // letras. Los detectores de prohibición son de otro dueño y pueden sobre-disparar (una negación sobre una
  // COLUMNA no es una negación de la TABLA); si el turno dice «dame la tabla», acá no se le quita, pase lo que
  // pase río arriba. Antes falso negativo que falso positivo.
  // LA FORMA DEL TURNO MANDA TAMBIÉN ACÁ (owner 2026-08-11, regla 3 de la precedencia aprobada). «Solo la cifra,
  // nada de tablas» tiene que salir como UNA ORACIÓN BREVE: `data_only` decide el ALCANCE (sólo el dato, sin
  // análisis) y `outputForm` decide la FORMA (sin tabla). Son ejes distintos y los dos se respetan a la vez —
  // antes esta rama componía siempre la tabla del ledger y la orden del usuario se perdía en el camino.
  // FORMA DE SALIDA · turn-local, declarada por el PLAN (pref.outputForm) con respaldo determinístico.
  const formaSalida = resolveOutputForm({ plan, text: q });
  const _formaProhibidaPorElUsuario = formaSalida === "prosa" || formaSalida === "solo_conclusion"
    || resolveTablePolicy({ text: q, podado: [] }) === "forbidden"
    && !pidePresentacionTabular(q);

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
  // CONTRATO DE RESPUESTA · "SOLO EL DATO" = DATO + PERÍODO + ALCANCE, NADA MÁS (owner 2026-08-09). Los dos
  // primeros ya estaban (composeFromLedger da el dato, ensurePeriodoDeclared el período); el ALCANCE faltaba, y sin
  // él una tabla de cifras no dice sobre QUÉ universo está medida — que es justamente lo que hace que una cifra
  // pelada se pueda leer mal. Se compone del alcance YA sellado (sealScopeContract, la misma función que usa el
  // contrato de narración) y sin ningún número, así que no introduce ninguna cifra que el guard deba autorizar.
  // Solo cuando hubo dato: al mensaje de "no tengo información" no le corresponde declarar alcance de nada.
  // EL ALCANCE ES ADITIVO, NUNCA UNA CONDICIÓN DE FALLA (revisión 2026-08-09). Esta rama NO tiene reparación río
  // abajo: la de más abajo excluye explícitamente data_only/results_only, así que un `guardC` en rojo acá no
  // degrada — hace que answerViaOracle devuelva null y el oráculo se abstenga del turno entero. La línea de alcance
  // se compone de `plan.scope.entities` y de `args.filters`, que son texto EMITIDO POR EL LLM del PLAN: basta un
  // nombre apenas corrido de su forma canónica para que el guard lo lea como entidad corrupta. Por eso se prueba
  // PRIMERO con alcance y, si el guard lo rechaza, se reintenta SIN él — ese segundo texto es byte-idéntico al que
  // esta rama componía antes de que el alcance existiera, así que la mejora no puede empeorar ningún turno.
  // EL ALCANCE ACOTA LOS TURNOS DE DATO, NO LOS DE DEFINICIÓN (owner 2026-08-11, cierre de D4). Esta rama tenía un
  // solo compositor y sabía componer CIFRAS: cuando la evidencia autorizada del turno era TEXTO (una definición del
  // glosario, `boleta: []` con `supported: true`), la boleta venía vacía, composeFromLedger devolvía null y el
  // motor declaraba "no tengo información autorizada" teniendo el dato sellado en la mano. Se agrega el compositor
  // que faltaba, ANTES del mensaje de ausencia y DESPUÉS de la boleta (una cifra autorizada siempre manda sobre
  // una definición: si el turno trajo dato, el turno es de dato). La garantía por construcción queda intacta —
  // sigue sin invocarse el narrador libre, y el texto sale VERBATIM del glosario, no de un LLM.
  // Y LA FORMA QUE EL USUARIO PROHIBIÓ TAMPOCO SE EMITE ACÁ (owner 2026-08-11, la otra mitad del ORDEN). Este es
  // el único punto del motor donde un turno de alcance restringido decide su forma, así que es el único punto
  // donde `tablePolicy` puede llegar a tiempo. Se agrega un candidato NO TABULAR — las MISMAS figs autorizadas,
  // los mismos label/value verbatim, en una línea en vez de en doce filas — y se prueba PRIMERO. Es aditivo por
  // construcción: si el guard lo rechaza, la lista de candidatos sigue con exactamente los mismos textos que esta
  // rama componía antes, así que ningún turno que hoy funciona puede empezar a fallar por esto.
  if (!narration && (pref.contentScope === "data_only" || pref.contentScope === "results_only")) {
    const desdeLedger = composeFromLedger(figs, pref.contentScope);
    const desdeTexto = desdeLedger ? null : composeFromTextualEvidence(results);
    const base = desdeLedger || desdeTexto || composeNoDataMessage(results);
    const alcanceLinea = desdeLedger ? buildAlcanceLine(sealScopeContract({ plan, results, scenario, requestContext, pref })) : "";
    const enLinea = (_formaProhibidaPorElUsuario && desdeLedger) ? _cifrasEnLinea(figs) : null;
    const _conAlcance = (b) => (alcanceLinea ? [`${b}\n\n${alcanceLinea}`, b] : [b]);
    for (const candidato of [...(enLinea ? _conAlcance(enLinea) : []), ..._conAlcance(base)]) {
      // A UNA DEFINICIÓN NO LE CORRESPONDE DECLARAR UNIVERSO NI PERÍODO: no mide nada, así que ni el período ni la
      // transferencia de decisión tienen sujeto. Estamparlos sería agregarle a la respuesta un marco que su propia
      // evidencia no tiene — y en esta rama, que no tiene reparación río abajo, un envoltorio que el guard rechace
      // no degrada: abstiene el turno entero.
      const c = desdeTexto ? candidato : ensureTransferenciaDeclarada(ensurePeriodoDeclared(candidato, periodos), results, q);
      if (guardC(c, { ledger, results, trace, question: q, mechanismMemory, sealedOrders, reparacion: reparacionSellada, contentScope: pref.contentScope }).ok) { narration = c; narrationRepaired = true; break; }
    }
  }

  // ── ORIENTACIÓN INICIAL MID-CONVERSACIÓN (Fase 3, la tarea que la nombra) — disparador DETERMINÍSTICO (mismo
  // principio que _coerceMode/_coercePref: red angosta para frases inequívocas, nunca el mecanismo principal).
  // Se computa ACÁ, no antes: necesita clarifyStreakNow (ya resuelto arriba) y recentSubjectsNow (recién derivado
  // post-BATCH) — su único consumidor es el payload de NARRAR, vive pegado a ese uso (mismo criterio que `simple`
  // más arriba, pegado a la ruta determinística).
  const orientacionReason = needsOrientacion(q, clarifyStreakNow);
  const instruccionOrientacion = buildOrientacionInstruction(orientacionReason, recentSubjectsNow);
  // qué decir EN VEZ de la tabla: la Ficha como destino del detalle, no una promesa vaga de profundizar.
  const instruccionDisclosure = buildDisclosureInstruction({ podado: _disclosure.podado, entidad: _disclosure.entidad });
  // CONTRATO DE RESPUESTA PROPORCIONAL (owner 2026-08-09) — la MISMA clase de decisión que tablePolicy, un eje más:
  // cuánta respuesta le corresponde a este turno. Se computa acá, junto a ella, porque necesita exactamente lo mismo
  // (el texto, el plan ya resuelto y la preferencia efectiva) y su único consumidor es el payload de NARRAR.
  //   solo_dato · explicar_componente · puntual · tres_reglas · null (otro contrato ya gobierna la forma)
  // La precedencia vive ENTERA en resolveAnswerShape (progressiveDisclosure.js): `pref` gana siempre, clarify
  // reemplaza el arco, y recién después opinan el contexto de pantalla y la forma de la pregunta.
  // FORMA DE SALIDA · turn-local, declarada por el PLAN (pref.outputForm) con respaldo determinístico.
  const formaRespuesta = resolveAnswerShape({ text: q, plan, viewContext: vistaCtx, pref });

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
    try { n = await callNarrate({ text: q, plan, results, ledgerFigs: figs, mem: mem2, history, requestContext, pref, instruccionOrientacion, instruccionDisclosure, tablePolicy, viewContext: vistaCtx, formaRespuesta, attempt: modelAttempt }); }
    catch (e) {
      // MISMA REGLA QUE EN PLAN: sin crédito no se reintenta ni se escala (owner 2026-08-11, defecto 1). En la
      // certificación final este loop gastó TRES llamadas por turno contra una API sin saldo, en cinco turnos.
      if (_esSinCredito(e)) { narrateAttemptTrace.push({ attempt, guardOk: null, reason: "billing_exhausted (sin crédito)", usage: null }); throw e; }
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
    // LOS TRES RECIBEN LA POLÍTICA DEL TURNO (owner 2026-08-10, defecto A4): con `required` ninguno borra la tabla
    // que guardC va a exigir tres líneas más abajo. Sin esto, el motor borraba el cumplimiento y después cobraba
    // el incumplimiento — un rechazo que el narrador no podía evitar por más que hiciera todo bien.
    n = stripSingleRowTables(n, q, tablePolicy);  // "1 entidad → prosa, nunca tabla" — SALVO que el usuario haya pedido tabla explícitamente (ver narratePromptC.js)
    n = stripRedundantTemporalTable(n, results, tablePolicy);   // trend YA renderiza su propia tarjeta con la matriz — nunca dos tablas mes a mes (owner 2026-08-05, ver narratePromptC.js)
    n = stripPerfilCompletoTable(n, plan, tablePolicy);   // perfil de cliente (composición/capital ligado) — Sentrix YA muestra esto, el chat sintetiza en prosa (owner 2026-08-07, ver narratePromptC.js)
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
    n = ensureTransferenciaDeclarada(n, results, q);   // requisito C1: la decisión se contesta, y se dice qué falta (ver narratePromptC.js)
    if (!n.trim()) { narrateAttemptTrace.push({ attempt, guardOk: null, reason: "narración vacía tras backstops", usage: null }); modelAttempt++; continue; }
    const gVerdict = guardC(n, { ledger, results, trace, question: q, mechanismMemory, sealedOrders, recentNarrations: recentNarrationsPrev, mode: plan.mode, tablePolicy, reparacion: reparacionSellada, contentScope: pref.contentScope });
    // EL DETALLE DEL RECHAZO, EN MEMORIA (owner 2026-08-10, tras la auditoría de la 4ª corrida). El trace decía
    // QUÉ chequeo saltó pero no SOBRE QUÉ, así que de los cinco rechazos de esa corrida hubo uno que no se pudo
    // adjudicar: no se sabía si era un error real del modelo o un falso positivo del guard. Un rechazo que no se
    // puede clasificar obliga a pagar otra corrida para averiguarlo.
    // VIVE SOLO ACÁ. `retryTrace` es memoria del turno —debug y arnés—: NUNCA se emite a la telemetría, que es la
    // que escribe a disco y tiene prohibido cualquier dato del cliente. El detalle SÍ nombra cifras del negocio
    // («$13.9M»), y por eso este es el único lugar donde puede estar. Se acota a los 3 primeros: alcanza para
    // diagnosticar y no convierte el trace en un volcado.
    const _detalle = gVerdict.ok ? null : gVerdict.violations.slice(0, 3).map((v) => `${v.kind}:${v.detail}`);
    narrateAttemptTrace.push({ attempt, guardOk: gVerdict.ok, reason: gVerdict.ok ? (gVerdict.degraded ? `degradado:${gVerdict.advisories.some((a) => a.kind === "orden-decision-tabla-primero") ? "tabla-antes-de-accion" : "repeticion-verbatim"} (reintenta con escalada, no bloquea)` : null) : gVerdict.verdict, ...(_detalle ? { detalle: _detalle } : {}), usage: null });
    if (gVerdict.ok && !gVerdict.degraded) { narration = n; break; }
    // FORMA INCUMPLIDA → SALIDA DETERMINÍSTICA, SIN OTRA LLAMADA (owner 2026-08-07). Reintentar sería gastar una
    // llamada por algo que NO es de suerte: el narrador eligió una presentación que la política del turno no
    // admite, y con las mismas cifras puede volver a elegirla. Las dos salidas se componen desde lo YA autorizado,
    // así que pasan guardC por construcción — igual se verifica, nunca se asume:
    //   tabla-no-autorizada → prosa desde los claims (composeProsaEjecutiva)
    //   tabla-faltante      → la tabla desde la boleta (composeFromLedger, el compositor que ya existía)
    if (!gVerdict.ok && /tabla-no-autorizada|tabla-faltante/.test(String(gVerdict.verdict || ""))) {
      const esFaltante = /tabla-faltante/.test(String(gVerdict.verdict));
      const alt = esFaltante ? composeFromLedger(figs, "full") : composeProsaEjecutiva(buildClaims(figs), { entidad: _disclosure.entidad });
      if (alt) {
        let c = ensurePeriodoDeclared(alt, periodos);
        c = ensureClarifyClosingQuestion(c, plan.mode);
        c = ensureTransferenciaDeclarada(c, results, q);
        if (guardC(c, { ledger, results, trace, question: q, mechanismMemory, sealedOrders, tablePolicy, reparacion: reparacionSellada, contentScope: pref.contentScope }).ok) {
          narration = c; narrationRepaired = true;
          // UN INTENTO, UNA ENTRADA (owner 2026-08-10, certificación live · defecto A4). Antes esto EMPUJABA una
          // SEGUNDA entrada con el MISMO `attempt` y `guardOk:false`, así que el trace de un turno reparado al
          // primer intento se leía como "el narrador falló dos veces seguidas" — que es exactamente cómo se leyó
          // la corrida de certificación. No hubo dos fallas ni dos llamadas: hubo UNA, y se reparó sin pagar otra.
          // La reparación se anota SOBRE el intento que la motivó, que es donde de verdad ocurrió.
          narrateAttemptTrace[narrateAttemptTrace.length - 1].reparado = `${gVerdict.verdict} → salida determinística desde lo autorizado (sin otra llamada)`;
          break;
        }
      }
    }
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
    c = ensureTransferenciaDeclarada(c, results, q);
    if (guardC(c, { ledger, results, trace, question: q, mechanismMemory, sealedOrders, reparacion: reparacionSellada, contentScope: pref.contentScope }).ok) { narration = c; narrationRepaired = true; }
  }
  if (!narration) return null;   // ni narrar ni reparar desde la boleta autorizada funcionó → C se abstiene (fallback a la ruta vieja)

  // ── OFERTA DE SEGUIMIENTO + REPETICIÓN (Fase 3) — lastOffer SIEMPRE recalculada desde CERO (nunca heredada, ver
  // dialogueState.js): esto es lo que hace que cambio de tema/rechazo/ejecución invaliden la oferta anterior SIN
  // código especial — la narración de ESTE turno simplemente produce (o no) su propia oferta fresca. extractOffer
  // ya filtra por contentScope="full" internamente (data_only/action_only/results_only nunca ofrecen seguimiento).
  const lastOfferNow = extractOffer(narration, { plan, calls, pref, turno: history.length });
  narration = stripAllMarks(narration);   // ninguna marca [[...]] llega al usuario bajo full (no-op si no hay ninguna)

  /* ── LA FORMA LA GARANTIZA EL RENDERER, NO LA OBEDIENCIA DEL NARRADOR (owner 2026-08-11, defecto 8) ──────────
   * Las cuatro direcciones medidas fallaron con el guard funcionando: `tabla-faltante` y `tabla-no-autorizada`
   * RECHAZABAN la narración y el turno igual salía mal, porque rechazar no es construir. Pedirle a un modelo que
   * respete la forma y castigarlo cuando no lo hace cuesta reintentos y no cierra nada: acá la forma se IMPONE
   * sobre el texto ya autorizado, con las cifras que la boleta ya validó.
   *   tabla           → si no vino tabla, se compone desde el ledger AUTORIZADO (mismas cifras, cero dato nuevo)
   *   prosa           → si vino tabla, se reemplaza por la línea de cifras equivalente (sin perder ninguna)
   *   solo_conclusion → se entrega el cierre y nada más: ni tabla ni el detalle que ya se dio antes
   * Es turn-local por construcción: `formaSalida` sale de `plan.pref` (que el contrato declara no heredable) y no
   * se guarda en `mem2` — un pedido de formato no puede contaminar el turno siguiente. */
  if (narration && formaSalida !== "auto") {
    const _tieneTabla = /^\s*\|.*\|\s*$/m.test(narration);
    if (formaSalida === "tabla" && !_tieneTabla) {
      const tabla = composeFromLedger(figs, "data_only");
      if (tabla) { narration = `${narration.trim()}\n\n${tabla.trim()}`; narrationRepaired = true; }
    } else if ((formaSalida === "prosa" || formaSalida === "solo_conclusion") && _tieneTabla) {
      // NO se borra la tabla y se deja el hueco: sus cifras se reinyectan en línea, así que la respuesta pierde la
      // FORMA que el usuario rechazó y conserva el DATO que sí pidió. `_cifrasEnLinea` compone de la misma boleta.
      const enLinea = _cifrasEnLinea(figs);
      const sinTabla = narration.split(/\r?\n/).filter((l) => !/^\s*\|.*\|\s*$/.test(l)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
      narration = [sinTabla, enLinea && formaSalida === "prosa" ? enLinea : ""].filter(Boolean).join("\n\n").trim();
      narrationRepaired = true;
    }
    if (formaSalida === "solo_conclusion") {
      // EL CIERRE NO ES "EL ÚLTIMO PÁRRAFO" A SECAS. La respuesta termina con un PIE declarativo —«Alcance: todo
      // el eje cliente. (Datos del año cerrado.)»— que es metadato obligatorio, no la conclusión: quedarse con él
      // devuelve un turno sin una sola cifra, que es peor que no recortar. Se toma el último párrafo con
      // CONTENIDO y el pie se conserva aparte, porque declarar período y alcance no es opcional.
      const _ES_PIE = /^\(?\s*(?:alcance|datos del|foto de inventario|supuesto)\b/i;
      const parrafos = narration.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
      const cuerpo = parrafos.filter((s) => !_ES_PIE.test(s));
      const pie = parrafos.filter((s) => _ES_PIE.test(s));
      if (cuerpo.length > 1) { narration = [cuerpo[cuerpo.length - 1], ...pie].join("\n\n"); narrationRepaired = true; }
    }
  }
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

  // ── CONTRATO v2 · FASE 4 ─────────────────────────────────────────────────────────────────────────────────────
  // claims sellados: la MISMA conversión boleta→afirmaciones que consume el narrador (narrationContract.js), ahora
  // también en la salida — para que Sentrix, la telemetría y los gates auditen contra lo mismo que se narró, no
  // contra una segunda lectura de la boleta. Es la boleta tipada, no un dato nuevo: cero llamadas, cero costo.
  // eje/período salen de sealScopeContract, NO de plan.scope: el eje canónico lo declaran los facts
  // (entityType/dimension, ya canonicalizados por el motor) — `plan.scope` ni siquiera tiene campo `dimension`.
  // Una sola verdad con lo que el narrador recibió.
  const scopeSellado = sealScopeContract({ plan, results, scenario, requestContext, pref });
  const claims = buildClaims(figs, { eje: scopeSellado.eje, periodo: scopeSellado.periodo });
  // GRADUACIÓN EPISTÉMICA (pendiente obligatorio de Fase 4): una cifra `indicado` (derivada por el motor, con
  // fórmula) nunca sale narrada como si fuera un hecho medido. Corre DESPUÉS de recentNarrations a propósito: la
  // nota es del renderer, no del narrador — no debe entrar en la memoria de repetición ni en extractOffer.
  let textoFinal = gradeIndicatedClaims(narration, claims, pref.contentScope);
  // EL TERCER UNIVERSO · LA MARCA (Contrato v1.2 §5.1, owner 2026-08-10). Corre PEGADO a gradeIndicatedClaims
  // porque es la misma clase de garantía y el mismo instante: una nota del RENDERER sobre el texto ya validado.
  // Estampa la procedencia en cada aparición de una cifra del usuario y el marco de estimación en cada cifra que
  // la aritmética muestra derivada de ella. Sin esto, la única forma de cumplir §5.1 era exigirle al narrador que
  // usara ciertas palabras — que era el defecto, no la solución. No-op sin cifras del usuario vivas.
  textoFinal = markUserProvenance(textoFinal, reparacionSellada, figs);
  // la evidencia se arma UNA vez y se reusa: el CTA se compone de su `address` (misma referencia, nunca una
  // segunda construcción que pudiera divergir de lo que el panel abre).
  const evidence = buildOracleEvidence({ plan, results, figs, scenario, unsupported });

  return {
    r: normalizeResponse({
      text: textoFinal,
      route: "oracle",
      claims,
      evidence,
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
      ...((planAttemptTrace.length || narrateAttemptTrace.length) ? { retryTrace: { plan: planAttemptTrace, narrate: narrateAttemptTrace, ...(planCoerciones.length ? { coerciones: planCoerciones } : {}) } } : {}),
      // `suggestions` sigue en null A PROPÓSITO (Fase 4): el motor tiene con qué llenarlo (mem2.lastOffer es
      // literalmente la próxima acción ofrecida) pero encenderlo hace aparecer chips donde hoy no hay ninguno.
      suggestions: null,
      // ── EL CTA, ENCENDIDO (owner 2026-08-09 · objetivo 3 del Contrato de Concordancia) ────────────────────────
      // "Si ADI afirma algo, «Ver evidencia en Sentrix» abre la vista, sección, entidad y filtro EXACTOS que lo
      // respaldan." El botón estaba doblemente inerte: acá devolvía null y App.jsx montaba <ChatADI> sin
      // `onSentrixAction`. Las dos mitades quedan cerradas. La acción se compone DESDE LA DIRECCIÓN (address.js,
      // determinística sobre el plan y el evidenceSpec — nunca sobre la prosa), y devuelve null cuando no hay
      // dirección resoluble: no se pinta un botón que no lleva a ningún lado. `normalizeSentrixAction`
      // (responseContract.js) valida la forma río abajo, así que un CTA mal formado se descarta, no viaja roto.
      sentrixAction: _sentrixActionDe(evidence),
    }),
    mem: mem2,
  };
}
