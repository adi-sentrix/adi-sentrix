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
import { clientePerdiendoContribucion, inventarioInmovilizado, caidaDeVentas, oportunidadDePrecio } from "./asesoria.js";   // los 4 de ASESORÍA (owner 2026-09-01): 01 QUÉ · 02 DÓNDE · 03 QUÉ HACER PRIMERO
import { lecturaPorEje } from "./lecturaPorEje.js";   // playbook de FORMA: canal · marca · familia · bodega · SKU frenado
import { entidadPorPeriodo } from "./entidadPorPeriodo.js";   // playbook de FORMA: «cuánto me compró X el último mes» con serie REAL (la bloqueada es del puente)
import { proyeccionDeclarada } from "./proyeccionDeclarada.js";   // playbook de FORMA: «crezco 3%» · «proyecta +4%» · «reducir 2pp la carga» — con el MISMO detector que el juez P1
import { cobranza } from "./cobranza.js";   // playbook del COBRO: «quién me debe» · «crédito vs contado» — la misma mesa que la pestaña
import { limiteHonesto } from "./limiteHonesto.js";   // certificación (owner 2026-09-02): el eje NO disponible se declara con la razón del dato + alternativa
import { sintesisEjecutiva } from "./sintesisEjecutiva.js";   // certificación (owner 2026-09-02): los 3 riesgos del directorio, por materialidad

/** el registro. Agregar un playbook es agregar UNA línea acá y su archivo con el patrón de arriba.
 *  El ORDEN es la precedencia: margen-en-riesgo primero (una pregunta de margen es de margen aunque diga
 *  «perdiendo»); los 4 de ASESORÍA después y ANTES de lectura-por-eje («cómo libero el capital frenado» nombra
 *  el eje frenado — sin esta precedencia la lista simple taparía la asesoría; la disjunción con las preguntas
 *  de lectura es léxica y está medida en el gate); lectura-por-eje, entidad-por-período (su detector es el del
 *  puente, y el bucle resuelve el puente ANTES de llegar acá), proyección-declarada (los anteriores se retiran
 *  ante «simula/proyecta/ponele»), cobranza, y al final los DOS de la certificación (limite-honesto ·
 *  sintesis-ejecutiva): sus preguntas no tienen dueño previo — nadie de arriba las toma (medido), así que ir
 *  últimos garantiza que no le quitan un turno a nadie. */
export const PLAYBOOKS = [margenEnRiesgo, clientePerdiendoContribucion, inventarioInmovilizado, caidaDeVentas, oportunidadDePrecio, lecturaPorEje, entidadPorPeriodo, proyeccionDeclarada, cobranza, limiteHonesto, sintesisEjecutiva];

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

/* ── PASOS Y PROMESAS QUE PUEDEN DEPENDER DE LA PREGUNTA (2026-09-01) ───────────────────────────────────────
 * POR QUÉ: con `pasos` estático, «lectura por eje» necesitaba SEIS playbooks —uno por canal, marca, familia,
 * bodega, condición, punto de venta— en vez de uno. Medido por el supervisor sobre las 28 preguntas de la
 * certificación: 19 quedaban sin camino garantizado, y se agrupan por FORMA (lectura por eje · entidad×período ·
 * proyección · síntesis), no por tema. Tres playbooks de forma cubren 18 de esos 19; siete de tema habrían
 * cubierto menos.
 *
 * ⚠️ LO QUE **NO** CAMBIA, y es la línea que no se cruza: `cuandoAplica` sigue siendo LÉXICO y determinístico.
 * La función de pasos elige la HERRAMIENTA según el eje que el detector ya identificó — jamás según
 * comprensión. Un playbook que decidiera sus pasos «entendiendo» la pregunta sería el prompt genérico que el
 * owner rechazó, con otro nombre.
 *
 * `obligatorias` también puede depender de la pregunta: si los pasos cambian con el eje, la promesa que se
 * verifica tiene que cambiar con ellos — si no, no se puede comprobar y el playbook prometería a ciegas. La
 * regla de retiro es la misma de siempre: falta una fig → se retira sin ruido.
 *
 * Los dos resuelven en UN SOLO lugar para que nadie los desenvuelva dos veces con criterios distintos. */
const _resolver = (campo, pregunta, porDefecto) => {
  if (typeof campo === "function") {
    try { const r = campo(String(pregunta || "")); return Array.isArray(r) ? r : porDefecto; } catch { return porDefecto; }
  }
  return Array.isArray(campo) ? campo : porDefecto;
};
/** los pasos de ESTE turno: Array (los de siempre) o función de la pregunta. */
export function pasosDe(pb, pregunta) { return _resolver(pb && pb.pasos, pregunta, []); }
/** las figs que el playbook promete para ESTE turno — mismo contrato que `pasos`. */
export function obligatoriasDe(pb, pregunta) { return _resolver(pb && pb.obligatorias, pregunta, []); }

/** las figs que el playbook PROMETIÓ, presentes de verdad en la boleta acumulada. */
export function promesasCumplidas(pb, figs, pregunta) {
  const obligatorias = obligatoriasDe(pb, pregunta);
  if (!pb || !obligatorias.length) return false;
  const labels = (Array.isArray(figs) ? figs : []).map((f) => String((f && f.label) || ""));
  return obligatorias.every((re) => labels.some((l) => re.test(l)));
}

/** el bloque que viaja al cerebro cuando el playbook está activo: el método, no un ánimo.
 *  Byte-estable por playbook (prefijo cacheable: el texto no cambia turno a turno). */
export function doctrinaDelPlaybook(pb, pregunta) {
  if (!pb) return "";
  return [
    `[PROCEDIMIENTO — no es el usuario] Este turno sigue el playbook «${pb.nombre}». Sus pasos YA se ejecutaron y sus resultados están arriba:`,
    ...pasosDe(pb, pregunta).map((p) => `- ${p.tool} → ${p.para}`),
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
