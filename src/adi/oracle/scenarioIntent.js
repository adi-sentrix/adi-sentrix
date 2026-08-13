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
 * RECONOCE CUALQUIER MODO GRAMATICAL (imperativo/interrogativo/condicional/infinitivo) — DOS exclusiones reales:
 *   · TIEMPO PASADO ("el precio subió 8%", "las ventas bajaron 3%"): una LECTURA del dato ya ocurrido, nunca un
 *     supuesto a simular — se excluye ANTES de mirar campo/entidad, sin excepción.
 *   · PREGUNTA CAUSAL ("¿por qué caen las ventas 8%?"): un "por qué" pide la EXPLICACIÓN de algo observado, no la
 *     proyección de un supuesto — se aparta a PLAN, que es quien sabe leer causas (owner 2026-08-14, al enseñar
 *     «ventas»: el vocabulario nuevo aparece seguido en preguntas causales en presente, que el filtro de pasado
 *     no alcanza; el mismo criterio protege también a "precio"/"volumen", que tenían la misma grieta menos expuesta).
 *
 * «VENTAS» CUENTA COMO VOLUMEN (owner 2026-08-14, defecto verificado en vivo: la guía de inicio ofrece «Si subo
 * ventas 4%, ¿qué cambia?», el detector devolvía "none" y el turno quedaba a merced de PLAN, que no corrió la
 * simulación). "Subir ventas un N%" se interpreta como volumen (campo `unidades`) a precios constantes — la MISMA
 * lectura que _VOCAB_FALTANTE.unidades (answerViaOracle.js) ya hace desde 2026-08-11 cuando el usuario CONTESTA
 * la variable faltante con «las ventas caen 3%»: este cambio alinea el turno FRESCO con esa interpretación ya
 * establecida. La regla XOR sigue intacta (precio Y ventas en la misma frase → null, PLAN decide), con UNA
 * precisión: «ventas» como RESULTADO PREGUNTADO ("¿qué pasa con las ventas si subo el precio 5%?") no nombra la
 * variable volumen — nombra lo que se quiere ver — y no puede costarle a "precio" el piso que ya tenía.
 */
import { clientesMargen as _CLIENTES, marcasMargen as _MARCAS, sfamiliasMargen as _FAMILIAS, skuInventario as _SKUS } from "../../data/demoData.js";
import { onTenantChange } from "../../data/tenantStore.js";
// DEICTIC_PLURAL_RE (Etapa 3, owner 2026-08-03, continuidad conversacional universal): UNA sola fuente de verdad
// del patrón deíctico plural, compartida con conversationScope.js (mismo principio que ZERO_EXPLICIT_RE más abajo)
// — la usa el arm "future_multi" de detectScenarioIntent, ver su comentario de cabecera.
import { DEICTIC_PLURAL_RE } from "./conversationScope.js";

const _norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// ── CANON MULTI-EJE (Etapa 3, owner 2026-08-03: "continuidad conversacional universal" — generalización de la
// versión anterior de este módulo, que solo reconocía dimension="cliente" porque simulateGeneral v1 solo la
// soportaba). Etapa 2 (toolContracts.js) ya generalizó simulateGeneral a
// dimensionesSoportadas=[cliente,sku,marca,familia] — este canon cubre los MISMOS 4 ejes, mismo patrón que
// coerceChain.js._buildCanon (una verdad contra el dataset, re-armado por tenant, nunca una lista propia
// hardcodeada). bodega queda FUERA a propósito (mismo límite que el resto del motor: guessDimension no la cubre,
// ver entityRecord.js — simulateGeneral tampoco la declara soportada).
function _buildEntityCanon() {
  const m = new Map();
  for (const r of _CLIENTES) if (r && r.nombre) m.set(_norm(r.nombre), { nombre: r.nombre, dimension: "cliente" });
  for (const r of _MARCAS) if (r && r.nombre) m.set(_norm(r.nombre), { nombre: r.nombre, dimension: "marca" });
  for (const r of _FAMILIAS) if (r && r.nombre) m.set(_norm(r.nombre), { nombre: r.nombre, dimension: "familia" });
  for (const r of _SKUS) if (r && r.sku) m.set(_norm(r.sku), { nombre: r.sku, dimension: "sku" });
  return m;
}
let _ENTITY_CANON = _buildEntityCanon();
onTenantChange(() => { _ENTITY_CANON = _buildEntityCanon(); });

// extractKnownEntity(text) → {name,dimension} CANÓNICO si el texto nombra EXACTAMENTE UNA entidad conocida (de
// cualquiera de los 4 ejes) — null si nombra cero o 2+ (ambigüedad real: nunca adivina cuál). Scan por límite de
// palabra sobre texto normalizado (sin tilde, minúscula) — mismo patrón que coerceChain.js._soloCanonEn. Sustituye
// a la versión anterior (extractKnownClient, solo cliente) — ver comentario del canon arriba.
export function extractKnownEntity(text) {
  const nq = _norm(text);
  const found = new Map();   // nombre canónico → {nombre,dimension} (Map, no Set: dedupe por nombre real)
  for (const [k, ent] of _ENTITY_CANON) {
    if (k.length < 3) continue;
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(nq)) found.set(ent.nombre, ent);
  }
  return found.size === 1 ? [...found.values()][0] : null;
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
// vendi[oó]/vendieron (owner 2026-08-14, al enseñar «ventas»): "se vendió 8% menos" es una lectura del pasado —
// hueco preexistente ("se vendieron 8% menos unidades" ya disparaba por "unidades"), cerrado al ampliar el campo.
const _PAST_3RD_RE = /\b(?:subi[oó]|subieron|baj(?:ó|aron)|aument(?:ó|aron)|disminuy(?:ó|eron)|redujo|redujeron|increment(?:ó|aron)|creci[oó]|crecieron|cay[oó]|cayeron|vendi(?:[oó]|eron))(?![a-záéíóúñ])/i;
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
// ── «VENTAS» COMO VOLUMEN (owner 2026-08-14 — ver el bloque de cabecera) ──────────────────────────────────────
// _VENTAS_WORD_RE: "venta(s)" + los stems de VENDER en forma hipotética/presente ("vendo 4% menos", "si vendiera
// 10% más"). EXCLUIDOS a propósito: "vendedor" (un sujeto, no la variable) y las formas de PASADO de vender
// (vendí/vendió/vendimos/vendiste/vendieron — una lectura de lo ocurrido, no un supuesto; la 3a persona además ya
// cae en _PAST_3RD_RE). Lookaheads con [a-záéíóúñ] y nunca \b tras vocal acentuada — mismo motivo que el OJO 1 de
// _PAST_3RD_RE: el \b de JS no ve límites junto a "í"/"ó".
const _VENTAS_WORD_RE = /\bventas?\b|\bvend(?!edor)(?!i(?:[oó]|eron|mos|ste)(?![a-záéíóúñ]))(?![ií](?![a-záéíóúñ]))[a-záéíóúñ]*/i;
// _VENTAS_OUTCOME_RE: «ventas» como RESULTADO PREGUNTADO ("¿qué pasa con las ventas si…?", "¿cómo quedan las
// ventas si…?", "¿cuánto cambian las ventas si…?") — nombra lo que se quiere VER, no la variable que se mueve.
// Se PODA del texto antes de buscar el campo, para que una simulación de precio que pregunta por sus ventas no
// pierda el piso que ya tenía (la regla XOR la haría null). SOLO cabezas interrogativas DIRECCIONALMENTE NEUTRAS
// (pasa/queda/cambia): "¿cuánto caen las ventas si subo el precio?" NO se poda a propósito — su verbo direccional
// ("caen") contaminaría la resolución de signo del % del precio, así que ese caso queda ambiguo → null → PLAN.
const _VENTAS_OUTCOME_RE = /(?:qu[eé]\s+pasa[a-záéíóúñ]*\s+con|c[oó]mo\s+queda[a-záéíóúñ]*|cu[aá]nto\s+cambia[a-záéíóúñ]*)\s+(?:las?\s+|mis?\s+|nuestras?\s+|tus?\s+)?ventas?(?![a-záéíóúñ])/gi;
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
    // «N% más» POSTFIJO Y CERRANDO LA CLÁUSULA ("vendo 4% más", "vendo 4% más, ¿qué cambia?") → dirección arriba
    // inequívoca (owner 2026-08-14, al enseñar los stems de vender). DELIBERADAMENTE ESTRECHO: solo si tras "más"
    // viene puntuación o el final — "4% más alto que el benchmark" o "4% más que el año pasado" son COMPARACIONES
    // (una lectura contra una referencia, no un supuesto) y siguen siendo ambiguas para este módulo → null.
    // "menos" no necesita espejo: ya es palabra direccional global (_DOWN_WORDS_RE).
    else if (/%\s*m[aá]s\s*(?=$|[,.;:!?¿¡)])/.test(t)) n = Math.abs(n);
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
  const hasPrecio = _PRECIO_WORD_RE.test(t);
  // «ventas» como resultado preguntado se PODA antes de buscar el campo (ver _VENTAS_OUTCOME_RE). El replace con
  // /g no arrastra lastIndex (a diferencia de .test con /g) — por eso acá se poda, nunca se testea esa regex.
  const tCampos = t.replace(_VENTAS_OUTCOME_RE, " ");
  const hasVolumenPropio = _VOLUMEN_WORD_RE.test(t);
  const hasVolumen = hasVolumenPropio || _VENTAS_WORD_RE.test(tCampos);
  if (hasPrecio === hasVolumen) return null;   // ninguno o ambos (incl. "subo precio y ventas 4%") → ambiguo para este módulo, PLAN decide
  const campo = hasPrecio ? "precioLista" : "unidades";
  // via:"ventas" — el volumen entró SOLO por el vocabulario de ventas/vender: el que consuma esta variable debe
  // DECLARAR la interpretación (volumen a precios constantes) en su respuesta — ver los arms de answerViaOracle.
  const via = campo === "unidades" && !hasVolumenPropio ? { via: "ventas" } : null;
  if (ZERO_EXPLICIT_RE.test(t)) return { campo, delta_pct: 0, ...(via || {}) };
  const pct = extractSignedPct(t);
  return pct ? { campo, ...pct, ...(via || {}) } : null;
}

// detectScenarioIntent(text, scopeCurrent) → clasifica el turno para el bypass determinístico de
// answerViaOracle.js. `scopeCurrent` (Etapa 3, owner 2026-08-03, continuidad conversacional universal) es OPCIONAL
// y es EXACTAMENTE mem.conversationScope.current (ver conversationScope.js, Etapa 1) — el mismo estado
// ESTRUCTURADO (nunca prosa) que ya resuelve "estos SKU"/"esos clientes" en el resto del motor. Sin él (o con él
// pero sin match), este detector se comporta BYTE-IGUAL a antes de Etapa 3:
//   { kind: "historical" } → tiempo pasado inequívoco, NUNCA simular (es una lectura del dato, no un supuesto)
//   { kind: "none" }       → sin campo resoluble sin ambigüedad (ninguno, ambos, o % sin dirección clara) — PLAN
//                            corre normal, este módulo no interviene (incluye el caso YA cubierto "precio Y volumen
//                            en la misma frase", que PLAN ya maneja bien)
//   { kind: "no_entity", variable } → campo+% inequívoco, pero NINGUNA entidad conocida nombrada EN ESTE TEXTO y
//                            tampoco un scope estructurado referenciable (ver "future_multi" abajo) — "una entidad
//                            explícita nunca puede degradarse a cartera completa" implica lo inverso también:
//                            SIN entidad, nunca se asume cartera completa en silencio — hay que preguntar cuál.
//   { kind: "future", entity, dimension, variable } → campo+% inequívoco Y una entidad conocida NOMBRADA en este
//                            texto (cualquiera de los 4 ejes, ver extractKnownEntity) — la falla #2 (alcance
//                            perdido) es estructuralmente imposible acá: la entidad la puso este detector, no el LLM.
//   { kind: "future_multi", entities, dimension, variable } → campo+% inequívoco, NINGUNA entidad nombrada EN ESTE
//                            TEXTO, pero el texto trae un deíctico plural ("estos SKU"/"esos clientes"/"ellos") Y
//                            hay un `scopeCurrent` ESTRUCTURADO vigente (no "cartera", con 1+ entidades) — el CASO
//                            OBLIGATORIO del owner ("¿Qué pasa si subo 3% el precio de estos SKU?" tras un turno que
//                            ya estableció 3 SKU puntuales): la(s) entidad(es) las pone el scope estructurado,
//                            NUNCA el LLM ni una re-lectura de prosa — ver conversationScope.js para la garantía de
//                            fidelidad (solo boleta, nunca narración).
// PREGUNTA CAUSAL — "¿por qué caen las ventas 8%?" pide la EXPLICACIÓN de algo observado (presente o pasado), no
// una proyección. El filtro de pasado no la alcanza cuando el verbo viene en presente; sin esto, enseñar «ventas»
// convertía una pregunta causal común en un arranque de simulación. Devuelve "none" (no "historical"): el módulo
// se aparta y PLAN corre normal — mismo principio conservador que el resto ("ante la ambigüedad, nunca intervenir").
const _CAUSAL_QUESTION_RE = /\bpor\s+qu[eé](?![a-záéíóúñ])/i;
export function detectScenarioIntent(text, scopeCurrent) {
  const t = String(text || "");
  if (isHistoricalMention(t)) return { kind: "historical" };
  if (_CAUSAL_QUESTION_RE.test(t)) return { kind: "none" };
  const variable = extractScenarioVariable(t);
  if (!variable) return { kind: "none" };
  const known = extractKnownEntity(t);
  if (known) return { kind: "future", entity: known.nombre, dimension: known.dimension, variable };
  if (scopeCurrent && Array.isArray(scopeCurrent.entities) && scopeCurrent.entities.length
    && scopeCurrent.dimension && scopeCurrent.dimension !== "cartera" && DEICTIC_PLURAL_RE.test(t)) {
    return { kind: "future_multi", entities: scopeCurrent.entities, dimension: scopeCurrent.dimension, variable };
  }
  return { kind: "no_entity", variable };
}
