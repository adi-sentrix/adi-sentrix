/* === scripts/medicion-anfitrion/brazo.mjs · EL BRAZO DEL A/B (`_ADI_DISENO_ALCANCE_DE_LO_ENTREGADO.md` §6.2) ═══════════════════════════════════════
 * El experimento pareado corre el MISMO corpus sellado con dos entregas de ADI:
 *   A · la entrega de hoy            → ADI_ALCANCE_ESTRUCTURAL = "0"
 *   B · la entrega con alcance como dato (+ «lo establecido» + cabecera de 4 reglas) → ADI_ALCANCE_ESTRUCTURAL = "1"  (el valor por defecto del servidor)
 * La variable la lee el SERVIDOR de ADI (la puerta de las cuatro acciones), no el anfitrión: por eso el arnés la pone SOLO en el entorno de ese servidor
 * (el bloque `env` del servidor `adi` en el `--mcp-config` de la vía cli; el `env` de la puerta en proceso de la vía api) y la QUITA del entorno del
 * hijo `claude`. El servidor deja su arranque en `arranque.json` y el arnés lo contrasta: un brazo que no llegó al servidor invalida la corrida.
 * Cero red, cero LLM. */

export const VARIABLE_DEL_BRAZO = "ADI_ALCANCE_ESTRUCTURAL";
export const BRAZOS = Object.freeze({ A: "0", B: "1" });
export const BRAZO_POR_DEFECTO = "B";
export const DESCRIPCION_DEL_BRAZO = Object.freeze({ A: "entrega de hoy (sin alcance estructural)", B: "entrega con alcance estructural (alcance por universo y tabla + «lo establecido» + cabecera de 4 reglas)" });

/** normalizarBrazo("a"|"B"|undefined) → "A" | "B" | null (null = valor inválido; undefined/true → el brazo por defecto lo decide el llamador). */
export function normalizarBrazo(x) {
  if (x == null || x === true) return null;
  const s = String(x).trim().toUpperCase();
  return s === "A" || s === "B" ? s : null;
}
/** valorDelBrazo("A") → "0" · valorDelBrazo("B") → "1" */
export const valorDelBrazo = (brazo) => BRAZOS[brazo] ?? null;
/** brazoDeValor("0") → "A" · brazoDeValor("1") → "B" · otro → null */
export function brazoDeValor(v) {
  const s = v == null ? "" : String(v).trim();
  return s === "0" ? "A" : s === "1" ? "B" : null;
}
/** envDelBrazo("A") → { ADI_ALCANCE_ESTRUCTURAL: "0" } · el fragmento de entorno que va SOLO al servidor de ADI. */
export function envDelBrazo(brazo) {
  const v = valorDelBrazo(brazo);
  if (v == null) throw new Error(`envDelBrazo: el brazo debe ser A o B (llegó ${JSON.stringify(brazo)})`);
  return { [VARIABLE_DEL_BRAZO]: v };
}
/** descripcionDelBrazo(brazo) → el objeto que va al manifiesto. */
export function descripcionDelBrazo(brazo, { porDefecto = false } = {}) {
  return { id: brazo, valor: valorDelBrazo(brazo), variable: VARIABLE_DEL_BRAZO, descripcion: DESCRIPCION_DEL_BRAZO[brazo], porDefecto };
}
