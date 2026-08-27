/* === src/ui/ChatADI.jsx · PanelADI ADELGAZADO ===
 * Cáscara React del chat (input · transcript · typewriter · suggestions).
 * REGLA MADRE: la UI CONSUME answerADI, no recalcula. La decisión vive en answerADI (sellado).
 * El patrón del piso "setX(...) + return dentro del handler" se reduce a:
 *   const turn = buildAdiTurn(q, context, scenario)  →  aplicar setMessages/setContext con turn.
 * Lo diferido del PanelADI monolítico (memoria org · prefs · proactive · persistencia de chats ·
 * hero magic-moment) NO entra acá: el HANDOFF §2 define el adelgazado como solo la cáscara. */
import React, { useState, useRef, useEffect, useMemo } from "react";
import { answerADI } from "../adi/answerADI.js";
import { answerADIFromSpec } from "../adi/answerADIFromSpec.js";   // Paso 5 · camino LLM (spec → ejecución local)
import { answerConversational, buildConversationContext, updateMemoria, responderPorQueCifra } from "../adi/conversation.js";   // parse conversacional V1 · ruteo por turn_type + contexto + LA BOLETA DE MEMORIA (el "sí"/"compáralo"/"muéstrame más" la consumen)
import { pickNarratedText, shouldNarrate } from "../adi/llm/numberGuard.js";   // Paso 5 · number-guard + política de narración (degrades honestos van crudos)
import { stripRoboticVoice, stripProactiveSuffix, stripOutOfDataOffers, stripLanguageLeaks } from "../adi/llm/voiceGuard.js";   // guard de voz determinístico + muletilla proactiva + oferta fuera-de-dato + leaks de idioma/slang (owner 2026-07-09/10)
import { coerceSpec, coerceFloor } from "../adi/coerceChain.js";   // cadena de coerce "la pregunta manda el foco" + la RED del piso sin LLM (las promesas de la UI responden en todos los modos)
import { getUISignals } from "../adi/uiSignals.js";   // memoria UI (owner 2026-07-08) · la Mesa/paneles informan el contexto conversacional
import { resetPnlDraft, ensurePnlNarration, detectPnlIntent, pnlScope } from "../adi/pnl.js";   // P&L · reset del flujo a medio armar + F4: post-check de frases de la narración (graduación/sello asegurados en código) + la red que le CEDE el turno del P&L a la ruta vieja (C no tiene el flujo guiado) + pnlScope: Etapa 3 (owner 2026-08-04), proyección de entidad hacia conversationScope al SALIR de un turno de P&L
import { getAccessCode } from "../adi/accessClient.js";   // demo privada · el código viaja en cada llamada al gateway
import { chartForEvidence } from "../adi/sentrix/chartSpec.js";   // I1 gráfico en la respuesta (owner 2026-07-09) · despachador determinístico
import { buildPulsoInicio } from "../adi/sentrix/pulsoInicio.js";   // la banda de cifras del inicio · el MOTOR la arma, esta vista solo la pinta (CLAUDE.md §2.3)

/* LA COLUMNA DEL AVATAR · todo lo que ADI dice arranca corrido estos píxeles, porque a su izquierda va el
 * hexágono de la firma. El campo de envío lo usa para quedar a plomo con el texto de las respuestas.
 * Y el ancho de la barra de scroll del transcript, que corre su centrado ~4 px y hay que devolver del otro lado. */
const _GUTTER_ADI = 44;
const _SCROLLBAR = 8;
import { InlineChart } from "./InlineChart.jsx";
import { composeFollowupRecommendation } from "../adi/specRetrieval.js";   // follow-up (fallback regex del camino sin LLM)
import { ADI_LLM_ENABLED, ADI_LLM_NARRATE_ENABLED, ADI_ORACLE_ENABLED, ADI_CLAIMS_ONLY_ENABLED, ADI_BYPASS_SIN_PAGO, ADI_CAMINO_NATURAL } from "../config/voiceFlags.js";   // Paso 5 · switch demo/LLM + sub-flag narración · Arquitectura C · oráculo verificado (Fase 3 · detrás de flag) · bypass sin pago (detrás de flag, hoy apagado) · camino natural como principal (owner 2026-08-14)
import { registrarTurno, resumenTelemetria, exportarTelemetria, borrarTelemetria } from "../adi/telemetria.js";   // el renglón de salud del turno · sin dato de negocio (ver telemetria.js)
import { answerViaNatural } from "../adi/oracle/caminoNatural.js";   // el camino natural: cerebro único + notario + ciclo de reparación (flag ADI_CAMINO_NATURAL)
import { puedeResponderSinPagar } from "../adi/bypassConfianza.js";   // ¿el piso entiende esta pregunta lo bastante bien como para NO pagar? (owner 2026-08-12)
import { getLastOffer } from "../adi/oracle/dialogueState.js";   // la oferta viva del turno anterior — cambia el sentido de "sí" o "el segundo"
import { answerViaOracle } from "../adi/oracle/answerViaOracle.js";   // Arquitectura C · Fase 3 · seam PLAN→BATCH→NARRAR (fallback intacto)
import { buildRequestContext } from "../adi/oracle/requestContext.js";   // multiempresa (owner 2026-07-29): tenant/conversación/snapshot explícitos, nunca implícitos
import { buildNarrateUserMessageC } from "../adi/oracle/narratePromptC.js";
import { proyectarDatoNegocio } from "../adi/oracle/datoProyectado.js";   // AMPLITUD F1: el dato completo del negocio al segmento fijo de NARRAR
import { deriveMemoriaLegacy } from "../adi/responseContract.js";   // Contrato v2 · Fase 4: la memoria legacy pasa a ser una VISTA del canónico (conversationScope), no una segunda verdad
import { estimateCostUSD } from "../adi/llm/modelPricing.js";   // router de modelo (owner 2026-08-02) · costo real por intento, observable por turno
import { C, T, esPapel, esSuperficieADI } from "./theme.js";
import { renderMarkdownLite, isTabularText, parseMarkdownTable } from "./markdown.jsx";
import { TypewriterText } from "./TypewriterText.jsx";

// Cuando answerADI devuelve route="not_yet_extracted" (text null), el motor es honesto: no inventa.
// La UI refleja esa honestidad en vez de fabricar un overview.
export const NOT_YET_TEXT =
  "Esa vista todavía no la tengo lista — y prefiero no inventarte un número. Hoy te puedo ayudar con ventas, márgenes e inventario, por cliente, producto, marca o bodega. ¿Arrancamos por ahí?";

// UX pre-prod · saca el LENGUAJE DE ESCENARIO DEMO de lo que ve el usuario. El motor sigue devolviendo "Bonanza"
// (byte-exacto · gate intacto) · esto es SOLO display: "escenario <nombre>" → "escenario actual". NO toca cifras.
function _sanitizeScenario(text) {
  return typeof text === "string" ? text.replace(/(escenario\s+)(bonanza|tensi[oó]n|tension|crisis)/gi, "$1actual") : text;
}

// pnlScope() (pnl.js) → { dimension, entity|null, entities|null, global? } — el hilo PROPIO de P&L ("P&L de
// Falabella" / "los que veníamos mirando"). Etapa 3 (owner 2026-08-04, "wiring de P&L a conversationScope, sin
// reescribir su motor"): al SALIR de un turno de P&L con una entidad EXPLÍCITA en foco, esa entidad se proyecta
// hacia conversationScope.current — construyendo el MISMO shape que produce updateConversationScope
// (conversationScope.js), nunca un shape paralelo — así "¿y su margen?" al VOLVER a Oracle después de mirar el
// P&L de una entidad resuelve ESA entidad, no la que Oracle tenía antes de entrar al P&L (ver pnl.js:
// _scopeEntidadEn para la mitad de ENTRADA de este mismo wiring).
// GUARDA (riesgo de mayor cuidado del diseño): SOLO escribe cuando pnlScope() trae una entidad real — NUNCA en
// "negocio"/global (`ps.global`) ni cuando el hilo P&L no tiene nada — escribir en cada turno de P&L (incluidas
// lecturas globales sin entidad) podría borrar en silencio una entidad en foco que el usuario nunca pidió cambiar.
// `turno`/`periodo`/`ofertaPendiente`/`metrica`/etc. quedan null/vacíos a propósito: P&L no los conoce y
// ningún consumidor de conversationScope los lee hoy para resolver referencias (solo dimension/entities/tenant,
// ver resolveConversationReference) — no se inventa un valor donde no hay dato real.
function _pnlScopeProjection(mem) {
  const ps = pnlScope();
  if (!ps || ps.global) return mem;
  const entities = ps.entity ? [ps.entity] : (Array.isArray(ps.entities) ? ps.entities.filter(Boolean) : []);
  if (!entities.length || !ps.dimension) return mem;
  const prevScope = (mem && mem.conversationScope && typeof mem.conversationScope === "object") ? mem.conversationScope : { version: 1, current: null, history: [] };
  const prevCurrent = prevScope.current;
  const current = {
    turno: null, dimension: ps.dimension, entities,
    selection: null, periodo: null, filtros: null, metrica: null,
    operacion: "pnl", modo: null, tool: "pnl",
    origen: { callId: null, boletaLabels: [] },
    supuestos: [], faltantes: [], ofertaPendiente: null,
    tenant: (prevCurrent && prevCurrent.tenant) || null,   // nunca recalculado acá — mismo criterio de fallback que updateConversationScope
  };
  return { ...(mem || {}), conversationScope: { ...prevScope, current } };
}

// ── Helper PURO · arma el turno que la UI agrega DESDE el resultado de ADI (answerADI o answerADIFromSpec).
// La UI CONSUME el resultado, no recalcula (regla madre). Mismo shape para ambos caminos.
/* ── EL RASTRO DE RUTA (owner 2026-08-14) ────────────────────────────────────────────────────────────────────
 * «Cuando midamos en app, necesitamos saber si respondió natural, actual o respaldo. Sin eso la evaluación se
 * contamina.» Y no es teórico: cinco turnos del examen 1 se midieron creyendo que salían del camino nuevo, y uno
 * lo había contestado el viejo — se vio porque las CIFRAS no coincidían con la carpeta, no porque el sistema lo
 * dijera. Esto NO es superficie de producto: no pinta nada en pantalla. Deja el rastro en la consola del
 * navegador y en `window.__ADI_RUTA__` (últimos 20 turnos) para poder leerlo al medir. */
/* EL RELOJ DEL TURNO. `telemetria.js` es puro y determinístico a propósito (los gates comparan salidas byte a
 * byte), así que la marca de tiempo y la latencia las pone ESTE lado, que es el que sabe cuándo arrancó. */
let _t0Turno = 0;
const _marcarInicioDeTurno = () => { try { _t0Turno = Date.now(); } catch { _t0Turno = 0; } };
const _ahora = () => { try { return Date.now(); } catch { return null; } };
const _msDelTurno = () => { try { return _t0Turno ? Date.now() - _t0Turno : null; } catch { return null; } };
function _rastroDeRuta(q, r, source, escenario) {
  try {
    const nat = (r && r.natural) || null;
    /* LAS CINCO COSAS QUE UNA MEDICIÓN DEBE DECLARAR (owner 2026-08-15): escenario · carpeta · ruta · versión ·
     * rastro. La consola las imprime en su sello; acá van al rastro, para que medir en la app y medir en la
     * consola NO puedan volver a describir negocios distintos sin que nada lo diga. La FIRMA de la carpeta es su
     * total de ventas: si dos entornos muestran firmas distintas, están mirando otro negocio. */
    const carpeta = (() => {
      try { return (proyectarDatoNegocio(escenario).match(/Ventas totales: \$[\d.]+M/) || [])[0] || null; } catch { return null; }
    })();
    const rastro = {
      pregunta: String(q || "").slice(0, 80),
      via: source,                                   // natural · deterministico · sin_pago · demo · oracle
      route: (r && r.route) || null,                 // lo que declara el propio motor
      escenario: escenario || null,
      carpeta,                                       // firma del fact pack que vio el cerebro
      estado: nat ? nat.estado : null,               // verde · reparado · suplente · vacio (solo camino natural)
      suplente: nat ? !!nat.suplenteDigno : null,
      vetos: nat && Array.isArray(nat.vetos) ? nat.vetos : null,
      /* `llamadas` SALE DE `cortes`, que es la fuente verificable (owner 2026-08-21). Este campo venía en null
       * desde siempre: leía `nat.calls`, y el camino natural nunca expuso ese contador — expone `reparaciones`,
       * derivado de él. En vez de agregar un contador paralelo que después se desincroniza, se cuenta lo que ya
       * viaja: el proveedor deja UN motivo de corte por llamada, así que `cortes.length` ES la cantidad de
       * llamadas, y queda comprobable contra el propio arreglo en vez de ser un número suelto. */
      llamadas: nat && Array.isArray(nat.cortes) ? nat.cortes.length : null,
      cortes: nat && Array.isArray(nat.cortes) ? nat.cortes : null,   // POR QUÉ cortó el proveedor en cada llamada
      vacias: nat ? nat.vacias : null,                                 // cuántas volvieron sin una sola letra
    };
    if (typeof window !== "undefined") {
      window.__ADI_RUTA__ = [rastro, ...(window.__ADI_RUTA__ || [])].slice(0, 20);
      /* Y UNA FORMA DE LEERLO (owner 2026-08-21). La telemetría se escribía y NO LA LEÍA NADIE: un registro que
       * nadie puede abrir no es observabilidad, es un archivo. `__ADI_SALUD__()` devuelve el resumen —cómo se está
       * portando ADI, sin gastar una llamada— y `.filas()` los renglones crudos, que son los mismos que Supabase
       * va a heredar. Es un asidero de diagnóstico, no una pantalla: la superficie visible la decide el owner. */
      window.__ADI_SALUD__ = Object.assign(() => resumenTelemetria(), {
        texto: () => resumenTelemetria().texto,
        filas: () => exportarTelemetria(),
        borrar: () => borrarTelemetria(),
      });
    }
    /* Y SE REGISTRA, no solo se imprime (owner 2026-08-21). `window.__ADI_RUTA__` se pierde al recargar y no
     * suma: sirve para mirar UN turno, no para saber cómo se está portando. `registrarTurno` guarda el renglón
     * de salud —sin dato de negocio, ver telemetria.js— y `resumenTelemetria()` responde la pregunta sin
     * gastar una llamada. Nunca puede romper el turno: el try de afuera lo cubre. */
    registrarTurno({ ...rastro, t: _ahora(), ms: _msDelTurno(), reparaciones: nat ? nat.reparaciones : null });
    if (typeof console !== "undefined" && console.info) {
      console.info(`[ADI ruta] ${rastro.via}${rastro.estado ? " · " + rastro.estado : ""}${rastro.vetos && rastro.vetos.length ? " · vetos: " + rastro.vetos.join(" | ") : ""}`);
    }
  } catch { /* el rastro JAMÁS puede romper un turno: es un instrumento, no una garantía */ }
}
function _turnFromResult(q, r, context, source, escenario) {
  _rastroDeRuta(q, r, source, escenario);
  const deferred = r.text == null;
  const baseContext = { ...(r.context || context || {}) };
  // MEMORIA CANÓNICA + VISTA DERIVADA (Contrato v2 · Fase 4, owner 2026-08-07): `conversationScope` es la memoria
  // canónica; `memoria` es la vista LEGACY que todavía leen _hasThread, el digest del LLM #1, conversation.js y
  // pnl.js. La vista se DERIVA del canónico en vez de escribirse aparte — pero NUNCA pierde lo que el escritor
  // legacy sabía: updateMemoria se sigue calculando y entra como `prev`, así que el canónico MANDA donde conoce
  // (entidad/tema/oferta/ruta del turno) y hereda de la vista legacy donde el canónico calla (ej. un turno cuyo
  // alcance se resolvió por filtro y no dejó entidad en scope). Sin canónico (rutas legacy, que no lo producen)
  // queda exactamente el comportamiento anterior.
  // P&L → conversationScope (Etapa 3): SOLO cuando este turno lo resolvió P&L (route "pnl_setup"/"pnl_reading",
  // la única familia de rutas que compone pnl.js — ver el comentario de _pnlScopeProjection) se consulta el hilo
  // P&L; en cualquier otro turno (incluido el camino Oracle, que CEDE el paso a P&L y nunca produce estas rutas
  // — ver detectPnlIntent en el camino LLM más abajo) memoriaInteraccion pasa intacta, sin tocar conversationScope.
  const memoriaInteraccion = (!deferred && typeof r.route === "string" && r.route.indexOf("pnl_") === 0)
    ? _pnlScopeProjection(baseContext.memoriaInteraccion)
    : baseContext.memoriaInteraccion;
  const memoriaLegacy = updateMemoria((context && context.memoria) || null, deferred ? null : { ...r, text: _sanitizeScenario(r.text) });
  const memoriaVista = (!deferred && deriveMemoriaLegacy(memoriaInteraccion && memoriaInteraccion.conversationScope, {
    prev: memoriaLegacy, route: r.route, suggestions: r.suggestions,
  })) || memoriaLegacy;
  return {
    result: r,
    deferred,
    userMsg: { role: "user", text: q },
    adiMsg: {
      role: "adi",
      text: deferred ? NOT_YET_TEXT : _sanitizeScenario(r.text),
      route: r.route,
      _source: source || "demo",   // UX · origen: "demo" (sin LLM) · "llm" (narrado) · "deterministico" (LLM parse-only o fallback)
      sentrixAction: r.sentrixAction || null,
      suggestions: (r.suggestions && r.suggestions.length) ? r.suggestions : null,
      // Etapa 5 · Sentrix · llevar la boleta al mensaje para que el panel la demuestre. Inerte cuando los
      // flags Sentrix están OFF (r.evidence undefined → sin botón → sin panel · piso intacto byte-exacto).
      evidence: r.evidence || null,
    },
    // CONTINUIDAD · threadeá la última evidencia ACCIONABLE. Los narrativos (recommendation/explain/meta · `followup:true`)
    // NO la reemplazan → "por qué?" / "y si fuera 5%?" siguen refiriendo a la simulación, no a la recomendación. (Cond. 3 del owner.)
    // + LA BOLETA DE MEMORIA (owner 2026-07-15 · "una boleta chica y bien hecha con lo que importa para decidir el
    // siguiente paso"): entidad en foco (persiste) + oferta de cierre del texto que el usuario VIO + próxima acción +
    // tema — updateMemoria (una verdad, pura) la arma por turno; el "sí"/"dale"/"compáralo"/"muéstrame más" la consumen.
    context: { ...baseContext,
      memoriaInteraccion,
      lastEvidence: (r.evidence && !r.evidence.followup) ? r.evidence : ((context && context.lastEvidence) || null),
      memoria: memoriaVista },
  };
}

// CAMINO DEMO/PISO (ADI_LLM_ENABLED OFF · SYNC): PRIMERO la red determinística de coerce (owner 2026-07-15 —
// "Ver todo el inventario" clickeado en la Mesa caía al smart-guide genérico y "se pierde la experiencia": las
// preguntas que la propia UI emite son promesas y deben responder en TODOS los modos). Si ningún detector
// reclama el texto, answerADI como siempre (texto libre byte-exacto — el techo acordado del demo no se mueve).
// hay HILO si hay evidencia accionable O una boleta de memoria con contenido (oferta/próxima acción/entidad) —
// el "sí"/"dale" tras un turno narrativo largo también debe reclamar (review adversarial 2026-07-15).
const _hasThread = (context) => !!(context && (context.lastEvidence
  || (context.memoria && (context.memoria.oferta || context.memoria.proximaAccion || (context.memoria.entidad && context.memoria.entidad.nombre)))));

export function buildAdiTurn(question, context, scenario) {
  const q = (question || "").trim();
  const cs = coerceFloor(q, _hasThread(context), getUISignals());
  const r = cs ? answerConversational(cs, context || {}, { scenario }) : answerADI(q, context || {}, { scenario });
  return _turnFromResult(q, r, context, "demo");
}

// CAMINO LLM (ADI_LLM_ENABLED ON · ASYNC): texto → gateway (server-side, tiene la key) → spec → answerADIFromSpec LOCAL.
// Regla: el LLM SOLO traduce a spec · ADI valida y ejecuta/degrada honesto. Si el gateway falla → CAE AL PISO (answerADI).
// DEMO PRIVADA: si el server niega el acceso (código vencido/ausente con ADI_TOKEN_SECRET activo), se avisa a App
// (evento → pantalla de acceso) y este turno cae al piso. Sin secret en el server, `access` viaja null y no pasa nada.
function _accessDenied(data) {
  if (data && data.access === "denied") {
    try { window.dispatchEvent(new CustomEvent("adi-access-denied", { detail: data.reason || "invalid" })); } catch { /* headless */ }
    return true;
  }
  return false;
}
async function _fetchSpec(text, scenario, context) {
  const res = await fetch("/api/adi-spec", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, scenario, context: context || null, access: getAccessCode() }),   // conversationContext → el LLM #1 clasifica turn_type
  });
  const data = await res.json();
  if (_accessDenied(data)) throw new Error("acceso requerido");
  if (!data || !data.ok) throw new Error((data && data.error) || "gateway sin spec");
  return data.spec;
}
// LLM #2 · pide la narración del output validado (server-side). El number-guard decide después, en el cliente.
async function _fetchNarration(validated) {
  const res = await fetch("/api/adi-narrate", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: _sanitizeScenario(validated.text), evidence: validated.evidence || null, access: getAccessCode() }),
  });
  const data = await res.json();
  if (_accessDenied(data)) throw new Error("acceso requerido");
  if (!data || !data.ok || !data.narration) throw new Error((data && data.error) || "gateway sin narración");
  return data.narration;
}
// ── ARQUITECTURA C · Fase 3 · el oráculo detrás del flag ────────────────────────────────────────────────────────
// override SOLO para probar en vivo sin re-buildear: localStorage adi_oracle="1" o ?oracle=1. El default (flag) es OFF.
function _oracleOn() {
  try {
    if (typeof localStorage !== "undefined") {
      const v = localStorage.getItem("adi_oracle");
      if (v === "0") return false;   // apagado explícito (para comparar con la ruta vieja)
      if (v === "1") return true;    // prendido explícito
    }
    if (typeof location !== "undefined") {
      if (/[?&]oracle=0\b/.test(location.search)) return false;
      if (/[?&]oracle=1\b/.test(location.search)) return true;
      const h = location.hostname || "";
      const esProdReal = /(^|\.)adiai\.cl$/i.test(h) || /\.vercel\.app$/i.test(h);   // dominios REALES de producción
      if (!esProdReal) return true;   // dev / localhost / IP / preview → oráculo ON por defecto (C en construcción)
    }
  } catch { /* headless */ }
  return ADI_ORACLE_ENABLED;   // producción real: solo el flag (OFF salvo que se prenda a propósito)
}
// ── CONTRATO v2 · NARRACIÓN CLAIMS-ONLY detrás de flag (owner 2026-08-07, opción (b)) ───────────────────────────
// A DIFERENCIA de _oracleOn: acá NO hay default-ON en dev. El modo claims-only cambia lo que el narrador LEE, así
// que cambia la prosa — y eso no se puede verificar sin corridas pagadas. Queda desplegado pero APAGADO hasta que
// el owner valide la calidad manualmente: se enciende SOLO con override explícito (localStorage adi_claims_only="1"
// o ?claims=1) y NUNCA en un dominio real de producción, ni siquiera con el override puesto.
function _claimsOnlyOn() {
  try {
    let pedido = false;
    if (typeof localStorage !== "undefined" && localStorage.getItem("adi_claims_only") === "1") pedido = true;
    if (typeof location !== "undefined" && /[?&]claims=1\b/.test(location.search)) pedido = true;
    if (pedido && typeof location !== "undefined") {
      const h = location.hostname || "";
      const esProdReal = /(^|\.)adiai\.cl$/i.test(h) || /\.vercel\.app$/i.test(h);
      if (esProdReal) return ADI_CLAIMS_ONLY_ENABLED;   // en prod real manda el flag, el override no alcanza
    }
    if (pedido) return true;
  } catch { /* headless */ }
  return ADI_CLAIMS_ONLY_ENABLED;   // default: el flag del perfil (OFF)
}
// Pasada 1 · PLAN (server-side · la key vive en el gateway). tenantId viaja SOLO para rate-limit por tenant en el
// gateway (owner 2026-07-29, multiempresa) — nunca decide qué datos trae el plan, eso lo sigue haciendo el motor
// client-side sobre el tenant activo en tenantStore.js.
// _onRouted (owner 2026-08-02, router de modelo — ver modelRouter.js): callback OPCIONAL, no cambia el contrato de
// retorno de estas dos funciones (siguen devolviendo el plan/narración PELADOS, byte-igual a siempre — así ningún
// mock existente en los gates, que llama callPlan/callNarrate ignorando args extra, se entera del cambio). Solo
// answerViaOracle.js/buildAdiTurnLLM (abajo) lo usan, para dejar el ruteo observable por turno sin tocar el motor.
// `vistaLinea` (owner 2026-08-09, Contrato de Concordancia ADI ↔ Sentrix): la ÚNICA forma en que el contexto de
// pantalla llega al LLM — una oración de ≤240 caracteres, sin cifras, que answerViaOracle.js proyecta del
// ViewContext sellado (nunca el objeto, nunca filas, nunca la salida del builder). Se reenvía tal cual al gateway,
// que la pasa a buildPlanUserMessage. Si el turno no vino de Sentrix es undefined y el body queda igual que hoy.
// `motivoReintento` (owner 2026-08-11, segunda pasada): la CAUSA del intento anterior. El gateway ya la aceptaba y
// nadie se la mandaba, así que TODO reintento de producción se registraba con la causa en "unknown" — el veredicto
// con que guardC rechazó el intento previo existe en el turno y no llegaba nunca a la telemetría. Viaja igual que
// `attempt`: un campo más del body, sin tocar la firma ni el valor de retorno de nadie. Si el llamador no lo
// declara queda `undefined` y JSON.stringify lo OMITE — el body de un turno que no reintenta sale byte-idéntico al
// de siempre. El borde vive en el gateway (_causaDeclarada): sólo sobrevive un código de lista cerrada, jamás texto.
// `datoNegocio` (owner 2026-08-14, «el dato al PLAN»): la MISMA proyección que ya viaja a NARRAR (misma función,
// mismo memo por tenant+escenario, mismo campo del body) — el que DECIDE qué tools pedir necesita ver el mapa del
// negocio tanto como el que narra. Va como campo propio, y el gateway la coloca en el segmento FIJO/cacheable.
async function _fetchPlan({ text, history, mem, scenario, requestContext, attempt, vistaLinea, motivoReintento, _onRouted }) {
  const t0 = Date.now();
  const res = await fetch("/api/adi-plan", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, history, mem, scenario, access: getAccessCode(), tenantId: requestContext && requestContext.tenantId, attempt, vistaLinea, motivoReintento, datoNegocio: proyectarDatoNegocio(scenario) }),
  });
  const data = await res.json();
  if (_accessDenied(data)) throw new Error("acceso requerido");
  if (!data || !data.ok || !data.plan) throw new Error((data && data.error) || "gateway sin plan");
  // UNA SOLA VERDAD PARA EL COSTO (owner 2026-08-11, segunda pasada): el gateway ya lo calcula sobre el modelo que
  // RESPONDIÓ (`data.costUSD`), que es el que se factura; acá se tarifaba de nuevo sobre el que se PIDIÓ. Hoy dan el
  // mismo número —la tarifa por familia lo garantiza— pero eran dos cálculos, y dos cálculos se desincronizan. Se
  // usa el del gateway cuando viene; el cálculo local queda de RESPALDO para cualquier respuesta que no lo traiga
  // (mocks de gates viejos, un despliegue anterior al campo), así que nada de lo que hoy funciona deja de funcionar.
  if (typeof _onRouted === "function") _onRouted({ step: "plan", attempt: attempt || 0, model: data.modelUsed, reason: data.modelReason, ms: Date.now() - t0, usage: data.usage, costUSD: data.costUSD !== undefined ? data.costUSD : estimateCostUSD(data.modelUsed, data.usage) });
  return data.plan;
}
// Pasada 2 · NARRAR con persona (el batch ya corrió en el cliente · viaja el payload de cifras autorizadas)
// El BATCH ya corrió acá; answerViaOracle le pasa a callNarrate TODAS las decisiones de forma que tomó el motor y
// esta función las reenvía tal cual a buildNarrateUserMessageC. HALLAZGO (owner 2026-08-09, al cablear el contrato de
// respuesta): `instruccionDisclosure` y `tablePolicy` YA se calculaban en answerViaOracle.js y guardC.js YA validaba
// tablePolicy, pero esta función los descartaba al desestructurar — o sea que en la ruta REAL de producción el guard
// bloqueaba una tabla que el prompt nunca había prohibido, y exigía una que nunca había pedido. El propio contrato de
// presentación lo declara como invariante: "el prompt y el candado tienen que decir lo MISMO". Se reenvían los dos.
// `motivoReintento`: ver el bloque de _fetchPlan. Acá muerde más fuerte — los reintentos de NARRAR existen SÓLO
// porque guardC rechazó el intento previo, y sin este campo los 27 de la corrida quedaron sin explicar por qué.
// `scenario`/`datoNegocio` (AMPLITUD F1, owner 2026-08-13): la proyección curada del dato del tenant activo
// (datoProyectado.js — determinística por tenant+escenario, memoizada) viaja como CAMPO PROPIO del body, nunca
// dentro de `payload`: el payload por turno no crece un byte. El gateway la coloca al FINAL del segmento FIJO
// del system (cache:true), así el caché de prefijo del proveedor la descuenta en cada llamada — la razón
// económica de que el narrador pueda ver el dato completo del negocio en todos los turnos.
async function _fetchNarrateC({ text, plan, results, ledgerFigs, mem, history, requestContext, pref, instruccionOrientacion, instruccionDisclosure, tablePolicy, viewContext, formaRespuesta, scenario, attempt, motivoReintento, _onRouted }) {
  // claimsOnly: modo del Contrato v2 detrás de flag (owner 2026-08-07) — cambia lo que el narrador LEE, no lo que
  // el guard exige. Apagado por defecto: el payload que sale de acá es el mismo verificado en vivo.
  const payload = buildNarrateUserMessageC({ text, plan, results, ledgerFigs, mem, history, pref, instruccionOrientacion, instruccionDisclosure, tablePolicy, viewContext, formaRespuesta, requestContext, claimsOnly: _claimsOnlyOn() });
  const t0 = Date.now();
  const res = await fetch("/api/adi-narrate-c", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload, mem, access: getAccessCode(), tenantId: requestContext && requestContext.tenantId, attempt, motivoReintento, datoNegocio: proyectarDatoNegocio(scenario) }),
  });
  const data = await res.json();
  if (_accessDenied(data)) throw new Error("acceso requerido");
  if (!data || !data.ok || !data.narration) throw new Error((data && data.error) || "gateway sin narración");
  // misma regla que en PLAN: manda el costo del gateway, el cálculo local queda de respaldo (ver el bloque de arriba)
  if (typeof _onRouted === "function") _onRouted({ step: "narrate", attempt: attempt || 0, model: data.modelUsed, reason: data.modelReason, ms: Date.now() - t0, usage: data.usage, costUSD: data.costUSD !== undefined ? data.costUSD : estimateCostUSD(data.modelUsed, data.usage) });
  return data.narration;
}

// ── CAMINO NATURAL (owner 2026-08-14) · el cerebro del ciclo notarial, por el MISMO endpoint /api/adi-narrate-c ──
// `payload.modoNatural` + `payload.mensajes` (el hilo entero) → el gateway arma el system natural (persona +
// carpeta + doctrina + contrato [[CALCULO]], ver naturalPrompt.js) y el adapter manda el hilo como messages.
// La key sigue server-side; `datoNegocio` viaja igual que en el camino actual (misma proyección memoizada).
// A DIFERENCIA de _fetchNarrateC, una narración VACÍA no lanza: el ciclo notarial la trata como veredicto propio
// (narracion-vacia) y dispara la reparación/suplente — lanzar acá le robaría el caso al ciclo.
async function _fetchNatural({ mensajes, mem, scenario, requestContext, attempt, motivoReintento, cortes }) {
  const res = await fetch("/api/adi-narrate-c", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload: { modoNatural: true, mensajes }, mem, access: getAccessCode(), tenantId: requestContext && requestContext.tenantId, attempt, motivoReintento, datoNegocio: proyectarDatoNegocio(scenario) }),
  });
  const data = await res.json();
  if (_accessDenied(data)) throw new Error("acceso requerido");
  if (!data || !data.ok) throw new Error((data && data.error) || "gateway sin narración");
  /* EL MOTIVO DE CORTE SE RECOGE ACÁ (owner 2026-08-21). El gateway ya lo manda; el producto lo tiraba, así que
   * un turno vacío en producción decía «vacio» y nada más — exactamente el hueco que hizo indiagnosticables
   * cuatro fallas y obligó a pagar una corrida para entenderlas. Es una razón de corte, no dato de nadie. */
  if (Array.isArray(cortes)) cortes.push(String((data && data.stop) || "(no declarado)"));
  return typeof data.narration === "string" ? data.narration : "";
}

// FOLLOW-UP EJECUTIVO · "qué hacemos / qué recomendás / qué sigue / y ahora / cuál es la acción" → recomendación sobre la
// última evidencia (NO se re-parsea como consulta nueva de eje/métrica). Solo dispara si hay una evidencia accionable previa.
const _FOLLOWUP_RE = /\b(qu[eé]\s+hacemos|qu[eé]\s+hago|qu[eé]\s+hacer|qu[eé]\s+recomiend[ao]s|qu[eé]\s+recomend[aá]s|qu[eé]\s+sigue|y\s+ahora|cu[aá]l\s+es\s+la\s+acci[oó]n)\b/i;

// LLM #2 · narra un resultado YA ejecutado (sub-flag NARRATE ON) · pasa por el number-guard (pickNarratedText): guard OK →
// narración · gateway/guard falla → texto determinístico. COMPARTIDO por el input libre (buildAdiTurnLLM) y los chips del
// inicio (submitSpec) → misma calidad narrada por CUALQUIER puerta. buildNarrateSystem elige el prompt según evidence.
// `onPhase` (mejora 9 · 2026-07-26): avisa el paso REAL del pipeline al indicador de Pensando (2=redactando · 3=verificando).
async function _narrateResult(r, onPhase) {
  const _ph = typeof onPhase === "function" ? onPhase : () => {};
  if (!(ADI_LLM_NARRATE_ENABLED && r && r.text)) return { r, narrated: false };
  // POLÍTICA DE NARRACIÓN (sweep 2026-07-09 · incluye la regla de clarificaciones del 2026-07-06): las repreguntas,
  // los bloqueos del seam y los degrades honestos ("No tengo a X…") NO se narran — el determinístico ya declara el
  // límite con voz de producto y el narrador demostró fabular sobre ellos (Walmart · "estoy proyectando…" · jerga).
  if (!shouldNarrate(r)) return { r, narrated: false };
  try {
    _ph(2);   // LLM #2 en vuelo · "Redactando la respuesta"
    const narration = await _fetchNarration(r);
    _ph(3);   // narración recibida · el number-guard y el guard de voz verifican ahora
    const picked = pickNarratedText(r, narration);
    // GUARD DE VOZ (determinístico) · corre DESPUÉS del number-guard (no toca cifras) · aplica al texto final elegido
    // (narrado LLM o determinístico de fallback) → mata "He revisado tus datos…"/"Las proyecciones indican…"/"Sin embargo…".
    // + OFERTA FUERA DE DATO (owner 2026-07-09): oración que ofrezca data inexistente (campañas/marketing/…)
    // se elimina completa — el universo DISPONIBLE viaja en el prompt; esto es la garantía en código.
    // + LEAKS DE IDIOMA/SLANG (owner 2026-07-10 · "vitales"): "if"/"and"/"dive into"/"la pasta" → español de directorio.
    const stripped = stripLanguageLeaks(stripOutOfDataOffers(stripRoboticVoice(picked.text)));
    // F4 · POST-CHECK P&L (solo narración aprobada · kind "pnl") · corre ÚLTIMO, sobre el texto FINAL: la
    // GRADUACIÓN probado/supuesto y el acuse del SELLO se aseguran en código si el narrador los omitió — o si un
    // strip se llevó la frase (cazado por el sweep F4: la graduación venía pegada a la línea "marketing" del
    // usuario y la oferta fuera-de-dato la eliminó). Frases sin cifras nuevas — la boleta no se toca.
    return { r: { ...r, text: picked.narrated ? ensurePnlNarration(stripped, r.text, r.evidence) : stripped }, narrated: picked.narrated };
  } catch { return { r, narrated: false }; }
}

// `onPhase` (mejora 9 · 2026-07-26): callback opcional — el pipeline avisa su paso REAL y el "Pensando" lo refleja
// (0=entendiendo · 1=armando la cuenta · 2=redactando · 3=verificando). Sin callback, todo sigue igual (gates/sweeps intactos).
// `viewContext` (owner 2026-08-09 · Contrato de Concordancia ADI↔Sentrix): el CONTEXTO DE PANTALLA sellado que
// emitió Sentrix — qué vista/sección/componente/métrica/período/universo tiene delante el usuario. NO trae cifras
// ni filas: solo identifica lo que está mirando, para que "explicame este gráfico" tenga contra qué resolverse.
// Viaja por el MISMO canal que ya usan las señales de UI (uiSignals) y además explícito, para que el motor no
// tenga que adivinar de dónde leerlo.
export async function buildAdiTurnLLM(question, context, scenario, recentTurns, onPhase, viewContext = null) {
  const _ph = typeof onPhase === "function" ? onPhase : () => {};
  const q = (question || "").trim();
  let r, narrated = false;
  /* ── «¿POR QUÉ ESA CIFRA?» ANTES DEL ORÁCULO (owner 2026-08-12 · corrección de un error mío) ══════════════════
   * El owner miró la cascada del P&L y preguntó «logística por qué tiene un 3.5%». La respuesta estaba en su
   * propia tabla: la línea viene sellada «supuesto declarado». Se construyó el compositor… dentro de
   * `answerConversational`, que corre MÁS ABAJO que el oráculo. Y el oráculo se queda ese turno —para esa frase
   * `detectPnlIntent` devuelve null—, así que el arreglo sólo habría entrado si el oráculo se abstenía: nunca,
   * en la práctica. Construido, con gate verde, y sin camino.
   * ACÁ ARRIBA SÍ LO ALCANZA, y es la posición correcta por lo que la pregunta ES: un pedido de PROCEDENCIA sobre
   * una cifra que el usuario YA tiene delante. No hay nada que planificar ni que pedirle a ninguna tool — el dato
   * ya está sellado, con su origen. Mandarla al oráculo es pagar para que un modelo redescubra lo que la boleta
   * del turno anterior ya declara.
   * RED ANGOSTA: sin un P&L delante o sin nombrar una línea real, devuelve null y el turno sigue de largo. */
  {
    const _pq = responderPorQueCifra(q, context && context.lastEvidence);
    if (_pq) { _ph(1); return _turnFromResult(q, _pq, context, "deterministico"); }
  }

  /* ── CUÁNDO NO HACE FALTA PAGAR · bypass pre-PLAN (owner 2026-08-12 · detrás de flag, HOY APAGADO) ═══════════
   * MEDIDO: siete de siete preguntas típicas ya tienen respuesta COMPLETA sin el modelo —el coercer del piso
   * entiende la pregunta y el motor produce entre 500 y 1.800 caracteres de lectura real—, pero el turno llama al
   * planificador ANTES de descubrirlo. Se paga por preguntas que el motor ya sabía contestar.
   * POR QUÉ ACÁ Y NO ADENTRO DEL ORÁCULO: adentro ya es tarde. El pago del PLAN es lo primero que hace el oráculo;
   * cualquier atajo río abajo ahorra trabajo pero no ahorra la llamada, que es exactamente el problema.
   * QUIÉN DECIDE: `puedeResponderSinPagar` (bypassConfianza.js), y decide que NO ante cualquier duda. La asimetría
   * manda — pagar de más cuesta centavos; contestar con aplomo la pregunta equivocada rompe la confianza.
   * CEDE ANTE EL P&L por el mismo motivo que el oráculo (ver abajo): es un contrato multi-turno y un atajo one-shot
   * le rompería el flujo guiado. Y ante cualquier excepción no pasa nada: el turno sigue por el camino de siempre.
   * FLAG APAGADO EN TODOS LOS PERFILES: esto queda cableado y probado, sin cambiar una sola respuesta todavía.
   * Encenderlo exige antes comparar las dos rutas en vivo —¿la del piso responde tan bien como la pagada?—, y esa
   * comparación se hace con llamadas pagadas que autoriza el owner. */
  if (ADI_BYPASS_SIN_PAGO && !detectPnlIntent(q)) {
    try {
      const _mem = (context && context.memoriaInteraccion) || {};
      const _spec = coerceFloor(q, _hasThread(context), getUISignals());
      const _v = puedeResponderSinPagar(q, _spec, {
        clarifyStreak: _mem.clarifyStreak,
        hayOfertaPendiente: !!getLastOffer(_mem),
      });
      if (_v.ok) {
        _ph(1);
        const _r = answerConversational(_spec, context || {}, { scenario });
        // SÓLO SI HAY RESPUESTA DE VERDAD. Que el spec sea confiable no garantiza que el motor tenga el dato: si
        // el piso declina o devuelve un texto vacío, el turno NO se queda sin respuesta — sigue al oráculo, que
        // para eso está. Un bypass que entrega un vacío es peor que no haber entrado.
        if (_r && typeof _r.text === "string" && _r.text.trim().length > 0) {
          return _turnFromResult(q, { ..._r, text: stripProactiveSuffix(_r.text) }, context, "sin_pago");
        }
      }
    } catch { /* cualquier fallo del atajo → camino normal, sin perder el turno */ }
  }

  // ── ARQUITECTURA C · Fase 3 · ORÁCULO (detrás del flag · fallback intacto) ──
  // El LLM PLANEA qué datos pedir → el motor los trae (batch puro client-side) → ADI NARRA con persona bajo guardC.
  // Si C se abstiene (plan falla / guard rechaza) → o === null → CAE a la ruta vieja de abajo (byte-exacta). Flag OFF = nunca entra.
  // C CEDE EL PASO AL P&L (owner 2026-07-28): el P&L es un CONTRATO MULTI-TURNO (flujo guiado que arma las líneas de
  // gasto, recuerda, edita y sella · `_pnl_gate` 725 asserts). C es one-shot y no lo tiene → si interceptara, "¿cuánto
  // me queda después de gastos?" perdería el flujo y respondería peor. detectPnlIntent es la MISMA red determinística
  // que usa el coerce → cuando reclama el turno, C no entra y manda la ruta vieja (la buena para este dominio).
  if (_oracleOn() && !detectPnlIntent(q)) {
    try {
      _ph(0);
      const mem = (context && context.memoriaInteraccion) || {};
      const history = Array.isArray(recentTurns) ? recentTurns : [];
      // conversationId: UNA por hilo de chat — se genera la PRIMERA vez y se persiste en `context` (mismo mecanismo
      // que memoriaInteraccion), nunca se recalcula a mitad de conversación (owner 2026-07-29, multiempresa: cada
      // operación transporta explícitamente con qué tenant/conversación/snapshot está trabajando).
      const conversationId = (context && context.conversationId) || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `conv_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      const requestContext = buildRequestContext({ conversationId, scenario, mem });
      /* ── CAMINO NATURAL COMO PRINCIPAL (owner 2026-08-14 · flag ADI_CAMINO_NATURAL · ver caminoNatural.js) ────
       * Flag ON → el turno va por el cerebro único + notario + ciclo de reparación, con el hilo entero. El P&L
       * guiado y «por qué esa cifra» YA cedieron/reclamaron ARRIBA — son features con estado propio, no narración.
       * RED DE RESILIENCIA (condición 2): si el camino natural LANZA (gateway caído, config faltante, error), el
       * turno CAE al oráculo actual acá abajo, en el MISMO turno — el usuario nunca ve el error.
       * Flag OFF → este bloque no existe: el turno sigue por answerViaOracle, byte-idéntico a hoy. */
      if (ADI_CAMINO_NATURAL) {
        try {
          const cortesDelTurno = [];   // un motivo de corte por llamada · viaja al registro de salud, no a pantalla
          const o = await answerViaNatural({ text: q, history, mem, scenario,
            callNatural: (args) => _fetchNatural({ ...args, mem, scenario, requestContext, cortes: cortesDelTurno }) });
          if (o && o.r && o.r.natural) o.r.natural.cortes = cortesDelTurno;
          if (o && o.r) {
            _ph(3);
            const rr = { ...o.r, context: { ...(context || {}), memoriaInteraccion: o.mem, conversationId } };   // persiste memoria + conversationId en el hilo
            return _turnFromResult(q, rr, context, "natural", scenario);
          }
        } catch (e) {
          /* RED DE RESILIENCIA · pero NUNCA MUDA (medido en la app 2026-08-14): el catch era `catch {}` a secas, así
           * que cuando el camino natural fallaba el turno caía al oráculo y NADIE se enteraba — ni el usuario, que
           * veía una respuesta peor con cifras distintas, ni nosotros. Cinco turnos seguidos se respondieron por el
           * camino viejo creyendo que era el nuevo. El fallback se conserva TAL CUAL (es la garantía de que el
           * usuario nunca ve un error); lo único que cambia es que el fallo deja rastro. */
          if (typeof console !== "undefined" && console.warn) console.warn("[ADI] el camino natural falló y el turno cayó al oráculo:", e);
        }
      }
      // ROUTING TRACE (owner 2026-08-02 — ver modelRouter.js): closures frescas POR TURNO (nunca module-level, no
      // hay concurrencia entre turnos de un mismo hilo) que envuelven _fetchPlan/_fetchNarrateC solo para capturar
      // modelo/motivo/latencia/costo de cada intento REAL — el contrato callPlan/callNarrate que ve answerViaOracle
      // no cambia (misma firma, mismo valor de retorno).
      const routingTrace = [];
      const tracedCallPlan = (args) => _fetchPlan({ ...args, _onRouted: (info) => routingTrace.push(info) });
      const tracedCallNarrate = (args) => _fetchNarrateC({ ...args, _onRouted: (info) => routingTrace.push(info) });
      // uiSignals (Etapa 3, owner 2026-08-03, continuidad conversacional universal): MISMO mecanismo de contexto
      // que ya lee la ruta legacy (coerceChain.js línea ~472, "comparalos" contra la selección de la Mesa) — sin
      // esto, la selección de checkboxes de la Mesa era un camino PARALELO invisible para el oráculo (ver el
      // comentario de cabecera de answerViaOracle.js sobre `uiSignals`).
      // El contexto de pantalla entra por los DOS caminos que convergen en el mismo objeto: explícito (el usuario
      // pulsó "Que ADI lo explique" en una pieza concreta) y ambiente (la vista abierta lo publicó en uiSignals).
      // El explícito gana; si no hay, manda el de la pantalla. Sin panel abierto no viaja nada.
      const _vc = viewContext || (getUISignals() || {}).viewContext || null;
      const o = await answerViaOracle({ text: q, history, mem, scenario, callPlan: tracedCallPlan, callNarrate: tracedCallNarrate, requestContext,
        uiSignals: { ...getUISignals(), ...(_vc ? { viewContext: _vc } : {}) }, viewContext: _vc });
      if (o && o.r) {
        _ph(3);
        // `routing` (observable por turno): cruza routingTrace (modelo/motivo/ms/costo, del fetch) con
        // o.r.retryTrace (veredicto de guardC por intento, del motor — ver answerViaOracle.js) por `attempt`.
        // Ninguno de los dos condiciona el turno: es telemetría, se arma DESPUÉS de que o.r ya está resuelto.
        const retryTrace = o.r.retryTrace || null;
        const routing = routingTrace.map((entry) => {
          const stepTrace = retryTrace && (entry.step === "plan" ? retryTrace.plan : entry.step === "narrate" ? retryTrace.narrate : null);
          const verdict = Array.isArray(stepTrace) ? stepTrace.find((t) => t.attempt === entry.attempt) : null;
          return { ...entry, guardOk: verdict ? verdict.guardOk : null, guardReason: verdict ? verdict.reason : null };
        });
        const rr = { ...o.r, routing, context: { ...(context || {}), memoriaInteraccion: o.mem, conversationId } };   // persiste memoria + conversationId en el hilo
        return _turnFromResult(q, rr, context, "oracle", scenario);
      }
    } catch { /* el oráculo falló → seguimos a la ruta vieja (fallback intacto) */ }
  }
  // ── PRECEDENCIA (V1 · owner): CONVERSACIONAL → REGEX (fallback) → UN-TURNO. El regex NO se elimina hasta probar el conversacional.
  const ui = getUISignals();   // memoria UI (owner 2026-07-08) · lo que el usuario está haciendo en la Mesa/paneles
  const convCtx = buildConversationContext(recentTurns, context && context.lastEvidence, ui, context && context.memoria);   // contexto chico para el LLM #1 (+ la boleta de memoria)
  try {
    const spec = await _fetchSpec(q, scenario, convCtx);        // LLM #1 VE el contexto (incl. señales de UI) → clasifica turn_type
    _ph(1);   // spec recibido · el motor local arma la cuenta ahora
    r = answerConversational(coerceSpec(q, spec, _hasThread(context), ui), context || {}, { scenario }); // cadena de coerce (UI→criteria→sí→compare→dominios) · no depende del LLM · el seam valida/degrada honesto
  } catch (e) {
    // LLM #1 caído → regex de follow-up sobre la última evidencia → RED DE COERCE determinística (owner
    // 2026-07-15: las promesas de la UI responden también con el gateway caído) → un-turno determinístico.
    const _last = context && context.lastEvidence;
    _ph(1);   // LLM #1 caído · la red determinística arma la cuenta igual
    const _fu = (_last && _FOLLOWUP_RE.test(q)) ? composeFollowupRecommendation(_last) : null;
    const _cs = _fu ? null : coerceFloor(q, _hasThread(context), ui);
    r = _fu || (_cs ? answerConversational(_cs, context || {}, { scenario }) : answerADI(q, context || {}, { scenario }));
  }
  // MULETILLA PROACTIVA fuera (owner 2026-07-09): el suffix enlatado no viaja en el camino LLM — el insight vive
  // como gancho en la boleta del diagnóstico y el narrador decide si viene al caso. El piso demo queda byte-exacto.
  if (r && typeof r.text === "string") r = { ...r, text: stripProactiveSuffix(r.text) };
  // NARRACIÓN LLM #2 (helper compartido) · aplica al follow-up Y al spec · guard → si falla, texto determinístico.
  const _nr = await _narrateResult(r, _ph);
  r = _nr.r; narrated = _nr.narrated;
  return _turnFromResult(q, r, context, narrated ? "llm" : "deterministico");
}

// ── Logo ADI inline · el CUBO de la landing (owner 2026-07-14): la misma pieza de adiai.cl, sin brillo ni
// borde reflectante — solo GIRA mientras ADI responde ("pierde elegancia" el encendido). ──
function AdiAvatar({ spark = false }) {
  return (
    <div style={{
      width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center",
      flexShrink:0, marginTop:4, transformOrigin:"center center",
      animation: spark ? "adiGiro 2.6s linear infinite" : "none"
    }}>
      <svg width="18" height="18" viewBox="0 0 200 200" fill="none" stroke="#cfd5db" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="100,15 173.6,57.5 173.6,142.5 100,185 26.4,142.5 26.4,57.5"/>
        <circle cx="100" cy="100" r="55" strokeWidth="1.7" opacity="0.65"/>
        <ellipse cx="100" cy="100" rx="55" ry="22" strokeWidth="1.5" opacity="0.5"/>
        <circle cx="100" cy="100" r="7" fill="#2fb8da" stroke="none"/>
      </svg>
    </div>
  );
}

// ── Cuerpo de un mensaje ADI · PURO · bloques con casos especiales Confianza/Recomendación.
// Verbatim del render del chat del piso (L40229-40282). Mismo split/markdown → mismo texto visible.
// Tabla markdown (| col | col |) → <table> real, con la paleta del chat. El narrador de C emite tablas así; sin esto
// se verían los pipes crudos. Encabezado en mono uppercase, cifras en tabular-nums, columnas numéricas alineadas a la
// derecha, filas con hairline. renderMarkdownLite(cell, true) da el resalte financiero color-only (limpio en celda).
function MarkdownTable({ table, keyPrefix }) {
  const { header, rows, align } = table;
  return (
    <div style={{ margin:"2px 0 18px 0", overflowX:"auto" }}>
      <table style={{ borderCollapse:"collapse", width:"100%", fontFamily:"'DM Sans', system-ui, sans-serif", fontSize:13.5 }}>
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={`${keyPrefix}-h${i}`} style={{
                textAlign: align[i] === "right" ? "right" : "left",
                padding:"0 14px 8px 0", borderBottom:`1px solid ${C.borderLight}`,
                fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:10.5, fontWeight:600,
                color:C.textMuted, textTransform:"uppercase", letterSpacing:"0.7px", whiteSpace:"nowrap"
              }}>{renderMarkdownLite(h, true)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={`${keyPrefix}-r${ri}`}>
              {r.map((cell, ci) => (
                <td key={`${keyPrefix}-r${ri}c${ci}`} style={{
                  textAlign: align[ci] === "right" ? "right" : "left",
                  padding:"9px 14px 9px 0",
                  borderBottom: ri < rows.length - 1 ? `1px solid ${C.border}` : "none",
                  color: ci === 0 ? C.text : C.textSub,
                  fontWeight: ci === 0 ? 600 : 400,
                  fontVariantNumeric: align[ci] === "right" ? "tabular-nums" : "normal",
                  whiteSpace: align[ci] === "right" ? "nowrap" : "normal"
                }}>{renderMarkdownLite(cell, true)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdiMessageBody({ text }) {
  return text.split(/\n\n+/).filter(Boolean).map((block, blockIdx) => {
    const trimmed = block.trim();
    // Tabla markdown de pipes → <table> real (antes que el modo ASCII, que no la reconoce)
    const mdTable = parseMarkdownTable(trimmed);
    if (mdTable) return <MarkdownTable key={`block-${blockIdx}`} table={mdTable} keyPrefix={`mdt-${blockIdx}`} />;
    // Cita Confianza · metadata con divider + check verde
    const isConfianza = /^\*[^*]+\*$/.test(trimmed) && /confianza/i.test(trimmed);
    if (isConfianza) {
      const inner = trimmed.replace(/^\*/, "").replace(/\*$/, "");
      return (
        <div key={`block-${blockIdx}`} style={{
          display:"flex", alignItems:"flex-start", gap:9,
          paddingTop:14, marginTop:6,
          borderTop:`1px solid ${C.hoverMedio}`,
          fontSize:12.5, color:C.textMuted, fontStyle:"italic",
          lineHeight:1.6, letterSpacing:"0.005em"
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop:3, flexShrink:0, filter:"drop-shadow(0 0 4px rgba(16,185,129,0.4))" }}>
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>{inner}</span>
        </div>
      );
    }
    // Encabezado Recomendación · eyebrow uppercase cyan
    const isRecHeading = /^\*\*\s*Recomendaci[oó]n\s*\*\*$/i.test(trimmed) || /^Recomendaci[oó]n\s*:?$/i.test(trimmed);
    if (isRecHeading) {
      return (
        <div key={`block-${blockIdx}`} style={{
          display:"flex", alignItems:"center", gap:9,
          marginTop:10, marginBottom:14,
          paddingTop:14, borderTop:`1px solid ${C.velo}`
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.textSub} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
          <span style={{
            fontFamily:"'JetBrains Mono', ui-monospace, monospace",
            fontSize:10.5, fontWeight:600, color:C.textSub,
            textTransform:"uppercase", letterSpacing:"1.4px"
          }}>
            Recomendación
          </span>
        </div>
      );
    }
    // Bloque TABULAR (columnas alineadas con padding de espacios · ej. "ventas por cliente") → contenedor MONOESPACIADO
    // con whiteSpace:pre (preserva TODOS los espacios) → las cifras quedan parejas. El texto crudo ya viene alineado en
    // monoespaciado; el chat lo rompía al mezclar 'DM Sans' bold (entidades) + JetBrains Mono (cifras). Byte-idéntico (solo render).
    if (isTabularText(trimmed)) {
      return (
        <div key={`block-${blockIdx}`} style={{
          margin: "2px 0 18px 0", whiteSpace: "pre", overflowX: "auto",
          fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 13, lineHeight: 1.75,
          color: C.textSub, letterSpacing: 0
        }}>
          {renderMarkdownLite(block, true)}
        </div>
      );
    }
    return (
      <p key={`block-${blockIdx}`} style={{ margin: "0 0 18px 0", whiteSpace: "pre-line" }}>
        {renderMarkdownLite(block)}
      </p>
    );
  });
}

// ── Botón Sentrix por mensaje (verbatim del piso) ──
// `msgId` (owner 2026-08-09 · Contrato de Concordancia): el CTA abre la dirección EXACTA que respalda la
// afirmación, y el shell necesita el id del mensaje para marcar cuál evidencia está abierta — el mismo mecanismo
// que ya usa "Ver evidencia en Sentrix".
function SentrixButton({ sentrixAction, onSentrixAction, msgId = null }) {
  if (!sentrixAction || !onSentrixAction || !sentrixAction.label) return null;
  return (
    <div style={{ marginLeft:44, marginTop:2, display:"flex", alignItems:"center", gap:8 }}>
      <button
        onClick={() => onSentrixAction(sentrixAction.payload, msgId)}
        style={{
          display:"flex", alignItems:"center", gap:6, padding:"7px 14px",
          background:C.hoverSuave, border:`1px solid ${C.cardBorder}`,
          borderRadius:6, color:C.textSub, fontFamily:"'DM Sans', system-ui, sans-serif",
          fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s"
        }}
        onMouseEnter={e => { e.currentTarget.style.background = C.velo; }}
        onMouseLeave={e => { e.currentTarget.style.background = C.hoverSuave; }}>
        <span>↗</span>
        <span>{sentrixAction.label}</span>
      </button>
      {sentrixAction.moduleChip && (
        <span style={{
          padding:"4px 9px", background:C.hoverMedio, border:`1px solid ${C.border}`,
          borderRadius:4, fontSize:10.5, fontWeight:600, color:C.textSub, letterSpacing:"0.2px"
        }}>
          {sentrixAction.moduleChip}
        </span>
      )}
    </div>
  );
}

// ── Botón "Ver evidencia en Sentrix" · Etapa 5 · aparece SOLO cuando el mensaje trae una lectura ejecutiva
// (msg.evidence.reading) y el shell pasó el handler. Flags Sentrix OFF → sin reading → sin botón (inerte).
// MULTI-ANÁLISIS (V3 · Frente C.1): si la evidencia trae `multi: [evidencias extra]`, se muestra UN botón por lente. ──
function _evLabel(evidence) {
  if (!evidence) return null;
  // DIVULGACIÓN PROGRESIVA (owner 2026-08-07): en una consulta general de entidad la respuesta NO trae el detalle
  // — el evolutivo y la composición ni siquiera se calcularon (ver progressiveDisclosure.js). El único camino al
  // detalle es la Ficha, y el botón tiene que decirlo con esas palabras, no con una etiqueta genérica de panel.
  // `_profileRequest` es la MISMA marca que ya hace que el panel abra la cara Ficha (SentrixPanel _clientLink).
  if (evidence._profileRequest && evidence.entidad) return `Ver ficha de ${evidence.entidad} en Sentrix`;
  if (evidence._profileRequest) return "Ver ficha en Sentrix";
  if (evidence.pnl) return "Ver el P&L en la Mesa";   // deep-link (2026-07-26) · la respuesta P&L abre la cara Resultado con su alcance
  if (evidence.lens === "temporal") return "Ver el año en la Mesa";   // deep-link 7b · el mes a mes abre la Mesa (la película del año)
  if (Array.isArray(evidence.criteriaList)) return "Ver lo que sé de tu negocio";   // C.2 · panel de criterio
  const isSim = !!evidence.transform;
  const isCuadro = !!(evidence.lens === "cuadro" && !evidence.reading);
  const isDiagnose = !!(Array.isArray(evidence.findings) && evidence.findings.length && !evidence.reading);   // focos → panel Diagnóstico
  const isCompare = !!(Array.isArray(evidence.pairs) && evidence.pairs.length && (evidence.compareB || evidence.entityB));   // A vs B → panel Comparación
  const isInventory = !!(evidence.inventory && Array.isArray(evidence.inventory.bySku) && evidence.inventory.bySku.length);   // capital → panel Inventario
  const isMargin = !!(evidence.margin && evidence.margin.panel && Array.isArray(evidence.margin.panel.rows) && evidence.margin.panel.rows.length);   // margen → panel Margen
  const _vp = evidence.ventas && evidence.ventas.panel;
  const isVentas = !!(_vp && (_vp.kind === "decomp" || (Array.isArray(_vp.rows) && _vp.rows.length)));   // movers/decomp/mix/rank → panel Ventas
  const isContrib = !!(evidence.contribucion && evidence.contribucion.panel && Array.isArray(evidence.contribucion.panel.rows) && evidence.contribucion.panel.rows.length);   // pareto/gap/rank → panel Contribución
  // isSimOracle (revisor UX 2026-07-31, CONFIRMADO en vivo — "el botón nunca aparece para una simulación vía chat"):
  // simulateGeneral (toolRegistry.js, ruta ORÁCULO) nunca seteaba `evidence.transform` (ese campo es EXCLUSIVO del
  // composer legacy composeSpecSimulate) ni ningún otro flag de arriba — cero botón, aunque SentrixPanel.jsx ya
  // tiene su panel dedicado (SimulationPanelOracle). Chequeo por forma real de sus facts (ventaActual/ventaNueva,
  // strings ya formateados por simulateGeneral) — MISMO chequeo que usa el dispatch de SentrixPanel.jsx, una sola verdad.
  const isSimOracle = !!(evidence.oracle && typeof evidence.ventaActual === "string" && typeof evidence.ventaNueva === "string");
  // BUGFIX (confirmado): isSim se calculaba arriba pero NO entraba en este gate — quedaba solo en el ternario de abajo,
  // así que solo "contaba" cuando ALGÚN OTRO flag ya abría la puerta. Los follow-ups "por qué"/"y entonces" sobre una
  // simulación (conversation.js: evidence { followup:true, kind:"explain"|"meta", transform: last.transform, boleta }·
  // sin lens/reading/findings/pairs/…) tienen SOLO `transform` seteado → el gate viejo los mataba con null → el botón
  // "Ver la proyección en Sentrix" desaparecía justo en el hilo de reentrada que este turno de trabajo debía arreglar.
  if (!evidence.reading && !isSim && !isSimOracle && !isCuadro && !isDiagnose && !isCompare && !isInventory && !isMargin && !isVentas && !isContrib) return null;
  return isSim || isSimOracle ? "Ver la proyección en Sentrix" : isCompare ? "Ver la comparación en Sentrix" : isInventory ? "Ver el inventario en Sentrix" : isMargin ? "Ver el margen en Sentrix" : isVentas ? "Ver las ventas en Sentrix" : isContrib ? "Ver la contribución en Sentrix" : isDiagnose ? "Ver el diagnóstico en Sentrix" : isCuadro ? "Ver en el Cuadro de mando" : "Ver evidencia en Sentrix";
}
function EvidenceButton({ evidence, onOpenEvidence, active }) {
  if (!evidence || !onOpenEvidence) return null;
  // primaria + las lentes extra del multi-análisis (cada una abre SU panel; deduplicadas por label)
  const evs = [evidence, ...(Array.isArray(evidence.multi) ? evidence.multi : [])];
  const seen = new Set();
  const items = evs.map((ev) => ({ ev, label: _evLabel(ev) })).filter((x) => x.label && !seen.has(x.label) && seen.add(x.label));
  if (!items.length) return null;
  return (
    <div style={{ marginLeft:44, marginTop:2, display:"flex", gap:8, flexWrap:"wrap" }}>
      {items.map((x, i) => (
        <button key={i}
          onClick={() => onOpenEvidence(x.ev)}
          style={{
            display:"flex", alignItems:"center", gap:7, padding:"7px 14px",
            background: active ? "rgba(47,184,218,0.16)" : C.hoverSuave,
            border:`1px solid ${active ? "rgba(47,184,218,0.6)" : C.cardBorder}`,
            borderRadius:6, color: active ? C.celeste : C.textSub, fontFamily:"'DM Sans', system-ui, sans-serif",
            fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s"
          }}
          onMouseEnter={e => { e.currentTarget.style.background = active ? "rgba(47,184,218,0.2)" : C.velo; }}
          onMouseLeave={e => { e.currentTarget.style.background = active ? "rgba(47,184,218,0.16)" : C.hoverSuave; }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="14" y1="9" x2="14" y2="21"/>
          </svg>
          <span>{x.label}</span>
        </button>
      ))}
    </div>
  );
}

// UX · estado "pensando" CON VIDA (owner 2026-07-08 · percepción de velocidad): fases HONESTAS del pipeline real.
// MEJORA 9 (2026-07-26): las fases ya no avanzan con un timer ciego (2.2s fijos, desacoplado de lo que pasaba) —
// ahora el pipeline AVISA su paso real (onPhase en buildAdiTurnLLM/_narrateResult) y el indicador lo refleja:
// LLM #1 en vuelo → motor local ejecuta → LLM #2 redacta → number-guard verifica. Honestidad literal: cada
// etiqueta se muestra mientras ESO está pasando, y el salto de fase comunica el avance de verdad.
const _THINK_PHASES = ["Entendiendo la pregunta", "Armando la cuenta", "Redactando la respuesta", "Verificando cada cifra"];
function ThinkingIndicator({ phase = 0 }) {
  const ph = Math.min(Math.max(phase, 0), _THINK_PHASES.length - 1);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, color:C.textSub, fontSize:14, fontFamily:"'DM Sans', system-ui, sans-serif" }}>
      <span style={{ transition:"opacity 0.3s" }}>{_THINK_PHASES[ph]}</span>
      <span className="adi-think"><span className="adi-dot"/><span className="adi-dot"/><span className="adi-dot"/></span>
    </div>
  );
}

// UX · marca sutil del origen de la respuesta (SOLO en modo LLM · en demo el header ya lo indica).
//   "llm" = el LLM redactó sobre cifras validadas por ADI (number-guard OK) · "deterministico" = texto de ADI (parse-only o fallback).
function SourceBadge({ source }) {
  if (source !== "llm" && source !== "deterministico") return null;
  const isAI = source === "llm";
  // owner 2026-08-05 ("conecta todo Sentrix con ADI... eso debe funcionar bien"): "determinístico" era una
  // etiqueta SIEMPRE visible (no un tooltip) bajo cada respuesta no-narrada, en las 3 pestañas — jerga interna
  // que nadie del negocio entiende, la misma familia del hallazgo "es aritmética" ya cerrado en pnl.js. "cálculo
  // directo" comunica lo mismo (esta respuesta salió del motor, no la redactó un LLM) en lenguaje llano.
  return (
    <div style={{ marginLeft:44, marginTop:1, display:"flex", alignItems:"center", gap:6, opacity:0.72 }}
      title={isAI ? "Redactado por el LLM sobre cifras validadas por ADI (nunca inventa cifras)" : "Respuesta calculada directamente por ADI, sin redacción de IA"}>
      <span style={{ width:5, height:5, borderRadius:"50%", background: isAI ? C.celeste : C.textMuted, flexShrink:0 }}/>
      <span style={{ fontSize:9.5, fontFamily:"'JetBrains Mono', ui-monospace, monospace", letterSpacing:"0.6px", color:C.textMuted, textTransform:"uppercase" }}>
        {isAI ? "narrado · IA" : "cálculo directo"}
      </span>
    </div>
  );
}

// INICIO · las 4 preguntas CLAVE (owner 2026-07-25: "que sean más claves — la primera es el P&L del negocio,
// con nombre de P&L, y ADI guía los supuestos en el chat") → specs ENLATADOS. Corren en demo Y con LLM: el
// análisis es 100% determinístico · sólo el texto libre pasa por el LLM. El flagship es la historia del P&L
// (composePnl "perdiendo": cascada del negocio + fugas · sin gastos declarados ABRE el flujo guiado).
// EXPORTADO (owner 2026-08-07 · guía de inicio): GuiaInicio.jsx deriva sus ejemplos de acá por texto exacto en vez
// de declarar preguntas propias — estos specs están curados y verificados, y una guía que prometa algo que el motor
// no contesta convierte el primer turno del usuario en un decline. Una sola fuente de preguntas de entrada.
const _SPEC = (o) => ({ schemaVersion: 1, scenario: "actual", filters: {}, ...o });
export const HERO_CHIPS = [
  { q: "¿Cómo viene el P&L de mi negocio?",   spec: { schemaVersion: 1, turn_type: "pnl_setup", pnl: { action: "perdiendo" } } },
  { q: "¿Cuánto me queda después de gastos?", spec: { schemaVersion: 1, turn_type: "pnl_setup", pnl: { action: "resultado" } } },
  { q: "¿Qué clientes ceden más margen?",     spec: _SPEC({ operation: "rank", dimension: "cliente", metric: "margen", sort: { by: "margen", dir: "asc" }, limit: 5 }) },
  { q: "¿Dónde tengo capital inmovilizado?",  spec: _SPEC({ operation: "overview", dimension: "bodega", metric: "capital" }) },
];

/* ── HISTORIA DE ESTA PANTALLA, en dos vueltas · leerla antes de volver a recortarla ────────────────────────
 *
 * 2026-08-12 · el owner la cortó a la raíz: título, una línea y nada más. Antes tenía título-promesa, botón de
 * Resumen ejecutivo y seis chips. Su razón sigue siendo válida y NO se revirtió: un inicio con vitrina de
 * preguntas se lee como una página web que vende el producto, no como un asistente.
 *
 * 2026-08-20 · el owner diseñó y aprobó la pantalla que está abajo (variante A del mockup). Lo que cambió no
 * es la razón, es el diagnóstico: cortada a la raíz la pantalla quedó VACÍA —~70% de aire— y el vacío tampoco
 * se lee como un asistente serio, se lee como un producto sin terminar. La respuesta no fue devolver la
 * vitrina: fue **subir el campo de pregunta al centro** y llenar el resto con lo único que no es promoción —
 * las cifras reales del negocio de quien mira (el pulso) y las cuatro preguntas que el motor sí contesta.
 *
 * Las seis chips NO volvieron: son CUATRO, y son las de `HERO_CHIPS`, la misma fuente de la guía.
 */
/* ── EL CAMPO DE HEXÁGONOS · el fondo de la landing, traído a la app ────────────────────────────────────────
 * No es adorno: es el plano sobre el que el instrumento mide, y es lo que hermana la app con adiai.cl.
 * Geometría de la marca (pointy-top, R=52), la misma de `landing-v2/src/scripts/hex.js`.
 *
 * ⚠️ LA RETÍCULA ES UN ANILLO, NO UN FONDO PAREJO, y esto no es un gusto: la máscara se ABRE en el centro para
 * que ahí mande el halo. Si se rellena el centro, el título queda leyéndose sobre una grilla y compite. Los
 * hexágonos acompañan desde el borde — se notan, no se roban la película.
 * `aria-hidden` porque no dice nada: quien navega con lector de pantalla no se pierde absolutamente nada. */
const _HEX_MASK_CAMPO = "radial-gradient(78% 70% at 50% 40%, #000 30%, transparent 86%)";
const _HEX_MASK_ANILLO = "radial-gradient(66% 60% at 50% 40%, transparent 0%, transparent 24%, rgba(0,0,0,0.5) 46%, #000 68%, transparent 100%)";
/* ⚠️ SOBRE PAPEL EL ANILLO SE ABRE MUCHO MÁS (owner 2026-08-26: «el halo central quedaría despejado cuando se
 * iniciara el chat; los hexágonos iban por el costado, así no se interponen»). Es la MISMA regla de siempre,
 * pero el anillo del tablero no alcanza acá: despejaba hasta ~228 px del centro y la columna de conversación
 * llega a ~380, así que entre medio la retícula quedaba DEBAJO del texto. Sobre negro daba igual —el trazo es
 * luz al 3,6% y el ojo no lo registra bajo una palabra—; sobre papel es tinta al 8,5% y sí se lee.
 * Medido a 1440: el hueco limpio pasa de 228 a ~446 px, y los hexágonos arrancan recién donde termina la
 * conversación. El centro queda para el halo, que es lo que el diseño quería desde el principio. */
const _HEX_MASK_ANILLO_PAPEL = "radial-gradient(50% 72% at 50% 40%, transparent 0%, transparent 62%, rgba(0,0,0,0.42) 80%, #000 100%)";
/* ⚠️ CONVERSANDO EL CENTRO NO SE DIBUJA (owner 2026-08-26: «la conversación debe salir con un halo limpio»,
   y antes: «los hexágonos iban por el costado así no se interponen»). Las máscaras de arriba son RADIALES:
   despejan un óvalo, que es lo correcto para la portada, donde el contenido es un bloque corto en el medio.
   Pero un hilo de chat es una COLUMNA ALTA — baja más que el óvalo y se le sale por abajo, así que el texto
   terminaba cruzando la retícula. Esta es una banda VERTICAL: limpia el centro de arriba a abajo, entero, y
   deja los hexágonos solo en los dos márgenes. Corta al 26/74% para que el despejado le gane a la columna de
   760 px de la conversación; en pantalla angosta —o con la Mesa abierta— no queda ni un hexágono, que es el
   lado seguro del error: el que lee no tiene que ver nada detrás de lo que lee.

   ⚠️ EN PIXELES, NO EN PORCENTAJE, y esto costó una pasada. Con la banda al 26/74% el texto se salía 10 px por
   la derecha: la columna del hilo NO está centrada —la barra lateral la corre— así que un despejado simétrico
   en porcentaje nunca le calza. MEDIDO sobre 1440 px: el texto ocupa de −268 a +356 respecto del centro. Los
   420 px de acá cubren ese lado largo con 64 px de aire, y como son fijos siguen cubriéndolo si el panel se angosta.
   El regalo del calc(): si el panel baja de ~1000 px los topes se vuelven negativos, el borde opaco desaparece
   solo y no queda hexágono ninguno — justo lo que hay que hacer cuando ya no sobra margen donde ponerlos. */
const _HEX_MASK_CONVERSA = "linear-gradient(to right, #000 0px, #000 calc(50% - 500px), transparent calc(50% - 420px), transparent calc(50% + 420px), #000 calc(50% + 500px), #000 100%)";
// las celdas que se encienden solas: posiciones y tiempos fijos, nunca al azar — un fondo que parpadea distinto
// en cada carga se percibe como un defecto de render, no como vida.
const _HEX_LIT = [
  { left:"9%",  top:"16%", dur:"11s",  delay:"0s"   }, { left:"78%", top:"23%", dur:"13s", delay:"2.4s" },
  { left:"22%", top:"63%", dur:"9.5s", delay:"4.1s" }, { left:"66%", top:"72%", dur:"12s", delay:"6.3s" },
  { left:"88%", top:"52%", dur:"10s",  delay:"8.2s" }, { left:"4%",  top:"41%", dur:"14s", delay:"5.2s" },
];
/* ⚠️ SOBRE PAPEL SE VAN A LOS COSTADOS. Los del tablero no sirven acá: a 1440 los de 22% y 66% caen DENTRO de
 * la columna de conversación (340–1100 px), o sea justo debajo del texto. En negro no molestaban porque el
 * encendido es luz muy tenue; en papel es tinta y compite con lo que se está leyendo. Estos seis viven todos
 * fuera de la columna, repartidos arriba y abajo para que el borde no quede muerto ni acartonado. */
const _HEX_LIT_PAPEL = [
  { left:"2%",  top:"18%", dur:"11s",  delay:"0s"   }, { left:"90%", top:"22%", dur:"13s", delay:"2.4s" },
  { left:"7%",  top:"62%", dur:"9.5s", delay:"4.1s" }, { left:"85%", top:"68%", dur:"12s", delay:"6.3s" },
  { left:"93%", top:"44%", dur:"10s",  delay:"8.2s" }, { left:"1%",  top:"40%", dur:"14s", delay:"5.2s" },
];

/* ⚠️ VA DE BORDE A BORDE DEL PANEL, NO DENTRO DE LA COLUMNA DE TEXTO — y esto no es un detalle de maquetado,
 * es la diferencia entre que se vea y que no. Primer intento: se montó como hijo del hero, que vive en la
 * columna centrada del transcript (`maxWidth:900`). El campo heredó ese ancho —852 px de 1440— y como la
 * máscara VACÍA el centro a propósito, lo único que quedaba era una tira finísima a cada lado: el owner lo
 * leyó, con razón, como que los hexágonos no estaban. Va como HERMANO del contenido, con el panel entero de
 * referencia.
 *
 * ⚠️ NO SE APAGA AL PRIMER MENSAJE, y tampoco scrollea con el hilo. El centro se vacía justamente para que
 * las burbujas de la conversación caigan sobre el HALO y nunca sobre la retícula: apagarlo con la portada
 * rompía lo único que el diseño estaba resolviendo. Por eso vive fuera del contenedor que scrollea — si
 * viviera adentro, el fondo se iría hacia arriba con los mensajes y el halo dejaría de estar centrado en el
 * panel. Se centra en el PANEL, no en el hilo. */
function CampoHexagonos({ conversando }) {
  // CONVERSANDO manda otra máscara y NINGÚN halo. El anillo se anula porque la banda vertical ya hace el
  // trabajo: encimar las dos recortaría también los márgenes y no quedaría un solo hexágono a la vista.
  const _anillo = conversando ? "none" : (esSuperficieADI() ? _HEX_MASK_ANILLO_PAPEL : _HEX_MASK_ANILLO);
  const _campo  = conversando ? _HEX_MASK_CONVERSA : _HEX_MASK_CAMPO;
  return (
    <div aria-hidden="true" style={{ position:"absolute", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden",
      WebkitMaskImage:_campo, maskImage:_campo }}>
      <style>{`
        @keyframes adiHeroGiro { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes adiHeroRespira { from { opacity:0.62; transform:scale(1); } to { opacity:1; transform:scale(1.09); } }
        /* ⚠️ EL LATIDO NO ES EL MISMO EN LOS DOS MUNDOS, y no por gusto (owner 2026-08-26: «el efecto de los
           hexágonos no lo veo moviéndose, están quietos»). MEDIDO: sobre papel el pico del latido movía el
           pixel 18 unidades durante menos de un segundo en seis hexágonos dispersos — corría de verdad, pero
           nadie lo veía. Sobre negro ese mismo salto SÍ se nota, porque el ojo distingue mucho mejor luz sobre
           oscuro que tinta sobre claro. Así que en papel el pico sube y, sobre todo, SE QUEDA: enciende hasta
           el 22% del ciclo y baja despacio, en vez de parpadear y apagarse. */
        @keyframes adiHeroPrende { 0%{opacity:0} 9%{opacity:0.6} 55%{opacity:0.12} 100%{opacity:0} }
        @keyframes adiHeroPrendePapel { 0%{opacity:0} 8%{opacity:1} 22%{opacity:0.9} 62%{opacity:0.35} 100%{opacity:0} }
        @media (prefers-reduced-motion: reduce) {
          [style*="adiHeroGiro"], [style*="adiHeroRespira"], [style*="adiHeroPrende"] { animation: none !important; }
        }
      `}</style>
      {/* EL HALO SOLO EN LA PORTADA · es una mancha de color en el medio de la pantalla, justo donde después
          cae la conversación. Detrás de un titular suelto sostiene; detrás de párrafos es papel sucio, y eso
          fue lo que el owner cazó. Al primer mensaje se va — no se atenúa: se va.
          EL HALO · dos capas. El núcleo se apoya detrás del hexágono; el respiro amplio sostiene la pantalla
          entera. Respira lento (17s de ida y 17s de vuelta): más rápido se lee como una alerta. */}
      {!conversando && (
        <div style={{ position:"absolute", inset:"-10%", animation:"adiHeroRespira 17s ease-in-out infinite alternate",
          background:`radial-gradient(26% 24% at 50% 30%, ${C.haloNucleo}, transparent 74%), radial-gradient(58% 54% at 50% 38%, ${C.haloAmplio}, transparent 72%)` }}/>
      )}
      <svg style={{ position:"absolute", inset:-60, width:"calc(100% + 120px)", height:"calc(100% + 120px)",
        WebkitMaskImage:_anillo, maskImage:_anillo }}>
        <defs>
          {/* ⚠️ CADA LÍNEA SE DIBUJA UNA SOLA VEZ, y llegar acá costó una corrección (owner 2026-08-26: «hay
              unas líneas que no cuadran con el diseño»). La versión anterior dibujaba CINCO HEXÁGONOS CERRADOS.
              Dos problemas encima del otro:

              1) En una retícula, cada arista la comparten DOS hexágonos vecinos — dibujar hexágonos cerrados
                 la pinta dos veces. Y tres de esos cinco hexágonos eran, además, la baldosa ya repetida por el
                 propio `pattern` (traslados exactos de +90,07 y +156). MEDIDO: la misma línea se dibujaba
                 entre 2 y 6 veces según cuál fuera. Con trazo translúcido eso no es "un poco más marcado":
                 al 8,5% de tinta, seis pasadas dan 41% — la mitad de la retícula quedaba al doble de oscura
                 que la otra mitad, sin ninguna razón de diseño. Eso era lo que se veía desalineado.
              2) La misma arista aparecía escrita con dos números distintos (45,03 y 45,04; 90,06 y 90,07), así
                 que además de repetirse, se repetía CORRIDA — dos rayas paralelas a una centésima de distancia.

              LA FORMA CORRECTA: un hexágono tiene 6 aristas pero sólo 3 son suyas (las otras 3 se las pone el
              vecino). Dos polilíneas ABIERTAS —el lado derecho de cada uno de los dos hexágonos de la baldosa—
              cubren la retícula entera sin pisar nada. VERIFICADO: 0 aristas repetidas y los vértices interiores
              todos con grado 3, que es como cierra una retícula hexagonal.

              Y LOS NÚMEROS SON EXACTOS, no redondeados a dos decimales: para R=52 el semiancho es R·√3/2 =
              45,0333 y la baldosa 90,0666. Con 90,07 sobraban 0,0034 por baldosa, que a veinte baldosas ya es
              una raya visiblemente fuera de sitio.

              ⚠️ SI ALGUIEN VUELVE A CERRAR ESTOS TRAZOS (poner `Z`, o dibujar el hexágono entero), la retícula
              se oscurece al doble y vuelve el defecto. El grosor está calibrado para UNA pasada. */}
          <pattern id="adiHexCampo" width="90.0666" height="156" patternUnits="userSpaceOnUse">
            <g fill="none" stroke={C.hexTrazo} strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinecap="square">
              <path d="M0,-52 L45.0333,-26 L45.0333,26 L0,52"/>
              <path d="M45.0333,26 L90.0666,52 L90.0666,104 L45.0333,130"/>
              {/* ⚠️ ESTA TERCERA LÍNEA NO ES UNA LÍNEA MÁS: ES LA OTRA MITAD DE LA DE ARRIBA. El trazo vertical
                  de la fila de abajo cae JUSTO sobre el borde derecho del mosaico (x = 90,0666), así que el
                  mosaico le corta la mitad que se sale — y esa mitad no la pinta nadie, porque en la baldosa
                  siguiente ese punto es x=0 y ahí no había nada dibujado. MEDIDO: esa línea pesaba 26 contra
                  53 de la otra fila. Exactamente la mitad. Es el defecto que se veía: media retícula fina y
                  media gruesa, y era el mismo dibujo repetido mal, no un problema de color.
                  Con este tramo en x=0, cada baldosa aporta su mitad y en la junta se arma un trazo entero.
                  VERIFICADO sobre el dibujo rasterizado: las dos filas pesan 53 y 53 — desnivel 1,00.
                  ⚠️ NO BORRAR pensando que sobra por estar "fuera" del hexágono. Sin esto vuelve el defecto. */}
              <path d="M0,52 L0,104"/>
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#adiHexCampo)"/>
      </svg>
      {(esSuperficieADI() ? _HEX_LIT_PAPEL : _HEX_LIT).map((h, i) => (
        <svg key={i} viewBox="0 0 90.0666 104" width="90" height="104"
          style={{ position:"absolute", left:h.left, top:h.top, opacity:0,
            animation:`${esSuperficieADI() ? "adiHeroPrendePapel" : "adiHeroPrende"} ${h.dur} ease-out infinite`, animationDelay:h.delay }}>
          <polygon points="45.0333,0 90.0666,26 90.0666,78 45.0333,104 0,78 0,26" fill={C.hexLit}/>
        </svg>
      ))}
    </div>
  );
}

/* ── INICIO · la pantalla que abre la app ───────────────────────────────────────────────────────────────────
 * ES LA PANTALLA QUE EL OWNER APROBÓ (variante A, 2026-08-20), llevada del mockup al producto tal cual, con
 * UNA sola desviación deliberada, que él mismo ordenó al aprobarla: **las palabras que no usamos se corrigen**.
 * El mockup decía «bajo la vara de 30,1%», «capital detenido» y «margen consolidado»; acá se dice benchmark,
 * inmovilizado y margen promedio — las tres son las que el motor ya emite (ver `pulsoInicio.js`).
 *
 * EL DIAGNÓSTICO QUE LA ORDENÓ: la pantalla anterior no estaba mal de color, estaba VACÍA — un título, una
 * línea y el campo abajo del todo, con ~70% de aire. Lo que la llena: el hexágono grande de protagonista, el
 * campo de pregunta SUBIDO al centro mientras no hay conversación, las cuatro preguntas a la vista, y la banda
 * con el pulso del negocio.
 *
 * ⚠️ EL CAMPO DE PREGUNTA LO RECIBE POR PROP (`campo`), no lo declara. Es el MISMO nodo que se ancla abajo
 * cuando arranca la conversación: si esta pantalla dibujara su propio input, habría dos campos con dos estados
 * y el texto a medio escribir se perdería al enviar el primer mensaje.
 *
 * ⚠️ `HERO_CHIPS` es la ÚNICA fuente de las cuatro preguntas — no se duplican acá. `GuiaInicio.jsx` deriva sus
 * ejemplos de esa misma constante por TEXTO EXACTO, así que una pregunta escrita a mano en esta pantalla
 * quedaría desincronizada de la guía en el primer cambio.
 *
 * El click MANDA EL TEXTO AL CHAT NORMAL (`submit`), no un spec enlatado: es la orden del owner del 2026-08-15
 * para la guía, y vale igual acá — «debe responder exactamente igual que si yo escribiera la pregunta».
 *
 * Todo el bloque desaparece solo al primer mensaje — lo monta `messages.length === 0`, no un flag aparte. */
const _CHIP_ICONOS = [
  <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
  <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
  <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></>,
];

function HeroInicio({ scenario, campo, onPregunta }) {
  // EL PULSO LO ARMA EL MOTOR. Acá no se suma, no se divide y no se redondea nada: `buildPulsoInicio` devuelve
  // la cifra y la frase ya hechas y esta vista las pinta. Si el módulo declina (sin cartera), la banda no va —
  // no se rellena con ceros. useMemo porque el escenario no cambia entre renders del chat.
  const pulso = useMemo(() => { try { return buildPulsoInicio(scenario); } catch { return null; } }, [scenario]);

  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", alignItems:"center",
      padding:"3vh 4px 16px", fontFamily:"'DM Sans', system-ui, sans-serif", minHeight:0 }}>
      {/* el campo de hexágonos NO se monta acá: vive en la raíz del chat, detrás de todo y para siempre.
          Ver la nota de `CampoHexagonos` — montarlo acá adentro fue exactamente el defecto que hubo que corregir. */}

      {/* EL CUBO VIVO · el hexágono es la marca; lo que gira es el ANILLO interior, no la silueta. Rotar el
          logo entero lo convertiría en un spinner —"espera, estoy cargando"— y acá no se está esperando nada:
          se está invitando a hablar. El anillo girando lento dice "atento", que es lo que ADI hace. */}
      <svg width="132" height="132" viewBox="0 0 200 200" fill="none" stroke={C.logoTrazo} strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position:"relative", zIndex:1, marginBottom:20, flexShrink:0 }}>
        <polygon points="100,15 173.6,57.5 173.6,142.5 100,185 26.4,142.5 26.4,57.5"/>
        <g style={{ transformOrigin:"100px 100px", animation:"adiHeroGiro 22s linear infinite" }}>
          <circle cx="100" cy="100" r="55" strokeWidth="1.7" opacity="0.6"/>
          <ellipse cx="100" cy="100" rx="55" ry="22" strokeWidth="1.5" opacity="0.45"/>
        </g>
        <circle cx="100" cy="100" r="7" fill={C.celeste} stroke="none">
          <animate attributeName="opacity" values="1;0.42;1" dur="3.4s" repeatCount="indefinite"/>
        </circle>
      </svg>

      <div style={{ position:"relative", zIndex:1, width:"100%", display:"flex", flexDirection:"column", alignItems:"center" }}>
        {/* ⚠️ EL TITULAR CAMBIA CON LA SUPERFICIE (owner 2026-08-26): «eso es muy robot, debe ser más simple;
            para un inicio está bien, pero hay que pensar en el día a día — puede ser "por dónde empezamos"».
            El titular largo servía para EXPLICAR el producto la primera vez; a la décima mañana cansa. Y la
            bajada se va con él: las cuatro preguntas de abajo SON la respuesta a «por dónde», así que contarlo
            además es decir dos veces lo mismo. Lo que antes se explicaba, ahora se muestra.
            En el TABLERO no se toca: es lo que hoy corre en producción y el cambio va detrás del interruptor. */}
        <h1 style={{ margin:0, fontSize:34, fontWeight:600, color:C.text, letterSpacing:"-0.021em",
          lineHeight:1.18, textAlign:"center", textWrap:"balance" }}>
          {esSuperficieADI() ? "¿Por dónde empezamos?" : "¿Qué quieres entender de tu negocio?"}
        </h1>
        {!esSuperficieADI() && (
          <p style={{ margin:"10px 0 0", maxWidth:"52ch", fontSize:16.5, fontWeight:500, lineHeight:1.5,
            color:C.textSub, letterSpacing:"-0.006em", textAlign:"center" }}>
            Pregúntame por tus ventas, tus márgenes o tu inventario — te respondo con la cifra y con la cuenta que la respalda.
          </p>
        )}

        {/* el campo que baja y se ancla al primer mensaje · llega por prop, no se declara acá */}
        <div style={{ width:"100%", maxWidth:660, marginTop:26 }}>{campo}</div>

        {/* LAS CUATRO PREGUNTAS · derivadas de HERO_CHIPS, una sola fuente con la guía */}
        <div style={{ width:"100%", maxWidth:760, marginTop:24, display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap:10 }}>
          {HERO_CHIPS.map((c, i) => (
            <button key={c.q} onClick={() => onPregunta(c.q)}
              style={{ display:"flex", alignItems:"center", gap:11, textAlign:"left", cursor:"pointer",
                background:C.hoverSuave, border:`1px solid ${C.borderLight}`, borderRadius:13, padding:"15px 16px",
                color:C.text, fontFamily:"inherit", fontSize:16, fontWeight:600, letterSpacing:"-0.011em", lineHeight:1.3,
                transition:"background 0.14s, border-color 0.14s, transform 0.14s" }}
              onMouseEnter={e => { e.currentTarget.style.background=C.hoverMedio; e.currentTarget.style.borderColor=C.celeste; e.currentTarget.style.transform="translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background=C.hoverSuave; e.currentTarget.style.borderColor=C.borderLight; e.currentTarget.style.transform="none"; }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.celeste} strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, opacity:0.85 }} aria-hidden="true">
                {_CHIP_ICONOS[i % _CHIP_ICONOS.length]}
              </svg>
              {c.q}
            </button>
          ))}
        </div>

        {/* EL PULSO · cifras del motor. Cada una es CLICKEABLE hacia su pregunta: la banda no es un dashboard
            que se mira, es una fila de puertas a la conversación (anti-BI · misma regla que las filas de Sentrix). */}
        {/* ⚠️ SOBRE PAPEL EL PULSO ES UN INSTRUMENTO, NO UNA BANDA (owner 2026-08-26, al elegir «con pulso»).
              Sale de la regla del propio rediseño —«todo lo que MIDE viene en oscuro»— y resuelve de paso la
              objeción de que el hero repitiera lo que la Mesa ya muestra: deja de ser una fila de cifras sueltas
              y pasa a ser una tarjeta apoyada sobre la hoja, del mismo material que Sentrix.
              Las cifras siguen siendo BOTONES que mandan su pregunta al chat: eso no se toca, es lo que las hace
              puertas de entrada y no datos repetidos. En el tablero, todo queda exactamente como estaba. */}
        {/* ⚠️ SOBRE PAPEL EL PULSO NO VA (owner 2026-08-26, dos veces: «quita esas cosas, son datos que tiene
            Sentrix, es repetirlo; dejemos un hero de ADI más limpio» y, al verlo montado, «el cuadro negro
            dijimos que no iba»). Su argumento es el que manda: repetir en el hero de ADI lo que la Mesa ya
            muestra es el olor a BI que la estructura por función salió a matar.
            SE APAGA SOLO EN PAPEL, no en el tablero: el tablero es lo que hoy corre en producción y el
            interruptor promete no moverlo. `pulsoInicio.js` NO se borra — sigue siendo la forma correcta de que
            la vista no calcule, y el tablero lo sigue usando. */}
        {pulso && !esSuperficieADI() && (
          <div style={{ width:"100%", maxWidth:860, marginTop:34,
            ...(esPapel()
              ? { background:T.bg, borderRadius:13, padding:"16px 18px 15px",
                  boxShadow:"0 16px 40px -14px rgba(10,10,10,0.40), 0 3px 10px -3px rgba(10,10,10,0.16)" }
              : { paddingTop:24, borderTop:`1px solid ${C.border}` }) }}>
            <p style={{ margin:"0 0 14px", textAlign:"center", fontSize:11.5, fontWeight:600,
              letterSpacing:"0.15em", textTransform:"uppercase", color:T.textMuted }}>{pulso.rotulo}</p>
            <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(150px, 1fr))`, gap:8 }}>
              {pulso.cifras.map((c) => (
                <button key={c.key} onClick={() => onPregunta(c.ask)} title={`Pregúntale a ADI: ${c.ask}`}
                  style={{ textAlign:"center", padding:"6px 6px 8px", background:"transparent", border:"1px solid transparent",
                    borderRadius:10, cursor:"pointer", fontFamily:"inherit", transition:"background 0.14s, border-color 0.14s" }}
                  onMouseEnter={e => { e.currentTarget.style.background=T.hoverSuave; e.currentTarget.style.borderColor=T.border; }}
                  onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; }}>
                  <span style={{ display:"block", fontSize:21, fontWeight:600, letterSpacing:"-0.02em", color:T.celeste,
                    fontVariantNumeric:"tabular-nums lining-nums", lineHeight:1.1 }}>{c.valor}</span>
                  <span style={{ display:"block", marginTop:5, fontSize:12.5, fontWeight:500, color:T.textMuted, lineHeight:1.35 }}>{c.etiqueta}</span>
                </button>
              ))}
            </div>
            <p style={{ margin:"18px auto 0", maxWidth:640, textAlign:"center", fontSize:15, fontWeight:500,
              lineHeight:1.55, color:T.textSub, letterSpacing:"-0.006em" }}>
              <b style={{ fontWeight:600, color:T.text }}>{pulso.lectura.destacado}</b> {pulso.lectura.cola}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* EL HERO VIEJO SE FUE (La Poda Fase 2A, 2026-08-14). `_HeroInicioLegacy` —título-promesa + botón «Resumen
 * ejecutivo» + la grilla de HERO_CHIPS— quedaba acá sin montarse desde que el owner cortó el inicio a una sola
 * pregunta (2026-08-12). Verificado antes de borrarlo: cero callers en todo el repo (definición única). Lo que
 * pintaba sigue vivo donde corresponde: `HERO_CHIPS` (arriba) alimenta a `GuiaInicio.jsx`, y el resumen ejecutivo
 * se pide hablando —el coerce de «hazme un resumen ejecutivo» arma el mismo spec, gate-proven. */

export function ChatADI({ scenario = "bonanza", modulo = null, onSentrixAction = null, onOpenEvidence = null, animate = true, initialContext = null, openEvidenceId = null, registerAsk = null, registerReset = null, registerRun = null, onHayConversacion = null, margenBarra = 0 }) {
  const [messages, setMessages] = useState([]);     // [{ id, role, text, sentrixAction, suggestions }]
  const [input, setInput]       = useState("");
  const [showHint, setShowHint] = useState(() => { try { return typeof localStorage !== "undefined" && !localStorage.getItem("adi_hint_v1"); } catch { return false; } });   // hint de primer uso (una vez)
  const [context, setContext]   = useState(initialContext || (modulo ? { activeModule: modulo } : {}));
  const [pendingId, setPendingId] = useState(null); // id del mensaje ADI animándose (typewriter)
  const [thinkPhase, setThinkPhase] = useState(0);  // mejora 9 · fase REAL del pipeline en vuelo (la reporta buildAdiTurnLLM vía onPhase)
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const idRef = useRef(0);
  const ctxRef = useRef(context);   // SIEMPRE el contexto más reciente (evita la stale-closure de React en el camino LLM async · threading de lastEvidence)
  // REENTRADA (fix): mismo patrón que ctxRef, mismo motivo. `messages` (el state) solo refleja el turno recién agregado
  // DESPUÉS de que React re-renderice — si el usuario reingresa (Enter/click) antes de ese re-render, el `submit` en
  // vuelo en ese instante todavía cierra sobre el `messages` de la render ANTERIOR, más corto. messagesRef.current se
  // sincroniza en cada render (efecto de abajo) y es lo que se lee para armar recentTurns — nunca la variable `messages`
  // capturada en el closure de `submit`/`submitSpec`.
  const messagesRef = useRef(messages);
  // isSubmittingRef: ref (no useState) — bloquea un segundo submit/submitSpec mientras el primero sigue en vuelo (fetch
  // async al gateway). Se necesita un REF porque la mutación tiene que ser SÍNCRONA e inmediata (antes del próximo
  // evento de teclado/click), y setState no lo garantiza (se procesa en el ciclo de render de React). Sin esta guardia,
  // dos turnos concurrentes compiten por escribir ctxRef.current/setContext en su `.then()` — el que RESUELVE último
  // gana, sin importar cuál se disparó último, así que un turno 1 lento puede pisar con su contexto viejo el resultado
  // ya aplicado del turno 2 (se pierde lastEvidence/memoria del turno que en verdad debía quedar vigente).
  const isSubmittingRef = useRef(false);
  const scrollRef = useRef(null);
  const inputRef  = useRef(null);
  // el contexto de pantalla que dejó el último "Que ADI lo explique" · se consume (y se limpia) al enviar el turno
  const pendingVcRef = useRef(null);

  // SEGUIR LA CONVERSACIÓN, NO LA PORTADA (owner 2026-08-20 · defecto cazado al implementar la pantalla nueva):
  // este efecto pega el scroll abajo para que la última respuesta quede a la vista. Con el inicio de una sola
  // línea daba igual —no había nada que scrollear—, pero la pantalla nueva es alta: al montar, "abajo del todo"
  // dejaba el hexágono y el título FUERA DE PANTALLA y la app abría por la mitad. Sin mensajes no se scrollea.
  useEffect(() => {
    if (!messages.length) return;
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // el panel del historial (columna izquierda) necesita saber si hay hilo vivo · solo un booleano, ningún texto:
  // el contenido de la conversación no sale de este componente.
  useEffect(() => { if (onHayConversacion) onHayConversacion(messages.length > 0); }, [messages.length, onHayConversacion]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // el textarea AUTO-CRECE con el texto largo (hasta ~7 líneas · después scrollea adentro) · vuelve a 1 línea al enviar
  useEffect(() => {
    const ta = inputRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; }
  }, [input]);

  // B.2 · BIDIRECCIONAL (la mesa habla): Sentrix pre-carga una pregunta acá (click en una fila del panel) → prefill +
  // focus. El usuario confirma con Enter — sin auto-envío (cero gasto por misclick, la decisión sigue siendo del usuario).
  // CONTRATO DE CONCORDANCIA (owner 2026-08-09): el `ask` de Sentrix ahora trae DOS cosas — la pregunta (que se
  // precarga, como siempre) y el CONTEXTO ESTRUCTURADO de la pieza que el usuario tocó. El contexto queda en un ref
  // y viaja con el turno cuando el usuario confirme, INCLUSO SI REESCRIBE LA PREGUNTA A MANO: lo que importa es qué
  // estaba mirando, no qué texto quedó en el input. El prefill NO cambia (el click informa, nunca dispara).
  useEffect(() => {
    if (typeof registerAsk === "function") registerAsk((q, vc) => {
      setInput(String(q || ""));
      pendingVcRef.current = vc || null;
      const ta = inputRef.current; if (ta) ta.focus();
    });
  }, [registerAsk]);

  // el CUBO del header (App) = VOLVER AL HALO CENTRAL (owner 2026-07-14): resetea el diálogo al inicio —
  // conversación nueva, contexto fresco, el hero de vuelta. El logo es el "home" del producto.
  useEffect(() => {
    if (typeof registerReset === "function") registerReset(() => {
      const fresh = initialContext || (modulo ? { activeModule: modulo } : {});
      ctxRef.current = fresh;
      resetPnlDraft();   // conversación nueva → el P&L a medio armar se descarta (lo sellado queda: es memoria C.2)
      setMessages([]); setInput(""); setPendingId(null); setSuggestionsVisible(false); setContext(fresh);
    });
  }, [registerReset]);

  // aplica el estado de un turno YA resuelto (idéntico para piso y LLM)
  const _applyTurn = (turn, adiId) => {
    ctxRef.current = turn.context;   // sincrónico · el próximo turno LLM lo lee del ref (no de la closure, que puede estar stale)
    setContext(turn.context);
    if (animate) { setPendingId(adiId); setSuggestionsVisible(false); }
    else { setPendingId(null); setSuggestionsVisible(true); }
  };

  const submit = (raw) => {
    const q = (raw || "").trim();
    if (!q) return;
    _marcarInicioDeTurno();   // el reloj arranca ACÁ: la latencia que importa es la que espera el usuario
    // GUARDIA DE REENTRADA: un turno ya en vuelo (fetch async al gateway) bloquea a un segundo submit/submitSpec —
    // ver la nota junto a isSubmittingRef. El camino demo/piso (sync, más abajo) nunca prende esta guardia porque
    // corre y termina en el mismo tick: no hay ventana para reentrar.
    if (isSubmittingRef.current) return;
    setInput("");
    // el contexto de pantalla del turno: el de la pieza que el usuario tocó, si tocó alguna. Se consume UNA vez —
    // dejarlo pegado teñiría el turno siguiente, que es justo lo que la invalidación del contrato impide.
    const vcTurno = pendingVcRef.current;
    pendingVcRef.current = null;

    // ── CAMINO LLM (flag ON · async): user msg + "Pensando…" ahora; resolvemos async y reemplazamos el placeholder ──
    if (ADI_LLM_ENABLED) {
      isSubmittingRef.current = true;
      const userMsg = { role: "user", text: q, id: ++idRef.current };
      const adiId = ++idRef.current;
      setMessages(prev => [...prev, userMsg, { role: "adi", text: "Pensando…", route: "llm_pending", pending: true, id: adiId }]);
      setSuggestionsVisible(false);
      setThinkPhase(0);   // arranca en "Entendiendo la pregunta" (LLM #1 en vuelo) · el pipeline reporta los saltos reales
      // recentTurns SIEMPRE del ref (messagesRef.current), NUNCA de `messages` — ver la nota junto a su declaración.
      buildAdiTurnLLM(q, ctxRef.current || context, scenario, messagesRef.current, setThinkPhase, vcTurno).then((turn) => {   // ctxRef = contexto FRESCO (lastEvidence del turno previo · no la closure stale)
        setMessages(prev => prev.map(m => (m.id === adiId ? { ...turn.adiMsg, id: adiId } : m)));
        _applyTurn(turn, adiId);
      }).finally(() => { isSubmittingRef.current = false; });   // libera la guardia siempre (éxito o excepción no atrapada) — nunca deja el chat bloqueado
      return;
    }

    // ── CAMINO DEMO/PISO (flag OFF · sync · intacto byte-exacto) ──
    const turn = buildAdiTurn(q, context, scenario);
    const userMsg = { ...turn.userMsg, id: ++idRef.current };
    const adiMsg  = { ...turn.adiMsg,  id: ++idRef.current };
    setMessages(prev => [...prev, userMsg, adiMsg]);
    _applyTurn(turn, adiMsg.id);
  };

  // INICIO · un chip de plata ejecuta un SPEC CANÓNICO (curado · sin LLM #1 · sin riesgo de mis-parse). En modo LLM el
  // resultado SÍ se NARRA (LLM #2 · mismo pipeline que el input libre) → misma calidad por CUALQUIER puerta (owner
  // 2026-07-06). Fallback determinístico si el narrate falla · preserva boleta/guards/SentrixAction (los da answerADIFromSpec).
  const submitSpec = (spec, label) => {
    const q = (label || "").trim();
    if (!q) return;
    // MISMA guardia de reentrada que submit() — comparten isSubmittingRef/ctxRef/messagesRef: un chip de inicio no
    // debe pisar un turno de texto libre ya en vuelo, ni viceversa.
    if (isSubmittingRef.current) return;
    // ORÁCULO ON (localhost/dev · C) → el chip se comporta como TIPEAR la pregunta: pasa por C (PLAN→BATCH→NARRAR),
    // igual que el input libre → las preguntas de inicio quedan "bien conectadas al LLM" (owner 2026-07-28), con la
    // MISMA calidad/estructura/tablas y la tool correcta que elija el plan. Con el oráculo OFF (prod real) sigue el
    // spec determinístico enlatado + el flujo guiado del P&L intacto (cero regresión donde C no está).
    if (_oracleOn()) { submit(q); return; }
    // answerConversational: byte-igual para specs de operación (new_query → seam) Y habilita chips enlatados
    // con turn_type (los P&L del inicio · owner 2026-07-25)
    const r0 = answerConversational(spec, context, { scenario });
    if (ADI_LLM_ENABLED) {
      isSubmittingRef.current = true;
      const userMsg = { role: "user", text: q, id: ++idRef.current };
      const adiId = ++idRef.current;
      setMessages(prev => [...prev, userMsg, { role: "adi", text: "Pensando…", route: "llm_pending", pending: true, id: adiId }]);
      setSuggestionsVisible(false);
      setThinkPhase(1);   // el spec del chip ya se ejecutó local (la cuenta está armada) · _narrateResult reporta 2/3
      _narrateResult(r0, setThinkPhase).then(({ r, narrated }) => {
        const turn = _turnFromResult(q, r, context, narrated ? "llm" : "deterministico");
        setMessages(prev => prev.map(m => (m.id === adiId ? { ...turn.adiMsg, id: adiId } : m)));
        _applyTurn(turn, adiId);
      }).finally(() => { isSubmittingRef.current = false; });
      return;
    }
    // demo (flag OFF · sync · intacto)
    const turn = _turnFromResult(q, r0, context, "demo");
    const userMsg = { ...turn.userMsg, id: ++idRef.current };
    const adiMsg  = { ...turn.adiMsg,  id: ++idRef.current };
    setMessages(prev => [...prev, userMsg, adiMsg]);
    _applyTurn(turn, adiMsg.id);
  };

  // GUÍA DE INICIO (owner 2026-08-07) · un ejemplo de la guía se ejecuta por el MISMO camino que su chip del hero:
  // submitSpec, con su guardia de reentrada, su ruteo por oráculo y su fallback. La guía no conoce el pipeline.
  // A DIFERENCIA de registerAsk (que solo prellena el input y no cierra sobre nada), esto SÍ necesita el ref: el
  // handler se registra una sola vez ([registerRun]) pero submitSpec se re-crea en cada render cerrando sobre el
  // `context` de ESE render — sin el ref, reabrir la guía a mitad de una conversación ejecutaría el ejemplo con el
  // contexto del primer render (vacío), perdiendo el hilo. El ref se sincroniza en cada render.
  /* ── LA GUÍA ENTRA POR LA PUERTA DE SIEMPRE (owner 2026-08-15) ───────────────────────────────────────────────
   * «Cuando el usuario toque una pregunta, debe enviarse el prompt exacto al mismo chat normal, con el mismo
   * camino natural, notario, reparación, contrato [[CALCULO]] y rastro interno. Quiero que responda exactamente
   * igual que si yo escribiera la pregunta manualmente.»
   * Por eso esto llama a `submit`, NO a `submitSpec`: submitSpec ejecuta un spec enlatado por una puerta propia
   * —útil cuando el determinístico era el piso, engañoso ahora que el producto ES el camino natural—. Acá no hay
   * spec, no hay atajo y no hay rama demo: es exactamente lo que pasa al escribir la pregunta y apretar Enter.
   * ⚠️ A DIFERENCIA de `registerAsk` (que solo PRELLENA el input y espera confirmación, para no gastar por un
   * misclick), esta puerta SÍ dispara. Es una decisión explícita del owner para estos cuatro ejemplos: valen el
   * gasto porque su función es mostrar el producto real. */
  const submitRef = useRef(null);
  useEffect(() => { submitRef.current = submit; });
  const submitSpecRef = useRef(null);
  useEffect(() => { submitSpecRef.current = submitSpec; });
  useEffect(() => {
    /* `registerRun` recibe ahora un TEXTO, no un spec: la guía manda el prompt exacto y esto lo entrega a
     * `submit`, la puerta del input. Si algún llamador viejo pasara un objeto, se ignora — no hay ruta demo
     * silenciosa: preferimos no responder antes que responder por un camino que el usuario no va a usar. */
    if (typeof registerRun === "function") registerRun((q) => {
      if (typeof q === "string" && q.trim() && submitRef.current) submitRef.current(q);
    });
  }, [registerRun]);

  const lastAdiId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "adi") return messages[i].id;
    return null;
  })();

  /* EL CAMPO DE PREGUNTA · UNO SOLO, montado en dos lugares según haya conversación o no (owner 2026-08-20).
   * Sin conversación vive en el CENTRO de la pantalla de inicio; con el primer mensaje baja y se ancla abajo.
   * Se declara acá, en el componente, porque necesita `input`/`submit`/`inputRef` — sacarlo afuera obligaría a
   * pasarle cuatro props y no ganaría nada. `centrado` solo alinea la línea de la promesa: en el inicio va
   * centrada bajo el campo (como el resto de la pantalla) y en el chat va a la izquierda, como estaba. */
  const campoPregunta = (centrado) => (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
        <textarea
          ref={inputRef}
          rows={1}
          value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); submit(input); } }}
          placeholder="Pregunta a ADI…"
          style={{ flex:1, resize:"none", overflowY:"auto", maxHeight:160, minHeight:26, background:C.surfaceAlt, border:`1px solid ${C.borderLight}`, borderRadius:14, padding:"12px 16px", fontFamily:"'DM Sans', system-ui, sans-serif", fontSize:centrado?16.5:15, fontWeight:centrado?500:400, lineHeight:1.5, color:C.text, outline:"none", caretColor:C.celeste, minWidth:0, transition:"border-color 0.18s, box-shadow 0.18s, background 0.18s", boxShadow:C.sombraCampo }}
          onFocus={e=>{ e.target.style.borderColor=C.celeste; e.target.style.background=C.surfaceHover; e.target.style.boxShadow=C.sombraCampoFoco; }}
          onBlur={e=>{ e.target.style.borderColor=C.borderLight; e.target.style.background=C.surfaceAlt; e.target.style.boxShadow=C.sombraCampo; }}
        />
        <button onClick={()=>submit(input)} disabled={!input.trim()} aria-label="Enviar la pregunta"
          style={{ width:44, height:44, borderRadius:14, border:"none", background:input.trim()?"linear-gradient(180deg,#3fc4e2,#1c8fae)":C.surfaceHover, color:input.trim()?"#fff":C.textSub, cursor:input.trim()?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.18s", boxShadow:input.trim()?"0 4px 14px -3px rgba(47,184,218,0.55)":"0 1px 4px rgba(0,0,0,0.35)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"/>
            <polyline points="5 12 12 5 19 12"/>
          </svg>
        </button>
      </div>
      <div style={{ fontSize:centrado?13:10, color:C.textMuted, display:"flex", alignItems:"center", justifyContent:centrado?"center":"flex-start", gap:6, letterSpacing:"0.3px" }}>
        <kbd style={{ fontSize:centrado?11:9, padding:"1px 5px", borderRadius:3, background:C.hoverSuave, border:`1px solid ${C.border}`, color:C.textSub, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontWeight:500 }}>↵</kbd>
          <span>para enviar · ADI no inventa · cada cifra cierra con su cuenta</span>
      </div>
    </div>
  );

  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", height:"100%", minHeight:0 }}>
      {/* EL CAMPO, DETRÁS DE TODO Y SIEMPRE · hermano del transcript, no hijo: así cubre el panel entero y no
          se va hacia arriba cuando el hilo scrollea. Todo lo que viene abajo lleva zIndex:1 para quedar encima. */}
      <CampoHexagonos conversando={messages.length > 0}/>
      {/* ── TRANSCRIPT ── */}
      <div ref={scrollRef} style={{ position:"relative", zIndex:1, flex:1, overflowY:"auto", minHeight:0 }}>
        {/* SIN MENSAJES la portada manda: se le da más ancho (900) y se le saca el colchón de arriba, que en el
            chat separa la primera burbuja del header pero acá solo empuja el hexágono fuera de la pantalla. */}
        {/* el colchón de la DERECHA deja libre la franja donde flotan las barritas de la barra lateral. Va acá
            adentro y no en el contenedor de arriba a propósito: si se lo pusiera al padre, el campo de hexágonos
            —que es hermano de este scroll— se cortaría antes del borde y volveríamos al defecto que el owner cazó. */}
        {/* ⚠️ SIN CONVERSACIÓN, LA PORTADA SE CENTRA A LO ALTO. Al sacarle el pulso, el hero quedó pegado al
            techo con el 42% de la pantalla vacío abajo — medido: terminaba a los 518 px de 900. Volvía por la
            ventana el problema del primer día, la pantalla vacía. `minHeight:100%` + `justifyContent:center`
            lo apoyan en el medio, que es donde tiene que estar una sola pregunta esperando respuesta.
            Con mensajes NO se toca: ahí el hilo crece desde arriba, como cualquier conversación. */}
        <div style={{ maxWidth:messages.length === 0 ? 900 : 760, margin:"0 auto", padding:messages.length === 0 ? `0 24px 16px ${24 + margenBarra}px` : `32px 24px 24px ${24 + margenBarra}px`, display:"flex", flexDirection:"column", gap:24,
          ...(messages.length === 0 ? { minHeight:"100%", justifyContent:"center" } : null) }}>
          {messages.length === 0 && (
            <HeroInicio scenario={scenario} campo={campoPregunta(true)} onPregunta={(q) => submit(q)} />
          )}

          {messages.map((msg) => {
            if (msg.role === "user") {
              return (
                <div key={msg.id} style={{ display:"flex", justifyContent:"flex-end" }}>
                  <div style={{
                    maxWidth:"75%", background:C.cardUser, border:`1px solid ${C.cardBorder}`,
                    padding:"10px 16px", borderRadius:10, fontFamily:"'DM Sans', system-ui, sans-serif",
                    fontSize:14, lineHeight:1.55, letterSpacing:"-0.01em", color:C.text, fontWeight:400,
                    boxShadow:"inset 0 1px 0 rgba(255,255,255,0.04)"
                  }}>
                    {msg.text}
                  </div>
                </div>
              );
            }
            const isTyping = animate && msg.id === pendingId;
            const isPending = !!msg.pending;
            const isLastAdi = msg.id === lastAdiId;
            return (
              <div key={msg.id} style={{ display:"flex", flexDirection:"column", gap:6, width:"100%" }}>
                <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
                  <AdiAvatar spark={isTyping || isPending}/>
                  {/* ⚠️ SOBRE PAPEL, ADI NO TIENE BURBUJA (frente UX · owner 2026-08-26): «las burbujas tuyas son
                      papel gris; las de ADI no tienen burbuja — solo el hexágono al costado y el texto sobre la
                      hoja. Eso hace que la respuesta se sienta escrita, no encajonada». En el tablero la burbuja
                      se conserva TAL CUAL estaba: mismo fondo, mismo borde celeste, misma sombra interior. */}
                  <div data-testid="adi-bubble" style={{
                    flex:1, minWidth:0,
                    ...(esSuperficieADI()
                      ? { background:"transparent", padding:"2px 0 0", border:"none", borderRadius:0, boxShadow:"none" }
                      : { background:C.card, padding:"16px 20px", borderRadius:10,
                          // el borde con TOQUE (owner 2026-07-10, referencia de la landing): celeste sutil en las
                          // burbujas de ADI — la misma familia de las cards de gráficos; la del usuario queda neutra.
                          border:"1px solid rgba(47,184,218,0.22)",
                          boxShadow:"inset 0 1px 0 rgba(255,255,255,0.04)" }),
                    fontFamily:"'DM Sans', system-ui, sans-serif", fontSize:14, lineHeight:1.65,
                    letterSpacing:"-0.01em", color:C.text, fontWeight:400, whiteSpace:"pre-line"
                  }}>
                    {isPending ? (
                      <ThinkingIndicator phase={thinkPhase}/>
                    ) : isTyping ? (
                      <TypewriterText
                        text={msg.text} speed={8} showCursor={true}
                        onComplete={() => { setPendingId(null); setSuggestionsVisible(true); }}
                      />
                    ) : (
                      <AdiMessageBody text={msg.text}/>
                    )}
                    {/* GRÁFICO EN LA RESPUESTA (I1 · owner 2026-07-09): la plantilla la elige el DATO (chartSpec
                        determinístico sobre la evidencia) — pregunta → respuesta → gráfico → ampliar en Sentrix. */}
                    {!isPending && !isTyping && (() => {
                      const _cs = chartForEvidence(msg.evidence);
                      return _cs ? <InlineChart spec={_cs} onAmpliar={msg.evidence && onOpenEvidence ? () => onOpenEvidence(msg.evidence, msg.id) : null}/> : null;
                    })()}
                  </div>
                </div>
                {!isPending && !isTyping && <SourceBadge source={msg._source}/>}
                <SentrixButton sentrixAction={msg.sentrixAction} onSentrixAction={onSentrixAction} msgId={msg.id}/>
                <EvidenceButton evidence={msg.evidence} active={openEvidenceId === msg.id}
                  onOpenEvidence={onOpenEvidence ? (ev) => onOpenEvidence(ev, msg.id) : null}/>
                {/* Suggestions del turno vigente · aparecen al terminar el typewriter */}
                {isLastAdi && !isTyping && suggestionsVisible && msg.suggestions && msg.suggestions.length > 0 && (
                  <div style={{ display:"flex", flexDirection:"column", gap:8, marginLeft:44 }}>
                    {msg.suggestions.map((sug, i) => {
                      const sugText = typeof sug === "string" ? sug : (sug?.text || "");
                      return (
                        /* borde CELESTE también acá (owner 2026-07-14: "las preguntas o cada card que tengamos
                           deben tener los bordes celestes") */
                        <button key={i} onClick={() => submit(sugText)}
                          style={{
                            padding:"10px 14px", textAlign:"left", background:"transparent",
                            border:"1px solid rgba(47,184,218,0.35)", borderRadius:8,
                            fontFamily:"'DM Sans', system-ui, sans-serif", color:C.text,
                            fontSize:13, fontWeight:500, letterSpacing:"-0.005em",
                            cursor:"pointer", transition:"all 0.15s ease"
                          }}
                          onMouseEnter={e=>{ e.currentTarget.style.background = C.surface; e.currentTarget.style.borderColor = "rgba(47,184,218,0.6)"; }}
                          onMouseLeave={e=>{ e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(47,184,218,0.35)"; }}>
                          {sugText}
                        </button>
                      );
                    })}
                  </div>
                )}
                {/* HINT DE PRIMER USO (owner 2026-07-08 · el primer minuto): una sola vez, tras la primera respuesta —
                    lo mejor del producto no se descubre solo. Descartable · persiste el visto en localStorage. */}
                {isLastAdi && !isTyping && showHint && messages.filter((m) => m.role === "adi" && !m.pending).length === 1 && (
                  <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginLeft:44, marginTop:2, padding:"9px 12px", borderRadius:10, borderTop:`1px solid ${C.cardBorder}`, borderBottom:`1px solid ${C.cardBorder}`, borderRight:`1px solid ${C.cardBorder}`, borderLeft:"2px solid rgba(47,184,218,0.5)", background:C.card, maxWidth:560 }}>
                    <span style={{ fontSize:11.5, color:C.textSub, lineHeight:1.55, flex:1 }}>
                      <span style={{ color:C.celeste, fontWeight:600 }}>Tip · </span>
                      abre la <b>Mesa de control</b> (arriba) para ver todas tus cifras · toca cualquier <b>fila de Sentrix</b> y ADI la desglosa · sigue el hilo con <b>"y de esos…"</b> · fija tu benchmark: <b>"recuerda que mi margen mínimo es 28%"</b>.
                    </span>
                    <button onClick={() => { setShowHint(false); try { localStorage.setItem("adi_hint_v1", "1"); } catch {} }}
                      style={{ background:"transparent", border:"none", color:C.textMuted, cursor:"pointer", fontSize:12, padding:0, flexShrink:0 }}>✕</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── INPUT (sticky abajo) · centrado al mismo ancho que el transcript (maxWidth:760) — owner 2026-08-04:
          antes ocupaba todo el ancho del panel, se veía desalineado contra las burbujas/cards de arriba ──
          ⚠️ SOLO SE MONTA CON CONVERSACIÓN EMPEZADA. Mientras no hay mensajes el campo vive ARRIBA, en el
          centro de la pantalla de inicio (owner 2026-08-20): es el MISMO `campoPregunta`, movido de lugar,
          no un segundo input. Dos inputs serían dos estados y el texto a medio escribir se perdería. */}
      {/* ALINEADO AL TEXTO DE ADI (owner 2026-08-20: «la barra de envío debe estar alineada al texto de ADI»).
          El campo arrancaba 63 px a la izquierda del texto de las respuestas, y ese número son DOS cosas
          sumadas: los 44 px de la columna del avatar —que indenta todo lo que ADI dice— y los ~4 px que corre
          el centrado del transcript por su barra de scroll. Por eso el colchón izquierdo suma el avatar y el
          derecho reserva el ancho de esa barra: sin las dos, el campo queda desalineado por un lado u otro. */}
      {messages.length > 0 && (
      <div style={{ position:"relative", zIndex:1, padding:`16px ${_SCROLLBAR}px 16px 0`, borderTop:`1px solid ${C.border}`, flexShrink:0, background:C.bg }}>
        {/* MISMA CAJA QUE EL TRANSCRIPT, no una parecida: `maxWidth:760` + `margin:0 auto` + los MISMOS colchones.
            Antes el campo se centraba dentro de un div ya acolchado y el transcript dentro del ancho completo:
            dos centrados distintos que nunca iban a coincidir. Sumado el colchón del avatar, queda a plomo. */}
        <div style={{ width:"100%", maxWidth:760, margin:"0 auto",
          paddingLeft: 24 + margenBarra + _GUTTER_ADI, paddingRight: 24 }}>{campoPregunta(false)}</div>
      </div>
      )}
    </div>
  );
}

export default ChatADI;
