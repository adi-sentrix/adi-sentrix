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
import { guardC, extractMechanismRows } from "./guardC.js";
import { stripFiller, normalizeFigures } from "./narratePromptC.js";
import { stripLanguageLeaks } from "../llm/voiceGuard.js";   // GARANTÍA runtime de registro (owner 2026-07-14/26: "palanca" y demás slang NO van — hoy solo corría en la ruta vieja, C quedaba sin la red)
import { buildOracleEvidence } from "./sentrixEvidence.js";  // SENTRIX ES LA EVIDENCIA (owner 2026-07-28): el panel debe reflejar lo que C acaba de narrar

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

// ── MODO CONVERSACIONAL · capa de rol operativa, Fase 1 (owner 2026-07-29: "no quiero un parche para 'no
// entendí'... quiero un sistema sofisticado pero controlado") — `mode` es un EJE DISTINTO de `intent`: intent
// decide QUÉ DATO pedir, mode decide CÓMO NARRARLO (un "qué significa X" es intent=define + mode=clarify a la vez).
// El plan YA puede elegir mode="clarify" por comprensión (ver planPrompt.js) — esto de acá es el PISO
// determinístico: frases INEQUÍVOCAS de confusión fuerzan clarify sin depender de que el LLM lo note esa vez
// (mismo criterio que _coerceTensionArgs arriba — un gate no puede apoyarse solo en que el LLM "generalmente" lo
// entienda). Si el texto NO matchea, se respeta el mode que el LLM ya eligió (nunca se lo saca — solo se agrega).
// (2 bugs reales cazados probando la regex antes de wireearla: "explíc" con acento no matcheaba el stem "explic"
// literal — \w no cubre acentos; y "no entiendo" (presente) no matcheaba, solo "no entendí" (pasado)).
const _CLARIFY_RE = /\b(no\s+(?:te\s+)?entiend\w*|no\s+entend[ií]\w*|no comprendo|no logro entender|no me qued[oó] claro|no me queda claro|expl[ií]c\w*.{0,20}?\b(?:f[aá]cil|simple|sencill\w*)|en palabras (?:m[aá]s\s+)?simples|m[aá]s simple\b|qu[eé] significa|qu[eé] quiere decir|a qu[eé] te refer[ií]s)/i;
function _coerceMode(text, plan) {
  if (_CLARIFY_RE.test(String(text || ""))) return "clarify";
  return plan && plan.mode === "clarify" ? "clarify" : "default";
}

// answerViaOracle({ text, history, mem, scenario, callPlan, callNarrate, maxCalls }) → { r, mem } | null
//   r   = { text, route:"oracle", evidence:{boleta,...} }  (compatible con _turnFromResult)
//   mem = la memoria de interacción ACTUALIZADA (el llamador la persiste en el context del hilo)
export async function answerViaOracle({ text, history = [], mem = {}, scenario = "actual", callPlan, callNarrate, maxCalls = 6 } = {}) {
  if (typeof callPlan !== "function" || typeof callNarrate !== "function") return null;
  const q = (text || "").trim();
  if (!q) return null;

  // ── PASADA 1 · PLAN (con reintentos · 3 intentos máx, MISMO patrón que el retry de NARRAR más abajo) ──
  // hallazgo del re-barrido de 17 turnos (owner 2026-07-29): a diferencia de NARRAR, el plan NO reintentaba — un
  // JSON malformado del tool_call (el adapter de OpenAI tira "JSON inválido del tool_call: …", ver
  // src/adi/llm/adapters/openai.js) tumbaba el turno ENTERO al fallback en el primer intento, sin darle a C ni una
  // segunda chance. La mayoría de estos fallos son variance de sampling del LLM (el MISMO tool_choice forzado sobre
  // el MISMO schema casi siempre da JSON válido al reintentar) — reintentar recupera la mayoría sin debilitar nada:
  // el plan sigue validado por el schema forzado, y si los 3 intentos fallan, C se abstiene igual que antes.
  let plan = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    let p;
    try { p = await callPlan({ text: q, history, mem, scenario }); }
    catch { continue; }
    if (p && p.intent) { plan = p; break; }
  }
  if (!plan) return null;
  // `calls` puede faltar en intent=ack/define (el modelo lo omite cuando no pide datos) → default [] (NO es abstención).
  // OJO: `plan` se REEMPLAZA (no solo la variable local `calls`) — buildNarrateUserMessageC recibe `plan` completo
  // más abajo, y si solo corregíamos la variable suelta, el narrador seguía viendo plan.calls SIN corregir (bug real
  // cazado en el propio testing de este fix: el batch corría bien pero el narrador quedaba desincronizado del dato).
  plan = { ...plan, calls: _coerceTensionArgs(q, Array.isArray(plan.calls) ? plan.calls : []), mode: _coerceMode(q, plan) };
  const calls = plan.calls;

  // mecanismo dominante por entidad ESTABLECIDO en turnos ANTERIORES (owner 2026-07-29, residual 3: "si un turno ya
  // estableció mecanismo dominante por entidad, el siguiente no debe recomendar otro sin evidencia nueva o sin
  // explicitar el cambio"). Se lee del `mem` ORIGINAL, ANTES de applyMemoryUpdate — ese helper reconstruye su
  // salida desde una lista fija de campos (identidad/preferencias/contexto/estado) y NO preserva claves ajenas,
  // así que leer de `mem2` perdería mechanismByEntity en cualquier turno donde el LLM además emita un memoryUpdate.
  const mechanismMemory = (mem && typeof mem.mechanismByEntity === "object" && mem.mechanismByEntity) || {};
  // memoria de interacción (trato/identidad) — se aplica ANTES de narrar
  let mem2 = plan.memoryUpdate ? applyMemoryUpdate(mem, plan.memoryUpdate) : mem;
  // se lo devolvemos explícito a mem2 (no solo a la variable mechanismMemory de arriba): mem2 es lo que ve el
  // NARRADOR (mem: mem2 más abajo, durante los 3 intentos) — sin esto, un turno con memoryUpdate hacía que el
  // narrador narrara SIN saber qué mecanismo ya estaba establecido, aunque guardC sí lo chequeara correctamente.
  if (Object.keys(mechanismMemory).length) mem2 = { ...mem2, mechanismByEntity: mechanismMemory };

  // ── BATCH DETERMINÍSTICO ──
  const { ledger, results, trace } = runPlan({ intent: plan.intent, calls }, { scenario, maxCalls });
  const figs = ledgerBoleta(ledger);

  // ── PASADA 2 · NARRAR (con DOS reintentos · 3 intentos máx) ──
  // Un rechazo del guard suele ser VARIANCE del LLM (una cifra derivada, una atribución yuxtapuesta). Re-muestrear
  // recupera la mayoría de esos turnos SIN debilitar el muro (el guard valida cada intento igual). El 2º reintento
  // solo se dispara cuando los dos primeros fallaron —los casos difíciles (temporal por entidad, cruces)— donde
  // recuperar una respuesta LIMPIA de C vale más que caer al fallback. Solo si los TRES fallan, C se abstiene.
  let narration = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    let n;
    try { n = await callNarrate({ text: q, plan, results, ledgerFigs: figs, mem: mem2, history }); }
    catch { return null; }
    if (!n || typeof n !== "string" || !n.trim()) continue;
    n = normalizeFigures(n, figs);   // cifras en forma canónica limpia ($4.9M, no $4,943,664)
    n = stripLanguageLeaks(n);       // registro ejecutivo neutro (palanca→acción, plata→caja…) · GARANTÍA sobre lo que el prompt ya pide
    n = stripFiller(n);              // banda prohibida de cierres-relleno (backstop del prompt)
    if (!n.trim()) continue;
    if (guardC(n, { ledger, results, trace, question: q, mechanismMemory }).ok) { narration = n; break; }
  }
  if (!narration) return null;   // dos intentos no pasaron el muro → C se abstiene (fallback a la ruta vieja)

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
      suggestions: null,
      sentrixAction: null,
    },
    mem: mem2,
  };
}
