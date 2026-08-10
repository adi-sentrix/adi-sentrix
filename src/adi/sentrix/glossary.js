/* === adi/sentrix/glossary.js · Etapa 5 · Sentrix · CATÁLOGO de definiciones de métricas ===
 * Ayuda determinística (cero tokens · estática · no cambia). El "i" de cada card la lee de acá. Indexado por
 * MÉTRICA (la etiqueta), no por card ni posición → se adapta solo a cualquier entidad (cliente/SKU/bodega): la
 * card sabe qué métrica muestra y busca su definición acá. Agregar una métrica = una línea (data-driven). El LLM
 * (tokens) queda SOLO para las preguntas que el usuario escribe de verdad, nunca para este explicativo fijo. */

// El glosario LEE los tres contratos que ya declaran el vocabulario del producto (dato puro, cero imports propios:
// no hay ciclo posible). No los duplica: de ahí sale el índice etiqueta-de-pantalla → concepto, para que una
// etiqueta nueva NO nazca huérfana (owner 2026-08-09, decisión 10 · hallazgo K).
import { VIEW_MANIFEST, VISTA_LABEL, UNIVERSO_KINDS, COMPARACIONES } from "./viewManifest.js";
import { METRICS } from "../../config/contract/metricRegistry.js";
import { SELLOS } from "../../config/contract/figureType.js";

// Una definición, dos escrituras de la MISMA cabecera (la abreviada que se ve en la grilla y el defKey largo del
// catálogo de columnas). Se declara UNA vez y se referencia dos: dos strings copiados son exactamente el mecanismo
// por el que una palabra termina significando dos cosas.
const _DEF_VS_PROMEDIO = "La distancia del margen de la fila contra el promedio SIMPLE de las filas de la vista, en puntos porcentuales. Es el promedio de las cuentas, una por una: no es el promedio ponderado por venta de la cartera, que es el que reconcilia con el total del negocio.";
const _DEF_VS_PROMEDIO_ALERTA = "Cuánto MENOS (o más) stock en alerta concentra esta bodega frente al promedio de las bodegas, en puntos porcentuales. El signo va al revés que el «vs prom» de clientes/SKU/marcas: acá positivo = mejor (menos stock en alerta), y se mide sobre participación de capital, no sobre margen.";

export const METRIC_DEFS = {
  // — comercial / cliente —
  "Ventas": "El total facturado en el período (ventas netas).",
  "Margen": "Lo que queda de la venta después del costo y la carga comercial. Más alto = mejor.",
  "Contribución": "El valor ($) que aporta la entidad después de costo y carga comercial.",
  "Carga comercial": "El % de la venta que se va en acciones comerciales (rebates, descuentos). Más alta = menos margen.",
  "Ticket prom.": "Venta promedio por unidad vendida.",
  "Costo unitario": "Lo que cuesta cada unidad, y su peso sobre la venta.",
  "Unidades": "Cantidad de unidades vendidas en el período.",
  // el «i» de esta columna decía "el benchmark de la industria" y contradecía, dentro del MISMO archivo, a la
  // entrada `benchmark` del catálogo, que declara que la vara NO viene de una fuente sectorial (owner 2026-08-09).
  "vs benchmark": "Distancia del margen contra TU benchmark: la referencia que define tu negocio, no una del sector.",
  "vs promedio": _DEF_VS_PROMEDIO, "vs prom": _DEF_VS_PROMEDIO,   // la cabecera abreviada y el defKey largo, LA MISMA definición (una sola constante · no dos strings que puedan divergir)
  // — inventario / bodega —
  "Capital": "El valor del inventario: lo que tenés invertido en stock.",
  // «INMOVILIZADO» ES DEL DETECTOR (owner 2026-08-10). Esta entrada declaraba la regla de STOCK EN ALERTA (alerta
  // operativa o rotación < 2) mientras CONCEPT_DEFS.capital_inmovilizado —en este mismo archivo— declara la del
  // detector, y `resolveGlossary("Inmovilizado")` sirve el CONCEPTO: la explicación describía $33.200 sobre una
  // columna que mostraba $55.800. Las dos reglas siguen existiendo porque miden cosas distintas; lo que se terminó
  // es que compartan la palabra.
  "Inmovilizado": "La parte del capital que el detector clasifica como detenida: rotación bajo tu piso o días de inventario sobre tu techo. No es el stock en alerta, que es otra regla y otra cifra.",
  "Stock en alerta": "El capital en SKU con alerta operativa (crítico o de cuidado) o con rotación bajo 2. Es una señal de operación, más amplia que el capital inmovilizado del detector: un SKU puede estar en alerta y aun así rotar sobre tu piso y estar bajo tu techo de días.",
  "% en alerta": "Qué parte del capital de esta bodega está en SKU con alerta operativa o rotación bajo 2.",
  "% del stock en alerta": "Qué parte del stock en alerta de todo el negocio concentra esta bodega.",
  "vs promedio en alerta": _DEF_VS_PROMEDIO_ALERTA, "vs prom en alerta": _DEF_VS_PROMEDIO_ALERTA,
  "Rotación": "Cuántas veces el stock se vende y se repone en el período. Más alta = mejor. En las filas Total se publica ponderada por capital, que es la única rotación media del producto.",
  "DOH": "Días de inventario: cuántos días dura el stock al ritmo de venta actual. Más alto = más lento.",
  "SKUs en alerta": "Cantidad de SKUs marcados crítico o de cuidado (lento o sin venta).",
  "Peor sin venta": "El SKU que más días lleva sin registrar una venta.",
  // columnas del cuadro de capital que hasta ahora no tenían entrada: la etiqueta se ve en pantalla y el glosario
  // declinaba (owner 2026-08-09, decisión 10). No cambian la vista: COLS_CAPITAL no declara `defKey` para ellas.
  "Disponible": "Las unidades en stock hoy, sin valorizar.",
  "Participación": "Qué parte del total de la vista explica esta fila.",
  "Última venta": "Hace cuánto se registró la última venta de este SKU.",
  "SKU crít.": "Cuántos SKU de esta bodega están inmovilizados y además marcados como críticos.",
  // la columna del asesor en el Cuadro · una etiqueta por universo (antes las dos decían «En juego $»: $5.0M de
  // contribución del año en la pestaña Clientes contra $33K de capital de hoy en Marcas/SKU/Bodegas, 151x)
  "Contribución en juego": "La contribución que el detector afirma que esta cuenta no está capturando: margen bajo tu benchmark o carga comercial sobre tu meta, valorizado sobre su venta anual. Es dinero del resultado, no capital en stock.",
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
 * es una entrada. `def` = la definición · `distingue` = de qué se confunde (para el sí/no) · `aka` = etiqueta corta.
 *
 * `etiquetas` (owner 2026-08-09, decisión 10) = los nombres con que ESTE concepto aparece en pantalla y en boca del
 * usuario. No es una lista de etiquetas escrita aparte: es el concepto declarando cómo se llama. El índice de abajo
 * la cruza con el manifiesto de vistas y el registro de métricas, así que una etiqueta nueva resuelve sola.
 *
 * LA LLAVE ES LA MÉTRICA. Los slugs `ventas·margen·contribucion·costo·acciones·carga·capital·rotacion·doh` son,
 * carácter por carácter, las llaves de `metricRegistry.METRICS`. Esa identidad es la que hace que el mapa
 * etiqueta → concepto se DERIVE (una métrica nueva sin concepto la reporta `vocabularioSinConcepto()`, no queda
 * en silencio) en vez de escribirse a mano. */
export const CONCEPT_DEFS = {
  no_capturada: {
    aka: "contribución no capturada",
    def: "Es la brecha entre lo que un cliente aporta hoy y lo que aportaría si alcanzara el benchmark de margen. No es una pérdida contable —ese dinero no salió de la caja—: es contribución que quedás sin capturar por operar bajo el benchmark. Es recuperable subiendo el margen de esas cuentas.",
    distingue: "No es un rebate ni un costo: es la contribución que dejás de ganar por el margen bajo. El rebate, en cambio, es parte de la **carga comercial** que ayuda a generar esa brecha.",
  },
  carga: {
    aka: "carga comercial",
    etiquetas: ["carga", "carga comercial", "carga comercial %"],
    def: "Es la parte de la venta que se va en acciones comerciales —rebates, descuentos, condiciones— antes de llegar a la contribución. Se expresa como % de la venta. Cuanta más carga, menos margen retenés. Es una de las causas de que un cliente rinda por debajo de su potencial.",
    distingue: "La carga comercial es la TASA (%); las **acciones comerciales** son el mismo hecho medido en dinero. Y ninguna de las dos es la **contribución no capturada**, que es el resultado —lo que dejás de ganar—, no la causa.",
  },
  acciones: {
    aka: "acciones comerciales",
    etiquetas: ["acciones", "acciones comerciales", "acciones comerciales del periodo", "rebates y descuentos"],
    def: "Son los rebates, descuentos y condiciones concedidos al cliente, medidos en dinero sobre la venta del período. Es lo que se revisa y se negocia cuenta por cuenta cuando el margen no alcanza.",
    distingue: "Las acciones comerciales son el MONTO ($); la **carga comercial** es ese mismo monto expresado como % de la venta. Son la misma realidad en dos unidades, y el producto las nombra distinto a propósito.",
  },
  rebate: {
    aka: "rebate",
    etiquetas: ["rebate", "rebates"],
    def: "Un rebate es un descuento o devolución que le concedés al cliente sobre la venta. Forma parte de las **acciones comerciales**: es dinero de la venta que no llega a la contribución.",
    distingue: "El rebate es un costo comercial concreto. La **contribución no capturada** es otra cosa: la brecha de margen que ese costo —y otros— te dejan.",
  },
  benchmark: {
    aka: "benchmark",
    etiquetas: ["benchmark", "vs benchmark"],
    def: "Es el punto de referencia contra el que ADI mide el margen de cada cuenta: la referencia que define tu negocio (tu criterio, o el que traiga tu dato). Un cliente por debajo del benchmark rinde menos que la referencia que definiste.",
    distingue: "No viene de una fuente sectorial: es TU referencia (tu criterio o tu dato) contra la que se mide cada cuenta.",
  },
  margen: {
    aka: "margen de contribución",
    etiquetas: ["margen", "margen de contribucion", "margen promedio", "margen promedio ponderado", "margen %"],
    def: "Es lo que queda de la venta después del costo Y de las acciones comerciales: cuánto de cada $1 vendido se convierte en contribución. Es el margen que Sentrix muestra en la columna «Margen» y el que ADI compara contra el benchmark.",
    distingue: "No es el **margen bruto**: el bruto descuenta sólo el costo de lo vendido y todavía no descontó las acciones comerciales. El margen es el porcentaje; la **contribución** es el monto en $ que ese porcentaje deja.",
  },
  margen_bruto: {
    aka: "margen bruto",
    etiquetas: ["margen bruto", "margen bruto %"],
    def: "Es lo que queda de la venta después del COSTO de lo vendido, y sólo de eso: todavía no descontó las acciones comerciales ni los gastos declarados. En la cascada del Resultado es el primer peldaño, inmediatamente después del ingreso y el costo.",
    distingue: "Es un concepto DISTINTO del **margen de contribución**: la contribución descuenta además la carga comercial, así que siempre queda por debajo del bruto. Confundirlos hace leer como rendimiento final un peldaño que todavía no pagó las acciones comerciales.",
  },
  contribucion: {
    aka: "contribución",
    etiquetas: ["contribucion", "contribucion del periodo"],
    def: "Es el valor en $ que aporta un cliente o SKU después del costo y de las acciones comerciales. Es lo que cada cuenta pone sobre la mesa — el monto, no el porcentaje.",
    distingue: "La contribución es el monto en $; el **margen de contribución** es el porcentaje que ese monto representa sobre la venta. Y no es el **resultado del negocio**: la contribución es lo que queda ANTES de los gastos declarados.",
  },
  resultado: {
    aka: "resultado del negocio",
    etiquetas: ["resultado", "resultado del negocio", "estado de resultados", "utilidad", "p&l", "pnl",
                "la cascada del resultado", "el resultado del negocio", "el resultado por entidad", "la vista resultado completa"],
    def: "Es lo que queda del negocio después de restar, en este orden, el costo de lo vendido, las acciones comerciales y los gastos declarados. Es el último peldaño de la cascada del Resultado y se expresa en $ y como % de la venta.",
    distingue: "No es la **contribución**: la contribución es el peldaño ANTERIOR, el que todavía no pagó los gastos declarados. Si la pregunta dice resultado, utilidad o estado de resultados, la respuesta es este nivel, nunca la contribución.",
  },
  gastos: {
    aka: "gastos declarados",
    etiquetas: ["gastos", "gastos declarados", "gasto declarado", "lineas de gasto"],
    def: "Son las líneas de gasto que el usuario declara como % sobre la venta (logística, marketing, promotores y las que sume). No vienen del ERP: son un supuesto declarado, y por eso el resultado que producen se sella INDICADO.",
    distingue: "No son el costo de lo vendido —ése ya está descontado en el margen bruto— ni las acciones comerciales, que son el descuento concedido al cliente.",
  },
  ventas: {
    aka: "ventas",
    etiquetas: ["ventas", "venta", "ventas del periodo", "facturacion", "total cartera"],
    def: "Es el total facturado en el período, neto. Es la primera línea de la cascada y la base sobre la que se miden el margen, la carga comercial y la participación de cada cuenta.",
    distingue: "La venta es el ingreso, no lo que queda: lo que queda después del costo y de las acciones comerciales es la **contribución**.",
  },
  costo: {
    aka: "costo de lo vendido",
    etiquetas: ["costo", "costo de lo vendido", "costo conciliado"],
    def: "Es lo que costó la mercadería vendida en el período. Es el primer descuento de la cascada: ingreso menos costo da el margen bruto.",
    distingue: "No incluye las **acciones comerciales** —el descuento concedido al cliente— ni los **gastos declarados**, que entran más abajo en la cascada.",
  },
  rotacion: {
    aka: "rotación",
    etiquetas: ["rotacion", "rotacion media", "vueltas del stock"],
    def: "Es cuántas veces el stock se vende y se repone en el período. Más alta, mejor: el capital invertido en inventario trabaja más veces.",
    distingue: "La rotación cuenta las vueltas del stock; los **días de inventario** miden lo mismo en días.",
  },
  // EL CANDADO DE VOCABULARIO DEL OWNER (2026-08-09, `_mesa_capital_gate` · barrido 15): en el producto esta
  // métrica se llama DÍAS DE INVENTARIO, una sola palabra para una sola cosa, y el sinónimo viejo —que llegó a
  // significar dos campos distintos— no se EMITE desde este archivo. Reconocerlo sí: el usuario lo escribe, y
  // declinar sería peor. Por eso vive únicamente como expresión regular en CONCEPT_MATCHERS (que el candado no
  // barre, porque no es texto emitido) y llega acá ya traducido al nombre del producto.
  doh: {
    aka: "días de inventario",
    etiquetas: ["doh", "dias de inventario", "dias inv", "dias inv."],
    def: "Son los días que dura el stock al ritmo de venta actual. Más alto, más lento sale el inventario y más capital queda invertido en él. En pantalla se llama «Días de inventario» (columna «Días inv.»).",
    distingue: "Los días de inventario lo miden en días; la **rotación** mide lo mismo en vueltas del stock por período. Es el nombre único de esta métrica: los sinónimos que el producto arrastraba llegaron a nombrar dos campos distintos y por eso se retiraron de la pantalla.",
  },
  capital: {
    aka: "capital en inventario",
    etiquetas: ["capital", "capital total", "capital en inventario", "valorizado", "stock valorizado"],
    def: "Es el valor del inventario a hoy: lo que está invertido en stock. Es una foto del momento, no un acumulado del año, y por eso su período se declara «foto de inventario a hoy».",
    distingue: "No es el **capital inmovilizado**: eso es sólo la parte de este capital que el detector clasifica como detenida.",
  },
  capital_inmovilizado: {
    aka: "capital inmovilizado",
    etiquetas: ["inmovilizado", "capital inmovilizado", "capital detenido", "capital frenado", "% del inmov. total"],
    def: "Es la parte del capital en inventario que el detector clasifica como detenida: SKU sin rotación o con días de inventario muy por encima del rango. Es dinero ya invertido que hoy no se está convirtiendo en venta.",
    distingue: "No es el **capital en inventario** completo: es el subconjunto detenido. Y no es una pérdida contable — el valor sigue en el stock; lo que está detenido es su conversión en caja.",
  },
  riesgo_quiebre: {
    aka: "riesgo de quiebre",
    etiquetas: ["quiebre", "quiebres", "riesgo de quiebre", "quiebre proximo", "quiebres proximos"],
    def: "Es el estado de los SKU cuyos días de inventario no alcanzan para sostener el ritmo de venta actual: si no se reponen, la venta se corta por falta de stock.",
    distingue: "Es el extremo opuesto del **sobrestock**: acá falta inventario para la demanda; allá sobra. Los dos se miden con los mismos **días de inventario**.",
  },
  sobrestock: {
    aka: "sobrestock",
    etiquetas: ["sobrestock", "sobre stock", "exceso de stock"],
    def: "Es el estado de los SKU con muchos más días de inventario de los que su ritmo de venta justifica: hay stock de sobra para la demanda observada.",
    distingue: "No es lo mismo que el **capital inmovilizado**: el sobrestock sí rota, sólo que demasiado lento para el volumen que tiene; el inmovilizado directamente no rota.",
  },
  estado: {
    aka: "estado del inventario",
    etiquetas: ["estado", "estados del capital", "en rango"],
    def: "Es la clasificación que el detector de inventario le pone a cada SKU según su rotación y sus días de inventario: en rango, riesgo de quiebre, sobrestock o inmovilizado. Cada SKU cae en uno solo, y los cuatro estados suman el capital total.",
    distingue: "El estado es una clasificación, no una cifra: el monto de cada estado lo pone el **capital en inventario** que cae en él.",
  },
  // ── universo, alcance y referencia (el vocabulario del contrato de concordancia) ──────────────────────────────
  universo: {
    aka: "universo",
    etiquetas: ["universo", "alcance del universo"],
    def: "Es el conjunto exacto de filas sobre el que se calculó una cifra: todo el negocio, el grupo que explica el 80%, la cola, un estado del inventario, un eje o una selección de pantalla. Dos cifras del mismo nombre y distinto universo no son comparables.",
    distingue: "No es el período ni el eje: el universo dice QUÉ filas entran; el eje dice por qué dimensión están cortadas y el período, en qué ventana de tiempo.",
  },
  negocio: {
    aka: "el negocio completo",
    etiquetas: ["negocio", "el negocio", "cartera completa", "cartera"],
    def: "Es el universo sin recortes: todas las cuentas del período, cliente por cliente, sin filtro de materialidad ni corte de concentración. Es el universo contra el que cierran los totales de cabecera.",
    distingue: "No es el **grupo 80**, que es sólo la cabeza de este mismo universo.",
  },
  grupo80: {
    aka: "grupo 80",
    etiquetas: ["grupo 80", "grupo80", "el grupo 80", "plano 80", "plano 80%", "80/20", "regla 80/20"],
    def: "Es el conjunto de entidades que, ordenadas de mayor a menor, explican el 80% de la venta del eje. Es el plano de decisión: donde una mejora de margen mueve el total.",
    distingue: "El grupo 80 y **la cola** parten el mismo universo en dos: juntos son el negocio completo, por construcción.",
  },
  cola: {
    aka: "la cola",
    etiquetas: ["cola", "la cola", "cola de la cartera"],
    def: "Es el resto del universo una vez separado el grupo que explica el 80% de la venta: muchas entidades, cada una con poco peso. Importa por acumulación, no cuenta por cuenta.",
    distingue: "La cola y el **grupo 80** parten el mismo universo en dos: juntos son el negocio completo, por construcción.",
  },
  eje: {
    aka: "eje",
    etiquetas: ["eje", "dimension", "corte"],
    def: "Es la dimensión por la que se corta el negocio: cliente, familia, SKU, canal, marca o bodega. La misma métrica leída por dos ejes distintos responde dos preguntas distintas.",
    distingue: "No es el **universo**: el eje dice cómo están agrupadas las filas; el universo, cuáles entran.",
  },
  seleccion: {
    aka: "selección",
    etiquetas: ["seleccion", "lo seleccionado", "la seleccion"],
    def: "Es el subconjunto que quedó marcado en pantalla —las filas elegidas o el filtro activo— y sobre el que se responde mientras siga vivo. Al cambiar de vista o de filtro, deja de aplicar.",
    distingue: "No es un universo del dato sino del momento: lo define lo que estás mirando, no la estructura del negocio.",
  },
  en_juego: {
    aka: "en juego",
    etiquetas: ["en juego", "en juego $", "lo que esta en juego"],
    def: "Es el monto que la decisión mueve si se corrige lo que la fila señala: la contribución recuperable de esa cuenta o el capital que se libera en ese SKU. Es una magnitud de decisión, para ordenar por dónde empezar.",
    distingue: "No es una cifra contable ni un dinero perdido: es lo que queda sobre la mesa si la situación no cambia.",
  },
  brecha: {
    aka: "brecha",
    etiquetas: ["brecha", "gap", "brecha de margen"],
    def: "Es la distancia entre una cifra y su referencia declarada — el margen contra el benchmark, la carga contra la meta, la venta contra el presupuesto. Se expresa en puntos porcentuales cuando compara tasas y en $ cuando compara montos.",
    distingue: "La brecha es la distancia; la **contribución no capturada** es esa distancia ya convertida en dinero sobre la venta de la cuenta.",
  },
  vara: {
    aka: "la vara",
    etiquetas: ["vara", "vara_usuario", "tu vara", "vara declarada"],
    def: "Es la referencia que el usuario fija para juzgar una métrica: el margen mínimo aceptable, la meta de carga comercial, el umbral de días de inventario. Cuando está declarada, reemplaza a la referencia por defecto y ADI mide contra ella.",
    distingue: "No es el **benchmark** por defecto del negocio: la vara es la referencia que vos declaraste para este análisis, y por eso toda cifra medida contra ella se sella INDICADO.",
  },
  meta: {
    aka: "meta",
    etiquetas: ["meta", "tu meta", "meta de carga"],
    def: "Es el valor objetivo declarado para una métrica —típicamente la carga comercial— contra el que se mide cada cuenta. Lo que supera la meta es lo que queda para revisar.",
    distingue: "La meta es un objetivo declarado; el **benchmark** es la referencia de rendimiento del negocio. Una cuenta puede estar sobre la meta y aun así bajo el benchmark.",
  },
  presupuesto: {
    aka: "presupuesto",
    etiquetas: ["presupuesto", "vs presupuesto", "ppto"],
    def: "Es la venta comprometida para el período contra la que se compara la venta real de cada cuenta. La diferencia contra el presupuesto es el deterioro de venta que ADI detecta.",
    distingue: "El presupuesto compara VENTA; el **benchmark** compara MARGEN. Una cuenta puede cumplir presupuesto y aun así rendir bajo benchmark.",
  },
  anterior: {
    aka: "el año anterior",
    etiquetas: ["anterior", "año anterior", "ano anterior", "vs año anterior", "vs ano anterior"],
    def: "Es la misma métrica del período equivalente del año previo. Es la comparación que dice si la cuenta mejoró o se deterioró, con independencia de si cumplió su presupuesto.",
    distingue: "Compara contra vos mismo un año atrás; el **presupuesto** compara contra lo comprometido y el **benchmark**, contra la referencia de rendimiento.",
  },
  promedio_cartera: {
    aka: "el promedio de la cartera",
    // «vs prom» / «vs promedio» SALEN de estas etiquetas (owner 2026-08-10): son las CABECERAS de una columna que
    // publica el promedio SIMPLE de las filas, no este ponderado. Mientras estuvieron acá, el índice le ganaba a
    // METRIC_DEFS y la "i" de esa columna explicaba el ponderado (25,1%) sobre una cifra calculada con el simple
    // (27,8%) — 2,7pp de brecha bajo la misma palabra. Cada una resuelve ahora a su propia entrada de METRIC_DEFS.
    etiquetas: ["promedio de la cartera", "promedio de tu cartera", "promedio ponderado", "promedio_cartera"],
    def: "Es la referencia interna: el valor de la métrica para el conjunto de la cartera, ponderado por venta. Ubica a cada cuenta contra el resto del negocio, no contra una referencia externa.",
    distingue: "El promedio ponderado no es el promedio simple de las filas: el ponderado reconcilia con el total del negocio y el simple no, y en esta cartera no dan lo mismo. La columna «vs prom» de las grillas mide contra el SIMPLE, no contra este. Y no es el **benchmark**, que es una referencia declarada, no observada.",
  },
  // ── el sello (decisión 2 del owner · SELLOS de config/contract/figureType.js) ─────────────────────────────────
  probado: {
    aka: "probado",
    etiquetas: ["probado", "dato probado", "sello probado"],
    def: "Es el sello de una cifra que es dato directo o un cálculo determinístico exacto, reconciliado contra sus componentes, sin supuestos ni asignaciones modeladas.",
    distingue: "Se distingue de **indicado**, que marca lo estimado o dependiente de un supuesto, y de **abierto**, que marca lo que el dato disponible no permite calcular.",
  },
  indicado: {
    aka: "indicado",
    etiquetas: ["indicado", "dato indicado", "sello indicado"],
    def: "Es el sello de una cifra que depende de una estimación, una distribución, una afinidad, un supuesto declarado o una vara del usuario. Es utilizable para decidir, siempre que se lea sabiendo de qué supuesto cuelga.",
    distingue: "No es un dato dudoso: es un dato CONDICIONADO. Se distingue de **probado**, que reconcilia sin supuestos, y de **abierto**, que directamente no se puede calcular.",
  },
  abierto: {
    aka: "abierto",
    etiquetas: ["abierto", "dato abierto", "sello abierto"],
    def: "Es el sello de lo que el dato disponible no permite calcular ni aislar. ADI lo declara en vez de aproximarlo: un hueco nombrado es información; un hueco rellenado es una cifra falsa.",
    distingue: "Se distingue de **indicado**, que sí se calcula pero cuelga de un supuesto, y de **probado**, que reconcilia sin ninguno.",
  },
};

// ── NORMALIZACIÓN de etiqueta (una sola forma para "Días inv.", "días inv", "DIAS INV.") ──────────────────────
// Sin acentos, sin puntuación de adorno, sin artículo inicial. Es lo único que decide si dos textos son LA MISMA
// etiqueta; deliberadamente NO hace coincidencia parcial (eso es trabajo de CONCEPT_MATCHERS, más abajo).
function _norm(s) {
  return String(s == null ? "" : s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // sin acentos: «Días inv.» y «dias inv» son LA MISMA etiqueta
    .toLowerCase()
    .replace(/[¿?¡!"'`«»]/g, "")
    .replace(/[·.,;:]+/g, " ")
    .replace(/\$/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:el|la|los|las|un|una|unos|unas)\s+/, "");
}

/* ── EL ÍNDICE etiqueta-de-pantalla → concepto · DERIVADO, no escrito a mano ──────────────────────────────────
 * (owner 2026-08-09, decisión 10 · hallazgo K: 30 de 39 etiquetas de pantalla declinaban)
 *
 * Se construye cruzando cuatro fuentes que YA declaran el vocabulario del producto. El orden es la precedencia:
 * lo declarado explícitamente gana sobre lo derivado, y lo derivado gana sobre nada.
 *   1. el concepto declarando cómo se llama (slug · aka · etiquetas)
 *   2. `metricRegistry.METRICS[k].label` → el concepto `k` (identidad de llave: por eso los slugs de métrica se
 *      llaman igual que las métricas; una métrica sin concepto la reporta `vocabularioSinConcepto()`)
 *   3. `viewManifest.VIEW_MANIFEST[id].label` → el concepto de su `metrica` declarada
 *   4. `METRIC_DEFS` → la definición del "i" de la card, para las etiquetas que no son un concepto del negocio
 *      sino una lectura de columna ("Ticket prom.", "Peor sin venta")
 * Y como último recurso, una etiqueta del manifiesto SIN métrica se responde con lo que el manifiesto declara de
 * esa pieza (qué es, de qué vista, qué universo, qué período). Ninguna etiqueta del manifiesto queda huérfana:
 * una pieza nueva nace con respuesta el día que se declara. */
const _INDEX = new Map();   // etiqueta normalizada → { slug } | { metricDef } | { componentId }
const _put = (label, entry) => { const k = _norm(label); if (k && !_INDEX.has(k)) _INDEX.set(k, entry); };

// (1) el concepto declara sus nombres
for (const [slug, c] of Object.entries(CONCEPT_DEFS)) {
  _put(slug, { slug });
  _put(c.aka, { slug });
  for (const e of (c.etiquetas || [])) _put(e, { slug });
}
// (2) el registro de métricas: su `label` es la etiqueta de columna que se ve en Sentrix
const _METRICAS_SIN_CONCEPTO = [];
for (const [k, m] of Object.entries(METRICS)) {
  if (!CONCEPT_DEFS[k]) { _METRICAS_SIN_CONCEPTO.push(k); continue; }
  _put(m.label, { slug: k });
}
// (3) el manifiesto de vistas: cada componente aporta SU etiqueta, resuelta por la métrica que declara
for (const [componentId, m] of Object.entries(VIEW_MANIFEST)) {
  if (!m.label) continue;
  const porMetrica = m.metrica && CONCEPT_DEFS[m.metrica] ? { slug: m.metrica } : null;
  _put(m.label, porMetrica || { componentId });
}
// el nombre de cada cara ("Comercial", "Capital"…) resuelve contra su componente de vista completa
for (const [vista, label] of Object.entries(VISTA_LABEL)) {
  const id = `${vista}/otro/vista`;
  if (VIEW_MANIFEST[id]) _put(label, { componentId: id });
}
// (4) el "i" de las cards, para las etiquetas que no son un concepto del negocio sino una lectura de columna
for (const label of Object.keys(METRIC_DEFS)) _put(label, { metricDef: label });

// ── CONSULTA ──────────────────────────────────────────────────────────────────────────────────────────────────
// conceptForLabel(label) → el slug de CONCEPT_DEFS que corresponde a esa etiqueta EXACTA (normalizada), o null.
// No adivina por coincidencia parcial: una etiqueta que no está declarada devuelve null, honesto.
export function conceptForLabel(label) {
  const hit = _INDEX.get(_norm(label));
  return hit && hit.slug ? hit.slug : null;
}

// El texto que el manifiesto autoriza para una pieza sin concepto propio: qué es, de qué vista, sobre qué universo
// y en qué período. Se COMPONE de lo declarado — cero cifras, cero interpretación, nada inventado.
function _defDeComponente(componentId) {
  const m = VIEW_MANIFEST[componentId];
  if (!m) return null;
  const vista = VISTA_LABEL[m.vista] || m.vista;
  const uni = m.universo && m.universo.label ? m.universo.label : null;
  const partes = [`Es ${m.tipo === "vista" ? "la cara" : `la pieza «${m.label}»`} de la vista ${vista}`];
  if (uni) partes.push(`Su universo es ${uni}`);
  if (m.periodo) partes.push(`y el período que declara es «${m.periodo}»`);
  return `${partes.slice(0, 2).join(". ")}${partes[2] ? ` ${partes[2]}` : ""}.`;
}

/* resolveGlossary(termino) → { slug, aka, def, distingue, fuente } | null · LA ENTRADA ÚNICA del glosario.
 * `fuente` declara de dónde salió la respuesta: "concepto" (definición curada del negocio) · "metrica" (el "i" de
 * la card) · "componente" (lo que el manifiesto declara de esa pieza). Devuelve null —honesto— cuando no hay
 * entrada: inventar una definición es exactamente el defecto que este glosario existe para cerrar.
 * ESCALERA: slug exacto → etiqueta exacta (índice derivado) → frase libre (CONCEPT_MATCHERS) → null. */
export function resolveGlossary(termino) {
  const t = String(termino == null ? "" : termino);
  if (!t.trim()) return null;
  const directo = CONCEPT_DEFS[t];
  if (directo) return { slug: t, aka: directo.aka, def: directo.def, distingue: directo.distingue, fuente: "concepto" };
  const hit = _INDEX.get(_norm(t));
  if (hit) {
    if (hit.slug) { const c = CONCEPT_DEFS[hit.slug]; return { slug: hit.slug, aka: c.aka, def: c.def, distingue: c.distingue, fuente: "concepto" }; }
    if (hit.metricDef) return { slug: null, aka: hit.metricDef, def: METRIC_DEFS[hit.metricDef], distingue: null, fuente: "metrica" };
    if (hit.componentId) {
      const def = _defDeComponente(hit.componentId);
      const m = VIEW_MANIFEST[hit.componentId];
      if (def) return { slug: null, aka: m.label, def, distingue: null, fuente: "componente" };
    }
  }
  const slug = matchConcept(t);
  if (slug) { const c = CONCEPT_DEFS[slug]; return { slug, aka: c.aka, def: c.def, distingue: c.distingue, fuente: "concepto" }; }
  return null;
}

// MATCHERS ordenados: el más específico primero (la frase larga gana a la corta — "contribución no capturada" antes
// que "contribución"; "margen bruto" antes que "margen", porque son conceptos DISTINTOS y contestar el de
// contribución cuando preguntan por el bruto es peor que declinar). Cada entrada [regex, slug] apunta a un
// CONCEPT_DEFS. Acá SÓLO entran términos inequívocos: una palabra que además es de uso corriente en una pregunta
// de negocio ("ventas", "resultado" a secas, "estado") se deja fuera a propósito — resuelve por etiqueta exacta en
// el índice de arriba, que es donde no puede robarle el turno a una lectura real.
export const CONCEPT_MATCHERS = [
  [/\bcontribuci[oó]n(?:es)?\s+no\s+capturad\w*|\bno\s+(?:la\s+)?captur\w*|\bno\s+estoy\s+capturando|\bdej\w*\s+(?:de\s+)?captur\w*|\bsin\s+captur\w*/i, "no_capturada"],
  [/\bmargen\s+brut\w*|\bbrut\w+\s+de\s+margen/i, "margen_bruto"],
  [/\bacciones\s+comerciales?\b/i, "acciones"],
  [/\bcarga\s+comercial|\bcarga\b/i, "carga"],
  [/\brebates?\b/i, "rebate"],
  [/\bbenchmark\b/i, "benchmark"],
  [/\bmargen\s+de\s+contribuci[oó]n|\bmargen\w*\b/i, "margen"],
  [/\bcontribuci[oó]n(?:es)?\b/i, "contribucion"],
  [/\brotaci[oó]n\b/i, "rotacion"],
  [/\bd[ií]as\s+(?:de\s+)?inventario\b|\bd[ií]as\s+inv\b|\bdoh\b|d[ií]as\s+de\s+cobertura|\bcobertura\b/i, "doh"],
  [/\bcapital\s+(?:inmovilizad|detenid|frenad)\w*|\binmovilizad\w*\b/i, "capital_inmovilizado"],
  [/\briesgo\s+de\s+quiebre|\bquiebres?\b/i, "riesgo_quiebre"],
  [/\bsobre\s?stock\b/i, "sobrestock"],
  [/\bcapital\b/i, "capital"],
  [/\bgastos?\s+declarad\w*/i, "gastos"],
  [/\bresultado\s+del\s+negocio\b|\bestado\s+de\s+resultados?\b|\butilidad\w*\b|\bp\s*&\s*l\b/i, "resultado"],
  [/\ben\s+juego\b/i, "en_juego"],
  [/\bgrupo\s*80\b|\bplano\s+80|\b80\s*\/\s*20\b/i, "grupo80"],
  [/\buniverso\b/i, "universo"],
  [/\bbrecha\b/i, "brecha"],
  [/\bvara\b/i, "vara"],
  [/\bsello\b|\bprobad[oa]s?\b/i, "probado"],
  [/\bindicad[oa]s?\b/i, "indicado"],
];

// matchConcept(text) → el slug del concepto nombrado en el texto (el más específico), o null. Puro/estático.
// Antes de los matchers de frase prueba el texto COMPLETO como etiqueta de pantalla: así "Días inv." o
// "Acciones comerciales" —tal como se leen en Sentrix— resuelven sin depender de que exista una expresión regular.
export function matchConcept(text) {
  const t = String(text || "");
  const exacta = _INDEX.get(_norm(t));
  if (exacta && exacta.slug) return exacta.slug;
  for (const [re, slug] of CONCEPT_MATCHERS) if (re.test(t)) return slug;
  return null;
}

/* ── COBERTURA · lo que el gate le exige a este archivo ────────────────────────────────────────────────────────
 * vocabularioSinConcepto() devuelve los términos que los contratos declaran y el glosario NO sabe responder.
 * Es la red que hace que una etiqueta nueva no nazca huérfana en silencio: si mañana entra una métrica, una
 * comparación, un kind de universo, un sello o un componente, y nadie le declara concepto, aparece acá y el gate
 * de glosario falla. Ninguna lista escrita a mano: todo sale de los contratos. */
export function vocabularioSinConcepto() {
  const sinRespuesta = (t) => !resolveGlossary(t);
  return {
    metricas: _METRICAS_SIN_CONCEPTO.slice(),
    comparaciones: COMPARACIONES.filter(sinRespuesta),
    universos: UNIVERSO_KINDS.filter(sinRespuesta),
    sellos: SELLOS.filter(sinRespuesta),
    etiquetasManifiesto: Object.values(VIEW_MANIFEST).map((m) => m.label).filter((l) => l && sinRespuesta(l)),
    etiquetasMetricDefs: Object.keys(METRIC_DEFS).filter(sinRespuesta),
    etiquetasRegistro: Object.values(METRICS).map((m) => m.label).filter(sinRespuesta),
  };
}

// Las etiquetas que el glosario sabe responder, con su fuente. Diagnóstico para el gate y para quien audite la
// cobertura; no lo consume el producto.
export function etiquetasConocidas() {
  return [..._INDEX.entries()].map(([etiqueta, v]) => ({ etiqueta, fuente: v.slug ? "concepto" : v.metricDef ? "metrica" : "componente", slug: v.slug || null })).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
}
