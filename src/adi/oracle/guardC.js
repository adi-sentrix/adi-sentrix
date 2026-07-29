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
const _MONEY_RE = /\$\s?[\d.,]+\s?[KMB]?/, _PCT_RE = /[\d.,]+\s?%/;
function _toNumOrder(tok) {
  const dm = String(tok).match(/\$\s?([\d.,]+)\s?([KMB]?)/i);
  if (dm) { let v = parseFloat(dm[1].replace(/,/g, "")); const s = (dm[2] || "").toUpperCase(); if (s === "K") v *= 1e3; else if (s === "M") v *= 1e6; else if (s === "B") v *= 1e9; return v; }
  const pm = String(tok).match(/([\d.,]+)\s?%/);
  if (pm) return parseFloat(pm[1].replace(/,/g, ""));
  return null;
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
  const isPct = /margen|%|porcentaje/i.test(keyword || "");
  const re = isPct ? _PCT_RE : _MONEY_RE;
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

export function guardC(narration, { ledger, results = [], trace = null, question = "", mechanismMemory = null } = {}) {
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

  // ── AVISOS (NO bloquean · owner 2026-07-28 "el muro solo corrobora que no invente una cifra y que sea del dato") ──
  // atribución (general) y graduación se dejan a criterio del LLM + prompt (como Claude leyendo el Excel). Se
  // REGISTRAN por si algún día se quieren mirar, pero NO tumban la respuesta (eran los que trababan de más).
  const advisories = [];
  for (const v of _attributionViolations(narration, ledger, entityNames)) advisories.push({ kind: "atribucion", detail: v });
  const grad = _graduationViolation(narration, trace);
  if (grad) advisories.push({ kind: "graduacion", detail: grad });
  // mecanismo dominante vs acción (turno 9, AVISO — coherencia semántica, no cifra, ver comentario arriba)
  const mechRows = extractMechanismRows(results);
  for (const v of _mechanismAdvisory(narration, mechRows)) advisories.push({ kind: "mecanismo-inconsistente", detail: v });
  // mecanismo con memoria ENTRE turnos (residual 3, mismo día — AVISO por la misma razón)
  for (const v of _mechanismMemoryAdvisory(narration, mechanismMemory, mechRows)) advisories.push({ kind: "mecanismo-memoria-inconsistente", detail: v });

  const ok = violations.length === 0;   // solo cifra/conteo/entidad BLOQUEAN
  return { ok, verdict: ok ? "fiel" : violations[0].kind, violations, advisories };
}
