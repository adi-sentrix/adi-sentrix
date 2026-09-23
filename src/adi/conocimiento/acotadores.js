/* === src/adi/conocimiento/acotadores.js · LOS ACOTADORES (Business Knowledge v0.2, Parte B §3) ═══════════════════
 * «La pertinencia sola inunda: en el demo hay 6 cuentas con carga alta, 9 con vencido y 37 SKU frenados. Sin
 * esto, una pieza daría nueve mediciones.» Los cuatro acotadores, en el orden del documento:
 *   1 · acotar por entidad — servir sobre las que la Respuesta YA NOMBRA; el resto, una línea con conteo.
 *   2 · ordenar por valor informativo — ocurre > no_ocurre decisivo > indeterminable con resolución >
 *       indeterminable sin resolución; dentro de cada grupo, (C) > (B) > (A).
 *   3 · deduplicar por hipótesis — si dos piezas miden lo mismo (mismo cálculo, misma entidad), se sirve una
 *       con las dos lecturas, no dos líneas repetidas.
 *   4 · tope de TAMAÑO de sección (caracteres, no número de piezas) — lo que este módulo devuelve como
 *       `sobrantes` nunca se pierde EN ESTE ARCHIVO: el llamador (`seleccionar.js`) es quien decide qué hacer
 *       con esa lista y es quien tiene que convertirla, como mínimo, en una línea con conteo — ver la corrección
 *       de abajo.
 * Puro. Recibe items ya servidos (`servirPieza`, con `.texto`, `.piezaId`, `.entidad`, `.estado`) y los reduce a
 * lo que una Entrega puede mostrar.
 *
 * ═══ CORRECCIÓN 2026-09-23 (owner, defecto 2) — «el tope descarta en silencio» ═══════════════════════════════════
 * Este comentario decía antes que lo que no entra por tope «no se pierde: queda para "Qué más puedo calcular"».
 * Era falso: `toparPorTamano` siempre devolvió sus `sobrantes` (eso no cambió), pero `referenciaDelOficio`
 * (`seleccionar.js`, la función que de verdad sirve la Entrega) los recibía y los TIRABA — nunca los agregaba a
 * la salida. Verificado con sonda: con 6 piezas y 2 entidades nombradas, el tope de 2000 caracteres cortaba
 * CAU-03 en Falabella y en Lider (2.206 caracteres servidos contra el tope), y esos dos ítems no aparecían ni
 * como línea, ni como conteo, ni enlazados a nada — el recorte que este proyecto prohíbe. `seleccionar.js` ahora
 * SÍ convierte `sobrantes` en una línea con conteo y veredictos por pieza, igual que ya hacía con el acotador 1.
 * Y ninguna de las dos líneas de agregado promete «ver Qué más puedo calcular»: esa sección es un menú estático
 * por ruta (`componer.js`) que no tiene manera de recibir un enlace real — prometerlo era la MISMA clase de
 * promesa rota que este defecto corrige. */

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

/* ═══ CALIBRACIÓN 2026-09-23 (owner, defecto 2) — el tope por defecto baja de 2000 a 900 caracteres ═══════════════
 * Medido con las 4 piezas firmadas a mano y las 4 rutas REALES de `componer.js` (nunca contra un heurístico:
 * `_tmp_medir_tope5.mjs`, offline, no commiteado, barrió varios valores de tope sobre las cuatro rutas de
 * verdad). Con el tope viejo (2000 caracteres), la Referencia del oficio por sí sola empujaba a la Entrega
 * COMPLETA sobre el techo de 900 palabras que exige `verificarEntrega` (`TOPE_PALABRAS`, `src/adi/entrega/
 * verificar.js`) en DOS de las cuatro rutas — Inventario 940 palabras, Multidominio 1.117 — con solo 4 piezas
 * sembradas (menos de lo que habrá cuando se firme más). Con 900 caracteres: Brecha comercial 668, Cobranza
 * 508, Inventario 792 — las tres bajo el techo, con margen. El argumento del número: la Referencia del oficio
 * es UNA sección de la Entrega, no toda la Entrega — se le da, en caracteres, el mismo número que la Entrega
 * completa tiene de tope en palabras (900), para que su presupuesto quede visiblemente subordinado al de la
 * Entrega entera y no lo pueda agotar por sí sola.
 *
 * ⚠️ CORRECCIÓN 2026-09-23 (owner, segunda pasada) — el hallazgo de arriba quedó resuelto, no por el número de
 * este tope sino por un cambio en `seleccionar.js`: con la primera versión del arreglo (una línea de sobrantes
 * POR PIEZA), Multidominio medía 910 palabras — 10 sobre el techo — y bajar este tope no lo movía (piso fijo:
 * con 4 piezas pertinentes a la vez, cada una aportaba su propia línea, sin importar cuánto se achicara el
 * tope). El owner tomó la opción (b) que reporté: una sola línea combinada para TODOS los sobrantes (total +
 * desglose por veredicto), en vez de una por pieza — «un presupuesto que se pasa siempre no es un presupuesto».
 * Con eso, Multidominio bajó a 863 palabras. Medido de nuevo, las 4 rutas reales con las 4 piezas firmadas:
 * Brecha comercial 635 · Cobranza 475 · Inventario 789 · Multidominio 863 — las cuatro bajo el techo de 900.
 * Es la ruta más densa (3 dominios, hasta 4 piezas pertinentes a la vez) y queda con el margen más chico (37
 * palabras); si en el futuro se firman más piezas o Multidominio crece por su cuenta, puede volver a acercarse
 * al techo — documentado acá para que no sorprenda. El acotador 1 (`agregadoPorPieza`, entidades no nombradas)
 * SIGUE una línea por pieza: es el formato ya establecido y no es lo que se pidió cambiar. */
export const TOPE_CARACTERES_OFICIO = 900;

/** toparPorTamano(items, { maxCaracteres }) → { servidos, sobrantes } — el tope es de CARACTERES de la sección,
 *  no de número de piezas (documento §3, punto 4: «los anfitriones cortan textos largos sin avisar»). Esta
 *  función SIEMPRE devuelve `sobrantes` con su piezaId y entidad — es responsabilidad del llamador
 *  (`seleccionar.js`) convertirlos en algo visible; este módulo no lo hace por él. */
export function toparPorTamano(items, { maxCaracteres = TOPE_CARACTERES_OFICIO } = {}) {
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
export function aplicarAcotadores(items, { entidadesEnRespuesta = [], maxCaracteres = TOPE_CARACTERES_OFICIO } = {}) {
  const { visibles, agregadoPorPieza } = acotarPorEntidad(items, entidadesEnRespuesta);
  const ordenados = ordenarPorValorInformativo(visibles);
  const deduplicados = deduplicarPorHipotesis(ordenados);
  const { servidos, sobrantes } = toparPorTamano(deduplicados, { maxCaracteres });
  return { servidos, sobrantes, agregadoPorPieza };
}
