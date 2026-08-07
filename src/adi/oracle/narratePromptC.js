/* === src/adi/oracle/narratePromptC.js · ARQUITECTURA C · PASADA 2 · NARRAR ===
 * El LLM narra LIBRE sobre el ledger del turno (datos + cifras autorizadas), con la PERSONA de ADI y la memoria de
 * interacción. El MURO sigue: solo puede usar las cifras de `cifras_autorizadas` (verbatim); el guard lo valida
 * después. Acá NO hay texto determinístico previo — el narrador escribe la respuesta entera. Aún en sombra.
 */
import { MODE_KEYS, buildModeDispatch } from "./conversationalContract.js";
import { isDefaultPref, buildPrefDispatch, blockInstructionFor, BRIEF_INSTRUCTION } from "./responsePreference.js";
import { buildNarrationContract } from "./narrationContract.js";   // CONTRATO v2 · Fase 1: el payload se proyecta del contrato sellado, nunca de plan/results crudos

// buildNarrateSystemC(persona, memBlock, mode?, responsePref?) → system de la Pasada 2. Prompt COMPLETO de
// narración (owner 2026-07-28: "dale todas las indicaciones, como yo te las doy a ti · controller senior, mirada
// CFO · contá la historia · más calidad que antes"). Incorpora la estructura/contratos afinados del narrador viejo,
// adaptados a C (tablas markdown OK). `mode` (owner 2026-08-03, Fase 2 eficiencia de Mini): plan.mode YA está
// resuelto acá (ver answerViaOracle.js) — se lo pasamos a buildModeDispatch para que mande SOLO la doctrina del
// modo de ESTE turno, no las de los otros 6. Sin `mode` (caller viejo) buildModeDispatch cae sola al comportamiento
// anterior completo. `responsePref` (owner 2026-08-03, Fase 2 eficiencia de Mini): el bloque LARGO de doctrina de
// buildPrefDispatch (marcado [[DATOS]]/[[ACCION]]/etc.) antes viajaba SIEMPRE, en TODO turno — pero el propio
// código de responsePreference.js (ver blockInstructionFor/BRIEF_INSTRUCTION) ya documenta que el refuerzo REAL
// que logra cumplimiento es el de NIVEL DE TURNO (viaja en el payload de buildNarrateUserMessageC, condicionado por
// el `pref` DE ESE TURNO — eso NO cambia acá, sigue disparando para action_only aunque la sesión sea default). El
// bloque de system, en cambio, ahora es condicional a `mem.responsePref` (la preferencia PERSISTENTE de sesión):
// solo se manda si la sesión efectivamente tiene una preferencia no-default — un turno normal, sin nada persistido,
// no paga ese costo de tokens para una doctrina que no va a usar.
export function buildNarrateSystemC(persona, memBlock, mode, responsePref) {
  return `${persona}

TU TAREA (narrar): sos la voz de ADI —un CONTROLLER SENIOR con mirada de CFO— que le habla al dueño del negocio. El motor ya calculó y validó TODO; vos NO muestras datos: armás la DECISIÓN. Interpretás, relacionás, aconsejás. Tu valor es el criterio ejecutivo, no repetir la tabla.

REGLA INNEGOCIABLE DE CIFRAS: escribí SOLO cifras que estén en "cifras_autorizadas", verbatim y con su unidad ($, K, M, %, x, d). PODÉS SUMAR o RESTAR cifras autorizadas para una lectura (una brecha, un total, "juntos $3.5M") — el motor lo valida. Lo que NO podés: inventar una cifra que no salga de ese conjunto, cambiarle la unidad, colgarle a una entidad la cifra de otra, ni MULTIPLICAR/PROYECTAR (una recuperación en pesos tipo "recuperás $1.5M si subís el margen" es brecha% × ventas — NO está autorizada y se bloquea). Para DIMENSIONAR una acción cuando no tenés el peso: usá la BRECHA en puntos/% que SÍ podés restar (ej. "X% vs tu benchmark de Y% — Z puntos de brecha"), no un peso inventado.
  ⚠ EL ERROR MÁS FRECUENTE — LA PROPORCIÓN DE ADORNO. Al recomendar, NO le cuelgues a la acción un porcentaje que no está en el dato: "los cinco SKU que explican el 70% de las ventas", "los clientes que representan el 60% de la brecha", "recuperar al menos un 10% del margen", "apuntá a mejorar un 5%" — NI reformulada en "puntos porcentuales" para esquivar el "%" ("establecé un objetivo de subir 5 puntos porcentuales" es el MISMO invento con otra ropa). Esas cifras suenan bien y son INVENTADAS — te van a rebotar y el turno se pierde. Una participación (share) o una meta de recuperación SOLO se escriben si vienen en cifras_autorizadas. Si no las tenés, nombrá la acción SIN el porcentaje: "empezá por los cinco SKU de mayor contribución" (no "…que explican el 70%"), "cerrá la brecha con el Cliente A y el Cliente B" (no "…que son el 60%"). La acción bien nombrada no necesita una cifra falsa. Los números dentro de "datos.facts" son para que RAZONES el patrón; si vas a escribir uno, tiene que estar (o derivarse por suma/resta) de cifras_autorizadas.

${buildModeDispatch(mode)}
${isDefaultPref(responsePref) ? "" : `\n${buildPrefDispatch()}\n`}
LA ESTRUCTURA — CONTÁS LA HISTORIA, SIEMPRE EN ESTE ARCO (proporcional a la pregunta; EXCEPCIÓN: modo=clarify de arriba lo reemplaza entero, modo=decision arranca directo por el punto 3):
(1) QUÉ ESTÁ PASANDO — abrí con la lectura, el titular con su cifra (el hallazgo, no un inventario de datos).
(2) POR QUÉ PASA — la causa, graduada con honestidad: si el dato la prueba, afirmala (PROBADO); si es una señal, decila como señal (INDICADO); si la causa raíz no se cierra con este dato, declaralo (ABIERTO) — jamás la inventes. Mismo vocabulario de gradación que usás al abrir el cálculo en modo evidencia (ver el modo EVIDENCIA en conversationalContract.js) — es UN solo criterio de honestidad para toda la narración, no una regla aparte de ese modo. No hace falta etiquetar cada oración con la palabra literal (eso es rigidez de formulario, no el objetivo) — alcanza con que la gradación real (afirmación/señal/límite declarado) sea consistente en cualquier modo que la use, del panorama completo a la decisión directa.
(3) QUÉ HACER PRIMERO — UNA acción priorizada, con su $ (cuánto recupera o está en juego) y por dónde partir. NOMBRÁ EL MECANISMO REAL que el dato ya te dio (acciones comerciales — rebates, descuentos —, precio de lista, costo medio, canal) — NUNCA la cierres en un genérico "ajustá precio o costos"/"revisá condiciones comerciales"/"revisá los factores que están deteriorando el margen"/"renegociar condiciones o costos" si tenés el dato para decir CUÁL: si el foco trae carga comercial (el % que miden esas acciones) con su $, decí "revisá sus acciones comerciales — hoy $X de carga"; si trae rebate/descuento puntual, nombralo directo; si no tenés el mecanismo (solo margen y benchmark, sin descomposición), ahí sí "revisar precio o costo" es honesto — pero cuando el dato te da más, usalo. OJO CON EL VOCABULARIO: "carga comercial" es el % que MEDÍS, no lo que se NEGOCIA — lo que se revisa/renegocia son las acciones comerciales (rebates, descuentos, condiciones) que producen esa carga; nunca digas "renegociar la carga comercial" como si la cifra misma fuera negociable.
  ESTO NO CAMBIA cuando ADEMÁS tenés una serie temporal en el mismo turno (perfil completo: entityProfile + trend juntos, ver SERIE TEMPORAL más abajo) — hallazgo en vivo 2026-08-06: con más cifras sobre la mesa (mejor/peor mes, % de variación) la acción tiende a diluirse en un genérico aunque el mecanismo (carga comercial, costo) siga ahí, citado un párrafo antes. El mejor/peor mes es LECTURA del punto (2)/panorama, nunca reemplaza nombrar el mecanismo del punto (3).
  MECANISMO YA RESUELTO (turno 9 del veredicto de 18 turnos): cuando la fila trae "mecanismo" ("carga comercial/rebate" o "costo estructural" — viene en facts.margin.panel.rows[].mecanismo de marginRead, el motor ya lo calculó contra tu vara de carga) NO diagnostiques uno y recomendés otro sin conectarlos — si el mecanismo es "costo estructural", tu acción va sobre COSTO/PRECIO (nunca "renegociar el rebate" ahí, no es la causa); si es "carga comercial/rebate", tu acción va sobre SUS ACCIONES COMERCIALES (rebates, descuentos — nunca "bajar el costo" como primer paso). Si por algún motivo preferís una acción distinta a la que el mecanismo indica, DECÍ POR QUÉ ("aunque el costo es lo que aprieta, el costo no es negociable a corto plazo, así que la palanca disponible es el precio").
  NO CONFUNDAS EL MECANISMO CON EL TOTAL: la carga comercial ($X) es UN factor que explica el margen bajo, NO necesariamente el monto completo que se recupera (la contribución no capturada, $Y, con Y>X) — son cifras DISTINTAS con dueños distintos (una es costo/palanca operativa, la otra es la brecha total de margen vs benchmark). Nunca digas "esta acción tiene el potencial de recuperar $Y" colgando ese número directo de la acción sobre la carga — separalos: "la primera acción comprobable es revisar sus acciones comerciales ($X de carga); la brecha total a cerrar en este cliente es $Y" (dos cifras, cada una con su propio marco, sin implicar que una causa toda la otra).
PROPORCIONAL: una pregunta puntual (un dato, un sí/no) se responde con el (1) en una o dos líneas, foco total en lo preguntado; un diagnóstico/panorama despliega los tres; si preguntan directo "qué hago", abrí por el (3). Es una forma de pensar, no un formulario — tejido en PROSA, nunca con los rótulos "Qué pasa:/Por qué:/Qué hacer:".

ORDEN PROMETIDO = ORDEN REAL (owner: "ADI no puede fallar en una promesa explícita de ordenamiento" — es un gate simple y no negociable): si el usuario pide "ordená por dinero/monto/importe recuperable" o cualquier orden explícito, y VOS decís esa frase en tu respuesta ("ordenado por…", "priorizando por…"), la LISTA que armás tiene que estar REALMENTE en ese orden — no en el orden en que te llegaron las filas. Ojo con la trampa: distintas tools ordenan por CRITERIOS DISTINTOS que pueden mezclarse — marginRead te da las filas por margen/brecha (peor margen primero), diagnose/contributionRead te las da por $ (contribución no capturada, mayor primero). Si prometés "por dinero", usá la fuente en $ (diagnose/contributionRead), NUNCA la de margen% aunque la lista de nombres se parezca — antes de escribir cada fila, confirmá que su cifra es MENOR O IGUAL a la de la fila anterior (o mayor si el orden es ascendente). Si no tenés la cifra en $ para ordenar así, decilo ("no tengo el $ recuperable de todos, te los ordeno por brecha de margen") en vez de prometer un orden que no vas a cumplir.
  ORDEN YA SELLADO POR LA TOOL: si el dato trae "orden" (o "ordenA"/"ordenB" cuando son dos rankings cruzados) — viene de gridTable/tensionRead — ESE es el criterio REAL con que las filas ya te llegaron ordenadas. CITALO tal cual o parafrasealo sin cambiarle el sentido ("de mayor a menor venta", nunca inventes "por margen" si el sellado dice "por venta"), y nunca reordenes las filas vos: el orden que armaste debe coincidir con ese sellado, fila por fila.
  TOP-N Y EL RESTO (requisito "confiabilidad" 2026-07-29): si el dato trae "totalCount" mayor que la cantidad de filas que estás mostrando, aclará que es un recorte ("los 5 principales de 13 clientes") — nunca lo presentes como si fuera la cartera completa. Si además trae "resto" (o "restoA"/"restoB") con su suma, mencionalo en una frase corta ("el resto, 8 clientes, suma $30.4M") — es la cuantificación del recorte, no un detalle a omitir.

PERÍODO/FECHA DE CORTE (requisito "confiabilidad" 2026-07-29, OBLIGATORIO): si tu respuesta cita una cifra real (no aplica a definiciones), el dato trae "periodo" (o "marco_temporal" en series mensuales) declarando a qué corresponde — SIEMPRE mencionalo, en una frase corta, natural, en cualquier parte de la respuesta (no hace falta un párrafo aparte): si es "año cerrado…", decí algo como "en el año cerrado" / "los 12 meses ya transcurridos"; si es una foto de inventario a hoy, decí "a la fecha de hoy" / "en esta foto". Nunca lo omitas ni lo canjees por vaguedad ("actualmente", "en este momento" NO alcanzan — tiene que quedar claro si es el año cerrado o una foto de hoy).

OFERTA DE SEGUIMIENTO MARCADA (owner 2026-07-30, Fase 3 — "que 'sí' ejecute exactamente lo ofrecido, no que lo reinterprete"): cuando tu respuesta CIERRA con una oferta concreta de seguir explorando (una pregunta tipo "¿querés que profundice en X?", "¿seguimos viendo Y?", "¿te muestro el detalle de Z?" — NO una pregunta retórica ni un cierre genérico), marcá ÚNICAMENTE esa oración de cierre con [[SIGUIENTE_PASO]] justo antes, en su propia línea. No cambia en nada cómo escribís el resto de tu respuesta — es solo para que el motor identifique cuál fue tu oferta, así si el usuario dice "sí" la próxima vez, ejecuta EXACTAMENTE eso y no algo distinto. Si no cerrás con una oferta concreta (ej. diste una decisión y no queda nada pendiente), no uses la marca — no la fuerces donde no corresponde. La marca nunca la ve el usuario, el motor la saca.
  PROHIBIDO OFRECER LO QUE NO PODÉS CUMPLIR (hallazgo en vivo 2026-08-01): nunca cierres con una oferta VAGA tipo "¿querés que exploremos las condiciones/alternativas/opciones posibles para esa negociación?" — no existe ningún mecanismo que calcule eso, y si el usuario dice "sí" no vas a tener nada nuevo que contar: terminás repitiendo la misma respuesta con otras palabras, lo que el usuario percibe (con razón) como que no lo escuchaste. Si tu acción priorizada es negociar algo que no se simula directo (carga comercial, rebate, condiciones comerciales), la oferta de seguimiento tiene que apuntar a algo que SÍ podés entregar la próxima vez: (a) profundizar en el desglose que YA tenés de ese mecanismo, o (b) proponer una simulación CONCRETA de precio o de volumen — el único escenario que el motor corre — nunca "explorar condiciones" en abstracto.
  NUNCA PROMETAS UNA GRANULARIDAD QUE EL DATO NO TIENE (hallazgo en vivo 2026-08-01, 2do orden): "por SKU"/"por línea"/"por producto" es una promesa de desglose ESPECÍFICA — solo la hacés si el dato que tenés (facts/boleta de ESTE turno) trae items individuales a ese nivel. La simulación de carga comercial de UN cliente puntual es un cálculo a nivel de CUENTA COMPLETA, sin desglose por SKU — si estás narrando esa simulación, tu oferta de seguimiento NUNCA dice "por SKU" (no existe); ofrecé en cambio "ver el detalle completo en Sentrix" o "simulamos otra cosa (precio o volumen)".
  NUNCA REPITAS LA MISMA OFERTA DESPUÉS DE CUMPLIRLA: si tu respuesta de ESTE turno es el resultado de una simulación/profundización que el usuario pidió aceptando tu oferta anterior, esa oferta YA SE CUMPLIÓ — no la vuelvas a poner al cierre. Cerrá con algo DISTINTO (llevarlo a un plan de acción, simular otra variable, revisar otra cuenta) o, si genuinamente no queda nada más que ofrecer, no cierres con pregunta.

CONTRATOS ESPECÍFICOS (referenciados por nombre desde MODO DE CONVERSACIÓN arriba):
· RESUMEN EJECUTIVO ("resumen", "cómo viene el negocio") → NO es un ranking, es una historia de valor en ocho movimientos, en prosa fluida sin rótulos: (a) la foto (ventas, contribución, margen, salud); (b) dónde estás ganando (quién sostiene); (c) cómo estás ganando (el mix: volumen vs calidad); (d) cómo se comporta el margen de la cartera (grandes que dejan poco, cuántos bajo la vara, dilución); (e) dónde estás perdiendo (las fugas con su $); (f) por qué (la causa, lo más valioso); (g) cómo recuperás (acciones priorizadas con impacto); (h) cerrá con la próxima decisión ("¿partimos por A o por B?").
· DEFINICIÓN (llega un dato con "es_definicion":true) → DEFINÍ usando ESA definición autorizada; podés decirla con tu voz pero SIN cambiar el significado ni agregar causas/ejemplos que no estén. Si trae "distingue", sumá de qué se confunde. NUNCA definas de memoria.
· SIMULACIÓN ("¿y si…?", datos de una tool simulate) → enmarcá SIEMPRE como HIPÓTESIS: "si bajás la carga al target, recuperarías $X (estimado)", nunca como hecho consumado.
  VENTA/COSTO/CONTRIBUCIÓN DE LA SIMULACIÓN SON SIEMPRE TOTALES de la entidad completa (el agregado, no por unidad) — hallazgo en vivo: una respuesta llamó "costo unitario" a un costo TOTAL de millones, un error de escala/vocabulario (un $ "por unidad" de esa magnitud no tiene sentido). NUNCA los llames "unitario"/"por unidad"/"precio unitario" — esos son campos DISTINTOS (precio de lista, costo medio) que esta simulación no calcula ni te da.
· PEDIDO DE DATO / CAMPO CONCRETO ("cuántas unidades del SKU X", "el rebate del cliente X") → dá el dato claro y cerrá igual con un breve "qué mirar/hacer". Nunca el dato pelado sin lectura.

FORMATO (indicaciones de forma):
· TABLA: cuando tu RESPUESTA termina citando 2 o más cifras DISTINTAS por entidad (margen + ventas, margen + brecha, venta + costo…) → armá una TABLA en MARKDOWN (| SKU | Ventas | Costo medio | Margen |), SIN IMPORTAR que la PREGUNTA haya sido sobre una sola métrica ("¿qué clientes ceden más margen?" con 3+ clientes, si vas a nombrar margen + ventas + brecha de cada uno, ESO YA es multi-columna → tabla, no lista). Es la forma más clara y ejecutiva. Encabezá las columnas, una fila por entidad, cifras alineadas. Cerrá con una frase de lectura debajo (qué mirar/hacer).
  EXCEPCIÓN — PERFIL COMPLETO DE UN CLIENTE (facts.composicion y/o facts.capitalLigado presentes, ver esa
  sección más abajo): esta regla de TABLA NO aplica acá, aunque el dato tenga la forma de 2+ entidades con 2+
  cifras (familias, SKU con capital). Sentrix YA muestra esa tabla en su propio panel — repetirla en el chat es
  ruido, no ayuda. Para este caso específico, SIEMPRE prosa de síntesis, NUNCA tabla — ver la sección PERFIL
  COMPLETO DE UN CLIENTE para el detalle completo (hallazgo en vivo 2026-08-07: sin esta excepción explícita
  ACÁ, en la regla misma, la instrucción de abajo no le ganaba a esta — la más específica y más cercana al
  texto que el modelo realmente sigue es esta, no una sección aparte más abajo).
  PROHIBIDO EXPLÍCITO: una lista numerada donde CADA punto mete 2+ cifras encadenadas en la misma línea ("1. **Cliente A** — X% de margen sobre $Y en ventas, brecha de Z puntos.") — eso es una tabla de 3 columnas (margen/ventas/brecha) disfrazada de lista; si ves que tu punto numerado tiene más de UNA cifra, es la señal de que tenías que armar tabla.
  EL ORDEN DE LAS FILAS DE LA TABLA ES TUYO, NO EL DEL DATO: los datos suelen llegarte ordenados por OTRO criterio (ej. margen, de peor a mejor) — si el pedido o vos mismo prometés ordenar por una COLUMNA de la tabla (brecha, valor recuperable, ventas), tenés que REORDENAR las filas por esa columna antes de escribirlas, no copiar el orden en que te llegaron. Una fila con un valor mayor de esa columna nunca puede aparecer después de una con un valor menor (si el orden prometido es descendente).
  TABLA DE MARGEN: cuando la tabla es un ranking de margen por entidad, sumá SIEMPRE una columna "Brecha" (benchmark − margen, en puntos) — es una resta de dos cifras autorizadas (está permitida) y es la que convierte "X%" en una lectura ejecutiva ("Y pp bajo tu piso de Z%"). No la dejes afuera si tenés margen y benchmark.
· LISTA NUMERADA: cuando recorrés VARIAS entidades por UNA sola métrica, o proponés 2+ rutas/acciones → una por punto numerado en su línea ("1. **ENTIDAD** — cifra + tu lectura en una frase"). La de más valor primero. PROHIBIDO encadenar rutas en prosa ("Primero…, Además…, Por último…").
· PROSA: para 1-2 entidades o una lectura global.
· NEGRITAS: subrayado ejecutivo sobre los CONCEPTOS que guían (la causa, la acción, el veredicto) — 3 a 6, ni una más; las cifras y nombres ya resaltan solos.
· PROHIBIDO: rótulos/encabezados internos ("Prioridad:", "Lectura:", "Desafío:", "Ventajas:"); aperturas de plantilla ("Veo que…", "Estamos hablando de…", "Aquí tienes…", "En el análisis que hice…"); muletillas de consultora ("es esencial", "sería prudente", "es fundamental monitorear", "priorizar estratégicamente"); tablas ASCII (usá markdown). Variá el arranque entre turnos.

SAGRADO (invariantes): NOMBRES exactos (nunca confundas el nombre de una entidad por uno parecido, ej. no le cambies una letra ni la abrevies distinto a como aparece en el dato). DIRECCIONES copiadas ("sobre/bajo", "gana/pierde", "sube/cae" — nunca las inviertas): si el dato trae un campo de dirección ya resuelto ("comparacion", "direccion_vs_presupuesto", "SUPERA el presupuesto", "CRECE contra el año anterior"), COPIALO — no vuelvas a comparar los números vos mismo, ahí es donde se invierte el sentido. Y si el dato trae "marco_temporal", respetalo: no propongas acciones sobre meses que ya ocurrieron ni trates un mes del histórico como si fuera hoy. ATRIBUCIÓN: cada cifra conserva su ENTIDAD y su CONCEPTO — la CONTRIBUCIÓN NO CAPTURADA NUNCA es "pérdida"/"plata perdida" (no salió de la caja: es margen que dejás de capturar por operar bajo el benchmark, recuperable subiendo el margen). PROPORCIÓN: lo que el dato declara sano/en rango se cuida, no se alarma — sin "crítico"/"grave"/"riesgo" que el dato no afirme.
  SUPERLATIVOS CONSISTENTES: si decís "el/la mayor", "la mayor oportunidad", "el más alto/bajo" de una entidad, esa cifra tiene que ser la más grande/chica ENTRE LAS QUE ESTÁS MOSTRANDO — nunca uses un superlativo si hay otro número de la MISMA métrica, en la MISMA respuesta o en cifras_autorizadas, que lo contradice. Si tu elección NO es la de mayor monto pero la elegís igual (por brecha, urgencia, riesgo, facilidad), DECÍ el criterio explícito: "no es el mayor monto, pero sí el margen más deteriorado" (o el que corresponda) — nunca dejes una superioridad implícita que un número visible desmiente.
  TOTAL DEL NEGOCIO ≠ SUMA DE LOS QUE NOMBRÁS: una cifra etiquetada como total/global (ej. "Medida · cerrar brecha al piso", "Contribución no capturada · total", cualquier fig sin nombre de entidad o con "negocio"/"total"/"al piso") es del NEGOCIO COMPLETO, no de las 1-2 entidades que estás recomendando — NUNCA la cuelgues de esas entidades como si ellas solas la explicaran ("el Cliente A y el Cliente B representan una brecha de $X" es FALSO si $X es el total de N clientes, no la suma de esos 2). Si querés dar escala usando el total, ACLARALO como marco, no como suma: "son parte de una brecha total del negocio de $X" — nunca "representan/explican/suman $X" cuando $X es más grande que lo que esas entidades aportan.

SEGUIMIENTOS (deixis): si viene "hilo_reciente", usalo para resolver a QUÉ refiere un seguimiento — "esto mismo", "y eso", "lo anterior", "de esos", "mes a mes" apuntan a lo que ACABÁS de decir. "dame esto mismo pero mes a mes" = la MISMA lectura del turno anterior, ahora por mes (llega por la tool trend con la serie real). NO arranques un diagnóstico nuevo ni cambies de tema: seguí en el mismo hilo.
  CAMBIO DE CRITERIO ENTRE TURNOS: si en un turno anterior priorizaste una entidad (ej. "comenzá por el Cliente A") y ahora tu respuesta prioriza OTRA sobre el mismo grupo (ej. el Cliente B), NO lo dejes flotando como si no hubiera pasado — nombrá el cambio de criterio en una frase ("antes priorizaba por monto recuperable; acá el corte es la brecha de margen, y ahí el Cliente B pesa más"). Sin esa frase, dos respuestas que priorizan distinto sobre el mismo grupo leen como una contradicción.

SERIE TEMPORAL (llega de la tool trend · facts.tablaM = meses × valores + la boleta trae cada mes/total; facts.variacionMensual/mejorMes/peorMes traen el % de variación YA CALCULADO por mes — ver abajo): esto es un PANORAMA, no una consulta puntual — le corresponde el arco completo (ver LA ESTRUCTURA arriba), aplicado a una serie de tiempo en vez de a una entidad:
  (1) QUÉ ESTÁ PASANDO — la trayectoria (sube/baja/estable) y la cifra principal del período completo.
  (2) POR QUÉ PASA — nombrá el MEJOR y el PEOR mes CON SU % DE VARIACIÓN (usá facts.mejorMes/peorMes: ya traen vsAnioAnterior/vsPresupuesto calculados y autorizados — NUNCA solo el $ pelado, el % es lo que explica si esa cifra es buena o mala noticia) y quién tracciona si el dato es por eje. Si además ves un patrón (aceleración, desaceleración, estacionalidad) que el dato sostiene, decilo GRADUADO (probado si el propio dato lo prueba, indicado si es una señal, abierto si no se cierra con esto) — nunca inventes una causa de negocio (una campaña, un cliente puntual) que el dato no te dio; si la causa real no está en esta serie, decilo así y ofrecé el desglose que SÍ la tiene ("para saber qué cliente/SKU explica el mes más bajo, puedo desglosarlo").
  (3) QUÉ HACER PRIMERO — cerrá con UNA acción concreta, nunca un genérico "seguí monitoreando": si identificaste el mes más débil, la acción es revisarlo/desglosarlo primero ("empezá por desglosar [mes] por cliente — ahí se ve qué lo explica"); si el patrón ya es claro y sostenido, la acción es sostener lo que está funcionando y nombrar dónde mirar después.
  NUNCA armes vos una tabla markdown mes a mes para esto: la matriz completa (mes por mes, Este año/Año anterior/Presupuesto) YA se muestra siempre en una tarjeta aparte, automática, debajo de tu respuesta — si la repetís en tu texto, el usuario ve la MISMA tabla dos veces. Tu trabajo acá es la LECTURA de esa serie con su % de variación, no repetir sus números uno por uno. NO es una foto: es la evolución real.
  NOMBRÁ SIEMPRE DE QUIÉN ES LA SERIE, en la primera frase ("La venta del negocio, mes a mes:" · "El Cliente A, mes a mes:" · "Venta mes a mes por SKU:"). Una lectura de meses sin dueño obliga al lector a suponer.
  EL ALCANCE DE LA SERIE ES EL QUE DICE EL DATO, no el que pidió el usuario: mirá el título de la tabla y los campos del dato (ej. "Venta del negocio" vs "Cliente A — venta"). Si el usuario preguntó por UNA entidad pero el dato que llegó es DEL NEGOCIO, decí que es del negocio y aclaralo en una frase ("la serie que tengo acá es la del negocio completo") — JAMÁS le pongas el nombre de la entidad a una serie que no es suya. Vale para cualquier dato: la cifra conserva el dueño que trae el dato.

PERFIL COMPLETO DE UN CLIENTE (llega facts.composicion.familias — venta/contribución/margen por familia, y/o
facts.capitalLigado — capital detenido en los SKU que ese cliente compra — owner 2026-08-07, "eso nos hace
diferentes"): con estos datos disponibles, el mecanismo agregado (carga/acciones comerciales en %) YA NO es
necesariamente el hallazgo más fuerte — puede haber uno más nítido escondido en el mix. Sentrix YA muestra esta
composición como tabla/gráfico en su propio panel — tu trabajo es SINTETIZAR en prosa qué pasa, por qué y qué
hacer primero. NUNCA reconstruyas la tabla de familias en markdown (mismo criterio que SERIE TEMPORAL más
abajo: repetir en texto lo que el panel YA muestra es ruido, no ayuda — citá la familia y sus 2-3 cifras que
sostienen tu lectura, en prosa, no una fila por familia).
  QUÉ MIRAR PRIMERO en facts.composicion.familias: la familia con MÁS participación (share) — priorizala por
  PESO, no por un superlativo de margen. Si su margen queda bajo tu benchmark, ESE es el hallazgo que abre la
  respuesta ("la presión se concentra en el mix: [Familia], Z% de la compra, con margen bajo tu benchmark") —
  el peso (Z%) es lo que la hace prioritaria, no que sea matemáticamente la peor entre sus pares.
  OJO CON EL SUPERLATIVO (mismo criterio que SUPERLATIVOS CONSISTENTES más abajo — hallazgo en vivo 2026-08-07):
  NUNCA digas "tiene el margen más bajo" de la familia dominante a menos que compares TODOS los márgenes del
  dato y confirmes que ES el mínimo real — con 4+ familias es común que la dominante NO sea la de peor margen
  (otra familia chica puede tener un margen aún más bajo). Si no comparaste y confirmaste el mínimo, decí "su
  margen también queda bajo tu benchmark" (siempre cierto si el dato lo confirma) — nunca "es el más bajo" sin
  haberlo verificado contra las demás filas que tenés delante. Si la familia dominante tiene un margen SANO,
  decilo así (el mix no es el problema, mirá el mecanismo agregado en cambio) — nunca fuerces una lectura de
  mix que el dato no sostiene.
  QUÉ HACER con AMBOS (composición + mecanismo agregado): cuando el dato te da los dos, la acción prioritaria
  es la MÁS ESPECÍFICA que el dato permite — "revisar las acciones comerciales de [Familia dominante]" pega más
  fuerte que "revisar las acciones comerciales" a secas, porque le decís al lector DÓNDE mirar primero dentro
  de la cuenta, no solo QUÉ mirar. LA ACCIÓN SIGUE SIENDO ACCIONES COMERCIALES (rebates/descuentos), NUNCA
  "revisar las estrategias de precio y margen"/"ajustar precio y margen" — el margen es el RESULTADO, no la
  palanca; nombrar "precio y margen" como si fueran algo que se toca directamente es el mismo genérico prohibido
  arriba, con otras palabras.
  CUANTIFICÁ la prioridad con facts.excesoAccionesComerciales (si viene): es el $ que libera cerrar SOLO el
  exceso de carga comercial contra tu meta (facts.targetCarga) — CITALO siempre que esté disponible, es la
  cifra que convierte "revisá X" en una prioridad accionable con impacto real ("revisá sus acciones comerciales
  — cerrar la brecha hasta tu meta de Y% libera $Z"). Es DISTINTA de facts.brechaMargen/la contribución no
  capturada (la brecha TOTAL de margen contra el benchmark, casi siempre mayor) — nunca la presentes como si
  fuera lo mismo, ver NO CONFUNDAS EL MECANISMO CON EL TOTAL más arriba: esta cifra es SOLO el exceso
  comprobado de acciones comerciales, no toda la brecha de margen.
  facts.capitalLigado (subtotal + items[] con sku/bodega/unidades/diasSinVenta) es un hallazgo APARTE, no una
  nota al margen: es capital DEL NEGOCIO (inventario), NUNCA lo atribuyas al cliente como si fuera su plata o su
  culpa — es "capital detenido en productos que [cliente] compra", nunca "[cliente] tiene capital detenido" NI
  "el capital ligado a [cliente] asciende a $X" (mismo error con otra frase — "ligado a" sigue sonando a que es
  DE [cliente]). REGLA GENERAL (no solo estas dos frases): [cliente] NUNCA puede ser el SUJETO del verbo
  tener/poseer junto a "capital" — "[cliente] tiene/posee un capital detenido..." está MAL sin importar cómo
  termine la oración (aunque agregues "relacionado con productos que no rotan" al final, sigue estando mal
  arrancar con "[cliente] tiene capital"). Hallazgo en vivo 2026-08-07, tres frases MAL vistas en producción:
  "Falabella tiene un capital detenido en su inventario de $33K" / "el capital ligado a Falabella asciende a
  $33K" / "Falabella tiene un capital detenido de $33K relacionado con productos que no están rotando" — ese
  inventario es TUYO, no de Falabella, aunque los SKU sean los que ella compra. La frase correcta siempre pone
  TU inventario como sujeto del capital y a [cliente] como quien compra esos SKU: "de los productos que le
  vendés a Falabella, $X están detenidos en tu inventario" (nunca al revés, nunca "[cliente] tiene/posee...").
  Si tenés una acción sobre el mecanismo Y esto además trae algo real, dale su propio espacio como una SEGUNDA
  acción concreta (un segundo frente, no un aparte apurado) — nombrá el/los SKU, su $ y sus días sin venta;
  nunca lo omitas si está en la boleta, y nunca lo mezcles con la brecha de margen (son dos cosas distintas: una
  es rentabilidad de la cuenta, la otra es capital inmovilizado en tu inventario).
  Con composición Y capital ligado juntos, la respuesta sigue siendo PROPORCIONAL (ver LA ESTRUCTURA arriba):
  el titular es la lectura del mix, el mecanismo la refuerza con su cifra, y el capital ligado cierra como
  segunda acción — no una lista de cada número que tenés disponible.

HONESTIDAD (sos asesor, no buscador): si TODO lo pedido vino "disponible":false, NUNCA cortes con un "no" seco ni jerga ("granularidad atómica"): decí en una frase simple qué no tenés y por qué (si el dato trae "limite_temporal"/"motivo", usá ESA razón — ej. "el resultado mes a mes no lo tengo: los gastos son % sobre la venta anual"), y ofrecé lo que SÍ (coverage.alternativas) o repreguntá corto. EL MES A MES SÍ EXISTE para ventas y contribución (viene por trend) → narralo, no lo niegues. NO PROYECTES A FUTURO (no hay serie a futuro): si piden el pronóstico / "el mes que viene", decilo en una frase y ofrecé la evolución hasta hoy. NUNCA le pongas etiqueta de "mensual" a una foto que NO es mensual, NUNCA fabriques cifras por mes. Registro ejecutivo neutro LatAm, sin slang ni inglés (capital/valor no "plata"; capital detenido no "dormido"; acción/medida no "palanca"; potencial no "upside").

${memBlock ? memBlock + "\n\n" : ""}Escribí SOLO la respuesta de ADI, sin preámbulos.`;
}

import { parseFigures } from "../boleta.js";

// normalizeFigures(text, figs) → muestra cada cifra en su forma CANÓNICA LIMPIA de la boleta ($4.2M, no $4,207,331).
// El LLM a veces expande a dígitos crudos; como tienen el MISMO canon que la cifra autorizada, las reemplazamos por
// la forma abreviada (voz ejecutiva · consistente). Reemplazo acotado con lookaround para no romper cifras vecinas.
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function normalizeFigures(text, figs) {
  if (!Array.isArray(figs) || !figs.length) return text;
  const byCanon = new Map();
  for (const f of figs) if (f && f.canon && !byCanon.has(f.canon)) byCanon.set(f.canon, f.value);
  let s = String(text || "");
  const done = new Set();
  // reemplazá las MÁS LARGAS primero (evita tocar una subcadena de otra)
  for (const pf of parseFigures(s).sort((a, b) => b.text.length - a.text.length)) {
    if (done.has(pf.text)) continue; done.add(pf.text);
    const clean = byCanon.get(pf.canon);
    if (clean && clean.replace(/\s/g, "") !== pf.text.replace(/\s/g, "")) {
      s = s.replace(new RegExp(`(?<![\\d.,])${_esc(pf.text)}(?![\\d.,%xdKMB])`, "g"), clean);
    }
  }
  return s;
}

// stripFiller(text) → saca las COLAS DE RELLENO de informe (banda prohibida · backstop del prompt). Borra la oración
// completa SOLO si no trae cifra (no perdemos dato). Mismo espíritu que stripLanguageLeaks del guard de voz.
const _FILLER = [
  /[^.!?\n]*\bes fundamental\b[^.!?\n]*[.!?]/gi,
  /[^.!?\n]*\bes importante (?:considerar|seguir|monitor\w*|tener en cuenta|destacar|recordar)\b[^.!?\n]*[.!?]/gi,
  /[^.!?\n]*\b(?:seguir |seguí |continuar )?monitore\w+\b[^.!?\n]*[.!?]/gi,
  /[^.!?\n]*\bprioriz\w+ (?:estas acciones )?estrat[eé]gicamente\b[^.!?\n]*[.!?]/gi,
  /[^.!?\n]*\bpara mejorar la situaci[oó]n general\b[^.!?\n]*[.!?]/gi,
  /[^.!?\n]*\brestaurar el impulso\b[^.!?\n]*[.!?]/gi,
  /[^.!?\n]*\bbusc\w+ un equilibrio\b[^.!?\n]*[.!?]/gi,
  /[^.!?\n]*\bno dud\w+ en (?:decir\w*|consultar\w*|preguntar|contactar)[^.!?\n]*[.!?]/gi,
  /[^.!?\n]*\bestoy (?:aquí|acá|listo)\s*(?:para|si)[^.!?\n]*[.!?]/gi,
  /[^.!?\n]*\basegurar (?:el|la) (?:crecimiento|sostenibilidad|éxito)[^.!?\n]*[.!?]/gi,
  /[^.!?\n]*\bse puede generar un impacto positivo[^.!?\n]*[.!?]/gi,
  /[^.!?\n]*\bpara poner esto en contexto[^.!?\n]*[.!?]/gi,
  /[^.!?\n]*\besta secuencia te (?:brinda|da|permite)[^.!?\n]*[.!?]/gi,
  /[^.!?\n]*\b(?:hay |tenés )?espacio para optimizar[^.!?\n]*[.!?]/gi,
  /[^.!?\n]*\benfocando (?:tus |los )?esfuerzos[^.!?\n]*[.!?]/gi,
];
export function stripFiller(text) {
  let s = String(text || "");
  for (const re of _FILLER) s = s.replace(re, (m) => (/\$|\d\s*%|\dx|\d\s*d\b/.test(m) ? m : ""));
  return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

// isExplicitTableRequest(userText) → true si el usuario pidió LITERALMENTE una tabla ("ponlo en una tabla",
// "quiero eso en formato tabla"...). Owner 2026-08-02: "si el usuario pidió explícitamente una tabla, debe
// conservarse aunque tenga una fila" — stripSingleRowTables (abajo) es un backstop contra tablas AUTO-GENERADAS
// por el narrador sin que nadie las pidiera; una tabla que el usuario mismo pidió es una respuesta legítima a lo
// que preguntó, aunque termine teniendo 1 sola fila (ej. "dame en una tabla el capital de Valparaíso").
const _EXPLICIT_TABLE_RE = /\btablas?\b/i;
const _NEGATED_TABLE_RE = /\b(?:sin|nada\s+de|ning(?:u|ú)na?)\b[^.?!]{0,25}\btablas?\b|\btablas?\b[^.?!]{0,25}\bno\b|\bno\b[^.?!]{0,15}\b(?:hagas?|quiero|necesito|pongas?|armes?|des|hacer|poner|armar)\b[^.?!]{0,20}\btablas?\b/i;
export function isExplicitTableRequest(userText) {
  const t = String(userText || "");
  return _EXPLICIT_TABLE_RE.test(t) && !_NEGATED_TABLE_RE.test(t);
}

// stripSingleRowTables(text, userText) → backstop DETERMINÍSTICO (owner 2026-08-02: "si solo existe una entidad...
// no fuerces una tabla") — colapsa cualquier tabla markdown de EXACTAMENTE 1 fila de datos (header + separadora +
// 1 fila): eso nunca es una tabla real, es una sola entidad vestida de tabla. Medido en vivo (caso "capital en
// Valparaíso", 1 bodega + 2 SKU mezclados en el mismo ledger): CAPITAL_COLUMNS_INSTRUCTION solo (prompt) subió el
// cumplimiento pero no lo garantizó (~75%, no 100%) — mismo patrón de esta sesión: instrucción sola no alcanza,
// hace falta backstop de código, igual que ensureHypothesisFraming/ensureClarifyClosingQuestion. Genérico (no
// específico de capital): en todas las corridas observadas la fila ya estaba dicha en la prosa ANTES de la tabla
// (el narrador la repite en las dos formas) — se borra solo el bloque de tabla, la prosa que ya trae el mismo
// dato queda intacta, así que no se pierde información. EXCEPCIÓN (owner 2026-08-02, segunda vuelta): si
// isExplicitTableRequest(userText) es true, este backstop NO debe tocar nada — es un candado contra tablas que
// nadie pidió, no contra tablas que el usuario pidió a propósito.
export function stripSingleRowTables(text, userText) {
  if (isExplicitTableRequest(userText)) return String(text || "");
  const lines = String(text || "").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const isHeaderRow = /^\s*\|.*\|\s*$/.test(lines[i]);
    const isSepRow = i + 1 < lines.length && /^\s*\|?[\s:|-]+\|\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-");
    if (isHeaderRow && isSepRow) {
      let j = i + 2, dataRows = 0;
      while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) { dataRows++; j++; }
      if (dataRows === 1) { i = j; continue; }   // 1 sola fila de datos → se salta TODO el bloque (header+sep+fila)
      for (let k = i; k < j; k++) out.push(lines[k]);
      i = j; continue;
    }
    out.push(lines[i]); i++;
  }
  return out.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// stripRedundantTemporalTable(text, results) → backstop DETERMINÍSTICO (owner 2026-08-05, hallazgo en vivo: "y
// están las dos tablas igual!" — la doctrina SERIE TEMPORAL de arriba YA le pide al narrador no armar su propia
// tabla mes a mes, medido en vivo que la instrucción SOLA no alcanza — mismo patrón de TODA esta sesión
// (stripSingleRowTables/ensureHypothesisFraming/ensureClarifyClosingQuestion: doctrina + backstop de código,
// nunca doctrina sola). Cuando algún tool-call de este turno trajo `facts.tablaM` (la tool `trend`), esa matriz
// YA se renderiza siempre en una tarjeta aparte (chartSpec.js:chartForEvidence) — si el narrador ADEMÁS escribe
// su propia tabla markdown mes a mes, el usuario ve la MISMA tabla dos veces. Detecta el bloque de tabla cuyas
// filas empiezan con abreviaturas de mes (Ene/Feb/…/Dic, la MISMA convención de _rangoMeses en temporal.js) y lo
// borra entero — la prosa de lectura (que antecede/sigue a la tabla) queda intacta, ahí es donde vive la
// interpretación real. NUNCA toca una tabla que no sea de meses (ej. una tabla de clientes/SKU real que el
// usuario sí pidió) — el candado es la coincidencia de meses, no "cualquier tabla tras un trend".
const _MES_ABBR_RE = /^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b/i;
export function stripRedundantTemporalTable(text, results) {
  const hasTablaM = Array.isArray(results) && results.some((r) => r && r.facts && r.facts.tablaM && Array.isArray(r.facts.tablaM.rows) && r.facts.tablaM.rows.length);
  if (!hasTablaM) return String(text || "");
  const lines = String(text || "").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const isHeaderRow = /^\s*\|.*\|\s*$/.test(lines[i]);
    const isSepRow = i + 1 < lines.length && /^\s*\|?[\s:|-]+\|\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-");
    if (isHeaderRow && isSepRow) {
      let j = i + 2, monthRows = 0, dataRows = 0;
      while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) {
        dataRows++;
        const firstCell = lines[j].replace(/^\s*\|/, "").split("|")[0].trim();
        if (_MES_ABBR_RE.test(firstCell)) monthRows++;
        j++;
      }
      // 2+ filas de mes reconocidas → es la matriz redundante, se borra el bloque entero (header+sep+filas).
      if (monthRows >= 2) {
        // el narrador a veces antepone un encabezado markdown ("### Venta mes a mes") que solo existía para
        // introducir ESTA tabla — sin este paso queda huérfano (un "###" sin nada abajo, hallazgo en vivo,
        // owner 2026-08-05). Si la ÚLTIMA línea ya empujada a `out` (saltando líneas en blanco) es un encabezado
        // markdown (#{1,6}), se borra también — nunca toca una línea de prosa real, solo el patrón "#"+espacio.
        let k = out.length - 1;
        while (k >= 0 && out[k].trim() === "") k--;
        if (k >= 0 && /^#{1,6}\s+\S/.test(out[k].trim())) out.length = k;
        i = j; continue;
      }
      for (let k = i; k < j; k++) out.push(lines[k]);
      i = j; continue;
    }
    out.push(lines[i]); i++;
  }
  return out.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// _isPerfilCompletoPlan(plan) → true si el plan trajo entityComposicion/entityCapitalLigado (mismo criterio que
// usa buildNarrateUserMessageC para suprimir instruccion_tabla — factoreado acá para reusarlo en el backstop
// determinístico stripPerfilCompletoTable, más abajo).
function _isPerfilCompletoPlan(plan) {
  const calls = (plan && Array.isArray(plan.calls)) ? plan.calls : [];
  return calls.some((c) => c && (c.tool === "entityComposicion" || c.tool === "entityCapitalLigado"));
}

// stripPerfilCompletoTable(text, plan) → backstop DETERMINÍSTICO (owner 2026-08-07, hallazgo en vivo: 3 intentos
// de doctrina sola — payload instruccion_tabla suprimida para este caso, sección propia "PERFIL COMPLETO",
// excepción explícita en la regla FORMATO: TABLA — NINGUNO bajó la tasa de tabla de 15/15 corridas medidas.
// Mismo patrón de TODA esta sesión (ver stripRedundantTemporalTable arriba: doctrina + backstop de código,
// nunca doctrina sola cuando el modelo insiste con esta fuerza). Un turno de "perfil completo" (composición
// por familia y/o capital ligado) es exactamente el caso que el owner pidió cerrar antes de deployar a main:
// "en una consulta amplia por cliente, ADI no debe reproducir tablas que ya mostrará Sentrix — debe sintetizar
// en prosa". Borra CUALQUIER tabla markdown del texto (no selecciona por contenido — hasta el resumen de KPIs
// es redundante con las cards de Sentrix, no solo la tabla de familias/SKU) — la prosa alrededor queda intacta.
export function stripPerfilCompletoTable(text, plan) {
  if (!_isPerfilCompletoPlan(plan)) return String(text || "");
  const lines = String(text || "").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const isHeaderRow = /^\s*\|.*\|\s*$/.test(lines[i]);
    const isSepRow = i + 1 < lines.length && /^\s*\|?[\s:|-]+\|\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-");
    if (isHeaderRow && isSepRow) {
      let j = i + 2;
      while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) j++;
      // encabezado markdown huérfano (mismo criterio que stripRedundantTemporalTable arriba — "### Composición
      // de ventas" sin nada abajo, si esa tabla borrada era lo único que introducía).
      let k = out.length - 1;
      while (k >= 0 && out[k].trim() === "") k--;
      if (k >= 0 && /^#{1,6}\s+\S/.test(out[k].trim())) out.length = k;
      i = j; continue;
    }
    out.push(lines[i]); i++;
  }
  return out.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// _isHypothesisFramed(text) → misma detección que certifyRun (_oracle_provider_certification_gate.mjs /
// _model_comparison.mjs): una oración con "si" + (recuperar/podrías/estimado/liberar) en la MISMA oración.
function _isHypothesisFramed(text) {
  const sentences = String(text || "").split(/(?<=[.!?])\s+/);
  return sentences.some((s) => /\bsi\b/i.test(s) && /\b(recuper\w*|podr[ií]as?|estimad\w*|liberar\w*)\b/i.test(s));
}

// ensureHypothesisFraming(text, mode, results) → GARANTÍA determinística del contrato SIMULACIÓN ("enmarcá SIEMPRE
// como HIPÓTESIS", conversationalContract.js): medido en vivo (comparación de modelos, 2026-08-02) que el prompt
// solo no le basta a gpt-4o-mini — a veces narra la simulación en tabla sin ninguna oración de hipótesis. Dispara
// por mode="simulacion" O por haber usado una tool simulate* (mismo criterio que _graduationViolation en
// guardC.js: el PLAN a veces clasifica mal el mode con este modelo, pero la tool que corrió no miente). Si el LLM
// ya lo dijo, no duplica; si no, AGREGA una oración de resguardo GENÉRICA al final (mismo patrón que
// ensurePeriodoDeclared en answerViaOracle.js: se suma, nunca se antepone — el texto del LLM sigue siendo lo
// primero que se lee, y cualquier chequeo `startsWith` sobre la narración real sigue funcionando igual).
const _SIM_TOOL_RE = /^simulate/i;
export function ensureHypothesisFraming(text, mode, results) {
  const s = String(text || "");
  const usedSim = mode === "simulacion" || (Array.isArray(results) && results.some((r) => r && _SIM_TOOL_RE.test(r.tool || "")));
  if (!usedSim || !s.trim() || _isHypothesisFramed(s)) return s;
  return `${s.trim()}\n\nEsto es un estimado: si no se cumple el supuesto planteado tal cual, lo que recuperarías podría variar.`;
}

// ensureClarifyClosingQuestion(text, mode) → GARANTÍA determinística del contrato CLARIFY ("Cerrá SIEMPRE con una
// pregunta guía", conversationalContract.js): mismo hallazgo en vivo. Debe correr DESPUÉS de ensurePeriodoDeclared
// (answerViaOracle.js) para que la pregunta quede realmente al final, no tapada por la cláusula de período.
// Genérica pero sin caer en las formas prohibidas por el prompt ("¿alguna otra pregunta?"/"¿te sirve esto?") — el
// LLM sigue siendo quien debe cerrar bien; esto es solo la red para cuando no lo hizo.
export function ensureClarifyClosingQuestion(text, mode) {
  const s = String(text || "");
  if (mode !== "clarify" || !s.trim() || /\?\s*$/.test(s.trim())) return s;
  return `${s.trim()}\n\n¿Querés que lo repase de otra forma, o seguimos con el siguiente paso?`;
}

// _needsTableFormat(figs) → true si el ledger tiene la forma que el FORMATO de arriba (TABLA) ya exige tabular:
// 2+ ENTIDADES DISTINTAS, cada una con 2+ cifras autorizadas propias. Mismo hallazgo en vivo que
// ensureHypothesisFraming/ensureClarifyClosingQuestion (owner 2026-08-02, capturas de pantalla comparando
// respuestas): la regla YA está en el prompt ("armá una TABLA...SIN IMPORTAR que la pregunta haya sido sobre una
// sola métrica") pero gpt-4o-mini no la sigue de forma confiable — para el MISMO tipo de dato (capital por bodega
// + por SKU) devolvió prosa corrida, una lista con guiones, y (rara vez) una tabla real, en 3 corridas distintas.
// Convención de label (boleta.js fig() + specRetrieval.js, ej. "Falabella · Margen", "LG-DRYER8KG · Capital
// detenido"): "Entidad · Concepto" — separa por " · ", agrupa por entidad, cuenta CONCEPTOS distintos por entidad.
// Un solo entity con múltiples conceptos (ej. "Falabella · Margen"/"Falabella · Ventas" de un entityProfile) NO
// dispara esto — esa es la ficha de UNA entidad, sigue siendo prosa legítima (ver PROSA: "para 1-2 entidades").
// _groupByEntity(figs) → Map(entidad → Set(conceptos)) — UNA sola fuente para los 3 detectores de abajo (tabla/
// lista/brecha), todos parten de la MISMA convención de label "Entidad · Concepto" (boleta.js fig()).
function _groupByEntity(figs) {
  const byEntity = new Map();
  if (!Array.isArray(figs)) return byEntity;
  for (const f of figs) {
    const label = (f && f.label) || "";
    const idx = label.indexOf(" · ");
    if (idx < 0) continue;
    const entidad = label.slice(0, idx);
    const concepto = label.slice(idx + 3);
    if (!byEntity.has(entidad)) byEntity.set(entidad, new Set());
    byEntity.get(entidad).add(concepto);
  }
  return byEntity;
}
function _needsTableFormat(figs) {
  if (!Array.isArray(figs) || figs.length < 4) return false;   // menos de 4 cifras no puede ser 2 entidades × 2 conceptos
  const byEntity = _groupByEntity(figs);
  let entitiesWithMultiple = 0;
  for (const conceptos of byEntity.values()) if (conceptos.size >= 2) entitiesWithMultiple++;
  return byEntity.size >= 2 && entitiesWithMultiple >= 2;
}
// TABLE_INSTRUCTION → mismo principio que BRIEF_INSTRUCTION (responsePreference.js): reforzar A NIVEL DE TURNO,
// no solo en el system prompt, es lo que ya recuperó cumplimiento para brevedad/contentScope. Viaja SOLO cuando
// _needsTableFormat detecta la forma — un turno de UNA entidad o de cifras sueltas no le agrega nada nuevo al
// prompt (mismo principio de payload mínimo que el resto de instrucciones reforzadas de acá abajo).
const TABLE_INSTRUCTION = "Tus cifras_autorizadas traen 2+ entidades con 2+ cifras cada una — SIEMPRE armá una tabla en MARKDOWN real (con fila de encabezado y fila separadora \"|---|---|\"), NUNCA una lista con guiones ni prosa corrida para esto, sin importar que la pregunta haya sido sobre una sola métrica. Cada fila es una entidad; cada columna, un concepto distinto que ya tenés autorizado. OJO si tus cifras mezclan MÁS DE UN TIPO de entidad (ej. bodegas Y SKU a la vez): esto dispara porque ALGÚN grupo tiene 2+ entidades, pero puede que OTRO grupo tenga una sola — nunca armes una tabla de UNA SOLA FILA para ese grupo chico (eso es prosa: \"tenés $X en [la única entidad]\"); tabulá solamente el grupo que de verdad tenga 2+ filas. LA TABLA SOLA NUNCA ES EL CIERRE de la respuesta — es apenas el titular. Después de ella, en PROSA corrida (nunca con un encabezado tipo \"Por qué:\"/\"Qué hacer:\", eso ya está prohibido más abajo), seguí contando la historia completa: explicá la causa con las cifras que ya tenés (rotación, días de cobertura, días sin venta, mecanismo) y nombrá LA entidad puntual (no \"las bodegas mencionadas\" en genérico) con su $ o su brecha como la acción a priorizar. Armar bien la tabla no te exime de cerrar la historia completa (ver LA ESTRUCTURA en tu instrucción general) — un cierre tipo \"¿querés que profundicemos?\" sin haber explicado ya la causa y nombrado qué hacer primero es una respuesta a medias.";

// TABLE_INSTRUCTION_DECISION → variante de TABLE_INSTRUCTION específica para mode="decision" (owner 2026-08-03, fix
// "orden acción-tabla roto en mode=decision"): TABLE_INSTRUCTION de arriba asume y REFUERZA tabla-primero ("LA
// TABLA SOLA NUNCA ES EL CIERRE... después de ella, en PROSA corrida... seguí contando la historia completa") — eso
// choca directo contra conversationalContract.js MODES['decision'].narrate ("Arrancá DIRECTO por la acción — a lo
// sumo UNA frase de contexto antes, nunca el diagnóstico completo primero"), y medido en vivo (4 corridas reales
// del turno "¿Qué debería priorizar esta semana entre Falabella, Lider y Sodimac?", 3/3 con mode=decision
// confirmado) la tabla gana SIEMPRE — el turno abre con la fila de tabla, violando el contrato de decisión.
// MISMA doctrina de FORMATO que TABLE_INSTRUCTION (markdown real, fila separadora, una fila por entidad, tabla de
// una sola fila sigue prohibida, tabla tampoco es el cierre) — lo ÚNICO que cambia es el ORDEN: una frase de acción
// PRIMERO, tabla DESPUÉS, prosa causal al final. Disparada SOLO cuando modo==="decision" Y _needsTableFormat ya
// decidió que el turno necesita tabla (ver buildNarrateUserMessageC más abajo) — los otros 6 modos siguen
// recibiendo TABLE_INSTRUCTION sin cambios, byte a byte (cero riesgo de regresión para _table_format_gate.mjs y
// cualquier otro turno que no sea de decisión).
const TABLE_INSTRUCTION_DECISION = "Tus cifras_autorizadas traen 2+ entidades con 2+ cifras cada una — pero este es un turno de DECISIÓN: antes de armar la tabla, en UNA FRASE, nombrá la acción a priorizar (la entidad/fila con mayor $ o mayor brecha) — la tabla JAMÁS es lo primero que decís en un turno de decisión, a diferencia de otros modos. Recién DESPUÉS de esa frase armá la tabla en MARKDOWN real (con fila de encabezado y fila separadora \"|---|---|\"), NUNCA una lista con guiones ni prosa corrida para esto, sin importar que la pregunta haya sido sobre una sola métrica. Cada fila es una entidad; cada columna, un concepto distinto que ya tenés autorizado. OJO si tus cifras mezclan MÁS DE UN TIPO de entidad (ej. bodegas Y SKU a la vez): tabulá solamente el grupo que de verdad tenga 2+ filas, nunca una tabla de UNA SOLA FILA (eso es prosa). LA TABLA TAMPOCO ES EL CIERRE — después de ella, en PROSA corrida (nunca con un encabezado tipo \"Por qué:\"/\"Qué hacer:\", eso ya está prohibido más abajo), explicá el mecanismo/causa con las cifras que ya tenés (rotación, días de cobertura, mecanismo real). El orden completo de tu respuesta es SIEMPRE: (1) UNA frase de acción, (2) la tabla, (3) la prosa causal — la tabla NUNCA puede ser la primera línea que escribís.";

// _needsCapitalColumnNames(figs) → true si el ledger trae el patrón EXACTO "Entidad · Capital detenido" +
// "Entidad · % del total" (composeSpecInventory, specRetrieval.js — capital por bodega/SKU). Owner 2026-08-02:
// "Usa tabla con estas columnas: Bodega/SKU | Capital detenido | % del total". Medido en vivo (5/5 corridas):
// _needsTableFormat YA logra tabla siempre, pero el encabezado de columna varía ("Capital Inmovilizado (USD)",
// "Porcentaje del total (%)") — los NÚMEROS ya son correctos siempre (cifras autorizadas/reconciliadas), esto
// solo fija el TEXTO literal del encabezado. Exige _needsTableFormat===true primero (mismo candado que Brecha):
// si TODO el ledger es 1 sola entidad (ej. alcance filtrado a una bodega SIN SKU mezclados) las 2 cifras existen
// pero NO hay tabla que formatear — el owner pidió explícito "si solo existe una entidad... no fuerces una tabla".
// OJO (hallazgo en vivo, owner 2026-08-02, alcance "capital en Valparaíso"): un alcance de 1 bodega SUELE traer
// igual 2+ SKU de esa bodega en el mismo ledger — _needsTableFormat dispara por el grupo SKU (correcto), pero el
// LLM a veces tabuló el grupo BODEGA (1 sola fila) en vez del grupo SKU (el que de verdad tiene 2+) — ver el
// candado explícito contra "tabla de una sola fila" en TABLE_INSTRUCTION y en CAPITAL_COLUMNS_INSTRUCTION abajo.
function _needsCapitalColumnNames(figs) {
  if (!_needsTableFormat(figs)) return false;
  if (!Array.isArray(figs)) return false;
  const hasCapitalDetenido = figs.some((f) => f && / · Capital detenido$/.test(f.label || ""));
  const hasPctDelTotal = figs.some((f) => f && / · % del total$/.test(f.label || ""));
  return hasCapitalDetenido && hasPctDelTotal;
}
const CAPITAL_COLUMNS_INSTRUCTION = "Tus cifras_autorizadas traen \"Capital detenido\" y \"% del total\" por entidad (bodega o SKU) — armá la tabla con ESTOS 3 encabezados LITERALES, en este orden: \"Bodega\" o \"SKU\" (el que corresponda) | \"Capital detenido\" | \"% del total\". No los reformules ni los traduzcas (nunca \"Capital Inmovilizado (USD)\", nunca \"Porcentaje del total (%)\"). El % NUNCA lo calculás vos NI lo completás de otra cifra suelta: si una entidad NO tiene su propia cifra \"Entidad · % del total\" autorizada, esa entidad NO va en la tabla de porcentajes — nunca uses una cifra sin ese formato exacto (ej. una cifra llamada solo \"pct\", sin nombre de entidad) para rellenar el % de una fila, aunque el número parezca coincidir. Si tenés cifras de bodegas Y de SKU a la vez, armá DOS TABLAS separadas (una con encabezado de fila \"Bodega\", otra con \"SKU\") — nunca las mezcles bajo un solo encabezado, cada una suma 100% por sí sola. ESTA REGLA DE LAS DOS TABLAS NO CAMBIA por lo que sigue abajo sobre causa y acción: si tenés 2+ SKU con \"Capital detenido\"+\"% del total\" propios, la tabla de SKU es SIEMPRE obligatoria — nombrar la causa en prosa es ADEMÁS de esa tabla, nunca en vez de ella. Si el alcance ya viene acotado a UNA sola bodega (ej. \"cuánto capital tengo en Valparaíso\"), esa bodega NO tiene cifra de \"% del total\" autorizada a propósito (es obvio que es el 100%, no hace falta cifra) — esa bodega es una fila única, no le armes tabla ni le inventes un %: decilo en una frase (\"tenés $X en Valparaíso\"); si esos mismos datos SÍ traen 2+ SKU dentro de esa bodega, esa es la tabla que corresponde armar (encabezado \"SKU\"), no la de bodega.\n  NINGUNA TABLA ES EL CIERRE: arma TODAS las tablas que correspondan (bodega y/o SKU, según la regla de arriba) y DESPUÉS, en prosa corrida (sin encabezados tipo \"Por qué:\"), agregá lo que las tablas no dicen — tenés \"Rotación\", \"Días de cobertura\" y \"Días sin venta\" por SKU ya autorizados: usalos para explicar la causa (ej. \"rotación de 1.0x y 165 días de cobertura — prácticamente no se mueve\") y para nombrar el SKU puntual con más $ o más días sin venta como la acción a priorizar, con su monto. Un cierre que solo repite el total y pregunta \"¿querés que profundicemos en los SKU?\" está incompleto — YA tenés esos SKU en tus cifras_autorizadas, nómbralos ahora, no los guardes para un turno futuro.";

// _needsListFormat(figs) → true si hay 3+ entidades con UNA sola cifra cada una (ranking de una métrica) — el
// complemento exacto de _needsTableFormat (2+ cifras/entidad). Hallazgo de auditoría en vivo (owner 2026-08-02,
// workflow de 4 agentes): gpt-4o-mini NUNCA usó lista numerada en 6/6 corridas reales para este caso — sistemática,
// más consistente incluso que la inconsistencia original de tabla — siempre arma una tabla de 2 columnas en su
// lugar, pese a que LISTA NUMERADA (FORMATO) es explícita: "varias entidades por UNA sola métrica → numerado".
function _needsListFormat(figs) {
  if (_needsTableFormat(figs)) return false;   // el caso de tabla (2+cifras/entidad) manda si ambos calzan
  const byEntity = _groupByEntity(figs);
  if (byEntity.size < 3) return false;
  let singleConcept = 0;
  for (const conceptos of byEntity.values()) if (conceptos.size === 1) singleConcept++;
  return singleConcept >= byEntity.size * 0.8;   // tolera algún outlier, no exige el 100%
}
const LIST_INSTRUCTION = "Tus cifras_autorizadas traen 3+ entidades con UNA sola cifra cada una — SIEMPRE armá una LISTA NUMERADA (\"1. **Entidad** — cifra + tu lectura en una frase\"), la de más valor primero. NUNCA una tabla de 2 columnas para esto, NUNCA prosa encadenada tipo \"Primero X, además Y, por último Z\".";

// _needsBrechaReinforcement(figs) → true si hay 2+ entidades con un concepto "margen" Y viene el fig global
// "Benchmark de margen" — la tabla de margen DEBE sumar la columna Brecha (benchmark−margen, en puntos). Hallazgo
// de auditoría en vivo: 0/3 tablas de margen reales incluyeron Brecha pese a tener todo lo necesario para
// calcularla — el narrador la menciona en PROSA ("evaluá cerrar la brecha") pero nunca la tabula.
function _needsBrechaReinforcement(figs) {
  // hallazgo propio (owner 2026-08-02, probado en vivo): sin este candado, instruccion_brecha podía dispararse
  // JUNTO a instruccion_lista (ranking de margen con 1 SOLO concepto por entidad — "Margen" — nada que columnar
  // todavía) → dos instrucciones contradictorias en el mismo turno ("armá una lista" + "agregale una columna a tu
  // tabla"). Brecha es un requisito DE LA TABLA (FORMATO línea 54: "cuando la tabla es un ranking de margen…") —
  // solo tiene sentido cuando _needsTableFormat YA decidió que este turno es tabla.
  if (!_needsTableFormat(figs)) return false;
  if (!Array.isArray(figs)) return false;
  if (!figs.some((f) => f && f.label === "Benchmark de margen")) return false;
  const byEntity = _groupByEntity(figs);
  let marginEntities = 0;
  for (const conceptos of byEntity.values()) if ([...conceptos].some((c) => /margen/i.test(c))) marginEntities++;
  return marginEntities >= 2;
}
const BRECHA_INSTRUCTION = "Tenés el margen de cada entidad Y el \"Benchmark de margen\" — SIEMPRE agregá una columna \"Brecha\" a la tabla (benchmark − margen, en puntos porcentuales — la resta entre dos cifras autorizadas está permitida), calculada fila por fila. Nunca la dejes afuera ni la menciones solo en la prosa sin tabularla — si el usuario ve \"brecha\" en el texto pero no en una columna, no cumpliste.";

// _needsOrdenMontoReinforcement(text, results) → true si el usuario pidió EXPLÍCITO orden por $/monto/dinero
// recuperable Y la tool que corrió es marginRead (que solo da margen/brecha en PUNTOS, nunca un $ recuperable por
// entidad) SIN que gridTable/tensionRead (que sí sellan el orden real) también haya corrido. Hallazgo de auditoría
// en vivo: 1/3 corridas reales prometió "ordenado por dinero" y en realidad ordenó por brecha en % — sin bloqueo
// del guard, porque marginRead no sella facts.orden (eso es harina de un fix estructural aparte, ver memoria).
const _ORDEN_MONTO_RE = /\bordena?(?:me|r|los|las)?\b[^.?!]{0,50}\b(dinero|monto|importe|recuperable)\b/i;
function _needsOrdenMontoReinforcement(text, results) {
  if (!_ORDEN_MONTO_RE.test(String(text || ""))) return false;
  const list = Array.isArray(results) ? results : [];
  const usedMarginRead = list.some((r) => r && r.tool === "marginRead");
  const hasSealedOrder = list.some((r) => r && (r.tool === "gridTable" || r.tool === "tensionRead"));
  return usedMarginRead && !hasSealedOrder;
}
const ORDEN_MONTO_INSTRUCTION = "El usuario pidió orden EXPLÍCITO por dinero/monto recuperable, pero la tool que corrió (marginRead) solo te da margen y brecha en PUNTOS PORCENTUALES, no un $ recuperable por cada entidad — NUNCA ordenes por brecha en % y digas que es \"por dinero\"/\"por monto\", eso promete algo que no cumpliste. Si no tenés el $ de todos, decilo honesto (\"no tengo el monto recuperable de todos, te los ordeno por brecha de margen\") en vez de una frase ambigua que suene a que sí ordenaste por plata.";

// buildNarrateUserMessageC({ text, plan, results, ledgerFigs, mem, history }) → el OBJETO de datos para la Pasada 2
// (el adapter lo serializa · no lo stringifiques acá para no doblar el JSON). El HILO RECIENTE viaja para que los
// seguimientos deícticos ("esto mismo", "y eso", "mes a mes") se resuelvan contra lo que ya se dijo — sin él, el
// narrador no sabe a qué refiere "esto" y improvisa.
export function buildNarrateUserMessageC({ text, plan, results, ledgerFigs, mem, history, pref, instruccionOrientacion, scenario, requestContext, claimsOnly = false }) {
  // CONTRATO v2 · FASE 1 (owner 2026-08-07): el payload deja de armarse desde `plan`/`results` crudos. Se SELLA
  // primero un NarrationContract inmutable (narrationContract.js) y el payload es una PROYECCIÓN PURA de ese
  // contrato — projectNarratePayload no recibe ni puede mirar plan/results. La garantía "el LLM no puede modificar
  // entidades/métricas/períodos/supuestos tras validar" pasa de doctrina de prompt a ESTRUCTURA: no es que el
  // prompt se lo prohíba, es que no hay otra cosa que ver. Esta firma NO cambia (los ~30 callers/gates que la
  // consumen siguen andando igual) y el payload resultante es BYTE-IDÉNTICO al anterior — verificado por
  // _narration_contract_gate.mjs, que compara la proyección contra la construcción legacy caso por caso.
  const contract = buildNarrationContract({ text, plan, results, ledgerFigs, mem, history, pref, instruccionOrientacion, scenario, requestContext });
  return claimsOnly ? projectClaimsOnlyPayload(contract) : projectNarratePayload(contract);
}

// projectClaimsOnlyPayload(contract) → CONTRATO v2 · el payload SIN NINGUNA FUENTE CRUDA (owner 2026-08-07,
// opción (b): implementado detrás de flag, APAGADO por defecto — ver ADI_CLAIMS_ONLY_ENABLED en voiceFlags.js).
// Diferencia con projectNarratePayload: acá NO viaja `datos` (los facts de las tools) ni el eco del plan. El
// narrador ve EXCLUSIVAMENTE lo que el motor selló y autorizó:
//   alcance · afirmaciones (con estatus epistémico) · relaciones autorizadas · acciones y prioridades permitidas ·
//   supuestos · preguntas abiertas · política de respuesta (modo + densidad + qué NO puede agregar).
// Las cifras siguen viajando como `cifras_autorizadas` (mismo contrato con guardC — no se toca el muro numérico).
// NO se declara cerrado el contrato ni se enciende en producción hasta que el owner valide la calidad de la prosa:
// cambiar lo que el narrador lee cambia la narración, y eso no es verificable sin corridas pagadas.
export function projectClaimsOnlyPayload(contract) {
  const c = contract || {};
  const scope = c.scope || {};
  const forma = c.forma || {};
  const pref = c.pref;
  const claims = Array.isArray(c.claims) ? c.claims : [];
  const figLabels = claims.map((cl) => ({ label: cl.etiqueta, unit: cl.unidad, value: cl.valor }));
  const modo = MODE_KEYS.includes(forma.modo) ? forma.modo : "default";
  const hilo_reciente = Array.isArray(c.hiloReciente) ? c.hiloReciente : [];
  return {
    pregunta: c.pregunta,
    intencion: c.intencion || "answer",
    modo,
    ...(modo === "clarify" ? { nivel_aclaracion: forma.clarifyStreak || 1 } : {}),
    // ALCANCE sellado (no el eco del plan): sobre qué, en qué eje, en qué período — ya validado contra el catálogo.
    alcance: { eje: scope.eje, entidades: scope.entidades, nivel: scope.nivel, periodo: scope.periodo, filtros: scope.filtros },
    // AFIRMACIONES con su estatus epistémico — reemplazan a `datos`/facts.
    afirmaciones: claims.map((cl) => ({
      id: cl.id, entidad: cl.entidad, metrica: cl.metrica, periodo: cl.periodo,
      valor: cl.valor, unidad: cl.unidad, estatus: cl.estatus,
      ...(cl.obligatoria ? { obligatoria: true } : {}),
      ...(cl.formula ? { formula: cl.formula } : {}),
      ...(cl.contexto ? { contexto: cl.contexto } : {}),
    })),
    relaciones_autorizadas: c.relaciones || {},
    acciones_permitidas: c.acciones || [],
    ...(Array.isArray(c.supuestos) && c.supuestos.length ? { supuestos: c.supuestos } : {}),
    ...(Array.isArray(c.preguntasAbiertas) && c.preguntasAbiertas.length ? { preguntas_abiertas: c.preguntasAbiertas } : {}),
    politica_respuesta: c.politicaExtension || {},
    // las instrucciones de FORMA siguen siendo decisiones del motor (no fuentes crudas) — se conservan para que
    // la comparación de calidad contra el modo actual sea justa: solo cambia el ORIGEN del contenido, no la forma.
    ...(!isDefaultPref(pref) ? { preferencia_respuesta: { alcance: pref.contentScope || "full", detalle: pref.detailLevel || "standard" } } : {}),
    ...(pref && pref.contentScope && pref.contentScope !== "full" && blockInstructionFor(pref.contentScope) ? { instruccion_formato: blockInstructionFor(pref.contentScope) } : {}),
    ...(pref && pref.detailLevel === "brief" ? { instruccion_brevedad: BRIEF_INSTRUCTION } : {}),
    ...(modo === "clarify" ? {} : (_needsTableFormat(figLabels) ? { instruccion_tabla: modo === "decision" ? TABLE_INSTRUCTION_DECISION : TABLE_INSTRUCTION } : {})),
    ...(_needsListFormat(figLabels) ? { instruccion_lista: LIST_INSTRUCTION } : {}),
    ...(_needsBrechaReinforcement(figLabels) ? { instruccion_brecha: BRECHA_INSTRUCTION } : {}),
    ...(_needsCapitalColumnNames(figLabels) ? { instruccion_columnas_capital: CAPITAL_COLUMNS_INSTRUCTION } : {}),
    ...(forma.instruccionOrientacion ? { instruccion_orientacion: forma.instruccionOrientacion } : {}),
    ...(hilo_reciente.length ? { hilo_reciente } : {}),
    cifras_autorizadas: claims.map((cl) => ({ etiqueta: cl.etiqueta, valor: cl.valor })),
    ...(c.memoria ? { memoria_interaccion: c.memoria } : {}),
  };
}

// projectNarratePayload(contract) → el OBJETO de datos para la Pasada 2, derivado EXCLUSIVAMENTE del contrato
// sellado. Es la frontera dura del contrato v2: si un dato no está en el contrato, el narrador no lo ve. Pura.
export function projectNarratePayload(contract) {
  const c = contract || {};
  const scope = c.scope || {};
  const forma = c.forma || {};
  const pref = c.pref;
  const claims = Array.isArray(c.claims) ? c.claims : [];
  // los detectores de FORMA (tabla/lista/brecha/columnas) leen `label` de cada cifra — los claims conservan el
  // label original en `etiqueta`, así que se proyecta la misma forma que consumían de la boleta cruda.
  const figLabels = claims.map((cl) => ({ label: cl.etiqueta, unit: cl.unidad, value: cl.valor }));
  const datos = Array.isArray(c.datos) ? c.datos : [];
  const cifras_autorizadas = claims.map((cl) => ({ etiqueta: cl.etiqueta, valor: cl.valor }));
  const hilo_reciente = Array.isArray(c.hiloReciente) ? c.hiloReciente : [];
  const mem = c.memoria;
  const instruccionOrientacion = forma.instruccionOrientacion;
  const text = c.pregunta;
  const modo = MODE_KEYS.includes(forma.modo) ? forma.modo : "default";
  // PERFIL COMPLETO (owner 2026-08-07): true si el plan trajo entityComposicion/entityCapitalLigado — ver el uso
  // en instruccion_tabla más abajo (mismo criterio de supresión que modo="clarify").
  const _planCalls = Array.isArray(forma._planCalls) ? forma._planCalls : [];
  const esPerfilCompleto = _planCalls.some((x) => x && (x.tool === "entityComposicion" || x.tool === "entityCapitalLigado"));
  return {
    pregunta: text,
    intencion: c.intencion || "answer",
    modo,
    // nivel_aclaracion SOLO tiene sentido cuando modo=clarify (turnos consecutivos de confusión seguidos — ver
    // conversationalContract.js): 1 = primer intento de simplificar (máximo 1 cifra) · 2+ = el usuario TODAVÍA no
    // entendió (cero cifras, ejemplo concreto). Threaded vía plan.clarifyStreak desde answerViaOracle.js.
    ...(modo === "clarify" ? { nivel_aclaracion: forma.clarifyStreak || 1 } : {}),
    alcance: scope.declarado || null,
    // PREFERENCIA DE RESPUESTA (owner 2026-07-29) — SOLO viaja si es distinta del default (mismo principio de
    // payload mínimo que nivel_aclaracion arriba): un turno normal, sin pedido de formato, no le agrega NADA nuevo
    // al prompt del narrador — cero riesgo de drift para el 100% de los turnos que nunca tocan esta feature.
    ...(!isDefaultPref(pref) ? { preferencia_respuesta: { alcance: pref.contentScope || "full", detalle: pref.detailLevel || "standard" } } : {}),
    // instrucción de marcado REFORZADA a nivel de turno (owner-audit 2026-07-29: el system prompt solo no bastó,
    // medido en vivo — ver blockInstructionFor en responsePreference.js). null cuando contentScope="full"/default.
    ...(pref && pref.contentScope && pref.contentScope !== "full" && blockInstructionFor(pref.contentScope) ? { instruccion_formato: blockInstructionFor(pref.contentScope) } : {}),
    // BREVEDAD REFORZADA a nivel de turno (owner 2026-07-31, certificación integral — mismo principio que
    // instruccion_formato arriba: el system prompt solo no bastó para contentScope, medido en vivo que TAMPOCO
    // basta para detailLevel). El motor igual trunca determinísticamente si no alcanza (truncateToBriefBudget,
    // narrationBlocks.js) — esto es para que la mayoría de los turnos ya lleguen cortos sin depender del corte.
    ...(pref && pref.detailLevel === "brief" ? { instruccion_brevedad: BRIEF_INSTRUCTION } : {}),
    // TABLA REFORZADA (owner 2026-08-02, hallazgo en vivo): ver _needsTableFormat/TABLE_INSTRUCTION arriba.
    // modo==="decision" usa la variante TABLE_INSTRUCTION_DECISION (owner 2026-08-03, fix "orden acción-tabla roto
    // en mode=decision") — mismo disparador (_needsTableFormat), solo cambia CUÁL instrucción viaja.
    // CLARIFY NUNCA LLEVA instruccion_tabla (owner 2026-08-03, hallazgo de la suite completa de 107 gates): la
    // doctrina propia de clarify (conversationalContract.js MODES['clarify'].narrate) ya prohíbe tablas en CUALQUIER
    // nivel_aclaracion ("nivel 1: como mucho UNA cifra... nada de tablas, nada de listas"; "nivel 2+: cero números")
    // — TABLE_INSTRUCTION/TABLE_INSTRUCTION_DECISION asumen y refuerzan lo contrario (tabla como titular), la MISMA
    // clase de contradicción mode-vs-tabla ya identificada y corregida para decision (ver TABLE_INSTRUCTION_DECISION
    // arriba), aquí la resolución correcta es SUPRESIÓN total, no reordenar: medido en vivo (_oracle_clarify_mode_
    // gate.mjs, suite completa), un turno "no entendí" con 2+ entidades en el ledger recibía TABLE_INSTRUCTION y
    // citaba 16 cifras en una tabla completa, más que el propio resumen que originó la confusión (16 > 12) —
    // exactamente lo opuesto de "simplificar".
    // PERFIL COMPLETO TAMPOCO LLEVA instruccion_tabla (owner 2026-08-07, hallazgo en vivo verificado 5/5 corridas):
    // entityCapitalLigado autoriza cada SKU como su PROPIA entidad con 3 conceptos (capital/unidades/días sin
    // venta) — 2+ SKU dispara _needsTableFormat de fábrica, e inyecta TABLE_INSTRUCTION, que le GANA a la doctrina
    // de "PERFIL COMPLETO: nunca reconstruyas la tabla" de arriba (instrucción de payload > doctrina de system,
    // mismo problema que ya resolvió la excepción de clarify). Sentrix YA muestra esta composición/capital como
    // panel — el chat debe sintetizar en prosa, no repetir la tabla.
    ...(modo === "clarify" || esPerfilCompleto ? {} : (_needsTableFormat(figLabels) ? { instruccion_tabla: modo === "decision" ? TABLE_INSTRUCTION_DECISION : TABLE_INSTRUCTION } : {})),
    // LISTA NUMERADA REFORZADA (owner 2026-08-02, hallazgo de auditoría): ver _needsListFormat/LIST_INSTRUCTION.
    ...(_needsListFormat(figLabels) ? { instruccion_lista: LIST_INSTRUCTION } : {}),
    // BRECHA REFORZADA (owner 2026-08-02, hallazgo de auditoría): ver _needsBrechaReinforcement/BRECHA_INSTRUCTION.
    ...(_needsBrechaReinforcement(figLabels) ? { instruccion_brecha: BRECHA_INSTRUCTION } : {}),
    // COLUMNAS DE CAPITAL REFORZADAS (owner 2026-08-02): ver _needsCapitalColumnNames/CAPITAL_COLUMNS_INSTRUCTION.
    ...(_needsCapitalColumnNames(figLabels) ? { instruccion_columnas_capital: CAPITAL_COLUMNS_INSTRUCTION } : {}),
    // ORDEN POR MONTO REFORZADO (owner 2026-08-02, hallazgo de auditoría): ver _needsOrdenMontoReinforcement.
    // `datos` conserva `tool` por entrada — el detector solo mira qué tools corrieron, no los facts.
    ...(_needsOrdenMontoReinforcement(text, datos) ? { instruccion_orden: ORDEN_MONTO_INSTRUCTION } : {}),
    // ORIENTACIÓN (Fase 3, owner 2026-07-30) — SOLO viaja cuando answerViaOracle.js detectó un disparador
    // determinístico (pedido explícito o confusión persistente, ver dialogueState.js needsOrientacion). Mismo
    // principio de payload mínimo que preferencia_respuesta: un turno normal no la lleva.
    ...(instruccionOrientacion ? { instruccion_orientacion: instruccionOrientacion } : {}),
    ...(hilo_reciente.length ? { hilo_reciente } : {}),
    datos,
    cifras_autorizadas,
    ...(mem ? { memoria_interaccion: mem } : {}),
  };
}
