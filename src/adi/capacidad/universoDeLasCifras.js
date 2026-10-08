/* === src/adi/capacidad/universoDeLasCifras.js · DE QUÉ UNIVERSO SALE CADA CIFRA ENTREGADA (Etapa 2, ensayo 6 · owner 2026-10-08) ═══════════════════════════════════
 * Dos preguntas sobre una cifra que una Entrega YA entregó y el libro de la conversación conserva, resueltas con lo que el libro guarda (los universos de la Entrega y el Encargo con el que se entregó — nada se recalcula, no se toca
 * el Core):
 *   · ¿DE QUÉ CONJUNTO ES? (`textoDeUniverso`) — en el ensayo 6 un anfitrión nuevo leyó el hecho derivado D1 (la suma de los SKU de Lampa) como «los cinco primeros códigos» porque `retomar` devolvía la suma sin decir de qué conjunto era.
 *     Una cifra de un universo ACOTADO (los 3 de mayor venta, los clientes en mora, los SKU de una bodega) viaja con su texto, el mismo que la Entrega le dio al universo («los 3 de mayor venta»).
 *   · ¿ESTÁ DEFINIDO POR UNA BODEGA? (`universoDeBodegaDe`) — `derivar` no arma un agregado de VENTA cuyas cifras salen de un universo definido por bodega (la venta no se abre por bodega: `universoDeBodega.js`); vale también para los
 *     libros de antes de que `consultar` rechazara esa petición.
 * Una cifra que está en un universo SIN acotar (el listado completo de un eje) no necesita texto: su significado no depende del conjunto. Si una cifra está a la vez en un universo acotado y en uno sin acotar, tampoco (el conjunto no la define).
 * Puro: sin I/O, sin red. */
import { universoTieneRestriccionPropia } from "../encargo/esquema.js";   // forma pura (la misma prueba de las tres capas del Encargo): no corre nada del Core
import { parteDefinidaPorBodega } from "./universoDeBodega.js";

const _es = (x) => x != null && typeof x === "object" && !Array.isArray(x);
const _TEXTOS_MAX = 2;

/* los universos de la Entrega que cuentan (no el denominador de un puesto ni uno inválido), cada uno con: ¿acotado?, ¿definido por bodega? y qué bodegas — el Encargo con que se entregó dice qué parte lo originó (el id del universo es el de la parte) */
function _universosDe(entrega) {
  if (!_es(entrega) || entrega.recortada || !Array.isArray(entrega.universos)) return [];
  const partes = new Map(((_es(entrega.encargo) && Array.isArray(entrega.encargo.partes)) ? entrega.encargo.partes : []).map((p, i) => [_es(p) && typeof p.id === "string" && p.id.trim() ? p.id : `p${i + 1}`, p]));
  return entrega.universos.filter((u) => _es(u) && u.valido !== false && u.soloRanking !== true).map((u) => {
    const parte = partes.get(u.id) || null;
    const bod = parte ? parteDefinidaPorBodega(parte) : { porBodega: false, bodegas: [] };
    return { texto: typeof u.texto === "string" ? u.texto.trim() : "", entidades: Array.isArray(u.entidades) ? u.entidades : [], acotado: Boolean(parte && universoTieneRestriccionPropia(parte.universo)), deBodega: bod.porBodega, bodegas: bod.bodegas };
  });
}
/* los universos que contienen a la cifra de ese sujeto; un total (sin sujeto) es de todos los de la Entrega */
const _quienesLaContienen = (entrega, sujeto) => _universosDe(entrega).filter((u) => (sujeto == null ? true : u.entidades.includes(sujeto)));

/** textoDeUniverso(entrega, sujeto) → «los 3 de mayor venta» · el texto del conjunto acotado del que es la cifra, o null (sin universo acotado, o un universo sin acotar la contiene: no hace falta decirlo) */
export function textoDeUniverso(entrega, sujeto) {
  const U = _quienesLaContienen(entrega, sujeto);
  if (!U.length || !U.every((u) => u.acotado && u.texto)) return null;
  const textos = [...new Set(U.map((u) => u.texto))];
  return textos.length <= _TEXTOS_MAX ? textos.join(" · ") : `${textos.slice(0, _TEXTOS_MAX).join(" · ")} · …`;
}

/** universoDeBodegaDe(entrega, sujeto) → { bodegas } | null · la cifra sale SOLO de universos definidos por bodega (todos los que la contienen lo son) */
export function universoDeBodegaDe(entrega, sujeto) {
  const U = _quienesLaContienen(entrega, sujeto);
  if (!U.length || !U.every((u) => u.deBodega)) return null;
  return { bodegas: [...new Set(U.flatMap((u) => u.bodegas))] };
}

/** textoDeUniversoDeLaCifra(libro, id, sujeto) → el texto del universo de la cifra `E<n>.h<k>` del libro (o null) */
export function textoDeUniversoDeLaCifra(libro, id, sujeto) {
  const m = typeof id === "string" ? /^E(\d+)\./.exec(id) : null;
  const e = m && libro && Array.isArray(libro.entregas) ? libro.entregas.find((x) => x && x.n === Number(m[1])) : null;
  return e ? textoDeUniverso(e, sujeto == null ? null : sujeto) : null;
}
