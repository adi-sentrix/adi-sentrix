/* === ingesta/plantilla/generarPlantilla.js · LA PLANTILLA SE GENERA DEL CONTRATO (v1 · 2026-08-22) ============
 *
 * El archivo que baja el cliente no se guarda a mano: se construye desde `config/contract/plantilla.js`. Si el
 * contrato gana una columna, la plantilla la trae al día siguiente sin que nadie se acuerde. Un .xlsx versionado
 * a mano se desincroniza del validador en la primera semana, y entonces el cliente llena algo que el sistema
 * rechaza — la peor primera impresión posible.
 *
 * DOS HOJAS, como pidió el owner: `Ventas` (con la cabecera del negocio arriba) e `Inventario`.
 *
 * DÓNDE EMPIEZA LA TABLA. En `Ventas` hay una cabecera de parámetros antes de los datos, así que la fila del
 * encabezado no está en un número fijo: se la RECONOCE porque su primera celda es el título de la primera
 * columna. Contar filas sería frágil —agregar un parámetro correría todo— y adivinar «la primera fila con varias
 * celdas» rompe el día que alguien escriba una nota. El contrato dice cuál es el título; eso alcanza.
 */
import { construirXlsx, ESTILO } from "../escribirLibro.js";
import { HOJAS, PARAMETROS, MARCA_PLANTILLA, HOJA_EMPRESA, HOJA_EJEMPLO, AVISO_OPCIONALES } from "../../config/contract/plantilla.js";

const anchoDe = (t) => Math.min(46, Math.max(14, String(t).length + 3));

/* ── LA HOJA «EMPRESA» · sola, para que no se mezcle con los datos ────────────────────────────────────────────
 * Orden del owner (2026-08-26): «si vas a pedir datos de la empresa déjalo en una pestaña sola, para que no se
 * mezcle con la de datos ventas o inventario». Antes estos campos vivían arriba de la tabla de Ventas y el
 * usuario abría el archivo sin saber dónde terminaba una cosa y empezaba la otra.
 * La celda A1 identifica al archivo como plantilla oficial y su versión: no es decoración, el validador la lee. */
function hojaEmpresa(valores = null) {
  const filas = [
    [{ v: MARCA_PLANTILLA, s: ESTILO.TITULO }],
    [],
    [{ v: "completa estos tres campos. las celdas en amarillo son obligatorias.", s: ESTILO.AYUDA }],
    [],
    ...PARAMETROS.flatMap((p) => [
      [{ v: p.etiqueta, s: p.obligatorio ? ESTILO.OBLIGATORIA : ESTILO.OPCIONAL },
       valores ? (valores[p.clave] ?? null) : { v: null, s: ESTILO.NORMAL }],
      [{ v: p.ayuda, s: ESTILO.AYUDA }],
      [],
    ]),
  ];
  return { nombre: HOJA_EMPRESA, filas, anchos: [52, 30] };
}

/* ── UNA HOJA DE DATOS ────────────────────────────────────────────────────────────────────────────────────────
 * Tres bloques, en este orden: qué es la hoja · el aviso de obligatorias/opcionales · la AYUDA de cada columna,
 * y recién debajo el título y las filas.
 *
 * ⚠️ LA AYUDA VA ARRIBA DEL TÍTULO, no como comentario de Excel. El owner pidió «un comentario en cada campo» y
 * «que el usuario no vea la planilla y no sepa qué hacer»: un comentario de Excel hay que descubrirlo pasando el
 * mouse por una esquinita roja, así que resuelve mal justamente lo que él quería resolver. Puesta arriba se lee
 * sola. Y va ARRIBA y no abajo por una razón técnica además de visual: el validador localiza la fila de títulos
 * buscándola por su primera celda, así que todo lo que esté por encima lo ignora — una fila de ayuda DEBAJO del
 * título entraría como si fuera un dato. */
function hojaDe(def, filasDatos = []) {
  const filas = [
    [{ v: def.que, s: ESTILO.AYUDA }],
    [{ v: AVISO_OPCIONALES, s: ESTILO.AYUDA }],
    [],
    def.columnas.map((c) => ({ v: c.ayuda, s: ESTILO.AYUDA })),
    def.columnas.map((c) => ({ v: c.titulo, s: c.obligatoria ? ESTILO.OBLIGATORIA : ESTILO.OPCIONAL })),
    ...filasDatos.map((f) => def.columnas.map((c) => (f[c.campo] ?? null))),
  ];
  return { nombre: def.nombre, filas, anchos: def.columnas.map((c) => anchoDe(c.titulo)) };
}

/* ── LA HOJA «EJEMPLO» · el archivo de muestra deja de ser una descarga aparte ────────────────────────────────
 * Owner 2026-08-26: «no creo que deban descargar una planilla de ejemplo, podrías colocar una pestaña hoja con
 * ese ejemplo y listo, mucho más sencillo». Ahora hay UN solo archivo: se baja, se mira la pestaña Ejemplo para
 * ver cómo se ve lleno, y se llenan las dos hojas de datos. Una descarga menos y ninguna duda sobre cuál es cuál.
 *
 * Se muestran unas pocas filas de Ventas, que es donde la gente duda. No es una hoja que el validador lea. */
function hojaEjemplo() {
  const d = datosEjemplo();
  const ventas = HOJAS.find((h) => h.nombre === "Ventas");
  const inv = HOJAS.find((h) => h.nombre === "Inventario");
  const bloque = (def, filas) => [
    [{ v: `así se ve la hoja ${def.nombre.toLowerCase()} con datos`, s: ESTILO.TITULO }],
    def.columnas.map((c) => ({ v: c.titulo, s: c.obligatoria ? ESTILO.OBLIGATORIA : ESTILO.OPCIONAL })),
    ...filas.map((f) => def.columnas.map((c) => (f[c.campo] ?? null))),
    [],
  ];
  const filas = [
    [{ v: "esta hoja es solo para mirar. no la llenes: adi no la lee.", s: ESTILO.AYUDA }],
    [],
    ...bloque(ventas, d.ventas.slice(0, 6)),
    ...bloque(inv, d.inventario.slice(0, 4)),
  ];
  return { nombre: HOJA_EJEMPLO, filas, anchos: ventas.columnas.map((c) => anchoDe(c.titulo)) };
}

/** Las hojas de la plantilla, ANTES de serializarse — con sus estilos a la vista.
 *  Se exporta para que un gate pueda comprobar el amarillo sobre lo que el generador produce de verdad, y no
 *  sobre una reconstrucción de lo que debería producir. Un chequeo que se arma su propia respuesta se aprueba
 *  a sí mismo. */
export function hojasDeLaPlantilla() {
  return [hojaEmpresa(null), ...HOJAS.map((h) => hojaDe(h, [])), hojaEjemplo()];
}

/** La plantilla que baja el cliente: Empresa · Ventas · Inventario · Ejemplo. Una sola, con todo adentro. */
export function plantillaVacia() {
  return construirXlsx(hojasDeLaPlantilla());
}

/* ── DATOS SINTÉTICOS · un negocio inventado que ejercita todos los casos ────────────────────────────────────
 * No sale de ningún tenant: entidades inventadas, para que el ejemplo no pueda contaminar a nadie. Cubre a
 * propósito: dos períodos (para el «vs anterior»), tres marcas y tres familias (rankings), dos canales, dos
 * bodegas, un SKU que no se vende hace meses y otro que rota fuerte. */
export function datosEjemplo() {
  const parametros = {
    empresa_id: "andes", empresa_nombre: "Andes Distribución S.A.", periodo_actual: "2026-08-31",
  };

  // sku → marca · familia · precio de lista · (se repiten en cada fila: así lo pidió el diseño de dos hojas)
  const cat = {
    "TRM-800": ["Kolbe", "Herramientas", 84.0], "TRM-450": ["Kolbe", "Herramientas", 52.0],
    "SAN-LAV60": ["Nordix", "Sanitarios", 138.0], "SAN-GRI22": ["Nordix", "Sanitarios", 41.0],
    "ELE-CAB25": ["Vulcano", "Eléctrico", 26.5], "ELE-TAB12": ["Vulcano", "Eléctrico", 96.0],
  };
  const canal = { "Ferretería Aurora": "Retail", "Depósito Riachuelo": "Mayorista", "Casa Belgrano": "Retail", "Obras del Sur": "Mayorista" };
  /* PUNTO DE VENTA (owner 2026-08-26): dos clientes con varias sucursales y dos sin ninguna — el ejemplo tiene
   * que mostrar las dos formas, porque la columna es opcional y quien tiene un solo local no debe sentir que
   * le falta algo. */
  const sucursal = { "Ferretería Aurora": "Sucursal Centro", "Obras del Sur": "Sucursal Norte" };

  const mezcla = [
    ["Ferretería Aurora", "TRM-800", "Central", 42, 3528, 2400, 88, 0.92],
    ["Ferretería Aurora", "SAN-GRI22", "Central", 60, 2460, 1790, 55, 1.04],
    ["Ferretería Aurora", "ELE-CAB25", "Norte", 210, 5565, 4180, 130, 0.88],
    ["Depósito Riachuelo", "TRM-800", "Central", 120, 9600, 7080, 410, 1.12],
    ["Depósito Riachuelo", "TRM-450", "Central", 180, 8820, 6640, 380, 1.05],
    ["Depósito Riachuelo", "ELE-TAB12", "Norte", 45, 4140, 3020, 175, 0.97],
    ["Casa Belgrano", "SAN-LAV60", "Central", 22, 2970, 2130, 41, 1.18],
    ["Casa Belgrano", "SAN-GRI22", "Central", 95, 3800, 2760, 62, 1.09],
    ["Obras del Sur", "ELE-TAB12", "Norte", 80, 7440, 5510, 300, 0.94],
    ["Obras del Sur", "ELE-CAB25", "Norte", 340, 8840, 6700, 355, 1.01],
    ["Obras del Sur", "TRM-450", "Central", 90, 4320, 3300, 190, 0.86],
  ];
  const r0 = (x) => Math.round(x);
  const ventas = [];
  for (const [cliente, sku, bodega, und, venta, costo, acc, f] of mezcla) {
    const [marca, sfamilia, precioLista] = cat[sku];
    const base = { cliente, puntoVenta: sucursal[cliente] ?? null, canal: canal[cliente], sku, marca, sfamilia, precioLista };
    ventas.push({ fecha: "2026-07-18", ...base, unidades: r0(und * f), venta: r0(venta * f), costo: r0(costo * f), acciones: r0(acc * f) });
    ventas.push({ fecha: "2026-08-14", ...base, unidades: und, venta, costo, acciones: acc });
  }

  /* EL INVENTARIO DEL EJEMPLO SON HECHOS Y NADA MÁS (owner 2026-08-26): SKU, bodega y stock físico. Ni fecha de
   * corte, ni valorización, ni días, ni rotación — todo eso lo calcula ADI desde acá y desde la hoja Ventas.
   *
   * ⚠️ EL EJEMPLO ENSEÑA, así que no puede traer columnas a medio llenar. La versión anterior mostraba «Días de
   * inventario» con valor en 2 de 6 filas para ilustrar que era opcional, y lo que comunicaba era que se nos
   * había olvidado completarlas. Un archivo de ejemplo con huecos se copia con huecos. */
  const inventario = [
    { sku: "TRM-800", bodega: "Central", stockUnd: 96 },
    { sku: "TRM-450", bodega: "Central", stockUnd: 210 },
    { sku: "SAN-LAV60", bodega: "Central", stockUnd: 48 },
    { sku: "SAN-GRI22", bodega: "Central", stockUnd: 320 },
    { sku: "ELE-CAB25", bodega: "Norte", stockUnd: 1400 },
    { sku: "ELE-TAB12", bodega: "Norte", stockUnd: 60 },
  ];

  return { parametros, ventas, inventario };
}

/** La plantilla LLENA con el ejemplo sintético. */
export function plantillaEjemplo(datos = datosEjemplo()) {
  const porHoja = { Ventas: datos.ventas, Inventario: datos.inventario };
  return construirXlsx([hojaEmpresa(datos.parametros), ...HOJAS.map((h) => hojaDe(h, porHoja[h.nombre] || []))]);
}
