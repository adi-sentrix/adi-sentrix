# Criterio ejecutivo en el Complemento · diseño de producto para la Etapa 3 (v5, final)

> Fable, 2026-10-09 · solo diseño, nada implementado, sin gasto. Editado sobre la v4 committeada en dev `c7baba78`, sin commit.
> **Qué cambió de v4 a v5:** el owner aprobó la v4 y agregó la **pieza central**: ADI opera con **dos niveles** — el **criterio central** (el método
> común, mejora para todos) y la **lógica propia de cada empresa** (benchmarks, estrategias, temporadas, excepciones, patrones descubiertos,
> insights enseñados, historia de contrastes), **aislada por empresa** y nunca generalizada. Se agrega §10 con la tabla de qué vive en cada nivel,
> el aislamiento, la fuente nueva «insights que el usuario enseña» (con contraste contra los datos), los flujos de Lider e invierno marcando qué
> aporta cada nivel, el mismo hecho leído por dos empresas distintas, y cómo se mide «ADI entiende mejor esta empresa». Tres ajustes del owner:
> (A) la historia se trata como **progresión de evidencia** (observación → señal comparable → recurrencia → patrón consistente), 24 meses como
> base práctica, sin «1 = coincidencia, 3 = patrón» rígido; (B) un patrón que deja de observarse **no se pierde**: activo · no activo (histórico) ·
> reaparecido; (C) la etiqueta de un evento (Cyber) puede venir de la empresa o de un **calendario externo gobernado** con procedencia. Decisiones
> 5-7 registradas como aprobadas con esos ajustes.
> **Qué cambió de v3 a v4:** el owner agregó la **segunda fuente de contexto**: además de lo que la empresa DECLARA, ADI debe DESCUBRIR
> patrones recurrentes en los propios datos (estacionalidad, eventos de calendario, ciclos de inventario, relaciones persistentes, excepciones
> que se repiten, rupturas) — sin inventar nunca la causa. Se agregan: §9 (las dos fuentes, catálogo cerrado de patrones, ciclo de vida, memoria
> ≠ verdad eterna, requisito de datos honesto), §6.4 (flujo del ejemplo de invierno en tres momentos), métodos M10/M11 y señales nuevas del
> radar (§7), casos y rúbrica de patrones (§8), dependencia explícita con la ingesta con historia (Impacto) y tres decisiones nuevas (5-7).
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
5. **Dos niveles de inteligencia:** el **criterio central de ADI** (cómo se analiza margen, precio, costo, volumen, acciones, contribución, inventario, cobranza, concentración, variación, materialidad, evidencia e hipótesis — igual para todos y mejora con cada versión) y la **lógica propia de cada empresa** (sus benchmarks, criterios, estrategias, eventos, patrones descubiertos, insights enseñados y la historia de cómo se contrastaron), **aislada por empresa**. La fórmula: ADI central + conocimiento específico de la empresa + contexto declarado + patrones descubiertos + insights del usuario + contraste continuo con datos nuevos. Una empresa acepta 22 % en un cliente por volumen; otra no acepta nada bajo 30 %: el mismo método lee las dos; la interpretación es de cada una, contra sus propios criterios.
6. **Tres fuentes del contexto de empresa, nunca confundidas:** lo **declarado**, lo **enseñado** por el usuario (se contrasta con los datos: sostiene / contradice / no comprobable) y lo **descubierto** por ADI en los datos (patrones). Lo descubierto es «patrón en los datos»; la causa solo como hipótesis con pregunta. La fuerza de la afirmación crece con la evidencia: observación → señal comparable → recurrencia → patrón consistente; un patrón que deja de verse queda como histórico, no se borra.
7. **Honestidad sobre los datos:** hoy ni el demo ni las planillas traen historia por entidad: ADI puede comparar un período contra su equivalente solo cuando lo tenga. La base práctica son 24 meses por entidad (enero contra enero, invierno contra invierno); hasta entonces ADI dice «sin historia comparable» y nada de patrones llega al usuario.
8. **Se mide por criterio, no por estilo**, con empresas plantadas, historia plantada y una medida de «ADI entiende mejor esta empresa con el tiempo» que no confunde acumular con comprender. **Etapa 2: cero impacto.**

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

### 6.4 El ejemplo de invierno (categoría «Calefacción»; requiere historia por entidad, §9.5; cifras como marcadores)

**Momento 1 · primera detección (con N temporadas de historia).** `radar` → R7: «patrón en los datos: en invierno (jun-ago) la familia Calefacción sube volumen [+v % típico, rango +v₁..+v₂] y baja margen [−m pp típico, rango], observado en [3] de [3] temporadas; consistente; sin explicación declarada». Material ([$] de contribución en juego sobre el piso). `analizar{M10 patrón-y-estacionalidad, Calefacción}` → A7: magnitudes por temporada, dispersión, relación volumen↔margen de las temporadas anteriores, carga comercial de invierno vs resto del año (medida). Hipótesis: H-estacional «estrategia de temporada» (indicada), H-mix (abierta: sin cliente×familia), causa externa (no comprobable). Pregunta pendiente (`estacionalidad_deliberada`): ¿es una decisión de temporada?
Anfitrión: «Hay un patrón que se repite tres inviernos: Calefacción vende [+v %] más con [−m pp] de margen. Los datos no dicen por qué. ¿Es una decisión de ustedes para la temporada, o pasa solo?» *(de ADI: el patrón con sello, cifras, el sentido de la pregunta; del anfitrión: la redacción y la elección de preguntar ahora).* Empresa: «Sí: en invierno privilegiamos volumen y disponibilidad». → `aportarContexto{ estrategia, entidades: [Calefacción], dominio: margen, intención: temporada_volumen_disponibilidad, cubre: [precio, volumen], vigencia: {jun-ago, cada año, hasta aviso}, referencia_patron: R7, criterio?: null }` → confirmada. ADI avisa que sin criterio solo medirá; el anfitrión puede ofrecer fijar uno («¿hasta cuánto margen aceptan ceder en invierno?»).

**Momento 2 · temporada siguiente, contexto conocido.** `radar` en julio → R8: «Calefacción en temporada: volumen [+v₃ %] y margen [−m₃ pp], **dentro del rango histórico** del patrón (declarado: estrategia de temporada vigente)». M11 contraste → A8: desvío respecto del típico [Δ], dentro de la dispersión; si hubiera criterio (p. ej. «margen de invierno ≥ 26 %»): cumple / no cumple. La señal **no sube de prioridad**: la Entrega la lista como «sigue el patrón, estrategia declarada».
Anfitrión: «Calefacción se comporta como todos los inviernos y como ustedes decidieron: [+v₃ %] de volumen con [−m₃ pp]. Nada nuevo que mirar ahí.»

**Momento 3 · la temporada en que se rompe.** `radar` → R9: «Calefacción **se desvía de su propio patrón**: margen [−m₄ pp] contra [−m típico] (fuera del rango), volumen [+v₄ %] (dentro del rango)». M11 con descomposición → A9: con la relación histórica volumen↔margen, el volumen de este año explica [−m_v pp]; quedan [−m_r pp] **sin explicar por el patrón**; `descomposicionDeBrecha` contra la temporada anterior: de ese residuo, [$x] es carga comercial sobre el nivel (**no cubierta** por la declaración) y [$y] precio y costo. Estado: estrategia vigente **inconsistente con los datos**; pregunta reabierta: ¿cambió la decisión, hubo una acción comercial extra, o es otra cosa?
Anfitrión: «La estrategia de invierno sigue vigente, pero este año el margen cae más que en temporadas anteriores y el aumento de volumen no explica toda la diferencia: del margen cedido, [m_v pp] es lo normal de la temporada y [m_r pp] no lo es; de eso, [$x] es carga comercial fuera de lo que ustedes declararon. ¿Hubo una acción extra con alguna cadena, o cambió la decisión?» *(cada cifra y la partición son de ADI; la causa no se afirma; la pregunta la redacta el anfitrión).* Si la ruptura se repite dos temporadas, el patrón pasa a «no activo (histórico)» con su período de vigencia observada (§9.2) y la estrategia vuelve a pregunta pendiente; si más adelante vuelve, ADI lo cuenta como «reaparecido» con las fechas.

## 7 · Cómo encaja todo (frontera intacta)

Radar con estado — y dos señales nuevas: **«se desvía de su propio patrón»** y **«patrón recurrente, material, sin explicación declarada»** · `analizar` (M1-M8 de la v1, M9, contrastar tipado, **M10 patrón y estacionalidad**, **M11 contraste contra el propio patrón / temporadas anteriores con descomposición de la desviación**) · Business Knowledge como antecedente del sector (CAU-01 alimenta H1; un patrón típico del sector se cita junto al patrón de la empresa, jamás como su explicación) · iniciativa suma la pregunta pendiente · memoria **por empresa** con cuatro procedencias (declarado · enseñado · descubierto · oficio), alcance, vigencia e historia de contrastes · `derivar`/coincidencia cuantifican · `prioridadIntegrada` ordena (una estrategia que cumple su criterio o una señal que sigue su patrón declarado baja de prioridad, con el criterio dicho). Todo el método es del **nivel central**; todo lo que se compara, declara, enseña o descubre es del **nivel empresa** (§10). El anfitrión recibe el patrón con su sello, el peldaño de evidencia y la pregunta como antecedente; decide cuándo llamar, cómo preguntar y cómo narrar; ADI no juzga su prosa. Sin motor paralelo: cada pieza nueva es una puerta con nombre a un productor que ya existe o a un cálculo simple y explicable sobre la serie.

## 8 · Medición: criterio, no presentación

Banco de empresas plantadas (3), con hallazgos: (A) anomalía que es estrategia **con criterio que se cumple**; (B) estrategia con criterio **incumplido**; (B') estrategia **sin criterio** (lo correcto: medir sin veredicto); (C) verdadero problema (fuga probada sin estrategia); (D) falta la intención: lo correcto es **preguntar**; (E) preguntar está de más; (F) señuelos bajo el piso; (G) incognoscibles; (H) carga nueva que revalida sin vencer. **Con historia plantada (24 y 36 meses por entidad, cuando la ingesta la traiga):** (I) patrón estacional real en N temporadas; (J) **una sola observación** que parece patrón (lo correcto: «sin período equivalente», no «patrón»); (J') dos ciclos: lo correcto es «recurrencia con evidencia limitada»; (K) patrón explicado por la empresa y usado en la temporada siguiente; (L) **patrón que se rompe**, con una parte explicada por volumen y un residuo de carga; (L') patrón que dejó de observarse y **reaparece** (debe contarse la historia completa). **Dos niveles (§10):** (M) la **misma empresa simulada 12 meses** (métrica de comprensión §10.5); (N) **dos empresas con el mismo hecho y criterios opuestos** (22 % aceptado vs piso 30 %): lectura distinta, 0 cruces; (O) **insight enseñado** sostenido / contradicho / no comprobable. Autor ciego; la clave la escribe quien planta; el radar debe coincidir con la clave.

Rúbrica por hilo (sí/no; rastreo contra ids, juez de otra familia ciego al estilo, revisión humana de los «no»):
1. ¿Separó demostrado, hipotético y preguntado?
2. ¿Preguntó cuando faltaba la intención (D) y no cuando no hacía falta (E)?
3. ¿Registró la intención con alcance y vigencia, y reinterpretó después?
4. **¿Dio veredicto solo contra un criterio declarado** (A/B) **y se limitó a medir cuando no lo había** (B')?
5. ¿Evitó tratar el margen bajo como problema automático (A) y evitó disculpar la fuga con la estrategia (C)?
6. ¿Revalidó con la carga nueva sin dar por vencida la estrategia (H)? ¿Cuantificó con ids, evitó el señuelo (F), declaró lo incognoscible (G)?
7. **Patrones (I-L'):** ¿detectó el patrón con su evidencia y **dijo la fuerza que correspondía al peldaño** (observación / señal comparable / recurrencia con evidencia limitada / consistente)? ¿se abstuvo de afirmar la causa? ¿preguntó cuando era material y no cuando no? ¿usó el contexto declarado en la temporada siguiente (comparó contra rango histórico y criterio)? ¿detectó la ruptura y la cuantificó con su descomposición? ¿contó la historia del patrón reaparecido con sus fechas (L')?
8. **Dos niveles (M-O):** ¿leyó el mismo hecho según el criterio de cada empresa sin opinar cuál tiene razón, y sin cruzar nada entre ellas (N)? ¿evitó repetir preguntas ya respondidas y vigentes, y contextualizó las señales con el estado correcto al mes 12 (M)? ¿contrastó el insight enseñado y lo citó con su resultado, sin usarlo como verdad ni descartarlo sin evidencia (O)?

A/B con y sin mecanismo, en Claude y GPT, por suscripción (arnés actual). Vara de diseño, a fijar tras la línea base: rúbrica 1-8 en ≥ 90 % de los hilos; 0 fugas disculpadas; 0 estrategias afirmadas sin confirmación; 0 veredictos sin criterio; 0 causas afirmadas sobre un patrón; 0 afirmaciones más fuertes que su peldaño de evidencia; 0 cruces entre empresas; 0 contextos usados fuera de su alcance o vencidos.

## 9 · La segunda fuente: patrones que ADI descubre en los datos

**El modelo explícito.** El contexto de una empresa tiene dos fuentes y la memoria las distingue siempre: (1) **DECLARADO** por la empresa — estrategias, objetivos, excepciones, eventos, decisiones comerciales (§5); (2) **DESCUBIERTO** por ADI — recurrencias, estacionalidad, cambios de comportamiento, relaciones persistentes, anomalías contra la propia historia. La ley: **lo descubierto nunca se transforma solo en causalidad**: produce un hecho («patrón en los datos, observado N veces»), una hipótesis con sello «indicado» y, cuando importa para una decisión y es material, una pregunta. La explicación la pone la empresa y queda guardada como declarado que **referencia** al patrón. Business Knowledge es la tercera cosa: el oficio y el sector, nunca la empresa; un patrón de la empresa puede contrastarse con un patrón típico del sector como antecedente.

### 9.1 Catálogo cerrado de patrones descubribles

Detección con estadística simple y explicable; todo umbral es **criterio general de ADI, ajustable por la empresa**, nunca «verdad». **La cantidad de historia afecta la fuerza de la afirmación, no impide el insight** (ajuste A del owner): la evidencia sube por peldaños.

**Progresión de evidencia (vale para todos los tipos):**

| Peldaño | Qué la habilita | Cómo se dice (antecedente de fuerza para el anfitrión) | ¿Sirve de referencia? |
|---|---|---|---|
| **Observación** | un período, sin equivalente anterior | «en [ventana] [entidad] muestra [cifra]; no hay período equivalente con que compararlo» | no: es un dato del período, no un comportamiento |
| **Señal comparable** | el período y **su equivalente del año anterior** (enero vs enero, invierno vs invierno, Cyber vs Cyber) | «se repite el comportamiento del año pasado: [antes → ahora]; evidencia limitada, dos períodos» | sí, **con advertencia explícita** de evidencia limitada; nunca como «típico» |
| **Recurrencia** | dos ciclos equivalentes con desvío en la **misma dirección** (24 meses de historia es la base práctica) | «comportamiento recurrente que merece atención: observado en 2 temporadas, [magnitud], evidencia limitada» | sí, como «recurrencia observada», con la advertencia y el rango de las dos |
| **Patrón consistente** | tres o más ciclos en la misma dirección, dentro de un rango | «comportamiento histórico consistente: observado en N temporadas, típico [x], rango [a..b]» | sí, como «comportamiento típico», con procedencia |
| **Se desvía / roto** (P6) | el ciclo actual cae fuera del rango o cambia de dirección (1 vez = se desvía; 2 seguidas = roto) | «este año se desvía de su propio comportamiento: [desvío] y su descomposición» | la referencia sigue siendo el histórico; el estado del patrón cambia (§9.2) |

| Tipo | Cómo se detecta | Evidencia mínima para «señal comparable» | Cuantificación |
|---|---|---|---|
| **P1 · Estacionalidad / recurrencia por período** (un producto sube volumen jun-ago) | para entidad × métrica × ventana del año, la ventana se compara con la mediana del resto del año de esa misma entidad; desvío si supera k veces la dispersión (MAD) o un umbral relativo; recurrente si va en la misma dirección en ciclos equivalentes | la ventana y su equivalente del año anterior | magnitud típica (mediana de los desvíos), rango histórico, dispersión |
| **P2 · Evento recurrente de calendario** (Cyber: sube venta, cae margen, suben acciones) | igual que P1 sobre la ventana del evento. **La etiqueta del evento necesita procedencia** (ajuste C): la declara la empresa (calendario propio con alcance) **o** viene de un **contexto externo gobernado** (calendario oficial de un evento comercial del país, con fuente y fecha, cargado como referencia de la casa, nunca inferido de los datos). Los datos detectan el comportamiento; la etiqueta y la explicación necesitan evidencia y procedencia | dos ediciones del evento | magnitud por métrica (venta, margen, carga), rango |
| **P3 · Ciclo pre/post temporada de inventario** | serie de fotos de inventario por entidad: alza antes de la ventana y baja después | dos temporadas con ≥ 2 fotos cada una | pico típico, días de inventario pre/post, capital inmovilizado típico |
| **P4 · Relación persistente entre métricas de una entidad** (cliente recurrentemente con menor margen y mucho mayor volumen) | la entidad queda en el mismo cuadrante (tramo alto de venta · bajo benchmark) en períodos consecutivos (cargas o años) | dos períodos | distancia típica al benchmark, peso típico en la venta, contribución típica |
| **P5 · Excepción que se repite** | una anomalía material marcada en una carga reaparece en la misma ventana en una carga siguiente | dos ventanas | magnitud y rango |
| **P6 · Ruptura del propio patrón** | el ciclo actual cae fuera del rango histórico o cambia de dirección | un patrón previo (recurrencia o consistente) | tamaño de la desviación y su **descomposición** (qué parte explica la relación histórica, qué residuo queda, de qué está hecho) |

Lenguaje que ADI usa siempre: «patrón en los datos», «observado en N temporadas», «evidencia limitada», «se desvía de su patrón». Nunca «por la lluvia», «por el invierno», «por la estrategia» — la causa solo como hipótesis con pregunta, y solo como declarado cuando la empresa lo dice.

### 9.2 Ciclo de vida del patrón descubierto

**Descubierto** (en el peldaño que la evidencia permita, §9.1) → **hipótesis + pregunta** solo si la explicación importa para una decisión y la señal es material (un patrón bajo el piso se guarda y no se pregunta) → **la empresa explica** → nace un **declarado** (estrategia o evento, con alcance y vigencia, las reglas de §5) que **referencia** al patrón → **uso en análisis futuros**: la nueva temporada se compara contra el **rango histórico** del patrón y contra el **criterio declarado** si lo hay → **contraste continuo** en cada carga: «sigue el patrón» / «se desvía del patrón», con la cuantificación de la desviación y su descomposición → si se rompe dos veces seguidas, la pregunta se reabre y el declarado pasa a «por reconfirmar». **Sin respuesta de la empresa**, el patrón sigue como hecho observado (no causal) y puede usarse como referencia de **«comportamiento típico»** declarando siempre su procedencia: «patrón observado por ADI en N temporadas, sin explicación declarada» (decisión 6, aprobada).

**Estados del patrón (ajuste B del owner): un patrón que deja de observarse NO se pierde.**

| Estado | Cuándo | Qué conserva | Cómo se dice |
|---|---|---|---|
| **Activo** | el último ciclo equivalente siguió el patrón (dentro del rango) | firma, rango, historia de contrastes | «comportamiento vigente, observado en N temporadas» |
| **No activo (histórico)** | dos ciclos seguidos fuera del rango o sin la recurrencia | **todo**: firma, rango, el **período de vigencia observada**, la historia de contrastes y la explicación declarada que lo referenciaba | «este comportamiento ocurrió durante [2026-2027] y dejó de observarse en [2028]» |
| **Reaparecido** | un patrón no activo vuelve a cumplirse en un ciclo equivalente | lo anterior más la nueva observación; se reabre la pregunta si es material | «este comportamiento ocurrió durante [2026-2027], dejó de observarse en [2028] y reapareció ahora» |

Un patrón histórico no sirve como «comportamiento típico» del presente (lo dice su estado), pero sí como antecedente: el anfitrión puede contar la historia completa porque ADI la conserva con fechas.

### 9.3 Memoria empresarial ≠ verdad eterna

| Qué | Regla |
|---|---|
| **Qué se guarda de un patrón** | su **firma**: tipo, entidades, métrica, ventana de período, dirección; más la **historia de contrastes** (por carga: sigue / se desvía / roto, con las cifras que se dijeron) y la explicación declarada que lo referencia. **No se guardan conclusiones ni la cifra como verdad**: las magnitudes se recalculan de los datos en cada carga (siempre derivables). |
| **Recalculo** | cada carga vuelve a medir el patrón desde la serie; si la carga cambia la historia, el patrón cambia y se dice (antes/ahora). |
| **Caducidad** | si deja de observarse pasa a **no activo (histórico)** con su período de vigencia observada — no se borra (§9.2); si la entidad desaparece o la serie se acorta, «sin historia comparable». Nunca se borra la historia de contrastes. |
| **Cuatro cosas distinguibles en la memoria** | **descubierto** (procedencia «patrón observado por ADI, N temporadas», con estado activo/histórico/reaparecido), **declarado** (procedencia «declarado/confirmado por la empresa», con alcance y vigencia), **enseñado** (procedencia «enseñado por el usuario», con su contraste contra los datos, §10.3), **oficio** (Business Knowledge, sujeto = el sector). Un hecho nunca cambia de fuente; una explicación declarada o enseñada puede apuntar a un patrón, no reemplazarlo. |
| **Largo plazo** | cuanto más tiempo use ADI una empresa, más patrones con más temporadas y más explicaciones declaradas — y cada uno sigue siendo revalidable, con fecha y con dueño. Eso es entender mejor la empresa sin confundir memoria con verdad eterna. |

### 9.4 Lo que ADI puede medir, y lo que debe preguntar, en un patrón

Mide: que ocurre, cuántas veces, cuánto, con qué rango, si la temporada actual está dentro o fuera, cuánto de la desviación explica la relación histórica (p. ej. volumen↔margen) y de qué está hecho el residuo (carga sobre el nivel · precio y costo, con `descomposicionDeBrecha` contra la temporada anterior), y si cumple un criterio declarado. Pregunta: la intención (¿decisión de temporada?), el evento (¿hubo acción comercial extra?), lo externo (clima, competencia, feriados: **no comprobable** con estos datos; se declara). Business Knowledge aporta el antecedente («en retail de temporada el oficio espera más volumen y menos margen en invierno»): nunca es la explicación de esta empresa.

### 9.5 Requisito de datos — honesto

**Hoy no hay período equivalente con que comparar por entidad.** El demo y las planillas traen: un año cerrado más el año anterior en **totales** por entidad; `ventasMensuales` con **12 meses agregados del negocio** (venta, año anterior, presupuesto); `historialMargen` por entidad **sintético y plano**, bloqueado a propósito (`temporal.js`); sin cliente×SKU, sin serie mensual por entidad, sin fotos sucesivas de inventario, sin calendario de eventos. Con eso, por entidad solo hay **observación** (el primer peldaño): la variación anual total sí se dice (ya existe), pero ninguna ventana del año tiene su equivalente. A nivel del negocio, los 12 meses de `ventasMensuales` con su año anterior permiten una **señal comparable** por mes (eso ya lo hace la película del negocio), nunca recurrencia. ADI lo declara: **«sin historia comparable por entidad: para comparar [invierno] contra [invierno anterior] hacen falta al menos 24 meses por entidad; hoy hay [12] del negocio»** (misma familia que `ausencias`).

**Qué exige la ingesta:** serie mensual por entidad (cliente, SKU; marca/familia se derivan) de venta, unidades, costo y acciones comerciales; **24 meses como base práctica** (habilita señal comparable y recurrencia: enero vs enero, Cyber vs Cyber), 36 o más para «consistente»; fotos de inventario por fecha; un **calendario de eventos** con procedencia (declarado por la empresa, o externo gobernado para eventos oficiales del país). Dos vías: (a) la ingesta con historia (planilla con columna de mes, el formato que la Ingesta/piloto postergada ya tenía anotado); (b) la **acumulación de cargas** sucesivas (`versionId`), que ADI ya guarda y revalida — construye historia sola, a razón de una carga por período: útil para P4 y P5, lenta para P1-P3.

**Conexión con el plan:** la parte de patrones **depende de la ingesta con historia** que estaba postergada para el piloto; no se puede construir ni medir con el dato actual. Lo que sí se puede hacer sin historia: el diseño, el catálogo, la memoria de fuentes, el banco con historia plantada (sintética) y el método sobre datos sintéticos.

## 10 · Dos niveles: criterio central y lógica de cada empresa

**La pieza central (owner, 2026-10-09).** ADI opera con dos niveles de inteligencia empresarial: el **criterio central** —el método común: cómo se analiza margen, precio, costo, volumen, acciones comerciales, contribución, inventario, cobranza, concentración, variaciones, materialidad, evidencia e hipótesis— que mejora para todos los clientes; y la **lógica propia de cada empresa** —sus estrategias, benchmarks, temporadas, excepciones y decisiones— que ADI construye progresivamente con lo que la empresa declara, lo que el usuario le enseña, los patrones que descubre y los resultados posteriores que permiten contrastarlo. **Lo aprendido en una compañía nunca se generaliza a otra.** El central sabe analizar ambas situaciones; la interpretación estratégica pertenece a cada empresa.

### 10.1 Qué vive en cada nivel

| | **Criterio central de ADI** | **Lógica propia de cada empresa** |
|---|---|---|
| **Qué contiene** | los métodos (M1-M11, contrastar), los catálogos (hipótesis §3, patrones §9.1, estados §2), la progresión de evidencia, los umbrales **por defecto** (pisos, k de desvío, peldaños) marcados «criterio general de ADI», Business Knowledge del sector (sujeto = el sector), las rúbricas y el banco de medición | benchmarks y criterios declarados, umbrales ajustados por la empresa, estrategias y eventos propios con alcance y vigencia, patrones descubiertos en SUS datos con su estado, insights enseñados por el usuario con su contraste, la historia de contrastes y de preguntas respondidas |
| **Quién lo cambia** | el producto, por versión, con gate rojo-primero y el banco | la empresa, por uso: declarando, enseñando, confirmando, respondiendo; ADI, descubriendo y contrastando — siempre con procedencia |
| **Cómo mejora** | para todos a la vez; se mide con el banco (A-L) antes de publicar | para esa empresa sola; se mide con la métrica de comprensión (§10.5) |
| **Qué nunca hace** | decidir la estrategia de una empresa; traer una cifra de la empresa | subir al central; prestarse a otra empresa; cambiar una cifra medida |

### 10.2 Aislamiento por empresa

- **Dónde vive:** la memoria de empresa ya es **por tenant** (`memoria_empresa`, almacén aislado por empresa en Supabase; el tenant sale del token, nunca de un argumento; `derivar`/`retomar` rechazan `otra_empresa`). Todo lo nuevo (estrategia, enseñado, patrón, historia de contrastes) entra en esa misma memoria, con la misma llave de empresa. Nada del nivel empresa vive en código ni en configuración compartida.
- **La prueba ya existe:** la medición del anfitrión cuenta **«cruces entre empresas»** (una cifra de una empresa dicha en otra) con regla dura = 0; el banco de la Etapa 3 la conserva y la extiende a estrategias, patrones e insights (un contexto de la empresa A citado en la B = cruce).
- **Regla dura:** **nada de la lógica de una empresa sube al central automáticamente.** Si algún día el producto quiere aprender del uso agregado (qué umbrales ajustan las empresas, qué hipótesis confirman), eso es una **decisión de producto explícita, anonimizada y fuera de esta etapa**. Se nombra como límite; no se diseña aquí.

### 10.3 La fuente nueva: insights que el usuario quiere enseñarle

Ejemplos: «nuestros clientes de regiones pagan a 60 días», «cuando sube el dólar subimos precios con un mes de retraso», «Lider siempre compra más en marzo».

| Paso | Regla |
|---|---|
| **Registro** | clase de aporte `insight` (hermana de `estrategia`): `{ enunciado tipado: entidades o grupo, métrica(s), relación o comportamiento, condición?, alcance, vigencia | "sin vigencia declarada" }`, procedencia **«enseñado por el usuario»**; nace pendiente y se confirma como todo aporte. Lo que no se puede tipar contra el léxico de la casa queda como nota de la memoria (se guarda, se cita como «nota del usuario», no entra al análisis). |
| **Contraste** | ADI lo contrasta con los datos **sin aceptarlo como verdad ni rechazarlo como falso sin evidencia**: *sostiene* («los clientes de regiones promedian [62] días vencidos vs [31] del resto»), *contradice* («en marzo Lider compró [−8 %] vs su media»), o *no comprobable* («no hay serie de tipo de cambio ni de precios por mes»). El resultado viaja junto al insight, con sus ids. Un insight contradicho **no se borra**: queda «enseñado, contradicho por los datos en [carga]» y se le devuelve a la persona. |
| **Uso en el análisis** | un insight *sostenido* entra como **antecedente con procedencia** en la Entrega y en el radar («enseñado por el usuario, sostenido por los datos»): puede convertir una anomalía en hipótesis compatible (igual que un patrón) y habilitar la pregunta; un insight *no comprobable* se cita como contexto declarado sin cifra; uno *contradicho* se cita con su contraste. Nunca cambia una cifra medida ni un veredicto: un insight no es un criterio. Si la persona quiere que rija, lo declara como criterio o estrategia. |
| **Revalidación** | se recontrasta en cada carga, como un patrón; la historia de contrastes se conserva; vence según su vigencia o se reconfirma al cambiar de período. |

### 10.4 Los dos niveles dentro del flujo

**Lider (§6.2), paso a paso — [C] = aporta el central · [E] = aporta la empresa:**

| Paso | Central | Empresa |
|---|---|---|
| Detectar (radar) | el método de materialidad y de pares; el piso **por defecto** 0,05 % [C] | el benchmark 30,1 % declarado; el piso si lo ajustó [E] |
| Drivers (puente, papel y huella) | la partición carga / precio y costo; los cuatro papeles; los sellos [C] | el nivel de carga de referencia declarado [E] |
| Hipótesis y pregunta | el catálogo H1-H4 y el sentido de la pregunta [C] | nada todavía: por eso se pregunta |
| Declaración y criterio | la forma del aporte, la ley «la carga no queda cubierta salvo declaración» [C] | «durante Q4 aceptamos menor margen en Lider… hasta 24 % si rota X» [E] |
| Evaluación (M9) | el método: aporta · cede · cumple/no cumple **contra el criterio recibido** [C] | el criterio contra el que se evalúa [E] |
| Revalidación y vencimiento | la regla «la carga revalida, la vigencia vence» [C] | la vigencia Q4 y la respuesta «¿renueva, cambia o termina?» [E] |

**Invierno (§6.4):** el método de recurrencia, la progresión de evidencia, la descomposición volumen↔margen y el antecedente del oficio («en retail de temporada el sector espera más volumen y menos margen») son [C]; la temporada propia, la explicación «privilegiamos volumen y disponibilidad», el rango histórico de ESA familia, el criterio de invierno si lo fijan y la historia de contrastes son [E]. Business Knowledge nunca explica la causa de esta empresa: solo dice qué suele mirar el oficio.

**El mismo hecho, dos empresas.** Hecho medido (central, idéntico en las dos): «cuenta X: margen 22 %, tramo alto de venta, carga dentro del nivel, contribución [$C], cede [$Y] contra el benchmark». Empresa 1 declaró «aceptamos 22 % en X por volumen, criterio: contribución ≥ [$Y_min]» → ADI: estrategia declarada, **cumple el criterio declarado** ([$C] ≥ [$Y_min]); baja de prioridad. Empresa 2 declaró «ninguna cuenta bajo 30 %» como criterio de la empresa → ADI: **no cumple el criterio declarado** (22 % < 30 %), estado problema por criterio incumplido; sube de prioridad. **Mismo método, misma cifra, distinta lectura estratégica — ambas solo contra sus criterios declarados, y ADI no opina cuál empresa tiene razón.**

### 10.5 «ADI entiende mejor esta empresa con el tiempo», medible

Comprender no es acumular. Lo que debe cambiar en la Entrega entre el mes 1 y el mes 12 de una misma empresa:

| Mes 1 | Mes 12 |
|---|---|
| señales con estado «anomalía» y preguntas abiertas | las mismas señales con estado «estrategia declarada / evaluada» o «sigue su patrón», y las nuevas sí como anomalía |
| comparaciones contra benchmark y pares | además contra su propia historia (período equivalente, rango del patrón) y contra sus criterios |
| el mismo tipo de pregunta en cada hilo | **no se vuelve a preguntar lo ya respondido y vigente**; se pregunta lo nuevo, lo vencido y lo que se rompió |
| patrones en peldaño «observación / señal comparable» | recurrencias y patrones consistentes con rango; históricos conservados |

Métricas en el banco (empresa plantada con 12 meses de uso simulado, misma persona, 8-10 hilos espaciados): **(1) preguntas evitadas** = preguntas que el mes 1 hizo y el mes 12 no hace porque la respuesta está vigente, sobre el total de señales con contexto (meta: tiende a 100 %; si ADI repite una pregunta ya respondida y vigente, falla); **(2) señales correctamente contextualizadas** = señales cuyo estado coincide con la clave plantada (estrategia vigente leída como tal, problema leído como problema), sobre el total; **(3) rupturas detectadas** = rupturas plantadas detectadas y cuantificadas; **(4) sin falsa memoria** = 0 contextos usados fuera de su alcance o vencidos, 0 insights contradichos citados como verdad, 0 cruces entre empresas. La trampa a evitar: una Entrega más larga en el mes 12 **no** cuenta como comprensión; cuenta el estado correcto y la pregunta no repetida.

## Impacto en el plan

**Etapa 2 no se toca** (opción 1, ensayo 11, oficiales). Preparable en paralelo sin código ni gasto: catálogo de hipótesis completo, forma exacta de los aportes `estrategia` e `insight` (con alcance, vigencia, criterio y `referencia_patron`), catálogo de patrones con sus umbrales y peldaños (§9.1), la lista de qué va en cada nivel (§10.1) como contrato, banco con los casos A-O y su clave (la historia de I-L' y los 12 meses de M son sintéticos y se pueden escribir ya), guía delgada.

**Secuencia Etapa 3, en dos carriles (los dos sobre la memoria por empresa que ya existe):**
- **Carril 1 (dato actual, sin dependencia):** 3.1 radar con estado → 3.2 `analizar` (M2, M3, M6, M7) → 3.3 aportes `estrategia` e `insight` + vigencia + memoria con cuatro procedencias + M9 (dos modos) + contraste del insight → 3.4 contrastar tipado y M4, M5, M8 → 3.5 línea base del banco (casos A-H, N, O) sin guía → 3.6 guía delgada → 3.7 A/B y vara.
- **Carril 2 (patrones · DEPENDE de la ingesta con historia):** 3.8 ingesta con serie mensual por entidad (24 meses como base) + calendario de eventos con procedencia (la pieza postergada del piloto) → 3.9 M10/M11 y la progresión de evidencia sobre datos sintéticos con historia plantada, gate rojo-primero → 3.10 señales de patrón en el radar y estados activo/histórico/reaparecido → 3.11 casos I-L' y M del banco y A/B. Mientras no haya historia real, ADI declara «sin historia comparable» y nada del carril 2 llega al usuario.
- Candado transversal desde 3.1: **0 cruces entre empresas** sobre todo lo nuevo (estrategias, insights, patrones), en el gate y en el banco.
- Después, re-corrida por modelo nuevo como rutina; el nivel central se publica por versión, el nivel empresa crece por uso.

## Decisiones del owner (aprobadas 2026-10-09)

1. **Aprobado:** la estrategia declarada es una clase propia de aporte (`estrategia`) con alcance obligatorio.
2. **Aprobado:** la carga sobre el nivel no queda cubierta por una estrategia de volumen salvo declaración explícita.
3. **Aprobado con precisión:** ADI no concluye que una estrategia «compensa» por criterio propio. Con criterio declarado por la empresa, afirma *cumple / no cumple el criterio declarado* con su procedencia. Sin criterio, se limita a medir cuánto aporta, cuánto cede y qué resultado produjo, sin decidir si vale la pena. Lo que antes se llamaba «no compensa» se presenta como hechos medidos (contribución negativa, premisa incumplida, fuga no cubierta), nunca como veredicto.
4. **Aprobado con precisión:** una carga nueva no vence una estrategia; la vigencia la declara la empresa y la carga dispara revalidación (premisas y criterio). Sin vigencia declarada: ADI la pide al registrar; si no la dan, queda «sin vigencia declarada» y se reconfirma al cambiar de período. Al vencer: resultado del período completo contra el criterio y la pregunta se reabre (¿renueva, cambia o termina?).

## Decisiones 5-7 (aprobadas 2026-10-09, con los ajustes del owner)

5. **Aprobado con ajuste (A):** la historia se trata como **progresión de evidencia**, no como umbral rígido: observación → señal comparable (el período y su equivalente del año anterior) → recurrencia (dos ciclos, «merece atención, evidencia limitada») → patrón consistente (tres o más). **24 meses por entidad es la base práctica** para comenzar. La cantidad de historia afecta la fuerza de la afirmación, no impide el insight. Umbrales de desvío como criterio general de ADI, ajustables por la empresa.
6. **Aprobado:** un patrón sin explicación declarada se usa como «comportamiento típico» **solo como referencia con procedencia** («patrón observado por ADI en N temporadas, sin explicación declarada»), nunca como objetivo ni causa; la pregunta sigue abierta mientras sea material. **Ajuste (B):** un patrón que deja de observarse **no se pierde**: pasa a «no activo (histórico)» con su período de vigencia observada, y puede «reaparecer»; la historia de contrastes se conserva. **Ajuste (C):** la etiqueta de un evento (Cyber) viene de la empresa o de un calendario externo **gobernado** con procedencia; los datos detectan el comportamiento, la etiqueta y la explicación necesitan evidencia y procedencia.
7. **Aprobado:** la ingesta con historia entra **en paralelo, como carril 2**, sin frenar el carril 1; el formato (mes por entidad + calendario de eventos con procedencia) se cierra con el frente de Datos del cliente; el código y la medición de patrones esperan a tener 24 meses reales o el banco sintético.

**Registrado como pieza central (owner, 2026-10-09):** dos niveles — criterio central de ADI y lógica propia de cada empresa, aislada por empresa y nunca generalizada (§10). Sin decisiones nuevas pendientes: el único límite anotado es que aprender del uso agregado entre empresas sería una decisión de producto explícita, anonimizada y fuera de esta etapa.
