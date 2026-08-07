/* === responseContract.js · CONTRATO v2 · FASE 4 (owner 2026-08-07) ===================================
 * EL PROBLEMA que cierra: hoy cada ruta de respuesta devuelve una FORMA distinta (mapeo real, auditoría 2026-08-07):
 *   · oracle              text · route · evidence · suggestions · sentrixAction        (sin intent, sin context)
 *   · answerADI legacy    text · suggestions · sentrixAction · intent · route · context · evidence (condicional)
 *   · answerADIFromSpec   igual que legacy, pero evidence a veces null
 *   · pnl                 text · suggestions · sentrixAction · evidence · route        (sin intent, sin context)
 *   · conversation        text · suggestions · sentrixAction · evidence · route        (sin intent, sin context)
 * `text` y `route` son las ÚNICAS dos claves presentes en las cinco. Cada consumidor (UI, memoria, contractCloser,
 * _threadContext) tiene entonces que defenderse solo, y ahí es donde aparecen los huecos reales que la auditoría
 * encontró: `contractCloser` interpola `suggestions[0]` como STRING mientras `filterTextualSuggestions` deja pasar
 * objetos `{action:{type}}`; el chip de la UI renderiza `string | {text}` y con cualquier otra forma pinta un botón
 * VACÍO; `_threadContext` lee `sentrixAction.payload.clientes` sin verificar que exista.
 *
 * ESTE MÓDULO es el contrato de salida COMÚN: una sola forma, garantizada por construcción, para toda ruta.
 *   { text, route, intent, context, evidence, suggestions, sentrixAction, claims }
 * No cambia NINGUNA decisión de negocio — solo garantiza la forma y COERCIONA lo que hoy puede llegar mal tipado.
 * Es intencionalmente puro y sin dependencias: cualquier ruta (oracle, legacy, P&L, conversación) puede pasar por
 * acá sin arrastrar el motor del oráculo.
 *
 * LÍMITE HONESTO (lo que este contrato NO hace): unificar la FORMA no unifica la GARANTÍA NUMÉRICA. guardC sigue
 * corriendo SOLO en el oráculo (único importador de guardC.js) — legacy/P&L/conversación siguen con sus propios
 * guards (numberGuard/voiceGuard). Este módulo cierra el contrato estructural; el guard común de cifras exige que
 * esas rutas produzcan boleta, y eso es la adaptación progresiva que el owner autorizó, no un cambio de esta fase.
 */

export const RESPONSE_CONTRACT_VERSION = 1;

// Las 8 claves del contrato. Orden estable (los gates comparan claves, y un orden estable hace el diff legible).
export const RESPONSE_KEYS = ["text", "route", "intent", "context", "evidence", "suggestions", "sentrixAction", "claims"];

// ── SUGGESTIONS ────────────────────────────────────────────────────────────────────────────────────────────────
// Contrato: `string[]` con al menos un elemento, o `null`. NUNCA `[]` (los tres wrappers legacy ya normalizaban
// `[]`→null por su cuenta; acá pasa a ser la regla, una sola vez).
// COERCIÓN: un elemento `{text}` se aplana a su string (es la forma que la UI ya aceptaba); cualquier otra forma
// (ej. `{action:{type:"..."}}`, que hoy puede sobrevivir a filterTextualSuggestions y pintar un botón vacío) se
// DESCARTA en vez de viajar rota. Se prefiere perder una chip a renderizar una chip que no dice nada.
export function normalizeSuggestions(s) {
  if (!Array.isArray(s)) return null;
  const out = [];
  for (const x of s) {
    if (typeof x === "string") { const t = x.trim(); if (t) out.push(t); continue; }
    if (x && typeof x === "object" && typeof x.text === "string") { const t = x.text.trim(); if (t) out.push(t); }
  }
  return out.length ? out : null;
}

// ── SENTRIX ACTION (el CTA) ────────────────────────────────────────────────────────────────────────────────────
// Contrato: `{ label, moduleChip, payload: { modulo, clientes: string[], skus: string[], ...resto } }` o `null`.
// `label` es obligatorio (la UI ya retorna null sin él) y `payload.clientes`/`payload.skus` se garantizan ARRAYS
// aunque el productor los haya omitido — `_threadContext` los indexa sin chequear, y ese es el crash latente.
// El resto del payload viaja intacto (mechanismBanner y cualquier campo que un composer futuro agregue).
export function normalizeSentrixAction(a) {
  if (!a || typeof a !== "object") return null;
  const label = typeof a.label === "string" ? a.label.trim() : "";
  if (!label) return null;   // sin label la UI no puede pintar el botón: es acción inválida, no acción vacía
  const p = (a.payload && typeof a.payload === "object") ? a.payload : {};
  const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : []);
  return {
    label,
    moduleChip: typeof a.moduleChip === "string" ? a.moduleChip : null,
    payload: { ...p, modulo: typeof p.modulo === "string" ? p.modulo : null, clientes: strs(p.clientes), skus: strs(p.skus) },
  };
}

// ── CLAIMS ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Proyección COMPACTA de los claims sellados (narrationContract.js) hacia la salida: lo que cualquier consumidor
// necesita para auditar una cifra sin cargar el claim completo. Se queda en `r.claims` (disponible para Sentrix,
// telemetría y gates) y deliberadamente NO se copia al historial de mensajes de la UI — el historial guarda texto,
// no la boleta entera de cada turno.
export function projectClaims(claims) {
  if (!Array.isArray(claims) || !claims.length) return null;
  return claims.filter(Boolean).map((c) => ({
    entidad: c.entidad || null,
    metrica: c.metrica || null,
    unidad: c.unidad || null,
    valor: c.valor,
    estatus: c.estatus || "probado",
    formula: c.formula || null,
    etiqueta: c.etiqueta || null,
  }));
}

// ── LA NORMALIZACIÓN ───────────────────────────────────────────────────────────────────────────────────────────
// normalizeResponse(r) → el objeto con las 8 claves SIEMPRE presentes. Lo que la ruta no produce queda `null`
// EXPLÍCITO (no ausente): un consumidor que hace `r.intent` deja de recibir `undefined` según qué ruta respondió.
// Las claves EXTRA de cada ruta (deterministic, narrationRepaired, retryTrace, requestContext…) se conservan tal
// cual — son telemetría legítima y unificar la forma no significa amputar lo que una ruta sabe de más.
export function normalizeResponse(r) {
  if (!r || typeof r !== "object") return null;
  const { text, route, intent, context, evidence, suggestions, sentrixAction, claims, ...resto } = r;
  return {
    ...resto,
    text: typeof text === "string" ? text : (text === null ? null : String(text == null ? "" : text)),
    route: typeof route === "string" ? route : null,
    intent: typeof intent === "string" ? intent : (typeof route === "string" ? route : null),   // legacy ya usaba route como intent por defecto
    context: (context && typeof context === "object") ? context : null,
    evidence: (evidence && typeof evidence === "object") ? evidence : null,
    suggestions: normalizeSuggestions(suggestions),
    sentrixAction: normalizeSentrixAction(sentrixAction),
    claims: Array.isArray(claims) ? projectClaims(claims) : (claims == null ? null : null),
  };
}

// assertResponseContract(r) → [] si cumple, o la lista de violaciones. Es lo que usan los gates: la afirmación
// "toda ruta devuelve la misma forma" tiene que ser verificable, no declarada.
export function assertResponseContract(r) {
  const v = [];
  if (!r || typeof r !== "object") return ["la respuesta no es un objeto"];
  for (const k of RESPONSE_KEYS) if (!(k in r)) v.push(`falta la clave \`${k}\``);
  if ("text" in r && r.text !== null && typeof r.text !== "string") v.push("`text` no es string ni null");
  if ("route" in r && r.route !== null && typeof r.route !== "string") v.push("`route` no es string ni null");
  if ("suggestions" in r && r.suggestions !== null) {
    if (!Array.isArray(r.suggestions)) v.push("`suggestions` no es array ni null");
    else if (!r.suggestions.length) v.push("`suggestions` es `[]` (el contrato exige null cuando no hay)");
    else if (!r.suggestions.every((x) => typeof x === "string")) v.push("`suggestions` trae elementos que no son string (la UI y contractCloser los interpolan como texto)");
  }
  if ("sentrixAction" in r && r.sentrixAction !== null) {
    const a = r.sentrixAction;
    if (!a || typeof a !== "object") v.push("`sentrixAction` no es objeto ni null");
    else {
      if (typeof a.label !== "string" || !a.label.trim()) v.push("`sentrixAction.label` ausente o vacío");
      if (!a.payload || typeof a.payload !== "object") v.push("`sentrixAction.payload` ausente");
      else {
        if (!Array.isArray(a.payload.clientes)) v.push("`sentrixAction.payload.clientes` no es array (_threadContext lo indexa sin chequear)");
        if (!Array.isArray(a.payload.skus)) v.push("`sentrixAction.payload.skus` no es array (_threadContext lo indexa sin chequear)");
      }
    }
  }
  if ("claims" in r && r.claims !== null && !Array.isArray(r.claims)) v.push("`claims` no es array ni null");
  return v;
}

// ── MEMORIA CANÓNICA + VISTA DERIVADA ──────────────────────────────────────────────────────────────────────────
// El owner pidió "una memoria canónica con vistas derivadas de compatibilidad". CANÓNICO = `conversationScope`
// (conversationScope.js: versionado, con turno/dimension/entities/selection/periodo/filtros/metrica/operacion/
// modo/tool/origen/supuestos/faltantes/ofertaPendiente/tenant). La vista LEGACY `memoria`
// ({entidad, tema, oferta, sugerencias, proximaAccion, ruta}) tiene lectores REALES que no se tocan en esta fase
// (ChatADI _hasThread, buildConversationContext → el prompt del LLM #1, conversation.js composeExplain/Compare,
// pnl.js), así que se DERIVA del canónico en vez de mantenerse como una segunda verdad escrita a mano.
//
// PRECEDENCIA (importa): `conversationScope.current` gana sobre lo previo, pero NUNCA borra lo que el canónico no
// sabe — si el turno no resolvió entidad, se hereda la anterior (mismo criterio que updateMemoria, que también
// arrastra `p.entidad`). Sin conversationScope devuelve null y el caller se queda con updateMemoria: la vista
// derivada REEMPLAZA al escritor legacy solo donde el canónico existe.
export function deriveMemoriaLegacy(conversationScope, { prev = null, route = null, suggestions = null } = {}) {
  const cur = conversationScope && conversationScope.current;
  if (!cur) return null;
  const p = prev || {};
  const nombre = Array.isArray(cur.entities) && cur.entities.length ? cur.entities[0] : null;
  const entidad = nombre ? { nombre, eje: cur.dimension || null } : (p.entidad || null);
  const metrica = cur.metrica || (p.tema && p.tema.metrica) || null;
  const dimension = cur.dimension || (p.tema && p.tema.dimension) || null;
  const sug = normalizeSuggestions(suggestions);
  // OJO — hay DOS extractOffer y devuelven cosas distintas: el canónico (dialogueState.js) devuelve el OBJETO
  // {texto, entidad, dimension, tool, args…} que es lo que vive en `ofertaPendiente`; el legacy (conversation.js)
  // devuelve un STRING, y eso es lo que los lectores de esta vista esperan (_hasThread lo evalúa por verdad, pero
  // buildConversationContext lo INTERPOLA en el prompt del LLM #1 — un objeto ahí saldría como "[object Object]").
  // La vista derivada aplana al texto; el objeto completo sigue disponible en el canónico para quien lo necesite.
  const op = cur.ofertaPendiente;
  const oferta = (op && typeof op === "object") ? (op.texto || null) : (typeof op === "string" ? op : null);
  return {
    entidad,
    tema: (metrica || dimension) ? { metrica, dimension } : (p.tema || null),
    oferta,
    sugerencias: sug,
    proximaAccion: (sug && sug[0]) || null,
    ruta: route || null,
  };
}
