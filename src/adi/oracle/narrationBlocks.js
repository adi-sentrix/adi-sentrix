/* === src/adi/oracle/narrationBlocks.js · CUMPLIMIENTO ESTRUCTURAL DE `pref` (owner 2026-07-29, residual) ===
 * "No quiero resolverlo con un guard duro que produzca fallback. Quiero cumplimiento estructural." La v1 de
 * responsePreference.js dependía 100% de que el narrador OBEDECIERA la doctrina en prosa libre — verificado en vivo:
 * "resumen ejecutivo, solo cifras" salió como tabla limpia PERO con una frase de acción colgada al final. Acá el
 * narrador sigue narrando LIBRE (tablas, negritas, voz — nada de eso cambia), pero ADEMÁS marca su propio texto en
 * bloques ([[DATOS]]/[[INTERPRETACION]]/[[ACCION]]/[[SIGUIENTE_PASO]]) — un RENDERER DETERMINÍSTICO (sin LLM) es
 * quien decide cuáles de esos bloques llegan al usuario según `contentScope`. Si el LLM escribe un bloque que no
 * corresponde, el renderer lo descarta SIEMPRE — la garantía vive en el código, no en la obediencia del prompt.
 *
 * Solo se activa para contentScope !== "full" (data_only/action_only/results_only) — un turno full (la enorme
 * mayoría) nunca ve esta instrucción activarse y su texto no pasa por este parser, cero riesgo para el resto del
 * contrato de narratePromptC.js (tablas, orden sellado, SAGRADO, etc. — nada de eso se toca).
 */
export const BLOCK_KEYS = ["datos", "interpretacion", "accion", "siguiente_paso"];

// KEEP_BLOCKS[contentScope] → qué bloques sobreviven el render. "results_only" es "data_only" con otro nombre: en
// una simulación el bloque DATOS ya ES "supuesto + resultado numérico" (así lo pide narratePromptC.js/SIMULACIÓN) —
// no hace falta un 5º tipo de bloque, es el mismo DATOS aplicado al contenido propio de ese modo.
export const KEEP_BLOCKS = {
  full: ["datos", "interpretacion", "accion", "siguiente_paso"],
  data_only: ["datos"],
  results_only: ["datos"],
  action_only: ["accion"],
};
// MANDATORY_BLOCK[contentScope] → el bloque que TIENE que estar presente para considerar el parseo estructuralmente
// válido. Si falta, es una falla de FORMATO (el LLM no lo etiquetó) — se reintenta, nunca se inventa contenido.
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

// renderFromBlocks(parsed, contentScope) → el texto FINAL que ve el usuario: SOLO los bloques que ese alcance
// permite, tags fuera, unidos en el orden canónico. Esta es la garantía estructural — corre SIEMPRE, sin importar
// qué haya escrito el LLM en los bloques descartados (aunque haya colado una recomendación bajo [[ACCION]] en un
// turno data_only, nunca llega acá: KEEP_BLOCKS.data_only = ["datos"] la excluye por construcción).
export function renderFromBlocks(parsed, contentScope) {
  const keep = KEEP_BLOCKS[contentScope] || KEEP_BLOCKS.full;
  return keep.map((k) => parsed && parsed[k]).filter(Boolean).join("\n\n").trim();
}

// composeFromLedger(figs, contentScope) → REPARACIÓN CONTROLADA (owner: "un reintento y después una composición
// determinística desde la boleta, nunca fallback genérico") — sin LLM, sin invención: arma la respuesta DIRECTO de
// las cifras ya autorizadas del ledger. "action_only" usa el ORDEN SELLADO de la tool (requisito 4, pase quirúrgico
// de confiabilidad — la fila 0 ES la prioridad real, no una que este composer decida) y solo templatea la frase;
// nunca inventa un mecanismo o una causa que no estén en el label/valor ya autorizados.
export function composeFromLedger(figs, contentScope) {
  const list = Array.isArray(figs) ? figs.filter((f) => f && typeof f.label === "string" && f.value != null) : [];
  if (!list.length) return null;
  if (contentScope === "action_only") {
    const top = list[0];
    return `La prioridad: ${top.label} (${top.value}).`;
  }
  const rows = list.slice(0, 12).map((f) => `| ${f.label} | ${f.value} |`);
  return `| Concepto | Valor |\n|---|---|\n${rows.join("\n")}`;
}
