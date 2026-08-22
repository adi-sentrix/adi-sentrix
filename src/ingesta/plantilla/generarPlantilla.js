/* === ingesta/plantilla/generarPlantilla.js · LA PLANTILLA SE GENERA DEL CONTRATO (v0 · 2026-08-22) ============
 *
 * El archivo que baja el cliente no se guarda a mano: se construye desde `config/contract/plantilla.js`. Si
 * mañana el contrato gana una columna, la plantilla la trae al día siguiente sin que nadie se acuerde. Un .xlsx
 * versionado a mano se desincroniza del validador en la primera semana, y entonces el cliente llena un archivo
 * que el sistema rechaza — la peor primera impresión posible.
 *
 * DOS SALIDAS DEL MISMO MOLDE:
 *   · `plantillaVacia()`  — encabezados y nada más, lista para llenar.
 *   · `plantillaEjemplo()` — la misma, con datos sintéticos que ejercitan TODOS los casos que Sentrix muestra
 *     hoy: varios períodos (para que haya «anterior»), varias marcas y familias (para los rankings), canales,
 *     bodegas, presupuesto, y stock con SKU que se mueven y SKU que no.
 *
 * Cada hoja abre con una línea de INSTRUCCIONES en la fila 1 y los encabezados en la fila 2. El lector ya sabe
 * saltar filas vacías arriba, pero acá la fila de ayuda NO es vacía — así que el validador la conoce por
 * contrato (`FILA_ENCABEZADO`) en vez de adivinarla. Adivinar dónde empieza la tabla es la clase de detalle que
 * funciona en las pruebas y falla con el archivo del primer cliente.
 */
import { construirXlsx } from "../escribirLibro.js";
import { HOJAS, PARAMETROS, PLANTILLA_VERSION } from "../../config/contract/plantilla.js";

/** En qué fila (1-based) están los encabezados de las hojas de tabla. La 1 es la ayuda. */
export const FILA_ENCABEZADO = 2;
/** El rótulo que identifica al archivo como plantilla oficial, en A1 de `Parametros`. */
export const MARCA_PLANTILLA = `PLANTILLA OFICIAL ADI/SENTRIX · ${PLANTILLA_VERSION}`;

const anchoDe = (titulo) => Math.min(42, Math.max(12, String(titulo).length + 4));

/** Hoja `Parametros`: clave · valor · qué es. Vertical, porque son decisiones sueltas y no una tabla. */
function hojaParametros(valores = null) {
  const filas = [
    [MARCA_PLANTILLA, "", "No borre esta celda: identifica el archivo y su versión."],
    ["Parámetro", "Valor", "Qué es"],
    ...PARAMETROS.map((p) => [
      p.clave,
      valores ? (valores[p.clave] ?? null) : null,
      `${p.etiqueta}${p.obligatorio ? " · OBLIGATORIO" : " · opcional"}${p.nota ? ` — ${p.nota}` : ""}`,
    ]),
  ];
  return { nombre: "Parametros", filas, anchos: [26, 22, 96] };
}

/** Hoja de tabla: fila 1 con la ayuda, fila 2 con los encabezados oficiales, y después los datos. */
function hojaTabla(def, filasDatos = []) {
  const obligatorias = def.columnas.filter((c) => c.obligatoria).map((c) => c.titulo);
  const ayuda = `${def.que}. Columnas obligatorias: ${obligatorias.join(" · ") || "(ninguna)"}. No agregue columnas: el archivo se rechaza.`;
  const filas = [
    [ayuda],
    def.columnas.map((c) => c.titulo),
    ...filasDatos.map((fila) => def.columnas.map((c) => (fila[c.campo] ?? null))),
  ];
  return { nombre: def.nombre, filas, anchos: def.columnas.map((c) => anchoDe(c.titulo)) };
}

/** La plantilla VACÍA — lo que baja el cliente. */
export function plantillaVacia() {
  return construirXlsx(HOJAS.map((h) => (h.tipo === "parametros" ? hojaParametros(null) : hojaTabla(h, []))));
}

/* ── DATOS SINTÉTICOS · un negocio inventado que ejercita todos los casos ────────────────────────────────────
 * NO sale de ningún tenant: entidades inventadas, para que el ejemplo no pueda contaminar a nadie ni servir de
 * puerta trasera para el dato del demo. Cubre a propósito: dos períodos (para el «vs anterior»), tres marcas y
 * tres familias (rankings), dos canales, dos bodegas, presupuesto por cuenta, un SKU que no se vende hace
 * meses y otro que rota rápido (los dos extremos del diagnóstico de capital). */
export function datosEjemplo() {
  const parametros = {
    empresa_id: "andes", empresa_nombre: "Andes Distribución S.A.", periodo_actual: "2026-08", moneda: "USD",
    benchmark: 28.0, bestPracticeCarga: 2.5, targetCarga: 3.0, margenBrechaMaterial: 4,
  };

  const productos = [
    { sku: "TRM-800", marca: "Kolbe", sfamilia: "Herramientas", precioLista: 84.0 },
    { sku: "TRM-450", marca: "Kolbe", sfamilia: "Herramientas", precioLista: 52.0 },
    { sku: "SAN-LAV60", marca: "Nordix", sfamilia: "Sanitarios", precioLista: 138.0 },
    { sku: "SAN-GRI22", marca: "Nordix", sfamilia: "Sanitarios", precioLista: 41.0 },
    { sku: "ELE-CAB25", marca: "Vulcano", sfamilia: "Eléctrico", precioLista: 26.5 },
    { sku: "ELE-TAB12", marca: "Vulcano", sfamilia: "Eléctrico", precioLista: 96.0 },
  ];

  const clientes = [
    { nombre: "Ferretería Aurora", canal: "Retail" },
    { nombre: "Depósito Riachuelo", canal: "Mayorista" },
    { nombre: "Casa Belgrano", canal: "Retail" },
    { nombre: "Obras del Sur", canal: "Mayorista" },
  ];

  /* Las ventas se generan con una tabla de intenciones, no a mano fila por fila: así el ejemplo cubre todas las
   * combinaciones que importan sin 48 literales que nadie va a mantener. `f` es el factor del período anterior. */
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
    ventas.push({ periodo: "2026-07", cliente, sku, bodega, unidades: r0(und * f), venta: r0(venta * f), costo: r0(costo * f), acciones: r0(acc * f) });
    ventas.push({ periodo: "2026-08", cliente, sku, bodega, unidades: und, venta, costo, acciones: acc });
  }

  const presupuesto = [
    { periodo: "2026-08", cliente: "Ferretería Aurora", presupuesto: 12000 },
    { periodo: "2026-08", cliente: "Depósito Riachuelo", presupuesto: 23500 },
    { periodo: "2026-08", cliente: "Casa Belgrano", presupuesto: 6200 },
    { periodo: "2026-08", cliente: "Obras del Sur", presupuesto: 21000 },
  ];

  // stock: TRM-800 rota fuerte · SAN-LAV60 no se vende hace meses · ELE-TAB12 con recepción reciente
  const inventario = [
    { fechaCorte: "2026-08-31", sku: "TRM-800", bodega: "Central", stockUnd: 96, stockUSD: 5760, ultimaVenta: "2026-08-30", vendidoMes: 162, recepciones: 200 },
    { fechaCorte: "2026-08-31", sku: "TRM-450", bodega: "Central", stockUnd: 210, stockUSD: 7770, ultimaVenta: "2026-08-29", vendidoMes: 270, recepciones: 240 },
    { fechaCorte: "2026-08-31", sku: "SAN-LAV60", bodega: "Central", stockUnd: 48, stockUSD: 4656, ultimaVenta: "2026-04-12", vendidoMes: 22, recepciones: 0 },
    { fechaCorte: "2026-08-31", sku: "SAN-GRI22", bodega: "Central", stockUnd: 320, stockUSD: 9280, ultimaVenta: "2026-08-31", vendidoMes: 155, recepciones: 120 },
    { fechaCorte: "2026-08-31", sku: "ELE-CAB25", bodega: "Norte", stockUnd: 1400, stockUSD: 26600, ultimaVenta: "2026-08-31", vendidoMes: 550, recepciones: 600 },
    { fechaCorte: "2026-08-31", sku: "ELE-TAB12", bodega: "Norte", stockUnd: 60, stockUSD: 4260, ultimaVenta: "2026-08-28", vendidoMes: 125, recepciones: 150 },
  ];

  return { parametros, productos, clientes, ventas, presupuesto, inventario };
}

/** La plantilla LLENA con el ejemplo sintético. */
export function plantillaEjemplo(datos = datosEjemplo()) {
  const porHoja = { Productos: datos.productos, Clientes: datos.clientes, Ventas: datos.ventas, Presupuesto: datos.presupuesto, Inventario: datos.inventario };
  return construirXlsx(HOJAS.map((h) => (h.tipo === "parametros" ? hojaParametros(datos.parametros) : hojaTabla(h, porHoja[h.nombre] || []))));
}
