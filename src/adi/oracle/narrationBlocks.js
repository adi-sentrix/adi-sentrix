/* === src/adi/oracle/narrationBlocks.js · CUMPLIMIENTO ESTRUCTURAL DE `pref` (owner 2026-07-29, residual) ===
 * "No quiero resolverlo con un guard duro que produzca fallback. Quiero cumplimiento estructural." La v1 de
 * responsePreference.js dependía 100% de que el narrador OBEDECIERA la doctrina en prosa libre — verificado en vivo:
 * "resumen ejecutivo, solo cifras" salió como tabla limpia PERO con una frase de acción colgada al final. La v2
 * (bloques + renderer) cerró ESE hueco — pero el owner cazó uno más profundo, con prueba: una etiqueta [[DATOS]]
 * correcta no garantiza que el CONTENIDO adentro sea del tipo correcto (el LLM puede escribir la recomendación
 * ENTERA dentro de un bloque bien marcado, sin usar [[ACCION]] en absoluto — el renderer nunca lo vería como algo
 * que descartar). "Para que 'no puede pasar' sea literalmente cierta":
 *   - data_only / results_only: GARANTÍA POR CONSTRUCCIÓN, SIN EXCEPCIÓN. answerViaOracle.js NUNCA invoca al
 *     narrador libre para estos dos alcances — cero superficie lingüística, compone SIEMPRE desde la boleta
 *     (composeFromLedger), y si la boleta viene vacía, composeNoDataMessage() cierra el último escape que existía
 *     (owner, 3er residual: "nunca debe volver al narrador libre — si falta evidencia, responde determinísticamente
 *     que no existe información autorizada suficiente"). No hay bloque que parsear ni contenido que validar porque
 *     no hay prosa libre en absoluto, en NINGÚN caso.
 *   - action_only: el único alcance que SIGUE narrando libre (la recomendación es juicio, no solo datos — un
 *     composer determinístico no puede razonar el mecanismo). Doble candado: (1) el renderer de bloques descarta
 *     cualquier bloque que no sea [[ACCION]] (v2, sin cambios); (2) hasForbiddenContent() valida el CONTENIDO
 *     mismo del bloque permitido — si coló lenguaje de causa/interpretación o de siguiente-paso, el intento se
 *     descarta ENTERO (nunca se repara quirúrgicamente) y se reintenta; agotados los intentos, composeFromLedger.
 */
export const BLOCK_KEYS = ["datos", "interpretacion", "accion", "siguiente_paso"];

// KEEP_BLOCKS[contentScope] → qué bloques sobreviven el render (siguen siendo pure functions testeables solas,
// aunque en la práctica solo action_only las ejercita hoy — data_only/results_only ya no llegan acá).
export const KEEP_BLOCKS = {
  full: ["datos", "interpretacion", "accion", "siguiente_paso"],
  data_only: ["datos"],
  results_only: ["datos"],
  action_only: ["accion"],
};
export const MANDATORY_BLOCK = { full: null, data_only: "datos", results_only: "datos", action_only: "accion" };

const _MARK_RE = /\[\[(DATOS|INTERPRETACION|ACCION|SIGUIENTE_PASO)\]\]/g;
// `CONTEXTO_GENERAL` va en el STRIP pero NO en `_MARK_RE` (ver el bloque grande al final del archivo): no es una
// categoría del reparto de `contentScope` —esas cuatro PARTICIONAN la respuesta y KEEP_BLOCKS las poda—, es un
// INSET dentro de la prosa. Meterlo en `_MARK_RE` le agregaría una quinta clave a `parseBlocks`, que consumen
// `extractOffer` (dialogueState) y ~20 gates: eso es reestructurar el sistema de bloques, no agregarle un tipo.
// En el strip SÍ, y es la red de último recurso: ninguna marca llega jamás al usuario, la haya rendereado alguien
// o no (bajo data_only/results_only/action_only el renderer del bloque NO corre, y acá muere la marca).
const _MARK_STRIP_RE = /\[\[(?:DATOS|INTERPRETACION|ACCION|SIGUIENTE_PASO|CONTEXTO_GENERAL)\]\]\s*/g;

// stripAllMarks(text) → saca CUALQUIER marca [[...]] del texto VISIBLE (owner 2026-07-31, hallazgo en vivo,
// certificación integral pre-#57): bajo contentScope="full" el narrador NUNCA recibe instruccion_formato (esa
// instrucción está gateada a alcance≠"full", ver blockInstructionFor en responsePreference.js) — pero igual emitió
// "[[ACCION]] Renegociá primero con Falabella..." en un resumen ejecutivo normal, probablemente por aprender el
// patrón de marcado de la MISMA doctrina que se lo prohíbe para este alcance (el LLM ve el token igual, aunque la
// condición diga que no aplica). Bajo full nunca se llama a parseBlocks/renderFromBlocks (eso SOLO corre para
// action_only) así que sin este strip la marca cruda llegaba al usuario tal cual — reproducido, no hipotético.
// Reemplaza a stripOfferMarkers (dialogueState.js, retirada): mismo strip, generalizado a los 4 tokens, no solo
// SIGUIENTE_PASO — evita mantener 2 funciones casi idénticas para lo que en la práctica es el MISMO riesgo.
export function stripAllMarks(text) {
  return String(text || "").replace(_MARK_STRIP_RE, "").trim();
}

// ── truncateToBriefBudget (owner 2026-07-31, certificación integral, riesgo residual #1: "detailLevel=brief no
// muestra compresión medible") ── contentScope tiene enforcement DURO (los bloques [[...]] de arriba); detailLevel
// nunca lo tuvo — era SOLO doctrina de prosa ("respondé más corto que tu forma habitual"), y medido en vivo (2
// turnos consecutivos con brief+persist activo) no mostró NINGUNA reducción real frente al modo estándar. Esto no
// es un ajuste de prompt: es un TOPE ESTRUCTURAL sobre el TEXTO FINAL, igual de duro que el de contentScope, solo
// que en el eje de LARGO en vez de CATEGORÍA de contenido — el resultado NO PUEDE exceder el presupuesto, sin
// importar qué haya escrito el narrador. Corta en el ÚLTIMO límite de oración (.!?) que entre en el presupuesto —
// nunca a mitad de oración (evita dejar una cifra o un nombre colgando sin cierre gramatical). BRIEF_WORD_CAP es
// generoso para 2-3 oraciones + un cierre corto — "breve" no es "telegráfico", solo notablemente más corto que el
// estándar (que en vivo rondaba 120-220 palabras).
export const BRIEF_WORD_CAP = 90;
export function truncateToBriefBudget(text, maxWords = BRIEF_WORD_CAP) {
  const s = String(text || "").trim();
  if (!s) return s;
  const words = s.split(/\s+/);
  if (words.length <= maxWords) return s;   // ya cumple — no toca nada, cero costo en el caso común
  let cut = null;
  for (const m of s.matchAll(/[.!?](?=\s|$)/g)) {
    const upTo = s.slice(0, m.index + 1);
    if (upTo.split(/\s+/).length <= maxWords) cut = upTo;
    else break;
  }
  if (cut && cut.trim().length > 20) return cut.trim();   // al menos una oración completa entró — gramaticalmente sano
  // ni la PRIMERA oración entra en el presupuesto (caso raro, oración inicial larga) → corte duro por palabra,
  // con "…" visual para que quede claro que es un recorte, no el cierre natural del narrador.
  return `${words.slice(0, maxWords).join(" ").replace(/[,;:]+$/, "")}…`;
}

// parseBlocks(text) → { datos?, interpretacion?, accion?, siguiente_paso? } | null (null = el narrador NO usó el
// formato de bloques — falla estructural, el caller reintenta o repara). Cada bloque corre hasta el PRÓXIMO marcador
// o el fin del texto — no hace falta cierre explícito, más fácil de producir consistentemente para el LLM.
export function parseBlocks(text) {
  const s = String(text == null ? "" : text);
  const marks = [...s.matchAll(_MARK_RE)];
  if (!marks.length) return null;
  const out = {};
  for (let i = 0; i < marks.length; i++) {
    const key = marks[i][1].toLowerCase();
    const start = marks[i].index + marks[i][0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : s.length;
    const chunk = s.slice(start, end).trim();
    if (!chunk) continue;
    out[key] = out[key] ? `${out[key]}\n\n${chunk}` : chunk;   // el LLM a veces repite un bloque partido — se concatena
  }
  return Object.keys(out).length ? out : null;
}

// renderFromBlocks(parsed, contentScope) → SOLO los bloques que ese alcance permite, tags fuera. Sigue siendo
// necesario para action_only (KEEP_BLOCKS.action_only descarta [[DATOS]]/[[INTERPRETACION]]/[[SIGUIENTE_PASO]] por
// construcción) — pero YA NO es, por sí sola, la garantía completa: ver hasForbiddenContent abajo.
export function renderFromBlocks(parsed, contentScope) {
  const keep = KEEP_BLOCKS[contentScope] || KEEP_BLOCKS.full;
  return keep.map((k) => parsed && parsed[k]).filter(Boolean).join("\n\n").trim();
}

// ── CONTAMINACIÓN INTERNA DEL BLOQUE (owner 2026-07-29, 2do residual: "[[DATOS]] Ventas: $100M. Te recomiendo
// renegociar con Falabella." — la etiqueta es correcta, el CONTENIDO no) ── SOLO aplica a action_only: es el
// ÚNICO alcance que sigue narrando libre después de este fix (data_only/results_only nunca llegan acá, ver
// answerViaOracle.js). Detecta lenguaje de OTRA categoría colado dentro del bloque permitido — si lo encuentra,
// el caller DESCARTA el intento entero (no intenta stripear la oración ofensora: un texto que ya mezcló
// categorías es más barato de re-generar que de editar a mano sin dejarlo gramaticalmente roto).
const _CAUSAL_LEAK_RE = /\b(esto se debe a|esto ocurre porque|esto sucede porque|la causa (?:de esto )?es|se debe a que|el motivo es|esto explica por qu[eé]|esto indica que|esto sugiere que|esto refleja que)\b/i;
const _NEXT_STEP_LEAK_RE = /¿(?:quer[eé]s|te gustar[ií]a|avanzamos|seguimos|profundizamos)\b|si quer[eé]s,? puedo\b/i;
export function hasForbiddenContent(text, contentScope) {
  const s = String(text || "");
  if (contentScope === "action_only") return _CAUSAL_LEAK_RE.test(s) || _NEXT_STEP_LEAK_RE.test(s);
  return false;   // data_only/results_only: sin narración libre, sin contenido que validar (garantía por construcción)
}

// ── composeFromLedger(figs, contentScope) ── SIN LLM, sin invención: arma la respuesta DIRECTO de las cifras ya
// autorizadas. Para data_only/results_only, YA NO es una reparación de último recurso — es la ÚNICA vía (ver
// answerViaOracle.js). Para action_only, sigue siendo la reparación tras 3 intentos fallidos.
const _NON_ENTITY_SUFFIX_RE = /^(subtotal|total)$/i;
// _isEntityAttributed: el ÚLTIMO segmento del label (tras el separador "·") es un nombre real, no "subtotal"/
// "total" — evita que la "prioridad" de action_only termine siendo un total agregado (bug real cazado en este
// mismo pase: list[0] a veces ES "Contribución no capturada · subtotal", no una entidad accionable).
function _isEntityAttributed(fig) {
  const segs = String(fig.label || "").split("·").map((s) => s.trim());
  if (segs.length < 2) return false;
  const last = segs[segs.length - 1];
  return last.length >= 3 && !_NON_ENTITY_SUFFIX_RE.test(last);
}
function _bestByMagnitude(figs) {
  let best = figs[0], bestAbs = typeof best.raw === "number" && isFinite(best.raw) ? Math.abs(best.raw) : -Infinity;
  for (const f of figs) {
    const abs = typeof f.raw === "number" && isFinite(f.raw) ? Math.abs(f.raw) : -Infinity;
    if (abs > bestAbs) { best = f; bestAbs = abs; }
  }
  return best;
}

// ── SUPUESTO DE SIMULACIÓN BAJO data_only/results_only (owner 2026-08-04, GAP 3, consolidación Parte 2) ──
// composeFromLedger armaba la tabla SOLO de fig.label/fig.value — fig.context (donde vive el texto del supuesto,
// ej. "supuesto: costo medio -3% sobre los sku bajo benchmark (dato real)", ver composeSpecSimulateCosto/
// composeSpecSimulate/composeSpecSimulateCarga/composeSpecSimulateCapital en specRetrieval.js — TODAS estampan
// "supuesto" al inicio de fig.context) se descartaba por completo. Bajo data_only/results_only este composer es el
// ÚNICO texto que llega al usuario (garantía por construcción, ver el comentario de cabecera del archivo) — sin
// este fix, una simulación bajo results_only mostraba el resultado numérico SIN decir sobre qué supuesto se
// calculó, violando DIRECTO el requisito del owner ("en una simulación NUNCA ocultes el supuesto usado"). Declarar
// el supuesto es METADATO indispensable (qué %/acción se asumió), no análisis ni recomendación — no rompe "sin
// análisis". Toma el PRIMER fig con un context de supuesto (todas las filas de una misma simulación comparten el
// mismo _ctx en origen, ver specRetrieval.js) — nunca concatena varios, evita ruido si hubiera figs de más de una
// simulación mezcladas en el mismo turno (caso hoy no ejercitado, pero la función queda correcta igual).
const _SUPUESTO_CTX_RE = /supuesto/i;
function _findSupuestoContext(list) {
  for (const f of list) {
    if (f && typeof f.context === "string" && _SUPUESTO_CTX_RE.test(f.context)) return f.context.trim();
  }
  return null;
}
function _formatSupuestoLine(context) {
  const cleaned = context.replace(/^supuesto\s*:?\s*/i, "");
  return `Supuesto: ${cleaned}.`;
}

export function composeFromLedger(figs, contentScope) {
  const list = Array.isArray(figs) ? figs.filter((f) => f && typeof f.label === "string" && f.value != null) : [];
  if (!list.length) return null;
  if (contentScope === "action_only") {
    const entityFigs = list.filter(_isEntityAttributed);
    const top = _bestByMagnitude(entityFigs.length ? entityFigs : list);
    return `La prioridad: ${top.label} (${top.value}).`;
  }
  const rows = list.slice(0, 12).map((f) => `| ${f.label} | ${f.value} |`);
  let table = `| Concepto | Valor |\n|---|---|\n${rows.join("\n")}`;
  if (contentScope === "data_only" || contentScope === "results_only") {
    const supuesto = _findSupuestoContext(list);
    if (supuesto) table += `\n\n${_formatSupuestoLine(supuesto)}`;
  }
  return table;
}

// ── composeFromTextualEvidence(results) ── LA EVIDENCIA AUTORIZADA QUE NO ES UNA CIFRA (owner 2026-08-11) ───────
// EL DEFECTO QUE CIERRA (medido): tras usar "contribución no capturada" cuatro veces, ante "No entendí lo de
// contribución no capturada" ADI contestó "No tengo información autorizada suficiente para responder eso con el
// alcance pedido" — MIENTRAS tenía la definición en la mano, resuelta y sellada. El plan era correcto
// (intent="define", defineConcept), la tool respondió con coverage.supported=true… y su evidencia es TEXTO, no
// cifras. Bajo data_only/results_only el único compositor que existía sabía imprimir BOLETA (composeFromLedger);
// con la boleta vacía caía a composeNoDataMessage y el motor declaraba una ausencia que no era cierta.
//
// LA REGLA GENERAL, y por qué no es un parche a ese término: el alcance restringido acota los turnos que responden
// un DATO — le dice al motor cuánta interpretación puede acompañar a una cifra. Una DEFINICIÓN no es un turno de
// dato: no tiene universo, no tiene período y no hay nada que interpretar de más. Cuando la evidencia autorizada
// del turno es textual, se dice tal cual viene del glosario, y el alcance se cumple igual —de hecho mejor: cero
// prosa libre, cero superficie lingüística, exactamente la garantía por construcción que esta rama existe para
// sostener. Vale para los 35+ conceptos del glosario, para cualquier redacción ("qué es X", "no entiendo X",
// "explicame X en simple") y para los DOS alcances restringidos.
//
// EL LÍMITE, angosto a propósito: exige (a) que la tool haya declarado `supported: true` —evidencia AUTORIZADA, no
// una tool que declinó—, (b) que NO haya aportado ninguna cifra a la boleta del turno, y (c) que sus `facts`
// declaren ser una definición (`es_definicion`) o traigan el campo `definicion`. Sin (c), cualquier turno de datos
// con boleta vacía dejaría de dar el mensaje honesto y empezaría a narrar algo — que es justo lo que el 3er
// residual cerró. VERBATIM: se imprime lo que la tool selló, sin reescribir ni resumir (una definición curada es
// el antídoto al "inventa algo": cero deriva). Devuelve null cuando no hay evidencia textual — el caller sigue con
// composeNoDataMessage, que sigue siendo la última red honesta del motor.
/* ── componerPorForma · EL FALLBACK TAMBIÉN TIENE FORMA (owner 2026-08-12, punto 3) ═══════════════════════════════
 * EL DEFECTO MEDIDO, en cinco turnos de la certificación de f4f2949: cuando el narrador libre agota sus intentos
 * —o desobedece— el motor repara desde la boleta, y hasta hoy esa reparación tenía UNA sola forma: `composeFromLedger`,
 * que imprime una tabla de doce filas para todo lo que no sea `action_only`. El usuario que pidió prosa recibía una
 * tabla; el que pidió sólo la conclusión recibía doce filas; el que pidió una tabla recibía una tabla sin una línea
 * que la leyera. La forma pedida se resolvía en `resolveOutputForm` y se garantizaba en el renderer… pero el
 * compositor de emergencia no la miraba, así que el renderer terminaba PODANDO la tabla que este compositor acababa
 * de armar y dejaba la respuesta en nada.
 *
 * LA REGLA: la reparación usa el `outputForm` y el `contentScope` YA RESUELTOS del turno. No los vuelve a deducir
 * —sería un segundo criterio que se desincroniza con el primero—, los recibe.
 *
 * LO QUE NUNCA HACE, y es lo que lo mantiene seguro: NO RECALCULA NI UNA CIFRA. Cada número que emite sale de
 * `fig.value` VERBATIM, con su `fig.label` verbatim. No suma, no promedia, no convierte escalas, no rankea por otro
 * criterio que la magnitud que el propio ledger ya selló en `raw`. Por eso pasa guardC por la misma razón que la
 * tabla siempre pasó: no hay ninguna cifra nueva que autorizar.
 * Y CONSERVA EL MARCO: entidad, métrica, período, universo, supuesto y estatus epistemológico viajan con la cifra
 * (`fig.tipo`), así que se leen de ahí en vez de re-derivarse. Un fallback que pierde el período o el sello
 * convierte una estimación en un hecho — exactamente el defecto que el muro existe para bloquear. */

const _SELLO_ORDEN = ["probado", "indicado", "abierto"];
const _SELLO_FRASE = {
  probado: "El dato lo demuestra",
  indicado: "La señal apunta ahí, sin cerrarla",
  abierto: "Con este dato no se puede cerrar",
};
const _figsValidas = (figs) => (Array.isArray(figs) ? figs.filter((f) => f && typeof f.label === "string" && f.value != null) : []);
const _sello = (f) => (f && f.tipo && _SELLO_ORDEN.includes(f.tipo.sello) ? f.tipo.sello : "probado");
// el sujeto del turno: la entidad que más cifras aporta. Es lo que impide que la prosa de reparación CAMBIE DE
// SUJETO (E3.t3: se preguntaba por una cuenta y el fallback narraba el negocio entero).
/* UN SUJETO SE AFIRMA CUANDO UNA ENTIDAD DOMINA DE VERDAD (owner 2026-08-12, defecto visto en N1).
 * ANTES devolvía el primer máximo, y con seis cuentas empatadas a dos figs cada una eso es un empate resuelto por
 * orden de iteración: el fallback escribió «Sobre Falabella: Lider · LG-WASH11KG marca 6.4M» — sujeto de una
 * cuenta, cifra de otra, en la misma oración. No es un detalle de estilo: le atribuye a Falabella una cifra que
 * es de Lider, que es exactamente lo que todo este motor existe para no hacer.
 * AHORA se exige MAYORÍA REAL —más de la mitad de las figs con entidad— y sin empate. Un turno sobre una cuenta la
 * sigue nombrando; un turno multi-entidad devuelve null, y el caller pone un encabezado neutral. Preferir no tener
 * sujeto antes que tener el equivocado es la misma doctrina que el resto del archivo. */
function _sujeto(list) {
  const cuenta = new Map();
  let conEntidad = 0;
  for (const f of list) {
    const e = f.tipo && f.tipo.entidad;
    if (e) { cuenta.set(e, (cuenta.get(e) || 0) + 1); conEntidad++; }
  }
  if (!conEntidad) return null;
  let mejor = null, max = 0, empatado = false;
  for (const [e, n] of cuenta) {
    if (n > max) { mejor = e; max = n; empatado = false; }
    else if (n === max) empatado = true;
  }
  return (!empatado && max * 2 > conEntidad) ? mejor : null;
}
const _periodo = (list) => { for (const f of list) { const p = f.tipo && f.tipo.periodo; if (p) return p; } return null; };
const _universo = (list) => { for (const f of list) { const u = f.tipo && (f.tipo.universoEtiqueta || f.tipo.universo); if (u) return u; } return null; };
// UNA oración con la cifra, su entidad y su período — el contrato de `data_only` según el owner.
// `lider` (Paso 3b): la fig que ENCABEZA ya viene decidida por componerPorForma (métrica preguntada > magnitud);
// sin lider, el criterio local de siempre — byte-idéntico al comportamiento previo.
function _oracionDeCifra(list, lider = null) {
  const f = lider || _bestByMagnitude(_figsValidas(list).filter(_isEntityAttributed).length ? list.filter(_isEntityAttributed) : list);
  const per = f.tipo && f.tipo.periodo;
  const uni = f.tipo && f.tipo.universoEtiqueta;
  const marco = [uni, per].filter(Boolean).join(", ");
  return `${f.label}: ${f.value}${marco ? ` (${marco})` : ""}.`;
}
/* ── LA MÉTRICA PREGUNTADA ENCABEZA (owner 2026-08-13, Paso 3b · hallazgo 2 de la certificación en vivo) ─────────
 * MEDIDO: bajo solo-datos, «margen de Sodimac» respondió «Sodimac · Ventas: $8.2M» — el margen (23.5%) estaba en
 * la boleta del turno y no encabezó, porque el único criterio era la magnitud mayor y $8.2M le gana a 23.5 en
 * valor absoluto siempre. LA REGLA: si la pregunta nombra una métrica que está en la boleta, ESA encabeza; la
 * magnitud mayor queda como criterio SOLO cuando la pregunta no nombra métrica (o la nombrada no está).
 * `metricaLabels` llega del caller (answerViaOracle) YA resuelto con el léxico determinístico que existe — la
 * tabla texto→token de tensión y fieldLabel token→etiqueta del registro de columnas — nunca un matcher nuevo acá.
 * El matcheo contra la fig exige que la etiqueta pedida sea un SEGMENTO «·» completo del label («Sodimac · Margen»
 * matchea «Margen»; «Benchmark de margen» NO — es un solo segmento y no es la métrica, es su referencia). */
function _figsDeMetricaPedida(list, metricaLabels) {
  const labels = (Array.isArray(metricaLabels) ? metricaLabels : []).filter((l) => typeof l === "string" && l.trim());
  if (!labels.length) return [];
  const canon = labels.map((l) => l.trim().toLowerCase());
  return list.filter((f) => String(f.label || "").split("·").map((s) => s.trim().toLowerCase()).some((seg) => canon.includes(seg)));
}
// las MISMAS figs, sin tabla y sin una palabra propia — la base de toda forma no tabular.
const _enLinea = (list, tope = 12) => list.slice(0, tope).map((f) => `${f.label}: ${f.value}`).join(" · ");
function _tabla(list) {
  const rows = list.slice(0, 12).map((f) => `| ${f.label} | ${f.value} |`);
  return `| Concepto | Valor |\n|---|---|\n${rows.join("\n")}`;
}

export function componerPorForma({ figs, contentScope, forma = "auto", metricaLabels = [] } = {}) {
  const list = _figsValidas(figs);
  if (!list.length) return null;
  // la fila que manda: entidad atribuida si la hay, y entre ésas la de mayor magnitud SELLADA en `raw` — nunca un
  // orden calculado acá. Paso 3b: si la pregunta NOMBRA una métrica presente (ver _figsDeMetricaPedida), esa fig
  // encabeza; `topMagnitud` se conserva aparte porque la lectura mínima de la tabla («la fila de mayor magnitud»)
  // sigue siendo un hecho de magnitud, no de qué se preguntó.
  const conEntidad = list.filter(_isEntityAttributed);
  const topMagnitud = _bestByMagnitude(conEntidad.length ? conEntidad : list);
  const pedidas = _figsDeMetricaPedida(conEntidad.length ? conEntidad : list, metricaLabels);
  const top = pedidas.length ? _bestByMagnitude(pedidas) : topMagnitud;

  // el alcance manda sobre la forma: `action_only` tiene su propio contrato estricto y no admite prosa suelta.
  if (contentScope === "action_only") return `La prioridad: ${top.label} (${top.value}).`;

  const supuesto = _findSupuestoContext(list);
  /* LA AFINIDAD SE DECLARA EN CUALQUIER FORMA (owner 2026-08-12, hallazgo M1). Si el turno sirve una relación
   * sellada `indicado`, el texto tiene que decir que es estimada — y esta reparación es texto como cualquier otro.
   * Sin esto el propio muro bloquearía el fallback por la regla nueva, y tendría razón: la regla no distingue quién
   * redactó, y no debería. Un compositor exento sería una puerta trasera para el mismo defecto. */
  const _afinidad = list.some((f) => f && f.tipo && f.tipo.sello === "indicado" && /afinidad/i.test(String(f.context || "")));
  const _NOTA_AFINIDAD = "La relación cliente×SKU no está registrada en el dato: es una afinidad estimada por surtido, así que son cuentas candidatas, no compras ya ocurridas.";
  const conSupuesto = (t) => {
    const conNota = _afinidad ? `${t}\n\n${_NOTA_AFINIDAD}` : t;
    return supuesto ? `${conNota}\n\n${_formatSupuestoLine(supuesto)}` : conNota;
  };

  /* LA FORMA TABULAR SE DECIDE ANTES QUE EL ALCANCE, y sólo ella. «Solo la tabla» nombra la tabla EN POSITIVO, así
   * que fija las dos cosas a la vez: la forma es `tabla` y el alcance queda restringido. Si acá mandara el alcance,
   * ese turno caería en la oración breve de `data_only` y el usuario que pidió una tabla no recibiría ninguna.
   * LA LECTURA MÍNIMA ES LO QUE SE RECORTA, no la tabla: con alcance `full` la tabla va acompañada de una línea que
   * la lee (E2.t1 y E2.t4, donde la tabla salía sola y sin nada que la interpretara); con el alcance restringido de
   * «solo la tabla», va sola — que es exactamente lo pedido. */
  if (forma === "tabla") {
    const t = _tabla(list);
    if (contentScope !== "full") return conSupuesto(t);
    // LECTURA MÍNIMA, no interpretación: nombra la fila de mayor magnitud —un hecho de orden que el propio ledger
    // ya selló en `raw`— y nada más. No dice por qué, porque el ledger no trae la causa. Siempre `topMagnitud`:
    // la frase afirma magnitud, así que no puede señalar la fig de la métrica preguntada si no es la mayor.
    return conSupuesto(`${t}\n\nLa fila de mayor magnitud es ${topMagnitud.label}, con ${topMagnitud.value}.`);
  }

  // `data_only` — el owner lo fijó explícito: cifra, entidad y período en UNA oración breve. Ni tabla ni análisis.
  if (contentScope === "data_only") return conSupuesto(_oracionDeCifra(list, top));
  // `results_only` es «sólo los resultados» de una SIMULACIÓN: el efecto del supuesto, sin el consejo. La tabla es
  // la forma correcta ahí —son varias filas de resultado— y el supuesto viaja pegado, nunca oculto.
  if (contentScope === "results_only") return conSupuesto(_tabla(list));

  // una conclusión de afinidad cabe en una línea Y declara que es estimada: agregarle el párrafo entero rompería
  // la brevedad pedida, pero omitir el estatus la volvería una afirmación de compra en tres palabras.
  if (forma === "solo_conclusion") return `${top.label}: ${top.value}${_afinidad ? " (afinidad estimada, no compra registrada)" : ""}.`;

  // ── PROSA · el estatus epistemológico se SEPARA, no se aplana (E1.t3) ──────────────────────────────────────────
  // Los tres grupos salen del sello que cada fig ya trae. Aplanarlos sería presentar una estimación con el mismo
  // peso que una lectura directa, que es la mentira que el sello existe para impedir.
  if (forma === "prosa") {
    const suj = _sujeto(list), per = _periodo(list), uni = _universo(list);
    const partes = [];
    const encabezado = [suj ? `Sobre ${suj}` : null, uni, per].filter(Boolean).join(" · ");
    if (encabezado) partes.push(`${encabezado}:`);
    for (const s of _SELLO_ORDEN) {
      const delGrupo = list.filter((f) => _sello(f) === s);
      if (!delGrupo.length) continue;
      partes.push(`${_SELLO_FRASE[s]} — ${_enLinea(delGrupo, 8)}.`);
    }
    // si el turno no trajo nada ABIERTO, se dice igual: el silencio sobre el límite se lee como que no hay límite.
    if (!list.some((f) => _sello(f) === "abierto")) partes.push("Con el dato autorizado de este turno no hay nada más que cerrar.");
    return conSupuesto(partes.join("\n\n"));
  }

  // ── AUTO · qué pasa, por qué y qué hacer primero — SÓLO desde el ledger ────────────────────────────────────────
  // El movimiento (02) es el delicado: el ledger trae cifras, no causas. Inventar una acá sería exactamente
  // `causa-sobredimensionada`. Así que se declara ABIERTO cuando no hay evidencia causal sellada, que es la
  // respuesta honesta y además la que el muro deja pasar.
  {
    const suj = _sujeto(list), per = _periodo(list), uni = _universo(list);
    const marco = [uni, per].filter(Boolean).join(", ");
    /* EL SUJETO Y LA CIFRA SALEN DE LA MISMA FIG, O NO HAY SUJETO (owner 2026-08-12).
     * Acá se recalculaba `top` en local —idéntico al de arriba, pero recalculado— y el sujeto salía por separado
     * de `_sujeto`. Dos caminos para la misma oración es dos oportunidades de que no coincidan, y no coincidieron:
     * «Sobre Falabella: Lider · LG-WASH11KG marca 6.4M». Ahora se usa EL MISMO `top` de la cabecera y el prefijo
     * sólo se escribe si la entidad del sujeto es la de esa fig. Cuando no lo es —o cuando ninguna cuenta domina—
     * va un encabezado NEUTRAL, que dice de qué trata el turno sin atribuírselo a nadie.
     * Un turno de una sola cuenta no cambia: ahí sujeto y fig principal son la misma, y el prefijo sale igual. */
    const _mismaEntidad = suj && top.tipo && top.tipo.entidad === suj;
    const _neutral = _afinidad ? "Afinidad estimada por SKU: " : "";
    const qp = `${_mismaEntidad ? `Sobre ${suj}: ` : _neutral}${top.label} marca ${top.value}${marco ? ` (${marco})` : ""}.`;
    const resto = list.filter((f) => f !== top);
    const pq = resto.length
      ? `El resto de lo autorizado en este turno: ${_enLinea(resto, 6)}. El dato disponible no aísla la causa — para cerrarla falta evidencia que este turno no trae.`
      : "El dato disponible no aísla la causa — para cerrarla falta evidencia que este turno no trae.";
    // Paso 3b: la justificación de la prioridad tiene que decir la verdad del criterio usado — si encabezó la
    // métrica preguntada, «magnitud mayor» sería falso (medido: «explícame ese margen» cerró señalando Ventas).
    const qh = pedidas.length
      ? `Por dónde partir: ${top.label}, que es la métrica por la que preguntaste.`
      : `Por dónde partir: ${top.label}, que es la magnitud mayor de las autorizadas.`;
    return conSupuesto([qp, pq, qh].join("\n\n"));
  }
}

/* ── ensureCoberturaDeclarada · LO QUE FALTÓ SE DICE, NO SE CONFÍA (owner 2026-08-12, defecto B2) ═══════════════
 * MEDIDO EN LA CORRIDA DEL 12/08: «Agregá NoExisteSA a esa comparación.» El motor hizo TODO bien —descompuso a
 * `gridTable`, resolvió las cuatro cuentas reales y dejó `NoExisteSA` en `cobertura.faltantes`—, y la respuesta no
 * la mencionó. El dato estaba completo y correcto; el texto se olvidó de la mitad honesta.
 * LA CAUSA NO ES EL NARRADOR: nada en el motor le OBLIGABA a decirlo. Una entidad que el usuario nombró y que el
 * dato no tiene es exactamente lo que no puede quedar a criterio de redacción — el usuario que no lee «NoExisteSA
 * no está» asume que sí está y que su cifra se contó.
 * POR ESO ES DETERMINÍSTICO: si alguna call declaró faltantes y el texto no las nombra, se agrega la línea. No
 * reescribe nada de lo que el narrador dijo y no toca ninguna cifra: sólo añade el dato que faltaba.
 * NO EMITE NINGÚN NÚMERO, a propósito: una línea de cobertura con cifras sería una cifra sin autorizar en la boleta,
 * y el muro la bloquearía con razón. Nombra entidades, que son texto del pedido del propio usuario. */
export function ensureCoberturaDeclarada(text, results) {
  const t = String(text || "");
  const faltantes = [];
  for (const r of (Array.isArray(results) ? results : [])) {
    const cb = r && r.coverage && r.coverage.cobertura;
    for (const f of (cb && Array.isArray(cb.faltantes) ? cb.faltantes : [])) {
      if (f && !faltantes.includes(f)) faltantes.push(f);
    }
  }
  if (!faltantes.length) return t;
  // las que el texto YA nombra no se repiten: si el narrador lo dijo bien, esto no tiene nada que agregar.
  const sinMencionar = faltantes.filter((f) => !new RegExp(`\\b${String(f).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(t));
  if (!sinMencionar.length) return t;
  const lista = sinMencionar.join(", ");
  const linea = sinMencionar.length === 1
    ? `No incluí ${lista}: no aparece en el dato de este eje, así que no hay cifra suya que sumar.`
    : `No incluí ${lista}: no aparecen en el dato de este eje, así que no hay cifras suyas que sumar.`;
  return t ? `${t.trim()}\n\n${linea}` : linea;
}

const _MAX_DEFINICIONES = 2;   // un turno pregunta por un concepto, a veces por dos; más que eso es un volcado
export function composeFromTextualEvidence(results) {
  const list = Array.isArray(results) ? results : [];
  const textuales = list.filter((r) => {
    if (!r || !r.coverage || r.coverage.supported !== true) return false;
    if (Array.isArray(r.boleta) && r.boleta.length) return false;
    const f = r.facts;
    if (!f || typeof f !== "object") return false;
    return f.es_definicion === true || typeof f.definicion === "string";
  });
  if (!textuales.length) return null;
  const bloques = [];
  for (const r of textuales.slice(0, _MAX_DEFINICIONES)) {
    const f = r.facts;
    const def = typeof f.definicion === "string" ? f.definicion.trim() : "";
    if (!def) continue;
    const concepto = typeof f.concepto === "string" ? f.concepto.trim() : "";
    // el concepto encabeza (el usuario preguntó por un nombre: la respuesta empieza nombrándolo) y la distinción,
    // cuando la hay, va aparte — es parte de la definición curada, no una interpretación agregada acá.
    bloques.push(concepto ? `${concepto.charAt(0).toUpperCase()}${concepto.slice(1)}: ${def}` : def);
    if (typeof f.distingue === "string" && f.distingue.trim()) bloques.push(f.distingue.trim());
  }
  return bloques.length ? bloques.join("\n\n") : null;
}

// ── composeNoDataMessage(results) ── owner 2026-07-29, 3er residual: "bajo data_only o results_only, NUNCA debe
// volver al narrador libre — si falta evidencia, responde determinísticamente." Cierra el ÚLTIMO escape: hasta acá,
// una boleta vacía (composeFromLedger devuelve null) todavía cedía al narrador como red — el único hueco que
// quedaba para estos dos alcances. Esta función NUNCA devuelve null: siempre hay AL MENOS el mensaje genérico, así
// que el caller (answerViaOracle.js) ya no necesita ese escape en absoluto.
//   - si algún tool YA declinó con una razón real (coverage.reason — la MISMA razón que citaría el narrador libre
//     por la doctrina HONESTIDAD de narratePromptC.js), la cita literal — nunca inventa una razón distinta.
//   - si no hay ninguna razón específica (ej. intent=ack, calls vacío), el mensaje genérico igual es honesto: no
//     hay información autorizada, punto.
//   - en espíritu de "solicita el dato faltante" (owner): cierra pidiendo la precisión que falta, en vez de un
//     "no" seco — SIN construir el mecanismo formal `request_clarification` de intent en el PLAN, que sigue
//     guardado para el proyecto simulate v2 (ver memoria adi-simulate-v2-motor-escenarios) — acá es solo la frase
//     de cierre de un mensaje ya determinístico, no un nuevo intent ni un nuevo turno de conversación.
export function composeNoDataMessage(results) {
  const list = Array.isArray(results) ? results : [];
  const declined = list.find((r) => r && r.coverage && r.coverage.supported === false && typeof r.coverage.reason === "string" && r.coverage.reason.trim());
  if (declined) return `No tengo información autorizada suficiente: ${declined.coverage.reason}. Dime el nombre exacto o el dato que buscas y lo reviso.`;
  return "No tengo información autorizada suficiente para responder eso con el alcance pedido. Cuéntame qué dato específico necesitas y lo busco.";
}

// ── composeSoloDatosConfusionMessage(results) ── D2 (owner 2026-08-13, Paso 3 de "ADI pierde el hilo") ─────────
// EL CASO: bajo la preferencia de solo-datos, un «no entiendo» SIN concepto identificable no tiene ni cifra que
// componer ni definición curada que citar — hasta hoy caía al genérico de composeNoDataMessage, que es honesto
// pero no dice la verdad ÚTIL: la explicación existe, lo que la bloquea es la preferencia que el propio usuario
// activó. Este mensaje lo dice, e invita a las dos salidas reales: desactivar la preferencia (la frase «análisis
// completo» es EXACTAMENTE la que el motor ya reconoce como reset — ver _PREF_RESET_RE en answerViaOracle.js) o
// nombrar el dato puntual. MISMA FAMILIA que composeNoDataMessage: determinístico, sin narrador, sin cifras.
// EL CANDADO NO SE TOCA: esto no abre ninguna superficie lingüística nueva — es un texto fijo más en la rama que
// ya era determinística por construcción (memoria adi-preferencia-respuesta).
// DEVUELVE NULL cuando alguna tool YA declinó con una razón real: esa razón (p.ej. «no tengo una definición
// curada para esas palabras») es más específica que este mensaje, y composeNoDataMessage la cita — un concepto
// identificado-pero-desconocido NO es «sin concepto identificable», y prometerle que desactivar la preferencia
// traería la explicación sería falso. El caller cae a composeNoDataMessage, como siempre.
export function composeSoloDatosConfusionMessage(results) {
  const list = Array.isArray(results) ? results : [];
  const declined = list.some((r) => r && r.coverage && r.coverage.supported === false && typeof r.coverage.reason === "string" && r.coverage.reason.trim());
  if (declined) return null;
  return "Tienes activa la preferencia de recibir solo los datos, y una explicación queda fuera de ese formato. Si quieres que te lo explique, pídeme el análisis completo; si prefieres mantener la preferencia, dime qué dato o concepto puntual necesitas y lo busco.";
}

// ── composeAckPreferenciaMessage(contentScope) ── hallazgo 3 (owner 2026-08-13, Paso 3b) ────────────────────────
// EL CASO MEDIDO EN VIVO (hilo C turno 1): «de ahora en adelante dame solo los datos, sin explicaciones» →
// intent=ack, calls vacío, la preferencia SE ACTIVÓ bien… y la respuesta fue el genérico de composeNoDataMessage
// («No tengo información autorizada suficiente…»). Un turno de PURA CONFIGURACIÓN no pidió ningún dato: declarar
// una ausencia ahí es contestar una pregunta que nadie hizo. Se CONFIRMA lo configurado — mensaje determinístico
// corto, MISMA familia que sus vecinas (texto fijo, cero narrador, cero cifras) — y la invitación de vuelta usa
// adrede «análisis completo», la frase que _PREF_RESET_RE ya reconoce como reset: ejecutable, no decorativa.
// SOLO lo llama la rama de solo-datos cuando el turno es ack de preferencia SIN pedido de dato (si además pidió
// un dato, el dato manda — precedencia en answerViaOracle). Sin «desde ahora» en el texto: la persistencia es un
// eje aparte (_PREF_PERSIST_RE) y prometerla acá sería afirmar más de lo que este turno declaró.
export function composeAckPreferenciaMessage(contentScope) {
  const cosa = contentScope === "results_only" ? "solo los resultados" : "solo los datos";
  return `Listo: te entrego ${cosa}, sin análisis ni recomendaciones. Cuando quieras volver al formato habitual, pídeme el análisis completo; y si necesitas un dato ahora, dime cuál y lo busco.`;
}

/* ── EL BLOQUE [[CONTEXTO_GENERAL]] · EL CONTRATO DE CONTEXTO GENERAL (owner 2026-08-13, D2 · AMPLITUD F3) ═══════
 * EL PRINCIPIO, y es lo que hace que esto sea seguro: el conocimiento general del modelo es LO ÚNICO que el notario
 * no puede verificar POR CONTENIDO — no existe boleta contra la cual contrastar «en la industria el margen suele
 * moverse entre 18% y 25%». Así que el muro verifica EL CONTENEDOR. El contexto general vive en un bloque propio,
 * con un marco fijo que pone ESTE renderer; dentro del bloque las cifras no autorizadas se toleran (es su función),
 * pero el bloque carga tres prohibiciones que sí son verificables (guardC, chequeo 26): ninguna entidad del cliente
 * adentro, ninguna cifra de su dato adentro, y AFUERA nada cambia — el chequeo 1 de siempre, sin una sola excepción.
 * Por eso «¿cuánto vendió Falabella según la industria?» no tiene camino: nombrarla adentro se veta, y sacar la
 * cifra afuera la devuelve al muro de siempre.
 *
 * EL MARCO LO PONE EL MOTOR, NUNCA EL MODELO. Si el marco fuera algo que el narrador escribe, sería algo que el
 * narrador puede desfigurar («como contexto general aproximado…») y el usuario perdería la única señal que
 * distingue lo verificado de lo que no lo es. Acá se BORRA cualquier copia literal que el modelo haya escrito y se
 * inserta el marco exactamente una vez, propio. Misma doctrina que ensurePeriodoDeclared/ensureHypothesisFraming:
 * una garantía que depende de la obediencia del LLM no es una garantía.
 *
 * DÓNDE VA: después de la lectura del dato y de la acción, ANTES de la pregunta de cierre — el contexto ilustra
 * una respuesta que ya está completa, no la abre ni la reemplaza. Si el último párrafo es una pregunta (la oferta
 * de seguimiento), el bloque se inserta antes; si no, cierra el texto (y las garantías que corren después —período,
 * cierre de clarify— se suman detrás, como siempre).
 *
 * UNO SOLO POR RESPUESTA: el segundo y siguientes se DESCARTAN ENTEROS (marca + contenido), no se desmarcan. Dejar
 * el contenido sin marca lo convertiría en prosa normal con cifras no autorizadas adentro — el muro lo vetaría y el
 * turno se perdería. Descartarlo es la dirección segura y es lo que el contrato dice literalmente.
 *
 * QUIÉN LO LLAMA: SOLO la rama de narración libre bajo contentScope="full" (answerViaOracle). data_only/
 * results_only NUNCA invocan al narrador —garantía por construcción, ver la cabecera de este archivo—, así que este
 * renderer no corre ahí; y si un texto determinístico trajera la marca por eco (la razón de una tool que cita
 * palabras del usuario), muere en stripAllMarks sin haberse convertido nunca en un bloque con marco. */
export const MARCA_CONTEXTO_GENERAL = "[[CONTEXTO_GENERAL]]";
// EL TEXTO EXACTO, y es contrato: registro formal LatAm, dice las dos cosas que el usuario necesita saber (no sale
// de su dato · no se puede verificar con su información) y termina en dos puntos porque lo que sigue es el aporte.
export const MARCO_CONTEXTO_GENERAL = "Como contexto general — esto no viene de tu dato y no puedo verificarlo con tu información:";
const _CUALQUIER_MARCA_RE = /\[\[[A-Z_]+\]\]/g;

// _finDelBloque(s, desde) → dónde termina el bloque que arranca en `desde`: en la próxima marca de CUALQUIER tipo,
// en el próximo corte de párrafo, o al final del texto — lo que llegue primero. Un aporte de contexto general es
// UN párrafo por doctrina; si el modelo escribió dos, el segundo queda como prosa normal y lo juzga el muro entero
// (dirección segura: el bloque nunca se estira sobre texto que no declaró ser contexto general).
function _finDelBloque(s, desde) {
  _CUALQUIER_MARCA_RE.lastIndex = desde;
  const m = _CUALQUIER_MARCA_RE.exec(s);
  _CUALQUIER_MARCA_RE.lastIndex = 0;
  const porMarca = m ? m.index : -1;
  const porParrafo = s.indexOf("\n\n", desde);
  const cands = [porMarca, porParrafo].filter((i) => i >= 0);
  return cands.length ? Math.min(...cands) : s.length;
}
const _sinMarco = (s) => s.split(MARCO_CONTEXTO_GENERAL).join("").replace(/[ \t]{2,}/g, " ");
const _limpiar = (s) => s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();

export function renderContextoGeneral(text) {
  const s0 = String(text == null ? "" : text);
  const tieneMarca = s0.includes(MARCA_CONTEXTO_GENERAL);
  // sin marca no hay bloque; el marco suelto que el modelo haya escrito igual se borra (no puede quedar en pantalla
  // una señal de «esto no lo puedo verificar» sobre texto que sí está verificado — sería mentir al revés).
  if (!tieneMarca) return s0.includes(MARCO_CONTEXTO_GENERAL) ? _limpiar(_sinMarco(s0)) : s0;
  const s = _sinMarco(s0);
  // los tramos a extraer, en orden de aparición: el PRIMERO aporta el contenido, los demás se descartan.
  const tramos = [];
  let desde = 0, i;
  while ((i = s.indexOf(MARCA_CONTEXTO_GENERAL, desde)) >= 0) {
    const fin = _finDelBloque(s, i + MARCA_CONTEXTO_GENERAL.length);
    tramos.push([i, fin]);
    desde = fin;
  }
  const contenido = tramos.length
    ? s.slice(tramos[0][0] + MARCA_CONTEXTO_GENERAL.length, tramos[0][1]).replace(/\s+/g, " ").trim()
    : "";
  // el cuerpo, sin ninguno de los tramos (de atrás hacia adelante, para no correr los índices de los anteriores).
  let cuerpo = s;
  for (let k = tramos.length - 1; k >= 0; k--) cuerpo = cuerpo.slice(0, tramos[k][0]) + cuerpo.slice(tramos[k][1]);
  cuerpo = _limpiar(cuerpo);
  if (!contenido) return cuerpo;   // marca vacía: se saca y no se inventa un bloque sin nada adentro
  const bloque = `${MARCO_CONTEXTO_GENERAL} ${contenido}`;
  const parrafos = cuerpo.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (!parrafos.length) return bloque;
  // ANTES DE LA PREGUNTA DE CIERRE: si el último párrafo pregunta, el bloque se mete delante; si no, cierra.
  const ultimo = parrafos[parrafos.length - 1];
  if (/\?\s*$/.test(ultimo)) parrafos.splice(parrafos.length - 1, 0, bloque);
  else parrafos.push(bloque);
  return parrafos.join("\n\n");
}

// rangoContextoGeneral(text) → [ini, fin) del bloque YA RENDEREADO, o null. Lo consume guardC para enmascararlo
// antes de sus chequeos de contenido y para juzgar el bloque por separado. Ancla en el MARCO (que solo pone el
// renderer, ver arriba) y corre hasta el corte de párrafo: el bloque es un párrafo, por construcción del renderer.
// Si por lo que fuera hubiera dos marcos, solo el PRIMERO queda exento — dirección segura, nunca al revés.
export function rangoContextoGeneral(text) {
  const s = String(text == null ? "" : text);
  const i = s.indexOf(MARCO_CONTEXTO_GENERAL);
  if (i < 0) return null;
  const corte = s.indexOf("\n\n", i);
  return [i, corte >= 0 ? corte : s.length];
}
