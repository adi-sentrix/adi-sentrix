/* === ingesta/handleIngesta.server.js · EL ARCHIVO DEL USUARIO SE PROCESA EN EL SERVIDOR (owner 2026-08-23) ====
 *
 * POR QUÉ EN EL SERVIDOR, y no es una preferencia: `leerLibro` descomprime el `.xlsx` con `node:zlib`, que en el
 * navegador NO EXISTE. Se podría reescribir con `DecompressionStream`, pero eso convierte una función síncrona en
 * asíncrona y arrastra a todos sus consumidores y a sus gates. Procesarlo en el borde del servidor es más barato Y
 * es mejor para la frontera del dato: el archivo se lee donde ya se leen los demás datos de empresa.
 *
 * ⚠️ RUNTIME NODE, NO EDGE. `/api/adi-data` corre en edge, pero el edge tampoco tiene `node:zlib`. Este endpoint
 * va en node, igual que `/api/adi-narrate-c` — y por el mismo tipo de razón: lo que necesita, el edge no lo tiene.
 *
 * EL ORDEN IMPORTA, y es la decisión del owner («abre antes de analizar»): viajan juntos la preview, las alarmas
 * y el dataset, pero es la PANTALLA la que decide cuándo activarlo. Acá no se activa nada.
 *
 * NO PERSISTE NADA. El archivo se lee, se convierte y se devuelve; no se guarda en disco ni en memoria del
 * servidor. Sin base de datos todavía, guardar sería inventar un lugar donde dejar el dato de un cliente.
 *
 * CERO LLAMADAS AL MODELO. Leer, validar y detectar alarmas es todo determinístico. Este endpoint no gasta.
 */
import { ingestarPlantilla } from "./plantilla/ingestarPlantilla.js";
import { leerPlausibilidad, textoDeApertura, selloDeLaLectura } from "./plausibilidad.js";
import { plantillaVacia, plantillaEjemplo } from "./plantilla/generarPlantilla.js";
import { PLANTILLA_VERSION } from "../config/contract/plantilla.js";

/** Los umbrales con los que se juzga la plausibilidad salen de lo que el NEGOCIO declaró en su cabecera —
 *  nunca de un número puesto acá. Sin umbral declarado, la señal que lo necesita simplemente no aplica. */
function umbralesDe(dataset) {
  const p = (dataset && dataset.perfil) || {};
  const u = {};
  for (const k of ["dohMax", "rotacionMin", "benchmark"]) if (typeof p[k] === "number") u[k] = p[k];
  return u;
}

/* handleIngesta(body) → { ok:true, preview, alarmas, dataset } | { ok:false, motivo, preview }
 * `body.archivo` = el .xlsx en base64 · `body.nombre` = cómo se llama, para poder nombrarlo en pantalla. */
export async function handleIngesta(body = {}) {
  /* DESCARGAR LA PLANTILLA TAMBIÉN ES COSA DEL SERVIDOR: se ARMA con las mismas rutinas de compresión que la
   * leen. Que salga del contrato y no de un archivo guardado es lo que garantiza que la planilla que baja el
   * usuario y la que ADI espera sean la misma — un .xlsx versionado se desincronizaría en silencio. */
  if (body.op === "plantilla") {
    const conEjemplo = body.conEjemplo !== false;
    const libro = conEjemplo ? plantillaEjemplo() : plantillaVacia();
    return { ok: true, op: "plantilla", version: PLANTILLA_VERSION,
      nombre: "Plantilla_ADI_" + PLANTILLA_VERSION + (conEjemplo ? "_ejemplo" : "") + ".xlsx",
      archivo: Buffer.from(libro).toString("base64") };
  }

  const b64 = typeof body.archivo === "string" ? body.archivo : "";
  const nombreArchivo = String(body.nombre || "").slice(0, 80);
  if (!b64) return { ok: false, motivo: "no llegó ningún archivo" };

  let buf;
  try { buf = Buffer.from(b64, "base64"); } catch { return { ok: false, motivo: "el archivo no se pudo decodificar" }; }
  /* TOPE DE TAMAÑO. Una plantilla llena de verdad pesa decenas de KB; 12 MB es holgura enorme y a la vez impide
   * que un archivo equivocado —un video, un respaldo— tumbe la función. El límite se declara en el mensaje. */
  if (buf.length > 12 * 1024 * 1024) return { ok: false, motivo: "el archivo pesa más de 12 MB: ¿es la plantilla?" };

  let r;
  try { r = ingestarPlantilla(buf, { nombreArchivo }); }
  catch (e) { return { ok: false, motivo: `no se pudo leer el archivo: ${(e && e.message) || "formato inesperado"}` }; }

  /* EL RECHAZO TAMBIÉN ES UNA RESPUESTA ÚTIL: viaja la preview con sus bloqueos, porque rechazar sin decir qué
   * corregir convierte la plantilla en un obstáculo en vez de una puerta. */
  if (!r || !r.ok) return { ok: false, motivo: "el archivo no pasó la validación", preview: (r && r.preview) || null };

  const filasPorPeriodo = (r.preview && r.preview.periodos && r.preview.periodos.filas) || null;
  const lectura = leerPlausibilidad(r.dataset, { umbrales: umbralesDe(r.dataset), filasPorPeriodo });

  /* LA APERTURA SE REDACTA ACÁ, no en la pantalla: es la misma función que ya probó el gate de plausibilidad, y
   * duplicar la redacción en React sería una segunda verdad sobre el mismo hallazgo. El sello viaja junto porque
   * la observación tiene que quedar pegada a las lecturas posteriores, no morir en el momento de confirmar. */
  return { ok: true, preview: r.preview, alarmas: lectura.alarmas, dataset: r.dataset,
    apertura: textoDeApertura(lectura, { archivo: nombreArchivo }),
    sello: selloDeLaLectura(lectura, { confirmado: false }),
    /* LOS DOS SELLOS SALEN DE LA MISMA FUNCIÓN, y por eso viajan los dos: el usuario todavía no decidió cuando
     * se arma esta respuesta. Si la pantalla tuviera que redactar el sello confirmado por su cuenta, habría dos
     * redacciones para el mismo hallazgo — la clase de duplicación que este producto trata como defecto. */
    selloConfirmado: selloDeLaLectura(lectura, { confirmado: true }) };
}
