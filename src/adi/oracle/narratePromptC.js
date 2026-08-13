/* === src/adi/oracle/narratePromptC.js · ARQUITECTURA C · PASADA 2 · NARRAR ===
 * El LLM narra LIBRE sobre el ledger del turno (datos + cifras autorizadas), con la PERSONA de ADI y la memoria de
 * interacción. El MURO sigue: solo puede usar las cifras de `cifras_autorizadas` (verbatim); el guard lo valida
 * después. Acá NO hay texto determinístico previo — el narrador escribe la respuesta entera. Aún en sombra.
 */
import { MODE_KEYS, buildModeDispatch, buildRepairNarrateDoctrine } from "./conversationalContract.js";
import { isDefaultPref, buildPrefDispatch, blockInstructionFor, BRIEF_INSTRUCTION } from "./responsePreference.js";
import { buildNarrationContract } from "./narrationContract.js";   // CONTRATO v2 · Fase 1: el payload se proyecta del contrato sellado, nunca de plan/results crudos
import { ADI_EPISTEMIC_NOTE_ENABLED } from "../../config/voiceFlags.js";   // CONTRATO v2 · la PRESENTACIÓN del estatus epistémico va detrás de flag (el SELLO no)
import { projectViewContextForPlan } from "./viewContext.js";   // Concordancia ADI↔Sentrix: el contexto de pantalla viaja como UNA LÍNEA sin cifras, nunca como objeto ni como tabla
// UNA SOLA DEFINICIÓN DEL VOCABULARIO DE TRASLADO (owner 2026-08-10, defecto C1): la garantía de más abajo
// (ensureTransferenciaDeclarada) y el chequeo 19 del guard tienen que coincidir EXACTAMENTE en qué cuenta como
// pregunta de traslado y qué cuenta como declaración — dos regex paralelas serían justo cómo se llega a que la
// garantía crea haber cumplido y el guard rechace igual. guardC.js es el dueño del vocabulario; acá se consume.
import { preguntaPorTraslado, declaraLimiteTransferencia, limiteTransferenciaDeclarado, _derivadaDeSupuesto } from "./guardC.js";
// EL TERCER UNIVERSO (Contrato v1.2 §5.1): la definición de "cifra del usuario" es UNA, y vive en el contrato de
// narración — el guard la lee para juzgar y el renderer de más abajo para estampar. Dos definiciones paralelas
// serían justo cómo se llega a que el candado mire una cosa y el producto muestre otra.
import { cifrasDelUsuario } from "./narrationContract.js";

// buildNarrateSystemC(persona, memBlock, mode?, responsePref?) → system de la Pasada 2. Prompt COMPLETO de
// narración (owner 2026-07-28: "dale todas las indicaciones, como yo te las doy a ti · controller senior, mirada
// CFO · contá la historia · más calidad que antes"). Incorpora la estructura/contratos afinados del narrador viejo,
// adaptados a C (tablas markdown OK).
// ── PREFIJO ESTABLE PARA EL CACHÉ (owner 2026-08-13, Paso 0 del plan "ADI pierde el hilo") ────────────────────
// EL DEFECTO, medido offline: buildModeDispatch(mode) interpolaba la doctrina de UN solo modo cerca del FRENTE
// del system — el prefijo común entre dos turnos de modos distintos era 7.679 de ~36.100 chars (21,3%), y el caché
// de prefijo del proveedor solo reutiliza bytes idénticos desde el carácter 0: el 79% del system se pagaba entero
// en cada cambio de modo. La economía de "mandar SOLO el modo del turno" (Fase 2 de Mini, 2026-08-03) ahorraba ~5%
// de tokens nominales y perdía el descuento de caché del 79% restante — el neto era pagar MÁS.
// LA SALIDA, la misma de PLAN (buildPlanSystemSegments, planPrompt.js): el system se parte en DOS segmentos —
//   · FIJO: persona + tarea + cifras + LOS 7 MODOS COMPLETOS (buildModeDispatch() sin argumento — el fallback
//     documentado de siempre: el payload ya trae `modo` y el header del dispatch declara que ESE campo decide)
//     + toda la doctrina estable hasta HONESTIDAD. Byte-idéntico entre turnos, modos y sesiones → cacheable entero.
//   · VARIABLE: TODO lo que depende del turno/sesión — reparación, preferencia de respuesta, contexto de pantalla
//     y memoria de interacción — movido AL FINAL, donde romper el prefijo no cuesta nada.
// El CONTENIDO de la doctrina no se tocó: mismos textos, otro orden. `mode` se CONSERVA en la firma por los ~30
// callers/gates que lo pasan, pero ya no cambia el system: los 7 modos viajan siempre (el comportamiento
// documentado del caller viejo, ahora universal). `responsePref` (owner 2026-08-03, Fase 2 eficiencia de Mini): el bloque LARGO de doctrina de
// buildPrefDispatch (marcado [[DATOS]]/[[ACCION]]/etc.) antes viajaba SIEMPRE, en TODO turno — pero el propio
// código de responsePreference.js (ver blockInstructionFor/BRIEF_INSTRUCTION) ya documenta que el refuerzo REAL
// que logra cumplimiento es el de NIVEL DE TURNO (viaja en el payload de buildNarrateUserMessageC, condicionado por
// el `pref` DE ESE TURNO — eso NO cambia acá, sigue disparando para action_only aunque la sesión sea default). El
// bloque de system, en cambio, ahora es condicional a `mem.responsePref` (la preferencia PERSISTENTE de sesión):
// solo se manda si la sesión efectivamente tiene una preferencia no-default — un turno normal, sin nada persistido,
// no paga ese costo de tokens para una doctrina que no va a usar.
// `hayContextoVista` (owner 2026-08-09, Contrato de Concordancia ADI↔Sentrix): mismo criterio de economía que
// `responsePref` de arriba — el bloque CONTEXTO DE PANTALLA solo se manda cuando el payload de ESTE turno
// trae de verdad la línea `contexto_vista` (lo decide handleNarrateC leyendo el payload, no una adivinanza).
// `reparacion` (Contrato Conversacional v1.2, owner 2026-08-10): el objeto sellado del turno (o null). MISMA
// economía que `responsePref`/`hayContextoVista` de arriba — buildRepairNarrateDoctrine devuelve cadena
// vacía sin él, así que el 99% de los turnos, que no corrigen nada, no pagan un solo token por estas reglas.
// Sexto argumento OPCIONAL a propósito: los callers que llaman con cinco producen el MISMO system, byte por byte.
// `datoNegocio` (AMPLITUD F1, owner 2026-08-13) — séptimo argumento, OPCIONAL con la misma disciplina: la
// proyección curada del dato del tenant (datoProyectado.js), que entra AL FINAL del segmento FIJO —
// [persona+doctrina | EL DATO DEL NEGOCIO | cola variable]. Al final a propósito: el fijo de siempre queda como
// prefijo byte-idéntico y el dato (estable por tenant+escenario) solo EXTIENDE el prefijo cacheable, nunca lo
// parte. Sin el argumento (default null, todos los callers/gates existentes) el system es byte-idéntico al de hoy.
export function buildNarrateSystemC(persona, memBlock, mode, responsePref, hayContextoVista = false, reparacion = null, datoNegocio = null) {
  const p = _narrateSystemParts(persona, memBlock, mode, responsePref, hayContextoVista, reparacion, datoNegocio);
  return p.fijo + p.variable;
}

// buildNarrateSystemSegments(...) → { fijo, variable } para que el gateway declare el corte del caché donde el
// prefijo deja de ser estable (gatewayCore.js/handleNarrateC arma [{fijo,cache:true},{variable,cache:false}] —
// el MISMO mecanismo que PLAN usa desde 2026-08-10, y el adapter ya sabe concatenar segmentos). `fijo + variable`
// es byte por byte lo que devuelve buildNarrateSystemC: cambia DÓNDE se declara el corte, nunca lo que el
// proveedor lee.
export function buildNarrateSystemSegments(persona, memBlock, mode, responsePref, hayContextoVista = false, reparacion = null, datoNegocio = null) {
  return _narrateSystemParts(persona, memBlock, mode, responsePref, hayContextoVista, reparacion, datoNegocio);
}

// ── DOCTRINA DEL DATO DEL NEGOCIO (AMPLITUD F1, owner 2026-08-13) — viaja SOLO cuando el turno trae la
// proyección (`datoNegocio`), pegada a ella en el segmento FIJO. Deliberadamente corta (<25 líneas) y ADITIVA:
// ninguna sección existente del system se toca — la regla innegociable de cifras de arriba sigue mandando.
const DOCTRINA_DATO_NEGOCIO = `EL DATO DEL NEGOCIO (el bloque que sigue): es tu conocimiento del negocio COMPLETO — qué existe, qué se relaciona, qué tiene sentido. Usalo para ENTENDER y contextualizar: conectar la pregunta con el mapa real del negocio, saber quién es quién, y reconocer cuándo una premisa del usuario no calza con el dato. Cuatro reglas, además de las de siempre:
1. NO CALCULES HACIA LA PANTALLA. Este bloque no te da permiso de aritmética nueva: sigue valiendo solo la suma/resta de cifras autorizadas. Si responder exige una cuenta que no tenés hecha (una proyección, un reparto, un ratio), decí QUÉ cuenta falta y respondé con lo que sí está — jamás la hagas vos.
2. NO CRUCES LOS DOS UNIVERSOS. La sección «LOS DOS UNIVERSOS QUE NO RECONCILIAN» es ley: venta comercial e inventario no se dividen, no se suman y no se relacionan entre sí. Si el usuario pide ese cruce, decliná citando la divergencia.
3. NO AFIRMES LO AUSENTE. Lo que la sección «LO QUE ESTE DATO NO TIENE» declara ausente NO existe: no lo prometas, no lo estimes, no lo reconstruyas. Decliná honesto y redirigí a lo que sí hay.
4. CADA CIFRA CON SU DUEÑO, EN LA MISMA ORACIÓN. Si citás una cifra de este bloque, nombrá a su dueño (el cliente, SKU, marca, familia o bodega; «el negocio» si es un total) en la MISMA oración — una cifra del dato sin su dueño al lado se bloquea. Y el dueño tiene que ser el verdadero: colgarle a una entidad la cifra de otra también se bloquea.
Las cifras del turno («cifras_autorizadas») siguen siendo la fuente primaria de tu respuesta; este bloque es el mapa de fondo.`;

// DOCTRINA DE CONTEXTO DE PANTALLA (owner 2026-08-09, Contrato de Concordancia ADI↔Sentrix) — texto INTACTO del
// bloque que antes se interpolaba en medio del system; ahora vive en una const para poder viajar en el segmento
// VARIABLE (ver PREFIJO ESTABLE arriba) sin partir el prefijo cacheable en dos.
const DOCTRINA_CONTEXTO_VISTA_NARRAR = `CONTEXTO DE PANTALLA (llega en "contexto_vista"): el usuario te está escribiendo DESDE Sentrix y esa línea dice qué vista, sección, componente, métrica, eje, período, escenario, universo y filtros tiene delante en este momento. Usalo para dos cosas y solo dos: (a) resolver a qué apunta "este gráfico"/"esta tabla"/"ese punto"/"estos clientes"/"esos SKU", y (b) hablar de LO QUE ESTÁ MIRANDO en vez de abrir un tema distinto. NO TRAE NINGUNA CIFRA y jamás derives una de ahí —ni un total, ni un conteo, ni un porcentaje—: todas las cifras siguen saliendo de "cifras_autorizadas", verbatim. Tampoco describas la interfaz ("el gráfico tiene tres series"): explicá el NEGOCIO que ese componente mide. Y si el usuario nombra otra cosa, manda lo que pide AHORA — la pantalla informa, nunca decide por él.`;

// `mode` queda en la firma y NO se lee: ver el bloque PREFIJO ESTABLE arriba — el dispatch viaja completo siempre.
function _narrateSystemParts(persona, memBlock, mode, responsePref, hayContextoVista, reparacion, datoNegocio = null) {
  const doctrinaReparacion = buildRepairNarrateDoctrine(reparacion);
  const fijoBase = `${persona}

TU TAREA (narrar): sos la voz de ADI —un CONTROLLER SENIOR con mirada de CFO— que le habla al dueño del negocio. El motor ya calculó y validó TODO; vos NO muestras datos: armás la DECISIÓN. Interpretás, relacionás, aconsejás. Tu valor es el criterio ejecutivo, no repetir la tabla.

REGLA INNEGOCIABLE DE CIFRAS: escribí SOLO cifras que estén en "cifras_autorizadas", verbatim y con su unidad ($, K, M, %, x, d). PODÉS SUMAR o RESTAR cifras autorizadas para una lectura (una brecha, un total, "juntos $3.5M") — el motor lo valida. Lo que NO podés: inventar una cifra que no salga de ese conjunto, cambiarle la unidad, colgarle a una entidad la cifra de otra, ni MULTIPLICAR/PROYECTAR (una recuperación en pesos tipo "recuperás $1.5M si subís el margen" es brecha% × ventas — NO está autorizada y se bloquea). Para DIMENSIONAR una acción cuando no tenés el peso: usá la BRECHA en puntos/% que SÍ podés restar (ej. "X% vs tu benchmark de Y% — Z puntos de brecha"), no un peso inventado.
  ⚠ EL ERROR MÁS FRECUENTE — LA PROPORCIÓN DE ADORNO. Al recomendar, NO le cuelgues a la acción un porcentaje que no está en el dato: "los cinco SKU que explican el 70% de las ventas", "los clientes que representan el 60% de la brecha", "recuperar al menos un 10% del margen", "apuntá a mejorar un 5%" — NI reformulada en "puntos porcentuales" para esquivar el "%" ("establecé un objetivo de subir 5 puntos porcentuales" es el MISMO invento con otra ropa). Esas cifras suenan bien y son INVENTADAS — te van a rebotar y el turno se pierde. Una participación (share) o una meta de recuperación SOLO se escriben si vienen en cifras_autorizadas. Si no las tenés, nombrá la acción SIN el porcentaje: "empezá por los cinco SKU de mayor contribución" (no "…que explican el 70%"), "cerrá la brecha con el Cliente A y el Cliente B" (no "…que son el 60%"). La acción bien nombrada no necesita una cifra falsa. Los números dentro de "datos.facts" son para que RAZONES el patrón; si vas a escribir uno, tiene que estar (o derivarse por suma/resta) de cifras_autorizadas.

${buildModeDispatch()}

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
facts.capitalLigado — inventario inmovilizado del NEGOCIO que el motor pudo relacionar con el surtido de ese
cliente; llega SÓLO cuando el dato sostiene esa relación, y trae en facts.capitalLigado.relacion de qué
naturaleza es — owner 2026-08-07, "eso nos hace diferentes"): con estos datos disponibles, el mecanismo agregado (carga/acciones comerciales en %) YA NO es
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
  DE QUÉ NATURALEZA ES ESA RELACIÓN lo dice facts.capitalLigado.relacion, y CAMBIA lo que podés afirmar (owner
  2026-08-09, decisión 9): con "observada" el dato registra qué SKU se le vendió a esa cuenta y vale la frase de
  arriba; con "afinidad_modelada" la relación es una ESTIMACIÓN, no una venta registrada — ahí decilo así ("son
  SKU asociados a su surtido por afinidad estimada") y nunca la presentes como el surtido comprobado del cliente.
  Si facts.capitalLigado NO llegó, es porque el dato no sostiene esa relación: NO la supongas ni la reconstruyas
  desde el inventario global — el capital inmovilizado del negocio no se vuelve del cliente por nombrarlo cerca.
  Si tenés una acción sobre el mecanismo Y esto además trae algo real, dale su propio espacio como una SEGUNDA
  acción concreta (un segundo frente, no un aparte apurado) — nombrá el/los SKU, su $ y sus días sin venta;
  nunca lo omitas si está en la boleta, y nunca lo mezcles con la brecha de margen (son dos cosas distintas: una
  es rentabilidad de la cuenta, la otra es capital inmovilizado en tu inventario).
  Con composición Y capital ligado juntos, la respuesta sigue siendo PROPORCIONAL (ver LA ESTRUCTURA arriba):
  el titular es la lectura del mix, el mecanismo la refuerza con su cifra, y el capital ligado cierra como
  segunda acción — no una lista de cada número que tenés disponible.

HONESTIDAD (sos asesor, no buscador): si TODO lo pedido vino "disponible":false, NUNCA cortes con un "no" seco ni jerga ("granularidad atómica"): decí en una frase simple qué no tenés y por qué (si el dato trae "limite_temporal"/"motivo", usá ESA razón — ej. "el resultado mes a mes no lo tengo: los gastos son % sobre la venta anual"), y ofrecé lo que SÍ (coverage.alternativas) o repreguntá corto. EL MES A MES SÍ EXISTE para ventas y contribución (viene por trend) → narralo, no lo niegues. NO PROYECTES A FUTURO (no hay serie a futuro): si piden el pronóstico / "el mes que viene", decilo en una frase y ofrecé la evolución hasta hoy. NUNCA le pongas etiqueta de "mensual" a una foto que NO es mensual, NUNCA fabriques cifras por mes. Registro ejecutivo neutro LatAm, sin slang ni inglés (capital/valor no "plata"; capital detenido no "dormido"; acción/medida no "palanca"; potencial no "upside").

`;
  // EL DATO DEL NEGOCIO AL FINAL DEL FIJO (AMPLITUD F1): [persona+doctrina | EL DATO | cola variable]. La
  // proyección es estable por tenant+escenario, así que el fijo entero sigue siendo byte-estable entre turnos y
  // modos — solo cambia (y rompe el caché una vez) cuando cambia el tenant o el escenario, que es exactamente
  // cuando el dato ES otro. Sin `datoNegocio` (default de todos los callers viejos): fijo byte-idéntico al de hoy.
  const fijo = datoNegocio ? `${fijoBase}${DOCTRINA_DATO_NEGOCIO}\n\n${datoNegocio}\n\n` : fijoBase;
  // LA COLA VARIABLE — todo lo que depende del turno o de la sesión, en el MISMO orden de precedencia que tenían
  // sus bloques (reparación → preferencia → pantalla → memoria → instrucción de cierre). Es lo único que el caché
  // no cubre, y por diseño: acá romper el prefijo ya no rompe nada, el segmento fijo quedó entero arriba.
  const variable = `${doctrinaReparacion ? `\n${doctrinaReparacion}\n` : ""}${isDefaultPref(responsePref) ? "" : `\n${buildPrefDispatch()}\n`}${hayContextoVista ? `${DOCTRINA_CONTEXTO_VISTA_NARRAR}\n\n` : ""}${memBlock ? memBlock + "\n\n" : ""}Escribí SOLO la respuesta de ADI, sin preámbulos.`;
  return { fijo, variable };
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
// ── LOS BACKSTOPS CEDEN ANTE LA POLÍTICA DECIDIDA (owner 2026-08-10, certificación live · defecto A4) ─────────
// EL DEFECTO, y es del motor, no del narrador: con `tablePolicy:"required"` el turno BORRABA la tabla que el
// narrador había armado —cualquiera de los tres backstops de abajo— y tres líneas después guardC rechazaba la
// misma narración por `tabla-faltante`. El narrador no podía ganar: cumplía, se le borraba el cumplimiento, y se
// le cobraba el incumplimiento. Por eso "el narrador incumple" era una lectura equivocada del síntoma.
//
// LA DIVERGENCIA CONCRETA que lo hacía posible: `resolveTablePolicy` devuelve `required` por TRES caminos
// (pidió tabla · pidió la serie mes a mes · pidió el desglose), pero `stripSingleRowTables` solo se eximía por el
// PRIMERO —`isExplicitTableRequest`, que busca la palabra "tabla" literal—, `stripRedundantTemporalTable` no se
// eximía nunca (y "mes a mes" es justamente uno de los caminos a `required`), y `stripPerfilCompletoTable`
// tampoco. Tres criterios distintos sobre la misma decisión.
//
// LA REGLA, una sola y en los tres: si la política del turno EXIGE la tabla, ningún backstop la borra. `required`
// no es una preferencia del narrador — es la decisión sellada del turno (politicaExtension.tablePolicy) y la
// misma que guardC valida. Default "auto" a propósito: los callers y gates que no pasan el argumento producen el
// MISMO resultado byte a byte que antes.
export function stripSingleRowTables(text, userText, tablePolicy = "auto") {
  if (tablePolicy === "required") return String(text || "");
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
// `tablePolicy` (owner 2026-08-10, defecto A4 — ver el bloque de stripSingleRowTables): "pedí el mes a mes" es
// uno de los tres caminos a `required`, así que este backstop y la política chocaban de frente justo en el turno
// que más los enfrenta. Con la tabla EXIGIDA, se conserva; el duplicado con la tarjeta de `trend` es un costo
// menor que responder en prosa lo que se pidió tabulado, y es lo que el guard exige.
export function stripRedundantTemporalTable(text, results, tablePolicy = "auto") {
  if (tablePolicy === "required") return String(text || "");
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
// `tablePolicy` (owner 2026-08-10, defecto A4 — ver el bloque de stripSingleRowTables): éste era el más duro de
// los tres, porque borra CUALQUIER tabla sin mirar su contenido. «Dame la tabla completa de Falabella» es a la vez
// un perfil completo (el plan trae composición/capital ligado) y un pedido explícito de tabla: la respuesta se
// borraba entera y el turno terminaba rechazado por no traerla. `required` gana — la Ficha sigue siendo el lugar
// del detalle, pero cuando el usuario pide la tabla con todas las letras, se le da.
export function stripPerfilCompletoTable(text, plan, tablePolicy = "auto") {
  if (tablePolicy === "required") return String(text || "");
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
  return `${s.trim()}\n\n¿Quieres que lo repase de otra forma, o seguimos con el siguiente paso?`;
}

// ensureTransferenciaDeclarada(text, results, question) → GARANTÍA determinística del defecto C1 de la
// certificación live (owner 2026-08-10). A «¿puedo mover el stock lento de Valparaíso a Santiago?» la respuesta
// abrió con el diagnóstico del capital y nunca contestó la decisión. El owner: "debe evaluar o declinar
// explícitamente: si no hay inventario del mismo SKU en origen y destino, decirlo y explicar qué información
// falta". Mismo patrón que TODA esta familia de garantías (período, hipótesis, clarify): doctrina en el prompt
// —la `nota` que declara `inventoryStatus`— MÁS backstop de código, nunca doctrina sola.
//
// DOS ARREGLOS EN UNO, porque son dos mitades del mismo requisito:
//   (a) si no hay declaración, se ANTEPONE — la decisión va primero, que es la promesa del producto (01 QUÉ ESTÁ
//       PASANDO va después de contestar lo que se preguntó, no antes).
//   (b) si hay declaración pero no dice QUÉ FALTA, se agrega esa mitad. Declinar sin nombrar el faltante deja al
//       que decide sin saber si el límite es del dato o del producto.
// CERO TEXTO INVENTADO: el "qué falta" sale de `limite_transferencia.faltante`, que lo cuenta
// `transferenciaCapability` sobre las filas del escenario activo. Sin cifras, así que no agrega nada que el guard
// deba autorizar. Y no cuesta ni una llamada: por eso el chequeo 19 de guardC nunca tiene que rechazar un turno.
export function ensureTransferenciaDeclarada(text, results, question) {
  const s = String(text || "");
  const lim = limiteTransferenciaDeclarado(results);
  if (!lim || !preguntaPorTraslado(question, results)) return s;
  const falta = lim.faltante ? ` Para poder evaluarla haría falta ${lim.faltante}.` : "";
  if (!declaraLimiteTransferencia(s)) {
    const decl = `No puedo evaluar mover ese stock entre bodegas: con este dato no hay dos colocaciones del mismo producto que comparar, así que no tengo con qué comprobar que el movimiento convenga.${falta}`;
    return s.trim() ? `${decl}\n\n${s.trim()}` : decl;
  }
  if (lim.faltante && !/haría falta|hace falta|falta(?:ría)? (?:el|la|saber|tener)/i.test(s)) return `${s.trim()}${falta}`;
  return s;
}

// ── ESTATUS EPISTÉMICO · PRESENTACIÓN detrás de flag, SELLO siempre (owner 2026-08-07) ─────────────────────────
// EL SELLO ES ESTRUCTURAL Y NO SE APAGA: cada claim lleva su `estatus` probado|indicado|abierto, derivado del fig
// (tiene `formula`, o `source !== "actual"`), sellado en el NarrationContract, presente en `r.claims` y en el
// payload claims-only. Esto de acá NO es el sello — es solo su PRESENTACIÓN en el texto, y va apagada por default.
//
// POR QUÉ IMPORTA EL SELLO (el caso real): marginRead autoriza "Falabella · Valor en juego $1.6M" con fórmula
// `venta × benchmark − contribución`. Narrado suelto, se lee como plata YA perdida. No lo es: es lo que habría si
// el cliente rindiera como el benchmark. La misma clase de error que los $194K atribuidos a toda la brecha.
//
// POR QUÉ LA PRESENTACIÓN VA APAGADA (owner, 2026-08-07, revisión de Fase 4): "la graduación debe integrarse
// naturalmente en la oración, por ejemplo 'valor estimado en juego', no como una nota técnica que vuelva robótica
// la respuesta. La fórmula completa puede vivir en Sentrix." El pie `_Cómo se calcula: …_` que arma esta función
// es PROVISIONAL y NO va a producción con esta forma.
//
// CONTRATO PARA QUIEN LA ACTIVE (ver ADI_EPISTEMIC_NOTE_ENABLED en voiceFlags.js): el camino correcto NO es seguir
// pegando prosa post-hoc, es graduar EN EL ORIGEN — que la etiqueta autorizada del fig diga "Valor estimado en
// juego". Ahí el narrador escribe la graduación naturalmente porque es la cifra que tiene autorizada, sin ninguna
// cirugía sobre el texto, y la fórmula completa se muestra en Sentrix. Esta función queda como red, no como plan.
//
// DETERMINÍSTICO: el disparador NO es lingüístico. Es `estatus === "indicado"`, que sale del fig — nunca del texto.
// Lo único que se mira en el texto es si el VALOR aparece citado (búsqueda literal del string ya formateado, la
// misma verdad que cita el guard).
//
// ALCANCE: solo `full`. data_only/results_only/action_only tienen contrato ESTRICTO (nada de prosa fuera de su
// bloque) y una nota los violaría — ahí el hueco queda abierto a propósito y está reportado como residual.
function _escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
export function gradeIndicatedClaims(text, claims, contentScope = "full", enabled = ADI_EPISTEMIC_NOTE_ENABLED) {
  const s = String(text || "");
  if (!enabled) return s;   // default: el sello sigue en los claims, pero NADA visible en la respuesta
  if (contentScope !== "full" || !s.trim() || !Array.isArray(claims) || !claims.length) return s;
  const notas = [];
  const vistos = new Set();
  for (const c of claims) {
    if (!c || c.estatus !== "indicado" || !c.valor) continue;
    const clave = `${c.etiqueta}|${c.valor}`;
    if (vistos.has(clave)) continue;
    // El valor tiene que estar REALMENTE citado: si el narrador no lo usó, no hay nada que graduar. La lookahead
    // rechaza solo la CONTINUACIÓN de un número ($1.6M dentro de $1.6M2, o "1.6" dentro de "1.65") — nunca un punto
    // final de oración (bug cazado por el gate: "asciende a $1.6M." no matcheaba con `(?![\d.,])`).
    if (!new RegExp(`(^|[^\\d.,])${_escRe(String(c.valor))}(?!\\d|[.,]\\d)`).test(s)) continue;
    vistos.add(clave);
    const quien = c.etiqueta ? ` (${c.etiqueta})` : "";
    const comoSale = c.formula ? ` — se obtiene de ${c.formula}` : "";
    notas.push(`${c.valor}${quien} es una cuenta sobre el dato${comoSale}, no una cifra ya realizada.`);
  }
  if (!notas.length) return s;
  const nota = `_Cómo se calcula: ${notas.join(" ")}_`;
  // DÓNDE VA LA NOTA (defecto cazado por _oracle_multimodo_gate en la suite completa): pegada al final rompía dos
  // garantías que ya existían — el contrato CLARIFY exige cerrar con una pregunta guía (ensureClarifyClosingQuestion)
  // y bajo `full` el último párrafo suele ser la oferta de siguiente paso. Una nota de método DESPUÉS de la pregunta
  // la entierra, además de romper el chequeo. Si el último párrafo es una pregunta, la nota va ANTES; si no, al final.
  const bloques = s.trim().split(/\n{2,}/);
  const ultimo = bloques[bloques.length - 1] || "";
  if (/\?\s*$/.test(ultimo)) { bloques.splice(bloques.length - 1, 0, nota); return bloques.join("\n\n"); }
  return `${s.trim()}\n\n${nota}`;
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
/* ══ EL TERCER UNIVERSO · LA MARCA ES DEL PRODUCTO, NO DEL NARRADOR (Contrato v1.2 §5.1, owner 2026-08-10) ══════
 * "Queda marcada como suya en CADA lugar donde aparezca · todo cálculo derivado hereda su procedencia y se
 * presenta como escenario o estimación."
 *
 * Esas dos son obligaciones de PRESENTACIÓN, y por eso las cumple el renderer y no el guard. La primera versión
 * se las exigía al narrador con tres listas cerradas de frases: rechazaba «la cifra que me pasaste» por no decir
 * «tu dato» —una respuesta correcta, un reintento pagado— y dejaba pasar «el total queda en $37.8M» por no usar
 * el verbo "sumar". Mirar las palabras era el problema, no las palabras elegidas.
 *
 * Acá no se juzga nada: se ESTAMPA. Toda aparición de una cifra del usuario recibe su marca, y toda cifra que la
 * ARITMÉTICA muestra derivada de ella recibe la de estimación. Es el mismo mecanismo y el mismo lugar del pipeline
 * que `gradeIndicatedClaims` (el sello epistémico): corre sobre el texto FINAL, después del guard, y no depende de
 * que el LLM se haya acordado. Con eso, "el producto nunca presenta como propia una cifra que salió del usuario"
 * deja de ser una regla que se verifica y pasa a ser una propiedad que se construye.
 *
 * IDEMPOTENTE: si el narrador YA declaró la procedencia en esa oración —cosa que la doctrina le pide igual, para
 * que la respuesta se lea natural y no como un formulario— no se agrega nada. La marca es la red, no el mecanismo.
 */
const MARCA_USUARIO = "tu dato";
const MARCA_DERIVADA = "estimado sobre tu supuesto";
// reconocimiento MÍNIMO de "ya está declarado", y su alcance es deliberadamente chico: no pretende cubrir toda
// forma de decirlo (esa era la trampa anterior), solo evitar la redundancia obvia cuando el narrador usó la misma
// palabra que usaríamos nosotros. Si no la reconoce, el resultado es una marca de más — nunca un rechazo.
const _YA_DECLARADO_RE = /\btu\s+(?:dato|cifra|n[uú]mero|supuesto|estimaci[oó]n)\b|\baportaste\b|\bque\s+me\s+pasaste\b/i;
const _YA_ESTIMADO_RE = /\bestimad|\bescenario\b|\bhip[oó]tesis\b/i;

export function markUserProvenance(text, reparacion, figsMotor) {
  const supFigs = cifrasDelUsuario(reparacion);
  if (!supFigs.length) return text;
  const original = String(text || "");
  if (!original.trim()) return text;
  const canonMotor = new Set((figsMotor || []).map((f) => f.canon));
  // una cifra del usuario que COINCIDE con la del motor no es del usuario: no hay procedencia que separar, y
  // marcarla ensuciaría una oración legítima sobre el dato propio del producto.
  const canonUsuario = new Set(supFigs.map((f) => f.canon).filter((c) => !canonMotor.has(c)));
  if (!canonUsuario.size) return text;

  // se recorre oración por oración y se reescribe SOLO la que necesita marca (el resto queda byte-idéntico).
  const partes = [];
  let cursor = 0;
  for (const [lo, hi] of _oracionesDe(original)) {
    if (lo > cursor) partes.push(original.slice(cursor, lo));
    const oracion = original.slice(lo, hi);
    cursor = hi;
    const figs = parseFigures(oracion);
    if (!figs.length) { partes.push(oracion); continue; }
    const propias = figs.filter((f) => canonUsuario.has(f.canon));
    const derivadas = figs.filter((f) => !canonUsuario.has(f.canon) && !canonMotor.has(f.canon) && _derivadaDeSupuesto(f, supFigs, figsMotor || []));
    let marca = null;
    if (propias.length && !_YA_DECLARADO_RE.test(oracion)) marca = MARCA_USUARIO;
    else if (!propias.length && derivadas.length && !_YA_ESTIMADO_RE.test(oracion)) marca = MARCA_DERIVADA;
    else if (propias.length && derivadas.length && !_YA_ESTIMADO_RE.test(oracion)) marca = MARCA_DERIVADA;
    partes.push(marca ? _conMarca(oracion, marca) : oracion);
  }
  if (cursor < original.length) partes.push(original.slice(cursor));
  return partes.join("");
}
// _conMarca(oracion, marca) → la marca entra ANTES del cierre de la oración, entre paréntesis, para que se lea
// como una nota del producto y no como parte de la afirmación. Una fila de tabla markdown no tiene cierre: ahí la
// marca va al final de la celda, que sigue siendo el lugar donde el lector la ve pegada a la cifra.
function _conMarca(oracion, marca) {
  const m = /([.!?])(\s*)$/.exec(oracion);
  if (m) return `${oracion.slice(0, m.index)} (${marca})${m[1]}${m[2]}`;
  const trailing = /(\s*)$/.exec(oracion)[1] || "";
  return `${oracion.slice(0, oracion.length - trailing.length)} (${marca})${trailing}`;
}
// _oracionesDe(text) → los MISMOS límites que usa guardC (calculados sobre el texto con las cifras enmascaradas,
// para que el punto decimal de "$13.3M" no parta una oración). Se replica el criterio, no se importa, porque el
// del guard es privado; el gate verifica que los dos coincidan sobre los mismos casos.
const _SENT_END_R = /[.!?\n]/;
function _oracionesDe(text) {
  const s = String(text || "");
  let masked = s;
  for (const f of parseFigures(s)) {
    let from = 0, i;
    while ((i = masked.indexOf(f.text, from)) >= 0) {
      masked = masked.slice(0, i) + "#".repeat(f.text.length) + masked.slice(i + f.text.length);
      from = i + f.text.length;
    }
  }
  const out = [];
  let start = 0;
  for (let i = 0; i < masked.length; i++) {
    if (_SENT_END_R.test(masked[i])) { if (i + 1 > start) out.push([start, i + 1]); start = i + 1; }
  }
  if (start < masked.length) out.push([start, masked.length]);
  return out;
}

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
// EL CONCEPTO ES EL DEL FOCO (owner 2026-08-09, certificación de las preguntas de inventario): `composeSpecInventory`
// emitía `· Capital detenido` para los CUATRO focos, así que este detector —y el encabezado literal que impone—
// nombraban "Capital detenido" también sobre las cifras de riesgo de quiebre y de sobrestock. Corregida la etiqueta
// en el origen, acá se reconoce la FAMILIA de conceptos del detector de inventario y se devuelve el que el ledger
// realmente trae, para que el encabezado impuesto sea el del dato. `Capital detenido` (foco frenado/stale, el único
// caso medido en los gates) produce una instrucción BYTE-IDÉNTICA a la anterior.
const _CONCEPTOS_INVENTARIO = ["Capital detenido", "Riesgo de quiebre", "Sobrestock", "Capital sano"];
function _conceptoCapitalDeFigs(figs) {
  if (!_needsTableFormat(figs)) return null;
  if (!Array.isArray(figs)) return null;
  const concepto = _CONCEPTOS_INVENTARIO.find((c) => figs.some((f) => f && new RegExp(` · ${c}$`).test(f.label || "")));
  if (!concepto) return null;
  const hasPctDelTotal = figs.some((f) => f && / · % del total$/.test(f.label || ""));
  return hasPctDelTotal ? concepto : null;
}
function _needsCapitalColumnNames(figs) { return !!_conceptoCapitalDeFigs(figs); }
const _capitalColumnsInstruction = (concepto) => CAPITAL_COLUMNS_INSTRUCTION_TPL.split("{CONCEPTO}").join(concepto || "Capital detenido");
const CAPITAL_COLUMNS_INSTRUCTION_TPL = "Tus cifras_autorizadas traen \"{CONCEPTO}\" y \"% del total\" por entidad (bodega o SKU) — armá la tabla con ESTOS 3 encabezados LITERALES, en este orden: \"Bodega\" o \"SKU\" (el que corresponda) | \"{CONCEPTO}\" | \"% del total\". No los reformules ni los traduzcas (nunca \"Capital Inmovilizado (USD)\", nunca \"Porcentaje del total (%)\"). El % NUNCA lo calculás vos NI lo completás de otra cifra suelta: si una entidad NO tiene su propia cifra \"Entidad · % del total\" autorizada, esa entidad NO va en la tabla de porcentajes — nunca uses una cifra sin ese formato exacto (ej. una cifra llamada solo \"pct\", sin nombre de entidad) para rellenar el % de una fila, aunque el número parezca coincidir. Si tenés cifras de bodegas Y de SKU a la vez, armá DOS TABLAS separadas (una con encabezado de fila \"Bodega\", otra con \"SKU\") — nunca las mezcles bajo un solo encabezado, cada una suma 100% por sí sola. ESTA REGLA DE LAS DOS TABLAS NO CAMBIA por lo que sigue abajo sobre causa y acción: si tenés 2+ SKU con \"{CONCEPTO}\"+\"% del total\" propios, la tabla de SKU es SIEMPRE obligatoria — nombrar la causa en prosa es ADEMÁS de esa tabla, nunca en vez de ella. Si el alcance ya viene acotado a UNA sola bodega (ej. \"cuánto capital tengo en Valparaíso\"), esa bodega NO tiene cifra de \"% del total\" autorizada a propósito (es obvio que es el 100%, no hace falta cifra) — esa bodega es una fila única, no le armes tabla ni le inventes un %: decilo en una frase (\"tenés $X en Valparaíso\"); si esos mismos datos SÍ traen 2+ SKU dentro de esa bodega, esa es la tabla que corresponde armar (encabezado \"SKU\"), no la de bodega.\n  NINGUNA TABLA ES EL CIERRE: arma TODAS las tablas que correspondan (bodega y/o SKU, según la regla de arriba) y DESPUÉS, en prosa corrida (sin encabezados tipo \"Por qué:\"), agregá lo que las tablas no dicen — tenés \"Rotación\", \"Días de inventario\" y \"Días sin venta\" por SKU ya autorizados: usalos para explicar la causa (ej. \"rotación de 1.0x y 165 días de inventario — prácticamente no se mueve\") y para nombrar el SKU puntual con más $ o más días sin venta como la acción a priorizar, con su monto. Un cierre que solo repite el total y pregunta \"¿querés que profundicemos en los SKU?\" está incompleto — YA tenés esos SKU en tus cifras_autorizadas, nómbralos ahora, no los guardes para un turno futuro.";

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
// ── LA CIFRA EN DINERO DE LA BRECHA YA ESTÁ EN LA BOLETA (owner 2026-08-10, auditoría de la 4ª corrida pagada) ──
// LO MEDIDO: de los cinco rechazos del guard de esa corrida, cuatro fueron el narrador calculando un monto por
// MULTIPLICACIÓN —el costo por la venta, el margen por la venta— que el prompt ya prohíbe. Al levantar el ledger
// real de esos turnos apareció la razón: la cifra que estaba tratando de calcular YA ESTABA AHÍ. `marginRead`
// autoriza "Valor en juego" y "Medida · cerrar brecha al piso" —el mismo monto, dos etiquetas— y las dos pasan el
// guard sin problema. El modelo multiplica porque no se da cuenta de que la tiene.
// Por eso esto NO es una regla nueva ni una prohibición más: es señalarle la cifra que ya está autorizada. Viaja
// SOLO cuando la boleta de verdad la trae, como el resto de los refuerzos de forma — un turno sin ella no paga
// un token. Y no toca el guard: si el modelo igual multiplica, el muro lo bloquea igual que hoy.
const _VALOR_EN_JUEGO_RE = /valor en juego|cerrar brecha al piso/i;
function _needsValorEnJuego(figs) {
  return (figs || []).some((f) => f && f.unit === "money" && _VALOR_EN_JUEGO_RE.test(String(f.label || "")));
}
const VALOR_EN_JUEGO_INSTRUCTION = "EL MONTO DE LA BRECHA YA LO TENÉS: tus cifras_autorizadas traen \"Valor en juego\" y/o \"Medida · cerrar brecha al piso\" — ESA es la cifra EN DINERO de lo que se recupera cerrando la brecha de margen, ya calculada y autorizada. Citala tal cual cuando necesites dimensionar la oportunidad en pesos. NO la vuelvas a calcular por tu cuenta: multiplicar el margen, la brecha o el peso del costo por la venta da un número que NO está autorizado, se bloquea, y además ya tenés el bueno al lado. Lo mismo si querés hablar del costo en pesos: si no viene su propia cifra, no lo derives de un porcentaje — nombrá el porcentaje que sí tenés.";

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
// `viewContext`/`formaRespuesta`/`instruccionForma` (owner 2026-08-09, Contrato de Concordancia ADI↔Sentrix): el
// contexto de PANTALLA y la FORMA proporcional del turno. Los tres son OPCIONALES y su ausencia es el default de
// hoy — un turno que no viene de Sentrix y no pidió nada especial produce el MISMO payload byte a byte.
export function buildNarrateUserMessageC({ text, plan, results, ledgerFigs, mem, history, pref, instruccionOrientacion, instruccionDisclosure, tablePolicy = "auto", scenario, requestContext, claimsOnly = false, viewContext = null, formaRespuesta = null, instruccionForma = null }) {
  // CONTRATO v2 · FASE 1 (owner 2026-08-07): el payload deja de armarse desde `plan`/`results` crudos. Se SELLA
  // primero un NarrationContract inmutable (narrationContract.js) y el payload es una PROYECCIÓN PURA de ese
  // contrato — projectNarratePayload no recibe ni puede mirar plan/results. La garantía "el LLM no puede modificar
  // entidades/métricas/períodos/supuestos tras validar" pasa de doctrina de prompt a ESTRUCTURA: no es que el
  // prompt se lo prohíba, es que no hay otra cosa que ver. Esta firma NO cambia (los ~30 callers/gates que la
  // consumen siguen andando igual) y el payload resultante es BYTE-IDÉNTICO al anterior — verificado por
  // _narration_contract_gate.mjs, que compara la proyección contra la construcción legacy caso por caso.
  const contract = buildNarrationContract({ text, plan, results, ledgerFigs, mem, history, pref, instruccionOrientacion, instruccionDisclosure, tablePolicy, scenario, requestContext, viewContext, formaRespuesta, instruccionForma });
  return claimsOnly ? projectClaimsOnlyPayload(contract) : projectNarratePayload(contract);
}

// projectClaimsOnlyPayload(contract) → CONTRATO v2 · el payload SIN NINGUNA FUENTE CRUDA (owner 2026-08-07,
// opción (b): implementado detrás de flag, APAGADO por defecto — ver ADI_CLAIMS_ONLY_ENABLED en voiceFlags.js).
// Diferencia con projectNarratePayload: acá NO viaja `datos` (los facts de las tools) ni el eco del plan. El
// narrador ve EXCLUSIVAMENTE lo que el motor selló y autorizó:
//   alcance · afirmaciones (con estatus epistémico) · relaciones autorizadas · acciones y prioridades permitidas ·
//   supuestos · preguntas abiertas · política de respuesta (modo + densidad + qué NO puede agregar).
// ── PROPORCIONALIDAD SEMÁNTICA · qué de cada cifra viaja al narrador (owner 2026-08-07) ────────────────────────
// EL HUECO QUE CIERRA: `cifras_autorizadas` proyectaba SOLO {etiqueta, valor}. O sea que sellar campos nuevos en
// el claim no servía de nada — el narrador de producción nunca los veía, y la regla volvía a ser doctrina.
// Ahora viajan, pero ESPARCIDOS: solo se emite lo que dice algo. Una cifra normal (ventas de un cliente, probada,
// sin causalidad ni referencia) sigue pesando exactamente {etiqueta, valor} — cero costo de tokens donde no hay
// nada que limitar. Se paga solo en las cifras que de verdad pueden hacer sobre-afirmar.
// ── LA DOCTRINA · se manda SOLO si el turno tiene algo que limitar ─────────────────────────────────────────────
// Cuatro límites, cada uno disparado por un campo REAL del claim — no por el tema de la pregunta. Un turno sin
// causas parciales no recibe el párrafo de causalidad; uno sin referencia no recibe el de procedencia. Mismo
// criterio de economía que buildModeDispatch (owner 2026-08-03, eficiencia Mini): doctrina del turno, no toda.
// Las FORMULACIONES son orientación de voz, NO una lista cerrada ni un reemplazo frase por frase: el narrador
// sigue eligiendo cómo decirlo. Lo que no puede es ampliar sujeto, causalidad, procedencia o nivel financiero.
const _PS = {
  sujeto: "ALCANCE DEL SUJETO. Cada cifra conserva el sujeto que trae en su etiqueta. Si crecieron las ventas A UN CLIENTE, hablá del crecimiento de las ventas a ESE cliente — nunca lo generalices al negocio (\"el negocio está en expansión\" con una sola entidad que crece es falso). Lo mismo con familia, SKU, canal y bodega: la dimensión del dato se conserva. Decí \"las ventas a Falabella crecieron 8,3%\", no \"las ventas crecieron 8,3%\". Cuando la cifra SÍ es del negocio, su semántica lo dice (\"el negocio (no una entidad)\") y ahí sí podés hablar del negocio.",
  causa: "ALCANCE CAUSAL. Una causa marcada `cobertura: parcial` explica UNA PARTE — nunca la presentes como la principal, la total ni la suficiente. Prohibido: \"la principal causa es…\", \"la brecha se debe a…\", \"esto explica toda la diferencia\". Decí que es una causa COMPROBADA de una parte, y dejá el resto abierto: \"una causa comprobada es…\", \"explica una parte de la brecha\", \"es una causa comprobada, pero no la explicación completa\", \"corregirla recupera $X; el resto requiere otro análisis\". Si —y solo si— la semántica de esa cifra te da la fracción (\"explica $X de $Y (Z%)\"), podés cuantificarla con ESOS números. Si te dice que el universo NO está autorizado, NO le pongas número a la parte que falta ni la estimes: \"el resto de la brecha permanece abierto\".",
  referencia: "PROCEDENCIA DE LA REFERENCIA. La vara contra la que se mide el margen la DEFINE EL NEGOCIO del usuario (su criterio, su dato, su meta). Se narra \"tu benchmark\", \"tu referencia\" o \"la meta definida para tu negocio\". NUNCA \"estándar del sector\", \"promedio del mercado\", \"referencia de la industria\" ni \"lo esperable para su categoría\": no hay ninguna fuente sectorial autorizada en el dato, así que decirlo es inventar una autoridad que no existe. Decí \"8,1 puntos bajo tu benchmark de 30,1%\", no \"bajo los estándares del sector\".",
  nivel: "NIVEL FINANCIERO. Cada métrica afirma lo suyo y nada más: venta positiva significa que VENDE; margen positivo, que DEJA MARGEN; contribución positiva, que APORTA CONTRIBUCIÓN. Ninguna de las tres autoriza a decir que una cuenta o el negocio \"es rentable\" o \"es rentable/sana en rentabilidad\" — eso exige un RESULTADO que ya descontó costos Y gastos, y solo podés afirmarlo si tenés una cifra autorizada con `nivel: resultado`. Si no la tenés y el usuario pregunta si conviene la cuenta, respondé con lo que SÍ sabés y nombrá el límite: \"la cuenta deja contribución positiva, pero su margen está bajo tu referencia\" — y decí que para hablar de rentabilidad hace falta el resultado con gastos.",
  cierre: "TRANSVERSAL: no afirmes más de lo que la cifra demuestra. Para lo PROBADO: \"el dato muestra que…\", \"la parte comprobada es…\", \"hoy esta cuenta aporta…\". Para lo INDICADO: \"el patrón sugiere…\", \"hay una señal de presión en…\", \"los datos apuntan a…\", \"conviene profundizar en…\". Para lo ABIERTO: \"el dato disponible no permite aislar todavía…\", \"no hay evidencia suficiente para atribuirlo a…\", \"para confirmarlo falta…\". Y una contribución no capturada NUNCA es una \"pérdida\": es una oportunidad, una brecha o un valor no capturado — no salió de la caja.",
};
/* ══ AFINIDAD ESTIMADA · DOCTRINA CONDICIONAL DE TURNO (owner 2026-08-12) ══════════════════════════════════════
 * MEDIDO: con la boleta llena de figs `indicado` de afinidad cliente×SKU, el narrador escribió dos veces seguidas
 * un texto que el muro rechazó —«reforzar la relación con Lider», «Lider es la cuenta predominante»— y el turno
 * terminó resuelto por el compositor determinístico. El muro y la reparación funcionaron; el modelo no sabía la
 * regla ANTES de escribir, así que la aprendía a golpes, a un reintento por turno.
 * ES CONDICIONAL, Y ESO NO ES UN DETALLE DE COSTO: esta doctrina sólo tiene sentido cuando el turno sirve una
 * relación estimada. Meterla en el system permanente la haría viajar en los miles de turnos que no la necesitan
 * —el mismo error que este archivo ya evitó con la doctrina de reparación y con la de proporcionalidad—, y además
 * le hablaría al narrador de una afinidad que no tiene delante.
 * EL DISPARADOR SALE DEL DATO, no de la pregunta: un claim sellado `indicado` cuya razón declara que el reparto es
 * de afinidad. Es la MISMA condición que usa el muro (`_afinidadComoCompra` en guardC), así que prompt y candado
 * no pueden desincronizarse: lo que se le pide al narrador es exactamente lo que después se le exige. */
const _AFINIDAD_RAZON_RE = /afinidad/i;
export function buildAfinidadDoctrina(claims) {
  const cs = Array.isArray(claims) ? claims : [];
  const hay = cs.some((c) => c && c.estatus === "indicado" && _AFINIDAD_RAZON_RE.test(String(c.estatusRazon || "")));
  if (!hay) return "";
  return "AFINIDAD ESTIMADA, NO VENTA OBSERVADA. Las cifras cliente×SKU de este turno salen de una afinidad de surtido MODELADA: el dato NO registra qué SKU se le vendió a cada cuenta. Entonces: (a) nombralas como CUENTAS CANDIDATAS o SALIDA COMERCIAL POSIBLE — nunca como compras ya ocurridas, ni con «volumen de compra», «cuenta predominante» o «historial»; (b) decí explícitamente que es una estimación de afinidad, aunque el usuario no lo pregunte; (c) si proponés una acción, enmarcala EN LA MISMA ORACIÓN como hipótesis —«una posible salida es…», «habría que validar…», «candidata a…»—: una recomendación pelada sobre una estimación se lee como si el dato la respaldara, y no la respalda. Podés recomendar; lo que no podés es esconder sobre qué te apoyás.";
}

/* ── EL NARRADOR NUNCA VEÍA LO QUE YA HABÍA DICHO (owner 2026-08-12, tercer defecto de la conversación real) ────
 * EL CASO: el owner recibió el análisis de gastos y dos turnos después escribió «el analisis que me diste de
 * gastos, el resultado del negocio». ADI volvió a narrar la lectura entera en vez de ir al nivel que le pidieron.
 * LA CAUSA, medida en las tres capas: `mem.recentNarrations` existe y se mantiene · `guardC` la recibe y detecta
 * la repetición · pero el NARRADOR —el único que podría evitarla— no tenía ni una palabra sobre ella. El array
 * viajaba dentro de `memoria_interaccion` como ruido sin etiqueta, y `renderInteractionMemory` no lo rinde. O sea
 * que el guard avisaba DESPUÉS de escribir, y quien escribía no se enteraba nunca. Es el mismo patrón que este
 * proyecto ya encontró seis veces: la información existe, el consumidor que la necesita no la recibe.
 * POR QUÉ AVISAR Y NO BLOQUEAR: bloquear la repetición está descartado con evidencia (ver `_repetitionVerbatim` en
 * guardC.js) — agotaría los intentos de narrar y caería a una reparación PEOR que la respuesta repetida. La única
 * capa donde esto se arregla de verdad es antes de escribir, no después.
 * SÓLO LAS APERTURAS, nunca el texto completo: alcanzan para que el narrador RECONOZCA lo que ya dijo, no cuestan
 * casi nada, y no le ponen delante un párrafo listo para copiar — que sería empujarlo al defecto que corrige.
 * REPETIR UNA CIFRA O UN NOMBRE SIGUE SIENDO CORRECTO, y la instrucción lo dice: lo que no se repite es LA LECTURA
 * ENTERA. Es la misma distinción que el owner ya fijó en 2026-07-30 y que `_repetitionAdvisory` respeta. */
const _APERTURA_MAX = 120;
export function buildNoRepetirDoctrina(mem) {
  const prev = (mem && Array.isArray(mem.recentNarrations)) ? mem.recentNarrations : [];
  const aperturas = prev
    .map((t) => String(t || "").replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 20)
    .map((t) => (t.length <= _APERTURA_MAX ? t : t.slice(0, t.lastIndexOf(" ", _APERTURA_MAX) + 1 || _APERTURA_MAX).trim() + "…"));
  if (!aperturas.length) return "";
  return `YA LE DIJISTE ESTO, NO SE LO REPITAS. Tus respuestas recientes empezaron así: ${aperturas.map((a) => `«${a}»`).join(" · ")}. El usuario YA TIENE esa lectura delante. Si esta pregunta apunta a lo mismo, NO la vuelvas a narrar entera: reconocé en una frase que ya se la diste y andá DIRECTO al nivel o al detalle que te está pidiendo ahora. Repetir una cifra o el nombre de un cliente es correcto y necesario; lo que no se repite es la lectura completa con otra redacción.`;
}

export function buildProporcionalidadDoctrina(claims) {
  const cs = Array.isArray(claims) ? claims : [];
  if (!cs.length) return "";
  const partes = [];
  if (cs.some((c) => c.sujetoTipo === "entidad") && cs.some((c) => c.sujetoTipo === "negocio")) partes.push(_PS.sujeto);
  else if (cs.some((c) => c.sujetoTipo === "entidad")) partes.push(_PS.sujeto);
  if (cs.some((c) => c.coberturaCausal === "parcial")) partes.push(_PS.causa);
  if (cs.some((c) => c.procedencia)) partes.push(_PS.referencia);
  if (cs.some((c) => c.nivelFinanciero && c.nivelFinanciero !== "resultado")) partes.push(_PS.nivel);
  if (!partes.length) return "";
  partes.push(_PS.cierre);
  return `PROPORCIONALIDAD SEMÁNTICA (nunca afirmes más de lo que la evidencia autorizada demuestra):\n  · ${partes.join("\n  · ")}`;
}

// `ctx` = lo que hace que el sujeto valga la pena decirlo. Repetir "el negocio" 48 veces en un trend de negocio no
// informa nada y solo cuesta tokens (medido); en cambio, en un turno MIXTO (entidades + negocio) o MULTI-EJE es
// justo el dato que evita la generalización. Un `concepto` siempre se marca: es una advertencia, no una etiqueta.
function _ctxSujeto(claims) {
  const cs = Array.isArray(claims) ? claims : [];
  const ejes = new Set(cs.map((c) => c.eje).filter(Boolean));
  return { mixto: cs.some((c) => c.sujetoTipo === "entidad") && cs.some((c) => c.sujetoTipo === "negocio"), multiEje: ejes.size > 1 };
}
function _semanticaDe(cl, ctx = { mixto: true, multiEje: true }) {
  const s = {};
  if (cl.sujetoTipo === "concepto") s.sujeto = "un concepto de la lectura, NO una entidad del dato";
  else if (cl.sujetoTipo === "negocio") { if (ctx.mixto) s.sujeto = "el negocio (no una entidad)"; }
  else if (cl.eje && (ctx.mixto || ctx.multiEje)) s.sujeto = `${cl.entidad} (${cl.eje})`;
  if (cl.estatus === "indicado") s.estatus = "indicado (es una cuenta del motor, no una lectura directa)";
  // CÓMO SE CALCULA · solo para los AGREGADOS DEL NEGOCIO (owner 2026-08-09, certificación de «la rotación media es
  // 6.0x, ¿de dónde sale?»). El fig de cabecera YA declaraba su `formula` desde la decisión 6 —`_figHeadline` la
  // sella— y el claim ya la transportaba, pero la proyección la dejaba afuera: el narrador recibía «Rotación media:
  // 6.0x» junto a las trece rotaciones por SKU y NADA que dijera que es un ponderado por capital. Preguntado de
  // dónde sale, la única salida disponible era adivinar, y la adivinanza natural —el promedio simple de las trece
  // filas, 5,8x— es exactamente la segunda verdad que `sentrix/headline.js` eliminó del producto. Es el mismo hueco
  // que abrió la Proporcionalidad Semántica ("sellar campos nuevos en el claim no servía de nada — el narrador de
  // producción nunca los veía"), con la misma respuesta: viaja, pero ESPARCIDO.
  // POR QUÉ SOLO EL NEGOCIO: medido sobre 434 cifras de 14 familias de tools, 24 declaran fórmula y solo 6 son
  // agregados del negocio (venta total, contribución total, margen promedio, rotación media, las dos varas de
  // POLICY). Un "% del total" de una bodega o un "Valor en juego" de un cliente no necesitan explicar su cuenta —
  // su etiqueta ya la dice— y pagarían tokens sin decir nada. El 1% que sí lo necesita es justo el que la pantalla
  // muestra como cabecera y el usuario interpela por su número.
  if (cl.formula && cl.sujetoTipo === "negocio") s.calculo = cl.formula;
  if (cl.procedencia === "interna_empresa") s.referencia = "la define tu negocio — nunca la llames sectorial, de industria ni de mercado";
  if (cl.nivelFinanciero) s.nivel = cl.nivelFinanciero;
  if (cl.coberturaCausal === "parcial") {
    s.cobertura = cl.explica && cl.explica.fraccion
      ? `parcial — explica ${cl.explica.monto} de ${cl.explica.universo} (${cl.explica.fraccion}); el resto queda abierto`
      : "parcial — explica UNA PARTE comprobada; el universo total NO está autorizado en este turno, así que NO le pongas número a la fracción ni digas que es la causa principal";
  }
  return s;
}

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
    // CONTEXTO DE PANTALLA (Concordancia ADI↔Sentrix): UNA línea, ≤240 caracteres, SIN cifras — dice qué está
    // mirando el usuario, nunca cuánto vale. Ver la nota extensa en projectNarratePayload, más abajo.
    ...(_lineaVista(scope) ? { contexto_vista: _lineaVista(scope) } : {}),
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
    // PREGUNTAS ABIERTAS · lo que el turno NO pudo contestar. En claims-only viaja el MOTIVO y la alternativa,
    // nunca el NOMBRE INTERNO de la tool: ese es el eco del plan, exactamente la fuente cruda que este modo
    // promete no mandar (y que `_claims_only_gate` vigila en todo el árbol). Se veía recién ahora porque hasta
    // que `entityCapitalLigado` empezó a declinar honesto (decisión 9), ningún plan del gate producía una.
    ...(Array.isArray(c.preguntasAbiertas) && c.preguntasAbiertas.length
      ? { preguntas_abiertas: c.preguntasAbiertas.map(({ tool: _t, ...q }) => q) } : {}),
    politica_respuesta: c.politicaExtension || {},
    // las instrucciones de FORMA siguen siendo decisiones del motor (no fuentes crudas) — se conservan para que
    // la comparación de calidad contra el modo actual sea justa: solo cambia el ORIGEN del contenido, no la forma.
    ...(!isDefaultPref(pref) ? { preferencia_respuesta: { alcance: pref.contentScope || "full", detalle: pref.detailLevel || "standard" } } : {}),
    ...(pref && pref.contentScope && pref.contentScope !== "full" && blockInstructionFor(pref.contentScope) ? { instruccion_formato: blockInstructionFor(pref.contentScope) } : {}),
    ...(pref && pref.detailLevel === "brief" ? { instruccion_brevedad: BRIEF_INSTRUCTION } : {}),
    // tabla_permitida:false → NO se manda ninguna instrucción de tabla. Mandarla sería pedirle al narrador
    // exactamente lo que guardC va a bloquear: el prompt y el candado tienen que decir lo MISMO.
    ...(_politicaTabla(c) === "forbidden" ? {} : (modo === "clarify" ? {} : (_needsTableFormat(figLabels) ? { instruccion_tabla: modo === "decision" ? TABLE_INSTRUCTION_DECISION : TABLE_INSTRUCTION } : {}))),
    ...(_needsListFormat(figLabels) ? { instruccion_lista: LIST_INSTRUCTION } : {}),
    ...(_needsBrechaReinforcement(figLabels) ? { instruccion_brecha: BRECHA_INSTRUCTION } : {}),
    // LA CIFRA EN DINERO DE LA BRECHA, señalada en vez de recalculada (ver _needsValorEnJuego arriba).
    ...(_needsValorEnJuego(figLabels) ? { instruccion_valor_en_juego: VALOR_EN_JUEGO_INSTRUCTION } : {}),
    ...(_conceptoCapitalDeFigs(figLabels) ? { instruccion_columnas_capital: _capitalColumnsInstruction(_conceptoCapitalDeFigs(figLabels)) } : {}),
    ...(forma.instruccionOrientacion ? { instruccion_orientacion: forma.instruccionOrientacion } : {}),
    ...(forma.instruccionDisclosure ? { instruccion_divulgacion: forma.instruccionDisclosure } : {}),
    // CONTRATO DE RESPUESTA PROPORCIONAL (owner 2026-08-09) — ver projectNarratePayload para la nota completa.
    ...(forma.instruccionForma ? { instruccion_forma_respuesta: forma.instruccionForma } : {}),
    // PROPORCIONALIDAD SEMÁNTICA (owner 2026-08-07): doctrina de NIVEL DE TURNO, no del system — solo viaja si
    // ESTE turno tiene algo que limitar (ver buildProporcionalidadDoctrina). Turno sin causas parciales, sin
    // referencia y sin niveles de cascada → cadena vacía → la clave ni aparece.
    ...(buildProporcionalidadDoctrina(claims) ? { instruccion_proporcionalidad: buildProporcionalidadDoctrina(claims) } : {}),
    // AFINIDAD ESTIMADA · misma mecánica que la línea de arriba: doctrina de TURNO, la clave ni aparece si el
    // turno no sirve una relación modelada. Ver buildAfinidadDoctrina.
    ...(buildAfinidadDoctrina(claims) ? { instruccion_afinidad: buildAfinidadDoctrina(claims) } : {}),
    // REPARACIÓN CONTEXTUAL (Contrato v1.2) — viaja igual en este modo: es una DECLARACIÓN sellada del contrato
    // (qué clase de turno es, y de quién es cada cifra), no una fuente cruda. Sin ella, claims-only no podría
    // distinguir una corrección de un desacuerdo ni marcar el tercer universo, que es justo lo que §5.1 exige.
    ...(c.reparacion ? { reparacion: c.reparacion } : {}),
    ...(hilo_reciente.length ? { hilo_reciente } : {}),
    cifras_autorizadas: claims.map((cl) => ({ etiqueta: cl.etiqueta, valor: cl.valor, ..._semanticaDe(cl, _ctxSujeto(claims)) })),
    // NO REPETIR LO YA NARRADO — viaja en los DOS modos a propósito. Si sólo se cableara el payload de abajo,
    // encender ADI_CLAIMS_ONLY_ENABLED apagaría este arreglo en silencio, que es exactamente la clase de defecto
    // que este proyecto ya encontró seis veces. Ver buildNoRepetirDoctrina.
    ...(buildNoRepetirDoctrina(c.memoria) ? { instruccion_no_repetir: buildNoRepetirDoctrina(c.memoria) } : {}),
    ...(c.memoria ? { memoria_interaccion: c.memoria } : {}),
  };
}

// projectNarratePayload(contract) → el OBJETO de datos para la Pasada 2, derivado EXCLUSIVAMENTE del contrato
// sellado. Es la frontera dura del contrato v2: si un dato no está en el contrato, el narrador no lo ve. Pura.
const _politicaTabla = (c) => ((c && c.politicaExtension && c.politicaExtension.tablePolicy) || "auto");
// _lineaVista(scope) → la ÚNICA forma en que el contexto de pantalla llega al LLM: una oración de ≤240 caracteres,
// proyectada por viewContext.js del ViewContext sellado (`scope.vista`, ver sealScopeContract · mejora A).
// LO QUE NO VIAJA, y es la mitad del contrato: filas, tablas, series, la salida del builder, la lista de entidades,
// cifras formateadas, los controles crudos ni el objeto ViewContext. El contexto IDENTIFICA qué está mirando el
// usuario; las cifras siguen saliendo EXCLUSIVAMENTE de cifras_autorizadas. Null en todo turno que no venga de
// Sentrix — que es el default, y por eso un turno normal no agrega ni una llave al payload.
const _lineaVista = (scope) => ((scope && scope.vista) ? projectViewContextForPlan(scope.vista) : null);
const TABLA_OBLIGATORIA_INSTRUCTION = "ESTE TURNO PIDIÓ UNA TABLA (explícitamente, o pidiendo la serie mes a mes / un desglose). La tabla es OBLIGATORIA: armala en MARKDOWN real, con fila de encabezado y fila separadora \"|---|---|\". Una fila por período o por entidad; una columna por concepto autorizado. Responder esto en prosa, o resumirlo en dos frases, es NO cumplir lo que se pidió. La tabla tampoco es el cierre: después de ella, en prosa corrida, contá qué muestra — el mejor y el peor tramo, la variación, y qué hacer con eso.";
const SIN_TABLA_INSTRUCTION = "ESTE TURNO NO TIENE TABLA AUTORIZADA. Respondé en PROSA ejecutiva: qué pasa, por qué y qué hacer primero. Prohibido armar una tabla markdown Y prohibido el listado tabular equivalente (3+ líneas seguidas del tipo \"Etiqueta: cifra\" o \"- Etiqueta — cifra\"): las dos formas son lo mismo con distinta puntuación, y las dos se bloquean. Tabular las pocas cifras que tenés sería reconstruir el detalle con MENOS información que la ficha de Sentrix, que es donde vive. La prioridad SÍ va nombrada con su monto — eso es una frase, no una tabla.";
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
  const cifras_autorizadas = claims.map((cl) => ({ etiqueta: cl.etiqueta, valor: cl.valor, ..._semanticaDe(cl, _ctxSujeto(claims)) }));
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
    // CONTEXTO DE PANTALLA (owner 2026-08-09, Contrato de Concordancia ADI↔Sentrix): ver _lineaVista arriba. Una
    // línea, sin cifras, solo cuando el turno se escribió desde Sentrix — con o sin CTA de por medio.
    ...(_lineaVista(scope) ? { contexto_vista: _lineaVista(scope) } : {}),
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
    // CANDADO ESTRUCTURAL (owner 2026-08-07): si el contrato negó la tabla, NO se manda ninguna instrucción de
    // tabla — pedirle al narrador exactamente lo que guardC va a bloquear sería contradecirse. Y se le DICE la
    // prohibición, para que la primera respuesta ya salga bien y no haya que caer a la prosa determinística.
    // POLÍTICA DE PRESENTACIÓN (owner 2026-08-07) · TRES estados, y el prompt dice EXACTAMENTE lo que el guard va
    // a validar — si se contradijeran, el turno se pierde en un rebote evitable.
    //   forbidden · sin ninguna instrucción de tabla + la prohibición explícita (incluye el listado tabular).
    //   required  · la instrucción de tabla va SIEMPRE, aunque los detectores de forma no la pedirían: el usuario
    //               la pidió, y responder eso en prosa también es incumplir.
    //   auto      · como siempre: deciden los detectores (_needsTableFormat) y el modo.
    ...(_politicaTabla(c) === "auto" ? {} : { politica_tabla: _politicaTabla(c) }),
    ...(_politicaTabla(c) === "forbidden" ? { instruccion_sin_tabla: SIN_TABLA_INSTRUCTION } : {}),
    ...(_politicaTabla(c) === "required" ? { instruccion_tabla: TABLA_OBLIGATORIA_INSTRUCTION } : {}),
    ...(_politicaTabla(c) !== "auto" ? {} : (modo === "clarify" || esPerfilCompleto ? {} : (_needsTableFormat(figLabels) ? { instruccion_tabla: modo === "decision" ? TABLE_INSTRUCTION_DECISION : TABLE_INSTRUCTION } : {}))),
    // LISTA NUMERADA REFORZADA (owner 2026-08-02, hallazgo de auditoría): ver _needsListFormat/LIST_INSTRUCTION.
    ...(_needsListFormat(figLabels) ? { instruccion_lista: LIST_INSTRUCTION } : {}),
    // BRECHA REFORZADA (owner 2026-08-02, hallazgo de auditoría): ver _needsBrechaReinforcement/BRECHA_INSTRUCTION.
    ...(_needsBrechaReinforcement(figLabels) ? { instruccion_brecha: BRECHA_INSTRUCTION } : {}),
    // LA CIFRA EN DINERO DE LA BRECHA, señalada en vez de recalculada (ver _needsValorEnJuego arriba).
    ...(_needsValorEnJuego(figLabels) ? { instruccion_valor_en_juego: VALOR_EN_JUEGO_INSTRUCTION } : {}),
    // COLUMNAS DE CAPITAL REFORZADAS (owner 2026-08-02): ver _needsCapitalColumnNames/CAPITAL_COLUMNS_INSTRUCTION.
    ...(_conceptoCapitalDeFigs(figLabels) ? { instruccion_columnas_capital: _capitalColumnsInstruction(_conceptoCapitalDeFigs(figLabels)) } : {}),
    // ORDEN POR MONTO REFORZADO (owner 2026-08-02, hallazgo de auditoría): ver _needsOrdenMontoReinforcement.
    // `datos` conserva `tool` por entrada — el detector solo mira qué tools corrieron, no los facts.
    ...(_needsOrdenMontoReinforcement(text, datos) ? { instruccion_orden: ORDEN_MONTO_INSTRUCTION } : {}),
    // ORIENTACIÓN (Fase 3, owner 2026-07-30) — SOLO viaja cuando answerViaOracle.js detectó un disparador
    // determinístico (pedido explícito o confusión persistente, ver dialogueState.js needsOrientacion). Mismo
    // principio de payload mínimo que preferencia_respuesta: un turno normal no la lleva.
    ...(instruccionOrientacion ? { instruccion_orientacion: instruccionOrientacion } : {}),
    // DIVULGACIÓN PROGRESIVA: la Ficha como destino del detalle. Solo viaja si de verdad se podó algo.
    ...(forma.instruccionDisclosure ? { instruccion_divulgacion: forma.instruccionDisclosure } : {}),
    // CONTRATO DE RESPUESTA PROPORCIONAL (owner 2026-08-09) — la FORMA que le corresponde a ESTE turno, decidida en
    // progressiveDisclosure.js:resolveAnswerShape y compuesta sobre los claims sellados. Mismo principio de payload
    // mínimo que todas las de arriba: el default del owner (las tres reglas) YA es la doctrina del system
    // (LA ESTRUCTURA), así que en un turno normal esta llave solo aparece si hay algo real que graduar
    // (probado vs indicado, o una pregunta abierta). Una pregunta puntual trae la instrucción de "directo primero";
    // "explicame este gráfico" trae los cinco movimientos compuestos desde el contexto de pantalla.
    ...(forma.instruccionForma ? { instruccion_forma_respuesta: forma.instruccionForma } : {}),
    // PROPORCIONALIDAD SEMÁNTICA (owner 2026-08-07): doctrina de NIVEL DE TURNO, no del system — solo viaja si
    // ESTE turno tiene algo que limitar (ver buildProporcionalidadDoctrina). Un turno sin causas parciales, sin
    // referencia y sin niveles de cascada devuelve cadena vacía y la clave ni siquiera aparece en el payload.
    ...(buildProporcionalidadDoctrina(claims) ? { instruccion_proporcionalidad: buildProporcionalidadDoctrina(claims) } : {}),
    // AFINIDAD ESTIMADA · misma mecánica que la línea de arriba: doctrina de TURNO, la clave ni aparece si el
    // turno no sirve una relación modelada. Ver buildAfinidadDoctrina.
    ...(buildAfinidadDoctrina(claims) ? { instruccion_afinidad: buildAfinidadDoctrina(claims) } : {}),
    // REPARACIÓN CONTEXTUAL (Contrato v1.2, owner 2026-08-10) — SOLO en un turno que corrige, discrepa o trae una
    // cifra del usuario viva. Mismo principio de payload mínimo que todas las de arriba: un turno normal no agrega
    // ni una llave, y el system tampoco suma un párrafo (buildRepairNarrateDoctrine devuelve "" sin esto).
    // Es la DECLARACIÓN de qué clase de turno es y de qué cifra es de quién — no trae ninguna cifra autorizada:
    // el valor que aporta el usuario es texto suyo, y sigue sin poder entrar a `cifras_autorizadas`.
    ...(c.reparacion ? { reparacion: c.reparacion } : {}),
    ...(hilo_reciente.length ? { hilo_reciente } : {}),
    datos,
    cifras_autorizadas,
    // NO REPETIR LO YA NARRADO (ver buildNoRepetirDoctrina): la clave ni aparece en el primer turno de un hilo,
    // así que un turno sin historia queda byte-idéntico al de siempre.
    ...(buildNoRepetirDoctrina(mem) ? { instruccion_no_repetir: buildNoRepetirDoctrina(mem) } : {}),
    ...(mem ? { memoria_interaccion: mem } : {}),
  };
}
