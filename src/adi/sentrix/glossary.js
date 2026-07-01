/* === adi/sentrix/glossary.js · Etapa 5 · Sentrix · CATÁLOGO de definiciones de métricas ===
 * Ayuda determinística (cero tokens · estática · no cambia). El "i" de cada card la lee de acá. Indexado por
 * MÉTRICA (la etiqueta), no por card ni posición → se adapta solo a cualquier entidad (cliente/SKU/bodega): la
 * card sabe qué métrica muestra y busca su definición acá. Agregar una métrica = una línea (data-driven). El LLM
 * (tokens) queda SOLO para las preguntas que el usuario escribe de verdad, nunca para este explicativo fijo. */

export const METRIC_DEFS = {
  // — comercial / cliente —
  "Ventas": "El total facturado en el período (ventas netas).",
  "Margen": "Lo que queda de la venta después del costo y la carga comercial. Más alto = mejor.",
  "Contribución": "La plata ($) que aporta la entidad después de costo y carga comercial.",
  "Carga comercial": "El % de la venta que se va en acciones comerciales (rebates, descuentos). Más alta = menos margen.",
  "Ticket prom.": "Venta promedio por unidad vendida.",
  "Costo unitario": "Lo que cuesta cada unidad, y su peso sobre la venta.",
  "Unidades": "Cantidad de unidades vendidas en el período.",
  "vs benchmark": "Distancia del margen contra el benchmark de la industria.",
  "vs promedio": "La distancia del margen contra el promedio interno de tus clientes (en puntos porcentuales).",
  // — inventario / bodega —
  "Capital": "La plata inmovilizada en stock (valor del inventario).",
  "Inmovilizado": "El stock que no rota (en alerta o rotación < 2): plata atrapada.",
  "Rotación": "Cuántas veces el stock se vende y se repone en el período. Más alta = mejor.",
  "DOH": "Días de cobertura: cuántos días dura el stock al ritmo de venta actual. Más alto = más lento.",
  "SKUs en alerta": "Cantidad de SKUs marcados crítico o de cuidado (lento o sin venta).",
  "Peor sin venta": "El SKU que más días lleva sin registrar una venta.",
  "% del inmov. total": "Qué parte del capital inmovilizado total concentra esta bodega.",
  "vs promedio inmov": "Cuánto MENOS (o más) capital inmovilizado concentra esta bodega frente al promedio (positivo = mejor que el promedio).",
  // — gráficos (el "i" de cada gráfico) —
  "Evolución del negocio": "La película de las ventas mes a mes: este año, año anterior y presupuesto. Dato REAL. Pasá el cursor por la curva para ver cada mes.",
  "Concentración": "El principio 80/20: pocos elementos explican la mayor parte del total. El bloque azul es el que cruza el 80% · el % es el REAL del dato, no forzado.",
  "La brecha en el tiempo": "Cómo se movió el margen y sus palancas (costo/carga) en el año. VISTA DE EJEMPLO: el hoy es real, la trayectoria es ilustrativa hasta que el ERP traiga el histórico.",
  "La brecha descompuesta": "El gap de margen partido en sus dos palancas — estructura de costo vs carga comercial — para ver cuál pesa más. La cuenta cierra.",
  "Comparación controlada": "Los dos clientes en cada métrica (margen/carga/costo) sobre una escala ajustada — la distancia entre los puntos es la diferencia REAL. Revela qué palanca los separa.",
};

export const defOf = (label) => METRIC_DEFS[label] || null;
