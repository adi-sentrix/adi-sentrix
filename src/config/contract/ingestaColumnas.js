/* === config/contract/ingestaColumnas.js · CÓMO SE LLAMA CADA COLUMNA (vía 2 · paso 1 · 2026-08-21) ============
 *
 * El contrato ya declara QUÉ campos existen y con qué unidad (`sourceManifest.js` → `schema`). Lo que falta para
 * leer una planilla es lo otro: **cómo los escribe la gente**. Un ERP exporta «Cliente», otro «Razón Social», otro
 * «CUENTA»; y `stockUSD` casi nunca se llama `stockUSD`.
 *
 * POR QUÉ ESTO VIVE EN EL CONTRATO Y NO EN EL LECTOR. No es dato de un tenant: es vocabulario de LOS CAMPOS DEL
 * CONTRATO, igual que `metricRegistry` declara sus escalas. Y por eso mismo es corto a propósito: acá van los
 * sinónimos **obvios**, los que un humano no dudaría. Todo lo que no esté acá **no se adivina**: el mapeo lo
 * reporta como sin resolver y ese es exactamente el trabajo que más adelante propone el modelo y confirma una
 * persona. Estirar esta lista para «cubrir un caso más» es reemplazar una decisión humana por una tabla, que es
 * la forma más silenciosa de equivocarse.
 *
 * LO QUE ESTE ARCHIVO NO HACE, y no es un olvido:
 *   · No declara unidades. Las declara `sourceManifest.schema` y el mapeo las MUESTRA para que se confirmen —
 *     inferir la unidad del rango de los valores es el error de miles-vs-dólares, la lección más cara del proyecto.
 *   · No nombra ninguna entidad de ningún negocio. Ni un cliente, ni un SKU, ni una marca. Eso sale del dato.
 */

/** Normaliza un encabezado para comparar: minúsculas, sin acentos, sin nada que no sea letra o número. */
export const normalizarEncabezado = (s) => String(s || "")
  .toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "");

/* ¿el encabezado dice que es un PORCENTAJE? Hace falta porque normalizar borra el «%», y sin esa pista
 * «Rebate %» y «Rebates» colapsan en la misma forma («rebate») cuando son dos campos distintos: uno es una tasa y
 * el otro es plata. El signo que el humano escribió es información — se conserva, no se descarta. */
export const esPorcentaje = (s) => /%|\bpct\b|porcentaje/i.test(String(s || ""));

/* SINÓNIMOS POR EJE · la misma palabra no significa lo mismo en dos hojas distintas. En una planilla de productos
 * la columna «Producto» ES la clave de la fila; en una de clientes sería otra cosa. Declararlo por eje evita el
 * atajo de meter todo en la bolsa común, que es como una clave termina apuntando al campo equivocado. */
export const SINONIMOS_POR_EJE = {
  skusMargen:     { nombre: ["sku", "codigo", "codigosku", "producto", "codigoproducto", "item", "articulo"] },
  clientesMargen: { nombre: ["cliente", "cuenta", "razonsocial"] },
  clientesVentas: { nombre: ["cliente", "cuenta", "razonsocial"] },
};

/* SINÓNIMOS · campo del contrato → cómo puede venir escrito. Se comparan NORMALIZADOS, así que «Venta del mes»,
 * «venta_del_mes» y «VENTA DEL MES» son el mismo caso y no hay que repetirlos. */
export const SINONIMOS = {
  // identificación
  nombre:       ["cliente", "cuenta", "razonsocial", "nombrecliente", "clientenombre"],
  sku:          ["codigo", "codigosku", "codigoproducto", "producto", "item", "articulo"],
  bodega:       ["almacen", "deposito", "sucursal", "centro", "cd"],
  marca:        ["marcaproducto", "brand"],
  sfamilia:     ["familia", "superfamilia", "categoria", "linea", "rubro"],
  canal:        ["canalventa", "canaldeventa"],

  // venta comercial
  venta:        ["ventas", "ventaneta", "ventatotal", "facturacion", "montoventa", "ingresos"],
  actual:       ["ventaactual", "ventaperiodo", "periodoactual", "mesactual", "ventames", "ventadelmes", "ventadelperiodo"],
  anterior:     ["ventaanterior", "periodoanterior", "mesanterior", "anopasado", "anoanterior"],
  presupuesto:  ["ppto", "budget", "meta", "objetivo", "forecast"],
  costo:        ["costototal", "costoventa", "cmv", "costodeventa"],
  contribucion: ["margenbruto", "utilidad", "utilidadbruta", "contribucionbruta"],
  // `rebate` la reclaman LOS DOS a propósito: «Rebates» es plata y «Rebate %» es tasa, y normalizar borra el «%».
  // Dejar que colisionen y desempatar con `esPorcentaje` es lo correcto; darle la forma a uno solo haría que la
  // otra columna se mapeara callada al campo equivocado, que es plata contada como porcentaje.
  rebates:      ["rebate", "descuentos", "notascredito", "rappel"],
  pctRebate:    ["rebate", "rebatepct", "pctdescuento", "descuentopct", "rappelpct"],
  margen:       ["margenpct", "margenporcentaje", "pctmargen"],
  benchmark:    ["referencia", "vara", "margenobjetivo", "benchmarkmargen"],
  unidades:     ["cantidad", "cantidades", "und", "uds", "qty", "volumen"],
  unidadesAnt:  ["cantidadanterior", "unidadesanteriores", "undanterior"],
  costoMedio:   ["costounitario", "costopromedio", "costxund"],
  precioLista:  ["precio", "preciounitario", "preciolista", "pvp"],

  // inventario
  stockUSD:     ["stock", "stockvalorizado", "capital", "valorstock", "inventariovalorizado", "montostock"],
  stockUnd:     ["stockunidades", "unidadesstock", "existencias", "saldounidades"],
  rotacion:     ["rotacioninventario", "turns", "turnover", "vueltas"],
  doh:          ["dias", "diasinventario", "diasdeinventario", "diasstock", "daysonhand"],
  cobertura:    ["diascobertura", "coberturadias"],
  // en la hoja de inventario el campo se llama `margenPct` y el humano escribe «Margen %»: `margen` a secas no
  // existe en ese eje, así que acá no colisiona con nada (el índice se arma POR EJE, contra su propio schema).
  margenPct:    ["margen", "margensku", "margenproducto"],
  diasSinVenta: ["diassinmovimiento", "ultimaventadias", "diassinrotar"],
  vendidoMes:   ["vendidomes", "ventamesunidades", "salidasmes"],
  ventaDiaria:  ["promediodiario", "ventapromediodiaria", "salidadiaria"],
  estado:       ["estadosku", "situacion", "clasificacion"],
  alerta:       ["semaforo", "criticidad"],
};

/* LO MÍNIMO PARA QUE UN EJE EXISTA. Sin esto no hay negocio que leer, así que su ausencia es BLOQUEANTE —
 * el resto es opcional y su ausencia se DECLARA como límite, nunca se rellena.
 * Sale del diseño del frente (§2.2): «venta comercial: identificador de entidad + venta del período ·
 * inventario: SKU + capital + rotación + días de inventario + estado». */
export const REQUERIDAS = {
  clientesVentas: ["nombre", "actual"],
  clientesMargen: ["nombre", "venta"],
  skusMargen:     ["nombre", "venta"],
  skuInventario:  ["sku", "stockUSD", "rotacion", "doh", "estado"],
};

/** Los ejes que este paso sabe construir. El resto del dataset se declara ausente, no se inventa. */
export const EJES_SOPORTADOS = Object.keys(REQUERIDAS);
