/* === src/adi/llm/modelDefaults.js · EL DEFAULT DE MODELO CONOCE A SU PROVEEDOR (owner 2026-08-13) ==========
 *
 * EL DEFECTO QUE CIERRA, antes de que ocurra en producción. `gatewayCore.js` resolvía el modelo así:
 *     const model = e.LLM_MODEL_PARSE || e.OPENAI_MODEL || e.ANTHROPIC_MODEL || "gpt-4o-mini";
 * Con LLM_PROVIDER=anthropic y las variables de modelo sin setear, ese default viajaba TAL CUAL a la API de
 * Anthropic — que no conoce ningún "gpt-4o-mini" y devuelve un error en runtime, en producción, con el usuario
 * mirando. La misma trampa en versión modelo del `LLM_PROVIDER || "anthropic"` que providerConfig.js cerró:
 * un default que nombra un modelo de OTRO proveedor no es un default, es un error diferido al peor momento.
 *
 * LA REGLA: el default de modelo se elige DESPUÉS de saber quién es el proveedor, y siempre es un modelo que ese
 * proveedor puede servir. La decisión de QUÉ modelos (owner 2026-08-13): PLAN=claude-haiku-4-5 · NARRAR=
 * claude-sonnet-5, DOS modelos exactos, sin tercer tier (el reintento tras rechazo de guardC repite Sonnet —
 * modelRouter.js solo escala con provider=openai, y eso es deliberado, no un hueco).
 * Esto NO debilita el freno de proveedor: sin LLM_PROVIDER el gateway sigue FALLANDO nombrando la variable
 * (providerConfig.js) — acá solo se decide el modelo de un proveedor que YA está declarado.
 *
 * POR QUÉ ES UN MÓDULO PROPIO: la misma razón que providerConfig.js — todo gate/probe que importe gatewayCore.js
 * queda clasificado LIVE y no corre en `npm run gates:offline`. Acá la decisión vive sola, sin imports, sin red,
 * y la suite offline la EJERCE de verdad en vez de leerla como texto.
 *
 * QUÉ NO HACE: no valida que el modelo exista en el proveedor (esa verdad es del proveedor, no de este módulo) y
 * no toca la cadena legada de openai/otros — esa rama es byte-igual a la de siempre, incluido su default.
 */

/** Los defaults por proveedor, en un solo lugar. opus-5 NO aparece a propósito: está tarifado en modelPricing.js
 *  como escalón futuro de certificación, pero no es default de nada ni lo rutea nadie. */
export const MODELO_PARSE_DEFAULT = Object.freeze({ anthropic: "claude-haiku-4-5", openai: "gpt-4o-mini" });
export const MODELO_NARRATE_DEFAULT = Object.freeze({ anthropic: "claude-sonnet-5", openai: "gpt-4o-mini" });

// "  " (solo espacios) cuenta como AUSENTE — misma política que resolverProveedor: un campo creado y sin valor
// en el panel de la plataforma no es una declaración.
const _declarado = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

/* resolverModelos(env, proveedor) → { model, narrateModel }
 *
 * · proveedor = "anthropic" → lo declarado gana, y el default es el par del owner:
 *     model        = LLM_MODEL_PARSE   || ANTHROPIC_MODEL || "claude-haiku-4-5"
 *     narrateModel = LLM_MODEL_NARRATE || ANTHROPIC_MODEL || "claude-sonnet-5"
 *   OPENAI_MODEL NO entra a esta rama: es el nombre de un modelo de otro proveedor — dejarlo pasar es exactamente
 *   la trampa que este módulo cierra, solo que por otra variable. ANTHROPIC_MODEL sí (declara "el modelo de
 *   anthropic" y cubre las dos pasadas, como siempre hizo vía herencia). LLM_MODEL_PARSE no se hereda a narrar en
 *   esta rama: heredarlo pondría a Haiku a narrar en silencio y desharía la decisión de dos modelos del owner —
 *   quien quiera un solo modelo lo declara en ANTHROPIC_MODEL o setea las dos variables.
 *
 * · cualquier otro proveedor (openai, stubs, o ninguno declarado) → la cadena de SIEMPRE, byte-igual:
 *     model        = LLM_MODEL_PARSE || OPENAI_MODEL || ANTHROPIC_MODEL || "gpt-4o-mini"
 *     narrateModel = LLM_MODEL_NARRATE || model
 *   (con proveedor sin declarar el gateway frena ANTES de usar estos valores; se resuelven igual solo para que la
 *   telemetría del turno frenado reporte lo mismo que siempre reportó). */
export function resolverModelos(env, proveedor) {
  const e = env && typeof env === "object" ? env : {};
  const parseVar = _declarado(e.LLM_MODEL_PARSE);
  const narrateVar = _declarado(e.LLM_MODEL_NARRATE);
  if (proveedor === "anthropic") {
    const propio = _declarado(e.ANTHROPIC_MODEL);
    return {
      model: parseVar || propio || MODELO_PARSE_DEFAULT.anthropic,
      narrateModel: narrateVar || propio || MODELO_NARRATE_DEFAULT.anthropic,
    };
  }
  const model = parseVar || _declarado(e.OPENAI_MODEL) || _declarado(e.ANTHROPIC_MODEL) || MODELO_PARSE_DEFAULT.openai;
  return { model, narrateModel: narrateVar || model };
}
