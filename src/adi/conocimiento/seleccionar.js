/* === src/adi/conocimiento/seleccionar.js · EL ENGANCHE — `referenciaDelOficio` con pertinencia medida ═══════════
 * Orquesta las seis piezas del documento (`_ADI_BUSINESS_KNOWLEDGE_V0_PROPUESTA.md` v0.2): tabla de señales →
 * pertinencia → medición → servicio → acotadores → recuento. Es la función que `src/adi/entrega/componer.js`
 * llama en el lugar donde hoy llama a `seleccionarConocimientoDelOficio(perfil)` (perfilCliente.js, Etapa 3
 * todavía sin catálogo) — NO la reemplaza: la envuelve, y con la bandera apagada delega literalmente en ella
 * (mismo comportamiento, cero diferencia — ver `_conocimiento_gate.mjs`, candado 4: la conclusión del
 * procedimiento es byte-idéntica con la capa encendida y apagada).
 *
 * LAS TRES PUERTAS QUE APAGAN LA CAPA, EN ORDEN (cualquiera de las tres basta):
 *   1 · `activo` en false — la bandera `ADI_CONOCIMIENTO` (declarada en voiceFlags.js, sin entrada en ningún
 *       perfil: encenderla es una decisión del owner, no un efecto de este commit — mismo patrón que
 *       ADI_ENTREGA/ADI_NOTARIO_V3).
 *   2 · perfil incompleto — `perfilAutorizaConocimiento(perfil)` (plan §3: «sin perfil no se entrega nada de
 *       esta capa: falla cerrado»).
 *   3 · ninguna pieza `estado === "firmada"` — la regla que prueba esta siembra: las cuatro piezas de
 *       `piezas.js` nacen `"borrador"`, así que HOY esta puerta sola ya vacía el resultado, sin importar 1 y 2.
 *       Es la prueba de gobierno del documento §9: «que el candado demuestre que una pieza en borrador NO se
 *       sirve».
 *
 * `_evaluarSinFiltroDeFirma` (exportada aparte, NUNCA usada por `referenciaDelOficio`) existe solo para que el
 * candado y un informe puedan mostrar qué haría la infraestructura si las piezas estuvieran firmadas —
 * demuestra el MECANISMO sin adelantarse a la validación del contenido.
 *
 * ⚠️ Hoy quedan CUATRO piezas sembradas en `piezas.js` (CAU-01 · CAU-06 · CAU-03 · PRI-04), no seis — RSG-06 y
 * MOV-05 se colapsaron dentro de CAU-06 (defecto 4, owner 2026-09-23): medían lo mismo con el mismo cálculo.
 *
 * ═══ CORRECCIÓN 2026-09-23 (owner, defecto 2) — «el tope descarta en silencio» ═══════════════════════════════════
 * `aplicarAcotadores` siempre devolvió `sobrantes` (lo cortado por el tope de TAMAÑO), pero esta función los
 * recibía y nunca los ponía en `salida` — un recorte que no declaraba qué recortó. Ahora `_procesar` convierte
 * tanto `agregadoPorPieza` (acotador 1: entidades no nombradas) como `sobrantes` (acotador 4: entidades YA
 * nombradas que no entraron por tamaño) en una línea con conteo y veredictos — nunca desaparecen sin rastro.
 *
 * ═══ CORRECCIÓN 2026-09-23 (owner, cierre de CAU-01) — «cero ruido: la pregunta del oficio UNA vez, el "no
 * implica" UNA vez» ═══════════════════════════════════════════════════════════════════════════════════════════
 * Con más de una entidad pertinente por pieza, el encabezado ("El oficio mira: …") y la negativa se repetían por
 * ítem. `servirPieza` acepta `{incluirEncabezado, incluirNegativa}`; `_colapsarOficioRepetido` (abajo) decide,
 * DESPUÉS de que acotadores fija el orden y el recorte, cuál ítem de cada pieza lleva el encabezado y cuáles
 * negativas ya se sirvieron — sin tocar `acotadores.js`.
 *
 * ═══ REDISEÑO 2026-09-24 (owner, cierre de presentación de CAU-01) — LA PRESENTACIÓN EN BLOQUE ═════════════════
 * El listado por ítem (arriba) sirve bien a CAU-06/CAU-03. Para una pieza que mide TODA la cartera bajo un
 * mismo criterio —señal/bajo_piso, PRI-04 y CAU-01— la muestra en vivo mostró tres defectos: (1) una SEÑAL (lo
 * material) podía quedar escondida en «N mediciones más no entraron por espacio» — inaceptable, una señal nunca
 * se corta por espacio; (2) el id interno de la pieza ("(CAU-01)") se filtraba al texto del usuario; (3)
 * redacción robótica y paréntesis colgando. Las piezas cuyo `medicion.calculo` está en `_BLOQUE_POR_CALCULO` se
 * sirven en UN bloque (`servir.js:servirBloqueCargaVsResto`/`servirBloquePisoDeCobranza`) que NUNCA pasa por
 * `aplicarAcotadores`: el tamaño de la cartera decide el tamaño del bloque, nunca un tope de caracteres. */
import { ADI_CONOCIMIENTO } from "../../config/voiceFlags.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";
import { perfilAutorizaConocimiento, seleccionarConocimientoDelOficio } from "../../config/contract/perfilCliente.js";
import { PIEZAS_CONOCIMIENTO } from "./piezas.js";
import { piezasValidas } from "./validarPieza.js";
import { construirTablaDeSenales } from "./tablaSenales.js";
import { evaluarPertinencia } from "./evaluarPertinencia.js";
import { medirPieza, coberturaPisoDeCobranza, coberturaCargaVsResto, resultadosCargaVsResto, resultadosPisoDeCobranza } from "./medir.js";
import { servirPieza, servirBloqueCargaVsResto, servirBloquePisoDeCobranza } from "./servir.js";
import { aplicarAcotadores, TOPE_CARACTERES_OFICIO } from "./acotadores.js";
import { recuentoDeLoRevisado } from "./recuento.js";

const _PLURAL = { cuenta: "cuentas", sku: "SKU" };
/* dos vocabularios de estado conviven en las piezas firmadas: "ocurre"/"no_ocurre" (CAU-06/CAU-03) y
 * "señal"/"bajo_piso" (PRI-04 · CAU-01 v2 — ver medir.js) — los dos son veredictos DECISIVOS, ninguno es
 * "indeterminable". Las líneas de agregado (abajo) contaban solo "ocurre" y trataban todo lo demás como "no" —
 * eso describía un veredicto medido como si no se hubiera podido saber (owner 2026-09-23: corrección de
 * exactitud, no de estilo). Con la presentación en bloque (owner 2026-09-24) esto ya no afecta a CAU-01/PRI-04
 * —nunca pasan por acotadores.js—, pero queda general por si una pieza futura declara el mismo vocabulario sin
 * pedir bloque. */
const _esPositivo = (estado) => estado === "ocurre" || estado === "senal";

/* ═══ BLOQUES, POR PIEZA CON VEREDICTO SEÑAL/BAJO_PISO (owner 2026-09-24) — ver la cabecera del archivo.
 * Reconocidas por su cálculo, no por su id, para que otra pieza futura con el mismo mecanismo lo herede sin
 * tocar este archivo. Cada función falla cerrado: si el cierre (piso + cobertura) no cierra, o no hay ninguna
 * cuenta que medir, el bloque no se sirve (`null`) — nunca un bloque a medias.
 *
 * ═══ PERTINENCIA DENTRO DEL BLOQUE (owner 2026-09-24, defecto 4 — «digresión») ═══════════════════════════════
 * Con la pregunta de margen, PRI-04 desplegaba sus 5 señales completas aunque el usuario no las nombró y el
 * tema de la pregunta es carga/margen, no cobranza — una digresión. Regla: cuenta NOMBRADA → línea completa
 * siempre; señal NO nombrada → completa SOLO si la pieza responde el TEMA de la pregunta, si no, compactada por
 * nombre y monto (nunca oculta). «Responde el tema» se resuelve con el MISMO contrato de dominios que ya usa
 * todo el proyecto (`contratoDeDominios.js:dominiosDe`, ya corrido sobre esta pregunta en `tabla.pregunta.temas`
 * — `tablaSenales.js`) — el criterio más simple que ya existe, ningún clasificador de lenguaje nuevo.
 * `_DOMINIO_POR_CALCULO` es la única pieza declarada a mano: qué dominio del contrato responde cada cálculo. */
const _DOMINIO_POR_CALCULO = {
  cargaCuentaVsResto: "comercial",
  pisoMaterialidadCobranza: "cobranza",
};
const _BLOQUE_POR_CALCULO = {
  cargaCuentaVsResto: (pieza, tabla, entidadesEnRespuesta) => {
    const { porEntidad } = resultadosCargaVsResto(pieza, tabla);
    if (!porEntidad.size) return null;
    const cierre = coberturaCargaVsResto(tabla);
    if (!cierre) return null;
    const nombradas = new Set((entidadesEnRespuesta || []).filter(Boolean));
    const respondeLaPregunta = (tabla.pregunta && tabla.pregunta.temas || []).includes(_DOMINIO_POR_CALCULO.cargaCuentaVsResto);
    return servirBloqueCargaVsResto(pieza, porEntidad, cierre.texto, { nombradas, respondeLaPregunta });
  },
  pisoMaterialidadCobranza: (pieza, tabla, entidadesEnRespuesta) => {
    const { porEntidad } = resultadosPisoDeCobranza(pieza, tabla);
    if (!porEntidad.size) return null;
    const cierre = coberturaPisoDeCobranza(tabla);
    if (!cierre) return null;
    const nombradas = new Set((entidadesEnRespuesta || []).filter(Boolean));
    const respondeLaPregunta = (tabla.pregunta && tabla.pregunta.temas || []).includes(_DOMINIO_POR_CALCULO.pisoMaterialidadCobranza);
    return servirBloquePisoDeCobranza(pieza, porEntidad, cierre.texto, { nombradas, respondeLaPregunta });
  },
};

/* ═══ CERO RUIDO (owner 2026-09-23, cierre de CAU-01) — «la pregunta del oficio UNA vez arriba, el "no implica"
 * UNA vez por pieza» ═══════════════════════════════════════════════════════════════════════════════════════════
 * `servirPieza` ya sabe callar su encabezado/negativa (`{incluirEncabezado, incluirNegativa}`); esta función
 * decide, DESPUÉS de que acotadores ya fijó el orden y el recorte final, cuál ítem de cada pieza lleva el
 * encabezado (el primero que aparece) y cuáles negativas ya se sirvieron (por pieza + texto exacto de la
 * negativa — dos estados de la misma pieza pueden traer negativas DISTINTAS, y las dos se sirven, una vez cada
 * una). Vuelve a llamar `servirPieza` con los MISMOS `pieza`/`entidad`/`medicion` que ya sirvieron a este ítem
 * (guardados en `_pieza`/`_medicion` al construir `items`, más abajo) — nunca reescribe texto a mano. El tope de
 * caracteres del acotador 4 ya se midió sobre la forma COMPLETA (con encabezado y negativa): este repaso solo
 * ACORTA lo servido, nunca lo alarga, así que el presupuesto de la sección nunca se pasa por esto. Nota
 * 2026-09-24: desde el rediseño en bloque, esto solo aplica a CAU-06/CAU-03 (las únicas que aún usan el
 * pipeline por ítem) — sigue vivo por si una pieza futura repite el mismo patrón sin pedir bloque. */
function _colapsarOficioRepetido(servidos) {
  const vistoEncabezado = new Set();
  const vistaNegativa = new Set();
  return servidos.map((it) => {
    if (!it._pieza || !it._medicion) return it;   // ítem sin origen guardado (defensivo): se sirve tal cual
    const primeraVezPieza = !vistoEncabezado.has(it.piezaId);
    if (primeraVezPieza) vistoEncabezado.add(it.piezaId);
    const claveNeg = `${it.piezaId}::${it.negativaTexto || ""}`;
    const primeraVezNegativa = it.negativaTexto ? !vistaNegativa.has(claveNeg) : false;
    if (primeraVezNegativa) vistaNegativa.add(claveNeg);
    const reservido = servirPieza(it._pieza, it.entidad, it._medicion, { incluirEncabezado: primeraVezPieza, incluirNegativa: primeraVezNegativa });
    return reservido ? { ...it, texto: reservido.texto } : it;
  });
}

/* el corazón, factorizado para que el gate pueda pedir el resultado CON el filtro de firma (el que se sirve de
 * verdad) o SIN él (para demostrar el mecanismo sobre las piezas borrador, nunca servido a un cliente). */
function _procesar(catalogo, { scenario, pregunta, entidadesEnRespuesta, perfil, maxCaracteres }) {
  const { validas, invalidas } = piezasValidas(catalogo, {});
  const tabla = construirTablaDeSenales({ scenario, pregunta, entidadesEnRespuesta });

  const items = [];
  const bloques = [];   // piezas señal/bajo_piso: UN bloque cada una — nunca pasa por acotadores.js
  const detalle = [];   // traza completa por (pieza, entidad) — para el informe/gate, no para la Entrega
  for (const pieza of validas) {
    const pert = evaluarPertinencia(pieza, tabla, perfil, pregunta);
    if (!pert.pertinente) { detalle.push({ piezaId: pieza.id, pertinente: false, motivo: pert.motivo }); continue; }
    const calculo = pieza.medicion && pieza.medicion.calculo;
    const bloqueFn = _BLOQUE_POR_CALCULO[calculo];
    const entidadesPert = pert.entidades.length ? pert.entidades : [null];
    if (bloqueFn) {
      // la traza (`detalle`) se llena igual, cuenta por cuenta, para que el informe/gate vea lo mismo que ya
      // veía con el pipeline por ítem — el bloque en sí vuelve a medir internamente (medirPieza es puro).
      for (const entidad of entidadesPert) {
        const medicion = medirPieza(pieza, entidad, tabla);
        detalle.push({ piezaId: pieza.id, entidad, pertinente: true, estado: medicion.estado, motivo: medicion.motivo, resolveria: medicion.resolveria, cifra: medicion.cifra, referencia: medicion.referencia });
      }
      const bloque = bloqueFn(pieza, tabla, entidadesEnRespuesta);
      if (bloque) bloques.push(bloque);
      continue;   // ★ una señal nunca se corta por espacio (owner 2026-09-24): esta pieza no entra a items/acotadores
    }
    for (const entidad of entidadesPert) {
      const medicion = medirPieza(pieza, entidad, tabla);
      detalle.push({ piezaId: pieza.id, entidad, pertinente: true, estado: medicion.estado, motivo: medicion.motivo, resolveria: medicion.resolveria, cifra: medicion.cifra, referencia: medicion.referencia });
      const servido = servirPieza(pieza, entidad, medicion);
      if (servido) items.push({ ...servido, _calculo: pieza.medicion.calculo, _etiqueta: pieza.etiqueta, _resolveria: medicion.resolveria, _porEntidad: pieza.medicion.por_entidad, _pieza: pieza, _medicion: medicion });
    }
  }

  // el presupuesto de los bloques SALE del tope de la sección antes de repartir el resto (los bloques nunca se
  // cortan; lo que queda financia el pipeline por ítem de CAU-06/CAU-03) — nunca negativo (Math.max 0).
  const presupuestoBloques = bloques.reduce((s, b) => s + (b.texto ? b.texto.length : 0), 0);
  const maxCaracteresRestante = Math.max(0, maxCaracteres - presupuestoBloques);

  const { servidos: servidosCrudos, sobrantes, agregadoPorPieza } = aplicarAcotadores(items, { entidadesEnRespuesta, maxCaracteres: maxCaracteresRestante });
  // cero ruido (owner 2026-09-23): con acotadores ya decidido el recorte y el orden final, se colapsa el
  // encabezado y la negativa repetidos DENTRO de una misma pieza — ver la cabecera de `_colapsarOficioRepetido`.
  const servidos = _colapsarOficioRepetido(servidosCrudos);
  const salida = [
    ...bloques.map((b) => ({ texto: b.texto, fuente: b.fuente, alcance: b.alcance, fecha: b.fecha, vigencia: b.vigencia, firma: b.firma })),
    ...servidos.map((s) => ({ texto: s.texto, fuente: s.fuente, alcance: s.alcance, fecha: s.fecha, vigencia: s.vigencia, firma: s.firma })),
  ];
  for (const [, lst] of agregadoPorPieza) {
    if (!lst.length) continue;
    const eje = _PLURAL[lst[0]._porEntidad] || "casos";
    // el vocabulario de esta pieza (homogéneo dentro del grupo: una pieza declara SIEMPRE el mismo par de
    // estados) — "señal"/"bajo el piso" o "ocurre"/"no". ★ SIN el id de la pieza en el texto (owner
    // 2026-09-24, defecto 2: ningún id interno del catálogo llega al usuario).
    const vocabSenal = lst.some((x) => x.estado === "senal" || x.estado === "bajo_piso");
    const nPos = lst.filter((x) => _esPositivo(x.estado)).length;
    const palabraPos = vocabSenal ? "señal" : "ocurre";
    const palabraNeg = vocabSenal ? "bajo el piso" : "no";
    // ⚠️ nunca prometer «ver Qué más puedo calcular»: esa sección (componer.js) es un menú estático por ruta,
    // sin forma de recibir un enlace real a este conteo — prometerlo sería la misma clase de defecto que abajo.
    salida.push({ texto: `Y en ${lst.length} ${eje} más del mismo conjunto: ${nPos} ${palabraPos}, ${lst.length - nPos} ${palabraNeg}.`, fuente: null, alcance: null, fecha: null, vigencia: null, firma: null });
  }

  // el acotador 4 (tope de TAMAÑO) nunca puede descartar en silencio (defecto 2, owner 2026-09-23): lo que no
  // entró por espacio —entidades YA NOMBRADAS en la Respuesta, no las agregadas por el acotador 1— se declara
  // acá, como mínimo, en una línea con conteo y veredictos. Nunca desaparece sin rastro.
  //
  // ═══ CORRECCIÓN 2026-09-23 (owner, segunda pasada) — UNA sola línea combinada, no una por pieza ═══════════════
  // La primera versión agrupaba los sobrantes por piezaId y servía una línea POR PIEZA («CAU-01 midió…», «PRI-04
  // midió…», …). En la ruta Multidominio (4 piezas pertinentes a la vez) eso eran hasta 4 líneas casi iguales —
  // repetición, no información — y el peso de esas líneas empujó a esa ruta 10 palabras sobre el techo de 900.
  // El owner decidió la opción (b) del hallazgo que reporté: «combiná todas las líneas de sobrantes en una
  // sola» — un total y un desglose por veredicto, en vez de un desglose por pieza. «Un presupuesto que se pasa
  // siempre no es un presupuesto» — el mismo defecto 2, en otra forma. No se tocó el contenido propio de
  // Multidominio (fuera de este encargo) ni el acotador 1 (`agregadoPorPieza`, arriba, que sigue una línea por
  // pieza — ese formato es el establecido y no es lo que se pidió cambiar).
  if (sobrantes.length) {
    // ★ owner 2026-09-23 (cierre de CAU-01) — esta línea puede mezclar los DOS vocabularios de estado (ver la
    // nota junto a `_esPositivo` arriba): se cuenta cada uno por separado, para que un "señal"/"bajo_piso" (un
    // veredicto MEDIDO) nunca se reporte como "sin poder saberse". Solo aparecen las palabras de los estados que
    // de verdad están en `sobrantes` — con un solo vocabulario, la línea queda tan corta como antes. Desde el
    // rediseño en bloque (owner 2026-09-24) esto solo puede pasar con CAU-06/CAU-03 (vocabulario "ocurre").
    const nOcurre = sobrantes.filter((x) => x.estado === "ocurre").length;
    const nSenal = sobrantes.filter((x) => x.estado === "senal").length;
    const nNoOcurre = sobrantes.filter((x) => x.estado === "no_ocurre").length;
    const nBajoPiso = sobrantes.filter((x) => x.estado === "bajo_piso").length;
    const nIndet = sobrantes.length - nOcurre - nSenal - nNoOcurre - nBajoPiso;
    const partes = [
      nOcurre ? `${nOcurre} ocurre` : null,
      nSenal ? `${nSenal} señal` : null,
      nNoOcurre ? `${nNoOcurre} no` : null,
      nBajoPiso ? `${nBajoPiso} bajo el piso` : null,
      nIndet ? `${nIndet} sin poder saberse` : null,
    ].filter(Boolean).join(", ");
    salida.push({ texto: `${sobrantes.length} mediciones más no entraron por espacio en esta sección: ${partes}.`, fuente: null, alcance: null, fecha: null, vigencia: null, firma: null });
  }

  // ★ la línea de cobertura de PRI-04/CAU-01 (regla 4 del diseño sellado) ya NO se agrega acá aparte (owner
  // 2026-09-24): el cierre (piso + cobertura) va DENTRO del bloque de cada pieza (ver `_BLOQUE_POR_CALCULO`
  // arriba), servido por `coberturaCargaVsResto`/`coberturaPisoDeCobranza` — la MISMA función, una sola vez,
  // nunca duplicada entre el bloque y una línea suelta.

  return { salida, sobrantes, detalle, invalidas, tabla };
}

/** referenciaDelOficio({ perfil, pregunta, entidadesEnRespuesta, scenario, activo, catalogo }) →
 *  [{texto,fuente,...}] — EL ENGANCHE que reemplaza (envolviendo) a `seleccionarConocimientoDelOficio` en los
 *  cuatro sitios de `componer.js`. Firma compatible: si se omite todo salvo `perfil`, se comporta igual que la
 *  función que envuelve (catálogo vacío hoy en perfilCliente.js).
 *
 *  `catalogo` (opcional, default `PIEZAS_CONOCIMIENTO` — el real, las 4 piezas en "borrador"): NUNCA lo pasa
 *  ningún camino de producción. Existe para que `_conocimiento_gate.mjs` pueda probar la prueba de identidad
 *  (§9) con una pieza de prueba FIRMADA que sí se sirve, sin sembrar nada firmado en el catálogo real. */
export function referenciaDelOficio({ perfil, pregunta = "", entidadesEnRespuesta = [], scenario = ESCENARIO_INICIAL, activo = ADI_CONOCIMIENTO, catalogo = PIEZAS_CONOCIMIENTO, maxCaracteres = TOPE_CARACTERES_OFICIO } = {}) {
  if (!activo) return seleccionarConocimientoDelOficio(perfil);                 // puerta 1 — byte-idéntico a hoy
  if (!perfilAutorizaConocimiento(perfil)) return [];                           // puerta 2 — perfil incompleto

  const { validas } = piezasValidas(catalogo, {});
  const firmadas = validas.filter((p) => p.estado === "firmada");
  if (!firmadas.length) return [];                                             // puerta 3 — nada firmado todavía

  const { salida } = _procesar(firmadas, { scenario, pregunta, entidadesEnRespuesta, perfil, maxCaracteres });
  if (!salida.length) {
    const tabla = construirTablaDeSenales({ scenario, pregunta, entidadesEnRespuesta });
    const rec = recuentoDeLoRevisado(firmadas, tabla, perfil, pregunta);
    if (rec) salida.push({ texto: rec.texto, fuente: null, alcance: null, fecha: null, vigencia: null, firma: null });
  }
  return salida;
}

/** _evaluarInfraestructura({ catalogo, scenario, pregunta, entidadesEnRespuesta, perfil }) → { salida, sobrantes,
 *  detalle, invalidas, tabla } — corre el pipeline COMPLETO sin la puerta 3 (firma), para probar el MECANISMO
 *  (pertinencia + medición + acotadores + recuento) sobre datos reales sin servir nada a un cliente. Uso
 *  exclusivo de `_conocimiento_gate.mjs` y de un informe — `referenciaDelOficio` (la función de producción)
 *  NUNCA llama a esto. */
export function _evaluarInfraestructura({ catalogo = PIEZAS_CONOCIMIENTO, scenario = ESCENARIO_INICIAL, pregunta = "", entidadesEnRespuesta = [], perfil = null, maxCaracteres = TOPE_CARACTERES_OFICIO } = {}) {
  return _procesar(catalogo, { scenario, pregunta, entidadesEnRespuesta, perfil, maxCaracteres });
}
