/* === src/adi/oracle/scenarioIntent.js · COERCIÓN DETERMINÍSTICA DE INTENCIÓN DE ESCENARIO (owner 2026-07-31) ===
 * Certificación integral post-#56 encontró 2 fallas reales de ENTRADA a simulate v2 — no de continuación:
 *   1. "Sube 8% el precio de Lider" (imperativo, sin "¿me conviene?") NUNCA llamaba a simulateGeneral — PLAN lo
 *      leía como un pedido de análisis/decisión distinto y respondía con margen/benchmark, sin pedir el volumen.
 *   2. Una consulta puntual sobre Jumbo "perdió el alcance" y produjo una simulación de CARTERA COMPLETA en vez
 *      de la entidad nombrada.
 * "Que el motor funcione después de reformular o reintentar no basta. El primer intento natural debe llegar al
 * flujo correcto" (owner). Esto NO es un ajuste de doctrina — el LLM sigue siendo el mecanismo PRINCIPAL para el
 * resto de la clasificación; este módulo es SOLO la red determinística para el patrón MÁS inequívoco (una entidad
 * conocida + un cambio de precio/volumen con % concreto), igual que el resto de _coerce* de answerViaOracle.js.
 *
 * DISEÑO DELIBERADAMENTE CONSERVADOR: solo interviene cuando encuentra EXACTAMENTE UN campo (precio XOR volumen)
 * con un % resoluble sin ambigüedad de signo (número con signo explícito, o un verbo direccional inequívoco). Si
 * el texto menciona AMBOS campos (probable "si subo X% el precio y bajo Y% el volumen" — el caso YA cubierto por
 * PLAN normal, verificado funcionando) o NINGUNO, o el signo es ambiguo (un "%" pelado sin verbo ni signo), este
 * módulo se aparta y deja pasar a PLAN sin tocar nada — nunca reemplaza el juicio del LLM en el caso ambiguo,
 * SOLO fuerza el camino correcto cuando es inequívoco (mismo principio que _hasCompleteSimulateVars/pendingSimulation).
 *
 * RECONOCE CUALQUIER MODO GRAMATICAL (imperativo/interrogativo/condicional/infinitivo) — la ÚNICA exclusión real
 * es el TIEMPO PASADO ("el precio subió 8%", "las ventas bajaron 3%"): eso es una LECTURA del dato ya ocurrido,
 * nunca un supuesto a simular — se excluye ANTES de mirar campo/entidad, sin excepción.
 */
import { clientesMargen as _CLIENTES } from "../../data/demoData.js";
import { onTenantChange } from "../../data/tenantStore.js";

const _norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// ── CANON DE CLIENTES (dimension="cliente", la ÚNICA que simulateGeneral v1 soporta) — re-armado por tenant,
// mismo patrón que coerceChain.js._buildCanon (una verdad contra el dataset, nunca una lista propia hardcodeada).
function _buildClientCanon() {
  const m = new Map();
  for (const r of _CLIENTES) if (r && r.nombre) m.set(_norm(r.nombre), r.nombre);
  return m;
}
let _CLIENT_CANON = _buildClientCanon();
onTenantChange(() => { _CLIENT_CANON = _buildClientCanon(); });

// extractKnownClient(text) → nombre CANÓNICO si el texto nombra EXACTAMENTE UN cliente conocido — null si nombra
// cero o 2+ (ambigüedad real: nunca adivina cuál). Scan por límite de palabra sobre texto normalizado (sin tilde,
// minúscula) — mismo patrón que coerceChain.js._soloCanonEn.
export function extractKnownClient(text) {
  const nq = _norm(text);
  const found = new Set();
  for (const [k, nombre] of _CLIENT_CANON) {
    if (k.length < 3) continue;
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(nq)) found.add(nombre);
  }
  return found.size === 1 ? [...found][0] : null;
}

// ── TIEMPO PASADO (preterite 3a persona sing/plural — INEQUÍVOCO, el imperativo español NUNCA usa estas
// terminaciones) — "el precio subió 8%"/"las ventas bajaron 3%" son LECTURAS, nunca supuestos.
// OJO 1 (bug real cazado en el propio testing): JS \b se define sobre \w = [A-Za-z0-9_], que NO incluye vocales
// acentuadas — un \b justo DESPUÉS de "ó"/"í" no encuentra límite válido (ambos lados quedan "no-word" para el
// motor de regex) y el match completo fallaba SIEMPRE que la terminación fuera acentuada ("subió" nunca matcheaba).
// Fix: lookahead negativo de "no sigue otra letra" en vez de \b al final — el \b INICIAL (antes de "sub"/"baj",
// que empiezan con ASCII plano) sigue siendo válido y suficiente.
// OJO 2 (bug real): usar una CLASE [oó] para el final de un verbo -AR (baj[oó]/aument[oó]) matcheaba TANTO la
// forma pasada acentuada ("bajó") COMO la forma presente 1a persona SIN acento ("bajo", como en "si subo el
// precio y BAJO el volumen") — dos palabras reales y distintas que coinciden en todo menos el acento. Estas
// terminaciones -AR (bajar/aumentar/disminuir/incrementar) exigen el ACENTO explícito para contar como pasado;
// "subir"/"caer" no tienen esa colisión (su presente 1a persona es "subo"/"caigo", no "subio"/"cayo").
const _PAST_3RD_RE = /\b(?:subi[oó]|subieron|baj(?:ó|aron)|aument(?:ó|aron)|disminuy(?:ó|eron)|redujo|redujeron|increment(?:ó|aron)|creci[oó]|crecieron|cay[oó]|cayeron)(?![a-záéíóúñ])/i;
// 1a persona en "-í" (subí/bajé) es AMBIGUA con el imperativo vos ("¡Subí el precio!", común en Chile/Argentina)
// — solo cuenta como pasado si hay un marcador temporal explícito cerca (si no, el default más seguro es tratarlo
// como orden/futuro: negarse a simular cuando SÍ lo pedían es peor que el caso inverso, poco frecuente).
const _AMBIGUOUS_1ST_PRETERITE_RE = /\b(?:sub[ií]|baj[eé]|aument[eé])(?![a-záéíóúñ])/i;
const _PAST_TIME_MARKER_RE = /\bayer\b|\bla\s+semana\s+pasada\b|\bel\s+mes\s+pasado\b|\bya\s+(?:le\s+)?(?:subi|baje|aumente)/i;
export function isHistoricalMention(text) {
  const t = String(text || "");
  if (_PAST_3RD_RE.test(t)) return true;
  if (_AMBIGUOUS_1ST_PRETERITE_RE.test(t) && _PAST_TIME_MARKER_RE.test(t)) return true;
  return false;
}

// ── VARIABLE (campo + %) — vocabulario direccional COMPARTIDO con la resolución de mem.pendingSimulation en
// answerViaOracle.js (misma fuente de verdad: "baja"/"sube" tienen que significar lo mismo en un turno fresco que
// en la respuesta a una pregunta pendiente). Los stems (\w* tras la raíz) cubren cualquier persona/modo —
// imperativo, presente, infinitivo, condicional, subjuntivo — sin necesitar el catálogo completo de conjugaciones.
export const ZERO_EXPLICIT_RE = /\b0\s*%|\bsin\s+cambios?\b|\bno\s+cambia\b|\bqueda\s+igual\b|\bse\s+mantiene\b|\bmant[eé]n\w*\b/i;
const _PCT_NUM_RE = /(-?\d+(?:[.,]\d+)?)\s*%/;
const _DOWN_WORDS_RE = /\bbaj\w*|\bca[ey]\w*|\bdisminu\w*|\breduc\w*|\breduzc\w*|\bmenos\b|\bmenor\b|\bpierd\w*|\bperd\w*|\bced\w*/i;
const _UP_WORDS_RE = /\bsub\w*|\baument\w*|\bcrec\w*|\bincrement\w*|\bmayor\b|\bgan\w*/i;
const _PRECIO_WORD_RE = /\bprecio\b/i;
const _VOLUMEN_WORD_RE = /\bvolumen\b|\bunidades\b/i;
export const SIM_DELTA_MAX = 50;   // mismo rango operable que simulateGeneral (_SIM_DELTA_MAX, toolRegistry.js)

// extractSignedPct(text) → {delta_pct} | null — un número con "%" con signo/dirección YA resuelta. Sin signo
// explícito ("-2%") y sin verbo direccional (baja/sube/cae/aumenta…) es genuinamente ambiguo → null, nunca se
// adivina la dirección.
export function extractSignedPct(text) {
  const t = String(text || "");
  const m = t.match(_PCT_NUM_RE);
  if (!m) return null;
  let n = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(n)) return null;
  if (!/^-/.test(m[1].trim())) {
    if (_DOWN_WORDS_RE.test(t)) n = -Math.abs(n);
    else if (_UP_WORDS_RE.test(t)) n = Math.abs(n);
    else return null;
  }
  if (Math.abs(n) > SIM_DELTA_MAX) return null;
  return { delta_pct: n };
}

// extractScenarioVariable(text) → {campo,delta_pct} | null — SOLO si el texto nombra EXACTAMENTE UN campo (precio
// XOR volumen). Si nombra AMBOS (probable "subo precio Y bajo volumen" en la misma frase — el caso YA cubierto
// por PLAN normal) o NINGUNO, devuelve null a propósito: ese caso no es de este módulo, sigue de largo a PLAN.
export function extractScenarioVariable(text) {
  const t = String(text || "");
  const hasPrecio = _PRECIO_WORD_RE.test(t), hasVolumen = _VOLUMEN_WORD_RE.test(t);
  if (hasPrecio === hasVolumen) return null;   // ninguno o ambos → ambiguo para este módulo, PLAN decide
  const campo = hasPrecio ? "precioLista" : "unidades";
  if (ZERO_EXPLICIT_RE.test(t)) return { campo, delta_pct: 0 };
  const pct = extractSignedPct(t);
  return pct ? { campo, ...pct } : null;
}

// detectScenarioIntent(text) → clasifica el turno para el bypass determinístico de answerViaOracle.js:
//   { kind: "historical" } → tiempo pasado inequívoco, NUNCA simular (es una lectura del dato, no un supuesto)
//   { kind: "none" }       → sin campo resoluble sin ambigüedad (ninguno, ambos, o % sin dirección clara) — PLAN
//                            corre normal, este módulo no interviene (incluye el caso YA cubierto "precio Y volumen
//                            en la misma frase", que PLAN ya maneja bien)
//   { kind: "no_entity", variable } → campo+% inequívoco, pero NINGÚN cliente conocido nombrado — "una entidad
//                            explícita nunca puede degradarse a cartera completa" implica lo inverso también:
//                            SIN entidad, nunca se asume cartera completa en silencio — hay que preguntar cuál.
//   { kind: "future", entity, variable } → campo+% inequívoco Y una entidad conocida — la falla #2 (alcance
//                            perdido) es estructuralmente imposible acá: la entidad la puso este detector, no el LLM.
export function detectScenarioIntent(text) {
  const t = String(text || "");
  if (isHistoricalMention(t)) return { kind: "historical" };
  const variable = extractScenarioVariable(t);
  if (!variable) return { kind: "none" };
  const entity = extractKnownClient(t);
  return entity ? { kind: "future", entity, variable } : { kind: "no_entity", variable };
}
