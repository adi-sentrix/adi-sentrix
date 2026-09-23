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
      // perfil: { empresa, campos: {sector,subsector,tamano,pais,moneda,modeloComercial}, faltantes, completo }
      // | null — Etapa 2 §4 (owner 2026-09-23, plan §3 «cómo se pega al cliente»): el perfil que la capa de
      // Business Knowledge necesita para emparejar. `config/contract/perfilCliente.js:construirPerfilCliente`
      // es la ÚNICA fuente; cada campo declara su procedencia con el MISMO vocabulario de `notario/hechos.js`
      // (PROCEDENCIAS) o `null` si el dato no lo sostiene — un campo ausente NUNCA se adivina acá.
      perfil: null,
    },
    respuesta: [],              // [{ texto, hechos: [id, ...] }]
    // filas: [{ valores: {columna: texto}, hechos: [id,...], procedencia }] — `procedencia` (Etapa 2 §1, owner
    // 2026-09-23): "medido"|"derivado"|"estimacion_referencia"|"supuesto_usuario"|"propuesta"|null — la PEOR
    // entre los hechos que la fila declaró (notario/hechos.js: `procedenciaDe`, PROCEDENCIAS). El texto visible
    // de la columna "Tipo" (si la tabla la trae) SALE de este campo (componer.js: `_textoDeTipo`), nunca al revés.
    cifras: { columnas: [], filas: [] },
    limites: [],                 // [{ titulo, motivo }]
    referenciaDelOficio: [],     // [{ texto, fuente, alcance, fecha, vigencia, firma }] — vacía en este corte
    paraSuJuicio: [],            // [{ texto, hechos: [id,...] }]
    queMasPuedoCalcular: { puedo: [], noPuedo: [] },
    procedencia: { libro: null, cifrasImpresas: [] },
    // universos: [{ id, eje, base, top: {metrica,k,direccion}|null, filtros, excluir, periodo, entidades: [...],
    // texto, valido, errorValidacion }] — Etapa 2 §3 (owner 2026-09-23, «el universo como objeto»): cada listado
    // que la Entrega hace ("los 2 de mayor brecha", "los mayores deudores", "los SKU con más capital frenado")
    // es un OBJETO con identidad propia, no una lista de nombres parecida a otra. Usa el MISMO vocabulario de
    // "universo tipado" que ya valida y nombra `notario/hechos.js` (`validarUniverso`/`nombrarUniverso`,
    // `conjuntoDeUniverso`) — no una segunda definición de universo. Es el cimiento para que una pregunta de
    // seguimiento («de esos, ¿cuál priorizo?») se resuelva sobre el universo correcto, no sobre el parecido
    // (owner: «no hace falta la conversación todavía; hace falta que el universo tenga identidad desde ahora»).
    universos: [],
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
