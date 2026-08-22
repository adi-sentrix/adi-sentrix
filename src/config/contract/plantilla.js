/* === config/contract/plantilla.js · LA PLANTILLA OFICIAL ADI/SENTRIX · v0 (2026-08-22) =========================
 *
 * LA REGLA CENTRAL, textual del owner: «ADI calcula. El usuario informa hechos. Si el usuario tiene que calcular
 * margen, benchmark o capital inmovilizado antes de subir el archivo, el diseño está mal.»
 *
 * Este archivo es la ÚNICA fuente de verdad de la plantilla: de acá salen el .xlsx que se le entrega al cliente,
 * el validador que revisa lo que devuelve y el motor que calcula. Tres consumidores, un contrato — si mañana se
 * agrega una columna, se agrega acá y los tres se enteran solos.
 *
 * ── POR QUÉ HAY UNA LISTA DE COLUMNAS PROHIBIDAS ─────────────────────────────────────────────────────────────
 * No alcanza con no pedirlas. Un cliente con un ERP que exporta «Margen %» la va a pegar igual, con la mejor
 * intención, y a partir de ahí hay DOS verdades para la misma cifra: la que él calculó con su criterio y la que
 * calcula ADI con el suyo. Ese es exactamente el defecto que este proyecto pasó meses cerrando en otras
 * superficies. Por eso una columna calculada no se ignora: **rechaza el archivo**, y el mensaje dice qué mandar
 * en su lugar («no mandes Margen %; mandá Venta y Costo, el margen lo calcula ADI»).
 *
 * ── LAS UNIDADES VIAJAN EN EL ENCABEZADO ─────────────────────────────────────────────────────────────────────
 * «Venta (USD)» y «Stock valorizado (USD)» dicen su unidad en el título de la columna. No se infiere del rango
 * —esa es la lección de miles-vs-dólares— y tampoco se le pregunta al usuario en cada carga: está impresa en la
 * plantilla que él bajó. La unidad deja de ser un paso humano y pasa a ser parte del contrato.
 *
 * ── QUÉ ES UN HECHO Y QUÉ ES UN PARÁMETRO ────────────────────────────────────────────────────────────────────
 * Un HECHO es algo que pasó y el sistema del cliente registró: vendió 12 unidades a $340 con costo $240 el 3 de
 * marzo. Un PARÁMETRO es una decisión del negocio: «mi margen de referencia es 30.1%». Los hechos van en las
 * hojas de datos; los parámetros, en la hoja `Parametros`. El benchmark es un PARÁMETRO — la pregunta del owner
 * queda contestada por la estructura: hoy `POLICY.benchmark` es una política del negocio, no una cifra que salga
 * del dato, así que va como parámetro y jamás como columna.
 */

/** Versión de la plantilla. Viaja DENTRO del archivo: sin esto, un archivo viejo cargado en un motor nuevo es un
 *  misterio silencioso. Con esto, el validador dice «esta plantilla es v0 y el motor espera v0». */
export const PLANTILLA_VERSION = "v0";

/* ── PARÁMETROS · las decisiones del negocio, no sus hechos ─────────────────────────────────────────────────
 * `policyKey` ata cada parámetro a la llave que ya usa `businessPolicy`: no se inventa un vocabulario nuevo.
 * `obligatorio: false` ⇒ si no viene, el motor cae al config general y lo DECLARA (no lo inventa en silencio). */
export const PARAMETROS = [
  { clave: "empresa_id", etiqueta: "Identificador de la empresa (minúsculas, sin espacios)", tipo: "texto", obligatorio: true, ejemplo: "acme" },
  { clave: "empresa_nombre", etiqueta: "Nombre de la empresa", tipo: "texto", obligatorio: true, ejemplo: "ACME Distribución S.A." },
  { clave: "periodo_actual", etiqueta: "Período que se está informando (AAAA-MM)", tipo: "periodo", obligatorio: true, ejemplo: "2026-08" },
  { clave: "moneda", etiqueta: "Moneda de todos los montos", tipo: "texto", obligatorio: true, ejemplo: "USD" },
  { clave: "benchmark", etiqueta: "Margen de referencia del negocio (%)", tipo: "numero", obligatorio: false, policyKey: "benchmark", ejemplo: 30.1,
    nota: "Es una POLÍTICA del negocio, no un resultado. Si no se declara, ADI usa su referencia general y lo dice." },
  { clave: "bestPracticeCarga", etiqueta: "Mejor práctica de acciones comerciales (% sobre venta)", tipo: "numero", obligatorio: false, policyKey: "bestPracticeCarga", ejemplo: 3.0 },
  { clave: "targetCarga", etiqueta: "Objetivo de acciones comerciales (% sobre venta)", tipo: "numero", obligatorio: false, policyKey: "targetCarga", ejemplo: 3.5 },
  { clave: "margenBrechaMaterial", etiqueta: "Brecha de margen que se considera material (puntos)", tipo: "numero", obligatorio: false, policyKey: "margenBrechaMaterial", ejemplo: 4 },
];

/* ── LAS HOJAS ───────────────────────────────────────────────────────────────────────────────────────────────
 * `columnas[].campo` es el nombre interno; `columnas[].titulo` es lo que ve el cliente, CON su unidad.
 * `clave: true` marca las columnas que forman la clave de la fila (para detectar duplicados contradictorios).
 * `obligatoria` es por columna; `obligatoria` de la hoja dice si la hoja entera puede faltar. */
export const HOJAS = [
  {
    nombre: "Parametros",
    obligatoria: true,
    que: "las decisiones del negocio: quién es, qué período informa y cuáles son sus varas",
    tipo: "parametros",
  },
  {
    nombre: "Productos",
    obligatoria: false,
    que: "el catálogo: a qué marca y familia pertenece cada SKU, y su precio de lista",
    tipo: "tabla",
    columnas: [
      { campo: "sku", titulo: "SKU", tipo: "texto", clave: true, obligatoria: true },
      { campo: "marca", titulo: "Marca", tipo: "texto", obligatoria: true },
      { campo: "sfamilia", titulo: "Familia", tipo: "texto", obligatoria: true },
      { campo: "precioLista", titulo: "Precio de lista (USD por unidad)", tipo: "numero", obligatoria: false,
        nota: "Es un HECHO del negocio (el precio de la lista), no el precio promedio realizado — ese sí lo calcula ADI." },
    ],
  },
  {
    nombre: "Clientes",
    obligatoria: false,
    que: "el catálogo de cuentas y por qué canal compran",
    tipo: "tabla",
    columnas: [
      { campo: "nombre", titulo: "Cliente", tipo: "texto", clave: true, obligatoria: true },
      { campo: "canal", titulo: "Canal", tipo: "texto", obligatoria: false },
    ],
  },
  {
    nombre: "Ventas",
    obligatoria: true,
    que: "LO QUE PASÓ: una fila por período, cuenta, producto y bodega. De acá sale casi todo lo que muestra Sentrix",
    tipo: "tabla",
    columnas: [
      { campo: "periodo", titulo: "Período (AAAA-MM)", tipo: "periodo", clave: true, obligatoria: true },
      { campo: "cliente", titulo: "Cliente", tipo: "texto", clave: true, obligatoria: true },
      { campo: "sku", titulo: "SKU", tipo: "texto", clave: true, obligatoria: true },
      { campo: "bodega", titulo: "Bodega", tipo: "texto", clave: true, obligatoria: false },
      { campo: "unidades", titulo: "Unidades", tipo: "numero", obligatoria: true },
      { campo: "venta", titulo: "Venta (USD)", tipo: "numero", obligatoria: true },
      { campo: "costo", titulo: "Costo (USD)", tipo: "numero", obligatoria: true },
      { campo: "acciones", titulo: "Acciones comerciales (USD)", tipo: "numero", obligatoria: false,
        nota: "Rebates, descuentos y notas de crédito EN PLATA. El porcentaje sobre la venta lo calcula ADI." },
    ],
  },
  {
    nombre: "Presupuesto",
    obligatoria: false,
    que: "cuánto esperaba vender cada cuenta en cada período",
    tipo: "tabla",
    columnas: [
      { campo: "periodo", titulo: "Período (AAAA-MM)", tipo: "periodo", clave: true, obligatoria: true },
      { campo: "cliente", titulo: "Cliente", tipo: "texto", clave: true, obligatoria: true },
      { campo: "presupuesto", titulo: "Venta presupuestada (USD)", tipo: "numero", obligatoria: true },
    ],
  },
  {
    nombre: "Inventario",
    obligatoria: false,
    que: "la FOTO del stock a una fecha: cuánto hay, dónde, y cuándo se vendió por última vez",
    tipo: "tabla",
    columnas: [
      { campo: "fechaCorte", titulo: "Fecha de corte (AAAA-MM-DD)", tipo: "fecha", obligatoria: true },
      { campo: "sku", titulo: "SKU", tipo: "texto", clave: true, obligatoria: true },
      { campo: "bodega", titulo: "Bodega", tipo: "texto", clave: true, obligatoria: true },
      { campo: "stockUnd", titulo: "Stock (unidades)", tipo: "numero", obligatoria: true },
      { campo: "stockUSD", titulo: "Stock valorizado (USD)", tipo: "numero", obligatoria: true },
      { campo: "ultimaVenta", titulo: "Fecha de la última venta (AAAA-MM-DD)", tipo: "fecha", obligatoria: false },
      { campo: "vendidoMes", titulo: "Unidades vendidas en el mes", tipo: "numero", obligatoria: false },
      { campo: "recepciones", titulo: "Unidades recibidas en el mes", tipo: "numero", obligatoria: false },
    ],
  },
];

/* ── COLUMNAS PROHIBIDAS · lo que ADI calcula y el usuario no manda ──────────────────────────────────────────
 * Se comparan NORMALIZADAS (sin acentos ni signos), así que «Margen %», «margen_pct» y «MARGEN%» son el mismo
 * caso. Cada una dice QUÉ mandar en su lugar: rechazar sin explicar convierte una plantilla en un obstáculo. */
export const COLUMNAS_PROHIBIDAS = [
  { formas: ["margen", "margenpct", "margenporcentaje", "margenbruto"], porque: "el margen sale de la venta y el costo", enSuLugar: "Venta (USD) y Costo (USD)" },
  { formas: ["contribucion", "contribucionbruta", "utilidadbruta", "utilidad"], porque: "la contribución sale de la venta y el margen", enSuLugar: "Venta (USD) y Costo (USD)" },
  { formas: ["cargacomercial", "cargapct", "carga", "rebatepct", "pctrebate", "descuentopct"], porque: "el porcentaje sale de las acciones comerciales y la venta", enSuLugar: "Acciones comerciales (USD)" },
  { formas: ["brecha", "brechapct", "gap", "gappuntos"], porque: "la brecha es la distancia contra el benchmark, y el benchmark es un parámetro", enSuLugar: "el benchmark en la hoja Parametros" },
  { formas: ["benchmark", "referencia", "vara", "margenobjetivo"], porque: "es una política del negocio, no un dato por fila", enSuLugar: "el benchmark en la hoja Parametros" },
  { formas: ["rotacion", "rotacioninventario", "turns", "turnover"], porque: "es un indicador calculado", enSuLugar: "Stock (unidades), Unidades vendidas en el mes y la fecha de la última venta" },
  { formas: ["diasinventario", "diasdeinventario", "doh", "cobertura", "diascobertura", "daysonhand"], porque: "es un indicador calculado", enSuLugar: "Stock (unidades), Unidades vendidas en el mes y la fecha de la última venta" },
  { formas: ["capitalinmovilizado", "inmovilizado", "inmovilizadopct", "sobrestock", "riesgoquiebre"], porque: "es un diagnóstico que hace ADI con las varas del negocio", enSuLugar: "Stock valorizado (USD) y las varas en la hoja Parametros" },
  { formas: ["estado", "estadosku", "semaforo", "alerta", "criticidad"], porque: "el estado lo asigna ADI con los umbrales declarados", enSuLugar: "nada — sale solo" },
  { formas: ["costomedio", "costounitario", "costopromedio"], porque: "el costo medio sale del costo y las unidades", enSuLugar: "Costo (USD) y Unidades" },
  { formas: ["participacion", "pctinv", "pctventa", "share"], porque: "toda participación es una división que hace ADI", enSuLugar: "los montos, sin dividir" },
];

/** Normaliza un título de columna para comparar (misma regla que el resto de la ingesta). */
export const normalizarTitulo = (s) => String(s || "")
  .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");

/** ¿este título es una columna calculada que el usuario no debe mandar? → la regla que la prohíbe, o null. */
export function columnaProhibida(titulo) {
  const t = normalizarTitulo(titulo);
  return COLUMNAS_PROHIBIDAS.find((p) => p.formas.includes(t)) || null;
}

/** La hoja por nombre (comparación tolerante a mayúsculas y acentos, estricta en todo lo demás). */
export const hojaPorNombre = (n) => HOJAS.find((h) => normalizarTitulo(h.nombre) === normalizarTitulo(n)) || null;
