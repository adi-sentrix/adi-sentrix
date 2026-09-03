/* === src/adi/agente/playbooks/indiceEntidades.js · ¿LA PREGUNTA NOMBRA A ALGUIEN? ==========================
 *
 * Un solo lugar para responder eso, y dos playbooks lo usan al revés:
 *   · los que responden por EL NEGOCIO ENTERO (la foto, la lectura de ventas) se RETIRAN si hay un nombre —
 *     contestar el total a quien preguntó por Falabella es cambiarle la pregunta, y eso ya pasó una vez
 *     («cómo viene Falabella» lo secuestró la foto, censo 2026-09-04);
 *   · la FICHA solo aplica si hay un nombre, y necesita además CUÁL es, exacto como lo declara el índice,
 *     porque es el argumento con el que le pide el cuadro al motor.
 *
 * Vive aparte a propósito: dos copias del mismo guardia son dos verdades, y la primera vez que una se corrige
 * sin la otra el defecto vuelve por el lado que nadie miró.
 *
 * ⚠️ LOS NOMBRES DE UNA Y DOS LETRAS. Buscarlos como palabra suelta caza dentro de frases corrientes; ignorarlos
 * deja un agujero medido: «cómo viene LG» se lo llevaba la foto del negocio porque «LG» tiene dos caracteres y
 * el guardia lo salteaba. La regla que sale de esos dos hechos: los cortos se buscan SOLO con su capitalización
 * declarada (LG sí, «lg» no), que es como el usuario escribe una marca y no como escribe una preposición. */

import { axisEntityNames } from "../../oracle/entityIndex.js";

const _EJES = ["cliente", "sku", "marca", "familia", "bodega", "canal"];
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const _CORTO = 3;   // menos de esto exige capitalización exacta

/**
 * La entidad que la pregunta nombra, o null.
 * Devuelve `{ nombre, eje }` con el nombre EXACTO del índice (el que las herramientas aceptan).
 * Si nombra más de una, gana la más larga: «LG-DRYER8KG» antes que «LG».
 */
export function entidadNombrada(pregunta) {
  const q = String(pregunta || "");
  if (!q.trim()) return null;
  let mejor = null;
  for (const eje of _EJES) {
    let nombres = [];
    try { nombres = axisEntityNames(eje) || []; } catch { nombres = []; }
    for (const n of nombres) {
      const nombre = String(n);
      if (!nombre) continue;
      const corto = nombre.length < _CORTO;
      const re = new RegExp(`(?<![\\w-])${_esc(nombre)}(?![\\w-])`, corto ? "" : "i");
      if (!re.test(q)) continue;
      if (!mejor || nombre.length > mejor.nombre.length) mejor = { nombre, eje };
    }
  }
  return mejor;
}

/** true si la pregunta menciona el nombre de alguna entidad declarada en el índice del tenant. */
export function nombraEntidad(pregunta) {
  return entidadNombrada(pregunta) !== null;
}
