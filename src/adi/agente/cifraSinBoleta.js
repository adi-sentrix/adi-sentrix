/* === src/adi/agente/cifraSinBoleta.js · EL JUEZ DEL TURNO QUE NO LEYÓ (certificación 2026-09-01) ============
 *
 * QUÉ CIERRA, medido en la corrida y reproducido offline: en el turno 7 salió a pantalla **$800K** sin que el
 * turno hubiera corrido una sola herramienta. La cifra no estaba en la boleta (vacía), ni en la re-cita, ni en
 * el dato. Pasó el muro igual, por la quinta fuente: `esCalculoDelCatalogo` autoriza una cifra si **existe
 * alguna cuenta del catálogo que la dé**, y con el pool del dato de una entidad nombrada eso es casi siempre
 * verdad. La cuenta exacta que la autorizó: `$17,9M × 4,5% = $805.500`. La oración afirmaba otra («2-3 puntos
 * de $19,4M», que da $388K–$582K). El muro pregunta si existe ALGUNA cuenta que dé el número, no si lo da la
 * cuenta que la frase dice hacer.
 *
 * Medido: con la boleta vacía, **21% de los montos inventados de esa magnitud pasan** (0% sin la quinta
 * fuente), y **39 de los 41 que pasan no están en el dato** — el 95% del permiso viene de la rama de cálculo.
 *
 * POR QUÉ ESTE JUEZ Y NO QUITARLE LA QUINTA FUENTE AL MURO. Se midió la otra vía primero: no pasar
 * `datoProyectado` con la boleta vacía apagaba **4 respuestas correctas por cada defecto muerto** (el
 * benchmark 30,1%, el conteo «13 clientes», la tabla del playbook, el YoY). Y no se puede afinar desde acá:
 * dentro de guardC la copia directa del dato y la rama de cálculo cuelgan del MISMO parámetro. guardC no se
 * toca. Así que este juez se SUMA —igual que `vetosDeContrato`—, ciego y determinístico.
 *
 * ⚠️ ACOTADO AL AGENTE (condición del supervisor, y del owner antes que él): este archivo vive en
 * `src/adi/agente/` y NADIE fuera del bucle del agente lo importa. El camino natural corre en producción y su
 * boleta está vacía SIEMPRE (`caminoNatural.js` arma el juez con `ledger: { figs: [] }` fijo): aplicarle esta
 * regla lo apagaría entero, no lo endurecería. Su gate vigila que no se importe desde ahí.
 *
 * LA REGLA, en una línea: con la boleta vacía, una cifra que no esté LITERAL en el dato, en la re-cita, en la
 * pregunta del usuario o en un cálculo declarado, no sale a pantalla. */

import { parseFigures } from "../boleta.js";
import { extraerCalculos } from "../oracle/narrationBlocks.js";   // el parser de la casa para el bloque [[CALCULO]] — jamás un segundo

/* ⚠️ EL HUECO DECLARADO · EL NÚMERO ESCRITO EN LETRAS. `parseFigures` empareja «2 puntos porcentuales» → 2pp y
 * «+4%» → 4%, pero **«tres por ciento» devuelve []**. Si el usuario escribe su supuesto en letras, su propia
 * cifra no se reconoce como suya y este juez la multa: ADI declina una respuesta que PODÍA dar. Cae del lado
 * seguro —multa de más, nunca de menos—, pero es un límite real y queda escrito acá y no en un chat: un límite
 * que solo vive en una conversación lo redescubre alguien dentro de tres meses como si fuera un bug.
 * No aparece en el corpus de exámenes. Si aparece en una corrida real, la salida es enseñarle a `parseFigures`
 * los números en letras, no aflojar este juez. */

/** las cifras que el bloque [[CALCULO]] declara — guardC ya las RECOMPUTÓ (y vetó con `calculo-no-verificable`
 *  las que no cerraban), así que si el texto llegó hasta acá con una, es una cuenta declarada Y verificada. Es
 *  el canal correcto para una cifra derivada: la que la oración DECLARA, no la que existe por casualidad en el
 *  pool combinatorio.
 *  ⚠️ SE USA `extraerCalculos`, EL PARSER DE LA CASA, no un regex propio: escribí uno y no emparejaba el
 *  formato real (`resultado=$104.0M`), así que el canal quedaba muerto y el turno se multaba igual aunque
 *  declarara bien la cuenta. Un segundo parser del mismo formato es un segundo defecto esperando. */
function _declaradasEnCalculo(texto) {
  const s = new Set();
  let calculos = [];
  try { calculos = (extraerCalculos(texto) || {}).calculos || []; } catch { return s; }
  for (const c of calculos) {
    for (const pf of parseFigures(String(c.resultado == null ? "" : c.resultado))) s.add(pf.canon);
  }
  return s;
}

/**
 * vetoCifraSinBoleta({ texto, figsEnBoleta, pregunta, recitaAprobada, datoProyectado })
 *   → { regla, multa } | null
 *
 * `figsEnBoleta` es el largo de la boleta acumulada del turno. Con una sola cifra leída, el juez NO se asoma:
 * la condición «boleta vacía» es exactamente el filtro que separa «el turno leyó» de «el turno inventó».
 */
export function vetoCifraSinBoleta({ texto, figsEnBoleta = 0, pregunta = "", recitaAprobada = null, datoProyectado = null } = {}) {
  if (typeof texto !== "string" || !texto.trim()) return null;
  if (Number(figsEnBoleta) > 0) return null;   // el turno leyó: el muro tiene con qué juzgarlo

  const literales = new Set();
  const conteos = new Set();
  for (const f of (datoProyectado && Array.isArray(datoProyectado.figs)) ? datoProyectado.figs : []) {
    literales.add(String(f.canon));
    for (const pf of parseFigures(String(f.value == null ? "" : f.value))) literales.add(pf.canon);
  }
  for (const c of (datoProyectado && Array.isArray(datoProyectado.counts)) ? datoProyectado.counts : []) conteos.add(String(c));
  const enRecita = new Set(((recitaAprobada && Array.isArray(recitaAprobada.figs)) ? recitaAprobada.figs : []).map((x) => String(x.canon)));
  const delUsuario = new Set(parseFigures(String(pregunta || "")).map((x) => x.canon));
  const declaradas = _declaradasEnCalculo(texto);

  const sinRespaldo = parseFigures(texto).filter((pf) =>
    !literales.has(pf.canon) && !enRecita.has(pf.canon) && !delUsuario.has(pf.canon) && !declaradas.has(pf.canon)
    && !(pf.unit === "count" && conteos.has(String(pf.raw))));
  if (!sinRespaldo.length) return null;

  const cuales = sinRespaldo.slice(0, 3).map((x) => `«${x.text}»`).join(", ");
  return {
    regla: "cifra-sin-boleta",
    multa: `este turno no leyó nada del dato y ${sinRespaldo.length === 1 ? `la cifra ${cuales} no está` : `las cifras ${cuales} no están`} en el archivo, ni en lo que ya te mostré, ni en lo que dijiste vos. Una cifra que no salió de ninguna de esas tres partes no va a pantalla: o corres la herramienta que la trae, o declaras la cuenta con sus insumos, o la dejas afuera.`,
    cifras: sinRespaldo.map((x) => x.text),
  };
}
