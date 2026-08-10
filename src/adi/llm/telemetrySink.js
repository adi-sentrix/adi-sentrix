/* === src/adi/llm/telemetrySink.js · EL DESTINO REAL DE LA TELEMETRÍA (owner 2026-08-10) ======================
 *
 * POR QUÉ EXISTE. `telemetry.js` mide desde el 2026-08-10 y está cableada en PLAN y NARRAR, pero `setSink` sólo
 * se invocaba desde los gates: en uso real no se registraba NADA. O sea que la certificación pagada anterior
 * gastó y no se pudo saber cuántas llamadas fueron, con qué modelo, ni por qué reintentaron — exactamente lo que
 * la telemetría existía para responder. Un instrumento sin destino es un instrumento apagado.
 *
 * QUÉ ES: un sink de ARCHIVO, JSONL, append-only. Una línea por evento, un objeto por línea. Se lee con cualquier
 * cosa (jq, node, una hoja de cálculo) y sobrevive al proceso, que es lo que "persistente" tiene que significar
 * para poder auditar una corrida después de que terminó.
 *
 * ── LOS CANDADOS, y son candados, no convenciones ─────────────────────────────────────────────────────────────
 * 1. SEGUNDA VALIDACIÓN. `emit` ya pasa cada evento por `_limpio`, pero este sink NO confía en eso: vuelve a
 *    filtrar contra la lista blanca antes de escribir. Si alguien llamara al sink directo —un gate, un script, un
 *    caller futuro— el disco sigue sin ver una clave que no esté declarada.
 * 2. NUNCA LANZA. Un fallo de escritura (disco lleno, permisos, FS de sólo lectura) no puede tumbar un turno del
 *    producto. Se cuenta el descarte y se sigue: `estadisticas()` lo hace visible en vez de esconderlo.
 * 3. APAGADO POR DEFECTO. Sin `ADI_TELEMETRY_FILE` no se instala nada y el comportamiento es idéntico al de hoy.
 *    Encenderlo es una decisión explícita del host, nunca un efecto de importar este módulo.
 * 4. TOPE DE TAMAÑO. El archivo se rota al superar el máximo (una sola generación, `.1`). Un instrumento que
 *    llena el disco del server se termina apagando, y un instrumento apagado es el problema que esto resuelve.
 * 5. FALLA CERRADA EN SERVERLESS. Si el destino no es escribible, no se instala: se prefiere no registrar nada
 *    —y decirlo— antes que registrar en un /tmp efímero que se borra con el isolate y da la falsa sensación de
 *    tener evidencia. Ver la nota de DESTINO al final.
 *
 * PROHIBIDO EN DISCO, y esto no cambia acá: prompts, respuestas, nombres de entidad, cifras y argumentos de tool.
 * La lista blanca de `telemetry.js` es la que manda; este archivo la vuelve a aplicar, no la amplía.
 */
import { CAMPOS_TELEMETRIA, setSink, setToolsDeclaradas, getSink } from "./telemetry.js";

export const TELEMETRIA_MAX_BYTES = 5 * 1024 * 1024;   // 5 MB · ~50.000 eventos, muy por encima de cualquier corrida

// _soloDeclarado(ev) → copia con EXCLUSIVAMENTE las claves de la lista blanca. Segundo candado (ver arriba).
export function _soloDeclarado(ev) {
  const o = {};
  if (!ev || typeof ev !== "object") return o;
  for (const k of CAMPOS_TELEMETRIA) if (ev[k] !== undefined) o[k] = ev[k];
  return o;
}

/* crearSinkArchivo(ruta, { fs, maxBytes }) → { sink, estadisticas }
 * `fs` se inyecta para que el gate pueda certificar la rotación y el fallo de escritura sin tocar el disco real.
 * `ts` NO se toma de Date.now() acá: el evento ya trae lo que tiene que traer, y agregarle una marca de tiempo
 * propia sería un campo fuera de la lista blanca. El orden de las líneas ES el orden de los hechos. */
export function crearSinkArchivo(ruta, { fs = null, maxBytes = TELEMETRIA_MAX_BYTES } = {}) {
  let escritos = 0, descartados = 0, rotaciones = 0;
  const _fs = fs;
  const sink = (ev) => {
    try {
      const limpio = _soloDeclarado(ev);
      const linea = JSON.stringify(limpio) + "\n";
      let tam = 0;
      try { tam = _fs.statSync(ruta).size; } catch { tam = 0; }
      if (tam + linea.length > maxBytes) {
        try { _fs.renameSync(ruta, `${ruta}.1`); rotaciones++; } catch { /* si no se puede rotar, se sigue escribiendo */ }
      }
      _fs.appendFileSync(ruta, linea, "utf8");
      escritos++;
    } catch {
      descartados++;   // NUNCA lanza: un fallo de telemetría no puede tumbar un turno
    }
  };
  return { sink, estadisticas: () => ({ escritos, descartados, rotaciones, ruta }) };
}

/* instalarTelemetria({ ruta, tools, fs }) → { instalado, motivo, estadisticas } · idempotente y explícito.
 * El host decide DÓNDE; este módulo no adivina un destino ni lo crea en un directorio que no le pidieron. */
export function instalarTelemetria({ ruta = null, tools = null, fs = null } = {}) {
  if (!ruta) return { instalado: false, motivo: "sin destino declarado (ADI_TELEMETRY_FILE vacío)" };
  if (!fs) return { instalado: false, motivo: "sin acceso a archivos en este entorno" };
  // ESCRITURA COMPROBADA, NO SUPUESTA: si el destino no admite un append, no se instala. Falla cerrada.
  try { fs.appendFileSync(ruta, "", "utf8"); }
  catch (e) { return { instalado: false, motivo: `destino no escribible: ${(e && e.code) || "error"}` }; }
  const { sink, estadisticas } = crearSinkArchivo(ruta, { fs });
  setSink(sink);
  // las tools se DECLARAN desde el registro real del motor (mismo patrón que setSink: el host decide, telemetry.js
  // no adivina). Sin registro, el campo `tools` no sale — falla cerrada, ver telemetry.js.
  if (Array.isArray(tools) && tools.length) setToolsDeclaradas(tools);
  return { instalado: true, motivo: null, estadisticas };
}

export function telemetriaInstalada() { return !!getSink(); }

/* ── DESTINO · lo que hay que saber antes de una corrida pagada ────────────────────────────────────────────────
 * `handlePlan`/`handleNarrateC` emiten DESDE EL GATEWAY, así que la telemetría de las dos llamadas pagadas se
 * escribe donde corre el gateway, no donde corre quien pregunta:
 *   · self-host (`npm start`, server.js): el gateway corre EN ESTE proceso → el archivo queda en este disco. Es
 *     el modo en que una certificación es auditable de punta a punta.
 *   · serverless (Vercel): el FS es efímero y de sólo lectura salvo /tmp, que se borra con el isolate. Acá el
 *     sink NO se instala (falla cerrada) y la corrida NO deja evidencia de las dos llamadas del proveedor. Si la
 *     certificación se corre contra el gateway desplegado, eso hay que resolverlo ANTES: o se corre contra el
 *     self-host, o el destino pasa a ser un servicio externo — decisión del owner, no de este archivo.
 * El batch determinístico emite del lado del cliente y es gratis; su telemetría queda donde corra el cliente. */
