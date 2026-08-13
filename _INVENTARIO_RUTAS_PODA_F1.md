# La Poda · Fase 1 — Inventario de rutas determinísticas

**Generado 2026-08-14** por enjambre ultracode (13 agentes, 6 zonas en paralelo + adjudicación + crítico de completitud) sobre `dev`=aaf3400. Solo lectura: ningún archivo tocado, ninguna llamada a proveedor.

Una **ruta** es cualquier mecanismo determinístico que pueda (a) responder un turno completo sin el modelo, (b) interceptar la pregunta antes del PLAN, (c) reemplazar o reparar la narración del modelo, o (d) forzar un modo o comportamiento.

## Resumen: 197 rutas

| Clase | Cuántas | Qué significa |
|---|---|---|
| vigente | 162 | camino del oráculo, comportamiento deseado hoy |
| legado-en-uso | 27 | camino viejo AÚN alcanzable desde producción — migrar antes de quitar |
| muerto | 6 | sin caller alcanzable, adjudicado con búsqueda exhaustiva — se elimina |
| dudoso | 2 | quedó sin adjudicar (tope de la corrida) — se declara, no se toca |

## Lo que se elimina (adjudicado muerto)

- **composeFromLedger — la vieja reparación tabular** — `src/adi/oracle/narrationBlocks.js:170`
  - Tabla | Concepto | Valor | de hasta 12 figs + línea de supuesto; action_only: «La prioridad: label (value).»
  - Evidencia: No encontré caller en src/ (grep de composeFromLedger( en src/ solo da la definición); lo llaman únicamente _concordancia_semantica_gate.mjs:300 y bundles congelados _guia_inicio_gate_bundle.mjs:44577+ — arneses, no producción. Los comentarios del motor (answerViaOracle.js:2360, 2393, 2913; guardC.js:983, 1722) todavía lo nombran como la reparación vigente
- **Bypass sin pago (puedeResponderSinPagar, pre-PLAN)** — `src/ui/ChatADI.jsx:351`
  - Responde el turno completo con el motor determinístico (answerConversational) con CERO llamadas, antes de pagar el PLAN; source "sin_pago"
  - Evidencia: Caller existe (ChatADI.jsx:351-370) pero ADI_BYPASS_SIN_PAGO=P() no figura en NINGUNA lista de flagProfile.js:20-60 (FEATURE/EXPERIMENTAL/DEV_TOOLS) → false en todos los perfiles; voiceFlags.js:297-308 lo declara "NO ESTÁ EN NINGÚN PERFIL A PROPÓSITO" y no tiene override por localStorage/URL. Inalcanzable en cualquier build hoy
- **_HeroInicioLegacy (hero viejo con chips y botón Resumen ejecutivo)** — `src/ui/ChatADI.jsx:788`
  - El hero anterior: título-promesa + botón «Resumen ejecutivo» (spec diagnose/resumen_ejecutivo) + grilla de HERO_CHIPS
  - Evidencia: Grep de _HeroInicioLegacy en src/ devuelve solo su definición (ChatADI.jsx:788); no encontré caller. El comentario 787 lo declara guardado a propósito «hasta que el owner confirme la versión nueva»
- **composeCompareNotYet (placeholder V1)** — `src/adi/conversation.js:366`
  - placeholder honesto 'la comparación llega en el próximo paso' — reemplazado por composeCompare
  - Evidencia: no encontré caller: grep en todo src/ solo devuelve su definición; el propio archivo lo marca 'se conserva por compat' con eslint-disable no-unused-vars
- **repairField + REPAIR_FIELDS[].pregunta (preguntas de precisión por campo)** — `src/adi/oracle/conversationalContract.js:186`
  - accessor de la fila de REPAIR_FIELDS; las `pregunta` por campo (:168-175) serían el texto de precisión de último recurso
  - Evidencia: no encontré caller de repairField() fuera de su definición (grep en todo el repo); la red determinística real de la pregunta de precisión es composePrecisionQuestion (conversationScope.js:401), que arma su propia pregunta y NO lee REPAIR_FIELDS[].pregunta. OJO: REPAIR_FIELDS como matriz `conserva` SÍ está viva (vía camposQueSobreviven) — lo muerto es solo el accessor y los textos `pregunta`
- **composeFromLedger** — `src/adi/oracle/narrationBlocks.js:170`
  - El compositor viejo de la rama restringida: tabla de 12 filas o 'La prioridad: …' para action_only; superseded por componerPorForma (owner 2026-08-12, punto 3)
  - Evidencia: Sin caller en producción, adjudicado con búsqueda exhaustiva (incluye -uu, imports dinámicos, api/, server.js, UI y camino legado). (1) El motor vigente no lo importa: answerViaOracle.js:26 importa componerPorForma (y 11 símbolos más) de narrationBlocks.js, NO composeFromLedger; todas las reparaciones vigentes llaman componerPorForma (answerViaOracle.js:2437, 2631, 2712, 2714, 2795, 2849). (2) componerPorForma (narrationBlocks.js:330-449) no delega en composeFromLedger: arma la tabla con su propio _tabla (narrationBlocks.js:325) — verificado leyendo el cuerpo. (3) Únicos importadores de narrationBlocks.js en src/: answerViaOracle.js:26, dialogueState.js:19 (parseBlocks), guardC.js:20 (rangoContextoGeneral). (4) api/ (adi-spec.js, adi-narrate.js, adi-narrate-c.js, adi-plan.js, adi-access.js, version.js), server.js y src/ui/: cero referencias a composeFromLedger o narrationBlocks. (5) Camino legado (ChatADI.jsx:10 → answerADIFromSpec.js; conversation.js) no importa narrationBlocks.js; specRetrieval.js:2186 y 2374 son solo comentarios. (6) Único import dinámico de narrationBlocks: _probe_paso2_definir.mjs:17, no usa composeFromLedger. Callers reales = arneses: _concordancia_semantica_gate.mjs:52+300 y _response_preference_gate.mjs:39+247 (test unitario directo), más bundles congelados y copias en .claude/worktrees/. Advertencias: los comentarios de answerViaOracle.js:784/2360/2393/2913, guardC.js:983/1722, responsePreference.js:174 y toolRegistry.js:307 aún lo nombran como la reparación vigente (doc desactualizada, no ejecución), y sigue exportado (narrationBlocks.js:170) porque dos gates vivos lo importan — podarlo exige actualizar esos gates y esos comentarios.

## Lo que se migra antes de quitar (legado en uso)

| Ruta | Archivo | Qué hace |
|---|---|---|
| detectPnlIntent cede-el-paso + flujo guiado P&L (composePnl) | `src/adi/pnl.js:486` | FUERZA el turno fuera del oráculo (guard en ChatADI.jsx:351 y 379) hacia el camino legado: LLM#1 spec → answerConversational → composePnl (conversation.js:654)  |
| Camino legado LLM#1: _fetchSpec (/api/adi-spec) → coerceSpec → answerConversational | `src/ui/ChatADI.jsx:425` | El pipeline pre-oráculo completo: LLM#1 clasifica turn_type y emite spec → coerceSpec lo reescribe determinístico → answerConversational rutea → answerADIFromSp |
| Follow-up regex _FOLLOWUP_RE → composeFollowupRecommendation (gateway caído) | `src/ui/ChatADI.jsx:279` | Responde recomendación determinística sobre la última evidencia sin re-parsear la frase como consulta nueva (specRetrieval.js:2468-2504, route followup_recommen |
| coerceFloor (la red determinística del piso) | `src/adi/coerceChain.js:701` | Corre la cadena de coerce completa con spec-base clarification_needed; si algún detector de dominio/turno reclama el texto devuelve el spec para ejecutar sin mo |
| coerceSpec (cadena de coerce sobre el spec del LLM#1) | `src/adi/coerceChain.js:424` | Intercepta y REESCRIBE el spec del modelo antes de ejecutar: canonicaliza entidades/filtros, retargetea dimensión por tipo real, detecta definición (corta la ca |
| answerConversational + registro TURN_RESOLVERS (ruteo por turn_type) | `src/adi/conversation.js:676` | Responde turnos completos sin modelo con composers determinísticos (composeAccept resuelve el «sí» pelado contra la oferta de memoria, composeCompare, composeDe |
| answerADIFromSpec (seam del SPEC + catálogo de degrades honestos) | `src/adi/answerADIFromSpec.js:145` | Valida el spec contra el contrato (#0-#8b) y ejecuta los productores (overview/rank/compare/dive/diagnose/inventory/margin/ventas/contribucion/why/recommend/sim |
| _scrubScenario (reescritura de lenguaje de escenario en el seam) | `src/adi/answerADIFromSpec.js:130` | Repara el texto de salida: «escenario Bonanza/Tensión/Crisis/activo/actual» → «base real»/«dato real» — solo en el retorno del seam, sin tocar cifras |
| _narrateResult: shouldNarrate + pickNarratedText (LLM#2 legado bajo number-guard) | `src/ui/ChatADI.jsx:285` | (1) shouldNarrate VETA la narración de repreguntas/degrades («los degrades honestos van crudos»); (2) pickNarratedText puede DESCARTAR la narración del modelo y |
| Guards de voz determinísticos (stripRoboticVoice/stripOutOfDataOffers/stripLanguageLeaks/stripProactiveSuffix) | `src/ui/ChatADI.jsx:302` | Repara/ELIMINA oraciones completas de la narración: muletillas robóticas, ofertas sobre data inexistente, leaks de idioma/slang, suffix proactivo enlatado |
| HERO_CHIPS + submitSpec (specs enlatados del inicio) | `src/ui/ChatADI.jsx:725` | Con oráculo ON el chip se convierte en submit(pregunta) — camino oráculo, como tipear (952); con oráculo OFF ejecuta el spec ENLATADO por answerConversational s |
| Camino demo/piso síncrono (buildAdiTurn) | `src/ui/ChatADI.jsx:135` | Responde todo turno sin ninguna llamada: coerceFloor→answerConversational, o answerADI(texto) como techo |
| answerADI (parse regex de texto libre, motor pre-spec) | `src/ui/ChatADI.jsx:436` | El motor conversacional pre-oráculo completo (answerADI.js, dispatch sellado) responde el turno con su parse determinístico |
| answerConversational + resolveTurn + registry TURN_RESOLVERS | `src/adi/conversation.js:676` | rutea por turn_type (registry conversation.js:641-659) y puede responder el turno completo sin modelo; además coerce interno: _focoAccion→recommend (683-696), o |
| composeAccept + _execOffer ('sí' legacy ejecuta la oferta) | `src/adi/conversation.js:594` | ejecuta la oferta de cierre por coerceFloor (_execOffer:548) o escala dive→why→recommend sobre la entidad en foco; nunca vuelve al LLM |
| composeExplain (el porqué determinístico) | `src/adi/conversation.js:237` | responde el porqué sin modelo: rama P&L (por-qué-cifra→pnlExplain), rama inventario (texto fijo con SKU), rama diagnóstico, rama transform, why por entidad vía  |
| composeEnumerate (listar el conjunto nombrado) | `src/adi/conversation.js:142` | lista completa con lectura del asesor (lead+lista+cierre+tabla), boleta obligatoria por entidad; route followup_enumerate |
| composeDefine (definición verbatim de conceptos) | `src/adi/conversation.js:208` | definición curada del glosario o sí/no de identidad, VERBATIM (kind meta → shouldNarrate false, nunca pasa por el narrador) |
| composeMeta (saludo · fuera-de-dato · real-vs-supuesto · capacidades) | `src/adi/conversation.js:310` | respuestas enlatadas completas; saludo y fuera_de_dato van VERBATIM (declaración de frontera, el narrador demostró fabular) |
| composeCompare (comparación conversacional V2) | `src/adi/conversation.js:393` | arma el spec de compare con sujeto del contexto/memoria y lo ejecuta por el seam, o repregunta crisp determinística |
| composeMulti (cruce de lentes C.1) | `src/adi/conversation.js:451` | orquesta 2-3 lecturas por el seam (tabla _MULTI_LENS:440-449) y mergea boletas; route multi_analysis |
| Memoria legacy: extractOffer + updateMemoria + buildConversationContext | `src/adi/conversation.js:76` | captura la última oferta '¿…?' del texto (extractOffer:58), arma la boleta de memoria (entidad/tema/oferta/próxima acción) y el digest del LLM #1 — alimenta el  |
| answerADIFromSpec._degrade (degradaciones honestas de la ruta legada) | `src/adi/answerADIFromSpec.js:220` | Responde el turno entero con texto determinístico de degradación |
| answerADI + composers/* (piso determinístico legado) | `src/adi/answerADI.js:17` | Familia completa de compositores legados (crossDomain, mechanisms, executiveReport, comparisons, followups, clientDive, skuOperational, contribution, warehouse, |
| simulate (genérico legacy) | `src/adi/oracle/toolRegistry.js:708` | simulación genérica de una palanca; declina si la combinación no está soportada |
| entityGuard — veto por entidad fuera de evidencia (dentro de pickNarratedText, ruta legada) | `src/adi/llm/entityGuard.js:78` | veta la narración y fuerza el texto determinístico del motor |
| ensurePnlNarration — post-check F4 sobre la narración final del P&L | `src/adi/pnl.js:1823` | reescribe el texto final asegurando en código la graduación probado/supuesto y el acuse del sello si el narrador (o un strip) se los llevó |

## Lo que quedó sin adjudicar (se declara, no se toca)

- **inventoryStatus · focus:"stale" (el corte que SÍ aplica staleDays)** — `src/adi/oracle/toolRegistry.js:590` · sigue implementado (comentario 627-628 lo afirma) pero grep de "stale" en planPrompt.js: 0 menciones — el catálogo no se lo enseña al plan y planPrompt.js:35 AFIRMA «inventoryStatus NO aplica ese corte», dirigiendo todo a calcular{suma_filtrada}. No encontré caller/doctrina que lo dispare; queda alcanzable solo si el modelo lo adivina
- **server.js — server de producción self-host (gateway + SPA + 403/404/500)** — `server.js:38` · la producción real corre en Vercel (api/* + vercel.json); no encontré uso de server.js en el deploy vigente — queda como camino alternativo documentado

## Riesgos anotados sobre rutas VIGENTES (103)

No son defectos confirmados: son puntos donde una ruta puede pisarse con otra o responder mal. Entran a la Fase 2 como candidatos, cada uno con verificación propia.

- **responderPorQueCifra (por-qué de la última cifra)** (`src/ui/ChatADI.jsx:334`): corre antes que TODO (incluso antes del oráculo): cualquier ampliación de su red le quita turnos al camino principal sin que el oráculo se entere
- **bypassConfianza / puedeResponderSinPagar (D0, bypass sin pago)** (`src/ui/ChatADI.jsx:351`): si se enciende, sirve respuestas de la ruta LEGADA (registro y contratos viejos) como si fueran del oráculo; ya destapó que «el margen de Falabella» sin la regla 3 contestaba el ranking de la cartera
- **guard de tenant (assertTenantContext)** (`src/adi/oracle/answerViaOracle.js:1286`): el null hace que ChatADI CAIGA a la ruta legada (fallback documentado en cabecera, líneas 2-4): un mismatch de tenant termina respondido por el camino viejo, no en silencio
- **memoria de criterio (detectCriteriaIntent → composeCriteria)** (`src/adi/oracle/answerViaOracle.js:1360`): NO pasa por guardC (deliberado, documentado 1355-1359: la confirmación cita cifras del propio usuario); es el primero de todos los cortes — cualquier frase que la red de criteria reconozca le gana a todo el resto del turno
- **aceptación huérfana** (`src/adi/oracle/answerViaOracle.js:1396`): si guardC rechaza el texto fijo cae de largo a PLAN (documentado); depende de getLastOffer — una divergencia shim/canónico en lastOffer cambia el sentido de «sí»
- **mecanismo ya agotado (aceptar 2ª vez la misma oferta)** (`src/adi/oracle/answerViaOracle.js:1406`): su texto a pantalla contiene «capital detenido» (dialogueState.js:341) — palabra prohibida en superficie (debe ser «inmovilizado»); además el texto fijo usa voseo («¿Querés…») sin pasar por stripLanguageLeaks
- **resolución determinística de la simulación pendiente** (`src/adi/oracle/answerViaOracle.js:1344`): depende de axisEntityNames (lectura defensiva: sin índice «no se juzga», 1093-1100) — con índice caído el chequeo anti-otra-entidad no corre y una respuesta que nombra otra entidad conocida podría resolver el pendiente igual
- **scenarioIntent «no_entity» → pregunta de alcance** (`src/adi/oracle/answerViaOracle.js:1459`): texto fijo en voseo («querés») sin stripLanguageLeaks — inconsistente con el registro tuteo neutro que el propio archivo declara (línea 1823-1827)
- **scenarioIntent «future» / «future_multi» → arma pendiente y pregunta el faltante** (`src/adi/oracle/answerViaOracle.js:1475`): pregunta fija «¿cuánto esperás que cambie…?» en voseo sin lavado de registro
- **plan sintético «retorno posicional resuelto»** (`src/adi/oracle/answerViaOracle.js:1516`): fija tool=entityProfile siempre: el retorno pierde el tool original del tema (si el tema era una simulación, vuelve como perfil)
- **pnlOraclePlan (lectura determinística del RESULTADO/P&L)** (`src/adi/oracle/answerViaOracle.js:1532`): convive con detectPnlIntent en ChatADI.jsx:379 que le CEDE el turno entero a la ruta legada (flujo guiado): dos redes de P&L distintas deciden quién responde — riesgo de pisado si divergen sus vocabularios
- **bypass «sumá las dos» (anáfora de universos divergentes)** (`src/adi/oracle/answerViaOracle.js:1584`): universosRecientes guarda solo el universo DOMINANTE por turno (2193-2203) — un turno mixto puede dejar «las dos» sin el segundo referente y degradar a la pregunta
- **_coerceAlcanceNegocio («el nuestro» = el negocio)** (`src/adi/oracle/answerViaOracle.js:659`): «en total» dentro de la regex convive con _PIDE_SUMAR_RE («total del negocio»): un «¿cuánto es en total?» puede globalizar el scope cuando el usuario pedía el total de lo recién mostrado
- **_coerceTensionArgs (métricas + dirección de tensión, y reemplazo de plan fragmentado)** (`src/adi/oracle/answerViaOracle.js:188`): el reemplazo total del plan (205-210) descarta cualquier otra call que el PLAN haya pedido en el mismo turno
- **data_only/results_only — garantía por construcción (narrador jamás invocado)** (`src/adi/oracle/answerViaOracle.js:2425`): un guardC en rojo en esta rama no degrada: abstiene el turno del oráculo (documentado 2405-2411) → cae a la ruta legada
- **Ruta determinística pre-NARRAR (_simpleEntityMetric + _rutaDeterministica)** (`src/adi/oracle/answerViaOracle.js:2332`): Narra doh como «cobertura» (_METRICA_ORACION l.450), término eliminado del producto (pantalla dice «Días de inventario») — mismo término, dos significados visibles. No pasa por stripLanguageLeaks (texto propio del motor, hoy limpio de slang).
- **Rama data_only/results_only — garantía por construcción (nunca invoca al narrador)** (`src/adi/oracle/answerViaOracle.js:2425`): Si guardC veta todos los candidatos no hay reparación propia: cae a la garantía anti-null (l.2763) y sale el genérico de ausencia aunque hubiera dato. Labels de boleta salen sin lavado de registro (ver literalesProhibidos).
- **Pipeline de strips sobre el borrador del narrador (normalizeFigures/stripLanguageLeaks/stripOutOfDataOffers/stripFiller/stripSingleRowTables/stripRedundantTemporalTable/stripPerfilCompletoTable)** (`src/adi/oracle/answerViaOracle.js:2557`): Este lavado es la ÚNICA garantía runtime de registro y no cubre ninguna salida determinística (solo el borrador del modelo).
- **truncateToBriefBudget — brevedad estructural** (`src/adi/oracle/narrationBlocks.js:66`): El corte duro con «…» puede dejar una idea a medias (mitigado: exige >20 chars de oración completa antes de preferirla).
- **ensurePeriodoDeclared — cláusula de período/marco mixto** (`src/adi/oracle/guardC.js:1275`): En la rama data_only exime definiciones y confusión (l.2469) — correcto; una call alucinada con periodos no vacíos era el caso medido.
- **Salida determinística por forma incumplida (tabla-no-autorizada → composeProsaEjecutiva · tabla-faltante → componerPorForma tabla)** (`src/adi/oracle/answerViaOracle.js:2628`): composeProsaEjecutiva contiene el literal «capital detenido» (progressiveDisclosure.js:555) y su salida no pasa por stripLanguageLeaks — registro prohibido componible a pantalla (ver literalesProhibidos).
- **bestDegraded — adopción de narración válida-pero-repetida** (`src/adi/oracle/answerViaOracle.js:2679`): El usuario puede recibir un tramo repetido verbatim del turno anterior — aceptado por diseño como mejor que el genérico.
- **Reparación controlada — escalera de candidatos para full/action_only** (`src/adi/oracle/answerViaOracle.js:2693`): Labels de boleta a pantalla sin lavado de registro (mismo riesgo transversal).
- **Garantía anti-null — el silencio total no es un resultado posible** (`src/adi/oracle/answerViaOracle.js:2763`): El único texto del motor que puede llegar a pantalla sin veredicto de guardC (por diseño: oración sin números).
- **Renderer de forma impuesta (formaSalida ≠ auto: tabla/prosa/solo_conclusion) + red anti-vaciado** (`src/adi/oracle/answerViaOracle.js:2791`): La tabla añadida en l.2795-2796 se adopta SIN un guardC posterior sobre el texto combinado (las cifras ya estaban autorizadas, pero es el único injerto de esta sección sin veredicto propio); mismo riesgo de labels sin lavado.
- **gradeIndicatedClaims — nota epistémica del renderer (flag apagado)** (`src/adi/oracle/narratePromptC.js:590`): El comentario declara que su forma actual «NO va a producción» — si alguien enciende el flag, sale la nota provisional.
- **componerPorForma — el compositor determinístico único (auto/tabla/prosa/solo_conclusion/eje completo)** (`src/adi/oracle/narrationBlocks.js:330`): Imprime fig.label verbatim sin lavado de registro (ver literalesProhibidos, entrada 2).
- **responderPorQueCifra (intercepción pre-oráculo «¿por qué esa cifra?»)** (`src/ui/ChatADI.jsx:334`): Es el mecanismo con MAYOR precedencia del turno: si la red detectaPorQueCifra se ensancha, roba turnos al oráculo sin que nadie lo note; hoy exige P&L en lastEvidence + línea nombrada, así que la colisión es baja
- **Oráculo (answerViaOracle) + _oracleOn con overrides** (`src/ui/ChatADI.jsx:379`): El override ?oracle=0 o localStorage adi_oracle="0" APAGA el oráculo EN PRODUCCIÓN (ChatADI.jsx:180,184 corren antes del chequeo de dominio) → el producto entero cae al camino legado sin ninguna señal visible salvo el SourceBadge; además el fallback silencioso hace indistinguible «el oráculo respondió» de «el legado respondió» sin mirar _source
- **NOT_YET_TEXT (respuesta enlatada ante route not_yet_extracted)** (`src/ui/ChatADI.jsx:36`): Texto hardcodeado en la UI (tensión con la regla 3 «nada hardcodeado»), aceptado como reflejo de honestidad del motor
- **GUIA_EJEMPLOS (ejemplos ejecutables de la Guía de inicio)** (`src/ui/GuiaInicio.jsx:105`): Dos temas del owner quedaron FUERA medidos (Ficha desde texto libre y cruces) — deuda documentada en GuiaInicio.jsx:78-89 y en la memoria adi-ficha-desde-texto-libre
- **Modo claims-only (_claimsOnlyOn, narración del oráculo)** (`src/ui/ChatADI.jsx:198`): Cambia lo que el narrador LEE en el camino VIGENTE; correcto que esté gateado, pero es un modo-forzador vivo en el código de producción
- **uiSignals / viewContext / registerAsk (contexto de pantalla, nunca dispara)** (`src/adi/uiSignals.js:8`): Es el único canal por el que un click puede teñir la interpretación de un turno; el consumo único de pendingVcRef (911-913) impide que tiña el turno siguiente
- **Deep-links de evidencia (_evLabel / EvidenceButton / SentrixButton)** (`src/ui/ChatADI.jsx:616`): El mapeo por forma de evidencia es un contrato implícito con TODOS los productores — un composer nuevo sin flag reconocido queda sin botón (ya pasó con simulateGeneral, documentado en 636-640)
- **_pnlScopeProjection (P&L → conversationScope al salir del turno)** (`src/ui/ChatADI.jsx:58`): Escribe el shape de updateConversationScope a mano (65-72) — si el canónico cambia de forma, esta copia diverge en silencio
- **Productores composeSpec* de specRetrieval (doble consumo: oráculo y legado)** (`src/adi/specRetrieval.js:92`): Sus labels/formula/context de boleta («tu vara», «capital detenido de X») viajan como CIFRAS AUTORIZADAS al narrador del oráculo y a la evidencia de Sentrix AUNQUE el opener se descarte — el registro prohibido entra al camino vigente por la boleta, no solo por el texto legado (ver literales)
- **buildResumenEjecutivo (lectura de la Mesa)** (`src/adi/specRetrieval.js:2509`): Su lectura contiene «capital detenido en N SKU» (L2533) — registro prohibido en la superficie MÁS visible del producto (ver literales)
- **responderPorQueCifra (¿por qué esa cifra? sobre línea del P&L)** (`src/adi/conversation.js:40`): doble alcance deliberado (pre-oráculo + legacy) = una verdad pero dos puertas; si la evidencia pnl quedó vieja en lastEvidence responde sobre esa
- **Bypass sin pago (puedeResponderSinPagar)** (`src/adi/bypassConfianza.js:39`): al encenderlo las respuestas salen del piso legacy: hereda sus defectos (memoria del proyecto: con gateway caído 'el margen de Falabella' contestaba el ranking — defecto preexistente que este módulo destapó)
- **composeCriteria (memoria de criterio — respuesta administrativa)** (`src/adi/conversation.js:494`): verbatim sin guard por diseño; es de las pocas piezas de conversation.js con doble vida oráculo+legacy — al podar el legacy NO puede irse con él
- **detectCriteriaIntent (intercepción pre-PLAN de criterios)** (`src/adi/criteria.js:102`): red de forget estrechada 2026-08-13 (criteria.js:107-121): «olvida <otra cosa>» ya devuelve null en vez de secuestrar el turno — verificar que el gate cubra esa frontera
- **setCriterion / forgetCriterion / initCriteria (mutación de POLICY)** (`src/adi/criteria.js:54`): estado global mutable compartido por ambos caminos (oráculo y legacy) — es la 'una verdad' buscada, pero cualquier ruta que lo mute sin pasar por composeCriteria cambiaría todas las lecturas en silencio
- **Aceptación estructurada: isAcceptance + getLastOffer → plan sintético** (`src/adi/oracle/dialogueState.js:57`): depende de que extractOffer haya derivado bien tool/args desde la prosa del turno anterior; una oferta mal capturada se ejecuta con aplomo
- **extractOffer (oráculo — derivación estructurada de la oferta)** (`src/adi/oracle/dialogueState.js:132`): regex sobre prosa libre del narrador: _CONTINUATION_OFFER_RE/_VAGUE_TOPIC_RE deciden si un 'sí' repite la misma tool; ya produjo 3 hallazgos en vivo (oferta vaga, mecanismo agotado, profundicemos z→c) y cada uno sumó una regla
- **composeOrphanAcceptance ('sí' sin oferta)** (`src/adi/oracle/dialogueState.js:298`): registro: el texto fijo usa voseo informal ('te referís', 'Decime', 'Contame qué querés') — no viola las 6 palabras prohibidas pero choca con la regla de registro formal LatAm
- **composeExhaustedMechanismAcceptance (mecanismo ya agotado)** (`src/adi/oracle/dialogueState.js:342`): HALLAZGO de registro: _MECHANISM_LABEL (línea 341) mete 'de liberar el capital detenido' VERBATIM a pantalla por el camino VIGENTE del oráculo — palabra prohibida; también voseo ('¿Querés…', 'simulamos')
- **composeVagueOfferAcceptance (oferta vaga aceptada)** (`src/adi/oracle/dialogueState.js:318`): voseo informal en el texto fijo ('querés', 'preferís'); el texto nombra 'condiciones de negociación' aunque la oferta vaga haya sido de otra familia (_VAGUE_TOPIC_RE también matchea 'alternativas/opciones/explor')
- **resolveSubjectRecall + composeSubjectAmbiguity (retorno posicional a temas)** (`src/adi/oracle/dialogueState.js:368`): la rama 'resolved' fuerza SIEMPRE la tool entityProfile aunque el tema anterior se hubiera establecido con otra tool/métrica (el LRU guarda mode/intent/tool del tema pero el plan sintético no los usa)
- **debeResponderSinRepreguntar (la segunda aclaración no existe)** (`src/adi/oracle/dialogueState.js:276`): _NOMBRA_LINEA_RE es amplia (cualquier mención de venta/margen/cliente cuenta como 'específico') — trade-off documentado: ante la duda responde en vez de re-aclarar
- **updateRecentSubjects + getRecentSubjects (LRU de temas, tope 3)** (`src/adi/oracle/dialogueState.js:205`): dual-write con conversationScope declarado (dialogueState.js:22-43); la derivación semántica completa quedó como decisión pendiente del owner (comentario final :383-410)
- **Contrato de 7 modos (MODES + buildModeDoctrine/buildModeDispatch)** (`src/adi/oracle/conversationalContract.js:36`): es doctrina (prompt), no candado: el propio repo documenta que la doctrina sola falló dos veces (formato de bloques, tabla) — depende de las coerciones determinísticas de esta zona para cumplirse
- **coerceVocabularioPlan + normalizeIntent (reparación del vocabulario del plan)** (`src/adi/oracle/conversationalContract.js:264`): tipo ausente/inválido → no se infiere nada (deliberado): un plan con intent inválido y sin tipo sigue de largo con su intent roto (coercion 'intent-invalido-sin-tipo')
- **normalizeReparacion + camposQueSobreviven/camposQueSeInvalidan (invalidación de contexto)** (`src/adi/oracle/conversationalContract.js:284`): un tipo='correccion' colgado de un answer legítimo se ignora entero (protección deliberada) — si el modelo insiste en ese patrón la corrección del usuario se pierde en silencio salvo por el trace corrigeDescartado
- **Detectores de preferencia (pideReduccionDeLargo / pideDatoPelado)** (`src/adi/oracle/responsePreference.js:83`): pideReduccionDeForma (:69) y pideCorreccionDeRegistro (:89) no tienen caller runtime encontrado (solo gates/comentarios) — exportadas para verificación; además el propio archivo declara PENDIENTE (:52-55) que _PREF_DIRECTO_RE en answerViaOracle.js es una COPIA de la familia de registro: dos listas para una clase, riesgo de divergencia documentado
- **buildPrefDoctrine + buildPrefDispatch (doctrina de preferencia en prompts)** (`src/adi/oracle/responsePreference.js:134`): presupuesto de prompt topeado por _reparacion_contextual_gate (1.700 car) — editar esta doctrina se paga en todos los turnos (documentado :126-128)
- **componerPorForma** (`src/adi/oracle/narrationBlocks.js:330`): Imprime fig.label y fig.context VERBATIM y NO pasa por stripLanguageLeaks/voiceGuard (el strip solo corre sobre la salida del narrador en answerViaOracle.js:2558) — por acá el respaldo escribe 'Capital detenido' en pantalla hoy: los labels de specRetrieval.js:581/780/810/1030 llegan tal cual
- **composeNoDataMessage** (`src/adi/oracle/narrationBlocks.js:536`): Cita el reason de cualquier tool tal cual a pantalla: una tool con reason en jerga/registro prohibido llega sin lavar (toolRegistry.js:1022/1064/1327 ya lo reconocen como texto de pantalla, pero la garantía es por disciplina de cada tool, no estructural)
- **composeFromTextualEvidence** (`src/adi/oracle/narrationBlocks.js:499`): VERBATIM sin lavar: los textos de glossary.js llegan a pantalla tal cual — glossary.js:271 contiene 'plata' y el concepto 'vara' (glossary.js:257-261) imprime la palabra vetada en su definición
- **truncateToBriefBudget** (`src/adi/oracle/narrationBlocks.js:66`): El corte duro con '…' puede amputar contexto de una cifra (el caso raro está documentado en el propio archivo)
- **composeProsaEjecutiva** (`src/adi/oracle/progressiveDisclosure.js:522`): HALLAZGO: emite 'capital detenido' literal en pantalla (líneas 553 y 555) y no pasa por voiceGuard — registro prohibido ('inmovilizado', nunca 'detenido') en un compositor vigente del oráculo
- **buildAlcanceLine** (`src/adi/oracle/progressiveDisclosure.js:734`): Se compone de texto emitido por el LLM del PLAN (entities/filters) — el propio código lo declara y por eso prueba primero con alcance y reintenta sin él
- **_cifrasEnLinea** (`src/adi/oracle/answerViaOracle.js:790`): Mismo vector que componerPorForma: labels de ledger verbatim, sin lavado de registro
- **buildNarrationContract / buildClaims (leyenda de atribución y acciones permitidas)** (`src/adi/oracle/narrationContract.js:640`): El eco del narrador queda lavado por stripLanguageLeaks (palanca→acción; capital detenido→inmovilizado, voiceGuard.js:88 y 110) — la garantía de registro de estos textos depende 100% de ese strip, no del texto fuente
- **stripLanguageLeaks / stripOutOfDataOffers / stripFiller (lavado de registro de la narración)** (`src/adi/llm/voiceGuard.js:290`): DOS agujeros: (1) ningún compositor determinístico del oráculo pasa por acá (componerPorForma, composeProsaEjecutiva, _cifrasEnLinea, composeFromTextualEvidence) — el respaldo sale sin lavar; (2) la cadena dormido→'detenido' (voiceGuard.js:101-102) PRODUCE la palabra vetada cuando el sustantivo no es capital/inventario ('stock dormido'→'stock detenido' queda en pantalla)
- **composeSpec* (compositores de tools del oráculo, doble cableado)** (`src/adi/specRetrieval.js:473`): Es LA FUENTE del caso conocido: sus labels/openers/suggestions llevan 'detenido', 'vara' y 'plata'; en el oráculo el narrador los parafrasea lavado, pero el respaldo determinístico y las suggestions los publican tal cual
- **_crossGuard (cruce imposible)** (`src/adi/oracle/toolRegistry.js:93`): el reason afirma que el cruce «no está en el dato» aunque a veces sí está por otra tool (el propio caso clientesPorSku:349-355 nació de esa mentira); coverage.reason sale verbatim a pantalla vía composeNoDataMessage (regla declarada en toolRegistry.js:1022,1064)
- **redirect queryMetric→entityRecord** (`src/adi/oracle/toolRegistry.js:198`): el ledger graba tool:"queryMetric" pero el resultado es de entityRecord — un consumidor del trace atribuye la respuesta a la tool equivocada
- **_METRIC_ALIAS «cobertura»→doh** (`src/adi/oracle/toolRegistry.js:183`): la misma comprensión vive en TRES mapas independientes: _METRIC_ALIAS:183, _CALC_CAMPO:993 (calcular) y _SF_CAMPO_UMBRAL:1132 (suma_filtrada) — pueden desalinearse con la próxima métrica; precedente exacto del defecto que esta auditoría busca
- **decisión 8 · _ejeNoAbierto/_filasDelEje/_ejeCanon** (`src/adi/oracle/toolRegistry.js:160`): DUPLICACIÓN de canonizador de eje: _ejeCanon:135 (contra METRICS.axes) y ejeCanonico de toolContracts.js:573 (contra AXES del índice) son dos implementaciones de lo mismo contra dos listas distintas
- **entityProfile · auto-corrección de eje + enriquecimiento** (`src/adi/oracle/toolRegistry.js:209`): contexts de figs con la palabra prohibida «vara» (233,317) — ver literalesProhibidos
- **entityComposicion · brechas por familia** (`src/adi/oracle/toolRegistry.js:310`): context «la vara» en la fig del benchmark (317)
- **clientesPorSku · transpuesta cliente×SKU** (`src/adi/oracle/toolRegistry.js:372`): el sello lo decide clientCapitalRelacion sobre pedidos[0] solamente (383) — con SKU mezclados de relación distinta el sello del primero gobierna a todos
- **entityRecord · auto-corrección + varas por campo** (`src/adi/oracle/toolRegistry.js:461`): context «vara» en la fig de referencia (483)
- **diagnose · filtro string degradado en silencio** (`src/adi/oracle/toolRegistry.js:567`): responde el negocio entero cuando el usuario acotó con una frase que el plan no supo estructurar — cifras reales a otra pregunta, sin señal en coverage
- **inventoryStatus · rename contrapunta** (`src/adi/oracle/toolRegistry.js:596`): la nota contiene «capital detenido» (600) — ver literalesProhibidos
- **inventoryStatus · umbral_no_aplicado + _umbralDiasPedido** (`src/adi/oracle/toolRegistry.js:630`): la declaración contiene «lo detenido» (637) — ver literalesProhibidos; convive con suma_filtrada para la misma pregunta (dos totales posibles bajo criterios distintos)
- **simulateCarga / simulateCapital / simulateCosto** (`src/adi/oracle/toolRegistry.js:716`): reason de simulateCapital dice «capital detenido» (723) — ver literalesProhibidos
- **simulateGeneral · guards de entrada y degrade honesto** (`src/adi/oracle/toolRegistry.js:768`): el reason de rango usa voseo «probá» (779) mientras las declinaciones de calcular exigen registro sin voseo (regla en 1022-1023) — voz inconsistente en textos de pantalla
- **calcular · catálogo cerrado + razones en palabras** (`src/adi/oracle/toolRegistry.js:1217`): la exigencia de procedencia (1031-1033) declina cifras del usuario con contexto corto legítimo («sube 10%» sin origen) — piso determinístico que puede frenar turnos válidos
- **calcular · rescate determinístico a variacion_aplicada** (`src/adi/oracle/toolRegistry.js:1254`): es una sustitución de intención: si el plan pidió una suma mal armada con esos dos insumos, el motor responde otra cuenta (declarada, pero distinta de la pedida)
- **calcular · suma_filtrada (umbral del usuario)** (`src/adi/oracle/toolRegistry.js:1141`): se pisa con inventoryStatus (focus stale y umbral_no_aplicado): la misma pregunta puede dar $22K por acá y $33K por allá según qué tool eligió el plan; el label del filtro evita decir «sin venta» a propósito (1169-1171) — mitigación, no cierre; nota_criterio contiene «capital detenido» (1212)
- **defineConcept · escalera de resolución** (`src/adi/oracle/toolRegistry.js:1319`): con una frase que nombra DOS conceptos la escalera (c) resuelve al primero por orden de matcher (documentado 1314-1317) — puede definir el concepto equivocado
- **trend · bloqueo de futuro (_FUTURO)** (`src/adi/oracle/toolRegistry.js:1350`): depende de que el plan copie la frase temporal del usuario en period; si el plan normaliza («noviembre»), el histórico sale como si fuera pronóstico — el modo de falla que la propia doctrina documenta (1347-1349)
- **runPlan · descomposición compareEntities→gridTable** (`src/adi/oracle/toolRunner.js:139`): solapa con composeCardinalityExceeded de applyMultiEntityScope (toolContracts.js:309): dos mecanismos para el mismo caso 3+ — cuál actúa depende de si el plan llenó scope; respuestas distintas (tabla servida vs pregunta al usuario)
- **_veraz / diagnosticarVacio (veracidad del vacío D7)** (`src/adi/oracle/toolRunner.js:70`): los textos compuestos (composeVacioPorCardinalidad:709, composeVacioPorEje:715) usan voseo «Decime/querés/decímelo» mientras compose* de multi-entidad (306-327) usan «prefieres» — dos voces en textos de pantalla, contra la regla de registro formal
- **TOOL_CONTRACTS (tabla declarativa)** (`src/adi/oracle/toolContracts.js:49`): NO es autoridad de runtime y está más conservadora que los composers (medido: compareEntities corre por bodega/canal que la tabla no lista, L533-538) — pero applyMultiEntityScope:374 SÍ declina por dimensionesSoportadas: puede declinar un eje que el composer serviría
- **applyMultiEntityScope** (`src/adi/oracle/toolContracts.js:357`): depende de plan.scope, campo OPCIONAL que «el camino normal del plan no llena» (toolRunner.js:59-61, toolContracts.js:583-584): la capa queda inerte la mayoría de los turnos y el caso 3+ lo termina resolviendo la descomposición de runPlan con otra respuesta
- **detectScenarioIntent (bypass pre-PLAN de simulación)** (`src/adi/oracle/scenarioIntent.js:156`): VOCABULARIO: solo reconoce las palabras literales «precio» (98) y «volumen|unidades» (99) — «tarifa», «cantidad», «demanda», «lo que vendo» no disparan y caen al PLAN; deltas >50% devuelven null en extractSignedPct:116 (el turno sigue a PLAN sin la red); 1a persona «subí/bajé» solo cuenta pasado con marcador temporal (78-82)
- **extractKnownEntity (canon 4 ejes del detector)** (`src/adi/oracle/scenarioIntent.js:54`): bodega/canal fuera a propósito (comentario 36-38) — coherente con simulateGeneral, pero es OTRA lista de entidades paralela al entityIndex (construida desde demoData directo, 23) que puede desalinearse del índice canónico
- **gatewayFetch — router HTTP + candado de errores (los 5 endpoints pagos pasan por acá)** (`src/adi/llm/gatewayFetch.js:70`): toda causa server-side (config, cuota, bug) llega al usuario como el mismo texto genérico; la causa real solo vive en el log de la plataforma
- **rate limit de op:mint (_mintLimited)** (`src/adi/llm/gatewayFetch.js:49`): best-effort por isolate, no garantía global (declarado en el propio archivo: el control real es la entropía de ADI_ADMIN_KEY)
- **puerta de acceso del gateway (_access + handleAccess) — denegación access:"denied"** (`src/adi/llm/gatewayCore.js:100`): si el código vence a MITAD de un hilo, la denegación se traga como excepción del turno y el turno cae en silencio al piso determinístico en vez de re-mostrar la puerta
- **rate limit por tenant del gateway (_checkRateLimit)** (`src/adi/llm/gatewayCore.js:55`): in-memory: cada cold start serverless resetea el contador (declarado como red parcial, no garantía)
- **presupuesto de escalamiento de modelo (_tierBudgetOk / _resolveModel + chooseModel)** (`src/adi/llm/gatewayCore.js:89`): la degradación es invisible para el usuario; solo queda en modelReason de la telemetría
- **timeout y errores tipados del adapter de proveedor (TIMEOUT_MS + sobreAjeno + errorDeRespuesta)** (`src/adi/llm/adapters/anthropic.js:23`): el default de 25s ya mató turnos ricos de Sonnet en vivo (3 llamadas pagadas y tiradas + airbag); el fix env LLM_TIMEOUT_MS=90000 está verificado en arnés pero PENDIENTE de crearse en Vercel
- **entrypoints Vercel api/ (adi-plan · adi-narrate · adi-narrate-c · adi-spec · adi-access)** (`api/adi-narrate-c.js:12`): api/adi-plan.js sigue en runtime edge: si PLAN algún día tarda >25s en empezar a responder, repite la misma falla que ya se pagó en NARRAR
- **devGateway — plugin Vite del gateway (dev)** (`src/adi/llm/devGateway.js:22`): a diferencia de prod, su catch devuelve e.message CRUDO al cliente (devGateway.js:36) — en dev puede filtrar el cuerpo de error del proveedor que gatewayFetch oculta a propósito
- **guardC — el muro de 26 chequeos (la función madre, no solo sus dos ensure*)** (`src/adi/oracle/guardC.js:2633`): cada rechazo suyo dispara un reintento pagado (los 27 reintentos de la corrida de certificación existían solo por sus veredictos)
- **loop de reintento de PLAN + backoff 429 + corte por falta de crédito + backstop redirect-sin-calls** (`src/adi/oracle/answerViaOracle.js:1609`): el fallo triple degrada en SILENCIO al camino legado (LLM#1/piso), cuyo texto usa vocabulario prohibido del registro (ver literales) — el usuario no sabe que cambió de motor
- **presupuesto del hilo (aplicarPresupuestoHilo) — reescritura determinística del contexto que ven los dos LLM** (`src/adi/oracle/hiloBudget.js:60`): pérdida silenciosa de detalle en hilos muy largos: puede explicar un "perdió el hilo" que ningún guard registra
- **useViewContext / useVistaContext — el hook de emisión Sentrix→ADI (asks + contexto ambiente)** (`src/ui/useViewContext.js:65`): el contexto ambiente de la vista abierta entra a TODO turno escrito con la Mesa delante, aunque la pregunta no tenga que ver (mitigado río abajo por _coerceViewScope, ya inventariado)
- **AskRow + cadena onAsk — los asks enlatados de la Mesa (prefill, cero disparo)** (`src/ui/SentrixPanel.jsx:868`): los textos de ask son contrato de entrada de ADI: CLAUDE.md ordena dejarlos como están aunque la pantalla cambie de palabra — renombrarlos rompe el ruteo aguas abajo
- **AccessGate / AdminAccess — la pantalla que intercepta la app entera** (`src/ui/AccessGate.jsx:1`): cubre el ARRANQUE; la denegación a mitad de hilo no vuelve acá (ver fila de la puerta del gateway)

## Literales de registro prohibido (90 hallazgos)

CLAUDE.md §4: prohibidas en superficie *plata, vara, dormido, guita, palanca, apretar*; se dice **inmovilizado**, no *detenido*. El barrido cubrió todo `src/`. Hay solapamiento entre agentes (dos zonas reportaron los mismos archivos) — la Fase 2 deduplica antes de tocar.

| Archivo | Texto | ¿Llega a pantalla? |
|---|---|---|
| `src/adi/oracle/dialogueState.js:341` | de liberar el capital detenido | SÍ — es parte del texto completo que composeExhaustedMechanismAcceptance (dialogueState.js:346) devu |
| `src/adi/oracle/progressiveDisclosure.js:555` | `Además tienes ${capital.valor} de capital detenido en el inventario del mix que le vendes | Sí. composeProsaEjecutiva es la salida determinística del veredicto tabla-no-autorizada (answerViaOr |
| `src/adi/oracle/narrationBlocks.js:326` | _tabla(list) imprime `/ ${f.label} / ${f.value} /` con el label de boleta VERBATIM — las b | Sí, condicional al dato: toda salida determinística que tabula (componerPorForma forma=tabla/results |
| `src/ui/ChatADI.jsx:1087` | «fija tu vara: "recuerda que mi margen mínimo es 28%"» | SÍ — hint de primer uso tras la primera respuesta, en producción, todos los modos |
| `src/adi/answerADIFromSpec.js:220` | «si libero el capital detenido» (repregunta simulate-shape) | SÍ — texto del chat, camino legado (degrade del seam) |
| `src/adi/answerADIFromSpec.js:348` | «No veo capital detenido material según tu vara …» (degrade simulate-empty) | SÍ — texto del chat, camino legado («detenido» + «vara») |
| `src/adi/answerADIFromSpec.js:351` | «si libero el capital detenido» (repregunta simulate-shape con métrica) | SÍ — texto del chat, camino legado |
| `src/adi/answerADIFromSpec.js:546` | «capital detenido según tu vara (rotación bajo 2x o más de 120 días)» (degrade inventory-e | SÍ — texto del chat, camino legado |
| `src/adi/answerADIFromSpec.js:547` | «No veo capital detenido material en este escenario» (degrade inventory-empty global) | SÍ — texto del chat, camino legado |
| `src/adi/specRetrieval.js:581` | label de foco del diagnose: "Capital detenido" | SÍ — evidence.findings del diagnose (texto y panel Diagnóstico), y como facts de la tool diagnose de |
| `src/adi/specRetrieval.js:619` | suggestion "El capital detenido en detalle" | SÍ — chip de sugerencia bajo la respuesta (camino legado) |
| `src/adi/specRetrieval.js:706` | «N de M clientes están bajo la vara» (resumen ejecutivo, bloque Cómo se comporta el margen | SÍ — texto del resumen ejecutivo (chat legado y tool del oráculo) |
| `src/adi/specRetrieval.js:710` | «$X de capital detenido en N SKU» (fugas del resumen ejecutivo) | SÍ — texto del resumen ejecutivo |
| `src/adi/specRetrieval.js:717` | «el capital está detenido en SKU que no rotan» (causas del resumen ejecutivo) | SÍ — texto del resumen ejecutivo |
| `src/adi/specRetrieval.js:749` | boleta fig context: "la vara" (Piso de margen / Target de carga, también L750) | POSIBLE — context de boleta: viaja como cifra autorizada al narrador y a la evidencia Sentrix; no ve |
| `src/adi/specRetrieval.js:780` | _ESTADO_LABEL capital_frenado: "capital detenido" | SÍ — label de estado usado en textos y ledger del inventario |
| `src/adi/specRetrieval.js:810` | label: "capital detenido" (estado dominante del inventario) | SÍ — texto de la lectura de inventario |
| `src/adi/specRetrieval.js:841` | «el capital queda detenido justo donde más pesa» | SÍ — advertencia de la lectura de inventario |
| `src/adi/specRetrieval.js:845` | suggestion "El capital detenido en detalle" | SÍ — chip de sugerencia |
| `src/adi/specRetrieval.js:879` | _LBL_E capital_frenado: "detenido" (reparto del capital) | SÍ — texto del estado del inventario completo |
| `src/adi/specRetrieval.js:890` | «Sin capital detenido ni quiebres a la vista — el inventario corre sano.» | SÍ — texto del inventario |
| `src/adi/specRetrieval.js:896` | suggestion "¿Dónde está detenido mi capital?" | SÍ — chip de sugerencia |
| `src/adi/specRetrieval.js:941` | «…y nada detenido: todo rota dentro de tu benchmark (detenido sería rotación bajo Nx…)» (+ | SÍ — opener del inventario con alcance declarado |
| `src/adi/specRetrieval.js:962` | «Es venta que estás por perder por falta de producto, no capital detenido…» (foco quiebre) | SÍ — texto del inventario |
| `src/adi/specRetrieval.js:973` | «no está detenido como el que no rota» (foco sobrestock) | SÍ — texto del inventario |
| `src/adi/specRetrieval.js:985` | title: "Capital inmovilizado · dónde está detenido tu capital" | SÍ — título del panel/lectura de capital frenado |
| `src/adi/specRetrieval.js:991` | «Es stock que no sale y deja el capital detenido.» (+ L992 «los de más capital detenido») | SÍ — bloques Por qué / Qué hacer del inventario |
| `src/adi/specRetrieval.js:994` | suggestions ["Por qué el capital está detenido", …] | SÍ — chips de sugerencia |
| `src/adi/specRetrieval.js:1030` | _CONCEPTO fallback "capital detenido" (label del ledger por entidad) | SÍ — labels de boleta «Entidad · Capital detenido» (cifras autorizadas del narrador + evidencia Sent |
| `src/adi/specRetrieval.js:2254` | boleta formula: "tu vara (POLICY · no inventado)" (simulate carga; también L2285-2286 en s | POSIBLE — formula de boleta: entra al prompt del narrador como texto autorizado y a la evidencia |
| `src/adi/specRetrieval.js:2276` | context: "supuesto: liberar el capital detenido (dato real)" (+ L2288 formula "capital det | POSIBLE — context/formula de boleta (narrador + evidencia) |
| `src/adi/specRetrieval.js:2278` | «El supuesto: liberar el capital detenido…» (+ L2279 «…SKU que no rotan según tu vara» + L | SÍ — contrato completo del simulate capital (supuesto/efecto/límite), texto del chat |
| `src/adi/specRetrieval.js:2291` | suggestions ["El capital detenido en detalle"] | SÍ — chip de sugerencia |
| `src/adi/specRetrieval.js:2533` | «$X de capital detenido en N SKU» + label "detenido en N SKU" (buildResumenEjecutivo) | SÍ — lectura de apertura de la MESA DE CONTROL (SentrixPanel.jsx:29), la superficie más visible |
| `src/adi/conversation.js:271` | Los más detenidos (${top}) llevan meses sin salida | sí — es el `text` de la rama inventario de composeExplain (route followup_explain), camino legacy al |
| `src/adi/conversation.js:271` | el dato te dice DÓNDE está detenido el capital | sí — mismo texto de respuesta de composeExplain (segunda ocurrencia en la misma cadena) |
| `src/adi/conversation.js:330` | el **capital detenido** en inventario para liberar y reinvertir | sí — composeMeta topic fuera_de_dato, que además va VERBATIM (kind fuera_de_dato → shouldNarrate fal |
| `src/adi/conversation.js:357` | llevar la carga comercial al target o liberar el capital detenido | sí — composeMeta (capacidades, route meta_question), texto de respuesta del camino legacy |
| `src/adi/oracle/dialogueState.js:341` | _MECHANISM_LABEL = { capital: "de liberar el capital detenido", ... } | sí — se interpola en composeExhaustedMechanismAcceptance (:346) y sale VERBATIM por el bypass determ |
| `src/adi/oracle/progressiveDisclosure.js:553` | Una causa comprobada es el capital detenido: … | SÍ — template vigente del oráculo (reparación tabla-no-autorizada, answerViaOracle.js:2632), sin voi |
| `src/adi/oracle/progressiveDisclosure.js:555` | …de capital detenido en el inventario del mix que le vendes… | SÍ — template vigente del oráculo, sin voiceGuard |
| `src/adi/oracle/narrationContract.js:397` | accion: "liberar el capital detenido en inventario" (y regex /capital detenido/) | Indirecto — viaja como accionesPermitidas al prompt del narrador; el eco queda lavado por voiceGuard |
| `src/adi/oracle/narrationContract.js:272` | leyenda: "…no trae ninguna palanca cuantificada…" / "las palancas de esta boleta…" (272-27 | Indirecto — texto que prompt y guard citan; eco del narrador lavado por voiceGuard.js:88 (palanca→ac |
| `src/adi/specRetrieval.js:581` | _diagFoco("capital", "Capital detenido", items) | SÍ — label de ledger: el respaldo (componerPorForma/_cifrasEnLinea) lo imprime verbatim. El caso con |
| `src/adi/specRetrieval.js:1030` | _CONCEPTO = _ESTADO_LABEL[B.focusEst] // "capital detenido" → labels "Entidad · Capital de | SÍ — label de ledger, verbatim en el respaldo determinístico |
| `src/adi/specRetrieval.js:780` | _ESTADO_LABEL: capital_frenado → "capital detenido" (también 810) | SÍ — label de ledger/estado |
| `src/adi/specRetrieval.js:887` | **Lo primero:** $X detenidos en N SKU sin rotación… | SÍ en ruta legada (opener directo); en el oráculo va al prompt (eco lavado) |
| `src/adi/specRetrieval.js:941` | …nada detenido: todo rota dentro de tu benchmark (detenido sería rotación bajo…) | SÍ en ruta legada — template opener |
| `src/adi/specRetrieval.js:985` | title: "Capital inmovilizado · dónde está detenido tu capital" | SÍ — título de evidencia; duplicado como fallback de UI en SentrixPanel.jsx:1206 |
| `src/adi/specRetrieval.js:994` | suggestions: ["Por qué el capital está detenido", …] (también 896, 976, 2291, 845) | SÍ — suggestion chips: nunca pasan por stripLanguageLeaks |
| `src/adi/specRetrieval.js:2278` | **El supuesto:** liberar el capital detenido… (y 2280 'SKU detenidos', 2281 'qué está dete | SÍ en ruta legada; en el oráculo, prompt (eco lavado); el _ctx 'supuesto: liberar el capital detenid |
| `src/adi/specRetrieval.js:706` | …N de M clientes están bajo la vara… | SÍ en ruta legada — template de perfil de cartera |
| `src/adi/specRetrieval.js:2279` | …no rotan según tu vara (rotación bajo Xx…) | SÍ en ruta legada — template simulate capital |
| `src/adi/specRetrieval.js:2284` | formula: "suma del capital de los SKU bajo tu vara de rotación" (también 2254/2285/2286 't | Indirecto — formula/context viajan en el claim (supuestos: 'se calcula como …', narrationContract.js |
| `src/adi/specRetrieval.js:1076` | _MFOCUS_TITLE causa_costo: "Margen · el costo aprieta" | SÍ — título de foco (forma de 'apretar', vetada) |
| `src/adi/answerADIFromSpec.js:348` | No veo capital detenido material según tu vara — … | SÍ — degrade legado directo a pantalla, sin strip (shouldNarrate excluye degrades) |
| `src/adi/answerADIFromSpec.js:546` | …capital detenido según tu vara (rotación bajo 2x o más de 120 días)… (también 220 y 547) | SÍ — degrade legado directo a pantalla |
| `src/adi/sentrix/glossary.js:271` | …siempre marca más cuentas y más plata. (distingue del concepto 'meta') | SÍ — VIGENTE: composeFromTextualEvidence lo imprime VERBATIM bajo data_only/results_only (narrationB |
| `src/adi/sentrix/glossary.js:261` | concepto 'vara' (aka/etiquetas/def/distingue usan la palabra 'vara', 257-261) | SÍ — definición curada impresa verbatim; deliberado (define la palabra que el usuario usó), pero es  |
| `src/adi/sentrix/resumenComercial.js:726` | No son plata a capturar —llevarlos al promedio sería entregarles más—… | SÍ — pestaña Comercial vigente (texto compuesto en módulo, la vista pinta) |
| `src/adi/sentrix/resumenComercial.js:736` | …Es la vara realista — pregunta qué pasa si… | SÍ — nota de simulación en Comercial vigente |
| `src/adi/sentrix/mesaCapital.js:395` | …y por eso va en participación, nunca en plata: … | SÍ — nota de compradores en la cara Capital vigente |
| `src/ui/SentrixPanel.jsx:1206` | "Capital inmovilizado · dónde está detenido tu capital" (fallback de título) | SÍ — UI directa |
| `src/ui/SentrixPanel.jsx:5416` | Tienes $X detenidos y otros $Y con rotación lenta… (también 5418) | SÍ — UI directa, cara Capital |
| `src/ui/SentrixPanel.jsx:5434` | Ningún SKU de los … está hoy detenido ni con rotación lenta… | SÍ — UI directa |
| `src/ui/ChatADI.jsx:1087` | …fija tu vara: "recuerda que mi margen mínimo es 28%" | SÍ — texto de ayuda del chat, UI directa |
| `src/adi/etlg.js:23` | …tienes capital detenido en inventario. (23-25 y 201-203) | Ruta legada (narrativa ETLG) — no verifiqué caller vivo desde UI en esta pasada |
| `src/adi/contracts/contractCloser.js:377` | **Recomendación:** liberá el capital detenido de los SKU que no rotan… (también 88, 316 'b | Ruta legada (contract closer) — a pantalla si el turno legacy no se narra; además 377 usa voseo ('li |
| `src/adi/intentLayer.js:146` | El precio en ADI se analiza como palanca sobre una entidad puntual… | SÍ en ruta legada (opener determinístico); lavado solo si el turno pasa por _narrateResult |
| `src/adi/composers/crossDomain.js:480` | La palanca prioritaria es renegociar carga comercial… (familia: 469/484/488/491 y suggesti | Ruta legada; suggestions llegan crudas siempre |
| `src/adi/composers/mechanisms.js:107` | …la palanca de renegociación opera sobre ese cliente… (familia: 251/325/529/554 y suggesti | Ruta legada; suggestion 579 cruda siempre |
| `src/adi/composers/contribution.js:30` | suggestion "¿Qué productos dejan más plata?" (también 92 y 81 'la palanca comercial') | SÍ — suggestion chips crudos, ruta legada |
| `src/adi/composers/executiveReport.js:1065` | …es la palanca más directa… (familia 781/787/789/791 'palanca(s) distinta(s)') | Ruta legada |
| `src/adi/composers/warehouse.js:147` | …zona donde la palanca de plan de salida opera. (también 268/269) | Ruta legada |
| `src/adi/composers/comparisons.js:118` | La palanca disponible opera sobre… (familia 111/113/129) | Ruta legada |
| `src/adi/composers/followups.js:103` | …la palanca de rebate opera antes que la de precio. (también 111 '2 palancas disponibles') | Ruta legada |
| `src/adi/composers/clientDive.js:819` | …la palanca está en la carga, no en el volumen. | Ruta legada |
| `src/adi/composers/skuOperational.js:161` | …zona donde la palanca de liquidación libera reinversión… | Ruta legada |
| `src/adi/composers/simulation.js:445` | Esto es el techo bruto de la palanca… (además voseo 'perdés') | Ruta legada |
| `src/adi/narrativeLayer.js:1166` | Es la palanca operativa de mayor impacto… (también 1232) | Ruta legada |
| `src/adi/composers/qiRetrieval.js:548` | evaluar carga comercial por … para identificar palancas de margen (también 561) | Ruta legada |
| `src/adi/llm/voiceGuard.js:101` | reemplazo dormido→detenido (101-102): produce la palabra vetada cuando el sustantivo no es | SÍ — 'stock dormido' del narrador sale como 'stock detenido' en pantalla; el lavador mismo emite el  |
| `src/adi/llm/capabilities.js:23` | "inventario: capital detenido · riesgo de quiebre · …" | No directo — texto de menú/prompt para el LLM (eco posible, lavado en narración); no encontré render |
| `src/adi/oracle/toolRegistry.js:723` | no hay capital detenido para liberar | coverage.reason de simulateCapital — coverage.reason es texto de pantalla verbatim vía composeNoData |
| `src/adi/oracle/toolRegistry.js:637` | …estas cifras salen del estado del inventario según tu política (lo detenido por rotación  | facts.umbral_no_aplicado.declaracion — diseñada para citarse en la PRIMERA frase de la narración con |
| `src/adi/oracle/toolRegistry.js:233` | context: "la vara" (fig Benchmark de margen, entityProfile) | context de una fig de la boleta: viaja al prompt del narrador y a la evidencia del panel (sentrixEvi |
| `src/adi/oracle/toolRegistry.js:317` | context: "la vara" (fig Benchmark de margen, entityComposicion) | mismo camino que la línea 233 (boleta → prompt/evidencia) |
| `src/adi/oracle/toolRegistry.js:483` | context: "vara" (figs de referencia por campo, entityRecord) | mismo camino que la línea 233 — una fig de referencia por CADA campo con vara declarada, así que el  |
| `src/adi/oracle/toolRegistry.js:600` | nota: "estado INDEPENDIENTE del capital detenido — no es su causa, y sus familias no son l | facts.inventory.otro_estado_del_inventario.nota — instrucción al narrador, no cita obligatoria, pero |
| `src/adi/oracle/toolRegistry.js:1212` | nota_criterio: "…nunca lo presentes como el total de otro criterio ni como el capital dete | facts.nota_criterio de suma_filtrada — instrucción al narrador con riesgo de eco de «capital detenid |

## Inventario completo por zona

### Zona A (34)

| Ruta | Archivo | Se activa cuando | Clase |
|---|---|---|---|
| responderPorQueCifra (por-qué de la última cifra) | `src/ui/ChatADI.jsx:334` | pregunta «¿por qué esa cifra?» sobre context.lastEvidence (P&L delante o línea real nombrada; si no, devuelve null) | vigente |
| bypassConfianza / puedeResponderSinPagar (D0, bypass sin pago) | `src/ui/ChatADI.jsx:351` | ADI_BYPASS_SIN_PAGO=true && !detectPnlIntent(q) && coerceFloor devuelve spec confiable (7 reglas: sin entidad no resuelt | vigente |
| guard de tenant (assertTenantContext) | `src/adi/oracle/answerViaOracle.js:1286` | requestContext presente y tenant mismatch (tenantId stale vs tenantStore) | vigente |
| memoria de criterio (detectCriteriaIntent → composeCriteria) | `src/adi/oracle/answerViaOracle.js:1360` | «recordá que mi margen mínimo es 25%» / recall («qué sabés de mi negocio») / forget («olvidá el…») — detectCriteriaInten | vigente |
| aceptación huérfana | `src/adi/oracle/answerViaOracle.js:1396` | isAcceptance(q) («sí»/«dale») && !priorOffer (sin oferta viva) | vigente |
| mecanismo ya agotado (aceptar 2ª vez la misma oferta) | `src/adi/oracle/answerViaOracle.js:1406` | isAcceptance(q) && priorOffer && isExhaustedMechanismOffer(priorOffer) (oferta sin tool con mechanismExhausted) | vigente |
| oferta vaga aceptada | `src/adi/oracle/answerViaOracle.js:1417` | isAcceptance(q) && priorOffer && isVagueOffer(priorOffer) (oferta sin tool capturado) | vigente |
| retorno ambiguo a temas recientes (referencia posicional) | `src/adi/oracle/answerViaOracle.js:1426` | resolveSubjectRecall(q, recentSubjects) devuelve kind="ambiguous" («lo anterior», «el primer tema» con 2+ candidatos) | vigente |
| abandono explícito del pendiente (_ABANDONA_PENDIENTE_RE) | `src/adi/oracle/answerViaOracle.js:1327` | «olvidalo», «cancelalo», «descartá esa simulación», «ya no me interesa» (regex 1161, objeto obligatorio) | vigente |
| resolución determinística de la simulación pendiente | `src/adi/oracle/answerViaOracle.js:1344` | pendingSimulation vivo && el turno contesta el supuesto faltante con evidencia POSITIVA (nombra la variable y nada más,  | vigente |
| fusión escenario nuevo × pendiente vivo (detectScenarioIntent + fusionarPendientes) | `src/adi/oracle/answerViaOracle.js:1337` | pendingSimulation vivo && el turno declara su propio escenario (scenarioIntent.kind future/future_multi) | vigente |
| scenarioIntent «no_entity» → pregunta de alcance | `src/adi/oracle/answerViaOracle.js:1459` | campo+% inequívoco sin entidad nombrada ni resoluble, y sin sujeto recuperable en recentSubjects | vigente |
| scenarioIntent «future» / «future_multi» → arma pendiente y pregunta el faltante | `src/adi/oracle/answerViaOracle.js:1475` | «Sube 8% el precio de Lider» (imperativo/condicional, campo+% + entidad conocida, o deíctico plural con scope estructura | vigente |
| plan sintético «oferta aceptada» (ejecución estructurada) | `src/adi/oracle/answerViaOracle.js:1514` | isAcceptance(q) && priorOffer.tool (la oferta guardada ya trae tool+args) | vigente |
| plan sintético «retorno posicional resuelto» | `src/adi/oracle/answerViaOracle.js:1516` | resolveSubjectRecall kind="resolved" («volvamos a lo anterior» con un solo candidato) | vigente |
| pnlOraclePlan (lectura determinística del RESULTADO/P&L) | `src/adi/oracle/answerViaOracle.js:1532` | «¿cuál es el resultado del negocio después de gastos?» / estado de resultados / utilidad — lenguaje inequívoco (detectPn | vigente |
| bypass «sumá las dos» (anáfora de universos divergentes) | `src/adi/oracle/answerViaOracle.js:1584` | _PIDE_SUMAR_RE && _ANAFORA_DOS_RE («sumá las dos», «ambas») sin plan sintético previo, contra mem.universosRecientes | vigente |
| corrección ambigua → pregunta de precisión (Contrato v1.2 §4) | `src/adi/oracle/answerViaOracle.js:1822` | reparación ambigua declarada por PLAN (sin calls, o con pregunta escrita) o inferida por el motor (redirect sin cambio e | vigente |
| confusión pelada → clarify (D1, desclasificación de reparación) | `src/adi/oracle/answerViaOracle.js:1774` | _CLARIFY_RE (589) && !respuestaYaEsEspecifica(q) — «no entiendo» sin nombrar nada concreto | vigente |
| _coerceAlcanceNegocio («el nuestro» = el negocio) | `src/adi/oracle/answerViaOracle.js:659` | _ALCANCE_NEGOCIO_RE (656): «el nuestro», «nuestro margen», «del negocio», «en general», «en total» — con 2 candados (ent | vigente |
| resolución de referencia conversacional (deícticas/ordinales/uiSignals) | `src/adi/oracle/answerViaOracle.js:1880` | plan real sin entidades resolubles + deíctico/ordinal («de esos», «el primero», selección de la Mesa vía uiSignals.mesaS | vigente |
| _coerceTensionArgs (métricas + dirección de tensión, y reemplazo de plan fragmentado) | `src/adi/oracle/answerViaOracle.js:188` | 2+ métricas nombradas en el texto crudo (tabla _TENSION_METRIC_MAP 135) sobre una call tensionRead del plan, o estructur | vigente |
| _coerceEntityScopedFilters (entidad puntual → filtro obligado) | `src/adi/oracle/answerViaOracle.js:254` | plan.scope entity con EXACTAMENTE 1 entidad reconocida por guessDimension, call en _ENTITY_FILTER_TOOLS (239) | vigente |
| _coerceMode (piso de clarify / seguimiento / herencia elíptica / diagnóstico global) | `src/adi/oracle/answerViaOracle.js:625` | _CLARIFY_RE (589) fuerza clarify; marcador+verbo de seguimiento con hilo (598-599); elíptica «¿Y Lider?» hereda mode del | vigente |
| _coerceViewScope (contexto de pantalla → alcance y evidencia sembrada) | `src/adi/oracle/answerViaOracle.js:295` | contexto de pantalla sellado + deíctico de componente («explicame este gráfico», resolveComponentReference conversationS | vigente |
| applySingleEntityScope / applyMultiEntityScope (continuidad Etapas 2-3, con decline) | `src/adi/oracle/answerViaOracle.js:1923` | scope con 1 entidad (single) o level=list con 2+ (multi, 1932) | vigente |
| backstop de lectura ejecutiva (perfil → trend + composición + capital ligado) | `src/adi/oracle/answerViaOracle.js:1953` | _WANTS_PERFIL_RE (769: perfil/avance/resumen/estado) && plan con entityProfile resuelto | vigente |
| supuestos_faltantes → corte de aclaración (simulate v2) + red de 0% silencioso + «a la meta» + gemelo del pendiente | `src/adi/oracle/answerViaOracle.js:1996` | PLAN emite supuestos_faltantes, o simulateGeneral trae delta_pct=0 sin «0%» explícito en el texto (_silentZeroSupuestoFa | vigente |
| debeResponderSinRepreguntar (la segunda aclaración no existe) | `src/adi/oracle/answerViaOracle.js:2074` | plan.mode=clarify && ya hubo aclaración previa (clarifyStreak>0) && el usuario nombró algo concreto | vigente |
| _coercePref (red de preferencia de respuesta: data_only/action_only/results_only/brief/reset/persist) | `src/adi/oracle/answerViaOracle.js:827` | regexes 718-764 («solo el dato», «sin análisis», «sé breve», «háblame directo», «volvé a lo normal», «desde ahora», «sol | vigente |
| ruta determinística entidad+métrica (saltea NARRAR) | `src/adi/oracle/answerViaOracle.js:2332` | intent=answer, scope entity de 1, una sola call entityRecord soportada, y 1+ métricas nombradas todas presentes en la fi | vigente |
| data_only/results_only — garantía por construcción (narrador jamás invocado) | `src/adi/oracle/answerViaOracle.js:2425` | pref.contentScope data_only o results_only (turno o sesión) | vigente |
| cadena de reparación/reemplazo de la narración (zona c, listada por completitud) | `src/adi/oracle/answerViaOracle.js:2557` | tras cada intento de NARRAR, o tras 3 rechazos de guardC | vigente |
| orientación inicial mid-conversación (needsOrientacion) | `src/adi/oracle/answerViaOracle.js:2479` | frases inequívocas de desorientación (needsOrientacion dialogueState.js:239) con clarifyStreak resuelto | vigente |

### B (26)

| Ruta | Archivo | Se activa cuando | Clase |
|---|---|---|---|
| Ruta determinística pre-NARRAR (_simpleEntityMetric + _rutaDeterministica) | `src/adi/oracle/answerViaOracle.js:2332` | Pregunta simple entidad+métrica que _simpleEntityMetric (l.396) reconoce sobre los results del batch; se intenta ANTES d | vigente |
| Rama data_only/results_only — garantía por construcción (nunca invoca al narrador) | `src/adi/oracle/answerViaOracle.js:2425` | pref.contentScope data_only o results_only y la ruta determinística no resolvió; el loop de NARRAR los excluye explícita | vigente |
| Pipeline de strips sobre el borrador del narrador (normalizeFigures/stripLanguageLeaks/stripOutOfDataOffers/stripFiller/stripSingleRowTables/stripRedundantTemporalTable/stripPerfilCompletoTable) | `src/adi/oracle/answerViaOracle.js:2557` | Todo intento de NARRAR (full/action_only), antes de guardC | vigente |
| Doble candado action_only (parseBlocks/renderFromBlocks/hasForbiddenContent) | `src/adi/oracle/answerViaOracle.js:2572` | pref.contentScope === action_only en cada intento de NARRAR | vigente |
| renderContextoGeneral — el marco del bloque [[CONTEXTO_GENERAL]] lo pone el motor | `src/adi/oracle/narrationBlocks.js:629` | Solo bajo full, sobre cada intento del narrador (answerViaOracle.js:2591), antes del muro | vigente |
| truncateToBriefBudget — brevedad estructural | `src/adi/oracle/narrationBlocks.js:66` | pref.detailLevel === brief (answerViaOracle.js:2598 sobre el narrador; 2334 sobre la ruta determinística) y tope de 45 p | vigente |
| ensureHypothesisFraming — marco de hipótesis en simulaciones | `src/adi/oracle/narratePromptC.js:478` | mode=simulacion, tool simulate*, o calcular con cifra del usuario, y el texto no trae marco de hipótesis | vigente |
| ensurePeriodoDeclared — cláusula de período/marco mixto | `src/adi/oracle/guardC.js:1275` | periodosEsperados(results) trae familias que el texto no declara; corre en TODAS las salidas (narrador 2600, determiníst | vigente |
| ensureClarifyClosingQuestion — pregunta guía de clarify | `src/adi/oracle/narratePromptC.js:498` | plan.mode === clarify y el núcleo del texto (sin paréntesis finales) no termina en «?» | vigente |
| ensureCountAuthorized — reconciliación de conteos | `src/adi/oracle/guardC.js:95` | El narrador dice «N cosas: lista» con N distinto del largo real de la lista Y el largo real está autorizado en la boleta | vigente |
| ensureTransferenciaDeclarada — la decisión de traslado se contesta | `src/adi/oracle/narratePromptC.js:529` | La pregunta pide mover stock entre bodegas y results declara limite_transferencia; el texto no lo declara (o no dice qué | vigente |
| ensureUmbralDeclarado — el criterio no aplicado se declara | `src/adi/oracle/narratePromptC.js:553` | facts.umbral_no_aplicado presente (inventoryStatus detectó umbral de días que su foco no aplica) y el texto no lo declar | vigente |
| Salida determinística por forma incumplida (tabla-no-autorizada → composeProsaEjecutiva · tabla-faltante → componerPorForma tabla) | `src/adi/oracle/answerViaOracle.js:2628` | guardC rechaza un intento del narrador con veredicto tabla-no-autorizada o tabla-faltante — no se reintenta ni se paga o | vigente |
| repairSpec — reintento mismo tier con veredicto estructurado (2 strikes) | `src/adi/oracle/answerViaOracle.js:2661` | guardC rechaza con veredicto de la familia REDACCIÓN (_VERDICTOS_DE_REDACCION l.2529: cifra-no-autorizada, cifra-de-dato | vigente |
| bestDegraded — adopción de narración válida-pero-repetida | `src/adi/oracle/answerViaOracle.js:2679` | Los 3 intentos pasaron guardC pero todos marcados degraded (tramo verbatim de 8+ palabras contra narración propia recien | vigente |
| Reparación controlada — escalera de candidatos para full/action_only | `src/adi/oracle/answerViaOracle.js:2693` | Los 3 intentos de NARRAR agotados sin narración (guardC rechazó todo o errores), scope full o action_only | vigente |
| ensureDeclinacionDeSuma — no cruzar universos es responder que no | `src/adi/oracle/answerViaOracle.js:540` | La pregunta pide sumar/consolidar (_PIDE_SUMAR_RE l.538), la boleta trae ≥2 universos divergentes según reconcilian() y  | vigente |
| ensureCoberturaDeclarada — lo que faltó se dice | `src/adi/oracle/narrationBlocks.js:478` | Alguna call declaró coverage.cobertura.faltantes y el texto no nombra esas entidades | vigente |
| Garantía anti-null — el silencio total no es un resultado posible | `src/adi/oracle/answerViaOracle.js:2763` | narration sigue null después de TODO (loop, bestDegraded, reparación) — cualquier scope | vigente |
| Renderer de forma impuesta (formaSalida ≠ auto: tabla/prosa/solo_conclusion) + red anti-vaciado | `src/adi/oracle/answerViaOracle.js:2791` | resolveOutputForm (l.2376) declaró forma no-auto, sobre la narración YA autorizada (incluso la del modelo) | vigente |
| stripAllMarks + extractOffer — limpieza de marcas y oferta de seguimiento | `src/adi/oracle/answerViaOracle.js:2779` | Siempre, sobre la narración final | vigente |
| gradeIndicatedClaims — nota epistémica del renderer (flag apagado) | `src/adi/oracle/narratePromptC.js:590` | ADI_EPISTEMIC_NOTE_ENABLED (voiceFlags.js) — hoy APAGADO por default; solo full, claims con estatus indicado cuyo valor  | vigente |
| markUserProvenance — procedencia de cifras del usuario | `src/adi/oracle/narratePromptC.js:659` | reparacionSellada trae cifras aportadas por el usuario vivas en el turno | vigente |
| componerPorForma — el compositor determinístico único (auto/tabla/prosa/solo_conclusion/eje completo) | `src/adi/oracle/narrationBlocks.js:330` | Llamado por la rama data_only (2437), la salida por forma incumplida (2631), la escalera de reparación (2712-2714), el r | vigente |
| composeNoDataMessage / composeSoloDatosConfusionMessage / composeAckPreferenciaMessage / composeFromTextualEvidence | `src/adi/oracle/narrationBlocks.js:536` | Boleta vacía / confusión pelada bajo solo-datos / ack de preferencia sin pedido de dato / evidencia textual del glosario | vigente |
| composeFromLedger — la vieja reparación tabular | `src/adi/oracle/narrationBlocks.js:170` | Ninguno en el motor vigente: reemplazado por componerPorForma (owner 2026-08-12, punto 3 — comentario answerViaOracle.js | muerto |

### Zona C (26)

| Ruta | Archivo | Se activa cuando | Clase |
|---|---|---|---|
| responderPorQueCifra (intercepción pre-oráculo «¿por qué esa cifra?») | `src/ui/ChatADI.jsx:334` | Hay context.lastEvidence.pnl (un P&L delante) Y la frase nombra una línea real del P&L (detectaPorQueCifra, red angosta) | vigente |
| Bypass sin pago (puedeResponderSinPagar, pre-PLAN) | `src/ui/ChatADI.jsx:351` | ADI_BYPASS_SIN_PAGO && !detectPnlIntent(q) && puedeResponderSinPagar(q, coerceFloor(q)) ok && la respuesta del piso no v | muerto |
| Oráculo (answerViaOracle) + _oracleOn con overrides | `src/ui/ChatADI.jsx:379` | _oracleOn() && !detectPnlIntent(q) para texto libre; los chips también llegan acá (submitSpec→submit cuando oráculo ON,  | vigente |
| detectPnlIntent cede-el-paso + flujo guiado P&L (composePnl) | `src/adi/pnl.js:486` | Cualquier frase que la red P&L reclama: start/recall/edit/peso/resultado/meta_venta/tabla_eje/volver, y con _draft abier | legado-en-uso |
| Camino legado LLM#1: _fetchSpec (/api/adi-spec) → coerceSpec → answerConversational | `src/ui/ChatADI.jsx:425` | (1) turno P&L (oráculo cede), (2) oráculo abstiene/falla (catch 420), (3) ?oracle=0 / adi_oracle=0, (4) perfil sin orácu | legado-en-uso |
| Follow-up regex _FOLLOWUP_RE → composeFollowupRecommendation (gateway caído) | `src/ui/ChatADI.jsx:279` | _fetchSpec lanzó excepción (LLM#1 caído) Y hay lastEvidence Y el texto matchea «qué hacemos/qué hago/qué recomendás/qué  | legado-en-uso |
| coerceFloor (la red determinística del piso) | `src/adi/coerceChain.js:701` | Camino demo sin LLM (ChatADI.jsx:137), fallback con gateway caído (435), bypass (354), y GuiaInicio.jsx:110 para derivar | legado-en-uso |
| coerceSpec (cadena de coerce sobre el spec del LLM#1) | `src/adi/coerceChain.js:424` | Todo turno del camino legado LLM#1 (ChatADI.jsx:428) | legado-en-uso |
| answerConversational + registro TURN_RESOLVERS (ruteo por turn_type) | `src/adi/conversation.js:676` | turn_type del spec (del LLM#1 o del coerce): new_query→seam · followup_recommendation/explain/enumerate/compare/accept · | legado-en-uso |
| answerADIFromSpec (seam del SPEC + catálogo de degrades honestos) | `src/adi/answerADIFromSpec.js:145` | Specs de operación desde cualquier puerta legada: TURN_RESOLVERS (conversation.js:642-644,670 y specs sintéticos 262/433 | legado-en-uso |
| _scrubScenario (reescritura de lenguaje de escenario en el seam) | `src/adi/answerADIFromSpec.js:130` | Todo retorno del seam cuyo texto contenga «escenario» (wrapper 145-150) | legado-en-uso |
| _sanitizeScenario (display, todos los caminos) | `src/ui/ChatADI.jsx:41` | Todo texto que entra a un mensaje ADI (_turnFromResult:95,105 — incluye resultados del ORÁCULO) y lo que viaja al narrad | vigente |
| NOT_YET_TEXT (respuesta enlatada ante route not_yet_extracted) | `src/ui/ChatADI.jsx:36` | r.text == null (deferred) en cualquier camino | vigente |
| _narrateResult: shouldNarrate + pickNarratedText (LLM#2 legado bajo number-guard) | `src/ui/ChatADI.jsx:285` | Camino legado con ADI_LLM_NARRATE_ENABLED (default true, voiceFlags.js:276); compartido por input libre (442) y chips en | legado-en-uso |
| Guards de voz determinísticos (stripRoboticVoice/stripOutOfDataOffers/stripLanguageLeaks/stripProactiveSuffix) | `src/ui/ChatADI.jsx:302` | Texto final del camino legado (narrado o determinístico de fallback); stripProactiveSuffix además en 366 (bypass) y 440  | legado-en-uso |
| HERO_CHIPS + submitSpec (specs enlatados del inicio) | `src/ui/ChatADI.jsx:725` | Ejecución desde la Guía de inicio (registerRun→submitSpecRef, 984-988); el hero nuevo YA NO los pinta (HeroInicio 747-78 | legado-en-uso |
| GUIA_EJEMPLOS (ejemplos ejecutables de la Guía de inicio) | `src/ui/GuiaInicio.jsx:105` | Click en un ejemplo de la guía (render 211) → registerRun → submitSpec de ChatADI | vigente |
| _HeroInicioLegacy (hero viejo con chips y botón Resumen ejecutivo) | `src/ui/ChatADI.jsx:788` | Ninguno encontrado | muerto |
| Camino demo/piso síncrono (buildAdiTurn) | `src/ui/ChatADI.jsx:135` | Build con ADI_LLM_ENABLED false (VITE_ADI_LLM_ENABLED — voiceFlags.js:271, default false; también Node/gates); rama sync | legado-en-uso |
| answerADI (parse regex de texto libre, motor pre-spec) | `src/ui/ChatADI.jsx:436` | Último eslabón: gateway caído Y coerceFloor no reclamó (436), o camino demo sin coerce (138) | legado-en-uso |
| Modo claims-only (_claimsOnlyOn, narración del oráculo) | `src/ui/ChatADI.jsx:198` | localStorage adi_claims_only="1" o ?claims=1 — pero en adiai.cl y *.vercel.app el override NO alcanza (manda el flag, 20 | vigente |
| uiSignals / viewContext / registerAsk (contexto de pantalla, nunca dispara) | `src/adi/uiSignals.js:8` | Sentrix publica selección/vista (setUISignal); «Que ADI lo explique» deja viewContext en pendingVcRef (ChatADI.jsx:875-8 | vigente |
| Deep-links de evidencia (_evLabel / EvidenceButton / SentrixButton) | `src/ui/ChatADI.jsx:616` | La forma de msg.evidence decide el botón: _profileRequest→Ficha, pnl→Mesa Resultado, lens temporal→Mesa, criteriaList, t | vigente |
| _pnlScopeProjection (P&L → conversationScope al salir del turno) | `src/ui/ChatADI.jsx:58` | SOLO turnos resueltos por P&L (route pnl_* , 92-94) y SOLO si pnlScope() trae entidad real (nunca global) | vigente |
| Productores composeSpec* de specRetrieval (doble consumo: oráculo y legado) | `src/adi/specRetrieval.js:92` | (a) toolRegistry del ORÁCULO los importa como tools (toolRegistry.js:15-20,31) re-exponiendo facts/boleta SIN opener; (b | vigente |
| buildResumenEjecutivo (lectura de la Mesa) | `src/adi/specRetrieval.js:2509` | SentrixPanel (Mesa de Control) lo invoca para KPIs + lectura + focos (SentrixPanel.jsx:29) | vigente |

### D (33)

| Ruta | Archivo | Se activa cuando | Clase |
|---|---|---|---|
| responderPorQueCifra (¿por qué esa cifra? sobre línea del P&L) | `src/adi/conversation.js:40` | pregunta que nombra una línea real del P&L con lastEvidence.pnl presente (red angosta detectaPorQueCifra) | vigente |
| Bypass sin pago (puedeResponderSinPagar) | `src/adi/bypassConfianza.js:39` | flag ADI_BYPASS_SIN_PAGO=true + spec new_query del coerceFloor completo, sin entidad no resuelta, sin dependencia del hi | vigente |
| answerConversational + resolveTurn + registry TURN_RESOLVERS | `src/adi/conversation.js:676` | todo turno del camino legacy: demo/LLM-off (ChatADI.jsx:138), turnos P&L que el oráculo cede (ChatADI.jsx:379 `_oracleOn | legado-en-uso |
| composeAccept + _execOffer ('sí' legacy ejecuta la oferta) | `src/adi/conversation.js:594` | turn_type followup_accept en el camino legacy ('sí'/'dale' pelado tras una oferta) | legado-en-uso |
| composeExplain (el porqué determinístico) | `src/adi/conversation.js:237` | turn_type followup_explain (y fallback de followup_enumerate) en el camino legacy | legado-en-uso |
| composeEnumerate (listar el conjunto nombrado) | `src/adi/conversation.js:142` | turn_type followup_enumerate o flag _enumerate del coerce con last.entityList | legado-en-uso |
| composeDefine (definición verbatim de conceptos) | `src/adi/conversation.js:208` | turn_type define ('¿qué es X?' / '¿ese N es rebate?') | legado-en-uso |
| composeMeta (saludo · fuera-de-dato · real-vs-supuesto · capacidades) | `src/adi/conversation.js:310` | turn_type meta_question; topics saludo/fuera_de_dato/real-supuesto/fuente/capacidades | legado-en-uso |
| composeCompare (comparación conversacional V2) | `src/adi/conversation.js:393` | turn_type followup_compare, o operation compare con <2 entidades (answerConversational:721-724) | legado-en-uso |
| composeCompareNotYet (placeholder V1) | `src/adi/conversation.js:366` | ninguno encontrado | muerto |
| composeMulti (cruce de lentes C.1) | `src/adi/conversation.js:451` | turn_type multi_analysis con spec.multi.metrics>=2 | legado-en-uso |
| composeCriteria (memoria de criterio — respuesta administrativa) | `src/adi/conversation.js:494` | set/propose/recall/forget detectado por detectCriteriaIntent | vigente |
| Memoria legacy: extractOffer + updateMemoria + buildConversationContext | `src/adi/conversation.js:76` | cada turno en ChatADI (se calcula siempre, incluso con oráculo ON: ChatADI.jsx:95) | legado-en-uso |
| detectCriteriaIntent (intercepción pre-PLAN de criterios) | `src/adi/criteria.js:102` | 'recordá/recuerda que mi X es N' · 'olvidá el X/todo' · '¿qué sabés de mi negocio?' (regexes por criterio :23-32) | vigente |
| setCriterion / forgetCriterion / initCriteria (mutación de POLICY) | `src/adi/criteria.js:54` | composeCriteria (set/forget) · boot de la app (initCriteria, App.jsx:21) · cambio de tenant (onTenantChange criteria.js: | vigente |
| Aceptación estructurada: isAcceptance + getLastOffer → plan sintético | `src/adi/oracle/dialogueState.js:57` | 'sí/dale/ok/listo…' (ACCEPT_RE) con priorOffer.tool derivado | vigente |
| extractOffer (oráculo — derivación estructurada de la oferta) | `src/adi/oracle/dialogueState.js:132` | cierre de cada turno full (contentScope=full) del oráculo | vigente |
| composeOrphanAcceptance ('sí' sin oferta) | `src/adi/oracle/dialogueState.js:298` | isAcceptance(q) && !priorOffer (y sin simulación pendiente) | vigente |
| composeExhaustedMechanismAcceptance (mecanismo ya agotado) | `src/adi/oracle/dialogueState.js:342` | isAcceptance(q) && priorOffer.mechanismExhausted (la simulación dedicada ya corrió este turno) | vigente |
| composeVagueOfferAcceptance (oferta vaga aceptada) | `src/adi/oracle/dialogueState.js:318` | isAcceptance(q) && priorOffer sin tool y texto que matchea _VAGUE_TOPIC_RE (:85) | vigente |
| resolveSubjectRecall + composeSubjectAmbiguity (retorno posicional a temas) | `src/adi/oracle/dialogueState.js:368` | 'volvamos a lo anterior' / 'el primer tema' / referencia genérica con 2+ candidatos (regexes :363-365) | vigente |
| matchEllipticEntity (herencia de modo en '¿Y Lider?') | `src/adi/oracle/dialogueState.js:194` | turno ≤6 palabras '¿y [prep] NombrePropio?' sin verbo (ELLIPTIC_ENTITY_RE :193) | vigente |
| debeResponderSinRepreguntar (la segunda aclaración no existe) | `src/adi/oracle/dialogueState.js:276` | clarifyStreak previo ≥1 y la respuesta del usuario trae cifra o nombra una línea/métrica (:267-268) | vigente |
| needsOrientacion + buildOrientacionInstruction (orientación mid-conversación) | `src/adi/oracle/dialogueState.js:239` | 'no sé qué preguntar / por dónde sigo / y ahora qué' (_ORIENTACION_RE :238) o clarifyStreak≥3 | vigente |
| updateRecentSubjects + getRecentSubjects (LRU de temas, tope 3) | `src/adi/oracle/dialogueState.js:205` | cada turno del oráculo que resuelve entidad (scope entity o filters de un solo eje) | vigente |
| Contrato de 7 modos (MODES + buildModeDoctrine/buildModeDispatch) | `src/adi/oracle/conversationalContract.js:36` | todo turno del oráculo (system de PLAN y de NARRAR) | vigente |
| coerceVocabularioPlan + normalizeIntent (reparación del vocabulario del plan) | `src/adi/oracle/conversationalContract.js:264` | plan del modelo con intent fuera del enum o clase escrita en el campo equivocado | vigente |
| normalizeReparacion + camposQueSobreviven/camposQueSeInvalidan (invalidación de contexto) | `src/adi/oracle/conversationalContract.js:284` | turno con reparacion válida y consistente (tipo↔intent por la tabla :132) | vigente |
| buildRepairPlanDoctrine + buildRepairNarrateDoctrine (doctrina de reparación en prompts) | `src/adi/oracle/conversationalContract.js:329` | todo turno (PLAN) · turnos con reparación o supuestos vivos (NARRAR, condicional) | vigente |
| repairField + REPAIR_FIELDS[].pregunta (preguntas de precisión por campo) | `src/adi/oracle/conversationalContract.js:186` | ninguno encontrado | muerto |
| Detectores de preferencia (pideReduccionDeLargo / pideDatoPelado) | `src/adi/oracle/responsePreference.js:83` | 'en una línea/una sola frase', 'solo la conclusión' (largo) · 'solo el dato/la cifra/la tabla' (dato pelado) | vigente |
| blockInstructionFor + BRIEF_INSTRUCTION (instrucción de formato por turno) | `src/adi/oracle/responsePreference.js:178` | pref.contentScope≠full (bloques [[DATOS]]/[[ACCION]]) · detailLevel=brief (presupuesto 90 palabras) | vigente |
| buildPrefDoctrine + buildPrefDispatch (doctrina de preferencia en prompts) | `src/adi/oracle/responsePreference.js:134` | todo turno (PLAN) · turnos con pref no-default (NARRAR) | vigente |

### E (21)

| Ruta | Archivo | Se activa cuando | Clase |
|---|---|---|---|
| componerPorForma | `src/adi/oracle/narrationBlocks.js:330` | (a) SIEMPRE bajo pref.contentScope=data_only/results_only (answerViaOracle.js:2437 — el narrador nunca se invoca); (b) g | vigente |
| composeFromLedger | `src/adi/oracle/narrationBlocks.js:170` | ninguno encontrado en src/ — el import de answerViaOracle.js:26 NO lo incluye | muerto |
| composeNoDataMessage | `src/adi/oracle/narrationBlocks.js:536` | boleta vacía en la rama restringida (answerViaOracle.js:2456); peldaño 3 de la escalera de reparación (2715); garantía a | vigente |
| composeSoloDatosConfusionMessage | `src/adi/oracle/narrationBlocks.js:556` | bajo data_only/results_only, turno que matchea _CLARIFY_RE sin cifra ni definición curada y sin tool declinada con razón | vigente |
| composeAckPreferenciaMessage | `src/adi/oracle/narrationBlocks.js:573` | intent=ack + turnPref.contentScope declarado en el turno + calls vacío + sin cifra/definición/confusión (answerViaOracle | vigente |
| composeFromTextualEvidence | `src/adi/oracle/narrationBlocks.js:499` | bajo data_only/results_only, cuando el ledger no compuso y alguna tool trajo supported:true con boleta vacía y facts.es_ | vigente |
| ensureCoberturaDeclarada | `src/adi/oracle/narrationBlocks.js:478` | post-narración, si alguna call declaró cobertura.faltantes y el texto no las nombra (answerViaOracle.js:2745, verificado | vigente |
| parseBlocks + renderFromBlocks + hasForbiddenContent (renderer action_only) | `src/adi/oracle/narrationBlocks.js:86` | pref.contentScope=action_only sobre cada intento del narrador (answerViaOracle.js:2572-2577); parseBlocks también lo con | vigente |
| stripAllMarks | `src/adi/oracle/narrationBlocks.js:51` | toda narración final antes de salir (answerViaOracle.js:2779) | vigente |
| truncateToBriefBudget | `src/adi/oracle/narrationBlocks.js:66` | pref.detailLevel=brief (answerViaOracle.js:2598, tope 90 palabras); y el recorte de solo_conclusion (answerViaOracle.js: | vigente |
| renderContextoGeneral + rangoContextoGeneral | `src/adi/oracle/narrationBlocks.js:629` | solo contentScope=full, antes de guardC (answerViaOracle.js:2591); rangoContextoGeneral lo consume guardC para enmascara | vigente |
| composeProsaEjecutiva | `src/adi/oracle/progressiveDisclosure.js:522` | guardC veta 'tabla-no-autorizada' — salida determinística sin otra llamada (answerViaOracle.js:2628-2632) | vigente |
| buildAlcanceLine | `src/adi/oracle/progressiveDisclosure.js:734` | rama data_only/results_only cuando compuso el ledger (answerViaOracle.js:2457-2460, con reintento sin alcance si guardC  | vigente |
| _cifrasEnLinea | `src/adi/oracle/answerViaOracle.js:790` | forma prohibida por el usuario en la rama restringida (2458) y reemplazo de tabla por prosa/solo_conclusion (2800) | vigente |
| composePrecisionQuestion (clarify determinístico) | `src/adi/oracle/conversationScope.js:401` | reparación de clarify (answerViaOracle.js:1823-1833) — la pregunta redactada por el LLM falló y se compone una propia | vigente |
| clarify de simulación por supuestos_faltantes | `src/adi/oracle/answerViaOracle.js:2041` | plan de simulación con supuestos_faltantes — el turno se responde sin narrador | vigente |
| buildNarrationContract / buildClaims (leyenda de atribución y acciones permitidas) | `src/adi/oracle/narrationContract.js:640` | todo turno que llega a NARRAR — el contrato sellado es lo único que el narrador ve | vigente |
| stripLanguageLeaks / stripOutOfDataOffers / stripFiller (lavado de registro de la narración) | `src/adi/llm/voiceGuard.js:290` | solo sobre la salida del NARRADOR (answerViaOracle.js:2558-2560), las preguntas de clarify (1827/1833/2041) y, en la rut | vigente |
| answerADIFromSpec._degrade (degradaciones honestas de la ruta legada) | `src/adi/answerADIFromSpec.js:220` | camino LLM legacy (ChatADI.jsx:10 y 142-143: gateway→spec→answerADIFromSpec local) cuando el spec degrada (simulate-shap | legado-en-uso |
| answerADI + composers/* (piso determinístico legado) | `src/adi/answerADI.js:17` | ChatADI.jsx:138 y 436 — piso cuando el oráculo/gateway no resuelve; también answerConversational | legado-en-uso |
| composeSpec* (compositores de tools del oráculo, doble cableado) | `src/adi/specRetrieval.js:473` | tools del oráculo (toolRegistry) Y ruta legada answerADIFromSpec — el mismo módulo sirve a los dos embudos | vigente |

### F (38)

| Ruta | Archivo | Se activa cuando | Clase |
|---|---|---|---|
| _crossGuard (cruce imposible) | `src/adi/oracle/toolRegistry.js:93` | filters con una key que el composer no aplica (p.ej. filtro por SKU en queryMetric) o filters no-objeto con texto | vigente |
| redirect queryMetric→entityRecord | `src/adi/oracle/toolRegistry.js:198` | el plan filtra el eje por sí mismo: dimension:"cliente" + filters:{cliente:"Falabella"} | vigente |
| _METRIC_ALIAS «cobertura»→doh | `src/adi/oracle/toolRegistry.js:183` | metric ∈ {cobertura, días de inventario, días inv} en queryMetric | vigente |
| decisión 8 · _ejeNoAbierto/_filasDelEje/_ejeCanon | `src/adi/oracle/toolRegistry.js:160` | el composer sirvió supported:true pero el eje declarado o los sujetos de la boleta no son del eje pedido (fallback silen | vigente |
| entityProfile · auto-corrección de eje + enriquecimiento | `src/adi/oracle/toolRegistry.js:209` | perfil de una entidad; si el eje del plan no la encuentra reintenta con guessDimension (218-221) | vigente |
| entityComposicion · brechas por familia | `src/adi/oracle/toolRegistry.js:310` | composición de compra de un cliente por familia | vigente |
| entityCapitalLigado · decline decisión 9 | `src/adi/oracle/toolRegistry.js:338` | capital ligado al mix de un cliente cuando el cruce cliente×SKU no está observado (clientCapitalRelacion) | vigente |
| clientesPorSku · transpuesta cliente×SKU | `src/adi/oracle/toolRegistry.js:372` | plan pide qué cuentas compran unos SKU (entities/entityScope) | vigente |
| entityRecord · auto-corrección + varas por campo | `src/adi/oracle/toolRegistry.js:461` | fila completa de una entidad; reintento de eje con guessDimension (466-468); REFERENCIA_CAMPO agrega la vara autorizada  | vigente |
| gridTable · declinaciones propias | `src/adi/oracle/toolRegistry.js:513` | orden pedido por columna inexistente (519) o eje sin columnas propias — totalCount 0 (524) | vigente |
| tensionRead · decline de cruce | `src/adi/oracle/toolRegistry.js:498` | cruce de 2 métricas cuando el eje no tiene ambas columnas | vigente |
| _tagBodegaConflation | `src/adi/oracle/toolRegistry.js:548` | foco capital con items en 2+ bodegas (diagnose y executiveSummary) | vigente |
| diagnose · filtro string degradado en silencio | `src/adi/oracle/toolRegistry.js:567` | el plan manda un STRING libre en filters en vez de un objeto | vigente |
| inventoryStatus · rename contrapunta | `src/adi/oracle/toolRegistry.js:596` | facts.inventory.contrapunta presente | vigente |
| inventoryStatus · limite_transferencia (decisión 13) | `src/adi/oracle/toolRegistry.js:611` | transferenciaCapability.evaluable === false (siempre hoy: ningún SKU en 2 bodegas) | vigente |
| inventoryStatus · umbral_no_aplicado + _umbralDiasPedido | `src/adi/oracle/toolRegistry.js:630` | la pregunta literal (o staleDays) trae umbral de días y focus ≠ stale — regex sobre _preguntaUsuario (583-588) | vigente |
| inventoryStatus · focus:"stale" (el corte que SÍ aplica staleDays) | `src/adi/oracle/toolRegistry.js:590` | call con focus:"stale" (+staleDays) — composeSpecInventory filtra por diasSinVenta | dudoso |
| marginRead · Medida cerrar brecha / 1pp | `src/adi/oracle/toolRegistry.js:665` | marginRead con dimension ≠ cliente, filas bajo benchmark | vigente |
| salesRead/contributionRead · decisión 8 aplicada | `src/adi/oracle/toolRegistry.js:692` | eje no abierto o pivot interno que conserva el nombre del eje (vs_anterior por SKU devuelve clientes) | vigente |
| simulate (genérico legacy) | `src/adi/oracle/toolRegistry.js:708` | call {metric,dimension,transform} — delta-% lineal sobre un eje | legado-en-uso |
| simulateCarga / simulateCapital / simulateCosto | `src/adi/oracle/toolRegistry.js:716` | simulaciones nombradas de una palanca (carga al target · liberar capital · costo medio ±%) | vigente |
| simulateGeneral · guards de entrada y degrade honesto | `src/adi/oracle/toolRegistry.js:768` | 2 variables precio/volumen; declina por variables incompletas/iguales (770), 0%+0% (774), /pct/>50 (777-780), entidad no | vigente |
| pnlRead · niveles y declinaciones del P&L | `src/adi/oracle/toolRegistry.js:885` | pregunta por resultado/utilidad; declina sin P&L declarado (887-890), entidad fuera del canon (896), eje sin venta desgl | vigente |
| calcular · catálogo cerrado + razones en palabras | `src/adi/oracle/toolRegistry.js:1217` | operacion del catálogo con insumos por referencia | vigente |
| calcular · rescate determinístico a variacion_aplicada | `src/adi/oracle/toolRegistry.js:1254` | operación pedida no calza + exactamente 1 monto del motor y 1 tasa del usuario en el pool (incluye objetivo) | vigente |
| calcular · suma_filtrada (umbral del usuario) | `src/adi/oracle/toolRegistry.js:1141` | operacion:"suma_filtrada" con campo del inventario + umbral (diasSinVenta/doh/rotacion) | vigente |
| defineConcept · escalera de resolución | `src/adi/oracle/toolRegistry.js:1319` | pedido de definición; resuelve concept tal cual → «_»→espacios → frase literal del usuario (_preguntaUsuario) → declina | vigente |
| trend · bloqueo de futuro (_FUTURO) | `src/adi/oracle/toolRegistry.js:1350` | period del plan con frase temporal a futuro (regex 1350) | vigente |
| trend · límite declarado + marco_temporal + dirección resuelta | `src/adi/oracle/toolRegistry.js:1364` | métrica sin serie mensual (reason declarada) · serie servida | vigente |
| runPlan · ejecutor del batch | `src/adi/oracle/toolRunner.js:80` | todo plan del oráculo | vigente |
| runPlan · descomposición compareEntities→gridTable | `src/adi/oracle/toolRunner.js:139` | compareEntities con 3+ entidades distintas resueltas en el eje | vigente |
| _veraz / diagnosticarVacio (veracidad del vacío D7) | `src/adi/oracle/toolRunner.js:70` | toda declinación (supported:false) sin discriminador previo, con entidades nombradas en los args | vigente |
| _stampPeriodo | `src/adi/oracle/toolRunner.js:42` | resultado con boleta y sin periodo/marco_temporal propio | vigente |
| TOOL_CONTRACTS (tabla declarativa) | `src/adi/oracle/toolContracts.js:49` | consultada por applyMultiEntityScope/applySingleEntityScope/diagnosticarVacio | vigente |
| applyMultiEntityScope | `src/adi/oracle/toolContracts.js:357` | plan.scope.level==="list" con 2+ entidades | vigente |
| applySingleEntityScope | `src/adi/oracle/toolContracts.js:424` | plan.scope.level==="entity" con exactamente 1 entidad resuelta | vigente |
| detectScenarioIntent (bypass pre-PLAN de simulación) | `src/adi/oracle/scenarioIntent.js:156` | turno con EXACTAMENTE un campo (precio XOR volumen/unidades) y % con dirección resuelta; excluye pasado 3a persona (isHi | vigente |
| extractKnownEntity (canon 4 ejes del detector) | `src/adi/oracle/scenarioIntent.js:54` | texto del turno contra el canon cliente/marca/familia/SKU re-armado por tenant | vigente |

### Zona G (completitud) (19)

| Ruta | Archivo | Se activa cuando | Clase |
|---|---|---|---|
| gatewayFetch — router HTTP + candado de errores (los 5 endpoints pagos pasan por acá) | `src/adi/llm/gatewayFetch.js:70` | todo POST a /api/adi-spec/adi-narrate/adi-access/adi-plan/adi-narrate-c | vigente |
| rate limit de op:mint (_mintLimited) | `src/adi/llm/gatewayFetch.js:49` | /api/adi-access con op:"mint": >5 intentos/IP o >30/isolate en 10 min | vigente |
| puerta de acceso del gateway (_access + handleAccess) — denegación access:"denied" | `src/adi/llm/gatewayCore.js:100` | ADI_TOKEN_SECRET seteado y código ausente/vencido, en CUALQUIER llamada LLM (los 4 handlers) + ops status/check/mint_ena | vigente |
| freno de proveedor no declarado (resolverProveedor / mensajeFaltaProveedor · config_missing) | `src/adi/llm/providerConfig.js:31` | falta la env LLM_PROVIDER en cualquiera de los 4 handlers | vigente |
| rate limit por tenant del gateway (_checkRateLimit) | `src/adi/llm/gatewayCore.js:55` | >30 llamadas/60s por tenant (LLM_RATE_WINDOW_MS / LLM_RATE_MAX_PER_WINDOW) | vigente |
| presupuesto de escalamiento de modelo (_tierBudgetOk / _resolveModel + chooseModel) | `src/adi/llm/gatewayCore.js:89` | attempt≥1 que rutea a tier>1 cuando el tenant ya gastó >10 escalamientos/60s | vigente |
| timeout y errores tipados del adapter de proveedor (TIMEOUT_MS + sobreAjeno + errorDeRespuesta) | `src/adi/llm/adapters/anthropic.js:23` | el proveedor tarda más que LLM_TIMEOUT_MS (default 25000ms), responde con sobre de OTRO proveedor, o sin tool_call | vigente |
| entrypoints Vercel api/ (adi-plan · adi-narrate · adi-narrate-c · adi-spec · adi-access) | `api/adi-narrate-c.js:12` | todo request de producción a /api/adi-* | vigente |
| /api/version — metadata de despliegue | `api/version.js:25` | GET /api/version | vigente |
| server.js — server de producción self-host (gateway + SPA + 403/404/500) | `server.js:38` | npm start en un host Node 18+ (camino de DEPLOY.md, no el deploy actual) | dudoso |
| devGateway — plugin Vite del gateway (dev) | `src/adi/llm/devGateway.js:22` | dev server de Vite, POST a /api/* | vigente |
| guardC — el muro de 26 chequeos (la función madre, no solo sus dos ensure*) | `src/adi/oracle/guardC.js:2633` | toda narración del oráculo, en cada intento, antes de aceptarse | vigente |
| loop de reintento de PLAN + backoff 429 + corte por falta de crédito + backstop redirect-sin-calls | `src/adi/oracle/answerViaOracle.js:1609` | callPlan lanza (429/red/timeout) o devuelve plan inválido — hasta 3 intentos | vigente |
| presupuesto del hilo (aplicarPresupuestoHilo) — reescritura determinística del contexto que ven los dos LLM | `src/adi/oracle/hiloBudget.js:60` | todo turno del oráculo con hilo largo: PLAN recibe hasta 8000 chars, NARRAR hasta 6000 | vigente |
| entityGuard — veto por entidad fuera de evidencia (dentro de pickNarratedText, ruta legada) | `src/adi/llm/entityGuard.js:78` | narración legada (LLM#2 viejo) que menciona entidades que la evidencia del turno no trae | legado-en-uso |
| ensurePnlNarration — post-check F4 sobre la narración final del P&L | `src/adi/pnl.js:1823` | narración legada aprobada con evidence.kind "pnl" (después de number-guard y strips) | legado-en-uso |
| useViewContext / useVistaContext — el hook de emisión Sentrix→ADI (asks + contexto ambiente) | `src/ui/useViewContext.js:65` | montar una pieza declarada en viewManifest (ambient) o click en un ask de la Mesa | vigente |
| AskRow + cadena onAsk — los asks enlatados de la Mesa (prefill, cero disparo) | `src/ui/SentrixPanel.jsx:868` | click en una fila/botón "Preguntale a ADI" de cualquier panel de Sentrix | vigente |
| AccessGate / AdminAccess — la pantalla que intercepta la app entera | `src/ui/AccessGate.jsx:1` | access.required && !granted al abrir la app (o #acceso como vista previa); #admin para emisión | vigente |
