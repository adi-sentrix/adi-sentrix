/* === src/adi/conocimiento/evaluarPertinencia.js · ¿LE IMPORTA HOY? (Business Knowledge v0.2, Parte A §1 + Parte B §1) ═
 * «Cada pieza declara con qué señal del Core se enciende... Si ninguna señal está presente en el libro del
 * turno, la pieza no se sirve aunque le corresponda por sector. La pieza nunca define qué es "alto" o "bajo":
 * lee el veredicto del Core.»
 *
 * evaluarPertinencia(pieza, tabla, perfil, pregunta) → { pertinente, entidades: [...], motivo }
 * Función PURA. Devuelve las ENTIDADES sobre las que la pieza se enciende (no un booleano): una pieza puede ser
 * pertinente para Lider y no para Falabella. Composición cerrada: `todo` (∧) · `alguno` (∨) · `no` (¬). Sin
 * aritmética, sin literales numéricos — eso lo cobra `validarPieza.js` ANTES de que una pieza llegue acá. */
import { evaluarPredicadoAtomico, ejeDelPredicado, predicadoValido } from "./predicados.js";

const _esNodo = (x) => x && typeof x === "object" && !Array.isArray(x);

/* el eje que un nodo de pertinencia recorre — el primer predicado atómico que encuentra dentro del árbol define
 * el eje (una pieza no mezcla cuenta y sku en el mismo nodo; si lo hiciera, el validador de esquema la rechaza
 * antes — acá, defensa en profundidad: el primer eje hallado gana). */
function _ejeDeNodo(nodo) {
  if (typeof nodo === "string") return ejeDelPredicado(nodo);
  if (!_esNodo(nodo)) return null;
  if (Array.isArray(nodo.todo)) { for (const h of nodo.todo) { const e = _ejeDeNodo(h); if (e) return e; } return null; }
  if (Array.isArray(nodo.alguno)) { for (const h of nodo.alguno) { const e = _ejeDeNodo(h); if (e) return e; } return null; }
  if (nodo.no != null) return _ejeDeNodo(nodo.no);
  return null;
}

/* evalúa un nodo de pertinencia para UNA entidad puntual (o sin entidad, para predicados de pregunta/periodo).
 * Devuelve true | false | null (null = "no se puede saber si se enciende" — conservador: no enciende). */
function _evalNodo(nodo, entidad, tabla, ctx) {
  if (typeof nodo === "string") {
    if (!predicadoValido(nodo)) return null;             // el validador ya debería haber rechazado esto — defensa en profundidad
    return evaluarPredicadoAtomico(nodo, entidad, tabla, ctx);
  }
  if (!_esNodo(nodo)) return null;
  if (Array.isArray(nodo.todo)) {
    const vs = nodo.todo.map((h) => _evalNodo(h, entidad, tabla, ctx));
    if (vs.some((v) => v === false)) return false;
    if (vs.some((v) => v === null)) return null;
    return true;
  }
  if (Array.isArray(nodo.alguno)) {
    const vs = nodo.alguno.map((h) => _evalNodo(h, entidad, tabla, ctx));
    if (vs.some((v) => v === true)) return true;
    if (vs.some((v) => v === null)) return null;
    return false;
  }
  if (nodo.no != null) {
    const v = _evalNodo(nodo.no, entidad, tabla, ctx);
    return v == null ? null : !v;
  }
  return null;
}

/** evaluarPertinencia(pieza, tabla, perfil, pregunta) → { pertinente, entidades, eje, motivo } */
export function evaluarPertinencia(pieza, tabla, perfil, pregunta = "") {
  const nodo = pieza && pieza.pertinencia;
  if (!nodo) return { pertinente: false, entidades: [], eje: null, motivo: "la pieza no declara pertinencia" };
  const ctx = { pregunta };
  const eje = _ejeDeNodo(nodo);

  // sin eje de entidad (solo predicados de pregunta/periodo, ej. "la pregunta es sobre margen"): un único
  // veredicto para la pieza entera, sin lista de entidades — el sujeto sigue siendo el sector (§3 del Marco A).
  if (!eje) {
    const v = _evalNodo(nodo, null, tabla, ctx);
    return { pertinente: v === true, entidades: [], eje: null, motivo: v === true ? "se enciende por la pregunta o el período, sin entidad puntual" : v === false ? "no se enciende: ninguna condición se cumple" : "no se puede saber si se enciende: falta al menos un predicado" };
  }

  const universo = eje === "cuenta" ? Object.keys((tabla && tabla.cuentas) || {}) : Object.keys((tabla && tabla.skus) || {});
  const encendidas = universo.filter((e) => _evalNodo(nodo, e, tabla, ctx) === true);
  return {
    pertinente: encendidas.length > 0,
    entidades: encendidas,
    eje,
    motivo: encendidas.length ? `se enciende en ${encendidas.length} de ${universo.length} ${eje === "cuenta" ? "cuentas" : "SKU"}` : `no se enciende en ninguna de las ${universo.length} ${eje === "cuenta" ? "cuentas" : "SKU"} evaluadas`,
  };
}
