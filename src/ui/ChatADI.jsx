/* === src/ui/ChatADI.jsx · PanelADI ADELGAZADO ===
 * Cáscara React del chat (input · transcript · typewriter · suggestions).
 * REGLA MADRE: la UI CONSUME answerADI, no recalcula. La decisión vive en answerADI (sellado).
 * El patrón del piso "setX(...) + return dentro del handler" se reduce a:
 *   const turn = buildAdiTurn(q, context, scenario)  →  aplicar setMessages/setContext con turn.
 * Lo diferido del PanelADI monolítico (memoria org · prefs · proactive · persistencia de chats ·
 * hero magic-moment) NO entra acá: el HANDOFF §2 define el adelgazado como solo la cáscara. */
import React, { useState, useRef, useEffect } from "react";
import { answerADI } from "../adi/answerADI.js";
import { answerADIFromSpec } from "../adi/answerADIFromSpec.js";   // Paso 5 · camino LLM (spec → ejecución local)
import { answerConversational, buildConversationContext } from "../adi/conversation.js";   // parse conversacional V1 · ruteo por turn_type + contexto
import { pickNarratedText } from "../adi/llm/numberGuard.js";      // Paso 5 · number-guard de la narración LLM #2
import { stripRoboticVoice } from "../adi/llm/voiceGuard.js";      // guard de voz determinístico (mata aperturas de plantilla + muletillas)
import { coerceSpec } from "../adi/coerceChain.js";   // cadena de coerce "la pregunta manda el foco" (compare→contribución→margen→ventas→inventario→explain · pura · gate-testable)
import { getUISignals } from "../adi/uiSignals.js";   // memoria UI (owner 2026-07-08) · la Mesa/paneles informan el contexto conversacional
import { buildResumenEjecutivo, composeFollowupRecommendation } from "../adi/specRetrieval.js";   // INICIO · resumen ejecutivo + follow-up (fallback regex)
import { ADI_LLM_ENABLED, ADI_LLM_NARRATE_ENABLED } from "../config/voiceFlags.js";   // Paso 5 · switch demo/LLM + sub-flag narración
import { C } from "./theme.js";
import { renderMarkdownLite, isTabularText } from "./markdown.jsx";
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

// ── Helper PURO · arma el turno que la UI agrega DESDE el resultado de ADI (answerADI o answerADIFromSpec).
// La UI CONSUME el resultado, no recalcula (regla madre). Mismo shape para ambos caminos.
function _turnFromResult(q, r, context, source) {
  const deferred = r.text == null;
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
    context: { ...(r.context || context || {}), lastEvidence: (r.evidence && !r.evidence.followup) ? r.evidence : ((context && context.lastEvidence) || null) },
  };
}

// CAMINO DEMO/PISO (ADI_LLM_ENABLED OFF · SYNC · byte-exacto): la UI llama answerADI(text) como siempre.
export function buildAdiTurn(question, context, scenario) {
  const q = (question || "").trim();
  return _turnFromResult(q, answerADI(q, context || {}, { scenario }), context, "demo");
}

// CAMINO LLM (ADI_LLM_ENABLED ON · ASYNC): texto → gateway (server-side, tiene la key) → spec → answerADIFromSpec LOCAL.
// Regla: el LLM SOLO traduce a spec · ADI valida y ejecuta/degrada honesto. Si el gateway falla → CAE AL PISO (answerADI).
async function _fetchSpec(text, scenario, context) {
  const res = await fetch("/api/adi-spec", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, scenario, context: context || null }),   // conversationContext → el LLM #1 clasifica turn_type
  });
  const data = await res.json();
  if (!data || !data.ok) throw new Error((data && data.error) || "gateway sin spec");
  return data.spec;
}
// LLM #2 · pide la narración del output validado (server-side). El number-guard decide después, en el cliente.
async function _fetchNarration(validated) {
  const res = await fetch("/api/adi-narrate", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: _sanitizeScenario(validated.text), evidence: validated.evidence || null }),
  });
  const data = await res.json();
  if (!data || !data.ok || !data.narration) throw new Error((data && data.error) || "gateway sin narración");
  return data.narration;
}
// FOLLOW-UP EJECUTIVO · "qué hacemos / qué recomendás / qué sigue / y ahora / cuál es la acción" → recomendación sobre la
// última evidencia (NO se re-parsea como consulta nueva de eje/métrica). Solo dispara si hay una evidencia accionable previa.
const _FOLLOWUP_RE = /\b(qu[eé]\s+hacemos|qu[eé]\s+hago|qu[eé]\s+hacer|qu[eé]\s+recomiend[ao]s|qu[eé]\s+recomend[aá]s|qu[eé]\s+sigue|y\s+ahora|cu[aá]l\s+es\s+la\s+acci[oó]n)\b/i;

// LLM #2 · narra un resultado YA ejecutado (sub-flag NARRATE ON) · pasa por el number-guard (pickNarratedText): guard OK →
// narración · gateway/guard falla → texto determinístico. COMPARTIDO por el input libre (buildAdiTurnLLM) y los chips del
// inicio (submitSpec) → misma calidad narrada por CUALQUIER puerta. buildNarrateSystem elige el prompt según evidence.
async function _narrateResult(r) {
  if (!(ADI_LLM_NARRATE_ENABLED && r && r.text)) return { r, narrated: false };
  // REPREGUNTA CRISP: las clarificaciones NO se narran con el LLM (las volvía vagas · "si tenés algunos clientes en
  // mente…"). El texto determinístico ya es directo y ofrece opciones concretas → se muestra crudo. (owner 2026-07-06)
  if (r.route === "clarification_needed") return { r, narrated: false };
  try {
    const narration = await _fetchNarration(r);
    const picked = pickNarratedText(r, narration);
    // GUARD DE VOZ (determinístico) · corre DESPUÉS del number-guard (no toca cifras) · aplica al texto final elegido
    // (narrado LLM o determinístico de fallback) → mata "He revisado tus datos…"/"Las proyecciones indican…"/"Sin embargo…".
    return { r: { ...r, text: stripRoboticVoice(picked.text) }, narrated: picked.narrated };
  } catch { return { r, narrated: false }; }
}

export async function buildAdiTurnLLM(question, context, scenario, recentTurns) {
  const q = (question || "").trim();
  let r, narrated = false;
  // ── PRECEDENCIA (V1 · owner): CONVERSACIONAL → REGEX (fallback) → UN-TURNO. El regex NO se elimina hasta probar el conversacional.
  const ui = getUISignals();   // memoria UI (owner 2026-07-08) · lo que el usuario está haciendo en la Mesa/paneles
  const convCtx = buildConversationContext(recentTurns, context && context.lastEvidence, ui);   // contexto chico para el LLM #1
  try {
    const spec = await _fetchSpec(q, scenario, convCtx);        // LLM #1 VE el contexto (incl. señales de UI) → clasifica turn_type
    const _hasLast = !!(context && context.lastEvidence);
    r = answerConversational(coerceSpec(q, spec, _hasLast, ui), context || {}, { scenario }); // cadena de coerce (UI→criteria→sí→compare→dominios) · no depende del LLM · el seam valida/degrada honesto
  } catch (e) {
    // LLM #1 caído → regex sobre la última evidencia; si no matchea → un-turno determinístico.
    const _last = context && context.lastEvidence;
    const _fu = (_last && _FOLLOWUP_RE.test(q)) ? composeFollowupRecommendation(_last) : null;
    r = _fu || answerADI(q, context || {}, { scenario });
  }
  // NARRACIÓN LLM #2 (helper compartido) · aplica al follow-up Y al spec · guard → si falla, texto determinístico.
  const _nr = await _narrateResult(r);
  r = _nr.r; narrated = _nr.narrated;
  return _turnFromResult(q, r, context, narrated ? "llm" : "deterministico");
}

// ── Logo ADI inline (verbatim del piso) ──
function AdiAvatar({ spark = false }) {
  return (
    <div style={{
      width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center",
      flexShrink:0, marginTop:4, transformOrigin:"center center",
      animation: spark ? "adiSpark 1.4s ease-in-out infinite" : "none",
      filter:"drop-shadow(0 0 5px rgba(47,184,218,0.3))"
    }}>
      <svg width="18" height="18" viewBox="0 0 200 200" fill="none" stroke="#cfd5db" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="100,15 173.6,57.5 173.6,142.5 100,185 26.4,142.5 26.4,57.5" strokeWidth="3.2"/>
        <circle cx="100" cy="100" r="55" strokeWidth="1.8" opacity="0.65"/>
        <ellipse cx="100" cy="100" rx="55" ry="22" strokeWidth="1.6" opacity="0.5"/>
        <ellipse cx="100" cy="100" rx="22" ry="55" strokeWidth="1.6" opacity="0.5"/>
        <circle cx="100" cy="100" r="6" fill="#2fb8da" stroke="none"/>
      </svg>
    </div>
  );
}

// ── Cuerpo de un mensaje ADI · PURO · bloques con casos especiales Confianza/Recomendación.
// Verbatim del render del chat del piso (L40229-40282). Mismo split/markdown → mismo texto visible.
export function AdiMessageBody({ text }) {
  return text.split(/\n\n+/).filter(Boolean).map((block, blockIdx) => {
    const trimmed = block.trim();
    // Cita Confianza · metadata con divider + check verde
    const isConfianza = /^\*[^*]+\*$/.test(trimmed) && /confianza/i.test(trimmed);
    if (isConfianza) {
      const inner = trimmed.replace(/^\*/, "").replace(/\*$/, "");
      return (
        <div key={`block-${blockIdx}`} style={{
          display:"flex", alignItems:"flex-start", gap:9,
          paddingTop:14, marginTop:6,
          borderTop:"1px solid rgba(255,255,255,0.06)",
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
          paddingTop:14, borderTop:"1px solid rgba(255,255,255,0.1)"
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
function SentrixButton({ sentrixAction, onSentrixAction }) {
  if (!sentrixAction || !onSentrixAction || !sentrixAction.label) return null;
  return (
    <div style={{ marginLeft:44, marginTop:2, display:"flex", alignItems:"center", gap:8 }}>
      <button
        onClick={() => onSentrixAction(sentrixAction.payload)}
        style={{
          display:"flex", alignItems:"center", gap:6, padding:"7px 14px",
          background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.14)",
          borderRadius:6, color:C.textSub, fontFamily:"'DM Sans', system-ui, sans-serif",
          fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s"
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}>
        <span>↗</span>
        <span>{sentrixAction.label}</span>
      </button>
      {sentrixAction.moduleChip && (
        <span style={{
          padding:"4px 9px", background:"rgba(255,255,255,0.06)", border:`1px solid ${C.border}`,
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
  if (!evidence.reading && !isCuadro && !isDiagnose && !isCompare && !isInventory && !isMargin && !isVentas && !isContrib) return null;
  return isSim ? "Ver la proyección en Sentrix" : isCompare ? "Ver la comparación en Sentrix" : isInventory ? "Ver el inventario en Sentrix" : isMargin ? "Ver el margen en Sentrix" : isVentas ? "Ver las ventas en Sentrix" : isContrib ? "Ver la contribución en Sentrix" : isDiagnose ? "Ver el diagnóstico en Sentrix" : isCuadro ? "Ver en el Cuadro de mando" : "Ver evidencia en Sentrix";
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
            background: active ? "rgba(47,184,218,0.16)" : "rgba(255,255,255,0.04)",
            border:`1px solid ${active ? "rgba(47,184,218,0.6)" : "rgba(255,255,255,0.14)"}`,
            borderRadius:6, color: active ? C.celeste : C.textSub, fontFamily:"'DM Sans', system-ui, sans-serif",
            fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s"
          }}
          onMouseEnter={e => { e.currentTarget.style.background = active ? "rgba(47,184,218,0.2)" : "rgba(255,255,255,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = active ? "rgba(47,184,218,0.16)" : "rgba(255,255,255,0.04)"; }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="14" y1="9" x2="14" y2="21"/>
          </svg>
          <span>{x.label}</span>
        </button>
      ))}
    </div>
  );
}

// UX · estado "pensando" CON VIDA (owner 2026-07-08 · percepción de velocidad): fases HONESTAS del pipeline real
// (LLM #1 entiende → motor calcula → narrador redacta → guard verifica). No inventa progreso: nombra lo que pasa.
const _THINK_PHASES = ["Entendiendo la pregunta", "Leyendo tu cartera", "Armando la cuenta", "Verificando cada cifra"];
function ThinkingIndicator() {
  const [ph, setPh] = useState(0);
  useEffect(() => { const t = setInterval(() => setPh((p) => Math.min(p + 1, _THINK_PHASES.length - 1)), 2200); return () => clearInterval(t); }, []);
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
  return (
    <div style={{ marginLeft:44, marginTop:1, display:"flex", alignItems:"center", gap:6, opacity:0.72 }}
      title={isAI ? "Redactado por el LLM sobre cifras validadas por ADI (number-guard OK · no inventa cifras)" : "Respuesta determinística de ADI (sin narración del LLM · o fallback)"}>
      <span style={{ width:5, height:5, borderRadius:"50%", background: isAI ? C.celeste : "rgba(255,255,255,0.3)", flexShrink:0 }}/>
      <span style={{ fontSize:9.5, fontFamily:"'JetBrains Mono', ui-monospace, monospace", letterSpacing:"0.6px", color:C.textMuted, textTransform:"uppercase" }}>
        {isAI ? "narrado · IA" : "determinístico"}
      </span>
    </div>
  );
}

// INICIO · las 4 preguntas de plata → specs ENLATADOS. Corren en demo Y con LLM: el análisis es 100% determinístico
// (los chips no necesitan al LLM para ejecutar) · sólo el texto libre pasa por el LLM para traducirse a spec.
// El flagship es el `diagnose` (barrido completo de focos) · los otros 3 son ángulos de plata puntuales.
const _SPEC = (o) => ({ schemaVersion: 1, scenario: "actual", filters: {}, ...o });
// foco del diagnose → la conversación que abre (pregunta real + spec con el FOCO correcto · las cifras las pone el composer)
const _FOCO_CHIP = {
  margen:  () => ({ q: "¿Quiénes están bajo el margen mínimo?",  spec: _SPEC({ operation: "margin", metric: "margen", dimension: "cliente", focus: "bajo_benchmark" }) }),
  carga:   () => ({ q: "¿Cuánto me come la carga comercial?",    spec: _SPEC({ operation: "margin", metric: "margen", dimension: "cliente", focus: "palancas" }) }),
  capital: () => ({ q: "¿Dónde está frenada mi plata?",          spec: _SPEC({ operation: "inventory", metric: "capital", dimension: "bodega", focus: "frenado" }) }),
};
const HERO_CHIPS = [
  { q: "¿Dónde estoy perdiendo dinero?",     spec: _SPEC({ operation: "diagnose", dimension: "cliente", metric: "contribucion" }) },
  { q: "¿Qué clientes ceden más margen?",    spec: _SPEC({ operation: "rank", dimension: "cliente", metric: "margen", sort: { by: "margen", dir: "asc" }, limit: 5 }) },
  { q: "¿Dónde tengo capital inmovilizado?", spec: _SPEC({ operation: "overview", dimension: "bodega", metric: "capital" }) },
  { q: "¿Quién sostiene mi contribución?",   spec: _SPEC({ operation: "rank", dimension: "cliente", metric: "contribucion", sort: { by: "contribucion", dir: "desc" }, limit: 5 }) },
];

// ── INICIO · hero con el RESUMEN EJECUTIVO (KPIs + lectura data-driven) + las preguntas de plata ──
function HeroInicio({ scenario, onChip }) {
  const resumen = React.useMemo(() => buildResumenEjecutivo(scenario), [scenario]);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, padding:"8px 0", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
      {/* encabezado */}
      <div style={{ display:"flex", alignItems:"center", gap:13 }}>
        <div style={{ width:46, height:46, borderRadius:13, display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid rgba(47,184,218,0.28)", background:"rgba(47,184,218,0.07)", flexShrink:0 }}>
          <svg width="27" height="27" viewBox="0 0 200 200" fill="none" stroke="#dfe3e8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="100,15 173.6,57.5 173.6,142.5 100,185 26.4,142.5 26.4,57.5" strokeWidth="3"/>
            <circle cx="100" cy="100" r="55" strokeWidth="1.7" opacity="0.6"/>
            <ellipse cx="100" cy="100" rx="55" ry="22" strokeWidth="1.5" opacity="0.5"/>
            <ellipse cx="100" cy="100" rx="22" ry="55" strokeWidth="1.5" opacity="0.5"/>
            <circle cx="100" cy="100" r="7" fill="#2fb8da" stroke="none"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize:19, fontWeight:600, color:C.text, letterSpacing:"-0.01em" }}>Tu negocio hoy</div>
          <div style={{ fontSize:12.5, color:C.textMuted }}>Resumen ejecutivo · datos actuales</div>
        </div>
      </div>
      {/* KPIs (wrap en pantallas angostas) */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:10 }}>
        {resumen.kpis.map((k, i) => (
          <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px" }}>
            <div style={{ fontSize:11.5, color:C.textMuted, marginBottom:5 }}>{k.label}</div>
            <div style={{ fontSize:19, fontWeight:600, color:C.text, fontFamily:"'JetBrains Mono', ui-monospace, monospace", letterSpacing:"0.2px" }}>{k.value}</div>
          </div>
        ))}
      </div>
      {/* Lectura (el diferencial · sale del diagnose) */}
      <div style={{ fontSize:13, color:C.textSub, lineHeight:1.6, padding:"12px 14px", border:`1px solid ${C.border}`, borderRadius:12, background:"rgba(47,184,218,0.03)" }}>
        <span style={{ color:C.celeste, fontWeight:600 }}>Lectura · </span>{resumen.lectura}
      </div>
      {/* APERTURA PROACTIVA (asesor · Frente A.3): los focos del diagnose como BOTONES de arranque — la plata visible en
          cada uno, un click y ADI abre esa conversación con el foco correcto (no un chip enlatado). */}
      {(resumen.focos || []).length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:10 }}>
          {resumen.focos.map((f, i) => {
            const chip = _FOCO_CHIP[f.detector];
            if (!chip) return null;
            const c = chip(f);
            return (
              <button key={i} onClick={() => onChip(c.spec, c.q)}
                style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:3, padding:"12px 14px", borderRadius:12, border:`1px solid ${C.border}`, borderLeft:"2px solid rgba(47,184,218,0.6)", borderRight:"2px solid rgba(47,184,218,0.6)", background:C.surface, color:C.text, fontFamily:"'DM Sans', system-ui, sans-serif", textAlign:"left", cursor:"pointer", transition:"background 0.15s, border-color 0.15s" }}
                onMouseEnter={e=>{ e.currentTarget.style.background = C.surfaceHover; e.currentTarget.style.borderLeftColor = C.celeste; e.currentTarget.style.borderRightColor = C.celeste; }}
                onMouseLeave={e=>{ e.currentTarget.style.background = C.surface; e.currentTarget.style.borderLeftColor = "rgba(47,184,218,0.6)"; e.currentTarget.style.borderRightColor = "rgba(47,184,218,0.6)"; }}>
                <span style={{ fontSize:17, fontWeight:600, color:C.amber, fontFamily:"'JetBrains Mono', ui-monospace, monospace", letterSpacing:"0.2px" }}>{f.usdFmt}</span>
                <span style={{ fontSize:12, color:C.textSub, lineHeight:1.35 }}>{f.label} <span style={{ color:C.celeste }}>→</span></span>
              </button>
            );
          })}
        </div>
      )}
      {/* preguntas de plata (chips enlatados) */}
      <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
        <div style={{ fontSize:12, color:C.textMuted, marginBottom:11 }}>Preguntame algo puntual</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:10 }}>
          {HERO_CHIPS.map((c, i) => (
            <button key={i} onClick={() => onChip(c.spec, c.q)}
              style={{ display:"flex", alignItems:"center", gap:9, padding:"11px 14px", borderRadius:11, border:`1px solid ${C.border}`, background:C.surface, color:C.textSub, fontFamily:"'DM Sans', system-ui, sans-serif", fontSize:13, fontWeight:500, textAlign:"left", cursor:"pointer", lineHeight:1.35, transition:"background 0.15s, border-color 0.15s" }}
              onMouseEnter={e=>{ e.currentTarget.style.background = C.surfaceHover; e.currentTarget.style.borderColor = "rgba(47,184,218,0.4)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.background = C.surface; e.currentTarget.style.borderColor = C.border; }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:C.celeste, flexShrink:0 }}/>
              {c.q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChatADI({ scenario = "bonanza", modulo = null, onSentrixAction = null, onOpenEvidence = null, animate = true, initialContext = null, openEvidenceId = null, registerAsk = null }) {
  const [messages, setMessages] = useState([]);     // [{ id, role, text, sentrixAction, suggestions }]
  const [input, setInput]       = useState("");
  const [showHint, setShowHint] = useState(() => { try { return typeof localStorage !== "undefined" && !localStorage.getItem("adi_hint_v1"); } catch { return false; } });   // hint de primer uso (una vez)
  const [context, setContext]   = useState(initialContext || (modulo ? { activeModule: modulo } : {}));
  const [pendingId, setPendingId] = useState(null); // id del mensaje ADI animándose (typewriter)
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const idRef = useRef(0);
  const ctxRef = useRef(context);   // SIEMPRE el contexto más reciente (evita la stale-closure de React en el camino LLM async · threading de lastEvidence)
  const scrollRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // el textarea AUTO-CRECE con el texto largo (hasta ~7 líneas · después scrollea adentro) · vuelve a 1 línea al enviar
  useEffect(() => {
    const ta = inputRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; }
  }, [input]);

  // B.2 · BIDIRECCIONAL (la mesa habla): Sentrix pre-carga una pregunta acá (click en una fila del panel) → prefill +
  // focus. El usuario confirma con Enter — sin auto-envío (cero gasto por misclick, la decisión sigue siendo del usuario).
  useEffect(() => {
    if (typeof registerAsk === "function") registerAsk((q) => { setInput(String(q || "")); const ta = inputRef.current; if (ta) ta.focus(); });
  }, [registerAsk]);

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
    setInput("");

    // ── CAMINO LLM (flag ON · async): user msg + "Pensando…" ahora; resolvemos async y reemplazamos el placeholder ──
    if (ADI_LLM_ENABLED) {
      const userMsg = { role: "user", text: q, id: ++idRef.current };
      const adiId = ++idRef.current;
      setMessages(prev => [...prev, userMsg, { role: "adi", text: "Pensando…", route: "llm_pending", pending: true, id: adiId }]);
      setSuggestionsVisible(false);
      buildAdiTurnLLM(q, ctxRef.current || context, scenario, messages).then((turn) => {   // ctxRef = contexto FRESCO (lastEvidence del turno previo · no la closure stale)
        setMessages(prev => prev.map(m => (m.id === adiId ? { ...turn.adiMsg, id: adiId } : m)));
        _applyTurn(turn, adiId);
      });
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
    const r0 = answerADIFromSpec(spec, context, { scenario });
    if (ADI_LLM_ENABLED) {
      const userMsg = { role: "user", text: q, id: ++idRef.current };
      const adiId = ++idRef.current;
      setMessages(prev => [...prev, userMsg, { role: "adi", text: "Pensando…", route: "llm_pending", pending: true, id: adiId }]);
      setSuggestionsVisible(false);
      _narrateResult(r0).then(({ r, narrated }) => {
        const turn = _turnFromResult(q, r, context, narrated ? "llm" : "deterministico");
        setMessages(prev => prev.map(m => (m.id === adiId ? { ...turn.adiMsg, id: adiId } : m)));
        _applyTurn(turn, adiId);
      });
      return;
    }
    // demo (flag OFF · sync · intacto)
    const turn = _turnFromResult(q, r0, context, "demo");
    const userMsg = { ...turn.userMsg, id: ++idRef.current };
    const adiMsg  = { ...turn.adiMsg,  id: ++idRef.current };
    setMessages(prev => [...prev, userMsg, adiMsg]);
    _applyTurn(turn, adiMsg.id);
  };

  const lastAdiId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "adi") return messages[i].id;
    return null;
  })();

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0 }}>
      {/* ── TRANSCRIPT ── */}
      <div ref={scrollRef} style={{ flex:1, overflowY:"auto", minHeight:0 }}>
        <div style={{ maxWidth:760, margin:"0 auto", padding:"32px 24px 24px 24px", display:"flex", flexDirection:"column", gap:24 }}>
          {messages.length === 0 && (
            <HeroInicio scenario={scenario} onChip={submitSpec} />
          )}

          {messages.map((msg) => {
            if (msg.role === "user") {
              return (
                <div key={msg.id} style={{ display:"flex", justifyContent:"flex-end" }}>
                  <div style={{
                    maxWidth:"75%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)",
                    padding:"10px 16px", borderRadius:10, fontFamily:"'DM Sans', system-ui, sans-serif",
                    fontSize:14, lineHeight:1.55, letterSpacing:"-0.01em", color:C.text, fontWeight:400,
                    boxShadow:"inset 0 1px 0 rgba(255,255,255,0.02)"
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
                  <div data-testid="adi-bubble" style={{
                    flex:1, minWidth:0, background:"rgba(255,255,255,0.032)", padding:"16px 20px",
                    borderRadius:10, border:"1px solid rgba(255,255,255,0.07)",
                    fontFamily:"'DM Sans', system-ui, sans-serif", fontSize:14, lineHeight:1.65,
                    letterSpacing:"-0.01em", color:C.text, fontWeight:400, whiteSpace:"pre-line",
                    boxShadow:"inset 0 1px 0 rgba(255,255,255,0.03)"
                  }}>
                    {isPending ? (
                      <ThinkingIndicator/>
                    ) : isTyping ? (
                      <TypewriterText
                        text={msg.text} speed={8} showCursor={true}
                        onComplete={() => { setPendingId(null); setSuggestionsVisible(true); }}
                      />
                    ) : (
                      <AdiMessageBody text={msg.text}/>
                    )}
                  </div>
                </div>
                {!isPending && !isTyping && <SourceBadge source={msg._source}/>}
                <SentrixButton sentrixAction={msg.sentrixAction} onSentrixAction={onSentrixAction}/>
                <EvidenceButton evidence={msg.evidence} active={openEvidenceId === msg.id}
                  onOpenEvidence={onOpenEvidence ? (ev) => onOpenEvidence(ev, msg.id) : null}/>
                {/* Suggestions del turno vigente · aparecen al terminar el typewriter */}
                {isLastAdi && !isTyping && suggestionsVisible && msg.suggestions && msg.suggestions.length > 0 && (
                  <div style={{ display:"flex", flexDirection:"column", gap:8, marginLeft:44 }}>
                    {msg.suggestions.map((sug, i) => {
                      const sugText = typeof sug === "string" ? sug : (sug?.text || "");
                      return (
                        <button key={i} onClick={() => submit(sugText)}
                          style={{
                            padding:"10px 14px", textAlign:"left", background:"transparent",
                            border:`1px solid ${C.border}`, borderRadius:8,
                            fontFamily:"'DM Sans', system-ui, sans-serif", color:C.text,
                            fontSize:13, fontWeight:500, letterSpacing:"-0.005em",
                            cursor:"pointer", transition:"all 0.15s ease"
                          }}
                          onMouseEnter={e=>{ e.currentTarget.style.background = C.surface; e.currentTarget.style.borderColor = C.borderLight; }}
                          onMouseLeave={e=>{ e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = C.border; }}>
                          {sugText}
                        </button>
                      );
                    })}
                  </div>
                )}
                {/* HINT DE PRIMER USO (owner 2026-07-08 · el primer minuto): una sola vez, tras la primera respuesta —
                    lo mejor del producto no se descubre solo. Descartable · persiste el visto en localStorage. */}
                {isLastAdi && !isTyping && showHint && messages.filter((m) => m.role === "adi" && !m.pending).length === 1 && (
                  <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginLeft:44, marginTop:2, padding:"9px 12px", borderRadius:10, border:`1px solid ${C.border}`, borderLeft:"2px solid rgba(47,184,218,0.5)", background:C.surface, maxWidth:560 }}>
                    <span style={{ fontSize:11.5, color:C.textSub, lineHeight:1.55, flex:1 }}>
                      <span style={{ color:C.celeste, fontWeight:600 }}>Tip · </span>
                      abrí la <b>Mesa de control</b> (arriba) para ver todas tus cifras · tocá cualquier <b>fila de Sentrix</b> y ADI la desglosa · seguí el hilo con <b>"y de esos…"</b> · fijá tu vara: <b>"recordá que mi margen mínimo es 28%"</b>.
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

      {/* ── INPUT (sticky abajo) · verbatim del piso ── */}
      <div style={{ padding:"16px 24px", borderTop:`1px solid ${C.border}`, flexShrink:0, background:C.bg, display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
          <textarea
            ref={inputRef}
            rows={1}
            value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); submit(input); } }}
            placeholder="Preguntá a ADI…"
            style={{ flex:1, resize:"none", overflowY:"auto", maxHeight:160, minHeight:26, background:C.surfaceAlt, border:`1px solid ${C.borderLight}`, borderRadius:14, padding:"12px 16px", fontFamily:"'DM Sans', system-ui, sans-serif", fontSize:15, lineHeight:1.5, color:C.text, outline:"none", caretColor:C.celeste, minWidth:0, transition:"border-color 0.18s, box-shadow 0.18s, background 0.18s", boxShadow:"0 2px 10px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03)" }}
            onFocus={e=>{ e.target.style.borderColor=C.celeste; e.target.style.background=C.surfaceHover; e.target.style.boxShadow="0 0 0 3px rgba(47,184,218,0.12), inset 0 1px 0 rgba(255,255,255,0.04)"; }}
            onBlur={e=>{ e.target.style.borderColor=C.borderLight; e.target.style.background=C.surfaceAlt; e.target.style.boxShadow="0 2px 10px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03)"; }}
          />
          <button onClick={()=>submit(input)} disabled={!input.trim()}
            style={{ width:44, height:44, borderRadius:14, border:"none", background:input.trim()?"linear-gradient(180deg,#3fc4e2,#1c8fae)":C.surfaceHover, color:input.trim()?"#fff":C.textSub, cursor:input.trim()?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.18s", boxShadow:input.trim()?"0 4px 14px -3px rgba(47,184,218,0.55)":"0 1px 4px rgba(0,0,0,0.35)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/>
              <polyline points="5 12 12 5 19 12"/>
            </svg>
          </button>
        </div>
        <div style={{ fontSize:10, color:C.textMuted, display:"flex", alignItems:"center", gap:6, letterSpacing:"0.3px" }}>
          <kbd style={{ fontSize:9, padding:"1px 5px", borderRadius:3, background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`, color:C.textSub, fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontWeight:500 }}>↵</kbd>
          <span>para enviar · ADI no inventa · cada cifra cierra con su cuenta</span>
        </div>
      </div>
    </div>
  );
}

export default ChatADI;
