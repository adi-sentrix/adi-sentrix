/* === src/adi/oracle/planPrompt.js · ARQUITECTURA C · PASADA 1 · EL PLAN ===
 * El LLM libre LEE la pregunta (+ el hilo + la memoria de interacción) y emite un PLAN estructurado: qué tools
 * llamar y con qué alcance. Acá se RESUELVEN por comprensión el alcance ("del negocio" vs entidad heredada), la
 * corrección, la definición, la deixis y los seguimientos — sin regex. El plan es JSON-válido por construcción
 * (tool_choice forzado sobre PLAN_TOOL). NO calcula ni inventa cifras: solo decide qué datos pedir. Aún en sombra.
 */
import { MODE_KEYS, buildModeDoctrine, buildRepairPlanDoctrine, REPAIR_KINDS, REPAIR_FIELD_KEYS } from "./conversationalContract.js";
import { DETAIL_LEVELS, CONTENT_SCOPES, buildPrefDoctrine } from "./responsePreference.js";
// EL HILO CON PRESUPUESTO (owner 2026-08-13, Paso 1 "ADI pierde el hilo"): la política de qué turno viaja entero
// y cuál se resume es UNA sola, compartida con narrationContract.js — vive en hiloBudget.js, no se duplica acá.
import { aplicarPresupuestoHilo, PLAN_HILO_PRESUPUESTO_CHARS } from "./hiloBudget.js";

// CATÁLOGO que ve el LLM · una línea por tool: qué responde + qué args. Colapsa el `focus` (arg, no regex).
export const TOOL_CATALOG = `queryMetric{metric,dimension,filters?,limit?} — ranking/lista de una métrica por un eje ENTERO (con filtro opcional de OTRO eje). métricas: ventas, margen, contribucion, costo, acciones, carga, capital, rotacion, doh. "acciones" = el MONTO $ de rebates/descuentos concedidos (la cifra que el KPI de la cara Comercial muestra como "Acciones comerciales"); "carga" = ese MISMO monto expresado como % de la venta — son la misma realidad en dos unidades, pedí "acciones" si preguntan por el $ y "carga" si preguntan por el %. Con dimension:"cliente", ventas/contribucion/acciones traen además LA CIFRA DE CABECERA del negocio (la venta total, la contribución total, el total de acciones comerciales): es la tool para "¿de dónde sale ese KPI?" — devuelve el total Y las filas que lo componen, con la fuente declarada. ejes(dimension): cliente, marca, familia, sku, bodega, canal — no todos los ejes sirven para toda métrica (acciones: cliente/sku · carga: cliente/sku/marca/familia · capital/rotacion/doh: sku/bodega); si pedís uno que no está declarado la tool DECLINA honesto y eso es lo correcto, no reintentes con otro eje. Ej: "ventas por cliente" → {metric:"ventas",dimension:"cliente"}. NUNCA la uses para UNA entidad puntual ya nombrada (ej. "unidades vendidas de X", "el margen de Y") aunque suene a "una métrica" — eso es entityRecord/entityProfile con esa entidad; queryMetric es solo para listar/rankear el eje completo, no trae la fila de una sola entidad.
entityProfile{dimension,entity} — perfil interpretado de UNA entidad (sus métricas clave, para "¿quién es / cómo viene X?"). dimension: cliente/sku/marca/familia — es un HECHO del dato, no algo que se adivina por el fraseo ("el costo medio de X" no dice si X es cliente, marca o SKU). Si no estás seguro de a qué eje pertenece la entidad que nombró el usuario, preferí dimension:"cliente" (la mayoría de los perfiles piden una cuenta) — el motor corrige el eje solo si hace falta, así que un acierto en el NOMBRE de la entidad importa más que adivinar bien el eje. LECTURA EJECUTIVA (owner 2026-08-06): si el usuario pide EXPLÍCITAMENTE "el PERFIL"/"el AVANCE"/"el ESTADO"/"un RESUMEN" de la entidad (no solo "cómo está" de pasada) — quiere la foto completa, no solo el corte del período: sumá TAMBIÉN, en el MISMO plan, una call trend{dimension,entity} (misma entidad/eje, SIN period) — dos calls, un turno. Eso trae el mes a mes, el mejor/peor mes del año y la variación contra el año anterior, los ingredientes que la lectura ejecutiva necesita para el qué/por qué/qué hacer completo (no solo el "qué"). Con SOLO "cómo está X"/"cómo viene X" (sin esas palabras de pedido explícito de perfil), seguí con entityProfile solo — no dispares trend de más.
entityRecord{dimension,entity} — LA FILA COMPLETA de UNA entidad: TODAS sus columnas reales. Usalo para preguntas de CAMPO CONCRETO. dimension: cliente/sku/marca/familia — mismo criterio que entityProfile (es un hecho del dato, no del fraseo; ante la duda preferí "cliente"). Ej: "cuántas unidades tengo del SKU X" → {dimension:"sku",entity:"X"}; "cuántas unidades vendió el cliente X" → {dimension:"cliente",entity:"X"}; "el rebate del cliente X" → {dimension:"cliente",entity:"X"}; "todo del SKU Y" → {dimension:"sku",entity:"Y"}. Trae: unidades en stock, unidades VENDIDAS, valor de inventario, rotación, cobertura(DOH), días sin venta, estado, ventas, margen, contribución, rebate, precio de lista, etc. El nombre de la entidad SIEMPRE es el que use EL USUARIO — nunca inventes uno.
gridTable{dimension,sortBy,limit} — LA TABLA: los top-N de una dimensión con TODAS sus columnas, para responder pedidos MULTI-COLUMNA sobre un ranking. sortBy = campo para rankear (venta/contribucion/margen/stockUSD/rotacion/unidades). Ej: "ventas, costo medio y margen de contribución de mis 5 mejores SKU" → {dimension:"sku",sortBy:"venta",limit:5}. Trae por fila: ventas, costo, contribución, margen, margen de contribución, precio de lista, costo medio unitario, unidades, valor de inventario, unidades en stock, rotación, etc. USALO cuando pidan varias métricas juntas de un top-N (no dispares una tool por métrica).
tensionRead{dimension,metricA?,metricB?,limit?} — cruza DOS MÉTRICAS DEL MISMO EJE y devuelve el top-N de cada una YA CRUZADO (quién aparece en ambos rankings, quién solo en uno). USALO SOLO cuando piden EXPLÍCITAMENTE cruzar/contrastar dos cosas del MISMO eje ("¿quién sostiene la contribución y quién consume más capital?", "tensión entre aporte y consumo", "quién ayuda vs quién frena") — para una sola métrica seguí usando gridTable/marginRead/contributionRead. metricA/metricB: los MISMOS field-tokens que gridTable/queryMetric — venta, costo, contribucion, margen, stockUSD, rotacion, doh, precioLista, costoMedio, unidades, pctRebate. Si el usuario nombra explícitamente las dos métricas a cruzar (ej. "cruza rotación con contribución"), MANDÁ esos tokens en metricA/metricB — NUNCA los omitas y dejes los defaults en silencio, eso responde una pregunta distinta a la que se hizo. Sin especificar, default metricA:"contribucion", metricB:"stockUSD" (el VALOR BRUTO del inventario de ese SKU — NO es lo mismo que "capital inmovilizado/detenido", que es un concepto aparte de inventoryStatus/diagnose ligado a rotación y DOH; un SKU con stockUSD alto puede estar sano y rotando bien). Hoy SOLO el eje "sku" tiene ambas columnas (comercial + inventario) — para cliente/marca/familia la tool declina honesto (no hay tabla puente eje↔SKU en el dato); si preguntan la tensión por cliente, igual llamá tensionRead(dimension:"cliente") para que declare el límite en vez de asumirlo vos.
entityComposicion{dimension,entity} — DE QUÉ SE COMPONE la compra de UN cliente: desglose por familia con venta, contribución, margen, share, unidades y rotación. SOLO eje cliente. No es entityRecord (esa trae la fila, no el desglose) ni clientesPorSku (esa va al revés: de unos SKU a las cuentas).
entityCapitalLigado{dimension,entity} — el inventario inmovilizado cruzado contra el surtido de UN cliente (SKU, bodega, valorizado, días sin venta). SOLO eje cliente. Si el dato no sostiene la relación cliente×SKU, DECLINA con la razón medida: eso es la respuesta correcta, no reintentes con otra tool.
clientesPorSku{entities:[sku...],topN?} — dados unos SKU, QUÉ CUENTAS los tienen en su surtido ("para esos SKU, ¿quién podría comprarlos?"). En entities van SKU, no clientes, y va la lista entera en UNA call. No es tensionRead (eso cruza dos métricas del mismo eje). La relación es afinidad ESTIMADA: sale sellada "indicado" — narrala como señal, nunca como compra observada.
compareEntities{dimension,entities:[a,b]} — SOLO DOS entidades lado a lado. Es la tool PREFERIDA para "A vs B"/"compara A con B" con EXACTAMENTE 2 entidades nombradas — UNA sola call, no dos entityProfile separados (aunque el resultado numérico sea igual, esta es la forma canónica: trae ambas YA cruzadas con su participación relativa, que 2 llamadas sueltas no calculan). NUNCA la uses para elegir/priorizar entre 3 o más (ni en pares ni en llamadas repetidas) — para eso es diagnose o el read del focus correspondiente.
diagnose{filters?} — RICO: barre TODOS los focos de pérdida/inmovilización (contribución no capturada, carga comercial alta, capital detenido) rankeados por $, CADA UNO con su entidad y su monto. Usalo para "¿dónde pierdo plata?", "diagnóstico", "un insight para mejorar", Y TAMBIÉN para "¿cuál corregir primero?/¿a cuál priorizo?" sobre una lista de entidades ya discutida — te da el $ por entidad que necesitás para justificar el "por qué" (si el hilo habló de contribución no capturada, sus $ por cliente están ACÁ; no los recuerdes solo del historial, volvé a pedirlos con esta tool para que queden autorizados en este turno). SIN filters = TODO el negocio. NUNCA la uses SIN filters para UNA o DOS entidades ya nombradas puntualmente (ej. "¿por qué Sodimac pierde margen?", "el diagnóstico de Tottus") — sin filters, el $ que trae es el de TODA la cartera, y atribuírselo a una sola entidad nombrada es un error de cifra, no un matiz: pasá filters:{cliente:"Sodimac"} (o marca/familia/bodega, el eje real de esa entidad) para acotarlo a ella. 3+ entidades sin acotar (una lista/ranking completo) SÍ es el uso normal, sin filters.
executiveSummary{} — la lectura completa de 5 movimientos (cómo ganás, margen, dónde perdés, por qué, recuperación) DEL NEGOCIO ENTERO — no tiene forma de acotarse a una entidad. Usalo para "resumen ejecutivo" del negocio. NUNCA la uses para "¿cómo viene Sodimac?" o cualquier pregunta sobre UNA entidad puntual, aunque suene a "resumen" — eso es entityProfile (o diagnose/marginRead/contributionRead CON filters de esa entidad, si lo que se pide es el porqué de un problema puntual).
inventoryStatus{filters?,focus?} — DIAGNÓSTICO de inventario DETENIDO/inmovilizado (lo que NO rota, el capital trabado) · YA TRAE monto, SKU, bodega, antigüedad/rotación y prioridad — es la respuesta completa a "dónde tengo capital inmovilizado" y a sus follow-ups ("insights para liberarlo", "cómo priorizo"), SIN otra tool. NO uses esto para "cuánto inventario/unidades tiene un SKU" (eso es entityRecord o queryMetric capital) — esto es solo lo que está frenado. SIN focus = frenado/detenido por default: NUNCA inventes un filtro tipo {state:"detenido"} o {estado:"frenado"} — eso NO es un filtro válido (filters es SOLO marca/familia/bodega) y la call se rechaza. Si te preguntan por el mismo capital ya discutido, volvé a llamarla igual (sin entity ni filtro de estado) para traer sus cifras autorizadas DE NUEVO en este turno — no las repitas solo de memoria del hilo.
marginRead{dimension,focus?,filters?} — lectura de margen por eje. YA INCLUYE venta + margen de CADA entidad (no dispares queryMetric aparte para la venta — vendría con un filtro inválido y se rechaza). focus: "bajo_benchmark" (quién está bajo la vara / quién cede o resigna margen · ES EL DEFAULT) · "alto_volumen_bajo_margen" (quién VENDE MUCHO pero deja POCO margen: cruza volumen con margen y prioriza por oportunidad, nunca por la venta más grande) · o "negativos". Ej: "qué clientes ceden más margen" → {dimension:"cliente",focus:"bajo_benchmark"} SIN filters. Trae también, por entidad bajo benchmark, "Medida · 1pp en X" (cuánto vale 1 punto de margen ahí) — usalo para "cuánto se podría recuperar", NUNCA multipliques brecha% × venta vos mismo (no está autorizado). NUNCA la uses SIN filters para "el margen de X"/"cuánto cede Y" de UNA entidad ya nombrada — eso es entityRecord/entityProfile con esa entidad (o, si necesitás la "Medida" de recuperación de ESA entidad puntual, marginRead CON filters:{cliente:"X"} acotado a ella, nunca sin filtro).
salesRead{dimension,focus?,filters?} — lectura de ventas por eje (patrones/rankings: vs año anterior, vs presupuesto, concentración). focus: "vs_anterior" (default). NO trae "unidades vendidas" de una entidad puntual — para eso (o cualquier campo concreto de UN cliente/marca/sku/familia) usá entityRecord.
contributionRead{dimension?,focus?,filters?,entity?} — lectura de contribución. focus: "rank" (default, RANKEA TODO el eje) o "no_capturada". OJO: el 'entity' de este arg es solo un realce de CONTEXTO para focus="origen" — el focus DEFAULT ("rank") lo IGNORA por completo y de todos modos trae la cartera entera. NUNCA la uses SIN filters para "la contribución de X" de UNA entidad ya nombrada, aunque le pongas 'entity' — pasá SIEMPRE filters:{cliente:"X"} (o el eje real) para acotarla a esa fila; sin filters, 'entity' NO recorta nada y el $ que trae es el de TODA la cartera. Para una entidad puntual, entityRecord/entityProfile suele ser más directo.
trend{metric,dimension?,entity?,period?} — LA SERIE MENSUAL / evolutivo. Usalo SIEMPRE que pidan "mes a mes", "mensual", "evolución", "cómo viene mes a mes", "el primer trimestre/Q1", "un mes puntual" (marzo), un rango ("de enero a marzo"), o "esto mismo mes a mes". OJO — CONTRASTE CLAVE: "cómo viene X de Y" SIN ningún calificador temporal explícito ("mes a mes"/"por mes"/"evolución"/un mes o rango puntual) NO es temporal — es una pregunta de ESTADO PUNTUAL, va a entityProfile/entityRecord con esa entidad, NUNCA a trend. Ej: "cómo viene el margen de Falabella" → entityProfile (perfil puntual, sin period); "cómo viene el margen de Falabella mes a mes" → trend (agregá el calificador temporal, es lo único que cambia la respuesta de estado a serie). La MISMA pregunta, con y sin el calificador temporal, exige tools DISTINTAS — no asumas trend solo porque "viene" suena a evolución. metric = LA QUE NOMBRÓ EL USUARIO: ventas|contribucion|margen|resultado|inventario|canal (mensual REAL hay de ventas/contribución/margen; para el resto la tool devuelve el límite honesto y su alternativa — ESO es lo correcto). Global (sin dimension ni entity), por eje (dimension: cliente/marca/familia/sku → matriz meses×entidades), o de UNA entidad (entity). period = LA FRASE TEMPORAL DEL USUARIO TAL CUAL ("mes a mes", "el primer trimestre", "marzo", "el mes que viene", "los próximos 3 meses") — no la normalices ni la traduzcas: la tool necesita la frase original para distinguir pasado de FUTURO.
simulateCarga{delta_pp?} — simulación sobre la carga comercial (acciones comerciales/rebates). SIN delta_pp: la lleva al target del negocio. CON delta_pp: el movimiento EN PUNTOS que declaró el usuario ("reduce en 2 puntos las acciones comerciales de esos clientes" → delta_pp:-2; solo el número, con el signo de la dirección, rango -20 a 20) — ese modo devuelve además, cuenta por cuenta, el margen resultante y si queda sobre o bajo el benchmark, así que responde entero "¿y quedan sobre el benchmark?" sin otra tool ni aritmética tuya. delta_pp SOLO si el usuario dio esa cifra en ESTE turno: si no dio ninguna, omitilo — inventarle un delta es peor que responder con el target. simulateCapital{} — "¿y si libero el capital detenido?".
simulateCosto{pct,dimension?,scope?,filters?} — "¿y si bajo/subo el costo medio de mis peores SKU/marca/familia/clientes un X%?". pct es un NÚMERO con el signo de la dirección que pidió el usuario: si dice "bajar 3%" mandá el número negativo -3; si dice "subir 2%" mandá el número positivo 2 (NO escribas el símbolo "%" ni un texto tipo "pct:-3" — solo el número, en el campo JSON "pct" del objeto args). Rango operable: entre -50 y 50 — fuera de ese rango la tool declina honesto (no es un supuesto realista, no lo fuerces). dimension default "sku". scope: "bajo_benchmark" (default, "mis peores") o "all" (todo el eje/filtro). Calcula margen y contribución NUEVOS vía costo — NO uses el "simulate" genérico para esto (no cubre costo) ni inventes la aritmética vos mismo (costo × factor no está autorizada si la calculás a mano).
simulateGeneral{dimension,entity,variableA:{campo,delta_pct},variableB:{campo,delta_pct}} — "si subo el precio 5% a Falabella pero pierdo 10% de volumen, ¿me conviene?": DOS variables (precio Y volumen) covariando sobre UNA entidad puntual — a diferencia de las demás simulate*, que mueven una sola palanca sobre un eje entero. campo de cada variable es SIEMPRE "precioLista" (la de precio) o "unidades" (la de volumen) — nunca otro valor, y las DOS variables son OBLIGATORIAS, una de cada campo (NUNCA dupliques el mismo campo en las dos). delta_pct = el % con el signo de la dirección que pidió el usuario (subir 5% → 5; bajar 10% → -10), igual convención que simulateCosto. Rango operable por variable: entre -50 y 50. Calcula ventas SIEMPRE; margen/costo/contribución SOLO si el negocio declaró su modelo de costo (la tool lo sabe, vos no lo decidís) — si no está autorizado, la tool responde igual con ventas y una limitación honesta; NUNCA es un error, no reintentes con otra tool.
pnlRead{dimension?,entity?,focus?} — EL RESULTADO DEL NEGOCIO (el P&L / estado de resultados): la cascada completa ingreso − costo − carga comercial − gastos declarados = RESULTADO, con su % sobre la venta. Usalo SIEMPRE que pregunten por el "resultado" (del negocio, final, neto, operacional, del ejercicio), la "utilidad", la "ganancia neta", el "estado de resultados", el "P&L", o cualquier cosa "después de gastos". OJO — LA CONFUSIÓN QUE MÁS DAÑO HACE: contribución y resultado son DOS NIVELES DISTINTOS de la misma cascada. La contribución es lo que queda ANTES de los gastos declarados; el resultado, DESPUÉS. Si preguntan por el RESULTADO, NUNCA uses contributionRead — la cifra sería real y la pregunta, otra. Sin args = el negocio completo. entity = el P&L de UNA cuenta/marca/familia ("¿cuánto me deja Falabella después de gastos?"). dimension = la tabla del P&L por ese eje ("el resultado por familia"): sólo cliente/marca/familia — por SKU, bodega o canal la venta del P&L no baja desglosada y la tool declina honesto (no la fuerces). focus:"linea" = qué línea de gasto pesa más. Si el negocio todavía no declaró sus líneas de gasto, la tool declina honesto y explica que la cuenta llega hasta la contribución: ESO es la respuesta correcta, no reintentes con otra tool.
defineConcept{concept} — definición AUTORIZADA del glosario. Cubre los conceptos del negocio (contribución no capturada, carga comercial, acciones comerciales, rebate, benchmark, margen de contribución, margen bruto, contribución, resultado del negocio, rotación, días de inventario), el vocabulario del alcance (universo, grupo 80, la cola, eje, brecha, en juego, vara, meta, presupuesto), los estados del inventario (capital inmovilizado, riesgo de quiebre, sobrestock) y el sello de cada cifra (probado, indicado, abierto). Usalo SIEMPRE que pregunten "qué es X" / "a qué te referís con X" / "explicame X" — NUNCA definas de memoria. El arg "concept" = el término TAL COMO lo escribió el usuario, incluida la etiqueta que ve en pantalla ("Días inv.", "En juego $", "Acciones comerciales"): la tool resuelve la etiqueta contra el glosario. OJO: "margen bruto" y "margen de contribución" son DOS conceptos distintos — pasá el que el usuario nombró, sin normalizarlo al otro.
calcular{operacion,insumos:[{entidad?,metrica}|{usuario:"la cifra CON su origen"}],objetivo?,umbral?} — LA CALCULADORA del motor: la cuenta que la pregunta pide, ejecutada con su fórmula declarada. operacion: suma, resta, variacion_pct (de A a B), participacion (A sobre B), brecha_pp (tasa vs tasa), escalar (regla de tres), margen_objetivo ("¿qué falta para llegar a 25%?" → insumos:[{entidad:"X"}] + objetivo:{usuario:"25% y su origen"}), suma_filtrada (el total de un campo del inventario SOLO para las filas que cumplen EL UMBRAL NUMÉRICO que el usuario pidió — "¿cuánto capital en SKU parados más de 90 días?" → {operacion:"suma_filtrada",insumos:[{metrica:"capital"}],umbral:{metrica:"dias sin venta",operador:">",valor:90}}; umbral.metrica: dias sin venta/dias de inventario/rotacion. USALA siempre que la pregunta traiga un corte numérico explícito — inventoryStatus NO aplica ese corte: responde por estados del motor). Cada insumo es una REFERENCIA (entidad+metrica del dato, o la cifra del usuario con su origen — jamás un número suelto): NUNCA hagas la aritmética vos mismo. Si las unidades no operan o los universos no reconcilian, la tool declina honesto.`;

// PLAN_TOOL · el schema del plan (tool neutral · el adapter lo fuerza). calls[].args es objeto abierto (cada tool
// define sus campos en el catálogo). scope hace EXPLÍCITO el alcance para que "del negocio" nunca herede una entidad.
export const PLAN_TOOL = {
  name: "emitPlan",
  description: "Emití el plan de datos para responder el turno del usuario.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      intent: { type: "string", enum: ["answer", "define", "redirect", "ack"], description: "answer=responder con datos · define=explicar un concepto (sin volcar números) · redirect=el usuario corrige/reencauza, replanteá · ack=solo reconocer (ej. instrucción de trato, sin pedir datos)" },
      // MODO conversacional (owner 2026-07-29, capa de rol conversacional — Fase 1 clarify, Fase 2 los 7 modos) —
      // EJE DISTINTO de `intent`: intent decide QUÉ DATO pedir, mode decide CÓMO NARRARLO. Un "qué significa X" es
      // intent=define + mode=clarify a la vez (la definición se busca igual, pero se explica simple). La lista de
      // modos y su doctrina vive en conversationalContract.js (fuente ÚNICA, versionada — la Pasada 2 la comparte).
      // answerViaOracle.js tiene además un chequeo determinístico que FUERZA mode="clarify" ante frases inequívocas
      // ("no entendí", "explícame más fácil", "qué significa") — esto de acá cubre el resto por comprensión.
      mode: { type: "string", enum: MODE_KEYS, description: "decide CÓMO se narra la respuesta (ver doctrina de modos en el system prompt) — nunca cambia qué datos pedís." },
      // PREFERENCIA DE RESPUESTA (owner 2026-07-29) — EJE DISTINTO de `mode`: mode decide QUÉ necesita el usuario
      // (dato/diagnóstico/decisión/simulación), pref decide CÓMO quiere recibirlo (completo o comprimido). Fuente
      // única en responsePreference.js (misma arquitectura que MODE_KEYS/conversationalContract.js). Objeto OPCIONAL
      // y disperso: solo se llena cuando el turno ACTUAL lo pide — un turno sin pedido de formato lo deja vacío, el
      // motor mantiene la preferencia de sesión si había una (ver answerViaOracle.js, coerción determinística de red).
      pref: {
        type: "object", additionalProperties: false,
        description: "Preferencia de FORMATO de respuesta, SOLO si el usuario la pidió en ESTE turno (ver doctrina 'PREFERENCIA DE RESPUESTA' en el system). No la repitas de un turno anterior — dejala vacía si no dijo nada al respecto ahora.",
        properties: {
          detailLevel: { type: "string", enum: DETAIL_LEVELS },
          contentScope: { type: "string", enum: CONTENT_SCOPES },
          // FORMA DE SALIDA · turn-local. Doctrina y garantía: progressiveDisclosure.js (resolveOutputForm) y el
          // renderer de answerViaOracle.js. Acá va CORTO: el system de PLAN tiene presupuesto de tokens y
          // `_reparacion_contextual_gate` lo verifica — repetir la doctrina encarecería cada turno.
          outputForm: { type: "string", enum: ["auto", "tabla", "prosa", "solo_conclusion"], description: "Forma pedida en ESTE turno. 'directo' es detailLevel, no quita tabla pedida." },
          persist: { type: "boolean", description: "true SOLO si el usuario dijo algo como 'desde ahora'/'de ahora en adelante'/'siempre respondeme así' (la preferencia debe durar más de este turno). Default false: un pedido puntual de brevedad/alcance sin ese marcador aplica SOLO a este turno." },
        },
      },
      rationale: { type: "string", description: "En una frase, por qué este plan (para auditoría)." },
      scope: {
        type: "object", additionalProperties: false,
        properties: {
          level: { type: "string", enum: ["global", "entity", "list"], description: "global=todo el negocio (NO heredes una entidad de antes si el usuario dice 'del negocio'/'en general') · entity=una entidad · list=un conjunto nombrado antes." },
          entities: { type: "array", items: { type: "string" }, description: "Nombres de entidad si level=entity/list." },
        },
      },
      calls: {
        type: "array",
        description: "Las tool-calls a ejecutar (0 si intent=ack/define). Máximo 6.",
        items: {
          type: "object", additionalProperties: false,
          properties: {
            tool: { type: "string", enum: ["queryMetric", "entityProfile", "entityRecord", "gridTable", "tensionRead", "compareEntities", "diagnose", "executiveSummary", "inventoryStatus", "marginRead", "salesRead", "contributionRead", "trend", "simulateCarga", "simulateCapital", "simulateCosto", "simulateGeneral", "defineConcept", "pnlRead", "clientesPorSku", "entityComposicion", "entityCapitalLigado", "calcular"] },
            args: { type: "object", additionalProperties: true, description: "Args de la tool según el catálogo (metric, dimension, entity, entities, filters, focus, limit)." },
          },
          required: ["tool", "args"],
        },
      },
      // supuestos_faltantes (owner 2026-07-31, #56 "simulate v2") — MECANISMO DE request_clarification: cuando el
      // usuario pide una simulación de DOS variables (precio+volumen, simulateGeneral) pero SOLO nombró una, esto
      // NO es "el negocio pide una tool distinta" ni "el negocio contestó mal" — es un PEDIDO AMBIGUO que corta
      // ANTES del batch (calls queda VACÍO, NUNCA asumas 0% implícito en la variable que no se nombró — 0% no es
      // lo mismo que "no dijo nada", inventar esa cifra es peor que preguntar). Array NO vacío → el motor corta acá
      // y pregunta, sin tocar el dato. Vacío/omitido en el resto de los turnos (el 99% de los casos).
      supuestos_faltantes: {
        type: "array", items: { type: "string" },
        description: "SOLO para simulaciones de 2 variables con una faltante: la pregunta EXACTA que hace falta responder para completar el supuesto (ej. '¿cuánto esperás que cambie el volumen/unidades vendidas?'). Si viene no-vacío, calls debe quedar vacío — no ejecutes la simulación a medias.",
      },
      // reparacion (Contrato Conversacional v1.2, owner 2026-08-10) — QUÉ clase de reencauce es este turno y QUÉ
      // cambió. Va PEGADO a intent="redirect", que ya existía: no se agrega un modo ni una intención nueva (§2/§7
      // del contrato). Sin esto, "no, era Lider" y "no creo que sea por los rebates" llegaban idénticos al motor —
      // el primero exige recalcular e invalidar lo incompatible; el segundo, conservar la evidencia y graduarla.
      // `corrige` es lo que hace que la invalidación sea ESTRUCTURAL: el motor apaga del estado canónico lo que
      // deja de ser compatible con esos campos (ver camposQueSeInvalidan en conversationalContract.js), en vez de
      // confiar en que el prompt se acuerde de no arrastrarlo.
      // LAS DESCRIPCIONES SON MÍNIMAS A PROPÓSITO (owner 2026-08-10): las REGLAS viven una sola vez, en la
      // doctrina del system (buildRepairPlanDoctrine). Repetirlas acá costaba ~700 caracteres de prompt en TODOS
      // los turnos para decir dos veces lo mismo — el schema solo tiene que dejar claro QUÉ va en cada campo.
      // REQUERIDO Y NULLABLE (owner 2026-08-10, tras la primera corrida pagada). Era opcional, y la certificación
      // lo cazó en la primera sonda: el modelo base simplemente lo OMITIÓ. Toda la conducta del contrato colgaba
      // de que se acordara de llenar un campo que el esquema no le pedía. Ahora tiene que decidir explícitamente
      // —el objeto o `null`— y "null" es una declaración, no un olvido: el motor la distingue del silencio.
      reparacion: {
        type: ["object", "null"], additionalProperties: false,
        description: "El objeto en corrección/desacuerdo/dato aportado (ver la doctrina); `null` en el resto. Nunca omitir.",
        properties: {
          tipo: { type: "string", enum: REPAIR_KINDS },
          corrige: { type: "array", items: { type: "string", enum: REPAIR_FIELD_KEYS }, description: "Los campos que el usuario cambió; ninguno más." },
          ambigua: { type: "boolean", description: "Señaló un error sin decir cuál." },
          pregunta: { type: "string", description: "Solo si ambigua: la única pregunta de precisión." },
          dato: {
            type: "object", additionalProperties: false,
            properties: { metrica: { type: "string" }, valor: { type: "string", description: "El número con su unidad, verbatim del usuario." }, periodo: { type: "string" } },
          },
          aceptado: { type: "boolean", description: "Autorizó tratar su cifra como supuesto." },
        },
      },
      memoryUpdate: {
        type: "object", additionalProperties: false,
        description: "Solo si el usuario dio una instrucción de trato/identidad ('llámame X', 'trátame de usted', 'háblame más directo', 'no me muestres tablas', 'prioriza lo financiero').",
        properties: {
          nombre: { type: "string" }, cargo: { type: "string" }, empresa: { type: "string" }, pais: { type: "string" }, moneda: { type: "string" },
          trato: { type: "string", enum: ["tu", "usted"] },
          tecnicismo: { type: "string", enum: ["bajo", "normal"] },
          tablas: { type: "boolean" },
          prioridad: { type: "string", enum: ["financiero", "comercial"] },
          avisarProblemas: { type: "boolean" },
          objetivo: { type: "string" },
        },
      },
    },
    required: ["intent", "mode", "rationale", "calls", "reparacion"],
  },
};

/* ── LA DOCTRINA DEL DATO DEL NEGOCIO PARA EL PLAN (owner 2026-08-14, «el que DECIDE no ve nada») ───────────────
 * POR QUÉ EXISTE: el planificador elegía tools y alcance viendo SOLO el hilo recortado + la pregunta + la línea de
 * vista (buildPlanUserMessage). No sabía qué entidades existen, con qué nombre exacto, en qué eje viven, ni qué
 * métricas tiene declarada cada eje — así que adivinaba el eje por el fraseo y pedía combinaciones que el dato no
 * sirve. La medición del owner (5 llamadas, 2026-08-14) mostró que el MISMO dato que hoy recibe el narrador
 * sostiene un hilo de tres turnos sin perder el alcance; la diferencia no está en quien narra, sino en que quien
 * decide no ve el mapa.
 * QUÉ ES Y QUÉ NO ES — la parte más importante del texto, con la misma dureza que su gemela de NARRAR
 * (DOCTRINA_DATO_NEGOCIO, narratePromptC.js): acá el dato es para ELEGIR LA HERRAMIENTA Y EL ALCANCE, jamás para
 * responder ni para copiar cifras al plan. PLAN emite JSON de tools con tool_choice forzado — nunca redacta— así
 * que una cifra suya no llegaría a pantalla, pero sí puede envenenar un `args` (un filtro con un número) o un
 * `rationale`, y por ahí se cuela una cifra sin autorizar aguas abajo. Se prohíbe explícito.
 * VIAJA SOLO CON EL BLOQUE: sin `datoNegocio` este texto NO entra al system (mismo criterio condicional que la
 * doctrina de pantalla) — el system de un caller viejo queda byte por byte como hoy. */
export const DOCTRINA_DATO_PLAN = `EL DATO DEL NEGOCIO (el bloque que sigue): es el MAPA REAL de este negocio — qué entidades existen y con qué nombre exacto, a qué eje pertenece cada una, qué métricas tiene de verdad cada eje, y qué NO existe en el dato. Está acá para UNA sola cosa: que ELIJAS BIEN LA HERRAMIENTA Y EL ALCANCE. Cuatro reglas:
1. NO RESPONDÉS CON ESTO. Vos emitís un PLAN en JSON (emitPlan) y nada más: jamás una respuesta, jamás una lectura, jamás una cifra narrada. La respuesta la escribe el narrador, con las cifras que las tools autoricen en ese turno.
2. NO COPIES NI UNA CIFRA AL PLAN. Ningún número de este bloque va a "args", ni a "rationale", ni a ningún campo. En los args van nombres, ejes, focos y filtros — nunca montos, porcentajes ni valores. Una cifra copiada acá es una cifra sin autorizar aguas abajo.
3. USALO PARA ACERTAR EL NOMBRE, EL EJE Y LA TOOL. El nombre de la entidad está acá en su forma exacta y en su eje real (cliente, marca, familia, SKU, bodega, canal) — es un HECHO del dato, no algo que se adivine por el fraseo. Y si una métrica no está declarada para ese eje, no pidas esa combinación: elegí la tool que sí la sirve. Ver el bloque también te dice cuántas entidades hay de verdad: no pidas una tool por entidad cuando UNA sola call cubre el eje entero o el par nombrado.
4. NO PLANIFIQUES CONTRA UN HUECO. Lo que la sección «LO QUE ESTE DATO NO TIENE» declara ausente no lo consigue ninguna tool: no armes calls para llegar a eso por otra vía, y no cruces los dos universos («LOS DOS UNIVERSOS QUE NO RECONCILIAN» también es ley acá). Si la pregunta apunta a un hueco, el plan correcto es el mínimo que permita declinar honesto — no una batería de calls que igual no lo van a encontrar.
Este bloque NO reemplaza a las tools: las cifras reales y autorizadas las trae el motor ejecutando tu plan. El mapa es para que el plan pida lo correcto la primera vez.`;

// La doctrina de CONTEXTO DE PANTALLA, aparte porque es CONDICIONAL (ver `hayVista` abajo). Texto sin cambios.
export const DOCTRINA_CONTEXTO_VISTA = `· CONTEXTO DE PANTALLA (owner 2026-08-09, Contrato de Concordancia ADI ↔ Sentrix): si el turno trae una línea "Contexto de pantalla", el usuario está mirando ESO mientras escribe. Resolvé contra esa vista los deícticos de PIEZA ("este gráfico", "esta tabla", "ese punto", "estos clientes", "esos SKU", "los de arriba", "acá"), y pedí a las tools la evidencia de ESA métrica, ESE eje y ESE período — el usuario espera la MISMA cifra que tiene delante, no otra lectura del mismo tema. La línea NO TRAE CIFRAS y NUNCA las inventes desde ella: dice QUÉ está mirando, no cuánto vale; las cifras siguen saliendo EXCLUSIVAMENTE de las tools. Y no manda sobre el turno: si el usuario nombra otra entidad, otro eje, otra métrica o "el negocio", eso PISA el contexto de pantalla — manda lo que dice AHORA, la pantalla es solo el telón de fondo.`;

// buildPlanSystem(persona, memBlock, scenario) → system de la Pasada 1. La DOCTRINA vive acá: entendé libre, pero
// solo PEDÍS datos por las tools; no inventás cifras (eso lo trae el motor y lo valida el guard).
// `datoNegocio` (5º argumento, owner 2026-08-14) — la proyección curada del dato (datoProyectado.js), la MISMA que
// recibe el narrador. Va con su doctrina (DOCTRINA_DATO_PLAN) JUSTO ANTES del escenario, que es el corte del caché:
// así el bloque cae ENTERO del lado FIJO y queda al final de él. Sin el argumento no entra ni un byte.
// `hayVista` (corrección 2026-08-09, pase de regresión): el bullet CONTEXTO DE PANTALLA entraba en el system de
// TODOS los turnos —209 tokens, 2.9% del prompt de PLAN— para explicar cómo tratar una línea que el 100% de los
// turnos sin Sentrix no recibe. Su gemelo de NARRAR (buildNarrateSystemC, `hayContextoVista`) ya se manda condicional
// por esta misma razón y con este mismo criterio; acá faltaba. Con `hayVista=false` el system vuelve a ser byte por
// byte el de antes del contrato, que es la línea base más segura; con la línea presente, no cambia nada.
// ── SEGMENTACIÓN DEL CONTRATO · FIJO vs VARIABLE (owner 2026-08-10, cierre de la certificación live) ───────────
// LO MEDIDO: las 9 llamadas de PLAN consumieron 8.880–8.891 tokens de entrada cada una. La variación TOTAL entre
// las nueve preguntas es de 11 tokens — o sea que la pregunta del usuario no pesa nada y el 96% de cada llamada
// es el MISMO texto, repetido nueve veces: ~77.000 de los 105.699 tokens de entrada de la corrida.
// Desglosado sobre este archivo: el system son 30.534 caracteres (~7.634 tokens) y PLAN_TOOL otros ~925. De esos
// 30.534, **30.469 son idénticos en todos los turnos** (99,8%): sólo el escenario, la memoria de sesión y —cuando
// el turno viene de Sentrix— la doctrina de pantalla cambian, entre 65 y 900 caracteres.
//
// POR QUÉ NO PEGABA EL CACHÉ. El adapter de Anthropic marca `cache_control` sobre el system, pero lo manda como UN
// solo bloque: el punto de corte del caché queda DESPUÉS de la memoria y el escenario. El caché de prefijo exige
// coincidencia exacta hasta el corte, así que basta que la sesión tenga un nombre guardado —o que el turno venga
// de Sentrix— para perder los 7.617 tokens fijos enteros. El texto estable estaba, del lado equivocado del corte.
//
// LA SALIDA, y es la que el owner nombró: segmentar el contrato. NO se recorta ni una regla de negocio ni se toca
// la capacidad de interpretar — `fijo + variable` es BYTE POR BYTE el mismo string que devuelve `buildPlanSystem`,
// y hay un gate que lo verifica. Lo único que cambia es CÓMO viaja: el adapter puede poner el corte del caché
// donde de verdad termina lo estable. Con el sink de telemetría prendido, `tokens_in_cache` lo hace visible.
// `datoNegocio` (owner 2026-08-14, «el dato al PLAN») — quinto argumento OPCIONAL, con la MISMA disciplina que el
// séptimo de buildNarrateSystemSegments: la proyección entra AL FINAL del segmento FIJO, así el fijo de siempre
// queda como prefijo byte-idéntico y el bloque (estable por tenant+escenario) solo EXTIENDE el prefijo cacheable,
// nunca lo parte. Sin el argumento, TODO caller viejo produce el mismo system de hoy, byte por byte.
export function buildPlanSystemSegments(persona, memBlock, scenario, hayVista = false, datoNegocio = null) {
  const completo = buildPlanSystem(persona, memBlock, scenario, hayVista, datoNegocio);
  // el corte es la primera línea que depende del turno. La línea del escenario MURIÓ (retrabajo ultracode del
  // colapso, 2026-08-30: el único mundo no se declara al modelo) — el corte cae ahora en la PRIMERA pieza
  // variable presente: la doctrina de pantalla si hay vista, la memoria si hay memoria, y si no, la instrucción
  // final (única en el prompt — verificado). Las cuatro combinaciones cortan en el MISMO punto del prefijo, así
  // que el fijo sigue byte-idéntico entre turnos (lo prueba _plan_cache_gate [2]).
  const marca = hayVista ? DOCTRINA_CONTEXTO_VISTA : (memBlock || "Emití el plan con emitPlan.");
  const i = completo.indexOf(marca);
  if (i <= 0) return { fijo: completo, variable: "" };   // defensivo: sin corte reconocible, se manda como siempre
  return { fijo: completo.slice(0, i), variable: completo.slice(i) };
}

export function buildPlanSystem(persona, memBlock, scenario, hayVista = false, datoNegocio = null) {
  return `${persona}

TU TAREA AHORA (planificación): leé el turno del usuario en el contexto del hilo y emití un PLAN de qué datos necesitás. NO redactás la respuesta todavía; NO inventás cifras. Solo decidís qué tools llamar y con qué alcance.

Tenés estas herramientas de dato (el motor las ejecuta y devuelve cifras REALES y verificadas):
${TOOL_CATALOG}

REGLA DE ALCANCE (la más importante — acá se juega la mitad de tu criterio):
· El alcance de un turno NUEVO lo fija lo que dice el usuario AHORA, no el turno anterior.
· Si el usuario nombra "el negocio", "del negocio", "la rentabilidad del negocio", "en general", "la cartera", "global", "todo" → scope.level="global". NO pongas ningún filtro, NO pongas ningún \`entity\`/\`entities\`, y NO heredes la entidad de un turno previo. "El negocio" es un sujeto NUEVO que pisa cualquier entidad anterior.
· Solo heredás una entidad del turno anterior si el usuario usa un PUNTERO explícito hacia ella: "de esos", "esa cuenta", "y ella", "ahí mismo", "en ese cliente". Un sustantivo fresco ("el negocio", "la marca X", "el inventario") reemplaza el foco anterior.
· Si nombra UNA entidad → level="entity", entities=[esa]. Si dice "de esos/esas" → level="list" con las entidades del turno previo.
· Esto VALE IGUAL cuando la entidad viaja como \`filters\` (bodega/marca/familia/cliente, ej. "el inventario de la bodega Santiago" → inventoryStatus con filters:{bodega:"Santiago"}): igual así, declará scope.level="entity" con esa bodega/marca/familia/cliente en scope.entities — un filtro de UN solo valor SIGUE siendo una entidad puntual nombrada, no dejes scope en "global" solo porque el dato viaja en \`filters\` en vez de en \`entity\`.
· Antes de emitir, revisá: ¿el usuario pidió el negocio completo? Entonces calls SIN filtro ni entidad. Si te descubrís arrastrando una entidad que él no volvió a nombrar, sacala.

REGLA DE ARGUMENTOS (dos errores que rompen la respuesta):
· NUNCA SUSTITUYAS LA MÉTRICA que el usuario nombró por una parecida ("resultado" NO es "contribución"; "inventario" NO es "ventas"). Pedí la que él dijo: si el motor no la tiene mensual/por ese eje, DEVUELVE el límite honesto y su alternativa — eso es una buena respuesta. Sustituirla en silencio da cifras reales a una pregunta que nadie hizo, y eso es lo peor que podemos hacer.
· 'filters' es SOLO para RECORTAR el universo a un valor de un eje: marca, familia, bodega, cliente. NADA MÁS. Un criterio/condición NO es un filtro: "bajo el benchmark", "los que ceden margen", "los que no rotan", "lo que está detenido" van en 'focus' (o son la tool misma), NUNCA en filters. Y "métrica" o "global" tampoco: el alcance global es SIN filters. Si ponés una key inventada en filters (benchmark, condicion, estado, metric, periodo…), el motor NO puede responder y el turno se pierde.
· Pasá SIEMPRE los args que definen el alcance. En 'trend': metric SIEMPRE, y si el usuario nombra una entidad → entity (ej. "cómo viene el cliente X mes a mes" → {metric:"ventas",entity:"X"}); si pide un eje → dimension (ej. "ventas mes a mes por cliente" → {metric:"ventas",dimension:"cliente"}); sin ninguno = el negocio completo. Una tool sin args responde OTRA pregunta.
· "ELEGIR UNO / PRIORIZAR" entre 3+ entidades ya nombradas ("cuál corregir primero", "a cuál priorizo", "por dónde arranco"): NO alcanza con el margen solo — pedí la tool que trae el $ de la RAZÓN por la que se viene hablando de ellas (si el hilo mencionó contribución no capturada/carga comercial/capital → diagnose o el read de ese focus), para que esos montos queden autorizados EN ESTE TURNO. No confíes en que el narrador los recuerde del historial: si no los volvés a pedir, no puede citarlos y la respuesta sale vacía o vaga.

Otras reglas:
· Entendé la intención real, no las palabras sueltas. Corto o largo, formal o informal, con errores — entendé igual.
${buildRepairPlanDoctrine()}
· DEFINICIÓN: si pregunta qué significa un concepto ("qué es X", "a qué te referís con X", "explicame X") → intent="define" Y SIEMPRE llamá defineConcept: calls=[{tool:"defineConcept", args:{concept:"<el concepto tal como lo nombra el usuario, ej: contribución no capturada>"}}]. NUNCA dejes calls vacío en una definición — la definición sale del glosario, no de tu memoria.
· SIMULACIÓN DE 2 VARIABLES ("si subo el precio X% pero pierdo/gano Y% de volumen, ¿conviene?" — precio Y volumen a la vez, sobre UNA entidad puntual): eso es simulateGeneral, NUNCA simulateCosto/simulate genérico (esos mueven una sola palanca sobre un eje entero, no dos sobre una entidad). Si el usuario nombró AMBAS variables con su % → armá la call normal. Si solo nombró UNA ("si subo el precio 5%, ¿conviene?", sin decir qué pasa con el volumen) → NO asumas la otra en 0% (0% no es lo mismo que "no dijo nada" — inventar esa cifra es peor que preguntar): dejá calls VACÍO y llená supuestos_faltantes con la pregunta exacta que falta (ej. "¿cuánto esperás que cambie el volumen/unidades vendidas?"). Esto es DISTINTO de mode=clarify (que es sobre CÓMO explicar algo ya calculado) — acá directamente no hay datos suficientes para calcular nada todavía.
· MODO (elegí SIEMPRE uno, por comprensión — no cambia QUÉ pedís, solo CÓMO se va a narrar; seguí pidiendo los mismos datos que la pregunta necesita en cualquier modo):
${buildModeDoctrine()}
${buildPrefDoctrine()}
· TRATO/IDENTIDAD: si da una instrucción de cómo tratarlo → llená memoryUpdate. "llámame X" → nombre:X. "trátame de usted" → trato:usted; "de tú"/"tuteame" → trato:tu. "no uses tecnicismos" → tecnicismo:bajo. "no me muestres tablas" → tablas:false. "prioriza lo financiero/el impacto económico" → prioridad:financiero. Si SOLO da la instrucción → intent="ack", calls=[]. Si además pregunta algo → intent="answer" con sus calls. (Las correcciones de verbosidad/detalle — "háblame más directo", "sin rodeos", "explícame con más detalle" — NO van acá, son "pref", ver arriba.)
· Elegí las tools mínimas que respondan de verdad. Una respuesta "overview"/"resumen"/"insight del negocio" puede pedir varias (ej. executiveSummary, o diagnose + queryMetric) — pero con el alcance correcto.
· TEMPORAL: para "mes a mes", "mensual", "evolución", "cómo viene mes a mes", un trimestre/Q, un semestre, un mes puntual, un rango de meses, o "esto mismo mes a mes" → usá la tool 'trend' (metric + dimension o entity + period). El dato mensual REAL es VENTAS y CONTRIBUCIÓN (la propia tool declara honesto lo que no: resultado/P&L mensual, inventario mensual, canal mensual, margen en matriz por eje). CONSERVÁ EL ALCANCE DEL TURNO ANTERIOR: si venías hablando de un EJE (los SKU, los clientes, las marcas) y ahora piden "esto mismo mes a mes", pasá ese eje → dimension:"sku"/"cliente"/"marca" (NO el negocio global: cambiarle el alcance al usuario sin avisar es peor que no responder). Si venías de UNA entidad, pasá entity. Si en un seguimiento la métrica anterior no tiene mensual (ej. costo medio), pedí 'trend' de la que SÍ (ventas/contribución) sobre el MISMO eje — no la foto actual. FUTURO/pronóstico NO existe (no hay serie a futuro): eso sí, intent="answer" y el narrador aclara que no proyecta.
${datoNegocio ? `\n${DOCTRINA_DATO_PLAN}\n\n${datoNegocio}\n\n` : ""}${hayVista ? DOCTRINA_CONTEXTO_VISTA + "\n\n" : ""}${memBlock ? memBlock + "\n\n" : ""}Emití el plan con emitPlan.`;
}

// buildPlanUserMessage(history, text) → el mensaje de usuario para la Pasada 1 (hilo reciente + turno actual).
// PRESUPUESTO EN VEZ DE TIJERA (owner 2026-08-13, Paso 1 "ADI pierde el hilo" — antes: `.slice(0,220)` por turno,
// el corte del "tope por turno" de 2026-08-03): de una respuesta real de ADI de 1.191 chars con la tabla de 8
// clientes sobrevivían 220 — el 81,5% se descartaba y el seguimiento deíctico ("explícame eso") no tenía a qué
// referirse. La política nueva vive en hiloBudget.js (UNA sola, compartida con el hiloReciente de NARRAR): el
// último turno de ADI viaja SIEMPRE entero, hacia atrás entran turnos completos mientras quepa el presupuesto
// (PLAN_HILO_PRESUPUESTO_CHARS), y el que no cabe se resume a su primera oración + "…" — nunca un corte a mitad
// de cifra. El slice(-8) NO se toca (la ventana por cantidad es decisión del owner). La prioridad de campo se
// invierte a text||gist — ver la nota de cabecera de hiloBudget.js.
// CONTEXTO DE PANTALLA (owner 2026-08-09, Contrato de Concordancia ADI ↔ Sentrix) — `vistaLinea` es UNA SOLA LÍNEA
// de ≤240 caracteres, SIN cifras, producida por viewContext.js:projectViewContextForPlan a partir del ViewContext
// sellado. Es TODO lo que el LLM ve de la pantalla: nunca viajan filas, series, tablas, la salida del builder ni el
// objeto de contexto — la evidencia se la sigue pidiendo el PLAN a las tools. Tercer argumento OPCIONAL a propósito:
// los ~30 callers/gates que llaman con dos argumentos siguen produciendo el MISMO mensaje, byte por byte.
// Va ANTES del turno actual (y después del hilo) porque es TELÓN DE FONDO, no el pedido: lo último que el modelo lee
// tiene que ser lo que el usuario acaba de escribir, que es lo que manda (ver la doctrina "CONTEXTO DE PANTALLA").
export function buildPlanUserMessage(history, text, vistaLinea = null) {
  const h = Array.isArray(history) ? history.slice(-8) : [];
  const hist = aplicarPresupuestoHilo(h, PLAN_HILO_PRESUPUESTO_CHARS)
    .map((m) => `${m.role === "user" ? "Usuario" : "ADI"}: ${m.dijo}`).join("\n");
  const vista = typeof vistaLinea === "string" && vistaLinea.trim() ? `${vistaLinea.trim()}\n\n` : "";
  return `${hist ? `Hilo reciente:\n${hist}\n\n` : ""}${vista}Turno actual del usuario: «${text}»`;
}
