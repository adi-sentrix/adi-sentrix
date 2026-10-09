/* === scripts/medicion-anfitrion/serie-ab.mjs · LA SERIE A/B: UN CORPUS SELLADO, CUATRO CORRIDAS (A×2 + B×2) ═══════════════════════════════════════════════
 * Un corpus sellado se QUEMA al abrirse (`sellar.mjs`): «un catálogo usado no se vuelve a abrir». El experimento pareado (`_ADI_DISENO_ALCANCE_DE_LO_ENTREGADO.md` §6.2)
 * necesita correr el MISMO corpus cuatro veces. La excepción es explícita y acotada, y vive junto al sello:
 *
 *   node scripts/medicion-anfitrion/arnes.mjs … --serie-ab=<nombre> --brazo=A|B --repeticion=1|2 --sello=<SELLO.json>
 *
 *   · la PRIMERA corrida de la serie quema el sello como siempre y deja `SERIE-AB.json` al lado del sello: la serie, la huella del corpus, la huella del código y las
 *     cuatro corridas planeadas (A·1, A·2, B·1, B·2);
 *   · cada corrida siguiente de ESA serie y ESE corpus (misma huella sha256) puede abrirlo sin `--reanudar`, si (i) la celda (brazo, repetición) está planeada y no se corrió
 *     ya, (ii) no es la quinta, (iii) nadie más quemó el sello (el sello sigue siendo la prueba: `leidoPor` es el de la serie), y (iv) el CÓDIGO es el de la primera corrida
 *     (si cambió, A y B no serían comparables);
 *   · fuera de una serie A/B nada de esto corre: el corpus usado se rechaza como hoy.
 * Cero red, cero LLM. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export const FORMATO_DE_LA_SERIE = "serie-ab/v1";
export const CORRIDAS_DE_LA_SERIE = Object.freeze([
  Object.freeze({ brazo: "A", repeticion: 1 }), Object.freeze({ brazo: "A", repeticion: 2 }),
  Object.freeze({ brazo: "B", repeticion: 1 }), Object.freeze({ brazo: "B", repeticion: 2 }),
]);
export const REPETICIONES_VALIDAS = Object.freeze([1, 2]);
/** SERIE-AB.json junto al sello; si el sello no se llama SELLO.json (varios corpus en una misma carpeta), `<sello sin .json>.SERIE-AB.json`: una serie es de UN sello. */
export const rutaDeLaSerie = (rutaSello) => { const nombre = basename(rutaSello); return join(dirname(rutaSello), nombre === "SELLO.json" ? "SERIE-AB.json" : `${nombre.replace(/\.json$/i, "")}.SERIE-AB.json`); };
export const marcaDeLaSerie = (nombre) => `serie-ab:${nombre}`;
const _celda = (c) => `${c.brazo}·${c.repeticion}`;

export function leerSerie(ruta) { return existsSync(ruta) ? JSON.parse(readFileSync(ruta, "utf8")) : null; }
function _guardar(ruta, serie) { mkdirSync(dirname(ruta), { recursive: true }); writeFileSync(ruta, JSON.stringify(serie, null, 2)); }

/** nuevaSerie({ nombre, corpusId, corpusSha256, codigoSha256, ahora }) → el objeto de la serie (sin corridas todavía). */
export function nuevaSerie({ nombre, corpusId, corpusSha256, codigoSha256, ahora }) {
  return { formato: FORMATO_DE_LA_SERIE, nombre, corpusId, corpusSha256, codigoSha256, leidoPor: marcaDeLaSerie(nombre), planeadas: CORRIDAS_DE_LA_SERIE.map((c) => ({ ...c })), corridas: [], creadaEn: ahora() };
}

/** autorizarCorrida({ serie, nombre, brazo, repeticion, corpusSha256, sello, codigoSha256, reanudar }) → { ok, motivo? }
 *  Las reglas de una corrida que NO es la primera de la serie (la primera la autoriza el quemado normal del sello). */
export function autorizarCorrida({ serie, nombre, brazo, repeticion, corpusSha256, sello, codigoSha256, reanudar = false }) {
  if (!serie || serie.formato !== FORMATO_DE_LA_SERIE) return { ok: false, motivo: "la serie A/B no existe o su formato no es el esperado" };
  if (serie.nombre !== nombre) return { ok: false, motivo: `este corpus pertenece a la serie «${serie.nombre}», no a «${nombre}»: otra serie no puede abrirlo` };
  if (serie.corpusSha256 !== corpusSha256) return { ok: false, motivo: "la huella sha256 del corpus no es la de la serie" };
  if (!sello || sello.leido !== true || sello.leidoPor !== serie.leidoPor) return { ok: false, motivo: `el sello no lo quemó la serie «${serie.nombre}» (leidoPor = ${JSON.stringify(sello && sello.leidoPor)}): alguien más abrió el corpus y la serie ya no es a ciegas` };
  const plan = serie.planeadas.find((c) => c.brazo === brazo && c.repeticion === repeticion);
  if (!plan) return { ok: false, motivo: `la celda ${brazo}·${repeticion} no está entre las cuatro planeadas (${serie.planeadas.map(_celda).join(", ")})` };
  const hecha = serie.corridas.find((c) => c.brazo === brazo && c.repeticion === repeticion);
  if (hecha && !reanudar) return { ok: false, motivo: `la celda ${brazo}·${repeticion} ya corrió (${hecha.corridaId}): no se repite; para continuar una interrumpida usá --reanudar con la misma --salida` };
  if (!hecha && serie.corridas.length >= serie.planeadas.length) return { ok: false, motivo: `la serie ya tiene sus ${serie.planeadas.length} corridas: no hay quinta corrida` };
  if (serie.codigoSha256 !== codigoSha256) return { ok: false, motivo: "el CÓDIGO cambió desde la primera corrida de la serie: A y B no serían comparables (el único cambio permitido entre corridas es el brazo)" };
  return { ok: true };
}

/** registrarCorrida(ruta, serie, { brazo, repeticion, corridaId, salida, ahora }) → anota la celda (idempotente para la misma celda y corrida). */
export function registrarCorrida(ruta, serie, { brazo, repeticion, corridaId, salida, ahora }) {
  const ya = serie.corridas.find((c) => c.brazo === brazo && c.repeticion === repeticion);
  if (ya) { ya.corridaId = corridaId; ya.salida = salida; ya.reanudadaEn = ahora(); }
  else serie.corridas.push({ brazo, repeticion, corridaId, salida, iniciadaEn: ahora() });
  _guardar(ruta, serie);
  return serie;
}
export function guardarSerie(ruta, serie) { _guardar(ruta, serie); return serie; }
