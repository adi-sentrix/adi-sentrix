# Criterio ejecutivo en el Complemento · diseño de producto para la Etapa 3 (v3, final)

> Fable, 2026-10-09 · solo diseño, nada implementado, sin gasto. Reemplaza la v2 del mismo día.
> **Qué cambió de v2 a v3:** el owner aprobó la dirección con dos precisiones. (1) **ADI no concluye que una estrategia «compensa» por criterio
> propio**: el veredicto existe solo contra un criterio declarado por la empresa; sin criterio, ADI mide (aporta · cede · resultado) y no decide si
> vale la pena. Lo que la v2 llamaba «ADI demuestra el no compensa» pasa a ser **hechos medidos** (contribución negativa, premisa incumplida, fuga no
> cubierta), nunca un veredicto. (2) **Una carga nueva no vence una estrategia**: la vigencia la declara la empresa; la carga dispara revalidación.
> Se agrega la sección «Flujo completo de una señal» (diagrama de estados, Lider en tres sesiones, un caso sin criterio) y se ajusta la rúbrica.
> Decisiones del owner registradas en la última sección como aprobadas (2026-10-09).

## En corto

1. **La columna vertebral:** detectar → medir → separar hecho de hipótesis → preguntar por la intención → guardar esa intención con alcance y vigencia → volver a medirla contra resultados → entregar los antecedentes al LLM, que interpreta y conversa libre.
2. **Un margen bajo no es un problema automático.** Una señal es **anomalía** (desvía y es material), **estrategia declarada** (la empresa lo confirmó, con alcance y vigencia) o **problema** (fuga probada no cubierta, o criterio declarado incumplido, u objetivo declarado contradicho). A «estrategia» solo con la palabra de la empresa; a «problema» solo con cifras.
3. **El veredicto sobre una estrategia es de la empresa, la medición es de ADI.** Con criterio declarado («hasta 24 % si rota X»), ADI dice *cumple / no cumple el criterio declarado*. Sin criterio, dice cuánto aporta, cuánto cede y qué resultado produjo — y nada más.
4. **El contexto vive mientras la empresa diga que vive.** Una carga nueva obliga a revalidar (¿siguen las premisas? ¿se cumple el criterio?), no borra la intención. Sin vigencia declarada, se reconfirma al cambiar de período.
5. **Casi todo existe:** `rolesCartera` ya separa fuga de apuesta de volumen, sella y pregunta al dueño. Faltan la clase de aporte `estrategia`, la evaluación contra criterio (M9), la vigencia en la memoria y exponerlo al anfitrión con nombre e ids.
6. **Se mide por criterio, no por estilo**, con empresas plantadas de los tres tipos y casos donde lo correcto es preguntar. **Etapa 2: cero impacto.**

---

## 1 · Qué entiende ADI por «relevante» y de quién es cada vara

Una señal es relevante cuando **pesa** (materialidad) y **desvía** contra algo con dueño declarado. Ninguna vara sola alcanza.

| Vara | Qué mide | Dueño (siempre nombrado) | Ya existe |
|---|---|---|---|
| **Materialidad** | la señal en dinero contra el piso | piso comercial 0,05 % de la venta y piso de cobranza 1 % del pendiente: **criterio general de ADI, ajustable por la empresa**; declarado por la empresa si lo fijó | `pisoFocosUSD`, `pisoMaterialidadCobranza` |
| **Pares (la propia cartera)** | tramo de venta, tercil de margen, participación en vencido vs en venta a crédito | hecho medido; «alto/bajo» se dice con el corte que lo define | `diagnoseClientes`, `rolesCartera`, PRI-04 |
| **Benchmark declarado** | distancia al margen u otra referencia de la empresa | **la empresa**; sin declaración, ADI no inventa uno | `benchmarkOf`, `POLICY` |
| **Propia historia** | variación contra el año o la carga anterior | medido, **solo donde hay serie**; sin serie nunca «se deterioró» | `variacionVentasPorEje`, `retomar` |
| **Criterio declarado** | «nadie pasa de 40 días», «acepto 24 % si rota X» | «declarado por el usuario en esta conversación» → «confirmado por la empresa» con confirmación | `derivar` (operando `criterio`), `aportarContexto` |
| **Referencia del oficio** | lo que el sector suele mirar | **el sector**: antecedente, jamás verdad ni objetivo de la empresa | Business Knowledge, tres niveles |

Prelación: lo que no supera el piso es «bajo el piso» (se dice, con cifra), no señal. Señal material contra benchmark o criterio = «señal». Lo que el oficio sugiere y la empresa no declaró = «antecedente».

## 2 · Los estados de una señal

| Estado | Definición operativa | Quién lo fija | Sello |
|---|---|---|---|
| **Anomalía** | desvía contra pares/benchmark/historia **y** es material | ADI, midiendo | probado |
| **Hipótesis compatible** | la anomalía tiene una huella compatible con una estrategia (volumen alto sin carga excedida) | ADI, midiendo la huella | indicado — nunca «la estrategia existe» |
| **Pregunta pendiente** | la distinción depende de una intención que el dato no contiene | ADI redacta el antecedente; el anfitrión pregunta | abierto |
| **Estrategia declarada** | la empresa confirmó la intención, con alcance (cuenta · dominio · período) y vigencia | la empresa; ADI nunca la promueve | declarado |
| **Estrategia medida** | ADI midió aporta · cede · resultado; **sin veredicto** si no hay criterio | ADI | medido |
| **Estrategia evaluada** | contra un criterio declarado: **cumple / no cumple el criterio declarado** | ADI mide; el criterio es de la empresa | medido + procedencia del criterio |
| **Problema** | (i) fuga con mecanismo probado que la declaración no cubre; (ii) criterio declarado **incumplido**; (iii) objetivo declarado contradicho | ADI, con cifras | probado |

Dos leyes aprobadas: **ADI jamás promueve a «estrategia» por su cuenta**; y **la carga sobre el nivel de referencia no queda cubierta por una estrategia de volumen salvo declaración explícita** — una fuga medida no se disculpa con un relato (doctrina ya vigente en `rolesCartera`).

## 3 · Catálogo de hipótesis por familia (lo demostrable y lo que hay que preguntar)

Cada fila es un antecedente; el anfitrión formula la pregunta con sus palabras.

| Familia · señal | Drivers que ADI mide | Hipótesis | Sostiene / contradice | No se puede saber | Pregunta (sentido) |
|---|---|---|---|---|---|
| **Margen por cliente** · bajo benchmark, material | precio neto vs lista, costo, carga, volumen, contribución, brecha partida (carga alta · precio y costo), markup vs sanos | H1 fuga por acciones · H2 apuesta de volumen · H3 precio pegado al costo · H4 mix | H1 carga sobre nivel (probado); H2 tramo alto sin carga excedida (indicado); H3 markup menor que sanos (indicado; sin lista: abierto); H4 sin cliente×familia: abierto | la intención; mix; rappel anual sin carga mensual | ¿deliberado para volumen, rotación o inventario? ¿acuerdo anual? |
| **Inventario** · frenado o inmovilizado crítico, material | capital, días, rotación, días sin venta, frenado ∩ top sellers | H5 descontinuado · H6 stock de seguridad / compra adelantada · H7 demanda que cayó | H7 frenado fuera del ranking (indicado); H5/H6 declarables | causa, lead time, orden pendiente | ¿decisión (seguridad, anticipo, fin de línea) o quedó sin decidirlo? |
| **Cobranza** · exposición desproporcionada (PRI-04) | pendiente, vencido, por vencer, días, plazo, participaciones, si se le sigue vendiendo | H8 plazo pactado distinto · H9 disputa · H10 tolerancia deliberada | H8 plazo declarado; H9/H10 declarables | antigüedad por tramos, abonos por factura | ¿plazo real? ¿disputa? ¿tolerancia con límite? |
| **Concentración** | top-k en venta, contribución, vencido; coincidencia entre listas | H11 dependencia buscada · H12 heredada | declarables; ADI mide peso y coincidencia con exposición | si crece (sin histórico) | ¿buscada? ¿techo por cuenta? |
| **Crecimiento / precio-volumen** | variación $ y %, precio y volumen por marca, vs presupuesto del negocio | H13 alza de precio deliberada · H14 pérdida de cuenta · H15 estacionalidad | H13 precio ↑ volumen ↓ (indicado); H14 cuentas que cayeron (probado); H15 abierto | mix; presupuesto por entidad; meses | ¿precio a propósito? ¿se perdió una cuenta? |
| **Producto** · SKU bajo margen que vende | margen, contribución, unidades, estado de inventario | H16 gancho · H17 lanzamiento · H18 costo que subió | H18 peso del costo (indicado); H16/H17 declarables | rol comercial | ¿gancho o lanzamiento? |

Admisión: una hipótesis entra solo si ADI mide al menos una huella o la declara «no comprobable con estos datos».

## 4 · Qué cubre `rolesCartera` y qué falta (sin motor paralelo)

**Cubre:** cuatro papeles con regla declarada (erosión por acciones · volumen a margen bajo · margen delgado · sano), huellas H1-H4 con sello y «qué falta», concurrencia, `preguntaAlDueno` (`volumen_deliberado`). ≈70 % del caso margen.

| Falta | Qué agrega | Reusa |
|---|---|---|
| **Estado de la señal** | la etiqueta de §2 como hecho con id, en radar y `analizar` | roles/huellas, `prioridadIntegrada` |
| **Aporte `estrategia`** (aprobado) | `{ cuentas, dominio, intención ∈ catálogo cerrado, cubre: [precio, volumen, carga?], vigencia: {desde, hasta} | "sin vigencia declarada", criterio?: {métrica, umbral, condición} }`; nace pendiente, se confirma | `aportarContexto`, `continuidad/empresa.js` (pendiente → vigente, reemplaza/retirado) |
| **M9 · medir y evaluar la estrategia** | **modo medición** (siempre): aporta ($ contribución), cede ($ no capturada vs benchmark, partida en carga y precio/costo), razón aporta/cede, volumen y unidades, carga no cubierta, resultado del período; **modo evaluación** (solo con criterio declarado): cada condición del criterio contra la cifra → *cumple / no cumple el criterio declarado*, con la procedencia del criterio | `descomposicionDeBrecha`, `contribucion`, `unidades`, `derivar` (razón, criterio), `simulateGeneral` |
| **Contrastar tipado** | `{ entidad, métrica, dirección o mecanismo }` → sostiene / contradice / no comprobable, con ids | lógica de `hipotesisDelUsuario` sin su reconocedor de frases |
| **Pregunta como antecedente** | viaja en «Para su juicio» y en el radar con su hecho de apoyo y su clave; la respuesta se registra con esa clave | `preguntaAlDueno`, Entrega |
| **Vigencia en la memoria** | campo `vigencia` en los aportes (hoy la memoria solo tiene período, reemplaza y retirado) | migración mínima, aditiva |

**Lo que ADI afirma sobre una estrategia sin criterio son hechos, no veredictos:** «la cuenta deja contribución negativa», «el volumen quedó bajo la premisa declarada», «hay [$] de carga sobre el nivel que la declaración no cubre». Decir si «vale la pena» es de la empresa.

## 5 · Cómo aprende contexto sin convertirlo en regla eterna

| Dimensión | Regla (aprobada el 2026-10-09) |
|---|---|
| **Alcance** | obligatorio: cuenta(s), dominio, período. Nunca se generaliza a otra cuenta ni a otro período. |
| **Origen** | «declarado por el usuario en esta conversación» al nacer (pendiente); «confirmado por la empresa» con `confirmar` (sello aparte). Un pendiente no cambia ningún estado. |
| **Qué cambia y qué no** | cambia el **estado** y qué mide ADI después (M9). **No cambia ninguna cifra medida.** |
| **Vigencia** | la declara la empresa (p. ej. «durante Q4»). ADI la pide al registrar; si no la dan, queda **«sin vigencia declarada»** y se **reconfirma al cambiar de período** (una línea: «¿sigue vigente?»). Así no se vuelve regla eterna: sin fecha, la intención se renueva por período con la palabra de la empresa, nunca por inercia. |
| **Carga nueva** | **revalida, no vence**: ADI vuelve a medir las premisas (¿sigue en el tramo alto? ¿se cumple el criterio?) y declara consistente / inconsistente con las dos cifras (antes/ahora). La intención sigue vigente. |
| **Al vencer** | la estrategia pasa a «vencida»; ADI entrega el **resultado del período completo** contra el criterio (si lo hubo) y la señal **vuelve a pregunta pendiente**: «¿se renueva, cambia o termina?». La intención histórica queda con su resultado. |
| **Reversibilidad** | «ya no es deliberado» = fila nueva que reemplaza y retira, con historia; la señal vuelve al estado que las cifras sostienen. |
| **Perfil y criterios** | perfil = taxonomía cerrada; criterios = toda la empresa; estrategia = por alcance. Tres cosas, una memoria. |

## 6 · Flujo completo de una señal

### 6.1 Diagrama de estados (en tabla)

| De → a | Quién dispara | Qué llama el anfitrión | Qué recibe (hechos con id y sello) | Antecedente de pregunta |
|---|---|---|---|---|
| — → **Anomalía** | ADI midiendo | `radar` | R<k>: cuenta · métrica · cifra · referencia con dueño · materialidad vs piso (probado) · estado | ninguno |
| Anomalía → **Hipótesis compatible** | ADI midiendo huellas | `analizar{papel-y-huella}`, `analizar{puente-de-margen}` | A<k>: papel · huellas con sello (probado/indicado/abierto) · brecha partida | ninguno |
| Hipótesis → **Pregunta pendiente** | ADI (la distinción es de intención) | mismo `analizar` o `radar` | hecho `pregunta` con clave (`volumen_deliberado`), entidades, porqué, hecho de apoyo | sí: sentido de la pregunta; el anfitrión la redacta |
| Pregunta → **Estrategia declarada** | la empresa | `aportarContexto{clase:estrategia}` → `confirmar` | aporte pendiente → vigente; `entendido` canónico; estado de la señal cambia | «¿con qué vigencia? ¿con qué criterio?» si faltan |
| Declarada → **Medida** | ADI | `analizar{medir-estrategia}` (M9 modo medición) | A<k>: aporta · cede (partida) · razón · unidades · carga no cubierta · resultado | ninguno; sin criterio no hay veredicto |
| Declarada → **Evaluada** | ADI contra criterio declarado | M9 modo evaluación | A<k>: cada condición del criterio → cumple / no cumple, con procedencia «criterio declarado por la empresa» | si una condición no es medible: «¿qué medida usamos como proxy?» |
| Evaluada → **Problema** | ADI (criterio incumplido) o fuga no cubierta | `radar`, `retomar` | hecho `problema` con la condición incumplida y las cifras | ninguno |
| Cualquiera → **Revalidada** | carga nueva | `retomar`, `radar` | antes/ahora por premisa y por condición; consistente / inconsistente; intención sigue vigente | si inconsistente: «¿se mantiene la decisión?» |
| Declarada → **Vencida** | vencimiento declarado (o cambio de período si «sin vigencia») | `radar`, `retomar` | resultado del período completo contra el criterio; señal vuelve a pregunta pendiente | «¿se renueva, cambia o termina?» |
| Cualquiera → estado anterior | la empresa retira | `aportarContexto{reemplaza}` | fila retirada con historia; estado según cifras | ninguno |

En todo paso, lo que el anfitrión dice al usuario es suyo; las cifras, sellos, estados y el sentido de la pregunta son de ADI.

### 6.2 Lider en tres sesiones (demo; cifras como marcadores)

**Sesión 1 (octubre).** Usuario: «¿Por qué Lider tiene tan bajo margen? ¿Es un problema?»
- `radar` → R1: Lider margen [22 %] vs benchmark [30,1 %] declarado por la empresa; no capturada [$Y] sobre el piso [$P] (criterio general de ADI); tramo alto ([p %] de la venta). **Anomalía.**
- `analizar{puente-de-margen}` → A1: [$Y] = [$Y1] carga sobre el nivel + [$Y2] precio y costo. `analizar{papel-y-huella}` → A2: H1 fuga por carga **probada** ([$Y1]); H2 volumen **compatible** (indicada); H3 **abierta**. Pregunta pendiente `volumen_deliberado`.
- Anfitrión (libre): «Hay dos cosas distintas. [$Y1] es carga comercial por encima del nivel que ustedes fijaron: eso es medible y no depende de ninguna estrategia. El resto, [$Y2], es compatible con una decisión de vender a Lider con menos margen a cambio de volumen — pero eso no está en los datos. ¿Es una decisión de ustedes?» *(de ADI: cifras, sellos, el sentido de la pregunta; del anfitrión: la redacción).*
- Usuario: «Sí. Durante Q4 aceptamos menor margen en Lider para mover inventario; aceptamos hasta 24 % si rota [X] unidades.»
- `aportarContexto{ clase: estrategia, cuentas: [Lider], dominio: margen, intención: mover_inventario, cubre: [precio, volumen], vigencia: {Q4}, criterio: { margen ≥ 24 %, unidades ≥ [X] } }` → pendiente → usuario confirma → **estrategia declarada**. ADI avisa: la carga [$Y1] **no** queda cubierta (no se declaró); «rota» no es medible por cliente (sin cliente×SKU): se usa **unidades vendidas a Lider** como medida declarada, y se dice.
- M9 evaluación con lo que hay de Q4 → A3: margen [22 %] vs 24 %: **no cumple** hoy; unidades [u] vs [X]: [cumple / en camino, k % del período]. Procedencia: criterio declarado por la empresa.
- Anfitrión: «Entonces no lo trato como deterioro: es una decisión con plazo y condición. Contra su propio criterio, hoy el margen está [2 pp] por debajo del 24 % que fijaron y las unidades van en [u] de [X]. Aparte, los [$Y1] de carga siguen fuera de la decisión: ahí sí hay algo que mirar.» *(veredicto solo contra su criterio; la carga como hecho).*

**Sesión 2 (carga de noviembre).** `retomar` + `radar`: la estrategia **sigue vigente** (Q4). ADI revalida premisas y criterio:
- Resultado posible A — **consistente y cumple**: Lider sigue en tramo alto; margen [24,3 %] ≥ 24 %; unidades [u₂] ≥ [X] acumulado. A4: «cumple el criterio declarado»; carga [$Y1'] (antes [$Y1]). Anfitrión: «La decisión con Lider va cumpliendo lo que fijaron: [24,3 %] y [u₂] unidades. Lo único que sigue fuera es la carga, que [subió/bajó] de [$Y1] a [$Y1']».
- Resultado posible B — **inconsistente / no cumple**: margen [21 %] < 24 % y unidades [u₂] < [X] al ritmo del período. A4: «no cumple el criterio declarado» (dos condiciones), con antes/ahora. La intención **no se borra**; la señal pasa a **problema (criterio incumplido)** y ADI reabre la pregunta: «¿se mantiene la decisión?». Anfitrión: «Con noviembre, la apuesta con Lider no está cumpliendo su propio criterio: margen [21 %] y unidades [u₂] de [X]. Ustedes fijaron la condición; ¿la mantienen, la ajustan o la cierran?»

**Sesión 3 (enero, Q4 vencido).** `radar`: estrategia **vencida**. ADI entrega el resultado del período completo (A5: margen del Q4 [m], unidades [u₃] vs [X], aportó [$C], cedió [$Y2], carga no cubierta [$Y1]); la señal vuelve a **pregunta pendiente**: «¿se renueva, cambia o termina?». Anfitrión: «Cerró Q4. Contra lo que fijaron, la apuesta con Lider [cumplió / no cumplió]: [m] de margen y [u₃] unidades; dejó [$C] y cedió [$Y2]. Para enero hay que decidir si sigue, y con qué condición». Sin respuesta, Lider vuelve a tratarse como anomalía con la historia a la vista — nunca como estrategia por inercia.

### 6.3 Contraste: estrategia declarada **sin criterio**

Usuario: «Con [Cuenta B] bajamos margen a propósito, es un canal que estamos desarrollando. Sin meta todavía.» → `aportarContexto{ estrategia, cuentas: [B], intención: desarrollar_canal, cubre: [precio], vigencia: "sin vigencia declarada", criterio: null }`. ADI pide vigencia; no la dan → se reconfirmará al cambiar de período. M9 **solo mide**: aporta [$C_B], cede [$Y_B] (todo precio y costo: sin carga excedida), razón [r], unidades [u_B], variación vs año anterior [+v %]. **Ningún veredicto.** Anfitrión: «No lo cuento como problema: es una decisión de ustedes. Lo que ADI mide es que [B] aporta [$C_B], cede [$Y_B] frente al benchmark y creció [v %]. Si quieren, fijamos una condición para saber si la apuesta está rindiendo» *(la propuesta de fijar criterio es del anfitrión; ADI solo midió)*.

## 7 · Cómo encaja todo (frontera intacta)

Radar con estado · `analizar` (M1-M8 de la v1, más M9 y contrastar tipado) · Business Knowledge como antecedente del sector (CAU-01 alimenta H1; jamás verdad de la empresa) · iniciativa suma la pregunta pendiente · memoria con alcance y vigencia · `derivar`/coincidencia cuantifican · `prioridadIntegrada` ordena (una estrategia que cumple su criterio baja de prioridad con el criterio dicho). El anfitrión decide cuándo llamar, cómo preguntar y cómo narrar; ADI no juzga su prosa. Sin motor paralelo: cada pieza nueva es una puerta con nombre a un productor que ya existe.

## 8 · Medición: criterio, no presentación

Banco de empresas plantadas (3), con hallazgos: (A) anomalía que es estrategia **con criterio que se cumple**; (B) estrategia con criterio **incumplido**; (B') estrategia **sin criterio** (lo correcto: medir sin veredicto); (C) verdadero problema (fuga probada sin estrategia); (D) falta la intención: lo correcto es **preguntar**; (E) preguntar está de más; (F) señuelos bajo el piso; (G) incognoscibles; (H) carga nueva que revalida sin vencer. Autor ciego; la clave la escribe quien planta; el radar debe coincidir con la clave.

Rúbrica por hilo (sí/no; rastreo contra ids, juez de otra familia ciego al estilo, revisión humana de los «no»):
1. ¿Separó demostrado, hipotético y preguntado?
2. ¿Preguntó cuando faltaba la intención (D) y no cuando no hacía falta (E)?
3. ¿Registró la intención con alcance y vigencia, y reinterpretó después?
4. **¿Dio veredicto solo contra un criterio declarado** (A/B) **y se limitó a medir cuando no lo había** (B')?
5. ¿Evitó tratar el margen bajo como problema automático (A) y evitó disculpar la fuga con la estrategia (C)?
6. ¿Revalidó con la carga nueva sin dar por vencida la estrategia (H)? ¿Cuantificó con ids, evitó el señuelo (F), declaró lo incognoscible (G)?

A/B con y sin mecanismo, en Claude y GPT, por suscripción (arnés actual). Vara de diseño, a fijar tras la línea base: rúbrica 1-6 en ≥ 90 % de los hilos; 0 fugas disculpadas; 0 estrategias afirmadas sin confirmación; 0 veredictos sin criterio.

## Impacto en el plan

**Etapa 2 no se toca** (opción 1, ensayo 11, oficiales). Preparable en paralelo sin código ni gasto: catálogo de hipótesis completo, forma exacta del aporte `estrategia` (con vigencia y criterio), banco con los casos A-H y su clave, guía delgada. Secuencia Etapa 3: 3.1 radar con estado → 3.2 `analizar` (M2, M3, M6, M7) → 3.3 aporte `estrategia` + vigencia en memoria + M9 (dos modos) → 3.4 contrastar tipado y M4, M5, M8 → 3.5 línea base del banco sin guía → 3.6 guía delgada → 3.7 A/B y vara → re-corrida por modelo nuevo como rutina.

## Decisiones del owner (aprobadas 2026-10-09)

1. **Aprobado:** la estrategia declarada es una clase propia de aporte (`estrategia`) con alcance obligatorio.
2. **Aprobado:** la carga sobre el nivel no queda cubierta por una estrategia de volumen salvo declaración explícita.
3. **Aprobado con precisión:** ADI no concluye que una estrategia «compensa» por criterio propio. Con criterio declarado por la empresa, afirma *cumple / no cumple el criterio declarado* con su procedencia. Sin criterio, se limita a medir cuánto aporta, cuánto cede y qué resultado produjo, sin decidir si vale la pena. Lo que antes se llamaba «no compensa» se presenta como hechos medidos (contribución negativa, premisa incumplida, fuga no cubierta), nunca como veredicto.
4. **Aprobado con precisión:** una carga nueva no vence una estrategia; la vigencia la declara la empresa y la carga dispara revalidación (premisas y criterio). Sin vigencia declarada: ADI la pide al registrar; si no la dan, queda «sin vigencia declarada» y se reconfirma al cambiar de período. Al vencer: resultado del período completo contra el criterio y la pregunta se reabre (¿renueva, cambia o termina?).
