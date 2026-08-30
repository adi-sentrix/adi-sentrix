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
  /* ── v2 · EL COBRO ENTRA A LA PLANTILLA (owner 2026-08-30) ──────────────────────────────────────────
   *
   * ⚠️ ROMPE LOS ARCHIVOS LLENADOS CON LA v1, y el owner lo decidió sabiéndolo: «no importa si debemos
   * rellenar nuevamente y volver a cargar los datos, el folio es un campo obligatorio». Lo rompe UNA sola
   * cosa —el folio obligatorio— y se hace ahora porque es el último momento en que romper cuesta cero: no
   * hay ningún cliente real cargado. Con clientes adentro, la misma decisión cuesta una migración de datos.
   *
   * QUÉ ENTRA:
   *   · `folio` OBLIGATORIO en Ventas — sin él no hay forma de juntar las líneas de una misma factura, y
   *     sobre eso se apoyan el cobro, las notas de crédito y cualquier auditoría del documento.
   *   · `tipo de documento` y `condición`, opcionales. La condición no es solo para saber a quién aplicarle
   *     el plazo: es el criterio para saber qué venta está REALMENTE a crédito — sin ella el pendiente
   *     incluiría lo cobrado al contado y estaría inflado.
   *   · hoja `Abonos`, OPCIONAL. No rompe nada: el validador solo bloquea si falta una hoja obligatoria, y
   *     quien no la llena simplemente no ve Flujo Comercial, igual que hoy sin Inventario no ve Capital.
   *   · el orden de Ventas pasa a ser ejecutivo (quién · cuándo · qué documento · dónde · qué · cuánto).
   *     REORDENAR NO ROMPE: se comprobó en el validador, que busca cada columna por su TÍTULO.
   *
   * LO QUE NO ENTRA, y no es olvido: `mes`, `año` y el costo medio unitario salen de columnas que ya están.
   * La plantilla rechaza columnas calculadas para que no haya dos verdades sobre la misma cifra. */
  v2: {
    desde: "2026-08-30",
    razon:
      "Entra el cobro. El folio pasa a obligatorio —única ruptura, aceptada por el owner porque hoy no hay " +
      "ningún cliente real cargado— y con él tipo de documento y condición (crédito/contado), las dos " +
      "opcionales. Se agrega la hoja Abonos, opcional: quien no la llena no ve Flujo Comercial. Ventas queda " +
      "en orden ejecutivo; reordenar no rompe nada porque el validador ubica cada columna por su título.",
    hojas: {
      Ventas: [
        { campo: "cliente", titulo: "cliente", obligatoria: true },
        { campo: "fecha", titulo: "fecha (aaaa-mm-dd)", obligatoria: true },
        { campo: "folio", titulo: "folio", obligatoria: true },
        { campo: "tipoDoc", titulo: "tipo de documento", obligatoria: false },
        { campo: "condicion", titulo: "condición", obligatoria: false },
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
      Abonos: [
        { campo: "cliente", titulo: "cliente", obligatoria: true },
        { campo: "fecha", titulo: "fecha (aaaa-mm-dd)", obligatoria: true },
        { campo: "folio", titulo: "folio", obligatoria: true },
        { campo: "monto", titulo: "monto", obligatoria: true },
      ],
    },
    parametros: [
      { clave: "empresa_id", etiqueta: "identificador de tu empresa", obligatorio: true },
      { clave: "empresa_nombre", etiqueta: "nombre de tu empresa", obligatorio: true },
      { clave: "periodo_actual", etiqueta: "fecha de cierre del período que informas (aaaa-mm-dd)", obligatorio: true },
      { clave: "moneda", etiqueta: "moneda de los montos (CLP, USD, …)", obligatorio: false },
    ],
  },
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

/* compararColumnas(selladas, vivas) → { compatible, agregadas:[], rupturas:[{ tipo, campo, detalle }] }
 *
 * ⚠️ EL ORDEN NO ROMPE NADA, Y ESTA FUNCIÓN DECÍA QUE SÍ (corregido 2026-08-30). Marcaba «reordenada» como
 * ruptura con este motivo: «el validador ubica cada dato por su columna, así que un archivo ya llenado
 * quedaría corrido». **Eso es falso.** Se fue a leer el validador: recorre los encabezados DEL ARCHIVO DEL
 * USUARIO, encuentra cada columna por su TÍTULO y guarda la posición que tiene ahí (`posPorCampo.set(campo, i)`
 * en `validarPlantilla.js`); después lee cada fila con esa posición. El orden de nuestro contrato no interviene.
 *
 * LO QUE COSTABA LA REGLA MAL PUESTA: cobraba una re-carga de todos los archivos por un cambio que no rompe
 * nada. Una garantía más estricta que la realidad no es prudencia — es una que se va a terminar ignorando, y
 * el día que ignore una de verdad nadie va a notar la diferencia.
 *
 * LO QUE SÍ ROMPE, y es lo único:
 *   · QUITAR una columna     → el archivo que la trae recibe «columna-de-más» y se bloquea
 *   · RENOMBRAR una          → el título deja de encontrarse; la columna se lee como ausente
 *   · VOLVERLA OBLIGATORIA   → todo archivo que la dejó vacía deja de entrar
 *   · AGREGAR una OBLIGATORIA→ ningún archivo anterior la trae
 * Agregar una opcional, en cualquier posición, y reordenar: compatibles. */
export function compararColumnas(selladas = [], vivas = []) {
  const rupturas = [];
  const porCampoVivo = new Map(vivas.map((c) => [c.campo, c]));
  const camposSellados = new Set(selladas.map((c) => c.campo));

  for (const s of selladas) {
    const v = porCampoVivo.get(s.campo);
    if (!v) {
      rupturas.push({ tipo: "quitada", campo: s.campo, detalle: `«${s.titulo}» ya no está: los archivos que la traen dejan de validar` });
      continue;
    }
    if (v.titulo !== s.titulo) {
      rupturas.push({ tipo: "renombrada", campo: s.campo, detalle: `«${s.titulo}» pasó a llamarse «${v.titulo}»: el archivo del cliente sigue diciendo lo viejo, y el validador busca por título` });
    }
    if (!s.obligatoria && v.obligatoria) {
      rupturas.push({ tipo: "volvio-obligatoria", campo: s.campo, detalle: `«${s.titulo}» era opcional y ahora es obligatoria: todo archivo que la dejó vacía deja de entrar` });
    }
  }

  /* Lo agregado, esté donde esté. Ya no se mira «lo que viene después de la última sellada»: con el orden
   * libre, esa cuenta no significa nada. Se mira qué campos son nuevos. */
  const agregadas = vivas.filter((v) => !camposSellados.has(v.campo));
  for (const a of agregadas) {
    if (a.obligatoria) {
      rupturas.push({ tipo: "nueva-obligatoria", campo: a.campo, detalle: `«${a.titulo}» es nueva y obligatoria: ningún archivo anterior la trae, así que todos dejan de validar` });
    }
  }

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
