> Estado: PLAN v2 pendiente de revisión del owner (2026-09-25). Escrito por Fable, revisado por el supervisor (Opus). Reemplaza a `_ADI_PLAN_PRODUCTO_COMPLETO.md`. Sin commitear.

# Plan v2 · ADI como un GPT/Claude experto en su empresa (Fable, 2026-09-25 · segunda ronda)

> Solo lectura del repositorio (dev `f5fc501c`) y de las memorias; nada ejecutado, nada modificado. Responde a las
> tres preguntas del owner y reemplaza al plan anterior. Las siete leyes de producto del owner son el marco.

---

## PARTE A · Para el owner

### La conclusión

Su tesis se sostiene con seis capas: **ingesta con acta → realidad de la empresa → cerebro (cálculo,
procedimientos, conocimiento, simulación) → libro y Entrega verificada → capacidad de cuatro acciones con continuidad
propia → dos narradores** (el anfitrión en el Complemento; un narrador propio en el chat ADI). Toda verificación de
verdad ocurre **antes** del LLM; después no queda ningún juez de redacción, solo un instrumento de medición que no
toca el texto (lo explico como decisión). La ingesta no estaba resuelta en el plan: la agrego como contrato explícito
y primera etapa. La certificación sube de «90 %» a **cero errores materiales sobre miles de afirmaciones**, con el
tamaño estadístico dicho con honestidad.

### 1 · El contrato de ingesta

Tiene razón: el plan anterior la daba por resuelta. Hoy existe un camino base sólido (plantilla congelada, lectura
por código, validación con severidad, plausibilidad, moneda declarada, capacidades calculables y bloqueadas con su
porqué) y un camino para archivos fuera de plantilla, construido y apartado. Falta **unirlos bajo un contrato único**.
Propongo el **Acta de ingesta**, que ADI devuelve por cada carga:

- **Qué entra:** el dato del negocio (plantilla; ERP después), archivos de referencia (universo aparte, nunca se
  consolida), archivos heterogéneos (mapeo propuesto y confirmado) y lo que la empresa declara (perfil, políticas,
  hechos, documentos). Un LLM nunca lee filas: el archivo lo lee el código.
- **Qué devuelve ADI, por columna:** qué entendió, con qué origen (plantilla · sinónimo declarado · propuesta
  pendiente de su confirmación · confirmado por usted) y en qué estado (usada · ignorada y por qué · bloqueante ·
  pendiente).
- **Ambigüedades por materialidad.** Adopto la idea del supervisor con un límite. ADI calcula los resultados con
  cada interpretación posible (signo, bruto o neto, crédito o contado, granularidad, período a medias) y **pregunta
  solo cuando la diferencia es material** para las cifras que sirve; si no, sigue y deja el supuesto declarado y
  visible. El límite: **moneda, escala, período e identidad de la entidad se preguntan siempre** que el archivo no
  las declare, porque una escala inferida es la lección más cara del proyecto. Todo supuesto queda en el acta y en
  el marco de cada Entrega que lo use.
- **Mapa de capacidades:** qué quedó calculable y qué bloqueado, con el motivo, derivado del contrato.
- **Calidad del dato:** hallazgos con severidad (error real · redondeo · limitación), señales de plausibilidad como
  preguntas, compatibilidad entre universos, y el sello que acompaña a las cifras si usted decide seguir.
- **Qué se guarda para no volver a preguntar:** moneda, escala, perfil, políticas, mapeos confirmados de columnas y
  códigos, supuestos aceptados y lo que prefirió no decir; con vigencia e historia, en la memoria de empresa.
- **Quién pregunta:** ADI produce cada pregunta como ítem estructurado (campo, opciones, por qué importa, cuánto
  cambia). En la app, la pantalla de carga; en el Complemento y el chat ADI, el LLM con sus palabras, y la respuesta
  vuelve por «aportar contexto». Comprender la respuesta es del LLM; validar el código es de ADI.

### 2 · La certificación

**Error material**, definido con precisión, en cuatro clases:
1. **Cifra:** un número del texto que no existe en la Entrega con ese valor (a la precisión impresa), ese dueño, esa
   métrica, ese período y ese universo; o un número calculado por el LLM, aunque sea correcto.
2. **Entidad:** un hecho atribuido a otra cuenta, producto, marca, bodega o canal; o responder sobre una entidad
   distinta de la pedida.
3. **Concepto:** un hecho narrado como otra cosa: participación dicha como crecimiento, brecha estimada dicha como
   pérdida, cobranza dicha como caja, referencia dicha como meta, supuesto o declarado dicho como medido, causa o
   tendencia que la Entrega no sostiene, un límite obligatorio omitido.
4. **Historia empresarial:** una afirmación que contradice lo ya entregado en la conversación (una cifra que cambió
   sin que cambiaran los datos, un orden alterado, la conclusión del procedimiento sustituida en silencio, una
   premisa falsa del usuario aceptada, un cambio de datos no declarado).

No es material: el estilo, el orden de los párrafos, el redondeo a la precisión impresa, omitir hechos no
obligatorios.

**Dos capas.** La Entrega se certifica **por construcción y de forma exhaustiva**: cada hecho pasa por el libro antes
de imprimirse; se generan todas las Entregas del catálogo sellado con todas las versiones de datos de prueba y se
exige cero, sin muestreo y sin gasto. El narrador se certifica **en vivo**, por muestreo, con la aritmética honesta:
con cero errores en n afirmaciones, la cota superior al 95 % es 3/n. Para sostener «menos de 1 %» hacen falta 300
afirmaciones; «menos de 0,5 %», 600; **«menos de 0,1 %», 3.000; «menos de 0,05 %», 6.000**. Un turno tiene entre 8 y
12 afirmaciones. Propongo certificar cada canal con **cero errores materiales en al menos 3.000 afirmaciones (unos
300 turnos)**, y renovarlo cuando cambie el modelo del anfitrión.

**El set:** hilos de 20 o más turnos · cambio de datos a mitad · premisas falsas · pedidos no soportados (la
conversación sigue natural, sin cifra ajena) · ataques (causas sugeridas, «calcúlame», cifra equivocada insistida) ·
retomar días después. Lo escribe quien no implementa, se sella con huella y **se quema al leerlo**. Juzga un modelo
de otra familia, ciego; una persona audita el 10 % al azar y el 100 % de lo marcado.

**Ante un solo error material:** falla; causa raíz (en la Entrega → se arregla en ADI y entra al catálogo offline; en
el narrador → cambia la forma de la Entrega o la instrucción, nunca se agrega un juez de redacción); set quemado y
set nuevo completo.

**Naturalidad:** pares a ciegas del mismo modelo con y sin ADI (mismos datos crudos), juzgados por personas: usted,
el socio y al menos dos externos; 60 pares. **No inferior en naturalidad** (preferencia por ADI ≥ 45 %) y **superior
en utilidad, criterio y honestidad** (≥ 60 %). El juez de otra familia solo preselecciona.

**Costo:** por canal, 900 a 1.200 llamadas y 6 a 8 millones de tokens: **decenas de dólares**, con el contador de
consumo funcionando antes. **La escala:** ChatGPT y Claude son canales, no competidores; cada uno se certifica con el
mismo set y criterio, sin comparación publicada.

### 3 · El plan v2

**La decisión que usted pidió revisar.** Mi «verificación por búsqueda» era un policía de lenguaje: detenía y
regeneraba. Se retira. Queda un **rastreo de cifras no lingüístico**: cada número del texto se busca en la Entrega;
no lee gramática, no reescribe, no frena. Produce un sello por turno («12 cifras trazadas a ADI · 0 sin trazar») y
alimenta la certificación: es el mismo instrumento que cuenta errores materiales, usado como termómetro. «Que el
narrador no escriba dígitos» es el camino de las anclas: descartado. Si prefiere cero instrumentos después del LLM,
el sello se apaga y queda solo la medición.

**Qué se mantiene, se transforma o se retira** (tabla de destino en lenguaje de producto):

| Mecanismo | Destino | Razón · qué capacidad se preserva y dónde |
|---|---|---|
| Cálculo, lecturas y diagnóstico | **Se mantiene** | Es el cerebro. Alimenta la Entrega a través del encargo. |
| Prioridad integrada, contrato comercial, contrato de dominios | **Se mantienen** | Son procedimientos; ahora los dispara el encargo, no la frase. |
| Playbooks | **Se transforman** en procedimientos del compositor | Sus pasos y conclusiones siguen; sus disparadores por palabras y sus listas de vigilancia de prosa se retiran. |
| Escalera de respaldo | **Se retira** | La Entrega misma es legible: es el piso honesto. |
| Simulaciones | **Se mantienen**, etiquetadas en cinco piezas | Base, supuesto, resultado, delta y límites; entran por el encargo. |
| Libro de hechos, verificación exacta, definiciones de estados y tasas | **Se mantienen** | Verifican la Entrega antes del LLM. |
| Anclas, protocolo de re-anclaje, jueces de prosa declarada | **Se retiran** | Juzgaban texto de un modelo que escribía hechos. |
| Muro de 64 comprobaciones, vetos de registro, jueces de atributos | **Se retiran** tras migrar el chat | Sus leyes pasan a reglas de composición de la Entrega y a la rúbrica de certificación. |
| Agente de 24 herramientas en bucle | **Se retira** | Su mapa del dato pasa al catálogo; «registrar supuesto» a «aportar contexto»; el trato por nombre a la memoria. |
| Oráculo (segundo camino) | **Se retira** | Su voz (la persona) pasa al narrador propio; su ficha y su índice de entidades quedan en el cerebro. |
| Memoria de conversación (alcance, supuestos, ofertas) | **Se transforma** en el libro de conversación | La deixis («de esos…») la resuelve el LLM. |
| Detectores de intención y router por texto | **Se retiran** | La comprensión es del LLM; los botones de la pantalla emiten encargos tipados. |
| Guardia de voz (registro formal, voseo) | **Se transforma** | De filtro de salida a regla de composición del texto de ADI y a instrucción del narrador, medida en certificación. |
| Piso sin modelo (congelado) | **Se retira**; su registro de temas **se mantiene** | El registro alimenta el catálogo y el validador del encargo. |
| Conocimiento del oficio | **Se mantiene**, parte del cerebro | Sus heurísticas ejecutables corren por iniciativa; universal contra localizado. |
| Memoria: diario, contexto, conversaciones | **Se transforman** en una memoria de empresa única + libro por conversación | Nada se pierde: migra con historia. |
| Ingesta | **Se mantiene y se transforma** con el Acta | Plausibilidad → calidad del dato; mapeo apartado → vía para archivos heterogéneos con confirmación. |
| Sentrix (pantallas) | **Se mantiene** | Muestra el 01 y el 02; cada botón emite un encargo tipado sobre el cuadro exacto. |
| Selector de modelo por reintento | **Se retira** | Sin reparación no hay reintentos; un modelo capaz, proveedor neutral. |
| Telemetría | **Se mantiene y se enciende** con agregación | El contador de consumo, precondición de todo gasto. |

**Etapas** (cada una termina en algo que usted ve):
0. **Ingesta con acta + contador + catálogo sellado** (sin gasto). Ve: el acta de tres archivos (el demo, su planilla,
   uno heterogéneo).
1. **Entrega para cualquier pedido**, con orígenes, fuerza, iniciativa y tamaño gobernado. Ve: cuarenta Entregas.
2. **Continuidad propia**: memoria única, libro, estado vigente, retomar, premisas, varias consultas por turno. Ve:
   doce hilos con los mismos números.
3. **Capacidad y puerta** (MCP y Actions), perfil conversando, **certificación del Complemento** (primer gasto). Ve:
   ADI dentro de su ChatGPT y su Claude, y la cifra de errores materiales.
4. **Narrador propio y retiro** del agente, del oráculo y del muro, con certificación del chat ADI (gasto). Ve: su
   app respondiendo desde la Entrega, lado a lado con la anterior.
5. **Vara de naturalidad** con evaluadores humanos y piloto acompañado (gasto).

Conocimiento del oficio y perfil, en paralelo desde la etapa 0.

**Lo que le queda decidir:** si acepta el rastreo de cifras como instrumento sin policía (o prefiere cero); si ADI
guarda originales de documentos; y la palabra para cada gasto.

---

## PARTE B · Anexo para el supervisor

### B1 · Tabla de destino con archivos

| Mecanismo (archivos) | Destino | Dónde queda la capacidad |
|---|---|---|
| `oracle/toolRegistry.js` (24 tools), `specRetrieval.js`, `diagnosis/*`, `sentrix/mesa*.js`, `rolesCartera.js`, `core/*` | Mantener | Ejecutados por `encargo/lecturasDe.js` vía `runPlan`. |
| `agente/prioridadIntegrada.js`, `contratoComercial.js`, `contratoDeDominios.js`, `partesDelEncargo.coberturaDelEncargo` | Mantener (entrada = encargo) | Compositor; `coberturaDelEncargo` sobre `encargo.partes`. |
| `agente/playbooks/*` (`pasos`, `conclusiones`, forma) | Transformar → `entrega/procedimientos/` | `cuandoAplica` y `listaNotarial` se retiran. |
| Escalera (`respaldoAprobado.js`, línea honesta, genérico en `bucleAgente`) | Retirar | Piso = texto de la Entrega (`_textoDeLaEntrega`). |
| `simulateGeneral/Carga/Capital/Costo`, `assumptionRegistry.js` | Mantener + etiquetar 5 piezas | `cierre:"simulacion"` + `supuestos` con origen. |
| `notario/hechos.js`, `verificar.js`, `evidencia.js`, `estados.js`, `tasas.js`, `lexico.js` | Mantener (verifican ANTES del LLM) | `hechos.js` gana `composicion`/`fuerza`/`discrepancia`. |
| `notario/anclas.js`, `anclar.js`, `protocolo.js`, `afirmacion.js`, `declaracion.js`, `declarar.js`, `resolutor.js`, `ubicar.js`, `presencia.js`, `juez.js`, `estructura.js`, `carta.js`; `ADI_NOTARIO_V3` | Retirar (congelar en E1, borrar en E4 con anti-resurrección) | Definiciones de producto ya viven en `estados.js`/`tasas.js`. |
| `oracle/guardC.js`, `agente/contratoAgente.js` (vetos), `atributosYRelaciones.js`, `cifraSinBoleta.js`, `vetosDeRegistro` | Retirar en E4 (congelados desde E1) | Leyes → reglas de composición en `componer.js` + rúbrica; `_METRIC_VOCAB` → `lexico.js` (datos). |
| `agente/bucleAgente.js`, `catalogoAgente.js`, `herramientasAgente.js` (como tools del LLM), `doctrinaAgente.js`, `sistemaAgente.js`, `cartaAsesor.js` | Retirar en E4 | `mapaDelDato` → `capacidad/catalogo.js`; `registrarSupuesto` → `aportarContexto`; doctrina → cabecera de uso; `preferenciaNombre` → memoria de empresa. |
| `oracle/answerViaOracle.js`, `narratePromptC.js`, `planPrompt.js`, `narrationBlocks.js`, `narrationContract.js`, `progressiveDisclosure.js`, `responsePreference.js`, `dialogueState.js`, `cicloNotarial.js`, `api/adi-plan.js`, `adi-narrate*.js` | Retirar en E4 | `persona.js` → `directo/narrador.js`; `entityRecord.js`, `entityIndex.js`, `calculoCatalogo.js`, `ledger.js`, `datoProyectado.js` se mantienen en el cerebro/catálogo; `responsePreference` → `profundidad` del encargo. |
| `oracle/conversationScope.js` | Transformar | supuestos/ofertas/criterio → `continuidad/libro.js`; deixis y ordinales se retiran. |
| `detectors.js`, `intentLayer.js`, `router.js`, `fichaIntent.js`, `serieIntent.js`, `scenarioIntent.js`, `criteria.detectCriteriaIntent`, `partesDelEncargo(pregunta)`, `coberturaCorta.js`, `encargoCompuesto.js`, `reformular.esReformular`, `porque.esPorQue`, `answerADI.js`, `answerADIFromSpec.js` | Retirar en E4 | `criteria.composeCriteria` (criterio vigente) se mantiene; `viewContext.js` → los `ask` de cuadro emiten encargos tipados. |
| `llm/voiceGuard.js` | Transformar | `stripLanguageLeaks`/`detectVoseo` como reglas de composición del texto de ADI (`verificarEntrega`) e instrucción del narrador; `_registro_gate` (repo) se mantiene; ningún filtro sobre salida del LLM. |
| `dominios.js` (`DOMINIOS_REGISTRO`), `metricRegistry.js` | Mantener | Catálogo + validador del encargo. Reconocedor (`0349f4aa`/`13adf988`) se retira. |
| `conocimiento/*` | Mantener, integrar | Heurísticas ejecutables → hechos de iniciativa; `universalidad`, `alcanceCalza`. |
| Migraciones 004/006/007/011 (moneda, cobro, diario, contexto), 009 | Transformar → 015 memoria de empresa única; 009 + `estado` | Con migración de datos; nada se pierde. |
| `ingesta/*`, `plantilla/motorKpi.js`, `plausibilidad.js`, `disponibilidad.js`, `mapeoDeterministico.js`, `ingestaColumnas.js`, `validationRules.js` | Mantener + Acta | Ver B2. |
| `ui/SentrixPanel.jsx`, `sentrix/viewManifest.js`, `viewContextFrom.js` | Mantener | `ask` → `encargo` tipado con `viewContext`. |
| `llm/modelRouter.js`, `modelPricing.js` (tabla) | Retirar router; mantener precios | `providerConfig.js` neutral. |
| `llm/telemetry.js`, `telemetrySink.js` | Mantener, encender + agregación | `_consumo_gate`. |
| `llm/numberGuard.js`, `entityGuard.js` (Falcon) | No tocar | Regla del repo. |
| `bypassConfianza.js` / `sin_pago` | Transformar | «Respuesta sin narrador» = servir la Entrega breve. |

### B2 · Contrato de ingesta (pseudo-JSON)

```
ActaDeIngesta {
  carga: { id, tipo: "negocio"|"referencia"|"heterogeneo", fuente: {archivo, hojas[]}, version, fecha, actor },
  columnas: [{ hoja, columna, campo: clave de plantilla|metricRegistry|null,
              origen: "plantilla"|"sinonimo_declarado"|"propuesta_modelo"|"confirmado_usuario",
              estado: "usada"|"ignorada"|"bloqueante"|"pendiente", unidad?, escala?: "declarada"|"preguntar",
              motivo? }],
  fundamentales: { moneda, escala, periodo: {desde, hasta, dias}, entidadEje },     // se preguntan SIEMPRE si faltan
  ambiguedades: [{ id, campo, candidatas: [{ interpretacion, resultados: [{metrica, valor}] }],
                  materialidad: { deltaMax, piso: "pisoFocosUSD"|"PRI-04 1%", material: bool },
                  accion: "preguntar"|"seguir_declarando", supuestoElegido?, pregunta: {texto canónico, opciones} }],
  capacidades: { calculables: [id de CALCULOS + metricRegistry.sourceByAxis], bloqueadas: [{ id, porque, paraAbrirlo }],
                 caras: disponibilidad.CARAS, ausencias: ausenciasDe() },
  calidad: { hallazgos: validationRules (blocker|warning|info), plausibilidad: [{señal, cifras, pregunta}],
             compatibilidad: motorKpi.compatibilidad, selloDeLectura },
  memoriaEmpresa: [{ clase: "moneda"|"escala"|"perfil"|"politica"|"mapeoColumna"|"mapeoCodigo"|"supuestoIngesta"|"omitido",
                     valor, origen, confirmacion, vigencia }],
  preguntas: [{ id, campo, porQue, cuantoCambia, opciones, canal: "pantalla"|"llm" }]   // el LLM redacta; ADI valida el código de vuelta
}
```
Reglas: lectura solo por código (`leerLibro.js`); mapeo fuera de plantilla = `mapeoDeterministico` → propuesta de
modelo con encabezados + muestra (~500 tokens, gasto nombrado) → confirmación humana; `escala` y `moneda` jamás
inferidas (`unidadesConfirmadas`); la evaluación de materialidad corre el motor con cada candidata (puro, offline);
toda respuesta entra por `aportarContexto` con `clase` de la memoria de empresa. Candado `_acta_ingesta_gate`:
demo → acta completa sin preguntas; planilla del owner → idem; archivo heterogéneo sintético → columnas
`pendiente` + preguntas ordenadas; carnada: escala ambigua sin pregunta = rojo; supuesto no material sin declarar = rojo.

### B3 · Protocolo de certificación

**Capa ADI (E1-E2, gratis, exhaustiva):** catálogo sellado de encargos (≥ 300: 60 por cierre × 5 cierres, multi-tema,
defectuosos) × versiones de datos (demo, planilla del owner, empresa2, pack de un mes) → toda Entrega con
`verificarEntrega` verde, 0 hechos no verificables impresos, 0 sin crudo «verificada», cobertura, tope; continuidad:
12 hilos × 6 + 3 hilos × 20 con cambio de versión; premisas falsas tipadas → veredicto. Cero tolerancia, población
completa. Gates: `_entrega_general_gate`, `_continuidad_gate`, `_premisas_gate`.

**Capa narrador (E3 Complemento; E4 directo), por canal:**
- Set sellado por quien no implementa (huella sha256, se quema al leerlo): 40 hilos = 25 × 8 turnos + 10 × 20 turnos
  + 5 × 6 con cambio de datos; dentro: 40 premisas falsas, 30 pedidos no soportados, 40 ataques (causa sugerida,
  «calcúlame», cifra equivocada insistida, «dame la meta»), 10 «retomar» tras corte. ≈ 330 turnos ≈ 3.000-3.500
  afirmaciones.
- Medición: rastreo numérico (`directo/rastreo.js`: número → hecho por valor+dueño+métrica+período; clases 1 y 2) +
  juez de otra familia, prompt congelado y hasheado, ciego (clases 3 y 4, con la Entrega y el libro de conversación
  a la vista) + auditoría humana del 10 % aleatorio y del 100 % marcado.
- Criterio: **0 errores materiales** → cota 95 % ≤ 3/3.000 = 0,1 %. Un error → falla, causa raíz, set quemado, set
  nuevo. Los turnos fallidos entran como fixtures offline (rojo primero).
- Naturalidad (E5): 60 pares (ADI vs mismo modelo con el pack crudo en contexto), 4 evaluadores humanos a ciegas =
  240 juicios; no inferioridad en naturalidad (≥ 45 %), superioridad en utilidad/criterio/honestidad (≥ 60 %); juez
  LLM solo como preselección.
- Costo por canal: ~330 turnos × (narrador 1-2 + juez 1) ≈ 900-1.200 llamadas; ~6-8 M tokens; decenas de dólares
  (cotizar con `_consumo_gate` verde). Naturalidad: +120 llamadas. Re-certificar al cambiar el modelo del anfitrión.
- Escala: ChatGPT y Claude como canales con el mismo set; sin ranking entre ellos.

### B4 · Etapas y candados

| # | Construye | Candado offline | Gasto |
|---|---|---|---|
| 0 | Acta de ingesta (B2); telemetría encendida + agregación; catálogo de encargos sellado | `_acta_ingesta_gate`, `_consumo_gate` | 0 |
| 1 | `encargo/*`; `componerEntrega(encargo)`; `composicion`/`fuerza`; iniciativa; tentaciones; `profundidad` + detalle por ref; crudo obligatorio | `_encargo_gate`, `_entrega_general_gate`, `_origenes_gate`, equivalencia byte a byte, `_raw_gate` | 0 |
| 2 | `continuidad/*`; migración 015 (memoria única + `estado` en 009); estado vigente; retomar; premisas; presupuesto de consultas | `_continuidad_gate`, `_premisas_gate`, gate de texto de 015 | 0 |
| 3 | `capacidad/*`; MCP + OpenAPI en `api/` sobre el pase HMAC; perfil conversando; universal/localizado | `_capacidad_gate` (tenant ajeno rechazado; cada entrada con productor), `_perfil_conversando_gate` | Certificación Complemento (B3) |
| 4 | `directo/narrador.js` (4 acciones, ≤ 3 consultas + 1 narración), `directo/rastreo.js` (sello, sin veto), bandera `ADI_DIRECTO_ENTREGA`; retiro con anti-resurrección | `_narrador_gate` (cerebro inyectado: el rastreo cuenta, no frena), `_certificacion_congelada_gate` re-apuntada, `_poda_v2_gate` | Certificación directo |
| 5 | Corpus de naturalidad; auditoría humana; piloto | hash de rúbrica/corpus/prompt del juez | Naturalidad + piloto |

**Riesgos:** recrear el agente en el narrador (presupuesto de consultas, solo cuatro acciones, llamadas por turno
medidas) · regresión de capacidad al migrar directo (certificación congelada, rojo primero) · equivalencia byte a
byte (~800 líneas no leídas) · sesión en Actions/MCP sin verificar · 81 commits sin publicar en dev · el juez de otra
familia también se equivoca: por eso la auditoría humana decide en lo marcado · «materialidad» de la ingesta exige
que el motor corra con cada candidata: costo de cómputo, no de dinero.

---

## Ajustes del supervisor (Opus, 2026-09-25)

1. **Naturalidad con margen estadístico:** «no inferior» = el límite INFERIOR del intervalo de confianza al 95 % de la
   preferencia por ADI ≥ 45 % (con 240 juicios, ±6 pts: exige observar ≈ 51 %); «superior» = límite inferior ≥ 55 %
   en utilidad, criterio y honestidad. Un porcentaje observado solo no alcanza.
2. **El sello del rastreo es interno** (auditoría y certificación); jamás aparece en el texto al usuario (ley de
   continuidad invisible).
3. **Consecuencia de «ningún policía después del LLM»:** en el chat ADI, un error del narrador llega al usuario; la
   protección es la calidad de la Entrega + la instrucción + la certificación, y el rastreo lo cuenta. Se le dice al
   owner tal cual.
4. Retirar los detectores cambia el contrato de entrada de ADI (los `ask` de Sentrix pasan a encargos tipados):
   CLAUDE.md §3 lo protegía; lo autoriza la dirección de producto del owner (mecanismos = arquitecto) y se hace en E4
   con la certificación congelada re-apuntada.
