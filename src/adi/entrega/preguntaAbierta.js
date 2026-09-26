/* === src/adi/entrega/preguntaAbierta.js · LA PREGUNTA ABIERTA CON FUNCIÓN SUGERIDA (corte 3e, owner 2026-09-26)
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Leyes del owner («LA ENTREGA NO LE HABLA A NADIE», memoria `adi-flujo-producto-complemento.md`, bloque
 * REFINADO, dos rondas):
 *   (1) ADI identifica QUÉ conocimiento falta y SUGIERE la función más pertinente para CONSULTAR — nunca afirma
 *       que esa función SEPA la respuesta, nunca asume quién es el usuario (no hay «rol del interlocutor» acá).
 *   (2) SIN taxonomía nueva caso por caso: la función se DERIVA del cruce de DOS catálogos que ya existen —
 *       · el DOMINIO del dato faltante (`config/contract/dominios.js:DOMINIOS_REGISTRO`, atributo `funcion`: la
 *         función del negocio que OPERA ese dominio día a día — cobranza → «la gestión de crédito y cobranza»).
 *       · el TIPO de hueco (`config/contract/ausencias.js:TIPOS_DE_AUSENCIA`): «causa_no_medida»/«condicion_pactada»
 *         → la función del dominio · «sin_serie»/«no_reconcilia» → quien administra los datos del sistema ·
 *         «decision_de_rumbo» → la dirección del negocio. CUALQUIER otro tipo (o uno que no está en el catálogo
 *         compartido) → SIN función — «falla cerrado»: se declara la pregunta abierta igual, sin inventar a quién
 *         consultar.
 *   (3) Composición: ADI nunca escribe «sabe», «conoce», «puede responder» sobre una función — se sugiere PARA
 *       CONSULTAR, con su fundamento a la vista, nunca como garantía.
 *   (4) Nota pyme («en muchas pymes, el dueño o el gerente comercial») SOLO si el perfil de la empresa la
 *       respalda (banda de tamaño micro/pequeña, `config/contract/perfilCliente.js`/`bandaTamano.js`); sin perfil
 *       completo, no se afirma nada sobre el tamaño de la empresa.
 *
 * Forma en la Entrega (el bloque, ley textual):
 *   «Pregunta abierta: … El dato registra X, no Y.
 *    Función sugerida para consultar: … (sugerida porque el dato faltante es …)
 *    Dónde podría estar la respuesta: <fuente, derivada del MISMO tipo de hueco — nunca del caso particular>
 *    Qué cambia según la respuesta: …»
 * Tipada por dentro: { pregunta, sobre, falta, porQueNoEstaEnLosDatos, funcionSugerida|null,
 *   fundamento:{dominio, tipoDeHueco}, dondePodriaEstar, queCambia }. `_preguntaAbierta:true` distingue este
 * ítem, dentro de `entrega.paraSuJuicio`, de una hipótesis plana (`componer.js:_textoDePremisa`/carga comercial),
 * que sigue siendo una oración simple — no toda «Para su juicio» es una pregunta abierta con función.
 *
 * PURO · sin red · sin imports de `adi/` fuera de este árbol (capa de composición, como el resto de `entrega/`). */
import { dominioPorId } from "../../config/contract/dominios.js";
import { TIPOS_DE_AUSENCIA } from "../../config/contract/ausencias.js";

// (1) causa no medida / condición pactada → LA FUNCIÓN DEL DOMINIO declarada en `dominios.js`.
const _TIPOS_FUNCION_DEL_DOMINIO = new Set(["causa_no_medida", "condicion_pactada"]);
// (2) sin serie / no reconcilia → un rol fijo, independiente del dominio: quien administra los datos del sistema.
const _TIPOS_ADMIN_DATOS = new Set(["sin_serie", "no_reconcilia"]);
// (3) decisión de rumbo → un rol fijo, independiente del dominio: la dirección del negocio.
const _TIPO_DIRECCION = "decision_de_rumbo";
// CORTE 3e (owner 2026-09-26, presupuesto de palabras) — «Dónde podría estar la respuesta» solo se declara en
// prosa cuando aporta una fuente DISTINTA de la función misma: para «causa_no_medida»/«decision_de_rumbo» la
// función SUGERIDA ES la fuente (quien opera el dominio / quien decidió, sin un documento aparte que consultar)
// — repetirlo sería la misma palabra dos veces con dos rótulos. Para «condicion_pactada»/«sin_serie»/
// «no_reconcilia» la fuente SÍ es distinta de a quién preguntar (un contrato, un registro aparte, otro sistema)
// y se declara. El campo tipado `dondePodriaEstar` SIEMPRE se devuelve completo (nunca se recorta el dato, solo
// el render) — ver `construirPreguntaAbierta`.
const _TIPOS_CON_FUENTE_DISTINTA = new Set(["condicion_pactada", "sin_serie", "no_reconcilia"]);

export const FUNCION_ADMINISTRA_DATOS = "quien administra los datos del sistema";
export const FUNCION_DIRECCION = "la dirección del negocio";

/* «el dato faltante es …» (la cláusula de la Función sugerida) y «Dónde podría estar la respuesta» son, los dos,
 * una función SOLO del tipo de hueco — nunca del caso particular (ley 2: «derivada del MISMO tipo de hueco»). */
const _QUE_FALTA_POR_TIPO = {
  causa_no_medida: "una causa",
  condicion_pactada: "una condición pactada",
  sin_serie: "una serie histórica",
  no_reconcilia: "una conciliación",
  [_TIPO_DIRECCION]: "una decisión de negocio",
};
// CORTE 3e (owner 2026-09-26, ronda de cierre) — texto BREVE a propósito: las 4 rutas fijas no gobiernan
// tamaño (`entrega/tamano.js` no las ejercita) y este bloque se repite hasta tres veces en la ruta multidominio
// (comercial + inventario + cobranza) — cada palabra de más en un texto FIJO (nunca por caso) se multiplica por
// tres contra el tope de 900 (`verificar.js` regla 8, `_entrega_gate`; medido: 1061→909→900 palabras en tres
// rondas de compresión sobre la MISMA información, ninguna quitada — ver el informe del corte). El contenido no
// cambia, la redacción sí.
const _DONDE_POR_TIPO = {
  causa_no_medida: "quien gestiona la cuenta.",
  condicion_pactada: "el contrato pactado con la cuenta.",
  sin_serie: "un registro histórico aparte del sistema.",
  no_reconcilia: "el sistema de origen de cada universo.",
  [_TIPO_DIRECCION]: "quien tomó la decisión.",
};

/** funcionSugeridaDe({ dominio, tipoDeHueco }) → { funcion, quefalta, donde } — `funcion` es `null` si el cruce
 *  no tiene fundamento (tipo desconocido, o tipo que exige dominio y el dominio no lo declara): «falla cerrado»,
 *  la pregunta abierta se sirve igual, sin función. Valida contra `TIPOS_DE_AUSENCIA` (el catálogo compartido):
 *  un `tipoDeHueco` que no está ahí NUNCA deriva una función — no hay taxonomía nueva por caso. */
export function funcionSugeridaDe({ dominio = null, tipoDeHueco = null } = {}) {
  const tipo = tipoDeHueco && TIPOS_DE_AUSENCIA.includes(tipoDeHueco) ? tipoDeHueco : null;
  let funcion = null;
  if (tipo && _TIPOS_FUNCION_DEL_DOMINIO.has(tipo)) {
    const d = dominio ? dominioPorId(dominio) : null;
    funcion = (d && d.funcion) || null;
  } else if (tipo && _TIPOS_ADMIN_DATOS.has(tipo)) {
    funcion = FUNCION_ADMINISTRA_DATOS;
  } else if (tipo === _TIPO_DIRECCION) {
    funcion = FUNCION_DIRECCION;
  }
  return {
    funcion,
    quefalta: tipo ? _QUE_FALTA_POR_TIPO[tipo] || null : null,
    donde: tipo ? _DONDE_POR_TIPO[tipo] || null : null,
    // «Dónde…» solo se RENDERIZA cuando aporta una fuente distinta de la función (ver la nota de
    // `_TIPOS_CON_FUENTE_DISTINTA`, arriba) — el dato sigue completo en `donde`, esto solo gobierna el texto.
    mostrarDonde: tipo ? _TIPOS_CON_FUENTE_DISTINTA.has(tipo) : false,
  };
}

/** notaPymeDe(perfil, funcionSugerida) → texto | null — ley 4: SOLO con perfil completo y banda micro/pequeña;
 *  sin perfil (o perfil incompleto, o sin función sugerida) no se afirma nada del tamaño de la empresa. */
function _notaPymeDe(perfil, funcionSugerida) {
  if (!funcionSugerida || !perfil || perfil.completo !== true) return null;
  const banda = perfil.campos && perfil.campos.tamano ? perfil.campos.tamano.valor : null;
  if (banda !== "micro" && banda !== "pequena") return null;
  return "en muchas pymes, el dueño o el gerente comercial cumple esta función";
}

/** construirPreguntaAbierta({ pregunta, sobre, porQueNoEstaEnLosDatos, dominio, tipoDeHueco, queCambia, perfil })
 *  → el ítem tipado + `texto` ya renderado en la forma exacta de la ley (el bloque de 3 o 4 líneas). `sobre` es
 *  libre ({ entidad, metrica, ... }) — no se valida acá: es información de trazabilidad para quien audite, no un
 *  hecho verificado por el libro (esta pregunta, por definición, es sobre lo que el libro NO puede verificar). */
export function construirPreguntaAbierta({ pregunta, sobre = null, porQueNoEstaEnLosDatos, dominio = null, tipoDeHueco = null, queCambia, perfil = null } = {}) {
  if (!pregunta || !porQueNoEstaEnLosDatos || !queCambia) return null;
  const { funcion, quefalta, donde, mostrarDonde } = funcionSugeridaDe({ dominio, tipoDeHueco });
  const notaPyme = _notaPymeDe(perfil, funcion);

  const L = [];
  L.push(`**Pregunta abierta:** ${pregunta} *${porQueNoEstaEnLosDatos}*`);
  // «falla cerrado» (ley 2): sin función sugerida, se omiten TAMBIÉN «Dónde podría estar la respuesta» — esa
  // línea depende del mismo fundamento (fuente derivada del tipo de hueco), nunca se inventa una fuente genérica
  // para una pregunta que no pudo fundamentar a quién consultar.
  if (funcion) {
    // CORTE 3e (owner 2026-09-26, ronda de cierre, presupuesto de palabras) — el fundamento COMPLETO («sugerida
    // porque el dato faltante es …») queda en el campo tipado `fundamento` (rastreable por el gate/quien
    // audite), declarado corto en prosa `(dato faltante: X)` — nunca omitido del todo. «Dónde podría estar la
    // respuesta» se funde en la MISMA línea que «Función sugerida» (un guion, no un rótulo aparte): las dos
    // siguen presentes y tipadas por separado (`funcionSugerida`/`dondePodriaEstar`), solo el RENDER las junta
    // para no repetir un rótulo de sección completo tres veces en la ruta multidominio (tope de 900 palabras,
    // `verificar.js` regla 8) — la información no se pierde, se compacta.
    L.push(`**Función sugerida para consultar:** ${funcion}${notaPyme ? ` (${notaPyme})` : ""}${mostrarDonde ? ` — también: ${donde}` : ""}`);
  }
  L.push(`**Qué cambia según la respuesta:** ${queCambia}`);

  return {
    _preguntaAbierta: true,
    texto: L.join("\n"),
    hechos: [],
    pregunta, sobre, falta: quefalta, porQueNoEstaEnLosDatos,
    funcionSugerida: funcion || null,
    fundamento: { dominio: dominio || null, tipoDeHueco: tipoDeHueco || null },
    dondePodriaEstar: funcion ? donde : null,
    queCambia,
  };
}
