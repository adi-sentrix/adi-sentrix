/* === src/adi/notario/declarar.js · EL DECLARADOR DE LOS PELDAÑOS (Notario semántico, fase 2 · owner 2026-09-15) ═══════════════
 * «El respaldo debe declarar y verificarse con el mismo estándar, no tener un camino privilegiado.» Los composers determinísticos
 * escriben desde figs; con este colector declaran, MIENTRAS escriben, cada afirmación de hecho que ponen en una línea — con la misma
 * forma que el cerebro (afirmacion.js) y el mismo juez después (juez.js). El bucle crea el colector y se lo pasa a `componer({...,
 * declarar})`; un composer que no lo recibe (gates viejos, llamadores históricos) trabaja con un colector mudo y queda byte-idéntico.
 *
 * Reglas del colector: `texto` es la línea (o el tramo) tal como se escribió — el detector de presencia cubre por ese tramo; el valor
 * va tal como se imprimió; el sujeto es la entidad del rótulo o la lista completa de un grupo/top-k; una lista impresa «los N que más»
 * se declara como orden top-k sobre su universo. Puro: sin I/O. */

const _sujetoYMetrica = (label) => {
  const partes = String(label || "").split(/\s+·\s+/);
  if (partes.length >= 2 && !/^(?:contribuci|carga|capital|brecha|peso|markup|medida|clientes|umbral|estado|saldo|abonado|recuperado|resto)/i.test(partes[0])) return { sujeto: partes[0], metrica: partes.slice(1).join(" · ") };
  return { sujeto: "negocio", metrica: String(label || "") };
};
const _valorDe = (f) => String((f && (f.text || f.value)) || "");

/** crearDeclarador() → el colector; `lista()` devuelve lo declarado */
export function crearDeclarador() {
  const lista = [];
  const agregar = (a) => { if (a && typeof a === "object" && a.tipo && a.texto) lista.push(a); return a; };
  const D = {
    lista: () => lista.slice(),
    vaciar: () => { lista.length = 0; },
    agregar,
    /** cifra de una fig de la boleta, en la línea `texto` (sujeto/métrica del rótulo salvo que se pasen) */
    deFig(f, texto, extra = {}) {
      if (!f || !texto) return null;
      const { sujeto, metrica: m0 } = _sujetoYMetrica(f.label);
      /* las cabeceras del panel de ventas viajan con nombre de campo («headline» · «headlineSub») y su significado en `context`: se declara el significado */
      const metrica = /^headline(?:Sub)?$/.test(String(f.label || "")) && f.context ? (f.label === "headline" ? (/presupuesto/i.test(f.context) ? "Variación vs presupuesto" : "Variación vs año anterior") : "Ventas del período") : m0;
      return agregar({ tipo: "cifra", sujeto: extra.sujeto || sujeto, metrica: extra.metrica || metrica, valor: extra.valor || _valorDe(f), texto, evidencia: [String(f.label || "")], ...(extra.universo ? { universo: extra.universo } : {}), ...(extra.periodo ? { periodo: extra.periodo } : {}) });
    },
    cifra({ sujeto, metrica, valor, texto, universo, periodo, evidencia }) { return agregar({ tipo: "cifra", sujeto, metrica, valor, texto, ...(universo ? { universo } : {}), ...(periodo ? { periodo } : {}), ...(evidencia ? { evidencia } : {}) }); },
    orden({ sujeto, metrica, forma, k, direccion, vs, universo, texto }) { return agregar({ tipo: "orden", sujeto, metrica, orden: { forma, ...(k != null ? { k } : {}), ...(direccion ? { direccion } : {}), ...(vs ? { vs } : {}) }, ...(universo ? { universo } : {}), texto }); },
    relacion({ sujeto, metrica, forma, k, matiz, vs, valor, texto }) { return agregar({ tipo: "relacion", sujeto, metrica, relacion: { forma, ...(k != null ? { k } : {}), ...(matiz ? { matiz } : {}), vs }, ...(valor ? { valor } : {}), texto }); },
    grupo({ sujeto, metrica, valor, universo, texto, evidencia }) { return agregar({ tipo: "grupo", sujeto, metrica, valor, ...(universo ? { universo } : {}), texto, ...(evidencia ? { evidencia } : {}) }); },
    conteo({ n, m, predicado, universo, sujeto, texto }) { return agregar({ tipo: "conteo", conteo: { n, ...(m != null ? { m } : {}), predicado }, ...(universo ? { universo } : {}), ...(sujeto ? { sujeto } : {}), texto }); },
    variacion({ sujeto, metrica, direccion, valor, periodo, texto }) { return agregar({ tipo: "variacion", sujeto, metrica: metrica || "Ventas", variacion: { direccion, ...(valor ? { valor } : {}) }, periodo: periodo || "vs año anterior", texto }); },
    estado({ sujeto, estado, bodega, texto }) { return agregar({ tipo: "estado", sujeto, estado: { estado, ...(bodega ? { bodega } : {}) }, texto }); },
    lectura({ texto, sello }) { return agregar({ tipo: "lectura", sello: sello || "criterio mío", texto }); },
  };
  return D;
}

/** filtrarPorTexto(declaraciones, texto) → solo las que siguen en el texto final (el ensamblador descarta líneas repetidas; su declaración se va con ellas) */
export function filtrarPorTexto(declaraciones, texto) {
  const n = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const T = n(texto);
  return (Array.isArray(declaraciones) ? declaraciones : []).filter((a) => a && typeof a.texto === "string" && T.includes(n(a.texto)));
}
/** declaradorDe(x) → x si es un colector; si no, uno MUDO (los llamadores sin colector quedan como estaban) */
export function declaradorDe(x) {
  if (x && typeof x === "object" && typeof x.agregar === "function") return x;
  const nada = () => null;
  return { lista: () => [], vaciar: nada, agregar: nada, deFig: nada, cifra: nada, orden: nada, relacion: nada, grupo: nada, conteo: nada, variacion: nada, estado: nada, lectura: nada, mudo: true };
}
