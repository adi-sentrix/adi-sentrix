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

/* ── LOS PARÁMETROS · la cabecera de `Ventas` ────────────────────────────────────────────────────────────────
 * `policyKey` ata cada uno a la llave que ya usa `businessPolicy`: no se inventa vocabulario nuevo.
 * Los opcionales que no vengan caen al config general y se DECLARA en pantalla — nunca se inventa una vara. */
export const PARAMETROS = [
  { clave: "empresa_id", etiqueta: "Identificador de la empresa (minúsculas, sin espacios)", tipo: "texto", obligatorio: true, ejemplo: "andes" },
  { clave: "empresa_nombre", etiqueta: "Nombre de la empresa", tipo: "texto", obligatorio: true, ejemplo: "Andes Distribución S.A." },
  { clave: "periodo_actual", etiqueta: "Período que se está informando (AAAA-MM)", tipo: "periodo", obligatorio: true, ejemplo: "2026-08" },
  { clave: "moneda", etiqueta: "Moneda de todos los montos", tipo: "texto", obligatorio: true, ejemplo: "USD" },
  { clave: "benchmark", etiqueta: "Margen de referencia del negocio (%)", tipo: "numero", obligatorio: false, policyKey: "benchmark", ejemplo: 28.0,
    nota: "Es una POLÍTICA del negocio, no un resultado. Si no se declara, ADI usa su referencia general y lo dice." },
  { clave: "bestPracticeCarga", etiqueta: "Mejor práctica de acciones comerciales (% sobre venta)", tipo: "numero", obligatorio: false, policyKey: "bestPracticeCarga", ejemplo: 2.5 },
  { clave: "targetCarga", etiqueta: "Objetivo de acciones comerciales (% sobre venta)", tipo: "numero", obligatorio: false, policyKey: "targetCarga", ejemplo: 3.0 },
  { clave: "margenBrechaMaterial", etiqueta: "Brecha de margen que se considera material (puntos)", tipo: "numero", obligatorio: false, policyKey: "margenBrechaMaterial", ejemplo: 4 },
];

/* ── LAS DOS HOJAS ───────────────────────────────────────────────────────────────────────────────────────────
 * `clave: true` marca las columnas que identifican la fila (para detectar duplicados contradictorios).
 * `atributoDe` marca las columnas que describen una ENTIDAD y no el hecho: se repiten en cada fila y por eso
 * tienen que ser coherentes entre sí (ver COHERENCIA). */
export const HOJAS = [
  {
    nombre: "Ventas",
    obligatoria: true,
    conCabecera: true,
    que: "LO QUE PASÓ: una fila por período, cuenta, producto y bodega. De acá sale casi todo lo que muestra Sentrix",
    columnas: [
      { campo: "periodo", titulo: "Período (AAAA-MM)", tipo: "periodo", clave: true, obligatoria: true },
      { campo: "cliente", titulo: "Cliente", tipo: "texto", clave: true, obligatoria: true },
      { campo: "canal", titulo: "Canal", tipo: "texto", obligatoria: false, atributoDe: "cliente" },
      { campo: "sku", titulo: "SKU", tipo: "texto", clave: true, obligatoria: true },
      { campo: "marca", titulo: "Marca", tipo: "texto", obligatoria: false, atributoDe: "sku" },
      { campo: "sfamilia", titulo: "Familia", tipo: "texto", obligatoria: false, atributoDe: "sku" },
      { campo: "bodega", titulo: "Bodega", tipo: "texto", clave: true, obligatoria: false },
      { campo: "unidades", titulo: "Unidades", tipo: "numero", obligatoria: true },
      { campo: "venta", titulo: "Venta", tipo: "numero", obligatoria: true },
      { campo: "costo", titulo: "Costo", tipo: "numero", obligatoria: true },
      { campo: "acciones", titulo: "Acciones comerciales", tipo: "numero", obligatoria: false,
        nota: "Rebates, descuentos y notas de crédito EN PLATA. El porcentaje sobre la venta lo calcula ADI." },
      { campo: "precioLista", titulo: "Precio de lista", tipo: "numero", obligatoria: false, atributoDe: "sku",
        nota: "El precio de la lista, que es un HECHO. El precio promedio realizado lo calcula ADI." },
    ],
  },
  {
    nombre: "Inventario",
    obligatoria: false,
    que: "la FOTO del stock a una fecha: cuánto hay, dónde, y cuándo se vendió por última vez",
    columnas: [
      { campo: "fechaCorte", titulo: "Fecha de corte (AAAA-MM-DD)", tipo: "fecha", obligatoria: true },
      { campo: "sku", titulo: "SKU", tipo: "texto", clave: true, obligatoria: true },
      { campo: "bodega", titulo: "Bodega", tipo: "texto", clave: true, obligatoria: true },
      { campo: "stockUnd", titulo: "Stock (unidades)", tipo: "numero", obligatoria: true },
      { campo: "stockUSD", titulo: "Stock valorizado", tipo: "numero", obligatoria: true },
      { campo: "ultimaVenta", titulo: "Fecha de la última venta", tipo: "fecha", obligatoria: false,
        nota: "La FECHA, no los días. Los días sin venta los cuenta ADI contra la fecha de corte." },
      /* ── rotación y días: OPCIONALES (owner 2026-08-22) ────────────────────────────────────────────────────
       * Dejaron de estar prohibidas. La regla que fijó el owner es «informado manda, calculado rellena»: si el
       * ERP ya publica su rotación o sus días, ADI los respeta y no le discute el número a su sistema; si no
       * vienen, los calcula con la fórmula declarada (`metricRegistry.formulaSiFalta`) usando el stock y las
       * unidades vendidas que ya trae la hoja Ventas. En los dos casos la procedencia viaja con el valor.
       * Por eso NO están en COLUMNAS_PROHIBIDAS: no son un KPI que le pedimos calcular al usuario, son un dato
       * que su sistema puede tener — y si lo tiene, manda. */
      { campo: "doh", titulo: "Días de inventario", tipo: "numero", obligatoria: false,
        nota: "Solo si tu sistema ya lo publica. Si no lo mandás, ADI lo calcula." },
      { campo: "rotacion", titulo: "Rotación", tipo: "numero", obligatoria: false,
        nota: "Solo si tu sistema ya la publica. Si no la mandás, ADI la calcula desde los días." },
    ],
  },
];

/* ── COHERENCIA · el precio de haber colapsado los maestros ──────────────────────────────────────────────────
 * Sin hoja de Productos, la marca de un SKU se repite en cada fila donde ese SKU aparece. Si dos filas no
 * coinciden, NO se elige una: se rechaza el archivo nombrando las dos. Elegir «la primera» o «la más frecuente»
 * sería exactamente el tipo de resolución silenciosa que este producto no hace. */
export const COHERENCIA = [
  { entidad: "sku", clave: "sku", atributos: ["marca", "sfamilia", "precioLista"], hoja: "Ventas" },
  { entidad: "cliente", clave: "cliente", atributos: ["canal"], hoja: "Ventas" },
];

/* ── COLUMNAS PROHIBIDAS · lo que ADI calcula y el usuario no manda ──────────────────────────────────────────
 * No alcanza con no pedirlas: un ERP que exporta «Margen %» la va a pegar igual, con la mejor intención, y a
 * partir de ahí hay DOS verdades para la misma cifra. Por eso una columna calculada RECHAZA el archivo, y el
 * mensaje dice qué mandar en su lugar — rechazar sin explicar convierte la plantilla en un obstáculo. */
export const COLUMNAS_PROHIBIDAS = [
  { formas: ["margen", "margenpct", "margenporcentaje", "margenbruto"], porque: "el margen sale de la venta y el costo", enSuLugar: "Venta (USD) y Costo (USD)" },
  { formas: ["contribucion", "contribucionbruta", "utilidadbruta", "utilidad"], porque: "la contribución sale de la venta y el margen", enSuLugar: "Venta (USD) y Costo (USD)" },
  { formas: ["cargacomercial", "cargapct", "carga", "rebatepct", "pctrebate", "descuentopct"], porque: "el porcentaje sale de las acciones comerciales y la venta", enSuLugar: "Acciones comerciales (USD)" },
  { formas: ["brecha", "brechapct", "gap", "gappuntos"], porque: "la brecha es la distancia contra el benchmark, y el benchmark es un parámetro", enSuLugar: "el benchmark en la cabecera de Ventas" },
  { formas: ["benchmark", "referencia", "vara", "margenobjetivo"], porque: "es una política del negocio, no un dato por fila", enSuLugar: "el benchmark en la cabecera de Ventas" },
  { formas: ["capitalinmovilizado", "inmovilizado", "inmovilizadopct", "sobrestock", "riesgoquiebre"], porque: "es un diagnóstico que hace ADI con las varas del negocio", enSuLugar: "Stock valorizado (USD) y las varas de la cabecera" },
  { formas: ["estado", "estadosku", "semaforo", "alerta", "criticidad"], porque: "el estado lo asigna ADI con los umbrales declarados", enSuLugar: "nada — sale solo" },
  { formas: ["costomedio", "costounitario", "costopromedio"], porque: "el costo medio sale del costo y las unidades", enSuLugar: "Costo (USD) y Unidades" },
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
