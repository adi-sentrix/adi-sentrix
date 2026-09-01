/* === src/adi/agente/playbooks/registro.js · EL REGISTRO DE PLAYBOOKS (owner 2026-08-31) ======================
 *
 * LA PALABRA DEL OWNER, textual: «El agente queda OFF hasta resolver esa última conducta: responder con toda
 * la evidencia disponible antes de rescatar o pedir aclaración. Quiero trabajar eso como criterio ESTRUCTURAL,
 * idealmente apoyado en playbooks, no con prompts genéricos de "sé menos cauteloso".»
 *
 * POR QUÉ UN PLAYBOOK Y NO UN PROMPT. Un prompt pide coraje; un playbook declara un MÉTODO. Cuando el playbook
 * aplica, sus pasos se ejecutan ANTES de la primera llamada al cerebro: la evidencia ya está en la boleta
 * cuando el cerebro decide, así que la opción «rescato sin mirar» deja de existir en el camino. Y si el cerebro
 * igual falla, el playbook tiene un ENTREGABLE determinístico compuesto de esa misma boleta — el precedente
 * exacto es el puente de entidad×período: un composer que responde donde el modelo erraba, verificado por el
 * MISMO muro. Nada de esto afloja la disciplina: guardC y la boleta no se tocan.
 *
 * EL PATRÓN (lo que hace barato el segundo playbook — el punto del registro):
 *   nombre        · el id del playbook, corto y estable.
 *   cuandoAplica  · (pregunta) → boolean. DETERMINÍSTICO (léxico, jamás comprensión). Ante la duda, false:
 *                   un playbook que se activa de más secuestra turnos que no le tocan.
 *   pasos         · [{ tool, args, para }] — las herramientas que se ejecutan SIEMPRE, con el para-qué escrito.
 *                   `para` no es decoración: viaja al cerebro como el procedimiento que se está siguiendo.
 *   obligatorias  · [regex de label] — las figs que el playbook PROMETE traer. Si alguna falta, el playbook no
 *                   promete nada y se retira sin ruido (el dato de ese tenant no lo sostiene).
 *   entregable    · la forma de la respuesta, en palabras, para el cerebro.
 *   componer      · ({ figs }) → texto | null. El entregable DETERMINÍSTICO, con cifras verbatim de la boleta.
 *   listaNotarial · (texto, { figs }) → [{ regla, multa }]. Chequeos MECÁNICOS de SUS promesas, que se SUMAN
 *                   al muro (jamás lo reemplazan ni lo aflojan) y solo corren cuando el playbook está activo.
 *
 * PURO · determinístico · sin red. Cada playbook trae sus carnadas en el gate. */

import { margenEnRiesgo } from "./margenEnRiesgo.js";

/** el registro. Agregar un playbook es agregar UNA línea acá y su archivo con el patrón de arriba. */
export const PLAYBOOKS = [margenEnRiesgo];

/** playbookPara(pregunta) → el playbook que aplica, o null. El PRIMERO que declare aplicar (orden del registro
 *  = precedencia declarada); jamás dos a la vez, para que el procedimiento del turno sea uno solo y auditable. */
export function playbookPara(pregunta) {
  const q = String(pregunta || "").trim();
  if (!q) return null;
  for (const pb of PLAYBOOKS) {
    try { if (pb && typeof pb.cuandoAplica === "function" && pb.cuandoAplica(q)) return pb; } catch { /* un detector roto no secuestra el turno */ }
  }
  return null;
}

/** las figs que el playbook PROMETIÓ, presentes de verdad en la boleta acumulada. */
export function promesasCumplidas(pb, figs) {
  if (!pb || !Array.isArray(pb.obligatorias) || !pb.obligatorias.length) return false;
  const labels = (Array.isArray(figs) ? figs : []).map((f) => String((f && f.label) || ""));
  return pb.obligatorias.every((re) => labels.some((l) => re.test(l)));
}

/** el bloque que viaja al cerebro cuando el playbook está activo: el método, no un ánimo.
 *  Byte-estable por playbook (prefijo cacheable: el texto no cambia turno a turno). */
export function doctrinaDelPlaybook(pb) {
  if (!pb) return "";
  return [
    `[PROCEDIMIENTO — no es el usuario] Este turno sigue el playbook «${pb.nombre}». Sus pasos YA se ejecutaron y sus resultados están arriba:`,
    ...(pb.pasos || []).map((p) => `- ${p.tool} → ${p.para}`),
    "",
    `LO QUE TIENES QUE ENTREGAR: ${pb.entregable}`,
    "La evidencia ya está en la mano: respóndela. No pidas aclaración ni declines por falta de datos sobre lo que estos resultados ya cubren.",
    "Cada cifra, verbatim de los resultados. Localiza dónde está el problema; no afirmes por qué pasa si el dato no lo declara.",
  ].join("\n");
}

/** la lista notarial del playbook activo, con la forma de `vetosDeContrato` (regla + multa). */
export function vetosDelPlaybook(pb, texto, contexto) {
  if (!pb || typeof pb.listaNotarial !== "function") return [];
  try { return pb.listaNotarial(String(texto || ""), contexto || {}) || []; } catch { return []; }
}
