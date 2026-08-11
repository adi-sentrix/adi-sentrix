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
import { buildClaims, cifrasDelUsuario } from "./narrationContract.js";   // Proporcionalidad Semántica: el guard lee el MISMO sello que el narrador · v1.2: y la MISMA definición de "cifra del usuario" que el renderer
import { reconcilian, UNIVERSOS } from "../../config/contract/figureType.js";   // decisiones 1 y 11: el TIPO de la cifra y qué reconcilia con qué

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
//
// ESTA TABLA ES DE RECONOCIMIENTO, NO DE EMISIÓN (certificación 2026-08-09, preguntas 1 y 4). No decide cómo se
// LLAMA una métrica en pantalla —eso lo fijan el glosario y el registro de métricas—, decide qué PALABRAS, dichas
// por el producto o por el usuario, nombran cuál. Una palabra que falta acá no calla el chequeo: lo INVIERTE,
// porque la ventana queda con UNA sola métrica reconocida y la cifra correcta se marca como mal atribuida. Los
// dos huecos de abajo se midieron sobre el ledger real de `entityRecord{sku:"SAM-TV55"}`, y los dos bloqueaban
// la respuesta HONESTA mientras dejaban pasar la desactualizada:
//
//   · «stock» · el producto etiqueta con esa palabra ("Unidades en stock", "Stock valorizado") y el usuario
//     pregunta con ella ("¿cuánto stock tiene?"). Sin declararla, «Su stock a hoy es de $13K, 18 unidades»
//     rebotaba —la única métrica de la ventana era `unidades`, y $13K es capital— mientras la MISMA frase con
//     «inventario» pasaba. La respuesta correcta a la pregunta del owner era inalcanzable por una palabra.
//   · «días de inventario» · es el nombre CANÓNICO de la métrica en pantalla (glossary.doh: «En pantalla se llama
//     "Días de inventario"»), y acá sólo estaba el retirado. Peor que un hueco: la palabra «inventario» lo hacía
//     caer en `capital`, así que «SAM-TV55 tiene 58d de días de inventario» rebotaba ("narrado como capital, pero
//     pertenece a cobertura") y «58d de cobertura» —el sinónimo que el owner retiró justo por ambiguo— pasaba. El
//     muro premiaba la palabra vieja y castigaba la vigente.
// Declarar las dos NO endurece el chequeo: las dos ventanas pasan de 1 métrica a 2 y caen en la rama "ambiguo →
// no se juzga" que este mismo bloque fija como criterio (falso negativo antes que falso positivo).
const _METRIC_VOCAB = [
  { clave: "ventas",       re: /\bventas?\b|\bvend[eióa]\w*\b|\bfactur\w+\b/i },
  { clave: "margen",       re: /\bm[aá]rgen(?:es)?\b/i },
  { clave: "contribucion", re: /\bcontribuci[oó]n\b|\bcontribuy\w+\b/i },
  { clave: "costo",        re: /\bcostos?\b/i },
  { clave: "carga",        re: /\bcarga comercial\b|\bacciones comerciales\b|\brebates?\b|\bdescuentos?\b/i },
  { clave: "capital",      re: /\bcapital\b|(?<!d[ií]as\s{1,3}(?:de\s{1,3})?)\binventario\b|\bstocks?\b/i },
  { clave: "rotacion",     re: /\brotaci[oó]n\b/i },
  { clave: "cobertura",    re: /\bcobertura\b|\bDOH\b|\bd[ií]as\s+(?:de\s+)?inventario\b|\bd[ií]as\s+inv\b/i },
  { clave: "unidades",     re: /\bunidades\b/i },
  { clave: "ticket",       re: /\bticket\b/i },
  // «resultado» · EL PELDAÑO DEL P&L, no la palabra suelta (certificación 2026-08-09, pregunta 14). Medido sobre el
  // ledger real de `pnlRead` —que autoriza «Resultado comercial $18.5M» Y «Contribución $25.0M» en la MISMA
  // boleta—: la frase «El resultado del negocio después de gastos es $25.0M» pasaba el muro con ok=true. La cifra
  // es REAL y la afirmación es FALSA: contesta con la contribución la pregunta por el resultado, que es
  // exactamente la confusión que la tool `pnlRead` existe para cerrar (decisión 3). El muro no la veía porque
  // «resultado» no era vocabulario de ninguna métrica: la ventana quedaba con CERO métricas reconocidas y caía en
  // la rama "sin señal → no se juzga".
  // POR QUÉ CALIFICADO Y NO `\bresultado\b` A SECAS: en español «el resultado de bajar Logística a 2%» o «como
  // resultado» son la palabra en su sentido genérico, y reconocerlas marcaría prosa legítima cuya cifra pertenece
  // a otra métrica. Sólo se reconoce el nivel financiero nombrado como tal — que es como lo nombran la pregunta
  // del usuario, el catálogo de `pnlRead` y la etiqueta de la boleta («Resultado comercial»).
  { clave: "resultado",    re: /\bresultado\s+(?:del negocio|comercial|final|neto|operacional|del ejercicio)\b|\bestado de resultados\b|\bganancia neta\b|\butilidad(?:es)?\s+(?:neta|del negocio|del ejercicio|operacional)\b|\bdespu[eé]s de (?:los )?gastos\b/i },
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
// «aporta» y «contribuye» son verbos de equivalencia igual que «representa» o «genera», y faltaban (certificación
// 2026-08-09, pregunta 15). El hueco no era teórico: son LOS dos verbos con que se contesta «¿cuánto contribuye
// Falabella?», así que el muro estaba ciego exactamente en la frase que esa pregunta invita. Medido sobre el ledger
// real de la contribución por cliente —13 cuentas más «Contribución total $25.0M»—: «Falabella contribuye $25.0M»
// pasaba con ok=true, el total del negocio colgado de una sola cuenta con una cifra verdadera. Mismo defecto que
// este chequeo cierra desde 2026-07-28, en otro verbo.
const _CLAIM_VERB = /\b(representa(?:n|ndo)?|explica(?:n|ndo)?|genera(?:n|ndo)?|aport(?:a|an|ando)|contribuy(?:e|en|endo)|recuperar(?:\s+con)?|recuperando(?:\s+con)?|recuperaci[oó]n|resulta(?:n)?\s+en|suman|totalizan|concentrad[ao]s?\s+en|atribuibles?\s+a|(?:principal(?:es)?\s+)?responsables?\s+de|proviene[n]?\s+de|se\s+debe[n]?\s+a)\b/i;
// excepción EXPLÍCITA del spec (b): si el propio texto ya escala la cifra al grupo/total ("parte de", "porción de",
// "del total de"), no es una mala atribución aunque un verbo de la lista esté cerca — es EXACTAMENTE el framing correcto
// que le pedimos al narrador (narratePromptC.js: "TOTAL DEL NEGOCIO ≠ SUMA DE LOS QUE NOMBRÁS"). Antes esto "pasaba"
// solo por casualidad de vocabulario/distancia — ahora se reconoce por diseño, no por accidente.
// La excepción cubre además el total usado como DENOMINADOR: «$4.3M sobre un total de $25.0M», «contra el total
// de la cartera». Es la forma prepositiva, y sólo esa — NO basta con que la palabra "total" esté cerca. La
// diferencia importa y se midió: «Lider y Falabella representan una brecha TOTAL DE $4.9M» también dice "total
// de", y es justamente el defecto que este chequeo existe para bloquear (el total ES la cifra atribuida, no la
// referencia contra la que se la mide). Una excepción por la sola palabra "total" desarmaba dos casos MALOS del
// gate de totales; la prepositiva no toca ninguno.
const _PART_OF_EXCEPTION = /\b(parte|porci[oó]n|fracci[oó]n)\s+(?:de|del)\b|\b(?:sobre|de|contra|frente\s+a)\s+(?:un|el|los)\s+total(?:es)?\s+(?:de|del)\b/i;
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
//
// EL SEGUNDO HUECO, ESTRUCTURAL (owner 2026-08-09, hallazgo G): el filtro era `sujetoTipo === "entidad"`, y ese
// campo depende de que el LABEL venga con el separador " · ". Cuando el ledger etiquetaba con el nombre PELADO
// —11 claims de marginRead, 9 de salesRead— el claim salía `sujetoTipo: "negocio"` y este chequeo se lo saltaba:
// era ciego EXACTAMENTE en el caso que existe para atrapar. Medido antes del arreglo: «Tu negocio cerró el año en
// $19.4M» (siendo $19.4M de Falabella) pasaba con ok=true, verdict "fiel".
// Ahora el dueño se resuelve con `_duenoDelClaim`, que NO depende del parseo del label: si el label nombra una de
// las entidades REALES del turno (misma fuente tenant-safe que ya usan los chequeos 3/5/10), esa es la dueña.
// Un label sin entidad reconocible sigue sin juzgarse — un concepto ("Capital inmovilizado · total") no tiene dueña
// que ocultar, y marcarlo sería el falso positivo que este criterio nítido evita desde el principio.
function _duenoDelClaim(c, entityNames) {
  if (c.sujetoTipo === "entidad" && c.entidad) return c.entidad;
  const lbl = String((c && c.etiqueta) || "");
  if (!lbl) return null;
  const owners = _figEntityOwners(lbl, entityNames || []);
  return owners.length === 1 ? owners[0] : null;   // dos entidades en el mismo label → ambiguo, no se juzga
}
function _sujetoGeneralizado(narration, claims, entityNames = []) {
  const out = [];
  const text = String(narration || "");
  const masked = _maskFigures(text);
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const textoNorm = norm(text);
  for (const c of claims) {
    if (!c || !c.valor) continue;
    const dueno = _duenoDelClaim(c, entityNames);
    if (!dueno) continue;
    if (textoNorm.includes(norm(dueno))) continue;   // la dueña está nombrada: no hay generalización
    let idx = -1;
    while ((idx = text.indexOf(c.valor, idx + 1)) >= 0) {
      const [lo, hi] = _localWindow(masked, idx, 90);
      const ventana = text.slice(lo, hi);
      if (!_SUJETO_NEGOCIO.test(ventana) && !_EXPANSION.test(ventana)) continue;
      // si en la misma ventana aparece OTRA entidad, el caso es ambiguo → no se juzga (criterio nítido)
      const otras = (entityNames || []).filter((n) => n !== dueno && norm(ventana).includes(norm(n)));
      if (otras.length) continue;
      out.push(`"${c.valor}" es de ${dueno} (${c.eje || "entidad"}) pero se narra como si fuera del negocio, sin nombrarla: "${ventana.trim().slice(0, 110)}"`);
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

// ══ 17 · CRUCE DE UNIVERSOS QUE NO RECONCILIAN (owner 2026-08-09, decisiones 1 y 11) ═══════════════════════════
// EL CASO, TEXTUAL: «SAM-TV55 factura $13.3M y sostiene ese volumen con $13K de inventario: menos de un día de
// cobertura». Las DOS cifras son reales y las dos están autorizadas: $13.3M es la venta del SKU (skusMargen.venta,
// almacenada en MILES) y $13K su stock (skuInventario.stockUSD, en dólares CRUDOS). El muro numérico no tenía nada
// que objetar —canon `money:$13.3M` y `money:$13K`, ambos en el ledger— y la oración pasaba con ok=true. La mentira
// no está en ningún número: está en la RELACIÓN, porque los dos números viven en universos separados por ×1000 de
// escala (y por unidades del mismo SKU que difieren 4x–35x entre las dos fuentes). Dividir uno por otro no da
// cobertura: da basura, y esa basura sonaba a insight.
//
// QUÉ HACE. Cada cifra del ledger declara su `tipo.universo` (boleta.js + config/contract/figureType.js) y el
// contrato declara qué universo reconcilia con cuál y por qué (DIVERGENCIAS). Acá se juzga una sola cosa: dos
// cifras de universos DECLARADAMENTE divergentes, atadas por una construcción RELACIONAL, dentro de la MISMA
// oración. BLOQUEA — es la clase de afirmación que cambia la decisión del que lee.
//
// POR QUÉ EXIGE LA CONSTRUCCIÓN RELACIONAL, y no basta con la coexistencia: el propio motor emite listas donde las
// dos cifras conviven sin relacionarse ("• SAM-TV55: vende $13.3M — stock 18 unidades ($13K), 58 días de
// inventario"). Esa enumeración es texto SELLADO del composer; bloquearla dejaría inservible toda narración de
// `inventoryStatus{top_sellers}` sin corregir ninguna afirmación falsa. Mismo criterio nítido que el resto de la
// Fase 2: falso negativo antes que falso positivo.
//
// LA PARTE-DE-UN-TODO ES LA MISMA DIVISIÓN (certificación 2026-08-09, pregunta 1). La lista ya traía «proporción»
// y «ratio», pero no las formas con que esa misma cuenta se dice en prosa —«es una FRACCIÓN de su venta», «el
// stock DIVIDIDO por la venta», «es un MÚLTIPLO de»—, y son el cociente exacto que el contrato declara imposible
// entre estos dos universos. Se midió que faltaban: «SAM-TV55 vende $13.3M y tiene $13K inmovilizados, o sea que
// el stock es una fracción de su venta» no la marcaba ESTE chequeo sino el 9 (binding de métrica), y sólo por un
// accidente de vocabulario —la ventana de «$13K» tenía «venta» como única métrica reconocida porque «stock» no
// estaba declarada—. Un bloqueo que depende de que otra tabla esté incompleta no es una garantía: al completar esa
// tabla (ver el chequeo 9) la oración pasaba entera. Ahora la caza el chequeo que le corresponde, y con el
// veredicto correcto: `cruce-de-universos` explica QUÉ está mal (miles contra dólares crudos), mientras que
// `metrica-mal-atribuida` decía que $13K "es capital y no ventas" — cierto, pero no es el error de la oración.
const _CRUCE_RELACIONAL = /\b(sostiene\w*|sosteniendo|soporta\w*|soportando|cubre\w*|cubriendo|alcanza para|apenas alcanza|por cada|equivale\w*|equivalente a|frente a|versus|vs\.?|comparad[oa]s? con|en relaci[oó]n (?:a|con)|respecto (?:a|de)|proporci[oó]n|ratio|fracci[oó]n|m[uú]ltiplo|dividid[oa]s?|dividi\w+|con (?:apenas|solo|s[oó]lo|tan solo)|menos de (?:un|una|\w+) d[ií]as? de (?:cobertura|inventario))\b/i;
// _oraciones(text) → [[lo,hi]] · límites calculados sobre el texto con las cifras ENMASCARADAS, para que el punto
// decimal de "$13.3M" no corte una oración en falso (mismo motivo y misma técnica que el chequeo 9).
function _oraciones(text) {
  const masked = _maskFigures(text);
  const out = [];
  let start = 0;
  for (let i = 0; i < masked.length; i++) {
    if (_SENT_END.test(masked[i])) { if (i + 1 > start) out.push([start, i + 1]); start = i + 1; }
  }
  if (start < masked.length) out.push([start, masked.length]);
  return out;
}
// canon → Set(universo). Un mismo valor puede pertenecer a más de un universo en el mismo turno (dos cifras
// distintas que se formatean igual): eso se conserva, y abajo sólo se marca cuando NINGUNA combinación reconcilia.
function _universeOwners(ledger) {
  const owners = new Map();
  for (const f of (ledger && ledger.figs) || []) {
    const u = f && f.tipo && f.tipo.universo;
    if (!u || !UNIVERSOS[u]) continue;
    if (!owners.has(f.canon)) owners.set(f.canon, new Set());
    owners.get(f.canon).add(u);
  }
  return owners;
}
function _cruceDeUniversos(narration, ledger) {
  const owners = _universeOwners(ledger);
  if (owners.size < 2) return [];
  const text = String(narration || "");
  const out = [];
  const vistos = new Set();
  for (const [lo, hi] of _oraciones(text)) {
    const oracion = text.slice(lo, hi);
    if (!_CRUCE_RELACIONAL.test(oracion)) continue;   // sin construcción que ATE las dos cifras → no se juzga
    const figs = parseFigures(oracion).filter((f) => owners.has(f.canon));
    for (let i = 0; i < figs.length; i++) for (let j = i + 1; j < figs.length; j++) {
      const a = figs[i], b = figs[j];
      if (a.canon === b.canon) continue;
      const ua = [...owners.get(a.canon)], ub = [...owners.get(b.canon)];
      // sólo se marca si TODAS las lecturas posibles del par divergen: si alguna combinación reconcilia, la
      // oración tiene una lectura honesta y no se juzga (mismo principio que la ambigüedad del chequeo 9).
      const veredictos = [];
      for (const x of ua) for (const y of ub) veredictos.push(reconcilian(x, y));
      if (!veredictos.length || !veredictos.every((v) => v.estado === "divergent")) continue;
      const clave = `${a.canon}|${b.canon}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      const A = UNIVERSOS[ua[0]], Bu = UNIVERSOS[ub[0]];
      out.push(`«${a.text}» (${A.etiqueta}) y «${b.text}» (${Bu.etiqueta}) se relacionan en la misma oración y NO reconcilian: ${veredictos[0].razon}`);
    }
  }
  return out;
}

// ── 16 · TABLA NO AUTORIZADA (divulgación progresiva · candado estructural, owner 2026-08-07) ──────────────────
// En una consulta GENERAL de perfil el detalle NO viajó: la serie mes a mes y la composición ni se calcularon.
// Tabular las cifras QUE QUEDAN sería reconstruir el detalle con menos información que la Ficha — peor que no
// darlo. Por eso `tableAllowed:false` no es una sugerencia del prompt: es una autorización del contrato, y acá
// se hace cumplir. NO depende de que el narrador obedezca.
// Se detectan las DOS formas de tabular, porque prohibir solo el markdown empuja a la lista con guiones:
//   · tabla markdown real (fila separadora |---|---|)
//   · listado tabular: 3+ líneas seguidas con forma "etiqueta: cifra" / "- etiqueta — cifra", que es una tabla
//     escrita con otra puntuación. Una enumeración en PROSA (una oración con comas) no cae: no son líneas.
const _SEP_MD = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;
const _FILA_TABULAR = /^\s*(?:[-*·]|\d+[.)])?\s*\*{0,2}[^:—|\n]{2,48}\*{0,2}\s*(?::|—|\|)\s*\S*\d/;
// ¿HAY tabla? Cuenta como tabla tanto la markdown real como el listado tabular — son la misma presentación con
// distinta puntuación, así que si el usuario pidió "tabla" cualquiera de las dos cumple.
function _tieneTabla(narration) {
  const lineas = String(narration || "").split("\n");
  if (lineas.some((l) => _SEP_MD.test(l))) return true;
  let racha = 0;
  for (const l of lineas) { if (_FILA_TABULAR.test(l)) { if (++racha >= 3) return true; } else if (l.trim()) racha = 0; }
  return false;
}
function _tablaNoAutorizada(narration) {
  const lineas = String(narration || "").split("\n");
  if (lineas.some((l) => _SEP_MD.test(l))) return "la respuesta arma una tabla markdown y este turno no la tiene autorizada";
  let racha = 0, max = 0;
  for (const l of lineas) {
    if (_FILA_TABULAR.test(l)) { racha++; max = Math.max(max, racha); } else if (!l.trim()) { /* la línea en blanco no corta */ } else racha = 0;
  }
  if (max >= 3) return `la respuesta arma un listado tabular (${max} filas "etiqueta: cifra" seguidas) y este turno no tiene tabla autorizada`;
  return null;
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
// `facts.periodos` MANDA sobre la frase (owner 2026-08-09, decisión 5): desde que el marco sale de la naturaleza
// de cada cifra, un resultado puede ser MIXTO (la fila completa de un SKU trae venta del año cerrado y stock de la
// foto de hoy) y leer eso con un regex sobre la frase se quedaría con UNA sola familia — la respuesta terminaría
// declarando un marco y callando el otro. El array es la declaración estructurada; la frase sigue como respaldo
// para cualquier composer que estampe su propio `periodo` sin pasar por `_stampPeriodo`.
export function periodosEsperados(results) {
  const set = new Set();
  for (const r of results || []) {
    const f = r && r.facts;
    if (!f) continue;
    if (Array.isArray(f.periodos) && f.periodos.length) { for (const x of f.periodos) if (_PERIODO_FAMILIAS[x]) set.add(x); continue; }
    const p = f.periodo || (f.marco_temporal && f.marco_temporal.periodo);
    if (p) { const fam = _familiaDePeriodo(p); if (fam) set.add(fam); }
  }
  return ["anual", "hoy"].filter((x) => set.has(x));
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

// ── 18 · TRANSFERENCIA NO EVALUABLE (owner 2026-08-09, decisión 13) ────────────────────────────────────────────
// EL DEFECTO QUE CIERRA. La respuesta natural a "tenés $25K detenidos en Valparaíso y $8K en Antofagasta" es
// "movelo a donde se vende". Ese movimiento NO se puede evaluar sobre este dato: ningún SKU aparece en más de una
// bodega, así que no hay dos colocaciones que comparar — el usuario no puede ejecutarlo y nosotros no podemos
// comprobarlo. Sentrix ya retiró la recomendación de sus tres superficies; ADI la seguía pudiendo decir, con
// cifras REALES y por eso invisible a todo el muro numérico. Misma familia que el chequeo 7
// (`simulacion-sin-costo-concluye`): la tool DECLARA su límite y la narración no puede concluir por encima de él.
//
// DISPARA SOLO SI LA TOOL LO DECLARÓ. `facts.limite_transferencia` lo pone `inventoryStatus` leyendo
// `transferenciaCapability` — la misma cuenta de Sentrix, sobre las filas del escenario activo. El día que un SKU
// esté en dos bodegas, la declaración desaparece y este chequeo se apaga solo: no hay ninguna regla escrita acá
// sobre cuántas bodegas tiene este tenant.
//
// CRITERIO NÍTIDO (mismo principio que el resto de la Fase 2 — falso negativo antes que falso positivo): hacen
// falta LAS TRES cosas en la MISMA oración: (a) un verbo de traslado, (b) el objeto trasladado (stock/inventario/
// capital/mercadería/unidades/SKU) y (c) que el traslado sea ENTRE UBICACIONES — la frase "entre bodegas" o dos
// bodegas distintas NOMBRADAS, tomadas del propio resultado (nunca de una lista fija). Y la oración NEGADA queda
// fuera: declinar bien es exactamente lo que se busca, así que "no puedo evaluar mover stock entre bodegas" tiene
// que pasar. "Rotar", "liquidar" y "bajar a lista" no son traslados y nunca caen.
const _TRASLADO_VERBO = /\b(transfer\w+|traslad\w+|reubic\w+|redistribu\w+|reasign\w+|mover|muev\w+|movi[eé]ndo\w*|mand[aá]\w*|env[ií]\w+|llev[aá]\w*)\b/i;
const _TRASLADO_OBJETO = /\b(stock|inventario|capital|mercader[ií]a|unidades|producto\w*|sku)\b/i;
const _TRASLADO_ENTRE = /\bentre\s+(bodegas?|sucursal\w*|locales?|centros?|dep[oó]sitos?)\b|\b(?:a|hacia)\s+(?:otra|otro)\s+(bodega|sucursal|local|dep[oó]sito)\b/i;
const _TRASLADO_NEGADO = /\bno\s+(?:puedo|podemos|se\s+puede|es\s+posible|permite|permiten|alcanza|hay\s+(?:forma|manera|c[oó]mo)|tengo\s+c[oó]mo)\b|\bimposible\b|\bsin\s+poder\b|\bno\s+es\s+evaluable\b|\bno\s+recomiendo\b|\bevitar\b/i;
// las bodegas del INVENTARIO COMPLETO, no las del foco que se está mirando: la recomendación mueve stock hacia una
// bodega que puede no estar en la respuesta (el foco "capital detenido" trae Valparaíso y Antofagasta, y la frase
// que hay que impedir dice "…a Santiago"). El catálogo viaja en la propia declaración de la tool, que lo saca de
// `transferenciaCapability` — nunca hay un nombre de tenant escrito acá.
function _bodegasDeclaradas(results) {
  const out = new Set();
  for (const r of results || []) {
    const lim = r && r.facts && r.facts.limite_transferencia;
    for (const b of (lim && lim.bodegasNombres) || []) if (b) out.add(String(b));
    const inv = r && r.facts && r.facts.inventory;
    for (const b of (inv && inv.byBodega) || []) if (b && b.bodega) out.add(String(b.bodega));
    for (const s of (inv && inv.bySku) || []) if (s && s.bodega) out.add(String(s.bodega));
  }
  return [...out];
}
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function _transferenciaNoEvaluable(narration, results) {
  const declarado = (results || []).some((r) => r && r.facts && r.facts.limite_transferencia && r.facts.limite_transferencia.evaluable === false);
  if (!declarado) return null;
  const text = String(narration || "");
  const bodegas = _bodegasDeclaradas(results);
  for (const [lo, hi] of _oraciones(text)) {
    const o = text.slice(lo, hi);
    if (_TRASLADO_NEGADO.test(o)) continue;                       // la declinación honesta NO se castiga
    if (!_TRASLADO_VERBO.test(o) || !_TRASLADO_OBJETO.test(o)) continue;
    const nombradas = bodegas.filter((b) => new RegExp(`\\b${_esc(b)}\\b`, "i").test(o));
    // dos ubicaciones nombradas · la frase "entre bodegas" · o una dirección explícita hacia UNA bodega real
    // ("…movelo a Santiago"): las tres son el mismo movimiento, y ninguna es evaluable sobre este dato.
    const direccion = bodegas.some((b) => new RegExp(`\\b(?:a|hacia|desde|hasta)\\s+(?:la\\s+(?:bodega|sucursal)\\s+(?:de\\s+)?)?${_esc(b)}\\b`, "i").test(o));
    if (!_TRASLADO_ENTRE.test(o) && nombradas.length < 2 && !direccion) continue;
    return `la respuesta propone mover stock entre bodegas («${o.trim().slice(0, 120)}») y ese movimiento NO es evaluable sobre este dato: cada SKU aparece en una sola bodega, así que no hay dos colocaciones que comparar`;
  }
  return null;
}

// ── 19 · TRANSFERENCIA PREGUNTADA Y NO CONTESTADA (owner 2026-08-10, certificación live · defecto C1) ──────────
// EL CHEQUEO 18 ES DE UNA SOLA CARA: impide PROPONER el traslado, pero no exige que la pregunta se CONTESTE. En la
// certificación, «¿puedo mover el stock lento de Valparaíso a Santiago?» se respondió con el diagnóstico del
// capital y la decisión quedó colgando. Este es el requisito simétrico —misma familia que `tabla-faltante`, que ya
// bloquea la AUSENCIA de algo pedido—: si el usuario preguntó por el traslado y la tool declaró su límite, la
// respuesta tiene que DECLARARLO.
//
// Y TIENE QUE DECLARARLO EN TÉRMINOS DE EVALUACIÓN. «No es posible mover el stock» afirma algo distinto —y más—
// de lo que el dato sostiene: mover stock puede ser perfectamente posible en la bodega real; lo que este dato no
// permite es COMPROBAR que convenga. Confundir "no evaluable" con "imposible" es la regla 2 de CLAUDE.md (no hay
// causalidad sin respaldo) del lado de la conclusión, así que la sola negación no alcanza para dar por contestada
// la pregunta. `ensureTransferenciaDeclarada` (narratePromptC.js) compone la declaración correcta ANTES de que
// esto corra — igual que `ensurePeriodoDeclared` con el chequeo de período: la doctrina la garantiza, el guard la
// vuelve contrato. DISPARA SOLO SI LA TOOL LO DECLARÓ: el día que un SKU esté en dos bodegas, se apaga solo.
const _TRASLADO_EVALUACION = /\b(evalu\w+|comprob\w+|verific\w+|compar\w+|contrast\w+|sostiene|respald\w+|no\s+alcanza|misma?\s+bodega|una\s+sola\s+bodega|dos\s+colocaciones)\b/i;
/** ¿El TURNO DEL USUARIO pregunta por mover stock entre ubicaciones? Mismo criterio nítido que el chequeo 18. */
export function preguntaPorTraslado(question, results) {
  const t = String(question || "");
  if (!_TRASLADO_VERBO.test(t) || !_TRASLADO_OBJETO.test(t)) return false;
  if (_TRASLADO_ENTRE.test(t)) return true;
  const bodegas = _bodegasDeclaradas(results);
  if (bodegas.filter((b) => new RegExp(`\\b${_esc(b)}\\b`, "i").test(t)).length >= 2) return true;
  return bodegas.some((b) => new RegExp(`\\b(?:a|hacia|hasta)\\s+(?:la\\s+(?:bodega|sucursal)\\s+(?:de\\s+)?)?${_esc(b)}\\b`, "i").test(t));
}
/** ¿La NARRACIÓN declara el límite, y lo declara como límite de evaluación (no como imposibilidad)? */
export function declaraLimiteTransferencia(narration) {
  const text = String(narration || "");
  for (const [lo, hi] of _oraciones(text)) {
    const o = text.slice(lo, hi);
    if (!_TRASLADO_VERBO.test(o) && !/\btransferencias?\b|\bredistribuci[oó]n\b/i.test(o)) continue;
    if (!_TRASLADO_NEGADO.test(o)) continue;
    if (_TRASLADO_EVALUACION.test(o)) return true;
  }
  return false;
}
/** El límite declarado por alguna tool de este turno (o null) — la ÚNICA fuente del texto que se compone. */
export function limiteTransferenciaDeclarado(results) {
  for (const r of results || []) {
    const lim = r && r.facts && r.facts.limite_transferencia;
    if (lim && lim.evaluable === false) return lim;
  }
  return null;
}
function _transferenciaSinDeclarar(narration, results, question) {
  if (!limiteTransferenciaDeclarado(results)) return null;
  if (!preguntaPorTraslado(question, results)) return null;
  if (declaraLimiteTransferencia(narration)) return null;
  return "el usuario preguntó por mover stock entre bodegas y la tool declaró que ese movimiento no es evaluable sobre este dato — la respuesta no lo declara, o lo declara como imposibilidad en vez de como límite de evaluación";
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

/* ══ REPARACIÓN CONTEXTUAL · Contrato Conversacional v1.2 (owner 2026-08-10) ═══════════════════════════════════
 * DOS candados nuevos, los dos deterministas y los dos del mismo tipo que el resto de este archivo: el prompt es
 * el mecanismo principal, esto es lo que hace que "no puede pasar" sea literalmente cierto.
 */

// §4.1 · LAS DOS CORRECCIONES SON DISTINTAS Y EL GUARD DEBE DISTINGUIRLAS.
// Una corrección RESUELTA (se sabe qué corregir) tiene que TRAER EL DATO CORREGIDO: contestar "entendido, era
// Lider" sin una sola cifra es un defecto, no una respuesta — el usuario corrigió justamente para ver el número
// bueno. Una corrección AMBIGUA es lo contrario: su respuesta válida es una pregunta SIN datos, y ni siquiera
// llega hasta acá (el motor corta antes del batch), así que este chequeo no puede confundirlas ni por accidente.
// Solo aplica cuando el turno TIENE cifras autorizadas: si las tools declinaron, exigir evidencia sería exigir
// lo que el dato no dio — ahí la respuesta honesta es declarar el límite, y eso ya lo gobierna HONESTIDAD.
function _correccionSinEvidencia(narration, reparacion, figs, results, contentScope, mode) {
  const r = reparacion && typeof reparacion === "object" ? reparacion : null;
  if (!r || r.tipo !== "correccion" || r.ambigua) return null;
  if (!Array.isArray(figs) || !figs.length) return null;
  // DOS CONTRATOS QUE PROHÍBEN CITAR CIFRAS GANAN SOBRE ESTE (owner 2026-08-10, revisión de la sección 8): bajo
  // `action_only` la respuesta es la acción sin porcentajes inventados, y `clarify` nivel 2+ exige CERO números.
  // Exigirles evidencia numérica los rebota los 3 intentos y termina volcando la tabla a alguien que pidió que le
  // expliquen más simple — el resultado opuesto al que los dos contratos buscan. Mismo criterio con que
  // ensureHypothesisFraming/ensureClarifyClosingQuestion ya se excluyen entre sí.
  if (contentScope === "action_only" || mode === "clarify") return null;
  // EVIDENCIA ES LA CIFRA DE ESTE TURNO, NO "UN NÚMERO" (defecto real). Contar `parseFigures` fallaba en las dos
  // direcciones: dejaba pasar una corrección que repetía la cifra de la entidad EQUIVOCADA —o el eco del propio
  // usuario— y bloqueaba una corrección legítima cuya respuesta no es numérica ("los clientes que caen son A, B y
  // C", "Lider no tiene ningún rebate vigente"). Ahora vale como evidencia una cifra sellada en la boleta DE ESTE
  // TURNO o el nombre de una entidad que este turno trajo: las dos son dato nuevo, que es lo que §4.1 pide.
  const canonBoleta = new Set(figs.map((f) => f.canon));
  if (parseFigures(narration).some((f) => canonBoleta.has(f.canon))) return null;
  const texto = String(narration || "");
  if (_entityNames(results || []).some((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(texto))) return null;
  return `corrección resuelta (${(Array.isArray(r.corrige) && r.corrige.length ? r.corrige.join("+") : "foco")}) narrada sin una sola cifra ni entidad de este turno, con ${figs.length} autorizadas en la boleta`;
}

// §5.1 · EL TERCER UNIVERSO. Una cifra que aportó el usuario NO es un dato del motor y NO es un invento: es una
// tercera clase, y la que más fácil se confunde porque "suena igual que las otras dos y no salió de ningún dato".
//
// ── POR QUÉ ESTO YA NO RECONOCE FRASES (owner 2026-08-10, segunda pasada de la seccion 8) ─────────────────────
// La primera versión exigía que la narración contuviera una de N formas de decir "esto es tuyo", una de N formas
// de consolidar, y una de N formas de decir "estimado". Tres listas cerradas, y las tres con el mismo defecto de
// raíz: **le pedían al narrador que cumpliera una obligación que es del producto**. Un narrador que escribía «la
// cifra que me pasaste» en vez de «tu dato» recibía un rechazo por una respuesta correcta —y se pagaba un
// reintento—; uno que consolidaba diciendo «el total queda en» pasaba limpio. Falsos positivos y falsos negativos
// a la vez, que es la firma de un candado que mira las palabras en vez de la estructura.
//
// LA GARANTÍA SE MUDÓ AL RENDERER. `markUserProvenance` (narratePromptC.js) estampa la procedencia sobre CADA
// aparición de una cifra del usuario y sobre cada cifra que la aritmética muestra derivada de ella — determinista,
// con NUESTRA marca, sin depender de cómo lo haya redactado el LLM. Es el mismo mecanismo que `gradeIndicatedClaims`
// ya usaba para el sello epistémico: la nota es del renderer, no del narrador.
//
// LO QUE QUEDA ACÁ ES LO QUE EL RENDERER NO PUEDE ARREGLAR, y es una sola cosa: que la cifra del usuario
// REEMPLACE al dato oficial. Estampar «tu dato» no repara una respuesta que dio su número como si fuera el del
// motor y nunca mostró el propio. La sección 5 lo dice literal: "No reemplaza el dato oficial: muestra la
// discrepancia". Se juzga comparando CLAIMS —métrica contra métrica— no vocabulario.

// _datoOficialReemplazado(narration, reparacion, figsMotor) → la cifra del usuario aparece narrada y el motor
// TIENE su propia cifra para esa misma métrica, con otro valor, y esa cifra oficial NO aparece por ningún lado.
// Cero vocabulario: la métrica sale de la etiqueta de la fig (la misma que ya usa el chequeo 9 para el binding) y
// la comparación es de canon contra canon.
function _datoOficialReemplazado(narration, reparacion, figsMotor) {
  const supFigs = cifrasDelUsuario(reparacion);
  if (!supFigs.length) return [];
  const texto = String(narration || "");
  const enTexto = new Set(parseFigures(texto).map((f) => f.canon));
  const motor = Array.isArray(figsMotor) ? figsMotor : [];
  const out = [];
  for (const s of supFigs) {
    if (!enTexto.has(s.canon)) continue;                       // no la narró: nada que juzgar
    const metricasUsuario = _metricasEn(s.label);
    // SIN MÉTRICA DECLARADA EL CANDADO NO SE APAGA (owner 2026-08-10, revisión de la sección 8). `metrica` la emite
    // el LLM en PLAN; si la omitía, esto hacía `continue` y el chequeo entero desaparecía en silencio — un candado
    // que se desarma porque el modelo no llenó un campo opcional no es un candado. Sin métrica se compara por
    // UNIDAD, que es más amplio pero nunca nulo: la pregunta sigue siendo "¿mostró también la cifra del motor?".
    const oficiales = motor.filter((f) => {
      if (f.canon === s.canon) return false;                    // coincide con la del usuario: no hay discrepancia
      if (f.unit !== s.unit) return false;
      if (!metricasUsuario.size) return true;
      const ms = _metricasEn(f.label);
      if (!ms.size) return true;                                // la etiqueta del motor no nombra métrica reconocible
      for (const m of metricasUsuario) if (ms.has(m)) return true;
      return false;
    });
    if (!oficiales.length) continue;                            // el motor no tiene cifra propia para eso
    if (oficiales.some((f) => enTexto.has(f.canon))) continue;  // la discrepancia SÍ está mostrada
    const que = metricasUsuario.size ? [...metricasUsuario].join("/") : "esa métrica";
    out.push(`«${s.text}» (del usuario) se narra como la cifra de ${que} sin mostrar la del motor (${oficiales.map((f) => f.value).join(", ")})`);
  }
  return out;
}

// _consolidaConElMotor(narration, reparacion, figsMotor) → §5.1, viñeta 2: "NUNCA se suma a un total sellado por
// el motor ni se mezcla en una cifra que el producto presente como propia".
// ES LA ÚNICA DE LAS TRES VIÑETAS QUE EL RENDERER NO PUEDE CONSTRUIR: estampar «estimado sobre tu supuesto» no
// des-consolida un total; un total que mezcla los dos universos sigue siendo lo que el contrato prohíbe, lleve o
// no la nota. Por eso esta sí bloquea, y por eso la viñeta 2 se juzga distinto de la 3 (la 3 se cumple marcando).
// CERO VOCABULARIO: no busca "suman" ni "en total" — busca la ARITMÉTICA. Una cifra narrada que equivale a
// usuario + motor es una consolidación, se llame como se llame; la RESTA no lo es (una discrepancia es
// exactamente eso, y el contrato pide mostrarla), así que solo se juzga la suma.
function _consolidaConElMotor(narration, reparacion, figsMotor) {
  const supFigs = cifrasDelUsuario(reparacion);
  if (!supFigs.length) return [];
  const motor = Array.isArray(figsMotor) ? figsMotor : [];
  if (!motor.length) return [];
  const canonUsuario = new Set(supFigs.map((f) => f.canon));
  const canonMotor = new Set(motor.map((f) => f.canon));
  const out = [];
  for (const f of parseFigures(narration)) {
    if (canonUsuario.has(f.canon) || canonMotor.has(f.canon)) continue;   // es una de las dos, no su mezcla
    if (!Number.isFinite(f.raw)) continue;
    const srcUnit = f.unit === "pp" ? "pct" : f.unit;
    const tol = f.unit === "money" ? Math.max(1000, Math.abs(f.raw) * 0.02) : (f.unit === "pct" || f.unit === "pp") ? 0.2 : f.unit === "ratio" ? 0.15 : f.unit === "days" ? 0.6 : 0.05;
    for (const s of supFigs) {
      if (s.unit !== srcUnit || !Number.isFinite(s.raw)) continue;
      const m = motor.find((x) => x.unit === srcUnit && Number.isFinite(x.raw) && Math.abs((s.raw + x.raw) - f.raw) <= tol);
      if (m) { out.push(`«${f.text}» consolida la cifra del usuario («${s.text}») con una sellada por el motor («${m.value}») en un solo total`); break; }
    }
  }
  return out;
}

// _derivadaDeSupuesto(fig, supFigs, figsMotor) → true si la cifra narrada solo se explica combinando (suma o
// resta) un supuesto DEL USUARIO con otra cifra. Misma aritmética y misma tolerancia que _isCalc —no se inventa
// una segunda—, pero con un requisito extra: al menos uno de los dos operandos tiene que ser del usuario. Sin esa
// restricción esto marcaría cualquier cálculo legítimo entre dos cifras del motor.
// EXPORTADA porque el renderer la necesita para saber QUÉ estampar: la definición de "esta cifra sale del supuesto
// del usuario" tiene que ser una sola, o el guard autoriza una cosa y el producto marca otra.
export function _derivadaDeSupuesto(fig, supFigs, figsMotor) {
  const raw = fig && fig.raw, unit = fig && fig.unit;
  if (!Number.isFinite(raw)) return false;
  const srcUnit = unit === "pp" ? "pct" : unit;
  const tol = unit === "money" ? Math.max(1000, Math.abs(raw) * 0.02) : (unit === "pct" || unit === "pp") ? 0.2 : unit === "ratio" ? 0.15 : unit === "days" ? 0.6 : 0.05;
  const sup = supFigs.filter((f) => f.unit === srcUnit && Number.isFinite(f.raw)).map((f) => f.raw);
  if (!sup.length) return false;
  const otros = [...sup, ...(figsMotor || []).filter((f) => f.unit === srcUnit && Number.isFinite(f.raw)).map((f) => f.raw)];
  for (const a of sup) for (const b of otros) {
    if (Math.abs((a + b) - raw) <= tol) return true;
    if (Math.abs((a - b) - raw) <= tol) return true;
    if (Math.abs((b - a) - raw) <= tol) return true;
  }
  return false;
}

/* ══ 23-25 · LA RESPUESTA SE JUZGA COMO SISTEMA (owner 2026-08-11 · defectos D5 y D6) ═══════════════════════════
 * EL HUECO, EN UNA FRASE: hasta acá el muro validaba cada cifra AISLADA —contra la boleta (chequeo 1), contra su
 * métrica (9), contra su entidad (10), contra su universo (17)— y la TABLA sólo por EXISTENCIA (16: `_tieneTabla`
 * devuelve un booleano y jamás lee una celda). Ninguno de los ~31 kinds relacionaba DOS cifras de la MISMA
 * respuesta. Por eso estas tres afirmaciones salían con `ok:true`, `verdict:"fiel"`, `violations:[]`:
 *   · «| Feb **← más bajo** | — | $6.0M | — |» — marca el extremo sobre una celda VACÍA de la serie principal.
 *   · «| **Total** | **$100.0M** |» sobre filas que suman $93.5M, sin declarar que el total cubre más de lo visible.
 *   · «la contribución no capturada TOTAL asciende a $4.9M» citando la fig «Contribución no capturada · subtotal».
 * Las tres tienen la misma forma: cada número es VERDAD y la afirmación que los relaciona es FALSA. Es la clase
 * que los chequeos 17 y 21 ya bloquean por otra vía ("el número es verdad y la oración miente"), así que estos
 * BLOQUEAN por la misma razón y no degradan: una marca de extremo o un total mal puesto cambian la decisión de
 * quien lee, y el reintento (o la reparación desde la boleta) sí puede resolverlos.
 *
 * NO ES UN CHEQUEO DE TABLA. El árbitro del diagnóstico midió el mismo defecto en PROSA PURA («el mejor margen lo
 * tiene Falabella con 22%, por delante de Lider 21.5% y de Jumbo 24%» → ok:true) y con `tablePolicy:"auto"`. Por eso
 * el chequeo 23 corre en las DOS estructuras —filas de tabla y oración— igual que `_orderViolation` ya cae de la
 * tabla a la lista numerada, y ninguno de los tres mira `tablePolicy`: la política decide la FORMA, esto juzga la
 * AFIRMACIÓN.
 *
 * CRITERIO NÍTIDO, el mismo de toda la Fase 2 (falso negativo antes que falso positivo): si la afirmación tiene
 * UNA lectura honesta sobre lo que la respuesta muestra, no se juzga. Un extremo cuya marca nombra una magnitud
 * que la tabla no trae («← mayor caída mensual», que es un delta entre filas) se saltea entero; un total sobre una
 * columna NO aditiva (%, días, rotación) no se suma nunca —sumarlos es el error opuesto—; un subtotal cuyo canon
 * también pertenece a un total declarado en la misma boleta queda ambiguo y pasa.
 *
 * ── SEGUNDA PASADA (2026-08-11, mismo día) · POR QUÉ ESTE BLOQUE SE REESCRIBIÓ ─────────────────────────────────
 * La primera versión BLOQUEABA RESPUESTAS CORRECTAS. Un revisor adversarial midió cuatro falsos positivos y un
 * interruptor global, y en este repo un `ok:false` quema los 3 intentos del narrador y cae a `composeFromLedger`
 * (la tabla pelada): romper un turno que funcionaba es peor que no atrapar el que falla. Los cinco están cerrados
 * y cada corrección lleva su comentario donde vive. `_extremo_y_total_sin_falsos_positivos_gate.mjs` los fija, con
 * una batería de 20 respuestas CORRECTAS —seis métricas de la familia menos-es-mejor, cuatro de más-es-mejor,
 * listas, conteos y prosa— que no se pueden bloquear.
 *
 * LÍMITES DECLARADOS, que se dejan ABIERTOS a propósito (un límite declarado vale más que un verde apretado):
 *   a) TABLA DE MENOS DE 3 FILAS · `t.rows.length < 3` sigue matando los dos chequeos. Bajarlo a 2 abre justo la
 *      forma del P&L —«| Venta | $10.0M | / | Costo | $6.0M | / | Total | $4.0M |»— donde la fila final es una
 *      RESTA y no una suma, y marcarla sería inventar una violación sobre una tabla correcta.
 *   b) LA CONTRADICCIÓN DE A DOS EN PROSA · el chequeo exige 3+ entidades del turno nombradas en el párrafo. Con
 *      dos («el mejor margen lo tiene Falabella con 22%, por delante de Jumbo con 24%») no se marca: bajar el
 *      umbral a 2 hace competir una cifra de la misma métrica en OTRO período («el año pasado llegó a 28%») con la
 *      del turno, que es un falso positivo peor que el hueco.
 *   c) SIN `results` NO HAY PROSA · `entityNames` sale de las tools; un turno que llega con `results:[]` no puede
 *      juzgar un superlativo en prosa. Es la misma dependencia que ya tienen los chequeos 3 y 10.
 *   d) EL ALCANCE POR SUFIJO (chequeo 25) sólo reconoce «· subtotal», «· parcial» y «· top N». Una etiqueta que
 *      nombra el recorte con otras palabras («· 5 cuentas materiales») no se lee como subtotal. Ampliar ese
 *      vocabulario es del emisor (specRetrieval/boleta), no del muro.
 *   e) UN TOTAL DE CONTEO MENOR que la suma de las partes NUNCA se marca: contar entidades distintas a lo largo de
 *      una dimensión de-duplica y ese total menor es correcto.
 */

// ── PARSER DE TABLA(S) CON FILA TOTAL · DELIBERADAMENTE APARTE DE `_tableRowsOrder` ────────────────────────────
// `_tableRowsOrder` (arriba) DESCARTA la fila Total por construcción, y sus dos consumidores (`_orderViolation`,
// `_sealedOrderBroken`) dependen de eso: si el Total entrara a `rows`, TODA tabla que cierre con total rompería la
// monotonía y se marcaría «orden roto». Por eso acá hay un segundo parser que devuelve el Total en un campo
// SEPARADO en vez de tocar el primero — cero superficie de regresión sobre los chequeos 4 y 6.
//
// DEVUELVE UNA LISTA, NO UNA TABLA (corrección 2026-08-11, falso positivo medido): la versión anterior tomaba el
// PRIMER separador del texto entero y metía en `cuerpo` todo lo que venía después — header, separador y filas de la
// SEGUNDA tabla incluidos. Con dos tablas CORRECTAS en una misma respuesta (venta por canal sin total + capital por
// bodega con un Total que SÍ cierra) eso fabricaba una violación inexistente Y le ponía el nombre de la columna
// equivocada. Ahora se agrupan las líneas contiguas que contienen "|", y dentro de cada grupo cada separador abre
// una tabla nueva que termina donde empieza el header de la siguiente. Cada tabla se juzga contra SUS filas.
//
// LA FILA TOTAL ES LA ÚLTIMA, O NO ES UNA FILA TOTAL (corrección 2026-08-11, falso positivo medido). `_ES_FILA_TOTAL`
// es un test de VOCABULARIO sobre la celda 0, y un KPI cuyo primer renglón EMPIEZA con «Total» no es una
// reconciliación: «| Total de clientes | 500 | / | Activos | 320 | / | Nuevos | 45 | / | En riesgo | 60 |» es un
// indicador con su desglose de subconjuntos SOLAPADOS debajo — 320+45+60 no tiene por qué dar 500, y exigirlo
// bloqueaba una tabla CORRECTA (PRE ok=true → POST ok=false). Una fila que de verdad reconcilia CIERRA la tabla:
// viene después de las partes que suma. Por eso `total` sólo se llena cuando la fila del vocabulario es la ÚLTIMA
// del cuerpo. `rows` sigue excluyendo TODA fila que empiece con «total» —ahí la exclusión es conservadora: nunca
// conviene que un total compita como parte en el chequeo 23.
const _SEP_FILA = /^\|?[\s:|-]*-[\s:|-]*\|?$/;
const _ES_FILA_TOTAL = (celda) => /^total\b/i.test(String(celda || "").replace(/\*/g, "").trim());
const _celdasDe = (l) => { let s = l; if (s.startsWith("|")) s = s.slice(1); if (s.endsWith("|")) s = s.slice(0, -1); return s.split("|").map((c) => c.trim()); };
function _tablasConTotal(text) {
  const rawLines = String(text || "").split("\n");
  const bloques = [];
  let cur = null;
  for (let i = 0; i < rawLines.length; i++) {
    const l = rawLines[i].trim();
    if (l.includes("|")) { if (!cur) { cur = { lines: [], idx: [] }; bloques.push(cur); } cur.lines.push(l); cur.idx.push(i); }
    else cur = null;
  }
  const out = [];
  for (const b of bloques) {
    const seps = [];
    for (let k = 0; k < b.lines.length; k++) if (_SEP_FILA.test(b.lines[k])) seps.push(k);
    for (let k = 0; k < seps.length; k++) {
      const s = seps[k];
      if (s < 1) continue;
      const fin = k + 1 < seps.length ? Math.max(s + 1, seps[k + 1] - 1) : b.lines.length;
      const cuerpo = b.lines.slice(s + 1, fin).filter((l) => !_SEP_FILA.test(l)).map(_celdasDe);
      if (!cuerpo.length) continue;
      out.push({
        header: _celdasDe(b.lines[s - 1]),
        rows: cuerpo.filter((r) => !_ES_FILA_TOTAL(r[0])),
        total: _ES_FILA_TOTAL(cuerpo[cuerpo.length - 1][0]) ? cuerpo[cuerpo.length - 1] : null,
        lineaIni: b.idx[s - 1],
        lineaFin: b.idx[Math.min(fin, b.idx.length) - 1],
        texto: b.lines.slice(s - 1, fin).join("\n"),
      });
    }
  }
  return out;
}
// la primera cifra de una celda · «—», «n/d» y la celda vacía devuelven null (que es justamente el agujero que el
// chequeo 23 tiene que VER: hoy `_seqFromTableOrder` lo saltea en silencio y cuenta como "sin evidencia").
function _figDeCelda(celda) {
  const fs = parseFigures(String(celda || ""));
  return fs.length ? fs[0] : null;
}
// SEMI-ULP · la mitad del último dígito que la cifra MUESTRA, en unidades crudas. Es la tolerancia honesta de una
// reconciliación: «$6.0M» puede ser cualquier cosa entre $5.95M y $6.05M, así que 12 filas redondeadas contra un
// total redondeado NO cierran exacto y exigirlo bloquearía tablas correctas. Lee las dos convenciones decimales
// (el punto y la coma), igual que `parseNumeroLocalizado` en boleta.js.
function _semiUlp(texto) {
  const m = String(texto || "").match(/(\d[\d.,]*\d|\d)\s?([KMB])?/i);
  if (!m) return 0;
  const suf = (m[2] || "").toUpperCase();
  const mult = suf === "K" ? 1e3 : suf === "M" ? 1e6 : suf === "B" ? 1e9 : 1;
  const dec = (m[1].match(/[.,](\d{1,2})$/) || [, ""])[1].length;
  return mult / Math.pow(10, dec) / 2;
}
const _fmtDiag = (raw) => { const a = Math.abs(raw), s = raw < 0 ? "-" : ""; return a >= 1e6 ? `${s}$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${s}$${Math.round(a / 1e3)}K` : `${s}$${Math.round(a)}`; };

// EL RECORTE DECLARADO ES SALIDA VÁLIDA, en los tres chequeos. narratePromptC.js:64 (TOP-N Y EL RESTO) ya le pide
// al narrador que declare el corte cuando el total cubre más filas que las mostradas; acá se lo reconoce como
// cumplimiento, nunca se lo exige por vocabulario. Un total legítimamente parcial que DICE que es parcial pasa.
const _DECLARA_PARCIAL = /\btop\s*\d+\b|\bl[oa]s\s+\d+\s+(?:principales|mayores|primer[oa]s|m[aá]s\s+\w+)\b|\bel\s+resto\b|\bl[oa]s\s+dem[aá]s\b|\brestantes?\b|\b\d+\s+de\s+\d+\b|\bsub\s?total(?:es)?\b|\bparcial(?:es|mente)?\b|\bno\s+(?:incluye|suma|est[aá]n\s+tod[oa]s)\b|\bs[oó]lo\s+(?:se\s+)?(?:muestr\w+|list\w+|aparec\w+)\b|\bsolo\s+(?:se\s+)?(?:muestr\w+|list\w+|aparec\w+)\b|\bsin\s+dato\b/i;
// LA MISMA IDEA, PERO SIN EL INTERRUPTOR GLOBAL (corrección 2026-08-11, tres apagones medidos). `_DECLARA_PARCIAL`
// se evaluaba sobre la NARRACIÓN ENTERA para decidir si el chequeo 24 corría, así que TRES frases inocentes lo
// apagaban por completo y el Total falso volvía a salir «fiel»:
//   · «Cierre al 1 de 2026.» — la fecha calzaba `\d+\s+de\s+\d+`;
//   · «Un canal quedó sin dato este mes.» — calzaba `sin dato`;
//   · «Los subtotales por familia se ven abajo.» — calzaba `sub total`.
// Dos cambios, los dos acotados: (a) el vocabulario se recorta a las formas que hablan del RECORTE DE FILAS de una
// tabla —el conteo pasa a `\d{1,3} de \d{1,3}`, que ya no puede capturar un año, y salen `sin dato` y `subtotal`,
// que no dicen nada del alcance del total—, y (b) se evalúa sobre la REGIÓN de ESA tabla (su propio texto más la
// prosa que la rodea hasta la tabla vecina), nunca sobre la respuesta entera. `sub total`/`parcial` en la fila
// Total o en el header siguen valiendo, porque las líneas de la tabla son parte de su región.
const _DECLARA_TOTAL_PARCIAL = /\btop\s*\d+\b|\bl[oa]s\s+\d+\s+(?:principales|mayores|primer[oa]s|m[aá]s\s+\w+)\b|\bel\s+resto\b|\bl[oa]s\s+dem[aá]s\b|\brestantes?\b|\b\d{1,3}\s+de\s+\d{1,3}\b|\bparcial(?:es|mente)?\b|\bno\s+(?:incluye|suma|est[aá]n\s+tod[oa]s)\b|\b(?:s[oó]lo|solo)\s+(?:se\s+)?(?:muestr\w+|list\w+|aparec\w+)\b/i;
const _SUBTOTAL_EN_TABLA = /\bsub\s?total(?:es)?\b/i;
// región de la tabla k: desde donde terminó la tabla anterior hasta donde empieza la siguiente. Con UNA sola tabla
// es la respuesta entera (idéntico a lo de antes); con dos, la declaración de recorte de la primera ya no absuelve
// a la segunda.
function _regionDeTabla(narration, tablas, k) {
  const rawLines = String(narration || "").split("\n");
  const ini = k > 0 ? tablas[k - 1].lineaFin + 1 : 0;
  const fin = k + 1 < tablas.length ? tablas[k + 1].lineaIni : rawLines.length;
  return rawLines.slice(ini, Math.max(ini, fin)).join("\n");
}

// ── DIRECCIONALIDAD DE LA MÉTRICA · «mejor» NO ES «más alto» ───────────────────────────────────────────────────
// EL FALSO POSITIVO QUE ESTO CIERRA (medido): `_EXTREMO_MAX` traía `mejor` y `_EXTREMO_MIN` traía `peor`, mapeados
// a máximo/mínimo SIN mirar la métrica. «Valparaíso ← la mejor» sobre una columna de DÍAS DE INVENTARIO —donde la
// mejor ES la más baja— se bloqueaba, y con ella TODA la familia menos-es-mejor de este producto (DOH, capital
// inmovilizado, % en alerta, brecha, costo, quiebre). Un guard que bloquea la respuesta CORRECTA hace más daño que
// el defecto que vino a arreglar.
// «más alto»/«mayor»/«más bajo»/«menor» son palabras de MAGNITUD: se leen solas, no necesitan saber la métrica.
// «mejor»/«peor» son palabras de JUICIO: no significan nada sin la dirección de la métrica. Por eso viven en
// regexes separadas y sólo se juzgan cuando la dirección se resuelve CON CERTEZA.
// DE DÓNDE SALE LA DIRECCIÓN, y por qué no se inventa acá: el repo ya la declara en dos lugares y esto los respeta.
//   · reading.js:238/284 · `betterIsHigher` (margen: más=mejor · capital inmovilizado: menos=mejor).
//   · criteria.js:25-31 · las varas del owner nombran el lado: «margen MÍNIMO»/«piso del margen» y «rotación
//     mínima» son PISOS (más es mejor); «tope/techo de la carga» y «cobertura MÁXIMA (DOH)» son TECHOS (menos es
//     mejor). Esa es exactamente la partición de abajo.
// LA REGLA QUE MANDA: si la dirección NO se resuelve —métrica desconocida, o dos métricas de signo opuesto en el
// mismo texto— NO SE JUZGA. Falso negativo antes que falso positivo.
const _DIR_POR_METRICA = { ventas: 1, margen: 1, contribucion: 1, resultado: 1, rotacion: 1, costo: -1, carga: -1, cobertura: -1 };
// vocabulario EXTRA de dirección, aparte de `_METRIC_VOCAB` a propósito: son magnitudes que el muro no necesita
// atar a una métrica del catálogo (no participan del chequeo 9) pero cuyo lado bueno es inequívoco en el producto.
const _DIR_EXTRA_MENOS = /\bbrechas?\b|\bquiebres?\b|\ben\s+alerta\b|\balertas?\b|\binmovilizad[oa]s?\b|\bdetenid[oa]s?\b|\bocios[oa]s?\b|\bmermas?\b|\bdevoluciones?\b|\bobsolet\w+\b|\bfaltantes?\b|\bmoras?\b|\batrasos?\b|\bdemoras?\b|\bsobrestock\b/i;
const _DIR_EXTRA_MAS = /\bcrecimientos?\b|\bparticipaci[oó]n\b|\bcumplimientos?\b|\brentabilidad\b|\butilidad(?:es)?\b|\bganancias?\b/i;
// ── LA MÉTRICA DE PÉRDIDA · EL AGUJERO QUE NO ERA UN HUECO SINO UNA INVERSIÓN ───────────────────────────────────
// FALSO POSITIVO MEDIDO (2026-08-11, PRE ok=true → POST ok=false en OCHO formulaciones que este repo ya nombra):
// una métrica de PÉRDIDA lleva ADENTRO el nombre de una métrica positiva, así que `_DIR_POR_METRICA` la resolvía —
// y la resolvía AL REVÉS. No caía en la rama segura «no se resuelve → no se juzga»: caía en la rama que condena.
//   · «Contribución no capturada» → `contribucion` → +1   (ontology.js:75 · toolRegistry.js:442)
//   · «Gap de contribución» · «Contribución dejada»       (ontology.js:76)
//   · «Días sin venta»            → `ventas`       → +1   (routerData.js:279, sinónimo declarado de DOH)
//   · «Venta perdida» · «Venta en riesgo»                 (mesaCapital.js:10)
//   · «Margen perdido» · «Margen sin capturar»            (ontology.js:77 «sin captura de margen»)
// Es el vocabulario CENTRAL del producto: «contribución no capturada» fue la cifra principal de la certificación.
// Bloquear una respuesta correcta sobre ella es inaceptable.
//
// POR QUÉ ABSTENERSE Y NO INVERTIR EL SIGNO. La tentación es «la negación invierte la métrica base» (perdido → -1).
// Pero un regex NO PUEDE DECIDIR CON CERTEZA si una etiqueta es la métrica o su pérdida: «recuperación de venta
// perdida», «reducción de la contribución no capturada» y «margen recuperado sin captura previa» llevan el mismo
// modificador y su lado bueno es el CONTRARIO del que la inversión les daría. Invertir cambiaría un falso positivo
// por otro más difícil de ver. La regla de la casa manda: ANTE AMBIGÜEDAD, ABSTENERSE. Con dirección 0 la marca de
// JUICIO («mejor»/«peor») sobre una métrica de pérdida simplemente NO SE JUZGA — la respuesta correcta pasa, y la
// afirmación dudosa también. Ése es el costo aceptado y queda declarado en el límite (f) de este bloque.
// LO QUE NO ENTRA ACÁ, a propósito: «brecha», «quiebre», «merma», «devoluciones», «sobrestock», «en alerta»,
// «inmovilizado» — ésas ya resuelven -1 por `_DIR_EXTRA_MENOS` y resuelven BIEN. Sacarlas sería perder cobertura
// que hoy es correcta. Acá sólo viven los modificadores que se APOYAN sobre una métrica positiva para negarla.
const _MOD_PERDIDA = new RegExp([
  "\\bp[eé]rdidas?\\b", "\\bperdid[oa]s?\\b", "\\bgaps?\\b",
  "\\bdejad[oa]s?\\b", "\\bresignad[oa]s?\\b", "\\bsacrificad[oa]s?\\b", "\\bdesaprovechad[oa]s?\\b",
  "\\ben\\s+riesgo\\b", "\\ben\\s+peligro\\b", "\\bd[eé]ficits?\\b", "\\bincobrables?\\b",
  "\\bno\\s+(?:captur|realizad|concretad|ejecutad|facturad|cobrad|vendid|lograd|alcanzad|aprovechad|generad)\\w*",
  "\\bsin\\s+(?:captur|realizar|concretar|facturar|cobrar|vender|venta|ventas|movimiento|rotaci|uso|ejecutar|aprovechar)\\w*",
  "\\bfalta\\s+de\\b", "\\bausencia\\s+de\\b",
].join("|"), "i");
function _direccionDeMetricas(set) {
  let dir = 0;
  for (const m of set) { const d = _DIR_POR_METRICA[m] || 0; if (!d) continue; if (dir && dir !== d) return 0; dir = d; }
  return dir;
}
// +1 = más es mejor · -1 = menos es mejor · 0 = NO SE RESUELVE (y entonces no se juzga)
function _direccionDe(texto) {
  const s = String(texto || "");
  if (_MOD_PERDIDA.test(s)) return 0;                    // pérdida/negación sobre una métrica: la dirección NO es la de la métrica base
  const dirMet = _direccionDeMetricas(_metricasEn(s));
  const menos = _DIR_EXTRA_MENOS.test(s), mas = _DIR_EXTRA_MAS.test(s);
  if (menos && mas) return 0;
  if (menos) return dirMet === 1 ? 0 : -1;
  if (mas) return dirMet === -1 ? 0 : 1;
  return dirMet;
}
// LA ABSTENCIÓN TIENE QUE SOBREVIVIR AL FALLBACK. `_direccionDe(...) || _direccionDeMetricas(metClaim)` es el patrón
// de prosa y de lista: si el primero devuelve 0 el segundo vuelve a firmar con la métrica base, y la inversión
// reaparece. Por eso los dos call sites preguntan ANTES por el modificador, y sobre TODO el contexto donde puede
// estar escrito (el sustantivo, la intro/oración, el ítem y las ETIQUETAS DEL LEDGER de la cifra reclamada) —
// «contribución no capturada» llega a `_direccionDe` recortada a «contribución no» por `_sustantivoDelExtremo`.
const _hayPerdida = (...textos) => _MOD_PERDIDA.test(textos.filter(Boolean).join(" "));
const _labelsDeFigNarrada = (nf, figsL) => figsL.filter((f) => f.canon === nf.canon).map((f) => f.label).join(" · ");

// ── 23 · EXTREMO SIN SUSTENTO / CONTRADICHO ────────────────────────────────────────────────────────────────────
// La doctrina existía y no tenía backstop: narratePromptC.js:98 «un superlativo tiene que ser el extremo ENTRE LAS
// QUE ESTÁS MOSTRANDO». Acá se vuelve determinístico. El patrón declarado del repo: doctrina sola no alcanza.
const _EXTREMO_MAX = /\bm[aá]s\s+(?:alt[oa]s?|grandes?|elevad[oa]s?|fuertes?)\b|\bmayor(?:es)?\b|\bm[aá]xim[oa]s?\b|\bpico\b|\bencabeza\b|\blidera\b/i;
const _EXTREMO_MIN = /\bm[aá]s\s+(?:baj[oa]s?|chic[oa]s?|peque[nñ][oa]s?|d[eé]biles?)\b|\bmenor(?:es)?\b|\bm[ií]nim[oa]s?\b/i;
const _EXTREMO_MEJOR = /\bmejor(?:es)?\b/i;
const _EXTREMO_PEOR = /\bpeor(?:es)?\b/i;
const _TIENE_MARCA_EXTREMO = (s) => _EXTREMO_MAX.test(s) || _EXTREMO_MIN.test(s) || _EXTREMO_MEJOR.test(s) || _EXTREMO_PEOR.test(s);
// clasifica la marca en {magnitud: 'max'|'min'} o {juicio: 'mejor'|'peor'} · null si no hay marca o si trae las dos
// («el mayor y el peor» no es nada nítido → no se juzga).
function _claseDeMarca(frag) {
  const s = String(frag || "");
  const max = _EXTREMO_MAX.test(s), min = _EXTREMO_MIN.test(s);
  if (max && min) return null;
  if (max) return { re: _EXTREMO_MAX, esMax: true, juicio: false };
  if (min) return { re: _EXTREMO_MIN, esMax: false, juicio: false };
  const mej = _EXTREMO_MEJOR.test(s), peo = _EXTREMO_PEOR.test(s);
  if (mej === peo) return null;
  return { re: mej ? _EXTREMO_MEJOR : _EXTREMO_PEOR, mejor: mej, juicio: true };
}
// «de mayor a menor» / «de menor a mayor» es una PROMESA DE ORDEN (chequeo 4), no una marca de extremo: sin esta
// exclusión toda tabla que declare su orden quedaría marcada además como superlativo.
const _IDIOMA_ORDEN = /\bde\s+m(?:a|e)yor\s+a\s+m(?:e|a)nor\b/i;
const _STOP_SUSTANTIVO = new Set(["de", "del", "la", "el", "los", "las", "lo", "en", "es", "fue", "son", "era", "que", "con", "un", "una", "su", "sus", "tu", "tus", "y", "al"]);
// el sustantivo de la marca son las palabras que SIGUEN al superlativo («← mayor brecha» → «brecha»); vacío es
// legítimo («← más bajo») y significa "la serie principal", que es como se lee una tabla.
function _sustantivoDelExtremo(frag, re) {
  const m = re.exec(frag);
  if (!m) return null;
  const after = frag.slice(m.index + m[0].length).replace(/[*←→|<>\-–—]/g, " ");
  const pal = after.split(/\s+/).map((w) => w.replace(/[^0-9A-Za-zÀ-ſ%]/g, "")).filter(Boolean);
  const utiles = [];
  for (const w of pal.slice(0, 3)) { if (_STOP_SUSTANTIVO.has(_norm(w))) continue; utiles.push(w); if (utiles.length === 2) break; }
  return utiles.join(" ");
}
// columna a la que apunta el sustantivo · EXIGE ≥4 letras de solape para no confundir «mensual» con la columna
// «Mes» (falso match real de `_colForKeyword`, que acepta substring corto). Devuelve -1 si no hay columna.
function _colDelSustantivo(header, sust) {
  const s = _norm(sust);
  if (!s) return -1;
  for (let i = 1; i < header.length; i++) {
    const h = _norm(header[i]);
    if (h.length >= 4 && (s.includes(h) || h.includes(s))) return i;
    if (h.split(/\s+/).some((w) => w.length >= 4 && s.includes(w))) return i;
  }
  return -1;
}
// A QUÉ COLUMNA APUNTA LA MARCA · las tres correcciones del chequeo 23 viven acá.
//  (a) LA MARCA PUEDE VIVIR EN LA CELDA DE LA CIFRA. La versión anterior exigía `!_figDeCelda(cel)`, o sea que la
//      marca estuviera en la columna de la ETIQUETA: `| Falabella | 22% **← el mejor** |` —markdown absolutamente
//      corriente, misma entidad, misma métrica, misma mentira— salía «fiel». La regla juzgaba en qué columna se
//      escribió, no la afirmación. Ahora la marca se busca en TODA la fila y, si vive en una celda con cifra, esa
//      es justamente la columna que la marca reclama.
//  (b) SIN COLUMNA RESUELTA, LA CONTRADICCIÓN TIENE QUE SER UNÁNIME. La versión anterior elegía como «principal» la
//      PRIMERA columna con ≥3 cifras: con `| Mes | Año anterior | Este año |`, «Mar ← más alto» —CIERTO sobre «Este
//      año»— se bloqueaba contra «Año anterior». La corrección dependía del ORDEN DE COLUMNAS. Ahora, cuando la
//      marca no nombra columna ni vive en una, sólo se marca si TODAS las columnas numéricas donde la fila tiene
//      cifra la contradicen: si hay UNA lectura honesta, no se juzga.
//  (c) LA CELDA VACÍA SÍ SE LEE CONTRA LA SERIE PRINCIPAL, y es lo correcto: marcar un extremo en una fila cuya
//      celda de la serie está en blanco afirma sobre un valor que la respuesta NO muestra (el caso medido).
function _extremoEnTabla(narration) {
  const out = [];
  for (const t of _tablasConTotal(narration)) {
    if (t.rows.length < 3) continue;
    const numericas = [];
    for (let c = 1; c < t.header.length; c++) if (t.rows.filter((r) => _figDeCelda(r[c])).length >= 3) numericas.push(c);
    if (!numericas.length) continue;
    const principal = numericas[0];
    const valsDe = (c) => t.rows.map((r) => _figDeCelda(r[c])).map((f, j) => (f ? { ...f, j } : null)).filter(Boolean);
    for (let i = 0; i < t.rows.length; i++) {
      const fila = t.rows[i];
      let ci = -1;
      for (let c = 0; c < fila.length; c++) { const cel = fila[c]; if (!_IDIOMA_ORDEN.test(cel) && _TIENE_MARCA_EXTREMO(cel)) { ci = c; break; } }
      if (ci < 0) continue;
      const marca = _claseDeMarca(fila[ci]);
      if (!marca) continue;
      const sust = _sustantivoDelExtremo(fila[ci], marca.re) || "";
      // sentido de la marca EN ESA COLUMNA · null = no se resuelve → esa columna no puede condenar
      const sentido = (c) => {
        if (!marca.juicio) return marca.esMax;
        const dir = _direccionDe(`${t.header[c] || ""} ${sust}`);
        if (!dir) return null;
        return marca.mejor ? dir > 0 : dir < 0;
      };
      const etiqueta = String(fila[0] || `fila ${i + 1}`).replace(/\*/g, "").trim();
      const nombre = (j) => String(t.rows[j][0] || "").replace(/\*/g, "").trim();
      let col = -1;
      if (sust) { col = _colDelSustantivo(t.header, sust); if (col < 0) continue; }   // nombra una magnitud que la tabla no muestra → no se juzga
      else if (ci >= 1 && numericas.includes(ci)) col = ci;                            // (a) la marca vive en la celda de su propia cifra
      if (col >= 0) {
        const esMax = sentido(col);
        if (esMax === null) continue;
        const vals = valsDe(col);
        if (vals.length < 3) continue;                     // sin evidencia estructural suficiente
        const mia = vals.find((v) => v.j === i);
        if (!mia) { out.push(`«${etiqueta}» está marcada como el extremo (${esMax ? "más alto" : "más bajo"}) y su celda de «${t.header[col] || col}» no trae ninguna cifra — el extremo se afirma sobre un valor que la respuesta no muestra`); continue; }
        const tol = _semiUlp(mia.text);
        const gana = vals.find((v) => v.j !== i && (esMax ? v.raw > mia.raw + tol : v.raw < mia.raw - tol));
        if (gana) out.push(`«${etiqueta}» está marcada como el extremo (${esMax ? "más alto" : "más bajo"}) con ${mia.text}, pero la misma tabla muestra «${nombre(gana.j)}» con ${gana.text} en «${t.header[col] || col}»`);
        continue;
      }
      // (c) sin columna resuelta: la celda vacía se lee contra la SERIE PRINCIPAL
      const esMaxP = sentido(principal);
      if (esMaxP === null) continue;
      const valsP = valsDe(principal);
      if (valsP.length < 3) continue;
      if (!valsP.find((v) => v.j === i)) { out.push(`«${etiqueta}» está marcada como el extremo (${esMaxP ? "más alto" : "más bajo"}) y su celda de «${t.header[principal] || principal}» no trae ninguna cifra — el extremo se afirma sobre un valor que la respuesta no muestra`); continue; }
      // (b) contradicción UNÁNIME o no hay violación
      let unanime = true, ejemplo = null, colEj = principal, miaEj = null;
      for (const c of numericas) {
        const esMax = sentido(c);
        if (esMax === null) { unanime = false; break; }
        const vals = valsDe(c);
        const mia = vals.find((v) => v.j === i);
        if (!mia) continue;                                 // esa columna no exonera ni condena
        if (vals.length < 3) { unanime = false; break; }
        const tol = _semiUlp(mia.text);
        const gana = vals.find((v) => v.j !== i && (esMax ? v.raw > mia.raw + tol : v.raw < mia.raw - tol));
        if (!gana) { unanime = false; break; }              // UNA lectura honesta alcanza para no juzgar
        if (!ejemplo) { ejemplo = gana; colEj = c; miaEj = mia; }
      }
      if (unanime && ejemplo) out.push(`«${etiqueta}» está marcada como el extremo (${sentido(colEj) ? "más alto" : "más bajo"}) con ${miaEj.text}, pero la misma tabla muestra «${nombre(ejemplo.j)}» con ${ejemplo.text} en «${t.header[colEj] || colEj}»`);
    }
  }
  return out;
}
// métricas que el LEDGER le reconoce a una cifra narrada (por canon) · Set vacío = no se puede atar a ninguna
function _metricasDeFigNarrada(nf, figsL) {
  const out = new Set();
  for (const f of figsL) if (f.canon === nf.canon) for (const m of _metricasEn(f.label)) out.add(m);
  return out;
}
// párrafos de PROSA · las líneas de tabla quedan fuera (las juzga el chequeo de tabla) y la línea en blanco corta.
function _parrafos(text) {
  const out = [];
  let cur = [];
  for (const l of String(text || "").split("\n")) {
    if (l.trim() === "" || l.includes("|")) { if (cur.length) { out.push(cur.join("\n")); cur = []; } continue; }
    cur.push(l);
  }
  if (cur.length) out.push(cur.join("\n"));
  return out;
}
// cifras del párrafo CON su posición (parseFigures no la devuelve y el orden que trae es por tipo de unidad, no
// por aparición) · cada ocurrencia se consume una sola vez.
function _figsConPosicion(parr) {
  const out = [], usados = new Map();
  for (const f of parseFigures(parr)) {
    const from = usados.get(f.text) || 0;
    const i = parr.indexOf(f.text, from);
    if (i < 0) continue;
    usados.set(f.text, i + f.text.length);
    out.push({ ...f, i });
  }
  return out;
}
// LA MITAD EN PROSA · el árbitro la midió sin ninguna tabla. Condiciones acumulativas para no castigar prosa
// legítima: (a) superlativo CON determinante (nunca el comparativo «más bajo QUE el benchmark»), (b) su sustantivo
// vacío o una métrica DECLARADA (`_METRIC_VOCAB` — «el mayor problema» no se juzga), (c) 3+ entidades del turno
// nombradas en el párrafo y (d) 3+ cifras COMPARABLES. (c) es lo que separa una comparación entre PARES de una
// lectura contra una vara: «el mejor margen es 30%, contra tu benchmark de 35%» no tiene 3 entidades y por eso
// nunca se marca, aunque el benchmark sea mayor.
//
// QUÉ CAMBIÓ, y por qué el resultado es MÁS ESTRECHO aunque el alcance sea mayor (corrección 2026-08-11):
//   · FALSO POSITIVO CERRADO · antes agrupaba por `unit`, no por MÉTRICA: «El mejor margen lo tiene Jumbo con 24%,
//     por delante de Falabella con 22% —que igual concentra el 41% de la venta— y de Lider con 21.5%» se bloqueaba
//     porque una PARTICIPACIÓN de 41% (otra métrica, misma `unit:pct`) caía en la oración. Ahora cada cifra se ata
//     a su métrica por el LEDGER (canon → label) y sólo compiten las de la MISMA métrica; una cifra que el ledger
//     no sabe atar queda AFUERA de la comparación, nunca adentro.
//   · Y ADEMÁS cada rival tiene que estar PEGADO a una entidad nombrada del turno (≤45 caracteres). Una vara
//     («tu benchmark de 30%») no le pertenece a ninguna entidad y por eso no puede ganarle a nadie. Ese candado es
//     el que permite ampliar la ventana de la ORACIÓN al PÁRRAFO sin abrir la puerta: la misma mentira partida en
//     dos oraciones («El mejor margen lo tiene Falabella con 22%. Detrás vienen Lider con 21.5% y Jumbo con 24%»)
//     evadía el chequeo entero con sólo poner un punto en el medio.
const _SUPERLATIVO_PROSA = /\b(?:el|la|los|las)\s+(?:m[aá]s\s+\w+|mayor(?:es)?|menor(?:es)?|mejor(?:es)?|peor(?:es)?)\b|\bel\s+que\s+m[aá]s\b|\bel\s+que\s+menos\b|\bm[aá]xim[oa]\b|\bm[ií]nim[oa]\b/i;
function _extremoEnProsa(narration, entityNames, ledger) {
  if (!Array.isArray(entityNames) || entityNames.length < 3) return [];
  const figsL = ledger && Array.isArray(ledger.figs) ? ledger.figs : [];
  const out = [];
  for (const parr of _parrafos(narration)) {
    const nombradas = entityNames.filter((n) => new RegExp(`\\b${_esc(n)}\\b`, "i").test(parr));
    if (nombradas.length < 3) continue;                   // sin 3 pares comparados no es una comparación entre pares
    const figs = _figsConPosicion(parr);
    if (figs.length < 3) continue;
    const atada = (f) => nombradas.some((n) => {
      const re = new RegExp(`\\b${_esc(n)}\\b`, "gi");
      let m;
      while ((m = re.exec(parr))) if (Math.abs(m.index - f.i) <= 45) return true;
      return false;
    });
    for (const [lo, hi] of _oraciones(parr)) {
      const o = parr.slice(lo, hi);
      if (_IDIOMA_ORDEN.test(o)) continue;
      const sm = _SUPERLATIVO_PROSA.exec(o);
      if (!sm) continue;
      const esMaxMag = _EXTREMO_MAX.test(sm[0]) || /\bm[aá]xim/i.test(sm[0]) || /\bque\s+m[aá]s\b/i.test(sm[0]);
      const esMinMag = _EXTREMO_MIN.test(sm[0]) || /\bm[ií]nim/i.test(sm[0]) || /\bque\s+menos\b/i.test(sm[0]);
      const mejor = !esMaxMag && !esMinMag && _EXTREMO_MEJOR.test(sm[0]);
      const peor = !esMaxMag && !esMinMag && _EXTREMO_PEOR.test(sm[0]);
      if (esMaxMag === esMinMag && !mejor && !peor) continue;   // ni una ni otra, o las dos → no se juzga
      const reMarca = esMaxMag ? _EXTREMO_MAX : esMinMag ? _EXTREMO_MIN : mejor ? _EXTREMO_MEJOR : _EXTREMO_PEOR;
      const sust = _sustantivoDelExtremo(o.slice(sm.index), reMarca) || "";
      if (sust && !_metricasEn(sust).size) continue;       // nombra otra magnitud (un problema, una cuenta) → no se juzga
      const reclamada = figs.filter((f) => f.i >= lo + sm.index + sm[0].length && f.i < hi).sort((a, b) => a.i - b.i)[0];
      if (!reclamada) continue;                            // el superlativo no lleva cifra pegada → nada que contrastar
      if (!atada(reclamada)) continue;                     // la cifra reclamada no le pertenece a ninguna entidad del turno
      const metClaim = new Set([..._metricasEn(sust), ..._metricasDeFigNarrada(reclamada, figsL)]);
      if (!metClaim.size) continue;                        // sin métrica reconocible no hay con qué acotar la comparación
      let esMax;
      if (esMaxMag || esMinMag) esMax = esMaxMag;
      else {
        if (_hayPerdida(sust, o, _labelsDeFigNarrada(reclamada, figsL))) continue;   // métrica de PÉRDIDA → no se juzga
        const dir = _direccionDe(`${sust} ${[...metClaim].join(" ")}`) || _direccionDeMetricas(metClaim);
        if (!dir) continue;                                // «mejor»/«peor» sin dirección cierta → NO se juzga
        esMax = mejor ? dir > 0 : dir < 0;
      }
      const rivales = figs.filter((f) => f !== reclamada && f.unit === reclamada.unit && atada(f)
        && [..._metricasDeFigNarrada(f, figsL)].some((m) => metClaim.has(m)));
      if (rivales.length + 1 < 3) continue;                // sin 3 cifras comparables no hay evidencia estructural
      const tol = _semiUlp(reclamada.text);
      const gana = rivales.find((f) => (esMax ? f.raw > reclamada.raw + tol : f.raw < reclamada.raw - tol));
      if (gana) out.push(`«${sm[0].trim()}» se afirma sobre ${reclamada.text}, pero el MISMO párrafo muestra ${gana.text} (${gana.unit}) en la misma métrica — el superlativo no es el extremo entre las cifras que la respuesta enseña`);
    }
  }
  return out;
}
// ── 23b · EL EXTREMO EN UNA LISTA CON VIÑETAS ──────────────────────────────────────────────────────────────────
// El árbitro del diagnóstico lo pidió por escrito («el chequeo tiene que poder correr también sobre la lista/prosa,
// como ya hace `_orderViolation` con `_listItemsOrder`») y quedó sin cubrir: «- Falabella 22% ← el mejor / - Lider
// 21.5% / - Jumbo 24%» no es tabla ni es una oración con tres entidades, así que ninguna de las dos mitades lo veía.
// Una lista de viñetas ES una estructura comparable: cada ítem trae UNA cifra de la MISMA serie. Los candados son
// los mismos que arriba —3+ ítems con cifra, todos de la misma unidad, métricas compatibles según el ledger, y la
// dirección resuelta con certeza para «mejor»/«peor»— así que un ítem cuya cifra el ledger no sabe atar no compite.
const _VINETA = /^\s*(?:[-*•·]|\d+[.)])\s+(.+)$/;
// EN UNA LISTA LA MARCA TIENE QUE SER UNA MARCA · o lleva flecha («← el mejor»), o es un superlativo con
// determinante («el menor de los tres»). Sin este candado un COMPARATIVO suelto —«21.5%, menor que el benchmark»—
// se leería como si el ítem se declarara el mínimo de la lista y bloquearía una viñeta correcta.
const _MARCA_DE_LISTA = (it) => (/[←→]/.test(it) ? _TIENE_MARCA_EXTREMO(it) : _SUPERLATIVO_PROSA.test(it));
function _extremoEnLista(narration, ledger) {
  const figsL = ledger && Array.isArray(ledger.figs) ? ledger.figs : [];
  const grupos = [];
  let cur = null, ultima = "";
  for (const l of String(narration || "").split("\n")) {
    if (l.includes("|")) { cur = null; ultima = ""; continue; }
    const m = _VINETA.exec(l);
    if (m) { if (!cur) { cur = { items: [], intro: ultima }; grupos.push(cur); } cur.items.push(m[1].trim()); continue; }
    cur = null;
    if (l.trim()) ultima = l.trim();
  }
  const out = [];
  for (const g of grupos) {
    if (g.items.length < 3) continue;
    const conFig = g.items.map((it, j) => { const f = parseFigures(it)[0]; return f ? { ...f, j, it } : null; }).filter(Boolean);
    if (conFig.length < 3) continue;
    const unidad = conFig[0].unit;
    if (conFig.some((f) => f.unit !== unidad)) continue;   // lista heterogénea → no es una serie comparable
    for (const mia of conFig) {
      if (_IDIOMA_ORDEN.test(mia.it)) continue;
      if (!_MARCA_DE_LISTA(mia.it)) continue;
      const marca = _claseDeMarca(mia.it);
      if (!marca) continue;
      const sust = _sustantivoDelExtremo(mia.it, marca.re) || "";
      if (sust && !_metricasEn(sust).size) continue;      // nombra otra magnitud → no se juzga
      const metClaim = new Set([..._metricasEn(sust), ..._metricasEn(g.intro), ..._metricasDeFigNarrada(mia, figsL)]);
      let esMax;
      if (!marca.juicio) esMax = marca.esMax;
      else {
        if (_hayPerdida(sust, g.intro, mia.it, _labelsDeFigNarrada(mia, figsL))) continue;   // métrica de PÉRDIDA → no se juzga
        const dir = _direccionDe(`${sust} ${g.intro}`) || _direccionDeMetricas(metClaim);
        if (!dir) continue;                                // sin dirección cierta → NO se juzga
        esMax = marca.mejor ? dir > 0 : dir < 0;
      }
      // EL CANDADO DE RIVALES, EN LA MISMA DIRECCIÓN QUE `_extremoEnProsa` (corrección 2026-08-11, falso positivo
      // medido). Estaba INVERTIDO: `!metClaim.size || !_metricasDeFigNarrada(f).size || ...` metía ADENTRO de la
      // comparación justo las cifras que el ledger NO sabe atar a ninguna métrica, que es lo contrario de lo que
      // hace la prosa —donde una cifra sin métrica reconocible queda AFUERA—. Resultado: «- Margen de Jumbo: 24%
      // ← el mejor / - Falabella concentra el 41% / - Lider aporta el 30%», con la boleta rotulando 41% y 30% como
      // PARTICIPACIÓN, se bloqueaba (PRE ok=true → POST ok=false) mientras la MISMA afirmación en prosa pasaba: era
      // el falso positivo FP-4 —declarado cerrado— mudado a la superficie que este chequeo abrió. Ahora rige la
      // regla única: sin métrica reconocible no hay comparación, y sólo compite la cifra de la MISMA métrica.
      if (!metClaim.size) continue;
      const rivales = conFig.filter((f) => f.j !== mia.j && [..._metricasDeFigNarrada(f, figsL)].some((m) => metClaim.has(m)));
      if (rivales.length + 1 < 3) continue;
      const tol = _semiUlp(mia.text);
      const gana = rivales.find((f) => (esMax ? f.raw > mia.raw + tol : f.raw < mia.raw - tol));
      if (gana) out.push(`el ítem «${mia.it.slice(0, 60)}» está marcado como el extremo (${esMax ? "más alto" : "más bajo"}) con ${mia.text}, pero la misma lista muestra ${gana.text} en «${gana.it.slice(0, 60)}»`);
    }
  }
  return out;
}

// ── 24 · TOTAL QUE NO RECONCILIA CON LAS PARTES VISIBLES ───────────────────────────────────────────────────────
// Sólo columnas ADITIVAS: money. Sumar una columna de % / rotación / días es el error OPUESTO (el «Total» de una
// columna porcentual es el ponderado, no la suma), así que nunca se tocan. Y el total tiene que compartir unidad
// con sus partes. Tolerancia = suma de los semi-ULP de cada celda + el del total: proporcional a la cantidad de
// filas, que es exactamente donde el redondeo se acumula.
const _UNIDAD_ADITIVA = new Set(["money"]);
// CONTEOS · `parseFigures` sólo reconoce cifras CON unidad ($ % x d), así que una columna de «Unidades» o de «SKU
// en alerta» era invisible: «Total 9000 unidades» contra 2500 visibles y «Total 90 SKU» contra 25 salían «fiel».
// Un conteo SÍ es aditivo, pero con una asimetría que hay que respetar para no bloquear una respuesta correcta:
// contar entidades DISTINTAS a lo largo de una dimensión puede dar MENOS que la suma de las partes (el mismo SKU
// vive en dos bodegas y se cuenta una sola vez), y ese total menor es CORRECTO. Por eso el conteo sólo se marca en
// el sentido «el total cubre MÁS que lo mostrado», nunca en el otro. Y sólo cuando el header nombra qué se cuenta
// —si no, una columna de años o de números de orden entraría al chequeo sin ser una cantidad.
const _HEADER_CONTABLE = /\bunidades?\b|\bsku[s]?\b|\bcuentas\b|\bclientes\b|\bproductos\b|\b[ií]tems?\b|\breferencias\b|\bquiebres?\b|\balertas?\b|\bcasos\b|\bpedidos\b|\b[oó]rdenes\b|\btransacciones\b|\bl[ií]neas\b|\bcantidad(?:es)?\b|\bconteos?\b/i;
// ── UNA CASCADA NO ES UNA SUMA · el límite (a) estaba mal calibrado ────────────────────────────────────────────
// FALSO POSITIVO MEDIDO (2026-08-11, PRE ok=true → POST ok=false): el piso `t.rows.length < 3` se dejó sin bajar
// argumentando que protegía «la forma del P&L, donde la fila final es una RESTA». No la protege: el P&L de ESTE
// repo tiene CUATRO líneas (pnl.js:894 · Ingreso · Costo · Carga comercial · Gastos declarados → Resultado
// comercial), o sea ya está POR ENCIMA del piso. El piso protegía un P&L de 2 filas que no existe y dejaba sin
// protección el de 3+ que sí. Se bloqueaban tres formas CORRECTAS y corrientes:
//   · «| Venta $50.0M | Costo $30.0M | Carga comercial $8.0M | **Total $12.0M** |»
//   · la misma con la etiqueta real del producto, «Total resultado comercial»
//   · «| Venta bruta $50.0M | Devoluciones $2.0M | Descuentos $6.0M | **Total venta neta $42.0M** |»
// LA REGLA QUE FALTABA, y va donde corresponde —en el chequeo, no en el piso de filas—: una fila final que es una
// RESTA/NETEO no es una suma y no se reconcilia como tal. Se reconoce por las dos caras, y cualquiera alcanza para
// ABSTENERSE (nunca para condenar):
//   (1) ARITMÉTICA, que es certeza y no vocabulario: la primera fila MENOS todas las demás da el total dentro de la
//       misma tolerancia de redondeo. Ésa es exactamente la forma de la cascada y no se puede escribir de otra
//       manera por accidente.
//   (2) LA FILA TOTAL SE DECLARA NETEO en su propia etiqueta («resultado», «neto/neta», «utilidad», «EBITDA»).
// Deliberadamente NO se toca `t.rows.length < 3`: bajarlo sería AGREGAR cobertura, y no es lo que este defecto pide.
const _TOTAL_ES_NETEO = /\bnet[oa]s?\b|\bresultados?\b|\butilidad(?:es)?\b|\bebitda\b/i;
function _conteoDeCelda(celda) {
  const s = String(celda || "").replace(/\*/g, "").trim();
  if (!s || /[$%]/.test(s)) return null;
  const m = s.match(/^(\d[\d.,]*)\s*([A-Za-zÀ-ÿ]{2,16})?\.?$/);
  if (!m) return null;
  const raw = Number(String(m[1]).replace(/[.,](?=\d{3}(?:\D|$))/g, "").replace(/,/g, "."));
  return Number.isFinite(raw) ? { raw, text: s } : null;
}
function _totalNoReconcilia(narration) {
  const tablas = _tablasConTotal(narration);
  const out = [];
  for (let k = 0; k < tablas.length; k++) {
    const t = tablas[k];
    if (!t.total || t.rows.length < 3) continue;
    const region = _regionDeTabla(narration, tablas, k);
    if (_DECLARA_TOTAL_PARCIAL.test(region)) continue;              // el recorte está declarado → el total puede cubrir más
    if (_SUBTOTAL_EN_TABLA.test(t.texto)) continue;                 // la tabla misma dice que su total es un subtotal
    if (_TOTAL_ES_NETEO.test(String(t.total[0] || ""))) continue;   // (2) la fila final se declara NETEO: no es una suma
    for (let c = 1; c < Math.max(t.header.length, t.total.length); c++) {
      const tot = _figDeCelda(t.total[c]);
      if (tot && _UNIDAD_ADITIVA.has(tot.unit)) {
        const partes = t.rows.map((r) => _figDeCelda(r[c])).filter((f) => f && f.unit === tot.unit);
        if (partes.length < 3) continue;                            // sin evidencia estructural suficiente
        const suma = partes.reduce((s, f) => s + f.raw, 0);
        const tol = partes.reduce((s, f) => s + _semiUlp(f.text), 0) + _semiUlp(tot.text);
        if (Math.abs(suma - tot.raw) <= tol) continue;
        // (1) CASCADA DE RESTA · la primera línea menos todas las demás DA el total → la fila final es un neteo
        if (partes.length === t.rows.length && Math.abs(2 * partes[0].raw - suma - tot.raw) <= tol) continue;
        const huecos = t.rows.length - partes.length;
        out.push(`la fila Total de «${t.header[c] || c}» dice ${tot.text} y las ${partes.length} filas visibles suman ${_fmtDiag(suma)}${huecos ? ` (${huecos} fila(s) sin cifra en esa columna)` : ""} — un total que cubre más que lo mostrado tiene que declararse parcial`);
        continue;
      }
      if (tot) continue;                                            // cifra con unidad NO aditiva (%, días, rotación) → nunca se suma
      if (!_HEADER_CONTABLE.test(`${t.header[c] || ""} ${t.total[c] || ""}`)) continue;
      const totC = _conteoDeCelda(t.total[c]);
      if (!totC) continue;
      const partesC = t.rows.map((r) => _conteoDeCelda(r[c])).filter(Boolean);
      if (partesC.length < 3 || partesC.length !== t.rows.length) continue;   // con una fila sin conteo no hay nada que reconciliar
      const sumaC = partesC.reduce((s, f) => s + f.raw, 0);
      if (totC.raw <= sumaC + 0.5) continue;                        // el total menor es la de-duplicación legítima: NO se marca
      out.push(`la fila Total de «${t.header[c] || c}» dice ${totC.text} y las ${partesC.length} filas visibles suman ${Math.round(sumaC)} — un total que cubre más que lo mostrado tiene que declararse parcial`);
    }
  }
  return out;
}

// ── 25 · ALCANCE DE AGREGACIÓN PROMOVIDO (subtotal narrado como total) ─────────────────────────────────────────
// La boleta SÍ trae la etiqueta honesta en el turno medido («Contribución no capturada · subtotal = $4.9M», el
// subtotal de 5 cuentas materiales cuando las 8 bajo benchmark suman $5.4M): la degrada el narrador y nada la
// repone. El alcance vive hoy como SUFIJO DE TEXTO del label —no es un campo—, así que se lee de ahí; el día que
// `boleta.js` lo declare como campo, esta lectura se reemplaza por el campo y el resto del chequeo no cambia.
// LO QUE ESTE CHEQUEO **NO** PUEDE VER, y hay que decirlo: cuando el EMISOR rotula «· total» una suma filtrada
// (specRetrieval.js:1011/1733/2231/2260 lo hacen sobre `subtotal_usd`), no hay nada que comparar — la etiqueta
// miente antes de llegar acá. Esa mitad se cierra en el emisor, no en el muro.
function _alcanceDelLabel(label) {
  const segs = String(label || "").split("·").map((s) => _norm(s.trim())).filter(Boolean);
  const last = segs[segs.length - 1] || "";
  if (/^sub\s?total(?:es)?$/.test(last) || /^parcial(?:es)?$/.test(last) || /^top\s*\d+$/.test(last)) return "subtotal";
  if (/^total(?:es)?$/.test(last) || /^global(?:es)?$/.test(last)) return "total";
  return null;
}
const _ALCANCE_TOTALIZADOR = /\btotal(?:es)?\b|\btotalidad\b|\bglobal(?:es)?\b|\btod[oa]s?\s+(?:el|la|los|las|tu|tus|su|sus)\b|\bcomplet[oa]s?\b|\benter[oa]s?\b|\ba nivel (?:global|general|de negocio)\b/i;
// TOTAL DEL GRUPO DECLARADO · el propio motor escribe «esa lista completa suma el total de arriba» refiriéndose al
// grupo que acaba de listar. Eso NO es promover el alcance: es nombrar el total DEL RECORTE, que es la conducta
// correcta. Misma familia que `_PART_OF_EXCEPTION` (chequeo 5), que también se reusa acá para el total-denominador.
const _TOTAL_DEL_GRUPO = /\b(?:de|del|en)\s+(?:arriba|abajo|es[ae]\s+(?:lista|grupo|recorte|bloque|conjunto)|est[ae]\s+(?:lista|grupo|recorte|bloque|conjunto)|l[oa]s\s+\d+\b|es[oa]s\s+\d+\b)/i;
function _alcancePromovido(narration, ledger) {
  const figs = (ledger && Array.isArray(ledger.figs) ? ledger.figs : []);
  if (!figs.length) return [];
  const porCanon = new Map();
  for (const f of figs) { if (!porCanon.has(f.canon)) porCanon.set(f.canon, []); porCanon.get(f.canon).push({ f, alcance: _alcanceDelLabel(f.label) }); }
  const text = String(narration || "");
  const masked = _maskFigures(text);
  const out = [];
  const vistos = new Set();
  for (const nf of parseFigures(text)) {
    const grupo = porCanon.get(nf.canon);
    if (!grupo) continue;
    const subs = grupo.filter((g) => g.alcance === "subtotal");
    if (!subs.length) continue;
    const metricas = new Set();
    for (const s of subs) for (const m of _metricasEn(s.f.label)) metricas.add(m);
    if (!metricas.size) continue;                          // sin métrica reconocible no hay nada que atar
    // COLISIÓN DE CANON (el canon es `unit:value`, no incluye la etiqueta): si OTRA fig con el mismo valor declara
    // alcance total, o no declara ninguno pero habla de la misma métrica, la cita tiene una lectura honesta.
    const ambiguo = grupo.some((g) => g.alcance === "total" || (g.alcance === null && [..._metricasEn(g.f.label)].some((m) => metricas.has(m))));
    if (ambiguo) continue;
    const idx = text.indexOf(nf.text);
    if (idx < 0 || vistos.has(idx)) continue;
    vistos.add(idx);
    const [lo] = _localWindow(masked, idx, 90);
    const end = idx + nf.text.length;
    const hi0 = Math.min(masked.length, end + 90);
    const cut = masked.slice(end, hi0).search(_SENT_END);
    const ventana = text.slice(lo, cut >= 0 ? end + cut : hi0);
    if (!_ALCANCE_TOTALIZADOR.test(ventana)) continue;
    if (_PART_OF_EXCEPTION.test(ventana) || _TOTAL_DEL_GRUPO.test(ventana) || _DECLARA_PARCIAL.test(ventana)) continue;
    if (![..._metricasEn(ventana)].some((m) => metricas.has(m))) continue;   // la frase habla de otra métrica
    out.push(`«${nf.text}» está autorizada como SUBTOTAL («${subs[0].f.label}») y se narra como el total del universo: "${ventana.trim().slice(0, 110)}"`);
  }
  return out;
}

export function guardC(narration, { ledger, results = [], trace = null, question = "", mechanismMemory = null, sealedOrders = null, recentNarrations = null, mode = null, tablePolicy = "auto", reparacion = null, contentScope = "full" } = {}) {
  const figs = ledger && Array.isArray(ledger.figs) ? ledger.figs : [];
  // ECO DEL USUARIO: repetir una cifra que la PERSONA nombró en su pregunta NO es inventar ("qué es eso de 2x" → ADI
  // dice "2x"). Autorizamos las cifras/conteos del texto de la pregunta además de las de la boleta.
  const qFigs = parseFigures(question || "");
  // EL TERCER UNIVERSO (Contrato v1.2 §5.1, owner 2026-08-10): la cifra que aportó el usuario y sigue viva en la
  // conversación. Se AUTORIZA a escribirla —de otro modo el narrador no podría siquiera mostrar la discrepancia—
  // pero no queda libre: los chequeos 20 y 21 exigen que lleve su procedencia en cada lugar donde aparezca, que
  // no se consolide con una cifra del motor, y que lo derivado de ella salga como escenario. Sin `reparacion`
  // (el 99% de los turnos) esto es un Set vacío y no cambia absolutamente nada.
  const supFigs = cifrasDelUsuario(reparacion);
  const authCanon = new Set([...figs.map((f) => f.canon), ...qFigs.map((f) => f.canon), ...supFigs.map((f) => f.canon)]);
  const authVerbatim = new Set([...figs.map((f) => _stripSpace(f.value)), ...qFigs.map((f) => _stripSpace(f.text)), ...supFigs.map((f) => _stripSpace(f.text))]);
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
    // `_derivadaDeSupuesto` cierra el caso del tercer universo: una cifra que sale de combinar el supuesto del
    // usuario con el dato del motor NO es inventada — es legítima y su problema es OTRO (cómo se presenta), que
    // juzga el chequeo 21. Rechazarla acá la bloquearía con el veredicto equivocado y el reintento buscaría
    // corregir algo que no estaba mal.
    if (!authCanon.has(f.canon) && !authVerbatim.has(_stripSpace(f.text)) && !_isCalc(f.raw, f.unit, figs, entityNames, mentionedEntities) && !_isCalc2(f.raw, f.unit, figs, mentionedEntities) && !_derivadaDeSupuesto(f, supFigs, figs)) violations.push({ kind: "cifra-no-autorizada", detail: f.text });
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
  for (const v of _sujetoGeneralizado(narration, claimsPS, entityNames)) violations.push({ kind: "sujeto-generalizado", detail: v });
  const procViol = _procedenciaNoAutorizada(narration, claimsPS);
  if (procViol) violations.push({ kind: "procedencia-no-autorizada", detail: procViol });
  const nivelViol = _nivelNoAutorizado(narration, claimsPS);
  if (nivelViol) violations.push({ kind: "nivel-financiero-no-autorizado", detail: nivelViol });
  for (const v of _causaSobredimensionada(narration, claimsPS)) violations.push({ kind: "causa-sobredimensionada", detail: v });
  // 16 · POLÍTICA DE PRESENTACIÓN (owner 2026-08-07) — se valida LA POLÍTICA DECIDIDA para este turno, en los DOS
  // sentidos: `forbidden` bloquea la tabla, `required` bloquea su AUSENCIA (responder en prosa algo que se pidió
  // tabulado también es incumplir), `auto` no juzga y deja decidir a los detectores de forma del prompt.
  if (tablePolicy === "forbidden") { const t = _tablaNoAutorizada(narration); if (t) violations.push({ kind: "tabla-no-autorizada", detail: t }); }
  else if (tablePolicy === "required" && !_tieneTabla(narration)) {
    violations.push({ kind: "tabla-faltante", detail: "el turno pidió explícitamente una tabla (o la serie mes a mes / un desglose) y la respuesta no trae ninguna — responder en prosa lo que se pidió tabulado también es incumplir" });
  }
  // 17 · CRUCE DE UNIVERSOS (owner 2026-08-09, decisiones 1 y 11) — dos cifras REALES de universos que el contrato
  // declara divergentes (venta comercial en miles ↔ inventario en dólares crudos), atadas por una construcción
  // relacional en la misma oración. BLOQUEA: los números son verdad y la relación es falsa, que para quien decide
  // es peor que un número inventado — suena a insight y no lo es. Ver _cruceDeUniversos arriba.
  for (const v of _cruceDeUniversos(narration, ledger)) violations.push({ kind: "cruce-de-universos", detail: v });
  // 18 · TRANSFERENCIA NO EVALUABLE (owner 2026-08-09, decisión 13) — la tool declaró que mover stock entre bodegas
  // no se puede evaluar sobre este dato y la narración lo recomienda igual. BLOQUEA por la misma razón que el
  // chequeo 7: es una conclusión que el dato no respalda, dicha con cifras reales. Ver _transferenciaNoEvaluable.
  const transf = _transferenciaNoEvaluable(narration, results);
  if (transf) violations.push({ kind: "transferencia-no-evaluable", detail: transf });
  // 19 · la otra cara del 18: preguntada y NO contestada (ver el bloque grande de _transferenciaSinDeclarar).
  const transfSin = _transferenciaSinDeclarar(narration, results, question);
  if (transfSin) violations.push({ kind: "transferencia-sin-declarar", detail: transfSin });
  // 20 · CORRECCIÓN RESUELTA SIN EVIDENCIA (Contrato v1.2 §4.1) — el usuario dijo qué corregir, el motor trajo el
  // dato bueno y la respuesta no lo cita. BLOQUEA: reconocer la corrección sin entregarla es exactamente la mitad
  // de lo que se pidió, y el reintento (o la reparación desde la boleta) sí puede resolverlo.
  const corrSinEvid = _correccionSinEvidencia(narration, reparacion, figs, results, contentScope, mode);
  if (corrSinEvid) violations.push({ kind: "correccion-sin-evidencia", detail: corrSinEvid });
  // 22 · §5.1 viñeta 2 · la consolidación, que es la ÚNICA de las tres que el renderer no puede construir: marcar
  // un total no lo des-consolida. Se detecta por aritmética, sin una sola palabra de vocabulario.
  for (const v of _consolidaConElMotor(narration, reparacion, figs)) violations.push({ kind: "consolida-universo-usuario", detail: v });
  // 21 · EL TERCER UNIVERSO (Contrato v1.2 §5.1) — lo ÚNICO que el renderer no puede reparar: que la cifra del
  // usuario REEMPLACE al dato oficial. La marca de procedencia y el marco de estimación ya no se le exigen al
  // narrador — los estampa markUserProvenance (narratePromptC.js) sobre el texto final, con nuestra marca y sin
  // depender de cómo lo haya redactado. BLOQUEA por la misma razón que el chequeo 17: el número es verdad y la
  // afirmación es falsa. Cero vocabulario: compara métrica contra métrica y canon contra canon.
  for (const v of _datoOficialReemplazado(narration, reparacion, figs)) violations.push({ kind: "dato-oficial-reemplazado", detail: v });
  // 23-25 · LA RESPUESTA COMO SISTEMA (owner 2026-08-11, defectos D5/D6) — ver el bloque grande arriba. Van AL
  // FINAL a propósito: `verdict` es `violations[0].kind`, así que cuando una fila dispara además un chequeo de
  // fidelidad de cifra ya existente (típicamente 9 `metrica-mal-atribuida`, que puede leer el sustantivo de la
  // misma marca), el veredicto que viaja al reintento sigue siendo el de la cifra — el más específico y el que ya
  // sabe repararse. Estos tres se suman a `violations` para que el detalle no se pierda, nunca lo pisan.
  for (const v of _extremoEnTabla(narration)) violations.push({ kind: "extremo-sin-sustento", detail: v });
  for (const v of _extremoEnProsa(narration, entityNames, ledger)) violations.push({ kind: "extremo-sin-sustento", detail: v });
  for (const v of _extremoEnLista(narration, ledger)) violations.push({ kind: "extremo-sin-sustento", detail: v });
  for (const v of _totalNoReconcilia(narration)) violations.push({ kind: "total-no-reconcilia", detail: v });
  for (const v of _alcancePromovido(narration, ledger)) violations.push({ kind: "alcance-promovido", detail: v });

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
