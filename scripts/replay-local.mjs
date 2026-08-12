/* === scripts/replay-local.mjs · LO QUE HACE FALTA PARA REPRODUCIR UNA CORRIDA PAGADA (owner 2026-08-12) ========
 *
 * POR QUÉ EXISTE, medido y no supuesto: el replay de la certificación de f4f2949 llegó a 24 de 25 turnos. El que
 * faltó —E6.t3— no se pudo reproducir porque su veredicto depende de `results`, y el corredor había guardado los
 * NOMBRES de las tools pero no sus argumentos: 0 de 57 calls traían `args`. Sin los argumentos hay que adivinar qué
 * entidad y qué porcentajes pidió cada call, y un replay con argumentos inventados no reproduce nada — certifica la
 * imaginación de quien lo escribe. Fue una falla de instrumentación, no del producto.
 *
 * QUÉ GUARDA: `call.args` y `results`, que es exactamente lo que falta para re-ejecutar las tools y reconstruir la
 * boleta de un turno sin volver a pagarle al proveedor.
 *
 * ── POR QUÉ VA SEPARADO DE LA TELEMETRÍA, y esto es la mitad del encargo ────────────────────────────────────────
 * La telemetría del gateway es SEGURA POR CONSTRUCCIÓN: emite vocabularios cerrados nuestros —nombres de tool,
 * `intent`, campos del contrato— y nunca texto del cliente. Eso es lo que la hace publicable.
 * `call.args` y `results` son lo contrario: traen nombres de cuentas, de SKU y cifras del negocio. Meterlos en la
 * telemetría convertiría un canal seguro en uno que filtra datos, y la única forma honesta de tener las dos cosas
 * es que sean DOS canales. Este archivo no importa `telemetry.js` ni le escribe nada: es un archivo local, en un
 * directorio ignorado por Git, que no sale de la máquina donde corrió la certificación.
 *
 * NO SE USA EN PRODUCCIÓN. Lo invoca el arnés de certificación, nunca el pipeline vivo.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

export const DIR_REPLAY = "fixtures/replay-local";

/* LA LÍNEA QUE `.gitignore` TIENE QUE CONTENER. Se exporta para que el gate la verifique contra el archivo real en
 * vez de confiar en que alguien se acordó: un directorio con datos de negocio que deja de estar ignorado es
 * exactamente el error que nadie nota hasta que ya se hizo push. */
export const REGLA_GITIGNORE = "/fixtures/replay-local/";

// los campos del turno que SÍ hacen falta para reproducirlo. Todo lo demás (texto del usuario, narración) ya vive
// en el fixture de la certificación; acá va sólo lo que faltaba.
export function armarRegistroDeTurno({ id, plan, results, scenario = null } = {}) {
  const calls = (plan && Array.isArray(plan.calls) ? plan.calls : []).map((c) => ({
    tool: (c && c.tool) || null,
    // LOS ARGS COMPLETOS, sin recortar: recortarlos reintroduce el problema que este archivo existe para cerrar.
    args: (c && c.args) || null,
  }));
  return {
    id: id || null,
    scenario,
    calls,
    // `results` tal cual lo devolvió el ejecutor: facts, boleta y coverage por call.
    results: (Array.isArray(results) ? results : []).map((r) => ({
      callId: (r && r.callId) || null,
      tool: (r && r.tool) || null,
      facts: (r && r.facts) || null,
      boleta: (r && Array.isArray(r.boleta)) ? r.boleta : [],
      coverage: (r && r.coverage) || null,
    })),
  };
}

// persistirCorrida(commit, turnos) → la ruta escrita. `commit` nombra el archivo para que dos corridas no se pisen.
export function persistirCorrida(commit, turnos, raiz = process.cwd()) {
  const dir = resolve(raiz, DIR_REPLAY);
  mkdirSync(dir, { recursive: true });
  const ruta = join(dir, `${commit || "sin-commit"}.json`);
  writeFileSync(ruta, JSON.stringify({ commit: commit || null, turnos: turnos || [] }, null, 2), "utf8");
  return ruta;
}
