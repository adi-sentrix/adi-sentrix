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
export function composeFromLedger(figs, contentScope) {
  const list = Array.isArray(figs) ? figs.filter((f) => f && typeof f.label === "string" && f.value != null) : [];
  if (!list.length) return null;
  if (contentScope === "action_only") {
    const entityFigs = list.filter(_isEntityAttributed);
    const top = _bestByMagnitude(entityFigs.length ? entityFigs : list);
    return `La prioridad: ${top.label} (${top.value}).`;
  }
  const rows = list.slice(0, 12).map((f) => `| ${f.label} | ${f.value} |`);
  return `| Concepto | Valor |\n|---|---|\n${rows.join("\n")}`;
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
  if (declined) return `No tengo información autorizada suficiente: ${declined.coverage.reason}. Decime el nombre exacto o el dato que buscás y lo reviso.`;
  return "No tengo información autorizada suficiente para responder eso con el alcance pedido. Contame qué dato específico necesitás y lo busco.";
}
