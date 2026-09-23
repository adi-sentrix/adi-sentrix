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
 *   3 · ninguna pieza `estado === "firmada"` — la regla que prueba esta siembra: las seis piezas de
 *       `piezas.js` nacen `"borrador"`, así que HOY esta puerta sola ya vacía el resultado, sin importar 1 y 2.
 *       Es la prueba de gobierno del documento §9: «que el candado demuestre que una pieza en borrador NO se
 *       sirve».
 *
 * `_evaluarSinFiltroDeFirma` (exportada aparte, NUNCA usada por `referenciaDelOficio`) existe solo para que el
 * candado y un informe puedan mostrar qué haría la infraestructura si las piezas estuvieran firmadas —
 * demuestra el MECANISMO sin adelantarse a la validación del contenido. */
import { ADI_CONOCIMIENTO } from "../../config/voiceFlags.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";
import { perfilAutorizaConocimiento, seleccionarConocimientoDelOficio } from "../../config/contract/perfilCliente.js";
import { PIEZAS_CONOCIMIENTO } from "./piezas.js";
import { piezasValidas } from "./validarPieza.js";
import { construirTablaDeSenales } from "./tablaSenales.js";
import { evaluarPertinencia } from "./evaluarPertinencia.js";
import { medirPieza } from "./medir.js";
import { servirPieza } from "./servir.js";
import { aplicarAcotadores } from "./acotadores.js";
import { recuentoDeLoRevisado } from "./recuento.js";

const _PLURAL = { cuenta: "cuentas", sku: "SKU" };

/* el corazón, factorizado para que el gate pueda pedir el resultado CON el filtro de firma (el que se sirve de
 * verdad) o SIN él (para demostrar el mecanismo sobre las piezas borrador, nunca servido a un cliente). */
function _procesar(catalogo, { scenario, pregunta, entidadesEnRespuesta, perfil, maxCaracteres }) {
  const { validas, invalidas } = piezasValidas(catalogo, {});
  const tabla = construirTablaDeSenales({ scenario, pregunta, entidadesEnRespuesta });

  const items = [];
  const detalle = [];   // traza completa por (pieza, entidad) — para el informe/gate, no para la Entrega
  for (const pieza of validas) {
    const pert = evaluarPertinencia(pieza, tabla, perfil, pregunta);
    if (!pert.pertinente) { detalle.push({ piezaId: pieza.id, pertinente: false, motivo: pert.motivo }); continue; }
    const entidades = pert.entidades.length ? pert.entidades : [null];
    for (const entidad of entidades) {
      const medicion = medirPieza(pieza, entidad, tabla);
      detalle.push({ piezaId: pieza.id, entidad, pertinente: true, estado: medicion.estado, motivo: medicion.motivo, resolveria: medicion.resolveria, cifra: medicion.cifra, referencia: medicion.referencia });
      const servido = servirPieza(pieza, entidad, medicion);
      if (servido) items.push({ ...servido, _calculo: pieza.medicion.calculo, _etiqueta: pieza.etiqueta, _resolveria: medicion.resolveria, _porEntidad: pieza.medicion.por_entidad });
    }
  }

  const { servidos, sobrantes, agregadoPorPieza } = aplicarAcotadores(items, { entidadesEnRespuesta, maxCaracteres });
  const salida = servidos.map((s) => ({ texto: s.texto, fuente: s.fuente, alcance: s.alcance, fecha: s.fecha, vigencia: s.vigencia, firma: s.firma }));
  for (const [piezaId, lst] of agregadoPorPieza) {
    if (!lst.length) continue;
    const eje = _PLURAL[lst[0]._porEntidad] || "casos";
    const nOcurre = lst.filter((x) => x.estado === "ocurre").length;
    salida.push({ texto: `Y en ${lst.length} ${eje} más del mismo conjunto (${piezaId}): ${nOcurre} ocurre, ${lst.length - nOcurre} no — ver «Qué más puedo calcular».`, fuente: null, alcance: null, fecha: null, vigencia: null, firma: null });
  }

  return { salida, sobrantes, detalle, invalidas, tabla };
}

/** referenciaDelOficio({ perfil, pregunta, entidadesEnRespuesta, scenario, activo, catalogo }) →
 *  [{texto,fuente,...}] — EL ENGANCHE que reemplaza (envolviendo) a `seleccionarConocimientoDelOficio` en los
 *  cuatro sitios de `componer.js`. Firma compatible: si se omite todo salvo `perfil`, se comporta igual que la
 *  función que envuelve (catálogo vacío hoy en perfilCliente.js).
 *
 *  `catalogo` (opcional, default `PIEZAS_CONOCIMIENTO` — el real, las 6 piezas en "borrador"): NUNCA lo pasa
 *  ningún camino de producción. Existe para que `_conocimiento_gate.mjs` pueda probar la prueba de identidad
 *  (§9) con una pieza de prueba FIRMADA que sí se sirve, sin sembrar nada firmado en el catálogo real. */
export function referenciaDelOficio({ perfil, pregunta = "", entidadesEnRespuesta = [], scenario = ESCENARIO_INICIAL, activo = ADI_CONOCIMIENTO, catalogo = PIEZAS_CONOCIMIENTO, maxCaracteres = 2000 } = {}) {
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
export function _evaluarInfraestructura({ catalogo = PIEZAS_CONOCIMIENTO, scenario = ESCENARIO_INICIAL, pregunta = "", entidadesEnRespuesta = [], perfil = null, maxCaracteres = 2000 } = {}) {
  return _procesar(catalogo, { scenario, pregunta, entidadesEnRespuesta, perfil, maxCaracteres });
}
