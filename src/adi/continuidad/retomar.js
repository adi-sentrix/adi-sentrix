/* === src/adi/continuidad/retomar.js · LA ACCIÓN «RETOMAR» (Etapa 2 · owner 2026-09-25/26 · bloque 4, 2026-10-04) ═════════════════
 * `_ADI_DISENO_FLUJO_V2.md` §B, textual: «Entrada {conversacionId}; salida: estado vigente completo + los
 * hechos de las últimas N Entregas RE-VERIFICADOS contra la versión activa (`igual` | `cambió: valor nuevo` |
 * `ya no existe`). No se recompone prosa: se devuelven hechos con id.»
 *
 * POR QUÉ LA RE-VERIFICACIÓN SE INYECTA. Este módulo no tiene ni debe tener acceso al pack activo ni al índice
 * de evidencia del turno (eso es del compositor, `entrega/componer.js`, fuera del alcance de esta pieza) — así
 * que recibe un verificador ya armado por quien llama: `reverificar(hechoRegistrado, ctx) → {estado, valorNuevo?, revalidacion?}`.
 * Sin verificador, el resultado es `"sin_reverificar"` para TODO — nunca se inventa un veredicto («falla
 * cerrado», CLAUDE.md §1): decir "igual" sin haber mirado sería la misma mentira que decir "cambió" sin mirar.
 *
 * ═══ BLOQUE 4 (owner 2026-10-04) — EL VERIFICADOR REAL ═══════════════════════════════════════════════════════════════════════
 * `capacidad/acciones.js:retomar` ya arma el verificador (`revalidar.js:reverificadorDe`): le vuelve a preguntar al Core, HOY, lo mismo que se le preguntó
 * entonces y compara cifra por cifra. Eso suma, SIN cambiar lo de siempre:
 *   · los dos estados nuevos (`no_comparable`, `no_se_revalida`), los seis de `revalidar.js:ESTADOS_DE_REVALIDACION`;
 *   · la `revalidacion` COMPLETA de cada hecho (estado, motivo, anterior, actual, diferencia, cargas) y un `resumen` con el conteo por estado;
 *   · una sola línea de continuidad, SOLO ante evento (`estadoVigente.js`): el cambio de datos y los cambios de cifras — la línea nombra hasta
 *     `CAMBIOS_NOMBRADOS_MAX` (3) y dice cuántos más hay; el detalle completo viaja tipado en `hechos[].revalidacion`. Qué cambios nombra lo decide
 *     `revalidar.js:elegirCambiosANombrar` con la prioridad que la Entrega original ya traía — este módulo no inventa ningún orden.
 * `cifrasReverificadas` sigue saliendo SOLO de `cambio` y `ya_no_existe`: lo que no se pudo comparar, lo que no se midió y lo que sigue igual no generan texto.
 * Un verificador de la forma de antes (`{estado, valorNuevo?}`, sin `revalidacion`) se sigue leyendo igual: un evento por cifra, como siempre.
 *
 * Puro: no toca ningún almacén — el CALLER ya leyó el libro con `almacen.js:leerLibro` y se lo pasa entero. */
import { detectarCambioVersion } from "./libro.js";
import { estadoVigenteDe, eventosDeContinuidad, lineaDeContinuidad } from "./estadoVigente.js";
import { ESTADOS_DE_REVALIDACION, resumirRevalidacion, elegirCambiosANombrar, etiquetaDeCifra, cifrasDeLaEntrega } from "./revalidar.js";

const _labelDeHecho = (h) => [h.entidad || h.sujeto || null, h.metrica || h.concepto || null].filter(Boolean).join(" · ") || h.id;

/** retomar(libro, {versionIdActual?, reverificar?, lenguajeDeNegocio?}) → { estadoVigente, hechos, resumen, entregas, eventos, lineaContinuidad } | null
 *   hechos = [ {...hechoRegistrado, estadoReverificacion: "igual"|"cambio"|"ya_no_existe"|"no_comparable"|"no_se_revalida"|"sin_reverificar", valorNuevo?, revalidacion?} ]
 * `lenguajeDeNegocio` (la capacidad lo enciende): la línea habla de «los datos» y de «la Entrega N», nunca de ids de carga («1 → 2», «v3»); sin él, el texto de siempre.
 * Recorre TODAS las Entregas no recortadas del libro (una entrega recortada ya perdió sus hechos: no hay nada
 * que re-verificar en ella, y su `n`/`temas`/`versionId` siguen visibles en `estadoVigente.loEntregado`). */
export function retomar(libro, { versionIdActual = null, reverificar = null, lenguajeDeNegocio = false } = {}) {
  if (!libro) return null;

  const cambioVersion = detectarCambioVersion(libro, versionIdActual);
  const reverificarFn = typeof reverificar === "function" ? reverificar : null;

  const cifrasDeEntregas = (libro.entregas || []).filter((e) => !e.recortada).flatMap((e) => cifrasDeLaEntrega(e));   // una cifra por hecho (una fila ancha de la tabla trae varias: `revalidar.js:cifrasDeLaEntrega`)
  /* LAS DERIVACIONES (Contrato del Anfitrión, owner 2026-10-05): van DESPUÉS de las cifras de las Entregas, con `origen:"derivado"` y los operandos en `sobre`; el verificador las revalida por sus operandos. Un libro sin derivaciones no agrega nada. */
  const derivadas = (Array.isArray(libro.derivaciones) ? libro.derivaciones : []).filter((d) => d && d.id).map((d) => ({
    id: d.id, sujeto: d.entidad != null ? d.entidad : null, metrica: d.metrica || null, valor: d.resultado && d.resultado.texto != null ? d.resultado.texto : null,
    unidad: null, periodo: null, origen: "derivado", sobre: [...(d.sobre || []), ...(d.base ? [d.base] : [])], derivada: true,
  }));
  const todosLosHechos = cifrasDeEntregas.concat(derivadas);
  const hechos = todosLosHechos.map((h) => {
    const r = reverificarFn ? (reverificarFn(h, { versionIdActual, libro }) || { estado: "sin_reverificar" }) : { estado: "sin_reverificar" };
    const estado = ESTADOS_DE_REVALIDACION.includes(r.estado) ? r.estado : "sin_reverificar";
    return { ...h, estadoReverificacion: estado, ...(r.valorNuevo != null ? { valorNuevo: r.valorNuevo } : {}), ...(r.revalidacion ? { revalidacion: r.revalidacion } : {}) };
  });
  const hechosDeEntregas = hechos.filter((h) => !h.derivada);   /* la línea de continuidad nombra a los OPERANDOS que cambiaron, no a su suma: dos veces el mismo cambio sería ruido */
  const conRevalidacion = hechosDeEntregas.some((h) => h.revalidacion);

  const cifrasReverificadas = hechosDeEntregas
    .filter((h) => h.estadoReverificacion === "cambio" || h.estadoReverificacion === "ya_no_existe")
    .map((h) => ({ id: h.id, label: _labelDeHecho(h), estado: h.estadoReverificacion, valorNuevo: h.valorNuevo }));

  /* LO QUE LA LÍNEA NOMBRA (owner 2026-10-04): hasta 3 cambios, elegidos con la prioridad de la Entrega original (`.prioridad` de su fila de Cifras; sin ella, su orden de aparición en la tabla) y la
   * magnitud solo para desempatar; el resto se cuenta («y 4 cambios más; el detalle está disponible»). Solo `cambio` y `ya_no_existe` entran. */
  let cambiosDeCifras = null;
  if (conRevalidacion) {
    const candidatos = [];
    hechosDeEntregas.forEach((h, orden) => {
      if (h.estadoReverificacion !== "cambio" && h.estadoReverificacion !== "ya_no_existe") return;
      const rv = h.revalidacion || {};
      candidatos.push({
        id: h.id, estado: h.estadoReverificacion, etiqueta: etiquetaDeCifra(h),
        antes: rv.anterior ? rv.anterior.valor : h.valor, ahora: rv.actual ? rv.actual.valor : null,
        dedup: `${etiquetaDeCifra(h)}|${rv.anterior ? rv.anterior.valor : h.valor}|${rv.actual ? rv.actual.valor : ""}|${h.estadoReverificacion}`,   // la misma cifra en dos Entregas se nombra una vez
        prioridad: h.rv && Number.isFinite(h.rv.prioridad) ? h.rv.prioridad : null, orden,
        unidad: h.rv ? h.rv.unidad : null, magnitud: rv.diferencia ? Math.abs(rv.diferencia.valor) : null,
      });
    });
    if (candidatos.length) {
      const { nombrados, adicionales } = elegirCambiosANombrar(candidatos);
      cambiosDeCifras = { nombrados: nombrados.map((c) => ({ label: c.etiqueta, estado: c.estado, antes: c.antes, ahora: c.ahora })), adicionales };
    }
  }

  const eventos = eventosDeContinuidad({ cambioVersion, cifrasReverificadas: conRevalidacion ? [] : cifrasReverificadas, cambiosDeCifras, lenguajeDeNegocio });
  const estadoVigente = estadoVigenteDe(libro, { versionIdActual });

  /* LO ENTREGADO, TAL CUAL QUEDÓ (Etapa 2, bloque 1): cada Entrega con SU número, SU versión de carga, CUÁNDO se
   * entregó y el período que declaró — para que quien retoma vea que E1 y E2 son las mismas que se entregaron,
   * sin recomponerlas. Se copia lo guardado; nada se recalcula (el pasado no se reescribe). */
  const entregas = (libro.entregas || []).map((e) => ({
    n: e.n, turno: e.turno, versionId: e.versionId || null, entregadaEn: e.entregadaEn || null, periodo: e.periodo || null,
    temas: Array.isArray(e.temas) ? e.temas.slice() : [], entidades: Array.isArray(e.entidades) ? e.entidades.slice() : [],
    cierre: e.cierre || null, recortada: Boolean(e.recortada),
  }));

  const resumen = resumirRevalidacion(hechos.map((h) => ({ estado: h.estadoReverificacion, motivo: h.revalidacion && h.revalidacion.motivo })));
  return { estadoVigente, hechos, resumen, entregas, eventos, lineaContinuidad: lineaDeContinuidad(eventos) };
}
