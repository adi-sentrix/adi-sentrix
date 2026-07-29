/* === src/adi/oracle/planPrompt.js · ARQUITECTURA C · PASADA 1 · EL PLAN ===
 * El LLM libre LEE la pregunta (+ el hilo + la memoria de interacción) y emite un PLAN estructurado: qué tools
 * llamar y con qué alcance. Acá se RESUELVEN por comprensión el alcance ("del negocio" vs entidad heredada), la
 * corrección, la definición, la deixis y los seguimientos — sin regex. El plan es JSON-válido por construcción
 * (tool_choice forzado sobre PLAN_TOOL). NO calcula ni inventa cifras: solo decide qué datos pedir. Aún en sombra.
 */
import { MODE_KEYS, buildModeDoctrine } from "./conversationalContract.js";

// CATÁLOGO que ve el LLM · una línea por tool: qué responde + qué args. Colapsa el `focus` (arg, no regex).
export const TOOL_CATALOG = `queryMetric{metric,dimension,filters?,limit?} — ranking/lista de una métrica por un eje. métricas: ventas, margen, contribucion, costo, capital, rotacion, doh. ejes(dimension): cliente, marca, familia, sku, bodega, canal. Ej: "ventas por cliente" → {metric:"ventas",dimension:"cliente"}.
entityProfile{dimension,entity} — perfil interpretado de UNA entidad (sus métricas clave, para "¿quién es / cómo viene X?").
entityRecord{dimension,entity} — LA FILA COMPLETA de UNA entidad: TODAS sus columnas reales. Usalo para preguntas de CAMPO CONCRETO. dimension: cliente/sku/marca/familia. Ej: "cuántas unidades tengo del SKU X" → {dimension:"sku",entity:"X"}; "el rebate de Falabella" → {dimension:"cliente",entity:"Falabella"}; "todo de LG-DRYER8KG" → {dimension:"sku",entity:"LG-DRYER8KG"}. Trae: unidades en stock, valor de inventario, rotación, cobertura(DOH), días sin venta, estado, ventas, margen, contribución, rebate, precio de lista, etc.
gridTable{dimension,sortBy,limit} — LA TABLA: los top-N de una dimensión con TODAS sus columnas, para responder pedidos MULTI-COLUMNA sobre un ranking. sortBy = campo para rankear (venta/contribucion/margen/stockUSD/rotacion/unidades). Ej: "ventas, costo medio y margen de contribución de mis 5 mejores SKU" → {dimension:"sku",sortBy:"venta",limit:5}. Trae por fila: ventas, costo, contribución, margen, margen de contribución, precio de lista, costo medio unitario, unidades, valor de inventario, unidades en stock, rotación, etc. USALO cuando pidan varias métricas juntas de un top-N (no dispares una tool por métrica).
tensionRead{dimension,metricA?,metricB?,limit?} — cruza DOS MÉTRICAS DEL MISMO EJE y devuelve el top-N de cada una YA CRUZADO (quién aparece en ambos rankings, quién solo en uno). USALO SOLO cuando piden EXPLÍCITAMENTE cruzar/contrastar dos cosas del MISMO eje ("¿quién sostiene la contribución y quién consume más capital?", "tensión entre aporte y consumo", "quién ayuda vs quién frena") — para una sola métrica seguí usando gridTable/marginRead/contributionRead. metricA/metricB: los MISMOS field-tokens que gridTable/queryMetric — venta, costo, contribucion, margen, stockUSD, rotacion, doh, precioLista, costoMedio, unidades, pctRebate. Si el usuario nombra explícitamente las dos métricas a cruzar (ej. "cruza rotación con contribución"), MANDÁ esos tokens en metricA/metricB — NUNCA los omitas y dejes los defaults en silencio, eso responde una pregunta distinta a la que se hizo. Sin especificar, default metricA:"contribucion", metricB:"stockUSD" (el VALOR BRUTO del inventario de ese SKU — NO es lo mismo que "capital inmovilizado/detenido", que es un concepto aparte de inventoryStatus/diagnose ligado a rotación y DOH; un SKU con stockUSD alto puede estar sano y rotando bien). Hoy SOLO el eje "sku" tiene ambas columnas (comercial + inventario) — para cliente/marca/familia la tool declina honesto (no hay tabla puente eje↔SKU en el dato); si preguntan la tensión por cliente, igual llamá tensionRead(dimension:"cliente") para que declare el límite en vez de asumirlo vos.
compareEntities{dimension,entities:[a,b]} — SOLO DOS entidades lado a lado. NUNCA la uses para elegir/priorizar entre 3 o más (ni en pares ni en llamadas repetidas) — para eso es diagnose o el read del focus correspondiente.
diagnose{filters?} — RICO: barre TODOS los focos de pérdida/inmovilización (contribución no capturada, carga comercial alta, capital detenido) rankeados por $, CADA UNO con su entidad y su monto. Usalo para "¿dónde pierdo plata?", "diagnóstico", "un insight para mejorar", Y TAMBIÉN para "¿cuál corregir primero?/¿a cuál priorizo?" sobre una lista de entidades ya discutida — te da el $ por entidad que necesitás para justificar el "por qué" (si el hilo habló de contribución no capturada, sus $ por cliente están ACÁ; no los recuerdes solo del historial, volvé a pedirlos con esta tool para que queden autorizados en este turno). SIN filters = TODO el negocio.
executiveSummary{} — la lectura completa de 5 movimientos (cómo ganás, margen, dónde perdés, por qué, recuperación). Usalo para "resumen ejecutivo".
inventoryStatus{filters?,focus?} — DIAGNÓSTICO de inventario DETENIDO/inmovilizado (lo que NO rota, el capital trabado) · YA TRAE monto, SKU, bodega, antigüedad/rotación y prioridad — es la respuesta completa a "dónde tengo capital inmovilizado" y a sus follow-ups ("insights para liberarlo", "cómo priorizo"), SIN otra tool. NO uses esto para "cuánto inventario/unidades tiene un SKU" (eso es entityRecord o queryMetric capital) — esto es solo lo que está frenado. SIN focus = frenado/detenido por default: NUNCA inventes un filtro tipo {state:"detenido"} o {estado:"frenado"} — eso NO es un filtro válido (filters es SOLO marca/familia/bodega) y la call se rechaza. Si te preguntan por el mismo capital ya discutido, volvé a llamarla igual (sin entity ni filtro de estado) para traer sus cifras autorizadas DE NUEVO en este turno — no las repitas solo de memoria del hilo.
marginRead{dimension,focus?,filters?} — lectura de margen por eje. YA INCLUYE venta + margen de CADA entidad (no dispares queryMetric aparte para la venta — vendría con un filtro inválido y se rechaza). focus: "bajo_benchmark" (quién está bajo la vara / quién cede o resigna margen · ES EL DEFAULT) o "negativos". Ej: "qué clientes ceden más margen" → {dimension:"cliente",focus:"bajo_benchmark"} SIN filters. Trae también, por entidad bajo benchmark, "Medida · 1pp en X" (cuánto vale 1 punto de margen ahí) — usalo para "cuánto se podría recuperar", NUNCA multipliques brecha% × venta vos mismo (no está autorizado).
salesRead{dimension,focus?,filters?} — lectura de ventas por eje. focus: "vs_anterior" (default).
contributionRead{dimension?,focus?,filters?,entity?} — lectura de contribución. focus: "rank" (default) o "no_capturada".
trend{metric,dimension?,entity?,period?} — LA SERIE MENSUAL / evolutivo. Usalo SIEMPRE que pidan "mes a mes", "mensual", "evolución", "cómo viene mes a mes", "el primer trimestre/Q1", "un mes puntual" (marzo), un rango ("de enero a marzo"), o "esto mismo mes a mes". metric = LA QUE NOMBRÓ EL USUARIO: ventas|contribucion|margen|resultado|inventario|canal (mensual REAL hay de ventas/contribución/margen; para el resto la tool devuelve el límite honesto y su alternativa — ESO es lo correcto). Global (sin dimension ni entity), por eje (dimension: cliente/marca/familia/sku → matriz meses×entidades), o de UNA entidad (entity). period = LA FRASE TEMPORAL DEL USUARIO TAL CUAL ("mes a mes", "el primer trimestre", "marzo", "el mes que viene", "los próximos 3 meses") — no la normalices ni la traduzcas: la tool necesita la frase original para distinguir pasado de FUTURO.
simulateCarga{} — "¿y si bajo la carga comercial al target?". simulateCapital{} — "¿y si libero el capital detenido?".
simulateCosto{pct,dimension?,scope?,filters?} — "¿y si bajo/subo el costo medio de mis peores SKU/marca/familia/clientes un X%?". pct es un NÚMERO con el signo de la dirección que pidió el usuario: si dice "bajar 3%" mandá el número negativo -3; si dice "subir 2%" mandá el número positivo 2 (NO escribas el símbolo "%" ni un texto tipo "pct:-3" — solo el número, en el campo JSON "pct" del objeto args). Rango operable: entre -50 y 50 — fuera de ese rango la tool declina honesto (no es un supuesto realista, no lo fuerces). dimension default "sku". scope: "bajo_benchmark" (default, "mis peores") o "all" (todo el eje/filtro). Calcula margen y contribución NUEVOS vía costo — NO uses el "simulate" genérico para esto (no cubre costo) ni inventes la aritmética vos mismo (costo × factor no está autorizada si la calculás a mano).
defineConcept{concept} — definición AUTORIZADA de un concepto del negocio (contribución no capturada, carga comercial, rebate, benchmark, margen, contribución, rotación, DOH). Usalo SIEMPRE que pregunten "qué es X" / "a qué te referís con X" / "explicame X" — NUNCA definas de memoria.`;

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
            tool: { type: "string", enum: ["queryMetric", "entityProfile", "entityRecord", "gridTable", "tensionRead", "compareEntities", "diagnose", "executiveSummary", "inventoryStatus", "marginRead", "salesRead", "contributionRead", "trend", "simulate", "simulateCarga", "simulateCapital", "simulateCosto", "defineConcept"] },
            args: { type: "object", additionalProperties: true, description: "Args de la tool según el catálogo (metric, dimension, entity, entities, filters, focus, limit)." },
          },
          required: ["tool", "args"],
        },
      },
      memoryUpdate: {
        type: "object", additionalProperties: false,
        description: "Solo si el usuario dio una instrucción de trato/identidad ('llámame X', 'trátame de usted', 'háblame más directo', 'no me muestres tablas', 'prioriza lo financiero').",
        properties: {
          nombre: { type: "string" }, cargo: { type: "string" }, empresa: { type: "string" }, pais: { type: "string" }, moneda: { type: "string" },
          trato: { type: "string", enum: ["tu", "usted"] },
          verbosidad: { type: "string", enum: ["directo", "explicativo"] },
          tecnicismo: { type: "string", enum: ["bajo", "normal"] },
          tablas: { type: "boolean" },
          prioridad: { type: "string", enum: ["financiero", "comercial"] },
          avisarProblemas: { type: "boolean" },
          objetivo: { type: "string" },
        },
      },
    },
    required: ["intent", "mode", "rationale", "calls"],
  },
};

// buildPlanSystem(persona, memBlock, scenario) → system de la Pasada 1. La DOCTRINA vive acá: entendé libre, pero
// solo PEDÍS datos por las tools; no inventás cifras (eso lo trae el motor y lo valida el guard).
export function buildPlanSystem(persona, memBlock, scenario) {
  return `${persona}

TU TAREA AHORA (planificación): leé el turno del usuario en el contexto del hilo y emití un PLAN de qué datos necesitás. NO redactás la respuesta todavía; NO inventás cifras. Solo decidís qué tools llamar y con qué alcance.

Tenés estas herramientas de dato (el motor las ejecuta y devuelve cifras REALES y verificadas):
${TOOL_CATALOG}

REGLA DE ALCANCE (la más importante — acá se juega la mitad de tu criterio):
· El alcance de un turno NUEVO lo fija lo que dice el usuario AHORA, no el turno anterior.
· Si el usuario nombra "el negocio", "del negocio", "la rentabilidad del negocio", "en general", "la cartera", "global", "todo" → scope.level="global". NO pongas ningún filtro, NO pongas ningún \`entity\`/\`entities\`, y NO heredes la entidad de un turno previo. "El negocio" es un sujeto NUEVO que pisa cualquier entidad anterior.
· Solo heredás una entidad del turno anterior si el usuario usa un PUNTERO explícito hacia ella: "de esos", "esa cuenta", "y ella", "ahí mismo", "en ese cliente". Un sustantivo fresco ("el negocio", "la marca X", "el inventario") reemplaza el foco anterior.
· Si nombra UNA entidad → level="entity", entities=[esa]. Si dice "de esos/esas" → level="list" con las entidades del turno previo.
· Antes de emitir, revisá: ¿el usuario pidió el negocio completo? Entonces calls SIN filtro ni entidad. Si te descubrís arrastrando una entidad que él no volvió a nombrar, sacala.

REGLA DE ARGUMENTOS (dos errores que rompen la respuesta):
· NUNCA SUSTITUYAS LA MÉTRICA que el usuario nombró por una parecida ("resultado" NO es "contribución"; "inventario" NO es "ventas"). Pedí la que él dijo: si el motor no la tiene mensual/por ese eje, DEVUELVE el límite honesto y su alternativa — eso es una buena respuesta. Sustituirla en silencio da cifras reales a una pregunta que nadie hizo, y eso es lo peor que podemos hacer.
· 'filters' es SOLO para RECORTAR el universo a un valor de un eje: marca, familia, bodega, cliente. NADA MÁS. Un criterio/condición NO es un filtro: "bajo el benchmark", "los que ceden margen", "los que no rotan", "lo que está detenido" van en 'focus' (o son la tool misma), NUNCA en filters. Y "métrica" o "global" tampoco: el alcance global es SIN filters. Si ponés una key inventada en filters (benchmark, condicion, estado, metric, periodo…), el motor NO puede responder y el turno se pierde.
· Pasá SIEMPRE los args que definen el alcance. En 'trend': metric SIEMPRE, y si el usuario nombra una entidad → entity (ej. "cómo viene Falabella mes a mes" → {metric:"ventas",entity:"Falabella"}); si pide un eje → dimension (ej. "ventas mes a mes por cliente" → {metric:"ventas",dimension:"cliente"}); sin ninguno = el negocio completo. Una tool sin args responde OTRA pregunta.
· "ELEGIR UNO / PRIORIZAR" entre 3+ entidades ya nombradas ("cuál corregir primero", "a cuál priorizo", "por dónde arranco"): NO alcanza con el margen solo — pedí la tool que trae el $ de la RAZÓN por la que se viene hablando de ellas (si el hilo mencionó contribución no capturada/carga comercial/capital → diagnose o el read de ese focus), para que esos montos queden autorizados EN ESTE TURNO. No confíes en que el narrador los recuerde del historial: si no los volvés a pedir, no puede citarlos y la respuesta sale vacía o vaga.

Otras reglas:
· Entendé la intención real, no las palabras sueltas. Corto o largo, formal o informal, con errores — entendé igual.
· CORRECCIÓN: si el usuario reclama que te enfocaste mal ("te pedí del negocio y me hablás de X", "no me refería a esa cuenta") → intent="redirect", scope al alcance correcto (normalmente global sin filtro), Y ESTA VEZ SÍ incluí las calls que entregan la respuesta corregida (no dejes calls vacío: replanteá y traé el dato bueno). Reconocé breve y entregá.
· DEFINICIÓN: si pregunta qué significa un concepto ("qué es X", "a qué te referís con X", "explicame X") → intent="define" Y SIEMPRE llamá defineConcept: calls=[{tool:"defineConcept", args:{concept:"<el concepto tal como lo nombra el usuario, ej: contribución no capturada>"}}]. NUNCA dejes calls vacío en una definición — la definición sale del glosario, no de tu memoria.
· MODO (elegí SIEMPRE uno, por comprensión — no cambia QUÉ pedís, solo CÓMO se va a narrar; seguí pidiendo los mismos datos que la pregunta necesita en cualquier modo):
${buildModeDoctrine()}
· TRATO/IDENTIDAD: si da una instrucción de cómo tratarlo → llená memoryUpdate. "llámame X" → nombre:X. "trátame de usted" → trato:usted; "de tú"/"tuteame" → trato:tu. "háblame más directo/sin rodeos/al grano" → verbosidad:directo. "explicame más" → verbosidad:explicativo. "no uses tecnicismos" → tecnicismo:bajo. "no me muestres tablas" → tablas:false. "prioriza lo financiero/el impacto económico" → prioridad:financiero. Si SOLO da la instrucción → intent="ack", calls=[]. Si además pregunta algo → intent="answer" con sus calls.
· Elegí las tools mínimas que respondan de verdad. Una respuesta "overview"/"resumen"/"insight del negocio" puede pedir varias (ej. executiveSummary, o diagnose + queryMetric) — pero con el alcance correcto.
· TEMPORAL: para "mes a mes", "mensual", "evolución", "cómo viene mes a mes", un trimestre/Q, un semestre, un mes puntual, un rango de meses, o "esto mismo mes a mes" → usá la tool 'trend' (metric + dimension o entity + period). El dato mensual REAL es VENTAS y CONTRIBUCIÓN (la propia tool declara honesto lo que no: resultado/P&L mensual, inventario mensual, canal mensual, margen en matriz por eje). CONSERVÁ EL ALCANCE DEL TURNO ANTERIOR: si venías hablando de un EJE (los SKU, los clientes, las marcas) y ahora piden "esto mismo mes a mes", pasá ese eje → dimension:"sku"/"cliente"/"marca" (NO el negocio global: cambiarle el alcance al usuario sin avisar es peor que no responder). Si venías de UNA entidad, pasá entity. Si en un seguimiento la métrica anterior no tiene mensual (ej. costo medio), pedí 'trend' de la que SÍ (ventas/contribución) sobre el MISMO eje — no la foto actual. FUTURO/pronóstico NO existe (no hay serie a futuro): eso sí, intent="answer" y el narrador aclara que no proyecta.
· Escenario de datos actual: ${scenario}.

${memBlock ? memBlock + "\n\n" : ""}Emití el plan con emitPlan.`;
}

// buildPlanUserMessage(history, text) → el mensaje de usuario para la Pasada 1 (hilo reciente + turno actual).
export function buildPlanUserMessage(history, text) {
  const h = Array.isArray(history) ? history.slice(-8) : [];
  const hist = h.map((m) => `${m.role === "user" ? "Usuario" : "ADI"}: ${m.gist || m.text || ""}`).join("\n");
  return `${hist ? `Hilo reciente:\n${hist}\n\n` : ""}Turno actual del usuario: «${text}»`;
}
