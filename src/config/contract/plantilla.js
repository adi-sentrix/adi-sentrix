/* === config/contract/plantilla.js · LA PLANTILLA OFICIAL ADI/SENTRIX · v1 (2026-08-22) =========================
 *
 * LA REGLA CENTRAL, textual del owner: «ADI calcula. El usuario informa hechos. Si el usuario tiene que calcular
 * margen, benchmark o capital inmovilizado antes de subir el archivo, el diseño está mal.»
 *
 * ── POR QUÉ SON DOS HOJAS Y NO SEIS (owner, 2026-08-22) ──────────────────────────────────────────────────────
 * La v0 tenía hojas separadas de Productos, Clientes y Presupuesto: maestros. Y un maestro es trabajo de sistema,
 * no de la persona que está llenando una planilla a mano — mantener un catálogo aparte es justamente lo que hace
 * que una carga manual se abandone a la mitad. Cuando ADI se conecte a un ERP, los maestros van a llegar de ahí y
 * esta plantilla queda como puerta de entrada, no como modelo de datos.
 *
 * Así que quedan **DOS hojas para llenar**: `Ventas` (con la cabecera del negocio arriba) e `Inventario`. La
 * marca, la familia y el canal viajan como columnas de la fila de venta.
 *
 * EL COSTO DE ESA DECISIÓN, y está cubierto: al repetir la marca de un SKU en cada fila aparece una forma nueva de
 * equivocarse — el mismo SKU con dos marcas distintas. No se resuelve eligiendo una (eso sería inventar): el
 * validador lo detecta, nombra las dos filas que se contradicen y rechaza el archivo. Ver `COHERENCIA`.
 *
 * ── LA CABECERA VIVE DENTRO DE `Ventas` ──────────────────────────────────────────────────────────────────────
 * Quién es la empresa, qué período informa y cuál es su benchmark no son datos de una fila: son cuatro celdas.
 * Van arriba de la misma hoja, y la tabla empieza en la fila cuyo primer título es el de la primera columna. Esa
 * regla —buscar el encabezado, no contar filas— es la que hace que agregar un parámetro mañana no rompa nada.
 *
 * ── LA MONEDA LA DECLARA EL CLIENTE, UNA SOLA VEZ (owner, 2026-08-22) ────────────────────────────────────────
 * Los títulos NO dicen «(USD)». Palabra del owner: «si el usuario coloca CLP también es válido, ese es problema
 * nuestro». Imponer la moneda en cada encabezado obliga a convertir antes de subir —trabajo que no le toca— y es
 * la clase de fricción que hace que una carga manual se abandone. La moneda va en la cabecera, una vez, y ADI
 * rotula con ella. Lo que NO se negocia sigue igual: la moneda se DECLARA, nunca se infiere del rango de los
 * valores; esa es la lección de miles-contra-dólares y no depende de en qué moneda esté.
 *
 * ── NADA DE TEXTO DE AYUDA EN LAS HOJAS (owner, 2026-08-22) ──────────────────────────────────────────────────
 * «Eso marea; deja los campos solamente.» Las hojas llevan encabezados y nada más. Lo que cada columna significa
 * vive acá, en el contrato, y sale a pantalla por la preview — no ocupando filas del archivo que hay que llenar.
 *
 * ── QUÉ ES UN HECHO Y QUÉ ES UN PARÁMETRO ────────────────────────────────────────────────────────────────────
 * Un HECHO pasó y el sistema lo registró: vendió 12 unidades a $340 con costo $240 en marzo. Un PARÁMETRO es una
 * decisión: «mi margen de referencia es 30.1%». El benchmark es un parámetro — va en la cabecera y jamás como
 * columna, que es la pregunta que dejó abierta el owner y la estructura contesta.
 */

/** Versión de la plantilla. Viaja en A1: un archivo viejo en un motor nuevo tiene que ser un rechazo con nombre,
 *  no un misterio. v1 (2026-08-22) colapsó las seis hojas de la v0 a dos. */
export const PLANTILLA_VERSION = "v1";
export const MARCA_PLANTILLA = `PLANTILLA OFICIAL ADI/SENTRIX · ${PLANTILLA_VERSION}`;

/* ── LAS HOJAS DEL LIBRO ──────────────────────────────────────────────────────────────────────────────────────
 * Cuatro, y cada una tiene un trabajo distinto (owner 2026-08-26): «si vas a pedir datos de la empresa dejalo en
 * una pestaña sola, para que no se mezcle con la de datos ventas o inventario». Antes los datos de la empresa
 * vivían arriba de la tabla de Ventas y el usuario abría el archivo sin saber dónde empezaba qué. */
export const HOJA_EMPRESA = "Empresa";
export const HOJA_EJEMPLO = "Ejemplo";

/* ── LO QUE SE PIDE DE LA EMPRESA ─────────────────────────────────────────────────────────────────────────────
 * SOLO identidad y período. Orden textual del owner: «deja solo datos de empresa período; aún veo que dice
 * rotación, margen, días de inventario, etc. — no tienes para qué colocar eso».
 *
 * ⚠️ QUÉ SE PIERDE Y CÓMO SE CUBRE, porque no es gratis: se fueron el margen de referencia, el techo de días, la
 * rotación mínima, la mejor práctica y el objetivo de acciones comerciales, y la brecha material. Eran POLÍTICAS
 * del negocio. Sin ellas ADI usa su REFERENCIA GENERAL (`POLICY_CONFIG`) y lo dice en pantalla — que es lo que
 * ya hacía cuando el usuario las dejaba vacías. Ninguna cara se apaga; lo que cambia es contra qué vara se
 * comparan las cifras, y esa vara pasa a ser nuestra y declarada en vez de suya y opcional. */
export const PARAMETROS = [
  { clave: "empresa_id", etiqueta: "identificador de tu empresa", tipo: "texto", obligatorio: true, ejemplo: "andes",
    ayuda: "un nombre corto, en minúscula y sin espacios. solo sirve para identificar tu carga." },
  { clave: "empresa_nombre", etiqueta: "nombre de tu empresa", tipo: "texto", obligatorio: true, ejemplo: "Andes Distribución S.A.",
    ayuda: "el nombre como quieres verlo en pantalla." },
  { clave: "periodo_actual", etiqueta: "fecha de cierre del período que informas (aaaa-mm-dd)", tipo: "fecha", obligatorio: true, ejemplo: "2026-08-31",
    ayuda: "el último día del mes que estás informando. escríbelo así: 2026-08-31." },
];

/* ── LAS DOS HOJAS DE DATOS ───────────────────────────────────────────────────────────────────────────────────
 * `clave: true` marca las columnas que identifican la fila (para detectar duplicados contradictorios).
 * `ayuda` es la explicación que se imprime ARRIBA de cada título, en minúscula, para que el usuario no tenga que
 * adivinar qué va en la celda. Va arriba y no como comentario de Excel a propósito: un comentario hay que
 * descubrirlo pasando el mouse, y el owner pidió justamente que «el usuario no vea la planilla y no sepa qué
 * hacer». Lo que se ve, se lee. */
export const HOJAS = [
  {
    nombre: "Ventas",
    obligatoria: true,
    que: "una fila por venta: qué se vendió, a quién, cuándo y con qué costo",
    columnas: [
      { campo: "fecha", titulo: "fecha (aaaa-mm-dd)", tipo: "fecha", clave: true, obligatoria: true,
        ayuda: "el día de la venta. si solo tienes el mes, pon cualquier día de ese mes." },
      { campo: "cliente", titulo: "cliente", tipo: "texto", clave: true, obligatoria: true,
        ayuda: "a quién le vendiste. escríbelo siempre igual." },
      /* PUNTO DE VENTA (owner 2026-08-26): «muchos clientes tienen varias sucursales, es opcional pero debe
       * estar». Se guarda con la venta desde ya. ADI todavía NO analiza por punto de venta —lo declara en la
       * preview— pero el dato queda capturado para cuando lo haga, igual que el día de la fecha. */
      { campo: "puntoVenta", titulo: "punto de venta", tipo: "texto", clave: true, obligatoria: false,
        ayuda: "la sucursal o local del cliente, si vendes a varias. si no, déjalo vacío." },
      { campo: "canal", titulo: "canal", tipo: "texto", obligatoria: false, atributoDe: "cliente",
        ayuda: "cómo llega la venta: mayorista, retail, online. sirve para comparar canales." },
      { campo: "sku", titulo: "sku", tipo: "texto", clave: true, obligatoria: true,
        ayuda: "el código del producto. tiene que coincidir con el de la hoja inventario." },
      { campo: "marca", titulo: "marca", tipo: "texto", obligatoria: false, atributoDe: "sku",
        ayuda: "la marca del producto. sirve para comparar marcas entre sí." },
      { campo: "sfamilia", titulo: "familia", tipo: "texto", obligatoria: false, atributoDe: "sku",
        ayuda: "la categoría o línea del producto. sirve para agrupar." },
      { campo: "unidades", titulo: "unidades", tipo: "numero", obligatoria: true,
        ayuda: "cuántas unidades vendiste. solo el número." },
      { campo: "venta", titulo: "venta", tipo: "numero", obligatoria: true,
        ayuda: "cuánto facturaste, sin impuestos. solo el número, sin signo peso." },
      { campo: "costo", titulo: "costo", tipo: "numero", obligatoria: true,
        ayuda: "cuánto te costó lo que vendiste. con esto adi calcula tu margen." },
      { campo: "acciones", titulo: "acciones comerciales", tipo: "numero", obligatoria: false,
        ayuda: "descuentos, rebates o aportes que le diste al cliente. en dinero, no en %." },
      { campo: "precioLista", titulo: "precio de lista", tipo: "numero", obligatoria: false, atributoDe: "sku",
        ayuda: "tu precio sin descuento. sirve para ver cuánto estás cediendo." },
      /* ⚠️ EL FOLIO VA ACÁ Y NO EN UNA HOJA DE FACTURAS APARTE (owner 2026-08-27). La fila de venta es una
       * LÍNEA —fecha + cliente + sku—, no una factura: varias líneas forman una factura y hasta ahora nada las
       * agrupaba. Con el folio en esta misma hoja, la factura sale de las MISMAS filas que ya producen la
       * venta, así que su suma ES la venta, exacta, por construcción. Una hoja de facturas aparte habría
       * creado un SEGUNDO número para la misma venta, y el día que no cuadraran al peso el producto tendría
       * dos verdades para lo mismo — que es justo lo que no se permite acá. */
      { campo: "factura", titulo: "n° de factura", tipo: "texto", obligatoria: false,
        ayuda: "el folio o número del documento. varias líneas pueden compartir el mismo. si no lo tienes, déjalo vacío." },
      /* ⚠️ EL VENCIMIENTO NO SE PIDE COMO FECHA, y es a propósito. Una factura tiene varias líneas: una fecha
       * de vencimiento repetida en cada una PUEDE CONTRADECIRSE A SÍ MISMA, y alguien tendría que decidir cuál
       * gana. Los días de crédito son UN número por cliente —que el dueño sabe de memoria— y el vencimiento
       * sale de la fecha de la factura más esos días. Viaja como atributo del cliente, igual que el canal. */
      { campo: "diasCredito", titulo: "días de crédito", tipo: "numero", obligatoria: false, atributoDe: "cliente",
        ayuda: "a cuántos días le vendes a este cliente: 30, 60, 90. si le vendes al contado, pon 0." },
    ],
  },
  {
    nombre: "Inventario",
    obligatoria: false,
    que: "el stock actual: cuánto hay de cada producto y, si aplica, en qué bodega",
    /* ⚠️ TRES COLUMNAS. Contrato v1 del owner: «la plantilla debe pedir hechos, no KPIs ni valorizaciones
     * manuales. El cliente entrega stock físico; ADI calcula capital, días y rotación». Se fueron la fecha de
     * corte (era idéntica en todas las filas: metadato, no columna), el stock valorizado (es stock × costo
     * unitario, y el costo está en Ventas), la fecha de última venta (ya está en Ventas) y los dos KPI. */
    columnas: [
      { campo: "sku", titulo: "sku", tipo: "texto", clave: true, obligatoria: true,
        ayuda: "el código del producto, igual que en la hoja ventas." },
      { campo: "bodega", titulo: "bodega", tipo: "texto", clave: true, obligatoria: false,
        ayuda: "dónde está el stock. si tienes una sola bodega, déjalo vacío." },
      { campo: "stockUnd", titulo: "stock (unidades)", tipo: "numero", obligatoria: true,
        ayuda: "cuántas unidades tienes hoy. físicas, no valorizadas: adi calcula el dinero." },
    ],
  },
  {
    /* ── ABONOS · lo único que este producto no puede deducir de la venta (owner 2026-08-27) ──────────────
     * EL PEDIDO: «mostrar la venta del cliente, abonos y saldo pendiente, de esa forma se puede controlar si
     * es que a algún cliente se le da crédito». La venta ya la tenemos; lo que falta es cuánto de esa venta
     * ya entró en caja. Tres columnas y alcanza.
     *
     * ⚠️ EL ABONO NECESITA FECHA, no solo monto. Un total abonado por cliente da el saldo y nada más: la
     * entrada de caja necesita saber CUÁNDO entró cada peso. Y como la venta ya trae día, la caja se puede
     * mirar por semana o por mes sin pedirle nada más al cliente.
     *
     * ⚠️ Y NECESITA EL FOLIO, no el cliente. Apuntando a la factura, el saldo se sabe factura por factura y la
     * antigüedad es real. Apuntando solo al cliente, todo se mezcla en una bolsa y no se puede decir qué está
     * vencido. El cliente va igual, pero solo para poder avisar si un abono quedó apuntado al de otro.
     *
     * VA AL FINAL Y ES OPCIONAL: sin esta hoja el resto del producto funciona igual, y lo único que no se
     * enciende es la cara de Flujo Comercial. Se declara ausente, no se inventa. */
    nombre: "Abonos",
    obligatoria: false,
    que: "una fila por abono: cuánto te pagaron, cuándo y contra qué factura",
    columnas: [
      { campo: "fecha", titulo: "fecha (aaaa-mm-dd)", tipo: "fecha", clave: true, obligatoria: true,
        ayuda: "el día en que te pagaron. escríbelo así: 2026-08-31." },
      { campo: "factura", titulo: "n° de factura", tipo: "texto", clave: true, obligatoria: true,
        ayuda: "el folio que se está pagando. tiene que ser uno de los de la hoja ventas." },
      { campo: "monto", titulo: "monto", tipo: "numero", obligatoria: true,
        ayuda: "cuánto te pagaron, sin impuestos. solo el número, sin signo peso." },
      { campo: "cliente", titulo: "cliente", tipo: "texto", obligatoria: false,
        ayuda: "quién pagó. no es obligatorio: sirve para avisarte si un abono quedó apuntado a la factura de otro." },
    ],
  }
];

/** La frase que explica el trato con las columnas opcionales · va escrita en la hoja, no solo en la documentación. */
export const AVISO_OPCIONALES =
  "las columnas en amarillo son obligatorias. las demás son opcionales: si las dejas vacías el archivo entra igual, " +
  "pero adi no va a poder responderte sobre eso (por ejemplo, sin marca no hay comparación entre marcas).";

export const COHERENCIA = [
  { entidad: "sku", clave: "sku", atributos: ["marca", "sfamilia", "precioLista"], hoja: "Ventas" },
  { entidad: "cliente", clave: "cliente", atributos: ["canal"], hoja: "Ventas" },
];

/* ── COLUMNAS PROHIBIDAS · lo que ADI calcula y el usuario no manda ──────────────────────────────────────────
 * No alcanza con no pedirlas: un ERP que exporta «Margen %» la va a pegar igual, con la mejor intención, y a
 * partir de ahí hay DOS verdades para la misma cifra. Por eso una columna calculada RECHAZA el archivo, y el
 * mensaje dice qué mandar en su lugar — rechazar sin explicar convierte la plantilla en un obstáculo. */
export const COLUMNAS_PROHIBIDAS = [
  { formas: ["margen", "margenpct", "margenporcentaje", "margenbruto"], porque: "el margen sale de la venta y el costo", enSuLugar: "Venta y Costo" },
  { formas: ["contribucion", "contribucionbruta", "utilidadbruta", "utilidad"], porque: "la contribución sale de la venta y el margen", enSuLugar: "Venta y Costo" },
  { formas: ["cargacomercial", "cargapct", "carga", "rebatepct", "pctrebate", "descuentopct"], porque: "el porcentaje sale de las acciones comerciales y la venta", enSuLugar: "Acciones comerciales" },
  { formas: ["brecha", "brechapct", "gap", "gappuntos"], porque: "la brecha es la distancia contra el benchmark, y el benchmark es un parámetro", enSuLugar: "el benchmark en la cabecera de Ventas" },
  { formas: ["benchmark", "referencia", "vara", "margenobjetivo"], porque: "es una política del negocio, no un dato por fila", enSuLugar: "el benchmark en la cabecera de Ventas" },
  { formas: ["capitalinmovilizado", "inmovilizado", "inmovilizadopct", "sobrestock", "riesgoquiebre"], porque: "es un diagnóstico que hace ADI con las varas del negocio", enSuLugar: "Stock valorizado y las varas de la cabecera" },
  { formas: ["estado", "estadosku", "semaforo", "alerta", "criticidad"], porque: "el estado lo asigna ADI con los umbrales declarados", enSuLugar: "nada — sale solo" },
  { formas: ["costomedio", "costounitario", "costopromedio"], porque: "el costo medio sale del costo y las unidades", enSuLugar: "Costo y Unidades" },
  { formas: ["participacion", "pctinv", "pctventa", "share"], porque: "toda participación es una división que hace ADI", enSuLugar: "los montos, sin dividir" },
  { formas: ["presupuesto", "ppto", "budget", "meta", "objetivo"], porque: "el presupuesto es por cuenta y período, no por fila de venta: repetirlo acá se contradice solo", enSuLugar: "nada por ahora — «venta contra presupuesto» queda fuera de la v1 y se declara" },
];

/** Normaliza un título de columna para comparar. */
export const normalizarTitulo = (s) => String(s || "")
  .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");

/** ¿este título es una columna calculada que el usuario no debe mandar? → la regla que la prohíbe, o null. */
export function columnaProhibida(titulo) {
  const t = normalizarTitulo(titulo);
  return COLUMNAS_PROHIBIDAS.find((p) => p.formas.includes(t)) || null;
}

export const hojaPorNombre = (n) => HOJAS.find((h) => normalizarTitulo(h.nombre) === normalizarTitulo(n)) || null;
