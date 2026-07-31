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
import { guardC, extractMechanismRows, periodosEsperados, ensurePeriodoDeclared } from "./guardC.js";
import { stripFiller, normalizeFigures } from "./narratePromptC.js";
import { stripLanguageLeaks } from "../llm/voiceGuard.js";   // GARANTÍA runtime de registro (owner 2026-07-14/26: "palanca" y demás slang NO van — hoy solo corría en la ruta vieja, C quedaba sin la red)
import { buildOracleEvidence } from "./sentrixEvidence.js";  // SENTRIX ES LA EVIDENCIA (owner 2026-07-28): el panel debe reflejar lo que C acaba de narrar
import { MODE_KEYS } from "./conversationalContract.js";
import { CONTENT_SCOPES, DETAIL_LEVELS } from "./responsePreference.js";
import { parseBlocks, renderFromBlocks, composeFromLedger, composeNoDataMessage, hasForbiddenContent, stripAllMarks } from "./narrationBlocks.js";
import { isAcceptance, extractOffer, updateRecentSubjects, needsOrientacion, buildOrientacionInstruction, composeOrphanAcceptance, resolveSubjectRecall, composeSubjectAmbiguity } from "./dialogueState.js";
import { assertTenantContext } from "./requestContext.js";
import { fieldLabel, rawRecordFor, REFERENCIA_CAMPO, REFERENCIA_ANTERIOR } from "./entityRecord.js";

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
  return { entity, label, token, value: r.facts[label], periodo: r.facts.periodo || null, rec, rawValue };
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
function _coerceMode(text, plan) {
  if (_CLARIFY_RE.test(String(text || ""))) return "clarify";
  return plan && MODE_KEYS.includes(plan.mode) ? plan.mode : "default";
}

// ── PREFERENCIA DE RESPUESTA · coerción determinística (owner 2026-07-29: "el PLAN debe detectarla y devolverla
// estructurada. Usa coerción determinística únicamente como red para instrucciones explícitas, no como mecanismo
// principal") — MISMO patrón y MISMA precedencia que _coerceMode arriba: el LLM (plan.pref) es el mecanismo
// PRINCIPAL (entiende cualquier paráfrasis); estas regexes son la RED que fuerza el valor SOLO ante frases
// inequívocas, igual de angostas que _CLARIFY_RE — nunca al revés (nunca "adivinan" una preferencia ambigua que el
// LLM ya haya decidido no marcar). _PREF_DATA_ONLY_RE es un SUPERSET literal del viejo _SOLO_DATO_RE retirado
// arriba — mismo comportamiento para las frases que YA estaban probadas, más "solo cifras/KPIs/números" (requisito
// del owner: "resumen ejecutivo... solo cifras").
const _PREF_DATA_ONLY_RE = /\bsolo\s+(?:el\s+|la\s+|los\s+|las\s+)?(?:dato|datos|n[uú]mero|n[uú]meros|cifras?|kpis?)\b|\bsin\s+an[aá]lisis\b|\bsin\s+interpretaci[oó]n\b|\bnada\s+m[aá]s\b|\bdame\s+solo\b/i;
const _PREF_ACTION_ONLY_RE = /\bsolo\s+la\s+acci[oó]n\b|\bsin\s+(?:el\s+)?diagn[oó]stico\b|\band[aá]\s+al\s+grano\b|\bdirecto\s+a\s+la\s+acci[oó]n\b|\bsin\s+repetir\s+el\s+diagn[oó]stico\b/i;
// "resultados"/"sin recomendación" SOLO se leen como results_only dentro de una SIMULACIÓN (mode="simulacion") —
// fuera de ese contexto "sin recomendación" es ambiguo (una decisión SIN recomendación no tiene mucho sentido) y se
// deja al criterio del LLM (plan.pref), no se fuerza por red.
const _PREF_RESULTS_ONLY_SIM_RE = /\bsolo\s+(?:los\s+)?resultados?\b|\bsin\s+recomendaci[oó]n\b|\bsin\s+an[aá]lisis\b/i;
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
const _PREF_ONE_TURN_RE = /\bsolo\s+esta\s+vez\b|\bpor\s+esta\s+vez\b|\bsolo\s+por\s+ahora\b|\bahora\s+solo\b/i;

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
const _ZERO_EXPLICIT_RE = /\b0\s*%|\bsin\s+cambio|\bno\s+cambia|\bqueda\s+igual|\bse\s+mantiene\b/i;
function _silentZeroSupuestoFaltante(text, calls) {
  const call = Array.isArray(calls) ? calls.find((c) => c && c.tool === "simulateGeneral" && c.args) : null;
  if (!call) return null;
  const zeroVar = [call.args.variableA, call.args.variableB].find((v) => v && v.delta_pct === 0);
  if (!zeroVar) return null;
  if (_ZERO_EXPLICIT_RE.test(String(text || ""))) return null;   // el usuario SÍ dijo "0%"/"sin cambio" — respetalo, no es un faltante
  // OJO: sin ningún número acá — "0%" en el texto sería una cifra sin autorizar y guardC rechazaría la PROPIA
  // pregunta de aclaración (bug real cazado en el propio testing de este fix).
  const pregunta = zeroVar.campo === "precioLista" ? "¿cuánto esperás que cambie el precio?" : "¿cuánto esperás que cambie el volumen o las unidades vendidas?";
  return [`${pregunta} No quiero asumir que se mantiene sin cambios, sin que me lo confirmes.`];
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
  const mem2 = { ...mem, lastOffer: null, recentNarrations: [text, ...recentNarrationsPrev].slice(0, 2) };
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

// answerViaOracle({ text, history, mem, scenario, callPlan, callNarrate, maxCalls }) → { r, mem } | null
//   r   = { text, route:"oracle", evidence:{boleta,...} }  (compatible con _turnFromResult)
//   mem = la memoria de interacción ACTUALIZADA (el llamador la persiste en el context del hilo)
export async function answerViaOracle({ text, history = [], mem = {}, scenario = "actual", callPlan, callNarrate, maxCalls = 6, requestContext = null } = {}) {
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
  const priorOffer = (mem && mem.lastOffer && typeof mem.lastOffer === "object") ? mem.lastOffer : null;
  const recentSubjectsPrev = Array.isArray(mem && mem.recentSubjects) ? mem.recentSubjects : [];
  const recentNarrationsPrev = Array.isArray(mem && mem.recentNarrations) ? mem.recentNarrations : [];

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

  // ── RETORNO A TEMAS RECIENTES — resolución posicional determinística (owner 2026-07-31, cierre de #48) ──
  // "volvamos a lo de Falabella" (nombra la entidad) ya lo resuelve PLAN por comprensión, esto es SOLO para
  // referencias POSICIONALES ("lo anterior"/"el primer tema"). Ver dialogueState.js para el detalle de índices.
  const subjectRecall = resolveSubjectRecall(q, recentSubjectsPrev);
  if (subjectRecall && subjectRecall.kind === "ambiguous") {
    const composed = composeSubjectAmbiguity(subjectRecall.options);
    const out = _composedBypassResult(composed, mem, recentNarrationsPrev, scenario);
    if (out) return out;
  }

  let plan = (priorOffer && priorOffer.tool && isAcceptance(q))
    ? { intent: "answer", mode: "seguimiento", rationale: "oferta aceptada (ejecución estructurada)", scope: priorOffer.entidad ? { level: "entity", entities: [priorOffer.entidad] } : { level: "global" }, calls: [{ tool: priorOffer.tool, args: priorOffer.args || {} }] }
    : (subjectRecall && subjectRecall.kind === "resolved")
    ? { intent: "answer", mode: "seguimiento", rationale: "retorno a tema reciente (referencia posicional)", scope: { level: "entity", entities: [subjectRecall.subject.entidad] }, calls: [{ tool: "entityProfile", args: { dimension: subjectRecall.subject.dimension || "cliente", entity: subjectRecall.subject.entidad } }] }
    : null;

  // ── PASADA 1 · PLAN (con reintentos · 3 intentos máx, MISMO patrón que el retry de NARRAR más abajo) ── se salta
  // ENTERA cuando la ruta de aceptación de arriba ya resolvió el plan.
  // hallazgo del re-barrido de 17 turnos (owner 2026-07-29): a diferencia de NARRAR, el plan NO reintentaba — un
  // JSON malformado del tool_call (el adapter de OpenAI tira "JSON inválido del tool_call: …", ver
  // src/adi/llm/adapters/openai.js) tumbaba el turno ENTERO al fallback en el primer intento, sin darle a C ni una
  // segunda chance. La mayoría de estos fallos son variance de sampling del LLM (el MISMO tool_choice forzado sobre
  // el MISMO schema casi siempre da JSON válido al reintentar) — reintentar recupera la mayoría sin debilitar nada:
  // el plan sigue validado por el schema forzado, y si los 3 intentos fallan, C se abstiene igual que antes.
  if (!plan) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let p;
      try { p = await callPlan({ text: q, history, mem, scenario, requestContext }); }
      catch { continue; }
      if (p && p.intent) { plan = p; break; }
    }
    if (!plan) return null;
  }
  // `calls` puede faltar en intent=ack/define (el modelo lo omite cuando no pide datos) → default [] (NO es abstención).
  // OJO: `plan` se REEMPLAZA (no solo la variable local `calls`) — buildNarrateUserMessageC recibe `plan` completo
  // más abajo, y si solo corregíamos la variable suelta, el narrador seguía viendo plan.calls SIN corregir (bug real
  // cazado en el propio testing de este fix: el batch corría bien pero el narrador quedaba desincronizado del dato).
  plan = { ...plan, calls: _coerceTensionArgs(q, Array.isArray(plan.calls) ? plan.calls : []), mode: _coerceMode(q, plan) };
  const calls = plan.calls;

  // ── supuestos_faltantes → request_clarification (owner 2026-07-31, #56 "simulate v2") ── PLAN detectó un pedido
  // de simulación de 2 variables con UNA sola nombrada (ver planPrompt.js) — esto corta ANTES del batch, sin tocar
  // el dato, mismo principio de garantía-por-construcción que la aceptación huérfana/retorno ambiguo de arriba:
  // nunca se narra libre una pregunta de aclaración (el LLM podría inventar qué falta o asumir 0% en silencio).
  // ver _silentZeroSupuestoFaltante arriba: red determinística para cuando el LLM, en vez de usar
  // supuestos_faltantes, asume 0% en silencio en la variable que el usuario no nombró — hallazgo EN VIVO, no
  // hipotético. El LLM manda (mecanismo principal); esto es SOLO la red, igual que el resto de _coerce* del archivo.
  const supuestosFaltantes = (Array.isArray(plan.supuestos_faltantes) && plan.supuestos_faltantes.length)
    ? plan.supuestos_faltantes
    : _silentZeroSupuestoFaltante(q, calls);
  if (supuestosFaltantes && supuestosFaltantes.length) {
    // el texto lo redacta el LLM del PLAN (o la red, si el LLM asumió 0% en silencio) — no una prosa fija
    // nuestra, así que pasa por el MISMO lavado de registro que la Pasada 2 (nunca "plata"/"dormido"/relleno),
    // aunque nunca llegue a invocar al narrador libre.
    const composed = stripFiller(stripLanguageLeaks(supuestosFaltantes.join(" ")));
    const out = _composedBypassResult(composed, mem, recentNarrationsPrev, scenario);
    if (out) return out;
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
  if (sessionPrefPrev) mem2 = { ...mem2, responsePref: sessionPrefPrev };   // sobrevive applyMemoryUpdate, igual que mechanismByEntity
  if (turnPref && turnPref.persist) mem2 = { ...mem2, responsePref: { contentScope: pref.contentScope, detailLevel: pref.detailLevel } };
  // Fase 3 (owner 2026-07-30): lastOffer/recentSubjects sobreviven applyMemoryUpdate por la MISMA razón de arriba —
  // si no, el narrador (mem: mem2 en el loop de abajo) perdería de vista la oferta/temas recientes en CUALQUIER
  // turno donde el LLM además emita un memoryUpdate, una inconsistencia dependiente de un codepath ajeno. Ambos se
  // sobrescriben con el valor FRESCO de este turno más abajo (lastOffer siempre recalculado, nunca heredado).
  if (priorOffer) mem2 = { ...mem2, lastOffer: priorOffer };
  if (recentSubjectsPrev.length) mem2 = { ...mem2, recentSubjects: recentSubjectsPrev };

  // ── BATCH DETERMINÍSTICO ──
  const { ledger, results, trace } = runPlan({ intent: plan.intent, calls }, { scenario, maxCalls });
  const figs = ledgerBoleta(ledger);

  // temas recientes (Fase 3) — se deriva DESPUÉS de que plan.scope ya está resuelto (por comprensión, como
  // siempre); señal para el LLM, nunca autoridad (ver dialogueState.js). No depende de `results`, pero vive acá,
  // junto al resto del estado post-plan que sobrevive hasta el return final.
  const recentSubjectsNow = updateRecentSubjects(recentSubjectsPrev, plan, calls, history.length);
  mem2 = { ...mem2, recentSubjects: recentSubjectsNow };

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
    const det = ensurePeriodoDeclared(_rutaDeterministica(pref, simple), periodos);
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
  if (!narration && pref.contentScope !== "data_only" && pref.contentScope !== "results_only") for (let attempt = 0; attempt < 3; attempt++) {
    let n;
    try { n = await callNarrate({ text: q, plan, results, ledgerFigs: figs, mem: mem2, history, requestContext, pref, instruccionOrientacion }); }
    catch { return null; }
    if (!n || typeof n !== "string" || !n.trim()) continue;
    n = normalizeFigures(n, figs);   // cifras en forma canónica limpia ($4.9M, no $4,943,664)
    n = stripLanguageLeaks(n);       // registro ejecutivo neutro (palanca→acción, plata→caja…) · GARANTÍA sobre lo que el prompt ya pide
    n = stripFiller(n);              // banda prohibida de cierres-relleno (backstop del prompt)
    // action_only: DOBLE candado (data_only/results_only ya no llegan acá, ver arriba). (1) el renderer descarta
    // cualquier bloque que no sea [[ACCION]] — sigue valiendo, cierra la fuga original. (2) hasForbiddenContent
    // valida el CONTENIDO del bloque permitido — si coló lenguaje de causa/interpretación o de siguiente-paso
    // DENTRO de [[ACCION]] (el hueco que el owner cazó, generalizado a este alcance), el intento se DESCARTA
    // ENTERO acá y reintenta — nunca se edita a mano un texto que ya mezcló categorías.
    if (pref.contentScope === "action_only") {
      const parsed = parseBlocks(n);
      if (!parsed || !parsed.accion) continue;
      const rendered = renderFromBlocks(parsed, "action_only");
      if (!rendered || hasForbiddenContent(rendered, "action_only")) continue;
      n = rendered;
    }
    n = ensurePeriodoDeclared(n, periodos);   // requisito 3: garantía determinística, no depende de que el LLM se acuerde
    if (!n.trim()) continue;
    if (guardC(n, { ledger, results, trace, question: q, mechanismMemory, sealedOrders, recentNarrations: recentNarrationsPrev }).ok) { narration = n; break; }
  }
  // REPARACIÓN CONTROLADA (owner: "nunca fallback genérico") — SOLO action_only llega acá normalmente: data_only/
  // results_only ya se resolvieron arriba, siempre, con o sin datos (nunca caen en este loop, ver la condición de
  // arriba). EXCEPCIÓN (owner 2026-07-31, #56 "simulate v2", variante c): si ESTE turno trae un simulateGeneral
  // degradado (costModelAutorizado:false) y el narrador insistió en "conviene" los 3 intentos (guardC lo rechazó
  // siempre), full scope TAMBIÉN repara desde la boleta — componer una tabla de figs autorizadas es SIEMPRE seguro
  // acá (no puede accidentalmente decir "conviene", es solo venta actual/supuesta) — la alternativa (abstenerse del
  // todo y caer al pipeline viejo) sería peor que mostrar la tabla honesta que ya tenemos.
  const simDegradado = results.some((r) => r && r.tool === "simulateGeneral" && r.facts && r.facts.costModelAutorizado === false);
  if (!narration && (pref.contentScope === "action_only" || simDegradado)) {
    const composed = composeFromLedger(figs, pref.contentScope === "action_only" ? "action_only" : "full") || composeNoDataMessage(results);
    const c = ensurePeriodoDeclared(composed, periodos);
    if (guardC(c, { ledger, results, trace, question: q, mechanismMemory, sealedOrders }).ok) { narration = c; narrationRepaired = true; }
  }
  if (!narration) return null;   // dos intentos no pasaron el muro (y sin datos para reparar) → C se abstiene (fallback a la ruta vieja)

  // ── OFERTA DE SEGUIMIENTO + REPETICIÓN (Fase 3) — lastOffer SIEMPRE recalculada desde CERO (nunca heredada, ver
  // dialogueState.js): esto es lo que hace que cambio de tema/rechazo/ejecución invaliden la oferta anterior SIN
  // código especial — la narración de ESTE turno simplemente produce (o no) su propia oferta fresca. extractOffer
  // ya filtra por contentScope="full" internamente (data_only/action_only/results_only nunca ofrecen seguimiento).
  const lastOfferNow = extractOffer(narration, { plan, calls, pref, turno: history.length });
  narration = stripAllMarks(narration);   // ninguna marca [[...]] llega al usuario bajo full (no-op si no hay ninguna)
  mem2 = { ...mem2, lastOffer: lastOfferNow || null, recentNarrations: [narration, ...recentNarrationsPrev].slice(0, 2) };

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
      evidence: buildOracleEvidence({ plan, results, figs, scenario }),
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
      suggestions: null,
      sentrixAction: null,
    },
    mem: mem2,
  };
}
