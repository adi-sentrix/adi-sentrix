/* === src/adi/llm/specTool.js · ADI Core · Paso 5 v1 · TOOL emit_spec (JSON-schema forzado) ===
 * El input_schema de esta tool ES el spec LOCKED (Paso 4). Forzar la tool (tool_choice) garantiza que el LLM emita
 * JSON válido contra el schema — elimina la clase "JSON inválido". Los enums (métricas/ejes/operaciones) se generan
 * DESDE el contrato → misma fuente que el menú y que la validación del seam. answerADIFromSpec valida DESPUÉS (#0..#8)
 * lo que el schema no puede: entidad inexistente, cruce bloqueado, métrica no ejecutable → degrada honesto.
 *
 * ADITIVO: lee el contrato, no toca el motor. */
import { METRICS } from "../../config/contract/metricRegistry.js";
import { ENTITIES } from "../../config/contract/entityRegistry.js";

const OPERATIONS = ["overview", "rank", "compare", "dive", "explain_availability"];
const ASSUMPTION_TYPES = ["growth", "price", "margin", "inventory", "custom"];

export function buildSpecTool() {
  const dims = Object.keys(ENTITIES);
  const metrics = Object.keys(METRICS);
  return {
    // NEUTRAL: { name, description, schema:<JSON-Schema> }. Cada adapter lo traduce a su formato de tool
    // (Anthropic input_schema · OpenAI function.parameters · Gemini functionDeclarations). El schema es de ADI.
    name: "emit_spec",
    description: "Emití el spec canónico de ADI para la pregunta del usuario. Solo el spec: no calcules ni narres.",
    schema: {
      type: "object",
      properties: {
        schemaVersion: { type: "integer", enum: [1], description: "siempre 1" },
        operation: { type: "string", enum: OPERATIONS },
        metric: { type: "string", enum: metrics },
        dimension: { type: "string", enum: dims },
        entity: { type: ["string", "null"], description: "entidad concreta para dive/foco · null si no aplica" },
        filters: { type: "object", description: "recortes { marca?, familia?, cliente?, bodega? }" },
        comparison: {
          type: ["object", "null"],
          properties: { dimension: { type: "string", enum: dims }, entities: { type: "array", items: { type: "string" } } },
          description: "solo para operation=compare",
        },
        sort: {
          type: ["object", "null"],
          properties: { by: { type: "string" }, dir: { type: "string", enum: ["asc", "desc"] } },
        },
        limit: { type: ["integer", "null"], description: "N para rank" },
        scenario: { type: "string", enum: ["actual", "simulation"], description: "actual por defecto" },
        assumption: {
          type: ["object", "null"],
          properties: {
            type: { type: "string", enum: ASSUMPTION_TYPES },
            value: { type: "number" },
            unit: { type: "string", enum: ["pct", "money", "days"] },
          },
          description: "solo si scenario=simulation",
        },
        lens: { type: ["string", "null"], enum: ["diagnostico", "evidencia", "control", "cuadro", null] },
        confidence: { type: ["number", "null"], description: "0..1 · tu confianza en esta interpretación" },
      },
      required: ["schemaVersion", "operation", "metric", "dimension"],
    },
  };
}
