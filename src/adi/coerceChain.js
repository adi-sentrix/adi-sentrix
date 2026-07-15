/* === src/adi/coerceChain.js · CADENA DE COERCE determinística "la pregunta manda el foco" (owner 2026-07-06) ===
 * SAFETY NET del ruteo: no depende de la clasificación variable del LLM #1. Dado el spec del LLM y el texto, fuerza el
 * dominio+foco correcto (o lo deja pasar). Extraído de ChatADI para ser PURO y gate-testable de punta a punta (_routing_gate).
 *
 * ORDEN (más específico → más general): compare → contribución → margen → ventas → inventario → explain.
 *   · compare corre primero (verbo explícito manda) pero "contra <plan/tiempo>" NO es compare de entidades → lo toma ventas.
 *   · contribución 2º: su palabra "contribución" es la más específica (que "venta"/"margen" no la roben).
 *   · ventas cede el dominio inventario (INV_INTENT dentro de detectVentasFocus) → Q stock/quiebre van a inventario.
 *   · cada coerce respeta un dominio ya reclamado (guards por spec.operation). */
import { detectContribucionFocus } from "./contribucionFocus.js";
import { detectMarginFocus } from "./marginFocus.js";
import { detectVentasFocus } from "./ventasFocus.js";
import { detectInventoryFocus } from "./inventoryFocus.js";
import { detectMultiAnalysis } from "./multiFocus.js";
import { detectCriteriaIntent } from "./criteria.js";
import { ENTITIES } from "../config/contract/entityRegistry.js";
import { OUT_OF_DATA_RE } from "./llm/capabilities.js";   // universo disponible · data que NO existe → redirect honesto
import { clientesMargen as _cCanon, marcasMargen as _mCanon, sfamiliasMargen as _fCanon, skuInventario as _iCanon } from "../data/demoData.js";

// ── CANON DE ENTIDADES (invitado en prod 2026-07-09): el LLM emite entidades en minúscula/sin tilde y a veces en el
// campo equivocado ("concepcion" como entity de inventario · "cuidado personal" como entity de un recommend@sku) →
// el filtro no matcheaba y ADI respondía GLOBAL en silencio. Acá se canonicalizan contra el DATASET (una verdad):
// el nombre queda con su forma real y, si el TIPO no coincide con la dimensión pedida, viaja como filters[tipo]. ──
const _norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const _CANON = (() => {
  const m = new Map();
  for (const r of _cCanon) m.set(_norm(r.nombre), { tipo: "cliente", nombre: r.nombre });
  for (const r of _mCanon) m.set(_norm(r.nombre), { tipo: "marca", nombre: r.nombre });
  for (const r of _fCanon) m.set(_norm(r.nombre), { tipo: "familia", nombre: r.nombre });
  for (const r of _iCanon) { m.set(_norm(r.sku), { tipo: "sku", nombre: r.sku }); if (r.bodega && !m.has(_norm(r.bodega))) m.set(_norm(r.bodega), { tipo: "bodega", nombre: r.bodega }); }
  return m;
})();
const _canonEntity = (name) => _CANON.get(_norm(name)) || null;

// SANEO de filters (safety-net): el LLM #1 a veces emite claves-ruido ("filters:{margen:'mínimo'}") que NO son ejes del
// contrato → el seam degradaba con "no reconozco el filtro" una pregunta YA bien ruteada. Al coercer a un dominio, solo
// sobreviven los filtros por ejes REALES (cliente/marca/familia/bodega/sku); el ruido se descarta, la respuesta responde.
function _cleanFilters(s) {
  if (!s) return s;
  // filters:null EXPLÍCITO del LLM (crash en prod 2026-07-09: los composers usan default `filters = {}` que NO
  // aplica con null → "Cannot read properties of null (reading 'marca')") → se normaliza a undefined SIEMPRE.
  if (!s.filters) return s.filters === undefined ? s : { ...s, filters: undefined };
  const f = {};
  for (const k of Object.keys(s.filters)) if (ENTITIES[k] && s.filters[k] != null) f[k] = s.filters[k];
  return { ...s, filters: Object.keys(f).length ? f : undefined };
}

// ALCANCE DESDE EL TEXTO (auditoría de asks 2026-07-15): si la pregunta nombra una entidad del canon de los tipos
// pedidos y el spec no trae ese filtro, el alcance viaja — «los SKU que más venden de Samsung» respondía TODOS los
// SKU en silencio (mismo patrón que la bodega en _coerceInventory · la pregunta manda el foco). Devuelve filters.
function _scopeCanonFromText(q, filters, tipos) {
  const nq = _norm(q);
  for (const [k, c] of _CANON) {
    if (!tipos.includes(c.tipo) || k.length < 3) continue;
    if (filters && filters[c.tipo]) continue;
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(nq)) return { ...(filters || {}), [c.tipo]: c.nombre };
  }
  return filters;
}

// COMPARE · verbo explícito de comparación o "contra X". "contra <plan/tiempo>" se desvía a ventas (ver abajo).
const _CMP_INTENT_RE = /\b(compar[aá]\w*|compár\w*|comparemos|versus|vs\.?)\b|\bcontra\s+\p{L}/iu;
// "contra/vs/versus/con <plan/tiempo>" (presupuesto/año/plan/mes/mismo período/hace un año…) NO es comparación de entidades
// → es ventas (vs plan/YoY). El TARGET es plan/tiempo (no una entidad), así que aplica incluso con "compará" ("compará la
// venta con el año pasado" = YoY). Los conectores/fillers (el/la/del/de/hace/un/mismo) pueden intercalarse antes del sustantivo.
const _CMP_PLAN_RE = /\b(contra|vs\.?|versus|con)\s+(?:(?:el|la|los|las|lo|del|de|hace|un[ao]?|mismo)\s+)*(per[ií]odo|presupuesto|ppto|a[ñn]o|plan\b|meta|objetivo|mes\b|benchmark)/i;
function _coerceCompare(q, spec) {
  if (!q || !spec || !_CMP_INTENT_RE.test(q)) return spec;
  // "contra/vs/con el presupuesto/año/plan" NO es comparación de entidades → la maneja ventas. Además LIMPIA un compare que
  // el LLM ya haya elegido (si no, "vs el año pasado" pide "¿comparar contra qué SKU?" en vez de responder el YoY).
  if (_CMP_PLAN_RE.test(q)) return spec.operation === "compare" ? { ...spec, operation: "overview", comparison: undefined } : spec;
  const s = { ...spec, operation: "compare", turn_type: "followup_compare" };
  const ents = (s.comparison && Array.isArray(s.comparison.entities)) ? s.comparison.entities.filter(Boolean) : [];
  if (!ents.length) {
    const m = q.match(/\b(?:con|contra|versus|vs\.?)\s+(.+?)\s*[?.!¡¿]*$/i);
    const t = m && m[1] && m[1].trim();
    s.comparison = { ...(s.comparison || {}), entities: t ? [t] : [] };
  }
  return s;
}

// CONTRIBUCIÓN · corre PRIMERO (su palabra es la más específica) para que "venta"/"margen" en la pregunta no la roben.
// CEDER EL CLAIM (matriz fase 2 · 2026-07-09): si la pregunta nombra un EJE que el dominio comercial no soporta
// ("margen por bodega") o una MÉTRICA de otro mundo ("top 3 de costo"), el coerce NO reclama — el spec del LLM
// fluye al CONTRATO, que ejecuta (costo) o DECLARA el límite ("no lo tengo por bodega; sí por…"). Antes el dominio
// respondía su lectura GLOBAL en silencio — pregunta de bodega contestada con clientes.
const _PIDE_BODEGA = /\b(por|en|de)\s+(la\s+|las\s+)?bodegas?\b/i;
const _PIDE_COSTO_PURO = (q) => /\bcostos?\b/i.test(q) && !/\bventas?\b/i.test(q) && !/margen/i.test(q);
function _coerceContribucion(q, spec) {
  if (!q || !spec || spec.operation === "compare") return spec;
  if (_PIDE_BODEGA.test(q)) return spec;   // contribución@bodega no existe → que el contrato lo declare
  const c = detectContribucionFocus(q);
  if (!c.isContrib) return spec;
  const s = { ...spec, operation: "contribucion", metric: "contribucion", dimension: c.dimension || "cliente",
    turn_type: spec.turn_type === "followup_compare" ? "new_query" : (spec.turn_type || "new_query") };
  if (c.focus) s.focus = c.focus;
  if (c.entity) s.entity = c.entity;
  if (s.transform) delete s.transform;
  // «Top SKU por contribución de Samsung» (botón de la Ficha) respondía TODOS los SKU en silencio: en el eje SKU,
  // la marca/familia nombrada viaja como filtro — el composer ya sabe aplicarlo (auditoría de asks 2026-07-15).
  if (s.dimension === "sku") s.filters = _scopeCanonFromText(q, s.filters, ["marca", "familia"]);
  return _cleanFilters(s);
}

// MARGEN · rompe la trampa "todo→diagnose genérico" con el sub-foco. No toca dives/compares de entidad puntual.
function _coerceMargin(q, spec) {
  if (!q || !spec || spec.operation === "compare" || spec.operation === "dive" || spec.operation === "contribucion" || spec.entity) return spec;
  if (_PIDE_BODEGA.test(q)) return spec;   // margen/carga@bodega no existen → que el contrato lo declare
  const m = detectMarginFocus(q);
  if (!m.isMargin) return spec;
  const s = { ...spec, operation: "margin", metric: "margen", dimension: m.dimension || "cliente",
    turn_type: spec.turn_type === "followup_compare" ? "new_query" : (spec.turn_type || "new_query") };
  if (m.focus) s.focus = m.focus;
  if (m.gap) s.gap = m.gap;
  if (m.negativo) s.negativo = true;
  if (m.pct) s.pct = true;
  if (s.transform) delete s.transform;
  return _cleanFilters(s);
}

// VENTAS · fallback general de lo comercial (vs ppto/YoY/descomposición/mix). Cede el dominio inventario (dentro del detector).
function _coerceVentas(q, spec) {
  if (!q || !spec || spec.operation === "margin" || spec.operation === "contribucion") return spec;
  // PROMESA ROTA (owner 2026-07-09): "¿es por volumen o por precio?" es una SUGERENCIA de ADI, pero el LLM a veces
  // la clasifica como COMPARE de las "entidades" volumen/precio → "No tengo a volumen". Con ambas palabras en la
  // pregunta, la descomposición de ventas MANDA por sobre el claim de compare/dive/entity (nadie compara "precio").
  const _volPrecio = /\bvolumen\b[^]*\bprecios?\b|\bprecios?\b[^]*\bvolumen\b/i.test(q);
  if (!_volPrecio && (spec.operation === "compare" || spec.operation === "dive" || spec.entity)) return spec;
  if (_PIDE_BODEGA.test(q)) return spec;       // ventas@bodega no existe → que el contrato lo declare
  if (_PIDE_COSTO_PURO(q)) return spec;        // "top 3 de costo" es del CONTRATO (costo@eje), no una lectura de ventas
  const v = detectVentasFocus(q);
  if (!v.isVentas) return spec;
  const s = { ...spec, operation: "ventas", metric: "ventas", dimension: v.dimension || "cliente",
    entity: null, comparison: null,   // limpia el claim de compare/dive robado (volumen/precio no son entidades)
    turn_type: spec.turn_type === "followup_compare" ? "new_query" : (spec.turn_type || "new_query") };
  if (v.focus) s.focus = v.focus;
  if (v.gap) s.gap = v.gap;
  if (v.pivotFocus) s.pivotFocus = v.pivotFocus;
  if (s.transform) delete s.transform;
  // «¿Cuáles son los SKU que más venden de Samsung?» (chip del cuadro de marcas) respondía TODOS los SKU en
  // silencio: en el ranking de venta por SKU, la marca/familia nombrada viaja como filtro (skusMargen la trae).
  if (s.focus === "rank_venta") s.filters = _scopeCanonFromText(q, s.filters, ["marca", "familia"]);
  return _cleanFilters(s);
}

// INVENTARIO · capital/quiebre/sobrestock/stale. Corre último de los dominios (ventas ya le cedió lo suyo).
// CRUCE ranking×inventario (owner 2026-07-09): "inventario disponible de los 5 principales SKU de ventas" —
// palabra de inventario + frase de top-vendedores en la misma pregunta → focus top_sellers (venta × stock por SKU).
const _TOPSELL_INV_RE = /(inventario|stock|disponib\w*|cobertura|unidades)[^]*\b(principal\w*|top\b|m[aá]s\s+vendid\w*|que\s+m[aá]s\s+vend\w*|mayores?\s+venta\w*)|\b(principal\w*|top\b|m[aá]s\s+vendid\w*|que\s+m[aá]s\s+vend\w*|mayores?\s+venta\w*)[^]*\b(inventario|stock|disponib\w*|cobertura)/i;
function _coerceInventory(q, spec) {
  if (!q || !spec) return spec;
  // Los CRUCES de SKU corren ANTES del guard de dominios: son más específicos y pueden ganarle al claim de ventas
  // ("los 5 más vendidos del mes" no tiene palabra de inventario → ventas lo reclamaba y el mes se perdía).
  const _crossOk = spec.operation !== "compare" && spec.operation !== "margin" && spec.operation !== "contribucion";
  // MÁS VENDIDOS DEL MES (invitado 2026-07-09): unidades reales del mes (vendidoMes), no el año en $ sin declarar.
  if (_crossOk && /(sku|producto)/i.test(q) && /(m[aá]s\s+vendid|que\s+m[aá]s\s+vend|principal\w*|top\b)/i.test(q) && /(([uú]ltimo|este)\s+mes|mensual\b)/i.test(q)) {
    const nM = String(q).match(/\b(\d{1,2})\b/);
    return _cleanFilters({ ...spec, operation: "inventory", metric: "capital", dimension: "sku", focus: "mas_vendidos_mes",
      limit: nM ? Number(nM[1]) : 5, turn_type: spec.turn_type === "followup_compare" ? "new_query" : (spec.turn_type || "new_query") });
  }
  // CRUCE top vendedores × inventario ("inventario disponible de los 5 principales SKU de ventas")
  if (_crossOk && _TOPSELL_INV_RE.test(q) && /(sku|producto)/i.test(q)) {
    const nM = String(q).match(/\b(\d{1,2})\b/);
    return _cleanFilters({ ...spec, operation: "inventory", metric: "capital", dimension: "sku", focus: "top_sellers",
      limit: nM ? Number(nM[1]) : 5, turn_type: spec.turn_type === "followup_compare" ? "new_query" : (spec.turn_type || "new_query") });
  }
  if (spec.operation === "compare" || spec.operation === "margin" || spec.operation === "ventas" || spec.operation === "contribucion") return spec;
  // REESCRIBIR HACIA EL CONTRATO (matriz fase 2 · 2026-07-09): pedir inventario POR CLIENTE/MARCA (ejes que no
  // tiene) o una métrica COMERCIAL "por bodega" no es una lectura de inventario — se fuerza overview del contrato
  // para que el #4 DECLARE el límite ("no lo tengo por X; sí por…"). Ceder pasivo no alcanza: si el propio LLM
  // vino con operation inventory, la respuesta global de frenado se colaba igual.
  const _mInvQ = /(capital|stock|inventari)/i.test(q) ? "capital" : /rotaci[oó]n/i.test(q) ? "rotacion" : /(\bdoh\b|cobertura|d[ií]as de inventario)/i.test(q) ? "doh" : null;
  const _ejeCM = q.match(/\b(?:por|de)\s+(?:los\s+|las\s+|cada\s+)?(clientes?|marcas?)\b/i);
  if (_mInvQ && _ejeCM)
    return _cleanFilters({ ...spec, operation: "overview", metric: _mInvQ, dimension: /marca/i.test(_ejeCM[1]) ? "marca" : "cliente", focus: undefined, turn_type: "new_query" });
  const _mComQ = /\bventas?\b/i.test(q) ? "ventas" : /margen/i.test(q) ? "margen" : /contribuci[oó]n/i.test(q) ? "contribucion" : /\bcostos?\b/i.test(q) ? "costo" : /\bcarga\b/i.test(q) ? "carga" : null;
  if (_mComQ && /\bbodegas?\b/i.test(q) && !/(stock|inventari|capital|rotaci[oó]n|\bdoh\b|cobertura|quiebre|sobrestock|frenad\w*|dormid\w*|inmoviliz\w*|repon\w*|liquid\w*)/i.test(q))
    return _cleanFilters({ ...spec, operation: "overview", metric: _mComQ, dimension: "bodega", focus: undefined, turn_type: "new_query" });
  const inv = detectInventoryFocus(q);
  if (!inv.isInventory) return spec;
  const dim = (spec.dimension === "sku" || spec.dimension === "familia" || spec.dimension === "bodega") ? spec.dimension : "bodega";
  const s = { ...spec, operation: "inventory", metric: "capital", dimension: dim, focus: inv.focus,
    turn_type: spec.turn_type === "followup_compare" ? "new_query" : (spec.turn_type || "new_query") };
  if (inv.staleDays != null) s.staleDays = inv.staleDays;
  if (s.transform && s.transform.unit !== "pct") delete s.transform;
  // ALCANCE DESDE EL TEXTO (revisión de la Mesa 2026-07-14: «¿Cuánto capital tengo en Concepción?» con el spec
  // neutro respondía el GLOBAL en silencio): si la pregunta nombra una bodega del canon y el spec no trae el
  // filtro, el alcance viaja — la pregunta manda el foco (mismo canon que la entrada de coerceSpec).
  if (!(s.filters && s.filters.bodega)) {
    const nq = _norm(q);
    for (const [k, c] of _CANON) {
      if (c.tipo !== "bodega" || k.length < 3) continue;
      const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(nq)) { s.filters = { ...(s.filters || {}), bodega: c.nombre }; break; }
    }
  }
  return _cleanFilters(s);
}

// CONTINUIDAD del "por qué": un "por qué" genérico (o sobre el foco de inventario) sigue el ÚLTIMO foco vía composeExplain.
const _BARE_WHY_RE = /^\s*(?:dime\s+|explic[aá]\w*(?:me)?\s+)?(?:el\s+)?por\s?qu[eé](?:\s+(?:ocurre|pasa|sucede|es\s+(?:eso|as[ií])|raz[oó]n|la\s+raz[oó]n))?\s*[?.!¡¿]*$/i;
const _WHY_CAPITAL_RE = /por\s?qu[eé].*(capital|dormid\w*|inmoviliz\w*|no\s+rot\w*|frenad\w*)/i;
function _coerceExplain(q, spec, hasLast) {
  if (!hasLast || !q || !spec) return spec;
  if (_BARE_WHY_RE.test(q) || _WHY_CAPITAL_RE.test(q)) return { ...spec, turn_type: "followup_explain" };
  return spec;
}

// CONTINUIDAD DE ALCANCE (owner 2026-07-06 · "la mesa viva"): un follow-up DEÍCTICO ("y de esos, ¿cuáles…?") referencia el
// conjunto que ADI acaba de nombrar. Acá sólo se DETECTA (puro/testeable); answerConversational hereda el set real
// (last.entityList) como entityScope y el composer filtra por nombre. Referenciales de Chile/es: "de esos/esas/ellos",
// "esos mismos", "de ese grupo/lista", "de los que me mostraste", "de esos que…". NO dispara con genéricos ("de los clientes").
const _DEICTIC_RE = /\b(?:de\s+(?:[eé]sos|[eé]sas|ellos|ellas|[eé]stos|[eé]stas)\b|entre\s+(?:[eé]sos|[eé]sas|ellos|ellas)\b|(?:[eé]sos|[eé]sas)\s+mismos?\b|de\s+(?:ese|esa)\s+(?:grupo|lista|listado|conjunto|selecci[oó]n)|de\s+(?:esa|esas)\s+cuentas?\b|de\s+(?:los|las)\s+(?:mismos|mismas|anteriores)\b|de\s+(?:los|las)\s+que\s+(?:me\s+)?(?:mostr\w*|dij\w*|nombr\w*|sali\w*|apareci\w*|list\w*)|de\s+(?:esos|esas)\s+que\b)/iu;

// MULTI-ANÁLISIS (V3 · Frente C.1): "¿cómo está Lider en margen y rotación?" cruza DOS lentes → turn_type multi_analysis
// (lo resuelve composeMulti reusando los composers vía el seam). CORTA la cadena: si no, el primer coerce de dominio que
// matchee una de las dos métricas se la roba. Corre DESPUÉS de compare (un "compará A y B" es de entidades, no de métricas).
function _coerceMulti(q, spec) {
  if (!q || !spec || spec.operation === "compare") return null;
  const m = detectMultiAnalysis(q);
  if (!m.isMulti) return null;
  // ENTIDAD DESDE EL CANON (botón de la Ficha 2026-07-10: "¿Cómo está ABC en ventas y contribución?" — el detector
  // no resuelve nombres TODO-MAYÚSCULAS como ABC/SAM-TV55 → composeMulti repreguntaba). Borde de palabra y claves
  // ≥3 chars para no pescar "lg" adentro de "algo".
  let ent = m.entity;
  if (!ent) {
    const nq = _norm(q);
    for (const [k, c] of _CANON) {
      if (k.length < 3) continue;
      const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(nq)) { ent = c.nombre; break; }
    }
  }
  // multi es un TURNO, no una operación — se limpia operation para que el blindaje de conversation.js no migre
  // un "clarification_needed" del LLM por encima del claim (mismo patrón que los claims meta del coerce).
  const s = { ...spec, operation: undefined, turn_type: "multi_analysis", multi: { metrics: m.metrics, dimension: m.dimension, entity: ent } };
  if (s.transform) delete s.transform;
  return _cleanFilters(s);
}

// ACEPTACIÓN ("sí" / "dale" / "hazlo" pelado · bug cazado por el owner 2026-07-07): tras una oferta de ADI ("¿te gustaría
// que profundizara?"), un "sí" debe EJECUTAR la oferta — no volver al LLM a adivinar (clasificaba turn_types como
// operations y el seam degradaba con vocabulario interno). Solo mensajes CORTOS que son pura afirmación.
const _AFFIRM_RE = /^\s*(s[ií]|dale|ok(ey)?|ya|bueno|claro|obvio|perfecto|de una|h[aá]z?lo|hacelo|adelante|me parece( bien)?|por ?favor|porfa|s[ií],?\s+(dale|claro|porfa|por ?favor|profundiz[aá]|hazlo|hacelo|adelante))[\s.!…]*$/i;
// CONTINUAR (memoria de la conversación · owner 2026-07-15): "muéstrame más / seguí / continuá / sigamos / vamos"
// aceptan el hilo (la oferta/próxima acción de la memoria) — pero NO pisan una clasificación resuelta del LLM #1
// (review adversarial: si el LLM ya tradujo "muéstrame más" a una operación concreta, esa intención manda).
const _CONTINUE_RE = /^\s*((mu[eé]strame|mostrame|ver|dame|quiero)\s+m[aá]s( detalles?| informaci[oó]n)?|m[aá]s detalles?|segu[ií]|seguimos|sigamos|sigue|contin[uú][aá]|continuemos|avanz[aá]|avancemos|vamos)[\s.!…]*$/i;

// ── SIMULATE (S1/S2 · owner 2026-07-14 "sí, continúa") · red del "¿qué pasa si…?" ────────────────────────────
// El CONDICIONAL es el ancla ("qué pasa(ría) si…" / "cómo queda si…" / "y si…" / "si <verbo>" al inicio) — sin él
// la red NO reclama (protege "30% de margen" / "80% de la contribución" del routing gate, que no son simulación).
const _SIMQ_RE = /\b(qu[eé]\s+pasa(?:r[ií]a)?\s+si|c[oó]mo\s+queda(?:r[ií]a\w*|mos)?\s+si|y\s+si)\b|^\s*¿?\s*si\s+\p{L}/iu;
const _SIM_UP_RE = /\b(sub\w*|aument\w*|crec\w*|increment\w*|agreg\w*|levant\w*|mejor\w*|dupli\w*)\b/i;
const _SIM_DOWN_RE = /\b(baj\w*|ca[eiy]\w*|reduc\w*|recort\w*|disminu\w*|pierd\w*|sac\w*|quit\w*)\b/i;
// acción · carga → target ("si llevo/bajo la carga al target/objetivo" · "y si recupero la carga")
const _SIM_CARGA_RE = /\bcargas?\b[^.?!]*\b(?:target|objetivo)\b|\brecuper\w*\b[^.?!]*\bcarga\b/i;
// acción · liberar el capital detenido ("si libero el capital/stock detenido/inmovilizado/frenado")
const _SIM_CAPLIB_RE = /\b(?:liber\w*|destrab\w*)\b[^.?!]*\b(?:capital|stock|inventario|caja)\b|\b(?:capital|stock)\b[^.?!]*\bliber\w*/i;
function _coerceSimulate(q, spec) {
  if (!_SIMQ_RE.test(q)) return null;
  const _tt = spec.turn_type === "followup_modify_assumption" ? "followup_modify_assumption" : "new_query";
  // ACCIÓN · carga → target (el cliente nombrado viaja como filtro · canon)
  if (_SIM_CARGA_RE.test(q)) {
    const f = { ...(spec.filters || {}) };
    if (!f.cliente) {
      const nq = _norm(q);
      for (const [k, c] of _CANON) {
        if (c.tipo !== "cliente" || k.length < 3) continue;
        const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(nq)) { f.cliente = c.nombre; break; }
      }
    }
    return _cleanFilters({ ...spec, operation: "simulate", metric: "carga", dimension: "cliente", simAction: "carga_target",
      entity: null, comparison: undefined, focus: undefined, transform: undefined, meta: undefined,
      filters: Object.keys(f).length ? f : undefined, turn_type: _tt });
  }
  // ACCIÓN · liberar el capital detenido
  if (_SIM_CAPLIB_RE.test(q)) {
    return _cleanFilters({ ...spec, operation: "simulate", metric: "capital", dimension: "sku", simAction: "liberar_capital",
      entity: null, comparison: undefined, focus: undefined, transform: undefined, meta: undefined, turn_type: _tt });
  }
  // % · el proyector (delta sobre una métrica de nivel). Sin % ni acción → la cadena sigue su curso (no reclama).
  const pm = q.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
  if (!pm) return null;
  let v = parseFloat(pm[1].replace(",", "."));
  if (_SIM_DOWN_RE.test(q) && !_SIM_UP_RE.test(q) && v > 0) v = -v;
  // followup "y si fuera 5%": el LLM ya resolvió el signo desde el contexto — si coincide en valor absoluto, manda su signo
  if (spec.transform && spec.transform.op === "delta" && spec.transform.unit === "pct"
      && Math.abs(Number(spec.transform.value)) === Math.abs(v)) v = Number(spec.transform.value);
  const met = /\b(ventas?|ingresos?|facturaci[oó]n)\b/i.test(q) ? "ventas"
    : /contribuci[oó]n/i.test(q) ? "contribucion"
    : /\b(capital|stock|inventario)\b/i.test(q) ? "capital"
    : /margen/i.test(q) ? "margen"
    : (typeof spec.metric === "string" && spec.metric) || null;
  if (!met) return null;   // ni la pregunta ni el LLM traen métrica → que el camino conversacional resuelva
  const ejeM = q.match(/\b(?:por|de)\s+(?:las?\s+|los?\s+|cada\s+|mis\s+)?(clientes?|skus?|productos?|marcas?|familias?|bodegas?)\b/i);
  // eje del texto si lo nombra; si no, uno VÁLIDO para la métrica (capital vive en sku/bodega · lo comercial no vive en bodega)
  let dim = ejeM ? ({ cliente: "cliente", sku: "sku", producto: "sku", marca: "marca", familia: "familia", bodega: "bodega" })[ejeM[1].toLowerCase().replace(/s$/, "")]
    : (spec.dimension && ENTITIES[spec.dimension]) ? spec.dimension : null;
  if (met === "capital" && dim !== "sku" && dim !== "bodega") dim = "bodega";
  else if (met !== "capital" && (!dim || dim === "bodega")) dim = "cliente";
  return _cleanFilters({ ...spec, operation: "simulate", metric: met, dimension: dim,
    transform: { kind: "assumption", op: "delta", value: v, unit: "pct", base: "real" },
    entity: null, comparison: undefined, focus: undefined, simAction: undefined, meta: undefined, turn_type: _tt });
}

// PREGUNTA-OBJETIVO (owner 2026-07-14): metas de crecimiento/mejora → recommend. Tres señales:
// · _GOAL_PCT_RE: verbo de meta con un % objetivo cerca ("subir un 3% el ingreso…") — la más fuerte.
// · _GOAL_INTENT_RE + _GOAL_VERB_RE: intención de plan ("qué tengo que hacer" / "cómo hago" / "dame
//   alternativas" / "quiero…") COMBINADA con un verbo de meta — ninguna sola alcanza ("quiero ver el
//   margen" no es meta · "bajemos al detalle" no trae intención de plan).
// (1ª persona incluida: "cómo mejoro/subo/reduzco…" — pero "bajo" 1sg SOLO tras "cómo": suelto es preposición
// ("bajo el benchmark"); y "quiero/necesito" NO cuentan si siguen con ver/mirar/saber — eso es pedir una vista)
const _GOAL_VERB_RE = /\b(sub(?:ir|a|o|amos)|aument(?:ar|e|o|emos)|increment(?:ar|e|o|emos)|crec(?:er|zco|amos)|levant(?:ar|e|o|emos)|mejor(?:ar|e|o|emos)|baj(?:ar|e|emos)|reduc(?:ir|za|zco|zcamos)|recort(?:ar|e|o|emos)|recuper(?:ar|e|o|emos)|duplic(?:ar|que|o|uemos)|potenci(?:ar|e|o|emos)|vender\s+m[aá]s|ganar\s+m[aá]s)\b/i;
const _GOAL_INTENT_RE = /\b(qu[eé]\s+(tengo\s+que|hay\s+que|debo|puedo|necesito|podr[ií]a)\s+hacer|c[oó]mo\s+(puedo|hago|hacemos|logro|le\s+hago|subo|bajo|mejoro|aumento|reduzco|crezco|recupero|levanto|recorto)|qu[eé]\s+hago\s+para|dame\s+(alternativas|opciones|caminos|un\s+plan)|qu[eé]\s+alternativas|(quiero|necesito|busco|me\s+gustar[ií]a)\s+(?!ver\b|mirar\b|revisar\b|saber\b|conocer\b|entender\b))\b/i;
const _GOAL_PCT_RE = /\b(sub(?:ir|a)|aument(?:ar|e)|increment(?:ar|e)|crec(?:er)|levant(?:ar|e)|mejor(?:ar|e)|baj(?:ar|e)|reduc(?:ir|za)|recort(?:ar|e))\w*[^.?!]{0,60}?\d+(?:[.,]\d+)?\s*%/i;

// ── FOCO DE ENTIDAD (revisión de la Mesa 2026-07-14) · redes A1/A2 ──────────────────────────────────────────
// «cómo viene/va/está/anda X» — el chequeo de salud de UNA entidad (la Mesa lo emite en "Qué cambió").
const _ENT_COMO_RE = /\bc[oó]mo\s+(?:viene|va|est[aá]|anda|se\s+comporta)\b/i;
// «X vs/contra el año pasado» — la trayectoria de UNA entidad (no la lectura YoY de cartera).
const _ENT_VSANIO_RE = /\b(?:vs\.?|versus|contra)\s+(?:el\s+)?(?:mismo\s+per[ií]odo\s+del?\s+)?a[ñn]o\s+(?:pasado|anterior)\b/i;
// con MÉTRICA nombrada la cadena de dominios manda ("cómo viene el margen" → margin · "en ventas y contribución" → multi)
const _ENT_METRIC_RE = /\b(margen|contribuci[oó]n|carga|ventas?|capital|stock|inventario\w*|rotaci[oó]n|costos?|doh|cobertura|presupuesto|rebates?|unidades|precios?)\b/i;
// «principales/mejores/top N clientes|marcas» → ranking (nivel de venta desc), no los movers de crecimiento
const _ENT_RANK_RE = /\b(?:principales|mejores|mayores|top)\s+(?:\d{1,2}\s+)?(clientes?|marcas?)\b/i;
// exactamente UNA entidad del canon nombrada en la pregunta (borde de palabra · claves ≥3 chars — mismo criterio
// que el rescate de entidad de _coerceMulti); con 0 o 2+ no hay sujeto único → la red no reclama.
function _soloCanonEn(q) {
  const nq = _norm(q);
  const found = new Map();
  for (const [k, c] of _CANON) {
    if (k.length < 3) continue;
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(nq)) found.set(c.nombre, c);
  }
  return found.size === 1 ? [...found.values()][0] : null;
}

// coerceSpec(texto, spec del LLM, hayÚltimaEvidencia, señalesUI) → spec ruteado al dominio+foco correcto (o el original).
export function coerceSpec(q, spec, hasLast, ui = null) {
  // SANEO DE ENTRADA (crash en prod 2026-07-09): filters:null explícito del LLM rompe composers con default {} —
  // se normaliza acá para TODOS los caminos (haya o no _cleanFilters después en la cadena).
  if (spec && spec.filters === null) spec = { ...spec, filters: undefined };
  // CANON DE ENTIDADES (invitado en prod 2026-07-09): "concepcion"→bodega Concepción (filters.bodega) ·
  // "cuidado personal" en un recommend@sku → filters.familia · "falabella"→Falabella. El tipo real manda:
  // si no coincide con la dimensión pedida viaja como filtro; si coincide, la entidad queda con su forma canónica.
  if (spec && typeof spec.entity === "string" && spec.entity.trim()) {
    const c = _canonEntity(spec.entity);
    if (c && c.tipo === "bodega" && spec.dimension !== "bodega") spec = { ...spec, entity: null, filters: { ...(spec.filters || {}), bodega: c.nombre } };
    else if (c && c.tipo === "bodega" && spec.dimension === "bodega" && (spec.operation === "inventory" || spec.operation === "overview")) spec = { ...spec, entity: null, filters: { ...(spec.filters || {}), bodega: c.nombre } };
    else if (c && c.tipo === "familia" && spec.dimension !== "familia") spec = { ...spec, entity: null, filters: { ...(spec.filters || {}), familia: c.nombre } };
    else if (c && c.tipo === "marca" && spec.dimension !== "marca") spec = { ...spec, entity: null, filters: { ...(spec.filters || {}), marca: c.nombre } };
    // …y para SKU/CLIENTE el tipo real también RETARGETEA la dimensión (auditoría de asks 2026-07-15: "Profundiza
    // en PHI-HAIR-PRO" y "Profundiza en Mercado Libre" venían del LLM como dive@marca → brand_dive negaba una
    // entidad que el usuario tenía EN PANTALLA; el nombre es del canon, la vista equivocada no manda).
    else if (c && (c.tipo === "sku" || c.tipo === "cliente") && spec.dimension !== c.tipo) spec = { ...spec, entity: c.nombre, dimension: c.tipo };
    else if (c) spec = { ...spec, entity: c.nombre };   // forma canónica (mayúsculas/tildes del dataset)
  }
  // …y los VALORES de filtros también se canonicalizan (mismo bug: "concepcion" no matcheaba el === del scope)
  if (spec && spec.filters && typeof spec.filters === "object") {
    let ch = null;
    for (const k of ["cliente", "marca", "familia", "bodega", "sku"]) {
      const v = spec.filters[k];
      if (typeof v === "string" && v.trim()) { const c = _canonEntity(v); if (c && c.tipo === k && c.nombre !== v) { ch = ch || { ...spec.filters }; ch[k] = c.nombre; } }
    }
    if (ch) spec = { ...spec, filters: ch };
  }
  // COMPARE FABRICADO (gate de promesas 2026-07-09): el LLM a veces clasifica el CLICK de una sugerencia como COMPARE
  // de "entidades" inventadas (["x","y"] · ["volumen","precio"]) → "No tengo a x" — ADI ofreció y luego negó (promesa
  // rota). Un claim de comparación solo sobrevive ANCLADO: alguna entidad existe en el canon o aparece textual en la
  // pregunta (las de contexto legítimo SON del canon; las que el usuario nombró están en q — aunque no existan, el
  // degrade honesto corresponde). Sin ancla, el claim se limpia y la cadena re-rutea desde el texto (la pregunta manda).
  if (q && spec && spec.comparison && Array.isArray(spec.comparison.entities) && spec.comparison.entities.length) {
    const nq = _norm(q);
    const anclada = spec.comparison.entities.some((e) => typeof e === "string" && _norm(e).length >= 2 && (_canonEntity(e) || nq.includes(_norm(e))));
    if (!anclada) spec = { ...spec, operation: spec.operation === "compare" ? "overview" : spec.operation, comparison: undefined };
  }
  // DEÍCTICO DE UI (owner 2026-07-08 · "compará estos dos" mirando la Mesa): la SELECCIÓN de la Mesa es el referente —
  // determinístico, sin que el LLM adivine. Solo con 2 seleccionados + intención de comparar + referencial plural.
  if (q && spec && ui && Array.isArray(ui.mesaSel) && ui.mesaSel.length === 2
      && /(compar|versus|\bvs\b|diferenc|enfrent)/i.test(q) && /\b(estos|esos|estas|esas)\s*(dos|2)?\b/i.test(q)) {
    const d = ui.mesaDim || "cliente";
    return { ...spec, operation: "compare", metric: spec.metric || "margen", dimension: d,
      comparison: { dimension: d, entities: [...ui.mesaSel] }, turn_type: "new_query" };
  }
  // SALUDO / AYUDA (sweep simple 2026-07-09 · primera impresión): "hola"/"buenas"/"ayuda" pelado → bienvenida
  // determinística con orientación (composeMeta saludo · verbatim). Antes lo agarraba una lectura random del LLM.
  // (los claims meta LIMPIAN operation: si el LLM trajo "clarification_needed" ahí, el blindaje de conversation.js
  // migraría ese operation por sobre el turn_type coercido y el redirect se perdería en una repregunta)
  if (q && spec && /^\s*¿?(hola+|buenas(\s+(tardes|noches))?|buen(os)?\s+d[ií]as|hey|hi|hello|qu[eé] tal|c[oó]mo andas|c[oó]mo and[aá]s|ayuda|help|no s[eé] por d[oó]nde empezar|por d[oó]nde empiezo)[\s!.,?]*$/i.test(q))
    return { ...spec, operation: undefined, turn_type: "meta_question", meta: "saludo" };
  // FUERA DE DATO (owner 2026-07-09 · "¿analizamos las campañas de marketing?" — promesa rota del narrador): si el
  // usuario pregunta por data que NO existe (marketing/campañas/publicidad/competencia/…), nada de clarificar como
  // si existiera ni dejar que el LLM fabule — ADI se adueña: declara el límite y CONVIERTE hacia las palancas
  // disponibles (composeMeta "fuera_de_dato" · chips probadas por el gate de promesas). Corta la cadena.
  if (q && spec && OUT_OF_DATA_RE.test(q))
    return { ...spec, operation: undefined, turn_type: "meta_question", meta: "fuera_de_dato" };
  // MEMORIA DE CRITERIO (V5 · Frente C.2): "recordá que mi margen mínimo es 28%" / "¿qué recordás?" / "olvidá X" corre
  // PRIMERO y CORTA la cadena — si no, el coerce de margen roba "margen mínimo" y responde una lectura en vez de guardar.
  if (q && spec) {
    const ci = detectCriteriaIntent(q);
    if (ci) return { ...spec, turn_type: "apply_criteria", criteria: ci };
    if (hasLast && String(q).length <= 28 && _AFFIRM_RE.test(q)) return { ...spec, turn_type: "followup_accept" };
    // "continuar" reclama SOLO si el turno no llegó ya resuelto (op concreta del LLM ≠ clarificación) — el piso
    // (spec base clarification_needed) siempre entra; una traducción específica del LLM #1 no se pisa.
    if (hasLast && String(q).length <= 28 && _CONTINUE_RE.test(q) && !(spec.operation && spec.operation !== "clarification_needed"))
      return { ...spec, turn_type: "followup_accept" };
  }
  // RESUMEN DEL NEGOCIO (owner 2026-07-08): "dame un resumen del negocio / panorama general / cómo está mi negocio"
  // → el DIAGNÓSTICO ejecutivo (los focos con su $), no un ranking suelto. Determinístico, antes de los dominios.
  // + "¿cómo vengo/venimos/vamos?" pelado (sweep 2026-07-09: el LLM lo parseaba como dive sin entidad — o con entidad "tú").
  // + "resumen ejecutivo" pelado y "resumen/panorama" a secas (owner probó 2026-07-10: "hazme un resumen ejecutivo"
  //   caía en un ranking de ventas narrado — el detector exigía "del negocio").
  if (q && spec && /(resumen|panorama|foto|radiograf[ií]a)\s+(ejecutiv[oa]\s+)?(general\s+)?(de(l)?\s+)?(mi\s+|la\s+|el\s+)?(negocio|empresa|cartera|situaci[oó]n)|(resumen|panorama)\s+ejecutiv[oa]\b|^\s*¿?\s*(hazme\s+|dame\s+|hac[eé]me\s+|quiero\s+)?(un\s+)?(resumen|panorama)\s*[?.!]*\s*$|c[oó]mo\s+(est[aá]|va|viene)\s+(mi\s+|el\s+)?negocio|^\s*¿?\s*c[oó]mo\s+(vengo|venimos|vamos|voy|andamos|ando)\s*\??\s*$/i.test(q))
    return _cleanFilters({ ...spec, operation: "diagnose", focus: "resumen_ejecutivo", metric: spec.metric || "contribucion", dimension: "cliente", turn_type: "new_query" });
  // ── FOCO DE ENTIDAD (revisión de contrato de la Mesa 2026-07-14: «¿Cómo viene Lider vs el año pasado?» respondía
  // la CARTERA con Lider de bullet, y «¿Quiénes son mis principales clientes por venta?» respondía los movers de
  // crecimiento): cuando la pregunta nombra UNA entidad del canon como sujeto, la respuesta es de ESA entidad. ──
  // A1 · «cómo viene/va/está X» o «X vs el año pasado» SIN métrica nombrada → el DIVE de la entidad (perfil +
  // trayectoria YoY + causas), nunca la lectura de cartera. Con métrica nombrada ("cómo viene el margen") o con
  // enumeración de métricas (multi C.1) la cadena sigue su curso — el guard de métrica lo asegura.
  if (q && spec && (_ENT_COMO_RE.test(q) || _ENT_VSANIO_RE.test(q)) && !_ENT_METRIC_RE.test(q)) {
    const ent = _soloCanonEn(q);
    if (ent) return _cleanFilters({ ...spec, operation: "dive", entity: ent.nombre, dimension: ent.tipo,
      metric: spec.metric || "ventas", focus: undefined, comparison: undefined, turn_type: "new_query" });
  }
  // A2 · «principales/mejores/top clientes|marcas (por venta)» → RANKING de ventas desc (el nivel, no el movimiento).
  // Si nombra otra métrica (margen/contribución/…), su dominio la reclama — este net no se la roba.
  if (q && spec) {
    const mR = q.match(_ENT_RANK_RE);
    if (mR && !/(margen|contribuci[oó]n|carga|capital|costo|rotaci[oó]n|doh|cobertura|crecimiento)/i.test(q)) {
      const nM = q.match(/\b(\d{1,2})\b/);
      return _cleanFilters({ ...spec, operation: "rank", metric: "ventas", dimension: /marca/i.test(mR[1]) ? "marca" : "cliente",
        entity: null, focus: undefined, comparison: undefined, sort: { dir: "desc" }, limit: nM ? Number(nM[1]) : 5, turn_type: "new_query" });
    }
  }
  // ENTIDAD-PRONOMBRE (sweep 2026-07-09): el LLM #1 a veces "resuelve" un pronombre como entidad ("tú"/"mi"/"eso")
  // → dive de una entidad absurda ("No tengo a tú en el detalle…"). Se anula → el seam repregunta honesto.
  if (spec && typeof spec.entity === "string" && /^(t[uú]|yo|vos|usted|mi|m[ií]o|nuestro|ese|esa|eso|este|esta|esto|[eé]l|ella)$/i.test(spec.entity.trim()))
    spec = { ...spec, entity: null };
  // SIMULATE (S1/S2 · owner 2026-07-14 "sí, continúa") · red del "¿qué pasa si…?": el CONDICIONAL manda. Dos formas —
  // un % sobre una métrica de nivel → operation simulate + transform delta (el proyector) · una ACCIÓN específica →
  // carga al target (cliente opcional del canon) / liberar el capital detenido (el $ del detector como proyección).
  // Corre ANTES de la red goal (el condicional es más específico que la meta) y de los dominios (que borran transform).
  // NO pisa los SIM_PCT del routing gate ("30% de margen" · "80% de la contribución"): sin condicional no hay red.
  if (q && spec) {
    const sim = _coerceSimulate(q, spec);
    if (sim) return sim;
  }
  // PREGUNTA-OBJETIVO (owner 2026-07-14: «dime qué tengo que hacer para subir un 3% el ingreso de mis ventas,
  // dame alternativas» cayó UNA vez en meta_question y el narrador fabuló un menú con "no tengo datos frescos"):
  // toda META de crecimiento/mejora sobre una métrica del dato ("cómo subo/bajo/mejoro X" · "quiero crecer N% en X"
  // · "dame alternativas para…") es un pedido de PALANCAS → recommend, determinístico, para CUALQUIER métrica
  // (ventas/margen/contribución/capital). La pregunta manda — se acaba la ruleta del traductor. CORTA la cadena.
  if (q && spec && (_GOAL_PCT_RE.test(q) || (_GOAL_INTENT_RE.test(q) && _GOAL_VERB_RE.test(q)))) {
    const gm = /\b(inventarios?|stock|capital|rotaci[oó]n|bodegas?)\b/i.test(q) ? ["capital", "bodega"]
      : /\b(margen|rentabilidad)\b/i.test(q) ? ["margen", "cliente"]
      : /\b(contribuci[oó]n|utilidad|ganancias?|plata|dinero)\b/i.test(q) ? ["contribucion", "cliente"]
      : /\b(ventas?|ingresos?|facturaci[oó]n|vender)\b/i.test(q) ? ["ventas", "cliente"]
      : /\b(carga|rebates?|descuentos?)\b/i.test(q) ? ["margen", "cliente"] : null;
    if (gm) {
      let f = { ...(spec.filters || {}) };
      if (!f.familia && !f.marca && !f.cliente && !f.bodega) {
        const nq = _norm(q);
        for (const [k, c] of _CANON) if ((c.tipo === "familia" || c.tipo === "marca" || c.tipo === "cliente") && nq.includes(k)) { f[c.tipo] = c.nombre; break; }
      }
      // transform/simulate FUERA (dist real 2026-07-14: el LLM a veces ancla el "3%" como supuesto target → el
      // seam bifurca a proyección o a simulate-bloqueado según la forma; una META pide PALANCAS, no un supuesto)
      // META-AWARE (SIMULATE S3 · 2026-07-15): el % objetivo ya NO se descarta — viaja como spec.goal y el
      // recommend lo ancla al dato ("3% de $100.0M = $3.0M al año") con los caminos cuantificados.
      const gp = q.match(/(\d+(?:[.,]\d+)?)\s*%/);
      const goal = gp ? { pct: parseFloat(gp[1].replace(",", ".")), dir: (/\b(baj\w*|reduc\w*|recort\w*|disminu\w*|liber\w*)\b/i.test(q) ? "bajar" : "subir") } : undefined;
      return _cleanFilters({ ...spec, operation: "recommend", entity: null, metric: gm[0], dimension: gm[1], focus: undefined, comparison: undefined, meta: undefined, transform: undefined, simulate: undefined, ...(goal ? { goal } : {}), filters: Object.keys(f).length ? f : undefined, turn_type: "new_query" });
    }
  }
  // RECOMENDACIÓN explícita (invitado 2026-07-09: "invierto en cuidado personal, ¿qué me recomendás?" caía en una
  // lectura global de ventas): sin hilo previo, "qué me recomendás" → recommend y CORTA la cadena (los coerces de
  // dominio le robaban el claim al LLM cuando la pregunta olía a ventas/margen). Ancla: los filtros del spec (el
  // canon ya los normalizó) o, si faltan, las entidades NOMBRADAS en la pregunta (familia/marca/cliente del dataset).
  if (q && spec && !hasLast && /(qu[eé]\s+(me\s+)?recomiend|qu[eé]\s+(me\s+)?recomend[aá]s|recomendaci[oó]n\b)/i.test(q)) {
    let f = { ...(spec.filters || {}) };
    if (!f.familia && !f.marca && !f.cliente && !f.bodega) {
      const nq = _norm(q);
      for (const [k, c] of _CANON) if ((c.tipo === "familia" || c.tipo === "marca" || c.tipo === "cliente") && nq.includes(k)) { f[c.tipo] = c.nombre; break; }
    }
    return _cleanFilters({ ...spec, operation: "recommend", entity: null, filters: Object.keys(f).length ? f : undefined, turn_type: "new_query" });
  }
  const afterCompare = _coerceCompare(q, spec);
  const multi = _coerceMulti(q, afterCompare);
  if (multi) return multi;   // short-circuit: la enumeración de métricas manda (los coerces de dominio no la roban)
  const s = _coerceExplain(q, _coerceInventory(q, _coerceVentas(q, _coerceMargin(q, _coerceContribucion(q, afterCompare)))), hasLast);
  // RESCATE DE CLARIFICACIÓN (gate de promesas 2026-07-09): el LLM a veces responde clarification_needed a una pregunta
  // AUTOSUFICIENTE ("costo por cliente" — sugerencia de la propia ADI). Si el texto nombra una métrica del contrato, no
  // se repregunta: se reescribe a overview métrica@eje y el contrato ejecuta o declara su límite. Sin métrica nombrada,
  // la clarificación sigue su curso honesto (conversation.js la resuelve como pregunta de vuelta, no como "no lo tengo").
  if (q && s && s.operation === "clarification_needed") {
    // "Profundiza en X" (botón de la Ficha 2026-07-10) — autosuficiente si X está en el canon → dive directo
    const mProf = q.match(/\bprofundiz\w*\s+(?:en\s+)?(.+?)[?.!\s]*$/i);
    if (mProf) {
      const c = _canonEntity(mProf[1].replace(/^(las?\s+ventas?\s+de|el\s+margen\s+de|la\s+)\s*/i, ""));
      if (c) return _cleanFilters({ ...s, operation: "dive", entity: c.nombre, dimension: c.tipo, metric: s.metric || "margen", focus: undefined, turn_type: "new_query" });
    }
    const met = /\bventas?\b/i.test(q) ? "ventas" : /margen/i.test(q) ? "margen" : /contribuci[oó]n/i.test(q) ? "contribucion"
      : /\bcostos?\b/i.test(q) ? "costo" : /\bcarga\b/i.test(q) ? "carga" : /(capital|stock|inventari)/i.test(q) ? "capital"
      : /rotaci[oó]n/i.test(q) ? "rotacion" : /(\bdoh\b|cobertura)/i.test(q) ? "doh" : null;
    if (met) {
      const eje = q.match(/\b(?:por|del?)\s+(?:los\s+|las\s+|cada\s+|mis\s+)?(clientes?|skus?|productos?|marcas?|familias?|bodegas?)\b/i);
      const dim = eje ? { cliente: "cliente", sku: "sku", producto: "sku", marca: "marca", familia: "familia", bodega: "bodega" }[eje[1].toLowerCase().replace(/s$/, "")]
        : (met === "capital" || met === "rotacion" || met === "doh" ? "sku" : "cliente");
      return _cleanFilters({ ...s, operation: "overview", metric: met, dimension: dim, focus: undefined, turn_type: "new_query" });
    }
  }
  // marca el turno deíctico SÓLO si además ruteó a un dominio que sabe filtrar por nombre (margin/contribucion/ventas/inventory)
  if (hasLast && q && s && _DEICTIC_RE.test(q) && (s.operation === "margin" || s.operation === "contribucion" || s.operation === "ventas" || s.operation === "inventory"))
    return { ...s, _deictic: true };
  return s;
}

/* ── PISO CON RED (owner 2026-07-15: el click "Ver todo el inventario" de la Mesa cayó al smart-guide genérico —
 * "se pierde la experiencia") ─────────────────────────────────────────────────────────────────────────────────
 * Las preguntas que la PROPIA UI emite (tramos/KPIs/chips/cards) son promesas gate-proven de ESTA cadena — pero
 * el camino sin LLM (demo floor y el fallback con gateway caído) iba directo al parse regex de answerADI, que no
 * las conoce. coerceFloor corre la MISMA cadena con el spec-base "clarification_needed" (la forma exacta que el
 * gate de promesas prueba): si algún detector/claim RECLAMA el texto, devuelve el spec ruteado para ejecutar por
 * answerConversational; si nada reclama, null — y el piso sigue con answerADI (texto libre intacto, byte-exacto).
 * Puro y gate-testable (la forma "piso" del _promise_gate lo lockea). */
const _FLOOR_BASE = () => ({ schemaVersion: 1, operation: "clarification_needed", metric: null, dimension: null, entity: null, filters: null });
export function coerceFloor(q, hasLast, ui = null) {
  let s;
  try { s = coerceSpec(q, _FLOOR_BASE(), hasLast, ui); } catch { return null; }
  if (!s) return null;
  if (s.operation && s.operation !== "clarification_needed") return s;                 // un dominio/red reclamó (inventory/margin/ventas/…)
  if (!s.operation && s.turn_type && s.turn_type !== "clarification_needed") return s; // un claim de TURNO reclamó (meta/multi/accept/criteria)
  return null;
}
