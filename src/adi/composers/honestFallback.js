/* === src/adi/composers/honestFallback.js ===
 * composeGlobalHonestFallback · BRIEF M.B.4 · extraído de 41cc33d8 (L9165) · verbatim.
 * Composer determinístico de honestidad epistémica. Branches: saludo · OOD escalado ·
 * OOD legacy · estándar (3 alternativas contextuales). SIN narrative_signals (skip FASE 5
 * narrativa). El opener ya trae applyVoiceCalibration interno.
 * Helpers verbatim: _moduleLabel (L8438), _generateContextualAlternatives (L8450),
 * _maybeEmitSentrixAction (L8492), detectGreeting/GREETING_RESPONSE (L8557),
 * selectOODResponse/isObviouslyOutOfDomain (L8590). */
import { applyVoiceCalibration } from "../narrativeLayer.js";

// Flag local · en el piso es `const VOICE_GREETING_LAYER_ENABLED = true;` (L8554).
const VOICE_GREETING_LAYER_ENABLED = true;

// ── _moduleLabel (L8438) ─────────────────────────────────────────────────
function _moduleLabel(modulo) {
  if (modulo === "ventas")     return "Ventas";
  if (modulo === "margenes")   return "Márgenes";
  if (modulo === "inventario") return "Inventario";
  return "Módulo";
}

// ── _generateContextualAlternatives (L8450) · 3 alternativas determinísticas ──
function _generateContextualAlternatives(ctx, modulo, scenario) {
  const alternatives = [];
  const safeCtx = ctx || {};

  // Alternativa 1-2 · si hay context con lista plural · sugerir ad-hoc
  const hasClientList = Array.isArray(safeCtx.lastClientList) && safeCtx.lastClientList.length >= 2;
  const hasSkuList    = Array.isArray(safeCtx.lastSkuList)    && safeCtx.lastSkuList.length >= 2;

  if (hasClientList) {
    alternatives.push(`Cuánto suman entre todos los clientes del top`);
    alternatives.push(`Promedio del top de clientes`);
  } else if (hasSkuList) {
    alternatives.push(`Cuánto suman entre todos los SKUs del top`);
    alternatives.push(`Rotación promedio del top de SKUs`);
  }

  // Alternativa por módulo activo (capability conocida del razonador)
  if (modulo === "ventas") {
    alternatives.push(`Top clientes por contribución del escenario actual`);
  } else if (modulo === "margenes") {
    alternatives.push(`Clientes con erosión de margen`);
  } else if (modulo === "inventario") {
    alternatives.push(`SKUs que atrapan más capital`);
  }

  // Llenar hasta 3 con alternativas universales determinísticas
  const universal = [
    `Cómo está el negocio en ${_moduleLabel(modulo).toLowerCase()}`,
    `Top entidades del módulo activo`,
    `Panorama general del escenario ${scenario}`,
  ];
  let uIdx = 0;
  while (alternatives.length < 3 && uIdx < universal.length) {
    const next = universal[uIdx++];
    if (next && !alternatives.includes(next)) alternatives.push(next);
  }

  return alternatives.slice(0, 3);
}

// ── _maybeEmitSentrixAction (L8492) · chip Sentrix si el contexto lo permite ──
function _maybeEmitSentrixAction(ctx, modulo) {
  const safeCtx = ctx || {};
  if (Array.isArray(safeCtx.lastClientList) && safeCtx.lastClientList.length >= 2) {
    return {
      type: "filter_clients",
      label: `Ver ${safeCtx.lastClientList.length} clientes en ${_moduleLabel(modulo)}`,
      moduleChip: _moduleLabel(modulo),
      payload: { clientes: safeCtx.lastClientList },
    };
  }
  if (Array.isArray(safeCtx.lastSkuList) && safeCtx.lastSkuList.length >= 2) {
    return {
      type: "filter_skus",
      label: `Ver ${safeCtx.lastSkuList.length} SKUs en Inventario`,
      moduleChip: "Inventario",
      payload: { skus: safeCtx.lastSkuList },
    };
  }
  return null;
}

// ── GREETING_PATTERNS · 7 patterns es/en (L8557) ─────────────────────────
const GREETING_PATTERNS = [
  /^\s*(hola|holaaa|holi)\b/i,
  /^\s*(buenos?\s*días?|buenas\s*tardes?|buenas\s*noches?)\b/i,
  /^\s*(qué\s+tal|que\s+tal)\b/i,
  /^\s*(hey|ey)\b/i,
  /^\s*(buen\s*día)\b/i,
  /^\s*saludos?\s*$/i,
  /^\s*(hi|hello)\b/i,
];

// ── detectGreeting · determinístico · normaliza prefix whitespace ────────
export function detectGreeting(text) {
  if (!text || typeof text !== "string") return false;
  return GREETING_PATTERNS.some(re => re.test(text.trim()));
}

// ── GREETING_RESPONSE · texto founder-firmado · cálido + caminos (L8574) ──
const GREETING_RESPONSE = `Hola. Soy ADI · tu asesor para mirar el negocio con cifras y postura.

Algunos caminos para empezar:
· Panorama del negocio
· Quién es tu peor cliente por margen
· Qué harías este mes como gerente comercial

O preguntame lo que quieras · vemos.`;

// ── OOD_RESPONSE_VARIANTS · 4 textos founder-firmados (L8590) ────────────
const OOD_RESPONSE_VARIANTS = [
  `Eso está fuera de lo que razono. Trabajo sobre datos del negocio y decisiones asociadas a ellos.

Si querés probar el motor · partamos por algo como: panorama del negocio o quién está generando mayor presión sobre el margen.`,

  `No trabajo sobre información externa como clima. Lo que sí puedo interpretar está adelante: cartera · márgenes · inventario y comportamiento del negocio.

Elegí un ángulo y lo razonamos.`,

  `Eso queda fuera de mi contexto actual. Donde agrego valor es entendiendo qué está pasando dentro del negocio y qué merece atención.

Por ejemplo: "¿qué harías este mes como gerente comercial?"`,

  `Todavía no entramos en una conversación de negocio. Cuando quieras · puedo partir desde cualquiera de estos caminos:

· Panorama del negocio
· Dónde se está perdiendo contribución
· Qué acciones priorizar este mes`,
];

// ── OOD_PERSISTENT_MODE · texto fijo T5+ (L8611) ─────────────────────────
const OOD_PERSISTENT_MODE = `Todavía no veo una conversación relacionada con el negocio. Mi foco es transformar datos en lectura y decisiones.

Podemos partir por:
· Panorama del negocio
· Clientes con mayor presión de margen
· Qué haría este mes como gerente comercial`;

// ── selectOODResponse · selecciona variante según counter (L8620) ────────
function selectOODResponse(consecutiveOODCount) {
  const c = (typeof consecutiveOODCount === "number" && consecutiveOODCount > 0) ? consecutiveOODCount : 1;
  if (c <= 1) return OOD_RESPONSE_VARIANTS[0];
  if (c === 2) return OOD_RESPONSE_VARIANTS[1];
  if (c === 3) return OOD_RESPONSE_VARIANTS[2];
  if (c === 4) return OOD_RESPONSE_VARIANTS[3];
  return OOD_PERSISTENT_MODE;
}

// ── OUT_OF_DOMAIN_PATTERNS · 5 patterns obvios (L8630) ───────────────────
const OUT_OF_DOMAIN_PATTERNS = [
  /\b(clima|tiempo|lluvia|temperatura)\b/i,
  /\b(politica|elecciones|gobierno|presidente)\b/i,
  /\b(deporte|futbol|partido)\b/i,
  /\b(hora|fecha|dia\s+de\s+hoy)\b/i,
  /\b(comida|receta|cocinar)\b/i,
];

// ── isObviouslyOutOfDomain · detector determinístico (L8641) ─────────────
export function isObviouslyOutOfDomain(text) {
  if (!text || typeof text !== "string") return false;
  const normalized = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return OUT_OF_DOMAIN_PATTERNS.some(p => p.test(normalized));
}

// ── composeGlobalHonestFallback (L9165) ──────────────────────────────────
export function composeGlobalHonestFallback(query, conversationContext, modulo, scenario) {
  // ── FIX_GREETING_LAYER · Branch 1 · SALUDO ──────────────────────────────
  if (VOICE_GREETING_LAYER_ENABLED && detectGreeting(query)) {
    return {
      opener: GREETING_RESPONSE,
      suggestions: [],
      sentrixAction: null,
      reasoningPattern: "greeting",
      // SIN narrative_signals · SIN posture_hint · skip FASE 5
    };
  }

  // ── FIX_GREETING_LAYER · Branch 2 · OOD ESCALADO (sustituye legacy) ─────
  if (VOICE_GREETING_LAYER_ENABLED && isObviouslyOutOfDomain(query)) {
    const currentCount = (conversationContext?.consecutiveOODCount || 0) + 1;
    return {
      opener: selectOODResponse(currentCount),
      suggestions: [],
      sentrixAction: null,
      reasoningPattern: "out_of_domain_escalated",
      // SIN narrative_signals · SIN posture_hint · skip FASE 5
    };
  }

  // ── BRIEF M.B.4 · branch out-of-domain LEGACY (D-MB4-2 Opción C) ────────
  // Activo solo cuando VOICE_GREETING_LAYER_ENABLED=false (flag OFF rollback).
  if (isObviouslyOutOfDomain(query)) {
    const opener_ood = [
      `Eso no es algo que pueda razonar con los datos del negocio.`,
      ``,
      `Si querés algo del lado comercial · operacional o de inventario · cualquier pregunta sobre el escenario actual la tomo.`,
    ].join("\n");
    return {
      opener: applyVoiceCalibration(opener_ood, "explore"),
      // BRIEF N-bis · Tipo A puro · suggestions vacías
      suggestions: [],
      sentrixAction: null,  // sin acción · query no relacionada
      reasoningPattern: "global_honest_fallback_ood",
      // F4 founder · SIN narrative_signals · SIN posture_hint · skip FASE 5
    };
  }

  // ── Branch estándar · 3 alternativas contextuales (D-MB4-3 Forma A) ──
  const alternatives = _generateContextualAlternatives(conversationContext, modulo, scenario);
  const sentrixAction = _maybeEmitSentrixAction(conversationContext, modulo);

  const opener_std = [
    `No tengo evidencia determinística para responder eso · pero puedo ayudarte con caminos cercanos.`,
    ``,
    `Tres ángulos que sí puedo cubrir:`,
    `· ${alternatives[0]}`,
    `· ${alternatives[1]}`,
    `· ${alternatives[2]}`,
    ``,
    `Decime cuál te interesa · o reformulalo y vemos.`,
  ].join("\n");

  return {
    opener: applyVoiceCalibration(opener_std, "explore"),
    // BRIEF N-bis · Tipo A puro · suggestions vacías
    suggestions: [],
    sentrixAction,
    reasoningPattern: "global_honest_fallback",
    // F4 founder · SIN narrative_signals · SIN posture_hint · skip FASE 5
  };
}
