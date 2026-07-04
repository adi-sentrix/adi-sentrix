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
import { ASSUMPTIONS } from "../../config/contract/assumptionRegistry.js";

// descripciones de las operaciones (capa de presentación · el set canónico vive en el seam)
const OPERATIONS = [
  ["overview", "una métrica a lo largo de una dimensión, en tabla/ranking · ej: 'ventas por cliente'"],
  ["rank", "top/bottom N de una dimensión por una métrica · ej: 'los 5 mejores clientes por contribución'"],
  ["compare", "dos entidades de una misma dimensión · ej: 'compará Falabella con Lider'"],
  ["dive", "el detalle de UNA entidad · ej: '¿cómo está Falabella?'"],
  ["diagnose", "dónde se está perdiendo/inmovilizando plata en la cartera · ej: '¿dónde pierdo dinero?', '¿qué me come el margen?', '¿dónde tengo capital dormido?' · barre los focos (contribución no capturada · carga comercial alta · capital dormido) y los ordena por impacto en $"],
  ["why", "el PORQUÉ de algo · ej: '¿por qué Falabella cede margen?', '¿por qué este SKU no rota?', '¿por qué vendo más pero gano menos?' · reusa el mecanismo (carga/rotación/capital) y gradúa la certeza (probado / la señal apunta / no puedo afirmar)"],
  ["recommend", "QUÉ HACER · ej: '¿qué hago con los SKU dormidos?', '¿cómo lo corrijo?', '¿qué me recomendás?' · recomienda SOLO sobre palancas probadas (carga/capital) con su $ y su trade-off; si la causa está abierta, recomienda diagnosticar (no inventa una solución)"],
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
  L.push("ESCENARIO (campo `scenario`): 'actual' (por defecto) o 'simulation'.");
  L.push("  · Si es 'simulation', agregá `assumption { type, value, unit }`. type: " + Object.keys(ASSUMPTIONS).join(", ") + " · unit: pct | money | days.");
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
  return L.join("\n");
}
