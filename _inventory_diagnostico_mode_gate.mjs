/* === _inventory_diagnostico_mode_gate.mjs · GATE del hallazgo "capital inmovilizado da respuestas distintas" ===
 * Hallazgo en vivo (app.adiai.cl, owner 2026-08-02, con capturas de pantalla comparando dos redacciones de la
 * MISMA pregunta): "cuanto capital tengo inmovilizado en inventario?" clasificó mode="default" (PLAN payload real:
 * {"tool":"inventoryStatus","args":{}}) mientras que "¿Dónde tengo capital inmovilizado?" — el mismo tool, mismos
 * datos, scope global en ambos — clasificó mode="diagnostico". Como cada modo narra distinto (diagnostico cuenta
 * la historia completa por conversationalContract.js; default da "el dato claro" y corta), la MISMA pregunta de
 * negocio terminaba con una profundidad de respuesta muy distinta según cómo se formule — confirmado con los
 * payloads reales de /api/adi-plan y /api/adi-narrate-c en la misma sesión limpia (localStorage.adi_oracle=null).
 *
 * Causa raíz: planPrompt.js YA describe inventoryStatus SIN filtro como "DIAGNÓSTICO de inventario... es la
 * respuesta completa a 'dónde tengo capital inmovilizado'" — pero el LLM no lo aplica de forma confiable. Mismo bar
 * que el hallazgo "Dale, cuéntame un poco más de eso" (ver _SEGUIMIENTO_MARKER_RE en answerViaOracle.js): doctrina
 * clara, LLM sistemáticamente inconsistente → backstop determinístico, mismo patrón que _coerceMode ya usa para
 * clarify/seguimiento.
 *
 * Fix: _isGlobalInventoryStatusCall + _coerceMode (answerViaOracle.js) — si PLAN llamó inventoryStatus SIN filtro
 * (scope global) y el mode elegido es "default", se corrige a "diagnostico". Acotado a esa combinación exacta:
 * una bodega/marca puntual (CON filtro) no se toca, y cualquier OTRA tool tampoco — no es una regla general de
 * "default nunca existe", es la corrección de un caso específico medido en vivo.
 *
 * 100% determinístico (sin LLM, sin red) — mem/callPlan se mockean a mano, mismo patrón que el resto de gates de
 * answerViaOracle.js (ver _vague_offer_gate.mjs). */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

async function _modeFor({ text, mode, calls, scope, history = [] }) {
  const callPlan = async () => ({ intent: "answer", mode, scope, calls });
  let captured = null;
  const callNarrate = async ({ plan }) => { captured = plan.mode; return "narración de prueba, sin cifras propias."; };
  await answerViaOracle({ text, history, mem: {}, scenario: "actual", callPlan, callNarrate });
  return captured;
}

console.log("── 1 · el caso REAL reportado: inventoryStatus GLOBAL + mode=default del LLM → se corrige a diagnostico ──");
{
  const mode = await _modeFor({
    text: "cuanto capital tengo inmovilizado en inventario?",
    mode: "default",
    scope: { level: "global" },
    calls: [{ tool: "inventoryStatus", args: {} }],
  });
  ok(mode === "diagnostico", `obtuvo mode="${mode}"`);
}

console.log("\n── 2 · control: inventoryStatus GLOBAL pero el LLM YA eligió diagnostico → se mantiene (no rompe el caso ya-correcto) ──");
{
  const mode = await _modeFor({
    text: "¿Dónde tengo capital inmovilizado?",
    mode: "diagnostico",
    scope: { level: "global" },
    calls: [{ tool: "inventoryStatus", args: {} }],
  });
  ok(mode === "diagnostico", `obtuvo mode="${mode}"`);
}

console.log("\n── 3 · REGRESIÓN: inventoryStatus CON filtro puntual (una bodega) → NO se toca, sigue siendo el criterio del LLM ──");
{
  const mode = await _modeFor({
    text: "cuanto capital tengo inmovilizado en la bodega Valparaíso?",
    mode: "default",
    scope: { level: "entity", entities: ["Valparaíso"] },
    calls: [{ tool: "inventoryStatus", args: { filters: { bodega: "Valparaíso" } } }],
  });
  ok(mode === "default", `un filtro puntual NO fuerza diagnostico (más específico que el global) — obtuvo mode="${mode}"`);
}

console.log("\n── 4 · REGRESIÓN: OTRA tool con mode=default → NO se toca (no es una regla general anti-'default') ──");
{
  const mode = await _modeFor({
    text: "cuantas unidades vendio Falabella?",
    mode: "default",
    scope: { level: "entity", entities: ["Falabella"] },
    calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }],
  });
  ok(mode === "default", `entityRecord con mode=default queda intacto — obtuvo mode="${mode}"`);
}

console.log("\n── 5 · REGRESIÓN: inventoryStatus global pero el LLM eligió OTRO mode válido (ej. seguimiento) → se respeta, no se pisa ──");
{
  const mode = await _modeFor({
    text: "seguí contándome del inventario",
    mode: "seguimiento",
    scope: { level: "global" },
    calls: [{ tool: "inventoryStatus", args: {} }],
    history: [{ role: "user", text: "¿dónde tengo capital inmovilizado?" }, { role: "adi", gist: "..." }],
  });
  ok(mode === "seguimiento", `un mode más específico que el LLM ya eligió no se sobrescribe — obtuvo mode="${mode}"`);
}

console.log("\n── 6 · REGRESIÓN: precedencia — clarify sigue ganando aunque la tool sea inventoryStatus global ──");
{
  const mode = await _modeFor({
    text: "no entendí, explícamelo más fácil",
    mode: "default",
    scope: { level: "global" },
    calls: [{ tool: "inventoryStatus", args: {} }],
    history: [{ role: "user", text: "¿dónde tengo capital inmovilizado?" }, { role: "adi", gist: "..." }],
  });
  ok(mode === "clarify", `_CLARIFY_RE sigue con precedencia máxima — obtuvo mode="${mode}"`);
}

console.log(`\n── _inventory_diagnostico_mode_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
