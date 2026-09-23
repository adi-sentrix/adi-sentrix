/* === src/adi/entrega/esquema.js · LA FORMA DE LA ENTREGA (plan `_ADI_LLMBUSINESS_PLAN.md` §1) ═══════════════════
 * Primer corte vertical del compositor de la Entrega — bandera `ADI_ENTREGA`, APAGADA en todos los perfiles.
 *
 * La Entrega es un documento corto que ADI escribe SOLO (sin ningún LLM), verificado contra los datos antes de
 * salir, que un modelo anfitrión (ChatGPT/Claude fuera de ADI) lee y narra. Siete partes (plan §1):
 *   marco · respuesta · cifras · límites (lo que NO se puede concluir) · referenciaDelOficio · paraSuJuicio ·
 *   quéMasPuedoCalcular.
 *
 * Este módulo es PURO: define la FORMA de esos datos y sus tipos de hecho, sin lógica de negocio ni de
 * verificación. `componer.js` la llena desde lo que el motor ya produce; `verificar.js` la audita antes de
 * servirla. Nada de esto se invoca en producción: es aditivo y no cambia el camino de hoy. */

/** Las siete partes, en el orden en que la Entrega las declara (plan §1, la tabla). */
export const PARTES_DE_LA_ENTREGA = [
  "marco", "respuesta", "cifras", "limites", "referenciaDelOficio", "paraSuJuicio", "queMasPuedoCalcular",
];

/** crearEntrega() → la Entrega vacía, con la forma completa de sus siete partes.
 *  · marco: lo que todo lo demás hereda (empresa, período, universo, moneda, definiciones, la referencia declarada).
 *  · respuesta: oraciones-hecho — cada una con su texto y los ids de los hechos (del libro) que la sostienen, para
 *    que la doble colocación (mecanismo 1 del plan) se pueda verificar mecánicamente.
 *  · cifras: una tabla — columnas declaradas + filas, cada fila con sus valores Y los ids de hecho que los prueban.
 *  · limites: hallazgos negativos, cada uno con TÍTULO (nunca una prohibición ni una excusa) y su motivo.
 *  · referenciaDelOficio: conocimiento del sector (ADI Business Knowledge, capa 2 del plan) — en este corte
 *    vertical (Etapa 1) esta capa no existe todavía (es la Etapa 3), así que viaja vacía y el hueco se declara
 *    como límite: no se inventa contenido para no dejarla vacía.
 *  · paraSuJuicio: preguntas que solo el dueño puede responder + hipótesis, cada una con su apoyo (ids de hecho).
 *  · queMasPuedoCalcular: { puedo: [...], noPuedo: [...] } — texto, sin cifras (no necesita verificación numérica).
 *  · procedencia: lo que la verificación necesita para auditar el texto — el libro de hechos completo y la
 *    lista, en ORDEN DE APARICIÓN, de cada cifra impresa en el texto (para el mecanismo "cero cifras desnudas"). */
export function crearEntrega() {
  return {
    marco: {
      empresa: null,
      periodo: null,            // { tipo: "acumulado"|"cerrado"|"foto"|"mixto", texto, familias, rango } | null —
                                 // HECHO verificable (figureType.UNIVERSOS · periodoDeFiguras), nunca texto suelto;
                                 // null solo si NINGUNA cifra de la boleta declara marco (owner 2026-09-22)
      universo: null,          // texto, ej. "14 clientes"
      moneda: null,            // el SÍMBOLO declarado por la boleta — nunca una escala inventada
      definiciones: [],        // ["Margen = contribución sobre venta neta", ...]
      referenciaDeclarada: null, // { texto, hechoId } — el benchmark, con quién lo declaró
    },
    respuesta: [],              // [{ texto, hechos: [id, ...] }]
    cifras: { columnas: [], filas: [] },   // filas: [{ valores: {columna: texto}, hechos: [id,...], tipo }]
    limites: [],                 // [{ titulo, motivo }]
    referenciaDelOficio: [],     // [{ texto, fuente, alcance, fecha, vigencia, firma }] — vacía en este corte
    paraSuJuicio: [],            // [{ texto, hechos: [id,...] }]
    queMasPuedoCalcular: { puedo: [], noPuedo: [] },
    procedencia: { libro: null, cifrasImpresas: [] },
  };
}

/** camposFaltantes(entrega) → qué parte de la forma no está declarada (cadena vacía = completa). Solo la FORMA:
 *  no juzga contenido (eso es `verificar.js`). Un límite o una referencia del oficio vacíos son válidos (una
 *  Entrega puede no tener nada que declinar, o —como en este corte— no tener conocimiento del oficio todavía). */
export function camposFaltantes(entrega) {
  if (!entrega || typeof entrega !== "object") return ["la Entrega no es un objeto"];
  const falta = [];
  for (const p of PARTES_DE_LA_ENTREGA) if (!(p in entrega)) falta.push(p);
  if (!Array.isArray(entrega.respuesta)) falta.push("respuesta debe ser una lista de oraciones-hecho");
  if (!entrega.cifras || !Array.isArray(entrega.cifras.columnas) || !Array.isArray(entrega.cifras.filas)) falta.push("cifras debe traer columnas y filas");
  if (!Array.isArray(entrega.limites)) falta.push("limites debe ser una lista");
  if (!entrega.queMasPuedoCalcular || !Array.isArray(entrega.queMasPuedoCalcular.puedo)) falta.push("queMasPuedoCalcular.puedo debe ser una lista");
  return falta;
}
