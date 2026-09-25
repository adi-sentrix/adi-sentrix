> Estado: PLAN pendiente de revisión del owner (2026-09-25). Escrito por Fable, revisado por el supervisor (Opus). Integra `_ADI_PROPUESTA_FLUJO_PRODUCTO.md` y `_ADI_DISENO_FLUJO_V2.md` (revisiones 2 y 3). Sin commitear.

> ⚠️ HISTORIA (2026-09-25): el plan vigente es `_ADI_PLAN_PRODUCTO_V2.md`, aprobado por el owner.

# El plan completo · ADI como un GPT/Claude experto en su empresa (Fable, 2026-09-25)

> Escrito solo con lectura del repositorio (dev `f5fc501c`, 81 commits por encima de producción v2.30) y de las
> memorias. Sin ejecutar nada, sin gasto. Integra todo lo decidido hoy sin reabrirlo.

---

## PARTE A · Para el owner

### La conclusión

La mitad difícil ya está decidida: ADI escribe primero (la Entrega, verificada y con origen), el LLM habla después.
Lo que falta es **cerrar el circuito** —una puerta por la que el LLM pida, una Entrega para cualquier pedido, una
memoria que viva en ADI— y **quitar del camino lo que se construyó para el orden inverso** (un modelo que escribía
hechos y una casa que después los juzgaba). Hoy ADI tiene un cerebro y medio: su chat propio usa un agente con 24
herramientas y un muro de 64 comprobaciones, y el Complemento no existe. Propongo **un solo cerebro y dos
narradores**: el anfitrión (ChatGPT/Claude) en el Complemento y un narrador propio en ADI directo, **los dos con las
mismas cuatro acciones y la misma Entrega**. Cinco etapas; cada una termina en algo que usted puede leer o usar. El
gasto aparece en la tercera.

### 1 · Qué falta realmente

1. **La puerta y el encargo tipado.** Ningún LLM puede pedirle nada a ADI; sin esto nada se prueba en el canal real.
2. **Una Entrega para cualquier pedido, con profundidad de CFO.** Hoy responde cuatro preguntas fijas. Debe traer, sin
   que nadie lo pida, lo que un controller investigaría antes de responder (ya es ley), las cuentas que tientan al
   modelo (totales, participaciones, diferencias) ya hechas, y un tamaño gobernado: versión breve, completa con tope,
   y el detalle por referencia. Eso resuelve también las 948 palabras de la lectura multidominio.
3. **Varias consultas en un turno, sin recalcular.** Un LLM que razona como Code pregunta, profundiza y compara antes
   de responder. ADI admite un presupuesto corto de consultas por turno; la segunda devuelve solo lo nuevo, con los
   mismos identificadores. El LLM nunca calcula: pide.
4. **La memoria en ADI, unificada.** Hoy hay tres memorias parciales (diario, contexto, conversaciones). Falta una sola
   memoria de empresa (con vigencia e historia) y un libro por conversación con identificador emitido por ADI, estado
   vigente en la capa estructurada y la acción «retomar». Decidido; falta construirlo.
5. **Cuatro orígenes con composición y fuerza en cada cifra**, y la simulación en cinco piezas. Decidido; falta
   construirlo. Más una regla de higiene: ninguna cifra sin valor crudo puede llamarse «verificada» (de ahí nació el
   36,3 → 36,1).
6. **ADI directo sobre la misma Entrega.** Su chat propio pasa a ser el narrador que llena el encargo, recibe la
   Entrega y la narra; la verificación se reduce a una búsqueda: cada cifra del texto existe en la Entrega con ese
   dueño, el orden no cambió, la conclusión del procedimiento está, el origen se nombra cuando no es medido.
7. **Conversación natural cuando el pedido no está soportado.** Lo no resuelto vuelve declarado, con alternativas y el
   catálogo de lo que sí puede; el LLM sigue conversando sin inventar. Es un hecho, no un error.
8. **Un contador de consumo.** Sin él ninguna medición es creíble.
9. **Perfil conversando y conocimiento del oficio**: horas suyas y del socio, en paralelo desde el inicio.

### 2 · Qué sobra o interfiere

Dicho con claridad, incluido trabajo mío reciente:

- **El Notario v3 / v3.1 completo (anclas, re-anclaje, poda, 55 comprobaciones, ronda 6 → E6 → E7 y sus tres
  decisiones abiertas) se detiene.** Se construyó para un modelo que escribe hechos; si el modelo narra hechos ya
  verificados, no hay anclas que juzgar. Nunca se encendió en producción: detenerlo no cuesta producto. **Queda** su
  mitad valiosa: el libro de hechos con identificadores, la verificación exacta y las definiciones de estados y tasas.
  Eso es lo que verifica la Entrega antes de salir.
- **El muro de 64 comprobaciones y los vetos de registro** siguen solo mientras el chat propio use el agente actual:
  se congelan desde hoy y se retiran cuando ADI directo migre.
- **El agente de 24 herramientas en bucle y el oráculo como segundo camino** son el «segundo cerebro» que la ley
  prohíbe. Sus procedimientos (contrato comercial, dominios, prioridad integrada, playbooks, simulaciones) **se
  conservan** en el compositor; se retiran el bucle y la red de respaldo con cerebro. La red final pasa a ser la
  Entrega misma, que es legible. Con ellos se va el selector de modelo por reintento (solo OpenAI).
- **El piso sin modelo, el encargo natural y los detectores por palabras** ya están congelados; el encargo tipado los
  reemplaza.
- **De mi propio diseño**: la etiqueta «origen titular = el peor» ya fue reemplazada por composición + fuerza; las dos
  tablas nuevas que propuse serían una tercera memoria —acepto la recomendación del supervisor: una sola memoria de
  empresa que absorbe diario y contexto, y el libro dentro de las conversaciones existentes—; y «cada Entrega abre
  con lo ya entregado» contradecía la continuidad invisible.
- **El plan del «resolvedor» del 22 de septiembre queda superado**, y **la segunda corrida del examen del agente** no
  se corre: se examina el narrador nuevo.

### 3 · Qué piezas hay que cerrar

Ocho, y solo esas: encargo tipado con validador · compositor general con iniciativa, tentaciones y tamaño · orígenes
y fuerza · continuidad en ADI (memoria única, libro, estado vigente, retomar, premisas, consultas por turno) · la
capacidad de cuatro acciones y la puerta (MCP y Actions, identidad por token) · el narrador propio con verificación
por búsqueda · perfil conversando y conocimiento · contador de consumo y la vara.

### 4 · En qué orden, y qué ve usted al final de cada etapa

**Etapa 1 · «ADI responde a cualquier pedido» (sin gasto).** Encargo tipado, compositor general, orígenes y fuerza,
tamaño gobernado, crudo obligatorio. Antes de construir, alguien que no implementa sella un catálogo de encargos.
**Usted ve:** cuarenta Entregas de preguntas de un controller, en un documento.

**Etapa 2 · «ADI recuerda» (sin gasto).** Memoria única, libro de conversación, estado vigente, retomar, premisas,
varias consultas por turno, cambio de datos a mitad. **Usted ve:** doce hilos de seis pedidos, legibles, con los
mismos números e identificadores; uno con cambio de datos a mitad.

**Etapa 3 · «ADI dentro de su ChatGPT o su Claude» (primer gasto).** Catálogo generado, cuatro acciones, puerta con
identidad, perfil conversando, contador de consumo, migraciones con su palabra. **Usted ve:** conversa con su empresa
desde Claude o ChatGPT; y la primera medición creíble (comprensión, paráfrasis, hilos).

**Etapa 4 · «ADI directo con el mismo cerebro».** Narrador propio, verificación por búsqueda; bucle y oráculo apagados
detrás de bandera y luego retirados. **Usted ve:** su app respondiendo desde la Entrega, lado a lado con la versión
anterior, y el examen vivo del narrador.

**Etapa 5 · «La vara».** Juez de otra familia, ciego, contra el mismo modelo sin ADI; verdad binaria; la prueba del
residuo (si lo que ADI no pudo decir contiene criterio, matices o conversación natural, no llegamos); calibración
humana de treinta casos. **Usted ve:** un número por dimensión y la lista de lo que quedó fuera.

**En paralelo desde la etapa 1:** conocimiento del oficio (piezas 3 en adelante, revisión de PRI-04 y CAU-01).

**Se detienen:** Notario v3 (ronda 6, E6, E7, decisiones pendientes) · resolvedor · piso sin modelo · encargo
natural · segunda corrida del examen del agente · toda extensión del muro. **Se reencauzan:** UX de la app (recibirá
la Entrega y el estado vigente como fuente) · datos del cliente (la memoria única entra por su misma vía).

### 5 · Cómo se demuestra que llegamos

Dos capas y una sola medición en vivo, sin comparar proveedores.

**Lo que ADI garantiza sola (gratis, cada etapa):** cero cifra de otro concepto u otra entidad · cero adivinanza · todos
los temas pedidos cubiertos · cada hueco declarado · cada cifra con dueño, período, origen y fuerza · ninguna cifra
sin crudo llamada verificada · mismos identificadores en toda la conversación · turnos sin evento = cero texto de
continuidad · cada Entrega dentro de su tope.

**Lo que solo se demuestra con el LLM (gasto nombrado, dos veces):** en la etapa 3, encargo correcto ≥ 90 %, valor y
dueño sobreviven ≥ 90 %, cero cifras inventadas en ≥ 95 %, aritmética propia ≤ 5 %, cero hilos con historia falsa.
En la etapa 5, la vara: comprensión, hilo, criterio, naturalidad y profundidad iguales o mejores que el modelo crudo;
honestidad y verdad estrictamente mejores; residuo vacío. La prueba de invisibilidad ya no aplica (no hay
reparación): la reemplaza la coherencia del hilo.

### Las decisiones que le quedan

1. **ADI directo migra a la Entrega** (etapa 4); bucle, oráculo y muro se retiran después.
2. **Detener el Notario v3** con sus tres decisiones abiertas, y congelar el muro sin extenderlo.
3. **Una sola memoria de empresa** que absorbe diario y contexto, y el libro dentro de las conversaciones existentes.
4. **Si ADI guarda los documentos originales** (necesario para «verificado»; puede esperar a la etapa 3).
5. **El orden del gasto:** medición en la etapa 3, examen del narrador en la 4, la vara en la 5; ninguno sin el
   contador de consumo funcionando.

---

## PARTE B · Anexo para el supervisor

Todo offline, detrás de banderas, solo `npm run gates:offline`. Ningún reconocedor de frases en ninguna pieza.

### Etapa 1 · Encargo + compositor general + orígenes/fuerza

- **Construye:** `src/adi/encargo/{esquema,validar,lecturasDe}.js` (Encargo v1 de la propuesta + `conversacionId` +
  `premisas` + `supuestos` con origen + `profundidad: breve|completa` + `usar`); `componerEntrega(encargo)` en
  `entrega/componer.js` (lectura por tema × forma por cierre); en `notario/hechos.js`: `composicion` (lista de insumos
  con origen, id y rol) y `fuerza` (verificada · condicionada · hipotética) calculadas aparte, hecho `discrepancia`,
  `procedencia` legado por tabla fija; `fig({origen})` en `boleta.js`/`figureType.js`; hechos `derivada` de
  tentaciones; hechos de iniciativa (heurísticas ejecutables de `conocimiento/` + `contratoComercial` + cruces se
  corren sin pedido); tope por profundidad y «detalle por referencia» (`consultar` con `contexto.hechos_ref`);
  ausencia `documento_no_verificable`; **crudo obligatorio**: sin `raw` no hay fuerza «verificada».
- **Reusa:** `runPlan`, `TOOL_CONTRACTS` (24), `pasosDe`/playbooks, `contratoDeDominios`, `prioridadIntegrada`,
  `compareEntities`, `simulateGeneral` (etiquetado en cinco piezas), `libroDeHechos`/`verificar.js`/`evidencia.js`,
  `estados.js`/`tasas.js` como definiciones, `referenciaDelOficioConOfertas`, `verificarEntrega`.
- **Retira/congela:** fuera del camino de la Entrega: `cuandoAplica` (30 detectores), `partesDelEncargo(pregunta)`,
  `coberturaCorta`, `encargoCompuesto`, `_entidadesDeLaPregunta`. **Congelados sin commits:** `anclas.js`, `anclar.js`,
  `protocolo.js`, `afirmacion.js`, `declaracion.js`, `resolutor.js`, `ubicar.js`, `presencia.js`, `juez.js`,
  `carta.js`, `ADI_NOTARIO_V3`; ronda 6/E6/E7 canceladas; `_ronda5_gate` sigue verde pero deja de ser objetivo.
- **Candado:** `fixtures/encargos-sellados.json` (60 válidos / 20 defectuosos, escrito por quien no implementa) ·
  `_encargo_gate` (0 adivinanza, `noResuelto` por parte, plan determinístico) · `_entrega_general_gate` (40 encargos
  CFO: verificador verde, 0 dígito fuera del libro, cobertura, tentaciones e iniciativa presentes, tope de tamaño) ·
  `_origenes_gate` (declarado ≠ medido → ambos; composición completa; fuerza = insumo más débil; simulación en cinco
  piezas) · equivalencia **byte a byte** de las cuatro rutas actuales · `_raw_gate` (0 «verificada» sin crudo).
- **Gasto:** ninguno.

### Etapa 2 · Continuidad en ADI

- **Construye:** `src/adi/continuidad/{empresa,libro,estadoVigente}.js` detrás de interfaz (memoria en pruebas,
  persistencia después); migración 015: **una** memoria de empresa (absorbe `perfil.diario` 007 y `perfil.contexto`
  011 con migración de datos; `'declarado'` en los checks de 012) y `estado jsonb` en `conversaciones` (009) como
  libro; estado vigente en la capa estructurada con instrucción de no narrarlo; eventos → una línea al texto;
  `retomar`; premisas tipadas por `libroDeHechos`; presupuesto de consultas por turno (propuesta: 3) con Entrega
  incremental (solo hechos nuevos + refs); cambio de `versionId` a mitad.
- **Reusa:** `conversationScope.supuestos`, huella del diario, `idDeCargaActiva`, RPCs 006-011 como patrón.
- **Retira:** nada aún; `conversationScope` (deixis) sigue solo en directo hasta la etapa 4.
- **Candado:** `_continuidad_gate` (mismos ids dos veces; versión cambia; id no devuelto → capa c nueva, a y b
  intactas; tope 16 KB; turnos sin evento = 0 texto; incremental sin recálculo: mismos ids) · gate de texto de la 015
  + doble en memoria.
- **Gasto:** ninguno (migraciones las aplica el owner al llegar a la etapa 3).

### Etapa 3 · Capacidad + puerta + perfil conversando + primera medición

- **Construye:** `src/adi/capacidad/{catalogo,acciones}.js` (catálogo generado desde `DOMINIOS_REGISTRO`, `METRICS`,
  `TOOL_CONTRACTS`, `BLOQUEADOS`, `ausenciasDe`, `CRITERIOS`, `ASSUMPTIONS`; cuatro acciones puras); servidor MCP
  (HTTP) + OpenAPI para Actions en `api/`, bearer con el pase HMAC existente, tenant del token, RLS; perfil conversando
  (`ROTULOS_PERFIL`, `necesitaPerfil`, aporte `clase:"perfil"`, `alcanceCalza`, `universalidad` en piezas, puerta 2 de
  `seleccionar.js`); **contador de consumo**: agregación por corrida sobre `llm/telemetry.js` (ya emite los nueve
  campos con sink apagado) + `modelPricing.estimateCostUSD` → `_consumo_gate` (una corrida sin registro = rojo).
- **Reusa:** `accessToken.js`, patrón `api/adi-*.js`, `contractMenu.js`/`capabilities.js`, `taxonomiaPerfil.js`,
  migraciones 012-014.
- **Retira:** nada en producción.
- **Candado:** `_capacidad_gate` (cada entrada del catálogo con productor; tenant ajeno rechazado; sin cifras en el
  catálogo) · `_perfil_conversando_gate` · `_conocimiento_gate` extendido (cuatro piezas `sin_revisar` = hoy).
- **Gasto (nombrado por el owner):** A comprensión: set nuevo sellado de ~70 frases → ~70 llamadas · B paráfrasis:
  60 Entregas × 1 narrador × 3 formas = 180 + 180 juicios de otra familia · C hilos: 12 × 6 = 72 turnos + juicios.
  Orden de magnitud: ~600-700 llamadas, ~3 M tokens, **decenas de dólares**; cotizar con el contador funcionando.

### Etapa 4 · ADI directo sobre la Entrega

- **Construye:** `src/adi/directo/narrador.js` (persona + las cuatro acciones como herramientas; ≤ 3 acciones + 1
  narración; techo 5 llamadas por turno; cerebro inyectado para los gates) y `busqueda.js` (< 200 líneas, sin español
  literal: cifra con dueño · orden · conclusión presente · origen nombrado cuando no es medido); fallo → una
  regeneración desde la Entrega; segundo fallo → se sirve el texto de la Entrega. Bandera `ADI_DIRECTO_ENTREGA`;
  cascada en `ChatADI.jsx`: narrador → Entrega (sin oráculo). Proveedor neutral desde el día uno.
- **Reusa:** `persona.js`, `preferenciaNombre.js`, panel de historial, sello de carga, `stripLanguageLeaks`, vetos
  léxicos de superficie (meta/target) como datos.
- **Retira (bandera → retiro con candado anti-resurrección, como La Poda):** `bucleAgente.js` (1.953), `guardC.js`
  (8.103), `contratoAgente.js` vetos, `atributosYRelaciones.js`, `answerViaOracle.js` (3.328), `narratePromptC.js`,
  `planPrompt.js`, `modelRouter.js`, `cicloNotarial.js`, `respaldoAprobado.js`, y el resto del Notario congelado en
  la etapa 1. Quedan: `hechos.js`, `verificar.js`, `evidencia.js`, `estados.js`, `tasas.js`, `lexico.js`.
- **Candado:** `_narrador_gate` con guiones maliciosos (cifra fuera de la Entrega · orden cambiado · conclusión
  borrada · origen omitido · segunda consulta que recalcula) → regeneración → Entrega · `_certificacion_congelada_gate`
  re-apuntada al camino nuevo (los 28 turnos de conducta, rojo primero) · anti-resurrección.
- **Gasto:** examen vivo del narrador, ~40 turnos; con el contador, ~US$1-3 (orden de magnitud); después del gate.

### Etapa 5 · La vara

- **Construye:** corpus versionado (12 hilos × 6 turnos + 60 Entregas × 3 formas), rúbrica de seis dimensiones +
  verdad binaria, prompt del juez congelado y hasheado (otra familia, ciego), comparador = el mismo modelo narrador
  sin ADI, prueba del residuo, coherencia del hilo (sustituye a invisibilidad), calibración humana (30 casos, ≥ 80 %).
- **Gasto:** ~120 conversaciones × (narrador + comparador + juez): ~700-1.000 llamadas; decenas de dólares.

### Riesgos

1. **Recrear el segundo cerebro en el narrador**: un LLM con muchas consultas por turno vuelve a ser el agente. Mitiga
   el presupuesto de consultas y que solo existan cuatro acciones; se mide en el examen (llamadas por turno).
2. **Regresión de capacidad al migrar directo** (lección del examen 1: muro perfecto, capacidad regresionada). La
   certificación congelada se re-apunta y se corre rojo primero.
3. **Equivalencia byte a byte** de las cuatro rutas (~800 líneas no leídas): puede costar más de lo estimado; el
   candado es obligatorio igual.
4. **Sesión en Actions/MCP** no verificada: afecta solo cuánto se pierde la capa c; se mide (`uso.continuidadDevuelta`).
5. **Tamaño**: los anfitriones cortan sin avisar; el tope por profundidad y el detalle por referencia son la
   mitigación, y la paráfrasis lo mide.
6. **81 commits sin publicar en dev** (piso sin modelo incluido, congelado): el deploy es decisión aparte; lo nuevo
   viaja apagado por bandera, como siempre.
7. **Conocimiento vacío fuera de distribución** y **originales de documentos** (privacidad): decisiones del owner,
   no de código.
8. **Costo real desconocido hasta el contador**: por eso es precondición de todo gasto.
