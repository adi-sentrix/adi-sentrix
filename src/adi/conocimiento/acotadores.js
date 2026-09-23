/* === src/adi/conocimiento/acotadores.js · LOS ACOTADORES (Business Knowledge v0.2, Parte B §3) ═══════════════════
 * «La pertinencia sola inunda: en el demo hay 6 cuentas con carga alta, 9 con vencido y 37 SKU frenados. Sin
 * esto, una pieza daría nueve mediciones.» Los cuatro acotadores, en el orden del documento:
 *   1 · acotar por entidad — servir sobre las que la Respuesta YA NOMBRA; el resto, una línea con conteo.
 *   2 · ordenar por valor informativo — ocurre > no_ocurre decisivo > indeterminable con resolución >
 *       indeterminable sin resolución; dentro de cada grupo, (C) > (B) > (A).
 *   3 · deduplicar por hipótesis — si dos piezas miden lo mismo (mismo cálculo, misma entidad), se sirve una
 *       con las dos lecturas, no dos líneas repetidas.
 *   4 · tope de TAMAÑO de sección (caracteres, no número de piezas) — lo que no cabe va a un resumen, con su id,
 *       nunca se pierde en silencio.
 * Puro. Recibe items ya servidos (`servirPieza`, con `.texto`, `.piezaId`, `.entidad`, `.estado`) y los reduce a
 * lo que una Entrega puede mostrar. */

const _RANGO_VALOR = { ocurre: 0, no_ocurre: 1, indeterminable_con_resolucion: 2, indeterminable_sin_resolucion: 3 };
const _RANGO_ETIQUETA = { C: 0, B: 1, A: 2 };

function _valorInformativo(item) {
  if (item.estado === "ocurre") return _RANGO_VALOR.ocurre;
  if (item.estado === "no_ocurre") return _RANGO_VALOR.no_ocurre;
  return item._resolveria ? _RANGO_VALOR.indeterminable_con_resolucion : _RANGO_VALOR.indeterminable_sin_resolucion;
}
function _valorEtiqueta(item) {
  const et = Array.isArray(item._etiqueta) ? item._etiqueta : [];
  const mejor = et.map((e) => _RANGO_ETIQUETA[e]).filter((v) => v != null).sort((a, b) => a - b)[0];
  return mejor == null ? 3 : mejor;
}

/** acotarPorEntidad(items, entidadesEnRespuesta) → { visibles, agregado: Map(clave → items[]) }
 *  `items` YA vienen uno por (pieza, entidad) — esto separa las entidades que la Respuesta nombra de las que
 *  no, agrupando el resto por (piezaId) para la línea de conteo del compositor. */
export function acotarPorEntidad(items, entidadesEnRespuesta = []) {
  const nombradas = new Set((entidadesEnRespuesta || []).filter(Boolean));
  const visibles = [];
  const agregadoPorPieza = new Map();
  for (const it of items) {
    if (!nombradas.size || nombradas.has(it.entidad)) { visibles.push(it); continue; }
    const lst = agregadoPorPieza.get(it.piezaId) || [];
    lst.push(it);
    agregadoPorPieza.set(it.piezaId, lst);
  }
  return { visibles, agregadoPorPieza };
}

/** ordenarPorValorInformativo(items) → items ordenados (ocurre > no_ocurre decisivo > indeterminable con
 *  resolución > indeterminable sin resolución; dentro de cada grupo, C > B > A). No muta el arreglo original. */
export function ordenarPorValorInformativo(items) {
  return [...items].sort((a, b) => {
    const dv = _valorInformativo(a) - _valorInformativo(b);
    if (dv !== 0) return dv;
    return _valorEtiqueta(a) - _valorEtiqueta(b);
  });
}

/** deduplicarPorHipotesis(items) → colapsa items que miden LA MISMA hipótesis (mismo cálculo + misma entidad,
 *  venidos de piezas distintas) en uno solo, con `piezasRelacionadas` listando todas las que aportaron. Se
 *  queda con el texto del de MAYOR valor informativo del grupo (ya ordenado antes de llamar acá). */
export function deduplicarPorHipotesis(itemsOrdenados) {
  const vistos = new Map();
  const out = [];
  for (const it of itemsOrdenados) {
    const clave = `${it.entidad}::${it._calculo || it.piezaId}`;
    if (vistos.has(clave)) { vistos.get(clave).piezasRelacionadas.push(it.piezaId); continue; }
    const dedup = { ...it, piezasRelacionadas: [it.piezaId] };
    vistos.set(clave, dedup);
    out.push(dedup);
  }
  return out;
}

/** toparPorTamano(items, { maxCaracteres }) → { servidos, sobrantes } — el tope es de CARACTERES de la sección,
 *  no de número de piezas (documento §3, punto 4: «los anfitriones cortan textos largos sin avisar»). Los
 *  `sobrantes` no se pierden: quedan con su piezaId para "Qué más puedo calcular". */
export function toparPorTamano(items, { maxCaracteres = 2000 } = {}) {
  let acumulado = 0;
  const servidos = [];
  const sobrantes = [];
  for (const it of items) {
    const largo = (it.texto || "").length;
    if (acumulado + largo <= maxCaracteres || !servidos.length) { servidos.push(it); acumulado += largo; }
    else sobrantes.push(it);
  }
  return { servidos, sobrantes };
}

/** aplicarAcotadores(items, { entidadesEnRespuesta, maxCaracteres }) → el pipeline completo, en el orden del
 *  documento: acotar por entidad → ordenar → deduplicar → topar por tamaño. */
export function aplicarAcotadores(items, { entidadesEnRespuesta = [], maxCaracteres = 2000 } = {}) {
  const { visibles, agregadoPorPieza } = acotarPorEntidad(items, entidadesEnRespuesta);
  const ordenados = ordenarPorValorInformativo(visibles);
  const deduplicados = deduplicarPorHipotesis(ordenados);
  const { servidos, sobrantes } = toparPorTamano(deduplicados, { maxCaracteres });
  return { servidos, sobrantes, agregadoPorPieza };
}
