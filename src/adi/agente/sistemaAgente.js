/* === src/adi/agente/sistemaAgente.js · EL SYSTEM DEL AGENTE (F2 esqueleto · F3 calibra la letra) =============
 *
 * Núcleo CHICO y FIJO (F1 §4/§10): persona (la de siempre, `ADI_PERSONA` — una sola personalidad en el
 * producto) + invariantes pocas y duras + el MAPA del dato. La doctrina por herramienta llega bajo demanda en
 * F2b; la LETRA de las invariantes se calibra en F3 contra los borradores guardados — esta versión existe para
 * que el bucle sea cableable y gateable, no es la final.
 *
 * DETERMINÍSTICO por tenant+escenario (persona fija · invariantes fijas · mapa determinístico) — el prefijo
 * cacheable del proveedor, la misma disciplina de naturalPrompt. */
/* LA CARTA DEL ASESOR (owner 2026-09-03) reemplaza acá a `ADI_PERSONA` suelta — y NO es una segunda fuente de
 * carácter: la carta IMPORTA esa misma persona como su capítulo 1 y le suma el oficio (audiencia · cuándo
 * profundizar · cómo justifica · cómo suena · qué jamás). El agente recibe una sola cosa, entera. */
import { CARTA_DEL_ASESOR } from "./cartaAsesor.js";
import { mapaDelDato } from "./mapaDelDato.js";
import { PRINCIPIOS_ARCO, PRINCIPIOS_FORMA, PRINCIPIOS_RUTEO } from "./contratoAgente.js";   // F3 · la letra vive con su veto · [9] ruteo
import { lineaDeNombre } from "./preferenciaNombre.js";   // F3 · «llámame jc» — una línea, "" sin declaración
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // colapso del eje: el agente lee el MISMO dato que la pantalla

/* Las invariantes del agente — pocas y duras (owner). Letra F3, calibrada contra el corpus de exámenes. */
export const INVARIANTES_AGENTE = [
  "Cifras SOLO de los resultados de tus herramientas, VERBATIM — jamás recalculadas, redondeadas ni inventadas.",
  "Declara el período y el alcance de lo que afirmas.",
  "Registro formal (LatAm, sin chilenismos): capital, benchmark, inmovilizado.",
  "Si el dato no está, declina en UNA línea diciendo qué falta, con la cifra más cercana que sí tengas.",
  "Un supuesto del usuario JAMÁS se mezcla con lo verificado sin su etiqueta.",
  "Proporcionalidad real: pregunta puntual → respuesta primero y una línea de lectura; panorama → el arco completo.",
  // R6 del examen 1 (2026-08-31): T20 afirmó una limitación FALSA con 0 herramientas; en 24-28 pidió permiso
  // conversacional para lecturas internas. La letra lo dice y el bucle lo empuja (el empujón de R6).
  "Antes de afirmar un límite del dato o declinar, VERIFICA con una lectura — salvo que el mapa ya declare ese límite. Las lecturas internas no piden permiso: se ejecutan y se sirve el resultado.",
].map((s, i) => `${i + 1}. ${s}`).join("\n");

/** sistemaDelAgente(scenario) → { fijo } · el segmento estable del system (persona + invariantes + arco +
 *  forma + nombre + mapa). Byte-estable por tenant+nombre+dato — el prefijo cacheable del proveedor. */
export function sistemaDelAgente(scenario = ESCENARIO_INICIAL) {
  const nombre = lineaDeNombre();
  const fijo = [
    CARTA_DEL_ASESOR,
    "",
    "INVARIANTES — se cumplen siempre, sin excepción:",
    INVARIANTES_AGENTE,
    "",
    "EL ARCO — cómo se arma una respuesta:",
    PRINCIPIOS_ARCO,
    "",
    "LA FORMA:",
    PRINCIPIOS_FORMA,
    "",
    "RUTEO Y CÁLCULO:",
    PRINCIPIOS_RUTEO,
    ...(nombre ? ["", nombre] : []),
    "",
    "Tienes herramientas. Pide las que necesites (varias en paralelo si ayuda) y responde cuando tengas el dato. Si una herramienta declara un límite, ese límite ES la respuesta honesta.",
    "",
    mapaDelDato(scenario),
  ].join("\n");
  return { fijo };
}
