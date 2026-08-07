/* === src/adi/oracle/guardC.js · ARQUITECTURA C · Fase 2 · EL MURO ENDURECIDO ===
 * El guard de la narración de C, sobre el LEDGER con procedencia. Cierra los 3 huecos que las auditorías marcaron
 * como precondición de ir en vivo, MÁS la política mandatory-lite que reveló el demo:
 *   1. ATRIBUCIÓN (por-call-scope) — una cifra real no se le cuelga a la entidad equivocada.
 *   2. CONTEOS SIN SIGNO (unitless) — "9 focos"/"top 7" inventados también se bloquean.
 *   3. GRADUACIÓN — un supuesto (simulación) no se narra como hecho probado.
 *   +  ENTIDAD ledger-derivada por-tenant (garble tipo "Falcon"→Falabella) · anti-coupling con demoData.
 *   +  MANDATORY-LITE — la brevedad ejecutiva de C omite subtotales; el guard NO exige citar todo (eso es del juez).
 * PURO · aditivo · NO toca boleta.js/numberGuard.js/entityGuard.js (guard vivo · Falcon). Reusa parseFigures.
 */
import { parseFigures } from "../boleta.js";
import { buildClaims } from "./narrationContract.js";   // Proporcionalidad Semántica: el guard lee el MISMO sello que el narrador

const _norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const _stripSpace = (s) => String(s).replace(/\s/g, "");

// ventana de proximidad ACOTADA A LA MISMA ORACIÓN (owner-audit 2026-07-28: un verbo/entidad de la oración SIGUIENTE
// caía dentro de una ventana de ±N caracteres puramente lineal y se leía como si calificara la cifra de la oración
// ANTERIOR — "...Antofagasta (25%). El SKU... que representa $14K..." marcaba el 25% como mal atribuido a un SKU que
// en realidad pertenece a la frase siguiente). Corta en el límite de oración (.!?\n) más cercano en cada dirección,
// ADEMÁS del tope lineal `win` — lo que sea más angosto. No usa el _BOUNDARY de _entityGarble (ese incluye ":;·—-",
// demasiado agresivo para prosa con guiones/dos-puntos DENTRO de una misma oración).
const _SENT_END = /[.!?\n]/;
function _localWindow(text, idx, win) {
  const lo0 = Math.max(0, idx - win);
  const back = text.slice(lo0, idx);
  const lastEnd = Math.max(back.lastIndexOf("."), back.lastIndexOf("!"), back.lastIndexOf("?"), back.lastIndexOf("\n"));
  const lo = lastEnd >= 0 ? lo0 + lastEnd + 1 : lo0;
  const hi0 = Math.min(text.length, idx + win);
  const fwd = text.slice(idx, hi0);
  const cut = fwd.search(_SENT_END);
  const hi = cut >= 0 ? idx + cut : hi0;
  return [lo, hi];
}

// ── CONTEOS SIN SIGNO ────────────────────────────────────────────────────────────────────────────────────────────
// parseFigures NO ve enteros pelados. Acá cazamos los conteos NARRABLES: "N <sustantivo-contable>" y "top N".
// OJO: "puntos" (pp de brecha, "8.1 puntos por debajo") es una UNIDAD, no un conteo → NO va acá (causaba falsos
// positivos de conteo-no-autorizado en toda lectura de margen). Solo sustantivos REALMENTE contables (entidades).
const _COUNT_NOUN = /\b(\d{1,3})\s+(focos?|sku|skus|productos?|clientes?|cuentas?|marcas?|bodegas?|familias?|referencias?|[ií]tems?)\b/gi;
const _TOP_N = /\btop\s+(\d{1,3})\b/gi;
export function parseCounts(text) {
  const s = String(text == null ? "" : text), out = [];
  let m;
  while ((m = _COUNT_NOUN.exec(s))) out.push({ unit: "count", raw: parseInt(m[1], 10), text: m[0], canon: `count:${parseInt(m[1], 10)}` });
  while ((m = _TOP_N.exec(s))) out.push({ unit: "count", raw: parseInt(m[1], 10), text: m[0], canon: `count:${parseInt(m[1], 10)}` });
  return out;
}
// conteos AUTORIZADOS: los declarados como fig(unit:"count") en el ledger + los derivables del dato (largos de arrays
// de facts, subtotales de focos). Así un conteo CORRECTO pasa y uno inventado (que no corresponde a nada) se bloquea.
function _authorizedCounts(ledger, results) {
  const set = new Set();
  for (const f of (ledger.figs || [])) if (f.unit === "count" && Number.isFinite(f.raw)) set.add(f.raw);
  const walk = (v) => {
    if (Array.isArray(v)) { set.add(v.length); v.forEach(walk); }
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  for (const r of (results || [])) walk(r.facts);
  return set;
}

// ── ensureCountAuthorized(text, ledger, results) — BACKSTOP DETERMINÍSTICO para 'conteo-no-autorizado' (owner
// 2026-08-03, auditoría de eficiencia de Mini: causa de rechazo MÁS FRECUENTE medida, ~50% de las violaciones de
// bloqueo en la muestra) — MISMO patrón que ensurePeriodoDeclared (guardC.js) / ensureHypothesisFraming
// (narratePromptC.js): corrige el texto ANTES de que llegue al chequeo, en vez de solo dejar que bloquee.
//
// El caso MÁS FRECUENTE de conteo-no-autorizado no es una cifra inventada de la nada: es un DESAJUSTE entre el
// número que el narrador dice ("Los 9 principales...") y la cantidad de ítems que en realidad ENUMERA a
// continuación (a veces lista 5, a veces 7) — un error de conteo sobre SU PROPIO texto (el narrador cuenta mal
// cuántos nombró), no una fabricación de dato. La convención de listado de ESTE motor (ver TODO specRetrieval.js)
// es "· " entre ítems ("Falabella ($X) · Lider ($Y) · Sodimac ($Z)") — un patrón textual estable y chequeable sin
// ningún LLM.
//
// Corrección PURAMENTE TEXTUAL y conservadora, en 2 pasos:
//   1. Para cada conteo NO autorizado (parseCounts + _authorizedCounts), busca una lista "· "-separada dentro de la
//      MISMA oración (mismo límite de oración que _localWindow — nunca cruza a la oración siguiente) y cuenta los
//      ítems REALMENTE enumerados.
//   2. Reemplaza el número inventado por la cuenta real SOLO SI esa cuenta real coincide con la cantidad de ítems
//      Y esa cuenta YA es un conteo AUTORIZADO (ledger/facts) — nunca inventa un número nuevo, nunca "adivina": si
//      lo enumerado tampoco cierra contra el dato autorizado, no toca nada y el guard sigue bloqueando como red
//      final (el bloqueo actual NO se relaja, esto solo evita el rechazo en el caso verificablemente autocorregible).
const _ENUM_SEP = /\s*·\s*/;
export function ensureCountAuthorized(text, ledger, results) {
  const s = String(text == null ? "" : text);
  if (!s) return s;
  const authorized = _authorizedCounts(ledger || { figs: [] }, results || []);
  if (!authorized.size) return s;   // sin ningún conteo autorizado este turno → nada verificable contra qué corregir
  const counts = parseCounts(s);
  if (!counts.length) return s;
  let out = s;
  for (const c of counts) {
    if (authorized.has(c.raw)) continue;   // ya autorizado tal cual — no toca
    const idx = out.indexOf(c.text);
    if (idx < 0) continue;   // el texto ya cambió por un reemplazo previo y este match quedó desalineado — no forzar
    const afterIdx = idx + c.text.length;
    const rest = out.slice(afterIdx);
    const cut = rest.search(_SENT_END);
    const window = cut >= 0 ? rest.slice(0, cut) : rest;   // SOLO la misma oración, nunca la siguiente
    const colonIdx = window.indexOf(":");
    if (colonIdx < 0) continue;   // sin "N <algo>: lista" en esta oración → no hay nada que recontar
    const items = window.slice(colonIdx + 1).split(_ENUM_SEP).map((x) => x.trim()).filter(Boolean);
    if (items.length < 2) continue;   // sin una lista real (2+ ítems) → nada que recontar
    if (items.length === c.raw) continue;   // el conteo YA coincide con lo enumerado — el problema es otro, no lo toca
    if (!authorized.has(items.length)) continue;   // la cuenta real TAMPOCO está autorizada — no inventa, no toca
    out = out.slice(0, idx) + c.text.replace(String(c.raw), String(items.length)) + out.slice(afterIdx);
  }
  return out;
}

// ── ENTIDADES del turno (tenant-safe: salen del DATO devuelto, no de demoData global) ────────────────────────────
function _entityNames(results) {
  const names = new Set();
  const add = (n) => { if (typeof n === "string" && n.trim().length >= 3) names.add(n.trim()); };
  const walk = (v, keyHint) => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, keyHint));
    else if (v && typeof v === "object") { for (const k of Object.keys(v)) walk(v[k], k); }
    else if (typeof v === "string" && /^(name|entidad|entity|nombre|entityB)$/i.test(keyHint)) add(v);
  };
  for (const r of (results || [])) walk(r.facts, "");
  return [...names];
}

// ── ATRIBUCIÓN (por-call-scope) ─────────────────────────────────────────────────────────────────────────────────
// value → set de entidades que lo AUTORIZAN (entidad = primer segmento del label, si es una entidad real del turno).
// CLAVE = canon (unit:valor normalizado), NO el string crudo: el mismo valor puede llegar narrado en prosa distinta
// a como lo guardó el ledger (ej. unit "days" → ledger "94d" vs narración "94 días") — canon ya normaliza ambos al
// mismo formateador (_fmtC), es la MISMA técnica que usa el chequeo 1 (cifra-no-autorizada) para no fallar por forma.
function _valueOwners(ledger, entityNames) {
  const entNorm = new Map(entityNames.map((n) => [_norm(n), n]));
  const owners = new Map();   // canon → Set(entidadDisplay)
  for (const f of (ledger.figs || [])) {
    // la entidad puede estar en CUALQUIER segmento del label (retrieval/dive: "Falabella · Margen" ·
    // diagnose: "Contribución no capturada · Falabella") → escaneamos todos los segmentos.
    for (const seg of String(f.label || "").split("·")) {
      const disp = entNorm.get(_norm(seg.trim()));
      if (!disp) continue;
      const key = f.canon;
      if (!owners.has(key)) owners.set(key, new Set());
      owners.get(key).add(disp);
    }
  }
  return owners;
}
// una cifra escrita PEGADA a una entidad E, cuyo value pertenece SOLO a otras entidades (no a E) → atribución falsa.
function _attributionViolations(narration, ledger, entityNames) {
  const owners = _valueOwners(ledger, entityNames);
  if (!owners.size || !entityNames.length) return [];
  const text = String(narration || "");
  const viol = [];
  const figs = parseFigures(text);
  // posición de cada mención de entidad
  const ents = entityNames.map((n) => ({ n, re: new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi") }));
  const WIN = 60;
  for (const f of figs) {
    const ownerSet = owners.get(f.canon) || null;
    if (!ownerSet || ownerSet.size === 0) continue;         // value sin dueño-entidad → no aplica atribución
    const idx = text.indexOf(f.text);
    if (idx < 0) continue;
    // entidades DISTINTAS dentro de la ventana de la cifra (acotada a la MISMA oración — ver _localWindow). Si hay
    // MÁS de una → es una enumeración pareada ("Falabella y Lider, con $1.8M y $1.7M") → ambiguo y la cifra está
    // autorizada → NO marcamos (evita el falso positivo del "respectivamente"). Solo marcamos el caso NÍTIDO: una
    // única entidad cerca, y no es la dueña.
    const [lo, hi] = _localWindow(text, idx, WIN);
    const near = new Set();
    for (const e of ents) { e.re.lastIndex = 0; let mm; while ((mm = e.re.exec(text))) if (mm.index >= lo && mm.index <= hi) near.add(e.n); }
    if (near.size === 1) {
      const only = [...near][0];
      if (!ownerSet.has(only)) {
        // ¿el dueño verdadero aparece EN CUALQUIER PARTE de la narración? entonces es contexto/yuxtaposición (párrafo
        // largo, comparación, lista), no una mala atribución → NO marcar. Solo marcamos el caso NÍTIDO: la cifra pegada
        // a UNA entidad equivocada Y el dueño verdadero NO aparece en toda la respuesta (ej. "Ripley aporta $4.3M" de Falabella).
        const ownerAnywhere = [...ownerSet].some((ow) => { const e = ents.find((x) => x.n === ow); if (!e) return false; e.re.lastIndex = 0; return e.re.test(text); });
        if (!ownerAnywhere) viol.push(`«${f.text}» atribuido a ${only}, pero pertenece a ${[...ownerSet].join("/")}`);
      }
    }
  }
  return viol;
}

// ── BINDING SEMÁNTICO · CONTRATO v2 · FASE 2 (owner 2026-08-07) ────────────────────────────────────────────────
// EL HUECO QUE CIERRA: el canon del guard es `unit:value` — NO incluye la etiqueta. Una cifra REAL y autorizada
// narrada bajo OTRA métrica pasaba el chequeo 1 sin que nada la mirara: «$1.6M de contribución no capturada»
// contado como «$1.6M en ventas» matchea el canon money:$1.6M y entra. El valor era verdad; la oración, mentira.
// Es la clase de falla que esta sesión encontró tres veces (superlativo de familia, capital atribuido al cliente,
// exceso de acciones comerciales presentado como la brecha total) — ninguna la detectó el muro numérico.
//
// VOCABULARIO DECLARADO, no adivinanza: solo se juzgan las métricas del negocio que el contrato conoce. Si una
// etiqueta no cae en ninguna, la cifra simplemente no se juzga por métrica (nunca se inventa un conflicto).
// Las formas verbales importan: "vende $19.4M" es la MISMA métrica que "Ventas" — sin eso, la lectura más común
// del producto ("X vende $N, con margen M%") se marcaría sola.
const _METRIC_VOCAB = [
  { clave: "ventas",       re: /\bventas?\b|\bvend[eióa]\w*\b|\bfactur\w+\b/i },
  { clave: "margen",       re: /\bm[aá]rgen(?:es)?\b/i },
  { clave: "contribucion", re: /\bcontribuci[oó]n\b|\bcontribuy\w+\b/i },
  { clave: "costo",        re: /\bcostos?\b/i },
  { clave: "carga",        re: /\bcarga comercial\b|\bacciones comerciales\b|\brebates?\b|\bdescuentos?\b/i },
  { clave: "capital",      re: /\bcapital\b|\binventario\b/i },
  { clave: "rotacion",     re: /\brotaci[oó]n\b/i },
  { clave: "cobertura",    re: /\bcobertura\b|\bDOH\b/i },
  { clave: "unidades",     re: /\bunidades\b/i },
  { clave: "ticket",       re: /\bticket\b/i },
];
function _metricasEn(texto) {
  const s = String(texto || "");
  const out = new Set();
  for (const m of _METRIC_VOCAB) if (m.re.test(s)) out.add(m.clave);
  return out;
}
// _maskFigures(text) → copia de la MISMA longitud con cada cifra reemplazada por "#" (sin puntos ni signos), para
// que el cálculo de límites de oración no confunda un punto decimal con un fin de oración. Solo se usa para medir
// posiciones — el contenido siempre se lee del texto original.
function _maskFigures(text) {
  const s = String(text || "");
  let out = s;
  for (const f of parseFigures(s)) {
    let from = 0, i;
    while ((i = out.indexOf(f.text, from)) >= 0) {
      out = out.slice(0, i) + "#".repeat(f.text.length) + out.slice(i + f.text.length);
      from = i + f.text.length;
    }
  }
  return out;
}
// canon → Set(métrica) que lo autoriza, leído del LABEL de cada fig (la etiqueta es el dueño semántico del valor).
function _metricOwners(ledger) {
  const owners = new Map();
  for (const f of (ledger.figs || [])) {
    const ms = _metricasEn(f.label);
    if (!ms.size) continue;
    if (!owners.has(f.canon)) owners.set(f.canon, new Set());
    for (const m of ms) owners.get(f.canon).add(m);
  }
  return owners;
}
// _metricBindingViolations(narration, ledger) → cifra real colgada de la métrica equivocada.
// CRITERIO NÍTIDO (mismo principio que _attributionViolations, para no castigar prosa legítima): solo marca cuando
// en la ventana local de la cifra hay UNA sola métrica reconocida y NO es de las que autorizan ese valor. Si hay
// dos o más (una lectura que cruza métricas en la misma oración) es ambiguo → no se marca. Falso negativo antes
// que falso positivo: un bloqueo de más degrada respuestas correctas, que es exactamente lo que este muro evita.
function _metricBindingViolations(narration, ledger) {
  const owners = _metricOwners(ledger);
  if (!owners.size) return [];
  const text = String(narration || "");
  const viol = [];
  for (const f of parseFigures(text)) {
    const ownerSet = owners.get(f.canon);
    if (!ownerSet || !ownerSet.size) continue;      // valor sin métrica dueña → no se juzga
    const idx = text.indexOf(f.text);
    if (idx < 0) continue;
    // LÍMITES DE ORACIÓN SOBRE EL TEXTO ENMASCARADO: `_SENT_END` incluye "." y el punto DECIMAL de una cifra
    // ("$4.3M", "$17.8M") cortaba la ventana en falso — hacia adelante dejaba afuera la métrica que sigue, y
    // hacia atrás dejaba afuera el verbo de la cifra anterior ("A vende $19.4M y B $17.8M" perdía "vende" y
    // marcaba $17.8M como "margen"). Dos falsos cazados por el gate de aceptación. Se calculan los límites sobre
    // una copia con las cifras enmascaradas (misma longitud, sin puntos) y se LEE del texto original.
    const masked = _maskFigures(text);
    const [lo] = _localWindow(masked, idx, 60);
    const end = idx + f.text.length;
    const hi0 = Math.min(masked.length, end + 60);
    const cut = masked.slice(end, hi0).search(_SENT_END);
    const hi = cut >= 0 ? end + cut : hi0;
    const cerca = _metricasEn(text.slice(lo, hi));
    if (cerca.size !== 1) continue;                 // 0 → sin señal · 2+ → ambiguo, no se juzga
    const unica = [...cerca][0];
    if (!ownerSet.has(unica)) viol.push(`«${f.text}» narrado como ${unica}, pero pertenece a ${[...ownerSet].join("/")}`);
  }
  return viol;
}

// ── PERÍODO CONTRADICTORIO · CONTRATO v2 · FASE 2 ──────────────────────────────────────────────────────────────
// ensurePeriodoDeclared (más arriba) solo AGREGA la cláusula canónica si falta — nunca valida. Una narración que
// afirma "en el primer trimestre" sobre un dato de año cerrado recibía "(Datos del año cerrado.)" pegado al lado:
// dos períodos contradictorios conviviendo en la misma respuesta, y pasaba. Acá se BLOQUEA la contradicción.
// Acotado a AFIRMACIONES DE ALCANCE TEMPORAL, no a menciones de meses: "el mejor mes es Dic" describe un punto
// DENTRO del período sellado y es legítimo; "en el primer trimestre" re-declara el alcance y no lo es.
const _PERIODO_CONTRADICE_ANUAL = [
  /\b(?:en|durante|para)\s+(?:el\s+)?(?:primer|segundo|tercer|cuarto)\s+(?:trimestre|semestre)\b/i,
  /\b(?:en|durante|para)\s+(?:el\s+)?Q[1-4]\b/i,
  /\ben lo que va del a[nñ]o\b/i,
  /\ba[nñ]o en curso\b/i,
  /\b(?:en|durante)\s+(?:este|el\s+[uú]ltimo)\s+(?:mes|trimestre|semestre)\b/i,
  /\b[uú]ltimos?\s+\d+\s+meses\b/i,
];
function _periodoContradictorio(narration, periodos) {
  if (!Array.isArray(periodos) || !periodos.includes("anual")) return null;   // solo se juzga contra "año cerrado"
  const text = String(narration || "");
  for (const re of _PERIODO_CONTRADICE_ANUAL) {
    const m = re.exec(text);
    if (m) return `la narración afirma «${m[0].trim()}» pero el dato es del año cerrado`;
  }
  return null;
}

// ── TOTAL DEL NEGOCIO ATRIBUIDO A 1-2 ENTIDADES (owner 2026-07-28, segunda vuelta tras el gate de orden: "yo
// pediría un guard determinístico que bloquee frases donde una cifra total aparece atribuida a una entidad
// individual" — "recuperar $5.7M con Lider" cuando $5.7M es el total de 8 clientes, no de Lider solo). Reusa
// _valueOwners: un valor SIN dueño en NINGÚN label (nadie lo reclama como suyo) es, por construcción, una cifra
// GLOBAL/TOTAL — si aparece pegada a 1-2 nombres con un verbo que CLAIMEA equivalencia ("representan", "recuperar
// con", "genera", "resulta en"), mientras el dato tiene MÁS de 2 entidades en juego, es la MISMA cifra colgada de
// menos dueños de los que tiene → bloquea. Si hay ≤2 entidades en total, atribuirles el total ES correcto (no aplica).
// lista de verbos AMPLIADA tras el barrido adversarial (owner-audit 2026-07-28): las formas con "n"? opcional no
// matcheaban el GERUNDIO ("representando" — el \b final nunca calzaba porque "ndo" sigue siendo alfanumérico), y
// faltaban verbos de equivalencia reales que el narrador ya usa ("concentrada en", "responsables de", "se debe a").
const _CLAIM_VERB = /\b(representa(?:n|ndo)?|explica(?:n|ndo)?|genera(?:n|ndo)?|recuperar(?:\s+con)?|recuperando(?:\s+con)?|recuperaci[oó]n|resulta(?:n)?\s+en|suman|totalizan|concentrad[ao]s?\s+en|atribuibles?\s+a|(?:principal(?:es)?\s+)?responsables?\s+de|proviene[n]?\s+de|se\s+debe[n]?\s+a)\b/i;
// excepción EXPLÍCITA del spec (b): si el propio texto ya escala la cifra al grupo/total ("parte de", "porción de",
// "del total de"), no es una mala atribución aunque un verbo de la lista esté cerca — es EXACTAMENTE el framing correcto
// que le pedimos al narrador (narratePromptC.js: "TOTAL DEL NEGOCIO ≠ SUMA DE LOS QUE NOMBRÁS"). Antes esto "pasaba"
// solo por casualidad de vocabulario/distancia — ahora se reconoce por diseño, no por accidente.
const _PART_OF_EXCEPTION = /\b(parte|porci[oó]n|fracci[oó]n)\s+(?:de|del)\b/i;
function _totalMisattribution(narration, ledger, entityNames) {
  if (entityNames.length <= 2) return [];   // solo hay 1-2 entidades en juego → el total ES de ellas, correcto
  const owners = _valueOwners(ledger, entityNames);
  const text = String(narration || "");
  const viol = [];
  const figs = parseFigures(text);
  const ents = entityNames.map((n) => ({ n, re: new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi") }));
  const WIN = 60;
  const seen = new Set();
  for (const f of figs) {
    const ownerSet = owners.get(f.canon);
    if (ownerSet && ownerSet.size) continue;      // TIENE dueño(s) propio(s) → no es un total huérfano, no aplica
    const idx = text.indexOf(f.text);
    if (idx < 0 || seen.has(idx)) continue; seen.add(idx);
    const [lo, hi] = _localWindow(text, idx, WIN);   // acotado a la MISMA oración, no solo a ±WIN caracteres lineales
    const windowText = text.slice(lo, hi);
    if (_PART_OF_EXCEPTION.test(windowText)) continue;   // el texto ya escala explícitamente al total/grupo → correcto
    if (!_CLAIM_VERB.test(windowText)) continue;   // sin verbo de equivalencia cerca → no es una atribución clara
    const near = new Set();
    for (const e of ents) { e.re.lastIndex = 0; let mm; while ((mm = e.re.exec(text))) if (mm.index >= lo && mm.index <= hi) near.add(e.n); }
    if (near.size >= 1 && near.size <= 2) {
      viol.push(`«${f.text}» (cifra total/global, sin dueño único) aparece atribuida a ${[...near].join(" y ")} con un verbo de equivalencia — el dato tiene ${entityNames.length} entidades en juego, no solo esa(s)`);
    }
  }
  return viol;
}

// ══ PROPORCIONALIDAD SEMÁNTICA (owner 2026-08-07) ══════════════════════════════════════════════════════════════
// "ADI nunca puede afirmar más de lo que la evidencia autorizada demuestra."
// CÓMO DISPARAN estos cuatro chequeos, y por qué NO son reglas frase-por-frase: el gatillo es la AUSENCIA DE
// AUTORIZACIÓN ESTRUCTURAL en los claims (no hay claim con procedencia externa · no hay claim con nivel
// `resultado` · el claim está marcado `parcial` · la cifra pertenece a una entidad). El texto solo se mira para
// ubicar SI se hizo esa clase de afirmación — igual que _graduationViolation, que ya vivía acá con esa forma.
// Cambiar el vocabulario de una frase no cambia el veredicto; cambiar la evidencia autorizada, sí.
// Todos reusan el criterio NÍTIDO de Fase 2 (_maskFigures + _localWindow + "una sola señal cerca o no se juzga").

// El sujeto es EL NEGOCIO: formas con las que la narración generaliza al conjunto. Nunca alcanza por sí sola —
// siempre se exige además que la cifra sea DE UNA ENTIDAD y que su dueña NO esté nombrada cerca.
const _SUJETO_NEGOCIO = /\b(el negocio|tu negocio|la empresa|la compañ[íi]a|la cartera|el total del negocio|a nivel (?:global|general|de negocio))\b/i;
const _EXPANSION = /\b(en expansi[oó]n|est[aá] creciendo|viene creciendo|crecimiento del negocio)\b/i;
// Afirmar rentabilidad: exige un RESULTADO (costos + gastos). Venta/margen/contribución positivos NO alcanzan.
const _RENTABLE = /\b(es|son|resulta[n]?|sigue siendo|siguen siendo)\s+(?:una\s+|un\s+|muy\s+|bastante\s+|estructuralmente\s+)*(?:cuenta\s+)?rentables?\b|\bla rentabilidad (?:de la cuenta|del negocio|es)\b|\bes rentable\b/i;
// Atribuir la vara a una fuente sectorial que el dato no tiene.
const _REFERENCIA_EXTERNA = /\b(est[aá]ndar(?:es)? (?:de|del) (?:la )?(?:sector|industria|mercado|categor[íi]a)|promedio (?:del|de) (?:sector|mercado|la industria)|referencia (?:de|del) (?:la )?(?:industria|mercado|sector)|benchmark de (?:la )?industria|lo esperable para su categor[íi]a)\b/i;
// Presentar una causa como la explicación completa.
// `explican?` y no `explica`: el plural es la forma natural cuando el sujeto es el monto ("los $194K EXPLICAN toda
// la diferencia") — cazado por el caso de aceptación del owner, que en singular pasaba y en plural no.
const _CAUSA_TOTAL = /\b(la (?:principal|mayor) causa|la causa principal|se debe (?:a|al)\b|explican? (?:toda|todo|el total|la totalidad)|dan cuenta de (?:toda|todo)|responsables? de (?:toda|todo)|por completo se explica)\b/i;

// 12 · ALCANCE DEL SUJETO — cifra de UNA ENTIDAD narrada como si fuera del negocio.
// El hueco medido: _attributionViolations solo juzga cuando hay UNA entidad cerca; "el negocio" no es una entidad,
// así que entidad→negocio pasaba SIEMPRE, en los seis ejes. Acá se cierra con el mismo criterio nítido invertido:
// la cifra es de una entidad, la ventana declara sujeto-negocio, y la dueña NO aparece en NINGUNA parte del texto.
function _sujetoGeneralizado(narration, claims) {
  const out = [];
  const text = String(narration || "");
  const masked = _maskFigures(text);
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const textoNorm = norm(text);
  for (const c of claims) {
    if (!c || c.sujetoTipo !== "entidad" || !c.entidad || !c.valor) continue;
    if (textoNorm.includes(norm(c.entidad))) continue;   // la dueña está nombrada: no hay generalización
    let idx = -1;
    while ((idx = text.indexOf(c.valor, idx + 1)) >= 0) {
      const [lo, hi] = _localWindow(masked, idx, 90);
      const ventana = text.slice(lo, hi);
      if (!_SUJETO_NEGOCIO.test(ventana) && !_EXPANSION.test(ventana)) continue;
      // si en la misma ventana aparece OTRA entidad, el caso es ambiguo → no se juzga (criterio nítido)
      const otras = claims.filter((x) => x.sujetoTipo === "entidad" && x.entidad && x.entidad !== c.entidad && norm(ventana).includes(norm(x.entidad)));
      if (otras.length) continue;
      out.push(`"${c.valor}" es de ${c.entidad} (${c.eje || "entidad"}) pero se narra como si fuera del negocio, sin nombrarla: "${ventana.trim().slice(0, 110)}"`);
      break;
    }
  }
  return out;
}

// 13 · PROCEDENCIA DE LA REFERENCIA — atribuir la vara al sector/mercado/industria sin fuente externa autorizada.
// Estructural: hoy NINGÚN claim puede traer procedencia "externa_sector" (ver businessPolicy.js: las tres capas de
// benchmarkOf son internas y SECTORAL_BENCHMARKS no se importa en src/). El día que exista, este chequeo se apaga
// solo para ese turno — no hay que tocarlo.
function _procedenciaNoAutorizada(narration, claims) {
  const m = _REFERENCIA_EXTERNA.exec(String(narration || ""));
  if (!m) return null;
  if (claims.some((c) => c && c.procedencia === "externa_sector")) return null;   // hay fuente externa: autorizado
  return `"${m[0]}" atribuye la referencia a una fuente sectorial, y ninguna cifra autorizada la declara — la vara la define el negocio del usuario ("tu benchmark", "tu referencia")`;
}

// 14 · NIVEL FINANCIERO — afirmar rentabilidad sin un resultado que incluya costos y gastos.
// Medido antes de este chequeo: "Falabella vende $19.4M con un margen de 22%, así que es una cuenta rentable"
// pasaba con ok=true, verdict "fiel". Venta/margen/contribución positivos NO sostienen esa conclusión.
function _nivelNoAutorizado(narration, claims) {
  const m = _RENTABLE.exec(String(narration || ""));
  if (!m) return null;
  if (claims.some((c) => c && c.nivelFinanciero === "resultado")) return null;   // hay resultado autorizado
  return `"${m[0]}" afirma rentabilidad y ninguna cifra autorizada trae un RESULTADO (con costos y gastos) que lo sostenga — venta, margen o contribución positivos no alcanzan`;
}

// 15 · ALCANCE CAUSAL — una causa marcada `parcial` presentada como la explicación total.
function _causaSobredimensionada(narration, claims) {
  const out = [];
  const text = String(narration || "");
  const masked = _maskFigures(text);
  for (const c of claims) {
    if (!c || c.coberturaCausal !== "parcial" || !c.valor) continue;
    let idx = -1;
    while ((idx = text.indexOf(c.valor, idx + 1)) >= 0) {
      const [lo, hi] = _localWindow(masked, idx, 110);
      const ventana = text.slice(lo, hi);
      if (!_CAUSA_TOTAL.test(ventana)) continue;
      out.push(`"${c.valor}" (${c.etiqueta}) explica una PARTE comprobada, pero se narra como la explicación completa: "${ventana.trim().slice(0, 110)}"`);
      break;
    }
  }
  return out;
}

// ── GRADUACIÓN (supuesto ≠ probado) ─────────────────────────────────────────────────────────────────────────────
const _SIM_TOOLS = new Set(["simulate", "simulateCarga", "simulateCapital", "simulateCosto"]);
const _ASSUMPTION = /\b(si\b|supon|asum|estimad|proyectad|hipot|en el supuesto|de bajar|de subir|podr[íi]a|llevar[íi]a|implicar[íi]a|escenario donde)/i;
function _graduationViolation(narration, trace) {
  const usedSim = trace && Array.isArray(trace.calls) && trace.calls.some((c) => _SIM_TOOLS.has(c.tool));
  if (!usedSim) return null;
  return _ASSUMPTION.test(String(narration || "")) ? null : "simulación narrada como hecho probado (falta marca de supuesto: 'si…', 'estimado', 'proyectado')";
}

// ── MECANISMO DOMINANTE vs ACCIÓN (turno 9 del veredicto de 18 turnos, owner 2026-07-29: "diagnostica costo,
// recomienda precio, sin conectarlos") — AVISO, NO bloquea: es coherencia SEMÁNTICA (diagnóstico↔acción), no una
// cifra — un chequeo léxico no puede validar la conexión causal con certeza, solo su AUSENCIA superficial (mismo
// riesgo que atribución/graduación, por eso vive acá como aviso, no como bloqueo — evita subir la tasa de
// abstención de C por falsos positivos de una coherencia difícil de calibrar sin más tráfico real).
// marginRead ahora computa `mecanismo` ("carga comercial/rebate" | "costo estructural") por entidad bajo benchmark
// (specRetrieval.js _marginPanel, MISMO criterio que el detector de carga alta — una verdad). Si la narración
// nombra esa entidad Y su oración de ACCIÓN nombra el mecanismo CONTRARIO sin un conector causal explícito
// ("así", "por eso", "no es negociable"…), lo señala — nunca bloquea el turno.
// FRAME de recomendación, no verbos sueltos (bug real cazado en el gate: "margen bajo" — el ADJETIVO — matcheaba
// el stem "baj\w*" pensado para el VERBO "bajá/bajar", tomando la oración de DIAGNÓSTICO como si fuera la de
// ACCIÓN). Exige una frase que ENMARQUE la recomendación, no cualquier oración que contenga una palabra parecida.
const _MECH_ACTION_VERB = /\b(deber[íi]as|te recomiendo|te sugiero|conviene|lo primero es|primer paso|la acci[oó]n (?:es|prioritaria)|prioriz\w*|renegoci\w*|ajust[aá]\w*|revis[aá]\w*|corrig[eé]\w*)\b/i;
const _MECH_COSTO_WORD = /\b(costo|costos|precio|precios)\b/i;
const _MECH_CARGA_WORD = /\b(carga comercial|rebate|rebates|descuento|descuentos|condiciones comerciales)\b/i;
const _MECH_CONNECTOR = /\b(as[ií]|por eso|dado que|debido a|ya que|aunque|sin embargo|no es negociable|no se puede|no está disponible)\b/i;

// walk compartido: cualquier resultado con forma {nombre, mecanismo} en cualquier profundidad (marginRead panel rows,
// hoy; el mismo shape que use cualquier tool futuro entra gratis). Exportado porque answerViaOracle.js necesita la
// MISMA extracción para decidir qué escribe en mem.mechanismByEntity (una sola verdad, sin fórmula duplicada).
export function extractMechanismRows(results) {
  const mechRows = [];
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      if (typeof v.mecanismo === "string" && typeof v.nombre === "string") mechRows.push({ nombre: v.nombre, mecanismo: v.mecanismo });
      Object.values(v).forEach(walk);
    }
  };
  for (const r of (results || [])) walk(r.facts);
  return mechRows;
}
function _mechanismAdvisory(narration, mechRows) {
  if (!mechRows.length) return [];
  const text = String(narration || "");
  const sentences = text.split(/(?<=[.!?])\s+/);
  const accionSent = sentences.find((s) => _MECH_ACTION_VERB.test(s));
  if (!accionSent) return [];
  const out = [];
  const seen = new Set();
  for (const { nombre, mecanismo } of mechRows) {
    if (seen.has(nombre)) continue;
    const re = new RegExp(`\\b${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (!re.test(text)) continue;   // la narración ni siquiera nombra esta entidad
    seen.add(nombre);
    const esCosto = mecanismo === "costo estructural";
    const tieneCorrecta = esCosto ? _MECH_COSTO_WORD.test(accionSent) : _MECH_CARGA_WORD.test(accionSent);
    const tieneIncorrecta = esCosto ? _MECH_CARGA_WORD.test(accionSent) : _MECH_COSTO_WORD.test(accionSent);
    if (tieneIncorrecta && !tieneCorrecta && !_MECH_CONNECTOR.test(accionSent)) {
      out.push(`${nombre}: el mecanismo dominante es "${mecanismo}", pero la acción priorizada nombra ${esCosto ? "carga/rebate" : "costo/precio"} sin conectarlo — "${accionSent.trim().slice(0, 140)}"`);
    }
  }
  return out;
}

// ── MECANISMO CON MEMORIA ENTRE TURNOS (owner 2026-07-29, 3er residual del punch list post-recon) — "si un turno ya
// estableció mecanismo dominante por entidad, el siguiente no debe recomendar otro mecanismo sin evidencia nueva o
// sin explicitar el cambio". Misma AVISO-no-bloqueo que el chequeo de arriba y por la MISMA razón (coherencia
// semántica vía regex, no una cifra) — acá el "mecRows" de ESTE turno es la evidencia nueva: si la entidad SÍ
// aparece en los resultados de este turno, no hay nada que objetar aunque contradiga lo memorizado (eso es
// justamente re-diagnosticar con datos frescos). Solo se activa cuando la entidad NO se re-evaluó este turno.
const _MECH_CHANGE_FLAG = /\b(a diferencia de (?:antes|lo anterior|lo que ve[ií]amos)|cambi[oó] el mecanismo|ya no es|esto (?:es|resulta) distinto (?:a|de) (?:antes|lo anterior)|distinto a (?:lo )?anterior|nueva evidencia|nuevo dato|cambio de mecanismo|esta vez es distinto)\b/i;
function _mechanismMemoryAdvisory(narration, mechanismMemory, mechRows) {
  if (!mechanismMemory || typeof mechanismMemory !== "object") return [];
  const entries = Object.entries(mechanismMemory);
  if (!entries.length) return [];
  const text = String(narration || "");
  const freshNames = new Set(mechRows.map((r) => r.nombre));
  const sentences = text.split(/(?<=[.!?])\s+/);
  const accionSent = sentences.find((s) => _MECH_ACTION_VERB.test(s));
  if (!accionSent) return [];
  const out = [];
  for (const [nombre, mecanismo] of entries) {
    if (freshNames.has(nombre)) continue;   // evidencia nueva este turno → no aplica este chequeo (aplica el de arriba)
    const re = new RegExp(`\\b${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (!re.test(text)) continue;
    const esCosto = mecanismo === "costo estructural";
    const tieneCorrecta = esCosto ? _MECH_COSTO_WORD.test(accionSent) : _MECH_CARGA_WORD.test(accionSent);
    const tieneIncorrecta = esCosto ? _MECH_CARGA_WORD.test(accionSent) : _MECH_COSTO_WORD.test(accionSent);
    if (tieneIncorrecta && !tieneCorrecta && !_MECH_CONNECTOR.test(accionSent) && !_MECH_CHANGE_FLAG.test(text)) {
      out.push(`${nombre}: un turno anterior había establecido "${mecanismo}" como mecanismo dominante, esta acción prioriza ${esCosto ? "carga/rebate" : "costo/precio"} sin evidencia nueva ni explicitar el cambio — "${accionSent.trim().slice(0, 140)}"`);
    }
  }
  return out;
}

// ── REPETICIÓN (owner 2026-07-30, Fase 3 "orientación inicial mid-conversación") — "detector de repetición...
// advisory, no debe bloquear respuestas por repetir cifras, entidades o términos necesarios." Mide solapamiento
// LÉXICO del texto COMPLETO contra las últimas narraciones PROPIAS de ADI (mem.recentNarrations) — mismo método
// que `_oracle_multimodo_gate.mjs` ya usaba como MÉTRICA DE TEST (nunca había corrido en runtime). AVISO puro:
// repetir un nombre de cliente o una cifra real es correcto y necesario — lo que se mide es que el 60%+ de las
// palabras (≥3 letras) del turno completo coincidan con un turno reciente, no cualquier término aislado.
const _WORD_RE = /[a-zá-úñ0-9]+/gi;
function _wordSet(text) {
  const s = new Set();
  for (const m of String(text || "").toLowerCase().matchAll(_WORD_RE)) if (m[0].length >= 3) s.add(m[0]);
  return s;
}
function _overlapRatio(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / Math.min(a.size, b.size);
}
const _REPETITION_THRESHOLD = 0.6;
function _repetitionAdvisory(narration, recentNarrations) {
  if (!Array.isArray(recentNarrations) || !recentNarrations.length) return [];
  const cur = _wordSet(narration);
  const out = [];
  for (const prev of recentNarrations) {
    const ratio = _overlapRatio(cur, _wordSet(prev));
    if (ratio >= _REPETITION_THRESHOLD) out.push(`la respuesta comparte ${Math.round(ratio * 100)}% de las palabras (≥3 letras) con una narración reciente propia de ADI — posible contenido reciclado`);
  }
  return out;
}

// ── REPETICIÓN VERBATIM (owner 2026-08-03, cierre de la investigación cruzada de los 5 gates de solapamiento léxico:
// _oracle_clarify_mode_gate.mjs · _oracle_multimodo_gate.mjs · _oracle_provider_certification_gate.mjs) — a
// diferencia de `_repetitionAdvisory` de arriba (ratio de VOCABULARIO compartido, SIEMPRE aviso puro — repetir un
// nombre de cliente, una cifra real o el mismo encabezado de tabla entre turnos sobre el MISMO tema es correcto y
// necesario, NUNCA debe bloquear ni cambiar el resultado — ver el comentario de esa función y `_dialogue_state_gate.
// mjs` sección 1, que fija como decisión DELIBERADA del owner 2026-07-30 que una repetición de 100% del vocabulario
// SIGUE pasando el guard con ok=true), esto detecta algo estructuralmente más fuerte: un TRAMO VERBATIM de 8+
// PALABRAS CONSECUTIVAS IDÉNTICO entre la narración actual y una narración reciente propia — evidencia mucho más
// nítida de prosa reciclada palabra-por-palabra (nunca confunde "mismo tema/tabla/entidad, mencionado de nuevo" con
// "el mismo párrafo pegado otra vez"): dos tablas legítimas que comparten encabezados + nombres de cliente + cifras
// jamás producen 8 palabras SEGUIDAS idénticas, salvo que sea realmente el mismo contenido copiado.
// DISEÑO (auditoría adversarial 2026-08-03, reconciliando 2 propuestas incompatibles — ver la nota de `guardC()`
// más abajo, en el cálculo de `degraded`): esto NUNCA entra a `violations`/`ok` — solo alimenta `advisories` (mismo
// canal que `_repetitionAdvisory`) MÁS un campo NUEVO y SEPARADO `degraded` en el objeto de retorno. `ok` sigue
// significando EXACTAMENTE lo mismo que siempre (cifra/conteo/entidad/orden/total/simulación/placeholder-BLOQUEAN,
// nada más) — `degraded` es una señal ADITIVA que el loop de reintento de NARRAR en answerViaOracle.js usa para
// darle a la escalada de modelo (mini→terra→sol, modelRouter.js) una oportunidad de producir una redacción fresca
// ANTES de aceptar una respuesta reciclada — NUNCA para reemplazar una respuesta válida por un "no tengo datos"
// peor (ver el uso en answerViaOracle.js: si NINGÚN intento logra una redacción fresca, se usa la MEJOR degradada
// disponible, jamás se cae a la reparación genérica solo por esto).
const _MIN_VERBATIM_RUN = 8;
function _tokenizeOrdered(text) {
  const out = [];
  for (const m of String(text || "").toLowerCase().matchAll(_WORD_RE)) out.push(m[0]);
  return out;
}
// sharedVerbatimRun(a, b, minWords) → true si `a` y `b` comparten un tramo de `minWords`+ palabras SEGUIDAS
// idéntico (orden incluido, a diferencia de `_overlapRatio` que solo mira el CONJUNTO de palabras). Exportado
// (owner 2026-08-03): fuente ÚNICA reusada por los gates _oracle_multimodo_gate.mjs/_oracle_provider_certification_
// gate.mjs/_oracle_clarify_mode_gate.mjs para reemplazar su propia métrica de ratio crudo — nunca se duplica esta
// lógica en cada gate por separado (regla de una sola fuente de verdad).
export function sharedVerbatimRun(a, b, minWords = _MIN_VERBATIM_RUN) {
  const ta = _tokenizeOrdered(a), tb = _tokenizeOrdered(b);
  if (ta.length < minWords || tb.length < minWords) return false;
  const grams = new Set();
  for (let i = 0; i + minWords <= tb.length; i++) grams.add(tb.slice(i, i + minWords).join(" "));
  for (let i = 0; i + minWords <= ta.length; i++) if (grams.has(ta.slice(i, i + minWords).join(" "))) return true;
  return false;
}
function _repetitionVerbatim(narration, recentNarrations) {
  if (!Array.isArray(recentNarrations) || !recentNarrations.length) return [];
  const out = [];
  for (const prev of recentNarrations) {
    if (sharedVerbatimRun(narration, prev, _MIN_VERBATIM_RUN)) out.push(`la respuesta repite un tramo de ${_MIN_VERBATIM_RUN}+ palabras SEGUIDAS idéntico a una narración reciente propia de ADI — contenido reciclado verbatim (no solo mismo tema/cifra)`);
  }
  return out;
}

// ── ORDEN ACCIÓN-TABLA EN mode=DECISION (owner 2026-08-03, defecto confirmado en vivo: 4 corridas reales del turno
// "¿Qué debería priorizar esta semana entre Falabella, Lider y Sodimac?", 3/3 con mode=decision confirmado abrieron
// la respuesta con una fila de tabla markdown — violando conversationalContract.js MODES['decision'].narrate
// ("arrancá DIRECTO por la acción... la tabla JAMÁS es lo primero"). TABLE_INSTRUCTION (narratePromptC.js) asumía
// y reforzaba tabla-primero para TODO modo; el fix de PROMPT es TABLE_INSTRUCTION_DECISION (narratePromptC.js),
// que invierte el orden. Esto es el BACKSTOP ESTRUCTURAL — mismo canal `degraded` que `_repetitionVerbatim` de
// arriba: NUNCA bloquea (violations/ok quedan intactos), solo señala para darle a la escalada mini→terra→sol
// (modelRouter.js) una chance real de reescribir con el orden correcto ANTES de aceptar una tabla-primero.
// DEGRADA, NO BLOQUEA (decisión deliberada, con evidencia — no un supuesto):
//   1. es un requisito de FORMA/orden conversacional, no de FIDELIDAD factual — la tabla sigue siendo 100% fiel a
//      cifras_autorizadas, solo está mal UBICADA. Las 8 categorías que sí bloquean (`violations`, más abajo) son
//      todas de fidelidad (cifra/conteo/entidad/orden-de-datos/total/simulación/placeholder) — nunca de forma.
//   2. bloquear (violations) arriesgaría agotar los 3 intentos de NARRAR y caer a `composeFromLedger`
//      (answerViaOracle.js, reparación de full scope) — una tabla de cifras SIN NINGUNA prosa ejecutiva, un
//      resultado estrictamente PEOR para un turno de decisión que una respuesta completa aunque abra con tabla.
//   3. ningún gate existente certifica hoy "una tabla nunca abre mode=decision" (confirmado por grep del repo:
//      _oracle_multimodo_gate.mjs solo verifica el VALOR de plan.mode, nunca la posición de una tabla en el texto)
//      — agregar este backstop no afloja ninguna garantía previa.
// Mira SOLO la PRIMERA línea NO VACÍA del texto — es literalmente "lo primero que decís" (owner: "la tabla JAMÁS
// es lo primero que decís"). BUG real cazado en vivo probando esto (owner 2026-08-03, antes de cerrar el fix): una
// primera versión miraba las primeras DOS líneas no vacías (pensando en el caso "el LLM antepone un separador/
// negrita suelta antes de la tabla real") — pero el patrón CORRECTO y DESEADO es exactamente "UNA frase de acción,
// blanco, tabla" — con lo que la fila de encabezado de la tabla CAE en la línea 2 en el caso BUENO también, y esa
// versión marcaba `degraded` incluso cuando la acción YA estaba primero (falso positivo confirmado en vivo:
// forzaba reintentos/escalada en el 100% de las respuestas bien formadas). Restringido a la línea 1: una tabla que
// aparece en cualquier línea DESPUÉS de una primera línea de prosa real es exactamente el orden correcto y no
// dispara nada; solo dispara cuando la tabla es LITERALMENTE lo primero que el texto dice.
function _decisionOpensWithTable(text, mode) {
  if (mode !== "decision") return false;
  const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 && /^\|.*\|\s*$/.test(lines[0]);
}

// _clarifyHasTable(text, mode) — MISMA familia que _decisionOpensWithTable arriba (owner 2026-08-03, hallazgo de la
// suite completa de 107 gates: _oracle_clarify_mode_gate.mjs, un turno "no entendí" citó 16 cifras en una tabla
// completa, MÁS que el resumen que originó la confusión). A diferencia de decision (donde el problema es el ORDEN
// — la tabla puede seguir existiendo, solo no puede abrir la respuesta), clarify PROHÍBE la tabla PUNTO — su propia
// doctrina (conversationalContract.js MODES['clarify'].narrate) exige como mucho 1 cifra (nivel 1) o cero cifras
// (nivel 2+), nunca una tabla en ningún nivel. Por eso este chequeo mira CUALQUIER línea del texto (no solo la
// primera) — cualquier fila de tabla markdown en una narración mode=clarify ya es una violación de forma, sin
// importar dónde caiga. El fix de raíz es la supresión de instruccion_tabla en narratePromptC.js (ver ahí); este
// backstop es la red para cuando el modelo igual arma una tabla por su cuenta.
function _clarifyHasTable(text, mode) {
  if (mode !== "clarify") return false;
  const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.some((l) => /^\|.*\|\s*$/.test(l));
}

// _temporalMissingVariation(text, results) — MISMA familia que _decisionOpensWithTable/_clarifyHasTable (owner
// 2026-08-05, hallazgo en vivo: "le falta el % cuanto ha variado, eso es lo que debería explicar ADI"). Cuando
// el turno corrió la tool `trend` Y el composer YA calculó/autorizó facts.mejorMes/peorMes con su % de variación
// (ver temporalTable.js — HOY solo la rama GLOBAL de venta lo hace, no contribución/margen ni por-entidad) — pero
// solo REFORZAR la doctrina (narratePromptC.js SERIE TEMPORAL) no garantiza que el narrador de verdad lo cite,
// mismo patrón de TODA esta sesión (doctrina sola no alcanza, hace falta backstop). Ojo con el candado exacto:
// exige facts.mejorMes (no solo tablaM) — si se disparara para CUALQUIER trend, degradaría (reintentaría) turnos
// donde el % simplemente NO EXISTE en los facts (branches que todavía no lo calculan), gastando escalada
// mini→terra→sol en una garantía estructuralmente imposible de cumplir. Chequeo angosto y barato: si el % SÍ
// está disponible en los facts Y la narración no trae NINGÚN símbolo "%", es estructuralmente imposible que haya
// cumplido "nombrá el % de variación del mejor/peor mes" — sin importar qué tan bien redactada esté la prosa. NO
// exige un % en cada oración (eso sería rigidez de formulario) — solo que exista AL MENOS uno.
function _temporalMissingVariation(text, results) {
  const hasVariationData = Array.isArray(results) && results.some((r) => r && r.tool === "trend" && r.facts && r.facts.mejorMes);
  if (!hasVariationData) return false;
  return !/%/.test(String(text || ""));
}

// ── ENTIDAD ledger-derivada (garble) ────────────────────────────────────────────────────────────────────────────
// STOPLIST · palabras españolas/dominio que colisionan con prefijos de nombres de cliente y NUNCA son garble
// (la MISMA de entityGuard.js · sin ella "Para" abría casi-match con "Paris" → falso positivo → C se abstenía).
const _STOP = new Set([
  "falta", "faltan", "falla", "fallas", "parte", "partes", "pareto", "paridad", "para", "pared",
  "total", "totales", "hito", "hitos", "unidad", "unidades", "concepto", "conceptos", "contra", "antes",
  "lidera", "lideran", "liderando", "liderazgo", "mercaderia", "mercaderias", "mercados", "merece", "merecen",
  "vale", "valen", "valor", "valores", "libera", "liberar", "unico", "unica", "unicos", "unicas",
  "sobre", "sumar", "suman", "punto", "puntos", "primer", "primero", "prioriz", "prioridad", "reducir", "revisar",
]);
function _lev(a, b) { const m = a.length, n = b.length; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
const _prefix = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
const _TOKEN = /(?<![A-Za-zÀ-ſ])[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+/g;
const _WRAP = /[\s"'“”‘’¿¡()[\]*_>]+$/, _BOUNDARY = /[.!?:;·…\n—-]$/;
function _entityGarble(narration, entityNames) {
  const anchors = [];
  const safe = new Set();
  for (const name of entityNames) { safe.add(_norm(name)); for (const w of String(name).split(/\s+/)) { const nw = _norm(w); safe.add(nw); if (nw.length >= 4 && !anchors.some((a) => a.norm === nw)) anchors.push({ norm: nw, display: name }); } }
  if (!anchors.length) return null;
  const text = String(narration || "");
  for (const m of text.matchAll(_TOKEN)) {
    const tok = m[0]; if (tok.length < 4) continue;
    const t = _norm(tok); if (safe.has(t) || _STOP.has(t)) continue;
    const before = text.slice(0, m.index).replace(_WRAP, "");
    const atStart = !before || _BOUNDARY.test(before);
    for (const a of anchors) {
      const th = a.norm.length >= 8 ? 2 : 1;
      const near = (Math.abs(t.length - a.norm.length) <= th && _lev(t, a.norm) <= th) || (!atStart && _prefix(t, a.norm) >= Math.max(3, Math.ceil(t.length / 2)));
      if (near) return `entidad corrupta: "${tok}" no existe en el dato del turno — casi-matchea "${a.display}"`;
    }
  }
  return null;
}

// ── ORDEN PROMETIDO (owner 2026-07-28: "si dice que ordena por monto, la lista debe estar ordenada por monto — ADI
// no puede fallar en una promesa explícita de ordenamiento"). Hallazgo real: el narrador arma una tabla/lista con las
// filas en el orden que le dio la TOOL (ej. margen ascendente) pero la etiqueta con OTRO criterio ("ordenado por
// dinero recuperable") — el texto promete un orden que la estructura no cumple. Chequeo DETERMINÍSTICO: mira SOLO la
// FORMA (filas de tabla / ítems numerados), sin necesitar saber los nombres de entidad de antemano. Se activa SOLO si
// la pregunta o la narración declaran el orden EXPLÍCITAMENTE (evita falsos positivos sobre prosa sin promesa) y solo
// juzga si hay evidencia estructural suficiente (≥3 filas/ítems con cifra) — sin eso, no se pronuncia (no inventa un
// veredicto sobre texto libre). BLOQUEA (no aviso): un orden roto es tan grave como una cifra inventada para el owner.
// TODA la detección corre sobre texto NORMALIZADO (_norm: sin acentos, minúsculas — la MISMA función que ya usa el
// garble de entidad) para no perder "ordénalos"/"ordená" por la tilde. Solo la EXTRACCIÓN de la tabla/lista real usa
// el texto ORIGINAL (necesita los encabezados/celdas tal como se muestran).
const _ORDER_DESC = /\bde\s+mayor\s+a\s+menor\b/;
const _ORDER_ASC = /\bde\s+menor\s+a\s+mayor\b/;
const _ORDER_BY = /\borden(?:a|alos|ados?|ando|ar)?\s+(?:l[oa]s\s+)?(?:por|segun)\s+([a-z%]+(?:\s+[a-z%]+){0,2})/;
// respaldo: "de mayor a menor MARGEN" / "de menor a mayor VENTA" — sin "por/según", la forma más natural en español.
const _ORDER_DIR_KEYWORD = /\bde\s+(?:mayor\s+a\s+menor|menor\s+a\s+mayor)\s+([a-z%]+(?:\s+[a-z%]+){0,2})/;
// _PP_RE (owner 2026-08-03, "sella facts.orden para marginRead"): un TERCER formato de valor, "puntos porcentuales"
// (ej. "8.6pp" — la BRECHA benchmark−margen, no un $ ni un % de por sí) — sin esto, un orden sellado/prometido en
// "pp" (como marginRead's "descendente por Brecha") caía silenciosamente sin verificarse: ni _MONEY_RE ("$X") ni
// _PCT_RE ("X%") matchean "8.6pp", así que `seq` quedaba vacía y el chequeo se saltaba entero (mismo camino que
// "columna sellada ausente" — un falso negativo, no un falso positivo, pero deja el sello sin efecto real).
const _MONEY_RE = /\$\s?[\d.,]+\s?[KMB]?/, _PCT_RE = /[\d.,]+\s?%/, _PP_RE = /[\d.,]+\s?pp\b/i;
function _toNumOrder(tok) {
  const dm = String(tok).match(/\$\s?([\d.,]+)\s?([KMB]?)/i);
  if (dm) { let v = parseFloat(dm[1].replace(/,/g, "")); const s = (dm[2] || "").toUpperCase(); if (s === "K") v *= 1e3; else if (s === "M") v *= 1e6; else if (s === "B") v *= 1e9; return v; }
  const ppm = String(tok).match(/([\d.,]+)\s?pp\b/i);
  if (ppm) return parseFloat(ppm[1].replace(/,/g, ""));
  const pm = String(tok).match(/([\d.,]+)\s?%/);
  if (pm) return parseFloat(pm[1].replace(/,/g, ""));
  return null;
}
// _reFor(keyword) → qué patrón usar para extraer valores de la columna/celda sellada — money ($X) / pct (X%) /
// pp (X puntos porcentuales, ej. brecha). Chequea "pp" ANTES que "pct": un keyword como "brecha" no contiene "%"
// ni "porcentaje" (isPct no lo detectaría), pero SÍ debe leerse en pp, no en $.
function _reFor(keyword) {
  const k = String(keyword || "");
  if (/\bpp\b|brecha|\bgap\b|puntos?\s*porcentual/i.test(k)) return _PP_RE;
  if (/margen|%|porcentaje/i.test(k)) return _PCT_RE;
  return _MONEY_RE;
}
function _tableRowsOrder(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.includes("|"));
  if (lines.length < 3) return null;
  const cellsOf = (l) => { let s = l; if (s.startsWith("|")) s = s.slice(1); if (s.endsWith("|")) s = s.slice(0, -1); return s.split("|").map((c) => c.trim()); };
  const sepIdx = lines.findIndex((l) => /^\|?[\s:|-]*-[\s:|-]*\|?$/.test(l));
  if (sepIdx < 1) return null;
  const header = cellsOf(lines[sepIdx - 1]);
  const rows = lines.slice(sepIdx + 1).map(cellsOf).filter((r) => !/^\*{0,2}total\*{0,2}\*{0,2}$/i.test(r[0] || ""));
  return { header, rows };
}
function _listItemsOrder(text) {
  const re = /^\s*\d+[.)]\s+(.+)$/gm;
  const out = []; let m;
  while ((m = re.exec(text))) out.push(m[1]);
  return out.length >= 3 ? out : null;
}
function _colForKeyword(header, keyword) {
  if (!keyword) return -1;
  const kw = _norm(keyword);
  return header.findIndex((h) => { const hl = _norm(h); return kw.includes(hl) || hl.split(/\s+/).some((w) => w.length >= 4 && kw.includes(w)); });
}
function _seqFromTableOrder(table, keyword, re) {
  let col = _colForKeyword(table.header, keyword);
  if (col < 0) { for (let i = table.header.length - 1; i >= 0; i--) if (table.rows.some((r) => re.test(r[i] || ""))) { col = i; break; } }
  if (col < 0) return [];
  const out = [];
  for (const r of table.rows) { const m = (r[col] || "").match(re); if (m) out.push(_toNumOrder(m[0])); }
  return out;
}
function _seqFromListOrder(items, keyword, re) {
  const out = [];
  for (const it of items) {
    let m = null;
    if (keyword) { const kw0 = keyword.split(/\s+/)[0]; const idx = it.toLowerCase().indexOf(kw0.toLowerCase()); if (idx >= 0) m = it.slice(idx).match(re); }
    if (!m) { const all = [...it.matchAll(new RegExp(re.source, "g"))]; m = all.length ? [all[all.length - 1][0]] : null; }
    if (m) out.push(_toNumOrder(m[0]));
  }
  return out;
}
function _orderViolation(narration, question) {
  const text = String(narration || "");
  const combinedNorm = _norm(String(question || "") + " " + text);   // detección: SIN acentos (ordénalos/ordená no se pierden)
  let dir = null;
  if (_ORDER_DESC.test(combinedNorm)) dir = "desc"; else if (_ORDER_ASC.test(combinedNorm)) dir = "asc";
  const byM = combinedNorm.match(_ORDER_BY) || combinedNorm.match(_ORDER_DIR_KEYWORD);
  const keyword = byM ? byM[1].trim() : null;
  if (!dir && !keyword) return null;                 // sin promesa explícita de orden → no aplica
  if (!dir) dir = "desc";                             // "ordená por X" sin dirección → de mayor a menor (default ejecutivo)
  const re = _reFor(keyword);
  const table = _tableRowsOrder(text);
  let seq = table ? _seqFromTableOrder(table, keyword, re) : [];
  if (seq.length < 3) { const items = _listItemsOrder(text); if (items) seq = _seqFromListOrder(items, keyword, re); }
  if (seq.length < 3) return null;                    // sin evidencia estructural suficiente → no se pronuncia
  for (let i = 1; i < seq.length; i++) {
    if (dir === "desc" && seq[i] > seq[i - 1] * 1.001) return `fila ${i + 1} (${seq[i]}) es mayor que la fila ${i} (${seq[i - 1]}) — prometiste orden de mayor a menor`;
    if (dir === "asc" && seq[i] < seq[i - 1] * 0.999) return `fila ${i + 1} (${seq[i]}) es menor que la fila ${i} (${seq[i - 1]}) — prometiste orden de menor a mayor`;
  }
  return null;
}

// ── PERÍODO/FECHA DE CORTE (owner "pase quirúrgico de confiabilidad" 2026-07-29, requisito 3: "toda respuesta
// numérica debe declarar período o fecha de corte") — toolRunner.js estampa `facts.periodo` (o el
// `facts.marco_temporal.periodo` que trend ya traía) con UNA de dos frases canónicas SIEMPRE que la tool devolvió
// cifras reales. GARANTÍA DETERMINÍSTICA, no un chequeo que bloquea: medido en vivo (6 preguntas × 2 corridas), un
// guard BLOQUEANTE acá disparaba ~33% de fallbacks — el LLM omite la frase con más frecuencia de la que un muro
// puede tolerar sin degradar la confiabilidad que este mismo requisito busca proteger. En vez de exigirle al LLM
// que se acuerde SIEMPRE, `ensurePeriodoDeclared` (más abajo) se lo agrega DETERMINÍSTICAMENTE si falta — mismo
// principio que `stripLanguageLeaks`/`stripFiller`: la garantía se construye en el motor, no se le pide de favor
// al LLM. Las keywords son SOLO para reconocer que el LLM YA lo dijo (evita duplicar la cláusula).
const _PERIODO_FAMILIAS = {
  anual: { esDato: /a[nñ]o cerrado/i, keywords: [/a[nñ]o cerrado/i, /a[nñ]o (?:ya )?cerr\w*/i, /12 meses/i, /cierre del a[nñ]o/i, /a[nñ]o (?:completo|fiscal)/i, /ya (?:transcurri|ocurri)\w*/i] },
  hoy: { esDato: /foto.*hoy|a hoy\b/i, keywords: [/foto de (?:hoy|inventario)/i, /a la fecha/i, /corte de hoy/i, /instant[aá]ne\w*/i, /\bhoy\b/i] },
};
function _familiaDePeriodo(texto) {
  for (const [k, v] of Object.entries(_PERIODO_FAMILIAS)) if (v.esDato.test(String(texto || ""))) return k;
  return null;
}
// periodosEsperados(results) → array de familias ("anual"/"hoy") presentes este turno · [] si ninguna tool trajo
// cifras (turnos ack/define/redirect sin calls, o tools sin boleta) → ensurePeriodoDeclared no toca nada.
export function periodosEsperados(results) {
  const set = new Set();
  for (const r of results || []) {
    const p = r && r.facts && (r.facts.periodo || (r.facts.marco_temporal && r.facts.marco_temporal.periodo));
    if (p) { const fam = _familiaDePeriodo(p); if (fam) set.add(fam); }
  }
  return [...set];
}
function _periodoDeclarado(narration, familias) {
  const text = String(narration || "");
  return familias.some((fam) => (_PERIODO_FAMILIAS[fam] && _PERIODO_FAMILIAS[fam].keywords || []).some((re) => re.test(text)));
}
// periodoDeclarado(narration, familias) → export PÚBLICO de _periodoDeclarado (owner-audit 2026-07-30, hallazgo
// real: _periodo_declarado_gate.mjs mantenía su PROPIA copia parcial de este regex para verificar la garantía —
// desincronizada de _PERIODO_FAMILIAS.keywords arriba, así que un turno donde el narrador declaraba el período con
// una frase VÁLIDA pero no cubierta por la copia del gate (ej. "ya transcurrido", "año fiscal", "hoy" a secas)
// contaba como falla del gate aunque ensurePeriodoDeclared ya lo hubiera reconocido correctamente — un falso
// negativo de MEDICIÓN, no un hueco real de la garantía. El gate ahora importa y llama a ESTA función — misma
// fuente de verdad que la garantía real, cero posibilidad de que vuelvan a desincronizarse.
export function periodoDeclarado(narration, familias) {
  return _periodoDeclarado(narration, familias);
}
// ensurePeriodoDeclared(narration, periodos) → la GARANTÍA real del requisito 3: si la narración YA declaró el
// período (por palabra clave, sea la frase del narrador o la nuestra) la deja intacta; si no, le agrega una
// cláusula corta y canónica. "anual"+"hoy" juntos (un turno con inventario + otra tool) agrega ambas cláusulas.
const _PERIODO_CLAUSULA = { anual: "Datos del año cerrado.", hoy: "Foto de inventario a hoy." };
export function ensurePeriodoDeclared(narration, periodos) {
  const text = String(narration || "").trim();
  if (!Array.isArray(periodos) || !periodos.length || !text) return text;
  const faltan = periodos.filter((fam) => !_periodoDeclarado(text, [fam]));
  if (!faltan.length) return text;
  const clausulas = faltan.map((fam) => _PERIODO_CLAUSULA[fam]).filter(Boolean).join(" ");
  if (!clausulas) return text;
  // BUG real cazado en vivo (owner 2026-07-29, verificando el trabajo de otra sesión — regresión de esta MISMA
  // función, no del cambio ajeno): modo=clarify DEBE cerrar con "?" (contrato de conversationalContract.js,
  // verificado por _oracle_provider_certification_gate) — agregar la cláusula AL FINAL le robaba a la última
  // oración su cierre de pregunta ("¿...ejemplo?" quedaba seguido de "(Datos del año cerrado.)", ya no terminaba
  // en "?"). Si el texto YA cierra con pregunta, la cláusula va AL PRINCIPIO — nunca después del cierre.
  return /\?\s*$/.test(text) ? `(${clausulas}) ${text}` : `${text} (${clausulas})`;
}

// ── ORDEN SELLADO POR LA TOOL (requisito 4: "orden, dirección y ranking deben venir sellados por la tool") — a
// diferencia de `_orderViolation` (que SOLO se activa si la narración hace una promesa explícita de orden en texto),
// esto verifica DIRECTO contra el `facts.orden`/`ordenA`/`ordenB` que la tool ya declaró (gridTable/tensionRead) —
// sin importar si el narrador lo dijo en palabras o no: si armó una TABLA con la columna sellada VISIBLE, las
// filas tienen que respetar el criterio real, punto.
// A DIFERENCIA de `_orderViolation`: NO usa el fallback de "adiviná la columna que matchee el patrón $/%" — medido
// en vivo (hallazgo real): el narrador a veces muestra OTRA métrica en la tabla en vez de la sellada (pidieron
// "top 5 por contribución" y la tabla mostró Ventas en su lugar, con las filas en el orden REAL de contribución
// igual) — adivinar la columna ahí comparaba la columna EQUIVOCADA y marcaba una violación falsa. Si la columna
// sellada no aparece LITERAL en el encabezado, no hay nada verificable → no se pronuncia (mismo criterio "sin
// evidencia estructural suficiente" que ya usa `_orderViolation`). Tampoco cae a listas numeradas (gridTable/
// tensionRead son tablas por diseño — ver chartSpec.js requisito 5); ese fallback es del otro chequeo, no de este.
function _sealedOrderBroken(narration, sealedOrders) {
  if (!Array.isArray(sealedOrders) || !sealedOrders.length) return null;
  const text = String(narration || "");
  const table = _tableRowsOrder(text);
  if (!table) return null;
  for (const s of sealedOrders) {
    const sn = _norm(s);
    const sDir = sn.includes("ascendente") ? "asc" : "desc";
    const m = sn.match(/por\s+([a-z%]+(?:\s+[a-z%]+){0,2})$/);
    const keyword = m ? m[1] : null;
    if (!keyword) continue;
    const col = _colForKeyword(table.header, keyword);
    if (col < 0) continue;   // la columna sellada NO aparece literal en esta tabla → no hay nada que verificar acá
    const re = _reFor(keyword);
    const seq = table.rows.map((r) => { const mm = (r[col] || "").match(re); return mm ? _toNumOrder(mm[0]) : null; }).filter((v) => v != null);
    if (seq.length < 3) continue;   // sin evidencia estructural suficiente para ESTE campo → no se pronuncia
    for (let i = 1; i < seq.length; i++) {
      if (sDir === "desc" && seq[i] > seq[i - 1] * 1.001) return `la tabla no respeta el orden SELLADO por la tool (${s}) — fila ${i + 1} rompe la secuencia`;
      if (sDir === "asc" && seq[i] < seq[i - 1] * 0.999) return `la tabla no respeta el orden SELLADO por la tool (${s}) — fila ${i + 1} rompe la secuencia`;
    }
  }
  return null;
}

// ── EL GUARD ────────────────────────────────────────────────────────────────────────────────────────────────────
// guardC(narration, { ledger, results, trace }) → { ok, verdict, violations[] }
// verdict: "fiel" | "cifra-no-autorizada" | "atribucion" | "conteo-no-autorizado" | "graduacion" | "entidad-corrupta"
// CÁLCULO SOBRE EL DATO (owner 2026-07-28 "que calcule, como Claude con el Excel"): una cifra que es la SUMA o la
// RESTA de dos cifras AUTORIZADAS (mismos operandos reales del motor) NO es invento — es el LLM calculando sobre el
// dato (ej. brecha de margen = benchmark − margen, "juntos explican $X+$Y"). Se autoriza. Operandos reales → seguro.
// Solo para mismas unidades (sin trampa de escala). Tolerancia por redondeo.
// _figEntityOwners(label, entityNames) → qué entidades nombra este label (búsqueda de substring con límite de
// palabra sobre el label COMPLETO, no igualdad de segmento — a diferencia de _valueOwners: figs como "Medida ·
// cerrar brecha en LG-AIR9000" (D9) tienen la entidad AL FINAL de una frase, no como su propio segmento "·", y
// _valueOwners las dejaba pasar como "sin dueño" por eso).
function _figEntityOwners(label, entityNames) {
  const s = String(label || "");
  const out = [];
  for (const n of entityNames) if (new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(s)) out.push(n);
  return out;
}
// _scopedCalcPool · owner-audit turno 8/re-barrido 2026-07-29 (hueco CONFIRMADO EN VIVO: un turno sobre el SKU
// MAK-COMP-AIR "autorizó" $194K combinando 1pp de LG-DRYER8KG + brecha de LG-AIR9000 — dos SKU sin relación con lo
// narrado, cuya suma coincidió por pura combinatoria con la carga comercial REAL de un CLIENTE, Falabella, que ni
// siquiera estaba en el ledger de ese turno). _isCalc (nivel 1) pooleaba TODAS las figs del mismo unit sin mirar a
// quién pertenecen — con ~30-60 figs por turno, cualquier número plausible tiene alta chance de "calzar" con algo.
// Mismo principio que _isCalc2 (que ya scopea el nivel 2), aplicado acá al nivel 1: una fig que NOMBRA una entidad
// solo entra al pool de cálculo si esa entidad está MENCIONADA en el texto que se está validando; una fig SIN
// entidad reconocible (totales/estructurales, ej. "Total · actual") siempre entra — no tiene dueño que restringir.
function _scopedCalcPool(authFigs, entityNames, mentionedEntities) {
  if (!entityNames || !entityNames.length) return authFigs;
  const mentioned = new Set(mentionedEntities || []);
  return authFigs.filter((f) => {
    const owners = _figEntityOwners(f.label, entityNames);
    return !owners.length || owners.some((o) => mentioned.has(o));
  });
}
function _isCalc(raw, unit, authFigs, entityNames = [], mentionedEntities = []) {
  if (!Number.isFinite(raw)) return false;
  // pp (puntos porcentuales, ej. la brecha "8.1pp") se deriva de DOS cifras unit:"pct" (benchmark − margen) — no
  // hay figs "pp" originales en ningún ledger, así que el pool de candidatos para una resta/suma es el de "pct".
  const srcUnit = unit === "pp" ? "pct" : unit;
  const pool = _scopedCalcPool(authFigs, entityNames, mentionedEntities);
  const vals = pool.filter((f) => f.unit === srcUnit && Number.isFinite(f.raw)).map((f) => f.raw);
  if (vals.length < 2) return false;
  const tol = unit === "money" ? Math.max(1000, Math.abs(raw) * 0.02) : (unit === "pct" || unit === "pp") ? 0.2 : unit === "ratio" ? 0.15 : unit === "days" ? 0.6 : 0.05;
  for (let i = 0; i < vals.length; i++) for (let j = 0; j < vals.length; j++) {
    if (i === j) continue;
    if (Math.abs((vals[i] - vals[j]) - raw) <= tol) return true;                 // resta a−b
    if (i < j && Math.abs((vals[i] + vals[j]) - raw) <= tol) return true;        // suma a+b
  }
  return false;
}

// _isCalc2 · RESTA-DE-RESTAS con SCOPE por entidad (owner-audit turno 8, hueco arquitectónico confirmado por test
// sintético): cuando DOS entidades comparadas NO comparten el mismo par de operandos base (ej. cada una con su
// propio benchmark declarado por fila — el contrato lo permite aunque hoy ningún tenant lo puebla divergente),
// "brecha_A − brecha_B" no es la resta de DOS figs originales — es la resta de DOS cálculos ya autorizados
// (nivel 2). _isCalc (nivel 1) no lo ve. Esto SOLO se invoca cuando nivel 1 ya falló, y el pool de candidatos se
// ACOTA a las figs de las 1-2 entidades que la narración nombra (nunca todo el ledger completo): con ~30-60 figs
// sueltas por turno, un nivel 2 SIN ese scope generaría decenas de miles de combinaciones — prácticamente
// cualquier número inventado "calzaría" con algo, matando el propósito del guard. Tope duro: nivel 2 fijo, jamás
// recursivo (no combina un _isCalc2 con otro _isCalc2).
function _figsOfEntity(authFigs, name) {
  const n = _norm(name);
  return authFigs.filter((f) => String(f.label || "").split("·").some((seg) => _norm(seg.trim()) === n));
}
function _diffs(vals) { const out = []; for (let i = 0; i < vals.length; i++) for (let j = 0; j < vals.length; j++) if (i !== j) out.push(vals[i] - vals[j]); return out; }
function _isCalc2(raw, unit, authFigs, entityNames) {
  if (!Number.isFinite(raw) || !Array.isArray(entityNames) || entityNames.length < 2) return false;
  const srcUnit = unit === "pp" ? "pct" : unit;
  const tol = unit === "money" ? Math.max(1000, Math.abs(raw) * 0.02) : (unit === "pct" || unit === "pp") ? 0.2 : unit === "ratio" ? 0.15 : unit === "days" ? 0.6 : 0.05;
  const perEntity = entityNames
    .map((n) => _figsOfEntity(authFigs, n).filter((f) => f.unit === srcUnit && Number.isFinite(f.raw)).map((f) => f.raw))
    .filter((vals) => vals.length >= 2);   // cada entidad necesita ≥2 valores PROPIOS para armar SU calc (ej. margen+benchmark)
  if (perEntity.length < 2) return false;
  for (let a = 0; a < perEntity.length; a++) {
    const dA = _diffs(perEntity[a]);
    for (let b = 0; b < perEntity.length; b++) {
      if (b === a) continue;
      const dB = _diffs(perEntity[b]);
      for (const x of dA) for (const y of dB) {
        if (Math.abs((x - y) - raw) <= tol) return true;
        if (Math.abs((x + y) - raw) <= tol) return true;
      }
    }
  }
  return false;
}

// _placeholderSinRellenar(narration) → texto del placeholder | null (owner 2026-07-31, hallazgo en vivo, auditoría
// integral) — cuando PLAN deja `calls` vacío pese a que la doctrina lo prohíbe (ver
// answerViaOracle.js/_hasEmptyRedirectCalls), NARRATE a veces redacta la respuesta con placeholders LITERALES sin
// rellenar ("...con un potencial de $X...", "...alcanzando $Y..."). parseFigures() NUNCA los detecta como "cifra"
// (no son numéricos) — sin este chequeo, el guard no tiene NADA que comparar/rechazar y deja pasar el texto roto
// verbatim. Angosto a patrones de placeholder EVIDENTES: un "$" o un "%" pegado a una letra mayúscula SUELTA
// (X/Y/Z/N…) — nunca una sigla real de 2+ letras ("$USD") ni un número real ("$50", "12%"), gracias al \b inicial
// (solo dispara en el borde de palabra de esa letra sola) y al lookahead que exige que no siga otro alfanumérico.
const _PLACEHOLDER_RE = /\$\s?[A-Z]\b(?![a-zA-Z0-9])|\b[A-Z]\s?%/;
function _placeholderSinRellenar(narration) {
  const m = _PLACEHOLDER_RE.exec(String(narration || ""));
  return m ? m[0].trim() : null;
}

// _simulateGeneralConclusionViolation (owner 2026-07-31, #56 "simulate v2", variante c) → si ALGÚN result de
// simulateGeneral en este turno degradó honesto a solo-ventas (costModelAutorizado===false, ver toolRegistry.js),
// la narración no puede usar "conviene"/"no conviene" — solo hay ventas, ninguna base real para esa conclusión.
function _simulateGeneralConclusionViolation(narration, results) {
  const degraded = (results || []).some((r) => r && r.tool === "simulateGeneral" && r.facts && r.facts.costModelAutorizado === false);
  if (!degraded) return null;
  const m = /convien\w*/i.exec(narration || "");
  return m ? m[0] : null;
}

export function guardC(narration, { ledger, results = [], trace = null, question = "", mechanismMemory = null, sealedOrders = null, recentNarrations = null, mode = null } = {}) {
  const figs = ledger && Array.isArray(ledger.figs) ? ledger.figs : [];
  // ECO DEL USUARIO: repetir una cifra que la PERSONA nombró en su pregunta NO es inventar ("qué es eso de 2x" → ADI
  // dice "2x"). Autorizamos las cifras/conteos del texto de la pregunta además de las de la boleta.
  const qFigs = parseFigures(question || "");
  const authCanon = new Set([...figs.map((f) => f.canon), ...qFigs.map((f) => f.canon)]);
  const authVerbatim = new Set([...figs.map((f) => _stripSpace(f.value)), ...qFigs.map((f) => _stripSpace(f.text))]);
  const violations = [];
  const entityNames = _entityNames(results);   // adelantado (antes vivía en el paso 3) — _isCalc2 lo necesita en el paso 1
  // entidades NOMBRADAS en ESTE texto (subconjunto de entityNames) — _isCalc2 se acota a estas, NUNCA a todo
  // entityNames del dataset (que puede traer 8+ entidades de una tool rica): sin este recorte, el nivel-2
  // combinaría pares de entidades que la narración ni siquiera menciona, reabriendo el mismo riesgo de
  // combinatoria amplia que un "nivel 2 global" — el diseño exige EXACTAMENTE las 1-2 que el texto compara.
  const mentionedEntities = entityNames.filter((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(narration));

  // 1 · cifras CON unidad no autorizadas (mandatory-LITE) — se acepta la CITA directa (canon/verbatim), el ECO de la
  //     pregunta, un CÁLCULO nivel-1 (suma/resta de DOS figs autorizadas), o nivel-2 SCOPEADO a las entidades nombradas.
  for (const f of parseFigures(narration)) {
    if (!authCanon.has(f.canon) && !authVerbatim.has(_stripSpace(f.text)) && !_isCalc(f.raw, f.unit, figs, entityNames, mentionedEntities) && !_isCalc2(f.raw, f.unit, figs, mentionedEntities)) violations.push({ kind: "cifra-no-autorizada", detail: f.text });
  }
  // 2 · conteos sin signo no autorizados (+ los que el usuario nombró en la pregunta)
  const authCounts = _authorizedCounts(ledger, results);
  for (const c of parseCounts(question || "")) authCounts.add(c.raw);
  for (const c of parseCounts(narration)) {
    if (!authCounts.has(c.raw)) violations.push({ kind: "conteo-no-autorizado", detail: c.text });
  }
  // 3 · entidad garble ledger-derivada (nombre de entidad inventado = tan grave como una cifra inventada)
  const garb = _entityGarble(narration, entityNames);
  if (garb) violations.push({ kind: "entidad-corrupta", detail: garb });
  // 4 · orden prometido incumplido (owner: tan grave como una cifra inventada — es una promesa explícita rota)
  const orderViol = _orderViolation(narration, question);
  if (orderViol) violations.push({ kind: "orden-incumplido", detail: orderViol });
  // 5 · TOTAL del negocio atribuido a 1-2 entidades (owner, segunda vuelta: "guard determinístico que bloquee" —
  // a diferencia de la atribución general (aviso), ESTE caso puntual SÍ bloquea: cambia el tamaño real de la oportunidad.
  for (const v of _totalMisattribution(narration, ledger, entityNames)) violations.push({ kind: "total-mal-atribuido", detail: v });
  // 6 · orden SELLADO por la tool incumplido (requisito 4, pase quirúrgico 2026-07-29) — independiente de si la
  // narración prometió el orden EN TEXTO (eso ya lo cubre el chequeo 4 de arriba): si gridTable/tensionRead sellaron
  // un criterio real, la tabla/lista que lo muestra tiene que respetarlo, lo diga o no en palabras.
  if (sealedOrders) {
    const sealedViol = _sealedOrderBroken(narration, sealedOrders);
    if (sealedViol) violations.push({ kind: "orden-sellado-incumplido", detail: sealedViol });
  }
  // 7 · simulateGeneral degradado a SOLO-VENTAS (costModelAutorizado:false — el tenant no declaró su modelo de
  // costo, #56 "simulate v2") → la narración JAMÁS puede concluir "conviene"/"no conviene": sin costo/margen/
  // contribución autorizados no hay forma real de evaluar impacto, solo el efecto en ventas. BLOQUEA (tan grave
  // como una cifra inventada — es una conclusión que el dato no respalda), determinístico, no delegado al prompt.
  const simConclusion = _simulateGeneralConclusionViolation(narration, results);
  if (simConclusion) violations.push({ kind: "simulacion-sin-costo-concluye", detail: simConclusion });
  // 8 · placeholder literal sin rellenar ("$X", "$Y"…) — owner 2026-07-31, hallazgo en vivo: sin este chequeo, un
  // texto roto con placeholders pasaba el guard entero (0 violations, nada numérico que comparar) y llegaba tal
  // cual al usuario final. Tan grave como una cifra inventada — BLOQUEA.
  const placeholder = _placeholderSinRellenar(narration);
  if (placeholder) violations.push({ kind: "placeholder-sin-rellenar", detail: placeholder });
  // 9 · BINDING DE MÉTRICA (CONTRATO v2 · Fase 2, owner 2026-08-07) — cifra REAL narrada bajo la métrica
  // equivocada. Hasta acá el canon `unit:value` no ataba la etiqueta, así que este error pasaba entero. BLOQUEA:
  // el valor es verdad pero la afirmación es falsa, que para un asesor es igual de grave que inventar el número.
  for (const v of _metricBindingViolations(narration, ledger)) violations.push({ kind: "metrica-mal-atribuida", detail: v });
  // 10 · ATRIBUCIÓN DE ENTIDAD promovida de aviso a BLOQUEO (CONTRATO v2 · Fase 2). El cómputo es el MISMO que ya
  // existía como advisory desde 2026-07-28 (criterio nítido: una sola entidad cerca, no es la dueña, y la dueña
  // real no aparece en NINGUNA parte del texto) — no se amplía el criterio, solo se cambia la consecuencia. Ese
  // criterio ya venía calibrado en producción justamente para no marcar prosa legítima.
  for (const v of _attributionViolations(narration, ledger, entityNames)) violations.push({ kind: "entidad-mal-atribuida", detail: v });
  // 11 · PERÍODO CONTRADICTORIO (CONTRATO v2 · Fase 2) — ensurePeriodoDeclared solo AGREGA la cláusula si falta;
  // nunca validó. Una narración que afirma otro alcance temporal quedaba con dos períodos contradictorios. Acá
  // BLOQUEA. Sigue SIN exigir que el narrador declare el período (eso disparaba ~33% de fallbacks, ver arriba):
  // se juzga solo la contradicción explícita, nunca la omisión.
  const periodoViol = _periodoContradictorio(narration, periodosEsperados(results));
  if (periodoViol) violations.push({ kind: "periodo-contradictorio", detail: periodoViol });
  // 12-15 · PROPORCIONALIDAD SEMÁNTICA (owner 2026-08-07) — los cuatro límites que la regla exige conservar.
  // Los claims se derivan de la MISMA boleta que ya validó todo lo de arriba (una verdad, sin dato nuevo): el
  // sello vive en narrationContract.buildClaims y acá solo se lee. Si el turno no trae boleta, no hay nada que
  // juzgar y los cuatro salen vacíos solos.
  const claimsPS = buildClaims(figs);
  for (const v of _sujetoGeneralizado(narration, claimsPS)) violations.push({ kind: "sujeto-generalizado", detail: v });
  const procViol = _procedenciaNoAutorizada(narration, claimsPS);
  if (procViol) violations.push({ kind: "procedencia-no-autorizada", detail: procViol });
  const nivelViol = _nivelNoAutorizado(narration, claimsPS);
  if (nivelViol) violations.push({ kind: "nivel-financiero-no-autorizado", detail: nivelViol });
  for (const v of _causaSobredimensionada(narration, claimsPS)) violations.push({ kind: "causa-sobredimensionada", detail: v });

  // ── AVISOS (NO bloquean · owner 2026-07-28 "el muro solo corrobora que no invente una cifra y que sea del dato") ──
  // La graduación de supuestos sigue siendo aviso (ver Fase 2 residual en la memoria del proyecto). La atribución
  // de entidad DEJÓ de ser aviso: subió a bloqueo en el chequeo 10 de arriba.
  const advisories = [];
  const grad = _graduationViolation(narration, trace);
  if (grad) advisories.push({ kind: "graduacion", detail: grad });
  // mecanismo dominante vs acción (turno 9, AVISO — coherencia semántica, no cifra, ver comentario arriba)
  const mechRows = extractMechanismRows(results);
  for (const v of _mechanismAdvisory(narration, mechRows)) advisories.push({ kind: "mecanismo-inconsistente", detail: v });
  // mecanismo con memoria ENTRE turnos (residual 3, mismo día — AVISO por la misma razón)
  for (const v of _mechanismMemoryAdvisory(narration, mechanismMemory, mechRows)) advisories.push({ kind: "mecanismo-memoria-inconsistente", detail: v });
  // repetición contra narraciones propias recientes (Fase 3, owner 2026-07-30 — AVISO, nunca bloquea)
  for (const v of _repetitionAdvisory(narration, recentNarrations)) advisories.push({ kind: "repeticion", detail: v });
  // repetición VERBATIM (owner 2026-08-03 — AVISO también, NUNCA entra a violations/ok, ver el comentario grande
  // junto a _repetitionVerbatim) — además de registrarse como aviso, alimenta `degraded` (campo separado, más abajo).
  const verbatimRepeats = _repetitionVerbatim(narration, recentNarrations);
  for (const v of verbatimRepeats) advisories.push({ kind: "repeticion-verbatim", detail: v });
  // orden acción-tabla en mode=decision (owner 2026-08-03 — ver _decisionOpensWithTable arriba): AVISO + alimenta
  // `degraded` (mismo canal que repetición verbatim), NUNCA `violations`/`ok`.
  const decisionTableFirst = _decisionOpensWithTable(narration, mode);
  if (decisionTableFirst) advisories.push({ kind: "orden-decision-tabla-primero", detail: "la tabla abre la respuesta en mode=decision — el contrato exige la frase de acción primero" });
  // clarify NUNCA lleva tabla, en ningún nivel_aclaracion (owner 2026-08-03 — ver _clarifyHasTable arriba).
  const clarifyHasTable = _clarifyHasTable(narration, mode);
  if (clarifyHasTable) advisories.push({ kind: "clarify-con-tabla", detail: "el contrato de clarify prohíbe tablas en cualquier nivel_aclaracion — como mucho 1 cifra (nivel 1) o cero (nivel 2+)" });
  // serie temporal sin % de variación (owner 2026-08-05 — ver _temporalMissingVariation arriba): AVISO + alimenta
  // `degraded`, NUNCA `violations`/`ok` — misma familia que decision-tabla-primero/clarify-con-tabla.
  const temporalMissingVariation = _temporalMissingVariation(narration, results);
  if (temporalMissingVariation) advisories.push({ kind: "temporal-sin-variacion", detail: "corrió trend pero la narración no cita ningún % de variación (mejor/peor mes vs año anterior o presupuesto)" });

  const ok = violations.length === 0;   // solo cifra/conteo/entidad BLOQUEAN
  // degraded (owner 2026-08-03): NUNCA afecta `ok`/`violations` — ver el comentario junto a _repetitionVerbatim.
  // Solo es true cuando `ok` YA es true (una respuesta con violations reales no necesita una señal aparte: ya se
  // reintenta por otro motivo) Y se detectó (a) un tramo verbatim de 8+ palabras contra una narración propia
  // reciente, (b) una tabla que abre la respuesta en mode=decision, (c) CUALQUIER tabla en mode=clarify, o (d) una
  // serie temporal sin ningún % de variación citado (ver los 4 detectores arriba).
  const degraded = ok && (verbatimRepeats.length > 0 || decisionTableFirst || clarifyHasTable || temporalMissingVariation);
  return { ok, verdict: ok ? "fiel" : violations[0].kind, violations, advisories, degraded };
}
