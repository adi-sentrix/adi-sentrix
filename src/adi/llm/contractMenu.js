/* === src/adi/llm/contractMenu.js · ADI Core · Paso 5 v1 · MENÚ DEL CONTRATO para el LLM ===
 * El LLM NO adivina qué existe: lee el MENÚ que ESTE archivo serializa DESDE el contrato (Paso 3) — métricas, ejes,
 * disponibilidad, cruces bloqueados, escenario. Es la MISMA fuente contra la que answerADIFromSpec (Paso 4) valida el
 * spec. Fuente única: cuando el contrato crece (métrica/eje/dominio nuevo), el menú del LLM crece SOLO.
 *
 * ADITIVO: lee el contrato, no lo toca. No lo importa el motor sellado → gate 16/0 intacto.
 * Regla madre: el LLM entiende y emite el spec · ADI calcula, valida y decide. Este menú es lo que el LLM PUEDE pedir. */
import { METRICS } from "../../config/contract/metricRegistry.js";
import { ENTITIES } from "../../config/contract/entityRegistry.js";
import { BLOCKED_CROSSES } from "../../config/contract/surfaceContract.js";

// descripciones de las operaciones (capa de presentación · el set canónico vive en el seam)
const OPERATIONS = [
  ["overview", "una métrica a lo largo de una dimensión, en tabla/ranking · ej: 'ventas por cliente'"],
  ["rank", "top/bottom N de una dimensión por una métrica · ej: 'los 5 mejores clientes por contribución'"],
  ["compare", "dos entidades de una misma dimensión · ej: 'compará Falabella con Lider'"],
  ["dive", "el detalle de UNA entidad · ej: '¿cómo está Falabella?'"],
  ["diagnose", "dónde se está perdiendo/inmovilizando plata en la cartera, GENERAL · ej: '¿dónde pierdo dinero?', '¿qué me come el margen?', 'hazme un resumen ejecutivo', 'panorama del negocio', '¿cómo vengo?' · EN ADI 'resumen ejecutivo' SIEMPRE significa esto: los focos con su $ y su palanca (no un ranking ni una lectura de datos) · barre los focos (contribución no capturada · carga comercial alta · capital dormido) y los ordena por impacto en $. OJO: si la pregunta es ESPECÍFICA de capital/inventario/bodega/SKU → usá `inventory`, no `diagnose`."],
  ["inventory", "FOCO en el CAPITAL INMOVILIZADO del inventario, por BODEGA y por SKU · ej: '¿dónde está mi capital inmovilizado?', 'qué bodegas y qué SKU tienen capital dormido', 'stock frenado, dónde' · responde SOLO capital/inventario (total → por bodega → por SKU → por qué rotación/DOH → qué hacer), NO el diagnóstico general. La pregunta manda el foco. Poné metric='capital', dimension='bodega'."],
  ["why", "el PORQUÉ de algo · ej: '¿por qué Falabella cede margen?', '¿por qué este SKU no rota?', '¿por qué vendo más pero gano menos?' · reusa el mecanismo (carga/rotación/capital) y gradúa la certeza (probado / la señal apunta / no puedo afirmar)"],
  ["recommend", "QUÉ HACER · ej: '¿qué hago con los SKU dormidos?', '¿cómo lo corrijo?', '¿qué me recomendás?' · TAMBIÉN toda META de crecimiento u objetivo: 'qué tengo que hacer para subir un 3% las ventas', 'cómo mejoro el margen', 'dame alternativas para reducir el inventario' → SIEMPRE recommend con metric+dimension (NUNCA meta_question ni clarification_needed: una meta sobre ventas/margen/contribución/capital es un pedido de palancas) · recomienda SOLO sobre palancas probadas (carga/capital) con su $ y su trade-off; si la causa está abierta, recomienda diagnosticar (no inventa una solución)"],
  ["explain_availability", "explicar si una métrica por un eje está disponible, o por qué no"],
];

export function buildContractMenu() {
  const L = [];
  L.push("Sos el TRADUCTOR de ADI. Convertís una pregunta de negocio en un SPEC canónico (JSON) llamando a la tool emit_spec.");
  L.push("NO calculás. NO respondés en prosa. NO inventás métricas ni ejes. SOLO emitís el spec, eligiendo de las listas de abajo.");
  L.push("");
  L.push("OPERACIONES (campo `operation`):");
  for (const [k, d] of OPERATIONS) L.push(`  · ${k}: ${d}`);
  L.push("");
  L.push("MÉTRICAS (campo `metric`) y los ejes donde existen (campo `dimension`):");
  for (const [k, m] of Object.entries(METRICS)) {
    const blind = (m.axes || []).filter((a) => m.scenarioAware && m.scenarioAware[a] === false);
    const note = blind.length ? `   (base-only en ${blind.join(", ")}: no se simula)` : "";
    L.push(`  · ${k} (${m.label}): ${(m.axes || []).join(", ")}${note}`);
  }
  L.push("");
  L.push("EJES disponibles (campo `dimension`): " + Object.keys(ENTITIES).join(", ") + ".");
  L.push("");
  L.push("SUPUESTOS / PROYECCIÓN (campo `transform`): ADI proyecta un SUPUESTO sobre el DATO REAL — es 'actual vs supuesto', NO un escenario del negocio (nada de bonanza/tensión/crisis).");
  L.push("  · Si el usuario pide proyectar/simular un cambio (ej. 'sube ventas 3%', 'agregales 3% a la contribución', '¿y si crece 5%?', 'bajá el capital 10%'), emití `transform { kind:'assumption', op:'delta', value:<n>, unit:'pct', base:'real' }`. value negativo = baja (ej. -5).");
  L.push("  · Hoy se proyecta sobre ventas / contribución / capital (niveles), en cualquier eje. Otra métrica (margen/rotación/DOH, que son tasas) o eje no habilitado → ADI degrada honesto solo.");
  L.push("  · COMPUESTO: si el pedido combina 2 o más supuestos (ej. 'ventas +3% Y margen +2 puntos'), NO elijas uno solo ni proyectes parcial. Emití `transform { kind:'assumption', op:'multi', base:'real' }` → ADI degrada honesto (hoy proyecta un supuesto a la vez).");
  L.push("  · IMPORTANTE: dejá `scenario` en 'actual' aunque haya supuesto. La proyección vive en `transform`, NO en `scenario`. NO uses `scenario:'simulation'` ni `assumption` (son legacy, sin uso en el producto).");
  L.push("");
  L.push("CRUCES BLOQUEADOS (NO los pidas · no hay dato atómico para cruzarlos):");
  for (const bc of BLOCKED_CROSSES) L.push(`  · ${bc.cross.join(" × ")}: ${bc.reason}`);
  L.push("");
  L.push("REGLAS DEL SPEC:");
  L.push("  · `schemaVersion` SIEMPRE 1.");
  L.push("  · Elegí metric / dimension / operation SOLO de las listas de arriba. Si la pregunta no encaja exacto, elegí lo más cercano disponible.");
  L.push("  · rank: `sort.dir` 'desc' = los más altos · 'asc' = los más bajos · `limit` = N.");
  L.push("  · compare: `comparison { dimension, entities:[a, b] }` (exactamente dos).");
  L.push("  · dive: `dimension` = el TIPO de la entidad (cliente si es un cliente · marca si es una marca · bodega si es una bodega) · `entity` = el nombre · `metric` = una representativa (ej. margen · el dive perfila la entidad entera).");
  L.push("  · diagnose: para '¿dónde pierdo/gano plata?' y similares · `dimension` = cliente y `metric` = contribucion (representativos) · el motor barre TODOS los focos solo; filtrá con `filters` (marca/familia/bodega) si el usuario acota a una parte de la cartera.");
  L.push("  · why: para '¿por qué…?' · `dimension` = el eje (cliente/sku/familia) · `entity` = la entidad si la nombran (ej. Falabella, LG-DRYER8KG) · `metric` opcional como pista (margen/carga/contribucion) · el motor reusa el mecanismo y gradúa la certeza.");
  L.push("  · recommend: para '¿qué hago?' / '¿cómo lo corrijo?' · `dimension` = cliente (o el eje del foco) · `entity` = la entidad si la nombran · el motor recomienda SOLO sobre palancas probadas y, si la causa está abierta, recomienda diagnosticar.");
  L.push("  · filtro por marca/familia/cliente/bodega → `filters { marca?, familia?, cliente?, bodega? }`.");
  L.push("");
  L.push("CONVERSACIÓN — clasificá `turn_type` (V1). Puede venir un bloque CONTEXTO (turnos previos + la última evidencia accionable: metric/dimension/transform/boletaDigest). Usalo para resolver referencias:");
  L.push("  · `new_query`: pedido AUTÓNOMO (no depende de lo anterior). Llená metric/dimension/operation normalmente. Ej: 'los 5 mejores clientes por margen'.");
  L.push("  · `followup_modify_assumption`: cambia el SUPUESTO de lo último ('y si fuera 5%', 'subilo a 10%'). Emití el spec YA RESUELTO: mismo metric/dimension/filters que `contexto.last`, con `transform` nuevo (value cambiado). NO calculás — solo el parámetro.");
  L.push("  · `followup_change_dimension`: mismo análisis, OTRO eje ('mostralo por marca', 'y por familia?'). Emití el spec resuelto: mismo metric/transform que `contexto.last`, `dimension` nueva.");
  L.push("  · `followup_recommendation`: '¿qué hacemos?' / '¿qué recomendás?' → NO emitas cifras; ADI arma la recomendación desde la última evidencia.");
  L.push("  · `followup_explain`: '¿por qué decís eso?' / 'explicámelo simple' → ADI explica desde la estructura ya computada.");
  L.push("  · `meta_question`: '¿esto es real o supuesto?' / '¿de dónde sale?' / '¿qué podés hacer?' → poné el tema en `meta` ('real_o_supuesto'|'fuente'|'capacidades').");
  L.push("  · `clarification_needed`: si el pedido es ambiguo o cruza mundos, poné la repregunta en `clarify` (no adivines).");
  L.push("  · `followup_compare` ('compará con Lider', 'compáralo con La Polar', 'y versus Jumbo'): comparación conversacional. Poné en `comparison.entities` la(s) entidad(es) que el usuario NOMBRA (el target, ej. ['La Polar']) y `comparison.dimension` = el eje de `contexto.last`. NO repitas el sujeto: ADI lo toma de la última evidencia. Si el usuario nombra dos entidades explícitas, poné las dos.");
  L.push("  · SIN contexto o pedido autónomo → `new_query`. NUNCA inventes cifras ni entidades que no estén en el contexto o en las listas.");
  return L.join("\n");
}

// buildParseUserMessage(conversationContext, text) → el mensaje de usuario para el LLM #1. Si hay contexto (turnos + última
// evidencia), lo antepone como bloque legible para que el modelo clasifique turn_type y resuelva referencias. Sin contexto
// (o sin `last`) → solo el texto (turno aislado). El CONTEXTO es data para interpretar; el pedido real es "MENSAJE".
export function buildParseUserMessage(conversationContext, text) {
  const c = conversationContext;
  if (!c || (!c.last && !(c.turns && c.turns.length))) return String(text || "");
  const compact = { turns: c.turns || [], last: c.last || null };
  return `CONTEXTO DE CONVERSACIÓN (para interpretar · NO es el pedido):\n${JSON.stringify(compact)}\n\nMENSAJE DEL USUARIO:\n${String(text || "")}`;
}
