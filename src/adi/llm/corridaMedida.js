/* === src/adi/llm/corridaMedida.js · ABRIR Y CERRAR UNA «CORRIDA MEDIDA» (owner 2026-09-25, ETAPA 0) ============
 *
 * POR QUÉ EXISTE. `telemetrySink.js` ya sabe instalar un destino de archivo (`instalarTelemetria`), y
 * `consumo.js` ya sabe agregar una lista de eventos (`resumenDeCorrida`). Faltaba el gesto completo que pide el
 * encargo: «abrir» una corrida (instalar el sink hacia SU archivo), dejarla correr, y al «cerrar» devolver el
 * resumen — sin que quien mide tenga que acordarse de leer el JSONL a mano ni de restaurar el sink que había antes.
 *
 * QUÉ ES: un wrapper delgado sobre `instalarTelemetria` (destino ARCHIVO) + `resumenDeCorrida`. No reimplementa
 * ninguno de los dos: instala con la función real del sink, cierra releyendo el MISMO archivo con el `fs` que le
 * pasaron, y agrega con la MISMA función pura que usa el CLI (`scripts/resumenConsumo.mjs`) y el gate. Una sola
 * fuente para "qué es un resumen", los tres callers la comparten.
 *
 * QUÉ NO HACE: no decide el destino (lo decide quien llama, con `ruta`) ni dispara ninguna llamada al proveedor —
 * es un accesorio de MEDICIÓN, no de gasto. `fs` se inyecta (mismo patrón que `telemetrySink.js` y sus gates) para
 * que se pueda certificar offline sin tocar el disco real, y para que en un runtime sin filesystem persistente
 * (serverless) `cerrar()` no reviente: si no puede releer, el resumen sale sobre una lista vacía y lo declara
 * (`agregado: false`), nunca finge datos que no pudo leer.
 *
 * EL SINK PREVIO SE RESTAURA AL CERRAR (owner, misma ley que "no tocar lo que no es de uno"): abrir una corrida
 * medida es local a esa corrida, no un efecto global permanente sobre `telemetry.js` — si ya había un sink puesto
 * (por ejemplo el de consola en producción), `cerrar()` lo deja como estaba.
 */
import { setSink, getSink } from "./telemetry.js";
import { instalarTelemetria } from "./telemetrySink.js";
import { resumenDeCorrida } from "./consumo.js";

/**
 * abrirCorridaMedida({ ruta, tools, fs, consola, log }) → { instalacion, cerrar() }
 *   · instalacion: lo que devolvió `instalarTelemetria` (para que el caller sepa YA si quedó encendida o por qué no).
 *   · cerrar(): relee el JSONL de `ruta` (si se instaló contra archivo), restaura el sink previo, y devuelve
 *     { instalacion, agregado, resumen }. `agregado` es false cuando no hubo cómo releer (destino consola, o el
 *     archivo no se pudo leer) — el resumen sale sobre una lista vacía y NUNCA se presenta como si fuera completo.
 */
export function abrirCorridaMedida({ ruta = null, tools = null, fs = null, consola = false, log = null } = {}) {
  const sinkPrevio = getSink();
  const instalacion = instalarTelemetria({ ruta, tools, fs, consola, log });

  function _releer() {
    if (consola || !instalacion.instalado || !ruta || !fs || typeof fs.readFileSync !== "function") return null;
    let texto;
    try { texto = fs.readFileSync(ruta, "utf8"); } catch { return null; }
    return texto
      .split("\n")
      .filter((l) => l.trim().length)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((e) => e !== null);
  }

  function cerrar() {
    const eventos = _releer();
    setSink(sinkPrevio);   // se deja el estado como estaba ANTES de abrir esta corrida — nunca un efecto global
    return {
      instalacion,
      agregado: eventos !== null,
      resumen: resumenDeCorrida(eventos || []),
    };
  }

  return { instalacion, cerrar };
}
