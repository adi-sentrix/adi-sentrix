/* === src/adi/agente/playbooks/indiceEntidades.js · ¿LA PREGUNTA NOMBRA A ALGUIEN? ==========================
 *
 * Un solo guardia para los playbooks que responden por EL NEGOCIO ENTERO (la foto, la lectura de ventas): si
 * la pregunta nombra una entidad del índice, el turno no es suyo — contestar el total del negocio a quien
 * preguntó por Falabella es cambiarle la pregunta, y eso ya pasó una vez («cómo viene Falabella» lo secuestró
 * la foto, censo 2026-09-04). La regla del proyecto: un secuestro es más caro que un hueco.
 *
 * Vive aparte a propósito: dos copias del mismo guardia son dos verdades, y la primera vez que una se corrige
 * sin la otra el defecto vuelve por el lado que nadie miró. */

import { axisEntityNames } from "../../oracle/entityIndex.js";

const _EJES = ["cliente", "sku", "marca", "familia", "bodega", "canal"];
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** true si la pregunta menciona el nombre de alguna entidad declarada en el índice del tenant. */
export function nombraEntidad(pregunta) {
  const q = String(pregunta || "");
  if (!q.trim()) return false;
  for (const eje of _EJES) {
    let nombres = [];
    try { nombres = axisEntityNames(eje) || []; } catch { nombres = []; }
    for (const n of nombres) {
      /* nombres de 1-2 letras no se buscan: cazan dentro de palabras corrientes y el falso positivo acá
       * cuesta un turno entero (el playbook se retira y la pregunta cae al genérico). */
      if (String(n).length < 3) continue;
      if (new RegExp(`\\b${_esc(n)}\\b`, "i").test(q)) return true;
    }
  }
  return false;
}
