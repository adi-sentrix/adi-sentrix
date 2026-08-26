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
import { construirXlsx } from "../escribirLibro.js";
import { HOJAS, PARAMETROS, MARCA_PLANTILLA } from "../../config/contract/plantilla.js";

const anchoDe = (t) => Math.min(40, Math.max(12, String(t).length + 3));

/* Las filas de cabecera de `Ventas`: la marca del archivo, los parámetros, y una línea en blanco.
 * SIN columna de explicaciones (owner 2026-08-22: «eso marea, deja los campos solamente»). Lo que significa cada
 * parámetro vive en el contrato y sale por la preview, no ocupando celdas del archivo que hay que llenar.
 * La celda A1 no es texto de ayuda: es lo que identifica al archivo como plantilla oficial y su versión. */
function filasCabecera(valores = null) {
  return [
    [MARCA_PLANTILLA],
    [],
    ...PARAMETROS.map((p) => [p.etiqueta, valores ? (valores[p.clave] ?? null) : null]),
    [],
  ];
}

function hojaDe(def, filasDatos = [], valoresCabecera = null) {
  const filas = [
    ...(def.conCabecera ? filasCabecera(valoresCabecera) : []),
    def.columnas.map((c) => c.titulo),
    ...filasDatos.map((f) => def.columnas.map((c) => (f[c.campo] ?? null))),
  ];
  return { nombre: def.nombre, filas, anchos: def.columnas.map((c) => anchoDe(c.titulo)) };
}

/** La plantilla VACÍA — lo que baja el cliente. */
export function plantillaVacia() {
  return construirXlsx(HOJAS.map((h) => hojaDe(h, [], null)));
}

/* ── DATOS SINTÉTICOS · un negocio inventado que ejercita todos los casos ────────────────────────────────────
 * No sale de ningún tenant: entidades inventadas, para que el ejemplo no pueda contaminar a nadie. Cubre a
 * propósito: dos períodos (para el «vs anterior»), tres marcas y tres familias (rankings), dos canales, dos
 * bodegas, un SKU que no se vende hace meses y otro que rota fuerte. */
export function datosEjemplo() {
  const parametros = {
    empresa_id: "andes", empresa_nombre: "Andes Distribución S.A.", periodo_actual: "2026-08", moneda: "USD",
    benchmark: 28.0, bestPracticeCarga: 2.5, targetCarga: 3.0, margenBrechaMaterial: 4,
  };

  // sku → marca · familia · precio de lista · (se repiten en cada fila: así lo pidió el diseño de dos hojas)
  const cat = {
    "TRM-800": ["Kolbe", "Herramientas", 84.0], "TRM-450": ["Kolbe", "Herramientas", 52.0],
    "SAN-LAV60": ["Nordix", "Sanitarios", 138.0], "SAN-GRI22": ["Nordix", "Sanitarios", 41.0],
    "ELE-CAB25": ["Vulcano", "Eléctrico", 26.5], "ELE-TAB12": ["Vulcano", "Eléctrico", 96.0],
  };
  const canal = { "Ferretería Aurora": "Retail", "Depósito Riachuelo": "Mayorista", "Casa Belgrano": "Retail", "Obras del Sur": "Mayorista" };

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
    const base = { cliente, canal: canal[cliente], sku, marca, sfamilia, bodega, precioLista };
    ventas.push({ periodo: "2026-07", ...base, unidades: r0(und * f), venta: r0(venta * f), costo: r0(costo * f), acciones: r0(acc * f) });
    ventas.push({ periodo: "2026-08", ...base, unidades: und, venta, costo, acciones: acc });
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
  return construirXlsx(HOJAS.map((h) => hojaDe(h, porHoja[h.nombre] || [], datos.parametros)));
}
