/* === config/contract/plantillaSellada.js · LA ESTRUCTURA CONGELADA (owner 2026-08-26) =========================
 *
 * LA REGLA, textual, al cerrar la v1.6: «a partir de aquí congelamos estructura de plantilla. No más cambios de
 * columnas salvo defecto grave. Si agregamos algo, debe ser compatible hacia adelante o ir como nueva versión
 * explícita».
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. La estructura cambió DOS VECES EN DOS VERSIONES —v1.5 sacó cuatro columnas de
 * Inventario, v1.6 movió los datos de empresa a su hoja, cambió el período por fecha, sacó bodega de Ventas y
 * agregó punto de venta—, y cada cambio INVALIDÓ los archivos que la gente ya había llenado, incluido el que el
 * owner llenó a mano. Un cliente que llena una planilla con cuidado y al mes siguiente recibe «bajate la nueva»
 * deja de confiar en el producto antes de haber visto una respuesta.
 *
 * ⚠️ ESTE ARCHIVO ES UN SELLO, NO UNA COPIA. `plantilla.js` sigue siendo el contrato vivo y la única fuente de
 * lo que la plantilla pide. Acá se graba QUÉ ESTRUCTURA SE APROBÓ para cada versión, para que un cambio no
 * pueda pasar en silencio. `_plantilla_congelada_gate` compara los dos.
 *
 * ⚠️ HASTA DÓNDE LLEGA EL CANDADO, dicho sin adornos: nada impide editar este archivo para que coincida con un
 * contrato cambiado. Lo que impide es hacerlo SIN QUE SE VEA — para poner el gate en verde después de una
 * ruptura hay que subir `PLANTILLA_VERSION` y escribir por qué, y las dos cosas quedan en el diff con nombre y
 * fecha. La decisión de romper sigue siendo del owner: «defecto grave lo decido yo, no el código».
 */

/* ── LO APROBADO, VERSIÓN POR VERSIÓN ─────────────────────────────────────────────────────────────────────────
 * Una entrada por `PLANTILLA_VERSION`. `razon` es obligatoria y no es decorativa: es la única forma de que
 * dentro de seis meses se sepa por qué se rompió la compatibilidad, y de que romperla cueste algo. */
export const PLANTILLA_SELLADA = {
  v1: {
    desde: "2026-08-26",
    razon:
      "Primera estructura congelada, tal como quedó en la v1.6 del producto. Cuatro pestañas (Empresa · Ventas · " +
      "Inventario · Ejemplo), los datos del negocio separados de los datos de venta, el período con día completo, " +
      "punto de venta capturado para el futuro, y las políticas fuera de la plantilla para reducir fricción.",
    hojas: {
      Ventas: [
        { campo: "fecha", titulo: "fecha (aaaa-mm-dd)", obligatoria: true },
        { campo: "cliente", titulo: "cliente", obligatoria: true },
        { campo: "puntoVenta", titulo: "punto de venta", obligatoria: false },
        { campo: "canal", titulo: "canal", obligatoria: false },
        { campo: "sku", titulo: "sku", obligatoria: true },
        { campo: "marca", titulo: "marca", obligatoria: false },
        { campo: "sfamilia", titulo: "familia", obligatoria: false },
        { campo: "unidades", titulo: "unidades", obligatoria: true },
        { campo: "venta", titulo: "venta", obligatoria: true },
        { campo: "costo", titulo: "costo", obligatoria: true },
        { campo: "acciones", titulo: "acciones comerciales", obligatoria: false },
        { campo: "precioLista", titulo: "precio de lista", obligatoria: false },
      ],
      Inventario: [
        { campo: "sku", titulo: "sku", obligatoria: true },
        { campo: "bodega", titulo: "bodega", obligatoria: false },
        { campo: "stockUnd", titulo: "stock (unidades)", obligatoria: true },
      ],
      /* ⚠️ ABONOS SE AGREGÓ EL 2026-08-27 Y NO SUBE LA VERSIÓN, a propósito. La regla de este archivo es
       * «si agregamos algo, debe ser compatible hacia adelante o ir como nueva versión explícita», y esto es
       * lo primero: la hoja es OPCIONAL y va al final, así que un archivo llenado con la v1 —que no la trae—
       * sigue validando igual. Nada de lo sellado se quitó, se renombró, se reordenó ni se volvió obligatorio.
       * Es el mismo criterio con el que `compararColumnas` ya acepta columnas opcionales agregadas al final.
       *   LO QUE SÍ SEGUIRÍA EXIGIENDO VERSIÓN NUEVA: una hoja obligatoria, o tocar cualquiera de las de
       *   arriba. El gate lo comprueba: una hoja nueva que no sea opcional lo pone rojo. */
      Abonos: [
        { campo: "fecha", titulo: "fecha (aaaa-mm-dd)", obligatoria: true },
        { campo: "factura", titulo: "n° de factura", obligatoria: true },
        { campo: "monto", titulo: "monto", obligatoria: true },
        { campo: "cliente", titulo: "cliente", obligatoria: false },
      ],
    },
    parametros: [
      { clave: "empresa_id", etiqueta: "identificador de tu empresa", obligatorio: true },
      { clave: "empresa_nombre", etiqueta: "nombre de tu empresa", obligatorio: true },
      { clave: "periodo_actual", etiqueta: "fecha de cierre del período que informas (aaaa-mm-dd)", obligatorio: true },
    ],
  },
};

/* ── QUÉ CAMBIO ES COMPATIBLE Y CUÁL NO ───────────────────────────────────────────────────────────────────────
 * La regla que fijó el owner, traducida a código:
 *   · AGREGAR una columna OPCIONAL AL FINAL  → compatible. Un archivo llenado con la versión anterior sigue
 *     validando: la columna nueva simplemente viene vacía, y una opcional vacía ya es un caso previsto.
 *   · QUITAR · RENOMBRAR · REORDENAR · VOLVER OBLIGATORIA → rompe. Un archivo ya llenado deja de validar, o —peor—
 *     valida con la columna equivocada. Exige subir `PLANTILLA_VERSION`.
 *
 * Se compara por POSICIÓN y no por nombre a propósito: reordenar dos columnas no cambia el conjunto pero sí
 * rompe todo archivo llenado, porque el validador ubica cada dato por su lugar en la fila. */
const _mismo = (a, b) => a.campo === b.campo && a.titulo === b.titulo && !!a.obligatoria === !!b.obligatoria;

/** compararColumnas(selladas, vivas) → { compatible, agregadas:[], rupturas:[{ tipo, campo, detalle }] } */
export function compararColumnas(selladas = [], vivas = []) {
  const rupturas = [];
  const porCampoSellado = new Map(selladas.map((c) => [c.campo, c]));
  const porCampoVivo = new Map(vivas.map((c) => [c.campo, c]));

  for (let i = 0; i < selladas.length; i++) {
    const s = selladas[i], v = vivas[i];
    if (!porCampoVivo.has(s.campo)) {
      rupturas.push({ tipo: "quitada", campo: s.campo, detalle: `«${s.titulo}» ya no está: los archivos que la traen dejan de validar` });
      continue;
    }
    if (!v || v.campo !== s.campo) {
      rupturas.push({ tipo: "reordenada", campo: s.campo, detalle: `«${s.titulo}» cambió de lugar (posición ${i + 1}): el validador ubica cada dato por su columna, así que un archivo ya llenado quedaría corrido` });
      continue;
    }
    if (v.titulo !== s.titulo) {
      rupturas.push({ tipo: "renombrada", campo: s.campo, detalle: `«${s.titulo}» pasó a llamarse «${v.titulo}»: el archivo del cliente sigue diciendo lo viejo` });
    }
    if (!s.obligatoria && v.obligatoria) {
      rupturas.push({ tipo: "volvio-obligatoria", campo: s.campo, detalle: `«${s.titulo}» era opcional y ahora es obligatoria: todo archivo que la dejó vacía deja de entrar` });
    }
  }

  /* Lo que se agregó al final. Solo es compatible si TODO lo agregado es opcional: una columna nueva obligatoria
   * invalida cualquier archivo anterior, esté al final o no. */
  const agregadas = vivas.slice(selladas.length);
  for (const a of agregadas) {
    if (a.obligatoria) {
      rupturas.push({ tipo: "nueva-obligatoria", campo: a.campo, detalle: `«${a.titulo}» es nueva y obligatoria: ningún archivo anterior la trae, así que todos dejan de validar` });
    }
  }
  /* Una columna nueva METIDA EN EL MEDIO ya se reporta arriba como «reordenada» de la que desplazó. */

  return { compatible: rupturas.length === 0, agregadas: agregadas.map((a) => a.titulo), rupturas };
}

/** compararParametros(sellados, vivos) → misma forma. La hoja Empresa se juzga por CLAVE, no por posición:
 *  ahí cada campo se lee por su etiqueta, no por su lugar, así que reordenarla no rompe nada. */
export function compararParametros(sellados = [], vivos = []) {
  const rupturas = [];
  const porClave = new Map(vivos.map((p) => [p.clave, p]));
  for (const s of sellados) {
    const v = porClave.get(s.clave);
    if (!v) { rupturas.push({ tipo: "quitado", campo: s.clave, detalle: `«${s.etiqueta}» ya no se pide` }); continue; }
    if (v.etiqueta !== s.etiqueta) rupturas.push({ tipo: "renombrado", campo: s.clave, detalle: `«${s.etiqueta}» pasó a llamarse «${v.etiqueta}»` });
    if (!s.obligatorio && v.obligatorio) rupturas.push({ tipo: "volvio-obligatorio", campo: s.clave, detalle: `«${s.etiqueta}» era opcional y ahora es obligatorio` });
  }
  const clavesSelladas = new Set(sellados.map((p) => p.clave));
  const agregados = vivos.filter((p) => !clavesSelladas.has(p.clave));
  for (const a of agregados) {
    if (a.obligatorio) rupturas.push({ tipo: "nuevo-obligatorio", campo: a.clave, detalle: `«${a.etiqueta}» es nuevo y obligatorio: ningún archivo anterior lo trae` });
  }
  return { compatible: rupturas.length === 0, agregadas: agregados.map((a) => a.etiqueta), rupturas };
}
