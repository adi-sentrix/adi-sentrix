/* === src/adi/oracle/hiloBudget.js · EL HILO COMPLETO, CON PRESUPUESTO (owner 2026-08-13, Paso 1 "ADI pierde el hilo") ===
 * EL DEFECTO, medido en producción: dos embudos idénticos cortaban cada mensaje del hilo en 220 caracteres —
 * buildPlanUserMessage (planPrompt.js) y hiloReciente (narrationContract.js). De una respuesta real de ADI de
 * 1.191 chars (prosa + tabla de 8 clientes) sobrevivían 220: el 81,5% se descartaba, y un "explícame eso" del
 * turno siguiente no tenía a qué referirse. El texto completo SÍ existía en el caller (messagesRef de ChatADI
 * viaja entero en `history`) — el recorte era nuestro, no del dato.
 *
 * LA POLÍTICA, una sola para los dos embudos (por eso vive acá y no copiada en cada uno):
 *   · El ÚLTIMO turno de ADI viaja SIEMPRE completo — es donde vive la tabla que "eso" señala. (El turno actual
 *     del usuario ya viaja completo por su propio canal: `text`/`pregunta`, nunca pasó por el hilo.)
 *   · Hacia atrás se agregan turnos COMPLETOS mientras quepan en el presupuesto; el que no cabe entero se resume
 *     a su PRIMERA ORACIÓN + "…" — nunca un corte a mitad de cifra (la frontera de oración ignora el punto
 *     decimal/de miles: "34.2%" y "$4.207.331" no cortan).
 *   · La ventana por CANTIDAD no se toca: los callers siguen con su slice(-8)/slice(-4) — ampliar turnos es una
 *     decisión del owner, no de este módulo.
 *
 * LA PRIORIDAD DE CAMPO SE INVIERTE: antes era `m.gist || m.text` — el gist (digest de ~160 chars que arma
 * conversation.js) era la ADAPTACIÓN al corte de 220, y con presupuesto real es el que lo reintroduciría por la
 * puerta de atrás. Ahora `m.text || m.gist`: el texto completo manda; el gist queda como fallback para los
 * callers/gates viejos que mandan turnos SOLO con gist (verificado: en producción los mensajes traen `text`).
 */

// PRESUPUESTOS INICIALES (owner 2026-08-13). En caracteres (≈4 chars/token, la convención de planPrompt.js):
// ~2.000 tokens para el hilo de PLAN y ~1.500 para el de NARRAR — contra un system de ~9.900 tokens, marginal.
export const PLAN_HILO_PRESUPUESTO_CHARS = 8000;
export const NARRAR_HILO_PRESUPUESTO_CHARS = 6000;
// Tope del RESUMEN de un turno que no cupo entero: si su primera oración es más larga que esto, se corta en el
// último espacio (nunca dentro de una cifra) — mantiene acotado el total aunque el turno abra con una oración
// kilométrica o con una tabla sin puntuación.
export const RESUMEN_TURNO_MAX_CHARS = 280;

// textoDeTurno(m) → el texto que representa al turno en el hilo. `text` completo manda; `gist` es SOLO fallback
// (ver la nota de cabecera). Lanza sobre un turno null — el MISMO contrato que tenían los dos embudos (un
// `history: [null]` hostil se cuenta en el gateway como "el turno no llegó al proveedor", no se disimula acá).
export function textoDeTurno(m) {
  return String(m.text || m.gist || "");
}

// primeraOracion(s) → la primera oración completa + "…" (o el texto entero si ya es una sola oración corta).
// La frontera es . ! ? seguido de espacio/fin — un punto ENTRE dígitos no corta ("$4.207.331", "34.2%") — o un
// salto de línea (una tabla markdown nunca aporta su segunda fila al resumen).
export function primeraOracion(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  const idx = t.search(/[.!?](?=\s|$)|\r|\n/);
  let frase = idx < 0 ? t : (/[.!?]/.test(t[idx]) ? t.slice(0, idx + 1) : t.slice(0, idx));
  if (frase.length > RESUMEN_TURNO_MAX_CHARS) {
    const corte = frase.lastIndexOf(" ", RESUMEN_TURNO_MAX_CHARS);
    frase = frase.slice(0, corte > 0 ? corte : RESUMEN_TURNO_MAX_CHARS);
  }
  return frase === t ? t : `${frase}…`;
}

// aplicarPresupuestoHilo(turnos, presupuesto) → [{ role, dijo, completo }] en el MISMO orden de entrada.
// Se recorre del más NUEVO al más VIEJO: el último turno de ADI entra entero SIEMPRE (aunque él solo exceda el
// presupuesto — nunca se trunca la tabla que el deíctico señala); los demás entran enteros mientras quepan, y el
// resto se resume — así el recorte empieza por lo más viejo, que es lo menos probable de ser referido.
// El total queda acotado por presupuesto + los resúmenes (≤ RESUMEN_TURNO_MAX_CHARS+1 cada uno) + el último turno
// de ADI si él solo excede el presupuesto.
export function aplicarPresupuestoHilo(turnos, presupuesto) {
  const h = Array.isArray(turnos) ? turnos : [];
  const n = h.length;
  let ultimoAdi = -1;
  for (let i = n - 1; i >= 0; i--) {
    const r = h[i] && h[i].role;
    if (r && r !== "user") { ultimoAdi = i; break; }
  }
  const out = new Array(n);
  let usado = 0;
  for (let i = n - 1; i >= 0; i--) {
    const m = h[i];
    const texto = textoDeTurno(m);
    const entero = i === ultimoAdi || usado + texto.length <= presupuesto;
    const dijo = entero ? texto : primeraOracion(texto);
    usado += dijo.length;
    out[i] = { role: m.role, dijo, completo: entero };
  }
  return out;
}
