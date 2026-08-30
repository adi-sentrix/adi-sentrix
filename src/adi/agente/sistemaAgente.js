/* === src/adi/agente/sistemaAgente.js · EL SYSTEM DEL AGENTE (F2 esqueleto · F3 calibra la letra) =============
 *
 * Núcleo CHICO y FIJO (F1 §4/§10): persona (la de siempre, `ADI_PERSONA` — una sola personalidad en el
 * producto) + invariantes pocas y duras + el MAPA del dato. La doctrina por herramienta llega bajo demanda en
 * F2b; la LETRA de las invariantes se calibra en F3 contra los borradores guardados — esta versión existe para
 * que el bucle sea cableable y gateable, no es la final.
 *
 * DETERMINÍSTICO por tenant+escenario (persona fija · invariantes fijas · mapa determinístico) — el prefijo
 * cacheable del proveedor, la misma disciplina de naturalPrompt. */
import { ADI_PERSONA } from "../oracle/persona.js";
import { mapaDelDato } from "./mapaDelDato.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // colapso del eje: el agente lee el MISMO dato que la pantalla

/* Las invariantes del agente — pocas y duras (owner). La letra fina es de F3; el CONTENIDO es el acordado. */
export const INVARIANTES_AGENTE = [
  "Cifras SOLO de los resultados de tus herramientas, VERBATIM — jamás recalculadas, redondeadas ni inventadas.",
  "Declara el período y el alcance de lo que afirmas.",
  "Registro formal (LatAm, sin chilenismos): capital, benchmark, inmovilizado.",
  "Si el dato no está, declina en UNA línea diciendo qué falta, con la cifra más cercana que sí tengas.",
  "Un supuesto del usuario JAMÁS se mezcla con lo verificado sin su etiqueta.",
  "Proporcionalidad real: pregunta puntual → respuesta primero y una línea de lectura; panorama → el arco completo.",
].map((s, i) => `${i + 1}. ${s}`).join("\n");

/** sistemaDelAgente(scenario) → { fijo } · el segmento estable del system (persona + invariantes + mapa). */
export function sistemaDelAgente(scenario = ESCENARIO_INICIAL) {
  const fijo = [
    ADI_PERSONA,
    "",
    "INVARIANTES — se cumplen siempre, sin excepción:",
    INVARIANTES_AGENTE,
    "",
    "Tienes herramientas. Pide las que necesites (varias en paralelo si ayuda) y responde cuando tengas el dato. Si una herramienta declara un límite, ese límite ES la respuesta honesta.",
    "",
    mapaDelDato(scenario),
  ].join("\n");
  return { fijo };
}
