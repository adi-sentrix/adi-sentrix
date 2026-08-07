/* === adi/sentrix/glossary.js · Etapa 5 · Sentrix · CATÁLOGO de definiciones de métricas ===
 * Ayuda determinística (cero tokens · estática · no cambia). El "i" de cada card la lee de acá. Indexado por
 * MÉTRICA (la etiqueta), no por card ni posición → se adapta solo a cualquier entidad (cliente/SKU/bodega): la
 * card sabe qué métrica muestra y busca su definición acá. Agregar una métrica = una línea (data-driven). El LLM
 * (tokens) queda SOLO para las preguntas que el usuario escribe de verdad, nunca para este explicativo fijo. */

export const METRIC_DEFS = {
  // — comercial / cliente —
  "Ventas": "El total facturado en el período (ventas netas).",
  "Margen": "Lo que queda de la venta después del costo y la carga comercial. Más alto = mejor.",
  "Contribución": "El valor ($) que aporta la entidad después de costo y carga comercial.",
  "Carga comercial": "El % de la venta que se va en acciones comerciales (rebates, descuentos). Más alta = menos margen.",
  "Ticket prom.": "Venta promedio por unidad vendida.",
  "Costo unitario": "Lo que cuesta cada unidad, y su peso sobre la venta.",
  "Unidades": "Cantidad de unidades vendidas en el período.",
  "vs benchmark": "Distancia del margen contra el benchmark de la industria.",
  "vs promedio": "La distancia del margen contra el promedio interno de tus clientes (en puntos porcentuales).",
  // — inventario / bodega —
  "Capital": "El valor del inventario: lo que tenés invertido en stock.",
  "Inmovilizado": "El stock que no rota (en alerta o rotación < 2): capital detenido.",
  "Rotación": "Cuántas veces el stock se vende y se repone en el período. Más alta = mejor.",
  "DOH": "Días de cobertura: cuántos días dura el stock al ritmo de venta actual. Más alto = más lento.",
  "SKUs en alerta": "Cantidad de SKUs marcados crítico o de cuidado (lento o sin venta).",
  "Peor sin venta": "El SKU que más días lleva sin registrar una venta.",
  "% del inmov. total": "Qué parte del capital inmovilizado total concentra esta bodega.",
  "vs promedio inmov": "Cuánto MENOS (o más) capital inmovilizado concentra esta bodega frente al promedio (positivo = mejor que el promedio).",
  // — gráficos (el "i" de cada gráfico) —
  "Evolución del negocio": "La película de las ventas mes a mes: este año, año anterior y presupuesto. Dato REAL. Pasá el cursor por la curva para ver cada mes.",
  "Concentración": "El principio 80/20: pocos elementos explican la mayor parte del total. El bloque azul es el que cruza el 80.0% · el % es el REAL del dato, no forzado.",
  "La brecha en el tiempo": "Cómo se movió el margen y sus componentes (costo/carga) en el año. VISTA DE EJEMPLO: el hoy es real, la trayectoria es ilustrativa hasta que el ERP traiga el histórico.",
  "La brecha descompuesta": "El gap de margen partido en sus dos componentes — estructura de costo vs carga comercial — para ver cuál pesa más. La cuenta cierra.",
  "Comparación controlada": "Los dos clientes en cada métrica (margen/carga/costo) sobre una escala ajustada — la distancia entre los puntos es la diferencia REAL. Revela qué componente los separa.",
};

export const defOf = (label) => METRIC_DEFS[label] || null;

/* === CONCEPTOS DEL NEGOCIO · definiciones conversacionales (owner 2026-07-27 · "se siente como que inventa algo") ===
 * Cuando el usuario pregunta "¿a qué te refieres con X? / qué es X / qué significa X / explícame X", ADI DEFINE el
 * concepto — no repite la lectura numérica. Es la MISMA doctrina que el "i" de las cards (METRIC_DEFS de arriba) pero
 * en voz de ASESOR: define, distingue de lo que se confunde, y da la pista de qué hacer. VERBATIM (composeDefine lo
 * entrega tal cual · sin narrar · kind meta): una definición curada es el antídoto al "inventa algo" — cero deriva.
 * Registro FORMAL de directorio: nunca 'plata'/'dormido'/'palanca'/'vara'/'apretar'. Data-driven: agregar un concepto
 * es una entrada. `def` = la definición · `distingue` = de qué se confunde (para el sí/no) · `aka` = etiqueta corta. */
export const CONCEPT_DEFS = {
  no_capturada: {
    aka: "contribución no capturada",
    def: "Es la brecha entre lo que un cliente aporta hoy y lo que aportaría si alcanzara el benchmark de margen. No es una pérdida contable —ese dinero no salió de la caja—: es contribución que quedás sin capturar por operar bajo el benchmark. Es recuperable subiendo el margen de esas cuentas.",
    distingue: "No es un rebate ni un costo: es la contribución que dejás de ganar por el margen bajo. El rebate, en cambio, es parte de la **carga comercial** que ayuda a generar esa brecha.",
  },
  carga: {
    aka: "carga comercial",
    def: "Es la parte de la venta que se va en acciones comerciales —rebates, descuentos, condiciones— antes de llegar a la contribución. Cuanta más carga, menos margen retenés. Es una de las causas de que un cliente rinda por debajo de su potencial.",
    distingue: "Es un costo comercial concreto sobre la venta, no la brecha de margen. La **contribución no capturada** es el resultado (lo que dejás de ganar); la carga comercial es una de las causas.",
  },
  rebate: {
    aka: "rebate",
    def: "Un rebate es un descuento o devolución que le concedés al cliente sobre la venta. Forma parte de la **carga comercial**: es dinero de la venta que no llega a la contribución.",
    distingue: "El rebate es un costo comercial concreto. La **contribución no capturada** es otra cosa: la brecha de margen que ese costo —y otros— te dejan.",
  },
  benchmark: {
    aka: "benchmark",
    def: "Es el punto de referencia contra el que ADI mide el margen de cada cuenta: la referencia que define tu negocio (tu criterio, o el que traiga tu dato). Un cliente por debajo del benchmark rinde menos que la referencia que definiste.",
    distingue: "No viene de una fuente sectorial: es TU referencia (tu criterio o tu dato) contra la que se mide cada cuenta.",
  },
  margen: {
    aka: "margen",
    def: "Es lo que queda de la venta después del costo y la carga comercial: cuánto de cada $1 vendido se convierte en contribución. Es el rendimiento de la cuenta — más alto, mejor.",
    distingue: "El margen es el porcentaje (el rendimiento); la **contribución** es el monto en $ que ese margen deja.",
  },
  contribucion: {
    aka: "contribución",
    def: "Es el valor en $ que aporta un cliente o SKU después del costo y la carga comercial. Es lo que cada cuenta pone sobre la mesa — el monto, no el porcentaje.",
    distingue: "La contribución es el monto en $; el **margen** es el porcentaje que ese monto representa sobre la venta.",
  },
  rotacion: {
    aka: "rotación",
    def: "Es cuántas veces el stock se vende y se repone en el período. Más alta, mejor: el capital invertido en inventario trabaja más veces.",
    distingue: "La rotación cuenta las vueltas del stock; el **DOH** mide lo mismo en días de cobertura.",
  },
  doh: {
    aka: "DOH",
    def: "DOH es los días de cobertura: cuántos días dura el stock al ritmo de venta actual. Más alto, más lento sale el inventario y más capital queda invertido en él.",
    distingue: "El DOH mide la cobertura en días; la **rotación** mide lo mismo en vueltas del stock por período.",
  },
};

// MATCHERS ordenados: el más específico primero (la frase larga gana a la corta — "contribución no capturada" antes
// que "contribución"; "margen de contribución" cae en margen). Cada entrada [regex, slug] apunta a un CONCEPT_DEFS.
export const CONCEPT_MATCHERS = [
  [/\bcontribuci[oó]n(?:es)?\s+no\s+capturad\w*|\bno\s+(?:la\s+)?captur\w*|\bno\s+estoy\s+capturando|\bdej\w*\s+(?:de\s+)?captur\w*|\bsin\s+captur\w*/i, "no_capturada"],
  [/\bcarga\s+comercial|\bcarga\b/i, "carga"],
  [/\brebates?\b/i, "rebate"],
  [/\bbenchmark\b/i, "benchmark"],
  [/\bmargen\s+de\s+contribuci[oó]n|\bmargen\w*\b/i, "margen"],
  [/\bcontribuci[oó]n(?:es)?\b/i, "contribucion"],
  [/\brotaci[oó]n\b/i, "rotacion"],
  [/\bdoh\b|d[ií]as\s+de\s+cobertura|\bcobertura\b/i, "doh"],
];

// matchConcept(text) → el slug del concepto nombrado en el texto (el más específico), o null. Puro/estático.
export function matchConcept(text) {
  const t = String(text || "");
  for (const [re, slug] of CONCEPT_MATCHERS) if (re.test(t)) return slug;
  return null;
}
