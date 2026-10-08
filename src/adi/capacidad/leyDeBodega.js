/* === src/adi/capacidad/leyDeBodega.js · LA VENTA NO SE ABRE POR BODEGA: EL RECHAZO QUE ENSEÑA (Etapa 2, ensayo 6 · owner 2026-10-08, opción A) ═══════════════════════
 * El ensayo 6 (B03) pidió «ventas por bodega». `consultar` aceptó el universo «los SKU de Lampa» (`universo.bodega`, eje sku) para una métrica COMERCIAL y la entregó sin ningún límite; el anfitrión sumó esos SKU
 * con `derivar` y escribió «Lampa vende $97.6M… 11.5 veces Calama»: el cruce prohibido venta × bodega (CLAUDE.md §4: la bodega es SOLO inventario; el dato no dice qué bodega despachó cada venta). Decisión del
 * owner (opción A): se RECHAZA, con una razón que enseña en palabras de negocio — lo que SÍ se puede (el inventario de esa bodega, la venta de los productos que el usuario nombre) viaja en las alternativas
 * (`ensenar.js`).
 *
 * QUÉ SE RECHAZA: toda parte que pida una métrica COMERCIAL (venta, margen, contribución, unidades vendidas, carga, costo…; o, en Comercial sin conceptos, «lo que el procedimiento sirva») sobre algo definido por
 * bodega —`universo.bodega`, `universo.excluir.bodega`, una rama de `union`, un universo/parte del eje bodega, entidades que son bodegas—, o que RECORTE por una métrica comercial dentro de una bodega
 * (`top`/`filtros` por venta). El inventario por bodega sigue permitido. Es una parte que no corre —el motivo es de ESTA capa, `venta_por_bodega`, como `formato_invalido`; no está en la lista cerrada de `MOTIVOS` del
 * contrato del Encargo, que no se toca— y no anula a las demás: «nunca sustitución por vecino».
 *
 * DÓNDE VIVE: ANTES de `validarEncargo`, en la capa de la capacidad (`encargo/*` sigue congelado), igual que `formaDelEncargo.js`. Lo bien formado y permitido pasa IDÉNTICO (misma referencia de objeto). El rechazo tiene
 * la mitad pura en `universoDeBodega.js` y la mitad que mira las entidades del tenant ACTIVO acá (se llama dentro del tramo del Core de `consultar`). Cero `node:*` (corre en `edge`). */
import { resolveEntityRef } from "../oracle/entityIndex.js";
import { CAMPOS_RAIZ, PARTES_MAX } from "../encargo/esquema.js";
import { esMetricaComercial, metricasDelUniverso, parteDefinidaPorBodega, textoDeLaLey, MOTIVO_VENTA_POR_BODEGA } from "./universoDeBodega.js";

export { MOTIVO_VENTA_POR_BODEGA, textoDeLaLey };

const _es = (x) => x != null && typeof x === "object" && !Array.isArray(x);
const _str = (x) => typeof x === "string" && x.trim() !== "";
const _lista = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);

/* ¿esta parte pide algo comercial sobre una bodega? → null (se deja pasar) o { campo, valor, bodegas, conceptos, parteEntera }.
 *   · parteEntera: la parte entera es venta × bodega —todo lo que pidió es comercial, o es Comercial sin conceptos («lo que el procedimiento sirva»), o RECORTA por una métrica comercial dentro de la bodega—: no corre;
 *   · si pidió además conceptos que SÍ se abren por bodega (el inventario), la parte corre con esos y solo se declaran los comerciales (en un encargo, lo válido corre y lo inválido se declara). */
function _examinar(p, ejeDeEntidad) {
  if (!_es(p) || p.cierre === "definicion") return null;   // definir un concepto no entrega una cifra
  const def = parteDefinidaPorBodega(p, { ejeDeEntidad });
  if (!def.porBodega) return null;
  const tema = typeof p.tema === "string" ? p.tema : null;
  const conceptos = _lista(p.conceptos).filter(_str);
  const comerciales = conceptos.filter((c) => esMetricaComercial(c, tema));
  const delUniverso = metricasDelUniverso(_es(p.universo) ? p.universo : null).filter((c) => esMetricaComercial(c, tema));
  const todoLoComercial = conceptos.length === 0 && tema === "comercial";   // «lo que el procedimiento de Comercial sirva» es venta
  if (!comerciales.length && !delUniverso.length && !todoLoComercial) return null;
  const parteEntera = delUniverso.length > 0 || todoLoComercial || comerciales.length === conceptos.length;
  return { campo: def.campo, valor: def.valor, bodegas: def.bodegas, conceptos: [...new Set([...comerciales, ...delUniverso])], parteEntera, comerciales };
}

/** separarVentaPorBodega(encargo) → { encargo, rechazos } · `encargo` es el MISMO objeto cuando ninguna parte viola la ley; si alguna la viola, una copia SIN esas partes (y sin los supuestos que solo ellas citaban) —o con la parte
 *  sin sus conceptos comerciales, si pidió también inventario— y, en `rechazos`, un NoResuelto por parte con su razón (`detalle`) y los datos con que `ensenar.js` arma las alternativas (`bodegas`, `conceptos`). Un encargo cuya
 *  raíz es inválida (versión, tope de partes, campos ajenos) se deja pasar entero: ese rechazo es del validador, con su motivo de siempre. Lee el tenant ACTIVO (para saber si un nombre sin eje es una bodega): se llama dentro
 *  del tramo del Core. */
export function separarVentaPorBodega(encargo) {
  const sin = { encargo, rechazos: [] };
  if (!_es(encargo) || encargo.version !== "encargo/v1" || !Array.isArray(encargo.partes) || encargo.partes.length === 0 || encargo.partes.length > PARTES_MAX) return sin;
  if (Object.keys(encargo).some((k) => !CAMPOS_RAIZ.includes(k))) return sin;
  const ejeDeEntidad = (nombre) => { try { const r = resolveEntityRef(nombre); return r && r.estado === "resuelto" ? r.dimension : null; } catch { return null; } };
  const rechazos = [];
  const quedan = [];
  const idsQuitados = new Set();
  encargo.partes.forEach((p, i) => {
    const h = _examinar(p, ejeDeEntidad);
    if (!h) { quedan.push(p); return; }
    const id = _es(p) && _str(p.id) ? p.id : `p${i + 1}`;
    rechazos.push({ parte: id, campo: h.parteEntera ? (h.campo || "universo") : "concepto", valor: h.parteEntera ? h.valor : (h.comerciales.length === 1 ? h.comerciales[0] : h.comerciales), motivo: MOTIVO_VENTA_POR_BODEGA, detalle: textoDeLaLey({ bodegas: h.bodegas }), alternativas: [], bodegas: h.bodegas, conceptos: h.conceptos });
    if (h.parteEntera) { for (const s of _lista(p.supuestos)) if (_str(s)) idsQuitados.add(s); }
    else quedan.push({ ...p, conceptos: _lista(p.conceptos).filter((c) => !h.comerciales.includes(c)) });
  });
  if (!rechazos.length) return sin;   // nada que rechazar: el MISMO objeto, cero diferencia con lo de antes
  /* un supuesto que solo citaban las partes rechazadas se va con ellas (si no, el validador lo declararía «sin productor» por una parte que ya no existe) */
  const siguenCitados = new Set(quedan.flatMap((p) => (_es(p) ? _lista(p.supuestos).filter(_str) : [])));
  const supuestos = Array.isArray(encargo.supuestos) ? encargo.supuestos.filter((s) => !(_es(s) && idsQuitados.has(s.id) && !siguenCitados.has(s.id))) : encargo.supuestos;
  const copia = { ...encargo, partes: quedan };
  if (supuestos !== encargo.supuestos) copia.supuestos = supuestos;
  return { encargo: copia, rechazos };
}

/** resolucionDeLoRechazado(ley) → la Resolución cuando NINGUNA parte sobrevivió: no corre nada, y dice por qué (la misma forma que la de un encargo sin partes útiles) */
export function resolucionDeLoRechazado(ley) {
  return { ok: false, encargo: ley.encargo, partes: [], criterio: null, supuestos: [], premisas: [], noResuelto: ley.rechazos, avisos: [] };
}
