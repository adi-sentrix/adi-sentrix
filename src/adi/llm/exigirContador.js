/* === src/adi/llm/exigirContador.js · EL CANDADO «SIN CONTADOR NO HAY GASTO» (owner 2026-09-25, ETAPA 0) ========
 *
 * POR QUÉ EXISTE. La ley de esta etapa, textual del encargo: «ningún gasto en modelos sin contador funcionando
 * antes». CLAUDE.md §5 lo dice para todo el repo: «impedir el consumo técnicamente, no por instrucción — una
 * regla escrita no frena un gasto, un cerrojo sí». Este archivo es ese cerrojo, aplicado específicamente al
 * contador: antes de este módulo, nada impedía que el gateway saliera al proveedor con la telemetría apagada.
 *
 * OPT-IN, A PROPÓSITO. Con `ADI_EXIGIR_CONTADOR` sin declarar (el default), `exigirContador()` siempre aprueba:
 * comportamiento IDÉNTICO al de hoy, byte a byte. Encenderlo es una decisión explícita de quien va a correr una
 * medición — el mismo patrón que `ADI_TELEMETRY_FILE`/`ADI_TELEMETRY_CONSOLE` en `telemetrySink.js`: el host
 * decide, este módulo no adivina ni se enciende solo. El valor que lo activa es EXACTAMENTE "1" — no "true", no
 * "1 " con espacio, no cualquier cadena truthy — la misma disciplina de forma única que ya usan los enums de
 * `telemetry.js` (ETAPAS, RESULTADOS, REASON_CODES, CONSUMO): una variable de encendido con más de una forma
 * válida es una forma de apagarse por accidente (typear "TRUE" y creer que quedó prendida).
 *
 * QUÉ VERIFICA, y SOLO eso: que `telemetry.js` tenga un SINK instalado (`getSink()`) en el momento en que el
 * caller pregunta. No verifica que el sink escriba a buen puerto, ni que la corrida vaya a salir bien — sólo que
 * haya ALGUIEN escuchando antes de gastar. Sin oyente, la respuesta es un rechazo tipado (`sin_contador`, agregado
 * a la lista cerrada de `REASON_CODES` en `telemetry.js`) para que el caller lo use con el MISMO patrón `_frenado`
 * que ya usan los demás frenos del gateway (acceso denegado, rate limit, proveedor sin declarar): un freno más de
 * la misma familia, no un mecanismo aparte.
 *
 * DÓNDE SE ENCHUFA (decisión que este módulo deja abierta a propósito, ver el informe al supervisor): el "punto
 * único por donde salen las llamadas" que pidió el encargo NO es un único lugar en `gatewayCore.js` — son CINCO
 * sitios (`handleSpec`, `handleNarrate`, `handlePlan`, `handleNarrateC`, `handleAgente`), cada uno con su propio
 * `_salioAlProveedor = true` inmediatamente antes de su propio `await getAdapter(provider).<método>(...)`. Cablear
 * el candado ahí es tocar el gateway en producción cinco veces; este módulo llega listo, puro y probado para esa
 * cirugía, pero la cirugía en sí queda para cuando el supervisor confirme el punto de inserción (ver el reporte).
 *
 * PURO: no toca red, no toca el proveedor, no decide nada del negocio — lee una variable de entorno (inyectable,
 * nunca `process.env` a ciegas cuando el caller pasa la suya) y el estado en memoria del sink de `telemetry.js`.
 */
import { getSink } from "./telemetry.js";

export const ADI_EXIGIR_CONTADOR_VAR = "ADI_EXIGIR_CONTADOR";
export const SIN_CONTADOR_REASON = "sin_contador";

/** contadorExigido(env?) → true solo si la variable vale EXACTAMENTE "1". Cualquier otra forma (incluida "true",
 * "yes", "1 ") es "no exigido" — la variable se declara UNA sola forma, no se adivina la intención. */
export function contadorExigido(env = null) {
  const e = env || (typeof process !== "undefined" ? process.env : null) || {};
  return String(e[ADI_EXIGIR_CONTADOR_VAR]) === "1";
}

/**
 * exigirContador({env}) → { ok: true } | { ok: false, reasonCode: "sin_contador", mensaje }
 *   · variable apagada (default) → siempre { ok: true }, sin mirar el sink: CERO cambio de comportamiento hoy.
 *   · variable encendida → { ok: true } SOLO si `telemetry.js` tiene un sink instalado; si no, rechaza.
 * `env` es inyectable (igual que `_config(env)` en gatewayCore.js) para que un caller/gate pueda certificar las
 * dos ramas sin depender de `process.env` real ni de un sink real.
 */
export function exigirContador({ env = null } = {}) {
  if (!contadorExigido(env)) return { ok: true };
  if (getSink()) return { ok: true };
  return {
    ok: false,
    reasonCode: SIN_CONTADOR_REASON,
    mensaje: `${ADI_EXIGIR_CONTADOR_VAR}=1: sin contador de consumo instalado (telemetry.js sin sink) — la ` +
      `llamada se rechaza antes de salir al proveedor. Instalá un sink (instalarTelemetria/abrirCorridaMedida) ` +
      `antes de gastar.`,
  };
}
