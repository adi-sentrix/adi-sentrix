/* === src/adi/continuidad/retomar.js · LA ACCIÓN «RETOMAR» (Etapa 2 · owner 2026-09-25/26) ══════════════════════
 * `_ADI_DISENO_FLUJO_V2.md` §B, textual: «Entrada {conversacionId}; salida: estado vigente completo + los
 * hechos de las últimas N Entregas RE-VERIFICADOS contra la versión activa (`igual` | `cambió: valor nuevo` |
 * `ya no existe`). No se recompone prosa: se devuelven hechos con id.»
 *
 * POR QUÉ LA RE-VERIFICACIÓN SE INYECTA. Este módulo no tiene ni debe tener acceso al pack activo ni al índice
 * de evidencia del turno (eso es del compositor, `entrega/componer.js`, fuera del alcance de esta pieza) — así
 * que recibe un verificador ya armado por quien llama: `reverificar(hechoRegistrado, ctx) → {estado, valorNuevo?}`.
 * Sin verificador, el resultado es `"sin_reverificar"` para TODO — nunca se inventa un veredicto («falla
 * cerrado», CLAUDE.md §1): decir "igual" sin haber mirado sería la misma mentira que decir "cambió" sin mirar.
 *
 * Puro: no toca ningún almacén — el CALLER ya leyó el libro con `almacen.js:leerLibro` y se lo pasa entero. */
import { detectarCambioVersion } from "./libro.js";
import { estadoVigenteDe, eventosDeContinuidad, lineaDeContinuidad } from "./estadoVigente.js";

const _labelDeHecho = (h) => [h.entidad || h.sujeto || null, h.metrica || h.concepto || null].filter(Boolean).join(" · ") || h.id;

/** retomar(libro, {versionIdActual?, reverificar?}) → { estadoVigente, hechos, eventos, lineaContinuidad } | null
 *   hechos = [ {...hechoRegistrado, estadoReverificacion: "igual"|"cambio"|"ya_no_existe"|"sin_reverificar", valorNuevo?} ]
 * Recorre TODAS las Entregas no recortadas del libro (una entrega recortada ya perdió sus hechos: no hay nada
 * que re-verificar en ella, y su `n`/`temas`/`versionId` siguen visibles en `estadoVigente.loEntregado`). */
export function retomar(libro, { versionIdActual = null, reverificar = null } = {}) {
  if (!libro) return null;

  const cambioVersion = detectarCambioVersion(libro, versionIdActual);
  const reverificarFn = typeof reverificar === "function" ? reverificar : null;

  const todosLosHechos = (libro.entregas || []).filter((e) => !e.recortada).flatMap((e) => Array.isArray(e.hechos) ? e.hechos : []);
  const hechos = todosLosHechos.map((h) => {
    const r = reverificarFn ? (reverificarFn(h, { versionIdActual, libro }) || { estado: "sin_reverificar" }) : { estado: "sin_reverificar" };
    const estado = ["igual", "cambio", "ya_no_existe", "sin_reverificar"].includes(r.estado) ? r.estado : "sin_reverificar";
    return { ...h, estadoReverificacion: estado, ...(r.valorNuevo != null ? { valorNuevo: r.valorNuevo } : {}) };
  });

  const cifrasReverificadas = hechos
    .filter((h) => h.estadoReverificacion === "cambio" || h.estadoReverificacion === "ya_no_existe")
    .map((h) => ({ id: h.id, label: _labelDeHecho(h), estado: h.estadoReverificacion, valorNuevo: h.valorNuevo }));

  const eventos = eventosDeContinuidad({ cambioVersion, cifrasReverificadas });
  const estadoVigente = estadoVigenteDe(libro, { versionIdActual });

  return { estadoVigente, hechos, eventos, lineaContinuidad: lineaDeContinuidad(eventos) };
}
