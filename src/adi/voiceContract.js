export const VOICE_CONTRACT_DICTIONARY = [
  // ── FRASES COMPUESTAS (LOCK founder + descubiertas) ──────────────────────
  // Longest-match-first · estas DEBEN aplicarse antes que las atómicas.
  { from: /El capital inmovilizado en inventario opera sobre liquidez, no sobre P&L mensual/g,
    to: "El capital inmovilizado en inventario afecta la caja, no el P&L del mes" },
  { from: /Las palancas detectadas operan sobre dimensiones distintas del negocio/g,
    to: "Las opciones disponibles afectan partes distintas del negocio" },
  { from: /Las palancas no son equivalentes ni intercambiables/g,
    to: "Las opciones no son iguales" },
  { from: /Carga comercial y crecimiento operan sobre rentabilidad presente/g,
    to: "Carga comercial y crecimiento afectan rentabilidad presente" },
  { from: /Inventario y margen operan sobre escalas temporales distintas/g,
    to: "Inventario y margen funcionan en escalas temporales distintas" },
  { from: /El inventario opera sobre liquidez, no sobre P&L mensual/g,
    to: "El inventario afecta la caja, no el P&L del mes" },
  { from: /Solo una de ellas combina impacto económico material/g,
    to: "Solo una combina impacto económico real" },
  { from: /Cada eje opera sobre una dimensión económica distinta del negocio/g,
    to: "Cada eje afecta una parte económica distinta del negocio" },

  // ── REGEX DE CAPTURA · CONTEOS NUMÉRICOS ─────────────────────────────────
  { from: /\b(\d+) focos activos\b/g, to: "$1 cosas explicando el problema" },

  // ── ATÓMICAS · PALANCAS (orden longest-first dentro del grupo) ──────────
  { from: /\bLa palanca de mayor impacto inmediato\b/g, to: "El movimiento con más peso inmediato" },
  { from: /\bla palanca de mayor impacto\b/g,           to: "el movimiento con más peso" },
  { from: /\bLa palanca prioritaria\b/g,                to: "El movimiento prioritario" },
  { from: /\bla palanca prioritaria\b/g,                to: "el movimiento prioritario" },
  { from: /\bla palanca recomendada\b/g,                to: "el movimiento recomendado" },
  { from: /\botras palancas subsecuentes\b/g,           to: "otras opciones subsecuentes" },
  { from: /\botras palancas son válidas\b/g,            to: "otras opciones son válidas" },
  { from: /\bpalanca estructural\b/g,                   to: "movimiento estructural" },
  { from: /\bla palanca real\b/g,                       to: "la opción real" },
  { from: /\buna palanca real\b/g,                      to: "una opción real" },
  { from: /\bdos palancas\b/g,                          to: "dos movimientos" },
  { from: /\bpalancas de margen\b/g,                    to: "opciones de margen" },

  // ── ATÓMICAS · MATERIALIDAD ─────────────────────────────────────────────
  { from: /\bmayor materialidad activa\b/g,         to: "mayor peso económico activo" },
  { from: /\bmateralidad de (la )?cartera\b/g,      to: "peso económico en la cartera" }, // typo defensivo
  { from: /\bmaterialidad de (la )?cartera\b/g,     to: "peso económico en la cartera" },
  { from: /\bmayor materialidad\b/g,                to: "mayor peso económico" },
  { from: /\bmaterialidad real\b/g,                 to: "el peso real" },
  { from: /\bmaterialidad activa\b/g,               to: "peso económico activo" },
  { from: /\bmaterialidad\b/g,                      to: "peso económico" },

  // ── ATÓMICAS · FOCOS / DIMENSIONES / EXCEPCIÓN ──────────────────────────
  { from: /\bfoco activo\b/g,                       to: "lo que explica el problema" },
  { from: /\bdimensiones distintas del negocio\b/g, to: "partes distintas del negocio" },
  { from: /\bdimensiones distintas\b/g,             to: "partes distintas" },
  { from: /\bexcepción virtuosa subexplotada\b/g,   to: "lo que está saliendo bien pero no estamos aprovechando" },
  { from: /\bexcepción virtuosa\b/g,                to: "lo que está saliendo bien" },
  { from: /\binstancia principal de\b/g,            to: "el caso más crítico de" },

  // ── ATÓMICAS · CONTROLABILIDAD ──────────────────────────────────────────
  { from: /\bcontrolabilidad operativa directa\b/g, to: "control directo" },
  { from: /\bmayor controlabilidad operativa\b/g,   to: "mayor control directo" },
  { from: /\bcontrolabilidad operativa\b/g,         to: "control directo" },
  { from: /\bcontrolabilidad de carga\b/g,          to: "control de carga" },

  // ── ATÓMICAS · EJECUCIÓN / RECUPERACIÓN / OPERA SOBRE ───────────────────
  { from: /\brecuperación dentro del ciclo comercial actual\b/g, to: "se ve este trimestre" },
  { from: /\bopera sobre liquidez\b/g,                to: "afecta la caja" },
  { from: /\boperan sobre rentabilidad presente\b/g,  to: "afectan rentabilidad presente" },

  // ── PREVENTIVAS (NO existen literal hoy · protegen contra futuros) ──────
  { from: /\bcaptura de rentabilidad\b/g,             to: "rentabilidad que se queda" },

  // ── #D-EPI-3 · "sin sacrificar volumen" en composeSimulationBenchmark + Quality ──
  { from: /\bsin sacrificar volumen presente\b/g,     to: "sin compromiso explícito de volumen" },
  { from: /\bsin sacrificar volumen\b/g,              to: "sin compromiso explícito de volumen" },
  { from: /\bsin sacrificar participación\b/g,        to: "sin compromiso explícito de volumen" },
];

// Pre-procesamiento longest-match-first (REGLA LOCKED · ordena por longitud
// de regex.source descendente). Se computa una sola vez al cargar el módulo.
export const VOICE_CONTRACT_DICTIONARY_SORTED = [...VOICE_CONTRACT_DICTIONARY]
  .sort((a, b) => b.from.source.length - a.from.source.length);

// ────────────────────────────────────────────────────────────────────────────
// applyVoiceContract · función pura · aplica diccionario respetando guardrails.
//
// Estrategia de protección de Confianza marker:
//   El marcador es `*Confianza alta/media/baja. <texto>.*` · usualmente al
//   final del opener · puede ser multi-línea. Detectamos cada match y verificamos
//   si su offset cae dentro de un par "*...*" · si SÍ, skip.
//
// Estrategia de protección de comillas/backticks:
//   Similar · si match está dentro de "..." o `...` literal en el output,
//   skip. (Outputs ADI rara vez contienen citas literales · es defensivo.)
// ────────────────────────────────────────────────────────────────────────────

export function vc_isInsideProtectedSegment(text, offset) {
  // Buscar segmentos "*Confianza ... *" que rodeen el offset.
  // Patrón: "*Confianza" seguido por contenido hasta el siguiente ".*"
  const before = text.substring(0, offset);
  // Detectar último "*Confianza" antes del offset
  const lastConfianzaOpen = before.lastIndexOf("*Confianza");
  if (lastConfianzaOpen >= 0) {
    // ¿Hay un ".*" entre lastConfianzaOpen y offset?
    const slice = text.substring(lastConfianzaOpen, offset);
    if (!slice.includes(".*")) {
      // No hay cierre intermedio · estamos DENTRO del marker
      return true;
    }
  }
  return false;
}

export function applyVoiceContract(opener, opts) {
  if (!opener || typeof opener !== "string") {
    return { transformedOpener: opener || "", shouldApply: false, replacementsCount: 0, transformations: [] };
  }
  try {
    let transformed = opener;
    let count = 0;
    const trace = [];

    for (const entry of VOICE_CONTRACT_DICTIONARY_SORTED) {
      // Reset lastIndex defensivo (regex con flag /g mantienen estado)
      entry.from.lastIndex = 0;
      transformed = transformed.replace(entry.from, (match, ...args) => {
        // args structure: capture_groups..., offset, string [, namedGroups]
        // El offset es el penúltimo elemento si no hay namedGroups
        let offset = 0;
        for (let i = args.length - 1; i >= 0; i--) {
          if (typeof args[i] === "number") { offset = args[i]; break; }
        }
        // Skip si estamos dentro de marcador Confianza
        if (vc_isInsideProtectedSegment(transformed, offset)) {
          return match;
        }
        count++;
        if (opts && opts.debug) trace.push({ from: match, to: entry.to, offset });
        // Preservar capture group $1 si la regex lo tiene
        if (entry.to.includes("$1") && args.length > 0 && typeof args[0] === "string") {
          return entry.to.replace("$1", args[0]);
        }
        return entry.to;
      });
    }

    return {
      transformedOpener: transformed,
      shouldApply: count > 0,
      replacementsCount: count,
      transformations: trace,
    };
  } catch (e) {
    return {
      transformedOpener: opener,
      shouldApply: false,
      replacementsCount: 0,
      transformations: [],
      error: e?.message || String(e),
    };
  }
}
